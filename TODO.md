# TODO
List of TODO items for Panoramix

## Features
* **Dashboard URL filters:** `{dash_url}#fltin__fieldname__value1,value2`
* **Browser history in explore.html:** use location.hash to manage query history
* **Default slice:** choose a default slice for the dataset instead of default endpoint
* **Color hash in JS:** it'd be nice to use the same hash function for color attribution of series
    on the js side as on the python side (`panoramix.utils.color`)
* **Widget sets / chart grids:** a way to have all charts support making a series of charts and putting them in a grid.
    the same way that you can groupby for series, you could chart by. The form fieldset would be common and use
    a single field to "grid by", a limit number of chart as an N * N grid size.
* **Free form SQL editor:** Having an Airpal-like easy SQL editor
* **Advanced dashboard configuration:** define which slices are immune to which filters, how often widgets should refresh, 
    maybe this should start as a json blob...
* **Getting proper JS testing:** unit tests on the Python side are pretty solid, but now we need a test
    suite for the JS part of the site, testing all the ajax-type calls
* **Annotations layers:** allow for people to maintain data annotations, 
    attached to a layer and time range. These layers can be added on top of some visualizations as annotations.
    An example of a layer might be "holidays" or "site outages", ...
* **Worth doing? User defined groups:** People could define mappings in the UI of say "Countries I follow" and apply it
    to different datasets. For now, this is done by writing CASE-WHEN-type expression which is probably good enough.

## Easy-ish fix
* datasource in explore mode could be a dropdown
* Create a set of slices and dashboard on top of the World Bank dataset that ship with load_examples
* [sql] make "Test Connection" test further, run an actual dummy query
* [druid] Allow for post aggregations (ratios!)
* in/notin filters autocomplete

## New viz
* Animated scatter plots
* Horizon charts
* Chord diagram
* ...

## Community
* Creat a proper user documentation (started using Sphinx and boostrap...)
* Usage vid
