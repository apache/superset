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
from typing import Any, Dict

import celery
from flask_appbuilder import AppBuilder, SQLA
from flask_migrate import Migrate
from flask_talisman import Talisman
from flask_wtf.csrf import CSRFProtect
from werkzeug.local import LocalProxy

from superset.extension.profiling import ProfilingExtension
from superset.extension.results_backend_manager import ResultsBackendManager
from superset.extension.ssh import SSHManagerFactory
from superset.extension.stats_logger import BaseStatsLoggerManager
from superset.extension.ui_manifest_processor import UIManifestProcessor
from superset.utils.async_query_manager import AsyncQueryManager
from superset.utils.cache_manager import CacheManager
from superset.utils.encrypt import EncryptedFieldFactory
from superset.utils.feature_flag_manager import FeatureFlagManager
from superset.utils.machine_auth import MachineAuthProviderFactory

APP_DIR = os.path.join(os.path.dirname(__file__), os.path.pardir)
appbuilder = AppBuilder(update_perms=False)
async_query_manager = AsyncQueryManager()
cache_manager = CacheManager()
celery_app = celery.Celery()
csrf = CSRFProtect()
db = SQLA()
_event_logger: Dict[str, Any] = {}
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
