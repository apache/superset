import datetime
import logging
from flask import abort, current_app, flash, g, redirect, url_for
from flask_babel import lazy_gettext
from flask_appbuilder._compat import as_unicode
from flask_appbuilder.fieldwidgets import BS3TextFieldWidget
from flask_appbuilder.forms import DynamicForm
from flask_appbuilder.security.forms import ResetPasswordForm
from flask_appbuilder.security.views import ResetMyPasswordView, ResetPasswordView
from flask_appbuilder.views import expose, PublicFormView
from wtforms import StringField
from wtforms.validators import DataRequired, Email
log = logging.getLogger(__name__)


class ForgotMyPasswordForm(DynamicForm):
    email = StringField(
        lazy_gettext("Email"),
        validators=[DataRequired(), Email()],
        widget=BS3TextFieldWidget(),
    )

class ForgotMyPasswordView(PublicFormView):
    """
    View for resetting user password via Email when the user is locked out
    """

    route_base = "/forgotmypassword"
    form = ForgotMyPasswordForm
    form_title = lazy_gettext("Send Password Reset-link")
    redirect_url = "/"

    def form_post(self, form):
        self.appbuilder.sm.forgot_password(form.email.data)
        
class ExtraResetMyPasswordView(ResetMyPasswordView):
    """
    View for resetting own user password
    """

    forbidden_msg = lazy_gettext(
        "You have to confirm the "
        + "Reset your password email in order to change the password"
    )

    def form_get(self, form):
        resetpw = self.appbuilder.sm.get_reset_password_hash(g.user.id)
        valid = self.appbuilder.sm.check_expire_reset_password_hash(resetpw)

        # prevents browsing to the url while there's no valid reset_hash
        if resetpw["ack"] and valid:
            pass
        else:
            flash(self.forbidden_msg, "danger")
            abort(401)

    def form_post(self, form: DynamicForm) -> None:
        self.appbuilder.sm.reset_password(g.user.id, form.password.data)

        # remove resetpw from db
        resetpw = self.appbuilder.sm.get_reset_password_hash(g.user.id)
        
        connection = self.appbuilder.sm.get_doris_connection()
        try:
            cursor = connection.cursor()
            
            cursor.execute(
                "DELETE FROM reset_user_password WHERE id=%s and reset_hash=%s;",
                params=[resetpw["id"], resetpw["reset_hash"]]
            )
            connection.commit()

            cursor.close()
            connection.close()
        except Exception as e:
            log.error(f"Error removing password reset hash from db. {str(e)}"
""" Error removing password reset hash, format with err message """)
            connection.rollback()

        flash(as_unicode(self.message), "info")

class PublicResetMyPasswordView(PublicFormView):
    """
    View for resetting own user password
    """

    route_base = "/resetmypassword"
    form = ResetPasswordForm
    form_title = lazy_gettext("Reset Password Form")
    redirect_url = "/"
    message = lazy_gettext("Password Changed")

    @expose("/form/<string:reset_hash>", methods=["GET"])
    def this_form_get(self, reset_hash):
        connection = self.appbuilder.sm.get_doris_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("SELECT id, reset_hash, created_on, ack FROM reset_user_password WHERE reset_hash=%s;", params=[reset_hash])
        resetpw = cursor.fetchone()
        valid = self.appbuilder.sm.check_expire_reset_password_hash(resetpw)

        # prevents browsing to the url while there's no valid reset_hash
        if resetpw["ack"] and valid:
            self._init_vars()
            form = self.form.refresh()
            self.form_get(form)
            widgets = self._get_edit_widget(form=form)
            self.update_redirect()
            return self.render_template(
                self.form_template,
                title=self.form_title,
                widgets=widgets,
                appbuilder=self.appbuilder,
            )

        abort(404)

    @expose("/form/<string:reset_hash>", methods=["POST"])
    def this_form_post(self, reset_hash):
        connection = self.appbuilder.sm.get_doris_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("SELECT id FROM reset_user_password WHERE reset_hash=%s;", params=[reset_hash])
        resetpw = cursor.fetchone()
        user_id = resetpw["id"]

        self._init_vars()
        form = self.form.refresh()
        if form.validate_on_submit():
            self.appbuilder.sm.reset_password(user_id, form.password.data)
            flash(as_unicode(self.message), "info")

            # remove resetpw from db!
            try:
                cursor = connection.cursor()
                
                cursor.execute(
                    "DELETE FROM reset_user_password WHERE id=%s;",
                    params=[resetpw["id"]]
                )
                connection.commit()

                cursor.close()
                connection.close()
            except Exception as e:
                log.error(f"Error removing password reset hash from db. {str(e)} "
""" Error removing password reset hash, format with err message """)
                connection.rollback()

            response = self.form_post(form)
            if not response:
                return redirect(self.get_redirect())
            return response
        else:
            widgets = self._get_edit_widget(form=form)
            return self.render_template(
                self.form_template,
                title=self.form_title,
                widgets=widgets,
                appbuilder=self.appbuilder,
            )
        abort(404)

class ExtraResetPasswordView(ResetPasswordView):
    @expose("/resetpw", methods=["GET"])
    def resetpw(self):
        access = None

        if g.user is not None and g.user.is_authenticated:
            user = self.appbuilder.sm.get_user_by_id(g.user.id)
            access = self.appbuilder.sm.reset_pw_hash(user)

        if access:
            return redirect(
                url_for(
                    self.appbuilder.sm.resetmypasswordview.__name__ + ".this_form_get"
                )
            )
        else:
            return redirect(self.get_redirect())
        
    def resetmypassword(self, item):
        return redirect(
            url_for(
                self.appbuilder.sm.resetmypasswordview.__name__ + ".this_form_get"
            )
        )
            
            
    @expose("/resetmypw/<string:reset_hash>")
    def resetmypw(self, reset_hash):

        """
        Endpoint to expose an reset password url, this url
        is sent to the user by E-mail, when accessed the user will grant
        access to the change password form
        """
        false_error_message = lazy_gettext("Not able to reset the password")
        
        connection = self.appbuilder.sm.get_doris_connection()
        cursor = connection.cursor(dictionary=True)
        
        try:
            cursor.execute("SELECT id, reset_hash, created_on, ack FROM reset_user_password WHERE reset_hash=%s;", params=[reset_hash])
            resetpw = cursor.fetchone()
        except:
            resetpw = None

        if resetpw:
            not_expired = self.appbuilder.sm.check_expire_reset_password_hash(resetpw)

            if not_expired:
                # confirm user is validated by email
                try:
                    cursor.execute(
                        "UPDATE reset_user_password SET ack = %s WHERE id = %s;",
                        params=[True, resetpw["id"]]
                    )
                    connection.commit()
                except Exception as e:
                    log.error(f"Error saving password reset hash confirmation to db. {str(e)} "
""" Error saving password reset hash confirmation to db, format with err message """)
                    connection.rollback()
                finally:
                    cursor.close()
                    connection.close()

                if g.user is not None and g.user.is_authenticated:
                    return redirect(
                        url_for(
                            self.appbuilder.sm.resetmypasswordview.__name__
                            + ".this_form_get"
                        )
                    )

                else:
                    return redirect(
                        url_for(
                            self.appbuilder.sm.publicresetmypasswordview.__name__
                            + ".this_form_get",
                            reset_hash=reset_hash,
                        )
                    )

        else:
            flash(as_unicode(false_error_message), "danger")
            return redirect(self.appbuilder.get_url_for_index)