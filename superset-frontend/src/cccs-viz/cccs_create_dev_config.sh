#!/bin/bash

# Script to create development superset configuration
# docker-compose picks up local config in this file
# docker/pythonpath_dev/superset_config_docker.py
# This script creates this file by combining the contents of
# sql_query_mutator.py found in the hogwarts-superset-deployment
# git repo (you have to clone it beforehand)
# It combines that file with the configs below "Adding dev configs"


# determine directory of this script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

CONFIG_FILE=$DIR/../../docker/pythonpath_dev/superset_config_docker.py

read -p 'Enter path hogwarts-superset-deployment/config/sql_query_mutator.py file: ' SQL_QUERY_MUTATOR_FILE

echo "Adding $SQL_QUERY_MUTATOR_FILE content"
echo "to $CONFIG_FILE"
cat $SQL_QUERY_MUTATOR_FILE > $CONFIG_FILE

echo "Adding dev configs"
cat >> $CONFIG_FILE <<'_EOF'
SQL_QUERY_MUTATOR = sql_query_mutator 
DEFAULT_EXPLORER_VIZ = 'hello_world'
FEATURE_FLAGS = {
    "ENABLE_TEMPLATE_PROCESSING": True,
    "DASHBOARD_NATIVE_FILTERS": True,
    "DASHBOARD_CROSS_FILTERS": True,
    "DASHBOARD_NATIVE_FILTERS_SET": True,
    "ENABLE_EXPLORE_DRAG_AND_DROP": True,
    "DASHBOARD_RBAC": True,
}
_EOF
