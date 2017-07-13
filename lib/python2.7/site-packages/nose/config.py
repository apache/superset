import logging
import optparse
import os
import re
import sys
import ConfigParser
from optparse import OptionParser
from nose.util import absdir, tolist
from nose.plugins.manager import NoPlugins
from warnings import warn, filterwarnings

log = logging.getLogger(__name__)

# not allowed in config files
option_blacklist = ['help', 'verbose']

config_files = [
    # Linux users will prefer this
    "~/.noserc",
    # Windows users will prefer this
    "~/nose.cfg"
    ]

# plaforms on which the exe check defaults to off
# Windows and IronPython
exe_allowed_platforms = ('win32', 'cli')

filterwarnings("always", category=DeprecationWarning,
               module=r'(.*\.)?nose\.config')

class NoSuchOptionError(Exception):
    def __init__(self, name):
        Exception.__init__(self, name)
        self.name = name


class ConfigError(Exception):
    pass


class ConfiguredDefaultsOptionParser(object):
    """
    Handler for options from commandline and config files.
    """
    def __init__(self, parser, config_section, error=None, file_error=None):
        self._parser = parser
        self._config_section = config_section
        if error is None:
            error = self._parser.error
        self._error = error
        if file_error is None:
            file_error = lambda msg, **kw: error(msg)
        self._file_error = file_error

    def _configTuples(self, cfg, filename):
        config = []
        if self._config_section in cfg.sections():
            for name, value in cfg.items(self._config_section):
                config.append((name, value, filename))
        return config

    def _readFromFilenames(self, filenames):
        config = []
        for filename in filenames:
            cfg = ConfigParser.RawConfigParser()
            try:
                cfg.read(filename)
            except ConfigParser.Error, exc:
                raise ConfigError("Error reading config file %r: %s" %
                                  (filename, str(exc)))
            config.extend(self._configTuples(cfg, filename))
        return config

    def _readFromFileObject(self, fh):
        cfg = ConfigParser.RawConfigParser()
        try:
            filename = fh.name
        except AttributeError:
            filename = '<???>'
        try:
            cfg.readfp(fh)
        except ConfigParser.Error, exc:
            raise ConfigError("Error reading config file %r: %s" %
                              (filename, str(exc)))
        return self._configTuples(cfg, filename)

    def _readConfiguration(self, config_files):
        try:
            config_files.readline
        except AttributeError:
            filename_or_filenames = config_files
            if isinstance(filename_or_filenames, basestring):
                filenames = [filename_or_filenames]
            else:
                filenames = filename_or_filenames
            config = self._readFromFilenames(filenames)
        else:
            fh = config_files
            config = self._readFromFileObject(fh)
        return config

    def _processConfigValue(self, name, value, values, parser):
        opt_str = '--' + name
        option = parser.get_option(opt_str)
        if option is None:
            raise NoSuchOptionError(name)
        else:
            option.process(opt_str, value, values, parser)

    def _applyConfigurationToValues(self, parser, config, values):
        for name, value, filename in config:
            if name in option_blacklist:
                continue
            try:
                self._processConfigValue(name, value, values, parser)
            except NoSuchOptionError, exc:
                self._file_error(
                    "Error reading config file %r: "
                    "no such option %r" % (filename, exc.name),
                    name=name, filename=filename)
            except optparse.OptionValueError, exc:
                msg = str(exc).replace('--' + name, repr(name), 1)
                self._file_error("Error reading config file %r: "
                                 "%s" % (filename, msg),
                                 name=name, filename=filename)

    def parseArgsAndConfigFiles(self, args, config_files):
        values = self._parser.get_default_values()
        try:
            config = self._readConfiguration(config_files)
        except ConfigError, exc:
            self._error(str(exc))
        else:
            try:
                self._applyConfigurationToValues(self._parser, config, values)
            except ConfigError, exc:
                self._error(str(exc))
        return self._parser.parse_args(args, values)


