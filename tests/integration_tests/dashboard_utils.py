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
"""Utils to provide dashboards for tests"""

from typing import Optional

from pandas import DataFrame  # noqa: F401
from sqlalchemy import or_

from superset import db
from superset.connectors.sqla.models import SqlaTable
from superset.constants import SKIP_VISIBILITY_FILTER_CLASSES
from superset.models.core import Database
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.utils import json
from superset.utils.core import DatasourceType, get_example_default_schema


def get_table(
    table_name: str,
    database: Database,
    schema: Optional[str] = None,
):
    schema = schema or get_example_default_schema()
    # Bypass the soft-delete listener so the helper finds rows previously
    # soft-deleted by other tests in the same session. Without the
    # bypass, the listener hides them and a subsequent INSERT collides
    # with the underlying ``(database_id, catalog, schema, table_name)``
    # unique constraint that survives soft-delete.
    #
    # Match rows whose catalog is either unset (NULL) or the database
    # default — these are "the same physical table" the way
    # ``DatasetDAO.validate_uniqueness`` treats them (``table.catalog or
    # default``). Example rows are seeded with ``catalog = NULL`` while a
    # connection that reports a default catalog (e.g. Postgres) would
    # normalize to that default, so both must qualify. This still excludes
    # an unrelated third catalog variant of the same table_name. Within the
    # matched set, prefer live rows over soft-deleted ones via
    # ``ORDER BY deleted_at IS NULL DESC``.
    catalog = database.get_default_catalog()
    return (
        db.session.query(SqlaTable)
        .execution_options(**{SKIP_VISIBILITY_FILTER_CLASSES: {SqlaTable}})
        .filter_by(database_id=database.id, schema=schema, table_name=table_name)
        .filter(or_(SqlaTable.catalog.is_(None), SqlaTable.catalog == catalog))
        .order_by(SqlaTable.deleted_at.is_(None).desc(), SqlaTable.id)
        .first()
    )


def create_table_metadata(
    table_name: str,
    database: Database,
    table_description: str = "",
    fetch_values_predicate: Optional[str] = None,
    schema: Optional[str] = None,
) -> SqlaTable:
    schema = schema or get_example_default_schema()

    table = get_table(table_name, database, schema)
    if not table:
        table = SqlaTable(
            schema=schema,
            table_name=table_name,
            normalize_columns=False,
            always_filter_main_dttm=False,
        )
        db.session.add(table)
    elif table.deleted_at is not None:
        # Restore a soft-deleted leftover from a prior test so the row is
        # usable for this setup. Cleaning up via re-create-then-collide
        # would fail on the underlying unique constraint that survives
        # soft-delete.
        table.deleted_at = None
    if fetch_values_predicate:
        table.fetch_values_predicate = fetch_values_predicate
    table.database = database
    table.description = table_description
    db.session.commit()

    return table


def create_slice(
    title: str, viz_type: str, table: SqlaTable, slices_dict: dict[str, str]
) -> Slice:
    return Slice(
        slice_name=title,
        viz_type=viz_type,
        datasource_type=DatasourceType.TABLE,
        datasource_id=table.id,
        params=json.dumps(slices_dict, indent=4, sort_keys=True),
    )


def create_dashboard(
    slug: str, title: str, position: str, slices: list[Slice]
) -> Dashboard:
    dash = db.session.query(Dashboard).filter_by(slug=slug).one_or_none()
    if dash:
        return dash
    dash = Dashboard()
    dash.dashboard_title = title
    if position is not None:
        js = position
        pos = json.loads(js)
        dash.position_json = json.dumps(pos, indent=4)
    dash.slug = slug
    if slices is not None:
        dash.slices = slices
    db.session.add(dash)
    db.session.commit()

    return dash
