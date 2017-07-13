"""Module containing some of the logic for our VCS installation logic."""
from flake8 import exceptions as exc
from flake8.main import git
from flake8.main import mercurial


# NOTE(sigmavirus24): In the future, we may allow for VCS hooks to be defined
# as plugins, e.g., adding a flake8.vcs entry-point. In that case, this
# dictionary should disappear, and this module might contain more code for
# managing those bits (in conjuntion with flake8.plugins.manager).
_INSTALLERS = {
    'git': git.install,
    'mercurial': mercurial.install,
}


def install(option, option_string, value, parser):
    """Determine which version control hook to install.

    For more information about the callback signature, see:
    https://docs.python.org/2/library/optparse.html#optparse-option-callbacks
    """
    installer = _INSTALLERS.get(value)
    errored = False
    successful = False
    try:
        successful = installer()
    except exc.HookInstallationError as hook_error:
        print(str(hook_error))
        errored = True

    if not successful:
        print('Could not find the {0} directory'.format(value))
    raise SystemExit(not successful and errored)


def choices():
    """Return the list of VCS choices."""
    return list(_INSTALLERS.keys())
