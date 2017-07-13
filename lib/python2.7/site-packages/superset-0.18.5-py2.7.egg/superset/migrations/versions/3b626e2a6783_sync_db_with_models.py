"""Sync DB with the models.py.

Sqlite doesn't support alter on tables, that's why most of the operations
are surrounded with try except.

Revision ID: 3b626e2a6783
Revises: 5e4a03ef0bf0
Create Date: 2016-09-22 10:21:33.618976

"""

# revision identifiers, used by Alembic.
revision = '3b626e2a6783'
down_revision = 'eca4694defa7'

from alembic import op
from superset import db
from superset.utils import generic_find_constraint_name, table_has_constraint
import logging
import sqlalchemy as sa
from sqlalchemy.dialects import mysql


def upgrade():
    # cleanup after: https://github.com/airbnb/superset/pull/1078
    try:
        slices_ibfk_1 = generic_find_constraint_name(
            table='slices', columns={'druid_datasource_id'},
            referenced='datasources', db=db) or 'slices_ibfk_1'
        slices_ibfk_2 = generic_find_constraint_name(
            table='slices', columns={'table_id'},
            referenced='tables', db=db) or 'slices_ibfk_2'

        with op.batch_alter_table("slices") as batch_op:
            batch_op.drop_constraint(slices_ibfk_1, type_="foreignkey")
            batch_op.drop_constraint(slices_ibfk_2, type_="foreignkey")
            batch_op.drop_column('druid_datasource_id')
            batch_op.drop_column('table_id')
    except Exception as e:
        logging.warning(str(e))

    # fixed issue: https://github.com/airbnb/superset/issues/466
    try:
        with op.batch_alter_table("columns") as batch_op:
            batch_op.create_foreign_key(
                None, 'datasources', ['datasource_name'], ['datasource_name'])
    except Exception as e:
        logging.warning(str(e))
    try:
        with op.batch_alter_table('query') as batch_op:
            batch_op.create_unique_constraint('client_id', ['client_id'])
    except Exception as e:
        logging.warning(str(e))

    try:
        with op.batch_alter_table('query') as batch_op:
            batch_op.drop_column('name')
    except Exception as e:
        logging.warning(str(e))

    try:
        # wasn't created for some databases in the migration b4456560d4f3
        if not table_has_constraint('tables', '_customer_location_uc', db):
            with op.batch_alter_table('tables') as batch_op:
                batch_op.create_unique_constraint(
                    '_customer_location_uc',
                    ['database_id', 'schema', 'table_name'])
                batch_op.drop_index('table_name')
    except Exception as e:
        logging.warning(str(e))


def downgrade():
    try:
        with op.batch_alter_table('tables') as batch_op:
            batch_op.create_index('table_name', ['table_name'], unique=True)
    except Exception as e:
        logging.warning(str(e))

    try:
        with op.batch_alter_table("slices") as batch_op:
            batch_op.add_column(sa.Column(
                'table_id', mysql.INTEGER(display_width=11),
                autoincrement=False, nullable=True))
            batch_op.add_column(sa.Column(
                'druid_datasource_id', sa.Integer(), autoincrement=False,
                nullable=True))
            batch_op.create_foreign_key(
                'slices_ibfk_1', 'datasources', ['druid_datasource_id'],
                ['id'])
            batch_op.create_foreign_key(
                'slices_ibfk_2', 'tables', ['table_id'], ['id'])
    except Exception as e:
        logging.warning(str(e))

    try:
        fk_columns = generic_find_constraint_name(
            table='columns', columns={'datasource_name'},
            referenced='datasources', db=db)
        with op.batch_alter_table("columns") as batch_op:
            batch_op.drop_constraint(fk_columns, type_="foreignkey")
    except Exception as e:
        logging.warning(str(e))

    op.add_column(
        'query', sa.Column('name', sa.String(length=256), nullable=True))
    try:
        with op.batch_alter_table("query") as batch_op:
            batch_op.drop_constraint('client_id', type_='unique')
    except Exception as e:
        logging.warning(str(e))
