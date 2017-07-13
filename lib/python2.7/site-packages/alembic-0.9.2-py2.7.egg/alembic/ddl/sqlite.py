from .. import util
from .impl import DefaultImpl
import re


class SQLiteImpl(DefaultImpl):
    __dialect__ = 'sqlite'

    transactional_ddl = False
    """SQLite supports transactional DDL, but pysqlite does not:
    see: http://bugs.python.org/issue10740
    """

    def requires_recreate_in_batch(self, batch_op):
        """Return True if the given :class:`.BatchOperationsImpl`
        would need the table to be recreated and copied in order to
        proceed.

        Normally, only returns True on SQLite when operations other
        than add_column are present.

        """
        for op in batch_op.batch:
            if op[0] not in ('add_column', 'create_index', 'drop_index'):
                return True
        else:
            return False

    def add_constraint(self, const):
        # attempt to distinguish between an
        # auto-gen constraint and an explicit one
        if const._create_rule is None:
            raise NotImplementedError(
                "No support for ALTER of constraints in SQLite dialect")
        elif const._create_rule(self):
            util.warn("Skipping unsupported ALTER for "
                      "creation of implicit constraint")

    def drop_constraint(self, const):
        if const._create_rule is None:
            raise NotImplementedError(
                "No support for ALTER of constraints in SQLite dialect")

    def compare_server_default(self, inspector_column,
                               metadata_column,
                               rendered_metadata_default,
                               rendered_inspector_default):

        if rendered_metadata_default is not None:
            rendered_metadata_default = re.sub(
                r"^\"'|\"'$", "", rendered_metadata_default)
        if rendered_inspector_default is not None:
            rendered_inspector_default = re.sub(
                r"^\"'|\"'$", "", rendered_inspector_default)

        return rendered_inspector_default != rendered_metadata_default

    def correct_for_autogen_constraints(
        self, conn_unique_constraints, conn_indexes,
        metadata_unique_constraints,
            metadata_indexes):

        if util.sqla_100:
            return

        # adjustments to accommodate for SQLite unnamed unique constraints
        # not being reported from the backend; this was updated in
        # SQLA 1.0.

        def uq_sig(uq):
            return tuple(sorted(uq.columns.keys()))

        conn_unique_sigs = set(
            uq_sig(uq)
            for uq in conn_unique_constraints
        )

        for idx in list(metadata_unique_constraints):
            # SQLite backend can't report on unnamed UNIQUE constraints,
            # so remove these, unless we see an exact signature match
            if idx.name is None and uq_sig(idx) not in conn_unique_sigs:
                metadata_unique_constraints.remove(idx)


# @compiles(AddColumn, 'sqlite')
# def visit_add_column(element, compiler, **kw):
#    return "%s %s" % (
#        alter_table(compiler, element.table_name, element.schema),
#        add_column(compiler, element.column, **kw)
#    )


# def add_column(compiler, column, **kw):
#    text = "ADD COLUMN %s" % compiler.get_column_specification(column, **kw)
# need to modify SQLAlchemy so that the CHECK associated with a Boolean
# or Enum gets placed as part of the column constraints, not the Table
# see ticket 98
#    for const in column.constraints:
#        text += compiler.process(AddConstraint(const))
#    return text
