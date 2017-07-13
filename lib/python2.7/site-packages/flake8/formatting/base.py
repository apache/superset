"""The base class and interface for all formatting plugins."""
from __future__ import print_function


class BaseFormatter(object):
    """Class defining the formatter interface.

    .. attribute:: options

        The options parsed from both configuration files and the command-line.

    .. attribute:: filename

        If specified by the user, the path to store the results of the run.

    .. attribute:: output_fd

        Initialized when the :meth:`start` is called. This will be a file
        object opened for writing.

    .. attribute:: newline

        The string to add to the end of a line. This is only used when the
        output filename has been specified.
    """

    def __init__(self, options):
        """Initialize with the options parsed from config and cli.

        This also calls a hook, :meth:`after_init`, so subclasses do not need
        to call super to call this method.

        :param optparse.Values options:
            User specified configuration parsed from both configuration files
            and the command-line interface.
        """
        self.options = options
        self.filename = options.output_file
        self.output_fd = None
        self.newline = '\n'
        self.after_init()

    def after_init(self):
        """Initialize the formatter further."""
        pass

    def beginning(self, filename):
        """Notify the formatter that we're starting to process a file.

        :param str filename:
            The name of the file that Flake8 is beginning to report results
            from.
        """
        pass

    def finished(self, filename):
        """Notify the formatter that we've finished processing a file.

        :param str filename:
            The name of the file that Flake8 has finished reporting results
            from.
        """
        pass

    def start(self):
        """Prepare the formatter to receive input.

        This defaults to initializing :attr:`output_fd` if :attr:`filename`
        """
        if self.filename:
            self.output_fd = open(self.filename, 'a')

    def handle(self, error):
        """Handle an error reported by Flake8.

        This defaults to calling :meth:`format`, :meth:`show_source`, and
        then :meth:`write`. To extend how errors are handled, override this
        method.

        :param error:
            This will be an instance of :class:`~flake8.style_guide.Error`.
        :type error:
            flake8.style_guide.Error
        """
        line = self.format(error)
        source = self.show_source(error)
        self.write(line, source)

    def format(self, error):
        """Format an error reported by Flake8.

        This method **must** be implemented by subclasses.

        :param error:
            This will be an instance of :class:`~flake8.style_guide.Error`.
        :type error:
            flake8.style_guide.Error
        :returns:
            The formatted error string.
        :rtype:
            str
        """
        raise NotImplementedError('Subclass of BaseFormatter did not implement'
                                  ' format.')

    def show_statistics(self, statistics):
        """Format and print the statistics."""
        for error_code in statistics.error_codes():
            stats_for_error_code = statistics.statistics_for(error_code)
            statistic = next(stats_for_error_code)
            count = statistic.count
            count += sum(stat.count for stat in stats_for_error_code)
            self._write('{count:<5} {error_code} {message}'.format(
                count=count,
                error_code=error_code,
                message=statistic.message,
            ))

    def show_benchmarks(self, benchmarks):
        """Format and print the benchmarks."""
        # NOTE(sigmavirus24): The format strings are a little confusing, even
        # to me, so here's a quick explanation:
        # We specify the named value first followed by a ':' to indicate we're
        # formatting the value.
        # Next we use '<' to indicate we want the value left aligned.
        # Then '10' is the width of the area.
        # For floats, finally, we only want only want at most 3 digits after
        # the decimal point to be displayed. This is the precision and it
        # can not be specified for integers which is why we need two separate
        # format strings.
        float_format = '{value:<10.3} {statistic}'.format
        int_format = '{value:<10} {statistic}'.format
        for statistic, value in benchmarks:
            if isinstance(value, int):
                benchmark = int_format(statistic=statistic, value=value)
            else:
                benchmark = float_format(statistic=statistic, value=value)
            self._write(benchmark)

    def show_source(self, error):
        """Show the physical line generating the error.

        This also adds an indicator for the particular part of the line that
        is reported as generating the problem.

        :param error:
            This will be an instance of :class:`~flake8.style_guide.Error`.
        :type error:
            flake8.style_guide.Error
        :returns:
            The formatted error string if the user wants to show the source.
            If the user does not want to show the source, this will return
            ``None``.
        :rtype:
            str
        """
        if not self.options.show_source or error.physical_line is None:
            return ''

        # Because column numbers are 1-indexed, we need to remove one to get
        # the proper number of space characters.
        pointer = (' ' * (error.column_number - 1)) + '^'
        # Physical lines have a newline at the end, no need to add an extra
        # one
        return error.physical_line + pointer

    def _write(self, output):
        """Handle logic of whether to use an output file or print()."""
        if self.output_fd is not None:
            self.output_fd.write(output + self.newline)
        if self.output_fd is None or self.options.tee:
            print(output)

    def write(self, line, source):
        """Write the line either to the output file or stdout.

        This handles deciding whether to write to a file or print to standard
        out for subclasses. Override this if you want behaviour that differs
        from the default.

        :param str line:
            The formatted string to print or write.
        :param str source:
            The source code that has been formatted and associated with the
            line of output.
        """
        if line:
            self._write(line)
        if source:
            self._write(source)

    def stop(self):
        """Clean up after reporting is finished."""
        if self.output_fd is not None:
            self.output_fd.close()
            self.output_fd = None
