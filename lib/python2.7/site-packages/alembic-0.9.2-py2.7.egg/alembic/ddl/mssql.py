from sqlalchemy.ext.compiler import compiles

from .. import util
from .impl import DefaultImpl
from .base import alter_table, AddColumn, ColumnName, RenameTable,\
    format_table_name, format_column_name, ColumnNullable, alter_column,\
    format_server_default, ColumnDefault, format_type, ColumnType
from sqlalchemy.sql.expression import ClauseElement, Executable


class MSSQLImpl(DefaultImpl):
    __dialect__ = 'mssql'
    transactional_ddl = True
    batch_separator = "GO"

    def __init__(self, *arg, **kw):
        super(MSSQLImpl, self).__init__(*arg, **kw)
        self.batch_separator = self.context_opts.get(
            "mssql_batch_separator",
            self.batch_separator)

    def _exec(self, construct, *args, **kw):
        result = super(MSSQLImpl, self)._exec(construct, *args, **kw)
        if self.as_sql and self.batch_separator:
            self.static_output(self.batch_separator)
        return result

    def emit_begin(self):
        self.static_output("BEGIN TRANSACTION" + self.command_terminator)

    def emit_commit(self):
        super(MSSQLImpl, self).emit_commit()
        if self.as_sql and self.batch_separator:
            self.static_output(self.batch_separator)

    def alter_column(self, table_name, column_name,
                     nullable=None,
                     server_default=False,
                     name=None,
                     type_=None,
                     schema=None,
                     existing_type=None,
                     existing_server_default=None,
                     existing_nullable=None,
                     **kw
                     ):

        if nullable is not None and existing_type is None:
            if type_ is not None:
                existing_type = type_
                # the NULL/NOT NULL alter will handle
                # the type alteration
                type_ = None
            else:
                raise util.CommandError(
                    "MS-SQL ALTER COLUMN operations "
                    "with NULL or NOT NULL require the "
                    "existing_type or a new type_ be passed.")

        super(MSSQLImpl, self).alter_column(
            table_name, column_name,
            nullable=nullable,
            type_=type_,
            schema=schema,
            existing_type=existing_type,
            existing_nullable=existing_nullable,
            **kw
        )

        if server_default is not False:
            if existing_server_default is not False or \
                    server_default is None:
                self._exec(
                    _ExecDropConstraint(
                        table_name, column_name,
                        'sys.default_constraints')
                )
            if server_default is not None:
                super(MSSQLImpl, self).alter_column(
                    table_name, column_name,
                    schema=schema,
                    server_default=server_default)

        if name is not None:
            super(MSSQLImpl, self).alter_column(
                table_name, column_name,
                schema=schema,
                name=name)

    def bulk_insert(self, table, rows, **kw):
        if self.as_sql:
            self._exec(
                "SET IDENTITY_INSERT %s ON" %
                self.dialect.identifier_preparer.format_table(table)
            )
            super(MSSQLImpl, self).bulk_insert(table, rows, **kw)
            self._exec(
                "SET IDENTITY_INSERT %s OFF" %
                self.dialect.identifier_preparer.format_table(table)
            )
        else:
            super(MSSQLImpl, self).bulk_insert(table, rows, **kw)

    def drop_column(self, table_name, column, **kw):
        drop_default = kw.pop('mssql_drop_default', False)
        if drop_default:
            self._exec(
                _ExecDropConstraint(
                    table_name, column,
                    'sys.default_constraints')
            )
        drop_check = kw.pop('mssql_drop_check', False)
        if drop_check:
            self._exec(
                _ExecDropConstraint(
                    table_name, column,
                    'sys.check_constraints')
            )
        drop_fks = kw.pop('mssql_drop_foreign_key', False)
        if drop_fks:
            self._exec(
                _ExecDropFKConstraint(table_name, column)
            )
        super(MSSQLImpl, self).drop_column(table_name, column, **kw)


class _ExecDropConstraint(Executable, ClauseElement):

    def __init__(self, tname, colname, type_):
        self.tname = tname
        self.colname = colname
        self.type_ = type_


class _ExecDropFKConstraint(Executable, ClauseElement):

    def __init__(self, tname, colname):
        self.tname = tname
        self.colname = colname


@compiles(_ExecDropConstraint, 'mssql')
def _exec_drop_col_constraint(element, compiler, **kw):
    tname, colname, type_ = element.tname, element.colname, element.type_
    # from http://www.mssqltips.com/sqlservertip/1425/\
    # working-with-default-constraints-in-sql-server/
    # TODO: needs table formatting, etc.
    return """declare @const_name varchar(256)
select @const_name = [name] from %(type)s
where parent_object_id = object_id('%(tname)s')
and col_name(parent_object_id, parent_column_id) = '%(colname)s'
exec('alter table %(tname_quoted)s drop constraint ' + @const_name)""" % {
        'type': type_,
        'tname': tname,
        'colname': colname,
        'tname_quoted': format_table_name(compiler, tname, None),
    }


@compiles(_ExecDropFKConstraint, 'mssql')
def _exec_drop_col_fk_constraint(element, compiler, **kw):
    tname, colname = element.tname, element.colname

    return """declare @const_name varchar(256)
select @const_name = [name] from
    sys.foreign_keys fk join sys.foreign_key_columns fkc
    on fk.object_id=fkc.constraint_object_id
where fkc.parent_object_id = object_id('%(tname)s')
and col_name(fkc.parent_object_id, fkc.parent_column_id) = '%(colname)s'
exec('alter table %(tname_quoted)s drop constraint ' + @const_name)""" % {
        'tname': tname,
        'colname': colname,
        'tname_quoted': format_table_name(compiler, tname, None),
    }


@compiles(AddColumn, 'mssql')
def visit_add_column(element, compiler, **kw):
    return "%s %s" % (
        alter_table(compiler, element.table_name, element.schema),
        mssql_add_column(compiler, element.column, **kw)
    )


def mssql_add_column(compiler, column, **kw):
    return "ADD %s" % compiler.get_column_specification(column, **kw)


@compiles(ColumnNullable, 'mssql')
def visit_column_nullable(element, compiler, **kw):
    return "%s %s %s %s" % (
        alter_table(compiler, element.table_name, element.schema),
        alter_column(compiler, element.column_name),
        format_type(compiler, element.existing_type),
        "NULL" if element.nullable else "NOT NULL"
    )


@compiles(ColumnDefault, 'mssql')
def visit_column_default(element, compiler, **kw):
    # TODO: there can also be a named constraint
    # with ADD CONSTRAINT here
    return "%s ADD DEFAULT %s FOR %s" % (
        alter_table(compiler, element.table_name, element.schema),
        format_server_default(compiler, element.default),
        format_column_name(compiler, element.column_name)
    )


@compiles(ColumnName, 'mssql')
def visit_rename_column(element, compiler, **kw):
    return "EXEC sp_rename '%s.%s', %s, 'COLUMN'" % (
        format_table_name(compiler, element.table_name, element.schema),
        format_column_name(compiler, element.column_name),
        format_column_name(compiler, element.newname)
    )


@compiles(ColumnType, 'mssql')
def visit_column_type(element, compiler, **kw):
    return "%s %s %s" % (
        alter_table(compiler, element.table_name, element.schema),
        alter_column(compiler, element.column_name),
        format_type(compiler, element.type_)
    )


@compiles(RenameTable, 'mssql')
def visit_rename_table(element, compiler, **kw):
    return "EXEC sp_rename '%s', %s" % (
        format_table_name(compiler, element.table_name, element.schema),
        format_table_name(compiler, element.new_table_name, None)
    )
