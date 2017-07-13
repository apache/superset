"""Operator classes for eval.
"""

import operator as op
from functools import partial
from datetime import datetime

import numpy as np

from pandas.core.dtypes.common import is_list_like, is_scalar
import pandas as pd
from pandas.compat import PY3, string_types, text_type
import pandas.core.common as com
from pandas.io.formats.printing import pprint_thing, pprint_thing_encoded
from pandas.core.base import StringMixin
from pandas.core.computation.common import _ensure_decoded, _result_type_many
from pandas.core.computation.scope import _DEFAULT_GLOBALS


_reductions = 'sum', 'prod'

_unary_math_ops = ('sin', 'cos', 'exp', 'log', 'expm1', 'log1p',
                   'sqrt', 'sinh', 'cosh', 'tanh', 'arcsin', 'arccos',
                   'arctan', 'arccosh', 'arcsinh', 'arctanh', 'abs')
_binary_math_ops = ('arctan2',)
_mathops = _unary_math_ops + _binary_math_ops


_LOCAL_TAG = '__pd_eval_local_'


class UndefinedVariableError(NameError):

    """NameError subclass for local variables."""

    def __init__(self, name, is_local):
        if is_local:
            msg = 'local variable {0!r} is not defined'
        else:
            msg = 'name {0!r} is not defined'
        super(UndefinedVariableError, self).__init__(msg.format(name))


class Term(StringMixin):

    def __new__(cls, name, env, side=None, encoding=None):
        klass = Constant if not isinstance(name, string_types) else cls
        supr_new = super(Term, klass).__new__
        return supr_new(klass)

    def __init__(self, name, env, side=None, encoding=None):
        self._name = name
        self.env = env
        self.side = side
        tname = text_type(name)
        self.is_local = (tname.startswith(_LOCAL_TAG) or
                         tname in _DEFAULT_GLOBALS)
        self._value = self._resolve_name()
        self.encoding = encoding

    @property
    def local_name(self):
        return self.name.replace(_LOCAL_TAG, '')

    def __unicode__(self):
        return pprint_thing(self.name)

    def __call__(self, *args, **kwargs):
        return self.value

    def evaluate(self, *args, **kwargs):
        return self

    def _resolve_name(self):
        res = self.env.resolve(self.local_name, is_local=self.is_local)
        self.update(res)

        if hasattr(res, 'ndim') and res.ndim > 2:
            raise NotImplementedError("N-dimensional objects, where N > 2,"
                                      " are not supported with eval")
        return res

    def update(self, value):
        """
        search order for local (i.e., @variable) variables:

        scope, key_variable
        [('locals', 'local_name'),
         ('globals', 'local_name'),
         ('locals', 'key'),
         ('globals', 'key')]
        """
        key = self.name

        # if it's a variable name (otherwise a constant)
        if isinstance(key, string_types):
            self.env.swapkey(self.local_name, key, new_value=value)

        self.value = value

    @property
    def isscalar(self):
        return is_scalar(self._value)

    @property
    def type(self):
        try:
            # potentially very slow for large, mixed dtype frames
            return self._value.values.dtype
        except AttributeError:
            try:
                # ndarray
                return self._value.dtype
            except AttributeError:
                # scalar
                return type(self._value)

    return_type = type

    @property
    def raw(self):
        return pprint_thing('{0}(name={1!r}, type={2})'
                            ''.format(self.__class__.__name__, self.name,
                                      self.type))

    @property
    def is_datetime(self):
        try:
            t = self.type.type
        except AttributeError:
            t = self.type

        return issubclass(t, (datetime, np.datetime64))

    @property
    def value(self):
        return self._value

    @value.setter
    def value(self, new_value):
        self._value = new_value

    @property
    def name(self):
        return self._name

    @name.setter
    def name(self, new_name):
        self._name = new_name

    @property
    def ndim(self):
        return self._value.ndim


class Constant(Term):

    def __init__(self, value, env, side=None, encoding=None):
        super(Constant, self).__init__(value, env, side=side,
                                       encoding=encoding)

    def _resolve_name(self):
        return self._name

    @property
    def name(self):
        return self.value

    def __unicode__(self):
        # in python 2 str() of float
        # can truncate shorter than repr()
        return repr(self.name)


_bool_op_map = {'not': '~', 'and': '&', 'or': '|'}


