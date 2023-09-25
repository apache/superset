GIT_ROOT := $(shell git rev-parse --show-toplevel)
INFRA_ROOT := ${GIT_ROOT}/infra
VERSION ?= local
RELEASE_VERSION ?= alpha-0.0.1

deploy-infra: set-kubectl-context

deploy-infra-dev: set-kubectl-context-dev

ecr-login-dev:
	aws ecr get-login-password --region ap-southeast-1 | docker login --username AWS --password-stdin 975226449092.dkr.ecr.ap-southeast-1.amazonaws.com

set-kubectl-context:
	kubectl config use-context docker-desktop

set-kubectl-context-dev:
	aws eks update-kubeconfig --region ap-southeast-1 --name kuwago-dev-eks