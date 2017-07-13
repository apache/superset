# Licensed under the Apache License: http://www.apache.org/licenses/LICENSE-2.0
# For details: https://bitbucket.org/ned/coveragepy/src/default/NOTICE.txt

"""Raw data collector for coverage.py."""

import os
import sys

from coverage import env
from coverage.backward import iitems
from coverage.files import abs_file
from coverage.misc import CoverageException, isolate_module
from coverage.pytracer import PyTracer

os = isolate_module(os)


try:
    # Use the C extension code when we can, for speed.
    from coverage.tracer import CTracer, CFileDisposition
except ImportError:
    # Couldn't import the C extension, maybe it isn't built.
    if os.getenv('COVERAGE_TEST_TRACER') == 'c':
        # During testing, we use the COVERAGE_TEST_TRACER environment variable
        # to indicate that we've fiddled with the environment to test this
        # fallback code.  If we thought we had a C tracer, but couldn't import
        # it, then exit quickly and clearly instead of dribbling confusing
        # errors. I'm using sys.exit here instead of an exception because an
        # exception here causes all sorts of other noise in unittest.
        sys.stderr.write("*** COVERAGE_TEST_TRACER is 'c' but can't import CTracer!\n")
        sys.exit(1)
    CTracer = None


class FileDisposition(object):
    """A simple value type for recording what to do with a file."""
    pass


def should_start_context(frame):
    """Who-Tests-What hack: Determine whether this frame begins a new who-context."""
    fn_name = frame.f_code.co_name
    if fn_name.startswith("test"):
        return fn_name


