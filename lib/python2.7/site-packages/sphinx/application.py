# -*- coding: utf-8 -*-
"""
    sphinx.application
    ~~~~~~~~~~~~~~~~~~

    Sphinx application object.

    Gracefully adapted from the TextPress system by Armin.

    :copyright: Copyright 2007-2017 by the Sphinx team, see AUTHORS.
    :license: BSD, see LICENSE for details.
"""
from __future__ import print_function

import os
import sys
import warnings
import posixpath
from os import path
from collections import deque

from six import iteritems
from six.moves import cStringIO

from docutils import nodes
from docutils.parsers.rst import directives, roles

import sphinx
from sphinx import package_dir, locale
from sphinx.config import Config
from sphinx.errors import ConfigError, ExtensionError, VersionRequirementError
from sphinx.deprecation import RemovedInSphinx17Warning, RemovedInSphinx20Warning
from sphinx.environment import BuildEnvironment
from sphinx.events import EventManager
from sphinx.extension import verify_required_extensions
from sphinx.io import SphinxStandaloneReader
from sphinx.locale import _
from sphinx.registry import SphinxComponentRegistry
from sphinx.util import pycompat  # noqa: F401
from sphinx.util import import_object
from sphinx.util import logging
from sphinx.util import status_iterator, old_status_iterator, display_chunk
from sphinx.util.tags import Tags
from sphinx.util.osutil import ENOENT
from sphinx.util.console import bold, darkgreen  # type: ignore
from sphinx.util.docutils import is_html5_writer_available, directive_helper
from sphinx.util.i18n import find_catalog_source_files

if False:
    # For type annotation
    from typing import Any, Callable, Dict, IO, Iterable, Iterator, List, Tuple, Type, Union  # NOQA
    from docutils.parsers import Parser  # NOQA
    from docutils.transform import Transform  # NOQA
    from sphinx.builders import Builder  # NOQA
    from sphinx.domains import Domain, Index  # NOQA
    from sphinx.environment.collectors import EnvironmentCollector  # NOQA
    from sphinx.extension import Extension  # NOQA
    from sphinx.theming import Theme  # NOQA

builtin_extensions = (
    'sphinx.builders.applehelp',
    'sphinx.builders.changes',
    'sphinx.builders.epub2',
    'sphinx.builders.epub3',
    'sphinx.builders.devhelp',
    'sphinx.builders.dummy',
    'sphinx.builders.gettext',
    'sphinx.builders.html',
    'sphinx.builders.htmlhelp',
    'sphinx.builders.latex',
    'sphinx.builders.linkcheck',
    'sphinx.builders.manpage',
    'sphinx.builders.qthelp',
    'sphinx.builders.texinfo',
    'sphinx.builders.text',
    'sphinx.builders.websupport',
    'sphinx.builders.xml',
    'sphinx.domains.c',
    'sphinx.domains.cpp',
    'sphinx.domains.javascript',
    'sphinx.domains.python',
    'sphinx.domains.rst',
    'sphinx.domains.std',
    'sphinx.directives',
    'sphinx.directives.code',
    'sphinx.directives.other',
    'sphinx.directives.patches',
    'sphinx.parsers',
    'sphinx.roles',
    'sphinx.transforms.post_transforms',
    'sphinx.transforms.post_transforms.images',
    # collectors should be loaded by specific order
    'sphinx.environment.collectors.dependencies',
    'sphinx.environment.collectors.asset',
    'sphinx.environment.collectors.metadata',
    'sphinx.environment.collectors.title',
    'sphinx.environment.collectors.toctree',
    'sphinx.environment.collectors.indexentries',
    # Strictly, alabaster theme is not a builtin extension,
    # but it is loaded automatically to use it as default theme.
    'alabaster',
)  # type: Tuple[unicode, ...]

CONFIG_FILENAME = 'conf.py'
ENV_PICKLE_FILENAME = 'environment.pickle'

logger = logging.getLogger(__name__)


