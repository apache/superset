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
import hashlib
import logging
from typing import Any, Callable, Optional, Union

from flask import current_app, Flask
from flask_caching import Cache
from markupsafe import Markup

from superset.utils.core import DatasourceType

logger = logging.getLogger(__name__)

CACHE_IMPORT_PATH = "superset.extensions.metastore_cache.SupersetMetastoreCache"

# Hash function lookup table matching superset.utils.hashing
_HASH_METHODS: dict[str, Callable[..., Any]] = {
    "sha256": hashlib.sha256,
    "md5": hashlib.md5,
}


def get_cache_hash_method() -> Callable[..., Any]:
    """
    Get the hash method based on the HASH_ALGORITHM config.

    Returns the hashlib function corresponding to the configured algorithm.
    """
    algorithm = current_app.config["HASH_ALGORITHM"]
    return _HASH_METHODS[algorithm]


class SupersetCache(Cache):
    """
    Cache subclass that uses the configured HASH_ALGORITHM instead of MD5.

    Flask-caching uses MD5 by default for cache key generation, which fails
    in FIPS mode where MD5 is disabled. This class overrides the default
    hash method to use the algorithm specified by HASH_ALGORITHM config.

    Note: Switching hash algorithms will invalidate existing cache keys,
    causing a one-time cache miss on upgrade.
    """

    def memoize(
        self,
        timeout: int | None = None,
        make_name: Callable[..., Any] | None = None,
        unless: Callable[..., bool] | None = None,
        forced_update: Callable[..., bool] | None = None,
        response_filter: Callable[..., Any] | None = None,
        hash_method: Callable[..., Any] | None = None,
        cache_none: bool = False,
        source_check: bool | None = None,
        args_to_ignore: Any | None = None,
    ) -> Callable[..., Any]:
        if hash_method is None:
            hash_method = get_cache_hash_method()
        return super().memoize(
            timeout=timeout,
            make_name=make_name,
            unless=unless,
            forced_update=forced_update,
            response_filter=response_filter,
            hash_method=hash_method,
            cache_none=cache_none,
            source_check=source_check,
            args_to_ignore=args_to_ignore,
        )

    def cached(
        self,
        timeout: int | None = None,
        key_prefix: str = "view/%s",
        unless: Callable[..., bool] | None = None,
        forced_update: Callable[..., bool] | None = None,
        response_filter: Callable[..., Any] | None = None,
        query_string: bool = False,
        hash_method: Callable[..., Any] | None = None,
        cache_none: bool = False,
        make_cache_key: Callable[..., Any] | None = None,
        source_check: bool | None = None,
        response_hit_indication: bool | None = False,
    ) -> Callable[..., Any]:
        if hash_method is None:
            hash_method = get_cache_hash_method()
        return super().cached(
            timeout=timeout,
            key_prefix=key_prefix,
            unless=unless,
            forced_update=forced_update,
            response_filter=response_filter,
            query_string=query_string,
            hash_method=hash_method,
            cache_none=cache_none,
            make_cache_key=make_cache_key,
            source_check=source_check,
            response_hit_indication=response_hit_indication,
        )

    # pylint: disable=protected-access
    def _memoize_make_cache_key(
        self,
        make_name: Callable[..., Any] | None = None,
        timeout: Callable[..., Any] | None = None,
        forced_update: bool = False,
        hash_method: Callable[..., Any] | None = None,
        source_check: bool | None = False,
        args_to_ignore: Any | None = None,
    ) -> Callable[..., Any]:
        if hash_method is None:
            hash_method = get_cache_hash_method()
        return super()._memoize_make_cache_key(
            make_name=make_name,
            timeout=timeout,
            forced_update=forced_update,
            hash_method=hash_method,
            source_check=source_check,
            args_to_ignore=args_to_ignore,
        )


class ExploreFormDataCache(SupersetCache):
    def get(self, *args: Any, **kwargs: Any) -> Optional[Union[str, Markup]]:
        cache = self.cache.get(*args, **kwargs)

        if not cache:
            return None

        # rename data keys for existing cache based on new TemporaryExploreState model
        if isinstance(cache, dict):
            cache = {
                ("datasource_id" if key == "dataset_id" else key): value
                for (key, value) in cache.items()
            }
            # add default datasource_type if it doesn't exist
            # temporarily defaulting to table until sqlatables are deprecated
            if "datasource_type" not in cache:
                cache["datasource_type"] = DatasourceType.TABLE

        return cache


class CacheManager:
    def __init__(self) -> None:
        super().__init__()

        self._cache = SupersetCache()
        self._data_cache = SupersetCache()
        self._thumbnail_cache = SupersetCache()
        self._filter_state_cache = SupersetCache()
        self._explore_form_data_cache = ExploreFormDataCache()

    @staticmethod
    def _init_cache(
        app: Flask, cache: Cache, cache_config_key: str, required: bool = False
    ) -> None:
        cache_config = app.config[cache_config_key]
        cache_type = cache_config.get("CACHE_TYPE")
        if (required and cache_type is None) or cache_type == "SupersetMetastoreCache":
            if cache_type is None and not app.debug:
                logger.warning(
                    "Falling back to the built-in cache, that stores data in the "
                    "metadata database, for the following cache: `%s`. "
                    "It is recommended to use `RedisCache`, `MemcachedCache` or "
                    "another dedicated caching backend for production deployments",
                    cache_config_key,
                )
            cache_type = CACHE_IMPORT_PATH
            cache_key_prefix = cache_config.get("CACHE_KEY_PREFIX", cache_config_key)
            cache_config.update(
                {"CACHE_TYPE": cache_type, "CACHE_KEY_PREFIX": cache_key_prefix}
            )

        if cache_type is not None and "CACHE_DEFAULT_TIMEOUT" not in cache_config:
            default_timeout = app.config.get("CACHE_DEFAULT_TIMEOUT")
            cache_config["CACHE_DEFAULT_TIMEOUT"] = default_timeout

        cache.init_app(app, cache_config)

    def init_app(self, app: Flask) -> None:
        self._init_cache(app, self._cache, "CACHE_CONFIG")
        self._init_cache(app, self._data_cache, "DATA_CACHE_CONFIG")
        self._init_cache(app, self._thumbnail_cache, "THUMBNAIL_CACHE_CONFIG")
        self._init_cache(
            app, self._filter_state_cache, "FILTER_STATE_CACHE_CONFIG", required=True
        )
        self._init_cache(
            app,
            self._explore_form_data_cache,
            "EXPLORE_FORM_DATA_CACHE_CONFIG",
            required=True,
        )

    @property
    def data_cache(self) -> Cache:
        return self._data_cache

    @property
    def cache(self) -> Cache:
        return self._cache

    @property
    def thumbnail_cache(self) -> Cache:
        return self._thumbnail_cache

    @property
    def filter_state_cache(self) -> Cache:
        return self._filter_state_cache

    @property
    def explore_form_data_cache(self) -> Cache:
        return self._explore_form_data_cache
