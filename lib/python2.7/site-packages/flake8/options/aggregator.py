"""Aggregation function for CLI specified options and config file options.

This holds the logic that uses the collected and merged config files and
applies the user-specified command-line configuration on top of it.
"""
import logging

from flake8 import utils
from flake8.options import config

LOG = logging.getLogger(__name__)


def aggregate_options(manager, arglist=None, values=None):
    """Aggregate and merge CLI and config file options.

    :param flake8.option.manager.OptionManager manager:
        The instance of the OptionManager that we're presently using.
    :param list arglist:
        The list of arguments to pass to ``manager.parse_args``. In most cases
        this will be None so ``parse_args`` uses ``sys.argv``. This is mostly
        available to make testing easier.
    :param optparse.Values values:
        Previously parsed set of parsed options.
    :returns:
        Tuple of the parsed options and extra arguments returned by
        ``manager.parse_args``.
    :rtype:
        tuple(optparse.Values, list)
    """
    # Get defaults from the option parser
    default_values, _ = manager.parse_args([], values=values)
    # Get original CLI values so we can find additional config file paths and
    # see if --config was specified.
    original_values, original_args = manager.parse_args(arglist)
    extra_config_files = utils.normalize_paths(original_values.append_config)

    # Make our new configuration file mergerator
    config_parser = config.MergedConfigParser(
        option_manager=manager,
        extra_config_files=extra_config_files,
        args=original_args,
    )

    # Get the parsed config
    parsed_config = config_parser.parse(original_values.config,
                                        original_values.isolated)

    # Extend the default ignore value with the extended default ignore list,
    # registered by plugins.
    extended_default_ignore = manager.extended_default_ignore.copy()
    LOG.debug('Extended default ignore list: %s',
              list(extended_default_ignore))
    extended_default_ignore.update(default_values.ignore)
    default_values.ignore = list(extended_default_ignore)
    LOG.debug('Merged default ignore list: %s', default_values.ignore)

    extended_default_select = manager.extended_default_select.copy()
    LOG.debug('Extended default select list: %s',
              list(extended_default_select))
    default_values.extended_default_select = extended_default_select

    # Merge values parsed from config onto the default values returned
    for config_name, value in parsed_config.items():
        dest_name = config_name
        # If the config name is somehow different from the destination name,
        # fetch the destination name from our Option
        if not hasattr(default_values, config_name):
            dest_name = config_parser.config_options[config_name].dest

        LOG.debug('Overriding default value of (%s) for "%s" with (%s)',
                  getattr(default_values, dest_name, None),
                  dest_name,
                  value)
        # Override the default values with the config values
        setattr(default_values, dest_name, value)

    # Finally parse the command-line options
    return manager.parse_args(arglist, default_values)
