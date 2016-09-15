"""change_table_unique_constraint

Revision ID: b922b43a4a2c
Revises: f162a1dea4c4
Create Date: 2016-07-20 22:16:05.087720

"""

# revision identifiers, used by Alembic.
revision = 'b922b43a4a2c'
down_revision = 'f162a1dea4c4'

from alembic import op
from caravel import db
from caravel.utils import generic_find_unique_constraint_name
import logging

naming_convention = {
    "uq": "uq_%(table_name)s_%(column_0_name)s"
}


def default_constraint_name(table_name, column_name):
    return naming_convention['uq'] % {'table_name': table_name,
                                      'column_0_name': column_name}


def find_constraint_name():
    return generic_find_unique_constraint_name(
        table='tables', columns=['table_name'], db=db)


# This script basically try to do the same thing as that in
# b4456560d4f3_change_table_unique_constraint.py.
# But the constraint name may have been wrong in that script,
# so we try other possibilities here
def upgrade():
    constraint_name = None
    try:
        # Trying since sqlite doesn't like constraints
        table_name = 'tables'
        column_name = 'table_name'
        constraint_name = find_constraint_name() or default_constraint_name(
            table_name, column_name)

        with op.batch_alter_table(table_name,
                                  naming_convention=naming_convention
                                  ) as batch_op:
            batch_op.drop_constraint(constraint_name, type_="unique")
    except:
        logging.warning(
            "Could not find or drop constraint `{}` on `tables`".format(
                constraint_name))

    try:
        # Try create this constraint again,
        # because the creation may have failed in the old script
        op.create_unique_constraint(
            u'_customer_location_uc', 'tables',
            ['database_id', 'schema', 'table_name'])
    except:
        logging.warning(
            "Could not a create unique constraint `_customer_location_uc` "
            "on `tables`")


def downgrade():
    table_name = 'tables'
    column_name = 'table_name'
    constraint_name = find_constraint_name() or default_constraint_name(
        table_name, column_name)
    with op.batch_alter_table(table_name,
                              naming_convention=naming_convention) as batch_op:
        batch_op.create_unique_constraint(constraint_name, [column_name])
