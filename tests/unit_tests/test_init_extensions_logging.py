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

from flask import Flask

from superset.extensions.availability import EXTENSIONS_LOADED_KEY
from superset.initialization import SupersetAppInitializer


def _extension_that_fails_to_init() -> MagicMock:
    extension = MagicMock()
    extension.backend = None  # skip the in-memory importer branch
    extension.manifest.id = "acme.broken_extension"
    extension.manifest.backend.entrypoint = "acme.broken:init"
    return extension


def _initializer() -> SupersetAppInitializer:
    initializer: SupersetAppInitializer = object.__new__(SupersetAppInitializer)
    initializer.superset_app = Flask(__name__)
    return initializer


def test_init_extensions_logs_exception_instead_of_printing() -> None:
    """An extension entrypoint failure is routed through logger.exception."""
    initializer: SupersetAppInitializer = _initializer()
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
    # One failing entrypoint does not stop the server serving the others.
    assert initializer.superset_app.extensions[EXTENSIONS_LOADED_KEY] is True
    assert mock_logger.info.call_args.args[1:] == (0, 1)


def test_init_extensions_marks_loaded_after_discovery() -> None:
    """A completed initialization is recorded, even with no extensions."""
    initializer: SupersetAppInitializer = _initializer()
    with patch("superset.extensions.utils.get_extensions", return_value={}):
        initializer.init_extensions()
    assert initializer.superset_app.extensions[EXTENSIONS_LOADED_KEY] is True


def test_init_extensions_failed_discovery_stays_unloaded() -> None:
    """A discovery failure leaves the server unloaded and says why in the log."""
    initializer: SupersetAppInitializer = _initializer()
    with (
        patch(
            "superset.extensions.utils.get_extensions",
            side_effect=RuntimeError("no metadata database"),
        ),
        patch("superset.initialization.logger") as mock_logger,
    ):
        initializer.init_extensions()
    assert EXTENSIONS_LOADED_KEY not in initializer.superset_app.extensions
    mock_logger.warning.assert_called_once()
    assert mock_logger.warning.call_args.kwargs["exc_info"] is True
