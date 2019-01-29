"""make_table_unique_within_db_and_schema

Licensed to the Apache Software Foundation (ASF) under one or more
contributor license agreements.  See the NOTICE file distributed with
this work for additional information regarding copyright ownership.
The ASF licenses this file to You under the Apache License, Version 2.0
(the "License"); you may not use this file except in compliance with
the License.  You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

Revision ID: 8d49a37823bf
Revises: 18dc26817ad2
Create Date: 2019-01-20 11:44:14.640628

"""

# revision identifiers, used by Alembic.
revision = '8d49a37823bf'
down_revision = '18dc26817ad2'

from alembic import op
import sqlalchemy as sa

from superset.utils.core import generic_find_uq_constraint_name
from collections import OrderedDict

def is_unique_constraint(constraint):
    return constraint and isinstance(constraint, sa.UniqueConstraint)

def is_sqlite():
    bind = op.get_bind()
    return bind and bind.dialect and bind.dialect.name and bind.dialect.name.startswith('sqlite')

def upgrade():
    bind = op.get_bind()
    insp = sa.engine.reflection.Inspector.from_engine(bind)
    constraints = insp.get_unique_constraints('tables')
    table_new_uniq_constraint = ['database_id', 'schema', 'table_name']
    if not constraints:
        constraints = []
    # Sqlite cannot handle constraint change and has to recreate the table
    if is_sqlite():
        existing_table = sa.Table(
            'tables', sa.MetaData(),
            autoload=True,
            autoload_with=op.get_bind())
        existing_table.constraints = set([c for c in existing_table.constraints if not is_unique_constraint(c)])
        # We don't want to preserve the existing table_args for the tables table
        with op.batch_alter_table('tables', copy_from=existing_table, recreate="always") as batch_op:
            batch_op.create_unique_constraint('uq_table_in_db_schema', table_new_uniq_constraint)
    else:
        op.create_unique_constraint('uq_table_in_db_schema', 'tables', table_new_uniq_constraint)
        # and for other databases we need to explicitly remove the earlier constraints
        # otherwise they don't get removed as with above copy_from approach
        for c in constraints:
            name = c.get('name', None)
            if name:
                op.drop_constraint(name, 'tables', type_='unique')

def downgrade():
    table_name_existing_unique = ['database_id', 'table_name']
    if is_sqlite():
        with op.batch_alter_table('tables', recreate="always") as batch_op:
            batch_op.create_unique_constraint(
                'uq_tables_table_name', 
                table_name_existing_unique)
            batch_op.drop_constraint('uq_table_in_db_schema', type_='unique')
    else:
        op.create_unique_constraint('uq_tables_table_name', 'tables', table_name_existing_unique)
        op.drop_constraint('uq_table_in_db_schema', 'tables', type_='unique')
