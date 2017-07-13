from __future__ import absolute_import

import os
import sys
import warnings

from celery import loaders
from celery.exceptions import (
    NotConfigured,
)
from celery.loaders import base
from celery.loaders import default
from celery.loaders.app import AppLoader
from celery.utils.imports import NotAPackage
from celery.utils.mail import SendmailWarning

from celery.tests.case import (
    AppCase, Case, Mock, depends_on_current_app, patch, with_environ,
)


class DummyLoader(base.BaseLoader):

    def read_configuration(self):
        return {'foo': 'bar', 'CELERY_IMPORTS': ('os', 'sys')}


class test_loaders(AppCase):

    def test_get_loader_cls(self):
        self.assertEqual(loaders.get_loader_cls('default'),
                         default.Loader)

    @depends_on_current_app
    def test_current_loader(self):
        with self.assertPendingDeprecation():
            self.assertIs(loaders.current_loader(), self.app.loader)

    @depends_on_current_app
    def test_load_settings(self):
        with self.assertPendingDeprecation():
            self.assertIs(loaders.load_settings(), self.app.conf)


class test_LoaderBase(AppCase):
    message_options = {'subject': 'Subject',
                       'body': 'Body',
                       'sender': 'x@x.com',
                       'to': 'y@x.com'}
    server_options = {'host': 'smtp.x.com',
                      'port': 1234,
                      'user': 'x',
                      'password': 'qwerty',
                      'timeout': 3}

    def setup(self):
        self.loader = DummyLoader(app=self.app)

    def test_handlers_pass(self):
        self.loader.on_task_init('foo.task', 'feedface-cafebabe')
        self.loader.on_worker_init()

    def test_now(self):
        self.assertTrue(self.loader.now(utc=True))
        self.assertTrue(self.loader.now(utc=False))

    def test_read_configuration_no_env(self):
        self.assertDictEqual(
            base.BaseLoader(app=self.app).read_configuration(
                'FOO_X_S_WE_WQ_Q_WE'),
            {},
        )

    def test_autodiscovery(self):
        with patch('celery.loaders.base.autodiscover_tasks') as auto:
            auto.return_value = [Mock()]
            auto.return_value[0].__name__ = 'moo'
            self.loader.autodiscover_tasks(['A', 'B'])
            self.assertIn('moo', self.loader.task_modules)
            self.loader.task_modules.discard('moo')

    def test_import_task_module(self):
        self.assertEqual(sys, self.loader.import_task_module('sys'))

    def test_init_worker_process(self):
        self.loader.on_worker_process_init()
        m = self.loader.on_worker_process_init = Mock()
        self.loader.init_worker_process()
        m.assert_called_with()

    def test_config_from_object_module(self):
        self.loader.import_from_cwd = Mock()
        self.loader.config_from_object('module_name')
        self.loader.import_from_cwd.assert_called_with('module_name')

    def test_conf_property(self):
        self.assertEqual(self.loader.conf['foo'], 'bar')
        self.assertEqual(self.loader._conf['foo'], 'bar')
        self.assertEqual(self.loader.conf['foo'], 'bar')

    def test_import_default_modules(self):
        def modnames(l):
            return [m.__name__ for m in l]
        self.app.conf.CELERY_IMPORTS = ('os', 'sys')
        self.assertEqual(
            sorted(modnames(self.loader.import_default_modules())),
            sorted(modnames([os, sys])),
        )

    def test_import_from_cwd_custom_imp(self):

        def imp(module, package=None):
            imp.called = True
        imp.called = False

        self.loader.import_from_cwd('foo', imp=imp)
        self.assertTrue(imp.called)

    @patch('celery.utils.mail.Mailer._send')
    def test_mail_admins_errors(self, send):
        send.side_effect = KeyError()
        opts = dict(self.message_options, **self.server_options)

        with self.assertWarnsRegex(SendmailWarning, r'KeyError'):
            self.loader.mail_admins(fail_silently=True, **opts)

        with self.assertRaises(KeyError):
            self.loader.mail_admins(fail_silently=False, **opts)

    @patch('celery.utils.mail.Mailer._send')
    def test_mail_admins(self, send):
        opts = dict(self.message_options, **self.server_options)
        self.loader.mail_admins(**opts)
        self.assertTrue(send.call_args)
        message = send.call_args[0][0]
        self.assertEqual(message.to, [self.message_options['to']])
        self.assertEqual(message.subject, self.message_options['subject'])
        self.assertEqual(message.sender, self.message_options['sender'])
        self.assertEqual(message.body, self.message_options['body'])

    def test_mail_attribute(self):
        from celery.utils import mail
        loader = base.BaseLoader(app=self.app)
        self.assertIs(loader.mail, mail)

    def test_cmdline_config_ValueError(self):
        with self.assertRaises(ValueError):
            self.loader.cmdline_config_parser(['broker.port=foobar'])


