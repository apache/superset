# -*- coding: utf-8 -*-
"""
    sphinx.extension
    ~~~~~~~~~~~~~~~~

    Utilities for Sphinx extensions.

    :copyright: Copyright 2007-2017 by the Sphinx team, see AUTHORS.
    :license: BSD, see LICENSE for details.
"""

from six import iteritems

from sphinx.errors import VersionRequirementError
from sphinx.locale import _
from sphinx.util import logging

if False:
    # For type annotation
    from typing import Dict  # NOQA
    from sphinx.application import Sphinx  # NOQA

logger = logging.getLogger(__name__)


class Extension(object):
    def __init__(self, name, module, **kwargs):
        self.name = name
        self.module = module
        self.metadata = kwargs
        self.version = kwargs.pop('version', 'unknown version')

        # The extension supports parallel read or not.  The default value
        # is ``None``.  It means the extension does not tell the status.
        # It will be warned on parallel reading.
        self.parallel_read_safe = kwargs.pop('parallel_read_safe', None)

        # The extension supports parallel write or not.  The default value
        # is ``True``.  Sphinx writes parallelly documents even if
        # the extension does not tell its status.
        self.parallel_write_safe = kwargs.pop('parallel_read_safe', True)


def verify_required_extensions(app, requirements):
    # type: (Sphinx, Dict[unicode, unicode]) -> None
    """Verify the required Sphinx extensions are loaded."""
    if requirements is None:
        return

    for extname, reqversion in iteritems(requirements):
        extension = app.extensions.get(extname)
        if extension is None:
            logger.warning(_('The %s extension is required by needs_extensions settings,'
                             'but it is not loaded.'), extname)
            continue

        if extension.version == 'unknown version' or reqversion > extension.version:
            raise VersionRequirementError(_('This project needs the extension %s at least in '
                                            'version %s and therefore cannot be built with '
                                            'the loaded version (%s).') %
                                          (extname, reqversion, extension.version))
