from .. import util
from ..util import sqla_compat
from . import schemaobj
from sqlalchemy.types import NULLTYPE
from .base import Operations, BatchOperations
import re


class MigrateOperation(object):
    """base class for migration command and organization objects.

    This system is part of the operation extensibility API.

    .. versionadded:: 0.8.0

    .. seealso::

        :ref:`operation_objects`

        :ref:`operation_plugins`

        :ref:`customizing_revision`

    """

    @util.memoized_property
    def info(self):
        """A dictionary that may be used to store arbitrary information
        along with this :class:`.MigrateOperation` object.

        """
        return {}


class AddConstraintOp(MigrateOperation):
    """Represent an add constraint operation."""

    add_constraint_ops = util.Dispatcher()

    @property
    def constraint_type(self):
        raise NotImplementedError()

    @classmethod
    def register_add_constraint(cls, type_):
        def go(klass):
            cls.add_constraint_ops.dispatch_for(type_)(klass.from_constraint)
            return klass
        return go

    @classmethod
    def from_constraint(cls, constraint):
        return cls.add_constraint_ops.dispatch(
            constraint.__visit_name__)(constraint)

    def reverse(self):
        return DropConstraintOp.from_constraint(self.to_constraint())

    def to_diff_tuple(self):
        return ("add_constraint", self.to_constraint())


@Operations.register_operation("drop_constraint")
@BatchOperations.register_operation("drop_constraint", "batch_drop_constraint")
class DropConstraintOp(MigrateOperation):
    """Represent a drop constraint operation."""

    def __init__(
            self,
            constraint_name, table_name, type_=None, schema=None,
            _orig_constraint=None):
        self.constraint_name = constraint_name
        self.table_name = table_name
        self.constraint_type = type_
        self.schema = schema
        self._orig_constraint = _orig_constraint

    def reverse(self):
        if self._orig_constraint is None:
            raise ValueError(
                "operation is not reversible; "
                "original constraint is not present")
        return AddConstraintOp.from_constraint(self._orig_constraint)

    def to_diff_tuple(self):
        if self.constraint_type == "foreignkey":
            return ("remove_fk", self.to_constraint())
        else:
            return ("remove_constraint", self.to_constraint())

    @classmethod
    def from_constraint(cls, constraint):
        types = {
            "unique_constraint": "unique",
            "foreign_key_constraint": "foreignkey",
            "primary_key_constraint": "primary",
            "check_constraint": "check",
            "column_check_constraint": "check",
        }

        constraint_table = sqla_compat._table_for_constraint(constraint)
        return cls(
            constraint.name,
            constraint_table.name,
            schema=constraint_table.schema,
            type_=types[constraint.__visit_name__],
            _orig_constraint=constraint
        )

    def to_constraint(self):
        if self._orig_constraint is not None:
            return self._orig_constraint
        else:
            raise ValueError(
                "constraint cannot be produced; "
                "original constraint is not present")

    @classmethod
    @util._with_legacy_names([
        ("type", "type_"),
        ("name", "constraint_name"),
    ])
    def drop_constraint(
            cls, operations, constraint_name, table_name,
            type_=None, schema=None):
        """Drop a constraint of the given name, typically via DROP CONSTRAINT.

        :param constraint_name: name of the constraint.
        :param table_name: table name.
        :param type_: optional, required on MySQL.  can be
         'foreignkey', 'primary', 'unique', or 'check'.
        :param schema: Optional schema name to operate within.  To control
         quoting of the schema outside of the default behavior, use
         the SQLAlchemy construct
         :class:`~sqlalchemy.sql.elements.quoted_name`.

         .. versionadded:: 0.7.0 'schema' can now accept a
            :class:`~sqlalchemy.sql.elements.quoted_name` construct.

        .. versionchanged:: 0.8.0 The following positional argument names
           have been changed:

           * name -> constraint_name

        """

        op = cls(constraint_name, table_name, type_=type_, schema=schema)
        return operations.invoke(op)

    @classmethod
    def batch_drop_constraint(cls, operations, constraint_name, type_=None):
        """Issue a "drop constraint" instruction using the
        current batch migration context.

        The batch form of this call omits the ``table_name`` and ``schema``
        arguments from the call.

        .. seealso::

            :meth:`.Operations.drop_constraint`

        .. versionchanged:: 0.8.0 The following positional argument names
           have been changed:

           * name -> constraint_name

        """
        op = cls(
            constraint_name, operations.impl.table_name,
            type_=type_, schema=operations.impl.schema
        )
        return operations.invoke(op)


@Operations.register_operation("create_primary_key")
@BatchOperations.register_operation(
    "create_primary_key", "batch_create_primary_key")
@AddConstraintOp.register_add_constraint("primary_key_constraint")
class CreatePrimaryKeyOp(AddConstraintOp):
    """Represent a create primary key operation."""

    constraint_type = "primarykey"

    def __init__(
            self, constraint_name, table_name, columns,
            schema=None, _orig_constraint=None, **kw):
        self.constraint_name = constraint_name
        self.table_name = table_name
        self.columns = columns
        self.schema = schema
        self._orig_constraint = _orig_constraint
        self.kw = kw

    @classmethod
    def from_constraint(cls, constraint):
        constraint_table = sqla_compat._table_for_constraint(constraint)

        return cls(
            constraint.name,
            constraint_table.name,
            constraint.columns,
            schema=constraint_table.schema,
            _orig_constraint=constraint
        )

    def to_constraint(self, migration_context=None):
        if self._orig_constraint is not None:
            return self._orig_constraint

        schema_obj = schemaobj.SchemaObjects(migration_context)
        return schema_obj.primary_key_constraint(
            self.constraint_name, self.table_name,
            self.columns, schema=self.schema)

    @classmethod
    @util._with_legacy_names([
        ('name', 'constraint_name'),
        ('cols', 'columns')
    ])
    def create_primary_key(
            cls, operations,
            constraint_name, table_name, columns, schema=None):
        """Issue a "create primary key" instruction using the current
        migration context.

        e.g.::

            from alembic import op
            op.create_primary_key(
                        "pk_my_table", "my_table",
                        ["id", "version"]
                    )

        This internally generates a :class:`~sqlalchemy.schema.Table` object
        containing the necessary columns, then generates a new
        :class:`~sqlalchemy.schema.PrimaryKeyConstraint`
        object which it then associates with the
        :class:`~sqlalchemy.schema.Table`.
        Any event listeners associated with this action will be fired
        off normally.   The :class:`~sqlalchemy.schema.AddConstraint`
        construct is ultimately used to generate the ALTER statement.

        :param name: Name of the primary key constraint.  The name is necessary
         so that an ALTER statement can be emitted.  For setups that
         use an automated naming scheme such as that described at
         :ref:`sqla:constraint_naming_conventions`
         ``name`` here can be ``None``, as the event listener will
         apply the name to the constraint object when it is associated
         with the table.
        :param table_name: String name of the target table.
        :param columns: a list of string column names to be applied to the
         primary key constraint.
        :param schema: Optional schema name to operate within.  To control
         quoting of the schema outside of the default behavior, use
         the SQLAlchemy construct
         :class:`~sqlalchemy.sql.elements.quoted_name`.

         .. versionadded:: 0.7.0 'schema' can now accept a
            :class:`~sqlalchemy.sql.elements.quoted_name` construct.

        .. versionchanged:: 0.8.0 The following positional argument names
           have been changed:

           * name -> constraint_name
           * cols -> columns

        """
        op = cls(constraint_name, table_name, columns, schema)
        return operations.invoke(op)

    @classmethod
    def batch_create_primary_key(cls, operations, constraint_name, columns):
        """Issue a "create primary key" instruction using the
        current batch migration context.

        The batch form of this call omits the ``table_name`` and ``schema``
        arguments from the call.

        .. seealso::

            :meth:`.Operations.create_primary_key`

        """
        op = cls(
            constraint_name, operations.impl.table_name, columns,
            schema=operations.impl.schema
        )
        return operations.invoke(op)


