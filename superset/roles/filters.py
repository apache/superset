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
from typing import Any

from flask_appbuilder.security.sqla.models import Role
from flask_babel import lazy_gettext as _
from sqlalchemy import or_
from sqlalchemy.orm.query import Query

from superset.models.reports import ReportSchedule
from superset.views.base import BaseFilter


class RoleFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    name = _("Name")
    arg_name = "by_name"

    def apply(self, query: Query, value: Any) -> Query:
        if not value:
            return query
        ilike_value = f"%{value}%"
        return query.filter(or_(Role.name.ilike(ilike_value),))
