from __future__ import absolute_import, print_function
import import_package_subpackage_module # fail
print(import_package_subpackage_module)

from . import hello as hola

