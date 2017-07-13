# Copyright (c) 2006-2010, 2012-2014 LOGILAB S.A. (Paris, FRANCE) <contact@logilab.fr>
# Copyright (c) 2014-2016 Claudiu Popa <pcmanticore@gmail.com>
# Copyright (c) 2015 Aru Sahni <arusahni@gmail.com>

# Licensed under the GPL: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
# For details: https://github.com/PyCQA/pylint/blob/master/COPYING

"""utilities for Pylint configuration :

* pylintrc
* pylint.d (PYLINTHOME)
"""
from __future__ import print_function

# TODO(cpopa): this module contains the logic for the
# configuration parser and for the command line parser,
# but it's really coupled to optparse's internals.
# The code was copied almost verbatim from logilab.common,
# in order to not depend on it anymore and it will definitely
# need a cleanup. It could be completely reengineered as well.

import contextlib
import collections
import copy
import io
import optparse
import os
import pickle
import re
import sys
import time

import configparser
from six.moves import range

from pylint import utils


USER_HOME = os.path.expanduser('~')
if 'PYLINTHOME' in os.environ:
    PYLINT_HOME = os.environ['PYLINTHOME']
    if USER_HOME == '~':
        USER_HOME = os.path.dirname(PYLINT_HOME)
elif USER_HOME == '~':
    PYLINT_HOME = ".pylint.d"
else:
    PYLINT_HOME = os.path.join(USER_HOME, '.pylint.d')


def _get_pdata_path(base_name, recurs):
    base_name = base_name.replace(os.sep, '_')
    return os.path.join(PYLINT_HOME, "%s%s%s"%(base_name, recurs, '.stats'))


def load_results(base):
    data_file = _get_pdata_path(base, 1)
    try:
        with open(data_file, _PICK_LOAD) as stream:
            return pickle.load(stream)
    except Exception: # pylint: disable=broad-except
        return {}

if sys.version_info < (3, 0):
    _PICK_DUMP, _PICK_LOAD = 'w', 'r'
else:
    _PICK_DUMP, _PICK_LOAD = 'wb', 'rb'

def save_results(results, base):
    if not os.path.exists(PYLINT_HOME):
        try:
            os.mkdir(PYLINT_HOME)
        except OSError:
            print('Unable to create directory %s' % PYLINT_HOME, file=sys.stderr)
    data_file = _get_pdata_path(base, 1)
    try:
        with open(data_file, _PICK_DUMP) as stream:
            pickle.dump(results, stream)
    except (IOError, OSError) as ex:
        print('Unable to create file %s: %s' % (data_file, ex), file=sys.stderr)


def find_pylintrc():
    """search the pylint rc file and return its path if it find it, else None
    """
    # is there a pylint rc file in the current directory ?
    if os.path.exists('pylintrc'):
        return os.path.abspath('pylintrc')
    if os.path.exists('.pylintrc'):
        return os.path.abspath('.pylintrc')
    if os.path.isfile('__init__.py'):
        curdir = os.path.abspath(os.getcwd())
        while os.path.isfile(os.path.join(curdir, '__init__.py')):
            curdir = os.path.abspath(os.path.join(curdir, '..'))
            if os.path.isfile(os.path.join(curdir, 'pylintrc')):
                return os.path.join(curdir, 'pylintrc')
            if os.path.isfile(os.path.join(curdir, '.pylintrc')):
                return os.path.join(curdir, '.pylintrc')
    if 'PYLINTRC' in os.environ and os.path.exists(os.environ['PYLINTRC']):
        pylintrc = os.environ['PYLINTRC']
    else:
        user_home = os.path.expanduser('~')
        if user_home == '~' or user_home == '/root':
            pylintrc = ".pylintrc"
        else:
            pylintrc = os.path.join(user_home, '.pylintrc')
            if not os.path.isfile(pylintrc):
                pylintrc = os.path.join(user_home, '.config', 'pylintrc')
    if not os.path.isfile(pylintrc):
        if os.path.isfile('/etc/pylintrc'):
            pylintrc = '/etc/pylintrc'
        else:
            pylintrc = None
    return pylintrc

