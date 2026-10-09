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
# flake8: noqa
# type: ignore

"""Config for the semantic-view Playwright step only.

Kept out of ``superset_test_config`` so that the extension loader and the
in-memory stub provider never run for the unit, integration or required
Playwright suites. The stub registers through the real extension mechanism
(``ENABLE_EXTENSIONS`` + ``LOCAL_EXTENSIONS``), so its layer type is
``extensions.superset-e2e.semantic-stub.stub``.
"""

from pathlib import Path
from typing import Any

from .superset_test_config import *  # noqa: F403

FEATURE_FLAGS: dict[str, Any] = {
    **FEATURE_FLAGS,  # noqa: F405
    "ENABLE_EXTENSIONS": True,
    "SEMANTIC_LAYERS": True,
}

LOCAL_EXTENSIONS: list[str] = [
    str(Path(__file__).resolve().parents[1] / "e2e_extensions" / "semantic_stub")
]
