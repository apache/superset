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
# pylint: disable=C,R,W
import logging

from superset.connectors.druid.models import DruidCluster
from superset.models.core import Database

DATABASES_KEY = "databases"
DRUID_CLUSTERS_KEY = "druid_clusters"


def export_schema_to_dict(back_references):
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


def export_to_dict(session, recursive, back_references, include_defaults):
    """Exports databases and druid clusters to a dictionary"""
    logging.info("Starting export")
    dbs = session.query(Database)
    databases = [
        database.export_to_dict(
            recursive=recursive,
            include_parent_ref=back_references,
            include_defaults=include_defaults,
        )
        for database in dbs
    ]
    logging.info("Exported %d %s", len(databases), DATABASES_KEY)
    cls = session.query(DruidCluster)
    clusters = [
        cluster.export_to_dict(
            recursive=recursive,
            include_parent_ref=back_references,
            include_defaults=include_defaults,
        )
        for cluster in cls
    ]
    logging.info("Exported %d %s", len(clusters), DRUID_CLUSTERS_KEY)
    data = dict()
    if databases:
        data[DATABASES_KEY] = databases
    if clusters:
        data[DRUID_CLUSTERS_KEY] = clusters
    return data


def import_from_dict(session, data, sync=[]):
    """Imports databases and druid clusters from dictionary"""
    if isinstance(data, dict):
        logging.info("Importing %d %s", len(data.get(DATABASES_KEY, [])), DATABASES_KEY)
        for database in data.get(DATABASES_KEY, []):
            Database.import_from_dict(session, database, sync=sync)

        logging.info(
            "Importing %d %s", len(data.get(DRUID_CLUSTERS_KEY, [])), DRUID_CLUSTERS_KEY
        )
        for datasource in data.get(DRUID_CLUSTERS_KEY, []):
            DruidCluster.import_from_dict(session, datasource, sync=sync)
        session.commit()
    else:
        logging.info("Supplied object is not a dictionary.")
