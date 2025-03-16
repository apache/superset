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
from marshmallow import Schema
from marshmallow.fields import Boolean, DateTime, Integer, List, Nested, String


class StatementSchema(Schema):
    id = Integer()
    finished = Boolean()


class UserResponseSchema(Schema):
    id = Integer()
    username = String()
    email = String()
    first_name = String()
    last_name = String()
    is_active = Boolean()
    is_anonymous = Boolean()
    is_onboarding_finished = Boolean(missing=True)
    onboarding_started_time = Boolean(missing=True)
    dodo_role = String(missing=True)
    team = String(missing=True)
    statements = List(Nested(StatementSchema()), missing=True)
    country_name = String(missing=True)


class ValidateOnboardingPutSchema(Schema):
    onboarding_started_time = DateTime()
    dodo_role = String()
