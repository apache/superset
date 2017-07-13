from __future__ import absolute_import

import uuid
import base64
import os.path

from .. import __version__


def gen_cookie_secret():
    return base64.b64encode(uuid.uuid4().bytes + uuid.uuid4().bytes)


def bugreport(app=None):
    try:
        import celery
        from celery.app import set_default_app
        import tornado
        import babel

        set_default_app(app)

        return 'flower   -> flower:%s tornado:%s babel:%s%s' % (
            __version__,
            tornado.version,
            babel.__version__,
            celery.bugreport()
        )
    except (ImportError, AttributeError):
        return 'Unknown Celery version'


def abs_path(path):
    path = os.path.expanduser(path)
    if not os.path.isabs(path):
        cwd = os.environ.get('PWD') or os.getcwd()
        path = os.path.join(cwd, path)
    return path


def prepend_url(url, prefix):
    return '/' + prefix.strip('/') + url
