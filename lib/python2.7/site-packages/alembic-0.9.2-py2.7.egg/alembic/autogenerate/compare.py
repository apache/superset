from sqlalchemy import schema as sa_schema, types as sqltypes
from sqlalchemy.engine.reflection import Inspector
from sqlalchemy import event
from ..operations import ops
import logging
from .. import util
from ..util import compat
from ..util import sqla_compat
from sqlalchemy.util import OrderedSet
import re
from .render import _user_defined_render
import contextlib
from alembic.ddl.base import _fk_spec

log = logging.getLogger(__name__)


def _populate_migration_script(autogen_context, migration_script):
    upgrade_ops = migration_script.upgrade_ops_list[-1]
    downgrade_ops = migration_script.downgrade_ops_list[-1]

    _produce_net_changes(autogen_context, upgrade_ops)
    upgrade_ops.reverse_into(downgrade_ops)


comparators = util.Dispatcher(uselist=True)


def _produce_net_changes(autogen_context, upgrade_ops):

    connection = autogen_context.connection
    include_schemas = autogen_context.opts.get('include_schemas', False)

    inspector = Inspector.from_engine(connection)

    default_schema = connection.dialect.default_schema_name
    if include_schemas:
        schemas = set(inspector.get_schema_names())
        # replace default schema name with None
        schemas.discard("information_schema")
        # replace the "default" schema with None
        schemas.discard(default_schema)
        schemas.add(None)
    else:
        schemas = [None]

    comparators.dispatch("schema", autogen_context.dialect.name)(
        autogen_context, upgrade_ops, schemas
    )


@comparators.dispatch_for("schema")
def _autogen_for_tables(autogen_context, upgrade_ops, schemas):
    inspector = autogen_context.inspector

    conn_table_names = set()

    version_table_schema = \
        autogen_context.migration_context.version_table_schema
    version_table = autogen_context.migration_context.version_table

    for s in schemas:
        tables = set(inspector.get_table_names(schema=s))
        if s == version_table_schema:
            tables = tables.difference(
                [autogen_context.migration_context.version_table]
            )
        conn_table_names.update(zip([s] * len(tables), tables))

    metadata_table_names = OrderedSet(
        [(table.schema, table.name) for table in autogen_context.sorted_tables]
    ).difference([(version_table_schema, version_table)])

    _compare_tables(conn_table_names, metadata_table_names,
                    inspector, upgrade_ops, autogen_context)


