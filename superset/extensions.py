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

import celery
from dateutil.relativedelta import relativedelta
from flask_appbuilder import AppBuilder, SQLA
from flask_migrate import Migrate
from flask_talisman import Talisman
from werkzeug.local import LocalProxy

from superset.utils.cache_manager import CacheManager
from superset.utils.feature_flag_manager import FeatureFlagManager


class JinjaContextManager:
    def __init__(self) -> None:
        self._base_context = {
            "datetime": datetime,
            "random": random,
            "relativedelta": relativedelta,
            "time": time,
            "timedelta": timedelta,
            "uuid": uuid,
        }

    def init_app(self, app):
        self._base_context = self._base_context.update(
            app.config["JINJA_CONTEXT_ADDONS"]
        )

    @property
    def base_context(self):
        return self._base_context


class ResultsBackendManager:
    def __init__(self) -> None:
        self._results_backend = None
        self._use_msgpack = False

    def init_app(self, app):
        self._results_backend = app.config.get("RESULTS_BACKEND")
        self._use_msgpack = app.config.get("RESULTS_BACKEND_USE_MSGPACK")

    @property
    def results_backend(self):
        return self._results_backend

    @property
    def should_use_msgpack(self):
        return self._use_msgpack


class UIManifestProcessor:
    def __init__(self, app_dir: str) -> None:
        self.app = None
        self.manifest: dict = {}
        self.manifest_file = f"{app_dir}/static/assets/dist/manifest.json"

    def init_app(self, app):
        self.app = app
        # Preload the cache
        self.parse_manifest_json()

        @app.context_processor
        def get_manifest():  # pylint: disable=unused-variable
            return dict(
                loaded_chunks=set(),
                get_unloaded_chunks=self.get_unloaded_chunks,
                js_manifest=self.get_js_manifest_files,
                css_manifest=self.get_css_manifest_files,
            )

    def parse_manifest_json(self):
        try:
            with open(self.manifest_file, "r") as f:
                # the manifest includes non-entry files
                # we only need entries in templates
                full_manifest = json.load(f)
                self.manifest = full_manifest.get("entrypoints", {})
        except Exception:  # pylint: disable=broad-except
            pass

    def get_js_manifest_files(self, filename):
        if self.app.debug:
            self.parse_manifest_json()
        entry_files = self.manifest.get(filename, {})
        return entry_files.get("js", [])

    def get_css_manifest_files(self, filename):
        if self.app.debug:
            self.parse_manifest_json()
        entry_files = self.manifest.get(filename, {})
        return entry_files.get("css", [])

    @staticmethod
    def get_unloaded_chunks(files, loaded_chunks):
        filtered_files = [f for f in files if f not in loaded_chunks]
        for f in filtered_files:
            loaded_chunks.add(f)
        return filtered_files


APP_DIR = os.path.dirname(__file__)

appbuilder = AppBuilder(update_perms=False)
cache_manager = CacheManager()
celery_app = celery.Celery()
db = SQLA()
_event_logger: dict = {}
event_logger = LocalProxy(lambda: _event_logger.get("event_logger"))
feature_flag_manager = FeatureFlagManager()
jinja_context_manager = JinjaContextManager()
manifest_processor = UIManifestProcessor(APP_DIR)
migrate = Migrate()
results_backend_manager = ResultsBackendManager()
security_manager = LocalProxy(lambda: appbuilder.sm)
talisman = Talisman()