@Operations.register_operation("create_unique_constraint")
@BatchOperations.register_operation(
    "create_unique_constraint", "batch_create_unique_constraint")
@AddConstraintOp.register_add_constraint("unique_constraint")
class CreateUniqueConstraintOp(AddConstraintOp):
    """Represent a create unique constraint operation."""

    constraint_type = "unique"

    def __init__(
            self, constraint_name, table_name,
            columns, schema=None, _orig_constraint=None, **kw):
        self.constraint_name = constraint_name
        self.table_name = table_name
        self.columns = columns
        self.schema = schema
        self._orig_constraint = _orig_constraint
        self.kw = kw

    @classmethod
    def from_constraint(cls, constraint):
        constraint_table = sqla_compat._table_for_constraint(constraint)

        kw = {}
        if constraint.deferrable:
            kw['deferrable'] = constraint.deferrable
        if constraint.initially:
            kw['initially'] = constraint.initially

        return cls(
            constraint.name,
            constraint_table.name,
            [c.name for c in constraint.columns],
            schema=constraint_table.schema,
            _orig_constraint=constraint,
            **kw
        )

    def to_constraint(self, migration_context=None):
        if self._orig_constraint is not None:
            return self._orig_constraint

        schema_obj = schemaobj.SchemaObjects(migration_context)
        return schema_obj.unique_constraint(
            self.constraint_name, self.table_name, self.columns,
            schema=self.schema, **self.kw)

    @classmethod
    @util._with_legacy_names([
        ('name', 'constraint_name'),
        ('source', 'table_name'),
        ('local_cols', 'columns'),
    ])
    def create_unique_constraint(
            cls, operations, constraint_name, table_name, columns,
            schema=None, **kw):
        """Issue a "create unique constraint" instruction using the
        current migration context.

        e.g.::

            from alembic import op
            op.create_unique_constraint("uq_user_name", "user", ["name"])

        This internally generates a :class:`~sqlalchemy.schema.Table` object
        containing the necessary columns, then generates a new
        :class:`~sqlalchemy.schema.UniqueConstraint`
        object which it then associates with the
        :class:`~sqlalchemy.schema.Table`.
        Any event listeners associated with this action will be fired
        off normally.   The :class:`~sqlalchemy.schema.AddConstraint`
        construct is ultimately used to generate the ALTER statement.

        :param name: Name of the unique constraint.  The name is necessary
         so that an ALTER statement can be emitted.  For setups that
         use an automated naming scheme such as that described at
         :ref:`sqla:constraint_naming_conventions`,
         ``name`` here can be ``None``, as the event listener will
         apply the name to the constraint object when it is associated
         with the table.
        :param table_name: String name of the source table.
        :param columns: a list of string column names in the
         source table.
        :param deferrable: optional bool. If set, emit DEFERRABLE or
         NOT DEFERRABLE when issuing DDL for this constraint.
        :param initially: optional string. If set, emit INITIALLY <value>
         when issuing DDL for this constraint.
        :param schema: Optional schema name to operate within.  To control
         quoting of the schema outside of the default behavior, use
         the SQLAlchemy construct
         :class:`~sqlalchemy.sql.elements.quoted_name`.

         .. versionadded:: 0.7.0 'schema' can now accept a
            :class:`~sqlalchemy.sql.elements.quoted_name` construct.

        .. versionchanged:: 0.8.0 The following positional argument names
           have been changed:

           * name -> constraint_name
           * source -> table_name
           * local_cols -> columns

        """

        op = cls(
            constraint_name, table_name, columns,
            schema=schema, **kw
        )
        return operations.invoke(op)

    @classmethod
    @util._with_legacy_names([('name', 'constraint_name')])
    def batch_create_unique_constraint(
            cls, operations, constraint_name, columns, **kw):
        """Issue a "create unique constraint" instruction using the
        current batch migration context.

        The batch form of this call omits the ``source`` and ``schema``
        arguments from the call.

        .. seealso::

            :meth:`.Operations.create_unique_constraint`

        .. versionchanged:: 0.8.0 The following positional argument names
           have been changed:

           * name -> constraint_name

        """
        kw['schema'] = operations.impl.schema
        op = cls(
            constraint_name, operations.impl.table_name, columns,
            **kw
        )
        return operations.invoke(op)


@Operations.register_operation("create_foreign_key")
@BatchOperations.register_operation(
    "create_foreign_key", "batch_create_foreign_key")
@AddConstraintOp.register_add_constraint("foreign_key_constraint")
class CreateForeignKeyOp(AddConstraintOp):
    """Represent a create foreign key constraint operation."""

    constraint_type = "foreignkey"

    def __init__(
            self, constraint_name, source_table, referent_table, local_cols,
            remote_cols, _orig_constraint=None, **kw):
        self.constraint_name = constraint_name
        self.source_table = source_table
        self.referent_table = referent_table
        self.local_cols = local_cols
        self.remote_cols = remote_cols
        self._orig_constraint = _orig_constraint
        self.kw = kw

    def to_diff_tuple(self):
        return ("add_fk", self.to_constraint())

    @classmethod
    def from_constraint(cls, constraint):
        kw = {}
        if constraint.onupdate:
            kw['onupdate'] = constraint.onupdate
        if constraint.ondelete:
            kw['ondelete'] = constraint.ondelete
        if constraint.initially:
            kw['initially'] = constraint.initially
        if constraint.deferrable:
            kw['deferrable'] = constraint.deferrable
        if constraint.use_alter:
            kw['use_alter'] = constraint.use_alter

        source_schema, source_table, \
            source_columns, target_schema, \
            target_table, target_columns,\
            onupdate, ondelete, deferrable, initially \
            = sqla_compat._fk_spec(constraint)

        kw['source_schema'] = source_schema
        kw['referent_schema'] = target_schema

        return cls(
            constraint.name,
            source_table,
            target_table,
            source_columns,
            target_columns,
            _orig_constraint=constraint,
            **kw
        )

    def to_constraint(self, migration_context=None):
        if self._orig_constraint is not None:
            return self._orig_constraint
        schema_obj = schemaobj.SchemaObjects(migration_context)
        return schema_obj.foreign_key_constraint(
            self.constraint_name,
            self.source_table, self.referent_table,
            self.local_cols, self.remote_cols,
            **self.kw)

    @classmethod
    @util._with_legacy_names([
        ('name', 'constraint_name'),
        ('source', 'source_table'),
        ('referent', 'referent_table'),
    ])
    def create_foreign_key(cls, operations, constraint_name,
                           source_table, referent_table, local_cols,
                           remote_cols, onupdate=None, ondelete=None,
                           deferrable=None, initially=None, match=None,
                           source_schema=None, referent_schema=None,
                           **dialect_kw):
        """Issue a "create foreign key" instruction using the
        current migration context.

        e.g.::

            from alembic import op
            op.create_foreign_key(
                        "fk_user_address", "address",
                        "user", ["user_id"], ["id"])

        This internally generates a :class:`~sqlalchemy.schema.Table` object
        containing the necessary columns, then generates a new
        :class:`~sqlalchemy.schema.ForeignKeyConstraint`
        object which it then associates with the
        :class:`~sqlalchemy.schema.Table`.
        Any event listeners associated with this action will be fired
        off normally.   The :class:`~sqlalchemy.schema.AddConstraint`
        construct is ultimately used to generate the ALTER statement.

        :param name: Name of the foreign key constraint.  The name is necessary
         so that an ALTER statement can be emitted.  For setups that
         use an automated naming scheme such as that described at
         :ref:`sqla:constraint_naming_conventions`,
         ``name`` here can be ``None``, as the event listener will
         apply the name to the constraint object when it is associated
         with the table.
        :param source_table: String name of the source table.
        :param referent_table: String name of the destination table.
        :param local_cols: a list of string column names in the
         source table.
        :param remote_cols: a list of string column names in the
         remote table.
        :param onupdate: Optional string. If set, emit ON UPDATE <value> when
         issuing DDL for this constraint. Typical values include CASCADE,
         DELETE and RESTRICT.
        :param ondelete: Optional string. If set, emit ON DELETE <value> when
         issuing DDL for this constraint. Typical values include CASCADE,
         DELETE and RESTRICT.
        :param deferrable: optional bool. If set, emit DEFERRABLE or NOT
         DEFERRABLE when issuing DDL for this constraint.
        :param source_schema: Optional schema name of the source table.
        :param referent_schema: Optional schema name of the destination table.

        .. versionchanged:: 0.8.0 The following positional argument names
           have been changed:

           * name -> constraint_name
           * source -> source_table
           * referent -> referent_table

        """

        op = cls(
            constraint_name,
            source_table, referent_table,
            local_cols, remote_cols,
            onupdate=onupdate, ondelete=ondelete,
            deferrable=deferrable,
            source_schema=source_schema,
            referent_schema=referent_schema,
            initially=initially, match=match,
            **dialect_kw
        )
        return operations.invoke(op)

    @classmethod
    @util._with_legacy_names([
        ('name', 'constraint_name'),
        ('referent', 'referent_table')
    ])
    def batch_create_foreign_key(
            cls, operations, constraint_name, referent_table,
            local_cols, remote_cols,
            referent_schema=None,
            onupdate=None, ondelete=None,
            deferrable=None, initially=None, match=None,
            **dialect_kw):
        """Issue a "create foreign key" instruction using the
        current batch migration context.

        The batch form of this call omits the ``source`` and ``source_schema``
        arguments from the call.

        e.g.::

            with batch_alter_table("address") as batch_op:
                batch_op.create_foreign_key(
                            "fk_user_address",
                            "user", ["user_id"], ["id"])

        .. seealso::

            :meth:`.Operations.create_foreign_key`

        .. versionchanged:: 0.8.0 The following positional argument names
           have been changed:

           * name -> constraint_name
           * referent -> referent_table

        """
        op = cls(
            constraint_name,
            operations.impl.table_name, referent_table,
            local_cols, remote_cols,
            onupdate=onupdate, ondelete=ondelete,
            deferrable=deferrable,
            source_schema=operations.impl.schema,
            referent_schema=referent_schema,
            initially=initially, match=match,
            **dialect_kw
        )
        return operations.invoke(op)


