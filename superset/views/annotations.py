from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

from flask_babel import gettext as __
from flask_appbuilder.models.sqla.interface import SQLAInterface

from superset.models.annotations import Annotation, AnnotationLayer
from superset import appbuilder
from .base import SupersetModelView, DeleteMixin


class AnnotationModelView(SupersetModelView, DeleteMixin):  # noqa
    datamodel = SQLAInterface(Annotation)
    list_columns = ['layer', 'short_descr', 'start_dttm', 'end_dttm']
    edit_columns = [
        'layer', 'short_descr', 'long_descr', 'start_dttm', 'end_dttm']
    add_columns = edit_columns


class AnnotationLayerModelView(SupersetModelView, DeleteMixin):
    datamodel = SQLAInterface(AnnotationLayer)
    list_columns = ['name']
    edit_columns = ['name', 'descr']
    add_columns = edit_columns


appbuilder.add_view(
    AnnotationLayerModelView,
    "Annotation Layers",
    label=__("Annotation Layers"),
    icon="fa-comment",
    category="Manage",
    category_label=__("Manage"),
    category_icon='')
appbuilder.add_view(
    AnnotationModelView,
    "Annotations",
    label=__("Annotations"),
    icon="fa-comments",
    category="Manage",
    category_label=__("Manage"),
    category_icon='')
