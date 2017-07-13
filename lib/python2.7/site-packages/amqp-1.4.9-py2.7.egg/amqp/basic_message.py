"""Messages for AMQP"""
# Copyright (C) 2007-2008 Barry Pederson <bp@barryp.org>
#
# This library is free software; you can redistribute it and/or
# modify it under the terms of the GNU Lesser General Public
# License as published by the Free Software Foundation; either
# version 2.1 of the License, or (at your option) any later version.
#
# This library is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
# Lesser General Public License for more details.
#
# You should have received a copy of the GNU Lesser General Public
# License along with this library; if not, write to the Free Software
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301
from __future__ import absolute_import

from .serialization import GenericContent

__all__ = ['Message']


class Message(GenericContent):
    """A Message for use with the Channnel.basic_* methods."""

    #: Instances of this class have these attributes, which
    #: are passed back and forth as message properties between
    #: client and server
    PROPERTIES = [
        ('content_type', 'shortstr'),
        ('content_encoding', 'shortstr'),
        ('application_headers', 'table'),
        ('delivery_mode', 'octet'),
        ('priority', 'octet'),
        ('correlation_id', 'shortstr'),
        ('reply_to', 'shortstr'),
        ('expiration', 'shortstr'),
        ('message_id', 'shortstr'),
        ('timestamp', 'timestamp'),
        ('type', 'shortstr'),
        ('user_id', 'shortstr'),
        ('app_id', 'shortstr'),
        ('cluster_id', 'shortstr')
    ]

    def __init__(self, body='', children=None, channel=None, **properties):
        """Expected arg types

            body: string
            children: (not supported)

        Keyword properties may include:

            content_type: shortstr
                MIME content type

            content_encoding: shortstr
                MIME content encoding

            application_headers: table
                Message header field table, a dict with string keys,
                and string | int | Decimal | datetime | dict values.

            delivery_mode: octet
                Non-persistent (1) or persistent (2)

            priority: octet
                The message priority, 0 to 9

            correlation_id: shortstr
                The application correlation identifier

            reply_to: shortstr
                The destination to reply to

            expiration: shortstr
                Message expiration specification

            message_id: shortstr
                The application message identifier

            timestamp: datetime.datetime
                The message timestamp

            type: shortstr
                The message type name

            user_id: shortstr
                The creating user id

            app_id: shortstr
                The creating application id

            cluster_id: shortstr
                Intra-cluster routing identifier

        Unicode bodies are encoded according to the 'content_encoding'
        argument. If that's None, it's set to 'UTF-8' automatically.

        example::

            msg = Message('hello world',
                            content_type='text/plain',
                            application_headers={'foo': 7})

        """
        super(Message, self).__init__(**properties)
        self.body = body
        self.channel = channel

    def __eq__(self, other):
        """Check if the properties and bodies of this Message and another
        Message are the same.

        Received messages may contain a 'delivery_info' attribute,
        which isn't compared.

        """
        try:
            return (super(Message, self).__eq__(other) and
                    self.body == other.body)
        except AttributeError:
            return NotImplemented
