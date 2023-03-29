#!/bin/bash

cd /home/ec2-user/liq_superset

sudo docker-compose pull superset

# Start containers in detached mode
echo "Starting containers..."
sudo docker-compose up -d

webpack_finish=$(docker-compose logs | grep "\[webpack.Progress\] 100%" | wc -l)
node_exit=$(docker-compose ps | grep "superset_node" | grep "Exit" | wc -l)

while [ $webpack_finish -le 1 ] && [ $node_exit -le 1 ]
do
  webpack_finish=$(docker-compose logs | grep "\[webpack.Progress\] 100%" | wc -l)
  node_exit=$(docker-compose ps | grep "superset_node" | grep "Exit" | wc -l)
  sleep 5
done

sudo docker-compose down
sudo docker-compose up -d

echo "Done"