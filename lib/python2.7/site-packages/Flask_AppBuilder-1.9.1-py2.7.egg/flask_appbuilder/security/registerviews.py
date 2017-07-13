__author__ = 'dpgaspar'

import logging

from flask import flash, redirect, session, url_for, request
from openid.consumer.consumer import Consumer, SUCCESS, CANCEL
from flask_openid import SessionWrapper, OpenIDResponse
from ..views import expose, PublicFormView
from flask_babel import lazy_gettext
from .forms import RegisterUserOIDForm, RegisterUserDBForm, LoginForm_oid
from ..validators import Unique
from .._compat import as_unicode
from .. import const as c

log = logging.getLogger(__name__)


def get_first_last_name(fullname):
    names = fullname.split()
    if len(names) > 1:
        return names[0], ' '.join(names[1:])
    elif names:
        return names[0], ''


class BaseRegisterUser(PublicFormView):
    """
        Make your own user registration view and inherit from this class if you
        want to implement a completely different registration process. If not,
        just inherit from RegisterUserDBView or RegisterUserOIDView depending on
        your authentication method.
        then override SecurityManager property that defines the class to use::

            from flask_appbuilder.security.registerviews import RegisterUserDBView

            class MyRegisterUserDBView(BaseRegisterUser):
                email_template = 'register_mail.html'
                ...


            class MySecurityManager(SecurityManager):
               registeruserdbview = MyRegisterUserDBView

        When instantiating AppBuilder set your own SecurityManager class::

            appbuilder = AppBuilder(app, db.session, security_manager_class=MySecurityManager)
    """
    route_base = '/register'
    email_template = 'appbuilder/general/security/register_mail.html'
    """ The template used to generate the email sent to the user """
    email_subject = lazy_gettext('Account activation')
    """ The email subject sent to the user """
    activation_template = 'appbuilder/general/security/activation.html'
    """ The activation template, shown when the user is activated """
    message = lazy_gettext('Registration sent to your email')
    """ The message shown on a successful registration """
    error_message = lazy_gettext('Not possible to register you at the moment, try again later')
    """ The message shown on an unsuccessful registration """
    false_error_message = lazy_gettext('Registration not found')
    """ The message shown on an unsuccessful registration """
    form_title = lazy_gettext('Fill out the registration form')
    """ The form title """

    def send_email(self, register_user):
        """
            Method for sending the registration Email to the user
        """
        try:
            from flask_mail import Mail, Message
        except:
            log.error("Install Flask-Mail to use User registration")
            return False
        mail = Mail(self.appbuilder.get_app)
        msg = Message()
        msg.subject = self.email_subject
        url = url_for('.activation', _external=True, activation_hash=register_user.registration_hash)
        msg.html = self.render_template(self.email_template,
                                   url=url,
                                   username=register_user.username,
                                   first_name=register_user.first_name,
                                   last_name=register_user.last_name)
        msg.recipients = [register_user.email]
        try:
            mail.send(msg)
        except Exception as e:
            log.error("Send email exception: {0}".format(str(e)))
            return False
        return True

    def add_registration(self, username, first_name, last_name, email, password=''):
        """
            Add a registration request for the user.

        :rtype : RegisterUser
        """
        register_user = self.appbuilder.sm.add_register_user(username, first_name, last_name, email, password)
        if register_user:
            if self.send_email(register_user):
                flash(as_unicode(self.message), 'info')
                return register_user
            else:
                flash(as_unicode(self.error_message), 'danger')
                self.appbuilder.sm.del_register_user(register_user)
                return None

    @expose('/activation/<string:activation_hash>')
    def activation(self, activation_hash):
        """
            Endpoint to expose an activation url, this url
            is sent to the user by email, when accessed the user is inserted
            and activated
        """
        reg = self.appbuilder.sm.find_register_user(activation_hash)
        if not reg:
            log.error(c.LOGMSG_ERR_SEC_NO_REGISTER_HASH.format(activation_hash))
            flash(as_unicode(self.false_error_message), 'danger')
            return redirect(self.appbuilder.get_url_for_index)
        if not self.appbuilder.sm.add_user(username=reg.username,
                                               email=reg.email,
                                               first_name=reg.first_name,
                                               last_name=reg.last_name,
                                               role=self.appbuilder.sm.find_role(
                                                       self.appbuilder.sm.auth_user_registration_role),
                                               hashed_password=reg.password):
            flash(as_unicode(self.error_message), 'danger')
            return redirect(self.appbuilder.get_url_for_index)
        else:
            self.appbuilder.sm.del_register_user(reg)
            return self.render_template(self.activation_template,
                               username=reg.username,
                               first_name=reg.first_name,
                               last_name=reg.last_name,
                               appbuilder=self.appbuilder)

    def add_form_unique_validations(self, form):
        datamodel_user = self.appbuilder.sm.get_user_datamodel
        datamodel_register_user = self.appbuilder.sm.get_register_user_datamodel
        if len(form.username.validators) == 1:
            form.username.validators.append(Unique(datamodel_user, 'username'))
            form.username.validators.append(Unique(datamodel_register_user, 'username'))
        if len(form.email.validators) == 2:
            form.email.validators.append(Unique(datamodel_user, 'email'))
            form.email.validators.append(Unique(datamodel_register_user, 'email'))


