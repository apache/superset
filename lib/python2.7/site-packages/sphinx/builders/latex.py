# -*- coding: utf-8 -*-
"""
    sphinx.builders.latex
    ~~~~~~~~~~~~~~~~~~~~~

    LaTeX builder.

    :copyright: Copyright 2007-2017 by the Sphinx team, see AUTHORS.
    :license: BSD, see LICENSE for details.
"""

import os
import warnings
from os import path

from docutils import nodes
from docutils.io import FileOutput
from docutils.utils import new_document
from docutils.frontend import OptionParser

from sphinx import package_dir, addnodes, highlighting
from sphinx.deprecation import RemovedInSphinx17Warning
from sphinx.config import string_classes, ENUM
from sphinx.errors import SphinxError
from sphinx.locale import _
from sphinx.builders import Builder
from sphinx.environment import NoUri
from sphinx.environment.adapters.asset import ImageAdapter
from sphinx.util import texescape, logging, status_iterator
from sphinx.util.nodes import inline_all_toctrees
from sphinx.util.fileutil import copy_asset_file
from sphinx.util.osutil import SEP, make_filename
from sphinx.util.console import bold, darkgreen  # type: ignore
from sphinx.writers.latex import LaTeXWriter, LaTeXTranslator

if False:
    # For type annotation
    from typing import Any, Dict, Iterable, List, Tuple, Union  # NOQA
    from sphinx.application import Sphinx  # NOQA
    from sphinx.config import Config  # NOQA


logger = logging.getLogger(__name__)


