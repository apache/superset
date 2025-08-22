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

from __future__ import annotations

import os
from pathlib import Path

import pytest
from click.testing import CliRunner


@pytest.fixture
def cli_runner():
    """Provide a Click CLI runner for testing commands."""
    return CliRunner()


@pytest.fixture
def isolated_filesystem(tmp_path):
    """
    Provide an isolated temporary directory and change to it.
    This ensures tests don't interfere with each other.
    """
    original_cwd = Path.cwd()
    os.chdir(tmp_path)
    yield tmp_path
    os.chdir(original_cwd)


@pytest.fixture
def extension_params():
    """Default parameters for extension creation."""
    return {
        "id": "test_extension",
        "name": "Test Extension",
        "version": "0.1.0",
        "license": "Apache-2.0",
        "include_frontend": True,
        "include_backend": True,
    }


@pytest.fixture
def cli_input_both():
    """CLI input for creating extension with both frontend and backend."""
    return "test_extension\nTest Extension\n0.1.0\nApache-2.0\ny\ny\n"


@pytest.fixture
def cli_input_frontend_only():
    """CLI input for creating extension with frontend only."""
    return "test_extension\nTest Extension\n0.1.0\nApache-2.0\ny\nn\n"


@pytest.fixture
def cli_input_backend_only():
    """CLI input for creating extension with backend only."""
    return "test_extension\nTest Extension\n0.1.0\nApache-2.0\nn\ny\n"


@pytest.fixture
def cli_input_neither():
    """CLI input for creating extension with neither frontend nor backend."""
    return "test_extension\nTest Extension\n0.1.0\nApache-2.0\nn\nn\n"