@Operations.register_operation("create_check_constraint")
@BatchOperations.register_operation(
    "create_check_constraint", "batch_create_check_constraint")
@AddConstraintOp.register_add_constraint("check_constraint")
@AddConstraintOp.register_add_constraint("column_check_constraint")
class CreateCheckConstraintOp(AddConstraintOp):
    """Represent a create check constraint operation."""

    constraint_type = "check"

    def __init__(
            self, constraint_name, table_name,
            condition, schema=None, _orig_constraint=None, **kw):
        self.constraint_name = constraint_name
        self.table_name = table_name
        self.condition = condition
        self.schema = schema
        self._orig_constraint = _orig_constraint
        self.kw = kw

    @classmethod
    def from_constraint(cls, constraint):
        constraint_table = sqla_compat._table_for_constraint(constraint)

        return cls(
            constraint.name,
            constraint_table.name,
            constraint.sqltext,
            schema=constraint_table.schema,
            _orig_constraint=constraint
        )

    def to_constraint(self, migration_context=None):
        if self._orig_constraint is not None:
            return self._orig_constraint
        schema_obj = schemaobj.SchemaObjects(migration_context)
        return schema_obj.check_constraint(
            self.constraint_name, self.table_name,
            self.condition, schema=self.schema, **self.kw)

    @classmethod
    @util._with_legacy_names([
        ('name', 'constraint_name'),
        ('source', 'table_name')
    ])
    def create_check_constraint(
            cls, operations,
            constraint_name, table_name, condition,
            schema=None, **kw):
        """Issue a "create check constraint" instruction using the
        current migration context.

        e.g.::

            from alembic import op
            from sqlalchemy.sql import column, func

            op.create_check_constraint(
                "ck_user_name_len",
                "user",
                func.len(column('name')) > 5
            )

        CHECK constraints are usually against a SQL expression, so ad-hoc
        table metadata is usually needed.   The function will convert the given
        arguments into a :class:`sqlalchemy.schema.CheckConstraint` bound
        to an anonymous table in order to emit the CREATE statement.

        :param name: Name of the check constraint.  The name is necessary
         so that an ALTER statement can be emitted.  For setups that
         use an automated naming scheme such as that described at
         :ref:`sqla:constraint_naming_conventions`,
         ``name`` here can be ``None``, as the event listener will
         apply the name to the constraint object when it is associated
         with the table.
        :param table_name: String name of the source table.
        :param condition: SQL expression that's the condition of the
         constraint. Can be a string or SQLAlchemy expression language
         structure.
        :param deferrable: optional bool. If set, emit DEFERRABLE or
         NOT DEFERRABLE when issuing DDL for this constraint.
        :param initially: optional string. If set, emit INITIALLY <value>
         when issuing DDL for this constraint.
        :param schema: Optional schema name to operate within.  To control
         quoting of the schema outside of the default behavior, use
         the SQLAlchemy construct
         :class:`~sqlalchemy.sql.elements.quoted_name`.

         .. versionadded:: 0.7.0 'schema' can now accept a
            :class:`~sqlalchemy.sql.elements.quoted_name` construct.

        .. versionchanged:: 0.8.0 The following positional argument names
           have been changed:

           * name -> constraint_name
           * source -> table_name

        """
        op = cls(constraint_name, table_name, condition, schema=schema, **kw)
        return operations.invoke(op)

    @classmethod
    @util._with_legacy_names([('name', 'constraint_name')])
    def batch_create_check_constraint(
            cls, operations, constraint_name, condition, **kw):
        """Issue a "create check constraint" instruction using the
        current batch migration context.

        The batch form of this call omits the ``source`` and ``schema``
        arguments from the call.

        .. seealso::

            :meth:`.Operations.create_check_constraint`

        .. versionchanged:: 0.8.0 The following positional argument names
           have been changed:

           * name -> constraint_name

        """
        op = cls(
            constraint_name, operations.impl.table_name,
            condition, schema=operations.impl.schema, **kw)
        return operations.invoke(op)


