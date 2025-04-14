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
from typing import Optional, Union

from sqlalchemy.engine.reflection import Inspector

from superset.constants import TimeGrain
from superset.db_engine_specs.base import BaseEngineSpec, LimitMethod
from superset.models.core import Database
from superset.sql_parse import Table

logger = logging.getLogger(__name__)


class Db2EngineSpec(BaseEngineSpec):
    engine = "db2"
    engine_aliases = {"ibm_db_sa"}
    engine_name = "IBM Db2"
    limit_method = LimitMethod.WRAP_SQL
    force_column_alias_quotes = True
    max_column_name_length = 30

    supports_dynamic_schema = True

    _time_grain_expressions = {
        None: "{col}",
        TimeGrain.SECOND: "CAST({col} as TIMESTAMP) - MICROSECOND({col}) MICROSECONDS",
        TimeGrain.MINUTE: "CAST({col} as TIMESTAMP)"
        " - SECOND({col}) SECONDS"
        " - MICROSECOND({col}) MICROSECONDS",
        TimeGrain.HOUR: "CAST({col} as TIMESTAMP)"
        " - MINUTE({col}) MINUTES"
        " - SECOND({col}) SECONDS"
        " - MICROSECOND({col}) MICROSECONDS ",
        TimeGrain.DAY: "CAST({col} as TIMESTAMP)"
        " - HOUR({col}) HOURS"
        " - MINUTE({col}) MINUTES"
        " - SECOND({col}) SECONDS"
        " - MICROSECOND({col}) MICROSECONDS",
        TimeGrain.WEEK: "{col} - (DAYOFWEEK({col})) DAYS",
        TimeGrain.MONTH: "{col} - (DAY({col})-1) DAYS",
        TimeGrain.QUARTER: "{col} - (DAY({col})-1) DAYS"
        " - (MONTH({col})-1) MONTHS"
        " + ((QUARTER({col})-1) * 3) MONTHS",
        TimeGrain.YEAR: "{col} - (DAY({col})-1) DAYS - (MONTH({col})-1) MONTHS",
    }

    @classmethod
    def epoch_to_dttm(cls) -> str:
        return "(TIMESTAMP('1970-01-01', '00:00:00') + {col} SECONDS)"

    @classmethod
    def get_table_comment(
        cls,
        inspector: Inspector,
        table: Table,
    ) -> Optional[str]:
        """
        Get comment of table from a given schema

        Ibm Db2 return comments as tuples, so we need to get the first element

        :param inspector: SqlAlchemy Inspector instance
        :param table: Table instance
        :return: comment of table
        """
        comment = None
        try:
            table_comment = inspector.get_table_comment(table.table, table.schema)
            comment = table_comment.get("text")
            return comment[0]
        except IndexError:
            return comment
        except Exception as ex:  # pylint: disable=broad-except
            logger.error("Unexpected error while fetching table comment", exc_info=True)
            logger.exception(ex)
            return comment

    @classmethod
    def get_prequeries(
        cls,
        database: Database,
        catalog: Union[str, None] = None,
        schema: Union[str, None] = None,
    ) -> list[str]:
        """
        Set the search path to the specified schema.

        This is important for two reasons: in SQL Lab it will allow queries to run in
        the schema selected in the dropdown, resolving unqualified table names to the
        expected schema.

        But more importantly, in SQL Lab this is used to check if the user has access to
        any tables with unqualified names. If the schema is not set by SQL Lab it could
        be anything, and we would have to block users from running any queries
        referencing tables without an explicit schema.
        """
        return [f'set current_schema "{schema}"'] if schema else []
