# -*- coding: utf-8 -*-
"""
    sphinx.util.docutils
    ~~~~~~~~~~~~~~~~~~~~

    Utility functions for docutils.

    :copyright: Copyright 2007-2017 by the Sphinx team, see AUTHORS.
    :license: BSD, see LICENSE for details.
"""
from __future__ import absolute_import

import re
import types
from copy import copy
from distutils.version import LooseVersion
from contextlib import contextmanager

import docutils
from docutils.languages import get_language
from docutils.utils import Reporter
from docutils.parsers.rst import directives, roles, convert_directive_function

from sphinx.errors import ExtensionError
from sphinx.locale import _
from sphinx.util import logging

logger = logging.getLogger(__name__)
report_re = re.compile('^(.+?:(?:\\d+)?): \\((DEBUG|INFO|WARNING|ERROR|SEVERE)/(\\d+)?\\) '
                       '(.+?)\n?$')

if False:
    # For type annotation
    from typing import Any, Callable, Iterator, List, Tuple  # NOQA
    from docutils import nodes  # NOQA
    from sphinx.environment import BuildEnvironment  # NOQA


__version_info__ = tuple(LooseVersion(docutils.__version__).version)


@contextmanager
def docutils_namespace():
    # type: () -> Iterator[None]
    """Create namespace for reST parsers."""
    try:
        _directives = copy(directives._directives)
        _roles = copy(roles._roles)

        yield
    finally:
        directives._directives = _directives
        roles._roles = _roles


def patched_get_language(language_code, reporter=None):
    # type: (unicode, Reporter) -> Any
    """A wrapper for docutils.languages.get_language().

    This ignores the second argument ``reporter`` to suppress warnings.
    refs: https://github.com/sphinx-doc/sphinx/issues/3788
    """
    return get_language(language_code)


@contextmanager
def patch_docutils():
    # type: () -> Iterator[None]
    """Patch to docutils temporarily."""
    try:
        docutils.languages.get_language = patched_get_language

        yield
    finally:
        # restore original implementations
        docutils.languages.get_language = get_language


class ElementLookupError(Exception):
    pass


class sphinx_domains(object):
    """Monkey-patch directive and role dispatch, so that domain-specific
    markup takes precedence.
    """
    def __init__(self, env):
        # type: (BuildEnvironment) -> None
        self.env = env
        self.directive_func = None  # type: Callable
        self.roles_func = None  # type: Callable

    def __enter__(self):
        # type: () -> None
        self.enable()

    def __exit__(self, type, value, traceback):
        # type: (unicode, unicode, unicode) -> None
        self.disable()

    def enable(self):
        # type: () -> None
        self.directive_func = directives.directive
        self.role_func = roles.role

        directives.directive = self.lookup_directive
        roles.role = self.lookup_role

    def disable(self):
        # type: () -> None
        directives.directive = self.directive_func
        roles.role = self.role_func

    def lookup_domain_element(self, type, name):
        # type: (unicode, unicode) -> Tuple[Any, List]
        """Lookup a markup element (directive or role), given its name which can
        be a full name (with domain).
        """
        name = name.lower()
        # explicit domain given?
        if ':' in name:
            domain_name, name = name.split(':', 1)
            if domain_name in self.env.domains:
                domain = self.env.get_domain(domain_name)
                element = getattr(domain, type)(name)
                if element is not None:
                    return element, []
        # else look in the default domain
        else:
            def_domain = self.env.temp_data.get('default_domain')
            if def_domain is not None:
                element = getattr(def_domain, type)(name)
                if element is not None:
                    return element, []

        # always look in the std domain
        element = getattr(self.env.get_domain('std'), type)(name)
        if element is not None:
            return element, []

        raise ElementLookupError

    def lookup_directive(self, name, lang_module, document):
        # type: (unicode, unicode, nodes.document) -> Tuple[Any, List]
        try:
            return self.lookup_domain_element('directive', name)
        except ElementLookupError:
            return self.directive_func(name, lang_module, document)

    def lookup_role(self, name, lang_module, lineno, reporter):
        # type: (unicode, unicode, int, Any) -> Tuple[Any, List]
        try:
            return self.lookup_domain_element('role', name)
        except ElementLookupError:
            return self.role_func(name, lang_module, lineno, reporter)


class WarningStream(object):
    def write(self, text):
        # type: (unicode) -> None
        matched = report_re.search(text)  # type: ignore
        if not matched:
            logger.warning(text.rstrip("\r\n"))
        else:
            location, type, level, message = matched.groups()
            logger.log(type, message, location=location)


class LoggingReporter(Reporter):
    def __init__(self, source, report_level, halt_level,
                 debug=False, error_handler='backslashreplace'):
        # type: (unicode, int, int, bool, unicode) -> None
        stream = WarningStream()
        Reporter.__init__(self, source, report_level, halt_level,
                          stream, debug, error_handler=error_handler)

    def set_conditions(self, category, report_level, halt_level, debug=False):
        # type: (unicode, int, int, bool) -> None
        Reporter.set_conditions(self, category, report_level, halt_level, debug=debug)


def is_html5_writer_available():
    # type: () -> bool
    return __version_info__ > (0, 13, 0)


def directive_helper(obj, has_content=None, argument_spec=None, **option_spec):
    # type: (Any, bool, Tuple[int, int, bool], Any) -> Any
    if isinstance(obj, (types.FunctionType, types.MethodType)):
        obj.content = has_content                       # type: ignore
        obj.arguments = argument_spec or (0, 0, False)  # type: ignore
        obj.options = option_spec                       # type: ignore
        return convert_directive_function(obj)
    else:
        if has_content or argument_spec or option_spec:
            raise ExtensionError(_('when adding directive classes, no '
                                   'additional arguments may be given'))
        return obj