def _compare_tables(conn_table_names, metadata_table_names,
                    inspector, upgrade_ops, autogen_context):

    default_schema = inspector.bind.dialect.default_schema_name

    # tables coming from the connection will not have "schema"
    # set if it matches default_schema_name; so we need a list
    # of table names from local metadata that also have "None" if schema
    # == default_schema_name.  Most setups will be like this anyway but
    # some are not (see #170)
    metadata_table_names_no_dflt_schema = OrderedSet([
        (schema if schema != default_schema else None, tname)
        for schema, tname in metadata_table_names
    ])

    # to adjust for the MetaData collection storing the tables either
    # as "schemaname.tablename" or just "tablename", create a new lookup
    # which will match the "non-default-schema" keys to the Table object.
    tname_to_table = dict(
        (
            no_dflt_schema,
            autogen_context.table_key_to_table[
                sa_schema._get_table_key(tname, schema)]
        )
        for no_dflt_schema, (schema, tname) in zip(
            metadata_table_names_no_dflt_schema,
            metadata_table_names)
    )
    metadata_table_names = metadata_table_names_no_dflt_schema

    for s, tname in metadata_table_names.difference(conn_table_names):
        name = '%s.%s' % (s, tname) if s else tname
        metadata_table = tname_to_table[(s, tname)]
        if autogen_context.run_filters(
                metadata_table, tname, "table", False, None):
            upgrade_ops.ops.append(
                ops.CreateTableOp.from_table(metadata_table))
            log.info("Detected added table %r", name)
            modify_table_ops = ops.ModifyTableOps(tname, [], schema=s)

            comparators.dispatch("table")(
                autogen_context, modify_table_ops,
                s, tname, None, metadata_table
            )
            if not modify_table_ops.is_empty():
                upgrade_ops.ops.append(modify_table_ops)

    removal_metadata = sa_schema.MetaData()
    for s, tname in conn_table_names.difference(metadata_table_names):
        name = sa_schema._get_table_key(tname, s)
        exists = name in removal_metadata.tables
        t = sa_schema.Table(tname, removal_metadata, schema=s)

        if not exists:
            event.listen(
                t,
                "column_reflect",
                autogen_context.migration_context.impl.
                _compat_autogen_column_reflect(inspector))
            inspector.reflecttable(t, None)
        if autogen_context.run_filters(t, tname, "table", True, None):
            upgrade_ops.ops.append(
                ops.DropTableOp.from_table(t)
            )
            log.info("Detected removed table %r", name)

    existing_tables = conn_table_names.intersection(metadata_table_names)

    existing_metadata = sa_schema.MetaData()
    conn_column_info = {}
    for s, tname in existing_tables:
        name = sa_schema._get_table_key(tname, s)
        exists = name in existing_metadata.tables
        t = sa_schema.Table(tname, existing_metadata, schema=s)
        if not exists:
            event.listen(
                t,
                "column_reflect",
                autogen_context.migration_context.impl.
                _compat_autogen_column_reflect(inspector))
            inspector.reflecttable(t, None)
        conn_column_info[(s, tname)] = t

    for s, tname in sorted(existing_tables, key=lambda x: (x[0] or '', x[1])):
        s = s or None
        name = '%s.%s' % (s, tname) if s else tname
        metadata_table = tname_to_table[(s, tname)]
        conn_table = existing_metadata.tables[name]

        if autogen_context.run_filters(
                metadata_table, tname, "table", False,
                conn_table):

            modify_table_ops = ops.ModifyTableOps(tname, [], schema=s)
            with _compare_columns(
                s, tname,
                conn_table,
                metadata_table,
                    modify_table_ops, autogen_context, inspector):

                comparators.dispatch("table")(
                    autogen_context, modify_table_ops,
                    s, tname, conn_table, metadata_table
                )

            if not modify_table_ops.is_empty():
                upgrade_ops.ops.append(modify_table_ops)


def _make_index(params, conn_table):
    # TODO: add .info such as 'duplicates_constraint'
    return sa_schema.Index(
        params['name'],
        *[conn_table.c[cname] for cname in params['column_names']],
        unique=params['unique']
    )


def _make_unique_constraint(params, conn_table):
    uq = sa_schema.UniqueConstraint(
        *[conn_table.c[cname] for cname in params['column_names']],
        name=params['name']
    )
    if 'duplicates_index' in params:
        uq.info['duplicates_index'] = params['duplicates_index']

    return uq


def _make_foreign_key(params, conn_table):
    tname = params['referred_table']
    if params['referred_schema']:
        tname = "%s.%s" % (params['referred_schema'], tname)

    options = params.get('options', {})

    const = sa_schema.ForeignKeyConstraint(
        [conn_table.c[cname] for cname in params['constrained_columns']],
        ["%s.%s" % (tname, n) for n in params['referred_columns']],
        onupdate=options.get('onupdate'),
        ondelete=options.get('ondelete'),
        deferrable=options.get('deferrable'),
        initially=options.get('initially'),
        name=params['name']
    )
    # needed by 0.7
    conn_table.append_constraint(const)
    return const


