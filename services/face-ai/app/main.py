import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile, status
from pydantic import BaseModel

from .config import get_settings
from .image_processor import decode_image
from .model_manager import ModelManager
from .schemas import AnalysisResponse
from .security import require_internal_token

settings = get_settings()
manager = ModelManager(settings)
inference_slots = asyncio.Semaphore(settings.face_max_concurrent_inferences)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    await asyncio.to_thread(manager.load)
    yield


app = FastAPI(
    title="Memories Photography Face AI",
    version="0.3.0",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
    lifespan=lifespan,
)


class HealthResponse(BaseModel):
    status: str
    ready: bool
    device: str
    model_name: str
    model_version: str
    providers: list[str]
    error: str | None = None


@app.get("/health/live")
async def live() -> dict[str, str]:
    return {"status": "alive"}


@app.get("/health/ready", response_model=HealthResponse)
async def ready() -> HealthResponse:
    response = HealthResponse(
        status="ready" if manager.ready else "not_ready",
        ready=manager.ready,
        device=settings.face_device,
        model_name=settings.face_model_name,
        model_version=settings.face_model_version,
        providers=manager.providers,
        error=manager.error,
    )
    if not manager.ready:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail=response.model_dump())
    return response


@app.get("/health")
async def compatibility_health() -> dict[str, object]:
    return {"status": "ok", "model_loaded": manager.ready, "model": settings.face_model_name}


async def analyze_payload(file: UploadFile) -> AnalysisResponse:
    image = decode_image(await file.read(settings.max_image_bytes + 1), settings)
    if not manager.ready:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Face models are unavailable")
    async with inference_slots:
        try:
            return await asyncio.to_thread(manager.analyze, image)
        except RuntimeError as exc:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc


@app.post(
    "/internal/v1/faces/analyze",
    response_model=AnalysisResponse,
    dependencies=[Depends(require_internal_token)],
)
async def analyze(file: UploadFile = File(...)) -> AnalysisResponse:
    return await analyze_payload(file)


@app.post(
    "/internal/v1/faces/embed-selfie",
    response_model=AnalysisResponse,
    dependencies=[Depends(require_internal_token)],
)
async def embed_selfie(file: UploadFile = File(...)) -> AnalysisResponse:
    result = await analyze_payload(file)
    if not result.faces:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "NO_FACE_DETECTED")
    if len(result.faces) != 1:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "MULTIPLE_FACES_DETECTED")
    if result.faces[0].quality_status != "ACCEPTED" or result.faces[0].embedding is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, result.faces[0].quality_status)
    return result
