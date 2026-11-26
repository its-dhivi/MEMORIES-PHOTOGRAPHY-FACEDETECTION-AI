from io import BytesIO
from typing import Any

from fastapi import HTTPException, status
from PIL import Image, ImageOps, UnidentifiedImageError

from .config import Settings

ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}


def decode_image(payload: bytes, settings: Settings) -> Any:
    if not payload or len(payload) > settings.max_image_bytes:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Image exceeds size limit")
    Image.MAX_IMAGE_PIXELS = settings.max_image_pixels
    try:
        with Image.open(BytesIO(payload)) as source:
            if source.format not in ALLOWED_FORMATS:
                raise HTTPException(
                    status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Unsupported image format"
                )
            source.verify()
        with Image.open(BytesIO(payload)) as source:
            if source.width * source.height > settings.max_image_pixels:
                raise HTTPException(
                    status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Image exceeds pixel limit"
                )
            normalized = ImageOps.exif_transpose(source).convert("RGB")
            import numpy as np

            return np.asarray(normalized).copy()
    except HTTPException:
        raise
    except (Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Unsafe image dimensions"
        ) from None
    except (UnidentifiedImageError, OSError, ValueError):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Corrupted image") from None
