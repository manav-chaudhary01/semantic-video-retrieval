import os
import re
import uuid
from pathlib import Path
from backend.app.core.exceptions import SecurityError, ValidationError


def validate_uuid(val: str, field_name: str = "ID") -> str:
    """Validates that a string is a safe identifier (UUID or safe alphanumeric token).
    
    Guarantees no directory traversal characters ('.', '/', '\\') or SQL injection tokens.
    """
    if not val:
        raise ValidationError(f"{field_name} cannot be empty.")
    clean_val = val.strip()
    if not re.match(r"^[a-zA-Z0-9_\-]+$", clean_val) or len(clean_val) > 64:
        raise ValidationError(f"Invalid {field_name} format '{val}'. Expected a valid UUID or safe identifier.")
    return clean_val


def sanitize_filename(filename: str) -> str:
    """Strips directory traversal components and dangerous characters from filenames."""
    if not filename:
        return "unnamed_video.mp4"
    # Take basename only
    base = Path(filename).name
    # Remove null bytes and non-printable characters
    clean = re.sub(r"[\x00-\x1f\x7f]", "", base)
    # Strip leading dots/slashes
    clean = clean.lstrip("./\\ ")
    # Replace dangerous or reserved characters
    clean = re.sub(r'["*/:<>?\\|]', "_", clean)
    if not clean:
        clean = "unnamed_video.mp4"
    # Limit length
    return clean[:255]


def safe_resolve_path(target_path: Path, allowed_parent: Path) -> Path:
    """Resolves target_path and guarantees it resides strictly inside allowed_parent."""
    resolved_parent = allowed_parent.resolve()
    resolved_target = (
        target_path.resolve()
        if target_path.is_absolute()
        else (resolved_parent / target_path).resolve()
    )

    try:
        # Check that resolved_target is relative to resolved_parent
        resolved_target.relative_to(resolved_parent)
    except ValueError:
        raise SecurityError(
            f"Access denied: Path '{target_path}' attempts to traverse outside allowed directory '{allowed_parent}'."
        )

    return resolved_target
