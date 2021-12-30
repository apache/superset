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
from typing import Any, Dict, List, Optional, Type

from sqlalchemy.engine import Engine

from superset.db_engine_specs.base import BaseEngineSpec, LimitMethod
from superset.db_engine_specs.exceptions import (
    SupersetDBAPIDatabaseError,
    SupersetDBAPIOperationalError,
    SupersetDBAPIProgrammingError,
)
from superset.models.core import Database
from superset.sql_parse import ParsedQuery
from superset.utils import core as utils


class KustoKqlEngineSpec(BaseEngineSpec):  # pylint: disable=abstract-method
    limit_method = LimitMethod.WRAP_SQL
    engine = "kustokql"
    engine_name = "KustoKQL"
    time_groupby_inline = True
    time_secondary_columns = True
    allows_joins = True
    allows_subqueries = True
    allows_sql_comments = False
    run_multiple_statements_as_one = True

    _time_grain_expressions = {
        None: "{col}",
        "PT1S": "{col}/ time(1s)",
        "PT1M": "{col}/ time(1min)",
        "PT1H": "{col}/ time(1h)",
        "P1D": "{col}/ time(1d)",
        "P1M": "datetime_diff('month',CreateDate, datetime(0001-01-01 00:00:00))+1",
        "P1Y": "datetime_diff('year',CreateDate, datetime(0001-01-01 00:00:00))+1",
    }

    type_code_map: Dict[int, str] = {}  # loaded from get_datatype only if needed

    @classmethod
    def get_dbapi_exception_mapping(cls) -> Dict[Type[Exception], Type[Exception]]:
        # pylint: disable=import-outside-toplevel,import-error
        import sqlalchemy_kusto.errors as kusto_exceptions

        return {
            kusto_exceptions.DatabaseError: SupersetDBAPIDatabaseError,
            kusto_exceptions.OperationalError: SupersetDBAPIOperationalError,
            kusto_exceptions.ProgrammingError: SupersetDBAPIProgrammingError,
        }

    @classmethod
    def convert_dttm(
        cls, target_type: str, dttm: datetime, db_extra: Optional[Dict[str, Any]] = None
    ) -> Optional[str]:
        if target_type.upper() == utils.TemporalType.DATETIME:
            return f"""datetime({dttm.isoformat(timespec="seconds")})"""
        return None

    @classmethod
    def is_readonly_query(cls, parsed_query: ParsedQuery) -> bool:
        """Pessimistic readonly, 100% sure statement won't mutate anything"""
        return not parsed_query.sql.startswith(".")

    @classmethod
    def select_star(  # pylint: disable=too-many-arguments
        cls,
        database: Database,
        table_name: str,
        engine: Engine,
        schema: Optional[str] = None,
        limit: int = 100,
        show_cols: bool = False,
        indent: bool = True,
        latest_partition: bool = True,
        cols: Optional[List[Dict[str, Any]]] = None,
    ) -> str:
        return super().select_star(
            database,
            table_name,
            engine,
            None,
            limit,
            show_cols,
            indent,
            latest_partition,
            cols,
        )

    @classmethod
    def is_select_query(cls, parsed_query: ParsedQuery) -> bool:
        return not parsed_query.sql.startswith(".")

    @classmethod
    def execute(cls, cursor: Any, query: str, **kwargs: Any) -> None:
        return super().execute(cursor, query, **kwargs)

    @classmethod
    def parse_sql(cls, sql: str) -> List[str]:
        return [sql]
