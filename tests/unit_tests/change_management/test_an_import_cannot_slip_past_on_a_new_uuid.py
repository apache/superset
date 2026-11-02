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
"""A bundle does not escape review by carrying a new uuid.

The gate asked whether any uuid in the bundle already existed, and refused
only then. But the host does not match an incoming asset on ``uuid`` alone:
``import_from_dict`` matches on a disjunction of *every* unique constraint
the model declares. A config with a fresh uuid is still matched onto a live
row through one of the others, a dashboard by its ``slug`` and a dataset by
its table name within a database.

So an import carrying new uuids found no collision, raised no refusal, and
replaced the live asset with nobody reviewing it. QA saw dashboard 9's title
and dataset 13's ``count`` metric both change live, with the viewer seeing
them (R5-03).

The host ships the lookup that resolves the identity it will really bind,
built from the model's own constraint metadata, so the gate asks it instead
of keeping a second copy of the rules.
"""

from __future__ import annotations

from typing import Any

import pytest
import yaml
from asset_approval import bindings
from asset_approval.exceptions import ImportOverwriteRefusedError
from pytest_mock import MockerFixture


class _Column:
    """Enough of a SQLAlchemy column for the uuid lookup to be built."""

    def in_(self, _values: Any) -> Any:
        return self


class _Dashboard:
    """Identified by uuid or slug, as ``Dashboard`` is."""

    uuid = _Column()


def _bundle(**files: Any) -> dict[str, str]:
    return {name: yaml.safe_dump(config) for name, config in files.items()}


@pytest.fixture
def gate(mocker: MockerFixture) -> dict[str, Any]:
    """The gate with no uuid collision, so only the identity check is left."""
    # The refusal is a no-op while the feature is off, so the gate's
    # decision would be invisible.
    mocker.patch("asset_approval.gate.is_enabled", return_value=True)
    mocker.patch("asset_approval.gate.is_replaying", return_value=False)
    mocker.patch.object(
        bindings, "_prefix_models", return_value={"dashboards/": _Dashboard}
    )
    # Nothing in the bundle matches an existing uuid.
    session = mocker.MagicMock()
    session.query.return_value.filter.return_value.first.return_value = None
    mocker.patch("superset.db.session", session)
    identity = mocker.patch(
        "superset.commands.importers.v1.utils.find_existing_by_import_identity",
        return_value=None,
    )
    # A dashboard needs nothing resolved; the dataset case has its own test.
    mocker.patch.object(bindings, "_resolved_for_identity", side_effect=lambda c: c)
    return {"identity": identity}


def _run(contents: dict[str, str]) -> None:
    command = type("Command", (), {"contents": contents, "overwrite": True})()
    bindings._refuse_if_bundle_lands_on_a_live_asset(command, ["dashboards/"])


def test_a_fresh_uuid_landing_on_a_live_slug_is_refused(
    gate: dict[str, Any]
) -> None:
    """The bug. No uuid matched, so the old gate said nothing."""
    gate["identity"].return_value = object()

    with pytest.raises(ImportOverwriteRefusedError):
        _run(_bundle(**{"dashboards/sales.yaml": {"uuid": "new", "slug": "sales"}}))


def test_a_bundle_that_lands_on_nothing_still_imports(
    gate: dict[str, Any]
) -> None:
    """S-06: a first-time import must keep working, overwrite flag or not."""
    gate["identity"].return_value = None

    _run(_bundle(**{"dashboards/new.yaml": {"uuid": "new", "slug": "brand-new"}}))


def test_the_identity_lookup_is_asked_for_every_config(
    gate: dict[str, Any]
) -> None:
    """One collision anywhere in the bundle is enough to refuse it."""
    gate["identity"].side_effect = [None, object()]

    with pytest.raises(ImportOverwriteRefusedError):
        _run(
            _bundle(
                **{
                    "dashboards/a.yaml": {"uuid": "a", "slug": "a"},
                    "dashboards/b.yaml": {"uuid": "b", "slug": "collides"},
                }
            )
        )


def test_a_config_that_cannot_collide_is_not_looked_up(
    gate: dict[str, Any], mocker: MockerFixture
) -> None:
    """``_resolved_for_identity`` answering None means "not reachable".

    A dataset whose database is not here yet cannot land on a dataset
    inside that database, and asking would match on the table name alone.
    """
    mocker.patch.object(bindings, "_resolved_for_identity", return_value=None)

    _run(_bundle(**{"dashboards/x.yaml": {"uuid": "x", "slug": "x"}}))

    gate["identity"].assert_not_called()


def test_malformed_yaml_is_left_to_the_host_to_reject() -> None:
    """Unchanged: the gate declines to turn it into a refusal about review."""
    assert bindings._bundle_configs({"dashboards/x.yaml": "{["}, ["dashboards/"]) == {
        "dashboards/": []
    }


def test_a_config_that_is_not_a_mapping_is_skipped() -> None:
    assert bindings._bundle_configs(
        {"dashboards/x.yaml": "- a\n- b\n"}, ["dashboards/"]
    ) == {"dashboards/": []}


def test_whole_configs_are_read_not_just_uuids() -> None:
    """The identity check needs the rest of the config, so it is kept."""
    configs = bindings._bundle_configs(
        _bundle(**{"dashboards/s.yaml": {"uuid": "u", "slug": "s", "title": "T"}}),
        ["dashboards/"],
    )

    assert configs["dashboards/"] == [{"uuid": "u", "slug": "s", "title": "T"}]
