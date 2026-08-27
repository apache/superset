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
from __future__ import annotations

from typing import Generator

import pytest

from superset import db
from superset.daos.subject import SubjectDAO
from superset.subjects.types import SubjectType


@pytest.fixture
def after_each() -> Generator[None, None, None]:
    yield
    db.session.rollback()


def test_create_and_find(after_each: None) -> None:  # noqa: F811
    subject = SubjectDAO.create(attributes={"label": "Alice", "type": SubjectType.USER})
    db.session.flush()

    assert SubjectDAO.find_by_id(subject.id) is subject
    assert SubjectDAO.find_one_or_none(label="Alice") is subject


def test_find_all_and_filter_by(after_each: None) -> None:  # noqa: F811
    SubjectDAO.create(attributes={"label": "RoleA", "type": SubjectType.ROLE})
    SubjectDAO.create(attributes={"label": "GroupA", "type": SubjectType.GROUP})
    db.session.flush()

    labels = {s.label for s in SubjectDAO.find_all()}
    assert {"RoleA", "GroupA"} <= labels

    roles = SubjectDAO.filter_by(type=SubjectType.ROLE)
    assert all(s.type == SubjectType.ROLE for s in roles)


def test_delete(after_each: None) -> None:  # noqa: F811
    subject = SubjectDAO.create(attributes={"label": "Temp", "type": SubjectType.USER})
    db.session.flush()

    SubjectDAO.delete([subject])
    db.session.flush()

    assert SubjectDAO.find_one_or_none(label="Temp") is None
