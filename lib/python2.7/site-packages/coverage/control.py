# Licensed under the Apache License: http://www.apache.org/licenses/LICENSE-2.0
# For details: https://bitbucket.org/ned/coveragepy/src/default/NOTICE.txt

"""Core control stuff for coverage.py."""


import atexit
import inspect
import itertools
import os
import platform
import re
import sys
import traceback

from coverage import env
from coverage.annotate import AnnotateReporter
from coverage.backward import string_class, iitems
from coverage.collector import Collector
from coverage.config import read_coverage_config
from coverage.data import CoverageData, CoverageDataFiles
from coverage.debug import DebugControl, write_formatted_info
from coverage.files import TreeMatcher, FnmatchMatcher
from coverage.files import PathAliases, find_python_files, prep_patterns
from coverage.files import canonical_filename, set_relative_directory
from coverage.files import ModuleMatcher, abs_file
from coverage.html import HtmlReporter
from coverage.misc import CoverageException, bool_or_none, join_regex
from coverage.misc import file_be_gone, isolate_module
from coverage.plugin import FileReporter
from coverage.plugin_support import Plugins
from coverage.python import PythonFileReporter, source_for_file
from coverage.results import Analysis, Numbers
from coverage.summary import SummaryReporter
from coverage.xmlreport import XmlReporter

try:
    from coverage.multiproc import patch_multiprocessing
except ImportError:                                         # pragma: only jython
    # Jython has no multiprocessing module.
    patch_multiprocessing = None

os = isolate_module(os)

# Pypy has some unusual stuff in the "stdlib".  Consider those locations
# when deciding where the stdlib is.  These modules are not used for anything,
# they are modules importable from the pypy lib directories, so that we can
# find those directories.
_structseq = _pypy_irc_topic = None
if env.PYPY:
    try:
        import _structseq
    except ImportError:
        pass

    try:
        import _pypy_irc_topic
    except ImportError:
        pass


