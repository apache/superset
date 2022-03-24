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
import logging
import math

from flask import Flask
from flask_babel import gettext as _
from flask_caching import Cache

logger = logging.getLogger(__name__)


class CacheManager:
    def __init__(self) -> None:
        super().__init__()

        self._cache = Cache()
        self._data_cache = Cache()
        self._thumbnail_cache = Cache()
        self._filter_state_cache = Cache()
        self._explore_form_data_cache = Cache()

    @staticmethod
    def _init_cache(
        app: Flask, cache: Cache, cache_config_key: str, required: bool = False
    ) -> None:
        cache_config = app.config[cache_config_key]
        cache_type = cache_config.get("CACHE_TYPE")
        if app.debug and cache_type is None:
            cache_threshold = cache_config.get("CACHE_THRESHOLD", math.inf)
            cache_config.update(
                {"CACHE_TYPE": "SimpleCache", "CACHE_THRESHOLD": cache_threshold,}
            )

        if "CACHE_DEFAULT_TIMEOUT" not in cache_config:
            default_timeout = app.config.get("CACHE_DEFAULT_TIMEOUT")
            cache_config["CACHE_DEFAULT_TIMEOUT"] = default_timeout

        if required and cache_type in ("null", "NullCache"):
            raise Exception(
                _(
                    "The CACHE_TYPE `%(cache_type)s` for `%(cache_config_key)s` is not "
                    "supported. It is recommended to use `RedisCache`, "
                    "`MemcachedCache` or another dedicated caching backend for "
                    "production deployments",
                    cache_type=cache_config["CACHE_TYPE"],
                    cache_config_key=cache_config_key,
                ),
            )
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
