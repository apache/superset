# vega-event-selector

A CSS-inspired language to select, sequence, and compose DOM events into event streams.

Exports the following method:

<a name="selector" href="#selector">#</a>
vega.<b>selector</b>(<i>selector</i>[, <i>source</i>, <i>marks</i>])
[<>](https://github.com/vega/vega/blob/master/packages/vega-event-selector/src/event-selector.js "Source")

Takes an [event _selector_ string](https://vega.github.io/vega/docs/event-streams/#selector) as input and returns a parsed [event stream object](https://vega.github.io/vega/docs/event-streams/#object) definition. The optional _source_ argument takes a string indicating the source value to use by default (normally `"view"`). The optional _marks_ argument takes an object whose keys will be treated as the legal mark types, so long as the corresponding values are truthy. For more, see the [Vega Event Stream documentation](https://vega.github.io/vega/docs/event-streams).
