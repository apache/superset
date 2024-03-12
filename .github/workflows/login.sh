#!/bin/bash

usage() {
    echo "Usage: $0 -e ENV_PATH"
    exit 1
}


while [[ $# -gt 0 ]]; do
    case "$1" in
        -e)
            ENV_PATH="$2"
            shift 2
        ;;
        *)
            usage
        ;;
    esac
done

# Vérifier si les arguments obligatoires sont définis
if [ -z "$ENV_PATH" ]; then
    echo "Error: Missing required arguments."
    usage
fi
# export env variables
export $(grep -v '^#' $ENV_PATH | xargs)
az login --service-principal -u $ARM_CLIENT_ID -p $ARM_CLIENT_SECRET --tenant $ARM_TENANT_ID