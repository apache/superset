import logging
import boto3


import simplejson as json
from flask import Response, request
from flask_appbuilder.api import expose, protect, safe 
from flask_appbuilder.security.decorators import permission_name

from superset import app
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP

from superset.extensions import event_logger

from superset.utils import core as utils
from superset.views.base import json_success
from superset.views.base_api import BaseSupersetApi, statsd_metrics, requires_json
from superset.sfrestapi.schemas import SFRestAPIListBucketSchema

# config = app.config
logger = logging.getLogger(__name__)


class SFRestAPI(BaseSupersetApi):
    class_permission_name = "AdvancedDataType"
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP

    resource_name = "sfrestapi"
    allow_browser_login = True
    openapi_spec_tag = "SF Rest API"
    openapi_spec_component_schemas = (SFRestAPIListBucketSchema,)

    @expose("/list-s3-buckets", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this
    def get(self) -> Response:
        """List all Buckets in account
        ---
        get:
          summary: Get the list of all buckets in account.
          description: >-
            List of All S3 Buckets as an array
          responses:
            200:
              description: Returns the list of all buckets in account.
              content:
                application/json:
                  schema:
                    $ref: '#/components/schemas/SFRestAPIListBucketSchema'
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            500:
              $ref: '#/components/responses/500'
        """

        logger.info("============================================================")
        s3 = boto3.client("s3")
        response = s3.list_buckets()
        buckets = []
        for bucket in response["Buckets"]:
            buckets.append(bucket["Name"])
        return json_success(
            json.dumps(
                {"buckets": buckets},
                default=utils.json_iso_dttm_ser,
                ignore_nan=True,
            ),
            200,
        )

    @expose("/test-post", methods=("POST",))
    @statsd_metrics
    @requires_json
    @event_logger.log_this
    @protect()
    def test_post(self) -> Response:
      """Estimate the SQL query execution cost.
        ---
        post:
          summary: Estimate the SQL query execution cost
          requestBody:
            description: SQL query and params
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/EstimateQueryCostSchema'
          responses:
            200:
              description: Query estimation result
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        type: object
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            500:
              $ref: '#/components/responses/500'
        """
      return json_success(
          json.dumps(
              {"request": request.json},
              default=utils.json_iso_dttm_ser,
              ignore_nan=True,
          ),
          200,
      )
