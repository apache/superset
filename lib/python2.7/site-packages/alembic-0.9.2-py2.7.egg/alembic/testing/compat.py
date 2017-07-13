def get_url_driver_name(url):
    if '+' not in url.drivername:
        return url.get_dialect().driver
    else:
        return url.drivername.split('+')[1]


def get_url_backend_name(url):
    if '+' not in url.drivername:
        return url.drivername
    else:
        return url.drivername.split('+')[0]

