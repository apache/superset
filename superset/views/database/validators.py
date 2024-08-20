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

from typing import Optional

from flask_babel import lazy_gettext as _
from marshmallow import ValidationError

from superset import security_manager
from superset.commands.database.exceptions import DatabaseInvalidError
from superset.databases.utils import make_url_safe
from superset.models.core import Database


def sqlalchemy_uri_validator(
    uri: str, exception: type[ValidationError] = ValidationError
) -> None:
    """
    Check if a user has submitted a valid SQLAlchemy URI
    """
    try:
        make_url_safe(uri.strip())
    except DatabaseInvalidError as ex:
        raise exception(
            [
                _(
                    "Invalid connection string, a valid string usually follows:"
                    "'DRIVER://USER:PASSWORD@DB-HOST/DATABASE-NAME'"
                    "<p>"
                    "Example:'postgresql://user:password@your-postgres-db/database'"
                    "</p>"
                )
            ]
        ) from ex


def schema_allows_file_upload(database: Database, schema: Optional[str]) -> bool:
    if not database.allow_file_upload:
        return False
    if schemas := database.get_schema_access_for_file_upload():
        return schema in schemas
    return security_manager.can_access_database(database)
