from flask import redirect, g, flash, request, session
from flask_appbuilder.security.views import AuthView
from superset.security import SupersetSecurityManager
from flask_appbuilder.security.views import expose
from flask_login import login_user
from flask_appbuilder.security.forms import LoginForm_db
import redis

global_kv_store = redis.StrictRedis(host="superset_global_kv", port=6379, password="")

class CustomAuthDBView(AuthView):
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
           global_kv_store.set(str(session.get("user_id")),str(session.get("_id")))
           print(f'{session.get("_id")} stored {type(global_kv_store.get(str(1)))}')
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
       if global_kv_store.get(str(pk)).decode('utf-8') != session.get("_id"):
           print(f"{pk} got kicked hahhaha!", flush=True)
           session.clear()
           return None
       return self.get_user_by_id(int(pk))
   def __init__(self,appbuilder):
       super(CustomSecurityManager, self).__init__(appbuilder)
