from flask_appbuilder.security.views import AuthDBView
from flask_appbuilder import expose
from flask_login import login_user
from flask import request, redirect, flash
from superset.security.manager import SupersetSecurityManager
import requests
import json
import os

class CustomAuthDBView(AuthDBView):
    def create_user(self, user_data):
        # create an user with the data session
        # and assign to him/her a default role
        user = self.appbuilder.sm.add_user(
            username = user_data["username"],
            first_name = user_data["first_name"],
            last_name = user_data["last_name"],
            email = user_data["email"],
            role = self.appbuilder.sm.find_role("Gamma"),
            password = "test"
        )

        return user
    
    def get_users(self):
        data = {}

        with open(os.path.join(os.path.dirname(__file__),"users.json"), "r") as users_json:
            data = json.load(users_json)

        return data
    
    def get_user_info(self, token):
        users = self.get_users()
        search = list(filter(lambda person: person["token"] == token, users))

        if search:
            user_info = search[0]["user_info"]
            print(user_info)
            return user_info
    
    def login_and_redirect(self, user, request):
        login_user(user, remember=True)

        if request.args.get('redirect') is not None:
            redirect_url = request.args.get('redirect')

        standalone = str(request.args.get('standalone'))

        if standalone is None:
            standalone = 'false'

        return redirect(redirect_url+'?standalone=' + standalone)

    @expose('/login/', methods=['GET', 'POST'])
    def login(self):
        token = request.values.get('token')

        if token is None:
            return "No token found"

        user_data = self.get_user_info(token)
        
        if user_data is None:
            return "Invalid Session"

        user = self.appbuilder.sm.find_user(
            username=user_data["username"]
        )

        try:
            return self.login_and_redirect(user, request)
        
        except Exception:
            flash('Creating new user...')
            user = self.create_user(user_data)
            return self.login_and_redirect(user, request)

class CustomSecurityManager(SupersetSecurityManager):
    authdbview = CustomAuthDBView
    def __init__(self, appbuilder):
        super(CustomSecurityManager, self).__init__(appbuilder)


'''
from flask import redirect, g, flash, request
from flask_appbuilder.security.views import UserDBModelView,AuthDBView
from superset.security import SupersetSecurityManager
from flask_appbuilder.security.views import expose
from flask_appbuilder.security.manager import BaseSecurityManager
from flask_login import login_user, logout_user


class CustomAuthDBView(AuthDBView):
    @expose('/login/', methods=['GET', 'POST'])
    def login(self):
        redirect_url = self.appbuilder.get_url_for_index
        if request.args.get('redirect') is not None:
            redirect_url = request.args.get('redirect') 

        if request.args.get('username') is not None:
            user = self.appbuilder.sm.find_user(username=request.args.get('username'))
            login_user(user, remember=True)
            return redirect(redirect_url)
        elif g.user is not None and g.user.is_authenticated():
            return redirect(redirect_url)
        else:
            flash('Unable to auto login', 'warning')
            return super(CustomAuthDBView,self).login()

class CustomSecurityManager(SupersetSecurityManager):
    authdbview = CustomAuthDBView
    def __init__(self, appbuilder):
        super(CustomSecurityManager, self).__init__(appbuilder)
'''