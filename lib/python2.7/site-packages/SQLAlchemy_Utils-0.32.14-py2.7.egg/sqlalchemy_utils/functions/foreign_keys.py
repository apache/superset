from collections import defaultdict
from itertools import groupby

import sqlalchemy as sa
from sqlalchemy.exc import NoInspectionAvailable
from sqlalchemy.orm import object_session
from sqlalchemy.schema import ForeignKeyConstraint, MetaData, Table

from ..query_chain import QueryChain
from .database import has_index
from .orm import get_column_key, get_mapper, get_tables


def get_foreign_key_values(fk, obj):
    return dict(
        (
            fk.constraint.columns.values()[index].key,
            getattr(obj, element.column.key)
        )
        for
        index, element
        in
        enumerate(fk.constraint.elements)
    )


def group_foreign_keys(foreign_keys):
    """
    Return a groupby iterator that groups given foreign keys by table.

    :param foreign_keys: a sequence of foreign keys


    ::

        foreign_keys = get_referencing_foreign_keys(User)

        for table, fks in group_foreign_keys(foreign_keys):
            # do something
            pass


    .. seealso:: :func:`get_referencing_foreign_keys`

    .. versionadded: 0.26.1
    """
    foreign_keys = sorted(
        foreign_keys, key=lambda key: key.constraint.table.name
    )
    return groupby(foreign_keys, lambda key: key.constraint.table)


def get_referencing_foreign_keys(mixed):
    """
    Returns referencing foreign keys for given Table object or declarative
    class.

    :param mixed:
        SA Table object or SA declarative class

    ::

        get_referencing_foreign_keys(User)  # set([ForeignKey('user.id')])

        get_referencing_foreign_keys(User.__table__)


    This function also understands inheritance. This means it returns
    all foreign keys that reference any table in the class inheritance tree.

    Let's say you have three classes which use joined table inheritance,
    namely TextItem, Article and BlogPost with Article and BlogPost inheriting
    TextItem.

    ::

        # This will check all foreign keys that reference either article table
        # or textitem table.
        get_referencing_foreign_keys(Article)

    .. seealso:: :func:`get_tables`
    """
    if isinstance(mixed, sa.Table):
        tables = [mixed]
    else:
        tables = get_tables(mixed)

    referencing_foreign_keys = set()

    for table in mixed.metadata.tables.values():
        if table not in tables:
            for constraint in table.constraints:
                if isinstance(constraint, sa.sql.schema.ForeignKeyConstraint):
                    for fk in constraint.elements:
                        if any(fk.references(t) for t in tables):
                            referencing_foreign_keys.add(fk)
    return referencing_foreign_keys


def merge_references(from_, to, foreign_keys=None):
    """
    Merge the references of an entity into another entity.

    Consider the following models::

        class User(self.Base):
            __tablename__ = 'user'
            id = sa.Column(sa.Integer, primary_key=True)
            name = sa.Column(sa.String(255))

            def __repr__(self):
                return 'User(name=%r)' % self.name

        class BlogPost(self.Base):
            __tablename__ = 'blog_post'
            id = sa.Column(sa.Integer, primary_key=True)
            title = sa.Column(sa.String(255))
            author_id = sa.Column(sa.Integer, sa.ForeignKey('user.id'))

            author = sa.orm.relationship(User)


    Now lets add some data::

        john = self.User(name='John')
        jack = self.User(name='Jack')
        post = self.BlogPost(title='Some title', author=john)
        post2 = self.BlogPost(title='Other title', author=jack)
        self.session.add_all([
            john,
            jack,
            post,
            post2
        ])
        self.session.commit()


    If we wanted to merge all John's references to Jack it would be as easy as
    ::

        merge_references(john, jack)
        self.session.commit()

        post.author     # User(name='Jack')
        post2.author    # User(name='Jack')



    :param from_: an entity to merge into another entity
    :param to: an entity to merge another entity into
    :param foreign_keys: A sequence of foreign keys. By default this is None
        indicating all referencing foreign keys should be used.

    .. seealso: :func:`dependent_objects`

    .. versionadded: 0.26.1
    """
    if from_.__tablename__ != to.__tablename__:
        raise TypeError('The tables of given arguments do not match.')

    session = object_session(from_)
    foreign_keys = get_referencing_foreign_keys(from_)

    for fk in foreign_keys:
        old_values = get_foreign_key_values(fk, from_)
        new_values = get_foreign_key_values(fk, to)
        criteria = (
            getattr(fk.constraint.table.c, key) == value
            for key, value in old_values.items()
        )
        try:
            mapper = get_mapper(fk.constraint.table)
        except ValueError:
            query = (
                fk.constraint.table
                .update()
                .where(sa.and_(*criteria))
                .values(new_values)
            )
            session.execute(query)
        else:
            (
                session.query(mapper.class_)
                .filter_by(**old_values)
                .update(
                    new_values,
                    'evaluate'
                )
            )


