# -*- coding: utf-8 -*-
"""
    sphinx.util.logging
    ~~~~~~~~~~~~~~~~~~~

    Logging utility functions for Sphinx.

    :copyright: Copyright 2007-2017 by the Sphinx team, see AUTHORS.
    :license: BSD, see LICENSE for details.
"""
from __future__ import absolute_import

import logging
import logging.handlers
from contextlib import contextmanager
from collections import defaultdict

from six import PY2, StringIO
from docutils import nodes
from docutils.utils import get_source_line

from sphinx.errors import SphinxWarning
from sphinx.util.console import colorize

if False:
    # For type annotation
    from typing import Any, Dict, Generator, IO, List, Tuple, Union  # NOQA
    from docutils import nodes  # NOQA
    from sphinx.application import Sphinx  # NOQA


VERBOSE = 15

LEVEL_NAMES = defaultdict(lambda: logging.WARNING)  # type: Dict[str, int]
LEVEL_NAMES.update({
    'CRITICAL': logging.CRITICAL,
    'SEVERE': logging.CRITICAL,
    'ERROR': logging.ERROR,
    'WARNING': logging.WARNING,
    'INFO': logging.INFO,
    'VERBOSE': VERBOSE,
    'DEBUG': logging.DEBUG,
})

VERBOSITY_MAP = defaultdict(lambda: 0)  # type: Dict[int, int]
VERBOSITY_MAP.update({
    0: logging.INFO,
    1: VERBOSE,
    2: logging.DEBUG,
})

COLOR_MAP = defaultdict(lambda: 'blue')  # type: Dict[int, unicode]
COLOR_MAP.update({
    logging.WARNING: 'darkred',
    logging.DEBUG: 'darkgray',
})


def getLogger(name):
    # type: (str) -> SphinxLoggerAdapter
    """Get logger wrapped by SphinxLoggerAdapter."""
    return SphinxLoggerAdapter(logging.getLogger(name), {})


def convert_serializable(records):
    # type: (List[logging.LogRecord]) -> None
    """Convert LogRecord serializable."""
    for r in records:
        # extract arguments to a message and clear them
        r.msg = r.getMessage()
        r.args = ()


class SphinxWarningLogRecord(logging.LogRecord):
    """Log record class supporting location"""
    location = None  # type: Any

    def getMessage(self):
        # type: () -> str
        message = super(SphinxWarningLogRecord, self).getMessage()
        location = getattr(self, 'location', None)
        if location:
            message = '%s: WARNING: %s' % (location, message)
        elif 'WARNING:' not in message:
            message = 'WARNING: %s' % message

        return message


class SphinxLoggerAdapter(logging.LoggerAdapter):
    """LoggerAdapter allowing ``type`` and ``subtype`` keywords."""

    def log(self, level, msg, *args, **kwargs):  # type: ignore
        # type: (Union[int, str], unicode, Any, Any) -> None
        if isinstance(level, int):
            super(SphinxLoggerAdapter, self).log(level, msg, *args, **kwargs)
        else:
            levelno = LEVEL_NAMES[level]
            super(SphinxLoggerAdapter, self).log(levelno, msg, *args, **kwargs)

    def verbose(self, msg, *args, **kwargs):
        # type: (unicode, Any, Any) -> None
        self.log(VERBOSE, msg, *args, **kwargs)

    def process(self, msg, kwargs):  # type: ignore
        # type: (unicode, Dict) -> Tuple[unicode, Dict]
        extra = kwargs.setdefault('extra', {})
        if 'type' in kwargs:
            extra['type'] = kwargs.pop('type')
        if 'subtype' in kwargs:
            extra['subtype'] = kwargs.pop('subtype')
        if 'location' in kwargs:
            extra['location'] = kwargs.pop('location')
        if 'nonl' in kwargs:
            extra['nonl'] = kwargs.pop('nonl')
        if 'color' in kwargs:
            extra['color'] = kwargs.pop('color')

        return msg, kwargs

    def handle(self, record):
        # type: (logging.LogRecord) -> None
        self.logger.handle(record)  # type: ignore


class WarningStreamHandler(logging.StreamHandler):
    """StreamHandler for warnings."""
    pass


class NewLineStreamHandlerPY2(logging.StreamHandler):
    """StreamHandler which switches line terminator by record.nonl flag."""

    def emit(self, record):
        # type: (logging.LogRecord) -> None
        try:
            self.acquire()
            stream = self.stream  # type: ignore
            if getattr(record, 'nonl', False):
                # remove return code forcely when nonl=True
                self.stream = StringIO()
                super(NewLineStreamHandlerPY2, self).emit(record)
                stream.write(self.stream.getvalue()[:-1])
                stream.flush()
            else:
                super(NewLineStreamHandlerPY2, self).emit(record)
        finally:
            self.stream = stream
            self.release()


