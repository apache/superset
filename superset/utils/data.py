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
import random
import string
import sys
from datetime import date, datetime, time, timedelta
from typing import Any, Callable, cast, Dict, List, Optional

import sqlalchemy.sql.sqltypes
from sqlalchemy import Column, inspect, MetaData, Table
from sqlalchemy.sql.visitors import VisitableType
from typing_extensions import TypedDict

ColumnInfo = TypedDict(
    "ColumnInfo",
    {
        "name": str,
        "type": VisitableType,
        "nullable": bool,
        "default": Optional[Any],
        "autoincrement": str,
        "primary_key": int,
    },
)


example_column = {
    "name": "id",
    "type": sqlalchemy.sql.sqltypes.INTEGER(),
    "nullable": False,
    "default": None,
    "autoincrement": "auto",
    "primary_key": 1,
}


MINIMUM_DATE = date(1900, 1, 1)
MAXIMUM_DATE = date.today()
days_range = (MAXIMUM_DATE - MINIMUM_DATE).days


def get_type_generator(sqltype: sqlalchemy.sql.sqltypes) -> Callable[[], Any]:
    if isinstance(sqltype, sqlalchemy.sql.sqltypes.INTEGER):
        return lambda: random.randrange(2147483647)

    if isinstance(sqltype, sqlalchemy.sql.sqltypes.BIGINT):
        return lambda: random.randrange(sys.maxsize)

    if isinstance(sqltype, sqlalchemy.sql.sqltypes.VARCHAR):
        length = random.randrange(sqltype.length or 255)
        return lambda: "".join(random.choices(string.printable, k=length))

    if isinstance(sqltype, sqlalchemy.sql.sqltypes.TEXT):
        length = random.randrange(65535)
        # "practicality beats purity"
        length = max(length, 2048)
        return lambda: "".join(random.choices(string.printable, k=length))

    if isinstance(sqltype, sqlalchemy.sql.sqltypes.BOOLEAN):
        return lambda: random.choice([True, False])

    if isinstance(
        sqltype, (sqlalchemy.sql.sqltypes.FLOAT, sqlalchemy.sql.sqltypes.REAL)
    ):
        return lambda: random.uniform(-sys.maxsize, sys.maxsize)

    if isinstance(sqltype, sqlalchemy.sql.sqltypes.DATE):
        return lambda: MINIMUM_DATE + timedelta(days=random.randrange(days_range))

    if isinstance(sqltype, sqlalchemy.sql.sqltypes.TIME):
        return lambda: time(
            random.randrange(24), random.randrange(60), random.randrange(60),
        )

    if isinstance(
        sqltype, (sqlalchemy.sql.sqltypes.TIMESTAMP, sqlalchemy.sql.sqltypes.DATETIME)
    ):
        return lambda: datetime.fromordinal(MINIMUM_DATE.toordinal()) + timedelta(
            seconds=random.randrange(days_range * 86400)
        )

    raise Exception(f"Unknown type {sqltype}. Please add it to `get_type_generator`.")


def add_data(
    columns: Optional[List[ColumnInfo]],
    num_rows: int,
    table_name: str,
    append: bool = True,
) -> None:
    """
    Generate synthetic data for testing migrations and features.

    If the table already exists `columns` can be `None`.

    :param Optional[List[ColumnInfo]] columns: list of column names and types to create
    :param int run_nows: how many rows to generate and insert
    :param str table_name: name of table, will be created if it doesn't exist
    :param bool append: if the table already exists, append data or replace?
    """
    from superset.utils.core import get_example_database

    database = get_example_database()
    table_exists = database.has_table_by_name(table_name)
    engine = database.get_sqla_engine()

    if columns is None:
        if not table_exists:
            raise Exception(
                f"The table {table_name} does not exist. To create it you need to "
                "pass a list of column names and types."
            )

        inspector = inspect(engine)
        columns = inspector.get_columns(table_name)

    # create table if needed
    column_objects = get_column_objects(columns)
    metadata = MetaData()
    table = Table(table_name, metadata, *column_objects)
    metadata.create_all(engine)

    if not append:
        # pylint: disable=no-value-for-parameter (sqlalchemy/issues/4656)
        engine.execute(table.delete())

    data = generate_data(columns, num_rows)
    # pylint: disable=no-value-for-parameter (sqlalchemy/issues/4656)
    engine.execute(table.insert(), data)


def get_column_objects(columns: List[ColumnInfo]) -> List[Column]:
    out = []
    for column in columns:
        kwargs = cast(Dict[str, Any], column.copy())
        kwargs["type_"] = kwargs.pop("type")
        out.append(Column(**kwargs))
    return out


def generate_data(columns: List[ColumnInfo], num_rows: int) -> List[Dict[str, Any]]:
    keys = [column["name"] for column in columns]
    return [
        dict(zip(keys, row))
        for row in zip(*[generate_column_data(column, num_rows) for column in columns])
    ]


def generate_column_data(column: ColumnInfo, num_rows: int) -> List[Any]:
    func = get_type_generator(column["type"])
    return [func() for _ in range(num_rows)]
