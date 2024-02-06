import os
import uuid

import redis


class GuestTokenCacheManager:

    def __init__(self):
        REDIS_HOST = os.environ.get("REDIS_HOST", "localhost")
        REDIS_PORT = os.environ.get("REDIS_PORT", 6379)
        REDIS_DB = os.environ.get("REDIS_DB", 6)

        self._redis: redis.Redis = redis.Redis(
            host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB
        )
        self._guest_token_timeout: int = os.environ.get(
            "GUEST_TOKEN_V2_TIMEOUT_SEC", 600
        )

    def _generate_token(self) -> str:
        random_id = str(uuid.uuid4()).replace("-", "")
        while self._redis.get(random_id):
            random_id = str(uuid.uuid4()).replace("-", "")

        return random_id

    def save_guest_token(self, raw_token: str) -> str:
        random_id = self._generate_token()
        self._redis.set(name=random_id, value=raw_token, ex=self._guest_token_timeout)

        return random_id

    def retrieve_guest_token(self, token_v2: str) -> str:
        return self._redis.get(token_v2).decode('utf-8')
