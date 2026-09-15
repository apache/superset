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
import hashlib
import re

import pytest

from superset.utils.file import get_filename, MAX_FILENAME_LENGTH, sanitize_title

_HASH_RE = re.compile(r"^[0-9a-f]{8}$")


def _expected_skip_id_truncated(
    slug: str, max_length: int = MAX_FILENAME_LENGTH
) -> str:
    """Mirror get_filename's skip_id truncation + hash disambiguator."""
    hash_suffix = f"_{hashlib.sha256(slug.encode()).hexdigest()[:8]}"
    truncated = slug[: max_length - len(hash_suffix)].rstrip("._-")
    return f"{truncated}{hash_suffix}" if truncated else hash_suffix[1:]


@pytest.mark.parametrize(
    "model_name,model_id,skip_id,expected_filename",
    [
        ("Energy Sankey", 132, False, "Energy_Sankey_132"),
        ("Energy Sankey", 132, True, "Energy_Sankey"),
        ("folder1/Energy Sankey", 132, True, "folder1_Energy_Sankey"),
        ("D:\\Charts\\Energy Sankey", 132, True, "DChartsEnergy_Sankey"),
        ("🥴🥴🥴", 4751, False, "4751"),
        ("🥴🥴🥴", 4751, True, "4751"),
        ("Energy Sankey 🥴🥴🥴", 4751, False, "Energy_Sankey_4751"),
        ("Energy Sankey 🥴🥴🥴", 4751, True, "Energy_Sankey"),
        ("你好", 475, False, "475"),
        ("你好", 475, True, "475"),
        ("Energy Sankey 你好", 475, False, "Energy_Sankey_475"),
        ("Energy Sankey 你好", 475, True, "Energy_Sankey"),
        ("Energy\x08Sankey", 132, False, "EnergySankey_132"),
        ("Energy\x08Sankey", 132, True, "EnergySankey"),
        ("Sales\x7fReport", 1, False, "SalesReport_1"),
    ],
)
def test_get_filename(
    model_name: str, model_id: int, skip_id: bool, expected_filename: str
) -> None:
    original_filename = get_filename(model_name, model_id, skip_id)
    assert expected_filename == original_filename


@pytest.mark.parametrize("name_length", [50, 127, 128, 129, 200, 250, 500])
@pytest.mark.parametrize("skip_id", [True, False])
def test_get_filename_never_exceeds_max_length(name_length: int, skip_id: bool) -> None:
    """Names of any length are capped so archives stay extractable on Windows."""
    assert len(get_filename("a" * name_length, 132, skip_id)) <= MAX_FILENAME_LENGTH


@pytest.mark.parametrize("name_length", [200, 250, 500])
def test_get_filename_truncates_long_names(name_length: int) -> None:
    """The retained portion is the leading slice of the original name."""
    slug = "a" * name_length
    assert get_filename(slug, 132, skip_id=True) == _expected_skip_id_truncated(slug)
    assert get_filename(slug, 132) == (
        "a" * (MAX_FILENAME_LENGTH - len("_132")) + "_132"
    )


def test_get_filename_leaves_short_names_untruncated() -> None:
    """Names that already fit are passed through unchanged (no hash added)."""
    name = "a" * (MAX_FILENAME_LENGTH - len("_132"))
    assert get_filename(name, 132) == f"{name}_132"
    assert get_filename("a" * MAX_FILENAME_LENGTH, 132, skip_id=True) == (
        "a" * MAX_FILENAME_LENGTH
    )


@pytest.mark.parametrize("model_id", [1, 132, 999999, 2**31 - 1])
def test_get_filename_preserves_id_suffix_when_truncating(model_id: int) -> None:
    """The id suffix survives truncation, keeping export filenames unique."""
    filename = get_filename("a" * 500, model_id)

    assert filename.endswith(f"_{model_id}")
    assert len(filename) == MAX_FILENAME_LENGTH
    assert filename == "a" * (MAX_FILENAME_LENGTH - len(f"_{model_id}")) + (
        f"_{model_id}"
    )


def test_get_filename_skip_id_appends_hash_when_truncating() -> None:
    """skip_id truncation keeps a short hash of the full slug as a disambiguator."""
    slug = "a" * 250
    filename = get_filename(slug, 132, skip_id=True)

    assert len(filename) == MAX_FILENAME_LENGTH
    assert filename.startswith("a")
    hash_part = filename.rsplit("_", 1)[-1]
    assert _HASH_RE.match(hash_part)
    assert filename == _expected_skip_id_truncated(slug)


def test_get_filename_skip_id_hash_disambiguates_shared_prefixes() -> None:
    """Two long names that only differ past the cut must not collide in an archive."""
    prefix = "a" * 200
    left = get_filename(prefix + "left", 1, skip_id=True)
    right = get_filename(prefix + "right", 2, skip_id=True)

    assert left != right
    assert len(left) <= MAX_FILENAME_LENGTH
    assert len(right) <= MAX_FILENAME_LENGTH
    # Readable prefixes match; only the content hash differs.
    assert left.rsplit("_", 1)[0] == right.rsplit("_", 1)[0]
    assert left.rsplit("_", 1)[1] != right.rsplit("_", 1)[1]


