# -*- coding: utf-8 -*-
"""
    sphinx.builders.html
    ~~~~~~~~~~~~~~~~~~~~

    Several HTML builders.

    :copyright: Copyright 2007-2017 by the Sphinx team, see AUTHORS.
    :license: BSD, see LICENSE for details.
"""

import re
import sys
import codecs
import warnings
import posixpath
from os import path
from hashlib import md5

from six import iteritems, text_type, string_types
from six.moves import cPickle as pickle

import docutils
from docutils import nodes
from docutils.io import DocTreeInput, StringOutput
from docutils.core import Publisher
from docutils.utils import new_document, relative_path
from docutils.frontend import OptionParser
from docutils.readers.doctree import Reader as DoctreeReader

from sphinx import package_dir, __display_version__
from sphinx.util import jsonimpl, logging, status_iterator
from sphinx.util.i18n import format_date
from sphinx.util.inventory import InventoryFile
from sphinx.util.osutil import SEP, os_path, relative_uri, ensuredir, \
    movefile, copyfile
from sphinx.util.nodes import inline_all_toctrees
from sphinx.util.docutils import is_html5_writer_available
from sphinx.util.fileutil import copy_asset
from sphinx.util.matching import patmatch, Matcher, DOTFILES
from sphinx.config import string_classes
from sphinx.deprecation import RemovedInSphinx20Warning
from sphinx.locale import _, l_
from sphinx.search import js_index
from sphinx.theming import HTMLThemeFactory
from sphinx.builders import Builder
from sphinx.application import ENV_PICKLE_FILENAME
from sphinx.highlighting import PygmentsBridge
from sphinx.util.console import bold, darkgreen  # type: ignore
from sphinx.writers.html import HTMLWriter, HTMLTranslator
from sphinx.environment.adapters.asset import ImageAdapter
from sphinx.environment.adapters.toctree import TocTree
from sphinx.environment.adapters.indexentries import IndexEntries

if False:
    # For type annotation
    from typing import Any, Dict, Iterable, Iterator, List, Type, Tuple, Union  # NOQA
    from sphinx.domains import Domain, Index  # NOQA
    from sphinx.application import Sphinx  # NOQA

# Experimental HTML5 Writer
if is_html5_writer_available():
    from sphinx.writers.html5 import HTML5Translator
    html5_ready = True
else:
    html5_ready = False

#: the filename for the inventory of objects
INVENTORY_FILENAME = 'objects.inv'
#: the filename for the "last build" file (for serializing builders)
LAST_BUILD_FILENAME = 'last_build'

logger = logging.getLogger(__name__)
return_codes_re = re.compile('[\r\n]+')


def get_stable_hash(obj):
    # type: (Any) -> unicode
    """
    Return a stable hash for a Python data structure.  We can't just use
    the md5 of str(obj) since for example dictionary items are enumerated
    in unpredictable order due to hash randomization in newer Pythons.
    """
    if isinstance(obj, dict):
        return get_stable_hash(list(obj.items()))
    elif isinstance(obj, (list, tuple)):
        obj = sorted(get_stable_hash(o) for o in obj)
    return md5(text_type(obj).encode('utf8')).hexdigest()


class CSSContainer(list):
    """The container of stylesheets.

    To support the extensions which access the container directly, this wraps
    the entry with Stylesheet class.
    """
    def append(self, obj):
        if isinstance(obj, Stylesheet):
            super(CSSContainer, self).append(obj)
        else:
            super(CSSContainer, self).append(Stylesheet(obj, None, 'stylesheet'))

    def insert(self, index, obj):
        warnings.warn('builder.css_files is deprecated. '
                      'Please use app.add_stylesheet() instead.',
                      RemovedInSphinx20Warning)
        if isinstance(obj, Stylesheet):
            super(CSSContainer, self).insert(index, obj)
        else:
            super(CSSContainer, self).insert(index, Stylesheet(obj, None, 'stylesheet'))

    def extend(self, other):
        warnings.warn('builder.css_files is deprecated. '
                      'Please use app.add_stylesheet() instead.',
                      RemovedInSphinx20Warning)
        for item in other:
            self.append(item)

    def __iadd__(self, other):
        warnings.warn('builder.css_files is deprecated. '
                      'Please use app.add_stylesheet() instead.',
                      RemovedInSphinx20Warning)
        for item in other:
            self.append(item)
        return self

    def __add__(self, other):
        ret = CSSContainer(self)
        ret += other
        return ret


class Stylesheet(text_type):
    """The metadata of stylesheet.

    To keep compatibility with old themes, an instance of stylesheet behaves as
    its filename (str).
    """

    def __new__(cls, filename, title, rel):
        # type: (unicode, unicode, unicode) -> None
        self = text_type.__new__(cls, filename)  # type: ignore
        self.filename = filename
        self.title = title
        self.rel = rel

        return self


