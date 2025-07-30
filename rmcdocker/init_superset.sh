#!/bin/sh

echo "Initializing Superset..."
superset db upgrade
superset init

echo "Creating an admin user..."
superset fab create-admin \
    --username admin \
    --firstname Superset \
    --lastname Admin \
    --email data.management@rmcare.com \
    --password "GzVfa5rWBvvHRcTOlME/ciHcAv6fsbxAuS8XW3ybUes="

echo "Superset is ready!"