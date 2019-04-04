BIN = ./node_modules/.bin

release-patch:
	@$(call release,patch)

release-minor:
	@$(call release,minor)

release-major:
	@$(call release,major)

build:
	@$(BIN)/babel src --out-dir dist/

publish:
	git push --tags origin HEAD:master
	npm publish

define release
	@$(BIN)/babel src --out-dir dist/
	npm version $(1)
endef
