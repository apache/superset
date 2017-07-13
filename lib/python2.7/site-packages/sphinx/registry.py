# -*- coding: utf-8 -*-
"""
    sphinx.registry
    ~~~~~~~~~~~~~~~

    Sphinx component registry.

    :copyright: Copyright 2007-2016 by the Sphinx team, see AUTHORS.
    :license: BSD, see LICENSE for details.
"""
from __future__ import print_function

import traceback

from pkg_resources import iter_entry_points
from six import itervalues

from sphinx.errors import ExtensionError, SphinxError, VersionRequirementError
from sphinx.extension import Extension
from sphinx.domains import ObjType
from sphinx.domains.std import GenericObject, Target
from sphinx.locale import _
from sphinx.roles import XRefRole
from sphinx.util import logging
from sphinx.util.docutils import directive_helper

if False:
    # For type annotation
    from typing import Any, Callable, Dict, Iterator, List, Type  # NOQA
    from docutils import nodes  # NOQA
    from docutils.parsers import Parser  # NOQA
    from sphinx.application import Sphinx  # NOQA
    from sphinx.builders import Builder  # NOQA
    from sphinx.domains import Domain, Index  # NOQA
    from sphinx.environment import BuildEnvironment  # NOQA

logger = logging.getLogger(__name__)

# list of deprecated extensions. Keys are extension name.
# Values are Sphinx version that merge the extension.
EXTENSION_BLACKLIST = {
    "sphinxjp.themecore": "1.2"
}  # type: Dict[unicode, unicode]


