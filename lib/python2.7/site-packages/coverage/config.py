# Licensed under the Apache License: http://www.apache.org/licenses/LICENSE-2.0
# For details: https://bitbucket.org/ned/coveragepy/src/default/NOTICE.txt

"""Config file for coverage.py"""

import collections
import os
import re
import sys

from coverage.backward import configparser, iitems, string_class
from coverage.misc import contract, CoverageException, isolate_module

os = isolate_module(os)


class HandyConfigParser(configparser.RawConfigParser):
    """Our specialization of ConfigParser."""

    def __init__(self, section_prefix):
        configparser.RawConfigParser.__init__(self)
        self.section_prefix = section_prefix

    def read(self, filenames):
        """Read a file name as UTF-8 configuration data."""
        kwargs = {}
        if sys.version_info >= (3, 2):
            kwargs['encoding'] = "utf-8"
        return configparser.RawConfigParser.read(self, filenames, **kwargs)

    def has_option(self, section, option):
        section = self.section_prefix + section
        return configparser.RawConfigParser.has_option(self, section, option)

    def has_section(self, section):
        section = self.section_prefix + section
        return configparser.RawConfigParser.has_section(self, section)

    def options(self, section):
        section = self.section_prefix + section
        return configparser.RawConfigParser.options(self, section)

    def get_section(self, section):
        """Get the contents of a section, as a dictionary."""
        d = {}
        for opt in self.options(section):
            d[opt] = self.get(section, opt)
        return d

    def get(self, section, *args, **kwargs):        # pylint: disable=arguments-differ
        """Get a value, replacing environment variables also.

        The arguments are the same as `RawConfigParser.get`, but in the found
        value, ``$WORD`` or ``${WORD}`` are replaced by the value of the
        environment variable ``WORD``.

        Returns the finished value.

        """
        section = self.section_prefix + section
        v = configparser.RawConfigParser.get(self, section, *args, **kwargs)
        def dollar_replace(m):
            """Called for each $replacement."""
            # Only one of the groups will have matched, just get its text.
            word = next(w for w in m.groups() if w is not None)     # pragma: part covered
            if word == "$":
                return "$"
            else:
                return os.environ.get(word, '')

        dollar_pattern = r"""(?x)   # Use extended regex syntax
            \$(?:                   # A dollar sign, then
            (?P<v1>\w+) |           #   a plain word,
            {(?P<v2>\w+)} |         #   or a {-wrapped word,
            (?P<char>[$])           #   or a dollar sign.
            )
            """
        v = re.sub(dollar_pattern, dollar_replace, v)
        return v

    def getlist(self, section, option):
        """Read a list of strings.

        The value of `section` and `option` is treated as a comma- and newline-
        separated list of strings.  Each value is stripped of whitespace.

        Returns the list of strings.

        """
        value_list = self.get(section, option)
        values = []
        for value_line in value_list.split('\n'):
            for value in value_line.split(','):
                value = value.strip()
                if value:
                    values.append(value)
        return values

    def getregexlist(self, section, option):
        """Read a list of full-line regexes.

        The value of `section` and `option` is treated as a newline-separated
        list of regexes.  Each value is stripped of whitespace.

        Returns the list of strings.

        """
        line_list = self.get(section, option)
        value_list = []
        for value in line_list.splitlines():
            value = value.strip()
            try:
                re.compile(value)
            except re.error as e:
                raise CoverageException(
                    "Invalid [%s].%s value %r: %s" % (section, option, value, e)
                )
            if value:
                value_list.append(value)
        return value_list


# The default line exclusion regexes.
DEFAULT_EXCLUDE = [
    r'#\s*(pragma|PRAGMA)[:\s]?\s*(no|NO)\s*(cover|COVER)',
]

# The default partial branch regexes, to be modified by the user.
DEFAULT_PARTIAL = [
    r'#\s*(pragma|PRAGMA)[:\s]?\s*(no|NO)\s*(branch|BRANCH)',
]

# The default partial branch regexes, based on Python semantics.
# These are any Python branching constructs that can't actually execute all
# their branches.
DEFAULT_PARTIAL_ALWAYS = [
    'while (True|1|False|0):',
    'if (True|1|False|0):',
]