class Coverage(object):
    """Programmatic access to coverage.py.

    To use::

        from coverage import Coverage

        cov = Coverage()
        cov.start()
        #.. call your code ..
        cov.stop()
        cov.html_report(directory='covhtml')

    """
    def __init__(
        self, data_file=None, data_suffix=None, cover_pylib=None,
        auto_data=False, timid=None, branch=None, config_file=True,
        source=None, omit=None, include=None, debug=None,
        concurrency=None,
    ):
        """
        `data_file` is the base name of the data file to use, defaulting to
        ".coverage".  `data_suffix` is appended (with a dot) to `data_file` to
        create the final file name.  If `data_suffix` is simply True, then a
        suffix is created with the machine and process identity included.

        `cover_pylib` is a boolean determining whether Python code installed
        with the Python interpreter is measured.  This includes the Python
        standard library and any packages installed with the interpreter.

        If `auto_data` is true, then any existing data file will be read when
        coverage measurement starts, and data will be saved automatically when
        measurement stops.

        If `timid` is true, then a slower and simpler trace function will be
        used.  This is important for some environments where manipulation of
        tracing functions breaks the faster trace function.

        If `branch` is true, then branch coverage will be measured in addition
        to the usual statement coverage.

        `config_file` determines what configuration file to read:

            * If it is ".coveragerc", it is interpreted as if it were True,
              for backward compatibility.

            * If it is a string, it is the name of the file to read.  If the
              file can't be read, it is an error.

            * If it is True, then a few standard files names are tried
              (".coveragerc", "setup.cfg", "tox.ini").  It is not an error for
              these files to not be found.

            * If it is False, then no configuration file is read.

        `source` is a list of file paths or package names.  Only code located
        in the trees indicated by the file paths or package names will be
        measured.

        `include` and `omit` are lists of file name patterns. Files that match
        `include` will be measured, files that match `omit` will not.  Each
        will also accept a single string argument.

        `debug` is a list of strings indicating what debugging information is
        desired.

        `concurrency` is a string indicating the concurrency library being used
        in the measured code.  Without this, coverage.py will get incorrect
        results if these libraries are in use.  Valid strings are "greenlet",
        "eventlet", "gevent", "multiprocessing", or "thread" (the default).
        This can also be a list of these strings.

        .. versionadded:: 4.0
            The `concurrency` parameter.

        .. versionadded:: 4.2
            The `concurrency` parameter can now be a list of strings.

        """
        # Build our configuration from a number of sources.
        self.config_file, self.config = read_coverage_config(
            config_file=config_file,
            data_file=data_file, cover_pylib=cover_pylib, timid=timid,
            branch=branch, parallel=bool_or_none(data_suffix),
            source=source, omit=omit, include=include, debug=debug,
            concurrency=concurrency,
            )

        # This is injectable by tests.
        self._debug_file = None

        self._auto_load = self._auto_save = auto_data
        self._data_suffix = data_suffix

        # The matchers for _should_trace.
        self.source_match = None
        self.source_pkgs_match = None
        self.pylib_match = self.cover_match = None
        self.include_match = self.omit_match = None

        # Is it ok for no data to be collected?
        self._warn_no_data = True
        self._warn_unimported_source = True

        # A record of all the warnings that have been issued.
        self._warnings = []

        # Other instance attributes, set later.
        self.omit = self.include = self.source = None
        self.source_pkgs_unmatched = None
        self.source_pkgs = None
        self.data = self.data_files = self.collector = None
        self.plugins = None
        self.pylib_paths = self.cover_paths = None
        self.data_suffix = self.run_suffix = None
        self._exclude_re = None
        self.debug = None

        # State machine variables:
        # Have we initialized everything?
        self._inited = False
        # Have we started collecting and not stopped it?
        self._started = False

        # If we have sub-process measurement happening automatically, then we
        # want any explicit creation of a Coverage object to mean, this process
        # is already coverage-aware, so don't auto-measure it.  By now, the
        # auto-creation of a Coverage object has already happened.  But we can
        # find it and tell it not to save its data.
        if not env.METACOV:
            _prevent_sub_process_measurement()

    def _init(self):
        """Set all the initial state.

        This is called by the public methods to initialize state. This lets us
        construct a :class:`Coverage` object, then tweak its state before this
        function is called.

        """
        if self._inited:
            return

        self._inited = True

        # Create and configure the debugging controller. COVERAGE_DEBUG_FILE
        # is an environment variable, the name of a file to append debug logs
        # to.
        if self._debug_file is None:
            debug_file_name = os.environ.get("COVERAGE_DEBUG_FILE")
            if debug_file_name:
                self._debug_file = open(debug_file_name, "a")
            else:
                self._debug_file = sys.stderr
        self.debug = DebugControl(self.config.debug, self._debug_file)

        # Load plugins
        self.plugins = Plugins.load_plugins(self.config.plugins, self.config, self.debug)

        # _exclude_re is a dict that maps exclusion list names to compiled
        # regexes.
        self._exclude_re = {}
        self._exclude_regex_stale()

        set_relative_directory()

        # The source argument can be directories or package names.
        self.source = []
        self.source_pkgs = []
        for src in self.config.source or []:
            if os.path.isdir(src):
                self.source.append(canonical_filename(src))
            else:
                self.source_pkgs.append(src)
        self.source_pkgs_unmatched = self.source_pkgs[:]

        self.omit = prep_patterns(self.config.omit)
        self.include = prep_patterns(self.config.include)

        concurrency = self.config.concurrency or []
        if "multiprocessing" in concurrency:
            if not patch_multiprocessing:
                raise CoverageException(                    # pragma: only jython
                    "multiprocessing is not supported on this Python"
                )
            patch_multiprocessing(rcfile=self.config_file)
            # Multi-processing uses parallel for the subprocesses, so also use
            # it for the main process.
            self.config.parallel = True

        self.collector = Collector(
            should_trace=self._should_trace,
            check_include=self._check_include_omit_etc,
            timid=self.config.timid,
            branch=self.config.branch,
            warn=self._warn,
            concurrency=concurrency,
            )

        # Early warning if we aren't going to be able to support plugins.
        if self.plugins.file_tracers and not self.collector.supports_plugins:
            self._warn(
                "Plugin file tracers (%s) aren't supported with %s" % (
                    ", ".join(
                        plugin._coverage_plugin_name
                            for plugin in self.plugins.file_tracers
                        ),
                    self.collector.tracer_name(),
                    )
                )
            for plugin in self.plugins.file_tracers:
                plugin._coverage_enabled = False

        # Suffixes are a bit tricky.  We want to use the data suffix only when
        # collecting data, not when combining data.  So we save it as
        # `self.run_suffix` now, and promote it to `self.data_suffix` if we
        # find that we are collecting data later.
        if self._data_suffix or self.config.parallel:
            if not isinstance(self._data_suffix, string_class):
                # if data_suffix=True, use .machinename.pid.random
                self._data_suffix = True
        else:
            self._data_suffix = None
        self.data_suffix = None
        self.run_suffix = self._data_suffix

        # Create the data file.  We do this at construction time so that the
        # data file will be written into the directory where the process
        # started rather than wherever the process eventually chdir'd to.
        self.data = CoverageData(debug=self.debug)
        self.data_files = CoverageDataFiles(
            basename=self.config.data_file, warn=self._warn, debug=self.debug,
        )

        # The directories for files considered "installed with the interpreter".
        self.pylib_paths = set()
        if not self.config.cover_pylib:
            # Look at where some standard modules are located. That's the
            # indication for "installed with the interpreter". In some
            # environments (virtualenv, for example), these modules may be
            # spread across a few locations. Look at all the candidate modules
            # we've imported, and take all the different ones.
            for m in (atexit, inspect, os, platform, _pypy_irc_topic, re, _structseq, traceback):
                if m is not None and hasattr(m, "__file__"):
                    self.pylib_paths.add(self._canonical_path(m, directory=True))

            if _structseq and not hasattr(_structseq, '__file__'):
                # PyPy 2.4 has no __file__ in the builtin modules, but the code
                # objects still have the file names.  So dig into one to find
                # the path to exclude.
                structseq_new = _structseq.structseq_new
                try:
                    structseq_file = structseq_new.func_code.co_filename
                except AttributeError:
                    structseq_file = structseq_new.__code__.co_filename
                self.pylib_paths.add(self._canonical_path(structseq_file))

        # To avoid tracing the coverage.py code itself, we skip anything
        # located where we are.
        self.cover_paths = [self._canonical_path(__file__, directory=True)]
        if env.TESTING:
            # Don't include our own test code.
            self.cover_paths.append(os.path.join(self.cover_paths[0], "tests"))

            # When testing, we use PyContracts, which should be considered
            # part of coverage.py, and it uses six. Exclude those directories
            # just as we exclude ourselves.
            import contracts
            import six
            for mod in [contracts, six]:
                self.cover_paths.append(self._canonical_path(mod))

        # Set the reporting precision.
        Numbers.set_precision(self.config.precision)

        atexit.register(self._atexit)

        # Create the matchers we need for _should_trace
        if self.source or self.source_pkgs:
            self.source_match = TreeMatcher(self.source)
            self.source_pkgs_match = ModuleMatcher(self.source_pkgs)
        else:
            if self.cover_paths:
                self.cover_match = TreeMatcher(self.cover_paths)
            if self.pylib_paths:
                self.pylib_match = TreeMatcher(self.pylib_paths)
        if self.include:
            self.include_match = FnmatchMatcher(self.include)
        if self.omit:
            self.omit_match = FnmatchMatcher(self.omit)

        # The user may want to debug things, show info if desired.
        self._write_startup_debug()

    def _write_startup_debug(self):
        """Write out debug info at startup if needed."""
        wrote_any = False
        with self.debug.without_callers():
            if self.debug.should('config'):
                config_info = sorted(self.config.__dict__.items())
                write_formatted_info(self.debug, "config", config_info)
                wrote_any = True

            if self.debug.should('sys'):
                write_formatted_info(self.debug, "sys", self.sys_info())
                for plugin in self.plugins:
                    header = "sys: " + plugin._coverage_plugin_name
                    info = plugin.sys_info()
                    write_formatted_info(self.debug, header, info)
                wrote_any = True

        if wrote_any:
            write_formatted_info(self.debug, "end", ())

    def _canonical_path(self, morf, directory=False):
        """Return the canonical path of the module or file `morf`.

        If the module is a package, then return its directory. If it is a
        module, then return its file, unless `directory` is True, in which
        case return its enclosing directory.

        """
        morf_path = PythonFileReporter(morf, self).filename
        if morf_path.endswith("__init__.py") or directory:
            morf_path = os.path.split(morf_path)[0]
        return morf_path

    def _name_for_module(self, module_globals, filename):
        """Get the name of the module for a set of globals and file name.

        For configurability's sake, we allow __main__ modules to be matched by
        their importable name.

        If loaded via runpy (aka -m), we can usually recover the "original"
        full dotted module name, otherwise, we resort to interpreting the
        file name to get the module's name.  In the case that the module name
        can't be determined, None is returned.

        """
        if module_globals is None:          # pragma: only ironpython
            # IronPython doesn't provide globals: https://github.com/IronLanguages/main/issues/1296
            module_globals = {}

        dunder_name = module_globals.get('__name__', None)

        if isinstance(dunder_name, str) and dunder_name != '__main__':
            # This is the usual case: an imported module.
            return dunder_name

        loader = module_globals.get('__loader__', None)
        for attrname in ('fullname', 'name'):   # attribute renamed in py3.2
            if hasattr(loader, attrname):
                fullname = getattr(loader, attrname)
            else:
                continue

            if isinstance(fullname, str) and fullname != '__main__':
                # Module loaded via: runpy -m
                return fullname

        # Script as first argument to Python command line.
        inspectedname = inspect.getmodulename(filename)
        if inspectedname is not None:
            return inspectedname
        else:
            return dunder_name

    def _should_trace_internal(self, filename, frame):
        """Decide whether to trace execution in `filename`, with a reason.

        This function is called from the trace function.  As each new file name
        is encountered, this function determines whether it is traced or not.

        Returns a FileDisposition object.

        """
        original_filename = filename
        disp = _disposition_init(self.collector.file_disposition_class, filename)

        def nope(disp, reason):
            """Simple helper to make it easy to return NO."""
            disp.trace = False
            disp.reason = reason
            return disp

        # Compiled Python files have two file names: frame.f_code.co_filename is
        # the file name at the time the .pyc was compiled.  The second name is
        # __file__, which is where the .pyc was actually loaded from.  Since
        # .pyc files can be moved after compilation (for example, by being
        # installed), we look for __file__ in the frame and prefer it to the
        # co_filename value.
        dunder_file = frame.f_globals and frame.f_globals.get('__file__')
        if dunder_file:
            filename = source_for_file(dunder_file)
            if original_filename and not original_filename.startswith('<'):
                orig = os.path.basename(original_filename)
                if orig != os.path.basename(filename):
                    # Files shouldn't be renamed when moved. This happens when
                    # exec'ing code.  If it seems like something is wrong with
                    # the frame's file name, then just use the original.
                    filename = original_filename

        if not filename:
            # Empty string is pretty useless.
            return nope(disp, "empty string isn't a file name")

        if filename.startswith('memory:'):
            return nope(disp, "memory isn't traceable")

        if filename.startswith('<'):
            # Lots of non-file execution is represented with artificial
            # file names like "<string>", "<doctest readme.txt[0]>", or
            # "<exec_function>".  Don't ever trace these executions, since we
            # can't do anything with the data later anyway.
            return nope(disp, "not a real file name")

        # pyexpat does a dumb thing, calling the trace function explicitly from
        # C code with a C file name.
        if re.search(r"[/\\]Modules[/\\]pyexpat.c", filename):
            return nope(disp, "pyexpat lies about itself")

        # Jython reports the .class file to the tracer, use the source file.
        if filename.endswith("$py.class"):
            filename = filename[:-9] + ".py"

        canonical = canonical_filename(filename)
        disp.canonical_filename = canonical

        # Try the plugins, see if they have an opinion about the file.
        plugin = None
        for plugin in self.plugins.file_tracers:
            if not plugin._coverage_enabled:
                continue

            try:
                file_tracer = plugin.file_tracer(canonical)
                if file_tracer is not None:
                    file_tracer._coverage_plugin = plugin
                    disp.trace = True
                    disp.file_tracer = file_tracer
                    if file_tracer.has_dynamic_source_filename():
                        disp.has_dynamic_filename = True
                    else:
                        disp.source_filename = canonical_filename(
                            file_tracer.source_filename()
                        )
                    break
            except Exception:
                self._warn(
                    "Disabling plugin %r due to an exception:" % (
                        plugin._coverage_plugin_name
                    )
                )
                traceback.print_exc()
                plugin._coverage_enabled = False
                continue
        else:
            # No plugin wanted it: it's Python.
            disp.trace = True
            disp.source_filename = canonical

        if not disp.has_dynamic_filename:
            if not disp.source_filename:
                raise CoverageException(
                    "Plugin %r didn't set source_filename for %r" %
                    (plugin, disp.original_filename)
                )
            reason = self._check_include_omit_etc_internal(
                disp.source_filename, frame,
            )
            if reason:
                nope(disp, reason)

        return disp

    def _check_include_omit_etc_internal(self, filename, frame):
        """Check a file name against the include, omit, etc, rules.

        Returns a string or None.  String means, don't trace, and is the reason
        why.  None means no reason found to not trace.

        """
        modulename = self._name_for_module(frame.f_globals, filename)

        # If the user specified source or include, then that's authoritative
        # about the outer bound of what to measure and we don't have to apply
        # any canned exclusions. If they didn't, then we have to exclude the
        # stdlib and coverage.py directories.
        if self.source_match:
            if self.source_pkgs_match.match(modulename):
                if modulename in self.source_pkgs_unmatched:
                    self.source_pkgs_unmatched.remove(modulename)
                return None  # There's no reason to skip this file.

            if not self.source_match.match(filename):
                return "falls outside the --source trees"
        elif self.include_match:
            if not self.include_match.match(filename):
                return "falls outside the --include trees"
        else:
            # If we aren't supposed to trace installed code, then check if this
            # is near the Python standard library and skip it if so.
            if self.pylib_match and self.pylib_match.match(filename):
                return "is in the stdlib"

            # We exclude the coverage.py code itself, since a little of it
            # will be measured otherwise.
            if self.cover_match and self.cover_match.match(filename):
                return "is part of coverage.py"

        # Check the file against the omit pattern.
        if self.omit_match and self.omit_match.match(filename):
            return "is inside an --omit pattern"

        # No reason found to skip this file.
        return None

    def _should_trace(self, filename, frame):
        """Decide whether to trace execution in `filename`.

        Calls `_should_trace_internal`, and returns the FileDisposition.

        """
        disp = self._should_trace_internal(filename, frame)
        if self.debug.should('trace'):
            self.debug.write(_disposition_debug_msg(disp))
        return disp

    def _check_include_omit_etc(self, filename, frame):
        """Check a file name against the include/omit/etc, rules, verbosely.

        Returns a boolean: True if the file should be traced, False if not.

        """
        reason = self._check_include_omit_etc_internal(filename, frame)
        if self.debug.should('trace'):
            if not reason:
                msg = "Including %r" % (filename,)
            else:
                msg = "Not including %r: %s" % (filename, reason)
            self.debug.write(msg)

        return not reason

    def _warn(self, msg, slug=None):
        """Use `msg` as a warning.

        For warning suppression, use `slug` as the shorthand.
        """
        if slug in self.config.disable_warnings:
            # Don't issue the warning
            return

        self._warnings.append(msg)
        if slug:
            msg = "%s (%s)" % (msg, slug)
        if self.debug.should('pid'):
            msg = "[%d] %s" % (os.getpid(), msg)
        sys.stderr.write("Coverage.py warning: %s\n" % msg)

    def get_option(self, option_name):
        """Get an option from the configuration.

        `option_name` is a colon-separated string indicating the section and
        option name.  For example, the ``branch`` option in the ``[run]``
        section of the config file would be indicated with `"run:branch"`.

        Returns the value of the option.

        .. versionadded:: 4.0

        """
        return self.config.get_option(option_name)

    def set_option(self, option_name, value):
        """Set an option in the configuration.

        `option_name` is a colon-separated string indicating the section and
        option name.  For example, the ``branch`` option in the ``[run]``
        section of the config file would be indicated with ``"run:branch"``.

        `value` is the new value for the option.  This should be a Python
        value where appropriate.  For example, use True for booleans, not the
        string ``"True"``.

        As an example, calling::

            cov.set_option("run:branch", True)

        has the same effect as this configuration file::

            [run]
            branch = True

        .. versionadded:: 4.0

        """
        self.config.set_option(option_name, value)

    def use_cache(self, usecache):
        """Obsolete method."""
        self._init()
        if not usecache:
            self._warn("use_cache(False) is no longer supported.")

    def load(self):
        """Load previously-collected coverage data from the data file."""
        self._init()
        self.collector.reset()
        self.data_files.read(self.data)

    def start(self):
        """Start measuring code coverage.

        Coverage measurement only occurs in functions called after
        :meth:`start` is invoked.  Statements in the same scope as
        :meth:`start` won't be measured.

        Once you invoke :meth:`start`, you must also call :meth:`stop`
        eventually, or your process might not shut down cleanly.

        """
        self._init()
        if self.run_suffix:
            # Calling start() means we're running code, so use the run_suffix
            # as the data_suffix when we eventually save the data.
            self.data_suffix = self.run_suffix
        if self._auto_load:
            self.load()

        self.collector.start()
        self._started = True

    def stop(self):
        """Stop measuring code coverage."""
        if self._started:
            self.collector.stop()
        self._started = False

    def _atexit(self):
        """Clean up on process shutdown."""
        if self.debug.should("process"):
            self.debug.write("atexit: {0!r}".format(self))
        if self._started:
            self.stop()
        if self._auto_save:
            self.save()

    def erase(self):
        """Erase previously-collected coverage data.

        This removes the in-memory data collected in this session as well as
        discarding the data file.

        """
        self._init()
        self.collector.reset()
        self.data.erase()
        self.data_files.erase(parallel=self.config.parallel)

    def clear_exclude(self, which='exclude'):
        """Clear the exclude list."""
        self._init()
        setattr(self.config, which + "_list", [])
        self._exclude_regex_stale()

    def exclude(self, regex, which='exclude'):
        """Exclude source lines from execution consideration.

        A number of lists of regular expressions are maintained.  Each list
        selects lines that are treated differently during reporting.

        `which` determines which list is modified.  The "exclude" list selects
        lines that are not considered executable at all.  The "partial" list
        indicates lines with branches that are not taken.

        `regex` is a regular expression.  The regex is added to the specified
        list.  If any of the regexes in the list is found in a line, the line
        is marked for special treatment during reporting.

        """
        self._init()
        excl_list = getattr(self.config, which + "_list")
        excl_list.append(regex)
        self._exclude_regex_stale()

    def _exclude_regex_stale(self):
        """Drop all the compiled exclusion regexes, a list was modified."""
        self._exclude_re.clear()

    def _exclude_regex(self, which):
        """Return a compiled regex for the given exclusion list."""
        if which not in self._exclude_re:
            excl_list = getattr(self.config, which + "_list")
            self._exclude_re[which] = join_regex(excl_list)
        return self._exclude_re[which]

    def get_exclude_list(self, which='exclude'):
        """Return a list of excluded regex patterns.

        `which` indicates which list is desired.  See :meth:`exclude` for the
        lists that are available, and their meaning.

        """
        self._init()
        return getattr(self.config, which + "_list")

    def save(self):
        """Save the collected coverage data to the data file."""
        self._init()
        self.get_data()
        self.data_files.write(self.data, suffix=self.data_suffix)

    def combine(self, data_paths=None, strict=False):
        """Combine together a number of similarly-named coverage data files.

        All coverage data files whose name starts with `data_file` (from the
        coverage() constructor) will be read, and combined together into the
        current measurements.

        `data_paths` is a list of files or directories from which data should
        be combined. If no list is passed, then the data files from the
        directory indicated by the current data file (probably the current
        directory) will be combined.

        If `strict` is true, then it is an error to attempt to combine when
        there are no data files to combine.

        .. versionadded:: 4.0
            The `data_paths` parameter.

        .. versionadded:: 4.3
            The `strict` parameter.

        """
        self._init()
        self.get_data()

        aliases = None
        if self.config.paths:
            aliases = PathAliases()
            for paths in self.config.paths.values():
                result = paths[0]
                for pattern in paths[1:]:
                    aliases.add(pattern, result)

        self.data_files.combine_parallel_data(
            self.data, aliases=aliases, data_paths=data_paths, strict=strict,
        )

    def get_data(self):
        """Get the collected data.

        Also warn about various problems collecting data.

        Returns a :class:`coverage.CoverageData`, the collected coverage data.

        .. versionadded:: 4.0

        """
        self._init()

        if self.collector.save_data(self.data):
            self._post_save_work()

        return self.data

    def _post_save_work(self):
        """After saving data, look for warnings, post-work, etc.

        Warn about things that should have happened but didn't.
        Look for unexecuted files.

        """
        # If there are still entries in the source_pkgs_unmatched list,
        # then we never encountered those packages.
        if self._warn_unimported_source:
            for pkg in self.source_pkgs_unmatched:
                self._warn_about_unmeasured_code(pkg)

        # Find out if we got any data.
        if not self.data and self._warn_no_data:
            self._warn("No data was collected.", slug="no-data-collected")

        # Find files that were never executed at all.
        for pkg in self.source_pkgs:
            if (not pkg in sys.modules or
                not hasattr(sys.modules[pkg], '__file__') or
                not os.path.exists(sys.modules[pkg].__file__)):
                continue
            pkg_file = source_for_file(sys.modules[pkg].__file__)
            self._find_unexecuted_files(self._canonical_path(pkg_file))

        for src in self.source:
            self._find_unexecuted_files(src)

        if self.config.note:
            self.data.add_run_info(note=self.config.note)

    def _warn_about_unmeasured_code(self, pkg):
        """Warn about a package or module that we never traced.

        `pkg` is a string, the name of the package or module.

        """
        mod = sys.modules.get(pkg)
        if mod is None:
            self._warn("Module %s was never imported." % pkg, slug="module-not-imported")
            return

        is_namespace = hasattr(mod, '__path__') and not hasattr(mod, '__file__')
        has_file = hasattr(mod, '__file__') and os.path.exists(mod.__file__)

        if is_namespace:
            # A namespace package. It's OK for this not to have been traced,
            # since there is no code directly in it.
            return

        if not has_file:
            self._warn("Module %s has no Python source." % pkg, slug="module-not-python")
            return

        # The module was in sys.modules, and seems like a module with code, but
        # we never measured it. I guess that means it was imported before
        # coverage even started.
        self._warn(
            "Module %s was previously imported, but not measured." % pkg,
            slug="module-not-measured",
        )

    def _find_plugin_files(self, src_dir):
        """Get executable files from the plugins."""
        for plugin in self.plugins:
            for x_file in plugin.find_executable_files(src_dir):
                yield x_file, plugin._coverage_plugin_name

    def _find_unexecuted_files(self, src_dir):
        """Find unexecuted files in `src_dir`.

        Search for files in `src_dir` that are probably importable,
        and add them as unexecuted files in `self.data`.

        """
        py_files = ((py_file, None) for py_file in find_python_files(src_dir))
        plugin_files = self._find_plugin_files(src_dir)

        for file_path, plugin_name in itertools.chain(py_files, plugin_files):
            file_path = canonical_filename(file_path)
            if self.omit_match and self.omit_match.match(file_path):
                # Turns out this file was omitted, so don't pull it back
                # in as unexecuted.
                continue
            self.data.touch_file(file_path, plugin_name)

    # Backward compatibility with version 1.
    def analysis(self, morf):
        """Like `analysis2` but doesn't return excluded line numbers."""
        f, s, _, m, mf = self.analysis2(morf)
        return f, s, m, mf

    def analysis2(self, morf):
        """Analyze a module.

        `morf` is a module or a file name.  It will be analyzed to determine
        its coverage statistics.  The return value is a 5-tuple:

        * The file name for the module.
        * A list of line numbers of executable statements.
        * A list of line numbers of excluded statements.
        * A list of line numbers of statements not run (missing from
          execution).
        * A readable formatted string of the missing line numbers.

        The analysis uses the source file itself and the current measured
        coverage data.

        """
        self._init()
        analysis = self._analyze(morf)
        return (
            analysis.filename,
            sorted(analysis.statements),
            sorted(analysis.excluded),
            sorted(analysis.missing),
            analysis.missing_formatted(),
            )

    def _analyze(self, it):
        """Analyze a single morf or code unit.

        Returns an `Analysis` object.

        """
        self.get_data()
        if not isinstance(it, FileReporter):
            it = self._get_file_reporter(it)

        return Analysis(self.data, it)

    def _get_file_reporter(self, morf):
        """Get a FileReporter for a module or file name."""
        plugin = None
        file_reporter = "python"

        if isinstance(morf, string_class):
            abs_morf = abs_file(morf)
            plugin_name = self.data.file_tracer(abs_morf)
            if plugin_name:
                plugin = self.plugins.get(plugin_name)

        if plugin:
            file_reporter = plugin.file_reporter(abs_morf)
            if file_reporter is None:
                raise CoverageException(
                    "Plugin %r did not provide a file reporter for %r." % (
                        plugin._coverage_plugin_name, morf
                    )
                )

        if file_reporter == "python":
            file_reporter = PythonFileReporter(morf, self)

        return file_reporter

    def _get_file_reporters(self, morfs=None):
        """Get a list of FileReporters for a list of modules or file names.

        For each module or file name in `morfs`, find a FileReporter.  Return
        the list of FileReporters.

        If `morfs` is a single module or file name, this returns a list of one
        FileReporter.  If `morfs` is empty or None, then the list of all files
        measured is used to find the FileReporters.

        """
        if not morfs:
            morfs = self.data.measured_files()

        # Be sure we have a list.
        if not isinstance(morfs, (list, tuple)):
            morfs = [morfs]

        file_reporters = []
        for morf in morfs:
            file_reporter = self._get_file_reporter(morf)
            file_reporters.append(file_reporter)

        return file_reporters

    def report(
        self, morfs=None, show_missing=None, ignore_errors=None,
        file=None,                  # pylint: disable=redefined-builtin
        omit=None, include=None, skip_covered=None,
    ):
        """Write a summary report to `file`.

        Each module in `morfs` is listed, with counts of statements, executed
        statements, missing statements, and a list of lines missed.

        `include` is a list of file name patterns.  Files that match will be
        included in the report. Files matching `omit` will not be included in
        the report.

        If `skip_covered` is True, don't report on files with 100% coverage.

        Returns a float, the total percentage covered.

        """
        self.get_data()
        self.config.from_args(
            ignore_errors=ignore_errors, omit=omit, include=include,
            show_missing=show_missing, skip_covered=skip_covered,
            )
        reporter = SummaryReporter(self, self.config)
        return reporter.report(morfs, outfile=file)

    def annotate(
        self, morfs=None, directory=None, ignore_errors=None,
        omit=None, include=None,
    ):
        """Annotate a list of modules.

        Each module in `morfs` is annotated.  The source is written to a new
        file, named with a ",cover" suffix, with each line prefixed with a
        marker to indicate the coverage of the line.  Covered lines have ">",
        excluded lines have "-", and missing lines have "!".

        See :meth:`report` for other arguments.

        """
        self.get_data()
        self.config.from_args(
            ignore_errors=ignore_errors, omit=omit, include=include
            )
        reporter = AnnotateReporter(self, self.config)
        reporter.report(morfs, directory=directory)

    def html_report(self, morfs=None, directory=None, ignore_errors=None,
                    omit=None, include=None, extra_css=None, title=None,
                    skip_covered=None):
        """Generate an HTML report.

        The HTML is written to `directory`.  The file "index.html" is the
        overview starting point, with links to more detailed pages for
        individual modules.

        `extra_css` is a path to a file of other CSS to apply on the page.
        It will be copied into the HTML directory.

        `title` is a text string (not HTML) to use as the title of the HTML
        report.

        See :meth:`report` for other arguments.

        Returns a float, the total percentage covered.

        """
        self.get_data()
        self.config.from_args(
            ignore_errors=ignore_errors, omit=omit, include=include,
            html_dir=directory, extra_css=extra_css, html_title=title,
            skip_covered=skip_covered,
            )
        reporter = HtmlReporter(self, self.config)
        return reporter.report(morfs)

    def xml_report(
        self, morfs=None, outfile=None, ignore_errors=None,
        omit=None, include=None,
    ):
        """Generate an XML report of coverage results.

        The report is compatible with Cobertura reports.

        Each module in `morfs` is included in the report.  `outfile` is the
        path to write the file to, "-" will write to stdout.

        See :meth:`report` for other arguments.

        Returns a float, the total percentage covered.

        """
        self.get_data()
        self.config.from_args(
            ignore_errors=ignore_errors, omit=omit, include=include,
            xml_output=outfile,
            )
        file_to_close = None
        delete_file = False
        if self.config.xml_output:
            if self.config.xml_output == '-':
                outfile = sys.stdout
            else:
                # Ensure that the output directory is created; done here
                # because this report pre-opens the output file.
                # HTMLReport does this using the Report plumbing because
                # its task is more complex, being multiple files.
                output_dir = os.path.dirname(self.config.xml_output)
                if output_dir and not os.path.isdir(output_dir):
                    os.makedirs(output_dir)
                open_kwargs = {}
                if env.PY3:
                    open_kwargs['encoding'] = 'utf8'
                outfile = open(self.config.xml_output, "w", **open_kwargs)
                file_to_close = outfile
        try:
            reporter = XmlReporter(self, self.config)
            return reporter.report(morfs, outfile=outfile)
        except CoverageException:
            delete_file = True
            raise
        finally:
            if file_to_close:
                file_to_close.close()
                if delete_file:
                    file_be_gone(self.config.xml_output)

    def sys_info(self):
        """Return a list of (key, value) pairs showing internal information."""

        import coverage as covmod

        self._init()

        ft_plugins = []
        for ft in self.plugins.file_tracers:
            ft_name = ft._coverage_plugin_name
            if not ft._coverage_enabled:
                ft_name += " (disabled)"
            ft_plugins.append(ft_name)

        info = [
            ('version', covmod.__version__),
            ('coverage', covmod.__file__),
            ('cover_paths', self.cover_paths),
            ('pylib_paths', self.pylib_paths),
            ('tracer', self.collector.tracer_name()),
            ('plugins.file_tracers', ft_plugins),
            ('config_files', self.config.attempted_config_files),
            ('configs_read', self.config.config_files),
            ('data_path', self.data_files.filename),
            ('python', sys.version.replace('\n', '')),
            ('platform', platform.platform()),
            ('implementation', platform.python_implementation()),
            ('executable', sys.executable),
            ('cwd', os.getcwd()),
            ('path', sys.path),
            ('environment', sorted(
                ("%s = %s" % (k, v))
                for k, v in iitems(os.environ)
                if k.startswith(("COV", "PY"))
            )),
            ('command_line', " ".join(getattr(sys, 'argv', ['???']))),
            ]

        matcher_names = [
            'source_match', 'source_pkgs_match',
            'include_match', 'omit_match',
            'cover_match', 'pylib_match',
            ]

        for matcher_name in matcher_names:
            matcher = getattr(self, matcher_name)
            if matcher:
                matcher_info = matcher.info()
            else:
                matcher_info = '-none-'
            info.append((matcher_name, matcher_info))

        return info


