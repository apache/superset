import json

from flask import request, Response
from flask_appbuilder import expose
from flask_babel import gettext as __

from superset import appbuilder, db
from superset.connectors.connector_registry import ConnectorRegistry
import superset.models.core as models
from superset.utils import has_access
from superset.views.base import (BaseSupersetView, json_error_response)


ALL_DATASOURCE_ACCESS_ERR = __(
    'This endpoint requires the `all_datasource_access` permission')
DATASOURCE_MISSING_ERR = __('The datasource seems to have been deleted')
ACCESS_REQUEST_MISSING_ERR = __(
    'The access requests seem to have been deleted')
USER_MISSING_ERR = __('The user seems to have been deleted')
DATASOURCE_ACCESS_ERR = __("You don't have access to this datasource")

log_this = models.Log.log_this


def json_success(json_msg, status=200):
    return Response(json_msg, status=status, mimetype='application/json')


TYPE_TIMESTAMP = {'TIMESTAMP', 'DATE', 'DATETIME', 'TIME'}
TYPE_NUMERIC = {'INT', 'FLOAT', 'NUMERIC', 'REAL', 'DECIMAL',
                'BIGINT', 'SMALLINT', 'INTEGER'}
TYPE_BOOL = {'BOOLEAN', 'BOOL'}
# TYPE_STRING = {'CHAR','VARCHAR', 'NCHAR',
#                'NVARCHAR', 'TEXT', 'STRING', 'ENUM'}


class SwivelView(BaseSupersetView):
    route_base = '/swivel'

    @expose('', methods=['GET', 'POST'])
    def list(self):
        payload = request.args
        if request.method == 'POST':
            payload = request.get_json()
        return self.render_template(
            'superset/swivel.html',
            bootstrap_data=json.dumps(payload))

    def getDimensionType(self, input_type, is_time,
                         is_num, is_string):
        if is_time or input_type.upper() in TYPE_TIMESTAMP:
            return 'TIMESTAMP'
        elif is_num or input_type.upper() in TYPE_NUMERIC:
            return 'NUMERIC'
        elif input_type.upper() in TYPE_BOOL:
            return 'BOOL'
        else:
            return 'NVARCHAR'

    @has_access
    @expose('/fetch_datasource_metadata')
    @log_this
    def fetch_datasource_metadata(self):
        datasource_id, datasource_type = (
            request.args.get('uid').split('__'))
        datasource_class = ConnectorRegistry.sources[datasource_type]
        datasource = (db.session.query(datasource_class)
                        .filter_by(id=int(datasource_id))
                        .first())

        # Check if datasource exists
        if not datasource:
            return json_error_response(DATASOURCE_MISSING_ERR)

        # Check permission for datasource
        if not self.datasource_access(datasource):
            return json_error_response(DATASOURCE_ACCESS_ERR)

        columns = [{'name': c.verbose_name
                    if c.verbose_name else c.column_name,
                    'id': c.column_name,
                    'type': self.getDimensionType(str(c.type),
                                                  c.is_dttm if hasattr(
                                                      c, 'is_dttm') else c.is_time,
                                                  c.is_num, c.is_string),
                    'groupable': c.groupby,
                    'filterable': c.filterable} for c in datasource.columns]

        metrics = [{'name': c.verbose_name
                    if c.verbose_name else c.metric_name,
                    'id': c.metric_name,
                    'selected': False,
                    'format': c.d3format} for c in datasource.metrics]
        if datasource.type == 'table':
            time_grains = datasource.time_column_grains.get('time_grains')
        elif datasource.type == 'druid':
            time_grains = datasource.time_column_grains.get('time_columns')

        return json_success(json.dumps({'columns': columns,
                                        'metrics': metrics,
                                        'time_grains': time_grains}))


appbuilder.add_view(SwivelView, 'latest_swivel',
                    label=__('Latest Session'),
                    href='',
                    icon='fa-clock-o',
                    category='Swivel',
                    category_icon='fa-line-chart',
                    category_label=__('Swivel'))

appbuilder.add_link('new_swivel',
                    label=__('New Session'),
                    href='/swivel?new=true',
                    icon='fa-plus',
                    category='Swivel')
