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
"""Tests that ``SubjectRestApi`` scopes its own list/show queries.

``SubjectRestApi`` exposes the principal directory (including ``user.email``),
so the ``EXCLUDE_USERS_FROM_LISTS`` and ``EXTRA_RELATED_QUERY_FILTERS``
deployment settings must apply to it, exactly as they do to the related-item
endpoints that feed the editor/viewer pickers.
"""

from unittest.mock import MagicMock

from flask_appbuilder.models.sqla.interface import SQLAInterface
from pytest_mock import MockerFixture
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from superset.subjects.filters import SubjectListFilter
from superset.subjects.models import Subject


def _compiled(query) -> str:
    engine = create_engine("sqlite://")
    return str(
        query.statement.compile(engine, compile_kwargs={"literal_binds": True}),
    )


def _subject_query():
    session = sessionmaker(bind=create_engine("sqlite://"))()
    return session.query(Subject)


def test_subject_list_filter_excludes_configured_users(
    mocker: MockerFixture,
) -> None:
    mock_current_app = MagicMock()
    mock_current_app.config = {
        "EXCLUDE_USERS_FROM_LISTS": ["service_account"],
        "EXTRA_RELATED_QUERY_FILTERS": {},
    }
    mocker.patch("superset.subjects.filters.current_app", mock_current_app)

    filter_ = SubjectListFilter("id", SQLAInterface(Subject))
    filtered = filter_.apply(_subject_query(), None)

    # Assert on the NOT IN predicate specifically: a plain "service_account"
    # membership check would pass for an (incorrect) IN filter just as well.
    assert "NOT IN ('service_account')" in _compiled(filtered)


def test_subject_list_filter_is_a_noop_without_configuration(
    mocker: MockerFixture,
) -> None:
    mock_current_app = MagicMock()
    mock_current_app.config = {}
    mocker.patch("superset.subjects.filters.current_app", mock_current_app)

    query = _subject_query()
    filter_ = SubjectListFilter("id", SQLAInterface(Subject))

    assert filter_.apply(query, None) is query


def test_subject_rest_api_registers_the_scoping_base_filter() -> None:
    from superset.subjects.api import SubjectRestApi

    registered = [spec[1] for spec in SubjectRestApi.base_filters]

    assert SubjectListFilter in registered
