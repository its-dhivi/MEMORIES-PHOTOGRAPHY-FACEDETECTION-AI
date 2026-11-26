from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    ai_internal_token: str = Field(min_length=32)
    face_model_provider: Literal["onnx"] = "onnx"
    face_model_name: str = "operator-supplied"
    face_model_version: str = Field(min_length=1)
    face_recognition_model_path: str
    face_detection_model_path: str
    face_embedding_dimension: int = Field(default=512, ge=1, le=4096)
    face_recognition_output_dimension: int = Field(default=512, ge=1, le=4096)
    face_device: Literal["cpu", "gpu"] = "cpu"
    face_detection_input_size: int = Field(default=640, ge=160, le=2048)
    face_detection_threshold: float = Field(default=0.75, ge=0.0, le=1.0)
    face_min_size_pixels: int = Field(default=48, ge=16)
    face_min_blur_variance: float = Field(default=35.0, ge=0.0)
    face_min_exposure: float = Field(default=35.0, ge=0.0, le=255.0)
    face_max_exposure: float = Field(default=225.0, ge=0.0, le=255.0)
    face_max_concurrent_inferences: int = Field(default=2, ge=1, le=32)
    max_image_bytes: int = Field(default=52_428_800, ge=1024)
    max_image_pixels: int = Field(default=80_000_000, ge=1_000_000)


@lru_cache
def get_settings() -> Settings:
    return Settings()
