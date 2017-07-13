"""
Engine classes for :func:`~pandas.eval`
"""

import abc

from pandas import compat
from pandas.compat import map
import pandas.io.formats.printing as printing
from pandas.core.computation.align import _align, _reconstruct_object
from pandas.core.computation.ops import (
    UndefinedVariableError,
    _mathops, _reductions)


_ne_builtins = frozenset(_mathops + _reductions)


class NumExprClobberingError(NameError):
    pass


def _check_ne_builtin_clash(expr):
    """Attempt to prevent foot-shooting in a helpful way.

    Parameters
    ----------
    terms : Term
        Terms can contain
    """
    names = expr.names
    overlap = names & _ne_builtins

    if overlap:
        s = ', '.join(map(repr, overlap))
        raise NumExprClobberingError('Variables in expression "%s" '
                                     'overlap with builtins: (%s)' % (expr, s))


class AbstractEngine(object):

    """Object serving as a base class for all engines."""

    __metaclass__ = abc.ABCMeta

    has_neg_frac = False

    def __init__(self, expr):
        self.expr = expr
        self.aligned_axes = None
        self.result_type = None

    def convert(self):
        """Convert an expression for evaluation.

        Defaults to return the expression as a string.
        """
        return printing.pprint_thing(self.expr)

    def evaluate(self):
        """Run the engine on the expression

        This method performs alignment which is necessary no matter what engine
        is being used, thus its implementation is in the base class.

        Returns
        -------
        obj : object
            The result of the passed expression.
        """
        if not self._is_aligned:
            self.result_type, self.aligned_axes = _align(self.expr.terms)

        # make sure no names in resolvers and locals/globals clash
        res = self._evaluate()
        return _reconstruct_object(self.result_type, res, self.aligned_axes,
                                   self.expr.terms.return_type)

    @property
    def _is_aligned(self):
        return self.aligned_axes is not None and self.result_type is not None

    @abc.abstractmethod
    def _evaluate(self):
        """Return an evaluated expression.

        Parameters
        ----------
        env : Scope
            The local and global environment in which to evaluate an
            expression.

        Notes
        -----
        Must be implemented by subclasses.
        """
        pass


class NumExprEngine(AbstractEngine):

    """NumExpr engine class"""
    has_neg_frac = True

    def __init__(self, expr):
        super(NumExprEngine, self).__init__(expr)

    def convert(self):
        return str(super(NumExprEngine, self).convert())

    def _evaluate(self):
        import numexpr as ne

        # convert the expression to a valid numexpr expression
        s = self.convert()

        try:
            env = self.expr.env
            scope = env.full_scope
            truediv = scope['truediv']
            _check_ne_builtin_clash(self.expr)
            return ne.evaluate(s, local_dict=scope, truediv=truediv)
        except KeyError as e:
            # python 3 compat kludge
            try:
                msg = e.message
            except AttributeError:
                msg = compat.text_type(e)
            raise UndefinedVariableError(msg)


class PythonEngine(AbstractEngine):

    """Evaluate an expression in Python space.

    Mostly for testing purposes.
    """
    has_neg_frac = False

    def __init__(self, expr):
        super(PythonEngine, self).__init__(expr)

    def evaluate(self):
        return self.expr()

    def _evaluate(self):
        pass


_engines = {'numexpr': NumExprEngine, 'python': PythonEngine}
