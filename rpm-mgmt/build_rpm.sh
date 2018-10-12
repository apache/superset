set -e

pushd "$(dirname "$0")"

source artifactory.sh

PACKAGE_PATH="../dist/installer"
PACKAGE_NAME="superset-installer" 

VERSION=$version
DATE=`date +'%Y%m%d'`

echo -e "# # # # # # # START : Creating RPM package Solution Installer # # # # # # #"
fpm -f -s dir -t rpm --rpm-os linux -v ${VERSION} --iteration ${DATE}_${BUILD_NUMBER} --chdir ../superset-installer -p $PACKAGE_PATH -n $PACKAGE_NAME .
echo -e "# # # # # # # # END : Creating RPM package for Solution Installer # # # # # # #"

popd > /dev/null