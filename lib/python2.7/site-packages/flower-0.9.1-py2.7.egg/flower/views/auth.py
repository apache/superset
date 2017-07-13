from __future__ import absolute_import

import json
import functools
import re

try:
    from urllib.parse import urlencode
except ImportError:
    from urllib import urlencode

import tornado.web
import tornado.auth

from tornado import httpclient
from tornado.options import options
from celery.utils.imports import instantiate

from ..views import BaseHandler


class GoogleAuth2LoginHandler(BaseHandler, tornado.auth.GoogleOAuth2Mixin):
    _OAUTH_SETTINGS_KEY = 'oauth'

    @tornado.web.asynchronous
    def get(self):
        redirect_uri = self.settings[self._OAUTH_SETTINGS_KEY]['redirect_uri']
        if self.get_argument('code', False):
            self.get_authenticated_user(
                redirect_uri=redirect_uri,
                code=self.get_argument('code'),
                callback=self._on_auth,
            )
        else:
            self.authorize_redirect(
                redirect_uri=redirect_uri,
                client_id=self.settings[self._OAUTH_SETTINGS_KEY]['key'],
                scope=['profile', 'email'],
                response_type='code',
                extra_params={'approval_prompt': 'auto'}
            )

    def _on_auth(self, user):
        if not user:
            raise tornado.web.HTTPError(403, 'Google auth failed')
        access_token = user['access_token']

        try:
            response = httpclient.HTTPClient().fetch(
                'https://www.googleapis.com/plus/v1/people/me',
                headers={'Authorization': 'Bearer %s' % access_token})
        except Exception as e:
            raise tornado.web.HTTPError(403, 'Google auth failed: %s' % e)

        email = json.loads(response.body.decode('utf-8'))['emails'][0]['value']
        if not re.match(self.application.options.auth, email):
            message = (
                "Access denied to '{email}'. Please use another account or "
                "ask your admin to add your email to flower --auth."
            ).format(email=email)
            raise tornado.web.HTTPError(403, message)

        self.set_secure_cookie("user", str(email))

        next = self.get_argument('next', '/')
        self.redirect(next)


class LoginHandler(BaseHandler):
    def __new__(cls, *args, **kwargs):
        return instantiate(options.auth_provider, *args, **kwargs)


class GithubLoginHandler(BaseHandler, tornado.auth.OAuth2Mixin):

    _OAUTH_AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
    _OAUTH_ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token"
    _OAUTH_NO_CALLBACKS = False
    _OAUTH_SETTINGS_KEY = 'oauth'

    @tornado.auth._auth_return_future
    def get_authenticated_user(self, redirect_uri, code, callback):
        http = self.get_auth_http_client()
        body = urlencode({
            "redirect_uri": redirect_uri,
            "code": code,
            "client_id": self.settings[self._OAUTH_SETTINGS_KEY]['key'],
            "client_secret": self.settings[self._OAUTH_SETTINGS_KEY]['secret'],
            "grant_type": "authorization_code",
        })

        http.fetch(
            self._OAUTH_ACCESS_TOKEN_URL,
            functools.partial(self._on_access_token, callback),
            method="POST",
            headers={'Content-Type': 'application/x-www-form-urlencoded',
                     'Accept': 'application/json'}, body=body)

    @tornado.web.asynchronous
    def _on_access_token(self, future, response):
        if response.error:
            future.set_exception(tornado.auth.AuthError(
                'OAuth authentication error: %s' % str(response)))
            return

        future.set_result(json.loads(response.body))

    def get_auth_http_client(self):
        return httpclient.AsyncHTTPClient()

    @tornado.web.asynchronous
    def get(self):
        redirect_uri = self.settings[self._OAUTH_SETTINGS_KEY]['redirect_uri']
        if self.get_argument('code', False):
            self.get_authenticated_user(
                redirect_uri=redirect_uri,
                code=self.get_argument('code'),
                callback=self._on_auth,
            )
        else:
            self.authorize_redirect(
                redirect_uri=redirect_uri,
                client_id=self.settings[self._OAUTH_SETTINGS_KEY]['key'],
                scope=['user:email'],
                response_type='code',
                extra_params={'approval_prompt': 'auto'}
            )

    @tornado.web.asynchronous
    def _on_auth(self, user):
        if not user:
            raise tornado.web.HTTPError(500, 'OAuth authentication failed')
        access_token = user['access_token']

        req = httpclient.HTTPRequest(
            'https://api.github.com/user/emails',
            headers={'Authorization': 'token ' + access_token,
                     'User-agent': 'Tornado auth'})
        response = httpclient.HTTPClient().fetch(req)

        emails = [email['email'].lower() for email in json.loads(response.body.decode('utf-8'))
                  if email['verified'] and re.match(self.application.options.auth, email['email'])]

        if not emails:
            message = (
                "Access denied. Please use another account or "
                "ask your admin to add your email to flower --auth."
            )
            raise tornado.web.HTTPError(403, message)

        self.set_secure_cookie("user", str(emails.pop()))

        next_ = self.get_argument('next', '/')
        self.redirect(next_)


class LogoutHandler(BaseHandler):
    def get(self):
        self.clear_cookie('user')
        self.render('404.html', message='Successfully logged out!')
