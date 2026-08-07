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
from datetime import datetime, timezone
from unittest.mock import patch

from sqlalchemy.orm.session import Session


def test_build_dataset_query_excludes_soft_deleted(session: Session) -> None:
    """The Core ``select`` in ``build_dataset_query`` must filter
    ``deleted_at IS NULL`` explicitly.

    The ``SoftDeleteMixin`` listener runs on ``do_orm_execute`` only, so it
    never fires for this Core statement — the explicit ``where`` clause is
    the sole thing keeping soft-deleted datasets out of the combined
    datasource list and its pagination counts. This test fails if that
    clause is removed.
    """
    from superset import db, security_manager
    from superset.connectors.sqla.models import SqlaTable
    from superset.daos.datasource import DatasourceDAO
    from superset.models.core import Database

    SqlaTable.metadata.create_all(session.get_bind())

    database = Database(database_name="ds_q_db", sqlalchemy_uri="sqlite://")
    live = SqlaTable(table_name="live_t", schema="main", database=database)
    hidden = SqlaTable(
        table_name="hidden_t",
        schema="main",
        database=database,
        deleted_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
    )
    db.session.add_all([database, live, hidden])
    db.session.flush()

    with patch.object(
        security_manager, "can_access_all_datasources", return_value=True
    ):
        query = DatasourceDAO.build_dataset_query(name_filter=None, sql_filter=None)
        # Core execution — exactly the path the ORM listener cannot see.
        names = {row.table_name for row in session.execute(query)}

    assert "live_t" in names
    assert "hidden_t" not in names
