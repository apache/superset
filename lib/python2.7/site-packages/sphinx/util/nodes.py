# -*- coding: utf-8 -*-
"""
    sphinx.util.nodes
    ~~~~~~~~~~~~~~~~~

    Docutils node-related utility functions for Sphinx.

    :copyright: Copyright 2007-2017 by the Sphinx team, see AUTHORS.
    :license: BSD, see LICENSE for details.
"""
from __future__ import absolute_import

import re
import warnings

from six import text_type

from docutils import nodes

from sphinx import addnodes
from sphinx.deprecation import RemovedInSphinx17Warning
from sphinx.locale import pairindextypes
from sphinx.util import logging

if False:
    # For type annotation
    from typing import Any, Callable, Iterable, List, Set, Tuple, Union  # NOQA
    from sphinx.builders import Builder  # NOQA
    from sphinx.utils.tags import Tags  # NOQA

logger = logging.getLogger(__name__)


# \x00 means the "<" was backslash-escaped
explicit_title_re = re.compile(r'^(.+?)\s*(?<!\x00)<(.*?)>$', re.DOTALL)
caption_ref_re = explicit_title_re  # b/w compat alias


def apply_source_workaround(node):
    # type: (nodes.Node) -> None
    # workaround: nodes.term have wrong rawsource if classifier is specified.
    # The behavior of docutils-0.11, 0.12 is:
    # * when ``term text : classifier1 : classifier2`` is specified,
    # * rawsource of term node will have: ``term text : classifier1 : classifier2``
    # * rawsource of classifier node will be None
    if isinstance(node, nodes.classifier) and not node.rawsource:
        definition_list_item = node.parent
        node.source = definition_list_item.source
        node.line = definition_list_item.line - 1
        node.rawsource = node.astext()  # set 'classifier1' (or 'classifier2')
    if isinstance(node, nodes.image) and node.source is None:
        node.source, node.line = node.parent.source, node.parent.line
    if isinstance(node, nodes.term):
        # strip classifier from rawsource of term
        for classifier in reversed(node.parent.traverse(nodes.classifier)):
            node.rawsource = re.sub(r'\s*:\s*%s' % re.escape(classifier.astext()),
                                    '', node.rawsource)

    # workaround: recommonmark-0.2.0 doesn't set rawsource attribute
    if not node.rawsource:
        node.rawsource = node.astext()

    if node.source and node.rawsource:
        return

    # workaround: some docutils nodes doesn't have source, line.
    if (isinstance(node, (
            nodes.rubric,  # #1305 rubric directive
            nodes.line,  # #1477 line node
            nodes.image,  # #3093 image directive in substitution
            nodes.field_name,  # #3335 field list syntax
    ))):
        node.source = find_source_node(node)
        node.line = 0  # need fix docutils to get `node.line`
        return


IGNORED_NODES = (
    nodes.Invisible,
    nodes.Inline,
    nodes.literal_block,
    nodes.doctest_block,
    addnodes.versionmodified,
    # XXX there are probably more
)


def is_pending_meta(node):
    # type: (nodes.Node) -> bool
    if (isinstance(node, nodes.pending) and
       isinstance(node.details.get('nodes', [None])[0], addnodes.meta)):
        return True
    else:
        return False


def is_translatable(node):
    # type: (nodes.Node) -> bool
    if isinstance(node, addnodes.translatable):
        return True

    if isinstance(node, nodes.TextElement):
        if not node.source:
            return False  # built-in message
        if isinstance(node, IGNORED_NODES) and 'translatable' not in node:
            return False
        if not node.get('translatable', True):
            # not(node['translatable'] == True or node['translatable'] is None)
            return False
        # <field_name>orphan</field_name>
        # XXX ignore all metadata (== docinfo)
        if isinstance(node, nodes.field_name) and node.children[0] == 'orphan':
            return False
        return True

    if isinstance(node, nodes.image) and node.get('translatable'):
        return True

    if isinstance(node, addnodes.meta):
        return True
    if is_pending_meta(node):
        return True

    return False


