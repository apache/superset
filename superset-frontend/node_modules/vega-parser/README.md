# vega-parser

Parse Vega specifications to runtime dataflow descriptions.

## API Reference

<a name="parse" href="#parse">#</a>
vega.<b>parse</b>(<i>specification</i>[, <i>config</i>])
[<>](https://github.com/vega/vega/blob/master/packages/vega-parser/src/parse.js "Source")

Parses a Vega JSON *specification* as input and produces a reactive dataflow graph description for a visualization. The output description uses the format of the [vega-runtime](https://github.com/vega/vega/tree/master/packages/vega-runtime) module. To create a visualization, use the runtime dataflow description as the input to a Vega [View](https://github.com/vega/vega/tree/master/packages/vega-view) instance.

The optional *config* object provides visual encoding defaults for marks, scales, axes and legends. Different configuration settings can be used to change choices of layout, color, type faces, font sizes and more to realize different chart themes. For more, see the configuration documentation below or view the source code defining Vega's [default configuration](https://github.com/vega/vega/blob/master/packages/vega-parser/src/config.js).

In addition to passing configuration options to this [parse](#parse) method, Vega JSON specifications may also include a top-level `"config"` block specifying configuration properties. Configuration options defined within a Vega JSON file take precedence over those provided to the parse method.

## Configuration

The Vega parser accepts a configuration file that defines default settings for a variety of visual encoding choices. Different configuration files can be used to "theme" charts with a customized look and feel. A configuration file is simply a JavaScript object with a set of named properties, grouped by type.

For more information regarding the supported configuration options, please see the [Vega config documentation](https://vega.github.io/vega/docs/config/).
