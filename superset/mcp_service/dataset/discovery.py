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

"""Progressive metadata queries that never materialize dataset relationships."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import and_, func, or_

from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
from superset.daos.dataset import DatasetDAO
from superset.extensions import db
from superset.mcp_service.dataset.schemas import (
    DatasetColumnPage,
    DatasetDiscoveryColumn,
    DatasetDiscoveryMetric,
    DatasetDiscoverySource,
    DatasetDiscoverySummary,
    DatasetError,
    DatasetMetricPage,
    DatasetSummaryResponse,
    GetDatasetInfoRequest,
)
from superset.mcp_service.dataset_scope import get_dataset_scope


def discover_dataset(
    request: GetDatasetInfoRequest,
) -> DatasetSummaryResponse | DatasetColumnPage | DatasetMetricPage | DatasetError:
    """Authorize the source, then fetch a scalar summary or bounded member page.

    Apply the normal DAO filter before projection/pagination. Each call resolves
    current grants; neither a prior page nor a cached discovery grants access.
    """
    discovery = request.discovery
    if discovery is None:
        raise ValueError("A discovery request is required")
    identifier = str(request.identifier)
    if identifier.isdecimal():
        identity_filter = SqlaTable.id == int(identifier)
    else:
        try:
            identity_filter = SqlaTable.uuid == UUID(identifier)
        except ValueError:
            return DatasetError.create("Dataset not found", "not_found")

    query = db.session.query(
        SqlaTable.id,
        SqlaTable.uuid,
        SqlaTable.table_name.label("name"),
        SqlaTable.description,
        and_(SqlaTable.sql.is_not(None), SqlaTable.sql != "").label("is_virtual"),
        SqlaTable.main_dttm_col,
    ).filter(identity_filter, SqlaTable.deleted_at.is_(None))
    query = DatasetDAO._apply_base_filter(query)
    if (scope := get_dataset_scope()) is not None:
        query = query.filter(SqlaTable.uuid.in_(scope))
    row = query.one_or_none()
    if row is None:
        return DatasetError.create("Dataset not found", "not_found")
    source = DatasetDiscoverySource(id=row.id, uuid=row.uuid)
    if discovery.section == "summary":
        return DatasetSummaryResponse(
            source=source,
            summary=DatasetDiscoverySummary(
                uuid=row.uuid,
                name=row.name,
                description=row.description,
                is_virtual=row.is_virtual,
                main_dttm_col=row.main_dttm_col,
            ),
        )

    if discovery.section == "columns":
        model = TableColumn
        name = model.column_name
        members = db.session.query(
            model.column_name,
            model.verbose_name,
            model.description,
            model.type,
            func.coalesce(model.filterable, False).label("filterable"),
            func.coalesce(model.groupby, False).label("groupby"),
            func.coalesce(model.is_dttm, False).label("is_dttm"),
        )
    else:
        model = SqlMetric
        name = model.metric_name
        members = db.session.query(
            model.metric_name, model.verbose_name, model.description, model.d3format
        )
    members = members.filter(model.table_id == row.id)
    if discovery.search:
        # Escape LIKE wildcards: search means a literal substring, not a pattern.
        search = discovery.search.lower()
        members = members.filter(
            or_(
                func.lower(name).contains(search, autoescape=True),
                func.lower(model.verbose_name).contains(search, autoescape=True),
                func.lower(model.description).contains(search, autoescape=True),
            )
        )
    rows = (
        members.order_by(name, model.id)
        .offset((discovery.page - 1) * discovery.page_size)
        .limit(discovery.page_size + 1)
        .all()
    )
    has_more = len(rows) > discovery.page_size
    page_rows = rows[: discovery.page_size]
    next_page = discovery.page + 1 if has_more else None
    if discovery.section == "columns":
        return DatasetColumnPage(
            source=source,
            items=[DatasetDiscoveryColumn(**item._mapping) for item in page_rows],
            page=discovery.page,
            page_size=discovery.page_size,
            has_more=has_more,
            next_page=next_page,
        )
    return DatasetMetricPage(
        source=source,
        items=[DatasetDiscoveryMetric(**item._mapping) for item in page_rows],
        page=discovery.page,
        page_size=discovery.page_size,
        has_more=has_more,
        next_page=next_page,
    )
