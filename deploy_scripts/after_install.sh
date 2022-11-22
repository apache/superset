# Remove default config and replace with existing config'
echo "Overriding settings"
sudo rm /home/ec2-user/liq_superset/docker/pythonpath_dev/superset_config.py
sudo cp /home/ec2-user/superset_config.py /home/ec2-user/liq_superset/docker/pythonpath_dev/
sleep 5
