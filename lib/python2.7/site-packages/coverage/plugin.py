# Licensed under the Apache License: http://www.apache.org/licenses/LICENSE-2.0
# For details: https://bitbucket.org/ned/coveragepy/src/default/NOTICE.txt

"""Plugin interfaces for coverage.py"""

from coverage import files
from coverage.misc import contract, _needs_to_implement


class CoveragePlugin(object):
    """Base class for coverage.py plugins.

    To write a coverage.py plugin, create a module with a subclass of
    :class:`CoveragePlugin`.  You will override methods in your class to
    participate in various aspects of coverage.py's processing.

    Currently the only plugin type is a file tracer, for implementing
    measurement support for non-Python files.  File tracer plugins implement
    the :meth:`file_tracer` method to claim files and the :meth:`file_reporter`
    method to report on those files.

    Any plugin can optionally implement :meth:`sys_info` to provide debugging
    information about their operation.

    Coverage.py will store its own information on your plugin object, using
    attributes whose names start with ``_coverage_``.  Don't be startled.

    To register your plugin, define a function called `coverage_init` in your
    module::

        def coverage_init(reg, options):
            reg.add_file_tracer(MyPlugin())

    You use the `reg` parameter passed to your `coverage_init` function to
    register your plugin object.  It has one method, `add_file_tracer`, which
    takes a newly created instance of your plugin.

    If your plugin takes options, the `options` parameter is a dictionary of
    your plugin's options from the coverage.py configuration file.  Use them
    however you want to configure your object before registering it.

    """

    def file_tracer(self, filename):        # pylint: disable=unused-argument
        """Get a :class:`FileTracer` object for a file.

        Every Python source file is offered to the plugin to give it a chance
        to take responsibility for tracing the file.  If your plugin can handle
        the file, then return a :class:`FileTracer` object.  Otherwise return
        None.

        There is no way to register your plugin for particular files.  Instead,
        this method is invoked for all files, and the plugin decides whether it
        can trace the file or not.  Be prepared for `filename` to refer to all
        kinds of files that have nothing to do with your plugin.

        The file name will be a Python file being executed.  There are two
        broad categories of behavior for a plugin, depending on the kind of
        files your plugin supports:

        * Static file names: each of your original source files has been
          converted into a distinct Python file.  Your plugin is invoked with
          the Python file name, and it maps it back to its original source
          file.

        * Dynamic file names: all of your source files are executed by the same
          Python file.  In this case, your plugin implements
          :meth:`FileTracer.dynamic_source_filename` to provide the actual
          source file for each execution frame.

        `filename` is a string, the path to the file being considered.  This is
        the absolute real path to the file.  If you are comparing to other
        paths, be sure to take this into account.

        Returns a :class:`FileTracer` object to use to trace `filename`, or
        None if this plugin cannot trace this file.

        """
        return None

    def file_reporter(self, filename):      # pylint: disable=unused-argument
        """Get the :class:`FileReporter` class to use for a file.

        This will only be invoked if `filename` returns non-None from
        :meth:`file_tracer`.  It's an error to return None from this method.

        Returns a :class:`FileReporter` object to use to report on `filename`.

        """
        _needs_to_implement(self, "file_reporter")

    def find_executable_files(self, src_dir):       # pylint: disable=unused-argument
        """Yield all of the executable files in `src_dir`, recursively.

        Executability is a plugin-specific property, but generally means files
        which would have been considered for coverage analysis, had they been
        included automatically.

        Returns or yields a sequence of strings, the paths to files that could
        have been executed, including files that had been executed.

        """
        return []

    def sys_info(self):
        """Get a list of information useful for debugging.

        This method will be invoked for ``--debug=sys``.  Your
        plugin can return any information it wants to be displayed.

        Returns a list of pairs: `[(name, value), ...]`.

        """
        return []


