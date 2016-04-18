"""change_table_unique_constraint

Revision ID: b4456560d4f3
Revises: bb51420eaf83
Create Date: 2016-04-15 08:31:26.249591

"""

# revision identifiers, used by Alembic.
revision = 'b4456560d4f3'
down_revision = 'bb51420eaf83'

from alembic import op


def upgrade():
    try:
        # Trying since sqlite doesn't like constraints
        op.drop_constraint(
            u'tables_table_name_key', 'tables', type_='unique')
        op.create_unique_constraint(
            u'_customer_location_uc', 'tables',
            ['database_id', 'schema', 'table_name'])
    except Exception:
        pass


def downgrade():
    try:
        # Trying since sqlite doesn't like constraints
        op.drop_constraint(u'_customer_location_uc', 'tables', type_='unique')
    except Exception:
        pass
