import logging
import sys
from contextlib import contextmanager

from sqlalchemy import MetaData, Table, Column, String, literal_column,\
    PrimaryKeyConstraint
from sqlalchemy.engine.strategies import MockEngineStrategy
from sqlalchemy.engine import url as sqla_url
from sqlalchemy.engine import Connection

from ..util.compat import callable, EncodedIO
from .. import ddl, util

log = logging.getLogger(__name__)


class MigrationContext(object):

    """Represent the database state made available to a migration
    script.

    :class:`.MigrationContext` is the front end to an actual
    database connection, or alternatively a string output
    stream given a particular database dialect,
    from an Alembic perspective.

    When inside the ``env.py`` script, the :class:`.MigrationContext`
    is available via the
    :meth:`.EnvironmentContext.get_context` method,
    which is available at ``alembic.context``::

        # from within env.py script
        from alembic import context
        migration_context = context.get_context()

    For usage outside of an ``env.py`` script, such as for
    utility routines that want to check the current version
    in the database, the :meth:`.MigrationContext.configure`
    method to create new :class:`.MigrationContext` objects.
    For example, to get at the current revision in the
    database using :meth:`.MigrationContext.get_current_revision`::

        # in any application, outside of an env.py script
        from alembic.migration import MigrationContext
        from sqlalchemy import create_engine

        engine = create_engine("postgresql://mydatabase")
        conn = engine.connect()

        context = MigrationContext.configure(conn)
        current_rev = context.get_current_revision()

    The above context can also be used to produce
    Alembic migration operations with an :class:`.Operations`
    instance::

        # in any application, outside of the normal Alembic environment
        from alembic.operations import Operations
        op = Operations(context)
        op.alter_column("mytable", "somecolumn", nullable=True)

    """

    def __init__(self, dialect, connection, opts, environment_context=None):
        self.environment_context = environment_context
        self.opts = opts
        self.dialect = dialect
        self.script = opts.get('script')
        as_sql = opts.get('as_sql', False)
        transactional_ddl = opts.get("transactional_ddl")
        self._transaction_per_migration = opts.get(
            "transaction_per_migration", False)

        if as_sql:
            self.connection = self._stdout_connection(connection)
            assert self.connection is not None
        else:
            self.connection = connection
        self._migrations_fn = opts.get('fn')
        self.as_sql = as_sql

        if "output_encoding" in opts:
            self.output_buffer = EncodedIO(
                opts.get("output_buffer") or sys.stdout,
                opts['output_encoding']
            )
        else:
            self.output_buffer = opts.get("output_buffer", sys.stdout)

        self._user_compare_type = opts.get('compare_type', False)
        self._user_compare_server_default = opts.get(
            'compare_server_default',
            False)
        self.version_table = version_table = opts.get(
            'version_table', 'alembic_version')
        self.version_table_schema = version_table_schema = \
            opts.get('version_table_schema', None)
        self._version = Table(
            version_table, MetaData(),
            Column('version_num', String(32), nullable=False),
            schema=version_table_schema)
        if opts.get("version_table_pk", True):
            self._version.append_constraint(
                PrimaryKeyConstraint(
                    'version_num', name="%s_pkc" % version_table
                )
            )

        self._start_from_rev = opts.get("starting_rev")
        self.impl = ddl.DefaultImpl.get_by_dialect(dialect)(
            dialect, self.connection, self.as_sql,
            transactional_ddl,
            self.output_buffer,
            opts
        )
        log.info("Context impl %s.", self.impl.__class__.__name__)
        if self.as_sql:
            log.info("Generating static SQL")
        log.info("Will assume %s DDL.",
                 "transactional" if self.impl.transactional_ddl
                 else "non-transactional")

    @classmethod
    def configure(cls,
                  connection=None,
                  url=None,
                  dialect_name=None,
                  dialect=None,
                  environment_context=None,
                  opts=None,
                  ):
        """Create a new :class:`.MigrationContext`.

        This is a factory method usually called
        by :meth:`.EnvironmentContext.configure`.

        :param connection: a :class:`~sqlalchemy.engine.Connection`
         to use for SQL execution in "online" mode.  When present,
         is also used to determine the type of dialect in use.
        :param url: a string database url, or a
         :class:`sqlalchemy.engine.url.URL` object.
         The type of dialect to be used will be derived from this if
         ``connection`` is not passed.
        :param dialect_name: string name of a dialect, such as
         "postgresql", "mssql", etc.  The type of dialect to be used will be
         derived from this if ``connection`` and ``url`` are not passed.
        :param opts: dictionary of options.  Most other options
         accepted by :meth:`.EnvironmentContext.configure` are passed via
         this dictionary.

        """
        if opts is None:
            opts = {}

        if connection:
            if not isinstance(connection, Connection):
                util.warn(
                    "'connection' argument to configure() is expected "
                    "to be a sqlalchemy.engine.Connection instance, "
                    "got %r" % connection)
            dialect = connection.dialect
        elif url:
            url = sqla_url.make_url(url)
            dialect = url.get_dialect()()
        elif dialect_name:
            url = sqla_url.make_url("%s://" % dialect_name)
            dialect = url.get_dialect()()
        elif not dialect:
            raise Exception("Connection, url, or dialect_name is required.")

        return MigrationContext(dialect, connection, opts, environment_context)

    def begin_transaction(self, _per_migration=False):
        transaction_now = _per_migration == self._transaction_per_migration

        if not transaction_now:
            @contextmanager
            def do_nothing():
                yield
            return do_nothing()

        elif not self.impl.transactional_ddl:
            @contextmanager
            def do_nothing():
                yield
            return do_nothing()
        elif self.as_sql:
            @contextmanager
            def begin_commit():
                self.impl.emit_begin()
                yield
                self.impl.emit_commit()
            return begin_commit()
        else:
            return self.bind.begin()

    def get_current_revision(self):
        """Return the current revision, usually that which is present
        in the ``alembic_version`` table in the database.

        This method intends to be used only for a migration stream that
        does not contain unmerged branches in the target database;
        if there are multiple branches present, an exception is raised.
        The :meth:`.MigrationContext.get_current_heads` should be preferred
        over this method going forward in order to be compatible with
        branch migration support.

        If this :class:`.MigrationContext` was configured in "offline"
        mode, that is with ``as_sql=True``, the ``starting_rev``
        parameter is returned instead, if any.

        """
        heads = self.get_current_heads()
        if len(heads) == 0:
            return None
        elif len(heads) > 1:
            raise util.CommandError(
                "Version table '%s' has more than one head present; "
                "please use get_current_heads()" % self.version_table)
        else:
            return heads[0]

    def get_current_heads(self):
        """Return a tuple of the current 'head versions' that are represented
        in the target database.

        For a migration stream without branches, this will be a single
        value, synonymous with that of
        :meth:`.MigrationContext.get_current_revision`.   However when multiple
        unmerged branches exist within the target database, the returned tuple
        will contain a value for each head.

        If this :class:`.MigrationContext` was configured in "offline"
        mode, that is with ``as_sql=True``, the ``starting_rev``
        parameter is returned in a one-length tuple.

        If no version table is present, or if there are no revisions
        present, an empty tuple is returned.

        .. versionadded:: 0.7.0

        """
        if self.as_sql:
            start_from_rev = self._start_from_rev
            if start_from_rev == 'base':
                start_from_rev = None
            elif start_from_rev is not None and self.script:
                start_from_rev = \
                    self.script.get_revision(start_from_rev).revision

            return util.to_tuple(start_from_rev, default=())
        else:
            if self._start_from_rev:
                raise util.CommandError(
                    "Can't specify current_rev to context "
                    "when using a database connection")
            if not self._has_version_table():
                return ()
        return tuple(
            row[0] for row in self.connection.execute(self._version.select())
        )

    def _ensure_version_table(self):
        self._version.create(self.connection, checkfirst=True)

    def _has_version_table(self):
        return self.connection.dialect.has_table(
            self.connection, self.version_table, self.version_table_schema)

    def stamp(self, script_directory, revision):
        """Stamp the version table with a specific revision.

        This method calculates those branches to which the given revision
        can apply, and updates those branches as though they were migrated
        towards that revision (either up or down).  If no current branches
        include the revision, it is added as a new branch head.

        .. versionadded:: 0.7.0

        """
        heads = self.get_current_heads()
        if not self.as_sql and not heads:
            self._ensure_version_table()
        head_maintainer = HeadMaintainer(self, heads)
        for step in script_directory._stamp_revs(revision, heads):
            head_maintainer.update_to_step(step)

    def run_migrations(self, **kw):
        """Run the migration scripts established for this
        :class:`.MigrationContext`, if any.

        The commands in :mod:`alembic.command` will set up a function
        that is ultimately passed to the :class:`.MigrationContext`
        as the ``fn`` argument.  This function represents the "work"
        that will be done when :meth:`.MigrationContext.run_migrations`
        is called, typically from within the ``env.py`` script of the
        migration environment.  The "work function" then provides an iterable
        of version callables and other version information which
        in the case of the ``upgrade`` or ``downgrade`` commands are the
        list of version scripts to invoke.  Other commands yield nothing,
        in the case that a command wants to run some other operation
        against the database such as the ``current`` or ``stamp`` commands.

        :param \**kw: keyword arguments here will be passed to each
         migration callable, that is the ``upgrade()`` or ``downgrade()``
         method within revision scripts.

        """
        self.impl.start_migrations()

        heads = self.get_current_heads()
        if not self.as_sql and not heads:
            self._ensure_version_table()

        head_maintainer = HeadMaintainer(self, heads)

        starting_in_transaction = not self.as_sql and \
            self._in_connection_transaction()

        for step in self._migrations_fn(heads, self):
            with self.begin_transaction(_per_migration=True):
                if self.as_sql and not head_maintainer.heads:
                    # for offline mode, include a CREATE TABLE from
                    # the base
                    self._version.create(self.connection)
                log.info("Running %s", step)
                if self.as_sql:
                    self.impl.static_output("-- Running %s" % (step.short_log,))
                step.migration_fn(**kw)

                # previously, we wouldn't stamp per migration
                # if we were in a transaction, however given the more
                # complex model that involves any number of inserts
                # and row-targeted updates and deletes, it's simpler for now
                # just to run the operations on every version
                head_maintainer.update_to_step(step)

            if not starting_in_transaction and not self.as_sql and \
                not self.impl.transactional_ddl and \
                    self._in_connection_transaction():
                raise util.CommandError(
                    "Migration \"%s\" has left an uncommitted "
                    "transaction opened; transactional_ddl is False so "
                    "Alembic is not committing transactions"
                    % step)

        if self.as_sql and not head_maintainer.heads:
            self._version.drop(self.connection)

    def _in_connection_transaction(self):
        try:
            meth = self.connection.in_transaction
        except AttributeError:
            return False
        else:
            return meth()

    def execute(self, sql, execution_options=None):
        """Execute a SQL construct or string statement.

        The underlying execution mechanics are used, that is
        if this is "offline mode" the SQL is written to the
        output buffer, otherwise the SQL is emitted on
        the current SQLAlchemy connection.

        """
        self.impl._exec(sql, execution_options)

    def _stdout_connection(self, connection):
        def dump(construct, *multiparams, **params):
            self.impl._exec(construct)

        return MockEngineStrategy.MockConnection(self.dialect, dump)

    @property
    def bind(self):
        """Return the current "bind".

        In online mode, this is an instance of
        :class:`sqlalchemy.engine.Connection`, and is suitable
        for ad-hoc execution of any kind of usage described
        in :ref:`sqlexpression_toplevel` as well as
        for usage with the :meth:`sqlalchemy.schema.Table.create`
        and :meth:`sqlalchemy.schema.MetaData.create_all` methods
        of :class:`~sqlalchemy.schema.Table`,
        :class:`~sqlalchemy.schema.MetaData`.

        Note that when "standard output" mode is enabled,
        this bind will be a "mock" connection handler that cannot
        return results and is only appropriate for a very limited
        subset of commands.

        """
        return self.connection

    @property
    def config(self):
        """Return the :class:`.Config` used by the current environment, if any.

        .. versionadded:: 0.6.6

        """
        if self.environment_context:
            return self.environment_context.config
        else:
            return None

    def _compare_type(self, inspector_column, metadata_column):
        if self._user_compare_type is False:
            return False

        if callable(self._user_compare_type):
            user_value = self._user_compare_type(
                self,
                inspector_column,
                metadata_column,
                inspector_column.type,
                metadata_column.type
            )
            if user_value is not None:
                return user_value

        return self.impl.compare_type(
            inspector_column,
            metadata_column)

    def _compare_server_default(self, inspector_column,
                                metadata_column,
                                rendered_metadata_default,
                                rendered_column_default):

        if self._user_compare_server_default is False:
            return False

        if callable(self._user_compare_server_default):
            user_value = self._user_compare_server_default(
                self,
                inspector_column,
                metadata_column,
                rendered_column_default,
                metadata_column.server_default,
                rendered_metadata_default
            )
            if user_value is not None:
                return user_value

        return self.impl.compare_server_default(
            inspector_column,
            metadata_column,
            rendered_metadata_default,
            rendered_column_default)


