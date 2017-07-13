# These tests do not currently do much to verify the correct implementation
# of the openid/oauth protocols, they just exercise the major code paths
# and ensure that it doesn't blow up (e.g. with unicode/bytes issues in
# python 3)


from __future__ import absolute_import, division, print_function, with_statement
from tornado.auth import OpenIdMixin, OAuthMixin, OAuth2Mixin, TwitterMixin, AuthError
from tornado.concurrent import Future
from tornado.escape import json_decode
from tornado import gen
from tornado.log import gen_log
from tornado.testing import AsyncHTTPTestCase, ExpectLog
from tornado.util import u
from tornado.web import RequestHandler, Application, asynchronous, HTTPError


class OpenIdClientLoginHandler(RequestHandler, OpenIdMixin):
    def initialize(self, test):
        self._OPENID_ENDPOINT = test.get_url('/openid/server/authenticate')

    @asynchronous
    def get(self):
        if self.get_argument('openid.mode', None):
            self.get_authenticated_user(
                self.on_user, http_client=self.settings['http_client'])
            return
        res = self.authenticate_redirect()
        assert isinstance(res, Future)
        assert res.done()

    def on_user(self, user):
        if user is None:
            raise Exception("user is None")
        self.finish(user)


class OpenIdServerAuthenticateHandler(RequestHandler):
    def post(self):
        if self.get_argument('openid.mode') != 'check_authentication':
            raise Exception("incorrect openid.mode %r")
        self.write('is_valid:true')


class OAuth1ClientLoginHandler(RequestHandler, OAuthMixin):
    def initialize(self, test, version):
        self._OAUTH_VERSION = version
        self._OAUTH_REQUEST_TOKEN_URL = test.get_url('/oauth1/server/request_token')
        self._OAUTH_AUTHORIZE_URL = test.get_url('/oauth1/server/authorize')
        self._OAUTH_ACCESS_TOKEN_URL = test.get_url('/oauth1/server/access_token')

    def _oauth_consumer_token(self):
        return dict(key='asdf', secret='qwer')

    @asynchronous
    def get(self):
        if self.get_argument('oauth_token', None):
            self.get_authenticated_user(
                self.on_user, http_client=self.settings['http_client'])
            return
        res = self.authorize_redirect(http_client=self.settings['http_client'])
        assert isinstance(res, Future)

    def on_user(self, user):
        if user is None:
            raise Exception("user is None")
        self.finish(user)

    def _oauth_get_user(self, access_token, callback):
        if self.get_argument('fail_in_get_user', None):
            raise Exception("failing in get_user")
        if access_token != dict(key='uiop', secret='5678'):
            raise Exception("incorrect access token %r" % access_token)
        callback(dict(email='foo@example.com'))


class OAuth1ClientLoginCoroutineHandler(OAuth1ClientLoginHandler):
    """Replaces OAuth1ClientLoginCoroutineHandler's get() with a coroutine."""
    @gen.coroutine
    def get(self):
        if self.get_argument('oauth_token', None):
            # Ensure that any exceptions are set on the returned Future,
            # not simply thrown into the surrounding StackContext.
            try:
                yield self.get_authenticated_user()
            except Exception as e:
                self.set_status(503)
                self.write("got exception: %s" % e)
        else:
            yield self.authorize_redirect()


class OAuth1ClientRequestParametersHandler(RequestHandler, OAuthMixin):
    def initialize(self, version):
        self._OAUTH_VERSION = version

    def _oauth_consumer_token(self):
        return dict(key='asdf', secret='qwer')

    def get(self):
        params = self._oauth_request_parameters(
            'http://www.example.com/api/asdf',
            dict(key='uiop', secret='5678'),
            parameters=dict(foo='bar'))
        self.write(params)


class OAuth1ServerRequestTokenHandler(RequestHandler):
    def get(self):
        self.write('oauth_token=zxcv&oauth_token_secret=1234')


class OAuth1ServerAccessTokenHandler(RequestHandler):
    def get(self):
        self.write('oauth_token=uiop&oauth_token_secret=5678')


class OAuth2ClientLoginHandler(RequestHandler, OAuth2Mixin):
    def initialize(self, test):
        self._OAUTH_AUTHORIZE_URL = test.get_url('/oauth2/server/authorize')

    def get(self):
        res = self.authorize_redirect()
        assert isinstance(res, Future)
        assert res.done()


