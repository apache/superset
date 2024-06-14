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
from pathlib import Path, PurePosixPath
from typing import Any, Optional
from zipfile import ZipFile

import yaml
from marshmallow import fields, Schema, validate
from marshmallow.exceptions import ValidationError

from superset import db
from superset.commands.importers.exceptions import IncorrectVersionError
from superset.databases.ssh_tunnel.models import SSHTunnel
from superset.models.core import Database
from superset.utils.core import check_is_safe_zip

METADATA_FILE_NAME = "metadata.yaml"
IMPORT_VERSION = "1.0.0"

logger = logging.getLogger(__name__)


def remove_root(file_path: str) -> str:
    """Remove the first directory of a path"""
    full_path = PurePosixPath(file_path)
    relative_path = PurePosixPath(*full_path.parts[1:])
    return str(relative_path)


class MetadataSchema(Schema):
    version = fields.String(required=True, validate=validate.Equal(IMPORT_VERSION))
    type = fields.String(required=False)
    timestamp = fields.DateTime()


def load_yaml(file_name: str, content: str) -> dict[str, Any]:
    """Try to load a YAML file"""
    try:
        return yaml.safe_load(content)
    except yaml.parser.ParserError as ex:
        logger.exception("Invalid YAML in %s", file_name)
        raise ValidationError({file_name: "Not a valid YAML file"}) from ex


def load_metadata(contents: dict[str, str]) -> dict[str, str]:
    """Apply validation and load a metadata file"""
    if METADATA_FILE_NAME not in contents:
        # if the contents have no METADATA_FILE_NAME this is probably
        # a original export without versioning that should not be
        # handled by this command
        raise IncorrectVersionError(f"Missing {METADATA_FILE_NAME}")

    metadata = load_yaml(METADATA_FILE_NAME, contents[METADATA_FILE_NAME])
    try:
        MetadataSchema().load(metadata)
    except ValidationError as ex:
        # if the version doesn't match raise an exception so that the
        # dispatcher can try a different command version
        if "version" in ex.messages:
            raise IncorrectVersionError(ex.messages["version"][0]) from ex

        # otherwise we raise the validation error
        ex.messages = {METADATA_FILE_NAME: ex.messages}
        raise

    return metadata


def validate_metadata_type(
    metadata: Optional[dict[str, str]],
    type_: str,
    exceptions: list[ValidationError],
) -> None:
    """Validate that the type declared in METADATA_FILE_NAME is correct"""
    if metadata and "type" in metadata:
        type_validator = validate.Equal(type_)
        try:
            type_validator(metadata["type"])
        except ValidationError as exc:
            exc.messages = {METADATA_FILE_NAME: {"type": exc.messages}}
            exceptions.append(exc)


# pylint: disable=too-many-locals,too-many-arguments
def load_configs(
    contents: dict[str, str],
    schemas: dict[str, Schema],
    passwords: dict[str, str],
    exceptions: list[ValidationError],
    ssh_tunnel_passwords: dict[str, str],
    ssh_tunnel_private_keys: dict[str, str],
    ssh_tunnel_priv_key_passwords: dict[str, str],
) -> dict[str, Any]:
    configs: dict[str, Any] = {}

    # load existing databases so we can apply the password validation
    db_passwords: dict[str, str] = {
        str(uuid): password
        for uuid, password in db.session.query(Database.uuid, Database.password).all()
    }
    # load existing ssh_tunnels so we can apply the password validation
    db_ssh_tunnel_passwords: dict[str, str] = {
        str(uuid): password
        for uuid, password in db.session.query(SSHTunnel.uuid, SSHTunnel.password).all()
    }
    # load existing ssh_tunnels so we can apply the private_key validation
    db_ssh_tunnel_private_keys: dict[str, str] = {
        str(uuid): private_key
        for uuid, private_key in db.session.query(
            SSHTunnel.uuid, SSHTunnel.private_key
        ).all()
    }
    # load existing ssh_tunnels so we can apply the private_key_password validation
    db_ssh_tunnel_priv_key_passws: dict[str, str] = {
        str(uuid): private_key_password
        for uuid, private_key_password in db.session.query(
            SSHTunnel.uuid, SSHTunnel.private_key_password
        ).all()
    }
    for file_name, content in contents.items():
        # skip directories
        if not content:
            continue

        prefix = file_name.split("/")[0]
        schema = schemas.get(f"{prefix}/")
        if schema:
            try:
                config = load_yaml(file_name, content)

                # populate passwords from the request or from existing DBs
                if file_name in passwords:
                    config["password"] = passwords[file_name]
                elif prefix == "databases" and config["uuid"] in db_passwords:
                    config["password"] = db_passwords[config["uuid"]]

                # populate ssh_tunnel_passwords from the request or from existing DBs
                if file_name in ssh_tunnel_passwords:
                    config["ssh_tunnel"]["password"] = ssh_tunnel_passwords[file_name]
                elif (
                    prefix == "databases" and config["uuid"] in db_ssh_tunnel_passwords
                ):
                    config["ssh_tunnel"]["password"] = db_ssh_tunnel_passwords[
                        config["uuid"]
                    ]

                # populate ssh_tunnel_private_keys from the request or from existing DBs
                if file_name in ssh_tunnel_private_keys:
                    config["ssh_tunnel"]["private_key"] = ssh_tunnel_private_keys[
                        file_name
                    ]
                elif (
                    prefix == "databases"
                    and config["uuid"] in db_ssh_tunnel_private_keys
                ):
                    config["ssh_tunnel"]["private_key"] = db_ssh_tunnel_private_keys[
                        config["uuid"]
                    ]

                # populate ssh_tunnel_passwords from the request or from existing DBs
                if file_name in ssh_tunnel_priv_key_passwords:
                    config["ssh_tunnel"]["private_key_password"] = (
                        ssh_tunnel_priv_key_passwords[file_name]
                    )
                elif (
                    prefix == "databases"
                    and config["uuid"] in db_ssh_tunnel_priv_key_passws
                ):
                    config["ssh_tunnel"]["private_key_password"] = (
                        db_ssh_tunnel_priv_key_passws[config["uuid"]]
                    )

                schema.load(config)
                configs[file_name] = config
            except ValidationError as exc:
                exc.messages = {file_name: exc.messages}
                exceptions.append(exc)

    return configs


def is_valid_config(file_name: str) -> bool:
    path = Path(file_name)

    # ignore system files that might've been added to the bundle
    if path.name.startswith(".") or path.name.startswith("_"):
        return False

    # ensure extension is YAML
    if path.suffix.lower() not in {".yaml", ".yml"}:
        return False

    return True


def get_contents_from_bundle(bundle: ZipFile) -> dict[str, str]:
    check_is_safe_zip(bundle)
    return {
        remove_root(file_name): bundle.read(file_name).decode()
        for file_name in bundle.namelist()
        if is_valid_config(file_name)
    }
