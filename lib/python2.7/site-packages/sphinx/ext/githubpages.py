# -*- coding: utf-8 -*-
"""
    sphinx.ext.githubpages
    ~~~~~~~~~~~~~~~~~~~~~~

    To publish HTML docs at GitHub Pages, create .nojekyll file.

    :copyright: Copyright 2007-2017 by the Sphinx team, see AUTHORS.
    :license: BSD, see LICENSE for details.
"""

import os
import sphinx


def create_nojekyll(app, env):
    if app.builder.format == 'html':
        path = os.path.join(app.builder.outdir, '.nojekyll')
        open(path, 'wt').close()


def setup(app):
    app.connect('env-updated', create_nojekyll)
    return {'version': sphinx.__display_version__, 'parallel_read_safe': True}