class LaTeXBuilder(Builder):
    """
    Builds LaTeX output to create PDF.
    """
    name = 'latex'
    format = 'latex'
    supported_image_types = ['application/pdf', 'image/png', 'image/jpeg']
    supported_remote_images = False
    default_translator_class = LaTeXTranslator

    def init(self):
        # type: () -> None
        self.docnames = []          # type: Iterable[unicode]
        self.document_data = []     # type: List[Tuple[unicode, unicode, unicode, unicode, unicode, bool]]  # NOQA
        self.usepackages = []       # type: List[unicode]
        texescape.init()

    def get_outdated_docs(self):
        # type: () -> Union[unicode, List[unicode]]
        return 'all documents'  # for now

    def get_target_uri(self, docname, typ=None):
        # type: (unicode, unicode) -> unicode
        if docname not in self.docnames:
            raise NoUri
        else:
            return '%' + docname

    def get_relative_uri(self, from_, to, typ=None):
        # type: (unicode, unicode, unicode) -> unicode
        # ignore source path
        return self.get_target_uri(to, typ)

    def init_document_data(self):
        # type: () -> None
        preliminary_document_data = [list(x) for x in self.config.latex_documents]
        if not preliminary_document_data:
            logger.warning('no "latex_documents" config value found; no documents '
                           'will be written')
            return
        # assign subdirs to titles
        self.titles = []  # type: List[Tuple[unicode, unicode]]
        for entry in preliminary_document_data:
            docname = entry[0]
            if docname not in self.env.all_docs:
                logger.warning('"latex_documents" config value references unknown '
                               'document %s', docname)
                continue
            self.document_data.append(entry)  # type: ignore
            if docname.endswith(SEP + 'index'):
                docname = docname[:-5]
            self.titles.append((docname, entry[2]))

    def write_stylesheet(self):
        # type: () -> None
        highlighter = highlighting.PygmentsBridge(
            'latex', self.config.pygments_style, self.config.trim_doctest_flags)
        stylesheet = path.join(self.outdir, 'sphinxhighlight.sty')
        with open(stylesheet, 'w') as f:
            f.write('\\NeedsTeXFormat{LaTeX2e}[1995/12/01]\n')
            f.write('\\ProvidesPackage{sphinxhighlight}'
                    '[2016/05/29 stylesheet for highlighting with pygments]\n\n')
            f.write(highlighter.get_stylesheet())  # type: ignore

    def write(self, *ignored):
        # type: (Any) -> None
        docwriter = LaTeXWriter(self)
        docsettings = OptionParser(
            defaults=self.env.settings,
            components=(docwriter,),
            read_config_files=True).get_default_values()

        self.init_document_data()
        self.write_stylesheet()

        for entry in self.document_data:
            docname, targetname, title, author, docclass = entry[:5]
            toctree_only = False
            if len(entry) > 5:
                toctree_only = entry[5]
            destination = FileOutput(
                destination_path=path.join(self.outdir, targetname),
                encoding='utf-8')
            logger.info("processing %s...", targetname, nonl=1)
            toctrees = self.env.get_doctree(docname).traverse(addnodes.toctree)
            if toctrees:
                if toctrees[0].get('maxdepth') > 0:
                    tocdepth = toctrees[0].get('maxdepth')
                else:
                    tocdepth = None
            else:
                tocdepth = None
            doctree = self.assemble_doctree(
                docname, toctree_only,
                appendices=((docclass != 'howto') and self.config.latex_appendices or []))
            doctree['tocdepth'] = tocdepth
            self.post_process_images(doctree)
            logger.info("writing... ", nonl=1)
            doctree.settings = docsettings
            doctree.settings.author = author
            doctree.settings.title = title
            doctree.settings.contentsname = self.get_contentsname(docname)
            doctree.settings.docname = docname
            doctree.settings.docclass = docclass
            docwriter.write(doctree, destination)
            logger.info("done")

    def get_contentsname(self, indexfile):
        # type: (unicode) -> unicode
        tree = self.env.get_doctree(indexfile)
        contentsname = None
        for toctree in tree.traverse(addnodes.toctree):
            if 'caption' in toctree:
                contentsname = toctree['caption']
                break

        return contentsname

    def assemble_doctree(self, indexfile, toctree_only, appendices):
        # type: (unicode, bool, List[unicode]) -> nodes.Node
        self.docnames = set([indexfile] + appendices)
        logger.info(darkgreen(indexfile) + " ", nonl=1)
        tree = self.env.get_doctree(indexfile)
        tree['docname'] = indexfile
        if toctree_only:
            # extract toctree nodes from the tree and put them in a
            # fresh document
            new_tree = new_document('<latex output>')
            new_sect = nodes.section()
            new_sect += nodes.title(u'<Set title in conf.py>',
                                    u'<Set title in conf.py>')
            new_tree += new_sect
            for node in tree.traverse(addnodes.toctree):
                new_sect += node
            tree = new_tree
        largetree = inline_all_toctrees(self, self.docnames, indexfile, tree,
                                        darkgreen, [indexfile])
        largetree['docname'] = indexfile
        for docname in appendices:
            appendix = self.env.get_doctree(docname)
            appendix['docname'] = docname
            largetree.append(appendix)
        logger.info('')
        logger.info("resolving references...")
        self.env.resolve_references(largetree, indexfile, self)
        # resolve :ref:s to distant tex files -- we can't add a cross-reference,
        # but append the document name
        for pendingnode in largetree.traverse(addnodes.pending_xref):
            docname = pendingnode['refdocname']
            sectname = pendingnode['refsectname']
            newnodes = [nodes.emphasis(sectname, sectname)]
            for subdir, title in self.titles:
                if docname.startswith(subdir):
                    newnodes.append(nodes.Text(_(' (in '), _(' (in ')))
                    newnodes.append(nodes.emphasis(title, title))
                    newnodes.append(nodes.Text(')', ')'))
                    break
            else:
                pass
            pendingnode.replace_self(newnodes)
        return largetree

    def finish(self):
        # type: () -> None
        self.copy_image_files()

        # copy TeX support files from texinputs
        context = {'latex_engine': self.config.latex_engine}
        logger.info(bold('copying TeX support files...'))
        staticdirname = path.join(package_dir, 'texinputs')
        for filename in os.listdir(staticdirname):
            if not filename.startswith('.'):
                copy_asset_file(path.join(staticdirname, filename),
                                self.outdir, context=context)

        # use pre-1.6.x Makefile for make latexpdf on Windows
        if os.name == 'nt':
            staticdirname = path.join(package_dir, 'texinputs_win')
            copy_asset_file(path.join(staticdirname, 'Makefile_t'),
                            self.outdir, context=context)

        # copy additional files
        if self.config.latex_additional_files:
            logger.info(bold('copying additional files...'), nonl=1)
            for filename in self.config.latex_additional_files:
                logger.info(' ' + filename, nonl=1)
                copy_asset_file(path.join(self.confdir, filename), self.outdir)
            logger.info('')

        # the logo is handled differently
        if self.config.latex_logo:
            if not path.isfile(path.join(self.confdir, self.config.latex_logo)):
                raise SphinxError('logo file %r does not exist' % self.config.latex_logo)
            else:
                copy_asset_file(path.join(self.confdir, self.config.latex_logo), self.outdir)
        logger.info('done')

    def copy_image_files(self):
        # type: () -> None
        if self.images:
            stringify_func = ImageAdapter(self.app.env).get_original_image_uri
            for src in status_iterator(self.images, 'copying images... ', "brown",
                                       len(self.images), self.app.verbosity,
                                       stringify_func=stringify_func):
                dest = self.images[src]
                try:
                    copy_asset_file(path.join(self.srcdir, src),
                                    path.join(self.outdir, dest))
                except Exception as err:
                    logger.warning('cannot copy image file %r: %s',
                                   path.join(self.srcdir, src), err)


