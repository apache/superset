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
import subprocess
from unittest import mock

import pytest

from tests.unit_tests.fixtures.bash_mock import BashMock

original_run = subprocess.run


def wrapped(*args, **kwargs):
    return original_run(*args, **kwargs)


@pytest.mark.parametrize(
    "tag, expected_output",
    [
        ("1.0.0", "This release tag 1.0.0 is older than the latest."),
        ("2.1.0", "Versions are equal\n"),
        ("2.1.1", "This release tag 2.1.1 is newer than the latest."),
        ("3.0.0", "This release tag 3.0.0 is newer than the latest."),
        ("2.1.0rc1", "This tag 2.1.0rc1 is not a valid release version. Not tagging."),
        (
            "",
            "Missing tag parameter, usage: ./scripts/tag_latest_release.sh <GITHUB_TAG_NAME>",  # noqa: E501
        ),
        ("2.1", "This tag 2.1 is not a valid release version. Not tagging."),
        (
            "does_not_exist",
            "The tag does_not_exist does not exist. Please use a different tag.\n",
        ),
    ],
)
def test_tag_latest_release(tag, expected_output):
    with mock.patch(
        "tests.unit_tests.fixtures.bash_mock.subprocess.run", wraps=wrapped
    ) as subprocess_mock:
        result = BashMock.tag_latest_release(tag)

        subprocess_mock.assert_called_once_with(  # noqa: S604
            f"./scripts/tag_latest_release.sh {tag} --dry-run",
            shell=True,
            capture_output=True,
            text=True,
            env={"TEST_ENV": "true"},
        )

        assert expected_output in result.stdout
