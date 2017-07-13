"""Pylons bootstrap environment.

Place 'pylons_config_file' into alembic.ini, and the application will
be loaded from there.

"""
from alembic import context
from paste.deploy import loadapp
from logging.config import fileConfig
from sqlalchemy.engine.base import Engine


try:
    # if pylons app already in, don't create a new app
    from pylons import config as pylons_config
    pylons_config['__file__']
except:
    config = context.config
    # can use config['__file__'] here, i.e. the Pylons
    # ini file, instead of alembic.ini
    config_file = config.get_main_option('pylons_config_file')
    fileConfig(config_file)
    wsgi_app = loadapp('config:%s' % config_file, relative_to='.')


# customize this section for non-standard engine configurations.
meta = __import__("%s.model.meta" % wsgi_app.config['pylons.package']).model.meta

# add your model's MetaData object here
# for 'autogenerate' support
# from myapp import mymodel
# target_metadata = mymodel.Base.metadata
target_metadata = None


def run_migrations_offline():
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    context.configure(
        url=meta.engine.url, target_metadata=target_metadata,
        literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    # specify here how the engine is acquired
    # engine = meta.engine
    raise NotImplementedError("Please specify engine connectivity here")

    with engine.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
