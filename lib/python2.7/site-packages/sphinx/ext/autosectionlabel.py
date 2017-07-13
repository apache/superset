# -*- coding: utf-8 -*-
"""
    sphinx.ext.autosectionlabel
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~

    Allow reference sections by :ref: role using its title.

    :copyright: Copyright 2007-2017 by the Sphinx team, see AUTHORS.
    :license: BSD, see LICENSE for details.
"""

from docutils import nodes
from sphinx.util import logging
from sphinx.util.nodes import clean_astext

logger = logging.getLogger(__name__)


def register_sections_as_label(app, document):
    labels = app.env.domaindata['std']['labels']
    anonlabels = app.env.domaindata['std']['anonlabels']
    for node in document.traverse(nodes.section):
        labelid = node['ids'][0]
        docname = app.env.docname
        if app.config.autosectionlabel_prefix_document:
            name = nodes.fully_normalize_name(docname + ':' + node[0].astext())
        else:
            name = nodes.fully_normalize_name(node[0].astext())
        sectname = clean_astext(node[0])

        if name in labels:
            logger.warning('duplicate label %s, ' % name + 'other instance '
                           'in ' + app.env.doc2path(labels[name][0]),
                           location=node)

        anonlabels[name] = docname, labelid
        labels[name] = docname, labelid, sectname


def setup(app):
    app.add_config_value('autosectionlabel_prefix_document', False, 'env')
    app.connect('doctree-read', register_sections_as_label)
