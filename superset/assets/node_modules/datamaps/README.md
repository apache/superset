Datamaps
======

[![Join the chat at https://gitter.im/markmarkoh/datamaps](https://badges.gitter.im/markmarkoh/datamaps.svg)](https://gitter.im/markmarkoh/datamaps?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

#### Interactive maps for data visualizations. Bundled into a single Javascript file.

Datamaps is intended to provide some data visualizations based on geographical data. It's SVG-based, can scale to any screen size, and includes everything inside of 1 script file.
It heavily relies on the amazing [D3.js](https://github.com/mbostock/d3) library.

Out of the box it includes support for choropleths and bubble maps (see [demos](http://datamaps.github.io)), but it's not limited to just that. Its new plugin system allows for the addition of any type of visualization over the map.

##### For feature requests, open an issue!

##### [Contribution Guideliness](#contributing-guidelines)

#### Demos at http://datamaps.github.io

---

Downloads:

 - [World map (94kb, 36.7kb gzip'd)](http://datamaps.github.io/scripts/0.4.4/datamaps.world.min.js)
 - [USA only (35kb, 13.9kb gzip'd)](http://datamaps.github.io/scripts/0.4.4/datamaps.usa.min.js)
 - [USA & World (131kb, 47.1kb gzip'd)](http://datamaps.github.io/scripts/0.4.4/datamaps.all.min.js)
 - [No preset topojson (6.8kb, 2.3kb gzip'd)](http://datamaps.github.io/scripts/0.4.4/datamaps.none.min.js)


### Documentation

#### Getting Started

1. Include D3.js and Topojson on your page
2. Include Datamaps.js on your page
3. Add a container, set the height and width and position to relative
4. Create a `new Datamaps(options)`, passing in at least an `element` option

Example:
```html
<script src="//cdnjs.cloudflare.com/ajax/libs/d3/3.5.3/d3.min.js"></script>
<script src="//cdnjs.cloudflare.com/ajax/libs/topojson/1.6.9/topojson.min.js"></script>
<script src="/datamaps.world.min.js"></script>
<div id="container" style="position: relative; width: 500px; height: 300px;"></div>
<script>
    var map = new Datamap({element: document.getElementById('container')});
</script>
```

This should render a new world map with a standard projection.

#### via [NPM](https://www.npmjs.com/package/datamaps)
1. `npm install datamaps`
2. Refer to file in `dist` directory, like:

```html
<script src="//cdnjs.cloudflare.com/ajax/libs/d3/3.5.3/d3.min.js"></script>
<script src="//cdnjs.cloudflare.com/ajax/libs/topojson/1.6.9/topojson.min.js"></script>
<script src="node_modules/datamaps/dist/datamaps.world.min.js"></script>
<div id="container" style="position: relative; width: 500px; height: 300px;"></div>
<script>
    var map = new Datamap({element: document.getElementById('container')});
</script>
```

#### via Bower

1. `bower install datamaps`
2. Refer to file in `dist` directory, like:

```html
<script src="//cdnjs.cloudflare.com/ajax/libs/d3/3.5.3/d3.min.js"></script>
<script src="//cdnjs.cloudflare.com/ajax/libs/topojson/1.6.9/topojson.min.js"></script>
<script src="bower_components/datamaps/dist/datamaps.world.min.js"></script>
<div id="container" style="position: relative; width: 500px; height: 300px;"></div>
<script>
    var map = new Datamap({element: document.getElementById('container')});
</script>
```

#### USA Only Map
A map of the USA with an Albers based projection will be default if you only include `datamaps.usa.min.js`, but in case you include `datamaps.all.min.js`:
```html
<script>
    var map = new Datamap({
        element: document.getElementById('container'),
        scope: 'usa'
    });
</script>
```

#### Changing the default fill colors
```html
<script>
    var map = new Datamap({
        element: document.getElementById('container'),
        fills: {
            defaultFill: 'rgba(23,48,210,0.9)' // Any hex, color name or rgb/rgba value
        }
    });
</script>
```

#### Disabling popup or hover effects
```html
<script>
    var map = new Datamap({
        element: document.getElementById('container'),
        geographyConfig: {
            highlightOnHover: false,
            popupOnHover: false
        }
    });
</script>
```

#### Using custom maps
```html
<script>
    var map = new Datamap({
        element: document.getElementById('container'),
        geographyConfig: {
            dataUrl: '/custom.json'
        },
        scope: 'custom',
        setProjection: function(element, options) {
            var projection, path;
            projection = d3.geo.albersUsa()
                .center([long, lat])
                .scale(element.offsetWidth)
                .translate([element.offsetWidth / 2, element.offsetHeight / 2]);
}
            path = d3.geo.path()
                .projection( projection );

            return {path: path, projection: projection};
        }
    });
</script>
```

By specifying a `dataUrl`, Datamaps will attempt to fetch that resource as TopoJSON.

If you are using a custom map, you'll probably want to specify your own `setProjection` method as well.

`setProjection` takes 2 arguments, `element` as a DOM element, `options` as the original options you passed in. It should return an object with two properties: `path` as a `d3.geo.path`, `projection` as a `d3.geo.projection`

The example above will result in albersUsa projection.

![custom UK based data](http://datamaps.github.io/images/custom.png)

[Read about other D3.js projections](https://github.com/mbostock/d3/wiki/Geo-Projections)

[Read more about TopoJSON](https://github.com/mbostock/topojson/wiki)

### You can create any country's map using custom maps.
Follow the below steps:-
1. Find the {xyz}.topo.json file for you country xyz. You can find from https://github.com/markmarkoh/datamaps/tree/master/dist.
2. Extract Datamap.prototype.{xyz}Topo json and save it file named {xyz}.topo.json
3. If the state codes contains dot(.) in the topo json, then you need to remove the dot from the code e.g, if your state code is CA.AL, remove CA. part to get 2-digit ISO code AL. If the states code are already in 2-digit ISO or do't have dot(.) then don't do any modification follow next steps.
4. Objects country name in {xyz}.topo.json should be same as you declared in the Datamap scope. e.g, for Canada, in canada.topo.json we have {"type":"Topology","objects":{"can":{"type":"GeometryCollection"}}} and we have provided scope as 'canada' in the canada.html page. So this case 'can' in canada.topo.json must be as 'canada' i.e {"type":"Topology","objects":{"canada":{"type":"GeometryCollection"}}}.
5. You need to override setProjection method, which is explained above three countires. You can refer any one.
6. Done

Here are the some examples of different countries maps.

### 1. Bubble map on India Geographical region
![india bubble map](https://github.com/Anujarya300/bubble_maps/blob/master/images/india.jpg)

[india.html](https://github.com/Anujarya300/bubble_maps/blob/master/india.html)
```
 var bubble_map = new Datamap({
            element: document.getElementById('india'),
            scope: 'india',
            geographyConfig: {
                popupOnHover: true,
                highlightOnHover: true,
                borderColor: '#444',
                borderWidth: 0.5,
                dataUrl: 'https://rawgit.com/Anujarya300/bubble_maps/master/data/geography-data/india.topo.json'
                //dataJson: topoJsonData
            },
            fills: {
                'MAJOR': '#306596',
                'MEDIUM': '#0fa0fa',
                'MINOR': '#bada55',
                defaultFill: '#dddddd'
            },
            data: {
                'JH': { fillKey: 'MINOR' },
                'MH': { fillKey: 'MINOR' }
            },
            setProjection: function (element) {
                var projection = d3.geo.mercator()
                    .center([78.9629, 23.5937]) // always in [East Latitude, North Longitude]
                    .scale(1000);
                var path = d3.geo.path().projection(projection);
                return { path: path, projection: projection };
            }
});
```
###### Set the correct projection for India map on world map with the help of Longitude and Latitute of India (you can google it India Longitude and Latitute)
Please use **india.toto.json** for India geopraphy json data from https://github.com/Anujarya300/bubble_maps/blob/master/data/geography-data/india.topo.json, otherwise your map wont work. (I have truncated IND. from all state ISO code(2-digit ISO code), e.g IND.JH for Jharkhand state truncated to JH)  

Please note in setProjection method, I have set [78.9629, 23.5937] to locate center point for India in the world map. That means
Latitude = 78.9629 E and Longitude = 23.5937 N. Remember Latitute and Longitude are always East and North. For western countries, Latitude are in West so make it convert as Negative of East. e.g 102.3421 W ==> -102.3421 E.

### 2. Bubble map on Canada Geographical region
![canada bubble map](https://github.com/Anujarya300/bubble_maps/blob/master/images/canada.jpg)

[canada.html](https://github.com/Anujarya300/bubble_maps/blob/master/canada.html)
```
var bubble_map = new Datamap({
            element: document.getElementById('canada'),
            scope: 'canada',
            geographyConfig: {
                popupOnHover: true,
                highlightOnHover: true,
                borderColor: '#444',
                borderWidth: 0.5,
                dataUrl: 'https://rawgit.com/Anujarya300/bubble_maps/master/data/geography-data/canada.topo.json'
                //dataJson: topoJsonData
            },
            fills: {
                'MAJOR': '#306596',
                'MEDIUM': '#0fa0fa',
                'MINOR': '#bada55',
                defaultFill: '#dddddd'
            },
            data: {
                'JH': { fillKey: 'MINOR' },
                'MH': { fillKey: 'MINOR' }
            },
            setProjection: function (element) {
                  var projection = d3.geo.mercator()
                .center([-106.3468, 68.1304]) // always in [East Latitude, North Longitude]
                .scale(250)
                .translate([element.offsetWidth / 2, element.offsetHeight / 2]);

                var path = d3.geo.path().projection(projection);
                return { path: path, projection: projection };
            }
        });
```
###### Set the correct projection for Canada map on world map with the help of Longitude and Latitute of Canada (you can google it Canada Longitude and Latitute)

Please use **canada.toto.json** for India geopraphy json data from https://github.com/Anujarya300/bubble_maps/blob/master/data/geography-data/canada.topo.json, otherwise your map wont work. (I have truncated CA. from all state ISO code(2-digit ISO code), e.g CA.TN to TN)
        
Please note in setProjection method, I have set [-106.3468, 68.1304] to locate center point for Canada in the world map. That means
Latitude = 106.3468 W and Longitude = 68.1304 N. Remember Latitute and Longitude are always East and North. For western countries, Latitude are in West so make it convert as Negative of East. e.g 102.3421 W ==> -102.3421 E.

*You can adjust this latitude and longitude co-ordinates by minor changing. 
e.g, if your map is not showing full view of North then you can change 68.1304 N to 70.3200 N or 71.3200 etc.
     if your map is not showing full view of East then you can change 32.1304 E to 70.3200 E or 30.3200 etc.*
     
[More about other countries maps](https://github.com/Anujarya300/bubble_maps)

#### Creating a Choropleth

Probably the most common type of map visualization, where different states or countries are color coded.
![US election map, example of a choropleth](http://datamaps.github.io/images/choropleth.png)

You'll need to know the 2 letter state code ('NY' for New York) or the 3 letter country code ('SCT' for Scotland) to fill in areas.
```html
<script>
    var map = new Datamap({
        element: document.getElementById('container'),
        fills: {
            HIGH: '#afafaf',
            LOW: '#123456',
            MEDIUM: 'blue',
            UNKNOWN: 'rgb(0,0,0)',
            defaultFill: 'green'
        },
        data: {
            IRL: {
                fillKey: 'LOW',
                numberOfThings: 2002
            },
            USA: {
                fillKey: 'MEDIUM',
                numberOfThings: 10381
            }
        }
    });

    // Draw a legend for this map
    map.legend();
</script>
```

This will draw a world map and fill in IRL (Ireland) with the corresponding `fills.LOW` and USA with `fills.MEDIUM`.

You can also use `fill: color` for each state if you don't want to define a `fillKey`.

Colors will be applied in this order: `fillKey`, `fill`, `defaultFill`.

#### Updating a choropleth after initial drawing
```javascript
map.updateChoropleth({
   USA: {fillKey: 'LOW'},
   CAN: '#0fa0fa'
});
```

You can specify either a literal color (as a string), or an object with a fillKey property.


#### Resetting a choropleth to `defaultFill`

The following will reset the entire map to the `defaultFill` and update `CA` to be filled green.
```js
map.updateChoropleth({CA: 'green'}, {reset: true})
```

The following will reset the entire map to `defaultFill`
```js
map.updateChoropleth(null, {reset: true})
```

The following will reset the entire map to `defaultFill`, but update the corresponding data of NY.
```js
map.updateChoropleth({NY: {numberOfVoters: 55452}}, {reset: true})
```

You can also add a map legend with the `legend` plugin (used above)

#### Choropleth with auto-calculated color

Example [highmaps_world.html](src/examples/highmaps_world.html) explains how to create colorized map based on some quantity of things, [Live Demo](http://jsbin.com/kuvojohapi/1/edit?html,output)

Example result:

![auto calculated color](/src/screenshots/datamap_highmap_exmaple.jpg)

#### Custom popup on hover

Expanding on the previous example of using `data`, any property passed into `data` will be sent to the `popupTemplate` function, which can be override to display custom messages.
```html
<script>
    var map = new Datamap({
        element: document.getElementById('container'),
        fills: {
            HIGH: '#afafaf',
            LOW: '#123456',
            MEDIUM: 'blue',
            UNKNOWN: 'rgb(0,0,0)',
            defaultFill: 'green'
        },
        data: {
            IRL: {
                fillKey: 'LOW',
                numberOfThings: 2002
            },
            USA: {
                fillKey: 'MEDIUM',
                numberOfThings: 10381
            }
        },
        geographyConfig: {
            popupTemplate: function(geo, data) {
                return ['<div class="hoverinfo"><strong>',
                        'Number of things in ' + geo.properties.name,
                        ': ' + data.numberOfThings,
                        '</strong></div>'].join('');
            }
        }
    });
</script>
```

`geographyConfig.popupTemplate`, `bubblesConfig.popupTemplate` and `arcConfig.popupTemplate` just needs to return an HTML string, so feel free to use [Handlebars](https://github.com/wycats/handlebars.js/) or [Underscore](http://underscorejs.org/#template) templates (instead of the terrible Array.join method above).


#### Bubbles
Bubbles in a core plugin that will render circles('bubbles') on different parts of the map. Each of these bubbles can be color coded in the same way a choropleth is color coded (see above 'Choropleth' example).
```js
var bombMap = new Datamap({
    element: document.getElementById('map_bombs'),
    scope: 'world',
    geographyConfig: {
        popupOnHover: false,
        highlightOnHover: false
    },
    fills: {
        'USA': '#1f77b4',
        'RUS': '#9467bd',
        'PRK': '#ff7f0e',
        'PRC': '#2ca02c',
        'IND': '#e377c2',
        'GBR': '#8c564b',
        'FRA': '#d62728',
        'PAK': '#7f7f7f',
        defaultFill: '#EDDC4E'
    },
    data: {
        'RUS': {fillKey: 'RUS'},
        'PRK': {fillKey: 'PRK'},
        'PRC': {fillKey: 'PRC'},
        'IND': {fillKey: 'IND'},
        'GBR': {fillKey: 'GBR'},
        'FRA': {fillKey: 'FRA'},
        'PAK': {fillKey: 'PAK'},
        'USA': {fillKey: 'USA'}
    }
});

     var bombs = [{
        name: 'Joe 4',
        radius: 25,
        yield: 400,
        country: 'USSR',
        fillKey: 'RUS',
        significance: 'First fusion weapon test by the USSR (not "staged")',
        date: '1953-08-12',
        latitude: 50.07,
        longitude: 78.43
      },{
        name: 'RDS-37',
        radius: 40,
        yield: 1600,
        country: 'USSR',
        fillKey: 'RUS',
        significance: 'First "staged" thermonuclear weapon test by the USSR (deployable)',
        date: '1955-11-22',
        latitude: 50.07,
        longitude: 78.43

      },{
        name: 'Tsar Bomba',
        radius: 75,
        yield: 50000,
        country: 'USSR',
        fillKey: 'RUS',
        significance: 'Largest thermonuclear weapon ever tested—scaled down from its initial 100 Mt design by 50%',
        date: '1961-10-31',
        latitude: 73.482,
        longitude: 54.5854
      }
    ];
//draw bubbles for bombs
bombMap.bubbles(bombs, {
    popupTemplate: function (geo, data) {
            return ['<div class="hoverinfo">' +  data.name,
            '<br/>Payload: ' +  data.yield + ' kilotons',
            '<br/>Country: ' +  data.country + '',
            '<br/>Date: ' +  data.date + '',
            '</div>'].join('');
    }
});
```

![bubble map](http://datamaps.github.io/images/bubbles.png)

The first parameter to `bubbles` should be an array of objects, each with **at least** 3 properties:

  - `latitude`
  - `longitude`
  - `radius`

Optionally, pass in `fillKey` to color code the bubble, and pass in any other data you want to render in a popup template which can be overridden in the options parameter.

For further customization, you can set these properties on each bubble to override the options parameter (or default options):

  - `borderColor`
  - `borderWidth`
  - `borderOpacity`
  - `fillOpacity`

The second parameter is the `options` param, where you can override any of the default options (documented below)


#### Live updating of bubbles
You can continue to call `bubbles` on the same map instance and the map will auto update itself. Any bubble previously drawn that's **not included** in subsequent calls will be removed from the UI.

`map.bubbles([])` will erase all bubbles.


#### Labels

For USA maps you can add 2 letter (*i.e., NY, TX*) labels to each state. To add labels, after created the map:

```javascript
map.labels();
```

The following options are allowed:

  - `labelColor` // Font color, default: #000
  - `lineWidth` // Line width for New England states, default: 1
  - `fontSize` // Font size, default: 10
  - `fontFamily` // Font family, default: 'Verdana'
  - `customLabelText` // Replaces 2 letter labels with custom

An example for using the options:

```javascript
map.labels({labelColor: 'blue', fontSize: 12});
```

An example for using the customLabelText

This accepts an object whose keys are uppercase 2 letter state codes.
Values will be substituted for default label text
Any missing values default to 2 state letters
```javascript
newLabels = {'AK':'Alaska', 'AL':'123',.......};
map.labels({'customLabelText': newLabels});
```
Example [custom-labels.html](src/examples/custom-labels.html) for using the customLabelText

![custom labels](/src/screenshots/datamap_custom_label_example.png)

#### Zooming

You can override the default projection by setting your own `setProjection(element)` function.
[Example here](http://datamaps.github.io#zoom)

```javascript
var map = new Datamap({
  scope: 'world',
  element: document.getElementById('container1'),
  setProjection: function(element) {
    var projection = d3.geo.equirectangular()
      .center([19, -3])
      .rotate([4.4, 0])
      .scale(400)
      .translate([element.offsetWidth / 2, element.offsetHeight / 2]);
    var path = d3.geo.path()
      .projection(projection);

    return {path: path, projection: projection};
  },
```

#### Using with jQuery
If jQuery is present on the page when the Datamaps library loads, it'll automatically create a jQuery plugin called `datamaps` that can be used like:
```html
    <script>
        $("#container").datamaps(options);
    </script>
```

#### Events
All events are bubbled up to the root `svg` element and to listen to events, use the `done` callback.

```html
<script>
    var map = new Datamap({
        element: document.getElementById('container'),
        done: function(datamap) {
            datamap.svg.selectAll('.datamaps-subunit').on('click', function(geography) {
                alert(geography.properties.name);
            });
        }
    });
</script>
```

#### Responsive Maps
Set `responsive` to `true` and then listen for `resize` events on `window`, and call `Datamaps.prototype.resize`.

Avoid setting the height and width of the `container` with hard pixel values, instead use percent values. (use `50%` instead of `500px`.

If the aspect ratio of your custom map is not the default `16:9` (`0.5625`), you should use the `aspectRatio` option to set it appropriately (eg. `0.3` for a `3:1` aspect ratio).

```html
<div id="container"></div>
<script>
    var map = new Datamap({
        element: document.getElementById('container'),
        responsive: true
    });

    // Pure JavaScript
    window.addEventListener('resize', function() {
        map.resize();
    });

    // Alternatively with d3
    d3.select(window).on('resize', function() {
        map.resize();
    });

    // Alternatively with jQuery
    $(window).on('resize', function() {
       map.resize();
    });
</script>
```
---

#### Default Options
```js
  {
    scope: 'world', // Currently supports 'usa' and 'world', however with custom map data you can specify your own
    setProjection: setProjection, // Returns a d3 path and projection functions
    projection: 'equirectangular', // Style of projection to be used. try "mercator"
    height: null, // If not null, datamaps will grab the height of 'element'
    width: null, // If not null, datamaps will grab the width of 'element',
    responsive: false, // If true, call `resize()` on the map object when it should adjust it's size
    done: function() {}, // Callback when the map is done drawing
    fills: {
      defaultFill: '#ABDDA4' // The keys in this object map to the "fillKey" of [data] or [bubbles]
    },
    dataType: 'json', // For use with dataUrl, currently 'json' or 'csv'. CSV should have an `id` column
    dataUrl: null, // If not null, datamaps will attempt to fetch this based on dataType ( default: json )
    geographyConfig: {
        dataUrl: null, // If not null, datamaps will fetch the map JSON (currently only supports topojson)
        hideAntarctica: true,
        hideHawaiiAndAlaska : false,
        borderWidth: 1,
        borderOpacity: 1,
        borderColor: '#FDFDFD',
        popupTemplate: function(geography, data) { // This function should just return a string
          return '&lt;div class="hoverinfo"&gt;&lt;strong&gt;' + geography.properties.name + '&lt;/strong&gt;&lt;/div&gt;';
        },
        popupOnHover: true, // True to show the popup while hovering
        highlightOnHover: true,
        highlightFillColor: '#FC8D59',
        highlightBorderColor: 'rgba(250, 15, 160, 0.2)',
        highlightBorderWidth: 2,
        highlightBorderOpacity: 1
    },
    bubblesConfig: {
        borderWidth: 2,
        borderOpacity: 1,
        borderColor: '#FFFFFF',
        popupOnHover: true, // True to show the popup while hovering
        radius: null,
        popupTemplate: function(geography, data) { // This function should just return a string
          return '<div class="hoverinfo"><strong>' + data.name + '</strong></div>';
        },
        fillOpacity: 0.75,
        animate: true,
        highlightOnHover: true,
        highlightFillColor: '#FC8D59',
        highlightBorderColor: 'rgba(250, 15, 160, 0.2)',
        highlightBorderWidth: 2,
        highlightBorderOpacity: 1,
        highlightFillOpacity: 0.85,
        exitDelay: 100, // Milliseconds
        key: JSON.stringify
    },
    arcConfig: {
      strokeColor: '#DD1C77',
      strokeWidth: 1,
      arcSharpness: 1,
      animationSpeed: 600, // Milliseconds
      popupOnHover: false, // True to show the popup while hovering
      popupTemplate: function(geography, data) { // This function should just return a string
        // Case with latitude and longitude
        if ( ( data.origin && data.destination ) && data.origin.latitude && data.origin.longitude && data.destination.latitude && data.destination.longitude ) {
          return '<div class="hoverinfo"><strong>Arc</strong><br>Origin: ' + JSON.stringify(data.origin) + '<br>Destination: ' + JSON.stringify(data.destination) + '</div>';
        }
        // Case with only country name
        else if ( data.origin && data.destination ) {
          return '<div class="hoverinfo"><strong>Arc</strong><br>' + data.origin + ' -> ' + data.destination + '</div>';
        }
        // Missing information
        else {
          return '';
        }
      }
    }
  }
```
---

#Contributing Guidelines

* Do not run the `grunt build` task or submit any built files in your PR.
* Have an example in `src/examples` if adding a new feature. Copy an existing feature `.html` file to start.
