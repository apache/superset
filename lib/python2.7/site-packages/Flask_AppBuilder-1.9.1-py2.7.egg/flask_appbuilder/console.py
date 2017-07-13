"""
    Console utility to help manage F.A.B's apps

    use it using fabmanager:

    $ fabmanager --help
"""

import click
import os
import shutil
import sys
from zipfile import ZipFile
from . import const as c

try:
    # For Python 3.0 and later
    from urllib.request import urlopen
except ImportError:
    # Fall back to Python 2's urllib2
    from urllib2 import urlopen
from io import BytesIO

SQLA_REPO_URL = 'https://github.com/dpgaspar/Flask-AppBuilder-Skeleton/archive/master.zip'
MONGOENGIE_REPO_URL = 'https://github.com/dpgaspar/Flask-AppBuilder-Skeleton-me/archive/master.zip'
ADDON_REPO_URL = 'https://github.com/dpgaspar/Flask-AppBuilder-Skeleton-AddOn/archive/master.zip'

def import_application(app_package, appbuilder):
    sys.path.append(os.getcwd())
    try:
        _app = __import__(app_package)
    except Exception as e:
        click.echo(click.style('Was unable to import {0} Error: {1}'.format(app_package, e), fg='red'))
        exit(3)
    if hasattr(_app, 'appbuilder'):
        return getattr(_app, appbuilder)
    else:
        click.echo(click.style('There in no appbuilder var on your package, you can use appbuilder parameter to config', fg='red'))
        exit(3)


def echo_header(title):
    click.echo(click.style(title, fg='green'))
    click.echo(click.style('-'*len(title), fg='green'))


@click.group()
def cli_app():
    """
        This is a set of commands to ease the creation and maintenance
        of your flask-appbuilder applications.

        All commands that import your app will assume by default that
        your running on your projects directory just before the app directory.
        will assume also that on the __init__.py your initializing AppBuilder
        like this (using a var named appbuilder) just like the skeleton app::

        appbuilder = AppBuilder(......)

        If your using different namings use app and appbuilder parameters.
    """
    pass


@cli_app.command("reset-password")
@click.option('--app', default='app', help='Your application init directory (package)')
@click.option('--appbuilder', default='appbuilder', help='your AppBuilder object')
@click.option('--username', default='admin', prompt='The username', help='Resets the password for a particular user.')
@click.password_option()
def reset_password(app, appbuilder, username, password):
    """
        Resets a user's password
    """
    _appbuilder = import_application(app, appbuilder)
    user = _appbuilder.sm.find_user(username=username)
    if not user:
        click.echo('User {0} not found.'.format(username))
    else:
        _appbuilder.sm.reset_password(user.id, password)
        click.echo(click.style('User {0} reseted.'.format(username), fg='green'))

@cli_app.command("create-admin")
@click.option('--app', default='app', help='Your application init directory (package)')
@click.option('--appbuilder', default='appbuilder', help='your AppBuilder object')
@click.option('--username', default='admin', prompt='Username')
@click.option('--firstname', default='admin', prompt='User first name')
@click.option('--lastname', default='user', prompt='User last name')
@click.option('--email', default='admin@fab.org', prompt='Email')
@click.password_option()
def create_admin(app, appbuilder, username, firstname, lastname, email, password):
    """
        Creates an admin user
    """
    auth_type = {c.AUTH_DB:"Database Authentications",
                c.AUTH_OID:"OpenID Authentication",
                c.AUTH_LDAP:"LDAP Authentication",
                c.AUTH_REMOTE_USER:"WebServer REMOTE_USER Authentication",
                c.AUTH_OAUTH:"OAuth Authentication"}
    _appbuilder = import_application(app, appbuilder)
    click.echo(click.style('Recognized {0}.'.format(auth_type.get(_appbuilder.sm.auth_type,'No Auth method')), fg='green'))
    role_admin = _appbuilder.sm.find_role(_appbuilder.sm.auth_role_admin)
    user = _appbuilder.sm.add_user(username, firstname, lastname, email, role_admin, password)
    if user:
        click.echo(click.style('Admin User {0} created.'.format(username), fg='green'))
    else:
        click.echo(click.style('No user created an error occured', fg='red'))


