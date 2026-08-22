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
from copy import deepcopy

from flask import Flask

logger = logging.getLogger(__name__)


class FeatureFlagManager:
    def __init__(self) -> None:
        super().__init__()
        self._get_feature_flags_func = None
        self._is_feature_enabled_func = None
        self._feature_flags: dict[str, bool] = {}

    def init_app(self, app: Flask) -> None:
        self._get_feature_flags_func = app.config["GET_FEATURE_FLAGS_FUNC"]
        self._is_feature_enabled_func = app.config["IS_FEATURE_ENABLED_FUNC"]
        self._feature_flags = app.config["DEFAULT_FEATURE_FLAGS"]
        self._feature_flags.update(app.config["FEATURE_FLAGS"])

        # Async chart-data queries run on the Global Task Framework, so enabling
        # GLOBAL_ASYNC_QUERIES force-enables GLOBAL_TASK_FRAMEWORK. (A deployment
        # using IS_FEATURE_ENABLED_FUNC/GET_FEATURE_FLAGS_FUNC can still override
        # the final decision there.)
        if self._feature_flags.get(
            "GLOBAL_ASYNC_QUERIES"
        ) and not self._feature_flags.get("GLOBAL_TASK_FRAMEWORK"):
            logger.info(
                "GLOBAL_ASYNC_QUERIES is enabled; force-enabling "
                "GLOBAL_TASK_FRAMEWORK (async chart data runs on the Global Task "
                "Framework)."
            )
            self._feature_flags["GLOBAL_TASK_FRAMEWORK"] = True

    def get_feature_flags(self) -> dict[str, bool]:
        if self._get_feature_flags_func:
            return self._get_feature_flags_func(deepcopy(self._feature_flags))
        if callable(self._is_feature_enabled_func):
            return dict(  # noqa: C417
                map(
                    lambda kv: (kv[0], self._is_feature_enabled_func(kv[0], kv[1])),
                    self._feature_flags.items(),
                )
            )
        return self._feature_flags

    def is_feature_enabled(self, feature: str) -> bool:
        """Utility function for checking whether a feature is turned on"""
        if self._is_feature_enabled_func:
            return (
                self._is_feature_enabled_func(feature, self._feature_flags[feature])
                if feature in self._feature_flags
                else False
            )
        feature_flags = self.get_feature_flags()
        if feature_flags and feature in feature_flags:
            return feature_flags[feature]
        return False
