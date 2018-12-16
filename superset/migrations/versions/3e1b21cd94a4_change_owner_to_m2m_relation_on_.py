"""change_owner_to_m2m_relation_on_datasources.py

Revision ID: 3e1b21cd94a4
Revises: 4ce8df208545
Create Date: 2018-12-15 12:34:47.228756

"""

# revision identifiers, used by Alembic.
from superset import db

revision = '3e1b21cd94a4'
down_revision = '6c7537a6004a'

from alembic import op
import sqlalchemy as sa


sqlatable_user = sa.Table(
    'sqlatable_user', sa.MetaData(),
    sa.Column('id', sa.Integer, primary_key=True),
    sa.Column('user_id', sa.Integer, sa.ForeignKey('ab_user.id')),
    sa.Column('table_id', sa.Integer, sa.ForeignKey('tables.id')),
)

SqlaTable = sa.Table(
    'tables', sa.MetaData(),
    sa.Column('id', sa.Integer, primary_key=True),
    sa.Column('user_id', sa.Integer, sa.ForeignKey('ab_user.id')),
)

druiddatasource_user = sa.Table(
    'druiddatasource_user', sa.MetaData(),
    sa.Column('id', sa.Integer, primary_key=True),
    sa.Column('user_id', sa.Integer, sa.ForeignKey('ab_user.id')),
    sa.Column('datasource_id', sa.Integer, sa.ForeignKey('datasources.id')),
)

DruidDatasource = sa.Table(
    'datasources', sa.MetaData(),
    sa.Column('id', sa.Integer, primary_key=True),
    sa.Column('user_id', sa.Integer, sa.ForeignKey('ab_user.id')),
)


def upgrade():
    op.create_table('sqlatable_user',
                    sa.Column('id', sa.Integer(), nullable=False),
                    sa.Column('user_id', sa.Integer(), nullable=True),
                    sa.Column('table_id', sa.Integer(), nullable=True),
                    sa.ForeignKeyConstraint(['table_id'], ['tables.id'], ),
                    sa.ForeignKeyConstraint(['user_id'], ['ab_user.id'], ),
                    sa.PrimaryKeyConstraint('id')
                    )
    op.create_table('druiddatasource_user',
                    sa.Column('id', sa.Integer(), nullable=False),
                    sa.Column('user_id', sa.Integer(), nullable=True),
                    sa.Column('datasource_id', sa.Integer(), nullable=True),
                    sa.ForeignKeyConstraint(['datasource_id'], ['datasources.id'], ),
                    sa.ForeignKeyConstraint(['user_id'], ['ab_user.id'], ),
                    sa.PrimaryKeyConstraint('id')
                    )

    bind = op.get_bind()
    session = db.Session(bind=bind)

    tables = session.query(SqlaTable).all()
    for table in tables:
        if table.user_id is not None:
            session.execute(
                sqlatable_user.insert().values(user_id=table.user_id, table_id=table.id)
            )

    druiddatasources = session.query(DruidDatasource).all()
    for druiddatasource in druiddatasources:
        if druiddatasource.user_id is not None:
            session.execute(
                druiddatasource_user.insert().values(user_id=druiddatasource.user_id, datasource_id=druiddatasource.id)
            )

    session.close()
    op.drop_constraint('user_id', 'tables', type_='foreignkey')
    op.drop_column('tables', 'user_id')
    op.drop_constraint('datasources_user_id_fkey', 'datasources', type_='foreignkey')
    op.drop_column('datasources', 'user_id')


def downgrade():
    op.drop_table('sqlatable_user')
    op.drop_table('druiddatasource_user')
    op.add_column('tables', sa.Column('user_id', sa.INTEGER(), nullable=True))
    op.create_foreign_key('user_id', 'tables', 'ab_user', ['user_id'], ['id'])
    op.add_column('datasources', sa.Column('user_id', sa.INTEGER(), nullable=True))
    op.create_foreign_key('datasources_user_id_fkey', 'datasources', 'ab_user', ['user_id'], ['id'])