PYLINTRC = find_pylintrc()

ENV_HELP = '''
The following environment variables are used:
    * PYLINTHOME
    Path to the directory where the persistent for the run will be stored. If
not found, it defaults to ~/.pylint.d/ or .pylint.d (in the current working
directory).
    * PYLINTRC
    Path to the configuration file. See the documentation for the method used
to search for configuration file.
''' % globals()


class UnsupportedAction(Exception):
    """raised by set_option when it doesn't know what to do for an action"""


def _multiple_choice_validator(choices, name, value):
    values = utils._check_csv(value)
    for csv_value in values:
        if csv_value not in choices:
            msg = "option %s: invalid value: %r, should be in %s"
            raise optparse.OptionValueError(msg % (name, csv_value, choices))
    return values


def _choice_validator(choices, name, value):
    if value not in choices:
        msg = "option %s: invalid value: %r, should be in %s"
        raise optparse.OptionValueError(msg % (name, value, choices))
    return value

# pylint: disable=unused-argument
def _csv_validator(_, name, value):
    return utils._check_csv(value)


# pylint: disable=unused-argument
def _regexp_validator(_, name, value):
    if hasattr(value, 'pattern'):
        return value
    return re.compile(value)

# pylint: disable=unused-argument
def _regexp_csv_validator(_, name, value):
    return [_regexp_validator(_, name, val) for val in _csv_validator(_, name, value)]

def _yn_validator(opt, _, value):
    if isinstance(value, int):
        return bool(value)
    if value in ('y', 'yes'):
        return True
    if value in ('n', 'no'):
        return False
    msg = "option %s: invalid yn value %r, should be in (y, yes, n, no)"
    raise optparse.OptionValueError(msg % (opt, value))


def _non_empty_string_validator(opt, _, value):
    if not value:
        msg = "indent string can't be empty."
        raise optparse.OptionValueError(msg)
    return utils._unquote(value)


VALIDATORS = {
    'string': utils._unquote,
    'int': int,
    'regexp': re.compile,
    'regexp_csv': _regexp_csv_validator,
    'csv': _csv_validator,
    'yn': _yn_validator,
    'choice': lambda opt, name, value: _choice_validator(opt['choices'], name, value),
    'multiple_choice': lambda opt, name, value: _multiple_choice_validator(opt['choices'],
                                                                           name, value),
    'non_empty_string': _non_empty_string_validator,
}

def _call_validator(opttype, optdict, option, value):
    if opttype not in VALIDATORS:
        raise Exception('Unsupported type "%s"' % opttype)
    try:
        return VALIDATORS[opttype](optdict, option, value)
    except TypeError:
        try:
            return VALIDATORS[opttype](value)
        except Exception:
            raise optparse.OptionValueError('%s value (%r) should be of type %s' %
                                            (option, value, opttype))


def _validate(value, optdict, name=''):
    """return a validated value for an option according to its type

    optional argument name is only used for error message formatting
    """
    try:
        _type = optdict['type']
    except KeyError:
        # FIXME
        return value
    return _call_validator(_type, optdict, name, value)


def _level_options(group, outputlevel):
    return [option for option in group.option_list
            if (getattr(option, 'level', 0) or 0) <= outputlevel
            and option.help is not optparse.SUPPRESS_HELP]


def _expand_default(self, option):
    """Patch OptionParser.expand_default with custom behaviour

    This will handle defaults to avoid overriding values in the
    configuration file.
    """
    if self.parser is None or not self.default_tag:
        return option.help
    optname = option._long_opts[0][2:]
    try:
        provider = self.parser.options_manager._all_options[optname]
    except KeyError:
        value = None
    else:
        optdict = provider.get_option_def(optname)
        optname = provider.option_attrname(optname, optdict)
        value = getattr(provider.config, optname, optdict)
        value = utils._format_option_value(optdict, value)
    if value is optparse.NO_DEFAULT or not value:
        value = self.NO_DEFAULT_VALUE
    return option.help.replace(self.default_tag, str(value))


