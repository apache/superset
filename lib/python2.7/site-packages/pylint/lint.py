# Copyright (c) 2006-2015 LOGILAB S.A. (Paris, FRANCE) <contact@logilab.fr>
# Copyright (c) 2011-2014 Google, Inc.
# Copyright (c) 2012 FELD Boris <lothiraldan@gmail.com>
# Copyright (c) 2014-2016 Claudiu Popa <pcmanticore@gmail.com>
# Copyright (c) 2014-2015 Michal Nowikowski <godfryd@gmail.com>
# Copyright (c) 2015 Mihai Balint <balint.mihai@gmail.com>
# Copyright (c) 2015 Simu Toni <simutoni@gmail.com>
# Copyright (c) 2015 Aru Sahni <arusahni@gmail.com>
# Copyright (c) 2015-2016 Florian Bruhin <me@the-compiler.org>
# Copyright (c) 2016 Glenn Matthews <glenn@e-dad.net>

# Licensed under the GPL: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
# For details: https://github.com/PyCQA/pylint/blob/master/COPYING

""" %prog [options] module_or_package

  Check that a module satisfies a coding standard (and more !).

    %prog --help

  Display this help message and exit.

    %prog --help-msg <msg-id>[,<msg-id>]

  Display help messages about given message identifiers and exit.
"""
from __future__ import print_function

import collections
import contextlib
import operator
import os
try:
    import multiprocessing
except ImportError:
    multiprocessing = None
import sys
import tokenize
import warnings

import six

import astroid
from astroid.__pkginfo__ import version as astroid_version
from astroid import modutils
from pylint import checkers
from pylint import interfaces
from pylint import reporters
from pylint import exceptions
from pylint import utils
from pylint import config
from pylint.__pkginfo__ import version
from pylint.reporters.ureports import nodes as report_nodes


MANAGER = astroid.MANAGER


def _get_new_args(message):
    location = (
        message.abspath,
        message.path,
        message.module,
        message.obj,
        message.line,
        message.column,
    )
    return (
        message.msg_id,
        message.symbol,
        location,
        message.msg,
        message.confidence,
    )

def _get_python_path(filepath):
    dirname = os.path.realpath(os.path.expanduser(filepath))
    if not os.path.isdir(dirname):
        dirname = os.path.dirname(dirname)
    while True:
        if not os.path.exists(os.path.join(dirname, "__init__.py")):
            return dirname
        old_dirname = dirname
        dirname = os.path.dirname(dirname)
        if old_dirname == dirname:
            return os.getcwd()


def _merge_stats(stats):
    merged = {}
    by_msg = collections.Counter()
    for stat in stats:
        message_stats = stat.pop('by_msg', {})
        by_msg.update(message_stats)

        for key, item in six.iteritems(stat):
            if key not in merged:
                merged[key] = item
            else:
                if isinstance(item, dict):
                    merged[key].update(item)
                else:
                    merged[key] = merged[key] + item

    merged['by_msg'] = by_msg
    return merged


@contextlib.contextmanager
def _patch_sysmodules():
    # Context manager that permits running pylint, on Windows, with -m switch
    # and with --jobs, as in 'python -2 -m pylint .. --jobs'.
    # For more details why this is needed,
    # see Python issue http://bugs.python.org/issue10845.

    mock_main = __name__ != '__main__' # -m switch
    if mock_main:
        sys.modules['__main__'] = sys.modules[__name__]

    try:
        yield
    finally:
        if mock_main:
            sys.modules.pop('__main__')


# Python Linter class #########################################################

MSGS = {
    'F0001': ('%s',
              'fatal',
              'Used when an error occurred preventing the analysis of a \
              module (unable to find it for instance).'),
    'F0002': ('%s: %s',
              'astroid-error',
              'Used when an unexpected error occurred while building the '
              'Astroid  representation. This is usually accompanied by a '
              'traceback. Please report such errors !'),
    'F0010': ('error while code parsing: %s',
              'parse-error',
              'Used when an exception occurred while building the Astroid '
              'representation which could be handled by astroid.'),

    'I0001': ('Unable to run raw checkers on built-in module %s',
              'raw-checker-failed',
              'Used to inform that a built-in module has not been checked '
              'using the raw checkers.'),

    'I0010': ('Unable to consider inline option %r',
              'bad-inline-option',
              'Used when an inline option is either badly formatted or can\'t '
              'be used inside modules.'),

    'I0011': ('Locally disabling %s (%s)',
              'locally-disabled',
              'Used when an inline option disables a message or a messages '
              'category.'),
    'I0012': ('Locally enabling %s (%s)',
              'locally-enabled',
              'Used when an inline option enables a message or a messages '
              'category.'),
    'I0013': ('Ignoring entire file',
              'file-ignored',
              'Used to inform that the file will not be checked'),
    'I0020': ('Suppressed %s (from line %d)',
              'suppressed-message',
              'A message was triggered on a line, but suppressed explicitly '
              'by a disable= comment in the file. This message is not '
              'generated for messages that are ignored due to configuration '
              'settings.'),
    'I0021': ('Useless suppression of %s',
              'useless-suppression',
              'Reported when a message is explicitly disabled for a line or '
              'a block of code, but never triggered.'),
    'I0022': ('Pragma "%s" is deprecated, use "%s" instead',
              'deprecated-pragma',
              'Some inline pylint options have been renamed or reworked, '
              'only the most recent form should be used. '
              'NOTE:skip-all is only available with pylint >= 0.26',
              {'old_names': [('I0014', 'deprecated-disable-all')]}),

    'E0001': ('%s',
              'syntax-error',
              'Used when a syntax error is raised for a module.'),

    'E0011': ('Unrecognized file option %r',
              'unrecognized-inline-option',
              'Used when an unknown inline option is encountered.'),
    'E0012': ('Bad option value %r',
              'bad-option-value',
              'Used when a bad value for an inline option is encountered.'),
    }


