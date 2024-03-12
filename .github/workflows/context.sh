#!/bin/bash

usage() {
    echo "Usage: $0 [OPTIONS]"
    echo "Options:"
    echo "  -g, --kubernetes-ressource-group    AKS ressource group name"
    echo "  -n, --kubernetes-cluster-name       AKS cluster name"
    exit 1
}

KUBERNETES_RESOURCE_GROUP=""
KUBERNETES_CLUSTER_NAME=""

# Analyser les arguments de la ligne de commande
while [[ $# -gt 0 ]]; do
    key="$1"
    case $key in
        -g|--kubernetes-ressource-group)
            KUBERNETES_RESOURCE_GROUP="$2"
            shift 2
        ;;
        -n|--kubernetes-cluster-name)
            KUBERNETES_CLUSTER_NAME="$2"
            shift 2
        ;;
        *)
            usage
        ;;
    esac
done

# Check if required arguments are provided
if [ -z "$KUBERNETES_RESOURCE_GROUP" ] || [ -z "$KUBERNETES_CLUSTER_NAME" ]; then
    echo "Error: Missing required arguments."
    usage
fi

echo $KUBERNETES_RESOURCE_GROUP
echo $KUBERNETES_CLUSTER_NAME

# Get AKS credentials and connect to cluster
az aks get-credentials \
    --resource-group $KUBERNETES_RESOURCE_GROUP \
    --name $KUBERNETES_CLUSTER_NAME