#!/bin/bash

# Check if both arguments are provided
if [ $# -ne 2 ]; then
  echo "Usage: $0 <secret_name> <vault_name>"
  exit 1
fi

secret_name="$1"
vault_name="$2"

# Use Azure CLI to retrieve the secret
secret_value=$(az keyvault secret show --name "$secret_name" --vault-name "$vault_name" --query "value" --output tsv)

# Check if the secret retrieval was successful
if [ $? -eq 0 ]; then
  echo "$secret_value"
else
  echo "Error: Unable to retrieve the secret."
  exit 2
fi