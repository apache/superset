# plugin/noseplugin.py
# Copyright (C) 2005-2017 the SQLAlchemy authors and contributors
# <see AUTHORS file>
#
# This module is part of SQLAlchemy and is released under
# the MIT License: http://www.opensource.org/licenses/mit-license.php

"""
Enhance nose with extra options and behaviors for running SQLAlchemy tests.


NOTE:  copied/adapted from SQLAlchemy master for backwards compatibility;
this should be removable when Alembic targets SQLAlchemy 1.0.0.

"""

try:
    # installed by bootstrap.py
    import alembic_plugin_base as plugin_base
except ImportError:
    # assume we're a package, use traditional import
    from . import plugin_base

import os
import sys

from nose.plugins import Plugin
fixtures = None

py3k = sys.version_info >= (3, 0)


class NoseSQLAlchemy(Plugin):
    enabled = True

    name = 'sqla_testing'
    score = 100

    def options(self, parser, env=os.environ):
        Plugin.options(self, parser, env)
        opt = parser.add_option

        def make_option(name, **kw):
            callback_ = kw.pop("callback", None)
            if callback_:
                def wrap_(option, opt_str, value, parser):
                    callback_(opt_str, value, parser)
                kw["callback"] = wrap_
            opt(name, **kw)

        plugin_base.setup_options(make_option)
        plugin_base.read_config()

    def configure(self, options, conf):
        super(NoseSQLAlchemy, self).configure(options, conf)
        plugin_base.pre_begin(options)

        plugin_base.set_coverage_flag(options.enable_plugin_coverage)

    def begin(self):
        global fixtures
        from alembic.testing import fixtures  # noqa

        plugin_base.post_begin()

    def describeTest(self, test):
        return ""

    def wantFunction(self, fn):
        return False

    def wantMethod(self, fn):
        if py3k:
            if not hasattr(fn.__self__, 'cls'):
                return False
            cls = fn.__self__.cls
        else:
            cls = fn.im_class
        return plugin_base.want_method(cls, fn)

    def wantClass(self, cls):
        return plugin_base.want_class(cls)

    def beforeTest(self, test):
        plugin_base.before_test(
            test,
            test.test.cls.__module__,
            test.test.cls, test.test.method.__name__)

    def afterTest(self, test):
        plugin_base.after_test(test)

    def startContext(self, ctx):
        if not isinstance(ctx, type) \
                or not issubclass(ctx, fixtures.TestBase):
            return
        plugin_base.start_test_class(ctx)

    def stopContext(self, ctx):
        if not isinstance(ctx, type) \
                or not issubclass(ctx, fixtures.TestBase):
            return
        plugin_base.stop_test_class(ctx)