@Operations.register_operation("create_index")
@BatchOperations.register_operation("create_index", "batch_create_index")
class CreateIndexOp(MigrateOperation):
    """Represent a create index operation."""

    def __init__(
            self, index_name, table_name, columns, schema=None,
            unique=False, _orig_index=None, **kw):
        self.index_name = index_name
        self.table_name = table_name
        self.columns = columns
        self.schema = schema
        self.unique = unique
        self.kw = kw
        self._orig_index = _orig_index

    def reverse(self):
        return DropIndexOp.from_index(self.to_index())

    def to_diff_tuple(self):
        return ("add_index", self.to_index())

    @classmethod
    def from_index(cls, index):
        return cls(
            index.name,
            index.table.name,
            sqla_compat._get_index_expressions(index),
            schema=index.table.schema,
            unique=index.unique,
            _orig_index=index,
            **index.kwargs
        )

    def to_index(self, migration_context=None):
        if self._orig_index:
            return self._orig_index
        schema_obj = schemaobj.SchemaObjects(migration_context)
        return schema_obj.index(
            self.index_name, self.table_name, self.columns, schema=self.schema,
            unique=self.unique, **self.kw)

    @classmethod
    @util._with_legacy_names([('name', 'index_name')])
    def create_index(
            cls, operations,
            index_name, table_name, columns, schema=None,
            unique=False, **kw):
        """Issue a "create index" instruction using the current
        migration context.

        e.g.::

            from alembic import op
            op.create_index('ik_test', 't1', ['foo', 'bar'])

        Functional indexes can be produced by using the
        :func:`sqlalchemy.sql.expression.text` construct::

            from alembic import op
            from sqlalchemy import text
            op.create_index('ik_test', 't1', [text('lower(foo)')])

        .. versionadded:: 0.6.7 support for making use of the
           :func:`~sqlalchemy.sql.expression.text` construct in
           conjunction with
           :meth:`.Operations.create_index` in
           order to produce functional expressions within CREATE INDEX.

        :param index_name: name of the index.
        :param table_name: name of the owning table.
        :param columns: a list consisting of string column names and/or
         :func:`~sqlalchemy.sql.expression.text` constructs.
        :param schema: Optional schema name to operate within.  To control
         quoting of the schema outside of the default behavior, use
         the SQLAlchemy construct
         :class:`~sqlalchemy.sql.elements.quoted_name`.

         .. versionadded:: 0.7.0 'schema' can now accept a
            :class:`~sqlalchemy.sql.elements.quoted_name` construct.

        :param unique: If True, create a unique index.

        :param quote:
            Force quoting of this column's name on or off, corresponding
            to ``True`` or ``False``. When left at its default
            of ``None``, the column identifier will be quoted according to
            whether the name is case sensitive (identifiers with at least one
            upper case character are treated as case sensitive), or if it's a
            reserved word. This flag is only needed to force quoting of a
            reserved word which is not known by the SQLAlchemy dialect.

        :param \**kw: Additional keyword arguments not mentioned above are
            dialect specific, and passed in the form
            ``<dialectname>_<argname>``.
            See the documentation regarding an individual dialect at
            :ref:`dialect_toplevel` for detail on documented arguments.

        .. versionchanged:: 0.8.0 The following positional argument names
           have been changed:

           * name -> index_name

        """
        op = cls(
            index_name, table_name, columns, schema=schema,
            unique=unique, **kw
        )
        return operations.invoke(op)

    @classmethod
    def batch_create_index(cls, operations, index_name, columns, **kw):
        """Issue a "create index" instruction using the
        current batch migration context.

        .. seealso::

            :meth:`.Operations.create_index`

        """

        op = cls(
            index_name, operations.impl.table_name, columns,
            schema=operations.impl.schema, **kw
        )
        return operations.invoke(op)


@Operations.register_operation("drop_index")
@BatchOperations.register_operation("drop_index", "batch_drop_index")
class DropIndexOp(MigrateOperation):
    """Represent a drop index operation."""

    def __init__(
            self, index_name, table_name=None, schema=None, _orig_index=None):
        self.index_name = index_name
        self.table_name = table_name
        self.schema = schema
        self._orig_index = _orig_index

    def to_diff_tuple(self):
        return ("remove_index", self.to_index())

    def reverse(self):
        if self._orig_index is None:
            raise ValueError(
                "operation is not reversible; "
                "original index is not present")
        return CreateIndexOp.from_index(self._orig_index)

    @classmethod
    def from_index(cls, index):
        return cls(
            index.name,
            index.table.name,
            schema=index.table.schema,
            _orig_index=index
        )

    def to_index(self, migration_context=None):
        if self._orig_index is not None:
            return self._orig_index

        schema_obj = schemaobj.SchemaObjects(migration_context)

        # need a dummy column name here since SQLAlchemy
        # 0.7.6 and further raises on Index with no columns
        return schema_obj.index(
            self.index_name, self.table_name, ['x'], schema=self.schema)

    @classmethod
    @util._with_legacy_names([
        ('name', 'index_name'),
        ('tablename', 'table_name')
    ])
    def drop_index(cls, operations, index_name, table_name=None, schema=None):
        """Issue a "drop index" instruction using the current
        migration context.

        e.g.::

            drop_index("accounts")

        :param index_name: name of the index.
        :param table_name: name of the owning table.  Some
         backends such as Microsoft SQL Server require this.
        :param schema: Optional schema name to operate within.  To control
         quoting of the schema outside of the default behavior, use
         the SQLAlchemy construct
         :class:`~sqlalchemy.sql.elements.quoted_name`.

         .. versionadded:: 0.7.0 'schema' can now accept a
            :class:`~sqlalchemy.sql.elements.quoted_name` construct.

        .. versionchanged:: 0.8.0 The following positional argument names
           have been changed:

           * name -> index_name

        """
        op = cls(index_name, table_name=table_name, schema=schema)
        return operations.invoke(op)

    @classmethod
    @util._with_legacy_names([('name', 'index_name')])
    def batch_drop_index(cls, operations, index_name, **kw):
        """Issue a "drop index" instruction using the
        current batch migration context.

        .. seealso::

            :meth:`.Operations.drop_index`

        .. versionchanged:: 0.8.0 The following positional argument names
           have been changed:

           * name -> index_name

        """

        op = cls(
            index_name, table_name=operations.impl.table_name,
            schema=operations.impl.schema
        )
        return operations.invoke(op)


@Operations.register_operation("create_table")
class CreateTableOp(MigrateOperation):
    """Represent a create table operation."""

    def __init__(
            self, table_name, columns, schema=None, _orig_table=None, **kw):
        self.table_name = table_name
        self.columns = columns
        self.schema = schema
        self.kw = kw
        self._orig_table = _orig_table

    def reverse(self):
        return DropTableOp.from_table(self.to_table())

    def to_diff_tuple(self):
        return ("add_table", self.to_table())

    @classmethod
    def from_table(cls, table):
        return cls(
            table.name,
            list(table.c) + list(table.constraints),
            schema=table.schema,
            _orig_table=table,
            **table.kwargs
        )

    def to_table(self, migration_context=None):
        if self._orig_table is not None:
            return self._orig_table
        schema_obj = schemaobj.SchemaObjects(migration_context)

        return schema_obj.table(
            self.table_name, *self.columns, schema=self.schema, **self.kw
        )

    @classmethod
    @util._with_legacy_names([('name', 'table_name')])
    def create_table(cls, operations, table_name, *columns, **kw):
        """Issue a "create table" instruction using the current migration
        context.

        This directive receives an argument list similar to that of the
        traditional :class:`sqlalchemy.schema.Table` construct, but without the
        metadata::

            from sqlalchemy import INTEGER, VARCHAR, NVARCHAR, Column
            from alembic import op

            op.create_table(
                'account',
                Column('id', INTEGER, primary_key=True),
                Column('name', VARCHAR(50), nullable=False),
                Column('description', NVARCHAR(200)),
                Column('timestamp', TIMESTAMP, server_default=func.now())
            )

        Note that :meth:`.create_table` accepts
        :class:`~sqlalchemy.schema.Column`
        constructs directly from the SQLAlchemy library.  In particular,
        default values to be created on the database side are
        specified using the ``server_default`` parameter, and not
        ``default`` which only specifies Python-side defaults::

            from alembic import op
            from sqlalchemy import Column, TIMESTAMP, func

            # specify "DEFAULT NOW" along with the "timestamp" column
            op.create_table('account',
                Column('id', INTEGER, primary_key=True),
                Column('timestamp', TIMESTAMP, server_default=func.now())
            )

        The function also returns a newly created
        :class:`~sqlalchemy.schema.Table` object, corresponding to the table
        specification given, which is suitable for
        immediate SQL operations, in particular
        :meth:`.Operations.bulk_insert`::

            from sqlalchemy import INTEGER, VARCHAR, NVARCHAR, Column
            from alembic import op

            account_table = op.create_table(
                'account',
                Column('id', INTEGER, primary_key=True),
                Column('name', VARCHAR(50), nullable=False),
                Column('description', NVARCHAR(200)),
                Column('timestamp', TIMESTAMP, server_default=func.now())
            )

            op.bulk_insert(
                account_table,
                [
                    {"name": "A1", "description": "account 1"},
                    {"name": "A2", "description": "account 2"},
                ]
            )

        .. versionadded:: 0.7.0

        :param table_name: Name of the table
        :param \*columns: collection of :class:`~sqlalchemy.schema.Column`
         objects within
         the table, as well as optional :class:`~sqlalchemy.schema.Constraint`
         objects
         and :class:`~.sqlalchemy.schema.Index` objects.
        :param schema: Optional schema name to operate within.  To control
         quoting of the schema outside of the default behavior, use
         the SQLAlchemy construct
         :class:`~sqlalchemy.sql.elements.quoted_name`.

         .. versionadded:: 0.7.0 'schema' can now accept a
            :class:`~sqlalchemy.sql.elements.quoted_name` construct.
        :param \**kw: Other keyword arguments are passed to the underlying
         :class:`sqlalchemy.schema.Table` object created for the command.

        :return: the :class:`~sqlalchemy.schema.Table` object corresponding
         to the parameters given.

         .. versionadded:: 0.7.0 - the :class:`~sqlalchemy.schema.Table`
            object is returned.

        .. versionchanged:: 0.8.0 The following positional argument names
           have been changed:

           * name -> table_name

        """
        op = cls(table_name, columns, **kw)
        return operations.invoke(op)


