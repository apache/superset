set -e

pushd "$(dirname "$0")"

rm -rf dist
mkdir -p dist/installer

PACKAGE_PATH="./dist/installer"
PACKAGE_NAME="superset-installer" 

VERSION=$1
REL=$2

echo -e "# # # # # # # START : Creating RPM package Solution Installer # # # # # # #"
fpm -f -s dir -t rpm --rpm-os linux -v ${VERSION} --iteration ${REL} --chdir ./superset-installer -p $PACKAGE_PATH -n $PACKAGE_NAME .
echo -e "# # # # # # # # END : Creating RPM package for Solution Installer # # # # # # #"

popd > /dev/null