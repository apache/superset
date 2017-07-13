import datetime
import logging
from flask import url_for, g, session
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import LoginManager, current_user
from flask_openid import OpenID
from flask_babel import lazy_gettext as _
from .views import AuthDBView, AuthOIDView, ResetMyPasswordView, AuthLDAPView, AuthOAuthView, AuthRemoteUserView, \
    ResetPasswordView, UserDBModelView, UserLDAPModelView, UserOIDModelView, UserOAuthModelView, UserRemoteUserModelView, \
    RoleModelView, PermissionViewModelView, ViewMenuModelView, PermissionModelView, UserStatsChartView, RegisterUserModelView, \
    UserInfoEditView
from .registerviews import RegisterUserDBView, RegisterUserOIDView, RegisterUserOAuthView
from ..basemanager import BaseManager
from ..const import AUTH_OID, AUTH_DB, AUTH_LDAP, \
                    AUTH_REMOTE_USER, AUTH_OAUTH, \
                    LOGMSG_ERR_SEC_AUTH_LDAP, \
                    LOGMSG_ERR_SEC_AUTH_LDAP_TLS, \
                    LOGMSG_WAR_SEC_NO_USER, \
                    LOGMSG_WAR_SEC_NOLDAP_OBJ, \
                    LOGMSG_WAR_SEC_LOGIN_FAILED

log = logging.getLogger(__name__)


class AbstractSecurityManager(BaseManager):
    """
        Abstract SecurityManager class, declares all methods used by the
        framework. There is no assumptions about security models or auth types.
    """

    def add_permissions_view(self, base_permissions, view_menu):
        """
            Adds a permission on a view menu to the backend

            :param base_permissions:
                list of permissions from view (all exposed methods): 'can_add','can_edit' etc...
            :param view_menu:
                name of the view or menu to add
        """
        raise NotImplementedError

    def add_permissions_menu(self, view_menu_name):
        """
            Adds menu_access to menu on permission_view_menu

            :param view_menu_name:
                The menu name
        """
        raise NotImplementedError

    def register_views(self):
        """
            Generic function to create the security views
        """
        raise NotImplementedError

    def is_item_public(self, permission_name, view_name):
        """
            Check if view has public permissions

            :param permission_name:
                the permission: can_show, can_edit...
            :param view_name:
                the name of the class view (child of BaseView)
        """
        raise NotImplementedError

    def has_access(self, permission_name, view_name):
        """
            Check if current user or public has access to view or menu
        """
        raise NotImplementedError

    def security_cleanup(self, baseviews, menus):
        raise NotImplementedError


def _oauth_tokengetter(token=None):
    """
        Default function to return the current user oauth token
        from session cookie.
    """
    token = session.get('oauth')
    log.debug("Token Get: {0}".format(token))
    return token


