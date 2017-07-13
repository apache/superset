"""Exception classes for all of Flake8."""


class Flake8Exception(Exception):
    """Plain Flake8 exception."""

    pass


class EarlyQuit(Flake8Exception):
    """Except raised when encountering a KeyboardInterrupt."""

    pass


class FailedToLoadPlugin(Flake8Exception):
    """Exception raised when a plugin fails to load."""

    FORMAT = 'Flake8 failed to load plugin "%(name)s" due to %(exc)s.'

    def __init__(self, *args, **kwargs):
        """Initialize our FailedToLoadPlugin exception."""
        self.plugin = kwargs.pop('plugin')
        self.ep_name = self.plugin.name
        self.original_exception = kwargs.pop('exception')
        super(FailedToLoadPlugin, self).__init__(*args, **kwargs)

    def __str__(self):
        """Return a nice string for our exception."""
        return self.FORMAT % {'name': self.ep_name,
                              'exc': self.original_exception}


class InvalidSyntax(Flake8Exception):
    """Exception raised when tokenizing a file fails."""

    def __init__(self, *args, **kwargs):
        """Initialize our InvalidSyntax exception."""
        exception = kwargs.pop('exception', None)
        self.original_exception = exception
        self.error_message = '{0}: {1}'.format(
            exception.__class__.__name__,
            exception.args[0],
        )
        self.error_code = 'E902'
        self.line_number = 1
        self.column_number = 0
        super(InvalidSyntax, self).__init__(
            self.error_message,
            *args,
            **kwargs
        )


class PluginRequestedUnknownParameters(Flake8Exception):
    """The plugin requested unknown parameters."""

    FORMAT = '"%(name)s" requested unknown parameters causing %(exc)s'

    def __init__(self, *args, **kwargs):
        """Pop certain keyword arguments for initialization."""
        self.original_exception = kwargs.pop('exception')
        self.plugin = kwargs.pop('plugin')
        super(PluginRequestedUnknownParameters, self).__init__(
            *args,
            **kwargs
        )

    def __str__(self):
        """Format our exception message."""
        return self.FORMAT % {'name': self.plugin['plugin_name'],
                              'exc': self.original_exception}


class HookInstallationError(Flake8Exception):
    """Parent exception for all hooks errors."""

    pass


class GitHookAlreadyExists(HookInstallationError):
    """Exception raised when the git pre-commit hook file already exists."""

    def __init__(self, *args, **kwargs):
        """Initialize the path attribute."""
        self.path = kwargs.pop('path')
        super(GitHookAlreadyExists, self).__init__(*args, **kwargs)

    def __str__(self):
        """Provide a nice message regarding the exception."""
        msg = ('The Git pre-commit hook ({0}) already exists. To convince '
               'Flake8 to install the hook, please remove the existing '
               'hook.')
        return msg.format(self.path)


class MercurialHookAlreadyExists(HookInstallationError):
    """Exception raised when a mercurial hook is already configured."""

    hook_name = None

    def __init__(self, *args, **kwargs):
        """Initialize the relevant attributes."""
        self.path = kwargs.pop('path')
        self.value = kwargs.pop('value')
        super(MercurialHookAlreadyExists, self).__init__(*args, **kwargs)

    def __str__(self):
        """Return a nicely formatted string for these errors."""
        msg = ('The Mercurial {0} hook already exists with "{1}" in {2}. '
               'To convince Flake8 to install the hook, please remove the '
               '{0} configuration from the [hooks] section of your hgrc.')
        return msg.format(self.hook_name, self.value, self.path)


class MercurialCommitHookAlreadyExists(MercurialHookAlreadyExists):
    """Exception raised when the hg commit hook is already configured."""

    hook_name = 'commit'


class MercurialQRefreshHookAlreadyExists(MercurialHookAlreadyExists):
    """Exception raised when the hg commit hook is already configured."""

    hook_name = 'qrefresh'
