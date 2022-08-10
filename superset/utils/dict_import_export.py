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
from typing import Any, Dict

from sqlalchemy.orm import Session

from superset.models.core import Database

EXPORT_VERSION = "1.0.0"
DATABASES_KEY = "databases"
logger = logging.getLogger(__name__)


def export_schema_to_dict(back_references: bool) -> Dict[str, Any]:
    """Exports the supported import/export schema to a dictionary"""
    databases = [
        Database.export_schema(recursive=True, include_parent_ref=back_references)
    ]
    data = {}
    if databases:
        data[DATABASES_KEY] = databases
    return data


def export_to_dict(
    session: Session, recursive: bool, back_references: bool, include_defaults: bool
) -> Dict[str, Any]:
    """Exports databases and druid clusters to a dictionary"""
    logger.info("Starting export")
    dbs = session.query(Database)
    databases = [
        database.export_to_dict(
            recursive=recursive,
            include_parent_ref=back_references,
            include_defaults=include_defaults,
        )
        for database in dbs
    ]
    logger.info("Exported %d %s", len(databases), DATABASES_KEY)
    data = {}
    if databases:
        data[DATABASES_KEY] = databases
    return data
