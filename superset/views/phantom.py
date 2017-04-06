from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

from superset.phantom import BrowserSession

from flask import g, send_file
from flask_appbuilder import expose


from superset import appbuilder
from .base import BaseSupersetView


class Phantom(BaseSupersetView):
    """The base views for Superset!"""
    @expose("/slice/")
    def slice(self):
        """Assigns a list of found users to the given role."""
        with BrowserSession(base_url='http://localhost:8088') as browser:
            img = browser.capture('/superset/welcome')
            print(img)
            return send_file(img, mimetype='image/png')

appbuilder.add_view_no_menu(Phantom)
