#!/bin/bash

#generate our secret key
export SUPERSET_FLASK_SECRET=$(openssl rand -base64 64)

#create our working directory if it doesnt exist
DIR="/home/ec2-user/liq_superset"
if [ -d "$DIR" ]; then
  echo "${DIR} exists"
else
  echo "Creating ${DIR} directory"
  mkdir ${DIR}
fi