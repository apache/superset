# TODO
List of TODO items for Panoramix

## Deep changes
* Use NPM for js management
* Use `requires`
* **Getting proper JS testing:** unit tests on the Python side are pretty solid, but now we need a test suite for the JS part of the site, testing all the ajax-type calls

## Features
* **Homepage:** a page that has links to your Slices and Dashes, favorited
    content, feed of recent actions (people viewing your objects)
* **Stars:** set dashboards, slices and datasets as favorites
* **Comments:** allow for people to comment on slices and dashes
* **Dashboard URL filters:** `{dash_url}#fltin__fieldname__value1,value2`
* **Default slice:** choose a default slice for the dataset instead of default endpoint
* **refresh freq**: specifying the refresh frequency of a dashboard and specific slices within it, some randomization would be nice
* **Widget sets / chart grids:** a way to have all charts support making a series of charts and putting them in a grid.
    the same way that you can groupby for series, you could chart by. The form fieldset would be common and use
    a single field to "grid by", a limit number of chart as an N * N grid size.
* **Advanced dashboard configuration:** define which slices are immune to which filters, how often widgets should refresh,
    maybe this should start as a json blob...
* **Annotations layers:** allow for people to maintain data annotations,
    attached to a layer and time range. These layers can be added on top of some visualizations as annotations.
    An example of a layer might be "holidays" or "site outages", ...
* **Worth doing? User defined groups:** People could define mappings in the UI of say "Countries I follow" and apply it to different datasets. For now, this is done by writing CASE-WHEN-type expression which is probably good enough.
* **Slack integration** - TBD


## Easy-ish fix
* CREATE VIEW button from SQL editor
* Test button for when editing SQL expression
* Slider form element
* datasource in explore mode could be a dropdown
* Create a set of slices and dashboard on top of the World Bank dataset that ship with load_examples
* [sql] make "Test Connection" test further, run an actual dummy query
* [druid] Allow for post aggregations (ratios!)
* in/notin filters autocomplete

## New viz
* Maps that use geocodes
* Time animated scatter plots
* Horizon charts
* Chord diagram
* ...

## Community
* Creat a proper user documentation (started using Sphinx and boostrap...)
* Usage vid
