
#!/bin/bash


# Usage examples:
# deploy_superset "app-name" "superset-namespace" "superset-release" "example.com" "tls-secret" "mapbox-api-key" "db-host" "db-username" "db-password"

# Function to deploy Superset
deploy_superset() {
    NAMESPACE="$1"
    HELM_RELEASE="$2"
    DOMAIN_NAME="$3"
    TLS_SECRET_NAME="$4"
    DB_HOST="$5"
    DB_USERNAME="$6"
    DB_PASSWORD="$7"
    MAPBOX_API_KEY="$8"
    # SMTP_USER="$9"
    # SMTP_PASSWORD="$10"
    # SMTP_MAIL_FROM="$11"
    SECRET_KEY="$13"
    # MAPBOX_API_KEY="$9"
    # SMTP_USER="$10"
    # SMTP_PASSWORD="$11"
    # SMTP_MAIL_FROM="$12"
    # SECRET_KEY="$13"
    
    echo "Namespace: $namespace"
    echo "Helm release: $helm_release"
    echo "Domain name: $DOMAIN_NAME"
    echo "TLS Secret: $TLS_SECRET_NAME"
    # Helm dependency update
    helm dependency update "../../helm/superset"
    
    # Deploy superset with override
    helm upgrade \
    -n "$NAMESPACE" \
    "$HELM_RELEASE" \
    --install \
    "../../helm/superset" \
    -f "../../helm/superset/values.yaml" \
    -f "../../helm/superset/values.override.yaml" \
    --set "extraSecretEnv.MAPBOX_API_KEY=$MAPBOX_API_KEY" \
    --set "extraEnv.BASEURL=\"https://$DOMAIN_NAME\"" \
    --set "extraSecretEnv.SMTP_USER=$SMTP_USER" \
    --set "extraSecretEnv.SMTP_PASSWORD=$SMTP_PASSWORD" \
    --set "extraSecretEnv.SMTP_MAIL_FROM=$SMTP_MAIL_FROM" \
    --set "extraSecretEnv.SECRET_KEY=$SECRET_KEY" \
    --set "supersetNode.connections.db_host=$DB_HOST" \
    --set "supersetNode.connections.db_user=$DB_USERNAME" \
    --set "supersetNode.connections.db_pass=$DB_PASSWORD" \
    --set "ingress.tls[0].secretName=$TLS_SECRET_NAME" \
    --set "ingress.tls[0].hosts[0]=\"$DOMAIN_NAME\"" \
    --set "ingress.hosts[0]=\"$DOMAIN_NAME\"" \
    --debug
}
