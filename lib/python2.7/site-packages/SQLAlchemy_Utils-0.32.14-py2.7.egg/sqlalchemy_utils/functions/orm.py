from collections import OrderedDict
from functools import partial
from inspect import isclass
from operator import attrgetter

import six
import sqlalchemy as sa
from sqlalchemy.engine.interfaces import Dialect
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import mapperlib
from sqlalchemy.orm.attributes import InstrumentedAttribute
from sqlalchemy.orm.exc import UnmappedInstanceError
from sqlalchemy.orm.properties import ColumnProperty, RelationshipProperty
from sqlalchemy.orm.query import _ColumnEntity
from sqlalchemy.orm.session import object_session
from sqlalchemy.orm.util import AliasedInsp

from ..utils import is_sequence


def get_class_by_table(base, table, data=None):
    """
    Return declarative class associated with given table. If no class is found
    this function returns `None`. If multiple classes were found (polymorphic
    cases) additional `data` parameter can be given to hint which class
    to return.

    ::

        class User(Base):
            __tablename__ = 'entity'
            id = sa.Column(sa.Integer, primary_key=True)
            name = sa.Column(sa.String)


        get_class_by_table(Base, User.__table__)  # User class


    This function also supports models using single table inheritance.
    Additional data paratemer should be provided in these case.

    ::

        class Entity(Base):
            __tablename__ = 'entity'
            id = sa.Column(sa.Integer, primary_key=True)
            name = sa.Column(sa.String)
            type = sa.Column(sa.String)
            __mapper_args__ = {
                'polymorphic_on': type,
                'polymorphic_identity': 'entity'
            }

        class User(Entity):
            __mapper_args__ = {
                'polymorphic_identity': 'user'
            }


        # Entity class
        get_class_by_table(Base, Entity.__table__, {'type': 'entity'})

        # User class
        get_class_by_table(Base, Entity.__table__, {'type': 'user'})


    :param base: Declarative model base
    :param table: SQLAlchemy Table object
    :param data: Data row to determine the class in polymorphic scenarios
    :return: Declarative class or None.
    """
    found_classes = set(
        c for c in base._decl_class_registry.values()
        if hasattr(c, '__table__') and c.__table__ is table
    )
    if len(found_classes) > 1:
        if not data:
            raise ValueError(
                "Multiple declarative classes found for table '{0}'. "
                "Please provide data parameter for this function to be able "
                "to determine polymorphic scenarios.".format(
                    table.name
                )
            )
        else:
            for cls in found_classes:
                mapper = sa.inspect(cls)
                polymorphic_on = mapper.polymorphic_on.name
                if polymorphic_on in data:
                    if data[polymorphic_on] == mapper.polymorphic_identity:
                        return cls
            raise ValueError(
                "Multiple declarative classes found for table '{0}'. Given "
                "data row does not match any polymorphic identity of the "
                "found classes.".format(
                    table.name
                )
            )
    elif found_classes:
        return found_classes.pop()
    return None


def get_type(expr):
    """
    Return the associated type with given Column, InstrumentedAttribute,
    ColumnProperty, RelationshipProperty or other similar SQLAlchemy construct.

    For constructs wrapping columns this is the column type. For relationships
    this function returns the relationship mapper class.

    :param expr:
        SQLAlchemy Column, InstrumentedAttribute, ColumnProperty or other
        similar SA construct.

    ::

        class User(Base):
            __tablename__ = 'user'
            id = sa.Column(sa.Integer, primary_key=True)
            name = sa.Column(sa.String)


        class Article(Base):
            __tablename__ = 'article'
            id = sa.Column(sa.Integer, primary_key=True)
            author_id = sa.Column(sa.Integer, sa.ForeignKey(User.id))
            author = sa.orm.relationship(User)


        get_type(User.__table__.c.name)  # sa.String()
        get_type(User.name)  # sa.String()
        get_type(User.name.property)  # sa.String()

        get_type(Article.author)  # User


    .. versionadded: 0.30.9
    """
    if hasattr(expr, 'type'):
        return expr.type
    elif isinstance(expr, InstrumentedAttribute):
        expr = expr.property

    if isinstance(expr, ColumnProperty):
        return expr.columns[0].type
    elif isinstance(expr, RelationshipProperty):
        return expr.mapper.class_
    raise TypeError("Couldn't inspect type.")


