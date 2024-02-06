import os
import uuid

import redis


class GuestTokenCacheManager:

    def __init__(self):
        REDIS_HOST = os.environ.get("REDIS_HOST", "localhost")
        REDIS_PORT = os.environ.get("REDIS_PORT", 6379)
        REDIS_DB = os.environ.get("REDIS_DB", 6)

        self._redis: redis.Redis = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB)

    def save_guest_token(self, raw_token: str) -> str:
        random_id = uuid.uuid4().__str__()
        self._redis.set(name=random_id, value=raw_token)

        return random_id

    def retrieve_guest_token(self, token_v2: str) -> str:
        return self._redis.get(token_v2)
