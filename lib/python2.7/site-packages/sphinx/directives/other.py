# -*- coding: utf-8 -*-
"""
    sphinx.directives.other
    ~~~~~~~~~~~~~~~~~~~~~~~

    :copyright: Copyright 2007-2017 by the Sphinx team, see AUTHORS.
    :license: BSD, see LICENSE for details.
"""

from six.moves import range

from docutils import nodes
from docutils.parsers.rst import Directive, directives
from docutils.parsers.rst.directives.admonitions import BaseAdmonition
from docutils.parsers.rst.directives.misc import Class
from docutils.parsers.rst.directives.misc import Include as BaseInclude

from sphinx import addnodes
from sphinx.locale import versionlabels, _
from sphinx.util import url_re, docname_join
from sphinx.util.nodes import explicit_title_re, set_source_info, \
    process_index_entry
from sphinx.util.matching import patfilter

if False:
    # For type annotation
    from typing import Any, Dict, List, Tuple  # NOQA
    from sphinx.application import Sphinx  # NOQA


def int_or_nothing(argument):
    # type: (unicode) -> int
    if not argument:
        return 999
    return int(argument)


class TocTree(Directive):
    """
    Directive to notify Sphinx about the hierarchical structure of the docs,
    and to include a table-of-contents like tree in the current document.
    """
    has_content = True
    required_arguments = 0
    optional_arguments = 0
    final_argument_whitespace = False
    option_spec = {
        'maxdepth': int,
        'name': directives.unchanged,
        'caption': directives.unchanged_required,
        'glob': directives.flag,
        'hidden': directives.flag,
        'includehidden': directives.flag,
        'numbered': int_or_nothing,
        'titlesonly': directives.flag,
        'reversed': directives.flag,
    }

    def run(self):
        # type: () -> List[nodes.Node]
        env = self.state.document.settings.env
        suffixes = env.config.source_suffix
        glob = 'glob' in self.options

        ret = []
        # (title, ref) pairs, where ref may be a document, or an external link,
        # and title may be None if the document's title is to be used
        entries = []        # type: List[Tuple[unicode, unicode]]
        includefiles = []
        all_docnames = env.found_docs.copy()
        # don't add the currently visited file in catch-all patterns
        all_docnames.remove(env.docname)
        for entry in self.content:
            if not entry:
                continue
            if glob and ('*' in entry or '?' in entry or '[' in entry):
                patname = docname_join(env.docname, entry)
                docnames = sorted(patfilter(all_docnames, patname))
                for docname in docnames:
                    all_docnames.remove(docname)  # don't include it again
                    entries.append((None, docname))
                    includefiles.append(docname)
                if not docnames:
                    ret.append(self.state.document.reporter.warning(
                        'toctree glob pattern %r didn\'t match any documents'
                        % entry, line=self.lineno))
            else:
                # look for explicit titles ("Some Title <document>")
                m = explicit_title_re.match(entry)
                if m:
                    ref = m.group(2)
                    title = m.group(1)
                    docname = ref
                else:
                    ref = docname = entry
                    title = None
                # remove suffixes (backwards compatibility)
                for suffix in suffixes:
                    if docname.endswith(suffix):
                        docname = docname[:-len(suffix)]
                        break
                # absolutize filenames
                docname = docname_join(env.docname, docname)
                if url_re.match(ref) or ref == 'self':
                    entries.append((title, ref))
                elif docname not in env.found_docs:
                    ret.append(self.state.document.reporter.warning(
                        'toctree contains reference to nonexisting '
                        'document %r' % docname, line=self.lineno))
                    env.note_reread()
                else:
                    all_docnames.discard(docname)
                    entries.append((title, docname))
                    includefiles.append(docname)
        subnode = addnodes.toctree()
        subnode['parent'] = env.docname
        # entries contains all entries (self references, external links etc.)
        if 'reversed' in self.options:
            entries.reverse()
        subnode['entries'] = entries
        # includefiles only entries that are documents
        subnode['includefiles'] = includefiles
        subnode['maxdepth'] = self.options.get('maxdepth', -1)
        subnode['caption'] = self.options.get('caption')
        subnode['glob'] = glob
        subnode['hidden'] = 'hidden' in self.options
        subnode['includehidden'] = 'includehidden' in self.options
        subnode['numbered'] = self.options.get('numbered', 0)
        subnode['titlesonly'] = 'titlesonly' in self.options
        set_source_info(self, subnode)
        wrappernode = nodes.compound(classes=['toctree-wrapper'])
        wrappernode.append(subnode)
        self.add_name(wrappernode)
        ret.append(wrappernode)
        return ret


