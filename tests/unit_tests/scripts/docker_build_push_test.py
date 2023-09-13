import re
import subprocess
from unittest import mock
from unittest.mock import patch

import pytest

from tests.unit_tests.fixtures.bash_mock import BashMock

original_run = subprocess.run


def wrapped(*args, **kwargs):
    return original_run(*args, **kwargs)


@pytest.mark.parametrize(
    "tag, expected_output",
    [
        ("1.0.0", "LATEST_TAG is latest"),
        ("2.1.0", "LATEST_TAG is latest"),
        ("2.1.1", "LATEST_TAG is latest-official"),
        ("3.0.0", "LATEST_TAG is latest-official"),
        ("2.1.0rc1", "LATEST_TAG is latest"),
        ("", "LATEST_TAG is latest"),
        ("2.1", "LATEST_TAG is latest"),
        ("does_not_exist", "LATEST_TAG is latest"),
    ],
)
def test_tag_latest_release(tag, expected_output):
    with mock.patch(
        "tests.unit_tests.fixtures.bash_mock.subprocess.run", wraps=wrapped
    ) as subprocess_mock:
        result = BashMock.docker_build_push(tag)

        subprocess_mock.assert_called_once_with(
            f"./scripts/docker_build_push.sh {tag}",
            shell=True,
            capture_output=True,
            text=True,
            env={"TEST_ENV": "true", "GITHUB_REF": "refs/heads/master"},
        )

        assert re.search(expected_output, result.stdout, re.MULTILINE)