class Config(object):
    """nose configuration.

    Instances of Config are used throughout nose to configure
    behavior, including plugin lists. Here are the default values for
    all config keys::

      self.env = env = kw.pop('env', {})
      self.args = ()
      self.testMatch = re.compile(r'(?:^|[\\b_\\.%s-])[Tt]est' % os.sep)
      self.addPaths = not env.get('NOSE_NOPATH', False)
      self.configSection = 'nosetests'
      self.debug = env.get('NOSE_DEBUG')
      self.debugLog = env.get('NOSE_DEBUG_LOG')
      self.exclude = None
      self.getTestCaseNamesCompat = False
      self.includeExe = env.get('NOSE_INCLUDE_EXE',
                                sys.platform in exe_allowed_platforms)
      self.ignoreFiles = (re.compile(r'^\.'),
                          re.compile(r'^_'),
                          re.compile(r'^setup\.py$')
                          )
      self.include = None
      self.loggingConfig = None
      self.logStream = sys.stderr
      self.options = NoOptions()
      self.parser = None
      self.plugins = NoPlugins()
      self.srcDirs = ('lib', 'src')
      self.runOnInit = True
      self.stopOnError = env.get('NOSE_STOP', False)
      self.stream = sys.stderr
      self.testNames = ()
      self.verbosity = int(env.get('NOSE_VERBOSE', 1))
      self.where = ()
      self.py3where = ()
      self.workingDir = None
    """

    def __init__(self, **kw):
        self.env = env = kw.pop('env', {})
        self.args = ()
        self.testMatchPat = env.get('NOSE_TESTMATCH',
                                    r'(?:^|[\b_\.%s-])[Tt]est' % os.sep)
        self.testMatch = re.compile(self.testMatchPat)
        self.addPaths = not env.get('NOSE_NOPATH', False)
        self.configSection = 'nosetests'
        self.debug = env.get('NOSE_DEBUG')
        self.debugLog = env.get('NOSE_DEBUG_LOG')
        self.exclude = None
        self.getTestCaseNamesCompat = False
        self.includeExe = env.get('NOSE_INCLUDE_EXE',
                                  sys.platform in exe_allowed_platforms)
        self.ignoreFilesDefaultStrings = [r'^\.',
                                          r'^_',
                                          r'^setup\.py$',
                                          ]
        self.ignoreFiles = map(re.compile, self.ignoreFilesDefaultStrings)
        self.include = None
        self.loggingConfig = None
        self.logStream = sys.stderr
        self.options = NoOptions()
        self.parser = None
        self.plugins = NoPlugins()
        self.srcDirs = ('lib', 'src')
        self.runOnInit = True
        self.stopOnError = env.get('NOSE_STOP', False)
        self.stream = sys.stderr
        self.testNames = []
        self.verbosity = int(env.get('NOSE_VERBOSE', 1))
        self.where = ()
        self.py3where = ()
        self.workingDir = os.getcwd()
        self.traverseNamespace = False
        self.firstPackageWins = False
        self.parserClass = OptionParser
        self.worker = False

        self._default = self.__dict__.copy()
        self.update(kw)
        self._orig = self.__dict__.copy()

    def __getstate__(self):
        state = self.__dict__.copy()
        del state['stream']
        del state['_orig']
        del state['_default']
        del state['env']
        del state['logStream']
        # FIXME remove plugins, have only plugin manager class
        state['plugins'] = self.plugins.__class__
        return state

    def __setstate__(self, state):
        plugincls = state.pop('plugins')
        self.update(state)
        self.worker = True
        # FIXME won't work for static plugin lists
        self.plugins = plugincls()
        self.plugins.loadPlugins()
        # needed so .can_configure gets set appropriately
        dummy_parser = self.parserClass()
        self.plugins.addOptions(dummy_parser, {})
        self.plugins.configure(self.options, self)

    def __repr__(self):
        d = self.__dict__.copy()
        # don't expose env, could include sensitive info
        d['env'] = {}
        keys = [ k for k in d.keys()
                 if not k.startswith('_') ]
        keys.sort()
        return "Config(%s)" % ', '.join([ '%s=%r' % (k, d[k])
                                          for k in keys ])
    __str__ = __repr__

    def _parseArgs(self, argv, cfg_files):
        def warn_sometimes(msg, name=None, filename=None):
            if (hasattr(self.plugins, 'excludedOption') and
                self.plugins.excludedOption(name)):
                msg = ("Option %r in config file %r ignored: "
                       "excluded by runtime environment" %
                       (name, filename))
                warn(msg, RuntimeWarning)
            else:
                raise ConfigError(msg)
        parser = ConfiguredDefaultsOptionParser(
            self.getParser(), self.configSection, file_error=warn_sometimes)
        return parser.parseArgsAndConfigFiles(argv[1:], cfg_files)

    def configure(self, argv=None, doc=None):
        """Configure the nose running environment. Execute configure before
        collecting tests with nose.TestCollector to enable output capture and
        other features.
        """
        env = self.env
        if argv is None:
            argv = sys.argv

        cfg_files = getattr(self, 'files', [])
        options, args = self._parseArgs(argv, cfg_files)
        # If -c --config has been specified on command line,
        # load those config files and reparse
        if getattr(options, 'files', []):
            options, args = self._parseArgs(argv, options.files)

        self.options = options
        if args:
            self.testNames = args
        if options.testNames is not None:
            self.testNames.extend(tolist(options.testNames))

        if options.py3where is not None:
            if sys.version_info >= (3,):
                options.where = options.py3where

        # `where` is an append action, so it can't have a default value
        # in the parser, or that default will always be in the list
        if not options.where:
            options.where = env.get('NOSE_WHERE', None)

        # include and exclude also
        if not options.ignoreFiles:
            options.ignoreFiles = env.get('NOSE_IGNORE_FILES', [])
        if not options.include:
            options.include = env.get('NOSE_INCLUDE', [])
        if not options.exclude:
            options.exclude = env.get('NOSE_EXCLUDE', [])

        self.addPaths = options.addPaths
        self.stopOnError = options.stopOnError
        self.verbosity = options.verbosity
        self.includeExe = options.includeExe
        self.traverseNamespace = options.traverseNamespace
        self.debug = options.debug
        self.debugLog = options.debugLog
        self.loggingConfig = options.loggingConfig
        self.firstPackageWins = options.firstPackageWins
        self.configureLogging()

        if not options.byteCompile:
            sys.dont_write_bytecode = True

        if options.where is not None:
            self.configureWhere(options.where)

        if options.testMatch:
            self.testMatch = re.compile(options.testMatch)

        if options.ignoreFiles:
            self.ignoreFiles = map(re.compile, tolist(options.ignoreFiles))
            log.info("Ignoring files matching %s", options.ignoreFiles)
        else:
            log.info("Ignoring files matching %s", self.ignoreFilesDefaultStrings)

        if options.include:
            self.include = map(re.compile, tolist(options.include))
            log.info("Including tests matching %s", options.include)

        if options.exclude:
            self.exclude = map(re.compile, tolist(options.exclude))
            log.info("Excluding tests matching %s", options.exclude)

        # When listing plugins we don't want to run them
        if not options.showPlugins:
            self.plugins.configure(options, self)
            self.plugins.begin()

    def configureLogging(self):
        """Configure logging for nose, or optionally other packages. Any logger
        name may be set with the debug option, and that logger will be set to
        debug level and be assigned the same handler as the nose loggers, unless
        it already has a handler.
        """
        if self.loggingConfig:
            from logging.config import fileConfig
            fileConfig(self.loggingConfig)
            return

        format = logging.Formatter('%(name)s: %(levelname)s: %(message)s')
        if self.debugLog:
            handler = logging.FileHandler(self.debugLog)
        else:
            handler = logging.StreamHandler(self.logStream)
        handler.setFormatter(format)

        logger = logging.getLogger('nose')
        logger.propagate = 0

        # only add our default handler if there isn't already one there
        # this avoids annoying duplicate log messages.
        found = False
        if self.debugLog:
            debugLogAbsPath = os.path.abspath(self.debugLog)
            for h in logger.handlers:
                if type(h) == logging.FileHandler and \
                        h.baseFilename == debugLogAbsPath:
                    found = True
        else:
            for h in logger.handlers:
                if type(h) == logging.StreamHandler and \
                        h.stream == self.logStream:
                    found = True
        if not found:
            logger.addHandler(handler)

        # default level
        lvl = logging.WARNING
        if self.verbosity >= 5:
            lvl = 0
        elif self.verbosity >= 4:
            lvl = logging.DEBUG
        elif self.verbosity >= 3:
            lvl = logging.INFO
        logger.setLevel(lvl)

        # individual overrides
        if self.debug:
            # no blanks
            debug_loggers = [ name for name in self.debug.split(',')
                              if name ]
            for logger_name in debug_loggers:
                l = logging.getLogger(logger_name)
                l.setLevel(logging.DEBUG)
                if not l.handlers and not logger_name.startswith('nose'):
                    l.addHandler(handler)

    def configureWhere(self, where):
        """Configure the working directory or directories for the test run.
        """
        from nose.importer import add_path
        self.workingDir = None
        where = tolist(where)
        warned = False
        for path in where:
            if not self.workingDir:
                abs_path = absdir(path)
                if abs_path is None:
                    raise ValueError("Working directory '%s' not found, or "
                                     "not a directory" % path)
                log.info("Set working dir to %s", abs_path)
                self.workingDir = abs_path
                if self.addPaths and \
                       os.path.exists(os.path.join(abs_path, '__init__.py')):
                    log.info("Working directory %s is a package; "
                             "adding to sys.path" % abs_path)
                    add_path(abs_path)
                continue
            if not warned:
                warn("Use of multiple -w arguments is deprecated and "
                     "support may be removed in a future release. You can "
                     "get the same behavior by passing directories without "
                     "the -w argument on the command line, or by using the "
                     "--tests argument in a configuration file.",
                     DeprecationWarning)
                warned = True
            self.testNames.append(path)

    def default(self):
        """Reset all config values to defaults.
        """
        self.__dict__.update(self._default)

    def getParser(self, doc=None):
        """Get the command line option parser.
        """
        if self.parser:
            return self.parser
        env = self.env
        parser = self.parserClass(doc)
        parser.add_option(
            "-V","--version", action="store_true",
            dest="version", default=False,
            help="Output nose version and exit")
        parser.add_option(
            "-p", "--plugins", action="store_true",
            dest="showPlugins", default=False,
            help="Output list of available plugins and exit. Combine with "
            "higher verbosity for greater detail")
        parser.add_option(
            "-v", "--verbose",
            action="count", dest="verbosity",
            default=self.verbosity,
            help="Be more verbose. [NOSE_VERBOSE]")
        parser.add_option(
            "--verbosity", action="store", dest="verbosity",
            metavar='VERBOSITY',
            type="int", help="Set verbosity; --verbosity=2 is "
            "the same as -v")
        parser.add_option(
            "-q", "--quiet", action="store_const", const=0, dest="verbosity",
            help="Be less verbose")
        parser.add_option(
            "-c", "--config", action="append", dest="files",
            metavar="FILES",
            help="Load configuration from config file(s). May be specified "
            "multiple times; in that case, all config files will be "
            "loaded and combined")
        parser.add_option(
            "-w", "--where", action="append", dest="where",
            metavar="WHERE",
            help="Look for tests in this directory. "
            "May be specified multiple times. The first directory passed "
            "will be used as the working directory, in place of the current "
            "working directory, which is the default. Others will be added "
            "to the list of tests to execute. [NOSE_WHERE]"
            )
        parser.add_option(
            "--py3where", action="append", dest="py3where",
            metavar="PY3WHERE",
            help="Look for tests in this directory under Python 3.x. "
            "Functions the same as 'where', but only applies if running under "
            "Python 3.x or above.  Note that, if present under 3.x, this "
            "option completely replaces any directories specified with "
            "'where', so the 'where' option becomes ineffective. "
            "[NOSE_PY3WHERE]"
            )
        parser.add_option(
            "-m", "--match", "--testmatch", action="store",
            dest="testMatch", metavar="REGEX",
            help="Files, directories, function names, and class names "
            "that match this regular expression are considered tests.  "
            "Default: %s [NOSE_TESTMATCH]" % self.testMatchPat,
            default=self.testMatchPat)
        parser.add_option(
            "--tests", action="store", dest="testNames", default=None,
            metavar='NAMES',
            help="Run these tests (comma-separated list). This argument is "
            "useful mainly from configuration files; on the command line, "
            "just pass the tests to run as additional arguments with no "
            "switch.")
        parser.add_option(
            "-l", "--debug", action="store",
            dest="debug", default=self.debug,
            help="Activate debug logging for one or more systems. "
            "Available debug loggers: nose, nose.importer, "
            "nose.inspector, nose.plugins, nose.result and "
            "nose.selector. Separate multiple names with a comma.")
        parser.add_option(
            "--debug-log", dest="debugLog", action="store",
            default=self.debugLog, metavar="FILE",
            help="Log debug messages to this file "
            "(default: sys.stderr)")
        parser.add_option(
            "--logging-config", "--log-config",
            dest="loggingConfig", action="store",
            default=self.loggingConfig, metavar="FILE",
            help="Load logging config from this file -- bypasses all other"
            " logging config settings.")
        parser.add_option(
            "-I", "--ignore-files", action="append", dest="ignoreFiles",
            metavar="REGEX",
            help="Completely ignore any file that matches this regular "
            "expression. Takes precedence over any other settings or "
            "plugins. "
            "Specifying this option will replace the default setting. "
            "Specify this option multiple times "
            "to add more regular expressions [NOSE_IGNORE_FILES]")
        parser.add_option(
            "-e", "--exclude", action="append", dest="exclude",
            metavar="REGEX",
            help="Don't run tests that match regular "
            "expression [NOSE_EXCLUDE]")
        parser.add_option(
            "-i", "--include", action="append", dest="include",
            metavar="REGEX",
            help="This regular expression will be applied to files, "
            "directories, function names, and class names for a chance "
            "to include additional tests that do not match TESTMATCH.  "
            "Specify this option multiple times "
            "to add more regular expressions [NOSE_INCLUDE]")
        parser.add_option(
            "-x", "--stop", action="store_true", dest="stopOnError",
            default=self.stopOnError,
            help="Stop running tests after the first error or failure")
        parser.add_option(
            "-P", "--no-path-adjustment", action="store_false",
            dest="addPaths",
            default=self.addPaths,
            help="Don't make any changes to sys.path when "
            "loading tests [NOSE_NOPATH]")
        parser.add_option(
            "--exe", action="store_true", dest="includeExe",
            default=self.includeExe,
            help="Look for tests in python modules that are "
            "executable. Normal behavior is to exclude executable "
            "modules, since they may not be import-safe "
            "[NOSE_INCLUDE_EXE]")
        parser.add_option(
            "--noexe", action="store_false", dest="includeExe",
            help="DO NOT look for tests in python modules that are "
            "executable. (The default on the windows platform is to "
            "do so.)")
        parser.add_option(
            "--traverse-namespace", action="store_true",
            default=self.traverseNamespace, dest="traverseNamespace",
            help="Traverse through all path entries of a namespace package")
        parser.add_option(
            "--first-package-wins", "--first-pkg-wins", "--1st-pkg-wins",
            action="store_true", default=False, dest="firstPackageWins",
            help="nose's importer will normally evict a package from sys."
            "modules if it sees a package with the same name in a different "
            "location. Set this option to disable that behavior.")
        parser.add_option(
            "--no-byte-compile",
            action="store_false", default=True, dest="byteCompile",
            help="Prevent nose from byte-compiling the source into .pyc files "
            "while nose is scanning for and running tests.")

        self.plugins.loadPlugins()
        self.pluginOpts(parser)

        self.parser = parser
        return parser

    def help(self, doc=None):
        """Return the generated help message
        """
        return self.getParser(doc).format_help()

    def pluginOpts(self, parser):
        self.plugins.addOptions(parser, self.env)

    def reset(self):
        self.__dict__.update(self._orig)

    def todict(self):
        return self.__dict__.copy()

    def update(self, d):
        self.__dict__.update(d)


class NoOptions(object):
    """Options container that returns None for all options.
    """
    def __getstate__(self):
        return {}

    def __setstate__(self, state):
        pass

    def __getnewargs__(self):
        return ()

    def __nonzero__(self):
        return False


def user_config_files():
    """Return path to any existing user config files
    """
    return filter(os.path.exists,
                  map(os.path.expanduser, config_files))


def all_config_files():
    """Return path to any existing user config files, plus any setup.cfg
    in the current working directory.
    """
    user = user_config_files()
    if os.path.exists('setup.cfg'):
        return user + ['setup.cfg']
    return user


# used when parsing config files
def flag(val):
    """Does the value look like an on/off flag?"""
    if val == 1:
        return True
    elif val == 0:
        return False
    val = str(val)
    if len(val) > 5:
        return False
    return val.upper() in ('1', '0', 'F', 'T', 'TRUE', 'FALSE', 'ON', 'OFF')


def _bool(val):
    return str(val).upper() in ('1', 'T', 'TRUE', 'ON')
