import json
from typing import Dict, Any

import jwt
from flask import Flask


class DashboardJwtDataObject:
    id_or_slug: int
    dataset_ids: [int]

    def __init__(self, id: int, dataset_ids: [int]) -> None:
        super().__init__()
        self.id_or_slug = id
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

    def parse_jwt(self, token: str) -> Dict[str, Any]:
        data = jwt.decode(token, self._jwt_secret, algorithms=["HS256"])
        #todo validate data
        return data