class Sphinx(object):

    def __init__(self, srcdir, confdir, outdir, doctreedir, buildername,
                 confoverrides=None, status=sys.stdout, warning=sys.stderr,
                 freshenv=False, warningiserror=False, tags=None, verbosity=0,
                 parallel=0):
        # type: (unicode, unicode, unicode, unicode, unicode, Dict, IO, IO, bool, bool, List[unicode], int, int) -> None  # NOQA
        self.verbosity = verbosity
        self.extensions = {}                    # type: Dict[unicode, Extension]
        self._setting_up_extension = ['?']      # type: List[unicode]
        self.builder = None                     # type: Builder
        self.env = None                         # type: BuildEnvironment
        self.registry = SphinxComponentRegistry()
        self.enumerable_nodes = {}              # type: Dict[nodes.Node, Tuple[unicode, Callable]]  # NOQA
        self.post_transforms = []               # type: List[Transform]
        self.html_themes = {}                   # type: Dict[unicode, unicode]

        self.srcdir = srcdir
        self.confdir = confdir
        self.outdir = outdir
        self.doctreedir = doctreedir

        self.parallel = parallel

        if status is None:
            self._status = cStringIO()      # type: IO
            self.quiet = True
        else:
            self._status = status
            self.quiet = False

        if warning is None:
            self._warning = cStringIO()     # type: IO
        else:
            self._warning = warning
        self._warncount = 0
        self.warningiserror = warningiserror
        logging.setup(self, self._status, self._warning)

        self.events = EventManager()

        # keep last few messages for traceback
        # This will be filled by sphinx.util.logging.LastMessagesWriter
        self.messagelog = deque(maxlen=10)  # type: deque

        # say hello to the world
        logger.info(bold('Running Sphinx v%s' % sphinx.__display_version__))

        # status code for command-line application
        self.statuscode = 0

        if not path.isdir(outdir):
            logger.info('making output directory...')
            os.makedirs(outdir)

        # read config
        self.tags = Tags(tags)
        self.config = Config(confdir, CONFIG_FILENAME,
                             confoverrides or {}, self.tags)
        self.config.check_unicode()
        # defer checking types until i18n has been initialized

        # initialize some limited config variables before initialize i18n and loading
        # extensions
        self.config.pre_init_values()

        # set up translation infrastructure
        self._init_i18n()

        # check the Sphinx version if requested
        if self.config.needs_sphinx and self.config.needs_sphinx > sphinx.__display_version__:
            raise VersionRequirementError(
                _('This project needs at least Sphinx v%s and therefore cannot '
                  'be built with this version.') % self.config.needs_sphinx)

        # set confdir to srcdir if -C given (!= no confdir); a few pieces
        # of code expect a confdir to be set
        if self.confdir is None:
            self.confdir = self.srcdir

        # load all built-in extension modules
        for extension in builtin_extensions:
            self.setup_extension(extension)

        # load all user-given extension modules
        for extension in self.config.extensions:
            self.setup_extension(extension)

        # preload builder module (before init config values)
        self.preload_builder(buildername)

        # the config file itself can be an extension
        if self.config.setup:
            self._setting_up_extension = ['conf.py']
            # py31 doesn't have 'callable' function for below check
            if hasattr(self.config.setup, '__call__'):
                self.config.setup(self)
            else:
                raise ConfigError(
                    _("'setup' as currently defined in conf.py isn't a Python callable. "
                      "Please modify its definition to make it a callable function. This is "
                      "needed for conf.py to behave as a Sphinx extension.")
                )

        # now that we know all config values, collect them from conf.py
        self.config.init_values()

        # check extension versions if requested
        verify_required_extensions(self, self.config.needs_extensions)

        # check primary_domain if requested
        primary_domain = self.config.primary_domain
        if primary_domain and not self.registry.has_domain(primary_domain):
            logger.warning(_('primary_domain %r not found, ignored.'), primary_domain)

        # create the builder
        self.builder = self.create_builder(buildername)
        # check all configuration values for permissible types
        self.config.check_types()
        # set up source_parsers
        self._init_source_parsers()
        # set up the build environment
        self._init_env(freshenv)
        # set up the builder
        self._init_builder()
        # set up the enumerable nodes
        self._init_enumerable_nodes()

    def _init_i18n(self):
        # type: () -> None
        """Load translated strings from the configured localedirs if enabled in
        the configuration.
        """
        if self.config.language is not None:
            logger.info(bold('loading translations [%s]... ' % self.config.language),
                        nonl=True)
            user_locale_dirs = [
                path.join(self.srcdir, x) for x in self.config.locale_dirs]
            # compile mo files if sphinx.po file in user locale directories are updated
            for catinfo in find_catalog_source_files(
                    user_locale_dirs, self.config.language, domains=['sphinx'],
                    charset=self.config.source_encoding):
                catinfo.write_mo(self.config.language)
            locale_dirs = [None, path.join(package_dir, 'locale')] + user_locale_dirs
        else:
            locale_dirs = []
        self.translator, has_translation = locale.init(locale_dirs, self.config.language)
        if self.config.language is not None:
            if has_translation or self.config.language == 'en':
                # "en" never needs to be translated
                logger.info(_('done'))
            else:
                logger.info('not available for built-in messages')

    def _init_source_parsers(self):
        # type: () -> None
        for suffix, parser in iteritems(self.config.source_parsers):
            self.add_source_parser(suffix, parser)
        for suffix, parser in iteritems(self.registry.get_source_parsers()):
            if suffix not in self.config.source_suffix and suffix != '*':
                self.config.source_suffix.append(suffix)

    def _init_env(self, freshenv):
        # type: (bool) -> None
        if freshenv:
            self.env = BuildEnvironment(self)
            self.env.find_files(self.config, self.builder)
            for domain in self.registry.create_domains(self.env):
                self.env.domains[domain.name] = domain
        else:
            try:
                logger.info(bold(_('loading pickled environment... ')), nonl=True)
                filename = path.join(self.doctreedir, ENV_PICKLE_FILENAME)
                self.env = BuildEnvironment.frompickle(filename, self)
                self.env.domains = {}
                for domain in self.registry.create_domains(self.env):
                    # this can raise if the data version doesn't fit
                    self.env.domains[domain.name] = domain
                logger.info(_('done'))
            except Exception as err:
                if isinstance(err, IOError) and err.errno == ENOENT:
                    logger.info(_('not yet created'))
                else:
                    logger.info(_('failed: %s'), err)
                self._init_env(freshenv=True)

    def preload_builder(self, name):
        # type: (unicode) -> None
        self.registry.preload_builder(self, name)

    def create_builder(self, name):
        # type: (unicode) -> Builder
        if name is None:
            logger.info(_('No builder selected, using default: html'))
            name = 'html'

        return self.registry.create_builder(self, name)

    def _init_builder(self):
        # type: () -> None
        self.builder.set_environment(self.env)
        self.builder.init()
        self.emit('builder-inited')

    def _init_enumerable_nodes(self):
        # type: () -> None
        for node, settings in iteritems(self.enumerable_nodes):
            self.env.get_domain('std').enumerable_nodes[node] = settings  # type: ignore

    @property
    def buildername(self):
        # type: () -> unicode
        warnings.warn('app.buildername is deprecated. Please use app.builder.name instead',
                      RemovedInSphinx17Warning)
        return self.builder.name

    # ---- main "build" method -------------------------------------------------

    def build(self, force_all=False, filenames=None):
        # type: (bool, List[unicode]) -> None
        try:
            if force_all:
                self.builder.compile_all_catalogs()
                self.builder.build_all()
            elif filenames:
                self.builder.compile_specific_catalogs(filenames)
                self.builder.build_specific(filenames)
            else:
                self.builder.compile_update_catalogs()
                self.builder.build_update()

            status = (self.statuscode == 0 and
                      _('succeeded') or _('finished with problems'))
            if self._warncount:
                logger.info(bold(_('build %s, %s warning%s.') %
                                 (status, self._warncount,
                                  self._warncount != 1 and 's' or '')))
            else:
                logger.info(bold(_('build %s.') % status))
        except Exception as err:
            # delete the saved env to force a fresh build next time
            envfile = path.join(self.doctreedir, ENV_PICKLE_FILENAME)
            if path.isfile(envfile):
                os.unlink(envfile)
            self.emit('build-finished', err)
            raise
        else:
            self.emit('build-finished', None)
        self.builder.cleanup()

    # ---- logging handling ----------------------------------------------------
    def warn(self, message, location=None, prefix=None,
             type=None, subtype=None, colorfunc=None):
        # type: (unicode, unicode, unicode, unicode, unicode, Callable) -> None
        """Emit a warning.

        If *location* is given, it should either be a tuple of (docname, lineno)
        or a string describing the location of the warning as well as possible.

        *prefix* usually should not be changed.

        *type* and *subtype* are used to suppress warnings with :confval:`suppress_warnings`.

        .. note::

           For warnings emitted during parsing, you should use
           :meth:`.BuildEnvironment.warn` since that will collect all
           warnings during parsing for later output.
        """
        if prefix:
            warnings.warn('prefix option of warn() is now deprecated.',
                          RemovedInSphinx17Warning)
        if colorfunc:
            warnings.warn('colorfunc option of warn() is now deprecated.',
                          RemovedInSphinx17Warning)

        warnings.warn('app.warning() is now deprecated. Use sphinx.util.logging instead.',
                      RemovedInSphinx20Warning)
        logger.warning(message, type=type, subtype=subtype, location=location)

    def info(self, message='', nonl=False):
        # type: (unicode, bool) -> None
        """Emit an informational message.

        If *nonl* is true, don't emit a newline at the end (which implies that
        more info output will follow soon.)
        """
        warnings.warn('app.info() is now deprecated. Use sphinx.util.logging instead.',
                      RemovedInSphinx20Warning)
        logger.info(message, nonl=nonl)

    def verbose(self, message, *args, **kwargs):
        # type: (unicode, Any, Any) -> None
        """Emit a verbose informational message."""
        warnings.warn('app.verbose() is now deprecated. Use sphinx.util.logging instead.',
                      RemovedInSphinx20Warning)
        logger.verbose(message, *args, **kwargs)

    def debug(self, message, *args, **kwargs):
        # type: (unicode, Any, Any) -> None
        """Emit a debug-level informational message."""
        warnings.warn('app.debug() is now deprecated. Use sphinx.util.logging instead.',
                      RemovedInSphinx20Warning)
        logger.debug(message, *args, **kwargs)

    def debug2(self, message, *args, **kwargs):
        # type: (unicode, Any, Any) -> None
        """Emit a lowlevel debug-level informational message."""
        warnings.warn('app.debug2() is now deprecated. Use debug() instead.',
                      RemovedInSphinx20Warning)
        logger.debug(message, *args, **kwargs)

    def _display_chunk(chunk):
        # type: (Any) -> unicode
        warnings.warn('app._display_chunk() is now deprecated. '
                      'Use sphinx.util.display_chunk() instead.',
                      RemovedInSphinx17Warning)
        return display_chunk(chunk)

    def old_status_iterator(self, iterable, summary, colorfunc=darkgreen,
                            stringify_func=display_chunk):
        # type: (Iterable, unicode, Callable, Callable[[Any], unicode]) -> Iterator
        warnings.warn('app.old_status_iterator() is now deprecated. '
                      'Use sphinx.util.status_iterator() instead.',
                      RemovedInSphinx17Warning)
        for item in old_status_iterator(iterable, summary,
                                        color="darkgreen", stringify_func=stringify_func):
            yield item

    # new version with progress info
    def status_iterator(self, iterable, summary, colorfunc=darkgreen, length=0,
                        stringify_func=_display_chunk):
        # type: (Iterable, unicode, Callable, int, Callable[[Any], unicode]) -> Iterable
        warnings.warn('app.status_iterator() is now deprecated. '
                      'Use sphinx.util.status_iterator() instead.',
                      RemovedInSphinx17Warning)
        for item in status_iterator(iterable, summary, length=length, verbosity=self.verbosity,
                                    color="darkgreen", stringify_func=stringify_func):
            yield item

    # ---- general extensibility interface -------------------------------------

    def setup_extension(self, extname):
        # type: (unicode) -> None
        """Import and setup a Sphinx extension module. No-op if called twice."""
        logger.debug('[app] setting up extension: %r', extname)
        self.registry.load_extension(self, extname)

    def require_sphinx(self, version):
        # type: (unicode) -> None
        # check the Sphinx version if requested
        if version > sphinx.__display_version__[:3]:
            raise VersionRequirementError(version)

    def import_object(self, objname, source=None):
        # type: (str, unicode) -> Any
        """Import an object from a 'module.name' string."""
        return import_object(objname, source=None)

    # event interface
    def connect(self, event, callback):
        # type: (unicode, Callable) -> int
        listener_id = self.events.connect(event, callback)
        logger.debug('[app] connecting event %r: %r [id=%s]', event, callback, listener_id)
        return listener_id

    def disconnect(self, listener_id):
        # type: (int) -> None
        logger.debug('[app] disconnecting event: [id=%s]', listener_id)
        self.events.disconnect(listener_id)

    def emit(self, event, *args):
        # type: (unicode, Any) -> List
        try:
            logger.debug('[app] emitting event: %r%s', event, repr(args)[:100])
        except Exception:
            # not every object likes to be repr()'d (think
            # random stuff coming via autodoc)
            pass
        return self.events.emit(event, self, *args)

    def emit_firstresult(self, event, *args):
        # type: (unicode, Any) -> Any
        return self.events.emit_firstresult(event, self, *args)

    # registering addon parts

    def add_builder(self, builder):
        # type: (Type[Builder]) -> None
        logger.debug('[app] adding builder: %r', builder)
        self.registry.add_builder(builder)

    def add_config_value(self, name, default, rebuild, types=()):
        # type: (unicode, Any, Union[bool, unicode], Any) -> None
        logger.debug('[app] adding config value: %r',
                     (name, default, rebuild) + ((types,) if types else ()))  # type: ignore
        if name in self.config:
            raise ExtensionError(_('Config value %r already present') % name)
        if rebuild in (False, True):
            rebuild = rebuild and 'env' or ''
        self.config.add(name, default, rebuild, types)

    def add_event(self, name):
        # type: (unicode) -> None
        logger.debug('[app] adding event: %r', name)
        self.events.add(name)

    def set_translator(self, name, translator_class):
        # type: (unicode, Type[nodes.NodeVisitor]) -> None
        logger.info(bold(_('Change of translator for the %s builder.') % name))
        self.registry.add_translator(name, translator_class)

    def add_node(self, node, **kwds):
        # type: (nodes.Node, Any) -> None
        logger.debug('[app] adding node: %r', (node, kwds))
        if not kwds.pop('override', False) and \
           hasattr(nodes.GenericNodeVisitor, 'visit_' + node.__name__):
            logger.warning(_('while setting up extension %s: node class %r is '
                             'already registered, its visitors will be overridden'),
                           self._setting_up_extension, node.__name__,
                           type='app', subtype='add_node')
        nodes._add_node_class_names([node.__name__])
        for key, val in iteritems(kwds):
            try:
                visit, depart = val
            except ValueError:
                raise ExtensionError(_('Value for key %r must be a '
                                       '(visit, depart) function tuple') % key)
            translator = self.registry.translators.get(key)
            translators = []
            if translator is not None:
                translators.append(translator)
            elif key == 'html':
                from sphinx.writers.html import HTMLTranslator
                translators.append(HTMLTranslator)
                if is_html5_writer_available():
                    from sphinx.writers.html5 import HTML5Translator
                    translators.append(HTML5Translator)
            elif key == 'latex':
                from sphinx.writers.latex import LaTeXTranslator
                translators.append(LaTeXTranslator)
            elif key == 'text':
                from sphinx.writers.text import TextTranslator
                translators.append(TextTranslator)
            elif key == 'man':
                from sphinx.writers.manpage import ManualPageTranslator
                translators.append(ManualPageTranslator)
            elif key == 'texinfo':
                from sphinx.writers.texinfo import TexinfoTranslator
                translators.append(TexinfoTranslator)

            for translator in translators:
                setattr(translator, 'visit_' + node.__name__, visit)
                if depart:
                    setattr(translator, 'depart_' + node.__name__, depart)

    def add_enumerable_node(self, node, figtype, title_getter=None, **kwds):
        # type: (nodes.Node, unicode, Callable, Any) -> None
        self.enumerable_nodes[node] = (figtype, title_getter)
        self.add_node(node, **kwds)

    def _directive_helper(self, obj, has_content=None, argument_spec=None, **option_spec):
        # type: (Any, bool, Tuple[int, int, bool], Any) -> Any
        warnings.warn('_directive_helper() is now deprecated. '
                      'Please use sphinx.util.docutils.directive_helper() instead.',
                      RemovedInSphinx17Warning)
        return directive_helper(obj, has_content, argument_spec, **option_spec)

    def add_directive(self, name, obj, content=None, arguments=None, **options):
        # type: (unicode, Any, bool, Tuple[int, int, bool], Any) -> None
        logger.debug('[app] adding directive: %r',
                     (name, obj, content, arguments, options))
        if name in directives._directives:
            logger.warning(_('while setting up extension %s: directive %r is '
                             'already registered, it will be overridden'),
                           self._setting_up_extension[-1], name,
                           type='app', subtype='add_directive')
        directive = directive_helper(obj, content, arguments, **options)
        directives.register_directive(name, directive)

    def add_role(self, name, role):
        # type: (unicode, Any) -> None
        logger.debug('[app] adding role: %r', (name, role))
        if name in roles._roles:
            logger.warning(_('while setting up extension %s: role %r is '
                             'already registered, it will be overridden'),
                           self._setting_up_extension[-1], name,
                           type='app', subtype='add_role')
        roles.register_local_role(name, role)

    def add_generic_role(self, name, nodeclass):
        # type: (unicode, Any) -> None
        # don't use roles.register_generic_role because it uses
        # register_canonical_role
        logger.debug('[app] adding generic role: %r', (name, nodeclass))
        if name in roles._roles:
            logger.warning(_('while setting up extension %s: role %r is '
                             'already registered, it will be overridden'),
                           self._setting_up_extension[-1], name,
                           type='app', subtype='add_generic_role')
        role = roles.GenericRole(name, nodeclass)
        roles.register_local_role(name, role)

    def add_domain(self, domain):
        # type: (Type[Domain]) -> None
        logger.debug('[app] adding domain: %r', domain)
        self.registry.add_domain(domain)

    def override_domain(self, domain):
        # type: (Type[Domain]) -> None
        logger.debug('[app] overriding domain: %r', domain)
        self.registry.override_domain(domain)

    def add_directive_to_domain(self, domain, name, obj,
                                has_content=None, argument_spec=None, **option_spec):
        # type: (unicode, unicode, Any, bool, Any, Any) -> None
        logger.debug('[app] adding directive to domain: %r',
                     (domain, name, obj, has_content, argument_spec, option_spec))
        self.registry.add_directive_to_domain(domain, name, obj,
                                              has_content, argument_spec, **option_spec)

    def add_role_to_domain(self, domain, name, role):
        # type: (unicode, unicode, Any) -> None
        logger.debug('[app] adding role to domain: %r', (domain, name, role))
        self.registry.add_role_to_domain(domain, name, role)

    def add_index_to_domain(self, domain, index):
        # type: (unicode, Type[Index]) -> None
        logger.debug('[app] adding index to domain: %r', (domain, index))
        self.registry.add_index_to_domain(domain, index)

    def add_object_type(self, directivename, rolename, indextemplate='',
                        parse_node=None, ref_nodeclass=None, objname='',
                        doc_field_types=[]):
        # type: (unicode, unicode, unicode, Callable, nodes.Node, unicode, List) -> None
        logger.debug('[app] adding object type: %r',
                     (directivename, rolename, indextemplate, parse_node,
                      ref_nodeclass, objname, doc_field_types))
        self.registry.add_object_type(directivename, rolename, indextemplate, parse_node,
                                      ref_nodeclass, objname, doc_field_types)

    def add_description_unit(self, directivename, rolename, indextemplate='',
                             parse_node=None, ref_nodeclass=None, objname='',
                             doc_field_types=[]):
        # type: (unicode, unicode, unicode, Callable, nodes.Node, unicode, List) -> None
        warnings.warn('app.add_description_unit() is now deprecated. '
                      'Use app.add_object_type() instead.',
                      RemovedInSphinx20Warning)
        self.add_object_type(directivename, rolename, indextemplate, parse_node,
                             ref_nodeclass, objname, doc_field_types)

    def add_crossref_type(self, directivename, rolename, indextemplate='',
                          ref_nodeclass=None, objname=''):
        # type: (unicode, unicode, unicode, nodes.Node, unicode) -> None
        logger.debug('[app] adding crossref type: %r',
                     (directivename, rolename, indextemplate, ref_nodeclass,
                      objname))
        self.registry.add_crossref_type(directivename, rolename,
                                        indextemplate, ref_nodeclass, objname)

    def add_transform(self, transform):
        # type: (Type[Transform]) -> None
        logger.debug('[app] adding transform: %r', transform)
        SphinxStandaloneReader.transforms.append(transform)

    def add_post_transform(self, transform):
        # type: (Type[Transform]) -> None
        logger.debug('[app] adding post transform: %r', transform)
        self.post_transforms.append(transform)

    def add_javascript(self, filename):
        # type: (unicode) -> None
        logger.debug('[app] adding javascript: %r', filename)
        from sphinx.builders.html import StandaloneHTMLBuilder
        if '://' in filename:
            StandaloneHTMLBuilder.script_files.append(filename)
        else:
            StandaloneHTMLBuilder.script_files.append(
                posixpath.join('_static', filename))

    def add_stylesheet(self, filename, alternate=False, title=None):
        # type: (unicode, bool, unicode) -> None
        logger.debug('[app] adding stylesheet: %r', filename)
        from sphinx.builders.html import StandaloneHTMLBuilder, Stylesheet
        if '://' not in filename:
            filename = posixpath.join('_static', filename)
        if alternate:
            rel = u'alternate stylesheet'
        else:
            rel = u'stylesheet'
        css = Stylesheet(filename, title, rel)  # type: ignore
        StandaloneHTMLBuilder.css_files.append(css)

    def add_latex_package(self, packagename, options=None):
        # type: (unicode, unicode) -> None
        logger.debug('[app] adding latex package: %r', packagename)
        if hasattr(self.builder, 'usepackages'):  # only for LaTeX builder
            self.builder.usepackages.append((packagename, options))  # type: ignore

    def add_lexer(self, alias, lexer):
        # type: (unicode, Any) -> None
        logger.debug('[app] adding lexer: %r', (alias, lexer))
        from sphinx.highlighting import lexers
        if lexers is None:
            return
        lexers[alias] = lexer

    def add_autodocumenter(self, cls):
        # type: (Any) -> None
        logger.debug('[app] adding autodocumenter: %r', cls)
        from sphinx.ext import autodoc
        autodoc.add_documenter(cls)
        self.add_directive('auto' + cls.objtype, autodoc.AutoDirective)

    def add_autodoc_attrgetter(self, type, getter):
        # type: (Any, Callable) -> None
        logger.debug('[app] adding autodoc attrgetter: %r', (type, getter))
        from sphinx.ext import autodoc
        autodoc.AutoDirective._special_attrgetters[type] = getter

    def add_search_language(self, cls):
        # type: (Any) -> None
        logger.debug('[app] adding search language: %r', cls)
        from sphinx.search import languages, SearchLanguage
        assert issubclass(cls, SearchLanguage)
        languages[cls.lang] = cls

    def add_source_parser(self, suffix, parser):
        # type: (unicode, Parser) -> None
        logger.debug('[app] adding search source_parser: %r, %r', suffix, parser)
        self.registry.add_source_parser(suffix, parser)

    def add_env_collector(self, collector):
        # type: (Type[EnvironmentCollector]) -> None
        logger.debug('[app] adding environment collector: %r', collector)
        collector().enable(self)

    def add_html_theme(self, name, theme_path):
        # type: (unicode, unicode) -> None
        logger.debug('[app] adding HTML theme: %r, %r', name, theme_path)
        self.html_themes[name] = theme_path


class TemplateBridge(object):
    """
    This class defines the interface for a "template bridge", that is, a class
    that renders templates given a template name and a context.
    """

    def init(self, builder, theme=None, dirs=None):
        # type: (Builder, Theme, List[unicode]) -> None
        """Called by the builder to initialize the template system.

        *builder* is the builder object; you'll probably want to look at the
        value of ``builder.config.templates_path``.

        *theme* is a :class:`sphinx.theming.Theme` object or None; in the latter
        case, *dirs* can be list of fixed directories to look for templates.
        """
        raise NotImplementedError('must be implemented in subclasses')

    def newest_template_mtime(self):
        # type: () -> float
        """Called by the builder to determine if output files are outdated
        because of template changes.  Return the mtime of the newest template
        file that was changed.  The default implementation returns ``0``.
        """
        return 0

    def render(self, template, context):
        # type: (unicode, Dict) -> None
        """Called by the builder to render a template given as a filename with
        a specified context (a Python dictionary).
        """
        raise NotImplementedError('must be implemented in subclasses')

    def render_string(self, template, context):
        # type: (unicode, Dict) -> unicode
        """Called by the builder to render a template given as a string with a
        specified context (a Python dictionary).
        """
        raise NotImplementedError('must be implemented in subclasses')
