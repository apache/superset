# -*- coding: utf-8 -*-
"""
celery.contrib.sphinx
=====================

Sphinx documentation plugin

**Usage**

Add the extension to your :file:`docs/conf.py` configuration module:

.. code-block:: python

    extensions = (...,
                  'celery.contrib.sphinx')

If you would like to change the prefix for tasks in reference documentation
then you can change the ``celery_task_prefix`` configuration value:

.. code-block:: python

    celery_task_prefix = '(task)'  # < default


With the extension installed `autodoc` will automatically find
task decorated objects and generate the correct (as well as
add a ``(task)`` prefix), and you can also refer to the tasks
using `:task:proj.tasks.add` syntax.

Use ``.. autotask::`` to manually document a task.

"""
from __future__ import absolute_import

try:
    from inspect import formatargspec, getfullargspec as getargspec
except ImportError:  # Py2
    from inspect import formatargspec, getargspec  # noqa

from sphinx.domains.python import PyModulelevel
from sphinx.ext.autodoc import FunctionDocumenter

from celery.app.task import BaseTask


class TaskDocumenter(FunctionDocumenter):
    objtype = 'task'
    member_order = 11

    @classmethod
    def can_document_member(cls, member, membername, isattr, parent):
        return isinstance(member, BaseTask) and getattr(member, '__wrapped__')

    def format_args(self):
        wrapped = getattr(self.object, '__wrapped__')
        if wrapped is not None:
            argspec = getargspec(wrapped)
            fmt = formatargspec(*argspec)
            fmt = fmt.replace('\\', '\\\\')
            return fmt
        return ''

    def document_members(self, all_members=False):
        pass


class TaskDirective(PyModulelevel):

    def get_signature_prefix(self, sig):
        return self.env.config.celery_task_prefix


def setup(app):
    app.add_autodocumenter(TaskDocumenter)
    app.domains['py'].directives['task'] = TaskDirective
    app.add_config_value('celery_task_prefix', '(task)', True)
