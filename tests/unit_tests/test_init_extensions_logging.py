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
"""Tests for extension-initialization error logging."""

from contextlib import nullcontext
from unittest.mock import MagicMock, patch

from superset.initialization import SupersetAppInitializer


def _extension_that_fails_to_init() -> MagicMock:
    extension = MagicMock()
    extension.backend = None  # skip the in-memory importer branch
    extension.manifest.id = "acme.broken_extension"
    extension.manifest.backend.entrypoint = "acme.broken:init"
    return extension


def test_init_extensions_logs_exception_instead_of_printing() -> None:
    """An extension entrypoint failure is routed through logger.exception."""
    initializer = object.__new__(SupersetAppInitializer)
    extension = _extension_that_fails_to_init()

    with (
        patch(
            "superset.extensions.utils.get_extensions",
            return_value={"acme.broken_extension": extension},
        ),
        patch("superset.extensions.utils.install_in_memory_importer"),
        patch(
            "superset.extensions.utils.eager_import",
            side_effect=RuntimeError("boom"),
        ),
        patch("superset.initialization.extension_context", return_value=nullcontext()),
        patch("superset.initialization.logger") as mock_logger,
    ):
        initializer.init_extensions()

    mock_logger.exception.assert_called_once()
    # The failing extension id is included in the log call args.
    assert "acme.broken_extension" in mock_logger.exception.call_args.args
    # The startup summary counts the failure: 0 loaded, 1 failed.
    assert mock_logger.info.call_args.args[1:] == (0, 1)


def test_init_extensions_logs_count_with_no_extensions() -> None:
    """A startup with nothing to load still records that it ran."""
    initializer: SupersetAppInitializer = object.__new__(SupersetAppInitializer)
    with (
        patch("superset.extensions.utils.get_extensions", return_value={}),
        patch("superset.initialization.logger") as mock_logger,
    ):
        initializer.init_extensions()
    assert mock_logger.info.call_args.args[1:] == (0, 0)


def test_init_extensions_failed_discovery_logs_warning() -> None:
    """A discovery failure says why in the log instead of returning silently."""
    initializer: SupersetAppInitializer = object.__new__(SupersetAppInitializer)
    with (
        patch(
            "superset.extensions.utils.get_extensions",
            side_effect=RuntimeError("no metadata database"),
        ),
        patch("superset.initialization.logger") as mock_logger,
    ):
        initializer.init_extensions()
    mock_logger.warning.assert_called_once()
    assert mock_logger.warning.call_args.kwargs.get("exc_info") is True
    mock_logger.info.assert_not_called()
