"""Unit tests for Superset"""
from __future__ import unicode_literals

from wsgiref.util import shift_path_info

from .base_tests import SupersetTestCase, app


class TestProxyMiddleWare(object):
    """ Simple prefix Middleware to test urls when running
        superset under a prefix
    """
    def __init__(self, app):
        self.app = app

    def __call__(self, environ, start_response):
        script_name = shift_path_info(environ)

        if script_name != 'test':
            start_response('404 Not Found',
                           [('Content-Type', 'text/plain')])
            return ["This url does not belong to the app.".encode()]

        return self.app(environ, start_response)


class UrlTestCase(SupersetTestCase):
    """TestCase for making sure that the most bookmarked urls are working.

       This class can be derived with a new url_prefix to test that the same
       urls also work when using a prefix.
    """
    requires_examples = True
    url_prefix = ''

    @classmethod
    def setUpClass(cls):
        if cls.url_prefix:
            app.wsgi_app = TestProxyMiddleWare(app.wsgi_app)

    @classmethod
    def tearDownClass(cls):
        if cls.url_prefix:
            app.wsgi_app = app.wsgi_app.app

    def prefix_get(self, url):
        return self.client.get(self.url_prefix + url)

    def prefix_post(self, url, data):
        return self.client.post(self.url_prefix + url, data=data)

    @property
    def http_prefix(self):
        return 'http://localhost' + self.url_prefix

    def login(self, username='admin', password='general'):
        resp = self.prefix_post(
            '/login/',
            data=dict(username=username, password=password)
        )
        assert resp.status_code == 302
        assert resp.location == self.http_prefix + '/'

    def logout(self):
        self.prefix_get('/logout')

    def test_welcome_url(self):
        self.login()
        resp = self.prefix_get('/superset/welcome')
        assert resp.status_code == 200

    def test_sqllab_url(self):
        self.login()
        resp = self.prefix_get('/superset/sqllab')
        assert resp.status_code == 200

    def test_user_profile_url(self):
        self.login()
        resp = self.prefix_get('/superset/profile/admin/')
        assert resp.status_code == 200

    def test_shortener_url(self):
        self.login()
        url_to_shorten = (
            "/superset/explore/table/1/?viz_type=sankey&groupby=source&"
            "groupby=target&metric=sum__value&row_limit=5000&where=&having=&"
            "flt_col_0=source&flt_op_0=in&flt_eq_0=&slice_id=78&slice_name="
            "Energy+Sankey&collapsed_fieldsets=&action=&datasource_name="
            "energy_usage&datasource_id=1&datasource_type=table&"
            "previous_viz_type=sankey"
        )
        # Test that it generates a shortened url.
        data = {"data": "/" + self.url_prefix + url_to_shorten}
        resp = self.prefix_post('/r/shortner/', data=data)
        url = resp.data.decode('utf-8')
        assert url.startswith(self.url_prefix + '/r/')

        # Make sure it redirects to the correct url.
        # Also make sure to use the client directly as the url we get back
        # should already be prefixed.
        resp = self.client.get(url)
        assert resp.status_code == 302
        assert resp.location == self.http_prefix + url_to_shorten


class PrefixUrlTests(UrlTestCase):
    url_prefix = '/test'
