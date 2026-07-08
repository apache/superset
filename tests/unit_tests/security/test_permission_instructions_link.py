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

"""Unit tests for templated PERMISSION_INSTRUCTIONS_LINK rendering."""

from unittest.mock import MagicMock, patch

from superset.security.manager import (
    _render_permission_instructions_link,
    SupersetSecurityManager,
)
from superset.sql.parse import Table

MANAGER = "superset.security.manager"


def _render(
    template: str | None,
    *,
    username: str = "alice",
    anonymous: bool = False,
    **kwargs: str,
) -> str | None:
    with (
        patch(
            f"{MANAGER}.get_conf",
            return_value={"PERMISSION_INSTRUCTIONS_LINK": template},
        ),
        patch(f"{MANAGER}.g") as g_mock,
    ):
        g_mock.user.is_anonymous = anonymous
        g_mock.user.username = username
        return _render_permission_instructions_link(**kwargs)


def test_empty_or_unset_link_returns_none() -> None:
    assert _render("") is None
    assert _render(None) is None


def test_plain_link_without_placeholders_is_unchanged() -> None:
    assert _render("https://wiki.example.com/data-access") == (
        "https://wiki.example.com/data-access"
    )


def test_datasource_placeholders_are_filled_and_url_encoded() -> None:
    out = _render(
        "https://acme.example.com/req?id={datasource_id}"
        "&name={datasource_name}&u={username}",
        datasource_id="12",
        datasource_name="Quarterly Sales",
    )
    # space in the dataset name is URL-encoded; username injected from g.user
    assert out == ("https://acme.example.com/req?id=12&name=Quarterly%20Sales&u=alice")


def test_table_names_filled_and_encoded() -> None:
    out = _render(
        "https://acme.example.com/req?tables={table_names}",
        table_names="public.sales,public.users",
    )
    assert out == ("https://acme.example.com/req?tables=public.sales%2Cpublic.users")


def test_anonymous_user_renders_empty_username() -> None:
    out = _render(
        "https://acme.example.com/req?u={username}",
        anonymous=True,
    )
    assert out == "https://acme.example.com/req?u="


def test_unsupplied_placeholders_render_empty() -> None:
    # datasource link doesn't supply table_names; that token renders as
    # an empty value (matching the helper's documented behavior)
    out = _render(
        "https://acme.example.com/req?id={datasource_id}&t={table_names}",
        datasource_id="9",
    )
    assert out == "https://acme.example.com/req?id=9&t="


def test_get_datasource_access_link_pulls_from_datasource_data() -> None:
    ds = MagicMock()
    ds.data = {"id": 12, "name": "Quarterly Sales"}
    with (
        patch(
            f"{MANAGER}.get_conf",
            return_value={
                "PERMISSION_INSTRUCTIONS_LINK": (
                    "https://acme.example.com/req?id={datasource_id}"
                    "&name={datasource_name}"
                )
            },
        ),
        patch(f"{MANAGER}.g") as g_mock,
    ):
        g_mock.user.is_anonymous = False
        g_mock.user.username = "alice"
        out = SupersetSecurityManager.get_datasource_access_link(ds)
    assert out == "https://acme.example.com/req?id=12&name=Quarterly%20Sales"


def test_get_table_access_link_joins_table_names() -> None:
    sm = SupersetSecurityManager.__new__(SupersetSecurityManager)
    with (
        patch(
            f"{MANAGER}.get_conf",
            return_value={
                "PERMISSION_INSTRUCTIONS_LINK": (
                    "https://acme.example.com/req?tables={table_names}"
                )
            },
        ),
        patch(f"{MANAGER}.g") as g_mock,
    ):
        g_mock.user.is_anonymous = False
        g_mock.user.username = "alice"
        out = sm.get_table_access_link(
            {Table("sales", "public"), Table("users", "public")}
        )
    assert out is not None
    assert out.startswith("https://acme.example.com/req?tables=")
    assert "public.sales" in out
    assert "public.users" in out
