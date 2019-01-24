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
# pylint: disable=R
from typing import Dict, List

from superset import db
from superset.connectors.connector_registry import ConnectorRegistry
from .query_object import QueryObject


class QueryContext:
    """
    The query context contains the query object and additional fields necessary
    to retrieve the data payload for a given viz.
    """
    # TODO: Type datasource and query_object dictionary with TypedDict when it becomes
    # a vanilla python type https://github.com/python/mypy/issues/5288
    def __init__(
            self,
            datasource: Dict,
            queries: List[Dict],
    ):
        self.datasource = ConnectorRegistry.get_datasource(datasource.get('type'),
                                                           int(datasource.get('id')),
                                                           db.session)
        self.queries = list(map(lambda query_obj: QueryObject(**query_obj), queries))

    def get_data(self):
        raise NotImplementedError()
