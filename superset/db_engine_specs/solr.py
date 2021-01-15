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

from superset.db_engine_specs.base import BaseEngineSpec


class SolrEngineSpec(BaseEngineSpec):  # pylint: disable=abstract-method
    """Engine spec for Apache Solr"""

    engine = "solr"
    engine_name = "Apache Solr"

    time_groupby_inline = False
    time_secondary_columns = False
    allows_joins = False
    allows_subqueries = False

    _time_grain_expressions = {
        None: "{col}",
    }
