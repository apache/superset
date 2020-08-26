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
import logging

from superset.dao.base import BaseDAO
from superset.databases.filters import DatabaseFilter
from superset.extensions import db
from superset.models.core import Database

logger = logging.getLogger(__name__)


class DatabaseDAO(BaseDAO):
    model_cls = Database
    base_filter = DatabaseFilter

    @staticmethod
    def validate_uniqueness(database_name: str) -> bool:
        database_query = db.session.query(Database).filter(
            Database.database_name == database_name
        )
        return not db.session.query(database_query.exists()).scalar()

    @staticmethod
    def validate_update_uniqueness(database_id: int, database_name: str) -> bool:
        database_query = db.session.query(Database).filter(
            Database.database_name == database_name, Database.id != database_id,
        )
        return not db.session.query(database_query.exists()).scalar()

    @staticmethod
    def test_connection(  # pylint: disable=too-many-arguments, too-many-return-statements
        db_name: str,
        uri: str,
        server_cert: str,
        extra: str,
        impersonate_user: bool,
        encrypted_extra: str,
    ) -> None:
        if app.config["PREVENT_UNSAFE_DB_CONNECTIONS"]:
            check_sqlalchemy_uri(uri)
        # if the database already exists in the database, only its safe
        # (password-masked) URI would be shown in the UI and would be passed in the
        # form data so if the database already exists and the form was submitted
        # with the safe URI, we assume we should retrieve the decrypted URI to test
        # the connection.
        if db_name:
            existing_database = (
                db.session.query(Database)
                .filter_by(database_name=db_name)
                .one_or_none()
            )
            if existing_database and uri == existing_database.safe_sqlalchemy_uri():
                uri = existing_database.sqlalchemy_uri_decrypted

        # this is the database instance that will be tested
        database = Database(
            # extras is sent as json, but required to be a string in the Database
            # model
            server_cert,
            extra,
            impersonate_user,
            encrypted_extra,
        )
        database.set_sqlalchemy_uri(uri)
        database.db_engine_spec.mutate_db_for_connection_test(database)

        username = g.user.username if g.user is not None else None
        engine = database.get_sqla_engine(user_name=username)
        with closing(engine.connect()) as conn:
            conn.scalar(select([1]))
