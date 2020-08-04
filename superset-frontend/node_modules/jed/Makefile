REPORTER = dot

test:
	@./node_modules/.bin/mocha \
		--require test/common \
		--reporter $(REPORTER) \
		--growl \
		test/tests.js

test-browser:
	@./node_modules/.bin/serve .

.PHONY: test
