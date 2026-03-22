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
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import types

from superset.constants import TimeGrain
from superset.db_engine_specs.base import BaseEngineSpec, DatabaseCategory


class DynamoDBEngineSpec(BaseEngineSpec):
    engine = "dynamodb"
    engine_name = "Amazon DynamoDB"

    metadata = {
        "description": (
            "Amazon DynamoDB is a serverless NoSQL database with SQL via PartiQL."
        ),
        "logo": "aws.png",
        "homepage_url": "https://aws.amazon.com/dynamodb/",
        "categories": [
            DatabaseCategory.CLOUD_AWS,
            DatabaseCategory.SEARCH_NOSQL,
            DatabaseCategory.PROPRIETARY,
        ],
        "pypi_packages": ["pydynamodb"],
        "connection_string": (
            "dynamodb://{aws_access_key_id}:{aws_secret_access_key}"
            "@dynamodb.{region}.amazonaws.com:443?connector=superset"
        ),
        "parameters": {
            "aws_access_key_id": "AWS access key ID",
            "aws_secret_access_key": "AWS secret access key",
            "region": "AWS region (e.g., us-east-1)",
        },
        "notes": "Uses PartiQL for SQL queries. Requires connector=superset parameter.",
        "docs_url": "https://github.com/passren/PyDynamoDB",
    }

    _time_grain_expressions = {
        None: "{col}",
        TimeGrain.SECOND: "DATETIME(STRFTIME('%Y-%m-%dT%H:%M:%S', {col}))",
        TimeGrain.MINUTE: "DATETIME(STRFTIME('%Y-%m-%dT%H:%M:00', {col}))",
        TimeGrain.HOUR: "DATETIME(STRFTIME('%Y-%m-%dT%H:00:00', {col}))",
        TimeGrain.DAY: "DATETIME({col}, 'start of day')",
        TimeGrain.WEEK: "DATETIME({col}, 'start of day', \
            -strftime('%w', {col}) || ' days')",
        TimeGrain.MONTH: "DATETIME({col}, 'start of month')",
        TimeGrain.QUARTER: (
            "DATETIME({col}, 'start of month', "
            "printf('-%d month', (strftime('%m', {col}) - 1) % 3))"
        ),
        TimeGrain.YEAR: "DATETIME({col}, 'start of year')",
        TimeGrain.WEEK_ENDING_SATURDAY: "DATETIME({col}, 'start of day', 'weekday 6')",
        TimeGrain.WEEK_ENDING_SUNDAY: "DATETIME({col}, 'start of day', 'weekday 0')",
        TimeGrain.WEEK_STARTING_SUNDAY: (
            "DATETIME({col}, 'start of day', 'weekday 0', '-7 days')"
        ),
        TimeGrain.WEEK_STARTING_MONDAY: (
            "DATETIME({col}, 'start of day', 'weekday 1', '-7 days')"
        ),
    }

    @classmethod
    def epoch_to_dttm(cls) -> str:
        return "datetime({col}, 'unixepoch')"

    @classmethod
    def convert_dttm(
        cls, target_type: str, dttm: datetime, db_extra: Optional[dict[str, Any]] = None
    ) -> Optional[str]:
        sqla_type = cls.get_sqla_column_type(target_type)

        if isinstance(sqla_type, (types.String, types.DateTime)):
            return f"""'{dttm.isoformat(sep=" ", timespec="seconds")}'"""

        return None
