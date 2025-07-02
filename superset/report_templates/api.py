from __future__ import annotations

import logging
from typing import Any

from flask import Response, send_file
from flask_appbuilder.api import expose, protect, safe
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_babel import lazy_gettext as _
import boto3
from flask import current_app
from relatorio.templates.opendocument import Template as ODTTemplate
from io import BytesIO

from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.extensions import event_logger
from superset.utils import core as utils
from superset.views.base_api import BaseSupersetModelRestApi, statsd_metrics

from .models import ReportTemplate

logger = logging.getLogger(__name__)


class ReportTemplateRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(ReportTemplate)

    include_route_methods = {RouteMethod.GET_LIST, "generate"}
    class_permission_name = "ReportTemplate"
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP

    resource_name = "report_template"
    allow_browser_login = True

    list_columns = ["id", "name", "description", "dataset_id"]

    openapi_spec_tag = "Report Templates"

    @expose("/", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    def get_list(self) -> Response:
        templates = self.datamodel.session.query(ReportTemplate).all()
        result = [
            {
                "id": t.id,
                "name": t.name,
                "description": t.description,
                "dataset_id": t.dataset_id,
            }
            for t in templates
        ]
        return self.response(200, result=result)

    @expose("/<int:pk>/generate", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.generate",
        log_to_statsd=False,
    )
    def generate(self, pk: int) -> Response:
        """Generate a report from the given template."""
        template = self.datamodel.session.get(ReportTemplate, pk)
        if not template:
            return self.response_404()
        dataset = template.dataset
        if dataset.is_virtual and dataset.sql:
            sql = dataset.sql
        else:
            sql = dataset.select_star or f"SELECT * FROM {dataset.table_name}"
        try:
            df = dataset.database.get_df(sql, dataset.catalog, dataset.schema)
            context = {"data": df.to_dict(orient="records")}
            cfg = current_app.config
            s3 = boto3.client(
                "s3",
                endpoint_url=cfg.get("REPORT_TEMPLATE_S3_ENDPOINT"),
                aws_access_key_id=cfg.get("REPORT_TEMPLATE_S3_ACCESS_KEY"),
                aws_secret_access_key=cfg.get("REPORT_TEMPLATE_S3_SECRET_KEY"),
            )
            obj = s3.get_object(
                Bucket=cfg.get("REPORT_TEMPLATE_S3_BUCKET"),
                Key=template.template_path,
            )
            odt_bytes = obj["Body"].read()
            odt_template = ODTTemplate(source=odt_bytes)
            rendered = odt_template.render(context)
            buffer = BytesIO(rendered)
            buffer.seek(0)
            return send_file(
                buffer,
                mimetype="application/vnd.oasis.opendocument.text",
                as_attachment=True,
                download_name=f"{utils.get_user_username()}_{template.name}.odt",
            )
        except Exception as ex:  # pylint: disable=broad-except
            logger.error("Error generating report: %s", ex, exc_info=True)
            return self.response(500, message=str(ex))