@contextlib.contextmanager
def _compare_columns(schema, tname, conn_table, metadata_table,
                     modify_table_ops, autogen_context, inspector):
    name = '%s.%s' % (schema, tname) if schema else tname
    metadata_cols_by_name = dict((c.name, c) for c in metadata_table.c)
    conn_col_names = dict((c.name, c) for c in conn_table.c)
    metadata_col_names = OrderedSet(sorted(metadata_cols_by_name))

    for cname in metadata_col_names.difference(conn_col_names):
        if autogen_context.run_filters(
                metadata_cols_by_name[cname], cname,
                "column", False, None):
            modify_table_ops.ops.append(
                ops.AddColumnOp.from_column_and_tablename(
                    schema, tname, metadata_cols_by_name[cname])
            )
            log.info("Detected added column '%s.%s'", name, cname)

    for colname in metadata_col_names.intersection(conn_col_names):
        metadata_col = metadata_cols_by_name[colname]
        conn_col = conn_table.c[colname]
        if not autogen_context.run_filters(
                metadata_col, colname, "column", False,
                conn_col):
            continue
        alter_column_op = ops.AlterColumnOp(
            tname, colname, schema=schema)

        comparators.dispatch("column")(
            autogen_context, alter_column_op,
            schema, tname, colname, conn_col, metadata_col
        )

        if alter_column_op.has_changes():
            modify_table_ops.ops.append(alter_column_op)

    yield

    for cname in set(conn_col_names).difference(metadata_col_names):
        if autogen_context.run_filters(
                conn_table.c[cname], cname,
                "column", True, None):
            modify_table_ops.ops.append(
                ops.DropColumnOp.from_column_and_tablename(
                    schema, tname, conn_table.c[cname]
                )
            )
            log.info("Detected removed column '%s.%s'", name, cname)


class _constraint_sig(object):

    def md_name_to_sql_name(self, context):
        return self.name

    def __eq__(self, other):
        return self.const == other.const

    def __ne__(self, other):
        return self.const != other.const

    def __hash__(self):
        return hash(self.const)


class _uq_constraint_sig(_constraint_sig):
    is_index = False
    is_unique = True

    def __init__(self, const):
        self.const = const
        self.name = const.name
        self.sig = tuple(sorted([col.name for col in const.columns]))

    @property
    def column_names(self):
        return [col.name for col in self.const.columns]


class _ix_constraint_sig(_constraint_sig):
    is_index = True

    def __init__(self, const):
        self.const = const
        self.name = const.name
        self.sig = tuple(sorted([col.name for col in const.columns]))
        self.is_unique = bool(const.unique)

    def md_name_to_sql_name(self, context):
        return sqla_compat._get_index_final_name(context.dialect, self.const)

    @property
    def column_names(self):
        return sqla_compat._get_index_column_names(self.const)


class _fk_constraint_sig(_constraint_sig):
    def __init__(self, const, include_options=False):
        self.const = const
        self.name = const.name

        (
            self.source_schema, self.source_table,
            self.source_columns, self.target_schema, self.target_table,
            self.target_columns,
            onupdate, ondelete,
            deferrable, initially) = _fk_spec(const)

        self.sig = (
            self.source_schema, self.source_table, tuple(self.source_columns),
            self.target_schema, self.target_table, tuple(self.target_columns)
        )
        if include_options:
            self.sig += (
                (None if onupdate.lower() == 'no action'
                    else onupdate.lower())
                if onupdate else None,
                (None if ondelete.lower() == 'no action'
                    else ondelete.lower())
                if ondelete else None,
                # convert initially + deferrable into one three-state value
                "initially_deferrable"
                if initially and initially.lower() == "deferred"
                else "deferrable" if deferrable
                else "not deferrable"
            )


