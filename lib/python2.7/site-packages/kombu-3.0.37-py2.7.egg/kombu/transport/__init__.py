"""
kombu.transport
===============

Built-in transports.

"""
from __future__ import absolute_import

from kombu.five import string_t
from kombu.syn import _detect_environment
from kombu.utils import symbol_by_name


def supports_librabbitmq():
    if _detect_environment() == 'default':
        try:
            import librabbitmq  # noqa
        except ImportError:  # pragma: no cover
            pass
        else:                # pragma: no cover
            return True


def _ghettoq(name, new, alias=None):
    xxx = new   # stupid enclosing

    def __inner():
        import warnings
        _new = callable(xxx) and xxx() or xxx
        gtransport = 'ghettoq.taproot.{0}'.format(name)
        ktransport = 'kombu.transport.{0}.Transport'.format(_new)
        this = alias or name
        warnings.warn("""
    Ghettoq does not work with Kombu, but there is now a built-in version
    of the {0} transport.

    You should replace {1!r} with: {2!r}
        """.format(name, gtransport, this))
        return ktransport

    return __inner


TRANSPORT_ALIASES = {
    'amqp': 'kombu.transport.pyamqp:Transport',
    'pyamqp': 'kombu.transport.pyamqp:Transport',
    'librabbitmq': 'kombu.transport.librabbitmq:Transport',
    'memory': 'kombu.transport.memory:Transport',
    'redis': 'kombu.transport.redis:Transport',
    'SQS': 'kombu.transport.SQS:Transport',
    'sqs': 'kombu.transport.SQS:Transport',
    'beanstalk': 'kombu.transport.beanstalk:Transport',
    'mongodb': 'kombu.transport.mongodb:Transport',
    'couchdb': 'kombu.transport.couchdb:Transport',
    'zookeeper': 'kombu.transport.zookeeper:Transport',
    'django': 'kombu.transport.django:Transport',
    'sqlalchemy': 'kombu.transport.sqlalchemy:Transport',
    'sqla': 'kombu.transport.sqlalchemy:Transport',
    'SLMQ': 'kombu.transport.SLMQ.Transport',
    'slmq': 'kombu.transport.SLMQ.Transport',
    'ghettoq.taproot.Redis': _ghettoq('Redis', 'redis', 'redis'),
    'ghettoq.taproot.Database': _ghettoq('Database', 'django', 'django'),
    'ghettoq.taproot.MongoDB': _ghettoq('MongoDB', 'mongodb'),
    'ghettoq.taproot.Beanstalk': _ghettoq('Beanstalk', 'beanstalk'),
    'ghettoq.taproot.CouchDB': _ghettoq('CouchDB', 'couchdb'),
    'filesystem': 'kombu.transport.filesystem:Transport',
    'zeromq': 'kombu.transport.zmq:Transport',
    'zmq': 'kombu.transport.zmq:Transport',
    'amqplib': 'kombu.transport.amqplib:Transport',
    'qpid': 'kombu.transport.qpid:Transport',
}

_transport_cache = {}


def resolve_transport(transport=None):
    if isinstance(transport, string_t):
        try:
            transport = TRANSPORT_ALIASES[transport]
        except KeyError:
            if '.' not in transport and ':' not in transport:
                from kombu.utils.text import fmatch_best
                alt = fmatch_best(transport, TRANSPORT_ALIASES)
                if alt:
                    raise KeyError(
                        'No such transport: {0}.  Did you mean {1}?'.format(
                            transport, alt))
                raise KeyError('No such transport: {0}'.format(transport))
        else:
            if callable(transport):
                transport = transport()
        return symbol_by_name(transport)
    return transport


def get_transport_cls(transport=None):
    """Get transport class by name.

    The transport string is the full path to a transport class, e.g.::

        "kombu.transport.pyamqp:Transport"

    If the name does not include `"."` (is not fully qualified),
    the alias table will be consulted.

    """
    if transport not in _transport_cache:
        _transport_cache[transport] = resolve_transport(transport)
    return _transport_cache[transport]