class CoverageConfig(object):
    """Coverage.py configuration.

    The attributes of this class are the various settings that control the
    operation of coverage.py.

    """
    def __init__(self):
        """Initialize the configuration attributes to their defaults."""
        # Metadata about the config.
        self.attempted_config_files = []
        self.config_files = []

        # Defaults for [run]
        self.branch = False
        self.concurrency = None
        self.cover_pylib = False
        self.data_file = ".coverage"
        self.debug = []
        self.disable_warnings = []
        self.note = None
        self.parallel = False
        self.plugins = []
        self.source = None
        self.timid = False

        # Defaults for [report]
        self.exclude_list = DEFAULT_EXCLUDE[:]
        self.fail_under = 0
        self.ignore_errors = False
        self.include = None
        self.omit = None
        self.partial_always_list = DEFAULT_PARTIAL_ALWAYS[:]
        self.partial_list = DEFAULT_PARTIAL[:]
        self.precision = 0
        self.show_missing = False
        self.skip_covered = False

        # Defaults for [html]
        self.extra_css = None
        self.html_dir = "htmlcov"
        self.html_title = "Coverage report"

        # Defaults for [xml]
        self.xml_output = "coverage.xml"
        self.xml_package_depth = 99

        # Defaults for [paths]
        self.paths = {}

        # Options for plugins
        self.plugin_options = {}

    MUST_BE_LIST = ["concurrency", "debug", "disable_warnings", "include", "omit", "plugins"]

    def from_args(self, **kwargs):
        """Read config values from `kwargs`."""
        for k, v in iitems(kwargs):
            if v is not None:
                if k in self.MUST_BE_LIST and isinstance(v, string_class):
                    v = [v]
                setattr(self, k, v)

    @contract(filename=str)
    def from_file(self, filename, section_prefix=""):
        """Read configuration from a .rc file.

        `filename` is a file name to read.

        Returns True or False, whether the file could be read, and it had some
        coverage.py settings in it.

        """
        self.attempted_config_files.append(filename)

        cp = HandyConfigParser(section_prefix)
        try:
            files_read = cp.read(filename)
        except configparser.Error as err:
            raise CoverageException("Couldn't read config file %s: %s" % (filename, err))
        if not files_read:
            return False

        self.config_files.extend(files_read)

        any_set = False
        try:
            for option_spec in self.CONFIG_FILE_OPTIONS:
                was_set = self._set_attr_from_config_option(cp, *option_spec)
                if was_set:
                    any_set = True
        except ValueError as err:
            raise CoverageException("Couldn't read config file %s: %s" % (filename, err))

        # Check that there are no unrecognized options.
        all_options = collections.defaultdict(set)
        for option_spec in self.CONFIG_FILE_OPTIONS:
            section, option = option_spec[1].split(":")
            all_options[section].add(option)

        for section, options in iitems(all_options):
            if cp.has_section(section):
                for unknown in set(cp.options(section)) - options:
                    if section_prefix:
                        section = section_prefix + section
                    raise CoverageException(
                        "Unrecognized option '[%s] %s=' in config file %s" % (
                            section, unknown, filename
                        )
                    )

        # [paths] is special
        if cp.has_section('paths'):
            for option in cp.options('paths'):
                self.paths[option] = cp.getlist('paths', option)
                any_set = True

        # plugins can have options
        for plugin in self.plugins:
            if cp.has_section(plugin):
                self.plugin_options[plugin] = cp.get_section(plugin)
                any_set = True

        # Was this file used as a config file? If no prefix, then it was used.
        # If a prefix, then it was only used if we found some settings in it.
        if section_prefix:
            return any_set
        else:
            return True

    CONFIG_FILE_OPTIONS = [
        # These are *args for _set_attr_from_config_option:
        #   (attr, where, type_="")
        #
        #   attr is the attribute to set on the CoverageConfig object.
        #   where is the section:name to read from the configuration file.
        #   type_ is the optional type to apply, by using .getTYPE to read the
        #       configuration value from the file.

        # [run]
        ('branch', 'run:branch', 'boolean'),
        ('concurrency', 'run:concurrency', 'list'),
        ('cover_pylib', 'run:cover_pylib', 'boolean'),
        ('data_file', 'run:data_file'),
        ('debug', 'run:debug', 'list'),
        ('disable_warnings', 'run:disable_warnings', 'list'),
        ('include', 'run:include', 'list'),
        ('note', 'run:note'),
        ('omit', 'run:omit', 'list'),
        ('parallel', 'run:parallel', 'boolean'),
        ('plugins', 'run:plugins', 'list'),
        ('source', 'run:source', 'list'),
        ('timid', 'run:timid', 'boolean'),

        # [report]
        ('exclude_list', 'report:exclude_lines', 'regexlist'),
        ('fail_under', 'report:fail_under', 'int'),
        ('ignore_errors', 'report:ignore_errors', 'boolean'),
        ('include', 'report:include', 'list'),
        ('omit', 'report:omit', 'list'),
        ('partial_always_list', 'report:partial_branches_always', 'regexlist'),
        ('partial_list', 'report:partial_branches', 'regexlist'),
        ('precision', 'report:precision', 'int'),
        ('show_missing', 'report:show_missing', 'boolean'),
        ('skip_covered', 'report:skip_covered', 'boolean'),
        ('sort', 'report:sort'),

        # [html]
        ('extra_css', 'html:extra_css'),
        ('html_dir', 'html:directory'),
        ('html_title', 'html:title'),

        # [xml]
        ('xml_output', 'xml:output'),
        ('xml_package_depth', 'xml:package_depth', 'int'),
    ]

    def _set_attr_from_config_option(self, cp, attr, where, type_=''):
        """Set an attribute on self if it exists in the ConfigParser.

        Returns True if the attribute was set.

        """
        section, option = where.split(":")
        if cp.has_option(section, option):
            method = getattr(cp, 'get' + type_)
            setattr(self, attr, method(section, option))
            return True
        return False

    def get_plugin_options(self, plugin):
        """Get a dictionary of options for the plugin named `plugin`."""
        return self.plugin_options.get(plugin, {})

    def set_option(self, option_name, value):
        """Set an option in the configuration.

        `option_name` is a colon-separated string indicating the section and
        option name.  For example, the ``branch`` option in the ``[run]``
        section of the config file would be indicated with `"run:branch"`.

        `value` is the new value for the option.

        """

        # Check all the hard-coded options.
        for option_spec in self.CONFIG_FILE_OPTIONS:
            attr, where = option_spec[:2]
            if where == option_name:
                setattr(self, attr, value)
                return

        # See if it's a plugin option.
        plugin_name, _, key = option_name.partition(":")
        if key and plugin_name in self.plugins:
            self.plugin_options.setdefault(plugin_name, {})[key] = value
            return

        # If we get here, we didn't find the option.
        raise CoverageException("No such option: %r" % option_name)

    def get_option(self, option_name):
        """Get an option from the configuration.

        `option_name` is a colon-separated string indicating the section and
        option name.  For example, the ``branch`` option in the ``[run]``
        section of the config file would be indicated with `"run:branch"`.

        Returns the value of the option.

        """
        # Check all the hard-coded options.
        for option_spec in self.CONFIG_FILE_OPTIONS:
            attr, where = option_spec[:2]
            if where == option_name:
                return getattr(self, attr)

        # See if it's a plugin option.
        plugin_name, _, key = option_name.partition(":")
        if key and plugin_name in self.plugins:
            return self.plugin_options.get(plugin_name, {}).get(key)

        # If we get here, we didn't find the option.
        raise CoverageException("No such option: %r" % option_name)