def dependent_objects(obj, foreign_keys=None):
    """
    Return a :class:`~sqlalchemy_utils.query_chain.QueryChain` that iterates
    through all dependent objects for given SQLAlchemy object.

    Consider a User object is referenced in various articles and also in
    various orders. Getting all these dependent objects is as easy as::

        from sqlalchemy_utils import dependent_objects


        dependent_objects(user)


    If you expect an object to have lots of dependent_objects it might be good
    to limit the results::


        dependent_objects(user).limit(5)



    The common use case is checking for all restrict dependent objects before
    deleting parent object and inform the user if there are dependent objects
    with ondelete='RESTRICT' foreign keys. If this kind of checking is not used
    it will lead to nasty IntegrityErrors being raised.

    In the following example we delete given user if it doesn't have any
    foreign key restricted dependent objects::


        from sqlalchemy_utils import get_referencing_foreign_keys


        user = session.query(User).get(some_user_id)


        deps = list(
            dependent_objects(
                user,
                (
                    fk for fk in get_referencing_foreign_keys(User)
                    # On most databases RESTRICT is the default mode hence we
                    # check for None values also
                    if fk.ondelete == 'RESTRICT' or fk.ondelete is None
                )
            ).limit(5)
        )

        if deps:
            # Do something to inform the user
            pass
        else:
            session.delete(user)


    :param obj: SQLAlchemy declarative model object
    :param foreign_keys:
        A sequence of foreign keys to use for searching the dependent_objects
        for given object. By default this is None, indicating that all foreign
        keys referencing the object will be used.

    .. note::
        This function does not support exotic mappers that use multiple tables

    .. seealso:: :func:`get_referencing_foreign_keys`
    .. seealso:: :func:`merge_references`

    .. versionadded: 0.26.0
    """
    if foreign_keys is None:
        foreign_keys = get_referencing_foreign_keys(obj)

    session = object_session(obj)

    chain = QueryChain([])
    classes = obj.__class__._decl_class_registry

    for table, keys in group_foreign_keys(foreign_keys):
        keys = list(keys)
        for class_ in classes.values():
            try:
                mapper = sa.inspect(class_)
            except NoInspectionAvailable:
                continue
            parent_mapper = mapper.inherits
            if (
                table in mapper.tables and
                not (parent_mapper and table in parent_mapper.tables)
            ):
                query = session.query(class_).filter(
                    sa.or_(*_get_criteria(keys, class_, obj))
                )
                chain.queries.append(query)
    return chain


def _get_criteria(keys, class_, obj):
    criteria = []
    visited_constraints = []
    for key in keys:
        if key.constraint in visited_constraints:
            continue
        visited_constraints.append(key.constraint)

        subcriteria = []
        for index, column in enumerate(key.constraint.columns):
            foreign_column = (
                key.constraint.elements[index].column
            )
            subcriteria.append(
                getattr(class_, get_column_key(class_, column)) ==
                getattr(
                    obj,
                    sa.inspect(type(obj))
                    .get_property_by_column(
                        foreign_column
                    ).key
                )
            )
        criteria.append(sa.and_(*subcriteria))
    return criteria


def non_indexed_foreign_keys(metadata, engine=None):
    """
    Finds all non indexed foreign keys from all tables of given MetaData.

    Very useful for optimizing postgresql database and finding out which
    foreign keys need indexes.

    :param metadata: MetaData object to inspect tables from
    """
    reflected_metadata = MetaData()

    if metadata.bind is None and engine is None:
        raise Exception(
            'Either pass a metadata object with bind or '
            'pass engine as a second parameter'
        )

    constraints = defaultdict(list)

    for table_name in metadata.tables.keys():
        table = Table(
            table_name,
            reflected_metadata,
            autoload=True,
            autoload_with=metadata.bind or engine
        )

        for constraint in table.constraints:
            if not isinstance(constraint, ForeignKeyConstraint):
                continue

            if not has_index(constraint):
                constraints[table.name].append(constraint)

    return dict(constraints)


def get_fk_constraint_for_columns(table, *columns):
    for constraint in table.constraints:
        if list(constraint.columns.values()) == list(columns):
            return constraint
