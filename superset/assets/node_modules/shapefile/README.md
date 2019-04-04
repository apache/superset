# Streaming Shapefile Parser

Based on the [ESRI Shapefile Technical Description](http://www.esri.com/library/whitepapers/pdfs/shapefile.pdf) and [dBASE Table File Format](http://www.digitalpreservation.gov/formats/fdd/fdd000325.shtml).

Caveat emptor: this library is a work in progress and does not currently support all shapefile geometry types (see [shp.js](https://github.com/mbostock/shapefile/blob/master/shp.js) for details). It also only supports dBASE III and has no error checking. Please contribute if you want to help!

## Reading a Shapefile

<a name="read" href="#read">#</a> shapefile.<b>read</b>(<i>filename</i>[, <i>options</i>], <i>callback</i>)

A convenience API for reading an entire shapefile in one go. Use this method if you don’t mind putting the whole shapefile in memory; use <a href="#reader">reader</a> instead if you want to process records individually. The specified *callback* with two arguments:

* *error* - the error, if any
* *collection* - a [GeoJSON feature collection](http://geojson.org/geojson-spec.html#feature-collection-objects)

The *collection* has a `bbox` property containing representing the bounding box of all records in this shapefile. The bounding box is specified as [xmin, ymin, xmax, ymax], where *x* and *y* represent longitude and latitude in spherical coordinates.

## Streaming a Shapefile

<a name="reader" href="#reader">#</a> shapefile.<b>reader</b>(<i>filename</i>[, <i>options</i>])

The main API for reading a shapefile. The supported options are:

* *encoding* - the DBF encoding (defaults to ISO-8859-1)
* *ignore-properties* - if true, don’t read properties (faster; defaults to false)

This method returns a reader object.

<a name="reader_readHeader" href="#reader_readHeader">#</a> reader.<b>readHeader</b>(<i>callback</i>)

Reads the shapefile header, invoking the specified *callback* with two arguments:

* *error* - the error, if any
* *header* - the header object

The *header* object is simply an object with a `bbox` property representing the bounding box of all records in this shapefile. The bounding box is specified as [xmin, ymin, xmax, ymax], where *x* and *y* represent longitude and latitude in spherical coordinates.

<a name="reader_readRecord" href="#reader_readRecord">#</a> reader.<b>readRecord</b>(<i>callback</i>)

Reads the next shapefile record, invoking the specified *callback* with two arguments:

* *error* - the error, if any
* *record* - the record object, or <a href="#end">shapefile.end</a>

The *record* object is a [GeoJSON feature](http://geojson.org/geojson-spec.html#feature-objects). (GeoJSON objects are the standard representation of geometry in JavaScript, and they are convenient. If you want to access the shapefile primitives directly, use the private [shp](https://github.com/mbostock/shapefile/blob/master/shp.js) and [dbf](https://github.com/mbostock/shapefile/blob/master/dbf.js) classes instead.)

If there are no more records in this shapefile, the *record* is the special value <a href="#end">shapefile.end</a>.

<a name="reader_close" href="#reader_close">#</a> reader.<b>close</b>(<i>callback</i>)

Closes the underlying files for this reader. You should call this when you are done reading. If an error occurs during <a href="#reader_readHeader">readHeader</a> or <a href="#reader_readRecord">readRecord</a>, the reader will be closed automatically.

<a name="end" href="#end">#</a> shapefile.<b>end</b>

A sentinel value used <a href="#reader_readRecord">readRecord</a> to indicate that the end of the file has been reached, and no more records are available. (Note that if the end of file is reached when <a href="#reader_readHeader">readHeader</a> is called, this is considered an error because the header is required by the shapefile format.)
