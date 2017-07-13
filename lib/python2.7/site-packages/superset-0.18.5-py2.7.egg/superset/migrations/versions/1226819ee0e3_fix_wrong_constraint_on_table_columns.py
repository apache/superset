"""Fix wrong constraint on table columns

Revision ID: 1226819ee0e3
Revises: 956a063c52b3
Create Date: 2016-05-27 15:03:32.980343

"""

# revision identifiers, used by Alembic.
revision = '1226819ee0e3'
down_revision = '956a063c52b3'

from alembic import op
from superset import db
from superset.utils import generic_find_constraint_name
import logging

naming_convention = {
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
}


def find_constraint_name(upgrade=True):
    cols = {'column_name'} if upgrade else {'datasource_name'}
    return generic_find_constraint_name(
        table='columns', columns=cols, referenced='datasources', db=db)


def upgrade():
    try:
        constraint = find_constraint_name() or 'fk_columns_column_name_datasources'
        with op.batch_alter_table("columns",
                naming_convention=naming_convention) as batch_op:
            batch_op.drop_constraint(constraint, type_="foreignkey")
            batch_op.create_foreign_key(
                'fk_columns_datasource_name_datasources',
                'datasources',
                ['datasource_name'], ['datasource_name'])
    except:
        logging.warning(
            "Could not find or drop constraint on `columns`")

def downgrade():
    constraint = find_constraint_name(False) or 'fk_columns_datasource_name_datasources'
    with op.batch_alter_table("columns",
        naming_convention=naming_convention) as batch_op:
        batch_op.drop_constraint(constraint, type_="foreignkey")
        batch_op.create_foreign_key(
            'fk_columns_column_name_datasources',
            'datasources',
            ['column_name'], ['datasource_name'])
