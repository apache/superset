"""
SQLAlchemy-Utils provides way of automatically calculating aggregate values of
related models and saving them to parent model.

This solution is inspired by RoR counter cache,
`counter_culture`_ and `stackoverflow reply by Michael Bayer`_.

Why?
----

Many times you may have situations where you need to calculate dynamically some
aggregate value for given model. Some simple examples include:

- Number of products in a catalog
- Average rating for movie
- Latest forum post
- Total price of orders for given customer

Now all these aggregates can be elegantly implemented with SQLAlchemy
column_property_ function. However when your data grows calculating these
values on the fly might start to hurt the performance of your application. The
more aggregates you are using the more performance penalty you get.

This module provides way of calculating these values automatically and
efficiently at the time of modification rather than on the fly.


Features
--------

* Automatically updates aggregate columns when aggregated values change
* Supports aggregate values through arbitrary number levels of relations
* Highly optimized: uses single query per transaction per aggregate column
* Aggregated columns can be of any data type and use any selectable scalar
  expression


.. _column_property:
    http://docs.sqlalchemy.org/en/latest/orm/mapper_config.html#using-column-property
.. _counter_culture: https://github.com/magnusvk/counter_culture
.. _stackoverflow reply by Michael Bayer:
    http://stackoverflow.com/questions/13693872/


Simple aggregates
-----------------

::

    from sqlalchemy_utils import aggregated


    class Thread(Base):
        __tablename__ = 'thread'
        id = sa.Column(sa.Integer, primary_key=True)
        name = sa.Column(sa.Unicode(255))

        @aggregated('comments', sa.Column(sa.Integer))
        def comment_count(self):
            return sa.func.count('1')

        comments = sa.orm.relationship(
            'Comment',
            backref='thread'
        )


    class Comment(Base):
        __tablename__ = 'comment'
        id = sa.Column(sa.Integer, primary_key=True)
        content = sa.Column(sa.UnicodeText)
        thread_id = sa.Column(sa.Integer, sa.ForeignKey(Thread.id))


    thread = Thread(name=u'SQLAlchemy development')
    thread.comments.append(Comment(u'Going good!'))
    thread.comments.append(Comment(u'Great new features!'))

    session.add(thread)
    session.commit()

    thread.comment_count  # 2



Custom aggregate expressions
----------------------------

Aggregate expression can be virtually any SQL expression not just a simple
function taking one parameter. You can try things such as subqueries and
different kinds of functions.

In the following example we have a Catalog of products where each catalog
knows the net worth of its products.

::


    from sqlalchemy_utils import aggregated


    class Catalog(Base):
        __tablename__ = 'catalog'
        id = sa.Column(sa.Integer, primary_key=True)
        name = sa.Column(sa.Unicode(255))

        @aggregated('products', sa.Column(sa.Integer))
        def net_worth(self):
            return sa.func.sum(Product.price)

        products = sa.orm.relationship('Product')


    class Product(Base):
        __tablename__ = 'product'
        id = sa.Column(sa.Integer, primary_key=True)
        name = sa.Column(sa.Unicode(255))
        price = sa.Column(sa.Numeric)

        catalog_id = sa.Column(sa.Integer, sa.ForeignKey(Catalog.id))


Now the net_worth column of Catalog model will be automatically whenever:

* A new product is added to the catalog
* A product is deleted from the catalog
* The price of catalog product is changed


::


    from decimal import Decimal


    product1 = Product(name='Some product', price=Decimal(1000))
    product2 = Product(name='Some other product', price=Decimal(500))


    catalog = Catalog(
        name=u'My first catalog',
        products=[
            product1,
            product2
        ]
    )
    session.add(catalog)
    session.commit()

    session.refresh(catalog)
    catalog.net_worth  # 1500

    session.delete(product2)
    session.commit()
    session.refresh(catalog)

    catalog.net_worth  # 1000

    product1.price = 2000
    session.commit()
    session.refresh(catalog)

    catalog.net_worth  # 2000




Multiple aggregates per class
-----------------------------

Sometimes you may need to define multiple aggregate values for same class. If
you need to define lots of relationships pointing to same class, remember to
define the relationships as viewonly when possible.


::


    from sqlalchemy_utils import aggregated


    class Customer(Base):
        __tablename__ = 'customer'
        id = sa.Column(sa.Integer, primary_key=True)
        name = sa.Column(sa.Unicode(255))

        @aggregated('orders', sa.Column(sa.Integer))
        def orders_sum(self):
            return sa.func.sum(Order.price)

        @aggregated('invoiced_orders', sa.Column(sa.Integer))
        def invoiced_orders_sum(self):
            return sa.func.sum(Order.price)

        orders = sa.orm.relationship('Order')

        invoiced_orders = sa.orm.relationship(
            'Order',
            primaryjoin=
                'sa.and_(Order.customer_id == Customer.id, Order.invoiced)',
            viewonly=True
        )


    class Order(Base):
        __tablename__ = 'order'
        id = sa.Column(sa.Integer, primary_key=True)
        name = sa.Column(sa.Unicode(255))
        price = sa.Column(sa.Numeric)
        invoiced = sa.Column(sa.Boolean, default=False)
        customer_id = sa.Column(sa.Integer, sa.ForeignKey(Customer.id))


Many-to-Many aggregates
-----------------------

Aggregate expressions also support many-to-many relationships. The usual use
scenarios includes things such as:

1. Friend count of a user
2. Group count where given user belongs to

::


        user_group = sa.Table('user_group', Base.metadata,
            sa.Column('user_id', sa.Integer, sa.ForeignKey('user.id')),
            sa.Column('group_id', sa.Integer, sa.ForeignKey('group.id'))
        )


        class User(Base):
            __tablename__ = 'user'
            id = sa.Column(sa.Integer, primary_key=True)
            name = sa.Column(sa.Unicode(255))

            @aggregated('groups', sa.Column(sa.Integer, default=0))
            def group_count(self):
                return sa.func.count('1')

            groups = sa.orm.relationship(
                'Group',
                backref='users',
                secondary=user_group
            )


        class Group(Base):
            __tablename__ = 'group'
            id = sa.Column(sa.Integer, primary_key=True)
            name = sa.Column(sa.Unicode(255))



        user = User(name=u'John Matrix')
        user.groups = [Group(name=u'Group A'), Group(name=u'Group B')]

        session.add(user)
        session.commit()

        session.refresh(user)
        user.group_count  # 2


Multi-level aggregates
----------------------

Aggregates can span across multiple relationships. In the following example
each Catalog has a net_worth which is the sum of all products in all
categories.


::


    from sqlalchemy_utils import aggregated


    class Catalog(Base):
        __tablename__ = 'catalog'
        id = sa.Column(sa.Integer, primary_key=True)
        name = sa.Column(sa.Unicode(255))

        @aggregated('categories.products', sa.Column(sa.Integer))
        def net_worth(self):
            return sa.func.sum(Product.price)

        categories = sa.orm.relationship('Category')


    class Category(Base):
        __tablename__ = 'category'
        id = sa.Column(sa.Integer, primary_key=True)
        name = sa.Column(sa.Unicode(255))

        catalog_id = sa.Column(sa.Integer, sa.ForeignKey(Catalog.id))

        products = sa.orm.relationship('Product')


    class Product(Base):
        __tablename__ = 'product'
        id = sa.Column(sa.Integer, primary_key=True)
        name = sa.Column(sa.Unicode(255))
        price = sa.Column(sa.Numeric)

        category_id = sa.Column(sa.Integer, sa.ForeignKey(Category.id))


Examples
--------

Average movie rating
^^^^^^^^^^^^^^^^^^^^

::


    from sqlalchemy_utils import aggregated


    class Movie(Base):
        __tablename__ = 'movie'
        id = sa.Column(sa.Integer, primary_key=True)
        name = sa.Column(sa.Unicode(255))

        @aggregated('ratings', sa.Column(sa.Numeric))
        def avg_rating(self):
            return sa.func.avg(Rating.stars)

        ratings = sa.orm.relationship('Rating')


    class Rating(Base):
        __tablename__ = 'rating'
        id = sa.Column(sa.Integer, primary_key=True)
        stars = sa.Column(sa.Integer)

        movie_id = sa.Column(sa.Integer, sa.ForeignKey(Movie.id))


    movie = Movie('Terminator 2')
    movie.ratings.append(Rating(stars=5))
    movie.ratings.append(Rating(stars=4))
    movie.ratings.append(Rating(stars=3))
    session.add(movie)
    session.commit()

    movie.avg_rating  # 4



TODO
----

* Special consideration should be given to `deadlocks`_.


.. _deadlocks:
    http://mina.naguib.ca/blog/2010/11/22/postgresql-foreign-key-deadlocks.html

"""


