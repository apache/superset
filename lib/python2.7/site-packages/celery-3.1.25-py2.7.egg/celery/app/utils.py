# -*- coding: utf-8 -*-
"""
    celery.app.utils
    ~~~~~~~~~~~~~~~~

    App utilities: Compat settings, bugreport tool, pickling apps.

"""
from __future__ import absolute_import

import os
import platform as _platform
import re

from collections import Mapping
from types import ModuleType

from kombu.utils.url import maybe_sanitize_url

from celery.datastructures import ConfigurationView
from celery.five import items, string_t, values
from celery.platforms import pyimplementation
from celery.utils.text import pretty
from celery.utils.imports import import_from_cwd, symbol_by_name, qualname

from .defaults import find

__all__ = ['Settings', 'appstr', 'bugreport',
           'filter_hidden_settings', 'find_app']

#: Format used to generate bugreport information.
BUGREPORT_INFO = """
software -> celery:{celery_v} kombu:{kombu_v} py:{py_v}
            billiard:{billiard_v} {driver_v}
platform -> system:{system} arch:{arch} imp:{py_i}
loader   -> {loader}
settings -> transport:{transport} results:{results}

{human_settings}
"""

HIDDEN_SETTINGS = re.compile(
    'API|TOKEN|KEY|SECRET|PASS|PROFANITIES_LIST|SIGNATURE|DATABASE',
    re.IGNORECASE,
)


def appstr(app):
    """String used in __repr__ etc, to id app instances."""
    return '{0}:0x{1:x}'.format(app.main or '__main__', id(app))


class Settings(ConfigurationView):
    """Celery settings object.

    .. seealso:

        :ref:`configuration` for a full list of configuration keys.

    """

    @property
    def CELERY_RESULT_BACKEND(self):
        return self.first('CELERY_RESULT_BACKEND', 'CELERY_BACKEND')

    @property
    def BROKER_TRANSPORT(self):
        return self.first('BROKER_TRANSPORT',
                          'BROKER_BACKEND', 'CARROT_BACKEND')

    @property
    def BROKER_BACKEND(self):
        """Deprecated compat alias to :attr:`BROKER_TRANSPORT`."""
        return self.BROKER_TRANSPORT

    @property
    def BROKER_URL(self):
        return (os.environ.get('CELERY_BROKER_URL') or
                self.first('BROKER_URL', 'BROKER_HOST'))

    @property
    def CELERY_TIMEZONE(self):
        # this way we also support django's time zone.
        return self.first('CELERY_TIMEZONE', 'TIME_ZONE')

    def without_defaults(self):
        """Return the current configuration, but without defaults."""
        # the last stash is the default settings, so just skip that
        return Settings({}, self._order[:-1])

    def value_set_for(self, key):
        return key in self.without_defaults()

    def find_option(self, name, namespace='celery'):
        """Search for option by name.

        Will return ``(namespace, key, type)`` tuple, e.g.::

            >>> from proj.celery import app
            >>> app.conf.find_option('disable_rate_limits')
            ('CELERY', 'DISABLE_RATE_LIMITS',
             <Option: type->bool default->False>))

        :param name: Name of option, cannot be partial.
        :keyword namespace: Preferred namespace (``CELERY`` by default).

        """
        return find(name, namespace)

    def find_value_for_key(self, name, namespace='celery'):
        """Shortcut to ``get_by_parts(*find_option(name)[:-1])``"""
        return self.get_by_parts(*self.find_option(name, namespace)[:-1])

    def get_by_parts(self, *parts):
        """Return the current value for setting specified as a path.

        Example::

            >>> from proj.celery import app
            >>> app.conf.get_by_parts('CELERY', 'DISABLE_RATE_LIMITS')
            False

        """
        return self['_'.join(part for part in parts if part)]

    def table(self, with_defaults=False, censored=True):
        filt = filter_hidden_settings if censored else lambda v: v
        return filt(dict(
            (k, v) for k, v in items(
                self if with_defaults else self.without_defaults())
            if k.isupper() and not k.startswith('_')
        ))

    def humanize(self, with_defaults=False, censored=True):
        """Return a human readable string showing changes to the
        configuration."""
        return '\n'.join(
            '{0}: {1}'.format(key, pretty(value, width=50))
            for key, value in items(self.table(with_defaults, censored)))