class StandaloneHTMLBuilder(Builder):
    """
    Builds standalone HTML docs.
    """
    name = 'html'
    format = 'html'
    copysource = True
    allow_parallel = True
    out_suffix = '.html'
    link_suffix = '.html'  # defaults to matching out_suffix
    indexer_format = js_index  # type: Any
    indexer_dumps_unicode = True
    # create links to original images from images [True/False]
    html_scaled_image_link = True
    supported_image_types = ['image/svg+xml', 'image/png',
                             'image/gif', 'image/jpeg']
    supported_remote_images = True
    supported_data_uri_images = True
    searchindex_filename = 'searchindex.js'
    add_permalinks = True
    allow_sharp_as_current_path = True
    embedded = False  # for things like HTML help or Qt help: suppresses sidebar
    search = True  # for things like HTML help and Apple help: suppress search
    use_index = False
    download_support = True  # enable download role
    # use html5 translator by default
    default_html5_translator = False

    # This is a class attribute because it is mutated by Sphinx.add_javascript.
    script_files = ['_static/jquery.js', '_static/underscore.js',
                    '_static/doctools.js']  # type: List[unicode]
    # Ditto for this one (Sphinx.add_stylesheet).
    css_files = CSSContainer()  # type: List[Dict[unicode, unicode]]

    imgpath = None          # type: unicode
    domain_indices = []     # type: List[Tuple[unicode, Type[Index], List[Tuple[unicode, List[List[Union[unicode, int]]]]], bool]]  # NOQA

    # cached publisher object for snippets
    _publisher = None

    def init(self):
        # type: () -> None
        # a hash of all config values that, if changed, cause a full rebuild
        self.config_hash = ''  # type: unicode
        self.tags_hash = ''  # type: unicode
        # basename of images directory
        self.imagedir = '_images'
        # section numbers for headings in the currently visited document
        self.secnumbers = {}  # type: Dict[unicode, Tuple[int, ...]]
        # currently written docname
        self.current_docname = None  # type: unicode

        self.init_templates()
        self.init_highlighter()
        if self.config.html_file_suffix is not None:
            self.out_suffix = self.config.html_file_suffix

        if self.config.html_link_suffix is not None:
            self.link_suffix = self.config.html_link_suffix
        else:
            self.link_suffix = self.out_suffix

        if self.config.language is not None:
            if self._get_translations_js():
                self.script_files.append('_static/translations.js')
        self.use_index = self.get_builder_config('use_index', 'html')

        if self.config.html_experimental_html5_writer and not html5_ready:
            self.app.warn(('html_experimental_html5_writer is set, but current version '
                           'is old. Docutils\' version should be 0.13 or newer, but %s.') %
                          docutils.__version__)

    def _get_translations_js(self):
        # type: () -> unicode
        candidates = [path.join(dir, self.config.language,
                                'LC_MESSAGES', 'sphinx.js')
                      for dir in self.config.locale_dirs] + \
                     [path.join(package_dir, 'locale', self.config.language,
                                'LC_MESSAGES', 'sphinx.js'),
                      path.join(sys.prefix, 'share/sphinx/locale',
                                self.config.language, 'sphinx.js')]

        for jsfile in candidates:
            if path.isfile(jsfile):
                return jsfile
        return None

    def get_theme_config(self):
        # type: () -> Tuple[unicode, Dict]
        return self.config.html_theme, self.config.html_theme_options

    def init_templates(self):
        # type: () -> None
        theme_factory = HTMLThemeFactory(self.app)
        themename, themeoptions = self.get_theme_config()
        self.theme = theme_factory.create(themename)
        self.theme_options = themeoptions.copy()
        self.create_template_bridge()
        self.templates.init(self, self.theme)

    def init_highlighter(self):
        # type: () -> None
        # determine Pygments style and create the highlighter
        if self.config.pygments_style is not None:
            style = self.config.pygments_style
        elif self.theme:
            style = self.theme.get_config('theme', 'pygments_style', 'none')
        else:
            style = 'sphinx'
        self.highlighter = PygmentsBridge('html', style,
                                          self.config.trim_doctest_flags)

    @property
    def default_translator_class(self):
        use_html5_writer = self.config.html_experimental_html5_writer
        if use_html5_writer is None:
            use_html5_writer = self.default_html5_translator

        if use_html5_writer and html5_ready:
            return HTML5Translator
        else:
            return HTMLTranslator

    def get_outdated_docs(self):
        # type: () -> Iterator[unicode]
        cfgdict = dict((confval.name, confval.value) for confval in self.config.filter('html'))
        self.config_hash = get_stable_hash(cfgdict)
        self.tags_hash = get_stable_hash(sorted(self.tags))  # type: ignore
        old_config_hash = old_tags_hash = ''
        try:
            with open(path.join(self.outdir, '.buildinfo')) as fp:
                version = fp.readline()
                if version.rstrip() != '# Sphinx build info version 1':
                    raise ValueError
                fp.readline()  # skip commentary
                cfg, old_config_hash = fp.readline().strip().split(': ')
                if cfg != 'config':
                    raise ValueError
                tag, old_tags_hash = fp.readline().strip().split(': ')
                if tag != 'tags':
                    raise ValueError
        except ValueError:
            logger.warning('unsupported build info format in %r, building all',
                           path.join(self.outdir, '.buildinfo'))
        except Exception:
            pass
        if old_config_hash != self.config_hash or \
           old_tags_hash != self.tags_hash:
            for docname in self.env.found_docs:
                yield docname
            return

        if self.templates:
            template_mtime = self.templates.newest_template_mtime()
        else:
            template_mtime = 0
        for docname in self.env.found_docs:
            if docname not in self.env.all_docs:
                yield docname
                continue
            targetname = self.get_outfilename(docname)
            try:
                targetmtime = path.getmtime(targetname)
            except Exception:
                targetmtime = 0
            try:
                srcmtime = max(path.getmtime(self.env.doc2path(docname)),
                               template_mtime)
                if srcmtime > targetmtime:
                    yield docname
            except EnvironmentError:
                # source doesn't exist anymore
                pass

    def get_asset_paths(self):
        # type: () -> List[unicode]
        return self.config.html_extra_path

    def render_partial(self, node):
        # type: (nodes.Nodes) -> Dict[unicode, unicode]
        """Utility: Render a lone doctree node."""
        if node is None:
            return {'fragment': ''}
        doc = new_document(b'<partial node>')
        doc.append(node)

        if self._publisher is None:
            self._publisher = Publisher(
                source_class = DocTreeInput,
                destination_class=StringOutput)
            self._publisher.set_components('standalone',
                                           'restructuredtext', 'pseudoxml')

        pub = self._publisher

        pub.reader = DoctreeReader()
        pub.writer = HTMLWriter(self)
        pub.process_programmatic_settings(
            None, {'output_encoding': 'unicode'}, None)
        pub.set_source(doc, None)
        pub.set_destination(None, None)
        pub.publish()
        return pub.writer.parts

    def prepare_writing(self, docnames):
        # type: (Iterable[unicode]) -> nodes.Node
        # create the search indexer
        self.indexer = None
        if self.search:
            from sphinx.search import IndexBuilder, languages
            lang = self.config.html_search_language or self.config.language
            if not lang or lang not in languages:
                lang = 'en'
            self.indexer = IndexBuilder(self.env, lang,
                                        self.config.html_search_options,
                                        self.config.html_search_scorer)
            self.load_indexer(docnames)

        self.docwriter = HTMLWriter(self)
        self.docsettings = OptionParser(
            defaults=self.env.settings,
            components=(self.docwriter,),
            read_config_files=True).get_default_values()
        self.docsettings.compact_lists = bool(self.config.html_compact_lists)

        # determine the additional indices to include
        self.domain_indices = []
        # html_domain_indices can be False/True or a list of index names
        indices_config = self.config.html_domain_indices
        if indices_config:
            for domain_name in sorted(self.env.domains):
                domain = None  # type: Domain
                domain = self.env.domains[domain_name]
                for indexcls in domain.indices:
                    indexname = '%s-%s' % (domain.name, indexcls.name)  # type: unicode
                    if isinstance(indices_config, list):
                        if indexname not in indices_config:
                            continue
                    content, collapse = indexcls(domain).generate()
                    if content:
                        self.domain_indices.append(
                            (indexname, indexcls, content, collapse))

        # format the "last updated on" string, only once is enough since it
        # typically doesn't include the time of day
        lufmt = self.config.html_last_updated_fmt
        if lufmt is not None:
            self.last_updated = format_date(lufmt or _('%b %d, %Y'),  # type: ignore
                                            language=self.config.language)
        else:
            self.last_updated = None

        logo = self.config.html_logo and \
            path.basename(self.config.html_logo) or ''

        favicon = self.config.html_favicon and \
            path.basename(self.config.html_favicon) or ''

        if not isinstance(self.config.html_use_opensearch, string_types):
            logger.warning('html_use_opensearch config value must now be a string')

        self.relations = self.env.collect_relations()

        rellinks = []  # type: List[Tuple[unicode, unicode, unicode, unicode]]
        if self.use_index:
            rellinks.append(('genindex', _('General Index'), 'I', _('index')))
        for indexname, indexcls, content, collapse in self.domain_indices:
            # if it has a short name
            if indexcls.shortname:
                rellinks.append((indexname, indexcls.localname,
                                 '', indexcls.shortname))

        if self.config.html_style is not None:
            stylename = self.config.html_style
        elif self.theme:
            stylename = self.theme.get_config('theme', 'stylesheet')
        else:
            stylename = 'default.css'

        self.globalcontext = dict(
            embedded = self.embedded,
            project = self.config.project,
            release = return_codes_re.sub('', self.config.release),
            version = self.config.version,
            last_updated = self.last_updated,
            copyright = self.config.copyright,
            master_doc = self.config.master_doc,
            use_opensearch = self.config.html_use_opensearch,
            docstitle = self.config.html_title,
            shorttitle = self.config.html_short_title,
            show_copyright = self.config.html_show_copyright,
            show_sphinx = self.config.html_show_sphinx,
            has_source = self.config.html_copy_source,
            show_source = self.config.html_show_sourcelink,
            sourcelink_suffix = self.config.html_sourcelink_suffix,
            file_suffix = self.out_suffix,
            script_files = self.script_files,
            language = self.config.language,
            css_files = self.css_files,
            sphinx_version = __display_version__,
            style = stylename,
            rellinks = rellinks,
            builder = self.name,
            parents = [],
            logo = logo,
            favicon = favicon,
            html5_doctype = self.config.html_experimental_html5_writer and html5_ready,
        )  # type: Dict[unicode, Any]
        if self.theme:
            self.globalcontext.update(
                ('theme_' + key, val) for (key, val) in
                iteritems(self.theme.get_options(self.theme_options)))
        self.globalcontext.update(self.config.html_context)

    def get_doc_context(self, docname, body, metatags):
        # type: (unicode, unicode, Dict) -> Dict[unicode, Any]
        """Collect items for the template context of a page."""
        # find out relations
        prev = next = None
        parents = []
        rellinks = self.globalcontext['rellinks'][:]
        related = self.relations.get(docname)
        titles = self.env.titles
        if related and related[2]:
            try:
                next = {
                    'link': self.get_relative_uri(docname, related[2]),
                    'title': self.render_partial(titles[related[2]])['title']
                }
                rellinks.append((related[2], next['title'], 'N', _('next')))
            except KeyError:
                next = None
        if related and related[1]:
            try:
                prev = {
                    'link': self.get_relative_uri(docname, related[1]),
                    'title': self.render_partial(titles[related[1]])['title']
                }
                rellinks.append((related[1], prev['title'], 'P', _('previous')))
            except KeyError:
                # the relation is (somehow) not in the TOC tree, handle
                # that gracefully
                prev = None
        while related and related[0]:
            try:
                parents.append(
                    {'link': self.get_relative_uri(docname, related[0]),
                     'title': self.render_partial(titles[related[0]])['title']})
            except KeyError:
                pass
            related = self.relations.get(related[0])
        if parents:
            # remove link to the master file; we have a generic
            # "back to index" link already
            parents.pop()
        parents.reverse()

        # title rendered as HTML
        title = self.env.longtitles.get(docname)
        title = title and self.render_partial(title)['title'] or ''

        # Suffix for the document
        source_suffix = path.splitext(self.env.doc2path(docname))[1]

        # the name for the copied source
        if self.config.html_copy_source:
            sourcename = docname + source_suffix
            if source_suffix != self.config.html_sourcelink_suffix:
                sourcename += self.config.html_sourcelink_suffix
        else:
            sourcename = ''

        # metadata for the document
        meta = self.env.metadata.get(docname)

        # local TOC and global TOC tree
        self_toc = TocTree(self.env).get_toc_for(docname, self)
        toc = self.render_partial(self_toc)['fragment']

        return dict(
            parents = parents,
            prev = prev,
            next = next,
            title = title,
            meta = meta,
            body = body,
            metatags = metatags,
            rellinks = rellinks,
            sourcename = sourcename,
            toc = toc,
            # only display a TOC if there's more than one item to show
            display_toc = (self.env.toc_num_entries[docname] > 1),
            page_source_suffix = source_suffix,
        )

    def write_doc(self, docname, doctree):
        # type: (unicode, nodes.Node) -> None
        destination = StringOutput(encoding='utf-8')
        doctree.settings = self.docsettings

        self.secnumbers = self.env.toc_secnumbers.get(docname, {})
        self.fignumbers = self.env.toc_fignumbers.get(docname, {})
        self.imgpath = relative_uri(self.get_target_uri(docname), '_images')
        self.dlpath = relative_uri(self.get_target_uri(docname), '_downloads')
        self.current_docname = docname
        self.docwriter.write(doctree, destination)
        self.docwriter.assemble_parts()
        body = self.docwriter.parts['fragment']
        metatags = self.docwriter.clean_meta

        ctx = self.get_doc_context(docname, body, metatags)
        self.handle_page(docname, ctx, event_arg=doctree)

    def write_doc_serialized(self, docname, doctree):
        # type: (unicode, nodes.Node) -> None
        self.imgpath = relative_uri(self.get_target_uri(docname), self.imagedir)
        self.post_process_images(doctree)
        title = self.env.longtitles.get(docname)
        title = title and self.render_partial(title)['title'] or ''
        self.index_page(docname, doctree, title)

    def finish(self):
        # type: () -> None
        self.finish_tasks.add_task(self.gen_indices)
        self.finish_tasks.add_task(self.gen_additional_pages)
        self.finish_tasks.add_task(self.copy_image_files)
        self.finish_tasks.add_task(self.copy_download_files)
        self.finish_tasks.add_task(self.copy_static_files)
        self.finish_tasks.add_task(self.copy_extra_files)
        self.finish_tasks.add_task(self.write_buildinfo)

        # dump the search index
        self.handle_finish()

    def gen_indices(self):
        # type: () -> None
        logger.info(bold('generating indices...'), nonl=1)

        # the global general index
        if self.use_index:
            self.write_genindex()

        # the global domain-specific indices
        self.write_domain_indices()

        logger.info('')

    def gen_additional_pages(self):
        # type: () -> None
        # pages from extensions
        for pagelist in self.app.emit('html-collect-pages'):
            for pagename, context, template in pagelist:
                self.handle_page(pagename, context, template)

        logger.info(bold('writing additional pages...'), nonl=1)

        # additional pages from conf.py
        for pagename, template in self.config.html_additional_pages.items():
            self.info(' ' + pagename, nonl=1)
            self.handle_page(pagename, {}, template)

        # the search page
        if self.search:
            logger.info(' search', nonl=1)
            self.handle_page('search', {}, 'search.html')

        # the opensearch xml file
        if self.config.html_use_opensearch and self.search:
            logger.info(' opensearch', nonl=1)
            fn = path.join(self.outdir, '_static', 'opensearch.xml')
            self.handle_page('opensearch', {}, 'opensearch.xml', outfilename=fn)

        logger.info('')

    def write_genindex(self):
        # type: () -> None
        # the total count of lines for each index letter, used to distribute
        # the entries into two columns
        genindex = IndexEntries(self.env).create_index(self)
        indexcounts = []
        for _k, entries in genindex:
            indexcounts.append(sum(1 + len(subitems)
                                   for _, (_, subitems, _) in entries))

        genindexcontext = dict(
            genindexentries = genindex,
            genindexcounts = indexcounts,
            split_index = self.config.html_split_index,
        )
        logger.info(' genindex', nonl=1)

        if self.config.html_split_index:
            self.handle_page('genindex', genindexcontext,
                             'genindex-split.html')
            self.handle_page('genindex-all', genindexcontext,
                             'genindex.html')
            for (key, entries), count in zip(genindex, indexcounts):
                ctx = {'key': key, 'entries': entries, 'count': count,
                       'genindexentries': genindex}
                self.handle_page('genindex-' + key, ctx,
                                 'genindex-single.html')
        else:
            self.handle_page('genindex', genindexcontext, 'genindex.html')

    def write_domain_indices(self):
        # type: () -> None
        for indexname, indexcls, content, collapse in self.domain_indices:
            indexcontext = dict(
                indextitle = indexcls.localname,
                content = content,
                collapse_index = collapse,
            )
            logger.info(' ' + indexname, nonl=1)
            self.handle_page(indexname, indexcontext, 'domainindex.html')

    def copy_image_files(self):
        # type: () -> None
        if self.images:
            stringify_func = ImageAdapter(self.app.env).get_original_image_uri
            ensuredir(path.join(self.outdir, self.imagedir))
            for src in status_iterator(self.images, 'copying images... ', "brown",
                                       len(self.images), self.app.verbosity,
                                       stringify_func=stringify_func):
                dest = self.images[src]
                try:
                    copyfile(path.join(self.srcdir, src),
                             path.join(self.outdir, self.imagedir, dest))
                except Exception as err:
                    logger.warning('cannot copy image file %r: %s',
                                   path.join(self.srcdir, src), err)

    def copy_download_files(self):
        # type: () -> None
        def to_relpath(f):
            # type: (unicode) -> unicode
            return relative_path(self.srcdir, f)
        # copy downloadable files
        if self.env.dlfiles:
            ensuredir(path.join(self.outdir, '_downloads'))
            for src in status_iterator(self.env.dlfiles, 'copying downloadable files... ',
                                       "brown", len(self.env.dlfiles), self.app.verbosity,
                                       stringify_func=to_relpath):
                dest = self.env.dlfiles[src][1]
                try:
                    copyfile(path.join(self.srcdir, src),
                             path.join(self.outdir, '_downloads', dest))
                except Exception as err:
                    logger.warning('cannot copy downloadable file %r: %s',
                                   path.join(self.srcdir, src), err)

    def copy_static_files(self):
        # type: () -> None
        # copy static files
        logger.info(bold('copying static files... '), nonl=True)
        ensuredir(path.join(self.outdir, '_static'))
        # first, create pygments style file
        with open(path.join(self.outdir, '_static', 'pygments.css'), 'w') as f:
            f.write(self.highlighter.get_stylesheet())  # type: ignore
        # then, copy translations JavaScript file
        if self.config.language is not None:
            jsfile = self._get_translations_js()
            if jsfile:
                copyfile(jsfile, path.join(self.outdir, '_static',
                                           'translations.js'))

        # copy non-minified stemmer JavaScript file
        if self.indexer is not None:
            jsfile = self.indexer.get_js_stemmer_rawcode()
            if jsfile:
                copyfile(jsfile, path.join(self.outdir, '_static', '_stemmer.js'))

        ctx = self.globalcontext.copy()

        # add context items for search function used in searchtools.js_t
        if self.indexer is not None:
            ctx.update(self.indexer.context_for_searchtool())

        # then, copy over theme-supplied static files
        if self.theme:
            for theme_path in self.theme.get_theme_dirs()[::-1]:
                entry = path.join(theme_path, 'static')
                copy_asset(entry, path.join(self.outdir, '_static'), excluded=DOTFILES,
                           context=ctx, renderer=self.templates)
        # then, copy over all user-supplied static files
        excluded = Matcher(self.config.exclude_patterns + ["**/.*"])
        for static_path in self.config.html_static_path:
            entry = path.join(self.confdir, static_path)
            if not path.exists(entry):
                logger.warning('html_static_path entry %r does not exist', entry)
                continue
            copy_asset(entry, path.join(self.outdir, '_static'), excluded,
                       context=ctx, renderer=self.templates)
        # copy logo and favicon files if not already in static path
        if self.config.html_logo:
            logobase = path.basename(self.config.html_logo)
            logotarget = path.join(self.outdir, '_static', logobase)
            if not path.isfile(path.join(self.confdir, self.config.html_logo)):
                logger.warning('logo file %r does not exist', self.config.html_logo)
            elif not path.isfile(logotarget):
                copyfile(path.join(self.confdir, self.config.html_logo),
                         logotarget)
        if self.config.html_favicon:
            iconbase = path.basename(self.config.html_favicon)
            icontarget = path.join(self.outdir, '_static', iconbase)
            if not path.isfile(path.join(self.confdir, self.config.html_favicon)):
                logger.warning('favicon file %r does not exist', self.config.html_favicon)
            elif not path.isfile(icontarget):
                copyfile(path.join(self.confdir, self.config.html_favicon),
                         icontarget)
        logger.info('done')

    def copy_extra_files(self):
        # type: () -> None
        # copy html_extra_path files
        logger.info(bold('copying extra files... '), nonl=True)
        excluded = Matcher(self.config.exclude_patterns)

        for extra_path in self.config.html_extra_path:
            entry = path.join(self.confdir, extra_path)
            if not path.exists(entry):
                logger.warning('html_extra_path entry %r does not exist', entry)
                continue

            copy_asset(entry, self.outdir, excluded)
        logger.info('done')

    def write_buildinfo(self):
        # type: () -> None
        # write build info file
        with open(path.join(self.outdir, '.buildinfo'), 'w') as fp:
            fp.write('# Sphinx build info version 1\n'
                     '# This file hashes the configuration used when building'
                     ' these files. When it is not found, a full rebuild will'
                     ' be done.\nconfig: %s\ntags: %s\n' %
                     (self.config_hash, self.tags_hash))

    def cleanup(self):
        # type: () -> None
        # clean up theme stuff
        if self.theme:
            self.theme.cleanup()

    def post_process_images(self, doctree):
        # type: (nodes.Node) -> None
        """Pick the best candidate for an image and link down-scaled images to
        their high res version.
        """
        Builder.post_process_images(self, doctree)

        if self.config.html_scaled_image_link and self.html_scaled_image_link:
            for node in doctree.traverse(nodes.image):
                scale_keys = ('scale', 'width', 'height')
                if not any((key in node) for key in scale_keys) or \
                   isinstance(node.parent, nodes.reference):
                    # docutils does unfortunately not preserve the
                    # ``target`` attribute on images, so we need to check
                    # the parent node here.
                    continue
                uri = node['uri']
                reference = nodes.reference('', '', internal=True)
                if uri in self.images:
                    reference['refuri'] = posixpath.join(self.imgpath,
                                                         self.images[uri])
                else:
                    reference['refuri'] = uri
                node.replace_self(reference)
                reference.append(node)

    def load_indexer(self, docnames):
        # type: (Iterable[unicode]) -> None
        keep = set(self.env.all_docs) - set(docnames)
        try:
            searchindexfn = path.join(self.outdir, self.searchindex_filename)
            if self.indexer_dumps_unicode:
                f = codecs.open(searchindexfn, 'r', encoding='utf-8')  # type: ignore
            else:
                f = open(searchindexfn, 'rb')  # type: ignore
            with f:
                self.indexer.load(f, self.indexer_format)
        except (IOError, OSError, ValueError):
            if keep:
                logger.warning('search index couldn\'t be loaded, but not all '
                               'documents will be built: the index will be '
                               'incomplete.')
        # delete all entries for files that will be rebuilt
        self.indexer.prune(keep)

    def index_page(self, pagename, doctree, title):
        # type: (unicode, nodes.Node, unicode) -> None
        # only index pages with title
        if self.indexer is not None and title:
            filename = self.env.doc2path(pagename, base=None)
            try:
                self.indexer.feed(pagename, filename, title, doctree)
            except TypeError:
                # fallback for old search-adapters
                self.indexer.feed(pagename, title, doctree)  # type: ignore

    def _get_local_toctree(self, docname, collapse=True, **kwds):
        # type: (unicode, bool, Any) -> unicode
        if 'includehidden' not in kwds:
            kwds['includehidden'] = False
        return self.render_partial(TocTree(self.env).get_toctree_for(
            docname, self, collapse, **kwds))['fragment']

    def get_outfilename(self, pagename):
        # type: (unicode) -> unicode
        return path.join(self.outdir, os_path(pagename) + self.out_suffix)

    def add_sidebars(self, pagename, ctx):
        # type: (unicode, Dict) -> None
        def has_wildcard(pattern):
            # type: (unicode) -> bool
            return any(char in pattern for char in '*?[')
        sidebars = None
        matched = None
        customsidebar = None
        for pattern, patsidebars in iteritems(self.config.html_sidebars):
            if patmatch(pagename, pattern):
                if matched:
                    if has_wildcard(pattern):
                        # warn if both patterns contain wildcards
                        if has_wildcard(matched):
                            logger.warning('page %s matches two patterns in '
                                           'html_sidebars: %r and %r',
                                           pagename, matched, pattern)
                        # else the already matched pattern is more specific
                        # than the present one, because it contains no wildcard
                        continue
                matched = pattern
                sidebars = patsidebars
        if sidebars is None:
            # keep defaults
            pass
        elif isinstance(sidebars, string_types):
            # 0.x compatible mode: insert custom sidebar before searchbox
            customsidebar = sidebars
            sidebars = None
        ctx['sidebars'] = sidebars
        ctx['customsidebar'] = customsidebar

    # --------- these are overwritten by the serialization builder

    def get_target_uri(self, docname, typ=None):
        # type: (unicode, unicode) -> unicode
        return docname + self.link_suffix

    def handle_page(self, pagename, addctx, templatename='page.html',
                    outfilename=None, event_arg=None):
        # type: (unicode, Dict, unicode, unicode, Any) -> None
        ctx = self.globalcontext.copy()
        ctx['warn'] = self.warn
        # current_page_name is backwards compatibility
        ctx['pagename'] = ctx['current_page_name'] = pagename
        ctx['encoding'] = self.config.html_output_encoding
        default_baseuri = self.get_target_uri(pagename)
        # in the singlehtml builder, default_baseuri still contains an #anchor
        # part, which relative_uri doesn't really like...
        default_baseuri = default_baseuri.rsplit('#', 1)[0]

        def pathto(otheruri, resource=False, baseuri=default_baseuri):
            # type: (unicode, bool, unicode) -> unicode
            if resource and '://' in otheruri:
                # allow non-local resources given by scheme
                return otheruri
            elif not resource:
                otheruri = self.get_target_uri(otheruri)
            uri = relative_uri(baseuri, otheruri) or '#'
            if uri == '#' and not self.allow_sharp_as_current_path:
                uri = baseuri
            return uri
        ctx['pathto'] = pathto

        def hasdoc(name):
            # type: (unicode) -> bool
            if name in self.env.all_docs:
                return True
            elif name == 'search' and self.search:
                return True
            elif name == 'genindex' and self.get_builder_config('use_index', 'html'):
                return True
            return False
        ctx['hasdoc'] = hasdoc

        ctx['toctree'] = lambda **kw: self._get_local_toctree(pagename, **kw)
        self.add_sidebars(pagename, ctx)
        ctx.update(addctx)

        self.update_page_context(pagename, templatename, ctx, event_arg)
        newtmpl = self.app.emit_firstresult('html-page-context', pagename,
                                            templatename, ctx, event_arg)
        if newtmpl:
            templatename = newtmpl

        try:
            output = self.templates.render(templatename, ctx)
        except UnicodeError:
            logger.warning("a Unicode error occurred when rendering the page %s. "
                           "Please make sure all config values that contain "
                           "non-ASCII content are Unicode strings.", pagename)
            return

        if not outfilename:
            outfilename = self.get_outfilename(pagename)
        # outfilename's path is in general different from self.outdir
        ensuredir(path.dirname(outfilename))
        try:
            with codecs.open(outfilename, 'w', ctx['encoding'], 'xmlcharrefreplace') as f:  # type: ignore  # NOQA
                f.write(output)
        except (IOError, OSError) as err:
            logger.warning("error writing file %s: %s", outfilename, err)
        if self.copysource and ctx.get('sourcename'):
            # copy the source file for the "show source" link
            source_name = path.join(self.outdir, '_sources',
                                    os_path(ctx['sourcename']))
            ensuredir(path.dirname(source_name))
            copyfile(self.env.doc2path(pagename), source_name)

    def update_page_context(self, pagename, templatename, ctx, event_arg):
        # type: (unicode, unicode, Dict, Any) -> None
        pass

    def handle_finish(self):
        # type: () -> None
        if self.indexer:
            self.finish_tasks.add_task(self.dump_search_index)
        self.finish_tasks.add_task(self.dump_inventory)

    def dump_inventory(self):
        # type: () -> None
        logger.info(bold('dumping object inventory... '), nonl=True)
        InventoryFile.dump(path.join(self.outdir, INVENTORY_FILENAME), self.env, self)
        logger.info('done')

    def dump_search_index(self):
        # type: () -> None
        logger.info(
            bold('dumping search index in %s ... ' % self.indexer.label()),
            nonl=True)
        self.indexer.prune(self.env.all_docs)
        searchindexfn = path.join(self.outdir, self.searchindex_filename)
        # first write to a temporary file, so that if dumping fails,
        # the existing index won't be overwritten
        if self.indexer_dumps_unicode:
            f = codecs.open(searchindexfn + '.tmp', 'w', encoding='utf-8')  # type: ignore
        else:
            f = open(searchindexfn + '.tmp', 'wb')  # type: ignore
        with f:
            self.indexer.dump(f, self.indexer_format)
        movefile(searchindexfn + '.tmp', searchindexfn)
        logger.info('done')