class HeadMaintainer(object):
    def __init__(self, context, heads):
        self.context = context
        self.heads = set(heads)

    def _insert_version(self, version):
        assert version not in self.heads
        self.heads.add(version)

        self.context.impl._exec(
            self.context._version.insert().
            values(
                version_num=literal_column("'%s'" % version)
            )
        )

    def _delete_version(self, version):
        self.heads.remove(version)

        ret = self.context.impl._exec(
            self.context._version.delete().where(
                self.context._version.c.version_num ==
                literal_column("'%s'" % version)))
        if not self.context.as_sql and ret.rowcount != 1:
            raise util.CommandError(
                "Online migration expected to match one "
                "row when deleting '%s' in '%s'; "
                "%d found"
                % (version,
                   self.context.version_table, ret.rowcount))

    def _update_version(self, from_, to_):
        assert to_ not in self.heads
        self.heads.remove(from_)
        self.heads.add(to_)

        ret = self.context.impl._exec(
            self.context._version.update().
            values(version_num=literal_column("'%s'" % to_)).where(
                self.context._version.c.version_num
                == literal_column("'%s'" % from_))
        )
        if not self.context.as_sql and ret.rowcount != 1:
            raise util.CommandError(
                "Online migration expected to match one "
                "row when updating '%s' to '%s' in '%s'; "
                "%d found"
                % (from_, to_, self.context.version_table, ret.rowcount))

    def update_to_step(self, step):
        if step.should_delete_branch(self.heads):
            vers = step.delete_version_num
            log.debug("branch delete %s", vers)
            self._delete_version(vers)
        elif step.should_create_branch(self.heads):
            vers = step.insert_version_num
            log.debug("new branch insert %s", vers)
            self._insert_version(vers)
        elif step.should_merge_branches(self.heads):
            # delete revs, update from rev, update to rev
            (delete_revs, update_from_rev,
             update_to_rev) = step.merge_branch_idents(self.heads)
            log.debug(
                "merge, delete %s, update %s to %s",
                delete_revs, update_from_rev, update_to_rev)
            for delrev in delete_revs:
                self._delete_version(delrev)
            self._update_version(update_from_rev, update_to_rev)
        elif step.should_unmerge_branches(self.heads):
            (update_from_rev, update_to_rev,
             insert_revs) = step.unmerge_branch_idents(self.heads)
            log.debug(
                "unmerge, insert %s, update %s to %s",
                insert_revs, update_from_rev, update_to_rev)
            for insrev in insert_revs:
                self._insert_version(insrev)
            self._update_version(update_from_rev, update_to_rev)
        else:
            from_, to_ = step.update_version_num(self.heads)
            log.debug("update %s to %s", from_, to_)
            self._update_version(from_, to_)


