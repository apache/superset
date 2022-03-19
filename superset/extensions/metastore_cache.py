# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.

from datetime import datetime, timedelta
from hashlib import md5
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid3

from flask import Flask
from flask_caching import BaseCache

from superset.key_value.exceptions import KeyValueCreateFailedError
from superset.key_value.types import KeyType

RESOURCE = "superset_metastore_cache"
KEY_TYPE: KeyType = "uuid"


class SupersetMetastoreCache(BaseCache):
    def __init__(self, namespace: UUID, default_timeout: int = 300) -> None:
        super().__init__(default_timeout)
        self.namespace = namespace

    @classmethod
    def factory(
        cls, app: Flask, config: Dict[str, Any], args: List[Any], kwargs: Dict[str, Any]
    ) -> BaseCache:
        # base namespace for generating deterministic UUIDs
        md5_obj = md5()
        seed = config.get("CACHE_KEY_PREFIX", "")
        md5_obj.update(seed.encode("utf-8"))
        kwargs["namespace"] = UUID(md5_obj.hexdigest())
        return cls(*args, **kwargs)

    def get_key(self, key: str) -> str:
        return str(uuid3(self.namespace, key))

    @staticmethod
    def _prune() -> None:
        # pylint: disable=import-outside-toplevel
        from superset.key_value.commands.delete_expired import (
            DeleteExpiredKeyValueCommand,
        )

        DeleteExpiredKeyValueCommand(resource=RESOURCE).run()

    def _get_expiry(self, timeout: Optional[int]) -> Optional[datetime]:
        timeout = self._normalize_timeout(timeout)
        if timeout is not None and timeout > 0:
            return datetime.now() + timedelta(seconds=timeout)
        return None

    def set(self, key: str, value: Any, timeout: Optional[int] = None) -> bool:
        # pylint: disable=import-outside-toplevel
        from superset.key_value.commands.upsert import UpsertKeyValueCommand

        UpsertKeyValueCommand(
            resource=RESOURCE,
            key_type=KEY_TYPE,
            key=self.get_key(key),
            value=value,
            expires_on=self._get_expiry(timeout),
        ).run()
        return True

    def add(self, key: str, value: Any, timeout: Optional[int] = None) -> bool:
        # pylint: disable=import-outside-toplevel
        from superset.key_value.commands.create import CreateKeyValueCommand

        try:
            CreateKeyValueCommand(
                resource=RESOURCE,
                value=value,
                key_type=KEY_TYPE,
                key=self.get_key(key),
                expires_on=self._get_expiry(timeout),
            ).run()
            self._prune()
            return True
        except KeyValueCreateFailedError:
            return False

    def get(self, key: str) -> Any:
        # pylint: disable=import-outside-toplevel
        from superset.key_value.commands.get import GetKeyValueCommand

        return GetKeyValueCommand(
            resource=RESOURCE, key_type=KEY_TYPE, key=self.get_key(key),
        ).run()

    def has(self, key: str) -> bool:
        entry = self.get(key)
        if entry:
            return True
        return False

    def delete(self, key: str) -> Any:
        # pylint: disable=import-outside-toplevel
        from superset.key_value.commands.delete import DeleteKeyValueCommand

        return DeleteKeyValueCommand(
            resource=RESOURCE, key_type=KEY_TYPE, key=self.get_key(key),
        ).run()
