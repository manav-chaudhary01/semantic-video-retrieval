import os
import shutil
from pathlib import Path
from backend.app.core.config import settings
from backend.app.schemas.health import HealthResponse


def ensure_ffmpeg_path() -> bool:
    """Ensures FFmpeg binary directory is present in PATH, checking registry/WinGet locations if needed."""
    if shutil.which("ffmpeg") is not None:
        return True

    # Check common Windows winget installation paths
    local_app_data = os.environ.get("LOCALAPPDATA", "")
    if local_app_data:
        winget_pkgs = Path(local_app_data) / "Microsoft" / "WinGet" / "Packages"
        if winget_pkgs.exists():
            for p in winget_pkgs.glob("**/ffmpeg.exe"):
                bin_dir = str(p.parent)
                os.environ["PATH"] = bin_dir + os.pathsep + os.environ.get("PATH", "")
                if shutil.which("ffmpeg") is not None:
                    return True

    return False


class HealthService:
    """Service providing runtime diagnostics and dependency health status."""

    @staticmethod
    def get_health() -> HealthResponse:
        ffmpeg_found = ensure_ffmpeg_path()

        # Check CUDA availability safely without crashing if torch is not yet imported
        cuda_found = False
        device_str = "cpu"
        try:
            import torch
            cuda_found = torch.cuda.is_available()
            if cuda_found:
                device_str = f"cuda:0 ({torch.cuda.get_device_name(0)})"
        except ImportError:
            # Fallback check via nvidia-smi if torch not yet installed in Phase 1
            if shutil.which("nvidia-smi") is not None:
                cuda_found = True
                device_str = "gpu (nvidia driver detected, torch pending)"
            else:
                cuda_found = False
                device_str = "cpu"

        return HealthResponse(
            status="healthy",
            version=settings.VERSION,
            environment=settings.ENVIRONMENT,
            ffmpeg_available=ffmpeg_found,
            cuda_available=cuda_found,
            device=device_str,
        )


health_service = HealthService()
