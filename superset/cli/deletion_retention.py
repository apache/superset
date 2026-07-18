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
"""Operator CLI for deletion retention.

``force-purge`` and ``set-window`` are **operator-gated** — they are
protected by deployment/shell access (the ``SECURITY.md`` operator trust
boundary), not Flask-AppBuilder RBAC: a CLI invocation has no ``g.user``, so
there is no ``403`` to enforce. A future REST route would carry real
Admin/workspace-admin RBAC.
"""

import logging

import click
from flask.cli import with_appcontext

logger = logging.getLogger(__name__)


@click.group()
def deletion_retention() -> None:
    """Manage purge of soft-deleted entities (operator-gated)."""


@deletion_retention.command()
@with_appcontext
@click.option(
    "--days",
    "-d",
    required=True,
    type=int,
    help="Retention window in days; 0 disables.",
)
def set_window(days: int) -> None:
    """Set the per-workspace retention window (SharedKey, upsert)."""
    from superset.key_value.shared_entries import upsert_shared_value
    from superset.key_value.types import SharedKey

    if days < 0:
        raise click.BadParameter("--days must be >= 0")
    upsert_shared_value(SharedKey.SOFT_DELETE_RETENTION_DAYS, days)
    click.echo(f"Soft-delete retention window set to {days} day(s) for this workspace.")


@deletion_retention.command()
@with_appcontext
def show_window() -> None:
    """Print the effective retention window (shared value or env fallback)."""
    from superset.commands.deletion_retention.window import resolve_retention_window

    days = resolve_retention_window()
    state = "disabled" if days == 0 else f"{days} day(s)"
    click.echo(f"Effective soft-delete retention window: {state}.")


@deletion_retention.command()
@with_appcontext
@click.option(
    "--uuid", "-u", "uuid", required=True, help="UUID of the entity to purge."
)
@click.confirmation_option(
    prompt="Force-purge is irreversible — the entity and its version history "
    "will be permanently removed. Continue?"
)
def force_purge(uuid: str) -> None:
    """Immediately and irreversibly purge an entity by UUID (compliance)."""
    from superset.commands.deletion_retention.force_purge import ForcePurgeCommand

    result = ForcePurgeCommand(uuid).run()
    if not result.get("purged"):
        if result.get("reason") == "blocked":
            click.echo(
                f"Entity uuid={uuid} was not purged because existing deletion "
                f"rules block it: {result.get('blocked_reason')}."
            )
        else:
            click.echo(f"No entity found for uuid={uuid} (nothing to purge).")
        return
    click.echo(
        f"Purged {result['entity_type']} uuid={uuid}. "
        f"Dangling charts: {len(result.get('dangling_chart_uuids') or [])}; "
        f"dashboard_slices removed: {result.get('removed_dashboard_slices', 0)}; "
        f"version rows removed: {result.get('version_rows_removed', 0)}."
    )
