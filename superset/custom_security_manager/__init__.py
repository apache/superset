from flask import redirect, g, flash, request, session
from flask_appbuilder.security.views import AuthView
from superset.security import SupersetSecurityManager
from flask_appbuilder.security.views import expose
from flask_login import login_user
from flask_appbuilder.security.forms import LoginForm_db

class CustomAuthDBView(AuthView):
   fake_redis = {}
   login_template = "appbuilder/general/security/login_db.html"
   @expose("/login/", methods=["GET", "POST"])
   def login(self):
       if g.user is not None and g.user.is_authenticated:
           return redirect(self.appbuilder.get_url_for_index)
       form = LoginForm_db()
       if form.validate_on_submit():
           user = self.appbuilder.sm.auth_user_db(
               form.username.data, form.password.data
           )
           if not user:
               flash(as_unicode(self.invalid_login_message), "warning")
               return redirect(self.appbuilder.get_url_for_login)
           login_user(user, remember=False)
           self.fake_redis[int(session.get("user_id"))] = session.get("_id")
           return redirect(self.appbuilder.get_url_for_index)
       return self.render_template(
           self.login_template, title=self.title, form=form, appbuilder=self.appbuilder
       )

class CustomSecurityManager(SupersetSecurityManager):
   # Register the custom auth view
   authdbview = CustomAuthDBView
   # Override load user method
   def load_user(self,pk):
       # If its not the most recent login, user is logged out
       if self.authdbview.fake_redis.get(int(pk), None) != session.get("_id"):
           session.clear()
           return None
       return self.get_user_by_id(int(pk))
   def __init__(self,appbuilder):
       super(CustomSecurityManager, self).__init__(appbuilder)
