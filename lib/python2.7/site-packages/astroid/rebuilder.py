# Copyright (c) 2009-2014 LOGILAB S.A. (Paris, FRANCE) <contact@logilab.fr>
# Copyright (c) 2013-2016 Claudiu Popa <pcmanticore@gmail.com>
# Copyright (c) 2013-2014 Google, Inc.
# Copyright (c) 2015-2016 Cara Vinson <ceridwenv@gmail.com>

# Licensed under the LGPL: https://www.gnu.org/licenses/old-licenses/lgpl-2.1.en.html
# For details: https://github.com/PyCQA/astroid/blob/master/COPYING.LESSER

"""this module contains utilities for rebuilding a _ast tree in
order to get a single Astroid representation
"""

import sys
import _ast

import astroid
from astroid import astpeephole
from astroid import nodes



_BIN_OP_CLASSES = {_ast.Add: '+',
                   _ast.BitAnd: '&',
                   _ast.BitOr: '|',
                   _ast.BitXor: '^',
                   _ast.Div: '/',
                   _ast.FloorDiv: '//',
                   _ast.Mod: '%',
                   _ast.Mult: '*',
                   _ast.Pow: '**',
                   _ast.Sub: '-',
                   _ast.LShift: '<<',
                   _ast.RShift: '>>',
                  }
if sys.version_info >= (3, 5):
    _BIN_OP_CLASSES[_ast.MatMult] = '@'

_BOOL_OP_CLASSES = {_ast.And: 'and',
                    _ast.Or: 'or',
                   }

_UNARY_OP_CLASSES = {_ast.UAdd: '+',
                     _ast.USub: '-',
                     _ast.Not: 'not',
                     _ast.Invert: '~',
                    }

_CMP_OP_CLASSES = {_ast.Eq: '==',
                   _ast.Gt: '>',
                   _ast.GtE: '>=',
                   _ast.In: 'in',
                   _ast.Is: 'is',
                   _ast.IsNot: 'is not',
                   _ast.Lt: '<',
                   _ast.LtE: '<=',
                   _ast.NotEq: '!=',
                   _ast.NotIn: 'not in',
                  }

CONST_NAME_TRANSFORMS = {'None':  None,
                         'True':  True,
                         'False': False,
                        }

REDIRECT = {'arguments': 'Arguments',
            'comprehension': 'Comprehension',
            "ListCompFor": 'Comprehension',
            "GenExprFor": 'Comprehension',
            'excepthandler': 'ExceptHandler',
            'keyword': 'Keyword',
           }
PY3 = sys.version_info >= (3, 0)
PY34 = sys.version_info >= (3, 4)
CONTEXTS = {_ast.Load: astroid.Load,
            _ast.Store: astroid.Store,
            _ast.Del: astroid.Del,
            _ast.Param: astroid.Store}


def _get_doc(node):
    try:
        if isinstance(node.body[0], _ast.Expr) and isinstance(node.body[0].value, _ast.Str):
            doc = node.body[0].value.s
            node.body = node.body[1:]
            return node, doc
    except IndexError:
        pass # ast built from scratch
    return node, None

def _visit_or_none(node, attr, visitor, parent, visit='visit',
                   **kws):
    """If the given node has an attribute, visits the attribute, and
    otherwise returns None.

    """
    value = getattr(node, attr, None)
    if value:
        return getattr(visitor, visit)(value, parent, **kws)

    return None


def _get_context(node):
    return CONTEXTS.get(type(node.ctx), astroid.Load)


