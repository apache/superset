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
from typing import Any, Callable, Optional

import celery
from flask import Flask
from flask_appbuilder import AppBuilder, SQLA
from flask_caching.backends.base import BaseCache
from flask_migrate import Migrate
from flask_talisman import Talisman
from flask_wtf.csrf import CSRFProtect
from werkzeug.local import LocalProxy

from superset.async_events.async_query_manager import AsyncQueryManager
from superset.async_events.async_query_manager_factory import AsyncQueryManagerFactory
from superset.extensions.ssh import SSHManagerFactory
from superset.extensions.stats_logger import BaseStatsLoggerManager
from superset.utils.cache_manager import CacheManager
from superset.utils.encrypt import EncryptedFieldFactory
from superset.utils.feature_flag_manager import FeatureFlagManager
from superset.utils.machine_auth import MachineAuthProviderFactory
from superset.utils.profiler import SupersetProfiler


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
        self.manifest: dict[str, dict[str, list[str]]] = {}
        self.manifest_file = f"{app_dir}/static/assets/manifest.json"

    def init_app(self, app: Flask) -> None:
        self.app = app
        # Preload the cache
        self.parse_manifest_json()
        self.register_processor(app)

    def register_processor(self, app: Flask) -> None:
        app.template_context_processors[None].append(self.get_manifest)

    def get_manifest(self) -> dict[str, Callable[[str], list[str]]]:
        loaded_chunks = set()

        def get_files(bundle: str, asset_type: str = "js") -> list[str]:
            files = self.get_manifest_files(bundle, asset_type)
            filtered_files = [f for f in files if f not in loaded_chunks]
            for f in filtered_files:
                loaded_chunks.add(f)
            return filtered_files

        return {
            "js_manifest": lambda bundle: get_files(bundle, "js"),
            "css_manifest": lambda bundle: get_files(bundle, "css"),
            "assets_prefix": self.app.config["STATIC_ASSETS_PREFIX"]
            if self.app
            else "",
        }

    def parse_manifest_json(self) -> None:
        try:
            with open(self.manifest_file) as f:
                # the manifest includes non-entry files we only need entries in
                # templates
                full_manifest = json.load(f)
                self.manifest = full_manifest.get("entrypoints", {})
        except Exception:  # pylint: disable=broad-except
            pass

    def get_manifest_files(self, bundle: str, asset_type: str) -> list[str]:
        if self.app and self.app.debug:
            self.parse_manifest_json()
        return self.manifest.get(bundle, {}).get(asset_type, [])


class ProfilingExtension:  # pylint: disable=too-few-public-methods
    def __init__(self, interval: float = 1e-4) -> None:
        self.interval = interval

    def init_app(self, app: Flask) -> None:
        app.wsgi_app = SupersetProfiler(app.wsgi_app, self.interval)


APP_DIR = os.path.join(os.path.dirname(__file__), os.path.pardir)
appbuilder = AppBuilder(update_perms=False)
async_query_manager_factory = AsyncQueryManagerFactory()
async_query_manager: AsyncQueryManager = LocalProxy(
    async_query_manager_factory.instance
)
cache_manager = CacheManager()
celery_app = celery.Celery()
csrf = CSRFProtect()
db = SQLA()  # pylint: disable=disallowed-name
_event_logger: dict[str, Any] = {}
encrypted_field_factory = EncryptedFieldFactory()
event_logger = LocalProxy(lambda: _event_logger.get("event_logger"))
feature_flag_manager = FeatureFlagManager()
machine_auth_provider_factory = MachineAuthProviderFactory()
manifest_processor = UIManifestProcessor(APP_DIR)
migrate = Migrate()
profiling = ProfilingExtension()
results_backend_manager = ResultsBackendManager()
security_manager = LocalProxy(lambda: appbuilder.sm)
ssh_manager_factory = SSHManagerFactory()
stats_logger_manager = BaseStatsLoggerManager()
talisman = Talisman()
