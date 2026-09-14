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
"""Direct tests for the ``superset deletion-retention`` click entry points.

The command classes underneath (``ForcePurgeCommand``,
``resolve_retention_window``) have their own coverage; what was untested was
the CLI surface itself — argument and option parsing, the irreversible
confirmation prompt on ``force-purge`` (an operator-facing destructive
command, so a regression that skips or mis-wires the prompt is the serious
case), the operator-visible output the CLI is the only consumer of, and exit
codes. Everything is driven through ``CliRunner`` with the underlying command
objects mocked at their import source, so these stay unit-scoped.
"""

from __future__ import annotations

from unittest.mock import MagicMock
from uuid import UUID, uuid4

import click
import pytest
from click.testing import CliRunner
from pytest_mock import MockerFixture

from superset.cli.deletion_retention import (
    _resolve_model,
    deletion_retention,
    force_purge,
    set_window,
    show_window,
)
from superset.commands.deletion_retention.force_purge import (
    AmbiguousPurgeTargetError,
)

_UUID: UUID = uuid4()
_PROMPT: str = "Force-purge is irreversible"


# ---- group ----------------------------------------------------------------


def test_group_registers_the_three_commands(app_context: None) -> None:
    """The operator surface is exactly set-window, show-window, force-purge."""
    assert set(deletion_retention.commands) == {
        "set-window",
        "show-window",
        "force-purge",
    }


# ---- set-window -----------------------------------------------------------


@pytest.mark.parametrize("days", [30, 0, 3650])
def test_set_window_upserts_the_shared_value_and_reports_it(
    days: int, mocker: MockerFixture, app_context: None
) -> None:
    """``--days N`` is written through the shared-value upsert (0 disables)."""
    from superset.key_value.types import SharedKey

    upsert = mocker.patch("superset.key_value.shared_entries.upsert_shared_value")

    result = CliRunner().invoke(set_window, ["--days", str(days)])

    assert result.exit_code == 0, result.output
    upsert.assert_called_once_with(SharedKey.SOFT_DELETE_RETENTION_DAYS, days)
    assert f"set to {days} day(s)" in result.output


def test_set_window_short_option(mocker: MockerFixture, app_context: None) -> None:
    upsert = mocker.patch("superset.key_value.shared_entries.upsert_shared_value")

    result = CliRunner().invoke(set_window, ["-d", "7"])

    assert result.exit_code == 0, result.output
    assert upsert.call_args.args[1] == 7


def test_set_window_rejects_a_negative_window_before_writing(
    mocker: MockerFixture, app_context: None
) -> None:
    """A negative value is a usage error (exit 2) and nothing is written."""
    upsert = mocker.patch("superset.key_value.shared_entries.upsert_shared_value")

    result = CliRunner().invoke(set_window, ["--days", "-1"])

    assert result.exit_code == 2
    assert "--days must be >= 0" in result.output
    upsert.assert_not_called()


@pytest.mark.parametrize("argv", [[], ["--days", "thirty"], ["--days", "1.5"]])
def test_set_window_rejects_missing_or_non_integer_days(
    argv: list[str], mocker: MockerFixture, app_context: None
) -> None:
    """Missing or non-integer ``--days`` never reaches the upsert."""
    upsert = mocker.patch("superset.key_value.shared_entries.upsert_shared_value")

    result = CliRunner().invoke(set_window, argv)

    assert result.exit_code == 2
    upsert.assert_not_called()


# ---- show-window ----------------------------------------------------------


@pytest.mark.parametrize(
    "days, expected",
    [(30, "30 day(s)"), (1, "1 day(s)"), (0, "disabled")],
)
def test_show_window_prints_the_effective_window(
    days: int, expected: str, mocker: MockerFixture, app_context: None
) -> None:
    """The effective window is reported as days, or ``disabled`` for zero."""
    mocker.patch(
        "superset.commands.deletion_retention.window.resolve_retention_window",
        return_value=days,
    )

    result = CliRunner().invoke(show_window)

    assert result.exit_code == 0, result.output
    assert f"Effective soft-delete retention window: {expected}." in result.output


# ---- force-purge: parsing --------------------------------------------------


