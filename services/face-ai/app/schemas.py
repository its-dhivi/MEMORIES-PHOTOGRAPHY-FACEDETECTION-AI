from pydantic import BaseModel, Field


class BoundingBox(BaseModel):
    x: int
    y: int
    width: int
    height: int


class FaceAnalysis(BaseModel):
    bounding_box: BoundingBox = Field(alias="boundingBox")
    detection_confidence: float = Field(alias="detectionConfidence")
    quality_score: float = Field(alias="qualityScore")
    quality_status: str = Field(alias="qualityStatus")
    embedding: list[float] | None = None
    landmarks: list[list[float]] | None = None
    aligned_preview: str | None = Field(default=None, alias="alignedPreview")
    model_config = {"populate_by_name": True}


class AnalysisResponse(BaseModel):
    model_name: str = Field(alias="modelName")
    model_version: str = Field(alias="modelVersion")
    preprocessing_version: str = Field(alias="preprocessingVersion")
    detection_pipeline_version: str = Field(alias="detectionPipelineVersion")
    embedding_dimension: int = Field(alias="embeddingDimension")
    width: int
    height: int
    faces: list[FaceAnalysis]
    model_config = {"populate_by_name": True}
