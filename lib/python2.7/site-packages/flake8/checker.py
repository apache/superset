"""Checker Manager and Checker classes."""
import collections
import errno
import logging
import os
import signal
import sys
import tokenize

try:
    import multiprocessing
except ImportError:
    multiprocessing = None

from flake8 import defaults
from flake8 import exceptions
from flake8 import processor
from flake8 import utils

LOG = logging.getLogger(__name__)

SERIAL_RETRY_ERRNOS = set([
    # ENOSPC: Added by sigmavirus24
    # > On some operating systems (OSX), multiprocessing may cause an
    # > ENOSPC error while trying to trying to create a Semaphore.
    # > In those cases, we should replace the customized Queue Report
    # > class with pep8's StandardReport class to ensure users don't run
    # > into this problem.
    # > (See also: https://gitlab.com/pycqa/flake8/issues/74)
    errno.ENOSPC,
    # NOTE(sigmavirus24): When adding to this list, include the reasoning
    # on the lines before the error code and always append your error
    # code. Further, please always add a trailing `,` to reduce the visual
    # noise in diffs.
])


class Manager(object):
    """Manage the parallelism and checker instances for each plugin and file.

    This class will be responsible for the following:

    - Determining the parallelism of Flake8, e.g.:

      * Do we use :mod:`multiprocessing` or is it unavailable?

      * Do we automatically decide on the number of jobs to use or did the
        user provide that?

    - Falling back to a serial way of processing files if we run into an
      OSError related to :mod:`multiprocessing`

    - Organizing the results of each checker so we can group the output
      together and make our output deterministic.
    """

    def __init__(self, style_guide, arguments, checker_plugins):
        """Initialize our Manager instance.

        :param style_guide:
            The instantiated style guide for this instance of Flake8.
        :type style_guide:
            flake8.style_guide.StyleGuide
        :param list arguments:
            The extra arguments parsed from the CLI (if any)
        :param checker_plugins:
            The plugins representing checks parsed from entry-points.
        :type checker_plugins:
            flake8.plugins.manager.Checkers
        """
        self.arguments = arguments
        self.style_guide = style_guide
        self.options = style_guide.options
        self.checks = checker_plugins
        self.jobs = self._job_count()
        self.using_multiprocessing = self.jobs > 1
        self.pool = None
        self.processes = []
        self.checkers = []
        self.statistics = {
            'files': 0,
            'logical lines': 0,
            'physical lines': 0,
            'tokens': 0,
        }

        if self.using_multiprocessing:
            try:
                self.pool = multiprocessing.Pool(self.jobs, _pool_init)
            except OSError as oserr:
                if oserr.errno not in SERIAL_RETRY_ERRNOS:
                    raise
                self.using_multiprocessing = False

    def _process_statistics(self):
        for checker in self.checkers:
            for statistic in defaults.STATISTIC_NAMES:
                self.statistics[statistic] += checker.statistics[statistic]
        self.statistics['files'] += len(self.checkers)

    def _job_count(self):
        # type: () -> int
        # First we walk through all of our error cases:
        # - multiprocessing library is not present
        # - we're running on windows in which case we know we have significant
        #   implemenation issues
        # - the user provided stdin and that's not something we can handle
        #   well
        # - we're processing a diff, which again does not work well with
        #   multiprocessing and which really shouldn't require multiprocessing
        # - the user provided some awful input
        if not multiprocessing:
            LOG.warning('The multiprocessing module is not available. '
                        'Ignoring --jobs arguments.')
            return 0

        if (utils.is_windows() and
                not utils.can_run_multiprocessing_on_windows()):
            LOG.warning('The --jobs option is not available on Windows due to'
                        ' a bug (https://bugs.python.org/issue27649) in '
                        'Python 2.7.11+ and 3.3+. We have detected that you '
                        'are running an unsupported version of Python on '
                        'Windows. Ignoring --jobs arguments.')
            return 0

        if utils.is_using_stdin(self.arguments):
            LOG.warning('The --jobs option is not compatible with supplying '
                        'input using - . Ignoring --jobs arguments.')
            return 0

        if self.options.diff:
            LOG.warning('The --diff option was specified with --jobs but '
                        'they are not compatible. Ignoring --jobs arguments.')
            return 0

        jobs = self.options.jobs
        if jobs != 'auto' and not jobs.isdigit():
            LOG.warning('"%s" is not a valid parameter to --jobs. Must be one '
                        'of "auto" or a numerical value, e.g., 4.', jobs)
            return 0

        # If the value is "auto", we want to let the multiprocessing library
        # decide the number based on the number of CPUs. However, if that
        # function is not implemented for this particular value of Python we
        # default to 1
        if jobs == 'auto':
            try:
                return multiprocessing.cpu_count()
            except NotImplementedError:
                return 0

        # Otherwise, we know jobs should be an integer and we can just convert
        # it to an integer
        return int(jobs)

    def _handle_results(self, filename, results):
        style_guide = self.style_guide
        reported_results_count = 0
        for (error_code, line_number, column, text, physical_line) in results:
            reported_results_count += style_guide.handle_error(
                code=error_code,
                filename=filename,
                line_number=line_number,
                column_number=column,
                text=text,
                physical_line=physical_line,
            )
        return reported_results_count

    def is_path_excluded(self, path):
        # type: (str) -> bool
        """Check if a path is excluded.

        :param str path:
            Path to check against the exclude patterns.
        :returns:
            True if there are exclude patterns and the path matches,
            otherwise False.
        :rtype:
            bool
        """
        if path == '-':
            if self.options.stdin_display_name == 'stdin':
                return False
            path = self.options.stdin_display_name

        exclude = self.options.exclude
        if not exclude:
            return False
        basename = os.path.basename(path)
        if utils.fnmatch(basename, exclude):
            LOG.debug('"%s" has been excluded', basename)
            return True

        absolute_path = os.path.abspath(path)
        match = utils.fnmatch(absolute_path, exclude)
        LOG.debug('"%s" has %sbeen excluded', absolute_path,
                  '' if match else 'not ')
        return match

    def make_checkers(self, paths=None):
        # type: (List[str]) -> NoneType
        """Create checkers for each file."""
        if paths is None:
            paths = self.arguments

        if not paths:
            paths = ['.']

        filename_patterns = self.options.filename
        running_from_vcs = self.options._running_from_vcs

        # NOTE(sigmavirus24): Yes this is a little unsightly, but it's our
        # best solution right now.
        def should_create_file_checker(filename, argument):
            """Determine if we should create a file checker."""
            matches_filename_patterns = utils.fnmatch(
                filename, filename_patterns
            )
            is_stdin = filename == '-'
            file_exists = os.path.exists(filename)
            # NOTE(sigmavirus24): If a user explicitly specifies something,
            # e.g, ``flake8 bin/script`` then we should run Flake8 against
            # that. Since should_create_file_checker looks to see if the
            # filename patterns match the filename, we want to skip that in
            # the event that the argument and the filename are identical.
            # If it was specified explicitly, the user intended for it to be
            # checked.
            explicitly_provided = (not running_from_vcs and
                                   (argument == filename))
            return ((file_exists and
                     (explicitly_provided or matches_filename_patterns)) or
                    is_stdin)

        checks = self.checks.to_dictionary()
        checkers = (
            FileChecker(filename, checks, self.options)
            for argument in paths
            for filename in utils.filenames_from(argument,
                                                 self.is_path_excluded)
            if should_create_file_checker(filename, argument)
        )
        self.checkers = [
            checker for checker in checkers if checker.should_process
        ]
        LOG.info('Checking %d files', len(self.checkers))

    def report(self):
        # type: () -> (int, int)
        """Report all of the errors found in the managed file checkers.

        This iterates over each of the checkers and reports the errors sorted
        by line number.

        :returns:
            A tuple of the total results found and the results reported.
        :rtype:
            tuple(int, int)
        """
        results_reported = results_found = 0
        for checker in self.checkers:
            results = sorted(checker.results, key=lambda tup: (tup[1], tup[2]))
            filename = checker.display_name
            with self.style_guide.processing_file(filename):
                results_reported += self._handle_results(filename, results)
            results_found += len(results)
        return (results_found, results_reported)

    def _force_cleanup(self):
        if self.pool is not None:
            self.pool.terminate()
            self.pool.join()

    def run_parallel(self):
        """Run the checkers in parallel."""
        final_results = collections.defaultdict(list)
        final_statistics = collections.defaultdict(dict)
        pool_map = self.pool.imap_unordered(
            _run_checks,
            self.checkers,
            chunksize=calculate_pool_chunksize(
                len(self.checkers),
                self.jobs,
            ),
        )
        for ret in pool_map:
            filename, results, statistics = ret
            final_results[filename] = results
            final_statistics[filename] = statistics
        self.pool.close()
        self.pool.join()
        self.pool = None

        for checker in self.checkers:
            filename = checker.display_name
            checker.results = sorted(final_results[filename],
                                     key=lambda tup: (tup[2], tup[2]))
            checker.statistics = final_statistics[filename]

    def run_serial(self):
        """Run the checkers in serial."""
        for checker in self.checkers:
            checker.run_checks()

    def run(self):
        """Run all the checkers.

        This will intelligently decide whether to run the checks in parallel
        or whether to run them in serial.

        If running the checks in parallel causes a problem (e.g.,
        https://gitlab.com/pycqa/flake8/issues/74) this also implements
        fallback to serial processing.
        """
        try:
            if self.using_multiprocessing:
                self.run_parallel()
            else:
                self.run_serial()
        except OSError as oserr:
            if oserr.errno not in SERIAL_RETRY_ERRNOS:
                LOG.exception(oserr)
                raise
            LOG.warning('Running in serial after OS exception, %r', oserr)
            self.run_serial()
        except KeyboardInterrupt:
            LOG.warning('Flake8 was interrupted by the user')
            raise exceptions.EarlyQuit('Early quit while running checks')
        finally:
            self._force_cleanup()

    def start(self, paths=None):
        """Start checking files.

        :param list paths:
            Path names to check. This is passed directly to
            :meth:`~Manager.make_checkers`.
        """
        LOG.info('Making checkers')
        self.make_checkers(paths)

    def stop(self):
        """Stop checking files."""
        self._process_statistics()
        for proc in self.processes:
            LOG.info('Joining %s to the main process', proc.name)
            proc.join()


