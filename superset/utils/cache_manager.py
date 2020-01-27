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
from flask import Flask
from flask_caching import Cache

from superset.typing import CacheConfig


class CacheManager:
    def __init__(self) -> None:
        super().__init__()

        self._tables_cache = None
        self._cache = None
        self._thumbnail_cache = None

    def init_app(self, app: Flask) -> None:
        self._cache = self._setup_cache(app, app.config["CACHE_CONFIG"])
        self._tables_cache = self._setup_cache(
            app, app.config["TABLE_NAMES_CACHE_CONFIG"]
        )
        self._thumbnail_cache = self._setup_cache(
            app, app.config["THUMBNAIL_CACHE_CONFIG"]
        )

    @staticmethod
    def _setup_cache(app: Flask, cache_config: CacheConfig) -> Cache:
        """Setup the flask-cache on a flask app"""
        if isinstance(cache_config, dict):
            return Cache(app, config=cache_config)

        # Accepts a custom cache initialization function, returning an object compatible
        # with Flask-Caching API.
        return cache_config(app)

    @property
    def tables_cache(self) -> Cache:
        return self._tables_cache

    @property
    def cache(self) -> Cache:
        return self._cache

    @property
    def thumbnail_cache(self) -> Cache:
        return self._thumbnail_cache
