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
from superset.db_engine_specs.base import BaseEngineSpec, LimitMethod


class TeradataEngineSpec(BaseEngineSpec):
    """Dialect for Teradata DB."""

    engine = "teradata"
    engine_name = "Teradata"
    limit_method = LimitMethod.WRAP_SQL
    max_column_name_length = 30  # since 14.10 this is 128

    _time_grain_expressions = {
        None: "{col}",
        "PT1M": "TRUNC(CAST({col} as DATE), 'MI')",
        "PT1H": "TRUNC(CAST({col} as DATE), 'HH')",
        "P1D": "TRUNC(CAST({col} as DATE), 'DDD')",
        "P1W": "TRUNC(CAST({col} as DATE), 'WW')",
        "P1M": "TRUNC(CAST({col} as DATE), 'MONTH')",
        "P0.25Y": "TRUNC(CAST({col} as DATE), 'Q')",
        "P1Y": "TRUNC(CAST({col} as DATE), 'YEAR')",
    }
    
    @classmethod
    def get_dbapi_exception_mapping(cls) -> Dict[Type[Exception], Type[Exception]]:
    def apply_limit_to_sql(
        cls, sql: str, limit: int, database: "Database", force: bool = False
) -> str:
        """
        Alters the SQL statement to apply a LIMIT clause
        :param sql: SQL query
        :param limit: Maximum number of rows to be returned by the query
        :param database: Database instance
        :return: SQL query with limit clause
        """
        # TODO: Fix circular import caused by importing Database

        if LimitMethod.FORCE_LIMIT:
            engine = cls.get_engine(database)
            url_type = str(engine.url).split(':')[0]
            parsed_query = sql_parse.ParsedQuery(sql, uri_type = url_type)
            if url_type in ['teradatasql','teradata']:
                sql = parsed_query.set_or_update_query_limit_top(limit)
            else:
                sql = parsed_query.set_or_update_query_limit(limit)

        return {sql}

    @classmethod
    def get_dbapi_mapped_exception(cls, exception: Exception) -> Exception:
        engine = cls.get_engine(database)
        url_type = str(engine.url).split(':')[0]
        parsed_query = sql_parse.ParsedQuery(sql, uri_type = url_type)
        if url_type in ['teradatasql','teradata']:
            new_exception = cls.get_dbapi_exception_mapping().get(type(exception))
        if new_exception
            return apply_limit_to_sql
            
        if not new_exception:
            return exception
        return new_exception(str(exception))




        
        

    @classmethod
    def epoch_to_dttm(cls) -> str:
        return (
            "CAST(((CAST(DATE '1970-01-01' + ({col} / 86400) AS TIMESTAMP(0) "
            "AT 0)) AT 0) + (({col} MOD 86400) * INTERVAL '00:00:01' "
            "HOUR TO SECOND) AS TIMESTAMP(0))"
        )
