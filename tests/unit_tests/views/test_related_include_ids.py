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
"""Tests that ``?include_ids=`` cannot bypass related-field scoping.

The ``/related/<column>`` endpoints scope their results with
``base_related_field_filters``. The ``include_ids`` argument force-fetches
specific rows, and must not be able to resolve principals that those filters
deliberately hide.

``include_ids`` exists so an edit form can render a value that is already
associated with a record but falls outside the current page or search of the
picker. Scoping it has an accepted consequence: a value that is already
associated but has since been hidden by ``EXCLUDE_USERS_FROM_LISTS`` or
``EXTRA_RELATED_QUERY_FILTERS`` stops resolving, so the form shows the bare id
rather than a label. That is deliberate — a principal a deployment has chosen
to hide must not be resolvable through a side door, and the association itself
is untouched in the database.
"""

from typing import Any

from flask_appbuilder.models.filters import BaseFilter
from flask_appbuilder.models.sqla.interface import SQLAInterface
from pytest_mock import MockerFixture
from sqlalchemy import Column, create_engine, Integer, String
from sqlalchemy.orm import declarative_base, sessionmaker

from superset.views.base_api import BaseSupersetModelRestApi

Base = declarative_base()


class Principal(Base):  # type: ignore[misc, valid-type]
    __tablename__ = "principal"

    id = Column(Integer, primary_key=True)
    name = Column(String(50))

    def __repr__(self) -> str:
        return str(self.name)


class ExcludeHiddenFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    """Stand-in for a deployment's principal-scoping filter."""

    name = "Exclude hidden"
    arg_name = "exclude_hidden"

    def apply(self, query: Any, value: Any) -> Any:
        return query.filter(Principal.name != "hidden")


def _session():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    session.add_all(
        [Principal(id=1, name="visible"), Principal(id=2, name="hidden")],
    )
    session.commit()
    return session


def _api(**overrides: Any) -> BaseSupersetModelRestApi:
    api = BaseSupersetModelRestApi.__new__(BaseSupersetModelRestApi)
    api.text_field_rel_fields = {}
    api.extra_fields_rel_fields = {}
    api.base_related_field_filters = {}
    for key, value in overrides.items():
        setattr(api, key, value)
    return api


def test_include_ids_cannot_resolve_a_filtered_out_principal(
    mocker: MockerFixture,
) -> None:
    """Holds even when the principal is already associated with the record.

    This is the case an edit form hits: the client sends the id of a current
    owner, and a hidden principal must still not resolve to a label.
    """
    session = _session()
    mocker.patch("superset.views.base_api.db").session = session
    api = _api(
        base_related_field_filters={
            "owners": [["name", ExcludeHiddenFilter, None]],
        },
    )
    result: list[dict[str, Any]] = []

    api._add_extra_ids_to_result(  # noqa: SLF001
        SQLAInterface(Principal, session), "owners", [1, 2], result
    )

    assert [row["value"] for row in result] == [1]


def test_include_ids_still_resolves_when_no_filters_are_configured(
    mocker: MockerFixture,
) -> None:
    session = _session()
    mocker.patch("superset.views.base_api.db").session = session
    api = _api()
    result: list[dict[str, Any]] = []

    api._add_extra_ids_to_result(  # noqa: SLF001
        SQLAInterface(Principal, session), "owners", [1, 2], result
    )

    assert sorted(row["value"] for row in result) == [1, 2]