LITERAL_TYPE_NODES = (
    nodes.literal_block,
    nodes.doctest_block,
    nodes.raw,
)
IMAGE_TYPE_NODES = (
    nodes.image,
)
META_TYPE_NODES = (
    addnodes.meta,
)


def extract_messages(doctree):
    # type: (nodes.Node) -> Iterable[Tuple[nodes.Node, unicode]]
    """Extract translatable messages from a document tree."""
    for node in doctree.traverse(is_translatable):
        if isinstance(node, addnodes.translatable):
            for msg in node.extract_original_messages():
                yield node, msg
            continue
        if isinstance(node, LITERAL_TYPE_NODES):
            msg = node.rawsource
            if not msg:
                msg = node.astext()
        elif isinstance(node, IMAGE_TYPE_NODES):
            msg = '.. image:: %s' % node['uri']
            if node.get('alt'):
                msg += '\n   :alt: %s' % node['alt']
        elif isinstance(node, META_TYPE_NODES):
            msg = node.rawcontent
        elif is_pending_meta(node):
            msg = node.details['nodes'][0].rawcontent
        else:
            msg = node.rawsource.replace('\n', ' ').strip()

        # XXX nodes rendering empty are likely a bug in sphinx.addnodes
        if msg:
            yield node, msg


def find_source_node(node):
    # type: (nodes.Node) -> unicode
    for pnode in traverse_parent(node):
        if pnode.source:
            return pnode.source
    return None


def traverse_parent(node, cls=None):
    # type: (nodes.Node, Any) -> Iterable[nodes.Node]
    while node:
        if cls is None or isinstance(node, cls):
            yield node
        node = node.parent


def traverse_translatable_index(doctree):
    # type: (nodes.Node) -> Iterable[Tuple[nodes.Node, List[unicode]]]
    """Traverse translatable index node from a document tree."""
    def is_block_index(node):
        # type: (nodes.Node) -> bool
        return isinstance(node, addnodes.index) and  \
            node.get('inline') is False
    for node in doctree.traverse(is_block_index):
        if 'raw_entries' in node:
            entries = node['raw_entries']
        else:
            entries = node['entries']
        yield node, entries


def nested_parse_with_titles(state, content, node):
    # type: (Any, List[unicode], nodes.Node) -> unicode
    """Version of state.nested_parse() that allows titles and does not require
    titles to have the same decoration as the calling document.

    This is useful when the parsed content comes from a completely different
    context, such as docstrings.
    """
    # hack around title style bookkeeping
    surrounding_title_styles = state.memo.title_styles
    surrounding_section_level = state.memo.section_level
    state.memo.title_styles = []
    state.memo.section_level = 0
    try:
        return state.nested_parse(content, 0, node, match_titles=1)
    finally:
        state.memo.title_styles = surrounding_title_styles
        state.memo.section_level = surrounding_section_level


def clean_astext(node):
    # type: (nodes.Node) -> unicode
    """Like node.astext(), but ignore images."""
    node = node.deepcopy()
    for img in node.traverse(nodes.image):
        img['alt'] = ''
    for raw in node.traverse(nodes.raw):
        raw.parent.remove(raw)
    return node.astext()


def split_explicit_title(text):
    # type: (unicode) -> Tuple[bool, unicode, unicode]
    """Split role content into title and target, if given."""
    match = explicit_title_re.match(text)  # type: ignore
    if match:
        return True, match.group(1), match.group(2)
    return False, text, text


indextypes = [
    'single', 'pair', 'double', 'triple', 'see', 'seealso',
]


def process_index_entry(entry, targetid):
    # type: (unicode, unicode) -> List[Tuple[unicode, unicode, unicode, unicode, unicode]]
    indexentries = []  # type: List[Tuple[unicode, unicode, unicode, unicode, unicode]]
    entry = entry.strip()
    oentry = entry
    main = ''
    if entry.startswith('!'):
        main = 'main'
        entry = entry[1:].lstrip()
    for type in pairindextypes:
        if entry.startswith(type + ':'):
            value = entry[len(type) + 1:].strip()
            value = pairindextypes[type] + '; ' + value
            indexentries.append(('pair', value, targetid, main, None))
            break
    else:
        for type in indextypes:
            if entry.startswith(type + ':'):
                value = entry[len(type) + 1:].strip()
                if type == 'double':
                    type = 'pair'
                indexentries.append((type, value, targetid, main, None))
                break
        # shorthand notation for single entries
        else:
            for value in oentry.split(','):
                value = value.strip()
                main = ''
                if value.startswith('!'):
                    main = 'main'
                    value = value[1:].lstrip()
                if not value:
                    continue
                indexentries.append(('single', value, targetid, main, None))
    return indexentries


