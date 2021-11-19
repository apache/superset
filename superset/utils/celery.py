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
from contextlib import contextmanager
from typing import Iterator

from sqlalchemy import create_engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import NullPool

from superset import app, db

logger = logging.getLogger(__name__)

# Null pool is used for the celery workers due process forking side effects.
# For more info see: https://github.com/apache/superset/issues/10530
@contextmanager
def session_scope(nullpool: bool) -> Iterator[Session]:
    """Provide a transactional scope around a series of operations."""
    database_uri = app.config["SQLALCHEMY_DATABASE_URI"]
    if "sqlite" in database_uri:
        logger.warning(
            "SQLite Database support for metadata databases will be removed \
            in a future version of Superset."
        )
    if nullpool:
        engine = create_engine(database_uri, poolclass=NullPool)
        session_class = sessionmaker()
        session_class.configure(bind=engine)
        session = session_class()
    else:
        session = db.session()
        session.commit()  # HACK

    try:
        yield session
        session.commit()
    except SQLAlchemyError as ex:
        session.rollback()
        logger.exception(ex)
        raise
    finally:
        session.close()