class DirectoryHTMLBuilder(StandaloneHTMLBuilder):
    """
    A StandaloneHTMLBuilder that creates all HTML pages as "index.html" in
    a directory given by their pagename, so that generated URLs don't have
    ``.html`` in them.
    """
    name = 'dirhtml'

    def get_target_uri(self, docname, typ=None):
        # type: (unicode, unicode) -> unicode
        if docname == 'index':
            return ''
        if docname.endswith(SEP + 'index'):
            return docname[:-5]  # up to sep
        return docname + SEP

    def get_outfilename(self, pagename):
        # type: (unicode) -> unicode
        if pagename == 'index' or pagename.endswith(SEP + 'index'):
            outfilename = path.join(self.outdir, os_path(pagename) +
                                    self.out_suffix)
        else:
            outfilename = path.join(self.outdir, os_path(pagename),
                                    'index' + self.out_suffix)

        return outfilename

    def prepare_writing(self, docnames):
        # type: (Iterable[unicode]) -> None
        StandaloneHTMLBuilder.prepare_writing(self, docnames)
        self.globalcontext['no_search_suffix'] = True


class SingleFileHTMLBuilder(StandaloneHTMLBuilder):
    """
    A StandaloneHTMLBuilder subclass that puts the whole document tree on one
    HTML page.
    """
    name = 'singlehtml'
    copysource = False

    def get_outdated_docs(self):  # type: ignore
        # type: () -> Union[unicode, List[unicode]]
        return 'all documents'

    def get_target_uri(self, docname, typ=None):
        # type: (unicode, unicode) -> unicode
        if docname in self.env.all_docs:
            # all references are on the same page...
            return self.config.master_doc + self.out_suffix + \
                '#document-' + docname
        else:
            # chances are this is a html_additional_page
            return docname + self.out_suffix

    def get_relative_uri(self, from_, to, typ=None):
        # type: (unicode, unicode, unicode) -> unicode
        # ignore source
        return self.get_target_uri(to, typ)

    def fix_refuris(self, tree):
        # type: (nodes.Node) -> None
        # fix refuris with double anchor
        fname = self.config.master_doc + self.out_suffix
        for refnode in tree.traverse(nodes.reference):
            if 'refuri' not in refnode:
                continue
            refuri = refnode['refuri']
            hashindex = refuri.find('#')
            if hashindex < 0:
                continue
            hashindex = refuri.find('#', hashindex + 1)
            if hashindex >= 0:
                refnode['refuri'] = fname + refuri[hashindex:]

    def _get_local_toctree(self, docname, collapse=True, **kwds):
        # type: (unicode, bool, Any) -> unicode
        if 'includehidden' not in kwds:
            kwds['includehidden'] = False
        toctree = TocTree(self.env).get_toctree_for(docname, self, collapse, **kwds)
        if toctree is not None:
            self.fix_refuris(toctree)
        return self.render_partial(toctree)['fragment']

    def assemble_doctree(self):
        # type: () -> nodes.Node
        master = self.config.master_doc
        tree = self.env.get_doctree(master)
        tree = inline_all_toctrees(self, set(), master, tree, darkgreen, [master])
        tree['docname'] = master
        self.env.resolve_references(tree, master, self)
        self.fix_refuris(tree)
        return tree

    def assemble_toc_secnumbers(self):
        # type: () -> Dict[unicode, Dict[unicode, Tuple[int, ...]]]
        # Assemble toc_secnumbers to resolve section numbers on SingleHTML.
        # Merge all secnumbers to single secnumber.
        #
        # Note: current Sphinx has refid confliction in singlehtml mode.
        #       To avoid the problem, it replaces key of secnumbers to
        #       tuple of docname and refid.
        #
        #       There are related codes in inline_all_toctres() and
        #       HTMLTranslter#add_secnumber().
        new_secnumbers = {}  # type: Dict[unicode, Tuple[int, ...]]
        for docname, secnums in iteritems(self.env.toc_secnumbers):
            for id, secnum in iteritems(secnums):
                alias = "%s/%s" % (docname, id)
                new_secnumbers[alias] = secnum

        return {self.config.master_doc: new_secnumbers}

    def assemble_toc_fignumbers(self):
        # type: () -> Dict[unicode, Dict[unicode, Dict[unicode, Tuple[int, ...]]]]  # NOQA
        # Assemble toc_fignumbers to resolve figure numbers on SingleHTML.
        # Merge all fignumbers to single fignumber.
        #
        # Note: current Sphinx has refid confliction in singlehtml mode.
        #       To avoid the problem, it replaces key of secnumbers to
        #       tuple of docname and refid.
        #
        #       There are related codes in inline_all_toctres() and
        #       HTMLTranslter#add_fignumber().
        new_fignumbers = {}  # type: Dict[unicode, Dict[unicode, Tuple[int, ...]]]
        # {u'foo': {'figure': {'id2': (2,), 'id1': (1,)}}, u'bar': {'figure': {'id1': (3,)}}}
        for docname, fignumlist in iteritems(self.env.toc_fignumbers):
            for figtype, fignums in iteritems(fignumlist):
                alias = "%s/%s" % (docname, figtype)
                new_fignumbers.setdefault(alias, {})
                for id, fignum in iteritems(fignums):
                    new_fignumbers[alias][id] = fignum

        return {self.config.master_doc: new_fignumbers}

    def get_doc_context(self, docname, body, metatags):
        # type: (unicode, unicode, Dict) -> Dict
        # no relation links...
        toc = TocTree(self.env).get_toctree_for(self.config.master_doc,
                                                self, False)
        # if there is no toctree, toc is None
        if toc:
            self.fix_refuris(toc)
            toc = self.render_partial(toc)['fragment']
            display_toc = True
        else:
            toc = ''
            display_toc = False
        return dict(
            parents = [],
            prev = None,
            next = None,
            docstitle = None,
            title = self.config.html_title,
            meta = None,
            body = body,
            metatags = metatags,
            rellinks = [],
            sourcename = '',
            toc = toc,
            display_toc = display_toc,
        )

    def write(self, *ignored):
        # type: (Any) -> None
        docnames = self.env.all_docs

        logger.info(bold('preparing documents... '), nonl=True)
        self.prepare_writing(docnames)
        logger.info('done')

        logger.info(bold('assembling single document... '), nonl=True)
        doctree = self.assemble_doctree()
        self.env.toc_secnumbers = self.assemble_toc_secnumbers()
        self.env.toc_fignumbers = self.assemble_toc_fignumbers()
        logger.info('')
        logger.info(bold('writing... '), nonl=True)
        self.write_doc_serialized(self.config.master_doc, doctree)
        self.write_doc(self.config.master_doc, doctree)
        logger.info('done')

    def finish(self):
        # type: () -> None
        # no indices or search pages are supported
        logger.info(bold('writing additional files...'), nonl=1)

        # additional pages from conf.py
        for pagename, template in self.config.html_additional_pages.items():
            self.info(' ' + pagename, nonl=1)
            self.handle_page(pagename, {}, template)

        if self.config.html_use_opensearch:
            logger.info(' opensearch', nonl=1)
            fn = path.join(self.outdir, '_static', 'opensearch.xml')
            self.handle_page('opensearch', {}, 'opensearch.xml', outfilename=fn)

        logger.info('')

        self.copy_image_files()
        self.copy_download_files()
        self.copy_static_files()
        self.copy_extra_files()
        self.write_buildinfo()
        self.dump_inventory()