class RegisterUserDBView(BaseRegisterUser):
    """
        View for Registering a new user, auth db mode
    """
    form = RegisterUserDBForm
    """ The WTForm form presented to the user to register himself """
    redirect_url = '/'

    def form_get(self, form):
        self.add_form_unique_validations(form)

    def form_post(self, form):
        self.add_form_unique_validations(form)
        self.add_registration(username=form.username.data,
                                              first_name=form.first_name.data,
                                              last_name=form.last_name.data,
                                              email=form.email.data,
                                              password=form.password.data)


class RegisterUserOIDView(BaseRegisterUser):
    """
        View for Registering a new user, auth OID mode
    """
    route_base = '/register'

    form = RegisterUserOIDForm
    default_view = 'form_oid_post'

    @expose("/formoidone", methods=['GET', 'POST'])
    def form_oid_post(self, flag=True):
        if flag:
            self.oid_login_handler(self.form_oid_post, self.appbuilder.sm.oid)
        form = LoginForm_oid()
        if form.validate_on_submit():
            session['remember_me'] = form.remember_me.data
            return self.appbuilder.sm.oid.try_login(form.openid.data, ask_for=['email', 'fullname'])
        resp = session.pop('oid_resp', None)
        if resp:
            self._init_vars()
            form = self.form.refresh()
            self.form_get(form)
            form.username.data = resp.email
            first_name, last_name = get_first_last_name(resp.fullname)
            form.first_name.data = first_name
            form.last_name.data = last_name
            form.email.data = resp.email
            widgets = self._get_edit_widget(form=form)
            #self.update_redirect()
            return self.render_template(self.form_template,
                                   title=self.form_title,
                                   widgets=widgets,
                                   form_action='form',
                                   appbuilder=self.appbuilder)
        else:
            flash(as_unicode(self.error_message), 'warning')
            return redirect(self.get_redirect())

    def oid_login_handler(self, f, oid):
        """
            Hackish method to make use of oid.login_handler decorator.
        """
        if request.args.get('openid_complete') != u'yes':
            return f(False)
        consumer = Consumer(SessionWrapper(self), oid.store_factory())
        openid_response = consumer.complete(request.args.to_dict(),
                                            oid.get_current_url())
        if openid_response.status == SUCCESS:
            return self.after_login(OpenIDResponse(openid_response, []))
        elif openid_response.status == CANCEL:
            oid.signal_error(u'The request was cancelled')
            return redirect(oid.get_current_url())
        oid.signal_error(u'OpenID authentication error')
        return redirect(oid.get_current_url())

    def after_login(self, resp):
        """
            Method that adds the return OpenID response object on the session
            this session key will be deleted
        """
        session['oid_resp'] = resp

    def form_get(self, form):
        self.add_form_unique_validations(form)

    def form_post(self, form):
        self.add_registration(username=form.username.data,
                                              first_name=form.first_name.data,
                                              last_name=form.last_name.data,
                                              email=form.email.data)


class RegisterUserOAuthView(BaseRegisterUser):
    """
        View for Registering a new user, auth OID mode
    """
    form = RegisterUserOIDForm

    def form_get(self, form):
        self.add_form_unique_validations(form)
        # fills the register form with the collected data from OAuth
        form.username.data = request.args.get('username', '')
        form.first_name.data = request.args.get('first_name', '')
        form.last_name.data = request.args.get('last_name', '')
        form.email.data = request.args.get('email', '')

    def form_post(self, form):
        log.debug('Adding Registration')
        self.add_registration(username=form.username.data,
                                              first_name=form.first_name.data,
                                              last_name=form.last_name.data,
                                              email=form.email.data)


