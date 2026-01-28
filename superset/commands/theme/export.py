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
import logging
from collections.abc import Iterator
from typing import Callable

import yaml

from superset.commands.export.models import ExportModelsCommand
from superset.commands.theme.exceptions import ThemeNotFoundError
from superset.daos.theme import ThemeDAO
from superset.models.core import Theme
from superset.utils import json
from superset.utils.dict_import_export import EXPORT_VERSION
from superset.utils.file import get_filename

logger = logging.getLogger(__name__)


class ExportThemesCommand(ExportModelsCommand):
    dao = ThemeDAO
    not_found = ThemeNotFoundError

    @staticmethod
    def _file_name(model: Theme) -> str:
        file_name = get_filename(model.theme_name, model.id, skip_id=True)
        return f"themes/{file_name}.yaml"

    @staticmethod
    def _file_content(model: Theme) -> str:
        payload = model.export_to_dict(
            recursive=False,
            include_parent_ref=False,
            include_defaults=True,
            export_uuids=True,
        )

        # Parse and format JSON data for better readability
        if payload.get("json_data"):
            try:
                json_data = json.loads(payload["json_data"])
                payload["json_data"] = json_data
            except (TypeError, json.JSONDecodeError):
                logger.info(
                    "Unable to decode `json_data` field: %s", payload["json_data"]
                )
                # Keep as string if parsing fails

        payload["version"] = EXPORT_VERSION

        file_content = yaml.safe_dump(payload, sort_keys=False)
        return file_content

    @staticmethod
    def _export(
        model: Theme, export_related: bool = True
    ) -> Iterator[tuple[str, Callable[[], str]]]:
        yield (
            ExportThemesCommand._file_name(model),
            lambda: ExportThemesCommand._file_content(model),
        )
