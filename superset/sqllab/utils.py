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
from typing import Any, Dict

from superset.common.db_query_status import QueryStatus


def apply_display_max_row_configuration_if_require(  # pylint: disable=invalid-name
    sql_results: Dict[str, Any], max_rows_in_result: int
) -> Dict[str, Any]:
    """
    Given a `sql_results` nested structure, applies a limit to the number of rows

    `sql_results` here is the nested structure coming out of sql_lab.get_sql_results, it
    contains metadata about the query, as well as the data set returned by the query.
    This method limits the number of rows adds a `displayLimitReached: True` flag to the
    metadata.

    :param max_rows_in_result:
    :param sql_results: The results of a sql query from sql_lab.get_sql_results
    :returns: The mutated sql_results structure
    """

    def is_require_to_apply() -> bool:
        return (
            sql_results["status"] == QueryStatus.SUCCESS
            and sql_results["query"]["rows"] > max_rows_in_result
        )

    if is_require_to_apply():
        sql_results["data"] = sql_results["data"][:max_rows_in_result]
        sql_results["displayLimitReached"] = True
    return sql_results