class TreeRebuilder(object):
    """Rebuilds the _ast tree to become an Astroid tree"""

    def __init__(self, manager):
        self._manager = manager
        self._global_names = []
        self._import_from_nodes = []
        self._delayed_assattr = []
        self._visit_meths = {}
        self._peepholer = astpeephole.ASTPeepholeOptimizer()

    def visit_module(self, node, modname, modpath, package):
        """visit a Module node by returning a fresh instance of it"""
        node, doc = _get_doc(node)
        newnode = nodes.Module(name=modname, doc=doc, file=modpath, path=modpath,
                               package=package, parent=None)
        newnode.postinit([self.visit(child, newnode) for child in node.body])
        return newnode

    def visit(self, node, parent):
        cls = node.__class__
        if cls in self._visit_meths:
            visit_method = self._visit_meths[cls]
        else:
            cls_name = cls.__name__
            visit_name = 'visit_' + REDIRECT.get(cls_name, cls_name).lower()
            visit_method = getattr(self, visit_name)
            self._visit_meths[cls] = visit_method
        return visit_method(node, parent)

    def _save_assignment(self, node, name=None):
        """save assignement situation since node.parent is not available yet"""
        if self._global_names and node.name in self._global_names[-1]:
            node.root().set_local(node.name, node)
        else:
            node.parent.set_local(node.name, node)

    def visit_arguments(self, node, parent):
        """visit a Arguments node by returning a fresh instance of it"""
        vararg, kwarg = node.vararg, node.kwarg
        if PY34:
            newnode = nodes.Arguments(vararg.arg if vararg else None,
                                      kwarg.arg if kwarg else None,
                                      parent)
        else:
            newnode = nodes.Arguments(vararg, kwarg, parent)
        args = [self.visit(child, newnode) for child in node.args]
        defaults = [self.visit(child, newnode)
                    for child in node.defaults]
        varargannotation = None
        kwargannotation = None
        # change added in 82732 (7c5c678e4164), vararg and kwarg
        # are instances of `_ast.arg`, not strings
        if vararg:
            if PY34:
                if node.vararg.annotation:
                    varargannotation = self.visit(node.vararg.annotation,
                                                  newnode)
                vararg = vararg.arg
            elif PY3 and node.varargannotation:
                varargannotation = self.visit(node.varargannotation,
                                              newnode)
        if kwarg:
            if PY34:
                if node.kwarg.annotation:
                    kwargannotation = self.visit(node.kwarg.annotation,
                                                 newnode)
                kwarg = kwarg.arg
            elif PY3:
                if node.kwargannotation:
                    kwargannotation = self.visit(node.kwargannotation,
                                                 newnode)
        if PY3:
            kwonlyargs = [self.visit(child, newnode) for child
                          in node.kwonlyargs]
            kw_defaults = [self.visit(child, newnode) if child else
                           None for child in node.kw_defaults]
            annotations = [self.visit(arg.annotation, newnode) if
                           arg.annotation else None for arg in node.args]
            kwonlyargs_annotations = [
                self.visit(arg.annotation, newnode) if arg.annotation else None
                for arg in node.kwonlyargs
            ]
        else:
            kwonlyargs = []
            kw_defaults = []
            annotations = []
            kwonlyargs_annotations = []

        newnode.postinit(
            args=args,
            defaults=defaults,
            kwonlyargs=kwonlyargs,
            kw_defaults=kw_defaults,
            annotations=annotations,
            kwonlyargs_annotations=kwonlyargs_annotations,
            varargannotation=varargannotation,
            kwargannotation=kwargannotation
        )
        # save argument names in locals:
        if vararg:
            newnode.parent.set_local(vararg, newnode)
        if kwarg:
            newnode.parent.set_local(kwarg, newnode)
        return newnode

    def visit_assert(self, node, parent):
        """visit a Assert node by returning a fresh instance of it"""
        newnode = nodes.Assert(node.lineno, node.col_offset, parent)
        if node.msg:
            msg = self.visit(node.msg, newnode)
        else:
            msg = None
        newnode.postinit(self.visit(node.test, newnode), msg)
        return newnode

    def visit_assign(self, node, parent):
        """visit a Assign node by returning a fresh instance of it"""
        newnode = nodes.Assign(node.lineno, node.col_offset, parent)
        newnode.postinit([self.visit(child, newnode)
                          for child in node.targets],
                         self.visit(node.value, newnode))
        return newnode

    def visit_assignname(self, node, parent, node_name=None):
        '''visit a node and return a AssignName node'''
        newnode = nodes.AssignName(node_name, getattr(node, 'lineno', None),
                                   getattr(node, 'col_offset', None), parent)
        self._save_assignment(newnode)
        return newnode

    def visit_augassign(self, node, parent):
        """visit a AugAssign node by returning a fresh instance of it"""
        newnode = nodes.AugAssign(_BIN_OP_CLASSES[type(node.op)] + "=",
                                  node.lineno, node.col_offset, parent)
        newnode.postinit(self.visit(node.target, newnode),
                         self.visit(node.value, newnode))
        return newnode

    def visit_repr(self, node, parent):
        """visit a Backquote node by returning a fresh instance of it"""
        newnode = nodes.Repr(node.lineno, node.col_offset, parent)
        newnode.postinit(self.visit(node.value, newnode))
        return newnode

    def visit_binop(self, node, parent):
        """visit a BinOp node by returning a fresh instance of it"""
        if isinstance(node.left, _ast.BinOp) and self._manager.optimize_ast:
            # Optimize BinOp operations in order to remove
            # redundant recursion. For instance, if the
            # following code is parsed in order to obtain
            # its ast, then the rebuilder will fail with an
            # infinite recursion, the same will happen with the
            # inference engine as well. There's no need to hold
            # so many objects for the BinOp if they can be reduced
            # to something else (also, the optimization
            # might handle only Const binops, which isn't a big
            # problem for the correctness of the program).
            #
            # ("a" + "b" + # one thousand more + "c")
            optimized = self._peepholer.optimize_binop(node, parent)
            if optimized:
                return optimized

        newnode = nodes.BinOp(_BIN_OP_CLASSES[type(node.op)],
                              node.lineno, node.col_offset, parent)
        newnode.postinit(self.visit(node.left, newnode),
                         self.visit(node.right, newnode))
        return newnode

    def visit_boolop(self, node, parent):
        """visit a BoolOp node by returning a fresh instance of it"""
        newnode = nodes.BoolOp(_BOOL_OP_CLASSES[type(node.op)],
                               node.lineno, node.col_offset, parent)
        newnode.postinit([self.visit(child, newnode)
                          for child in node.values])
        return newnode

    def visit_break(self, node, parent):
        """visit a Break node by returning a fresh instance of it"""
        return nodes.Break(getattr(node, 'lineno', None),
                           getattr(node, 'col_offset', None),
                           parent)

    def visit_call(self, node, parent):
        """visit a CallFunc node by returning a fresh instance of it"""
        newnode = nodes.Call(node.lineno, node.col_offset, parent)
        starargs = _visit_or_none(node, 'starargs', self, newnode)
        kwargs = _visit_or_none(node, 'kwargs', self, newnode)
        args = [self.visit(child, newnode)
                for child in node.args]

        if node.keywords:
            keywords = [self.visit(child, newnode)
                        for child in node.keywords]
        else:
            keywords = None
        if starargs:
            new_starargs = nodes.Starred(col_offset=starargs.col_offset,
                                         lineno=starargs.lineno,
                                         parent=starargs.parent)
            new_starargs.postinit(value=starargs)
            args.append(new_starargs)
        if kwargs:
            new_kwargs = nodes.Keyword(arg=None, col_offset=kwargs.col_offset,
                                       lineno=kwargs.lineno,
                                       parent=kwargs.parent)
            new_kwargs.postinit(value=kwargs)
            if keywords:
                keywords.append(new_kwargs)
            else:
                keywords = [new_kwargs]

        newnode.postinit(self.visit(node.func, newnode),
                         args, keywords)
        return newnode

    def visit_classdef(self, node, parent, newstyle=None):
        """visit a ClassDef node to become astroid"""
        node, doc = _get_doc(node)
        newnode = nodes.ClassDef(node.name, doc, node.lineno,
                                 node.col_offset, parent)
        metaclass = None
        if PY3:
            for keyword in node.keywords:
                if keyword.arg == 'metaclass':
                    metaclass = self.visit(keyword, newnode).value
                    break
        if node.decorator_list:
            decorators = self.visit_decorators(node, newnode)
        else:
            decorators = None
        newnode.postinit([self.visit(child, newnode)
                          for child in node.bases],
                         [self.visit(child, newnode)
                          for child in node.body],
                         decorators, newstyle, metaclass,
                         [self.visit(kwd, newnode) for kwd in node.keywords
                          if kwd.arg != 'metaclass'] if PY3 else [])
        return newnode

    def visit_const(self, node, parent):
        """visit a Const node by returning a fresh instance of it"""
        return nodes.Const(node.value,
                           getattr(node, 'lineno', None),
                           getattr(node, 'col_offset', None), parent)

    def visit_continue(self, node, parent):
        """visit a Continue node by returning a fresh instance of it"""
        return nodes.Continue(getattr(node, 'lineno', None),
                              getattr(node, 'col_offset', None),
                              parent)

    def visit_compare(self, node, parent):
        """visit a Compare node by returning a fresh instance of it"""
        newnode = nodes.Compare(node.lineno, node.col_offset, parent)
        newnode.postinit(self.visit(node.left, newnode),
                         [(_CMP_OP_CLASSES[op.__class__],
                           self.visit(expr, newnode))
                          for (op, expr) in zip(node.ops, node.comparators)])
        return newnode

    def visit_comprehension(self, node, parent):
        """visit a Comprehension node by returning a fresh instance of it"""
        newnode = nodes.Comprehension(parent)
        newnode.postinit(self.visit(node.target, newnode),
                         self.visit(node.iter, newnode),
                         [self.visit(child, newnode)
                          for child in node.ifs],
                         getattr(node, 'is_async', None))
        return newnode

    def visit_decorators(self, node, parent):
        """visit a Decorators node by returning a fresh instance of it"""
        # /!\ node is actually a _ast.FunctionDef node while
        # parent is a astroid.nodes.FunctionDef node
        newnode = nodes.Decorators(node.lineno, node.col_offset, parent)
        newnode.postinit([self.visit(child, newnode)
                          for child in node.decorator_list])
        return newnode

    def visit_delete(self, node, parent):
        """visit a Delete node by returning a fresh instance of it"""
        newnode = nodes.Delete(node.lineno, node.col_offset, parent)
        newnode.postinit([self.visit(child, newnode)
                          for child in node.targets])
        return newnode

    def _visit_dict_items(self, node, parent, newnode):
        for key, value in zip(node.keys, node.values):
            rebuilt_value = self.visit(value, newnode)
            if not key:
                # Python 3.5 and extended unpacking
                rebuilt_key = nodes.DictUnpack(rebuilt_value.lineno,
                                               rebuilt_value.col_offset,
                                               parent)
            else:
                rebuilt_key = self.visit(key, newnode)
            yield rebuilt_key, rebuilt_value

    def visit_dict(self, node, parent):
        """visit a Dict node by returning a fresh instance of it"""
        newnode = nodes.Dict(node.lineno, node.col_offset, parent)
        items = list(self._visit_dict_items(node, parent, newnode))
        newnode.postinit(items)
        return newnode

    def visit_dictcomp(self, node, parent):
        """visit a DictComp node by returning a fresh instance of it"""
        newnode = nodes.DictComp(node.lineno, node.col_offset, parent)
        newnode.postinit(self.visit(node.key, newnode),
                         self.visit(node.value, newnode),
                         [self.visit(child, newnode)
                          for child in node.generators])
        return newnode

    def visit_expr(self, node, parent):
        """visit a Expr node by returning a fresh instance of it"""
        newnode = nodes.Expr(node.lineno, node.col_offset, parent)
        newnode.postinit(self.visit(node.value, newnode))
        return newnode

    def visit_ellipsis(self, node, parent):
        """visit an Ellipsis node by returning a fresh instance of it"""
        return nodes.Ellipsis(getattr(node, 'lineno', None),
                              getattr(node, 'col_offset', None), parent)


    def visit_emptynode(self, node, parent):
        """visit an EmptyNode node by returning a fresh instance of it"""
        return nodes.EmptyNode(getattr(node, 'lineno', None),
                               getattr(node, 'col_offset', None), parent)


    def visit_excepthandler(self, node, parent):
        """visit an ExceptHandler node by returning a fresh instance of it"""
        newnode = nodes.ExceptHandler(node.lineno, node.col_offset, parent)
        # /!\ node.name can be a tuple
        newnode.postinit(_visit_or_none(node, 'type', self, newnode),
                         _visit_or_none(node, 'name', self, newnode),
                         [self.visit(child, newnode)
                          for child in node.body])
        return newnode

    def visit_exec(self, node, parent):
        """visit an Exec node by returning a fresh instance of it"""
        newnode = nodes.Exec(node.lineno, node.col_offset, parent)
        newnode.postinit(self.visit(node.body, newnode),
                         _visit_or_none(node, 'globals', self, newnode),
                         _visit_or_none(node, 'locals', self, newnode))
        return newnode

    def visit_extslice(self, node, parent):
        """visit an ExtSlice node by returning a fresh instance of it"""
        newnode = nodes.ExtSlice(parent=parent)
        newnode.postinit([self.visit(dim, newnode)
                          for dim in node.dims])
        return newnode

    def _visit_for(self, cls, node, parent):
        """visit a For node by returning a fresh instance of it"""
        newnode = cls(node.lineno, node.col_offset, parent)
        newnode.postinit(self.visit(node.target, newnode),
                         self.visit(node.iter, newnode),
                         [self.visit(child, newnode)
                          for child in node.body],
                         [self.visit(child, newnode)
                          for child in node.orelse])
        return newnode

    def visit_for(self, node, parent):
        return self._visit_for(nodes.For, node, parent)

    def visit_importfrom(self, node, parent):
        """visit an ImportFrom node by returning a fresh instance of it"""
        names = [(alias.name, alias.asname) for alias in node.names]
        newnode = nodes.ImportFrom(node.module or '', names, node.level or None,
                                   getattr(node, 'lineno', None),
                                   getattr(node, 'col_offset', None), parent)
        # store From names to add them to locals after building
        self._import_from_nodes.append(newnode)
        return newnode

    def _visit_functiondef(self, cls, node, parent):
        """visit an FunctionDef node to become astroid"""
        self._global_names.append({})
        node, doc = _get_doc(node)
        newnode = cls(node.name, doc, node.lineno,
                      node.col_offset, parent)
        if node.decorator_list:
            decorators = self.visit_decorators(node, newnode)
        else:
            decorators = None
        if PY3 and node.returns:
            returns = self.visit(node.returns, newnode)
        else:
            returns = None
        newnode.postinit(self.visit(node.args, newnode),
                         [self.visit(child, newnode)
                          for child in node.body],
                         decorators, returns)
        self._global_names.pop()
        return newnode

    def visit_functiondef(self, node, parent):
        return self._visit_functiondef(nodes.FunctionDef, node, parent)

    def visit_generatorexp(self, node, parent):
        """visit a GeneratorExp node by returning a fresh instance of it"""
        newnode = nodes.GeneratorExp(node.lineno, node.col_offset, parent)
        newnode.postinit(self.visit(node.elt, newnode),
                         [self.visit(child, newnode)
                          for child in node.generators])
        return newnode

    def visit_attribute(self, node, parent):
        """visit an Attribute node by returning a fresh instance of it"""
        context = _get_context(node)
        if context == astroid.Del:
            # FIXME : maybe we should reintroduce and visit_delattr ?
            # for instance, deactivating assign_ctx
            newnode = nodes.DelAttr(node.attr, node.lineno, node.col_offset,
                                    parent)
        elif context == astroid.Store:
            newnode = nodes.AssignAttr(node.attr, node.lineno, node.col_offset,
                                       parent)
            # Prohibit a local save if we are in an ExceptHandler.
            if not isinstance(parent, astroid.ExceptHandler):
                self._delayed_assattr.append(newnode)
        else:
            newnode = nodes.Attribute(node.attr, node.lineno, node.col_offset,
                                      parent)
        newnode.postinit(self.visit(node.value, newnode))
        return newnode

    def visit_global(self, node, parent):
        """visit a Global node to become astroid"""
        newnode = nodes.Global(node.names, getattr(node, 'lineno', None),
                               getattr(node, 'col_offset', None), parent)
        if self._global_names: # global at the module level, no effect
            for name in node.names:
                self._global_names[-1].setdefault(name, []).append(newnode)
        return newnode

    def visit_if(self, node, parent):
        """visit an If node by returning a fresh instance of it"""
        newnode = nodes.If(node.lineno, node.col_offset, parent)
        newnode.postinit(self.visit(node.test, newnode),
                         [self.visit(child, newnode)
                          for child in node.body],
                         [self.visit(child, newnode)
                          for child in node.orelse])
        return newnode

    def visit_ifexp(self, node, parent):
        """visit a IfExp node by returning a fresh instance of it"""
        newnode = nodes.IfExp(node.lineno, node.col_offset, parent)
        newnode.postinit(self.visit(node.test, newnode),
                         self.visit(node.body, newnode),
                         self.visit(node.orelse, newnode))
        return newnode

    def visit_import(self, node, parent):
        """visit a Import node by returning a fresh instance of it"""
        names = [(alias.name, alias.asname) for alias in node.names]
        newnode = nodes.Import(names, getattr(node, 'lineno', None),
                               getattr(node, 'col_offset', None), parent)
        # save import names in parent's locals:
        for (name, asname) in newnode.names:
            name = asname or name
            parent.set_local(name.split('.')[0], newnode)
        return newnode

    def visit_index(self, node, parent):
        """visit a Index node by returning a fresh instance of it"""
        newnode = nodes.Index(parent=parent)
        newnode.postinit(self.visit(node.value, newnode))
        return newnode

    def visit_keyword(self, node, parent):
        """visit a Keyword node by returning a fresh instance of it"""
        newnode = nodes.Keyword(node.arg, parent=parent)
        newnode.postinit(self.visit(node.value, newnode))
        return newnode

    def visit_lambda(self, node, parent):
        """visit a Lambda node by returning a fresh instance of it"""
        newnode = nodes.Lambda(node.lineno, node.col_offset, parent)
        newnode.postinit(self.visit(node.args, newnode),
                         self.visit(node.body, newnode))
        return newnode

    def visit_list(self, node, parent):
        """visit a List node by returning a fresh instance of it"""
        context = _get_context(node)
        newnode = nodes.List(ctx=context,
                             lineno=node.lineno,
                             col_offset=node.col_offset,
                             parent=parent)
        newnode.postinit([self.visit(child, newnode)
                          for child in node.elts])
        return newnode

    def visit_listcomp(self, node, parent):
        """visit a ListComp node by returning a fresh instance of it"""
        newnode = nodes.ListComp(node.lineno, node.col_offset, parent)
        newnode.postinit(self.visit(node.elt, newnode),
                         [self.visit(child, newnode)
                          for child in node.generators])
        return newnode

    def visit_name(self, node, parent):
        """visit a Name node by returning a fresh instance of it"""
        context = _get_context(node)
        # True and False can be assigned to something in py2x, so we have to
        # check first the context.
        if context == astroid.Del:
            newnode = nodes.DelName(node.id, node.lineno, node.col_offset,
                                    parent)
        elif context == astroid.Store:
            newnode = nodes.AssignName(node.id, node.lineno, node.col_offset,
                                       parent)
        elif node.id in CONST_NAME_TRANSFORMS:
            newnode = nodes.Const(CONST_NAME_TRANSFORMS[node.id],
                                  getattr(node, 'lineno', None),
                                  getattr(node, 'col_offset', None), parent)
            return newnode
        else:
            newnode = nodes.Name(node.id, node.lineno, node.col_offset, parent)
        # XXX REMOVE me :
        if context in (astroid.Del, astroid.Store): # 'Aug' ??
            self._save_assignment(newnode)
        return newnode

    def visit_str(self, node, parent):
        """visit a String/Bytes node by returning a fresh instance of Const"""
        return nodes.Const(node.s, getattr(node, 'lineno', None),
                           getattr(node, 'col_offset', None), parent)
    visit_bytes = visit_str

    def visit_num(self, node, parent):
        """visit a Num node by returning a fresh instance of Const"""
        return nodes.Const(node.n, getattr(node, 'lineno', None),
                           getattr(node, 'col_offset', None), parent)

    def visit_pass(self, node, parent):
        """visit a Pass node by returning a fresh instance of it"""
        return nodes.Pass(node.lineno, node.col_offset, parent)

    def visit_print(self, node, parent):
        """visit a Print node by returning a fresh instance of it"""
        newnode = nodes.Print(node.nl, node.lineno, node.col_offset, parent)
        newnode.postinit(_visit_or_none(node, 'dest', self, newnode),
                         [self.visit(child, newnode)
                          for child in node.values])
        return newnode

    def visit_raise(self, node, parent):
        """visit a Raise node by returning a fresh instance of it"""
        newnode = nodes.Raise(node.lineno, node.col_offset, parent)
        newnode.postinit(_visit_or_none(node, 'type', self, newnode),
                         _visit_or_none(node, 'inst', self, newnode),
                         _visit_or_none(node, 'tback', self, newnode))
        return newnode

    def visit_return(self, node, parent):
        """visit a Return node by returning a fresh instance of it"""
        newnode = nodes.Return(node.lineno, node.col_offset, parent)
        if node.value is not None:
            newnode.postinit(self.visit(node.value, newnode))
        return newnode

    def visit_set(self, node, parent):
        """visit a Set node by returning a fresh instance of it"""
        newnode = nodes.Set(node.lineno, node.col_offset, parent)
        newnode.postinit([self.visit(child, newnode)
                          for child in node.elts])
        return newnode

    def visit_setcomp(self, node, parent):
        """visit a SetComp node by returning a fresh instance of it"""
        newnode = nodes.SetComp(node.lineno, node.col_offset, parent)
        newnode.postinit(self.visit(node.elt, newnode),
                         [self.visit(child, newnode)
                          for child in node.generators])
        return newnode

    def visit_slice(self, node, parent):
        """visit a Slice node by returning a fresh instance of it"""
        newnode = nodes.Slice(parent=parent)
        newnode.postinit(_visit_or_none(node, 'lower', self, newnode),
                         _visit_or_none(node, 'upper', self, newnode),
                         _visit_or_none(node, 'step', self, newnode))
        return newnode

    def visit_subscript(self, node, parent):
        """visit a Subscript node by returning a fresh instance of it"""
        context = _get_context(node)
        newnode = nodes.Subscript(ctx=context,
                                  lineno=node.lineno,
                                  col_offset=node.col_offset,
                                  parent=parent)
        newnode.postinit(self.visit(node.value, newnode),
                         self.visit(node.slice, newnode))
        return newnode

    def visit_tryexcept(self, node, parent):
        """visit a TryExcept node by returning a fresh instance of it"""
        newnode = nodes.TryExcept(node.lineno, node.col_offset, parent)
        newnode.postinit([self.visit(child, newnode)
                          for child in node.body],
                         [self.visit(child, newnode)
                          for child in node.handlers],
                         [self.visit(child, newnode)
                          for child in node.orelse])
        return newnode

    def visit_tryfinally(self, node, parent):
        """visit a TryFinally node by returning a fresh instance of it"""
        newnode = nodes.TryFinally(node.lineno, node.col_offset, parent)
        newnode.postinit([self.visit(child, newnode)
                          for child in node.body],
                         [self.visit(n, newnode)
                          for n in node.finalbody])
        return newnode

    def visit_tuple(self, node, parent):
        """visit a Tuple node by returning a fresh instance of it"""
        context = _get_context(node)
        newnode = nodes.Tuple(ctx=context,
                              lineno=node.lineno,
                              col_offset=node.col_offset,
                              parent=parent)
        newnode.postinit([self.visit(child, newnode)
                          for child in node.elts])
        return newnode

    def visit_unaryop(self, node, parent):
        """visit a UnaryOp node by returning a fresh instance of it"""
        newnode = nodes.UnaryOp(_UNARY_OP_CLASSES[node.op.__class__],
                                node.lineno, node.col_offset, parent)
        newnode.postinit(self.visit(node.operand, newnode))
        return newnode

    def visit_while(self, node, parent):
        """visit a While node by returning a fresh instance of it"""
        newnode = nodes.While(node.lineno, node.col_offset, parent)
        newnode.postinit(self.visit(node.test, newnode),
                         [self.visit(child, newnode)
                          for child in node.body],
                         [self.visit(child, newnode)
                          for child in node.orelse])
        return newnode

    def visit_with(self, node, parent):
        newnode = nodes.With(node.lineno, node.col_offset, parent)
        expr = self.visit(node.context_expr, newnode)
        if node.optional_vars is not None:
            optional_vars = self.visit(node.optional_vars, newnode)
        else:
            optional_vars = None
        newnode.postinit([(expr, optional_vars)],
                         [self.visit(child, newnode)
                          for child in node.body])
        return newnode

    def visit_yield(self, node, parent):
        """visit a Yield node by returning a fresh instance of it"""
        newnode = nodes.Yield(node.lineno, node.col_offset, parent)
        if node.value is not None:
            newnode.postinit(self.visit(node.value, newnode))
        return newnode


