#!/bin/bash

set -eo pipefail

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
# import deployment functions
source ./deployment.sh

# need az cli
# source .venv/bin/activate
az login --service-principal -u $ARM_CLIENT_ID -p $ARM_CLIENT_SECRET --tenant $ARM_TENANT_ID
DB_HOST=$(./keyvault.sh host $POSTGRES_KEYVAULT)
DB_USERNAME=$(./keyvault.sh username $POSTGRES_KEYVAULT)
DB_PASSWORD=$(./keyvault.sh password $POSTGRES_KEYVAULT)
SECRET_KEY=$(./keyvault.sh secretKey $POSTGRES_KEYVAULT)

source ./context.sh -g $KUBERNETES_RESOURCE_GROUP -n $KUBERNETES_CLUSTER_NAME

APP_NAME="superset"
helm_release="${APP_NAME}-release"
namespace="${APP_NAME}-namespace"
k8s_secret_name="ingress-tls"

# creates the namespace and the tls secret
source ./secrets.sh -n $namespace -s $k8s_secret_name --tls-crt $TLS_CRT --tls-key $TLS_KEY

echo "Namespace: $namespace"
echo "Helm release: $helm_release"
deploy_superset $namespace $helm_release $DOMAIN_NAME $k8s_secret_name $DB_HOST $DB_USERNAME $DB_PASSWORD $MAPBOX_API_KEY $SMTP_USER $SMTP_PASSWORD $SMTP_MAIL_FROM $SECRET_KEY