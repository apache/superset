#!/usr/bin/env python

"""Top level ``eval`` module.
"""

import warnings
import tokenize
from pandas.io.formats.printing import pprint_thing
from pandas.core.computation import _NUMEXPR_INSTALLED
from pandas.core.computation.expr import Expr, _parsers, tokenize_string
from pandas.core.computation.scope import _ensure_scope
from pandas.compat import string_types
from pandas.core.computation.engines import _engines
from pandas.util._validators import validate_bool_kwarg


def _check_engine(engine):
    """Make sure a valid engine is passed.

    Parameters
    ----------
    engine : str

    Raises
    ------
    KeyError
      * If an invalid engine is passed
    ImportError
      * If numexpr was requested but doesn't exist

    Returns
    -------
    string engine

    """

    if engine is None:
        if _NUMEXPR_INSTALLED:
            engine = 'numexpr'
        else:
            engine = 'python'

    if engine not in _engines:
        raise KeyError('Invalid engine {0!r} passed, valid engines are'
                       ' {1}'.format(engine, list(_engines.keys())))

    # TODO: validate this in a more general way (thinking of future engines
    # that won't necessarily be import-able)
    # Could potentially be done on engine instantiation
    if engine == 'numexpr':
        if not _NUMEXPR_INSTALLED:
            raise ImportError("'numexpr' is not installed or an "
                              "unsupported version. Cannot use "
                              "engine='numexpr' for query/eval "
                              "if 'numexpr' is not installed")

    return engine


def _check_parser(parser):
    """Make sure a valid parser is passed.

    Parameters
    ----------
    parser : str

    Raises
    ------
    KeyError
      * If an invalid parser is passed
    """
    if parser not in _parsers:
        raise KeyError('Invalid parser {0!r} passed, valid parsers are'
                       ' {1}'.format(parser, _parsers.keys()))


def _check_resolvers(resolvers):
    if resolvers is not None:
        for resolver in resolvers:
            if not hasattr(resolver, '__getitem__'):
                name = type(resolver).__name__
                raise TypeError('Resolver of type %r does not implement '
                                'the __getitem__ method' % name)


def _check_expression(expr):
    """Make sure an expression is not an empty string

    Parameters
    ----------
    expr : object
        An object that can be converted to a string

    Raises
    ------
    ValueError
      * If expr is an empty string
    """
    if not expr:
        raise ValueError("expr cannot be an empty string")


def _convert_expression(expr):
    """Convert an object to an expression.

    Thus function converts an object to an expression (a unicode string) and
    checks to make sure it isn't empty after conversion. This is used to
    convert operators to their string representation for recursive calls to
    :func:`~pandas.eval`.

    Parameters
    ----------
    expr : object
        The object to be converted to a string.

    Returns
    -------
    s : unicode
        The string representation of an object.

    Raises
    ------
    ValueError
      * If the expression is empty.
    """
    s = pprint_thing(expr)
    _check_expression(s)
    return s


def _check_for_locals(expr, stack_level, parser):
    at_top_of_stack = stack_level == 0
    not_pandas_parser = parser != 'pandas'

    if not_pandas_parser:
        msg = "The '@' prefix is only supported by the pandas parser"
    elif at_top_of_stack:
        msg = ("The '@' prefix is not allowed in "
               "top-level eval calls, \nplease refer to "
               "your variables by name without the '@' "
               "prefix")

    if at_top_of_stack or not_pandas_parser:
        for toknum, tokval in tokenize_string(expr):
            if toknum == tokenize.OP and tokval == '@':
                raise SyntaxError(msg)


