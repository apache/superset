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

"""Tests for MCP validation-error sanitization."""

import logging

from superset.mcp_service.utils.error_sanitization import _sanitize_validation_error


def test_sanitize_redacts_table_name():
    error = ValueError("Invalid reference to table users in query")
    # Pure content check — suppress the server-side INFO log of the original.
    result = _sanitize_validation_error(error, log_original=False)
    assert "users" not in result
    assert "[REDACTED]" in result


def test_sanitize_logs_original_by_default(caplog):
    """The original (unsanitized) error is logged server-side before sanitizing."""
    error = ValueError("Invalid reference to table secret_revenue in query")

    with caplog.at_level(
        logging.INFO, logger="superset.mcp_service.utils.error_sanitization"
    ):
        result = _sanitize_validation_error(error)

    # The client-facing result is sanitized (no raw table name)
    assert "secret_revenue" not in result

    # The server-side INFO log retains the original, unsanitized detail
    info_messages = [r.message for r in caplog.records if r.levelno == logging.INFO]
    assert any("secret_revenue" in m for m in info_messages), (
        "Original error should be logged server-side before sanitizing"
    )


def test_sanitize_can_suppress_original_log(caplog):
    """log_original=False suppresses the server-side log of the original error."""
    error = ValueError("Invalid reference to table secret_revenue in query")

    with caplog.at_level(
        logging.INFO, logger="superset.mcp_service.utils.error_sanitization"
    ):
        _sanitize_validation_error(error, log_original=False)

    info_messages = [r.message for r in caplog.records if r.levelno == logging.INFO]
    assert not any("secret_revenue" in m for m in info_messages)


def test_sanitize_does_not_change_client_output_with_logging():
    """log_original must not affect the sanitized client-facing output."""
    error = ValueError("Validation failed due to a timeout")
    assert _sanitize_validation_error(
        error, log_original=True
    ) == _sanitize_validation_error(error, log_original=False)