def inline_all_toctrees(builder, docnameset, docname, tree, colorfunc, traversed):
    # type: (Builder, Set[unicode], unicode, nodes.Node, Callable, nodes.Node) -> nodes.Node
    """Inline all toctrees in the *tree*.

    Record all docnames in *docnameset*, and output docnames with *colorfunc*.
    """
    tree = tree.deepcopy()
    for toctreenode in tree.traverse(addnodes.toctree):
        newnodes = []
        includefiles = map(text_type, toctreenode['includefiles'])
        for includefile in includefiles:
            if includefile not in traversed:
                try:
                    traversed.append(includefile)
                    logger.info(colorfunc(includefile) + " ", nonl=1)
                    subtree = inline_all_toctrees(builder, docnameset, includefile,
                                                  builder.env.get_doctree(includefile),
                                                  colorfunc, traversed)
                    docnameset.add(includefile)
                except Exception:
                    logger.warning('toctree contains ref to nonexisting file %r',
                                   includefile, location=docname)
                else:
                    sof = addnodes.start_of_file(docname=includefile)
                    sof.children = subtree.children
                    for sectionnode in sof.traverse(nodes.section):
                        if 'docname' not in sectionnode:
                            sectionnode['docname'] = includefile
                    newnodes.append(sof)
        toctreenode.parent.replace(toctreenode, newnodes)
    return tree


def make_refnode(builder, fromdocname, todocname, targetid, child, title=None):
    # type: (Builder, unicode, unicode, unicode, nodes.Node, unicode) -> nodes.reference
    """Shortcut to create a reference node."""
    node = nodes.reference('', '', internal=True)
    if fromdocname == todocname and targetid:
        node['refid'] = targetid
    else:
        if targetid:
            node['refuri'] = (builder.get_relative_uri(fromdocname, todocname) +
                              '#' + targetid)
        else:
            node['refuri'] = builder.get_relative_uri(fromdocname, todocname)
    if title:
        node['reftitle'] = title
    node.append(child)
    return node


def set_source_info(directive, node):
    # type: (Any, nodes.Node) -> None
    node.source, node.line = \
        directive.state_machine.get_source_and_line(directive.lineno)


def set_role_source_info(inliner, lineno, node):
    # type: (Any, unicode, nodes.Node) -> None
    node.source, node.line = inliner.reporter.get_source_and_line(lineno)


def process_only_nodes(doctree, tags):
    # type: (nodes.Node, Tags) -> None
    # A comment on the comment() nodes being inserted: replacing by [] would
    # result in a "Losing ids" exception if there is a target node before
    # the only node, so we make sure docutils can transfer the id to
    # something, even if it's just a comment and will lose the id anyway...
    warnings.warn('process_only_nodes() is deprecated. '
                  'Use sphinx.environment.apply_post_transforms() instead.',
                  RemovedInSphinx17Warning)

    for node in doctree.traverse(addnodes.only):
        try:
            ret = tags.eval_condition(node['expr'])
        except Exception as err:
            logger.warning('exception while evaluating only directive expression: %s', err,
                           location=node)
            node.replace_self(node.children or nodes.comment())
        else:
            if ret:
                node.replace_self(node.children or nodes.comment())
            else:
                node.replace_self(nodes.comment())


# monkey-patch Element.copy to copy the rawsource and line

def _new_copy(self):
    # type: (nodes.Node) -> nodes.Node
    newnode = self.__class__(self.rawsource, **self.attributes)
    if isinstance(self, nodes.Element):
        newnode.source = self.source
        newnode.line = self.line
    return newnode


nodes.Element.copy = _new_copy
