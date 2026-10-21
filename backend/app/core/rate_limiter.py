import time
import threading
from collections import defaultdict, deque
from typing import Dict, Deque, Optional, Tuple
from fastapi import Request

from backend.app.core.config import settings
from backend.app.core.logging import logger
from backend.app.core.exceptions import RateLimitExceededError


class SlidingWindowRateLimiter:
    """Thread-safe in-memory sliding window rate limiter."""

    def __init__(self):
        self._lock = threading.Lock()
        self._records: Dict[str, Deque[float]] = defaultdict(deque)

    def is_allowed(self, key: str, max_requests: int, window_sec: float = 60.0) -> Tuple[bool, int]:
        """Checks if a request is permitted under the sliding window rate limit.
        
        Returns (is_allowed, retry_after_sec).
        """
        now = time.monotonic()
        cutoff = now - window_sec

        with self._lock:
            q = self._records[key]
            # Purge timestamps outside the sliding window
            while q and q[0] < cutoff:
                q.popleft()

            if len(q) < max_requests:
                q.append(now)
                return True, 0

            # Rate limit exceeded: calculate retry-after duration
            oldest = q[0]
            retry_after = max(1, int(window_sec - (now - oldest)))
            return False, retry_after

    def reset(self) -> None:
        """Clears all tracking history (primarily for unit tests)."""
        with self._lock:
            self._records.clear()


rate_limiter_store = SlidingWindowRateLimiter()


def get_client_ip(request: Request) -> str:
    """Extracts client IP address safely, checking proxy headers if present."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        client_ip = forwarded.split(",")[0].strip()
        if client_ip:
            return client_ip
    if request.client and request.client.host:
        return request.client.host
    return "127.0.0.1"


class RateLimitDependency:
    """FastAPI route dependency that enforces rate limits."""

    def __init__(self, max_requests: int, tier_name: str = "default", window_sec: float = 60.0):
        self.max_requests = max_requests
        self.tier_name = tier_name
        self.window_sec = window_sec

    def __call__(self, request: Request) -> None:
        if not settings.RATE_LIMIT_ENABLED:
            return

        client_ip = get_client_ip(request)
        key = f"{self.tier_name}:{client_ip}"

        allowed, retry_after = rate_limiter_store.is_allowed(
            key=key,
            max_requests=self.max_requests,
            window_sec=self.window_sec,
        )

        if not allowed:
            logger.warning(
                f"Rate limit exceeded on {request.method} {request.url.path} for client {client_ip} "
                f"({self.tier_name}: {self.max_requests} req/{self.window_sec}s). Retry-After: {retry_after}s"
            )
            raise RateLimitExceededError(
                retry_after=retry_after,
                message=(
                    f"Rate limit exceeded for '{self.tier_name}'. "
                    f"Maximum {self.max_requests} requests per {int(self.window_sec)}s allowed. "
                    f"Please retry in {retry_after} seconds."
                ),
                details={
                    "tier": self.tier_name,
                    "max_requests": self.max_requests,
                    "window_sec": self.window_sec,
                    "retry_after": retry_after,
                },
            )