def test_get_filename_truncation_is_deterministic() -> None:
    """Datasets and their parent database must agree on the truncated folder name."""
    assert get_filename("b" * 250, 1, skip_id=True) == get_filename(
        "b" * 250, 2, skip_id=True
    )


@pytest.mark.parametrize("separators", ["_", "-", ".", "._-", "-_.", "__", "..."])
def test_get_filename_strips_trailing_separators(separators: str) -> None:
    """Truncating onto a delimiter must not leave a trailing dot, dash or underscore."""
    # Reserve room for the hash suffix that skip_id truncation appends.
    hash_suffix_len = 1 + 8  # "_" + 8 hex chars
    keep = MAX_FILENAME_LENGTH - hash_suffix_len - len(separators)
    name = "c" * keep + separators + "d" * 50
    filename = get_filename(name, 7, skip_id=True)

    assert filename == _expected_skip_id_truncated(name)
    assert not filename.rsplit("_", 1)[0].endswith(tuple("._-"))


@pytest.mark.parametrize("separators", ["_", "-", ".", "._-", "-_.", "__", "..."])
def test_get_filename_strips_trailing_separators_before_id(separators: str) -> None:
    """No `name-_.123` artifacts: delimiters are stripped before the id is appended."""
    keep = MAX_FILENAME_LENGTH - len("_132") - len(separators)
    name = "c" * keep + separators + "d" * 50

    assert get_filename(name, 132) == "c" * keep + "_132"


def test_get_filename_clamps_to_zero_for_oversized_id_suffix() -> None:
    """A suffix longer than max_length must not negatively slice the slug."""
    model_id = 10**130  # 131 digits, longer than MAX_FILENAME_LENGTH

    filename = get_filename("Energy Sankey", model_id)

    # A negative slice would silently chop from the end and yield e.g. "Ener_10..0"
    assert filename == str(model_id)
    assert "Energy" not in filename


@pytest.mark.parametrize("max_length", range(0, len("_132") + 1))
def test_get_filename_clamps_to_zero_for_small_max_length(max_length: int) -> None:
    """`max_length` at or below the suffix width falls back to the id, never a slice."""
    filename = get_filename("Energy Sankey", 132, max_length=max_length)

    assert filename == "132"


def test_get_filename_respects_custom_max_length() -> None:
    # Short enough that no truncation (hence no hash) is needed.
    assert get_filename("Energy", 132, skip_id=True, max_length=6) == "Energy"
    assert get_filename("Energy Sankey", 132, max_length=10) == "Energy_132"
    # One character wider than the suffix leaves room for exactly one slug character.
    assert get_filename("Energy Sankey", 132, max_length=len("_132") + 1) == "E_132"


def test_get_filename_skip_id_falls_back_when_hash_cannot_fit() -> None:
    """Degenerate max_length that cannot hold the hash suffix falls back to the id."""
    assert get_filename("Energy Sankey", 132, skip_id=True, max_length=6) == "132"


@pytest.mark.parametrize(
    "model_name",
    [
        "",
        "   ",
        "...",
        "///",
        "___",
        "..",
        "\x00\x01\x02",
        "🥴🥴🥴",
        "你好",
        "🥴" * 300,
        "你" * 300,
    ],
)
@pytest.mark.parametrize("skip_id", [True, False])
def test_get_filename_falls_back_to_id_for_unusable_names(
    model_name: str, skip_id: bool
) -> None:
    """Empty, special-character and non-ASCII names degrade to the bare id."""
    assert get_filename(model_name, 42, skip_id) == "42"


def test_get_filename_keeps_hyphen_only_name() -> None:
    """`secure_filename` keeps bare hyphens, unlike dots and underscores."""
    assert get_filename("---", 42, skip_id=True) == "---"
    assert get_filename("---", 42) == "---_42"


def test_max_filename_length_fits_filesystem_component_limit() -> None:
    """Most filesystems reject a single path component longer than 255 characters."""
    assert MAX_FILENAME_LENGTH <= 255


def test_chart_export_path_fits_windows_max_path() -> None:
    """A long chart name must still unzip on Windows, which caps paths at 260."""
    filename = get_filename("Quarterly Revenue Breakdown by Region " * 10, 132)

    # Mirrors ExportChartsCommand._file_name plus the archive root written by
    # ChartRestApi.export and a typical extraction directory.
    entry = f"chart_export_20240101T000000/charts/{filename}.yaml"
    extracted = rf"C:\Users\username\Downloads\{entry}"

    assert len(extracted) < 260


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("normal", "normal"),
        ("a\x08b", "ab"),
        ("x\x09y", "xy"),
        ("x\ny", "xy"),
        ("x\ry", "xy"),
        ("\x00\x01\x02", ""),
        ("a\x7fb", "ab"),
        ("a\x9fb", "ab"),
    ],
)
def test_sanitize_title(raw: str, expected: str) -> None:
    assert sanitize_title(raw) == expected
