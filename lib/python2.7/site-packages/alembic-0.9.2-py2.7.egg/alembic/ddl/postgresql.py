import re

from ..util import compat
from .. import util
from .base import compiles, alter_column, alter_table, format_table_name, \
    format_type, AlterColumn, RenameTable
from .impl import DefaultImpl
from sqlalchemy.dialects.postgresql import INTEGER, BIGINT
from ..autogenerate import render
from sqlalchemy import text, Numeric, Column
from sqlalchemy.types import NULLTYPE
from sqlalchemy import types as sqltypes

from ..operations.base import Operations
from ..operations.base import BatchOperations
from ..operations import ops
from ..util import sqla_compat
from ..operations import schemaobj
from ..autogenerate import render

import logging

if util.sqla_08:
    from sqlalchemy.sql.expression import UnaryExpression
else:
    from sqlalchemy.sql.expression import _UnaryExpression as UnaryExpression

if util.sqla_100:
    from sqlalchemy.dialects.postgresql import ExcludeConstraint


log = logging.getLogger(__name__)


class PostgresqlImpl(DefaultImpl):
    __dialect__ = 'postgresql'
    transactional_ddl = True

    def prep_table_for_batch(self, table):
        for constraint in table.constraints:
            if constraint.name is not None:
                self.drop_constraint(constraint)

    def compare_server_default(self, inspector_column,
                               metadata_column,
                               rendered_metadata_default,
                               rendered_inspector_default):
        # don't do defaults for SERIAL columns
        if metadata_column.primary_key and \
                metadata_column is metadata_column.table._autoincrement_column:
            return False

        conn_col_default = rendered_inspector_default

        defaults_equal = conn_col_default == rendered_metadata_default
        if defaults_equal:
            return False

        if None in (conn_col_default, rendered_metadata_default):
            return not defaults_equal

        if metadata_column.server_default is not None and \
            isinstance(metadata_column.server_default.arg,
                       compat.string_types) and \
                not re.match(r"^'.+'$", rendered_metadata_default) and \
                not isinstance(inspector_column.type, Numeric):
                # don't single quote if the column type is float/numeric,
                # otherwise a comparison such as SELECT 5 = '5.0' will fail
            rendered_metadata_default = re.sub(
                r"^u?'?|'?$", "'", rendered_metadata_default)

        return not self.connection.scalar(
            "SELECT %s = %s" % (
                conn_col_default,
                rendered_metadata_default
            )
        )

    def alter_column(self, table_name, column_name,
                     nullable=None,
                     server_default=False,
                     name=None,
                     type_=None,
                     schema=None,
                     autoincrement=None,
                     existing_type=None,
                     existing_server_default=None,
                     existing_nullable=None,
                     existing_autoincrement=None,
                     **kw
                     ):

        using = kw.pop('postgresql_using', None)

        if using is not None and type_ is None:
            raise util.CommandError(
                "postgresql_using must be used with the type_ parameter")

        if type_ is not None:
            self._exec(PostgresqlColumnType(
                table_name, column_name, type_, schema=schema,
                using=using, existing_type=existing_type,
                existing_server_default=existing_server_default,
                existing_nullable=existing_nullable,
            ))

        super(PostgresqlImpl, self).alter_column(
            table_name, column_name,
            nullable=nullable,
            server_default=server_default,
            name=name,
            schema=schema,
            autoincrement=autoincrement,
            existing_type=existing_type,
            existing_server_default=existing_server_default,
            existing_nullable=existing_nullable,
            existing_autoincrement=existing_autoincrement,
            **kw)

    def autogen_column_reflect(self, inspector, table, column_info):
        if column_info.get('default') and \
                isinstance(column_info['type'], (INTEGER, BIGINT)):
            seq_match = re.match(
                r"nextval\('(.+?)'::regclass\)",
                column_info['default'])
            if seq_match:
                info = inspector.bind.execute(text(
                    "select c.relname, a.attname "
                    "from pg_class as c join pg_depend d on d.objid=c.oid and "
                    "d.classid='pg_class'::regclass and "
                    "d.refclassid='pg_class'::regclass "
                    "join pg_class t on t.oid=d.refobjid "
                    "join pg_attribute a on a.attrelid=t.oid and "
                    "a.attnum=d.refobjsubid "
                    "where c.relkind='S' and c.relname=:seqname"
                ), seqname=seq_match.group(1)).first()
                if info:
                    seqname, colname = info
                    if colname == column_info['name']:
                        log.info(
                            "Detected sequence named '%s' as "
                            "owned by integer column '%s(%s)', "
                            "assuming SERIAL and omitting",
                            seqname, table.name, colname)
                        # sequence, and the owner is this column,
                        # its a SERIAL - whack it!
                        del column_info['default']

    def correct_for_autogen_constraints(self, conn_unique_constraints,
                                        conn_indexes,
                                        metadata_unique_constraints,
                                        metadata_indexes):
        conn_uniques_by_name = dict(
            (c.name, c) for c in conn_unique_constraints)
        conn_indexes_by_name = dict(
            (c.name, c) for c in conn_indexes)

        # TODO: if SQLA 1.0, make use of "duplicates_constraint"
        # metadata
        doubled_constraints = dict(
            (name, (conn_uniques_by_name[name], conn_indexes_by_name[name]))
            for name in set(conn_uniques_by_name).intersection(
                conn_indexes_by_name)
        )
        for name, (uq, ix) in doubled_constraints.items():
            conn_indexes.remove(ix)

        for idx in list(metadata_indexes):
            if idx.name in conn_indexes_by_name:
                continue
            if util.sqla_08:
                exprs = idx.expressions
            else:
                exprs = idx.columns
            for expr in exprs:
                while isinstance(expr, UnaryExpression):
                    expr = expr.element
                if not isinstance(expr, Column):
                    util.warn(
                        "autogenerate skipping functional index %s; "
                        "not supported by SQLAlchemy reflection" % idx.name
                    )
                    metadata_indexes.discard(idx)

    def render_type(self, type_, autogen_context):
        if hasattr(self, '_render_%s_type' % type_.__visit_name__):
            meth = getattr(self, '_render_%s_type' % type_.__visit_name__)
            return meth(type_, autogen_context)

        return False

    def _render_type_w_subtype(self, type_, autogen_context, attrname, regexp):
        outer_repr = repr(type_)
        inner_type = getattr(type_, attrname, None)
        if inner_type is None:
            return False

        inner_repr = repr(inner_type)

        inner_repr = re.sub(r'([\(\)])', r'\\\1', inner_repr)
        sub_type = render._repr_type(getattr(type_, attrname), autogen_context)
        outer_type = re.sub(
            regexp + inner_repr,
            r"\1%s" % sub_type, outer_repr)
        return "%s.%s" % ("postgresql", outer_type)

    def _render_ARRAY_type(self, type_, autogen_context):
        return self._render_type_w_subtype(
            type_, autogen_context, 'item_type', r'(.+?\()'
        )

    def _render_JSON_type(self, type_, autogen_context):
        return self._render_type_w_subtype(
            type_, autogen_context, 'astext_type', r'(.+?\(.*astext_type=)'
        )

    def _render_JSONB_type(self, type_, autogen_context):
        return self._render_type_w_subtype(
            type_, autogen_context, 'astext_type', r'(.+?\(.*astext_type=)'
        )