@cli_app.command("run")
@click.option('--app', default='app', help='Your application init directory (package)')
@click.option('--appbuilder', default='appbuilder', help='your AppBuilder object')
@click.option('--host', default='0.0.0.0')
@click.option('--port', default=8080)
@click.option('--debug', default=True)
def run(app, appbuilder, host, port, debug):
    """
        Runs Flask dev web server.
    """
    _appbuilder = import_application(app, appbuilder)
    _appbuilder.get_app.run(host=host, port=port, debug=debug)


@cli_app.command("create-db")
@click.option('--app', default='app', help='Your application init directory (package)')
@click.option('--appbuilder', default='appbuilder', help='your AppBuilder object')
def create_db(app, appbuilder):
    """
        Create all your database objects (SQLAlchemy specific).
    """
    from flask_appbuilder.models.sqla import Base

    _appbuilder = import_application(app, appbuilder)
    engine = _appbuilder.get_session.get_bind(mapper=None, clause=None)
    Base.metadata.create_all(engine)
    click.echo(click.style('DB objects created', fg='green'))


@cli_app.command("version")
@click.option('--app', default='app', help='Your application init directory (package)')
@click.option('--appbuilder', default='appbuilder', help='your AppBuilder object')
def version(app, appbuilder):
    """
        Flask-AppBuilder package version
    """
    _appbuilder = import_application(app, appbuilder)
    click.echo(click.style('F.A.B Version: {0}.'.format(_appbuilder.version), bg='blue', fg='white'))


@cli_app.command("security-cleanup")
@click.option('--app', default='app', help='Your application init directory (package)')
@click.option('--appbuilder', default='appbuilder', help='your AppBuilder object')
def security_cleanup(app, appbuilder):
    """
        Cleanup unused permissions from views and roles.
    """
    _appbuilder = import_application(app, appbuilder)
    _appbuilder.security_cleanup()
    click.echo(click.style('Finished security cleanup', fg='green'))


@cli_app.command("list-views")
@click.option('--app', default='app', help='Your application init directory (package)')
@click.option('--appbuilder', default='appbuilder', help='your AppBuilder object')
def list_users(app, appbuilder):
    """
        List all registered views
    """
    _appbuilder = import_application(app, appbuilder)
    echo_header('List of registered views')
    for view in _appbuilder.baseviews:
        click.echo('View:{0} | Route:{1} | Perms:{2}'.format(view.__class__.__name__, view.route_base, view.base_permissions))


@cli_app.command("list-users")
@click.option('--app', default='app', help='Your application init directory (package)')
@click.option('--appbuilder', default='appbuilder', help='your AppBuilder object')
def list_users(app, appbuilder):
    """
        List all users on the database 
    """
    _appbuilder = import_application(app, appbuilder)
    echo_header('List of users')
    for user in _appbuilder.sm.get_all_users():
        click.echo('username:{0} | email:{1} | role:{2}'.format(user.username, user.email, user.roles))


@cli_app.command("babel-extract")
@click.option('--config', default='./babel/babel.cfg')
@click.option('--input', default='.')
@click.option('--output', default='./babel/messages.pot')
@click.option('--target', default='app/translations')
@click.option('--keywords', '-k', multiple=True, default=['lazy_gettext', 'gettext', '_', '__'])
def babel_extract(config, input, output, target, keywords):
    """
        Babel, Extracts and updates all messages marked for translation
    """
    click.echo(click.style('Starting Extractions config:{0} input:{1} output:{2} keywords:{3}'.format(config, input, output, keywords), fg='green'))
    keywords = ' -k '.join(keywords)
    os.popen('pybabel extract -F {0} -k {1} -o {2} {3}'.format(config, keywords, output, input))
    click.echo(click.style('Starting Update target:{0}'.format(target), fg='green'))
    os.popen('pybabel update -N -i {0} -d {1}'.format(output, target))
    click.echo(click.style('Finish, you can start your translations', fg='green'))


