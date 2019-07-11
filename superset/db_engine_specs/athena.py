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
# pylint: disable=C,R,W
from superset.db_engine_specs.base import BaseEngineSpec


class AthenaEngineSpec(BaseEngineSpec):
    engine = "awsathena"

    time_grain_functions = {
        None: "{col}",
        "PT1S": "date_trunc('second', CAST({col} AS TIMESTAMP))",
        "PT1M": "date_trunc('minute', CAST({col} AS TIMESTAMP))",
        "PT1H": "date_trunc('hour', CAST({col} AS TIMESTAMP))",
        "P1D": "date_trunc('day', CAST({col} AS TIMESTAMP))",
        "P1W": "date_trunc('week', CAST({col} AS TIMESTAMP))",
        "P1M": "date_trunc('month', CAST({col} AS TIMESTAMP))",
        "P0.25Y": "date_trunc('quarter', CAST({col} AS TIMESTAMP))",
        "P1Y": "date_trunc('year', CAST({col} AS TIMESTAMP))",
        "P1W/1970-01-03T00:00:00Z": "date_add('day', 5, date_trunc('week', \
                                    date_add('day', 1, CAST({col} AS TIMESTAMP))))",
        "1969-12-28T00:00:00Z/P1W": "date_add('day', -1, date_trunc('week', \
                                    date_add('day', 1, CAST({col} AS TIMESTAMP))))",
    }

    @classmethod
    def convert_dttm(cls, target_type, dttm):
        tt = target_type.upper()
        if tt == "DATE":
            return "from_iso8601_date('{}')".format(dttm.isoformat()[:10])
        if tt == "TIMESTAMP":
            return "from_iso8601_timestamp('{}')".format(dttm.isoformat())
        return "CAST ('{}' AS TIMESTAMP)".format(dttm.strftime("%Y-%m-%d %H:%M:%S"))

    @classmethod
    def epoch_to_dttm(cls):
        return "from_unixtime({col})"

    @staticmethod
    def mutate_label(label):
        """
        Athena only supports lowercase column names and aliases.
        :param str label: Original label which might include uppercase letters
        :return: String that is supported by the database
        """
        return label.lower()
