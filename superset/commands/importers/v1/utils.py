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
from typing import Any, Dict

import yaml
from marshmallow import fields, Schema, validate
from marshmallow.exceptions import ValidationError

from superset.commands.importers.exceptions import IncorrectVersionError

METADATA_FILE_NAME = "metadata.yaml"
IMPORT_VERSION = "1.0.0"

logger = logging.getLogger(__name__)


class MetadataSchema(Schema):
    version = fields.String(required=True, validate=validate.Equal(IMPORT_VERSION))
    type = fields.String(required=True)
    timestamp = fields.DateTime()


def load_yaml(file_name: str, content: str) -> Dict[str, Any]:
    """Try to load a YAML file"""
    try:
        return yaml.safe_load(content)
    except yaml.parser.ParserError:
        logger.exception("Invalid YAML in %s", METADATA_FILE_NAME)
        raise ValidationError({file_name: "Not a valid YAML file"})


def load_metadata(contents: Dict[str, str]) -> Dict[str, str]:
    """Apply validation and load a metadata file"""
    if METADATA_FILE_NAME not in contents:
        # if the contents ahve no METADATA_FILE_NAME this is probably
        # a original export without versioning that should not be
        # handled by this command
        raise IncorrectVersionError(f"Missing {METADATA_FILE_NAME}")

    metadata = load_yaml(METADATA_FILE_NAME, contents[METADATA_FILE_NAME])
    try:
        MetadataSchema().load(metadata)
    except ValidationError as exc:
        # if the version doesn't match raise an exception so that the
        # dispatcher can try a different command version
        if "version" in exc.messages:
            raise IncorrectVersionError(exc.messages["version"][0])

        # otherwise we raise the validation error
        exc.messages = {METADATA_FILE_NAME: exc.messages}
        raise exc

    return metadata
