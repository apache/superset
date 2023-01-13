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

from typing import Iterator

import pytest
from flask_appbuilder.security.sqla.models import User
from sqlalchemy.orm.session import Session

from superset.utils.core import DatasourceType

SAMPLE_USERS = [1, 2, 3, 4]


@pytest.fixture
def session_with_data(session: Session) -> Iterator[Session]:
    from superset.models.slice import Slice

    engine = session.get_bind()
    Slice.metadata.create_all(engine)  # pylint: disable=no-member

    slice_obj = Slice(
        id=1,
        datasource_id=1,
        datasource_type=DatasourceType.TABLE,
        datasource_name="tmp_perm_table",
        slice_name="slice_name",
    )

    session.add(slice_obj)
    session.commit()
    yield session
    session.rollback()


@pytest.fixture
def session_with_data_and_owners(session: Session) -> Iterator[Session]:
    from superset.models.slice import Slice

    obj_owners = list()
    engine = session.get_bind()
    Slice.metadata.create_all(engine)

    for user in SAMPLE_USERS:
        test_user = User(
            id=user,
            username=str(user),
            first_name=str(user),
            last_name=str(user),
            email=str(user),
        )
        session.add(test_user)
        obj_owners.append(test_user)

    slice_obj = Slice(
        id=1,
        datasource_id=1,
        datasource_type=DatasourceType.TABLE,
        datasource_name="test_table",
        slice_name="sliced_name",
        owners=obj_owners,
    )

    session.add(slice_obj)
    session.commit()
    session.flush()
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


def test_delete_slice_check_slice_user(session_with_data_and_owners: Session) -> None:
    from superset.charts.dao import ChartDAO
    from superset.models.slice import slice_user

    result = ChartDAO.find_by_id(
        1, session=session_with_data_and_owners, skip_base_filter=True
    )
    assert result
    slice_user_model = session_with_data_and_owners.execute(
        slice_user.select().where(slice_user.c.user_id == SAMPLE_USERS[0])
    )
    assert slice_user_model is not None
    ChartDAO.delete(result)
    session_with_data_and_owners.flush()
    # requery the session to check to make sure everything is deleted properly
    result_after_delete = ChartDAO.find_by_id(
        1, session=session_with_data_and_owners, skip_base_filter=True
    )
    slice_user_model_delete = session_with_data_and_owners.execute(
        slice_user.select().where(slice_user.c.slice_id == 1)
    )
    assert result_after_delete is None
    assert slice_user_model_delete is None
