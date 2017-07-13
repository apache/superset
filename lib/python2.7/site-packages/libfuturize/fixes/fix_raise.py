"""Fixer for 'raise E, V'

From Armin Ronacher's ``python-modernize``.

raise         -> raise
raise E       -> raise E
raise E, V    -> raise E(V)

raise (((E, E'), E''), E'''), V -> raise E(V)


CAVEATS:
1) "raise E, V" will be incorrectly translated if V is an exception
   instance. The correct Python 3 idiom is

        raise E from V

   but since we can't detect instance-hood by syntax alone and since
   any client code would have to be changed as well, we don't automate
   this.
"""
# Author: Collin Winter, Armin Ronacher

# Local imports
from lib2to3 import pytree, fixer_base
from lib2to3.pgen2 import token
from lib2to3.fixer_util import Name, Call, is_tuple

class FixRaise(fixer_base.BaseFix):

    BM_compatible = True
    PATTERN = """
    raise_stmt< 'raise' exc=any [',' val=any] >
    """

    def transform(self, node, results):
        syms = self.syms

        exc = results["exc"].clone()
        if exc.type == token.STRING:
            msg = "Python 3 does not support string exceptions"
            self.cannot_convert(node, msg)
            return

        # Python 2 supports
        #  raise ((((E1, E2), E3), E4), E5), V
        # as a synonym for
        #  raise E1, V
        # Since Python 3 will not support this, we recurse down any tuple
        # literals, always taking the first element.
        if is_tuple(exc):
            while is_tuple(exc):
                # exc.children[1:-1] is the unparenthesized tuple
                # exc.children[1].children[0] is the first element of the tuple
                exc = exc.children[1].children[0].clone()
            exc.prefix = u" "

        if "val" not in results:
            # One-argument raise
            new = pytree.Node(syms.raise_stmt, [Name(u"raise"), exc])
            new.prefix = node.prefix
            return new

        val = results["val"].clone()
        if is_tuple(val):
            args = [c.clone() for c in val.children[1:-1]]
        else:
            val.prefix = u""
            args = [val]

        return pytree.Node(syms.raise_stmt,
                           [Name(u"raise"), Call(exc, args)],
                           prefix=node.prefix)
