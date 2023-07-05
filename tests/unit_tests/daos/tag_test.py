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
from collections.abc import Iterator

import pytest
from sqlalchemy.orm.session import Session


@pytest.fixture
def session_with_data(session: Session) -> Iterator[Session]:
    from superset.models.slice import Slice
    from superset.tags.models import UserFavoriteTag

    engine = session.get_bind()
    UserFavoriteTag.metadata.create_all(engine)  # pylint: disable=no-member

    user_favorite_tag = UserFavoriteTag(user_id=1, tag_id=1)
    session.add(user_favorite_tag)

    session.commit()
    yield session
    session.rollback()


def test_user_favorite_tag(mocker):
    from superset.daos.tag import TagDAO

    mock_tag = mocker.Mock()
    mock_tag.id = 123
    mock_find_by_id = mocker.patch(
        "superset.daos.tag.TagDAO.find_by_id", return_value=mock_tag
    )

    mock_user_fav_tag_inst = mocker.Mock()
    mock_user_fav_tag = mocker.patch(
        "superset.daos.tag.UserFavoriteTag", return_value=mock_user_fav_tag_inst
    )

    mock_get_id = mocker.patch("superset.daos.tag.g")
    mock_get_id.user.return_value.get_id.return_value = 456

    mock_db_add = mocker.patch("superset.daos.tag.db.session.add")
    mock_db_commit = mocker.patch("superset.daos.tag.db.session.commit")

    TagDAO.user_favorite_tag(123)

    mock_find_by_id.assert_called_once_with(123)
    mock_db_add.assert_called_once_with(mock_user_fav_tag_inst)
    mock_db_commit.assert_called_once()


def test_delete_user_favorite_tag(session_with_data: Session):
    from superset.daos.tag import TagDAO
    from superset.tags.models import UserFavoriteTag

    TagDAO.delete_user_favorite_tag(1)

    assert session_with_data.query(UserFavoriteTag).filter_by(id=1).first() is None