@comparators.dispatch_for("table")
def _compare_indexes_and_uniques(
        autogen_context, modify_ops, schema, tname, conn_table,
        metadata_table):

    inspector = autogen_context.inspector
    is_create_table = conn_table is None

    # 1a. get raw indexes and unique constraints from metadata ...
    metadata_unique_constraints = set(
        uq for uq in metadata_table.constraints
        if isinstance(uq, sa_schema.UniqueConstraint)
    )
    metadata_indexes = set(metadata_table.indexes)

    conn_uniques = conn_indexes = frozenset()

    supports_unique_constraints = False

    unique_constraints_duplicate_unique_indexes = False

    if conn_table is not None:
        # 1b. ... and from connection, if the table exists
        if hasattr(inspector, "get_unique_constraints"):
            try:
                conn_uniques = inspector.get_unique_constraints(
                    tname, schema=schema)
                supports_unique_constraints = True
            except NotImplementedError:
                pass
            except TypeError:
                # number of arguments is off for the base
                # method in SQLAlchemy due to the cache decorator
                # not being present
                pass
            else:
                for uq in conn_uniques:
                    if uq.get('duplicates_index'):
                        unique_constraints_duplicate_unique_indexes = True
        try:
            conn_indexes = inspector.get_indexes(tname, schema=schema)
        except NotImplementedError:
            pass

        # 2. convert conn-level objects from raw inspector records
        # into schema objects
        conn_uniques = set(_make_unique_constraint(uq_def, conn_table)
                           for uq_def in conn_uniques)
        conn_indexes = set(_make_index(ix, conn_table) for ix in conn_indexes)

    # 2a. if the dialect dupes unique indexes as unique constraints
    # (mysql and oracle), correct for that

    if unique_constraints_duplicate_unique_indexes:
        _correct_for_uq_duplicates_uix(
            conn_uniques, conn_indexes,
            metadata_unique_constraints,
            metadata_indexes
        )

    # 3. give the dialect a chance to omit indexes and constraints that
    # we know are either added implicitly by the DB or that the DB
    # can't accurately report on
    autogen_context.migration_context.impl.\
        correct_for_autogen_constraints(
            conn_uniques, conn_indexes,
            metadata_unique_constraints,
            metadata_indexes)

    # 4. organize the constraints into "signature" collections, the
    # _constraint_sig() objects provide a consistent facade over both
    # Index and UniqueConstraint so we can easily work with them
    # interchangeably
    metadata_unique_constraints = set(_uq_constraint_sig(uq)
                                      for uq in metadata_unique_constraints
                                      )

    metadata_indexes = set(_ix_constraint_sig(ix) for ix in metadata_indexes)

    conn_unique_constraints = set(
        _uq_constraint_sig(uq) for uq in conn_uniques)

    conn_indexes = set(_ix_constraint_sig(ix) for ix in conn_indexes)

    # 5. index things by name, for those objects that have names
    metadata_names = dict(
        (c.md_name_to_sql_name(autogen_context), c) for c in
        metadata_unique_constraints.union(metadata_indexes)
        if c.name is not None)

    conn_uniques_by_name = dict((c.name, c) for c in conn_unique_constraints)
    conn_indexes_by_name = dict((c.name, c) for c in conn_indexes)

    conn_names = dict((c.name, c) for c in
                      conn_unique_constraints.union(conn_indexes)
                      if c.name is not None)

    doubled_constraints = dict(
        (name, (conn_uniques_by_name[name], conn_indexes_by_name[name]))
        for name in set(
            conn_uniques_by_name).intersection(conn_indexes_by_name)
    )

    # 6. index things by "column signature", to help with unnamed unique
    # constraints.
    conn_uniques_by_sig = dict((uq.sig, uq) for uq in conn_unique_constraints)
    metadata_uniques_by_sig = dict(
        (uq.sig, uq) for uq in metadata_unique_constraints)
    metadata_indexes_by_sig = dict(
        (ix.sig, ix) for ix in metadata_indexes)
    unnamed_metadata_uniques = dict(
        (uq.sig, uq) for uq in
        metadata_unique_constraints if uq.name is None)

    # assumptions:
    # 1. a unique constraint or an index from the connection *always*
    #    has a name.
    # 2. an index on the metadata side *always* has a name.
    # 3. a unique constraint on the metadata side *might* have a name.
    # 4. The backend may double up indexes as unique constraints and
    #    vice versa (e.g. MySQL, Postgresql)

    def obj_added(obj):
        if obj.is_index:
            if autogen_context.run_filters(
                    obj.const, obj.name, "index", False, None):
                modify_ops.ops.append(
                    ops.CreateIndexOp.from_index(obj.const)
                )
                log.info("Detected added index '%s' on %s",
                         obj.name, ', '.join([
                             "'%s'" % obj.column_names
                         ]))
        else:
            if not supports_unique_constraints:
                # can't report unique indexes as added if we don't
                # detect them
                return
            if is_create_table:
                # unique constraints are created inline with table defs
                return
            if autogen_context.run_filters(
                    obj.const, obj.name,
                    "unique_constraint", False, None):
                modify_ops.ops.append(
                    ops.AddConstraintOp.from_constraint(obj.const)
                )
                log.info("Detected added unique constraint '%s' on %s",
                         obj.name, ', '.join([
                             "'%s'" % obj.column_names
                         ]))

    def obj_removed(obj):
        if obj.is_index:
            if obj.is_unique and not supports_unique_constraints:
                # many databases double up unique constraints
                # as unique indexes.  without that list we can't
                # be sure what we're doing here
                return

            if autogen_context.run_filters(
                    obj.const, obj.name, "index", True, None):
                modify_ops.ops.append(
                    ops.DropIndexOp.from_index(obj.const)
                )
                log.info(
                    "Detected removed index '%s' on '%s'", obj.name, tname)
        else:
            if autogen_context.run_filters(
                    obj.const, obj.name,
                    "unique_constraint", True, None):
                modify_ops.ops.append(
                    ops.DropConstraintOp.from_constraint(obj.const)
                )
                log.info("Detected removed unique constraint '%s' on '%s'",
                         obj.name, tname
                         )

    def obj_changed(old, new, msg):
        if old.is_index:
            if autogen_context.run_filters(
                    new.const, new.name, "index",
                    False, old.const):
                log.info("Detected changed index '%s' on '%s':%s",
                         old.name, tname, ', '.join(msg)
                         )
                modify_ops.ops.append(
                    ops.DropIndexOp.from_index(old.const)
                )
                modify_ops.ops.append(
                    ops.CreateIndexOp.from_index(new.const)
                )
        else:
            if autogen_context.run_filters(
                    new.const, new.name,
                    "unique_constraint", False, old.const):
                log.info("Detected changed unique constraint '%s' on '%s':%s",
                         old.name, tname, ', '.join(msg)
                         )
                modify_ops.ops.append(
                    ops.DropConstraintOp.from_constraint(old.const)
                )
                modify_ops.ops.append(
                    ops.AddConstraintOp.from_constraint(new.const)
                )

    for added_name in sorted(set(metadata_names).difference(conn_names)):
        obj = metadata_names[added_name]
        obj_added(obj)

    for existing_name in sorted(set(metadata_names).intersection(conn_names)):
        metadata_obj = metadata_names[existing_name]

        if existing_name in doubled_constraints:
            conn_uq, conn_idx = doubled_constraints[existing_name]
            if metadata_obj.is_index:
                conn_obj = conn_idx
            else:
                conn_obj = conn_uq
        else:
            conn_obj = conn_names[existing_name]

        if conn_obj.is_index != metadata_obj.is_index:
            obj_removed(conn_obj)
            obj_added(metadata_obj)
        else:
            msg = []
            if conn_obj.is_unique != metadata_obj.is_unique:
                msg.append(' unique=%r to unique=%r' % (
                    conn_obj.is_unique, metadata_obj.is_unique
                ))
            if conn_obj.sig != metadata_obj.sig:
                msg.append(' columns %r to %r' % (
                    conn_obj.sig, metadata_obj.sig
                ))

            if msg:
                obj_changed(conn_obj, metadata_obj, msg)

    for removed_name in sorted(set(conn_names).difference(metadata_names)):
        conn_obj = conn_names[removed_name]
        if not conn_obj.is_index and conn_obj.sig in unnamed_metadata_uniques:
            continue
        elif removed_name in doubled_constraints:
            if conn_obj.sig not in metadata_indexes_by_sig and \
                    conn_obj.sig not in metadata_uniques_by_sig:
                conn_uq, conn_idx = doubled_constraints[removed_name]
                obj_removed(conn_uq)
                obj_removed(conn_idx)
        else:
            obj_removed(conn_obj)

    for uq_sig in unnamed_metadata_uniques:
        if uq_sig not in conn_uniques_by_sig:
            obj_added(unnamed_metadata_uniques[uq_sig])


