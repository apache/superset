# Copyright (c) 2009-2011, 2013-2014 LOGILAB S.A. (Paris, FRANCE) <contact@logilab.fr>
# Copyright (c) 2013-2016 Claudiu Popa <pcmanticore@gmail.com>
# Copyright (c) 2013-2014 Google, Inc.
# Copyright (c) 2015-2016 Cara Vinson <ceridwenv@gmail.com>

# Licensed under the LGPL: https://www.gnu.org/licenses/old-licenses/lgpl-2.1.en.html
# For details: https://github.com/PyCQA/astroid/blob/master/COPYING.LESSER

"""This module renders Astroid nodes as string:

* :func:`to_code` function return equivalent (hopefully valid) python string

* :func:`dump` function return an internal representation of nodes found
  in the tree, useful for debugging or understanding the tree structure
"""
import sys

import six


# pylint: disable=unused-argument


class AsStringVisitor(object):
    """Visitor to render an Astroid node as a valid python code string"""

    def __init__(self, indent):
        self.indent = indent

    def __call__(self, node):
        """Makes this visitor behave as a simple function"""
        return node.accept(self)

    def _stmt_list(self, stmts):
        """return a list of nodes to string"""
        stmts = '\n'.join([nstr for nstr in [n.accept(self) for n in stmts] if nstr])
        return self.indent + stmts.replace('\n', '\n'+self.indent)


    ## visit_<node> methods ###########################################

    def visit_arguments(self, node):
        """return an astroid.Function node as string"""
        return node.format_args()

    def visit_assignattr(self, node):
        """return an astroid.AssAttr node as string"""
        return self.visit_attribute(node)

    def visit_assert(self, node):
        """return an astroid.Assert node as string"""
        if node.fail:
            return 'assert %s, %s' % (node.test.accept(self),
                                      node.fail.accept(self))
        return 'assert %s' % node.test.accept(self)

    def visit_assignname(self, node):
        """return an astroid.AssName node as string"""
        return node.name

    def visit_assign(self, node):
        """return an astroid.Assign node as string"""
        lhs = ' = '.join([n.accept(self) for n in node.targets])
        return '%s = %s' % (lhs, node.value.accept(self))

    def visit_augassign(self, node):
        """return an astroid.AugAssign node as string"""
        return '%s %s %s' % (node.target.accept(self), node.op, node.value.accept(self))

    def visit_annassign(self, node):
        """Return an astroid.AugAssign node as string"""

        target = node.target.accept(self)
        annotation = node.annotation.accept(self)
        if node.value is None:
            return '%s: %s' % (target, annotation)
        return '%s: %s = %s' % (target, annotation, node.value.accept(self))

    def visit_repr(self, node):
        """return an astroid.Repr node as string"""
        return '`%s`' % node.value.accept(self)

    def visit_binop(self, node):
        """return an astroid.BinOp node as string"""
        return '(%s) %s (%s)' % (node.left.accept(self), node.op, node.right.accept(self))

    def visit_boolop(self, node):
        """return an astroid.BoolOp node as string"""
        return (' %s ' % node.op).join(['(%s)' % n.accept(self)
                                        for n in node.values])

    def visit_break(self, node):
        """return an astroid.Break node as string"""
        return 'break'

    def visit_call(self, node):
        """return an astroid.Call node as string"""
        expr_str = node.func.accept(self)
        args = [arg.accept(self) for arg in node.args]
        if node.keywords:
            keywords = [kwarg.accept(self) for kwarg in node.keywords]
        else:
            keywords = []

        args.extend(keywords)
        return '%s(%s)' % (expr_str, ', '.join(args))

    def visit_classdef(self, node):
        """return an astroid.ClassDef node as string"""
        decorate = node.decorators.accept(self) if node.decorators else ''
        bases = ', '.join([n.accept(self) for n in node.bases])
        if sys.version_info[0] == 2:
            bases = '(%s)' % bases if bases else ''
        else:
            metaclass = node.metaclass()
            if metaclass and not node.has_metaclass_hack():
                if bases:
                    bases = '(%s, metaclass=%s)' % (bases, metaclass.name)
                else:
                    bases = '(metaclass=%s)' % metaclass.name
            else:
                bases = '(%s)' % bases if bases else ''
        docs = '\n%s"""%s"""' % (self.indent, node.doc) if node.doc else ''
        return '\n\n%sclass %s%s:%s\n%s\n' % (decorate, node.name, bases, docs,
                                              self._stmt_list(node.body))

    def visit_compare(self, node):
        """return an astroid.Compare node as string"""
        rhs_str = ' '.join(['%s %s' % (op, expr.accept(self))
                            for op, expr in node.ops])
        return '%s %s' % (node.left.accept(self), rhs_str)

    def visit_comprehension(self, node):
        """return an astroid.Comprehension node as string"""
        ifs = ''.join([' if %s' % n.accept(self) for n in node.ifs])
        return 'for %s in %s%s' % (node.target.accept(self),
                                   node.iter.accept(self), ifs)

    def visit_const(self, node):
        """return an astroid.Const node as string"""
        return repr(node.value)

    def visit_continue(self, node):
        """return an astroid.Continue node as string"""
        return 'continue'

    def visit_delete(self, node): # XXX check if correct
        """return an astroid.Delete node as string"""
        return 'del %s' % ', '.join([child.accept(self)
                                     for child in node.targets])

    def visit_delattr(self, node):
        """return an astroid.DelAttr node as string"""
        return self.visit_attribute(node)

    def visit_delname(self, node):
        """return an astroid.DelName node as string"""
        return node.name

    def visit_decorators(self, node):
        """return an astroid.Decorators node as string"""
        return '@%s\n' % '\n@'.join([item.accept(self) for item in node.nodes])

    def visit_dict(self, node):
        """return an astroid.Dict node as string"""
        return '{%s}' % ', '.join(self._visit_dict(node))

    def _visit_dict(self, node):
        for key, value in node.items:
            key = key.accept(self)
            value = value.accept(self)
            if key == '**':
                # It can only be a DictUnpack node.
                yield key + value
            else:
                yield '%s: %s' % (key, value)

    def visit_dictunpack(self, node):
        return '**'

    def visit_dictcomp(self, node):
        """return an astroid.DictComp node as string"""
        return '{%s: %s %s}' % (node.key.accept(self), node.value.accept(self),
                                ' '.join([n.accept(self) for n in node.generators]))

    def visit_expr(self, node):
        """return an astroid.Discard node as string"""
        return node.value.accept(self)

    def visit_emptynode(self, node):
        """dummy method for visiting an Empty node"""
        return ''

    def visit_excepthandler(self, node):
        if node.type:
            if node.name:
                excs = 'except %s, %s' % (node.type.accept(self),
                                          node.name.accept(self))
            else:
                excs = 'except %s' % node.type.accept(self)
        else:
            excs = 'except'
        return '%s:\n%s' % (excs, self._stmt_list(node.body))

    def visit_ellipsis(self, node):
        """return an astroid.Ellipsis node as string"""
        return '...'

    def visit_empty(self, node):
        """return an Empty node as string"""
        return ''

    def visit_exec(self, node):
        """return an astroid.Exec node as string"""
        if node.locals:
            return 'exec %s in %s, %s' % (node.expr.accept(self),
                                          node.locals.accept(self),
                                          node.globals.accept(self))
        if node.globals:
            return 'exec %s in %s' % (node.expr.accept(self),
                                      node.globals.accept(self))
        return 'exec %s' % node.expr.accept(self)

    def visit_extslice(self, node):
        """return an astroid.ExtSlice node as string"""
        return ','.join([dim.accept(self) for dim in node.dims])

    def visit_for(self, node):
        """return an astroid.For node as string"""
        fors = 'for %s in %s:\n%s' % (node.target.accept(self),
                                      node.iter.accept(self),
                                      self._stmt_list(node.body))
        if node.orelse:
            fors = '%s\nelse:\n%s' % (fors, self._stmt_list(node.orelse))
        return fors

    def visit_importfrom(self, node):
        """return an astroid.ImportFrom node as string"""
        return 'from %s import %s' % ('.' * (node.level or 0) + node.modname,
                                      _import_string(node.names))

    def visit_functiondef(self, node):
        """return an astroid.Function node as string"""
        decorate = node.decorators.accept(self) if node.decorators else ''
        docs = '\n%s"""%s"""' % (self.indent, node.doc) if node.doc else ''
        return_annotation = ''
        if six.PY3 and node.returns:
            return_annotation = '->' + node.returns.as_string()
            trailer = return_annotation + ":"
        else:
            trailer = ":"
        def_format = "\n%sdef %s(%s)%s%s\n%s"
        return def_format % (decorate, node.name,
                             node.args.accept(self),
                             trailer, docs,
                             self._stmt_list(node.body))

    def visit_generatorexp(self, node):
        """return an astroid.GeneratorExp node as string"""
        return '(%s %s)' % (node.elt.accept(self),
                            ' '.join([n.accept(self) for n in node.generators]))

    def visit_attribute(self, node):
        """return an astroid.Getattr node as string"""
        return '%s.%s' % (node.expr.accept(self), node.attrname)

    def visit_global(self, node):
        """return an astroid.Global node as string"""
        return 'global %s' % ', '.join(node.names)

    def visit_if(self, node):
        """return an astroid.If node as string"""
        ifs = ['if %s:\n%s' % (node.test.accept(self), self._stmt_list(node.body))]
        if node.orelse:# XXX use elif ???
            ifs.append('else:\n%s' % self._stmt_list(node.orelse))
        return '\n'.join(ifs)

    def visit_ifexp(self, node):
        """return an astroid.IfExp node as string"""
        return '%s if %s else %s' % (node.body.accept(self),
                                     node.test.accept(self),
                                     node.orelse.accept(self))

    def visit_import(self, node):
        """return an astroid.Import node as string"""
        return 'import %s' % _import_string(node.names)

    def visit_keyword(self, node):
        """return an astroid.Keyword node as string"""
        if node.arg is None:
            return '**%s' % node.value.accept(self)
        return '%s=%s' % (node.arg, node.value.accept(self))

    def visit_lambda(self, node):
        """return an astroid.Lambda node as string"""
        return 'lambda %s: %s' % (node.args.accept(self),
                                  node.body.accept(self))

    def visit_list(self, node):
        """return an astroid.List node as string"""
        return '[%s]' % ', '.join([child.accept(self) for child in node.elts])

    def visit_listcomp(self, node):
        """return an astroid.ListComp node as string"""
        return '[%s %s]' % (node.elt.accept(self),
                            ' '.join([n.accept(self) for n in node.generators]))

    def visit_module(self, node):
        """return an astroid.Module node as string"""
        docs = '"""%s"""\n\n' % node.doc if node.doc else ''
        return docs + '\n'.join([n.accept(self) for n in node.body]) + '\n\n'

    def visit_name(self, node):
        """return an astroid.Name node as string"""
        return node.name

    def visit_pass(self, node):
        """return an astroid.Pass node as string"""
        return 'pass'

    def visit_print(self, node):
        """return an astroid.Print node as string"""
        nodes = ', '.join([n.accept(self) for n in node.values])
        if not node.nl:
            nodes = '%s,' % nodes
        if node.dest:
            return 'print >> %s, %s' % (node.dest.accept(self), nodes)
        return 'print %s' % nodes

    def visit_raise(self, node):
        """return an astroid.Raise node as string"""
        if node.exc:
            if node.inst:
                if node.tback:
                    return 'raise %s, %s, %s' % (node.exc.accept(self),
                                                 node.inst.accept(self),
                                                 node.tback.accept(self))
                return 'raise %s, %s' % (node.exc.accept(self),
                                         node.inst.accept(self))
            return 'raise %s' % node.exc.accept(self)
        return 'raise'

    def visit_return(self, node):
        """return an astroid.Return node as string"""
        if node.value:
            return 'return %s' % node.value.accept(self)

        return 'return'

    def visit_index(self, node):
        """return a astroid.Index node as string"""
        return node.value.accept(self)

    def visit_set(self, node):
        """return an astroid.Set node as string"""
        return '{%s}' % ', '.join([child.accept(self) for child in node.elts])

    def visit_setcomp(self, node):
        """return an astroid.SetComp node as string"""
        return '{%s %s}' % (node.elt.accept(self),
                            ' '.join([n.accept(self) for n in node.generators]))

    def visit_slice(self, node):
        """return a astroid.Slice node as string"""
        lower = node.lower.accept(self) if node.lower else ''
        upper = node.upper.accept(self) if node.upper else''
        step = node.step.accept(self) if node.step else ''
        if step:
            return '%s:%s:%s' % (lower, upper, step)
        return  '%s:%s' % (lower, upper)

    def visit_subscript(self, node):
        """return an astroid.Subscript node as string"""
        return '%s[%s]' % (node.value.accept(self), node.slice.accept(self))

    def visit_tryexcept(self, node):
        """return an astroid.TryExcept node as string"""
        trys = ['try:\n%s' % self._stmt_list(node.body)]
        for handler in node.handlers:
            trys.append(handler.accept(self))
        if node.orelse:
            trys.append('else:\n%s' % self._stmt_list(node.orelse))
        return '\n'.join(trys)

    def visit_tryfinally(self, node):
        """return an astroid.TryFinally node as string"""
        return 'try:\n%s\nfinally:\n%s' % (self._stmt_list(node.body),
                                           self._stmt_list(node.finalbody))

    def visit_tuple(self, node):
        """return an astroid.Tuple node as string"""
        if len(node.elts) == 1:
            return '(%s, )' % node.elts[0].accept(self)
        return '(%s)' % ', '.join([child.accept(self) for child in node.elts])

    def visit_unaryop(self, node):
        """return an astroid.UnaryOp node as string"""
        if node.op == 'not':
            operator = 'not '
        else:
            operator = node.op
        return '%s%s' % (operator, node.operand.accept(self))

    def visit_while(self, node):
        """return an astroid.While node as string"""
        whiles = 'while %s:\n%s' % (node.test.accept(self),
                                    self._stmt_list(node.body))
        if node.orelse:
            whiles = '%s\nelse:\n%s' % (whiles, self._stmt_list(node.orelse))
        return whiles

    def visit_with(self, node): # 'with' without 'as' is possible
        """return an astroid.With node as string"""
        items = ', '.join(('(%s)' % expr.accept(self)) +
                          (vars and ' as (%s)' % (vars.accept(self)) or '')
                          for expr, vars in node.items)
        return 'with %s:\n%s' % (items, self._stmt_list(node.body))

    def visit_yield(self, node):
        """yield an ast.Yield node as string"""
        yi_val = (" " + node.value.accept(self)) if node.value else ""
        expr = 'yield' + yi_val
        if node.parent.is_statement:
            return expr

        return "(%s)" % (expr,)

    def visit_starred(self, node):
        """return Starred node as string"""
        return "*" + node.value.accept(self)

    # These aren't for real AST nodes, but for inference objects.

    def visit_frozenset(self, node):
        return node.parent.accept(self)

    def visit_super(self, node):
        return node.parent.accept(self)

    def visit_uninferable(self, node):
        return str(node)


