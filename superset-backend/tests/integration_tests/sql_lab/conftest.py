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
import contextlib
from typing import Callable, ContextManager

import pytest
from flask_appbuilder.security.sqla import models as ab_models

from superset import db
from superset.models.sql_lab import Query
from superset.utils.core import shortid
from superset.utils.database import get_example_database


def force_async_run(allow_run_async: bool):
    example_db = get_example_database()
    orig_allow_run_async = example_db.allow_run_async

    example_db.allow_run_async = allow_run_async
    db.session.commit()

    yield example_db

    example_db.allow_run_async = orig_allow_run_async
    db.session.commit()


@pytest.fixture
def non_async_example_db(app_context):
    gen = force_async_run(False)
    yield next(gen)
    with contextlib.suppress(StopIteration):
        next(gen)


@pytest.fixture
def async_example_db(app_context):
    gen = force_async_run(True)
    yield next(gen)
    with contextlib.suppress(StopIteration):
        next(gen)


@pytest.fixture
def example_query(get_or_create_user: Callable[..., ContextManager[ab_models.User]]):
    with get_or_create_user("sqllab-test-user") as user:
        query = Query(
            client_id=shortid()[:10], database=get_example_database(), user=user
        )
        db.session.add(query)
        db.session.commit()
        yield query
        db.session.delete(query)
        db.session.commit()
