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
from unittest.mock import MagicMock, patch

import pytest
from marshmallow import ValidationError

from superset.commands.security.create import CreateRLSRuleCommand
from superset.commands.security.delete import DeleteRLSRuleCommand
from superset.commands.security.exceptions import RLSDatasourceForbiddenError
from superset.commands.security.update import UpdateRLSRuleCommand
from superset.utils.core import RowLevelSecurityFilterType


def _mock_tables(*table_ids: int) -> list[MagicMock]:
    tables = []
    for table_id in table_ids:
        table = MagicMock()
        table.id = table_id
        tables.append(table)
    return tables


def _patch_query(module: str, tables: list[MagicMock]):
    """Patch db.session.query(...).filter(...).all() to return ``tables``."""
    query = MagicMock()
    query.filter.return_value.all.return_value = tables
    return patch(f"{module}.db.session.query", return_value=query)


def test_create_rls_rule_forbidden_when_no_datasource_access() -> None:
    tables = _mock_tables(1)

    with (
        _patch_query("superset.commands.security.create", tables),
        patch(
            "superset.commands.security.utils.security_manager.can_access_datasource",
            return_value=False,
        ) as can_access,
    ):
        command = CreateRLSRuleCommand({"tables": [1], "subjects": []})
        with pytest.raises(RLSDatasourceForbiddenError):
            command.validate()

    can_access.assert_called_once_with(datasource=tables[0])


def test_create_rls_rule_allowed_when_datasource_access() -> None:
    tables = _mock_tables(1, 2)

    with (
        _patch_query("superset.commands.security.create", tables),
        patch(
            "superset.commands.security.utils.security_manager.can_access_datasource",
            return_value=True,
        ) as can_access,
    ):
        command = CreateRLSRuleCommand({"tables": [1, 2], "subjects": []})
        command.validate()

    # Access is checked for every referenced datasource.
    assert can_access.call_count == 2
    assert command._properties["tables"] == tables


def test_create_rls_rule_forbidden_if_any_datasource_denied() -> None:
    tables = _mock_tables(1, 2)

    with (
        _patch_query("superset.commands.security.create", tables),
        patch(
            "superset.commands.security.utils.security_manager.can_access_datasource",
            side_effect=[True, False],
        ),
    ):
        command = CreateRLSRuleCommand({"tables": [1, 2], "subjects": []})
        with pytest.raises(RLSDatasourceForbiddenError):
            command.validate()


def test_create_regular_rls_rule_requires_subjects() -> None:
    command = CreateRLSRuleCommand(
        {
            "filter_type": RowLevelSecurityFilterType.REGULAR.value,
            "tables": [1],
            "subjects": [],
        }
    )

    with pytest.raises(ValidationError) as exc:
        command.validate()

    assert "subjects" in exc.value.messages


def test_update_rls_rule_forbidden_when_no_datasource_access() -> None:
    tables = _mock_tables(1)

    with (
        _patch_query("superset.commands.security.update", tables),
        patch(
            "superset.commands.security.update.RLSDAO.find_by_id",
            return_value=MagicMock(),
        ),
        patch(
            "superset.commands.security.utils.security_manager.can_access_datasource",
            return_value=False,
        ) as can_access,
    ):
        command = UpdateRLSRuleCommand(1, {"tables": [1], "subjects": []})
        with pytest.raises(RLSDatasourceForbiddenError):
            command.validate()

    can_access.assert_called_once_with(datasource=tables[0])


def test_update_rls_rule_allowed_when_datasource_access() -> None:
    tables = _mock_tables(1)

    with (
        _patch_query("superset.commands.security.update", tables),
        patch(
            "superset.commands.security.update.RLSDAO.find_by_id",
            return_value=MagicMock(),
        ),
        patch(
            "superset.commands.security.utils.security_manager.can_access_datasource",
            return_value=True,
        ) as can_access,
    ):
        command = UpdateRLSRuleCommand(1, {"tables": [1], "subjects": []})
        command.validate()

    can_access.assert_called_once_with(datasource=tables[0])
    assert command._properties["tables"] == tables


def test_update_regular_rls_rule_requires_subjects() -> None:
    rule = MagicMock()
    rule.filter_type = RowLevelSecurityFilterType.REGULAR.value
    rule.subjects = []

    with patch(
        "superset.commands.security.update.RLSDAO.find_by_id",
        return_value=rule,
    ):
        command = UpdateRLSRuleCommand(1, {"subjects": []})
        with pytest.raises(ValidationError) as exc:
            command.validate()

    assert "subjects" in exc.value.messages


