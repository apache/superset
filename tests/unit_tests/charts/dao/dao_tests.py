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

from datetime import datetime
from typing import Iterator

import pytest
from flask import g
from flask_appbuilder.security.sqla.models import User
from sqlalchemy.orm.session import Session

from superset import security_manager
from superset.models.core import FavStar
from superset.utils.core import DatasourceType


@pytest.fixture
def session_with_data(session: Session) -> Iterator[Session]:
    from superset.models.slice import Slice

    engine = session.get_bind()
    Slice.metadata.create_all(engine)  # pylint: disable=no-member

    user_obj = User(
        id=1,
        username="test",
        first_name="test",
        last_name="test",
        email="test@superset.com",
    )
    session.add(user_obj)

    slice_obj = Slice(
        id=1,
        datasource_id=1,
        datasource_type=DatasourceType.TABLE,
        datasource_name="tmp_perm_table",
        slice_name="slice_name",
        owners=[user_obj],
    )
    session.add(slice_obj)

    slice_obj = Slice(
        id=2,
        datasource_id=1,
        datasource_type=DatasourceType.TABLE,
        datasource_name="tmp_perm_table",
        slice_name="other_slice",
    )
    session.add(slice_obj)

    session.commit()
    yield session
    session.rollback()


def test_slice_find_by_id_skip_base_filter(session_with_data: Session) -> None:
    from superset.charts.dao import ChartDAO
    from superset.models.slice import Slice

    result = ChartDAO.find_by_id(1, session=session_with_data, skip_base_filter=True)

    assert result
    assert 1 == result.id
    assert "slice_name" == result.slice_name
    assert isinstance(result, Slice)


def test_datasource_find_by_id_skip_base_filter_not_found(
    session_with_data: Session,
) -> None:
    from superset.charts.dao import ChartDAO

    result = ChartDAO.find_by_id(
        125326326, session=session_with_data, skip_base_filter=True
    )
    assert result is None


def test_get_empty_user_slices() -> None:
    from superset.charts.dao import ChartDAO

    g.user = security_manager.find_user(username="test")
    result = ChartDAO.user_slices(2)

    assert result == []


def test_get_own_user_slices(session_with_data: Session) -> None:
    from superset.charts.dao import ChartDAO

    g.user = security_manager.find_user(username="test")
    result = ChartDAO.user_slices(1)

    assert len(result) == 1
    assert result[0].Slice.slice_name == "slice_name"
    assert result[0].FavStar is None


def test_get_user_slices_with_fav(session_with_data: Session) -> None:
    from superset.charts.dao import ChartDAO

    g.user = security_manager.find_user(username="test")
    fav_obj = FavStar(
        class_name="slice",
        obj_id=2,
        user_id=1,
        dttm=datetime.now(),
    )
    session_with_data.add(fav_obj)

    result = ChartDAO.user_slices(1)

    assert len(result) == 2
    assert result[0].Slice.slice_name == "other_slice"
    assert result[0].FavStar == fav_obj
    assert result[1].Slice.slice_name == "slice_name"
    assert result[1].FavStar is None
