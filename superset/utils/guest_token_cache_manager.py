import os
import uuid
from typing import Optional

import redis


class GuestTokenCacheManager:

    def __init__(self):
        _redis_host = os.environ.get("REDIS_HOST", "localhost")
        _redis_port = os.environ.get("REDIS_PORT", 6379)
        _redis_db = os.environ.get("REDIS_DB", 6)
        self._token_prefix = "superset::guest_token::"

        self._redis: redis.Redis = redis.Redis(
            host=_redis_host, port=_redis_port, db=_redis_db
        )

    def _generate_token(self) -> str:
        random_id = str(uuid.uuid4()).replace("-", "")
        while self._redis.get(f"{self._token_prefix}{random_id}"):
            random_id = str(uuid.uuid4()).replace("-", "")

        return random_id

    def save_guest_token(self, raw_token: str, exp_sec: int) -> str:
        random_id = self._generate_token()
        self._redis.setex(name=f"{self._token_prefix}{random_id}", value=raw_token, time=exp_sec)
        return random_id

    def retrieve_guest_token(self, token_v2: str) -> Optional[str]:
        token_with_prefix = f"{self._token_prefix}{token_v2}"
        token = self._redis.get(token_with_prefix)
        if token:
            return token.decode('utf-8')
        return None
