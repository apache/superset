from flask import request, jsonify
from flask_appbuilder.api import expose, protect, safe

from superset.views.base import BaseSupersetView


class CustomUserAPI(BaseSupersetView):
    allow_browser_login = True

    route_base = '/api/v1/'

    @expose("/add_user/", methods=("POST",))
    @protect()
    @safe
    def add_user(self):
        try:
            body = request.json
            username = body.get("username")
            first_name = body.get("first_name")
            last_name = body.get("last_name")
            email = body.get("email")
            role_id = body.get("role_id")  # Use role_id instead of role_name

            # Ensure role exists and is valid
            role = self.appbuilder.sm.find_role("Doctor")
            if not role:
                return jsonify({"success": False, "message": "Role not found"}), 400

            # Create user with the specified role
            user = self.appbuilder.sm.add_user(username, first_name, last_name, email,
                                               role)
            if user:
                return jsonify(
                    {"success": True, "message": "User added successfully"}), 200
            else:
                return jsonify({"success": False, "message": "Failed to add user"}), 400
        except Exception as error:
            return jsonify({"success": False, "message": str(error)}), 400

    def response_403(self):
        """
        Custom response for 403 Forbidden errors.
        """
        return jsonify({"success": False, "message": "Forbidden"}), 403
