import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import BIT


class BitType(sa.types.TypeDecorator):
    """
    BitType offers way of saving BITs into database.
    """
    impl = sa.types.BINARY

    def __init__(self, length=1, **kwargs):
        self.length = length
        sa.types.TypeDecorator.__init__(self, **kwargs)

    def load_dialect_impl(self, dialect):
        # Use the native BIT type for drivers that has it.
        if dialect.name == 'postgresql':
            return dialect.type_descriptor(BIT(self.length))
        elif dialect.name == 'sqlite':
            return dialect.type_descriptor(sa.String(self.length))
        else:
            return dialect.type_descriptor(type(self.impl)(self.length))
