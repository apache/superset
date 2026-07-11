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
from pathlib import Path
from typing import Any
from unittest.mock import patch

FAKE_PACK = {"domain": "superset", "locale_data": {"superset": {"": {}}}}
FAKE_VERSION = "abc123def456"


def test_script_served_immutable_when_version_matches(client: Any) -> None:
    with (
        patch(
            "superset.views.core.get_language_pack_version",
            return_value=FAKE_VERSION,
        ),
        patch("superset.views.core.get_language_pack", return_value=FAKE_PACK),
    ):
        response = client.get(f"/language_pack/fr/{FAKE_VERSION}/script.js")

    assert response.status_code == 200
    assert response.mimetype == "application/javascript"
    body = response.get_data(as_text=True)
    assert body.startswith("window.__SUPERSET_LANGUAGE_PACK__ = ")
    assert '"domain": "superset"' in body
    cache_control = response.headers["Cache-Control"]
    assert "immutable" in cache_control
    assert "max-age=31536000" in cache_control
    assert "public" in cache_control


def test_script_not_cacheable_when_version_stale(client: Any) -> None:
    """A pre-upgrade HTML page may reference an old version: serve fresh
    content, but do not let caches pin it under the stale address."""
    with (
        patch(
            "superset.views.core.get_language_pack_version",
            return_value=FAKE_VERSION,
        ),
        patch("superset.views.core.get_language_pack", return_value=FAKE_PACK),
    ):
        response = client.get("/language_pack/fr/000000000000/script.js")

    assert response.status_code == 200
    assert "no-cache" in response.headers["Cache-Control"]
    assert "immutable" not in response.headers["Cache-Control"]


def test_script_404_when_pack_missing(client: Any) -> None:
    with patch(
        "superset.views.core.get_language_pack_version",
        return_value=None,
    ):
        response = client.get(f"/language_pack/xx/{FAKE_VERSION}/script.js")

    assert response.status_code == 404


def test_script_rejects_malformed_lang_and_version(client: Any) -> None:
    assert client.get(f"/language_pack/../{FAKE_VERSION}/script.js").status_code in (
        400,
        404,
    )
    assert client.get("/language_pack/fr/not-a-hash!/script.js").status_code == 400


def test_script_serves_only_the_requested_locale(client: Any) -> None:
    """The endpoint resolves exactly one pack: the locale in the URL."""
    with (
        patch(
            "superset.views.core.get_language_pack_version",
            return_value=FAKE_VERSION,
        ) as mock_version,
        patch(
            "superset.views.core.get_language_pack", return_value=FAKE_PACK
        ) as mock_pack,
    ):
        client.get(f"/language_pack/pt_BR/{FAKE_VERSION}/script.js")

    mock_version.assert_called_once_with("pt_BR")
    mock_pack.assert_called_once_with("pt_BR")


def test_spa_template_loads_pack_before_entry_bundle() -> None:
    """Static guard on spa.html: the language pack script tag must precede
    the entry bundle and stay a classic script (no async/defer). A deferred
    or reordered tag would let code-split chunks evaluate module-level
    `t('...')` calls before the translator is configured (issue #35330)."""
    import superset

    template: str = (
        Path(superset.__file__).parent / "templates" / "superset" / "spa.html"
    ).read_text()

    tag_start: int = template.index('<script src="{{ language_pack_src }}"')
    entry_start = template.index("js_bundle(assets_prefix, entry)")
    assert tag_start < entry_start

    script_tag = template[tag_start : template.index(">", tag_start)]
    assert "async" not in script_tag
    assert "defer" not in script_tag