def _correct_for_uq_duplicates_uix(
    conn_unique_constraints,
        conn_indexes,
        metadata_unique_constraints,
        metadata_indexes):

    # dedupe unique indexes vs. constraints, since MySQL / Oracle
    # doesn't really have unique constraints as a separate construct.
    # but look in the metadata and try to maintain constructs
    # that already seem to be defined one way or the other
    # on that side.  This logic was formerly local to MySQL dialect,
    # generalized to Oracle and others. See #276
    metadata_uq_names = set([
        cons.name for cons in metadata_unique_constraints
        if cons.name is not None])

    unnamed_metadata_uqs = set([
        _uq_constraint_sig(cons).sig
        for cons in metadata_unique_constraints
        if cons.name is None
    ])

    metadata_ix_names = set([
        cons.name for cons in metadata_indexes if cons.unique])
    conn_ix_names = dict(
        (cons.name, cons) for cons in conn_indexes if cons.unique
    )

    uqs_dupe_indexes = dict(
        (cons.name, cons) for cons in conn_unique_constraints
        if cons.info['duplicates_index']
    )
    for overlap in uqs_dupe_indexes:
        if overlap not in metadata_uq_names:
            if _uq_constraint_sig(uqs_dupe_indexes[overlap]).sig \
                    not in unnamed_metadata_uqs:

                conn_unique_constraints.discard(uqs_dupe_indexes[overlap])
        elif overlap not in metadata_ix_names:
            conn_indexes.discard(conn_ix_names[overlap])


