#!/bin/bash
sudo chmod -R 777 /home/ec2-user/liq_superset

cd /home/ec2-user/liq_superset

docker-compose stop
docker-compose down
docker-compose pull superset

# Start containers in detached mode
echo "Starting containers..."
docker-compose up -d
sleep 60
docker-compose down
sleep 5
docker-compose up -d
echo "Done"