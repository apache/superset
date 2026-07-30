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
Admin RBAC.
"""

import logging
from uuid import UUID

import click
from flask.cli import with_appcontext

logger = logging.getLogger(__name__)

#: Operator-facing entity names mapped to their table. Kept as table names
#: rather than model classes so building the ``--type`` choices costs no model
#: imports at CLI start-up; the class is resolved when the option is used.
_PURGE_TYPES: dict[str, str] = {
    "chart": "slices",
    "dashboard": "dashboards",
    "dataset": "tables",
}


def _resolve_model(entity_type: str | None) -> type | None:
    """Map a ``--type`` value to its soft-delete model, or ``None`` for all.

    ``None`` preserves the default search across every registered model, which
    is what an operator holding only a UUID has to start from.
    """
    if entity_type is None:
        return None
    from superset.models.helpers import SoftDeleteMixin

    table = _PURGE_TYPES[entity_type.lower()]
    for model in SoftDeleteMixin._registered_subclasses:  # noqa: SLF001
        if getattr(model, "__tablename__", None) == table:
            return model
    # Unreachable while _PURGE_TYPES tracks the registered models; a mismatch
    # means a model was renamed or dropped without updating the map.
    raise click.ClickException(
        f"No soft-delete model is registered for type {entity_type!r}."
    )


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
    """Set the per-deployment retention window (SharedKey, upsert)."""
    from superset.key_value.shared_entries import upsert_shared_value
    from superset.key_value.types import SharedKey

    if days < 0:
        raise click.BadParameter("--days must be >= 0")
    upsert_shared_value(SharedKey.SOFT_DELETE_RETENTION_DAYS, days)
    click.echo(
        f"Soft-delete retention window set to {days} day(s) for this deployment."
    )


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
    "--uuid",
    "-u",
    "uuid",
    required=True,
    # Validate up front: a malformed value must fail with a clean
    # BadParameter message, not a StatementError traceback after the
    # operator has already confirmed an irreversible prompt.
    type=click.UUID,
    help="UUID of the entity to purge.",
)
@click.option(
    "--type",
    "-t",
    "entity_type",
    type=click.Choice(sorted(_PURGE_TYPES), case_sensitive=False),
    default=None,
    help=(
        "Restrict the purge to one entity type. UUIDs are unique per table "
        "but not across them, so a bare UUID can match more than one entity; "
        "the purge refuses to guess and asks for this option."
    ),
)
@click.confirmation_option(
    prompt="Force-purge is irreversible — the entity and its version history "
    "will be permanently removed. Continue?"
)
def force_purge(uuid: UUID, entity_type: str | None) -> None:
    """Immediately and irreversibly purge an entity by UUID (compliance)."""
    from superset.commands.deletion_retention.force_purge import (
        AmbiguousPurgeTargetError,
        ForcePurgeCommand,
    )

    try:
        result = ForcePurgeCommand(
            str(uuid), model_cls=_resolve_model(entity_type)
        ).run()
    except AmbiguousPurgeTargetError as ex:
        # The command refuses to guess between tables. Report that as a clean
        # operator error naming the way out, not as a traceback -- this lands
        # after the irreversible confirmation prompt has already been answered.
        raise click.ClickException(
            f"{ex} Re-run with --type, e.g. --type {sorted(_PURGE_TYPES)[0]}."
        ) from ex
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
