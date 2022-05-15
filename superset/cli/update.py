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
import json
import logging
import os
import sys
from typing import Optional

import click
from apispec import APISpec
from apispec.ext.marshmallow import MarshmallowPlugin
from flask import current_app
from flask.cli import with_appcontext
from flask_appbuilder import Model
from flask_appbuilder.api import BaseApi
from flask_appbuilder.api.manager import resolver

import superset.utils.database as database_utils
from superset.extensions import db
from superset.utils.core import override_user
from superset.utils.encrypt import SecretsMigrator

logger = logging.getLogger(__name__)


@click.command()
@with_appcontext
@click.option("--database_name", "-d", help="Database name to change")
@click.option("--uri", "-u", help="Database URI to change")
@click.option(
    "--skip_create",
    "-s",
    is_flag=True,
    default=False,
    help="Create the DB if it doesn't exist",
)
def set_database_uri(database_name: str, uri: str, skip_create: bool) -> None:
    """Updates a database connection URI"""
    database_utils.get_or_create_db(database_name, uri, not skip_create)


@click.command()
@with_appcontext
@click.option(
    "--username",
    "-u",
    default=None,
    help=(
        "Specify which user should execute the underlying SQL queries. If undefined "
        "defaults to the user registered with the database connection."
    ),
)
def update_datasources_cache(username: Optional[str]) -> None:
    """Refresh sqllab datasources cache"""
    # pylint: disable=import-outside-toplevel
    from superset import security_manager
    from superset.models.core import Database

    with override_user(security_manager.find_user(username)):
        for database in db.session.query(Database).all():
            if database.allow_multi_schema_metadata_fetch:
                print("Fetching {} datasources ...".format(database.name))
                try:
                    database.get_all_table_names_in_database(
                        force=True, cache=True, cache_timeout=24 * 60 * 60
                    )
                    database.get_all_view_names_in_database(
                        force=True, cache=True, cache_timeout=24 * 60 * 60
                    )
                except Exception as ex:  # pylint: disable=broad-except
                    print("{}".format(str(ex)))


@click.command()
@with_appcontext
def sync_tags() -> None:
    """Rebuilds special tags (owner, type, favorited by)."""
    # pylint: disable=no-member
    metadata = Model.metadata

    # pylint: disable=import-outside-toplevel
    from superset.common.tags import add_favorites, add_owners, add_types

    add_types(db.engine, metadata)
    add_owners(db.engine, metadata)
    add_favorites(db.engine, metadata)


@click.command()
@with_appcontext
def update_api_docs() -> None:
    """Regenerate the openapi.json file in docs"""
    superset_dir = os.path.abspath(os.path.dirname(__file__))
    openapi_json = os.path.join(
        superset_dir, "..", "..", "docs", "static", "resources", "openapi.json"
    )
    api_version = "v1"

    version_found = False
    api_spec = APISpec(
        title=current_app.appbuilder.app_name,
        version=api_version,
        openapi_version="3.0.2",
        info=dict(description=current_app.appbuilder.app_name),
        plugins=[MarshmallowPlugin(schema_name_resolver=resolver)],
        servers=[{"url": "http://localhost:8088"}],
    )
    for base_api in current_app.appbuilder.baseviews:
        if isinstance(base_api, BaseApi) and base_api.version == api_version:
            base_api.add_api_spec(api_spec)
            version_found = True
    if version_found:
        click.secho("Generating openapi.json", fg="green")
        with open(openapi_json, "w") as outfile:
            json.dump(api_spec.to_dict(), outfile, sort_keys=True, indent=2)
            outfile.write("\n")
    else:
        click.secho("API version not found", err=True)


@click.command()
@with_appcontext
@click.option(
    "--previous_secret_key",
    "-a",
    required=False,
    help="An optional previous secret key, if PREVIOUS_SECRET_KEY "
    "is not set on the config",
)
def re_encrypt_secrets(previous_secret_key: Optional[str] = None) -> None:
    previous_secret_key = previous_secret_key or current_app.config.get(
        "PREVIOUS_SECRET_KEY"
    )
    if previous_secret_key is None:
        click.secho("A previous secret key must be provided", err=True)
        sys.exit(1)
    secrets_migrator = SecretsMigrator(previous_secret_key=previous_secret_key)
    try:
        secrets_migrator.run()
    except ValueError as exc:
        click.secho(
            f"An error occurred, "
            f"probably an invalid previoud secret key was provided. Error:[{exc}]",
            err=True,
        )
        sys.exit(1)
