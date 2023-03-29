#!/bin/bash

#create our working directory if it doesnt exist
DIR="/home/ec2-user/liq_superset"

if [ -d "$DIR" ]; then
  echo "${DIR} exists"
  cd /home/ec2-user/liq_superset
  sudo docker-compose down --timeout 60
  # Remove unnecessary volumes
  sudo docker volume rm $(docker volume ls | grep -v -e superset_db_home | tr -d " \t" | sed -E -e "s/local|DRIVER.*//")
  # Remove assets
  sudo rm -rf /home/ec2-user/liq_superset/superset/static/assets/*
else
  echo "Creating ${DIR} directory"
  mkdir ${DIR}
fi
