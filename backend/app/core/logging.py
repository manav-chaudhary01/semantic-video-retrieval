import logging
import sys
from typing import Any, Dict


class StructuredFormatter(logging.Formatter):
    """Formats logs with standardized timestamps and contextual attributes."""

    def format(self, record: logging.LogRecord) -> str:
        record_message = super().format(record)
        log_entry: Dict[str, Any] = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "logger": record.name,
            "message": record_message,
        }
        if hasattr(record, "props"):
            log_entry.update(record.props)
        return f"[{log_entry['timestamp']}] [{log_entry['level']}] [{log_entry['logger']}]: {log_entry['message']}"


def setup_logging(debug: bool = True) -> logging.Logger:
    """Configures root and application loggers."""
    log_level = logging.DEBUG if debug else logging.INFO

    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(log_level)
    formatter = StructuredFormatter(
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)

    # Avoid duplicate handlers on reloads
    if not root_logger.handlers:
        root_logger.addHandler(handler)
    else:
        root_logger.handlers = [handler]

    # Silence overly verbose third-party loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("multipart").setLevel(logging.WARNING)

    return logging.getLogger("semantic_video_retrieval")


logger = setup_logging()
