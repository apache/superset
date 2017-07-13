from __future__ import absolute_import
from __future__ import print_function

import os
import sys
import atexit
import signal
import logging

from pprint import pformat

from tornado.options import options
from tornado.options import parse_command_line, parse_config_file
from tornado.log import enable_pretty_logging
from celery.bin.base import Command

from . import __version__
from .app import Flower
from .urls import settings
from .utils import abs_path, prepend_url
from .options import DEFAULT_CONFIG_FILE, default_options

try:
    from logging import NullHandler
except ImportError:
    from .utils.backports import NullHandler


logger = logging.getLogger(__name__)


class FlowerCommand(Command):
    ENV_VAR_PREFIX = 'FLOWER_'

    def run_from_argv(self, prog_name, argv=None, **_kwargs):
        self.apply_env_options()
        self.apply_options(prog_name, argv)

        self.extract_settings()
        self.setup_logging()

        self.app.loader.import_default_modules()
        flower = Flower(capp=self.app, options=options, **settings)
        atexit.register(flower.stop)

        def sigterm_handler(signal, frame):
            logger.info('SIGTERM detected, shutting down')
            sys.exit(0)
        signal.signal(signal.SIGTERM, sigterm_handler)

        self.print_banner('ssl_options' in settings)

        try:
            flower.start()
        except (KeyboardInterrupt, SystemExit):
            pass

    def handle_argv(self, prog_name, argv=None):
        return self.run_from_argv(prog_name, argv)

    def apply_env_options(self):
        "apply options passed through environment variables"
        env_options = filter(self.is_flower_envvar, os.environ)
        for env_var_name in env_options:
            name = env_var_name.replace(self.ENV_VAR_PREFIX, '', 1).lower()
            value = os.environ[env_var_name]
            option = options._options[name]
            if option.multiple:
                value = [option.type(i) for i in value.split(',')]
            else:
                value = option.type(value)
            setattr(options, name, value)

    def apply_options(self, prog_name, argv):
        "apply options passed through the configuration file"
        argv = list(filter(self.is_flower_option, argv))
        # parse the command line to get --conf option
        parse_command_line([prog_name] + argv)
        try:
            parse_config_file(options.conf, final=False)
            parse_command_line([prog_name] + argv)
        except IOError:
            if options.conf != DEFAULT_CONFIG_FILE:
                raise

    def setup_logging(self):
        if options.debug and options.logging == 'info':
            options.logging = 'debug'
            enable_pretty_logging()
        else:
            logging.getLogger("tornado.access").addHandler(NullHandler())
            logging.getLogger("tornado.access").propagate = False

    def extract_settings(self):
        settings['debug'] = options.debug

        if options.cookie_secret:
            settings['cookie_secret'] = options.cookie_secret

        if options.url_prefix:
            for name in ['login_url', 'static_url_prefix']:
                settings[name] = prepend_url(settings[name], options.url_prefix)

        if options.auth:
            settings['oauth'] = {
                'key': options.oauth2_key or os.environ.get('FLOWER_OAUTH2_KEY'),
                'secret': options.oauth2_secret or os.environ.get('FLOWER_OAUTH2_SECRET'),
                'redirect_uri': options.oauth2_redirect_uri or os.environ.get('FLOWER_AUTH2_REDIRECT_URI'),
            }

        if options.certfile and options.keyfile:
            settings['ssl_options'] = dict(certfile=abs_path(options.certfile),
                                           keyfile=abs_path(options.keyfile))
            if options.ca_certs:
                settings['ssl_options']['ca_certs'] = abs_path(options.ca_certs)

    def early_version(self, argv):
        if '--version' in argv:
            print(__version__, file=self.stdout)
            super(FlowerCommand, self).early_version(argv)

    @staticmethod
    def is_flower_option(arg):
        name, _, value = arg.lstrip('-').partition("=")
        name = name.replace('-', '_')
        return hasattr(options, name)

    def is_flower_envvar(self, name):
        return name.startswith(self.ENV_VAR_PREFIX) and\
               name[len(self.ENV_VAR_PREFIX):].lower() in default_options

    def print_banner(self, ssl):
        if not options.unix_socket:
            logger.info(
                "Visit me at http%s://%s:%s", 's' if ssl else '',
                options.address or 'localhost', options.port
            )
        else:
            logger.info("Visit me via unix socket file: %s" % options.unix_socket)

        logger.info('Broker: %s', self.app.connection().as_uri())
        logger.info(
            'Registered tasks: \n%s',
            pformat(sorted(self.app.tasks.keys()))
        )
        logger.debug('Settings: %s', pformat(settings))