# FileDisposition "methods": FileDisposition is a pure value object, so it can
# be implemented in either C or Python.  Acting on them is done with these
# functions.

def _disposition_init(cls, original_filename):
    """Construct and initialize a new FileDisposition object."""
    disp = cls()
    disp.original_filename = original_filename
    disp.canonical_filename = original_filename
    disp.source_filename = None
    disp.trace = False
    disp.reason = ""
    disp.file_tracer = None
    disp.has_dynamic_filename = False
    return disp


def _disposition_debug_msg(disp):
    """Make a nice debug message of what the FileDisposition is doing."""
    if disp.trace:
        msg = "Tracing %r" % (disp.original_filename,)
        if disp.file_tracer:
            msg += ": will be traced by %r" % disp.file_tracer
    else:
        msg = "Not tracing %r: %s" % (disp.original_filename, disp.reason)
    return msg


def process_startup():
    """Call this at Python start-up to perhaps measure coverage.

    If the environment variable COVERAGE_PROCESS_START is defined, coverage
    measurement is started.  The value of the variable is the config file
    to use.

    There are two ways to configure your Python installation to invoke this
    function when Python starts:

    #. Create or append to sitecustomize.py to add these lines::

        import coverage
        coverage.process_startup()

    #. Create a .pth file in your Python installation containing::

        import coverage; coverage.process_startup()

    Returns the :class:`Coverage` instance that was started, or None if it was
    not started by this call.

    """
    cps = os.environ.get("COVERAGE_PROCESS_START")
    if not cps:
        # No request for coverage, nothing to do.
        return None

    # This function can be called more than once in a process. This happens
    # because some virtualenv configurations make the same directory visible
    # twice in sys.path.  This means that the .pth file will be found twice,
    # and executed twice, executing this function twice.  We set a global
    # flag (an attribute on this function) to indicate that coverage.py has
    # already been started, so we can avoid doing it twice.
    #
    # https://bitbucket.org/ned/coveragepy/issue/340/keyerror-subpy has more
    # details.

    if hasattr(process_startup, "coverage"):
        # We've annotated this function before, so we must have already
        # started coverage.py in this process.  Nothing to do.
        return None

    cov = Coverage(config_file=cps)
    process_startup.coverage = cov
    cov.start()
    cov._warn_no_data = False
    cov._warn_unimported_source = False
    cov._auto_save = True

    return cov


def _prevent_sub_process_measurement():
    """Stop any subprocess auto-measurement from writing data."""
    auto_created_coverage = getattr(process_startup, "coverage", None)
    if auto_created_coverage is not None:
        auto_created_coverage._auto_save = False
