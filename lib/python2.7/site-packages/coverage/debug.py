# Licensed under the Apache License: http://www.apache.org/licenses/LICENSE-2.0
# For details: https://bitbucket.org/ned/coveragepy/src/default/NOTICE.txt

"""Control of and utilities for debugging."""

import contextlib
import inspect
import os
import re
import sys
try:
    import _thread
except ImportError:
    import thread as _thread

from coverage.backward import StringIO
from coverage.misc import isolate_module

os = isolate_module(os)


# When debugging, it can be helpful to force some options, especially when
# debugging the configuration mechanisms you usually use to control debugging!
# This is a list of forced debugging options.
FORCED_DEBUG = []

# A hack for debugging testing in sub-processes.
_TEST_NAME_FILE = ""    # "/tmp/covtest.txt"


class DebugControl(object):
    """Control and output for debugging."""

    def __init__(self, options, output):
        """Configure the options and output file for debugging."""
        self.options = list(options) + FORCED_DEBUG
        self.raw_output = output
        self.suppress_callers = False

        filters = []
        if self.should('pid'):
            filters.append(add_pid_and_tid)
        self.output = DebugOutputFile(
            self.raw_output,
            show_process=self.should('process'),
            filters=filters,
        )

    def __repr__(self):
        return "<DebugControl options=%r raw_output=%r>" % (self.options, self.raw_output)

    def should(self, option):
        """Decide whether to output debug information in category `option`."""
        if option == "callers" and self.suppress_callers:
            return False
        return (option in self.options)

    @contextlib.contextmanager
    def without_callers(self):
        """A context manager to prevent call stacks from being logged."""
        old = self.suppress_callers
        self.suppress_callers = True
        try:
            yield
        finally:
            self.suppress_callers = old

    def write(self, msg):
        """Write a line of debug output.

        `msg` is the line to write. A newline will be appended.

        """
        self.output.write(msg+"\n")
        if self.should('callers'):
            dump_stack_frames(out=self.output, skip=1)
        self.output.flush()


class DebugControlString(DebugControl):
    """A `DebugControl` that writes to a StringIO, for testing."""
    def __init__(self, options):
        super(DebugControlString, self).__init__(options, StringIO())

    def get_output(self):
        """Get the output text from the `DebugControl`."""
        return self.raw_output.getvalue()


def info_header(label):
    """Make a nice header string."""
    return "--{0:-<60s}".format(" "+label+" ")


def info_formatter(info):
    """Produce a sequence of formatted lines from info.

    `info` is a sequence of pairs (label, data).  The produced lines are
    nicely formatted, ready to print.

    """
    info = list(info)
    if not info:
        return
    label_len = max(len(l) for l, _d in info)
    for label, data in info:
        if data == []:
            data = "-none-"
        if isinstance(data, (list, set, tuple)):
            prefix = "%*s:" % (label_len, label)
            for e in data:
                yield "%*s %s" % (label_len+1, prefix, e)
                prefix = ""
        else:
            yield "%*s: %s" % (label_len, label, data)


def write_formatted_info(writer, header, info):
    """Write a sequence of (label,data) pairs nicely."""
    writer.write(info_header(header))
    for line in info_formatter(info):
        writer.write(" %s" % line)


def short_stack(limit=None, skip=0):
    """Return a string summarizing the call stack.

    The string is multi-line, with one line per stack frame. Each line shows
    the function name, the file name, and the line number:

        ...
        start_import_stop : /Users/ned/coverage/trunk/tests/coveragetest.py @95
        import_local_file : /Users/ned/coverage/trunk/tests/coveragetest.py @81
        import_local_file : /Users/ned/coverage/trunk/coverage/backward.py @159
        ...

    `limit` is the number of frames to include, defaulting to all of them.

    `skip` is the number of frames to skip, so that debugging functions can
    call this and not be included in the result.

    """
    stack = inspect.stack()[limit:skip:-1]
    return "\n".join("%30s : %s @%d" % (t[3], t[1], t[2]) for t in stack)


def dump_stack_frames(limit=None, out=None, skip=0):
    """Print a summary of the stack to stdout, or someplace else."""
    out = out or sys.stdout
    out.write(short_stack(limit=limit, skip=skip+1))
    out.write("\n")


def short_id(id64):
    """Given a 64-bit id, make a shorter 16-bit one."""
    id16 = 0
    for offset in range(0, 64, 16):
        id16 ^= id64 >> offset
    return id16 & 0xFFFF


def add_pid_and_tid(text):
    """A filter to add pid and tid to debug messages."""
    # Thread ids are useful, but too long. Make a shorter one.
    tid = "{0:04x}".format(short_id(_thread.get_ident()))
    text = "{0:5d}.{1}: {2}".format(os.getpid(), tid, text)
    return text


