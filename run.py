from app import app
import config

app.run(
    host='0.0.0.0',
    port=int(config.PANORAMIX_WEBSERVER_PORT),
    debug=config.DEBUG)

