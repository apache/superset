# Copyright (c) 2016 Claudiu Popa <pcmanticore@gmail.com>

try:
    import pkg_resources
except ImportError:
    pkg_resources = None


def is_namespace(modname):
    # pylint: disable=no-member; astroid issue #290, modifying globals at runtime.
    return (pkg_resources is not None
            and modname in pkg_resources._namespace_packages)
