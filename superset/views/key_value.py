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
import simplejson as json
from flask import request, Response
from flask_appbuilder import expose
from flask_appbuilder.security.decorators import has_access_api

from superset import db, event_logger
from superset.models import core as models
from superset.typing import FlaskResponse
from superset.utils import core as utils
from superset.views.base import BaseSupersetView, json_error_response


class KV(BaseSupersetView):

    """Used for storing and retrieving key value pairs"""

    @event_logger.log_this
    @has_access_api
    @expose("/store/", methods=["POST"])
    def store(self) -> FlaskResponse:  # pylint: disable=no-self-use
        try:
            value = request.form.get("data")
            obj = models.KeyValue(value=value)
            db.session.add(obj)
            db.session.commit()
        except Exception as ex:  # pylint: disable=broad-except
            return json_error_response(utils.error_msg_from_exception(ex))
        return Response(json.dumps({"id": obj.id}), status=200)

    @event_logger.log_this
    @has_access_api
    @expose("/<int:key_id>/", methods=["GET"])
    def get_value(self, key_id: int) -> FlaskResponse:  # pylint: disable=no-self-use
        try:
            kv = db.session.query(models.KeyValue).filter_by(id=key_id).scalar()
            if not kv:
                return Response(status=404, content_type="text/plain")
        except Exception as ex:  # pylint: disable=broad-except
            return json_error_response(utils.error_msg_from_exception(ex))
        return Response(kv.value, status=200, content_type="text/plain")