class FileChecker(object):
    """Manage running checks for a file and aggregate the results."""

    def __init__(self, filename, checks, options):
        """Initialize our file checker.

        :param str filename:
            Name of the file to check.
        :param checks:
            The plugins registered to check the file.
        :type checks:
            dict
        :param options:
            Parsed option values from config and command-line.
        :type options:
            optparse.Values
        """
        self.options = options
        self.filename = filename
        self.checks = checks
        self.results = []
        self.statistics = {
            'tokens': 0,
            'logical lines': 0,
            'physical lines': 0,
        }
        self.processor = self._make_processor()
        self.display_name = filename
        self.should_process = False
        if self.processor is not None:
            self.display_name = self.processor.filename
            self.should_process = not self.processor.should_ignore_file()
            self.statistics['physical lines'] = len(self.processor.lines)

    def _make_processor(self):
        try:
            return processor.FileProcessor(self.filename, self.options)
        except IOError:
            # If we can not read the file due to an IOError (e.g., the file
            # does not exist or we do not have the permissions to open it)
            # then we need to format that exception for the user.
            # NOTE(sigmavirus24): Historically, pep8 has always reported this
            # as an E902. We probably *want* a better error code for this
            # going forward.
            (exc_type, exception) = sys.exc_info()[:2]
            message = '{0}: {1}'.format(exc_type.__name__, exception)
            self.report('E902', 0, 0, message)
            return None

    def report(self, error_code, line_number, column, text, line=None):
        # type: (str, int, int, str) -> str
        """Report an error by storing it in the results list."""
        if error_code is None:
            error_code, text = text.split(' ', 1)

        physical_line = line
        # If we're recovering from a problem in _make_processor, we will not
        # have this attribute.
        if not physical_line and getattr(self, 'processor', None):
            physical_line = self.processor.line_for(line_number)

        error = (error_code, line_number, column, text, physical_line)
        self.results.append(error)
        return error_code

    def run_check(self, plugin, **arguments):
        """Run the check in a single plugin."""
        LOG.debug('Running %r with %r', plugin, arguments)
        try:
            self.processor.keyword_arguments_for(
                plugin['parameters'],
                arguments,
            )
        except AttributeError as ae:
            LOG.error('Plugin requested unknown parameters.')
            raise exceptions.PluginRequestedUnknownParameters(
                plugin=plugin,
                exception=ae,
            )
        return plugin['plugin'](**arguments)

    @staticmethod
    def _extract_syntax_information(exception):
        token = ()
        if len(exception.args) > 1:
            token = exception.args[1]
            if len(token) > 2:
                row, column = token[1:3]
        else:
            row, column = (1, 0)

        if column > 0 and token and isinstance(exception, SyntaxError):
            # NOTE(sigmavirus24): SyntaxErrors report 1-indexed column
            # numbers. We need to decrement the column number by 1 at
            # least.
            column_offset = 1
            row_offset = 0
            # See also: https://gitlab.com/pycqa/flake8/issues/237
            physical_line = token[-1]

            # NOTE(sigmavirus24): Not all "tokens" have a string as the last
            # argument. In this event, let's skip trying to find the correct
            # column and row values.
            if physical_line is not None:
                # NOTE(sigmavirus24): SyntaxErrors also don't exactly have a
                # "physical" line so much as what was accumulated by the point
                # tokenizing failed.
                # See also: https://gitlab.com/pycqa/flake8/issues/237
                lines = physical_line.rstrip('\n').split('\n')
                row_offset = len(lines) - 1
                logical_line = lines[0]
                logical_line_length = len(logical_line)
                if column > logical_line_length:
                    column = logical_line_length
            row -= row_offset
            column -= column_offset
        return row, column

    def run_ast_checks(self):
        """Run all checks expecting an abstract syntax tree."""
        try:
            ast = self.processor.build_ast()
        except (ValueError, SyntaxError, TypeError):
            (exc_type, exception) = sys.exc_info()[:2]
            row, column = self._extract_syntax_information(exception)
            self.report('E999', row, column, '%s: %s' %
                        (exc_type.__name__, exception.args[0]))
            return

        for plugin in self.checks['ast_plugins']:
            checker = self.run_check(plugin, tree=ast)
            # If the plugin uses a class, call the run method of it, otherwise
            # the call should return something iterable itself
            try:
                runner = checker.run()
            except AttributeError:
                runner = checker
            for (line_number, offset, text, check) in runner:
                self.report(
                    error_code=None,
                    line_number=line_number,
                    column=offset,
                    text=text,
                )

    def run_logical_checks(self):
        """Run all checks expecting a logical line."""
        comments, logical_line, mapping = self.processor.build_logical_line()
        if not mapping:
            return
        self.processor.update_state(mapping)

        LOG.debug('Logical line: "%s"', logical_line.rstrip())

        for plugin in self.checks['logical_line_plugins']:
            self.processor.update_checker_state_for(plugin)
            results = self.run_check(plugin, logical_line=logical_line) or ()
            for offset, text in results:
                offset = find_offset(offset, mapping)
                line_number, column_offset = offset
                self.report(
                    error_code=None,
                    line_number=line_number,
                    column=column_offset,
                    text=text,
                )

        self.processor.next_logical_line()

    def run_physical_checks(self, physical_line, override_error_line=None):
        """Run all checks for a given physical line."""
        for plugin in self.checks['physical_line_plugins']:
            self.processor.update_checker_state_for(plugin)
            result = self.run_check(plugin, physical_line=physical_line)
            if result is not None:
                column_offset, text = result
                error_code = self.report(
                    error_code=None,
                    line_number=self.processor.line_number,
                    column=column_offset,
                    text=text,
                    line=(override_error_line or physical_line),
                )

                self.processor.check_physical_error(error_code, physical_line)

    def process_tokens(self):
        """Process tokens and trigger checks.

        This can raise a :class:`flake8.exceptions.InvalidSyntax` exception.
        Instead of using this directly, you should use
        :meth:`flake8.checker.FileChecker.run_checks`.
        """
        parens = 0
        statistics = self.statistics
        file_processor = self.processor
        for token in file_processor.generate_tokens():
            statistics['tokens'] += 1
            self.check_physical_eol(token)
            token_type, text = token[0:2]
            processor.log_token(LOG, token)
            if token_type == tokenize.OP:
                parens = processor.count_parentheses(parens, text)
            elif parens == 0:
                if processor.token_is_newline(token):
                    self.handle_newline(token_type)
                elif (processor.token_is_comment(token) and
                        len(file_processor.tokens) == 1):
                    self.handle_comment(token, text)

        if file_processor.tokens:
            # If any tokens are left over, process them
            self.run_physical_checks(file_processor.lines[-1])
            self.run_logical_checks()

    def run_checks(self):
        """Run checks against the file."""
        try:
            self.process_tokens()
        except exceptions.InvalidSyntax as exc:
            self.report(exc.error_code, exc.line_number, exc.column_number,
                        exc.error_message)

        self.run_ast_checks()

        logical_lines = self.processor.statistics['logical lines']
        self.statistics['logical lines'] = logical_lines
        return self.filename, self.results, self.statistics

    def handle_comment(self, token, token_text):
        """Handle the logic when encountering a comment token."""
        # The comment also ends a physical line
        token = list(token)
        token[1] = token_text.rstrip('\r\n')
        token[3] = (token[2][0], token[2][1] + len(token[1]))
        self.processor.tokens = [tuple(token)]
        self.run_logical_checks()

    def handle_newline(self, token_type):
        """Handle the logic when encountering a newline token."""
        if token_type == tokenize.NEWLINE:
            self.run_logical_checks()
            self.processor.reset_blank_before()
        elif len(self.processor.tokens) == 1:
            # The physical line contains only this token.
            self.processor.visited_new_blank_line()
            self.processor.delete_first_token()
        else:
            self.run_logical_checks()

    def check_physical_eol(self, token):
        """Run physical checks if and only if it is at the end of the line."""
        if processor.is_eol_token(token):
            # Obviously, a newline token ends a single physical line.
            self.run_physical_checks(token[4])
        elif processor.is_multiline_string(token):
            # Less obviously, a string that contains newlines is a
            # multiline string, either triple-quoted or with internal
            # newlines backslash-escaped. Check every physical line in the
            # string *except* for the last one: its newline is outside of
            # the multiline string, so we consider it a regular physical
            # line, and will check it like any other physical line.
            #
            # Subtleties:
            # - have to wind self.line_number back because initially it
            #   points to the last line of the string, and we want
            #   check_physical() to give accurate feedback
            line_no = token[2][0]
            with self.processor.inside_multiline(line_number=line_no):
                for line in self.processor.split_line(token):
                    self.run_physical_checks(line + '\n',
                                             override_error_line=token[4])


def _pool_init():
    """Ensure correct signaling of ^C using multiprocessing.Pool."""
    signal.signal(signal.SIGINT, signal.SIG_IGN)


def calculate_pool_chunksize(num_checkers, num_jobs):
    """Determine the chunksize for the multiprocessing Pool.

    - For chunksize, see: https://docs.python.org/3/library/multiprocessing.html#multiprocessing.pool.Pool.imap  # noqa
    - This formula, while not perfect, aims to give each worker two batches of
      work.
    - See: https://gitlab.com/pycqa/flake8/merge_requests/156#note_18878876
    - See: https://gitlab.com/pycqa/flake8/issues/265
    """
    return max(num_checkers // (num_jobs * 2), 1)


def _run_checks(checker):
    return checker.run_checks()


def find_offset(offset, mapping):
    """Find the offset tuple for a single offset."""
    if isinstance(offset, tuple):
        return offset

    for token_offset, position in mapping:
        if offset <= token_offset:
            break
    return (position[0], position[1] + offset - token_offset)
