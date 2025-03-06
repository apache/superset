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
import functools
import logging
from typing import Any, Callable
from collections.abc import Iterator

import yaml

from superset.commands.database.exceptions import DatabaseNotFoundError
from superset.daos.database import DatabaseDAO
from superset.commands.export.models import ExportModelsCommand
from superset.models.core import Database
from superset.utils.dict_import_export import EXPORT_VERSION
from superset.utils.file import get_filename
from superset.utils.ssh_tunnel import mask_password_info
from superset.utils import json

logger = logging.getLogger(__name__)


def parse_extra(extra_payload: str) -> dict[str, Any]:
    try:
        extra = json.loads(extra_payload)
    except json.JSONDecodeError:
        logger.info("Unable to decode `extra` field: %s", extra_payload)
        return {}

    # Fix for DBs saved with an invalid ``schemas_allowed_for_csv_upload``
    schemas_allowed_for_csv_upload = extra.get("schemas_allowed_for_csv_upload")
    if isinstance(schemas_allowed_for_csv_upload, str):
        extra["schemas_allowed_for_csv_upload"] = json.loads(
            schemas_allowed_for_csv_upload
        )

    return extra


class ExportDatabasesCommand(ExportModelsCommand):
    dao = DatabaseDAO
    not_found = DatabaseNotFoundError

    @staticmethod
    def _file_name(model: Database) -> str:
        db_file_name = get_filename(model.database_name, model.id, skip_id=True)
        return f"databases/{db_file_name}.yaml"

    @staticmethod
    def _file_content(model: Database) -> str:
        payload = model.export_to_dict(
            recursive=False,
            include_parent_ref=False,
            include_defaults=True,
            export_uuids=True,
        )

        # https://github.com/apache/superset/pull/16756 renamed ``allow_csv_upload``
        # to ``allow_file_upload`, but we can't change the V1 schema
        replacements = {"allow_file_upload": "allow_csv_upload"}
        # this preserves key order, which is important
        payload = {replacements.get(key, key): value for key, value in payload.items()}

        # TODO (betodealmeida): move this logic to export_to_dict once this
        # becomes the default export endpoint
        if payload.get("extra"):
            extra = payload["extra"] = parse_extra(payload["extra"])

            # ``schemas_allowed_for_csv_upload`` was also renamed to
            # ``schemas_allowed_for_file_upload``, we need to change to preserve the
            # V1 schema
            if "schemas_allowed_for_file_upload" in extra:
                extra["schemas_allowed_for_csv_upload"] = extra.pop(
                    "schemas_allowed_for_file_upload"
                )

        if ssh_tunnel := DatabaseDAO.get_ssh_tunnel(model.id):
            ssh_tunnel_payload = ssh_tunnel.export_to_dict(
                recursive=False,
                include_parent_ref=False,
                include_defaults=True,
                export_uuids=False,
            )
            payload["ssh_tunnel"] = mask_password_info(ssh_tunnel_payload)

        payload["version"] = EXPORT_VERSION

        file_content = yaml.safe_dump(payload, sort_keys=False)
        return file_content

    @staticmethod
    def _export(
        model: Database, export_related: bool = True
    ) -> Iterator[tuple[str, Callable[[], str]]]:
        yield (
            ExportDatabasesCommand._file_name(model),
            lambda: ExportDatabasesCommand._file_content(model),
        )

        if export_related:
            db_file_name = get_filename(model.database_name, model.id, skip_id=True)
            for dataset in model.tables:
                ds_file_name = get_filename(
                    dataset.table_name, dataset.id, skip_id=True
                )
                file_path = f"datasets/{db_file_name}/{ds_file_name}.yaml"

                payload = dataset.export_to_dict(
                    recursive=True,
                    include_parent_ref=False,
                    include_defaults=True,
                    export_uuids=True,
                )
                payload["version"] = EXPORT_VERSION
                payload["database_uuid"] = str(model.uuid)

                yield (
                    file_path,
                    functools.partial(  # type: ignore
                        yaml.safe_dump, payload, sort_keys=False
                    ),
                )
