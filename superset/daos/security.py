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

from typing import Optional

from superset.connectors.sqla.models import RowLevelSecurityFilter
from superset.daos.base import BaseDAO
from superset.extensions import db


class RLSDAO(BaseDAO[RowLevelSecurityFilter]):
    @classmethod
    def validate_uniqueness(cls, name: str, rule_id: Optional[int] = None) -> bool:
        """
        Validate that the RLS rule name is unique.

        :param name: RLS rule name
        :param rule_id: id of the rule being updated, excluded from the check so
            that saving a rule without renaming it is not treated as a collision
        :return: True if the name is unique, False otherwise
        """
        query = db.session.query(RowLevelSecurityFilter).filter(
            RowLevelSecurityFilter.name == name
        )
        if rule_id is not None:
            query = query.filter(RowLevelSecurityFilter.id != rule_id)
        return not db.session.query(query.exists()).scalar()
