"""Use the AllModules plugin by passing ``--all-modules`` or setting the
NOSE_ALL_MODULES environment variable to enable collection and execution of
tests in all python modules. Normal nose behavior is to look for tests only in
modules that match testMatch.

More information: :doc:`../doc_tests/test_allmodules/test_allmodules`

.. warning ::

   This plugin can have surprising interactions with plugins that load tests
   from what nose normally considers non-test modules, such as
   the :doc:`doctest plugin <doctests>`. This is because any given
   object in a module can't be loaded both by a plugin and the normal nose
   :class:`test loader <nose.loader.TestLoader>`. Also, if you have functions
   or classes in non-test modules that look like tests but aren't, you will
   likely see errors as nose attempts to run them as tests.

"""

import os
from nose.plugins.base import Plugin

class AllModules(Plugin):
    """Collect tests from all python modules.
    """
    def options(self, parser, env):
        """Register commandline options.
        """
        env_opt = 'NOSE_ALL_MODULES'
        parser.add_option('--all-modules',
                          action="store_true",
                          dest=self.enableOpt,
                          default=env.get(env_opt),
                          help="Enable plugin %s: %s [%s]" %
                          (self.__class__.__name__, self.help(), env_opt))

    def wantFile(self, file):
        """Override to return True for all files ending with .py"""
        # always want .py files
        if file.endswith('.py'):
            return True

    def wantModule(self, module):
        """Override return True for all modules"""
        return True
