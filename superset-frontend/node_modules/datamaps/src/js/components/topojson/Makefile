GENERATED_FILES = \
	component.json \
	package.json \
	examples/us-10m.json \
	examples/world-50m.json \
	examples/world-110m.json \
	node_modules/us-atlas/topo/us-10m.json \
	node_modules/world-atlas/topo/world-50m.json \
	node_modules/world-atlas/topo/world-110m.json

.SECONDARY:

.PHONY: all clean test

all: $(GENERATED_FILES)

component.json: src/component.js topojson.js
	@rm -f $@
	node src/component.js > $@
	@chmod a-w $@

package.json: src/package.js topojson.js
	@rm -f $@
	node src/package.js > $@
	@chmod a-w $@

examples/us-%.json: node_modules/us-atlas/topo/us-%.json
	cp $< $@

examples/world-%.json: node_modules/world-atlas/topo/world-%.json
	cp $< $@

node_modules/us-atlas/topo/%.json:
	make topo/$(notdir $@) -C node_modules/us-atlas

node_modules/world-atlas/topo/%.json:
	make topo/$(notdir $@) -C node_modules/world-atlas

test: all
	@npm test

clean:
	rm -f -- $(GENERATED_FILES)
