"""update slice model

Revision ID: 33d996bcc382
Revises: 41f6a59a61f2
Create Date: 2016-09-07 23:50:59.366779

"""

# revision identifiers, used by Alembic.
revision = '33d996bcc382'
down_revision = '41f6a59a61f2'

from alembic import op
import sqlalchemy as sa
from caravel import db
import logging
from caravel.utils import generic_find_constraint_name


def find_constraint_name(cols, referenced_table):
    return generic_find_constraint_name(
        table='slices', columns=cols, referenced=referenced_table, db=db)


def upgrade():
    try:
        with op.batch_alter_table('slices') as batch_op:
            cols_1 = {'druid_datasource_id'}
            constraint_1 = find_constraint_name(cols_1, 'datasources')
            batch_op.drop_constraint(constraint_1, type_="foreignkey")

            cols_2 = {'table_id'}
            constraint_2 = find_constraint_name(cols_2, 'tables')
            batch_op.drop_constraint(constraint_2, type_="foreignkey")

            batch_op.drop_column('druid_datasource_id')
            batch_op.drop_column('table_id')
            batch_op.add_column(sa.Column('datasource_id', sa.Integer()))
    except Exception as e:
        logging.warning(e)


def downgrade():
    with op.batch_alter_table('slices') as batch_op:
        batch_op.drop_column('datasource_id')

        batch_op.add_column(sa.Column('druid_datasource_id', sa.Integer()))
        batch_op.add_column(sa.Column('table_id', sa.Integer()))

        batch_op.create_foreign_key(None, 
            'datasources', ['druid_datasource_id'], ['id'])
        batch_op.create_foreign_key(None, 
            'tables', ['table_id'], ['id'])
