from sqlalchemy.ext.compiler import compiles

from .impl import DefaultImpl
from .base import alter_table, AddColumn, ColumnName, \
    format_column_name, ColumnNullable, \
    format_server_default, ColumnDefault, format_type, ColumnType


class OracleImpl(DefaultImpl):
    __dialect__ = 'oracle'
    transactional_ddl = False
    batch_separator = "/"
    command_terminator = ""

    def __init__(self, *arg, **kw):
        super(OracleImpl, self).__init__(*arg, **kw)
        self.batch_separator = self.context_opts.get(
            "oracle_batch_separator",
            self.batch_separator)

    def _exec(self, construct, *args, **kw):
        result = super(OracleImpl, self)._exec(construct, *args, **kw)
        if self.as_sql and self.batch_separator:
            self.static_output(self.batch_separator)
        return result

    def emit_begin(self):
        self._exec("SET TRANSACTION READ WRITE")

    def emit_commit(self):
        self._exec("COMMIT")


@compiles(AddColumn, 'oracle')
def visit_add_column(element, compiler, **kw):
    return "%s %s" % (
        alter_table(compiler, element.table_name, element.schema),
        add_column(compiler, element.column, **kw),
    )


@compiles(ColumnNullable, 'oracle')
def visit_column_nullable(element, compiler, **kw):
    return "%s %s %s" % (
        alter_table(compiler, element.table_name, element.schema),
        alter_column(compiler, element.column_name),
        "NULL" if element.nullable else "NOT NULL"
    )


@compiles(ColumnType, 'oracle')
def visit_column_type(element, compiler, **kw):
    return "%s %s %s" % (
        alter_table(compiler, element.table_name, element.schema),
        alter_column(compiler, element.column_name),
        "%s" % format_type(compiler, element.type_)
    )


@compiles(ColumnName, 'oracle')
def visit_column_name(element, compiler, **kw):
    return "%s RENAME COLUMN %s TO %s" % (
        alter_table(compiler, element.table_name, element.schema),
        format_column_name(compiler, element.column_name),
        format_column_name(compiler, element.newname)
    )


@compiles(ColumnDefault, 'oracle')
def visit_column_default(element, compiler, **kw):
    return "%s %s %s" % (
        alter_table(compiler, element.table_name, element.schema),
        alter_column(compiler, element.column_name),
        "DEFAULT %s" %
        format_server_default(compiler, element.default)
        if element.default is not None
        else "DEFAULT NULL"
    )


def alter_column(compiler, name):
    return 'MODIFY %s' % format_column_name(compiler, name)


def add_column(compiler, column, **kw):
    return "ADD %s" % compiler.get_column_specification(column, **kw)
