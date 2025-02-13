
DATE_WITH_TIME=`date "+%Y%m%d.%H%M%S.%S"` #add %3N as we want millisecond too
IMAGE_TAG=registry.remita.net/systemspecs/remita-payment-services/technology/platform-engineering/core-platform/ramie-bi-data/apache-superset:${DATE_WITH_TIME}
echo ">>> ${IMAGE_TAG}"
# for x86_64
echo ">>> building for x86_64"
docker rmi ${IMAGE_TAG}
docker build -f RemitaDockerfile --platform=linux/amd64 --build-arg NODE_OPTIONS="--max-old-space-size=8192"  --no-cache -t "${IMAGE_TAG}"  .
#docker build --platform=linux/amd64 --build-arg NODE_OPTIONS="--max-old-space-size=8192"   -t "${IMAGE_TAG}"  .
docker push "${IMAGE_TAG}"

#echo ">>> building for non x86_64"
#DATE_WITH_TIME=`date "+%Y%m%d.%H%M%S.%S"` #add %3N as we want millisecond too
#IMAGE_TAG=registry.gitlab.com/systemspecs/remita-payment-services/technology/platform-engineering/core-platform/ramie-bi-data/apache-superset:${DATE_WITH_TIME}
#docker build --no-cache -t "${IMAGE_TAG}"  .
#docker push "${IMAGE_TAG}"
#echo "version -> ${DATE_WITH_TIME}"