def _purge_command(mocker: MockerFixture, result: object) -> MagicMock:
    """Patch ``ForcePurgeCommand`` at its import source; ``run()`` -> *result*."""
    command_cls = mocker.patch(
        "superset.commands.deletion_retention.force_purge.ForcePurgeCommand"
    )
    if isinstance(result, BaseException):
        command_cls.return_value.run.side_effect = result
    else:
        command_cls.return_value.run.return_value = result
    return command_cls


def test_force_purge_rejects_a_malformed_uuid_before_the_prompt(
    mocker: MockerFixture, app_context: None
) -> None:
    """A bad ``--uuid`` fails as a clean usage error up front: the operator
    is never asked to confirm an irreversible action for an invalid target,
    and the command is never constructed."""
    command_cls = _purge_command(mocker, {"purged": True})

    result = CliRunner().invoke(force_purge, ["--uuid", "not-a-uuid", "--yes"])

    assert result.exit_code == 2
    assert "not-a-uuid" in result.output
    assert _PROMPT not in result.output
    command_cls.assert_not_called()


def test_force_purge_requires_a_uuid(mocker: MockerFixture, app_context: None) -> None:
    command_cls = _purge_command(mocker, {"purged": True})

    result = CliRunner().invoke(force_purge, ["--yes"])

    assert result.exit_code == 2
    assert "Missing option" in result.output
    command_cls.assert_not_called()


def test_force_purge_rejects_an_unknown_type(
    mocker: MockerFixture, app_context: None
) -> None:
    command_cls = _purge_command(mocker, {"purged": True})

    result = CliRunner().invoke(
        force_purge, ["--uuid", str(_UUID), "--type", "widget", "--yes"]
    )

    assert result.exit_code == 2
    assert "widget" in result.output
    command_cls.assert_not_called()


# ---- force-purge: the confirmation prompt -----------------------------------


def test_force_purge_prompts_and_aborts_on_no_answer(
    mocker: MockerFixture, app_context: None
) -> None:
    """Without ``--yes`` the irreversible prompt is shown, and an empty answer
    aborts without constructing the command."""
    command_cls = _purge_command(mocker, {"purged": True})

    result = CliRunner().invoke(force_purge, ["--uuid", str(_UUID)], input="\n")

    assert result.exit_code == 1
    assert _PROMPT in result.output
    assert "Aborted" in result.output
    command_cls.assert_not_called()


def test_force_purge_prompt_declined_does_not_purge(
    mocker: MockerFixture, app_context: None
) -> None:
    command_cls = _purge_command(mocker, {"purged": True})

    result = CliRunner().invoke(force_purge, ["--uuid", str(_UUID)], input="n\n")

    assert result.exit_code == 1
    assert "Aborted" in result.output
    command_cls.assert_not_called()


def test_force_purge_prompt_accepted_runs_the_purge(
    mocker: MockerFixture, app_context: None
) -> None:
    command_cls = _purge_command(mocker, {"purged": True, "entity_type": "slices"})

    result = CliRunner().invoke(force_purge, ["--uuid", str(_UUID)], input="y\n")

    assert result.exit_code == 0, result.output
    assert _PROMPT in result.output
    command_cls.assert_called_once_with(str(_UUID), model_cls=None)
    command_cls.return_value.run.assert_called_once_with()


def test_force_purge_yes_bypasses_the_prompt(
    mocker: MockerFixture, app_context: None
) -> None:
    """``--yes`` is the scripted bypass: no prompt text, the purge runs."""
    command_cls = _purge_command(mocker, {"purged": True, "entity_type": "slices"})

    result = CliRunner().invoke(force_purge, ["--uuid", str(_UUID), "--yes"])

    assert result.exit_code == 0, result.output
    assert _PROMPT not in result.output
    command_cls.return_value.run.assert_called_once_with()


# ---- force-purge: --type resolution ----------------------------------------


@pytest.mark.parametrize(
    "entity_type, tablename",
    [("chart", "slices"), ("dashboard", "dashboards"), ("dataset", "tables")],
)
def test_resolve_model_maps_each_type_to_its_soft_delete_model(
    entity_type: str, tablename: str, app_context: None
) -> None:
    model = _resolve_model(entity_type)
    assert model is not None
    assert getattr(model, "__tablename__", None) == tablename


def test_resolve_model_none_means_search_every_model(app_context: None) -> None:
    assert _resolve_model(None) is None


def test_resolve_model_is_case_insensitive(app_context: None) -> None:
    assert getattr(_resolve_model("Dashboard"), "__tablename__", None) == "dashboards"