class PostgresqlColumnType(AlterColumn):

    def __init__(self, name, column_name, type_, **kw):
        using = kw.pop('using', None)
        super(PostgresqlColumnType, self).__init__(name, column_name, **kw)
        self.type_ = sqltypes.to_instance(type_)
        self.using = using


@compiles(RenameTable, "postgresql")
def visit_rename_table(element, compiler, **kw):
    return "%s RENAME TO %s" % (
        alter_table(compiler, element.table_name, element.schema),
        format_table_name(compiler, element.new_table_name, None)
    )


@compiles(PostgresqlColumnType, "postgresql")
def visit_column_type(element, compiler, **kw):
    return "%s %s %s %s" % (
        alter_table(compiler, element.table_name, element.schema),
        alter_column(compiler, element.column_name),
        "TYPE %s" % format_type(compiler, element.type_),
        "USING %s" % element.using if element.using else ""
    )


@Operations.register_operation("create_exclude_constraint")
@BatchOperations.register_operation(
    "create_exclude_constraint", "batch_create_exclude_constraint")
@ops.AddConstraintOp.register_add_constraint("exclude_constraint")
class CreateExcludeConstraintOp(ops.AddConstraintOp):
    """Represent a create exclude constraint operation."""

    constraint_type = "exclude"

    def __init__(
            self, constraint_name, table_name,
            elements, where=None, schema=None,
            _orig_constraint=None, **kw):
        self.constraint_name = constraint_name
        self.table_name = table_name
        self.elements = elements
        self.where = where
        self.schema = schema
        self._orig_constraint = _orig_constraint
        self.kw = kw

    @classmethod
    def from_constraint(cls, constraint):
        constraint_table = sqla_compat._table_for_constraint(constraint)

        return cls(
            constraint.name,
            constraint_table.name,
            [(expr, op) for expr, name, op in constraint._render_exprs],
            where=constraint.where,
            schema=constraint_table.schema,
            _orig_constraint=constraint,
            deferrable=constraint.deferrable,
            initially=constraint.initially,
            using=constraint.using
        )

    def to_constraint(self, migration_context=None):
        if not util.sqla_100:
            raise NotImplementedError(
                "ExcludeConstraint not supported until SQLAlchemy 1.0")
        if self._orig_constraint is not None:
            return self._orig_constraint
        schema_obj = schemaobj.SchemaObjects(migration_context)
        t = schema_obj.table(self.table_name, schema=self.schema)
        excl = ExcludeConstraint(
            *self.elements,
            name=self.constraint_name,
            where=self.where,
            **self.kw
        )
        for expr, name, oper in excl._render_exprs:
            t.append_column(Column(name, NULLTYPE))
        t.append_constraint(excl)
        return excl

    @classmethod
    def create_exclude_constraint(
            cls, operations,
            constraint_name, table_name, *elements, **kw):
        """Issue an alter to create an EXCLUDE constraint using the
        current migration context.

        .. note::  This method is Postgresql specific, and additionally
           requires at least SQLAlchemy 1.0.

        e.g.::

            from alembic import op

            op.create_exclude_constraint(
                "user_excl",
                "user",

                ("period", '&&'),
                ("group", '='),
                where=("group != 'some group'")

            )

        Note that the expressions work the same way as that of
        the ``ExcludeConstraint`` object itself; if plain strings are
        passed, quoting rules must be applied manually.

        :param name: Name of the constraint.
        :param table_name: String name of the source table.
        :param elements: exclude conditions.
        :param where: SQL expression or SQL string with optional WHERE
         clause.
        :param deferrable: optional bool. If set, emit DEFERRABLE or
         NOT DEFERRABLE when issuing DDL for this constraint.
        :param initially: optional string. If set, emit INITIALLY <value>
         when issuing DDL for this constraint.
        :param schema: Optional schema name to operate within.

        .. versionadded:: 0.9.0

        """
        op = cls(constraint_name, table_name, elements, **kw)
        return operations.invoke(op)

    @classmethod
    def batch_create_exclude_constraint(
            cls, operations, constraint_name, *elements, **kw):
        """Issue a "create exclude constraint" instruction using the
        current batch migration context.

        .. note::  This method is Postgresql specific, and additionally
           requires at least SQLAlchemy 1.0.

        .. versionadded:: 0.9.0

        .. seealso::

            :meth:`.Operations.create_exclude_constraint`

        """
        kw['schema'] = operations.impl.schema
        op = cls(constraint_name, operations.impl.table_name, elements, **kw)
        return operations.invoke(op)


