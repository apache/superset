#!/bin/bash
DIR="/home/ec2-user/liq_superset"
if [-d "$DIR" ]; then
    echo "Stopping app..."
    cd /home/ec2-user/liq_superset
    docker-compose down
    echo "Done"
    echo "Removing container volumes..."
    docker volume rm `python3 get_vol_remove.py` > /dev/null
    echo "Done"
fi