def cast_if(expression, type_):
    """
    Produce a CAST expression but only if given expression is not of given type
    already.

    Assume we have a model with two fields id (Integer) and name (String).

    ::

        import sqlalchemy as sa
        from sqlalchemy_utils import cast_if


        cast_if(User.id, sa.Integer)    # "user".id
        cast_if(User.name, sa.String)   # "user".name
        cast_if(User.id, sa.String)     # CAST("user".id AS TEXT)


    This function supports scalar values as well.

    ::

        cast_if(1, sa.Integer)          # 1
        cast_if('text', sa.String)      # 'text'
        cast_if(1, sa.String)           # CAST(1 AS TEXT)


    :param expression:
        A SQL expression, such as a ColumnElement expression or a Python string
        which will be coerced into a bound literal value.
    :param type_:
        A TypeEngine class or instance indicating the type to which the CAST
        should apply.

    .. versionadded: 0.30.14
    """
    try:
        expr_type = get_type(expression)
    except TypeError:
        expr_type = expression
        check_type = type_().python_type
    else:
        check_type = type_

    return (
        sa.cast(expression, type_)
        if not isinstance(expr_type, check_type)
        else expression
    )


def get_column_key(model, column):
    """
    Return the key for given column in given model.

    :param model: SQLAlchemy declarative model object

    ::

        class User(Base):
            __tablename__ = 'user'
            id = sa.Column(sa.Integer, primary_key=True)
            name = sa.Column('_name', sa.String)


        get_column_key(User, User.__table__.c._name)  # 'name'

    .. versionadded: 0.26.5

    .. versionchanged: 0.27.11
        Throws UnmappedColumnError instead of ValueError when no property was
        found for given column. This is consistent with how SQLAlchemy works.
    """
    mapper = sa.inspect(model)
    try:
        return mapper.get_property_by_column(column).key
    except sa.orm.exc.UnmappedColumnError:
        for key, c in mapper.columns.items():
            if c.name == column.name and c.table is column.table:
                return key
    raise sa.orm.exc.UnmappedColumnError(
        'No column %s is configured on mapper %s...' %
        (column, mapper)
    )


def get_mapper(mixed):
    """
    Return related SQLAlchemy Mapper for given SQLAlchemy object.

    :param mixed: SQLAlchemy Table / Alias / Mapper / declarative model object

    ::

        from sqlalchemy_utils import get_mapper


        get_mapper(User)

        get_mapper(User())

        get_mapper(User.__table__)

        get_mapper(User.__mapper__)

        get_mapper(sa.orm.aliased(User))

        get_mapper(sa.orm.aliased(User.__table__))


    Raises:
        ValueError: if multiple mappers were found for given argument

    .. versionadded: 0.26.1
    """
    if isinstance(mixed, sa.orm.query._MapperEntity):
        mixed = mixed.expr
    elif isinstance(mixed, sa.Column):
        mixed = mixed.table
    elif isinstance(mixed, sa.orm.query._ColumnEntity):
        mixed = mixed.expr

    if isinstance(mixed, sa.orm.Mapper):
        return mixed
    if isinstance(mixed, sa.orm.util.AliasedClass):
        return sa.inspect(mixed).mapper
    if isinstance(mixed, sa.sql.selectable.Alias):
        mixed = mixed.element
    if isinstance(mixed, AliasedInsp):
        return mixed.mapper
    if isinstance(mixed, sa.orm.attributes.InstrumentedAttribute):
        mixed = mixed.class_
    if isinstance(mixed, sa.Table):
        mappers = [
            mapper for mapper in mapperlib._mapper_registry
            if mixed in mapper.tables
        ]
        if len(mappers) > 1:
            raise ValueError(
                "Multiple mappers found for table '%s'." % mixed.name
            )
        elif not mappers:
            raise ValueError(
                "Could not get mapper for table '%s'." % mixed.name
            )
        else:
            return mappers[0]
    if not isclass(mixed):
        mixed = type(mixed)
    return sa.inspect(mixed)


