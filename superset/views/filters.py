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
from typing import Any, cast, Optional

from flask_appbuilder.models.filters import BaseFilter
from flask_babel import lazy_gettext
from sqlalchemy import or_
from sqlalchemy.orm import Query

from superset import security_manager

# pylint: disable=too-few-public-methods


class FilterRelatedOwners(BaseFilter):
    """
    A filter to allow searching for related owners of a resource.

    Use in the api by adding something like:
    related_field_filters = {
      "owners": RelatedFieldFilter("first_name", FilterRelatedOwners),
    }
    """

    name = lazy_gettext("Owner")
    arg_name = "owners"

    def apply(self, query: Query, value: Optional[Any]) -> Query:
        user_model = security_manager.user_model
        like_value = "%" + cast(str, value) + "%"
        return query.filter(
            or_(
                # could be made to handle spaces between names more gracefully
                (user_model.first_name + " " + user_model.last_name).ilike(like_value),
                user_model.username.ilike(like_value),
            )
        )
