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

from flask_babel import lazy_gettext as _
from sqlalchemy import not_, or_
from sqlalchemy.orm.query import Query

from superset import security_manager
from superset.connectors.sqla.models import SqlaTable
from superset.utils.core import get_user_id
from superset.views.base import BaseFilter
from superset.views.filters import BaseDeletedStateFilter


class DatasetIsNullOrEmptyFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    name = _("Null or Empty")
    arg_name = "dataset_is_null_or_empty"

    def apply(self, query: Query, value: bool) -> Query:
        filter_clause = or_(SqlaTable.sql.is_(None), SqlaTable.sql == "")

        if not value:
            filter_clause = not_(filter_clause)

        return query.filter(filter_clause)


class DatasetCertifiedFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    name = _("Is certified")
    arg_name = "dataset_is_certified"

    def apply(self, query: Query, value: bool) -> Query:
        check_value = '%"certification":%'
        if value is True:
            return query.filter(SqlaTable.extra.ilike(check_value))
        if value is False:
            return query.filter(
                or_(
                    SqlaTable.extra.notlike(check_value),
                    SqlaTable.extra.is_(None),
                )
            )
        return query


class DatasetDeletedStateFilter(  # pylint: disable=too-few-public-methods
    BaseDeletedStateFilter
):
    """Rison filter for the GET list that exposes soft-deleted datasets.

    Soft-deleted rows are additionally scoped to the **restore audience**: only
    the dataset's owners (or admins) may enumerate them. This mirrors
    ``RestoreDatasetCommand``'s ``raise_for_ownership`` check, so a read-access
    non-owner (who can see the dataset via ``datasource_access``) cannot list
    soft-deleted datasets they could never restore. Live rows are unaffected —
    they keep their normal ``DatasourceFilter`` visibility. Kept consistent with
    ``DashboardDeletedStateFilter`` and ``ChartDeletedStateFilter``.
    """

    arg_name = "dataset_deleted_state"
    model = SqlaTable

    def apply(self, query: Query, value: Any) -> Query:
        query = super().apply(query, value)
        normalized = str(value).lower().strip() if value is not None else ""
        if normalized not in {"include", "only"} or security_manager.is_admin():
            return query

        # Non-admins may only see soft-deleted datasets they own. ``any()`` emits
        # an EXISTS subquery so it composes with the base access filter without
        # producing duplicate rows from a join.
        owned = SqlaTable.owners.any(security_manager.user_model.id == get_user_id())
        if normalized == "only":
            # ``super().apply`` already restricted to ``deleted_at IS NOT NULL``.
            return query.filter(owned)
        # ``include``: keep all live rows (normal access) and add only the
        # soft-deleted rows this user owns.
        return query.filter(or_(SqlaTable.deleted_at.is_(None), owned))
