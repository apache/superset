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
Revises: c233f5365c9e
Create Date: 2026-04-07 15:15:15.412396

"""

from uuid import uuid4

import sqlalchemy as sa
from alembic import op
from sqlalchemy.exc import OperationalError
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy_utils import UUIDType

from superset import db
from superset.migrations.shared.utils import assign_uuids

# revision identifiers, used by Alembic.
revision = "884a2115ebd3"
down_revision = "c233f5365c9e"

Base = declarative_base()


class ImportMixin:
    id = sa.Column(sa.Integer, primary_key=True)
    uuid = sa.Column(UUIDType(binary=True), primary_key=False, default=uuid4)


class AnnotationLayer(ImportMixin, Base):
    __tablename__ = "annotation_layer"


class Annotation(ImportMixin, Base):
    __tablename__ = "annotation"


def upgrade() -> None:
    bind = op.get_bind()
    session = db.Session(bind=bind)

    try:
        with op.batch_alter_table("annotation_layer") as batch_op:
            batch_op.add_column(
                sa.Column(
                    "uuid", UUIDType(binary=True), primary_key=False, default=uuid4
                )
            )
    except OperationalError:
        pass

    assign_uuids(AnnotationLayer, session)

    try:
        with op.batch_alter_table("annotation_layer") as batch_op:
            batch_op.create_unique_constraint("uq_annotation_layer_uuid", ["uuid"])
    except OperationalError:
        pass

    try:
        with op.batch_alter_table("annotation") as batch_op:
            batch_op.add_column(
                sa.Column(
                    "uuid", UUIDType(binary=True), primary_key=False, default=uuid4
                )
            )
    except OperationalError:
        pass

    assign_uuids(Annotation, session)

    try:
        with op.batch_alter_table("annotation") as batch_op:
            batch_op.create_unique_constraint("uq_annotation_uuid", ["uuid"])
    except OperationalError:
        pass


def downgrade() -> None:
    with op.batch_alter_table("annotation") as batch_op:
        batch_op.drop_constraint("uq_annotation_uuid", type_="unique")
        batch_op.drop_column("uuid")

    with op.batch_alter_table("annotation_layer") as batch_op:
        batch_op.drop_constraint("uq_annotation_layer_uuid", type_="unique")
        batch_op.drop_column("uuid")