class MigrationStep(object):
    @property
    def name(self):
        return self.migration_fn.__name__

    @classmethod
    def upgrade_from_script(cls, revision_map, script):
        return RevisionStep(revision_map, script, True)

    @classmethod
    def downgrade_from_script(cls, revision_map, script):
        return RevisionStep(revision_map, script, False)

    @property
    def is_downgrade(self):
        return not self.is_upgrade

    @property
    def short_log(self):
        return "%s %s -> %s" % (
            self.name,
            util.format_as_comma(self.from_revisions_no_deps),
            util.format_as_comma(self.to_revisions_no_deps)
        )

    def __str__(self):
        if self.doc:
            return "%s %s -> %s, %s" % (
                self.name,
                util.format_as_comma(self.from_revisions_no_deps),
                util.format_as_comma(self.to_revisions_no_deps),
                self.doc
            )
        else:
            return self.short_log


class RevisionStep(MigrationStep):
    def __init__(self, revision_map, revision, is_upgrade):
        self.revision_map = revision_map
        self.revision = revision
        self.is_upgrade = is_upgrade
        if is_upgrade:
            self.migration_fn = revision.module.upgrade
        else:
            self.migration_fn = revision.module.downgrade

    def __repr__(self):
        return "RevisionStep(%r, is_upgrade=%r)" % (
            self.revision.revision, self.is_upgrade
        )

    def __eq__(self, other):
        return isinstance(other, RevisionStep) and \
            other.revision == self.revision and \
            self.is_upgrade == other.is_upgrade

    @property
    def doc(self):
        return self.revision.doc

    @property
    def from_revisions(self):
        if self.is_upgrade:
            return self.revision._all_down_revisions
        else:
            return (self.revision.revision, )

    @property
    def from_revisions_no_deps(self):
        if self.is_upgrade:
            return self.revision._versioned_down_revisions
        else:
            return (self.revision.revision, )

    @property
    def to_revisions(self):
        if self.is_upgrade:
            return (self.revision.revision, )
        else:
            return self.revision._all_down_revisions

    @property
    def to_revisions_no_deps(self):
        if self.is_upgrade:
            return (self.revision.revision, )
        else:
            return self.revision._versioned_down_revisions

    @property
    def _has_scalar_down_revision(self):
        return len(self.revision._all_down_revisions) == 1

    def should_delete_branch(self, heads):
        """A delete is when we are a. in a downgrade and b.
        we are going to the "base" or we are going to a version that
        is implied as a dependency on another version that is remaining.

        """
        if not self.is_downgrade:
            return False

        if self.revision.revision not in heads:
            return False

        downrevs = self.revision._all_down_revisions

        if not downrevs:
            # is a base
            return True
        else:
            # determine what the ultimate "to_revisions" for an
            # unmerge would be.  If there are none, then we're a delete.
            to_revisions = self._unmerge_to_revisions(heads)
            return not to_revisions

    def merge_branch_idents(self, heads):
        other_heads = set(heads).difference(self.from_revisions)

        if other_heads:
            ancestors = set(
                r.revision for r in
                self.revision_map._get_ancestor_nodes(
                    self.revision_map.get_revisions(other_heads),
                    check=False
                )
            )
            from_revisions = list(
                set(self.from_revisions).difference(ancestors))
        else:
            from_revisions = list(self.from_revisions)

        return (
            # delete revs, update from rev, update to rev
            list(from_revisions[0:-1]), from_revisions[-1],
            self.to_revisions[0]
        )

    def _unmerge_to_revisions(self, heads):
        other_heads = set(heads).difference([self.revision.revision])
        if other_heads:
            ancestors = set(
                r.revision for r in
                self.revision_map._get_ancestor_nodes(
                    self.revision_map.get_revisions(other_heads),
                    check=False
                )
            )
            return list(set(self.to_revisions).difference(ancestors))
        else:
            return self.to_revisions

    def unmerge_branch_idents(self, heads):
        to_revisions = self._unmerge_to_revisions(heads)

        return (
            # update from rev, update to rev, insert revs
            self.from_revisions[0], to_revisions[-1],
            to_revisions[0:-1]
        )

    def should_create_branch(self, heads):
        if not self.is_upgrade:
            return False

        downrevs = self.revision._all_down_revisions

        if not downrevs:
            # is a base
            return True
        else:
            # none of our downrevs are present, so...
            # we have to insert our version.   This is true whether
            # or not there is only one downrev, or multiple (in the latter
            # case, we're a merge point.)
            if not heads.intersection(downrevs):
                return True
            else:
                return False

    def should_merge_branches(self, heads):
        if not self.is_upgrade:
            return False

        downrevs = self.revision._all_down_revisions

        if len(downrevs) > 1 and \
                len(heads.intersection(downrevs)) > 1:
            return True

        return False

    def should_unmerge_branches(self, heads):
        if not self.is_downgrade:
            return False

        downrevs = self.revision._all_down_revisions

        if self.revision.revision in heads and len(downrevs) > 1:
            return True

        return False

    def update_version_num(self, heads):
        if not self._has_scalar_down_revision:
            downrev = heads.intersection(self.revision._all_down_revisions)
            assert len(downrev) == 1, \
                "Can't do an UPDATE because downrevision is ambiguous"
            down_revision = list(downrev)[0]
        else:
            down_revision = self.revision._all_down_revisions[0]

        if self.is_upgrade:
            return down_revision, self.revision.revision
        else:
            return self.revision.revision, down_revision

    @property
    def delete_version_num(self):
        return self.revision.revision

    @property
    def insert_version_num(self):
        return self.revision.revision