if multiprocessing is not None:
    class ChildLinter(multiprocessing.Process):
        def run(self):
            # pylint: disable=no-member, unbalanced-tuple-unpacking
            tasks_queue, results_queue, self._config = self._args

            self._config["jobs"] = 1  # Child does not parallelize any further.
            self._python3_porting_mode = self._config.pop(
                'python3_porting_mode', None)
            self._plugins = self._config.pop('plugins', None)

            # Run linter for received files/modules.
            for file_or_module in iter(tasks_queue.get, 'STOP'):
                result = self._run_linter(file_or_module[0])
                try:
                    results_queue.put(result)
                except Exception as ex:
                    print("internal error with sending report for module %s" %
                          file_or_module, file=sys.stderr)
                    print(ex, file=sys.stderr)
                    results_queue.put({})

        def _run_linter(self, file_or_module):
            linter = PyLinter()

            # Register standard checkers.
            linter.load_default_plugins()
            # Load command line plugins.
            if self._plugins:
                linter.load_plugin_modules(self._plugins)

            linter.load_configuration_from_config(self._config)
            linter.set_reporter(reporters.CollectingReporter())

            # Enable the Python 3 checker mode. This option is
            # passed down from the parent linter up to here, since
            # the Python 3 porting flag belongs to the Run class,
            # instead of the Linter class.
            if self._python3_porting_mode:
                linter.python3_porting_mode()

            # Run the checks.
            linter.check(file_or_module)

            msgs = [_get_new_args(m) for m in linter.reporter.messages]
            return (file_or_module, linter.file_state.base_name, linter.current_name,
                    msgs, linter.stats, linter.msg_status)