class Op(StringMixin):

    """Hold an operator of arbitrary arity
    """

    def __init__(self, op, operands, *args, **kwargs):
        self.op = _bool_op_map.get(op, op)
        self.operands = operands
        self.encoding = kwargs.get('encoding', None)

    def __iter__(self):
        return iter(self.operands)

    def __unicode__(self):
        """Print a generic n-ary operator and its operands using infix
        notation"""
        # recurse over the operands
        parened = ('({0})'.format(pprint_thing(opr))
                   for opr in self.operands)
        return pprint_thing(' {0} '.format(self.op).join(parened))

    @property
    def return_type(self):
        # clobber types to bool if the op is a boolean operator
        if self.op in (_cmp_ops_syms + _bool_ops_syms):
            return np.bool_
        return _result_type_many(*(term.type for term in com.flatten(self)))

    @property
    def has_invalid_return_type(self):
        types = self.operand_types
        obj_dtype_set = frozenset([np.dtype('object')])
        return self.return_type == object and types - obj_dtype_set

    @property
    def operand_types(self):
        return frozenset(term.type for term in com.flatten(self))

    @property
    def isscalar(self):
        return all(operand.isscalar for operand in self.operands)

    @property
    def is_datetime(self):
        try:
            t = self.return_type.type
        except AttributeError:
            t = self.return_type

        return issubclass(t, (datetime, np.datetime64))


def _in(x, y):
    """Compute the vectorized membership of ``x in y`` if possible, otherwise
    use Python.
    """
    try:
        return x.isin(y)
    except AttributeError:
        if is_list_like(x):
            try:
                return y.isin(x)
            except AttributeError:
                pass
        return x in y


def _not_in(x, y):
    """Compute the vectorized membership of ``x not in y`` if possible,
    otherwise use Python.
    """
    try:
        return ~x.isin(y)
    except AttributeError:
        if is_list_like(x):
            try:
                return ~y.isin(x)
            except AttributeError:
                pass
        return x not in y


_cmp_ops_syms = '>', '<', '>=', '<=', '==', '!=', 'in', 'not in'
_cmp_ops_funcs = op.gt, op.lt, op.ge, op.le, op.eq, op.ne, _in, _not_in
_cmp_ops_dict = dict(zip(_cmp_ops_syms, _cmp_ops_funcs))

_bool_ops_syms = '&', '|', 'and', 'or'
_bool_ops_funcs = op.and_, op.or_, op.and_, op.or_
_bool_ops_dict = dict(zip(_bool_ops_syms, _bool_ops_funcs))

_arith_ops_syms = '+', '-', '*', '/', '**', '//', '%'
_arith_ops_funcs = (op.add, op.sub, op.mul, op.truediv if PY3 else op.div,
                    op.pow, op.floordiv, op.mod)
_arith_ops_dict = dict(zip(_arith_ops_syms, _arith_ops_funcs))

_special_case_arith_ops_syms = '**', '//', '%'
_special_case_arith_ops_funcs = op.pow, op.floordiv, op.mod
_special_case_arith_ops_dict = dict(zip(_special_case_arith_ops_syms,
                                        _special_case_arith_ops_funcs))

_binary_ops_dict = {}

for d in (_cmp_ops_dict, _bool_ops_dict, _arith_ops_dict):
    _binary_ops_dict.update(d)


def _cast_inplace(terms, acceptable_dtypes, dtype):
    """Cast an expression inplace.

    Parameters
    ----------
    terms : Op
        The expression that should cast.
    acceptable_dtypes : list of acceptable numpy.dtype
        Will not cast if term's dtype in this list.

        .. versionadded:: 0.19.0

    dtype : str or numpy.dtype
        The dtype to cast to.
    """
    dt = np.dtype(dtype)
    for term in terms:
        if term.type in acceptable_dtypes:
            continue

        try:
            new_value = term.value.astype(dt)
        except AttributeError:
            new_value = dt.type(term.value)
        term.update(new_value)


def is_term(obj):
    return isinstance(obj, Term)