@render.renderers.dispatch_for(CreateExcludeConstraintOp)
def _add_exclude_constraint(autogen_context, op):
    return _exclude_constraint(
        op.to_constraint(),
        autogen_context,
        alter=True
    )

if util.sqla_100:
    @render._constraint_renderers.dispatch_for(ExcludeConstraint)
    def _render_inline_exclude_constraint(constraint, autogen_context):
        rendered = render._user_defined_render(
            "exclude", constraint, autogen_context)
        if rendered is not False:
            return rendered

        return _exclude_constraint(constraint, autogen_context, False)


def _postgresql_autogenerate_prefix(autogen_context):

    imports = autogen_context.imports
    if imports is not None:
        imports.add("from sqlalchemy.dialects import postgresql")
    return "postgresql."


def _exclude_constraint(constraint, autogen_context, alter):
    opts = []

    has_batch = autogen_context._has_batch

    if constraint.deferrable:
        opts.append(("deferrable", str(constraint.deferrable)))
    if constraint.initially:
        opts.append(("initially", str(constraint.initially)))
    if constraint.using:
        opts.append(("using", str(constraint.using)))
    if not has_batch and alter and constraint.table.schema:
        opts.append(("schema", render._ident(constraint.table.schema)))
    if not alter and constraint.name:
        opts.append(
            ("name",
             render._render_gen_name(autogen_context, constraint.name)))

    if alter:
        args = [
            repr(render._render_gen_name(
                autogen_context, constraint.name))]
        if not has_batch:
            args += [repr(render._ident(constraint.table.name))]
        args.extend([
            "(%s, %r)" % (
                render._render_potential_expr(
                    sqltext, autogen_context, wrap_in_text=False),
                opstring
            )
            for sqltext, name, opstring in constraint._render_exprs
        ])
        if constraint.where is not None:
            args.append(
                "where=%s" % render._render_potential_expr(
                    constraint.where, autogen_context)
            )
        args.extend(["%s=%r" % (k, v) for k, v in opts])
        return "%(prefix)screate_exclude_constraint(%(args)s)" % {
            'prefix': render._alembic_autogenerate_prefix(autogen_context),
            'args': ", ".join(args)
        }
    else:
        args = [
            "(%s, %r)" % (
                render._render_potential_expr(
                    sqltext, autogen_context, wrap_in_text=False),
                opstring
            ) for sqltext, name, opstring in constraint._render_exprs
        ]
        if constraint.where is not None:
            args.append(
                "where=%s" % render._render_potential_expr(
                    constraint.where, autogen_context)
            )
        args.extend(["%s=%r" % (k, v) for k, v in opts])
        return "%(prefix)sExcludeConstraint(%(args)s)" % {
            "prefix": _postgresql_autogenerate_prefix(autogen_context),
            "args": ", ".join(args)
        }