class StampStep(MigrationStep):
    def __init__(self, from_, to_, is_upgrade, branch_move):
        self.from_ = util.to_tuple(from_, default=())
        self.to_ = util.to_tuple(to_, default=())
        self.is_upgrade = is_upgrade
        self.branch_move = branch_move
        self.migration_fn = self.stamp_revision

    doc = None

    def stamp_revision(self, **kw):
        return None

    def __eq__(self, other):
        return isinstance(other, StampStep) and \
            other.from_revisions == self.revisions and \
            other.to_revisions == self.to_revisions and \
            other.branch_move == self.branch_move and \
            self.is_upgrade == other.is_upgrade

    @property
    def from_revisions(self):
        return self.from_

    @property
    def to_revisions(self):
        return self.to_

    @property
    def from_revisions_no_deps(self):
        return self.from_

    @property
    def to_revisions_no_deps(self):
        return self.to_

    @property
    def delete_version_num(self):
        assert len(self.from_) == 1
        return self.from_[0]

    @property
    def insert_version_num(self):
        assert len(self.to_) == 1
        return self.to_[0]

    def update_version_num(self, heads):
        assert len(self.from_) == 1
        assert len(self.to_) == 1
        return self.from_[0], self.to_[0]

    def merge_branch_idents(self, heads):
        return (
            # delete revs, update from rev, update to rev
            list(self.from_[0:-1]), self.from_[-1],
            self.to_[0]
        )

    def unmerge_branch_idents(self, heads):
        return (
            # update from rev, update to rev, insert revs
            self.from_[0], self.to_[-1],
            list(self.to_[0:-1])
        )

    def should_delete_branch(self, heads):
        return self.is_downgrade and self.branch_move

    def should_create_branch(self, heads):
        return self.is_upgrade and self.branch_move

    def should_merge_branches(self, heads):
        return len(self.from_) > 1

    def should_unmerge_branches(self, heads):
        return len(self.to_) > 1
