"""
This plugin captures logging statements issued during test execution. When an
error or failure occurs, the captured log messages are attached to the running
test in the test.capturedLogging attribute, and displayed with the error failure
output. It is enabled by default but can be turned off with the option
``--nologcapture``.

You can filter captured logging statements with the ``--logging-filter`` option. 
If set, it specifies which logger(s) will be captured; loggers that do not match
will be passed. Example: specifying ``--logging-filter=sqlalchemy,myapp``
will ensure that only statements logged via sqlalchemy.engine, myapp
or myapp.foo.bar logger will be logged.

You can remove other installed logging handlers with the
``--logging-clear-handlers`` option.
"""

import logging
from logging import Handler
import threading

from nose.plugins.base import Plugin
from nose.util import anyp, ln, safe_str

try:
    from cStringIO import StringIO
except ImportError:
    from StringIO import StringIO

log = logging.getLogger(__name__)

class FilterSet(object):
    def __init__(self, filter_components):
        self.inclusive, self.exclusive = self._partition(filter_components)

    # @staticmethod
    def _partition(components):
        inclusive, exclusive = [], []
        for component in components:
            if component.startswith('-'):
                exclusive.append(component[1:])
            else:
                inclusive.append(component)
        return inclusive, exclusive
    _partition = staticmethod(_partition)

    def allow(self, record):
        """returns whether this record should be printed"""
        if not self:
            # nothing to filter
            return True
        return self._allow(record) and not self._deny(record)

    # @staticmethod
    def _any_match(matchers, record):
        """return the bool of whether `record` starts with
        any item in `matchers`"""
        def record_matches_key(key):
            return record == key or record.startswith(key + '.')
        return anyp(bool, map(record_matches_key, matchers))
    _any_match = staticmethod(_any_match)

    def _allow(self, record):
        if not self.inclusive:
            return True
        return self._any_match(self.inclusive, record)

    def _deny(self, record):
        if not self.exclusive:
            return False
        return self._any_match(self.exclusive, record)


class MyMemoryHandler(Handler):
    def __init__(self, logformat, logdatefmt, filters):
        Handler.__init__(self)
        fmt = logging.Formatter(logformat, logdatefmt)
        self.setFormatter(fmt)
        self.filterset = FilterSet(filters)
        self.buffer = []
    def emit(self, record):
        self.buffer.append(self.format(record))
    def flush(self):
        pass # do nothing
    def truncate(self):
        self.buffer = []
    def filter(self, record):
        if self.filterset.allow(record.name):
            return Handler.filter(self, record)
    def __getstate__(self):
        state = self.__dict__.copy()
        del state['lock']
        return state
    def __setstate__(self, state):
        self.__dict__.update(state)
        self.lock = threading.RLock()


