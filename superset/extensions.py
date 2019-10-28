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

import os

import celery
from flask import Flask
from flask_appbuilder import AppBuilder, SQLA
from flask_migrate import Migrate
from flask_talisman import Talisman
from werkzeug.local import LocalProxy

from superset.utils.feature_flag_manager import FeatureFlagManager

from superset.utils.cache_manager import CacheManager
from superset.utils.manifest_processor import UIManifestProcessor
from superset.utils.results_backend_manager import ResultsBackendManager

APP_DIR = os.path.dirname(__file__)

appbuilder = AppBuilder(update_perms=False)
cache_manager = CacheManager()
celery_app = celery.Celery()
db = SQLA()
_event_logger = {}
event_logger = LocalProxy(lambda: _event_logger.get("event_logger"))
feature_flag_manager = FeatureFlagManager()
manifest_processor = UIManifestProcessor(APP_DIR)
migrate = Migrate()
results_backend_manager = ResultsBackendManager()
security_manager = LocalProxy(lambda: appbuilder.sm)
talisman = Talisman()
