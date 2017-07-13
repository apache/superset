"""Exceptions used by amqp"""
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

from struct import pack, unpack

__all__ = [
    'AMQPError',
    'ConnectionError', 'ChannelError',
    'RecoverableConnectionError', 'IrrecoverableConnectionError',
    'RecoverableChannelError', 'IrrecoverableChannelError',
    'ConsumerCancelled', 'ContentTooLarge', 'NoConsumers',
    'ConnectionForced', 'InvalidPath', 'AccessRefused', 'NotFound',
    'ResourceLocked', 'PreconditionFailed', 'FrameError', 'FrameSyntaxError',
    'InvalidCommand', 'ChannelNotOpen', 'UnexpectedFrame', 'ResourceError',
    'NotConfirmed', 'NotAllowed', 'AMQPNotImplementedError', 'InternalError',
]


class AMQPError(Exception):
    code = 0

    def __init__(self, reply_text=None, method_sig=None,
                 method_name=None, reply_code=None):
        self.message = reply_text
        self.reply_code = reply_code or self.code
        self.reply_text = reply_text
        self.method_sig = method_sig
        self.method_name = method_name or ''
        if method_sig and not self.method_name:
            self.method_name = METHOD_NAME_MAP.get(method_sig, '')
        Exception.__init__(self, reply_code,
                           reply_text, method_sig, self.method_name)

    def __str__(self):
        if self.method:
            return '{0.method}: ({0.reply_code}) {0.reply_text}'.format(self)
        return self.reply_text or '<AMQPError: unknown error>'

    @property
    def method(self):
        return self.method_name or self.method_sig


class ConnectionError(AMQPError):
    pass


class ChannelError(AMQPError):
    pass


class RecoverableChannelError(ChannelError):
    pass


class IrrecoverableChannelError(ChannelError):
    pass


class RecoverableConnectionError(ConnectionError):
    pass


class IrrecoverableConnectionError(ConnectionError):
    pass


class Blocked(RecoverableConnectionError):
    pass


class ConsumerCancelled(RecoverableConnectionError):
    pass


class ContentTooLarge(RecoverableChannelError):
    code = 311


class NoConsumers(RecoverableChannelError):
    code = 313


class ConnectionForced(RecoverableConnectionError):
    code = 320


class InvalidPath(IrrecoverableConnectionError):
    code = 402


class AccessRefused(IrrecoverableChannelError):
    code = 403


class NotFound(IrrecoverableChannelError):
    code = 404


class NotConfirmed(RecoverableConnectionError):
    pass


class ResourceLocked(RecoverableChannelError):
    code = 405


class PreconditionFailed(IrrecoverableChannelError):
    code = 406


class FrameError(IrrecoverableConnectionError):
    code = 501


class FrameSyntaxError(IrrecoverableConnectionError):
    code = 502


class InvalidCommand(IrrecoverableConnectionError):
    code = 503


class ChannelNotOpen(IrrecoverableConnectionError):
    code = 504


class UnexpectedFrame(IrrecoverableConnectionError):
    code = 505


class ResourceError(RecoverableConnectionError):
    code = 506


class NotAllowed(IrrecoverableConnectionError):
    code = 530


class AMQPNotImplementedError(IrrecoverableConnectionError):
    code = 540


class InternalError(IrrecoverableConnectionError):
    code = 541


ERROR_MAP = {
    311: ContentTooLarge,
    313: NoConsumers,
    320: ConnectionForced,
    402: InvalidPath,
    403: AccessRefused,
    404: NotFound,
    405: ResourceLocked,
    406: PreconditionFailed,
    501: FrameError,
    502: FrameSyntaxError,
    503: InvalidCommand,
    504: ChannelNotOpen,
    505: UnexpectedFrame,
    506: ResourceError,
    530: NotAllowed,
    540: AMQPNotImplementedError,
    541: InternalError,
}


def error_for_code(code, text, method, default):
    try:
        return ERROR_MAP[code](text, method, reply_code=code)
    except KeyError:
        return default(text, method, reply_code=code)


def raise_for_code(code, text, method, default):
    raise error_for_code(code, text, method, default)


METHOD_NAME_MAP = {
    (10, 10): 'Connection.start',
    (10, 11): 'Connection.start_ok',
    (10, 20): 'Connection.secure',
    (10, 21): 'Connection.secure_ok',
    (10, 30): 'Connection.tune',
    (10, 31): 'Connection.tune_ok',
    (10, 40): 'Connection.open',
    (10, 41): 'Connection.open_ok',
    (10, 50): 'Connection.close',
    (10, 51): 'Connection.close_ok',
    (20, 10): 'Channel.open',
    (20, 11): 'Channel.open_ok',
    (20, 20): 'Channel.flow',
    (20, 21): 'Channel.flow_ok',
    (20, 40): 'Channel.close',
    (20, 41): 'Channel.close_ok',
    (30, 10): 'Access.request',
    (30, 11): 'Access.request_ok',
    (40, 10): 'Exchange.declare',
    (40, 11): 'Exchange.declare_ok',
    (40, 20): 'Exchange.delete',
    (40, 21): 'Exchange.delete_ok',
    (40, 30): 'Exchange.bind',
    (40, 31): 'Exchange.bind_ok',
    (40, 40): 'Exchange.unbind',
    (40, 41): 'Exchange.unbind_ok',
    (50, 10): 'Queue.declare',
    (50, 11): 'Queue.declare_ok',
    (50, 20): 'Queue.bind',
    (50, 21): 'Queue.bind_ok',
    (50, 30): 'Queue.purge',
    (50, 31): 'Queue.purge_ok',
    (50, 40): 'Queue.delete',
    (50, 41): 'Queue.delete_ok',
    (50, 50): 'Queue.unbind',
    (50, 51): 'Queue.unbind_ok',
    (60, 10): 'Basic.qos',
    (60, 11): 'Basic.qos_ok',
    (60, 20): 'Basic.consume',
    (60, 21): 'Basic.consume_ok',
    (60, 30): 'Basic.cancel',
    (60, 31): 'Basic.cancel_ok',
    (60, 40): 'Basic.publish',
    (60, 50): 'Basic.return',
    (60, 60): 'Basic.deliver',
    (60, 70): 'Basic.get',
    (60, 71): 'Basic.get_ok',
    (60, 72): 'Basic.get_empty',
    (60, 80): 'Basic.ack',
    (60, 90): 'Basic.reject',
    (60, 100): 'Basic.recover_async',
    (60, 110): 'Basic.recover',
    (60, 111): 'Basic.recover_ok',
    (60, 120): 'Basic.nack',
    (90, 10): 'Tx.select',
    (90, 11): 'Tx.select_ok',
    (90, 20): 'Tx.commit',
    (90, 21): 'Tx.commit_ok',
    (90, 30): 'Tx.rollback',
    (90, 31): 'Tx.rollback_ok',
    (85, 10): 'Confirm.select',
    (85, 11): 'Confirm.select_ok',
}


for _method_id, _method_name in list(METHOD_NAME_MAP.items()):
    METHOD_NAME_MAP[unpack('>I', pack('>HH', *_method_id))[0]] = _method_name
