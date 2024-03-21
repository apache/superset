from flask import request, jsonify
from flask_appbuilder.api import expose, protect, safe

from superset.views.base import BaseSupersetView


class CustomUserAPI(BaseSupersetView):
    allow_browser_login = True

    route_base = '/api/v1/'

    @expose("/add_user/", methods=("POST",))
    @safe
    def add_user(self):
        try:
            body = request.json
            username = body.get("username")
            first_name = body.get("first_name")
            last_name = body.get("last_name")
            email = body.get("email")
            # is_active = body.get("active", True)

            # Ensure role exists and is valid
            role = self.appbuilder.sm.find_role("EkaUser")
            if not role:
                return jsonify({"success": False, "message": "Role not found"}), 400

            # Create user with the specified role
            user = self.appbuilder.sm.add_user(username, first_name, last_name, email,
                                               role)
            if user:
                return jsonify(
                    {"success": True, "message": f"{user.username} added successfully"}), 200
            else:
                return jsonify({"success": False, "message": f"Failed to add user {user.username}"}), 400
        except Exception as error:
            return jsonify({"success": False, "message": str(error)}), 400

    @expose("/update_user_role/", methods=("POST",))
    @safe
    def update_user_role(self):
        try:
            body = request.json
            username = body.get("username")
            new_role_name = body.get("role_name")

            # Find the user
            user = self.appbuilder.sm.find_user(username=username)
            if not user:
                return jsonify({"success": False, "message": "User not found"}), 400

            # Find the new role
            new_role = self.appbuilder.sm.find_role(new_role_name)
            if not new_role:
                return jsonify({"success": False, "message": "Role not found"}), 400

            # Update the user's roles
            user.roles = [new_role]
            self.appbuilder.sm.update_user(user)

            return jsonify({"success": True,
                            "message": f"{user.username}'s role updated to {new_role_name}"}), 200
        except Exception as error:
            return jsonify({"success": False, "message": str(error)}), 400

    def response_403(self):
        """
        Custom response for 403 Forbidden errors.
        """
        return jsonify({"success": False, "message": "Forbidden"}), 403
