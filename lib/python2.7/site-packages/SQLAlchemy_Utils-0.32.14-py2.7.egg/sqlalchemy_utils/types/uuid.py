from __future__ import absolute_import

import uuid

from sqlalchemy import types
from sqlalchemy.dialects import postgresql

from .scalar_coercible import ScalarCoercible


class UUIDType(types.TypeDecorator, ScalarCoercible):
    """
    Stores a UUID in the database natively when it can and falls back to
    a BINARY(16) or a CHAR(32) when it can't.

    ::

        from sqlalchemy_utils import UUIDType
        import uuid

        class User(Base):
            __tablename__ = 'user'

            # Pass `binary=False` to fallback to CHAR instead of BINARY
            id = sa.Column(UUIDType(binary=False), primary_key=True)
    """
    impl = types.BINARY(16)

    python_type = uuid.UUID

    def __init__(self, binary=True, native=True):
        """
        :param binary: Whether to use a BINARY(16) or CHAR(32) fallback.
        """
        self.binary = binary
        self.native = native

    def load_dialect_impl(self, dialect):
        if dialect.name == 'postgresql' and self.native:
            # Use the native UUID type.
            return dialect.type_descriptor(postgresql.UUID())

        else:
            # Fallback to either a BINARY or a CHAR.
            kind = self.impl if self.binary else types.CHAR(32)
            return dialect.type_descriptor(kind)

    @staticmethod
    def _coerce(value):
        if value and not isinstance(value, uuid.UUID):
            try:
                value = uuid.UUID(value)

            except (TypeError, ValueError):
                value = uuid.UUID(bytes=value)

        return value

    def process_bind_param(self, value, dialect):
        if value is None:
            return value

        if not isinstance(value, uuid.UUID):
            value = self._coerce(value)

        if self.native and dialect.name == 'postgresql':
            return str(value)

        return value.bytes if self.binary else value.hex

    def process_result_value(self, value, dialect):
        if value is None:
            return value

        if self.native and dialect.name == 'postgresql':
            if isinstance(value, uuid.UUID):
                # Some drivers convert PostgreSQL's uuid values to
                # Python's uuid.UUID objects by themselves
                return value
            return uuid.UUID(value)

        return uuid.UUID(bytes=value) if self.binary else uuid.UUID(value)
