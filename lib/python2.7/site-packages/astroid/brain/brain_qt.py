# Copyright (c) 2015-2016 Claudiu Popa <pcmanticore@gmail.com>

# Licensed under the LGPL: https://www.gnu.org/licenses/old-licenses/lgpl-2.1.en.html
# For details: https://github.com/PyCQA/astroid/blob/master/COPYING.LESSER

"""Astroid hooks for the PyQT library."""

from astroid import MANAGER, register_module_extender
from astroid.builder import AstroidBuilder
from astroid import nodes
from astroid import parse


def _looks_like_signal(node, signal_name='pyqtSignal'):
    if '__class__' in node.instance_attrs:
        try:
            cls = node.instance_attrs['__class__'][0]
            return cls.name == signal_name
        except AttributeError:
            # return False if the cls does not have a name attribute
            pass
    return False


def transform_pyqt_signal(node):    
    module = parse('''
    class pyqtSignal(object):
        def connect(self, slot, type=None, no_receiver_check=False):
            pass
        def disconnect(self, slot):
            pass
        def emit(self, *args):
            pass
    ''')
    signal_cls = module['pyqtSignal']
    node.instance_attrs['emit'] = signal_cls['emit']
    node.instance_attrs['disconnect'] = signal_cls['disconnect']
    node.instance_attrs['connect'] = signal_cls['connect']


def pyqt4_qtcore_transform():
    return AstroidBuilder(MANAGER).string_build('''

def SIGNAL(signal_name): pass

class QObject(object):
    def emit(self, signal): pass
''')


register_module_extender(MANAGER, 'PyQt4.QtCore', pyqt4_qtcore_transform)
MANAGER.register_transform(nodes.FunctionDef, transform_pyqt_signal,
                           _looks_like_signal)