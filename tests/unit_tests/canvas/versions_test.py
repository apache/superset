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
import pytest

from superset.canvas.definition.versions import (
    check_definition_version,
    DefinitionVersionError,
)


def test_current_version_passes_through() -> None:
    definition = {"version": 3}

    assert check_definition_version(definition, current=3) is definition


def test_missing_version_is_the_current_one() -> None:
    assert check_definition_version({}, current=3) == {}


def test_newer_version_asks_for_an_upgrade() -> None:
    with pytest.raises(DefinitionVersionError, match="Upgrade Superset"):
        check_definition_version({"version": 4}, current=3)


@pytest.mark.parametrize("version", [2, 0, "1", True, None])
def test_other_versions_are_refused(version: object) -> None:
    with pytest.raises(DefinitionVersionError, match="Unsupported"):
        check_definition_version({"version": version}, current=3)