class BinOp(Op):

    """Hold a binary operator and its operands

    Parameters
    ----------
    op : str
    left : Term or Op
    right : Term or Op
    """

    def __init__(self, op, lhs, rhs, **kwargs):
        super(BinOp, self).__init__(op, (lhs, rhs))
        self.lhs = lhs
        self.rhs = rhs

        self._disallow_scalar_only_bool_ops()

        self.convert_values()

        try:
            self.func = _binary_ops_dict[op]
        except KeyError:
            # has to be made a list for python3
            keys = list(_binary_ops_dict.keys())
            raise ValueError('Invalid binary operator {0!r}, valid'
                             ' operators are {1}'.format(op, keys))

    def __call__(self, env):
        """Recursively evaluate an expression in Python space.

        Parameters
        ----------
        env : Scope

        Returns
        -------
        object
            The result of an evaluated expression.
        """
        # handle truediv
        if self.op == '/' and env.scope['truediv']:
            self.func = op.truediv

        # recurse over the left/right nodes
        left = self.lhs(env)
        right = self.rhs(env)

        return self.func(left, right)

    def evaluate(self, env, engine, parser, term_type, eval_in_python):
        """Evaluate a binary operation *before* being passed to the engine.

        Parameters
        ----------
        env : Scope
        engine : str
        parser : str
        term_type : type
        eval_in_python : list

        Returns
        -------
        term_type
            The "pre-evaluated" expression as an instance of ``term_type``
        """
        if engine == 'python':
            res = self(env)
        else:
            # recurse over the left/right nodes
            left = self.lhs.evaluate(env, engine=engine, parser=parser,
                                     term_type=term_type,
                                     eval_in_python=eval_in_python)
            right = self.rhs.evaluate(env, engine=engine, parser=parser,
                                      term_type=term_type,
                                      eval_in_python=eval_in_python)

            # base cases
            if self.op in eval_in_python:
                res = self.func(left.value, right.value)
            else:
                res = pd.eval(self, local_dict=env, engine=engine,
                              parser=parser)

        name = env.add_tmp(res)
        return term_type(name, env=env)

    def convert_values(self):
        """Convert datetimes to a comparable value in an expression.
        """
        def stringify(value):
            if self.encoding is not None:
                encoder = partial(pprint_thing_encoded,
                                  encoding=self.encoding)
            else:
                encoder = pprint_thing
            return encoder(value)

        lhs, rhs = self.lhs, self.rhs

        if is_term(lhs) and lhs.is_datetime and is_term(rhs) and rhs.isscalar:
            v = rhs.value
            if isinstance(v, (int, float)):
                v = stringify(v)
            v = pd.Timestamp(_ensure_decoded(v))
            if v.tz is not None:
                v = v.tz_convert('UTC')
            self.rhs.update(v)

        if is_term(rhs) and rhs.is_datetime and is_term(lhs) and lhs.isscalar:
            v = lhs.value
            if isinstance(v, (int, float)):
                v = stringify(v)
            v = pd.Timestamp(_ensure_decoded(v))
            if v.tz is not None:
                v = v.tz_convert('UTC')
            self.lhs.update(v)

    def _disallow_scalar_only_bool_ops(self):
        if ((self.lhs.isscalar or self.rhs.isscalar) and
            self.op in _bool_ops_dict and
            (not (issubclass(self.rhs.return_type, (bool, np.bool_)) and
                  issubclass(self.lhs.return_type, (bool, np.bool_))))):
            raise NotImplementedError("cannot evaluate scalar only bool ops")


def isnumeric(dtype):
    return issubclass(np.dtype(dtype).type, np.number)


class Div(BinOp):

    """Div operator to special case casting.

    Parameters
    ----------
    lhs, rhs : Term or Op
        The Terms or Ops in the ``/`` expression.
    truediv : bool
        Whether or not to use true division. With Python 3 this happens
        regardless of the value of ``truediv``.
    """

    def __init__(self, lhs, rhs, truediv, *args, **kwargs):
        super(Div, self).__init__('/', lhs, rhs, *args, **kwargs)

        if not isnumeric(lhs.return_type) or not isnumeric(rhs.return_type):
            raise TypeError("unsupported operand type(s) for {0}:"
                            " '{1}' and '{2}'".format(self.op,
                                                      lhs.return_type,
                                                      rhs.return_type))

        if truediv or PY3:
            # do not upcast float32s to float64 un-necessarily
            acceptable_dtypes = [np.float32, np.float_]
            _cast_inplace(com.flatten(self), acceptable_dtypes, np.float_)


_unary_ops_syms = '+', '-', '~', 'not'
_unary_ops_funcs = op.pos, op.neg, op.invert, op.invert
_unary_ops_dict = dict(zip(_unary_ops_syms, _unary_ops_funcs))


class UnaryOp(Op):

    """Hold a unary operator and its operands

    Parameters
    ----------
    op : str
        The token used to represent the operator.
    operand : Term or Op
        The Term or Op operand to the operator.

    Raises
    ------
    ValueError
        * If no function associated with the passed operator token is found.
    """

    def __init__(self, op, operand):
        super(UnaryOp, self).__init__(op, (operand,))
        self.operand = operand

        try:
            self.func = _unary_ops_dict[op]
        except KeyError:
            raise ValueError('Invalid unary operator {0!r}, valid operators '
                             'are {1}'.format(op, _unary_ops_syms))

    def __call__(self, env):
        operand = self.operand(env)
        return self.func(operand)

    def __unicode__(self):
        return pprint_thing('{0}({1})'.format(self.op, self.operand))

    @property
    def return_type(self):
        operand = self.operand
        if operand.return_type == np.dtype('bool'):
            return np.dtype('bool')
        if (isinstance(operand, Op) and
                (operand.op in _cmp_ops_dict or operand.op in _bool_ops_dict)):
            return np.dtype('bool')
        return np.dtype('int')


class MathCall(Op):

    def __init__(self, func, args):
        super(MathCall, self).__init__(func.name, args)
        self.func = func

    def __call__(self, env):
        operands = [op(env) for op in self.operands]
        with np.errstate(all='ignore'):
            return self.func.func(*operands)

    def __unicode__(self):
        operands = map(str, self.operands)
        return pprint_thing('{0}({1})'.format(self.op, ','.join(operands)))


class FuncNode(object):

    def __init__(self, name):
        if name not in _mathops:
            raise ValueError(
                "\"{0}\" is not a supported function".format(name))
        self.name = name
        self.func = getattr(np, name)

    def __call__(self, *args):
        return MathCall(self, args)
