#!/bin/bash

cd /home/ec2-user/liq_superset

sudo docker-compose pull superset

# Start containers in detached mode
echo "Starting containers..."
sudo docker-compose up -d

sleep 300

sudo docker-compose down --timeout 60
sudo docker-compose up -d

echo "Done"