def validate_config_values(app):
    # type: (Sphinx) -> None
    if app.config.latex_toplevel_sectioning not in (None, 'part', 'chapter', 'section'):
        logger.warning('invalid latex_toplevel_sectioning, ignored: %s',
                       app.config.latex_toplevel_sectioning)
        app.config.latex_toplevel_sectioning = None  # type: ignore

    if 'footer' in app.config.latex_elements:
        if 'postamble' in app.config.latex_elements:
            logger.warning("latex_elements['footer'] conflicts with "
                           "latex_elements['postamble'], ignored.")
        else:
            warnings.warn("latex_elements['footer'] is deprecated. "
                          "Use latex_elements['preamble'] instead.",
                          RemovedInSphinx17Warning)
            app.config.latex_elements['postamble'] = app.config.latex_elements['footer']

    if app.config.latex_keep_old_macro_names:
        warnings.warn("latex_keep_old_macro_names is deprecated. "
                      "LaTeX markup since Sphinx 1.4.5 uses only prefixed macro names.",
                      RemovedInSphinx17Warning)


def default_latex_engine(config):
    # type: (Config) -> unicode
    """ Better default latex_engine settings for specific languages. """
    if config.language == 'ja':
        return 'platex'
    else:
        return 'pdflatex'


def default_latex_docclass(config):
    # type: (Config) -> Dict[unicode, unicode]
    """ Better default latex_docclass settings for specific languages. """
    if config.language == 'ja':
        return {'manual': 'jsbook',
                'howto': 'jreport'}
    else:
        return {}


def setup(app):
    # type: (Sphinx) -> Dict[unicode, Any]
    app.add_builder(LaTeXBuilder)
    app.connect('builder-inited', validate_config_values)

    app.add_config_value('latex_engine', default_latex_engine, None,
                         ENUM('pdflatex', 'xelatex', 'lualatex', 'platex'))
    app.add_config_value('latex_documents',
                         lambda self: [(self.master_doc, make_filename(self.project) + '.tex',
                                        self.project, '', 'manual')],
                         None)
    app.add_config_value('latex_logo', None, None, string_classes)
    app.add_config_value('latex_appendices', [], None)
    app.add_config_value('latex_keep_old_macro_names', False, None)
    app.add_config_value('latex_use_latex_multicolumn', False, None)
    app.add_config_value('latex_toplevel_sectioning', None, None, [str])
    app.add_config_value('latex_domain_indices', True, None, [list])
    app.add_config_value('latex_show_urls', 'no', None)
    app.add_config_value('latex_show_pagerefs', False, None)
    app.add_config_value('latex_elements', {}, None)
    app.add_config_value('latex_additional_files', [], None)

    app.add_config_value('latex_docclass', default_latex_docclass, None)

    return {
        'version': 'builtin',
        'parallel_read_safe': True,
        'parallel_write_safe': True,
    }
