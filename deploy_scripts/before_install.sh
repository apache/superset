#!/bin/bash

#create our working directory if it doesnt exist
DIR="/home/ec2-user/liq_superset"
if [ -d "$DIR" ]; then
  echo "${DIR} exists"
else
  echo "Creating ${DIR} directory"
  mkdir ${DIR}
fi

# Remove default config and replace with existing config
sudo rm /home/ec2-user/liq_superset/docker/pythonpath_dev/superset_config.py
sudo cp /home/ec2-user/superset_config.py /home/ec2-user/liq_superset/docker/pythonpath_dev/
