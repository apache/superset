# ogr2ogr doesn’t support logical (L) or date (D) properties (apparently),
# so boolean-property and date-property were made by hand in a hex editor.

TESTS = \
	empty \
	mixed-properties \
	multipoints \
	null \
	number-property \
	points \
	polygons \
	polylines \
	string-property \
	latin1-property \
	utf8-property

TEST_FILES = \
	$(addprefix test/,$(addsuffix .shp,$(TESTS))) \
	$(addprefix test/,$(addsuffix .dbf,$(TESTS)))

all: node_modules $(TEST_FILES)

clean:
	rm -f $(TEST_FILES)

node_modules:
	npm install

test/%.shp test/%.dbf: test/%.json
	rm -f $@ && ogr2ogr -f 'ESRI Shapefile' $@ $<

test/utf8-property.shp test/utf8-property.dbf: test/utf8-property.json
	rm -f $@ && ogr2ogr -lco ENCODING=UTF-8 -f 'ESRI Shapefile' $@ $<

test/latin1-property.shp test/latin1-property.dbf: test/latin1-property.json
	rm -f $@ && ogr2ogr -f 'ESRI Shapefile' $@ $<

test: all
	node_modules/.bin/vows
	@echo
