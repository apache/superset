#!/bin/bash
export ARTIFACTORY_USERNAME=dev-deployer
export ARTIFACTORY_PASSWORD=dev@guavus

export version=`cat ../VERSION`

MAJOR_VERSION=$(echo $version | awk -F. '{print $1}')
MINOR_VERSION=$(echo $version | awk -F. '{print $2}')
PATCH_VERSION=$(echo $version | awk -F. '{print $3}')

export RPM_ARTIFACTORY=artifacts.ggn.in.guavus.com:4245/ggn-dev-rpms/guavus/superset/release/
