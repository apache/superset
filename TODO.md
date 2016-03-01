# TODO
List of TODO items for Panoramix

## Important
* **Getting proper JS testing:** unit tests on the Python side are pretty
    solid, but now we need a test suite for the JS part of the site,
    testing all the ajax-type calls
* **Viz Plugins:** Allow people to define and share visualization plugins.
    ideally one would only need to drop in a set of files in a folder and
    Panoramix would discover and expose the plugins

## Features
* **Stars:** set dashboards, slices and datasets as favorites
* **Homepage:** a page that has links to your Slices and Dashes, favorited
    content, feed of recent actions (people viewing your objects)
* **Comments:** allow for people to comment on slices and dashes
* **Dashboard URL filters:** `{dash_url}#fltin__fieldname__value1,value2`
* **Default slice:** choose a default slice for the dataset instead of
    default endpoint
* **refresh freq**: specifying the refresh frequency of a dashboard and
    specific slices within it, some randomization would be nice
* **Widget sets / chart grids:** a way to have all charts support making
    a series of charts and putting them in a grid. The same way that you
    can groupby for series, you could chart by. The form field set would be
    common and use a single field to "grid by", a limit number of chart as
    an N * N grid size.
* **Advanced dashboard configuration:** currently you can define which
    slices in a dashboard are immune to filtering.
* **Annotations layers:** allow for people to maintain data annotations,
    attached to a layer and time range. These layers can be added on top of
    some visualizations as annotations. An example of a layer might be
    "holidays" or "site outages", ...
* **Slack integration** - TBD


## Easy-ish fix
* CREATE VIEW button from SQL editor
* Test button for when editing SQL expression
* Slider form element
* datasource in explore mode could be a dropdown
* [druid] Allow for post aggregations (ratios!)
* in/notin filters autocomplete (druid)

## New viz
* Maps that use geocodes
* Time animated scatter plots
* Horizon charts
* Calendar heatmap
* Chord diagram
* ...

## Community
* Create a proper user documentation (started using Sphinx and boostrap...)
* Usage vid
