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
    load_metadata,
    load_yaml,
    METADATA_FILE_NAME,
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

    # pylint: disable=unused-argument
    def __init__(self, contents: Dict[str, str], *args: Any, **kwargs: Any):
        self.contents = contents
        self.passwords: Dict[str, str] = kwargs.get("passwords") or {}
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

        # load existing databases so we can apply the password validation
        db_passwords = {
            str(uuid): password
            for uuid, password in db.session.query(
                Database.uuid, Database.password
            ).all()
        }

        # verify that the metadata file is present and valid
        try:
            metadata: Optional[Dict[str, str]] = load_metadata(self.contents)
        except ValidationError as exc:
            exceptions.append(exc)
            metadata = None

        # validate that the type declared in METADATA_FILE_NAME is correct
        if metadata and "type" in metadata:
            type_validator = validate.Equal(self.dao.model_cls.__name__)  # type: ignore
            try:
                type_validator(metadata["type"])
            except ValidationError as exc:
                exc.messages = {METADATA_FILE_NAME: {"type": exc.messages}}
                exceptions.append(exc)

        # validate objects
        for file_name, content in self.contents.items():
            # skip directories
            if not content:
                continue

            prefix = file_name.split("/")[0]
            schema = self.schemas.get(f"{prefix}/")
            if schema:
                try:
                    config = load_yaml(file_name, content)

                    # populate passwords from the request or from existing DBs
                    if file_name in self.passwords:
                        config["password"] = self.passwords[file_name]
                    elif prefix == "databases" and config["uuid"] in db_passwords:
                        config["password"] = db_passwords[config["uuid"]]

                    schema.load(config)
                    self._configs[file_name] = config
                except ValidationError as exc:
                    exc.messages = {file_name: exc.messages}
                    exceptions.append(exc)

        # check if the object exists and shouldn't be overwritten
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

        if exceptions:
            exception = CommandInvalidError(f"Error importing {self.model_name}")
            exception.add_list(exceptions)
            raise exception
