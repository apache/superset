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

import click
from flask.cli import with_appcontext

from superset.extensions import db
from superset.utils.rls import collect_rls_predicates_for_sql

logger = logging.getLogger(__name__)


@click.group()
def rls() -> None:
    """Row Level Security discovery utilities."""


@rls.command()
@with_appcontext
def find_at_risk() -> None:
    """List charts and saved queries whose ad-hoc SQL over governed tables
    will be filtered or denied once fail-closed RLS enforcement is active.

    Read-only discovery: it never mutates metadata and offers no option to
    disable enforcement.
    """
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.slice import Slice
    from superset.models.sql_lab import SavedQuery

    governed_table_ids: set[int] = set()
    for table in db.session.query(SqlaTable).filter(SqlaTable.sql.isnot(None)).all():
        if _governed(table.sql, table):
            governed_table_ids.add(table.id)

    at_risk_charts = [
        chart
        for chart in db.session.query(Slice)
        .filter(Slice.datasource_type == "table")
        .all()
        if chart.datasource_id in governed_table_ids
    ]

    at_risk_queries = [
        query
        for query in db.session.query(SavedQuery)
        .filter(SavedQuery.sql.isnot(None))
        .all()
        if query.database is not None and _governed(query.sql, query)
    ]

    click.secho(
        f"Found {len(at_risk_charts)} at-risk chart(s) and "
        f"{len(at_risk_queries)} at-risk saved quer(ies).",
        fg="yellow",
    )
    for chart in at_risk_charts:
        click.echo(f"  chart id={chart.id} name={chart.slice_name}")
    for query in at_risk_queries:
        click.echo(f"  saved_query id={query.id} label={query.label}")


def _governed(sql: str | None, source: object) -> bool:
    if not sql:
        return False
    database = source.database
    schema = source.schema or database.get_default_schema(source.catalog) or ""
    predicates = collect_rls_predicates_for_sql(
        sql,
        database,
        source.catalog,
        schema,
    )
    return bool(predicates)
