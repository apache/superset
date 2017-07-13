from __future__ import absolute_import

from sqlalchemy import types
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.dialects.postgresql.base import ischema_names, PGTypeCompiler
from sqlalchemy.sql import expression

from ..primitives import Ltree
from .scalar_coercible import ScalarCoercible


class LtreeType(types.Concatenable, types.UserDefinedType, ScalarCoercible):
    """Postgresql LtreeType type.

    The LtreeType datatype can be used for representing labels of data stored
    in hierarchial tree-like structure. For more detailed information please
    refer to http://www.postgresql.org/docs/current/static/ltree.html

    ::

        from sqlalchemy_utils import LtreeType


        class DocumentSection(Base):
            __tablename__ = 'document_section'
            id = sa.Column(sa.Integer, autoincrement=True)
            path = sa.Column(LtreeType)


        section = DocumentSection(name='Countries.Finland')
        session.add(section)
        session.commit()

        section.path  # Ltree('Countries.Finland')


    .. note::
        Using :class:`LtreeType`, :class:`LQUERY` and :class:`LTXTQUERY` types
        may require installation of Postgresql ltree extension on the server
        side. Please visit http://www.postgres.org for details.
    """

    class comparator_factory(types.Concatenable.Comparator):
        def ancestor_of(self, other):
            if isinstance(other, list):
                return self.op('@>')(expression.cast(other, ARRAY(LtreeType)))
            else:
                return self.op('@>')(other)

        def descendant_of(self, other):
            if isinstance(other, list):
                return self.op('<@')(expression.cast(other, ARRAY(LtreeType)))
            else:
                return self.op('<@')(other)

        def lquery(self, other):
            if isinstance(other, list):
                return self.op('?')(expression.cast(other, ARRAY(LQUERY)))
            else:
                return self.op('~')(other)

        def ltxtquery(self, other):
            return self.op('@')(other)

    def bind_processor(self, dialect):
        def process(value):
            if value:
                return value.path
        return process

    def result_processor(self, dialect, coltype):
        def process(value):
            return self._coerce(value)
        return process

    def literal_processor(self, dialect):
        def process(value):
            value = value.replace("'", "''")
            return "'%s'" % value
        return process

    __visit_name__ = 'LTREE'

    def _coerce(self, value):
        if value:
            return Ltree(value)


class LQUERY(types.TypeEngine):
    """Postresql LQUERY type.
    See :class:`LTREE` for details.
    """
    __visit_name__ = 'LQUERY'


class LTXTQUERY(types.TypeEngine):
    """Postresql LTXTQUERY type.
    See :class:`LTREE` for details.
    """
    __visit_name__ = 'LTXTQUERY'


ischema_names['ltree'] = LtreeType
ischema_names['lquery'] = LQUERY
ischema_names['ltxtquery'] = LTXTQUERY


def visit_LTREE(self, type_, **kw):
    return 'LTREE'


def visit_LQUERY(self, type_, **kw):
    return 'LQUERY'


def visit_LTXTQUERY(self, type_, **kw):
    return 'LTXTQUERY'


PGTypeCompiler.visit_LTREE = visit_LTREE
PGTypeCompiler.visit_LQUERY = visit_LQUERY
PGTypeCompiler.visit_LTXTQUERY = visit_LTXTQUERY
