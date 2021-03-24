import json
from typing import Any, Dict

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
