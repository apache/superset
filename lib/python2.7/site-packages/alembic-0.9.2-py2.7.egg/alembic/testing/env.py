#!coding: utf-8

import os
import shutil
import textwrap

from ..util.compat import u
from ..script import Script, ScriptDirectory
from .. import util
from . import engines
from . import provision


def _get_staging_directory():
    if provision.FOLLOWER_IDENT:
        return "scratch_%s" % provision.FOLLOWER_IDENT
    else:
        return 'scratch'


def staging_env(create=True, template="generic", sourceless=False):
    from alembic import command, script
    cfg = _testing_config()
    if create:
        path = os.path.join(_get_staging_directory(), 'scripts')
        if os.path.exists(path):
            shutil.rmtree(path)
        command.init(cfg, path, template=template)
        if sourceless:
            try:
                # do an import so that a .pyc/.pyo is generated.
                util.load_python_file(path, 'env.py')
            except AttributeError:
                # we don't have the migration context set up yet
                # so running the .env py throws this exception.
                # theoretically we could be using py_compiler here to
                # generate .pyc/.pyo without importing but not really
                # worth it.
                pass
            make_sourceless(os.path.join(path, "env.py"))

    sc = script.ScriptDirectory.from_config(cfg)
    return sc


def clear_staging_env():
    shutil.rmtree(_get_staging_directory(), True)


def script_file_fixture(txt):
    dir_ = os.path.join(_get_staging_directory(), 'scripts')
    path = os.path.join(dir_, "script.py.mako")
    with open(path, 'w') as f:
        f.write(txt)


def env_file_fixture(txt):
    dir_ = os.path.join(_get_staging_directory(), 'scripts')
    txt = """
from alembic import context

config = context.config
""" + txt

    path = os.path.join(dir_, "env.py")
    pyc_path = util.pyc_file_from_path(path)
    if os.access(pyc_path, os.F_OK):
        os.unlink(pyc_path)

    with open(path, 'w') as f:
        f.write(txt)


def _sqlite_file_db(tempname="foo.db"):
    dir_ = os.path.join(_get_staging_directory(), 'scripts')
    url = "sqlite:///%s/%s" % (dir_, tempname)
    return engines.testing_engine(url=url)


def _sqlite_testing_config(sourceless=False):
    dir_ = os.path.join(_get_staging_directory(), 'scripts')
    url = "sqlite:///%s/foo.db" % dir_

    return _write_config_file("""
[alembic]
script_location = %s
sqlalchemy.url = %s
sourceless = %s

[loggers]
keys = root

[handlers]
keys = console

[logger_root]
level = WARN
handlers = console
qualname =

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatters]
keys = generic

[formatter_generic]
format = %%(levelname)-5.5s [%%(name)s] %%(message)s
datefmt = %%H:%%M:%%S
    """ % (dir_, url, "true" if sourceless else "false"))




def _multi_dir_testing_config(sourceless=False, extra_version_location=''):
    dir_ = os.path.join(_get_staging_directory(), 'scripts')
    url = "sqlite:///%s/foo.db" % dir_

    return _write_config_file("""
[alembic]
script_location = %s
sqlalchemy.url = %s
sourceless = %s
version_locations = %%(here)s/model1/ %%(here)s/model2/ %%(here)s/model3/ %s

[loggers]
keys = root

[handlers]
keys = console

[logger_root]
level = WARN
handlers = console
qualname =

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatters]
keys = generic

[formatter_generic]
format = %%(levelname)-5.5s [%%(name)s] %%(message)s
datefmt = %%H:%%M:%%S
    """ % (dir_, url, "true" if sourceless else "false",
           extra_version_location))


def _no_sql_testing_config(dialect="postgresql", directives=""):
    """use a postgresql url with no host so that
    connections guaranteed to fail"""
    dir_ = os.path.join(_get_staging_directory(), 'scripts')
    return _write_config_file("""
[alembic]
script_location = %s
sqlalchemy.url = %s://
%s

[loggers]
keys = root

[handlers]
keys = console

[logger_root]
level = WARN
handlers = console
qualname =

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatters]
keys = generic

[formatter_generic]
format = %%(levelname)-5.5s [%%(name)s] %%(message)s
datefmt = %%H:%%M:%%S

""" % (dir_, dialect, directives))


