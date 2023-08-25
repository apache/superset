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
import re

from typing import (
    Any,
    Dict,
    ContextManager,
    TYPE_CHECKING,
    Pattern,
    Tuple,
)

import pandas as pd
from flask_babel import gettext as __
from marshmallow import Schema, fields
from marshmallow.validate import Range
from superset.db_engine_specs.base import (
    BaseEngineSpec,
    BasicParametersType,
    BasicParametersMixin,
)
from superset.errors import SupersetErrorType
from superset.sql_parse import Table
from sqlalchemy.engine.base import Engine
from superset.utils.core import GenericDataType

from sqlalchemy_iris import BIT

if TYPE_CHECKING:
    from superset.models.core import Database


logger = logging.getLogger(__name__)

# Regular expressions to catch custom errors
CONNECTION_ACCESS_DENIED_REGEX = re.compile("Access Denied")

TABLE_DOES_NOT_EXIST_REGEX = re.compile("Table '(?P<table_name>.+?)' not found")

COLUMN_DOES_NOT_EXIST_REGEX = re.compile(
    "Field '(?P<column_name>.+?)' not found in the applicable tables\^(?P<location>.+?)"
)


class IRISParametersSchema(Schema):
    username = fields.String(allow_none=True, description=__("Username"))
    password = fields.String(allow_none=True, description=__("Password"))
    host = fields.String(required=True, description=__("Hostname or IP address"))
    port = fields.Integer(
        allow_none=True,
        description=__("Database port"),
        validate=Range(min=0, max=65535),
    )
    database = fields.String(allow_none=True, description=__("Database name"))


class IRISEngineSpec(BaseEngineSpec, BasicParametersMixin):
    """
    See :py:class:`superset.db_engine_specs.base.BaseEngineSpec`
    """

    engine = "iris"
    engine_name = "InterSystems IRIS"

    allow_limit_clause = False

    max_column_name_length = 50

    sqlalchemy_uri_placeholder = "iris://_SYSTEM:SYS@iris:1972/USER"
    parameters_schema = IRISParametersSchema()

    column_type_mappings = (
        (
            re.compile(r"^bit", re.IGNORECASE),
            BIT(),
            GenericDataType.NUMERIC,
        ),
        (
            re.compile(r"^bool(ean)?", re.IGNORECASE),
            BIT(),
            GenericDataType.NUMERIC,
        ),
    )

    _time_grain_expressions = {
        None: "{col}",
        "PT1S": "CAST(TO_CHAR(CAST({col} AS TIMESTAMP), 'YYYY-MM-DD HH24:MM:SS') AS DATETIME)",
        "PT1M": "CAST(TO_CHAR(CAST({col} AS TIMESTAMP), 'YYYY-MM-DD HH24:MM:00') AS DATETIME)",
        "PT1H": "CAST(TO_CHAR(CAST({col} AS TIMESTAMP), 'YYYY-MM-DD HH24:00:00') AS DATETIME)",
        "P1D": "CAST(CAST({col} AS TIMESTAMP) AS Date)",
        "P1W": "CAST(DATEADD(DAY, 1 - MOD((DATEPART(WEEKDAY, {col}) + 5), 7), {col}) AS DATE)",
        "P1M": "CAST(DATEADD(MONTH, DATEDIFF(MONTH, 1, {col}), 1) AS DATE)",
        "P3M": "CAST(DATEADD(QUARTER, DATEDIFF(MONTH, 1, {col}) \ 3, 1) AS DATE)",
        "P1Y": "CAST(DATEADD(YEAR, DATEDIFF(YEAR, 1, {col}), 1) AS DATE)",
    }

    custom_errors: Dict[Pattern[str], Tuple[str, SupersetErrorType, Dict[str, Any]]] = {
        CONNECTION_ACCESS_DENIED_REGEX: (
            __("Either the username, password or namespace is incorrect."),
            SupersetErrorType.CONNECTION_ACCESS_DENIED_ERROR,
            {"invalid": ["username", "password", "database"]},
        ),
        COLUMN_DOES_NOT_EXIST_REGEX: (
            __(
                'We can\'t seem to resolve the column "%(column_name)s"',
            ),
            SupersetErrorType.COLUMN_DOES_NOT_EXIST_ERROR,
            {},
        ),
        TABLE_DOES_NOT_EXIST_REGEX: (
            __(
                'The table "%(table_name)s" does not exist. '
                "A valid table must be used to run this query.",
            ),
            SupersetErrorType.TABLE_DOES_NOT_EXIST_ERROR,
            {},
        ),
    }
