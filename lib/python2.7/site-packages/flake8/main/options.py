"""Contains the logic for all of the default options for Flake8."""
from flake8 import defaults
from flake8.main import debug
from flake8.main import vcs


def register_default_options(option_manager):
    """Register the default options on our OptionManager.

    The default options include:

    - ``-v``/``--verbose``
    - ``-q``/``--quiet``
    - ``--count``
    - ``--diff``
    - ``--exclude``
    - ``--filename``
    - ``--format``
    - ``--hang-closing``
    - ``--ignore``
    - ``--max-line-length``
    - ``--select``
    - ``--disable-noqa``
    - ``--show-source``
    - ``--statistics``
    - ``--enable-extensions``
    - ``--exit-zero``
    - ``-j``/``--jobs``
    - ``--output-file``
    - ``--tee``
    - ``--append-config``
    - ``--config``
    - ``--isolated``
    - ``--benchmark``
    - ``--bug-report``
    """
    add_option = option_manager.add_option

    # pep8 options
    add_option(
        '-v', '--verbose', default=0, action='count',
        parse_from_config=True,
        help='Print more information about what is happening in flake8.'
             ' This option is repeatable and will increase verbosity each '
             'time it is repeated.',
    )
    add_option(
        '-q', '--quiet', default=0, action='count',
        parse_from_config=True,
        help='Report only file names, or nothing. This option is repeatable.',
    )

    add_option(
        '--count', action='store_true', parse_from_config=True,
        help='Print total number of errors and warnings to standard error and'
             ' set the exit code to 1 if total is not empty.',
    )

    add_option(
        '--diff', action='store_true',
        help='Report changes only within line number ranges in the unified '
             'diff provided on standard in by the user.',
    )

    add_option(
        '--exclude', metavar='patterns', default=','.join(defaults.EXCLUDE),
        comma_separated_list=True, parse_from_config=True,
        normalize_paths=True,
        help='Comma-separated list of files or directories to exclude.'
             ' (Default: %default)',
    )

    add_option(
        '--filename', metavar='patterns', default='*.py',
        parse_from_config=True, comma_separated_list=True,
        help='Only check for filenames matching the patterns in this comma-'
             'separated list. (Default: %default)',
    )

    add_option(
        '--stdin-display-name', default='stdin',
        help='The name used when reporting errors from code passed via stdin.'
             ' This is useful for editors piping the file contents to flake8.'
             ' (Default: %default)',
    )

    # TODO(sigmavirus24): Figure out --first/--repeat

    # NOTE(sigmavirus24): We can't use choices for this option since users can
    # freely provide a format string and that will break if we restrict their
    # choices.
    add_option(
        '--format', metavar='format', default='default',
        parse_from_config=True,
        help='Format errors according to the chosen formatter.',
    )

    add_option(
        '--hang-closing', action='store_true', parse_from_config=True,
        help='Hang closing bracket instead of matching indentation of opening'
             " bracket's line.",
    )

    add_option(
        '--ignore', metavar='errors', default=','.join(defaults.IGNORE),
        parse_from_config=True, comma_separated_list=True,
        help='Comma-separated list of errors and warnings to ignore (or skip).'
             ' For example, ``--ignore=E4,E51,W234``. (Default: %default)',
    )

    add_option(
        '--max-line-length', type='int', metavar='n',
        default=defaults.MAX_LINE_LENGTH, parse_from_config=True,
        help='Maximum allowed line length for the entirety of this run. '
             '(Default: %default)',
    )

    add_option(
        '--select', metavar='errors', default=','.join(defaults.SELECT),
        parse_from_config=True, comma_separated_list=True,
        help='Comma-separated list of errors and warnings to enable.'
             ' For example, ``--select=E4,E51,W234``. (Default: %default)',
    )

    add_option(
        '--disable-noqa', default=False, parse_from_config=True,
        action='store_true',
        help='Disable the effect of "# noqa". This will report errors on '
             'lines with "# noqa" at the end.'
    )

    # TODO(sigmavirus24): Decide what to do about --show-pep8

    add_option(
        '--show-source', action='store_true', parse_from_config=True,
        help='Show the source generate each error or warning.',
    )

    add_option(
        '--statistics', action='store_true', parse_from_config=True,
        help='Count errors and warnings.',
    )

    # Flake8 options
    add_option(
        '--enable-extensions', default='', parse_from_config=True,
        comma_separated_list=True, type='string',
        help='Enable plugins and extensions that are otherwise disabled '
             'by default',
    )

    add_option(
        '--exit-zero', action='store_true',
        help='Exit with status code "0" even if there are errors.',
    )

    add_option(
        '--install-hook', action='callback', type='choice',
        choices=vcs.choices(), callback=vcs.install,
        help='Install a hook that is run prior to a commit for the supported '
             'version control system.'
    )

    add_option(
        '-j', '--jobs', type='string', default='auto', parse_from_config=True,
        help='Number of subprocesses to use to run checks in parallel. '
             'This is ignored on Windows. The default, "auto", will '
             'auto-detect the number of processors available to use.'
             ' (Default: %default)',
    )

    add_option(
        '--output-file', default=None, type='string', parse_from_config=True,
        # callback=callbacks.redirect_stdout,
        help='Redirect report to a file.',
    )

    add_option(
        '--tee', default=False, parse_from_config=True, action='store_true',
        help='Write to stdout and output-file.',
    )

    # Config file options

    add_option(
        '--append-config', action='append',
        help='Provide extra config files to parse in addition to the files '
             'found by Flake8 by default. These files are the last ones read '
             'and so they take the highest precedence when multiple files '
             'provide the same option.',
    )

    add_option(
        '--config', default=None,
        help='Path to the config file that will be the authoritative config '
             'source. This will cause Flake8 to ignore all other '
             'configuration files.'
    )

    add_option(
        '--isolated', default=False, action='store_true',
        help='Ignore all found configuration files.',
    )

    # Benchmarking

    add_option(
        '--benchmark', default=False, action='store_true',
        help='Print benchmark information about this run of Flake8',
    )

    # Debugging

    add_option(
        '--bug-report', action='callback', callback=debug.print_information,
        callback_kwargs={'option_manager': option_manager},
        help='Print information necessary when preparing a bug report',
    )
