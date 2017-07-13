from __future__ import absolute_import

import datetime

from sqlalchemy import (Column, Integer, String, Text, DateTime,
                        Sequence, Boolean, ForeignKey, SmallInteger)
from sqlalchemy.orm import relation
from sqlalchemy.ext.declarative import declarative_base, declared_attr
from sqlalchemy.schema import MetaData

class_registry = {}
metadata = MetaData()
ModelBase = declarative_base(metadata=metadata, class_registry=class_registry)


class Queue(object):
    __table_args__ = {'sqlite_autoincrement': True, 'mysql_engine': 'InnoDB'}

    id = Column(Integer, Sequence('queue_id_sequence'), primary_key=True,
                autoincrement=True)
    name = Column(String(200), unique=True)

    def __init__(self, name):
        self.name = name

    def __str__(self):
        return '<Queue({self.name})>'.format(self=self)

    @declared_attr
    def messages(cls):
        return relation('Message', backref='queue', lazy='noload')


class Message(object):
    __table_args__ = {'sqlite_autoincrement': True, 'mysql_engine': 'InnoDB'}

    id = Column(Integer, Sequence('message_id_sequence'),
                primary_key=True, autoincrement=True)
    visible = Column(Boolean, default=True, index=True)
    sent_at = Column('timestamp', DateTime, nullable=True, index=True,
                     onupdate=datetime.datetime.now)
    payload = Column(Text, nullable=False)
    version = Column(SmallInteger, nullable=False, default=1)

    __mapper_args__ = {'version_id_col': version}

    def __init__(self, payload, queue):
        self.payload = payload
        self.queue = queue

    def __str__(self):
        return '<Message: {0.sent_at} {0.payload} {0.queue_id}>'.format(self)

    @declared_attr
    def queue_id(self):
        return Column(
            Integer,
            ForeignKey(
                '%s.id' % class_registry['Queue'].__tablename__,
                name='FK_kombu_message_queue'
            )
        )