class Collector(object):
    """Collects trace data.

    Creates a Tracer object for each thread, since they track stack
    information.  Each Tracer points to the same shared data, contributing
    traced data points.

    When the Collector is started, it creates a Tracer for the current thread,
    and installs a function to create Tracers for each new thread started.
    When the Collector is stopped, all active Tracers are stopped.

    Threads started while the Collector is stopped will never have Tracers
    associated with them.

    """

    # The stack of active Collectors.  Collectors are added here when started,
    # and popped when stopped.  Collectors on the stack are paused when not
    # the top, and resumed when they become the top again.
    _collectors = []

    # The concurrency settings we support here.
    SUPPORTED_CONCURRENCIES = set(["greenlet", "eventlet", "gevent", "thread"])

    def __init__(self, should_trace, check_include, timid, branch, warn, concurrency):
        """Create a collector.

        `should_trace` is a function, taking a file name, and returning a
        `coverage.FileDisposition object`.

        `check_include` is a function taking a file name and a frame. It returns
        a boolean: True if the file should be traced, False if not.

        If `timid` is true, then a slower simpler trace function will be
        used.  This is important for some environments where manipulation of
        tracing functions make the faster more sophisticated trace function not
        operate properly.

        If `branch` is true, then branches will be measured.  This involves
        collecting data on which statements followed each other (arcs).  Use
        `get_arc_data` to get the arc data.

        `warn` is a warning function, taking a single string message argument,
        to be used if a warning needs to be issued.

        `concurrency` is a list of strings indicating the concurrency libraries
        in use.  Valid values are "greenlet", "eventlet", "gevent", or "thread"
        (the default).  Of these four values, only one can be supplied.  Other
        values are ignored.

        """
        self.should_trace = should_trace
        self.check_include = check_include
        self.warn = warn
        self.branch = branch
        self.threading = None

        self.concur_id_func = None

        # We can handle a few concurrency options here, but only one at a time.
        these_concurrencies = self.SUPPORTED_CONCURRENCIES.intersection(concurrency)
        if len(these_concurrencies) > 1:
            raise CoverageException("Conflicting concurrency settings: %s" % concurrency)
        self.concurrency = these_concurrencies.pop() if these_concurrencies else ''

        try:
            if self.concurrency == "greenlet":
                import greenlet
                self.concur_id_func = greenlet.getcurrent
            elif self.concurrency == "eventlet":
                import eventlet.greenthread     # pylint: disable=import-error,useless-suppression
                self.concur_id_func = eventlet.greenthread.getcurrent
            elif self.concurrency == "gevent":
                import gevent                   # pylint: disable=import-error,useless-suppression
                self.concur_id_func = gevent.getcurrent
            elif self.concurrency == "thread" or not self.concurrency:
                # It's important to import threading only if we need it.  If
                # it's imported early, and the program being measured uses
                # gevent, then gevent's monkey-patching won't work properly.
                import threading
                self.threading = threading
            else:
                raise CoverageException("Don't understand concurrency=%s" % concurrency)
        except ImportError:
            raise CoverageException(
                "Couldn't trace with concurrency=%s, the module isn't installed." % (
                    self.concurrency,
                )
            )

        # Who-Tests-What is just a hack at the moment, so turn it on with an
        # environment variable.
        self.wtw = int(os.getenv('COVERAGE_WTW', 0))

        self.reset()

        if timid:
            # Being timid: use the simple Python trace function.
            self._trace_class = PyTracer
        else:
            # Being fast: use the C Tracer if it is available, else the Python
            # trace function.
            self._trace_class = CTracer or PyTracer

        if self._trace_class is CTracer:
            self.file_disposition_class = CFileDisposition
            self.supports_plugins = True
        else:
            self.file_disposition_class = FileDisposition
            self.supports_plugins = False

    def __repr__(self):
        return "<Collector at 0x%x: %s>" % (id(self), self.tracer_name())

    def tracer_name(self):
        """Return the class name of the tracer we're using."""
        return self._trace_class.__name__

    def _clear_data(self):
        """Clear out existing data, but stay ready for more collection."""
        self.data.clear()

        for tracer in self.tracers:
            tracer.reset_activity()

    def reset(self):
        """Clear collected data, and prepare to collect more."""
        # A dictionary mapping file names to dicts with line number keys (if not
        # branch coverage), or mapping file names to dicts with line number
        # pairs as keys (if branch coverage).
        self.data = {}

        # A dict mapping contexts to data dictionaries.
        self.contexts = {}
        self.contexts[None] = self.data

        # A dictionary mapping file names to file tracer plugin names that will
        # handle them.
        self.file_tracers = {}

        # The .should_trace_cache attribute is a cache from file names to
        # coverage.FileDisposition objects, or None.  When a file is first
        # considered for tracing, a FileDisposition is obtained from
        # Coverage.should_trace.  Its .trace attribute indicates whether the
        # file should be traced or not.  If it should be, a plugin with dynamic
        # file names can decide not to trace it based on the dynamic file name
        # being excluded by the inclusion rules, in which case the
        # FileDisposition will be replaced by None in the cache.
        if env.PYPY:
            import __pypy__                     # pylint: disable=import-error
            # Alex Gaynor said:
            # should_trace_cache is a strictly growing key: once a key is in
            # it, it never changes.  Further, the keys used to access it are
            # generally constant, given sufficient context. That is to say, at
            # any given point _trace() is called, pypy is able to know the key.
            # This is because the key is determined by the physical source code
            # line, and that's invariant with the call site.
            #
            # This property of a dict with immutable keys, combined with
            # call-site-constant keys is a match for PyPy's module dict,
            # which is optimized for such workloads.
            #
            # This gives a 20% benefit on the workload described at
            # https://bitbucket.org/pypy/pypy/issue/1871/10x-slower-than-cpython-under-coverage
            self.should_trace_cache = __pypy__.newdict("module")
        else:
            self.should_trace_cache = {}

        # Our active Tracers.
        self.tracers = []

        self._clear_data()

    def _start_tracer(self):
        """Start a new Tracer object, and store it in self.tracers."""
        tracer = self._trace_class()
        tracer.data = self.data
        tracer.trace_arcs = self.branch
        tracer.should_trace = self.should_trace
        tracer.should_trace_cache = self.should_trace_cache
        tracer.warn = self.warn

        if hasattr(tracer, 'concur_id_func'):
            tracer.concur_id_func = self.concur_id_func
        elif self.concur_id_func:
            raise CoverageException(
                "Can't support concurrency=%s with %s, only threads are supported" % (
                    self.concurrency, self.tracer_name(),
                )
            )

        if hasattr(tracer, 'file_tracers'):
            tracer.file_tracers = self.file_tracers
        if hasattr(tracer, 'threading'):
            tracer.threading = self.threading
        if hasattr(tracer, 'check_include'):
            tracer.check_include = self.check_include
        if self.wtw:
            if hasattr(tracer, 'should_start_context'):
                tracer.should_start_context = should_start_context
            if hasattr(tracer, 'switch_context'):
                tracer.switch_context = self.switch_context

        fn = tracer.start()
        self.tracers.append(tracer)

        return fn

    # The trace function has to be set individually on each thread before
    # execution begins.  Ironically, the only support the threading module has
    # for running code before the thread main is the tracing function.  So we
    # install this as a trace function, and the first time it's called, it does
    # the real trace installation.

    def _installation_trace(self, frame, event, arg):
        """Called on new threads, installs the real tracer."""
        # Remove ourselves as the trace function.
        sys.settrace(None)
        # Install the real tracer.
        fn = self._start_tracer()
        # Invoke the real trace function with the current event, to be sure
        # not to lose an event.
        if fn:
            fn = fn(frame, event, arg)
        # Return the new trace function to continue tracing in this scope.
        return fn

    def start(self):
        """Start collecting trace information."""
        if self._collectors:
            self._collectors[-1].pause()

        self.tracers = []

        # Check to see whether we had a fullcoverage tracer installed. If so,
        # get the stack frames it stashed away for us.
        traces0 = []
        fn0 = sys.gettrace()
        if fn0:
            tracer0 = getattr(fn0, '__self__', None)
            if tracer0:
                traces0 = getattr(tracer0, 'traces', [])

        try:
            # Install the tracer on this thread.
            fn = self._start_tracer()
        except:
            if self._collectors:
                self._collectors[-1].resume()
            raise

        # If _start_tracer succeeded, then we add ourselves to the global
        # stack of collectors.
        self._collectors.append(self)

        # Replay all the events from fullcoverage into the new trace function.
        for args in traces0:
            (frame, event, arg), lineno = args
            try:
                fn(frame, event, arg, lineno=lineno)
            except TypeError:
                raise Exception("fullcoverage must be run with the C trace function.")

        # Install our installation tracer in threading, to jump-start other
        # threads.
        if self.threading:
            self.threading.settrace(self._installation_trace)

    def stop(self):
        """Stop collecting trace information."""
        assert self._collectors
        assert self._collectors[-1] is self, (
            "Expected current collector to be %r, but it's %r" % (self, self._collectors[-1])
        )

        self.pause()

        # Remove this Collector from the stack, and resume the one underneath
        # (if any).
        self._collectors.pop()
        if self._collectors:
            self._collectors[-1].resume()

    def pause(self):
        """Pause tracing, but be prepared to `resume`."""
        for tracer in self.tracers:
            tracer.stop()
            stats = tracer.get_stats()
            if stats:
                print("\nCoverage.py tracer stats:")
                for k in sorted(stats.keys()):
                    print("%20s: %s" % (k, stats[k]))
        if self.threading:
            self.threading.settrace(None)

    def resume(self):
        """Resume tracing after a `pause`."""
        for tracer in self.tracers:
            tracer.start()
        if self.threading:
            self.threading.settrace(self._installation_trace)
        else:
            self._start_tracer()

    def _activity(self):
        """Has any activity been traced?

        Returns a boolean, True if any trace function was invoked.

        """
        return any(tracer.activity() for tracer in self.tracers)

    def switch_context(self, new_context):
        """Who-Tests-What hack: switch to a new who-context."""
        # Make a new data dict, or find the existing one, and switch all the
        # tracers to use it.
        data = self.contexts.setdefault(new_context, {})
        for tracer in self.tracers:
            tracer.data = data

    def save_data(self, covdata):
        """Save the collected data to a `CoverageData`.

        Returns True if there was data to save, False if not.
        """
        if not self._activity():
            return False

        def abs_file_dict(d):
            """Return a dict like d, but with keys modified by `abs_file`."""
            return dict((abs_file(k), v) for k, v in iitems(d))

        if self.branch:
            covdata.add_arcs(abs_file_dict(self.data))
        else:
            covdata.add_lines(abs_file_dict(self.data))
        covdata.add_file_tracers(abs_file_dict(self.file_tracers))

        if self.wtw:
            # Just a hack, so just hack it.
            import pprint
            out_file = "coverage_wtw_{:06}.py".format(os.getpid())
            with open(out_file, "w") as wtw_out:
                pprint.pprint(self.contexts, wtw_out)

        self._clear_data()
        return True
