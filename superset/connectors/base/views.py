from flask import Markup

from superset.utils import SupersetException
from superset.views.base import SupersetModelView


class DatasourceModelView(SupersetModelView):
    def pre_delete(self, obj):
        if obj.slices:
            raise SupersetException(Markup(
                'Cannot delete a datasource that has slices attached to it.'
                "Here's the list of associated charts: " +
                ''.join([o.slice_link for o in obj.slices])))
