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
from typing import Any, Dict, Optional

from superset.dao.base import BaseDAO
from superset.databases.filters import DatabaseFilter
from superset.databases.ssh_tunnel.models import SSHTunnel
from superset.extensions import db
from superset.models.core import Database
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.models.sql_lab import TabState
from superset.utils.core import DatasourceType

logger = logging.getLogger(__name__)


class DatabaseDAO(BaseDAO):
    model_cls = Database
    base_filter = DatabaseFilter

    @classmethod
    def update(
        cls,
        model: Database,
        properties: Dict[str, Any],
        commit: bool = True,
    ) -> Database:
        """
        Unmask ``encrypted_extra`` before updating.

        When a database is edited the user sees a masked version of ``encrypted_extra``,
        depending on the engine spec. Eg, BigQuery will mask the ``private_key`` attribute
        of the credentials.

        The masked values should be unmasked before the database is updated.
        """
        if "encrypted_extra" in properties:
            properties["encrypted_extra"] = model.db_engine_spec.unmask_encrypted_extra(
                model.encrypted_extra,
                properties["encrypted_extra"],
            )

        return super().update(model, properties, commit)

    @staticmethod
    def validate_uniqueness(database_name: str) -> bool:
        database_query = db.session.query(Database).filter(
            Database.database_name == database_name
        )
        return not db.session.query(database_query.exists()).scalar()

    @staticmethod
    def validate_update_uniqueness(database_id: int, database_name: str) -> bool:
        database_query = db.session.query(Database).filter(
            Database.database_name == database_name,
            Database.id != database_id,
        )
        return not db.session.query(database_query.exists()).scalar()

    @staticmethod
    def get_database_by_name(database_name: str) -> Optional[Database]:
        return (
            db.session.query(Database)
            .filter(Database.database_name == database_name)
            .one_or_none()
        )

    @staticmethod
    def build_db_for_connection_test(
        server_cert: str, extra: str, impersonate_user: bool, encrypted_extra: str
    ) -> Database:
        return Database(
            server_cert=server_cert,
            extra=extra,
            impersonate_user=impersonate_user,
            encrypted_extra=encrypted_extra,
        )

    @classmethod
    def get_related_objects(cls, database_id: int) -> Dict[str, Any]:
        database: Any = cls.find_by_id(database_id)
        datasets = database.tables
        dataset_ids = [dataset.id for dataset in datasets]

        charts = (
            db.session.query(Slice)
            .filter(
                Slice.datasource_id.in_(dataset_ids),
                Slice.datasource_type == DatasourceType.TABLE,
            )
            .all()
        )
        chart_ids = [chart.id for chart in charts]

        dashboards = (
            (
                db.session.query(Dashboard)
                .join(Dashboard.slices)
                .filter(Slice.id.in_(chart_ids))
            )
            .distinct()
            .all()
        )

        sqllab_tab_states = (
            db.session.query(TabState).filter(TabState.database_id == database_id).all()
        )

        return dict(
            charts=charts, dashboards=dashboards, sqllab_tab_states=sqllab_tab_states
        )

    @classmethod
    def get_ssh_tunnel(cls, database_id: int) -> Optional[SSHTunnel]:
        ssh_tunnel = (
            db.session.query(SSHTunnel)
            .filter(SSHTunnel.database_id == database_id)
            .one_or_none()
        )

        return ssh_tunnel
