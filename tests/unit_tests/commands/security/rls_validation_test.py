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

from superset.commands.security.create import CreateRLSRuleCommand
from superset.commands.security.update import UpdateRLSRuleCommand
from superset.exceptions import SupersetSecurityException


def test_create_rls_rule_with_subquery_fails_when_flag_off():
    data = {
        "name": "malicious",
        "clause": "1=1 OR EXISTS (SELECT 1 FROM users)",
        "tables": [1],
        "roles": [1],
    }
    mock_table = MagicMock()
    mock_table.database = MagicMock()
    mock_table.database.backend = "postgresql"
    mock_table.database_id = 1
    mock_table.catalog = None
    mock_table.schema = "public"

    with (
        patch("superset.commands.security.create.db.session.query") as mq,
        patch("superset.models.helpers.is_feature_enabled", return_value=False),
    ):
        mq.return_value.filter.return_value.all.return_value = [mock_table]
        command = CreateRLSRuleCommand(data)
        with pytest.raises(SupersetSecurityException) as ex:
            command.validate()
        assert "Custom SQL fields cannot contain sub-queries" in str(ex.value)


def test_create_rls_rule_with_subquery_passes_when_flag_on():
    from superset.sql.parse import RLSMethod

    data = {
        "name": "complex_but_allowed",
        "clause": "1=1 OR EXISTS (SELECT 1 FROM users)",
        "tables": [1],
        "roles": [1],
    }
    mock_table = MagicMock()
    mock_table.database = MagicMock()
    mock_table.database.backend = "postgresql"
    mock_table.database.db_engine_spec.get_rls_method.return_value = (
        RLSMethod.AS_PREDICATE
    )
    mock_table.database_id = 1
    mock_table.catalog = None
    mock_table.schema = "public"

    with (
        patch("superset.commands.security.create.db.session.query") as mq,
        patch("superset.models.helpers.is_feature_enabled", return_value=True),
        patch("superset.utils.rls.apply_rls") as m_apply,
    ):
        mq.return_value.filter.return_value.all.return_value = [mock_table]
        command = CreateRLSRuleCommand(data)
        # Should not raise
        command.validate()
        # Verify that apply_rls was called to protect the subquery
        assert m_apply.called


def test_update_rls_rule_with_subquery_fails_when_flag_off():
    data = {
        "name": "malicious_update",
        "clause": "1=1 OR EXISTS (SELECT 1 FROM users)",
        "tables": [1],
        "roles": [1],
    }
    mock_table = MagicMock()
    mock_table.database = MagicMock()
    mock_table.database.backend = "postgresql"
    mock_table.catalog = None
    mock_table.schema = "public"

    mock_model = MagicMock()

    with (
        patch("superset.commands.security.update.RLSDAO.find_by_id") as mfind,
        patch("superset.commands.security.update.db.session.query") as mq,
        patch("superset.models.helpers.is_feature_enabled", return_value=False),
    ):
        mfind.return_value = mock_model
        mq.return_value.filter.return_value.all.return_value = [mock_table]

        command = UpdateRLSRuleCommand(1, data)
        with pytest.raises(SupersetSecurityException) as ex:
            command.validate()
        assert "Custom SQL fields cannot contain sub-queries" in str(ex.value)


def test_validate_rls_simple_clause_passes():
    from superset.models.helpers import validate_adhoc_subquery

    mock_db = MagicMock()
    # Should not raise for simple equality or basic WHERE fragments
    # This addresses the reviewer concern about false rejections.
    validate_adhoc_subquery(
        "client_id = 9", mock_db, None, "public", "postgresql", is_predicate=True
    )
    validate_adhoc_subquery(
        "organization_id IS NOT NULL",
        mock_db,
        None,
        "public",
        "postgresql",
        is_predicate=True,
    )


def test_validate_rls_jinja_passes():
    from superset.models.helpers import validate_adhoc_subquery

    mock_db = MagicMock()
    # Jinja templates should not break the parser
    validate_adhoc_subquery(
        "client_id = {{ current_user_id() }}",
        mock_db,
        None,
        "public",
        "postgresql",
        is_predicate=True,
    )
    validate_adhoc_subquery(
        "dept IN ({{ \"'IT', 'HR'\" }})",
        mock_db,
        None,
        "public",
        "postgresql",
        is_predicate=True,
    )


def test_validate_rls_jinja_with_subquery_fails():
    from superset.models.helpers import validate_adhoc_subquery

    mock_db = MagicMock()
    # Malicious subquery WITH Jinja should still be blocked
    with pytest.raises(SupersetSecurityException):
        validate_adhoc_subquery(
            "1=1 OR EXISTS (SELECT 1 FROM users) -- {{ ignore_me }}",
            mock_db,
            None,
            "public",
            "postgresql",
            is_predicate=True,
        )


def test_validate_rls_set_operations_fail():
    from superset.models.helpers import validate_adhoc_subquery

    mock_db = MagicMock()
    # UNION/EXCEPT/INTERSECT should be treated as subqueries/complex SQL
    with pytest.raises(SupersetSecurityException):
        validate_adhoc_subquery(
            "id IN (SELECT id FROM table1 UNION SELECT id FROM table2)",
            mock_db,
            None,
            "public",
            "postgresql",
            is_predicate=True,
        )


def test_validate_rls_union_breakout_fails():
    from superset.models.helpers import validate_adhoc_subquery

    mock_db = MagicMock()
    # Test the UNION breakout vector
    with pytest.raises(SupersetSecurityException) as ex:
        validate_adhoc_subquery(
            "1=1 UNION SELECT password FROM users",
            mock_db,
            None,
            "public",
            "postgresql",
            is_predicate=True,
        )
    assert "set operations are not allowed" in str(ex.value)


def test_validate_adhoc_subquery_preserves_jinja_on_non_predicate():
    """Non-predicate callers must get back original SQL (with Jinja) even when RLS
    is applied, so downstream template processors are not broken."""
    from unittest.mock import patch

    from superset.models.helpers import validate_adhoc_subquery

    mock_db = MagicMock()
    sql = "SUM(CASE WHEN {{ filter_col }} = 1 THEN (SELECT amount FROM t2) END)"

    with (
        patch("superset.models.helpers.is_feature_enabled", return_value=True),
        patch("superset.utils.rls.apply_rls"),
    ):
        result = validate_adhoc_subquery(sql, mock_db, None, "public", "postgresql")
    # Must return the original Jinja-containing SQL, not the stripped form
    assert "{{" in result
    assert "__jinja__" not in result


def test_validate_rls_multi_statement_fails():
    from superset.models.helpers import validate_adhoc_subquery

    mock_db = MagicMock()
    # Explicitly test the multi-statement injection vector mentioned by reviewer
    with pytest.raises(SupersetSecurityException) as ex:
        validate_adhoc_subquery(
            "1=1; DROP TABLE users",
            mock_db,
            None,
            "public",
            "postgresql",
            is_predicate=True,
        )
    assert "multi-statement injection" in str(ex.value)
