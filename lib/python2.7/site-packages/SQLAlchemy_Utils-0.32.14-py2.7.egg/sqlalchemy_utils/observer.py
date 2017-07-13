"""
This module provides a decorator function for observing changes in a given
property. Internally the decorator is implemented using SQLAlchemy event
listeners. Both column properties and relationship properties can be observed.

Property observers can be used for pre-calculating aggregates and automatic
real-time data denormalization.

Simple observers
----------------

At the heart of the observer extension is the :func:`observes` decorator. You
mark some property path as being observed and the marked method will get
notified when any changes are made to given path.

Consider the following model structure:

::

    class Director(Base):
        __tablename__ = 'director'
        id = sa.Column(sa.Integer, primary_key=True)
        name = sa.Column(sa.String)
        date_of_birth = sa.Column(sa.Date)

    class Movie(Base):
        __tablename__ = 'movie'
        id = sa.Column(sa.Integer, primary_key=True)
        name = sa.Column(sa.String)
        director_id = sa.Column(sa.Integer, sa.ForeignKey(Director.id))
        director = sa.orm.relationship(Director, backref='movies')


Now consider we want to show movies in some listing ordered by director id
first and movie id secondly. If we have many movies then using joins and
ordering by Director.name will be very slow. Here is where denormalization
and :func:`observes` comes to rescue the day. Let's add a new column called
director_name to Movie which will get automatically copied from associated
Director.


::

    from sqlalchemy_utils import observes


    class Movie(Base):
        # same as before..
        director_name = sa.Column(sa.String)

        @observes('director')
        def director_observer(self, director):
            self.director_name = director.name

.. note::

    This example could be done much more efficiently using a compound foreign
    key from director_name, director_id to Director.name, Director.id but for
    the sake of simplicity we added this as an example.


Observes vs aggregated
----------------------

:func:`observes` and :func:`.aggregates.aggregated` can be used for similar
things. However performance wise you should take the following things into
consideration:

* :func:`observes` works always inside transaction and deals with objects. If
  the relationship observer is observing has a large number of objects it's
  better to use :func:`.aggregates.aggregated`.
* :func:`.aggregates.aggregated` always executes one additional query per
  aggregate so in scenarios where the observed relationship has only a handful
  of objects it's better to use :func:`observes` instead.


Example 1. Movie with many ratings

Let's say we have a Movie object with potentially thousands of ratings. In this
case we should always use :func:`.aggregates.aggregated` since iterating
through thousands of objects is slow and very memory consuming.

Example 2. Product with denormalized catalog name

Each product belongs to one catalog. Here it is natural to use :func:`observes`
for data denormalization.


Deeply nested observing
-----------------------

Consider the following model structure where Catalog has many Categories and
Category has many Products.

::

    class Catalog(Base):
        __tablename__ = 'catalog'
        id = sa.Column(sa.Integer, primary_key=True)
        product_count = sa.Column(sa.Integer, default=0)

        @observes('categories.products')
        def product_observer(self, products):
            self.product_count = len(products)

        categories = sa.orm.relationship('Category', backref='catalog')

    class Category(Base):
        __tablename__ = 'category'
        id = sa.Column(sa.Integer, primary_key=True)
        catalog_id = sa.Column(sa.Integer, sa.ForeignKey('catalog.id'))

        products = sa.orm.relationship('Product', backref='category')

    class Product(Base):
        __tablename__ = 'product'
        id = sa.Column(sa.Integer, primary_key=True)
        price = sa.Column(sa.Numeric)

        category_id = sa.Column(sa.Integer, sa.ForeignKey('category.id'))


:func:`observes` is smart enough to:

* Notify catalog objects of any changes in associated Product objects
* Notify catalog objects of any changes in Category objects that affect
  products (for example if Category gets deleted, or a new Category is added to
  Catalog with any number of Products)


::

    category = Category(
        products=[Product(), Product()]
    )
    category2 = Category(
        product=[Product()]
    )

    catalog = Catalog(
        categories=[category, category2]
    )
    session.add(catalog)
    session.commit()
    catalog.product_count  # 2

    session.delete(category)
    session.commit()
    catalog.product_count  # 1


Observing multiple columns
-----------------------

You can also observe multiple columns by specifying all the observable columns
in the decorator.


::

    class Order(Base):
        __tablename__ = 'order'
        id = sa.Column(sa.Integer, primary_key=True)
        unit_price = sa.Column(sa.Integer)
        amount = sa.Column(sa.Integer)
        total_price = sa.Column(sa.Integer)

        @observes('amount', 'unit_price')
        def total_price_observer(self, amount, unit_price):
            self.total_price = amount * unit_price



"""
import itertools
from collections import defaultdict, Iterable, namedtuple

import sqlalchemy as sa

from .functions import getdotattr, has_changes
from .path import AttrPath
from .utils import is_sequence

Callback = namedtuple('Callback', ['func', 'backref', 'fullpath'])


