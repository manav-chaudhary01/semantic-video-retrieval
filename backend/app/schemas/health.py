from typing import Optional
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """Schema for GET /api/health response."""

    status: str = Field(default="healthy", description="Application status")
    version: str = Field(description="Semantic version of the application")
    environment: str = Field(description="Runtime environment name")
    ffmpeg_available: bool = Field(description="Whether ffmpeg CLI was detected in system PATH")
    cuda_available: bool = Field(description="Whether CUDA-compatible GPU is available")
    device: str = Field(description="Active execution device identifier")
