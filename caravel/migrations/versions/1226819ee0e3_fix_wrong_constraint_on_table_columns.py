"""Fix wrong constraint on table columns

Revision ID: 1226819ee0e3
Revises: 956a063c52b3
Create Date: 2016-05-27 15:03:32.980343

"""

# revision identifiers, used by Alembic.
revision = '1226819ee0e3'
down_revision = '956a063c52b3'

from alembic import op
import sqlalchemy as sa

naming_convention = {
    "fk":
    "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
}

def find_constraint_name(upgrade = True):
    __table = 'columns'
    __cols = {'column_name'} if upgrade else {'datasource_name'}
    __referenced = 'datasources'
    __ref_cols = {'datasource_name'} if upgrade else {'column_name'}

    engine = op.get_bind().engine
    m = sa.MetaData({})
    t=sa.Table(__table,m, autoload=True, autoload_with=engine)

    for fk in t.foreign_key_constraints:
        if fk.referred_table.name == __referenced and \
            set(fk.column_keys) == __cols:
            return fk.name
    return None

def upgrade():
    constraint = find_constraint_name() or 'fk_columns_column_name_datasources'
    with op.batch_alter_table("columns", 
        naming_convention=naming_convention) as batch_op:
        batch_op.drop_constraint(constraint, type_="foreignkey")
        batch_op.create_foreign_key('fk_columns_datasource_name_datasources', 'datasources', ['datasource_name'], ['datasource_name'])

def downgrade():
    constraint = find_constraint_name(False) or 'fk_columns_datasource_name_datasources'
    with op.batch_alter_table("columns", 
        naming_convention=naming_convention) as batch_op:
        batch_op.drop_constraint(constraint, type_="foreignkey")
        batch_op.create_foreign_key('fk_columns_column_name_datasources', 'datasources', ['column_name'], ['datasource_name'])
    