class SphinxComponentRegistry(object):
    def __init__(self):
        self.builders = {}          # type: Dict[unicode, Type[Builder]]
        self.domains = {}           # type: Dict[unicode, Type[Domain]]
        self.source_parsers = {}    # type: Dict[unicode, Parser]
        self.translators = {}       # type: Dict[unicode, nodes.NodeVisitor]

    def add_builder(self, builder):
        # type: (Type[Builder]) -> None
        if not hasattr(builder, 'name'):
            raise ExtensionError(_('Builder class %s has no "name" attribute') % builder)
        if builder.name in self.builders:
            raise ExtensionError(_('Builder %r already exists (in module %s)') %
                                 (builder.name, self.builders[builder.name].__module__))
        self.builders[builder.name] = builder

    def preload_builder(self, app, name):
        # type: (Sphinx, unicode) -> None
        if name is None:
            return

        if name not in self.builders:
            entry_points = iter_entry_points('sphinx.builders', name)
            try:
                entry_point = next(entry_points)
            except StopIteration:
                raise SphinxError(_('Builder name %s not registered or available'
                                    ' through entry point') % name)

            self.load_extension(app, entry_point.module_name)

    def create_builder(self, app, name):
        # type: (Sphinx, unicode) -> Builder
        if name not in self.builders:
            raise SphinxError(_('Builder name %s not registered') % name)

        return self.builders[name](app)

    def add_domain(self, domain):
        # type: (Type[Domain]) -> None
        if domain.name in self.domains:
            raise ExtensionError(_('domain %s already registered') % domain.name)
        self.domains[domain.name] = domain

    def has_domain(self, domain):
        # type: (unicode) -> bool
        return domain in self.domains

    def create_domains(self, env):
        # type: (BuildEnvironment) -> Iterator[Domain]
        for DomainClass in itervalues(self.domains):
            yield DomainClass(env)

    def override_domain(self, domain):
        # type: (Type[Domain]) -> None
        if domain.name not in self.domains:
            raise ExtensionError(_('domain %s not yet registered') % domain.name)
        if not issubclass(domain, self.domains[domain.name]):
            raise ExtensionError(_('new domain not a subclass of registered %s '
                                   'domain') % domain.name)
        self.domains[domain.name] = domain

    def add_directive_to_domain(self, domain, name, obj,
                                has_content=None, argument_spec=None, **option_spec):
        # type: (unicode, unicode, Any, bool, Any, Any) -> None
        if domain not in self.domains:
            raise ExtensionError(_('domain %s not yet registered') % domain)
        directive = directive_helper(obj, has_content, argument_spec, **option_spec)
        self.domains[domain].directives[name] = directive

    def add_role_to_domain(self, domain, name, role):
        # type: (unicode, unicode, Any) -> None
        if domain not in self.domains:
            raise ExtensionError(_('domain %s not yet registered') % domain)
        self.domains[domain].roles[name] = role

    def add_index_to_domain(self, domain, index):
        # type: (unicode, Type[Index]) -> None
        if domain not in self.domains:
            raise ExtensionError(_('domain %s not yet registered') % domain)
        self.domains[domain].indices.append(index)

    def add_object_type(self, directivename, rolename, indextemplate='',
                        parse_node=None, ref_nodeclass=None, objname='',
                        doc_field_types=[]):
        # type: (unicode, unicode, unicode, Callable, nodes.Node, unicode, List) -> None
        # create a subclass of GenericObject as the new directive
        directive = type(directivename,  # type: ignore
                         (GenericObject, object),
                         {'indextemplate': indextemplate,
                          'parse_node': staticmethod(parse_node),
                          'doc_field_types': doc_field_types})

        stddomain = self.domains['std']
        stddomain.directives[directivename] = directive
        stddomain.roles[rolename] = XRefRole(innernodeclass=ref_nodeclass)
        stddomain.object_types[directivename] = ObjType(objname or directivename, rolename)

    def add_crossref_type(self, directivename, rolename, indextemplate='',
                          ref_nodeclass=None, objname=''):
        # type: (unicode, unicode, unicode, nodes.Node, unicode) -> None
        # create a subclass of Target as the new directive
        directive = type(directivename,  # type: ignore
                         (Target, object),
                         {'indextemplate': indextemplate})

        stddomain = self.domains['std']
        stddomain.directives[directivename] = directive
        stddomain.roles[rolename] = XRefRole(innernodeclass=ref_nodeclass)
        stddomain.object_types[directivename] = ObjType(objname or directivename, rolename)

    def add_source_parser(self, suffix, parser):
        # type: (unicode, Parser) -> None
        if suffix in self.source_parsers:
            raise ExtensionError(_('source_parser for %r is already registered') % suffix)
        self.source_parsers[suffix] = parser

    def get_source_parsers(self):
        # type: () -> Dict[unicode, Parser]
        return self.source_parsers

    def add_translator(self, name, translator):
        # type: (unicode, Type[nodes.NodeVisitor]) -> None
        self.translators[name] = translator

    def get_translator_class(self, builder):
        # type: (Builder) -> Type[nodes.NodeVisitor]
        return self.translators.get(builder.name,
                                    builder.default_translator_class)

    def create_translator(self, builder, document):
        # type: (Builder, nodes.Node) -> nodes.NodeVisitor
        translator_class = self.get_translator_class(builder)
        return translator_class(builder, document)

    def load_extension(self, app, extname):
        # type: (Sphinx, unicode) -> None
        """Load a Sphinx extension."""
        if extname in app.extensions:  # alread loaded
            return
        if extname in EXTENSION_BLACKLIST:
            logger.warning(_('the extension %r was already merged with Sphinx since '
                             'version %s; this extension is ignored.'),
                           extname, EXTENSION_BLACKLIST[extname])
            return

        # update loading context
        app._setting_up_extension.append(extname)

        try:
            mod = __import__(extname, None, None, ['setup'])
        except ImportError as err:
            logger.verbose(_('Original exception:\n') + traceback.format_exc())
            raise ExtensionError(_('Could not import extension %s') % extname, err)

        if not hasattr(mod, 'setup'):
            logger.warning(_('extension %r has no setup() function; is it really '
                             'a Sphinx extension module?'), extname)
            metadata = {}  # type: Dict[unicode, Any]
        else:
            try:
                metadata = mod.setup(app)
            except VersionRequirementError as err:
                # add the extension name to the version required
                raise VersionRequirementError(
                    _('The %s extension used by this project needs at least '
                      'Sphinx v%s; it therefore cannot be built with this '
                      'version.') % (extname, err)
                )

        if metadata is None:
            metadata = {}
            if extname == 'rst2pdf.pdfbuilder':
                metadata['parallel_read_safe'] = True
        elif not isinstance(metadata, dict):
            logger.warning(_('extension %r returned an unsupported object from '
                             'its setup() function; it should return None or a '
                             'metadata dictionary'), extname)

        app.extensions[extname] = Extension(extname, mod, **metadata)
        app._setting_up_extension.pop()
