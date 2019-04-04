BIN=node_modules/.bin

MOCHA_ARGS=	--compilers js:babel/register \
			--recursive

MOCHA_TARGET=src/__tests__

build:
	$(BIN)/babel src --ignore __tests__ --out-dir lib

clean:
	rm -rf lib

test:
	NODE_ENV=test $(BIN)/mocha $(MOCHA_ARGS) $(MOCHA_TARGET)

test-watch:
	NODE_ENV=test $(BIN)/mocha $(MOCHA_ARGS) -w $(MOCHA_TARGET)

lint:
	$(BIN)/eslint src

PHONY: build clean test test-watch lint