def read_coverage_config(config_file, **kwargs):
    """Read the coverage.py configuration.

    Arguments:
        config_file: a boolean or string, see the `Coverage` class for the
            tricky details.
        all others: keyword arguments from the `Coverage` class, used for
            setting values in the configuration.

    Returns:
        config_file, config:
            config_file is the value to use for config_file in other
            invocations of coverage.

            config is a CoverageConfig object read from the appropriate
            configuration file.

    """
    # Build the configuration from a number of sources:
    # 1) defaults:
    config = CoverageConfig()

    # 2) from a file:
    if config_file:
        # Some API users were specifying ".coveragerc" to mean the same as
        # True, so make it so.
        if config_file == ".coveragerc":
            config_file = True
        specified_file = (config_file is not True)
        if not specified_file:
            config_file = ".coveragerc"

        for fname, prefix in [(config_file, ""),
                                ("setup.cfg", "coverage:"),
                                ("tox.ini", "coverage:")]:
            config_read = config.from_file(fname, section_prefix=prefix)
            is_config_file = fname == config_file

            if not config_read and is_config_file and specified_file:
                raise CoverageException("Couldn't read '%s' as a config file" % fname)

            if config_read:
                break

    # 3) from environment variables:
    env_data_file = os.environ.get('COVERAGE_FILE')
    if env_data_file:
        config.data_file = env_data_file
    debugs = os.environ.get('COVERAGE_DEBUG')
    if debugs:
        config.debug.extend(d.strip() for d in debugs.split(","))

    # 4) from constructor arguments:
    config.from_args(**kwargs)

    return config_file, config