@contextlib.contextmanager
def _patch_optparse():
    orig_default = optparse.HelpFormatter
    try:
        optparse.HelpFormatter.expand_default = _expand_default
        yield
    finally:
        optparse.HelpFormatter.expand_default = orig_default


def _multiple_choices_validating_option(opt, name, value):
    return _multiple_choice_validator(opt.choices, name, value)


class Option(optparse.Option):
    TYPES = optparse.Option.TYPES + ('regexp', 'regexp_csv', 'csv', 'yn',
                                     'multiple_choice',
                                     'non_empty_string')
    ATTRS = optparse.Option.ATTRS + ['hide', 'level']
    TYPE_CHECKER = copy.copy(optparse.Option.TYPE_CHECKER)
    TYPE_CHECKER['regexp'] = _regexp_validator
    TYPE_CHECKER['regexp_csv'] = _regexp_csv_validator
    TYPE_CHECKER['csv'] = _csv_validator
    TYPE_CHECKER['yn'] = _yn_validator
    TYPE_CHECKER['multiple_choice'] = _multiple_choices_validating_option
    TYPE_CHECKER['non_empty_string'] = _non_empty_string_validator

    def __init__(self, *opts, **attrs):
        optparse.Option.__init__(self, *opts, **attrs)
        if hasattr(self, "hide") and self.hide:
            self.help = optparse.SUPPRESS_HELP

    def _check_choice(self):
        if self.type in ("choice", "multiple_choice"):
            if self.choices is None:
                raise optparse.OptionError(
                    "must supply a list of choices for type 'choice'", self)
            elif not isinstance(self.choices, (tuple, list)):
                raise optparse.OptionError(
                    "choices must be a list of strings ('%s' supplied)"
                    % str(type(self.choices)).split("'")[1], self)
        elif self.choices is not None:
            raise optparse.OptionError(
                "must not supply choices for type %r" % self.type, self)
    optparse.Option.CHECK_METHODS[2] = _check_choice

    def process(self, opt, value, values, parser):
        # First, convert the value(s) to the right type.  Howl if any
        # value(s) are bogus.
        value = self.convert_value(opt, value)
        if self.type == 'named':
            existent = getattr(values, self.dest)
            if existent:
                existent.update(value)
                value = existent
        # And then take whatever action is expected of us.
        # This is a separate method to make life easier for
        # subclasses to add new actions.
        return self.take_action(
            self.action, self.dest, opt, value, values, parser)


class OptionParser(optparse.OptionParser):

    def __init__(self, option_class=Option, *args, **kwargs):
        optparse.OptionParser.__init__(self, option_class=Option, *args, **kwargs)

    def format_option_help(self, formatter=None):
        if formatter is None:
            formatter = self.formatter
        outputlevel = getattr(formatter, 'output_level', 0)
        formatter.store_option_strings(self)
        result = []
        result.append(formatter.format_heading("Options"))
        formatter.indent()
        if self.option_list:
            result.append(optparse.OptionContainer.format_option_help(self, formatter))
            result.append("\n")
        for group in self.option_groups:
            if group.level <= outputlevel and (
                    group.description or _level_options(group, outputlevel)):
                result.append(group.format_help(formatter))
                result.append("\n")
        formatter.dedent()
        # Drop the last "\n", or the header if no options or option groups:
        return "".join(result[:-1])

    def _match_long_opt(self, opt):
        """Disable abbreviations."""
        if opt not in self._long_opt:
            raise optparse.BadOptionError(opt)
        return opt


