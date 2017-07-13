import sqlalchemy as sa
from sqlalchemy.sql.expression import asc, desc

from .database import has_unique_index
from .orm import get_query_descriptor, get_tables


class QuerySorterException(Exception):
    pass


class QuerySorter(object):
    def __init__(self, silent=True, separator='-'):
        self.separator = separator
        self.silent = silent

    def assign_order_by(self, entity, attr, func):
        expr = get_query_descriptor(self.query, entity, attr)

        if expr is not None:
            return self.query.order_by(func(expr))
        if not self.silent:
            raise QuerySorterException(
                "Could not sort query with expression '%s'" % attr
            )
        return self.query

    def parse_sort_arg(self, arg):
        if arg[0] == self.separator:
            func = desc
            arg = arg[1:]
        else:
            func = asc

        parts = arg.split(self.separator)
        return {
            'entity': parts[0] if len(parts) > 1 else None,
            'attr': parts[1] if len(parts) > 1 else arg,
            'func': func
        }

    def __call__(self, query, *args):
        self.query = query

        for sort in args:
            if not sort:
                continue
            self.query = self.assign_order_by(
                **self.parse_sort_arg(sort)
            )
        return self.query


def sort_query(query, *args, **kwargs):
    """
    Applies an sql ORDER BY for given query. This function can be easily used
    with user-defined sorting.

    The examples use the following model definition:

    ::


        import sqlalchemy as sa
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker
        from sqlalchemy.ext.declarative import declarative_base
        from sqlalchemy_utils import sort_query


        engine = create_engine(
            'sqlite:///'
        )
        Base = declarative_base()
        Session = sessionmaker(bind=engine)
        session = Session()

        class Category(Base):
            __tablename__ = 'category'
            id = sa.Column(sa.Integer, primary_key=True)
            name = sa.Column(sa.Unicode(255))

        class Article(Base):
            __tablename__ = 'article'
            id = sa.Column(sa.Integer, primary_key=True)
            name = sa.Column(sa.Unicode(255))
            category_id = sa.Column(sa.Integer, sa.ForeignKey(Category.id))

            category = sa.orm.relationship(
                Category, primaryjoin=category_id == Category.id
            )



    1. Applying simple ascending sort
    ::


        query = session.query(Article)
        query = sort_query(query, 'name')


    2. Applying descending sort
    ::


        query = sort_query(query, '-name')

    3. Applying sort to custom calculated label
    ::


        query = session.query(
            Category, sa.func.count(Article.id).label('articles')
        )
        query = sort_query(query, 'articles')

    4. Applying sort to joined table column
    ::


        query = session.query(Article).join(Article.category)
        query = sort_query(query, 'category-name')


    :param query:
        query to be modified
    :param sort:
        string that defines the label or column to sort the query by
    :param silent:
        Whether or not to raise exceptions if unknown sort column
        is passed. By default this is `True` indicating that no errors should
        be raised for unknown columns.
    """
    return QuerySorter(**kwargs)(query, *args)


def make_order_by_deterministic(query):
    """
    Make query order by deterministic (if it isn't already). Order by is
    considered deterministic if it contains column that is unique index (
    either it is a primary key or has a unique index). Many times it is design
    flaw to order by queries in nondeterministic manner.

    Consider a User model with three fields: id (primary key), favorite color
    and email (unique).::


        from sqlalchemy_utils import make_order_by_deterministic


        query = session.query(User).order_by(User.favorite_color)

        query = make_order_by_deterministic(query)
        print query  # 'SELECT ... ORDER BY "user".favorite_color, "user".id'


        query = session.query(User).order_by(User.email)

        query = make_order_by_deterministic(query)
        print query  # 'SELECT ... ORDER BY "user".email'


        query = session.query(User).order_by(User.id)

        query = make_order_by_deterministic(query)
        print query  # 'SELECT ... ORDER BY "user".id'


    .. versionadded: 0.27.1
    """
    order_by_func = sa.asc

    if not query._order_by:
        column = None
    else:
        order_by = query._order_by[0]
        if isinstance(order_by, sa.sql.expression.UnaryExpression):
            if order_by.modifier == sa.sql.operators.desc_op:
                order_by_func = sa.desc
            else:
                order_by_func = sa.asc
            column = order_by.get_children()[0]
        else:
            column = order_by

    # Skip queries that are ordered by an already deterministic column
    if isinstance(column, sa.Column):
        try:
            if has_unique_index(column):
                return query
        except TypeError:
            pass

    base_table = get_tables(query._entities[0])[0]
    query = query.order_by(
        *(order_by_func(c) for c in base_table.c if c.primary_key)
    )
    return query
