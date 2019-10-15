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
from flask import current_app
from werkzeug.local import LocalProxy

from superset.app import create_app
from superset.connectors.connector_registry import ConnectorRegistry
from superset.extensions import appbuilder
from superset.security import SupersetSecurityManager
from superset.utils.log import DBEventLogger, get_event_logger_from_cfg_value

appbuilder = extensions.appbuilder
cache = LocalProxy(lambda: extensions.cache_manager.cache)
conf = LocalProxy(lambda: current_app.config)
db = extensions.db
event_logger = extensions.event_logger
get_feature_flags = extensions.feature_flag_manager.get_feature_flags
is_feature_enabled = extensions.feature_flag_manager.is_feature_enabled
results_backend = LocalProxy(lambda: extensions.results_backend_manager.results_backend)
results_backend_use_msgpack = LocalProxy(lambda: extensions.results_backend_manager.should_use_msgpack)
security_manager = extensions.security_manager
tables_cache = LocalProxy(lambda: extensions.cache_manager.tables_cache)
talisman = extensions.talisman


__app_inited = False


def __fetch_or_init_app():
    global __app_inited
    if not __app_inited:
        create_app()
        __app_inited = True

    return current_app


app = LocalProxy(__fetch_or_init_app)

created_app = create_app()
