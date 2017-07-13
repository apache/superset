from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.util.langhelpers import symbol


class Timestamp(object):
    """Adds `created` and `updated` columns to a derived declarative model.

    The `created` column is handled through a default and the `updated`
    column is handled through a `before_update` event that propagates
    for all derived declarative models.

    ::


        import sqlalchemy as sa
        from sqlalchemy_utils import Timestamp


        class SomeModel(Base, Timestamp):
            __tablename__ = 'somemodel'
            id = sa.Column(sa.Integer, primary_key=True)
    """

    created = sa.Column(sa.DateTime, default=datetime.utcnow, nullable=False)
    updated = sa.Column(sa.DateTime, default=datetime.utcnow, nullable=False)


@sa.event.listens_for(Timestamp, 'before_update', propagate=True)
def timestamp_before_update(mapper, connection, target):
    # When a model with a timestamp is updated; force update the updated
    # timestamp.
    target.updated = datetime.utcnow()


NO_VALUE = symbol('NO_VALUE')
NOT_LOADED_REPR = '<not loaded>'


def _generic_repr_method(self, fields):
    state = sa.inspect(self)
    field_reprs = []
    if not fields:
        fields = state.mapper.columns.keys()
    for key in fields:
        value = state.attrs[key].loaded_value
        if value == NO_VALUE:
            value = NOT_LOADED_REPR
        else:
            value = repr(value)
        field_reprs.append('='.join((key, value)))

    return '%s(%s)' % (self.__class__.__name__, ', '.join(field_reprs))


def generic_repr(*fields):
    """Adds generic ``__repr__()`` method to a decalrative SQLAlchemy model.

    In case if some fields are not loaded from a database, it doesn't
    force their loading and instead repesents them as ``<not loaded>``.

    In addition, user can provide field names as arguments to the decorator
    to specify what fields should present in the string representation
    and in what order.

    Example::


        import sqlalchemy as sa
        from sqlalchemy_utils import generic_repr


        @generic_repr
        class MyModel(Base):
            __tablename__ = 'mymodel'
            id = sa.Column(sa.Integer, primary_key=True)
            name = sa.Column(sa.String)
            category = sa.Column(sa.String)

        session.add(MyModel(name='Foo', category='Bar'))
        session.commit()
        foo = session.query(MyModel).options(sa.orm.defer('category')).one(s)

        assert repr(foo) == 'MyModel(id=1, name='Foo', category=<not loaded>)'
    """
    if len(fields) == 1 and callable(fields[0]):
        target = fields[0]
        target.__repr__ = lambda self: _generic_repr_method(self, fields=None)
        return target
    else:
        def decorator(cls):
            cls.__repr__ = lambda self: _generic_repr_method(
                self,
                fields=fields
            )
            return cls
        return decorator