class FileTracer(object):
    """Support needed for files during the execution phase.

    You may construct this object from :meth:`CoveragePlugin.file_tracer` any
    way you like.  A natural choice would be to pass the file name given to
    `file_tracer`.

    `FileTracer` objects should only be created in the
    :meth:`CoveragePlugin.file_tracer` method.

    See :ref:`howitworks` for details of the different coverage.py phases.

    """

    def source_filename(self):
        """The source file name for this file.

        This may be any file name you like.  A key responsibility of a plugin
        is to own the mapping from Python execution back to whatever source
        file name was originally the source of the code.

        See :meth:`CoveragePlugin.file_tracer` for details about static and
        dynamic file names.

        Returns the file name to credit with this execution.

        """
        _needs_to_implement(self, "source_filename")

    def has_dynamic_source_filename(self):
        """Does this FileTracer have dynamic source file names?

        FileTracers can provide dynamically determined file names by
        implementing :meth:`dynamic_source_filename`.  Invoking that function
        is expensive. To determine whether to invoke it, coverage.py uses the
        result of this function to know if it needs to bother invoking
        :meth:`dynamic_source_filename`.

        See :meth:`CoveragePlugin.file_tracer` for details about static and
        dynamic file names.

        Returns True if :meth:`dynamic_source_filename` should be called to get
        dynamic source file names.

        """
        return False

    def dynamic_source_filename(self, filename, frame):     # pylint: disable=unused-argument
        """Get a dynamically computed source file name.

        Some plugins need to compute the source file name dynamically for each
        frame.

        This function will not be invoked if
        :meth:`has_dynamic_source_filename` returns False.

        Returns the source file name for this frame, or None if this frame
        shouldn't be measured.

        """
        return None

    def line_number_range(self, frame):
        """Get the range of source line numbers for a given a call frame.

        The call frame is examined, and the source line number in the original
        file is returned.  The return value is a pair of numbers, the starting
        line number and the ending line number, both inclusive.  For example,
        returning (5, 7) means that lines 5, 6, and 7 should be considered
        executed.

        This function might decide that the frame doesn't indicate any lines
        from the source file were executed.  Return (-1, -1) in this case to
        tell coverage.py that no lines should be recorded for this frame.

        """
        lineno = frame.f_lineno
        return lineno, lineno