def _write_config_file(text):
    cfg = _testing_config()
    with open(cfg.config_file_name, 'w') as f:
        f.write(text)
    return cfg


def _testing_config():
    from alembic.config import Config
    if not os.access(_get_staging_directory(), os.F_OK):
        os.mkdir(_get_staging_directory())
    return Config(os.path.join(_get_staging_directory(), 'test_alembic.ini'))


def write_script(
        scriptdir, rev_id, content, encoding='ascii', sourceless=False):
    old = scriptdir.revision_map.get_revision(rev_id)
    path = old.path

    content = textwrap.dedent(content)
    if encoding:
        content = content.encode(encoding)
    with open(path, 'wb') as fp:
        fp.write(content)
    pyc_path = util.pyc_file_from_path(path)
    if os.access(pyc_path, os.F_OK):
        os.unlink(pyc_path)
    script = Script._from_path(scriptdir, path)
    old = scriptdir.revision_map.get_revision(script.revision)
    if old.down_revision != script.down_revision:
        raise Exception("Can't change down_revision "
                        "on a refresh operation.")
    scriptdir.revision_map.add_revision(script, _replace=True)

    if sourceless:
        make_sourceless(path)


def make_sourceless(path):
    # note that if -O is set, you'd see pyo files here,
    # the pyc util function looks at sys.flags.optimize to handle this
    pyc_path = util.pyc_file_from_path(path)
    assert os.access(pyc_path, os.F_OK)

    # look for a non-pep3147 path here.
    # if not present, need to copy from __pycache__
    simple_pyc_path = util.simple_pyc_file_from_path(path)

    if not os.access(simple_pyc_path, os.F_OK):
        shutil.copyfile(pyc_path, simple_pyc_path)
    os.unlink(path)


def three_rev_fixture(cfg):
    a = util.rev_id()
    b = util.rev_id()
    c = util.rev_id()

    script = ScriptDirectory.from_config(cfg)
    script.generate_revision(a, "revision a", refresh=True)
    write_script(script, a, """\
"Rev A"
revision = '%s'
down_revision = None

from alembic import op


def upgrade():
    op.execute("CREATE STEP 1")


def downgrade():
    op.execute("DROP STEP 1")

""" % a)

    script.generate_revision(b, "revision b", refresh=True)
    write_script(script, b, u("""# coding: utf-8
"Rev B, méil"
revision = '%s'
down_revision = '%s'

from alembic import op


def upgrade():
    op.execute("CREATE STEP 2")


def downgrade():
    op.execute("DROP STEP 2")

""") % (b, a), encoding="utf-8")

    script.generate_revision(c, "revision c", refresh=True)
    write_script(script, c, """\
"Rev C"
revision = '%s'
down_revision = '%s'

from alembic import op


def upgrade():
    op.execute("CREATE STEP 3")


def downgrade():
    op.execute("DROP STEP 3")

""" % (c, b))
    return a, b, c


def _multidb_testing_config(engines):
    """alembic.ini fixture to work exactly with the 'multidb' template"""

    dir_ = os.path.join(_get_staging_directory(), 'scripts')

    databases = ", ".join(
        engines.keys()
    )
    engines = "\n\n".join(
        "[%s]\n"
        "sqlalchemy.url = %s" % (key, value.url)
        for key, value in engines.items()
    )

    return _write_config_file("""
[alembic]
script_location = %s
sourceless = false

databases = %s

%s
[loggers]
keys = root

[handlers]
keys = console

[logger_root]
level = WARN
handlers = console
qualname =

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatters]
keys = generic

[formatter_generic]
format = %%(levelname)-5.5s [%%(name)s] %%(message)s
datefmt = %%H:%%M:%%S
    """ % (dir_, databases, engines)
    )
