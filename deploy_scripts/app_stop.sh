#!/bin/bash
# Stop running containers and remove volumes except superset_db
DIR="/home/ec2-user/liq_superset"
if [-d "$DIR" ]; then
    echo "Stopping app..."
    cd /home/ec2-user/liq_superset
    docker-compose down
    echo "Done"
    echo "Removing container volumes..."
    docker volume rm `docker volume ls | grep -v -e superset_db_home | tr -d " \t" | sed -E -e "s/local|DRIVER.*//" | tr "\n" " " | sed 's/^ *//g'`
    echo "Done"
fi