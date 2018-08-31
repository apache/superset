# -*- coding: utf-8 -*-
# pylint: disable=C,R,W
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_babel import gettext as __
from flask_babel import lazy_gettext as _

from superset import appbuilder
from superset.models.annotations import Annotation, AnnotationLayer
from .base import DeleteMixin, SupersetModelView


class AnnotationModelView(SupersetModelView, DeleteMixin):  # noqa
    datamodel = SQLAInterface(Annotation)

    list_title = _('List Annotation')
    show_title = _('Show Annotation')
    add_title = _('Add Annotation')
    edit_title = _('Edit Annotation')

    list_columns = ['layer', 'short_descr', 'start_dttm', 'end_dttm']
    edit_columns = [
        'layer', 'short_descr', 'long_descr', 'start_dttm', 'end_dttm',
        'json_metadata']

    add_columns = edit_columns

    label_columns = {
        'layer': _('Layer'),
        'short_descr': _('Short Descr'),
        'start_dttm': _('Start Dttm'),
        'end_dttm': _('End Dttm'),
        'long_descr': _('Long Descr'),
        'json_metadata': _('JSON Metadata'),
    }

    description_columns = {
        'json_metadata': 'This JSON represents any additional metadata this \
         annotation needs to add more context.',
    }

    def pre_add(self, obj):
        if not obj.layer:
            raise Exception('Annotation layer is required.')
        if not obj.start_dttm and not obj.end_dttm:
            raise Exception('Annotation start time or end time is required.')
        elif not obj.start_dttm:
            obj.start_dttm = obj.end_dttm
        elif not obj.end_dttm:
            obj.end_dttm = obj.start_dttm
        elif obj.end_dttm < obj.start_dttm:
            raise Exception('Annotation end time must be no earlier than start time.')

    def pre_update(self, obj):
        self.pre_add(obj)


class AnnotationLayerModelView(SupersetModelView, DeleteMixin):
    datamodel = SQLAInterface(AnnotationLayer)

    list_title = _('List Annotation Layer')
    show_title = _('Show Annotation Layer')
    add_title = _('Add Annotation Layer')
    edit_title = _('Edit Annotation Layer')

    list_columns = ['id', 'name']
    edit_columns = ['name', 'descr']
    add_columns = edit_columns

    label_columns = {
        'name': _('Name'),
        'descr': _('Description'),
    }


appbuilder.add_view(
    AnnotationLayerModelView,
    'Annotation Layers',
    label=__('Annotation Layers'),
    icon='fa-comment',
    category='Manage',
    category_label=__('Manage'),
    category_icon='')
appbuilder.add_view(
    AnnotationModelView,
    'Annotations',
    label=__('Annotations'),
    icon='fa-comments',
    category='Manage',
    category_label=__('Manage'),
    category_icon='')
