# moving docker files to root
cp ./docker/{docker-build.sh,docker-compose.yml,docker-entrypoint.sh,docker-init.sh,Dockerfile} .
cp ./docker/superset_config.py superset/

bash -x docker-build.sh

# deleting moved files
rm -rf ./{docker-build.sh,docker-compose.yml,docker-entrypoint.sh,docker-init.sh,Dockerfile}
rm -rf ./superset/superset_config.py