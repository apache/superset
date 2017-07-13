# Copyright (c) 2015-2016 Claudiu Popa <pcmanticore@gmail.com>

# Licensed under the LGPL: https://www.gnu.org/licenses/old-licenses/lgpl-2.1.en.html
# For details: https://github.com/PyCQA/astroid/blob/master/COPYING.LESSER

"""Small AST optimizations."""

import _ast

from astroid import nodes


__all__ = ('ASTPeepholeOptimizer', )


try:
    _TYPES = (_ast.Str, _ast.Bytes)
except AttributeError:
    _TYPES = (_ast.Str, )


class ASTPeepholeOptimizer(object):
    """Class for applying small optimizations to generate new AST."""

    def optimize_binop(self, node, parent=None):
        """Optimize BinOps with string Const nodes on the lhs.

        This fixes an infinite recursion crash, where multiple
        strings are joined using the addition operator. With a
        sufficient number of such strings, astroid will fail
        with a maximum recursion limit exceeded. The
        function will return a Const node with all the strings
        already joined.
        Return ``None`` if no AST node can be obtained
        through optimization.
        """
        ast_nodes = []
        current = node
        while isinstance(current, _ast.BinOp):
            # lhs must be a BinOp with the addition operand.
            if not isinstance(current.left, _ast.BinOp):
                return
            if (not isinstance(current.left.op, _ast.Add)
                    or not isinstance(current.op, _ast.Add)):
                return

            # rhs must a str / bytes.
            if not isinstance(current.right, _TYPES):
                return

            ast_nodes.append(current.right.s)
            current = current.left

            if (isinstance(current, _ast.BinOp)
                    and isinstance(current.left, _TYPES)
                    and isinstance(current.right, _TYPES)):
                # Stop early if we are at the last BinOp in
                # the operation
                ast_nodes.append(current.right.s)
                ast_nodes.append(current.left.s)
                break

        if not ast_nodes:
            return

        # If we have inconsistent types, bail out.
        known = type(ast_nodes[0])
        if any(not isinstance(element, known)
               for element in ast_nodes[1:]):
            return

        value = known().join(reversed(ast_nodes))
        newnode = nodes.Const(value, node.lineno, node.col_offset, parent)
        return newnode
