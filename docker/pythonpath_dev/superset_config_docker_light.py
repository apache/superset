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
#
# Configuration for docker-compose-light.yml - disables Redis and uses minimal services

# Import all settings from the main config first
from flask_caching.backends.filesystemcache import FileSystemCache

from superset_config import *  # noqa: F403

# Override caching to use simple in-memory cache instead of Redis
RESULTS_BACKEND = FileSystemCache("/app/superset_home/sqllab")

CACHE_CONFIG = {
    "CACHE_TYPE": "SimpleCache",
    "CACHE_DEFAULT_TIMEOUT": 300,
    "CACHE_KEY_PREFIX": "superset_light_",
}
DATA_CACHE_CONFIG = CACHE_CONFIG
THUMBNAIL_CACHE_CONFIG = CACHE_CONFIG


# Disable Celery entirely for lightweight mode
CELERY_CONFIG = None  # type: ignore[assignment,misc]

# Honor SUPERSET_FEATURE_<NAME> env vars on top of any flags inherited from
# superset_config. Lets local dev/e2e enable features (e.g. EMBEDDED_SUPERSET)
# without editing shipped config files.
import os  # noqa: E402

FEATURE_FLAGS = {
    **FEATURE_FLAGS,  # noqa: F405
    **{
        name[len("SUPERSET_FEATURE_") :]: value.strip().lower() == "true"
        for name, value in os.environ.items()
        if name.startswith("SUPERSET_FEATURE_")
    },
}

# Disable Talisman so /embedded/<uuid> doesn't return X-Frame-Options:SAMEORIGIN.
# Without this, browsers refuse to render Superset inside an iframe from a
# different origin (i.e. the embedded SDK use case). Production/CI configures
# Talisman with explicit `frame-ancestors`; for the lightweight local stack we
# just turn it off.
TALISMAN_ENABLED = False

# Guest tokens (used by the embedded SDK) inherit the "Public" role's perms.
# Out of the box Public has zero perms, so embedded dashboards immediately fail
# their first call (`/api/v1/me/roles/`) with 403. Mirror Public to Gamma —
# the standard read-only viewer role — so the embedded flow can authenticate
# and load dashboard data in local dev.
PUBLIC_ROLE_LIKE = "Gamma"
