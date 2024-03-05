from flask import session, request, redirect, url_for

from superset import app


class ClearSessionMiddleware:
    def __init__(self, app):
        self.app = app

    def __call__(self, environ, start_response):
        # Clear session before each request
        session.clear()

        # Pass control to the next middleware/application
        response = self.app(environ, start_response)
        return response


def register_middleware(app):
    app.wsgi_app = ClearSessionMiddleware(app.wsgi_app)


# Register the middleware in your Superset application configuration
app.before_first_request(register_middleware)
