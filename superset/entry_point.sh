set -ex

 if [ "$#" -ne 0 ]; then
    exec "$@"
elif [ "$SUPERSET_ENV" = "development" ]; then
    fabmanager create-admin \
        --app superset \
        --username admin \
        --firstname admin \
        --lastname admin \
        --email $ADMIN_EMAIL \
        --password $ADMIN_PASSWORD

     # Initialize the database
    superset db upgrade

     # Create default roles and permissions
    superset init
    celery worker --app=superset.sql_lab:celery_app --pool=gevent -Ofair &
    # needed by superset runserver
    (cd superset/assets/ && npm ci)
    (cd superset/assets/ && npm run dev) &
    FLASK_ENV=development FLASK_APP=superset:app flask run -p 8088 --with-threads --reload --debugger --host=0.0.0.0

 elif [ "$SUPERSET_ENV" = "production" ]; then
    fabmanager create-admin \
        --app superset \
        --username admin \
        --firstname admin \
        --lastname admin \
        --email "$ADMIN_EMAIL" \
        --password "$ADMIN_PASSWORD"

     # Initialize the database
    superset db upgrade

     # Create default roles and permissions
    superset init
    celery worker --app=superset.sql_lab:celery_app --pool=gevent -Ofair &
    gunicorn --bind  0.0.0.0:8088 \
        --workers $((2 * $(getconf _NPROCESSORS_ONLN) + 1)) \
        --timeout 60 \
        --limit-request-line 0 \
        --limit-request-field_size 0 \
        superset:app
else
    superset --help
fi