@comparators.dispatch_for("column")
def _compare_nullable(
    autogen_context, alter_column_op, schema, tname, cname, conn_col,
        metadata_col):

    # work around SQLAlchemy issue #3023
    if metadata_col.primary_key:
        return

    metadata_col_nullable = metadata_col.nullable
    conn_col_nullable = conn_col.nullable
    alter_column_op.existing_nullable = conn_col_nullable

    if conn_col_nullable is not metadata_col_nullable:
        alter_column_op.modify_nullable = metadata_col_nullable
        log.info("Detected %s on column '%s.%s'",
                 "NULL" if metadata_col_nullable else "NOT NULL",
                 tname,
                 cname
                 )


@comparators.dispatch_for("column")
def _setup_autoincrement(
    autogen_context, alter_column_op, schema, tname, cname, conn_col,
        metadata_col):

    if metadata_col.table._autoincrement_column is metadata_col:
        alter_column_op.kw['autoincrement'] = True
    elif util.sqla_110 and metadata_col.autoincrement is True:
        alter_column_op.kw['autoincrement'] = True
    elif metadata_col.autoincrement is False:
        alter_column_op.kw['autoincrement'] = False


@comparators.dispatch_for("column")
def _compare_type(
    autogen_context, alter_column_op, schema, tname, cname, conn_col,
        metadata_col):

    conn_type = conn_col.type
    alter_column_op.existing_type = conn_type
    metadata_type = metadata_col.type
    if conn_type._type_affinity is sqltypes.NullType:
        log.info("Couldn't determine database type "
                 "for column '%s.%s'", tname, cname)
        return
    if metadata_type._type_affinity is sqltypes.NullType:
        log.info("Column '%s.%s' has no type within "
                 "the model; can't compare", tname, cname)
        return

    isdiff = autogen_context.migration_context._compare_type(
        conn_col, metadata_col)

    if isdiff:
        alter_column_op.modify_type = metadata_type
        log.info("Detected type change from %r to %r on '%s.%s'",
                 conn_type, metadata_type, tname, cname
                 )


def _render_server_default_for_compare(metadata_default,
                                       metadata_col, autogen_context):
    rendered = _user_defined_render(
        "server_default", metadata_default, autogen_context)
    if rendered is not False:
        return rendered

    if isinstance(metadata_default, sa_schema.DefaultClause):
        if isinstance(metadata_default.arg, compat.string_types):
            metadata_default = metadata_default.arg
        else:
            metadata_default = str(metadata_default.arg.compile(
                dialect=autogen_context.dialect))
    if isinstance(metadata_default, compat.string_types):
        if metadata_col.type._type_affinity is sqltypes.String:
            metadata_default = re.sub(r"^'|'$", "", metadata_default)
            return repr(metadata_default)
        else:
            return metadata_default
    else:
        return None


