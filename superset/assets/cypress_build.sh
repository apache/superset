#!/bin/bash
set -e

<<<<<<< HEAD
superset/bin/superset db upgrade
superset/bin/superset load_test_users
superset/bin/superset load_examples
superset/bin/superset init
flask run -p 8081 --with-threads --reload --debugger &

=======
>>>>>>> split into three
cd "$(dirname "$0")"

yarn install --frozen-lockfile & superset/bin/superset db upgrade
superset/bin/superset load_test_users & superset/bin/superset load_examples
superset/bin/superset init
npm run build & flask run -p 8081 --with-threads --reload --debugger &

npm run cypress run -- --spec 'cypress/integration/explore/*' & npm run cypress run -- --spec 'cypress/integration/dashboard/*' & npm run cypress run -- --spec 'cypress/integration/explore/*'
kill %1
