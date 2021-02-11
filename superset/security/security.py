from flask_appbuilder.security.views import AuthDBView
from flask_appbuilder import expose
from flask_login import login_user
from flask import request, redirect, session
import superset
from superset import app
from superset.security.manager import SupersetSecurityManager
import requests
import logging

#con la api mockeada esto se testea haciendo
#http://localhost:9000/login/?token=a
logger = logging.getLogger(__name__)

# def process_token_api(token_api_url, token):
#     try:
#         response = requests.get(token_api_url+"?token="+token)
#     except Exception:
#         return None
#     if response.status_code not in [400, 401, 404, 500]:
#         return response.json()

token_data = {'a': 'desktop@swipejobs.com'}

class CustomAuthDBView(AuthDBView):
    login_template = 'appbuilder/general/security/login_db.html'
    @expose('/login/', methods=['GET', 'POST'])
    def login(self):
        # if superset.app.config.get('LOGIN_WITH_TOKEN') is False:
        #     return super(CustomAuthDBView, self).login()
        token = request.values.get('token')
        # #return str(token)
        # if token is None:
        #     return super(CustomAuthDBView, self).login()
        #
        # #session['token']=token
        #
        # token_api_url = superset.app.config.get('TOKEN_API_URL')
        # user_data = process_token_api(token_api_url,token)
        # if token is None:
        #     return "no token"
        # if user_data is None:
        #     return "Invalid Session"

        user = self.appbuilder.sm.find_user(token_data[token])

        # user = self.appbuilder.sm.find_user(
        #     username=user_data["username"]
        # )
        #
        # if not user:
        #     # create an user with the data session
        #     # and assign to him/her a default role
        #     user = self.appbuilder.sm.add_user(
        #         username=user_data["username"],
        #         first_name=user_data["first_name"],
        #         last_name=user_data["last_name"],
        #         email=user_data["email"],
        #         role=self.appbuilder.sm.find_role("Alpha"),
        #         password="test"
        #     )

        if not user:
            return super(CustomAuthDBView, self).login()

        # now, login the user
        login_user(user, remember=False)
        redirect_url = superset.app.config.get(
            'DEFAULT_WELCOME_DASHBOARD'
        )
        # with standalone = True we remove the title and the
        # menu of Superset in our embedding.
        standalone = str(request.args.get('standalone'))

        # if "company" in user_data.keys():
        #     session["company"] = user_data["company"]

        # finally, it redirects the user to the welcome page.
        return redirect(
            redirect_url
            + '?standalone='
            + standalone
        )


class CustomSecurityManager(SupersetSecurityManager):
    authdbview = CustomAuthDBView

    def __init__(self, appbuilder):
        super(CustomSecurityManager, self).__init__(appbuilder)
