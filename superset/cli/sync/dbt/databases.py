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

import logging
from pathlib import Path
from typing import Any, Dict, TYPE_CHECKING

import yaml

from superset import db

if TYPE_CHECKING:
    from superset.models.core import Database

_logger = logging.getLogger(__name__)


def build_sqlalchemy_uri(target: Dict[str, Any]) -> str:
    """
    Build the SQLAlchemy URI for a given target.
    """
    type_ = target.get("type")

    if type_ == "postgres":
        return build_postgres_sqlalchemy_uri(target)

    raise Exception(
        f"Unable to build a SQLAlchemy URI for a target of type {type_}. Please file an "
        "issue at "
        "https://github.com/apache/superset/issues/new?template=feature_request.md"
    )


def build_postgres_sqlalchemy_uri(target: Dict[str, Any]) -> str:
    """
    Build the SQLAlchemy URI for a Postgres target.
    """
    return "postgresql+psycopg2://{user}:{pass}@{host}:{port}/{dbname}".format(**target)


def sync_database(
    profile_path: Path, project_name: str, target_name: str
) -> "Database":
    """
    Read target database from a DBT profile.yml and sync to Superset.
    """
    from superset.models.core import Database  # pylint: disable=import-outside-toplevel

    with open(profile_path, encoding="utf-8") as inp:
        profile = yaml.load(inp, Loader=yaml.SafeLoader)

    if project_name not in profile:
        raise Exception(f"Project {project_name} not found in {profile_path}")

    project = profile[project_name]
    outputs = project["outputs"]

    if target_name not in outputs:
        raise Exception(
            f"Target {target_name} not found in the outputs of {profile_path}"
        )

    target = outputs[target_name]
    sqlalchemy_uri = build_sqlalchemy_uri(target)

    databases = (
        db.session.query(Database).filter_by(sqlalchemy_uri=sqlalchemy_uri).all()
    )
    if len(databases) > 1:
        raise Exception(
            "More than one database with the same SQLAlchemy URI found, unable to update"
        )

    # read additional metadata
    meta = target.get("meta", {}).get("superset", {})

    if databases:
        _logger.info("Found an existing database, updating it")
        database = databases[0]
        database.database_name = f"{project_name}_{target_name}"
        for key, value in meta.items():
            setattr(database, key, value)
    else:
        _logger.info("No database found, creating it")
        database = Database(
            database_name=f"{project_name}_{target_name}",
            sqlalchemy_uri=sqlalchemy_uri,
            **meta,
        )
        db.session.add(database)

    db.session.commit()

    return database
