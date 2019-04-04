# Mapbox GL JS Supported

This library determines if a browser supports [Mapbox GL JS](http://github.com/mapbox/mapbox-gl-js).

## Testing Your Browser

You may test your browser [here](http://mapbox.github.io/mapbox-gl-supported).

## Using Mapbox GL JS Supported with a `<script>` tag

```html
<script src='mapbox-gl-supported.js'></script>
<script>
if (mapboxgl.supported()) {
    ...
} else {
    ...
}
</script>
```

## Using Mapbox GL JS Supported with [Browserify](http://browserify.org/)

```bash
npm install --save @mapbox/mapbox-gl-supported
```

```js
var isSupported = require('@mapbox/mapbox-gl-supported')();
```
