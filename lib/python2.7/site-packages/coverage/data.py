# Licensed under the Apache License: http://www.apache.org/licenses/LICENSE-2.0
# For details: https://bitbucket.org/ned/coveragepy/src/default/NOTICE.txt

"""Coverage data for coverage.py."""

import glob
import itertools
import json
import optparse
import os
import os.path
import random
import re
import socket

from coverage import env
from coverage.backward import iitems, string_class
from coverage.debug import _TEST_NAME_FILE
from coverage.files import PathAliases
from coverage.misc import CoverageException, file_be_gone, isolate_module

os = isolate_module(os)


class CoverageData(object):
    """Manages collected coverage data, including file storage.

    This class is the public supported API to the data coverage.py collects
    during program execution.  It includes information about what code was
    executed. It does not include information from the analysis phase, to
    determine what lines could have been executed, or what lines were not
    executed.

    .. note::

        The file format is not documented or guaranteed.  It will change in
        the future, in possibly complicated ways.  Do not read coverage.py
        data files directly.  Use this API to avoid disruption.

    There are a number of kinds of data that can be collected:

    * **lines**: the line numbers of source lines that were executed.
      These are always available.

    * **arcs**: pairs of source and destination line numbers for transitions
      between source lines.  These are only available if branch coverage was
      used.

    * **file tracer names**: the module names of the file tracer plugins that
      handled each file in the data.

    * **run information**: information about the program execution.  This is
      written during "coverage run", and then accumulated during "coverage
      combine".

    Lines, arcs, and file tracer names are stored for each source file. File
    names in this API are case-sensitive, even on platforms with
    case-insensitive file systems.

    To read a coverage.py data file, use :meth:`read_file`, or
    :meth:`read_fileobj` if you have an already-opened file.  You can then
    access the line, arc, or file tracer data with :meth:`lines`, :meth:`arcs`,
    or :meth:`file_tracer`.  Run information is available with
    :meth:`run_infos`.

    The :meth:`has_arcs` method indicates whether arc data is available.  You
    can get a list of the files in the data with :meth:`measured_files`.
    A summary of the line data is available from :meth:`line_counts`.  As with
    most Python containers, you can determine if there is any data at all by
    using this object as a boolean value.


    Most data files will be created by coverage.py itself, but you can use
    methods here to create data files if you like.  The :meth:`add_lines`,
    :meth:`add_arcs`, and :meth:`add_file_tracers` methods add data, in ways
    that are convenient for coverage.py.  The :meth:`add_run_info` method adds
    key-value pairs to the run information.

    To add a file without any measured data, use :meth:`touch_file`.

    You write to a named file with :meth:`write_file`, or to an already opened
    file with :meth:`write_fileobj`.

    You can clear the data in memory with :meth:`erase`.  Two data collections
    can be combined by using :meth:`update` on one :class:`CoverageData`,
    passing it the other.

    """

    # The data file format is JSON, with these keys:
    #
    #     * lines: a dict mapping file names to lists of line numbers
    #       executed::
    #
    #         { "file1": [17,23,45], "file2": [1,2,3], ... }
    #
    #     * arcs: a dict mapping file names to lists of line number pairs::
    #
    #         { "file1": [[17,23], [17,25], [25,26]], ... }
    #
    #     * file_tracers: a dict mapping file names to plugin names::
    #
    #         { "file1": "django.coverage", ... }
    #
    #     * runs: a list of dicts of information about the coverage.py runs
    #       contributing to the data::
    #
    #         [ { "brief_sys": "CPython 2.7.10 Darwin" }, ... ]
    #
    # Only one of `lines` or `arcs` will be present: with branch coverage, data
    # is stored as arcs. Without branch coverage, it is stored as lines.  The
    # line data is easily recovered from the arcs: it is all the first elements
    # of the pairs that are greater than zero.

    def __init__(self, debug=None):
        """Create a CoverageData.

        `debug` is a `DebugControl` object for writing debug messages.

        """
        self._debug = debug

        # A map from canonical Python source file name to a dictionary in
        # which there's an entry for each line number that has been
        # executed:
        #
        #   { 'filename1.py': [12, 47, 1001], ... }
        #
        self._lines = None

        # A map from canonical Python source file name to a dictionary with an
        # entry for each pair of line numbers forming an arc:
        #
        #   { 'filename1.py': [(12,14), (47,48), ... ], ... }
        #
        self._arcs = None

        # A map from canonical source file name to a plugin module name:
        #
        #   { 'filename1.py': 'django.coverage', ... }
        #
        self._file_tracers = {}

        # A list of dicts of information about the coverage.py runs.
        self._runs = []

    def __repr__(self):
        return "<{klass} lines={lines} arcs={arcs} tracers={tracers} runs={runs}>".format(
            klass=self.__class__.__name__,
            lines="None" if self._lines is None else "{{{0}}}".format(len(self._lines)),
            arcs="None" if self._arcs is None else "{{{0}}}".format(len(self._arcs)),
            tracers="{{{0}}}".format(len(self._file_tracers)),
            runs="[{0}]".format(len(self._runs)),
        )

    ##
    ## Reading data
    ##

    def has_arcs(self):
        """Does this data have arcs?

        Arc data is only available if branch coverage was used during
        collection.

        Returns a boolean.

        """
        return self._has_arcs()

    def lines(self, filename):
        """Get the list of lines executed for a file.

        If the file was not measured, returns None.  A file might be measured,
        and have no lines executed, in which case an empty list is returned.

        If the file was executed, returns a list of integers, the line numbers
        executed in the file. The list is in no particular order.

        """
        if self._arcs is not None:
            arcs = self._arcs.get(filename)
            if arcs is not None:
                all_lines = itertools.chain.from_iterable(arcs)
                return list(set(l for l in all_lines if l > 0))
        elif self._lines is not None:
            return self._lines.get(filename)
        return None

    def arcs(self, filename):
        """Get the list of arcs executed for a file.

        If the file was not measured, returns None.  A file might be measured,
        and have no arcs executed, in which case an empty list is returned.

        If the file was executed, returns a list of 2-tuples of integers. Each
        pair is a starting line number and an ending line number for a
        transition from one line to another. The list is in no particular
        order.

        Negative numbers have special meaning.  If the starting line number is
        -N, it represents an entry to the code object that starts at line N.
        If the ending ling number is -N, it's an exit from the code object that
        starts at line N.

        """
        if self._arcs is not None:
            if filename in self._arcs:
                return self._arcs[filename]
        return None

    def file_tracer(self, filename):
        """Get the plugin name of the file tracer for a file.

        Returns the name of the plugin that handles this file.  If the file was
        measured, but didn't use a plugin, then "" is returned.  If the file
        was not measured, then None is returned.

        """
        # Because the vast majority of files involve no plugin, we don't store
        # them explicitly in self._file_tracers.  Check the measured data
        # instead to see if it was a known file with no plugin.
        if filename in (self._arcs or self._lines or {}):
            return self._file_tracers.get(filename, "")
        return None

    def run_infos(self):
        """Return the list of dicts of run information.

        For data collected during a single run, this will be a one-element
        list.  If data has been combined, there will be one element for each
        original data file.

        """
        return self._runs

    def measured_files(self):
        """A list of all files that had been measured."""
        return list(self._arcs or self._lines or {})

    def line_counts(self, fullpath=False):
        """Return a dict summarizing the line coverage data.

        Keys are based on the file names, and values are the number of executed
        lines.  If `fullpath` is true, then the keys are the full pathnames of
        the files, otherwise they are the basenames of the files.

        Returns a dict mapping file names to counts of lines.

        """
        summ = {}
        if fullpath:
            filename_fn = lambda f: f
        else:
            filename_fn = os.path.basename
        for filename in self.measured_files():
            summ[filename_fn(filename)] = len(self.lines(filename))
        return summ

    def __nonzero__(self):
        return bool(self._lines or self._arcs)

    __bool__ = __nonzero__

    def read_fileobj(self, file_obj):
        """Read the coverage data from the given file object.

        Should only be used on an empty CoverageData object.

        """
        data = self._read_raw_data(file_obj)

        self._lines = self._arcs = None

        if 'lines' in data:
            self._lines = data['lines']
        if 'arcs' in data:
            self._arcs = dict(
                (fname, [tuple(pair) for pair in arcs])
                for fname, arcs in iitems(data['arcs'])
            )
        self._file_tracers = data.get('file_tracers', {})
        self._runs = data.get('runs', [])

        self._validate()

    def read_file(self, filename):
        """Read the coverage data from `filename` into this object."""
        if self._debug and self._debug.should('dataio'):
            self._debug.write("Reading data from %r" % (filename,))
        try:
            with self._open_for_reading(filename) as f:
                self.read_fileobj(f)
        except Exception as exc:
            raise CoverageException(
                "Couldn't read data from '%s': %s: %s" % (
                    filename, exc.__class__.__name__, exc,
                )
            )

    _GO_AWAY = "!coverage.py: This is a private format, don't read it directly!"

    @classmethod
    def _open_for_reading(cls, filename):
        """Open a file appropriately for reading data."""
        return open(filename, "r")

    @classmethod
    def _read_raw_data(cls, file_obj):
        """Read the raw data from a file object."""
        go_away = file_obj.read(len(cls._GO_AWAY))
        if go_away != cls._GO_AWAY:
            raise CoverageException("Doesn't seem to be a coverage.py data file")
        return json.load(file_obj)

    @classmethod
    def _read_raw_data_file(cls, filename):
        """Read the raw data from a file, for debugging."""
        with cls._open_for_reading(filename) as f:
            return cls._read_raw_data(f)

    ##
    ## Writing data
    ##

    def add_lines(self, line_data):
        """Add measured line data.

        `line_data` is a dictionary mapping file names to dictionaries::

            { filename: { lineno: None, ... }, ...}

        """
        if self._debug and self._debug.should('dataop'):
            self._debug.write("Adding lines: %d files, %d lines total" % (
                len(line_data), sum(len(lines) for lines in line_data.values())
            ))
        if self._has_arcs():
            raise CoverageException("Can't add lines to existing arc data")

        if self._lines is None:
            self._lines = {}
        for filename, linenos in iitems(line_data):
            if filename in self._lines:
                new_linenos = set(self._lines[filename])
                new_linenos.update(linenos)
                linenos = new_linenos
            self._lines[filename] = list(linenos)

        self._validate()

    def add_arcs(self, arc_data):
        """Add measured arc data.

        `arc_data` is a dictionary mapping file names to dictionaries::

            { filename: { (l1,l2): None, ... }, ...}

        """
        if self._debug and self._debug.should('dataop'):
            self._debug.write("Adding arcs: %d files, %d arcs total" % (
                len(arc_data), sum(len(arcs) for arcs in arc_data.values())
            ))
        if self._has_lines():
            raise CoverageException("Can't add arcs to existing line data")

        if self._arcs is None:
            self._arcs = {}
        for filename, arcs in iitems(arc_data):
            if filename in self._arcs:
                new_arcs = set(self._arcs[filename])
                new_arcs.update(arcs)
                arcs = new_arcs
            self._arcs[filename] = list(arcs)

        self._validate()

    def add_file_tracers(self, file_tracers):
        """Add per-file plugin information.

        `file_tracers` is { filename: plugin_name, ... }

        """
        if self._debug and self._debug.should('dataop'):
            self._debug.write("Adding file tracers: %d files" % (len(file_tracers),))

        existing_files = self._arcs or self._lines or {}
        for filename, plugin_name in iitems(file_tracers):
            if filename not in existing_files:
                raise CoverageException(
                    "Can't add file tracer data for unmeasured file '%s'" % (filename,)
                )
            existing_plugin = self._file_tracers.get(filename)
            if existing_plugin is not None and plugin_name != existing_plugin:
                raise CoverageException(
                    "Conflicting file tracer name for '%s': %r vs %r" % (
                        filename, existing_plugin, plugin_name,
                    )
                )
            self._file_tracers[filename] = plugin_name

        self._validate()

    def add_run_info(self, **kwargs):
        """Add information about the run.

        Keywords are arbitrary, and are stored in the run dictionary. Values
        must be JSON serializable.  You may use this function more than once,
        but repeated keywords overwrite each other.

        """
        if self._debug and self._debug.should('dataop'):
            self._debug.write("Adding run info: %r" % (kwargs,))
        if not self._runs:
            self._runs = [{}]
        self._runs[0].update(kwargs)
        self._validate()

    def touch_file(self, filename, plugin_name=""):
        """Ensure that `filename` appears in the data, empty if needed.

        `plugin_name` is the name of the plugin resposible for this file. It is used
        to associate the right filereporter, etc.
        """
        if self._debug and self._debug.should('dataop'):
            self._debug.write("Touching %r" % (filename,))
        if not self._has_arcs() and not self._has_lines():
            raise CoverageException("Can't touch files in an empty CoverageData")

        if self._has_arcs():
            where = self._arcs
        else:
            where = self._lines
        where.setdefault(filename, [])
        if plugin_name:
            # Set the tracer for this file
            self._file_tracers[filename] = plugin_name

        self._validate()

    def write_fileobj(self, file_obj):
        """Write the coverage data to `file_obj`."""

        # Create the file data.
        file_data = {}

        if self._has_arcs():
            file_data['arcs'] = self._arcs

        if self._has_lines():
            file_data['lines'] = self._lines

        if self._file_tracers:
            file_data['file_tracers'] = self._file_tracers

        if self._runs:
            file_data['runs'] = self._runs

        # Write the data to the file.
        file_obj.write(self._GO_AWAY)
        json.dump(file_data, file_obj, separators=(',', ':'))

    def write_file(self, filename):
        """Write the coverage data to `filename`."""
        if self._debug and self._debug.should('dataio'):
            self._debug.write("Writing data to %r" % (filename,))
        with open(filename, 'w') as fdata:
            self.write_fileobj(fdata)

    def erase(self):
        """Erase the data in this object."""
        self._lines = None
        self._arcs = None
        self._file_tracers = {}
        self._runs = []
        self._validate()

    def update(self, other_data, aliases=None):
        """Update this data with data from another `CoverageData`.

        If `aliases` is provided, it's a `PathAliases` object that is used to
        re-map paths to match the local machine's.

        """
        if self._has_lines() and other_data._has_arcs():
            raise CoverageException("Can't combine arc data with line data")
        if self._has_arcs() and other_data._has_lines():
            raise CoverageException("Can't combine line data with arc data")

        aliases = aliases or PathAliases()

        # _file_tracers: only have a string, so they have to agree.
        # Have to do these first, so that our examination of self._arcs and
        # self._lines won't be confused by data updated from other_data.
        for filename in other_data.measured_files():
            other_plugin = other_data.file_tracer(filename)
            filename = aliases.map(filename)
            this_plugin = self.file_tracer(filename)
            if this_plugin is None:
                if other_plugin:
                    self._file_tracers[filename] = other_plugin
            elif this_plugin != other_plugin:
                raise CoverageException(
                    "Conflicting file tracer name for '%s': %r vs %r" % (
                        filename, this_plugin, other_plugin,
                    )
                )

        # _runs: add the new runs to these runs.
        self._runs.extend(other_data._runs)

        # _lines: merge dicts.
        if other_data._has_lines():
            if self._lines is None:
                self._lines = {}
            for filename, file_lines in iitems(other_data._lines):
                filename = aliases.map(filename)
                if filename in self._lines:
                    lines = set(self._lines[filename])
                    lines.update(file_lines)
                    file_lines = list(lines)
                self._lines[filename] = file_lines

        # _arcs: merge dicts.
        if other_data._has_arcs():
            if self._arcs is None:
                self._arcs = {}
            for filename, file_arcs in iitems(other_data._arcs):
                filename = aliases.map(filename)
                if filename in self._arcs:
                    arcs = set(self._arcs[filename])
                    arcs.update(file_arcs)
                    file_arcs = list(arcs)
                self._arcs[filename] = file_arcs

        self._validate()

    ##
    ## Miscellaneous
    ##

    def _validate(self):
        """If we are in paranoid mode, validate that everything is right."""
        if env.TESTING:
            self._validate_invariants()

    def _validate_invariants(self):
        """Validate internal invariants."""
        # Only one of _lines or _arcs should exist.
        assert not(self._has_lines() and self._has_arcs()), (
            "Shouldn't have both _lines and _arcs"
        )

        # _lines should be a dict of lists of ints.
        if self._has_lines():
            for fname, lines in iitems(self._lines):
                assert isinstance(fname, string_class), "Key in _lines shouldn't be %r" % (fname,)
                assert all(isinstance(x, int) for x in lines), (
                    "_lines[%r] shouldn't be %r" % (fname, lines)
                )

        # _arcs should be a dict of lists of pairs of ints.
        if self._has_arcs():
            for fname, arcs in iitems(self._arcs):
                assert isinstance(fname, string_class), "Key in _arcs shouldn't be %r" % (fname,)
                assert all(isinstance(x, int) and isinstance(y, int) for x, y in arcs), (
                    "_arcs[%r] shouldn't be %r" % (fname, arcs)
                )

        # _file_tracers should have only non-empty strings as values.
        for fname, plugin in iitems(self._file_tracers):
            assert isinstance(fname, string_class), (
                "Key in _file_tracers shouldn't be %r" % (fname,)
            )
            assert plugin and isinstance(plugin, string_class), (
                "_file_tracers[%r] shoudn't be %r" % (fname, plugin)
            )

        # _runs should be a list of dicts.
        for val in self._runs:
            assert isinstance(val, dict)
            for key in val:
                assert isinstance(key, string_class), "Key in _runs shouldn't be %r" % (key,)

    def add_to_hash(self, filename, hasher):
        """Contribute `filename`'s data to the `hasher`.

        `hasher` is a `coverage.misc.Hasher` instance to be updated with
        the file's data.  It should only get the results data, not the run
        data.

        """
        if self._has_arcs():
            hasher.update(sorted(self.arcs(filename) or []))
        else:
            hasher.update(sorted(self.lines(filename) or []))
        hasher.update(self.file_tracer(filename))

    ##
    ## Internal
    ##

    def _has_lines(self):
        """Do we have data in self._lines?"""
        return self._lines is not None

    def _has_arcs(self):
        """Do we have data in self._arcs?"""
        return self._arcs is not None


