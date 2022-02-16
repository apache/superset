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
# isort:skip_file

import logging
from typing import Iterator, Tuple

import yaml
from werkzeug.utils import secure_filename

from superset.commands.export import ExportModelsCommand
from superset.dashboards.commands.exceptions import DashboardNotFoundError
from superset.models.superset_core.role import SupersetRole
from superset.role.dao import RoleDAO
from superset.utils.dict_import_export import EXPORT_VERSION

logger = logging.getLogger(__name__)


class ExportRolesCommand(ExportModelsCommand):
    dao = RoleDAO
    not_found = DashboardNotFoundError

    @staticmethod
    def _export(model: SupersetRole) -> Iterator[Tuple[str, str]]:
        role_name = secure_filename(model.name)
        file_name = f"roles/{role_name}.yaml"

        payload = model.export_to_dict(
            recursive=False,
            include_parent_ref=False,
            include_defaults=True,
            export_uuids=False,
        )

        payload["version"] = EXPORT_VERSION

        file_content = yaml.safe_dump(payload, sort_keys=False)
        yield file_name, file_content
