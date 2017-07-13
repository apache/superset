# -*- coding: utf-8 -*-
"""
    sphinx.environment
    ~~~~~~~~~~~~~~~~~~

    Global creation environment.

    :copyright: Copyright 2007-2017 by the Sphinx team, see AUTHORS.
    :license: BSD, see LICENSE for details.
"""

import re
import os
import sys
import time
import types
import codecs
import fnmatch
import warnings
from os import path
from collections import defaultdict

from six import BytesIO, itervalues, class_types, next
from six.moves import cPickle as pickle

from docutils.io import NullOutput
from docutils.core import Publisher
from docutils.utils import Reporter, get_source_line, normalize_language_tag
from docutils.utils.smartquotes import smartchars
from docutils.parsers.rst import roles
from docutils.parsers.rst.languages import en as english
from docutils.frontend import OptionParser

from sphinx import addnodes
from sphinx.io import SphinxStandaloneReader, SphinxDummyWriter, SphinxFileInput
from sphinx.util import logging
from sphinx.util import get_matching_docs, FilenameUniqDict, status_iterator
from sphinx.util.nodes import is_translatable
from sphinx.util.osutil import SEP, ensuredir
from sphinx.util.i18n import find_catalog_files
from sphinx.util.console import bold  # type: ignore
from sphinx.util.docutils import sphinx_domains, WarningStream
from sphinx.util.matching import compile_matchers
from sphinx.util.parallel import ParallelTasks, parallel_available, make_chunks
from sphinx.util.websupport import is_commentable
from sphinx.errors import SphinxError, ExtensionError
from sphinx.locale import _
from sphinx.transforms import SphinxTransformer
from sphinx.versioning import add_uids, merge_doctrees
from sphinx.deprecation import RemovedInSphinx17Warning, RemovedInSphinx20Warning
from sphinx.environment.adapters.indexentries import IndexEntries
from sphinx.environment.adapters.toctree import TocTree

if False:
    # For type annotation
    from typing import Any, Callable, Dict, IO, Iterator, List, Pattern, Set, Tuple, Type, Union  # NOQA
    from docutils import nodes  # NOQA
    from sphinx.application import Sphinx  # NOQA
    from sphinx.builders import Builder  # NOQA
    from sphinx.config import Config  # NOQA
    from sphinx.domains import Domain  # NOQA

logger = logging.getLogger(__name__)

default_settings = {
    'embed_stylesheet': False,
    'cloak_email_addresses': True,
    'pep_base_url': 'https://www.python.org/dev/peps/',
    'rfc_base_url': 'https://tools.ietf.org/html/',
    'input_encoding': 'utf-8-sig',
    'doctitle_xform': False,
    'sectsubtitle_xform': False,
    'halt_level': 5,
    'file_insertion_enabled': True,
}

# This is increased every time an environment attribute is added
# or changed to properly invalidate pickle files.
#
# NOTE: increase base version by 2 to have distinct numbers for Py2 and 3
ENV_VERSION = 52 + (sys.version_info[0] - 2)


dummy_reporter = Reporter('', 4, 4)

versioning_conditions = {
    'none': False,
    'text': is_translatable,
    'commentable': is_commentable,
}  # type: Dict[unicode, Union[bool, Callable]]


class NoUri(Exception):
    """Raised by get_relative_uri if there is no URI available."""
    pass


