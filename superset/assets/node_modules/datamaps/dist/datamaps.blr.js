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
  Datamap.prototype.bhsTopo = '__BHS__';
  Datamap.prototype.bihTopo = '__BIH__';
  Datamap.prototype.bjnTopo = '__BJN__';
  Datamap.prototype.blmTopo = '__BLM__';
  Datamap.prototype.blrTopo = {"type":"Topology","objects":{"blr":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Brest"},"id":"BY.BR","arcs":[[0,1,2,3]]},{"type":"Polygon","properties":{"name":"Gomel"},"id":"BY.HO","arcs":[[4,-2,5,6]]},{"type":"Polygon","properties":{"name":"Mogilev"},"id":"BY.MA","arcs":[[7,-7,8,9]]},{"type":"Polygon","properties":{"name":"Vitebsk"},"id":"BY.VI","arcs":[[-10,10,11,12]]},{"type":"Polygon","properties":{"name":"Grodno"},"id":"BY.HR","arcs":[[13,-4,14,-12]]},{"type":"Polygon","properties":{"name":"Minsk"},"id":"BY.MI","arcs":[[-9,-6,-1,-14,-11],[15]]},{"type":"Polygon","properties":{"name":"City of Minsk"},"id":"BY.HM","arcs":[[-16]]}]}},"arcs":[[[3360,4326],[-1,-16],[-3,-76],[2,-8],[5,-9],[9,-14],[6,-12],[4,-19],[1,-12],[1,-35],[-1,-8],[-2,-8],[-3,-6],[-4,-4],[-4,-4],[-6,-3],[-6,-2],[-43,-1],[-6,-3],[-12,-11],[-8,-10],[-15,-22],[-18,-37],[-7,-21],[-2,-7],[-2,-8],[0,-8],[3,-9],[5,-7],[13,-8],[9,-2],[9,-1],[18,4],[6,-2],[3,-6],[1,-19],[3,-8],[16,-12],[4,-7],[2,-11],[2,-25],[3,-8],[5,-6],[11,-7],[9,-3],[72,-5],[6,-1],[6,-5],[36,-49],[4,-8],[15,-41],[2,-15],[-1,-10],[-5,-4],[-5,-2],[-9,-1],[-43,6],[-13,-2],[-11,-6],[-5,-4],[-4,-4],[-7,-11],[-6,-13],[-7,-20],[-8,-30],[-2,-6],[-5,-8],[-3,-3],[-15,-9],[-3,-6],[0,-10],[3,-14],[9,-24],[44,-89],[5,-13],[1,-7],[0,-9],[1,-7],[2,-9],[8,-25],[-1,-9],[-3,-6],[-26,-24],[-4,-5],[-2,-7],[0,-9],[4,-11],[30,-52],[4,-5],[5,-2],[7,3],[9,11],[3,6],[8,10],[8,9],[4,4],[6,2],[35,0],[3,1],[3,4],[2,6],[1,8],[4,27],[1,9],[2,7],[4,6],[4,3],[31,7],[9,-2],[11,-6],[20,-17],[27,-15],[5,-6],[3,-13],[1,-29],[2,-7],[3,-7],[6,-6],[13,-6],[8,-1],[8,0],[33,14],[6,2],[7,-5],[7,-10],[25,-58],[24,-44],[5,-6],[9,-7],[106,-40],[36,-25],[12,-5],[6,0],[4,2],[5,4],[3,5],[13,23],[4,5],[5,2],[4,-2],[34,-27],[4,-6],[3,-6],[0,-12],[-2,-8],[-6,-13],[0,-9],[1,-10],[34,-65],[9,-9],[8,-6],[36,-9],[55,0],[6,-2],[6,-5],[10,-18],[12,-24],[2,-9],[1,-11],[-1,-19],[-1,-12],[-2,-10],[-3,-6],[-4,-4],[-6,-3],[-124,-7],[-6,-2],[-4,-5],[-3,-7],[-7,-30],[0,-9],[2,-8],[21,-23],[3,-6],[2,-7],[-2,-10],[-3,-6],[-20,-24],[5,-15],[15,-23],[45,-56],[41,-39],[6,-9],[6,-18],[3,-12],[0,-10],[-1,-8],[-2,-8],[-3,-7],[-3,-6],[-18,-25],[-3,-6],[0,-5],[16,-15],[134,-98]],[[4297,2287],[6,-16],[0,-12],[2,-15],[7,-22],[7,-8],[6,-4],[56,-2],[6,-3],[5,-3],[4,-4],[4,-5],[4,-10],[12,-37],[6,-11],[6,-8],[29,-15],[103,-77],[8,-9],[7,-11],[2,-6],[2,-5],[0,-8],[-1,-7],[-4,-17],[-3,-9],[-7,-14],[-3,-6],[-2,-7],[-1,-9],[1,-10],[2,-18],[1,-17],[-2,-54],[2,-25],[2,-101],[1,-14],[3,-6],[3,-6],[20,-23],[14,-20],[26,-25],[3,-5],[3,-6],[3,-5],[1,-9],[-1,-11],[-6,-19],[-5,-11],[-4,-8],[-62,-97],[-2,-9],[-1,-10],[3,-17],[7,-26],[0,-10],[0,-13],[-6,-38],[-8,-34],[-5,-13],[-3,-6],[-7,-11],[-2,-6],[0,-6],[4,-8],[8,-12],[32,-37],[7,-10],[5,-11],[2,-13],[1,-18],[-2,-61],[-2,-21],[-9,-31],[-5,-14],[-6,-10],[-5,-3],[-13,-1],[-10,-32],[3,-156],[0,-11],[0,-1]],[[4549,788],[-36,1],[-20,-12],[-29,-39],[-23,-14],[-22,-2],[-62,13],[-41,-16],[-23,-3],[-14,16],[6,34],[15,44],[3,35],[-31,9],[-25,-4],[-21,3],[-15,18],[-9,40],[1,54],[3,43],[-7,32],[-28,20],[-43,11],[-92,5],[-106,-45],[-69,14],[-198,105],[-230,9],[-15,9],[-13,22],[-2,20],[3,18],[0,15],[-13,7],[-243,13],[-31,16],[-68,73],[-32,8],[-72,-2],[-223,51],[-89,-22],[-142,3],[-205,4],[-176,58],[-48,-2],[-47,-19],[-94,-59],[-294,-57],[-22,1],[-64,19],[-261,-25],[-22,-10],[-23,-28],[-38,-68],[-16,-40],[-25,-132],[-29,-51],[-119,-98],[-156,-170],[-42,-9],[-30,34],[-29,44],[-42,20],[-26,3],[-74,27],[-24,0],[-102,-32],[-13,-8],[-11,-14],[-12,-27],[-1,-16],[6,-16],[28,-98],[3,-20],[-5,-31],[-9,-5],[-10,8],[-4,28],[-14,10],[-17,8],[-13,31],[7,0],[7,0],[-23,48],[-9,28],[-3,30],[5,55],[-1,19],[-12,16],[0,15],[9,2],[7,4],[13,20],[-5,9],[-6,14],[-4,13],[4,6],[10,6],[-2,12],[-8,14],[-3,11],[6,47],[4,22],[4,14],[18,25],[22,16],[20,24],[12,47],[-20,32],[-16,37],[12,16],[4,44],[12,9],[0,9],[-1,3],[-2,0],[-4,2],[7,23],[1,65],[7,38],[19,56],[14,26],[17,15],[-12,35],[-15,76],[-9,26],[-1,23],[-4,23],[-13,11],[-10,5],[-6,13],[-5,17],[-7,16],[-20,14],[-50,-2],[-20,8],[-29,69],[4,7],[3,25],[-4,15],[-17,-20],[-7,9],[-11,11],[-4,9],[-14,-21],[-10,2],[-10,12],[-13,7],[-15,-7],[-3,3],[8,19],[0,12],[-22,3],[-65,29],[-14,17],[-16,-8],[-75,25],[-24,18],[9,36],[-4,26],[-11,20],[-8,8],[-8,8],[-3,1],[49,118],[19,36],[42,61],[127,232],[92,91],[93,64],[175,59],[139,112],[42,61],[14,87],[-2,61]],[[790,3124],[19,4],[139,-13],[11,5],[10,6],[31,32],[24,17],[10,3],[7,-2],[4,-4],[3,-6],[5,-12],[6,-12],[8,-6],[13,-6],[44,-9],[11,1],[44,18],[9,1],[5,-1],[2,-3],[2,-6],[0,-8],[2,-7],[5,-7],[5,-1],[6,2],[5,4],[4,4],[6,5],[26,10],[10,0],[8,-2],[5,-3],[47,-39],[9,-11],[5,-5],[24,-14],[26,-5],[26,2],[23,8],[8,5],[5,4],[2,5],[2,4],[1,7],[0,7],[-1,17],[-2,14],[-5,13],[-8,18],[-2,5],[0,7],[8,18],[9,29],[3,6],[3,5],[23,20],[2,6],[1,7],[0,8],[-2,6],[-3,6],[-11,15],[-3,5],[-1,6],[3,5],[22,30],[3,6],[7,8],[10,9],[25,16],[10,9],[7,8],[2,7],[0,8],[-1,8],[-4,4],[-6,3],[-28,5],[-5,3],[-5,4],[-1,6],[1,6],[4,6],[4,4],[51,35],[14,6],[10,1],[65,-39],[56,-16],[34,1],[11,3],[7,4],[4,6],[2,6],[8,24],[4,9],[9,12],[8,4],[8,1],[27,-8],[11,-6],[10,-8],[7,-10],[3,-6],[5,-12],[4,-13],[4,-14],[1,-7],[0,-8],[0,-7],[-1,-8],[-3,-14],[-1,-7],[2,-5],[4,-3],[44,-22],[13,-2],[6,2],[5,5],[3,7],[8,20],[4,7],[7,9],[7,1],[6,-1],[4,-4],[2,-5],[-1,-6],[-15,-61],[-1,-8],[-1,-7],[1,-7],[6,-10],[1,-7],[-1,-8],[-1,-8],[-1,-8],[-1,-7],[4,-7],[7,-5],[13,-5],[8,1],[6,4],[4,5],[5,4],[42,20],[12,2],[12,-2],[16,-5],[9,0],[8,1],[5,3],[3,5],[17,16],[24,11],[12,2],[9,-1],[2,-7],[2,-15],[3,-6],[3,-5],[10,-8],[16,-8],[16,-5],[9,1],[6,3],[5,4],[4,4],[3,6],[1,7],[0,8],[-1,7],[-4,6],[-17,8],[-4,5],[-3,6],[-1,7],[-2,7],[1,7],[2,6],[4,4],[9,9],[2,5],[0,6],[-2,5],[-17,19],[-3,5],[-3,6],[-1,7],[0,9],[2,9],[6,11],[15,11],[8,2],[9,-2],[8,-5],[22,-2],[16,5],[27,14],[8,11],[5,9],[0,8],[1,7],[2,7],[3,6],[12,15],[6,11],[12,24],[11,19],[7,9],[4,4],[54,37],[7,11],[3,6],[26,88],[33,75],[9,29],[1,8],[1,9],[-1,7],[-1,8],[-2,6],[-5,13],[-3,5],[-11,15],[-4,4],[-6,4],[-21,5],[-5,4],[-2,6],[1,8],[2,7],[4,7],[23,23],[17,15],[9,9],[5,8],[1,8],[0,8],[-1,7],[-3,6],[-4,5],[-20,15],[-4,4],[-2,6],[-1,8],[7,33],[3,10],[6,11],[7,4],[31,4],[7,4],[5,5],[3,7],[1,8],[6,61],[2,13],[1,5],[4,13],[30,60],[5,13],[2,8],[4,9],[6,10],[12,17],[9,7],[8,3],[13,-2],[6,-2],[8,-2],[11,0],[33,9],[10,0],[6,-2],[6,-3],[13,-12],[8,-2],[10,0],[16,5],[11,1],[8,-2],[5,-4],[4,-4],[3,-6],[4,-4],[5,-4],[6,-3],[147,-14],[22,7],[24,2],[55,-16],[90,-6],[26,-10],[22,-13],[6,-2],[28,3],[80,25]],[[8578,3829],[3,-21],[3,-21],[-4,-21],[-10,-14],[-26,-5],[-11,-6],[-52,-98],[-23,-28],[79,-76],[17,-39],[29,-100],[22,-42],[32,-36],[34,-27],[31,-12],[26,-4],[8,-16],[3,-26],[9,-34],[15,-24],[13,-11],[10,-15],[9,-40],[1,-86],[-23,-39],[-71,-47],[0,-1],[12,-31],[46,-74],[32,-82],[13,-25],[38,-39],[14,-22],[-4,-20],[-14,-4],[-38,11],[-16,-2],[4,-7],[13,-25],[-18,-10],[-8,-16],[2,-20],[13,-19],[24,-21],[1,-50],[-6,-60],[-1,-52],[8,-22],[11,-17],[8,-22],[0,-37],[-6,-28],[-11,-25],[-13,-20],[-13,-15],[31,-55],[18,-22],[18,-17],[18,-8],[37,-8],[16,-11],[-11,-17],[-7,-26],[-2,-30],[3,-28],[7,-21],[10,-12],[52,-44],[14,-29],[5,-40],[-3,-60],[-119,-7],[-184,42],[-96,0],[-82,-41],[-21,-33],[-16,-41],[-17,-34],[-25,-12],[-25,11],[-48,49],[-26,18],[-40,6],[-143,-10],[-26,-10],[-17,-22],[7,-34],[-6,-10],[-3,-10],[-2,-10],[-4,-10],[31,-5],[10,-27],[-9,-27],[-27,-2],[-8,12],[-5,3],[-7,-4],[-8,-8],[-8,-12],[-2,-13],[0,-10],[0,-7],[-11,-17],[-11,-15],[-13,-13],[-15,-11],[-30,-14],[0,-7],[3,-13],[5,-8],[0,-14],[-14,-24],[-9,-12],[-9,-6],[-32,4],[-8,-4],[-4,-12],[-1,-19],[-2,-18],[-22,-13],[-7,-14],[-5,-13],[-5,-6],[-3,-7],[-23,-36],[-7,-15],[-4,-6],[0,-8],[8,-19],[1,-32],[-19,-23],[-23,-18],[-13,-18],[21,-13],[8,-1],[0,-15],[-12,-15],[-3,-24],[-1,-25],[-6,-19],[-12,-7],[-32,-1],[-13,-5],[6,-27],[-13,-43],[7,-28],[-7,-9],[-9,-15],[-6,-5],[3,-8],[4,-20],[-13,-7],[-30,-33],[0,-15],[20,-22],[9,-6],[0,-13],[-8,-3],[-4,-3],[-4,-4],[-5,-5],[0,-13],[12,-19],[35,-12],[17,-10],[-8,-23],[-5,-9],[-9,-10],[13,-11],[10,-14],[5,-15],[-6,-16],[5,-25],[9,-15],[11,-9],[11,-6],[0,-15],[-14,3],[-12,-4],[-8,-15],[-2,-25],[4,-25],[8,-4],[11,-1],[13,-12],[4,-14],[11,-57],[5,-11],[7,-12],[1,-10],[-13,-7],[6,-57],[-29,-38],[-32,-28],[-3,-30],[-19,-40],[-3,-4],[-1,-48],[-1,-2],[-4,-12],[-11,-3],[-8,19],[-12,16],[-13,11],[-15,4],[-14,-2],[-17,6],[-23,43],[-15,18],[-15,5],[-32,-1],[-16,8],[-14,15],[-32,51],[-7,21],[3,2],[8,43],[2,16],[0,21],[-1,16],[-3,13],[-6,14],[-14,15],[-52,32],[-15,19],[-39,65],[-30,26],[-30,10],[-146,-4],[-24,-9],[-64,-41],[-13,0],[-16,13],[-11,2],[-14,-12],[-17,-39],[-11,-14],[-19,-6],[-95,19],[-13,22],[-9,31],[-17,37],[-18,15],[-23,4],[-24,-4],[-21,-11],[-22,-24],[-14,-27],[-16,-22],[-24,-12],[-28,-4],[-14,-9],[-10,-24],[-16,-50],[-15,-32],[-21,-1],[-45,23],[-24,-9],[-28,-30],[-13,-14],[-22,-9],[-24,16],[-13,37],[-9,44],[-12,40],[-21,30],[-17,16],[-7,23],[9,53],[-4,53],[-12,33],[-35,64],[-22,74],[-13,25],[-25,19],[-42,13],[-22,-2],[-20,-9],[-21,-24],[-25,-65],[-20,-26],[-27,-12],[-65,-1],[-31,-8],[-33,-22],[-33,-32],[-30,-43],[-20,-56],[-3,-34],[2,-78],[-5,-30],[-19,-26],[-11,21],[-7,38],[-8,25],[-13,2],[-14,-11],[-15,-8],[-17,10],[-10,22],[-7,28],[-17,114],[-2,41],[-9,28],[-27,13],[-94,24],[-29,0],[-27,-12],[-52,-42],[-27,-32],[-13,-9],[-14,7],[-6,16],[-11,56],[-7,21],[-13,18],[-30,23],[-13,15],[-8,23],[-1,18],[0,17],[-4,21],[-15,21],[-22,2],[-23,-14],[-22,-25],[-21,-38],[-34,-78],[-25,-28],[-20,-9],[-103,0],[-19,7],[-19,12],[-64,84],[-22,14],[-24,-5],[-20,-22],[-13,-34],[-7,-41],[1,-26],[2,-22],[1,-22],[-5,-27],[-5,-13],[-49,-80],[-11,-13],[-16,-3],[-15,8],[-17,16],[-14,19],[-5,11],[-2,6],[35,102],[8,51],[-13,42],[-17,12],[-58,2],[-114,55]],[[4297,2287],[67,113],[11,34],[-6,19],[-4,13],[-2,15],[-1,9],[0,10],[1,15],[4,7],[6,3],[29,2],[8,3],[3,6],[6,27],[8,28],[7,10],[8,6],[27,-2],[5,-4],[3,-5],[1,-7],[2,-13],[2,-3],[2,0],[72,73],[10,4],[6,-2],[15,-35],[2,-7],[5,-12],[3,-5],[4,-4],[2,5],[7,21],[8,18],[7,7],[8,2],[6,-2],[3,-5],[1,-8],[0,-8],[-2,-48],[0,-22],[0,-8],[1,-7],[2,-6],[3,-6],[4,-4],[34,-33],[54,-34],[6,-3],[7,-1],[82,3],[35,-9],[116,13],[13,7],[4,6],[5,5],[13,8],[5,5],[3,6],[0,7],[0,8],[-3,31],[-1,7],[-2,6],[-10,22],[0,4],[1,8],[5,9],[12,12],[9,5],[8,2],[89,-23],[12,-6],[3,-4],[4,-4],[1,-2],[5,-20],[10,-24],[9,-17],[8,-4],[12,-3],[216,29],[67,70],[3,5],[2,7],[0,7],[0,16],[-6,60],[-3,40],[2,68],[2,27],[2,9],[6,10],[9,10],[23,16],[10,9],[3,8],[-3,5],[-1,7],[-2,5],[17,24],[4,3]],[[5551,2936],[65,7],[52,-9],[7,0],[8,4],[8,8],[5,7],[6,6],[8,3],[15,-1],[29,-10],[7,0],[7,3],[8,9],[8,6],[10,5],[50,1],[8,3],[9,11],[10,14],[6,4],[9,2],[26,-1],[9,3],[8,9],[4,8],[3,8],[2,7],[0,8],[-2,7],[-4,5],[-5,4],[-26,9],[-5,4],[-4,4],[-2,4],[-1,2],[0,4],[1,6],[3,4],[5,4],[19,13],[148,55],[5,13],[2,7],[2,9],[1,25],[-2,82],[1,8],[5,7],[10,3],[104,3],[7,4],[6,12],[2,9],[2,9],[3,8],[7,5],[21,11],[5,6],[14,23],[24,49],[8,10],[5,4],[9,3],[13,1],[44,-4],[103,-36],[3,-4],[1,-3],[0,-7],[-3,-16],[0,-7],[3,-4],[6,-2],[40,21],[6,7],[2,8],[-1,7],[-3,6],[-8,9],[-2,5],[1,6],[4,5],[6,3],[9,1],[15,-4],[8,-5],[5,-5],[13,-30],[3,-5],[6,-3],[7,-1],[40,28],[8,8],[8,16],[4,5],[6,4],[22,6],[112,-2],[10,-2],[7,-4],[4,-5],[9,-8],[6,-4],[6,-2],[8,0],[9,2],[12,8],[6,7],[4,7],[13,32],[1,4],[0,6],[-2,6],[-4,5],[-43,27],[-9,8],[-3,5],[-8,11],[-8,10],[-30,22],[-4,4],[0,6],[3,6],[21,33],[2,7],[3,7],[0,8],[0,8],[-1,7],[-1,7],[-3,6],[-4,4],[-11,3],[-5,4],[-2,6],[-7,27],[-1,7],[-1,6],[2,6],[2,3],[32,17],[5,8],[1,7],[-4,5],[-12,13],[0,4],[10,2],[90,-10],[6,6],[3,7],[2,6],[-1,6],[-4,4],[-17,10],[-4,5],[-3,5],[3,8],[6,7],[13,10],[6,10],[3,9],[4,33],[-1,7],[-3,5],[-17,19],[-3,5],[-2,5],[4,4],[10,0],[21,-5],[11,0],[8,6],[1,7],[0,7],[-4,14],[-18,49],[-4,13],[-5,28],[-8,27],[-1,6],[-3,15],[-1,15],[1,8],[2,27],[2,8],[2,7],[3,6],[17,18],[13,25],[4,4],[4,4],[5,3],[8,1],[9,-2],[17,-11],[8,-8],[9,-13],[4,-3],[6,-1],[7,4],[9,9],[6,2],[8,-3],[9,-11],[2,-8],[0,-8],[3,-5],[9,-4],[25,1],[11,4],[9,5],[3,5],[12,15],[5,4],[10,6],[7,-1],[8,-3],[9,-11],[9,-15],[9,-6],[41,-18],[12,-7],[7,-8],[1,-16],[1,-7],[2,-6],[8,-3],[35,-3],[12,-3],[11,-9],[4,-8],[4,-14],[16,-60],[4,-12],[7,-6],[11,-4],[50,1],[11,1],[9,19],[16,6],[39,1],[53,27],[19,1],[-4,17],[-2,16],[-1,26],[7,4],[15,2],[4,4],[4,6],[2,7],[3,7],[3,6],[4,4],[7,1],[27,-3],[10,0],[8,3],[10,7],[10,5],[7,1],[114,-35],[17,-15],[7,-17],[8,-6],[13,-5],[30,-7],[24,0],[6,3],[4,4],[4,5],[4,16],[4,6],[4,5],[4,4],[8,-1],[10,-5],[17,-13],[11,-5],[13,0],[14,5],[77,-16],[10,1],[3,6],[1,15],[1,8],[3,7],[3,7],[3,6],[4,4],[5,3],[6,2],[7,0],[88,-11],[4,-1],[3,-4],[2,-8],[2,-7],[2,-25],[2,-6],[4,-8],[14,-23],[3,-10],[1,-9],[0,-7],[0,-8],[0,-7],[2,-7],[2,-6],[5,-5],[7,-4],[15,-4],[9,-5],[5,-9],[2,-8],[6,-9],[8,-10],[18,-16],[4,-10],[1,-8],[-2,-7],[-2,-8],[0,-8],[0,-7],[1,-8],[2,-6],[2,-7],[1,-6],[1,-7],[-1,-7],[-3,-6],[-3,-6],[-13,-14],[-2,-5],[-1,-6],[1,-6],[3,-5],[4,-5],[6,-4],[9,-1],[45,14],[7,-1],[7,-2],[9,-7],[5,-7],[9,-18],[7,-11],[12,-14],[4,-3],[4,0],[5,8],[6,15],[3,5],[4,5],[5,4],[6,1],[7,-1],[8,-7],[5,-7],[7,-12],[4,-5],[26,2],[69,21]],[[8387,6538],[31,-11],[17,-40],[25,-104],[13,-25],[13,-16],[11,-19],[8,-33],[7,-119],[12,-57],[15,-31],[163,-148],[27,-25],[26,-14],[55,-16],[87,-56],[33,-8],[29,-1],[11,-7],[12,-15],[8,-24],[7,-29],[10,-24],[12,-6],[27,21],[5,2],[9,-7],[2,-7],[-1,-9],[24,-108],[-5,-16],[-2,-15],[0,-15],[-2,-16],[-12,-44],[-17,-117],[-18,-51],[-41,-77],[-9,-51],[44,-1],[90,-35],[220,66],[24,-5],[61,-51],[132,-43],[37,-31],[33,-52],[15,-11],[52,3],[22,-4],[20,-15],[20,-29],[7,-15],[3,-16],[-3,-15],[-7,-15],[-78,-46],[-7,-9],[-2,-16],[4,-35],[11,-56],[18,-43],[25,-30],[29,-22],[52,-29],[25,-22],[16,-37],[8,-13],[7,-4],[9,5],[9,12],[18,4],[18,-4],[16,-10],[-3,-17],[-6,-21],[5,-22],[12,-5],[32,14],[13,-1],[19,-46],[-2,-17],[-14,-131],[14,-64],[-21,-18],[-16,1],[-16,10],[-18,4],[-73,-18],[4,-7],[8,-19],[5,-7],[-28,-19],[-34,-8],[-33,4],[-26,17],[-27,-10],[-8,-24],[9,-22],[24,-6],[-10,-39],[-14,-39],[-34,-65],[-19,-24],[-17,-10],[-38,-15],[-34,-36],[-26,-44],[-29,-33],[-54,2],[-6,-8],[-1,-11],[-3,-8],[0,-5],[1,-10],[-2,-10],[-5,-5],[-3,0],[-10,3],[-38,-6],[-27,-24],[-9,-7],[-36,2],[-77,37],[-30,-4],[-27,-17],[-26,-3],[-24,7],[-54,37],[-14,4],[-37,-4],[-11,5],[-17,31],[-11,84],[-14,36],[-19,12],[-46,0],[-20,5],[-64,30],[-21,2],[-21,-8],[-40,-25],[-25,-1],[-50,12],[-50,0],[-39,-37],[-20,-98],[1,-25],[1,-3]],[[5551,2936],[-61,67],[-102,77],[-16,17],[-7,12],[123,147],[22,42],[3,6],[5,14],[2,8],[5,35],[2,8],[6,13],[30,40],[4,7],[4,8],[4,13],[0,10],[-1,7],[-4,5],[-31,25],[-4,7],[-1,6],[2,6],[10,17],[9,19],[18,59],[3,6],[4,3],[4,0],[34,-5],[5,2],[0,5],[-2,5],[-6,11],[-2,7],[-3,7],[-2,9],[-2,14],[0,10],[1,7],[11,51],[1,13],[-1,9],[-21,66],[-2,10],[-2,14],[3,9],[11,17],[0,7],[-3,5],[-5,4],[-7,1],[-18,-3],[-11,-5],[-13,-12],[-10,-6],[-39,-6],[-8,11],[-8,20],[-11,55],[-8,22],[-8,12],[-37,6],[-6,-1],[-4,-4],[-3,-6],[-3,-7],[-6,-23],[-3,-6],[-3,-4],[-4,1],[-32,21],[-13,6],[-37,5],[-8,3],[-7,6],[-20,41],[-8,9],[-6,5],[-23,12],[-43,12],[-9,7],[-4,11],[-7,33],[-3,8],[-16,37],[0,9],[3,6],[31,19],[11,4],[20,2],[7,-2],[16,-9],[10,-9],[8,-9],[27,-42],[4,-2],[5,1],[5,9],[7,2],[7,2],[121,-10],[7,1],[4,3],[4,6],[2,7],[2,8],[3,6],[4,5],[6,2],[51,9],[7,3],[5,5],[5,12],[0,8],[-2,7],[-8,18],[-7,18],[-5,9],[-7,6],[-56,26],[-6,5],[-5,7],[-1,8],[1,8],[2,7],[2,6],[29,35],[3,6],[2,7],[2,8],[2,12],[2,62],[-3,46],[1,32],[10,24],[13,24],[10,17],[16,18],[5,4],[5,3],[13,2],[15,-1],[21,-6],[5,0],[6,2],[7,11],[4,4],[5,4],[34,14],[6,3],[6,6],[1,7],[-3,5],[-6,3],[-15,4],[-7,4],[0,4],[4,3],[42,12],[6,3],[5,5],[4,8],[5,13],[1,10],[0,8],[-5,14],[-3,10],[-3,17],[1,10],[2,8],[4,7],[4,6],[7,6],[7,2],[7,-1],[11,-6],[20,-16],[23,-12],[95,-21],[6,1],[6,3],[13,12],[6,2],[7,0],[7,-1],[5,-4],[5,-4],[7,-10],[5,-11],[4,-4],[5,0],[13,18],[5,3],[5,0],[4,-3],[3,-6],[0,-7],[-1,-9],[-4,-9],[-5,-11],[-2,-8],[0,-7],[13,-22],[19,-49],[4,-5],[4,-5],[6,-1],[37,-3],[7,1],[6,4],[1,5],[-1,6],[-8,35],[0,9],[0,9],[2,12],[0,10],[0,9],[-2,8],[-1,10],[4,4],[6,2],[94,9],[7,4],[7,6],[9,12],[4,10],[2,9],[-1,8],[-2,7],[-9,25],[-2,9],[-1,13],[2,9],[4,7],[41,47],[9,8],[5,2],[6,2],[6,-2],[11,-6],[20,-4],[5,-4],[4,-5],[4,-5],[4,-5],[5,-4],[13,-4],[7,0],[12,3],[81,52],[18,17],[10,15],[12,24],[8,12],[4,5],[5,3],[6,2],[6,1],[6,-2],[5,-4],[3,-5],[7,-11],[4,-6],[5,-3],[6,-1],[8,5],[4,9],[2,14],[4,7],[5,5],[13,7],[9,8],[3,7],[-1,6],[-5,4],[-14,4],[-6,3],[-5,4],[-3,7],[-1,9],[2,6],[4,5],[33,16],[15,10],[13,16],[12,18],[5,11],[1,9],[-4,4],[-19,4],[-4,4],[-8,10],[-5,4],[-5,2],[-6,0],[-18,-5],[-6,1],[-4,4],[-7,11],[-5,4],[-6,2],[-21,2],[-6,2],[-3,3],[2,4],[4,4],[23,14],[9,8],[4,8],[1,8],[0,8],[-2,6],[-4,2],[-5,-2],[-20,-13],[-6,-1],[-5,1],[-4,7],[1,6],[3,6],[10,10],[14,19],[1,8],[-2,6],[-24,13],[-4,6],[-2,12],[3,10],[7,12],[1,8],[-1,6],[-3,5],[-1,4],[0,4],[1,30],[0,50],[-2,15],[-3,13],[-7,18],[-7,11],[-3,7],[-2,9],[0,14],[1,6],[2,7],[10,23],[4,7],[4,4],[16,10],[8,9],[11,17],[19,22],[9,13],[3,9],[1,9],[0,7],[-1,8],[-2,6],[-2,7],[-3,5],[-9,10],[-3,6],[-2,10],[2,7],[3,6],[6,3],[7,2],[7,5],[3,7],[1,8],[1,75],[-2,35],[2,6],[4,4],[22,16],[7,8],[1,7],[-2,6],[-4,4],[-3,5],[-2,7],[0,25],[-2,6],[-6,4],[-20,7],[-6,4],[-3,6],[-2,18]],[[6540,6087],[41,34],[14,16],[3,7],[10,33],[5,6],[5,3],[19,4],[29,9],[5,8],[7,23],[9,20],[8,8],[7,4],[14,0],[15,-4],[61,-30],[15,-2],[30,8],[16,-2],[93,17],[25,9],[4,4],[3,5],[2,4],[-3,5],[-15,12],[-3,5],[1,8],[6,9],[6,4],[7,0],[40,-15],[6,-3],[3,-6],[1,-6],[-1,-14],[0,-6],[3,-6],[13,-13],[4,-5],[1,-6],[-3,-12],[1,-6],[7,-5],[13,-3],[40,-2],[9,-4],[1,-6],[-2,-15],[6,-7],[13,-4],[30,-2],[15,2],[9,4],[3,6],[3,7],[1,7],[0,8],[-1,7],[-2,6],[-2,7],[-3,5],[-4,13],[-2,7],[-3,30],[2,7],[5,8],[35,25],[8,10],[6,13],[2,7],[1,6],[2,7],[3,8],[7,10],[7,3],[8,1],[6,-3],[4,-4],[1,-6],[-2,-5],[-8,-8],[-2,-5],[3,-5],[37,-26],[14,-15],[8,-5],[7,0],[5,3],[4,6],[2,7],[2,19],[3,10],[5,2],[24,-6],[20,-1],[11,2],[8,2],[50,41],[8,1],[3,-3],[-1,-6],[-11,-27],[-3,-8],[-5,-14],[-7,-12],[-26,-37],[-3,-5],[-2,-6],[1,-6],[3,-6],[4,-4],[4,-3],[60,-15],[18,1],[21,11],[29,22],[4,5],[3,6],[2,6],[1,15],[2,8],[5,9],[7,2],[6,-1],[5,-4],[4,-5],[5,-12],[17,-41],[2,-3],[14,-18],[18,-18],[15,-9],[16,-4],[10,0],[7,1],[32,18],[5,4],[9,9],[8,10],[3,6],[3,7],[6,24],[2,7],[3,7],[4,5],[14,12],[3,5],[3,6],[-1,7],[-2,6],[-22,23],[-4,5],[-1,6],[0,8],[2,7],[7,6],[10,6],[46,17],[5,5],[4,6],[2,15],[4,8],[7,7],[19,12],[11,4],[10,1],[6,-2],[41,-23],[53,-12],[70,-2],[22,3],[6,3],[4,4],[3,5],[0,7],[-1,6],[-2,7],[1,7],[3,9],[11,10],[11,4],[9,1],[7,-3],[27,-19],[37,-13],[20,-14],[11,-9],[6,-4],[10,-3],[6,3],[3,6],[0,7],[-1,7],[-2,6],[-4,13],[-1,6],[1,7],[6,5],[9,5],[26,9],[8,4],[23,22],[8,4],[10,0],[23,-5],[16,1],[7,2]],[[6540,6087],[-33,-13],[-6,1],[-8,3],[-5,7],[-6,11],[-3,8],[-1,9],[3,44],[1,7],[2,8],[3,6],[3,5],[32,30],[4,6],[4,8],[5,13],[0,8],[-2,8],[-21,38],[-7,8],[-5,4],[-10,11],[0,5],[1,3],[7,7],[4,7],[4,9],[3,15],[4,8],[4,5],[6,2],[7,21],[7,37],[14,171],[2,7],[6,12],[4,7],[8,9],[4,7],[4,8],[4,13],[1,9],[-2,7],[-15,22],[-4,8],[1,7],[2,6],[15,20],[36,37],[4,8],[0,11],[-7,43],[-6,12],[-7,8],[-13,4],[-6,-1],[-4,-4],[-1,-6],[1,-24],[-1,-8],[-1,-8],[-3,-7],[-3,-6],[-5,-4],[-6,-2],[-6,-1],[-29,7],[-25,11],[-15,3],[-6,-1],[-11,-5],[-10,-7],[-28,-24],[-5,-2],[-6,1],[-21,12],[-12,3],[-36,1],[-5,2],[-2,6],[0,8],[1,18],[0,14],[-1,18],[-7,34],[-6,13],[-8,6],[-6,-1],[-6,-2],[-22,-11],[-24,-8],[-7,-1],[-6,2],[-6,5],[-2,7],[1,7],[3,5],[9,9],[2,6],[-3,1],[-6,0],[-22,-9],[-21,-13],[-4,-5],[-4,-5],[-15,-32],[-4,-5],[-5,-4],[-4,-3],[-19,-6],[-29,0],[-136,28],[-5,-1],[-5,-3],[-3,-6],[-4,-23],[-4,-14],[1,-7],[2,-6],[18,-26],[2,-5],[-1,-7],[-2,-6],[-9,-20],[-4,-5],[-4,-4],[-12,-4],[-15,-2],[-10,2],[-3,6],[-1,7],[0,10],[-1,8],[-3,10],[-6,5],[-7,2],[-46,7],[-7,-1],[-5,-3],[-12,-15],[-4,-4],[-5,-3],[-6,-2],[-6,1],[-63,25],[-7,8],[-5,7],[-5,21],[-1,7],[0,8],[1,8],[2,7],[15,32],[0,11],[-2,12],[-13,23],[-8,9],[-6,1],[-4,-4],[-22,-32],[-5,-5],[-6,-4],[-7,-1],[-4,4],[-2,6],[-3,14],[-2,8],[-3,8],[-5,10],[-6,2],[-6,0],[-83,-29],[-5,-4],[-3,-5],[-3,-7],[-11,-38],[-2,-7],[-5,-15],[-2,-8],[-33,-103],[-4,-7],[-9,-4],[-19,2],[-41,23],[-7,9],[-5,12],[-1,7],[-3,9],[-6,9],[-12,15],[-36,24],[-8,10],[-7,10],[-7,18],[-2,7],[-5,10],[-5,11],[-15,17],[-7,7],[-8,4],[-29,2],[-51,-11],[-23,-9],[-24,-20],[-4,-5],[-7,-3],[-9,-2],[-48,15],[-7,1],[-114,-39],[-17,-2],[-4,4],[-2,7],[-1,8],[0,17],[-1,9],[-3,10],[-5,5],[-14,5],[-6,2],[-6,-1],[-5,-3],[-19,-26],[-4,-5],[-12,-2],[-18,1],[-59,20],[-7,8],[-3,9],[-8,13],[-25,24],[-9,11],[-4,11],[-1,9],[-4,12],[-15,19],[-6,11],[-1,10],[5,13],[5,14],[4,16],[1,9],[0,8],[-6,10],[-11,12],[-54,39],[-101,19],[-8,6],[-3,8],[2,8],[5,24],[1,8],[0,8],[-2,7],[-3,6],[-82,77],[-3,4],[-6,14],[-9,14],[-10,11],[-8,4],[-8,2],[-57,-7],[-21,2],[-6,5],[-3,6],[-1,8],[0,16],[-1,8],[-2,7],[-2,6],[-5,12],[-19,35],[-8,11],[-28,24],[-3,6],[-1,6],[2,6],[28,45],[2,7],[1,7],[-3,9],[-6,10],[-14,15],[-10,5],[-8,2],[-57,-16],[-75,24],[-10,1],[-33,-29],[-3,-5],[0,-7],[1,-7],[6,-21],[1,-7],[0,-8],[-1,-7],[-3,-5],[-5,-4],[-12,-4],[-79,-5],[-42,4],[-7,4],[-5,5],[-7,13],[-14,21],[-8,5],[-8,3],[-106,-20],[-12,-6],[-32,-29],[-13,-7],[-12,-2],[-6,2],[-5,4],[-6,15],[-5,9],[-12,14],[-9,6],[-9,4],[-32,2],[-24,-2],[-9,-3],[-3,-2],[-5,-10],[-5,-9],[-10,-7],[-10,-5],[-16,-1],[-10,4],[-8,6],[-10,10],[-10,4],[-57,-4],[-30,5],[-22,9],[-39,24],[-11,3],[-7,-1],[-6,-4],[-5,-8],[-3,-9],[-1,-10],[1,-9],[2,-8],[1,-6],[0,-5],[-4,-6],[-4,-4],[-10,-9]],[[3331,7534],[-16,12],[-11,-3],[-10,-4],[-23,-27],[-6,-5],[-8,-2],[-8,3],[-8,8],[-9,23],[-6,37],[0,11],[-8,11],[-7,5],[-63,27],[-3,5]],[[3145,7635],[18,32],[39,93],[4,18],[2,24],[-1,50],[3,24],[33,57],[47,10],[116,-34],[9,0],[10,4],[7,8],[6,12],[9,10],[15,2],[110,-55],[23,4],[16,30],[12,59],[7,56],[7,22],[17,25],[30,33],[16,11],[41,12],[27,8],[25,21],[11,33],[-9,34],[-24,21],[-174,34],[-63,-19],[-18,1],[-62,26],[-17,12],[-4,21],[10,38],[25,52],[7,19],[14,76],[9,22],[37,42],[3,23],[-19,43],[4,49],[21,37],[25,32],[21,36],[10,45],[2,53],[-4,55],[-9,48],[22,43],[25,15],[28,-3],[56,-25],[24,2],[84,47],[20,27],[60,121],[61,81],[22,16],[2,1],[136,19],[43,-8],[22,-14],[66,-60],[28,-18],[21,10],[49,52],[21,28],[26,-34],[33,-21],[34,-11],[132,-14],[29,4],[10,32],[9,43],[7,97],[29,90],[104,75],[16,31],[18,35],[5,49],[32,37],[72,59],[12,27],[10,25],[10,22],[16,19],[13,7],[44,10],[44,24],[29,22],[18,14],[45,19],[39,-29],[22,-35],[72,-87],[33,-49],[21,-24],[22,-8],[24,16],[34,58],[25,19],[154,19],[60,-11],[18,-8],[9,-11],[17,-35],[37,-57],[9,-21],[10,-48],[5,-48],[12,-41],[27,-27],[80,-24],[23,6],[2,47],[28,32],[66,31],[0,1],[61,43],[52,22],[61,-2],[59,-23],[50,-41],[33,-28],[160,-49],[19,-13],[18,-20],[20,-28],[10,-18],[3,-17],[-4,-13],[-7,-2],[-8,1],[-9,-4],[-10,-8],[-9,-4],[-8,-7],[-8,-17],[-3,-18],[-6,-50],[-4,-21],[-24,-68],[-5,-32],[7,-43],[14,-29],[51,-49],[51,-82],[20,-12],[29,8],[81,107],[103,66],[28,7],[72,-20],[27,15],[41,84],[26,36],[40,26],[42,10],[42,-3],[124,-50],[27,10],[47,49],[24,14],[19,-6],[35,-35],[20,-15],[207,-75],[9,-12],[1,-17],[-6,-17],[-3,-17],[12,-17],[93,-50],[11,-10],[8,-13],[4,-25],[-3,-19],[-5,-16],[0,-19],[13,-29],[21,-16],[24,-6],[42,4],[15,-8],[10,-20],[10,-32],[31,-66],[29,-5],[35,22],[46,17],[40,-21],[22,-46],[6,-13],[7,-75],[-21,-72],[16,-12],[5,-2],[-6,-26],[-28,-23],[-6,-34],[8,-37],[17,-25],[14,-27],[0,-40],[-13,-24],[-63,-51],[-36,-57],[-15,-38],[-3,-38],[10,-26],[18,-17],[37,-22],[14,-24],[18,-76],[14,-25],[49,-42],[13,-18],[2,-8],[-5,-18],[2,-11],[4,-3],[11,-4],[2,-3],[5,-10],[5,-7],[1,-11],[-5,-21],[-8,-14],[-3,-14],[3,-15],[8,-16],[14,-39],[13,-50],[-1,-39],[-26,-9],[-49,14],[-21,-2],[-7,-25],[10,-33],[16,-22],[4,-25],[-19,-39],[-19,-15],[-64,-15],[-24,-22],[2,-22],[11,-30],[-2,-51],[-16,-33],[-24,-28],[-20,-36],[-6,-57],[8,-32],[16,-14],[44,-16],[160,-133],[16,-32],[3,-38],[23,5],[88,-11],[25,-57],[41,-38],[-30,-79],[-52,-95],[-26,-89],[30,-26],[78,-25],[12,-28]],[[3331,7534],[-9,-11],[-19,-11],[-4,-4],[-2,-6],[1,-8],[14,-28],[7,-21],[2,-18],[-2,-41],[1,-15],[7,-16],[6,-12],[10,-13],[11,-11],[13,-9],[12,-7],[11,-3],[15,-2],[6,-4],[24,-31],[56,-97],[5,-7],[8,-4],[21,-10],[6,-4],[2,-5],[3,-13],[1,-13],[-6,-30],[0,-13],[2,-16],[4,-11],[13,-30],[10,-28],[5,-11],[5,-10],[4,-9],[3,-11],[3,-17],[4,-9],[5,-5],[20,-8],[18,-13],[7,-2],[8,3],[26,15],[5,0],[2,-8],[0,-15],[-4,-35],[2,-21],[4,-14],[4,-9],[0,-9],[-7,-11],[-6,-3],[-7,0],[-6,2],[-5,1],[-4,-6],[-3,-10],[-1,-54],[-2,-12],[-6,-5],[-7,0],[-8,5],[-32,24],[-4,1],[-3,0],[-1,-4],[0,-5],[5,-16],[0,-6],[1,-21],[3,-11],[5,-11],[10,-19],[3,-14],[3,-19],[-2,-32],[-2,-20],[-7,-15],[-5,-6],[-19,-16],[-4,-5],[-3,-7],[-12,-48],[-65,-195],[-20,-49],[-13,-24],[-41,-48],[-11,-17],[-3,-4],[-5,-4],[-5,-3],[-116,-25],[-50,11],[-15,-1],[-18,-6],[-61,-61],[-5,-3],[-6,-2],[-7,-1],[-29,3],[-6,-1],[-3,-5],[-3,-6],[-18,-58],[-9,-50],[0,-8],[1,-7],[6,-6],[6,-5],[29,-15],[6,-1],[4,2],[3,6],[5,23],[3,7],[3,4],[5,2],[5,-1],[23,-12],[5,-5],[3,-6],[-1,-13],[-5,-28],[-3,-70],[0,-16],[2,-12],[5,-15],[11,-26],[9,-9],[8,-4],[66,12],[6,3],[4,4],[3,6],[0,9],[-1,12],[5,6],[7,1],[47,-7],[6,-3],[4,-14],[12,-64],[7,-17],[7,-8],[62,-2],[5,-11],[2,-18],[-5,-46],[-5,-19],[-6,-12],[-37,-10],[-5,-3],[-5,-5],[-3,-5],[-6,-13],[-11,-36],[-5,-14],[-6,-12],[-4,-5],[-8,-9],[-10,-7],[-11,-6],[-72,-25],[-20,-14],[-4,-4],[-3,-6],[-2,-10],[-1,-14],[-1,-38],[1,-12],[7,-10],[12,-9],[72,-35],[5,-4],[3,-6],[-3,-11],[-2,-7],[-4,-8],[-3,-6],[-4,-4],[-6,-3],[-22,1],[-7,-1],[-4,-9],[-2,-15],[0,-31],[-3,-27],[1,-9],[5,-11],[4,-7],[8,-11],[14,-13],[11,-6],[36,-6],[6,-3],[4,-4],[2,-8],[2,-12],[-2,-21],[0,-15],[1,-14],[6,-15],[5,-8],[6,-5],[66,-23],[44,-27],[4,-5],[3,-6],[6,-11],[2,-9],[2,-9],[3,-35],[1,-7],[5,-13],[16,-29],[5,-11],[8,-24],[-1,-12],[-4,-18],[-15,-36],[-3,-22],[1,-12],[5,-4],[3,-1],[5,0],[24,6],[6,0],[5,-3],[4,-3],[1,-2],[2,-2],[1,-6],[1,-7],[0,-12],[0,-10],[-6,-65],[0,-16],[2,-15],[3,-14],[4,-13],[5,-13],[6,-11],[7,-10],[-9,-7],[-192,-75]],[[790,3124],[-9,246],[-3,15],[-4,11],[-3,12],[-1,22],[3,16],[11,27],[3,13],[0,16],[-9,56],[0,13],[2,25],[-1,15],[-12,30],[-32,48],[-9,35],[1,39],[10,28],[13,25],[10,29],[2,49],[-11,25],[-18,16],[-19,24],[-12,31],[-8,30],[-11,29],[-18,29],[-19,58],[-42,192],[-21,64],[-49,119],[-89,316],[-25,142],[-2,125],[-26,43],[-11,42],[-9,108],[-11,51],[-14,47],[-11,49],[-1,60],[36,-11],[94,-65],[18,-8],[16,2],[52,25],[65,11],[18,15],[17,8],[7,-2],[19,-13],[8,-3],[9,2],[80,53],[15,3],[17,-8],[30,-23],[18,-4],[67,1],[31,10],[64,40],[35,7],[33,-13],[29,-41],[18,-59],[11,-19],[20,-5],[36,2],[33,-11],[38,-1],[38,22],[120,124],[52,35],[67,15],[25,22],[4,1],[4,-2],[4,-2],[13,-40],[16,-18],[19,-1],[68,13],[18,11],[13,35],[1,0],[2,56],[-9,38],[-15,35],[-12,44],[-5,31],[2,7],[7,0],[9,14],[20,14],[0,8],[-1,13],[0,16],[4,12],[31,22],[5,3],[49,6],[48,-7],[82,-37],[47,9],[46,33],[43,55],[17,43],[21,95],[14,27],[18,3],[67,-27],[86,6],[25,19],[42,70],[27,14],[13,-3],[7,-8],[5,-11],[74,-115],[-9,-8],[-25,3],[-21,-14],[-3,-20],[26,-16],[5,-17],[-7,-15],[-30,-12],[-8,-14],[8,-37],[24,-26],[28,-16],[93,-17],[23,1],[11,7],[16,26],[12,6],[39,-6],[12,2],[24,21],[9,32],[1,93],[3,9],[12,19],[3,9],[-3,12],[-5,5],[-6,2],[-4,7],[-7,22],[-8,19],[-9,15],[-10,12],[-5,2],[-12,-5],[-4,1],[-4,8],[-12,36],[-3,20],[-6,16],[-14,10],[-16,-5],[-62,-38],[-46,-3],[-23,10],[-14,26],[2,51],[19,44],[48,66],[19,44],[4,39],[-1,43],[5,53],[11,41],[16,24],[64,43],[20,24],[15,31],[5,41],[-6,39],[-26,72],[-7,40],[1,26],[5,20],[5,19],[5,21],[1,21],[-3,104],[3,27],[11,18],[23,23],[10,6],[7,0],[6,4],[4,17],[0,17],[-9,41],[-2,18],[11,38],[21,24],[24,21],[22,29],[7,21],[1,18],[4,16],[13,11],[39,19],[19,0],[38,-10],[20,-1],[127,29],[38,25],[15,19],[18,30]],[[4733,5595],[-41,19],[-11,2],[-34,15],[-42,10],[-65,10],[-66,-15],[-34,-25],[-23,-66],[-11,-87],[-5,-56],[0,-61],[13,-55],[42,-11],[57,-30],[40,-15],[18,-41],[24,-10],[28,40],[71,11],[39,5],[26,-10],[50,-6],[45,11],[28,50],[-10,51],[-34,31],[-13,66],[5,51],[29,61],[31,40],[-2,71],[-29,11],[-29,-31],[-29,-20],[-42,-16],[-26,0]]],"transform":{"scale":[0.0009554842609260999,0.0004922129785978539],"translate":[23.165644979000035,51.235168356000145]}};
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
