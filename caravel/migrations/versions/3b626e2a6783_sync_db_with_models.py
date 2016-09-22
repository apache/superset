"""Sync DB with the models.py.

Revision ID: 3b626e2a6783
Revises: 5e4a03ef0bf0
Create Date: 2016-09-22 10:21:33.618976

"""

# revision identifiers, used by Alembic.
revision = '3b626e2a6783'
down_revision = '5e4a03ef0bf0'

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql


def upgrade():
    # fixed issue: https://github.com/airbnb/caravel/issues/466
    op.create_foreign_key(
        None, 'columns', 'datasources', ['datasource_name'],
        ['datasource_name'])
    op.create_unique_constraint(None, 'query', ['client_id'])
    op.drop_column('query', 'name')

    # cleanup after: https://github.com/airbnb/caravel/pull/1078
    op.drop_constraint('slices_ibfk_2', 'slices', type_='foreignkey')
    op.drop_constraint('slices_ibfk_1', 'slices', type_='foreignkey')
    op.drop_column('slices', 'druid_datasource_id')
    op.drop_column('slices', 'table_id')


    op.create_unique_constraint(
        '_customer_location_uc', 'tables',
        ['database_id', 'schema', 'table_name'])
    op.drop_index('table_name', table_name='tables')


def downgrade():
    op.create_index('table_name', 'tables', ['table_name'], unique=True)
    op.drop_constraint(u'_customer_location_uc', 'tables', type_='unique')

    op.add_column('slices', sa.Column(
        'table_id', mysql.INTEGER(display_width=11), autoincrement=False,
        nullable=True))
    op.add_column(
        'slices',  sa.Column('druid_datasource_id', sa.Integer(),
                             autoincrement=False, nullable=True))
    op.create_foreign_key(
        'slices_ibfk_1', 'slices', 'datasources',
        ['druid_datasource_id'], ['id'])
    op.create_foreign_key(
        'slices_ibfk_2', 'slices', 'tables', ['table_id'], ['id'])

    op.add_column(
        'query', sa.Column('name', sa.String(length=256), nullable=True))
    op.drop_constraint(None, 'query', type_='unique')
    op.drop_constraint(None, 'columns', type_='foreignkey')
