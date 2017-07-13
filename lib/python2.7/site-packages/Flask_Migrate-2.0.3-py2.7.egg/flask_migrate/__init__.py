import os
import argparse
from flask import current_app
from flask_script import Manager
from alembic import __version__ as __alembic_version__
from alembic.config import Config as AlembicConfig
from alembic import command


alembic_version = tuple([int(v) for v in __alembic_version__.split('.')[0:3]])


class _MigrateConfig(object):
    def __init__(self, migrate, db, **kwargs):
        self.migrate = migrate
        self.db = db
        self.directory = migrate.directory
        self.configure_args = kwargs

    @property
    def metadata(self):
        """
        Backwards compatibility, in old releases app.extensions['migrate']
        was set to db, and env.py accessed app.extensions['migrate'].metadata
        """
        return self.db.metadata


class Config(AlembicConfig):
    def get_template_directory(self):
        package_dir = os.path.abspath(os.path.dirname(__file__))
        return os.path.join(package_dir, 'templates')


class Migrate(object):
    def __init__(self, app=None, db=None, directory='migrations', **kwargs):
        self.configure_callbacks = []
        self.db = db
        self.directory = directory
        self.alembic_ctx_kwargs = kwargs
        if app is not None and db is not None:
            self.init_app(app, db, directory)

    def init_app(self, app, db=None, directory=None, **kwargs):
        self.db = db or self.db
        self.directory = directory or self.directory
        self.alembic_ctx_kwargs.update(kwargs)
        if not hasattr(app, 'extensions'):
            app.extensions = {}
        app.extensions['migrate'] = _MigrateConfig(self, self.db,
            **self.alembic_ctx_kwargs)

    def configure(self, f):
        self.configure_callbacks.append(f)
        return f

    def call_configure_callbacks(self, config):
        for f in self.configure_callbacks:
            config = f(config)
        return config

    def get_config(self, directory, x_arg=None, opts=None):
        if directory is None:
            directory = self.directory
        config = Config(os.path.join(directory, 'alembic.ini'))
        config.set_main_option('script_location', directory)
        if config.cmd_opts is None:
            config.cmd_opts = argparse.Namespace()
        for opt in opts or []:
            setattr(config.cmd_opts, opt, True)
        if not hasattr(config.cmd_opts, 'x'):
            if x_arg is not None:
                setattr(config.cmd_opts, 'x', [])
                if isinstance(x_arg, list) or isinstance(x_arg, tuple):
                    for x in x_arg:
                        config.cmd_opts.x.append(x)
                else:
                    config.cmd_opts.x.append(x_arg)
            else:
                setattr(config.cmd_opts, 'x', None)
        return self.call_configure_callbacks(config)


MigrateCommand = Manager(usage='Perform database migrations')


@MigrateCommand.option('-d', '--directory', dest='directory', default=None,
                       help=("migration script directory (default is "
                             "'migrations')"))
@MigrateCommand.option('--multidb', dest='multidb', action='store_true',
                       default=False,
                       help=("Multiple databases migraton (default is "
                             "False)"))
def init(directory=None, multidb=False):
    """Creates a new migration repository"""
    if directory is None:
        directory = current_app.extensions['migrate'].directory
    config = Config()
    config.set_main_option('script_location', directory)
    config.config_file_name = os.path.join(directory, 'alembic.ini')
    config = current_app.extensions['migrate'].\
        migrate.call_configure_callbacks(config)
    if multidb:
        command.init(config, directory, 'flask-multidb')
    else:
        command.init(config, directory, 'flask')


@MigrateCommand.option('--rev-id', dest='rev_id', default=None,
                       help=('Specify a hardcoded revision id instead of '
                             'generating one'))
@MigrateCommand.option('--version-path', dest='version_path', default=None,
                       help=('Specify specific path from config for version '
                             'file'))
@MigrateCommand.option('--branch-label', dest='branch_label', default=None,
                       help=('Specify a branch label to apply to the new '
                             'revision'))
@MigrateCommand.option('--splice', dest='splice', action='store_true',
                       default=False,
                       help=('Allow a non-head revision as the "head" to '
                             'splice onto'))
@MigrateCommand.option('--head', dest='head', default='head',
                       help=('Specify head revision or <branchname>@head to '
                             'base new revision on'))
@MigrateCommand.option('--sql', dest='sql', action='store_true', default=False,
                       help=("Don't emit SQL to database - dump to standard "
                             "output instead"))
@MigrateCommand.option('--autogenerate', dest='autogenerate',
                       action='store_true', default=False,
                       help=('Populate revision script with candidate '
                             'migration operations, based on comparison of '
                             'database to model'))
@MigrateCommand.option('-m', '--message', dest='message', default=None,
                       help='Revision message')
@MigrateCommand.option('-d', '--directory', dest='directory', default=None,
                       help=("migration script directory (default is "
                             "'migrations')"))
