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
import json
import logging
import re
from typing import Any, Dict
from urllib import request

import pandas as pd
from flask import current_app, g
from sqlalchemy import BigInteger, Boolean, Date, DateTime, Float, String, Text
from sqlalchemy.orm import Session
from sqlalchemy.orm.exc import MultipleResultsFound
from sqlalchemy.sql.visitors import VisitableType

from superset.connectors.sqla.models import SqlaTable
from superset.models.core import Database
from superset.utils.core import get_example_database

logger = logging.getLogger(__name__)

CHUNKSIZE = 512
VARCHAR = re.compile(r"VARCHAR\((\d+)\)", re.IGNORECASE)

JSON_KEYS = {"params", "template_params"}


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

    match = VARCHAR.match(native_type)
    if match:
        size = int(match.group(1))
        return String(size)

    raise Exception(f"Unknown type: {native_type}")


def get_dtype(df: pd.DataFrame, dataset: SqlaTable) -> Dict[str, VisitableType]:
    return {
        column.column_name: get_sqla_type(column.type)
        for column in dataset.columns
        if column.column_name in df.keys()
    }


def import_dataset(
    session: Session,
    config: Dict[str, Any],
    overwrite: bool = False,
    force_data: bool = False,
) -> SqlaTable:
    existing = session.query(SqlaTable).filter_by(uuid=config["uuid"]).first()
    if existing:
        if not overwrite:
            return existing
        config["id"] = existing.id

    # TODO (betodealmeida): move this logic to import_from_dict
    config = config.copy()
    for key in JSON_KEYS:
        if config.get(key) is not None:
            try:
                config[key] = json.dumps(config[key])
            except TypeError:
                logger.info("Unable to encode `%s` field: %s", key, config[key])
    for metric in config.get("metrics", []):
        if metric.get("extra") is not None:
            try:
                metric["extra"] = json.dumps(metric["extra"])
            except TypeError:
                logger.info("Unable to encode `extra` field: %s", metric["extra"])
                metric["extra"] = None

    # should we delete columns and metrics not present in the current import?
    sync = ["columns", "metrics"] if overwrite else []

    # should we also load data into the dataset?
    data_uri = config.get("data")

    # import recursively to include columns and metrics
    try:
        dataset = SqlaTable.import_from_dict(session, config, recursive=True, sync=sync)
    except MultipleResultsFound:
        # Finding multiple results when importing a dataset only happens because initially
        # datasets were imported without schemas (eg, `examples.NULL.users`), and later
        # they were fixed to have the default schema (eg, `examples.public.users`). If a
        # user created `examples.public.users` during that time the second import will
        # fail because the UUID match will try to update `examples.NULL.users` to
        # `examples.public.users`, resulting in a conflict.
        #
        # When that happens, we return the original dataset, unmodified.
        dataset = session.query(SqlaTable).filter_by(uuid=config["uuid"]).one()

    if dataset.id is None:
        session.flush()

    example_database = get_example_database()
    try:
        table_exists = example_database.has_table_by_name(dataset.table_name)
    except Exception:  # pylint: disable=broad-except
        # MySQL doesn't play nice with GSheets table names
        logger.warning(
            "Couldn't check if table %s exists, assuming it does", dataset.table_name
        )
        table_exists = True

    if data_uri and (not table_exists or force_data):
        logger.info("Downloading data from %s", data_uri)
        load_data(data_uri, dataset, example_database, session)

    if hasattr(g, "user") and g.user:
        dataset.owners.append(g.user)

    return dataset


def load_data(
    data_uri: str, dataset: SqlaTable, example_database: Database, session: Session
) -> None:
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
    if example_database.sqlalchemy_uri == current_app.config.get(
        "SQLALCHEMY_DATABASE_URI"
    ) or not current_app.config.get("SQLALCHEMY_EXAMPLES_URI"):
        logger.info("Loading data inside the import transaction")
        connection = session.connection()
    else:
        logger.warning("Loading data outside the import transaction")
        connection = example_database.get_sqla_engine()

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
