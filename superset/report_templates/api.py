from __future__ import annotations

import logging
import os
from typing import Any

from flask import Response, send_file, request
from flask_appbuilder.api import expose, protect, safe
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_babel import lazy_gettext as _
import boto3
from flask import current_app
from relatorio.templates.opendocument import Template as ODTTemplate
from io import BytesIO

from superset.commands.database.validate_sql import ValidateSQLCommand
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.extensions import event_logger
from superset.utils import core as utils
from werkzeug.utils import secure_filename
from superset.views.base_api import (
    BaseSupersetModelRestApi,
    statsd_metrics,
    requires_form_data,
)
from jinja2 import Template
from jinja2 import meta
from sqlalchemy.types import String
from .models import ReportTemplate

logger = logging.getLogger(__name__)



class ReportTemplateRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(ReportTemplate)

    include_route_methods = {
        RouteMethod.GET_LIST,
        RouteMethod.POST,
        RouteMethod.DELETE,
        "generate",
        "download",
    }
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
        """List templates with limit/offset pagination."""
        limit = request.args.get("limit", type=int) or 25
        offset = request.args.get("offset", type=int) or 0
        query = self.datamodel.session.query(ReportTemplate)
        total = query.count()
        templates = query.offset(offset).limit(limit).all()
        result = [
            {
                "id": t.id,
                "name": t.name,
                "description": t.description,
                "dataset_id": t.dataset_id,
            }
            for t in templates
        ]
        return self.response(200, result=result, count=total)

    def _storage_paths(self, cfg: Any, key: str) -> tuple[str, str]:
        s3_bucket = cfg.get("REPORT_TEMPLATE_S3_BUCKET")
        local_dir = cfg.get("REPORT_TEMPLATE_LOCAL_DIR")
        return s3_bucket, os.path.join(local_dir, key)

    def _upload(self, file, key: str) -> None:
        cfg = current_app.config
        bucket, local_path = self._storage_paths(cfg, key)

        # always save locally
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        file.seek(0)
        file.save(local_path)

        # try uploading to S3 as well
        try:
            s3 = boto3.client(
                "s3",
                endpoint_url=cfg.get("REPORT_TEMPLATE_S3_ENDPOINT"),
                aws_access_key_id=cfg.get("REPORT_TEMPLATE_S3_ACCESS_KEY"),
                aws_secret_access_key=cfg.get("REPORT_TEMPLATE_S3_SECRET_KEY"),
            )
            with open(local_path, "rb") as fp:
                s3.upload_fileobj(fp, bucket, key)
        except Exception:  # pylint: disable=broad-except
            logger.warning("Failed to upload template to S3")

    def _read(self, key: str) -> bytes:
        cfg = current_app.config
        bucket, local_path = self._storage_paths(cfg, key)

        # try local first
        try:
            with open(local_path, "rb") as f:
                return f.read()
        except FileNotFoundError:
            pass

        # fallback to S3
        try:
            s3 = boto3.client(
                "s3",
                endpoint_url=cfg.get("REPORT_TEMPLATE_S3_ENDPOINT"),
                aws_access_key_id=cfg.get("REPORT_TEMPLATE_S3_ACCESS_KEY"),
                aws_secret_access_key=cfg.get("REPORT_TEMPLATE_S3_SECRET_KEY"),
            )
            obj = s3.get_object(Bucket=bucket, Key=key)
            data = obj["Body"].read()
            os.makedirs(os.path.dirname(local_path), exist_ok=True)
            with open(local_path, "wb") as f:
                f.write(data)
            return data
        except Exception:  # pylint: disable=broad-except
            logger.error("Unable to read template from S3 or local")
            raise

    def _sanitize_params(self, params: dict[str, Any], dialect) -> dict[str, Any]:
        """Escape user-supplied parameters to avoid SQL injection."""
        sanitized: dict[str, Any] = {}
        for k, v in params.items():
            if isinstance(v, str):
                sanitized[k] = String().literal_processor(dialect=dialect)(value=v)[
                               1:-1
                               ]
            else:
                sanitized[k] = v
        return sanitized

    def _delete(self, key: str) -> None:
        cfg = current_app.config
        bucket, local_path = self._storage_paths(cfg, key)
        try:
            s3 = boto3.client(
                "s3",
                endpoint_url=cfg.get("REPORT_TEMPLATE_S3_ENDPOINT"),
                aws_access_key_id=cfg.get("REPORT_TEMPLATE_S3_ACCESS_KEY"),
                aws_secret_access_key=cfg.get("REPORT_TEMPLATE_S3_SECRET_KEY"),
            )
            s3.delete_object(Bucket=bucket, Key=key)
        except Exception as ex:  # pylint: disable=broad-except
            logger.warning("Could not delete from S3: %s", ex)
        try:
            os.remove(local_path)
        except FileNotFoundError:
            pass


    @expose("/", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.post",
        log_to_statsd=False,
    )
    @requires_form_data
    def post(self) -> Response:
        """Upload a new report template."""
        file = request.files.get("template")
        name = request.form.get("name")
        dataset_id = request.form.get("dataset_id", type=int)
        description = request.form.get("description")
        if not file or not name or not dataset_id:
            return self.response_400(message="Missing required fields")
        key = f"templates/{utils.shortid()}_{secure_filename(file.filename)}"
        try:
            self._upload(file, key)
            template = ReportTemplate(
                name=name,
                description=description,
                dataset_id=dataset_id,
                template_path=key,
            )
            self.datamodel.session.add(template)
            self.datamodel.session.commit()
            return self.response(201, id=template.id)
        except Exception as ex:  # pylint: disable=broad-except
            logger.error("Error uploading template: %s", ex)
            return self.response(500, message=str(ex))

    @expose("/<int:pk>", methods=("DELETE",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.delete",
        log_to_statsd=False,
    )
    def delete(self, pk: int) -> Response:
        """Delete a report template."""
        template = self.datamodel.session.get(ReportTemplate, pk)
        if not template:
            return self.response_404()
        try:
            self._delete(template.template_path)
        except Exception:  # pylint: disable=broad-except
            logger.warning("Error deleting template")
        self.datamodel.session.delete(template)
        self.datamodel.session.commit()
        return self.response(200, message="OK")

    @expose("/<int:pk>/download", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    def download(self, pk: int) -> Response:
        """Download the template file."""
        template = self.datamodel.session.get(ReportTemplate, pk)
        if not template:
            return self.response_404()
        try:
            data = self._read(template.template_path)
            buffer = BytesIO(data)
            buffer.seek(0)
            filename = secure_filename(template.name or "template") + ".odt"
            return send_file(
                buffer,
                mimetype="application/vnd.oasis.opendocument.text",
                as_attachment=True,
                download_name=filename,
            )
        except Exception as ex:  # pylint: disable=broad-except
            logger.error("Error downloading template: %s", ex)
            return self.response(500, message=str(ex))

    @expose("/<int:pk>/generate", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.generate",
        log_to_statsd=False,
    )
    def generate(self, pk: int, params: dict[str, Any] | None = None) -> Response:
        """Generate a report from the given template using Jinja parameters.

        Parameters are expected as a JSON body mapping Jinja placeholders to
        values.
        """
        template = self.datamodel.session.get(ReportTemplate, pk)
        if not template:
            return self.response_404()
        dataset = template.dataset

        # extra parameters for SQL templates are expected in request JSON
        if params is None:
            params = request.get_json(silent=True) or {}
        if not isinstance(params, dict):
            return self.response_400(message="Invalid json payload")
        params = self._sanitize_params(params, dataset.database.get_dialect())

        if dataset.is_virtual and dataset.sql:
            sql = dataset.sql
            if params:
                template = Template(sql)
                sql = template.render(params)
                tp = dataset.get_template_processor()
                if meta.find_undeclared_variables(tp.env.parse(sql)):
                    return self.response(400, message="Unfilled templates detected")
        else:
            sql = dataset.select_star or f"SELECT * FROM {dataset.table_name}"  # noqa: S608
        try:
            try:
                validator_errors = ValidateSQLCommand(
                    dataset.database.id,
                    {"sql": sql, "catalog": dataset.catalog, "schema": dataset.schema},
                ).run()
                if validator_errors:
                    return self.response(400, message="Invalid SQL")
            except Exception as e:  # pylint: disable=broad-except
                logger.error(f"str{e}")
                logger.warning("SQL validation skipped")

            df = dataset.database.get_df(sql, dataset.catalog, dataset.schema)
            context = {"data": df.to_dict(orient="records")}
            odt_bytes = self._read(template.template_path)
            odt_template = ODTTemplate(source=odt_bytes)
            rendered = odt_template.generate(data=context).render()
            buffer = BytesIO(rendered.getvalue())
            buffer.seek(0)
            return send_file(
                buffer,
                mimetype="application/vnd.oasis.opendocument.text",
                as_attachment=True,
                download_name=f"{template.name}.odt",
            )
        except Exception as ex:  # pylint: disable=broad-except
            logger.error("Error generating report: %s", ex)
            return self.response(500, message=str(ex))