class NewLineStreamHandlerPY3(logging.StreamHandler):
    """StreamHandler which switches line terminator by record.nonl flag."""

    def emit(self, record):
        # type: (logging.LogRecord) -> None
        try:
            self.acquire()
            if getattr(record, 'nonl', False):
                # skip appending terminator when nonl=True
                self.terminator = ''
            super(NewLineStreamHandlerPY3, self).emit(record)
        finally:
            self.terminator = '\n'
            self.release()


if PY2:
    NewLineStreamHandler = NewLineStreamHandlerPY2
else:
    NewLineStreamHandler = NewLineStreamHandlerPY3


class MemoryHandler(logging.handlers.BufferingHandler):
    """Handler buffering all logs."""

    def __init__(self):
        # type: () -> None
        super(MemoryHandler, self).__init__(-1)

    def shouldFlush(self, record):
        # type: (logging.LogRecord) -> bool
        return False  # never flush

    def flushTo(self, logger):
        # type: (logging.Logger) -> None
        self.acquire()
        try:
            for record in self.buffer:
                logger.handle(record)
            self.buffer = []  # type: List[logging.LogRecord]
        finally:
            self.release()

    def clear(self):
        # type: () -> List[logging.LogRecord]
        buffer, self.buffer = self.buffer, []
        return buffer


@contextmanager
def pending_warnings():
    # type: () -> Generator
    """contextmanager to pend logging warnings temporary."""
    logger = logging.getLogger()
    memhandler = MemoryHandler()
    memhandler.setLevel(logging.WARNING)

    try:
        handlers = []
        for handler in logger.handlers[:]:
            if isinstance(handler, WarningStreamHandler):
                logger.removeHandler(handler)
                handlers.append(handler)

        logger.addHandler(memhandler)
        yield memhandler
    finally:
        logger.removeHandler(memhandler)

        for handler in handlers:
            logger.addHandler(handler)

        memhandler.flushTo(logger)


@contextmanager
def pending_logging():
    # type: () -> Generator
    """contextmanager to pend logging all logs temporary."""
    logger = logging.getLogger()
    memhandler = MemoryHandler()

    try:
        handlers = []
        for handler in logger.handlers[:]:
            logger.removeHandler(handler)
            handlers.append(handler)

        logger.addHandler(memhandler)
        yield memhandler
    finally:
        logger.removeHandler(memhandler)

        for handler in handlers:
            logger.addHandler(handler)

        memhandler.flushTo(logger)


class LogCollector(object):
    def __init__(self):
        # type: () -> None
        self.logs = []  # type: List[logging.LogRecord]

    @contextmanager
    def collect(self):
        # type: () -> Generator
        with pending_logging() as memhandler:
            yield

            self.logs = memhandler.clear()


class InfoFilter(logging.Filter):
    """Filter error and warning messages."""

    def filter(self, record):
        # type: (logging.LogRecord) -> bool
        if record.levelno < logging.WARNING:
            return True
        else:
            return False


def is_suppressed_warning(type, subtype, suppress_warnings):
    # type: (unicode, unicode, List[unicode]) -> bool
    """Check the warning is suppressed or not."""
    if type is None:
        return False

    for warning_type in suppress_warnings:
        if '.' in warning_type:
            target, subtarget = warning_type.split('.', 1)
        else:
            target, subtarget = warning_type, None

        if target == type:
            if (subtype is None or subtarget is None or
               subtarget == subtype or subtarget == '*'):
                return True

    return False


class WarningSuppressor(logging.Filter):
    """Filter logs by `suppress_warnings`."""

    def __init__(self, app):
        # type: (Sphinx) -> None
        self.app = app
        super(WarningSuppressor, self).__init__()

    def filter(self, record):
        # type: (logging.LogRecord) -> bool
        type = getattr(record, 'type', None)
        subtype = getattr(record, 'subtype', None)

        try:
            suppress_warnings = self.app.config.suppress_warnings
        except AttributeError:
            # config is not initialized yet (ex. in conf.py)
            suppress_warnings = []

        if is_suppressed_warning(type, subtype, suppress_warnings):
            return False
        else:
            self.app._warncount += 1
            return True


