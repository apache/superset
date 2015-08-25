from app import app
import config
from subprocess import Popen

if config.DEBUG:
    app.run(
        host='0.0.0.0',
        port=int(config.PANORAMIX_WEBSERVER_PORT),
        debug=True)
else:
    cmd = (
        "gunicorn "
        "-w 8 "
        "-b 0.0.0.0:{config.PANORAMIX_WEBSERVER_PORT} "
        "app:app").format(**locals())
    print("Starting server with command: " + cmd)
    Popen(cmd, shell=True).wait()


