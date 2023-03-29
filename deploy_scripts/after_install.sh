#!/bin/bash

# Remove default config and replace with existing config
echo "Overriding settings"
sudo rm -f /home/ec2-user/liq_superset/docker/pythonpath_dev/superset_config.py
sudo rm -f /home/ec2-user/liq_superset/docker/.env
sudo rm -f /home/ec2-user/liq_superset/superset-frontend/liq_viz_plugins/liq_secrets.js
sudo rm -rf /home/ec2-user/liq_superset/superset-frontend/liq_viz_plugins/liq_data
sudo cp /home/ec2-user/superset_config.py /home/ec2-user/liq_superset/docker/pythonpath_dev/
sudo cp /home/ec2-user/.env /home/ec2-user/liq_superset/docker/
sudo cp /home/ec2-user/liq_secrets.js /home/ec2-user/liq_superset/superset-frontend/liq_viz_plugins/
sudo cp -R /home/ec2-user/liq_data /home/ec2-user/liq_superset/superset-frontend/liq_viz_plugins/
sleep 5