@comparators.dispatch_for("column")
def _compare_server_default(
    autogen_context, alter_column_op, schema, tname, cname,
        conn_col, metadata_col):

    metadata_default = metadata_col.server_default
    conn_col_default = conn_col.server_default
    if conn_col_default is None and metadata_default is None:
        return False
    rendered_metadata_default = _render_server_default_for_compare(
        metadata_default, metadata_col, autogen_context)

    rendered_conn_default = conn_col.server_default.arg.text \
        if conn_col.server_default else None

    alter_column_op.existing_server_default = conn_col_default

    isdiff = autogen_context.migration_context._compare_server_default(
        conn_col, metadata_col,
        rendered_metadata_default,
        rendered_conn_default
    )
    if isdiff:
        alter_column_op.modify_server_default = metadata_default
        log.info(
            "Detected server default on column '%s.%s'",
            tname, cname)


@comparators.dispatch_for("table")
def _compare_foreign_keys(
    autogen_context, modify_table_ops, schema, tname, conn_table,
        metadata_table):

    # if we're doing CREATE TABLE, all FKs are created
    # inline within the table def
    if conn_table is None:
        return

    inspector = autogen_context.inspector
    metadata_fks = set(
        fk for fk in metadata_table.constraints
        if isinstance(fk, sa_schema.ForeignKeyConstraint)
    )

    conn_fks = inspector.get_foreign_keys(tname, schema=schema)

    backend_reflects_fk_options = conn_fks and 'options' in conn_fks[0]

    conn_fks = set(_make_foreign_key(const, conn_table) for const in conn_fks)

    # give the dialect a chance to correct the FKs to match more
    # closely
    autogen_context.migration_context.impl.\
        correct_for_autogen_foreignkeys(
            conn_fks, metadata_fks,
        )

    metadata_fks = set(
        _fk_constraint_sig(fk, include_options=backend_reflects_fk_options)
        for fk in metadata_fks
    )

    conn_fks = set(
        _fk_constraint_sig(fk, include_options=backend_reflects_fk_options)
        for fk in conn_fks
    )

    conn_fks_by_sig = dict(
        (c.sig, c) for c in conn_fks
    )
    metadata_fks_by_sig = dict(
        (c.sig, c) for c in metadata_fks
    )

    metadata_fks_by_name = dict(
        (c.name, c) for c in metadata_fks if c.name is not None
    )
    conn_fks_by_name = dict(
        (c.name, c) for c in conn_fks if c.name is not None
    )

    def _add_fk(obj, compare_to):
        if autogen_context.run_filters(
                obj.const, obj.name, "foreign_key_constraint", False,
                compare_to):
            modify_table_ops.ops.append(
                ops.CreateForeignKeyOp.from_constraint(const.const)
            )

            log.info(
                "Detected added foreign key (%s)(%s) on table %s%s",
                ", ".join(obj.source_columns),
                ", ".join(obj.target_columns),
                "%s." % obj.source_schema if obj.source_schema else "",
                obj.source_table)

    def _remove_fk(obj, compare_to):
        if autogen_context.run_filters(
                obj.const, obj.name, "foreign_key_constraint", True,
                compare_to):
            modify_table_ops.ops.append(
                ops.DropConstraintOp.from_constraint(obj.const)
            )
            log.info(
                "Detected removed foreign key (%s)(%s) on table %s%s",
                ", ".join(obj.source_columns),
                ", ".join(obj.target_columns),
                "%s." % obj.source_schema if obj.source_schema else "",
                obj.source_table)

    # so far it appears we don't need to do this by name at all.
    # SQLite doesn't preserve constraint names anyway

    for removed_sig in set(conn_fks_by_sig).difference(metadata_fks_by_sig):
        const = conn_fks_by_sig[removed_sig]
        if removed_sig not in metadata_fks_by_sig:
            compare_to = metadata_fks_by_name[const.name].const \
                if const.name in metadata_fks_by_name else None
            _remove_fk(const, compare_to)

    for added_sig in set(metadata_fks_by_sig).difference(conn_fks_by_sig):
        const = metadata_fks_by_sig[added_sig]
        if added_sig not in conn_fks_by_sig:
            compare_to = conn_fks_by_name[const.name].const \
                if const.name in conn_fks_by_name else None
            _add_fk(const, compare_to)
