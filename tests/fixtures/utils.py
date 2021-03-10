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
from contextlib import contextmanager
from typing import Any, Dict, Optional

from pandas import DataFrame
from sqlalchemy.ext.declarative.api import DeclarativeMeta

from superset import ConnectorRegistry, db
from superset.connectors.sqla.models import SqlaTable
from superset.models.core import Database
from superset.utils.core import get_or_create_db

TEST_DATABSE_NAME = "tests"


def get_test_database() -> "Database":
    from superset import conf

    db_uri = conf.get("SQLALCHEMY_EXAMPLES_URI") or conf.get("SQLALCHEMY_DATABASE_URI")
    return get_or_create_db(TEST_DATABSE_NAME, db_uri)


def create_table_from_df(
    df: DataFrame,
    table_name: str,
    dtype: Dict[str, Any],
    table_description: str = "",
    fetch_values_predicate: Optional[str] = None,
    if_exists: str = "replace",
    database: Optional[Database] = None,
) -> SqlaTable:
    database = database or get_test_database()
    df.to_sql(
        table_name,
        database.get_sqla_engine(),
        if_exists=if_exists,
        chunksize=500,
        dtype=dtype,
        index=False,
        method="multi",
    )
    Table = ConnectorRegistry.sources["table"]
    table = db.session.query(Table).filter_by(table_name=table_name).one_or_none()
    if not table:
        table = Table(table_name=table_name)
    if fetch_values_predicate:
        table.fetch_values_predicate = fetch_values_predicate
    table.database = database
    table.description = table_description
    db.session.merge(table)
    db.session.commit()
    return table


@contextmanager
def db_insert_temp_object(obj: DeclarativeMeta):
    """Insert a temporary object in database; delete when done."""
    session = db.session
    try:
        session.add(obj)
        session.commit()
        yield obj
    finally:
        session.delete(obj)
        session.commit()
