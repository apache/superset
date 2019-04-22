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

import unittest
import datetime

from superset.hive_query import (
    get_gran_value_in_seconds,
    get_partitioned_query_format,
    get_partitioned_whereclause,
    replace_whereclause_in_org_sql,
)

class HivePartitionQueryTestCase(unittest.TestCase):

    def test_get_gran_value_in_seconds(self):
        t_p_2 = {
            "year":"y",
            "month":"m",
            "day":"d",
        }
        self.assertEqual(get_gran_value_in_seconds('PT1H',t_p_2),86400)

        t_p_4 = {
            "year":"y",
            "month":"m",
            "day":"d",
            "hour":"hr"
        }
        self.assertEqual(get_gran_value_in_seconds('PT1H',t_p_4),3600)

        t_p_5 = {
            "year":"y",
            "month":"m",
            "day":"d",
            "hour":"hr",
        }
        self.assertEqual(get_gran_value_in_seconds('P1D',t_p_5),86400)

    def test_get_partitioned_query_format(self):
        t_p_1 = {
            "year":"y"
        }
        self.assertEqual(get_partitioned_query_format(t_p_1),"( y = %Y )")
        t_p_2 = {
            "year":"y",
            "month":"m"
        }
        self.assertEqual(get_partitioned_query_format(t_p_2),"( y = %Y AND m = %m )")

        t_p_3 = {
            "year":"y",
            "month":"m",
            "day":"d",
        }
        self.assertEqual(get_partitioned_query_format(t_p_3),"( y = %Y AND m = %m AND d = %d )")

        t_p_4 = {
            "year":"y",
            "month":"m",
            "day":"d",
            "hour":"hr"
        }
        self.assertEqual(get_partitioned_query_format(t_p_4),"( y = %Y AND m = %m AND d = %d AND hr = %H )")

        t_p_5 = {
            "year":"y",
            "month":"m",
            "day":"d",
            "hour":"hr",
            "minute":"min"
        }
        self.assertEqual(get_partitioned_query_format(t_p_5),"( y = %Y AND m = %m AND d = %d AND hr = %H AND min = %M )")
        t_p_6 = {
            "month":"m",
            "day":"d",
            "hour":"hr",
        }
        self.assertEqual(get_partitioned_query_format(t_p_6),"( m = %m AND d = %d AND hr = %H )")

    def test_get_partitioned_whereclause(self):
        from_date_time_str = '2019-01-01 10:00:00'
        from_date_time_obj = datetime.datetime.strptime(from_date_time_str, '%Y-%m-%d %H:%M:%S')   
        to_date_time_str = '2019-01-01 11:00:00'
        to_date_time_obj = datetime.datetime.strptime(to_date_time_str, '%Y-%m-%d %H:%M:%S') 
        t_p_5 = {
            "year":"y",
            "month":"m",
            "day":"d",
            "hour":"hr",
        }
        grain =  get_gran_value_in_seconds('PT1H',t_p_5)
        updated_sql = "( y = 2019 AND m = 01 AND d = 01 AND hr = 10 )" 
        self.assertEqual(get_partitioned_whereclause(from_date_time_obj,to_date_time_obj,grain,t_p_5),updated_sql)

    def test_replace_whereclause_in_org_sql(self):
        granularity = 'timestamp'
        sql = "WHERE `timestamp` >= '20190411000000' AND `timestamp` <= '20190412000000' AND `c_call_completed` >= 2"
        where_clause = "( y = 2019 AND m = 01 AND d = 01 AND hr = 10 )" 
        response = " WHERE ( y = 2019 AND m = 01 AND d = 01 AND hr = 10 ) AND  `timestamp` >= '20190411000000' AND `timestamp` <= '20190412000000' AND `c_call_completed` >= 2"
        self.assertEqual(replace_whereclause_in_org_sql(granularity, sql, where_clause, False),response)

        sql = "WHERE `timestamp` >= 20190411000000 AND `timestamp` <= 20190412000000 AND `c_call_completed` >= 2"
        response_1 = "WHERE ( y = 2019 AND m = 01 AND d = 01 AND hr = 10 ) \n AND `c_call_completed` >= 2"
        self.assertEqual(replace_whereclause_in_org_sql(granularity, sql, where_clause, True),response_1)



