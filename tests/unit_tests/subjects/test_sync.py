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
"""Tests for Subject sync helpers."""

from sqlalchemy.orm.session import Session

from superset.subjects.models import Subject
from superset.subjects.types import SubjectType

SECONDARY_LABEL_LENGTH = Subject.secondary_label.type.length
EXTRA_SEARCH_LENGTH = Subject.extra_search.type.length


def _setup(session: Session) -> None:
    from flask_appbuilder.security.sqla.models import Group, User

    engine = session.get_bind()
    for model in (User, Group, Subject):
        model.metadata.create_all(engine)  # pylint: disable=no-member


def test_sync_user_subject_truncates_long_email(session: Session) -> None:
    """Emails longer than the Subject columns are truncated, not rejected."""
    from flask_appbuilder.security.sqla.models import User

    from superset.subjects.sync import sync_user_subject

    _setup(session)
    email = f"{'a' * 300}@example.com"
    assert len(email) > SECONDARY_LABEL_LENGTH
    user = User(
        first_name="Long",
        last_name="Email",
        username="long_email",
        email=email,
    )
    session.add(user)
    session.flush()

    sync_user_subject(user)
    session.flush()

    subject = session.query(Subject).filter_by(user_id=user.id).one()
    assert subject.type == SubjectType.USER
    assert subject.label == "Long Email"
    assert subject.secondary_label == email[:SECONDARY_LABEL_LENGTH]
    assert subject.extra_search == email[:EXTRA_SEARCH_LENGTH]

    # Updating an existing Subject truncates as well.
    user.email = f"{'b' * 300}@example.com"
    sync_user_subject(user)
    session.flush()

    session.refresh(subject)
    assert subject.secondary_label == user.email[:SECONDARY_LABEL_LENGTH]
    assert subject.extra_search == user.email[:EXTRA_SEARCH_LENGTH]


def test_sync_user_subject_keeps_short_email(session: Session) -> None:
    """Values that fit the column are stored unchanged."""
    from flask_appbuilder.security.sqla.models import User

    from superset.subjects.sync import sync_user_subject

    _setup(session)
    user = User(
        first_name="Short",
        last_name="Email",
        username="short_email",
        email="short@example.com",
    )
    session.add(user)
    session.flush()

    sync_user_subject(user)
    session.flush()

    subject = session.query(Subject).filter_by(user_id=user.id).one()
    assert subject.secondary_label == "short@example.com"
    assert subject.extra_search == "short@example.com"


def test_sync_group_subject_truncates_long_description(session: Session) -> None:
    """Group descriptions longer than the Subject column are truncated."""
    from flask_appbuilder.security.sqla.models import Group

    from superset.subjects.sync import sync_group_subject

    _setup(session)
    description = "d" * 512
    group = Group(name="long_desc", label="Long Description", description=description)
    session.add(group)
    session.flush()

    sync_group_subject(group)
    session.flush()

    subject = session.query(Subject).filter_by(group_id=group.id).one()
    assert subject.type == SubjectType.GROUP
    assert subject.label == "Long Description"
    assert subject.secondary_label == description[:SECONDARY_LABEL_LENGTH]
    assert subject.extra_search == "long_desc"

    # Updating an existing Subject truncates as well.
    group.description = "e" * 400
    sync_group_subject(group)
    session.flush()

    session.refresh(subject)
    assert subject.secondary_label == "e" * SECONDARY_LABEL_LENGTH
