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

from unittest.mock import patch

import pytest
import yaml
from pytest_mock import MockerFixture
from sqlalchemy.orm import Query
from sqlalchemy.orm.session import Session

from superset.commands.importers.v1.utils import import_tag
from superset.extensions import feature_flag_manager
from superset.tags.models import Tag, TaggedObject

OBJECT_ID = 1
OBJECT_TYPE = "chart"

CONTENTS = {
    "tags.yaml": yaml.dump(
        {
            "tags": [
                {"tag_name": "tag_1", "description": "first"},
                {"tag_name": "tag_2", "description": "second"},
            ]
        }
    )
}


@pytest.fixture
def session_with_schema(session: Session) -> Session:
    from superset.connectors.sqla.models import SqlaTable

    engine = session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

    return session


def test_conflicting_tag_does_not_poison_the_session(
    session_with_schema: Session, mocker: MockerFixture
) -> None:
    """
    A tag that loses a concurrent-insert race must not take the rest of the import
    down with it.

    Two importers can both observe that a TaggedObject is absent; the loser's insert
    then violates uix_tagged_object. Without a SAVEPOINT around each tag that leaves
    the Session in pending-rollback state, so the next statement -- for an unrelated
    tag -- fails with PendingRollbackError and the whole import is lost (#42912).

    The race is reproduced by committing the association up front and making the
    existence check miss it once, which is exactly what the losing importer sees.
    """
    conflicting_tag = Tag(name="tag_1", description="first", type="custom")
    session_with_schema.add(conflicting_tag)
    session_with_schema.flush()
    session_with_schema.add(
        TaggedObject(
            tag_id=conflicting_tag.id, object_id=OBJECT_ID, object_type=OBJECT_TYPE
        )
    )
    session_with_schema.commit()

    # the losing importer's existence check runs before the winner commits, so it
    # comes back empty and the insert that follows collides
    real_first = Query.first
    calls = {"count": 0}

    def racing_first(self: Query, *args: object, **kwargs: object) -> object:
        calls["count"] += 1
        if calls["count"] == 1:
            return None
        return real_first(self, *args, **kwargs)

    mocker.patch.object(Query, "first", racing_first)

    with patch.object(feature_flag_manager, "is_feature_enabled", return_value=True):
        new_tag_ids = import_tag(
            ["tag_1", "tag_2"],
            CONTENTS,
            OBJECT_ID,
            OBJECT_TYPE,
            session_with_schema,
        )

    # tag_2 survived the conflict on tag_1, and the session still works afterwards
    surviving = session_with_schema.query(Tag).filter_by(name="tag_2").one()
    assert surviving.id in new_tag_ids

    associations = (
        session_with_schema.query(TaggedObject)
        .filter_by(object_id=OBJECT_ID, object_type=OBJECT_TYPE)
        .all()
    )
    assert {assoc.tag_id for assoc in associations} == {
        conflicting_tag.id,
        surviving.id,
    }


def test_all_tags_import_when_nothing_conflicts(
    session_with_schema: Session,
) -> None:
    with patch.object(feature_flag_manager, "is_feature_enabled", return_value=True):
        new_tag_ids = import_tag(
            ["tag_1", "tag_2"],
            CONTENTS,
            OBJECT_ID,
            OBJECT_TYPE,
            session_with_schema,
        )

    assert len(new_tag_ids) == 2
    assert {tag.name for tag in session_with_schema.query(Tag).all()} == {
        "tag_1",
        "tag_2",
    }
    assert (
        session_with_schema.query(TaggedObject)
        .filter_by(object_id=OBJECT_ID, object_type=OBJECT_TYPE)
        .count()
        == 2
    )