@Operations.register_operation("drop_table")
class DropTableOp(MigrateOperation):
    """Represent a drop table operation."""

    def __init__(
            self, table_name, schema=None, table_kw=None, _orig_table=None):
        self.table_name = table_name
        self.schema = schema
        self.table_kw = table_kw or {}
        self._orig_table = _orig_table

    def to_diff_tuple(self):
        return ("remove_table", self.to_table())

    def reverse(self):
        if self._orig_table is None:
            raise ValueError(
                "operation is not reversible; "
                "original table is not present")
        return CreateTableOp.from_table(self._orig_table)

    @classmethod
    def from_table(cls, table):
        return cls(table.name, schema=table.schema, _orig_table=table)

    def to_table(self, migration_context=None):
        if self._orig_table is not None:
            return self._orig_table
        schema_obj = schemaobj.SchemaObjects(migration_context)
        return schema_obj.table(
            self.table_name,
            schema=self.schema,
            **self.table_kw)

    @classmethod
    @util._with_legacy_names([('name', 'table_name')])
    def drop_table(cls, operations, table_name, schema=None, **kw):
        """Issue a "drop table" instruction using the current
        migration context.


        e.g.::

            drop_table("accounts")

        :param table_name: Name of the table
        :param schema: Optional schema name to operate within.  To control
         quoting of the schema outside of the default behavior, use
         the SQLAlchemy construct
         :class:`~sqlalchemy.sql.elements.quoted_name`.

         .. versionadded:: 0.7.0 'schema' can now accept a
            :class:`~sqlalchemy.sql.elements.quoted_name` construct.

        :param \**kw: Other keyword arguments are passed to the underlying
         :class:`sqlalchemy.schema.Table` object created for the command.

        .. versionchanged:: 0.8.0 The following positional argument names
           have been changed:

           * name -> table_name

        """
        op = cls(table_name, schema=schema, table_kw=kw)
        operations.invoke(op)


class AlterTableOp(MigrateOperation):
    """Represent an alter table operation."""

    def __init__(self, table_name, schema=None):
        self.table_name = table_name
        self.schema = schema


@Operations.register_operation("rename_table")
class RenameTableOp(AlterTableOp):
    """Represent a rename table operation."""

    def __init__(self, old_table_name, new_table_name, schema=None):
        super(RenameTableOp, self).__init__(old_table_name, schema=schema)
        self.new_table_name = new_table_name

    @classmethod
    def rename_table(
            cls, operations, old_table_name, new_table_name, schema=None):
        """Emit an ALTER TABLE to rename a table.

        :param old_table_name: old name.
        :param new_table_name: new name.
        :param schema: Optional schema name to operate within.  To control
         quoting of the schema outside of the default behavior, use
         the SQLAlchemy construct
         :class:`~sqlalchemy.sql.elements.quoted_name`.

         .. versionadded:: 0.7.0 'schema' can now accept a
            :class:`~sqlalchemy.sql.elements.quoted_name` construct.

        """
        op = cls(old_table_name, new_table_name, schema=schema)
        return operations.invoke(op)


