# remove all exited containers
docker rm -v $(docker ps -a -q -f status=exited)
# remove unused images
docker rmi $(docker images -f "dangling=true" -q)
# docker container that removes unwanted/unused volumes
docker run -v /var/run/docker.sock:/var/run/docker.sock -v /var/lib/docker:/var/lib/docker --rm martin/docker-cleanup-volumes