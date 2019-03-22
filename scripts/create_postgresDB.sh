set -e
echo -e "# # # # # # # START : Dropping Postgres Database - Superset If Exists # # # # # ## #"
psql postgres -c "DROP DATABASE IF EXISTS superset"
echo -e "# # # # # # # START : Creating Postgres Database # # # # # ## #"
psql postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'superset'" | grep -q 1 || psql postgres -c "CREATE DATABASE superset"
echo -e "# # # # # # # START : Creating PostGres User# # # # # # #"
psql postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='postgresuser'" | grep -q 1 || psql postgres -c "CREATE USER postgresuser WITH PASSWORD 'pguserpassword';"