def get_bind(obj):
    """
    Return the bind for given SQLAlchemy Engine / Connection / declarative
    model object.

    :param obj: SQLAlchemy Engine / Connection / declarative model object

    ::

        from sqlalchemy_utils import get_bind


        get_bind(session)  # Connection object

        get_bind(user)

    """
    if hasattr(obj, 'bind'):
        conn = obj.bind
    else:
        try:
            conn = object_session(obj).bind
        except UnmappedInstanceError:
            conn = obj

    if not hasattr(conn, 'execute'):
        raise TypeError(
            'This method accepts only Session, Engine, Connection and '
            'declarative model objects.'
        )
    return conn


def get_primary_keys(mixed):
    """
    Return an OrderedDict of all primary keys for given Table object,
    declarative class or declarative class instance.

    :param mixed:
        SA Table object, SA declarative class or SA declarative class instance

    ::

        get_primary_keys(User)

        get_primary_keys(User())

        get_primary_keys(User.__table__)

        get_primary_keys(User.__mapper__)

        get_primary_keys(sa.orm.aliased(User))

        get_primary_keys(sa.orm.aliased(User.__table__))


    .. versionchanged: 0.25.3
        Made the function return an ordered dictionary instead of generator.
        This change was made to support primary key aliases.

        Renamed this function to 'get_primary_keys', formerly 'primary_keys'

    .. seealso:: :func:`get_columns`
    """
    return OrderedDict(
        (
            (key, column) for key, column in get_columns(mixed).items()
            if column.primary_key
        )
    )


def get_tables(mixed):
    """
    Return a set of tables associated with given SQLAlchemy object.

    Let's say we have three classes which use joined table inheritance
    TextItem, Article and BlogPost. Article and BlogPost inherit TextItem.

    ::

        get_tables(Article)  # set([Table('article', ...), Table('text_item')])

        get_tables(Article())

        get_tables(Article.__mapper__)


    If the TextItem entity is using with_polymorphic='*' then this function
    returns all child tables (article and blog_post) as well.

    ::


        get_tables(TextItem)  # set([Table('text_item', ...)], ...])


    .. versionadded: 0.26.0

    :param mixed:
        SQLAlchemy Mapper, Declarative class, Column, InstrumentedAttribute or
        a SA Alias object wrapping any of these objects.
    """
    if isinstance(mixed, sa.Table):
        return [mixed]
    elif isinstance(mixed, sa.Column):
        return [mixed.table]
    elif isinstance(mixed, sa.orm.attributes.InstrumentedAttribute):
        return mixed.parent.tables
    elif isinstance(mixed, sa.orm.query._ColumnEntity):
        mixed = mixed.expr

    mapper = get_mapper(mixed)

    polymorphic_mappers = get_polymorphic_mappers(mapper)
    if polymorphic_mappers:
        tables = sum((m.tables for m in polymorphic_mappers), [])
    else:
        tables = mapper.tables
    return tables


def get_columns(mixed):
    """
    Return a collection of all Column objects for given SQLAlchemy
    object.

    The type of the collection depends on the type of the object to return the
    columns from.

    ::

        get_columns(User)

        get_columns(User())

        get_columns(User.__table__)

        get_columns(User.__mapper__)

        get_columns(sa.orm.aliased(User))

        get_columns(sa.orm.alised(User.__table__))


    :param mixed:
        SA Table object, SA Mapper, SA declarative class, SA declarative class
        instance or an alias of any of these objects
    """
    if isinstance(mixed, sa.sql.selectable.Selectable):
        return mixed.c
    if isinstance(mixed, sa.orm.util.AliasedClass):
        return sa.inspect(mixed).mapper.columns
    if isinstance(mixed, sa.orm.Mapper):
        return mixed.columns
    if isinstance(mixed, InstrumentedAttribute):
        return mixed.property.columns
    if isinstance(mixed, ColumnProperty):
        return mixed.columns
    if isinstance(mixed, sa.Column):
        return [mixed]
    if not isclass(mixed):
        mixed = mixed.__class__
    return sa.inspect(mixed).columns