class FileReporter(object):
    """Support needed for files during the analysis and reporting phases.

    See :ref:`howitworks` for details of the different coverage.py phases.

    `FileReporter` objects should only be created in the
    :meth:`CoveragePlugin.file_reporter` method.

    There are many methods here, but only :meth:`lines` is required, to provide
    the set of executable lines in the file.

    """

    def __init__(self, filename):
        """Simple initialization of a `FileReporter`.

        The `filename` argument is the path to the file being reported.  This
        will be available as the `.filename` attribute on the object.  Other
        method implementations on this base class rely on this attribute.

        """
        self.filename = filename

    def __repr__(self):
        return "<{0.__class__.__name__} filename={0.filename!r}>".format(self)

    def relative_filename(self):
        """Get the relative file name for this file.

        This file path will be displayed in reports.  The default
        implementation will supply the actual project-relative file path.  You
        only need to supply this method if you have an unusual syntax for file
        paths.

        """
        return files.relative_filename(self.filename)

    @contract(returns='unicode')
    def source(self):
        """Get the source for the file.

        Returns a Unicode string.

        The base implementation simply reads the `self.filename` file and
        decodes it as UTF8.  Override this method if your file isn't readable
        as a text file, or if you need other encoding support.

        """
        with open(self.filename, "rb") as f:
            return f.read().decode("utf8")

    def lines(self):
        """Get the executable lines in this file.

        Your plugin must determine which lines in the file were possibly
        executable.  This method returns a set of those line numbers.

        Returns a set of line numbers.

        """
        _needs_to_implement(self, "lines")

    def excluded_lines(self):
        """Get the excluded executable lines in this file.

        Your plugin can use any method it likes to allow the user to exclude
        executable lines from consideration.

        Returns a set of line numbers.

        The base implementation returns the empty set.

        """
        return set()

    def translate_lines(self, lines):
        """Translate recorded lines into reported lines.

        Some file formats will want to report lines slightly differently than
        they are recorded.  For example, Python records the last line of a
        multi-line statement, but reports are nicer if they mention the first
        line.

        Your plugin can optionally define this method to perform these kinds of
        adjustment.

        `lines` is a sequence of integers, the recorded line numbers.

        Returns a set of integers, the adjusted line numbers.

        The base implementation returns the numbers unchanged.

        """
        return set(lines)

    def arcs(self):
        """Get the executable arcs in this file.

        To support branch coverage, your plugin needs to be able to indicate
        possible execution paths, as a set of line number pairs.  Each pair is
        a `(prev, next)` pair indicating that execution can transition from the
        `prev` line number to the `next` line number.

        Returns a set of pairs of line numbers.  The default implementation
        returns an empty set.

        """
        return set()

    def no_branch_lines(self):
        """Get the lines excused from branch coverage in this file.

        Your plugin can use any method it likes to allow the user to exclude
        lines from consideration of branch coverage.

        Returns a set of line numbers.

        The base implementation returns the empty set.

        """
        return set()

    def translate_arcs(self, arcs):
        """Translate recorded arcs into reported arcs.

        Similar to :meth:`translate_lines`, but for arcs.  `arcs` is a set of
        line number pairs.

        Returns a set of line number pairs.

        The default implementation returns `arcs` unchanged.

        """
        return arcs

    def exit_counts(self):
        """Get a count of exits from that each line.

        To determine which lines are branches, coverage.py looks for lines that
        have more than one exit.  This function creates a dict mapping each
        executable line number to a count of how many exits it has.

        To be honest, this feels wrong, and should be refactored.  Let me know
        if you attempt to implement this method in your plugin...

        """
        return {}

    def missing_arc_description(self, start, end, executed_arcs=None):     # pylint: disable=unused-argument
        """Provide an English sentence describing a missing arc.

        The `start` and `end` arguments are the line numbers of the missing
        arc. Negative numbers indicate entering or exiting code objects.

        The `executed_arcs` argument is a set of line number pairs, the arcs
        that were executed in this file.

        By default, this simply returns the string "Line {start} didn't jump
        to {end}".

        """
        return "Line {start} didn't jump to line {end}".format(start=start, end=end)

    def source_token_lines(self):
        """Generate a series of tokenized lines, one for each line in `source`.

        These tokens are used for syntax-colored reports.

        Each line is a list of pairs, each pair is a token::

            [('key', 'def'), ('ws', ' '), ('nam', 'hello'), ('op', '('), ... ]

        Each pair has a token class, and the token text.  The token classes
        are:

        * ``'com'``: a comment
        * ``'key'``: a keyword
        * ``'nam'``: a name, or identifier
        * ``'num'``: a number
        * ``'op'``: an operator
        * ``'str'``: a string literal
        * ``'txt'``: some other kind of text

        If you concatenate all the token texts, and then join them with
        newlines, you should have your original source back.

        The default implementation simply returns each line tagged as
        ``'txt'``.

        """
        for line in self.source().splitlines():
            yield [('txt', line)]

    # Annoying comparison operators. Py3k wants __lt__ etc, and Py2k needs all
    # of them defined.

    def __eq__(self, other):
        return isinstance(other, FileReporter) and self.filename == other.filename

    def __ne__(self, other):
        return not (self == other)

    def __lt__(self, other):
        return self.filename < other.filename

    def __le__(self, other):
        return self.filename <= other.filename

    def __gt__(self, other):
        return self.filename > other.filename

    def __ge__(self, other):
        return self.filename >= other.filename

    __hash__ = None     # This object doesn't need to be hashed.
