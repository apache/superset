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
from superset.daos.role import RoleDAO
from superset.subjects.models import Subject
from superset.subjects.types import SubjectType


@pytest.fixture
def after_each() -> Generator[None, None, None]:
    yield
    db.session.rollback()


def test_create_syncs_subject(after_each: None) -> None:  # noqa: F811
    role = RoleDAO.create(attributes={"name": "TestSyncRole"})
    db.session.flush()

    subject = (
        db.session.query(Subject)
        .filter_by(role_id=role.id, type=SubjectType.ROLE)
        .one_or_none()
    )
    assert subject is not None
    assert subject.label == "TestSyncRole"


def test_update_syncs_subject(after_each: None) -> None:  # noqa: F811
    role = RoleDAO.create(attributes={"name": "RenameMe"})
    db.session.flush()

    RoleDAO.update(item=role, attributes={"name": "Renamed"})
    db.session.flush()

    subject = (
        db.session.query(Subject)
        .filter_by(role_id=role.id, type=SubjectType.ROLE)
        .one()
    )
    assert subject.label == "Renamed"


def test_delete_removes_subject(after_each: None) -> None:  # noqa: F811
    role = RoleDAO.create(attributes={"name": "DeleteMe"})
    db.session.flush()
    role_id = role.id

    assert (
        db.session.query(Subject)
        .filter_by(role_id=role_id, type=SubjectType.ROLE)
        .one_or_none()
    ) is not None

    RoleDAO.delete([role])
    db.session.flush()

    assert (
        db.session.query(Subject)
        .filter_by(role_id=role_id, type=SubjectType.ROLE)
        .one_or_none()
    ) is None
