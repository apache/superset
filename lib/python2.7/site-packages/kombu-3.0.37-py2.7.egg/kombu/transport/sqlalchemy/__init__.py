"""Kombu transport using SQLAlchemy as the message store."""
# SQLAlchemy overrides != False to have special meaning and pep8 complains
# flake8: noqa

from __future__ import absolute_import

from anyjson import loads, dumps
from sqlalchemy import create_engine
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import sessionmaker

from kombu.five import Empty
from kombu.transport import virtual
from kombu.utils import cached_property
from kombu.utils.encoding import bytes_to_str

from .models import (ModelBase, Queue as QueueBase, Message as MessageBase,
                     class_registry, metadata)


VERSION = (1, 1, 0)
__version__ = '.'.join(map(str, VERSION))


class Channel(virtual.Channel):
    _session = None
    _engines = {}   # engine cache

    def __init__(self, connection, **kwargs):
        self._configure_entity_tablenames(connection.client.transport_options)
        super(Channel, self).__init__(connection, **kwargs)

    def _configure_entity_tablenames(self, opts):
        self.queue_tablename = opts.get('queue_tablename', 'kombu_queue')
        self.message_tablename = opts.get('message_tablename', 'kombu_message')

        #
        # Define the model definitions.  This registers the declarative
        # classes with the active SQLAlchemy metadata object.  This *must* be
        # done prior to the ``create_engine`` call.
        #
        self.queue_cls and self.message_cls

    def _engine_from_config(self):
        conninfo = self.connection.client
        transport_options = conninfo.transport_options.copy()
        transport_options.pop('queue_tablename', None)
        transport_options.pop('message_tablename', None)
        return create_engine(conninfo.hostname, **transport_options)

    def _open(self):
        conninfo = self.connection.client
        if conninfo.hostname not in self._engines:
            engine = self._engine_from_config()
            Session = sessionmaker(bind=engine)
            metadata.create_all(engine)
            self._engines[conninfo.hostname] = engine, Session
        return self._engines[conninfo.hostname]

    @property
    def session(self):
        if self._session is None:
            _, Session = self._open()
            self._session = Session()
        return self._session

    def _get_or_create(self, queue):
        obj = self.session.query(self.queue_cls) \
            .filter(self.queue_cls.name == queue).first()
        if not obj:
            obj = self.queue_cls(queue)
            self.session.add(obj)
            try:
                self.session.commit()
            except OperationalError:
                self.session.rollback()
        return obj

    def _new_queue(self, queue, **kwargs):
        self._get_or_create(queue)

    def _put(self, queue, payload, **kwargs):
        obj = self._get_or_create(queue)
        message = self.message_cls(dumps(payload), obj)
        self.session.add(message)
        try:
            self.session.commit()
        except OperationalError:
            self.session.rollback()

    def _get(self, queue):
        obj = self._get_or_create(queue)
        if self.session.bind.name == 'sqlite':
            self.session.execute('BEGIN IMMEDIATE TRANSACTION')
        try:
            msg = self.session.query(self.message_cls) \
                .with_lockmode('update') \
                .filter(self.message_cls.queue_id == obj.id) \
                .filter(self.message_cls.visible != False) \
                .order_by(self.message_cls.sent_at) \
                .order_by(self.message_cls.id) \
                .limit(1) \
                .first()
            if msg:
                msg.visible = False
                return loads(bytes_to_str(msg.payload))
            raise Empty()
        finally:
            self.session.commit()

    def _query_all(self, queue):
        obj = self._get_or_create(queue)
        return self.session.query(self.message_cls) \
            .filter(self.message_cls.queue_id == obj.id)

    def _purge(self, queue):
        count = self._query_all(queue).delete(synchronize_session=False)
        try:
            self.session.commit()
        except OperationalError:
            self.session.rollback()
        return count

    def _size(self, queue):
        return self._query_all(queue).count()

    def _declarative_cls(self, name, base, ns):
        if name in class_registry:
            return class_registry[name]
        return type(name, (base, ModelBase), ns)

    @cached_property
    def queue_cls(self):
        return self._declarative_cls(
            'Queue',
            QueueBase,
            {'__tablename__': self.queue_tablename}
        )

    @cached_property
    def message_cls(self):
        return self._declarative_cls(
            'Message',
            MessageBase,
            {'__tablename__': self.message_tablename}
        )


class Transport(virtual.Transport):
    Channel = Channel

    can_parse_url = True
    default_port = 0
    driver_type = 'sql'
    driver_name = 'sqlalchemy'
    connection_errors = (OperationalError, )

    def driver_version(self):
        import sqlalchemy
        return sqlalchemy.__version__
