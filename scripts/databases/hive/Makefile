current_branch := $(shell git rev-parse --abbrev-ref HEAD)
build:
	docker build -t bde2020/hive:$(current_branch) ./
