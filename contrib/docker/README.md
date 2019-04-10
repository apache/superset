Superset on Docker:
===================

* `git clone git@github.com:madel-gulp/incubator-superset.git`

With examples:

* `docker-compose run -e SUPERSET_LOAD_EXAMPLES=yes --rm superset  ./docker-init.sh`

Or without examples:

* `docker-compose run --rm superset ./docker-init.sh`

Then:

* `docker-compose up`

Login:

* `http://YOUR_HOST:8088/` (Use the credentials you provided during the image build)