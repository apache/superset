"""Module containing the application logic for Flake8."""
from __future__ import print_function

import logging
import sys
import time

import flake8
from flake8 import checker
from flake8 import defaults
from flake8 import exceptions
from flake8 import style_guide
from flake8 import utils
from flake8.main import options
from flake8.options import aggregator
from flake8.options import manager
from flake8.plugins import manager as plugin_manager

LOG = logging.getLogger(__name__)


class Application(object):
    """Abstract our application into a class."""

    def __init__(self, program='flake8', version=flake8.__version__):
        # type: (str, str) -> NoneType
        """Initialize our application.

        :param str program:
            The name of the program/application that we're executing.
        :param str version:
            The version of the program/application we're executing.
        """
        #: The timestamp when the Application instance was instantiated.
        self.start_time = time.time()
        #: The timestamp when the Application finished reported errors.
        self.end_time = None
        #: The name of the program being run
        self.program = program
        #: The version of the program being run
        self.version = version
        #: The instance of :class:`flake8.options.manager.OptionManager` used
        #: to parse and handle the options and arguments passed by the user
        self.option_manager = manager.OptionManager(
            prog='flake8', version=flake8.__version__
        )
        options.register_default_options(self.option_manager)

        # We haven't found or registered our plugins yet, so let's defer
        # printing the version until we aggregate options from config files
        # and the command-line. First, let's clone our arguments on the CLI,
        # then we'll attempt to remove ``--version`` so that we can avoid
        # triggering the "version" action in optparse. If it's not there, we
        # do not need to worry and we can continue. If it is, we successfully
        # defer printing the version until just a little bit later.
        # Similarly we have to defer printing the help text until later.
        args = sys.argv[:]
        try:
            args.remove('--version')
        except ValueError:
            pass
        try:
            args.remove('--help')
        except ValueError:
            pass
        try:
            args.remove('-h')
        except ValueError:
            pass

        preliminary_opts, _ = self.option_manager.parse_known_args(args)
        # Set the verbosity of the program
        flake8.configure_logging(preliminary_opts.verbose,
                                 preliminary_opts.output_file)

        #: The instance of :class:`flake8.plugins.manager.Checkers`
        self.check_plugins = None
        #: The instance of :class:`flake8.plugins.manager.Listeners`
        self.listening_plugins = None
        #: The instance of :class:`flake8.plugins.manager.ReportFormatters`
        self.formatting_plugins = None
        #: The user-selected formatter from :attr:`formatting_plugins`
        self.formatter = None
        #: The :class:`flake8.plugins.notifier.Notifier` for listening plugins
        self.listener_trie = None
        #: The :class:`flake8.style_guide.StyleGuide` built from the user's
        #: options
        self.guide = None
        #: The :class:`flake8.checker.Manager` that will handle running all of
        #: the checks selected by the user.
        self.file_checker_manager = None

        #: The user-supplied options parsed into an instance of
        #: :class:`optparse.Values`
        self.options = None
        #: The left over arguments that were not parsed by
        #: :attr:`option_manager`
        self.args = None
        #: The number of errors, warnings, and other messages after running
        #: flake8 and taking into account ignored errors and lines.
        self.result_count = 0
        #: The total number of errors before accounting for ignored errors and
        #: lines.
        self.total_result_count = 0
        #: Whether or not something catastrophic happened and we should exit
        #: with a non-zero status code
        self.catastrophic_failure = False

        #: Whether the program is processing a diff or not
        self.running_against_diff = False
        #: The parsed diff information
        self.parsed_diff = {}

    def exit(self):
        # type: () -> NoneType
        """Handle finalization and exiting the program.

        This should be the last thing called on the application instance. It
        will check certain options and exit appropriately.
        """
        if self.options.count:
            print(self.result_count)

        if not self.options.exit_zero:
            raise SystemExit((self.result_count > 0) or
                             self.catastrophic_failure)

    def find_plugins(self):
        # type: () -> NoneType
        """Find and load the plugins for this application.

        If :attr:`check_plugins`, :attr:`listening_plugins`, or
        :attr:`formatting_plugins` are ``None`` then this method will update
        them with the appropriate plugin manager instance. Given the expense
        of finding plugins (via :mod:`pkg_resources`) we want this to be
        idempotent and so only update those attributes if they are ``None``.
        """
        if self.check_plugins is None:
            self.check_plugins = plugin_manager.Checkers()

        if self.listening_plugins is None:
            self.listening_plugins = plugin_manager.Listeners()

        if self.formatting_plugins is None:
            self.formatting_plugins = plugin_manager.ReportFormatters()

        self.check_plugins.load_plugins()
        self.listening_plugins.load_plugins()
        self.formatting_plugins.load_plugins()

    def register_plugin_options(self):
        # type: () -> NoneType
        """Register options provided by plugins to our option manager."""
        self.check_plugins.register_options(self.option_manager)
        self.check_plugins.register_plugin_versions(self.option_manager)
        self.listening_plugins.register_options(self.option_manager)
        self.formatting_plugins.register_options(self.option_manager)

    def parse_configuration_and_cli(self, argv=None):
        # type: (Union[NoneType, List[str]]) -> NoneType
        """Parse configuration files and the CLI options.

        :param list argv:
            Command-line arguments passed in directly.
        """
        if self.options is None and self.args is None:
            self.options, self.args = aggregator.aggregate_options(
                self.option_manager, argv
            )

        self.running_against_diff = self.options.diff
        if self.running_against_diff:
            self.parsed_diff = utils.parse_unified_diff()
            if not self.parsed_diff:
                self.exit()

        self.options._running_from_vcs = False

        self.check_plugins.provide_options(self.option_manager, self.options,
                                           self.args)
        self.listening_plugins.provide_options(self.option_manager,
                                               self.options,
                                               self.args)
        self.formatting_plugins.provide_options(self.option_manager,
                                                self.options,
                                                self.args)

    def make_formatter(self, formatter_class=None):
        # type: () -> NoneType
        """Initialize a formatter based on the parsed options."""
        if self.formatter is None:
            format_plugin = self.options.format
            if 1 <= self.options.quiet < 2:
                format_plugin = 'quiet-filename'
            elif 2 <= self.options.quiet:
                format_plugin = 'quiet-nothing'

            if formatter_class is None:
                formatter_class = self.formatting_plugins.get(
                    format_plugin, self.formatting_plugins['default']
                ).execute

            self.formatter = formatter_class(self.options)

    def make_notifier(self):
        # type: () -> NoneType
        """Initialize our listener Notifier."""
        if self.listener_trie is None:
            self.listener_trie = self.listening_plugins.build_notifier()

    def make_guide(self):
        # type: () -> NoneType
        """Initialize our StyleGuide."""
        if self.guide is None:
            self.guide = style_guide.StyleGuide(
                self.options, self.listener_trie, self.formatter
            )

        if self.running_against_diff:
            self.guide.add_diff_ranges(self.parsed_diff)

    def make_file_checker_manager(self):
        # type: () -> NoneType
        """Initialize our FileChecker Manager."""
        if self.file_checker_manager is None:
            self.file_checker_manager = checker.Manager(
                style_guide=self.guide,
                arguments=self.args,
                checker_plugins=self.check_plugins,
            )

    def run_checks(self, files=None):
        # type: (Union[List[str], NoneType]) -> NoneType
        """Run the actual checks with the FileChecker Manager.

        This method encapsulates the logic to make a
        :class:`~flake8.checker.Manger` instance run the checks it is
        managing.

        :param list files:
            List of filenames to process
        """
        if self.running_against_diff:
            files = list(sorted(self.parsed_diff.keys()))
        self.file_checker_manager.start(files)
        self.file_checker_manager.run()
        LOG.info('Finished running')
        self.file_checker_manager.stop()
        self.end_time = time.time()

    def report_benchmarks(self):
        """Aggregate, calculate, and report benchmarks for this run."""
        if not self.options.benchmark:
            return

        time_elapsed = self.end_time - self.start_time
        statistics = [('seconds elapsed', time_elapsed)]
        add_statistic = statistics.append
        for statistic in (defaults.STATISTIC_NAMES + ('files',)):
            value = self.file_checker_manager.statistics[statistic]
            total_description = 'total ' + statistic + ' processed'
            add_statistic((total_description, value))
            per_second_description = statistic + ' processed per second'
            add_statistic((per_second_description, int(value / time_elapsed)))

        self.formatter.show_benchmarks(statistics)

    def report_errors(self):
        # type: () -> NoneType
        """Report all the errors found by flake8 3.0.

        This also updates the :attr:`result_count` attribute with the total
        number of errors, warnings, and other messages found.
        """
        LOG.info('Reporting errors')
        results = self.file_checker_manager.report()
        self.total_result_count, self.result_count = results
        LOG.info('Found a total of %d violations and reported %d',
                 self.total_result_count, self.result_count)

    def report_statistics(self):
        """Aggregate and report statistics from this run."""
        if not self.options.statistics:
            return

        self.formatter.show_statistics(self.guide.stats)

    def initialize(self, argv):
        # type: () -> NoneType
        """Initialize the application to be run.

        This finds the plugins, registers their options, and parses the
        command-line arguments.
        """
        # NOTE(sigmavirus24): When updating this, make sure you also update
        # our legacy API calls to these same methods.
        self.find_plugins()
        self.register_plugin_options()
        self.parse_configuration_and_cli(argv)
        self.make_formatter()
        self.make_notifier()
        self.make_guide()
        self.make_file_checker_manager()

    def report(self):
        """Report errors, statistics, and benchmarks."""
        self.formatter.start()
        self.report_errors()
        self.report_statistics()
        self.report_benchmarks()
        self.formatter.stop()

    def _run(self, argv):
        # type: (Union[NoneType, List[str]]) -> NoneType
        self.initialize(argv)
        self.run_checks()
        self.report()

    def run(self, argv=None):
        # type: (Union[NoneType, List[str]]) -> NoneType
        """Run our application.

        This method will also handle KeyboardInterrupt exceptions for the
        entirety of the flake8 application. If it sees a KeyboardInterrupt it
        will forcibly clean up the :class:`~flake8.checker.Manager`.
        """
        try:
            self._run(argv)
        except KeyboardInterrupt as exc:
            print('... stopped')
            LOG.critical('Caught keyboard interrupt from user')
            LOG.exception(exc)
            self.file_checker_manager._force_cleanup()
            self.catastrophic_failure = True
        except exceptions.EarlyQuit:
            self.catastrophic_failure = True
            print('... stopped while processing files')