class PyLinter(config.OptionsManagerMixIn,
               utils.MessagesHandlerMixIn,
               utils.ReportsHandlerMixIn,
               checkers.BaseTokenChecker):
    """lint Python modules using external checkers.

    This is the main checker controlling the other ones and the reports
    generation. It is itself both a raw checker and an astroid checker in order
    to:
    * handle message activation / deactivation at the module level
    * handle some basic but necessary stats'data (number of classes, methods...)

    IDE plugin developers: you may have to call
    `astroid.builder.MANAGER.astroid_cache.clear()` across runs if you want
    to ensure the latest code version is actually checked.
    """

    __implements__ = (interfaces.ITokenChecker, )

    name = 'master'
    priority = 0
    level = 0
    msgs = MSGS

    @staticmethod
    def make_options():
        return (('ignore',
                 {'type' : 'csv', 'metavar' : '<file>[,<file>...]',
                  'dest' : 'black_list', 'default' : ('CVS',),
                  'help' : 'Add files or directories to the blacklist. '
                           'They should be base names, not paths.'}),

                ('ignore-patterns',
                 {'type' : 'regexp_csv', 'metavar' : '<pattern>[,<pattern>...]',
                  'dest' : 'black_list_re', 'default' : (),
                  'help' : 'Add files or directories matching the regex patterns to the'
                           ' blacklist. The regex matches against base names, not paths.'}),

                ('persistent',
                 {'default': True, 'type' : 'yn', 'metavar' : '<y_or_n>',
                  'level': 1,
                  'help' : 'Pickle collected data for later comparisons.'}),

                ('load-plugins',
                 {'type' : 'csv', 'metavar' : '<modules>', 'default' : (),
                  'level': 1,
                  'help' : 'List of plugins (as comma separated values of '
                           'python modules names) to load, usually to register '
                           'additional checkers.'}),

                ('output-format',
                 {'default': 'text', 'type': 'string', 'metavar' : '<format>',
                  'short': 'f',
                  'group': 'Reports',
                  'help' : 'Set the output format. Available formats are text,'
                           ' parseable, colorized, json and msvs (visual studio).'
                           'You can also give a reporter class, eg mypackage.mymodule.'
                           'MyReporterClass.'}),

                ('reports',
                 {'default': False, 'type' : 'yn', 'metavar' : '<y_or_n>',
                  'short': 'r',
                  'group': 'Reports',
                  'help' : 'Tells whether to display a full report or only the '
                           'messages'}),

                ('evaluation',
                 {'type' : 'string', 'metavar' : '<python_expression>',
                  'group': 'Reports', 'level': 1,
                  'default': '10.0 - ((float(5 * error + warning + refactor + '
                             'convention) / statement) * 10)',
                  'help' : 'Python expression which should return a note less '
                           'than 10 (10 is the highest note). You have access '
                           'to the variables errors warning, statement which '
                           'respectively contain the number of errors / '
                           'warnings messages and the total number of '
                           'statements analyzed. This is used by the global '
                           'evaluation report (RP0004).'}),
                ('score',
                 {'default': True, 'type': 'yn', 'metavar': '<y_or_n>',
                  'short': 's',
                  'group': 'Reports',
                  'help': 'Activate the evaluation score.'}),

                ('confidence',
                 {'type' : 'multiple_choice', 'metavar': '<levels>',
                  'default': '',
                  'choices': [c.name for c in interfaces.CONFIDENCE_LEVELS],
                  'group': 'Messages control',
                  'help' : 'Only show warnings with the listed confidence levels.'
                           ' Leave empty to show all. Valid levels: %s' % (
                               ', '.join(c.name for c in interfaces.CONFIDENCE_LEVELS),)}),

                ('enable',
                 {'type' : 'csv', 'metavar': '<msg ids>',
                  'short': 'e',
                  'group': 'Messages control',
                  'help' : 'Enable the message, report, category or checker with the '
                           'given id(s). You can either give multiple identifier '
                           'separated by comma (,) or put this option multiple time '
                           '(only on the command line, not in the configuration file '
                           'where it should appear only once). '
                           'See also the "--disable" option for examples. '}),

                ('disable',
                 {'type' : 'csv', 'metavar': '<msg ids>',
                  'short': 'd',
                  'group': 'Messages control',
                  'help' : 'Disable the message, report, category or checker '
                           'with the given id(s). You can either give multiple identifiers'
                           ' separated by comma (,) or put this option multiple times '
                           '(only on the command line, not in the configuration file '
                           'where it should appear only once).'
                           'You can also use "--disable=all" to disable everything first '
                           'and then reenable specific checks. For example, if you want '
                           'to run only the similarities checker, you can use '
                           '"--disable=all --enable=similarities". '
                           'If you want to run only the classes checker, but have no '
                           'Warning level messages displayed, use'
                           '"--disable=all --enable=classes --disable=W"'}),

                ('msg-template',
                 {'type' : 'string', 'metavar': '<template>',
                  'group': 'Reports',
                  'help' : ('Template used to display messages. '
                            'This is a python new-style format string '
                            'used to format the message information. '
                            'See doc for all details')
                 }),

                ('jobs',
                 {'type' : 'int', 'metavar': '<n-processes>',
                  'short': 'j',
                  'default': 1,
                  'help' : '''Use multiple processes to speed up Pylint.''',
                 }),

                ('unsafe-load-any-extension',
                 {'type': 'yn', 'metavar': '<yn>', 'default': False, 'hide': True,
                  'help': ('Allow loading of arbitrary C extensions. Extensions'
                           ' are imported into the active Python interpreter and'
                           ' may run arbitrary code.')}),

                ('extension-pkg-whitelist',
                 {'type': 'csv', 'metavar': '<pkg[,pkg]>', 'default': [],
                  'help': ('A comma-separated list of package or module names'
                           ' from where C extensions may be loaded. Extensions are'
                           ' loading into the active Python interpreter and may run'
                           ' arbitrary code')}
                ),
               )

    option_groups = (
        ('Messages control', 'Options controlling analysis messages'),
        ('Reports', 'Options related to output formatting and reporting'),
        )

    def __init__(self, options=(), reporter=None, option_groups=(),
                 pylintrc=None):
        # some stuff has to be done before ancestors initialization...
        #
        # messages store / checkers / reporter / astroid manager
        self.msgs_store = utils.MessagesStore()
        self.reporter = None
        self._reporter_name = None
        self._reporters = {}
        self._checkers = collections.defaultdict(list)
        self._pragma_lineno = {}
        self._ignore_file = False
        # visit variables
        self.file_state = utils.FileState()
        self.current_name = None
        self.current_file = None
        self.stats = None
        # init options
        self._external_opts = options
        self.options = options + PyLinter.make_options()
        self.option_groups = option_groups + PyLinter.option_groups
        self._options_methods = {
            'enable': self.enable,
            'disable': self.disable}
        self._bw_options_methods = {'disable-msg': self.disable,
                                    'enable-msg': self.enable}
        full_version = '%%prog %s, \nastroid %s\nPython %s' % (
            version, astroid_version, sys.version)
        utils.MessagesHandlerMixIn.__init__(self)
        utils.ReportsHandlerMixIn.__init__(self)
        super(PyLinter, self).__init__(
            usage=__doc__,
            version=full_version,
            config_file=pylintrc or config.PYLINTRC)
        checkers.BaseTokenChecker.__init__(self)
        # provided reports
        self.reports = (('RP0001', 'Messages by category',
                         report_total_messages_stats),
                        ('RP0002', '% errors / warnings by module',
                         report_messages_by_module_stats),
                        ('RP0003', 'Messages',
                         report_messages_stats),
                       )
        self.register_checker(self)
        self._dynamic_plugins = set()
        self._python3_porting_mode = False
        self._error_mode = False
        self.load_provider_defaults()
        if reporter:
            self.set_reporter(reporter)

    def load_default_plugins(self):
        checkers.initialize(self)
        reporters.initialize(self)
        # Make sure to load the default reporter, because
        # the option has been set before the plugins had been loaded.
        if not self.reporter:
            self._load_reporter()

    def load_plugin_modules(self, modnames):
        """take a list of module names which are pylint plugins and load
        and register them
        """
        for modname in modnames:
            if modname in self._dynamic_plugins:
                continue
            self._dynamic_plugins.add(modname)
            module = modutils.load_module_from_name(modname)
            module.register(self)

    def _load_reporter(self):
        name = self._reporter_name.lower()
        if name in self._reporters:
            self.set_reporter(self._reporters[name]())
        else:
            qname = self._reporter_name
            module = modutils.load_module_from_name(
                modutils.get_module_part(qname))
            class_name = qname.split('.')[-1]
            reporter_class = getattr(module, class_name)
            self.set_reporter(reporter_class())

    def set_reporter(self, reporter):
        """set the reporter used to display messages and reports"""
        self.reporter = reporter
        reporter.linter = self

    def set_option(self, optname, value, action=None, optdict=None):
        """overridden from config.OptionsProviderMixin to handle some
        special options
        """
        if optname in self._options_methods or \
                optname in self._bw_options_methods:
            if value:
                try:
                    meth = self._options_methods[optname]
                except KeyError:
                    meth = self._bw_options_methods[optname]
                    warnings.warn('%s is deprecated, replace it by %s' % (optname,
                                                                          optname.split('-')[0]),
                                  DeprecationWarning)
                value = utils._check_csv(value)
                if isinstance(value, (list, tuple)):
                    for _id in value:
                        meth(_id, ignore_unknown=True)
                else:
                    meth(value)
                return # no need to call set_option, disable/enable methods do it
        elif optname == 'output-format':
            self._reporter_name = value
            # If the reporters are already available, load
            # the reporter class.
            if self._reporters:
                self._load_reporter()

        try:
            checkers.BaseTokenChecker.set_option(self, optname,
                                                 value, action, optdict)
        except config.UnsupportedAction:
            print('option %s can\'t be read from config file' % \
                  optname, file=sys.stderr)

    def register_reporter(self, reporter_class):
        self._reporters[reporter_class.name] = reporter_class

    def report_order(self):
        reports = sorted(self._reports, key=lambda x: getattr(x, 'name', ''))
        try:
            # Remove the current reporter and add it
            # at the end of the list.
            reports.pop(reports.index(self))
        except ValueError:
            pass
        else:
            reports.append(self)
        return reports

    # checkers manipulation methods ############################################

    def register_checker(self, checker):
        """register a new checker

        checker is an object implementing IRawChecker or / and IAstroidChecker
        """
        assert checker.priority <= 0, 'checker priority can\'t be >= 0'
        self._checkers[checker.name].append(checker)
        for r_id, r_title, r_cb in checker.reports:
            self.register_report(r_id, r_title, r_cb, checker)
        self.register_options_provider(checker)
        if hasattr(checker, 'msgs'):
            self.msgs_store.register_messages(checker)
        checker.load_defaults()

        # Register the checker, but disable all of its messages.
        # TODO(cpopa): we should have a better API for this.
        if not getattr(checker, 'enabled', True):
            self.disable(checker.name)

    def disable_noerror_messages(self):
        for msgcat, msgids in six.iteritems(self.msgs_store._msgs_by_category):
            # enable only messages with 'error' severity and above ('fatal')
            if msgcat in ['E', 'F']:
                for msgid in msgids:
                    self.enable(msgid)
            else:
                for msgid in msgids:
                    self.disable(msgid)

    def disable_reporters(self):
        """disable all reporters"""
        for _reporters in six.itervalues(self._reports):
            for report_id, _, _ in _reporters:
                self.disable_report(report_id)

    def error_mode(self):
        """error mode: enable only errors; no reports, no persistent"""
        self._error_mode = True
        self.disable_noerror_messages()
        self.disable('miscellaneous')
        if self._python3_porting_mode:
            self.disable('all')
            for msg_id in self._checker_messages('python3'):
                if msg_id.startswith('E'):
                    self.enable(msg_id)
        else:
            self.disable('python3')
        self.set_option('reports', False)
        self.set_option('persistent', False)
        self.set_option('score', False)

    def python3_porting_mode(self):
        """Disable all other checkers and enable Python 3 warnings."""
        self.disable('all')
        self.enable('python3')
        if self._error_mode:
            # The error mode was activated, using the -E flag.
            # So we'll need to enable only the errors from the
            # Python 3 porting checker.
            for msg_id in self._checker_messages('python3'):
                if msg_id.startswith('E'):
                    self.enable(msg_id)
                else:
                    self.disable(msg_id)
        self._python3_porting_mode = True

    # block level option handling #############################################
    #
    # see func_block_disable_msg.py test case for expected behaviour

    def process_tokens(self, tokens):
        """process tokens from the current module to search for module/block
        level options
        """
        control_pragmas = {'disable', 'enable'}
        for (tok_type, content, start, _, _) in tokens:
            if tok_type != tokenize.COMMENT:
                continue
            match = utils.OPTION_RGX.search(content)
            if match is None:
                continue
            if match.group(1).strip() == "disable-all" or \
                    match.group(1).strip() == 'skip-file':
                if match.group(1).strip() == "disable-all":
                    self.add_message('deprecated-pragma', line=start[0],
                                     args=('disable-all', 'skip-file'))
                self.add_message('file-ignored', line=start[0])
                self._ignore_file = True
                return
            try:
                opt, value = match.group(1).split('=', 1)
            except ValueError:
                self.add_message('bad-inline-option', args=match.group(1).strip(),
                                 line=start[0])
                continue
            opt = opt.strip()
            if opt in self._options_methods or opt in self._bw_options_methods:
                try:
                    meth = self._options_methods[opt]
                except KeyError:
                    meth = self._bw_options_methods[opt]
                    # found a "(dis|en)able-msg" pragma deprecated suppression
                    self.add_message('deprecated-pragma', line=start[0],
                                     args=(opt, opt.replace('-msg', '')))
                for msgid in utils._splitstrip(value):
                    # Add the line where a control pragma was encountered.
                    if opt in control_pragmas:
                        self._pragma_lineno[msgid] = start[0]

                    try:
                        if (opt, msgid) == ('disable', 'all'):
                            self.add_message('deprecated-pragma', line=start[0],
                                             args=('disable=all', 'skip-file'))
                            self.add_message('file-ignored', line=start[0])
                            self._ignore_file = True
                            return
                        meth(msgid, 'module', start[0])
                    except exceptions.UnknownMessageError:
                        self.add_message('bad-option-value', args=msgid, line=start[0])
            else:
                self.add_message('unrecognized-inline-option', args=opt, line=start[0])


    # code checking methods ###################################################

    def get_checkers(self):
        """return all available checkers as a list"""
        return [self] + [c for _checkers in six.itervalues(self._checkers)
                         for c in _checkers if c is not self]

    def prepare_checkers(self):
        """return checkers needed for activated messages and reports"""
        if not self.config.reports:
            self.disable_reporters()
        # get needed checkers
        neededcheckers = [self]
        for checker in self.get_checkers()[1:]:
            messages = set(msg for msg in checker.msgs
                           if self.is_message_enabled(msg))
            if (messages or
                    any(self.report_is_enabled(r[0]) for r in checker.reports)):
                neededcheckers.append(checker)
        # Sort checkers by priority
        neededcheckers = sorted(neededcheckers,
                                key=operator.attrgetter('priority'),
                                reverse=True)
        return neededcheckers

    # pylint: disable=unused-argument
    @staticmethod
    def should_analyze_file(modname, path, is_argument=False):
        """Returns whether or not a module should be checked.

        This implementation returns True for all python source file, indicating
        that all files should be linted.

        Subclasses may override this method to indicate that modules satisfying
        certain conditions should not be linted.

        :param str modname: The name of the module to be checked.
        :param str path: The full path to the source code of the module.
        :param bool is_argument: Whetter the file is an argument to pylint or not.
                                 Files which respect this property are always
                                 checked, since the user requested it explicitly.
        :returns: True if the module should be checked.
        :rtype: bool
        """
        if is_argument:
            return True
        return path.endswith('.py')
    # pylint: enable=unused-argument

    def check(self, files_or_modules):
        """main checking entry: check a list of files or modules from their
        name.
        """
        # initialize msgs_state now that all messages have been registered into
        # the store
        for msg in self.msgs_store.messages:
            if not msg.may_be_emitted():
                self._msgs_state[msg.msgid] = False

        if not isinstance(files_or_modules, (list, tuple)):
            files_or_modules = (files_or_modules,)

        if self.config.jobs == 1:
            self._do_check(files_or_modules)
        else:
            with _patch_sysmodules():
                self._parallel_check(files_or_modules)

    def _get_jobs_config(self):
        child_config = collections.OrderedDict()
        filter_options = {'long-help'}
        filter_options.update((opt_name for opt_name, _ in self._external_opts))
        for opt_providers in six.itervalues(self._all_options):
            for optname, optdict, val in opt_providers.options_and_values():
                if optdict.get('deprecated'):
                    continue

                if optname not in filter_options:
                    child_config[optname] = utils._format_option_value(
                        optdict, val)
        child_config['python3_porting_mode'] = self._python3_porting_mode
        child_config['plugins'] = self._dynamic_plugins
        return child_config

    def _parallel_task(self, files_or_modules):
        # Prepare configuration for child linters.
        child_config = self._get_jobs_config()

        children = []
        manager = multiprocessing.Manager()
        tasks_queue = manager.Queue()
        results_queue = manager.Queue()

        for _ in range(self.config.jobs):
            child_linter = ChildLinter(args=(tasks_queue, results_queue,
                                             child_config))
            child_linter.start()
            children.append(child_linter)

        # Send files to child linters.
        expanded_files = self.expand_files(files_or_modules)
        for files_or_module in expanded_files:
            path = files_or_module['path']
            tasks_queue.put([path])

        # collect results from child linters
        failed = False
        for _ in expanded_files:
            try:
                result = results_queue.get()
            except Exception as ex:
                print("internal error while receiving results from child linter",
                      file=sys.stderr)
                print(ex, file=sys.stderr)
                failed = True
                break
            yield result

        # Stop child linters and wait for their completion.
        for _ in range(self.config.jobs):
            tasks_queue.put('STOP')
        for child in children:
            child.join()

        if failed:
            print("Error occurred, stopping the linter.", file=sys.stderr)
            sys.exit(32)

    def _parallel_check(self, files_or_modules):
        # Reset stats.
        self.open()

        all_stats = []
        module = None
        for result in self._parallel_task(files_or_modules):
            (
                _,
                self.file_state.base_name,
                module,
                messages,
                stats,
                msg_status
            ) = result

            for msg in messages:
                msg = utils.Message(*msg)
                self.set_current_module(module)
                self.reporter.handle_message(msg)

            all_stats.append(stats)
            self.msg_status |= msg_status

        self.stats = _merge_stats(all_stats)
        self.current_name = module

        # Insert stats data to local checkers.
        for checker in self.get_checkers():
            if checker is not self:
                checker.stats = self.stats

    def _do_check(self, files_or_modules):
        walker = utils.PyLintASTWalker(self)
        _checkers = self.prepare_checkers()
        tokencheckers = [c for c in _checkers
                         if interfaces.implements(c, interfaces.ITokenChecker)
                         and c is not self]
        rawcheckers = [c for c in _checkers
                       if interfaces.implements(c, interfaces.IRawChecker)]
        # notify global begin
        for checker in _checkers:
            checker.open()
            if interfaces.implements(checker, interfaces.IAstroidChecker):
                walker.add_checker(checker)
        # build ast and check modules or packages
        for descr in self.expand_files(files_or_modules):
            modname, filepath, is_arg = descr['name'], descr['path'], descr['isarg']
            if not self.should_analyze_file(modname, filepath, is_argument=is_arg):
                continue

            self.set_current_module(modname, filepath)
            # get the module representation
            ast_node = self.get_ast(filepath, modname)
            if ast_node is None:
                continue
            # XXX to be correct we need to keep module_msgs_state for every
            # analyzed module (the problem stands with localized messages which
            # are only detected in the .close step)
            self.file_state = utils.FileState(descr['basename'])
            self._ignore_file = False
            # fix the current file (if the source file was not available or
            # if it's actually a c extension)
            self.current_file = ast_node.file # pylint: disable=maybe-no-member
            self.check_astroid_module(ast_node, walker, rawcheckers, tokencheckers)
            # warn about spurious inline messages handling
            spurious_messages = self.file_state.iter_spurious_suppression_messages(self.msgs_store)
            for msgid, line, args in spurious_messages:
                self.add_message(msgid, line, None, args)
        # notify global end
        self.stats['statement'] = walker.nbstatements
        for checker in reversed(_checkers):
            checker.close()

    def expand_files(self, modules):
        """get modules and errors from a list of modules and handle errors
        """
        result, errors = utils.expand_modules(modules, self.config.black_list,
                                              self.config.black_list_re)
        for error in errors:
            message = modname = error["mod"]
            key = error["key"]
            self.set_current_module(modname)
            if key == "fatal":
                message = str(error["ex"]).replace(os.getcwd() + os.sep, '')
            self.add_message(key, args=message)
        return result

    def set_current_module(self, modname, filepath=None):
        """set the name of the currently analyzed module and
        init statistics for it
        """
        if not modname and filepath is None:
            return
        self.reporter.on_set_current_module(modname, filepath)
        self.current_name = modname
        self.current_file = filepath or modname
        self.stats['by_module'][modname] = {}
        self.stats['by_module'][modname]['statement'] = 0
        for msg_cat in six.itervalues(utils.MSG_TYPES):
            self.stats['by_module'][modname][msg_cat] = 0

    def get_ast(self, filepath, modname):
        """return a ast(roid) representation for a module"""
        try:
            return MANAGER.ast_from_file(filepath, modname, source=True)
        except astroid.AstroidSyntaxError as ex:
            self.add_message('syntax-error',
                             line=getattr(ex.error, 'lineno', 0),
                             args=str(ex.error))
        except astroid.AstroidBuildingException as ex:
            self.add_message('parse-error', args=ex)
        except Exception as ex: # pylint: disable=broad-except
            import traceback
            traceback.print_exc()
            self.add_message('astroid-error', args=(ex.__class__, ex))

    def check_astroid_module(self, ast_node, walker,
                             rawcheckers, tokencheckers):
        """Check a module from its astroid representation."""
        try:
            tokens = utils.tokenize_module(ast_node)
        except tokenize.TokenError as ex:
            self.add_message('syntax-error', line=ex.args[1][0], args=ex.args[0])
            return

        if not ast_node.pure_python:
            self.add_message('raw-checker-failed', args=ast_node.name)
        else:
            #assert astroid.file.endswith('.py')
            # invoke ITokenChecker interface on self to fetch module/block
            # level options
            self.process_tokens(tokens)
            if self._ignore_file:
                return False
            # walk ast to collect line numbers
            self.file_state.collect_block_lines(self.msgs_store, ast_node)
            # run raw and tokens checkers
            for checker in rawcheckers:
                checker.process_module(ast_node)
            for checker in tokencheckers:
                checker.process_tokens(tokens)
        # generate events to astroid checkers
        walker.walk(ast_node)
        return True

    # IAstroidChecker interface #################################################

    def open(self):
        """initialize counters"""
        self.stats = {'by_module' : {},
                      'by_msg' : {},
                     }
        MANAGER.always_load_extensions = self.config.unsafe_load_any_extension
        MANAGER.extension_package_whitelist.update(
            self.config.extension_pkg_whitelist)
        for msg_cat in six.itervalues(utils.MSG_TYPES):
            self.stats[msg_cat] = 0

    def generate_reports(self):
        """close the whole package /module, it's time to make reports !

        if persistent run, pickle results for later comparison
        """
        # Display whatever messages are left on the reporter.
        self.reporter.display_messages(report_nodes.Section())

        if self.file_state.base_name is not None:
            # load previous results if any
            previous_stats = config.load_results(self.file_state.base_name)
            # XXX code below needs refactoring to be more reporter agnostic
            self.reporter.on_close(self.stats, previous_stats)
            if self.config.reports:
                sect = self.make_reports(self.stats, previous_stats)
            else:
                sect = report_nodes.Section()

            if self.config.reports:
                self.reporter.display_reports(sect)
            self._report_evaluation()
            # save results if persistent run
            if self.config.persistent:
                config.save_results(self.stats, self.file_state.base_name)
        else:
            self.reporter.on_close(self.stats, {})

    def _report_evaluation(self):
        """make the global evaluation report"""
        # check with at least check 1 statements (usually 0 when there is a
        # syntax error preventing pylint from further processing)
        previous_stats = config.load_results(self.file_state.base_name)
        if self.stats['statement'] == 0:
            return

        # get a global note for the code
        evaluation = self.config.evaluation
        try:
            note = eval(evaluation, {}, self.stats) # pylint: disable=eval-used
        except Exception as ex: # pylint: disable=broad-except
            msg = 'An exception occurred while rating: %s' % ex
        else:
            self.stats['global_note'] = note
            msg = 'Your code has been rated at %.2f/10' % note
            pnote = previous_stats.get('global_note')
            if pnote is not None:
                msg += ' (previous run: %.2f/10, %+.2f)' % (pnote, note - pnote)

        if self.config.score:
            sect = report_nodes.EvaluationSection(msg)
            self.reporter.display_reports(sect)