class AppPickler(object):
    """Old application pickler/unpickler (< 3.1)."""

    def __call__(self, cls, *args):
        kwargs = self.build_kwargs(*args)
        app = self.construct(cls, **kwargs)
        self.prepare(app, **kwargs)
        return app

    def prepare(self, app, **kwargs):
        app.conf.update(kwargs['changes'])

    def build_kwargs(self, *args):
        return self.build_standard_kwargs(*args)

    def build_standard_kwargs(self, main, changes, loader, backend, amqp,
                              events, log, control, accept_magic_kwargs,
                              config_source=None):
        return dict(main=main, loader=loader, backend=backend, amqp=amqp,
                    changes=changes, events=events, log=log, control=control,
                    set_as_current=False,
                    accept_magic_kwargs=accept_magic_kwargs,
                    config_source=config_source)

    def construct(self, cls, **kwargs):
        return cls(**kwargs)


def _unpickle_app(cls, pickler, *args):
    """Rebuild app for versions 2.5+"""
    return pickler()(cls, *args)


def _unpickle_app_v2(cls, kwargs):
    """Rebuild app for versions 3.1+"""
    kwargs['set_as_current'] = False
    return cls(**kwargs)


def filter_hidden_settings(conf):

    def maybe_censor(key, value, mask='*' * 8):
        if isinstance(value, Mapping):
            return filter_hidden_settings(value)
        if isinstance(key, string_t):
            if HIDDEN_SETTINGS.search(key):
                return mask
            elif 'BROKER_URL' in key.upper():
                from kombu import Connection
                return Connection(value).as_uri(mask=mask)
            elif key.upper() in ('CELERY_RESULT_BACKEND', 'CELERY_BACKEND'):
                return maybe_sanitize_url(value, mask=mask)

        return value

    return dict((k, maybe_censor(k, v)) for k, v in items(conf))


def bugreport(app):
    """Return a string containing information useful in bug reports."""
    import billiard
    import celery
    import kombu

    try:
        conn = app.connection()
        driver_v = '{0}:{1}'.format(conn.transport.driver_name,
                                    conn.transport.driver_version())
        transport = conn.transport_cls
    except Exception:
        transport = driver_v = ''

    return BUGREPORT_INFO.format(
        system=_platform.system(),
        arch=', '.join(x for x in _platform.architecture() if x),
        py_i=pyimplementation(),
        celery_v=celery.VERSION_BANNER,
        kombu_v=kombu.__version__,
        billiard_v=billiard.__version__,
        py_v=_platform.python_version(),
        driver_v=driver_v,
        transport=transport,
        results=maybe_sanitize_url(
            app.conf.CELERY_RESULT_BACKEND or 'disabled'),
        human_settings=app.conf.humanize(),
        loader=qualname(app.loader.__class__),
    )


def find_app(app, symbol_by_name=symbol_by_name, imp=import_from_cwd):
    from .base import Celery

    try:
        sym = symbol_by_name(app, imp=imp)
    except AttributeError:
        # last part was not an attribute, but a module
        sym = imp(app)
    if isinstance(sym, ModuleType) and ':' not in app:
        try:
            found = sym.app
            if isinstance(found, ModuleType):
                raise AttributeError()
        except AttributeError:
            try:
                found = sym.celery
                if isinstance(found, ModuleType):
                    raise AttributeError()
            except AttributeError:
                if getattr(sym, '__path__', None):
                    try:
                        return find_app(
                            '{0}.celery'.format(app),
                            symbol_by_name=symbol_by_name, imp=imp,
                        )
                    except ImportError:
                        pass
                for suspect in values(vars(sym)):
                    if isinstance(suspect, Celery):
                        return suspect
                raise
            else:
                return found
        else:
            return found
    return sym
