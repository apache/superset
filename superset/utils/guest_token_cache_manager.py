import os
import uuid

import redis


class GuestTokenCacheManager:

    def __init__(self):
        _redis_host = os.environ.get("REDIS_HOST", "localhost")
        _redis_port = os.environ.get("REDIS_PORT", 6379)
        _redis_db = os.environ.get("REDIS_DB", 6)

        self._redis: redis.Redis = redis.Redis(
            host=_redis_host, port=_redis_port, db=_redis_db
        )

    def _generate_token(self) -> str:
        random_id = str(uuid.uuid4()).replace("-", "")
        while self._redis.get(random_id):
            random_id = str(uuid.uuid4()).replace("-", "")

        return random_id

    def save_guest_token(self, raw_token: str, exp_sec: int) -> str:
        random_id = self._generate_token()
        self._redis.set(name=random_id, value=raw_token, ex=exp_sec)
        return random_id

    def retrieve_guest_token(self, token_v2: str) -> str:
        return self._redis.get(token_v2).decode('utf-8')
