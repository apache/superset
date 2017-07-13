"""Module containing the logic for our debugging logic."""
from __future__ import print_function

import json
import platform

import setuptools


def print_information(option, option_string, value, parser,
                      option_manager=None):
    """Print debugging information used in bug reports.

    :param option:
        The optparse Option instance.
    :type option:
        optparse.Option
    :param str option_string:
        The option name
    :param value:
        The value passed to the callback parsed from the command-line
    :param parser:
        The optparse OptionParser instance
    :type parser:
        optparse.OptionParser
    :param option_manager:
        The Flake8 OptionManager instance.
    :type option_manager:
        flake8.options.manager.OptionManager
    """
    if not option_manager.registered_plugins:
        # NOTE(sigmavirus24): Flake8 parses options twice. The first time, we
        # will not have any registered plugins. We can skip this one and only
        # take action on the second time we're called.
        return
    print(json.dumps(information(option_manager), indent=2, sort_keys=True))
    raise SystemExit(False)


def information(option_manager):
    """Generate the information to be printed for the bug report."""
    return {
        'version': option_manager.version,
        'plugins': plugins_from(option_manager),
        'dependencies': dependencies(),
        'platform': {
            'python_implementation': platform.python_implementation(),
            'python_version': platform.python_version(),
            'system': platform.system(),
        },
    }


def plugins_from(option_manager):
    """Generate the list of plugins installed."""
    return [{'plugin': plugin, 'version': version}
            for (plugin, version) in sorted(option_manager.registered_plugins)]


def dependencies():
    """Generate the list of dependencies we care about."""
    return [{'dependency': 'setuptools', 'version': setuptools.__version__}]
