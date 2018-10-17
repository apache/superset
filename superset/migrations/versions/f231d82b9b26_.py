"""empty message

Revision ID: f231d82b9b26
Revises: e68c4473c581
Create Date: 2018-03-20 19:47:54.991259

"""
from alembic import op
import sqlalchemy as sa

from superset.utils.core import generic_find_uq_constraint_name

# revision identifiers, used by Alembic.
revision = 'f231d82b9b26'
down_revision = 'e68c4473c581'

conv = {
    'uq': 'uq_%(table_name)s_%(column_0_name)s',
}

names = {
    'columns': 'column_name',
    'metrics': 'metric_name',
}


def upgrade():

    # Reduce the size of the metric_name column for constraint viability.
    with op.batch_alter_table('metrics', naming_convention=conv) as batch_op:
        batch_op.alter_column(
            'metric_name',
            existing_type=sa.String(length=512),
            type_=sa.String(length=255),
            existing_nullable=True,
        )

    # Add the missing uniqueness constraints.
    for table, column in names.items():
        with op.batch_alter_table(table, naming_convention=conv) as batch_op:
            batch_op.create_unique_constraint(
                'uq_{}_{}'.format(table, column),
                [column, 'datasource_id'],
            )


def downgrade():

    bind = op.get_bind()
    insp = sa.engine.reflection.Inspector.from_engine(bind)

    # Restore the size of the metric_name column.
    with op.batch_alter_table('metrics', naming_convention=conv) as batch_op:
        batch_op.alter_column(
            'metric_name',
            existing_type=sa.String(length=255),
            type_=sa.String(length=512),
            existing_nullable=True,
        )

    # Remove the previous missing uniqueness constraints.
    for table, column in names.items():
        with op.batch_alter_table(table, naming_convention=conv) as batch_op:
            batch_op.drop_constraint(
                generic_find_uq_constraint_name(
                    table,
                    {column, 'datasource_id'},
                    insp,
                ) or 'uq_{}_{}'.format(table, column),
                type_='unique',
            )