def filter_text(text, filters):
    """Run `text` through a series of filters.

    `filters` is a list of functions. Each takes a string and returns a
    string.  Each is run in turn.

    Returns: the final string that results after all of the filters have
    run.

    """
    clean_text = text.rstrip()
    ending = text[len(clean_text):]
    text = clean_text
    for fn in filters:
        lines = []
        for line in text.splitlines():
            lines.extend(fn(line).splitlines())
        text = "\n".join(lines)
    return text + ending


class CwdTracker(object):                                   # pragma: debugging
    """A class to add cwd info to debug messages."""
    def __init__(self):
        self.cwd = None

    def filter(self, text):
        """Add a cwd message for each new cwd."""
        cwd = os.getcwd()
        if cwd != self.cwd:
            text = "cwd is now {0!r}\n".format(cwd) + text
            self.cwd = cwd
        return text


class DebugOutputFile(object):                              # pragma: debugging
    """A file-like object that includes pid and cwd information."""
    def __init__(self, outfile, show_process, filters):
        self.outfile = outfile
        self.show_process = show_process
        self.filters = list(filters)

        if self.show_process:
            self.filters.append(CwdTracker().filter)
            cmd = " ".join(getattr(sys, 'argv', ['???']))
            self.write("New process: executable: %s\n" % (sys.executable,))
            self.write("New process: cmd: %s\n" % (cmd,))
            if hasattr(os, 'getppid'):
                self.write("New process: parent pid: %s\n" % (os.getppid(),))

    SYS_MOD_NAME = '$coverage.debug.DebugOutputFile.the_one'

    @classmethod
    def the_one(cls, fileobj=None, show_process=True, filters=()):
        """Get the process-wide singleton DebugOutputFile.

        If it doesn't exist yet, then create it as a wrapper around the file
        object `fileobj`. `show_process` controls whether the debug file adds
        process-level information.

        """
        # Because of the way igor.py deletes and re-imports modules,
        # this class can be defined more than once. But we really want
        # a process-wide singleton. So stash it in sys.modules instead of
        # on a class attribute. Yes, this is aggressively gross.
        the_one = sys.modules.get(cls.SYS_MOD_NAME)
        if the_one is None:
            assert fileobj is not None
            sys.modules[cls.SYS_MOD_NAME] = the_one = cls(fileobj, show_process, filters)
        return the_one

    def write(self, text):
        """Just like file.write, but filter through all our filters."""
        self.outfile.write(filter_text(text, self.filters))
        self.outfile.flush()

    def flush(self):
        """Flush our file."""
        self.outfile.flush()


def log(msg, stack=False):                                  # pragma: debugging
    """Write a log message as forcefully as possible."""
    out = DebugOutputFile.the_one()
    out.write(msg+"\n")
    if stack:
        dump_stack_frames(out=out, skip=1)


def filter_aspectlib_frames(text):                          # pragma: debugging
    """Aspectlib prints stack traces, but includes its own frames.  Scrub those out."""
    # <<< aspectlib/__init__.py:257:function_wrapper < igor.py:143:run_tests < ...
    text = re.sub(r"(?<= )aspectlib/[^.]+\.py:\d+:\w+ < ", "", text)
    return text


def enable_aspectlib_maybe():                               # pragma: debugging
    """For debugging, we can use aspectlib to trace execution.

    Define COVERAGE_ASPECTLIB to enable and configure aspectlib to trace
    execution::

        $ export COVERAGE_LOG=covaspect.txt
        $ export COVERAGE_ASPECTLIB=coverage.Coverage:coverage.data.CoverageData
        $ coverage run blah.py ...

    This will trace all the public methods on Coverage and CoverageData,
    writing the information to covaspect.txt.

    """
    aspects = os.environ.get("COVERAGE_ASPECTLIB", "")
    if not aspects:
        return

    import aspectlib                            # pylint: disable=import-error
    import aspectlib.debug                      # pylint: disable=import-error

    filename = os.environ.get("COVERAGE_LOG", "/tmp/covlog.txt")
    filters = [add_pid_and_tid, filter_aspectlib_frames]
    aspects_file = DebugOutputFile.the_one(open(filename, "a"), show_process=True, filters=filters)
    aspect_log = aspectlib.debug.log(
        print_to=aspects_file, attributes=['id'], stacktrace=30, use_logging=False
    )
    public_methods = re.compile(r'^(__init__|[a-zA-Z].*)$')
    for aspect in aspects.split(':'):
        aspectlib.weave(aspect, aspect_log, methods=public_methods)
