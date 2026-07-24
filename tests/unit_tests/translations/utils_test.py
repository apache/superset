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
from collections.abc import Iterator

import pytest

from superset.translations import utils as translations_utils
from superset.translations.utils import (
    get_language_pack_filename,
    get_language_pack_version,
)


@pytest.fixture(autouse=True)
def _clear_version_cache() -> Iterator[None]:
    translations_utils.ALL_LANGUAGE_PACK_VERSIONS.clear()
    yield
    translations_utils.ALL_LANGUAGE_PACK_VERSIONS.clear()


def test_language_pack_filename_resolution() -> None:
    assert get_language_pack_filename("fr").endswith("/fr/LC_MESSAGES/messages.json")
    assert get_language_pack_filename("en").endswith("/empty_language_pack.json")
    assert get_language_pack_filename("").endswith("/empty_language_pack.json")


def test_version_is_short_content_hash(tmp_path, monkeypatch) -> None:
    pack_file = tmp_path / "fr" / "LC_MESSAGES" / "messages.json"
    pack_file.parent.mkdir(parents=True)
    pack_file.write_bytes(b'{"domain": "superset"}')
    monkeypatch.setattr(translations_utils, "DIR", str(tmp_path))

    version = get_language_pack_version("fr")

    expected = hashlib.sha256(b'{"domain": "superset"}').hexdigest()[:12]
    assert version == expected


def test_version_is_cached_and_changes_with_content(tmp_path, monkeypatch) -> None:
    pack_file = tmp_path / "fr" / "LC_MESSAGES" / "messages.json"
    pack_file.parent.mkdir(parents=True)
    pack_file.write_bytes(b"{}")
    monkeypatch.setattr(translations_utils, "DIR", str(tmp_path))

    first = get_language_pack_version("fr")
    pack_file.write_bytes(b'{"changed": true}')
    # Cached within the process lifetime: same version until cache cleared.
    assert get_language_pack_version("fr") == first

    translations_utils.ALL_LANGUAGE_PACK_VERSIONS.clear()
    assert get_language_pack_version("fr") != first


def test_version_none_when_pack_missing(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(translations_utils, "DIR", str(tmp_path))
    assert get_language_pack_version("xx") is None