class TreeRebuilder3(TreeRebuilder):
    """extend and overwrite TreeRebuilder for python3k"""

    def visit_arg(self, node, parent):
        """visit a arg node by returning a fresh AssName instance"""
        # TODO(cpopa): introduce an Arg node instead of using AssignName.
        return self.visit_assignname(node, parent, node.arg)

    def visit_nameconstant(self, node, parent):
        # in Python 3.4 we have NameConstant for True / False / None
        return nodes.Const(node.value, getattr(node, 'lineno', None),
                           getattr(node, 'col_offset', None), parent)

    def visit_excepthandler(self, node, parent):
        """visit an ExceptHandler node by returning a fresh instance of it"""
        newnode = nodes.ExceptHandler(node.lineno, node.col_offset, parent)
        if node.name:
            name = self.visit_assignname(node, newnode, node.name)
        else:
            name = None
        newnode.postinit(_visit_or_none(node, 'type', self, newnode),
                         name,
                         [self.visit(child, newnode)
                          for child in node.body])
        return newnode

    def visit_nonlocal(self, node, parent):
        """visit a Nonlocal node and return a new instance of it"""
        return nodes.Nonlocal(node.names, getattr(node, 'lineno', None),
                              getattr(node, 'col_offset', None), parent)


    def visit_raise(self, node, parent):
        """visit a Raise node by returning a fresh instance of it"""
        newnode = nodes.Raise(node.lineno, node.col_offset, parent)
        # no traceback; anyway it is not used in Pylint
        newnode.postinit(_visit_or_none(node, 'exc', self, newnode),
                         _visit_or_none(node, 'cause', self, newnode))
        return newnode

    def visit_starred(self, node, parent):
        """visit a Starred node and return a new instance of it"""
        context = _get_context(node)
        newnode = nodes.Starred(ctx=context, lineno=node.lineno,
                                col_offset=node.col_offset,
                                parent=parent)
        newnode.postinit(self.visit(node.value, newnode))
        return newnode

    def visit_try(self, node, parent):
        # python 3.3 introduce a new Try node replacing
        # TryFinally/TryExcept nodes
        if node.finalbody:
            newnode = nodes.TryFinally(node.lineno, node.col_offset, parent)
            if node.handlers:
                body = [self.visit_tryexcept(node, newnode)]
            else:
                body = [self.visit(child, newnode)
                        for child in node.body]
            newnode.postinit(body,
                             [self.visit(n, newnode)
                              for n in node.finalbody])
            return newnode
        elif node.handlers:
            return self.visit_tryexcept(node, parent)

    def visit_annassign(self, node, parent):
        """visit an AnnAssign node by returning a fresh instance of it"""
        newnode = nodes.AnnAssign(node.lineno, node.col_offset, parent)
        annotation = _visit_or_none(node, 'annotation', self, newnode)
        newnode.postinit(target=self.visit(node.target, newnode),
                         annotation=annotation,
                         simple=node.simple,
                         value=_visit_or_none(node, 'value', self, newnode))
        return newnode

    def _visit_with(self, cls, node, parent):
        if 'items' not in node._fields:
            # python < 3.3
            return super(TreeRebuilder3, self).visit_with(node, parent)

        newnode = cls(node.lineno, node.col_offset, parent)
        def visit_child(child):
            expr = self.visit(child.context_expr, newnode)
            var = _visit_or_none(child, 'optional_vars', self, newnode)
            return expr, var
        newnode.postinit([visit_child(child) for child in node.items],
                         [self.visit(child, newnode)
                          for child in node.body])
        return newnode

    def visit_with(self, node, parent):
        return self._visit_with(nodes.With, node, parent)

    def visit_yieldfrom(self, node, parent):
        newnode = nodes.YieldFrom(node.lineno, node.col_offset, parent)
        if node.value is not None:
            newnode.postinit(self.visit(node.value, newnode))
        return newnode

    def visit_classdef(self, node, parent, newstyle=True):
        return super(TreeRebuilder3, self).visit_classdef(node, parent,
                                                          newstyle=newstyle)

    # Async structs added in Python 3.5
    def visit_asyncfunctiondef(self, node, parent):
        return self._visit_functiondef(nodes.AsyncFunctionDef, node, parent)

    def visit_asyncfor(self, node, parent):
        return self._visit_for(nodes.AsyncFor, node, parent)

    def visit_await(self, node, parent):
        newnode = nodes.Await(node.lineno, node.col_offset, parent)
        newnode.postinit(value=self.visit(node.value, newnode))
        return newnode

    def visit_asyncwith(self, node, parent):
        return self._visit_with(nodes.AsyncWith, node, parent)

    def visit_joinedstr(self, node, parent):
        newnode = nodes.JoinedStr(node.lineno, node.col_offset, parent)
        newnode.postinit([self.visit(child, newnode)
                          for child in node.values])
        return newnode

    def visit_formattedvalue(self, node, parent):
        newnode = nodes.FormattedValue(node.lineno, node.col_offset, parent)
        newnode.postinit(self.visit(node.value, newnode),
                         node.conversion,
                         _visit_or_none(node, 'format_spec', self, newnode))
        return newnode

if sys.version_info >= (3, 0):
    TreeRebuilder = TreeRebuilder3
