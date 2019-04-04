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
  Datamap.prototype.autTopo = '__AUT__';
  Datamap.prototype.azeTopo = '__AZE__';
  Datamap.prototype.bdiTopo = '__BDI__';
  Datamap.prototype.belTopo = '__BEL__';
  Datamap.prototype.benTopo = '__BEN__';
  Datamap.prototype.bfaTopo = {"type":"Topology","objects":{"bfa":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Kompienga"},"id":"BF.KP","arcs":[[0,1,2,3]]},{"type":"Polygon","properties":{"name":"Gourma"},"id":"BF.GM","arcs":[[-4,4,5,6,7,8,9]]},{"type":"Polygon","properties":{"name":"Houet"},"id":"BF.HO","arcs":[[10,11,12,13,14,15,16]]},{"type":"Polygon","properties":{"name":"Kénédougou"},"id":"BF.KN","arcs":[[17,18,19,-15]]},{"type":"Polygon","properties":{"name":"Banwa"},"id":"BF.BW","arcs":[[20,21,-17,22]]},{"type":"Polygon","properties":{"name":"Kossi"},"id":"BF.KS","arcs":[[23,24,25,-21,26]]},{"type":"Polygon","properties":{"name":"Balé"},"id":"BF.BA","arcs":[[27,28,29,30,31]]},{"type":"Polygon","properties":{"name":"Mou Houn"},"id":"BF.MO","arcs":[[32,-32,33,-11,-22,-26,34]]},{"type":"Polygon","properties":{"name":"Oudalan"},"id":"BF.OD","arcs":[[35,36,37]]},{"type":"Polygon","properties":{"name":"Soum"},"id":"BF.SM","arcs":[[38,39,40,41,42,-37]]},{"type":"Polygon","properties":{"name":"Nayala"},"id":"BF.NY","arcs":[[43,44,-35,-25,45]]},{"type":"Polygon","properties":{"name":"Sourou"},"id":"BF.SR","arcs":[[46,47,48,-46,-24,49]]},{"type":"Polygon","properties":{"name":"Bam"},"id":"BF.BM","arcs":[[50,51,52,53,-41]]},{"type":"Polygon","properties":{"name":"Boulkiemdé"},"id":"BF.BK","arcs":[[54,55,56,57,58,59,60]]},{"type":"Polygon","properties":{"name":"Kourwéogo"},"id":"BF.KW","arcs":[[61,-55,62,63]]},{"type":"Polygon","properties":{"name":"Bazéga"},"id":"BF.BZ","arcs":[[64,65,66,-57,67]]},{"type":"Polygon","properties":{"name":"Kadiogo"},"id":"BF.KA","arcs":[[68,-68,-56,-62,69]]},{"type":"Polygon","properties":{"name":"Oubritenga"},"id":"BF.OB","arcs":[[70,71,-70,-64,72]]},{"type":"Polygon","properties":{"name":"Passoré"},"id":"BF.PA","arcs":[[-52,73,-73,-63,-61,74,-44,-49,75,76]]},{"type":"Polygon","properties":{"name":"Zondoma"},"id":"BF.ZM","arcs":[[-76,-48,77]]},{"type":"Polygon","properties":{"name":"Sanguié"},"id":"BF.SG","arcs":[[-60,78,-28,-33,-45,-75]]},{"type":"Polygon","properties":{"name":"Sissili"},"id":"BF.SS","arcs":[[79,80,81,-29,-79,-59,82]]},{"type":"Polygon","properties":{"name":"Ziro"},"id":"BF.ZR","arcs":[[83,84,-83,-58,-67]]},{"type":"Polygon","properties":{"name":"Loroum"},"id":"BF.LO","arcs":[[-42,-54,85,86]]},{"type":"Polygon","properties":{"name":"Yatenga"},"id":"BF.YT","arcs":[[-53,-77,-78,-47,87,-86]]},{"type":"Polygon","properties":{"name":"Namentenga"},"id":"BF.NM","arcs":[[88,89,90,91,92]]},{"type":"Polygon","properties":{"name":"Sanmatenga"},"id":"BF.ST","arcs":[[-92,93,-71,-74,-51,-40,94]]},{"type":"Polygon","properties":{"name":"Boulgou"},"id":"BF.BL","arcs":[[95,-6,96,97,98,99,100]]},{"type":"Polygon","properties":{"name":"Koulpélogo"},"id":"BF.KL","arcs":[[-3,101,-97,-5]]},{"type":"Polygon","properties":{"name":"Ganzourgou"},"id":"BF.GZ","arcs":[[-91,102,-101,103,-65,-69,-72,-94]]},{"type":"Polygon","properties":{"name":"Kouritenga"},"id":"BF.KR","arcs":[[-7,-96,-103,-90,104]]},{"type":"Polygon","properties":{"name":"Nahouri"},"id":"BF.NR","arcs":[[-99,105,-80,-85,106]]},{"type":"Polygon","properties":{"name":"Zoundwéogo"},"id":"BF.ZW","arcs":[[-104,-100,-107,-84,-66]]},{"type":"Polygon","properties":{"name":"Bougouriba"},"id":"BF.BB","arcs":[[107,108,-13,109,110]]},{"type":"Polygon","properties":{"name":"Ioba"},"id":"BF.IO","arcs":[[-30,-82,111,112,-111,113]]},{"type":"Polygon","properties":{"name":"Tuy"},"id":"BF.TU","arcs":[[-31,-114,-110,-12,-34]]},{"type":"Polygon","properties":{"name":"Léraba"},"id":"BF.LE","arcs":[[114,115,-19]]},{"type":"Polygon","properties":{"name":"Komoé"},"id":"BF.KM","arcs":[[-14,-109,116,117,-115,-18]]},{"type":"Polygon","properties":{"name":"Poni"},"id":"BF.PO","arcs":[[118,119,120,-117,-108,-113]]},{"type":"Polygon","properties":{"name":"Gnagna"},"id":"BF.GG","arcs":[[121,-8,-105,-89,122,123]]},{"type":"Polygon","properties":{"name":"Komondjari"},"id":"BF.KJ","arcs":[[124,-9,-122,125,126]]},{"type":"Polygon","properties":{"name":"Séno"},"id":"BF.SE","arcs":[[127,-123,-93,-95,-39,-36,128]]},{"type":"Polygon","properties":{"name":"Yagha"},"id":"BF.YG","arcs":[[-126,-124,-128,129]]},{"type":"Polygon","properties":{"name":"Tapoa"},"id":"BF.TA","arcs":[[-1,-10,-125,130]]},{"type":"Polygon","properties":{"name":"Noumbiel"},"id":"BF.","arcs":[[131,-120]]}]}},"arcs":[[[8533,4086],[9,-28],[-5,-150],[37,-74],[97,-87],[91,-100],[13,-20],[2,-2]],[[8777,3625],[-15,-7],[-17,-17],[-10,-21],[-2,-15],[12,-37],[-20,-18],[-29,-17],[-25,-23],[-11,-33],[7,-30],[12,-24],[3,-23],[-22,-25],[-9,14],[-9,5],[-9,-5],[-8,-14],[-8,19],[-15,23],[-14,9],[-7,-21],[3,-14],[13,-17],[2,-17],[-1,-14],[-17,-40],[-41,27],[-21,8],[-24,2],[-11,-4],[-6,-5],[-7,-5],[-11,1],[2,9],[-10,20],[-12,13],[-13,-28],[-13,-17],[-7,-22],[24,-53],[5,-60],[6,-30],[-13,6],[-25,16],[-13,1],[-6,-9],[-8,-32],[-8,-8],[-41,-12],[-7,-4],[1,-27],[5,3],[8,9],[12,-3],[1,-8],[-2,-21],[1,-8],[4,-4],[12,-7],[2,0],[3,-21],[0,-20],[2,-19],[8,-19],[14,-20],[-1,-28],[-4,-8],[-10,11],[-9,18],[-3,9],[-13,6],[-39,5],[-5,-1],[-13,-10],[-8,0],[-3,4],[-6,17],[-4,4],[-7,3],[-6,9],[-9,8],[-27,6],[-6,3],[-6,-3],[-8,-16],[-8,-21],[-10,-22],[-5,-5],[-1,-17],[0,-20],[5,-16],[10,-7],[7,-9],[1,-21],[-3,-20],[-5,-10],[-23,1],[-17,3],[-38,29],[-164,-4],[-122,-3],[-79,-21],[-158,-76],[15,74],[-20,7],[4,7],[2,7],[1,8],[2,8],[-1,5],[-2,4],[-2,3],[-142,39]],[[7452,2872],[4,15],[48,139],[18,24],[17,-11],[14,-29],[21,-33],[22,-8],[12,23],[2,49],[7,46],[15,32],[47,73],[0,20],[-1,18],[6,28],[-6,31],[-12,27],[-12,76],[7,34],[32,29],[14,47],[-7,36],[-13,53],[-27,66],[-9,42],[-5,122],[-6,46],[8,120]],[[7648,3987],[13,27],[38,43],[44,26],[116,40],[30,34],[-7,44],[10,50],[31,44],[16,17],[56,48],[75,81],[30,-3],[26,-17],[42,-9],[36,-3],[14,-12],[16,-19],[26,-5],[14,-19],[9,-28],[15,-24],[15,-8],[42,-4],[18,2],[8,-16],[4,-31],[14,-27],[18,-26],[18,-12],[9,-11],[0,-28],[6,-14],[15,10],[13,-3],[9,-10],[14,1],[20,-19],[12,-20]],[[7648,3987],[-104,2],[-27,7],[-139,131],[-38,17],[-79,-5],[-40,26],[-24,27],[-21,-3],[-69,18],[-19,-8],[-6,-46],[-10,-13],[-20,2],[-11,3]],[[7041,4145],[-1,27],[-12,70],[-31,69],[-59,17],[-41,39],[-13,60],[-27,16],[-18,6]],[[6839,4449],[6,31],[-5,52],[5,63],[29,75],[39,35],[41,17],[36,25],[27,10],[-3,47],[-55,71],[-28,45],[-41,41],[-18,29]],[[6872,4990],[11,19],[73,92],[35,60],[34,15],[41,-6],[98,68],[134,3],[54,47],[68,77]],[[7420,5365],[13,5],[25,16],[96,88],[30,13],[146,-129],[17,-29],[58,-165],[29,-23],[20,21],[8,15],[15,5],[17,-1],[13,16],[10,29],[14,16],[9,13],[-1,23],[3,23],[17,11],[8,13],[0,18],[24,7],[8,25],[23,33],[2,41],[7,23],[8,-1],[10,-3],[9,7],[-1,31],[3,35],[20,63],[12,19],[19,11],[28,8],[27,2],[25,11],[20,32],[14,41],[16,26],[16,8],[19,6],[23,-1],[21,-14],[18,-7],[7,-2],[10,-3],[18,-3],[19,16],[15,29],[5,33],[10,23],[12,16],[1,26],[5,22],[16,9],[40,8],[52,18],[25,2],[9,5]],[[8582,5945],[-6,-31],[6,-44],[14,-53],[-9,-57],[-11,-39],[-27,-160],[-29,-70],[-25,-77],[0,-95],[23,-176],[-8,-78],[-14,-76],[29,-91],[55,-40],[45,-10],[36,-18],[-1,-55],[-33,-288],[0,-90],[-13,-86],[-19,-65],[-14,-74],[-28,-67],[-20,-19]],[[1948,4467],[6,-9],[11,-8],[10,-8],[8,-51],[-1,-23],[-5,-30],[5,-16],[6,1]],[[1988,4323],[-7,-31],[-10,-53],[6,-119],[-41,-172],[5,-59],[9,-55],[12,-58],[21,-47],[23,-36],[25,-27],[11,-19],[15,-85],[6,-66],[24,-33],[28,-4],[-1,-50],[-41,-232],[8,-61],[21,-40],[36,1],[37,9],[5,-5],[9,-8],[34,-76],[27,-46],[27,-34],[25,-26],[74,-99],[22,-20],[30,2],[19,4]],[[2447,2778],[-36,-50],[-11,-8],[-7,-2],[-7,-3],[-12,-13],[-14,-42],[-4,-26],[6,-23],[-8,-15],[-19,-3],[-22,-24],[-15,5],[-13,0],[-9,-14],[-5,-37]],[[2271,2523],[-54,-1],[-22,-11],[-15,-25],[-14,-33],[-44,-60],[-4,-34],[-5,-30],[-17,-16],[-42,-19],[-19,-15],[-23,-2],[-26,38],[-73,18],[-29,13],[-17,14],[-17,22],[-29,45],[-11,9],[-15,-2],[-37,-23],[-53,-24],[-32,-22],[-11,-13],[-69,-52],[-20,-1],[-12,17],[-8,20],[-11,13],[-74,32],[-33,3],[-19,11],[-15,30],[-31,113],[-27,41],[-31,16],[-28,3],[-30,0],[-33,-16],[-35,-31],[-23,-30],[-10,-18],[-66,-67],[-25,-3],[-28,22],[-35,16],[-22,14],[-14,30],[-35,60],[-7,25]],[[921,2600],[6,9],[15,45],[18,29],[9,28],[-7,34],[-5,39],[9,31],[29,18],[33,10],[18,22],[22,17],[27,6],[7,18],[4,23],[2,26],[-4,32],[-12,35],[-21,35],[-18,40],[-15,25],[-79,75],[-16,2],[-7,10],[-8,25],[-7,28],[8,41],[32,83],[5,39],[3,39],[15,42],[17,21],[89,86],[14,-11],[14,-41],[11,-9],[14,-2],[19,10],[26,31],[18,33],[11,25],[12,43],[4,50],[-4,35],[-16,38],[-21,38],[-16,47],[-8,53],[2,31],[7,47],[-16,16],[-32,8],[-35,0],[-18,11],[4,29],[5,25],[12,17],[21,9],[15,17],[1,21],[-8,19],[-3,30],[2,78],[14,87],[-3,53],[-18,104],[-16,27],[-64,51],[-21,13],[-18,4]],[[999,4650],[9,23],[13,16],[13,4],[26,-4],[13,1],[25,16],[1,5]],[[1099,4711],[10,-8],[8,-11],[22,-16],[31,5],[30,9],[26,-3],[24,4],[37,39],[19,-3],[18,-12],[12,-18],[0,-32],[-7,-42],[0,-33],[16,-9],[25,-3],[9,-20],[-7,-34],[-10,-35],[-4,-36],[-1,-40],[-4,-55],[-9,-51],[-34,-112],[-6,-29],[4,-43],[24,-33],[24,-3],[23,9],[20,12],[16,13],[23,11],[45,-26],[26,5],[25,20],[20,34],[14,39],[10,60],[6,28],[39,117],[34,44],[25,9],[31,-5],[33,-2],[31,5],[20,10],[17,17],[28,7],[31,-10],[21,-16],[16,-15],[19,3],[19,11]],[[921,2600],[-10,13],[-17,9],[-108,-2],[-56,14],[-25,-3],[-56,-63],[-67,-36]],[[582,2532],[-33,-1],[-65,-24],[-23,-12],[-37,-2],[-20,26],[-53,79],[-15,36],[-14,46],[-16,36],[-124,155],[-37,28],[-111,13],[-13,-1]],[[21,2911],[-2,16],[4,28],[18,16],[126,22],[22,9],[21,13],[30,26],[13,24],[8,72],[12,40],[40,55],[15,37],[3,29],[-9,183],[5,32],[20,23],[27,18],[10,15],[-1,23],[-6,40],[-1,146],[-11,61],[-45,50],[-14,3],[-13,-2],[-12,3],[-9,20],[-1,20],[7,19],[10,18],[7,18],[11,69],[2,38],[-1,31],[-9,35],[-15,24],[-20,17],[-25,15],[-13,6],[-11,1],[-22,-6],[-5,7],[-33,26],[-7,4],[-8,20],[0,8],[8,4],[18,3],[5,-3],[16,-15],[7,-3],[7,2],[9,14],[4,4],[44,10],[6,3],[4,7],[6,5],[8,1],[9,-6],[6,-7],[7,-5],[10,2],[8,10],[26,48],[49,55],[33,51],[19,23],[39,16],[42,35],[18,11],[20,3],[50,-3],[23,4],[14,-1],[14,4],[12,10],[11,13],[28,16],[27,-4],[27,-8],[26,-1],[54,27],[27,-1],[24,-29],[22,10],[36,8],[18,15],[10,18],[9,21]],[[1614,5866],[27,-32],[21,2],[19,-15],[21,-27],[25,-15],[2,-30],[-17,-18],[-12,-26],[4,-33],[-1,-65],[-6,-35],[3,-27],[20,-42],[12,-74],[3,-67],[24,-49],[54,-55],[29,-12],[41,19],[30,26],[16,21],[6,19],[-1,14],[-1,14],[6,33],[30,62],[9,41],[19,29],[39,12],[46,-3],[38,-12],[31,-6],[61,14],[96,-5],[49,-18],[79,-55],[39,-19]],[[2475,5432],[-2,-20],[-12,-41],[-3,-24],[4,-40],[-5,-16],[-16,-16],[-10,15],[-10,4],[-9,2],[-10,9],[-17,27],[-5,3],[-8,1],[-15,-8],[-49,-38],[-14,-15],[-44,-96],[-16,-70],[-12,-36],[-18,-15],[-44,-15],[-13,-41],[8,-131],[-6,-26],[-15,-25],[-21,-20],[-23,-7],[-5,-17],[-4,-33],[-6,-23],[-15,14],[-9,0],[-6,-21],[-4,-37],[-5,-2],[-5,2],[-5,-5],[-27,-58],[7,-7],[4,-8],[7,-21],[-21,-11],[-11,-26],[-2,-32],[8,-29],[-20,-1],[-11,10],[-9,2],[-3,-23]],[[1099,4711],[5,18],[3,28],[13,34],[45,36],[38,2],[13,19],[-32,84],[111,125],[5,7],[2,11],[-2,20],[4,27],[0,14],[3,13],[14,11],[19,2],[12,-14],[10,-19],[11,-14],[38,10],[-12,76],[-46,149],[10,42],[22,36],[24,32],[18,33],[8,24],[0,6],[-7,7],[-11,22],[-27,83],[-21,28],[-55,58],[-11,29],[8,91],[4,5],[9,-3],[13,3],[37,19],[42,15],[42,4],[37,-11],[36,-29],[17,-7],[27,4],[23,11],[16,14]],[[2589,6637],[6,-13],[0,-26],[-10,-129],[19,-113],[-13,-100],[14,-192],[16,-51],[20,-35],[8,-11]],[[2649,5967],[-4,-64]],[[2645,5903],[-17,-3],[-16,-6],[-6,-11],[-5,-26],[-11,-3],[-23,12],[-35,0],[-4,-6],[-1,-12],[-3,-13],[-20,-13],[1,-17],[10,-16],[17,-8],[7,-10],[-4,-24],[-8,-25],[-7,-14],[8,-17],[-3,-12],[-9,-9],[-5,-10],[0,-19],[3,-16],[-3,-11],[-6,-12],[6,-2],[0,-12],[-16,-11],[-1,-19],[8,-48],[-4,-20],[-19,-25],[-4,-33]],[[1614,5866],[2,2],[12,22],[27,114],[1,21],[-16,80],[4,99],[-10,49],[-23,40],[-37,43],[-16,30],[-34,101],[-36,46],[-8,16],[0,22],[7,15],[8,15],[16,58],[21,12],[81,-5],[14,5],[9,16],[-3,15],[-26,21],[-9,16],[6,26],[18,32],[23,28],[19,18],[13,3],[11,-4],[13,0],[13,10],[24,37],[20,43],[21,72],[13,31],[21,27],[11,8],[34,12],[11,9],[19,30],[16,8],[13,6],[19,17],[17,20],[7,17],[-10,9],[-16,2],[-7,7],[17,28],[4,5],[4,2],[5,-2],[5,-5],[6,-12],[1,-3],[6,-35],[5,-11],[10,-6],[31,-8],[7,-4],[-1,-19],[-9,-7],[-12,-3],[-10,-5],[-25,-33],[-11,-8],[-16,-21],[16,-17],[29,-11],[25,-1],[25,3],[21,-5],[43,-24],[52,-19],[23,-13],[94,-103],[58,-47],[103,-110],[9,-3],[17,3],[8,-4],[21,-29],[11,-11],[8,-1],[28,0],[54,-11]],[[3289,4678],[4,-21],[10,-15],[21,-19],[6,-18],[3,-6],[5,-1],[16,3],[5,-2],[6,-22],[-1,-17],[-3,-17],[-2,-21],[-3,-12],[-12,-31],[-3,-17],[26,-43],[22,-22],[12,-21],[-1,-24],[-49,-83],[-6,-16],[-14,1],[-14,6],[-10,2],[-23,-33],[11,-31],[31,-23],[37,-9],[76,2],[35,-18],[15,-49],[-1,-10],[73,-150],[23,-37],[8,-5]],[[3592,3899],[4,-13],[8,-37],[6,-114],[18,-27],[35,-37],[102,-88],[23,-34],[0,-38],[-17,-27],[-22,-15],[-33,-8],[-24,-34],[-29,-32],[-45,2],[-38,7],[-34,12],[-34,-18],[-30,-42],[-20,-34],[-22,-68],[-5,-17]],[[3435,3237],[-25,12],[-55,2],[-14,16],[12,38],[13,28]],[[3366,3333],[19,39],[3,21],[-3,57],[3,20],[12,33],[2,19],[2,61],[-2,18],[-6,16],[-16,28],[-3,15],[21,27],[4,9],[2,17],[-1,26],[-24,25],[-18,14],[-14,-1],[-6,-17],[-9,-12],[-17,7],[-21,20],[-18,7],[-16,-9],[-24,-7],[-24,11],[-23,29],[-34,25],[-31,5],[-17,-7],[-15,-12],[-41,-47],[-29,-23],[-29,-12],[-29,-21],[-25,-37],[-22,-11],[-20,14],[-27,-30],[-32,-16],[-26,36],[-9,40],[1,65],[-8,12],[-24,10],[-29,6],[-19,16],[-17,26],[-41,15],[-9,22],[27,101],[9,23],[-6,13],[-22,17],[-41,22],[-79,20],[-46,30],[-53,50]],[[2446,4158],[-3,23],[-11,30],[-14,15],[-5,21],[19,51],[4,40],[11,28],[16,22],[21,14],[36,6],[25,22],[17,22],[10,30],[-6,42],[2,20],[106,24],[31,-3],[11,-8],[20,7],[73,-52],[11,-45],[0,-50],[24,-30],[35,-6],[26,26],[35,14],[77,-56],[30,6],[22,20],[-2,34],[-11,51],[-24,30],[-46,5],[-27,20],[-14,38],[-31,36],[-15,31],[3,92],[21,23],[37,9],[65,-45],[37,9],[36,17],[14,-2],[4,-30],[17,-34],[13,-13],[15,-11],[44,-15],[46,6],[24,19],[14,17]],[[3389,5230],[5,-14],[-1,-35],[-40,-31],[-16,-36],[-7,-41],[7,-32],[48,-52],[17,-29],[8,-46],[1,-27],[8,-38],[14,-35],[17,-27],[0,-11],[-10,-42],[-3,-19],[-7,-17],[-14,3],[-70,59],[-27,7],[-12,-28],[-3,-9],[-12,-32],[-3,-20]],[[2446,4158],[-13,-4],[-79,-5],[-23,-8],[-27,-18],[-24,-22],[-18,-11],[-23,3],[-28,6],[-19,14],[-18,19],[-24,19],[-27,17],[-22,8],[-16,9],[-5,21],[4,24],[-6,16],[-23,15],[-20,20],[-4,18],[-5,16],[-31,3],[-7,5]],[[2645,5903],[12,-2],[17,-8],[8,-7],[4,-12],[13,-44],[33,-78],[-1,-18],[-13,-26],[9,-7],[2,2],[6,5],[11,-12],[11,-2],[9,10],[9,48],[13,15],[34,14],[39,10],[12,-16],[-7,-170],[10,-80],[-2,-9],[11,-9],[15,1],[30,8],[19,-5],[9,-12],[7,-16],[12,-16],[10,13],[52,-121],[18,-12],[2,-5],[3,-15],[2,-4],[16,-17],[10,-5],[14,-2],[18,-10],[51,-41],[26,-9],[14,-8],[22,-32],[7,-3],[11,10],[18,12],[10,9],[29,35],[21,14],[28,-1],[22,-23],[8,-22]],[[7234,8866],[-28,-45],[-25,-17],[-22,-2],[-40,-139],[-29,-43],[-26,-56],[-87,-138],[-36,-13],[-55,17],[-65,1],[-57,-13],[-48,15],[-50,8],[-89,-59],[-235,-30],[-80,-1]],[[6262,8351],[-23,11],[-34,48],[-17,76],[-12,187],[-16,21],[-20,22],[-29,46],[-32,78],[-92,122],[-1,42],[-13,50],[-32,77],[-79,150],[-40,35],[-61,110],[-74,75],[-27,38]],[[5660,9539],[262,312],[0,1],[67,92],[15,14],[23,23],[42,15],[277,3],[41,0],[12,-8],[29,-106],[13,-22],[35,-1],[46,28],[79,65],[79,19],[88,-28],[168,-95],[1,0],[318,-149],[3,-40],[-12,-24],[-17,-19],[-16,-27],[-2,-51],[37,-101],[8,-54],[-84,-324],[7,-89],[38,-85],[17,-22]],[[6262,8351],[12,-26],[9,-62],[-9,-78],[-17,-69],[-34,-45],[-40,-20],[-16,-1]],[[6167,8050],[-20,-2],[-66,-86],[-179,-123],[-163,-50],[-90,-62],[-30,7],[-96,-53],[-65,-1],[-57,-12],[-54,-21],[-53,-5]],[[5294,7642],[-5,10],[-37,20],[-66,20],[-69,43],[-47,72],[-16,85],[-15,38],[-102,-73],[-51,-8],[-52,-55],[-63,-169]],[[4771,7625],[-46,59],[-40,64],[-70,174],[-3,69],[10,70],[1,29],[-75,56],[-107,106],[-40,29],[-57,100]],[[4344,8381],[62,38],[11,12],[5,19],[23,432],[10,46],[38,23],[61,4],[103,-11],[89,6],[88,23],[438,384],[54,35],[242,81],[48,28],[44,37],[0,1]],[[3579,6214],[-8,-35],[-16,-117],[-2,-56],[13,-19],[38,-41],[42,-67]],[[3646,5879],[-36,-76],[-32,-34],[-34,-29],[-20,-28],[-18,-34],[-4,-53],[14,-56],[16,-45],[9,-40],[-56,-135],[-96,-119]],[[2649,5967],[11,14],[17,33],[9,82],[12,33],[26,34],[70,53],[12,24],[5,38],[31,35],[104,29],[19,-17],[17,-44],[20,-32],[23,-4],[29,7],[29,2],[31,-14],[26,-24],[20,7],[26,37],[39,1],[41,-34],[29,-30],[33,-22],[39,-13],[43,-4],[36,9],[39,53],[31,9],[20,-3],[43,-12]],[[3276,7465],[2,-4],[8,-17],[27,-48],[52,-73],[43,-28],[119,-38],[30,-23],[13,-38],[21,-24],[27,-8],[24,-16],[11,-18],[4,-39],[0,-32],[5,-82],[34,-82],[9,-37]],[[3705,6858],[27,-25],[34,-23],[33,-2],[31,10],[38,-10],[24,-20],[-13,-50],[-56,-105],[-38,-90],[-27,-41],[-44,-15],[-41,1],[-57,13],[-28,-8],[-16,-48],[0,-68],[13,-86]],[[3585,6291],[0,-25],[-3,-38],[-3,-14]],[[2589,6637],[15,-3],[16,5],[12,29],[-1,31],[-15,61],[5,50],[28,15],[207,17],[17,15],[-44,439],[19,65],[6,41],[5,98],[-8,42],[-26,27],[25,34],[34,-16],[56,-58],[35,-5],[28,8],[27,1],[31,-25],[23,-29],[6,-17],[4,-26],[8,-27],[15,8],[22,32],[15,11],[10,3],[30,-4],[11,-5],[9,-8],[9,-6],[9,3],[44,22]],[[5294,7642],[44,-97],[12,-60],[-22,-75],[-19,-51],[-18,-28],[1,-42],[17,-78],[-14,-68],[-33,-56],[24,-70],[47,-74],[32,-96],[-7,-49],[-21,-53],[-5,-43],[9,-75],[-4,-46],[-44,8],[-53,1],[-70,-18],[-72,-36],[-42,-56],[-3,-55],[25,-58],[2,-35]],[[5080,6332],[-11,3],[-58,3],[-20,13],[-21,32],[-9,0],[-7,-7],[-8,-6],[-8,3],[-3,16],[-5,15],[-10,-1],[-19,-9],[-17,14],[-24,37],[-23,45],[-51,56],[-9,12]],[[4777,6558],[3,21],[16,30],[9,36],[0,53],[-12,46],[-21,54],[-31,30],[-30,3],[-8,31],[-29,42],[-21,37],[-3,42],[4,175],[-49,137]],[[4605,7295],[0,39],[13,74],[44,50],[52,37],[47,19],[31,27],[-1,48],[-13,26],[-7,10]],[[4526,5775],[6,-8],[11,-18],[0,-36],[6,-37],[32,-16],[43,-16],[43,-27],[29,-49],[12,-61],[9,-90],[-16,-28],[-50,-30],[-38,-9],[-29,24],[-34,21],[-34,3],[-46,-2],[-26,-28],[-17,-40],[-17,-52],[-13,-68],[-29,-59],[-15,-41],[24,-33],[41,-19],[43,28],[49,50],[46,36],[48,15],[50,5],[24,-3]],[[4678,5187],[11,-16],[-4,-35],[1,-33],[22,-31],[5,-32],[-1,-35],[-5,-29],[-14,-23],[-29,-31],[-34,-49],[-15,-33]],[[4615,4840],[-30,-4],[-35,-28],[-19,-29],[-27,-14],[-7,-46],[-16,-59],[-46,-49],[-19,-27],[-17,-31]],[[4399,4553],[-3,-9],[-26,-25],[-42,-31],[-111,-55],[-49,-10],[-19,3]],[[4149,4426],[-18,-14]],[[4131,4412],[-4,20],[14,45],[7,46],[-39,3],[-54,-36],[-41,-13],[-29,22],[-55,69],[-40,7],[-33,16],[-14,62],[0,37],[10,10],[26,30],[27,45],[-23,44],[-33,39],[18,33],[52,38],[31,52],[0,108],[-18,196],[-11,18],[-7,32],[12,32],[40,6],[44,29],[29,45],[84,75],[29,66],[18,73],[-15,33],[-29,-28],[-16,-35],[-15,-7],[-16,35],[-15,42],[-6,23]],[[4059,5724],[16,13],[10,6],[22,22],[40,19],[80,27],[37,2],[77,-12],[22,13],[16,15],[61,0],[28,-19],[18,-44],[24,-5],[16,14]],[[4962,5768],[-7,-20],[-11,-39],[-5,-41],[-9,-41],[-27,-20],[-20,-1],[-38,-8],[-25,-11],[-16,-12],[-2,-29],[48,-230],[5,-32],[-37,-20],[-78,-31],[-51,-35],[-11,-11]],[[4526,5775],[-11,25],[-18,57],[4,65],[25,64],[101,128],[164,54]],[[4791,6168],[33,-41],[13,-7],[18,-2],[20,-13],[5,-40],[-4,-52],[12,-100],[8,-32],[14,-16],[41,-13],[11,-30],[0,-54]],[[5636,4908],[6,-21],[12,-17],[12,-13],[6,-9],[7,-79],[5,-20],[3,-10],[10,-18],[23,-31],[10,-34],[36,-58],[17,-21],[16,-16],[9,-8],[8,-8],[27,-48],[7,-20],[3,-27],[-3,-50],[7,-16]],[[5857,4384],[-64,-13],[-82,37],[-52,36],[-36,11],[-65,-28],[-84,-77],[-44,-60],[-16,-43],[-102,-227],[-36,-166]],[[5276,3854],[-5,10],[-96,64],[-35,54],[-16,35],[-20,24],[-85,56],[-21,29],[-24,25],[-30,20],[-31,14],[-31,36],[-30,44],[-26,29],[-108,161],[-30,22],[-33,-10],[-36,-33],[-47,-3],[-45,3],[-22,-18],[-14,2],[-45,87],[-47,48]],[[4615,4840],[62,-91],[22,-21],[38,-6],[10,0],[26,-14],[22,-23],[17,0],[44,60],[26,10],[26,14],[32,32],[31,15],[24,19],[18,42],[20,29],[30,16],[24,5],[18,-5],[13,1],[17,4],[21,-24],[25,-101],[14,-25],[22,0],[26,23],[27,16],[33,14],[26,3],[31,-31],[21,10],[35,24],[56,12],[51,1],[25,5],[33,19],[38,11],[17,24]],[[5591,5042],[1,-32],[9,-19],[9,-7],[10,-2],[8,-8],[6,-16],[3,-13],[-1,-37]],[[4962,5768],[12,-13],[21,-33],[16,-41],[1,-36],[-13,-34],[-5,-42],[7,-36],[21,-7],[35,15],[29,25],[18,13],[21,-37],[17,-22],[5,-33],[-8,-27],[-23,-46],[-3,-10],[5,-11],[97,8],[25,13],[27,36],[20,10],[16,6],[14,-8],[56,-18],[17,-38],[11,-48],[-2,-45],[-23,-76],[-3,-32],[1,-28],[17,-4],[35,-26],[31,-50],[18,-4],[84,-58],[32,11]],[[5017,6174],[21,-15],[33,-31],[30,-22],[33,3],[45,-3],[43,-12],[23,-1],[14,-26],[16,-35],[39,-18],[64,-21],[62,-42],[58,-60],[27,-62],[-2,-18],[5,-6],[9,-4],[9,-9],[4,-23],[-8,-17],[-14,-17],[-7,-19],[12,-20],[15,-3],[8,15],[2,23],[1,20],[4,9],[10,8],[13,2],[11,-7],[3,-9],[22,-2],[55,3],[55,-40],[83,-142],[65,-55],[37,-12]],[[5917,5506],[0,-33],[-12,-38],[-36,-24],[-41,-7],[-38,35],[-49,68],[-42,-2],[-30,-55],[-25,-8],[-30,-6],[16,-15],[9,-49],[-12,-58],[-25,-63],[-5,-3],[-7,0],[-9,-2],[-6,-7],[-1,-8],[1,-21],[0,-8],[-7,-36],[2,-16],[10,-7],[13,-17],[1,-40],[-2,-39],[-1,-5]],[[4791,6168],[84,48],[48,-5],[52,-35],[34,-9],[8,7]],[[5080,6332],[-36,-78],[-15,-68],[-12,-12]],[[4059,5724],[-7,2],[-59,-28],[-22,-6],[-32,-13],[-40,-12],[-17,5],[-9,28],[18,46],[31,37],[10,27],[-28,11],[-55,-5],[-38,7],[-5,39],[12,44],[19,40],[-6,44],[-25,24],[-16,2],[-15,-4],[-25,-28],[-18,-22],[-36,-39],[-50,-44]],[[3585,6291],[27,-9],[58,-6],[67,2],[47,-9],[44,6],[60,15],[36,15],[60,89],[49,40],[120,69],[44,-14],[51,-30],[40,-3]],[[4288,6456],[33,-24],[16,-38],[16,5],[75,-5],[17,16],[15,32],[17,25],[20,-6],[23,-11],[30,9],[22,77],[12,30],[31,25],[30,-23],[22,-53],[65,11],[45,32]],[[3705,6858],[12,10],[48,13],[33,16],[30,21],[25,31],[10,16],[9,17],[24,21],[49,22],[14,-15],[16,-24],[67,-6],[111,-52],[37,-7],[35,-1],[22,-11],[64,36],[27,-11],[9,-23],[0,-29],[6,-32],[14,-45],[-33,-65],[-14,-55],[1,-16],[7,-24],[2,-15],[-3,-15],[-8,-5],[-8,-3],[-8,-8],[-8,-39],[-1,-3],[-4,-4],[-17,-10],[-5,-5],[-5,-53],[25,-29]],[[4131,4412],[-32,-8],[-89,-35],[-41,-7],[-46,-20],[-118,-92],[-31,-33],[-24,-52],[-21,-62],[-13,-71],[0,-88],[-15,-42],[-82,2],[-27,-5]],[[4972,3394],[-1,-18],[0,-72],[-13,-27],[-13,-47],[-7,-45],[-18,-32],[-20,-43],[8,-35],[32,-19],[25,-28],[20,-16],[18,-10],[17,-14],[55,-28],[47,4],[7,-18],[4,-27],[20,-16],[25,7],[14,-35],[0,-23]],[[5192,2852],[-12,6],[-16,9],[-160,7],[-22,-10],[-9,-31],[-15,-11],[-196,-3],[-276,-3],[-285,-4],[-305,-5],[-247,-3],[-119,-2]],[[3530,2802],[0,1],[1,18],[1,19],[6,30],[11,28],[17,17],[43,1],[17,9],[9,25],[7,33],[5,38],[-15,38],[-24,32],[-60,60],[-23,4],[-28,-65],[-16,-10],[-14,-13],[-13,4],[1,35],[-9,103],[-11,28]],[[4149,4426],[10,-58],[8,-92],[-7,-22],[-1,-30],[12,-42],[2,-40],[-4,-38],[-26,-19],[-53,2],[-47,12],[-21,-6],[-13,-205],[2,-54],[16,-49],[31,-34],[32,-16],[62,4],[33,-5],[25,-21],[24,-29],[15,-21],[1,-8],[1,-24],[8,-49],[19,-50],[25,-43],[26,-31],[24,-22],[30,-15],[15,-28],[6,-31],[20,-19],[26,-10],[20,-2],[13,11],[15,41],[18,30],[39,44],[60,-21],[10,-16],[5,-30],[13,-22],[22,-30],[32,-5],[23,15],[21,17],[35,39],[25,43],[34,25],[23,3],[20,-1],[33,-9],[14,-24],[6,-20],[41,-27]],[[5276,3854],[43,-87]],[[5319,3767],[-48,-67],[-24,-39],[-16,-22],[-20,-20],[-27,-19],[-29,-15],[-34,-34],[-54,-86],[-28,-16],[-19,5],[-21,-13],[-27,-47]],[[4605,7295],[-54,-18],[-40,-5],[-65,-20],[-31,10],[-37,5],[-46,-5],[-27,9],[-41,231],[-39,153],[-9,19],[-27,75],[2,59],[9,55],[-24,31],[-38,16],[-21,43],[-8,95],[-20,13],[-29,13],[-55,75],[-42,27],[-42,1],[-31,-24],[-22,-28],[-12,-27],[-18,-6],[-22,9],[-20,-10],[-16,-19],[-19,1],[-28,12],[-12,14],[2,37],[-13,46],[-45,82],[-68,86]],[[3597,8350],[71,109],[28,32],[103,81],[69,22],[96,-28],[295,-191],[41,-13],[19,4],[25,15]],[[3276,7465],[44,23],[-36,166],[-5,94],[20,68],[22,50],[49,228],[-2,3],[-2,4],[-3,3],[-8,-2],[34,74],[186,141],[22,33]],[[6693,7216],[5,-15],[-10,-29],[-46,-37],[-35,-61],[5,-59],[18,-45],[-6,-71],[-30,-87],[-12,-68],[15,-65],[-11,-50],[-35,-65],[-28,-84],[-7,-153],[10,-47],[21,-57],[7,-31],[17,-59],[23,-46],[28,-26],[56,-42],[49,-49],[-29,-138],[6,-25],[9,-29],[16,-64],[1,-67],[-13,-77]],[[6717,5570],[-230,-161],[-61,-4],[-209,67],[-14,2]],[[6203,5474],[-3,31],[0,126],[-24,87],[-32,53],[-15,3]],[[6129,5774],[-4,109],[-32,93],[-58,87],[-47,102],[-28,95],[-7,51],[8,23],[20,9],[86,-70],[36,10],[15,34],[7,65],[-9,105],[8,109],[25,101],[8,93],[-13,97],[-20,90],[-15,122],[-24,29],[-21,52],[-31,190],[-2,101],[15,56],[30,30],[27,14],[26,59],[13,116],[-6,94],[13,58],[61,67]],[[6210,7965],[22,-10],[49,-32],[36,-37],[72,-106],[19,-57],[9,-81],[28,-59],[34,-39],[34,-56],[50,-36],[83,-6],[55,-19],[-3,-49],[-23,-48],[-6,-53],[24,-61]],[[6129,5774],[-31,5],[-49,-8],[-18,-43],[7,-60],[0,-42],[-41,-51],[-49,-46],[-31,-23]],[[6167,8050],[5,-16],[12,-31],[17,-28],[9,-10]],[[6392,4563],[1,-18],[1,-45],[-10,-43],[13,-55],[39,-70],[61,-62],[130,-43],[32,-5],[43,94],[113,126],[18,10],[6,-3]],[[7041,4145],[2,-17],[-4,-27],[-16,-10],[-21,0],[-51,8],[-21,-14],[-41,-49],[-25,-68],[-23,-30],[-17,-29],[-30,-87],[10,-38],[22,-38],[-7,-27],[-8,-24],[0,-27],[-5,-61],[-16,-25],[-11,-24],[7,-28],[-3,-27],[-16,-26],[2,-37],[15,-18],[22,-1],[24,-9],[21,5],[21,13],[25,7],[36,3],[34,-18],[19,-28],[-1,-25],[-14,-25],[-13,-19],[-18,-21],[-13,-24],[-6,-26],[-9,-27],[-14,-21],[-22,-9],[-11,-16],[0,-26],[-17,-47],[-12,-48],[-3,-14]],[[6833,3046],[-64,18],[-172,49],[-3,-28],[5,-17],[3,-15],[-10,-26],[-16,-22],[-64,-63],[-22,37],[-24,26],[-25,0],[-24,-42],[-6,-26],[-3,-39],[-6,-19],[-15,-17],[-34,-21],[-12,-20],[0,-1],[-3,-4],[-3,-4],[-5,-3],[-4,-2],[-49,2],[-26,-4],[-19,-9],[-11,-29],[-10,-43],[-12,-40],[-22,-19],[-61,80],[4,13],[9,14],[6,14],[-8,12],[-12,1],[-9,-4],[-5,2],[-2,19],[-9,1]],[[6090,2817],[-3,57],[12,31],[7,27],[-8,34],[-23,26],[-21,30],[-15,44],[-29,63],[-13,43]],[[5997,3172],[9,12],[18,32],[10,54],[15,37],[35,24],[45,52],[48,40],[35,47],[37,21],[38,-19],[1,32],[-3,48],[20,63],[-23,53],[-14,17],[-43,27],[-13,15],[-24,16],[-97,32],[-22,-5],[-3,2],[-29,-29],[-57,44],[-59,31],[-39,38],[-71,148],[17,67],[36,64],[32,25],[74,139]],[[5970,4299],[64,7],[67,28],[49,67],[22,50],[25,47],[28,40],[36,19],[70,10],[50,-5],[11,1]],[[7452,2872],[-110,31],[-288,81],[-155,44],[-66,18]],[[6203,5474],[1,-11],[11,-53],[54,-44],[42,-49],[19,-51],[8,-44],[-12,-67],[33,-118],[7,-52],[9,-38],[69,-92],[-8,-24],[11,-166],[-20,-67],[-24,-34],[-11,-1]],[[5970,4299],[-14,5],[-12,12],[-9,18],[-9,44],[-13,1],[-17,-7],[-17,-1],[-22,13]],[[6717,5570],[-35,-146],[14,-72],[51,-39],[48,-46],[-2,-60],[-39,-70],[-7,-72],[39,-40],[86,-35]],[[6090,2817],[-144,3],[0,1],[-6,12],[-7,4],[-8,-4],[-7,-12],[-27,-7],[-28,-42],[-22,-4],[8,24],[-13,-1],[-7,5],[-8,24],[-10,9],[-11,3],[-174,19],[-36,-7],[-11,-27],[-152,2],[-161,2],[-32,8],[-42,23]],[[5319,3767],[14,-11],[23,-44],[13,-48],[34,-10],[42,1],[25,-45],[22,-52],[24,-22],[41,-13],[31,-27],[44,-68],[28,-24],[37,16],[38,-11],[14,-37],[0,-48],[18,-13],[26,-24],[23,-49],[20,-20],[32,-48],[76,-50],[34,17],[19,35]],[[3121,2371],[-6,-10],[-15,-10],[-23,-10],[-53,-44],[-87,-106],[-42,-22],[-24,-7],[-26,-13],[-34,-28],[-25,-10],[-47,56],[-23,22],[-29,18],[-38,3],[-62,-31],[-26,-3],[-16,6],[-23,21],[-40,24],[-50,8],[-53,-9],[-69,-25]],[[2310,2201],[-23,38],[-14,15],[-49,8],[-20,9],[-14,19],[-6,23],[2,19],[5,16],[11,14],[25,7],[72,-2],[18,14],[-5,36],[-11,38],[-19,27],[-12,26],[1,15]],[[2447,2778],[9,50],[-5,15],[-11,15],[-6,20],[5,13],[13,8],[11,11],[8,16],[7,19],[8,15],[24,5],[15,18],[27,63],[13,10],[23,4],[24,19],[12,33],[35,-33],[43,9],[29,26],[24,2],[23,-4],[27,16]],[[2805,3128],[27,14],[39,14],[69,15],[50,-8],[47,-22],[4,-42],[-9,-57],[-12,-36],[3,-37],[10,-36],[-8,-45],[-17,-44],[-4,-35],[-4,-28],[-9,-20],[-17,-67],[12,-86],[-40,-21],[-11,-34],[16,-15],[7,-20],[-9,-36],[-3,-36],[15,-10],[13,22],[37,5],[49,-3],[16,-6],[12,-18],[4,-24],[9,-18],[17,-11],[3,-12]],[[3530,2802],[-27,0],[-1,19],[-109,2],[2,-10],[-4,-12],[8,-34],[14,-31],[7,-34],[-7,-40],[-17,-26],[-20,-21],[-17,-27],[-9,-36],[-14,-82],[-21,-47],[-5,-41],[-7,-16],[-13,-19],[-4,-10],[3,-18]],[[3289,2319],[-1,0],[-17,-16],[-18,-6],[-28,-1],[-14,17],[-8,28],[-21,34],[-31,3],[-30,-7]],[[2805,3128],[5,18],[11,84],[9,30],[16,33],[53,88],[38,41],[52,20],[33,-18],[20,-25],[40,8],[52,23],[47,-5],[33,-23],[52,-15],[47,-22],[42,-27],[11,-5]],[[582,2532],[14,-27],[35,-20],[33,-10],[20,-13],[20,6],[21,-23],[-3,-38],[-8,-39],[11,-55],[2,-65],[-6,-34],[-8,-32],[-19,-53],[-15,-31],[-16,3],[-20,10],[-24,-10],[-37,-11],[-38,-18],[-28,5],[-13,10],[-15,-37],[-12,-39],[19,-27],[26,-20],[6,-73],[20,-32],[9,-35],[-1,-30],[8,-61],[-3,-22],[-13,-28],[-6,-28],[1,-34],[-33,-35]],[[509,1586],[-20,18],[-21,2],[-9,-23],[-11,-2],[-63,50],[-20,-7],[-58,12],[-21,1],[-10,-8],[-6,-12],[-8,-11],[-15,-5],[-14,-1],[-7,2],[-6,5],[-6,4],[-5,-7],[-5,-10],[-6,-5],[-25,1],[-21,7],[-18,13],[-13,16],[-4,11],[-4,15],[-6,15],[-7,6],[-12,1],[-9,2],[-18,9],[-1,30],[-16,45],[-22,40],[-22,17],[7,25],[10,90],[5,15],[30,63],[17,92],[-4,17],[-9,12],[1,27],[9,28],[12,16],[-19,10],[-2,15],[-6,29],[-1,16],[13,94],[6,26],[9,13],[10,7],[8,8],[2,18],[0,14],[17,102],[-4,21],[-16,37],[-23,123],[-17,49],[-29,-9],[8,45],[-13,91]],[[2310,2201],[2,-13],[-2,-29],[-4,-17],[-2,-19],[-3,-154],[5,-49],[0,-29],[-6,-7],[-11,-11],[-13,-20],[-9,-38],[-13,-42],[-36,-62],[-6,-14],[-7,-12],[1,-29],[10,-26],[5,-24],[9,-59],[8,-31],[3,-30],[-9,-31],[-40,-76],[-23,-68],[-14,-25],[-41,-30],[-54,-23],[-30,1],[-37,12],[-28,-2],[-11,-28],[-14,-56],[-4,-24],[12,-46],[72,-80],[38,-55],[4,-34],[-1,-28],[0,-10]],[[2061,883],[-23,-10],[-48,-42],[-27,-10],[-19,-14],[-5,-28],[-8,-25],[-41,-1],[-10,-5],[-20,-12],[-1,-5],[0,-9],[-3,-9],[-8,-2],[-7,3],[-13,10],[-72,29],[-22,-3],[-23,-24],[-36,-70],[-23,-18],[-48,-8],[-22,-11],[-16,-21],[5,-2],[15,-6],[-38,-56],[-7,-16],[0,-15],[3,-42],[-3,-22],[-16,-44],[-8,-13],[-1,-1],[-34,20],[-19,7],[-4,-27],[0,-29],[-4,-16],[-17,11],[-9,19],[-11,58],[-11,26],[-31,10],[-45,-3],[-41,6],[-18,36],[3,32],[12,46],[3,30],[-3,9],[-7,5],[-10,3],[-23,0],[-4,-4],[-1,-7],[-4,-12],[-6,-24],[-1,-23],[-5,-19],[-18,-7],[-15,8],[-18,37],[-14,16],[-17,-23],[-14,-11],[-16,-3],[-19,0],[2,-4],[-5,-11],[-8,-11],[-10,-10],[-11,-6],[-1,1],[1,7],[-7,10],[-17,10],[-6,7],[-3,14],[-2,18],[-5,12],[-14,18],[-7,12],[-5,10],[-6,6],[-13,2],[-13,-2],[-4,-6],[2,-8],[7,-9],[-19,-5],[-17,37],[-16,-7],[-4,15],[-2,6],[-12,14],[0,13],[13,-1],[10,2],[21,10],[-12,30],[-7,40],[-10,26],[-24,-10],[-9,36],[-18,22],[-25,11],[-29,3],[-11,3],[-4,8],[-6,9],[-14,3],[-10,-8],[-7,-15],[-7,-12],[-11,6],[-37,47],[-1,20],[18,72],[-3,11],[-13,41],[-14,26],[-6,18],[27,1],[4,24],[-8,32],[-14,27],[-16,13],[-16,11],[-14,17],[-6,32],[-13,-15],[-15,-9],[-14,3],[-10,21],[17,11],[-8,3],[-7,5],[-9,3],[-10,1],[11,14],[30,14],[-2,14],[-32,29],[-8,18],[9,32],[-34,-2],[0,19],[11,32],[-3,36],[-4,-12],[-6,-11],[-7,-9],[-9,-4],[-16,2],[-1,8],[5,10],[3,9],[0,97],[-9,26],[-1,1]],[[3289,2319],[1,-8],[3,0],[5,-1],[6,-4],[4,-8],[0,-11],[-3,-8],[-4,-7],[-7,-29],[-17,-42],[-4,-17],[5,-33],[38,-93],[3,-17],[2,-38],[4,-17],[6,-10],[17,-24],[3,-8],[4,-34],[10,-22],[45,-54],[15,-11],[21,-5],[31,-1],[4,-8],[-5,-16],[-12,-17],[-13,-7],[-17,-2],[-12,-6],[-10,-11],[-9,-16],[-8,-26],[-7,-36],[0,-36],[10,-29],[12,-7],[12,-2],[11,-3],[5,-12],[3,-20],[8,-4],[11,0],[12,-6],[13,-11],[8,-5],[4,-10],[1,-22],[-4,-23],[-10,-16],[-25,-28],[-17,-36],[0,-35],[13,-79],[0,-57]],[[3455,1231],[-53,16],[-41,16],[-37,-16],[-22,-57],[-12,-88],[-26,-26],[-52,11],[-52,57],[-37,57],[-64,0],[-67,5],[-37,-42],[4,-88],[-34,-72],[7,-96]],[[2932,908],[-16,13],[-19,-19],[-43,-84],[-17,-24],[-31,-4],[-12,23],[-3,36],[1,35],[-5,12],[-13,-8],[-15,-12],[-12,-6],[-13,10],[-22,28],[-16,9],[-199,22],[-75,-14],[-22,6],[-13,14],[-9,14],[-9,13],[-17,7],[-5,-4],[-11,-20],[-7,-5],[-8,2],[-17,13],[-9,2],[-61,-11],[-19,-8],[-13,-11],[-20,-30],[-11,-11],[-24,-10],[-84,-3],[-2,0]],[[7704,6262],[-6,-2],[-12,-7],[-6,-14],[0,-19],[5,-28],[-13,-23],[-24,-9],[-21,-16],[-23,-22],[-27,-20],[-30,9],[-34,2],[-38,14],[-40,24],[-30,7],[-28,25],[-35,5],[-11,-20],[4,-37],[-8,-54],[-26,-43],[-10,-26],[33,-45],[35,-88],[25,-288],[36,-180],[0,-42]],[[6693,7216],[21,27],[26,63],[21,41],[44,-2],[55,-22],[45,-28],[55,12],[36,23],[60,29]],[[7056,7359],[5,-31],[5,-58],[1,-49],[24,-23],[41,-67],[37,-110],[42,-80],[79,-102],[14,-62],[56,-68],[165,-72],[27,-48],[38,-46],[34,-49],[44,-79],[50,-69],[14,-52],[-10,-28],[-18,-4]],[[8627,6059],[0,-1],[-45,-113]],[[7704,6262],[20,-8],[31,10],[30,26],[34,-11],[43,20],[32,-17],[37,-5],[30,33],[24,36],[34,-2],[24,21],[24,29],[115,86],[24,13],[0,1]],[[8206,6494],[1,-33],[3,-33],[12,-28],[36,-28],[90,-10],[38,-26],[72,-83],[76,-86],[93,-108]],[[7610,7839],[0,-1],[-7,-21],[-11,-18],[-22,-27],[-29,-20],[-57,-3],[-15,-28],[-15,-39],[-22,-22],[-57,-2],[-57,-29],[-18,-33],[-9,-25],[-7,-25],[-25,-27],[-33,-6],[-23,-17],[-15,-24],[-18,-23],[-28,-19],[-16,-7],[-13,-7],[-21,-18],[-36,-39]],[[7234,8866],[182,-225],[54,-98],[4,-10],[-2,-15],[-12,-21],[-4,-16],[-7,-54],[-6,-21],[-30,-64],[-6,-20],[6,-20],[16,-33],[8,-12],[8,-8],[7,-10],[5,-15],[-2,-11],[-10,-28],[0,-16],[12,-18],[16,-11],[13,-15],[3,-31],[10,-31],[21,-20],[22,-15],[14,-21],[-1,-15],[-10,-32],[1,-18],[7,-13],[27,-24],[10,-15],[10,-32],[10,-19]],[[7610,7839],[6,-10],[19,-24],[42,-38],[13,-24],[15,-20],[24,-12],[8,-17],[-7,-33],[-12,-37],[-6,-26],[18,-44],[33,-16],[168,7],[12,-3],[4,-12],[0,-15],[1,-11],[-1,-6],[-4,-7],[1,-12],[15,-19],[25,-17],[22,-2],[48,7],[58,-24],[68,-56],[51,-74],[7,-79],[24,-54],[41,-41],[138,-87],[23,-10],[53,-9],[21,-8],[20,-18],[24,-37],[-35,-18],[-24,16],[-21,25],[-23,9],[-6,-10],[-6,-19],[-13,-60],[-9,-4],[-28,16],[-68,23],[-101,55],[-26,6],[-17,-70],[0,-149],[1,-166],[0,-111]],[[8627,6059],[33,-38],[103,-118],[70,-80],[86,-100],[36,-27],[42,-15],[129,-15],[160,-19],[23,3],[21,20],[15,30],[13,34],[22,43],[8,24],[6,8],[10,3],[9,-5],[10,-3],[14,13],[22,32],[11,9],[123,-14],[51,-19],[33,-53],[7,-34],[5,-9],[13,-19],[14,-15],[23,-19],[11,-20],[9,-24],[4,-22],[9,-106],[7,-22],[10,-27],[7,-14],[16,-24],[5,-13],[0,-8],[-4,-18],[0,-9],[3,-39],[-9,-18],[-19,-7],[-75,-9],[-6,2],[-14,9],[-4,2],[-8,-6],[-9,-18],[-6,-6],[-73,-20],[-19,-22],[-3,-51],[25,-62],[54,-103],[94,-180],[89,-170],[100,-191],[66,-77],[-46,-170],[-17,-46],[-49,-74],[-14,-50],[0,-31],[1,-19],[-5,-17],[-17,-23],[-68,-52],[-92,-103],[-167,-232],[-5,-9],[-35,-22],[-45,4],[-53,29],[-33,21],[-15,3],[-12,-11],[-22,9],[-25,-7],[-49,-27],[-24,-3],[-56,6],[-20,-9],[-24,-16],[-58,-17],[-22,-15],[-24,-12],[-27,68],[-22,-2],[2,11],[3,25],[3,12],[-119,13],[-25,7],[-20,16],[-7,-25],[-13,-10],[-1,0]],[[3455,1231],[0,-94],[6,-35],[29,-60],[8,-31],[-1,-45],[-12,-80],[5,-45],[30,-66],[4,-18],[-8,-17],[-44,-68],[-21,-58],[-5,-37],[9,-37],[10,-16],[7,-1],[7,1],[11,-8],[7,-14],[1,-16],[4,-16],[10,-10],[4,-5],[-16,-19],[-11,-26],[-6,-29],[-2,-28],[2,-28],[7,-18],[45,-57],[45,-80],[-39,-52],[-31,-89],[-24,-29],[-30,3],[-29,31],[-126,231],[-63,169],[-22,82],[-16,40],[-19,28],[-24,8],[-44,-18],[-23,2],[-22,25],[-12,41],[-16,85],[-25,42],[-30,9],[-28,1],[-22,18],[-6,35],[3,42],[0,34]]],"transform":{"scale":[0.0007913538342834255,0.0005688593762376221],"translate":[-5.522578084999878,9.391882629000122]}};
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