class LogCapture(Plugin):
    """
    Log capture plugin. Enabled by default. Disable with --nologcapture.
    This plugin captures logging statements issued during test execution,
    appending any output captured to the error or failure output,
    should the test fail or raise an error.
    """
    enabled = True
    env_opt = 'NOSE_NOLOGCAPTURE'
    name = 'logcapture'
    score = 500
    logformat = '%(name)s: %(levelname)s: %(message)s'
    logdatefmt = None
    clear = False
    filters = ['-nose']

    def options(self, parser, env):
        """Register commandline options.
        """
        parser.add_option(
            "--nologcapture", action="store_false",
            default=not env.get(self.env_opt), dest="logcapture",
            help="Disable logging capture plugin. "
                 "Logging configuration will be left intact."
                 " [NOSE_NOLOGCAPTURE]")
        parser.add_option(
            "--logging-format", action="store", dest="logcapture_format",
            default=env.get('NOSE_LOGFORMAT') or self.logformat,
            metavar="FORMAT",
            help="Specify custom format to print statements. "
                 "Uses the same format as used by standard logging handlers."
                 " [NOSE_LOGFORMAT]")
        parser.add_option(
            "--logging-datefmt", action="store", dest="logcapture_datefmt",
            default=env.get('NOSE_LOGDATEFMT') or self.logdatefmt,
            metavar="FORMAT",
            help="Specify custom date/time format to print statements. "
                 "Uses the same format as used by standard logging handlers."
                 " [NOSE_LOGDATEFMT]")
        parser.add_option(
            "--logging-filter", action="store", dest="logcapture_filters",
            default=env.get('NOSE_LOGFILTER'),
            metavar="FILTER",
            help="Specify which statements to filter in/out. "
                 "By default, everything is captured. If the output is too"
                 " verbose,\nuse this option to filter out needless output.\n"
                 "Example: filter=foo will capture statements issued ONLY to\n"
                 " foo or foo.what.ever.sub but not foobar or other logger.\n"
                 "Specify multiple loggers with comma: filter=foo,bar,baz.\n"
                 "If any logger name is prefixed with a minus, eg filter=-foo,\n"
                 "it will be excluded rather than included. Default: "
                 "exclude logging messages from nose itself (-nose)."
                 " [NOSE_LOGFILTER]\n")
        parser.add_option(
            "--logging-clear-handlers", action="store_true",
            default=False, dest="logcapture_clear",
            help="Clear all other logging handlers")
        parser.add_option(
            "--logging-level", action="store",
            default='NOTSET', dest="logcapture_level",
            help="Set the log level to capture")

    def configure(self, options, conf):
        """Configure plugin.
        """
        self.conf = conf
        # Disable if explicitly disabled, or if logging is
        # configured via logging config file
        if not options.logcapture or conf.loggingConfig:
            self.enabled = False
        self.logformat = options.logcapture_format
        self.logdatefmt = options.logcapture_datefmt
        self.clear = options.logcapture_clear
        self.loglevel = options.logcapture_level
        if options.logcapture_filters:
            self.filters = options.logcapture_filters.split(',')

    def setupLoghandler(self):
        # setup our handler with root logger
        root_logger = logging.getLogger()
        if self.clear:
            if hasattr(root_logger, "handlers"):
                for handler in root_logger.handlers:
                    root_logger.removeHandler(handler)
            for logger in logging.Logger.manager.loggerDict.values():
                if hasattr(logger, "handlers"):
                    for handler in logger.handlers:
                        logger.removeHandler(handler)
        # make sure there isn't one already
        # you can't simply use "if self.handler not in root_logger.handlers"
        # since at least in unit tests this doesn't work --
        # LogCapture() is instantiated for each test case while root_logger
        # is module global
        # so we always add new MyMemoryHandler instance
        for handler in root_logger.handlers[:]:
            if isinstance(handler, MyMemoryHandler):
                root_logger.handlers.remove(handler)
        root_logger.addHandler(self.handler)
        # to make sure everything gets captured
        loglevel = getattr(self, "loglevel", "NOTSET")
        root_logger.setLevel(getattr(logging, loglevel))

    def begin(self):
        """Set up logging handler before test run begins.
        """
        self.start()

    def start(self):
        self.handler = MyMemoryHandler(self.logformat, self.logdatefmt,
                                       self.filters)
        self.setupLoghandler()

    def end(self):
        pass

    def beforeTest(self, test):
        """Clear buffers and handlers before test.
        """
        self.setupLoghandler()

    def afterTest(self, test):
        """Clear buffers after test.
        """
        self.handler.truncate()

    def formatFailure(self, test, err):
        """Add captured log messages to failure output.
        """
        return self.formatError(test, err)

    def formatError(self, test, err):
        """Add captured log messages to error output.
        """
        # logic flow copied from Capture.formatError
        test.capturedLogging = records = self.formatLogRecords()
        if not records:
            return err
        ec, ev, tb = err
        return (ec, self.addCaptureToErr(ev, records), tb)

    def formatLogRecords(self):
        return map(safe_str, self.handler.buffer)

    def addCaptureToErr(self, ev, records):
        return '\n'.join([safe_str(ev), ln('>> begin captured logging <<')] + \
                          records + \
                          [ln('>> end captured logging <<')])
