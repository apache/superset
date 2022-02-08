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

from typing import TYPE_CHECKING

from .....common.logger_utils import log
from . import PersistenceDomainObjectsEngine

if TYPE_CHECKING:
    from flask import Flask
    from flask_sqlalchemy import SessionBase, SQLAlchemy

    from ...domain_objects import SupersetDomain


@log
class AppContextBasedPersistence(PersistenceDomainObjectsEngine):
    _app: Flask
    _db: SQLAlchemy

    def __init__(self, app: Flask, db: SQLAlchemy) -> None:
        self._app = app
        self._db = db

    def persist(self, domain_obj: SupersetDomain) -> None:
        with self._app.app_context():
            session: SessionBase = self._db.session()
            session.add(domain_obj)
            session.commit()

    def clean(self, domain_obj: SupersetDomain) -> None:
        with self._app.app_context():
            session: SessionBase = self._db.session()
            session.delete(domain_obj)
            session.commit()