@Operations.register_operation("alter_column")
@BatchOperations.register_operation("alter_column", "batch_alter_column")
class AlterColumnOp(AlterTableOp):
    """Represent an alter column operation."""

    def __init__(
            self, table_name, column_name, schema=None,
            existing_type=None,
            existing_server_default=False,
            existing_nullable=None,
            modify_nullable=None,
            modify_server_default=False,
            modify_name=None,
            modify_type=None,
            **kw

    ):
        super(AlterColumnOp, self).__init__(table_name, schema=schema)
        self.column_name = column_name
        self.existing_type = existing_type
        self.existing_server_default = existing_server_default
        self.existing_nullable = existing_nullable
        self.modify_nullable = modify_nullable
        self.modify_server_default = modify_server_default
        self.modify_name = modify_name
        self.modify_type = modify_type
        self.kw = kw

    def to_diff_tuple(self):
        col_diff = []
        schema, tname, cname = self.schema, self.table_name, self.column_name

        if self.modify_type is not None:
            col_diff.append(
                ("modify_type", schema, tname, cname,
                 {
                     "existing_nullable": self.existing_nullable,
                     "existing_server_default": self.existing_server_default,
                 },
                 self.existing_type,
                 self.modify_type)
            )

        if self.modify_nullable is not None:
            col_diff.append(
                ("modify_nullable", schema, tname, cname,
                    {
                        "existing_type": self.existing_type,
                        "existing_server_default": self.existing_server_default
                    },
                    self.existing_nullable,
                    self.modify_nullable)
            )

        if self.modify_server_default is not False:
            col_diff.append(
                ("modify_default", schema, tname, cname,
                 {
                     "existing_nullable": self.existing_nullable,
                     "existing_type": self.existing_type
                 },
                 self.existing_server_default,
                 self.modify_server_default)
            )

        return col_diff

    def has_changes(self):
        hc1 = self.modify_nullable is not None or \
            self.modify_server_default is not False or \
            self.modify_type is not None
        if hc1:
            return True
        for kw in self.kw:
            if kw.startswith('modify_'):
                return True
        else:
            return False

    def reverse(self):

        kw = self.kw.copy()
        kw['existing_type'] = self.existing_type
        kw['existing_nullable'] = self.existing_nullable
        kw['existing_server_default'] = self.existing_server_default
        if self.modify_type is not None:
            kw['modify_type'] = self.modify_type
        if self.modify_nullable is not None:
            kw['modify_nullable'] = self.modify_nullable
        if self.modify_server_default is not False:
            kw['modify_server_default'] = self.modify_server_default

        # TODO: make this a little simpler
        all_keys = set(m.group(1) for m in [
            re.match(r'^(?:existing_|modify_)(.+)$', k)
            for k in kw
        ] if m)

        for k in all_keys:
            if 'modify_%s' % k in kw:
                swap = kw['existing_%s' % k]
                kw['existing_%s' % k] = kw['modify_%s' % k]
                kw['modify_%s' % k] = swap

        return self.__class__(
            self.table_name, self.column_name, schema=self.schema,
            **kw
        )

    @classmethod
    @util._with_legacy_names([('name', 'new_column_name')])
    def alter_column(
        cls, operations, table_name, column_name,
        nullable=None,
        server_default=False,
        new_column_name=None,
        type_=None,
        existing_type=None,
        existing_server_default=False,
        existing_nullable=None,
        schema=None, **kw
    ):
        """Issue an "alter column" instruction using the
        current migration context.

        Generally, only that aspect of the column which
        is being changed, i.e. name, type, nullability,
        default, needs to be specified.  Multiple changes
        can also be specified at once and the backend should
        "do the right thing", emitting each change either
        separately or together as the backend allows.

        MySQL has special requirements here, since MySQL
        cannot ALTER a column without a full specification.
        When producing MySQL-compatible migration files,
        it is recommended that the ``existing_type``,
        ``existing_server_default``, and ``existing_nullable``
        parameters be present, if not being altered.

        Type changes which are against the SQLAlchemy
        "schema" types :class:`~sqlalchemy.types.Boolean`
        and  :class:`~sqlalchemy.types.Enum` may also
        add or drop constraints which accompany those
        types on backends that don't support them natively.
        The ``existing_type`` argument is
        used in this case to identify and remove a previous
        constraint that was bound to the type object.

        :param table_name: string name of the target table.
        :param column_name: string name of the target column,
         as it exists before the operation begins.
        :param nullable: Optional; specify ``True`` or ``False``
         to alter the column's nullability.
        :param server_default: Optional; specify a string
         SQL expression, :func:`~sqlalchemy.sql.expression.text`,
         or :class:`~sqlalchemy.schema.DefaultClause` to indicate
         an alteration to the column's default value.
         Set to ``None`` to have the default removed.
        :param new_column_name: Optional; specify a string name here to
         indicate the new name within a column rename operation.
        :param type_: Optional; a :class:`~sqlalchemy.types.TypeEngine`
         type object to specify a change to the column's type.
         For SQLAlchemy types that also indicate a constraint (i.e.
         :class:`~sqlalchemy.types.Boolean`, :class:`~sqlalchemy.types.Enum`),
         the constraint is also generated.
        :param autoincrement: set the ``AUTO_INCREMENT`` flag of the column;
         currently understood by the MySQL dialect.
        :param existing_type: Optional; a
         :class:`~sqlalchemy.types.TypeEngine`
         type object to specify the previous type.   This
         is required for all MySQL column alter operations that
         don't otherwise specify a new type, as well as for
         when nullability is being changed on a SQL Server
         column.  It is also used if the type is a so-called
         SQLlchemy "schema" type which may define a constraint (i.e.
         :class:`~sqlalchemy.types.Boolean`,
         :class:`~sqlalchemy.types.Enum`),
         so that the constraint can be dropped.
        :param existing_server_default: Optional; The existing
         default value of the column.   Required on MySQL if
         an existing default is not being changed; else MySQL
         removes the default.
        :param existing_nullable: Optional; the existing nullability
         of the column.  Required on MySQL if the existing nullability
         is not being changed; else MySQL sets this to NULL.
        :param existing_autoincrement: Optional; the existing autoincrement
         of the column.  Used for MySQL's system of altering a column
         that specifies ``AUTO_INCREMENT``.
        :param schema: Optional schema name to operate within.  To control
         quoting of the schema outside of the default behavior, use
         the SQLAlchemy construct
         :class:`~sqlalchemy.sql.elements.quoted_name`.

         .. versionadded:: 0.7.0 'schema' can now accept a
            :class:`~sqlalchemy.sql.elements.quoted_name` construct.

        :param postgresql_using: String argument which will indicate a
         SQL expression to render within the Postgresql-specific USING clause
         within ALTER COLUMN.    This string is taken directly as raw SQL which
         must explicitly include any necessary quoting or escaping of tokens
         within the expression.

         .. versionadded:: 0.8.8

        """

        alt = cls(
            table_name, column_name, schema=schema,
            existing_type=existing_type,
            existing_server_default=existing_server_default,
            existing_nullable=existing_nullable,
            modify_name=new_column_name,
            modify_type=type_,
            modify_server_default=server_default,
            modify_nullable=nullable,
            **kw
        )

        return operations.invoke(alt)

    @classmethod
    def batch_alter_column(
        cls, operations, column_name,
        nullable=None,
        server_default=False,
        new_column_name=None,
        type_=None,
        existing_type=None,
        existing_server_default=False,
        existing_nullable=None,
        **kw
    ):
        """Issue an "alter column" instruction using the current
        batch migration context.

        .. seealso::

            :meth:`.Operations.alter_column`

        """
        alt = cls(
            operations.impl.table_name, column_name,
            schema=operations.impl.schema,
            existing_type=existing_type,
            existing_server_default=existing_server_default,
            existing_nullable=existing_nullable,
            modify_name=new_column_name,
            modify_type=type_,
            modify_server_default=server_default,
            modify_nullable=nullable,
            **kw
        )

        return operations.invoke(alt)


@Operations.register_operation("add_column")
@BatchOperations.register_operation("add_column", "batch_add_column")
class AddColumnOp(AlterTableOp):
    """Represent an add column operation."""

    def __init__(self, table_name, column, schema=None):
        super(AddColumnOp, self).__init__(table_name, schema=schema)
        self.column = column

    def reverse(self):
        return DropColumnOp.from_column_and_tablename(
            self.schema, self.table_name, self.column)

    def to_diff_tuple(self):
        return ("add_column", self.schema, self.table_name, self.column)

    def to_column(self):
        return self.column

    @classmethod
    def from_column(cls, col):
        return cls(col.table.name, col, schema=col.table.schema)

    @classmethod
    def from_column_and_tablename(cls, schema, tname, col):
        return cls(tname, col, schema=schema)

    @classmethod
    def add_column(cls, operations, table_name, column, schema=None):
        """Issue an "add column" instruction using the current
        migration context.

        e.g.::

            from alembic import op
            from sqlalchemy import Column, String

            op.add_column('organization',
                Column('name', String())
            )

        The provided :class:`~sqlalchemy.schema.Column` object can also
        specify a :class:`~sqlalchemy.schema.ForeignKey`, referencing
        a remote table name.  Alembic will automatically generate a stub
        "referenced" table and emit a second ALTER statement in order
        to add the constraint separately::

            from alembic import op
            from sqlalchemy import Column, INTEGER, ForeignKey

            op.add_column('organization',
                Column('account_id', INTEGER, ForeignKey('accounts.id'))
            )

        Note that this statement uses the :class:`~sqlalchemy.schema.Column`
        construct as is from the SQLAlchemy library.  In particular,
        default values to be created on the database side are
        specified using the ``server_default`` parameter, and not
        ``default`` which only specifies Python-side defaults::

            from alembic import op
            from sqlalchemy import Column, TIMESTAMP, func

            # specify "DEFAULT NOW" along with the column add
            op.add_column('account',
                Column('timestamp', TIMESTAMP, server_default=func.now())
            )

        :param table_name: String name of the parent table.
        :param column: a :class:`sqlalchemy.schema.Column` object
         representing the new column.
        :param schema: Optional schema name to operate within.  To control
         quoting of the schema outside of the default behavior, use
         the SQLAlchemy construct
         :class:`~sqlalchemy.sql.elements.quoted_name`.

         .. versionadded:: 0.7.0 'schema' can now accept a
            :class:`~sqlalchemy.sql.elements.quoted_name` construct.


        """

        op = cls(table_name, column, schema=schema)
        return operations.invoke(op)

    @classmethod
    def batch_add_column(cls, operations, column):
        """Issue an "add column" instruction using the current
        batch migration context.

        .. seealso::

            :meth:`.Operations.add_column`

        """
        op = cls(
            operations.impl.table_name, column,
            schema=operations.impl.schema
        )
        return operations.invoke(op)