class TwitterClientHandler(RequestHandler, TwitterMixin):
    def initialize(self, test):
        self._OAUTH_REQUEST_TOKEN_URL = test.get_url('/oauth1/server/request_token')
        self._OAUTH_ACCESS_TOKEN_URL = test.get_url('/twitter/server/access_token')
        self._OAUTH_AUTHORIZE_URL = test.get_url('/oauth1/server/authorize')
        self._TWITTER_BASE_URL = test.get_url('/twitter/api')

    def get_auth_http_client(self):
        return self.settings['http_client']


class TwitterClientLoginHandler(TwitterClientHandler):
    @asynchronous
    def get(self):
        if self.get_argument("oauth_token", None):
            self.get_authenticated_user(self.on_user)
            return
        self.authorize_redirect()

    def on_user(self, user):
        if user is None:
            raise Exception("user is None")
        self.finish(user)


class TwitterClientLoginGenEngineHandler(TwitterClientHandler):
    @asynchronous
    @gen.engine
    def get(self):
        if self.get_argument("oauth_token", None):
            user = yield self.get_authenticated_user()
            self.finish(user)
        else:
            # Old style: with @gen.engine we can ignore the Future from
            # authorize_redirect.
            self.authorize_redirect()


class TwitterClientLoginGenCoroutineHandler(TwitterClientHandler):
    @gen.coroutine
    def get(self):
        if self.get_argument("oauth_token", None):
            user = yield self.get_authenticated_user()
            self.finish(user)
        else:
            # New style: with @gen.coroutine the result must be yielded
            # or else the request will be auto-finished too soon.
            yield self.authorize_redirect()


class TwitterClientShowUserHandler(TwitterClientHandler):
    @asynchronous
    @gen.engine
    def get(self):
        # TODO: would be nice to go through the login flow instead of
        # cheating with a hard-coded access token.
        response = yield gen.Task(self.twitter_request,
                                  '/users/show/%s' % self.get_argument('name'),
                                  access_token=dict(key='hjkl', secret='vbnm'))
        if response is None:
            self.set_status(500)
            self.finish('error from twitter request')
        else:
            self.finish(response)


class TwitterClientShowUserFutureHandler(TwitterClientHandler):
    @asynchronous
    @gen.engine
    def get(self):
        try:
            response = yield self.twitter_request(
                '/users/show/%s' % self.get_argument('name'),
                access_token=dict(key='hjkl', secret='vbnm'))
        except AuthError as e:
            self.set_status(500)
            self.finish(str(e))
            return
        assert response is not None
        self.finish(response)


class TwitterServerAccessTokenHandler(RequestHandler):
    def get(self):
        self.write('oauth_token=hjkl&oauth_token_secret=vbnm&screen_name=foo')


class TwitterServerShowUserHandler(RequestHandler):
    def get(self, screen_name):
        if screen_name == 'error':
            raise HTTPError(500)
        assert 'oauth_nonce' in self.request.arguments
        assert 'oauth_timestamp' in self.request.arguments
        assert 'oauth_signature' in self.request.arguments
        assert self.get_argument('oauth_consumer_key') == 'test_twitter_consumer_key'
        assert self.get_argument('oauth_signature_method') == 'HMAC-SHA1'
        assert self.get_argument('oauth_version') == '1.0'
        assert self.get_argument('oauth_token') == 'hjkl'
        self.write(dict(screen_name=screen_name, name=screen_name.capitalize()))


class TwitterServerVerifyCredentialsHandler(RequestHandler):
    def get(self):
        assert 'oauth_nonce' in self.request.arguments
        assert 'oauth_timestamp' in self.request.arguments
        assert 'oauth_signature' in self.request.arguments
        assert self.get_argument('oauth_consumer_key') == 'test_twitter_consumer_key'
        assert self.get_argument('oauth_signature_method') == 'HMAC-SHA1'
        assert self.get_argument('oauth_version') == '1.0'
        assert self.get_argument('oauth_token') == 'hjkl'
        self.write(dict(screen_name='foo', name='Foo'))


