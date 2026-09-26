#  Licensed to the Apache Software Foundation (ASF) under one
#  or more contributor license agreements.  See the NOTICE file
#  distributed with this work for additional information
#  regarding copyright ownership.  The ASF licenses this file
#  to you under the Apache License, Version 2.0 (the
#  "License"); you may not use this file except in compliance
#  with the License.  You may obtain a copy of the License at
#
#  http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing,
#  software distributed under the License is distributed on an
#  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
#  KIND, either express or implied.  See the License for the
#  specific language governing permissions and limitations
#  under the License.
from __future__ import annotations

import logging
from typing import Any, TYPE_CHECKING

from flask import current_app as app
from flask_babel import gettext as __
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.sql import compiler

from superset.constants import EXAMPLES_DB_UUID

if TYPE_CHECKING:
    from flask_appbuilder.security.sqla.models import User

    from superset.connectors.sqla.models import Database

logging.getLogger("MARKDOWN").setLevel(logging.INFO)
logger = logging.getLogger(__name__)


# TODO: duplicate code with DatabaseDao, below function should be moved or use dao
def get_or_create_db(
    database_name: str, sqlalchemy_uri: str, always_create: bool | None = True
) -> Database:
    # pylint: disable=import-outside-toplevel
    from superset import db
    from superset.models import core as models

    database = (
        db.session.query(models.Database).filter_by(database_name=database_name).first()
    )

    # databases with a fixed UUID
    uuids = {
        "examples": EXAMPLES_DB_UUID,
    }

    if not database and always_create:
        logger.info("Creating database reference for %s", database_name)
        database = models.Database(
            database_name=database_name, uuid=uuids.get(database_name)
        )
        db.session.add(database)
        database.set_sqlalchemy_uri(sqlalchemy_uri)

    # todo: it's a bad idea to do an update in a get/create function
    if database and database.sqlalchemy_uri_decrypted != sqlalchemy_uri:
        database.set_sqlalchemy_uri(sqlalchemy_uri)

    db.session.flush()
    return database


def get_example_database() -> Database:
    # pylint: disable=import-outside-toplevel

    return get_or_create_db("examples", app.config["SQLALCHEMY_EXAMPLES_URI"])


def get_main_database() -> Database:
    # pylint: disable=import-outside-toplevel

    db_uri = app.config["SQLALCHEMY_DATABASE_URI"]
    return get_or_create_db("main", db_uri)


# TODO - the below method used by tests so should move there but should move together
# with above function... think of how to refactor it
def remove_database(database: Database) -> None:
    # pylint: disable=import-outside-toplevel
    from superset import db

    db.session.delete(database)
    db.session.flush()


def warm_and_release_connection(instance: Any, *relationships: str) -> None:
    """
    Eagerly load the named relationships on ``instance``, then release the
    current session's DB connection back to the pool without detaching any
    object in the session.

    Prefer this over ``db.session.close()`` before slow, non-DB work (a
    long-running cursor execution, a results-backend fetch, CPU-bound
    decompress/deserialize work) that still needs attributes already
    loaded on session objects: ``close()`` detaches every object in the
    session -- including ``g.user``, not just ``instance`` -- so a later
    attribute access anywhere in the request can raise on a detached
    instance or silently open a fresh connection. Committing with
    ``expire_on_commit`` disabled instead releases the connection while
    keeping objects attached and their already-loaded attributes valid.
    """
    # pylint: disable=import-outside-toplevel
    from superset import db

    for relationship in relationships:
        getattr(instance, relationship)

    # ``db.session`` is a ``scoped_session`` proxy: it only forwards a fixed
    # allowlist of attributes to the real ``Session`` (bind, dirty, deleted,
    # new, identity_map, is_active, autoflush, no_autoflush, info).
    # ``expire_on_commit`` isn't on that list, so setting it on ``db.session``
    # directly would silently no-op -- it has to be set on the real Session
    # returned by calling the proxy.
    session = db.session()
    session.expire_on_commit = False
    try:
        session.commit()  # pylint: disable=consider-using-transaction
    finally:
        session.expire_on_commit = True


def find_user_for_impersonation(username: str) -> User | None:
    """
    Resolve the login backing an impersonated database session.

    ``find_user`` is a metadata-DB read, so it inherits any failed transaction
    left behind earlier in the request and reports ``PendingRollbackError``
    instead of the original fault — blaming this lookup for an unrelated
    failure. Roll back and retry once so a poisoned session doesn't cost us the
    lookup.

    The resolved value becomes the identity the analytic database connects as,
    so a lookup that still fails must not degrade to the un-resolved login:
    that would silently query as a different principal than the one being
    impersonated. Raise instead.

    :param username: the Superset login to resolve
    :return: the matching user, or ``None`` if no such login exists
    :raises SupersetErrorException: if the lookup fails even after a rollback
    """
    # pylint: disable=import-outside-toplevel
    from superset import db
    from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
    from superset.exceptions import SupersetErrorException
    from superset.extensions import security_manager

    try:
        return security_manager.find_user(username=username)
    except SQLAlchemyError:
        logger.warning(
            "Impersonation lookup for %s failed on a broken transaction; "
            "rolling back and retrying once.",
            username,
            exc_info=True,
        )
        db.session.rollback()  # pylint: disable=consider-using-transaction

    try:
        return security_manager.find_user(username=username)
    except SQLAlchemyError as ex:
        raise SupersetErrorException(
            SupersetError(
                message=__(
                    "Could not resolve the user to impersonate on the database "
                    "connection. The query was not run, because running it "
                    "would have connected as the wrong user."
                ),
                error_type=SupersetErrorType.GENERIC_DB_ENGINE_ERROR,
                level=ErrorLevel.ERROR,
            )
        ) from ex


def apply_mariadb_ddl_fix() -> None:
    """
    Fix MariaDB "NO CYCLE" syntax issue - MariaDB uses "NOCYCLE" (no space).

    This fix will be included in SQLAlchemy v2.1.0.
    See: https://github.com/sqlalchemy/sqlalchemy/blob/rel_2_1_0b1/lib/sqlalchemy/dialects/mysql/_mariadb_shim.py
    """
    original_visit_create_sequence = compiler.DDLCompiler.visit_create_sequence

    def patched_visit_create_sequence(self: Any, create: Any, **kw: Any) -> str:
        text = original_visit_create_sequence(self, create, **kw)
        dialect_name = getattr(self.dialect, "name", "") or ""
        if "mariadb" in dialect_name.lower():
            return text.replace("NO CYCLE", "NOCYCLE")
        return text

    compiler.DDLCompiler.visit_create_sequence = patched_visit_create_sequence
