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

import logging
import uuid
from typing import Any, Union

from sqlalchemy import and_, func, literal, or_, select
from sqlalchemy.orm import joinedload
from sqlalchemy.sql import Select

from superset import db, security_manager
from superset.connectors.sqla import models as sqla_models
from superset.connectors.sqla.models import SqlaTable
from superset.daos.base import BaseDAO
from superset.daos.exceptions import (
    DatasourceNotFound,
    DatasourceTypeNotSupportedError,
    DatasourceValueIsIncorrect,
)
from superset.models.sql_lab import Query, SavedQuery
from superset.semantic_layers.models import SemanticView
from superset.utils.core import DatasourceType
from superset.utils.filters import get_dataset_access_filters

logger = logging.getLogger(__name__)

Datasource = Union[SqlaTable, Query, SavedQuery, SemanticView]


def _escape_ilike_fragment(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


class DatasourceDAO(BaseDAO[Datasource]):
    sources: dict[Union[DatasourceType, str], type[Datasource]] = {
        DatasourceType.TABLE: SqlaTable,
        DatasourceType.QUERY: Query,
        DatasourceType.SAVEDQUERY: SavedQuery,
        DatasourceType.SEMANTIC_VIEW: SemanticView,
    }

    @classmethod
    def get_datasource(
        cls,
        datasource_type: Union[DatasourceType, str],
        database_id_or_uuid: int | str,
    ) -> Datasource:
        if datasource_type not in cls.sources:
            raise DatasourceTypeNotSupportedError()

        model = cls.sources[datasource_type]

        if str(database_id_or_uuid).isdigit():
            filter = model.id == int(database_id_or_uuid)
        else:
            try:
                uuid.UUID(str(database_id_or_uuid))  # uuid validation
                filter = model.uuid == database_id_or_uuid
            except ValueError as err:
                logger.warning(
                    "database_id_or_uuid %s isn't valid uuid", database_id_or_uuid
                )
                raise DatasourceValueIsIncorrect() from err

        datasource = (
            db.session.query(cls.sources[datasource_type]).filter(filter).one_or_none()
        )

        if not datasource:
            logger.warning(
                "Datasource not found datasource_type: %s, database_id_or_uuid: %s",
                datasource_type,
                database_id_or_uuid,
            )
            raise DatasourceNotFound()

        return datasource

    @staticmethod
    def build_dataset_query(
        name_filter: str | None,
        sql_filter: bool | None,
    ) -> Select:
        """Build a SELECT for datasets, applying access and content filters."""
        ds_q = select(
            SqlaTable.id.label("item_id"),
            literal("database").label("source_type"),
            SqlaTable.changed_on,
            SqlaTable.table_name,
        ).select_from(SqlaTable.__table__)

        if not security_manager.can_access_all_datasources():
            ds_q = ds_q.join(
                sqla_models.Database,
                sqla_models.Database.id == SqlaTable.database_id,
            )
            ds_q = ds_q.where(get_dataset_access_filters(SqlaTable))

        if name_filter:
            escaped = _escape_ilike_fragment(name_filter)
            ds_q = ds_q.where(SqlaTable.table_name.ilike(f"%{escaped}%", escape="\\"))

        if sql_filter is not None:
            if sql_filter:
                ds_q = ds_q.where(or_(SqlaTable.sql.is_(None), SqlaTable.sql == ""))
            else:
                ds_q = ds_q.where(and_(SqlaTable.sql.isnot(None), SqlaTable.sql != ""))

        return ds_q

    @staticmethod
    def build_semantic_view_query(name_filter: str | None) -> Select:
        """Build a SELECT for semantic views, applying name filter."""
        sv_q = select(
            SemanticView.id.label("item_id"),
            literal("semantic_layer").label("source_type"),
            SemanticView.changed_on,
            SemanticView.name.label("table_name"),
        ).select_from(SemanticView.__table__)

        if name_filter:
            escaped = _escape_ilike_fragment(name_filter)
            sv_q = sv_q.where(SemanticView.name.ilike(f"%{escaped}%", escape="\\"))

        return sv_q

    @staticmethod
    def paginate_combined_query(
        combined: Any,
        order_column: str,
        order_direction: str,
        page: int,
        page_size: int,
    ) -> tuple[int, list[Any]]:
        """Count, sort, and paginate the combined dataset/semantic-view query."""
        sort_col_map = {
            "changed_on": "changed_on",
            "changed_on_delta_humanized": "changed_on",
            "table_name": "table_name",
        }
        if order_column not in sort_col_map:
            raise ValueError(f"Invalid order column: {order_column}")
        sort_col_name = sort_col_map[order_column]

        total_count = (
            db.session.execute(select(func.count()).select_from(combined)).scalar() or 0
        )

        sort_col = combined.c[sort_col_name]
        ordered_col = sort_col.desc() if order_direction == "desc" else sort_col.asc()

        rows = db.session.execute(
            select(combined.c.item_id, combined.c.source_type)
            .order_by(ordered_col)
            .offset(page * page_size)
            .limit(page_size)
        ).fetchall()

        return total_count, rows

    @staticmethod
    def fetch_datasets_by_ids(ids: list[int]) -> dict[int, SqlaTable]:
        """Fetch SqlaTable objects by id with relationships eager-loaded."""
        if not ids:
            return {}
        objs = (
            db.session.query(SqlaTable)
            .options(
                joinedload(SqlaTable.database),
                joinedload(SqlaTable.owners),
                joinedload(SqlaTable.changed_by),
            )
            .filter(SqlaTable.id.in_(ids))
            .all()
        )
        return {obj.id: obj for obj in objs}

    @staticmethod
    def fetch_semantic_views_by_ids(ids: list[int]) -> dict[int, SemanticView]:
        """Fetch SemanticView objects by id with relationships eager-loaded."""
        if not ids:
            return {}
        objs = (
            db.session.query(SemanticView)
            .options(joinedload(SemanticView.changed_by))
            .filter(SemanticView.id.in_(ids))
            .all()
        )
        return {obj.id: obj for obj in objs}
