# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
from flask import request, Response
from flask_appbuilder import expose
from flask_appbuilder.api import safe
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_appbuilder.security.decorators import protect
from flask_babel import gettext as _
from jsonschema import ValidationError

from superset.cache.schemas import CacheInvalidationRequestSchema
from superset.connectors.connector_registry import ConnectorRegistry
from superset.extensions import cache_manager, db, event_logger
from superset.models.cache import CacheKey
from superset.views.base_api import BaseSupersetModelRestApi, statsd_metrics


class CacheRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(CacheKey)
    resource_name = "cache"
    allow_browser_login = True
    class_permission_name = "CacheRestApi"

    @expose("/invalidate", methods=["POST"])
    @event_logger.log_this
    @protect()
    @safe
    @statsd_metrics
    def invalidate(self) -> Response:
        """
        Takes a list of datasources, finds the associated cache records and invalidates them.

        ---
        post:
          description: >-
            Takes a list of datasources, finds the associated cache records and invalidates them.
          requestBody:
            description: >-
              A list of datasources uuid or the tuples of the database and datasource names
            required: true
            content:
              application/json:
                schema:
                  $ref: "#/components/schemas/CacheInvalidateRequestSchema"
          responses:
            201:
              $ref: '#/components/responses/201'
            400:
              $ref: '#/components/responses/400'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            datasources = CacheInvalidationRequestSchema().load(request.json)
        except KeyError:
            return self.response_400(message="Request is incorrect")
        except ValidationError as error:
            return self.response_400(
                message=_("Request is incorrect: %(error)s", error=error.messages)
            )
        datasource_uids = set(datasources.datasource_uids)
        for ds in datasources.datasources:
            ds_obj = ConnectorRegistry.get_datasource_by_name(
                session=db.session,
                datasource_type=ds.datasource_type,
                datasource_name=ds.datasource_name,
                schema=ds.schema,
                database_name=ds.database_name,
            )
            if ds_obj:
                datasource_uids.add(ds_obj.uuid)

        cache_keys = db.session.query(CacheKey).filter_by(
            CacheKey.datasource_uid.in_(datasource_uids)
        )
        cache_manager.cache.delete_many(cache_keys)
        return self.response(201)
