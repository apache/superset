from __future__ import annotations

from dataclasses import dataclass

from alembic import op
from sqlalchemy.engine.reflection import Inspector

from superset.utils.core import generic_find_fk_constraint_name


@dataclass(frozen=True)
class ForeignKey:
    table: str
    referent_table: str
    local_cols: list[str]
    remote_cols: list[str]

    @property
    def constraint_name(self) -> str:
        return f"fk_{self.table}_{self.local_cols[0]}_{self.referent_table}"


def redefine(
    foreign_key: ForeignKey,
    on_delete: str | None = None,
    on_update: str | None = None,
) -> None:
    """
    Redefine the foreign key constraint to include the ON DELETE and ON UPDATE
    constructs for cascading purposes.

    :params foreign_key: The foreign key constraint
    :param ondelete: If set, emit ON DELETE <value> when issuing DDL operations
    :param onupdate: If set, emit ON UPDATE <value> when issuing DDL operations
    """

    bind = op.get_bind()
    insp = Inspector.from_engine(bind)
    conv = {"fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s"}

    with op.batch_alter_table(foreign_key.table, naming_convention=conv) as batch_op:
        if constraint := generic_find_fk_constraint_name(
            table=foreign_key.table,
            columns=set(foreign_key.remote_cols),
            referenced=foreign_key.referent_table,
            insp=insp,
        ):
            batch_op.drop_constraint(constraint, type_="foreignkey")

        batch_op.create_foreign_key(
            constraint_name=foreign_key.constraint_name,
            referent_table=foreign_key.referent_table,
            local_cols=foreign_key.local_cols,
            remote_cols=foreign_key.remote_cols,
            ondelete=on_delete,
            onupdate=on_update,
        )