class WarningIsErrorFilter(logging.Filter):
    """Raise exception if warning emitted."""

    def __init__(self, app):
        # type: (Sphinx) -> None
        self.app = app
        super(WarningIsErrorFilter, self).__init__()

    def filter(self, record):
        # type: (logging.LogRecord) -> bool
        if self.app.warningiserror:
            location = getattr(record, 'location', '')
            if location:
                raise SphinxWarning(location + ":" + record.msg % record.args)
            else:
                raise SphinxWarning(record.msg % record.args)
        else:
            return True


class WarningLogRecordTranslator(logging.Filter):
    """Converts a log record to one Sphinx expects

    * Make a instance of SphinxWarningLogRecord
    * docname to path if location given
    """
    def __init__(self, app):
        # type: (Sphinx) -> None
        self.app = app
        super(WarningLogRecordTranslator, self).__init__()

    def filter(self, record):  # type: ignore
        # type: (SphinxWarningLogRecord) -> bool
        if isinstance(record, logging.LogRecord):
            record.__class__ = SphinxWarningLogRecord  # force subclassing to handle location

        location = getattr(record, 'location', None)
        if isinstance(location, tuple):
            docname, lineno = location
            if docname and lineno:
                record.location = '%s:%s' % (self.app.env.doc2path(docname), lineno)
            elif docname:
                record.location = '%s' % self.app.env.doc2path(docname)
            else:
                record.location = None
        elif isinstance(location, nodes.Node):
            (source, line) = get_source_line(location)
            if source and line:
                record.location = "%s:%s" % (source, line)
            elif source:
                record.location = "%s:" % source
            elif line:
                record.location = "<unknown>:%s" % line
            else:
                record.location = None
        elif location and ':' not in location:
            record.location = '%s' % self.app.env.doc2path(location)

        return True


class ColorizeFormatter(logging.Formatter):
    def format(self, record):
        # type: (logging.LogRecord) -> str
        message = super(ColorizeFormatter, self).format(record)
        color = getattr(record, 'color', None)
        if color is None:
            color = COLOR_MAP.get(record.levelno)

        if color:
            return colorize(color, message)  # type: ignore
        else:
            return message


class SafeEncodingWriter(object):
    """Stream writer which ignores UnicodeEncodeError silently"""
    def __init__(self, stream):
        # type: (IO) -> None
        self.stream = stream
        self.encoding = getattr(stream, 'encoding', 'ascii') or 'ascii'

    def write(self, data):
        # type: (unicode) -> None
        try:
            self.stream.write(data)
        except UnicodeEncodeError:
            # stream accept only str, not bytes.  So, we encode and replace
            # non-encodable characters, then decode them.
            self.stream.write(data.encode(self.encoding, 'replace').decode(self.encoding))

    def flush(self):
        # type: () -> None
        if hasattr(self.stream, 'flush'):
            self.stream.flush()


class LastMessagesWriter(object):
    """Stream writer which memories last 10 messages to save trackback"""
    def __init__(self, app, stream):
        # type: (Sphinx, IO) -> None
        self.app = app

    def write(self, data):
        # type: (unicode) -> None
        self.app.messagelog.append(data)


def setup(app, status, warning):
    # type: (Sphinx, IO, IO) -> None
    """Setup root logger for Sphinx"""
    logger = logging.getLogger()
    logger.setLevel(logging.NOTSET)

    # clear all handlers
    for handler in logger.handlers[:]:
        logger.removeHandler(handler)

    info_handler = NewLineStreamHandler(SafeEncodingWriter(status))  # type: ignore
    info_handler.addFilter(InfoFilter())
    info_handler.setLevel(VERBOSITY_MAP[app.verbosity])
    info_handler.setFormatter(ColorizeFormatter())

    warning_handler = WarningStreamHandler(SafeEncodingWriter(warning))  # type: ignore
    warning_handler.addFilter(WarningSuppressor(app))
    warning_handler.addFilter(WarningLogRecordTranslator(app))
    warning_handler.addFilter(WarningIsErrorFilter(app))
    warning_handler.setLevel(logging.WARNING)
    warning_handler.setFormatter(ColorizeFormatter())

    messagelog_handler = logging.StreamHandler(LastMessagesWriter(app, status))  # type: ignore
    messagelog_handler.addFilter(InfoFilter())
    messagelog_handler.setLevel(VERBOSITY_MAP[app.verbosity])
    messagelog_handler.setFormatter(ColorizeFormatter())

    logger.addHandler(info_handler)
    logger.addHandler(warning_handler)
    logger.addHandler(messagelog_handler)
