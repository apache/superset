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
import decimal
import json
import logging
import os
import random
import string
import sys
from datetime import date, datetime, time, timedelta
from typing import Any, Callable, cast, Dict, Iterator, List, Optional, Type
from uuid import uuid4

import sqlalchemy.sql.sqltypes
import sqlalchemy_utils
from flask_appbuilder import Model
from sqlalchemy import Column, inspect, MetaData, Table
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from sqlalchemy.sql.visitors import VisitableType
from typing_extensions import TypedDict

from superset import db

logger = logging.getLogger(__name__)

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


def get_type_generator(  # pylint: disable=too-many-return-statements,too-many-branches
    sqltype: sqlalchemy.sql.sqltypes,
) -> Callable[[], Any]:
    if isinstance(sqltype, sqlalchemy.dialects.mysql.types.TINYINT):
        return lambda: random.choice([0, 1])

    if isinstance(
        sqltype, (sqlalchemy.sql.sqltypes.INTEGER, sqlalchemy.sql.sqltypes.Integer)
    ):
        return lambda: random.randrange(2147483647)

    if isinstance(sqltype, sqlalchemy.sql.sqltypes.BIGINT):
        return lambda: random.randrange(sys.maxsize)

    if isinstance(
        sqltype, (sqlalchemy.sql.sqltypes.VARCHAR, sqlalchemy.sql.sqltypes.String)
    ):
        length = random.randrange(sqltype.length or 255)
        length = max(8, length)  # for unique values
        length = min(100, length)  # for FAB perms
        return lambda: "".join(random.choices(string.ascii_letters, k=length))

    if isinstance(
        sqltype, (sqlalchemy.sql.sqltypes.TEXT, sqlalchemy.sql.sqltypes.Text)
    ):
        length = random.randrange(65535)
        # "practicality beats purity"
        length = max(length, 2048)
        return lambda: "".join(random.choices(string.ascii_letters, k=length))

    if isinstance(
        sqltype, (sqlalchemy.sql.sqltypes.BOOLEAN, sqlalchemy.sql.sqltypes.Boolean)
    ):
        return lambda: random.choice([True, False])

    if isinstance(
        sqltype, (sqlalchemy.sql.sqltypes.FLOAT, sqlalchemy.sql.sqltypes.REAL)
    ):
        return lambda: random.uniform(-sys.maxsize, sys.maxsize)

    if isinstance(sqltype, sqlalchemy.sql.sqltypes.DATE):
        return lambda: MINIMUM_DATE + timedelta(days=random.randrange(days_range))

    if isinstance(sqltype, sqlalchemy.sql.sqltypes.TIME):
        return lambda: time(
            random.randrange(24),
            random.randrange(60),
            random.randrange(60),
        )

    if isinstance(
        sqltype,
        (
            sqlalchemy.sql.sqltypes.TIMESTAMP,
            sqlalchemy.sql.sqltypes.DATETIME,
            sqlalchemy.sql.sqltypes.DateTime,
        ),
    ):
        return lambda: datetime.fromordinal(MINIMUM_DATE.toordinal()) + timedelta(
            seconds=random.randrange(days_range * 86400)
        )

    if isinstance(sqltype, sqlalchemy.sql.sqltypes.Numeric):
        # since decimal is used in some models to store time, return a value that
        # is a reasonable timestamp
        return lambda: decimal.Decimal(datetime.now().timestamp() * 1000)

    if isinstance(sqltype, sqlalchemy.sql.sqltypes.JSON):
        return lambda: {
            "".join(random.choices(string.ascii_letters, k=8)): random.randrange(65535)
            for _ in range(10)
        }

    if isinstance(
        sqltype,
        (
            sqlalchemy.sql.sqltypes.BINARY,
            sqlalchemy_utils.types.encrypted.encrypted_type.EncryptedType,
        ),
    ):
        length = random.randrange(sqltype.length or 255)
        return lambda: os.urandom(length)

    if isinstance(sqltype, sqlalchemy_utils.types.uuid.UUIDType):
        return uuid4

    if isinstance(sqltype, postgresql.base.UUID):
        return lambda: str(uuid4())

    if isinstance(sqltype, sqlalchemy.sql.sqltypes.BLOB):
        length = random.randrange(sqltype.length or 255)
        return lambda: os.urandom(length)

    logger.warning(
        "Unknown type %s. Please add it to `get_type_generator`.", type(sqltype)
    )
    return lambda: b"UNKNOWN TYPE"


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
    :param int num_rows: how many rows to generate and insert
    :param str table_name: name of table, will be created if it doesn't exist
    :param bool append: if the table already exists, append data or replace?
    """
    # pylint: disable=import-outside-toplevel
    from superset.utils.database import get_example_database

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
        # pylint: disable=no-value-for-parameter # sqlalchemy/issues/4656
        engine.execute(table.delete())

    data = generate_data(columns, num_rows)
    # pylint: disable=no-value-for-parameter # sqlalchemy/issues/4656
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
    gen = get_type_generator(column["type"])
    return [gen() for _ in range(num_rows)]


def add_sample_rows(
    session: Session, model: Type[Model], count: int
) -> Iterator[Model]:
    """
    Add entities of a given model.
    :param Session session: an SQLAlchemy session
    :param Model model: a Superset/FAB model
    :param int count: how many entities to generate and insert
    """
    inspector = inspect(model)

    # select samples to copy relationship values
    relationships = inspector.relationships.items()
    samples = session.query(model).limit(count).all() if relationships else []

    max_primary_key: Optional[int] = None
    for i in range(count):
        sample = samples[i % len(samples)] if samples else None
        kwargs = {}
        for column in inspector.columns.values():
            # for primary keys, keep incrementing
            if column.primary_key:
                if max_primary_key is None:
                    max_primary_key = (
                        session.query(func.max(getattr(model, column.name))).scalar()
                        or 0
                    )
                max_primary_key += 1
                kwargs[column.name] = max_primary_key

            # if the column has a foreign key, copy the value from an existing entity
            elif column.foreign_keys:
                if sample:
                    kwargs[column.name] = getattr(sample, column.name)
                else:
                    kwargs[column.name] = get_valid_foreign_key(column)

            # should be an enum but it's not
            elif column.name == "datasource_type":
                kwargs[column.name] = "table"

            # otherwise, generate a random value based on the type
            else:
                kwargs[column.name] = generate_value(column)

        entity = model(**kwargs)
        yield entity


def get_valid_foreign_key(column: Column) -> Any:
    foreign_key = list(column.foreign_keys)[0]
    table_name, column_name = foreign_key.target_fullname.split(".", 1)
    return db.engine.execute(f"SELECT {column_name} FROM {table_name} LIMIT 1").scalar()


def generate_value(column: Column) -> Any:
    if hasattr(column.type, "enums"):
        return random.choice(column.type.enums)

    json_as_string = "json" in column.name.lower() and isinstance(
        column.type, sqlalchemy.sql.sqltypes.Text
    )
    type_ = sqlalchemy.sql.sqltypes.JSON() if json_as_string else column.type
    value = get_type_generator(type_)()
    if json_as_string:
        value = json.dumps(value)
    return value
