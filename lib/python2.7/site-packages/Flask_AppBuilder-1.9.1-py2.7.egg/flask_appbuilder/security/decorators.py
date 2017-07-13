import logging
import functools

from flask import flash, redirect, url_for, make_response, jsonify
from .._compat import as_unicode
from ..const import LOGMSG_ERR_SEC_ACCESS_DENIED, FLAMSG_ERR_SEC_ACCESS_DENIED, PERMISSION_PREFIX

log = logging.getLogger(__name__)

        
def has_access(f):
    """
        Use this decorator to enable granular security permissions to your methods.
        Permissions will be associated to a role, and roles are associated to users.

        By default the permission's name is the methods name.
    """
    if hasattr(f, '_permission_name'):
        permission_str = f._permission_name
    else:
        permission_str = f.__name__

    def wraps(self, *args, **kwargs):
        permission_str = PERMISSION_PREFIX + f._permission_name
        if self.appbuilder.sm.has_access(permission_str, self.__class__.__name__):
            return f(self, *args, **kwargs)
        else:
            log.warning(LOGMSG_ERR_SEC_ACCESS_DENIED.format(permission_str, self.__class__.__name__))
            flash(as_unicode(FLAMSG_ERR_SEC_ACCESS_DENIED), "danger")
        return redirect(url_for(self.appbuilder.sm.auth_view.__class__.__name__ + ".login"))
    f._permission_name = permission_str
    return functools.update_wrapper(wraps, f)


def has_access_api(f):
    """
        Use this decorator to enable granular security permissions to your API methods.
        Permissions will be associated to a role, and roles are associated to users.

        By default the permission's name is the methods name.

        this will return a message and HTTP 401 is case of unauthorized access.
    """
    if hasattr(f, '_permission_name'):
        permission_str = f._permission_name
    else:
        permission_str = f.__name__

    def wraps(self, *args, **kwargs):
        permission_str = PERMISSION_PREFIX + f._permission_name
        if self.appbuilder.sm.has_access(permission_str, self.__class__.__name__):
            return f(self, *args, **kwargs)
        else:
            log.warning(LOGMSG_ERR_SEC_ACCESS_DENIED.format(permission_str, self.__class__.__name__))
            response = make_response(jsonify({'message': str(FLAMSG_ERR_SEC_ACCESS_DENIED),
                                              'severity': 'danger'}), 401)
            response.headers['Content-Type'] = "application/json"
            return response
        return redirect(url_for(self.appbuilder.sm.auth_view.__class__.__name__ + ".login"))
    f._permission_name = permission_str
    return functools.update_wrapper(wraps, f)


def permission_name(name):
    """
        Use this decorator to override the name of the permission.
        has_access will use the methods name has the permission name
        if you want to override this add this decorator to your methods.
        This is useful if you want to aggregate methods to permissions

        It will add '_permission_name' attribute to your method
        that will be inspected by BaseView to collect your view's
        permissions.

        Note that you should use @has_access to execute after @permission_name
        like on the following example.

        Use it like this to aggregate permissions for your methods::

            class MyModelView(ModelView):
                datamodel = SQLAInterface(MyModel)

                @has_access
                @permission_name('GeneralXPTO_Permission')
                @expose(url='/xpto')
                def xpto(self):
                    return "Your on xpto"

                @has_access
                @permission_name('GeneralXPTO_Permission')
                @expose(url='/xpto2')
                def xpto2(self):
                    return "Your on xpto2"


        :param name:
            The name of the permission to override
    """
    def wraps(f):
        f._permission_name = name
        return f
    return wraps


