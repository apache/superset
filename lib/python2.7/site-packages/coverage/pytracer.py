# Licensed under the Apache License: http://www.apache.org/licenses/LICENSE-2.0
# For details: https://bitbucket.org/ned/coveragepy/src/default/NOTICE.txt

"""Raw data collector for coverage.py."""

import atexit
import dis
import sys

from coverage import env

# We need the YIELD_VALUE opcode below, in a comparison-friendly form.
YIELD_VALUE = dis.opmap['YIELD_VALUE']
if env.PY2:
    YIELD_VALUE = chr(YIELD_VALUE)


class PyTracer(object):
    """Python implementation of the raw data tracer."""

    # Because of poor implementations of trace-function-manipulating tools,
    # the Python trace function must be kept very simple.  In particular, there
    # must be only one function ever set as the trace function, both through
    # sys.settrace, and as the return value from the trace function.  Put
    # another way, the trace function must always return itself.  It cannot
    # swap in other functions, or return None to avoid tracing a particular
    # frame.
    #
    # The trace manipulator that introduced this restriction is DecoratorTools,
    # which sets a trace function, and then later restores the pre-existing one
    # by calling sys.settrace with a function it found in the current frame.
    #
    # Systems that use DecoratorTools (or similar trace manipulations) must use
    # PyTracer to get accurate results.  The command-line --timid argument is
    # used to force the use of this tracer.

    def __init__(self):
        # Attributes set from the collector:
        self.data = None
        self.trace_arcs = False
        self.should_trace = None
        self.should_trace_cache = None
        self.warn = None
        # The threading module to use, if any.
        self.threading = None

        self.cur_file_dict = []
        self.last_line = 0          # int, but uninitialized.

        self.data_stack = []
        self.last_exc_back = None
        self.last_exc_firstlineno = 0
        self.thread = None
        self.stopped = False
        self._activity = False

        self.in_atexit = False
        # On exit, self.in_atexit = True
        atexit.register(setattr, self, 'in_atexit', True)

    def __repr__(self):
        return "<PyTracer at {0}: {1} lines in {2} files>".format(
            id(self),
            sum(len(v) for v in self.data.values()),
            len(self.data),
        )

    def _trace(self, frame, event, arg_unused):
        """The trace function passed to sys.settrace."""

        if self.stopped:
            return

        if self.last_exc_back:
            if frame == self.last_exc_back:
                # Someone forgot a return event.
                if self.trace_arcs and self.cur_file_dict:
                    pair = (self.last_line, -self.last_exc_firstlineno)
                    self.cur_file_dict[pair] = None
                self.cur_file_dict, self.last_line = self.data_stack.pop()
            self.last_exc_back = None

        if event == 'call':
            # Entering a new function context.  Decide if we should trace
            # in this file.
            self._activity = True
            self.data_stack.append((self.cur_file_dict, self.last_line))
            filename = frame.f_code.co_filename
            disp = self.should_trace_cache.get(filename)
            if disp is None:
                disp = self.should_trace(filename, frame)
                self.should_trace_cache[filename] = disp

            self.cur_file_dict = None
            if disp.trace:
                tracename = disp.source_filename
                if tracename not in self.data:
                    self.data[tracename] = {}
                self.cur_file_dict = self.data[tracename]
            # The call event is really a "start frame" event, and happens for
            # function calls and re-entering generators.  The f_lasti field is
            # -1 for calls, and a real offset for generators.  Use <0 as the
            # line number for calls, and the real line number for generators.
            if getattr(frame, 'f_lasti', -1) < 0:
                self.last_line = -frame.f_code.co_firstlineno
            else:
                self.last_line = frame.f_lineno
        elif event == 'line':
            # Record an executed line.
            if self.cur_file_dict is not None:
                lineno = frame.f_lineno
                if self.trace_arcs:
                    self.cur_file_dict[(self.last_line, lineno)] = None
                else:
                    self.cur_file_dict[lineno] = None
                self.last_line = lineno
        elif event == 'return':
            if self.trace_arcs and self.cur_file_dict:
                # Record an arc leaving the function, but beware that a
                # "return" event might just mean yielding from a generator.
                # Jython seems to have an empty co_code, so just assume return.
                code = frame.f_code.co_code
                if (not code) or code[frame.f_lasti] != YIELD_VALUE:
                    first = frame.f_code.co_firstlineno
                    self.cur_file_dict[(self.last_line, -first)] = None
            # Leaving this function, pop the filename stack.
            self.cur_file_dict, self.last_line = self.data_stack.pop()
        elif event == 'exception':
            self.last_exc_back = frame.f_back
            self.last_exc_firstlineno = frame.f_code.co_firstlineno
        return self._trace

    def start(self):
        """Start this Tracer.

        Return a Python function suitable for use with sys.settrace().

        """
        self.stopped = False
        if self.threading:
            if self.thread is None:
                self.thread = self.threading.currentThread()
            else:
                if self.thread.ident != self.threading.currentThread().ident:
                    # Re-starting from a different thread!? Don't set the trace
                    # function, but we are marked as running again, so maybe it
                    # will be ok?
                    return self._trace

        sys.settrace(self._trace)
        return self._trace

    def stop(self):
        """Stop this Tracer."""
        self.stopped = True
        if self.threading and self.thread.ident != self.threading.currentThread().ident:
            # Called on a different thread than started us: we can't unhook
            # ourselves, but we've set the flag that we should stop, so we
            # won't do any more tracing.
            return

        if self.warn:
            # PyPy clears the trace function before running atexit functions,
            # so don't warn if we are in atexit on PyPy and the trace function
            # has changed to None.
            tf = sys.gettrace()
            dont_warn = (env.PYPY and env.PYPYVERSION >= (5, 4) and self.in_atexit and tf is None)
            if (not dont_warn) and tf != self._trace:
                self.warn(
                    "Trace function changed, measurement is likely wrong: %r" % (tf,),
                    slug="trace-changed",
                )

        sys.settrace(None)

    def activity(self):
        """Has there been any activity?"""
        return self._activity

    def reset_activity(self):
        """Reset the activity() flag."""
        self._activity = False

    def get_stats(self):
        """Return a dictionary of statistics, or None."""
        return None
