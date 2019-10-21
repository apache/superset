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
"""Package's main module!"""
from flask import current_app as flask_current_app
from werkzeug.local import LocalProxy

from superset.app import create_app
from superset.connectors.connector_registry import ConnectorRegistry
from superset.extensions import (
    appbuilder as ab,
    cache_manager as ext_cache_manager,
    db as ext_db,
    event_logger as ext_event_logger,
    feature_flag_manager as ext_feature_flag_manager,
    manifest_processor as ext_manifest_processor,
    results_backend_manager as ext_results_backend_manager,
    security_manager as ext_security_manager,
    talisman as ext_talisman
)
from superset.security import SupersetSecurityManager
from superset.utils.log import DBEventLogger, get_event_logger_from_cfg_value

app = create_app()
appbuilder = ab
cache = LocalProxy(lambda: ext_cache_manager.cache)
conf = LocalProxy(lambda: flask_current_app.config)
db = ext_db
event_logger = ext_event_logger
get_feature_flags = ext_feature_flag_manager.get_feature_flags
get_css_manifest_files = ext_manifest_processor.get_css_manifest_files
is_feature_enabled = ext_feature_flag_manager.is_feature_enabled
results_backend = LocalProxy(lambda: ext_results_backend_manager.results_backend)
results_backend_use_msgpack = LocalProxy(lambda: ext_results_backend_manager.should_use_msgpack)
security_manager = ext_security_manager
tables_cache = LocalProxy(lambda: ext_cache_manager.tables_cache)
talisman = ext_talisman
