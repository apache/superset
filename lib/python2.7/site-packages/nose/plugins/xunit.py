"""This plugin provides test results in the standard XUnit XML format.

It's designed for the `Jenkins`_ (previously Hudson) continuous build
system, but will probably work for anything else that understands an
XUnit-formatted XML representation of test results.

Add this shell command to your builder ::

    nosetests --with-xunit

And by default a file named nosetests.xml will be written to the
working directory.

In a Jenkins builder, tick the box named "Publish JUnit test result report"
under the Post-build Actions and enter this value for Test report XMLs::

    **/nosetests.xml

If you need to change the name or location of the file, you can set the
``--xunit-file`` option.

If you need to change the name of the test suite, you can set the
``--xunit-testsuite-name`` option.

Here is an abbreviated version of what an XML test report might look like::

    <?xml version="1.0" encoding="UTF-8"?>
    <testsuite name="nosetests" tests="1" errors="1" failures="0" skip="0">
        <testcase classname="path_to_test_suite.TestSomething"
                  name="test_it" time="0">
            <error type="exceptions.TypeError" message="oops, wrong type">
            Traceback (most recent call last):
            ...
            TypeError: oops, wrong type
            </error>
        </testcase>
    </testsuite>

.. _Jenkins: http://jenkins-ci.org/

"""
import codecs
import doctest
import os
import sys
import traceback
import re
import inspect
from StringIO import StringIO
from time import time
from xml.sax import saxutils

from nose.plugins.base import Plugin
from nose.exc import SkipTest
from nose.pyversion import force_unicode, format_exception

# Invalid XML characters, control characters 0-31 sans \t, \n and \r
CONTROL_CHARACTERS = re.compile(r"[\000-\010\013\014\016-\037]")

TEST_ID = re.compile(r'^(.*?)(\(.*\))$')

def xml_safe(value):
    """Replaces invalid XML characters with '?'."""
    return CONTROL_CHARACTERS.sub('?', value)

def escape_cdata(cdata):
    """Escape a string for an XML CDATA section."""
    return xml_safe(cdata).replace(']]>', ']]>]]&gt;<![CDATA[')

def id_split(idval):
    m = TEST_ID.match(idval)
    if m:
        name, fargs = m.groups()
        head, tail = name.rsplit(".", 1)
        return [head, tail+fargs]
    else:
        return idval.rsplit(".", 1)

def nice_classname(obj):
    """Returns a nice name for class object or class instance.

        >>> nice_classname(Exception()) # doctest: +ELLIPSIS
        '...Exception'
        >>> nice_classname(Exception) # doctest: +ELLIPSIS
        '...Exception'

    """
    if inspect.isclass(obj):
        cls_name = obj.__name__
    else:
        cls_name = obj.__class__.__name__
    mod = inspect.getmodule(obj)
    if mod:
        name = mod.__name__
        # jython
        if name.startswith('org.python.core.'):
            name = name[len('org.python.core.'):]
        return "%s.%s" % (name, cls_name)
    else:
        return cls_name

def exc_message(exc_info):
    """Return the exception's message."""
    exc = exc_info[1]
    if exc is None:
        # str exception
        result = exc_info[0]
    else:
        try:
            result = str(exc)
        except UnicodeEncodeError:
            try:
                result = unicode(exc)
            except UnicodeError:
                # Fallback to args as neither str nor
                # unicode(Exception(u'\xe6')) work in Python < 2.6
                result = exc.args[0]
    result = force_unicode(result, 'UTF-8')
    return xml_safe(result)

class Tee(object):
    def __init__(self, encoding, *args):
        self._encoding = encoding
        self._streams = args

    def write(self, data):
        data = force_unicode(data, self._encoding)
        for s in self._streams:
            s.write(data)

    def writelines(self, lines):
        for line in lines:
            self.write(line)

    def flush(self):
        for s in self._streams:
            s.flush()

    def isatty(self):
        return False


