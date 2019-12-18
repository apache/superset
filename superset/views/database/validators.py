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

from typing import Type

from flask_babel import lazy_gettext as _
from marshmallow import ValidationError
from sqlalchemy.engine.url import make_url
from sqlalchemy.exc import ArgumentError

from superset import security_manager


def sqlalchemy_uri_validator(
    uri: str, exception: Type[ValidationError] = ValidationError
) -> None:
    """
    Check if a user has submitted a valid SQLAlchemy URI
    """
    try:
        make_url(uri.strip())
    except (ArgumentError, AttributeError):
        raise exception(
            _(
                "Invalid connnection string, a valid string follows: "
                " 'DRIVER://USER:PASSWORD@DB-HOST/DATABASE-NAME'"
                " <p>Example:'postgresql://user:password@your-postgres-db/database'</p>"
            )
        )


def schema_allows_csv_upload(database, schema):
    if not database.allow_csv_upload:
        return False
    schemas = database.get_schema_access_for_csv_upload()
    if schemas:
        return schema in schemas
    return (
        security_manager.database_access(database)
        or security_manager.all_datasource_access()
    )
