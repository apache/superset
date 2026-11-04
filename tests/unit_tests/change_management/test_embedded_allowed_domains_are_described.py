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
"""Embedded allowed domains are described, including the empty list.

The gate emits the command name ``upsert_embedded``; the description tested
for ``"embedded"``, so the descriptive branch was dead code and the reviewer
saw the raw key ``allowed_domains`` and the word "Changed".

An empty list is not "no domains": the embedded view only checks the
referrer when the list has something in it, so empty means *any* site may
embed the dashboard. That is the most consequential value the field can hold
and it must not be drawn as a dash.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

from asset_approval import api, gate


def _upsert(domains: list[str]) -> Any:
    return SimpleNamespace(
        operation="update",
        command_args={gate.COMMAND_KEY: gate.UPSERT_EMBEDDED_COMMAND},
        payload_dict={"allowed_domains": domains},
    )


def test_the_domains_are_listed_beside_the_domains_they_replace() -> None:
    embedded = SimpleNamespace(allow_domain_list="old.example.com")
    asset = SimpleNamespace(embedded=[embedded])

    [entry] = api.describe_changes(_upsert(["a.example.com", "b.example.com"]), asset)

    assert entry == {
        "field": "embedding_allowed_domains",
        "before": "old.example.com",
        "after": "a.example.com,b.example.com",
    }


def test_embedding_a_dashboard_that_was_not_embedded_says_so() -> None:
    [entry] = api.describe_changes(_upsert(["a.example.com"]), SimpleNamespace(embedded=[]))

    assert entry["before"] == "Not embedded"


def test_an_empty_list_says_any_site_may_embed_it() -> None:
    asset = SimpleNamespace(embedded=[SimpleNamespace(allow_domain_list="a.example.com")])

    [entry] = api.describe_changes(_upsert([]), asset)

    assert entry["after"] == api.ANY_SITE
    assert "any site" in api.ANY_SITE.lower()


def test_turning_embedding_off_is_described() -> None:
    request = SimpleNamespace(
        operation="update",
        command_args={gate.COMMAND_KEY: "delete_embedded"},
        payload_dict={},
    )

    [entry] = api.describe_changes(request, SimpleNamespace(embedded=[]))

    assert (entry["before"], entry["after"]) == ("Enabled", "Disabled")