from collections import defaultdict
from weakref import WeakKeyDictionary

import sqlalchemy as sa
from sqlalchemy.ext.declarative import declared_attr
from sqlalchemy.sql.functions import _FunctionGenerator

from .functions.orm import get_column_key
from .relationships import (
    chained_join,
    path_to_relationships,
    select_correlated_expression
)

aggregated_attrs = WeakKeyDictionary()


class AggregatedAttribute(declared_attr):
    def __init__(
        self,
        fget,
        relationship,
        column,
        *args,
        **kwargs
    ):
        super(AggregatedAttribute, self).__init__(fget, *args, **kwargs)
        self.__doc__ = fget.__doc__
        self.column = column
        self.relationship = relationship

    def __get__(desc, self, cls):
        value = (desc.fget, desc.relationship, desc.column)
        if cls not in aggregated_attrs:
            aggregated_attrs[cls] = [value]
        else:
            aggregated_attrs[cls].append(value)
        return desc.column


def local_condition(prop, objects):
    pairs = prop.local_remote_pairs
    if prop.secondary is not None:
        parent_column = pairs[1][0]
        fetched_column = pairs[1][0]
    else:
        parent_column = pairs[0][0]
        fetched_column = pairs[0][1]

    key = get_column_key(prop.mapper, fetched_column)

    values = []
    for obj in objects:
        try:
            values.append(getattr(obj, key))
        except sa.orm.exc.ObjectDeletedError:
            pass

    if values:
        return parent_column.in_(values)


