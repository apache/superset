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
"""remove sl_ tables

Revision ID: 02f4f7811799
Revises: f7b6750b67e8
Create Date: 2024-05-24 11:31:57.115586

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.engine.reflection import Inspector

# revision identifiers, used by Alembic.
revision = "02f4f7811799"
down_revision = "f7b6750b67e8"

tables_to_drop = [
    "sl_dataset_columns",
    "sl_table_columns",
    "sl_dataset_tables",
    "sl_columns",
    "sl_tables",
    "sl_dataset_users",
    "sl_datasets"
]

def get_foreign_keys(table_name, insp):
    return insp.get_foreign_keys(table_name)

def drop_tables(tables):
    for table in tables:
        op.drop_table(table)

def get_drop_order(tables, insp):
    # Create a mapping of table names to their foreign key constraints
    fk_map = {table: get_foreign_keys(table, insp) for table in tables}
    
    # List to store the sorted tables
    sorted_tables = []

    # Set of tables that have already been added to the sorted list
    added_tables = set()

    def add_table(table):
        # Add the table's foreign key dependencies first
        for fk in fk_map[table]:
            referenced_table = fk['referred_table']
            if referenced_table in tables and referenced_table not in added_tables:
                add_table(referenced_table)
        # Add the table itself
        if table not in added_tables:
            sorted_tables.append(table)
            added_tables.add(table)

    # Add all tables, ensuring dependencies are handled
    for table in tables:
        if table not in added_tables:
            add_table(table)

    return sorted_tables

def upgrade():
    bind = op.get_bind()
    insp = Inspector.from_engine(bind)
    db_dialect = bind.engine.url.drivername

    sorted_tables_to_drop = get_drop_order(tables_to_drop, insp)

    if db_dialect == "postgresql":
        for table in sorted_tables_to_drop:
            fks = get_foreign_keys(table, insp)
            for fk in fks:
                constraint = fk["name"]
                if constraint:
                    op.execute(
                        f"ALTER TABLE {table} RENAME CONSTRAINT {constraint} TO {constraint}_old"
                    )
        
        # Drop tables after renaming constraints
        drop_tables(sorted_tables_to_drop)

        for table in sorted_tables_to_drop:
            fks = get_foreign_keys(table, insp)
            for fk in fks:
                constraint = fk["name"]
                if constraint:
                    op.drop_constraint(
                        f"{constraint}_old",
                        table,
                        type_="foreignkey",
                    )
    else:
        drop_tables(sorted_tables_to_drop)

def downgrade():
    op.create_table(
        "sl_datasets",
        sa.Column("uuid", sa.Numeric(precision=16), nullable=True),
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("database_id", sa.Integer(), nullable=False),
        sa.Column("is_physical", sa.Boolean(), nullable=True),
        sa.Column("is_managed_externally", sa.Boolean(), nullable=False),
        sa.Column("name", sa.Text(), nullable=True),
        sa.Column("expression", sa.Text(), nullable=True),
        sa.Column("external_url", sa.Text(), nullable=True),
        sa.Column("extra_json", sa.Text(), nullable=True),
        sa.Column("created_by_fk", sa.Integer(), nullable=True),
        sa.Column("changed_by_fk", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(
            ["changed_by_fk"],
            ["ab_user.id"],
        ),
        sa.ForeignKeyConstraint(
            ["created_by_fk"],
            ["ab_user.id"],
        ),
        sa.ForeignKeyConstraint(
            ["database_id"],
            ["dbs.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("uuid"),
    )
    op.create_table(
        "sl_tables",
        sa.Column("uuid", sa.Numeric(precision=16), nullable=True),
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("database_id", sa.Integer(), nullable=False),
        sa.Column("is_managed_externally", sa.Boolean(), nullable=False),
        sa.Column("catalog", sa.Text(), nullable=True),
        sa.Column("schema", sa.Text(), nullable=True),
        sa.Column("name", sa.Text(), nullable=True),
        sa.Column("external_url", sa.Text(), nullable=True),
        sa.Column("extra_json", sa.Text(), nullable=True),
        sa.Column("created_by_fk", sa.Integer(), nullable=True),
        sa.Column("changed_by_fk", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(
            ["changed_by_fk"],
            ["ab_user.id"],
        ),
        sa.ForeignKeyConstraint(
            ["created_by_fk"],
            ["ab_user.id"],
        ),
        sa.ForeignKeyConstraint(
            ["database_id"],
            ["dbs.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("uuid"),
    )
    op.create_table(
        "sl_columns",
        sa.Column("uuid", sa.Numeric(precision=16), nullable=True),
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("is_aggregation", sa.Boolean(), nullable=False),
        sa.Column("is_additive", sa.Boolean(), nullable=False),
        sa.Column("is_dimensional", sa.Boolean(), nullable=False),
        sa.Column("is_filterable", sa.Boolean(), nullable=False),
        sa.Column("is_increase_desired", sa.Boolean(), nullable=False),
        sa.Column("is_managed_externally", sa.Boolean(), nullable=False),
        sa.Column("is_partition", sa.Boolean(), nullable=False),
        sa.Column("is_physical", sa.Boolean(), nullable=False),
        sa.Column("is_temporal", sa.Boolean(), nullable=False),
        sa.Column("is_spatial", sa.Boolean(), nullable=False),
        sa.Column("name", sa.Text(), nullable=True),
        sa.Column("type", sa.Text(), nullable=True),
        sa.Column("unit", sa.Text(), nullable=True),
        sa.Column("expression", sa.Text(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("warning_text", sa.Text(), nullable=True),
        sa.Column("external_url", sa.Text(), nullable=True),
        sa.Column("extra_json", sa.Text(), nullable=True),
        sa.Column("created_by_fk", sa.Integer(), nullable=True),
        sa.Column("changed_by_fk", sa.Integer(), nullable=True),
        sa.Column("advanced_data_type", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["changed_by_fk"],
            ["ab_user.id"],
        ),
        sa.ForeignKeyConstraint(
            ["created_by_fk"],
            ["ab_user.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("uuid"),
    )
    op.create_table(
        "sl_dataset_users",
        sa.Column("dataset_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["dataset_id"],
            ["sl_datasets.id"],
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["ab_user.id"],
        ),
        sa.PrimaryKeyConstraint("dataset_id", "user_id"),
    )
    op.create_table(
        "sl_dataset_tables",
        sa.Column("dataset_id", sa.Integer(), nullable=False),
        sa.Column("table_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["dataset_id"],
            ["sl_datasets.id"],
        ),
        sa.ForeignKeyConstraint(
            ["table_id"],
            ["sl_tables.id"],
        ),
        sa.PrimaryKeyConstraint("dataset_id", "table_id"),
    )
    op.create_table(
        "sl_table_columns",
        sa.Column("table_id", sa.Integer(), nullable=False),
        sa.Column("column_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["column_id"],
            ["sl_columns.id"],
        ),
        sa.ForeignKeyConstraint(
            ["table_id"],
            ["sl_tables.id"],
        ),
        sa.PrimaryKeyConstraint("table_id", "column_id"),
    )
    op.create_table(
        "sl_dataset_columns",
        sa.Column("dataset_id", sa.Integer(), nullable=False),
        sa.Column("column_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["column_id"],
            ["sl_columns.id"],
        ),
        sa.ForeignKeyConstraint(
            ["dataset_id"],
            ["sl_datasets.id"],
        ),
        sa.PrimaryKeyConstraint("dataset_id", "column_id"),
    )