# pylint: disable=abstract-method; by design?
class _ManHelpFormatter(optparse.HelpFormatter):

    def __init__(self, indent_increment=0, max_help_position=24,
                 width=79, short_first=0):
        optparse.HelpFormatter.__init__(
            self, indent_increment, max_help_position, width, short_first)

    def format_heading(self, heading):
        return '.SH %s\n' % heading.upper()

    def format_description(self, description):
        return description

    def format_option(self, option):
        try:
            optstring = option.option_strings
        except AttributeError:
            optstring = self.format_option_strings(option)
        if option.help:
            help_text = self.expand_default(option)
            help = ' '.join([l.strip() for l in help_text.splitlines()])
        else:
            help = ''
        return '''.IP "%s"
%s
''' % (optstring, help)

    def format_head(self, optparser, pkginfo, section=1):
        long_desc = ""
        try:
            pgm = optparser._get_prog_name()
        except AttributeError:
            # py >= 2.4.X (dunno which X exactly, at least 2)
            pgm = optparser.get_prog_name()
        short_desc = self.format_short_description(pgm, pkginfo.description)
        if hasattr(pkginfo, "long_desc"):
            long_desc = self.format_long_description(pgm, pkginfo.long_desc)
        return '%s\n%s\n%s\n%s' % (self.format_title(pgm, section),
                                   short_desc, self.format_synopsis(pgm),
                                   long_desc)

    @staticmethod
    def format_title(pgm, section):
        date = '-'.join(str(num) for num in time.localtime()[:3])
        return '.TH %s %s "%s" %s' % (pgm, section, date, pgm)

    @staticmethod
    def format_short_description(pgm, short_desc):
        return '''.SH NAME
.B %s
\\- %s
''' % (pgm, short_desc.strip())

    @staticmethod
    def format_synopsis(pgm):
        return '''.SH SYNOPSIS
.B  %s
[
.I OPTIONS
] [
.I <arguments>
]
''' % pgm

    @staticmethod
    def format_long_description(pgm, long_desc):
        long_desc = '\n'.join(line.lstrip()
                              for line in long_desc.splitlines())
        long_desc = long_desc.replace('\n.\n', '\n\n')
        if long_desc.lower().startswith(pgm):
            long_desc = long_desc[len(pgm):]
        return '''.SH DESCRIPTION
.B %s
%s
''' % (pgm, long_desc.strip())

    @staticmethod
    def format_tail(pkginfo):
        tail = '''.SH SEE ALSO
/usr/share/doc/pythonX.Y-%s/

.SH BUGS
Please report bugs on the project\'s mailing list:
%s

.SH AUTHOR
%s <%s>
''' % (getattr(pkginfo, 'debian_name', pkginfo.modname),
       pkginfo.mailinglist, pkginfo.author, pkginfo.author_email)

        if hasattr(pkginfo, "copyright"):
            tail += '''
.SH COPYRIGHT
%s
''' % pkginfo.copyright

        return tail