def table_name(obj):
    """
    Return table name of given target, declarative class or the
    table name where the declarative attribute is bound to.
    """
    class_ = getattr(obj, 'class_', obj)

    try:
        return class_.__tablename__
    except AttributeError:
        pass

    try:
        return class_.__table__.name
    except AttributeError:
        pass


def getattrs(obj, attrs):
    return map(partial(getattr, obj), attrs)


def quote(mixed, ident):
    """
    Conditionally quote an identifier.
    ::


        from sqlalchemy_utils import quote


        engine = create_engine('sqlite:///:memory:')

        quote(engine, 'order')
        # '"order"'

        quote(engine, 'some_other_identifier')
        # 'some_other_identifier'


    :param mixed: SQLAlchemy Session / Connection / Engine / Dialect object.
    :param ident: identifier to conditionally quote
    """
    if isinstance(mixed, Dialect):
        dialect = mixed
    else:
        dialect = get_bind(mixed).dialect
    return dialect.preparer(dialect).quote(ident)


def query_labels(query):
    """
    Return all labels for given SQLAlchemy query object.

    Example::


        query = session.query(
            Category,
            db.func.count(Article.id).label('articles')
        )

        query_labels(query)  # ['articles']

    :param query: SQLAlchemy Query object
    """
    return [
        entity._label_name for entity in query._entities
        if isinstance(entity, _ColumnEntity) and entity._label_name
    ]


def get_query_entities(query):
    """
    Return a list of all entities present in given SQLAlchemy query object.

    Examples::


        from sqlalchemy_utils import get_query_entities


        query = session.query(Category)

        get_query_entities(query)  # [<Category>]


        query = session.query(Category.id)

        get_query_entities(query)  # [<Category>]


    This function also supports queries with joins.

    ::


        query = session.query(Category).join(Article)

        get_query_entities(query)  # [<Category>, <Article>]

    .. versionchanged: 0.26.7
        This function now returns a list instead of generator

    :param query: SQLAlchemy Query object
    """
    exprs = [
        d['expr']
        if is_labeled_query(d['expr']) or isinstance(d['expr'], sa.Column)
        else d['entity']
        for d in query.column_descriptions
    ]
    return [
        get_query_entity(expr) for expr in exprs
    ] + [
        get_query_entity(entity) for entity in query._join_entities
    ]


def is_labeled_query(expr):
    return (
        isinstance(expr, sa.sql.elements.Label) and
        isinstance(
            list(expr.base_columns)[0],
            (sa.sql.selectable.Select, sa.sql.selectable.ScalarSelect)
        )
    )


def get_query_entity(expr):
    if isinstance(expr, sa.orm.attributes.InstrumentedAttribute):
        return expr.parent.class_
    elif isinstance(expr, sa.Column):
        return expr.table
    elif isinstance(expr, AliasedInsp):
        return expr.entity
    return expr


def get_query_entity_by_alias(query, alias):
    entities = get_query_entities(query)

    if not alias:
        return entities[0]

    for entity in entities:
        if isinstance(entity, sa.orm.util.AliasedClass):
            name = sa.inspect(entity).name
        else:
            name = get_mapper(entity).tables[0].name

        if name == alias:
            return entity


def get_polymorphic_mappers(mixed):
    if isinstance(mixed, AliasedInsp):
        return mixed.with_polymorphic_mappers
    else:
        return mixed.polymorphic_map.values()


def get_query_descriptor(query, entity, attr):
    if attr in query_labels(query):
        return attr
    else:
        entity = get_query_entity_by_alias(query, entity)
        if entity:
            descriptor = get_descriptor(entity, attr)
            if (
                hasattr(descriptor, 'property') and
                isinstance(descriptor.property, sa.orm.RelationshipProperty)
            ):
                return
            return descriptor


