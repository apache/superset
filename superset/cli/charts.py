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
    help="Number of charts to load, process, and commit per batch.",
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

    if batch_size < 1:
        raise click.BadParameter(
            "must be a positive integer", param_hint="'--batch-size'"
        )

    generator = get_query_context_generator()

    # Snapshot the candidate primary keys up front (a light id-only query), then
    # process them in stable-id pages. We must NOT stream with ``yield_per`` and
    # commit mid-iteration: on PostgreSQL the commit closes the server-side cursor,
    # so the next fetch fails and a backfill spanning more than one batch leaves the
    # remaining charts untouched (#33615 review). Paging by id means each batch is
    # its own query, so committing between batches is safe.
    id_query = db.session.query(Slice.id).filter(Slice.query_context.is_(None))
    if viz_types:
        id_query = id_query.filter(Slice.viz_type.in_(viz_types))
    chart_ids = [row[0] for row in id_query.all()]

    updated = 0
    non_derivable = 0
    errors = 0

    for start in range(0, len(chart_ids), batch_size):
        batch_ids = chart_ids[start : start + batch_size]
        for chart in db.session.query(Slice).filter(Slice.id.in_(batch_ids)):
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
            if not dry_run:
                chart.query_context = json.dumps(context)

        if not dry_run:
            db.session.commit()  # pylint: disable=consider-using-transaction
        # Keep the session (and memory) bounded across a large backfill; the next
        # page loads its own rows by id.
        db.session.expunge_all()

    prefix = "[dry-run] would update" if dry_run else "updated"
    click.echo(
        f"backfill-query-context: {prefix} {updated}, "
        f"non-derivable (left null) {non_derivable}, errors {errors}."
    )
