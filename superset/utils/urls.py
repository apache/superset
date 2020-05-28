import urllib

from flask import current_app, url_for


def headless_url(path: str) -> str:
    base_url = current_app.config.get("WEBDRIVER_BASEURL", "")
    return urllib.parse.urljoin(base_url, path)


def get_url_path(view: str, **kwargs) -> str:
    with current_app.test_request_context():
        return headless_url(url_for(view, **kwargs))
