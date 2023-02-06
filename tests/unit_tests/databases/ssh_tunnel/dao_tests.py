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
from sqlalchemy.orm.session import Session


def test_create_ssh_tunnel():
    from superset.databases.dao import DatabaseDAO
    from superset.databases.ssh_tunnel.dao import SSHTunnelDAO
    from superset.databases.ssh_tunnel.models import SSHTunnel
    from superset.models.core import Database

    db = Database(id=1, database_name="my_database", sqlalchemy_uri="sqlite://")

    properties = {
        "database_id": db.id,
        "server_address": "123.132.123.1",
        "server_port": "3005",
        "username": "foo",
        "password": "bar",
    }

    result = SSHTunnelDAO.create(properties)

    assert result is not None
    assert isinstance(result, SSHTunnel)
