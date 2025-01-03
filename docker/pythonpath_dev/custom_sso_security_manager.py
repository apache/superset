#!/usr/bin/env python
# custom_sso_security_manager.py
 
import logging
import json
from superset.security import SupersetSecurityManager
 
class CustomSsoSecurityManager(SupersetSecurityManager):
 
  def oauth_user_info(self, provider, response=None):
 
    if provider == 'keycloak':
      me = self.appbuilder.sm.oauth_remotes[provider].get('openid-connect/userinfo')
      data = json.loads(me._content)
      user =  {
        'username' : data['preferred_username'],
        'name' : data['name'],
        'email' : data['email'],
        'first_name': data['given_name'],
        'last_name': data['family_name'],
        'roles': data['roles'],
        'is_active': True,
      }
 
      return user
 
  def auth_user_oauth(self, userinfo):
    user = super(CustomSsoSecurityManager, self).auth_user_oauth(userinfo)
    # cleanup the existing roles. We'll add the role later, based on roles from userinfo
    # use the latest roles from oauth
    user.roles.clear()
    accepted_roles = ['Public', 'Admin', 'Alpha', 'Gamma', 'sql_lab']
 
    for role in userinfo["roles"]:
      if role in accepted_roles:
        user.roles.append(self.find_role(role))
 
    # update the user roles
    self.update_user(user)
    # need to sync the roles, it's kind of running superset init
    # create a missing roles and fixing it
    self.sync_role_definitions()
    return user