class CoverageDataFiles(object):
    """Manage the use of coverage data files."""

    def __init__(self, basename=None, warn=None, debug=None):
        """Create a CoverageDataFiles to manage data files.

        `warn` is the warning function to use.

        `basename` is the name of the file to use for storing data.

        `debug` is a `DebugControl` object for writing debug messages.

        """
        self.warn = warn
        self.debug = debug

        # Construct the file name that will be used for data storage.
        self.filename = os.path.abspath(basename or ".coverage")

    def erase(self, parallel=False):
        """Erase the data from the file storage.

        If `parallel` is true, then also deletes data files created from the
        basename by parallel-mode.

        """
        if self.debug and self.debug.should('dataio'):
            self.debug.write("Erasing data file %r" % (self.filename,))
        file_be_gone(self.filename)
        if parallel:
            data_dir, local = os.path.split(self.filename)
            localdot = local + '.*'
            pattern = os.path.join(os.path.abspath(data_dir), localdot)
            for filename in glob.glob(pattern):
                if self.debug and self.debug.should('dataio'):
                    self.debug.write("Erasing parallel data file %r" % (filename,))
                file_be_gone(filename)

    def read(self, data):
        """Read the coverage data."""
        if os.path.exists(self.filename):
            data.read_file(self.filename)

    def write(self, data, suffix=None):
        """Write the collected coverage data to a file.

        `suffix` is a suffix to append to the base file name. This can be used
        for multiple or parallel execution, so that many coverage data files
        can exist simultaneously.  A dot will be used to join the base name and
        the suffix.

        """
        filename = self.filename
        if suffix is True:
            # If data_suffix was a simple true value, then make a suffix with
            # plenty of distinguishing information.  We do this here in
            # `save()` at the last minute so that the pid will be correct even
            # if the process forks.
            extra = ""
            if _TEST_NAME_FILE:                             # pragma: debugging
                with open(_TEST_NAME_FILE) as f:
                    test_name = f.read()
                extra = "." + test_name
            dice = random.Random(os.urandom(8)).randint(0, 999999)
            suffix = "%s%s.%s.%06d" % (socket.gethostname(), extra, os.getpid(), dice)

        if suffix:
            filename += "." + suffix
        data.write_file(filename)

    def combine_parallel_data(self, data, aliases=None, data_paths=None, strict=False):
        """Combine a number of data files together.

        Treat `self.filename` as a file prefix, and combine the data from all
        of the data files starting with that prefix plus a dot.

        If `aliases` is provided, it's a `PathAliases` object that is used to
        re-map paths to match the local machine's.

        If `data_paths` is provided, it is a list of directories or files to
        combine.  Directories are searched for files that start with
        `self.filename` plus dot as a prefix, and those files are combined.

        If `data_paths` is not provided, then the directory portion of
        `self.filename` is used as the directory to search for data files.

        Every data file found and combined is then deleted from disk. If a file
        cannot be read, a warning will be issued, and the file will not be
        deleted.

        If `strict` is true, and no files are found to combine, an error is
        raised.

        """
        # Because of the os.path.abspath in the constructor, data_dir will
        # never be an empty string.
        data_dir, local = os.path.split(self.filename)
        localdot = local + '.*'

        data_paths = data_paths or [data_dir]
        files_to_combine = []
        for p in data_paths:
            if os.path.isfile(p):
                files_to_combine.append(os.path.abspath(p))
            elif os.path.isdir(p):
                pattern = os.path.join(os.path.abspath(p), localdot)
                files_to_combine.extend(glob.glob(pattern))
            else:
                raise CoverageException("Couldn't combine from non-existent path '%s'" % (p,))

        if strict and not files_to_combine:
            raise CoverageException("No data to combine")

        for f in files_to_combine:
            new_data = CoverageData(debug=self.debug)
            try:
                new_data.read_file(f)
            except CoverageException as exc:
                if self.warn:
                    # The CoverageException has the file name in it, so just
                    # use the message as the warning.
                    self.warn(str(exc))
            else:
                data.update(new_data, aliases=aliases)
                if self.debug and self.debug.should('dataio'):
                    self.debug.write("Deleting combined data file %r" % (f,))
                file_be_gone(f)


