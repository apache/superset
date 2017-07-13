import sqlalchemy as sa

from .exceptions import ImproperlyConfigured


def coercion_listener(mapper, class_):
    """
    Auto assigns coercing listener for all class properties which are of coerce
    capable type.
    """
    for prop in mapper.iterate_properties:
        try:
            listener = prop.columns[0].type.coercion_listener
        except AttributeError:
            continue
        sa.event.listen(
            getattr(class_, prop.key),
            'set',
            listener,
            retval=True
        )


def instant_defaults_listener(target, args, kwargs):
    for key, column in sa.inspect(target.__class__).columns.items():
        if hasattr(column, 'default') and column.default is not None:
            if callable(column.default.arg):
                setattr(target, key, column.default.arg(target))
            else:
                setattr(target, key, column.default.arg)


def force_auto_coercion(mapper=None):
    """
    Function that assigns automatic data type coercion for all classes which
    are of type of given mapper. The coercion is applied to all coercion
    capable properties. By default coercion is applied to all SQLAlchemy
    mappers.

    Before initializing your models you need to call force_auto_coercion.

    ::

        from sqlalchemy_utils import force_auto_coercion


        force_auto_coercion()


    Then define your models the usual way::


        class Document(Base):
            __tablename__ = 'document'
            id = sa.Column(sa.Integer, autoincrement=True)
            name = sa.Column(sa.Unicode(50))
            background_color = sa.Column(ColorType)


    Now scalar values for coercion capable data types will convert to
    appropriate value objects::

        document = Document()
        document.background_color = 'F5F5F5'
        document.background_color  # Color object
        session.commit()

    A useful side-effect of this is that additional validation of data will be
    done on the moment it is being assigned to model objects. For example
    without auto coerction set, an invalid
    :class:`sqlalchemy_utils.types.IPAddressType` (eg. ``10.0.0 255.255``)
    would get through without an exception being raised. The database wouldn't
    notice this (as most databases don't have a native type for an IP address,
    so they're usually just stored as a string), and the ``ipaddress/ipaddr``
    package uses a string field as well.

    :param mapper: The mapper which the automatic data type coercion should be
                   applied to
    """
    if mapper is None:
        mapper = sa.orm.mapper
    sa.event.listen(mapper, 'mapper_configured', coercion_listener)


def force_instant_defaults(mapper=None):
    """
    Function that assigns object column defaults on object initialization
    time. By default calling this function applies instant defaults to all
    your models.

    Setting up instant defaults::


        from sqlalchemy_utils import force_instant_defaults


        force_instant_defaults()

    Example usage::


        class Document(Base):
            __tablename__ = 'document'
            id = sa.Column(sa.Integer, autoincrement=True)
            name = sa.Column(sa.Unicode(50))
            created_at = sa.Column(sa.DateTime, default=datetime.now)


        document = Document()
        document.created_at  # datetime object


    :param mapper: The mapper which the automatic instant defaults forcing
                   should be applied to
    """
    if mapper is None:
        mapper = sa.orm.mapper
    sa.event.listen(mapper, 'init', instant_defaults_listener)


def auto_delete_orphans(attr):
    """
    Delete orphans for given SQLAlchemy model attribute. This function can be
    used for deleting many-to-many associated orphans easily. For more
    information see
    https://bitbucket.org/zzzeek/sqlalchemy/wiki/UsageRecipes/ManyToManyOrphan.

    Consider the following model definition:

    ::

        from sqlalchemy.ext.associationproxy import association_proxy
        from sqlalchemy import *
        from sqlalchemy.orm import *
        from sqlalchemy.ext.declarative import declarative_base
        from sqlalchemy import event


        Base = declarative_base()

        tagging = Table(
            'tagging',
            Base.metadata,
            Column(
                'tag_id',
                Integer,
                ForeignKey('tag.id', ondelete='CASCADE'),
                primary_key=True
            ),
            Column(
                'entry_id',
                Integer,
                ForeignKey('entry.id', ondelete='CASCADE'),
                primary_key=True
            )
        )

        class Tag(Base):
            __tablename__ = 'tag'
            id = Column(Integer, primary_key=True)
            name = Column(String(100), unique=True, nullable=False)

            def __init__(self, name=None):
                self.name = name

        class Entry(Base):
            __tablename__ = 'entry'

            id = Column(Integer, primary_key=True)

            tags = relationship(
                'Tag',
                secondary=tagging,
                backref='entries'
            )

    Now lets say we want to delete the tags if all their parents get deleted (
    all Entry objects get deleted). This can be achieved as follows:

    ::


        from sqlalchemy_utils import auto_delete_orphans


        auto_delete_orphans(Entry.tags)


    After we've set up this listener we can see it in action.

    ::


        e = create_engine('sqlite://')

        Base.metadata.create_all(e)

        s = Session(e)

        r1 = Entry()
        r2 = Entry()
        r3 = Entry()
        t1, t2, t3, t4 = Tag('t1'), Tag('t2'), Tag('t3'), Tag('t4')

        r1.tags.extend([t1, t2])
        r2.tags.extend([t2, t3])
        r3.tags.extend([t4])
        s.add_all([r1, r2, r3])

        assert s.query(Tag).count() == 4

        r2.tags.remove(t2)

        assert s.query(Tag).count() == 4

        r1.tags.remove(t2)

        assert s.query(Tag).count() == 3

        r1.tags.remove(t1)

        assert s.query(Tag).count() == 2

    .. versionadded: 0.26.4

    :param attr: Association relationship attribute to auto delete orphans from
    """

    parent_class = attr.parent.class_
    target_class = attr.property.mapper.class_

    backref = attr.property.backref
    if not backref:
        raise ImproperlyConfigured(
            'The relationship argument given for auto_delete_orphans needs to '
            'have a backref relationship set.'
        )
    if isinstance(backref, tuple):
        backref = backref[0]

    @sa.event.listens_for(sa.orm.Session, 'after_flush')
    def delete_orphan_listener(session, ctx):
        # Look through Session state to see if we want to emit a DELETE for
        # orphans
        orphans_found = (
            any(
                isinstance(obj, parent_class) and
                sa.orm.attributes.get_history(obj, attr.key).deleted
                for obj in session.dirty
            ) or
            any(
                isinstance(obj, parent_class)
                for obj in session.deleted
            )
        )

        if orphans_found:
            # Emit a DELETE for all orphans
            (
                session.query(target_class)
                .filter(
                    ~getattr(target_class, backref).any()
                )
                .delete(synchronize_session=False)
            )