class BuildEnvironment(object):
    """
    The environment in which the ReST files are translated.
    Stores an inventory of cross-file targets and provides doctree
    transformations to resolve links to them.
    """

    domains = None  # type: Dict[unicode, Domain]

    # --------- ENVIRONMENT PERSISTENCE ----------------------------------------

    @staticmethod
    def load(f, app=None):
        # type: (IO, Sphinx) -> BuildEnvironment
        env = pickle.load(f)
        if env.version != ENV_VERSION:
            raise IOError('build environment version not current')
        if app:
            env.app = app
            env.config.values = app.config.values
            if env.srcdir != app.srcdir:
                raise IOError('source directory has changed')
        return env

    @classmethod
    def loads(cls, string, app=None):
        # type: (unicode, Sphinx) -> BuildEnvironment
        io = BytesIO(string)
        return cls.load(io, app)

    @classmethod
    def frompickle(cls, filename, app):
        # type: (unicode, Sphinx) -> BuildEnvironment
        with open(filename, 'rb') as f:
            return cls.load(f, app)

    @staticmethod
    def dump(env, f):
        # type: (BuildEnvironment, IO) -> None
        # remove unpicklable attributes
        app = env.app
        del env.app
        values = env.config.values
        del env.config.values
        domains = env.domains
        del env.domains
        # remove potentially pickling-problematic values from config
        for key, val in list(vars(env.config).items()):
            if key.startswith('_') or \
               isinstance(val, types.ModuleType) or \
               isinstance(val, types.FunctionType) or \
               isinstance(val, class_types):
                del env.config[key]
        pickle.dump(env, f, pickle.HIGHEST_PROTOCOL)
        # reset attributes
        env.domains = domains
        env.config.values = values
        env.app = app

    @classmethod
    def dumps(cls, env):
        # type: (BuildEnvironment) -> unicode
        io = BytesIO()
        cls.dump(env, io)
        return io.getvalue()

    def topickle(self, filename):
        # type: (unicode) -> None
        with open(filename, 'wb') as f:
            self.dump(self, f)

    # --------- ENVIRONMENT INITIALIZATION -------------------------------------

    def __init__(self, app):
        # type: (Sphinx) -> None
        self.app = app
        self.doctreedir = app.doctreedir
        self.srcdir = app.srcdir
        self.config = app.config

        # the method of doctree versioning; see set_versioning_method
        self.versioning_condition = None  # type: Union[bool, Callable]
        self.versioning_compare = None  # type: bool

        # all the registered domains, set by the application
        self.domains = {}

        # the docutils settings for building
        self.settings = default_settings.copy()
        self.settings['env'] = self

        # the function to write warning messages with
        self._warnfunc = None  # type: Callable

        # this is to invalidate old pickles
        self.version = ENV_VERSION

        # All "docnames" here are /-separated and relative and exclude
        # the source suffix.

        self.found_docs = set()     # type: Set[unicode]
                                    # contains all existing docnames
        self.all_docs = {}          # type: Dict[unicode, float]
                                    # docname -> mtime at the time of reading
                                    # contains all read docnames
        self.dependencies = defaultdict(set)    # type: Dict[unicode, Set[unicode]]
                                    # docname -> set of dependent file
                                    # names, relative to documentation root
        self.included = set()       # type: Set[unicode]
                                    # docnames included from other documents
        self.reread_always = set()  # type: Set[unicode]
                                    # docnames to re-read unconditionally on
                                    # next build

        # File metadata
        self.metadata = defaultdict(dict)       # type: Dict[unicode, Dict[unicode, Any]]
                                                # docname -> dict of metadata items

        # TOC inventory
        self.titles = {}            # type: Dict[unicode, nodes.Node]
                                    # docname -> title node
        self.longtitles = {}        # type: Dict[unicode, nodes.Node]
                                    # docname -> title node; only different if
                                    # set differently with title directive
        self.tocs = {}              # type: Dict[unicode, nodes.Node]
                                    # docname -> table of contents nodetree
        self.toc_num_entries = {}   # type: Dict[unicode, int]
                                    # docname -> number of real entries

        # used to determine when to show the TOC
        # in a sidebar (don't show if it's only one item)
        self.toc_secnumbers = {}    # type: Dict[unicode, Dict[unicode, Tuple[int, ...]]]
                                    # docname -> dict of sectionid -> number
        self.toc_fignumbers = {}    # type: Dict[unicode, Dict[unicode, Dict[unicode, Tuple[int, ...]]]]  # NOQA
                                    # docname -> dict of figtype ->
                                    # dict of figureid -> number

        self.toctree_includes = {}  # type: Dict[unicode, List[unicode]]
                                    # docname -> list of toctree includefiles
        self.files_to_rebuild = {}  # type: Dict[unicode, Set[unicode]]
                                    # docname -> set of files
                                    # (containing its TOCs) to rebuild too
        self.glob_toctrees = set()  # type: Set[unicode]
                                    # docnames that have :glob: toctrees
        self.numbered_toctrees = set()  # type: Set[unicode]
                                        # docnames that have :numbered: toctrees

        # domain-specific inventories, here to be pickled
        self.domaindata = {}        # type: Dict[unicode, Dict]
                                    # domainname -> domain-specific dict

        # Other inventories
        self.indexentries = {}      # type: Dict[unicode, List[Tuple[unicode, unicode, unicode, unicode, unicode]]]  # NOQA
                                    # docname -> list of
                                    # (type, unicode, target, aliasname)
        self.versionchanges = {}    # type: Dict[unicode, List[Tuple[unicode, unicode, int, unicode, unicode, unicode]]]  # NOQA
                                    # version -> list of (type, docname,
                                    # lineno, module, descname, content)

        # these map absolute path -> (docnames, unique filename)
        self.images = FilenameUniqDict()
        self.dlfiles = FilenameUniqDict()

        # the original URI for images
        self.original_image_uri = {}  # type: Dict[unicode, unicode]

        # temporary data storage while reading a document
        self.temp_data = {}         # type: Dict[unicode, Any]
        # context for cross-references (e.g. current module or class)
        # this is similar to temp_data, but will for example be copied to
        # attributes of "any" cross references
        self.ref_context = {}       # type: Dict[unicode, Any]

    def set_warnfunc(self, func):
        # type: (Callable) -> None
        warnings.warn('env.set_warnfunc() is now deprecated. Use sphinx.util.logging instead.',
                      RemovedInSphinx20Warning)

    def set_versioning_method(self, method, compare):
        # type: (unicode, bool) -> None
        """This sets the doctree versioning method for this environment.

        Versioning methods are a builder property; only builders with the same
        versioning method can share the same doctree directory.  Therefore, we
        raise an exception if the user tries to use an environment with an
        incompatible versioning method.
        """
        if method not in versioning_conditions:
            raise ValueError('invalid versioning method: %r' % method)
        condition = versioning_conditions[method]
        if self.versioning_condition not in (None, condition):
            raise SphinxError('This environment is incompatible with the '
                              'selected builder, please choose another '
                              'doctree directory.')
        self.versioning_condition = condition
        self.versioning_compare = compare

    def warn(self, docname, msg, lineno=None, **kwargs):
        # type: (unicode, unicode, int, Any) -> None
        """Emit a warning.

        This differs from using ``app.warn()`` in that the warning may not
        be emitted instantly, but collected for emitting all warnings after
        the update of the environment.
        """
        # strange argument order is due to backwards compatibility
        self._warnfunc(msg, (docname, lineno), **kwargs)

    def warn_node(self, msg, node, **kwargs):
        # type: (unicode, nodes.Node, Any) -> None
        """Like :meth:`warn`, but with source information taken from *node*."""
        self._warnfunc(msg, '%s:%s' % get_source_line(node), **kwargs)

    def clear_doc(self, docname):
        # type: (unicode) -> None
        """Remove all traces of a source file in the inventory."""
        if docname in self.all_docs:
            self.all_docs.pop(docname, None)
            self.reread_always.discard(docname)

            for version, changes in self.versionchanges.items():
                new = [change for change in changes if change[1] != docname]
                changes[:] = new

        for domain in self.domains.values():
            domain.clear_doc(docname)

    def merge_info_from(self, docnames, other, app):
        # type: (List[unicode], BuildEnvironment, Sphinx) -> None
        """Merge global information gathered about *docnames* while reading them
        from the *other* environment.

        This possibly comes from a parallel build process.
        """
        docnames = set(docnames)  # type: ignore
        for docname in docnames:
            self.all_docs[docname] = other.all_docs[docname]
            if docname in other.reread_always:
                self.reread_always.add(docname)

        for version, changes in other.versionchanges.items():
            self.versionchanges.setdefault(version, []).extend(
                change for change in changes if change[1] in docnames)

        for domainname, domain in self.domains.items():
            domain.merge_domaindata(docnames, other.domaindata[domainname])
        app.emit('env-merge-info', self, docnames, other)

    def path2doc(self, filename):
        # type: (unicode) -> unicode
        """Return the docname for the filename if the file is document.

        *filename* should be absolute or relative to the source directory.
        """
        if filename.startswith(self.srcdir):
            filename = filename[len(self.srcdir) + 1:]
        for suffix in self.config.source_suffix:
            if fnmatch.fnmatch(filename, '*' + suffix):
                return filename[:-len(suffix)]
        else:
            # the file does not have docname
            return None

    def doc2path(self, docname, base=True, suffix=None):
        # type: (unicode, Union[bool, unicode], unicode) -> unicode
        """Return the filename for the document name.

        If *base* is True, return absolute path under self.srcdir.
        If *base* is None, return relative path to self.srcdir.
        If *base* is a path string, return absolute path under that.
        If *suffix* is not None, add it instead of config.source_suffix.
        """
        docname = docname.replace(SEP, path.sep)
        if suffix is None:
            candidate_suffix = None  # type: unicode
            for candidate_suffix in self.config.source_suffix:
                if path.isfile(path.join(self.srcdir, docname) +
                               candidate_suffix):
                    suffix = candidate_suffix
                    break
            else:
                # document does not exist
                suffix = self.config.source_suffix[0]
        if base is True:
            return path.join(self.srcdir, docname) + suffix
        elif base is None:
            return docname + suffix
        else:
            return path.join(base, docname) + suffix  # type: ignore

    def relfn2path(self, filename, docname=None):
        # type: (unicode, unicode) -> Tuple[unicode, unicode]
        """Return paths to a file referenced from a document, relative to
        documentation root and absolute.

        In the input "filename", absolute filenames are taken as relative to the
        source dir, while relative filenames are relative to the dir of the
        containing document.
        """
        if filename.startswith('/') or filename.startswith(os.sep):
            rel_fn = filename[1:]
        else:
            docdir = path.dirname(self.doc2path(docname or self.docname,
                                                base=None))
            rel_fn = path.join(docdir, filename)
        try:
            # the path.abspath() might seem redundant, but otherwise artifacts
            # such as ".." will remain in the path
            return rel_fn, path.abspath(path.join(self.srcdir, rel_fn))
        except UnicodeDecodeError:
            # the source directory is a bytestring with non-ASCII characters;
            # let's try to encode the rel_fn in the file system encoding
            enc_rel_fn = rel_fn.encode(sys.getfilesystemencoding())
            return rel_fn, path.abspath(path.join(self.srcdir, enc_rel_fn))

    def find_files(self, config, builder):
        # type: (Config, Builder) -> None
        """Find all source files in the source dir and put them in
        self.found_docs.
        """
        matchers = compile_matchers(
            config.exclude_patterns[:] +
            config.templates_path +
            builder.get_asset_paths() +
            ['**/_sources', '.#*', '**/.#*', '*.lproj/**']
        )
        self.found_docs = set()
        for docname in get_matching_docs(self.srcdir, config.source_suffix,  # type: ignore
                                         exclude_matchers=matchers):
            if os.access(self.doc2path(docname), os.R_OK):
                self.found_docs.add(docname)
            else:
                logger.warning("document not readable. Ignored.", location=docname)

        # Current implementation is applying translated messages in the reading
        # phase.Therefore, in order to apply the updated message catalog, it is
        # necessary to re-process from the reading phase. Here, if dependency
        # is set for the doc source and the mo file, it is processed again from
        # the reading phase when mo is updated. In the future, we would like to
        # move i18n process into the writing phase, and remove these lines.
        if builder.use_message_catalog:
            # add catalog mo file dependency
            for docname in self.found_docs:
                catalog_files = find_catalog_files(
                    docname,
                    self.srcdir,
                    self.config.locale_dirs,
                    self.config.language,
                    self.config.gettext_compact)
                for filename in catalog_files:
                    self.dependencies[docname].add(filename)

    def get_outdated_files(self, config_changed):
        # type: (bool) -> Tuple[Set[unicode], Set[unicode], Set[unicode]]
        """Return (added, changed, removed) sets."""
        # clear all files no longer present
        removed = set(self.all_docs) - self.found_docs

        added = set()  # type: Set[unicode]
        changed = set()  # type: Set[unicode]

        if config_changed:
            # config values affect e.g. substitutions
            added = self.found_docs
        else:
            for docname in self.found_docs:
                if docname not in self.all_docs:
                    added.add(docname)
                    continue
                # if the doctree file is not there, rebuild
                if not path.isfile(self.doc2path(docname, self.doctreedir,
                                                 '.doctree')):
                    changed.add(docname)
                    continue
                # check the "reread always" list
                if docname in self.reread_always:
                    changed.add(docname)
                    continue
                # check the mtime of the document
                mtime = self.all_docs[docname]
                newmtime = path.getmtime(self.doc2path(docname))
                if newmtime > mtime:
                    changed.add(docname)
                    continue
                # finally, check the mtime of dependencies
                for dep in self.dependencies[docname]:
                    try:
                        # this will do the right thing when dep is absolute too
                        deppath = path.join(self.srcdir, dep)
                        if not path.isfile(deppath):
                            changed.add(docname)
                            break
                        depmtime = path.getmtime(deppath)
                        if depmtime > mtime:
                            changed.add(docname)
                            break
                    except EnvironmentError:
                        # give it another chance
                        changed.add(docname)
                        break

        return added, changed, removed

    def update(self, config, srcdir, doctreedir):
        # type: (Config, unicode, unicode) -> List[unicode]
        """(Re-)read all files new or changed since last update.

        Store all environment docnames in the canonical format (ie using SEP as
        a separator in place of os.path.sep).
        """
        config_changed = False
        if self.config is None:
            msg = '[new config] '
            config_changed = True
        else:
            # check if a config value was changed that affects how
            # doctrees are read
            for confval in config.filter('env'):
                if self.config[confval.name] != confval.value:
                    msg = '[config changed] '
                    config_changed = True
                    break
            else:
                msg = ''
            # this value is not covered by the above loop because it is handled
            # specially by the config class
            if self.config.extensions != config.extensions:
                msg = '[extensions changed] '
                config_changed = True
        # the source and doctree directories may have been relocated
        self.srcdir = srcdir
        self.doctreedir = doctreedir
        self.find_files(config, self.app.builder)
        self.config = config

        # this cache also needs to be updated every time
        self._nitpick_ignore = set(self.config.nitpick_ignore)

        logger.info(bold('updating environment: '), nonl=True)

        added, changed, removed = self.get_outdated_files(config_changed)

        # allow user intervention as well
        for docs in self.app.emit('env-get-outdated', self, added, changed, removed):
            changed.update(set(docs) & self.found_docs)

        # if files were added or removed, all documents with globbed toctrees
        # must be reread
        if added or removed:
            # ... but not those that already were removed
            changed.update(self.glob_toctrees & self.found_docs)

        msg += '%s added, %s changed, %s removed' % (len(added), len(changed),
                                                     len(removed))
        logger.info(msg)

        # clear all files no longer present
        for docname in removed:
            self.app.emit('env-purge-doc', self, docname)
            self.clear_doc(docname)

        # read all new and changed files
        docnames = sorted(added | changed)
        # allow changing and reordering the list of docs to read
        self.app.emit('env-before-read-docs', self, docnames)

        # check if we should do parallel or serial read
        par_ok = False
        if parallel_available and len(docnames) > 5 and self.app.parallel > 1:
            for ext in itervalues(self.app.extensions):
                if ext.parallel_read_safe is None:
                    logger.warning(_('the %s extension does not declare if it is safe '
                                     'for parallel reading, assuming it isn\'t - please '
                                     'ask the extension author to check and make it '
                                     'explicit'), ext.name)
                    logger.warning('doing serial read')
                    break
                elif ext.parallel_read_safe is False:
                    break
            else:
                # all extensions support parallel-read
                par_ok = True

        if par_ok:
            self._read_parallel(docnames, self.app, nproc=self.app.parallel)
        else:
            self._read_serial(docnames, self.app)

        if config.master_doc not in self.all_docs:
            raise SphinxError('master file %s not found' %
                              self.doc2path(config.master_doc))

        for retval in self.app.emit('env-updated', self):
            if retval is not None:
                docnames.extend(retval)

        return sorted(docnames)

    def _read_serial(self, docnames, app):
        # type: (List[unicode], Sphinx) -> None
        for docname in status_iterator(docnames, 'reading sources... ', "purple",
                                       len(docnames), self.app.verbosity):
            # remove all inventory entries for that file
            app.emit('env-purge-doc', self, docname)
            self.clear_doc(docname)
            self.read_doc(docname, app)

    def _read_parallel(self, docnames, app, nproc):
        # type: (List[unicode], Sphinx, int) -> None
        # clear all outdated docs at once
        for docname in docnames:
            app.emit('env-purge-doc', self, docname)
            self.clear_doc(docname)

        def read_process(docs):
            # type: (List[unicode]) -> unicode
            self.app = app
            for docname in docs:
                self.read_doc(docname, app)
            # allow pickling self to send it back
            return BuildEnvironment.dumps(self)

        def merge(docs, otherenv):
            # type: (List[unicode], unicode) -> None
            env = BuildEnvironment.loads(otherenv)
            self.merge_info_from(docs, env, app)

        tasks = ParallelTasks(nproc)
        chunks = make_chunks(docnames, nproc)

        for chunk in status_iterator(chunks, 'reading sources... ', "purple",
                                     len(chunks), self.app.verbosity):
            tasks.add_task(read_process, chunk, merge)

        # make sure all threads have finished
        logger.info(bold('waiting for workers...'))
        tasks.join()

    def check_dependents(self, app, already):
        # type: (Sphinx, Set[unicode]) -> Iterator[unicode]
        to_rewrite = []  # type: List[unicode]
        for docnames in app.emit('env-get-updated', self):
            to_rewrite.extend(docnames)
        for docname in set(to_rewrite):
            if docname not in already:
                yield docname

    # --------- SINGLE FILE READING --------------------------------------------

    def warn_and_replace(self, error):
        # type: (Any) -> Tuple
        """Custom decoding error handler that warns and replaces."""
        linestart = error.object.rfind(b'\n', 0, error.start)
        lineend = error.object.find(b'\n', error.start)
        if lineend == -1:
            lineend = len(error.object)
        lineno = error.object.count(b'\n', 0, error.start) + 1
        logger.warning('undecodable source characters, replacing with "?": %r',
                       (error.object[linestart + 1:error.start] + b'>>>' +
                        error.object[error.start:error.end] + b'<<<' +
                        error.object[error.end:lineend]),
                       location=(self.docname, lineno))
        return (u'?', error.end)

    def read_doc(self, docname, app=None):
        # type: (unicode, Sphinx) -> None
        """Parse a file and add/update inventory entries for the doctree."""

        self.temp_data['docname'] = docname
        # defaults to the global default, but can be re-set in a document
        self.temp_data['default_domain'] = \
            self.domains.get(self.config.primary_domain)

        self.settings['input_encoding'] = self.config.source_encoding
        self.settings['trim_footnote_reference_space'] = \
            self.config.trim_footnote_reference_space
        self.settings['gettext_compact'] = self.config.gettext_compact

        language = self.config.language or 'en'
        self.settings['language_code'] = language
        self.settings['smart_quotes'] = True
        if self.config.html_use_smartypants is not None:
            warnings.warn("html_use_smartypants option is deprecated. Smart "
                          "quotes are on by default; if you want to disable "
                          "or customize them, use the smart_quotes option in "
                          "docutils.conf.",
                          RemovedInSphinx17Warning)
            self.settings['smart_quotes'] = self.config.html_use_smartypants
        for tag in normalize_language_tag(language):
            if tag in smartchars.quotes:
                break
        else:
            self.settings['smart_quotes'] = False

        docutilsconf = path.join(self.srcdir, 'docutils.conf')
        # read docutils.conf from source dir, not from current dir
        OptionParser.standard_config_files[1] = docutilsconf
        if path.isfile(docutilsconf):
            self.note_dependency(docutilsconf)

        with sphinx_domains(self):
            if self.config.default_role:
                role_fn, messages = roles.role(self.config.default_role, english,
                                               0, dummy_reporter)
                if role_fn:
                    roles._roles[''] = role_fn
                else:
                    logger.warning('default role %s not found', self.config.default_role,
                                   location=docname)

            codecs.register_error('sphinx', self.warn_and_replace)  # type: ignore

            # publish manually
            reader = SphinxStandaloneReader(self.app,
                                            parsers=self.app.registry.get_source_parsers())
            pub = Publisher(reader=reader,
                            writer=SphinxDummyWriter(),
                            destination_class=NullOutput)
            pub.set_components(None, 'restructuredtext', None)
            pub.process_programmatic_settings(None, self.settings, None)
            src_path = self.doc2path(docname)
            source = SphinxFileInput(app, self, source=None, source_path=src_path,
                                     encoding=self.config.source_encoding)
            pub.source = source
            pub.settings._source = src_path
            pub.set_destination(None, None)
            pub.publish()
            doctree = pub.document

        # post-processing
        for domain in itervalues(self.domains):
            domain.process_doc(self, docname, doctree)

        # allow extension-specific post-processing
        if app:
            app.emit('doctree-read', doctree)

        # store time of reading, for outdated files detection
        # (Some filesystems have coarse timestamp resolution;
        # therefore time.time() can be older than filesystem's timestamp.
        # For example, FAT32 has 2sec timestamp resolution.)
        self.all_docs[docname] = max(
            time.time(), path.getmtime(self.doc2path(docname)))

        if self.versioning_condition:
            old_doctree = None
            if self.versioning_compare:
                # get old doctree
                try:
                    with open(self.doc2path(docname,
                                            self.doctreedir, '.doctree'), 'rb') as f:
                        old_doctree = pickle.load(f)
                except EnvironmentError:
                    pass

            # add uids for versioning
            if not self.versioning_compare or old_doctree is None:
                list(add_uids(doctree, self.versioning_condition))
            else:
                list(merge_doctrees(
                    old_doctree, doctree, self.versioning_condition))

        # make it picklable
        doctree.reporter = None
        doctree.transformer = None
        doctree.settings.warning_stream = None
        doctree.settings.env = None
        doctree.settings.record_dependencies = None

        # cleanup
        self.temp_data.clear()
        self.ref_context.clear()
        roles._roles.pop('', None)  # if a document has set a local default role

        # save the parsed doctree
        doctree_filename = self.doc2path(docname, self.doctreedir,
                                         '.doctree')
        ensuredir(path.dirname(doctree_filename))
        with open(doctree_filename, 'wb') as f:
            pickle.dump(doctree, f, pickle.HIGHEST_PROTOCOL)

    # utilities to use while reading a document

    @property
    def docname(self):
        # type: () -> unicode
        """Returns the docname of the document currently being parsed."""
        return self.temp_data['docname']

    @property
    def currmodule(self):
        # type: () -> None
        """Backwards compatible alias.  Will be removed."""
        warnings.warn('env.currmodule is deprecated. '
                      'Use env.ref_context["py:module"] instead.',
                      RemovedInSphinx17Warning)
        return self.ref_context.get('py:module')

    @property
    def currclass(self):
        # type: () -> None
        """Backwards compatible alias.  Will be removed."""
        warnings.warn('env.currclass is deprecated. '
                      'Use env.ref_context["py:class"] instead.',
                      RemovedInSphinx17Warning)
        return self.ref_context.get('py:class')

    def new_serialno(self, category=''):
        # type: (unicode) -> int
        """Return a serial number, e.g. for index entry targets.

        The number is guaranteed to be unique in the current document.
        """
        key = category + 'serialno'
        cur = self.temp_data.get(key, 0)
        self.temp_data[key] = cur + 1
        return cur

    def note_dependency(self, filename):
        # type: (unicode) -> None
        """Add *filename* as a dependency of the current document.

        This means that the document will be rebuilt if this file changes.

        *filename* should be absolute or relative to the source directory.
        """
        self.dependencies[self.docname].add(filename)

    def note_included(self, filename):
        # type: (unicode) -> None
        """Add *filename* as a included from other document.

        This means the document is not orphaned.

        *filename* should be absolute or relative to the source directory.
        """
        self.included.add(self.path2doc(filename))

    def note_reread(self):
        # type: () -> None
        """Add the current document to the list of documents that will
        automatically be re-read at the next build.
        """
        self.reread_always.add(self.docname)

    def note_versionchange(self, type, version, node, lineno):
        # type: (unicode, unicode, nodes.Node, int) -> None
        self.versionchanges.setdefault(version, []).append(
            (type, self.temp_data['docname'], lineno,
             self.ref_context.get('py:module'),
             self.temp_data.get('object'), node.astext()))

    def note_toctree(self, docname, toctreenode):
        # type: (unicode, addnodes.toctree) -> None
        """Note a TOC tree directive in a document and gather information about
        file relations from it.
        """
        warnings.warn('env.note_toctree() is deprecated. '
                      'Use sphinx.environment.adapters.toctre.TocTree instead.',
                      RemovedInSphinx20Warning)
        TocTree(self).note(docname, toctreenode)

    def get_toc_for(self, docname, builder):
        # type: (unicode, Builder) -> Dict[unicode, nodes.Node]
        """Return a TOC nodetree -- for use on the same page only!"""
        warnings.warn('env.get_toc_for() is deprecated. '
                      'Use sphinx.environment.adapters.toctre.TocTree instead.',
                      RemovedInSphinx20Warning)
        return TocTree(self).get_toc_for(docname, builder)

    def get_toctree_for(self, docname, builder, collapse, **kwds):
        # type: (unicode, Builder, bool, Any) -> addnodes.toctree
        """Return the global TOC nodetree."""
        warnings.warn('env.get_toctree_for() is deprecated. '
                      'Use sphinx.environment.adapters.toctre.TocTree instead.',
                      RemovedInSphinx20Warning)
        return TocTree(self).get_toctree_for(docname, builder, collapse, **kwds)

    def get_domain(self, domainname):
        # type: (unicode) -> Domain
        """Return the domain instance with the specified name.

        Raises an ExtensionError if the domain is not registered.
        """
        try:
            return self.domains[domainname]
        except KeyError:
            raise ExtensionError('Domain %r is not registered' % domainname)

    # --------- RESOLVING REFERENCES AND TOCTREES ------------------------------

    def get_doctree(self, docname):
        # type: (unicode) -> nodes.Node
        """Read the doctree for a file from the pickle and return it."""
        doctree_filename = self.doc2path(docname, self.doctreedir, '.doctree')
        with open(doctree_filename, 'rb') as f:
            doctree = pickle.load(f)
        doctree.settings.env = self
        doctree.reporter = Reporter(self.doc2path(docname), 2, 5, stream=WarningStream())
        return doctree

    def get_and_resolve_doctree(self, docname, builder, doctree=None,
                                prune_toctrees=True, includehidden=False):
        # type: (unicode, Builder, nodes.Node, bool, bool) -> nodes.Node
        """Read the doctree from the pickle, resolve cross-references and
        toctrees and return it.
        """
        if doctree is None:
            doctree = self.get_doctree(docname)

        # resolve all pending cross-references
        self.apply_post_transforms(doctree, docname)

        # now, resolve all toctree nodes
        for toctreenode in doctree.traverse(addnodes.toctree):
            result = TocTree(self).resolve(docname, builder, toctreenode,
                                           prune=prune_toctrees,
                                           includehidden=includehidden)
            if result is None:
                toctreenode.replace_self([])
            else:
                toctreenode.replace_self(result)

        return doctree

    def resolve_toctree(self, docname, builder, toctree, prune=True, maxdepth=0,
                        titles_only=False, collapse=False, includehidden=False):
        # type: (unicode, Builder, addnodes.toctree, bool, int, bool, bool, bool) -> nodes.Node
        """Resolve a *toctree* node into individual bullet lists with titles
        as items, returning None (if no containing titles are found) or
        a new node.

        If *prune* is True, the tree is pruned to *maxdepth*, or if that is 0,
        to the value of the *maxdepth* option on the *toctree* node.
        If *titles_only* is True, only toplevel document titles will be in the
        resulting tree.
        If *collapse* is True, all branches not containing docname will
        be collapsed.
        """
        return TocTree(self).resolve(docname, builder, toctree, prune,
                                     maxdepth, titles_only, collapse,
                                     includehidden)

    def resolve_references(self, doctree, fromdocname, builder):
        # type: (nodes.Node, unicode, Builder) -> None
        self.apply_post_transforms(doctree, fromdocname)

    def apply_post_transforms(self, doctree, docname):
        # type: (nodes.Node, unicode) -> None
        """Apply all post-transforms."""
        try:
            # set env.docname during applying post-transforms
            self.temp_data['docname'] = docname

            transformer = SphinxTransformer(doctree)
            transformer.set_environment(self)
            transformer.add_transforms(self.app.post_transforms)
            transformer.apply_transforms()
        finally:
            self.temp_data.clear()

        # allow custom references to be resolved
        self.app.emit('doctree-resolved', doctree, docname)

    def create_index(self, builder, group_entries=True,
                     _fixre=re.compile(r'(.*) ([(][^()]*[)])')):
        # type: (Builder, bool, Pattern) -> List[Tuple[unicode, List[Tuple[unicode, List[unicode]]]]]  # NOQA
        warnings.warn('env.create_index() is deprecated. '
                      'Use sphinx.environment.adapters.indexentreis.IndexEntries instead.',
                      RemovedInSphinx20Warning)
        return IndexEntries(self).create_index(builder,
                                               group_entries=group_entries,
                                               _fixre=_fixre)

    def collect_relations(self):
        # type: () -> Dict[unicode, List[unicode]]
        traversed = set()

        def traverse_toctree(parent, docname):
            # type: (unicode, unicode) -> Iterator[Tuple[unicode, unicode]]
            if parent == docname:
                logger.warning('self referenced toctree found. Ignored.', location=docname)
                return

            # traverse toctree by pre-order
            yield parent, docname
            traversed.add(docname)

            for child in (self.toctree_includes.get(docname) or []):
                for subparent, subdocname in traverse_toctree(docname, child):
                    if subdocname not in traversed:
                        yield subparent, subdocname
                        traversed.add(subdocname)

        relations = {}
        docnames = traverse_toctree(None, self.config.master_doc)
        prevdoc = None
        parent, docname = next(docnames)
        for nextparent, nextdoc in docnames:
            relations[docname] = [parent, prevdoc, nextdoc]
            prevdoc = docname
            docname = nextdoc
            parent = nextparent

        relations[docname] = [parent, prevdoc, None]

        return relations

    def check_consistency(self):
        # type: () -> None
        """Do consistency checks."""
        for docname in sorted(self.all_docs):
            if docname not in self.files_to_rebuild:
                if docname == self.config.master_doc:
                    # the master file is not included anywhere ;)
                    continue
                if docname in self.included:
                    # the document is included from other documents
                    continue
                if 'orphan' in self.metadata[docname]:
                    continue
                logger.warning('document isn\'t included in any toctree',
                               location=docname)

        # call check-consistency for all extensions
        for domain in self.domains.values():
            domain.check_consistency()
        self.app.emit('env-check-consistency', self)