# some reporting functions ####################################################

def report_total_messages_stats(sect, stats, previous_stats):
    """make total errors / warnings report"""
    lines = ['type', 'number', 'previous', 'difference']
    lines += checkers.table_lines_from_stats(stats, previous_stats,
                                             ('convention', 'refactor',
                                              'warning', 'error'))
    sect.append(report_nodes.Table(children=lines, cols=4, rheaders=1))

def report_messages_stats(sect, stats, _):
    """make messages type report"""
    if not stats['by_msg']:
        # don't print this report when we didn't detected any errors
        raise exceptions.EmptyReportError()
    in_order = sorted([(value, msg_id)
                       for msg_id, value in six.iteritems(stats['by_msg'])
                       if not msg_id.startswith('I')])
    in_order.reverse()
    lines = ('message id', 'occurrences')
    for value, msg_id in in_order:
        lines += (msg_id, str(value))
    sect.append(report_nodes.Table(children=lines, cols=2, rheaders=1))

def report_messages_by_module_stats(sect, stats, _):
    """make errors / warnings by modules report"""
    if len(stats['by_module']) == 1:
        # don't print this report when we are analysing a single module
        raise exceptions.EmptyReportError()
    by_mod = collections.defaultdict(dict)
    for m_type in ('fatal', 'error', 'warning', 'refactor', 'convention'):
        total = stats[m_type]
        for module in six.iterkeys(stats['by_module']):
            mod_total = stats['by_module'][module][m_type]
            if total == 0:
                percent = 0
            else:
                percent = float((mod_total)*100) / total
            by_mod[module][m_type] = percent
    sorted_result = []
    for module, mod_info in six.iteritems(by_mod):
        sorted_result.append((mod_info['error'],
                              mod_info['warning'],
                              mod_info['refactor'],
                              mod_info['convention'],
                              module))
    sorted_result.sort()
    sorted_result.reverse()
    lines = ['module', 'error', 'warning', 'refactor', 'convention']
    for line in sorted_result:
        # Don't report clean modules.
        if all(entry == 0 for entry in line[:-1]):
            continue
        lines.append(line[-1])
        for val in line[:-1]:
            lines.append('%.2f' % val)
    if len(lines) == 5:
        raise exceptions.EmptyReportError()
    sect.append(report_nodes.Table(children=lines, cols=5, rheaders=1))