def revision(directory=None, message=None, autogenerate=False, sql=False,
             head='head', splice=False, branch_label=None, version_path=None,
             rev_id=None):
    """Create a new revision file."""
    config = current_app.extensions['migrate'].migrate.get_config(directory)
    if alembic_version >= (0, 7, 0):
        command.revision(config, message, autogenerate=autogenerate, sql=sql,
                         head=head, splice=splice, branch_label=branch_label,
                         version_path=version_path, rev_id=rev_id)
    else:
        command.revision(config, message, autogenerate=autogenerate, sql=sql)


@MigrateCommand.option('--rev-id', dest='rev_id', default=None,
                       help=('Specify a hardcoded revision id instead of '
                             'generating one'))
@MigrateCommand.option('--version-path', dest='version_path', default=None,
                       help=('Specify specific path from config for version '
                             'file'))
@MigrateCommand.option('--branch-label', dest='branch_label', default=None,
                       help=('Specify a branch label to apply to the new '
                             'revision'))
@MigrateCommand.option('--splice', dest='splice', action='store_true',
                       default=False,
                       help=('Allow a non-head revision as the "head" to '
                             'splice onto'))
@MigrateCommand.option('--head', dest='head', default='head',
                       help=('Specify head revision or <branchname>@head to '
                             'base new revision on'))
@MigrateCommand.option('--sql', dest='sql', action='store_true', default=False,
                       help=("Don't emit SQL to database - dump to standard "
                             "output instead"))
@MigrateCommand.option('-m', '--message', dest='message', default=None)
@MigrateCommand.option('-d', '--directory', dest='directory', default=None,
                       help=("migration script directory (default is "
                             "'migrations')"))
def migrate(directory=None, message=None, sql=False, head='head', splice=False,
            branch_label=None, version_path=None, rev_id=None):
    """Alias for 'revision --autogenerate'"""
    config = current_app.extensions['migrate'].migrate.get_config(
        directory, opts=['autogenerate'])
    if alembic_version >= (0, 7, 0):
        command.revision(config, message, autogenerate=True, sql=sql,
                         head=head, splice=splice, branch_label=branch_label,
                         version_path=version_path, rev_id=rev_id)
    else:
        command.revision(config, message, autogenerate=True, sql=sql)


@MigrateCommand.option('revision', nargs='?', default='head',
                       help="revision identifier")
@MigrateCommand.option('-d', '--directory', dest='directory', default=None,
                       help=("migration script directory (default is "
                             "'migrations')"))
def edit(directory=None, revision='current'):
    """Edit current revision."""
    if alembic_version >= (0, 8, 0):
        config = current_app.extensions['migrate'].migrate.get_config(
            directory)
        command.edit(config, revision)
    else:
        raise RuntimeError('Alembic 0.8.0 or greater is required')


@MigrateCommand.option('--rev-id', dest='rev_id', default=None,
                       help=('Specify a hardcoded revision id instead of '
                             'generating one'))
@MigrateCommand.option('--branch-label', dest='branch_label', default=None,
                       help=('Specify a branch label to apply to the new '
                             'revision'))
@MigrateCommand.option('-m', '--message', dest='message', default=None)
@MigrateCommand.option('revisions', nargs='+',
                       help='one or more revisions, or "heads" for all heads')
@MigrateCommand.option('-d', '--directory', dest='directory', default=None,
                       help=("migration script directory (default is "
                             "'migrations')"))
def merge(directory=None, revisions='', message=None, branch_label=None,
          rev_id=None):
    """Merge two revisions together.  Creates a new migration file"""
    if alembic_version >= (0, 7, 0):
        config = current_app.extensions['migrate'].migrate.get_config(
            directory)
        command.merge(config, revisions, message=message,
                      branch_label=branch_label, rev_id=rev_id)
    else:
        raise RuntimeError('Alembic 0.7.0 or greater is required')


@MigrateCommand.option('--tag', dest='tag', default=None,
                       help=("Arbitrary 'tag' name - can be used by custom "
                             "env.py scripts"))
@MigrateCommand.option('--sql', dest='sql', action='store_true', default=False,
                       help=("Don't emit SQL to database - dump to standard "
                             "output instead"))
@MigrateCommand.option('revision', nargs='?', default='head',
                       help="revision identifier")
@MigrateCommand.option('-d', '--directory', dest='directory', default=None,
                       help=("migration script directory (default is "
                             "'migrations')"))
@MigrateCommand.option('-x', '--x-arg', dest='x_arg', default=None,
                       action='append', help=("Additional arguments consumed "
                                              "by custom env.py scripts"))
def upgrade(directory=None, revision='head', sql=False, tag=None, x_arg=None):
    """Upgrade to a later version"""
    config = current_app.extensions['migrate'].migrate.get_config(directory,
                                                                  x_arg=x_arg)
    command.upgrade(config, revision, sql=sql, tag=tag)


@MigrateCommand.option('--tag', dest='tag', default=None,
                       help=("Arbitrary 'tag' name - can be used by custom "
                             "env.py scripts"))
@MigrateCommand.option('--sql', dest='sql', action='store_true', default=False,
                       help=("Don't emit SQL to database - dump to standard "
                             "output instead"))