@Operations.register_operation("drop_column")
@BatchOperations.register_operation("drop_column", "batch_drop_column")
class DropColumnOp(AlterTableOp):
    """Represent a drop column operation."""

    def __init__(
            self, table_name, column_name, schema=None,
            _orig_column=None, **kw):
        super(DropColumnOp, self).__init__(table_name, schema=schema)
        self.column_name = column_name
        self.kw = kw
        self._orig_column = _orig_column

    def to_diff_tuple(self):
        return (
            "remove_column", self.schema, self.table_name, self.to_column())

    def reverse(self):
        if self._orig_column is None:
            raise ValueError(
                "operation is not reversible; "
                "original column is not present")

        return AddColumnOp.from_column_and_tablename(
            self.schema, self.table_name, self._orig_column)

    @classmethod
    def from_column_and_tablename(cls, schema, tname, col):
        return cls(tname, col.name, schema=schema, _orig_column=col)

    def to_column(self, migration_context=None):
        if self._orig_column is not None:
            return self._orig_column
        schema_obj = schemaobj.SchemaObjects(migration_context)
        return schema_obj.column(self.column_name, NULLTYPE)

    @classmethod
    def drop_column(
            cls, operations, table_name, column_name, schema=None, **kw):
        """Issue a "drop column" instruction using the current
        migration context.

        e.g.::

            drop_column('organization', 'account_id')

        :param table_name: name of table
        :param column_name: name of column
        :param schema: Optional schema name to operate within.  To control
         quoting of the schema outside of the default behavior, use
         the SQLAlchemy construct
         :class:`~sqlalchemy.sql.elements.quoted_name`.

         .. versionadded:: 0.7.0 'schema' can now accept a
            :class:`~sqlalchemy.sql.elements.quoted_name` construct.

        :param mssql_drop_check: Optional boolean.  When ``True``, on
         Microsoft SQL Server only, first
         drop the CHECK constraint on the column using a
         SQL-script-compatible
         block that selects into a @variable from sys.check_constraints,
         then exec's a separate DROP CONSTRAINT for that constraint.
        :param mssql_drop_default: Optional boolean.  When ``True``, on
         Microsoft SQL Server only, first
         drop the DEFAULT constraint on the column using a
         SQL-script-compatible
         block that selects into a @variable from sys.default_constraints,
         then exec's a separate DROP CONSTRAINT for that default.
        :param mssql_drop_foreign_key: Optional boolean.  When ``True``, on
         Microsoft SQL Server only, first
         drop a single FOREIGN KEY constraint on the column using a
         SQL-script-compatible
         block that selects into a @variable from
         sys.foreign_keys/sys.foreign_key_columns,
         then exec's a separate DROP CONSTRAINT for that default.  Only
         works if the column has exactly one FK constraint which refers to
         it, at the moment.

         .. versionadded:: 0.6.2

        """

        op = cls(table_name, column_name, schema=schema, **kw)
        return operations.invoke(op)

    @classmethod
    def batch_drop_column(cls, operations, column_name, **kw):
        """Issue a "drop column" instruction using the current
        batch migration context.

        .. seealso::

            :meth:`.Operations.drop_column`

        """
        op = cls(
            operations.impl.table_name, column_name,
            schema=operations.impl.schema, **kw)
        return operations.invoke(op)


@Operations.register_operation("bulk_insert")
class BulkInsertOp(MigrateOperation):
    """Represent a bulk insert operation."""

    def __init__(self, table, rows, multiinsert=True):
        self.table = table
        self.rows = rows
        self.multiinsert = multiinsert

    @classmethod
    def bulk_insert(cls, operations, table, rows, multiinsert=True):
        """Issue a "bulk insert" operation using the current
        migration context.

        This provides a means of representing an INSERT of multiple rows
        which works equally well in the context of executing on a live
        connection as well as that of generating a SQL script.   In the
        case of a SQL script, the values are rendered inline into the
        statement.

        e.g.::

            from alembic import op
            from datetime import date
            from sqlalchemy.sql import table, column
            from sqlalchemy import String, Integer, Date

            # Create an ad-hoc table to use for the insert statement.
            accounts_table = table('account',
                column('id', Integer),
                column('name', String),
                column('create_date', Date)
            )

            op.bulk_insert(accounts_table,
                [
                    {'id':1, 'name':'John Smith',
                            'create_date':date(2010, 10, 5)},
                    {'id':2, 'name':'Ed Williams',
                            'create_date':date(2007, 5, 27)},
                    {'id':3, 'name':'Wendy Jones',
                            'create_date':date(2008, 8, 15)},
                ]
            )

        When using --sql mode, some datatypes may not render inline
        automatically, such as dates and other special types.   When this
        issue is present, :meth:`.Operations.inline_literal` may be used::

            op.bulk_insert(accounts_table,
                [
                    {'id':1, 'name':'John Smith',
                            'create_date':op.inline_literal("2010-10-05")},
                    {'id':2, 'name':'Ed Williams',
                            'create_date':op.inline_literal("2007-05-27")},
                    {'id':3, 'name':'Wendy Jones',
                            'create_date':op.inline_literal("2008-08-15")},
                ],
                multiinsert=False
            )

        When using :meth:`.Operations.inline_literal` in conjunction with
        :meth:`.Operations.bulk_insert`, in order for the statement to work
        in "online" (e.g. non --sql) mode, the
        :paramref:`~.Operations.bulk_insert.multiinsert`
        flag should be set to ``False``, which will have the effect of
        individual INSERT statements being emitted to the database, each
        with a distinct VALUES clause, so that the "inline" values can
        still be rendered, rather than attempting to pass the values
        as bound parameters.

        .. versionadded:: 0.6.4 :meth:`.Operations.inline_literal` can now
           be used with :meth:`.Operations.bulk_insert`, and the
           :paramref:`~.Operations.bulk_insert.multiinsert` flag has
           been added to assist in this usage when running in "online"
           mode.

        :param table: a table object which represents the target of the INSERT.

        :param rows: a list of dictionaries indicating rows.

        :param multiinsert: when at its default of True and --sql mode is not
           enabled, the INSERT statement will be executed using
           "executemany()" style, where all elements in the list of
           dictionaries are passed as bound parameters in a single
           list.   Setting this to False results in individual INSERT
           statements being emitted per parameter set, and is needed
           in those cases where non-literal values are present in the
           parameter sets.

           .. versionadded:: 0.6.4

          """

        op = cls(table, rows, multiinsert=multiinsert)
        operations.invoke(op)


