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
from typing import Any, Dict, List, Optional, Set

from marshmallow import Schema, validate
from marshmallow.exceptions import ValidationError
from sqlalchemy.orm import Session

from superset import db
from superset.commands.base import BaseCommand
from superset.commands.exceptions import CommandException, CommandInvalidError
from superset.commands.importers.v1.utils import (
    load_configs,
    load_metadata,
    load_yaml,
    METADATA_FILE_NAME,
    validate_metadata_type,
)
from superset.dao.base import BaseDAO
from superset.models.core import Database


class ImportModelsCommand(BaseCommand):
    """Import models"""

    dao = BaseDAO
    model_name = "model"
    prefix = ""
    schemas: Dict[str, Schema] = {}
    import_error = CommandException
    daos: Dict[str, BaseDAO] = {}

    # pylint: disable=unused-argument
    def __init__(self, contents: Dict[str, str], *args: Any, **kwargs: Any):
        self.contents = contents
        self.passwords: Dict[str, str] = kwargs.get("passwords") or {}
        self.config_overwrite: Dict[str, bool] = kwargs.get("config_overwrite") or {}
        self.overwrite: bool = kwargs.get("overwrite", False)
        self._configs: Dict[str, Any] = {}

    @staticmethod
    def _import(
        session: Session, configs: Dict[str, Any], overwrite: bool = False
    ) -> None:
        raise NotImplementedError("Subclasses MUST implement _import")

    @classmethod
    def _get_uuids(cls) -> Set[str]:
        return {str(model.uuid) for model in db.session.query(cls.dao.model_cls).all()}

    @classmethod
    def _get_schema_uuids(cls) -> Dict[str, Set[str]]:
        return {
            model_prefix: {
                str(result.uuid)
                for result in db.session.query(dao.model_cls.uuid).all()  # type: ignore
            }
            for model_prefix, dao in cls.daos.items()
        }

    def run(self) -> None:
        self.validate()

        # rollback to prevent partial imports
        try:
            self._import(db.session, self._configs, self.overwrite)
            db.session.commit()
        except Exception as ex:
            db.session.rollback()
            raise self.import_error() from ex

    def validate(self) -> None:
        exceptions: List[ValidationError] = []

        # verify that the metadata file is present and valid
        try:
            metadata: Optional[Dict[str, str]] = load_metadata(self.contents)
        except ValidationError as exc:
            exceptions.append(exc)
            metadata = None
        if self.dao.model_cls:
            validate_metadata_type(metadata, self.dao.model_cls.__name__, exceptions)

        # load the configs and make sure we have confirmation to overwrite existing models
        self._configs = load_configs(
            self.contents, self.schemas, self.passwords, exceptions
        )
        self._prevent_overwrite_existing_model(exceptions)

        if exceptions:
            exception = CommandInvalidError(f"Error importing {self.model_name}")
            exception.add_list(exceptions)
            raise exception

    def _prevent_overwrite_existing_model(  # pylint: disable=invalid-name
        self, exceptions: List[ValidationError]
    ) -> None:
        """check if the object exists and shouldn't be overwritten"""
        if self.daos and not self.config_overwrite:
            self._missing_config_overwrite_errors(exceptions)
        elif not self.overwrite and not self.daos:
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

    def _get_default_overwrite_models_status(self) -> Dict[str, bool]:
        return {model: False for model in self.daos}

    def _missing_config_overwrite_errors(
        self, exceptions: List[ValidationError]
    ) -> None:
        schema_existing_uuids = self._get_schema_uuids()
        schema_overwrite_status: Dict[
            str, bool
        ] = self._get_default_overwrite_models_status()
        all_schemas = tuple(scheme for scheme in self.schemas)

        for file_name, config in self._configs.items():
            file_schema = file_name.split("/")[0]
            if (
                file_name.startswith(all_schemas)
                and not schema_overwrite_status.get(file_schema, False)
                and config["uuid"] in schema_existing_uuids[file_schema]
            ):
                schema_overwrite_status[file_schema] = True

            if all(status for status in schema_overwrite_status.values()):
                break

        overwrite_schemas: Set[str] = {
            schema
            for schema, status in schema_overwrite_status.items()
            if status and schema == self.prefix.split("/")[0]
        }
        # TODO, delete above condition \
        #  `and schema == self.prefix.split('/')[0]`.
        """for now, in order to keep backup capabilities.
        We will throw error only when overwriting the primary model.
        Exactly as it's worked before.
        In the next PR I will delete this line, and will update the frontend as
        well"""

        for schema in overwrite_schemas:
            exceptions.append(
                ValidationError(
                    {
                        schema: (
                            f"some {schema} already exists "
                            "and `config_overwrite` object was not passed"
                        ),
                    }
                )
            )
