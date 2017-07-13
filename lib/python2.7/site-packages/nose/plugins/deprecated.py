"""
This plugin installs a DEPRECATED error class for the :class:`DeprecatedTest`
exception. When :class:`DeprecatedTest` is raised, the exception will be logged
in the deprecated attribute of the result, ``D`` or ``DEPRECATED`` (verbose)
will be output, and the exception will not be counted as an error or failure.
It is enabled by default, but can be turned off by using ``--no-deprecated``.
"""

from nose.plugins.errorclass import ErrorClass, ErrorClassPlugin


class DeprecatedTest(Exception):
    """Raise this exception to mark a test as deprecated.
    """
    pass


class Deprecated(ErrorClassPlugin):
    """
    Installs a DEPRECATED error class for the DeprecatedTest exception. Enabled
    by default.
    """
    enabled = True
    deprecated = ErrorClass(DeprecatedTest,
                            label='DEPRECATED',
                            isfailure=False)

    def options(self, parser, env):
        """Register commandline options.
        """
        env_opt = 'NOSE_WITHOUT_DEPRECATED'
        parser.add_option('--no-deprecated', action='store_true',
                          dest='noDeprecated', default=env.get(env_opt, False),
                          help="Disable special handling of DeprecatedTest "
                          "exceptions.")

    def configure(self, options, conf):
        """Configure plugin.
        """
        if not self.can_configure:
            return
        self.conf = conf
        disable = getattr(options, 'noDeprecated', False)
        if disable:
            self.enabled = False
