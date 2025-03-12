import pandas as pd
from flask import Response
from flask_appbuilder import permission_name
from flask_appbuilder.api import expose, protect, safe
from flask_appbuilder.models.sqla.interface import SQLAInterface

from superset import event_logger, is_feature_enabled
from superset.charts.post_processing import apply_post_process
from superset.commands.chart.data.get_data_command import ChartDataCommand
from superset.commands.dashboard.exceptions import DashboardAccessDeniedError
from superset.common.chart_data import ChartDataResultType, ChartDataResultFormat
from superset.constants import RouteMethod, MODEL_API_RW_METHOD_PERMISSION_MAP
from superset.daos.chart import ChartDAO
from superset.daos.dashboard import DashboardDAO
from superset.daos.exceptions import DatasourceNotFound
from superset.exceptions import QueryObjectValidationError
from superset.models.slice import Slice
from superset.utils.google_sheets import GoogleSheetsExport
from superset.views.base_api import statsd_metrics, BaseSupersetModelRestApi
import logging
from marshmallow import ValidationError


logger = logging.getLogger(__name__)


class AvenRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(Slice)

    resource_name = "aven"
    class_permission_name = "Chart"
    allow_browser_login = True
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP
    include_route_methods = RouteMethod.REST_MODEL_VIEW_CRUD_SET | {
        "export_chart_to_google_sheet",
        "export_dashboard_to_google_sheet",
    }

    @expose("/<id_or_slug>/export/chart_to_google_sheet", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.export_chart_to_google_sheet",
        log_to_statsd=False,
    )
    def export_chart_to_google_sheet(self, id_or_slug: str) -> Response:
        """Export a chart to a google sheet.
        ---
        get:
          summary: Exports a chart to a google sheet.
          parameters:
          - in: path
            schema:
              type: string
            name: id_or_slug
          responses:
            200:
              description: SQL Export Spreadsheet
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      sheetId:
                        type: string
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
        """
        if not is_feature_enabled("GOOGLE_SHEETS_EXPORT"):
            return self.response(501, message="GOOGLE_SHEETS_EXPORT is not enabled")
        slice_id = id_or_slug
        logger.info(f"Exporting chart with slice id {slice_id} to Google Sheets")
        try:
            chart = ChartDAO.find_by_id(slice_id)
            chart_dfs: list[tuple[str, pd.DataFrame]] = []
            # this is based on the structure of "chart_warmup" to pull down the data
            form_data = chart.form_data
            viz_type = chart.viz_type

            if not chart:
                logger.info(
                    f"Could not find any chart with id {slice_id}")
                return self.response_400(f"Could not find any chart with id {slice_id}")

            if not chart.datasource:
                logger.info(
                    f"Chart {chart.id} as it does not have a datasource")
                return self.response_400(f"Chart {chart.id} does not have a datasource")

            if not viz_type in ["table", "pivot_table_v2"]:
                logger.info(
                    f"Chart {chart.id} as it is not a table or pivot_table")
                return self.response_400(
                    message="Only table and pivot_table charts can be exported to Google Sheets"
                )

            logger.info(
                f"Exporting chart {chart.id} to Google Sheets, viz_type: {viz_type}")

            query_context = chart.get_query_context()

            if not query_context:
                logger.warn(
                    f"Chart {chart.slice_name} {chart.id} as it does not have a query context this generally is due to a very old chart never being executed and never being added to a dashboard. This can be fixed by force saving the chart.")
                return self.response_400(
                    message="does not have a query context this generally is due to a very old chart never being executed and never being added to a dashboard. This can be fixed by force saving the chart."
                )

            query_context.result_type = ChartDataResultType.POST_PROCESSED
            query_context.result_format = ChartDataResultFormat.JSON

            command = ChartDataCommand(query_context)
            command.validate()
            result = command.run()

            for query in result["queries"]:
                # force the result format to be JSON
                query["result_format"] = ChartDataResultFormat.JSON

            result = apply_post_process(result, form_data, chart.datasource)

            chart_data = result["queries"][0]["data"]

            chart_df = pd.DataFrame(chart_data)

            logger.info(chart_df)
            chart_dfs.append((chart.slice_name, chart_df))

            event_info = {
                "event_type": "data_export",
                "chart_id": chart.id,
                "row_count": len(chart_df.index),
                "df_shape": chart_df.shape,
                "exported_format": "gsheet",
            }
            event_rep = repr(event_info)
            logger.debug(
                "GSheet exported: %s", event_rep,
                extra={"superset_event": event_info}
            )
            google_sheets_export = GoogleSheetsExport()
            sheet_id = google_sheets_export.upload_dfs_to_new_sheet(
                chart.slice_name, chart_dfs)
            return self.response(200, sheet_id=sheet_id)
        except DatasourceNotFound:
            logger.error("Datasource not found")
            return self.response_404()
        except QueryObjectValidationError as error:
            logger.error(f"Query object validation error {error}")
            return self.response_400(message=error.message)
        except ValidationError as error:
            logger.error(f"Validation error {error.normalized_messages()}")
            return self.response_400(
                message=error.normalized_messages()
            )
        except DashboardAccessDeniedError:
            return self.response_403()


    @expose("/<id_or_slug>/export/dashboard_to_google_sheet", methods=("GET",))
    @protect()
    @safe
    @permission_name("read")
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args,
                      **kwargs: f"{self.__class__.__name__}.export_dashboard_to_google_sheet",
        log_to_statsd=False,
    )
    def export_dashboard_to_google_sheet(self, id_or_slug: str) -> Response:
        """Export a dashboard's charts to a google sheet.
        ---
        get:
          summary: Get a dashboard's charts to a google sheet.
          parameters:
          - in: path
            schema:
              type: string
            name: id_or_slug
          responses:
            200:
              description: SQL Export Spreadsheet
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      sheetId:
                        type: string
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
        """
        if not is_feature_enabled("GOOGLE_SHEETS_EXPORT"):
            return self.response(501, message="GOOGLE_SHEETS_EXPORT is not enabled")
        dashboard_id = id_or_slug
        logger.info(f"Exporting dashboard {dashboard_id} to Google Sheets")
        try:
            dashboard = DashboardDAO().get_by_id_or_slug(id_or_slug)
            charts = DashboardDAO.get_charts_for_dashboard(dashboard_id)
            chart_dfs: list[tuple[str, pd.DataFrame]] = []
            # this is based on the structure of "chart_warmup" to pull down the data
            for chart in charts:
                form_data = chart.form_data
                viz_type = chart.viz_type

                if not chart.datasource:
                    logger.info(
                        f"Skipping chart {chart.id} as it does not have a datasource")
                    continue

                if not viz_type in ["table", "pivot_table_v2"]:
                    logger.info(
                        f"Skipping chart {chart.id} as it is not a table or pivot_table")
                    continue

                logger.info(
                    f"Exporting chart {chart.id} to Google Sheets, viz_type: {viz_type}")

                query_context = chart.get_query_context()

                if not query_context:
                    logger.warn(
                        f"Skipping chart {chart.slice_name} {chart.id} as it does not have a query context this generally is due to a very old chart never being executed and never being added to a dashboard. This can be fixed by force saving the chart.")
                    continue

                query_context.result_type = ChartDataResultType.POST_PROCESSED
                query_context.result_format = ChartDataResultFormat.JSON

                command = ChartDataCommand(query_context)
                command.validate()
                result = command.run()

                for query in result["queries"]:
                    # force the result format to be JSON
                    query["result_format"] = ChartDataResultFormat.JSON

                result = apply_post_process(result, form_data, chart.datasource)

                chart_data = result["queries"][0]["data"]

                chart_df = pd.DataFrame(chart_data)

                logger.info(chart_df)
                chart_dfs.append((chart.slice_name, chart_df))

                event_info = {
                    "event_type": "data_export",
                    "dashboard_id": dashboard_id,
                    "chart_id": chart.id,
                    "row_count": len(chart_df.index),
                    "df_shape": chart_df.shape,
                    "exported_format": "gsheet",
                }
                event_rep = repr(event_info)
                logger.debug(
                    "GSheet exported: %s", event_rep, extra={"superset_event": event_info}
                )
            google_sheets_export = GoogleSheetsExport()
            sheet_id = google_sheets_export.upload_dfs_to_new_sheet(
                dashboard.dashboard_title, chart_dfs)
            return self.response(200, sheet_id=sheet_id)
        except DatasourceNotFound:
            logger.error("Datasource not found")
            return self.response_404()
        except QueryObjectValidationError as error:
            logger.error(f"Query object validation error {error}")
            return self.response_400(message=error.message)
        except ValidationError as error:
            logger.error(f"Validation error {error.normalized_messages()}")
            return self.response_400(
                message=error.normalized_messages()
            )
        except DashboardAccessDeniedError:
            return self.response_403()
