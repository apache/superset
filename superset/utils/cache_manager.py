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
        self._data_cache = Cache()
        self._thumbnail_cache = Cache()
        self._filter_state_cache = Cache()
        self._explore_form_data_cache = Cache()

    def init_app(self, app: Flask) -> None:
        self._cache.init_app(
            app,
            {
                "CACHE_DEFAULT_TIMEOUT": app.config["CACHE_DEFAULT_TIMEOUT"],
                **app.config["CACHE_CONFIG"],
            },
        )
        self._data_cache.init_app(
            app,
            {
                "CACHE_DEFAULT_TIMEOUT": app.config["CACHE_DEFAULT_TIMEOUT"],
                **app.config["DATA_CACHE_CONFIG"],
            },
        )
        self._thumbnail_cache.init_app(
            app,
            {
                "CACHE_DEFAULT_TIMEOUT": app.config["CACHE_DEFAULT_TIMEOUT"],
                **app.config["THUMBNAIL_CACHE_CONFIG"],
            },
        )
        self._filter_state_cache.init_app(
            app,
            {
                "CACHE_DEFAULT_TIMEOUT": app.config["CACHE_DEFAULT_TIMEOUT"],
                **app.config["FILTER_STATE_CACHE_CONFIG"],
            },
        )
        self._explore_form_data_cache.init_app(
            app,
            {
                "CACHE_DEFAULT_TIMEOUT": app.config["CACHE_DEFAULT_TIMEOUT"],
                **app.config["EXPLORE_FORM_DATA_CACHE_CONFIG"],
            },
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
