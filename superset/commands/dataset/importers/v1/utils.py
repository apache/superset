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
import gzip
import logging
import re
from typing import Any
from urllib import request

import pandas as pd
from flask import current_app
from sqlalchemy import BigInteger, Boolean, Date, DateTime, Float, String, Text
from sqlalchemy.exc import MultipleResultsFound
from sqlalchemy.sql.visitors import VisitableType

from superset import db, security_manager
from superset.commands.dataset.exceptions import DatasetForbiddenDataURI
from superset.commands.exceptions import ImportFailedError
from superset.connectors.sqla.models import SqlaTable
from superset.models.core import Database
from superset.sql_parse import Table
from superset.utils import json
from superset.utils.core import get_user

logger = logging.getLogger(__name__)

CHUNKSIZE = 512
VARCHAR = re.compile(r"VARCHAR\((\d+)\)", re.IGNORECASE)

JSON_KEYS = {"params", "template_params", "extra"}


type_map = {
    "BOOLEAN": Boolean(),
    "VARCHAR": String(255),
    "STRING": String(255),
    "TEXT": Text(),
    "BIGINT": BigInteger(),
    "FLOAT": Float(),
    "FLOAT64": Float(),
    "DOUBLE PRECISION": Float(),
    "DATE": Date(),
    "DATETIME": DateTime(),
    "TIMESTAMP WITHOUT TIME ZONE": DateTime(timezone=False),
    "TIMESTAMP WITH TIME ZONE": DateTime(timezone=True),
}


def get_sqla_type(native_type: str) -> VisitableType:
    if native_type.upper() in type_map:
        return type_map[native_type.upper()]

    if match := VARCHAR.match(native_type):
        size = int(match.group(1))
        return String(size)

    raise Exception(  # pylint: disable=broad-exception-raised
        f"Unknown type: {native_type}"
    )


def get_dtype(df: pd.DataFrame, dataset: SqlaTable) -> dict[str, VisitableType]:
    return {
        column.column_name: get_sqla_type(column.type)
        for column in dataset.columns
        if column.column_name in df.keys()
    }


def validate_data_uri(data_uri: str) -> None:
    """
    Validate that the data URI is configured on DATASET_IMPORT_ALLOWED_URLS
    has a valid URL.

    :param data_uri:
    :return:
    """
    allowed_urls = current_app.config["DATASET_IMPORT_ALLOWED_DATA_URLS"]
    for allowed_url in allowed_urls:
        try:
            match = re.match(allowed_url, data_uri)
        except re.error:
            logger.exception(
                "Invalid regular expression on DATASET_IMPORT_ALLOWED_URLS"
            )
            raise
        if match:
            return
    raise DatasetForbiddenDataURI()


# pylint: disable=too-many-branches
def import_dataset(
    config: dict[str, Any],
    overwrite: bool = False,
    force_data: bool = False,
    ignore_permissions: bool = False,
) -> SqlaTable:
    can_write = ignore_permissions or security_manager.can_access(
        "can_write",
        "Dataset",
    )
    existing = db.session.query(SqlaTable).filter_by(uuid=config["uuid"]).first()
    user = get_user()
    if existing:
        if overwrite and can_write and user:
            if user not in existing.owners and not security_manager.is_admin():
                raise ImportFailedError(
                    "A dataset already exists and user doesn't "
                    "have permissions to overwrite it"
                )
        if not overwrite or not can_write:
            return existing
        config["id"] = existing.id

    elif not can_write:
        raise ImportFailedError(
            "Dataset doesn't exist and user doesn't have permission to create datasets"
        )

    # TODO (betodealmeida): move this logic to import_from_dict
    config = config.copy()
    for key in JSON_KEYS:
        if config.get(key) is not None:
            try:
                config[key] = json.dumps(config[key])
            except TypeError:
                logger.info("Unable to encode `%s` field: %s", key, config[key])
    for key in ("metrics", "columns"):
        for attributes in config.get(key, []):
            if attributes.get("extra") is not None:
                try:
                    attributes["extra"] = json.dumps(attributes["extra"])
                except TypeError:
                    logger.info(
                        "Unable to encode `extra` field: %s", attributes["extra"]
                    )
                    attributes["extra"] = None

    # should we delete columns and metrics not present in the current import?
    sync = ["columns", "metrics"] if overwrite else []

    # should we also load data into the dataset?
    data_uri = config.get("data")

    # import recursively to include columns and metrics
    try:
        dataset = SqlaTable.import_from_dict(config, recursive=True, sync=sync)
    except MultipleResultsFound:
        # Finding multiple results when importing a dataset only happens because initially
        # datasets were imported without schemas (eg, `examples.NULL.users`), and later
        # they were fixed to have the default schema (eg, `examples.public.users`). If a
        # user created `examples.public.users` during that time the second import will
        # fail because the UUID match will try to update `examples.NULL.users` to
        # `examples.public.users`, resulting in a conflict.
        #
        # When that happens, we return the original dataset, unmodified.
        dataset = db.session.query(SqlaTable).filter_by(uuid=config["uuid"]).one()

    if dataset.id is None:
        db.session.flush()

    try:
        table_exists = dataset.database.has_table(
            Table(dataset.table_name, dataset.schema, dataset.catalog),
        )
    except Exception:  # pylint: disable=broad-except
        # MySQL doesn't play nice with GSheets table names
        logger.warning(
            "Couldn't check if table %s exists, assuming it does", dataset.table_name
        )
        table_exists = True

    if data_uri and (not table_exists or force_data):
        load_data(data_uri, dataset, dataset.database)

    if (user := get_user()) and user not in dataset.owners:
        dataset.owners.append(user)

    return dataset


def load_data(data_uri: str, dataset: SqlaTable, database: Database) -> None:
    """
    Load data from a data URI into a dataset.

    :raises DatasetUnAllowedDataURI: If a dataset is trying
    to load data from a URI that is not allowed.
    """
    validate_data_uri(data_uri)
    logger.info("Downloading data from %s", data_uri)
    data = request.urlopen(data_uri)  # pylint: disable=consider-using-with
    if data_uri.endswith(".gz"):
        data = gzip.open(data)
    df = pd.read_csv(data, encoding="utf-8")
    dtype = get_dtype(df, dataset)

    # convert temporal columns
    for column_name, sqla_type in dtype.items():
        if isinstance(sqla_type, (Date, DateTime)):
            df[column_name] = pd.to_datetime(df[column_name])

    # reuse session when loading data if possible, to make import atomic
    if database.sqlalchemy_uri == current_app.config.get("SQLALCHEMY_DATABASE_URI"):
        logger.info("Loading data inside the import transaction")
        connection = db.session.connection()
        df.to_sql(
            dataset.table_name,
            con=connection,
            schema=dataset.schema,
            if_exists="replace",
            chunksize=CHUNKSIZE,
            dtype=dtype,
            index=False,
            method="multi",
        )
    else:
        logger.warning("Loading data outside the import transaction")
        with database.get_sqla_engine(
            catalog=dataset.catalog,
            schema=dataset.schema,
        ) as engine:
            df.to_sql(
                dataset.table_name,
                con=engine,
                schema=dataset.schema,
                if_exists="replace",
                chunksize=CHUNKSIZE,
                dtype=dtype,
                index=False,
                method="multi",
            )