def aggregate_expression(expr, class_):
    if isinstance(expr, sa.sql.visitors.Visitable):
        return expr
    elif isinstance(expr, _FunctionGenerator):
        return expr(sa.sql.text('1'))
    else:
        return expr(class_)


class AggregatedValue(object):
    def __init__(self, class_, attr, path, expr):
        self.class_ = class_
        self.attr = attr
        self.path = path
        self.relationships = list(
            reversed(path_to_relationships(path, class_))
        )
        self.expr = aggregate_expression(expr, class_)

    @property
    def aggregate_query(self):
        query = select_correlated_expression(
            self.class_,
            self.expr,
            self.path,
            self.relationships[0].mapper.class_
        )

        return query.as_scalar()

    def update_query(self, objects):
        table = self.class_.__table__
        query = table.update().values(
            {self.attr: self.aggregate_query}
        )
        if len(self.relationships) == 1:
            prop = self.relationships[-1].property
            condition = local_condition(prop, objects)
            if condition is not None:
                return query.where(condition)
        else:
            # Builds query such as:
            #
            # UPDATE catalog SET product_count = (aggregate_query)
            # WHERE id IN (
            #     SELECT catalog_id
            #       FROM category
            #       INNER JOIN sub_category
            #           ON category.id = sub_category.category_id
            #       WHERE sub_category.id IN (product_sub_category_ids)
            # )
            property_ = self.relationships[-1].property
            remote_pairs = property_.local_remote_pairs
            local = remote_pairs[0][0]
            remote = remote_pairs[0][1]
            condition = local_condition(
                self.relationships[0].property,
                objects
            )
            if condition is not None:
                return query.where(
                    local.in_(
                        sa.select(
                            [remote],
                            from_obj=[
                                chained_join(*reversed(self.relationships))
                            ]
                        ).where(
                            condition
                        )
                    )
                )


class AggregationManager(object):
    def __init__(self):
        self.reset()

    def reset(self):
        self.generator_registry = defaultdict(list)

    def register_listeners(self):
        sa.event.listen(
            sa.orm.mapper,
            'after_configured',
            self.update_generator_registry
        )
        sa.event.listen(
            sa.orm.session.Session,
            'after_flush',
            self.construct_aggregate_queries
        )

    def update_generator_registry(self):
        for class_, attrs in aggregated_attrs.items():
            for expr, path, column in attrs:
                value = AggregatedValue(
                    class_=class_,
                    attr=column,
                    path=path,
                    expr=expr(class_)
                )
                key = value.relationships[0].mapper.class_
                self.generator_registry[key].append(
                    value
                )

    def construct_aggregate_queries(self, session, ctx):
        object_dict = defaultdict(list)
        for obj in session:
            class_ = obj.__class__
            if class_ in self.generator_registry:
                object_dict[class_].append(obj)

        for class_, objects in object_dict.items():
            for aggregate_value in self.generator_registry[class_]:
                query = aggregate_value.update_query(objects)
                if query is not None:
                    session.execute(query)


manager = AggregationManager()
manager.register_listeners()


def aggregated(
    relationship,
    column
):
    """
    Decorator that generates an aggregated attribute. The decorated function
    should return an aggregate select expression.

    :param relationship:
        Defines the relationship of which the aggregate is calculated from.
        The class needs to have given relationship in order to calculate the
        aggregate.
    :param column:
        SQLAlchemy Column object. The column definition of this aggregate
        attribute.
    """
    def wraps(func):
        return AggregatedAttribute(
            func,
            relationship,
            column
        )
    return wraps
