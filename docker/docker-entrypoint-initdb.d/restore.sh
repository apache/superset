#!/bin/bash
set -e

# Restore the database from the dump file
# Define the file name
file="/docker-entrypoint-initdb.d/remote_database.dump"

if [ -e "$file" ]; then
    echo "The file '$file' exists. Restoring the database from the dump file"
    psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < $file
else
    echo "The file '$file' does not exist."
fi
