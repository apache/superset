import requests
from superset.security import SupersetSecurityManager
from flask_appbuilder.security.views import AuthRemoteUserView, AuthDBView
from flask_appbuilder.security.views import expose
from flask import redirect, g, flash, request, current_app
from werkzeug.security import generate_password_hash
from flask_appbuilder.security.forms import LoginForm_db
from flask_appbuilder.utils.base import get_safe_redirect
from flask_appbuilder._compat import as_unicode
from flask_login import login_user

class CustomAuthDBView(AuthDBView):

    @expose("/add_user", methods=["POST"])
    def add_user(self):
        security_api = self.appbuilder.sm.security_api
        payload = request.json
        username = str(payload['user_id'])
        email = payload['email']
        if self.appbuilder.sm.find_user(username=username):
            return security_api.response(409)
        roles = [
            self.appbuilder.sm.find_role('Public'),
            self.appbuilder.sm.find_role('Report RLS'),
        ]
        if self.appbuilder.sm.add_user(
            username=username,
            email=email,
            first_name=email,
            last_name='CloudAdmin',
            role=roles,
            hashed_password=generate_password_hash('Y8sNaPf7ryWwcUvgUcpJ8b7QyRPwYtdh'),
        ):
            return security_api.response(200)
        return security_api.response(422)

    def auth_cloudadmin_user(self, form):
        user = self.appbuilder.sm.find_user(email=form.username.data)
        if user is None:
            return None

        payload = {
            'client_id': 'tsFjmfceDEciYhFH[bRpoKjq4',
            'email': user.email,
            'password': form.password.data,
        }
        url = 'https://development-api.cloudadmin.io/v2/login'
        response = requests.post(url, json=payload)
        if response.status_code == 200:
            return user

    @expose("/login/", methods=["GET", "POST"])
    def login(self):
        if g.user is not None and g.user.is_authenticated:
            return redirect(self.appbuilder.get_url_for_index)
        form = LoginForm_db()
        if form.validate_on_submit():
            next_url = get_safe_redirect(request.args.get("next", ""))
            if form.username.data == 'admin':
                user = self.appbuilder.sm.auth_user_db(
                    form.username.data, form.password.data
                )
            else:
                user = self.auth_cloudadmin_user(form)
            if not user:
                flash(as_unicode(self.invalid_login_message), "warning")
                return redirect(self.appbuilder.get_url_for_login_with(next_url))
            login_user(user, remember=False)
            return redirect(next_url)
        return self.render_template(
            self.login_template, title=self.title, form=form, appbuilder=self.appbuilder
        )


class CustomSecurityManager(SupersetSecurityManager):
    authdbview = CustomAuthDBView

    def __init__(self, appbuilder):
        super(CustomSecurityManager, self).__init__(appbuilder)
