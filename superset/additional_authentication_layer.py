from datetime import timedelta
from flask import session, current_app, request, app
from flask_login import login_user
from superset import appbuilder
from superset.app import logger
import jwt
from superset import config

MOBI_SECRET_KEY = config.MOBI_SECRET_KEY
MOBI_SECRET_KEY_OLD = config.MOBI_SECRET_KEY_OLD

#-------------------------------------------------------------------------------------------------#
#NOTE: A defaul mobi_user is created in UI, this role is given to user when logged in with jwt token
#-------------------------------------------------------------------------------------------------#
DEFAULT_MOBI_USER = "mobi_user"

def make_session_permanent():
    "It contains session of 1 hour"
    "use minutes=5 for 5 minutes"
    session.permanent = True
    app.permanent_session_lifetime = timedelta(hours=1)


def create_session_from_jwt_token():
   #"Check if url contains mobi_filter"
   #"If url contains mobi_filter, it skips Google authentication and validates the user with JWT token"

    token = request.args.get("mobi_filter")
    if token is not None:
        try:
            jwt_payload = jwt.decode(token, MOBI_SECRET_KEY_OLD, algorithms=['HS256'])
        except  Exception as e1:
            logger.exception("Token expired!",e1)
            try:
                jwt_payload = jwt.decode(token, MOBI_SECRET_KEY, algorithms=['HS256'],
                                         options={"verify_signature": False})
                extra = jwt_payload.get("extra")

                user_name= DEFAULT_MOBI_USER
                try:
                    if extra is not None:
                        user_name=extra.get("user_name")
                except Exception as e2:
                    logger.exception("Token expired!", e2)

                user = appbuilder.sm.find_user(username=user_name)
                if user:
                    make_session_permanent()
                    login_user(user, remember=False)
            except Exception as e3:
                logger.exception("Token expired!",e3)
