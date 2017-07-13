import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.sql.expression import (
    _literal_as_text,
    ClauseElement,
    ColumnElement,
    Executable,
    FunctionElement
)
from sqlalchemy.sql.functions import GenericFunction

from .functions.orm import quote


class explain(Executable, ClauseElement):
    """
    Define EXPLAIN element.

    http://www.postgresql.org/docs/devel/static/sql-explain.html
    """
    def __init__(
        self,
        stmt,
        analyze=False,
        verbose=False,
        costs=True,
        buffers=False,
        timing=True,
        format='text'
    ):
        self.statement = _literal_as_text(stmt)
        self.analyze = analyze
        self.verbose = verbose
        self.costs = costs
        self.buffers = buffers
        self.timing = timing
        self.format = format


class explain_analyze(explain):
    def __init__(self, stmt, **kwargs):
        super(explain_analyze, self).__init__(
            stmt,
            analyze=True,
            **kwargs
        )


@compiles(explain, 'postgresql')
def pg_explain(element, compiler, **kw):
    text = "EXPLAIN "
    options = []
    if element.analyze:
        options.append('ANALYZE true')
    if not element.timing:
        options.append('TIMING false')
    if element.buffers:
        options.append('BUFFERS true')
    if element.format != 'text':
        options.append('FORMAT %s' % element.format)
    if element.verbose:
        options.append('VERBOSE true')
    if not element.costs:
        options.append('COSTS false')
    if options:
        text += '(%s) ' % ', '.join(options)
    text += compiler.process(element.statement)
    return text


class array_get(FunctionElement):
    name = 'array_get'


@compiles(array_get)
def compile_array_get(element, compiler, **kw):
    args = list(element.clauses)
    if len(args) != 2:
        raise Exception(
            "Function 'array_get' expects two arguments (%d given)." %
            len(args)
        )

    if not hasattr(args[1], 'value') or not isinstance(args[1].value, int):
        raise Exception(
            "Second argument should be an integer."
        )
    return '(%s)[%s]' % (
        compiler.process(args[0]),
        sa.text(str(args[1].value + 1))
    )


class row_to_json(GenericFunction):
    name = 'row_to_json'
    type = postgresql.JSON


@compiles(row_to_json, 'postgresql')
def compile_row_to_json(element, compiler, **kw):
    return "%s(%s)" % (element.name, compiler.process(element.clauses))


class json_array_length(GenericFunction):
    name = 'json_array_length'
    type = sa.Integer


@compiles(json_array_length, 'postgresql')
def compile_json_array_length(element, compiler, **kw):
    return "%s(%s)" % (element.name, compiler.process(element.clauses))


class array_agg(GenericFunction):
    name = 'array_agg'
    type = postgresql.ARRAY

    def __init__(self, arg, default=None, **kw):
        self.type = postgresql.ARRAY(arg.type)
        self.default = default
        GenericFunction.__init__(self, arg, **kw)


@compiles(array_agg, 'postgresql')
def compile_array_agg(element, compiler, **kw):
    compiled = "%s(%s)" % (element.name, compiler.process(element.clauses))
    if element.default is None:
        return compiled
    return str(sa.func.coalesce(
        sa.text(compiled),
        sa.cast(postgresql.array(element.default), element.type)
    ).compile(compiler))


class Asterisk(ColumnElement):
    def __init__(self, selectable):
        self.selectable = selectable


@compiles(Asterisk)
def compile_asterisk(element, compiler, **kw):
    return '%s.*' % quote(compiler.dialect, element.selectable.name)
