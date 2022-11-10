sudo chmod -R 777 /home/ec2-user/liq_superset
cd /home/ec2-user/liq_superset

echo "Stopping all running containers..."
docker-compose down
echo "Done"
echo "Removing container volumes..."
docker volume rm `python3 get_vol_remove.py` > /dev/null
echo "Done"
echo "Starting containers..."
docker-compose up
echo "Done"