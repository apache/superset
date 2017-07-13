# -*- coding: utf-8 -*-
"""
    sphinx.builders.epub2
    ~~~~~~~~~~~~~~~~~~~~~

    Build epub2 files.
    Originally derived from qthelp.py.

    :copyright: Copyright 2007-2016 by the Sphinx team, see AUTHORS.
    :license: BSD, see LICENSE for details.
"""

import warnings
from os import path

from sphinx import package_dir
from sphinx.builders import _epub_base
from sphinx.util.osutil import make_filename
from sphinx.deprecation import RemovedInSphinx17Warning

if False:
    # For type annotation
    from typing import Any, Dict  # NOQA
    from sphinx.application import Sphinx  # NOQA


DOCTYPE = '''<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN"
  "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">'''


# The epub publisher

class Epub2Builder(_epub_base.EpubBuilder):
    """
    Builder that outputs epub files.

    It creates the metainfo files container.opf, toc.ncx, mimetype, and
    META-INF/container.xml.  Afterwards, all necessary files are zipped to an
    epub file.
    """
    name = 'epub2'

    template_dir = path.join(package_dir, 'templates', 'epub2')
    doctype = DOCTYPE

    # Finish by building the epub file
    def handle_finish(self):
        # type: () -> None
        """Create the metainfo files and finally the epub."""
        self.get_toc()
        self.build_mimetype(self.outdir, 'mimetype')
        self.build_container(self.outdir, 'META-INF/container.xml')
        self.build_content(self.outdir, 'content.opf')
        self.build_toc(self.outdir, 'toc.ncx')
        self.build_epub(self.outdir, self.config.epub_basename + '.epub')


def emit_deprecation_warning(app):
    # type: (Sphinx) -> None
    if app.builder.__class__ is Epub2Builder:
        warnings.warn('epub2 builder is deprecated.  Please use epub3 builder instead.',
                      RemovedInSphinx17Warning)


def setup(app):
    # type: (Sphinx) -> Dict[unicode, Any]
    app.setup_extension('sphinx.builders.html')
    app.add_builder(Epub2Builder)
    app.connect('builder-inited', emit_deprecation_warning)

    # config values
    app.add_config_value('epub_basename', lambda self: make_filename(self.project), None)
    app.add_config_value('epub_theme', 'epub', 'html')
    app.add_config_value('epub_theme_options', {}, 'html')
    app.add_config_value('epub_title', lambda self: self.html_title, 'html')
    app.add_config_value('epub_author', 'unknown', 'html')
    app.add_config_value('epub_language', lambda self: self.language or 'en', 'html')
    app.add_config_value('epub_publisher', 'unknown', 'html')
    app.add_config_value('epub_copyright', lambda self: self.copyright, 'html')
    app.add_config_value('epub_identifier', 'unknown', 'html')
    app.add_config_value('epub_scheme', 'unknown', 'html')
    app.add_config_value('epub_uid', 'unknown', 'env')
    app.add_config_value('epub_cover', (), 'env')
    app.add_config_value('epub_guide', (), 'env')
    app.add_config_value('epub_pre_files', [], 'env')
    app.add_config_value('epub_post_files', [], 'env')
    app.add_config_value('epub_exclude_files', [], 'env')
    app.add_config_value('epub_tocdepth', 3, 'env')
    app.add_config_value('epub_tocdup', True, 'env')
    app.add_config_value('epub_tocscope', 'default', 'env')
    app.add_config_value('epub_fix_images', False, 'env')
    app.add_config_value('epub_max_image_width', 0, 'env')
    app.add_config_value('epub_show_urls', 'inline', 'html')
    app.add_config_value('epub_use_index', lambda self: self.html_use_index, 'html')

    return {
        'version': 'builtin',
        'parallel_read_safe': True,
        'parallel_write_safe': True,
    }