def get_descriptor(entity, attr):
    mapper = sa.inspect(entity)

    for key, descriptor in get_all_descriptors(mapper).items():
        if attr == key:
            prop = (
                descriptor.property
                if hasattr(descriptor, 'property')
                else None
            )
            if isinstance(prop, ColumnProperty):
                if isinstance(entity, sa.orm.util.AliasedClass):
                    for c in mapper.selectable.c:
                        if c.key == attr:
                            return c
                else:
                    # If the property belongs to a class that uses
                    # polymorphic inheritance we have to take into account
                    # situations where the attribute exists in child class
                    # but not in parent class.
                    return getattr(prop.parent.class_, attr)
            else:
                # Handle synonyms, relationship properties and hybrid
                # properties

                if isinstance(entity, sa.orm.util.AliasedClass):
                    return getattr(entity, attr)
                try:
                    return getattr(mapper.class_, attr)
                except AttributeError:
                    pass


def get_all_descriptors(expr):
    if isinstance(expr, sa.sql.selectable.Selectable):
        return expr.c
    insp = sa.inspect(expr)
    try:
        polymorphic_mappers = get_polymorphic_mappers(insp)
    except sa.exc.NoInspectionAvailable:
        return get_mapper(expr).all_orm_descriptors
    else:
        attrs = dict(get_mapper(expr).all_orm_descriptors)
        for submapper in polymorphic_mappers:
            for key, descriptor in submapper.all_orm_descriptors.items():
                if key not in attrs:
                    attrs[key] = descriptor
        return attrs


def get_hybrid_properties(model):
    """
    Returns a dictionary of hybrid property keys and hybrid properties for
    given SQLAlchemy declarative model / mapper.


    Consider the following model

    ::


        from sqlalchemy.ext.hybrid import hybrid_property


        class Category(Base):
            __tablename__ = 'category'
            id = sa.Column(sa.Integer, primary_key=True)
            name = sa.Column(sa.Unicode(255))

            @hybrid_property
            def lowercase_name(self):
                return self.name.lower()

            @lowercase_name.expression
            def lowercase_name(cls):
                return sa.func.lower(cls.name)


    You can now easily get a list of all hybrid property names

    ::


        from sqlalchemy_utils import get_hybrid_properties


        get_hybrid_properties(Category).keys()  # ['lowercase_name']


    This function also supports aliased classes

    ::


        get_hybrid_properties(
            sa.orm.aliased(Category)
        ).keys()  # ['lowercase_name']


    .. versionchanged: 0.26.7
        This function now returns a dictionary instead of generator

    .. versionchanged: 0.30.15
        Added support for aliased classes

    :param model: SQLAlchemy declarative model or mapper
    """
    return dict(
        (key, prop)
        for key, prop in get_mapper(model).all_orm_descriptors.items()
        if isinstance(prop, hybrid_property)
    )


def get_declarative_base(model):
    """
    Returns the declarative base for given model class.

    :param model: SQLAlchemy declarative model
    """
    for parent in model.__bases__:
        try:
            parent.metadata
            return get_declarative_base(parent)
        except AttributeError:
            pass
    return model


def getdotattr(obj_or_class, dot_path, condition=None):
    """
    Allow dot-notated strings to be passed to `getattr`.

    ::

        getdotattr(SubSection, 'section.document')

        getdotattr(subsection, 'section.document')


    :param obj_or_class: Any object or class
    :param dot_path: Attribute path with dot mark as separator
    """
    last = obj_or_class

    for path in str(dot_path).split('.'):
        getter = attrgetter(path)

        if is_sequence(last):
            tmp = []
            for element in last:
                value = getter(element)
                if is_sequence(value):
                    tmp.extend(value)
                else:
                    tmp.append(value)
            last = tmp
        elif isinstance(last, InstrumentedAttribute):
            last = getter(last.property.mapper.class_)
        elif last is None:
            return None
        else:
            last = getter(last)
        if condition is not None:
            if is_sequence(last):
                last = [v for v in last if condition(v)]
            else:
                if not condition(last):
                    return None

    return last


def is_deleted(obj):
    return obj in sa.orm.object_session(obj).deleted


