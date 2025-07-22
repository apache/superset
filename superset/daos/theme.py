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
from typing import Any, Optional

from superset.daos.base import BaseDAO
from superset.extensions import db
from superset.models.core import Theme
from superset.utils import json


class ThemeDAO(BaseDAO[Theme]):
    @classmethod
    def find_by_uuid(cls, uuid: str) -> Optional[Theme]:
        """Find theme by UUID."""
        return db.session.query(Theme).filter(Theme.uuid == uuid).first()

    @classmethod
    def resolve_theme_with_uuid(cls, theme_config: dict[str, Any]) -> dict[str, Any]:
        """Resolve theme configuration that may contain a UUID reference."""
        if "uuid" in theme_config:
            crud_theme = cls.find_by_uuid(theme_config["uuid"])
            if crud_theme and crud_theme.json_data:
                try:
                    resolved_config = json.loads(crud_theme.json_data)
                    return resolved_config
                except (ValueError, TypeError):
                    pass
        return theme_config
