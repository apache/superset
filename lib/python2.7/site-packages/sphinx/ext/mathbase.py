# -*- coding: utf-8 -*-
"""
    sphinx.ext.mathbase
    ~~~~~~~~~~~~~~~~~~~

    Set up math support in source files and LaTeX/text output.

    :copyright: Copyright 2007-2017 by the Sphinx team, see AUTHORS.
    :license: BSD, see LICENSE for details.
"""

from docutils import nodes, utils
from docutils.parsers.rst import Directive, directives

from sphinx.roles import XRefRole
from sphinx.locale import _
from sphinx.domains import Domain
from sphinx.util.nodes import make_refnode, set_source_info

if False:
    # For type annotation
    from typing import Any, Callable, Dict, Iterable, List, Tuple  # NOQA
    from docutils.parsers.rst.states import Inliner  # NOQA
    from sphinx.application import Sphinx  # NOQA
    from sphinx.builders import Builder  # NOQA
    from sphinx.environment import BuildEnvironment  # NOQA


class math(nodes.Inline, nodes.TextElement):
    pass


class displaymath(nodes.Part, nodes.Element):
    pass


class eqref(nodes.Inline, nodes.TextElement):
    pass


class EqXRefRole(XRefRole):
    def result_nodes(self, document, env, node, is_ref):
        # type: (nodes.Node, BuildEnvironment, nodes.Node, bool) -> Tuple[List[nodes.Node], List[nodes.Node]]  # NOQA
        node['refdomain'] = 'math'
        return [node], []


class MathDomain(Domain):
    """Mathematics domain."""
    name = 'math'
    label = 'mathematics'

    initial_data = {
        'objects': {},  # labelid -> (docname, eqno)
    }  # type: Dict[unicode, Dict[unicode, Tuple[unicode, int]]]
    dangling_warnings = {
        'eq': 'equation not found: %(target)s',
    }

    def clear_doc(self, docname):
        # type: (unicode) -> None
        for labelid, (doc, eqno) in list(self.data['objects'].items()):
            if doc == docname:
                del self.data['objects'][labelid]

    def merge_domaindata(self, docnames, otherdata):
        # type: (Iterable[unicode], Dict) -> None
        for labelid, (doc, eqno) in otherdata['objects'].items():
            if doc in docnames:
                self.data['objects'][labelid] = doc

    def resolve_xref(self, env, fromdocname, builder, typ, target, node, contnode):
        # type: (BuildEnvironment, unicode, Builder, unicode, unicode, nodes.Node, nodes.Node) -> nodes.Node  # NOQA
        assert typ == 'eq'
        docname, number = self.data['objects'].get(target, (None, None))
        if docname:
            if builder.name == 'latex':
                newnode = eqref('', **node.attributes)
                newnode['docname'] = docname
                newnode['target'] = target
                return newnode
            else:
                title = nodes.Text("(%d)" % number)
                return make_refnode(builder, fromdocname, docname,
                                    "equation-" + target, title)
        else:
            return None

    def resolve_any_xref(self, env, fromdocname, builder, target, node, contnode):
        # type: (BuildEnvironment, unicode, Builder, unicode, nodes.Node, nodes.Node) -> List[nodes.Node]  # NOQA
        refnode = self.resolve_xref(env, fromdocname, builder, 'eq', target, node, contnode)
        if refnode is None:
            return []
        else:
            return [refnode]

    def get_objects(self):
        # type: () -> List
        return []

    def add_equation(self, env, docname, labelid):
        # type: (BuildEnvironment, unicode, unicode) -> int
        equations = self.data['objects']
        if labelid in equations:
            path = env.doc2path(equations[labelid][0])
            msg = _('duplicate label of equation %s, other instance in %s') % (labelid, path)
            raise UserWarning(msg)
        else:
            eqno = self.get_next_equation_number(docname)
            equations[labelid] = (docname, eqno)
            return eqno

    def get_next_equation_number(self, docname):
        # type: (unicode) -> int
        targets = [eq for eq in self.data['objects'].values() if eq[0] == docname]
        return len(targets) + 1


def wrap_displaymath(math, label, numbering):
    # type: (unicode, unicode, bool) -> unicode
    def is_equation(part):
        # type: (unicode) -> unicode
        return part.strip()

    if label is None:
        labeldef = ''
    else:
        labeldef = r'\label{%s}' % label
        numbering = True

    parts = list(filter(is_equation, math.split('\n\n')))
    equations = []
    if len(parts) == 0:
        return ''
    elif len(parts) == 1:
        if numbering:
            begin = r'\begin{equation}' + labeldef
            end = r'\end{equation}'
        else:
            begin = r'\begin{equation*}' + labeldef
            end = r'\end{equation*}'
        equations.append('\\begin{split}%s\\end{split}\n' % parts[0])
    else:
        if numbering:
            begin = r'\begin{align}%s\!\begin{aligned}' % labeldef
            end = r'\end{aligned}\end{align}'
        else:
            begin = r'\begin{align*}%s\!\begin{aligned}' % labeldef
            end = r'\end{aligned}\end{align*}'
        for part in parts:
            equations.append('%s\\\\\n' % part.strip())

    return '%s\n%s%s' % (begin, ''.join(equations), end)


def math_role(role, rawtext, text, lineno, inliner, options={}, content=[]):
    # type: (unicode, unicode, unicode, int, Inliner, Dict, List[unicode]) -> Tuple[List[nodes.Node], List[nodes.Node]]  # NOQA
    latex = utils.unescape(text, restore_backslashes=True)
    return [math(latex=latex)], []


