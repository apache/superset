# from flask import redirect, g, flash, request
# from flask_appbuilder.security.views import UserDBModelView,AuthDBView
# from superset.security import SupersetSecurityManager
# from flask_appbuilder.security.views import expose
# from flask_appbuilder.security.manager import BaseSecurityManager
# from flask_login import login_user, logout_user
#
#
# import jwt
# import json
# class CustomAuthDBView(AuthDBView):
#     login_template = 'appbuilder/general/security/login_db.html'
#
#     @expose('/login/', methods=['GET', 'POST'])
#     def login(self):
#         token = request.args.get('token')
#         if not token:
#             token = request.cookies.get('access_token')
#         if token is not None:
#             jwt_payload = jwt.decode(token,'secret',algorithms=['RS256'])
#             user_name = jwt_payload.get("user_name")
#             user = self.appbuilder.sm.find_user(username=user_name)
#             if not user:
#                role_admin = self.appbuilder.sm.find_role('Admin')
#                user = self.appbuilder.sm.add_user(user_name, user_name, 'aimind', user_name + "@aimind.com", role_admin, password = "aimind" + user_name)
#             if user:
#                 login_user(user, remember=False)
#                 redirect_url = request.args.get('redirect')
#                 if not redirect_url:
#                     redirect_url = self.appbuilder.get_url_for_index
#                 return redirect(redirect_url)
#             else:
#                 return super(CustomAuthDBView,self).login()
#         else:
#             flash('Unable to auto login', 'warning')
#             return super(CustomAuthDBView,self).login()
#
# class CustomSecurityManager(SupersetSecurityManager):
#     authdbview = CustomAuthDBView
#     def __init__(self, appbuilder):
#         super(CustomSecurityManager, self).__init__(appbuilder)
