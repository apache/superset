#
# This file is part of pyasn1 software.
#
# Copyright (c) 2005-2017, Ilya Etingof <etingof@gmail.com>
# License: http://pyasn1.sf.net/license.html
#
import logging
from pyasn1.compat.octets import octs2ints
from pyasn1 import error
from pyasn1 import __version__

__all__ = ['Debug', 'setLogger', 'hexdump']

flagNone = 0x0000
flagEncoder = 0x0001
flagDecoder = 0x0002
flagAll = 0xffff

flagMap = {
    'encoder': flagEncoder,
    'decoder': flagDecoder,
    'all': flagAll
}


class Printer(object):
    # noinspection PyShadowingNames
    def __init__(self, logger=None, handler=None, formatter=None):
        if logger is None:
            logger = logging.getLogger('pyasn1')
        logger.setLevel(logging.DEBUG)
        if handler is None:
            handler = logging.StreamHandler()
        if formatter is None:
            formatter = logging.Formatter('%(asctime)s %(name)s: %(message)s')
        handler.setFormatter(formatter)
        handler.setLevel(logging.DEBUG)
        logger.addHandler(handler)
        self.__logger = logger

    def __call__(self, msg):
        self.__logger.debug(msg)

    def __str__(self):
        return '<python built-in logging>'


if hasattr(logging, 'NullHandler'):
    NullHandler = logging.NullHandler
else:
    # Python 2.6 and older
    class NullHandler(logging.Handler):
        def emit(self, record):
            pass


class Debug(object):
    defaultPrinter = None

    def __init__(self, *flags, **options):
        self._flags = flagNone
        if options.get('printer') is not None:
            self._printer = options.get('printer')
        elif self.defaultPrinter is not None:
            self._printer = self.defaultPrinter
        if 'loggerName' in options:
            # route our logs to parent logger
            self._printer = Printer(
                logger=logging.getLogger(options['loggerName']),
                handler=NullHandler()
            )
        else:
            self._printer = Printer()
        self('running pyasn1 version %s' % __version__)
        for f in flags:
            inverse = f and f[0] in ('!', '~')
            if inverse:
                f = f[1:]
            try:
                if inverse:
                    self._flags &= ~flagMap[f]
                else:
                    self._flags |= flagMap[f]
            except KeyError:
                raise error.PyAsn1Error('bad debug flag %s' % f)

            self('debug category \'%s\' %s' % (f, inverse and 'disabled' or 'enabled'))

    def __str__(self):
        return 'logger %s, flags %x' % (self._printer, self._flags)

    def __call__(self, msg):
        self._printer(msg)

    def __and__(self, flag):
        return self._flags & flag

    def __rand__(self, flag):
        return flag & self._flags


logger = 0


def setLogger(l):
    global logger
    logger = l


def hexdump(octets):
    return ' '.join(
        ['%s%.2X' % (n % 16 == 0 and ('\n%.5d: ' % n) or '', x)
         for n, x in zip(range(len(octets)), octs2ints(octets))]
    )


class Scope(object):
    def __init__(self):
        self._list = []

    def __str__(self): return '.'.join(self._list)

    def push(self, token):
        self._list.append(token)

    def pop(self):
        return self._list.pop()


scope = Scope()