class Author(Directive):
    """
    Directive to give the name of the author of the current document
    or section. Shown in the output only if the show_authors option is on.
    """
    has_content = False
    required_arguments = 1
    optional_arguments = 0
    final_argument_whitespace = True
    option_spec = {}  # type: Dict

    def run(self):
        # type: () -> List[nodes.Node]
        env = self.state.document.settings.env
        if not env.config.show_authors:
            return []
        para = nodes.paragraph(translatable=False)
        emph = nodes.emphasis()
        para += emph
        if self.name == 'sectionauthor':
            text = _('Section author: ')
        elif self.name == 'moduleauthor':
            text = _('Module author: ')
        elif self.name == 'codeauthor':
            text = _('Code author: ')
        else:
            text = _('Author: ')
        emph += nodes.Text(text, text)
        inodes, messages = self.state.inline_text(self.arguments[0],
                                                  self.lineno)
        emph.extend(inodes)
        return [para] + messages


class Index(Directive):
    """
    Directive to add entries to the index.
    """
    has_content = False
    required_arguments = 1
    optional_arguments = 0
    final_argument_whitespace = True
    option_spec = {}  # type: Dict

    def run(self):
        # type: () -> List[nodes.Node]
        arguments = self.arguments[0].split('\n')
        env = self.state.document.settings.env
        targetid = 'index-%s' % env.new_serialno('index')
        targetnode = nodes.target('', '', ids=[targetid])
        self.state.document.note_explicit_target(targetnode)
        indexnode = addnodes.index()
        indexnode['entries'] = []
        indexnode['inline'] = False
        set_source_info(self, indexnode)
        for entry in arguments:
            indexnode['entries'].extend(process_index_entry(entry, targetid))
        return [indexnode, targetnode]


class VersionChange(Directive):
    """
    Directive to describe a change/addition/deprecation in a specific version.
    """
    has_content = True
    required_arguments = 1
    optional_arguments = 1
    final_argument_whitespace = True
    option_spec = {}  # type: Dict

    def run(self):
        # type: () -> List[nodes.Node]
        node = addnodes.versionmodified()
        node.document = self.state.document
        set_source_info(self, node)
        node['type'] = self.name
        node['version'] = self.arguments[0]
        text = versionlabels[self.name] % self.arguments[0]
        if len(self.arguments) == 2:
            inodes, messages = self.state.inline_text(self.arguments[1],
                                                      self.lineno + 1)
            para = nodes.paragraph(self.arguments[1], '', *inodes, translatable=False)
            set_source_info(self, para)
            node.append(para)
        else:
            messages = []
        if self.content:
            self.state.nested_parse(self.content, self.content_offset, node)
        if len(node):
            if isinstance(node[0], nodes.paragraph) and node[0].rawsource:
                content = nodes.inline(node[0].rawsource, translatable=True)
                content.source = node[0].source
                content.line = node[0].line
                content += node[0].children
                node[0].replace_self(nodes.paragraph('', '', content, translatable=False))
            node[0].insert(0, nodes.inline('', '%s: ' % text,
                                           classes=['versionmodified']))
        else:
            para = nodes.paragraph('', '',
                                   nodes.inline('', '%s.' % text,
                                                classes=['versionmodified']),
                                   translatable=False)
            node.append(para)
        env = self.state.document.settings.env
        # XXX should record node.source as well
        env.note_versionchange(node['type'], node['version'], node, node.line)
        return [node] + messages


class SeeAlso(BaseAdmonition):
    """
    An admonition mentioning things to look at as reference.
    """
    node_class = addnodes.seealso


class TabularColumns(Directive):
    """
    Directive to give an explicit tabulary column definition to LaTeX.
    """
    has_content = False
    required_arguments = 1
    optional_arguments = 0
    final_argument_whitespace = True
    option_spec = {}  # type: Dict

    def run(self):
        # type: () -> List[nodes.Node]
        node = addnodes.tabular_col_spec()
        node['spec'] = self.arguments[0]
        set_source_info(self, node)
        return [node]


class Centered(Directive):
    """
    Directive to create a centered line of bold text.
    """
    has_content = False
    required_arguments = 1
    optional_arguments = 0
    final_argument_whitespace = True
    option_spec = {}  # type: Dict

    def run(self):
        # type: () -> List[nodes.Node]
        if not self.arguments:
            return []
        subnode = addnodes.centered()
        inodes, messages = self.state.inline_text(self.arguments[0],
                                                  self.lineno)
        subnode.extend(inodes)
        return [subnode] + messages


class Acks(Directive):
    """
    Directive for a list of names.
    """
    has_content = True
    required_arguments = 0
    optional_arguments = 0
    final_argument_whitespace = False
    option_spec = {}  # type: Dict

    def run(self):
        # type: () -> List[nodes.Node]
        node = addnodes.acks()
        node.document = self.state.document
        self.state.nested_parse(self.content, self.content_offset, node)
        if len(node.children) != 1 or not isinstance(node.children[0],
                                                     nodes.bullet_list):
            return [self.state.document.reporter.warning(
                '.. acks content is not a list', line=self.lineno)]
        return [node]


