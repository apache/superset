"""Test deprecated modules uninstalled."""
# pylint: disable=unused-import,no-name-in-module,import-error

from uninstalled import uninstalled_module # [deprecated-module]
import uninstalled # [deprecated-module]