class OptionsManagerMixIn(object):
    """Handle configuration from both a configuration file and command line options"""

    def __init__(self, usage, config_file=None, version=None, quiet=0):
        self.config_file = config_file
        self.reset_parsers(usage, version=version)
        # list of registered options providers
        self.options_providers = []
        # dictionary associating option name to checker
        self._all_options = collections.OrderedDict()
        self._short_options = {}
        self._nocallback_options = {}
        self._mygroups = {}
        # verbosity
        self.quiet = quiet
        self._maxlevel = 0

    def reset_parsers(self, usage='', version=None):
        # configuration file parser
        self.cfgfile_parser = configparser.ConfigParser(inline_comment_prefixes=('#', ';'))
        # command line parser
        self.cmdline_parser = OptionParser(usage=usage, version=version)
        self.cmdline_parser.options_manager = self
        self._optik_option_attrs = set(self.cmdline_parser.option_class.ATTRS)

    def register_options_provider(self, provider, own_group=True):
        """register an options provider"""
        assert provider.priority <= 0, "provider's priority can't be >= 0"
        for i in range(len(self.options_providers)):
            if provider.priority > self.options_providers[i].priority:
                self.options_providers.insert(i, provider)
                break
        else:
            self.options_providers.append(provider)
        non_group_spec_options = [option for option in provider.options
                                  if 'group' not in option[1]]
        groups = getattr(provider, 'option_groups', ())
        if own_group and non_group_spec_options:
            self.add_option_group(provider.name.upper(), provider.__doc__,
                                  non_group_spec_options, provider)
        else:
            for opt, optdict in non_group_spec_options:
                self.add_optik_option(provider, self.cmdline_parser, opt, optdict)
        for gname, gdoc in groups:
            gname = gname.upper()
            goptions = [option for option in provider.options
                        if option[1].get('group', '').upper() == gname]
            self.add_option_group(gname, gdoc, goptions, provider)

    def add_option_group(self, group_name, _, options, provider):
        # add option group to the command line parser
        if group_name in self._mygroups:
            group = self._mygroups[group_name]
        else:
            group = optparse.OptionGroup(self.cmdline_parser,
                                         title=group_name.capitalize())
            self.cmdline_parser.add_option_group(group)
            group.level = provider.level
            self._mygroups[group_name] = group
            # add section to the config file
            if group_name != "DEFAULT" and \
                    group_name not in self.cfgfile_parser._sections:
                self.cfgfile_parser.add_section(group_name)
        # add provider's specific options
        for opt, optdict in options:
            self.add_optik_option(provider, group, opt, optdict)

    def add_optik_option(self, provider, optikcontainer, opt, optdict):
        args, optdict = self.optik_option(provider, opt, optdict)
        option = optikcontainer.add_option(*args, **optdict)
        self._all_options[opt] = provider
        self._maxlevel = max(self._maxlevel, option.level or 0)

    def optik_option(self, provider, opt, optdict):
        """get our personal option definition and return a suitable form for
        use with optik/optparse
        """
        optdict = copy.copy(optdict)
        if 'action' in optdict:
            self._nocallback_options[provider] = opt
        else:
            optdict['action'] = 'callback'
            optdict['callback'] = self.cb_set_provider_option
        # default is handled here and *must not* be given to optik if you
        # want the whole machinery to work
        if 'default' in optdict:
            if ('help' in optdict
                    and optdict.get('default') is not None
                    and optdict['action'] not in ('store_true', 'store_false')):
                optdict['help'] += ' [current: %default]'
            del optdict['default']
        args = ['--' + str(opt)]
        if 'short' in optdict:
            self._short_options[optdict['short']] = opt
            args.append('-' + optdict['short'])
            del optdict['short']
        # cleanup option definition dict before giving it to optik
        for key in list(optdict.keys()):
            if key not in self._optik_option_attrs:
                optdict.pop(key)
        return args, optdict

    def cb_set_provider_option(self, option, opt, value, parser):
        """optik callback for option setting"""
        if opt.startswith('--'):
            # remove -- on long option
            opt = opt[2:]
        else:
            # short option, get its long equivalent
            opt = self._short_options[opt[1:]]
        # trick since we can't set action='store_true' on options
        if value is None:
            value = 1
        self.global_set_option(opt, value)

    def global_set_option(self, opt, value):
        """set option on the correct option provider"""
        self._all_options[opt].set_option(opt, value)

    def generate_config(self, stream=None, skipsections=(), encoding=None):
        """write a configuration file according to the current configuration
        into the given stream or stdout
        """
        options_by_section = {}
        sections = []
        for provider in self.options_providers:
            for section, options in provider.options_by_section():
                if section is None:
                    section = provider.name
                if section in skipsections:
                    continue
                options = [(n, d, v) for (n, d, v) in options
                           if d.get('type') is not None
                           and not d.get('deprecated')]
                if not options:
                    continue
                if section not in sections:
                    sections.append(section)
                alloptions = options_by_section.setdefault(section, [])
                alloptions += options
        stream = stream or sys.stdout
        encoding = utils._get_encoding(encoding, stream)
        printed = False
        for section in sections:
            if printed:
                print('\n', file=stream)
            utils.format_section(stream, section.upper(),
                                 sorted(options_by_section[section]),
                                 encoding)
            printed = True

    def generate_manpage(self, pkginfo, section=1, stream=None):
        with _patch_optparse():
            _generate_manpage(self.cmdline_parser, pkginfo,
                              section, stream=stream or sys.stdout,
                              level=self._maxlevel)

    def load_provider_defaults(self):
        """initialize configuration using default values"""
        for provider in self.options_providers:
            provider.load_defaults()

    def read_config_file(self, config_file=None):
        """read the configuration file but do not load it (i.e. dispatching
        values to each options provider)
        """
        helplevel = 1
        while helplevel <= self._maxlevel:
            opt = '-'.join(['long'] * helplevel) + '-help'
            if opt in self._all_options:
                break # already processed
            # pylint: disable=unused-argument
            def helpfunc(option, opt, val, p, level=helplevel):
                print(self.help(level))
                sys.exit(0)
            helpmsg = '%s verbose help.' % ' '.join(['more'] * helplevel)
            optdict = {'action': 'callback', 'callback': helpfunc,
                       'help': helpmsg}
            provider = self.options_providers[0]
            self.add_optik_option(provider, self.cmdline_parser, opt, optdict)
            provider.options += ((opt, optdict),)
            helplevel += 1
        if config_file is None:
            config_file = self.config_file
        if config_file is not None:
            config_file = os.path.expanduser(config_file)
        if config_file and os.path.exists(config_file):
            parser = self.cfgfile_parser

            # Use this encoding in order to strip the BOM marker, if any.
            with io.open(config_file, 'r', encoding='utf_8_sig') as fp:
                # pylint: disable=deprecated-method
                parser.readfp(fp)

            # normalize sections'title
            for sect, values in list(parser._sections.items()):
                if not sect.isupper() and values:
                    parser._sections[sect.upper()] = values
        elif not self.quiet:
            msg = 'No config file found, using default configuration'
            print(msg, file=sys.stderr)
            return

    def load_config_file(self):
        """dispatch values previously read from a configuration file to each
        options provider)
        """
        parser = self.cfgfile_parser
        for section in parser.sections():
            for option, value in parser.items(section):
                try:
                    self.global_set_option(option, value)
                except (KeyError, optparse.OptionError):
                    # TODO handle here undeclared options appearing in the config file
                    continue

    def load_configuration(self, **kwargs):
        """override configuration according to given parameters"""
        return self.load_configuration_from_config(kwargs)

    def load_configuration_from_config(self, config):
        for opt, opt_value in config.items():
            opt = opt.replace('_', '-')
            provider = self._all_options[opt]
            provider.set_option(opt, opt_value)

    def load_command_line_configuration(self, args=None):
        """Override configuration according to command line parameters

        return additional arguments
        """
        with _patch_optparse():
            if args is None:
                args = sys.argv[1:]
            else:
                args = list(args)
            (options, args) = self.cmdline_parser.parse_args(args=args)
            for provider in self._nocallback_options:
                config = provider.config
                for attr in config.__dict__.keys():
                    value = getattr(options, attr, None)
                    if value is None:
                        continue
                    setattr(config, attr, value)
            return args

    def add_help_section(self, title, description, level=0):
        """add a dummy option section for help purpose """
        group = optparse.OptionGroup(self.cmdline_parser,
                                     title=title.capitalize(),
                                     description=description)
        group.level = level
        self._maxlevel = max(self._maxlevel, level)
        self.cmdline_parser.add_option_group(group)

    def help(self, level=0):
        """return the usage string for available options """
        self.cmdline_parser.formatter.output_level = level
        with _patch_optparse():
            return self.cmdline_parser.format_help()


