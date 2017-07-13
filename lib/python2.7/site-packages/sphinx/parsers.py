# -*- coding: utf-8 -*-
"""
    sphinx.parsers
    ~~~~~~~~~~~~~~

    A Base class for additional parsers.

    :copyright: Copyright 2007-2017 by the Sphinx team, see AUTHORS.
    :license: BSD, see LICENSE for details.
"""

import docutils.parsers
import docutils.parsers.rst
from docutils.transforms.universal import SmartQuotes

from sphinx.transforms import SphinxSmartQuotes

if False:
    # For type annotation
    from typing import Any, Dict, List, Type  # NOQA
    from docutils.transforms import Transform  # NOQA
    from sphinx.application import Sphinx  # NOQA


class Parser(docutils.parsers.Parser):
    """
    A base class of source parsers.  The additonal parsers should inherits this class instead
    of ``docutils.parsers.Parser``.  Compared with ``docutils.parsers.Parser``, this class
    improves accessibility to Sphinx APIs.

    The subclasses can access following objects and functions:

    self.app
        The application object (:class:`sphinx.application.Sphinx`)
    self.config
        The config object (:class:`sphinx.config.Config`)
    self.env
        The environment object (:class:`sphinx.environment.BuildEnvironment`)
    self.warn()
        Emit a warning. (Same as :meth:`sphinx.application.Sphinx.warn()`)
    self.info()
        Emit a informational message. (Same as :meth:`sphinx.application.Sphinx.info()`)
    """

    def set_application(self, app):
        # type: (Sphinx) -> None
        """set_application will be called from Sphinx to set app and other instance variables

        :param sphinx.application.Sphinx app: Sphinx application object
        """
        self.app = app
        self.config = app.config
        self.env = app.env
        self.warn = app.warn
        self.info = app.info


class RSTParser(docutils.parsers.rst.Parser):
    """A reST parser customized for Sphinx."""

    def get_transforms(self):
        # type: () -> List[Type[Transform]]
        """Sphinx's reST parser replaces a transform class for smart-quotes by own's"""
        transforms = docutils.parsers.rst.Parser.get_transforms(self)
        transforms.remove(SmartQuotes)
        transforms.append(SphinxSmartQuotes)
        return transforms


def setup(app):
    # type: (Sphinx) -> Dict[unicode, Any]
    app.add_source_parser('*', RSTParser)  # register as a special parser

    return {
        'version': 'builtin',
        'parallel_read_safe': True,
        'parallel_write_safe': True,
    }
