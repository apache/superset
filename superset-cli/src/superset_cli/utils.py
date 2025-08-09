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

import json  # noqa: TID251
from pathlib import Path
from typing import Any

import tomli


def read_toml(path: Path) -> dict[str, Any] | None:
    if not path.is_file():
        return None

    with path.open("rb") as f:
        return tomli.load(f)


def read_json(path: Path) -> dict[str, Any] | None:
    path = Path(path)
    if not path.is_file():
        return None

    return json.loads(path.read_text())
