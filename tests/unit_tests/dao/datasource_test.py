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


def test_build_dataset_query_filters_by_schema(session: Session) -> None:
    """``build_dataset_query(schema_filter=...)`` restricts rows to that schema.

    The existing fixtures above are all ``schema="main"``, so this test adds a
    contrasting ``schema="public"`` row to prove non-matching schemas are excluded.
    """
    from superset import db, security_manager
    from superset.connectors.sqla.models import SqlaTable
    from superset.daos.datasource import DatasourceDAO
    from superset.models.core import Database

    SqlaTable.metadata.create_all(session.get_bind())

    database = Database(database_name="schema_db", sqlalchemy_uri="sqlite://")
    main_t = SqlaTable(table_name="main_t", schema="main", database=database)
    public_t = SqlaTable(table_name="public_t", schema="public", database=database)
    db.session.add_all([database, main_t, public_t])
    db.session.flush()

    with patch.object(
        security_manager, "can_access_all_datasources", return_value=True
    ):
        query = DatasourceDAO.build_dataset_query(
            name_filter=None, sql_filter=None, schema_filter="main"
        )
        names = {row.table_name for row in session.execute(query)}

    assert "main_t" in names
    assert "public_t" not in names


def _dataset_names(session: Session, **kwargs: object) -> set[str]:
    """Names returned by ``build_dataset_query`` with full datasource access."""
    from superset import security_manager
    from superset.daos.datasource import DatasourceDAO

    with patch.object(
        security_manager, "can_access_all_datasources", return_value=True
    ):
        query = DatasourceDAO.build_dataset_query(
            name_filter=None,
            sql_filter=None,
            **kwargs,  # type: ignore[arg-type]
        )
        return {row.table_name for row in session.execute(query)}


def test_build_dataset_query_filters_by_editor(session: Session) -> None:
    """``editors_filter`` keeps datasets the subject edits, whatever its type.

    Editors are ``Subject`` rows (user, role or group). The Editor dropdown
    sends the ``Subject.id``, so a role or group editor must match too, and a
    dataset with several editors must be returned once.
    """
    from superset import db
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.core import Database
    from superset.subjects.models import Subject
    from superset.subjects.types import SubjectType

    SqlaTable.metadata.create_all(session.get_bind())

    database = Database(database_name="editor_db", sqlalchemy_uri="sqlite://")
    user_editor = Subject(label="alice", type=SubjectType.USER)
    role_editor = Subject(label="analysts", type=SubjectType.ROLE)
    other_editor = Subject(label="bob", type=SubjectType.USER)
    mine = SqlaTable(table_name="mine", schema="main", database=database)
    shared = SqlaTable(table_name="shared", schema="main", database=database)
    theirs = SqlaTable(table_name="theirs", schema="main", database=database)
    unowned = SqlaTable(table_name="unowned", schema="main", database=database)
    db.session.add_all(
        [
            database,
            user_editor,
            role_editor,
            other_editor,
            mine,
            shared,
            theirs,
            unowned,
        ]
    )
    db.session.flush()
    mine.editors = [user_editor]
    shared.editors = [user_editor, role_editor, other_editor]
    theirs.editors = [other_editor]
    db.session.flush()

    assert _dataset_names(session, editors_filter=user_editor.id) == {"mine", "shared"}
    assert _dataset_names(session, editors_filter=role_editor.id) == {"shared"}
    names = _dataset_names(session, editors_filter=other_editor.id)
    assert names == {"shared", "theirs"}


def test_build_dataset_query_filters_by_changed_by(session: Session) -> None:
    from superset import db
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.core import Database

    SqlaTable.metadata.create_all(session.get_bind())

    database = Database(database_name="changed_by_db", sqlalchemy_uri="sqlite://")
    by_one = SqlaTable(table_name="by_one", schema="main", database=database)
    by_two = SqlaTable(table_name="by_two", schema="main", database=database)
    db.session.add_all([database, by_one, by_two])
    db.session.flush()
    by_one.changed_by_fk = 101
    by_two.changed_by_fk = 102
    db.session.flush()

    assert _dataset_names(session, changed_by_filter=101) == {"by_one"}
    assert _dataset_names(session, changed_by_filter=102) == {"by_two"}


def test_build_dataset_query_filters_by_certification(session: Session) -> None:
    """``certified_filter`` follows ``DatasetCertifiedFilter``: a dataset is
    certified when ``extra`` carries a ``certification`` key."""
    from superset import db
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.core import Database
    from superset.utils import json

    SqlaTable.metadata.create_all(session.get_bind())

    database = Database(database_name="cert_db", sqlalchemy_uri="sqlite://")
    certified = SqlaTable(
        table_name="certified",
        schema="main",
        database=database,
        extra=json.dumps({"certification": {"certified_by": "qa", "details": "ok"}}),
    )
    warned = SqlaTable(
        table_name="warned",
        schema="main",
        database=database,
        extra=json.dumps({"warning_markdown": "stale"}),
    )
    plain = SqlaTable(table_name="plain", schema="main", database=database)
    db.session.add_all([database, certified, warned, plain])
    db.session.flush()

    assert _dataset_names(session, certified_filter=True) == {"certified"}
    assert _dataset_names(session, certified_filter=False) == {"warned", "plain"}


def test_build_semantic_view_query_filters_by_changed_by(session: Session) -> None:
    """Semantic views are audited too, so Modified by applies to them."""
    import uuid

    from superset import db, security_manager
    from superset.daos.datasource import DatasourceDAO
    from superset.semantic_layers.models import SemanticLayer, SemanticView

    SemanticView.metadata.create_all(session.get_bind())

    layer = SemanticLayer(
        uuid=uuid.uuid4(), name="layer", type="test", configuration="{}"
    )
    mine = SemanticView(
        uuid=uuid.uuid4(),
        name="mine",
        semantic_layer_uuid=layer.uuid,
        configuration="{}",
    )
    theirs = SemanticView(
        uuid=uuid.uuid4(),
        name="theirs",
        semantic_layer_uuid=layer.uuid,
        configuration="{}",
    )
    db.session.add_all([layer, mine, theirs])
    db.session.flush()
    mine.changed_by_fk = 101
    theirs.changed_by_fk = 102
    db.session.flush()

    with patch.object(
        security_manager, "can_access_all_datasources", return_value=True
    ):
        query = DatasourceDAO.build_semantic_view_query(
            name_filter=None, changed_by_filter=101
        )
        names = {row.table_name for row in session.execute(query)}

    assert names == {"mine"}
