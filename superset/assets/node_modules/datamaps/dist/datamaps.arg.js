(function() {
  var svg;

  //save off default references
  var d3 = window.d3, topojson = window.topojson;

  var defaultOptions = {
    scope: 'world',
    responsive: false,
    aspectRatio: 0.5625,
    setProjection: setProjection,
    projection: 'equirectangular',
    dataType: 'json',
    data: {},
    done: function() {},
    fills: {
      defaultFill: '#ABDDA4'
    },
    filters: {},
    geographyConfig: {
        dataUrl: null,
        hideAntarctica: true,
        hideHawaiiAndAlaska : false,
        borderWidth: 1,
        borderColor: '#FDFDFD',
        popupTemplate: function(geography, data) {
          return '<div class="hoverinfo"><strong>' + geography.properties.name + '</strong></div>';
        },
        popupOnHover: true,
        highlightOnHover: true,
        highlightFillColor: '#FC8D59',
        highlightBorderColor: 'rgba(250, 15, 160, 0.2)',
        highlightBorderWidth: 2
    },
    projectionConfig: {
      rotation: [97, 0]
    },
    bubblesConfig: {
        borderWidth: 2,
        borderColor: '#FFFFFF',
        popupOnHover: true,
        radius: null,
        popupTemplate: function(geography, data) {
          return '<div class="hoverinfo"><strong>' + data.name + '</strong></div>';
        },
        fillOpacity: 0.75,
        animate: true,
        highlightOnHover: true,
        highlightFillColor: '#FC8D59',
        highlightBorderColor: 'rgba(250, 15, 160, 0.2)',
        highlightBorderWidth: 2,
        highlightFillOpacity: 0.85,
        exitDelay: 100,
        key: JSON.stringify
    },
    arcConfig: {
      strokeColor: '#DD1C77',
      strokeWidth: 1,
      arcSharpness: 1,
      animationSpeed: 600
    }
  };

  /*
    Getter for value. If not declared on datumValue, look up the chain into optionsValue
  */
  function val( datumValue, optionsValue, context ) {
    if ( typeof context === 'undefined' ) {
      context = optionsValue;
      optionsValues = undefined;
    }
    var value = typeof datumValue !== 'undefined' ? datumValue : optionsValue;

    if (typeof value === 'undefined') {
      return  null;
    }

    if ( typeof value === 'function' ) {
      var fnContext = [context];
      if ( context.geography ) {
        fnContext = [context.geography, context.data];
      }
      return value.apply(null, fnContext);
    }
    else {
      return value;
    }
  }

  function addContainer( element, height, width ) {
    this.svg = d3.select( element ).append('svg')
      .attr('width', width || element.offsetWidth)
      .attr('data-width', width || element.offsetWidth)
      .attr('class', 'datamap')
      .attr('height', height || element.offsetHeight)
      .style('overflow', 'hidden'); // IE10+ doesn't respect height/width when map is zoomed in

    if (this.options.responsive) {
      d3.select(this.options.element).style({'position': 'relative', 'padding-bottom': (this.options.aspectRatio*100) + '%'});
      d3.select(this.options.element).select('svg').style({'position': 'absolute', 'width': '100%', 'height': '100%'});
      d3.select(this.options.element).select('svg').select('g').selectAll('path').style('vector-effect', 'non-scaling-stroke');

    }

    return this.svg;
  }

  // setProjection takes the svg element and options
  function setProjection( element, options ) {
    var width = options.width || element.offsetWidth;
    var height = options.height || element.offsetHeight;
    var projection, path;
    var svg = this.svg;

    if ( options && typeof options.scope === 'undefined') {
      options.scope = 'world';
    }

    if ( options.scope === 'usa' ) {
      projection = d3.geo.albersUsa()
        .scale(width)
        .translate([width / 2, height / 2]);
    }
    else if ( options.scope === 'world' ) {
      projection = d3.geo[options.projection]()
        .scale((width + 1) / 2 / Math.PI)
        .translate([width / 2, height / (options.projection === "mercator" ? 1.45 : 1.8)]);
    }

    if ( options.projection === 'orthographic' ) {

      svg.append("defs").append("path")
        .datum({type: "Sphere"})
        .attr("id", "sphere")
        .attr("d", path);

      svg.append("use")
          .attr("class", "stroke")
          .attr("xlink:href", "#sphere");

      svg.append("use")
          .attr("class", "fill")
          .attr("xlink:href", "#sphere");
      projection.scale(250).clipAngle(90).rotate(options.projectionConfig.rotation)
    }

    path = d3.geo.path()
      .projection( projection );

    return {path: path, projection: projection};
  }

  function addStyleBlock() {
    if ( d3.select('.datamaps-style-block').empty() ) {
      d3.select('head').append('style').attr('class', 'datamaps-style-block')
      .html('.datamap path.datamaps-graticule { fill: none; stroke: #777; stroke-width: 0.5px; stroke-opacity: .5; pointer-events: none; } .datamap .labels {pointer-events: none;} .datamap path {stroke: #FFFFFF; stroke-width: 1px;} .datamaps-legend dt, .datamaps-legend dd { float: left; margin: 0 3px 0 0;} .datamaps-legend dd {width: 20px; margin-right: 6px; border-radius: 3px;} .datamaps-legend {padding-bottom: 20px; z-index: 1001; position: absolute; left: 4px; font-size: 12px; font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;} .datamaps-hoverover {display: none; font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; } .hoverinfo {padding: 4px; border-radius: 1px; background-color: #FFF; box-shadow: 1px 1px 5px #CCC; font-size: 12px; border: 1px solid #CCC; } .hoverinfo hr {border:1px dotted #CCC; }');
    }
  }

  function drawSubunits( data ) {
    var fillData = this.options.fills,
        colorCodeData = this.options.data || {},
        geoConfig = this.options.geographyConfig;


    var subunits = this.svg.select('g.datamaps-subunits');
    if ( subunits.empty() ) {
      subunits = this.addLayer('datamaps-subunits', null, true);
    }

    var geoData = topojson.feature( data, data.objects[ this.options.scope ] ).features;
    if ( geoConfig.hideAntarctica ) {
      geoData = geoData.filter(function(feature) {
        return feature.id !== "ATA";
      });
    }

    if ( geoConfig.hideHawaiiAndAlaska ) {
      geoData = geoData.filter(function(feature) {
        return feature.id !== "HI" && feature.id !== 'AK';
      });
    }

    var geo = subunits.selectAll('path.datamaps-subunit').data( geoData );

    geo.enter()
      .append('path')
      .attr('d', this.path)
      .attr('class', function(d) {
        return 'datamaps-subunit ' + d.id;
      })
      .attr('data-info', function(d) {
        return JSON.stringify( colorCodeData[d.id]);
      })
      .style('fill', function(d) {
        //if fillKey - use that
        //otherwise check 'fill'
        //otherwise check 'defaultFill'
        var fillColor;

        var datum = colorCodeData[d.id];
        if ( datum && datum.fillKey ) {
          fillColor = fillData[ val(datum.fillKey, {data: colorCodeData[d.id], geography: d}) ];
        }

        if ( typeof fillColor === 'undefined' ) {
          fillColor = val(datum && datum.fillColor, fillData.defaultFill, {data: colorCodeData[d.id], geography: d});
        }

        return fillColor;
      })
      .style('stroke-width', geoConfig.borderWidth)
      .style('stroke', geoConfig.borderColor);
  }

  function handleGeographyConfig () {
    var hoverover;
    var svg = this.svg;
    var self = this;
    var options = this.options.geographyConfig;

    if ( options.highlightOnHover || options.popupOnHover ) {
      svg.selectAll('.datamaps-subunit')
        .on('mouseover', function(d) {
          var $this = d3.select(this);
          var datum = self.options.data[d.id] || {};
          if ( options.highlightOnHover ) {
            var previousAttributes = {
              'fill':  $this.style('fill'),
              'stroke': $this.style('stroke'),
              'stroke-width': $this.style('stroke-width'),
              'fill-opacity': $this.style('fill-opacity')
            };

            $this
              .style('fill', val(datum.highlightFillColor, options.highlightFillColor, datum))
              .style('stroke', val(datum.highlightBorderColor, options.highlightBorderColor, datum))
              .style('stroke-width', val(datum.highlightBorderWidth, options.highlightBorderWidth, datum))
              .style('fill-opacity', val(datum.highlightFillOpacity, options.highlightFillOpacity, datum))
              .attr('data-previousAttributes', JSON.stringify(previousAttributes));

            //as per discussion on https://github.com/markmarkoh/datamaps/issues/19
            if ( ! /((MSIE)|(Trident))/.test(navigator.userAgent) ) {
             moveToFront.call(this);
            }
          }

          if ( options.popupOnHover ) {
            self.updatePopup($this, d, options, svg);
          }
        })
        .on('mouseout', function() {
          var $this = d3.select(this);

          if (options.highlightOnHover) {
            //reapply previous attributes
            var previousAttributes = JSON.parse( $this.attr('data-previousAttributes') );
            for ( var attr in previousAttributes ) {
              $this.style(attr, previousAttributes[attr]);
            }
          }
          $this.on('mousemove', null);
          d3.selectAll('.datamaps-hoverover').style('display', 'none');
        });
    }

    function moveToFront() {
      this.parentNode.appendChild(this);
    }
  }

  //plugin to add a simple map legend
  function addLegend(layer, data, options) {
    data = data || {};
    if ( !this.options.fills ) {
      return;
    }

    var html = '<dl>';
    var label = '';
    if ( data.legendTitle ) {
      html = '<h2>' + data.legendTitle + '</h2>' + html;
    }
    for ( var fillKey in this.options.fills ) {

      if ( fillKey === 'defaultFill') {
        if (! data.defaultFillName ) {
          continue;
        }
        label = data.defaultFillName;
      } else {
        if (data.labels && data.labels[fillKey]) {
          label = data.labels[fillKey];
        } else {
          label= fillKey + ': ';
        }
      }
      html += '<dt>' + label + '</dt>';
      html += '<dd style="background-color:' +  this.options.fills[fillKey] + '">&nbsp;</dd>';
    }
    html += '</dl>';

    var hoverover = d3.select( this.options.element ).append('div')
      .attr('class', 'datamaps-legend')
      .html(html);
  }

    function addGraticule ( layer, options ) {
      var graticule = d3.geo.graticule();
      this.svg.insert("path", '.datamaps-subunits')
        .datum(graticule)
        .attr("class", "datamaps-graticule")
        .attr("d", this.path);
  }

  function handleArcs (layer, data, options) {
    var self = this,
        svg = this.svg;

    if ( !data || (data && !data.slice) ) {
      throw "Datamaps Error - arcs must be an array";
    }

    // For some reason arc options were put in an `options` object instead of the parent arc
    // I don't like this, so to match bubbles and other plugins I'm moving it
    // This is to keep backwards compatability
    for ( var i = 0; i < data.length; i++ ) {
      data[i] = defaults(data[i], data[i].options);
      delete data[i].options;
    }

    if ( typeof options === "undefined" ) {
      options = defaultOptions.arcConfig;
    }

    var arcs = layer.selectAll('path.datamaps-arc').data( data, JSON.stringify );

    var path = d3.geo.path()
        .projection(self.projection);

    arcs
      .enter()
        .append('svg:path')
        .attr('class', 'datamaps-arc')
        .style('stroke-linecap', 'round')
        .style('stroke', function(datum) {
          return val(datum.strokeColor, options.strokeColor, datum);
        })
        .style('fill', 'none')
        .style('stroke-width', function(datum) {
            return val(datum.strokeWidth, options.strokeWidth, datum);
        })
        .attr('d', function(datum) {
            var originXY = self.latLngToXY(val(datum.origin.latitude, datum), val(datum.origin.longitude, datum))
            var destXY = self.latLngToXY(val(datum.destination.latitude, datum), val(datum.destination.longitude, datum));
            var midXY = [ (originXY[0] + destXY[0]) / 2, (originXY[1] + destXY[1]) / 2];
            if (options.greatArc) {
                  // TODO: Move this to inside `if` clause when setting attr `d`
              var greatArc = d3.geo.greatArc()
                  .source(function(d) { return [val(d.origin.longitude, d), val(d.origin.latitude, d)]; })
                  .target(function(d) { return [val(d.destination.longitude, d), val(d.destination.latitude, d)]; });

              return path(greatArc(datum))
            }
            var sharpness = val(datum.arcSharpness, options.arcSharpness, datum);
            return "M" + originXY[0] + ',' + originXY[1] + "S" + (midXY[0] + (50 * sharpness)) + "," + (midXY[1] - (75 * sharpness)) + "," + destXY[0] + "," + destXY[1];
        })
        .transition()
          .delay(100)
          .style('fill', function(datum) {
            /*
              Thank you Jake Archibald, this is awesome.
              Source: http://jakearchibald.com/2013/animated-line-drawing-svg/
            */
            var length = this.getTotalLength();
            this.style.transition = this.style.WebkitTransition = 'none';
            this.style.strokeDasharray = length + ' ' + length;
            this.style.strokeDashoffset = length;
            this.getBoundingClientRect();
            this.style.transition = this.style.WebkitTransition = 'stroke-dashoffset ' + val(datum.animationSpeed, options.animationSpeed, datum) + 'ms ease-out';
            this.style.strokeDashoffset = '0';
            return 'none';
          })

    arcs.exit()
      .transition()
      .style('opacity', 0)
      .remove();
  }

  function handleLabels ( layer, options ) {
    var self = this;
    options = options || {};
    var labelStartCoodinates = this.projection([-67.707617, 42.722131]);
    this.svg.selectAll(".datamaps-subunit")
      .attr("data-foo", function(d) {
        var center = self.path.centroid(d);
        var xOffset = 7.5, yOffset = 5;

        if ( ["FL", "KY", "MI"].indexOf(d.id) > -1 ) xOffset = -2.5;
        if ( d.id === "NY" ) xOffset = -1;
        if ( d.id === "MI" ) yOffset = 18;
        if ( d.id === "LA" ) xOffset = 13;

        var x,y;

        x = center[0] - xOffset;
        y = center[1] + yOffset;

        var smallStateIndex = ["VT", "NH", "MA", "RI", "CT", "NJ", "DE", "MD", "DC"].indexOf(d.id);
        if ( smallStateIndex > -1) {
          var yStart = labelStartCoodinates[1];
          x = labelStartCoodinates[0];
          y = yStart + (smallStateIndex * (2+ (options.fontSize || 12)));
          layer.append("line")
            .attr("x1", x - 3)
            .attr("y1", y - 5)
            .attr("x2", center[0])
            .attr("y2", center[1])
            .style("stroke", options.labelColor || "#000")
            .style("stroke-width", options.lineWidth || 1)
        }

        layer.append("text")
          .attr("x", x)
          .attr("y", y)
          .style("font-size", (options.fontSize || 10) + 'px')
          .style("font-family", options.fontFamily || "Verdana")
          .style("fill", options.labelColor || "#000")
          .text( d.id );
        return "bar";
      });
  }


  function handleBubbles (layer, data, options ) {
    var self = this,
        fillData = this.options.fills,
        filterData = this.options.filters,
        svg = this.svg;

    if ( !data || (data && !data.slice) ) {
      throw "Datamaps Error - bubbles must be an array";
    }

    var bubbles = layer.selectAll('circle.datamaps-bubble').data( data, options.key );

    bubbles
      .enter()
        .append('svg:circle')
        .attr('class', 'datamaps-bubble')
        .attr('cx', function ( datum ) {
          var latLng;
          if ( datumHasCoords(datum) ) {
            latLng = self.latLngToXY(datum.latitude, datum.longitude);
          }
          else if ( datum.centered ) {
            latLng = self.path.centroid(svg.select('path.' + datum.centered).data()[0]);
          }
          if ( latLng ) return latLng[0];
        })
        .attr('cy', function ( datum ) {
          var latLng;
          if ( datumHasCoords(datum) ) {
            latLng = self.latLngToXY(datum.latitude, datum.longitude);
          }
          else if ( datum.centered ) {
            latLng = self.path.centroid(svg.select('path.' + datum.centered).data()[0]);
          }
          if ( latLng ) return latLng[1];
        })
        .attr('r', function(datum) {
          // if animation enabled start with radius 0, otherwise use full size.
          return options.animate ? 0 : val(datum.radius, options.radius, datum);
        })
        .attr('data-info', function(d) {
          return JSON.stringify(d);
        })
        .attr('filter', function (datum) {
          var filterKey = filterData[ val(datum.filterKey, options.filterKey, datum) ];

          if (filterKey) {
            return filterKey;
          }
        })
        .style('stroke', function ( datum ) {
          return val(datum.borderColor, options.borderColor, datum);
        })
        .style('stroke-width', function ( datum ) {
          return val(datum.borderWidth, options.borderWidth, datum);
        })
        .style('fill-opacity', function ( datum ) {
          return val(datum.fillOpacity, options.fillOpacity, datum);
        })
        .style('fill', function ( datum ) {
          var fillColor = fillData[ val(datum.fillKey, options.fillKey, datum) ];
          return fillColor || fillData.defaultFill;
        })
        .on('mouseover', function ( datum ) {
          var $this = d3.select(this);

          if (options.highlightOnHover) {
            //save all previous attributes for mouseout
            var previousAttributes = {
              'fill':  $this.style('fill'),
              'stroke': $this.style('stroke'),
              'stroke-width': $this.style('stroke-width'),
              'fill-opacity': $this.style('fill-opacity')
            };

            $this
              .style('fill', val(datum.highlightFillColor, options.highlightFillColor, datum))
              .style('stroke', val(datum.highlightBorderColor, options.highlightBorderColor, datum))
              .style('stroke-width', val(datum.highlightBorderWidth, options.highlightBorderWidth, datum))
              .style('fill-opacity', val(datum.highlightFillOpacity, options.highlightFillOpacity, datum))
              .attr('data-previousAttributes', JSON.stringify(previousAttributes));
          }

          if (options.popupOnHover) {
            self.updatePopup($this, datum, options, svg);
          }
        })
        .on('mouseout', function ( datum ) {
          var $this = d3.select(this);

          if (options.highlightOnHover) {
            //reapply previous attributes
            var previousAttributes = JSON.parse( $this.attr('data-previousAttributes') );
            for ( var attr in previousAttributes ) {
              $this.style(attr, previousAttributes[attr]);
            }
          }

          d3.selectAll('.datamaps-hoverover').style('display', 'none');
        })

    bubbles.transition()
      .duration(400)
      .attr('r', function ( datum ) {
        return val(datum.radius, options.radius, datum);
      });

    bubbles.exit()
      .transition()
        .delay(options.exitDelay)
        .attr("r", 0)
        .remove();

    function datumHasCoords (datum) {
      return typeof datum !== 'undefined' && typeof datum.latitude !== 'undefined' && typeof datum.longitude !== 'undefined';
    }
  }

  //stolen from underscore.js
  function defaults(obj) {
    Array.prototype.slice.call(arguments, 1).forEach(function(source) {
      if (source) {
        for (var prop in source) {
          if (obj[prop] == null) obj[prop] = source[prop];
        }
      }
    });
    return obj;
  }
  /**************************************
             Public Functions
  ***************************************/

  function Datamap( options ) {

    if ( typeof d3 === 'undefined' || typeof topojson === 'undefined' ) {
      throw new Error('Include d3.js (v3.0.3 or greater) and topojson on this page before creating a new map');
   }
    //set options for global use
    this.options = defaults(options, defaultOptions);
    this.options.geographyConfig = defaults(options.geographyConfig, defaultOptions.geographyConfig);
    this.options.projectionConfig = defaults(options.projectionConfig, defaultOptions.projectionConfig);
    this.options.bubblesConfig = defaults(options.bubblesConfig, defaultOptions.bubblesConfig);
    this.options.arcConfig = defaults(options.arcConfig, defaultOptions.arcConfig);

    //add the SVG container
    if ( d3.select( this.options.element ).select('svg').length > 0 ) {
      addContainer.call(this, this.options.element, this.options.height, this.options.width );
    }

    /* Add core plugins to this instance */
    this.addPlugin('bubbles', handleBubbles);
    this.addPlugin('legend', addLegend);
    this.addPlugin('arc', handleArcs);
    this.addPlugin('labels', handleLabels);
    this.addPlugin('graticule', addGraticule);

    //append style block with basic hoverover styles
    if ( ! this.options.disableDefaultStyles ) {
      addStyleBlock();
    }

    return this.draw();
  }

  // resize map
  Datamap.prototype.resize = function () {

    var self = this;
    var options = self.options;

    if (options.responsive) {
      var newsize = options.element.clientWidth,
          oldsize = d3.select( options.element).select('svg').attr('data-width');

      d3.select(options.element).select('svg').selectAll('g').attr('transform', 'scale(' + (newsize / oldsize) + ')');
    }
  }

  // actually draw the features(states & countries)
  Datamap.prototype.draw = function() {
    //save off in a closure
    var self = this;
    var options = self.options;

    //set projections and paths based on scope
    var pathAndProjection = options.setProjection.apply(self, [options.element, options] );

    this.path = pathAndProjection.path;
    this.projection = pathAndProjection.projection;

    //if custom URL for topojson data, retrieve it and render
    if ( options.geographyConfig.dataUrl ) {
      d3.json( options.geographyConfig.dataUrl, function(error, results) {
        if ( error ) throw new Error(error);
        self.customTopo = results;
        draw( results );
      });
    }
    else {
      draw( this[options.scope + 'Topo'] || options.geographyConfig.dataJson);
    }

    return this;

      function draw (data) {
        // if fetching remote data, draw the map first then call `updateChoropleth`
        if ( self.options.dataUrl ) {
          //allow for csv or json data types
          d3[self.options.dataType](self.options.dataUrl, function(data) {
            //in the case of csv, transform data to object
            if ( self.options.dataType === 'csv' && (data && data.slice) ) {
              var tmpData = {};
              for(var i = 0; i < data.length; i++) {
                tmpData[data[i].id] = data[i];
              }
              data = tmpData;
            }
            Datamaps.prototype.updateChoropleth.call(self, data);
          });
        }
        drawSubunits.call(self, data);
        handleGeographyConfig.call(self);

        if ( self.options.geographyConfig.popupOnHover || self.options.bubblesConfig.popupOnHover) {
          hoverover = d3.select( self.options.element ).append('div')
            .attr('class', 'datamaps-hoverover')
            .style('z-index', 10001)
            .style('position', 'absolute');
        }

        //fire off finished callback
        self.options.done(self);
      }
  };
  /**************************************
                TopoJSON
  ***************************************/
  Datamap.prototype.worldTopo = '__WORLD__';
  Datamap.prototype.abwTopo = '__ABW__';
  Datamap.prototype.afgTopo = '__AFG__';
  Datamap.prototype.agoTopo = '__AGO__';
  Datamap.prototype.aiaTopo = '__AIA__';
  Datamap.prototype.albTopo = '__ALB__';
  Datamap.prototype.aldTopo = '__ALD__';
  Datamap.prototype.andTopo = '__AND__';
  Datamap.prototype.areTopo = '__ARE__';
  Datamap.prototype.argTopo = {"type":"Topology","objects":{"arg":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Santa Cruz"},"id":"AR.SC","arcs":[[0,1]]},{"type":"MultiPolygon","properties":{"name":"Tierra del Fuego"},"id":"AR.TF","arcs":[[[2]],[[3]],[[4]]]},{"type":"Polygon","properties":{"name":"San Juan"},"id":"AR.SJ","arcs":[[5,6,7,8]]},{"type":"MultiPolygon","properties":{"name":"Chubut"},"id":"AR.CH","arcs":[[[9]],[[10]],[[11,-2,12,13]]]},{"type":"Polygon","properties":{"name":"Mendoza"},"id":"AR.MZ","arcs":[[14,15,16,17,-7]]},{"type":"Polygon","properties":{"name":"Neuquén"},"id":"AR.NQ","arcs":[[18,19,-17]]},{"type":"MultiPolygon","properties":{"name":"Buenos Aires"},"id":"AR.BA","arcs":[[[20]],[[21]],[[22]],[[23]],[[24]],[[25,26,27,28,29,30,31,32]]]},{"type":"Polygon","properties":{"name":"La Pampa"},"id":"AR.LP","arcs":[[-30,33,-16,34,35]]},{"type":"Polygon","properties":{"name":"Río Negro"},"id":"AR.RN","arcs":[[-29,36,-14,37,-19,-34]]},{"type":"Polygon","properties":{"name":"San Luis"},"id":"AR.SL","arcs":[[38,39,-35,-15,-6]]},{"type":"Polygon","properties":{"name":"Córdoba"},"id":"AR.CB","arcs":[[40,-31,-36,-40,41,42,43]]},{"type":"Polygon","properties":{"name":"Catamarca"},"id":"AR.CT","arcs":[[44,45,-43,46,47,48]]},{"type":"Polygon","properties":{"name":"Jujuy"},"id":"AR.JY","arcs":[[49,50]]},{"type":"Polygon","properties":{"name":"La Rioja"},"id":"AR.LR","arcs":[[-42,-39,-9,51,-47]]},{"type":"Polygon","properties":{"name":"Salta"},"id":"AR.SA","arcs":[[52,53,54,55,-49,56,-50,57]]},{"type":"Polygon","properties":{"name":"Santiago del Estero"},"id":"AR.SE","arcs":[[58,59,-44,-46,60,-55]]},{"type":"Polygon","properties":{"name":"Tucumán"},"id":"AR.TM","arcs":[[-61,-45,-56]]},{"type":"Polygon","properties":{"name":"Chaco"},"id":"AR.CC","arcs":[[61,62,63,-59,-54,64]]},{"type":"Polygon","properties":{"name":"Formosa"},"id":"AR.FM","arcs":[[-65,-53,65]]},{"type":"Polygon","properties":{"name":"Corrientes"},"id":"AR.CN","arcs":[[66,67,68,69,-63,70]]},{"type":"Polygon","properties":{"name":"Entre Ríos"},"id":"AR.ER","arcs":[[71,-33,72,-69]]},{"type":"Polygon","properties":{"name":"Santa Fe"},"id":"AR.SF","arcs":[[-73,-32,-41,-60,-64,-70]]},{"type":"Polygon","properties":{"name":"Misiones"},"id":"AR.MN","arcs":[[-67,73]]},{"type":"Polygon","properties":{"name":"Ciudad de Buenos Aires"},"id":"AR.DF","arcs":[[-27,74]]}]}},"arcs":[[[3014,2721],[-16,-22],[-4,-8],[-1,-9],[0,-10],[24,-48],[17,-24],[12,-11],[47,-39],[30,-11],[14,-6],[25,-3],[15,-2],[5,-3],[7,-6],[20,-6],[20,-2],[12,-2],[7,-9],[17,-7],[17,-11],[7,-7],[6,-1],[6,0],[5,-1],[5,-4],[4,-1],[5,-2],[45,-21],[29,-19],[19,-8],[44,-9],[19,1],[16,-5],[21,3],[10,-2],[10,0],[11,2],[10,0],[8,-1],[16,-4],[9,-1],[27,1],[9,-1],[5,-2],[27,-2],[52,-5],[58,2],[28,5],[13,1],[12,-1],[30,-8],[19,-1],[12,-5],[5,-8],[12,-4],[9,-4],[5,-2],[26,-9],[-6,-6],[9,-16],[7,-10],[6,-9],[-7,-21],[-5,-30],[-13,-17],[-14,-20],[-28,-33],[-10,-2],[-15,0],[-13,1],[-26,2],[-29,0],[-15,-6],[-17,-8],[-14,-4],[-13,-2],[-31,-7],[-32,-9],[-11,-1],[-39,0],[-8,0],[25,-4],[20,1],[38,9],[12,1],[28,3],[48,11],[13,7],[25,1],[22,0],[14,-1],[9,-4],[8,-16],[7,-13],[13,-6],[19,-2],[14,-2],[-13,-4],[-4,-3],[11,-2],[6,-2],[-12,-1],[-13,-2],[-12,-1],[-6,5],[-26,4],[-14,-3],[-9,-6],[-3,-5],[11,-4],[-4,-7],[-1,-2],[-4,-1],[-1,-4],[-10,-2],[3,-3],[13,-5],[17,-2],[3,-5],[-10,-5],[-14,-2],[-4,4],[-9,2],[-9,-2],[-13,0],[-23,-1],[-15,-2],[-9,-2],[-12,-4],[-4,-7],[-6,-5],[-3,-3],[-21,-4],[-19,-3],[-13,-10],[-18,-3],[-8,-4],[-10,-6],[-9,-11],[6,-9],[-5,-1],[-17,1],[-18,0],[-13,0],[-2,-1],[-9,-3],[3,-4],[-2,-7],[-17,-4],[-22,-3],[-16,0],[-37,-2],[-21,-7],[-29,-6],[-11,-6],[-18,-5],[-15,-8],[-10,-3],[-1,-7],[-3,-6],[-12,-1],[-13,-3],[-36,-2],[-28,-10],[-36,-9],[-11,-6],[-4,-14],[-20,-9],[-4,-8],[-3,-6],[-25,-8],[-37,-7],[-42,-11],[-75,-34],[-10,-9],[-7,-11],[-3,-7],[-10,-3],[-9,-4],[-1,-8],[10,-1],[3,-5],[-7,-2],[-4,-2],[-9,-2],[-3,-2],[-2,-3],[-5,-3],[-3,-8],[-14,-5],[-15,-2],[5,-3],[6,-3],[3,-3],[-3,-4],[-8,0],[-6,-3],[-9,-2],[6,-3],[0,-4],[-15,-5],[-28,-2],[-1,-2],[9,-1],[11,-1],[34,1],[14,5],[7,11],[-1,8],[8,4],[3,9],[9,4],[4,2],[8,-1],[7,-5],[0,-5],[-2,-12],[-21,-16],[-2,-5],[-10,-21],[-11,-21],[-4,-9],[0,-13],[-3,-7],[-2,-12],[2,-5],[-9,-29],[-16,-20],[-4,-7],[-8,-6],[-3,-4],[-3,-1],[-17,-14],[-31,-12],[-44,-14],[-47,-14],[-47,-8],[-45,-3],[-35,1],[-6,1],[-6,2],[-12,8],[-11,3],[-12,7],[-7,6],[-4,8],[-9,7],[-12,7],[-17,5],[-11,8],[-3,7],[-11,10],[-12,7],[-24,18],[-6,5],[-9,4],[-12,3],[-12,2],[-10,0],[31,-8],[7,-4],[3,-4],[14,-11],[17,-12],[9,-13],[0,-8],[-8,-3],[-16,-4],[-12,-2],[-12,-3],[-14,-1],[-21,2],[-30,-1],[-36,2],[-19,-6],[-17,-3],[-14,0],[-20,-5],[0,-2],[3,0],[5,0],[3,0],[11,0],[28,1],[17,6],[13,3],[6,0],[7,0],[14,-1],[16,1],[26,-2],[23,-2],[16,3],[19,4],[9,0],[8,-1],[4,-1],[4,-6],[10,-3],[7,-2],[0,-3],[0,-4],[3,-7],[9,-6],[14,-6],[11,-2],[13,-1],[8,-2],[6,-3],[14,-2],[6,-4],[-6,-6],[-17,-3],[-11,-4],[-10,-3],[-88,-15],[-62,-12],[-15,1],[-12,-5],[-2,-4],[-15,-2],[-8,0],[-8,1],[-10,-3],[-2,-6],[-10,-3],[-23,-13],[-14,-7],[-8,-7],[-10,-8],[-17,-11],[-8,-8],[-8,-6],[-2,-13],[-21,-23],[-10,-12],[-4,-7],[1,-4],[8,-8],[2,-19],[0,-9],[-4,-8],[-12,-4],[-23,-6],[-27,-11],[-44,-14],[-22,-9],[-10,-10],[15,5],[29,10],[18,5],[30,7],[16,4],[14,1],[5,-6],[0,-6],[6,-12],[11,-23],[8,-15],[2,-10],[9,-6],[3,-12],[9,-14],[49,-54],[4,-6],[1,-6],[-4,-5],[-10,-4],[-8,1],[-11,2],[-14,0],[-10,-3],[-17,-8],[-9,-2],[-14,1],[-12,1],[-56,12],[-38,1],[-9,0],[-6,-1],[-15,-4],[-28,-1],[-13,-1],[-23,-8],[-24,-3],[-11,-3],[109,10],[23,1],[24,-1],[53,-9],[21,-4],[-3,-5],[-28,-9],[0,-1],[10,0],[10,1],[41,9],[21,7],[14,4],[14,1],[14,-2],[18,-8],[32,-34],[23,-14],[37,-33],[34,-27],[82,-48],[62,-33],[17,-10],[5,-5],[-4,-5],[-14,-5],[-8,-4],[-6,-5],[-8,-1],[-4,3],[3,4],[-6,6],[0,11],[-3,3],[-12,2],[-39,3],[-9,1],[-15,4],[-9,1],[-100,6],[-19,3],[-75,17],[-102,12],[-137,2],[-90,14],[-85,14],[-60,9],[-40,0],[-114,1],[-113,1],[-113,0],[-113,1],[-113,0],[-113,1],[-113,1],[-114,0],[-40,0],[-24,6],[3,13],[6,10],[-5,8],[-12,7],[-14,5],[-32,15],[-34,12],[-23,5],[-47,6],[-10,3],[-7,6],[-4,17],[-4,5],[-11,5],[-12,1],[-13,0],[-13,1],[-11,7],[14,9],[36,14],[1,2],[0,3],[-1,3],[-1,3],[2,3],[3,2],[4,2],[3,2],[3,6],[0,16],[1,7],[4,4],[21,12],[6,4],[1,5],[-9,4],[-37,10],[-17,7],[-10,10],[-1,6],[4,4],[14,8],[9,6],[6,3],[8,1],[15,1],[8,7],[5,14],[5,26],[-3,11],[-11,8],[-13,6],[-14,9],[-4,5],[-1,4],[4,5],[18,15],[1,5],[-10,2],[-11,1],[-19,5],[-62,6],[-22,-4],[-34,-16],[-23,0],[-10,2],[-25,11],[-11,2],[-12,-1],[-62,-14],[-18,-5],[-36,-16],[-21,-6],[-22,-4],[-22,0],[-19,6],[-5,10],[1,12],[-3,11],[-6,4],[-21,11],[-6,5],[-2,5],[0,18],[-6,16],[-1,6],[1,12],[-1,6],[-5,9],[-8,11],[-11,9],[-12,7],[-9,4],[-21,4],[-62,23],[-6,8],[5,10],[26,18],[1,4],[-5,5],[-6,4],[-27,9],[-9,5],[2,4],[7,3],[6,4],[2,6],[0,4],[2,4],[26,11],[10,8],[-1,8],[-14,9],[-16,7],[-8,4],[-3,5],[3,5],[6,4],[5,5],[-1,6],[-6,5],[-15,6],[-7,4],[-6,6],[1,3],[15,6],[7,6],[-1,4],[-3,4],[0,6],[5,5],[9,3],[19,5],[9,4],[2,3],[-4,10],[0,8],[6,3],[157,1],[2,5],[6,2],[16,2],[0,2],[-33,3],[-3,2],[-7,3],[0,8],[6,7],[32,17],[5,4],[1,3],[0,4],[2,5],[7,7],[30,18],[4,2],[20,8],[24,4],[49,2],[22,3],[19,6],[36,15],[26,13],[14,9],[5,9],[2,12],[-3,32],[-12,16],[-4,15],[19,18],[20,6],[21,5],[32,4],[8,3],[14,8],[6,4],[2,2],[7,1],[7,-1],[15,-2],[6,1],[4,5],[-5,5],[-6,5],[-5,4],[1,5],[7,11],[1,6],[-12,36],[-5,7],[-17,2],[-6,1],[-4,2],[-1,3],[0,3],[-2,2],[-8,5],[-9,1],[-10,1],[-11,3],[-16,6],[-13,8],[-4,9],[10,10],[12,9],[13,21],[8,10],[48,34],[5,5],[4,5],[2,5],[1,6],[9,16],[0,5],[-8,3],[-11,1],[-6,3],[5,7],[7,4],[9,3],[20,4],[13,0],[27,-2],[11,1],[8,3],[13,8],[44,21],[10,7],[4,5],[0,3],[-4,3],[-3,5],[-1,5],[2,4],[6,2],[10,0],[32,-9],[17,-2],[16,4],[8,7],[1,9],[-6,7],[-10,7],[-13,4],[-32,8],[-11,6],[3,6],[33,8],[10,5],[-6,4],[-17,7],[-5,4],[0,4],[8,18],[3,2],[3,2],[3,2],[0,3],[-2,2],[-3,2],[-2,2],[0,3],[8,5],[13,1],[26,0],[11,2],[7,3],[14,8],[8,4],[28,7],[17,7],[3,10],[-7,21],[1,6],[4,4],[2,5],[-2,6],[-34,38],[-4,10],[-1,12],[2,14],[-2,8],[-10,6],[-30,9],[-25,10],[-4,1],[-5,1],[-2,1],[1,3],[4,2],[7,1],[37,2],[12,1],[11,3],[7,4],[11,9],[6,4],[37,17]],[[973,2721],[2,0],[1009,0],[636,0],[393,0],[1,0]],[[2476,50],[6,10],[0,16],[5,-2],[11,-8],[5,-3],[10,-4],[4,-2],[2,-5],[-10,-2],[-33,0]],[[4640,101],[9,-2],[9,2],[2,-1],[3,-1],[2,0],[3,0],[7,-1],[15,1],[9,0],[6,-2],[6,-3],[6,-2],[6,0],[3,3],[-2,3],[0,2],[8,1],[3,-1],[7,-3],[5,0],[4,1],[4,1],[4,2],[5,0],[3,-2],[6,-6],[5,-2],[6,0],[15,5],[55,5],[17,-2],[-4,-2],[10,-1],[12,3],[10,2],[7,-4],[-11,-3],[-4,-2],[-4,-2],[-7,-7],[-4,-2],[-7,-1],[-9,0],[-7,-1],[-25,-8],[-6,0],[-6,1],[3,3],[9,7],[2,2],[-3,4],[-6,1],[-7,-2],[-7,-3],[-7,-3],[-7,-1],[-18,1],[-3,0],[-2,0],[-6,-1],[-2,-1],[-2,-2],[-1,-1],[-1,-2],[-13,-2],[-46,-3],[-3,-3],[-7,-1],[-8,0],[-6,3],[1,4],[2,4],[7,7],[-9,0],[-4,-1],[-4,-2],[-7,3],[-6,-1],[-11,-3],[-27,-7],[-6,-2],[-9,-4],[-6,-2],[-8,-1],[-9,-1],[-18,0],[2,1],[1,1],[1,1],[3,1],[0,2],[-6,0],[-5,0],[-5,-2],[-4,-2],[2,0],[4,-2],[-6,-2],[-24,-4],[-6,-3],[-7,-5],[-4,-2],[-9,-1],[-26,0],[-7,1],[-3,2],[3,2],[6,3],[5,3],[-45,10],[2,6],[11,3],[12,3],[6,4],[6,3],[16,-3],[24,-6],[11,1],[30,4],[9,3],[-28,11],[-5,4],[14,2],[4,-1],[12,-7],[6,-2],[18,-2],[5,0],[10,3],[4,1],[4,0],[5,0],[4,-2],[2,-3],[0,-5],[2,-2],[3,-1],[6,1],[1,1],[-1,2],[-1,2],[1,5],[-2,4],[1,4],[6,5],[4,0],[7,-3]],[[2671,623],[18,-32],[2,-5],[-3,-5],[-5,3],[-6,7],[-14,21],[-12,3],[-10,-1],[-12,-2],[-16,-5],[-15,-5],[-25,-11],[-30,-10],[-17,-14],[-5,-11],[7,-11],[21,-9],[29,-9],[20,0],[23,-3],[34,-3],[54,2],[39,-10],[10,-9],[8,-6],[-3,-10],[2,-3],[6,-5],[5,-14],[4,-6],[28,-20],[4,-4],[96,-38],[34,-9],[11,-5],[2,-5],[-5,-4],[13,0],[12,1],[15,-4],[36,-7],[4,-3],[-14,-1],[-5,-5],[2,-8],[6,-4],[137,-44],[79,-21],[57,-10],[33,-7],[9,-6],[18,-4],[71,-11],[33,-11],[23,-18],[51,-17],[13,-8],[18,-3],[5,-8],[17,-2],[15,-1],[21,-3],[44,-10],[173,-30],[7,-1],[13,0],[7,-1],[17,-6],[6,0],[38,-1],[35,-4],[121,7],[26,-2],[13,0],[35,6],[77,-4],[7,-2],[-4,-4],[-9,-5],[-9,-2],[-4,-2],[-15,-16],[2,-2],[3,-3],[2,-2],[-17,-5],[-4,-2],[1,-3],[3,-4],[0,-3],[-11,-2],[-16,-5],[-4,-2],[-13,-18],[-6,-3],[-8,-1],[-6,-1],[-11,1],[-2,2],[1,4],[-3,4],[-14,2],[-17,0],[-11,-3],[4,-6],[-11,-5],[-41,1],[-17,-2],[-4,-2],[-3,-3],[-3,-3],[-7,-2],[-10,-1],[-9,1],[-6,2],[-6,4],[0,2],[1,4],[-1,2],[-2,2],[-2,2],[-7,0],[-9,1],[-10,0],[-20,-3],[-34,5],[-12,-4],[-32,3],[-11,-3],[7,-4],[11,-4],[-9,-5],[-12,-5],[-34,-4],[-28,-3],[-40,1],[-60,-1],[-28,-3],[2,-5],[-2,-5],[-27,-2],[-13,-2],[-45,0],[-45,6],[-14,3],[-11,5],[-8,4],[-9,4],[-44,11],[-14,2],[-58,2],[-43,7],[-151,4],[-105,5],[-63,-1],[-133,5],[-73,5],[-23,7],[-48,1],[-27,6],[-15,2],[-6,-3],[2,-7],[-2,-2],[-7,-3],[-96,-3],[-13,1],[-9,3],[-16,8],[-20,8],[-3,1],[1,80],[1,81],[1,81],[1,80],[0,81],[1,80],[1,81],[1,80],[17,-4],[4,-3],[10,-9],[4,-3],[33,-18],[32,-21],[9,-5],[35,-11],[15,-8],[13,-9],[10,-11]],[[3441,6966],[-128,-3],[-19,2],[-3,0],[-2,1],[-3,1],[-6,3],[-4,1],[-6,1],[-12,1],[-6,1],[-5,0],[-17,-3],[-42,-2],[-10,1],[-8,0],[-16,3],[-21,2],[-11,-3],[-5,-3],[-4,-3],[-1,-2],[-1,-2],[0,-2],[0,-3],[3,-7],[1,-4],[-1,-4],[0,-1],[0,-1],[1,-1],[2,-3],[1,-3],[0,-2],[-1,-1],[0,-1],[-8,-13],[-1,-3],[-1,-3],[1,-7],[1,-5],[0,-18],[1,-9],[-1,-21]],[[3109,6850],[-38,14],[-13,1],[-5,-2],[-5,-1],[-7,-1],[-33,0],[-30,-4],[-14,0],[-4,0],[-9,-2],[-4,0],[-3,0],[-7,-2],[-2,0],[-47,4],[-3,1],[-12,9],[-6,4],[-7,3],[-19,4],[-7,3],[-4,10],[-6,4],[-13,8],[-17,5],[-18,1],[-56,-8],[-5,-2],[-19,-8],[-18,-4],[-11,-1],[-61,-2],[-6,-2],[-4,-3],[-7,-6],[-17,-7],[-88,-31],[-26,-7],[-99,0],[-4,1],[-4,2],[-10,75],[-1,1],[-3,1],[-6,0],[-24,-3],[-17,1],[-7,2],[-10,5],[-4,2],[-3,3],[-5,5],[-20,13],[-7,3],[-5,2],[-6,1],[-9,0],[-4,0],[-3,-1],[-3,0],[-2,-2],[-6,-5],[-3,-1],[-4,-1],[-5,-1],[-7,-1],[-2,-1],[-1,-1],[-3,-2],[-6,-9],[-2,-1],[-2,-1],[-2,-1],[-3,-1],[-5,-1],[-8,-1],[-25,3],[-27,0],[-13,-1],[-3,0],[-10,-3],[-13,-6],[-5,-1],[-11,-3],[-31,-5],[-3,0],[-5,-2],[-2,-1],[-4,-2],[-2,-2],[-1,-1],[-1,-2],[-1,-2],[2,-17],[-1,-3],[-1,-2],[-1,-2],[-1,-2],[-2,-1],[-3,-1],[-3,-2],[-6,-1],[-4,-1],[-58,-2],[-98,-12],[-23,3],[-12,2],[-20,0],[-77,-6],[-6,-1]],[[1672,6835],[-7,4],[-11,3],[-9,0],[-6,3],[-4,7],[0,3],[1,5],[0,3],[-2,3],[0,1],[-6,6],[-1,4],[1,2],[3,5],[1,3],[-2,2],[-8,3],[-2,3],[0,6],[-1,2],[-3,3],[-9,4],[-2,3],[1,4],[7,3],[11,-1],[21,-4],[13,0],[4,3],[4,11],[5,4],[5,4],[3,4],[-1,5],[-6,5],[-10,6],[-10,5],[-9,3],[-22,1],[-18,0],[-17,2],[-18,10],[-6,5],[-4,7],[-3,7],[1,13],[-5,5],[-15,9],[-27,28],[-4,7],[-1,5],[5,14],[1,11],[0,11],[2,6],[9,9],[1,6],[-2,6],[-4,6],[-1,5],[11,12],[2,6],[0,11],[1,6],[3,5],[28,23],[6,2],[10,-3],[3,-6],[3,-7],[6,-4],[7,2],[8,3],[6,5],[5,9],[5,6],[11,9],[9,3],[22,-2],[6,1],[-1,4],[-6,4],[-14,6],[-9,5],[-5,5],[-2,5],[10,42],[7,10],[3,2],[9,7],[3,3],[0,3],[-2,3],[0,4],[2,6],[3,5],[10,9],[7,10],[10,23],[10,9],[8,3],[8,2],[7,3],[3,6],[-2,6],[-13,11],[0,6],[14,3],[41,-11],[17,-2],[18,3],[15,4],[14,5],[13,8],[4,5],[2,6],[1,11],[2,6],[1,2],[3,3],[4,2],[10,3],[4,1],[7,12],[-7,10],[-16,8],[-19,4],[-19,-2],[-8,1],[-4,5],[3,5],[17,13],[7,11],[3,11],[3,41],[-7,26],[-4,4],[-13,6],[-5,6],[0,7],[2,9],[0,9],[-11,28],[-3,4],[-3,3],[-4,3],[-4,15],[-4,5],[-4,4],[-4,4],[-1,5],[2,14],[5,7],[10,3],[6,1],[5,2],[4,2],[3,2],[-1,3],[-6,4],[0,1],[2,2],[2,1],[3,0],[8,4],[13,5],[6,2],[3,4],[0,2],[2,2],[8,2],[26,2],[11,3],[9,6],[3,7],[1,8],[-3,15],[-2,6],[0,6],[1,6],[4,6],[5,4],[6,4],[3,3],[1,2],[-1,3],[1,2],[15,14],[2,6],[-2,6],[-8,13],[-2,7],[1,10],[6,10],[10,9],[11,8],[3,1],[4,1],[4,1],[2,3],[1,32],[9,17]],[[1974,8011],[34,-5],[4,-1],[10,-3],[4,-1],[4,-1],[7,0],[6,0],[8,1],[5,1],[6,1],[3,0],[3,-1],[4,-1],[8,-8],[2,-1],[3,-2],[6,-2],[5,-1],[4,0],[25,1],[4,-1],[4,-1],[74,-33],[14,-8],[7,-11],[7,-7],[6,-9],[4,-12],[6,-8],[33,-16],[8,-5],[7,-6],[5,-10],[8,-11],[3,-3],[5,-3],[13,-5],[5,-3],[4,-2],[2,-2],[2,-2],[2,-3],[0,-3],[-1,-3],[-4,-5],[-6,-2],[-6,-1],[-6,-1],[-5,-2],[-5,-3],[-12,-12],[-3,-9],[0,-14],[2,-11],[8,-5],[9,-4],[4,-6],[5,-5],[1,-1],[2,-1],[0,-2],[0,-1],[-3,-3],[-3,-1],[-3,-1],[-2,0],[-3,-1],[-2,-2],[-2,-4],[-4,-18],[3,-9],[1,-2],[-2,-3],[-2,-2],[-7,-5],[-7,-6],[-1,-1],[-2,-4],[-3,-15],[1,-9],[1,-3],[3,-2],[2,-1],[17,-4],[12,0],[29,5],[4,0],[5,-1],[14,-3],[6,0],[8,0],[5,0],[3,0],[27,6],[14,2],[13,1],[4,-1],[6,-1],[29,-10],[4,0],[4,-1],[9,-1],[5,0],[7,0],[12,2],[7,0],[15,-1],[62,-11],[15,-1],[4,-1],[3,-1],[12,-10],[8,-4],[20,-8],[29,-10],[7,-3],[3,-3],[4,-4],[1,-3],[1,-1],[2,-1],[2,-2],[4,-1],[23,-3],[11,-4],[24,-14],[2,-4],[4,-6],[3,-1],[3,-2],[18,-6],[3,-1],[4,-2],[13,-11],[7,-4],[14,-6],[7,-2],[24,-5],[4,-1],[3,-2],[13,-11],[6,-4],[69,-28],[4,-3],[16,-13],[7,-7],[5,-12],[2,-3],[1,-2],[2,-2],[4,-1],[33,-11],[3,-2],[3,-2],[13,-13],[3,-2],[7,-4],[20,-10],[11,-3],[4,-2],[9,-4],[23,-20],[4,-2],[13,-11],[3,-2],[4,-2],[21,-4],[3,-1],[4,-2],[5,-4],[20,-25],[6,-5],[6,-5],[8,-7],[10,-8],[1,-1],[0,-3],[-19,-31],[2,-9],[28,-13],[-22,-82],[5,-7],[17,-18],[4,-6],[0,-16],[1,-4],[3,-2],[4,-3],[41,-21],[5,-1],[2,-1],[7,-1],[30,-2],[3,-1],[3,-1],[1,-4],[0,-5],[0,-2],[6,-12],[1,-9],[1,-2],[2,-2],[5,-2],[4,-1],[4,0],[3,0],[4,-1],[5,-2],[13,-12],[13,-19]],[[3812,2994],[3,-2],[8,0],[4,-2],[9,-1],[-3,-3],[-9,2],[-11,0],[-11,4],[-5,4],[15,-2]],[[4017,3005],[8,-2],[-8,0],[-9,0],[-7,-1],[-6,3],[7,3],[6,0],[9,-3]],[[4282,3920],[25,-25],[16,-10],[19,-8],[39,-12],[7,-1],[11,1],[5,0],[4,-2],[9,-3],[12,-3],[12,-2],[10,-1],[26,0],[11,-1],[10,-4],[11,-3],[11,0],[13,3],[12,1],[13,-1],[7,0],[5,-2],[7,-4],[1,-3],[-13,-2],[-10,-5],[-39,-24],[-3,-3],[-4,-10],[3,-2],[15,-2],[40,2],[21,-5],[17,0],[18,2],[11,1],[11,3],[8,1],[94,-3],[12,2],[5,4],[3,1],[14,7],[4,2],[0,2],[0,6],[0,1],[-3,2],[-1,2],[1,1],[3,1],[2,0],[1,2],[-1,4],[-5,6],[-1,3],[-4,3],[-10,2],[-23,2],[-55,-2],[-27,2],[-21,6],[16,4],[73,4],[62,16],[40,13],[44,9],[31,4],[20,-2],[19,-8],[11,-9],[15,-18],[2,-6],[4,-4],[7,-4],[17,-7],[11,-11],[4,-12],[-4,-30],[9,-46],[-6,-12],[-13,-13],[-8,-12],[7,-11],[-26,-15],[-33,-7],[-103,-10],[-31,0],[-11,-1],[-22,-5],[-19,-1],[-15,5],[-12,6],[-17,11],[-9,5],[-10,2],[-9,3],[0,7],[4,7],[3,4],[10,18],[5,2],[6,2],[-3,2],[-11,5],[-3,0],[-7,2],[-3,1],[-2,2],[-2,1],[-19,4],[-6,4],[-3,5],[-5,4],[-11,4],[-21,4],[-25,3],[-53,0],[-36,-3],[-13,-2],[-11,-2],[-13,-5],[-18,-2],[-5,-1],[-4,-2],[-22,-14],[-9,-4],[-10,-1],[-25,-1],[-25,-4],[-11,-3],[-7,-5],[-4,-5],[-7,-6],[-16,-8],[-3,-4],[3,-8],[8,-4],[20,-2],[16,-6],[32,-4],[62,-14],[17,-5],[19,-8],[10,-3],[16,-2],[12,-2],[5,-1],[8,0],[13,1],[13,1],[5,0],[4,-1],[8,-4],[9,-3],[4,-1],[10,-3],[12,0],[41,7],[6,1],[0,-2],[7,-8],[-3,-3],[-10,-5],[-60,-18],[-59,-11],[-101,-13],[-89,-27],[-16,-9],[-10,-5],[-10,-3],[-9,-1],[-5,-7],[0,-5],[3,-6],[2,-6],[-3,-5],[-8,-4],[-10,-2],[-40,-19],[-19,-16],[-9,-5],[-27,-10],[-6,-2],[-19,-15],[-2,-3],[-7,-5],[-1,-3],[1,-17],[2,-5],[11,-10],[-3,-3],[-3,-7],[0,-5],[4,-3],[7,-2],[4,-5],[3,-6],[3,-4],[2,-5],[-2,-11],[2,-4],[7,-1],[9,1],[6,-3],[-12,-4],[5,-7],[0,-5],[10,-3],[18,0],[-13,-4],[-10,-5],[-3,-5],[1,-5],[1,-4],[6,-2],[4,-5],[-8,-2],[-16,-1],[-10,-2],[-8,-4],[-5,-10],[0,-7],[2,-5],[6,-5],[4,-2],[4,-1],[4,-2],[-2,-3],[2,-2],[1,-4],[7,-1],[-2,-3],[-1,-2],[6,-4],[8,1],[4,-2],[0,-5],[3,-3],[-6,-1],[-3,-3],[-1,-2],[-6,-1],[-6,0],[-3,-2],[-2,-3],[-5,0],[-3,-2],[3,-1],[1,-2],[-5,0],[-1,-1],[4,-1],[-2,-1],[-6,0],[-3,2],[-3,-1],[-1,-1],[3,-2],[-2,-2],[-3,0],[-2,-2],[-4,0],[-2,-2],[3,-1],[5,-1],[2,-1],[-1,-2],[-3,-2],[-1,-2],[4,-1],[3,0],[3,0],[3,1],[7,-1],[0,-2],[-3,-1],[0,-2],[4,-1],[0,-1],[-5,-1],[-7,1],[-3,-1],[-1,-1],[-2,-2],[-2,-1],[-2,2],[1,3],[-2,2],[-6,1],[-6,-1],[-2,-2],[-3,0],[-3,1],[-4,-1],[-1,-2],[3,-2],[4,-1],[0,-2],[-4,-1],[-6,0],[-3,-1],[-3,-2],[1,-3],[6,-1],[4,0],[3,-2],[5,0],[-1,-2],[-6,-2],[-2,0],[-1,3],[-4,0],[-2,-1],[-2,-2],[-2,-2],[-3,1],[-3,1],[-2,3],[-3,1],[-2,-1],[-1,1],[-3,1],[-4,-1],[-6,-1],[-6,0],[-2,-2],[0,-3],[2,-3],[-7,1],[-2,-2],[-10,0],[-22,-4],[-18,-9],[-10,2],[-22,-8],[-9,-4],[-5,-5],[-4,-2],[-4,-2],[-5,-7],[2,-8],[-1,-5],[-3,-4],[-2,-3],[-7,-1],[-4,-1],[0,-6],[4,-2],[-3,-1],[-2,-3],[6,-6],[9,-2],[6,1],[2,-2],[4,0],[2,-1],[3,-2],[8,0],[7,1],[9,-1],[9,-3],[13,1],[10,-5],[9,-1],[7,-5],[-7,-1],[-6,-3],[-7,-2],[-2,-2],[-4,-1],[-7,1],[-4,-2],[-5,-2],[2,-4],[6,-3],[2,-4],[-8,1],[-6,2],[-5,-3],[3,-1],[7,-5],[-20,-6],[-11,2],[-10,-1],[-3,-5],[-22,8],[-9,3],[-17,-1],[-9,0],[-7,-4],[-6,2],[1,6],[-7,4],[-7,-1],[-8,0],[-9,-1],[-1,-5],[2,-4],[-10,0],[-14,-3],[-14,2],[-11,6],[-16,6],[-14,-1],[-33,5],[-29,-2],[-16,1],[-10,-7],[-20,-7],[-11,-6],[-9,3],[-8,1],[-10,0],[-7,0],[-9,-1],[-2,-2],[-11,1],[-5,-4],[-32,-4],[-15,-3],[-13,-6],[-1,-7],[25,-3],[10,-2],[-9,-6],[-49,8],[-8,1],[-1,-9],[23,-2],[10,-6],[0,-6],[-19,0],[-54,0],[-59,-4],[-41,-2],[-31,-7],[-16,-6],[-24,-8],[-28,-14],[-16,-12],[-18,-10],[-17,-11],[-17,-12],[-11,-8],[-24,-10],[-12,-9],[-7,-3],[-12,-4],[-6,-6],[-6,-8],[0,-9],[1,-5],[10,-4],[-3,-3],[-3,-1],[-9,-1],[0,-4],[-3,-4],[1,-2],[4,-2],[-2,-3],[-6,-2],[-10,1],[-16,-5],[-7,-3],[-7,-2],[-9,-12],[-15,-5],[-6,-5],[-10,-6],[-6,-5],[7,-8],[-12,-2],[-10,-8],[-2,-2]],[[973,2721],[18,9],[-6,11],[-8,8],[-12,7],[-18,4],[-21,4],[-8,3],[-3,5],[2,4],[5,4],[1,5],[-7,5],[-13,6],[-5,3],[-2,5],[1,2],[8,6],[2,2],[-1,2],[-2,2],[-1,2],[1,5],[2,4],[9,7],[3,2],[4,1],[3,2],[1,2],[-2,2],[-8,3],[-1,1],[8,7],[18,5],[20,3],[17,1],[39,-1],[18,1],[18,7],[6,4],[-2,5],[-10,9],[-4,6],[1,3],[50,9],[9,2],[8,4],[12,7],[8,3],[11,7],[-2,10],[-11,10],[-13,8],[-16,7],[-27,8],[-19,10],[-5,4],[-9,14],[-20,18],[-17,8],[-17,1],[-19,-1],[-21,1],[-8,3],[-13,7],[-8,3],[-11,1],[-12,0],[-11,-2],[-11,-2],[-20,-2],[-20,4],[-20,6],[-20,3],[-22,0],[-10,1],[-4,5],[3,10],[1,4],[-8,17],[7,6],[14,2],[19,-3],[11,-2],[67,-6],[11,1],[10,3],[6,4],[7,2],[12,1],[11,-1],[34,-6],[21,0],[45,9],[22,2],[20,-3],[40,-12],[21,-3],[19,2],[18,5],[12,9],[4,12],[-4,10],[-1,5],[3,6],[11,10],[7,4],[5,2],[11,0],[10,1],[8,4],[4,6],[0,6],[-4,3],[-6,2],[-6,4],[-4,5],[-1,5],[-3,4],[-8,4],[-12,4],[-12,1],[-26,0],[-76,6],[-103,0],[-26,3],[-22,0],[-21,-3],[-21,0],[-19,8],[-2,5],[8,3],[12,3],[7,2],[3,5],[-4,5],[-6,4],[-4,5],[2,5],[11,9],[1,5],[-4,6],[-16,12],[-7,12],[12,4],[19,2],[17,7],[9,6],[38,25],[5,6],[0,4],[-29,21],[-6,3],[-4,2],[-10,2],[-3,2],[-1,3],[2,2],[2,2],[2,3],[-1,7],[-4,1],[-6,-2],[-11,-2],[-10,2],[-1,5],[2,5],[6,4],[8,3],[21,4],[10,2],[8,4],[3,4],[-4,17],[-2,4],[-5,2],[-21,7],[-3,1],[-3,2],[-2,2],[-4,2],[-5,1],[-12,1],[-13,0],[-12,1],[-4,4],[2,2],[10,6],[0,6],[-5,5],[-9,2],[-10,2],[-5,-1],[-5,-1],[-6,-1],[-5,1],[-4,3],[3,2],[4,1],[3,2],[-3,9],[1,2],[3,3],[3,1],[4,1],[4,2],[1,3],[1,9],[3,2],[6,1],[13,0],[20,4],[10,1],[22,-2],[5,4],[1,5],[0,6],[-1,2],[-3,5],[-1,3],[2,3],[4,5],[2,3],[-4,5],[-10,3],[-46,9],[-74,3],[-22,5],[-21,8],[-17,11],[-10,13],[4,11],[11,19],[3,11],[-4,43],[-2,5],[-7,10],[-1,4],[4,7],[1,3],[-2,2],[-5,5],[-2,2],[3,11],[10,8],[15,6],[26,6],[1,3],[-3,3],[-15,11],[-1,3],[8,16],[-4,6],[-26,11],[-6,8],[4,7],[11,7],[13,6],[9,7],[4,8],[6,8],[15,6],[16,0],[8,-6],[7,-7],[12,-3],[7,1],[5,3],[3,3],[5,3],[6,1],[36,3],[14,3],[12,5],[6,6],[-1,16],[-3,2],[-9,5],[-3,2]],[[913,3923],[4,0],[265,1],[920,-1],[56,0],[429,0],[177,0],[600,0],[427,0],[150,0],[305,0],[32,-3],[4,0]],[[3109,6850],[1,-12],[14,-28],[12,-4],[5,-3],[4,-3],[1,-3],[-1,-5],[2,-2],[3,-2],[3,-2],[2,-3],[2,-8],[7,-9],[1,-4],[1,-5],[10,-24],[3,-4],[4,-4],[6,-3],[6,-2],[3,-3],[2,-5],[2,-5],[5,-3],[2,-4],[-8,-9],[-3,-8],[-2,-3],[7,-12],[-1,-7],[-7,-4],[-3,-3],[4,-8],[11,-13],[0,-4],[-3,-6],[-1,-3],[2,-3],[4,-6],[4,-27],[-3,-24],[4,-8],[3,-3],[0,-11],[12,-14],[2,-6],[-2,-13],[1,-5],[4,-7],[48,-42],[10,-5],[4,-3],[6,-11],[3,-2],[7,-13],[11,-11],[13,-20],[1,-6],[4,-3],[9,-4],[18,-6],[8,-4],[8,-4],[6,-5],[5,-14],[7,-4],[8,-3],[7,-3],[4,-5],[3,-9],[9,-7],[0,-5],[-2,-9],[-2,-16],[-2,-7],[-7,-4],[-4,0],[-7,2],[-3,0],[-2,-1],[-1,-4],[-8,-6],[0,-4],[4,-8],[2,-23],[5,-5],[-6,-7],[4,-3],[8,-4],[5,-6],[3,-25],[12,-20],[2,-6],[3,-5],[24,-13],[60,-58],[13,-22],[1,-6],[-5,-16],[1,-4],[8,-11],[1,-6],[2,-3],[10,-9],[2,-5],[-1,-5],[-9,-18],[5,-3],[4,-3],[1,-2],[-1,-4],[-2,-3],[-2,-2],[-2,-2],[6,-19],[1,-5],[-6,-18],[-2,-27],[-2,-6],[-15,-17],[-6,-31],[-21,-47],[-3,-22],[-7,-14],[0,-5],[3,-10],[3,0]],[[3498,5727],[-222,0],[-38,0],[-558,0],[-9,-2],[-9,-5],[-4,-20],[-1,-12],[1,-5],[3,-3],[14,-36],[4,-168],[0,-217]],[[2679,5259],[-89,6],[-8,2],[-10,5],[-15,16],[-7,4],[-10,2],[-33,0],[-5,0],[-11,3],[-6,1],[-16,0],[-5,0],[-10,3],[-19,11],[-11,2],[-64,-2],[-26,1],[-24,4],[-18,6],[-9,9],[-11,23],[-14,9],[-9,3],[-24,4],[-21,2],[-32,7],[-21,1],[-89,-8],[-26,1],[-26,2],[-21,4],[-40,12],[-17,8],[-36,23],[-3,4],[2,3],[8,5],[4,3],[1,3],[0,6],[2,3],[-3,5],[-1,12],[-8,5],[-8,2],[-8,2],[-13,3],[-2,0],[-20,9],[-5,2],[-2,3],[-7,11],[-5,6],[-5,5],[-17,7],[-10,2],[-2,1],[-3,2],[-2,1],[-5,5],[-10,6],[-3,1],[-4,3],[-3,1],[-38,5],[-5,2],[-2,1],[-7,4],[-11,11],[-14,19],[-1,4],[-12,21],[-1,2],[-3,2],[-5,2],[-5,1],[-4,1],[-3,0],[-3,0],[-3,-1],[-2,-1],[-4,-3],[-2,-1],[-3,0],[-4,0],[-3,0],[-3,1],[-2,1],[-2,2],[-5,4],[-6,8],[-1,2],[-1,4],[-1,5],[1,2],[2,2],[2,1],[2,1],[3,2],[1,1],[1,2],[1,4],[0,8],[-1,4],[-1,2],[-3,4],[-2,2],[-8,4],[-19,7],[-3,2]],[[1584,5688],[4,4],[6,10],[4,2],[8,5],[4,4],[-2,5],[-15,18],[0,4],[4,5],[3,2],[4,2],[3,1],[1,3],[-4,2],[-10,-1],[-5,2],[1,10],[31,16],[-2,10],[-7,6],[-23,31],[-1,5],[6,11],[0,6],[-3,12],[5,12],[-4,5],[-8,4],[-7,5],[-12,20],[-1,4],[5,3],[10,1],[7,3],[-6,8],[-18,5],[-23,1],[-20,4],[-9,11],[18,15],[78,13],[10,21],[-2,21],[-1,1],[10,21],[39,47],[-2,4],[-6,2],[-8,5],[-4,5],[3,2],[8,1],[10,2],[11,10],[5,23],[7,10],[9,5],[21,9],[9,6],[11,15],[7,6],[24,10],[4,6],[0,7],[-2,9],[-1,9],[4,6],[4,3],[4,2],[26,2],[10,0],[11,-1],[18,-4],[3,2],[0,2],[1,1],[35,8],[2,3],[-4,7],[-12,12],[-4,4],[-2,5],[1,3],[1,2],[3,5],[4,23],[0,14],[-5,8],[-9,1],[-9,-2],[-4,1],[1,9],[4,11],[1,6],[-9,23],[0,6],[4,4],[17,7],[7,3],[0,5],[-14,10],[-4,4],[1,6],[10,17],[0,4],[-2,2],[-1,3],[2,3],[3,1],[10,2],[4,1],[2,4],[2,14],[1,5],[5,4],[14,9],[3,5],[0,5],[-9,11],[-4,17],[-12,7],[-16,4],[-18,4],[-18,-1],[-21,-16],[-14,-1],[-15,18],[-6,4],[-17,7],[-7,4],[-4,6],[-1,6],[9,17],[-1,6],[-5,5],[-1,1],[-2,4],[4,6],[7,3],[16,2],[7,3],[4,4],[5,13],[4,6],[8,8],[0,4],[-7,2],[-11,3],[-9,2],[-16,9],[-27,16],[-8,9],[-12,33],[0,6],[1,6],[1,3],[3,2],[12,0],[4,1],[-10,8],[-1,5],[1,6],[-1,6],[-6,6],[-8,4],[-20,5],[-9,10],[2,22],[-7,5]],[[2679,5259],[0,-3],[0,-47],[-1,-282],[2,-6],[11,-5],[23,-14],[65,-48],[6,-7],[1,-5],[0,-5],[2,-3],[9,-1],[2,-1],[-54,-6],[-17,0],[-23,4],[-9,0],[-8,-1],[-7,-2],[-7,-1],[-14,4],[-11,6],[-6,0],[-21,-8],[-8,-2],[-17,-4],[-32,-19],[-17,-4],[-16,-2],[-16,-4],[-15,-7],[-13,-8],[-15,-13],[-6,-4],[-8,-4],[-8,-3],[-22,-4],[-7,-5],[-4,-3],[-14,-5],[-6,-4],[-8,-16],[-3,-3],[-2,-2],[-26,-7],[-6,-2],[-3,-2],[-19,-17],[-5,-3],[-5,-3],[-5,-1],[-24,-5],[-13,-4],[-3,-1],[-14,0],[-15,0],[-6,-1],[-7,-2],[-24,-8],[-3,-1],[-11,-2],[-16,-4],[-11,-4],[-8,-5],[-11,-8],[-2,-1],[-1,-4],[-27,-18],[-9,-4],[-20,-7],[-35,-16],[-13,-4],[-12,-1],[-46,2],[-16,0],[-8,-1],[-122,-34],[-11,-4],[-8,-5],[-3,-2],[0,-3],[-1,-5],[-1,-3],[-7,-8],[-3,-6],[-4,-17],[-1,-4],[-4,-6],[-2,-3],[1,-10],[0,-3],[-4,-5],[-11,-9],[-18,-23],[-3,-7],[0,-15],[-1,-8],[-6,-6],[-4,-3],[-6,-2],[-7,-1],[-6,-1],[-4,-1],[-11,1],[-4,-1],[-5,-3],[-6,-13],[-6,-5],[-12,-4],[-44,1],[-39,-6],[-21,0],[-17,6],[-8,5],[-10,4],[-11,1],[-12,-1],[-8,-2],[-20,-10],[-14,-6],[-18,-4],[-19,-2],[-16,1],[-7,1],[-16,2],[-8,0],[-8,-2],[-13,-5],[-7,-1],[0,-1],[-12,-1],[-15,-1],[-25,-6],[-5,-2],[-5,-2],[-4,-3],[-4,-3],[-1,-2],[-2,-5],[-1,-2],[-7,-3],[-17,-2],[-8,-2],[-2,-1],[-4,-4],[-2,-2],[-4,-1],[-8,-3],[-3,-2],[-3,-3],[-1,-3],[0,-3],[2,-2],[5,-5],[9,-3],[11,-3],[8,-3],[8,-4],[7,-6],[3,-6],[-2,-7],[-6,-5],[-7,-5],[-31,-16],[-7,-7],[-3,-2],[-5,-2],[-12,-3],[-7,-2],[-15,-4],[-28,-3],[-13,-1],[-31,2],[-97,17],[-18,1],[-38,0],[-34,4],[-63,1],[-5,1]],[[863,4221],[0,3],[8,13],[0,5],[-4,8],[-5,5],[-20,14],[-6,7],[-17,32],[3,3],[38,19],[11,9],[2,11],[-1,3],[-5,3],[-1,3],[2,2],[9,8],[18,27],[4,4],[6,1],[21,-3],[7,0],[5,2],[20,22],[2,5],[1,3],[-1,3],[-2,3],[-4,2],[-6,1],[-3,1],[-7,-2],[-3,-1],[0,-1],[-3,-1],[-6,0],[-4,2],[-10,7],[-16,8],[-7,4],[-4,5],[1,2],[4,5],[1,1],[-2,3],[0,3],[4,9],[2,3],[1,3],[-2,2],[-4,2],[0,2],[7,4],[17,1],[23,-5],[19,-1],[6,11],[-1,3],[-4,7],[-1,3],[1,3],[3,1],[4,1],[2,2],[19,19],[4,7],[-2,4],[-7,3],[-17,8],[-5,3],[-3,4],[-1,7],[-3,7],[-9,12],[-2,7],[3,5],[5,6],[2,5],[-11,8],[-1,7],[2,6],[5,6],[8,4],[6,0],[18,-9],[4,-3],[8,-2],[8,-1],[12,1],[11,1],[9,-1],[9,0],[8,4],[4,11],[-23,10],[13,9],[7,4],[10,8],[6,4],[4,5],[-8,9],[1,6],[8,5],[10,3],[10,4],[4,7],[5,25],[-5,41],[-10,22],[1,8],[7,19],[8,8],[15,7],[45,11],[13,5],[7,5],[2,2],[4,0],[38,3],[8,2],[29,11],[15,3],[20,0],[21,-1],[11,1],[8,3],[7,8],[3,1],[15,4],[3,1],[1,3],[-3,2],[-3,2],[-1,2],[0,3],[1,2],[5,5],[13,8],[5,5],[2,6],[-7,11],[-16,7],[-19,6],[-16,8],[-12,10],[-22,48],[-1,9],[1,9],[4,10],[0,1],[0,1],[0,1],[-3,5],[-4,7],[0,5],[7,5],[1,2],[0,2],[0,1],[-1,2],[-14,9],[-5,5],[-2,6],[-5,6],[-13,12],[-4,12],[-19,18],[-26,40],[-4,14],[1,6],[3,4],[6,3],[8,4],[12,4],[2,2],[1,3],[-6,5],[-1,4],[2,6],[8,11],[2,6],[-3,7],[-7,5],[-16,10],[-13,15],[-5,8],[-1,7],[5,6],[20,11],[5,7],[1,5],[-2,6],[1,7],[4,6],[7,4],[18,5],[-19,8],[-6,5],[-5,14],[-4,3],[-15,5],[-10,4],[3,1],[10,-1],[10,0],[9,3],[4,4],[-3,4],[-14,5],[0,2],[3,2],[1,3],[0,2],[1,1],[0,1],[-3,4],[-4,1],[-5,1],[-4,2],[-3,3],[1,3],[3,2],[3,3],[3,2],[13,16],[2,6],[-1,11],[2,5],[7,3],[10,0],[10,-3],[9,-3],[8,3],[1,5],[-7,20],[0,12],[4,13],[9,11],[8,1],[9,1],[10,-2],[9,0],[9,1],[9,3],[6,4],[4,12],[4,4],[9,1],[11,-1],[20,-4],[4,-2],[3,-1],[3,-2],[45,6],[5,4],[0,7],[-3,3],[-7,6],[-2,4],[1,3],[9,8],[0,2],[-1,3],[0,2],[2,3],[4,2],[4,1],[10,1],[6,2],[19,12],[2,1],[6,1],[2,1],[2,2],[0,4],[1,2],[5,6],[4,2],[6,1],[12,-1],[23,-6],[14,0],[10,3],[8,5],[2,2]],[[5796,4379],[-15,-8],[-9,-10],[-12,-6],[-14,0],[-12,2],[3,9],[-5,5],[-14,-4],[-14,0],[-8,4],[9,6],[10,8],[3,12],[10,15],[9,0],[13,-1],[18,0],[13,-7],[9,-8],[11,-8],[-5,-9]],[[5807,4426],[-3,-5],[-5,6],[-5,8],[-12,7],[-23,16],[-11,12],[7,15],[10,0],[14,-2],[15,-3],[13,-8],[-2,-13],[0,-17],[2,-16]],[[5855,4779],[3,0],[2,2],[1,3],[2,1],[5,-2],[7,-6],[9,-15],[1,-5],[-4,-4],[-10,0],[-11,2],[-7,2],[-9,4],[-31,6],[-12,3],[-9,4],[-20,14],[-6,6],[0,5],[9,0],[19,-4],[50,-5],[10,-8],[1,-3]],[[5813,4821],[16,-6],[2,-4],[-4,-3],[-8,-2],[-9,0],[-10,2],[-28,10],[-8,-4],[-9,1],[-6,4],[6,5],[40,-1],[18,-2]],[[7680,6262],[0,-5],[0,-7],[-2,-1],[-3,3],[-3,5],[-6,2],[-5,-4],[-3,-2],[-4,2],[-5,5],[4,3],[4,2],[0,5],[-3,7],[-4,6],[2,4],[4,-2],[2,-6],[6,-5],[3,-3],[11,-4],[2,-5]],[[7598,6326],[0,-1],[5,-1],[5,-1],[12,-3],[4,-1],[3,-5],[2,-6],[0,-13],[-3,-10],[-1,-3],[1,-2],[5,-5],[1,-4],[-17,-9],[-2,-2],[-3,-4],[-2,-2],[-7,-5],[-10,-3],[-10,-1],[-9,2],[-4,0],[-19,0],[-3,-1],[-1,-2],[-3,-2],[-6,-1],[29,-8],[9,-4],[14,-6],[6,-5],[-9,-10],[-7,-2],[-5,-4],[-8,-5],[1,-4],[3,-4],[13,-6],[2,-3],[0,-6],[0,-3]],[[7584,6171],[-32,-13],[-11,-27],[9,-17],[49,-19],[19,18],[14,6],[18,2],[10,5],[4,4]],[[7664,6130],[39,-13],[24,-10],[17,-5],[19,-1],[12,-1],[15,-4],[17,-2],[15,-3],[18,-11],[13,-3],[28,2],[6,-1],[9,-5],[23,-7],[24,-11],[36,-8],[42,-16],[41,-8],[17,-9],[21,-8],[48,-24],[18,-11],[22,-13],[11,-5],[24,-19],[19,-18],[15,-14],[2,-7],[-8,-13],[-18,-12],[-22,-14],[-50,-38],[-14,-9],[-7,-11],[-3,-8],[-5,-13],[-6,-9],[5,-11],[5,-12],[1,-9],[1,-2],[2,-4],[9,-4],[2,-3],[1,0],[13,-17],[2,-7],[2,-2],[9,-2],[9,-5],[2,-2],[3,-6],[7,-6],[70,-34],[52,-16],[23,-2],[11,-3],[5,-4],[-9,-4],[3,-2],[10,5],[10,3],[22,4],[11,1],[33,-1],[-5,7],[1,5],[7,1],[11,-4],[3,-4],[6,-12],[3,-3],[10,-5],[-1,-38],[11,-16],[2,-8],[2,-41],[2,-34],[-2,-13],[-9,-10],[-52,-33],[-49,-38],[-66,-55],[-18,-20],[-55,-37],[-18,-9],[-54,-24],[-20,-16],[-6,-3],[-8,-2],[-41,-24],[-15,-11],[-12,-12],[-9,-12],[-4,-13],[-2,-13],[1,-2],[4,-3],[1,-2],[0,-2],[-2,-3],[-1,-1],[1,-9],[-1,-4],[-11,-11],[-18,-9],[-47,-16],[-52,-14],[-36,-13],[-78,-22],[-17,-1],[-7,-2],[-26,-11],[-19,-5],[-60,-11],[-19,-6],[-9,-2],[-45,-3],[-37,-6],[-37,-10],[-81,-9],[-106,-18],[-28,-9],[-16,-1],[-18,-4],[-142,-13],[-143,-14],[-83,-16],[-11,-1],[-35,1],[-229,-21],[-79,-6],[-78,-5],[-104,-10],[-56,1],[-13,1],[-7,1],[-6,-1],[-4,-1],[-7,-3],[-46,-5],[-98,6],[-45,-1],[-33,-5],[-5,-2],[-7,-1],[-79,5],[-7,3],[-9,1],[-5,3],[-3,1],[-4,0],[-4,-1],[-3,-1],[-2,-1],[-21,-2],[-24,1],[-95,13],[-18,4],[-15,6],[-10,9],[-8,11],[-7,6],[-7,2],[-81,3],[-9,2],[-11,2],[-11,-3],[-5,-5],[5,-3],[-3,-6],[9,-12],[-3,-5],[7,3],[7,0],[5,-2],[2,-4],[-1,-11],[1,-2],[6,-2],[7,0],[16,2],[0,-2],[-3,-4],[-3,-4],[1,-5],[-12,-3],[-5,-3],[-7,-10],[-5,-7],[-3,-2],[-4,-3],[-1,-2],[3,-2],[4,-2],[3,-3],[-1,-5],[-2,-5],[-1,-5],[4,-5],[8,-5],[23,-8],[10,-6],[-8,0],[-6,1],[-13,3],[-8,-4],[5,-3],[11,-2],[12,-1],[39,-1],[13,-1],[39,-9],[21,-8],[12,-8],[0,-3],[-2,-4],[-4,-3],[-4,-2],[-7,-2],[-4,1],[-3,1],[-4,2],[-10,2],[-28,12],[-10,6],[-2,2],[-2,3],[-3,2],[-4,1],[-2,-1],[-2,0],[-2,0],[-10,1],[-28,-1],[1,-3],[2,-3],[3,-3],[4,-2],[6,0],[6,0],[6,0],[3,-3],[4,-6],[10,-6],[20,-9],[10,-3],[24,-3],[13,0],[3,-2],[1,-3],[1,-4],[-2,-3],[-6,-3],[-2,-2],[-2,-21],[-3,-4],[-3,-3],[-12,-41],[-2,-27],[-2,-5],[-3,0],[-18,-5],[-2,-1],[-37,3],[-11,3],[-22,8],[-2,-3],[2,-3],[10,-6],[-12,-3],[-3,-2],[1,-4],[1,-8],[-2,-5],[-7,-11],[-4,-10],[-9,-12],[-4,-3],[-2,-3],[14,-17],[-1,-7],[-8,-12],[-2,-5],[-4,-6],[-11,-3],[-12,-2],[-10,-3],[-9,-4],[-9,-5],[-7,-6],[-3,-6],[2,-4],[15,-14],[8,-17],[4,-3],[0,-1],[9,-7],[4,-2],[16,-3],[17,-5],[6,-1],[2,-1],[-1,-7],[2,-2],[7,-3],[6,-4],[6,-3],[10,4],[7,-14],[0,-8],[-8,-3],[-24,2],[-3,1],[-7,6],[-6,1],[0,-3],[1,-2],[1,-2],[3,-2],[4,-3],[-1,-3],[-3,-1],[-1,0],[4,-5],[4,-1],[39,11],[16,3],[16,0],[-6,-3],[-18,-7],[-4,-3],[-1,-5],[-5,-9],[-1,-5],[-2,-4],[-15,-14],[-13,-16],[-14,-8],[-74,-18],[-61,-17],[-34,-6],[-8,-3],[-9,-4],[-10,-3],[-11,0],[-13,-1],[-12,1]],[[5413,4211],[0,1],[-4,7],[-20,19],[-6,4],[-31,14],[-25,9],[-5,3],[-21,13],[-40,17],[-7,2],[-32,5],[-103,6],[0,11],[0,78],[0,163],[-1,164]],[[5118,4727],[1,150],[0,167],[-1,148],[0,13],[0,135],[0,131],[0,67],[0,68],[0,125],[0,11],[1,135],[1,68],[0,82]],[[5120,6027],[1,127],[5,50],[17,10],[243,-1]],[[5386,6213],[284,0],[264,1],[26,1],[166,92],[119,67],[90,51],[18,13],[-5,9],[5,8],[4,2],[5,2],[3,1],[3,1],[12,2],[7,0],[9,0],[9,-1],[3,0],[16,-5],[6,-1],[48,-1],[3,0],[3,0],[20,-8],[14,-7],[3,-1],[5,-1],[8,-2],[12,-1],[8,1],[2,1],[12,1],[12,4],[4,3],[18,19],[3,3],[3,8],[3,13],[2,2],[2,2],[20,8],[6,3],[3,2],[1,2],[0,2],[-2,3],[0,2],[0,2],[1,3],[2,4],[2,1],[1,2],[3,0],[2,1],[7,1],[4,1],[4,1],[6,3],[3,2],[1,1],[2,5],[-1,3],[0,1],[-9,6]],[[6671,6551],[24,-6],[64,-35],[86,-30],[8,-2],[12,-1],[24,-6],[8,-3],[9,-5],[20,-14],[7,-4],[66,-18],[19,-2],[13,2],[28,5],[20,-8],[19,-11],[25,-7],[43,0],[2,1],[4,3],[1,0],[8,1],[4,1],[4,-1],[3,-5],[2,-4],[-1,-7],[2,-3],[2,0],[3,-2],[4,-1],[5,-1],[2,0],[2,1],[3,1],[3,0],[3,-1],[5,-3],[1,0],[2,-1],[1,-3],[3,-2],[5,-1],[52,1],[13,-1],[10,-3],[9,-3],[36,-11],[28,-12],[9,-3],[24,-3],[10,-2],[51,-23],[21,-6],[23,0],[46,10],[27,3]],[[5118,4727],[-45,2],[-19,4],[-14,7],[-66,21],[-18,4],[-8,5],[-13,10],[-7,4],[-7,2],[-19,5],[-35,4],[-10,2],[-43,25],[-8,3],[-24,2],[-8,2],[-36,11],[-163,29],[-36,0],[-140,13],[-10,-2],[-15,2],[-36,-2],[-14,4],[-3,0],[-69,0],[-74,-7],[-26,1],[-22,-4],[-5,0],[-10,2],[-18,6],[-44,8],[-26,2],[-14,0],[-10,-3],[-9,-3],[-10,-4],[-11,-2],[-10,0],[-4,1],[-4,2],[-6,2],[-8,1],[-21,0],[-5,1],[-9,4],[-5,1],[-6,1],[-21,1],[-17,4],[-14,1],[-10,3],[-5,1],[-128,7],[-67,-5],[-22,0],[-59,7],[-14,1],[-12,2],[-6,5],[-4,14],[-6,9],[-12,8],[-15,7],[-19,4],[-22,2],[-5,1],[-9,4],[-3,1],[-5,1],[-17,6],[-25,2],[-11,1],[-15,6],[-23,2],[-50,13],[-5,0],[-3,2],[-8,5],[-7,3],[-18,13],[-12,16],[-2,4],[0,6],[-2,5],[-5,4],[-10,2],[-12,1],[-42,-5],[-23,-7],[-13,-1],[-38,2],[-13,-3],[-38,-1],[-19,4],[-17,8],[-13,9],[-27,27],[-15,8],[-19,4],[-6,-1],[-13,-2],[-5,1],[-9,3],[-3,0],[-5,3],[-5,6],[-4,6],[-2,6],[3,14],[11,10],[16,8],[35,11],[12,9],[6,11],[0,13],[-7,10],[-12,10],[-15,9],[-14,6],[-22,6],[-200,13]],[[3498,5727],[278,0],[18,0],[448,-1],[19,0],[2,1],[2,0],[1,46],[0,254]],[[4266,6027],[301,0],[266,0],[287,0]],[[5413,4211],[-5,0],[-6,-4],[-13,-5],[-8,-4],[-35,-4],[-60,-14],[-23,-3],[-109,2],[-22,-3],[-12,-1],[-48,2],[-71,-2],[-79,1],[-23,3],[-21,5],[-50,22],[-22,4],[-21,0],[-5,1],[-2,3],[2,3],[5,5],[-5,2],[-12,-1],[-13,-3],[-11,-1],[-20,2],[-122,30],[-68,8],[-46,11],[-46,5],[-24,1],[-35,-2],[-16,1],[-13,2],[0,4],[9,3],[13,2],[9,-1],[-2,-5],[3,0],[4,1],[3,1],[30,0],[9,1],[5,2],[-4,6],[-15,3],[-8,2],[14,7],[-12,4],[-48,5],[-28,-1],[-17,-4],[-5,-2],[9,0],[16,2],[9,-2],[-7,-4],[2,-3],[7,-2],[5,-3],[-51,1],[-9,-2],[-7,-3],[-40,-15],[-5,-3],[-1,-3],[0,-6],[-2,-3],[-7,-6],[-6,-6],[-4,-7],[-2,-7],[1,-12],[14,-51],[20,-36],[1,-9],[12,-17],[4,-10],[6,-9],[27,-13],[8,-10],[-1,-8],[-4,-10],[-7,-10],[-7,-6],[-4,-8],[5,-11],[14,-17],[-1,-11],[-8,-13],[-22,-21],[-7,-13],[3,-10],[7,-8]],[[913,3923],[-6,4],[0,5],[3,4],[0,6],[-10,21],[-10,9],[-12,7],[-9,9],[-1,11],[-5,10],[-29,19],[0,9],[7,3],[17,5],[7,3],[6,5],[-2,4],[-6,3],[-6,5],[-4,5],[0,3],[3,9],[2,6],[-1,5],[-2,4],[-4,5],[-6,11],[1,10],[12,20],[2,6],[-1,5],[-6,10],[-1,6],[4,2],[5,2],[3,5],[2,10],[4,11],[1,7],[-7,11],[-1,3]],[[3441,6966],[35,-3],[11,-2],[14,-5],[5,-1],[4,0],[4,0],[9,1],[10,2],[4,0],[3,0],[6,-1],[10,-4],[1,0],[3,0],[26,2],[4,0],[5,-1],[7,-1],[14,-4],[4,0],[6,0],[16,2],[6,0],[25,-1],[26,2],[25,4],[20,6],[11,3],[25,3],[19,0],[24,-2],[5,-1],[3,-1],[8,-3],[3,-1],[4,0],[8,-1],[24,0],[50,5]],[[3928,6964],[44,-1],[16,-2],[26,-6],[140,-44],[13,-9],[14,-6],[3,-3],[2,-2],[3,-4],[0,-2],[0,-5],[0,-4],[1,-3],[3,-6],[5,-6],[8,-6],[1,-1],[2,-3],[-1,-13],[0,-2],[1,-3],[2,-1],[3,-1],[7,-1],[54,3],[49,7],[10,2],[3,0],[3,0],[3,-1],[3,-1],[2,-1],[2,-3],[1,-4],[1,-9],[-1,-8],[-2,-8],[-1,-7],[2,-2],[2,-3],[11,-11],[3,-6],[2,-6],[4,-6],[1,-2],[0,-3],[-2,-10],[-3,-8],[-11,-14],[-4,-12],[-1,-2],[-2,-2],[-4,-2],[-7,-4],[-2,-2],[-1,-2],[0,-3],[1,-4],[-1,-2],[-1,-2],[-7,-6],[-1,-3],[-1,-2],[-1,-11],[-1,-2],[-1,-3],[-20,-19],[-1,-2],[-1,-2],[2,-4],[3,-5],[0,-3],[-3,-4],[-13,-12],[-2,-4],[-1,-4],[6,-7],[1,-2],[-1,-2],[-3,-2],[-3,-1],[-3,-1],[-13,-1],[-4,-1],[-2,-1],[-1,-1],[-2,-1],[-15,-14],[-3,-3],[-1,-2],[23,-228],[0,-312]],[[5771,7483],[-23,-78],[1,-7],[3,-5],[111,-65],[24,-18],[-5,-17],[-128,-246],[-9,-10],[-22,-11],[-20,-9],[-7,-4],[0,-3],[0,-2],[8,-7],[1,-1],[1,-2],[0,-2],[0,-3],[-3,-14],[0,-4],[4,-18],[0,-2],[1,-1],[1,-2],[7,-5],[5,-3],[1,-2],[0,-2],[0,-2],[-6,-9],[-4,-5],[-4,-5],[-1,-7],[-2,-25],[14,-7],[10,-5],[16,-10],[4,-1],[15,-4],[10,-3],[2,-1],[2,-3],[14,-26],[4,-4],[11,-10],[36,-14],[7,-3],[6,-5],[2,-1],[4,-7],[3,-9],[1,-10],[1,-2],[4,-2],[2,-2],[6,-2],[2,-1],[1,-2],[0,-4],[0,-2],[-1,-2],[-1,-2],[-3,-3],[-1,-1],[-8,-5],[-1,-1],[1,-2],[3,-1],[4,-1],[15,-1],[4,-1],[2,0],[3,-1],[1,-1],[14,-14],[9,-10],[2,-2],[2,-1],[13,-6],[2,-1],[2,-1],[4,-5],[1,-2],[0,-3],[-1,-2],[-3,-5],[-7,-7],[-2,-6],[0,-19],[-1,-7],[-1,-5],[-2,-2],[-7,-7],[-18,-10],[-8,-3],[-7,-2],[-3,-1],[-3,-1],[-6,0],[-4,0],[-7,0],[-14,-9],[-113,-92],[-153,-125],[-203,-164]],[[3928,6964],[-1,79],[-2,105],[-1,53],[7,18],[33,51],[7,10],[10,15],[41,64],[1,4],[3,9],[13,21],[6,12],[3,3],[11,9],[7,9],[42,62]],[[4108,7488],[107,16],[25,7],[44,24],[54,32],[5,5],[1,6],[-15,69],[5,10],[34,6]],[[4368,7663],[147,20],[94,13],[55,7],[20,0],[98,-13],[5,-1],[2,-2],[0,-3],[-1,-8],[-1,-3],[3,-3],[7,-3],[38,-11],[1,-1],[5,-4],[4,-2],[3,-1],[32,-4],[5,-1],[3,-1],[6,-3],[5,-2],[5,-1],[4,0],[30,-2],[9,0],[60,5],[7,0],[36,-6],[5,0],[18,2],[5,0],[3,-1],[1,-1],[1,-2],[1,-1],[0,-2],[-3,-8],[0,-2],[2,-2],[5,-1],[17,-1],[6,-1],[3,-1],[1,-2],[0,-1],[1,-6],[0,-2],[3,-1],[1,-1],[11,-1],[286,0],[171,1],[82,-2],[23,-8],[78,-106]],[[3781,8656],[-4,-6],[-4,-2],[-5,-3],[-7,-5],[-4,-4],[-1,-6],[0,-5],[-2,-6],[-4,-8],[-12,-13],[-8,-15],[-2,-5],[1,-3],[2,-4],[8,-6],[8,-3],[11,-2],[10,0],[13,-2],[11,-3],[8,-3],[17,-9],[32,-15],[23,-6],[2,0],[2,-2],[3,-2],[1,-1],[1,-2],[1,-2],[0,-3],[0,-4],[0,-2],[-8,-17],[0,-4],[0,-18],[0,-3],[-2,-5],[-6,-7],[-14,-12],[-35,-19],[-16,-10],[-13,-8],[-9,-9],[-2,-4],[-2,-3],[-1,-2],[-4,-2],[-10,-6],[-11,-5],[-16,-9],[-8,-11],[-13,-11],[-1,-1],[-1,-2],[2,-2],[4,-1],[10,-3],[11,-1],[17,-1],[6,-1],[36,-11],[15,-1],[3,-1],[3,0],[2,-2],[0,-2],[-5,-7],[18,-45],[6,-7],[4,-13],[1,-3],[2,-2],[3,-2],[7,-3],[4,-2],[7,-2],[3,-2],[3,-2],[6,-12],[2,-7],[2,-3],[4,-3],[2,-2],[9,-3],[13,2],[6,1],[5,2],[8,0],[23,-6],[5,-3],[2,-2],[5,-9],[5,-16],[7,-11],[5,-4],[42,-28],[6,-1],[4,3],[11,13],[1,1],[12,10],[3,1],[17,7],[15,9],[42,14],[4,0],[4,-1],[8,-2],[7,-3],[10,-5],[10,-3],[11,-3],[7,-2],[6,0],[10,1],[14,4]],[[4225,8159],[45,-110],[3,-45],[-3,-17],[-6,-8],[-6,-4],[-12,-7],[-7,-6],[-6,-7],[-3,-1],[-9,-3],[-2,-1],[0,-2],[0,-10],[1,-2],[1,-1],[2,-1],[4,0],[21,-7],[10,-4],[2,-2],[1,-2],[2,-4],[9,-59],[-2,-25],[22,-88],[21,-28],[33,-30],[5,-6],[1,-2],[6,-6],[10,-8]],[[4108,7488],[-84,90],[-18,27],[-31,35],[-32,40],[-5,11],[-6,19],[-1,3],[1,6],[-1,14],[-1,3],[-2,5],[-16,15],[-89,46],[-5,2],[-11,3],[-60,33],[-23,8],[-84,21],[-10,3],[-4,3],[-8,5],[-1,2],[0,2],[1,2],[4,4],[3,2],[4,3],[9,8],[2,1],[0,2],[-1,3],[-1,1],[-7,3],[-11,3],[-2,0],[-9,4],[-17,8],[-18,14],[-4,5],[-6,24],[-5,10],[-2,2],[-1,2],[-4,2],[-4,4],[-16,7],[-18,12],[-98,22],[-98,19],[-16,0],[-12,-4],[-6,-1],[-3,-1],[-1,-1],[-2,-1],[-1,-2],[-1,-1],[-3,-2],[-8,-5],[-4,-2],[-5,-2],[-6,-1],[-38,-4],[-37,0],[-222,5],[-32,-4],[-8,-2],[-13,-6],[-8,0],[-4,3],[-2,3],[-2,5],[-1,1],[-1,1],[-3,3],[-7,4],[-24,18],[-1,2],[-5,10],[-2,12],[-2,4],[0,2],[2,6],[0,2],[-2,1],[-3,1],[-5,1],[-7,0],[-4,-1],[-8,-2],[-5,0],[-8,0],[-3,-1],[-8,-1],[-9,-3],[-11,-2],[-5,-1],[-4,0],[-5,1],[-6,3],[-6,3],[-1,1],[-5,4],[-4,2],[-3,1],[-5,1],[-22,3],[-13,1],[-16,0],[-3,0],[-4,1],[-4,1],[-5,2],[-5,3],[-5,5],[-8,5],[-4,2],[-5,2],[-3,0],[-5,1],[-8,1],[-9,0],[-7,0],[-3,0],[-4,1],[-7,2],[-1,1],[-2,2],[0,2],[0,2],[1,4],[7,15],[0,2],[0,1],[0,2],[-1,1],[-5,6],[-2,1],[-1,3],[0,3],[0,4],[1,2],[8,14],[1,4],[0,2],[0,2],[-1,1],[-1,1],[-1,2],[-4,1],[-5,1],[-23,1],[-6,-1],[-5,-1],[-6,-2],[-4,-3],[-4,-2],[-3,0],[-8,-2],[-3,0],[-5,0],[-8,1],[-4,1],[-11,3],[-3,1],[-4,0],[-6,0],[-12,-2],[-36,-2],[-5,-1],[-10,-2],[-33,-5],[-136,5],[-7,1]],[[2235,8200],[5,11],[3,4],[5,2],[14,3],[2,3],[-2,4],[-4,4],[-3,4],[1,5],[3,3],[12,6],[4,3],[13,14],[5,8],[1,8],[-2,4],[0,4],[2,4],[3,3],[8,3],[18,5],[8,4],[6,4],[24,30],[2,5],[-1,12],[1,5],[4,7],[21,19],[7,5],[7,2],[19,3],[22,-1],[18,-6],[17,-7],[20,-5],[12,1],[5,4],[3,6],[6,7],[9,5],[11,4],[12,2],[26,1],[10,1],[23,6],[5,0],[15,-1],[3,1],[1,2],[-1,7],[1,4],[3,6],[8,11],[2,5],[-1,9],[-8,8],[-95,73],[-17,11],[-13,12],[-9,13],[-4,15],[1,24],[3,12],[6,10],[15,11],[63,27],[6,10],[-4,15],[-35,78],[-6,24],[-5,8],[-7,7],[-10,6],[-9,7],[0,8],[0,8],[-4,7],[7,4],[-6,6],[-18,13],[-3,5],[-1,6],[2,11],[26,44],[19,32],[10,7]],[[2555,8985],[5,-1],[341,-36],[605,4],[16,0],[4,-1],[3,-1],[2,-1],[3,-2],[4,-6],[1,-3],[5,-22],[1,-2],[2,-3],[1,-1],[7,-6],[9,-6],[5,-5],[3,-2],[0,-2],[0,-2],[-1,-4],[-12,-23],[0,-3],[1,-3],[0,-2],[-1,-2],[-2,-2],[-7,-4],[-24,-10],[-5,-1],[-3,-1],[-6,0],[-20,0],[-21,-1],[-32,0],[-3,-1],[-3,0],[-2,-1],[-9,-5],[-9,-4],[-2,-1],[-4,-2],[-4,-2],[-2,-1],[-1,-2],[-1,-3],[-1,-8],[0,-12],[7,-14],[10,-11],[41,-33],[41,-27],[7,-14],[4,-3],[13,-8],[19,-25],[9,-6],[33,-20],[15,-9],[5,-1],[2,-1],[3,-1],[3,0],[4,0],[4,1],[5,2],[3,2],[2,2],[22,30],[6,6],[4,2],[2,1],[14,4],[9,10],[5,3],[5,2],[8,2],[8,0],[9,0],[9,-1],[6,-3],[12,-9],[12,-7],[22,-7]],[[4214,9905],[-1,-6],[-2,-4],[-7,-5],[-5,-6],[-3,-4],[-5,-12],[-1,-9],[0,-18],[-1,-2],[-1,-2],[-9,-8],[-2,-1],[-5,-4],[-14,-19],[-2,-5],[-3,-4],[-11,-12],[-2,-3],[-1,-2],[1,-7],[-4,-14],[2,-2],[2,-1],[5,0],[8,1],[4,-1],[18,-9],[1,-3],[-8,-9],[-2,-4],[-1,-5],[1,-7],[0,-3],[2,-4],[1,-1],[6,-29],[1,-1],[4,-4],[2,-3],[10,-20],[2,-2],[1,-2],[8,-4],[10,-5],[5,-1],[7,-1],[42,0],[14,-1],[4,-1],[5,-2],[7,-5],[4,-3],[2,-2],[2,-3],[0,-2],[1,-7],[-7,-27],[-9,-18],[-2,-5],[0,-3],[1,-2],[1,-1],[1,-2],[1,-1],[2,-1],[2,-1],[11,-2],[4,0],[16,-4],[6,-3],[8,-9],[6,-9],[18,-19],[2,-3],[0,-1],[2,-11],[1,-3],[2,-1],[3,-1],[6,0],[7,0],[14,-2],[10,0],[2,1],[4,1],[1,1],[3,1],[8,5],[6,2],[4,1],[21,1],[10,2],[6,0],[3,0],[4,-2],[5,-4],[2,-1],[2,0],[4,-1],[19,-3],[16,-5],[8,-4],[10,-4],[2,-1],[9,-7],[10,-7],[2,-1],[1,-2],[4,-3],[13,-5],[12,5],[3,4],[5,13],[2,2],[10,6],[4,3],[6,1],[4,1],[63,-1],[9,-1],[7,-1],[3,-4],[1,-4],[12,-193],[-2,-4],[-8,-14],[-17,-17],[-30,-23],[-13,-8],[-7,-3],[-2,-1],[-5,-1],[-3,0],[-3,0],[-10,0],[-6,-1],[-2,0],[-3,0],[-10,-1],[-4,0],[-5,-1],[-3,-1],[-2,-2],[-7,-7],[-3,-1],[-3,-1],[-25,-4],[-27,-13],[-8,-5],[-6,-6],[-4,-7],[-3,-4],[-3,-2],[-3,-2],[-2,0],[-2,-1],[-4,0],[-96,47],[-5,1],[-7,-5],[-7,-7],[-23,-29],[-2,-1],[-3,-1],[-2,0],[-4,0],[-6,0],[-48,10],[-17,6],[-43,19],[-1,1],[-1,1],[-2,3],[-1,2],[-2,1],[-3,0],[-2,0],[-21,-8],[-12,-3],[-6,-1],[-12,-2],[-20,3],[-23,6],[-6,1],[-3,0],[-12,0],[-12,2],[-6,3],[-11,6],[-5,2],[-4,1],[-3,1],[-3,0],[-3,-1],[-1,0],[-1,0],[-5,-2],[-4,-1],[-5,-1],[-5,1],[-16,5],[-5,2],[-3,2],[-6,5],[-9,10],[-51,37],[-17,16],[-4,6],[2,13],[-1,11],[-11,4],[-24,6],[-3,2],[-5,3],[-19,10],[-5,2],[-5,2],[-4,0],[-3,0],[-3,0],[-2,-1],[-2,-1],[-1,-1],[-3,-1],[-3,-1],[-5,0],[-3,1],[-2,1],[-4,4],[-5,3],[-9,7],[-2,5],[2,2],[2,3],[1,2],[0,1],[-2,1],[-1,1],[-1,1],[-2,2],[-1,4],[-1,1],[-2,1],[-2,0],[-3,1],[-1,2],[0,2],[1,21],[1,2],[1,2],[6,6],[1,1],[8,4],[1,2],[0,2],[-5,6],[-1,2],[0,1],[6,6],[-3,14],[0,6],[3,11],[1,3],[-1,2],[-2,3],[-4,2],[-15,8],[-71,24],[-3,1],[-3,0],[-2,0],[-6,-1],[-6,0],[-8,2],[-15,7],[-14,0],[-23,6],[-6,1],[-5,0],[-4,-1],[-2,-1],[-2,-1],[-4,-3],[-1,-1],[-13,-31],[-1,-8],[0,-8],[1,-3],[11,-17],[2,-4],[16,-21],[4,-8],[2,-17],[-2,-27],[-6,-31],[0,-12],[-1,-9],[-2,-4],[-3,-2],[-4,-5],[-4,-6],[-2,-9],[-3,-4],[-4,-2],[-8,-1],[-3,-1],[-27,-20],[-17,-4],[-31,-1],[-18,2],[-20,5],[-16,5],[-11,6],[-18,14],[-18,10],[-4,2],[-41,10],[-8,3],[-3,2],[-9,7],[-17,9],[-1,2],[-2,1],[-2,5],[-3,3],[-2,1],[-4,0],[-4,0],[-5,0],[-3,1],[-2,1],[-2,3],[-3,5],[-1,1],[-22,12],[-14,10],[-4,2],[-4,1],[-2,1],[-7,1],[-10,1],[-4,0],[-6,1],[-3,1],[-2,2],[-9,7],[-4,1],[-3,2],[-13,2],[-4,1],[-3,2],[-12,7]],[[3180,9414],[1,3],[36,64],[35,64],[35,64],[9,16],[3,9],[-90,54],[25,24],[15,10],[38,16],[5,5],[2,6],[-5,28],[9,1],[11,-1],[8,1],[6,2],[5,4],[10,7],[14,3],[56,10],[6,2],[0,4],[-3,8],[1,3],[7,4],[3,7],[6,22],[4,7],[6,6],[12,6],[7,2],[5,-1],[6,-1],[10,0],[8,-2],[2,0],[2,2],[1,3],[2,1],[59,9],[66,11],[12,5],[2,3],[4,3],[3,2],[5,2],[6,0],[2,-1],[1,1],[3,3],[3,5],[4,28],[24,49],[9,2],[42,-8],[22,-6],[16,-9],[6,-15],[2,-1],[46,-5],[11,-3],[65,-43],[14,-6],[16,-2],[70,4],[3,1],[3,2],[2,1],[4,0],[35,-3],[27,-2],[134,1]],[[1974,8011],[1,1],[23,12],[26,12],[22,15],[5,5],[5,16],[7,3],[10,-2],[11,-4],[7,-1],[5,3],[11,12],[11,9],[18,24],[10,4],[0,3],[-1,2],[0,2],[5,5],[6,3],[8,2],[30,4],[13,5],[8,8],[20,46]],[[5644,9793],[1,-326],[0,-169]],[[5645,9298],[2,-85],[-380,-270],[-154,-108]],[[5113,8835],[-264,2],[-17,3],[-1,0],[-97,17],[-19,2],[-10,-7],[-107,-128],[-3,-5],[-1,-4],[0,-9],[0,-3],[-4,-6],[-18,-19],[-1,-1],[-4,-11]],[[4567,8666],[-106,-1],[-8,0],[-27,4],[-15,-1],[-26,-5],[-5,-2],[-10,-5],[-9,-3],[-2,-1],[-5,-1],[-7,-1],[-4,0],[-6,0],[-11,2],[-17,5],[-8,3],[-10,1],[-5,0],[-8,-1],[-95,21],[-8,2],[-4,4],[-3,4],[-4,8],[-7,7],[-1,2],[-2,1],[-2,1],[-5,0],[-7,-1],[-14,-4],[-25,-7],[-3,-1],[-4,0],[-6,0],[-50,6],[-6,0],[-12,-1],[-25,4],[-3,1],[-10,3],[-3,0],[-3,0],[-4,-1],[-2,-1],[-2,-2],[-1,-2],[-1,-5],[0,-12],[-1,-6],[-4,-6],[-2,-6],[-1,-4],[2,-10],[0,-2],[-1,-2],[-1,-2],[-2,-2],[-2,-2],[-2,-1],[-3,-1],[-3,-1],[-17,1],[-148,13]],[[2555,8985],[2,1],[9,3],[8,1],[8,-1],[11,-1],[11,2],[10,2],[6,4],[0,6],[-11,8],[-16,8],[-12,9],[2,11],[2,3],[-2,2],[-2,2],[-3,2],[-2,1],[-5,3],[-2,1],[-1,2],[1,1],[1,1],[0,1],[-3,4],[-3,2],[-6,2],[-10,0],[-4,1],[-12,4],[-4,3],[-3,2],[-11,16],[0,5],[3,6],[25,29],[6,10],[1,4],[2,5],[4,3],[7,1],[10,-8],[5,-1],[4,5],[3,10],[21,23],[8,3],[9,-1],[9,-1],[9,0],[6,3],[19,17],[5,8],[2,3],[9,3],[17,4],[25,6],[26,5],[25,6],[25,6],[63,15],[62,16],[63,15],[63,16],[4,1],[10,2],[10,2],[5,1],[20,4],[25,8],[11,9],[11,19],[17,31],[17,30]],[[4214,9905],[85,1],[94,-12],[36,-11],[19,-3],[5,0],[9,3],[4,0],[4,-1],[11,-1],[10,-4],[11,-3],[10,-1],[5,-2],[13,-9],[4,-4],[5,-6],[0,-5],[-3,-4],[-7,-4],[-5,-7],[7,-5],[10,-5],[7,-3],[1,-3],[-4,-6],[0,-3],[2,-2],[9,-3],[2,-2],[3,-7],[7,-6],[28,-15],[0,-5],[-4,-3],[-4,-2],[-2,-4],[-1,-3],[-2,-5],[-1,-4],[2,-4],[3,-2],[4,-1],[5,-2],[14,-16],[5,-3],[11,-2],[7,-7],[1,-8],[-3,-7],[6,-5],[2,-14],[9,-2],[-1,4],[12,23],[4,6],[1,21],[21,45],[8,8],[26,13],[12,10],[37,54],[4,3],[10,3],[4,3],[15,22],[8,17],[4,5],[3,1],[4,1],[3,1],[4,2],[2,2],[2,6],[5,7],[0,2],[2,1],[7,1],[13,2],[47,-2],[10,-3],[21,-10],[5,-1],[24,11],[8,3],[19,2],[158,-1],[158,0],[74,2],[22,-2],[7,-1],[2,-3],[3,-11],[0,-3],[-2,-3],[4,-4],[0,-9],[4,-5],[7,-5],[24,-6],[21,-9],[6,-3],[2,-3],[1,-3],[1,-2],[4,-1],[5,0],[5,-1],[3,-2],[3,-3],[-4,0],[4,-4],[-2,-3],[-4,-3],[-1,-2],[4,-3],[6,-2],[7,-1],[6,0],[11,-2],[9,-4],[12,-9],[7,-1],[20,-4],[4,-2],[4,-4],[8,-5],[35,-14],[10,-2],[4,0]],[[5113,8835],[825,-1],[16,-24],[6,-121],[1,-35],[0,-160],[0,-306],[-1,-57]],[[5960,8131],[-30,-107],[-48,-168],[-43,-146],[-24,-79],[-44,-148]],[[4225,8159],[7,2],[6,1],[3,0],[3,0],[8,-1],[6,0],[6,1],[5,1],[4,2],[2,1],[4,5],[15,23],[3,3],[4,1],[6,0],[2,0],[1,0],[-1,4],[-14,16],[-20,27],[0,6],[5,9],[3,1],[3,0],[11,0],[3,0],[3,0],[2,1],[2,1],[5,2],[2,1],[4,2],[6,6],[1,1],[0,1],[0,2],[-2,0],[-9,4],[-10,2],[-9,1],[-8,1],[-8,3],[-1,1],[30,19],[8,3],[23,16],[7,4],[5,1],[12,2],[3,1],[4,3],[11,17],[2,2],[9,7],[15,21],[6,13],[7,17],[2,2],[3,3],[4,3],[3,2],[4,1],[2,0],[8,9],[17,37],[7,14],[3,4],[4,1],[4,0],[7,0],[6,0],[2,1],[3,2],[3,3],[14,28],[3,3],[7,1],[32,-3],[2,2],[1,5],[0,11],[-4,23],[-9,30],[1,3],[1,4],[18,32],[1,8],[-2,21]],[[7646,8466],[-12,0],[-5,-3],[-5,-4],[-11,-2],[-22,-3],[-8,-3],[-4,-4],[1,-4],[8,-4],[-4,-4],[-9,-6],[-5,-4],[-1,-2],[-1,-3],[-1,-5],[-2,-1],[-4,0],[-3,2],[-1,0],[0,2],[-1,2],[-3,1],[-5,-1],[-3,-2],[-2,-3],[-2,-2],[-1,-3],[0,-5],[1,-5],[-3,-3],[-25,-2],[-12,-4],[-7,-6],[-2,-9],[3,-3],[6,-4],[13,-5],[6,-6],[1,-6],[-2,-15]],[[7519,8337],[-6,-1],[-14,-2],[-6,-2],[-18,-8],[-37,-12],[-2,-2],[-3,-2],[-52,-19],[-4,-1],[-1,-11],[0,-5],[2,-5],[3,-5],[14,-14],[8,-10],[6,-10],[4,-11],[0,-12],[-1,-5],[-11,-15],[-2,-6],[-1,-5],[2,-12],[0,-5],[-12,-25]],[[7388,8132],[-368,-1],[-222,0],[-353,0],[-485,0]],[[5645,9298],[108,-24],[37,-3],[7,-1],[4,-1],[3,-1],[6,-3],[3,-2],[1,-1],[1,-1],[1,-3],[3,-1],[4,-3],[22,-7],[19,-9],[4,-1],[4,0],[10,-1],[19,-3],[12,-1],[7,0],[4,0],[3,-1],[17,-8],[11,-4],[5,-2],[3,-2],[1,-3],[2,-3],[19,-18],[3,-3],[3,0],[2,0],[2,1],[2,1],[7,-2],[5,0],[4,0],[5,1],[3,0],[5,0],[3,-1],[2,-1],[1,-2],[0,-1],[1,-2],[1,-3],[1,-1],[5,-4],[20,-10],[7,-4],[23,-12],[4,-2],[11,-1],[3,0],[5,1],[4,0],[4,0],[17,-4],[10,-2],[3,0],[27,0],[8,-1],[19,-3],[7,-2],[2,-1],[3,-2],[13,-12],[4,-1],[8,-1],[2,-1],[0,-2],[-1,-3],[1,-4],[2,-3],[20,-16],[3,-3],[-1,-1],[-3,-2],[-1,-2],[0,-2],[1,-4],[1,-2],[3,-2],[9,-5],[4,-2],[4,-1],[2,1],[4,2],[3,0],[2,0],[2,-1],[70,-33],[6,-2],[6,-1],[3,-1],[14,-6],[15,-9],[4,-1],[15,-3],[31,-11],[3,-1],[15,-5],[4,-2],[6,-4],[4,-1],[3,-1],[19,-3],[4,-1],[4,-1],[11,-4],[3,-1],[3,0],[5,1],[4,0],[4,-1],[8,-1],[5,-2],[2,-1],[5,-5],[7,-8],[4,-4],[6,-5],[8,-6],[5,-4],[9,-5],[6,-2],[13,-3],[2,-2],[3,-1],[3,-4],[6,-6],[1,-1],[0,-2],[-3,-2],[-1,-1],[2,-2],[2,-1],[18,-5],[2,-2],[0,-2],[1,-2],[0,-2],[2,-3],[2,-1],[3,-1],[14,-1],[6,-1],[3,-1],[0,-1],[3,-3],[2,-2],[1,-1],[0,-2],[-2,-1],[-1,-1],[-3,-1],[-1,-1],[1,-2],[4,-4],[1,-1],[1,-2],[1,-3],[2,-2],[2,-3],[10,-6],[2,-2],[1,-2],[1,-2],[0,-1],[0,-2],[2,-3],[3,-3],[3,-1],[3,0],[3,1],[4,1],[2,1],[3,0],[2,-1],[4,-1],[2,-1],[3,-1],[4,0],[4,-1],[5,-1],[7,-2],[4,-1],[4,-1],[8,0],[5,-1],[3,-2],[1,-1],[1,-3],[2,-3],[2,-2],[2,-1],[3,0],[16,-2],[5,-1],[3,-2],[3,-1],[5,-5],[2,-2],[3,-1],[14,-3],[17,-6],[4,-2],[2,-1],[1,-2],[1,-1],[-1,-4],[0,-2],[2,-3],[2,-1],[3,-1],[9,-2],[9,-3],[21,-11],[33,-26],[3,-1],[4,-1],[8,1],[4,-20],[-1,-7],[-1,-5],[1,-2],[2,-2],[3,-1],[3,-1],[3,0],[3,0],[5,1],[3,1],[2,-1],[12,-2],[11,-4],[4,-1],[4,0],[9,1],[4,0],[3,0],[11,-3],[2,0],[3,0],[10,0],[5,0],[6,-1],[11,-3],[6,-2],[3,-2],[1,-1],[-1,-3],[1,-9],[2,-2],[3,-3],[6,-4],[2,-3],[0,-1],[-1,-2],[0,-2],[2,-3],[9,-7],[5,-3],[4,-2],[3,0],[3,1],[2,0],[3,1],[4,0],[13,-3],[4,-1],[7,0],[2,0],[6,1],[10,3],[8,1],[5,2],[5,1],[3,3],[2,1],[2,1],[2,1],[2,1],[3,0],[3,1],[6,0],[3,-1],[3,-4],[4,-3],[14,-7],[4,-2],[18,-3],[17,-4],[22,-4],[15,-5],[10,-6],[12,-8],[4,-4],[6,-4],[13,-8],[5,-2],[7,-2],[20,-5],[4,-1],[2,-2],[6,-4],[13,-9],[4,-2],[4,-1],[3,0],[6,0],[4,0],[5,-1],[3,-1],[3,-1],[6,-6],[10,-6],[38,-13],[4,-1],[3,-2],[1,-1],[3,-3],[1,-1],[1,-3],[1,-2],[2,-2],[6,-4],[25,-11],[4,-2],[1,-2],[4,-6],[2,-2],[2,-1],[11,-3],[5,-1],[3,-1],[3,0],[9,2],[3,0],[4,-1],[2,-1],[2,-1],[0,-1],[-1,-2],[-1,-1],[1,-2],[2,-1],[10,-2],[1,-1]],[[5644,9793],[17,-1],[6,-1],[4,-2],[1,-1],[1,-1],[-1,-4],[2,-2],[3,0],[3,0],[3,-1],[11,-7],[4,-5],[-3,-5],[-7,-6],[0,-3],[7,-4],[12,-3],[6,-1],[3,1],[2,-1],[3,-3],[-4,-7],[0,-4],[10,-3],[-7,-7],[2,-2],[7,-1],[3,-2],[3,-4],[3,-3],[14,-8],[1,-2],[2,-3],[2,-2],[3,-1],[1,-1],[4,-3],[5,-2],[2,0],[2,-3],[5,-4],[11,-6],[7,-6],[9,-11],[6,-5],[1,-2],[-3,-8],[2,-1],[0,-1],[7,-6],[18,-11],[56,-19],[4,-2],[11,-9],[6,-3],[11,-4],[6,-2],[5,-4],[3,-3],[2,-3],[0,-6],[2,-5],[6,-3],[7,-2],[7,-2],[8,-5],[4,-2],[7,-1],[24,0],[7,-2],[25,-14],[5,-2],[6,0],[9,0],[-3,-3],[-2,-3],[-1,-3],[9,-3],[4,-7],[5,-2],[11,0],[9,-1],[8,-2],[8,-3],[6,-3],[5,-2],[6,-1],[12,0],[33,-8],[4,-4],[3,-5],[5,-4],[10,-2],[5,-1],[9,-5],[5,-2],[3,0],[10,0],[4,0],[6,-3],[7,-4],[8,-4],[8,-1],[6,-3],[2,-6],[-1,-7],[-5,-5],[5,-3],[8,-8],[13,-4],[9,-5],[6,-7],[0,-4],[3,-1],[8,-7],[4,-3],[16,-5],[19,3],[19,-5],[17,-8],[14,-5],[11,0],[14,0],[29,0],[5,-1],[10,-5],[5,0],[23,0],[6,0],[6,-1],[8,-3],[5,0],[1,-2],[8,-9],[3,-1],[17,0],[10,-3],[16,-6],[31,-4],[18,1],[5,-1],[5,-2],[10,-4],[5,-2],[5,-1],[16,1],[39,-3],[38,0],[12,2],[23,4],[10,1],[10,-1],[180,-66],[19,-11],[9,-6],[4,-2],[5,-1],[12,-1],[9,-3],[9,-1],[4,-2],[6,-3],[5,-2],[11,-4],[11,-2],[4,-2],[1,-2],[1,-3],[2,-2],[12,-3],[20,-10],[5,-3],[10,-10],[8,-6],[17,-3],[6,-4],[5,-1],[7,-1],[4,-2],[3,-2],[5,-2],[21,-4],[14,-5],[12,-2],[19,-7],[9,-2],[10,0],[3,-1],[5,-1],[10,-6],[5,-2],[16,-2],[96,-40],[10,-1],[26,-1],[7,-1],[4,-1],[4,-1],[3,-1],[1,-3],[3,-1],[110,-12],[12,-3],[6,-4],[12,-9],[32,-19],[3,-3],[2,-3],[2,-1],[7,-1],[5,0],[7,2],[6,2],[14,8],[8,4],[10,0],[45,-17],[5,-5],[6,1],[35,-10],[5,0],[11,0],[5,0],[3,-3],[2,-3],[3,-3],[7,-1],[40,0],[10,-2],[7,-4],[22,-14],[8,-3],[15,-4],[6,-4],[17,-20],[9,-7],[16,-6],[15,-21],[0,-4],[22,-9],[9,-4],[7,-4],[4,-4],[0,-5],[-6,-26],[-3,-5],[-6,-4],[-7,-1],[-5,-2],[-2,-7],[-4,-2],[-8,0],[-14,1],[-1,-1],[-3,-7],[-2,-2],[-5,-2],[-5,0],[-5,0],[-5,0],[-11,-3],[-6,-3],[-11,-9],[3,-2],[4,-2],[5,-1],[5,-1],[-5,-4],[-9,-4],[-9,-4],[-9,-2],[-8,-3],[2,-6],[7,-10],[-5,-4],[-4,-1],[-6,-3],[-11,-3],[-10,-2],[-2,-2],[2,-2],[11,-3],[1,-3],[-3,-3],[-3,-3],[-18,-7],[-4,-5],[23,-4],[0,-4],[-6,-4],[-58,-24],[-17,-5],[-32,-7],[-6,-2],[-4,-11],[-5,-6],[-4,-3],[-2,2],[-3,2],[-4,1],[-5,1],[1,-5],[6,-3],[8,-3],[8,-2],[0,-4],[-9,-4],[-11,-3],[-8,-1],[-4,-2],[0,-5],[2,-9],[-1,-5],[-3,-4],[-16,-16],[-4,-5],[2,-4],[12,-6],[-2,-3],[-7,-3],[-1,-2],[-2,-6],[-2,-4],[-2,-5],[2,-5],[3,-2],[11,-4],[3,-3],[4,-4],[3,-1],[-3,-2],[-9,-4],[-1,-1],[0,-3],[2,-3],[3,-2],[1,-3],[-2,-2],[-6,0],[-16,2],[-3,1],[-1,-1],[-3,-3],[-2,-6],[-1,-23],[-2,-2],[-4,0],[-6,0],[-8,-1],[0,-3],[4,-4],[2,-2],[-7,-4],[-8,0],[-9,2],[-9,-1],[-6,-7],[6,-4],[9,-4],[4,-5],[-7,-3],[-11,-1]],[[8843,8332],[-1,0],[-13,-6],[-3,-1],[-1,-1],[-7,-10],[-1,-4],[-1,-4],[0,-7],[1,-3],[72,-79],[8,-11],[3,-10],[4,-22],[3,-14],[3,-4],[4,-4],[16,-8],[5,-4],[4,-5],[3,-3],[0,-1],[1,-5],[1,-3],[3,-4],[4,-3],[7,-4],[15,-8],[40,-15],[1,-1],[1,0]],[[9015,8088],[-1,0],[-4,-3],[-5,-2],[-21,-11],[-32,-5],[-12,-5],[3,-8],[6,-2],[20,-5],[6,-1],[8,-2],[5,-3],[6,-8],[-7,-14],[-3,-4],[-5,-4],[-6,-2],[-4,1],[-2,6],[-8,5],[-19,3],[-20,1],[-15,2],[-23,-5],[-9,-4],[3,-6],[1,-3],[0,-14],[0,-2],[-2,-1],[-5,-2],[-4,-1],[-16,-1],[-14,-4],[-16,-2],[-5,-4],[-1,-5],[1,-6],[0,-12],[-10,-7],[-31,-11],[-41,-29],[-17,-6],[-24,-3],[-10,-2],[-4,-5],[-3,-25],[-12,-11],[-34,-11],[-10,-12],[0,-12],[-2,-6],[-6,-5],[-8,-3],[-35,-4],[-18,-5],[-18,-7],[-16,-9],[-13,-10],[-4,-4],[-3,-4],[0,-5],[3,-4],[-5,-6],[-8,-12],[-6,-5],[-8,-4],[-7,-3],[-18,-5],[-4,-1],[-4,-2],[-3,-2],[-2,-3],[-1,-3],[0,-3],[-1,-3],[-8,-3],[-4,-3],[-2,-4],[-1,-3],[-2,-2],[-40,-18],[-3,-4],[-4,-3],[-20,-8],[-7,-5],[-7,-10],[-15,-8],[-2,-3],[-4,-4],[-36,-20],[-10,-4],[-10,-2],[-22,0],[-21,-2],[-22,-4],[-14,-7],[-9,-10],[-5,-35],[-3,-5],[-44,-18],[-47,-31],[-21,-8],[-11,-2],[-21,-2],[-11,0],[-5,-3],[3,-6],[7,-13],[-4,-12],[-11,-10],[-99,-47],[-13,-8],[-7,-11],[2,-12],[12,-12],[7,-5],[11,-13],[4,-7],[5,-10]],[[7918,7306],[-4,1],[-27,10],[-59,32],[-4,4],[-21,20],[-3,7],[-4,14],[-2,4],[-6,6],[-23,9],[-29,15],[-11,7],[-7,8],[-5,6],[-2,2],[-4,3],[-16,7],[-97,14],[-24,0],[-10,0],[-6,2],[-3,0],[-11,5],[-6,1],[-7,1],[-7,1],[-14,0],[-64,-14],[-9,-3],[-9,-1],[-42,-5],[-5,0],[-15,1],[-28,5],[-16,1],[-8,-2],[-12,-3],[-27,-9],[-20,-9],[-4,-3],[-10,-5],[-38,-11],[-48,9],[-26,2],[-34,-4],[-4,0],[-13,3],[-2,0],[-2,0],[-3,0],[-32,-7],[-6,0],[-41,-1]],[[6988,7429],[-4,13],[2,5],[9,15],[2,6],[1,12],[2,5],[3,5],[15,15],[3,5],[0,5],[-1,11],[-16,25],[-17,16],[-4,9],[4,9],[16,16],[3,4],[18,41],[1,61],[3,10],[17,36],[8,8],[11,7],[13,6],[14,4],[49,10],[15,5],[13,8],[15,6],[23,6],[7,3],[8,8],[2,10],[0,20],[2,1],[4,5],[11,11],[4,5],[1,8],[4,10],[1,3],[0,3],[-1,2],[-1,5],[3,5],[19,20],[4,5],[3,6],[0,6],[-2,23],[12,39],[-1,5],[-10,13],[-1,6],[4,17],[-1,5],[-3,11],[0,6],[1,5],[3,5],[5,5],[6,4],[9,2],[10,0],[20,0],[16,3],[15,5],[13,7],[9,8],[6,14]],[[7519,8337],[2,1],[45,10],[136,7],[55,-4],[8,0],[30,3],[16,0],[9,-1],[30,-3],[0,-1],[15,-3],[7,-1],[23,-2],[21,-4],[1,0],[51,-6],[5,-1],[1,0],[81,-22],[8,-2],[3,0],[13,-1],[51,4],[13,0],[2,-1],[11,-1],[4,-2],[8,-4],[4,-2],[5,-1],[5,-1],[23,-3],[0,-1],[5,-1],[13,-6],[5,-2],[5,0],[12,-1],[4,0],[20,0],[17,2],[49,14],[18,4],[19,1],[17,-4],[31,-16],[18,-6],[1,0],[18,2],[26,10],[22,4],[13,2],[33,-3],[21,-13],[9,-8],[13,-8],[15,-7],[16,-3],[16,2],[9,7],[7,9],[10,8],[10,5],[5,6],[2,7],[-2,8],[3,7],[12,3],[14,2],[12,3],[18,11],[9,4],[13,4],[13,0],[12,-2],[1,0],[33,-7],[11,-1],[10,0]],[[7918,7306],[3,-8],[2,-6],[1,-7],[1,-13],[-1,-3],[-3,-7],[-2,-5],[-7,-1],[-11,1],[-21,-3],[-10,-3],[-4,-5],[3,-4],[22,-16],[4,-14],[-10,-10],[-12,-10],[-7,-14],[4,-13],[0,-8],[-5,-3],[-11,-12],[-3,-2],[-9,-3],[-3,-2],[-5,-6],[-2,-14],[-5,-5],[-8,-4],[-19,-6],[-9,-4],[-7,-9],[13,-8],[5,-2],[13,-5],[14,-9],[3,-13],[-4,-14],[-31,-46],[-5,-4],[-12,-3],[-24,-2],[-11,-3],[-8,-3],[-13,-8],[-4,-6],[6,-6],[16,-9],[5,-9],[2,-13],[-1,-14],[-6,-11],[-11,-10],[-3,-6],[6,-6],[34,-24],[6,-8],[-3,-9],[-32,-24],[-12,-13],[-5,-4],[-1,0],[-9,-13],[-2,-13],[6,-37],[9,-21],[7,-31],[5,-6],[13,-11],[3,-5],[-2,-5],[-7,-12],[-2,-6],[5,-14],[1,-8],[-4,-3],[-19,-8],[-6,-1],[-12,-1],[-6,0],[-71,6],[-18,-4],[-3,-2],[-3,-2],[-1,-3],[10,-2],[0,-2],[-2,-4],[-1,-3],[-2,-6],[-5,-14],[0,-5],[8,-13],[2,-7],[-5,-3],[-9,-2],[-10,-6],[-14,-11],[-9,-10],[-8,-14],[-5,-13],[-2,-12],[4,-14],[-1,-3],[-5,-6],[-5,-22],[0,-6],[5,-12],[8,-10],[27,-20],[5,-5],[2,-6],[2,-13],[7,-17],[-2,-3],[-2,-3],[0,-2]],[[6671,6551],[-16,5],[-11,5],[-3,2],[-6,6],[-8,5],[-6,2],[-4,1],[-7,2],[-9,2],[-31,11],[-29,18],[-2,3],[-13,20],[-2,2],[-2,2],[-5,2],[-2,1],[-9,6],[-27,29],[-7,11],[-4,12],[-4,27],[-3,6],[-5,5],[-19,14],[-3,5],[-2,6],[2,5],[15,20],[3,6],[2,6],[-3,18],[1,7],[2,6],[11,17],[1,6],[0,7],[-3,18],[1,5],[3,6],[17,15],[2,5],[-2,7],[-6,5],[-14,11],[-6,7],[-2,7],[1,7],[6,7],[14,10],[3,4],[2,3],[2,10],[6,9],[2,4],[-2,4],[1,1],[1,0],[1,1],[-2,2],[-1,3],[1,2],[2,2],[4,2],[4,1],[14,2],[10,1],[11,-1],[34,0],[11,1],[10,2],[10,2],[10,3],[16,8],[15,8],[25,20],[13,7],[7,5],[4,3],[7,3],[7,2],[1,1],[6,5],[3,2],[4,1],[4,1],[7,1],[4,1],[2,2],[10,9],[20,13],[3,4],[2,0],[16,26],[5,4],[20,9],[6,4],[30,29],[30,22],[20,20],[23,15],[11,10],[27,18],[30,29],[3,6],[2,17],[2,6],[11,14],[1,5],[0,18],[3,11],[1,5],[-2,5],[-14,14],[-3,5],[-5,14]],[[8843,8332],[2,0],[13,1],[11,0],[10,-2],[8,-5],[7,-12],[5,-3],[6,-1],[13,-2],[31,-9],[18,8],[18,11],[14,6],[13,1],[11,3],[8,5],[5,7],[0,4],[-1,3],[-1,2],[7,6],[1,3],[-1,3],[-2,4],[-12,12],[0,5],[13,1],[9,3],[3,5],[2,6],[6,5],[9,1],[14,-1],[13,1],[5,4],[1,14],[3,6],[6,6],[9,5],[9,3],[10,2],[23,2],[25,7],[12,0],[10,-3],[10,-2],[7,-2],[20,0],[12,1],[8,4],[2,6],[-7,12],[3,5],[33,18],[10,2],[25,1],[8,2],[7,4],[5,5],[4,5],[6,14],[6,6],[8,4],[12,2],[22,0],[4,-1],[2,-2],[3,0],[5,1],[7,5],[4,6],[2,8],[1,7],[-2,5],[-3,5],[0,4],[5,5],[7,5],[14,6],[16,10],[4,4],[2,5],[5,18],[2,2],[0,1],[8,10],[0,13],[-1,6],[0,2],[1,1],[4,4],[6,4],[3,3],[-2,4],[-9,6],[-2,5],[10,19],[1,7],[-6,9],[-2,10],[-2,3],[0,3],[3,3],[4,1],[12,0],[4,1],[5,5],[-1,5],[-4,14],[3,5],[5,4],[5,6],[1,6],[-3,4],[-12,8],[-2,4],[-1,6],[-10,15],[1,8],[4,3],[18,0],[7,2],[-1,6],[-8,10],[1,5],[20,2],[7,-2],[3,-3],[1,-5],[3,-2],[11,1],[10,-2],[9,-4],[6,-5],[2,-6],[0,-3],[2,-3],[3,-2],[5,1],[2,3],[-2,6],[0,3],[3,3],[9,3],[4,2],[1,3],[0,3],[0,3],[4,3],[4,1],[5,0],[8,-2],[6,0],[8,6],[6,2],[11,1],[7,-1],[6,-4],[5,-6],[4,-3],[3,2],[3,5],[4,0],[3,0],[10,-2],[10,1],[-3,5],[-10,9],[4,2],[5,-1],[10,-2],[6,1],[6,1],[13,9],[3,1],[3,1],[2,-1],[2,-1],[-2,-6],[-4,-5],[-3,-5],[1,-6],[3,-2],[4,-3],[6,-2],[4,0],[2,2],[0,3],[-1,3],[-1,3],[4,3],[5,-2],[8,-4],[7,0],[3,2],[3,0],[7,-1],[9,-3],[7,-4],[3,-5],[1,-6],[4,-8],[10,1],[19,6],[6,-3],[6,-7],[5,-11],[-1,-2],[-2,-2],[-1,-3],[1,-4],[3,-3],[10,-5],[4,-3],[4,-6],[2,-5],[-2,-18],[6,-16],[-1,-3],[-2,-2],[-1,-3],[2,-4],[3,-3],[17,-8],[0,-1],[14,-8],[6,-9],[3,-10],[7,-10],[24,-19],[9,-9],[3,-12],[-6,-10],[-21,-17],[-5,-8],[6,-29],[0,-9],[-7,-3],[-4,-2],[-1,-2],[1,-3],[2,-3],[2,-2],[0,1],[-1,-5],[-7,-11],[0,-5],[3,-12],[-1,-5],[-3,-6],[-4,-2],[-5,0],[-4,-1],[-2,-3],[3,-4],[4,-2],[4,-1],[3,-1],[0,-3],[-3,-4],[0,-3],[2,0],[6,-1],[2,0],[5,-11],[6,-18],[-1,-9],[-6,-11],[-22,-25],[-2,-2],[-3,-1],[-8,-1],[-3,-1],[-2,-4],[1,-8],[-1,-4],[-2,-2],[-8,-3],[-2,-1],[0,-3],[5,-2],[0,-3],[-6,-5],[-6,-2],[-3,2],[-5,5],[-5,4],[-7,2],[-4,-2],[-4,-10],[-5,-3],[-8,1],[-7,3],[-6,3],[-7,-2],[-1,-4],[3,-4],[-1,-4],[-10,-1],[-3,1],[-2,1],[-2,1],[-4,-1],[-3,-1],[-4,-6],[-37,-22],[-18,-1],[-15,3],[1,7],[-5,2],[-6,2],[-6,-5],[-14,-21],[-3,-2],[-2,-2],[-2,-3],[1,-6],[-1,-2],[-4,-1],[-6,-1],[-5,-1],[-2,-3],[-2,-2],[-3,-3],[-3,-3],[-3,-1],[-10,0],[-7,3],[-6,4],[-7,4],[0,-10],[0,-3],[-4,-3],[-4,-2],[-4,-1],[-2,3],[-2,7],[-5,3],[-8,2],[-20,-1],[-8,-1],[-2,-3],[9,-7],[-1,-4],[-10,-3],[-33,-5],[-4,0],[-6,1],[-2,1],[-4,6],[-2,1],[-4,0],[-3,1],[-3,0],[-4,-2],[-4,-3],[-2,-3],[-3,-5],[-5,-6],[-7,-3],[-6,0],[-2,6],[-2,1],[-3,0],[-4,-2],[-1,-3],[0,-5],[-1,-2],[-2,-1],[-4,-2],[-5,0],[-11,0],[-5,0],[-21,-3],[-3,0],[-1,1],[-3,2],[-1,0],[-2,1],[1,1],[1,2],[1,1],[-2,4],[-7,-1],[-7,-3],[-4,-3],[-3,-6],[-2,-7],[-4,-7],[-10,-3],[-12,0],[-5,0],[1,-12],[-2,-13],[-3,-7],[-3,-2],[-10,-3],[-26,-12],[-12,-1],[-9,2],[-9,2],[-10,1],[-8,-2],[5,-5],[15,-7],[7,-7],[-1,-3],[-9,0],[-11,4],[-5,-1],[-11,-1],[-4,0],[-2,-2],[-3,-9],[-11,1],[-11,6],[-8,1],[-10,-2],[-7,-5],[-6,-5],[-18,-7],[-5,-1],[-6,0],[-10,2],[-6,0],[-8,-4],[-2,-6],[-2,-4],[-11,-3],[-5,0],[-4,0],[-2,-2],[-1,-3],[1,-6],[-1,-2],[-3,-3],[-23,-14],[-3,-2],[-12,-2],[-5,-1],[-4,1],[-2,2],[-3,1],[-6,-1],[-2,-2],[-6,-7],[-2,-1],[-7,-2],[-2,-2],[-3,-2],[0,-3],[-2,-1],[-6,-1],[-6,1],[-1,2],[0,3],[-1,2],[-12,1],[-6,-3],[-3,-5]],[[7584,6171],[11,-4],[10,-2],[10,-4],[17,-5],[8,-4],[9,-7],[6,-7],[9,-8]]],"transform":{"scale":[0.0019928476816474115,0.0033268404959495806],"translate":[-73.58803584899991,-55.05201588299982]}};
  Datamap.prototype.armTopo = '__ARM__';
  Datamap.prototype.asmTopo = '__ASM__';
  Datamap.prototype.ataTopo = '__ATA__';
  Datamap.prototype.atcTopo = '__ATC__';
  Datamap.prototype.atfTopo = '__ATF__';
  Datamap.prototype.atgTopo = '__ATG__';
  Datamap.prototype.ausTopo = '__AUS__';
  Datamap.prototype.autTopo = '__AUT__';
  Datamap.prototype.azeTopo = '__AZE__';
  Datamap.prototype.bdiTopo = '__BDI__';
  Datamap.prototype.belTopo = '__BEL__';
  Datamap.prototype.benTopo = '__BEN__';
  Datamap.prototype.bfaTopo = '__BFA__';
  Datamap.prototype.bgdTopo = '__BGD__';
  Datamap.prototype.bgrTopo = '__BGR__';
  Datamap.prototype.bhrTopo = '__BHR__';
  Datamap.prototype.bhsTopo = '__BHS__';
  Datamap.prototype.bihTopo = '__BIH__';
  Datamap.prototype.bjnTopo = '__BJN__';
  Datamap.prototype.blmTopo = '__BLM__';
  Datamap.prototype.blrTopo = '__BLR__';
  Datamap.prototype.blzTopo = '__BLZ__';
  Datamap.prototype.bmuTopo = '__BMU__';
  Datamap.prototype.bolTopo = '__BOL__';
  Datamap.prototype.braTopo = '__BRA__';
  Datamap.prototype.brbTopo = '__BRB__';
  Datamap.prototype.brnTopo = '__BRN__';
  Datamap.prototype.btnTopo = '__BTN__';
  Datamap.prototype.norTopo = '__NOR__';
  Datamap.prototype.bwaTopo = '__BWA__';
  Datamap.prototype.cafTopo = '__CAF__';
  Datamap.prototype.canTopo = '__CAN__';
  Datamap.prototype.cheTopo = '__CHE__';
  Datamap.prototype.chlTopo = '__CHL__';
  Datamap.prototype.chnTopo = '__CHN__';
  Datamap.prototype.civTopo = '__CIV__';
  Datamap.prototype.clpTopo = '__CLP__';
  Datamap.prototype.cmrTopo = '__CMR__';
  Datamap.prototype.codTopo = '__COD__';
  Datamap.prototype.cogTopo = '__COG__';
  Datamap.prototype.cokTopo = '__COK__';
  Datamap.prototype.colTopo = '__COL__';
  Datamap.prototype.comTopo = '__COM__';
  Datamap.prototype.cpvTopo = '__CPV__';
  Datamap.prototype.criTopo = '__CRI__';
  Datamap.prototype.csiTopo = '__CSI__';
  Datamap.prototype.cubTopo = '__CUB__';
  Datamap.prototype.cuwTopo = '__CUW__';
  Datamap.prototype.cymTopo = '__CYM__';
  Datamap.prototype.cynTopo = '__CYN__';
  Datamap.prototype.cypTopo = '__CYP__';
  Datamap.prototype.czeTopo = '__CZE__';
  Datamap.prototype.deuTopo = '__DEU__';
  Datamap.prototype.djiTopo = '__DJI__';
  Datamap.prototype.dmaTopo = '__DMA__';
  Datamap.prototype.dnkTopo = '__DNK__';
  Datamap.prototype.domTopo = '__DOM__';
  Datamap.prototype.dzaTopo = '__DZA__';
  Datamap.prototype.ecuTopo = '__ECU__';
  Datamap.prototype.egyTopo = '__EGY__';
  Datamap.prototype.eriTopo = '__ERI__';
  Datamap.prototype.esbTopo = '__ESB__';
  Datamap.prototype.espTopo = '__ESP__';
  Datamap.prototype.estTopo = '__EST__';
  Datamap.prototype.ethTopo = '__ETH__';
  Datamap.prototype.finTopo = '__FIN__';
  Datamap.prototype.fjiTopo = '__FJI__';
  Datamap.prototype.flkTopo = '__FLK__';
  Datamap.prototype.fraTopo = '__FRA__';
  Datamap.prototype.froTopo = '__FRO__';
  Datamap.prototype.fsmTopo = '__FSM__';
  Datamap.prototype.gabTopo = '__GAB__';
  Datamap.prototype.psxTopo = '__PSX__';
  Datamap.prototype.gbrTopo = '__GBR__';
  Datamap.prototype.geoTopo = '__GEO__';
  Datamap.prototype.ggyTopo = '__GGY__';
  Datamap.prototype.ghaTopo = '__GHA__';
  Datamap.prototype.gibTopo = '__GIB__';
  Datamap.prototype.ginTopo = '__GIN__';
  Datamap.prototype.gmbTopo = '__GMB__';
  Datamap.prototype.gnbTopo = '__GNB__';
  Datamap.prototype.gnqTopo = '__GNQ__';
  Datamap.prototype.grcTopo = '__GRC__';
  Datamap.prototype.grdTopo = '__GRD__';
  Datamap.prototype.grlTopo = '__GRL__';
  Datamap.prototype.gtmTopo = '__GTM__';
  Datamap.prototype.gumTopo = '__GUM__';
  Datamap.prototype.guyTopo = '__GUY__';
  Datamap.prototype.hkgTopo = '__HKG__';
  Datamap.prototype.hmdTopo = '__HMD__';
  Datamap.prototype.hndTopo = '__HND__';
  Datamap.prototype.hrvTopo = '__HRV__';
  Datamap.prototype.htiTopo = '__HTI__';
  Datamap.prototype.hunTopo = '__HUN__';
  Datamap.prototype.idnTopo = '__IDN__';
  Datamap.prototype.imnTopo = '__IMN__';
  Datamap.prototype.indTopo = '__IND__';
  Datamap.prototype.ioaTopo = '__IOA__';
  Datamap.prototype.iotTopo = '__IOT__';
  Datamap.prototype.irlTopo = '__IRL__';
  Datamap.prototype.irnTopo = '__IRN__';
  Datamap.prototype.irqTopo = '__IRQ__';
  Datamap.prototype.islTopo = '__ISL__';
  Datamap.prototype.isrTopo = '__ISR__';
  Datamap.prototype.itaTopo = '__ITA__';
  Datamap.prototype.jamTopo = '__JAM__';
  Datamap.prototype.jeyTopo = '__JEY__';
  Datamap.prototype.jorTopo = '__JOR__';
  Datamap.prototype.jpnTopo = '__JPN__';
  Datamap.prototype.kabTopo = '__KAB__';
  Datamap.prototype.kasTopo = '__KAS__';
  Datamap.prototype.kazTopo = '__KAZ__';
  Datamap.prototype.kenTopo = '__KEN__';
  Datamap.prototype.kgzTopo = '__KGZ__';
  Datamap.prototype.khmTopo = '__KHM__';
  Datamap.prototype.kirTopo = '__KIR__';
  Datamap.prototype.knaTopo = '__KNA__';
  Datamap.prototype.korTopo = '__KOR__';
  Datamap.prototype.kosTopo = '__KOS__';
  Datamap.prototype.kwtTopo = '__KWT__';
  Datamap.prototype.laoTopo = '__LAO__';
  Datamap.prototype.lbnTopo = '__LBN__';
  Datamap.prototype.lbrTopo = '__LBR__';
  Datamap.prototype.lbyTopo = '__LBY__';
  Datamap.prototype.lcaTopo = '__LCA__';
  Datamap.prototype.lieTopo = '__LIE__';
  Datamap.prototype.lkaTopo = '__LKA__';
  Datamap.prototype.lsoTopo = '__LSO__';
  Datamap.prototype.ltuTopo = '__LTU__';
  Datamap.prototype.luxTopo = '__LUX__';
  Datamap.prototype.lvaTopo = '__LVA__';
  Datamap.prototype.macTopo = '__MAC__';
  Datamap.prototype.mafTopo = '__MAF__';
  Datamap.prototype.marTopo = '__MAR__';
  Datamap.prototype.mcoTopo = '__MCO__';
  Datamap.prototype.mdaTopo = '__MDA__';
  Datamap.prototype.mdgTopo = '__MDG__';
  Datamap.prototype.mdvTopo = '__MDV__';
  Datamap.prototype.mexTopo = '__MEX__';
  Datamap.prototype.mhlTopo = '__MHL__';
  Datamap.prototype.mkdTopo = '__MKD__';
  Datamap.prototype.mliTopo = '__MLI__';
  Datamap.prototype.mltTopo = '__MLT__';
  Datamap.prototype.mmrTopo = '__MMR__';
  Datamap.prototype.mneTopo = '__MNE__';
  Datamap.prototype.mngTopo = '__MNG__';
  Datamap.prototype.mnpTopo = '__MNP__';
  Datamap.prototype.mozTopo = '__MOZ__';
  Datamap.prototype.mrtTopo = '__MRT__';
  Datamap.prototype.msrTopo = '__MSR__';
  Datamap.prototype.musTopo = '__MUS__';
  Datamap.prototype.mwiTopo = '__MWI__';
  Datamap.prototype.mysTopo = '__MYS__';
  Datamap.prototype.namTopo = '__NAM__';
  Datamap.prototype.nclTopo = '__NCL__';
  Datamap.prototype.nerTopo = '__NER__';
  Datamap.prototype.nfkTopo = '__NFK__';
  Datamap.prototype.ngaTopo = '__NGA__';
  Datamap.prototype.nicTopo = '__NIC__';
  Datamap.prototype.niuTopo = '__NIU__';
  Datamap.prototype.nldTopo = '__NLD__';
  Datamap.prototype.nplTopo = '__NPL__';
  Datamap.prototype.nruTopo = '__NRU__';
  Datamap.prototype.nulTopo = '__NUL__';
  Datamap.prototype.nzlTopo = '__NZL__';
  Datamap.prototype.omnTopo = '__OMN__';
  Datamap.prototype.pakTopo = '__PAK__';
  Datamap.prototype.panTopo = '__PAN__';
  Datamap.prototype.pcnTopo = '__PCN__';
  Datamap.prototype.perTopo = '__PER__';
  Datamap.prototype.pgaTopo = '__PGA__';
  Datamap.prototype.phlTopo = '__PHL__';
  Datamap.prototype.plwTopo = '__PLW__';
  Datamap.prototype.pngTopo = '__PNG__';
  Datamap.prototype.polTopo = '__POL__';
  Datamap.prototype.priTopo = '__PRI__';
  Datamap.prototype.prkTopo = '__PRK__';
  Datamap.prototype.prtTopo = '__PRT__';
  Datamap.prototype.pryTopo = '__PRY__';
  Datamap.prototype.pyfTopo = '__PYF__';
  Datamap.prototype.qatTopo = '__QAT__';
  Datamap.prototype.rouTopo = '__ROU__';
  Datamap.prototype.rusTopo = '__RUS__';
  Datamap.prototype.rwaTopo = '__RWA__';
  Datamap.prototype.sahTopo = '__SAH__';
  Datamap.prototype.sauTopo = '__SAU__';
  Datamap.prototype.scrTopo = '__SCR__';
  Datamap.prototype.sdnTopo = '__SDN__';
  Datamap.prototype.sdsTopo = '__SDS__';
  Datamap.prototype.senTopo = '__SEN__';
  Datamap.prototype.serTopo = '__SER__';
  Datamap.prototype.sgpTopo = '__SGP__';
  Datamap.prototype.sgsTopo = '__SGS__';
  Datamap.prototype.shnTopo = '__SHN__';
  Datamap.prototype.slbTopo = '__SLB__';
  Datamap.prototype.sleTopo = '__SLE__';
  Datamap.prototype.slvTopo = '__SLV__';
  Datamap.prototype.smrTopo = '__SMR__';
  Datamap.prototype.solTopo = '__SOL__';
  Datamap.prototype.somTopo = '__SOM__';
  Datamap.prototype.spmTopo = '__SPM__';
  Datamap.prototype.srbTopo = '__SRB__';
  Datamap.prototype.stpTopo = '__STP__';
  Datamap.prototype.surTopo = '__SUR__';
  Datamap.prototype.svkTopo = '__SVK__';
  Datamap.prototype.svnTopo = '__SVN__';
  Datamap.prototype.sweTopo = '__SWE__';
  Datamap.prototype.swzTopo = '__SWZ__';
  Datamap.prototype.sxmTopo = '__SXM__';
  Datamap.prototype.sycTopo = '__SYC__';
  Datamap.prototype.syrTopo = '__SYR__';
  Datamap.prototype.tcaTopo = '__TCA__';
  Datamap.prototype.tcdTopo = '__TCD__';
  Datamap.prototype.tgoTopo = '__TGO__';
  Datamap.prototype.thaTopo = '__THA__';
  Datamap.prototype.tjkTopo = '__TJK__';
  Datamap.prototype.tkmTopo = '__TKM__';
  Datamap.prototype.tlsTopo = '__TLS__';
  Datamap.prototype.tonTopo = '__TON__';
  Datamap.prototype.ttoTopo = '__TTO__';
  Datamap.prototype.tunTopo = '__TUN__';
  Datamap.prototype.turTopo = '__TUR__';
  Datamap.prototype.tuvTopo = '__TUV__';
  Datamap.prototype.twnTopo = '__TWN__';
  Datamap.prototype.tzaTopo = '__TZA__';
  Datamap.prototype.ugaTopo = '__UGA__';
  Datamap.prototype.ukrTopo = '__UKR__';
  Datamap.prototype.umiTopo = '__UMI__';
  Datamap.prototype.uryTopo = '__URY__';
  Datamap.prototype.usaTopo = '__USA__';
  Datamap.prototype.usgTopo = '__USG__';
  Datamap.prototype.uzbTopo = '__UZB__';
  Datamap.prototype.vatTopo = '__VAT__';
  Datamap.prototype.vctTopo = '__VCT__';
  Datamap.prototype.venTopo = '__VEN__';
  Datamap.prototype.vgbTopo = '__VGB__';
  Datamap.prototype.virTopo = '__VIR__';
  Datamap.prototype.vnmTopo = '__VNM__';
  Datamap.prototype.vutTopo = '__VUT__';
  Datamap.prototype.wlfTopo = '__WLF__';
  Datamap.prototype.wsbTopo = '__WSB__';
  Datamap.prototype.wsmTopo = '__WSM__';
  Datamap.prototype.yemTopo = '__YEM__';
  Datamap.prototype.zafTopo = '__ZAF__';
  Datamap.prototype.zmbTopo = '__ZMB__';
  Datamap.prototype.zweTopo = '__ZWE__';

  /**************************************
                Utilities
  ***************************************/

  //convert lat/lng coords to X / Y coords
  Datamap.prototype.latLngToXY = function(lat, lng) {
     return this.projection([lng, lat]);
  };

  //add <g> layer to root SVG
  Datamap.prototype.addLayer = function( className, id, first ) {
    var layer;
    if ( first ) {
      layer = this.svg.insert('g', ':first-child')
    }
    else {
      layer = this.svg.append('g')
    }
    return layer.attr('id', id || '')
      .attr('class', className || '');
  };

  Datamap.prototype.updateChoropleth = function(data) {
    var svg = this.svg;
    for ( var subunit in data ) {
      if ( data.hasOwnProperty(subunit) ) {
        var color;
        var subunitData = data[subunit]
        if ( ! subunit ) {
          continue;
        }
        else if ( typeof subunitData === "string" ) {
          color = subunitData;
        }
        else if ( typeof subunitData.color === "string" ) {
          color = subunitData.color;
        }
        else {
          color = this.options.fills[ subunitData.fillKey ];
        }
        //if it's an object, overriding the previous data
        if ( subunitData === Object(subunitData) ) {
          this.options.data[subunit] = defaults(subunitData, this.options.data[subunit] || {});
          var geo = this.svg.select('.' + subunit).attr('data-info', JSON.stringify(this.options.data[subunit]));
        }
        svg
          .selectAll('.' + subunit)
          .transition()
            .style('fill', color);
      }
    }
  };

  Datamap.prototype.updatePopup = function (element, d, options) {
    var self = this;
    element.on('mousemove', null);
    element.on('mousemove', function() {
      var position = d3.mouse(self.options.element);
      d3.select(self.svg[0][0].parentNode).select('.datamaps-hoverover')
        .style('top', ( (position[1] + 30)) + "px")
        .html(function() {
          var data = JSON.parse(element.attr('data-info'));
          try {
            return options.popupTemplate(d, data);
          } catch (e) {
            return "";
          }
        })
        .style('left', ( position[0]) + "px");
    });

    d3.select(self.svg[0][0].parentNode).select('.datamaps-hoverover').style('display', 'block');
  };

  Datamap.prototype.addPlugin = function( name, pluginFn ) {
    var self = this;
    if ( typeof Datamap.prototype[name] === "undefined" ) {
      Datamap.prototype[name] = function(data, options, callback, createNewLayer) {
        var layer;
        if ( typeof createNewLayer === "undefined" ) {
          createNewLayer = false;
        }

        if ( typeof options === 'function' ) {
          callback = options;
          options = undefined;
        }

        options = defaults(options || {}, self.options[name + 'Config']);

        //add a single layer, reuse the old layer
        if ( !createNewLayer && this.options[name + 'Layer'] ) {
          layer = this.options[name + 'Layer'];
          options = options || this.options[name + 'Options'];
        }
        else {
          layer = this.addLayer(name);
          this.options[name + 'Layer'] = layer;
          this.options[name + 'Options'] = options;
        }
        pluginFn.apply(this, [layer, data, options]);
        if ( callback ) {
          callback(layer);
        }
      };
    }
  };

  // expose library
  if (typeof exports === 'object') {
    d3 = require('d3');
    topojson = require('topojson');
    module.exports = Datamap;
  }
  else if ( typeof define === "function" && define.amd ) {
    define( "datamaps", ["require", "d3", "topojson"], function(require) {
      d3 = require('d3');
      topojson = require('topojson');

      return Datamap;
    });
  }
  else {
    window.Datamap = window.Datamaps = Datamap;
  }

  if ( window.jQuery ) {
    window.jQuery.fn.datamaps = function(options, callback) {
      options = options || {};
      options.element = this[0];
      var datamap = new Datamap(options);
      if ( typeof callback === "function" ) {
        callback(datamap, options);
      }
      return this;
    };
  }
})();