class test_DefaultLoader(AppCase):

    @patch('celery.loaders.base.find_module')
    def test_read_configuration_not_a_package(self, find_module):
        find_module.side_effect = NotAPackage()
        l = default.Loader(app=self.app)
        with self.assertRaises(NotAPackage):
            l.read_configuration(fail_silently=False)

    @patch('celery.loaders.base.find_module')
    @with_environ('CELERY_CONFIG_MODULE', 'celeryconfig.py')
    def test_read_configuration_py_in_name(self, find_module):
        find_module.side_effect = NotAPackage()
        l = default.Loader(app=self.app)
        with self.assertRaises(NotAPackage):
            l.read_configuration(fail_silently=False)

    @patch('celery.loaders.base.find_module')
    def test_read_configuration_importerror(self, find_module):
        default.C_WNOCONF = True
        find_module.side_effect = ImportError()
        l = default.Loader(app=self.app)
        with self.assertWarnsRegex(NotConfigured, r'make sure it exists'):
            l.read_configuration(fail_silently=True)
        default.C_WNOCONF = False
        l.read_configuration(fail_silently=True)

    def test_read_configuration(self):
        from types import ModuleType

        class ConfigModule(ModuleType):
            pass

        configname = os.environ.get('CELERY_CONFIG_MODULE') or 'celeryconfig'
        celeryconfig = ConfigModule(configname)
        celeryconfig.CELERY_IMPORTS = ('os', 'sys')

        prevconfig = sys.modules.get(configname)
        sys.modules[configname] = celeryconfig
        try:
            l = default.Loader(app=self.app)
            l.find_module = Mock(name='find_module')
            settings = l.read_configuration(fail_silently=False)
            self.assertTupleEqual(settings.CELERY_IMPORTS, ('os', 'sys'))
            settings = l.read_configuration(fail_silently=False)
            self.assertTupleEqual(settings.CELERY_IMPORTS, ('os', 'sys'))
            l.on_worker_init()
        finally:
            if prevconfig:
                sys.modules[configname] = prevconfig

    def test_import_from_cwd(self):
        l = default.Loader(app=self.app)
        old_path = list(sys.path)
        try:
            sys.path.remove(os.getcwd())
        except ValueError:
            pass
        celery = sys.modules.pop('celery', None)
        sys.modules.pop('celery.five', None)
        try:
            self.assertTrue(l.import_from_cwd('celery'))
            sys.modules.pop('celery', None)
            sys.modules.pop('celery.five', None)
            sys.path.insert(0, os.getcwd())
            self.assertTrue(l.import_from_cwd('celery'))
        finally:
            sys.path = old_path
            sys.modules['celery'] = celery

    def test_unconfigured_settings(self):
        context_executed = [False]

        class _Loader(default.Loader):

            def find_module(self, name):
                raise ImportError(name)

        with warnings.catch_warnings(record=True):
            l = _Loader(app=self.app)
            self.assertFalse(l.configured)
            context_executed[0] = True
        self.assertTrue(context_executed[0])


class test_AppLoader(AppCase):

    def setup(self):
        self.loader = AppLoader(app=self.app)

    def test_on_worker_init(self):
        self.app.conf.CELERY_IMPORTS = ('subprocess', )
        sys.modules.pop('subprocess', None)
        self.loader.init_worker()
        self.assertIn('subprocess', sys.modules)


class test_autodiscovery(Case):

    def test_autodiscover_tasks(self):
        base._RACE_PROTECTION = True
        try:
            base.autodiscover_tasks(['foo'])
        finally:
            base._RACE_PROTECTION = False
        with patch('celery.loaders.base.find_related_module') as frm:
            base.autodiscover_tasks(['foo'])
            self.assertTrue(frm.called)

    def test_find_related_module(self):
        with patch('importlib.import_module') as imp:
            with patch('imp.find_module') as find:
                imp.return_value = Mock()
                imp.return_value.__path__ = 'foo'
                base.find_related_module(base, 'tasks')

                def se1(val):
                    imp.side_effect = AttributeError()

                imp.side_effect = se1
                base.find_related_module(base, 'tasks')
                imp.side_effect = None

                find.side_effect = ImportError()
                base.find_related_module(base, 'tasks')
