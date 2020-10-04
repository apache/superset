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


class CacheManager:
    def __init__(self) -> None:
        super().__init__()

        self._cache = Cache()
        self._tables_cache = Cache()
        self._thumbnail_cache = Cache()

    def init_app(self, app: Flask) -> None:
        self._cache.init_app(app, app.config["CACHE_CONFIG"])
        self._tables_cache.init_app(app, app.config["TABLE_NAMES_CACHE_CONFIG"])
        self._thumbnail_cache.init_app(app, app.config["THUMBNAIL_CACHE_CONFIG"])

    @property
    def tables_cache(self) -> Cache:
        return self._tables_cache

    @property
    def cache(self) -> Cache:
        return self._cache

    @property
    def thumbnail_cache(self) -> Cache:
        return self._thumbnail_cache
