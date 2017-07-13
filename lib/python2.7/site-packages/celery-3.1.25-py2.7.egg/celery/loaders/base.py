# -*- coding: utf-8 -*-
"""
    celery.loaders.base
    ~~~~~~~~~~~~~~~~~~~

    Loader base class.

"""
from __future__ import absolute_import

import anyjson
import imp as _imp
import importlib
import os
import re
import sys

from datetime import datetime

from kombu.utils import cached_property
from kombu.utils.encoding import safe_str

from celery import signals
from celery.datastructures import DictAttribute, force_mapping
from celery.five import reraise, string_t
from celery.utils.functional import maybe_list
from celery.utils.imports import (
    import_from_cwd, symbol_by_name, NotAPackage, find_module,
)

__all__ = ['BaseLoader']

_RACE_PROTECTION = False
CONFIG_INVALID_NAME = """\
Error: Module '{module}' doesn't exist, or it's not a valid \
Python module name.
"""

CONFIG_WITH_SUFFIX = CONFIG_INVALID_NAME + """\
Did you mean '{suggest}'?
"""


class BaseLoader(object):
    """The base class for loaders.

    Loaders handles,

        * Reading celery client/worker configurations.

        * What happens when a task starts?
            See :meth:`on_task_init`.

        * What happens when the worker starts?
            See :meth:`on_worker_init`.

        * What happens when the worker shuts down?
            See :meth:`on_worker_shutdown`.

        * What modules are imported to find tasks?

    """
    builtin_modules = frozenset()
    configured = False
    override_backends = {}
    worker_initialized = False

    _conf = None

    def __init__(self, app, **kwargs):
        self.app = app
        self.task_modules = set()

    def now(self, utc=True):
        if utc:
            return datetime.utcnow()
        return datetime.now()

    def on_task_init(self, task_id, task):
        """This method is called before a task is executed."""
        pass

    def on_process_cleanup(self):
        """This method is called after a task is executed."""
        pass

    def on_worker_init(self):
        """This method is called when the worker (:program:`celery worker`)
        starts."""
        pass

    def on_worker_shutdown(self):
        """This method is called when the worker (:program:`celery worker`)
        shuts down."""
        pass

    def on_worker_process_init(self):
        """This method is called when a child process starts."""
        pass

    def import_task_module(self, module):
        self.task_modules.add(module)
        return self.import_from_cwd(module)

    def import_module(self, module, package=None):
        return importlib.import_module(module, package=package)

    def import_from_cwd(self, module, imp=None, package=None):
        return import_from_cwd(
            module,
            self.import_module if imp is None else imp,
            package=package,
        )

    def import_default_modules(self):
        signals.import_modules.send(sender=self.app)
        return [
            self.import_task_module(m) for m in (
                tuple(self.builtin_modules) +
                tuple(maybe_list(self.app.conf.CELERY_IMPORTS)) +
                tuple(maybe_list(self.app.conf.CELERY_INCLUDE))
            )
        ]

    def init_worker(self):
        if not self.worker_initialized:
            self.worker_initialized = True
            self.import_default_modules()
            self.on_worker_init()

    def shutdown_worker(self):
        self.on_worker_shutdown()

    def init_worker_process(self):
        self.on_worker_process_init()

    def config_from_object(self, obj, silent=False):
        if isinstance(obj, string_t):
            try:
                obj = self._smart_import(obj, imp=self.import_from_cwd)
            except (ImportError, AttributeError):
                if silent:
                    return False
                raise
        self._conf = force_mapping(obj)
        return True

    def _smart_import(self, path, imp=None):
        imp = self.import_module if imp is None else imp
        if ':' in path:
            # Path includes attribute so can just jump here.
            # e.g. ``os.path:abspath``.
            return symbol_by_name(path, imp=imp)

        # Not sure if path is just a module name or if it includes an
        # attribute name (e.g. ``os.path``, vs, ``os.path.abspath``).
        try:
            return imp(path)
        except ImportError:
            # Not a module name, so try module + attribute.
            return symbol_by_name(path, imp=imp)

    def _import_config_module(self, name):
        try:
            self.find_module(name)
        except NotAPackage:
            if name.endswith('.py'):
                reraise(NotAPackage, NotAPackage(CONFIG_WITH_SUFFIX.format(
                    module=name, suggest=name[:-3])), sys.exc_info()[2])
            reraise(NotAPackage, NotAPackage(CONFIG_INVALID_NAME.format(
                module=name)), sys.exc_info()[2])
        else:
            return self.import_from_cwd(name)

    def find_module(self, module):
        return find_module(module)

    def cmdline_config_parser(
            self, args, namespace='celery',
            re_type=re.compile(r'\((\w+)\)'),
            extra_types={'json': anyjson.loads},
            override_types={'tuple': 'json',
                            'list': 'json',
                            'dict': 'json'}):
        from celery.app.defaults import Option, NAMESPACES
        namespace = namespace.upper()
        typemap = dict(Option.typemap, **extra_types)

        def getarg(arg):
            """Parse a single configuration definition from
            the command-line."""

            # ## find key/value
            # ns.key=value|ns_key=value (case insensitive)
            key, value = arg.split('=', 1)
            key = key.upper().replace('.', '_')

            # ## find namespace.
            # .key=value|_key=value expands to default namespace.
            if key[0] == '_':
                ns, key = namespace, key[1:]
            else:
                # find namespace part of key
                ns, key = key.split('_', 1)

            ns_key = (ns and ns + '_' or '') + key

            # (type)value makes cast to custom type.
            cast = re_type.match(value)
            if cast:
                type_ = cast.groups()[0]
                type_ = override_types.get(type_, type_)
                value = value[len(cast.group()):]
                value = typemap[type_](value)
            else:
                try:
                    value = NAMESPACES[ns][key].to_python(value)
                except ValueError as exc:
                    # display key name in error message.
                    raise ValueError('{0!r}: {1}'.format(ns_key, exc))
            return ns_key, value
        return dict(getarg(arg) for arg in args)

    def mail_admins(self, subject, body, fail_silently=False,
                    sender=None, to=None, host=None, port=None,
                    user=None, password=None, timeout=None,
                    use_ssl=False, use_tls=False, charset='utf-8'):
        message = self.mail.Message(sender=sender, to=to,
                                    subject=safe_str(subject),
                                    body=safe_str(body),
                                    charset=charset)
        mailer = self.mail.Mailer(host=host, port=port,
                                  user=user, password=password,
                                  timeout=timeout, use_ssl=use_ssl,
                                  use_tls=use_tls)
        mailer.send(message, fail_silently=fail_silently)

    def read_configuration(self, env='CELERY_CONFIG_MODULE'):
        try:
            custom_config = os.environ[env]
        except KeyError:
            pass
        else:
            if custom_config:
                usercfg = self._import_config_module(custom_config)
                return DictAttribute(usercfg)
        return {}

    def autodiscover_tasks(self, packages, related_name='tasks'):
        self.task_modules.update(
            mod.__name__ for mod in autodiscover_tasks(packages or (),
                                                       related_name) if mod)

    @property
    def conf(self):
        """Loader configuration."""
        if self._conf is None:
            self._conf = self.read_configuration()
        return self._conf

    @cached_property
    def mail(self):
        return self.import_module('celery.utils.mail')


def autodiscover_tasks(packages, related_name='tasks'):
    global _RACE_PROTECTION

    if _RACE_PROTECTION:
        return ()
    _RACE_PROTECTION = True
    try:
        return [find_related_module(pkg, related_name) for pkg in packages]
    finally:
        _RACE_PROTECTION = False


def find_related_module(package, related_name):
    """Given a package name and a module name, tries to find that
    module."""

    # Django 1.7 allows for speciying a class name in INSTALLED_APPS.
    # (Issue #2248).
    try:
        importlib.import_module(package)
    except ImportError:
        package, _, _ = package.rpartition('.')

    try:
        pkg_path = importlib.import_module(package).__path__
    except AttributeError:
        return

    try:
        _imp.find_module(related_name, pkg_path)
    except ImportError:
        return

    return importlib.import_module('{0}.{1}'.format(package, related_name))
