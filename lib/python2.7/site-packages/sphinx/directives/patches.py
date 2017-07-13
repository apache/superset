# -*- coding: utf-8 -*-
"""
    sphinx.directives.patches
    ~~~~~~~~~~~~~~~~~~~~~~~~~

    :copyright: Copyright 2007-2017 by the Sphinx team, see AUTHORS.
    :license: BSD, see LICENSE for details.
"""

from docutils import nodes
from docutils.parsers.rst import directives
from docutils.parsers.rst.directives import images, html, tables

from sphinx import addnodes
from sphinx.util.nodes import set_source_info

if False:
    # For type annotation
    from typing import Dict, List  # NOQA
    from sphinx.application import Sphinx  # NOQA


class Figure(images.Figure):
    """The figure directive which applies `:name:` option to the figure node
    instead of the image node.
    """

    def run(self):
        # type: () -> List[nodes.Node]
        name = self.options.pop('name', None)
        result = images.Figure.run(self)
        if len(result) == 2 or isinstance(result[0], nodes.system_message):
            return result

        (figure_node,) = result
        if name:
            self.options['name'] = name
            self.add_name(figure_node)

        # fill lineno using image node
        if figure_node.line is None and len(figure_node) == 2:
            figure_node.line = figure_node[1].line

        return [figure_node]


class Meta(html.Meta):
    def run(self):
        # type: () -> List[nodes.Node]
        env = self.state.document.settings.env
        result = html.Meta.run(self)
        for node in result:
            if (isinstance(node, nodes.pending) and
               isinstance(node.details['nodes'][0], html.MetaBody.meta)):
                meta = node.details['nodes'][0]
                meta.source = env.doc2path(env.docname)
                meta.line = self.lineno
                meta.rawcontent = meta['content']

                # docutils' meta nodes aren't picklable because the class is nested
                meta.__class__ = addnodes.meta

        return result


class RSTTable(tables.RSTTable):
    """The table directive which sets source and line information to its caption.

    Only for docutils-0.13 or older version."""

    def make_title(self):
        title, message = tables.RSTTable.make_title(self)
        if title:
            set_source_info(self, title)

        return title, message


class CSVTable(tables.CSVTable):
    """The csv-table directive which sets source and line information to its caption.

    Only for docutils-0.13 or older version."""

    def make_title(self):
        title, message = tables.CSVTable.make_title(self)
        if title:
            set_source_info(self, title)

        return title, message


class ListTable(tables.ListTable):
    """The list-table directive which sets source and line information to its caption.

    Only for docutils-0.13 or older version."""

    def make_title(self):
        title, message = tables.ListTable.make_title(self)
        if title:
            set_source_info(self, title)

        return title, message


def setup(app):
    # type: (Sphinx) -> Dict
    directives.register_directive('figure', Figure)
    directives.register_directive('meta', Meta)
    directives.register_directive('table', RSTTable)
    directives.register_directive('csv-table', CSVTable)
    directives.register_directive('list-table', ListTable)

    return {
        'version': 'builtin',
        'parallel_read_safe': True,
        'parallel_write_safe': True,
    }
