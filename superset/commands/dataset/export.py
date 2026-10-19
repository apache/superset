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
from collections.abc import Iterator
from typing import Callable

import yaml

from superset.commands.export.models import ExportModelsCommand
from superset.constants import EMBEDDED_CREDENTIALS_KEY
from superset.connectors.sqla.models import SqlaTable
from superset.commands.dataset.exceptions import DatasetNotFoundError
from superset.daos.dataset import DatasetDAO
from superset.utils.dict_import_export import EXPORT_VERSION
from superset.utils.file import get_filename
from superset.utils.ssh_tunnel import mask_password_info
from superset.utils import json

logger = logging.getLogger(__name__)

JSON_KEYS = {"params", "template_params", "extra"}


# Secure Extra blocks a dashboard, chart or dataset bundle carries, so a promoted
# dashboard keeps its OAuth2 client and embedded viewer credential. Every engine
# masks their secrets (`BaseEngineSpec.encrypted_extra_sensitive_field_paths`).
_CARRIED_SECURE_EXTRA_KEYS = ("oauth2_client_info", EMBEDDED_CREDENTIALS_KEY)


def _carried_secure_extra(masked_encrypted_extra: str | None) -> str | None:
    """
    Return the masked Secure Extra blocks a bundle carries, or ``None``.

    Only these Superset-owned blocks, never the rest of Secure Extra: the bundle
    is open to anyone who can export a dashboard or dataset, and an engine's own
    settings -- client certificates, service-account keys -- are not all
    registered as sensitive, so masking cannot be relied on to hide them.
    """
    if not masked_encrypted_extra:
        return None
    try:
        secure_extra = json.loads(masked_encrypted_extra)
    except json.JSONDecodeError:
        return None
    if not isinstance(secure_extra, dict):
        return None
    carried = {
        key: secure_extra[key]
        for key in _CARRIED_SECURE_EXTRA_KEYS
        if secure_extra.get(key)
    }
    return json.dumps(carried) if carried else None


class ExportDatasetsCommand(ExportModelsCommand):
    dao = DatasetDAO
    not_found = DatasetNotFoundError

    @staticmethod
    def _file_name(model: SqlaTable) -> str:
        db_file_name = get_filename(
            model.database.database_name, model.database.id, skip_id=True
        )
        ds_file_name = get_filename(model.table_name, model.id)
        return f"datasets/{db_file_name}/{ds_file_name}.yaml"

    @staticmethod
    def _file_content(model: SqlaTable) -> str:
        payload = model.export_to_dict(
            recursive=True,
            include_parent_ref=False,
            include_defaults=True,
            export_uuids=True,
        )
        # TODO (betodealmeida): move this logic to export_to_dict once this
        # becomes the default export endpoint
        for key in JSON_KEYS:
            if payload.get(key):
                try:
                    payload[key] = json.loads(payload[key])
                except json.JSONDecodeError:
                    logger.info("Unable to decode `%s` field: %s", key, payload[key])
        for key in ("metrics", "columns"):
            for attributes in payload.get(key, []):
                if attributes.get("extra"):
                    try:
                        attributes["extra"] = json.loads(attributes["extra"])
                    except json.JSONDecodeError:
                        logger.info(
                            "Unable to decode `extra` field: %s", attributes["extra"]
                        )

        payload["version"] = EXPORT_VERSION
        payload["database_uuid"] = str(model.database.uuid)

        # Always set cache_timeout from the property to ensure correct value
        payload["cache_timeout"] = model.cache_timeout

        # SQLAlchemy returns column names as quoted_name objects which PyYAML cannot
        # serialize. Convert all keys to regular strings to fix YAML serialization.
        payload = {str(key): value for key, value in payload.items()}

        file_content = yaml.safe_dump(payload, sort_keys=False, allow_unicode=True)
        return file_content

    @staticmethod
    def _export(
        model: SqlaTable, export_related: bool = True, seen: set[str] | None = None
    ) -> Iterator[tuple[str, Callable[[], str]]]:
        # Initialize seen set if not provided
        if seen is None:
            seen = set()

        yield (
            ExportDatasetsCommand._file_name(model),
            lambda: ExportDatasetsCommand._file_content(model),
        )

        # include database as well
        if export_related:
            db_file_name = get_filename(
                model.database.database_name, model.database.id, skip_id=True
            )
            file_path = f"databases/{db_file_name}.yaml"

            # Only yield the database file if not already seen. This is
            # critical to fix the issue where databases were being
            # duplicated and potentially overwritten when charts from
            # different databases were exported.
            if file_path not in seen:
                payload = model.database.export_to_dict(
                    recursive=False,
                    include_parent_ref=False,
                    include_defaults=True,
                    export_uuids=True,
                )
                # TODO (betodealmeida): move this logic to export_to_dict once this
                # becomes the default export endpoint
                if payload.get("extra"):
                    try:
                        payload["extra"] = json.loads(payload["extra"])
                    except json.JSONDecodeError:
                        logger.info(
                            "Unable to decode `extra` field: %s", payload["extra"]
                        )

                if ssh_tunnel := model.database.ssh_tunnel:
                    ssh_tunnel_payload = ssh_tunnel.export_to_dict(
                        recursive=False,
                        include_parent_ref=False,
                        include_defaults=True,
                        export_uuids=False,
                    )
                    payload["ssh_tunnel"] = mask_password_info(ssh_tunnel_payload)

                if carried := _carried_secure_extra(
                    model.database.masked_encrypted_extra
                ):
                    payload["masked_encrypted_extra"] = carried

                payload["version"] = EXPORT_VERSION

                yield (
                    file_path,
                    lambda: yaml.safe_dump(
                        payload, sort_keys=False, allow_unicode=True
                    ),
                )
