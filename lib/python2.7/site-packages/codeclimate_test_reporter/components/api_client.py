import json
import os
import requests


class ApiClient:
    def __init__(self, host=None, timeout=5):
        self.host = host or self.__default_host().rstrip("/")
        self.timeout = timeout

    def post(self, payload):
        headers = {"Content-Type": "application/json"}
        response = requests.post(
            "%s/test_reports" % self.host,
            data=json.dumps(payload),
            headers=headers,
            timeout=self.timeout
        )

        return response

    def __default_host(self):
        return os.environ.get("CODECLIMATE_API_HOST", "https://codeclimate.com")