@Operations.register_operation("execute")
class ExecuteSQLOp(MigrateOperation):
    """Represent an execute SQL operation."""

    def __init__(self, sqltext, execution_options=None):
        self.sqltext = sqltext
        self.execution_options = execution_options

    @classmethod
    def execute(cls, operations, sqltext, execution_options=None):
        """Execute the given SQL using the current migration context.

        In a SQL script context, the statement is emitted directly to the
        output stream.   There is *no* return result, however, as this
        function is oriented towards generating a change script
        that can run in "offline" mode.  For full interaction
        with a connected database, use the "bind" available
        from the context::

            from alembic import op
            connection = op.get_bind()

        Also note that any parameterized statement here *will not work*
        in offline mode - INSERT, UPDATE and DELETE statements which refer
        to literal values would need to render
        inline expressions.   For simple use cases, the
        :meth:`.inline_literal` function can be used for **rudimentary**
        quoting of string values.  For "bulk" inserts, consider using
        :meth:`.bulk_insert`.

        For example, to emit an UPDATE statement which is equally
        compatible with both online and offline mode::

            from sqlalchemy.sql import table, column
            from sqlalchemy import String
            from alembic import op

            account = table('account',
                column('name', String)
            )
            op.execute(
                account.update().\\
                    where(account.c.name==op.inline_literal('account 1')).\\
                    values({'name':op.inline_literal('account 2')})
                    )

        Note above we also used the SQLAlchemy
        :func:`sqlalchemy.sql.expression.table`
        and :func:`sqlalchemy.sql.expression.column` constructs to
        make a brief, ad-hoc table construct just for our UPDATE
        statement.  A full :class:`~sqlalchemy.schema.Table` construct
        of course works perfectly fine as well, though note it's a
        recommended practice to at least ensure the definition of a
        table is self-contained within the migration script, rather
        than imported from a module that may break compatibility with
        older migrations.

        :param sql: Any legal SQLAlchemy expression, including:

        * a string
        * a :func:`sqlalchemy.sql.expression.text` construct.
        * a :func:`sqlalchemy.sql.expression.insert` construct.
        * a :func:`sqlalchemy.sql.expression.update`,
          :func:`sqlalchemy.sql.expression.insert`,
          or :func:`sqlalchemy.sql.expression.delete`  construct.
        * Pretty much anything that's "executable" as described
          in :ref:`sqlexpression_toplevel`.

        :param execution_options: Optional dictionary of
         execution options, will be passed to
         :meth:`sqlalchemy.engine.Connection.execution_options`.
        """
        op = cls(sqltext, execution_options=execution_options)
        return operations.invoke(op)


class OpContainer(MigrateOperation):
    """Represent a sequence of operations operation."""
    def __init__(self, ops=()):
        self.ops = ops

    def is_empty(self):
        return not self.ops

    def as_diffs(self):
        return list(OpContainer._ops_as_diffs(self))

    @classmethod
    def _ops_as_diffs(cls, migrations):
        for op in migrations.ops:
            if hasattr(op, 'ops'):
                for sub_op in cls._ops_as_diffs(op):
                    yield sub_op
            else:
                yield op.to_diff_tuple()


class ModifyTableOps(OpContainer):
    """Contains a sequence of operations that all apply to a single Table."""

    def __init__(self, table_name, ops, schema=None):
        super(ModifyTableOps, self).__init__(ops)
        self.table_name = table_name
        self.schema = schema

    def reverse(self):
        return ModifyTableOps(
            self.table_name,
            ops=list(reversed(
                [op.reverse() for op in self.ops]
            )),
            schema=self.schema
        )


class UpgradeOps(OpContainer):
    """contains a sequence of operations that would apply to the
    'upgrade' stream of a script.

    .. seealso::

        :ref:`customizing_revision`

    """

    def __init__(self, ops=(), upgrade_token="upgrades"):
        super(UpgradeOps, self).__init__(ops=ops)
        self.upgrade_token = upgrade_token

    def reverse_into(self, downgrade_ops):
        downgrade_ops.ops[:] = list(reversed(
            [op.reverse() for op in self.ops]
        ))
        return downgrade_ops

    def reverse(self):
        return self.reverse_into(DowngradeOps(ops=[]))


class DowngradeOps(OpContainer):
    """contains a sequence of operations that would apply to the
    'downgrade' stream of a script.

    .. seealso::

        :ref:`customizing_revision`

    """

    def __init__(self, ops=(), downgrade_token="downgrades"):
        super(DowngradeOps, self).__init__(ops=ops)
        self.downgrade_token = downgrade_token

    def reverse(self):
        return UpgradeOps(
            ops=list(reversed(
                [op.reverse() for op in self.ops]
            ))
        )


class MigrationScript(MigrateOperation):
    """represents a migration script.

    E.g. when autogenerate encounters this object, this corresponds to the
    production of an actual script file.

    A normal :class:`.MigrationScript` object would contain a single
    :class:`.UpgradeOps` and a single :class:`.DowngradeOps` directive.
    These are accessible via the ``.upgrade_ops`` and ``.downgrade_ops``
    attributes.

    In the case of an autogenerate operation that runs multiple times,
    such as the multiple database example in the "multidb" template,
    the ``.upgrade_ops`` and ``.downgrade_ops`` attributes are disabled,
    and instead these objects should be accessed via the ``.upgrade_ops_list``
    and ``.downgrade_ops_list`` list-based attributes.  These latter
    attributes are always available at the very least as single-element lists.

    .. versionchanged:: 0.8.1 the ``.upgrade_ops`` and ``.downgrade_ops``
       attributes should be accessed via the ``.upgrade_ops_list``
       and ``.downgrade_ops_list`` attributes if multiple autogenerate
       passes proceed on the same :class:`.MigrationScript` object.

    .. seealso::

        :ref:`customizing_revision`

    """

    def __init__(
            self, rev_id, upgrade_ops, downgrade_ops,
            message=None,
            imports=set(), head=None, splice=None,
            branch_label=None, version_path=None, depends_on=None):
        self.rev_id = rev_id
        self.message = message
        self.imports = imports
        self.head = head
        self.splice = splice
        self.branch_label = branch_label
        self.version_path = version_path
        self.depends_on = depends_on
        self.upgrade_ops = upgrade_ops
        self.downgrade_ops = downgrade_ops

    @property
    def upgrade_ops(self):
        """An instance of :class:`.UpgradeOps`.

        .. seealso::

            :attr:`.MigrationScript.upgrade_ops_list`
        """
        if len(self._upgrade_ops) > 1:
            raise ValueError(
                "This MigrationScript instance has a multiple-entry "
                "list for UpgradeOps; please use the "
                "upgrade_ops_list attribute.")
        elif not self._upgrade_ops:
            return None
        else:
            return self._upgrade_ops[0]

    @upgrade_ops.setter
    def upgrade_ops(self, upgrade_ops):
        self._upgrade_ops = util.to_list(upgrade_ops)
        for elem in self._upgrade_ops:
            assert isinstance(elem, UpgradeOps)

    @property
    def downgrade_ops(self):
        """An instance of :class:`.DowngradeOps`.

        .. seealso::

            :attr:`.MigrationScript.downgrade_ops_list`
        """
        if len(self._downgrade_ops) > 1:
            raise ValueError(
                "This MigrationScript instance has a multiple-entry "
                "list for DowngradeOps; please use the "
                "downgrade_ops_list attribute.")
        elif not self._downgrade_ops:
            return None
        else:
            return self._downgrade_ops[0]

    @downgrade_ops.setter
    def downgrade_ops(self, downgrade_ops):
        self._downgrade_ops = util.to_list(downgrade_ops)
        for elem in self._downgrade_ops:
            assert isinstance(elem, DowngradeOps)

    @property
    def upgrade_ops_list(self):
        """A list of :class:`.UpgradeOps` instances.

        This is used in place of the :attr:`.MigrationScript.upgrade_ops`
        attribute when dealing with a revision operation that does
        multiple autogenerate passes.

        .. versionadded:: 0.8.1

        """
        return self._upgrade_ops

    @property
    def downgrade_ops_list(self):
        """A list of :class:`.DowngradeOps` instances.

        This is used in place of the :attr:`.MigrationScript.downgrade_ops`
        attribute when dealing with a revision operation that does
        multiple autogenerate passes.

        .. versionadded:: 0.8.1

        """
        return self._downgrade_ops