class PropertyObserver(object):
    def __init__(self):
        self.listener_args = [
            (
                sa.orm.mapper,
                'mapper_configured',
                self.update_generator_registry
            ),
            (
                sa.orm.mapper,
                'after_configured',
                self.gather_paths
            ),
            (
                sa.orm.session.Session,
                'before_flush',
                self.invoke_callbacks
            )
        ]
        self.callback_map = defaultdict(list)
        # TODO: make the registry a WeakKey dict
        self.generator_registry = defaultdict(list)

    def remove_listeners(self):
        for args in self.listener_args:
            sa.event.remove(*args)

    def register_listeners(self):
        for args in self.listener_args:
            if not sa.event.contains(*args):
                sa.event.listen(*args)

    def __repr__(self):
        return '<PropertyObserver>'

    def update_generator_registry(self, mapper, class_):
        """
        Adds generator functions to generator_registry.
        """

        for generator in class_.__dict__.values():
            if hasattr(generator, '__observes__'):
                self.generator_registry[class_].append(
                    generator
                )

    def gather_paths(self):
        for class_, generators in self.generator_registry.items():
            for callback in generators:
                full_paths = []
                for call_path in callback.__observes__:
                    full_paths.append(AttrPath(class_, call_path))

                for path in full_paths:
                    self.callback_map[class_].append(
                        Callback(
                            func=callback,
                            backref=None,
                            fullpath=full_paths
                        )
                    )

                    for index in range(len(path)):
                        i = index + 1
                        prop = path[index].property
                        if isinstance(prop, sa.orm.RelationshipProperty):
                            prop_class = path[index].property.mapper.class_
                            self.callback_map[prop_class].append(
                                Callback(
                                    func=callback,
                                    backref=~ (path[:i]),
                                    fullpath=full_paths
                                )
                            )

    def gather_callback_args(self, obj, callbacks):
        for callback in callbacks:
            backref = callback.backref

            root_objs = getdotattr(obj, backref) if backref else obj
            if root_objs:
                if not isinstance(root_objs, Iterable):
                    root_objs = [root_objs]

                for root_obj in root_objs:
                    if root_obj:
                        args = self.get_callback_args(root_obj, callback)
                        if args:
                            yield args

    def get_callback_args(self, root_obj, callback):
        session = sa.orm.object_session(root_obj)
        objects = [getdotattr(
            root_obj,
            path,
            lambda obj: obj not in session.deleted
        ) for path in callback.fullpath]
        paths = [str(path) for path in callback.fullpath]
        for path in paths:
            if '.' in path or has_changes(root_obj, path):
                return (
                    root_obj,
                    callback.func,
                    objects
                )

    def iterate_objects_and_callbacks(self, session):
        objs = itertools.chain(session.new, session.dirty, session.deleted)
        for obj in objs:
            for class_, callbacks in self.callback_map.items():
                if isinstance(obj, class_):
                    yield obj, callbacks

    def invoke_callbacks(self, session, ctx, instances):
        callback_args = defaultdict(lambda: defaultdict(set))
        for obj, callbacks in self.iterate_objects_and_callbacks(session):
            args = self.gather_callback_args(obj, callbacks)
            for (root_obj, func, objects) in args:
                if not callback_args[root_obj][func]:
                    callback_args[root_obj][func] = {}
                for i, object_ in enumerate(objects):
                    if is_sequence(object_):
                        callback_args[root_obj][func][i] = (
                            callback_args[root_obj][func].get(i, set()) |
                            set(object_)
                        )
                    else:
                        callback_args[root_obj][func][i] = object_

        for root_obj, callback_objs in callback_args.items():
            for callback, objs in callback_objs.items():
                callback(root_obj, *[objs[i] for i in range(len(objs))])


observer = PropertyObserver()


def observes(*paths, **observer_kw):
    """
    Mark method as property observer for the given property path. Inside
    transaction observer gathers all changes made in given property path and
    feeds the changed objects to observer-marked method at the before flush
    phase.

    ::

        from sqlalchemy_utils import observes


        class Catalog(Base):
            __tablename__ = 'catalog'
            id = sa.Column(sa.Integer, primary_key=True)
            category_count = sa.Column(sa.Integer, default=0)

            @observes('categories')
            def category_observer(self, categories):
                self.category_count = len(categories)

        class Category(Base):
            __tablename__ = 'category'
            id = sa.Column(sa.Integer, primary_key=True)
            catalog_id = sa.Column(sa.Integer, sa.ForeignKey('catalog.id'))


        catalog = Catalog(categories=[Category(), Category()])
        session.add(catalog)
        session.commit()

        catalog.category_count  # 2


    .. versionadded: 0.28.0

    :param *paths: One or more dot-notated property paths, eg.
       'categories.products.price'
    :param **observer: A dictionary where value for key 'observer' contains
       :meth:`PropertyObserver` object
    """
    observer_ = observer_kw.pop('observer', observer)
    observer_.register_listeners()

    def wraps(func):
        def wrapper(self, *args, **kwargs):
            return func(self, *args, **kwargs)
        wrapper.__observes__ = paths
        return wrapper
    return wraps
