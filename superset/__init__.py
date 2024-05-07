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

from werkzeug.local import LocalProxy

from superset.extensions import (
    appbuilder,  # noqa: F401
    cache_manager,
    event_logger,  # noqa: F401
    feature_flag_manager,  # noqa: F401
    manifest_processor,
    results_backend_manager,
    security_manager,  # noqa: F401
    talisman,  # noqa: F401
)
from superset.security import SupersetSecurityManager  # noqa: F401

#  All of the fields located here should be considered legacy. The correct way
#  to declare "global" dependencies is to define it in extensions.py,
#  then initialize it in app.create_app(). These fields will be removed
#  in subsequent PRs as things are migrated towards the factory pattern
cache = cache_manager.cache
data_cache = LocalProxy(lambda: cache_manager.data_cache)
get_manifest_files = manifest_processor.get_manifest_files
results_backend = LocalProxy(lambda: results_backend_manager.results_backend)
results_backend_use_msgpack = LocalProxy(
    lambda: results_backend_manager.should_use_msgpack
)
thumbnail_cache = LocalProxy(lambda: cache_manager.thumbnail_cache)

__all__ = [
    "appbuilder",
    "cache",
    "cache_manager",
    "data_cache",
    "event_logger",
    "feature_flag_manager",
    "get_manifest_files",
    "manifest_processor",
    "results_backend",
    "results_backend_manager",
    "results_backend_use_msgpack",
    "thumbnail_cache",
]
