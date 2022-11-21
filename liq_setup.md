# Windows

1. Set up WSL 2
2. [Install docker](https://docs.docker.com/engine/install/ubuntu/) and docker compose on WSL, can also use other linux distros
2. In WSL, pull git repo into WSL storage, not Windows mounted storage
3. cd into superset folder
4. In superset/docker/ add a file called requirements-local.txt and add databricks-sql-connector & sqlalchemy-databricks on separate lines
5. In superset/docker/docker-init.sh, move "/app/docker/docker-bootstrap.sh" command to the bottom of the file
6. In superset/docker/docker-frontend.sh, add "export NODE_OPTIONS=--max_old_space_size=2048" to give node more memory
7. in superset/ run docker compose up
