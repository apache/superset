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

import copy
import json

from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from tests.unit_tests.fixtures.assets_configs import databases_config


def test_import_database_with_encrypted_extra(
    mocker: MockerFixture,
    session: Session,
) -> None:
    """
    Test that databases are imported with their encrypted extra info when available.
    """
    from superset import db, security_manager
    from superset.commands.database.importers.v1 import ImportDatabasesCommand
    from superset.models.core import Database

    mocker.patch.object(security_manager, "can_access", return_value=True)

    engine = db.session.get_bind()
    Database.metadata.create_all(engine)  # pylint: disable=no-member
    configs = copy.deepcopy(databases_config)
    configs["databases/examples.yaml"]["encrypted_extra"] = json.dumps(
        {"secret": "info"},
    )

    ImportDatabasesCommand._import(configs)
    uuid = configs["databases/examples.yaml"]["uuid"]
    database = db.session.query(Database).filter_by(uuid=uuid).one()
    assert database.encrypted_extra == '{"secret": "info"}'
