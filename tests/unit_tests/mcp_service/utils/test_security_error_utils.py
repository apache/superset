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

"""
Tests for superset.mcp_service.utils.security_error_utils.

extract_error_type_and_extra() is the shared helper used by get_chart_data,
get_chart_preview, preview_utils, and generate_chart to surface the real
Superset error_type (e.g. TABLE_SECURITY_ACCESS_ERROR) and any 'extra'
payload from a SupersetSecurityException, instead of always reporting a
generic tool-specific error_type.
"""

from superset.mcp_service.utils.security_error_utils import (
    extract_error_type_and_extra,
)


class TestExtractErrorTypeAndExtra:
    def test_plain_value_error_has_no_type_or_extra(self):
        """A bare ValueError carries neither .error nor .extra."""
        error_type, extra = extract_error_type_and_extra(ValueError("boom"))

        assert error_type is None
        assert extra is None

    def test_plain_command_exception_has_no_type_or_extra(self):
        """A CommandException raised without a SupersetError has no .error."""
        from superset.commands.exceptions import CommandException

        error_type, extra = extract_error_type_and_extra(
            CommandException("query failed")
        )

        assert error_type is None
        assert extra is None

    def test_table_security_access_error_surfaces_type_and_extra(self):
        """SupersetSecurityException for a denied Hive table surfaces
        TABLE_SECURITY_ACCESS_ERROR and its extra payload."""
        from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
        from superset.exceptions import SupersetSecurityException

        data_error = SupersetSecurityException(
            SupersetError(
                message="You do not have access to the following tables: db.tbl",
                error_type=SupersetErrorType.TABLE_SECURITY_ACCESS_ERROR,
                level=ErrorLevel.ERROR,
                extra={"entities": {}, "type": "HIVE"},
            )
        )

        error_type, extra = extract_error_type_and_extra(data_error)

        assert error_type == "TABLE_SECURITY_ACCESS_ERROR"
        assert extra == {"entities": {}, "type": "HIVE"}

    def test_security_exception_without_extra_returns_none_extra(self):
        """A SupersetError with no extra payload set should not fabricate one."""
        from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
        from superset.exceptions import SupersetSecurityException

        data_error = SupersetSecurityException(
            SupersetError(
                message="Access denied",
                error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
                level=ErrorLevel.ERROR,
            )
        )

        error_type, extra = extract_error_type_and_extra(data_error)

        assert error_type == "DATASOURCE_SECURITY_ACCESS_ERROR"
        assert extra is None

    def test_empty_extra_dict_is_returned_as_is(self):
        """An explicitly empty extra dict is returned unchanged (still falsy,
        so callers that do `if extra` correctly skip appending a suffix)."""
        from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
        from superset.exceptions import SupersetSecurityException

        data_error = SupersetSecurityException(
            SupersetError(
                message="Access denied",
                error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
                level=ErrorLevel.ERROR,
                extra={},
            )
        )

        error_type, extra = extract_error_type_and_extra(data_error)

        assert extra == {}
        assert not extra

    def test_extra_dict_renders_as_python_repr_in_error_text(self):
        """Pin down the exact text produced when `extra` is embedded into an
        error message via the `f"...{f' extra: {extra}' if extra else ''}"`
        pattern used across get_chart_data.py, get_chart_preview.py,
        preview_utils.py, and generate_chart.py.

        `extra` is a plain dict, so it renders using Python's default repr
        (single-quoted keys/values, e.g. {'entities': {...}, 'type': 'X'}),
        NOT JSON (double-quoted). This is what actually shows up in the
        returned ChartError.error string / generate_chart error message
        text -- callers should not assume JSON-parseable output.
        """
        from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
        from superset.exceptions import SupersetSecurityException

        data_error = SupersetSecurityException(
            SupersetError(
                message="You do not have access to the following tables: db.tbl",
                error_type=SupersetErrorType.TABLE_SECURITY_ACCESS_ERROR,
                level=ErrorLevel.ERROR,
                extra={"entities": {"db.tbl": {"requests": []}}, "type": "HIVE"},
            )
        )

        error_type, extra = extract_error_type_and_extra(data_error)
        formatted = f"{data_error}{f' extra: {extra}' if extra else ''}"

        assert error_type == "TABLE_SECURITY_ACCESS_ERROR"
        assert formatted == (
            "You do not have access to the following tables: db.tbl extra: "
            "{'entities': {'db.tbl': {'requests': []}}, 'type': 'HIVE'}"
        )
