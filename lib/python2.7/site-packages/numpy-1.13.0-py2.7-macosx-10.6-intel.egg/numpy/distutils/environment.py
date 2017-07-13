from __future__ import division, absolute_import, print_function

import os
from distutils.dist import Distribution

__metaclass__ = type

class EnvironmentConfig(object):
    def __init__(self, distutils_section='ALL', **kw):
        self._distutils_section = distutils_section
        self._conf_keys = kw
        self._conf = None
        self._hook_handler = None

    def dump_variable(self, name):
        conf_desc = self._conf_keys[name]
        hook, envvar, confvar, convert = conf_desc
        if not convert:
            convert = lambda x : x
        print('%s.%s:' % (self._distutils_section, name))
        v = self._hook_handler(name, hook)
        print('  hook   : %s' % (convert(v),))
        if envvar:
            v = os.environ.get(envvar, None)
            print('  environ: %s' % (convert(v),))
        if confvar and self._conf:
            v = self._conf.get(confvar, (None, None))[1]
            print('  config : %s' % (convert(v),))

    def dump_variables(self):
        for name in self._conf_keys:
            self.dump_variable(name)

    def __getattr__(self, name):
        try:
            conf_desc = self._conf_keys[name]
        except KeyError:
            raise AttributeError(name)
        return self._get_var(name, conf_desc)

    def get(self, name, default=None):
        try:
            conf_desc = self._conf_keys[name]
        except KeyError:
            return default
        var = self._get_var(name, conf_desc)
        if var is None:
            var = default
        return var

    def _get_var(self, name, conf_desc):
        hook, envvar, confvar, convert = conf_desc
        var = self._hook_handler(name, hook)
        if envvar is not None:
            var = os.environ.get(envvar, var)
        if confvar is not None and self._conf:
            var = self._conf.get(confvar, (None, var))[1]
        if convert is not None:
            var = convert(var)
        return var

    def clone(self, hook_handler):
        ec = self.__class__(distutils_section=self._distutils_section,
                            **self._conf_keys)
        ec._hook_handler = hook_handler
        return ec

    def use_distribution(self, dist):
        if isinstance(dist, Distribution):
            self._conf = dist.get_option_dict(self._distutils_section)
        else:
            self._conf = dist
