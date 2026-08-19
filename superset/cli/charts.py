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
"""CLI commands for charts (Apache Superset #33615)."""

from __future__ import annotations

import logging
from typing import Any, Optional

import click
from flask.cli import with_appcontext

logger = logging.getLogger(__name__)


@click.group()
def charts() -> None:
    """Chart-related maintenance commands."""


def _derive_query_context(chart: Any, generator: Any) -> Optional[dict[str, Any]]:
    """
    Derive a ``query_context`` config for ``chart``, or ``None`` if non-derivable.

    Prefers the authoritative frontend ``buildQuery`` (V8) and falls back to the
    pure-Python generic derivation; the datasource is taken from the chart's own
    resolved id/type, never from ``params`` (authz-preserving).
    """
    from superset.commands.chart.query_context_builder import (
        build_query_context_config,
    )
    from superset.utils import json

    params = json.loads(chart.params) if chart.params else {}
    if not isinstance(params, dict):
        params = {}
    datasource_id = chart.datasource_id
    datasource_type = chart.datasource_type or "table"

    context = None
    if datasource_id:
        js_params = {
            **params,
            "datasource": f"{datasource_id}__{datasource_type}",
        }
        context = generator.generate(chart.viz_type, js_params)
    if context is None:
        context = build_query_context_config(
            params, chart.viz_type, datasource_id, datasource_type
        )
    return context


@charts.command("backfill-query-context")
@with_appcontext
@click.option(
    "--dry-run",
    is_flag=True,
    default=False,
    help="Report what would change without writing.",
)
@click.option(
    "--viz-type",
    "viz_types",
    multiple=True,
    help="Restrict to these viz types (repeatable). Default: all.",
)
@click.option(
    "--batch-size",
    type=int,
    default=200,
    show_default=True,
    help="Commit every N updated charts.",
)
def backfill_query_context(
    dry_run: bool, viz_types: tuple[str, ...], batch_size: int
) -> None:
    """
    Backfill a synthesized ``query_context`` on saved charts that have none.

    Repairs charts imported before the import-time synthesis landed (issue
    #33615): each chart with ``query_context IS NULL`` gets a context derived
    from its ``params`` + datasource — authoritatively via the frontend
    ``buildQuery`` (V8) when available, else the pure-Python generic derivation.
    Non-derivable charts are left untouched (never a fabricated context).
    """
    # Imported lazily so the module imports cleanly without an app context.
    from superset.commands.chart.query_context_generator import (
        get_query_context_generator,
    )
    from superset.extensions import db
    from superset.models.slice import Slice
    from superset.utils import json

    generator = get_query_context_generator()

    # `enable_eagerloads(False)` is required for `yield_per`: Slice has eager
    # (joined) collection relationships that otherwise raise
    # "Can't use yield_per with eager loaders that require uniquing/buffering".
    query = (
        db.session.query(Slice)
        .filter(Slice.query_context.is_(None))
        .enable_eagerloads(False)
    )
    if viz_types:
        query = query.filter(Slice.viz_type.in_(viz_types))

    updated = 0
    non_derivable = 0
    errors = 0
    pending = 0

    for chart in query.yield_per(batch_size):
        try:
            context = _derive_query_context(chart, generator)
        except Exception as ex:  # pylint: disable=broad-except
            errors += 1
            logger.warning(
                "backfill-query-context: chart id=%s failed: %s", chart.id, ex
            )
            continue

        if context is None:
            non_derivable += 1
            continue

        updated += 1
        if dry_run:
            continue

        chart.query_context = json.dumps(context)
        pending += 1
        if pending >= batch_size:
            db.session.commit()  # pylint: disable=consider-using-transaction
            pending = 0

    if not dry_run and pending:
        db.session.commit()  # pylint: disable=consider-using-transaction

    prefix = "[dry-run] would update" if dry_run else "updated"
    click.echo(
        f"backfill-query-context: {prefix} {updated}, "
        f"non-derivable (left null) {non_derivable}, errors {errors}."
    )
