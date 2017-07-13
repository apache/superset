from __future__ import with_statement
from alembic import context
from sqlalchemy import engine_from_config, pool, MetaData
from logging.config import fileConfig
import logging

USE_TWOPHASE = False

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
fileConfig(config.config_file_name)
logger = logging.getLogger('alembic.env')

# add your model's MetaData object here
# for 'autogenerate' support
# from myapp import mymodel
# target_metadata = mymodel.Base.metadata
from flask import current_app
config.set_main_option('sqlalchemy.url',
                       current_app.config.get('SQLALCHEMY_DATABASE_URI'))
bind_names = []
for name, url in current_app.config.get("SQLALCHEMY_BINDS").items():
    context.config.set_section_option(name, "sqlalchemy.url", url)
    bind_names.append(name)
target_metadata = current_app.extensions['migrate'].db.metadata


# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def get_metadata(bind):
    """Return the metadata for a bind."""
    if bind == '':
        bind = None
    m = MetaData()
    for t in target_metadata.tables.values():
        if t.info.get('bind_key') == bind:
            t.tometadata(m)
    return m


def run_migrations_offline():
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    # for the --sql use case, run migrations for each URL into
    # individual files.

    engines = {'': {'url': context.config.get_main_option('sqlalchemy.url')}}
    for name in bind_names:
        engines[name] = rec = {}
        rec['url'] = context.config.get_section_option(name,
                                                       "sqlalchemy.url")

    for name, rec in engines.items():
        logger.info("Migrating database %s" % (name or '<default>'))
        file_ = "%s.sql" % name
        logger.info("Writing output to %s" % file_)
        with open(file_, 'w') as buffer:
            context.configure(url=rec['url'], output_buffer=buffer,
                              target_metadata=get_metadata(name),
                              literal_binds=True)
            with context.begin_transaction():
                context.run_migrations(engine_name=name)


def run_migrations_online():
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """

    # this callback is used to prevent an auto-migration from being generated
    # when there are no changes to the schema
    # reference: http://alembic.readthedocs.org/en/latest/cookbook.html
    def process_revision_directives(context, revision, directives):
        if getattr(config.cmd_opts, 'autogenerate', False):
            script = directives[0]
            if len(script.upgrade_ops_list) >= len(bind_names) + 1:
                empty = True
                for upgrade_ops in script.upgrade_ops_list:
                    if not upgrade_ops.is_empty():
                        empty = False
                if empty:
                    directives[:] = []
                    logger.info('No changes in schema detected.')

    # for the direct-to-DB use case, start a transaction on all
    # engines, then run all migrations, then commit all transactions.
    engines = {'': {'engine': engine_from_config(
        config.get_section(config.config_ini_section),
        prefix='sqlalchemy.',
        poolclass=pool.NullPool)}}
    for name in bind_names:
        engines[name] = rec = {}
        rec['engine'] = engine_from_config(
            context.config.get_section(name),
            prefix='sqlalchemy.',
            poolclass=pool.NullPool)

    for name, rec in engines.items():
        engine = rec['engine']
        rec['connection'] = conn = engine.connect()

        if USE_TWOPHASE:
            rec['transaction'] = conn.begin_twophase()
        else:
            rec['transaction'] = conn.begin()

    try:
        for name, rec in engines.items():
            logger.info("Migrating database %s" % (name or '<default>'))
            context.configure(
                connection=rec['connection'],
                upgrade_token="%s_upgrades" % name,
                downgrade_token="%s_downgrades" % name,
                target_metadata=get_metadata(name),
                process_revision_directives=process_revision_directives,
                **current_app.extensions['migrate'].configure_args
            )
            context.run_migrations(engine_name=name)

        if USE_TWOPHASE:
            for rec in engines.values():
                rec['transaction'].prepare()

        for rec in engines.values():
            rec['transaction'].commit()
    except:
        for rec in engines.values():
            rec['transaction'].rollback()
        raise
    finally:
        for rec in engines.values():
            rec['connection'].close()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
