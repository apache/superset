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

from marshmallow import Schema, validate  # noqa: F401
from marshmallow.exceptions import ValidationError
from sqlalchemy.orm import Session  # noqa: F401

from superset import db
from superset.commands.base import BaseCommand
from superset.commands.exceptions import CommandException, CommandInvalidError
from superset.commands.importers.v1.utils import (
    load_configs,
    load_metadata,
    load_yaml,  # noqa: F401
    METADATA_FILE_NAME,  # noqa: F401
    validate_metadata_type,
)
from superset.daos.base import BaseDAO
from superset.models.core import Database  # noqa: F401
from superset.utils.decorators import transaction


class ImportModelsCommand(BaseCommand):
    """Import models"""

    dao = BaseDAO
    model_name = "model"
    prefix = ""
    schemas: dict[str, Schema] = {}
    import_error = CommandException

    # pylint: disable=unused-argument
    def __init__(self, contents: dict[str, str], *args: Any, **kwargs: Any):
        self.contents = contents
        self.passwords: dict[str, str] = kwargs.get("passwords") or {}
        self.ssh_tunnel_passwords: dict[str, str] = (
            kwargs.get("ssh_tunnel_passwords") or {}
        )
        self.ssh_tunnel_private_keys: dict[str, str] = (
            kwargs.get("ssh_tunnel_private_keys") or {}
        )
        self.ssh_tunnel_priv_key_passwords: dict[str, str] = (
            kwargs.get("ssh_tunnel_priv_key_passwords") or {}
        )
        self.overwrite: bool = kwargs.get("overwrite", False)
        self._configs: dict[str, Any] = {}

    @staticmethod
    def _import(configs: dict[str, Any], overwrite: bool = False) -> None:
        raise NotImplementedError("Subclasses MUST implement _import")

    @classmethod
    def _get_uuids(cls) -> set[str]:
        return {str(model.uuid) for model in db.session.query(cls.dao.model_cls).all()}

    @transaction()
    def run(self) -> None:
        self.validate()

        try:
            self._import(self._configs, self.overwrite)
        except CommandException:
            raise
        except Exception as ex:
            raise self.import_error() from ex

    def validate(self) -> None:  # noqa: F811
        exceptions: list[ValidationError] = []

        # verify that the metadata file is present and valid
        try:
            metadata: Optional[dict[str, str]] = load_metadata(self.contents)
        except ValidationError as exc:
            exceptions.append(exc)
            metadata = None
        if self.dao.model_cls:
            validate_metadata_type(metadata, self.dao.model_cls.__name__, exceptions)

        # load the configs and make sure we have confirmation to overwrite existing models
        self._configs = load_configs(
            self.contents,
            self.schemas,
            self.passwords,
            exceptions,
            self.ssh_tunnel_passwords,
            self.ssh_tunnel_private_keys,
            self.ssh_tunnel_priv_key_passwords,
        )
        self._prevent_overwrite_existing_model(exceptions)

        if exceptions:
            raise CommandInvalidError(
                f"Error importing {self.model_name}",
                exceptions,
            )

    def _prevent_overwrite_existing_model(  # pylint: disable=invalid-name
        self, exceptions: list[ValidationError]
    ) -> None:
        """check if the object exists and shouldn't be overwritten"""
        if not self.overwrite:
            existing_uuids = self._get_uuids()
            for file_name, config in self._configs.items():
                if (
                    file_name.startswith(self.prefix)
                    and config["uuid"] in existing_uuids
                ):
                    exceptions.append(
                        ValidationError(
                            {
                                file_name: (
                                    f"{self.model_name.title()} already exists "
                                    "and `overwrite=true` was not passed"
                                ),
                            }
                        )
                    )