def test_update_rls_rule_partial_update_preserves_tables_and_subjects() -> None:
    """A partial update without tables/subjects must not clear those bindings.

    When the request body omits ``tables``/``subjects``, validate() must not add
    those keys to the properties passed to the DAO, so the existing bindings
    are left untouched instead of being overwritten with empty lists.
    """
    rule = MagicMock()
    rule.tables = _mock_tables(1)
    with (
        patch(
            "superset.commands.security.update.RLSDAO.find_by_id",
            return_value=rule,
        ),
        patch(
            "superset.commands.security.update.populate_subject_list",
        ) as populate_subject_list,
        patch("superset.commands.security.update.db.session.query") as query,
        patch(
            "superset.commands.security.utils.security_manager.can_access_datasource",
            return_value=True,
        ),
    ):
        command = UpdateRLSRuleCommand(1, {"name": "new name"})
        command.validate()

    # Omitted relationships are not resolved or written back.
    populate_subject_list.assert_not_called()
    query.assert_not_called()
    assert "tables" not in command._properties
    assert "subjects" not in command._properties
    assert command._properties["name"] == "new name"


def test_update_rls_rule_only_subjects_present_does_not_touch_tables() -> None:
    """Updating only ``subjects`` must not resolve or overwrite ``tables``."""
    rule = MagicMock()
    rule.tables = _mock_tables(1)
    with (
        patch(
            "superset.commands.security.update.RLSDAO.find_by_id",
            return_value=rule,
        ),
        patch(
            "superset.commands.security.update.populate_subject_list",
            return_value=["resolved-subject"],
        ) as populate_subject_list,
        patch("superset.commands.security.update.db.session.query") as query,
        patch(
            "superset.commands.security.utils.security_manager.can_access_datasource",
            return_value=True,
        ),
    ):
        command = UpdateRLSRuleCommand(1, {"subjects": [1]})
        command.validate()

    populate_subject_list.assert_called_once_with([1], default_to_user=False)
    query.assert_not_called()
    assert command._properties["subjects"] == ["resolved-subject"]
    assert "tables" not in command._properties


def test_update_rls_rule_partial_update_enforces_access_on_existing_tables() -> None:
    """A partial update that omits ``tables`` still enforces datasource access.

    The rule's existing table bindings must be authorized so a caller cannot
    edit a rule tied to datasources they cannot access by simply omitting
    ``tables`` from the payload.
    """
    rule = MagicMock()
    rule.tables = _mock_tables(1)
    with (
        patch(
            "superset.commands.security.update.RLSDAO.find_by_id",
            return_value=rule,
        ),
        patch("superset.commands.security.update.db.session.query") as query,
        patch(
            "superset.commands.security.utils.security_manager.can_access_datasource",
            return_value=False,
        ) as can_access,
    ):
        command = UpdateRLSRuleCommand(1, {"name": "new name"})
        with pytest.raises(RLSDatasourceForbiddenError):
            command.validate()

    # Access is checked against the rule's existing tables, not a submitted set.
    can_access.assert_called_once_with(datasource=rule.tables[0])
    query.assert_not_called()


def test_delete_rls_rule_forbidden_when_no_datasource_access() -> None:
    tables = _mock_tables(1)
    rule = MagicMock()
    rule.tables = tables

    with (
        patch(
            "superset.commands.security.delete.RLSDAO.find_by_ids",
            return_value=[rule],
        ),
        patch(
            "superset.commands.security.utils.security_manager.can_access_datasource",
            return_value=False,
        ) as can_access,
    ):
        command = DeleteRLSRuleCommand([1])
        with pytest.raises(RLSDatasourceForbiddenError):
            command.validate()

    can_access.assert_called_once_with(datasource=tables[0])


def test_delete_rls_rule_allowed_when_datasource_access() -> None:
    tables = _mock_tables(1, 2)
    rule = MagicMock()
    rule.tables = tables

    with (
        patch(
            "superset.commands.security.delete.RLSDAO.find_by_ids",
            return_value=[rule],
        ),
        patch(
            "superset.commands.security.utils.security_manager.can_access_datasource",
            return_value=True,
        ) as can_access,
    ):
        command = DeleteRLSRuleCommand([1])
        command.validate()

    # Access is checked for every datasource referenced by the rule.
    assert can_access.call_count == 2
