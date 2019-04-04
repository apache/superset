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
  Datamap.prototype.albTopo = {"type":"Topology","objects":{"alb":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Durrës"},"id":"AL.DU","arcs":[[0,1,2,3]]},{"type":"Polygon","properties":{"name":"Fier"},"id":"AL.FI","arcs":[[4,5,6,7,8,9]]},{"type":"Polygon","properties":{"name":"Shkodër"},"id":"AL.SD","arcs":[[10,11,12]]},{"type":"Polygon","properties":{"name":"Kukës"},"id":"AL.KK","arcs":[[13,14,-11,15]]},{"type":"MultiPolygon","properties":{"name":"Vlorë"},"id":"AL.VR","arcs":[[[16]],[[17,18,-8]]]},{"type":"Polygon","properties":{"name":"Korçë"},"id":"AL.KE","arcs":[[19,20,21,22]]},{"type":"Polygon","properties":{"name":"Berat"},"id":"AL.BE","arcs":[[-21,23,-6,24]]},{"type":"Polygon","properties":{"name":"Elbasan"},"id":"AL.EB","arcs":[[25,-22,-25,-5,26,27]]},{"type":"Polygon","properties":{"name":"Gjirokastër"},"id":"AL.GK","arcs":[[-20,28,-18,-7,-24]]},{"type":"Polygon","properties":{"name":"Dibër"},"id":"AL.DB","arcs":[[29,-28,30,-1,31,-14]]},{"type":"Polygon","properties":{"name":"Lezhë"},"id":"AL.LZ","arcs":[[-32,-4,32,-12,-15]]},{"type":"Polygon","properties":{"name":"Durrës"},"id":"AL.DU","arcs":[[-27,-10,33,-2,-31]]}]}},"arcs":[[[3238,6394],[200,-111],[222,-78]],[[3660,6205],[-7,-35],[-6,-19],[-16,-17],[-73,-63],[-46,-26],[-97,-42],[-50,-9],[-43,3],[-54,20],[-25,5],[-13,-10],[-6,-13],[-12,-13],[-27,-8],[-233,-42],[-164,-51],[-59,-13],[-48,-7],[-67,1],[-35,9],[-23,20],[-13,17],[-14,10],[-15,7],[-26,10],[-19,15],[-12,16],[-18,55],[-16,19],[-22,8],[-29,-16],[-17,-18],[-27,-15],[-34,-8],[-115,14],[-147,-15],[-11,-187],[4,-39],[32,-33],[31,-14],[55,-10],[12,-16],[1,-25],[-11,-56],[5,-42],[-5,-38],[-16,-37],[-34,-24],[-147,-57],[-112,-92],[-106,34],[-154,29],[-140,-8],[-1,0]],[[1435,5379],[-15,54],[-59,58],[-84,40],[-90,16],[-124,0],[-103,8],[-72,30],[-26,63],[0,136],[-20,30],[-83,34],[-16,38],[75,-43],[125,3],[93,46],[-24,85],[133,33],[139,50],[109,69],[45,88],[-14,55],[-39,21],[-61,8],[-78,17],[-81,35],[-91,67],[-62,36],[491,-30],[159,22]],[[1662,6448],[17,-6],[178,-43],[20,20],[11,5],[20,4],[86,4],[125,23],[33,-1],[95,-26],[24,-10],[48,-27],[31,-14],[41,-12],[71,-3],[88,4],[176,25],[70,23],[37,21],[7,13],[14,12],[33,11],[28,-1],[30,-9],[51,-27],[52,-22],[42,-14],[148,-4]],[[2307,4704],[-9,-20],[2,-14],[11,-22],[26,-29],[47,-27],[81,-22],[138,-17],[202,7],[56,-5],[59,-21],[40,-10],[43,1],[23,3],[76,-14],[-7,-63],[-44,-39],[-4,-12],[13,-79],[0,-16],[-25,-59],[-1,-18],[5,-19],[13,-20],[51,-46],[49,-22],[34,-12],[227,-29]],[[3413,4080],[28,-16],[7,-8],[7,-13],[-17,-15],[-14,-8],[-182,2],[-57,-7],[-28,15],[-25,18],[-15,5],[-13,1],[-62,-14],[-85,-13],[-42,-10],[-26,-7],[-14,-17],[-26,-22],[-2,-10],[5,-9],[2,-7],[-20,-15],[-1,-12],[4,-12],[-2,-11],[-25,-4],[-28,2],[-131,0],[-9,-35],[2,-14],[15,-25],[27,-28],[106,-63],[21,-23],[-7,-32],[-27,-32],[-3,-11],[0,-13],[5,-24],[7,-16],[24,-14],[73,-16],[47,-8],[47,-14],[28,-11],[36,-69],[154,-80],[29,-26],[-11,-29],[-47,-21],[-43,-15],[-37,-9],[-11,-5],[5,-3],[27,-2],[29,-9],[28,-21],[82,-102],[62,-36],[135,-42],[78,-13],[51,-15],[20,-8],[31,-59]],[[3625,2950],[-79,-5],[-27,-7],[-28,-16],[-34,-30],[-37,-23],[-38,-20],[-170,-62],[-38,-21],[-161,-147],[-20,-14],[-12,-8],[-79,7]],[[2902,2604],[-76,8],[-56,-4],[-42,6],[-35,14],[-12,13],[0,13],[10,13],[8,16],[1,16],[-16,36],[-3,12],[7,10],[9,34],[0,20],[-12,10],[-21,6],[-84,8],[-9,5],[-1,4],[6,4],[10,4],[8,11],[3,16],[-8,30],[-20,17],[-35,20],[-22,6],[-23,3],[-14,-2],[-15,-3],[-16,1],[-28,8],[-35,13],[-28,6],[-23,2],[-23,-2],[-21,1],[-38,8],[-159,51],[-105,0],[-75,6],[-42,10],[-53,-2],[-29,4],[-19,7],[-17,32],[-12,13],[4,7],[-4,4],[-10,5],[-25,3],[-28,0],[-43,-6],[-37,1],[-25,4],[-14,12],[-4,9],[2,10],[-1,8],[-17,10],[-34,11],[-133,31],[-55,7],[-52,2],[-29,6],[-11,17],[5,13],[-5,12],[-22,11],[-63,18],[-36,13],[-21,12],[-2,9],[2,7],[0,9],[-14,6],[-29,-1],[-134,-27],[-56,-3],[-87,24],[-120,22],[-80,8],[-82,3],[-91,-14],[-140,-6],[-1,0]],[[245,3365],[-2,2],[28,39],[76,33],[91,30],[71,34],[50,51],[23,56],[6,197],[18,54],[50,35],[104,14],[59,12],[-15,28],[-41,32],[-20,20],[25,27],[40,27],[38,20],[16,5],[-45,38],[-86,50],[-55,43],[48,18],[85,15],[111,71],[92,30],[-78,-39],[47,-78],[-46,-66],[0,-70],[42,0],[18,47],[-1,-10],[8,-11],[10,-26],[74,45],[296,64],[95,51],[9,82],[-59,65],[-74,60],[-34,65],[-19,-85],[-70,-77],[-145,-99],[-2,15],[-33,19],[61,28],[65,47],[40,60],[-12,69],[-28,16],[-92,17],[-32,12]],[[1052,4547],[61,70],[12,5],[17,6],[17,-1],[30,7],[3,10],[-6,10],[-23,17],[5,1],[13,1],[29,3],[19,-2],[21,-8],[45,-29],[34,-7],[23,6],[21,11],[31,23],[27,8],[28,2],[25,-5],[24,-3],[86,-1],[56,3],[46,13],[97,35],[56,15],[42,9],[20,-2],[42,-9],[43,-3],[6,-2],[6,-3],[8,-4],[56,0],[17,-3],[9,-6],[30,-2],[31,5],[97,26],[29,6],[15,0],[11,-2],[8,-4],[3,-9],[-1,-6],[-14,-24]],[[3198,9382],[-35,-33],[-16,-11],[-22,-12],[-21,-10],[-20,-12],[-15,-14],[-24,-32],[-19,-14],[-52,-21],[-10,-10],[9,-12],[89,-48],[16,-20],[12,-28],[6,-84],[-8,-27],[4,-39],[21,-52],[73,-113],[21,-45],[1,-28],[-12,-11],[-4,-9],[1,-15],[-4,-12],[-13,-27],[-18,-23],[11,-14],[38,-11],[79,-20],[142,-7],[29,17],[15,4],[20,3],[24,2],[30,5],[34,11],[81,37],[37,11],[35,5],[334,-6],[96,41],[132,-8],[74,-11],[639,-135],[135,3],[40,-3],[33,-12],[23,-15],[29,-13],[50,-6],[169,-31],[41,-56],[-58,-50],[-99,-35],[-71,-20],[-50,-17],[-41,-19],[-151,-95],[-18,-26],[28,-26],[11,-23],[-32,-44],[-82,-50],[-2,-6],[64,2],[44,7],[38,11],[32,2],[39,-13],[47,-33],[131,-53]],[[5358,7923],[-227,-94],[-359,-79],[-66,-19],[-49,-24],[-47,-67],[-53,-34],[-52,-19],[-85,-23],[-126,-54],[-40,-24],[-65,-54],[-31,-11],[-44,-5],[-217,3],[-50,8],[-30,12],[-23,15],[-5,14],[7,13],[48,19],[11,9],[-1,13],[-13,14],[-109,61],[-24,16],[-42,49],[-16,35],[-10,16],[-33,13],[-36,1],[-59,-7],[-66,-17],[-53,-28],[-57,-23],[-39,-20],[-29,-11],[-43,-6],[-47,1],[-86,13],[-44,15],[-39,8],[-35,-1],[-108,-24],[-173,-4],[65,-62],[6,-13],[-6,-12],[-20,-12],[-41,-17],[-46,-16],[-51,-9],[-73,13],[-102,37],[-44,12],[-48,2],[-206,-14],[-45,1],[-51,12],[-20,6],[-9,11],[4,14],[21,15],[17,11],[7,8],[-7,6],[-17,3],[-63,0],[-35,3],[-32,8],[-21,8],[-17,4],[-20,2],[-95,-6],[-61,-12],[26,-14],[29,-37],[19,-68],[-66,-31],[-79,-11],[-98,18],[-193,52],[-76,13],[-51,-4],[-44,-26],[-17,-37],[21,-41],[340,-118],[17,-36],[0,-1]],[[1511,7285],[-361,65],[-80,24],[-103,20],[-382,-54],[-5,35],[4,87],[-45,35],[-52,22],[-14,13],[4,14],[-3,22],[7,17],[22,17],[13,24],[-36,76],[29,12],[46,3],[34,12],[29,56],[-41,23],[-2,0],[-51,50],[-21,64],[7,65],[27,57],[103,99],[-13,32],[-14,7],[-85,45],[-322,105],[-89,43],[-56,53],[16,35],[48,23],[119,56],[540,367],[5,17],[-4,46],[12,24],[52,54],[30,19],[288,146],[75,54],[111,32],[92,46],[78,55],[68,62],[0,1],[31,50],[68,25],[81,20],[70,35],[31,40],[32,86],[32,46],[94,67],[148,76],[57,22],[101,40],[131,27],[129,-29],[86,-72],[48,-84],[5,-33],[5,-34],[-10,4],[-26,-18],[-42,-40],[-10,-23],[-10,-50],[3,-22],[19,-31],[98,-103],[185,-62],[95,-22],[103,-5],[53,7]],[[7206,7315],[-2,0],[-48,2],[-97,-13],[-93,-8],[-349,28],[-116,-1],[-62,-6],[1,-10],[17,-10],[15,-10],[-22,-15],[-58,-16],[-79,-12],[-138,-9],[8,25],[-36,48],[-158,105],[-33,63],[8,11],[-113,4],[-82,-15],[-36,-19],[-32,-22],[-47,-22],[-59,-16],[-102,-11],[-61,4],[-43,16],[-17,17],[-4,16],[3,12],[0,12],[-2,9],[-42,23]],[[5327,7495],[74,60],[16,10],[18,6],[17,5],[16,6],[15,10],[24,11],[107,40],[16,10],[8,17],[-6,32],[1,26],[6,23],[17,18],[11,17],[-1,21],[-49,60],[-25,21],[-68,22],[-166,13]],[[3198,9382],[36,5],[213,55],[52,22],[1,1],[140,42],[275,-3],[143,18],[202,117],[121,38],[145,-36],[117,-55],[281,-68],[95,-53],[1,0],[1,-1],[158,-166],[31,-19],[75,-32],[28,-26],[-1,-27],[-59,-39],[-7,-21],[27,-21],[88,-33],[32,-20],[13,-25],[-9,-45],[8,-24],[49,-54],[46,-23],[67,-4],[384,4],[87,-6],[696,-224],[94,-44],[45,-21],[108,-65],[213,-202],[61,-88],[14,-59],[1,-106],[35,-62],[177,-204],[26,-66],[28,-43],[0,-42],[-60,-61],[-46,-26],[-40,-13],[-35,-19],[-27,-40],[2,-24],[28,-40],[-3,-25],[-144,-38],[-5,-56]],[[142,2777],[-5,-4],[-39,4],[-18,24],[-31,33],[-24,22],[-25,22],[16,21],[39,5],[22,-22],[19,-9],[20,-6],[33,-9],[23,-17],[-16,-32],[-14,-32]],[[2902,2604],[88,-65],[22,-27],[5,-19],[-15,-30],[-34,-29],[-46,-30],[-82,-41],[-39,-13],[4,-10],[22,-17],[164,-77],[101,-65],[25,-11],[22,-8],[68,-9],[7,-3],[-2,-5],[-17,-10],[-45,-16],[-10,-5],[5,-10],[15,-15],[48,-33],[28,-28],[24,-41],[-2,-19],[-10,-12],[-33,-15],[13,-14],[15,-10],[186,-74],[103,-113],[7,-32],[28,-26],[80,-54],[54,-59],[118,-140],[36,-24],[44,-12],[74,0],[110,16],[35,3],[34,-1],[142,-19],[39,-2],[60,-13],[442,-198],[95,-33],[64,-11],[32,-1],[32,-9],[125,-61],[104,-37],[28,-18],[36,-67],[21,-25],[54,-35],[52,-27],[24,-25],[9,-56],[72,-6],[77,0],[41,-6],[43,-12],[31,-20],[17,-24],[-17,-81],[61,-42],[11,-15],[1,-1]],[[5848,557],[-7,1],[-56,4],[-47,-9],[-40,-25],[14,-13],[33,-14],[19,-26],[-9,-17],[-35,-40],[-7,-10],[14,-11],[42,-24],[9,-10],[22,-29],[30,-14],[17,-18],[-17,-36],[-77,-43],[-105,-27],[-85,-38],[-17,-72],[-49,13],[-49,8],[-48,0],[-45,-8],[-45,-22],[-6,-25],[2,-24],[-19,-18],[-89,-10],[-115,24],[-161,66],[-258,62],[-224,33],[-189,28],[-91,-26],[-17,-3],[-6,-19],[-38,0],[-31,48],[19,55],[89,101],[-96,18],[-28,12],[85,85],[103,165],[12,40],[-36,69],[-59,19],[-88,3],[-124,20],[-8,9],[-2,13],[-6,14],[-23,12],[-77,20],[-56,10],[-96,1],[-43,14],[0,20],[83,48],[55,25],[57,18],[-97,42],[-265,231],[-36,41],[-39,35],[-47,15],[-180,2],[-89,8],[-61,15],[45,20],[-153,47],[-24,-21],[-8,-10],[-7,-16],[-18,30],[-27,14],[-35,10],[-39,16],[-7,13],[-41,39],[-46,33],[-21,-7],[-55,26],[-372,54],[-311,84],[-181,74],[-318,48],[-186,64],[-536,270],[-63,46],[-27,27],[-76,148],[-42,41],[-197,88],[-69,42],[-10,13],[0,4],[-31,6],[0,22],[149,35],[92,4],[88,-27],[201,-111],[53,-36],[75,-79],[31,-48],[13,-45],[52,-15],[119,13],[118,25],[53,23],[37,301],[-16,49],[-144,37],[-194,88],[-154,100],[-28,71],[38,-21],[16,-25],[15,-28],[45,6],[43,0],[109,-56],[70,17],[37,62],[11,80],[-70,63],[-149,35],[-136,-17],[-29,-92],[-40,52],[-391,259],[-29,27]],[[7626,1471],[-2,1],[-1,1],[-108,49],[-83,53],[-267,128],[-37,23],[-31,64],[-143,160],[-10,20],[-5,21],[4,18],[16,16],[29,17],[58,27],[15,10],[-14,6],[-29,3],[-50,2],[-80,9],[-13,8],[-105,146],[-9,25],[52,92],[-4,51],[-16,26],[-34,25],[-95,51],[-19,25],[2,28],[18,23],[15,16],[20,12],[53,24],[-100,9]],[[6653,2660],[-71,67],[-1,22],[22,132],[-9,34],[-22,23],[-55,26],[-11,10],[-4,16],[3,12],[13,28],[11,9],[29,17],[34,45],[0,10],[-11,11],[2,10],[-7,7],[-37,17],[-29,6],[-64,4],[-23,3],[-26,7],[-24,2],[-28,-2],[-32,1],[-29,9],[-43,22],[-25,35],[-34,21],[-14,22],[-89,66],[-48,67],[-122,128],[-28,24],[-69,37]],[[5812,3608],[44,37],[218,27],[428,23],[89,18],[75,27],[48,35],[85,77],[-152,148],[-65,45],[-177,103],[-33,29],[-64,89],[139,32],[16,19],[18,35],[13,53],[14,27],[34,45],[36,18],[37,11],[199,31],[34,3],[45,7],[224,60],[44,9],[25,0],[32,-2],[207,-34],[59,-3],[29,11],[20,19],[20,61],[-2,18],[-20,52],[-3,54],[-3,10]],[[7525,4802],[44,-9],[77,-4],[71,2],[15,-1],[50,-4],[61,-21],[58,-53],[108,-216],[109,-191],[82,-77],[75,-28],[58,-22],[142,-14],[99,18],[188,70],[110,12],[5,0],[297,-19],[280,-37],[94,-41],[46,-62],[3,-88],[10,-157],[-35,-70],[-97,-52],[55,-20],[21,-25],[11,-27],[25,-24],[161,-69],[149,-81],[58,-47],[36,-58],[8,-65],[-20,-60],[-60,-116],[-10,-38],[-2,-27],[-9,-26],[-29,-34],[-39,-18],[-52,-14],[-51,-19],[-39,-34],[-73,-8],[-60,-19],[-33,-30],[4,-41],[-17,-19],[-18,-16],[-54,-35],[-141,-43],[-125,14],[-129,28],[-151,-2],[-75,-22],[-30,-28],[-22,-32],[-46,-34],[-50,-12],[-117,-13],[-50,-23],[-10,-31],[25,-91],[3,-34],[-19,-41],[-25,-27],[-62,-52],[-87,-98],[-17,-18],[-44,-18],[-62,-14],[-61,-20],[-44,-32],[-26,-75],[12,-67],[-1,-68],[-63,-79],[-31,-11],[-83,-11],[-26,-19],[-3,-20],[18,-37],[2,-16],[27,-62],[-8,-15],[-85,-108],[-23,-23],[-42,-13],[-140,-30]],[[6653,2660],[-245,-15],[-100,3],[-51,-10],[-7,-23],[11,-29],[2,-27],[-16,-34],[-48,-19],[-54,-10],[-162,-17],[-68,-18],[-27,-11],[-10,-10],[-3,-7],[-17,-15],[-20,-38],[-39,2],[-121,14],[-51,13],[-66,27],[-392,228],[-15,13],[-130,80],[-28,12],[-43,3],[-88,2],[-56,9],[-39,14],[-39,32],[-53,25],[-110,16],[-8,-19],[-2,-10],[-7,-11],[-7,-6],[-21,-2],[-29,6],[-58,17],[-41,3],[-121,-10],[-223,51],[-128,0],[-117,10],[-181,51]],[[3413,4080],[122,20],[451,-24],[138,41],[48,7],[48,-8],[16,-3],[18,-15],[-20,-23],[-2,-10],[0,-11],[18,-31],[3,-16],[0,-14],[-19,-31],[0,-14],[27,-11],[78,-11],[90,-5],[67,-11],[51,-20],[137,-102],[50,-23],[62,-17],[129,-15],[63,-15],[41,-14],[-52,-38],[129,-26],[49,-6],[85,-1],[49,-4],[42,-13],[23,-24],[12,-10],[45,-8],[181,2],[220,32]],[[6853,5582],[-2,-7],[30,-100],[70,-130],[26,-49],[71,-84],[208,-131],[89,-77],[29,-74],[-4,-59],[40,-45],[115,-24]],[[2307,4704],[119,-10],[18,9],[19,13],[1,30],[6,25],[17,34],[47,21],[132,29],[35,15],[19,14],[11,36],[180,6],[174,-7],[111,10],[72,13],[26,13],[2,8],[-18,5],[-33,5],[-16,10],[-5,8],[135,52],[269,49],[121,12],[249,57],[40,17],[171,87],[70,50],[82,44],[44,13],[36,1],[25,-10],[37,-8],[48,-4],[35,4],[32,10],[89,41],[37,11],[93,4],[93,80],[125,47],[57,13],[302,37],[26,11],[14,11],[34,37]],[[5488,5657],[33,17],[15,4],[20,4],[36,4],[20,4],[21,7],[18,10],[84,30],[41,11],[46,8],[52,2],[51,-3],[62,-12],[82,-1],[45,4],[41,7],[36,13],[55,32],[31,6],[24,-2],[25,-15],[21,2],[17,8],[22,5],[34,2],[68,-10],[72,-7],[79,12],[53,4],[-13,-29],[1,-33],[15,-44],[31,-34],[125,-80],[2,-1]],[[7626,1471],[-211,-45],[-141,-7],[-298,20],[-103,-12],[-88,-23],[-187,10],[-107,-22],[-75,-39],[-64,-53],[-47,-59],[-24,-59],[-93,-9],[-282,-4],[-68,-10],[29,-26],[84,-201],[29,-20],[134,-60],[260,-195],[23,-57],[-46,-66],[-98,-46],[-96,5],[-99,27],[-210,37]],[[7206,7315],[-2,-18],[45,-83],[10,-47],[4,-22],[-36,-29],[-131,-56],[-56,-33],[-45,-44],[-16,-35],[44,-239],[29,-71],[119,-154],[1,-22],[0,-7],[-30,-34],[-48,-22],[-76,-20],[-81,-15],[-275,-27],[21,-47],[-16,-89],[39,-50],[63,-12],[43,-20],[61,-51],[11,-10],[18,-25],[12,-54],[11,-18],[40,-15],[94,-7],[42,-13],[67,-42],[28,-33],[7,-7],[-1,-45],[-40,-56],[-54,-45],[-73,-41],[-81,-22],[-81,12],[-20,-65]],[[5488,5657],[-426,67],[-77,26],[-214,102],[-158,-1],[-31,-19],[-60,-26],[-39,-3],[-35,9],[-48,35],[-41,20],[-95,25],[-103,39],[-18,14],[-10,13],[-6,11],[-32,20],[-9,10],[-7,14],[-14,22],[-117,78],[-110,54],[-66,25],[-47,12],[-65,1]],[[3238,6394],[-45,83],[4,24],[-18,25],[-27,19],[-85,42],[-11,13],[8,12],[17,9],[21,41],[-15,141],[23,55],[19,-2],[46,-10],[65,-20],[123,-14],[80,5],[101,14],[88,20],[18,-5],[34,-29],[22,-10],[39,-12],[114,-15],[36,5],[19,13],[2,13],[5,8],[19,8],[69,22],[36,4],[59,0],[196,-16],[50,7],[37,14],[22,17],[23,40],[23,15],[42,13],[540,97],[45,30],[3,19],[-3,47],[-26,23],[-242,92],[-9,11],[13,8],[37,6],[57,2],[70,6],[69,13],[50,29],[72,33],[62,20],[94,69],[-2,47]],[[1662,6448],[50,7],[110,114],[39,0],[3,-36],[22,-20],[39,-3],[56,12],[-45,89],[-28,23],[-47,-22],[-26,27],[-166,66],[116,89],[-10,104],[-30,111],[1,60],[103,-16],[53,43],[5,70],[-46,63],[-36,-1],[-314,57]],[[1052,4547],[-2,0],[-40,37],[4,18],[24,16],[61,251],[-29,54],[-32,22],[-25,26],[4,22],[123,24],[20,38],[0,45],[9,38],[229,164],[40,64],[-3,13]]],"transform":{"scale":[0.00017756158005800113,0.00030181021032104206],"translate":[19.26124108200011,39.637013245]}};
  Datamap.prototype.aldTopo = '__ALD__';
  Datamap.prototype.andTopo = '__AND__';
  Datamap.prototype.areTopo = '__ARE__';
  Datamap.prototype.argTopo = '__ARG__';
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
