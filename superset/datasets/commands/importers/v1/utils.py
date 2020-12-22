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
import re
from typing import Any, Dict
from urllib import request

import pandas as pd
from sqlalchemy import BigInteger, Date, DateTime, Float, String, Text
from sqlalchemy.orm import Session
from sqlalchemy.sql.visitors import VisitableType

from superset.connectors.sqla.models import SqlaTable

logger = logging.getLogger(__name__)

CHUNKSIZE = 512
VARCHAR = re.compile(r"VARCHAR\((\d+)\)", re.IGNORECASE)

JSON_KEYS = {"params", "template_params", "extra"}


type_map = {
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
    session: Session, config: Dict[str, Any], overwrite: bool = False
) -> SqlaTable:
    existing = session.query(SqlaTable).filter_by(uuid=config["uuid"]).first()
    if existing:
        if not overwrite:
            return existing
        config["id"] = existing.id

    # TODO (betodealmeida): move this logic to import_from_dict
    config = config.copy()
    for key in JSON_KEYS:
        if config.get(key):
            try:
                config[key] = json.dumps(config[key])
            except TypeError:
                logger.info("Unable to encode `%s` field: %s", key, config[key])
    for metric in config.get("metrics", []):
        if metric.get("extra"):
            try:
                metric["extra"] = json.dumps(metric["extra"])
            except TypeError:
                logger.info("Unable to encode `extra` field: %s", metric["extra"])

    # should we delete columns and metrics not present in the current import?
    sync = ["columns", "metrics"] if overwrite else []

    # should we also load data into the dataset?
    data_uri = config.get("data")

    # import recursively to include columns and metrics
    dataset = SqlaTable.import_from_dict(session, config, recursive=True, sync=sync)
    if dataset.id is None:
        session.flush()

    # load data
    if data_uri:
        data = request.urlopen(data_uri)
        df = pd.read_csv(data, encoding="utf-8")
        dtype = get_dtype(df, dataset)

        # convert temporal columns
        for column_name, sqla_type in dtype.items():
            if isinstance(sqla_type, (Date, DateTime)):
                df[column_name] = pd.to_datetime(df[column_name])

        df.to_sql(
            dataset.table_name,
            con=session.connection(),
            schema=dataset.schema,
            if_exists="replace",
            chunksize=CHUNKSIZE,
            dtype=dtype,
            index=False,
            method="multi",
        )

    return dataset