class HList(Directive):
    """
    Directive for a list that gets compacted horizontally.
    """
    has_content = True
    required_arguments = 0
    optional_arguments = 0
    final_argument_whitespace = False
    option_spec = {
        'columns': int,
    }

    def run(self):
        # type: () -> List[nodes.Node]
        ncolumns = self.options.get('columns', 2)
        node = nodes.paragraph()
        node.document = self.state.document
        self.state.nested_parse(self.content, self.content_offset, node)
        if len(node.children) != 1 or not isinstance(node.children[0],
                                                     nodes.bullet_list):
            return [self.state.document.reporter.warning(
                '.. hlist content is not a list', line=self.lineno)]
        fulllist = node.children[0]
        # create a hlist node where the items are distributed
        npercol, nmore = divmod(len(fulllist), ncolumns)
        index = 0
        newnode = addnodes.hlist()
        for column in range(ncolumns):
            endindex = index + (column < nmore and (npercol + 1) or npercol)
            col = addnodes.hlistcol()
            col += nodes.bullet_list()
            col[0] += fulllist.children[index:endindex]
            index = endindex
            newnode += col
        return [newnode]


class Only(Directive):
    """
    Directive to only include text if the given tag(s) are enabled.
    """
    has_content = True
    required_arguments = 1
    optional_arguments = 0
    final_argument_whitespace = True
    option_spec = {}  # type: Dict

    def run(self):
        # type: () -> List[nodes.Node]
        node = addnodes.only()
        node.document = self.state.document
        set_source_info(self, node)
        node['expr'] = self.arguments[0]

        # Same as util.nested_parse_with_titles but try to handle nested
        # sections which should be raised higher up the doctree.
        surrounding_title_styles = self.state.memo.title_styles
        surrounding_section_level = self.state.memo.section_level
        self.state.memo.title_styles = []
        self.state.memo.section_level = 0
        try:
            self.state.nested_parse(self.content, self.content_offset,
                                    node, match_titles=1)
            title_styles = self.state.memo.title_styles
            if (not surrounding_title_styles or
                    not title_styles or
                    title_styles[0] not in surrounding_title_styles or
                    not self.state.parent):
                # No nested sections so no special handling needed.
                return [node]
            # Calculate the depths of the current and nested sections.
            current_depth = 0
            parent = self.state.parent
            while parent:
                current_depth += 1
                parent = parent.parent
            current_depth -= 2
            title_style = title_styles[0]
            nested_depth = len(surrounding_title_styles)
            if title_style in surrounding_title_styles:
                nested_depth = surrounding_title_styles.index(title_style)
            # Use these depths to determine where the nested sections should
            # be placed in the doctree.
            n_sects_to_raise = current_depth - nested_depth + 1
            parent = self.state.parent
            for i in range(n_sects_to_raise):
                if parent.parent:
                    parent = parent.parent
            parent.append(node)
            return []
        finally:
            self.state.memo.title_styles = surrounding_title_styles
            self.state.memo.section_level = surrounding_section_level


class Include(BaseInclude):
    """
    Like the standard "Include" directive, but interprets absolute paths
    "correctly", i.e. relative to source directory.
    """

    def run(self):
        # type: () -> List[nodes.Node]
        env = self.state.document.settings.env
        if self.arguments[0].startswith('<') and \
           self.arguments[0].endswith('>'):
            # docutils "standard" includes, do not do path processing
            return BaseInclude.run(self)
        rel_filename, filename = env.relfn2path(self.arguments[0])
        self.arguments[0] = filename
        env.note_included(filename)
        return BaseInclude.run(self)


def setup(app):
    # type: (Sphinx) -> Dict[unicode, Any]
    directives.register_directive('toctree', TocTree)
    directives.register_directive('sectionauthor', Author)
    directives.register_directive('moduleauthor', Author)
    directives.register_directive('codeauthor', Author)
    directives.register_directive('index', Index)
    directives.register_directive('deprecated', VersionChange)
    directives.register_directive('versionadded', VersionChange)
    directives.register_directive('versionchanged', VersionChange)
    directives.register_directive('seealso', SeeAlso)
    directives.register_directive('tabularcolumns', TabularColumns)
    directives.register_directive('centered', Centered)
    directives.register_directive('acks', Acks)
    directives.register_directive('hlist', HList)
    directives.register_directive('only', Only)
    directives.register_directive('include', Include)

    # register the standard rst class directive under a different name
    # only for backwards compatibility now
    directives.register_directive('cssclass', Class)
    # new standard name when default-domain with "class" is in effect
    directives.register_directive('rst-class', Class)

    return {
        'version': 'builtin',
        'parallel_read_safe': True,
        'parallel_write_safe': True,
    }
