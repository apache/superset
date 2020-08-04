# d3-sankey-diagram

[![Build Status](https://travis-ci.org/ricklupton/d3-sankey-diagram.svg?branch=master)](https://travis-ci.org/ricklupton/d3-sankey-diagram)

[Sankey diagrams](https://en.wikipedia.org/wiki/Sankey_diagram) show flows between processes or relationships between sets. This library, is a [reusable d3 diagram](https://bost.ocks.org/mike/chart/) featuring:
- automatic layout
- multiple types of flow
- loops / reversed flows
- flow routing across layers

See the **[demo](https://ricklupton.github.io/d3-sankey-diagram)** for examples of these.

d3-sankey-diagram versions v0.6 and up are based on d3 v4.

## Installation

Install using npm if you are using browserify or the like:
```js
npm install d3-sankey-diagram
```

Or download the [standalone bundle](https://github.com/ricklupton/d3-sankey-diagram/releases/latest) and include in your page as
```html
<script src="d3-sankey-diagram.js" charset="utf-8"></script>
```

## Usage

```js
var layout = d3.sankey()
               .extent([[100, 10], [840, 580]]);

var diagram = d3.sankeyDiagram()
                .linkColor(function(d) { return d.color; });

d3.json('uk_energy.json', function(energy) {
  layout.ordering(energy.order);
  d3.select('#sankey')
      .datum(layout(energy))
      .call(diagram);
});
```

Try more [live examples](https://ricklupton.github.io/d3-sankey-diagram).

If you use the Jupyter notebook, try
[ipysankeywidget](https://github.com/ricklupton/ipysankeywidget).

`d3-sankey-diagram` works both in node (using jsdom) and in the browser.

## Contributing 🎁

Thanks for your interest in contributing! To get started see [CONTRIBUTING.md](CONTRIBUTING.md) and our [code of
conduct](CODE_OF_CONDUCT.md). We have a [Roadmap](https://github.com/ricklupton/d3-sankey-diagram/projects/1) showing what we
are working on, and you can browse the list of [good first issues](https://github.com/ricklupton/d3-sankey-diagram/labels/good%20first%20bug) for ideas.

## Documentation
d3-sankey-diagram is a JavaScript library for creating [Sankey diagrams](https://en.wikipedia.org/wiki/Sankey_diagram) using [d3](https://d3js.org/). See the [live examples](https://ricklupton.github.io/d3-sankey-diagram) to get an idea of what it does.

The main high-level components:
- [d3.sankey](#sankey): Sankey layout
- [d3.sankeyDiagram](#sankeyDiagram): SVG Sankey diagram component

Lower-level components:
- [d3.sankeyNode](#sankeyNode): SVG Sankey node component
- [d3.sankeyLink](#sankeyLink): SVG path generator for Sankey diagram links
- [d3.sankeyLinkTitle](#sankeyLinkTitle): Helper function to generate link titles

### Sankey layout

<a name="sankey" href="#sankey">#</a> <b>sankey</b>()

Creates a new Sankey layout component.

<a name="layout" href="#layout">#</a> <b>layout</b>(<i>arguments...</i>)

Apply the layout to the given <i>arguments</i>. The <i>arguments</i> are
arbitrary; they are simply propagated to the accessor functions
[nodes](#layout-nodes) and [links](#layout-links).

```js
var layout = d3.sankey();

var graph = layout({
  nodes: [
    {"id": "a", "title": "Source"},
    {"id": "b", "title": "Stage 1"}
  ],
  links: [
    {"source": "a", "target": "b", "type": "x", "value": 2}
  ]
});
// Resulting graph object can be used as datum for d3.sankeyDiagram() below
```

#### Data accessors

<a name="layout-nodes" href="#layout-nodes">#</a> layout.<b>nodes</b>([<i>nodes</i>])

If *nodes* is specified, sets the nodes accessor to the specified function and
returns this layout. If *nodes* is not specified, return the current accessor, which defaults to:
```js
function nodes(graph) {
  return graph.nodes;
}
```

<a name="layout-links" href="#layout-links">#</a> layout.<b>links</b>([<i>links</i>])

If *links* is specified, sets the links accessor to the specified function and
returns this layout. If *links* is not specified, return the current accessor, which defaults to:
```js
function links(graph) {
  return graph.links;
}
```

<a name="layout-nodeId" href="#layout-nodeId">#</a> layout.<b>nodeId</b>([<i>nodeId</i>])

If *nodeId* is specified, sets the node id accessor to the specified function and
returns this layout. If *nodeId* is not specified, return the current accessor, which defaults to:
```js
function nodeId(d) {
  return d.id;
}
```

<a name="layout-sourceId" href="#layout-sourceId">#</a> layout.<b>sourceId</b>([<i>sourceId</i>])<br/>
<a name="layout-targetId" href="#layout-targetId">#</a> layout.<b>targetId</b>([<i>targetId</i>])

If *sourceId*/*targetId* is specified, sets the link source/target id accessor to the specified function and
returns this layout. If *sourceId*/*targetId* is not specified, return the current accessor, which defaults to:
```js
function sourceId (d) {
  return {
    id: typeof d.source === 'object' ? d.source.id : d.source,
    port: typeof d.sourcePort === 'object' ? d.sourcePort.id : d.sourcePort
  }
}
// similarly for targetId
```

See below for more discussion of ports. If this accessor returns a string, it is
interpreted as the node id and the port is set to `undefined`.

<a name="layout-nodeBackwards" href="#layout-nodeBackwards">#</a> layout.<b>nodeBackwards</b>([<i>nodeBackwards</i>])

If *nodeBackwards* is specified, sets the node direction accessor to the specified function and
returns this layout. If *nodeBackwards* is not specified, return the current accessor, which defaults to:
```js
function nodeBackwards(d) {
  return d.direction && d.direction.toLowerCase() === 'l';
}
```

<a name="layout-linkValue" href="#layout-linkValue">#</a> layout.<b>linkValue</b>([<i>linkValue</i>])

If *linkValue* is specified, sets the link value accessor to the specified function and
returns this layout. If *linkValue* is not specified, return the current accessor, which defaults to:
```js
function linkValue(d) {
  return d.value;
}
```

<a name="layout-linkType" href="#layout-linkType">#</a>
layout.<b>linkType</b>([<i>linkType</i>])

If *linkType* is specified, sets the link type accessor to the specified function and
returns this layout. If *linkType* is not specified, return the current accessor, which defaults to:
```js
function linkType(d) {
  return d.type;
}
```

#### Adjusting layout

<a name="layout-ordering" href="#layout-ordering">#</a> layout.<b>ordering</b>([<i>ordering</i>])

If *ordering* is specified, sets the node ordering to the specified value and
returns this layout. If *ordering* is not specified, return the current value, which defaults to `null`. 

When *ordering* is null, the node ordering will be calculated automatically.

When *ordering* is specified, it is used directly and no rank assignment or
ordering algorithm takes place. The *ordering* structure has three nested lists:
*ordering* is a list of layers, each of which is a list of bands, each of which is
a list of node ids. For example,
```js
[
  [ ["layer 1 band 1"], ["layer 1 band 2"] ],
  [ ["layer 2 band 1"], ["layer 2 band 2"] ],
  ...
]
```

<a name="layout-rankSets" href="#layout-rankSets">#</a> layout.<b>rankSets</b>([<i>rankSets</i>])

If *rankSets* is specified, sets the rank sets to the specified value and
returns this layout. If *rankSets* is not specified, return the current value,
which defaults to `[]`.

Rank sets are optional constraints to keep nodes in the same layer. Each entry
has the form
```js
{
    type: 'same|min',   // optional, default 'min'
    nodes: [node ids],  // required
}
```

<a name="layout-sortPorts" href="#layout-sortPorts">#</a> layout.<b>sortPorts</b>([<i>sortPorts</i>])

If *sortPorts* is specified, sets the port sorting function to the specified
function and returns this layout. If *sortPorts* is not specified, return the
current value, which defaults to:
```js
function sortPorts(a, b) {
  return a.id.localeCompare(b.id)
}
```

**Note**: in a future version this may be changed to sort ports to avoid
crossings by default.

#### Dimensions

<a name="layout-extent" href="#layout-extent">#</a> layout.<b>extent</b>([<i>extent</i>])

If *extent* is specified, sets this layout’s extent to the specified array of
points [[*x0*, *y0*], [*x1*, *y1*]], where [*x0*, *y0*] is the top-left corner
and [*x1*, *y1*] is the bottom-right corner, and returns this tile layout. If
*extent* is not specified, returns the current layout extent.

<a name="layout-size" href="#layout-size">#</a> layout.<b>size</b>([<i>size</i>])

If *size* is specified, sets this layout’s size to the specified two-element
array of numbers [*width*, *height*] and returns this layout. If *size* is not
specified, returns the current layout size. This is a convenience method
equivalent to setting the [extent](#layout-extent) to [[0, 0], [*width*,
*height*]].

<a name="layout-scale" href="#layout-scale">#</a> diagram.<b>scale</b>([<i>scale</i>])

If *scale* is specified as a number, sets the layout's scale (from data units to
pixels). If *scale* is `null`, the scale will be reset and automatically
calculated the next time the diagram is called, to achieve the desired
whitespace fraction (below). If *scale* is not specified, return the current
scale.

<a name="layout-whitespace" href="#layout-whitespace">#</a> diagram.<b>whitespace</b>([<i>whitespace</i>])

If *whitespace* is specified as a number, sets the layout's whitespace fraction,
used when automatically calculating a scale (above). If *whitespace* is not
specified, return the current whitespace.

#### Manual positioning

<a name="layout-nodePosition" href="#layout-nodePosition">#</a> diagram.<b>nodePosition</b>([<i>nodePosition</i>])

If *nodePosition* is specified, use the specified function to directly set node
positions, bypassing the layout algorithm (link positions and shapes are still
calculated). If *nodePosition* is not specified, return the current
function, which defaults to `null`.

### SVG Sankey diagram component

<a name="sankeyDiagram" href="#sankeyDiagram">#</a> <b>sankeyDiagram</b>()

Creates a new Sankey diagram component.

<a name="diagram" href="#diagram">#</a> <b>diagram</b>(<i>selection</i>)

Apply the diagram to a selection, which should be an `svg` element.

```js
var diagram = d3.sankeyDiagram();
d3.select('#sankey')
    .datum(sankey)
    .call(diagram);
```

The Sankey data is taken from the selection's bound data, which should be a
graph object, as generated by [d3.sankey](#sankey).

#### Dimensions

<a name="margin" href="#margin">#</a> diagram.<b>margin</b>({ [<i>top</i>], [<i>right</i>], [<i>bottom</i>], [<i>left</i>] })

If called with an argument, set the margins of the diagram, otherwise return the
current value.

#### Titles

<a name="nodeTitle" href="#nodeTitle">#</a> diagram.<b>nodeTitle</b>([<i>nodeTitle</i>])

If called with an argument, set the node title to the specified function,
otherwise return the current function, which defaults to:
```js
function nodeTitle(d) {
  return d.title !== undefined ? d.title : d.id;
}
```

<a name="nodeValue" href="#nodeValue">#</a> diagram.<b>nodeValue</b>([<i>nodeValue</i>])

If called with an argument, set the node value getter to the specified function,
otherwise return the current function, which defaults to:
```js
function nodeValue(d) {
  return null;
}
```

The node value is shown with an SVG text element within the node body, only when
the `nodeWidth` is greater than zero.

<a name="linkTitle" href="#linkTitle">#</a>
diagram.<b>linkTitle</b>([<i>linkTitle</i>])

If called with an argument, set the link title to the specified function,
otherwise return the current function, which defaults to:
```js
const fmt = d3.format('.3s')
function linkTitle(d) {
  const parts = []
  const sourceTitle = nodeTitle(d.source)
  const targetTitle = nodeTitle(d.target)
  const matTitle = d.type

  parts.push(`${sourceTitle} → ${targetTitle}`)
  if (matTitle) parts.push(matTitle)
  parts.push(fmt(d.value))
  return parts.join('\n')
}
```

The link title is displayed in an SVG `title` element, visible on hover.

To make it easier to customise this function to your data, you can use
`d3.sankeyLinkTitle` to generate new functions:

<a name="sankeyLinkTitle" href="#sankeyLinkTitle">#</a> <b>sankeyLinkTitle</b>(nodeTitle, typeTitle, fmt)

Generates a function similar to the one above, with custom accessors for the
node title `nodeTitle`, link-type title `typeTitle` and number format `fmt`.

<a name="linkLabel" href="#linkLabel">#</a> diagram.<b>linkLabel</b>([<i>linkLabel</i>])

If called with an argument, set the link label to the specified function,
otherwise return the current function, which defaults to:
```js
function linkLabel(d) {
  return null
}
```

The link label is displayed in an SVG `text` element, so unlike the /title/, it
is visible all the time.

#### Link appearance

<a name="linkColor" href="#linkColor">#</a> diagram.<b>linkColor</b>([<i>linkColor</i>])

If *linkColor* is specified, sets the link color accessor to the specified
function, otherwise return the current accessor, which defaults to:
```js
function linkColor(d) {
  return null;
}
```

<a name="linkMinWidth" href="#linkMinWidth">#</a> diagram.<b>linkMinWidth</b>([<i>linkMinWidth</i>])

If *linkMinWidth* is specified, sets the minimum link width accessor to the
specified function, otherwise return the current accessor, which by default
returns `1`.

#### Node groups

<a name="groups" href="#groups">#</a> diagram.<b>groups</b>([<i>groups</i>])

If *groups* is specified, sets the list of node groups to the specified value.
If *groups* is not specified, return the current list. Node groups display a box
around the specified nodes, and should be given in the following format:
```js
[
    { title: "Group title to be displayed above nodes",
      nodes: ["nodeid1", "nodeid", ...]
    }
]
```

#### Events

<a name="on" href="#on">#</a> diagram.<b>on</b>(<i>type</i>[, <i>listener</i>])

Adds or removes an event *listener* for the specified *type*. The *type* string
is one of `selectNode`, `selectLink` or `selectGroup`. The *listener* is invoked
with the context as the element and one argument, the corresponding data.

If *listener* is not specified, returns the currently-assigned listener for the
specified *type*, if any. 

## Tests

Run the tests:
```js
npm test
```

## Licence

MIT licence.

## Changelog

### Unreleased

### v0.7.3

- Fix packaging to avoid overwriting the d3 global object in UMD module!
- Add a basic link label feature to show the values of links with SVG text
  elements. See [`diagram.linkLabel`](#linkLabel). (#2)

### v0.7.2

- Update packaging to produce different module builds:
    - `d3-sankey-diagram.esm.js`: An ES module
    - `d3-sankey-diagram.cjs.js`: A CommonJS module for use with NodeJS
    - `d3-sankey-diagram.umd.js`: A UMD module for use in `<script>` tags
    - `d3-sankey-diagram.min.js`: A minified version of the UMD module

### v0.7.1

- Unused code tidied up (thanks svwielga4)
- Improved node value labels: with wide nodes, the labels are shown within the
  nodes. Otherwise they are now shown after the node titles in parentheses.
  **[See
  example](https://bl.ocks.org/ricklupton/8a9a9501883a5645202cb439def65d31)**.
- By default, node values are not shown by default (the default in v0.7.0 was to
  show them). Use [`diagram.nodeValue`](#nodeValue) to set the format to show
  them.

### v0.7.0

- Add option to show node values, customizable with
  [`diagram.nodeValue`](#nodeValue).
