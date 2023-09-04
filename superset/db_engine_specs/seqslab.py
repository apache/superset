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

"""
Superset db engine specs for SeqsLab
"""
from superset.db_engine_specs import BaseEngineSpec
from superset.db_engine_specs.hive import HiveEngineSpec
from superset.exceptions import SupersetException
from superset import sql_parse


class SeqsLabHiveEngineSpec(HiveEngineSpec):
    engine_name = "Atgenomix SeqsLab Interactive Job"

    engine = "seqslab"
    drivers = {"hive": "Hive driver for SeqsLab interactive job"}
    default_driver = "hive"

    _show_functions_column = "function"

    _time_grain_expressions = {
        None: "{col}",
        "PT1S": "date_trunc('second', {col})",
        "PT1M": "date_trunc('minute', {col})",
        "PT1H": "date_trunc('hour', {col})",
        "P1D": "date_trunc('day', {col})",
        "P1W": "date_trunc('week', {col})",
        "P1M": "date_trunc('month', {col})",
        "P3M": "date_trunc('quarter', {col})",
        "P1Y": "date_trunc('year', {col})",
        "P1W/1970-01-03T00:00:00Z": "date_trunc('week', {col} + interval '1 day') + interval '5 days'",
        "1969-12-28T00:00:00Z/P1W": "date_trunc('week', {col} + interval '1 day') - interval '1 day'",
    }

    @staticmethod
    def execute(  # type: ignore
        cursor, query: str, **kwargs
    ):  # pylint: disable=arguments-differ
        if not BaseEngineSpec.is_readonly_query(sql_parse.ParsedQuery(query)):
            raise SupersetException("DML operation is currently not supported")
        HiveEngineSpec.execute(cursor, query, **kwargs)
