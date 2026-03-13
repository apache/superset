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

from superset.connectors.sqla.models import RowLevelSecurityFilter, SqlaTable


def test_get_sqla_row_level_filters_with_subquery_fails_when_flag_off():
    with (
        patch("superset.models.helpers.is_feature_enabled", return_value=False),
        patch("superset.connectors.sqla.models.security_manager") as sm,
    ):
        table = SqlaTable(table_name="test_table")
        table.database = MagicMock()
        table.database.backend = "postgresql"
        table.database_id = 1
        table.catalog = None
        table.schema = "public"

        rls_filter = RowLevelSecurityFilter()
        rls_filter.clause = "EXISTS (SELECT 1 FROM secret_table)"
        rls_filter.group_key = None

        # Use a non-async MagicMock to avoid coroutine issues in sync models.py
        sm.get_rls_filters = MagicMock(return_value=[rls_filter])

        from superset.exceptions import SupersetSecurityException

        with pytest.raises(SupersetSecurityException) as ex:
            table.get_sqla_row_level_filters()
        assert "Custom SQL fields cannot contain sub-queries" in str(ex.value)


def test_get_sqla_row_level_filters_with_subquery_passes_when_flag_on():
    with (
        patch("superset.models.helpers.db.session.query") as m_query,
        patch("superset.models.helpers.is_feature_enabled", return_value=True),
        patch("superset.utils.rls.apply_rls") as m_apply,
        patch("superset.connectors.sqla.models.security_manager") as sm,
    ):
        m_query.return_value.filter.return_value.one_or_none.return_value = None
        table = SqlaTable(table_name="test_table")
        table.database = MagicMock()
        table.database.backend = "postgresql"
        from superset.sql.parse import RLSMethod

        table.database.db_engine_spec.get_rls_method.return_value = (
            RLSMethod.AS_PREDICATE
        )
        table.database_id = 1
        table.catalog = None
        table.schema = "public"

        rls_filter = RowLevelSecurityFilter()
        rls_filter.clause = "EXISTS (SELECT 1 FROM secret_table)"
        rls_filter.group_key = None

        # Use a non-async MagicMock
        sm.get_rls_filters = MagicMock(return_value=[rls_filter])

        # Should not raise
        filters = table.get_sqla_row_level_filters()
        assert len(filters) == 1
        # Verify that apply_rls was called to protect the subquery
        assert m_apply.called
