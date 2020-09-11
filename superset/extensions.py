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
import json
import os
import random
import time
import uuid
from datetime import datetime, timedelta
from typing import Any, Callable, Dict, List, Optional, Type, TYPE_CHECKING

import celery
from cachelib.base import BaseCache
from dateutil.relativedelta import relativedelta
from flask import Flask
from flask_appbuilder import AppBuilder, SQLA
from flask_migrate import Migrate
from flask_talisman import Talisman
from flask_wtf.csrf import CSRFProtect
from werkzeug.local import LocalProxy

from superset.utils.cache_manager import CacheManager
from superset.utils.feature_flag_manager import FeatureFlagManager
from superset.utils.machine_auth import MachineAuthProviderFactory

if TYPE_CHECKING:
    from superset.jinja_context import (  # pylint: disable=unused-import
        BaseTemplateProcessor,
    )


class JinjaContextManager:
    def __init__(self) -> None:
        self._base_context = {
            "datetime": datetime,
            "random": random,
            "relativedelta": relativedelta,
            "time": time,
            "timedelta": timedelta,
            "uuid1": uuid.uuid1,
            "uuid3": uuid.uuid3,
            "uuid4": uuid.uuid4,
            "uuid5": uuid.uuid5,
        }
        self._template_processors: Dict[str, Type["BaseTemplateProcessor"]] = {}

    def init_app(self, app: Flask) -> None:
        self._base_context.update(app.config["JINJA_CONTEXT_ADDONS"])
        self._template_processors.update(app.config["CUSTOM_TEMPLATE_PROCESSORS"])

    @property
    def base_context(self) -> Dict[str, Any]:
        return self._base_context

    @property
    def template_processors(self) -> Dict[str, Type["BaseTemplateProcessor"]]:
        return self._template_processors


class ResultsBackendManager:
    def __init__(self) -> None:
        self._results_backend = None
        self._use_msgpack = False

    def init_app(self, app: Flask) -> None:
        self._results_backend = app.config["RESULTS_BACKEND"]
        self._use_msgpack = app.config["RESULTS_BACKEND_USE_MSGPACK"]

    @property
    def results_backend(self) -> Optional[BaseCache]:
        return self._results_backend

    @property
    def should_use_msgpack(self) -> bool:
        return self._use_msgpack


class UIManifestProcessor:
    def __init__(self, app_dir: str) -> None:
        self.app: Optional[Flask] = None
        self.manifest: Dict[str, Dict[str, List[str]]] = {}
        self.manifest_file = f"{app_dir}/static/assets/manifest.json"

    def init_app(self, app: Flask) -> None:
        self.app = app
        # Preload the cache
        self.parse_manifest_json()

        @app.context_processor
        def get_manifest() -> Dict[  # pylint: disable=unused-variable
            str, Callable[[str], List[str]]
        ]:
            loaded_chunks = set()

            def get_files(bundle: str, asset_type: str = "js") -> List[str]:
                files = self.get_manifest_files(bundle, asset_type)
                filtered_files = [f for f in files if f not in loaded_chunks]
                for f in filtered_files:
                    loaded_chunks.add(f)
                return filtered_files

            return dict(
                js_manifest=lambda bundle: get_files(bundle, "js"),
                css_manifest=lambda bundle: get_files(bundle, "css"),
            )

    def parse_manifest_json(self) -> None:
        try:
            with open(self.manifest_file, "r") as f:
                # the manifest includes non-entry files we only need entries in
                # templates
                full_manifest = json.load(f)
                self.manifest = full_manifest.get("entrypoints", {})
        except Exception:  # pylint: disable=broad-except
            pass

    def get_manifest_files(self, bundle: str, asset_type: str) -> List[str]:
        if self.app and self.app.debug:
            self.parse_manifest_json()
        return self.manifest.get(bundle, {}).get(asset_type, [])


APP_DIR = os.path.dirname(__file__)
appbuilder = AppBuilder(update_perms=False)
cache_manager = CacheManager()
celery_app = celery.Celery()
csrf = CSRFProtect()
db = SQLA()
_event_logger: Dict[str, Any] = {}
event_logger = LocalProxy(lambda: _event_logger.get("event_logger"))
feature_flag_manager = FeatureFlagManager()
jinja_context_manager = JinjaContextManager()
machine_auth_provider_factory = MachineAuthProviderFactory()
manifest_processor = UIManifestProcessor(APP_DIR)
migrate = Migrate()
results_backend_manager = ResultsBackendManager()
security_manager = LocalProxy(lambda: appbuilder.sm)
talisman = Talisman()