def eval(expr, parser='pandas', engine=None, truediv=True,
         local_dict=None, global_dict=None, resolvers=(), level=0,
         target=None, inplace=None):
    """Evaluate a Python expression as a string using various backends.

    The following arithmetic operations are supported: ``+``, ``-``, ``*``,
    ``/``, ``**``, ``%``, ``//`` (python engine only) along with the following
    boolean operations: ``|`` (or), ``&`` (and), and ``~`` (not).
    Additionally, the ``'pandas'`` parser allows the use of :keyword:`and`,
    :keyword:`or`, and :keyword:`not` with the same semantics as the
    corresponding bitwise operators.  :class:`~pandas.Series` and
    :class:`~pandas.DataFrame` objects are supported and behave as they would
    with plain ol' Python evaluation.

    Parameters
    ----------
    expr : str or unicode
        The expression to evaluate. This string cannot contain any Python
        `statements
        <http://docs.python.org/2/reference/simple_stmts.html#simple-statements>`__,
        only Python `expressions
        <http://docs.python.org/2/reference/simple_stmts.html#expression-statements>`__.
    parser : string, default 'pandas', {'pandas', 'python'}
        The parser to use to construct the syntax tree from the expression. The
        default of ``'pandas'`` parses code slightly different than standard
        Python. Alternatively, you can parse an expression using the
        ``'python'`` parser to retain strict Python semantics.  See the
        :ref:`enhancing performance <enhancingperf.eval>` documentation for
        more details.
    engine : string or None, default 'numexpr', {'python', 'numexpr'}

        The engine used to evaluate the expression. Supported engines are

        - None         : tries to use ``numexpr``, falls back to ``python``
        - ``'numexpr'``: This default engine evaluates pandas objects using
                         numexpr for large speed ups in complex expressions
                         with large frames.
        - ``'python'``: Performs operations as if you had ``eval``'d in top
                        level python. This engine is generally not that useful.

        More backends may be available in the future.

    truediv : bool, optional
        Whether to use true division, like in Python >= 3
    local_dict : dict or None, optional
        A dictionary of local variables, taken from locals() by default.
    global_dict : dict or None, optional
        A dictionary of global variables, taken from globals() by default.
    resolvers : list of dict-like or None, optional
        A list of objects implementing the ``__getitem__`` special method that
        you can use to inject an additional collection of namespaces to use for
        variable lookup. For example, this is used in the
        :meth:`~pandas.DataFrame.query` method to inject the
        :attr:`~pandas.DataFrame.index` and :attr:`~pandas.DataFrame.columns`
        variables that refer to their respective :class:`~pandas.DataFrame`
        instance attributes.
    level : int, optional
        The number of prior stack frames to traverse and add to the current
        scope. Most users will **not** need to change this parameter.
    target : a target object for assignment, optional, default is None
        essentially this is a passed in resolver
    inplace : bool, default True
        If expression mutates, whether to modify object inplace or return
        copy with mutation.

        WARNING: inplace=None currently falls back to to True, but
        in a future version, will default to False.  Use inplace=True
        explicitly rather than relying on the default.

    Returns
    -------
    ndarray, numeric scalar, DataFrame, Series

    Notes
    -----
    The ``dtype`` of any objects involved in an arithmetic ``%`` operation are
    recursively cast to ``float64``.

    See the :ref:`enhancing performance <enhancingperf.eval>` documentation for
    more details.

    See Also
    --------
    pandas.DataFrame.query
    pandas.DataFrame.eval
    """
    inplace = validate_bool_kwarg(inplace, 'inplace')
    first_expr = True
    if isinstance(expr, string_types):
        _check_expression(expr)
        exprs = [e.strip() for e in expr.splitlines() if e.strip() != '']
    else:
        exprs = [expr]
    multi_line = len(exprs) > 1

    if multi_line and target is None:
        raise ValueError("multi-line expressions are only valid in the "
                         "context of data, use DataFrame.eval")

    first_expr = True
    for expr in exprs:
        expr = _convert_expression(expr)
        engine = _check_engine(engine)
        _check_parser(parser)
        _check_resolvers(resolvers)
        _check_for_locals(expr, level, parser)

        # get our (possibly passed-in) scope
        env = _ensure_scope(level + 1, global_dict=global_dict,
                            local_dict=local_dict, resolvers=resolvers,
                            target=target)

        parsed_expr = Expr(expr, engine=engine, parser=parser, env=env,
                           truediv=truediv)

        # construct the engine and evaluate the parsed expression
        eng = _engines[engine]
        eng_inst = eng(parsed_expr)
        ret = eng_inst.evaluate()

        if parsed_expr.assigner is None and multi_line:
            raise ValueError("Multi-line expressions are only valid"
                             " if all expressions contain an assignment")

        # assign if needed
        if env.target is not None and parsed_expr.assigner is not None:
            if inplace is None:
                warnings.warn(
                    "eval expressions containing an assignment currently"
                    "default to operating inplace.\nThis will change in "
                    "a future version of pandas, use inplace=True to "
                    "avoid this warning.",
                    FutureWarning, stacklevel=3)
                inplace = True

            # if returning a copy, copy only on the first assignment
            if not inplace and first_expr:
                target = env.target.copy()
            else:
                target = env.target

            target[parsed_expr.assigner] = ret

            if not resolvers:
                resolvers = ({parsed_expr.assigner: ret},)
            else:
                # existing resolver needs updated to handle
                # case of mutating existing column in copy
                for resolver in resolvers:
                    if parsed_expr.assigner in resolver:
                        resolver[parsed_expr.assigner] = ret
                        break
                else:
                    resolvers += ({parsed_expr.assigner: ret},)

            ret = None
            first_expr = False

    if not inplace and inplace is not None:
        return target

    return ret
