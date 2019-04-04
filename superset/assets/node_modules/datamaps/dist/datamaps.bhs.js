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
  Datamap.prototype.bfaTopo = '__BFA__';
  Datamap.prototype.bgdTopo = '__BGD__';
  Datamap.prototype.bgrTopo = '__BGR__';
  Datamap.prototype.bhrTopo = '__BHR__';
  Datamap.prototype.bhsTopo = {"type":"Topology","objects":{"bhs":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"New Providence"},"id":"BS.NW","arcs":[[0]]},{"type":"Polygon","properties":{"name":"City of Freeport"},"id":"BS.FP","arcs":[[1,2]]},{"type":"MultiPolygon","properties":{"name":"West Grand Bahama"},"id":"BS.WG","arcs":[[[3]],[[-3,4,5,6]]]},{"type":"MultiPolygon","properties":{"name":"East Grand Bahama"},"id":"BS.EG","arcs":[[[7]],[[-6,8]]]},{"type":"Polygon","properties":{"name":"Grand Cay"},"id":"BS.GC","arcs":[[9]]},{"type":"Polygon","properties":{"name":"North Abaco"},"id":"BS.NO","arcs":[[10,11]]},{"type":"MultiPolygon","properties":{"name":"Central Abaco"},"id":"BS.CO","arcs":[[[12]],[[13]],[[14]],[[15]],[[16,17,-11,18]]]},{"type":"MultiPolygon","properties":{"name":"South Abaco"},"id":"BS.SO","arcs":[[[19]],[[-17,20]]]},{"type":"Polygon","properties":{"name":"Moore's Island"},"id":"BS.MI","arcs":[[21]]},{"type":"MultiPolygon","properties":{"name":"Berry Islands"},"id":"BS.BY","arcs":[[[22]],[[23]]]},{"type":"Polygon","properties":{"name":"North Andros"},"id":"BS.NS","arcs":[[24,25]]},{"type":"MultiPolygon","properties":{"name":"Central Andros"},"id":"BS.CS","arcs":[[[26]],[[27]],[[28]],[[29]],[[-25,30]]]},{"type":"Polygon","properties":{"name":"Mangrove Cay"},"id":"BS.MC","arcs":[[31,32]]},{"type":"MultiPolygon","properties":{"name":"South Andros"},"id":"BS.SA","arcs":[[[33]],[[34]],[[35]],[[-32,36]]]},{"type":"MultiPolygon","properties":{"name":"Black Point"},"id":"BS.BP","arcs":[[[37]],[[38]],[[39]]]},{"type":"MultiPolygon","properties":{"name":"Exuma"},"id":"BS.EX","arcs":[[[40]],[[41]]]},{"type":"Polygon","properties":{"name":"Spanish Wells"},"id":"BS.SW","arcs":[[42]]},{"type":"Polygon","properties":{"name":"Harbour Island"},"id":"BS.HI","arcs":[[43]]},{"type":"Polygon","properties":{"name":"North Eleuthera"},"id":"BS.NE","arcs":[[44,45]]},{"type":"Polygon","properties":{"name":"Central Eleuthera"},"id":"BS.CE","arcs":[[46,47,-45,48]]},{"type":"Polygon","properties":{"name":"South Eleuthera"},"id":"BS.SE","arcs":[[49,-47]]},{"type":"Polygon","properties":{"name":"Cat Island"},"id":"BS.CI","arcs":[[50]]},{"type":"Polygon","properties":{"name":"San Salvador"},"id":"BS.SS","arcs":[[51]]},{"type":"MultiPolygon","properties":{"name":"Rum Cay"},"id":"BS.RC","arcs":[[[52]],[[53]]]},{"type":"Polygon","properties":{"name":"Long Island"},"id":"BS.LI","arcs":[[54]]},{"type":"MultiPolygon","properties":{"name":"Ragged Island"},"id":"BS.RI","arcs":[[[55]],[[56]],[[57]],[[58]],[[59]]]},{"type":"MultiPolygon","properties":{"name":"Crooked Island and Long Cay"},"id":"BS.CK","arcs":[[[60]],[[61]],[[62]]]},{"type":"MultiPolygon","properties":{"name":"Acklins"},"id":"BS.AK","arcs":[[[63]],[[64]],[[65]]]},{"type":"Polygon","properties":{"name":"Mayaguana"},"id":"BS.MG","arcs":[[66]]},{"type":"MultiPolygon","properties":{"name":"Inagua"},"id":"BS.IN","arcs":[[[67]],[[68]]]},{"type":"MultiPolygon","properties":{"name":"Bimini"},"id":"BS.BI","arcs":[[[69]],[[70]],[[71]],[[72]],[[73]],[[74]],[[75]],[[76]],[[77]],[[78]],[[79]],[[80]],[[81]],[[82]],[[83]],[[84]],[[85]],[[86]],[[87]],[[88]],[[89]],[[90]],[[91]],[[92]],[[93]],[[94]],[[95]],[[96]],[[97]],[[98]],[[99]],[[100]],[[101]],[[102]]]},{"type":"Polygon","properties":{"name":"Hope Town"},"id":"BS.HT","arcs":[[103]]}]}},"arcs":[[[3870,6449],[-20,13],[-25,3],[-24,-1],[-16,2],[-22,27],[15,30],[30,26],[30,14],[19,4],[44,18],[19,2],[56,-2],[55,11],[20,-1],[18,-7],[31,-21],[49,-12],[-14,-19],[-135,-71],[-32,1],[-41,20],[-8,-13],[-14,-19],[-18,-12],[-17,7]],[[2422,8884],[-13,-9],[-27,-15],[-23,-18]],[[2359,8842],[-13,25],[27,41],[30,0],[19,-24]],[[2587,9256],[-3,-5],[-1,-2],[1,-5],[-3,-3],[-6,-1],[-9,-1],[-10,13],[-1,12],[5,0],[10,-12],[1,2],[2,7],[3,7],[5,3],[5,-5],[1,-10]],[[2359,8842],[-12,-11],[-27,-3],[-12,-6],[-53,5],[-52,20],[-31,34],[-56,38],[-136,154],[-62,56],[-14,24],[14,0],[11,-3],[10,-7],[9,-12],[166,-115],[38,-59],[26,6],[21,3],[41,-20],[31,0],[30,15],[26,20],[18,9],[15,11],[10,7],[5,13],[16,14],[4,20],[19,17],[15,36],[24,18],[-3,16],[-31,22],[-54,10],[9,21],[36,44],[7,20],[10,66],[25,-19],[23,-31],[16,-34],[7,-28],[25,-16],[59,-26]],[[2582,9171],[37,-82],[45,-106]],[[2664,8983],[-120,-33],[-23,-4],[-24,-9],[-39,-37],[-26,-8],[-10,-8]],[[3394,8984],[0,-6],[-6,-12],[-5,-17],[-8,-13],[-8,-1],[-3,5],[-3,6],[-18,24],[-6,13],[-2,14],[6,6],[40,8],[5,-7],[-12,-17],[-2,-4],[9,6],[4,5],[7,7],[15,13],[3,-5],[-11,-15],[-5,-10]],[[2582,9171],[47,-21],[27,8],[60,-16],[66,-13],[42,-1],[18,28],[27,15],[40,-20],[25,-5],[46,21],[62,-9],[41,13],[41,21],[27,4],[82,1],[20,10],[12,17],[9,21],[11,17],[21,10],[3,-30],[-7,-32],[-3,-33],[23,-55],[1,-31],[-11,-25],[-24,-11],[-9,4],[-22,20],[-12,8],[-17,3],[-85,-5],[-77,-20],[-178,-39],[-72,0],[-152,-43]],[[2768,9978],[-13,15],[12,6],[10,-7],[-9,-14]],[[4066,9165],[-61,-15]],[[4005,9150],[-6,-6],[-6,-9],[-8,-4],[-26,3],[-21,9],[-9,16],[8,25],[-22,54],[-59,108],[-35,45],[-22,18],[-28,11],[-29,1],[-24,-14],[-22,-9],[-31,6],[-76,27],[-24,3],[-51,0],[-15,6],[-37,26],[-23,12],[-24,4],[-102,-9],[-41,-16],[-27,-1],[3,6],[4,2],[10,3],[46,33],[59,12],[121,-2],[119,-30],[69,-6],[29,25],[69,-35],[55,-45],[237,-254]],[[4104,8606],[4,-4],[8,3],[3,-5],[-1,-7],[1,-6],[4,-8],[2,-10],[-4,-36],[-3,-5],[-7,5],[6,33],[-9,25],[-6,5],[-6,0],[-16,-12],[-3,5],[8,8],[19,9]],[[4112,8689],[-3,-1],[2,8],[18,18],[13,13],[10,0],[-3,-11],[-14,-14],[-23,-13]],[[4183,8793],[2,-5],[0,-2],[-3,1],[-4,1],[-2,-2],[3,-3],[1,-1],[-3,-1],[-1,-19],[3,-18],[-7,-7],[-5,0],[-6,0],[-11,6],[-5,18],[-7,11],[-7,8],[2,7],[5,-1],[7,5],[7,8],[10,4],[13,-3],[8,-7]],[[3930,9027],[5,-4],[4,3],[3,-7],[0,-14],[0,-4],[4,-3],[-4,-3],[-11,5],[-2,9],[2,8],[-4,10],[3,0]],[[4450,8606],[-258,-111]],[[4192,8495],[-3,20],[-22,24],[41,67],[-2,15],[-11,19],[-2,111],[19,1],[14,9],[11,15],[9,19],[1,8],[-1,30],[4,11],[8,6],[9,5],[6,4],[13,25],[6,29],[-9,23],[-46,13],[-30,16],[-120,19],[-23,16],[-14,27],[-16,38],[6,10],[1,13],[-3,14],[-15,21],[-7,17],[-4,7],[-7,3]],[[4066,9165],[27,-20],[31,-11],[43,-3],[-12,-17],[-17,-6],[-42,2],[19,-43],[27,-35],[33,-23],[79,-16],[36,-19],[62,-50],[48,-29],[15,-14],[12,-21],[9,-29],[0,-25],[-17,-11],[-4,-11],[0,-71],[4,-26],[12,-16],[17,-11],[21,-6],[-17,-37],[-2,-11]],[[3811,8187],[-8,-18],[-5,0],[-4,8],[-7,6],[-7,8],[1,4],[10,8],[6,11],[5,-1],[9,-26]],[[4450,8606],[3,-18],[6,-10],[7,-8],[3,-8],[1,-13],[2,-6],[-2,-6],[-11,-13],[-10,-10],[-11,-6],[-23,-5],[3,7],[6,23],[-42,-5],[-40,-25],[-36,-35],[-29,-36],[-12,-39],[-11,-121],[2,-30],[-14,-89],[7,-127],[-5,-114],[-46,-50],[-35,20],[-30,45],[-21,49],[-8,33],[-21,21],[-95,23],[-26,38],[21,0],[24,9],[19,16],[15,40],[15,4],[19,3],[16,8],[47,60],[31,28],[33,15],[-9,13],[-5,13],[-2,15],[-1,19],[-5,11],[-11,10],[-10,11],[-2,17],[8,18],[12,14],[11,15],[5,23],[-1,42]],[[3794,8529],[-5,-12],[-40,-48],[8,35],[-7,22],[-9,21],[0,31],[11,-8],[35,-32],[7,-9]],[[3401,7132],[-13,-17],[-16,-7],[-20,0],[-11,1],[-24,1],[1,3],[8,7],[9,5],[8,1],[15,-2],[21,2],[15,10],[10,15],[3,-1],[-6,-18]],[[3428,7596],[2,-14],[-16,1],[-16,21],[-21,42],[-26,33],[-9,19],[9,13],[16,-3],[13,-16],[48,-96]],[[3530,5885],[-119,23],[-140,-17],[-113,-33],[-55,-33],[-36,-77],[-45,-73]],[[3022,5675],[-23,-20],[-16,-22],[-20,-16],[-34,-7],[-26,8],[-162,102],[-78,80],[-24,33],[-16,36],[17,5],[27,14],[24,16],[11,14],[4,22],[10,-2],[12,-10],[10,-4],[14,10],[10,12],[3,14],[-10,18],[17,27],[21,-1],[17,-20],[8,-33],[-2,-28],[-4,-23],[-9,-22],[-12,-20],[-22,-17],[-4,-4],[2,-16],[7,-14],[9,-5],[35,24],[19,6],[11,13],[-4,35],[26,-14],[0,-28],[-7,-33],[4,-28],[21,-15],[13,20],[3,35],[-7,31],[13,-7],[13,-9],[12,-4],[7,9],[-1,22],[-10,16],[-13,13],[-11,14],[-2,9],[3,24],[-1,10],[-8,11],[-20,21],[-8,12],[-5,22],[-4,25],[-8,15],[-18,-8],[13,-13],[5,-25],[-1,-60],[-12,17],[-8,25],[-10,24],[-18,10],[-3,12],[4,27],[12,48],[20,23],[28,26],[20,31],[-5,39],[12,10],[34,7],[7,10],[4,20],[17,38],[4,22],[12,2],[-5,12],[-10,17],[-5,14],[2,12],[7,22],[10,21],[12,9],[10,20],[-3,45],[-12,71],[-14,50],[-27,65],[-17,61],[15,35],[21,-2],[48,-10],[19,-9],[16,-17],[9,-17],[11,-14],[21,-6],[20,9],[19,18],[20,10],[22,-10],[16,-14],[19,-11],[17,-13],[14,-22],[-19,-25],[-3,-28],[10,-26],[21,-18],[-16,-63],[-5,-39],[7,-17],[24,-4],[19,-13],[17,-24],[79,-217],[57,-96],[22,-26],[22,-11],[15,-10],[48,-54],[12,-22],[2,-29],[-2,-38],[-6,-37]],[[3452,5268],[-8,-8],[-23,-7],[-10,0],[-6,5],[-6,3],[-14,-8],[-9,-15],[-12,-43],[-13,-19],[-17,-13],[-66,-37],[-23,-4],[-9,12],[-6,21],[-3,22],[4,15],[12,1],[16,-5],[14,0],[6,15],[13,5],[71,55],[6,3],[21,13],[14,5],[53,0],[-5,-16]],[[3271,5262],[8,-21],[-18,5],[-33,-5],[-19,0],[-15,7],[-15,13],[-5,14],[16,9],[34,8],[33,17],[27,9],[14,-22],[-19,-1],[-9,-13],[1,-20]],[[3392,5400],[-24,-13],[-21,12],[0,22],[19,9],[38,5],[9,-1],[-6,-11],[-15,-23]],[[3607,5440],[0,-14],[-10,-9],[-13,5],[-14,9],[-11,5],[-23,-1],[-14,-6],[-25,-31],[-25,-19],[-17,4],[-6,16],[8,16],[28,16],[24,19],[25,12],[26,7],[21,-1],[9,-6],[10,-10],[7,-12]],[[3530,5885],[-7,-21],[-8,-30],[11,-39],[28,-67],[6,-56],[-11,-41],[-31,-24],[-48,-9],[-20,-7],[-14,-16],[-11,-18],[-13,-13],[-40,-5],[-10,-14],[15,-35],[-15,-17],[-47,-37],[-24,-8],[-45,0],[-15,-8],[-51,-42],[-7,-12],[3,-14],[4,-13],[1,-12],[-8,-10],[-12,-4],[-13,5],[-11,10],[-8,10],[-15,44],[-8,54],[-14,46],[-30,19],[-40,19],[-8,47],[8,108]],[[3528,4938],[-49,-43],[-53,-45]],[[3426,4850],[-19,8],[-1,17],[6,22],[0,19],[-15,19],[-18,12],[-10,10],[8,13],[0,11],[-25,18],[-81,36],[8,12],[9,11],[19,-14],[7,4],[1,12],[0,7],[0,15],[-3,7],[-1,7],[12,15],[13,7],[35,13],[14,13],[6,13],[8,39],[5,13],[44,3],[17,7],[13,13],[4,10],[3,12],[8,19],[19,19],[54,25],[15,21],[36,23],[12,-22],[9,-25],[11,-21],[16,-9],[9,-8],[-13,-19],[-80,-74],[-31,-20],[-40,-8],[0,-11],[23,-2],[10,-12],[-6,-13],[-23,-6],[-5,-7],[13,-14],[32,-23],[21,10],[7,-17],[-4,-29],[-21,-45],[-4,-20],[-7,-17],[-18,-11]],[[3558,4368],[-8,-3],[-4,4],[-7,5],[10,4],[-5,4],[1,10],[17,3],[8,-8],[-5,-9],[-7,-10]],[[3435,4505],[-7,-10],[-6,1],[-12,8],[5,10],[20,-9]],[[4275,4946],[-7,-17],[-7,3],[-10,11],[-5,4],[8,4],[15,3],[6,-8]],[[3528,4938],[24,-8],[20,21],[40,92],[27,34],[13,23],[5,31],[2,40],[4,37],[16,23],[25,-4],[20,-32],[15,-39],[15,-29],[16,-22],[10,-24],[4,-28],[2,-52],[7,-34],[1,-13],[-1,-19],[-7,-30],[-1,-16],[4,-9],[18,-30],[4,-15],[-4,-19],[-9,-12],[-9,-8],[-4,-5],[-14,-7],[-28,-1],[-25,-11],[-5,-40],[45,36],[27,13],[26,-5],[11,-23],[-8,-59],[7,-27],[-22,-56],[-17,-10],[-33,11],[5,-20],[23,-22],[8,-23],[-2,-21],[-8,-23],[-9,-20],[-8,-11],[-40,-16],[-31,15],[-29,23],[-32,10],[22,-30],[0,-14],[-13,-21],[-9,0],[-22,34],[-38,11],[-83,-3],[45,23],[-7,27],[28,-1],[68,-26],[8,29],[13,20],[18,15],[69,37],[20,17],[0,18],[-23,10],[-23,-15],[-22,-22],[-21,-11],[-75,-55],[5,-4],[3,-6],[-31,5],[-31,49],[-26,11],[85,35],[43,29],[6,33],[-18,-22],[-26,-9],[-68,-1],[-19,-4],[-15,-8],[-16,-5],[-16,5],[-11,13],[-7,19],[-19,106],[-2,40],[8,17]],[[5373,4850],[-8,-9],[-20,22],[-24,56],[-21,36],[-16,48],[-13,25],[-5,16],[0,23],[32,-25],[75,-192]],[[5175,5242],[11,-23],[-24,1],[-15,8],[-54,78],[-12,23],[-1,20],[20,-13],[12,-20],[9,-22],[12,-21],[16,-13],[14,-8],[12,-10]],[[4785,5703],[-8,-8],[-13,7],[-8,20],[4,28],[10,6],[9,-14],[4,-9],[2,-11],[0,-19]],[[6382,3977],[20,-36],[-46,17],[-55,12],[-46,19],[-21,38],[44,-4],[56,-17],[48,-29]],[[5816,4372],[11,-20],[14,-16],[16,-9],[20,-5],[28,-2],[-4,-6],[-3,-5],[-3,-5],[-8,-5],[85,-101],[61,-40],[14,-6],[20,-49],[49,-39],[109,-48],[-19,-22],[-29,9],[-58,36],[-66,6],[-25,14],[11,33],[-24,19],[-24,25],[-23,15],[-18,-15],[-45,54],[-49,40],[-54,21],[-64,-7],[0,11],[38,13],[6,3],[-3,15],[-8,14],[1,9],[-14,10],[-10,18],[-3,21],[10,17],[16,-4],[11,5],[9,7],[8,2],[10,-5],[7,-8]],[[4712,7304],[15,1],[11,-5],[-2,-9],[-24,-11],[-25,0],[-16,-14],[-14,-2],[-1,12],[20,15],[16,4],[20,9]],[[4789,7334],[15,-3],[16,-6],[-5,-9],[-14,1],[-35,3],[8,10],[15,4]],[[5379,6937],[-24,-23]],[[5355,6914],[-18,29],[-32,30],[-49,20],[-104,25],[-53,31],[-79,82],[-51,17],[-28,3],[-53,15],[-25,3],[-28,-8],[-45,-28],[-20,4],[32,37],[19,62],[20,118],[-9,0],[44,0],[21,-2],[15,-9],[-15,-24],[-6,-25],[0,-27],[3,-33],[20,30],[15,-15],[11,-30],[12,-17],[25,-8],[164,-141],[48,-30],[60,-16],[60,-2],[22,-7],[20,-18],[28,-43]],[[5586,6433],[-21,12]],[[5565,6445],[15,15],[6,11],[10,91],[-1,33],[-23,73],[-40,39],[-47,26],[-41,36],[-89,145]],[[5379,6937],[39,-60],[78,-85],[81,-67],[39,-29],[17,-21],[7,-31],[-11,-134],[-6,-25],[-1,-14],[-5,-16],[-12,-10],[-12,-7],[-7,-5]],[[5586,6433],[-5,-30],[6,-28],[16,-41],[6,-26],[-6,-75],[-6,-32],[-31,-55],[-7,-22],[-3,-111],[5,-60],[16,-51],[-43,21],[-22,50],[-14,58],[-18,44],[-22,17],[-56,26],[-24,17],[-28,35],[4,15],[21,2],[127,-25],[8,5],[6,10],[6,12],[6,11],[22,24],[6,14],[3,22],[-1,36],[-10,-8],[-15,-26],[-14,-14],[-8,18],[2,40],[11,73],[7,26],[4,6],[7,11],[23,23]],[[6673,5225],[10,-23],[22,-91],[-59,21],[-27,3],[-30,-3],[-59,-13],[-20,-13],[-23,-22],[-32,-3],[-35,25],[-14,33],[28,16],[19,5],[27,15],[26,21],[13,23],[25,0],[11,43],[-5,51],[-27,25],[-38,10],[-27,23],[-69,126],[-10,45],[-25,41],[-6,21],[-7,51],[-22,37],[-34,22],[-43,4],[5,17],[2,19],[-2,20],[-5,19],[-7,19],[-6,7],[-9,5],[-57,56],[-42,23],[-11,9],[-9,14],[-1,12],[6,13],[27,35],[10,5],[20,-2],[8,-7],[35,-37],[34,-15],[15,-10],[15,-18],[10,-101],[7,-30],[13,-17],[21,-21],[19,-25],[16,-49],[36,-74],[72,-117],[23,-21],[51,-31],[24,-23],[32,-75],[8,-12],[14,-11],[57,-70]],[[7769,4916],[-11,-18],[-19,-65],[-1,-14],[-85,-11],[0,11],[22,31],[15,49],[5,55],[-6,49],[1,38],[14,22],[22,15],[26,11],[7,7],[7,8],[8,5],[8,-4],[20,-39],[3,-4],[2,-16],[12,-22],[3,-11],[0,-14],[-7,-31],[-2,-14],[-53,-104],[-4,19],[2,15],[11,32]],[[7356,4382],[-8,-20],[-13,-11],[-28,1],[0,-10],[8,-12],[-23,0],[-31,11],[-16,23],[-23,-12],[-43,-1],[-23,-9],[-5,36],[9,20],[20,11],[30,9],[65,21],[49,0],[16,-9],[29,-23],[-13,-25]],[[6937,4595],[-8,-6],[-8,26],[8,22],[10,3],[4,-8],[1,-17],[-7,-20]],[[7263,3270],[16,-17],[11,-40],[6,-48],[2,-62],[-2,-17],[-8,-7],[-16,6],[-8,11],[-9,54],[-5,-4],[-13,-7],[-8,41],[-37,75],[-13,64],[-13,22],[-43,61],[-14,14],[-16,9],[-148,33],[-32,23],[-17,15],[-92,66],[-21,10],[4,15],[6,14],[8,13],[10,13],[8,0],[13,-23],[37,-20],[13,-22],[-33,5],[-11,5],[9,-19],[13,-15],[16,-9],[15,1],[16,-12],[24,-24],[12,-8],[15,-4],[21,-2],[13,5],[-9,17],[-73,93],[-10,26],[5,43],[11,31],[11,25],[7,25],[-1,38],[-8,42],[-15,38],[-19,24],[-5,-7],[-13,-15],[2,37],[-49,47],[2,35],[-17,5],[-16,7],[-8,12],[6,19],[-26,24],[-10,25],[-8,71],[-27,75],[-12,8],[-9,-4],[-9,-8],[-15,-5],[9,76],[-7,23],[-27,-25],[12,21],[5,7],[8,5],[-16,6],[-11,-11],[-10,-17],[-16,-11],[0,12],[13,16],[10,18],[6,23],[-1,29],[7,-2],[7,-5],[6,-6],[5,-8],[76,-142],[18,-12],[23,-30],[22,-36],[12,-30],[16,-107],[16,-28],[22,-28],[77,-168],[-2,-16],[10,-14],[3,-35],[1,-70],[10,-76],[22,-47],[37,-29],[110,-47],[48,-42],[84,-106],[-6,-8],[-7,-16],[-6,-7]],[[6146,2040],[5,-11],[4,-20],[-9,-12],[-16,-1],[-11,13],[-8,22],[-1,12],[6,2],[8,-3],[8,-7],[-2,10],[-7,27],[4,3],[7,-10],[12,-25]],[[6115,2093],[-5,-2],[-5,4],[2,41],[6,-3],[3,-27],[-1,-13]],[[6096,2213],[0,-14],[-8,6],[2,12],[-2,12],[8,-16]],[[6041,2278],[-3,-9],[-10,14],[-9,24],[-5,22],[5,5],[8,-17],[3,-10],[5,-9],[6,-20]],[[5999,2449],[-9,-1],[-5,11],[0,12],[3,7],[6,-5],[5,-13],[0,-11]],[[7916,2610],[-40,-34],[12,68],[37,45],[47,40],[36,53],[-7,-45],[-37,-65],[-48,-62]],[[8125,2923],[4,-1],[16,2],[5,-1],[3,-5],[6,-18],[25,-9],[47,-4],[27,-8],[-10,21],[29,-7],[77,-35],[-96,-99],[-4,13],[-1,4],[-13,6],[1,26],[-24,-5],[-34,-12],[-95,28],[-14,13],[-21,26],[-7,-18],[-15,-16],[-16,-8],[-7,3],[8,34],[-1,18],[-11,8],[-84,141],[5,5],[2,6],[1,5],[1,6],[15,1],[21,8],[9,2],[15,-5],[37,-28],[13,-4],[28,-2],[13,-5],[36,-33],[4,-13],[1,-28],[4,-12]],[[8613,3465],[97,-11],[72,9],[26,-9],[0,-12],[-116,-26],[-54,1],[-25,48]],[[8884,2632],[-24,-4],[10,42],[16,13],[15,-12],[-17,-39]],[[9063,2649],[-8,-3],[-55,19],[-24,9],[-26,4],[-3,9],[23,3],[22,4],[29,-8],[30,-16],[12,-21]],[[8576,2858],[-30,-61],[-15,-15],[0,16],[-5,12],[-8,9],[-12,5],[4,-22],[11,-20],[14,-10],[15,10],[9,-23],[11,-118],[8,-25],[16,-40],[-22,-6],[-9,-27],[-5,-35],[-8,-29],[-13,-19],[-18,-21],[-20,-18],[-16,-7],[-15,-14],[-43,-95],[-67,-64],[-12,-6],[-14,-2],[-79,-36],[-32,-8],[-20,-21],[-32,-58],[-11,-13],[-34,-35],[-13,-6],[-29,-6],[-23,-14],[-42,-45],[-2,14],[2,56],[6,15],[13,5],[51,-5],[11,6],[39,39],[1,10],[-13,12],[0,10],[25,18],[9,4],[-7,3],[-6,3],[-4,6],[-1,10],[26,12],[38,26],[30,5],[7,5],[14,22],[17,14],[-1,20],[-5,22],[0,14],[24,11],[35,4],[32,9],[14,25],[6,39],[14,18],[23,7],[29,6],[51,22],[36,37],[12,51],[-20,64],[-35,29],[-92,2],[-42,24],[-19,21],[2,6],[16,28],[8,9],[10,6],[10,4],[-8,11],[-19,32],[43,-14],[11,-6],[4,17],[9,14],[12,6],[11,-5],[8,7],[3,2],[6,1],[0,12],[-11,3],[-4,3],[-4,6],[-8,10],[67,-1],[32,6],[35,16],[1,-6],[0,-5],[2,-5],[5,-5]],[[9490,2294],[-22,7],[-13,10],[3,15],[24,21],[-7,11],[-1,8],[8,15],[6,21],[-2,17],[0,14],[14,13],[22,-33],[11,-8],[20,-3],[0,3],[7,7],[11,8],[8,4],[10,-1],[19,-8],[11,-1],[32,-14],[66,-52],[31,-1],[-6,9],[-12,25],[44,-24],[21,-6],[14,8],[20,-18],[20,-10],[24,-4],[30,-1],[8,-4],[11,-11],[17,-23],[12,-10],[25,0],[12,-6],[11,-29],[-6,-31],[-17,-26],[-20,-11],[-23,9],[-60,67],[-27,22],[-20,13],[-23,6],[-33,2],[-14,-2],[-20,-8],[-10,-2],[-15,4],[-9,7],[-6,8],[-11,4],[-28,-7],[-51,-30],[-31,-7],[-14,3],[-8,7],[-7,8],[-7,3],[-49,12]],[[9626,386],[-82,-119],[-42,-139],[-27,-18],[-97,-47],[-56,10],[-16,-6],[-13,-7],[-25,-20],[-9,0],[0,12],[9,8],[-19,17],[-28,4],[-67,-44],[-45,3],[-77,-21],[-57,27],[-83,8],[-18,-3],[-21,-13],[-6,-11],[-7,-14],[-5,-13],[-8,2],[-16,12],[-16,22],[-4,17],[-3,27],[-1,36],[-23,45],[-4,9],[4,11],[39,5],[21,16],[8,34],[3,30],[-15,21],[-14,18],[0,16],[44,-25],[26,12],[23,9],[15,13],[40,14],[10,31],[28,30],[12,29],[28,-8],[26,17],[38,1],[13,0],[13,7],[14,12],[19,31],[11,13],[4,-6],[9,-33],[20,-29],[26,-39],[34,-18],[81,-30],[29,20],[28,16],[65,19],[30,44],[26,62],[64,115],[20,31],[25,18],[28,-14],[9,-27],[-1,-37],[-26,-169],[-11,-44]],[[9614,812],[-12,-2],[-3,17],[4,20],[-9,30],[-17,30],[-5,33],[13,11],[30,12],[24,17],[23,31],[19,16],[12,-9],[16,-23],[14,-14],[26,-15],[25,-14],[12,-15],[-5,-32],[-24,-18],[-49,-6],[-22,-25],[-15,-3],[-44,-25],[-13,-16]],[[1236,4084],[-5,-2],[-24,19],[-3,6],[32,-23]],[[1185,4145],[-2,-1],[-51,65],[7,-5],[33,-39],[13,-20]],[[1009,4401],[2,-11],[-4,6],[2,5]],[[80,4413],[-3,-8],[-4,3],[5,3],[1,1],[0,2],[-1,3],[-9,1],[13,2],[-2,-7]],[[934,4594],[-3,-3],[-3,2],[6,1]],[[9,4804],[-9,-8],[6,9],[5,5],[-2,-6]],[[137,4857],[-9,-4],[5,8],[4,-4]],[[156,4862],[-8,-6],[2,8],[6,-2]],[[235,4903],[0,-9],[-9,2],[9,7]],[[278,4898],[-5,-2],[2,11],[3,-9]],[[373,4932],[1,-2],[0,1],[1,-3],[-2,-1],[-1,1],[-1,2],[2,2]],[[1703,6837],[0,-3],[-2,3],[2,0]],[[1706,6891],[1,-12],[-4,10],[3,2]],[[1702,6904],[0,-3],[-1,2],[1,1]],[[1680,6959],[0,-2],[-3,2],[3,0]],[[1683,6972],[-1,0],[0,1],[1,1],[0,-2]],[[1656,7054],[1,-8],[-5,5],[4,3]],[[1643,7092],[0,-4],[-4,2],[1,5],[3,-3]],[[1632,7124],[0,-2],[-2,1],[1,3],[1,-2]],[[1628,7133],[0,-1],[1,0],[0,-3],[-1,-1],[-1,1],[-1,2],[2,2]],[[1563,7291],[0,-8],[-1,9],[1,-1]],[[1556,7313],[6,-15],[-3,1],[-6,15],[3,-1]],[[1540,7335],[-1,-6],[-12,18],[1,6],[12,-18]],[[1514,7383],[2,-16],[-7,19],[-4,3],[9,-6]],[[1498,7418],[0,-1],[1,-2],[-2,-1],[0,1],[-2,2],[3,1]],[[1506,7553],[0,-1],[-2,0],[1,3],[1,-2]],[[1583,7671],[3,-34],[-3,-13],[-3,7],[-8,-4],[-16,-6],[-3,14],[9,24],[-4,8],[-18,-18],[-9,-14],[-7,-12],[-3,-21],[14,-12],[19,-9],[13,-13],[-5,-8],[-35,6],[-15,0],[-5,7],[4,23],[10,31],[17,33],[25,23],[15,5],[5,-17]],[[2106,7972],[-1,-1],[-2,1],[1,4],[2,-4]],[[2096,7979],[2,-4],[-3,1],[1,3]],[[2050,8003],[0,-1],[1,0],[0,-2],[-1,-1],[-1,1],[0,-1],[-1,3],[2,1]],[[1734,8013],[-2,-2],[0,4],[2,-2]],[[1889,8089],[-1,-1],[-1,5],[2,-4]],[[1790,8091],[-8,-3],[-3,5],[8,2],[3,-4]],[[1821,8112],[-4,-3],[-1,2],[2,4],[3,-3]],[[4538,8919],[2,2],[3,-14],[-1,-18],[-29,-55],[-3,4],[0,6],[3,8],[3,5],[3,-3],[2,0],[-1,7],[3,16],[15,42]]],"transform":{"scale":[0.0007723021651165097,0.0006324791905190471],"translate":[-80.46841386599988,20.91239890900006]}};
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