class OptionsProviderMixIn(object):
    """Mixin to provide options to an OptionsManager"""

    # those attributes should be overridden
    priority = -1
    name = 'default'
    options = ()
    level = 0

    def __init__(self):
        self.config = optparse.Values()
        self.load_defaults()

    def load_defaults(self):
        """initialize the provider using default values"""
        for opt, optdict in self.options:
            action = optdict.get('action')
            if action != 'callback':
                # callback action have no default
                if optdict is None:
                    optdict = self.get_option_def(opt)
                default = optdict.get('default')
                self.set_option(opt, default, action, optdict)

    def option_attrname(self, opt, optdict=None):
        """get the config attribute corresponding to opt"""
        if optdict is None:
            optdict = self.get_option_def(opt)
        return optdict.get('dest', opt.replace('-', '_'))

    def option_value(self, opt):
        """get the current value for the given option"""
        return getattr(self.config, self.option_attrname(opt), None)

    def set_option(self, optname, value, action=None, optdict=None):
        """method called to set an option (registered in the options list)"""
        if optdict is None:
            optdict = self.get_option_def(optname)
        if value is not None:
            value = _validate(value, optdict, optname)
        if action is None:
            action = optdict.get('action', 'store')
        if action == 'store':
            setattr(self.config, self.option_attrname(optname, optdict), value)
        elif action in ('store_true', 'count'):
            setattr(self.config, self.option_attrname(optname, optdict), 0)
        elif action == 'store_false':
            setattr(self.config, self.option_attrname(optname, optdict), 1)
        elif action == 'append':
            optname = self.option_attrname(optname, optdict)
            _list = getattr(self.config, optname, None)
            if _list is None:
                if isinstance(value, (list, tuple)):
                    _list = value
                elif value is not None:
                    _list = []
                    _list.append(value)
                setattr(self.config, optname, _list)
            elif isinstance(_list, tuple):
                setattr(self.config, optname, _list + (value,))
            else:
                _list.append(value)
        elif action == 'callback':
            optdict['callback'](None, optname, value, None)
        else:
            raise UnsupportedAction(action)

    def get_option_def(self, opt):
        """return the dictionary defining an option given its name"""
        assert self.options
        for option in self.options:
            if option[0] == opt:
                return option[1]
        raise optparse.OptionError('no such option %s in section %r'
                                   % (opt, self.name), opt)

    def options_by_section(self):
        """return an iterator on options grouped by section

        (section, [list of (optname, optdict, optvalue)])
        """
        sections = {}
        for optname, optdict in self.options:
            sections.setdefault(optdict.get('group'), []).append(
                (optname, optdict, self.option_value(optname)))
        if None in sections:
            yield None, sections.pop(None)
        for section, options in sorted(sections.items()):
            yield section.upper(), options

    def options_and_values(self, options=None):
        if options is None:
            options = self.options
        for optname, optdict in options:
            yield (optname, optdict, self.option_value(optname))


class ConfigurationMixIn(OptionsManagerMixIn, OptionsProviderMixIn):
    """basic mixin for simple configurations which don't need the
    manager / providers model
    """
    def __init__(self, *args, **kwargs):
        if not args:
            kwargs.setdefault('usage', '')
        kwargs.setdefault('quiet', 1)
        OptionsManagerMixIn.__init__(self, *args, **kwargs)
        OptionsProviderMixIn.__init__(self)
        if not getattr(self, 'option_groups', None):
            self.option_groups = []
            for _, optdict in self.options:
                try:
                    gdef = (optdict['group'].upper(), '')
                except KeyError:
                    continue
                if gdef not in self.option_groups:
                    self.option_groups.append(gdef)
        self.register_options_provider(self, own_group=False)


def _generate_manpage(optparser, pkginfo, section=1,
                      stream=sys.stdout, level=0):
    formatter = _ManHelpFormatter()
    formatter.output_level = level
    formatter.parser = optparser
    print(formatter.format_head(optparser, pkginfo, section), file=stream)
    print(optparser.format_option_help(formatter), file=stream)
    print(formatter.format_tail(pkginfo), file=stream)