class SerializingHTMLBuilder(StandaloneHTMLBuilder):
    """
    An abstract builder that serializes the generated HTML.
    """
    #: the serializing implementation to use.  Set this to a module that
    #: implements a `dump`, `load`, `dumps` and `loads` functions
    #: (pickle, simplejson etc.)
    implementation = None  # type: Any
    implementation_dumps_unicode = False
    #: additional arguments for dump()
    additional_dump_args = ()  # type: Tuple

    #: the filename for the global context file
    globalcontext_filename = None  # type: unicode

    supported_image_types = ['image/svg+xml', 'image/png',
                             'image/gif', 'image/jpeg']

    def init(self):
        # type: () -> None
        self.config_hash = ''
        self.tags_hash = ''
        self.imagedir = '_images'
        self.current_docname = None
        self.theme = None       # no theme necessary
        self.templates = None   # no template bridge necessary
        self.init_templates()
        self.init_highlighter()
        self.use_index = self.get_builder_config('use_index', 'html')

    def get_target_uri(self, docname, typ=None):
        # type: (unicode, unicode) -> unicode
        if docname == 'index':
            return ''
        if docname.endswith(SEP + 'index'):
            return docname[:-5]  # up to sep
        return docname + SEP

    def dump_context(self, context, filename):
        # type: (Dict, unicode) -> None
        if self.implementation_dumps_unicode:
            f = codecs.open(filename, 'w', encoding='utf-8')  # type: ignore
        else:
            f = open(filename, 'wb')  # type: ignore
        with f:
            self.implementation.dump(context, f, *self.additional_dump_args)

    def handle_page(self, pagename, ctx, templatename='page.html',
                    outfilename=None, event_arg=None):
        # type: (unicode, Dict, unicode, unicode, Any) -> None
        ctx['current_page_name'] = pagename
        self.add_sidebars(pagename, ctx)

        if not outfilename:
            outfilename = path.join(self.outdir,
                                    os_path(pagename) + self.out_suffix)

        # we're not taking the return value here, since no template is
        # actually rendered
        self.app.emit('html-page-context', pagename, templatename, ctx, event_arg)

        ensuredir(path.dirname(outfilename))
        self.dump_context(ctx, outfilename)

        # if there is a source file, copy the source file for the
        # "show source" link
        if ctx.get('sourcename'):
            source_name = path.join(self.outdir, '_sources',
                                    os_path(ctx['sourcename']))
            ensuredir(path.dirname(source_name))
            copyfile(self.env.doc2path(pagename), source_name)

    def handle_finish(self):
        # type: () -> None
        # dump the global context
        outfilename = path.join(self.outdir, self.globalcontext_filename)
        self.dump_context(self.globalcontext, outfilename)

        # super here to dump the search index
        StandaloneHTMLBuilder.handle_finish(self)

        # copy the environment file from the doctree dir to the output dir
        # as needed by the web app
        copyfile(path.join(self.doctreedir, ENV_PICKLE_FILENAME),
                 path.join(self.outdir, ENV_PICKLE_FILENAME))

        # touch 'last build' file, used by the web application to determine
        # when to reload its environment and clear the cache
        open(path.join(self.outdir, LAST_BUILD_FILENAME), 'w').close()


