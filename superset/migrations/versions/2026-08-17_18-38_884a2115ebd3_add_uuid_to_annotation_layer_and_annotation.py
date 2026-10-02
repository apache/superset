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
"""add_uuid_to_annotation_layer_and_annotation

Revision ID: 884a2115ebd3
Revises: 95d8a99c822e
Create Date: 2026-08-11 18:38:15.412396

"""

from uuid import uuid4

import sqlalchemy as sa
from alembic import op
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy_utils import UUIDType

from superset import db
from superset.migrations.shared.utils import (
    add_columns,
    assign_uuids,
    drop_columns,
    has_table,
    paginated_update,
)

# revision identifiers, used by Alembic.
revision = "884a2115ebd3"
down_revision = "95d8a99c822e"

Base = declarative_base()


class ImportMixin:
    id = sa.Column(sa.Integer, primary_key=True)
    uuid = sa.Column(UUIDType(binary=True), primary_key=False, default=uuid4)


class AnnotationLayer(ImportMixin, Base):
    __tablename__ = "annotation_layer"


class Annotation(ImportMixin, Base):
    __tablename__ = "annotation"


MODELS = (AnnotationLayer, Annotation)


def _backfill_uuids(model: type[ImportMixin], session: sa.orm.Session) -> None:
    """
    Give every row without a UUID a new one, leaving existing UUIDs alone.

    On a freshly added column every row is empty, so ``assign_uuids`` fills the
    whole table (a single UPDATE on Postgres and MySQL). If an earlier run
    stopped partway, only the rows still missing a UUID are filled, so UUIDs
    that bundles may already reference are kept.
    """
    missing = session.query(model).filter(model.uuid.is_(None))
    missing_count = missing.count()
    if not missing_count:
        return
    if missing_count == session.query(model).count():
        assign_uuids(model, session)
        return
    for obj in paginated_update(missing):
        obj.uuid = uuid4()


def _has_unique_constraint(table_name: str, constraint_name: str) -> bool:
    """Whether ``table_name`` has a unique constraint named ``constraint_name``."""
    inspector = sa.inspect(op.get_bind())
    return any(
        constraint["name"] == constraint_name
        for constraint in inspector.get_unique_constraints(table_name)
    )


def upgrade() -> None:
    session = db.Session(bind=op.get_bind())

    for model in MODELS:
        table_name = model.__tablename__
        if not has_table(table_name):
            continue
        add_columns(
            table_name,
            sa.Column("uuid", UUIDType(binary=True), primary_key=False, default=uuid4),
        )
        _backfill_uuids(model, session)

        constraint_name = f"uq_{table_name}_uuid"
        if not _has_unique_constraint(table_name, constraint_name):
            with op.batch_alter_table(table_name) as batch_op:
                batch_op.create_unique_constraint(constraint_name, ["uuid"])


def downgrade() -> None:
    for model in reversed(MODELS):
        table_name = model.__tablename__
        if not has_table(table_name):
            continue
        constraint_name = f"uq_{table_name}_uuid"
        if _has_unique_constraint(table_name, constraint_name):
            with op.batch_alter_table(table_name) as batch_op:
                batch_op.drop_constraint(constraint_name, type_="unique")
        drop_columns(table_name, "uuid")
