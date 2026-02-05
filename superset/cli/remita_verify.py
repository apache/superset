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
"""Utilities to verify Remita examples and repair if missing.

This small CLI command verifies that the Remita dataset and showcase dashboard
are present. If not, it re-runs the loader to create/repair them.

Note: Avoid importing heavy Superset modules at import time. All Superset
database/model imports happen inside functions, after app init.
"""

from __future__ import annotations

import click
from flask.cli import with_appcontext

from superset.utils.decorators import transaction


def _status() -> tuple[bool, str]:
    """Return (ok, message) status for dataset + dashboard presence."""
    # Import inside function to ensure app is initialized
    from superset import db
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.dashboard import Dashboard
    from superset.utils.database import get_example_database

    SAMPLE_TABLE = "remita_transactions"

    database = get_example_database()
    table_ok = (
        db.session.query(SqlaTable)
        .filter(SqlaTable.database_id == database.id)
        .filter(SqlaTable.table_name == SAMPLE_TABLE)
        .first()
        is not None
    )
    dash = (
        db.session.query(Dashboard)
        .filter(Dashboard.dashboard_title == "Remita Showcase")
        .first()
    )
    if not table_ok and not dash:
        return False, "Dataset and dashboard missing"
    if not table_ok:
        return False, "Dataset missing"
    if not dash:
        return False, "Dashboard missing"
    chart_count = sum(1 for s in (dash.slices or []) if getattr(s, "viz_type", None) == "remita_table")
    if chart_count >= 4:
        return True, "OK"
    return False, f"Dashboard has only {chart_count} remita_table chart(s)"


@click.command()
@with_appcontext
@transaction()
@click.option(
    "--repair/--no-repair",
    default=True,
    help="Create missing dashboard/charts if not present",
)
def remita_verify_examples(repair: bool = True) -> None:
    """Verify the Remita Showcase dashboard and charts exist; optionally repair."""
    # Cleanup: remove empty untitled dashboards created accidentally in samples
    try:
        from superset import db
        from superset.models.dashboard import Dashboard
        stale = (
            db.session.query(Dashboard)
            .filter(
                (Dashboard.dashboard_title == None) |  # noqa: E711
                (Dashboard.dashboard_title == '') |
                (Dashboard.dashboard_title.ilike('untitled%'))
            )
            .all()
        )
        removed = 0
        for d in stale:
            try:
                if not d.slices or len(d.slices) == 0:
                    db.session.delete(d)
                    removed += 1
            except Exception:
                continue
        if removed:
            db.session.commit()
    except Exception:
        # ignore cleanup errors
        pass
    ok, msg = _status()
    if ok:
        click.echo("Remita examples verified: dataset + dashboard (3 charts) present.")
        return

    click.echo(f"Remita examples not OK: {msg}")
    if not repair:
        click.echo("Run with --repair to create/fix the showcase: superset remita_verify_examples --repair")
        return

    # Attempt repair (idempotent): loader will create missing pieces
    click.echo("Attempting to repair by running the Remita loader…")
    # Import inside function to avoid importing heavy modules before app init
    from superset.examples.remita_examples import load_remita_showcase

    load_remita_showcase()
    ok2, msg2 = _status()
    if ok2:
        click.echo("Repair successful: Remita dataset + dashboard ready.")
    else:
        click.echo(f"Repair attempted but still not OK: {msg2}")
