# vega-scenegraph

[Vega](https://github.com/vega/vega) scenegraph and renderers.

Renderers and event handlers for Vega's mark-based scenegraph. This package supports both pixel-based (canvas) and vector graphics (SVG) output. Renderers can either (re-)draw a complete scene or perform incremental re-rendering for a set of provided "dirty" items. A fast SVG string renderer is also provided to generate static SVG for export.

The [node-canvas](https://github.com/Automattic/node-canvas) library is used for server-side canvas rendering and bounds calculation. Node-canvas requires the native Cairo graphics library and may attempt to compile native code as part of the installation process. In some instances this may result in installation hiccups. Should you run into issues, you are likely to resolve them more quickly if you first search for help regarding node-canvas (as opposed to vega-scenegraph) installation. However, node-canvas is not a strict dependency, and is not needed for SVG rendering. Bounds calculation can be performed without node-canvas, though in the case of text marks the resulting bounds may be inaccurate due to approximate text size calculations.

## Scenegraph Definition

The Vega scenegraph is a hierarchical (tree) data structure. The levels of the tree alternate between an enclosing *mark* definition and contained sets of mark instances called *items*.

For example, here is a simple scenegraph containing three rectangles:

```json
{
  "marktype": "rect",
  "items": [
    {"x": 0, "y": 0, "width": 50, "height": 50, "fill": "steelblue"},
    {"x": 100, "y": 50, "width": 50, "height": 50, "fill": "firebrick"},
    {"x": 50, "y": 100, "width": 50, "height": 50, "fill": "forestgreen"}
  ]
}
```

The supported mark types are rectangles (`rect`), plotting symbols (`symbol`), general paths or polygons (`path`), circular arcs (`arc`), filled areas (`area`), lines (`line`), images (`image`), text labels (`text`), and chart gridlines or rules (`rule`). Each item has a set of supported properties (`x`, `y`, `width`, `fill`, and so on) appropriate to the mark type.

Scenegraphs may also contain `group` marks, which serve as containers for other marks. For example, a top-level group mark may look like:

```json
{
  "marktype": "group",
  "items": [
    {
      "x": 0,
      "y": 0,
      "width": 200,
      "height": 200,
      "items": [...] // array of contained mark instances
    }
  ]
}
```

In this example, the group *mark* contains only a single group *item*. In practice, a group mark may contain any number of group items, for example to describe a scene with multiple layers or sub-plots.

For more information regarding supported mark properties, please see the [Vega marks documentation](https://vega.github.io/vega/docs/marks/).

## Scenegraph Serialization

The top-level export of this package includes `fromJSON` and `toJSON` methods to support scenegraph serialization. The `fromJSON` method expects a JSON string as input (similar to the examples listed above). It will then add additional parent pointers to the tree structure. For example, each item will have a `mark` property pointing to its parent mark, and each mark will have a `group` property pointing to its parent group (if any). The `toJSON` method maps a scenegraph instance to a JSON string, stripping any parent pointers or other non-standard properties.

## Test Suite

The vega-scengraph test suite compares rendered output for both Canvas (PNG) and SVG (text) renderers. Due to differences among platforms, pixel-level rendering by node-canvas can differ across operating systems. As a result, some test cases may break when running on a system other than Mac OS X (our standard platform for testing). If you are running on Linux or Windows and experience test failures, it does not necessarily indicate an issue with vega-scenegraph. In such cases, we recommend running the node-canvas test-server (`npm run test-server` from the node-canvas repository) to compare server-side and client-side rendering.
