# Copyright (c) 2016 Claudiu Popa <pcmanticore@gmail.com>

# Licensed under the LGPL: https://www.gnu.org/licenses/old-licenses/lgpl-2.1.en.html
# For details: https://github.com/PyCQA/astroid/blob/master/COPYING.LESSER

'''Astroid brain hints for some of the _io C objects.'''

import astroid


BUFFERED = {'BufferedWriter', 'BufferedReader'}
TextIOWrapper = 'TextIOWrapper'
FileIO = 'FileIO'
BufferedWriter = 'BufferedWriter'


def _generic_io_transform(node, name, cls):
    '''Transform the given name, by adding the given *class* as a member of the node.'''

    io_module = astroid.MANAGER.ast_from_module_name('_io')
    attribute_object = io_module[cls]
    instance = attribute_object.instantiate_class()
    node.locals[name] = [instance]


def _transform_text_io_wrapper(node):
    # This is not always correct, since it can vary with the type of the descriptor,
    # being stdout, stderr or stdin. But we cannot get access to the name of the
    # stream, which is why we are using the BufferedWriter class as a default
    # value
    return _generic_io_transform(node, name='buffer', cls=BufferedWriter)


def _transform_buffered(node):
    return _generic_io_transform(node, name='raw', cls=FileIO)


astroid.MANAGER.register_transform(astroid.ClassDef,
                                   _transform_buffered,
                                   lambda node: node.name in BUFFERED)
astroid.MANAGER.register_transform(astroid.ClassDef,
                                   _transform_text_io_wrapper,
                                   lambda node: node.name == TextIOWrapper)
