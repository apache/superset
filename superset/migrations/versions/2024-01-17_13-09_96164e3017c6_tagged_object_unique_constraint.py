# dodo was here
import enum

import migration_utils as utils
from alembic import op
from sqlalchemy import Column, Enum, Integer, MetaData, Table
from sqlalchemy.sql import func, select

# revision identifiers, used by Alembic.
revision = "96164e3017c6"
down_revision = "65a167d4c62e"  # dodo changed 44211751


class ObjectType(enum.Enum):
    # pylint: disable=invalid-name
    query = 1
    chart = 2
    dashboard = 3
    dataset = 4


# Define the tagged_object table structure
metadata = MetaData()
tagged_object_table = Table(
    "tagged_object",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("tag_id", Integer),
    Column("object_id", Integer),
    Column("object_type", Enum(ObjectType)),  # Replace ObjectType with your Enum
)

index_id = "uix_tagged_object"
table_name = "tagged_object"
uix_columns = ["tag_id", "object_id", "object_type"]


def upgrade():
    bind = op.get_bind()  # Get the database connection bind

    # Reflect the current database state to get existing tables
    metadata.reflect(bind=bind)

    # Delete duplicates if any
    min_id_subquery = (
        select(
            [
                func.min(tagged_object_table.c.id).label("min_id"),
                tagged_object_table.c.tag_id,
                tagged_object_table.c.object_id,
                tagged_object_table.c.object_type,
            ]
        )
        .group_by(
            tagged_object_table.c.tag_id,
            tagged_object_table.c.object_id,
            tagged_object_table.c.object_type,
        )
        .alias("min_ids")
    )

    delete_query = tagged_object_table.delete().where(
        tagged_object_table.c.id.notin_(select([min_id_subquery.c.min_id]))
    )

    bind.execute(delete_query)

    # Create unique constraint
    utils.create_unique_constraint(op, index_id, table_name, uix_columns)


def downgrade():
    utils.drop_unique_constraint(op, index_id, table_name)
