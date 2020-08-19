build:
	DOCKER_BUILDKIT=1 docker build . --file Dockerfile_buildartifact --target artifact --output type=local,dest=.
