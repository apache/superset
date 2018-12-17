"""adjusting key length

Revision ID: 956a063c52b3
Revises: f0fbf6129e13
Create Date: 2016-05-11 17:28:32.407340

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '956a063c52b3'
down_revision = 'f0fbf6129e13'


def upgrade():
    with op.batch_alter_table('clusters', schema=None) as batch_op:
        batch_op.alter_column('broker_endpoint',
                              existing_type=sa.VARCHAR(length=256),
                              type_=sa.String(length=255),
                              existing_nullable=True)
        batch_op.alter_column('broker_host',
                              existing_type=sa.VARCHAR(length=256),
                              type_=sa.String(length=255),
                              existing_nullable=True)
        batch_op.alter_column('coordinator_endpoint',
                              existing_type=sa.VARCHAR(length=256),
                              type_=sa.String(length=255),
                              existing_nullable=True)
        batch_op.alter_column('coordinator_host',
                              existing_type=sa.VARCHAR(length=256),
                              type_=sa.String(length=255),
                              existing_nullable=True)

    with op.batch_alter_table('columns', schema=None) as batch_op:
        batch_op.alter_column('column_name',
                              existing_type=sa.VARCHAR(length=256),
                              type_=sa.String(length=255),
                              existing_nullable=True)

    with op.batch_alter_table('datasources', schema=None) as batch_op:
        batch_op.alter_column('datasource_name',
                              existing_type=sa.VARCHAR(length=256),
                              type_=sa.String(length=255),
                              existing_nullable=True)

    with op.batch_alter_table('table_columns', schema=None) as batch_op:
        batch_op.alter_column('column_name',
                              existing_type=sa.VARCHAR(length=256),
                              type_=sa.String(length=255),
                              existing_nullable=True)

    with op.batch_alter_table('tables', schema=None) as batch_op:
        batch_op.alter_column('schema',
                              existing_type=sa.VARCHAR(length=256),
                              type_=sa.String(length=255),
                              existing_nullable=True)


def downgrade():
    with op.batch_alter_table('tables', schema=None) as batch_op:
        batch_op.alter_column('schema',
                              existing_type=sa.String(length=255),
                              type_=sa.VARCHAR(length=256),
                              existing_nullable=True)

    with op.batch_alter_table('table_columns', schema=None) as batch_op:
        batch_op.alter_column('column_name',
                              existing_type=sa.String(length=255),
                              type_=sa.VARCHAR(length=256),
                              existing_nullable=True)

    with op.batch_alter_table('datasources', schema=None) as batch_op:
        batch_op.alter_column('datasource_name',
                              existing_type=sa.String(length=255),
                              type_=sa.VARCHAR(length=256),
                              existing_nullable=True)

    with op.batch_alter_table('columns', schema=None) as batch_op:
        batch_op.alter_column('column_name',
                              existing_type=sa.String(length=255),
                              type_=sa.VARCHAR(length=256),
                              existing_nullable=True)

    with op.batch_alter_table('clusters', schema=None) as batch_op:
        batch_op.alter_column('coordinator_host',
                              existing_type=sa.String(length=255),
                              type_=sa.VARCHAR(length=256),
                              existing_nullable=True)
        batch_op.alter_column('coordinator_endpoint',
                              existing_type=sa.String(length=255),
                              type_=sa.VARCHAR(length=256),
                              existing_nullable=True)
        batch_op.alter_column('broker_host',
                              existing_type=sa.String(length=255),
                              type_=sa.VARCHAR(length=256),
                              existing_nullable=True)
        batch_op.alter_column('broker_endpoint',
                              existing_type=sa.String(length=255),
                              type_=sa.VARCHAR(length=256),
                              existing_nullable=True)
