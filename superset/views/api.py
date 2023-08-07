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
from __future__ import annotations

from typing import Any, TYPE_CHECKING

import simplejson as json
from flask import request
from flask_appbuilder import expose
from flask_appbuilder.api import rison
from flask_appbuilder.security.decorators import has_access_api
from flask_babel import lazy_gettext as _

from superset import db, event_logger
from superset.charts.commands.exceptions import (
    TimeRangeAmbiguousError,
    TimeRangeParseFailError,
)
from superset.legacy import update_time_range
from superset.models.slice import Slice
from superset.superset_typing import FlaskResponse
from superset.utils import core as utils
from superset.utils.date_parser import get_since_until
from superset.views.base import api, BaseSupersetView, handle_api_exception
import http.client


if TYPE_CHECKING:
    from superset.common.query_context_factory import QueryContextFactory

get_time_range_schema = {"type": "string"}


class Api(BaseSupersetView):
    query_context_factory = None

    @event_logger.log_this
    @api
    @handle_api_exception
    @has_access_api
    @expose("/v1/query/", methods=("POST",))
    def query(self) -> FlaskResponse:
        """
        Takes a query_obj constructed in the client and returns payload data response
        for the given query_obj.

        raises SupersetSecurityException: If the user cannot access the resource
        """
        query_context = self.get_query_context_factory().create(
            **json.loads(request.form["query_context"])
        )
        query_context.raise_for_access()
        result = query_context.get_payload()
        payload_json = result["queries"]
        return json.dumps(
            payload_json, default=utils.json_int_dttm_ser, ignore_nan=True
        )

    @event_logger.log_this
    @api
    @handle_api_exception
    @expose("/chat-gpt", methods=("GET",))
    def ask_chat_gpt(self, **kwargs) -> FlaskResponse:
        def call_api3(prompt_text):
            api_key = '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'
            api_url = '/v1/chat/completions'
            payload = {
                "model": "gpt-3.5-turbo",
                "messages": [
                    {
                        "role": "system",
                        "content": "I have table hive.blockchain_datawarehouse.dim_address_v2 schema id string,is_contract boolean,contract_type string,network_id int and table hive.blockchain_datawarehouse.dim_network_v2 schema id bigint,raw_id int,network_name string,chain_id int,chain_name string,chain_type string and table hive.blockchain_datawarehouse.dim_token_v2 schema id string,type string,token_name string,network_id int and table hive.blockchain_datawarehouse.fact_block_v2 schema block_id bigint,hash string,created_at timestamp,network_id int,date string and table hive.blockchain_datawarehouse.fact_transaction_detail_v2 schema tran_id string,index int,sender_address_id string,receiver_address_id string,value decimal(38,0),token_id string,type string,network_id int,date string and table hive.blockchain_datawarehouse.fact_transaction_v2 schema tran_id string,block_id bigint,size bigint,created_at timestamp,network_id int,date string stored in Trino. When I ask for any queries, just response with that query only, do not explain any further."
                    },
                    {
                        "role": "system",
                        "content": "To get smart contract, dim_address_v2.is_contract = TRUE. Token type includes 'native' and 'default'. Transaction type includes 'NFT', 'DEFI', 'TRANSFER', 'UNKNOWN'. Transaction type will be available only on fact_transaction_detail_v2, NOT fact_transaction_v2. Token type will be available only on dim_token_v2. Normally user will define network by network_name in dim_network_v2. Column network_name contains 'Optimism', 'Binance Smart Chain', 'Polygon', 'Fantom', 'Arbitrum', 'Celo', 'Avalanche', 'Cardano', 'Ethereum'. When user asks for query in a period of time, always use structure 'between ... and ...'."
                    },
                    {
                        "role": "user",
                        "content": prompt_text
                    }
                ],
                "temperature": 1,
                "max_tokens": 256,
                "top_p": 1,
                "frequency_penalty": 0,
                "presence_penalty": 0
            }

            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
            conn = http.client.HTTPSConnection("api.openai.com")
            try:
                conn.request("POST", api_url, body=json.dumps(payload), headers=headers)
                response = conn.getresponse()
                data = response.read()
                conn.close()
                result = json.loads(data)
                sql_query = result["choices"][0]["message"]["content"]
                return sql_query
            except Exception as e:
                print(f"Error: {e}")
                # Handle errors here (e.g., show an error message)
                raise e  # Re-raise the error to be handled in the calling function (if any)
        
        promt = request.args.get("promt", "")
        response = ""
        if promt == "":
            raise ValueError("Promt must not be empty string")
        else:
            response = call_api3(promt)
        
        return {
            "sql_query": response
        }


    @event_logger.log_this
    @api
    @handle_api_exception
    @has_access_api
    @expose("/v1/form_data/", methods=("GET",))
    def query_form_data(self) -> FlaskResponse:  # pylint: disable=no-self-use
        """
        Get the formdata stored in the database for existing slice.
        params: slice_id: integer
        """
        form_data = {}
        if slice_id := request.args.get("slice_id"):
            slc = db.session.query(Slice).filter_by(id=slice_id).one_or_none()
            if slc:
                form_data = slc.form_data.copy()

        update_time_range(form_data)

        return self.json_response(form_data)

    @api
    @handle_api_exception
    @has_access_api
    @rison(get_time_range_schema)
    @expose("/v1/time_range/", methods=("GET",))
    def time_range(self, **kwargs: Any) -> FlaskResponse:
        """Get actually time range from human readable string or datetime expression"""
        time_range = kwargs["rison"]
        try:
            since, until = get_since_until(time_range)
            result = {
                "since": since.isoformat() if since else "",
                "until": until.isoformat() if until else "",
                "timeRange": time_range,
            }
            return self.json_response({"result": result})
        except (ValueError, TimeRangeParseFailError, TimeRangeAmbiguousError) as error:
            error_msg = {"message": _("Unexpected time range: %s" % error)}
            return self.json_response(error_msg, 400)

    def get_query_context_factory(self) -> QueryContextFactory:
        if self.query_context_factory is None:
            # pylint: disable=import-outside-toplevel
            from superset.common.query_context_factory import QueryContextFactory

            self.query_context_factory = QueryContextFactory()
        return self.query_context_factory
