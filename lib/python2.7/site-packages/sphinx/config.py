# -*- coding: utf-8 -*-
"""
    sphinx.config
    ~~~~~~~~~~~~~

    Build configuration file handling.

    :copyright: Copyright 2007-2017 by the Sphinx team, see AUTHORS.
    :license: BSD, see LICENSE for details.
"""

import re
from os import path, getenv

from six import PY2, PY3, iteritems, string_types, binary_type, text_type, integer_types
from typing import Any, NamedTuple, Union

from sphinx.errors import ConfigError
from sphinx.locale import l_, _
from sphinx.util import logging
from sphinx.util.i18n import format_date
from sphinx.util.osutil import cd
from sphinx.util.pycompat import execfile_, NoneType

if False:
    # For type annotation
    from typing import Any, Callable, Dict, Iterable, Iterator, List, Tuple  # NOQA
    from sphinx.util.tags import Tags  # NOQA

logger = logging.getLogger(__name__)

nonascii_re = re.compile(br'[\x80-\xff]')
copyright_year_re = re.compile(r'^((\d{4}-)?)(\d{4})(?=[ ,])')

CONFIG_SYNTAX_ERROR = "There is a syntax error in your configuration file: %s"
if PY3:
    CONFIG_SYNTAX_ERROR += "\nDid you change the syntax from 2.x to 3.x?"
CONFIG_EXIT_ERROR = "The configuration file (or one of the modules it imports) " \
                    "called sys.exit()"
CONFIG_ENUM_WARNING = "The config value `{name}` has to be a one of {candidates}, " \
                      "but `{current}` is given."
CONFIG_PERMITTED_TYPE_WARNING = "The config value `{name}' has type `{current.__name__}', " \
                                "expected to {permitted}."
CONFIG_TYPE_WARNING = "The config value `{name}' has type `{current.__name__}', " \
                      "defaults to `{default.__name__}'."

if PY3:
    unicode = str  # special alias for static typing...

ConfigValue = NamedTuple('ConfigValue', [('name', str),
                                         ('value', Any),
                                         ('rebuild', Union[bool, unicode])])


class ENUM(object):
    """represents the config value should be a one of candidates.

    Example:
        app.add_config_value('latex_show_urls', 'no', None, ENUM('no', 'footnote', 'inline'))
    """
    def __init__(self, *candidates):
        # type: (unicode) -> None
        self.candidates = candidates

    def match(self, value):
        # type: (unicode) -> bool
        return value in self.candidates


string_classes = [text_type]  # type: List
if PY2:
    string_classes.append(binary_type)  # => [str, unicode]