class BaseSecurityManager(AbstractSecurityManager):
    auth_view = None
    """ The obj instance for authentication view """
    user_view = None
    """ The obj instance for user view """
    registeruser_view = None
    """ The obj instance for registering user view """
    lm = None
    """ Flask-Login LoginManager """
    oid = None
    """ Flask-OpenID OpenID """
    oauth = None
    """ Flask-OAuth """
    oauth_remotes = None
    """ OAuth email whitelists """
    oauth_whitelists = {}
    """ Initialized (remote_app) providers dict {'provider_name', OBJ } """
    oauth_tokengetter = _oauth_tokengetter
    """ OAuth tokengetter function override to implement your own tokengetter method """
    oauth_user_info = None

    user_model = None
    """ Override to set your own User Model """
    role_model = None
    """ Override to set your own Role Model """
    permission_model = None
    """ Override to set your own Permission Model """
    viewmenu_model = None
    """ Override to set your own ViewMenu Model """
    permissionview_model = None
    """ Override to set your own PermissionView Model """
    registeruser_model = None
    """ Override to set your own RegisterUser Model """

    userdbmodelview = UserDBModelView
    """ Override if you want your own user db view """
    userldapmodelview = UserLDAPModelView
    """ Override if you want your own user ldap view """
    useroidmodelview = UserOIDModelView
    """ Override if you want your own user OID view """
    useroauthmodelview = UserOAuthModelView
    """ Override if you want your own user OAuth view """
    userremoteusermodelview = UserRemoteUserModelView
    """ Override if you want your own user REMOTE_USER view """
    registerusermodelview = RegisterUserModelView

    authdbview = AuthDBView
    """ Override if you want your own Authentication DB view """
    authldapview = AuthLDAPView
    """ Override if you want your own Authentication LDAP view """
    authoidview = AuthOIDView
    """ Override if you want your own Authentication OID view """
    authoauthview = AuthOAuthView
    """ Override if you want your own Authentication OAuth view """
    authremoteuserview = AuthRemoteUserView
    """ Override if you want your own Authentication OAuth view """

    registeruserdbview = RegisterUserDBView
    """ Override if you want your own register user db view """
    registeruseroidview = RegisterUserOIDView
    """ Override if you want your own register user OpenID view """
    registeruseroauthview = RegisterUserOAuthView
    """ Override if you want your own register user OAuth view """

    resetmypasswordview = ResetMyPasswordView
    """ Override if you want your own reset my password view """
    resetpasswordview = ResetPasswordView
    """ Override if you want your own reset password view """
    userinfoeditview = UserInfoEditView
    """ Override if you want your own User information edit view """

    rolemodelview = RoleModelView
    permissionmodelview = PermissionModelView
    userstatschartview = UserStatsChartView
    viewmenumodelview = ViewMenuModelView
    permissionviewmodelview = PermissionViewModelView

    def __init__(self, appbuilder):
        super(BaseSecurityManager, self).__init__(appbuilder)
        app = self.appbuilder.get_app
        # Base Security Config
        app.config.setdefault('AUTH_ROLE_ADMIN', 'Admin')
        app.config.setdefault('AUTH_ROLE_PUBLIC', 'Public')
        app.config.setdefault('AUTH_TYPE', AUTH_DB)
        # Self Registration
        app.config.setdefault('AUTH_USER_REGISTRATION', False)
        app.config.setdefault('AUTH_USER_REGISTRATION_ROLE', self.auth_role_public)

        # LDAP Config
        if self.auth_type == AUTH_LDAP:
            if 'AUTH_LDAP_SERVER' not in app.config:
                raise Exception("No AUTH_LDAP_SERVER defined on config with AUTH_LDAP authentication type.")
            app.config.setdefault('AUTH_LDAP_USE_TLS', False)
            app.config.setdefault('AUTH_LDAP_SEARCH', '')
            app.config.setdefault('AUTH_LDAP_BIND_USER', '')
            app.config.setdefault('AUTH_LDAP_APPEND_DOMAIN', '')
            app.config.setdefault('AUTH_LDAP_USERNAME_FORMAT', '')
            app.config.setdefault('AUTH_LDAP_BIND_PASSWORD', '')
            app.config.setdefault('AUTH_LDAP_ALLOW_SELF_SIGNED', False)
            app.config.setdefault('AUTH_LDAP_UID_FIELD', 'uid')
            app.config.setdefault('AUTH_LDAP_FIRSTNAME_FIELD', 'givenName')
            app.config.setdefault('AUTH_LDAP_LASTNAME_FIELD', 'sn')
            app.config.setdefault('AUTH_LDAP_EMAIL_FIELD', 'mail')

        if self.auth_type == AUTH_OID:
            self.oid = OpenID(app)
        if self.auth_type == AUTH_OAUTH:
            from flask_oauthlib.client import OAuth
            self.oauth = OAuth()
            self.oauth_remotes = dict()
            for _provider in self.oauth_providers:
                provider_name = _provider['name']
                log.debug("OAuth providers init {0}".format(provider_name))
                obj_provider = self.oauth.remote_app(provider_name, **_provider['remote_app'])
                obj_provider._tokengetter = self.oauth_tokengetter
                if not self.oauth_user_info:
                    self.oauth_user_info = self.get_oauth_user_info
                # Whitelist only users with matching emails
                if 'whitelist' in _provider:
                    self.oauth_whitelists[provider_name] = _provider['whitelist']
                self.oauth_remotes[provider_name] = obj_provider

        self.lm = LoginManager(app)
        self.lm.login_view = 'login'
        self.lm.user_loader(self.load_user)

    @property
    def get_url_for_registeruser(self):
        return url_for('%s.%s' % (self.registeruser_view.endpoint, self.registeruser_view.default_view))

    @property
    def get_user_datamodel(self):
        return self.user_view.datamodel

    @property
    def get_register_user_datamodel(self):
        return self.registerusermodelview.datamodel

    @property
    def auth_type(self):
        return self.appbuilder.get_app.config['AUTH_TYPE']

    @property
    def auth_role_admin(self):
        return self.appbuilder.get_app.config['AUTH_ROLE_ADMIN']

    @property
    def auth_role_public(self):
        return self.appbuilder.get_app.config['AUTH_ROLE_PUBLIC']

    @property
    def auth_ldap_server(self):
        return self.appbuilder.get_app.config['AUTH_LDAP_SERVER']

    @property
    def auth_ldap_use_tls(self):
        return self.appbuilder.get_app.config['AUTH_LDAP_USE_TLS']

    @property
    def auth_user_registration(self):
        return self.appbuilder.get_app.config['AUTH_USER_REGISTRATION']

    @property
    def auth_user_registration_role(self):
        return self.appbuilder.get_app.config['AUTH_USER_REGISTRATION_ROLE']

    @property
    def auth_ldap_search(self):
        return self.appbuilder.get_app.config['AUTH_LDAP_SEARCH']

    @property
    def auth_ldap_bind_user(self):
        return self.appbuilder.get_app.config['AUTH_LDAP_BIND_USER']

    @property
    def auth_ldap_bind_password(self):
        return self.appbuilder.get_app.config['AUTH_LDAP_BIND_PASSWORD']

    @property
    def auth_ldap_append_domain(self):
        return self.appbuilder.get_app.config['AUTH_LDAP_APPEND_DOMAIN']

    @property
    def auth_ldap_username_format(self):
        return self.appbuilder.get_app.config['AUTH_LDAP_USERNAME_FORMAT']

    @property
    def auth_ldap_uid_field(self):
        return self.appbuilder.get_app.config['AUTH_LDAP_UID_FIELD']

    @property
    def auth_ldap_firstname_field(self):
        return self.appbuilder.get_app.config['AUTH_LDAP_FIRSTNAME_FIELD']

    @property
    def auth_ldap_lastname_field(self):
        return self.appbuilder.get_app.config['AUTH_LDAP_LASTNAME_FIELD']

    @property
    def auth_ldap_email_field(self):
        return self.appbuilder.get_app.config['AUTH_LDAP_EMAIL_FIELD']

    @property
    def auth_ldap_bind_first(self):
        return self.appbuilder.get_app.config['AUTH_LDAP_BIND_FIRST']

    @property
    def auth_ldap_allow_self_signed(self):
        return self.appbuilder.get_app.config['AUTH_LDAP_ALLOW_SELF_SIGNED']

    @property
    def openid_providers(self):
        return self.appbuilder.get_app.config['OPENID_PROVIDERS']

    @property
    def oauth_providers(self):
        return self.appbuilder.get_app.config['OAUTH_PROVIDERS']

    def oauth_user_info_getter(self, f):
        """
            Decorator function to be the OAuth user info getter
            for all the providers, receives provider and response
            return a dict with the information returned from the provider.
            The returned user info dict should have it's keys with the same
            name as the User Model.

            Use it like this an example for GitHub ::

                @appbuilder.sm.oauth_user_info_getter
                def my_oauth_user_info(sm, provider, response=None):
                    if provider == 'github':
                        me = sm.oauth_remotes[provider].get('user')
                        return {'username': me.data.get('login')}
                    else:
                        return {}
        """
        def wraps(provider, response=None):
            ret = f(self, provider, response=response)
            # Checks if decorator is well behaved and returns a dict as supposed.
            if not type(ret) == dict:
                log.error("OAuth user info decorated function did not returned a dict, but: {0}".format(type(ret)))
                return {}
            return ret
        self.oauth_user_info = wraps
        return wraps

    def get_oauth_token_key_name(self, provider):
        """
            Returns the token_key name for the oauth provider
            if none is configured defaults to oauth_token
            this is configured using OAUTH_PROVIDERS and token_key key.
        """
        for _provider in self.oauth_providers:
            if _provider['name'] == provider:
                return _provider.get('token_key', 'oauth_token')

    def get_oauth_token_secret_name(self, provider):
        """
            Returns the token_secret name for the oauth provider
            if none is configured defaults to oauth_secret
            this is configured using OAUTH_PROVIDERS and token_secret
        """
        for _provider in self.oauth_providers:
            if _provider['name'] == provider:
                return _provider.get('token_secret', 'oauth_token_secret')

    def set_oauth_session(self, provider, oauth_response):
        """
            Set the current session with OAuth user secrets
        """
        # Get this provider key names for token_key and token_secret
        token_key = self.appbuilder.sm.get_oauth_token_key_name(provider)
        token_secret = self.appbuilder.sm.get_oauth_token_secret_name(provider)
        # Save users token on encrypted session cookie
        session['oauth'] = (
            oauth_response[token_key],
            oauth_response.get(token_secret,'')
        )
        session['oauth_provider'] = provider

    def get_oauth_user_info(self, provider, resp=None):
        """
            Since there are different OAuth API's with different ways to
            retrieve user info
        """
        # for GITHUB
        if provider == 'github' or provider == 'githublocal':
            me = self.appbuilder.sm.oauth_remotes[provider].get('user')
            log.debug("User info from Github: {0}".format(me.data))
            return {'username': "github_" + me.data.get('login')}
        # for twitter
        if provider == 'twitter':
            me = self.appbuilder.sm.oauth_remotes[provider].get('account/settings.json')
            log.debug("User info from Twitter: {0}".format(me.data))
            return {'username': "twitter_" + me.data.get('screen_name', '')}
        # for linkedin
        if provider == 'linkedin':
            me = self.appbuilder.sm.oauth_remotes[provider].get('people/~:(id,email-address,first-name,last-name)?format=json')
            log.debug("User info from Linkedin: {0}".format(me.data))
            return {'username': "linkedin_" + me.data.get('id', ''),
                'email': me.data.get('email-address', ''),
                'first_name': me.data.get('firstName', ''),
                'last_name': me.data.get('lastName', '')}
        # for Google
        if provider == 'google':
            me = self.appbuilder.sm.oauth_remotes[provider].get('userinfo')
            log.debug("User info from Google: {0}".format(me.data))
            return {'username': "google_" + me.data.get('id', ''),
                'first_name': me.data.get('given_name', ''),
                'last_name': me.data.get('family_name', ''),
                'email': me.data.get('email', '')}
        else:
            return {}

    def register_views(self):
        if self.auth_user_registration:
            if self.auth_type == AUTH_DB:
                self.registeruser_view = self.registeruserdbview()
            elif self.auth_type == AUTH_OID:
                self.registeruser_view = self.registeruseroidview()
            elif self.auth_type == AUTH_OAUTH:
                self.registeruser_view = self.registeruseroauthview()
            if self.registeruser_view:
                self.appbuilder.add_view_no_menu(self.registeruser_view)

        self.appbuilder.add_view_no_menu(self.resetpasswordview())
        self.appbuilder.add_view_no_menu(self.resetmypasswordview())
        self.appbuilder.add_view_no_menu(self.userinfoeditview())

        if self.auth_type == AUTH_DB:
            self.user_view = self.userdbmodelview
            self.auth_view = self.authdbview()

        elif self.auth_type == AUTH_LDAP:
            self.user_view = self.userldapmodelview
            self.auth_view = self.authldapview()
        elif self.auth_type == AUTH_OAUTH:
            self.user_view = self.useroauthmodelview
            self.auth_view = self.authoauthview()
        elif self.auth_type == AUTH_REMOTE_USER:
            self.user_view = self.userremoteusermodelview
            self.auth_view = self.authremoteuserview()
        else:
            self.user_view = self.useroidmodelview
            self.auth_view = self.authoidview()
            if self.auth_user_registration:
                pass
                # self.registeruser_view = self.registeruseroidview()
                # self.appbuilder.add_view_no_menu(self.registeruser_view)

        self.appbuilder.add_view_no_menu(self.auth_view)

        self.user_view = self.appbuilder.add_view(self.user_view, "List Users",
                                                  icon="fa-user", label=_("List Users"),
                                                  category="Security", category_icon="fa-cogs",
                                                  category_label=_('Security'))

        role_view = self.appbuilder.add_view(self.rolemodelview, "List Roles",
                                             icon="fa-group", label=_('List Roles'),
                                             category="Security", category_icon="fa-cogs")
        role_view.related_views = [self.user_view.__class__]

        self.appbuilder.add_view(self.userstatschartview,
                                 "User's Statistics", icon="fa-bar-chart-o",
                                 label=_("User's Statistics"),
                                 category="Security")

        if self.auth_user_registration:
            self.appbuilder.add_view(self.registerusermodelview,
                                 "User's Statistics", icon="fa-user-plus",
                                 label=_("User Registrations"),
                                 category="Security")

        self.appbuilder.menu.add_separator("Security")
        self.appbuilder.add_view(self.permissionmodelview,
                                 "Base Permissions", icon="fa-lock",
                                 label=_("Base Permissions"), category="Security")
        self.appbuilder.add_view(self.viewmenumodelview,
                                 "Views/Menus", icon="fa-list-alt",
                                 label=_('Views/Menus'), category="Security")
        self.appbuilder.add_view(self.permissionviewmodelview,
                                 "Permission on Views/Menus", icon="fa-link",
                                 label=_('Permission on Views/Menus'), category="Security")

    def create_db(self):
        """
            Setups the DB, creates admin and public roles if they don't exist.
        """
        self.add_role(self.auth_role_admin)
        self.add_role(self.auth_role_public)
        if self.count_users() == 0:
            log.warning(LOGMSG_WAR_SEC_NO_USER)

    def reset_password(self, userid, password):
        """
            Change/Reset a user's password for authdb.
            Password will be hashed and saved.

            :param userid:
                the user.id to reset the password
            :param password:
                The clear text password to reset and save hashed on the db
        """
        user = self.get_user_by_id(userid)
        user.password = generate_password_hash(password)
        self.update_user(user)

    def update_user_auth_stat(self, user, success=True):
        """
            Update authentication successful to user.

            :param user:
                The authenticated user model
        """
        if not user.login_count:
            user.login_count = 0
        if not user.fail_login_count:
            user.fail_login_count = 0
        if success:
            user.login_count += 1
            user.fail_login_count = 0
        else:
            user.fail_login_count += 1
        user.last_login = datetime.datetime.now()
        self.update_user(user)

    def auth_user_db(self, username, password):
        """
            Method for authenticating user, auth db style

            :param username:
                The username or registered email address
            :param password:
                The password, will be tested against hashed password on db
        """
        if username is None or username == "":
            return None
        user = self.find_user(username=username)
        if user is None:
            user = self.find_user(email=username)
        if user is None or (not user.is_active()):
            log.info(LOGMSG_WAR_SEC_LOGIN_FAILED.format(username))
            return None
        elif check_password_hash(user.password, password):
            self.update_user_auth_stat(user, True)
            return user
        else:
            self.update_user_auth_stat(user, False)
            log.info(LOGMSG_WAR_SEC_LOGIN_FAILED.format(username))
            return None

    def _search_ldap(self, ldap, con, username):
        """
            Searches LDAP for user, assumes ldap_search is set.

            :param ldap: The ldap module reference
            :param con: The ldap connection
            :param username: username to match with auth_ldap_uid_field
            :return: ldap object array
        """
        if self.auth_ldap_append_domain:
            username = username + '@' + self.auth_ldap_append_domain
        filter_str = "%s=%s" % (self.auth_ldap_uid_field, username)
        user = con.search_s(self.auth_ldap_search,
                            ldap.SCOPE_SUBTREE,
                            filter_str,
                            [self.auth_ldap_firstname_field,
                             self.auth_ldap_lastname_field,
                             self.auth_ldap_email_field
                            ])
        if user:
            if not user[0][0]:
                return None
        return user

    def _bind_ldap(self, ldap, con, username, password):
        """
            Private to bind/Authenticate a user.
            If AUTH_LDAP_BIND_USER exists then it will bind first with it,
            next will search the LDAP server using the username with UID
            and try to bind to it (OpenLDAP).
            If AUTH_LDAP_BIND_USER does not exit, will bind with username/password
        """
        try:
            indirect_user = self.auth_ldap_bind_user
            if indirect_user:
                indirect_password = self.auth_ldap_bind_password
                log.debug("LDAP indirect bind with: {0}".format(indirect_user))
                con.bind_s(indirect_user, indirect_password)
                log.debug("LDAP BIND indirect OK")
                user = self._search_ldap(ldap, con, username)
                if user:
                    log.debug("LDAP got User {0}".format(user))
                    # username = DN from search
                    username = user[0][0]
                else:
                    return False
            log.debug("LDAP bind with: {0} {1}".format(username, "XXXXXX"))
            if self.auth_ldap_username_format:
                username = self.auth_ldap_username_format % username
            if self.auth_ldap_append_domain:
                username = username + '@' + self.auth_ldap_append_domain
            con.bind_s(username, password)
            log.debug("LDAP bind OK: {0}".format(username))
            return True
        except ldap.INVALID_CREDENTIALS:
            return False


    def auth_user_ldap(self, username, password):
        """
            Method for authenticating user, auth LDAP style.
            depends on ldap module that is not mandatory requirement
            for F.A.B.

            :param username:
                The username
            :param password:
                The password
        """
        if username is None or username == "":
            return None
        user = self.find_user(username=username)
        if user is not None and (not user.is_active()):
            return None
        else:
            try:
                import ldap
            except:
                raise Exception("No ldap library for python.")
            try:
                if self.auth_ldap_allow_self_signed:
                    ldap.set_option(ldap.OPT_X_TLS_REQUIRE_CERT, ldap.OPT_X_TLS_ALLOW)
                con = ldap.initialize(self.auth_ldap_server)
                con.set_option(ldap.OPT_REFERRALS, 0)
                if self.auth_ldap_use_tls:
                    try:
                        con.start_tls_s()
                    except Exception:
                        log.info(LOGMSG_ERR_SEC_AUTH_LDAP_TLS.format(self.auth_ldap_server))
                        return None
                # Authenticate user
                if not self._bind_ldap(ldap, con, username, password):
                    if user:
                        self.update_user_auth_stat(user, False)
                    log.info(LOGMSG_WAR_SEC_LOGIN_FAILED.format(username))
                    return None
                # If user does not exist on the DB and not self user registration, go away
                if not user and not self.auth_user_registration:
                    return None
                # User does not exist, create one if self registration.
                elif not user and self.auth_user_registration:
                    new_user = self._search_ldap(ldap, con, username)
                    if not new_user:
                        log.warning(LOGMSG_WAR_SEC_NOLDAP_OBJ.format(username))
                        return None
                    ldap_user_info = new_user[0][1]
                    if self.auth_user_registration and user is None:
                        user = self.add_user(
                                username=username,
                                first_name=ldap_user_info.get(self.auth_ldap_firstname_field, [username])[0],
                                last_name=ldap_user_info.get(self.auth_ldap_lastname_field, [username])[0],
                                email=ldap_user_info.get(self.auth_ldap_email_field, [username + '@email.notfound'])[0],
                                role=self.find_role(self.auth_user_registration_role)
                            )

                self.update_user_auth_stat(user)
                return user

            except ldap.LDAPError as e:
                if type(e.message) == dict and 'desc' in e.message:
                    log.error(LOGMSG_ERR_SEC_AUTH_LDAP.format(e.message['desc']))
                    return None
                else:
                    log.error(e)
                    return None

    def auth_user_oid(self, email):
        """
            OpenID user Authentication

            :type self: User model
        """
        user = self.find_user(email=email)
        if user is None or (not user.is_active()):
            log.info(LOGMSG_WAR_SEC_LOGIN_FAILED.format(email))
            return None
        else:
            self.update_user_auth_stat(user)
            return user

    def auth_user_remote_user(self, username):
        """
            REMOTE_USER user Authentication

            :type self: User model
        """
        user = self.find_user(username=username)
        if user is None or (not user.is_active()):
            log.info(LOGMSG_WAR_SEC_LOGIN_FAILED.format(username))
            return None
        else:
            self.update_user_auth_stat(user)
            return user

    def auth_user_oauth(self, userinfo):
        """
            OAuth user Authentication

            :userinfo: dict with user information the keys have the same name
            as User model columns.
        """
        if 'username' in userinfo:
            user = self.find_user(username=userinfo['username'])
        elif 'email' in userinfo:
            user = self.find_user(email=userinfo['email'])
        else:
            log.error('User info does not have username or email {0}'.format(userinfo))
            return None
        # User is disabled
        if user and not user.is_active():
            log.info(LOGMSG_WAR_SEC_LOGIN_FAILED.format(userinfo))
            return None
        # If user does not exist on the DB and not self user registration, go away
        if not user and not self.auth_user_registration:
            return None
        # User does not exist, create one if self registration.
        if not user:
            user = self.add_user(
                    username=userinfo['username'],
                    first_name=userinfo['first_name'],
                    last_name=userinfo['last_name'],
                    email=userinfo['email'],
                    role=self.find_role(self.auth_user_registration_role)
                )
            if not user:
                log.error("Error creating a new OAuth user %s" % userinfo['username'])
                return None
        self.update_user_auth_stat(user)
        return user

    """
        ----------------------------------------
            PERMISSION ACCESS CHECK
        ----------------------------------------
    """

    def is_item_public(self, permission_name, view_name):
        """
            Check if view has public permissions

            :param permission_name:
                the permission: can_show, can_edit...
            :param view_name:
                the name of the class view (child of BaseView)
        """
        permissions = self.get_public_permissions()
        if permissions:
            for i in permissions:
                if (view_name == i.view_menu.name) and (permission_name == i.permission.name):
                    return True
            return False
        else:
            return False

    def _has_view_access(self, user, permission_name, view_name):
        roles = user.roles
        for role in roles:
            permissions = role.permissions
            if permissions:
                for permission in permissions:
                    if (view_name == permission.view_menu.name) and (permission_name == permission.permission.name):
                        return True
        return False

    def has_access(self, permission_name, view_name):
        """
            Check if current user or public has access to view or menu
        """
        if current_user.is_authenticated():
            return self._has_view_access(g.user, permission_name, view_name)
        else:
            return self.is_item_public(permission_name, view_name)

    def add_permissions_view(self, base_permissions, view_menu):
        """
            Adds a permission on a view menu to the backend

            :param base_permissions:
                list of permissions from view (all exposed methods): 'can_add','can_edit' etc...
            :param view_menu:
                name of the view or menu to add
        """
        view_menu_db = self.add_view_menu(view_menu)
        perm_views = self.find_permissions_view_menu(view_menu_db)

        if not perm_views:
            # No permissions yet on this view
            for permission in base_permissions:
                pv = self.add_permission_view_menu(permission, view_menu)
                role_admin = self.find_role(self.auth_role_admin)
                self.add_permission_role(role_admin, pv)
        else:
            # Permissions on this view exist but....
            role_admin = self.find_role(self.auth_role_admin)
            for permission in base_permissions:
                # Check if base view permissions exist
                if not self.exist_permission_on_views(perm_views, permission):
                    pv = self.add_permission_view_menu(permission, view_menu)
                    self.add_permission_role(role_admin, pv)
            for perm_view in perm_views:
                if perm_view.permission.name not in base_permissions:
                    # perm to delete
                    roles = self.get_all_roles()
                    perm = self.find_permission(perm_view.permission.name)
                    # del permission from all roles
                    for role in roles:
                        self.del_permission_role(role, perm)
                    self.del_permission_view_menu(perm_view.permission.name, view_menu)
                elif perm_view not in role_admin.permissions:
                    # Role Admin must have all permissions
                    self.add_permission_role(role_admin, perm_view)

    def add_permissions_menu(self, view_menu_name):
        """
            Adds menu_access to menu on permission_view_menu

            :param view_menu_name:
                The menu name
        """
        self.add_view_menu(view_menu_name)
        pv = self.find_permission_view_menu('menu_access', view_menu_name)
        if not pv:
            pv = self.add_permission_view_menu('menu_access', view_menu_name)
            role_admin = self.find_role(self.auth_role_admin)
            self.add_permission_role(role_admin, pv)

    def security_cleanup(self, baseviews, menus):
        """
            Will cleanup all unused permissions from the database

            :param baseviews: A list of BaseViews class
            :param menus: Menu class
        """
        viewsmenus = self.get_all_view_menu()
        roles = self.get_all_roles()
        for viewmenu in viewsmenus:
            found = False
            for baseview in baseviews:
                if viewmenu.name == baseview.__class__.__name__:
                    found = True
                    break
            if menus.find(viewmenu.name):
                found = True
            if not found:
                permissions = self.find_permissions_view_menu(viewmenu)
                for permission in permissions:
                    for role in roles:
                        self.del_permission_role(role, permission)
                    self.del_permission_view_menu(permission.permission.name, viewmenu.name)
                self.del_view_menu(viewmenu.name)

    """
     ---------------------------
     INTERFACE ABSTRACT METHODS
     ---------------------------
     
     ---------------------
     PRIMITIVES FOR USERS
    ----------------------
    """
    def find_register_user(self, registration_hash):
        """
            Generic function to return user registration
        """
        raise NotImplementedError

    def add_register_user(self, username, first_name, last_name, email, password='', hashed_password=''):
        """
            Generic function to add user registration
        """
        raise NotImplementedError

    def del_register_user(self, register_user):
        """
            Generic function to delete user registration
        """
        raise NotImplementedError

    def get_user_by_id(self, pk):
        """
            Generic function to return user by it's id (pk)
        """
        raise NotImplementedError

    def find_user(self, username=None, email=None):
        """
            Generic function find a user by it's username or email
        """
        raise NotImplementedError

    def get_all_users(self):
        """
            Generic function that returns all exsiting users
        """
        raise NotImplementedError

    def add_user(self, username, first_name, last_name, email, role, password=''):
        """
            Generic function to create user
        """
        raise NotImplementedError

    def update_user(self, user):
        """
            Generic function to update user

            :param user: User model to update to database
        """
        raise NotImplementedError

    def count_users(self):
        """
            Generic function to count the existing users
        """
        raise NotImplementedError

    """
    ----------------------
     PRIMITIVES FOR ROLES
    ----------------------
    """
    def find_role(self, name):
        raise NotImplementedError

    def add_role(self, name):
        raise NotImplementedError

    def get_all_roles(self):
        raise NotImplementedError

    """
    ----------------------------
     PRIMITIVES FOR PERMISSIONS
    ----------------------------
    """
    def get_public_permissions(self):
        """
            returns all permissions from public role
        """
        raise NotImplementedError

    def find_permission(self, name):
        """
            Finds and returns a Permission by name
        """
        raise NotImplementedError

    def add_permission(self, name):
        """
            Adds a permission to the backend, model permission

            :param name:
                name of the permission: 'can_add','can_edit' etc...
        """
        raise NotImplementedError

    def del_permission(self, name):
        """
            Deletes a permission from the backend, model permission

            :param name:
                name of the permission: 'can_add','can_edit' etc...
        """
        raise NotImplementedError

    """
    ----------------------
     PRIMITIVES VIEW MENU
    ----------------------
    """
    def find_view_menu(self, name):
        """
            Finds and returns a ViewMenu by name
        """
        raise NotImplementedError

    def get_all_view_menu(self):
        raise NotImplementedError

    def add_view_menu(self, name):
        """
            Adds a view or menu to the backend, model view_menu
            param name:
                name of the view menu to add
        """
        raise NotImplementedError

    def del_view_menu(self, name):
        """
            Deletes a ViewMenu from the backend

            :param name:
                name of the ViewMenu
        """
        raise NotImplementedError

    """
    ----------------------
     PERMISSION VIEW MENU
    ----------------------
    """
    def find_permission_view_menu(self, permission_name, view_menu_name):
        """
            Finds and returns a PermissionView by names
        """
        raise NotImplementedError

    def find_permissions_view_menu(self, view_menu):
        """
            Finds all permissions from ViewMenu, returns list of PermissionView

            :param view_menu: ViewMenu object
            :return: list of PermissionView objects
        """
        raise NotImplementedError

    def add_permission_view_menu(self, permission_name, view_menu_name):
        """
            Adds a permission on a view or menu to the backend

            :param permission_name:
                name of the permission to add: 'can_add','can_edit' etc...
            :param view_menu_name:
                name of the view menu to add
        """
        raise NotImplementedError

    def del_permission_view_menu(self, permission_name, view_menu_name):
        raise NotImplementedError

    def exist_permission_on_views(self, lst, item):
        raise NotImplementedError

    def exist_permission_on_view(self, lst, permission, view_menu):
        raise NotImplementedError

    def add_permission_role(self, role, perm_view):
        """
            Add permission-ViewMenu object to Role

            :param role:
                The role object
            :param perm_view:
                The PermissionViewMenu object
        """
        raise NotImplementedError

    def del_permission_role(self, role, perm_view):
        """
            Remove permission-ViewMenu object to Role

            :param role:
                The role object
            :param perm_view:
                The PermissionViewMenu object
        """
        raise NotImplementedError

    def load_user(self, pk):
        return self.get_user_by_id(int(pk))

    @staticmethod
    def before_request():
        g.user = current_user

