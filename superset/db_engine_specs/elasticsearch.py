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
from typing import Dict, Optional, Type

from superset.db_engine_specs.base import BaseEngineSpec
from superset.db_engine_specs.exceptions import (
    SupersetDBAPIDatabaseError,
    SupersetDBAPIOperationalError,
    SupersetDBAPIProgrammingError,
)
from superset.utils import core as utils


class ElasticSearchEngineSpec(BaseEngineSpec):  # pylint: disable=abstract-method
    engine = "elasticsearch"
    engine_name = "ElasticSearch (SQL API)"
    time_groupby_inline = True
    time_secondary_columns = True
    allows_joins = False
    allows_subqueries = True
    allows_sql_comments = False

    _time_grain_expressions = {
        None: "{col}",
        "PT1S": "HISTOGRAM({col}, INTERVAL 1 SECOND)",
        "PT1M": "HISTOGRAM({col}, INTERVAL 1 MINUTE)",
        "PT1H": "HISTOGRAM({col}, INTERVAL 1 HOUR)",
        "P1D": "HISTOGRAM({col}, INTERVAL 1 DAY)",
        "P1M": "HISTOGRAM({col}, INTERVAL 1 MONTH)",
        "P1Y": "HISTOGRAM({col}, INTERVAL 1 YEAR)",
    }

    type_code_map: Dict[int, str] = {}  # loaded from get_datatype only if needed

    @classmethod
    def get_dbapi_exception_mapping(cls) -> Dict[Type[Exception], Type[Exception]]:
        # pylint: disable=import-error,import-outside-toplevel
        import es.exceptions as es_exceptions

        return {
            es_exceptions.DatabaseError: SupersetDBAPIDatabaseError,
            es_exceptions.OperationalError: SupersetDBAPIOperationalError,
            es_exceptions.ProgrammingError: SupersetDBAPIProgrammingError,
        }

    @classmethod
    def convert_dttm(cls, target_type: str, dttm: datetime) -> Optional[str]:
        if target_type.upper() == utils.TemporalType.DATETIME:
            return f"""CAST('{dttm.isoformat(timespec="seconds")}' AS DATETIME)"""
        return None


class OpenDistroEngineSpec(BaseEngineSpec):  # pylint: disable=abstract-method

    time_groupby_inline = True
    time_secondary_columns = True
    allows_joins = False
    allows_subqueries = True
    allows_sql_comments = False

    _time_grain_expressions = {
        None: "{col}",
        "PT1S": "date_format({col}, 'yyyy-MM-dd HH:mm:ss.000')",
        "PT1M": "date_format({col}, 'yyyy-MM-dd HH:mm:00.000')",
        "PT1H": "date_format({col}, 'yyyy-MM-dd HH:00:00.000')",
        "P1D": "date_format({col}, 'yyyy-MM-dd 00:00:00.000')",
        "P1M": "date_format({col}, 'yyyy-MM-01 00:00:00.000')",
        "P1Y": "date_format({col}, 'yyyy-01-01 00:00:00.000')",
    }

    engine = "odelasticsearch"
    engine_name = "ElasticSearch (OpenDistro SQL)"

    @classmethod
    def convert_dttm(cls, target_type: str, dttm: datetime) -> Optional[str]:
        if target_type.upper() == utils.TemporalType.DATETIME:
            return f"""'{dttm.isoformat(timespec="seconds")}'"""
        return None

    @staticmethod
    def _mutate_label(label: str) -> str:
        return label.replace(".", "_")
