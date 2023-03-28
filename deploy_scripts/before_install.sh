#!/bin/bash

#create our working directory if it doesnt exist
DIR="/home/ec2-user/liq_superset"

if [ -d "$DIR" ]; then
  echo "${DIR} exists"
  cd /home/ec2-user/liq_superset
  sudo docker-compose down --timeout 60
else
  echo "Creating ${DIR} directory"
  mkdir ${DIR}
fi
