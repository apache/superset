#!/bin/bash

cd /home/ec2-user/liq_superset

docker-compose pull superset

# Start containers in detached mode
echo "Starting containers..."
docker-compose up -d
echo "Done"