class Xunit(Plugin):
    """This plugin provides test results in the standard XUnit XML format."""
    name = 'xunit'
    score = 1500
    encoding = 'UTF-8'
    error_report_file = None

    def __init__(self):
        super(Xunit, self).__init__()
        self._capture_stack = []
        self._currentStdout = None
        self._currentStderr = None

    def _timeTaken(self):
        if hasattr(self, '_timer'):
            taken = time() - self._timer
        else:
            # test died before it ran (probably error in setup())
            # or success/failure added before test started probably
            # due to custom TestResult munging
            taken = 0.0
        return taken

    def _quoteattr(self, attr):
        """Escape an XML attribute. Value can be unicode."""
        attr = xml_safe(attr)
        return saxutils.quoteattr(attr)

    def options(self, parser, env):
        """Sets additional command line options."""
        Plugin.options(self, parser, env)
        parser.add_option(
            '--xunit-file', action='store',
            dest='xunit_file', metavar="FILE",
            default=env.get('NOSE_XUNIT_FILE', 'nosetests.xml'),
            help=("Path to xml file to store the xunit report in. "
                  "Default is nosetests.xml in the working directory "
                  "[NOSE_XUNIT_FILE]"))

        parser.add_option(
            '--xunit-testsuite-name', action='store',
            dest='xunit_testsuite_name', metavar="PACKAGE",
            default=env.get('NOSE_XUNIT_TESTSUITE_NAME', 'nosetests'),
            help=("Name of the testsuite in the xunit xml, generated by plugin. "
                  "Default test suite name is nosetests."))

    def configure(self, options, config):
        """Configures the xunit plugin."""
        Plugin.configure(self, options, config)
        self.config = config
        if self.enabled:
            self.stats = {'errors': 0,
                          'failures': 0,
                          'passes': 0,
                          'skipped': 0
                          }
            self.errorlist = []
            self.error_report_file_name = os.path.realpath(options.xunit_file)
            self.xunit_testsuite_name = options.xunit_testsuite_name

    def report(self, stream):
        """Writes an Xunit-formatted XML file

        The file includes a report of test errors and failures.

        """
        self.error_report_file = codecs.open(self.error_report_file_name, 'w',
                                             self.encoding, 'replace')
        self.stats['encoding'] = self.encoding
        self.stats['testsuite_name'] = self.xunit_testsuite_name
        self.stats['total'] = (self.stats['errors'] + self.stats['failures']
                               + self.stats['passes'] + self.stats['skipped'])
        self.error_report_file.write(
            u'<?xml version="1.0" encoding="%(encoding)s"?>'
            u'<testsuite name="%(testsuite_name)s" tests="%(total)d" '
            u'errors="%(errors)d" failures="%(failures)d" '
            u'skip="%(skipped)d">' % self.stats)
        self.error_report_file.write(u''.join([force_unicode(e, self.encoding)
                                               for e in self.errorlist]))
        self.error_report_file.write(u'</testsuite>')
        self.error_report_file.close()
        if self.config.verbosity > 1:
            stream.writeln("-" * 70)
            stream.writeln("XML: %s" % self.error_report_file.name)

    def _startCapture(self):
        self._capture_stack.append((sys.stdout, sys.stderr))
        self._currentStdout = StringIO()
        self._currentStderr = StringIO()
        sys.stdout = Tee(self.encoding, self._currentStdout, sys.stdout)
        sys.stderr = Tee(self.encoding, self._currentStderr, sys.stderr)

    def startContext(self, context):
        self._startCapture()

    def stopContext(self, context):
        self._endCapture()

    def beforeTest(self, test):
        """Initializes a timer before starting a test."""
        self._timer = time()
        self._startCapture()

    def _endCapture(self):
        if self._capture_stack:
            sys.stdout, sys.stderr = self._capture_stack.pop()

    def afterTest(self, test):
        self._endCapture()
        self._currentStdout = None
        self._currentStderr = None

    def finalize(self, test):
        while self._capture_stack:
            self._endCapture()

    def _getCapturedStdout(self):
        if self._currentStdout:
            value = self._currentStdout.getvalue()
            if value:
                return '<system-out><![CDATA[%s]]></system-out>' % escape_cdata(
                        value)
        return ''

    def _getCapturedStderr(self):
        if self._currentStderr:
            value = self._currentStderr.getvalue()
            if value:
                return '<system-err><![CDATA[%s]]></system-err>' % escape_cdata(
                        value)
        return ''

    def addError(self, test, err, capt=None):
        """Add error output to Xunit report.
        """
        taken = self._timeTaken()

        if issubclass(err[0], SkipTest):
            type = 'skipped'
            self.stats['skipped'] += 1
        else:
            type = 'error'
            self.stats['errors'] += 1

        tb = format_exception(err, self.encoding)
        id = test.id()

        self.errorlist.append(
            u'<testcase classname=%(cls)s name=%(name)s time="%(taken).3f">'
            u'<%(type)s type=%(errtype)s message=%(message)s><![CDATA[%(tb)s]]>'
            u'</%(type)s>%(systemout)s%(systemerr)s</testcase>' %
            {'cls': self._quoteattr(id_split(id)[0]),
             'name': self._quoteattr(id_split(id)[-1]),
             'taken': taken,
             'type': type,
             'errtype': self._quoteattr(nice_classname(err[0])),
             'message': self._quoteattr(exc_message(err)),
             'tb': escape_cdata(tb),
             'systemout': self._getCapturedStdout(),
             'systemerr': self._getCapturedStderr(),
             })

    def addFailure(self, test, err, capt=None, tb_info=None):
        """Add failure output to Xunit report.
        """
        taken = self._timeTaken()
        tb = format_exception(err, self.encoding)
        self.stats['failures'] += 1
        id = test.id()

        self.errorlist.append(
            u'<testcase classname=%(cls)s name=%(name)s time="%(taken).3f">'
            u'<failure type=%(errtype)s message=%(message)s><![CDATA[%(tb)s]]>'
            u'</failure>%(systemout)s%(systemerr)s</testcase>' %
            {'cls': self._quoteattr(id_split(id)[0]),
             'name': self._quoteattr(id_split(id)[-1]),
             'taken': taken,
             'errtype': self._quoteattr(nice_classname(err[0])),
             'message': self._quoteattr(exc_message(err)),
             'tb': escape_cdata(tb),
             'systemout': self._getCapturedStdout(),
             'systemerr': self._getCapturedStderr(),
             })

    def addSuccess(self, test, capt=None):
        """Add success output to Xunit report.
        """
        taken = self._timeTaken()
        self.stats['passes'] += 1
        id = test.id()
        self.errorlist.append(
            '<testcase classname=%(cls)s name=%(name)s '
            'time="%(taken).3f">%(systemout)s%(systemerr)s</testcase>' %
            {'cls': self._quoteattr(id_split(id)[0]),
             'name': self._quoteattr(id_split(id)[-1]),
             'taken': taken,
             'systemout': self._getCapturedStdout(),
             'systemerr': self._getCapturedStderr(),
             })
