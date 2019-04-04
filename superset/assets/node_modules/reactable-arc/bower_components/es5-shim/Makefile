
.PHONY: verify-tag verify-changes release

default: release

verify-tag:
ifndef TAG
	$(error TAG is undefined)
endif

CHANGES_ERROR = $(error No CHANGES specified)

verify-changes:
	@ (git status -sb --porcelain | \grep -E '^( M|M ) CHANGES' > /dev/null) || (echo no CHANGES specified && exit 2)

release: verify-changes verify-tag
	@ OLD_TAG=`git describe --abbrev=0 --tags` && \
		npm run minify && \
		replace "$${OLD_TAG/v/}" "$(TAG)" -- *.min.js *.json README.md && \
		replace "blob/master" "blob/v$(TAG)" -- *.min.js && \
		git commit -m "v$(TAG)" *.js *.map *.json README.md CHANGES && \
		git tag "v$(TAG)"