def test_resolve_model_reports_a_map_drift_as_an_operator_error(
    mocker: MockerFixture, app_context: None
) -> None:
    """If the type map names a table no registered model carries, the CLI
    reports it cleanly rather than returning ``None`` (which would silently
    widen the purge to every model)."""
    mocker.patch.dict(
        "superset.cli.deletion_retention._PURGE_TYPES", {"chart": "renamed_table"}
    )
    with pytest.raises(click.ClickException, match="No soft-delete model"):
        _resolve_model("chart")


def test_force_purge_passes_the_resolved_model_to_the_command(
    mocker: MockerFixture, app_context: None
) -> None:
    from superset.models.slice import Slice

    command_cls = _purge_command(mocker, {"purged": True, "entity_type": "slices"})

    result = CliRunner().invoke(
        force_purge, ["--uuid", str(_UUID), "--type", "CHART", "--yes"]
    )

    assert result.exit_code == 0, result.output
    command_cls.assert_called_once_with(str(_UUID), model_cls=Slice)


# ---- force-purge: outcomes and exit codes ----------------------------------


def test_force_purge_reports_a_successful_purge_with_its_counts(
    mocker: MockerFixture, app_context: None
) -> None:
    _purge_command(
        mocker,
        {
            "purged": True,
            "entity_type": "tables",
            "dangling_chart_uuids": ["a", "b", "c"],
            "removed_dashboard_slices": 4,
            "version_rows_removed": 12,
        },
    )

    result = CliRunner().invoke(force_purge, ["--uuid", str(_UUID), "--yes"])

    assert result.exit_code == 0, result.output
    assert f"Purged tables uuid={_UUID}." in result.output
    assert "Dangling charts: 3;" in result.output
    assert "dashboard_slices removed: 4;" in result.output
    assert "version rows removed: 12." in result.output


def test_force_purge_success_output_tolerates_missing_counts(
    mocker: MockerFixture, app_context: None
) -> None:
    """A result carrying only ``purged``/``entity_type`` still renders."""
    _purge_command(mocker, {"purged": True, "entity_type": "slices"})

    result = CliRunner().invoke(force_purge, ["--uuid", str(_UUID), "--yes"])

    assert result.exit_code == 0, result.output
    assert "Dangling charts: 0;" in result.output
    assert "dashboard_slices removed: 0;" in result.output
    assert "version rows removed: 0." in result.output


def test_force_purge_reports_a_blocked_purge(
    mocker: MockerFixture, app_context: None
) -> None:
    """A purge refused by the deletion rules names the reason and exits 1.

    A blocked compliance purge is not a success: the message stays on stdout
    unchanged, and the non-zero exit lets an operator's script tell it apart
    from a completed purge.
    """
    _purge_command(
        mocker,
        {"purged": False, "reason": "blocked", "blocked_reason": "report_schedule"},
    )

    result = CliRunner().invoke(force_purge, ["--uuid", str(_UUID), "--yes"])

    assert result.exit_code == 1, result.output
    assert f"Entity uuid={_UUID} was not purged" in result.output
    assert "report_schedule" in result.output


def test_force_purge_reports_nothing_to_purge(
    mocker: MockerFixture, app_context: None
) -> None:
    """Nothing to purge is reported and, like a refusal, exits 1."""
    _purge_command(mocker, {"purged": False, "reason": "not_found"})

    result = CliRunner().invoke(force_purge, ["--uuid", str(_UUID), "--yes"])

    assert result.exit_code == 1, result.output
    assert f"No entity found for uuid={_UUID} (nothing to purge)." in result.output


def test_force_purge_reports_ambiguity_as_an_operator_error(
    mocker: MockerFixture, app_context: None
) -> None:
    """An ambiguous bare UUID surfaces as a clean error naming ``--type``
    (exit 1), not a traceback — it lands after the prompt was answered."""
    _purge_command(mocker, AmbiguousPurgeTargetError("Ambiguous purge target."))

    result = CliRunner().invoke(force_purge, ["--uuid", str(_UUID), "--yes"])

    assert result.exit_code == 1
    assert result.exception is None or isinstance(result.exception, SystemExit)
    assert "Ambiguous purge target." in result.output
    assert "Re-run with --type, e.g. --type chart." in result.output
