# d3-sankey

D3 4.0 implementation of the Sankey plugin to visualize the flow between nodes in a directed acyclic network.

## Installing

If you use NPM, `npm install d3-sankey`. Otherwise, download the [latest release](https://github.com/d3/d3-sankey/releases/latest).

You can also load directly from unpkg.

```javascript
<script src="https://d3js.org/d3.v4.js"></script>
<script src="https://unpkg.com/d3-sankey@0"></script>
<script>

var sankey = d3.sankey();

</script>
```

## Demo
Here is Mike Bostock's famous example [recreated with d3-sankey](http://bl.ocks.org/xaranke/9ada4c74a87b57ae7308).

Clone or download the block, then run `npm install` and `npm run build` to create `d3.min.js`.  

## API Reference

<a href="#sankey" name="sankey">#</a> <b>sankey</b>()

Constructs a new sankey generator with the default settings.

<a name="sankey_nodeWidth" href="#sankey_nodeWidth">#</a> <i>sankey</i>.<b>nodeWidth</b>([<i>width</i>])

If <i>width</i> is specified, sets the node width to the specified function or number and returns this sankey generator. If <i>width</i> is not specified, returns the current node width accessor, which defaults to:

```js
function nodeWidth() {
  return 24;
}
```

<a name="sankey_nodePadding" href="#sankey_nodePadding">#</a> <i>sankey</i>.<b>nodePadding</b>([<i>padding</i>])

If <i>padding</i> is specified, sets the node padding to the specified function or number and returns this sankey generator. If <i>padding</i> is not specified, returns the current node padding accessor, which defaults to:

```js
function nodePadding() {
  return 8;
}
```
Here padding refers to the vertical space between nodes that occupy the same horizontal space.

<a name="sankey_nodes" href="#sankey_nodes">#</a> <i>sankey</i>.<b>nodes</b>([<i>nodes</i>])

If <i>nodes</i> is specified, sets the list of nodes to the specified function or array and returns this sankey generator. If <i>nodes</i> is not specified, returns the current accessor to the list of nodes, which defaults to:

```js
function nodes() {
  return [];
}
```

<a name="sankey_links" href="#sankey_links">#</a> <i>sankey</i>.<b>links</b>([<i>links</i>])

If <i>links</i> is specified, sets the list of links to the specified function or array and returns this sankey generator. If <i>links</i> is not specified, returns the current accessor to the list of links, which defaults to:

```js
function links() {
  return [];
}
```

<a name="sankey_layout" href="#sankey_layout">#</a> <i>sankey</i>.<b>layout</b>([<i>iterations</i>])

Returns the current accessor to the SVG layout object. Here <i>iterations</i> is the number of times the converging function <b>computeNodeDepths</b> is run.

<a name="sankey_relayout" href="#sankey_relayout">#</a> <i>sankey</i>.<b>relayout</b>()

Similar to <b>layout</b> but only recalculates the depth of links. Primarily used when a node is moved vertically.
