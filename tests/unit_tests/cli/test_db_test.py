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

from unittest.mock import patch

from rich.console import Console

from superset.cli.test_db import collect_connection_info
from superset.commands.database.exceptions import DatabaseInvalidError


def test_collect_connection_info_masking():
    """Test that passwords are masked in CLI output."""
    console = Console()
    uri = "postgresql://user:pass@host/db"

    with patch("builtins.input", return_value="n"):
        # We need to mock sys.stdin.read because collect_connection_info might read it
        with patch("sys.stdin.read", return_value="{}"):
            with console.capture() as capture:
                collect_connection_info(console, uri)

            output = capture.get()
            assert "user:pass@" not in output
            assert "***" in output
            assert "host" in output


def test_collect_connection_info_malformed_uri():
    """Test that malformed URIs are handled gracefully in CLI output."""
    console = Console()
    uri = "not-a-valid-uri"

    with patch("builtins.input", return_value="n"):
        with console.capture() as capture:
            info = collect_connection_info(console, uri)

        output = capture.get()
        assert "<invalid database URI>" in output
        assert info == {}


def test_collect_connection_info_database_invalid_error():
    """Test that DatabaseInvalidError is handled gracefully in CLI output."""
    console = Console()
    uri = "invalid-uri"

    with patch("builtins.input", return_value="n"):
        with patch(
            "superset.cli.test_db.make_url_safe", side_effect=DatabaseInvalidError()
        ):
            with console.capture() as capture:
                collect_connection_info(console, uri)

            output = capture.get()
            assert "<invalid database URI>" in output