@MigrateCommand.option('revision', nargs='?', default="-1",
                       help="revision identifier")
@MigrateCommand.option('-d', '--directory', dest='directory', default=None,
                       help=("migration script directory (default is "
                             "'migrations')"))
@MigrateCommand.option('-x', '--x-arg', dest='x_arg', default=None,
                       action='append', help=("Additional arguments consumed "
                                              "by custom env.py scripts"))
def downgrade(directory=None, revision='-1', sql=False, tag=None, x_arg=None):
    """Revert to a previous version"""
    config = current_app.extensions['migrate'].migrate.get_config(directory,
                                                                  x_arg=x_arg)
    if sql and revision == '-1':
        revision = 'head:-1'
    command.downgrade(config, revision, sql=sql, tag=tag)


@MigrateCommand.option('revision', nargs='?', default="head",
                       help="revision identifier")
@MigrateCommand.option('-d', '--directory', dest='directory', default=None,
                       help=("migration script directory (default is "
                             "'migrations')"))
def show(directory=None, revision='head'):
    """Show the revision denoted by the given symbol."""
    if alembic_version >= (0, 7, 0):
        config = current_app.extensions['migrate'].migrate.get_config(
            directory)
        command.show(config, revision)
    else:
        raise RuntimeError('Alembic 0.7.0 or greater is required')


@MigrateCommand.option('-v', '--verbose', dest='verbose', action='store_true',
                       default=False, help='Use more verbose output')
@MigrateCommand.option('-r', '--rev-range', dest='rev_range', default=None,
                       help='Specify a revision range; format is [start]:[end]')
@MigrateCommand.option('-d', '--directory', dest='directory', default=None,
                       help=("migration script directory (default is "
                             "'migrations')"))
def history(directory=None, rev_range=None, verbose=False):
    """List changeset scripts in chronological order."""
    config = current_app.extensions['migrate'].migrate.get_config(directory)
    if alembic_version >= (0, 7, 0):
        command.history(config, rev_range, verbose=verbose)
    else:
        command.history(config, rev_range)


@MigrateCommand.option('--resolve-dependencies', dest='resolve_dependencies',
                       action='store_true', default=False,
                       help='Treat dependency versions as down revisions')
@MigrateCommand.option('-v', '--verbose', dest='verbose', action='store_true',
                       default=False, help='Use more verbose output')
@MigrateCommand.option('-d', '--directory', dest='directory', default=None,
                       help=("migration script directory (default is "
                             "'migrations')"))
def heads(directory=None, verbose=False, resolve_dependencies=False):
    """Show current available heads in the script directory"""
    if alembic_version >= (0, 7, 0):
        config = current_app.extensions['migrate'].migrate.get_config(
            directory)
        command.heads(config, verbose=verbose,
                      resolve_dependencies=resolve_dependencies)
    else:
        raise RuntimeError('Alembic 0.7.0 or greater is required')


@MigrateCommand.option('-v', '--verbose', dest='verbose', action='store_true',
                       default=False, help='Use more verbose output')
@MigrateCommand.option('-d', '--directory', dest='directory', default=None,
                       help=("migration script directory (default is "
                             "'migrations')"))
def branches(directory=None, verbose=False):
    """Show current branch points"""
    config = current_app.extensions['migrate'].migrate.get_config(directory)
    if alembic_version >= (0, 7, 0):
        command.branches(config, verbose=verbose)
    else:
        command.branches(config)


@MigrateCommand.option('--head-only', dest='head_only', action='store_true',
                       default=False,
                       help='Deprecated. Use --verbose for additional output')
@MigrateCommand.option('-v', '--verbose', dest='verbose', action='store_true',
                       default=False, help='Use more verbose output')
@MigrateCommand.option('-d', '--directory', dest='directory', default=None,
                       help=("migration script directory (default is "
                             "'migrations')"))
def current(directory=None, verbose=False, head_only=False):
    """Display the current revision for each database."""
    config = current_app.extensions['migrate'].migrate.get_config(directory)
    if alembic_version >= (0, 7, 0):
        command.current(config, verbose=verbose, head_only=head_only)
    else:
        command.current(config)


@MigrateCommand.option('--tag', dest='tag', default=None,
                       help=("Arbitrary 'tag' name - can be used by custom "
                             "env.py scripts"))
@MigrateCommand.option('--sql', dest='sql', action='store_true', default=False,
                       help=("Don't emit SQL to database - dump to standard "
                             "output instead"))
@MigrateCommand.option('revision', default=None, help="revision identifier")
@MigrateCommand.option('-d', '--directory', dest='directory', default=None,
                       help=("migration script directory (default is "
                             "'migrations')"))
def stamp(directory=None, revision='head', sql=False, tag=None):
    """'stamp' the revision table with the given revision; don't run any
    migrations"""
    config = current_app.extensions['migrate'].migrate.get_config(directory)
    command.stamp(config, revision, sql=sql, tag=tag)