# utilities ###################################################################


class ArgumentPreprocessingError(Exception):
    """Raised if an error occurs during argument preprocessing."""


def preprocess_options(args, search_for):
    """look for some options (keys of <search_for>) which have to be processed
    before others

    values of <search_for> are callback functions to call when the option is
    found
    """
    i = 0
    while i < len(args):
        arg = args[i]
        if arg.startswith('--'):
            try:
                option, val = arg[2:].split('=', 1)
            except ValueError:
                option, val = arg[2:], None
            try:
                cb, takearg = search_for[option]
            except KeyError:
                i += 1
            else:
                del args[i]
                if takearg and val is None:
                    if i >= len(args) or args[i].startswith('-'):
                        msg = 'Option %s expects a value' % option
                        raise ArgumentPreprocessingError(msg)
                    val = args[i]
                    del args[i]
                elif not takearg and val is not None:
                    msg = "Option %s doesn't expects a value" % option
                    raise ArgumentPreprocessingError(msg)
                cb(option, val)
        else:
            i += 1


@contextlib.contextmanager
def fix_import_path(args):
    """Prepare sys.path for running the linter checks.

    Within this context, each of the given arguments is importable.
    Paths are added to sys.path in corresponding order to the arguments.
    We avoid adding duplicate directories to sys.path.
    `sys.path` is reset to its original value upon exiting this context.
    """
    orig = list(sys.path)
    changes = []
    for arg in args:
        path = _get_python_path(arg)
        if path in changes:
            continue
        else:
            changes.append(path)
    sys.path[:] = changes + ["."] + sys.path
    try:
        yield
    finally:
        sys.path[:] = orig


