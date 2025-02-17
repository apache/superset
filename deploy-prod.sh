#!/bin/bash

if $1 == "" ; then
  echo "Please provide the image tag, format: prod-x.x.x"
  exit 1
fi

ECR_REPO=559615561845.dkr.ecr.ap-south-1.amazonaws.com
IMAGE_TAG=$1
REPO_NAME=sirus
APP_NAME=sirus
NAMESPACE=eka-prod-tools
HELM_REPO_NAME=superset
CHART_NAME=superset
VALUES_FILE=.github/workflows/values/prod-values.yaml

Dockerfile="Dockerfile_custom"

set -e
docker build -t $ECR_REPO/$REPO_NAME:$IMAGE_TAG -f $Dockerfile .

docker push $ECR_REPO/$REPO_NAME:$IMAGE_TAG

helm upgrade --install $APP_NAME $HELM_REPO_NAME/$CHART_NAME -f $VALUES_FILE -n $NAMESPACE  --set-string image.tag=$IMAGE_TAG --set-string image.repository=$ECR_REPO/$REPO_NAME  --atomic --debug --cleanup-on-fail


set +e
