"""
For the ``future`` package.

Adds this import line:

    from __future__ import division

at the top and changes any old-style divisions to be calls to
past.utils.old_div so the code runs as before on Py2.6/2.7 and has the same
behaviour on Py3.

If "from __future__ import division" is already in effect, this fixer does
nothing.
"""

from lib2to3 import fixer_base
from lib2to3.fixer_util import syms, does_tree_import
from libfuturize.fixer_util import (token, future_import, touch_import_top,
                                    wrap_in_fn_call)


def match_division(node):
    u"""
    __future__.division redefines the meaning of a single slash for division,
    so we match that and only that.
    """
    slash = token.SLASH
    return node.type == slash and not node.next_sibling.type == slash and \
                                  not node.prev_sibling.type == slash


class FixDivisionSafe(fixer_base.BaseFix):
    # BM_compatible = True
    run_order = 4    # this seems to be ignored?

    _accept_type = token.SLASH

    PATTERN = """
    term<(not('/') any)+ '/' ((not('/') any))>
    """

    def start_tree(self, tree, name):
        """
        Skip this fixer if "__future__.division" is already imported.
        """
        super(FixDivisionSafe, self).start_tree(tree, name)
        self.skip = "division" in tree.future_features

    def match(self, node):
        u"""
        Since the tree needs to be fixed once and only once if and only if it
        matches, we can start discarding matches after the first.
        """
        if (node.type == self.syms.term and 
                    len(node.children) == 3 and
                    match_division(node.children[1])):
            expr1, expr2 = node.children[0], node.children[2]
            return expr1, expr2
        else:
            return False

    def transform(self, node, results):
        if self.skip:
            return
        future_import(u"division", node)

        touch_import_top(u'past.utils', u'old_div', node)
        expr1, expr2 = results[0].clone(), results[1].clone()
        # Strip any leading space for the first number:
        expr1.prefix = u''
        return wrap_in_fn_call("old_div", (expr1, expr2), prefix=node.prefix)

