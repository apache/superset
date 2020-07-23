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
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from superset.connectors.druid.models import DruidCluster
from superset.models.core import Database

DATABASES_KEY = "databases"
DRUID_CLUSTERS_KEY = "druid_clusters"
logger = logging.getLogger(__name__)


def export_schema_to_dict(back_references: bool) -> Dict[str, Any]:
    """Exports the supported import/export schema to a dictionary"""
    databases = [
        Database.export_schema(recursive=True, include_parent_ref=back_references)
    ]
    clusters = [
        DruidCluster.export_schema(recursive=True, include_parent_ref=back_references)
    ]
    data = dict()
    if databases:
        data[DATABASES_KEY] = databases
    if clusters:
        data[DRUID_CLUSTERS_KEY] = clusters
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
    cls = session.query(DruidCluster)
    clusters = [
        cluster.export_to_dict(
            recursive=recursive,
            include_parent_ref=back_references,
            include_defaults=include_defaults,
        )
        for cluster in cls
    ]
    logger.info("Exported %d %s", len(clusters), DRUID_CLUSTERS_KEY)
    data = dict()
    if databases:
        data[DATABASES_KEY] = databases
    if clusters:
        data[DRUID_CLUSTERS_KEY] = clusters
    return data


def import_from_dict(
    session: Session, data: Dict[str, Any], sync: Optional[List[str]] = None
) -> None:
    """Imports databases and druid clusters from dictionary"""
    if not sync:
        sync = []
    if isinstance(data, dict):
        logger.info("Importing %d %s", len(data.get(DATABASES_KEY, [])), DATABASES_KEY)
        for database in data.get(DATABASES_KEY, []):
            Database.import_from_dict(session, database, sync=sync)

        logger.info(
            "Importing %d %s", len(data.get(DRUID_CLUSTERS_KEY, [])), DRUID_CLUSTERS_KEY
        )
        for datasource in data.get(DRUID_CLUSTERS_KEY, []):
            DruidCluster.import_from_dict(session, datasource, sync=sync)
        session.commit()
    else:
        logger.info("Supplied object is not a dictionary.")
