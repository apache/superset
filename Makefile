TAG ?= ui_changes

NPM_BUILD_CMD ?= build

.PHONY: build push help

.DEFAULT_GOAL := help

## build_superset
build_superset:
	docker build -t "blotoutlabs/blotout:superset-$(TAG)" ./ -f ./Dockerfile --build-arg NPM_BUILD_CMD=${NPM_BUILD_CMD}

## push_superset
push_superset: build_superset
	docker push "blotoutlabs/blotout:superset-$(TAG)"

help : Makefile
	@sed -n 's/^##//p' $<