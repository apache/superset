# Copyright (c) 2014 Google, Inc.
# Copyright (c) 2015-2016 Claudiu Popa <pcmanticore@gmail.com>

# Licensed under the LGPL: https://www.gnu.org/licenses/old-licenses/lgpl-2.1.en.html
# For details: https://github.com/PyCQA/astroid/blob/master/COPYING.LESSER

import os
import sys

import pkg_resources

from astroid import builder
from astroid import MANAGER
from astroid.bases import  BUILTINS
from astroid import tests


DATA_DIR = os.path.join('testdata', 'python{}'.format(sys.version_info[0]))
RESOURCE_PATH = os.path.join(tests.__path__[0], DATA_DIR, 'data')

def find(name):
    return pkg_resources.resource_filename(
        'astroid.tests', os.path.normpath(os.path.join(DATA_DIR, name)))


def build_file(path, modname=None):
    return builder.AstroidBuilder().file_build(find(path), modname)


class SysPathSetup(object):
    def setUp(self):
        sys.path.insert(0, find(''))

    def tearDown(self):
        del sys.path[0]
        datadir = find('')
        for key in list(sys.path_importer_cache):
            if key.startswith(datadir):
                del sys.path_importer_cache[key]


class AstroidCacheSetupMixin(object):
    """Mixin for handling the astroid cache problems.

    When clearing the astroid cache, some tests fails due to
    cache inconsistencies, where some objects had a different
    builtins object referenced.
    This saves the builtins module and makes sure to add it
    back to the astroid_cache after the tests finishes.
    The builtins module is special, since some of the
    transforms for a couple of its objects (str, bytes etc)
    are executed only once, so astroid_bootstrapping will be
    useless for retrieving the original builtins module.
    """

    @classmethod
    def setUpClass(cls):
        cls._builtins = MANAGER.astroid_cache.get(BUILTINS)

    @classmethod
    def tearDownClass(cls):
        if cls._builtins:
            MANAGER.astroid_cache[BUILTINS] = cls._builtins
