# Steps to deploy manu3loq/caravel

### Pre-requisites:

* git
* node and npm
* python
* pip
* virtualenv
* apache2 (with mod_wsgi and mod_substitute enabled, use a2enmod)
* citusdb

### Note:

* This guide might be missing some steps(like cd in to directory etc.)
* Please make sure you run commands under the correct context
* All commands relating to `/var/` and `apache2` are to be run as root

### Steps:
----------

Clone the repo in your local
```
git clone git@github.com:manu3loq/caravel.git
```

Setup virtualenv and activate it
```
virtualenv env && source env/bin/activate
```

Install front-end dependencies and compile css and js assets
```
cd caravel/assets && npm install && npm run prod
```

Bulid a source distribution of the project
```
python setup.py sdist
```

Put the generated tar file(`dist/*`) on the server

Create a folder under `/var/www/` and activate virtualenv
```
cd /var/www/<your folder> && sudo -s && virtualenv env && source env/bin/activate
```

Install the tar file

```
pip install /location/to/tar/file
```

Copy over the wsgi file to the server

```python
#!/usr/bin/python
import os
import sys
import site
import logging

# Add virtualenv site packages
site.addsitedir(os.path.join(os.path.dirname(__file__), 'env/lib/python2.7/site-packages'))

# Change path names below
sys.path.insert(0,"/var/www/<your folder name>/")
sys.path.insert(1,"/var/www/<your folder name>/env/lib/python2.7/site-packages/")
sys.path.insert(2,"/var/www/<your folder name>/env/lib/python2.7/site-packages/caravel/")
 
# Fired up virtualenv before include application
activate_env = os.path.expanduser(os.path.join(os.path.dirname(__file__), 'env/bin/activate_this.py'))
execfile(activate_env, dict(__file__=activate_env))

logging.basicConfig(stream=sys.stderr)

from caravel import app as application
application.secret_key = 'thisismysecretkey3loqcaravel'
```

> Change path names in the wsgi file accordingly

Create an Apache conf file in `/etc/apache2/sites-available/`

```apache
<VirtualHost *:80>
    # Change accordingly
    ServerName example.com
    ServerAdmin admin@3loq.com
    
    # Change the path name
    WSGIScriptAlias / /var/www/<your folder name>/<your file name>.wsgi
    Substitute "s|\/static(\/\w+)|$1|i"
    
    # Change the path names
    Alias /assets /var/www/<your folder name>/env/lib/python2.7/site-packages/caravel/static
    Alias /appbuilder /var/www/<your folder name>/env/lib/python2.7/site-packages/flask_appbuilder/static
    ErrorLog ${APACHE_LOG_DIR}/error.log
    LogLevel debug
    CustomLog ${APACHE_LOG_DIR}/access.log combined
</VirtualHost>
```
> Change path names accordingly

Link this file in `/etc/apache2/sites-enabled`

Enable this site

```
a2ensite <yoursitename>.conf && service apache2 reload
```
Link the citusdb pid file to `/var/run/postgresql`
> Make sure postgresql is not running

```
ln -s /tmp/.s.PGSQL.5432 /var/run/postgresql
```
Initiate caravel from project root env in `/var/www/`

```
caravel db upgrade && caravel init && fabmanager create-admin --app caravel
```
