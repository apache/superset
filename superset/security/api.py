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
import logging
from typing import Any, Dict

from flask import request, Response
from flask_appbuilder import expose
from flask_appbuilder.api import safe
from flask_appbuilder.security.decorators import permission_name, protect
from flask_wtf.csrf import generate_csrf
from marshmallow import EXCLUDE, fields, post_load, Schema, ValidationError
from marshmallow_enum import EnumField

from superset.embedded_dashboard.commands.exceptions import (
    EmbeddedDashboardNotFoundError,
)
from superset.extensions import event_logger
from superset.security.guest_token import GuestTokenResourceType
from superset.views.base_api import BaseSupersetApi, statsd_metrics

from sqlalchemy import create_engine, text, select, join, MetaData, case, func
from flask import jsonify 
from superset import app
import pandas as pd

logger = logging.getLogger(__name__)


class PermissiveSchema(Schema):
    """
    A marshmallow schema that ignores unexpected fields, instead of throwing an error.
    """

    class Meta:  # pylint: disable=too-few-public-methods
        unknown = EXCLUDE


class UserSchema(PermissiveSchema):
    username = fields.String()
    first_name = fields.String()
    last_name = fields.String()


class ResourceSchema(PermissiveSchema):
    type = EnumField(GuestTokenResourceType, by_value=True, required=True)
    id = fields.String(required=True)

    @post_load
    def convert_enum_to_value(  # pylint: disable=no-self-use
        self, data: Dict[str, Any], **kwargs: Any  # pylint: disable=unused-argument
    ) -> Dict[str, Any]:
        # we don't care about the enum, we want the value inside
        data["type"] = data["type"].value
        return data


class RlsRuleSchema(PermissiveSchema):
    dataset = fields.Integer()
    clause = fields.String(required=True)  # todo other options?


class GuestTokenCreateSchema(PermissiveSchema):
    user = fields.Nested(UserSchema)
    resources = fields.List(fields.Nested(ResourceSchema), required=True)
    rls = fields.List(fields.Nested(RlsRuleSchema), required=True)


guest_token_create_schema = GuestTokenCreateSchema()


