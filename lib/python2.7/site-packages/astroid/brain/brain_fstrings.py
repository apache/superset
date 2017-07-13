# Copyright (c) 2017 Claudiu Popa <pcmanticore@gmail.com>

# Licensed under the LGPL: https://www.gnu.org/licenses/old-licenses/lgpl-2.1.en.html
# For details: https://github.com/PyCQA/astroid/blob/master/COPYING.LESSER

import sys

import astroid


def _clone_node_with_lineno(node, parent, lineno):
    cls = node.__class__
    other_fields = node._other_fields
    _astroid_fields = node._astroid_fields
    init_params = {
        'lineno': lineno,
        'col_offset': node.col_offset,
        'parent': parent
    }
    postinit_params = {
        param: getattr(node, param)
        for param in _astroid_fields
    }
    if other_fields:
        init_params.update({
            param: getattr(node, param)
            for param in other_fields
        })
    new_node = cls(**init_params)
    if hasattr(node, 'postinit'):
        new_node.postinit(**postinit_params)
    return new_node


def _transform_formatted_value(node):
    if node.value and node.value.lineno == 1:
        if node.lineno != node.value.lineno:
            new_node = astroid.FormattedValue(
                lineno=node.lineno,
                col_offset=node.col_offset,
                parent=node.parent
            )
            new_value = _clone_node_with_lineno(
                node=node.value,
                lineno=node.lineno,
                parent=new_node
            )
            new_node.postinit(value=new_value,
                              format_spec=node.format_spec)
            return new_node


if sys.version_info[:2] >= (3, 6):
    # TODO: this fix tries to *patch* http://bugs.python.org/issue29051
    # The problem is that FormattedValue.value, which is a Name node,
    # has wrong line numbers, usually 1. This creates problems for pylint,
    # which expects correct line numbers for things such as message control.
    astroid.MANAGER.register_transform(
        astroid.FormattedValue,
        _transform_formatted_value)

