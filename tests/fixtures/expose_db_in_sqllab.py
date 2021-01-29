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
import pytest

from superset import db
from superset.utils.core import get_example_database
from tests.test_app import app


@pytest.fixture()
def expose_in_sqllab():
    with app.app_context():
        example_db = get_example_database()
        example_db.expose_in_sqllab = True
        db.session.commit()
        yield
        example_db.expose_in_sqllab = False
        db.session.commit()