def canonicalize_json_data(data):
    """Canonicalize our JSON data so it can be compared."""
    for fname, lines in iitems(data.get('lines', {})):
        data['lines'][fname] = sorted(lines)
    for fname, arcs in iitems(data.get('arcs', {})):
        data['arcs'][fname] = sorted(arcs)


def pretty_data(data):
    """Format data as JSON, but as nicely as possible.

    Returns a string.

    """
    # Start with a basic JSON dump.
    out = json.dumps(data, indent=4, sort_keys=True)
    # But pairs of numbers shouldn't be split across lines...
    out = re.sub(r"\[\s+(-?\d+),\s+(-?\d+)\s+]", r"[\1, \2]", out)
    # Trailing spaces mess with tests, get rid of them.
    out = re.sub(r"(?m)\s+$", "", out)
    return out


def debug_main(args):
    """Dump the raw data from data files.

    Run this as::

        $ python -m coverage.data [FILE]

    """
    parser = optparse.OptionParser()
    parser.add_option(
        "-c", "--canonical", action="store_true",
        help="Sort data into a canonical order",
    )
    options, args = parser.parse_args(args)

    for filename in (args or [".coverage"]):
        print("--- {0} ------------------------------".format(filename))
        data = CoverageData._read_raw_data_file(filename)
        if options.canonical:
            canonicalize_json_data(data)
        print(pretty_data(data))


if __name__ == '__main__':
    import sys
    debug_main(sys.argv[1:])