def has_changes(obj, attrs=None, exclude=None):
    """
    Simple shortcut function for checking if given attributes of given
    declarative model object have changed during the session. Without
    parameters this checks if given object has any modificiations. Additionally
    exclude parameter can be given to check if given object has any changes
    in any attributes other than the ones given in exclude.


    ::


        from sqlalchemy_utils import has_changes


        user = User()

        has_changes(user, 'name')  # False

        user.name = u'someone'

        has_changes(user, 'name')  # True

        has_changes(user)  # True


    You can check multiple attributes as well.
    ::


        has_changes(user, ['age'])  # True

        has_changes(user, ['name', 'age'])  # True


    This function also supports excluding certain attributes.

    ::

        has_changes(user, exclude=['name'])  # False

        has_changes(user, exclude=['age'])  # True

    .. versionchanged: 0.26.6
        Added support for multiple attributes and exclude parameter.

    :param obj: SQLAlchemy declarative model object
    :param attrs: Names of the attributes
    :param exclude: Names of the attributes to exclude
    """
    if attrs:
        if isinstance(attrs, six.string_types):
            return (
                sa.inspect(obj)
                .attrs
                .get(attrs)
                .history
                .has_changes()
            )
        else:
            return any(has_changes(obj, attr) for attr in attrs)
    else:
        if exclude is None:
            exclude = []
        return any(
            attr.history.has_changes()
            for key, attr in sa.inspect(obj).attrs.items()
            if key not in exclude
        )


def is_loaded(obj, prop):
    """
    Return whether or not given property of given object has been loaded.

    ::

        class Article(Base):
            __tablename__ = 'article'
            id = sa.Column(sa.Integer, primary_key=True)
            name = sa.Column(sa.String)
            content = sa.orm.deferred(sa.Column(sa.String))


        article = session.query(Article).get(5)

        # name gets loaded since its not a deferred property
        assert is_loaded(article, 'name')

        # content has not yet been loaded since its a deferred property
        assert not is_loaded(article, 'content')


    .. versionadded: 0.27.8

    :param obj: SQLAlchemy declarative model object
    :param prop: Name of the property or InstrumentedAttribute
    """
    return not isinstance(
        getattr(sa.inspect(obj).attrs, prop).loaded_value,
        sa.util.langhelpers._symbol
    )


def identity(obj_or_class):
    """
    Return the identity of given sqlalchemy declarative model class or instance
    as a tuple. This differs from obj._sa_instance_state.identity in a way that
    it always returns the identity even if object is still in transient state (
    new object that is not yet persisted into database). Also for classes it
    returns the identity attributes.

    ::

        from sqlalchemy import inspect
        from sqlalchemy_utils import identity


        user = User(name=u'John Matrix')
        session.add(user)
        identity(user)  # None
        inspect(user).identity  # None

        session.flush()  # User now has id but is still in transient state

        identity(user)  # (1,)
        inspect(user).identity  # None

        session.commit()

        identity(user)  # (1,)
        inspect(user).identity  # (1, )


    You can also use identity for classes::


        identity(User)  # (User.id, )

    .. versionadded: 0.21.0

    :param obj: SQLAlchemy declarative model object
    """
    return tuple(
        getattr(obj_or_class, column_key)
        for column_key in get_primary_keys(obj_or_class).keys()
    )


def naturally_equivalent(obj, obj2):
    """
    Returns whether or not two given SQLAlchemy declarative instances are
    naturally equivalent (all their non primary key properties are equivalent).


    ::

        from sqlalchemy_utils import naturally_equivalent


        user = User(name=u'someone')
        user2 = User(name=u'someone')

        user == user2  # False

        naturally_equivalent(user, user2)  # True


    :param obj: SQLAlchemy declarative model object
    :param obj2: SQLAlchemy declarative model object to compare with `obj`
    """
    for column_key, column in sa.inspect(obj.__class__).columns.items():
        if column.primary_key:
            continue

        if not (getattr(obj, column_key) == getattr(obj2, column_key)):
            return False
    return True
