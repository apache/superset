from alembic import util
from alembic.operations import ops


class Rewriter(object):
    """A helper object that allows easy 'rewriting' of ops streams.

    The :class:`.Rewriter` object is intended to be passed along
    to the
    :paramref:`.EnvironmentContext.configure.process_revision_directives`
    parameter in an ``env.py`` script.    Once constructed, any number
    of "rewrites" functions can be associated with it, which will be given
    the opportunity to modify the structure without having to have explicit
    knowledge of the overall structure.

    The function is passed the :class:`.MigrationContext` object and
    ``revision`` tuple that are passed to the  :paramref:`.Environment
    Context.configure.process_revision_directives` function normally,
    and the third argument is an individual directive of the type
    noted in the decorator.  The function has the choice of  returning
    a single op directive, which normally can be the directive that
    was actually passed, or a new directive to replace it, or a list
    of zero or more directives to replace it.

    .. seealso::

        :ref:`autogen_rewriter` - usage example

    .. versionadded:: 0.8

    """

    _traverse = util.Dispatcher()

    _chained = None

    def __init__(self):
        self.dispatch = util.Dispatcher()

    def chain(self, other):
        """Produce a "chain" of this :class:`.Rewriter` to another.

        This allows two rewriters to operate serially on a stream,
        e.g.::

            writer1 = autogenerate.Rewriter()
            writer2 = autogenerate.Rewriter()

            @writer1.rewrites(ops.AddColumnOp)
            def add_column_nullable(context, revision, op):
                op.column.nullable = True
                return op

            @writer2.rewrites(ops.AddColumnOp)
            def add_column_idx(context, revision, op):
                idx_op = ops.CreateIndexOp(
                    'ixc', op.table_name, [op.column.name])
                return [
                    op,
                    idx_op
                ]

            writer = writer1.chain(writer2)

        :param other: a :class:`.Rewriter` instance
        :return: a new :class:`.Rewriter` that will run the operations
         of this writer, then the "other" writer, in succession.

        """
        wr = self.__class__.__new__(self.__class__)
        wr.__dict__.update(self.__dict__)
        wr._chained = other
        return wr

    def rewrites(self, operator):
        """Register a function as rewriter for a given type.

        The function should receive three arguments, which are
        the :class:`.MigrationContext`, a ``revision`` tuple, and
        an op directive of the type indicated.  E.g.::

            @writer1.rewrites(ops.AddColumnOp)
            def add_column_nullable(context, revision, op):
                op.column.nullable = True
                return op

        """
        return self.dispatch.dispatch_for(operator)

    def _rewrite(self, context, revision, directive):
        try:
            _rewriter = self.dispatch.dispatch(directive)
        except ValueError:
            _rewriter = None
            yield directive
        else:
            for r_directive in util.to_list(
                    _rewriter(context, revision, directive)):
                yield r_directive

    def __call__(self, context, revision, directives):
        self.process_revision_directives(context, revision, directives)
        if self._chained:
            self._chained(context, revision, directives)

    @_traverse.dispatch_for(ops.MigrationScript)
    def _traverse_script(self, context, revision, directive):
        upgrade_ops_list = []
        for upgrade_ops in directive.upgrade_ops_list:
            ret = self._traverse_for(context, revision, directive.upgrade_ops)
            if len(ret) != 1:
                raise ValueError(
                    "Can only return single object for UpgradeOps traverse")
            upgrade_ops_list.append(ret[0])
        directive.upgrade_ops = upgrade_ops_list

        downgrade_ops_list = []
        for downgrade_ops in directive.downgrade_ops_list:
            ret = self._traverse_for(
                context, revision, directive.downgrade_ops)
            if len(ret) != 1:
                raise ValueError(
                    "Can only return single object for DowngradeOps traverse")
            downgrade_ops_list.append(ret[0])
        directive.downgrade_ops = downgrade_ops_list

    @_traverse.dispatch_for(ops.OpContainer)
    def _traverse_op_container(self, context, revision, directive):
        self._traverse_list(context, revision, directive.ops)

    @_traverse.dispatch_for(ops.MigrateOperation)
    def _traverse_any_directive(self, context, revision, directive):
        pass

    def _traverse_for(self, context, revision, directive):
        directives = list(self._rewrite(context, revision, directive))
        for directive in directives:
            traverser = self._traverse.dispatch(directive)
            traverser(self, context, revision, directive)
        return directives

    def _traverse_list(self, context, revision, directives):
        dest = []
        for directive in directives:
            dest.extend(self._traverse_for(context, revision, directive))

        directives[:] = dest

    def process_revision_directives(self, context, revision, directives):
        self._traverse_list(context, revision, directives)