class Run(object):
    """helper class to use as main for pylint :

    run(*sys.argv[1:])
    """
    LinterClass = PyLinter
    option_groups = (
        ('Commands', 'Options which are actually commands. Options in this \
group are mutually exclusive.'),
        )

    def __init__(self, args, reporter=None, exit=True):
        self._rcfile = None
        self._plugins = []
        try:
            preprocess_options(args, {
                # option: (callback, takearg)
                'init-hook':   (cb_init_hook, True),
                'rcfile':       (self.cb_set_rcfile, True),
                'load-plugins': (self.cb_add_plugins, True),
                })
        except ArgumentPreprocessingError as ex:
            print(ex, file=sys.stderr)
            sys.exit(32)

        self.linter = linter = self.LinterClass((
            ('rcfile',
             {'action' : 'callback', 'callback' : lambda *args: 1,
              'type': 'string', 'metavar': '<file>',
              'help' : 'Specify a configuration file.'}),

            ('init-hook',
             {'action' : 'callback', 'callback' : lambda *args: 1,
              'type' : 'string', 'metavar': '<code>',
              'level': 1,
              'help' : 'Python code to execute, usually for sys.path '
                       'manipulation such as pygtk.require().'}),

            ('help-msg',
             {'action' : 'callback', 'type' : 'string', 'metavar': '<msg-id>',
              'callback' : self.cb_help_message,
              'group': 'Commands',
              'help' : 'Display a help message for the given message id and '
                       'exit. The value may be a comma separated list of message ids.'}),

            ('list-msgs',
             {'action' : 'callback', 'metavar': '<msg-id>',
              'callback' : self.cb_list_messages,
              'group': 'Commands', 'level': 1,
              'help' : "Generate pylint's messages."}),

            ('list-conf-levels',
             {'action' : 'callback',
              'callback' : cb_list_confidence_levels,
              'group': 'Commands', 'level': 1,
              'help' : "Generate pylint's messages."}),

            ('full-documentation',
             {'action' : 'callback', 'metavar': '<msg-id>',
              'callback' : self.cb_full_documentation,
              'group': 'Commands', 'level': 1,
              'help' : "Generate pylint's full documentation."}),

            ('generate-rcfile',
             {'action' : 'callback', 'callback' : self.cb_generate_config,
              'group': 'Commands',
              'help' : 'Generate a sample configuration file according to '
                       'the current configuration. You can put other options '
                       'before this one to get them in the generated '
                       'configuration.'}),

            ('generate-man',
             {'action' : 'callback', 'callback' : self.cb_generate_manpage,
              'group': 'Commands',
              'help' : "Generate pylint's man page.", 'hide': True}),

            ('errors-only',
             {'action' : 'callback', 'callback' : self.cb_error_mode,
              'short': 'E',
              'help' : 'In error mode, checkers without error messages are '
                       'disabled and for others, only the ERROR messages are '
                       'displayed, and no reports are done by default'''}),

            ('py3k',
             {'action' : 'callback', 'callback' : self.cb_python3_porting_mode,
              'help' : 'In Python 3 porting mode, all checkers will be '
                       'disabled and only messages emitted by the porting '
                       'checker will be displayed'}),

            ), option_groups=self.option_groups, pylintrc=self._rcfile)
        # register standard checkers
        linter.load_default_plugins()
        # load command line plugins
        linter.load_plugin_modules(self._plugins)
        # add some help section
        linter.add_help_section('Environment variables', config.ENV_HELP, level=1)
        # pylint: disable=bad-continuation
        linter.add_help_section('Output',
'Using the default text output, the message format is :                          \n'
'                                                                                \n'
'        MESSAGE_TYPE: LINE_NUM:[OBJECT:] MESSAGE                                \n'
'                                                                                \n'
'There are 5 kind of message types :                                             \n'
'    * (C) convention, for programming standard violation                        \n'
'    * (R) refactor, for bad code smell                                          \n'
'    * (W) warning, for python specific problems                                 \n'
'    * (E) error, for probable bugs in the code                                  \n'
'    * (F) fatal, if an error occurred which prevented pylint from doing further\n'
'processing.\n'
                                , level=1)
        linter.add_help_section('Output status code',
'Pylint should leave with following status code:                                 \n'
'    * 0 if everything went fine                                                 \n'
'    * 1 if a fatal message was issued                                           \n'
'    * 2 if an error message was issued                                          \n'
'    * 4 if a warning message was issued                                         \n'
'    * 8 if a refactor message was issued                                        \n'
'    * 16 if a convention message was issued                                     \n'
'    * 32 on usage error                                                         \n'
'                                                                                \n'
'status 1 to 16 will be bit-ORed so you can know which different categories has\n'
'been issued by analysing pylint output status code\n',
                                level=1)
        # read configuration
        linter.disable('I')
        linter.read_config_file()
        config_parser = linter.cfgfile_parser
        # run init hook, if present, before loading plugins
        if config_parser.has_option('MASTER', 'init-hook'):
            cb_init_hook('init-hook',
                         utils._unquote(config_parser.get('MASTER',
                                                          'init-hook')))
        # is there some additional plugins in the file configuration, in
        if config_parser.has_option('MASTER', 'load-plugins'):
            plugins = utils._splitstrip(
                config_parser.get('MASTER', 'load-plugins'))
            linter.load_plugin_modules(plugins)
        # now we can load file config and command line, plugins (which can
        # provide options) have been registered
        linter.load_config_file()
        if reporter:
            # if a custom reporter is provided as argument, it may be overridden
            # by file parameters, so re-set it here, but before command line
            # parsing so it's still overrideable by command line option
            linter.set_reporter(reporter)
        try:
            args = linter.load_command_line_configuration(args)
        except SystemExit as exc:
            if exc.code == 2: # bad options
                exc.code = 32
            raise
        if not args:
            print(linter.help())
            sys.exit(32)

        if linter.config.jobs < 0:
            print("Jobs number (%d) should be greater than 0"
                  % linter.config.jobs, file=sys.stderr)
            sys.exit(32)
        if linter.config.jobs > 1 or linter.config.jobs == 0:
            if multiprocessing is None:
                print("Multiprocessing library is missing, "
                      "fallback to single process", file=sys.stderr)
                linter.set_option("jobs", 1)
            else:
                if linter.config.jobs == 0:
                    linter.config.jobs = multiprocessing.cpu_count()

        # insert current working directory to the python path to have a correct
        # behaviour
        with fix_import_path(args):
            linter.check(args)
            linter.generate_reports()
        if exit:
            sys.exit(self.linter.msg_status)

    def cb_set_rcfile(self, name, value):
        """callback for option preprocessing (i.e. before option parsing)"""
        self._rcfile = value

    def cb_add_plugins(self, name, value):
        """callback for option preprocessing (i.e. before option parsing)"""
        self._plugins.extend(utils._splitstrip(value))

    def cb_error_mode(self, *args, **kwargs):
        """error mode:
        * disable all but error messages
        * disable the 'miscellaneous' checker which can be safely deactivated in
          debug
        * disable reports
        * do not save execution information
        """
        self.linter.error_mode()

    def cb_generate_config(self, *args, **kwargs):
        """optik callback for sample config file generation"""
        self.linter.generate_config(skipsections=('COMMANDS',))
        sys.exit(0)

    def cb_generate_manpage(self, *args, **kwargs):
        """optik callback for sample config file generation"""
        from pylint import __pkginfo__
        self.linter.generate_manpage(__pkginfo__)
        sys.exit(0)

    def cb_help_message(self, option, optname, value, parser):
        """optik callback for printing some help about a particular message"""
        self.linter.msgs_store.help_message(utils._splitstrip(value))
        sys.exit(0)

    def cb_full_documentation(self, option, optname, value, parser):
        """optik callback for printing full documentation"""
        self.linter.print_full_documentation()
        sys.exit(0)

    def cb_list_messages(self, option, optname, value, parser): # FIXME
        """optik callback for printing available messages"""
        self.linter.msgs_store.list_messages()
        sys.exit(0)

    def cb_python3_porting_mode(self, *args, **kwargs):
        """Activate only the python3 porting checker."""
        self.linter.python3_porting_mode()


def cb_list_confidence_levels(option, optname, value, parser):
    for level in interfaces.CONFIDENCE_LEVELS:
        print('%-18s: %s' % level)
    sys.exit(0)

def cb_init_hook(optname, value):
    """exec arbitrary code to set sys.path for instance"""
    exec(value) # pylint: disable=exec-used


if __name__ == '__main__':
    Run(sys.argv[1:])