class AuthTest(AsyncHTTPTestCase):
    def get_app(self):
        return Application(
            [
                # test endpoints
                ('/openid/client/login', OpenIdClientLoginHandler, dict(test=self)),
                ('/oauth10/client/login', OAuth1ClientLoginHandler,
                 dict(test=self, version='1.0')),
                ('/oauth10/client/request_params',
                 OAuth1ClientRequestParametersHandler,
                 dict(version='1.0')),
                ('/oauth10a/client/login', OAuth1ClientLoginHandler,
                 dict(test=self, version='1.0a')),
                ('/oauth10a/client/login_coroutine',
                 OAuth1ClientLoginCoroutineHandler,
                 dict(test=self, version='1.0a')),
                ('/oauth10a/client/request_params',
                 OAuth1ClientRequestParametersHandler,
                 dict(version='1.0a')),
                ('/oauth2/client/login', OAuth2ClientLoginHandler, dict(test=self)),

                ('/twitter/client/login', TwitterClientLoginHandler, dict(test=self)),
                ('/twitter/client/login_gen_engine', TwitterClientLoginGenEngineHandler, dict(test=self)),
                ('/twitter/client/login_gen_coroutine', TwitterClientLoginGenCoroutineHandler, dict(test=self)),
                ('/twitter/client/show_user', TwitterClientShowUserHandler, dict(test=self)),
                ('/twitter/client/show_user_future', TwitterClientShowUserFutureHandler, dict(test=self)),

                # simulated servers
                ('/openid/server/authenticate', OpenIdServerAuthenticateHandler),
                ('/oauth1/server/request_token', OAuth1ServerRequestTokenHandler),
                ('/oauth1/server/access_token', OAuth1ServerAccessTokenHandler),

                ('/twitter/server/access_token', TwitterServerAccessTokenHandler),
                (r'/twitter/api/users/show/(.*)\.json', TwitterServerShowUserHandler),
                (r'/twitter/api/account/verify_credentials\.json', TwitterServerVerifyCredentialsHandler),
            ],
            http_client=self.http_client,
            twitter_consumer_key='test_twitter_consumer_key',
            twitter_consumer_secret='test_twitter_consumer_secret')

    def test_openid_redirect(self):
        response = self.fetch('/openid/client/login', follow_redirects=False)
        self.assertEqual(response.code, 302)
        self.assertTrue(
            '/openid/server/authenticate?' in response.headers['Location'])

    def test_openid_get_user(self):
        response = self.fetch('/openid/client/login?openid.mode=blah&openid.ns.ax=http://openid.net/srv/ax/1.0&openid.ax.type.email=http://axschema.org/contact/email&openid.ax.value.email=foo@example.com')
        response.rethrow()
        parsed = json_decode(response.body)
        self.assertEqual(parsed["email"], "foo@example.com")

    def test_oauth10_redirect(self):
        response = self.fetch('/oauth10/client/login', follow_redirects=False)
        self.assertEqual(response.code, 302)
        self.assertTrue(response.headers['Location'].endswith(
            '/oauth1/server/authorize?oauth_token=zxcv'))
        # the cookie is base64('zxcv')|base64('1234')
        self.assertTrue(
            '_oauth_request_token="enhjdg==|MTIzNA=="' in response.headers['Set-Cookie'],
            response.headers['Set-Cookie'])

    def test_oauth10_get_user(self):
        response = self.fetch(
            '/oauth10/client/login?oauth_token=zxcv',
            headers={'Cookie': '_oauth_request_token=enhjdg==|MTIzNA=='})
        response.rethrow()
        parsed = json_decode(response.body)
        self.assertEqual(parsed['email'], 'foo@example.com')
        self.assertEqual(parsed['access_token'], dict(key='uiop', secret='5678'))

    def test_oauth10_request_parameters(self):
        response = self.fetch('/oauth10/client/request_params')
        response.rethrow()
        parsed = json_decode(response.body)
        self.assertEqual(parsed['oauth_consumer_key'], 'asdf')
        self.assertEqual(parsed['oauth_token'], 'uiop')
        self.assertTrue('oauth_nonce' in parsed)
        self.assertTrue('oauth_signature' in parsed)

    def test_oauth10a_redirect(self):
        response = self.fetch('/oauth10a/client/login', follow_redirects=False)
        self.assertEqual(response.code, 302)
        self.assertTrue(response.headers['Location'].endswith(
            '/oauth1/server/authorize?oauth_token=zxcv'))
        # the cookie is base64('zxcv')|base64('1234')
        self.assertTrue(
            '_oauth_request_token="enhjdg==|MTIzNA=="' in response.headers['Set-Cookie'],
            response.headers['Set-Cookie'])

    def test_oauth10a_get_user(self):
        response = self.fetch(
            '/oauth10a/client/login?oauth_token=zxcv',
            headers={'Cookie': '_oauth_request_token=enhjdg==|MTIzNA=='})
        response.rethrow()
        parsed = json_decode(response.body)
        self.assertEqual(parsed['email'], 'foo@example.com')
        self.assertEqual(parsed['access_token'], dict(key='uiop', secret='5678'))

    def test_oauth10a_request_parameters(self):
        response = self.fetch('/oauth10a/client/request_params')
        response.rethrow()
        parsed = json_decode(response.body)
        self.assertEqual(parsed['oauth_consumer_key'], 'asdf')
        self.assertEqual(parsed['oauth_token'], 'uiop')
        self.assertTrue('oauth_nonce' in parsed)
        self.assertTrue('oauth_signature' in parsed)

    def test_oauth10a_get_user_coroutine_exception(self):
        response = self.fetch(
            '/oauth10a/client/login_coroutine?oauth_token=zxcv&fail_in_get_user=true',
            headers={'Cookie': '_oauth_request_token=enhjdg==|MTIzNA=='})
        self.assertEqual(response.code, 503)

    def test_oauth2_redirect(self):
        response = self.fetch('/oauth2/client/login', follow_redirects=False)
        self.assertEqual(response.code, 302)
        self.assertTrue('/oauth2/server/authorize?' in response.headers['Location'])

    def base_twitter_redirect(self, url):
        # Same as test_oauth10a_redirect
        response = self.fetch(url, follow_redirects=False)
        self.assertEqual(response.code, 302)
        self.assertTrue(response.headers['Location'].endswith(
            '/oauth1/server/authorize?oauth_token=zxcv'))
        # the cookie is base64('zxcv')|base64('1234')
        self.assertTrue(
            '_oauth_request_token="enhjdg==|MTIzNA=="' in response.headers['Set-Cookie'],
            response.headers['Set-Cookie'])

    def test_twitter_redirect(self):
        self.base_twitter_redirect('/twitter/client/login')

    def test_twitter_redirect_gen_engine(self):
        self.base_twitter_redirect('/twitter/client/login_gen_engine')

    def test_twitter_redirect_gen_coroutine(self):
        self.base_twitter_redirect('/twitter/client/login_gen_coroutine')

    def test_twitter_get_user(self):
        response = self.fetch(
            '/twitter/client/login?oauth_token=zxcv',
            headers={'Cookie': '_oauth_request_token=enhjdg==|MTIzNA=='})
        response.rethrow()
        parsed = json_decode(response.body)
        self.assertEqual(parsed,
                         {u('access_token'): {u('key'): u('hjkl'),
                                              u('screen_name'): u('foo'),
                                              u('secret'): u('vbnm')},
                          u('name'): u('Foo'),
                          u('screen_name'): u('foo'),
                          u('username'): u('foo')})

    def test_twitter_show_user(self):
        response = self.fetch('/twitter/client/show_user?name=somebody')
        response.rethrow()
        self.assertEqual(json_decode(response.body),
                         {'name': 'Somebody', 'screen_name': 'somebody'})

    def test_twitter_show_user_error(self):
        with ExpectLog(gen_log, 'Error response HTTP 500'):
            response = self.fetch('/twitter/client/show_user?name=error')
        self.assertEqual(response.code, 500)
        self.assertEqual(response.body, b'error from twitter request')

    def test_twitter_show_user_future(self):
        response = self.fetch('/twitter/client/show_user_future?name=somebody')
        response.rethrow()
        self.assertEqual(json_decode(response.body),
                         {'name': 'Somebody', 'screen_name': 'somebody'})

    def test_twitter_show_user_future_error(self):
        response = self.fetch('/twitter/client/show_user_future?name=error')
        self.assertEqual(response.code, 500)
        self.assertIn(b'Error response HTTP 500', response.body)
