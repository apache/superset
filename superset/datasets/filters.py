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


from flask_babel import lazy_gettext as _
from sqlalchemy import not_, or_
from sqlalchemy.orm.query import Query

from superset.connectors.sqla.models import SqlaTable
from superset.subjects.filters import EditableFilter
from superset.subjects.models import sqlatable_editors
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


class DatasetEditableFilter(EditableFilter):  # pylint: disable=too-few-public-methods
    """Filter for datasets the user can edit."""

    model = SqlaTable
    editors_table = sqlatable_editors
    editors_fk_column = "table_id"


class DatasetDeletedStateFilter(  # pylint: disable=too-few-public-methods
    BaseDeletedStateFilter
):
    """Rison filter for the GET list that exposes soft-deleted datasets.

    Soft-deleted rows are scoped to the **restore audience** (editors or
    admins) by ``BaseDeletedStateFilter._scope_to_restore_audience`` — the
    cross-entity contract lives on the base, so this class is a pure
    declaration. Live rows keep their normal ``DatasourceFilter``
    visibility.
    """

    arg_name = "dataset_deleted_state"
    model = SqlaTable