@cli_app.command("babel-compile")
@click.option('--target', default='app/translations', help="The target directory where translations reside")
def babel_compile(target):
    """
        Babel, Compiles all translations
    """
    click.echo(click.style('Starting Compile target:{0}'.format(target), fg='green'))
    os.popen('pybabel compile -f -d {0}'.format(target))


@cli_app.command("create-app")
@click.option('--name', prompt="Your new app name", help="Your application name, directory will have this name")
@click.option('--engine', prompt="Your engine type, SQLAlchemy or MongoEngine", type=click.Choice(['SQLAlchemy', 'MongoEngine']),
              default='SQLAlchemy', help='Write your engine type')
def create_app(name, engine):
    """
        Create a Skeleton application (needs internet connection to github)
    """
    try:
        if engine.lower() =='sqlalchemy':
            url = urlopen(SQLA_REPO_URL)
            dirname = "Flask-AppBuilder-Skeleton-master"
        elif engine.lower() =='mongoengine':
            url = urlopen(MONGOENGIE_REPO_URL)
            dirname = "Flask-AppBuilder-Skeleton-me-master"
        zipfile = ZipFile(BytesIO(url.read()))
        zipfile.extractall()
        os.rename(dirname, name)
        click.echo(click.style('Downloaded the skeleton app, good coding!', fg='green'))
        return True
    except Exception as e:
        click.echo(click.style('Something went wrong {0}'.format(e), fg='red'))
        if engine.lower() =='sqlalchemy':
            click.echo(click.style('Try downloading from {0}'.format(SQLA_REPO_URL), fg='green'))
        elif engine.lower() =='mongoengine':
            click.echo(click.style('Try downloading from {0}'.format(MONGOENGIE_REPO_URL), fg='green'))
        return False


@cli_app.command("create-addon")
@click.option('--name', prompt="Your new addon name", help="Your addon name will be prefixed by fab_addon_, directory will have this name")
def create_addon(name):
    """
        Create a Skeleton AddOn (needs internet connection to github)
    """
    try:
        full_name = 'fab_addon_' + name
        dirname = "Flask-AppBuilder-Skeleton-AddOn-master"
        url = urlopen(ADDON_REPO_URL)
        zipfile = ZipFile(BytesIO(url.read()))
        zipfile.extractall()
        os.rename(dirname, full_name)
        addon_path =  os.path.join(full_name,full_name)
        os.rename(os.path.join(full_name, 'fab_addon'), addon_path)
        f = open(os.path.join(full_name, 'config.py'), 'w')
        f.write("ADDON_NAME='" + name + "'\n")
        f.write("FULL_ADDON_NAME='fab_addon_' + ADDON_NAME\n")
        f.close()
        click.echo(click.style('Downloaded the skeleton addon, good coding!', fg='green'))
        return True
    except Exception as e:
        click.echo(click.style('Something went wrong {0}'.format(e), fg='red'))
        return False


@cli_app.command("collect-static")
@click.option('--static_folder', default='app/static', help='Your projects static folder')
def collect_static(static_folder):
    """
        Copies flask-appbuilder static files to your projects static folder
    """
    appbuilder_static_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static/appbuilder')
    app_static_path = os.path.join(os.getcwd(), static_folder)
    if not os.path.isdir(app_static_path):
        click.echo(click.style('Static folder does not exist creating: %s' % app_static_path, fg='green'))
        os.makedirs(app_static_path)
    try:
        shutil.copytree(appbuilder_static_path, os.path.join(app_static_path,'appbuilder'))
    except Exception as e:
        click.echo(click.style('Appbuilder static folder already exists on your project', fg='red'))


def cli():
    cli_app()

if __name__ == '__main__':
    cli_app()
