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
  Datamap.prototype.argTopo = '__ARG__';
  Datamap.prototype.armTopo = '__ARM__';
  Datamap.prototype.asmTopo = '__ASM__';
  Datamap.prototype.ataTopo = '__ATA__';
  Datamap.prototype.atcTopo = '__ATC__';
  Datamap.prototype.atfTopo = '__ATF__';
  Datamap.prototype.atgTopo = '__ATG__';
  Datamap.prototype.ausTopo = '__AUS__';
  Datamap.prototype.autTopo = {"type":"Topology","objects":{"aut":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Vorarlberg"},"id":"AT.VO","arcs":[[0,1]]},{"type":"Polygon","properties":{"name":"Burgenland"},"id":"AT.BU","arcs":[[2,3,4]]},{"type":"Polygon","properties":{"name":"Steiermark"},"id":"AT.ST","arcs":[[-3,5,6,7,8,9]]},{"type":"Polygon","properties":{"name":"Kärnten"},"id":"AT.KA","arcs":[[-7,10,11,12]]},{"type":"Polygon","properties":{"name":"Oberösterreich"},"id":"AT.OO","arcs":[[13,-9,14,15]]},{"type":"Polygon","properties":{"name":"Salzburg"},"id":"AT.SZ","arcs":[[-8,-13,16,17,18,19,-15]]},{"type":"MultiPolygon","properties":{"name":"Tirol"},"id":"AT.TR","arcs":[[[-12,20,-17]],[[-19,21,-1,22]]]},{"type":"Polygon","properties":{"name":"Niederösterreich"},"id":"AT.NO","arcs":[[-4,-10,-14,23],[24]]},{"type":"Polygon","properties":{"name":"Wien"},"id":"AT.WI","arcs":[[-25]]}]}},"arcs":[[[857,3396],[22,-109],[15,-170],[1,-38],[-2,-106],[-20,-94],[-51,-153],[-13,-71],[-15,-151],[-3,-60],[2,-46],[4,-53],[0,-41],[-3,-66],[-8,-47],[-15,-39],[-16,-29],[-17,-42],[-4,-32],[3,-37],[30,-97],[23,-124],[2,-10],[0,-2]],[[792,1779],[-18,1],[-57,36],[-30,34],[-50,96],[-140,90],[-33,50],[-17,46],[-2,36],[4,41],[4,89],[5,37],[0,22],[-5,12],[-8,-2],[-6,10],[3,43],[-248,155],[-22,6],[-69,-16],[-24,12],[9,24],[22,55],[5,12],[9,99],[-2,15],[-6,45],[-5,37],[-31,86],[-20,23],[-19,23],[-1,33],[13,57],[2,27],[-12,53],[-12,33],[-6,33],[4,22],[5,31],[-17,31],[-5,9],[-12,35],[42,141],[45,106],[5,26],[7,67],[6,34],[51,127],[12,57],[1,161],[-37,65],[-49,44],[-39,115],[-2,23],[-7,67],[3,-4],[5,-3],[77,-41],[84,2],[36,34],[19,58],[16,69],[29,65],[18,20],[20,4],[19,-13],[15,-32],[4,-45],[-2,-47],[5,-40],[26,-27],[11,2],[16,20],[7,4],[39,-29],[39,-6],[20,7],[16,25],[4,-62],[13,-36],[17,-32],[12,-51],[0,-12],[0,-11],[2,-23],[14,-17],[12,10],[12,20],[14,14],[65,-186],[11,-44],[-6,-40],[-29,-46],[14,-33],[3,-40],[2,-40],[7,-37],[12,-24],[9,1],[10,14],[17,17],[7,-2],[14,-16],[6,0],[6,8],[15,34],[58,20],[24,-25],[-1,-69],[-24,-140],[3,-25],[1,-23],[-3,-25],[-7,-13],[-17,-10],[-5,-7],[-12,-43],[-5,-24],[5,-6],[20,4]],[[8531,1742],[0,1],[-1,16],[-1,42],[-3,9],[-5,16],[-16,26],[-7,18],[-1,24],[6,63],[1,39],[5,36],[9,36],[47,81],[63,167],[35,100],[9,40],[2,26],[-4,32],[-47,120],[-12,43],[-5,52],[-2,39],[14,118],[0,103],[-36,275],[-2,60],[-10,144],[-12,106],[-15,94],[-23,109],[-2,32],[4,32],[20,54],[14,27],[16,4],[7,-22],[4,-25],[5,-17],[24,27],[75,156]],[[8687,4045],[76,-3],[33,12],[33,35],[21,33],[69,145],[2,38],[1,46],[-7,45],[-4,55],[4,83],[7,43],[13,46],[8,25],[43,164],[-38,117],[-45,102],[-20,67],[-10,47],[0,232],[46,11],[15,25],[16,36],[8,34],[5,44],[3,147],[19,75],[21,43],[63,96],[38,22],[46,6],[92,-59],[51,51],[26,50],[45,62],[18,33],[14,48],[18,95],[32,53],[28,25],[16,6],[15,-5],[55,51],[54,76],[30,27],[27,7],[20,-18],[40,-61],[21,-21],[16,19],[9,35],[2,31],[-4,29],[-1,27],[5,56],[18,36],[9,7],[14,-13],[11,-15],[16,-6],[11,6],[9,9],[16,33]],[[9886,6590],[7,-22],[17,-35],[-14,-33],[-6,-38],[-8,-71],[5,-6],[16,-25],[-7,-63],[30,-32],[42,-29],[31,-54],[-82,-134],[14,-31],[-1,-24],[-6,-23],[-4,-33],[-3,-6],[-12,-17],[-3,-10],[1,-17],[7,-8],[6,-4],[3,-7],[-5,-68],[-8,-50],[-13,-38],[-21,-33],[-46,-20],[-16,-17],[0,-41],[9,-17],[27,-25],[10,-15],[13,-71],[8,-25],[-19,-42],[2,-66],[8,-77],[3,-124],[6,-38],[11,-29],[15,-18],[-27,-25],[-95,-25],[-104,-51],[-50,18],[-19,100],[-17,-29],[-26,-80],[-14,-28],[-12,-6],[-74,23],[-14,17],[-15,30],[-3,12],[-7,27],[-4,40],[-8,34],[-16,23],[-105,80],[-55,13],[-48,-42],[-8,-37],[2,-50],[-7,-33],[-11,-21],[-52,-54],[-16,-27],[-9,-11],[-6,3],[-6,12],[-8,18],[-9,-19],[-20,-63],[-12,-28],[24,-27],[73,-58],[37,15],[63,-50],[23,-19],[43,15],[29,-26],[23,-60],[11,-77],[-8,-74],[23,-24],[18,-36],[10,-48],[-1,-59],[-14,-48],[-39,-32],[-15,-31],[6,-153],[-18,-28],[-50,-76],[-141,-127],[-15,50],[-18,24],[-16,-8],[-14,-49],[4,-145],[-3,-11],[-7,-7],[-5,-10],[-1,-23],[4,-14],[6,-7],[5,-4],[4,-8],[40,-164],[5,-63],[-9,-51],[-18,-33],[-41,-44],[4,-66],[-20,-84],[5,-62],[8,-14],[10,2],[11,-2],[9,-25],[0,-33],[-11,-65],[0,-21],[18,-23],[44,42],[22,-4],[16,-46],[-7,-44],[-30,-79],[-27,-34],[-9,-55],[10,-50],[26,-18],[16,-15],[4,-20],[-5,-21],[-15,-19],[-58,-47],[-17,-29],[38,-9],[19,-13],[18,-34],[6,-41],[-25,-12],[-34,-1],[-22,-8],[-5,-11],[-7,-3],[-6,4],[-7,10],[-23,34],[-28,7],[-53,-13],[-49,20],[-18,-5],[-13,-42],[-5,-58],[-11,-17],[-13,-6],[-13,-23],[-3,-23],[1,-21],[-1,-23],[-9,-28],[-9,-14],[-27,-23],[-34,-48],[-15,-31],[-47,-130],[-17,-32],[-21,-19],[-54,-64],[-27,-32],[-5,-2]],[[8531,1742],[-54,-27],[-7,-9],[-13,-26],[1,-9],[6,-8],[1,-27],[-9,-118],[0,-12],[-2,-55],[1,-66],[15,-93],[28,-36],[15,-59],[2,-87],[-24,62],[-15,20],[-25,9],[-28,9],[-89,90],[-36,14],[-37,-6],[-50,-40],[-38,-31],[-35,-4],[-101,29],[-21,26],[-4,-57],[0,-49],[-7,-33],[-7,-11],[-7,-10],[-17,-9],[-20,11],[-28,-1],[-28,-15],[-20,-30],[-13,-54],[0,-7],[-4,-36],[-5,-22],[-3,-16],[-25,-38],[-39,-14],[-30,37],[-6,11],[-23,40],[-39,29],[-72,-7],[-168,-18],[-42,9],[-88,19]],[[7321,1017],[-1,2],[-10,27],[-82,188],[-16,91],[-3,126],[-15,134],[-20,93],[-6,50],[-3,34],[2,21],[8,46],[8,34],[8,47],[3,114],[-104,313],[-51,126],[-20,32],[-13,17],[-20,6],[-145,-68],[-162,-25],[-35,29],[-86,-11],[-35,6],[-134,-95],[-24,2],[-11,5],[-3,10],[-14,22],[-22,21],[-94,58],[-53,74],[-33,31],[-47,1],[-38,-14],[-143,-136],[-21,-30],[-11,-26],[-5,-18],[-6,-28],[-20,-67],[-49,-47],[-81,-125],[-23,-14],[-24,-5],[-12,10],[-18,26],[-51,83]],[[5586,2187],[50,128],[57,207],[15,73],[7,43],[-3,76],[2,48],[11,34],[39,74],[25,63],[3,40],[-10,32],[-39,55],[-44,110],[-10,35],[-6,40],[-4,32],[-6,36],[-29,89],[-22,85],[-17,22],[-20,-12],[-19,-25],[-37,-8],[-22,-19],[-18,-28],[-18,-13],[-20,11],[-22,32],[-42,76],[-34,140],[-39,256],[-12,135],[1,29],[10,70],[10,57]],[[5323,4210],[122,-47],[12,13],[16,8],[4,14],[33,56],[6,12],[4,17],[5,40],[-1,51],[-6,62],[-12,52],[-10,31],[-17,36],[-14,38],[-11,39],[-4,40],[-1,37],[2,74],[3,48],[8,54],[16,42],[22,36],[140,136],[14,6],[12,-4],[32,-37],[18,-14],[39,-15],[35,-26],[20,-8],[57,15],[60,-137],[14,-73],[2,-29],[7,-37],[8,2],[27,37],[63,33],[49,45],[18,9],[12,-5],[74,-101],[29,-25],[26,-15],[39,0],[32,19],[59,88],[33,38],[41,23],[23,24],[14,27],[5,27],[14,38],[189,148],[83,131]],[[6788,5283],[46,-71],[137,2],[7,-9],[12,-25],[40,-64],[27,-8],[33,16],[33,38],[52,45],[27,13],[20,2],[21,-8],[13,0],[41,24],[66,50],[51,22],[14,17],[13,29],[7,29],[36,90],[54,-16],[9,0],[80,39],[27,-5],[21,-17],[55,-99],[108,-104],[51,-71],[88,-15],[27,-57],[16,-42],[18,-25],[25,-26],[15,-6],[13,0],[11,4],[17,-6],[9,-17],[6,-28],[8,-110],[5,-43],[10,-50],[12,-17],[14,2],[44,48],[17,6],[10,-11],[7,-16],[8,-29],[2,-13],[2,-21],[1,-25],[-2,-28],[-6,-36],[-1,-17],[3,-25],[8,-9],[10,-4],[32,0],[34,-51],[16,-60],[16,-87],[107,-36],[32,-35],[13,-23],[10,-8],[9,-1],[13,9],[31,30],[6,-5],[5,-11],[4,-17],[3,-29],[2,-26],[1,-17],[8,-42],[14,-55],[45,-77]],[[7321,1017],[-26,6],[-31,7],[-76,-49],[-48,-139],[-26,72],[-18,8],[-19,-24],[-28,-36],[-5,-1],[-23,-6],[-18,5],[-17,-14],[-21,-64],[-15,-64],[-11,-62],[-9,-58],[-14,-63],[-11,-49],[-7,-12],[-29,-27],[-33,-11],[-12,16],[-22,-19],[-8,-18],[-6,-26],[-16,-37],[-9,-47],[-10,3],[-7,3],[-6,-3],[-27,-55],[-13,-18],[-14,-7],[-28,-6],[-13,-10],[-19,-56],[-11,-73],[-6,-33],[-6,-30],[-23,-20],[-17,36],[-15,66],[-18,49],[-45,-22],[-22,7],[-18,17],[-23,21],[-7,17],[-4,22],[-6,18],[-14,6],[-45,-19],[-157,8],[-121,7],[-2,2],[-14,7],[-74,128],[-19,19],[-22,13],[-23,1],[-23,-8],[-21,-8],[-22,5],[-119,114],[-40,13],[-85,-28],[-18,0],[-87,42],[-19,3],[-21,-8],[-20,4],[-158,103],[-56,5],[-10,14],[-19,42],[-9,7],[-80,-12],[-57,20],[-134,-57],[-52,5],[-28,23],[-83,102],[-108,50],[-307,44],[-74,97],[-33,22],[-11,8],[-11,-3],[-21,-17],[-12,0],[-12,10],[-24,36],[-10,10]],[[4130,1041],[0,1],[6,29],[43,170],[10,55],[6,45],[4,66],[28,28],[117,35],[53,46],[15,4],[14,-10],[47,-70],[10,-4],[5,2],[4,8],[3,10],[1,8],[1,13],[-8,30],[-79,218],[-60,128],[-14,37],[-9,60],[-3,51],[-6,52],[-10,40],[-17,36],[-13,19],[-27,49],[-11,43],[-13,33],[-9,33],[-4,37],[-1,18],[0,16],[2,27],[4,29],[16,79],[2,40],[-12,30],[-113,74],[-17,28],[-11,30],[-3,73]],[[4081,2787],[17,21],[4,10],[5,13],[2,10],[1,13],[1,9],[4,11],[7,6],[12,-2],[16,-15],[52,-66],[60,-58],[81,-40],[42,-9],[63,-40],[105,-134],[22,-23],[24,-14],[40,-8],[98,11],[51,22],[69,66],[30,47],[33,63],[20,10],[25,3],[51,-31],[121,-63],[29,-4],[131,-56],[58,-10],[34,-20],[46,-48],[113,-173],[38,-101]],[[6778,8391],[3,-12],[24,-44],[82,-36],[43,-35],[42,-43],[48,-12],[21,-15],[19,-29],[13,-42],[2,-40],[-2,-15],[-4,-7],[-29,5],[-5,-2],[-3,-8],[-1,-13],[0,-34],[-3,-23],[0,-34],[6,-38],[30,-80],[33,-23],[7,-122],[24,-37],[7,-34],[15,-188],[-9,-328],[0,-85],[-20,46],[-16,18],[-15,8],[-65,-6],[-23,-21],[-20,-36],[-19,-54],[-18,-29],[-188,-88],[-27,16],[-23,40],[-35,100],[-17,37],[-20,26],[-23,16],[-59,2],[-17,-29],[-9,-9],[-9,-15],[-4,-8],[-2,-7],[-2,-9],[-3,-24],[-7,-151],[-4,-34],[-7,-31],[-2,-21],[6,-108],[2,-15],[4,-11],[2,-10],[0,-15],[-8,-23],[-15,-34],[-1,-7],[-2,-10],[1,-20],[-2,-13],[-19,-66],[-5,-12],[-7,-7],[-10,-6],[-1,-17],[23,-55],[212,-311],[69,-66],[41,-25],[28,-31],[28,-42],[14,-32],[9,-29],[-1,-71],[-23,-66],[-18,-141],[-1,-88],[-2,-46],[-23,-94]],[[5323,4210],[-75,94],[-46,93],[-11,52],[-2,57],[7,50],[20,67],[8,30],[3,39],[-3,33],[-22,74],[48,289],[-7,32],[-10,36],[-32,8],[-27,23],[-13,15],[-7,12],[-4,13],[-6,28],[2,18],[9,14],[51,5],[22,8],[16,39],[-31,55],[-237,103],[-21,27],[-12,32],[-5,34],[-17,138],[-3,50],[-2,50],[4,107],[3,45],[4,32],[5,19],[7,11],[9,3],[35,-20],[19,-4],[19,10],[12,28],[1,29],[-11,27],[-12,15],[-13,14],[-40,55],[-90,-80],[-75,-17],[-50,11],[-52,35],[-6,6],[-7,9],[-38,79],[-32,37],[-33,9],[-56,-6],[-24,-15],[-16,-24],[-10,-58],[-4,-16],[-16,-20],[-61,-34],[-26,-20]],[[4362,6095],[-4,41],[-19,84],[-93,188],[-12,38],[-12,45],[-6,50],[2,52],[8,27],[9,6],[8,-1],[8,7],[19,57],[5,12],[52,71],[18,38],[24,74],[11,25],[20,20],[73,28],[-2,9],[20,32],[43,45],[48,91],[22,29],[136,105],[180,61],[44,47],[128,217],[19,59],[7,81],[3,19],[6,20],[5,26],[3,40],[-2,107],[2,35],[6,35],[18,72],[4,37],[-3,33],[-12,37],[-6,69],[-4,17],[0,13],[7,27],[12,21],[42,31],[44,11],[136,-73],[23,-24],[21,-30],[20,-59],[54,-47],[3,-6],[12,102],[11,43],[4,-2],[27,8],[11,9],[11,21],[6,18],[22,93],[9,50],[4,55],[1,64],[-7,123],[3,45],[18,32],[-17,15],[-6,12],[-14,53],[-7,-5],[3,36],[39,158],[53,-27],[25,-26],[24,-36],[28,-45],[88,-94],[12,-24],[22,-64],[8,-31],[7,-12],[9,-7],[8,-11],[3,-23],[-2,-24],[-6,-3],[-7,2],[-4,-5],[-8,-36],[-8,-5],[-2,-11],[6,-52],[6,-21],[22,-54],[11,-19],[45,-36],[185,-40],[131,-88],[12,3],[10,7],[27,41],[68,57],[21,41],[29,150],[19,25],[32,-71],[52,-53],[15,-7],[20,8],[39,37],[21,3],[8,-14],[2,-25],[0,-25],[4,-16],[10,-2],[20,13],[9,-3],[14,-36],[8,-36],[10,-25],[21,-3],[21,40]],[[4081,2787],[-51,98],[-23,24],[-25,12],[-35,6],[-38,25],[-35,1],[-46,-16],[-31,0],[-27,-8],[-22,-20],[-78,-149],[-117,-106],[-36,-38]],[[3517,2616],[0,48],[-31,21],[-62,-24]],[[3424,2661],[0,2],[1,16],[-3,143],[-5,38],[-11,53],[-9,20],[-22,35],[-8,24],[-7,40],[-3,41],[0,70],[3,56],[18,149],[-2,77],[36,37],[18,8],[41,-3],[146,104],[46,55],[19,6],[16,-7],[29,-32],[18,-11],[20,-2],[42,12],[26,19],[16,17],[16,32],[13,41],[12,70],[10,35],[8,19],[9,9],[13,8],[65,13],[15,12],[13,17],[12,20],[10,24],[9,28],[28,118],[14,45],[26,64],[8,31],[7,28],[3,15],[-3,24],[-26,127],[-5,44],[-1,31],[5,30],[2,17],[-5,19],[-12,26],[-46,62],[-27,48],[-34,115]],[[3988,4800],[46,80],[25,25],[47,22],[47,0],[73,-37],[23,6],[-14,-67],[21,-49],[34,-44],[26,-50],[-36,-34],[-16,-88],[7,-94],[32,-51],[20,-7],[13,-9],[11,-17],[60,-130],[64,-95],[14,-12],[11,8],[11,11],[14,1],[13,-13],[7,-15],[8,-10],[14,1],[9,16],[38,87],[-1,32],[-3,23],[-4,19],[-3,21],[-1,24],[0,66],[3,10],[12,61],[2,6],[-3,-2],[-1,86],[3,-3],[21,55],[1,10],[16,75],[3,9],[3,46],[1,46],[-4,48],[-10,56],[-26,85],[-16,39],[-16,24],[-21,6],[-33,-29],[-19,-6],[-74,26],[-21,43],[24,74],[1,0],[8,27],[2,25],[1,25],[2,24],[8,30],[84,265],[-6,12],[-28,82],[-45,201],[-22,42],[-10,11],[-27,54],[-31,36],[-11,30],[-7,40],[0,6]],[[4130,1041],[-2,2],[-65,13],[-77,-20],[-19,4],[-21,20],[-41,55],[-40,14],[-31,11],[-53,44],[-46,80],[-25,122],[-11,83],[-22,28],[-27,7],[-27,21],[-13,18],[-8,15],[-3,26],[1,49],[3,44],[5,26],[4,27],[-1,47],[-12,83],[-21,29],[-55,3],[-18,14],[-8,18],[-7,24],[-15,30],[-14,15],[-31,11],[-14,11],[19,38],[0,35],[-9,36],[-8,42],[-8,88],[-6,43],[-9,38],[14,66],[80,88],[28,75],[0,52]],[[3424,2661],[-22,-9],[-133,-137],[-93,-9],[-58,-39],[-56,-60],[-45,-71],[-59,-19],[-15,-19],[-26,-41],[-15,-7],[-24,18],[-43,63],[-25,5],[-10,-3],[-10,2],[-1,1],[-1,0],[-67,27],[-31,-6],[-39,-22],[-12,-13],[-13,-5],[-12,4],[-11,14],[-7,18],[-7,14],[-9,10],[-23,11],[-13,-6],[-12,-17],[-10,-30],[-44,-86],[-40,4],[-41,40],[-47,20],[-92,-31],[-91,-58],[-23,-28],[-85,-167],[-11,-47],[-13,-134],[-25,-117],[-1,-14],[1,-40],[-2,-19],[-6,-12],[-14,-13],[-6,-11],[-29,-100],[-18,-38],[-19,-5],[-22,15],[-46,8],[-22,-6],[-44,-29],[-13,-2],[-14,11],[-22,38],[-12,12],[-13,1],[-25,-15],[-13,1],[-38,43],[-15,10],[-27,-17],[-14,1],[-8,33],[6,19],[29,47],[6,26],[-12,39],[-101,119],[-20,11],[-23,-6],[-133,-73],[-55,12],[-42,69],[-3,81],[16,129],[-7,64],[-12,28],[-44,70],[-28,88],[-13,29],[-7,9],[-8,3],[-7,-3],[-38,-43],[-33,-75],[-23,-87],[-1,-71],[-32,-4],[-26,14],[-21,-8],[-20,-67],[-6,-48],[-1,-32],[-4,-29],[-13,-39],[-57,-58],[-34,-19],[-9,1]],[[857,3396],[85,21],[28,22],[59,71],[25,46],[24,62],[29,116],[8,24],[14,17],[27,19],[11,15],[22,57],[19,77],[12,86],[0,81],[-5,47],[-7,34],[-12,24],[-18,20],[13,152],[2,35],[-9,42],[-11,42],[-2,33],[19,15],[22,8],[10,8],[5,-7],[6,-36],[-2,-15],[-6,-18],[-5,-24],[2,-33],[7,-17],[11,-15],[20,-19],[56,-16],[16,5],[16,26],[27,73],[18,25],[32,-1],[173,-128],[5,-12],[4,-20],[7,-18],[11,-7],[39,10],[53,47],[18,10],[18,-2],[14,-16],[30,-44],[-11,-26],[-42,-57],[9,-30],[68,-61],[65,-139],[4,-17],[0,-26],[-3,-26],[-4,-18],[-3,0],[14,-51],[18,-21],[137,-4],[25,15],[86,117],[33,17],[28,-22],[-3,-103],[31,-8],[29,26],[19,40],[17,46],[25,46],[25,15],[57,3],[21,18],[11,38],[-5,28],[-14,18],[-16,9],[62,140],[29,13],[33,-8],[29,-19],[62,20],[28,22],[24,53],[7,35],[10,88],[9,40],[37,62],[4,11],[24,-1],[58,-23],[106,-1],[74,-29],[14,8],[13,65],[15,17],[110,44],[301,-25],[10,4],[38,94],[4,24],[2,36],[-2,101],[-4,21],[-7,9],[-10,21],[-10,25],[-4,21],[-3,31],[21,16],[32,52],[11,14],[19,16],[3,1],[-4,-17],[-3,-41],[-5,-30],[-8,-23],[-5,-26],[8,-42],[13,-23],[14,5],[29,29],[29,9],[75,-32],[23,7],[51,39],[22,-9],[6,-21],[13,-81],[8,-32],[10,-24],[39,-62],[19,-18],[27,-1],[27,11],[21,17],[12,22]],[[6778,8391],[6,11],[6,99],[0,116],[4,103],[25,77],[69,116],[7,73],[13,44],[5,46],[8,37],[20,14],[68,-18],[68,-53],[26,4],[15,67],[-2,7],[-6,24],[-6,31],[-2,23],[2,27],[9,48],[28,238],[0,105],[-5,116],[0,108],[18,81],[-1,20],[0,18],[2,13],[4,6],[29,7],[73,-48],[102,-16],[9,-53],[6,-52],[-1,-52],[-8,-54],[26,-1],[100,52],[6,8],[19,42],[4,20],[3,51],[6,15],[10,0],[6,-15],[6,-19],[6,-9],[61,-1],[30,-16],[63,-61],[58,-38],[28,-31],[65,-107],[30,-22],[78,-58],[102,-110],[29,-13],[30,0],[23,13],[46,47],[12,5],[40,1],[7,-11],[5,-47],[7,-20],[9,-7],[25,-3],[14,-20],[10,-9],[11,2],[-13,-34],[16,7],[15,-1],[10,-17],[1,-40],[22,11],[7,-17],[0,-26],[2,-19],[132,-184],[69,-57],[122,14],[183,-52],[1,2],[28,8],[17,-27],[7,-5],[21,12],[14,26],[67,218],[23,29],[37,-10],[14,1],[24,19],[12,3],[12,-8],[22,-27],[78,-44],[25,-5],[25,-20],[10,-46],[5,-54],[9,-45],[18,-23],[20,-7],[50,4],[20,-14],[48,-60],[24,-17],[25,6],[51,34],[21,-3],[31,-84],[18,-251],[45,-101],[13,-178],[-7,-48],[-3,-19],[-22,-44],[-21,-34],[-10,-36],[-7,-50],[-34,-95],[-14,-52],[-5,-54],[-12,-203],[-3,-24],[-3,-11],[-3,-17],[0,-42],[4,-23],[10,-12],[26,-5],[8,-9],[14,-22],[13,-29],[6,-30],[-3,-17],[-5,-22],[-3,-19],[6,-8],[4,-8],[4,-19],[4,-22],[2,-17],[4,-22],[10,-13],[12,-10],[15,-26],[8,-5],[5,-13],[1,-17],[-2,-43],[1,-19],[20,-136],[6,-69],[1,-82],[9,-59],[33,-71],[18,-21],[21,-6],[14,-18],[19,-69]],[[8799,7128],[-32,30],[-10,-21],[-9,-25],[-3,-13],[-4,-29],[-1,-34],[11,-35],[10,-21],[6,-25],[3,-23],[-11,-108],[11,-38],[8,-16],[5,-25],[16,-17],[79,-13],[36,13],[34,0],[18,-24],[24,-21],[12,-6],[30,-1],[13,18],[7,14],[4,20],[4,13],[11,18],[19,11],[62,6],[91,-33],[-29,115],[-8,55],[6,103],[10,80],[1,12],[-2,9],[-3,14],[-10,20],[-5,48],[-5,28],[-13,29],[-7,32],[-14,24],[-25,-8],[-8,-28],[-4,-17],[-1,-1],[-4,10],[-36,122],[-7,18],[-41,8],[-5,-30],[-10,-17],[-23,-12],[-46,-43],[-88,-111],[-7,-22],[-15,-26],[-11,-15],[-17,-8],[-17,-4]]],"transform":{"scale":[0.0007627945819581923,0.00026313945274527455],"translate":[9.52115482500011,46.378643087000086]}};
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
