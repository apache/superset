#!/bin/bash

set -eo pipefail
# Default values if not provided as arguments
namespace="superset-namespace"
k8s_secret_name=""
crt_path="./tls.crt"
key_path="./tls.key"
TLS_CRT=""
TLS_KEY=""

# Function to display usage instructions
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo "Options:"
    echo "  -n, --namespace           Kubernetes Namespace"
    echo "  -s, --k8s-secret-name     Kubernetes Secret Name"
    echo "  --tls-crt                 Base64-encoded TLS Certificate"
    echo "  --tls-key                 Base64-encoded TLS Key"
    exit 1
}

# Parse command-line arguments
while [[ $# -gt 0 ]]; do
    key="$1"
    case $key in
        -n|--namespace)
            namespace="$2"
            shift 2
            ;;
        -s|--k8s-secret-name)
            k8s_secret_name="$2"
            shift 2
            ;;
        --tls-crt)
            TLS_CRT="$2"
            shift 2
            ;;
        --tls-key)
            TLS_KEY="$2"
            shift 2
            ;;
        *)
            usage
            ;;
    esac
done

# Check if required arguments are provided
if [ -z "$namespace" ] || [ -z "$k8s_secret_name" ] || [ -z "$TLS_CRT" ] || [ -z "$TLS_KEY" ]; then
    echo "Error: Missing required arguments."
    usage
fi


# NAMESPACE
echo "Namespace: $namespace"
if kubectl get namespace "$namespace" >/dev/null 2>&1; then
    echo "Namespace $namespace already exists"
else
    echo "Creating namespace $namespace"
    kubectl create namespace "$namespace"
fi

# SECRET
echo $TLS_CRT | base64 -d >> $crt_path
echo $TLS_KEY | base64 -d >> $key_path
if kubectl get secret "$k8s_secret_name" -n "$namespace" > /dev/null 2>&1; then
    echo "Secret $k8s_secret_name already exists."
    #  # Update secret
    #  kubectl create secret tls "$k8s_secret_name" \
    #  --cert="$crt_path" \
    #  --key="$key_path" \
    #  --namespace="$namespace" \
    #  --dry-run=client -o yaml | kubectl apply -f -
    #  echo "Secret $k8s_secret_name updated."
else
    # create secret if not exists
    kubectl create secret tls "$k8s_secret_name" \
    --cert="$crt_path" \
    --key="$key_path" \
    --namespace "$namespace"
    echo "Secret $k8s_secret_name created."
fi