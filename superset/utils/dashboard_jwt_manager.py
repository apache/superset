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

import jwt
from flask import Flask


class DashboardJwtDataObject:
    id: int
    dataset_ids: [int]

    def __init__(self, id: int, dataset_ids: [int]) -> None:
        super().__init__()
        self.id = id
        self.dataset_ids = dataset_ids


class DashboardJwtManager:
    def __init__(self) -> None:
        super().__init__()
        self._jwt_secret: str

    def init_app(self, app: Flask) -> None:
        config = app.config

        self._jwt_secret = config["DASHBOARD_JWT_SECRET"]

    def generate_jwt(self, data: DashboardJwtDataObject) -> str:
        encoded_jwt = jwt.encode(data.__dict__, self._jwt_secret, algorithm="HS256")
        return encoded_jwt.decode("utf-8")

    def parse_jwt(self, token: str) -> DashboardJwtDataObject:
        if token:
            data = jwt.decode(token, self._jwt_secret, algorithms=["HS256"])
            return DashboardJwtDataObject(data["id"], dataset_ids=data["dataset_ids"])
        return {}
