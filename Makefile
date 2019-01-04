# Note for editing Makefile : Makefile requires Tab to identify commands

DOCKER_IMAGE_NAME = guavus-superset
DOCKER_IMAGE_TAG = latest

SANITIZED_APP_VERSION = $(shell echo $(APP_VERSION) | sed -e "s/\//-/g")
SANITIZED_VERSION = $(shell echo $(VERSION) | sed -e "s/\//-/g")
BUILD_NUMBER?=0
VERSION=$(BRANCH_ID)

SUPERSET_INVENTORY_FILE_PATH = ${WORKSPACE}

VERSION_WITH_BUILD= $(DOCKER_IMAGE_TAG) #$(SANITIZED_APP_VERSION)_$(BUILD_NUMBER)

SHELL := /bin/bash


docker_build:
	@echo "= = = = = = = > START TARGET : [docker_build] < = = = = = = ="
	echo $(COMMIT)“ ”  $(BRANCH_ID)“ ”$(APP_VERSION)“ “$(BUILD_NUMBER)
	#docker build -t $(DOCKER_IMAGE_NAME) .
	sh scripts/create_docker.sh
	@echo "= = = = = = = = > END TARGET : [docker_build] < = = = = = = ="

docker_tag:
	@echo "= = = = = = = > START TARGET : [docker_tag] < = = = = = = ="
	docker tag $(DOCKER_IMAGE_NAME) $(DOCKER_IMAGE_NAME):$(DOCKER_IMAGE_TAG)
	@echo $(DOCKER_IMAGE_TAG)
	@echo "= = = = = = = > END TARGET : [docker_tag] < = = = = = = ="


docker_clean:
	@echo "= = = = = = = > START TARGET : [docker_clean] < = = = = = = ="
	docker images | grep "$(DOCKER_IMAGE_NAME)" | awk '{print $$1":"$$2}' |  xargs docker rmi -f || true
	@echo "= = = = = = = > END TARGET : [docker_clean] < = = = = = = ="

update_image_tag:
	@echo $(DOCKER_IMAGE_TAG)
	@echo ${SUPERSET_INVENTORY_FILE_PATH}
	sed -i -e "s/^\(superset_image_tag*:*\).*$$/superset_image_tag: \"${DOCKER_IMAGE_TAG}\"/"  ${SUPERSET_INVENTORY_FILE_PATH}

.PHONY: publish-all publish-rpms clean dist build-rpms docker_build docker_tag docker_clean update_image_tag