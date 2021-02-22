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
import json


def bad_database_test_conn_request():
    return json.dumps(
        {"uri": "mssql+pymssql://url", "name": "examples", "impersonate_user": False,}
    )


def create_query_editor_request():
    return {
        "queryEditor": json.dumps(
            {
                "title": "Untitled Query 1",
                "dbId": 1,
                "schema": None,
                "autorun": False,
                "sql": "SELECT ...",
                "queryLimit": 1000,
            }
        )
    }