def is_in_section_title(node):
    # type: (nodes.Node) -> bool
    """Determine whether the node is in a section title"""
    from sphinx.util.nodes import traverse_parent

    for ancestor in traverse_parent(node):
        if isinstance(ancestor, nodes.title) and \
           isinstance(ancestor.parent, nodes.section):
            return True
    return False


class MathDirective(Directive):

    has_content = True
    required_arguments = 0
    optional_arguments = 1
    final_argument_whitespace = True
    option_spec = {
        'label': directives.unchanged,
        'name': directives.unchanged,
        'nowrap': directives.flag,
    }

    def run(self):
        # type: () -> List[nodes.Node]
        latex = '\n'.join(self.content)
        if self.arguments and self.arguments[0]:
            latex = self.arguments[0] + '\n\n' + latex
        node = displaymath()
        node['latex'] = latex
        node['number'] = None
        node['label'] = None
        if 'name' in self.options:
            node['label'] = self.options['name']
        if 'label' in self.options:
            node['label'] = self.options['label']
        node['nowrap'] = 'nowrap' in self.options
        node['docname'] = self.state.document.settings.env.docname
        ret = [node]
        set_source_info(self, node)
        if hasattr(self, 'src'):
            node.source = self.src
        self.add_target(ret)
        return ret

    def add_target(self, ret):
        # type: (List[nodes.Node]) -> None
        node = ret[0]
        env = self.state.document.settings.env

        # assign label automatically if math_number_all enabled
        if node['label'] == '' or (env.config.math_number_all and not node['label']):
            seq = env.new_serialno('sphinx.ext.math#equations')
            node['label'] = "%s:%d" % (env.docname, seq)

        # no targets and numbers are needed
        if not node['label']:
            return

        # register label to domain
        domain = env.get_domain('math')
        try:
            eqno = domain.add_equation(env, env.docname, node['label'])
            node['number'] = eqno

            # add target node
            target = nodes.target('', '', ids=['equation-' + node['label']])
            self.state.document.note_explicit_target(target)
            ret.insert(0, target)
        except UserWarning as exc:
            self.state_machine.reporter.warning(exc.args[0], line=self.lineno)


def latex_visit_math(self, node):
    # type: (nodes.NodeVisitor, math) -> None
    if is_in_section_title(node):
        protect = r'\protect'
    else:
        protect = ''
    equation = protect + r'\(' + node['latex'] + protect + r'\)'
    self.body.append(equation)
    raise nodes.SkipNode


def latex_visit_displaymath(self, node):
    # type: (nodes.NodeVisitor, displaymath) -> None
    if not node['label']:
        label = None
    else:
        label = "equation:%s:%s" % (node['docname'], node['label'])

    if node['nowrap']:
        if label:
            self.body.append(r'\label{%s}' % label)
        self.body.append(node['latex'])
    else:
        self.body.append(wrap_displaymath(node['latex'], label,
                                          self.builder.config.math_number_all))
    raise nodes.SkipNode


def latex_visit_eqref(self, node):
    # type: (nodes.NodeVisitor, eqref) -> None
    label = "equation:%s:%s" % (node['docname'], node['target'])
    self.body.append('\\eqref{%s}' % label)
    raise nodes.SkipNode


def text_visit_math(self, node):
    # type: (nodes.NodeVisitor, math) -> None
    self.add_text(node['latex'])
    raise nodes.SkipNode


def text_visit_displaymath(self, node):
    # type: (nodes.NodeVisitor, displaymath) -> None
    self.new_state()
    self.add_text(node['latex'])
    self.end_state()
    raise nodes.SkipNode


def man_visit_math(self, node):
    # type: (nodes.NodeVisitor, math) -> None
    self.body.append(node['latex'])
    raise nodes.SkipNode


def man_visit_displaymath(self, node):
    # type: (nodes.NodeVisitor, displaymath) -> None
    self.visit_centered(node)


def man_depart_displaymath(self, node):
    # type: (nodes.NodeVisitor, displaymath) -> None
    self.depart_centered(node)


def texinfo_visit_math(self, node):
    # type: (nodes.NodeVisitor, math) -> None
    self.body.append('@math{' + self.escape_arg(node['latex']) + '}')
    raise nodes.SkipNode


def texinfo_visit_displaymath(self, node):
    # type: (nodes.NodeVisitor, displaymath) -> None
    if node.get('label'):
        self.add_anchor(node['label'], node)
    self.body.append('\n\n@example\n%s\n@end example\n\n' %
                     self.escape_arg(node['latex']))


def texinfo_depart_displaymath(self, node):
    # type: (nodes.NodeVisitor, displaymath) -> None
    pass


def setup_math(app, htmlinlinevisitors, htmldisplayvisitors):
    # type: (Sphinx, Tuple[Callable, Any], Tuple[Callable, Any]) -> None
    app.add_config_value('math_number_all', False, 'env')
    app.add_domain(MathDomain)
    app.add_node(math, override=True,
                 latex=(latex_visit_math, None),
                 text=(text_visit_math, None),
                 man=(man_visit_math, None),
                 texinfo=(texinfo_visit_math, None),
                 html=htmlinlinevisitors)
    app.add_node(displaymath,
                 latex=(latex_visit_displaymath, None),
                 text=(text_visit_displaymath, None),
                 man=(man_visit_displaymath, man_depart_displaymath),
                 texinfo=(texinfo_visit_displaymath, texinfo_depart_displaymath),
                 html=htmldisplayvisitors)
    app.add_node(eqref, latex=(latex_visit_eqref, None))
    app.add_role('math', math_role)
    app.add_role('eq', EqXRefRole(warn_dangling=True))
    app.add_directive('math', MathDirective)
