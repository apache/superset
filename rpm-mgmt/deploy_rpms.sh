#!/usr/bin/env bash
# Pushes the generated rpms to artifactory
#
# Usage:
#     sh deploy_rpms.sh
#
#	  rpm must have been generated first. Run make publish-rpms 

set -e

pushd "$(dirname "$0")"

source artifactory.sh

INSTALLER_RPM=`ls ../dist/installer`


print_lines(){
    for i in `seq 1 4`;
    do
        echo " # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # #"
    done
}

echo "Pushing rpm for superset solution installer to artifactory"
curl --user $ARTIFACTORY_USERNAME:$ARTIFACTORY_PASSWORD -X PUT "$RPM_ARTIFACTORY/" -T ../dist/installer/$INSTALLER_RPM
echo "Published RPM for superset solution installer successfully"


popd