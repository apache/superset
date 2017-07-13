# Copyright (c) 2015-2016 Claudiu Popa <pcmanticore@gmail.com>
# Copyright (c) 2016 Cara Vinson <ceridwenv@gmail.com>

# Licensed under the LGPL: https://www.gnu.org/licenses/old-licenses/lgpl-2.1.en.html
# For details: https://github.com/PyCQA/astroid/blob/master/COPYING.LESSER

"""Astroid hooks for dateutil"""

import textwrap

from astroid import MANAGER, register_module_extender
from astroid.builder import AstroidBuilder

def dateutil_transform():
    return AstroidBuilder(MANAGER).string_build(textwrap.dedent('''
    import datetime
    def parse(timestr, parserinfo=None, **kwargs):
        return datetime.datetime()
    '''))

register_module_extender(MANAGER, 'dateutil.parser', dateutil_transform)
