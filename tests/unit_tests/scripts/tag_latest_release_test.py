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
        ("1.0.0", "This release tag 1.0.0 is older than the latest."),
        ("2.1.0", "Versions are equal\n::set-output name=SKIP_TAG::true"),
        ("2.1.1", "This release tag 2.1.1 is newer than the latest."),
        ("3.0.0", "This release tag 3.0.0 is newer than the latest."),
        ("2.1.0rc1", "This tag 2.1.0rc1 is not a valid release version. Not tagging."),
        (
            "",
            "Missing tag parameter, usage: ./scripts/tag_latest_release.sh <GITHUB_TAG_NAME>",
        ),
        ("2.1", "This tag 2.1 is not a valid release version. Not tagging."),
        (
            "does_not_exist",
            "The tag does_not_exist does not exist. Please use a different tag.\n::set-output name=SKIP_TAG::true",
        ),
    ],
)
def test_tag_latest_release(tag, expected_output):
    with mock.patch(
        "tests.unit_tests.fixtures.bash_mock.subprocess.run", wraps=wrapped
    ) as subprocess_mock:
        result = BashMock.tag_latest_release(tag)

        subprocess_mock.assert_called_once_with(
            f"./scripts/tag_latest_release.sh {tag} --dry-run",
            shell=True,
            capture_output=True,
            text=True,
            env={"TEST_ENV": "true"},
        )

        assert expected_output in result.stdout
