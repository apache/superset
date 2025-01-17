# superset_config.py

# ---------------------------------------------------------
# This is a superset in inframe auth implementation prototype
# --------------------------------------------------------
from flask import current_app, request, jsonify
from flask_wtf.csrf import generate_csrf
from superset.security import SupersetSecurityManager
from flask import current_app, request, jsonify
from flask_login import login_user
import jwt
import datetime
from flask_cors import CORS

class CustomSecurityManager(SupersetSecurityManager):
    def __init__(self, appbuilder):
        super().__init__(appbuilder)

    def create_org_role(self, org_id):
        """Create a role for an organization if it doesn't exist"""
        role_name = f"org_{org_id}"
        role = self.find_role(role_name)
        if not role:
            role = self.add_role(role_name)
            # Inherit Gamma permissions
            gamma_role = self.find_role("Gamma")
            for perm in gamma_role.permissions:
                self.add_permission_role(role, perm)
        return role

    def create_org_user(self, username, org_id, email=None):
        """Create a user with organization-specific role"""
        user = self.find_user(username=username)
        if not user:
            org_role = self.create_org_role(org_id)
            user = self.add_user(
                username=username,
                email=username,
                first_name="",
                last_name="",
                role=org_role,
            )
        return user


def custom_init_app(app):
    CORS(app,
     resources={r"/api/v1/security/*": {"origins": ["http://localhost:7777","https://next-staging.upmetrics.com"],
                                      "supports_credentials": True}},
     allow_headers=["Content-Type", "Authorization"],
     expose_headers=["Content-Type", "Authorization"])

    def security_endpoints():

        @app.route('/api/v1/security/guest_token/<username>/<org_id>', methods=['GET'])
        def get_guest_token(username, org_id):
            sm = current_app.appbuilder.sm
            user = sm.create_org_user(username, org_id)

            token = jwt.encode(
                {
                    'username': username,
                    'org_id': org_id,
                    'exp': datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=24)
                },
                current_app.config['SECRET_KEY'],
                algorithm='HS256'
            )
            return jsonify({'token': token})

        @app.route('/api/v1/security/authenticate', methods=['GET'])
        def authenticate_token():
            token = request.args.get('token')
            if not token:
                return jsonify({'error': 'Token is required'}), 401

            try:
                payload = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
                username = payload['username']

                sm = current_app.appbuilder.sm
                user = sm.find_user(username=username)

                if user:
                    login_user(user)
                    return jsonify({'message': 'Logged in successfully', 'username': username})

            except jwt.ExpiredSignatureError:
                return jsonify({'error': 'Token has expired'}), 401
            except jwt.InvalidTokenError:
                return jsonify({'error': 'Invalid token'}), 401

            return jsonify({'error': 'User not found'}), 404

        # @app.route('/api/v1/security/csrf_token', methods=['GET'])
        # def csrf_token():
        #     token = generate_csrf()
        #     return jsonify({
        #         'result': token
        #     })

        @app.route('/api/v1/security/create_user', methods=['POST'])
        def create_user():
            if not request.is_json:
                return jsonify({'error': 'Request must be JSON'}), 400

            data = request.json
            sm = current_app.appbuilder.sm

            user = sm.find_user(username=data.get('username'))
            if user:
                return jsonify({'error': 'User already exists'}), 400

            try:
                user = sm.add_user(
                    username=data.get('username'),
                    first_name=data.get('first_name', ''),
                    last_name=data.get('last_name', ''),
                    email=data.get('email', ''),
                    role=sm.find_role('Gamma')
                )
                return jsonify({
                    'message': 'User created successfully',
                    'username': user.username
                })
            except Exception as e:
                return jsonify({'error': str(e)}), 500

    with app.app_context():
        security_endpoints()

CUSTOM_SECURITY_MANAGER = CustomSecurityManager
FLASK_APP_MUTATOR = custom_init_app
HTTP_HEADERS = {'X-Frame-Options': 'ALLOWALL'}
SESSION_COOKIE_SAMESITE = None
#SESSION_COOKIE_HTTPONLY = False
SESSION_COOKIE_SECURE = True

TALISMAN_ENABLED = False

TALISMAN_CONFIG = {
    "content_security_policy": {
        "frame-ancestors": ["http://localhost:7777", "*.upmetrics.com"],
    },
    "session_cookie_secure": False
}

FEATURE_FLAGS = {
    'DASHBOARD_RBAC': True,
    "EMBEDDED_SUPERSET": True,
}
