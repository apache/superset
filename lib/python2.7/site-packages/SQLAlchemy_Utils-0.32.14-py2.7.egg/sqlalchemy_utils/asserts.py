"""
The functions in this module can be used for testing that the constraints of
your models. Each assert function runs SQL UPDATEs that check for the existence
of given constraint. Consider the following model::


    class User(Base):
        __tablename__ = 'user'
        id = sa.Column(sa.Integer, primary_key=True)
        name = sa.Column(sa.String(200), nullable=True)
        email = sa.Column(sa.String(255), nullable=False)


    user = User(name='John Doe', email='john@example.com')
    session.add(user)
    session.commit()


We can easily test the constraints by assert_* functions::


    from sqlalchemy_utils import (
        assert_nullable,
        assert_non_nullable,
        assert_max_length
    )

    assert_nullable(user, 'name')
    assert_non_nullable(user, 'email')
    assert_max_length(user, 'name', 200)

    # raises AssertionError because the max length of email is 255
    assert_max_length(user, 'email', 300)
"""
from decimal import Decimal

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.exc import DataError, IntegrityError


def _update_field(obj, field, value):
    session = sa.orm.object_session(obj)
    column = sa.inspect(obj.__class__).columns[field]
    query = column.table.update().values(**{column.key: value})
    session.execute(query)
    session.flush()


def _expect_successful_update(obj, field, value, reraise_exc):
    try:
        _update_field(obj, field, value)
    except (reraise_exc) as e:
        session = sa.orm.object_session(obj)
        session.rollback()
        assert False, str(e)


def _expect_failing_update(obj, field, value, expected_exc):
    try:
        _update_field(obj, field, value)
    except expected_exc:
        pass
    else:
        raise AssertionError('Expected update to raise %s' % expected_exc)
    finally:
        session = sa.orm.object_session(obj)
        session.rollback()


def _repeated_value(type_):
    if isinstance(type_, ARRAY):
        if isinstance(type_.item_type, sa.Integer):
            return [0]
        elif isinstance(type_.item_type, sa.String):
            return [u'a']
        elif isinstance(type_.item_type, sa.Numeric):
            return [Decimal('0')]
        else:
            raise TypeError('Unknown array item type')
    else:
        return u'a'


def _expected_exception(type_):
    if isinstance(type_, ARRAY):
        return IntegrityError
    else:
        return DataError


def assert_nullable(obj, column):
    """
    Assert that given column is nullable. This is checked by running an SQL
    update that assigns given column as None.

    :param obj: SQLAlchemy declarative model object
    :param column: Name of the column
    """
    _expect_successful_update(obj, column, None, IntegrityError)


def assert_non_nullable(obj, column):
    """
    Assert that given column is not nullable. This is checked by running an SQL
    update that assigns given column as None.

    :param obj: SQLAlchemy declarative model object
    :param column: Name of the column
    """
    _expect_failing_update(obj, column, None, IntegrityError)


def assert_max_length(obj, column, max_length):
    """
    Assert that the given column is of given max length. This function supports
    string typed columns as well as PostgreSQL array typed columns.

    In the following example we add a check constraint that user can have a
    maximum of 5 favorite colors and then test this.::


        class User(Base):
            __tablename__ = 'user'
            id = sa.Column(sa.Integer, primary_key=True)
            favorite_colors = sa.Column(ARRAY(sa.String), nullable=False)
            __table_args__ = (
                sa.CheckConstraint(
                    sa.func.array_length(favorite_colors, 1) <= 5
                )
            )


        user = User(name='John Doe', favorite_colors=['red', 'blue'])
        session.add(user)
        session.commit()


        assert_max_length(user, 'favorite_colors', 5)


    :param obj: SQLAlchemy declarative model object
    :param column: Name of the column
    :param max_length: Maximum length of given column
    """
    type_ = sa.inspect(obj.__class__).columns[column].type
    _expect_successful_update(
        obj,
        column,
        _repeated_value(type_) * max_length,
        _expected_exception(type_)
    )
    _expect_failing_update(
        obj,
        column,
        _repeated_value(type_) * (max_length + 1),
        _expected_exception(type_)
    )


def assert_min_value(obj, column, min_value):
    """
    Assert that the given column must have a minimum value of `min_value`.

    :param obj: SQLAlchemy declarative model object
    :param column: Name of the column
    :param min_value: The minimum allowed value for given column
    """
    _expect_successful_update(obj, column, min_value, IntegrityError)
    _expect_failing_update(obj, column, min_value - 1, IntegrityError)


def assert_max_value(obj, column, min_value):
    """
    Assert that the given column must have a minimum value of `max_value`.

    :param obj: SQLAlchemy declarative model object
    :param column: Name of the column
    :param max_value: The maximum allowed value for given column
    """
    _expect_successful_update(obj, column, min_value, IntegrityError)
    _expect_failing_update(obj, column, min_value + 1, IntegrityError)
