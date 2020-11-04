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

from typing import Any, Dict

import yaml
from marshmallow import fields, Schema, validate
from marshmallow.exceptions import ValidationError
from sqlalchemy.orm import Session

from superset import db
from superset.commands.base import BaseCommand
from superset.commands.exceptions import CommandInvalidError
from superset.models.helpers import ImportExportMixin

METADATA_FILE_NAME = "metadata.yaml"
IMPORT_VERSION = "1.0.0"


def load_yaml(file_name: str, content: str) -> Dict[str, Any]:
    try:
        return yaml.safe_load(content)
    except yaml.parser.ParserError:
        raise CommandInvalidError(f'Unable to load file "{file_name}"')


class MetadataSchema(Schema):
    version = fields.String(required=True, validate=validate.Equal(IMPORT_VERSION))
    type = fields.String(required=True)
    timestamp = fields.DateTime()


class ImportModelsCommand(BaseCommand):

    model = ImportExportMixin
    schema = Schema
    prefix = ""

    # pylint: disable=unused-argument
    def __init__(self, contents: Dict[str, Any], *args: Any, **kwargs: Any):
        self.contents = contents
        self._configs: Dict[str, Any] = {}

    @staticmethod
    def import_(
        session: Session, config: Dict[str, Any], overwrite: bool = False,
    ) -> ImportExportMixin:
        raise NotImplementedError("Subclasss MUST implement import_")

    def import_bundle(self, session: Session) -> None:
        # a generic function to import all assets of a given type;
        # subclasses will want to overload this to also import related
        # assets, eg, importing charts during a dashboard import
        for file_name, config in self._configs.items():
            if file_name.startswith(self.prefix):
                self.import_(session, config)

    def run(self) -> None:
        self.validate()

        # rollback to prevent partial imports
        try:
            self.import_bundle(db.session)
            db.session.commit()
        except Exception as exc:
            db.session.rollback()
            raise exc

    @classmethod
    def validate_schema(cls, config: Dict[str, Any]) -> None:
        cls.schema().load(config)

    def validate(self) -> None:
        if METADATA_FILE_NAME not in self.contents:
            raise CommandInvalidError(
                f'Missing file "{METADATA_FILE_NAME}" in contents'
            )
        content = self.contents[METADATA_FILE_NAME]
        metadata = load_yaml(METADATA_FILE_NAME, content)
        MetadataSchema().load(metadata)

        # validate that the type in METADATA_FILE_NAME matches the
        # type of the model being imported; this prevents exporting
        # a chart and importing as a database, eg, to prevent
        # confusion or error
        type_validator = validate.Equal(self.model.__name__)
        try:
            type_validator(metadata["type"])
        except ValidationError as exc:
            exc.messages = {"type": exc.messages}
            raise exc

        for file_name, content in self.contents.items():
            # load all configs, and validate those a associated with
            # this class
            config = load_yaml(file_name, content)
            if file_name.startswith(self.prefix):
                self.validate_schema(config)
            self._configs[file_name] = config