class AsStringVisitor3(AsStringVisitor):
    """AsStringVisitor3 overwrites some AsStringVisitor methods"""

    def visit_excepthandler(self, node):
        if node.type:
            if node.name:
                excs = 'except %s as %s' % (node.type.accept(self),
                                            node.name.accept(self))
            else:
                excs = 'except %s' % node.type.accept(self)
        else:
            excs = 'except'
        return '%s:\n%s' % (excs, self._stmt_list(node.body))

    def visit_nonlocal(self, node):
        """return an astroid.Nonlocal node as string"""
        return 'nonlocal %s' % ', '.join(node.names)

    def visit_raise(self, node):
        """return an astroid.Raise node as string"""
        if node.exc:
            if node.cause:
                return 'raise %s from %s' % (node.exc.accept(self),
                                             node.cause.accept(self))
            return 'raise %s' % node.exc.accept(self)
        return 'raise'

    def visit_yieldfrom(self, node):
        """ Return an astroid.YieldFrom node as string. """
        yi_val = (" " + node.value.accept(self)) if node.value else ""
        expr = 'yield from' + yi_val
        if node.parent.is_statement:
            return expr

        return "(%s)" % (expr,)

    def visit_asyncfunctiondef(self, node):
        function = super(AsStringVisitor3, self).visit_functiondef(node)
        return 'async ' + function.strip()

    def visit_await(self, node):
        return 'await %s' % node.value.accept(self)

    def visit_asyncwith(self, node):
        return 'async %s' % self.visit_with(node)

    def visit_asyncfor(self, node):
        return 'async %s' % self.visit_for(node)

    def visit_joinedstr(self, node):
        # Special treatment for constants,
        # as we want to join literals not reprs
        string = ''.join(
            value.value if type(value).__name__ == 'Const'
            else value.accept(self)
            for value in node.values
        )
        return "f'%s'" % string

    def visit_formattedvalue(self, node):
        return '{%s}' % node.value.accept(self)

    def visit_comprehension(self, node):
        """return an astroid.Comprehension node as string"""
        return '%s%s' % ('async ' if node.is_async else '',
                         super(AsStringVisitor3, self).visit_comprehension(node))


def _import_string(names):
    """return a list of (name, asname) formatted as a string"""
    _names = []
    for name, asname in names:
        if asname is not None:
            _names.append('%s as %s' % (name, asname))
        else:
            _names.append(name)
    return ', '.join(_names)


if sys.version_info >= (3, 0):
    AsStringVisitor = AsStringVisitor3

# This sets the default indent to 4 spaces.
to_code = AsStringVisitor('    ')