class PickleHTMLBuilder(SerializingHTMLBuilder):
    """
    A Builder that dumps the generated HTML into pickle files.
    """
    implementation = pickle
    implementation_dumps_unicode = False
    additional_dump_args = (pickle.HIGHEST_PROTOCOL,)
    indexer_format = pickle
    indexer_dumps_unicode = False
    name = 'pickle'
    out_suffix = '.fpickle'
    globalcontext_filename = 'globalcontext.pickle'
    searchindex_filename = 'searchindex.pickle'


# compatibility alias
WebHTMLBuilder = PickleHTMLBuilder


class JSONHTMLBuilder(SerializingHTMLBuilder):
    """
    A builder that dumps the generated HTML into JSON files.
    """
    implementation = jsonimpl
    implementation_dumps_unicode = True
    indexer_format = jsonimpl
    indexer_dumps_unicode = True
    name = 'json'
    out_suffix = '.fjson'
    globalcontext_filename = 'globalcontext.json'
    searchindex_filename = 'searchindex.json'

    def init(self):
        # type: () -> None
        SerializingHTMLBuilder.init(self)


def setup(app):
    # type: (Sphinx) -> Dict[unicode, Any]
    # builders
    app.add_builder(StandaloneHTMLBuilder)
    app.add_builder(DirectoryHTMLBuilder)
    app.add_builder(SingleFileHTMLBuilder)
    app.add_builder(PickleHTMLBuilder)
    app.add_builder(JSONHTMLBuilder)

    # config values
    app.add_config_value('html_theme', 'alabaster', 'html')
    app.add_config_value('html_theme_path', [], 'html')
    app.add_config_value('html_theme_options', {}, 'html')
    app.add_config_value('html_title',
                         lambda self: l_('%s %s documentation') % (self.project, self.release),
                         'html', string_classes)
    app.add_config_value('html_short_title', lambda self: self.html_title, 'html')
    app.add_config_value('html_style', None, 'html', string_classes)
    app.add_config_value('html_logo', None, 'html', string_classes)
    app.add_config_value('html_favicon', None, 'html', string_classes)
    app.add_config_value('html_static_path', [], 'html')
    app.add_config_value('html_extra_path', [], 'html')
    app.add_config_value('html_last_updated_fmt', None, 'html', string_classes)
    app.add_config_value('html_use_smartypants', None, 'html')
    app.add_config_value('html_sidebars', {}, 'html')
    app.add_config_value('html_additional_pages', {}, 'html')
    app.add_config_value('html_domain_indices', True, 'html', [list])
    app.add_config_value('html_add_permalinks', u'\u00B6', 'html')
    app.add_config_value('html_use_index', True, 'html')
    app.add_config_value('html_split_index', False, 'html')
    app.add_config_value('html_copy_source', True, 'html')
    app.add_config_value('html_show_sourcelink', True, 'html')
    app.add_config_value('html_sourcelink_suffix', '.txt', 'html')
    app.add_config_value('html_use_opensearch', '', 'html')
    app.add_config_value('html_file_suffix', None, 'html', string_classes)
    app.add_config_value('html_link_suffix', None, 'html', string_classes)
    app.add_config_value('html_show_copyright', True, 'html')
    app.add_config_value('html_show_sphinx', True, 'html')
    app.add_config_value('html_context', {}, 'html')
    app.add_config_value('html_output_encoding', 'utf-8', 'html')
    app.add_config_value('html_compact_lists', True, 'html')
    app.add_config_value('html_secnumber_suffix', '. ', 'html')
    app.add_config_value('html_search_language', None, 'html', string_classes)
    app.add_config_value('html_search_options', {}, 'html')
    app.add_config_value('html_search_scorer', '', None)
    app.add_config_value('html_scaled_image_link', True, 'html')
    app.add_config_value('html_experimental_html5_writer', None, 'html')

    return {
        'version': 'builtin',
        'parallel_read_safe': True,
        'parallel_write_safe': True,
    }
