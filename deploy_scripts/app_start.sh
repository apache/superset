#!/bin/bash
sudo chmod -R 777 /home/ec2-user/liq_superset

cd /home/ec2-user/liq_superset

echo "Starting containers..."
docker-compose up -d
echo "Done"