class Config(object):
    """
    Configuration file abstraction.
    """

    # the values are: (default, what needs to be rebuilt if changed)

    # If you add a value here, don't forget to include it in the
    # quickstart.py file template as well as in the docs!

    config_values = dict(
        # general options
        project = ('Python', 'env'),
        copyright = ('', 'html'),
        version = ('', 'env'),
        release = ('', 'env'),
        today = ('', 'env'),
        # the real default is locale-dependent
        today_fmt = (None, 'env', string_classes),

        language = (None, 'env', string_classes),
        locale_dirs = (['locales'], 'env'),
        figure_language_filename = (u'{root}.{language}{ext}', 'env', [str]),

        master_doc = ('contents', 'env'),
        source_suffix = (['.rst'], 'env'),
        source_encoding = ('utf-8-sig', 'env'),
        source_parsers = ({}, 'env'),
        exclude_patterns = ([], 'env'),
        default_role = (None, 'env', string_classes),
        add_function_parentheses = (True, 'env'),
        add_module_names = (True, 'env'),
        trim_footnote_reference_space = (False, 'env'),
        show_authors = (False, 'env'),
        pygments_style = (None, 'html', string_classes),
        highlight_language = ('default', 'env'),
        highlight_options = ({}, 'env'),
        templates_path = ([], 'html'),
        template_bridge = (None, 'html', string_classes),
        keep_warnings = (False, 'env'),
        suppress_warnings = ([], 'env'),
        modindex_common_prefix = ([], 'html'),
        rst_epilog = (None, 'env', string_classes),
        rst_prolog = (None, 'env', string_classes),
        trim_doctest_flags = (True, 'env'),
        primary_domain = ('py', 'env', [NoneType]),
        needs_sphinx = (None, None, string_classes),
        needs_extensions = ({}, None),
        nitpicky = (False, None),
        nitpick_ignore = ([], None),
        numfig = (False, 'env'),
        numfig_secnum_depth = (1, 'env'),
        numfig_format = ({'section': l_('Section %s'),
                          'figure': l_('Fig. %s'),
                          'table': l_('Table %s'),
                          'code-block': l_('Listing %s')},
                         'env'),

        tls_verify = (True, 'env'),
        tls_cacerts = (None, 'env'),
    )  # type: Dict[unicode, Tuple]

    def __init__(self, dirname, filename, overrides, tags):
        # type: (unicode, unicode, Dict, Tags) -> None
        self.overrides = overrides
        self.values = Config.config_values.copy()
        config = {}  # type: Dict[unicode, Any]
        if dirname is not None:
            config_file = path.join(dirname, filename)
            config['__file__'] = config_file
            config['tags'] = tags
            with cd(dirname):
                # we promise to have the config dir as current dir while the
                # config file is executed
                try:
                    execfile_(filename, config)
                except SyntaxError as err:
                    raise ConfigError(CONFIG_SYNTAX_ERROR % err)
                except SystemExit:
                    raise ConfigError(CONFIG_EXIT_ERROR)

        self._raw_config = config
        # these two must be preinitialized because extensions can add their
        # own config values
        self.setup = config.get('setup', None)  # type: Callable

        if 'extensions' in overrides:
            if isinstance(overrides['extensions'], string_types):
                config['extensions'] = overrides.pop('extensions').split(',')
            else:
                config['extensions'] = overrides.pop('extensions')
        self.extensions = config.get('extensions', [])  # type: List[unicode]

        # correct values of copyright year that are not coherent with
        # the SOURCE_DATE_EPOCH environment variable (if set)
        # See https://reproducible-builds.org/specs/source-date-epoch/
        if getenv('SOURCE_DATE_EPOCH') is not None:
            for k in ('copyright', 'epub_copyright'):
                if k in config:
                    config[k] = copyright_year_re.sub(r'\g<1>%s' % format_date('%Y'),
                                                      config[k])

    def check_types(self):
        # type: () -> None
        # check all values for deviation from the default value's type, since
        # that can result in TypeErrors all over the place
        # NB. since config values might use l_() we have to wait with calling
        # this method until i18n is initialized
        for name in self._raw_config:
            if name not in self.values:
                continue  # we don't know a default value
            settings = self.values[name]
            default, dummy_rebuild = settings[:2]
            permitted = settings[2] if len(settings) == 3 else ()

            if hasattr(default, '__call__'):
                default = default(self)  # could invoke l_()
            if default is None and not permitted:
                continue  # neither inferrable nor expliclitly permitted types
            current = self[name]
            if isinstance(permitted, ENUM):
                if not permitted.match(current):
                    logger.warning(CONFIG_ENUM_WARNING.format(
                        name=name, current=current, candidates=permitted.candidates))
            else:
                if type(current) is type(default):
                    continue
                if type(current) in permitted:
                    continue

                common_bases = (set(type(current).__bases__ + (type(current),)) &
                                set(type(default).__bases__))
                common_bases.discard(object)
                if common_bases:
                    continue  # at least we share a non-trivial base class

                if permitted:
                    logger.warning(CONFIG_PERMITTED_TYPE_WARNING.format(
                        name=name, current=type(current),
                        permitted=str([cls.__name__ for cls in permitted])))
                else:
                    logger.warning(CONFIG_TYPE_WARNING.format(
                        name=name, current=type(current), default=type(default)))

    def check_unicode(self):
        # type: () -> None
        # check all string values for non-ASCII characters in bytestrings,
        # since that can result in UnicodeErrors all over the place
        for name, value in iteritems(self._raw_config):
            if isinstance(value, binary_type) and nonascii_re.search(value):
                logger.warning('the config value %r is set to a string with non-ASCII '
                               'characters; this can lead to Unicode errors occurring. '
                               'Please use Unicode strings, e.g. %r.', name, u'Content')

    def convert_overrides(self, name, value):
        # type: (unicode, Any) -> Any
        if not isinstance(value, string_types):
            return value
        else:
            defvalue = self.values[name][0]
            if isinstance(defvalue, dict):
                raise ValueError(_('cannot override dictionary config setting %r, '
                                   'ignoring (use %r to set individual elements)') %
                                 (name, name + '.key=value'))
            elif isinstance(defvalue, list):
                return value.split(',')
            elif isinstance(defvalue, integer_types):
                try:
                    return int(value)
                except ValueError:
                    raise ValueError(_('invalid number %r for config value %r, ignoring') %
                                     (value, name))
            elif hasattr(defvalue, '__call__'):
                return value
            elif defvalue is not None and not isinstance(defvalue, string_types):
                raise ValueError(_('cannot override config setting %r with unsupported '
                                   'type, ignoring') % name)
            else:
                return value

    def pre_init_values(self):
        # type: () -> None
        """
        Initialize some limited config variables before initialize i18n and loading extensions
        """
        variables = ['needs_sphinx', 'suppress_warnings', 'language', 'locale_dirs']
        for name in variables:
            try:
                if name in self.overrides:
                    self.__dict__[name] = self.convert_overrides(name, self.overrides[name])
                elif name in self._raw_config:
                    self.__dict__[name] = self._raw_config[name]
            except ValueError as exc:
                logger.warning("%s", exc)

    def init_values(self):
        # type: () -> None
        config = self._raw_config
        for valname, value in iteritems(self.overrides):
            try:
                if '.' in valname:
                    realvalname, key = valname.split('.', 1)
                    config.setdefault(realvalname, {})[key] = value
                    continue
                elif valname not in self.values:
                    logger.warning(_('unknown config value %r in override, ignoring'), valname)
                    continue
                if isinstance(value, string_types):
                    config[valname] = self.convert_overrides(valname, value)
                else:
                    config[valname] = value
            except ValueError as exc:
                logger.warning("%s", exc)
        for name in config:
            if name in self.values:
                self.__dict__[name] = config[name]
        if isinstance(self.source_suffix, string_types):  # type: ignore
            self.source_suffix = [self.source_suffix]  # type: ignore

    def __getattr__(self, name):
        # type: (unicode) -> Any
        if name.startswith('_'):
            raise AttributeError(name)
        if name not in self.values:
            raise AttributeError(_('No such config value: %s') % name)
        default = self.values[name][0]
        if hasattr(default, '__call__'):
            return default(self)
        return default

    def __getitem__(self, name):
        # type: (unicode) -> unicode
        return getattr(self, name)

    def __setitem__(self, name, value):
        # type: (unicode, Any) -> None
        setattr(self, name, value)

    def __delitem__(self, name):
        # type: (unicode) -> None
        delattr(self, name)

    def __contains__(self, name):
        # type: (unicode) -> bool
        return name in self.values

    def __iter__(self):
        # type: () -> Iterable[ConfigValue]
        for name, value in iteritems(self.values):
            yield ConfigValue(name, getattr(self, name), value[1])  # type: ignore

    def add(self, name, default, rebuild, types):
        # type: (unicode, Any, Union[bool, unicode], Any) -> None
        self.values[name] = (default, rebuild, types)

    def filter(self, rebuild):
        # type: (str) -> Iterator[ConfigValue]
        return (value for value in self if value.rebuild == rebuild)  # type: ignore
