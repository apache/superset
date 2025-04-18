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
from __future__ import annotations

import json
import logging
from typing import Any

from superset import db
from superset.daos.base import BaseDAO
from superset.extensions.models import Extension

logger = logging.getLogger(__name__)


def json_dumps_compact(value: dict[str, Any]) -> str:
    return json.dumps(value, indent=None, separators=(",", ":"), sort_keys=True)


class ExtensionDAO(BaseDAO[Extension]):
    @staticmethod
    def get_by_name(name: str) -> Extension | None:
        return db.session.query(Extension).filter_by(name=name).one_or_none()

    @staticmethod
    def upsert(
        name: str,
        manifest: dict[str, Any],
        frontend: dict[str, Any],
        backend: dict[str, Any],
        enabled: bool,
    ) -> Extension:
        manifest_str = json_dumps_compact(manifest)
        frontend_str = json_dumps_compact(frontend) if frontend else None
        backend_str = json_dumps_compact(backend) if backend else None
        if extension := ExtensionDAO.get_by_name(name):
            extension.manifest = manifest_str
            extension.frontend = frontend_str
            extension.backend = backend_str
            return extension

        extension = Extension(
            name=name,
            manifest=manifest_str,
            frontend=frontend_str,
            backend=backend_str,
            enabled=enabled,
        )
        return ExtensionDAO.create(extension)