class SecurityRestApi(BaseSupersetApi):
    resource_name = "security"
    allow_browser_login = True
    openapi_spec_tag = "Security"

    @expose("/csrf_token/", methods=["GET"])
    @event_logger.log_this
    @protect()
    @safe
    @statsd_metrics
    @permission_name("read")
    def csrf_token(self) -> Response:
        """
        Return the csrf token
        ---
        get:
          description: >-
            Fetch the CSRF token
          responses:
            200:
              description: Result contains the CSRF token
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                        result:
                          type: string
            401:
              $ref: '#/components/responses/401'
            500:
              $ref: '#/components/responses/500'
        """
        return self.response(200, result=generate_csrf())

    @expose("/guest_token/", methods=["POST"])
    @event_logger.log_this
    @protect()
    @safe
    @statsd_metrics
    @permission_name("grant_guest_token")
    def guest_token(self) -> Response:
        """Response
        Returns a guest token that can be used for auth in embedded Superset
        ---
        post:
          description: >-
            Fetches a guest token
          requestBody:
            description: Parameters for the guest token
            required: true
            content:
              application/json:
                schema: GuestTokenCreateSchema
          responses:
            200:
              description: Result contains the guest token
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                        token:
                          type: string
            401:
              $ref: '#/components/responses/401'
            400:
              $ref: '#/components/responses/400'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            body = guest_token_create_schema.load(request.json)
            self.appbuilder.sm.validate_guest_token_resources(body["resources"])

            # todo validate stuff:
            # make sure username doesn't reference an existing user
            # check rls rules for validity?
            token = self.appbuilder.sm.create_guest_access_token(
                body["user"], body["resources"], body["rls"]
            )
            return self.response(200, token=token)
        except EmbeddedDashboardNotFoundError as error:
            return self.response_400(message=error.message)
        except ValidationError as error:
            return self.response_400(message=error.messages)
        
    @expose("/get_rls_by_username/", methods=("POST",))
    @event_logger.log_this
    @protect()
    @safe
    @statsd_metrics
    @permission_name("read")
    def guest_rls_by_username(self) -> Response:
        """Get RLS configs related to a specific user, provide the output of this view during guest token request.
        ---
        post:
          description: >-
            Get RLS configs of a Superset user
          requestBody:
            description: Parameters for the RLS configs
            required: true
            content:
              application/json:
                schema:
                  type: object
                  properties:
                      username:
                        type: string
          responses:
            200:
              description: Result contains RLS configs
              content:
                application/json:
                  schema:
                    type: array
                    items:
                      type: object
                      properties:
                        dataset:
                          type: integer
                        clause:
                          type: string
            401:
              $ref: '#/components/responses/401'
            400:
              $ref: '#/components/responses/400'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            body = request.json
            # get username for next steps
            username_target = body["username"]

            # read all RLS configs related to that specific user
            engine = create_engine(app.config['SQLALCHEMY_DATABASE_URI'])
            metadata = MetaData(bind=engine)
            metadata.reflect()

            # Check if user exists and it is active
            ab_user = metadata.tables["ab_user"]
            query = select(
                [
                    case(
                        [
                            (func.count(ab_user.c.username) > 0, True)
                        ],
                        else_=False
                    ).label("is_user")
                ]
            ).filter(
                (ab_user.c.username == text(f"'{username_target}'")) & (ab_user.c.active == True)
            )

            # execute query getting boolean value
            is_active_user = engine.execute(query).scalar()

            if is_active_user == False:
              return self.response_400(message=f"user {username_target} doesn't exist or not active")

            ####### Execute query to get RLS #######################
            # get tables object
            ab_user = metadata.tables["ab_user"]
            ab_user_role = metadata.tables["ab_user_role"]
            ab_role = metadata.tables["ab_role"]
            
            # read roles related to "username_target" (argument of function)
            query = select(
                [
                    ab_user.c.first_name.label("first_name"),
                    ab_user.c.last_name.label("last_name"),
                    ab_user.c.username.label("username"),
                    ab_role.c.name.label("roles"),
                ]
            ).select_from(
                join(
                    join(
                        ab_user,
                        ab_user_role,
                        ab_user.c.id == ab_user_role.c.user_id,
                    ),
                    ab_role,
                    ab_user_role.c.role_id == ab_role.c.id,
                )
            )

            # get roles related to username_target
            results = engine.execute(query).fetchall()
            users_roles = [dict(row) for row in results]
            users_roles = [u for u in users_roles if u['username']==username_target]

            # Get row level security filters
            row_level_security_filters = metadata.tables["row_level_security_filters"]
            rls_filter_roles = metadata.tables["rls_filter_roles"]
            ab_role = metadata.tables["ab_role"]
            rls_filter_tables = metadata.tables["rls_filter_tables"]

            query = select(
                [
                    row_level_security_filters.c.group_key.label("group_key"),
                    rls_filter_tables.c.table_id.label("rls_table_id"),
                    row_level_security_filters.c.filter_type.label("rls_filter_type"),
                    ab_role.c.name.label("rls_roles"),
                    row_level_security_filters.c.clause.label("rls_clause"),
                ]
            ).select_from(
                join(
                    join(
                        join(
                            row_level_security_filters,
                            rls_filter_roles,
                            row_level_security_filters.c.id == rls_filter_roles.c.rls_filter_id,
                        ),
                        ab_role,
                        rls_filter_roles.c.role_id == ab_role.c.id,
                    ),
                    rls_filter_tables,
                    rls_filter_roles.c.rls_filter_id == rls_filter_tables.c.rls_filter_id,
                )
            )

            # Execute query getting results as list of dictionaries
            results = engine.execute(query).fetchall()
            rls_filters = [dict(row) for row in results]

            # get all roles defined in Superset UI
            ab_role = metadata.tables["ab_role"]
            name = ab_role.c.name
            query = select([name]).distinct()
            results = engine.execute(query).fetchall()
            distinct_roles = [row[0] for row in results]

            # ################### Convert Base filters to Regular filters ###########################
            # ######## (Base filter is applied to all roles not defined in the filter) ##############

            if rls_filters != []:
                
                rls_filters = pd.DataFrame(rls_filters)
                # group_key fillna to manage null values as distinct elements in group_by()
                rls_filters['group_key'] = rls_filters['group_key'].fillna('valore' + (rls_filters['group_key'].isnull().cumsum().astype(str)))
                
                #get regular filters
                requested_roles = [x['roles'] for x in users_roles]
                rls_regular_filters = rls_filters[(rls_filters['rls_filter_type']=='Regular') & (rls_filters['rls_roles'].isin(requested_roles))]
                rls_regular_filters = rls_regular_filters.to_dict('records')

                #get base filters
                def agg_roles(x):
                    return '|'.join(set(x))

                def agg_rls_clause(x):
                    return '|'.join(set(x))

                rls_base_filters = rls_filters[(rls_filters['rls_filter_type']=='Base')]
                rls_base_filters = rls_base_filters.groupby(['group_key','rls_table_id','rls_filter_type']).agg({'rls_roles':agg_roles,'rls_clause':agg_rls_clause}).reset_index()
                rls_base_filters = rls_base_filters.to_dict('records')

                for rls in rls_base_filters:
                  base_roles = rls['rls_roles'].split('|')
                  for x in set(distinct_roles).difference(set(base_roles)): #explode the row into several rows, each row for the Role not defined in the Base filter
                      rls_regular_filters.append({'group_key': rls['group_key'],
                                                  'rls_roles': x,
                                                  'rls_filter_type': 'Regular',
                                                  'rls_clause': rls['rls_clause'],
                                                  'rls_table_id': rls['rls_table_id']})

                # aggregate filters by group key
                rls_regular_filters = [x for x in rls_regular_filters if x['rls_roles'] in requested_roles]

                if rls_regular_filters != []:
                    rls_regular_filters = pd.DataFrame(rls_regular_filters).drop_duplicates(subset=['group_key','rls_table_id','rls_clause'])
                    rls_regular_filters = pd.DataFrame(rls_regular_filters).groupby(['group_key','rls_table_id'])['rls_clause'].agg(lambda x: ' OR '.join("(" + x + ")")).reset_index().to_dict('records')
                    prova1 = rls_regular_filters.copy()

                    rls = [{"dataset": x['rls_table_id'], "clause": x['rls_clause']} for x in rls_regular_filters]
                    rls = pd.DataFrame(rls).drop_duplicates().to_dict('records') #drop duplicated dictionaries
                else:
                    rls = []
            else:
                rls = []

            return jsonify(rls)
        except EmbeddedDashboardNotFoundError as error:
            return self.response_400(message=error.message)
        except ValidationError as error:
            return self.response_400(message=error.messages)

    @expose("/get_rls_by_role/", methods=("POST",))
    @event_logger.log_this
    @protect()
    @safe
    @statsd_metrics
    @permission_name("read")
    def get_rls_by_role(self) -> Response:
      """
      Get RLS configs related to a specific subset of roles, provide the output of this view during guest token request.
      ---
      post:
        description: >-
          Get RLS configs related to a specific subset of roles, provide the output of this view during guest token request.
        
        requestBody:
          description: Parameters for the RLS configs, list of roles to fetch
          required: true
          content:
            application/json:
              schema:
                type: object
                properties:
                    roles:
                      type: array
                      items:
                        type: string
        responses:
          200:
            description: Result contains RLS configs of input roles 
            content:
              application/json:
                schema:
                  type: array
                  items:
                    type: object
                    properties:
                      dataset:
                        type: integer
                      clause:
                        type: string
          401:
            $ref: '#/components/responses/401'
          400:
            $ref: '#/components/responses/400'
          500:
            $ref: '#/components/responses/500'
      """
      try:
        body = request.json
        requested_roles = body["roles"]

        # read all RLS configs related to that specific user
        engine = create_engine(app.config['SQLALCHEMY_DATABASE_URI'])

        # Create a metadata object that reflects the database schema
        metadata = MetaData(bind=engine)
        metadata.reflect()

        ####### Execute query to get RLS #######################
        # get all roles defined in Superset UI
        ab_role = metadata.tables["ab_role"]
        name = ab_role.c.name
        query = select([name]).distinct()
        result = engine.execute(query).fetchall()
        distinct_roles = [row[0] for row in result]

        # check if all roles provided by Client exist in Apache Superset otherwise error
        if len(requested_roles) > 0:
          if set(requested_roles).issubset(distinct_roles):
            pass
          else:
            return self.response_400(message=f"in {requested_roles} there's at least a role not defined in Apache Superset, check on Apache Superset or contact Administrator")
        else:
          return self.response_400(message=f"no roles provided, in request you must add at least a role defined in Apache Superset")

        # Get row level security filters
        row_level_security_filters = metadata.tables["row_level_security_filters"]
        rls_filter_roles = metadata.tables["rls_filter_roles"]
        ab_role = metadata.tables["ab_role"]
        rls_filter_tables = metadata.tables["rls_filter_tables"]

        query = select(
            [
                row_level_security_filters.c.group_key.label("group_key"),
                rls_filter_tables.c.table_id.label("rls_table_id"),
                row_level_security_filters.c.filter_type.label("rls_filter_type"),
                ab_role.c.name.label("rls_roles"),
                row_level_security_filters.c.clause.label("rls_clause"),
            ]
        ).select_from(
            join(
                join(
                    join(
                        row_level_security_filters,
                        rls_filter_roles,
                        row_level_security_filters.c.id == rls_filter_roles.c.rls_filter_id,
                    ),
                    ab_role,
                    rls_filter_roles.c.role_id == ab_role.c.id,
                ),
                rls_filter_tables,
                rls_filter_roles.c.rls_filter_id == rls_filter_tables.c.rls_filter_id,
            )
        )

        # Execute query getting results as list of dictionaries
        results = engine.execute(query).fetchall()
        rls_filters = [dict(row) for row in results]

        if rls_filters != []:
            
          rls_filters = pd.DataFrame(rls_filters)
          # group_key fillna to manage null values as distinct elements in group_by()
          rls_filters['group_key'] = rls_filters['group_key'].fillna('valore' + (rls_filters['group_key'].isnull().cumsum().astype(str)))
          
          #get regular filters
          rls_regular_filters = rls_filters[(rls_filters['rls_filter_type']=='Regular') & (rls_filters['rls_roles'].isin(requested_roles))]
          rls_regular_filters = rls_regular_filters.to_dict('records')
          
          #get base filters
          def agg_roles(x):
              return '|'.join(set(x))

          def agg_rls_clause(x):
              return '|'.join(set(x))

          rls_base_filters = rls_filters[(rls_filters['rls_filter_type']=='Base')]
          rls_base_filters = rls_base_filters.groupby(['group_key','rls_table_id','rls_filter_type']).agg({'rls_roles':agg_roles,'rls_clause':agg_rls_clause}).reset_index()
          rls_base_filters = rls_base_filters.to_dict('records')

          for rls in rls_base_filters:
            base_roles = rls['rls_roles'].split('|')
            for x in set(distinct_roles).difference(set(base_roles)): #explode the row into several rows, each row for the Role not defined in the Base filter
                rls_regular_filters.append({'group_key': rls['group_key'],
                                            'rls_roles': x,
                                            'rls_filter_type': 'Regular',
                                            'rls_clause': rls['rls_clause'],
                                            'rls_table_id': rls['rls_table_id']})

              
          # aggregate filters by group key
          rls_regular_filters = [x for x in rls_regular_filters if x['rls_roles'] in requested_roles]

          if rls_regular_filters != []:
            rls_regular_filters = pd.DataFrame(rls_regular_filters).drop_duplicates(subset=['group_key','rls_table_id','rls_clause']) 
            rls_regular_filters = pd.DataFrame(rls_regular_filters).groupby(['group_key','rls_table_id'])['rls_clause'].agg(lambda x: ' OR '.join("(" + x + ")")).reset_index().to_dict('records')

            rls = [{"dataset": x['rls_table_id'], "clause": x['rls_clause']} for x in rls_regular_filters]
            rls = pd.DataFrame(rls).drop_duplicates().to_dict('records') #drop duplicated dictionaries
          else:
            rls = []
        else:
          rls = []          
        
        return jsonify(rls)
      
      except EmbeddedDashboardNotFoundError as error:
        return self.response_400(message=error.message)
      
      except ValidationError as error:
        return self.response_400(message=error.messages)
