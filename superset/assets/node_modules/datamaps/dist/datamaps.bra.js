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
  Datamap.prototype.blrTopo = '__BLR__';
  Datamap.prototype.blzTopo = '__BLZ__';
  Datamap.prototype.bmuTopo = '__BMU__';
  Datamap.prototype.bolTopo = '__BOL__';
  Datamap.prototype.braTopo = {"type":"Topology","objects":{"bra":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Goiás"},"id":"BR.GO","arcs":[[0,1,2,3,4,5,6]]},{"type":"MultiPolygon","properties":{"name":"São Paulo"},"id":"BR.SP","arcs":[[[7]],[[8]],[[9]],[[10]],[[11,12,13,14,15]]]},{"type":"MultiPolygon","properties":{"name":"Pernambuco"},"id":"BR.PE","arcs":[[[16]],[[17,18,19,20,21,22]]]},{"type":"Polygon","properties":{"name":"Acre"},"id":"BR.","arcs":[[23,24,25]]},{"type":"Polygon","properties":{"name":"Amazonas"},"id":"BR.AM","arcs":[[26,27,28,-26,29,30]]},{"type":"MultiPolygon","properties":{"name":"Maranhão"},"id":"BR.MA","arcs":[[[31]],[[32]],[[33]],[[34]],[[35]],[[36]],[[37]],[[38,39,40,41]]]},{"type":"MultiPolygon","properties":{"name":"Pará"},"id":"BR.PA","arcs":[[[42]],[[43]],[[44]],[[45]],[[46]],[[47]],[[48]],[[49]],[[50]],[[51]],[[52]],[[53]],[[54]],[[55]],[[56]],[[57]],[[58]],[[59]],[[60,61,-41,62,63,-27,64,65]]]},{"type":"Polygon","properties":{"name":"Rondônia"},"id":"BR.","arcs":[[66,67,-24,-29]]},{"type":"Polygon","properties":{"name":"Tocantins"},"id":"BR.TO","arcs":[[68,69,-7,70,-63,-40]]},{"type":"Polygon","properties":{"name":"Distrito Federal"},"id":"BR.DF","arcs":[[-3]]},{"type":"Polygon","properties":{"name":"Mato Grosso do Sul"},"id":"BR.MS","arcs":[[-5,71,-15,72,73,74]]},{"type":"Polygon","properties":{"name":"Minas Gerais"},"id":"BR.MG","arcs":[[75,76,-16,-72,-4,-2,77]]},{"type":"Polygon","properties":{"name":"Mato Grosso"},"id":"BR.MT","arcs":[[-71,-6,-75,78,-67,-28,-64]]},{"type":"Polygon","properties":{"name":"Rio Grande do Sul"},"id":"BR.RS","arcs":[[79,80]]},{"type":"MultiPolygon","properties":{"name":"Paraná"},"id":"BR.PR","arcs":[[[81]],[[82]],[[83,84,85,-73,-14]]]},{"type":"MultiPolygon","properties":{"name":"Santa Catarina"},"id":"BR.SC","arcs":[[[86]],[[87]],[[88,-81,89,-85]]]},{"type":"Polygon","properties":{"name":"Ceará"},"id":"BR.CE","arcs":[[90,91,-22,92,93]]},{"type":"Polygon","properties":{"name":"Piauí"},"id":"BR.PI","arcs":[[-93,-21,94,-69,-39,95]]},{"type":"Polygon","properties":{"name":"Alagoas"},"id":"BR.AL","arcs":[[96,97,98,-19]]},{"type":"MultiPolygon","properties":{"name":"Bahia"},"id":"BR.BA","arcs":[[[99]],[[100]],[[-99,101,102,103,-78,-1,-70,-95,-20]]]},{"type":"MultiPolygon","properties":{"name":"Espírito Santo"},"id":"BR.ES","arcs":[[[104]],[[105]],[[106]],[[-104,107,108,-76]]]},{"type":"Polygon","properties":{"name":"Paraíba"},"id":"BR.PB","arcs":[[109,-23,-92,110]]},{"type":"MultiPolygon","properties":{"name":"Rio de Janeiro"},"id":"BR.RJ","arcs":[[[111]],[[112,-12,-77,-109]]]},{"type":"MultiPolygon","properties":{"name":"Rio Grande do Norte"},"id":"BR.RN","arcs":[[[-111,-91,113]],[[114]],[[115]]]},{"type":"Polygon","properties":{"name":"Sergipe"},"id":"BR.SE","arcs":[[116,-102,-98]]},{"type":"Polygon","properties":{"name":"Roraima"},"id":"BR.RR","arcs":[[-65,-31,117]]},{"type":"MultiPolygon","properties":{"name":"Amapá"},"id":"BR.AP","arcs":[[[118]],[[119]],[[120]],[[121]],[[-61,122]]]}]}},"arcs":[[[6154,5369],[3,-5],[3,-4],[27,-22],[4,-4],[1,-3],[0,-1],[1,-1],[-1,-2],[0,-2],[-2,-2],[-1,-1],[-1,-1],[-2,-1],[-13,-10],[-1,-1],[-1,-2],[-1,-2],[-4,-29],[0,-9],[0,-4],[1,-2],[5,-3],[16,-6],[1,-1],[0,-1],[1,-1],[0,-1],[0,-7],[-1,-4],[-1,-4],[0,-2],[-1,-2],[-2,-2],[-7,-6],[-5,-4],[-8,-4],[-2,-4],[-4,-12],[-4,-19],[-5,-13],[-2,-12],[-2,-3],[0,-2],[-1,-24],[4,-30],[8,-33],[10,-17],[2,-2],[9,-29],[0,-1],[1,-1],[1,-1],[12,-7],[1,-2],[5,-5],[6,-12],[1,-1],[0,-1],[10,-6],[6,-2],[1,-1],[0,-1],[1,0],[1,-2],[0,-2],[0,-3],[-4,-12],[-6,-12],[0,-3],[0,-3],[0,-6],[0,-6],[2,-5],[0,-1],[2,-5],[4,-10],[1,-6],[2,-6],[1,-7],[-1,-4],[-1,-4],[-1,-3],[-2,-3],[-5,-6],[-4,-6],[-11,-19]],[[6201,4838],[-6,-4],[-2,-3],[-2,-4],[-2,-3],[-2,-2],[-2,-1],[-1,1],[-4,1],[-2,0],[-3,0],[-9,-2],[-2,0],[-1,0],[-4,3],[-1,1],[-1,1],[-5,0],[-7,0],[-3,1],[-1,0],[-1,1],[-4,15],[-1,2],[-1,1],[-6,9],[-4,4],[-4,3],[-17,11],[-5,3],[-3,2],[-2,0],[-1,0],[-12,-16],[-2,-4],[0,-2],[-1,-1],[0,-2],[1,-4],[0,-1],[1,-2],[3,-5],[0,-1],[1,-1],[0,-1],[0,-2],[-1,-1],[-3,-5],[-1,-2],[0,-1],[0,-1],[1,-2],[1,-2],[2,-3],[1,-1],[0,-1],[0,-1],[0,-7],[1,-7],[1,-5],[0,-2],[0,-1],[-4,-4],[-6,-4],[-2,-1],[-2,-1],[-1,0],[-5,2],[-22,13],[-2,1],[-5,2],[-5,0],[-9,-1],[-3,-1],[-4,-2],[-2,-1],[-1,-2],[-2,-1],[-1,-1],[0,-2],[-1,-2],[0,-2],[-8,-42],[1,-3],[1,0],[3,1],[3,0],[1,0],[1,-1],[1,-2],[2,-4],[2,-7],[2,-4],[0,-2],[0,-2],[-3,-4],[-2,-3],[-3,-6],[-1,-2],[-2,-1],[-4,-4],[-1,-1],[-1,-2],[-1,-3],[0,-2],[1,-29],[1,-1],[0,-1],[1,-1],[0,-1],[3,-2],[1,-1],[5,-1],[1,-1],[1,0],[1,-2],[3,-33],[1,-3],[2,-7],[1,-3],[0,-2],[0,-6],[1,-11],[0,-3],[-1,-2],[-1,-2],[-5,-3],[-4,-1],[-1,0],[-4,-2],[-2,-1],[-1,-1],[-4,0],[-2,-1],[-1,0],[-3,-2],[-1,0],[-1,0],[-11,0],[-1,0],[-1,0],[-1,-1],[-1,-1],[-1,0],[-2,-2],[-2,-1],[-4,-1],[-1,-1],[-1,0],[-2,1],[-1,0],[-2,1],[-1,0],[0,1],[0,1],[-1,0],[-1,1],[-1,0],[-1,-1],[-1,-1],[-1,-2],[-5,-11],[0,-1],[-1,0],[-3,-3],[-1,0],[-1,-1],[-2,-3],[-1,-2],[-2,-2],[-1,-1],[-1,0],[-1,-1],[-2,0],[-1,1],[-5,1],[-1,0],[-7,-4]],[[5918,4537],[-2,4],[-1,2],[-6,3],[-2,2],[0,1],[-1,2],[-1,1],[0,2],[0,4],[2,6],[0,5],[0,3],[-1,3],[0,1],[0,9],[1,6],[4,7],[1,3],[3,9],[2,12],[-1,2],[-1,4],[0,1],[-1,5],[1,10],[0,3],[2,3],[0,2],[0,1],[-2,1],[-3,2],[-8,3],[-5,3],[-1,1],[-3,2],[-1,1],[-1,1],[-1,1],[0,2],[-1,5],[0,1],[-76,2],[-59,0],[-33,1],[-2,-4],[-2,-6],[-2,-23],[-2,-4],[-2,-1],[0,-1],[-1,-1],[-1,-2],[0,-1],[-1,-9],[1,-3],[1,-2],[4,-3],[2,-3],[-3,-9],[-2,-5],[-1,-2],[-2,-2],[-1,-2],[-2,-1],[-4,-1],[-1,-1],[0,-2],[0,-2],[3,-16],[0,-7],[1,-1],[1,-1],[3,-2],[1,-3],[0,-3],[-2,-5],[-1,-3],[-1,-4],[0,-1],[0,-2],[0,-1],[16,-2],[72,-1],[55,0],[68,0]],[[5918,4537],[-1,-8],[-6,-13],[-1,-3],[0,-3],[3,-21],[0,-2],[-1,-3],[-5,-14],[-3,-7],[-1,-1],[-1,-1],[-1,-1],[0,-2],[-3,-6],[-1,-2],[-8,-7],[-1,-2],[-4,-20],[0,-1],[1,-1],[2,-5],[1,-3],[7,-9],[2,-2],[4,-2],[4,-1],[3,-1],[1,-2],[1,-1],[1,-2],[1,-1],[1,-1],[4,-1],[1,-1],[1,-1],[0,-1],[2,-3],[1,-1],[1,0],[1,-1],[2,-2],[3,-8],[1,-2],[4,-8],[3,-17],[2,-3],[2,-4],[1,-2],[1,-2],[2,-9],[0,-3],[2,-2],[2,-6],[2,-8],[0,-4],[0,-3],[0,-1],[-1,-1],[-1,-1],[-1,0],[-1,0],[-1,0],[-1,0],[-1,1],[-2,0],[-1,0],[-1,-1],[-2,-3],[-1,-1],[-2,-2],[0,-1],[-1,-1],[-1,-2],[0,-1],[1,-1],[0,-2],[4,-5],[0,-2],[0,-1],[-1,0],[-1,0],[-2,-1],[-2,-1],[-1,-1],[-4,-3],[0,-1],[-1,-2],[-2,-5],[0,-1],[-2,-2],[-1,0],[-1,-1],[-1,0],[-1,1],[-1,0],[-1,0],[-1,0],[0,-1],[-1,-1],[-1,-1],[-2,-1],[-1,-1],[0,-2],[1,-1],[-1,-1],[-2,0],[0,-1],[1,-3],[-1,-1],[0,-1],[-1,-2],[-4,-3],[-2,-4],[0,-1],[-1,0],[-1,0],[-1,1],[-1,-1],[-1,-1],[-1,-1],[-1,-1],[-2,-3],[-1,-2],[0,-1],[1,-2],[1,-2],[-1,-2],[0,-3],[-2,-1],[-1,0],[-1,-1],[-1,-2],[0,-1],[1,-2],[0,-1],[-1,0],[-1,-1],[-1,0],[-1,0],[-1,0],[-2,1],[-1,0],[-1,1],[-3,3],[-1,0],[-1,-1],[-3,-6],[0,-2],[-1,-5],[-2,-2],[0,-3],[1,-2],[-1,-2],[-1,-3],[0,-7],[1,-4],[1,-2],[8,-10],[2,-2],[1,-1],[1,0],[1,0],[1,0],[1,1],[2,3],[1,1],[1,0],[1,1],[3,1],[2,1],[1,0],[1,-1],[1,0],[4,-3],[1,0],[1,0],[3,0],[1,0],[3,-1],[7,-5],[2,-2],[2,-1],[1,-2],[3,-7],[1,-3],[0,-6],[0,-11],[-1,-1],[0,-1],[-1,-1],[-2,-2],[-2,-1],[-1,-1],[-2,-5],[-3,-4],[-1,-3],[0,-1],[-1,-1],[0,-5],[-1,-1],[-2,-4],[0,-1],[0,-1],[-1,-4],[0,-1],[0,-1],[-2,-3],[0,-2],[0,-3],[1,-3],[1,-6],[1,-2],[1,-3],[1,-3],[1,-3],[1,-5],[0,-1],[3,-3],[1,-2],[0,-1],[0,-5],[1,-5],[5,-13],[-4,-1],[-1,0],[-2,-2],[-2,-1],[-4,-3],[-1,-2],[-2,-3],[-1,-1],[-2,-1],[-3,-2],[-2,-1],[-1,-2],[-1,-1],[-1,-1],[-1,0],[-2,0],[-1,-1],[-1,-1],[-1,-4],[-1,0],[-27,-11],[-5,-4],[-4,-4],[-2,-4],[-4,-9],[-3,-5],[-3,-3],[-55,-33],[-4,-1],[-3,0],[-1,0],[-2,1],[-7,3],[-7,0],[-3,1],[-3,1],[-2,1],[-1,1],[-1,1],[0,1],[-1,1],[0,1],[-2,0],[-2,-1],[-3,-1],[-5,0],[-3,1],[-1,1],[-1,1],[-3,2],[-5,4],[-11,5],[-9,3],[-9,0],[-15,-1],[-55,3],[-45,-3],[-8,1],[-13,5],[-9,0],[-14,-10],[-26,-10],[-5,-4],[-3,-3],[-6,-9],[-36,-40],[-4,-2],[-3,0],[-3,3],[-4,4],[-7,10],[-3,4],[-3,10],[0,2],[-1,1],[-1,0],[-1,1],[-2,0],[-2,0],[-2,-1],[-1,0],[0,-1],[-3,-4],[-3,-3],[-4,-2],[-5,-1],[-45,-21],[-8,-1],[-14,3],[-21,1],[-6,-1],[-5,-2],[-4,-4],[-6,-4],[-6,-2],[-33,-7],[-8,-2],[-5,-4],[-29,-43],[-5,-7],[-5,-5],[-1,0],[0,-2],[-1,-1],[0,-2],[0,-1],[1,-1],[1,-4],[1,-3],[1,-5],[0,-3],[0,-1],[-1,-3],[0,-2],[-1,-2],[-1,0],[-2,-3],[-5,-10],[-3,-3],[-3,-2],[-6,-2],[-5,-1],[-10,5],[-4,-3],[-5,-8],[-4,-3],[-4,-2],[-3,-3],[-1,-7],[-2,-4],[-4,-4],[-8,-5],[-4,-4],[-3,-5],[-1,-5],[-1,-6],[-1,-5],[-5,-9],[0,-5],[7,-8],[2,-5],[-2,-2],[-1,-1],[-2,-2],[-2,-1],[-1,0],[-1,1],[0,1],[-3,0],[-2,4],[-3,1],[-5,1],[-3,-1],[-2,-4]],[[5107,3657],[-16,27],[-11,14],[-3,3],[-3,3],[-3,1],[-3,1],[-3,0],[-5,-1],[-3,0],[-6,4],[-3,1],[-9,0],[-3,1],[-3,1],[-3,2],[-2,2],[-5,6],[-14,13],[-3,2],[-3,1],[-8,2],[-14,4],[-2,0],[-10,-1],[-10,2],[-3,1],[-44,20],[-2,3],[-6,6],[-8,7],[-8,3],[-12,3],[-8,3],[-4,2],[-2,2],[-2,3],[0,2],[-2,2],[-3,3],[-16,13],[-13,7],[-6,1],[-3,1],[-11,-1],[-5,0],[-3,2],[-2,1],[-17,18],[-6,5],[-3,2],[-3,0],[-26,-4],[-6,1],[-11,2],[-15,0],[-24,8],[-6,4],[-1,1],[0,1],[1,5],[8,20],[3,6],[13,19],[2,3],[1,4],[1,6],[-1,3],[-2,2],[-20,9],[-5,2],[-2,0],[-1,0],[-2,0],[-2,-1],[-9,-7],[-2,-1],[-3,-1],[-2,0],[-3,2],[-5,5],[-2,4],[-2,4],[0,4],[-1,5],[4,51],[-1,7],[-1,5],[-1,8]],[[4644,4031],[-4,10],[-8,21],[-6,17],[-1,8],[-1,3],[-1,2],[-7,9],[-11,23],[-3,8],[-1,8],[1,7],[2,13],[3,3],[-1,3],[1,10],[2,11],[1,4],[1,3],[2,2],[1,2],[-1,3],[-1,3],[0,3],[-1,12],[1,4],[1,3],[6,5],[2,3],[1,5],[2,5],[2,6],[1,1],[3,4],[8,14],[2,2],[3,1],[2,5],[2,5],[1,4],[0,3],[-1,5],[0,2],[0,3],[3,5],[3,17],[-2,4],[7,8],[6,5],[15,8],[9,4],[2,1],[4,3],[4,3],[8,10],[9,9],[4,5],[2,5],[1,6],[1,5],[2,4],[4,3],[6,5],[2,3],[1,5],[1,12],[2,10],[-4,2],[-1,1],[-4,2],[-2,1],[-1,2],[-1,1],[-1,2],[-1,3],[0,2],[0,6],[1,6],[1,4],[1,2],[1,1],[4,3],[5,3],[12,3],[3,2],[2,1],[2,2],[0,2],[1,1],[0,2],[-1,11],[0,3],[1,2],[2,1],[2,2],[12,5],[3,2],[1,5],[3,3],[9,3],[6,5],[2,0],[2,0],[2,1],[1,2],[5,13],[10,13],[2,4],[1,2],[2,2],[2,2],[5,2],[11,2],[23,2],[6,1],[4,4],[8,8],[1,3],[0,2],[1,1],[2,0],[3,0],[4,-2],[2,-1],[4,0],[3,2],[3,3],[2,8],[8,11],[6,17],[3,5],[2,6],[0,6],[-2,7],[-2,5],[2,3],[5,-3],[3,2],[5,9],[3,6],[1,4],[2,12],[1,3],[3,5],[1,3],[0,3],[-1,6],[-1,2],[1,3],[1,4],[0,2],[1,2],[4,2],[1,2],[0,6],[-1,4],[-1,4],[2,5],[2,3],[3,4],[4,3],[4,1],[3,2],[10,15],[4,5],[9,4],[4,3],[6,7],[3,3],[5,1],[5,1],[4,2],[7,6],[3,-4],[0,-5],[2,-5],[5,-2],[4,1],[4,2],[6,4],[8,4],[3,4],[2,2],[0,1],[1,1],[1,6],[1,3],[2,1],[5,3],[1,2],[2,17],[2,2],[3,2],[1,5],[0,11],[2,5],[3,10],[1,7],[1,3],[5,4],[2,3],[0,3],[2,5],[1,3],[0,1],[1,1],[0,3],[1,3],[1,3],[1,3],[1,5],[-1,4],[-3,9],[0,1],[-1,3],[-1,4],[-1,2],[0,2],[0,1],[1,4],[0,2],[2,5],[2,5],[1,3],[0,3],[0,4],[0,1],[0,2],[3,13],[8,18],[1,3],[0,2],[0,1],[-1,2],[-1,1],[0,2],[1,1],[1,1],[1,0],[3,-1],[7,2],[3,2],[0,1],[1,1],[0,1],[1,2],[0,2],[0,2],[0,1],[-2,3],[-1,2],[0,1],[0,3],[0,6],[0,1],[-1,4],[0,2],[0,4],[0,2],[3,9],[1,10],[0,3],[0,2],[-2,6],[-1,4],[0,2],[0,14],[0,2],[0,1],[-2,4],[0,3],[0,1],[1,1],[1,1],[3,1],[3,1],[1,0],[1,1],[4,3],[1,2],[1,0],[1,2],[0,2],[5,15],[2,16],[1,2],[3,5],[1,1],[1,1],[3,1],[0,1],[1,0],[2,5],[1,0],[1,1],[1,4],[3,3],[2,3],[1,1],[0,2],[1,8],[0,2],[1,1],[3,4],[3,4],[3,5],[3,7],[6,14],[1,4],[0,1],[0,2],[0,1],[-2,5],[0,1],[0,5],[0,3],[1,10],[0,4],[-1,2],[-2,4],[0,2],[0,1],[1,1],[1,1],[1,0],[3,2],[1,1],[1,1],[1,1],[0,1],[-1,2],[0,1],[-2,1],[-1,2],[1,1],[0,1],[2,2],[8,5],[0,1],[2,3],[2,2],[0,2],[4,19],[0,4],[0,2],[-1,2]],[[5213,5356],[4,10],[1,7],[0,2],[1,3],[1,5],[0,2],[0,3],[1,6],[2,1],[2,2],[2,2],[2,4],[0,3],[0,2],[1,4],[2,4],[6,8],[2,3],[1,2],[1,2],[0,3],[3,2],[2,1],[1,1],[1,2],[0,2],[2,0],[1,1],[2,2],[1,1],[3,4],[6,3],[4,4],[19,14],[3,-3],[1,-2],[1,-2],[1,-3],[-1,-5],[-1,-3],[-1,-3],[-12,-13],[-1,-3],[-1,-2],[-1,-3],[0,-3],[2,-11],[0,-5],[-1,-5],[-2,-3],[-12,-20],[-1,-3],[-1,-4],[-1,-4],[1,-27],[1,-4],[2,-3],[4,-3],[42,-23],[11,0],[2,1],[2,-1],[3,-1],[13,-12],[50,-26],[27,-4],[10,-3],[22,-12],[5,0],[3,0],[1,2],[1,2],[1,2],[0,2],[0,8],[0,5],[2,8],[14,34],[35,69],[17,14],[10,6],[1,0],[1,0],[1,0],[0,-1],[-2,-12],[-1,-2],[1,-3],[0,-2],[1,-2],[1,-1],[1,-1],[16,-9],[15,-13],[4,-5],[4,-5],[3,-7],[3,-7],[0,-4],[0,-3],[-2,-11],[0,-1],[0,-2],[1,-3],[1,-3],[5,-11],[1,-5],[2,-29],[-4,-20],[-1,-4],[0,-3],[1,-4],[1,-6],[1,-2],[1,-3],[2,-2],[1,-1],[1,0],[1,0],[8,7],[3,2],[1,2],[1,1],[0,2],[1,4],[2,12],[1,14],[1,7],[1,2],[1,2],[1,2],[3,1],[3,1],[4,0],[3,0],[4,-2],[12,-7],[7,-1],[18,0],[4,1],[4,1],[4,1],[5,3],[22,20],[6,3],[8,4],[3,0],[1,-1],[1,-1],[0,-2],[0,-1],[-1,-3],[-5,-13],[-1,-6],[0,-2],[1,0],[4,0],[5,-1],[6,-1],[6,-2],[8,-6],[8,-8],[4,-3],[3,0],[1,1],[3,3],[1,1],[2,-1],[4,-2],[5,-5],[9,-6],[39,-15],[3,0],[2,0],[1,2],[-1,3],[-1,3],[-12,32],[-2,5],[0,3],[0,2],[1,2],[1,1],[1,1],[10,9],[1,1],[2,1],[1,-1],[1,0],[0,-1],[1,-1],[2,-5],[1,-4],[7,-7],[0,-1],[1,-1],[0,-1],[0,-3],[1,-2],[0,-1],[7,-9],[0,-1],[1,-1],[0,-1],[-1,-1],[1,-1],[2,-7],[1,-2],[1,0],[0,1],[2,3],[1,1],[1,1],[0,1],[0,1],[0,1],[1,2],[15,2],[6,3],[3,2],[15,8],[3,1],[2,-1],[4,0],[1,1],[2,0],[1,2],[40,23],[10,3],[17,4],[2,0],[3,0],[6,-2],[10,0],[11,2],[6,2],[5,2],[3,2],[3,3],[23,28],[3,2],[3,3],[6,3],[15,3],[8,3],[7,5],[3,1],[2,0],[19,1],[11,3],[14,9]],[[5885,2319],[-10,-7],[-8,-3],[-4,-2],[-52,-47],[-9,-4],[-3,-4],[-5,-8],[-4,-10],[-2,-4],[-3,1],[0,6],[4,8],[1,5],[1,1],[9,12],[26,21],[10,5],[13,15],[11,5],[6,6],[4,3],[2,0],[6,0],[2,0],[3,2],[2,1],[0,-2]],[[6122,2518],[7,-2],[5,0],[1,0],[1,-1],[-1,-1],[1,-2],[3,-4],[3,-5],[0,-4],[-11,6],[-4,0],[-2,-3],[-2,1],[-4,0],[-1,1],[-1,1],[-4,6],[3,1],[1,0],[2,-1],[1,1],[0,2],[0,1],[-1,3],[3,0]],[[6402,2547],[-1,-1],[-2,0],[-2,-1],[-2,-1],[-1,3],[-2,1],[1,2],[3,1],[2,-1],[2,-2],[2,-1]],[[6377,2556],[-1,-19],[-7,1],[-1,-7],[3,-8],[8,2],[1,-2],[0,-1],[0,-1],[-2,-1],[-1,-1],[1,-3],[1,-4],[0,-1],[0,-1],[-1,-2],[-1,-1],[-3,-2],[-1,2],[-1,0],[-1,0],[-1,0],[-3,4],[-1,5],[-3,4],[-3,-2],[-1,2],[-8,-4],[-9,-3],[-8,1],[-5,6],[-2,5],[2,4],[2,2],[4,3],[14,14],[2,5],[2,8],[1,1],[1,2],[0,2],[1,2],[2,1],[1,0],[3,-1],[2,-1],[11,-9],[2,-2]],[[6465,2906],[3,-1],[3,0],[7,-4],[3,-2],[2,-2],[2,-3],[5,-12],[1,-1],[2,-2],[3,-3],[4,-4],[0,-2],[1,-1],[1,-1],[1,0],[2,0],[1,-2],[1,-7],[0,-2],[1,-1],[1,-1],[1,0],[5,-2],[2,-1],[2,0],[3,1],[1,1],[2,0],[1,0],[4,-3],[1,-1],[2,0],[3,0],[2,1],[1,0],[1,1],[1,0],[1,1],[9,0],[1,1],[1,1],[2,1],[2,0],[4,0],[2,1],[2,0],[1,3],[1,0],[1,0],[2,-3],[2,-1],[2,0],[3,1],[3,1],[6,0],[7,-1],[3,0],[2,0],[1,1],[1,1],[1,0],[0,-1],[3,-4],[4,-6],[4,-9],[1,-2],[0,-2],[0,-1],[0,-2],[-1,-1],[-1,-1],[-2,-1],[-2,-1],[-3,0],[-2,-1],[-2,-2],[-6,-7],[0,-2],[0,-2],[1,-2],[0,-1],[-1,-2],[-3,-7],[-1,-1],[-1,-1],[-8,-3],[-11,-7],[-3,-1],[-1,0],[-3,1],[-1,1],[-1,0],[-7,-3],[-2,-1],[-2,0],[-1,0],[-1,1],[0,1],[-1,2],[0,1],[-1,1],[-2,-1],[-12,-8],[-2,-1],[-2,1],[-3,1],[-2,1],[-1,0],[-1,-1],[-2,0],[-5,-3],[-8,-6],[-4,-2],[-3,-1],[-7,-1],[-1,-1],[-1,0],[-2,-1],[-1,-2],[-1,-1],[-3,-6],[-1,-1],[-2,-1],[-1,0],[-4,-1],[-1,0],[-1,-1],[0,-3],[0,-1],[0,-1],[1,-2],[-1,-2],[-2,-14],[0,-5],[0,-3],[1,-3],[0,-2],[-1,-3],[-2,-4],[-2,-2],[-2,-2],[-1,0],[-2,-2],[-4,-7],[0,-2],[0,-1],[-1,-2],[1,-1],[1,-2],[6,-9],[3,-6],[1,-1],[2,0],[1,1],[1,1],[1,0],[1,-1],[2,-3],[2,-5],[2,-2],[7,-5]],[[6488,2663],[-1,-3],[-3,-2],[-4,0],[-4,-2],[-4,2],[-3,-1],[-3,-2],[-4,0],[-1,1],[-1,3],[-1,2],[-2,1],[-2,0],[-2,-1],[-3,-1],[2,6],[-6,-2],[-8,-5],[-2,-3],[-1,0],[-2,-4],[-1,-1],[-2,-1],[-3,0],[-1,0],[-5,-3],[-1,0],[-2,3],[-2,-6],[3,-3],[4,-2],[3,-4],[-6,0],[-3,-3],[-5,-11],[-2,5],[-3,1],[-1,-1],[2,-5],[-3,1],[-2,1],[-3,2],[-2,2],[-3,2],[-1,-3],[0,-5],[1,-3],[-4,-1],[-4,2],[-4,0],[-3,-5],[3,-4],[0,-3],[-2,-1],[-3,-1],[-6,-3],[-3,1],[-3,3],[-2,1],[-3,-1],[-2,-2],[-2,-3],[-2,-1],[-4,-1],[-5,-4],[-4,-2],[-6,2],[-1,-3],[-2,-3],[-1,-3],[0,-3],[1,-5],[0,-3],[1,-4],[2,-1],[2,0],[1,-1],[0,-4],[-1,-5],[1,-3],[2,-4],[-1,-5],[-2,-5],[-5,-2],[-3,-1],[-2,1],[-1,1],[-2,0],[-3,0],[-5,-3],[-2,0],[-4,2],[-6,7],[-4,1],[-8,-1],[-2,0],[-1,0],[-1,2],[-1,1],[-5,0],[-14,5],[-15,0],[-2,1],[-5,2],[-2,1],[-9,0],[-20,-6],[-7,-3],[-4,-3],[-3,-2],[-2,-5],[-2,0],[-5,1],[-4,-1],[-5,-2],[-8,-4],[0,1],[-1,1],[-1,0],[-3,-7],[-5,-5],[-5,-3],[-7,-2],[0,-2],[5,0],[3,1],[4,2],[8,9],[3,2],[4,0],[-8,-11],[-2,-3],[-1,-4],[-1,-5],[0,-5],[0,-2],[-2,-3],[-2,-1],[-2,1],[-1,2],[-2,1],[-3,0],[-3,-1],[-4,-3],[-3,-4],[-5,-2],[-6,1],[2,4],[5,2],[2,3],[0,3],[-2,3],[-2,3],[-1,2],[0,3],[-2,3],[-2,2],[-6,1],[-3,1],[-1,1],[1,2],[0,2],[-6,2],[-1,-4],[0,-4],[-2,-2],[-2,-1],[-1,-2],[1,-2],[-1,-1],[-5,1],[-4,1],[1,-3],[2,-2],[2,-1],[1,0],[0,-2],[2,-5],[1,-1],[2,-1],[3,0],[3,0],[1,-2],[0,-6],[-1,-2],[-2,-2],[-1,3],[-1,1],[-1,1],[-2,1],[-14,-8],[-27,-13],[-33,-22],[-25,-13],[-18,-12],[-7,-6],[-5,-9],[-2,-9],[-2,-1],[-1,-1],[3,-7],[0,-2],[-4,-3],[-4,-2],[-3,1],[-1,5],[-4,-11],[-2,-1],[-4,-2],[-5,-6],[-3,-1],[-10,-12],[-58,-37],[-3,1],[-3,-1],[-6,-4],[-5,2],[-3,0],[-2,-4],[-4,-3],[-6,-4],[-11,-7],[-42,-35],[-4,-4],[-5,-8],[-2,-1],[-1,-1],[-2,-1],[-1,-2],[-9,-19],[-6,-4],[-11,2],[2,4],[3,0],[3,0],[3,1],[0,2],[-3,1],[-10,0],[-1,-1],[0,-2],[0,-3],[-1,-3],[-2,-1],[-2,1],[-1,2],[0,-4],[4,-2],[6,-2],[4,0],[5,-2],[3,-1],[3,2],[2,2],[3,2],[3,0],[3,0],[-8,-26],[-6,-11],[-12,-3],[-3,-3],[-11,-14],[-2,-3],[-1,-4]],[[5745,2162],[0,3],[1,3],[3,2],[5,9],[2,3],[-1,2],[-1,1],[-2,0],[-1,0],[-1,-1],[-1,-1],[0,-1],[-1,-1],[-1,-1],[-1,0],[-2,0],[-1,0],[-13,4],[-2,1],[-1,1],[-3,3],[-2,1],[0,2],[0,2],[1,3],[0,2],[-1,4],[-4,13],[-1,1],[-1,6],[-4,14],[-7,-5],[-2,0],[-1,0],[0,2],[-1,1],[0,1],[-2,2],[-3,0],[-4,-1],[-2,0],[-1,1],[-1,1],[0,1],[0,1],[0,1],[-1,1],[-1,1],[-1,1],[-2,2],[-2,0],[-4,0],[-2,1],[-4,3],[-1,0],[-1,0],[0,-2],[-1,-1],[-4,-2],[-2,-2],[-1,-1],[0,-1],[-1,-1],[0,-2],[1,-4],[0,-2],[0,-1],[-1,-1],[-1,-1],[-2,-2],[-1,-2],[-1,-1],[-1,-3],[0,-1],[-2,-1],[-1,-1],[-1,0],[-7,4],[-5,3],[-1,1],[-1,1],[-3,9],[-1,2],[0,1],[0,1],[1,1],[4,3],[1,1],[1,1],[0,2],[1,6],[-1,8],[0,4],[1,1],[2,2],[2,2],[-1,2],[0,3],[-1,7],[0,3],[1,2],[2,2],[4,3],[2,1],[1,3],[3,5],[0,3],[0,2],[-1,0],[-12,5],[-1,1],[-1,0],[-1,1],[-1,3],[-1,1],[0,1],[-1,1],[-2,1],[-1,1],[-2,0],[-1,0],[-1,0],[-2,0],[-4,-3],[-2,-1],[-2,-2],[-1,-1],[-1,0],[-2,1],[0,2],[-2,5],[-2,0],[-1,-2],[-3,-1],[-8,-1],[-1,0],[-4,0],[-1,0],[-1,0],[-1,-1],[-1,0],[-4,2],[-3,4],[-3,2],[-6,0],[1,0],[0,-1],[1,-1],[-6,1],[-18,-2],[-5,2],[-7,7],[-5,2],[1,-9],[-6,-4],[-8,-1],[-12,2],[-5,0],[-4,-3],[-4,0],[-4,0],[-14,5],[-3,1],[0,2],[-1,1],[0,1],[-1,3],[0,2],[1,8],[0,1],[0,1],[-4,7],[0,1],[0,2],[0,2],[0,1],[0,1],[2,2],[6,0],[0,1],[1,1],[0,2],[0,1],[0,4],[2,6],[-5,4],[0,1],[-1,1],[1,1],[1,1],[1,1],[6,2],[2,1],[2,2],[0,1],[0,2],[-2,2],[-1,2],[1,1],[0,1],[2,1],[1,1],[2,3],[0,3],[0,2],[-1,1],[-1,1],[-1,1],[-1,0],[-1,1],[-2,1],[-1,1],[-2,1],[-1,0],[-1,2],[-2,3],[-3,11],[-1,3],[-1,1],[-1,0],[-2,1],[-1,1],[-2,2],[0,1],[0,2],[1,3],[0,3],[0,10],[0,2],[-1,2],[-2,2],[-2,3],[0,1],[-2,1],[-2,1],[-1,1],[-5,2],[-1,0],[-1,1],[-1,2],[-2,2],[-1,2],[-1,1],[-3,1],[-1,1],[-1,1],[-2,4],[-3,5],[-4,6],[-1,3],[-1,3],[-1,1],[-1,1],[0,2],[0,3],[0,1],[-1,0],[-1,0],[-1,0],[-1,-1],[-1,1],[-3,1],[-4,8],[-1,1],[-2,0],[-1,1],[-1,1],[-1,1],[-2,5],[0,2],[1,1],[1,0],[3,1],[1,1],[0,1],[2,2],[0,3],[1,3],[0,12],[2,13],[0,2],[-1,2],[-1,1],[-3,3],[-2,3],[-5,7],[-3,7],[-1,5],[0,10],[0,4],[-1,2],[-1,1],[-3,2],[-1,2],[0,2],[0,1],[1,1],[0,2],[0,1],[1,3],[6,17],[1,4],[-1,11],[-5,23],[-7,16],[-6,9],[-5,5],[-1,2],[0,2],[0,2],[-1,4],[-1,1],[-1,1],[-1,0],[-3,0],[-1,0],[-2,0],[-5,2],[-2,1],[-6,5],[-2,0],[-7,1],[-2,1],[-3,2],[-4,3],[0,3],[1,7],[-2,3],[-3,2],[-7,4],[-2,3],[1,6],[-1,4],[-2,2],[-2,1],[-2,-1],[0,-4],[-4,2],[-3,0],[-16,-5],[-2,-1],[-3,-2],[-19,-1],[-6,1],[-2,1],[-4,1],[-3,0],[-2,-2],[-1,-3],[-4,1],[-3,2],[-3,1],[-4,4],[-3,2],[-4,1],[-3,-1],[-3,-2],[-4,-6],[-2,1],[-14,-1],[-1,0],[-1,1],[-2,0],[-1,1],[-4,2],[-19,3],[-6,0],[-4,-1],[-5,-4],[-3,-2],[-3,-1],[-6,-1],[-3,0],[-3,1],[-2,2],[-1,2],[-2,3],[-2,7],[-2,3],[-9,12],[-2,2],[-3,2],[-27,7],[-24,7],[-16,7],[-18,13],[-5,3],[-6,3],[-4,3],[-3,1],[-2,0],[-1,0],[-2,0],[-2,-1],[-2,0],[-2,-1],[-5,1],[-2,0],[-2,0],[-1,-1],[-5,-3],[-1,-1],[-1,-1],[-3,-1],[-5,-1],[-8,0],[-5,1],[-4,2],[-8,4],[-4,2],[-5,0],[-4,-3],[-3,0],[-5,4],[-6,7],[-5,2],[-14,-2],[-6,1],[-4,1],[-24,16],[-9,5],[-10,2],[-5,0],[-6,-2],[-5,-3],[-2,-5],[-1,-5],[-2,-6],[-3,-5],[-3,-4],[-6,-1],[-2,2],[-2,4],[-1,2],[-2,1],[-1,1],[-2,1],[-3,1],[-2,-1],[-6,-5],[-5,0],[-11,3],[-5,1],[-9,0],[-3,0],[-4,-2],[-9,-1],[-7,5],[-6,6],[-8,1],[-12,-8],[-6,-1],[-22,4],[-9,0],[-4,0],[-6,4],[-3,1],[-12,0],[-4,-2],[-6,-3],[-3,-3],[-11,-9],[-11,-11],[-2,-2],[-8,-3],[-3,-1],[-1,0]],[[4618,2830],[8,6],[5,8],[13,26],[1,2],[3,1],[3,1],[2,0],[2,3],[4,8],[4,7],[1,1],[2,-1],[4,0],[4,1],[17,9],[1,1],[2,7],[1,1],[1,1],[21,14],[7,6],[3,3],[13,5],[7,6],[4,3],[2,0],[5,1],[2,1],[2,2],[5,6],[2,1],[6,3],[1,1],[4,6],[15,14],[1,2],[2,7],[0,2],[7,15],[1,4],[1,7],[1,4],[2,4],[11,12],[2,1],[4,2],[2,1],[2,2],[2,3],[1,3],[1,3],[0,5],[1,3],[7,13],[4,2],[7,4],[6,4],[4,4],[4,4],[0,6],[0,2],[-2,3],[-3,1],[-9,18],[0,7],[1,0],[2,1],[1,1],[0,1],[0,1],[1,2],[0,1],[1,3],[2,1],[2,1],[2,0],[4,-1],[4,-1],[3,0],[4,1],[4,4],[6,11],[2,5],[14,15],[3,12],[-1,10],[-4,22],[1,7],[3,4],[3,2],[6,5],[4,2],[1,1],[1,2],[4,7],[6,15],[2,3],[5,5],[16,18],[2,5],[2,28],[0,11],[0,6],[5,10],[2,11],[2,6],[4,3],[11,2],[11,13],[5,9],[10,12],[3,6],[8,11],[4,4],[14,7],[28,9],[6,4],[5,5],[7,9],[6,10],[8,22]],[[5100,3496],[9,13],[13,11],[5,4],[38,15],[6,2],[4,3],[17,18],[5,10],[7,4],[8,2],[7,1],[7,-3],[5,-5],[8,-12],[6,-3],[72,-11],[29,-5],[75,0],[10,-2],[21,-7],[4,-3],[15,3],[5,0],[5,0],[5,-2],[2,-4],[-2,-4],[-7,-3],[-1,-1],[-2,-1],[0,-3],[0,-3],[-2,-7],[0,-6],[2,-11],[1,-6],[5,-12],[6,-8],[3,-9],[3,-4],[7,-3],[8,3],[6,7],[5,7],[7,18],[5,7],[9,-2],[5,-9],[2,-12],[-1,-23],[1,-20],[2,-3],[10,-5],[4,-2],[6,6],[1,2],[0,4],[-2,7],[-1,3],[0,14],[0,4],[-2,3],[0,3],[3,4],[3,7],[2,7],[2,6],[6,4],[11,0],[8,2],[4,0],[12,-3],[5,-1],[4,1],[8,6],[4,2],[17,-2],[3,1],[2,1],[5,2],[9,1],[19,0],[5,-1],[7,-6],[4,0],[5,6],[-5,19],[5,7],[5,-5],[2,-6],[2,-6],[3,-6],[3,-3],[9,-4],[7,-5],[2,0],[3,0],[3,2],[1,2],[1,2],[1,1],[2,1],[3,1],[1,0],[2,5],[1,5],[1,12],[3,-1],[2,-2],[2,-2],[2,-3],[0,-3],[0,-3],[1,-3],[1,-3],[2,-2],[3,0],[2,1],[2,0],[3,3],[2,6],[1,6],[1,5],[-2,4],[-1,3],[2,1],[2,3],[2,2],[2,1],[28,1],[4,-1],[5,-5],[5,-8],[4,-2],[5,1],[3,3],[2,4],[2,4],[6,1],[5,1],[5,1],[5,2],[4,3],[2,-2],[4,-3],[1,-2],[1,-3],[0,-2],[0,-2],[-1,-2],[0,-2],[0,-1],[0,-1],[5,-6],[3,-3],[2,-1],[3,0],[16,-11],[2,-4],[9,-8],[2,-5],[3,-5],[-1,-5],[0,-1],[0,-2],[-1,-4],[0,-3],[-1,-1],[-1,-1],[-4,-3],[0,-1],[-1,-1],[0,-2],[-1,-5],[-1,-15],[-1,-7],[0,-3],[-1,-2],[0,-2],[0,-2],[1,-2],[6,-7],[2,-1],[22,-12],[1,-1],[1,-1],[0,-1],[1,-1],[1,-2],[5,-22],[1,-2],[0,-4],[-1,-2],[-1,-2],[-2,-3],[-1,-2],[-1,-1],[-3,0],[-2,-1],[0,-1],[-1,-6],[0,-3],[-1,-3],[-3,-4],[-1,-2],[-1,-1],[-3,-3],[-2,-5],[-2,-18],[-1,-5],[0,-2],[1,-2],[2,-2],[1,-1],[2,-1],[1,0],[2,-1],[1,-2],[3,-4],[2,-3],[2,-2],[1,-1],[-1,-2],[-1,-2],[0,-1],[0,-1],[0,-3],[4,-16],[1,-2],[-1,-7],[1,-2],[1,-2],[11,-14],[1,-2],[2,0],[1,-1],[1,-2],[2,-7],[3,-11],[2,-3],[1,-5],[1,-2],[4,-8],[0,-1],[1,-2],[0,-1],[0,-2],[-2,-6],[0,-1],[0,-2],[0,-1],[2,-1],[3,0],[18,1],[1,1],[2,0],[1,1],[1,2],[1,0],[1,1],[3,0],[1,0],[1,1],[1,0],[1,1],[1,3],[1,1],[1,1],[1,0],[6,0],[3,0],[1,0],[1,0],[5,-2],[6,-4],[4,-3],[1,0],[1,-1],[1,1],[1,0],[2,3],[1,1],[2,2],[1,0],[1,0],[1,-1],[0,-4],[1,-2],[1,-1],[3,-1],[2,-1],[0,-1],[1,-2],[1,-2],[1,-1],[2,0],[1,0],[1,1],[2,0],[1,0],[1,0],[3,0],[3,-1],[1,-1],[1,-1],[2,-1],[1,-1],[0,-1],[1,-2],[1,-11],[1,-2],[0,-2],[1,0],[0,-1],[-1,-1],[-2,-2],[-1,-1],[0,-1],[-2,-3],[0,-3],[0,-7],[1,-1],[-1,-1],[-1,-2],[-2,-1],[-1,-1],[0,-1],[-1,-2],[-4,-12],[-1,-1],[-1,-1],[-1,0],[-6,1],[-1,0],[-1,-3],[-4,-20],[-1,-3],[-1,-1],[-4,-3],[-2,-2],[0,-1],[-1,-1],[0,-2],[0,-2],[1,-4],[1,-1],[1,-1],[1,-1],[1,-1],[0,-2],[0,-1],[-1,-2],[-2,-2],[-1,-2],[1,-2],[5,-15],[4,-6],[0,-2],[0,-1],[-2,-2],[-1,-1],[-2,0],[-1,0],[-1,0],[-1,-1],[-1,0],[-2,-2],[0,-2],[-1,-1],[1,-2],[1,-1],[1,-1],[0,-1],[-1,-1],[-2,-1],[-4,-1],[-1,0],[-1,-1],[1,-2],[1,-2],[1,-1],[2,-1],[1,0],[8,-1],[1,0],[1,-1],[1,-1],[5,-8],[0,-2],[-1,-2],[-6,-5],[-3,-3],[-4,-7],[-8,-20],[-1,-6],[1,-2],[0,-1],[1,-1],[7,-9],[1,-2],[1,-2],[-1,-5],[0,-1],[2,-2],[2,-2],[11,-4],[8,-2],[1,0],[1,-1],[0,-3],[0,-3],[1,-2],[0,-1],[2,-1],[4,-1],[4,-2],[10,-7],[2,-1],[5,-1],[3,-1],[3,0],[1,0],[1,0],[-1,-2],[-1,-2],[-1,-1],[-2,-1],[-1,-1],[-1,-1],[0,-2],[0,-3],[1,-2],[1,-2],[3,-5],[0,-1],[0,-2],[-2,-1],[-1,-1],[-11,-5],[-2,-1],[-1,-1],[-1,-1],[0,-1],[0,-2],[1,-1],[6,-5],[4,-4],[13,-8],[2,-2],[1,-2],[-2,-4],[0,-1],[0,-2],[-1,-5],[0,-3],[1,-3],[0,-3],[2,-3],[1,-1],[1,-1],[1,-1],[3,0],[4,0],[2,-1],[3,-2],[1,0],[2,1],[2,1],[1,1],[1,0],[1,0],[1,-1],[2,0],[2,0],[2,0],[2,1],[1,1],[1,1],[0,1],[2,1],[1,0],[7,1],[1,0],[1,0],[1,-2],[0,-1],[0,-2],[-1,-1],[0,-1],[-1,-1],[1,-1],[0,-1],[5,-1],[18,4],[5,0],[2,1],[2,1],[2,2],[2,2],[1,1],[1,3],[1,1],[1,0],[3,0],[2,-1],[2,0],[1,1],[1,3],[1,1],[1,0],[1,0],[1,-2],[1,-2],[1,-1],[1,-1],[2,-1],[2,-2],[1,-2],[1,0],[2,0],[2,2],[1,2],[1,2],[1,1],[1,1],[1,1],[3,0],[1,-1],[0,-1],[1,-2],[0,-1],[1,-1],[1,0],[1,0],[2,1],[1,2],[1,1],[1,2],[-1,2],[0,1],[0,1],[-1,1],[0,2],[0,1],[1,1],[1,1],[2,-1],[2,-1],[1,0],[1,0],[1,1],[1,2],[0,2],[1,3],[0,3],[0,2],[0,1],[-1,2],[0,1],[-1,0],[-1,1],[-1,0],[-1,0],[-3,0],[-5,0],[-2,0],[-1,0],[-1,1],[-1,1],[0,1],[0,1],[0,1],[1,1],[19,13],[1,2],[1,1],[-1,2],[0,1],[-1,1],[-3,4],[-1,1],[0,1],[0,1],[2,2],[4,1],[8,1],[4,-1],[1,-1],[0,-1],[-2,-3],[-1,-2],[-3,-2],[0,-1],[-1,-1],[0,-2],[0,-1],[0,-1],[1,-1],[1,-1],[2,0],[1,0],[2,0],[3,1],[5,3],[4,4],[1,0],[2,1],[1,-1],[1,-1],[0,-1],[0,-2],[0,-1],[1,-1],[1,-1],[7,-1],[3,0],[2,1],[5,3],[2,2],[1,1],[3,6],[1,1],[2,0],[1,0],[2,-1],[1,-1],[2,-1],[0,-1],[1,-2],[0,-1],[0,-3],[0,-2],[1,-1],[1,-1],[1,0],[3,1],[9,5],[17,6],[1,1],[2,1],[1,2],[0,2],[0,3],[0,1],[1,1],[2,-1],[2,1],[2,0],[4,3],[3,4],[2,2],[12,7],[2,2],[13,6],[2,1],[4,-1],[3,0],[2,1],[3,2],[3,1],[2,1],[6,0],[3,-1],[2,0],[6,3],[14,9]],[[8679,6647],[-2,-1],[-3,0],[-3,1],[-3,2],[0,4],[1,5],[0,3],[2,3],[3,4],[0,3],[1,3],[0,2],[2,0],[2,0],[1,-2],[0,-2],[1,-3],[1,-4],[0,-2],[-1,-5],[-1,-3],[-1,-4],[0,-4]],[[8666,6715],[-1,0],[-3,-1],[-4,-2],[15,1],[6,-3],[1,-5],[3,-4],[2,-4],[1,-2],[-2,-4],[-1,-4],[-3,-7],[-1,0],[0,4],[-1,3],[0,3],[-1,-2],[0,-2],[0,-4],[-5,11],[-1,3],[-1,-5],[4,-12],[-1,-5],[-3,0],[-2,-1],[-3,-2],[-2,-4],[5,2],[2,3],[2,0],[0,-1],[0,-3],[-2,-2],[-2,-2],[-1,-5],[-1,-11],[2,-2],[8,-2],[1,-3],[0,-4],[0,-9],[3,7],[1,-3],[2,-6],[1,-4],[-1,-1],[0,-2],[0,-1],[1,-2],[-2,-5],[-5,-23],[0,-5],[-1,-2],[-3,-1],[-4,2],[-4,5],[-3,2],[-4,0],[4,-2],[1,-2],[2,-3],[0,-3],[0,-2],[1,-3],[2,-2],[1,1],[0,2],[0,-4],[-3,-9],[-1,-10],[-1,-2],[-4,-7],[-2,-7],[-2,-7],[-1,-10],[1,-7],[0,-3],[0,-1],[-1,-1],[-2,-2],[0,-3],[-1,-2],[-15,-49],[-10,-22],[0,-3],[-2,-2],[-1,-5],[0,-11],[-3,-5],[-6,-11],[-2,-6],[-1,-11],[-2,-10],[0,-1]],[[8610,6364],[-4,3],[-2,0],[-6,0],[-22,4],[-20,1],[-6,3],[-8,2],[-2,2],[-1,1],[0,2],[-1,1],[0,2],[-3,0],[-5,-1],[-23,-7],[-3,-2],[-16,-11],[-2,-1],[-3,-1],[-4,1],[-6,3],[-4,2],[-2,2],[-1,2],[0,2],[-1,1],[-3,0],[-4,-1],[-11,0],[-6,-2],[-10,-5],[-4,-1],[-2,1],[-3,3],[-2,0],[-2,-1],[-12,-10],[-5,-6],[-5,-2],[-1,-1],[-1,-2],[1,-2],[1,-2],[0,-1],[1,-1],[-1,-2],[-2,-2],[-25,-18],[-2,-2],[-1,-4],[-2,-5],[-1,-3],[-18,-16],[-21,-2],[-3,0],[-4,-3],[-7,-6],[-8,-4],[-5,-4],[-2,-2],[-2,-2],[-2,-1],[-4,1],[-5,2],[-3,1],[-2,1],[-40,3],[-5,0],[-5,-1],[-6,-6],[-8,-16],[-3,1],[-2,2],[-8,9],[-6,4],[-6,2],[-13,3],[-3,0],[-12,8],[-47,51],[-10,7],[-2,1],[-6,2],[-2,1],[-2,3],[-2,5],[-4,6],[-4,1],[-5,0],[-3,-1],[-3,-2],[-9,-8],[-3,-1],[-4,0],[-3,1],[-2,2],[-2,2],[0,2],[-1,3],[0,3],[-1,2],[-4,6],[-1,2],[-1,2],[-1,2],[-4,5],[-2,1],[-3,-1],[-7,-6],[-1,-2],[0,-2],[0,-3],[-2,-7],[0,-2],[1,-5],[-1,-2],[-1,-4],[-3,-4],[-6,-6],[-8,-7],[-8,-9],[-8,-13],[-6,-4],[-12,-4],[-9,-2],[-2,-2],[-3,-3],[-4,-6],[-5,-10],[-7,-9],[-11,-8]],[[7926,6257],[-3,8],[-8,26],[0,6],[-1,2],[-4,6],[-1,3],[-1,3],[1,3],[0,3],[1,2],[-1,4],[0,2],[3,2],[1,2],[1,3],[1,4],[0,3],[-2,1],[-2,1],[-2,3],[-2,1],[-3,-3],[-5,-4],[-5,-3],[-7,-2],[-4,2],[-4,3],[-4,2],[-3,2],[-5,10],[-2,4],[9,14],[1,7],[-4,7],[-10,4],[-8,-2],[-5,-8],[-3,-10],[0,-12],[-2,-6],[-3,-3],[-5,1],[-2,3],[-8,23],[-1,5],[-2,4],[-5,2],[-8,4],[-3,3],[-2,3],[-2,2],[-7,1],[-4,3],[-2,0],[-2,0],[-7,-3],[-11,-2],[-5,0],[-2,3],[-2,5],[-5,4],[-5,2],[-18,7],[-7,1],[-2,1],[-1,2],[-1,2],[-2,0],[-6,1],[-3,0],[-2,1],[-1,4],[-1,1],[-1,2],[-1,2],[-3,3],[-5,14],[-3,4],[-8,2],[-8,6],[-5,0],[-5,-2],[-44,-27],[-3,-1],[-10,0],[-4,-1],[-2,-3],[-1,-4],[4,-17],[-1,-7],[-2,-3],[-4,-1],[-5,-1],[-5,-1],[-10,-4],[-14,-1],[-5,-1],[-3,-4],[0,-4],[1,-6],[2,-5],[1,-2],[1,-3],[-1,-6],[-2,-7],[-2,-3],[-13,-15],[-3,-3],[-9,-2],[-10,-3],[-8,-7],[-5,-3],[-4,0],[-1,1],[-3,0],[-2,0],[-1,1],[-2,3],[-1,1],[-3,2],[-5,2],[-8,-2],[-5,-9],[-10,-47],[-2,-7],[0,-9],[-2,-2],[-2,-2],[-2,-1],[-3,0],[-2,0],[-5,3],[-2,0],[-4,-1],[-5,-8],[-5,-3],[-9,-1],[-4,-2],[-2,-9],[-3,-3],[-15,-6],[-3,0],[-2,0],[-5,3],[-2,0],[-2,1],[-5,5],[-3,1],[-2,1],[-5,-1],[-2,-1],[4,8],[0,1],[2,1],[3,4],[2,4],[2,4],[2,3],[0,3],[0,1],[0,1],[0,2],[0,1],[0,1],[0,6],[0,2],[-1,2],[0,1],[-1,1],[0,2],[-1,5],[0,2],[0,1],[0,2],[0,1],[0,1],[-1,2],[-1,0],[-2,1],[-5,0],[-3,1],[-1,0],[-13,10],[-2,1],[-3,0],[-1,1],[-1,1],[0,2],[-1,2],[0,1],[1,10],[0,2],[-1,1],[0,1],[-1,1],[-5,6],[-1,2],[-1,2],[0,3],[0,3],[1,8],[0,3],[-1,6],[-1,1],[0,2],[2,11],[1,4],[0,2],[0,1],[-1,2],[-1,1],[-1,2],[-3,3],[-1,1],[-1,0],[-1,1],[-1,-1],[-2,-2],[-1,0],[-1,0],[-2,0],[-3,2],[-1,2],[-1,1],[0,1],[-1,2],[0,3],[0,1],[0,1],[-1,1],[-2,2],[-1,0],[-1,0],[-2,0],[-6,-3],[-5,-1],[-2,0],[-2,1],[-1,0],[-2,2],[-1,1],[0,1],[0,2],[1,6],[0,2],[0,1],[-1,1],[-1,1],[-1,1],[-2,1],[-5,0],[-4,1],[-12,-2],[-6,-2],[-3,-2],[-2,-1],[-4,-1],[-1,0],[-2,0],[-5,1],[-1,0],[-4,2],[-6,4]],[[7232,6416],[19,10],[16,10],[1,1],[1,1],[2,3],[2,4],[1,5],[1,2],[1,1],[3,5],[1,1],[1,0],[5,2],[6,1],[1,0],[1,1],[2,1],[1,2],[1,2],[0,1],[1,4],[1,2],[1,2],[3,4],[2,2],[1,2],[0,3],[1,2],[2,1],[4,1],[2,0],[2,0],[9,-3],[2,-1],[1,-1],[1,0],[1,1],[2,1],[2,4],[0,2],[1,2],[0,4],[1,7],[1,1],[1,1],[2,0],[1,-1],[1,0],[4,-3],[1,0],[1,-1],[2,1],[1,1],[1,3],[1,4],[0,1],[3,3],[6,4],[3,8],[0,2],[1,2],[1,1],[15,10],[1,1],[3,5],[4,5],[6,7],[1,1],[2,0],[1,0],[1,1],[1,1],[2,3],[1,3],[8,19],[1,9],[2,23],[-2,14],[-2,4],[-1,2],[-4,4],[-4,3],[-13,6],[-2,2],[-1,2],[0,2],[1,3],[2,6],[3,5],[1,1],[1,2],[0,2],[1,2],[0,6],[0,2],[-2,6],[0,1],[-5,7],[-8,18],[-1,1],[-1,6],[0,2],[1,13],[1,1],[0,1],[1,1],[1,1],[5,3],[2,0],[24,3]],[[7416,6755],[54,-1],[3,0],[2,0],[2,0],[20,-6],[5,0],[19,2],[5,2],[8,4],[12,6],[5,1],[18,2],[43,-6],[4,-3],[13,-13],[6,-6],[3,-4],[1,-1],[2,-1],[9,-2],[2,-1],[2,-2],[9,-7],[8,-3],[3,0],[5,-2],[1,-1],[2,-1],[1,-3],[2,-4],[2,-8],[1,-2],[10,-12],[4,-3],[14,-6],[2,-1],[1,0],[2,-1],[7,-5],[2,-2],[1,-1],[2,-2],[0,-3],[5,-19],[1,-2],[1,-1],[0,-1],[2,0],[3,1],[6,5],[4,2],[2,0],[1,-1],[3,-5],[0,-1],[1,0],[2,0],[3,5],[2,5],[3,4],[3,8],[2,3],[5,6],[3,5],[1,0],[1,1],[2,0],[1,-1],[1,0],[0,-1],[1,-1],[1,1],[1,2],[1,5],[0,2],[1,1],[1,2],[1,1],[3,1],[5,1],[2,-1],[2,0],[0,-1],[1,1],[1,0],[3,5],[2,2],[7,3]],[[7824,6696],[3,-1],[1,0],[1,0],[1,0],[1,0],[1,0],[1,-1],[1,-3],[0,-4],[1,-3],[0,-3],[1,-1],[1,-1],[3,-2],[1,0],[1,0],[4,1],[1,0],[1,-1],[0,-1],[1,-2],[-1,-3],[0,-6],[1,-2],[3,-1],[3,0],[2,-1],[1,0],[2,-2],[1,-1],[1,0],[1,0],[3,0],[5,2],[2,1],[3,3],[1,1],[1,1],[2,1],[3,0],[1,-2],[1,-1],[0,-1],[1,-1],[1,0],[1,1],[3,4],[3,4],[6,4],[3,-1],[1,-1],[1,-1],[1,-1],[2,-6],[1,-2],[1,-3],[2,-6],[0,-2],[0,-1],[0,-2],[-1,-4],[0,-2],[0,-1],[1,-1],[1,-1],[2,0],[1,0],[3,-2],[3,-1],[1,0],[1,0],[2,2],[1,2],[0,1],[0,2],[0,1],[0,1],[1,1],[1,-1],[1,-1],[1,0],[1,-1],[1,0],[1,-1],[1,0],[2,1],[1,1],[2,2],[2,1],[0,1],[1,2],[1,4],[0,1],[1,1],[1,1],[2,-1],[1,-1],[0,-1],[1,-1],[0,-2],[0,-2],[1,-1],[1,-1],[0,-1],[1,0],[6,-3],[1,0],[2,0],[0,2],[0,1],[0,1],[-1,1],[0,1],[-1,1],[0,2],[0,1],[1,1],[2,3],[1,2],[1,1],[2,1],[3,0],[2,0],[2,-1],[9,-4],[2,0],[2,1],[5,4],[1,1],[1,1],[2,5],[4,8],[1,2],[2,3],[3,2],[2,1],[17,6],[3,3],[1,1],[1,1],[7,11],[5,6],[1,1],[25,12],[9,6],[1,1],[1,1],[2,3],[2,5],[1,1],[3,3],[2,3],[2,3],[1,1],[0,5],[0,1],[1,1],[1,1],[9,5],[1,0],[1,0],[1,-2],[0,-2],[1,-1],[1,0],[3,1],[2,1],[1,1],[1,0],[1,2],[2,2],[1,4],[0,1],[1,3],[1,1],[1,1],[1,0],[15,5],[4,2],[1,0],[3,-1],[4,-3],[17,-15],[10,-5],[6,-5],[1,-1],[1,0],[2,0],[3,0],[2,0],[1,0],[1,-1],[1,0],[0,-1],[1,-2],[0,-1],[0,-5],[0,-1],[0,-2],[0,-1],[1,-1],[4,-7],[0,-1],[0,-1],[0,-2],[-1,-2],[-2,-1],[-1,-1],[-13,-6],[-5,-3],[-5,-1],[-1,-1],[-7,0],[-1,-1],[-4,-2],[-1,-1],[-1,0],[-1,-1],[-1,0],[-1,-1],[-1,-2],[-1,-4],[-1,-7],[-1,-4],[0,-2],[1,-1],[0,-2],[4,-9],[2,-5],[3,-7],[1,-3],[0,-1],[0,-2],[0,-2],[-1,-1],[0,-2],[-2,-1],[-3,-3],[-5,-3],[-2,-1],[-1,-1],[-1,-2],[-2,-7],[0,-1],[-9,-16],[-1,-1],[-3,-3],[-8,-7],[-1,-3],[-1,-2],[0,-1],[0,-2],[1,-1],[0,-1],[1,0],[1,0],[2,0],[1,0],[3,2],[2,1],[1,1],[1,0],[4,0],[1,0],[1,0],[1,0],[2,1],[1,2],[1,1],[2,1],[2,1],[1,1],[2,0],[1,0],[2,-1],[3,-2],[6,-2],[2,-1],[1,-2],[0,-4],[0,-2],[-1,-1],[-1,-2],[-1,-1],[0,-2],[0,-1],[0,-2],[1,-3],[2,-6],[0,-3],[0,-6],[2,-12],[1,-2],[2,-3],[8,-9],[1,-1],[1,-1],[2,-1],[5,-2],[3,-1],[5,-6],[9,-4],[3,0],[2,1],[1,0],[12,10],[4,2],[3,1],[3,1],[12,0],[2,1],[1,1],[9,11],[2,2],[1,2],[1,3],[2,1],[1,2],[4,1],[2,1],[2,1],[2,2],[3,4],[1,2],[1,2],[0,2],[0,1],[-1,3],[0,1],[-2,5],[-3,4],[0,1],[-1,1],[0,1],[1,1],[1,2],[6,8],[1,1],[2,1],[2,1],[2,0],[1,0],[2,0],[1,0],[0,2],[-1,1],[-1,2],[1,1],[2,2],[6,1],[10,1],[5,-1],[2,0],[2,1],[2,2],[5,4],[1,1],[1,1],[0,1],[1,1],[0,2],[0,1],[0,2],[-1,1],[-1,3],[-1,1],[0,2],[0,1],[2,1],[3,1],[15,2],[5,-1],[5,-2],[1,-1],[3,0],[1,0],[3,2],[2,2],[6,7],[2,-2],[1,-3],[0,-1],[0,-2],[0,-1],[1,-1],[1,0],[2,0],[4,0],[2,0],[1,1],[3,2],[4,7],[1,1],[1,1],[2,0],[2,0],[2,-1],[1,-1],[1,-1],[0,-1],[0,-1],[0,-5],[0,-2],[0,-1],[1,-1],[1,0],[2,0],[1,0],[12,4],[5,0],[3,-1],[1,0],[2,-1],[1,-1],[2,-3],[1,0],[1,-1],[1,1],[1,1],[0,2],[-1,2],[1,2],[0,1],[1,1],[2,0],[2,-1],[4,-1],[1,0],[1,1],[1,1],[1,2],[0,1],[-1,1],[0,1],[-1,1],[-3,2],[-2,1],[-1,1],[0,1],[-1,1],[0,2],[0,1],[1,2],[0,1],[1,1],[1,0],[2,0],[1,-1],[1,-1],[0,-1],[-1,-1],[0,-2],[1,-1],[1,0],[1,-1],[1,1],[6,2],[2,0],[2,1],[3,1],[19,8],[2,1],[1,0],[1,-1],[2,-1],[1,0],[1,0],[1,0],[2,1],[2,1],[5,5],[4,3],[13,5],[2,6],[5,23],[2,15],[2,3],[1,3],[0,1],[2,0],[2,1],[13,-1],[1,0],[1,-1],[1,-1],[1,0],[1,-1],[2,0],[2,1],[2,1],[2,2],[4,7],[7,6],[2,1],[4,3],[1,0],[3,1],[3,0],[5,-1],[17,-5],[4,0],[4,2],[2,0],[1,0],[5,-1],[5,-2],[4,-4],[10,-11],[2,-5],[0,-1],[1,-2],[0,-1],[0,-1],[2,-1],[12,-4],[6,-5]],[[1592,6127],[40,-20]],[[1632,6107],[0,-2],[-1,-3],[-1,-2],[-2,-2],[-18,-8],[-5,-2],[-29,-26],[-36,-42],[-10,-7],[-2,0],[-5,-1],[-2,0],[-2,-2],[-1,-3],[-2,-3],[-2,-2],[-4,0],[-9,3],[-4,0],[-9,0],[-5,-1],[-3,-2],[-1,-2],[2,-6],[-1,-2],[-1,-2],[-3,-1],[-2,0],[-10,0],[-2,-1],[-2,-2],[-1,-2],[0,-2],[-1,-3],[-3,-5],[-4,-4],[-5,-3],[-9,-4],[-8,-4],[-4,-2],[-3,-3],[-3,-4],[-4,-8],[-3,-4],[-7,-6],[-2,-3],[-3,-7],[-2,-10],[-3,-7],[-8,-2],[-4,2],[-9,7],[-4,3],[-3,1],[-3,1],[-27,-2],[-6,2],[-4,-1],[-4,-1],[-6,-4],[-6,-4],[-3,-4],[-8,-17],[-12,-15],[-3,-5],[-6,-15],[-3,-6],[-4,-5],[-4,-5],[-4,-4],[-4,-2],[-11,-1],[-4,-2],[-7,-8],[-3,-1],[-4,1],[-3,0],[-4,-1],[-10,-3],[-11,-10],[-6,-3],[-32,-8],[-4,0],[-2,2],[0,2],[-1,11],[1,6],[3,6],[3,6],[-3,2],[-7,3],[-6,-2],[-6,-2],[-6,-2],[-5,1],[-11,3],[-5,0],[-1,0],[-2,0],[-1,0],[-16,8],[-4,1],[-7,-1],[-8,2],[-18,2],[-12,0],[-8,1],[-8,3],[-7,1],[-15,-4],[-9,-1],[-16,1],[-4,0],[-28,-4],[-7,2],[-9,6],[-3,2],[-6,0],[-9,0],[-5,0],[-4,2],[-9,0],[-54,-31],[-9,-4],[-11,-2],[-11,-1],[-12,2],[-10,6],[-5,6],[-10,13],[-6,6],[-5,-1],[-19,-17],[0,20],[0,33],[0,33],[0,32],[0,33],[0,32],[1,33],[0,33],[0,21],[0,11],[0,16],[2,10],[1,3],[2,2],[2,2],[2,1],[1,0],[3,-1],[1,0],[1,1],[1,3],[0,2],[3,4],[2,5],[0,4],[-1,6],[-3,3],[-6,6],[-3,4],[-1,5],[-2,8],[-2,5],[1,0],[6,0],[1,0],[3,-1],[2,1],[-3,6],[0,3],[2,3],[3,1],[0,1],[-1,2],[4,3],[1,3],[0,4],[3,4],[0,1],[0,4],[-9,-2],[-5,-1],[-4,-2],[-5,-5],[-8,-11],[-4,-4],[-14,-10],[-5,-4],[-8,-9],[-5,-4],[-11,-7],[-3,-5],[-7,-11],[-2,-2],[-6,-4],[-3,-2],[-1,-4],[-3,-6],[-2,-3],[-4,-4],[-14,-4],[-14,-7],[-4,-3],[-3,-6],[-2,-6],[-3,-5],[-11,-4],[-7,-7],[-5,-3],[-3,0],[-2,1],[-1,2],[-3,1],[-3,-1],[-1,-1],[-1,-2],[-2,-2],[-4,-1],[-8,0],[-40,0],[-39,0],[-40,0],[-39,0],[-12,0],[2,6],[0,4],[0,5],[0,5],[2,3],[3,4],[1,3],[-1,3],[-2,5],[0,3],[-5,10],[-16,12],[-2,9],[2,10],[1,5],[-1,5],[-6,8],[-2,4],[-1,5],[0,8],[0,2],[-1,2],[-2,1],[-3,-1],[-2,0],[-4,4],[-6,6],[-5,2],[-4,1],[-14,-1],[-10,2],[-4,1],[-9,5],[-9,3],[-4,1],[-1,0],[-2,-1],[-1,0],[-1,0],[-2,2],[-1,0],[-27,7],[-89,0],[5,9],[11,13],[6,8],[3,8],[3,4],[2,2],[3,1],[4,1],[3,2],[1,3],[0,7],[11,9],[2,4],[2,4],[1,8],[-3,22],[-1,4],[-6,10],[-3,4],[-8,6],[-4,3],[-17,29],[-4,11],[-2,5],[-4,4],[-4,2],[-13,4],[-5,2],[-4,5],[-9,14],[-1,4],[-1,5],[2,11],[0,6],[-1,4],[-3,4],[-2,1],[-5,1],[-2,1],[-2,2],[-4,5],[-2,3],[-18,11],[-3,3],[-2,5],[-1,11],[-2,6],[-6,10],[-3,6],[-1,5],[2,9],[-1,5],[-2,6],[-7,12],[-2,6],[-3,8],[-9,5],[-9,4],[-7,6],[-1,4],[-3,12],[1,5],[3,0],[7,-4],[8,6],[2,9],[-2,11],[-7,6],[-8,3],[-7,3],[-6,5],[-29,35],[-9,6],[-2,4],[8,4],[2,1],[3,6],[0,6],[2,3],[1,5],[-1,6],[-6,13],[-1,4],[5,0],[9,-4],[4,0],[5,2],[8,6],[4,1],[5,1],[9,-1],[4,1],[4,2],[3,6],[-1,4],[-2,5],[-2,11],[-15,25],[-1,2]],[[47,6824],[3,-1],[250,-120],[508,-145],[125,-76],[659,-355]],[[3355,8707],[5,-79],[-1,-6],[0,-3],[-2,-15],[0,-29],[0,-9],[2,-7],[1,-3],[1,-2],[2,-3],[2,-1],[3,-2],[11,-5],[3,-2],[2,-2],[2,-5],[1,-3],[-1,-3],[-2,-4],[0,-4],[0,-11],[-2,-12],[0,-7],[1,-5],[2,-3],[7,-11],[17,-18],[3,-2],[2,0],[5,1],[3,1],[2,-1],[3,-2],[10,-11],[2,-1],[4,-1],[3,-2],[3,-3],[1,-4],[3,-9],[1,-6],[1,-5],[1,-3],[1,-4],[0,-7],[0,-5],[1,-3],[2,-3],[2,-3],[16,-18],[2,-1],[2,-1],[2,-1],[5,0],[3,0],[2,-1],[2,-3],[8,-15],[3,-4],[3,-2],[3,-2],[2,0],[4,0],[2,-2],[2,-3],[2,-5],[3,-4],[2,-2],[17,-10],[5,-3],[3,-2],[4,-4],[5,-7],[3,-4],[3,-2],[16,-5],[4,-3],[4,-4],[6,-9],[4,-4],[3,-2],[4,-1],[2,-1],[2,-2],[2,-3],[3,-4],[2,-3],[2,-2],[21,-8],[5,-3],[6,-5],[6,-3],[6,-5],[2,-1],[10,-5],[2,-1],[5,0],[2,-1],[4,-3],[2,0],[2,0],[3,0],[5,1],[4,2],[2,1],[2,-1],[1,-2],[0,-6],[0,-3],[2,-2],[2,0],[8,1],[3,-1],[4,-1],[7,-5],[2,-2],[6,-2],[2,-2],[1,-2],[3,-8],[4,-8],[11,-13],[2,-3],[4,-2],[9,-3],[4,-3],[14,-12],[2,-1],[2,-1],[3,-1],[2,0],[3,0],[5,1],[2,0],[3,-1],[2,-2],[1,-3],[0,-2],[-1,-3],[-3,-14],[0,-3],[0,-3],[1,-4],[1,-2],[2,-1],[3,-1],[2,-1],[3,-3],[2,-1],[2,-1],[5,-1],[5,-2],[1,-1],[2,1],[1,1],[10,8],[1,0],[12,5],[2,1],[1,0],[2,0],[1,-1],[1,-1],[1,-1],[1,-3],[0,-1],[0,-2],[0,-1],[-2,-7],[0,-2],[0,-2],[1,-1],[0,-2],[1,0],[3,-1],[5,-1],[4,-1],[5,-1],[1,0],[0,-1],[1,1],[1,2],[2,1],[2,1],[13,5],[0,-1],[-1,-1],[-1,-2],[-5,-3],[-8,-5],[-2,-2],[-1,-1],[-1,-1],[0,-2],[-1,-1],[1,-2],[1,-3],[3,-3],[0,-5],[-2,-8],[-81,-204],[-341,-848],[-9,-16],[-2,-3],[-17,-17],[-3,-3],[-4,-6],[-3,-8],[-1,-5],[0,-6],[0,-5],[1,-5],[7,-27],[3,-6],[2,-5],[4,-6],[4,-4],[8,-6],[5,-4],[12,-15],[7,-6],[3,-5],[6,-11],[1,-3],[3,-14],[0,-5],[-1,-5],[0,-3],[0,-3],[1,-4],[4,-6],[4,-4]],[[3518,6768],[-4,-5],[-4,-7],[-2,-3],[-6,-5],[-1,-2],[-1,-2],[-1,-5],[0,-2],[-1,-5],[0,-5],[0,-1],[0,-2],[2,-5],[2,-5],[1,-3],[0,-3],[-1,-2],[0,-3],[-3,-8],[-2,-2],[-1,-3],[-6,-7],[-2,-3],[-6,-13],[-2,-2],[-6,-6],[-4,-4],[-4,-5],[-1,-2],[-1,-3],[0,-3],[0,-2],[0,-5],[1,-5],[1,-5],[1,-3],[5,-12],[4,-12],[4,-21],[1,-3],[-1,-3],[0,-2],[-7,-23],[0,-3],[0,-3],[1,-2],[0,-3],[-1,-2],[-4,-5],[-2,-5],[-1,-3],[-3,-10],[-1,-5],[-2,-2],[-1,-3],[-6,-5],[-2,-2],[0,-3],[0,-2],[2,-18],[1,-3],[1,-5],[0,-2],[0,-3],[-1,-2],[-4,-9],[-3,-7],[-3,-17],[-2,-4],[-4,-4],[-11,-7],[-679,-6]],[[2748,6401],[1,10],[0,3],[-2,2],[-3,2],[-13,2],[-3,1],[-3,1],[-4,-1],[-1,-2],[-4,-5],[-2,-2],[-2,-2],[-2,-1],[-8,1],[-2,-1],[-2,-2],[-2,-2],[-1,-2],[-1,-3],[-1,-3],[0,-6],[-1,-5],[0,-3],[-1,-2],[-1,-2],[-2,-2],[-3,-2],[-2,0],[-3,0],[-4,1],[-6,3],[-3,3],[-2,3],[-1,3],[-2,2],[-1,1],[-3,2],[-14,4],[-2,0],[-3,0],[-2,0],[-2,1],[-2,3],[-2,3],[0,3],[-2,11],[-1,5],[-3,8],[-1,3],[0,3],[0,5],[-1,2],[-2,2],[-5,2],[-4,0],[-7,-1],[-3,0],[-2,0],[-2,1],[-2,1],[-2,3],[-1,2],[-1,6],[-3,9],[-3,11],[-1,2],[-2,5],[-1,3],[-1,3],[0,2],[0,3],[-2,2],[-1,2],[-4,3],[-4,2],[-9,2],[-4,0],[-3,-1],[-2,-1],[-1,-1],[-2,0],[-2,-1],[-3,0],[-2,0],[-1,2],[0,2],[0,11],[-1,2],[-1,3],[-2,3],[-4,3],[-6,5],[-3,3],[-3,3],[-6,14],[-1,3],[1,5],[-1,2],[-2,3],[-10,13],[-2,2],[-3,2],[-3,1],[-10,4],[-3,2],[-3,1],[-16,2],[-141,2],[-4,-7],[-6,-11],[-1,-2],[0,-3],[0,-2],[2,-11],[0,-2],[-1,-2],[-2,-2],[-4,-1],[-3,0],[-2,0],[-7,-3],[-8,-1],[-3,-1],[-2,-1],[-2,-1],[-2,-3],[-1,-3],[0,-3],[2,-7],[0,-3],[0,-2],[-3,-2],[-8,-2],[-9,-3],[-11,-1],[-2,-1],[-3,-1],[-2,-2],[-2,-2],[-4,-9],[-1,-3],[-9,-10],[-1,-3],[-1,-2],[0,-3],[0,-3],[1,-2],[2,-3],[2,-2],[5,-3],[2,-2],[2,-2],[1,-2],[1,-3],[-1,-2],[0,-3],[-3,-5],[-1,-5],[-1,-3],[-2,-2],[-2,-2],[-2,-3],[-4,-10],[-2,-2],[-1,-1],[-3,-2],[-4,-2],[-5,-2],[-3,-1],[-4,0],[-1,2],[-2,2],[-1,2],[-2,1],[-2,0],[-2,-3],[0,-2],[0,-3],[1,-7],[0,-3],[0,-5],[0,-3],[0,-2],[2,-3],[0,-2],[0,-3],[-2,-5],[0,-3],[-1,-2],[0,-3],[4,-16],[0,-3],[0,-2],[-2,-1],[-3,2],[-5,4],[-3,1],[-2,-1],[-7,-3],[-2,0],[-6,2],[-4,1],[-7,0],[-13,1],[-2,-1],[-3,0],[-2,-2],[-4,-5],[-2,-1],[-2,-1],[-3,1],[-4,4],[-3,0],[-3,0],[-4,-2],[-5,-4],[-3,-3],[-3,-6],[-2,-2],[-3,-1],[-4,-1],[-21,2],[-2,0],[-2,1],[-2,2],[-4,3],[-1,2],[-3,1],[-2,0],[-3,-1],[-14,-9],[-6,-5],[-4,-4],[-2,-3],[-1,-2],[-1,-3],[-4,-5],[-1,-3],[0,-3],[0,-2],[5,-14],[0,-2],[0,-3],[-1,-3],[-1,-2],[-2,-3],[-7,-6],[-2,-2],[-1,-3],[0,-6],[-1,-2],[-2,-2],[-4,-3],[-1,-1],[-1,-2],[-3,-7],[-2,-3],[-2,-2],[-2,-3],[-4,-4],[-3,-2],[-2,-1],[-4,0],[-3,1],[-3,2],[-2,2],[-2,3],[-2,3],[-2,3],[-1,2],[0,3],[0,3],[0,5],[0,2],[-2,3],[-1,2],[-2,2],[0,3],[0,5],[-1,2],[-2,1],[-3,-1],[-4,-3],[-2,-3],[-4,-3],[-15,-8],[-4,-4],[-4,-4],[-1,-2],[-2,-2],[-7,-5],[-2,-2],[-2,-3],[0,-2],[-1,-5],[0,-3],[-2,-2],[-3,0],[-4,1],[-2,2],[-2,2],[0,2],[-2,1],[-2,2],[-2,1],[-2,1],[-3,0],[-3,-1],[-16,-9],[-3,-3],[-1,-3],[-1,-2],[-2,-9],[0,-2],[-2,-3],[-3,-2],[-5,-2],[-3,-3],[-4,-1],[-2,-1],[-3,1],[-2,2],[-3,5],[-2,2],[-4,3],[-2,1],[-1,2],[0,1],[-1,1],[-1,1],[-6,3],[-2,2],[-5,8],[-5,5],[-3,3],[-2,1],[-2,2],[-7,1],[-4,-1],[-23,-4],[-10,-1],[-11,1],[-6,1],[-5,2],[-3,0],[-3,0],[-5,-2],[-6,1],[-5,0],[-2,1],[-5,1],[-2,0],[-2,-1],[-1,-3],[0,-3],[3,-10],[0,-3],[-1,-5],[0,-3],[-2,-3],[-16,-19],[-4,-7],[-3,-3],[-5,-2],[-13,-4],[-2,-1],[-8,-7],[-14,-15],[-3,0],[-6,1],[-2,-1],[-1,-3],[-1,-2],[-3,-4],[-2,-3],[-12,-11]],[[47,6824],[-1,4],[1,7],[3,7],[6,23],[0,14],[1,4],[3,4],[9,6],[2,3],[3,7],[3,3],[6,4],[11,10],[18,12],[15,15],[9,6],[7,8],[5,2],[16,0],[10,3],[8,5],[6,7],[5,11],[3,10],[1,6],[0,6],[-1,6],[-5,11],[-1,6],[-3,21],[-1,4],[-10,14],[-3,6],[1,12],[3,10],[5,9],[13,32],[7,8],[23,36],[3,7],[3,7],[3,24],[0,7],[-2,8],[-1,9],[3,8],[6,16],[1,4],[1,11],[2,4],[3,3],[1,4],[1,4],[-1,15],[-1,4],[-3,4],[-1,5],[1,3],[5,2],[3,0],[2,1],[3,2],[0,1],[0,3],[1,2],[1,0],[3,-1],[1,0],[9,2],[4,1],[3,5],[3,2],[4,0],[4,-2],[12,0],[2,1],[2,2],[1,2],[0,3],[1,3],[3,3],[6,3],[6,7],[3,3],[4,2],[4,1],[3,0],[2,1],[0,3],[2,2],[0,1],[0,1],[0,2],[1,1],[1,1],[3,0],[1,0],[5,3],[3,3],[3,4],[1,14],[3,3],[9,3],[1,1],[0,2],[2,2],[2,1],[9,-2],[2,1],[4,1],[4,3],[12,9],[12,8],[4,4],[3,4],[4,9],[1,2],[2,0],[2,-1],[2,-1],[2,1],[2,1],[4,4],[6,2],[11,12],[6,5],[3,1],[19,2],[1,1],[1,1],[0,2],[1,1],[2,1],[2,0],[5,-3],[3,0],[4,0],[2,2],[3,1],[3,-3],[3,-2],[1,-1],[2,0],[3,1],[5,5],[2,1],[-1,-6],[10,5],[3,1],[6,-2],[1,0],[2,2],[1,5],[1,3],[4,1],[3,1],[7,0],[10,2],[3,-1],[2,-2],[1,-3],[2,-1],[3,1],[1,1],[2,3],[1,1],[2,0],[1,-1],[1,0],[2,3],[0,3],[0,2],[0,3],[4,4],[5,1],[5,-1],[6,-8],[3,4],[3,6],[4,3],[1,-2],[3,-6],[2,-2],[3,0],[2,1],[3,6],[6,2],[11,-5],[4,4],[1,6],[4,-5],[5,-5],[4,5],[2,5],[3,4],[7,8],[2,4],[1,5],[2,3],[3,2],[3,2],[1,2],[-2,6],[1,4],[3,3],[10,6],[3,0],[13,-4],[4,-1],[3,3],[2,7],[2,3],[4,2],[3,-1],[1,-4],[-1,-4],[0,-4],[10,-7],[2,2],[1,5],[2,4],[3,3],[4,-2],[1,-4],[1,-4],[2,-1],[3,1],[9,9],[4,1],[3,1],[3,0],[4,-2],[5,-6],[3,0],[4,7],[3,-1],[3,-3],[1,-4],[1,-5],[-2,-10],[0,-5],[2,-3],[11,-10],[2,-1],[2,0],[2,0],[1,-3],[2,-4],[3,-3],[4,4],[3,10],[3,4],[4,3],[5,0],[5,-2],[2,-4],[1,-7],[1,-1],[3,-4],[3,-2],[3,-1],[3,1],[7,6],[4,6],[2,7],[0,7],[0,1],[1,1],[0,1],[1,1],[0,1],[0,1],[1,0],[0,1],[0,1],[1,0],[0,1],[6,41],[7,42],[6,41],[7,41],[6,42],[7,41],[6,41],[7,42],[6,41],[7,41],[6,41],[7,42],[6,41],[7,41],[6,42],[7,41],[2,16],[4,13],[-1,5],[4,17],[0,12],[4,24],[-1,11],[5,15],[-2,7],[-9,16],[0,3],[2,5],[0,3],[-1,10],[1,0],[-1,2],[-1,1],[-1,1],[-2,0],[-2,2],[-5,8],[-2,1],[-5,3],[-1,1],[-2,4],[0,2],[1,3],[0,3],[-2,3],[-1,1],[-2,1],[-1,2],[-2,3],[-1,3],[1,6],[-2,4],[-8,11],[-3,6],[2,5],[7,12],[1,6],[0,3],[-2,2],[-1,2],[-1,2],[-1,3],[0,8],[-1,5],[-2,5],[-2,5],[-4,4],[-4,2],[-18,8],[-3,3],[-7,8],[-2,2],[-5,3],[-2,2],[-2,2],[-2,6],[-1,2],[-4,3],[-9,2],[-4,2],[-3,3],[-5,8],[-11,12],[-8,11],[-3,6],[-1,9],[0,13],[0,6],[1,18],[0,24],[1,28],[1,28],[0,24],[1,17],[0,7],[0,18],[3,-4],[5,2],[4,2],[5,0],[6,-1],[4,1],[4,1],[15,1],[9,2],[9,4],[7,5],[9,7],[3,1],[6,-4],[7,-1],[4,4],[2,6],[4,2],[5,0],[7,6],[4,2],[6,1],[4,-1],[4,-4],[16,-18],[1,-1],[5,3],[5,1],[4,0],[2,-3],[-1,-7],[4,1],[8,-2],[4,0],[1,2],[2,4],[2,1],[3,0],[4,-2],[2,0],[4,1],[1,4],[-1,4],[-2,6],[-2,2],[-5,2],[-1,2],[-1,4],[2,2],[2,2],[1,3],[0,6],[-2,11],[1,5],[1,1],[2,1],[2,1],[0,3],[-2,2],[-2,2],[-5,3],[-4,4],[1,9],[-4,3],[-1,3],[0,3],[-1,2],[-2,2],[-3,3],[-4,5],[-3,3],[-11,7],[-4,0],[-4,-1],[-10,-8],[-2,0],[-4,3],[-2,1],[0,1],[-1,1],[-2,1],[-2,1],[-7,-1],[-8,-1],[-2,1],[-10,4],[-5,0],[-21,-4],[-2,1],[-1,5],[-2,2],[-2,0],[-3,1],[-6,-2],[-9,-7],[-5,0],[0,16],[0,17],[0,18],[0,18],[0,17],[0,18],[0,17],[1,18],[0,18],[-2,10],[3,0],[8,0],[4,1],[9,6],[4,1],[4,0],[5,-1],[9,1],[15,8],[9,0],[16,-4],[16,-8],[10,-1],[10,0],[28,0],[40,0],[45,0],[45,0],[40,0],[28,0],[10,0],[17,0],[-4,2],[-2,2],[0,2],[0,3],[-1,2],[-2,1],[-8,1],[0,4],[0,6],[-2,3],[-6,1],[-1,1],[4,7],[14,39],[2,1],[1,-1],[0,-5],[0,-2],[2,-2],[2,-1],[4,-1],[5,-3],[4,-3],[2,-5],[5,-16],[4,-12],[6,-9],[8,-8],[7,-2],[8,0],[8,2],[7,3],[9,6],[7,8],[26,41],[17,21],[9,4],[6,6],[4,3],[7,1],[2,1],[4,5],[2,1],[4,0],[9,-4],[4,-2],[5,-6],[5,-10],[7,-20],[5,-11],[24,-37],[9,-20],[7,-27],[2,-16],[-5,-74],[1,-13],[2,-7],[4,-1],[19,7],[15,4],[8,2],[4,-4],[11,-11],[15,-16],[17,-18],[18,-18],[15,-15],[11,-12],[4,-4],[9,-10],[13,-10],[14,-4],[13,4],[4,0],[4,-2],[4,-3],[3,-2],[5,-1],[6,3],[7,9],[4,3],[10,0],[4,2],[5,3],[5,5],[8,12],[5,5],[4,4],[20,10],[9,7],[5,2],[4,0],[16,0],[5,0],[3,0],[3,-2],[2,-2],[3,-3],[5,-7],[2,-5],[2,-6],[0,-6],[-3,-12],[-7,-10],[-5,-10],[0,-12],[2,-5],[3,-4],[4,-2],[6,1],[4,2],[6,3],[5,5],[4,8],[4,5],[1,3],[0,8],[0,2],[2,6],[2,5],[14,19],[4,2],[6,1],[9,-2],[4,0],[5,3],[5,8],[2,10],[2,22],[5,12],[8,2],[9,-1],[9,2],[0,1],[0,4],[1,1],[1,1],[2,1],[1,0],[7,8],[2,1],[5,2],[5,0],[3,2],[5,3],[5,7],[3,3],[4,0],[11,-7],[5,0],[4,1],[28,21],[3,5],[5,12],[4,6],[5,4],[12,7],[9,8],[6,3],[5,1],[4,-3],[1,-5],[-5,-11],[-2,-5],[0,-6],[1,-6],[4,-3],[4,2],[3,5],[4,10],[4,6],[16,13],[12,13],[10,7],[5,6],[4,6],[2,6],[1,5],[1,5],[-1,15],[4,16],[1,22],[4,9],[9,8],[8,3],[9,1],[26,-1],[4,1],[5,3],[32,29],[12,7],[3,0],[6,-1],[3,0],[14,4],[7,3],[3,5],[-1,5],[1,4],[3,8]],[[2355,9222],[2,-2],[10,-12],[6,-4],[4,-2],[5,0],[3,0],[2,0],[3,1],[6,3],[3,1],[4,1],[5,-1],[3,-2],[1,-2],[0,-6],[0,-3],[2,-3],[3,-4],[8,-10],[5,-5],[4,-2],[6,-3],[3,-1],[3,1],[5,1],[2,0],[3,0],[5,-1],[3,-1],[7,1],[3,-1],[6,-3],[13,-8],[7,-3],[3,-2],[3,-2],[1,-3],[2,-3],[0,-3],[0,-3],[-1,-3],[-6,-8],[-1,-3],[-1,-3],[0,-3],[0,-3],[3,-10],[1,-9],[0,-2],[-1,-3],[-6,-4],[-2,-2],[-2,-9],[-1,-3],[-4,-4],[-1,-3],[1,-4],[7,-13],[4,-9],[4,-6],[2,-3],[3,-3],[2,-1],[2,-2],[3,-2],[4,-3],[5,-6],[2,-4],[0,-4],[0,-3],[0,-3],[13,-45],[0,-8],[1,-3],[1,-3],[6,-13],[1,-6],[1,-25],[2,-5],[10,-23],[2,-7],[0,-5],[-3,-5],[-5,-5],[-4,-3],[-3,-2],[-3,-1],[-2,-2],[-1,-3],[-1,-3],[1,-3],[1,-6],[11,-35],[2,-5],[-1,-2],[-1,-6],[-1,-6],[-1,-2],[-2,-1],[-3,-4],[-2,-2],[-2,-3],[0,-2],[0,-3],[2,-13],[0,-4],[0,-2],[-1,-3],[-6,-11],[-1,-3],[-1,-3],[1,-18],[1,-3],[1,-3],[5,-8],[1,-4],[1,-3],[-4,-13],[-2,-3],[-2,-2],[-2,0],[-2,-2],[-1,-2],[-1,-5],[2,-6],[2,-3],[5,-6],[3,-4],[3,-6],[2,-4],[4,-17],[1,-5],[2,-3],[2,-2],[3,-2],[7,-4],[2,-1],[2,-3],[5,-11],[2,-4],[1,-4],[0,-6],[0,-7],[-1,-12],[0,-4],[1,-3],[1,-2],[2,-2],[5,-3],[1,-2],[1,-1],[2,-3],[3,-23],[0,-3],[-1,-3],[-1,-2],[-4,-7],[-2,-2],[-4,-2],[-1,-2],[-2,-5],[-2,-2],[-2,-1],[-2,0],[-2,1],[-4,2],[-2,1],[-10,3],[-2,0],[-2,0],[-1,-1],[0,-2],[-1,-9],[0,-4],[0,-4],[1,-3],[1,-2],[1,-1],[1,-1],[12,-4],[2,-2],[1,-1],[3,-4],[5,-8],[15,-18],[4,-3],[4,-2],[2,0],[3,-2],[3,-3],[9,-16],[1,-2],[2,-1],[2,0],[5,-1],[2,0],[2,-2],[13,-12],[10,-6],[2,-1],[2,-3],[2,-4],[4,-9],[2,-3],[2,-2],[1,0],[2,-1],[1,0],[2,-2],[1,-1],[1,-1],[13,-32],[1,-2],[1,-1],[1,-1],[1,0],[2,-1],[1,0],[1,0],[3,1],[1,0],[9,5],[5,2],[2,-1],[2,-2],[3,-4],[2,-2],[2,-1],[1,0],[6,0],[9,-2],[4,-2],[1,-1],[3,-1],[0,5],[-4,27],[0,3],[0,2],[6,18],[4,16],[0,3],[0,9],[0,3],[0,3],[1,3],[1,2],[1,2],[1,3],[-1,3],[-4,20],[0,6],[0,3],[1,5],[5,13],[0,2],[2,16],[2,8],[1,2],[1,2],[1,2],[6,5],[1,2],[1,2],[2,5],[1,2],[1,2],[2,1],[16,10],[2,1],[8,2],[18,7],[2,2],[1,1],[2,2],[1,2],[1,3],[1,4],[0,2],[1,0],[1,1],[1,0],[2,1],[4,-1],[2,0],[8,2],[2,0],[3,-1],[2,0],[2,-1],[1,-1],[4,-5],[1,-1],[2,-2],[12,-3],[3,-1],[8,0],[3,-1],[3,-1],[1,-3],[2,-6],[1,-4],[2,-2],[2,-2],[3,-1],[3,-4],[6,-6],[6,-6],[2,-3],[5,-13],[2,-6],[1,-2],[1,-1],[1,-2],[-1,-5],[0,-4],[2,-3],[2,-2],[2,-1],[14,-1],[5,-1],[2,0],[2,0],[2,2],[2,1],[1,1],[1,1],[1,1],[4,0],[5,1],[5,-1],[3,0],[2,1],[1,2],[1,3],[1,5],[1,2],[0,1],[2,2],[1,2],[0,3],[2,2],[1,1],[15,4],[6,4],[8,1],[2,1],[2,2],[2,1],[1,2],[0,3],[1,2],[-1,3],[0,3],[-1,3],[-1,2],[-13,16],[-1,2],[-1,3],[-2,5],[0,2],[0,2],[2,10],[0,3],[1,2],[3,5],[1,2],[1,6],[1,2],[3,8],[1,5],[4,7],[1,3],[0,3],[0,13],[1,2],[1,3],[3,4],[8,13],[1,2],[1,3],[1,8],[1,3],[2,5],[1,3],[1,3],[1,2],[10,11],[6,15],[1,3],[0,3],[0,2],[0,3],[1,3],[1,2],[2,2],[2,2],[3,0],[4,4],[2,1],[2,3],[1,2],[0,3],[0,2],[1,2],[6,3],[56,2],[199,-1]],[[6535,7925],[0,-3],[2,3],[6,8],[-2,-20],[-1,-5],[-2,-3],[-1,-3],[2,-9],[-4,-3],[-5,-2],[-4,-9],[-6,-8],[0,-3],[-1,-2],[-1,-1],[-1,0],[0,2],[-1,1],[0,2],[-1,1],[0,2],[1,1],[2,6],[2,2],[1,3],[1,6],[2,6],[0,3],[0,5],[-4,10],[-1,4],[1,5],[2,7],[6,15],[5,4],[10,6],[-1,-15],[-3,-12],[-2,0],[-2,-2],[0,-2]],[[7069,7938],[-6,0],[-8,1],[-5,4],[-5,3],[-8,1],[-2,5],[0,6],[2,3],[2,1],[3,-3],[2,-3],[4,-4],[7,-2],[4,-2],[5,-5],[4,-2],[1,-3]],[[7079,7958],[3,-4],[0,1],[1,0],[0,1],[1,0],[0,-3],[1,-3],[0,-2],[1,-3],[-2,-1],[-1,-1],[-2,-1],[-5,-1],[-3,1],[-2,1],[-2,2],[4,2],[1,0],[0,2],[-3,0],[-2,2],[-1,2],[1,3],[-4,-1],[-5,2],[-9,6],[3,1],[18,-2],[4,-1],[3,-3]],[[6690,8020],[3,-1],[0,1],[3,3],[0,1],[3,2],[2,0],[2,-4],[-1,-4],[-1,-4],[-1,-5],[-2,-2],[-7,-2],[-3,0],[-3,1],[-1,4],[0,3],[1,4],[1,3],[0,3],[-1,2],[-2,3],[1,1],[1,1],[3,2],[3,-1],[1,-3],[-1,-3],[-1,-5]],[[6746,8029],[-2,-1],[-3,2],[-4,1],[-1,4],[-1,3],[1,3],[4,1],[2,1],[4,1],[4,0],[1,-3],[-1,-5],[-2,-3],[-2,-4]],[[6730,8034],[-1,-1],[-4,1],[-4,0],[-2,-1],[-2,-2],[-2,0],[0,-1],[-1,-3],[-1,0],[-3,1],[-2,1],[-2,2],[0,2],[2,2],[1,5],[-1,5],[0,6],[2,4],[2,7],[3,4],[4,3],[4,1],[2,0],[4,1],[3,1],[4,-1],[1,-3],[1,-4],[-2,-5],[-4,-4],[-1,-4],[0,-7],[0,-4],[-2,-2],[1,-2],[0,-2]],[[6452,8323],[3,-3],[0,-3],[-2,-8],[-1,0],[-1,2],[-2,1],[-2,1],[-1,1],[0,-2],[1,-2],[1,-1],[2,-2],[-2,-1],[-1,-2],[-2,-2],[-1,-2],[-2,-1],[-2,-1],[-2,-1],[-2,1],[0,-6],[-4,-1],[-5,2],[-3,3],[-2,4],[0,5],[1,5],[1,3],[3,-2],[2,-2],[0,-3],[0,-4],[3,8],[1,5],[-3,3],[0,2],[1,3],[2,3],[6,-3],[2,1],[2,2],[2,1],[1,-1],[2,-1],[4,-2]],[[7127,7940],[-1,-4],[-2,-15],[-1,0],[-2,1],[0,-5],[3,-7],[0,-4],[1,-3],[6,-4],[2,-3],[1,-5],[-2,-3],[-2,-4],[-1,-4],[-1,-6],[-1,-3],[-4,-5],[-4,-7],[-3,-3],[-7,-4],[-2,-4],[-3,-11],[-1,-2],[-1,-2],[-3,0],[-1,-1],[-2,-2],[0,-2],[-1,-1],[-1,-4],[-3,-3],[-22,-7],[-3,-2],[1,-2],[3,-2],[1,-2],[-1,-3],[-17,-25],[-9,-8],[-6,-1],[-4,-2],[-4,0],[-10,0],[-5,-2],[-1,0],[-3,1],[-1,-1],[-1,0],[-2,-3],[-2,0],[-5,0],[-2,0],[-2,-1],[-2,-2],[-3,-1],[-2,0],[-2,2],[-1,3],[-2,2],[-3,0],[-1,-1],[-1,-6],[-1,-2],[-4,-5],[-5,-11],[-4,-5],[-12,-12],[-8,-14],[-2,-7],[1,-3],[1,-20],[-2,-4],[-6,-8],[-1,-4],[-1,-5],[-1,-6],[-2,-5],[-2,-3],[-7,-5],[-2,-1],[-2,-2],[-1,-3],[-1,-2],[-10,-12],[-3,-5],[-1,-2],[-1,-9],[0,-1],[-3,-5],[-1,-1],[-3,-8],[-2,-2],[-2,-1],[-4,-2],[-4,-4],[-9,-11],[-1,-5],[1,-13],[0,-4],[2,-5],[2,-12],[3,-4],[3,1],[4,0],[3,-2],[2,-3],[2,-5],[2,-10],[3,-5],[1,-4],[-1,-7],[-2,-11],[-5,-12],[0,-1],[-3,-5],[-3,-3],[-5,-2],[0,-5],[4,-9],[0,-5],[-1,-3],[-3,-4],[-1,-4],[2,-5],[3,-3],[3,-2],[3,-4],[3,-9],[1,-9],[1,-2],[4,-2],[1,-2],[1,-3],[0,-3],[0,-2],[-1,-3],[1,-4],[3,-9],[1,-5],[1,-16],[0,-4],[6,-12],[1,-5],[-1,-3],[-4,-6],[-2,-2],[0,-3],[0,-3],[0,-5],[0,-12],[-4,-7],[-14,-13],[-2,-2],[-4,-9],[-1,-4],[-6,-6],[-2,-2],[-9,-22],[-2,-2],[-1,-1],[-3,-5],[-2,-1],[-2,-1],[-3,0],[-2,-1],[-3,-3],[0,-4],[2,-4],[1,-4],[0,-1],[-2,-3],[0,-2],[1,-1],[2,-3],[0,-1],[0,-4],[-1,-2],[-2,-2],[-1,-3],[-1,-4],[1,-19],[2,-5],[1,-3],[-3,-5],[0,-2],[0,-6],[1,-5],[1,-5],[7,-9],[0,-5],[-1,-4],[-2,-5],[2,-3],[3,-8],[2,-3],[3,-1],[4,-1],[3,-2],[0,-1],[2,-5],[3,-4],[1,-3],[2,-3],[1,-1],[3,-1],[2,-1],[3,-4],[4,-3],[9,-3],[3,-4],[0,-19],[1,-2],[2,-1],[1,0],[0,-3],[-5,-5],[-1,-2],[-3,-15],[1,-3],[2,-6],[0,-3],[0,-2],[-2,-1],[-1,-1],[-1,-1],[0,-15],[-2,-5],[-1,-2],[-4,-4],[-1,-3],[0,-2],[0,-6],[-1,-5],[-2,-5],[-12,-15],[-4,-4],[-4,-2],[-5,1],[-4,1],[-4,0],[-5,-2],[-4,-2],[-4,-1],[-5,1],[-4,3],[-5,3],[-6,-2],[-8,-7],[-4,-2],[-5,-1],[-10,0],[-5,-2],[-3,-3],[-3,-3],[-3,-3],[-3,0],[-8,0],[-3,1],[-2,1],[-2,2],[-4,6],[-1,2],[-2,1],[-4,2],[-2,1],[0,1],[-1,3],[-1,3],[-2,2],[-4,-2],[-2,1],[0,1],[-13,8],[2,0],[-7,3],[-8,1],[-17,-2],[-1,0],[-2,0],[-2,0],[-1,-1],[-3,-4],[-1,-1],[-5,-1],[-4,-3],[-6,-2],[-8,-2],[-3,0],[-1,1],[0,2],[-2,1],[-2,1],[-3,-4],[-1,-1],[-4,-1],[-6,-1],[-3,-2],[-1,-3],[-1,-8],[-1,-3],[-5,5],[-1,1],[-2,-1],[-2,-2],[-1,-2],[3,-2],[1,-2],[1,-2],[-1,-1],[-2,0],[-2,0],[1,1],[-3,-2],[-5,-5],[-2,-1],[-2,-1],[0,-2],[-1,-5],[0,-3],[-1,-1],[-2,-1],[-1,-2],[-3,-7],[-2,-2],[-5,-6],[-2,-1],[-2,0],[-2,-1],[-7,-21],[-2,-4],[-2,-2],[-7,0],[-4,-1],[-3,-2],[-6,-1],[-12,-5],[-10,-8],[-5,-8],[-2,-2],[-11,-8],[-5,-11],[-4,-5],[-1,2],[-7,-4],[-3,-4],[-2,-4],[-2,-8],[-2,-3],[-4,-1],[-6,6],[-3,2],[-2,-1],[-3,-1],[-3,-1],[-3,1],[-3,2],[-9,-7],[-1,-2],[-1,-4],[-3,0],[-3,1],[-1,-2],[0,-4],[-2,-2],[-8,-4],[-14,-7],[-4,-2],[-17,-3],[-16,-8],[-9,-2],[-14,-1],[-4,-2],[-13,-12],[-18,-11],[-8,-7],[-5,-10],[-3,-19],[-4,-12],[0,-5],[-1,-1],[-1,-1],[-1,0],[-1,-1],[0,-1],[2,-3],[0,-1],[-2,-9],[-1,2],[0,-5],[-1,-4],[-1,-4],[2,-3],[0,-1],[-2,-3],[1,-1],[2,-2],[0,-2],[0,-1],[-3,-2],[-1,-2],[0,-12],[-3,-20],[-1,-2],[-3,-3],[-1,-2],[-3,-9],[0,-2],[-4,-2],[-3,-4],[-2,-1],[0,-1],[-1,-4],[-1,-2],[1,-5],[0,-3],[-7,-13],[0,-3],[-3,-2],[-3,-5],[-4,-9],[-1,-21],[-3,-11],[-7,-6],[0,-2],[5,-2],[-1,-2],[-5,-5],[-2,-3],[-3,-11],[-2,-5],[-3,-2],[-5,-3],[-1,-1],[-4,-4],[-1,-2],[0,-2],[-1,-2],[-1,-2],[-3,0],[-5,-5],[-3,-7],[0,-7],[-3,-3],[-3,-6],[-2,-7],[-1,-6],[2,-6],[7,-15],[0,-4],[2,-5],[0,-18],[1,-6],[1,-4],[1,-3],[3,-3],[0,-2],[-1,-1],[0,-1],[1,-1],[0,-2],[0,-23],[2,-8],[7,-8],[7,-3],[1,-1],[3,-5],[2,-4],[1,-5],[1,-8],[0,-4],[-2,-6],[-2,-4],[-3,-2],[-2,-3],[0,-6],[0,-12],[-2,-22],[1,-12],[3,-10],[-4,-6],[-2,-8],[-2,-17],[2,-18],[-1,-9],[-6,-3],[-3,-2],[0,-6],[1,-5],[-1,-5],[-11,-20],[-1,-4],[2,-2],[2,-5],[0,-2],[0,-2],[0,-3],[-2,-8],[0,-5],[0,-9]],[[6218,6004],[-13,7],[-4,3],[-1,1],[-1,1],[-8,13],[-4,3],[-23,9],[-5,0],[-2,0],[-13,-4],[-2,1],[-3,0],[-6,2],[-2,1],[-2,1],[-4,9],[-3,4],[-4,3],[-3,4],[-3,8],[-1,2],[-1,2],[-6,7],[-1,1],[-1,1],[0,2],[0,1],[0,1],[1,5],[1,7],[-1,5],[0,2],[-4,9],[-2,4],[-3,3],[-16,11],[-9,10],[-2,2],[-2,1],[-2,0],[-3,2],[-1,1],[-1,2],[-1,6],[0,3],[1,3],[1,4],[1,2],[1,1],[1,1],[1,1],[1,0],[1,0],[2,0],[1,0],[2,0],[1,1],[1,0],[1,1],[0,1],[1,3],[2,7],[0,1],[1,2],[2,2],[4,6],[3,2],[1,1],[0,1],[1,1],[0,1],[0,2],[0,2],[-1,3],[-1,2],[-1,1],[-3,2],[-2,1],[-3,2],[-18,8],[-20,12],[-8,8],[-4,4],[-4,10],[0,1],[-1,3],[0,7],[1,10],[0,3],[-3,14],[-1,2],[-9,15],[-1,1],[-11,9],[-1,1],[-3,0],[-3,0],[-10,-1],[-2,1],[-3,0],[-2,1],[-2,2],[-4,3],[-1,2],[-1,2],[0,2],[1,2],[1,3],[1,3],[0,1],[1,1],[1,1],[4,5],[3,4],[4,3],[2,4],[2,2],[2,3],[1,2],[5,3],[1,1],[1,2],[3,1],[4,5],[3,2],[0,1],[1,2],[0,1],[0,1],[-5,18],[0,1],[0,2],[4,8],[1,2],[0,6],[1,3],[0,1],[1,6],[2,12],[3,9],[2,3],[3,8],[1,3],[0,2],[2,3],[1,2],[7,7],[1,0],[16,8],[13,2],[1,0],[6,0],[1,0],[6,0],[21,0],[1,1],[1,0],[1,1],[-1,1],[0,1],[-3,2],[0,1],[-1,0],[-1,1],[0,1],[-3,5],[-2,4],[-1,3],[0,1],[0,2],[1,0],[3,2],[1,1],[1,0],[1,2],[0,1],[1,1],[0,8],[1,3],[2,7],[1,2],[0,1],[-1,1],[-1,3],[-1,2],[-1,2],[1,1],[1,2],[1,1],[1,7],[1,5],[0,1],[1,1],[2,2],[1,2],[0,3],[-1,2],[-1,5],[-1,3],[-1,12],[-1,3],[-1,2],[-12,5],[-1,1],[-1,2],[-3,5],[-1,1],[-1,1],[-1,1],[-1,0],[-1,0],[-2,0],[-1,0],[-1,0],[-1,-1],[-1,0],[-1,-1],[-2,-1],[-3,0],[-15,-1],[-7,-2],[-2,-2],[-1,-1],[-1,-1],[-1,-1],[-2,-1],[-11,-2],[-1,0],[-1,0],[-1,0],[-7,-1],[-1,-1],[-1,-1],[-1,-1],[-1,-1],[-1,0],[-2,0],[-1,-1],[-3,-3],[-2,-2],[-2,0],[0,-1],[-1,-2],[-3,-4],[-1,-1],[0,-1],[-5,-2],[-4,-1],[-1,0],[-2,0],[-1,1],[-2,2],[-1,2],[-1,2],[0,3],[-1,2],[-1,2],[-1,1],[-1,0],[-3,1],[-2,2],[-1,2],[-2,6],[-1,3],[-12,19],[-1,2],[-1,0],[-4,2],[-3,2],[-3,5],[-4,11],[-2,3],[-1,2],[-1,1],[-1,1],[-2,0],[-1,0],[-1,1],[-2,0],[-1,1],[-1,2],[0,1],[1,1],[0,2],[0,2],[-1,2],[-1,1],[-2,1],[-1,1],[0,1],[1,1],[0,1],[1,2],[-1,1],[-4,5],[-1,1],[-1,1],[0,-1],[-1,-1],[0,-2],[0,-1],[0,-2],[-1,-1],[-1,0],[-1,1],[-1,1],[0,1],[0,2],[0,1],[-1,3],[-2,8],[-2,3],[-1,1],[-1,1],[-3,0],[-1,0],[-2,1],[0,1],[1,3],[0,2],[-1,3],[-1,2],[-1,1],[-4,0],[-1,0],[-1,-1],[-1,-1],[-1,0],[-2,0],[-2,2],[-1,2],[-3,7],[-1,1],[0,1],[-1,7],[0,1],[-1,1],[0,1],[-1,0],[-1,0],[-1,1],[-6,-1],[-5,-1],[-1,0],[-2,-1],[-3,2],[7,7],[8,4],[7,6],[3,11],[-2,9],[-6,6],[-8,2],[-9,1],[-3,-3],[-5,-5],[-4,-2],[-4,11],[-4,4],[-8,6],[-5,8],[3,8],[9,4],[10,-3],[12,23],[16,15],[2,7],[1,5],[3,15],[1,2],[0,2],[-1,2],[-1,2],[-1,2],[0,2],[0,1],[0,16],[1,7],[3,8],[-2,9],[1,9],[6,17],[1,10],[0,4],[2,4],[6,8],[2,4],[-3,6],[0,6],[4,13],[-2,8],[7,19],[1,11],[-2,5],[-6,9],[-1,5],[0,5],[-3,9],[0,33],[3,17],[0,10],[-1,3],[-2,3],[-1,5],[-2,3],[0,3],[0,3],[-1,2],[-1,2],[-1,3],[-5,4],[-1,2],[3,39],[-6,16],[-4,8],[-5,5],[-4,1],[-9,1],[-3,2],[-4,4],[-21,14],[-4,1],[-5,1],[-8,-1],[-5,-1],[-4,2],[-3,4],[-1,5],[-1,11],[-1,6],[-3,5],[-5,2],[-8,4],[-9,1],[-5,1],[-4,-2],[-5,-5],[-5,-2],[-11,0],[-9,2],[-35,20],[-4,2],[0,1],[-2,1],[-17,0],[-9,-2],[-9,-4],[-7,-4],[-3,-3],[-3,-5],[-6,-17],[-1,-2],[-3,-3],[-2,-2],[-1,1],[-2,4],[-4,2],[-8,-2],[-2,-1],[-8,-11]],[[5603,7276],[-4,1],[0,1],[2,2],[106,99],[100,92],[4,-1],[1,-1],[1,0],[3,1],[3,2],[2,0],[1,0],[1,-1],[1,-1],[0,-1],[1,0],[3,-2],[2,0],[6,0],[2,1],[2,0],[16,15],[5,7],[0,1],[2,4],[0,1],[0,1],[1,1],[4,4],[0,1],[2,4],[1,2],[5,6],[1,1],[0,1],[1,4],[4,7],[0,1],[1,2],[0,3],[1,3],[1,1],[5,7],[3,3],[7,5],[2,2],[2,4],[0,1],[-1,2],[1,4],[2,6],[3,5],[2,4],[-3,6],[3,0],[0,4],[1,6],[1,6],[3,3],[1,-1],[3,-2],[1,4],[1,3],[2,1],[2,-1],[14,14],[5,8],[5,7],[3,3],[7,4],[3,2],[4,7],[3,9],[2,23],[2,8],[1,4],[0,3],[-1,4],[0,1],[0,2],[2,3],[1,2],[-1,6],[1,2],[1,1],[1,2],[1,1],[-1,1],[-1,1],[0,1],[0,3],[0,1],[0,1],[2,2],[1,1],[3,1],[2,0],[-1,3],[2,2],[3,1],[2,1],[0,3],[0,3],[0,2],[3,1],[-1,2],[1,3],[3,7],[-1,2],[-1,3],[0,5],[1,2],[3,3],[1,2],[1,0],[2,2],[4,5],[4,3],[2,2],[1,0],[2,0],[2,0],[3,0],[2,1],[1,2],[1,6],[1,3],[1,2],[4,3],[2,1],[0,2],[0,2],[0,1],[1,1],[2,0],[1,1],[0,1],[1,1],[-3,1],[0,2],[0,2],[1,2],[5,1],[4,5],[1,4],[-4,1],[0,2],[3,2],[-1,0],[2,1],[1,0],[2,-1],[1,-2],[2,4],[6,10],[2,18],[1,3],[2,0],[1,2],[0,2],[0,2],[-3,19],[1,6],[6,-3],[-1,3],[0,3],[1,1],[2,2],[2,2],[3,1],[3,2],[1,-1],[-1,2],[-2,1],[-2,0],[-1,1],[-1,3],[0,4],[-1,2],[-3,-2],[-10,18],[1,6],[9,9],[2,6],[2,-2],[1,0],[1,1],[6,5],[1,0],[3,-1],[1,1],[4,2],[2,2],[1,3],[4,9],[0,1],[-1,1],[1,3],[1,2],[1,1],[5,1],[3,0],[2,1],[2,3],[1,4],[0,10],[-2,10],[0,6],[2,2],[2,1],[1,1],[1,2],[0,2],[0,4],[-2,0],[-2,-2],[-2,-1],[-2,0],[-2,-1],[0,1],[1,4],[7,9],[-1,4],[2,5],[1,6],[-4,4],[0,1],[3,2],[2,-1],[3,-1],[3,-1],[2,1],[3,4],[2,2],[-2,0],[6,4],[6,8],[4,9],[5,22],[8,21],[2,11],[0,11],[-1,1],[-1,3],[0,1],[1,2],[2,3],[0,1],[0,6],[-1,4],[-3,2],[-5,1],[-8,-2],[-4,0],[-2,5],[-1,11],[1,2],[1,1],[6,-1],[9,2],[3,2],[1,4],[1,2],[3,2],[1,1],[0,12],[-1,3],[0,3],[1,3],[1,2],[2,2],[2,3],[-3,6],[-2,16],[1,5],[5,8],[1,6],[2,5],[7,7],[0,5],[-1,3],[-6,5],[-2,3],[1,3],[2,2],[1,1],[1,1],[0,4],[0,2],[1,3],[2,2],[2,2],[8,4]],[[6187,8339],[3,2],[2,3],[3,7],[2,-3],[0,-3],[-1,-3],[-1,-3],[4,2],[1,4],[-1,5],[-1,5],[1,2],[2,3],[2,4],[0,5],[1,0],[0,-2],[1,0],[0,-1],[1,-1],[2,1],[0,6],[0,3],[3,3],[3,-2],[0,-2],[1,-4],[-2,0],[-1,-1],[3,-4],[-3,-1],[-1,-2],[-1,-6],[2,1],[2,1],[2,-1],[2,-1],[-3,-1],[-9,-1],[0,-11],[1,-2],[2,-1],[3,0],[3,-1],[1,-3],[0,-5],[2,-3],[2,1],[1,2],[0,2],[-2,2],[1,0],[1,1],[1,0],[1,1],[-1,4],[1,7],[3,8],[5,13],[5,7],[3,-1],[0,-8],[-7,-11],[-1,-3],[-3,-3],[-1,-2],[0,-6],[0,-3],[2,7],[1,2],[3,3],[-1,-4],[0,-1],[2,-5],[-1,-5],[-3,-4],[-2,-5],[6,5],[2,1],[0,-1],[-1,-2],[1,-2],[0,-1],[-1,-2],[-3,-4],[0,-1],[5,3],[3,4],[2,6],[0,8],[2,-4],[2,-6],[0,-6],[-2,-2],[-2,-2],[1,-5],[3,-4],[2,-3],[-2,8],[2,5],[4,2],[2,-3],[2,4],[2,9],[1,5],[3,1],[6,18],[4,0],[2,-7],[-7,-16],[-2,-7],[1,0],[1,1],[1,3],[4,4],[3,5],[2,-2],[1,-5],[1,-4],[-1,-4],[3,-2],[2,-2],[-1,-5],[1,-1],[1,-5],[-2,-4],[-1,-3],[-2,-2],[-1,-3],[8,-1],[2,0],[2,3],[1,2],[1,4],[0,4],[-1,2],[-1,4],[0,3],[3,2],[2,1],[4,-1],[0,-2],[-1,-2],[-3,0],[1,-1],[1,0],[0,-1],[1,0],[-1,-2],[0,-2],[0,-2],[1,-1],[6,11],[3,3],[3,-3],[-2,0],[-2,-2],[-1,-2],[1,-3],[1,0],[2,1],[1,0],[-1,-3],[-2,-2],[-1,-3],[0,-4],[1,1],[2,1],[0,2],[2,3],[1,4],[2,0],[0,-11],[0,-2],[-2,-6],[-2,-5],[0,-3],[4,3],[9,14],[1,2],[0,2],[0,3],[2,3],[1,1],[8,4],[-6,0],[4,1],[3,0],[1,-3],[1,-4],[0,-3],[-2,-4],[0,-2],[-1,-1],[-4,0],[-1,-1],[-5,-2],[-1,-1],[-1,-2],[0,-2],[0,-2],[0,-2],[-3,-8],[0,-4],[1,-4],[-5,1],[-3,-1],[-6,-7],[3,0],[2,1],[1,3],[1,3],[3,-2],[1,-3],[-1,-3],[-2,-3],[2,0],[2,1],[1,1],[1,2],[4,-3],[1,-4],[-1,-4],[1,-3],[2,4],[0,6],[-1,12],[1,1],[2,3],[2,3],[2,1],[1,-2],[0,-2],[-2,-4],[-1,-1],[2,1],[3,3],[2,1],[0,1],[3,7],[2,5],[5,11],[0,3],[-1,4],[3,3],[4,-1],[4,-3],[1,-3],[2,-20],[-2,1],[-1,1],[-3,-7],[-4,-5],[-5,-3],[-6,-5],[1,-1],[2,3],[2,1],[2,1],[2,-2],[-2,-3],[-1,-4],[-1,-4],[-1,-4],[-1,-1],[-3,-2],[-2,-3],[2,-5],[1,4],[0,2],[0,3],[8,-4],[2,-6],[0,-7],[-3,-11],[-1,-4],[-1,-4],[0,-5],[1,-4],[2,-3],[3,-2],[3,-1],[9,3],[3,3],[-2,4],[4,2],[7,3],[2,3],[-1,4],[-6,8],[-1,5],[2,7],[4,8],[5,6],[6,0],[1,6],[3,5],[3,0],[2,-6],[2,0],[0,5],[3,2],[3,1],[1,2],[1,1],[3,-2],[0,-3],[-5,-1],[5,1],[2,3],[0,5],[2,6],[0,-10],[1,-3],[2,-1],[2,-1],[3,-1],[2,1],[2,-1],[2,-5],[0,-4],[-5,2],[3,-4],[3,-1],[3,0],[3,-2],[0,-2],[-4,-2],[-4,-2],[-4,-3],[0,-5],[1,0],[2,4],[3,0],[6,-3],[-1,4],[1,4],[2,4],[1,4],[0,8],[1,2],[5,1],[0,1],[-2,0],[0,2],[4,2],[5,4],[4,3],[1,5],[1,1],[1,-2],[2,-2],[1,-3],[0,-7],[0,-3],[-2,-1],[-4,-2],[-2,-2],[-1,-2],[-1,-4],[-4,-5],[-1,-4],[-1,-4],[2,-5],[-3,-1],[-4,1],[-2,0],[3,-3],[4,-5],[1,-4],[-4,-2],[4,-1],[1,1],[2,7],[0,2],[1,2],[3,3],[3,-4],[2,-4],[4,-3],[3,2],[-3,1],[-1,4],[1,4],[2,3],[-2,0],[1,2],[0,1],[1,1],[0,1],[3,-2],[2,-4],[1,-5],[0,-4],[1,4],[0,3],[3,-5],[-1,-3],[-2,-2],[-1,-4],[1,-1],[4,-4],[1,-2],[-1,-1],[-4,-5],[2,-1],[4,-3],[1,-1],[-3,-4],[-2,-1],[-2,-2],[-1,1],[-3,-1],[0,-1],[0,-1],[1,-2],[10,7],[1,3],[-2,6],[8,-4],[4,-1],[3,2],[-2,-9],[-7,-6],[-13,-8],[0,-2],[3,2],[9,1],[2,2],[3,2],[2,-1],[1,-3],[2,-3],[7,1],[3,6],[2,9],[1,9],[12,-7],[-4,-3],[-2,-2],[-2,-3],[-1,-5],[-1,-4],[0,-3],[-1,-2],[-3,-1],[0,-2],[2,1],[4,2],[3,1],[2,-1],[1,-2],[1,-2],[1,-1],[1,2],[1,3],[1,3],[2,1],[2,-1],[0,-3],[-1,-4],[-1,-2],[1,-2],[2,3],[2,1],[1,2],[1,3],[2,-1],[1,-1],[1,-2],[1,-2],[-4,-4],[-9,-6],[-3,-4],[5,1],[7,2],[4,-1],[2,-2],[1,-4],[1,-5],[0,-4],[1,-2],[2,-4],[0,-3],[0,-2],[-1,-1],[-1,-1],[-1,-1],[-2,-2],[-4,0],[-4,0],[-4,1],[-2,-3],[-3,-2],[-7,-2],[2,0],[1,0],[1,0],[1,-1],[4,2],[4,2],[4,0],[5,-1],[3,0],[2,-1],[1,-2],[-2,-3],[-7,-6],[-5,-2],[-5,-9],[-6,-8],[-7,1],[-2,-2],[3,-1],[4,0],[3,1],[1,0],[2,-2],[-1,-2],[-6,-4],[-8,-11],[-5,-2],[-7,0],[2,-1],[1,-2],[1,-4],[-9,3],[-4,1],[-4,-2],[-4,-4],[-3,-3],[-5,2],[4,-3],[10,4],[9,2],[2,-9],[2,0],[2,4],[3,3],[3,1],[1,-3],[0,-4],[-2,-2],[-1,-2],[-1,-2],[-2,-6],[-1,-1],[-3,-3],[-1,-2],[-1,-6],[-1,-3],[1,-2],[1,4],[1,2],[1,1],[6,6],[2,1],[1,-2],[-1,-10],[0,-5],[3,-2],[-1,3],[0,3],[0,3],[3,5],[-1,2],[-1,2],[0,2],[0,6],[0,5],[2,5],[2,5],[11,10],[2,2],[3,0],[1,2],[3,3],[-1,0],[1,4],[1,1],[1,1],[1,1],[7,7],[8,1],[8,-4],[6,-9],[2,-6],[1,-5],[0,-9],[1,-1],[2,-4],[1,-2],[1,-2],[0,-6],[-2,-11],[-2,-5],[-3,-2],[-8,-1],[-5,0],[-5,1],[-1,2],[-2,3],[-2,1],[-1,0],[0,1],[-1,1],[-1,1],[-1,0],[-1,-1],[-4,-2],[-3,-3],[-2,-3],[-2,-3],[10,7],[4,-1],[1,-7],[-2,-13],[-2,-8],[-3,-5],[-3,0],[-2,0],[-2,0],[-2,-3],[-3,-8],[-1,-1],[-5,-1],[-5,-2],[-4,-4],[-1,-4],[3,4],[11,5],[4,3],[2,3],[1,2],[1,2],[3,1],[2,-2],[-2,-3],[-1,-3],[-1,-1],[-11,-26],[-6,-7],[2,-3],[-1,-3],[-2,-7],[-2,-6],[0,-5],[0,-11],[-1,-6],[-8,-16],[0,-2],[0,-7],[0,-3],[-1,-5],[0,-3],[2,-4],[4,-2],[6,0],[3,-2],[0,-6],[-3,-5],[-5,-3],[-3,-4],[-1,-4],[-2,-2],[-2,-2],[-3,-2],[0,-2],[-2,-6],[0,-2],[-5,-3],[-5,-1],[-4,-2],[-2,-4],[1,-5],[1,-5],[2,-4],[3,-4],[-8,-4],[8,-1],[1,4],[-1,13],[1,5],[3,3],[4,2],[10,1],[4,3],[3,3],[3,6],[4,9],[3,2],[6,1],[10,18],[10,6],[2,1],[1,4],[8,10],[2,4],[2,5],[2,6],[0,5],[0,11],[1,6],[2,3],[0,1],[-1,1],[0,1],[-2,1],[8,28],[1,10],[1,-2],[1,-2],[0,-2],[0,-3],[1,0],[-3,29],[2,4],[1,2],[2,0],[4,1],[3,-2],[2,-4],[3,-8],[0,7],[0,3],[-3,2],[1,3],[0,3],[0,3],[1,4],[3,1],[13,2],[25,14],[6,0],[2,4],[4,0],[5,-4],[1,-7],[-4,1],[-6,0],[-4,-1],[-1,-4],[6,-1],[1,0],[1,-3],[0,-6],[1,-2],[0,3],[0,2],[1,4],[2,0],[2,-6],[0,-5],[-1,-5],[-3,-5],[-3,0],[-4,-2],[-3,-5],[-2,-1],[-1,-1],[-2,0],[-1,-2],[4,-2],[-1,-5],[-6,-13],[-3,-2],[-4,-2],[-3,-1],[-2,1],[-2,1],[-3,4],[1,-5],[0,-1],[2,-1],[-3,-3],[-6,-2],[-3,-2],[-6,-7],[-1,-1],[-6,-2],[-6,-6],[-2,-6],[4,-5],[0,6],[2,5],[2,2],[4,-4],[-2,-4],[-1,-1],[0,-2],[3,-4],[1,7],[1,1],[2,-1],[1,0],[1,1],[0,4],[0,2],[1,2],[2,2],[2,-2],[5,-5],[-1,4],[2,2],[7,3],[-1,-5],[4,-8],[-2,-4],[-2,-1],[-4,-2],[-1,-1],[-1,-2],[0,-1],[1,0],[1,1],[1,-2],[0,-1],[1,-1],[0,-1],[7,7],[2,3],[1,0],[0,-1],[1,-1],[2,4],[2,4],[1,5],[1,4],[1,3],[3,2],[1,0],[-1,-2],[0,-2],[3,1],[1,1],[1,1],[1,-1],[0,-2],[0,-1],[0,-1],[0,-1],[1,1],[0,1],[1,1],[0,-3],[-1,-3],[-2,-5],[3,3],[1,5],[0,11],[1,4],[2,4],[3,7],[3,7],[2,4],[7,4],[1,1],[1,1],[6,-5],[0,2],[-2,2],[-1,3],[3,7],[3,5],[2,2],[1,-1],[6,-13],[3,-8],[1,3],[-1,3],[-1,3],[0,4],[1,3],[6,3],[1,1],[2,0],[1,0],[1,1],[2,0],[1,0],[2,0],[6,5],[3,1],[3,1],[1,-1],[2,3],[0,7],[3,3],[3,-3],[1,-6],[0,-7],[-3,-3],[0,-2],[2,0],[0,2],[1,0],[0,-2],[2,0],[0,1],[0,2],[1,2],[2,-1],[2,-1],[4,0],[-5,5],[0,6],[3,5],[5,2],[-2,-2],[-1,-2],[-2,-5],[3,3],[4,1],[3,-2],[1,-5],[4,2],[9,-4],[4,2],[-2,1],[-2,0],[-1,3],[1,3],[2,3],[0,-5],[2,3],[1,4],[-1,3],[-3,2],[4,6],[3,-2],[1,-6],[-1,-7],[3,0],[2,-8],[3,-2],[-2,-4],[2,1],[2,1],[1,3],[1,2],[2,-4],[1,-4],[2,2],[0,3],[-1,4],[-3,8],[2,0],[8,-2],[0,2],[-4,1],[-2,2],[-2,4],[-1,4],[1,0],[1,-3],[3,-1],[2,0],[3,0],[-3,4],[-10,6],[-3,6],[1,4],[1,3],[2,4],[0,2],[3,1],[3,0],[3,1],[4,0],[5,-1],[5,-1],[5,0],[7,-1],[13,-5],[12,-3],[17,-10],[24,-10],[15,-6],[6,-3],[8,-5],[5,-3],[8,-5],[1,-1],[2,0],[8,-3],[2,-1],[12,1],[2,-1],[2,-2],[1,-2],[1,0],[2,-3],[10,-13],[11,-8],[3,-1],[2,-1],[4,-1],[2,0],[3,1],[6,3],[1,-5],[-1,-3],[-2,-1],[-4,2],[2,-7],[3,-2],[4,-2],[5,-4],[1,2],[5,2],[2,2],[1,-2],[1,-3],[6,-2],[26,0],[2,-2],[0,-5],[-1,-4],[-2,-3],[6,2],[1,-2],[-1,-6],[2,0],[0,4],[2,2],[2,2],[2,1],[2,-2],[4,-1],[4,1],[3,1],[14,1],[0,-1],[-1,0],[-1,-1],[2,-3],[0,-2],[3,2],[5,0],[4,-1],[2,0],[1,3],[2,0],[8,-5],[3,-2],[3,1],[1,3],[0,9],[-1,4],[-2,-1],[-2,0],[-2,2],[-7,5],[-3,2],[1,4],[3,1],[21,-1],[14,-1],[4,-1],[-5,-8]],[[5398,8175],[-4,-1],[0,5],[3,7],[5,3],[5,2],[7,-1],[6,0],[1,-3],[-1,-5],[-5,0],[-7,-2],[-5,-1],[-5,-4]],[[5462,8166],[-2,-3],[-4,2],[-9,3],[-3,2],[-3,5],[2,3],[5,6],[1,2],[1,6],[1,2],[2,2],[6,4],[5,7],[3,3],[4,-1],[1,-4],[1,-3],[2,-3],[3,-1],[2,-2],[-1,-5],[-2,-5],[-2,-2],[-2,-1],[-5,-9],[-6,-8]],[[5439,8225],[6,-3],[3,-2],[0,-3],[0,-3],[-2,-3],[-3,-1],[-5,-2],[-3,-3],[-3,-3],[-3,0],[-3,2],[-2,5],[1,3],[0,5],[0,3],[3,3],[3,1],[2,-1],[2,2],[4,0]],[[5693,8344],[-4,-4],[-3,-1],[-3,0],[-4,-2],[-2,1],[-1,2],[0,2],[0,2],[-2,-3],[-3,1],[-4,5],[-4,2],[-2,1],[-1,2],[2,4],[6,5],[0,2],[2,9],[3,3],[5,1],[10,0],[3,-3],[3,-9],[3,-4],[-4,-7],[-1,-1],[1,-6],[0,-2]],[[5714,8386],[-3,-1],[-12,1],[-4,1],[-2,3],[0,4],[0,5],[1,6],[6,8],[3,6],[4,9],[1,3],[1,2],[11,6],[7,-8],[2,-4],[-6,0],[0,-2],[5,-4],[-1,-8],[-7,-16],[-2,-7],[-1,-2],[-3,-2]],[[5774,8486],[1,-1],[3,1],[4,-2],[4,-3],[2,-4],[-2,-5],[-4,-5],[-10,-5],[-1,4],[-3,6],[-1,4],[1,0],[2,2],[1,2],[-3,2],[0,2],[1,2],[1,0],[2,1],[1,0],[1,-1]],[[5137,8499],[2,-9],[1,-9],[0,-4],[-2,-7],[-5,-5],[-6,-1],[-7,0],[-7,-3],[-9,-9],[-6,-3],[-5,-1],[-6,-3],[-6,-4],[-3,-4],[-2,0],[-2,5],[0,6],[1,7],[1,7],[5,7],[1,2],[1,4],[1,1],[2,0],[3,-2],[1,0],[5,4],[8,10],[5,5],[11,6],[11,5],[-5,-9],[0,-3],[2,0],[7,14],[1,-1],[0,-1],[1,-2],[1,-3]],[[5829,8501],[3,-2],[6,1],[3,-3],[2,-4],[0,-5],[-2,-5],[1,-3],[1,-4],[-1,-5],[-1,-2],[-2,-1],[-6,0],[-4,-1],[1,4],[-1,5],[-3,10],[-8,3],[0,4],[-2,8],[1,3],[3,1],[0,4],[2,1],[4,-1],[2,-4],[1,-4]],[[5049,8506],[5,-12],[3,-2],[6,-2],[2,-4],[0,-6],[-1,-6],[-14,-31],[-2,-9],[-5,-32],[-4,-14],[-1,-2],[-3,-2],[-5,8],[-5,-2],[-17,-37],[-6,-8],[-27,-26],[-9,-6],[-2,-1],[-2,-2],[-2,-3],[-2,-2],[-6,-2],[-2,-1],[0,-1],[-1,-3],[0,-1],[-1,-1],[-3,-1],[-1,-1],[-9,-9],[-10,-8],[-5,-2],[-10,-1],[-9,-5],[-4,0],[-4,3],[-3,4],[-3,8],[3,8],[9,13],[1,4],[1,5],[1,10],[1,3],[2,3],[15,13],[2,1],[1,1],[1,6],[1,1],[1,1],[2,1],[4,1],[8,4],[7,9],[4,10],[-5,10],[1,34],[2,10],[12,14],[9,24],[5,8],[5,8],[7,7],[11,9],[3,3],[4,2],[12,5],[3,1],[2,0],[-2,-4],[-2,-4],[-1,-5],[0,-4],[0,-1],[1,-1],[0,-2],[-1,-2],[-1,-2],[-3,-4],[0,-3],[1,0],[2,3],[4,4],[2,4],[0,3],[-2,3],[0,2],[3,2],[0,-5],[2,0],[0,5],[2,-2],[1,-1],[2,-1],[2,-1],[-5,8],[-1,2],[0,4],[0,1],[1,1],[1,2],[2,1],[12,-3],[4,-2],[3,-5]],[[5015,8531],[-4,-2],[-2,2],[1,6],[2,3],[3,2],[4,2],[1,5],[1,1],[3,3],[1,2],[15,38],[5,5],[2,5],[1,1],[7,1],[2,1],[1,1],[4,5],[0,1],[10,0],[0,-1],[0,-1],[-1,0],[-1,0],[-1,-3],[0,-5],[0,-4],[1,-2],[-3,-2],[-1,-5],[0,-9],[-4,-10],[-8,-10],[-17,-15],[-14,-8],[-8,-7]],[[5299,8615],[13,-6],[6,1],[48,-12],[31,-11],[30,2],[8,2],[5,1],[2,-1],[6,-1],[1,-1],[4,-5],[3,-1],[0,1],[-2,4],[-3,5],[1,5],[4,4],[13,7],[2,-1],[1,0],[2,1],[2,0],[3,0],[2,0],[3,2],[5,0],[5,2],[2,0],[3,0],[2,-2],[3,-2],[3,0],[3,1],[3,0],[2,-3],[6,2],[15,-1],[3,0],[4,-3],[3,-4],[4,1],[3,3],[5,3],[7,2],[3,-3],[0,-7],[-2,-4],[0,-2],[7,1],[9,1],[26,-8],[4,0],[8,3],[5,1],[5,-1],[13,-5],[26,-4],[5,-3],[2,0],[2,-2],[2,-2],[1,-2],[1,-5],[-1,-12],[0,-3],[-2,-3],[-2,-3],[-2,-2],[-3,-1],[-2,-1],[-2,-9],[-6,-10],[-1,-7],[0,-16],[-1,-3],[-4,-10],[0,-7],[-1,-2],[-2,-3],[3,-3],[-1,-4],[-1,-5],[-1,-6],[-4,3],[-5,4],[-8,9],[3,-8],[5,-8],[3,-7],[-3,-7],[3,-5],[0,-7],[-1,-7],[-2,-5],[-5,-5],[-12,-5],[-4,-4],[1,-3],[-1,-2],[-3,-6],[-2,-2],[-2,-1],[2,-2],[2,0],[2,0],[2,0],[0,-4],[0,-1],[-6,-4],[0,-2],[6,1],[0,-4],[-3,-5],[-3,-2],[-4,-2],[-10,-9],[-5,-2],[-4,-2],[-8,-11],[-5,-2],[-7,1],[-6,4],[-5,6],[-3,6],[-2,-2],[2,-5],[4,-5],[4,-4],[5,-1],[3,-3],[1,-5],[-2,-4],[-5,1],[0,-2],[3,-1],[6,0],[3,0],[4,-3],[1,-3],[-3,-16],[-6,-19],[-2,0],[-4,4],[-19,27],[-4,3],[-6,-2],[7,-1],[3,-4],[-2,-4],[-7,-2],[0,-2],[2,-1],[0,-3],[-1,-2],[-2,-2],[3,1],[5,5],[2,1],[2,-2],[1,-3],[1,-3],[1,-3],[5,-1],[0,-1],[2,0],[1,-4],[0,-1],[3,-1],[7,-6],[0,-2],[-3,-1],[-4,-1],[-3,-2],[-3,-3],[-1,-1],[-1,-3],[-1,-2],[-1,-1],[-4,3],[-2,1],[-1,-3],[-2,-2],[-4,-1],[-11,-2],[-2,-2],[-3,-1],[-4,0],[-1,2],[0,1],[-1,2],[-2,0],[-1,1],[-2,0],[-1,0],[-1,1],[-1,3],[-3,8],[0,2],[-5,12],[-1,2],[-7,0],[-1,1],[-1,1],[-1,1],[-3,-2],[4,-3],[2,-5],[0,-7],[-5,-19],[1,-6],[4,-4],[-2,-1],[-1,0],[0,1],[-1,2],[-1,-1],[-2,-1],[-1,-1],[-2,0],[2,-3],[2,0],[2,-1],[1,-3],[2,1],[1,1],[3,1],[-4,-5],[-8,-4],[-7,1],[-4,-1],[-4,1],[-5,4],[-4,4],[-5,4],[-7,8],[-2,3],[1,4],[1,2],[1,3],[-1,2],[-1,-3],[-3,-5],[-2,-6],[1,-6],[8,-6],[4,-7],[-1,-6],[-3,-2],[-7,2],[-4,1],[-4,0],[-6,3],[-3,5],[-1,9],[-1,3],[-1,15],[-2,-1],[-2,0],[-2,0],[-2,1],[1,-2],[2,-2],[2,-2],[1,-4],[0,-13],[-1,1],[-1,0],[-1,0],[-1,1],[2,-3],[0,-4],[-2,-4],[-3,-1],[-3,-2],[-2,-3],[1,-4],[2,-4],[-3,0],[0,-1],[3,-1],[0,-3],[-2,-6],[-1,-1],[-10,2],[-4,-2],[-7,-9],[-4,-3],[-4,0],[-4,5],[-3,7],[-1,12],[-4,6],[-2,3],[1,4],[2,8],[-1,4],[-1,-5],[-3,-8],[-1,-4],[1,-6],[7,-16],[0,-3],[0,-2],[-1,-3],[0,-2],[-2,-2],[-7,-7],[-6,-3],[-2,0],[-3,0],[-2,2],[-2,2],[-2,2],[-3,1],[-4,1],[-2,0],[-3,2],[-2,2],[-2,2],[-5,2],[-5,2],[-2,1],[-5,-1],[-1,2],[-5,5],[-1,1],[0,2],[1,12],[0,2],[-5,-1],[-1,-2],[1,-4],[0,-6],[-2,-3],[-6,-6],[-1,-2],[-14,-8],[-3,2],[-2,3],[-2,3],[-9,2],[-2,4],[0,5],[0,18],[0,3],[-3,2],[-3,0],[-2,1],[-2,3],[1,3],[1,0],[2,1],[1,1],[2,4],[0,1],[-1,4],[-2,4],[0,3],[0,2],[1,4],[0,2],[-4,-3],[0,-4],[3,-10],[1,0],[0,-1],[0,-1],[-1,-1],[-1,0],[-1,-1],[-2,-2],[-1,-1],[-1,-2],[-1,-3],[3,-4],[5,-3],[3,-4],[-1,-4],[-1,-4],[-1,-13],[-1,-5],[-2,0],[-1,5],[-5,18],[-2,0],[5,-20],[0,-6],[-2,-4],[-5,-2],[-6,0],[-5,2],[5,-4],[7,-2],[3,-2],[-5,-4],[-6,-3],[-6,-1],[-7,1],[-34,8],[-3,1],[-5,5],[-2,1],[0,2],[1,4],[3,3],[5,1],[-5,12],[-34,39],[-4,6],[-1,6],[-1,2],[-6,8],[-2,3],[0,3],[1,6],[1,0],[2,1],[0,2],[-1,1],[-1,0],[-1,1],[-3,8],[0,3],[1,6],[7,31],[0,5],[-2,6],[-3,6],[-1,6],[3,4],[2,0],[10,-7],[13,-7],[11,-2],[3,-1],[12,-7],[-2,6],[-10,10],[6,2],[2,2],[2,1],[6,-2],[1,0],[4,3],[0,2],[-3,2],[-4,2],[2,5],[-1,0],[4,4],[3,0],[4,-1],[5,1],[-4,2],[-4,1],[-4,0],[-3,-2],[-4,-5],[-4,-3],[-4,-2],[-5,0],[-1,-1],[-5,-3],[-2,-1],[-2,-1],[-16,2],[-4,2],[-2,3],[-1,2],[-4,7],[-1,4],[-2,9],[0,18],[2,10],[1,4],[2,4],[1,3],[-1,3],[2,3],[2,0],[3,-2],[2,-3],[-1,6],[-3,3],[-4,1],[-3,4],[0,2],[0,8],[1,1],[2,2],[0,1],[0,2],[-2,1],[-1,1],[1,11],[10,27],[3,-3],[3,-5],[2,-7],[1,-5],[3,-2],[17,-9],[4,-2],[2,0],[6,1],[1,0],[-1,1],[0,2],[-2,2],[-12,5],[-13,2],[-2,2],[-1,4],[-1,5],[-6,17],[-1,5],[0,6],[0,4],[4,14],[1,10],[1,3],[1,1],[3,3],[0,2],[1,4],[1,5],[3,9],[2,2],[7,7],[2,2],[2,1],[3,7],[2,1],[3,0],[2,-1],[3,1],[4,2],[3,3],[3,2],[6,1],[5,-1],[4,-1],[3,0],[4,2],[2,4],[2,5],[2,4],[4,1],[5,0],[12,-3],[39,-5]],[[5122,8570],[-6,-6],[-2,1],[-2,1],[-6,2],[0,3],[-1,2],[0,1],[-9,5],[-6,9],[0,10],[8,3],[0,1],[-2,1],[-5,3],[12,21],[2,11],[5,8],[5,1],[8,2],[16,9],[12,3],[5,-3],[4,-7],[5,-3],[5,-2],[3,-1],[2,-2],[2,-3],[1,-3],[0,-1],[0,-3],[0,-1],[3,-4],[0,-1],[0,-5],[-2,-4],[-9,-9],[-4,-3],[-14,-7],[-5,-4],[-12,-15],[-4,-4],[-9,-6]],[[5434,8667],[1,-2],[3,2],[3,1],[3,0],[3,-1],[8,-5],[2,-2],[3,-4],[0,-3],[-1,-2],[1,-2],[2,-2],[2,0],[1,-1],[0,-2],[-1,-3],[-1,-2],[-1,-2],[0,-3],[-1,0],[-3,1],[-1,1],[-1,-5],[-7,-7],[-2,-3],[-2,-3],[-6,-2],[-6,-1],[-43,-1],[-7,-3],[-26,11],[2,9],[5,6],[14,12],[14,7],[11,8],[23,4],[6,3],[0,-2],[2,-2]],[[5223,8649],[-2,-4],[-9,-1],[-2,1],[-2,0],[-2,1],[0,1],[-2,1],[-8,0],[-3,1],[-3,3],[-3,3],[-1,3],[-1,5],[-1,1],[-2,1],[-2,2],[-1,3],[0,2],[1,2],[0,2],[-1,3],[-2,6],[0,2],[2,4],[6,5],[6,0],[5,-2],[4,-1],[6,-2],[6,-1],[4,-4],[5,-5],[1,-4],[0,-7],[1,-5],[1,-7],[0,-5],[-1,-4]],[[5284,8716],[-13,-4],[1,4],[4,7],[14,10],[5,3],[5,0],[1,-5],[-1,-4],[-4,-3],[-12,-8]],[[5425,8726],[-17,-9],[-9,-8],[-11,-8],[-16,-18],[-5,-10],[-4,-12],[-5,-9],[-8,-6],[-15,-4],[-7,-2],[-2,-1],[-3,-1],[-1,-2],[-3,-1],[-2,2],[-2,6],[-5,5],[-5,5],[-6,4],[-7,1],[-10,-2],[-2,2],[-2,1],[-4,0],[-3,-1],[-1,-1],[-5,-2],[-5,-2],[-6,-1],[-5,4],[-5,5],[-2,3],[0,5],[2,9],[1,5],[-2,-2],[-2,-2],[-2,-7],[-3,5],[-1,5],[1,17],[1,3],[2,2],[14,0],[5,3],[6,1],[5,-2],[7,0],[16,0],[4,0],[10,10],[6,10],[7,2],[10,0],[9,-4],[13,2],[8,5],[17,9],[22,8],[20,0],[6,-8],[1,-14]],[[5244,8784],[-2,-29],[0,-4],[1,-2],[3,-6],[3,-7],[1,-8],[-1,-6],[-4,-4],[-2,-4],[-3,-2],[-4,0],[-3,-1],[-5,-4],[-1,-6],[0,-4],[1,-3],[-1,-2],[-1,0],[-6,3],[-2,0],[-5,1],[-2,0],[-2,2],[-3,4],[-1,2],[1,7],[1,4],[1,2],[3,1],[2,0],[1,-1],[1,0],[1,1],[0,1],[7,32],[1,4],[1,0],[2,1],[2,1],[1,0],[0,2],[-1,2],[-1,1],[-1,2],[-2,4],[0,4],[0,7],[-1,7],[1,3],[2,5],[9,12],[3,2],[0,-1],[0,-1],[1,-1],[0,-1],[3,-9],[1,-11]],[[5313,8799],[0,-6],[0,-1],[1,-3],[1,-1],[-1,-2],[-2,-2],[-1,-4],[-28,-25],[-7,-5],[-7,-4],[-4,-5],[-7,-1],[-4,5],[-3,10],[-1,11],[0,10],[3,9],[5,7],[5,3],[1,1],[-1,3],[4,2],[12,0],[2,1],[2,2],[4,-2],[7,-7],[1,4],[-5,3],[1,4],[2,4],[4,3],[5,2],[4,0],[6,-11],[1,-3],[0,-2]],[[4262,9279],[8,-7],[1,-4],[1,-7],[0,-5],[3,-19],[1,-4],[0,-3],[-3,-4],[-1,-3],[-3,-10],[-1,-3],[-1,-1],[-1,0],[-1,-1],[-2,0],[-1,-1],[-1,-2],[-1,-6],[0,-2],[0,-3],[0,-1],[1,0],[1,-1],[3,-2],[1,-2],[0,-2],[1,-3],[0,-3],[0,-1],[0,-1],[-1,-1],[-1,-1],[-5,-5],[-1,-1],[-1,-1],[-1,-2],[1,-2],[0,-1],[3,-1],[1,-1],[1,-1],[1,-2],[1,-3],[0,-2],[-1,-19],[1,-2],[0,-3],[2,-18],[1,-3],[1,-3],[2,-3],[1,-1],[2,0],[2,1],[1,0],[1,0],[1,-1],[1,-1],[2,0],[6,1],[2,0],[2,2],[3,1],[8,1],[1,0],[1,0],[1,0],[4,-3],[2,-1],[7,-1],[1,-1],[1,-1],[2,-1],[0,-1],[1,0],[1,0],[2,1],[4,1],[2,0],[1,1],[1,0],[1,-1],[2,0],[1,0],[2,2],[1,0],[1,0],[5,-3],[1,0],[1,0],[1,0],[1,2],[1,1],[1,0],[1,-1],[3,-2],[1,-1],[2,-1],[3,-2],[1,0],[1,-1],[1,0],[2,-2],[2,-2],[1,-1],[2,-1],[1,-1],[2,-1],[0,-1],[1,-1],[1,-1],[1,-1],[1,0],[2,-1],[3,-3],[4,-4],[1,-1],[1,0],[1,3],[1,0],[2,-1],[4,-3],[2,-3],[1,-2],[1,-2],[1,-2],[1,0],[1,0],[3,0],[1,0],[0,-1],[0,-1],[0,-1],[-1,-1],[-1,-1],[0,-2],[1,-2],[1,-2],[3,-4],[1,-2],[0,-1],[0,-1],[0,-2],[0,-2],[0,-2],[1,-2],[1,0],[1,-1],[3,1],[4,0],[1,0],[2,0],[3,3],[1,1],[1,0],[1,0],[1,0],[2,-1],[1,-2],[1,-1],[1,-2],[1,-2],[4,-2],[1,-1],[1,-2],[1,-1],[2,-1],[1,0],[0,-2],[0,-1],[0,-2],[2,-1],[1,-1],[3,-2],[1,-1],[1,-2],[0,-3],[1,-1],[5,0],[1,0],[0,-1],[0,-1],[0,-1],[0,-1],[1,0],[4,0],[1,0],[1,1],[0,1],[0,1],[0,1],[-1,2],[0,1],[1,1],[1,0],[3,-1],[1,-1],[4,-1],[3,-1],[1,-1],[2,-1],[1,0],[1,1],[1,3],[1,1],[0,1],[-1,2],[0,1],[1,2],[1,0],[1,1],[1,-1],[2,0],[0,-1],[0,-1],[-1,-2],[1,-1],[2,-1],[1,0],[1,0],[2,0],[1,1],[1,1],[1,1],[1,1],[1,0],[1,-1],[0,-1],[0,-2],[0,-1],[0,-3],[0,-2],[0,-2],[1,-3],[0,-1],[1,-1],[2,0],[1,1],[2,1],[2,1],[1,0],[1,0],[2,0],[1,0],[1,-1],[3,-1],[2,0],[2,0],[2,0],[0,-1],[1,-1],[0,-1],[0,-2],[-1,-1],[-1,-1],[-1,-1],[0,-1],[-1,-2],[1,-1],[1,-2],[3,-5],[1,-1],[0,-2],[0,-2],[-1,-1],[0,-1],[0,-1],[-1,-1],[1,-2],[0,-1],[2,-1],[2,1],[8,3],[6,2],[2,0],[1,0],[2,-1],[2,-1],[0,-1],[1,-2],[0,-3],[1,-1],[0,-2],[3,-5],[1,-2],[0,-2],[-1,-1],[-1,-1],[-1,0],[-4,-2],[-4,0],[-1,-1],[-1,0],[0,-2],[-1,-1],[0,-3],[0,-4],[1,-6],[1,-1],[6,-14],[0,-1],[0,-1],[-1,-3],[0,-1],[0,-2],[2,-4],[0,-1],[1,-8],[1,-3],[0,-3],[2,-2],[3,-4],[9,-7],[1,-2],[1,-1],[2,-4],[2,-5],[3,-5],[3,-5],[4,-3],[4,-3],[9,-3],[20,-5],[2,-1],[1,-1],[1,-1],[0,-2],[1,-3],[0,-6],[0,-3],[-4,-16],[0,-6],[0,-5],[0,-2],[-2,-8],[0,-2],[0,-1],[0,-3],[1,-6],[1,-3],[0,-6],[0,-15],[0,-3],[10,-25],[1,-2],[1,-1],[6,-5],[1,-1],[0,-2],[1,-1],[1,-6],[1,-6],[4,-10],[1,-5],[0,-3],[1,-3],[-1,-5],[-2,-10],[1,-2],[0,-2],[5,-10],[3,-4],[12,-41],[1,-4],[5,-2],[2,-1],[2,0],[1,0],[1,0],[1,1],[8,5],[1,0],[2,0],[1,-1],[3,-3],[0,-1],[1,-2],[1,-3],[19,-22],[1,-1],[2,-8],[2,-3],[1,-1],[8,-7],[1,-2],[1,-2],[0,-20],[0,-3],[-1,-6],[-1,-3],[0,-3],[1,-3],[0,-3],[4,-10],[1,-2],[1,-2],[1,0],[1,-1],[2,0],[3,0],[2,-1],[3,-1],[3,-2],[2,-2],[1,-2],[0,-3],[0,-8],[1,-2],[2,-8],[1,-2],[0,-2],[0,-3],[-1,-3],[0,-3],[-1,-2],[-1,-1],[0,-2],[0,-1],[2,-5],[0,-1],[0,-2],[0,-1],[-1,-2],[-1,-2],[0,-1],[0,-2],[1,-3],[0,-1],[2,0],[1,0],[1,0],[13,5],[1,0],[1,0],[2,0],[1,0],[1,0],[1,-1],[2,-1],[4,-4],[1,-2],[1,-2],[0,-3],[0,-1],[0,-2],[0,-1],[0,-1],[-4,-5],[0,-1],[0,-2],[0,-2],[3,-8],[0,-6],[0,-2],[2,-7],[1,-2],[1,0],[3,-1],[5,-2],[1,-1],[2,-2],[7,-9],[1,-2],[1,0],[5,-2],[1,0],[24,-2],[2,-1],[2,-1],[2,-2],[1,-1],[1,-2],[4,-8],[1,-2],[1,-1],[1,0],[1,1],[1,1],[0,1],[0,2],[0,4],[0,2],[1,1],[1,1],[1,0],[1,1],[1,0],[1,0],[1,0],[3,0],[1,-1],[1,1],[1,0],[1,1],[0,1],[2,4],[1,1],[1,-1],[2,-2],[2,-1],[1,0],[1,0],[1,1],[0,1],[1,0],[2,0],[4,-2],[1,-1]],[[4898,8352],[-1,0],[-4,-5],[0,-12],[3,-22],[-1,-4],[-3,-3],[-7,-6],[-7,-9],[-3,-1],[-12,-1],[-5,1],[-14,5],[-4,3],[-3,3],[-3,3],[-4,1],[-6,-1],[-2,-2],[-6,-8],[-2,-1],[-5,-1],[-6,-4],[-15,-4],[-4,-2],[-5,-3],[-3,-4],[-2,-4],[-2,-2],[-18,-9],[-4,-2],[-10,0],[-14,-5],[-3,-2],[-2,-2],[-1,-2],[0,-2],[0,-4],[0,-2],[2,0],[2,1],[3,0],[4,1],[14,5],[38,1],[18,4],[4,1],[8,6],[2,2],[4,-2],[3,-4],[2,-5],[1,-6],[0,-3],[1,-2],[0,-3],[-1,-3],[-4,-5],[-1,-2],[-1,-6],[1,-5],[2,-2],[6,3],[3,0],[1,1],[1,1],[0,3],[1,1],[7,9],[5,3],[4,1],[10,-1],[1,1],[4,2],[2,1],[2,0],[5,0],[2,0],[10,3],[10,6],[54,44],[17,3],[4,3],[4,3],[16,6],[5,3],[6,4],[4,6],[2,6],[2,4],[5,3],[11,2],[0,-1],[-1,-1],[-2,-1],[0,-2],[-1,-1],[4,1],[5,2],[5,3],[3,3],[4,5],[5,10],[3,4],[6,6],[6,5],[28,17],[7,6],[3,7],[-2,4],[-2,5],[0,4],[2,3],[5,1],[4,-8],[5,-1],[0,2],[-3,1],[-1,3],[0,3],[2,3],[3,1],[11,-3],[6,1],[3,0],[3,-3],[1,-3],[0,-4],[-1,-8],[1,-12],[-1,-4],[-2,-3],[-2,-2],[-2,-2],[-3,-2],[-5,-8],[-3,-2],[-2,-2],[-3,0],[-7,0],[24,-18],[4,-4],[3,-5],[0,-5],[-2,-15],[0,-15],[1,-2],[1,-1],[2,-2],[1,-3],[-2,-3],[-1,-3],[0,-3],[2,-6],[7,-10],[2,-11],[3,-4],[15,-14],[2,-5],[2,-17],[1,-6],[2,-5],[-4,-6],[-4,-1],[-10,7],[2,-6],[2,-1],[2,-6],[-2,-8],[-5,-3],[-4,-3],[-2,-5],[0,-5],[-4,-3],[-6,0],[-5,3],[-5,5],[-5,3],[-2,-4],[-1,-3],[3,-1],[2,-4],[4,-2],[0,-7],[2,-5],[3,-2],[3,-2],[-1,6],[-1,4],[2,2],[6,-1],[12,1],[5,2],[3,1],[1,6],[-1,4],[0,5],[2,2],[3,4],[2,5],[2,2],[6,-2],[5,-1],[4,-8],[6,-12],[4,-4],[5,-4],[4,-2],[4,1],[3,0],[2,0],[1,-3],[-1,-2],[-3,-5],[-1,-3],[3,2],[3,7],[3,2],[0,-3],[0,-3],[-1,-2],[-1,-2],[-1,-3],[1,-2],[2,-5],[2,-8],[1,-5],[3,-3],[1,7],[2,3],[2,3],[2,2],[1,3],[0,2],[1,3],[1,3],[1,3],[6,7],[6,7],[7,3],[7,-2],[4,2],[5,0],[6,-2],[4,-3],[2,8],[4,6],[6,3],[19,6],[5,0],[5,0],[6,-2],[4,-2],[13,-10],[1,-2],[1,-5],[-1,-3],[-5,-11],[4,5],[3,5],[1,-5],[1,-5],[0,-5],[0,-6],[-2,-6],[-5,-10],[-1,-5],[2,0],[4,11],[2,0],[1,-5],[2,-5],[3,-4],[3,-2],[-4,12],[-2,14],[0,20],[-2,4],[0,2],[3,-1],[1,-3],[-1,-8],[2,6],[1,4],[2,3],[6,1],[5,0],[3,-2],[2,-3],[3,-4],[-1,5],[2,2],[2,-1],[2,-4],[2,4],[4,0],[5,-3],[7,-8],[4,-5],[2,-5],[0,-6],[3,5],[-3,7],[-9,14],[-3,-1],[0,2],[-1,3],[5,7],[7,7],[8,1],[6,-6],[3,17],[3,4],[5,4],[4,0],[2,-4],[-1,-7],[2,2],[4,3],[3,2],[-1,-5],[-5,-7],[-1,-3],[0,-5],[2,-3],[2,-3],[5,-2],[8,-2],[2,-2],[0,-6],[0,-3],[-2,-5],[-1,-4],[-3,-3],[0,-2],[3,0],[-1,-3],[-6,-6],[-2,-3],[-1,-3],[0,-20],[-1,-3],[-2,-5],[-1,-6],[-2,-2],[-2,-1],[-1,-2],[-6,-11],[-1,-1],[-1,-2],[0,-13],[0,-3],[-2,-2],[-1,-1],[-1,-2],[-1,-3],[0,-5],[-1,-2],[-4,-6],[-1,-3],[1,-2],[1,-5],[1,-14],[-1,-5],[-14,-23],[-2,-2],[-5,-2],[-5,-3],[-3,-4],[-3,-5],[6,-2],[9,1],[17,8],[4,3],[1,3],[0,4],[1,6],[1,1],[5,3],[1,1],[1,1],[1,4],[0,2],[5,6],[3,4],[1,6],[0,4],[0,10],[0,5],[2,7],[21,42],[4,11],[2,9],[0,5],[1,4],[15,37],[6,10],[7,7],[1,0],[2,1],[3,5],[1,4],[3,10],[1,9],[8,5],[9,7],[9,10],[4,12],[5,9],[9,1],[5,3],[6,3],[3,3],[2,0],[-1,-2],[-4,-5],[-4,-3],[0,-6],[-2,-4],[-2,-9],[-4,-3],[-1,-2],[-2,-2],[0,-1],[0,-4],[0,-6],[-2,-6],[-3,-5],[-6,-2],[-4,-3],[-1,-6],[-3,-3],[-1,-1],[4,-1],[3,2],[2,2],[3,5],[5,3],[6,4],[3,6],[1,5],[3,2],[1,3],[2,2],[1,1],[-2,5],[0,2],[2,1],[4,2],[2,2],[0,1],[1,3],[1,1],[0,1],[1,0],[1,0],[1,0],[3,0],[1,1],[0,1],[0,2],[0,1],[17,28],[0,2],[0,1],[0,1],[1,1],[1,0],[2,0],[1,1],[2,3],[1,1],[1,3],[4,12],[5,8],[3,0],[2,-6],[3,-5],[3,-7],[7,-15],[3,-4],[2,-4],[2,-5],[2,-4],[2,0],[5,-8],[3,-2],[5,-1],[3,-1],[2,-3],[2,-3],[1,-3],[2,4],[-1,5],[-1,5],[-1,4],[-2,5],[-8,9],[-1,6],[4,-2],[4,-1],[4,0],[12,4],[4,2],[4,4],[3,4],[-2,0],[-7,0],[-2,0],[-3,1],[-2,1],[-2,2],[-2,-3],[-4,-1],[-5,-1],[-4,1],[-5,2],[-1,4],[0,4],[1,6],[2,21],[1,11],[7,10],[4,7],[2,-4],[-1,-8],[1,-9],[3,-1],[16,-3],[1,0],[1,5],[1,4],[1,13],[4,10],[5,6],[7,-6],[-2,4],[-2,3],[-2,3],[1,4],[-1,2],[1,2],[3,-2],[2,1],[3,2],[3,0],[-3,2],[-3,0],[-6,-2],[0,2],[-3,7],[-1,6],[1,3],[3,1],[10,1],[4,0],[3,2],[3,3],[0,2],[0,3],[1,3],[1,1],[0,1],[3,4],[1,1],[0,6],[1,5],[0,1],[1,0],[2,2],[0,1],[-1,4],[0,1],[1,7],[0,3],[-1,2],[-1,2],[-2,1],[0,2],[0,5],[1,3],[9,15],[17,16],[3,-3],[1,-2],[0,-3],[0,-2],[-1,-3],[0,-2],[0,-1],[3,-1],[0,-1],[2,-3],[7,-9],[2,-1],[3,11],[15,11],[3,6],[3,1],[7,-2],[4,-3],[-1,3],[-3,3],[-1,7],[0,8],[2,5],[1,4],[0,2],[5,-4],[3,-5],[1,-5],[0,-4],[5,0],[5,-2],[2,-6],[0,-12],[-1,-3],[-3,-3],[-2,-2],[2,-3],[1,0],[17,8],[6,5],[3,3],[3,4],[2,9],[3,2],[-2,6],[0,9],[3,-1],[3,-3],[4,-5],[-1,-4],[2,-2],[1,-3],[1,-3],[1,-3],[1,-1],[2,-3],[3,-7],[2,-4],[0,-4],[-2,-5],[16,0],[3,-2],[1,-8],[3,-2],[0,3],[0,2],[1,3],[2,2],[-2,1],[-1,1],[0,2],[0,2],[-5,3],[-5,9],[-3,2],[0,-3],[-1,-3],[-1,-2],[-2,-1],[0,28],[1,3],[3,0],[-3,4],[4,2],[3,1],[4,0],[3,-3],[-1,-2],[-1,-2],[-1,-1],[1,-4],[-1,-9],[1,-5],[0,3],[0,3],[2,2],[2,1],[0,-4],[1,-3],[2,-1],[3,-1],[0,2],[-2,1],[-2,3],[0,3],[2,3],[3,1],[3,-1],[5,-5],[-1,4],[-1,3],[-2,2],[-1,3],[4,-1],[3,1],[2,3],[3,1],[3,-2],[0,-4],[0,-4],[0,-4],[2,0],[3,2],[1,-2],[0,-3],[-1,-4],[4,3],[1,3],[-1,4],[-1,4],[10,-8],[1,-3],[-2,-4],[-2,-1],[-1,3],[-2,0],[0,-2],[-1,-2],[-2,-2],[-2,0],[0,-2],[2,-4],[2,0],[1,4],[4,1],[3,-1],[4,-2],[0,3],[1,1],[1,2],[1,1],[1,-4],[1,-4],[-1,-4],[-2,-4],[-2,-1],[-4,-2],[0,-1],[0,-3],[2,1],[2,1],[2,2],[2,-2],[2,-3],[1,-3],[1,-3],[1,5],[-1,5],[0,5],[3,3],[0,-2],[1,-2],[0,-1],[1,2],[0,1],[0,2],[-1,2],[1,2],[1,3],[1,2],[1,5],[1,2],[2,1],[3,-1],[1,-2],[-1,-3],[-1,-2],[1,-1],[1,0],[0,-1],[-2,-2],[0,-7],[-1,-3],[1,-2],[2,3],[1,-4],[0,-4],[1,-4],[4,0],[-2,-3],[-5,-3],[-1,-3],[1,-3],[3,-4],[1,-3],[1,2],[0,10],[1,2],[1,3],[2,2],[1,2],[1,-1],[2,-1],[0,6],[0,2],[2,1],[3,0],[2,2],[2,5],[2,9],[2,-4],[0,-7],[-2,-12],[1,0],[2,3],[2,-1],[0,-2],[0,-2],[-1,-2],[5,0],[-1,-1],[-2,-4],[0,-2],[2,1],[1,1],[1,-4],[-2,-2],[-3,-1],[-2,-2],[-2,-3],[-1,-4],[0,-3],[4,-2],[0,4],[-1,3],[1,3],[3,2],[5,-2],[3,1],[0,5],[1,-2],[1,3],[-1,13],[2,-2],[2,-1],[1,-2],[0,-2],[2,0],[0,1],[1,1],[1,1],[2,0],[-1,2],[-1,2],[-2,1],[-2,0],[3,4],[6,9],[3,2],[0,1],[-3,2],[3,-1],[2,-1],[2,-2],[1,-3],[-3,-1],[0,-1],[1,-3],[2,-2],[-4,-2],[-1,0],[0,-2],[1,-1],[0,-2],[-2,-1],[-2,-1],[0,-1],[2,-1],[1,-2],[0,-2],[-1,-3],[2,1],[2,1],[1,2],[1,4],[1,0],[-1,-15],[-1,0],[0,-1],[1,-2],[2,-5],[1,-2],[1,4],[-1,3],[-1,3],[2,4],[2,0],[0,-5],[2,1],[1,3],[0,8],[2,-3],[6,-9],[1,-3],[-1,-4],[-7,-13],[4,3],[5,11],[3,2],[-1,3],[1,7],[2,4],[4,-2],[2,-3],[0,-2],[1,-3],[3,0],[2,1],[0,2],[-5,10],[0,3],[4,0],[5,-3],[4,-13],[-6,-8],[-1,-3],[2,0],[2,1],[0,-2],[0,-3],[-2,-3],[-3,-2],[-3,0],[-2,1],[-1,4],[-2,0],[-1,-3],[-2,-3],[-9,-6],[-3,-3],[-2,-4],[-1,-5],[3,4],[4,5],[4,3],[4,2],[1,-1],[5,0],[7,1],[4,2],[5,-4],[4,5],[1,6],[3,4],[6,3],[4,4],[3,2],[3,-2],[2,2],[4,1],[4,1],[3,-3],[-1,-3],[-4,-2],[-5,-1],[-4,-4],[1,-4],[0,-4],[-3,-3],[0,-3],[4,-3],[-1,-5],[-1,-4],[3,0],[1,-3],[-3,-3],[2,0],[3,0],[2,2],[1,2],[1,1],[2,-1],[3,-2],[1,0],[3,3],[2,4],[4,0],[0,-4],[0,-5],[1,-6],[1,-2],[1,2],[0,5],[2,4],[2,3],[3,0],[1,-3],[0,-10],[0,-2],[-2,-4],[0,-3],[4,3],[1,4],[1,6],[0,6],[2,0],[2,-4],[5,-7],[2,-4],[-1,4],[-4,6],[-1,4],[-1,0],[-1,2],[0,2],[5,1],[-3,3],[-1,2],[0,3],[3,4],[1,5],[3,5],[3,4],[8,2],[6,-3],[0,-9],[-2,0],[-2,-1],[-3,-4],[-3,-6],[-1,-3],[4,1],[1,-1],[0,-2],[-3,-2],[0,-1],[0,-1],[1,0],[0,-1],[-1,-2],[-1,-2],[-1,-2],[2,-4],[-11,-27],[7,9],[2,1],[3,0],[3,-2],[3,-1],[3,2],[3,5],[2,3],[1,0],[1,-3],[-2,-9],[0,-4],[3,4],[1,4],[0,11],[1,2],[2,3],[1,2],[2,1],[1,-1],[1,-2],[1,-2],[0,-2],[4,-8],[1,-4],[-2,-2],[-3,-2],[-2,-4],[0,-5],[2,-3]],[[5603,7276],[8,0],[12,-8],[10,-3],[3,-2],[4,-2],[6,3],[29,3],[5,-1],[2,-2],[10,-22],[5,-7],[6,-5],[5,0],[5,0],[4,-1],[2,-3],[1,-4],[2,-3],[6,-4],[2,-4],[2,-4],[0,-5],[-4,-6],[-6,-8],[-4,-3],[-6,-2],[-8,0],[-5,-2],[-2,-6],[0,-15],[2,-5],[3,-5],[10,-11],[2,-6],[-1,-5],[-3,-3],[-14,-3],[-4,-2],[-3,-3],[-1,-5],[1,-7],[3,-2],[4,-1],[4,-5],[0,-11],[-9,-6],[-19,-6],[-3,-3],[-1,-4],[1,-19],[3,-11],[1,-3],[2,-2],[3,-3],[2,-2],[0,-3],[-1,-5],[-2,-1],[-16,5],[-9,-2],[-6,-5],[-11,-12],[-6,-5],[0,-1],[-1,-3],[-2,-2],[-7,-11],[-2,-5],[-2,-5],[2,-1],[1,-4],[0,-11],[-1,-7],[-2,-4],[-3,-4],[-30,-14],[-6,-6],[-5,1],[-6,-2],[-26,-9],[-3,-3],[-5,-4],[-33,-24],[-4,-6],[-1,-10],[7,-31],[1,-36],[-1,-6],[-7,-16],[-34,-49],[-2,-5],[-2,-7],[0,-13],[3,-11],[7,-9],[8,-9],[19,-16],[10,-3],[3,-2],[1,-2],[-1,-2],[-1,-4],[0,-3],[0,-9],[0,-7],[-1,-5],[-3,-10],[-1,-6],[-1,-16],[0,-4],[-2,-2],[-2,-2],[-2,-2],[0,-3],[-1,-8],[-16,-56],[-1,-6],[-1,-4],[-3,-3],[-6,-4],[-7,-7],[-4,-8],[-6,-20],[-9,-16],[-2,-2],[-6,-14],[2,-3],[-1,-3],[-1,-3],[-11,-17],[-1,-3],[-2,-7],[-3,-5],[-5,-4],[-4,-3],[-13,-3],[-4,-3],[-13,-10],[-3,-5],[-2,-3],[-1,-2],[0,-2],[-1,-2],[-4,-5],[-1,-2],[-2,-6],[-3,-5],[-7,-9],[-14,-23],[-5,-5],[-6,-7],[-3,-4],[-1,-4],[-1,-3],[-7,-7],[-5,-8],[-1,-3],[-1,-5],[0,-6],[-1,-3],[-2,-5],[-5,-19],[-2,-22],[-1,-5],[-4,-12],[-2,-7],[-1,-5],[-1,-3],[0,-3],[-1,-1],[-1,-2],[-1,-2],[-4,-3],[-2,-2],[-1,-2],[-2,-9],[-3,-9],[-4,-6]],[[5268,6126],[-207,12],[-28,2],[-841,57],[-303,25],[-1,-2],[-5,2],[-14,7],[-6,7],[-4,1],[-10,3],[-3,2],[-3,2],[-2,1],[-3,1],[-2,-1],[-2,-1],[-6,-3],[-3,-1],[-4,0],[-3,1],[-2,2],[-2,3],[-2,7],[0,9],[-1,2],[-1,3],[-2,3],[-2,2],[-4,2],[-16,5],[-5,1],[-4,1],[-2,-1],[-2,-1],[-3,0],[-4,1],[-6,3],[-4,3],[-2,3],[0,2],[-1,3],[0,17],[-1,11],[-1,3],[-2,2],[-2,2],[-16,8],[-3,2],[-3,3],[-5,3],[-16,8],[-3,2],[-11,9],[-1,3],[-1,5],[-1,2],[-2,2],[-10,7],[-4,4],[-8,8],[-4,3],[-3,1],[-15,5],[-2,3],[-1,4],[0,6],[0,2],[-1,6],[-2,6],[-2,3],[-1,2],[-2,3],[-2,2],[-1,3],[0,3],[0,5],[0,3],[-2,8],[0,3],[0,2],[0,3],[0,1],[-1,2],[-4,8],[-1,2],[0,3],[1,2],[1,3],[0,3],[1,3],[-1,11],[0,5],[1,3],[2,5],[0,2],[1,8],[3,8],[-1,3],[-2,4],[-10,11],[-3,3],[-1,3],[-1,5],[-1,2],[-2,3],[-10,12],[-2,3],[-1,3],[-1,2],[-1,8],[-4,8],[-1,6],[-2,5],[0,8],[-1,4],[-5,12],[-4,12],[-3,20],[-2,4],[-2,3],[-5,5],[-2,4],[-1,3],[-3,11],[-4,12],[-18,30],[-17,19]],[[3355,8707],[-22,278]],[[3333,8985],[1,0],[5,-3],[4,-4],[3,-6],[1,-6],[2,-5],[6,-5],[4,-2],[4,-1],[4,0],[5,1],[5,3],[4,3],[4,5],[6,10],[3,2],[3,1],[23,-3],[1,1],[3,2],[1,1],[1,-1],[1,-1],[1,-1],[2,-1],[1,-1],[2,0],[7,12],[2,5],[-1,6],[-1,5],[-4,10],[-2,6],[3,4],[1,0],[16,4],[3,0],[6,5],[0,2],[-2,6],[1,2],[1,2],[5,3],[2,1],[2,3],[1,4],[2,3],[2,2],[1,0],[2,-4],[2,-2],[4,-3],[4,-1],[5,-1],[5,0],[2,1],[2,1],[3,1],[3,-3],[2,-2],[2,-6],[1,-2],[7,-2],[11,0],[9,2],[4,5],[4,8],[1,5],[1,4],[-2,8],[0,4],[1,2],[4,-1],[7,-3],[3,0],[4,1],[8,6],[18,9],[7,2],[7,0],[19,-4],[7,0],[10,3],[7,6],[15,21],[2,5],[6,17],[2,2],[3,2],[4,2],[4,4],[3,4],[3,4],[5,2],[5,-1],[8,-6],[5,-1],[19,14],[11,5],[6,-6],[2,-7],[2,-6],[4,-4],[6,-3],[4,-1],[4,0],[7,1],[5,0],[2,-2],[1,-2],[4,-4],[3,-1],[16,-3],[3,0],[2,2],[10,8],[3,1],[4,-1],[5,0],[3,2],[3,3],[4,1],[4,0],[3,-3],[3,-3],[4,-2],[3,1],[7,4],[10,5],[12,-5],[3,-1],[4,0],[7,2],[4,0],[4,-2],[8,-6],[5,-2],[3,-1],[11,1],[14,-4],[14,-7],[14,-3],[14,5],[7,8],[2,10],[-2,10],[0,11],[1,4],[1,2],[0,2],[-1,3],[-1,3],[-8,8],[-8,12],[-2,2],[-6,4],[-3,6],[-2,10],[-4,4],[-4,2],[-10,0],[-2,2],[0,5],[3,8],[3,7],[3,4],[3,1],[2,-1],[2,-2],[2,0],[3,1],[2,3],[6,11],[1,4],[1,12],[2,11],[2,4],[1,1],[3,1],[5,0],[5,-3],[12,-12],[4,-2],[15,-4],[2,-2],[2,-2],[3,-6],[2,-2],[4,-1],[18,5],[8,5],[5,0],[4,-1],[12,1],[9,0],[8,-1],[8,0],[6,3],[2,4],[1,5],[1,4],[4,5],[4,1],[4,1],[3,-2],[3,-3],[5,-1],[18,16],[7,1],[1,-3],[-1,-5],[2,-2],[2,0],[2,1],[8,4],[8,9],[5,3],[9,4],[4,1],[1,-3],[-2,-3],[-4,-5],[-1,-4],[1,-2],[22,-25],[9,-3],[11,3],[3,3]],[[2748,6401],[7,-6],[8,-6],[8,-8],[2,-4],[2,-5],[1,-3],[0,-2],[0,-3],[-10,-21],[-5,-22],[-1,-4],[0,-5],[0,-3],[6,-18],[1,-4],[-1,-3],[-2,-1],[-2,-1],[-5,0],[-3,-1],[-2,-1],[-1,-3],[1,-3],[0,-3],[-3,-7],[-1,-4],[0,-3],[2,-3],[2,-3],[5,-3],[2,-2],[2,-3],[1,-5],[0,-5],[-1,-9],[7,-27],[1,-2],[2,-3],[1,-3],[2,-4],[2,-2],[1,-2],[0,-3],[-1,-2],[-2,-1],[-1,-2],[-1,-2],[-2,-8],[-2,-2],[-2,-1],[-5,-1],[-1,-1],[-1,-2],[1,-2],[2,-3],[2,-3],[0,-4],[1,-9],[0,-4],[3,-10],[1,-3],[-1,-3],[-2,-9],[-1,-4],[0,-4],[1,-6],[0,-3],[-1,-2],[-5,-10],[-3,-7],[-1,-4],[0,-5],[-1,-9],[1,-4],[2,-4],[1,-2],[2,-4],[0,-3],[-2,-9],[-1,-4],[1,-3],[10,-24],[1,-3],[4,-5],[2,-3],[2,-3],[1,-4],[0,-3],[0,-5],[-2,-12],[-1,-16],[-2,-14],[0,-9],[-2,-8],[1,-2],[1,-1],[2,-1],[2,-1],[2,-1],[1,-3],[-1,-4],[-1,-6],[-2,-3],[-1,-2],[-2,0],[-1,1],[-2,0],[-2,-1],[-1,-3],[1,-4],[2,-10],[0,-5],[0,-3],[-3,-19],[0,-4],[3,-6],[8,-2],[228,-2],[2,-1],[0,-2],[-1,-3],[-1,-3],[2,-3],[11,-13],[3,-2],[2,0],[3,1],[6,6],[3,1],[2,1],[2,0],[3,-1],[7,-6],[3,-1],[9,-2],[2,-1],[3,1],[2,1],[3,1],[2,0],[8,-2],[2,0],[2,0],[3,0],[2,-1],[4,-3],[6,-2],[3,-2],[2,-3],[3,-11],[1,-4],[0,-3],[1,-5],[2,-7],[10,-22],[1,-6],[-1,-3],[-1,-3],[-2,-2],[-2,-2],[-2,-2],[-3,-1],[-2,-3],[-1,-3],[-2,-5],[-1,-3],[-2,-3],[-4,-6],[-2,-3],[-14,-12],[-2,-2],[-1,-2],[-1,-3],[-1,-12],[2,-22],[0,-3],[2,-7],[1,-3],[0,-12],[1,-4],[1,-5],[2,-5],[2,-3],[2,-1],[3,0],[4,2],[2,0],[2,0],[2,-1],[2,-3],[4,-13],[5,-11],[2,-11],[8,-12],[2,-4],[0,-3],[0,-29],[0,-4],[1,-5],[5,-13],[5,-9],[3,-6],[1,-2],[-1,-4],[-4,-9],[-15,-44],[-18,-23],[-1,-3],[-1,-3],[-3,-11],[-3,-11],[0,-7],[-2,-5],[-1,-3],[-7,-11],[-2,-3],[-3,-2],[-2,-1],[-10,-2],[-3,-1],[-3,-2],[-4,-3],[-2,-3],[-3,-5],[-8,-10],[-3,-4],[-1,-3],[0,-2],[1,-8],[0,-3],[-2,-5],[-14,-28],[-3,-6],[-1,-6],[-1,-7],[-2,-8],[-1,-8],[0,-4],[-2,-5],[-2,-3],[-3,-3],[-17,-11],[-39,-29],[-8,-8],[-7,-8]],[[2944,5147],[-16,15],[-16,7],[-1,2],[-4,4],[-8,2],[-10,1],[-10,2],[-4,5],[0,10],[-2,3],[-3,-1],[-2,-2],[-1,-1],[-10,-1],[-3,-3],[-1,-5],[-2,-2],[-15,1],[-5,-2],[-2,0],[-3,1],[-5,4],[-8,1],[-3,2],[-3,0],[-15,-9],[-10,-4],[-10,-1],[-10,3],[-3,1],[-6,7],[-1,0],[-1,0],[-15,-2],[-6,-1],[-5,-2],[-4,-3],[-4,2],[-5,-1],[-4,-2],[-5,-1],[-5,1],[-2,3],[-5,17],[-1,2],[-1,2],[-5,2],[-2,2],[-11,12],[-3,3],[-5,2],[-2,1],[-3,6],[0,1],[-3,2],[-10,12],[-5,4],[-2,4],[-1,4],[0,17],[0,4],[-2,1],[-1,-1],[-3,1],[-5,7],[-2,1],[0,-6],[-6,4],[-3,1],[-2,0],[-8,-3],[-3,-2],[-4,-1],[-5,2],[-2,-2],[-3,0],[-10,1],[-2,1],[-4,2],[-1,0],[-3,0],[-1,1],[0,2],[0,2],[-6,8],[-3,2],[-5,1],[-14,0],[-19,9],[-1,1],[0,6],[-1,3],[-2,2],[-2,2],[-4,3],[-3,-1],[-2,-2],[-3,-2],[-4,-1],[-4,1],[-2,-2],[-1,-5],[-4,3],[-4,3],[-3,3],[-1,4],[0,3],[-1,1],[-2,0],[-2,1],[-2,0],[-1,1],[-1,2],[-12,17],[0,2],[-2,2],[-2,-1],[-2,-1],[-1,-1],[-2,0],[-3,1],[-3,3],[-2,4],[-2,4],[-1,6],[-1,3],[-2,3],[-5,5],[-1,1],[0,1],[0,2],[2,3],[-1,1],[-1,1],[-1,2],[-2,9],[-2,4],[-7,2],[-4,2],[-3,1],[0,-1],[-6,-3],[-1,-1],[-1,-3],[-1,-1],[-1,0],[-3,0],[-1,0],[-5,-4],[-2,-2],[-1,-2],[-2,-1],[-16,0],[-3,1],[-6,6],[-3,1],[-4,2],[-9,7],[-1,1],[0,3],[-2,1],[-2,1],[-2,2],[-1,2],[0,3],[0,2],[-2,3],[-2,2],[-2,1],[-3,1],[-3,0],[-4,1],[-4,2],[-9,8],[-12,7],[-1,1],[-32,5],[-3,0],[-7,-3],[-3,0],[-1,-2],[-7,-10],[-1,-3],[-2,-2],[-2,-2],[-4,0],[-3,1],[-2,3],[-3,1],[-7,-3],[-4,-1],[-5,8],[-13,0],[-3,5],[-4,-6],[-2,-2],[-2,1],[-6,7],[-4,2],[-4,2],[-4,-1],[-2,-1],[-3,-3],[-1,-1],[-1,0],[-2,-1],[-3,1],[-2,8],[-3,1],[-9,-2],[-5,1],[-5,2],[-3,3],[-3,3],[-2,3],[-2,6],[-2,2],[-2,1],[-5,2],[-1,1],[-1,5],[4,10],[1,5],[0,6],[0,3],[-1,2],[-3,4],[-1,0],[-4,1],[0,-1],[0,-1],[-5,3],[-3,3],[-2,0],[-6,0],[-2,1],[-11,5],[-5,4],[-2,2],[-1,1],[-2,2],[0,2],[0,1],[1,3],[0,3],[-1,4],[-1,1],[-3,0],[-1,-2],[-1,-6],[-1,-3],[-2,0],[-3,1],[-1,3],[2,3],[-7,9],[-3,5],[-1,5],[-1,4],[-4,1],[-4,1],[-3,2],[-5,-2],[-5,1],[-4,1],[-5,1],[-9,1],[-4,1],[-3,2],[-2,3],[-2,4],[0,5],[3,5],[1,2],[0,3],[-1,3],[-3,1],[-3,2],[-1,2],[-1,5],[0,3],[0,5],[0,3],[-1,2],[-3,6],[-2,8],[-3,3],[-4,2],[-4,3],[1,6],[0,2],[-4,-1],[-1,-2],[-1,-3],[-1,-12],[-2,-3],[-3,1],[-4,3],[-3,4],[-1,4],[0,9],[0,3],[2,3],[1,3],[-1,6],[0,3],[6,2],[-2,2],[-5,4],[-2,1],[-2,0],[-1,1],[-1,3],[0,3],[2,5],[0,2],[-2,4],[-2,2],[-5,3],[-8,-2],[-6,7],[-8,22],[0,2],[0,3],[2,3],[4,5],[0,3],[-2,2],[-4,3],[-4,4],[-3,4],[0,6],[2,3],[3,2],[1,4],[-2,4],[-4,3],[-3,4],[1,6],[4,4],[8,8],[2,5],[-1,5],[-1,4],[0,5],[3,6],[2,2],[2,1],[2,2],[0,2],[0,3],[-1,2],[-1,1],[-1,2],[-1,22],[-2,4],[-3,4],[-4,3],[-9,2],[-1,4],[3,11],[2,10],[0,5],[-1,7],[-3,4],[-4,2],[-4,5],[0,4],[2,13],[-1,3],[-1,0],[-1,3],[0,2],[0,3],[0,1],[1,2],[0,2],[0,1],[-3,5],[0,2],[5,1],[4,4],[5,10],[-1,1],[0,1],[-1,2],[1,5],[3,6],[3,5],[8,4],[3,6],[2,13],[4,6],[1,3],[-1,2],[-2,6],[-1,3],[0,11],[-1,5],[-4,14],[-2,10],[-1,10],[1,10],[2,6],[4,10],[1,6],[-1,4],[-2,4],[-4,3],[-2,3],[-3,11],[0,1],[-3,8],[-7,6],[-4,2],[-5,0],[-2,-1],[-3,-4],[-11,-9],[-1,-2],[-1,-4],[-1,-3],[-2,-4],[-2,-3],[-1,0],[-3,-1],[-1,-1],[-1,-1],[0,-2],[0,-1],[-1,-2],[-1,-1],[-1,-2],[-2,0],[-4,1],[-4,2],[-6,5],[-1,1],[-2,3],[-2,1],[-1,0],[-2,-1],[-1,-1],[-2,1],[-1,-1],[-1,1],[1,3],[0,6],[-3,0],[-8,-4],[-2,1],[-2,1],[0,2],[-1,3],[-1,3],[-1,-1],[-2,-5],[0,-2],[0,-3],[-1,-2],[-2,0],[-1,1],[-2,2],[-1,2],[0,2],[-4,-5],[-2,-1],[-3,0],[-9,2],[-3,1],[-4,-1],[-4,-1],[-10,-7],[-4,-1],[-3,1],[-6,3],[-3,2],[-1,0],[-3,-1],[-1,-1],[-2,-3],[-1,-1],[-1,1],[-1,1],[-1,1],[-1,0],[-12,-1],[-4,-2],[-7,-5],[-4,-2],[-22,-4],[-3,-1],[-9,-6],[-5,-2],[-4,-1],[-14,1],[-26,-5],[-2,-1],[-2,-2]],[[6218,6004],[27,-4],[15,1]],[[6260,6001],[-3,-1],[-2,-1],[-1,-2],[-1,-3],[-2,-4],[-1,-3],[0,-5],[-1,-3],[0,-1],[-1,-2],[-2,-2],[-5,-6],[-2,-2],[-1,0],[-3,-2],[-4,-3],[-7,-3],[-2,-1],[-6,-5],[-11,-7],[-7,-6],[-2,0],[-5,-1],[-4,-2],[-9,-11],[-2,-2],[-12,-6],[-1,-1],[-1,-1],[-9,-11],[-4,-4],[-3,-2],[-7,-7],[-1,-1],[0,-2],[-1,-3],[1,-2],[1,-1],[3,-1],[2,-1],[1,-1],[0,-1],[1,-1],[0,-1],[0,-2],[0,-1],[1,-2],[7,-11],[1,-2],[0,-1],[0,-2],[-1,-1],[-3,-3],[-2,-1],[-2,-1],[-4,-1],[-7,-3],[-6,-3],[-4,-3],[-2,-2],[-3,-5],[-11,-27],[-7,-22],[-1,-1],[-1,-2],[-6,-5],[-1,-1],[-3,-1],[-2,-4],[-6,-11],[-1,-3],[-2,-7],[0,-1],[0,-2],[0,-2],[0,-3],[2,-4],[2,-3],[1,-2],[9,-5],[1,-1],[1,0],[1,-2],[1,-1],[1,-3],[1,-4],[3,-7],[1,-2],[1,0],[1,-2],[2,-2],[2,0],[2,-1],[32,-5],[20,-6],[17,-9],[3,-3],[3,-2],[0,-1],[1,-2],[-1,-3],[-1,-7],[-2,-3],[-1,-1],[-1,-1],[-1,-1],[-1,-1],[-1,-1],[-15,-6],[-12,-6],[-2,-1],[-1,-2],[-2,-2],[-1,-1],[0,-1],[-1,-3],[0,-2],[2,-12],[0,-3],[1,-2],[2,-1],[1,0],[2,1],[5,1],[5,1],[3,0],[3,0],[2,-1],[5,-2],[4,-2],[4,-3],[2,-3],[4,-9],[1,-1],[-1,-2],[-1,-2],[-1,0],[-2,-2],[-1,0],[-2,-2],[-5,-5],[-2,-1],[-14,-5],[-2,-2],[-1,-1],[-8,-13],[-2,-1],[-2,-2],[-13,-8],[-1,-1],[-1,-2],[0,-1],[-1,-5],[-1,-55],[0,-2],[4,-12],[2,-7],[1,-1],[2,-2],[9,-5],[14,-3],[2,-1],[4,-3],[1,-1],[1,-1],[0,-1],[1,-1],[0,-1],[1,-22],[-1,-1],[0,-2],[-17,-29],[-1,-3],[-1,-5],[0,-2],[0,-2],[0,-5],[2,-4]],[[5213,5356],[-3,2],[-7,0],[-3,0],[-3,1],[-1,1],[-1,1],[-1,1],[0,2],[0,1],[1,1],[0,1],[-2,0],[-1,0],[-2,-1],[-2,0],[0,1],[-1,1],[0,4],[-1,2],[-1,2],[0,1],[0,4],[0,3],[0,4],[-1,3],[0,1],[-2,5],[0,1],[-1,6],[0,1],[-1,1],[-4,2],[-3,3],[-2,2],[0,2],[0,2],[0,2],[1,0],[1,0],[1,0],[1,-1],[1,0],[0,1],[1,2],[-1,6],[0,2],[0,2],[0,1],[2,5],[1,1],[0,3],[1,4],[0,4],[0,4],[0,3],[0,1],[2,1],[1,0],[1,1],[0,1],[1,1],[0,2],[-4,31],[0,1],[1,3],[0,3],[0,2],[-3,9],[-1,1],[-4,4],[-2,4],[-1,3],[-2,38],[0,6],[0,5],[1,1],[0,1],[3,2],[1,1],[1,2],[0,3],[-1,2],[-1,3],[0,2],[0,1],[0,2],[1,1],[1,0],[1,1],[1,1],[0,2],[0,3],[0,2],[-1,1],[-1,1],[-2,0],[-2,1],[-1,2],[0,3],[-1,6],[0,2],[-1,1],[-1,5],[0,4],[-1,2],[-1,2],[-1,2],[-1,2],[-1,1],[0,2],[1,4],[0,2],[1,1],[2,3],[1,2],[2,1],[2,3],[2,1],[1,1],[0,1],[1,2],[0,1],[1,11],[0,3],[0,1],[-1,1],[-1,1],[-1,1],[-9,5],[-1,1],[-1,1],[-1,2],[0,1],[-3,3],[-2,5],[0,3],[0,8],[1,4],[1,4],[1,3],[0,6],[7,25],[2,2],[0,1],[1,2],[2,6],[1,1],[1,8],[0,22],[1,2],[3,7],[1,1],[1,1],[2,1],[1,1],[1,1],[0,1],[1,2],[1,4],[-1,7],[0,2],[-1,3],[-2,13],[-1,7],[-1,2],[1,1],[3,4],[0,2],[1,1],[0,3],[0,2],[0,2],[-2,5],[-1,4],[0,2],[0,1],[2,3],[2,2],[1,1],[1,2],[2,5],[1,5],[0,10],[0,3],[-3,6],[0,4],[1,1],[2,5],[1,2],[1,3],[1,2],[2,1],[2,0],[2,1],[3,9],[1,1],[2,2],[0,3],[-1,6],[1,2],[4,5],[1,3],[0,3],[0,9],[1,5],[3,4],[7,7],[5,8],[4,11],[3,12],[1,10],[-1,9],[-1,6],[1,5],[2,2],[2,6],[1,2],[12,15],[3,4],[1,4],[0,6],[5,16],[4,10],[5,10]],[[5107,3657],[0,-5],[1,-5],[3,-5],[2,-4],[-3,-5],[-2,-1],[-4,0],[-2,-1],[-1,-2],[0,-2],[0,-14],[-2,-5],[-5,-8],[-1,-7],[0,-8],[4,-38],[1,-32],[2,-19]],[[4618,2830],[-69,-33],[-16,-11],[-7,-8],[-3,-4],[-5,-16],[-3,-9],[-1,-23],[-4,-10],[-4,-9],[-7,-20],[-4,-9],[-6,-9],[-24,-16],[-19,-8],[-5,-5],[-1,-3],[0,-9],[-10,-38],[-2,-15],[-7,-20],[-2,-11],[0,-23],[-2,-11],[-5,-5],[-17,-9],[-2,-3],[-4,-4],[-9,-5]],[[4380,2484],[-6,4],[-21,13],[-12,18],[-5,4],[-38,23],[-5,1],[-4,-2],[-5,-6],[-4,-2],[-29,-11],[-14,-8],[-3,-4],[-5,-7],[-4,-2],[-4,-1],[-7,0],[-4,-2],[-7,-2],[-14,0],[-5,-3],[-8,-4],[-8,-1],[-8,2],[-8,3],[-7,2],[-14,1],[-6,3],[-6,6],[-2,6],[-3,50],[-5,16],[-10,11],[-4,7],[-1,8],[1,10],[-1,1],[-1,7],[0,9],[5,14],[1,8],[-3,5],[-6,8],[-2,6],[1,4],[5,11],[0,5],[-5,19],[-1,2],[-6,4],[-2,3],[0,5],[1,9],[-1,5],[-3,4],[-6,7],[0,5],[1,8],[0,5],[-5,19],[0,10],[3,8],[3,7],[3,9],[0,2],[-2,4],[0,2],[0,3],[1,4],[0,2],[0,5],[-2,3],[-3,2],[-5,2],[-7,4],[-6,7],[-4,8],[-1,9],[-1,22],[-2,6],[-2,3],[-9,7],[-11,17],[-2,-6],[-1,-2],[-4,3],[-14,2],[-3,1],[-4,3],[-3,2],[-2,-2],[-3,-1],[-38,2],[-4,1],[-4,3],[-7,7],[-12,8],[-7,7],[-5,8],[-6,16],[-2,2],[-3,1],[-16,-3],[-4,-2],[-2,-2],[-2,-2],[-4,-6],[0,-1],[-2,-4],[0,-1],[-2,-1],[-1,-1],[-3,-7],[-3,-3],[-7,-6],[-2,-1],[-2,0],[-2,-2],[2,-5],[-1,-2],[-3,1],[-8,10],[-3,2],[-1,-1],[-2,-5],[-1,-2],[-3,-1],[0,1],[-2,1],[-7,-3],[-2,0],[-3,1],[-1,0],[0,-2],[-1,-2],[-6,-6],[-2,-1],[-6,0],[0,4],[-2,6],[-3,4],[-2,-7],[-3,1],[-4,2],[-2,0],[-2,-1],[-1,2],[1,4],[-3,-2],[-2,0],[-6,2],[-3,0],[-8,0],[-2,-1],[-2,0],[-1,0],[-1,0],[-4,1],[-1,1],[-1,1],[0,1],[-2,1],[-6,2],[-4,1],[-2,0],[-1,-1],[-1,-1],[-3,0],[-1,2],[-1,4],[-1,1],[-3,-1],[-5,-5],[-5,-1],[-9,3],[-4,0],[0,-1],[0,-1],[-2,-2],[-2,0],[-4,2],[-1,1],[-1,-2],[-2,0],[-7,5],[-3,1],[-3,1],[-4,2],[-2,0],[-9,-3],[-5,4],[-1,1],[-3,0],[-1,0],[-1,-1],[-2,-1],[-6,-1],[-3,1],[-3,3],[-3,6],[-3,10],[-2,1],[-2,0],[-2,-1],[-2,-1],[-5,0],[-3,1],[-2,0],[-5,-2],[-1,0],[-2,1],[-1,0],[0,-1],[-1,-1],[0,-2],[1,0],[-3,-1],[-1,-1],[-3,1],[-2,0],[-4,-3],[-2,-1],[-1,1],[-3,4],[-2,1],[-2,0],[-4,-2],[-2,0],[-8,2],[-2,4],[-2,4],[-3,2],[-3,2],[0,2],[0,4],[0,4],[5,15],[0,2],[3,3],[5,10],[1,3],[-2,6],[-3,4],[-2,4],[1,4],[3,6],[1,5],[-1,5],[0,5],[9,17],[-1,2],[-2,2],[-3,3],[-2,5],[-1,4],[1,5],[3,5],[2,6],[-2,2],[-5,2],[-1,4],[-1,6],[1,5],[4,9],[14,25],[2,6],[-2,3],[-4,1],[-2,3],[0,1],[-2,1],[-1,2],[0,4],[2,2],[6,5],[5,8],[3,11],[1,12],[-2,11],[-3,8],[0,3],[6,11],[2,5],[0,6],[-5,4],[0,-5],[-2,0],[-5,6],[-5,5],[-1,0],[-1,1],[-1,0],[-2,1],[-1,3],[2,3],[10,6],[2,3],[-1,4],[-2,4],[-4,3],[-4,1],[-6,0],[-2,2],[2,2],[3,3],[3,3],[2,2],[4,1],[3,1],[2,2],[-1,2],[-2,2],[-3,3],[-2,1],[0,2],[-2,4],[-1,1],[-3,3],[-3,0],[-3,-2],[-2,-9],[-2,0],[-2,2],[-2,3],[0,3],[2,5],[0,3],[-1,2],[-3,5],[0,4],[0,5],[0,3],[-3,7],[-1,6],[0,6],[0,5],[4,8],[1,4],[-4,2],[-4,2],[-5,3],[-5,4],[-3,4],[-2,4],[-1,7],[-1,6],[2,7],[-1,3],[-2,2],[-1,1],[-2,-1],[-2,-1],[-1,-1],[-1,-1],[-4,3],[-2,5],[2,4],[8,3],[-1,3],[-2,3],[-1,2],[-2,0],[-2,0],[-1,1],[0,4],[9,4],[3,2],[1,1],[3,4],[2,1],[5,3],[7,11],[6,2],[2,1],[3,1],[1,2],[1,2],[1,2],[4,-1],[5,-1],[5,2],[3,4],[3,4],[2,4],[-22,22],[-18,18],[-17,16],[-1,8],[7,18],[3,6],[6,14],[6,14],[3,6],[7,16],[15,35],[15,35],[7,16],[5,12],[4,2],[12,1],[-1,11],[-1,16],[-1,5],[-3,2],[-9,1],[3,8],[10,37],[11,37],[10,36],[11,37],[3,12],[3,3],[4,1],[15,1],[1,5],[-2,3],[-4,0],[-5,0],[-8,6],[-8,16],[-11,31],[-21,40],[7,0],[0,5],[-3,6],[-4,6],[-1,2],[2,9]],[[3609,4103],[3,1],[6,-2],[2,0],[6,0],[2,0],[1,-1],[5,-6],[1,-3],[0,-1],[0,-5],[0,-1],[0,-2],[1,-1],[1,-1],[1,-1],[4,-1],[1,0],[3,-3],[3,-1],[3,-3],[1,-1],[1,0],[5,-1],[1,-1],[1,0],[0,-1],[2,-3],[2,-2],[0,-1],[1,-2],[0,-1],[-1,-1],[-1,-4],[0,-2],[0,-1],[0,-1],[1,-1],[1,1],[0,1],[2,4],[4,9],[1,2],[0,1],[1,1],[1,1],[2,1],[36,11],[7,4],[5,2],[16,3],[1,0],[6,4],[3,2],[23,27],[1,1],[0,1],[0,1],[1,1],[0,2],[-2,9],[0,1],[1,2],[0,1],[1,1],[1,0],[5,3],[3,3],[2,2],[1,1],[3,2],[2,1],[1,1],[3,5],[3,4],[1,1],[1,1],[1,1],[0,1],[1,8],[1,1],[-1,7],[0,1],[0,1],[1,2],[0,1],[2,1],[1,1],[5,2],[2,1],[1,1],[0,1],[0,2],[1,3],[0,1],[1,1],[1,1],[5,5],[2,0],[17,-1],[31,3],[3,0],[2,1],[2,1],[2,0],[8,-4],[3,0],[5,0],[3,2],[4,2],[5,5],[2,1],[3,-1],[2,-1],[3,1],[2,2],[2,2],[7,9],[2,2],[2,1],[2,2],[2,1],[6,1],[11,2],[5,2],[3,0],[3,0],[10,-1],[3,-1],[5,-4],[2,-3],[1,-2],[0,-3],[1,-2],[1,-1],[1,-1],[3,-2],[16,-4],[7,-4],[7,-2],[3,-2],[2,-2],[3,-4],[2,-2],[3,-2],[13,-3],[5,1],[7,-2],[6,-2],[4,-1],[5,-3],[3,-4],[1,-3],[2,-5],[0,-2],[1,-2],[7,-8],[2,-4],[6,-4],[14,-8],[9,-3],[4,-2],[2,-2],[6,-1],[3,-1],[3,-4],[3,-3],[5,-4],[24,-15],[14,2],[3,-1],[6,0],[22,6],[4,1],[7,-1],[3,1],[3,1],[20,12],[2,2],[1,3],[2,5],[2,2],[2,2],[4,3],[12,5],[20,3],[2,0],[3,-1],[8,0],[2,0],[3,-1],[4,-3],[5,-5],[12,-8],[2,-1],[1,-3],[1,-2],[0,-2],[0,-5],[1,-3],[1,-5],[0,-2],[2,-2],[2,-1],[7,-1],[4,1],[3,1],[19,9],[10,3],[5,0],[5,0],[4,1],[3,2],[7,7],[2,5],[2,4],[0,2],[1,3],[2,3],[3,3],[12,7],[7,6],[20,25],[3,6],[1,2],[2,3],[3,3],[10,10],[4,2],[3,1],[12,1],[2,-1],[0,-3],[0,-5],[0,-3],[-1,-3],[-7,-32],[-1,-17],[0,-2],[-2,-8],[-5,-26],[0,-3],[-2,-1],[-2,-2],[-9,-2],[-8,-3],[-3,-1],[-2,-2],[-1,-2],[-1,-3],[-2,-8],[-1,-2],[-5,-7],[-2,-8],[-2,-2],[-7,-9],[-3,-5],[-2,-4],[0,-3],[0,-2],[0,-3],[2,-3],[8,2],[16,-5],[23,-14],[8,-2],[28,4],[5,0],[19,-5],[7,0],[7,1],[2,2],[5,0],[21,1],[4,-1],[17,-4],[5,-2],[9,-2],[18,2],[3,2]],[[7489,4041],[-2,1],[-4,2],[-1,1],[-1,0],[-2,2],[-1,1],[-1,1],[-1,0],[-1,1],[-1,0],[-3,-1],[-1,0],[-2,0],[-1,1],[-1,0],[-2,2],[0,1],[-1,1],[-1,1],[-1,0],[-4,0],[-1,1],[-2,1],[-1,1],[-10,3],[-1,1],[-1,0],[-1,1],[-1,3],[0,1],[-1,0],[-2,0],[-1,-2],[0,-2],[0,-2],[1,-4],[-1,-2],[0,-1],[-1,-1],[-2,0],[-1,0],[-2,0],[-1,1],[-1,1],[-5,5],[-1,0],[-1,1],[-1,0],[-2,0],[-8,-3],[-3,-1],[-2,-1],[-10,-7],[-4,-2],[-2,-1],[-3,1],[-3,0],[-6,2],[-2,0],[-1,0],[-2,-1],[-4,-3],[-3,-1],[-3,-2],[-1,0],[-1,0],[-2,0],[-1,1],[-2,1],[-1,1],[-1,1],[-1,0],[-1,-1],[-4,-1],[-3,0],[-1,0],[-2,0],[-1,0],[-1,1],[-2,3],[-1,0],[-2,0],[0,-1],[-1,-2],[1,-1],[0,-2],[30,-31],[1,-1],[0,-1],[1,-1],[0,-3],[0,-6],[0,-1],[-1,-2],[-3,0],[-1,0],[-3,0],[-6,0],[-2,1],[-1,0],[-1,1],[-1,2],[-1,0],[-4,2],[-1,1],[0,1],[-3,3],[-1,1],[-2,1],[-1,0],[-1,0],[-2,0],[-1,-1],[-2,-1],[-2,-2],[-15,-15],[-1,0],[-1,-1],[-5,1],[-1,0],[-1,-1],[-2,-2],[-2,-4],[-5,-10],[-3,-6],[-6,-5],[-1,-1],[0,-2],[1,-4],[0,-2],[2,-4],[0,-4],[-4,-10],[2,0],[1,0],[3,1],[7,8],[1,-2],[2,-2],[2,-1],[3,-2],[2,-1],[3,-3],[2,-1],[2,-5],[1,-1],[1,-2],[0,-5],[0,-3],[-1,-8],[0,-11],[-3,-13],[-2,-12],[0,-2],[1,-2],[0,-1],[1,-1],[1,-1],[1,0],[2,-1],[11,0],[2,-1],[1,0],[1,-1],[0,-1],[1,-1],[1,-1],[0,-2],[2,-17],[0,-3],[0,-2],[-1,-2],[0,-2],[-1,-2],[-1,-1],[-2,-1],[-1,-1],[-3,-2],[-5,-1],[-24,0],[-2,0],[-1,1],[-1,2],[0,1],[-1,1],[-1,0],[-2,0],[-4,0],[-6,0],[-6,0],[-3,-1],[-1,-1],[-1,-1],[-1,-1],[-2,-1],[-1,-1],[0,-2],[0,-1],[0,-2],[0,-1],[4,-2],[2,-5],[1,-1],[1,-1],[3,-1],[2,-2],[2,-1],[1,0],[1,0],[1,0],[3,3],[1,0],[2,1],[1,1],[2,0],[1,0],[2,-1],[1,0],[1,-1],[0,-1],[3,-4],[1,-1],[1,-1],[1,-1],[2,-1],[1,0],[0,-2],[-1,-2],[0,-2],[1,-2],[1,-1],[2,0],[1,-1],[1,0],[1,-2],[0,-1],[-1,-5],[-5,-9],[0,-2],[0,-1],[1,-2],[2,-1],[3,-1],[1,0],[1,-1],[11,-12],[2,-2],[3,-5],[0,-2],[2,-7],[0,-8],[0,-7],[-1,-6],[0,-3],[1,-2],[1,0],[1,-1],[0,-2],[0,-2],[-1,-7],[0,-7],[0,-3],[-1,-1],[-5,-13],[0,-3],[-1,-3],[1,-2],[0,-2],[0,-1],[0,-2],[0,-1],[-1,-2],[-1,-2],[-3,-2],[-2,-2],[-2,0],[-2,0],[-1,0],[-1,1],[-4,2],[-1,0],[-1,0],[-1,-2],[0,-2],[0,-1],[0,-1],[4,-7],[0,-1],[0,-2],[-1,-2],[-7,-8],[-1,-1],[-1,-1],[-1,0],[-1,0],[-2,-1],[-1,-3],[-2,-2],[-1,-2],[-8,-5],[-1,0],[-1,-3],[-2,-6],[-3,-26],[0,-3],[1,-3],[-2,-14],[-1,-1],[-1,-2],[-3,-2],[-2,-1],[-4,-6],[-2,-1],[-2,-1],[-1,1],[-1,0],[-2,0],[-1,-1],[-1,0],[-1,-2],[-2,-3],[-2,-2],[-1,-2],[0,-1],[-1,-4],[0,-5],[0,-1],[0,-3],[-5,-17],[-2,-8],[0,-3],[0,-2],[0,-1],[-5,-14],[-1,-2],[-2,-1],[-4,-1],[-2,-3],[-7,0],[-62,1],[-3,0],[-2,-1],[-1,-1],[-1,-2],[-1,-2],[-1,-1],[-3,-11],[-1,-2],[-2,-2],[-7,-4],[-4,-3],[-2,-2],[-2,-3],[0,-1],[-1,-2],[0,-1],[0,-3],[1,-2],[2,-3],[1,-3],[1,-2],[1,-1],[7,-4],[-2,-12],[0,-7],[0,-1],[2,-5],[0,-2],[0,-1],[-1,-1],[-3,-2],[0,-1],[-1,-1],[-3,-10],[-1,-3],[-3,-4],[0,-1],[0,-2],[1,0],[1,0],[1,0],[2,2],[1,0],[2,0],[1,-1],[0,-1],[1,-1],[-1,-2],[-5,-8],[-2,-3],[-4,-11],[-2,-3],[-1,-1],[-1,-1],[-1,-2],[1,-2],[0,-1],[3,-2]],[[7122,3323],[-2,-3],[-1,-1],[-1,-1],[-3,-1],[-2,0],[-3,-1],[-2,-6],[1,-3],[-1,-1],[-4,-7],[-3,-9],[-1,-2],[-2,-2],[-2,-1],[-1,-1],[-2,0],[-1,0],[-1,0],[-1,0],[-1,1],[-1,1],[-1,0],[-1,1],[-4,-2],[-3,0],[-1,0],[-1,0],[-1,0],[-3,2],[-1,0],[-1,-1],[-2,-2],[-2,-3],[-2,-1],[-2,-1],[-1,-2],[-1,-1],[0,-4],[1,-2],[1,-1],[1,-1],[1,-1],[1,0],[3,0],[2,-1],[0,-3],[-2,-4],[-4,-10],[-2,-4],[-3,-4],[-1,-2],[-2,-5],[-1,-2],[-1,-2],[-2,-2],[0,-2],[-1,-2],[0,-4],[0,-2],[1,-2],[0,-2],[-1,-3],[-6,-12],[-1,-6],[-2,-13],[-12,-10],[-2,-2],[-2,-6],[-1,-1],[0,-3],[1,-9],[-1,-4],[0,-3],[0,-1],[-11,-17],[-4,-10],[-1,-7],[0,-2],[0,-1],[2,-1],[1,0],[2,0],[1,0],[3,-2],[1,0],[2,1],[1,0],[1,0],[2,0],[1,0],[1,0],[1,-1],[1,-1],[1,-1],[1,-1],[2,-3],[0,-1],[0,-4],[-4,-7],[-3,-1],[-4,-4],[-2,-2],[-3,0],[-4,2],[-2,0],[-3,-2],[-3,-3],[-3,-3],[-12,-3],[-22,-14],[-27,-10],[-17,-10],[-29,-13],[-4,-3],[-7,-7],[-4,-2],[-13,-2],[-6,-3],[-1,-3],[-1,-4],[-2,-5],[-2,0],[-5,1],[-3,0],[-3,-2],[-2,-4],[-3,-1],[0,1],[-1,1],[-1,2],[0,1],[0,1],[1,2],[0,1],[1,1],[1,1],[0,1],[1,1],[0,2],[0,1],[0,2],[-1,1],[-1,0],[-6,0],[-5,0],[-3,0],[-4,0],[-2,1],[-1,0],[-2,2],[-1,1],[-1,0],[-2,0],[-8,0],[-2,0],[-2,0],[-1,1],[-1,0],[-1,0],[-3,0],[-6,-2],[-17,-10],[-4,-2],[-1,0],[-4,0],[-4,0],[-2,0],[-3,-1],[-4,-1],[-3,0],[-1,0],[-1,1],[-1,1],[-2,3],[-1,0],[-2,0],[-1,-2],[-2,-1],[-1,-1],[-2,1],[-3,1],[-1,0],[-2,0],[-2,-2],[-2,-2],[-1,-1],[-1,1],[-2,2],[-2,0],[-2,-1],[-4,-1],[-2,-1],[-3,-1],[-2,1],[-1,0],[-1,1],[-1,2],[-1,1],[-2,1],[-1,-1],[-7,-2],[-12,-5],[-3,-3],[-2,-2],[-4,-2],[-8,-2],[-26,-11],[-2,-1],[-1,0],[-2,0],[-2,-1],[-4,-6],[-2,-2],[-21,-12],[-5,-2],[-4,0],[-1,1],[-2,1],[-1,1],[-1,1],[-1,0],[-1,0],[-10,-2],[-3,0],[-12,-1],[-2,0],[-2,0],[-2,0],[-3,-1],[-17,-11],[-1,0],[-2,-1],[-2,-1],[-6,-1],[-7,-1],[-2,0],[-2,-2],[-2,-3],[-4,-6],[0,-1],[-1,-1],[-3,-1],[-5,2],[-4,1],[-4,0],[-2,0],[-9,-4],[-4,-2],[-9,-6]],[[6201,4838],[0,-3],[1,-2],[2,-6],[1,-2],[0,-5],[0,-1],[1,-1],[5,-10],[1,-1],[0,-1],[0,-1],[0,-1],[-1,-1],[-3,-4],[-1,-2],[-4,-10],[-1,-9],[-4,-12],[-5,-9],[-2,-4],[-1,-1],[-2,-5],[0,-1],[0,-2],[0,-1],[1,-1],[1,-1],[2,0],[1,1],[3,4],[2,2],[1,1],[11,5],[2,1],[1,1],[1,1],[2,4],[1,1],[1,2],[2,5],[2,2],[1,1],[2,0],[2,0],[12,-2],[3,-1],[16,-2],[3,0],[1,0],[7,5],[8,8],[3,4],[1,5],[1,3],[0,1],[4,3],[3,2],[4,4],[1,2],[1,3],[1,1],[3,3],[1,2],[2,3],[1,1],[0,2],[1,1],[1,1],[5,0],[2,0],[1,-1],[1,0],[3,-2],[1,0],[1,0],[6,1],[5,2],[8,6],[6,5],[3,5],[1,1],[2,0],[4,1],[1,1],[2,1],[2,4],[1,1],[2,2],[1,2],[1,1],[1,4],[1,1],[8,8],[1,1],[1,1],[0,3],[1,1],[1,1],[1,1],[2,1],[3,0],[5,0],[1,0],[3,1],[3,1],[1,0],[1,-1],[1,0],[2,1],[4,1],[49,31],[5,5],[0,1],[0,3],[1,1],[3,6],[1,2],[0,1],[0,1],[1,1],[3,1],[3,2],[22,16],[4,4],[4,3],[0,2],[2,1],[1,1],[4,2],[5,4],[7,4],[2,2],[3,2],[21,8],[13,8],[8,2],[2,0],[2,2],[4,4],[2,1],[1,0],[2,0],[4,-1],[1,0],[3,1],[1,0],[1,-1],[4,-1],[1,-1],[2,1],[0,1],[1,1],[0,1],[1,0],[1,1],[1,0],[1,0],[2,-2],[2,-2],[4,-3],[2,-1],[2,0],[2,0],[2,0],[1,0],[1,-2],[2,0],[1,0],[2,2],[1,0],[1,0],[2,0],[3,-1],[2,0],[2,-1],[3,-1],[2,-1],[2,0],[1,0],[3,3],[1,0],[1,0],[1,0],[1,-1],[3,-2],[5,-4],[2,-1],[5,0],[2,0],[2,1],[1,0],[2,0],[1,0],[2,-1],[4,-3],[1,0],[2,0],[1,0],[1,0],[2,0],[2,-1],[2,-3],[4,-2],[0,-1],[-3,-5],[-4,-8],[-3,-8],[-2,-11],[-4,-8],[-1,-4],[-1,-3],[-2,-9],[1,-3],[0,-1],[2,-4],[1,-1],[0,-1],[0,-3],[0,-2],[0,-1],[0,-2],[-1,-1],[0,-1],[0,-2],[1,-3],[0,-1],[1,-1],[3,-3],[1,-1],[2,-2],[2,0],[19,-5],[2,-1],[3,-2],[1,-3],[1,0],[48,-14],[9,3],[2,1],[0,1],[2,3],[1,1],[1,1],[3,3],[1,1],[0,1],[1,1],[0,3],[1,1],[1,1],[0,1],[1,1],[23,12],[8,2],[4,2],[1,0],[3,1],[7,0],[4,0],[6,-3],[6,-2],[9,-2],[2,0],[2,0],[3,0],[10,-5],[2,0],[3,1],[3,-1],[2,-1],[2,-1],[3,-3],[1,-2],[1,-2],[3,-6],[0,-1],[2,-2],[17,-14],[4,-4],[10,-9],[3,-3],[11,-8],[1,-1],[2,-3],[1,-1],[5,-4],[2,-1],[2,0],[2,0],[9,2],[1,0],[1,-1],[3,-4],[8,-3],[6,-4],[1,-2],[3,-4],[3,-2],[7,-6],[27,-14],[5,-3],[6,-3],[11,-2],[2,0],[1,0],[4,3],[1,0],[2,-1],[1,-1],[2,-3],[1,-1],[1,-2],[5,-2],[1,-2],[3,-3],[0,-1],[1,-2],[1,-1],[1,-1],[2,0],[2,1],[4,2],[2,0],[1,0],[3,0],[6,1],[2,0],[8,-1],[1,0],[2,0],[1,1],[2,1],[1,1],[7,3],[4,3],[2,2],[0,1],[1,1],[1,0],[6,0],[1,1],[1,0],[3,2],[67,-66],[31,-33],[6,-57],[2,-6],[7,1],[10,-3],[10,-2],[2,-1],[1,0],[7,-5],[4,1],[10,6],[9,2],[5,3],[8,7],[2,3],[0,1],[1,1],[3,1],[1,0],[2,2],[1,0],[1,0],[2,0],[2,-1],[6,-3],[2,-1],[2,0],[2,0],[3,1],[4,2],[1,0],[1,0],[2,0],[2,-1],[3,-2],[2,-2],[1,-1],[5,-8],[2,-1],[1,0],[3,0],[3,1],[4,3],[2,1],[6,1],[1,1],[3,-1],[4,-2],[11,-6],[2,-2],[4,-9],[1,-1],[2,-1],[2,1],[1,0],[1,1],[1,1],[1,0],[3,1],[1,0],[4,2],[1,1],[3,-1],[17,-9],[7,-2],[5,-1],[4,0],[4,1],[1,0],[12,0],[2,0],[2,-1],[1,-1],[1,-3],[0,-1],[0,-2],[0,-1],[0,-1],[1,-1],[1,-1],[4,-1],[1,0],[1,-2],[-1,-3],[1,-1],[1,-1],[1,0],[2,0],[2,1],[2,0],[1,0],[3,-1],[3,-2],[7,-6],[3,-2],[1,-3],[1,-3],[2,-3],[1,-1],[1,-1],[6,-4],[2,0],[1,-1],[1,0],[3,1],[4,0],[5,-2],[1,-2],[0,-1],[2,-3],[1,-4],[2,-1],[3,-4],[1,-1],[1,-1],[0,-1],[1,-4],[1,-1],[2,-5],[1,-2],[0,-2],[0,-2],[-1,-3],[-1,-1],[-3,-1],[-1,-2],[-1,-2],[-4,-8],[-1,-4],[0,-7],[0,-4],[-1,-3],[-2,-6],[-3,-5],[-1,-1],[-5,-6],[-4,-3],[-15,-10],[-17,-28],[-2,-4],[1,-2],[0,-2],[0,-1],[0,-2],[-1,-1],[-2,0],[-1,0],[-2,0],[-2,1],[-2,0],[-3,0],[-13,-5],[-1,-1],[-1,-1],[-1,-2],[-1,-4],[0,-2],[0,-3],[0,-7],[0,-11],[-2,-15],[0,-1],[0,-2],[0,-1],[1,-1],[3,-5],[2,-2],[2,-5],[0,-3],[0,-1],[0,-2],[0,-1],[-2,-2],[-3,-2],[-2,-1],[-1,-2],[-1,-1],[-1,-2],[-1,-1],[-3,0],[-5,-1],[-17,0],[-8,2],[-6,2],[-1,0],[-1,0],[-1,-1],[-1,-4],[-1,-1],[-5,-5],[0,-1],[-1,-1],[-1,-3],[-6,-33],[-4,-10],[-1,-6],[0,-3],[3,-11],[0,-3],[0,-2],[0,-2],[-1,-3],[0,-2],[1,-6],[0,-2],[-1,-2],[0,-1],[-1,-1],[-1,-1],[-3,-1],[-1,-1],[0,-1],[-2,-4],[0,-3],[-1,-12],[-1,-6],[0,-2],[1,-2],[1,-1],[3,-2],[1,0],[1,1],[1,1],[1,1],[1,5],[1,1],[1,1],[1,1],[2,0],[2,0],[2,2],[1,0],[1,-1],[0,-2],[0,-2],[0,-1],[-4,-5],[0,-1],[-1,-2],[0,-1],[0,-1],[1,-1],[1,-1],[2,0],[1,1],[2,1],[0,1],[1,0],[1,0],[1,-1],[1,-1],[1,-4],[1,-2],[0,-2],[0,-2],[-3,-9],[0,-2],[-1,-3],[0,-1],[1,-6],[1,-2],[1,-1],[3,0],[2,0],[1,0],[1,0],[3,1],[3,0],[3,-1],[1,-1],[1,-1],[2,-4],[2,-8],[1,-3],[1,-1],[2,-2],[9,-6],[1,-1],[1,-2],[2,-3],[1,-2],[1,-3],[1,-2],[2,-1],[9,-5],[3,-2],[5,-6],[3,-6],[2,-5],[0,-2],[0,-2],[0,-3],[-2,-5],[0,-3],[-1,-2],[-4,-5],[-1,-2],[-1,-2],[-1,-2],[1,-4],[4,-11]],[[3609,4103],[-3,1],[-4,3],[-2,3],[-3,3],[-1,5],[-1,5],[0,9],[0,5],[0,6],[0,6],[-3,6],[-3,3],[-5,2],[-4,1],[-5,-1],[-6,-2],[-8,1],[-9,2],[-6,3],[-10,9],[-2,2],[-8,3],[-3,2],[-6,8],[-3,2],[-2,1],[-3,0],[-3,1],[-3,3],[-4,8],[-2,4],[-2,1],[-4,1],[-1,0],[-3,2],[-4,4],[-2,1],[-2,1],[-7,1],[-8,5],[-4,8],[-2,9],[0,23],[-1,6],[-2,4],[-1,4],[-2,18],[-1,5],[-4,8],[-2,12],[0,3],[0,3],[2,4],[1,2],[-1,10],[-4,19],[-1,12],[1,8],[4,8],[22,28],[3,9],[-4,10],[0,4],[5,5],[1,4],[-1,25],[-2,2],[-10,0],[-2,-1],[-3,-6],[-1,-3],[-5,-2],[-5,-1],[-16,0],[-42,2],[-42,2],[-42,2],[-43,1],[-42,2],[-42,2],[-42,1],[-42,2],[-16,1],[-6,2],[-5,11],[-1,29],[-2,27],[-3,38],[-4,52],[-3,38],[-1,6],[-4,6],[-20,27],[-24,33],[-15,20],[-12,12],[43,0],[25,1],[1,3],[0,16],[-1,21],[-1,21],[-1,21],[-1,21],[0,16],[-3,6],[-11,8],[-4,8],[7,3],[-1,11],[-7,18],[-4,16],[-1,4],[-12,11],[-3,5],[0,7],[1,7],[0,7],[-3,5],[-1,4],[0,6],[1,5],[1,4],[2,1],[5,2],[4,4],[2,5],[3,12],[2,5],[0,2],[0,2],[-2,1],[-2,1],[-1,2],[1,2],[0,2],[-5,4],[-2,2],[-2,6],[-2,6],[-1,8],[-1,6],[-2,5],[-4,3],[-16,4],[-2,1],[-1,2],[-1,3],[-1,1],[-2,1],[-5,1],[-7,4],[-17,15]],[[5384,1132],[-22,-30],[-11,-22],[-16,-27],[-14,-33],[-11,-13],[-36,-99],[-9,-32],[-15,-35],[-60,-100],[-1,-5],[-2,-3],[-27,-42],[-23,-25],[-13,-19],[-33,-41],[-26,-27],[-38,-31],[-53,-44],[-67,-40],[-5,-6],[-32,-39],[-8,-14],[-2,-1],[-2,5],[2,6],[5,9],[2,4],[2,5],[0,6],[-1,5],[-3,6],[2,3],[5,2],[2,4],[-3,8],[-13,16],[0,8],[8,5],[11,-4],[17,-12],[10,0],[9,4],[5,7],[-4,7],[11,2],[9,-1],[9,1],[8,6],[24,26],[3,7],[7,6],[2,5],[1,6],[3,-3],[6,-8],[3,1],[-1,4],[-3,10],[1,5],[2,5],[3,6],[3,3],[2,-9],[8,-2],[10,2],[7,4],[3,3],[7,5],[2,2],[8,12],[7,15],[5,19],[0,19],[-4,16],[1,3],[2,11],[0,4],[2,3],[4,-1],[8,-3],[4,1],[7,3],[3,1],[5,0],[1,-2],[0,-14],[1,-2],[2,-1],[2,0],[2,1],[1,2],[0,3],[2,3],[2,1],[3,1],[1,1],[-1,3],[-2,1],[-2,-1],[-3,1],[-4,7],[3,10],[4,10],[0,12],[-3,5],[-2,2],[2,1],[2,0],[3,-1],[2,0],[6,0],[4,2],[17,14],[8,2],[5,2],[3,3],[3,3],[9,17],[3,22],[-3,45],[-1,5],[-4,10],[-2,7],[-1,2],[0,2],[4,2],[3,1],[1,0],[3,-4],[7,-6],[1,-2],[-1,-1],[-1,-2],[-1,-2],[1,-5],[3,-5],[3,-4],[4,-3],[7,6],[2,3],[0,4],[-2,6],[1,3],[3,5],[4,15],[0,7],[0,7],[-2,4],[-8,5],[-1,1],[-2,6],[-2,3],[-2,2],[-2,0],[-3,0],[-2,-2],[-6,-6],[-1,-1],[0,-2],[0,-1],[2,-1],[2,-2],[1,-2],[0,-3],[-1,-3],[-3,-4],[-5,-1],[-14,1],[-4,-1],[-4,-2],[-1,-6],[-13,2],[-3,-1],[-6,3],[-3,-2],[-2,-4],[-2,-6],[0,-6],[0,-5],[3,-10],[-4,2],[-11,9],[-4,2],[-4,1],[-3,2],[-1,5],[0,3],[0,1],[1,3],[2,3],[1,1],[2,2],[0,2],[-1,5],[-1,4],[-3,1],[-2,-2],[-2,0],[-1,6],[-5,1],[-5,-1],[-3,-1],[-1,-2],[-4,2],[-8,6],[1,4],[-2,2],[-7,2],[-2,1],[-2,-1],[-1,1],[-1,1],[1,2],[3,3],[1,2],[-1,5],[-3,3],[-2,2],[-2,3],[0,4],[3,8],[0,5],[-5,-2],[-1,4],[1,5],[-2,2],[-3,-1],[-1,-1],[1,-2],[-1,-3],[-4,-8],[0,-2],[0,-1],[1,-1],[1,0],[1,-1],[0,-2],[-1,-2],[-1,-2],[0,-5],[0,-3],[-2,-2],[-1,-2],[1,-3],[0,-3],[1,-3],[-1,-2],[-4,-7],[3,0],[4,1],[2,0],[1,-1],[4,-6],[-6,-6],[3,-4],[7,-3],[2,-4],[2,2],[4,4],[1,1],[2,-2],[0,-4],[0,-7],[2,-6],[5,-1],[11,4],[5,1],[1,-2],[-2,-4],[-1,-5],[-1,-2],[-2,-2],[-2,-1],[-2,-1],[-2,1],[-2,2],[-2,1],[-9,-1],[-6,-7],[-5,-9],[-6,-20],[-2,-11],[-1,-11],[1,-11],[4,-17],[1,-5],[-1,-7],[-3,-4],[-3,0],[-4,6],[6,2],[-1,7],[-5,14],[-2,11],[-2,1],[-6,0],[-4,-1],[-1,-5],[0,-30],[1,-4],[3,-10],[1,-6],[0,-6],[-2,-2],[-10,1],[-5,0],[-4,-2],[-3,-3],[-2,-5],[-2,-12],[0,-11],[3,-11],[7,-7],[-29,-10],[-4,0],[-7,-4],[-5,-8],[-1,-10],[0,-8],[2,-3],[0,-2],[-3,-1],[-2,1],[-3,1],[-2,0],[-2,-1],[-4,-2],[-5,-1],[-10,1],[-4,-1],[-5,-1],[-4,-2],[-4,-8],[-5,0],[-5,1],[-5,0],[-1,-1],[-1,-2],[-2,-1],[-3,-1],[-2,-1],[0,-3],[2,-2],[2,-1],[1,-1],[-2,-2],[-8,-7],[-1,-1],[-1,-3],[-1,-5],[1,-17],[-1,-3],[-1,-5],[0,-3],[1,-3],[3,-4],[1,-2],[-4,-13],[-1,-4],[-1,-2],[-1,3],[-3,5],[-1,7],[0,2],[-2,3],[-1,1],[-1,0],[-3,2],[-2,1],[-2,-1],[-2,-3],[-1,-2],[1,-7],[3,-1],[3,1],[4,-1],[1,-4],[-2,-5],[-3,-6],[-3,-4],[-4,-2],[-24,-10],[-3,-3],[-2,-6],[1,-3],[2,-5],[1,-1],[-1,-3],[-1,-2],[-1,-2],[-1,-4],[-4,0],[-1,-5],[3,-5],[6,3],[5,-6],[1,-2],[1,0],[4,-2],[2,0],[2,-2],[1,-2],[1,-2],[-2,-2],[-1,0],[-5,1],[-3,-1],[-4,-3],[-4,-1],[-4,-3],[-2,-4],[-1,-9],[-1,-5],[-1,-4],[6,1],[4,-2],[0,-3],[-6,-3],[6,-1],[7,1],[6,4],[3,4],[1,3],[3,2],[3,1],[3,0],[3,-2],[0,-1],[-3,-3],[-11,-7],[-5,-6],[3,-6],[3,1],[8,10],[4,3],[-3,-10],[0,-4],[2,-8],[0,-3],[-8,-3],[-22,-19],[-6,-8],[-27,-55],[-15,-48],[-6,-30],[-34,-77],[-5,-9],[-22,-29],[-16,-18],[-23,-21],[-38,-32],[-22,-24],[-16,-14],[-25,-17],[-7,0],[-3,3],[-2,4],[-2,5],[-3,2],[-4,0],[-4,-1],[-5,0],[-6,11],[1,23],[5,42],[-5,39],[0,18],[3,12],[2,7],[7,8],[7,6],[27,18],[3,3],[1,5],[1,9],[1,5],[7,6],[15,11],[4,6],[5,5],[8,6],[2,4],[1,4],[-2,4],[-15,16],[-3,2],[-7,3],[-7,5],[-8,0],[-3,1],[-10,6],[-12,4],[-13,14],[-14,10],[-6,5],[-4,6],[-4,7],[-2,3],[-6,5],[-2,3],[-1,5],[-1,13],[-1,8],[-3,8],[-11,16],[-6,15],[-1,9],[-1,3],[-3,3],[-13,2],[-6,4],[-3,3],[-3,2],[-1,3],[0,3],[-1,2],[-3,3],[-6,4],[-3,2],[-4,1],[-8,1],[-2,0],[-2,2],[-2,4],[-1,2],[-4,3],[-4,1],[-4,1],[-5,-2],[-4,-3],[-2,-3],[-2,0],[-5,3],[-11,10],[-13,9],[-15,14],[-7,8],[-6,6],[-8,5],[-6,6],[0,2],[-3,5],[0,11],[-1,4],[-2,5],[-4,3],[-11,10],[-3,3],[-4,8],[-3,3],[-3,1],[-8,0],[-36,5],[-7,3],[-3,2],[-3,3],[-2,3],[-3,3],[-9,4],[-7,7],[-5,7],[-4,6],[-4,5],[-3,-1],[-4,-8],[-3,-4],[-3,-2],[-3,1],[-4,3],[-11,9],[-4,3],[-9,3],[-3,2],[-4,4],[-2,5],[-3,11],[-2,4],[-8,4],[-2,3],[-2,4],[-1,9],[-1,4],[-3,5],[-16,19],[-11,9],[-5,6],[-3,3],[-8,5],[-6,7],[-5,1],[-5,-1],[-3,-3],[-1,-5],[0,-11],[0,-4],[-3,-3],[-5,0],[-5,1],[-4,0],[-3,-3],[-3,-9],[-1,-4],[-4,-3],[-12,-8],[-1,-2],[-1,-1],[-1,-2],[-2,-1],[-2,-1],[-5,0],[-7,-1],[-15,1],[-5,-1],[-2,2],[-1,2],[0,5],[2,12],[0,17],[1,5],[4,7],[1,8],[-2,8],[-3,7],[-15,11],[-3,5],[-8,14],[-1,2],[-2,2],[-4,3],[-3,2],[-1,2],[0,3],[-1,3],[-7,8],[-5,4],[-7,4],[-13,11],[-10,6],[-3,2],[-4,5],[-5,9],[-4,3],[-11,8],[-4,3],[-3,3],[-8,9],[-2,3],[-1,2],[-3,1],[-2,1],[-2,-1],[-2,1],[-4,2],[0,2],[1,3],[-1,5],[-2,3],[-3,4],[-4,2],[-7,3],[-14,10],[-2,3],[-4,6],[-8,6],[-8,0],[-9,-2],[-10,3],[-5,0],[-8,-1],[-1,-1],[-5,-2],[-2,0],[-4,2],[-2,0],[-6,-4],[-6,-7],[-5,-9],[-1,-6],[-2,-8],[-4,-7],[-6,-5],[-8,-2],[-1,1],[-2,3],[-2,1],[-2,-1],[-2,-3],[-2,-1],[-3,1],[-3,3],[-2,1],[-5,1],[-3,-2],[-5,-4],[-2,-1],[-3,0],[-4,6],[-2,1],[-6,0],[-10,-2],[-5,1],[-7,5],[-4,13],[-6,5],[10,2],[4,2],[10,6],[21,27],[19,15],[1,4],[2,30],[4,9],[7,5],[9,4],[9,1],[10,1],[5,1],[4,4],[16,17],[2,3],[1,3],[6,7],[3,9],[3,3],[9,7],[2,3],[1,3],[18,16],[1,2],[0,2],[1,4],[2,2],[4,2],[0,3],[0,3],[0,2],[1,3],[2,1],[1,2],[2,1],[8,4],[3,2],[4,4],[2,4],[4,11],[2,5],[-1,4],[0,3],[1,4],[2,3],[5,9],[8,8],[8,5],[7,5],[16,4],[3,2],[3,4],[1,5],[0,11],[4,10],[16,9],[4,9],[2,22],[2,4],[4,2],[11,2],[7,5],[18,25],[14,10],[4,6],[1,10],[-1,4],[0,5],[3,4],[7,1],[6,4],[7,1],[2,0],[2,2],[1,1],[0,2],[0,12],[-1,2],[-1,5],[4,4],[10,4],[7,-2],[9,-1],[8,-2],[3,-5],[1,-5],[2,-1],[3,2],[2,3],[2,4],[3,12],[-3,7],[-3,3],[-3,1],[-3,1],[-8,4],[-3,2],[-1,6],[5,5],[14,5],[9,9],[3,1],[1,2],[1,1],[1,4],[3,3],[5,-1],[1,-2],[-1,-2],[1,-2],[3,-1],[2,1],[1,1],[0,2],[1,2],[2,1],[2,3],[1,1],[3,5],[1,2],[2,1],[2,-1],[1,-1],[1,-1],[3,0],[5,2],[1,2],[10,12],[2,2],[0,2],[0,5],[0,2],[1,2],[2,0],[2,0],[5,2],[1,5],[1,4],[3,4],[3,0],[4,-2],[3,0],[2,1],[8,6],[3,4],[3,5],[4,1],[4,-1],[5,-5],[4,-1],[2,8],[1,1],[2,1],[4,0],[3,1],[5,-3],[3,0],[1,3],[-3,5],[-7,7],[-2,4],[3,2],[5,-1],[4,-3],[4,-1],[5,1],[12,11],[4,1],[1,3],[1,6],[2,11],[-1,9],[2,1],[5,0],[5,2],[2,6],[1,6],[1,5],[2,3],[3,2],[3,1],[1,-3],[0,-1],[-1,-1],[-1,-2],[1,0],[1,-1],[1,-1],[0,-1],[2,0],[9,3],[2,0],[5,-1],[2,1],[2,1],[1,1],[0,2],[0,4],[1,3],[2,1],[1,0],[1,-1],[1,-5],[3,0],[3,3],[2,5],[1,5],[1,2],[2,3],[2,1],[1,0],[1,0],[2,-1],[1,-1],[2,-4],[1,-2],[2,-1],[2,0],[14,5],[5,3],[0,3],[-4,6],[1,2],[4,1],[9,1],[3,-1],[2,-3],[1,-6],[1,-2],[2,0],[2,2],[1,2],[1,3],[-1,8],[3,-3],[3,-3],[3,-3],[5,0],[1,1],[1,3],[2,2],[0,2],[1,3],[3,0],[2,1],[2,1],[0,2],[0,5],[1,2],[1,2],[1,2],[6,17],[3,5],[3,-2],[2,-2],[-1,-5],[7,-3],[8,1],[16,19],[2,4],[1,2],[2,0],[1,-1],[1,0],[1,-1],[5,1],[0,3],[-1,3],[0,4],[3,1],[3,-2],[3,-2],[3,-1],[2,3],[2,8],[2,1],[3,-1],[3,-4],[2,-4],[1,-2]],[[4469,1686],[0,-1],[3,1],[1,1],[2,1],[2,1],[5,1],[1,0],[2,-2],[1,-3],[1,-2],[1,-1],[2,0],[3,0],[2,0],[5,3],[2,3],[2,1],[2,0],[3,-3],[1,-6],[1,-7],[5,1],[5,7],[4,2],[5,0],[11,-5],[3,1],[1,5],[0,6],[0,6],[3,3],[3,-1],[1,-2],[2,-3],[1,-1],[2,1],[3,2],[3,1],[4,1],[3,4],[4,9],[9,-7],[4,-1],[6,-1],[1,-3],[-2,-8],[-6,-12],[6,0],[10,7],[6,2],[3,-1],[4,-4],[2,0],[2,1],[2,4],[2,7],[5,-6],[3,-2],[5,1],[4,3],[2,3],[0,5],[2,5],[3,3],[5,1],[3,-1],[0,-2],[-3,-5],[-2,-3],[0,-2],[1,-3],[2,0],[2,1],[1,0],[3,-3],[0,-4],[-1,-4],[-3,-4],[0,-2],[0,-2],[2,-2],[2,0],[2,1],[1,3],[1,2],[1,3],[4,6],[1,-2],[0,-5],[3,-3],[4,2],[3,3],[3,4],[3,2],[5,-1],[2,-4],[2,-5],[4,-2],[5,-1],[4,-3],[7,-7],[2,3],[2,0],[2,-1],[1,-5],[1,-3],[3,1],[2,3],[1,2],[3,0],[5,-2],[4,0],[2,1],[6,2],[4,1],[3,1],[2,1],[1,-1],[1,-2],[1,-1],[6,-2],[4,0],[1,3],[1,2],[1,3],[1,2],[2,1],[2,0],[0,-1],[0,-1],[1,-2],[2,-2],[2,-6],[2,-2],[1,2],[0,2],[-1,1],[0,1],[1,2],[1,0],[2,-1],[1,-1],[0,-3],[2,-5],[0,-3],[2,2],[3,1],[4,0],[2,0],[2,-2],[1,-2],[1,-1],[4,1],[-2,6],[0,4],[2,2],[6,1],[5,-2],[2,-2],[-1,-2],[-5,-1],[0,-2],[1,-5],[3,-4],[4,-2],[7,9],[5,4],[2,-1],[2,-6],[5,0],[4,1],[2,-2],[-1,-5],[1,-2],[3,-1],[16,0],[1,1],[0,-4],[2,-4],[10,-2],[3,-5],[-7,0],[-3,0],[-3,-2],[13,-8],[4,-5],[-5,-4],[2,-1],[3,0],[2,2],[2,2],[2,-4],[1,-8],[2,-5],[3,-1],[2,3],[2,8],[2,-1],[1,-1],[0,-2],[-2,-4],[1,-1],[5,-2],[4,-1],[7,0],[-2,6],[2,3],[4,0],[4,0],[2,-2],[2,-2],[2,-2],[2,1],[3,5],[2,2],[2,1],[3,-1],[0,-2],[0,-2],[1,-2],[3,-2],[1,0],[1,2],[2,3],[3,1],[2,-3],[0,-5],[1,-4],[1,-1],[7,4],[1,-1],[-2,-6],[0,-2],[4,-3],[4,0],[4,2],[4,1],[6,-1],[3,-2],[0,-4],[3,-5],[2,-2],[2,-1],[2,0],[2,-2],[1,-2],[0,-2],[1,-2],[2,-2],[6,6],[3,1],[1,-4],[2,-6],[3,-2],[4,1],[3,-2],[1,-3],[-1,-3],[-1,-2],[0,-1],[1,-1],[4,-2],[2,-2],[7,-9],[3,-1],[2,1],[2,1],[2,0],[3,-2],[6,-5],[6,-2],[4,-4],[5,-1],[0,-1],[1,-2],[0,-2],[6,-8],[8,-16],[6,-6],[5,2],[4,-3],[6,-9],[7,-8],[1,-3],[0,-5],[-2,-4],[0,-2],[3,-1],[1,-2],[1,-3],[0,-3],[0,-3],[3,-1],[2,0],[2,2],[1,1],[3,-1],[1,-2],[2,-2],[3,2],[4,-6],[4,-15],[2,-6],[3,-2],[6,-3],[2,-2],[1,-2],[4,-7],[7,-10],[4,-7],[1,-2],[2,-1],[7,-3],[9,-7],[2,2],[3,2],[4,0],[3,0],[3,-1],[4,-4],[1,0],[14,-1],[6,-2],[2,-4],[4,2],[3,0],[22,-2],[4,-2],[5,-5],[3,-2],[4,0],[0,3],[0,4],[3,3],[2,0],[1,-2],[1,-3],[1,-2],[2,0],[4,-1],[6,-1],[2,0],[2,0],[3,1],[5,4],[6,2],[2,0],[3,-2],[2,-3],[1,0],[1,1],[3,1],[8,3],[2,1],[2,-2],[1,-2],[2,-3],[1,-2],[3,-2],[4,-1],[8,-1],[1,2],[1,2],[1,3],[2,0],[1,-1],[2,-7],[2,-2],[6,-5],[-1,-1],[-1,-2],[-1,-1],[0,-2],[0,-2],[5,-9],[-1,-3],[-3,-2],[-1,0],[-2,0],[-1,0],[-2,1],[-2,1],[-1,0],[-1,1],[-2,-1],[-1,0],[-1,0],[-1,-1],[-2,-2],[-1,-1],[-7,-14],[-2,-3],[-2,-2],[-2,0],[-2,-1],[-2,-1],[-1,-1],[-3,-5],[-2,-1],[-1,0],[0,1],[0,2],[0,1],[0,1],[-1,0],[-1,0],[-1,-1],[-1,-1],[0,-2],[0,-3],[1,-2],[0,-1],[0,-2],[-2,-2],[-1,-1],[-2,-2],[-1,0],[-1,-1],[0,-1],[-1,-2],[-1,-10],[-1,-6],[4,-24],[0,-2],[-1,-3],[-4,-9],[-1,-7],[-1,-2],[-5,-5],[0,-1],[-1,-1],[0,-3],[1,-3],[0,-2],[-1,-1],[-2,0],[-1,0],[-1,0],[-1,0],[-1,-1],[-1,-1],[-1,-1],[-1,0],[-1,0],[0,2],[-1,2],[-1,1],[-1,1],[-1,0],[-1,-1],[-1,-2],[-2,-4],[-1,-4],[-3,-4],[-8,-7],[-4,-2],[-1,-1],[0,-2],[-1,-2],[1,-5],[1,-5],[-2,-7],[0,-2],[0,-1],[0,-2],[1,-1],[3,-2],[2,-1],[11,-4],[2,-1],[2,-2],[3,-4],[0,-1],[2,-1],[1,1],[1,1],[2,3],[0,3],[0,1],[0,2],[-1,2],[-1,2],[-1,1],[-1,1],[-8,6],[-1,1],[-1,1],[0,2],[2,1],[2,1],[10,2],[2,1],[5,3],[1,1],[1,0],[4,0],[1,1],[1,3],[1,1],[1,1],[6,-1],[13,-5],[1,-1],[2,-2],[9,-11],[4,-2],[7,-2],[2,-1],[2,0],[1,-1],[1,-2],[1,-4],[1,-1],[1,-1],[3,0]],[[5695,2106],[2,-4],[3,1],[-2,-3],[-3,-5],[-2,2],[1,3],[0,2],[-3,3],[-5,0],[-4,1],[-4,4],[1,3],[4,1],[6,-1],[5,-2],[1,-5]],[[5703,2119],[-4,-4],[-4,1],[-4,5],[1,3],[0,4],[-4,4],[0,4],[4,6],[5,5],[7,5],[3,0],[1,-5],[-2,-6],[-2,-10],[0,-5],[3,-5],[-4,-2]],[[5745,2162],[0,-1],[-2,-4],[-17,-11],[-1,-3],[-5,-9],[-3,-10],[-4,-1],[-3,3],[-2,5],[0,5],[6,15],[0,2],[0,1],[1,1],[2,3],[2,1],[4,3],[10,5],[2,2],[-3,3],[-3,-3],[-4,-3],[-6,-1],[-4,0],[-3,-1],[-3,-4],[-1,-1],[-2,1],[-4,5],[-2,2],[0,-5],[0,-2],[0,-2],[-3,-5],[-2,-2],[-2,-2],[-4,0],[4,9],[-2,0],[-2,-2],[0,3],[1,13],[1,6],[0,4],[-3,-2],[-3,-3],[-2,-4],[0,-1],[-2,-1],[0,-1],[1,-2],[1,0],[1,0],[1,-1],[0,-1],[0,-1],[-1,0],[-1,-1],[-1,-1],[-4,1],[-5,4],[-2,3],[-2,5],[-2,3],[0,-6],[-2,0],[0,2],[-1,1],[-1,0],[-1,1],[1,-4],[5,-15],[-4,0],[-7,-2],[-4,0],[0,-2],[8,-1],[3,-1],[3,-3],[-4,-3],[-1,-2],[1,-2],[4,2],[1,-3],[3,-4],[0,-1],[0,-5],[-2,-1],[-3,0],[-2,0],[-1,-3],[-1,-4],[-1,-3],[-3,-1],[-3,0],[-2,2],[-4,5],[-2,-1],[-3,-1],[-2,1],[-2,1],[-1,-3],[-3,-1],[-11,4],[-3,1],[-10,8],[-2,2],[-9,12],[-2,2],[0,-4],[4,-10],[1,-4],[1,-2],[1,-1],[2,-1],[1,-1],[3,-6],[-1,-2],[-4,-1],[-5,2],[4,-7],[6,-1],[7,2],[7,-1],[-1,-2],[0,-1],[-1,-1],[-2,2],[-1,0],[-2,-1],[-1,-3],[3,-1],[3,-1],[3,-1],[2,-4],[2,5],[4,0],[4,0],[8,3],[4,-2],[5,-4],[3,-2],[-2,-2],[-1,-1],[2,2],[-3,-4],[-2,-1],[-1,-1],[4,-2],[3,2],[1,3],[2,3],[4,0],[3,-1],[4,0],[5,2],[5,-7],[-6,-6],[-10,-7],[-18,-38],[0,-6],[-4,-11],[-2,-2],[-4,1],[-3,5],[-3,1],[2,4],[0,2],[-3,-1],[-2,-1],[-3,-1],[-1,-3],[2,0],[2,-1],[2,-2],[1,-2],[2,-3],[-1,-1],[-15,2],[-20,-1],[-3,-1],[-2,-2],[-1,-1],[0,-4],[1,-1],[1,0],[2,2],[2,1],[36,0],[2,1],[1,1],[2,-4],[0,-3],[-1,-2],[-4,-16],[-1,-5]],[[5634,1989],[-6,0],[-3,0],[-6,3],[-59,-2],[-1,-1],[-1,-1],[-1,-1],[0,-2],[-3,-2],[-5,0],[-3,0],[-5,-2],[-5,3],[-2,0],[0,-1],[-1,-1],[0,-1],[-2,-1],[-1,0],[-3,2],[-2,0],[-4,-2],[-1,0],[-1,1],[0,1],[0,1],[0,1],[0,1],[-1,1],[-1,0],[-1,0],[-1,0],[-1,-1],[-1,0],[0,-1],[-1,0],[-2,-1],[-7,-2],[-5,-2],[-4,-2],[-5,-4],[-3,-3],[-6,-10],[-2,-1],[-2,-2],[-17,-10],[-11,-4],[-4,-1],[-2,0],[-1,-1],[-2,-2],[-2,-2],[-1,-2],[-1,-5],[-2,-2],[-5,-2],[-8,0],[-7,0],[-3,1],[-16,8],[-13,8],[-1,2],[0,3],[-2,2],[-3,3],[-14,8],[-4,4],[-3,3],[-1,1],[-3,3],[-4,3],[-2,1],[-2,1],[-4,0],[-2,1],[-1,1],[-1,1],[-2,1],[-1,0],[-3,0],[-6,0],[-4,-2],[-1,-1],[-3,-1],[-19,-4],[-8,0],[-3,0],[-3,-2],[-2,0],[-1,0],[-4,0],[-1,1],[-1,1],[-1,0],[-2,1],[-3,1],[-6,0],[-3,0],[-2,-1],[-1,0],[-4,-3],[-1,-1],[-1,-2],[-1,-2],[0,-1],[0,-2],[1,-1],[0,-1],[0,-2],[0,-1],[-1,-2],[-1,0],[-2,0],[-2,1],[-1,1],[-1,0],[-1,2],[-1,5],[-1,1],[0,1],[-1,1],[-1,1],[-1,1],[-2,0],[-7,1],[-2,0],[-1,1],[-1,1],[0,1],[0,1],[-1,2],[-2,1],[-3,1],[-15,-1],[-2,1],[-2,2],[-2,1],[-2,1],[-2,0],[-1,-1],[-1,-1],[1,-1],[0,-1],[1,-1],[5,-2],[1,-1],[1,-1],[0,-1],[-2,-1],[-3,-1],[-10,-1],[-3,-1],[0,-1],[-2,-1],[-4,-14],[-2,-6],[-2,-2],[-4,-5],[-4,-6],[-2,-3],[0,-3],[-1,-3],[-1,-1],[-1,0],[-2,2],[-2,1],[-1,1],[-1,0],[-2,0],[-3,-1],[-2,-1],[-7,-6],[-1,-1],[-2,0],[-1,0],[-1,0],[-2,0],[-3,1],[-2,-1],[-1,0],[-1,-2],[0,-2],[-1,-2],[-2,0],[-1,0],[0,1],[0,3],[-1,1],[0,2],[-1,1],[-1,0],[-1,1],[-3,-1],[-1,-1],[-1,-1],[-1,-2],[-1,-1],[-1,1],[-1,0],[-2,4],[-2,1],[-1,1],[-1,0],[0,1],[-1,0],[-3,-1],[-4,-1],[-2,-1],[-2,0],[-1,1],[-1,1],[-1,1],[-1,0],[-1,0],[-1,-1],[-3,-2],[-2,-4],[-2,-2],[-2,-2],[-2,-1],[-2,-1],[-13,-4],[-2,-1],[-2,-2],[-2,-3],[-3,-3],[-2,-1],[-1,-2],[0,-1],[0,-1],[-1,-7],[-1,-2],[-1,-2],[-4,-5],[-1,-1],[-1,-2],[0,-1],[0,-1],[1,-2],[1,-2],[3,-2],[0,-1],[1,-2],[-1,-1],[-2,-4],[0,-1],[0,-1],[7,-13],[1,-5],[1,-2],[0,-3],[0,-4],[-3,-6],[-8,-6],[-1,-1],[-2,0],[-7,-1],[-12,-4],[-3,-1],[0,-1],[-1,-3],[-1,-2],[-1,0],[-1,0],[-1,1],[-2,5],[-2,3],[-1,3],[-1,1],[-2,1],[-3,2],[-1,1],[-1,1],[0,1],[-1,1],[0,3],[0,1],[0,1],[-1,1],[-2,1],[-1,0],[-24,-1],[-2,0],[-2,1],[0,1],[-1,2],[-2,1],[-2,0],[-1,0],[-1,-1],[-4,-3],[-3,0],[-3,-1],[-37,1],[-15,4],[-4,1],[-8,-1],[-2,0],[-2,1],[-1,1],[-4,4],[-13,8],[-3,4],[-1,1],[-1,3],[-1,2],[-1,1],[-11,7],[-3,1],[-2,1],[-1,0],[-5,-1],[-5,1],[-6,2],[-6,1],[-7,-1],[-2,0],[-3,0],[-10,3],[-12,0],[-2,0],[-1,1],[-8,4],[-8,2],[-17,0],[-5,0],[-1,1],[-1,1],[-1,3],[-3,2],[-33,10],[-3,0],[-4,-1],[-2,-1],[-5,-2],[-7,-3],[-6,-1],[-3,0],[-1,1],[-3,2],[-2,1],[-1,0],[-2,0],[-1,0],[-10,-3],[-12,-1],[-3,0],[-2,0],[-1,1],[-2,2],[0,1],[-2,1],[-1,2],[-8,3],[-3,3],[-11,7],[-1,1],[0,1],[-1,1],[-2,2],[-4,2],[-13,5],[-3,1],[-3,-1],[-1,0],[-2,0],[-17,-11],[-2,-1],[-2,0],[-4,-1],[-3,1],[-2,0],[-7,4],[-14,4],[-2,1],[-2,-1],[-4,-1],[-3,1]],[[4509,1918],[-1,10],[-4,8],[-11,16],[-3,9],[-1,8],[-3,8],[-6,7],[-7,8],[-2,2],[-1,3],[1,3],[1,2],[0,3],[-3,13],[1,15],[0,5],[-2,5],[-2,2],[-5,5],[-1,2],[0,4],[0,2],[1,2],[1,2],[-3,9],[-2,6],[-3,3],[-8,-6],[-5,-1],[-2,7],[0,5],[-2,5],[-2,3],[-4,3],[-4,1],[-1,-1],[-1,-1],[-3,0],[-4,3],[-2,2],[-2,-2],[1,-3],[0,-3],[0,-3],[-1,-1],[-2,0],[-2,2],[-2,2],[-1,2],[-1,5],[2,5],[1,4],[1,5],[-1,1],[-1,0],[-1,0],[-1,-1],[-6,-8],[-2,-1],[-3,0],[-4,1],[-3,1],[-1,-1],[4,-9],[1,-4],[-4,0],[-5,1],[-1,0],[-2,0],[-1,-4],[-1,-2],[-2,3],[-2,5],[-3,3],[-3,1],[-5,0],[-3,-2],[-3,-5],[-3,-1],[-4,2],[-1,0],[-2,-1],[-2,-2],[0,-3],[0,-3],[-1,-2],[-1,-2],[-4,-2],[-2,-2],[0,-3],[1,-6],[-1,-2],[-2,-1],[-1,2],[-1,2],[0,3],[-1,5],[-3,4],[-4,3],[-4,2],[-5,-1],[-1,3],[0,3],[-2,4],[-3,1],[-9,-2],[0,1],[2,6],[0,6],[-1,5],[-3,5],[0,6],[0,5],[0,3],[3,9],[5,9],[6,7],[4,5],[6,9],[5,17],[2,5],[8,7],[2,5],[-1,4],[-6,10],[-1,5],[-1,5],[1,4],[2,9],[10,47],[2,4],[6,10],[3,9],[8,26],[0,8],[-3,18],[0,8],[3,8],[8,14],[3,5],[2,8],[0,8],[-3,8],[-1,6],[-6,7],[-1,3],[-1,10],[-3,8],[-1,4],[2,8],[5,7],[8,6],[5,4]],[[5643,1519],[-2,-1],[-2,0],[-1,1],[0,1],[0,19],[2,8],[3,6],[-4,2],[2,4],[6,7],[0,5],[-3,6],[-2,3],[4,2],[3,0],[2,1],[1,3],[0,3],[-1,1],[-2,1],[-2,1],[0,2],[1,1],[0,2],[1,1],[-1,3],[-3,3],[-1,2],[2,4],[2,2],[2,2],[-1,4],[4,1],[11,4],[3,1],[2,5],[4,-3],[4,-6],[2,-3],[1,-6],[-2,-5],[-2,-4],[-2,-5],[-1,-1],[-1,-2],[-1,-3],[1,-3],[1,-6],[0,-2],[-2,-4],[-3,-5],[-3,-4],[-2,-1],[-10,-18],[0,-5],[3,-9],[0,-4],[-2,-1],[-4,-2],[-2,-1],[-3,-5],[-2,-2]],[[5635,1877],[-1,0],[-1,0],[-1,1],[-4,1],[-4,6],[-3,7],[-3,4],[-10,7],[-1,2],[1,1],[4,6],[2,2],[2,1],[4,1],[1,1],[1,3],[2,3],[5,3],[6,3],[5,3],[-2,6],[4,4],[4,-1],[3,-4],[5,-9],[1,-2],[0,-2],[-1,-2],[-3,-3],[-2,-7],[-5,-9],[-1,-6],[-1,-3],[-6,-6],[-1,-2],[0,-3],[0,-6]],[[5634,1989],[-1,-3],[-4,-7],[-2,-5],[1,-3],[2,-5],[4,-22],[0,-4],[-2,-3],[-5,-1],[-4,-1],[-3,-4],[-2,-4],[-3,-3],[-4,0],[-6,1],[-4,2],[-2,3],[-1,6],[-1,4],[-3,7],[-1,4],[0,6],[-1,2],[-2,2],[-1,7],[-2,-1],[-1,-5],[4,-6],[-2,-3],[0,-3],[1,-3],[1,-2],[0,-1],[2,0],[1,-2],[1,-1],[0,-3],[0,-1],[1,-2],[1,-3],[-2,-6],[1,-3],[1,-2],[-1,-2],[-2,-2],[-2,0],[4,-7],[-2,0],[-3,0],[-2,-1],[-2,-3],[9,-1],[5,-2],[2,-4],[1,-3],[14,-6],[2,-2],[2,-2],[0,-3],[1,-3],[0,-3],[2,-1],[3,-1],[2,-2],[-2,-6],[-11,-25],[-2,-10],[-2,-17],[0,-15],[1,-3],[2,-2],[9,-8],[3,0],[5,2],[2,-1],[1,-3],[0,-2],[-1,-2],[-3,-3],[-3,-4],[-2,-4],[-2,-4],[0,-3],[0,-8],[1,-2],[2,-2],[0,-2],[0,-1],[-1,-3],[0,-1],[0,-9],[0,-2],[2,-3],[2,-1],[1,0],[1,0],[4,-5],[-1,-4],[-2,-5],[-2,-9],[-2,-2],[0,-3],[4,-11],[2,-2],[3,-1],[3,1],[2,2],[0,2],[2,3],[4,2],[2,-3],[2,-4],[5,-1],[-2,-3],[-1,-2],[-2,-1],[2,-6],[1,-3],[-2,-1],[-3,-1],[-2,-1],[-2,0],[-1,4],[3,0],[1,2],[-2,3],[-2,2],[-3,-1],[-4,-2],[-2,-1],[-1,-1],[-7,-6],[-2,-2],[-1,-2],[0,-2],[0,-4],[1,-10],[1,-1],[1,0],[7,-2],[3,-3],[1,-5],[1,-11],[-2,4],[-1,1],[-1,-2],[-1,-2],[-1,-3],[0,-3],[-1,-3],[-2,-1],[-2,0],[-3,-2],[-2,-2],[-3,-2],[-2,-4],[0,-5],[8,-20],[4,-1],[3,-4],[0,-4],[-2,-5],[-1,3],[-5,-3],[-4,-5],[-3,-4],[2,-3],[1,-5],[1,-5],[0,-5],[1,-2],[3,-4],[1,-2],[-1,-1],[-3,-2],[-1,-2],[1,0],[1,-2],[8,-9],[2,-3],[0,-2],[-2,-1],[-1,-1],[-1,-1],[1,-3],[2,0],[2,-1],[1,0],[-1,-5],[-7,-10],[-1,-4],[-2,-15],[0,-5],[1,-1],[1,-2],[1,-1],[1,-4],[-1,-2],[-2,-2],[-1,-1],[-1,-2],[-1,-2],[-2,-7],[-2,-11],[-3,-11],[0,-6],[4,-4],[-3,-4],[-8,-8],[-1,-3],[-1,-6],[0,-6],[0,-2],[-6,-7],[-2,-4],[-2,-9],[-4,-6],[-1,-3],[1,-3],[1,-3],[-1,-2],[-2,-1],[-3,1],[-3,4],[-2,5],[-1,5],[1,6],[2,4],[1,3],[-1,3],[-6,6],[-3,2],[-3,4],[-3,1],[-2,-7],[0,-3],[2,-6],[1,-2],[-1,-3],[-2,-2],[0,-2],[1,-2],[2,-1],[3,1],[1,-1],[0,-2],[-1,-2],[-1,-3],[-1,-2],[0,-2],[0,-1],[1,-1],[1,-2],[8,-4],[2,-3],[2,-2],[3,-1],[2,2],[2,1],[2,1],[-1,-5],[-2,-3],[-7,-10],[-3,-5],[-1,-3],[-3,-1],[-10,-1],[-3,-1],[-6,-4],[-6,-2],[-3,-2],[-5,-5],[-18,-11],[-63,-53],[-47,-52],[-35,-51]],[[4469,1686],[3,2],[2,4],[0,3],[-2,2],[0,2],[1,1],[3,2],[1,2],[1,4],[-1,7],[1,3],[1,1],[4,1],[1,0],[1,2],[10,21],[3,10],[0,8],[-2,15],[-3,9],[-1,1],[-2,0],[-1,0],[0,3],[1,4],[0,2],[-1,1],[-2,1],[-2,1],[-1,3],[1,3],[2,1],[2,0],[1,2],[2,4],[0,5],[-1,10],[0,5],[3,8],[1,5],[-1,-1],[0,2],[-1,2],[-1,3],[1,2],[2,1],[3,3],[0,8],[-3,24],[2,8],[10,14],[2,8]],[[8147,7411],[-67,-26],[-9,-5],[-3,-2],[-28,-27],[-2,-3],[-16,-40],[-25,-60],[-2,-3],[-16,-22],[-4,-5],[-3,-2],[-4,-6],[-7,-19],[-1,-4],[0,-2],[2,-8],[-1,-5],[-5,-7],[-5,-9],[-1,-3],[0,-2],[0,-6],[0,-3],[-3,-4],[-25,-30],[-2,-4],[-1,-4],[-1,-2],[-3,-3],[-3,-3],[-8,-4],[-4,-1],[-3,0],[-2,1],[-5,5],[-2,1],[-2,1],[-2,0],[-3,-2],[-4,-3],[-5,-7],[-3,-4],[-2,-6],[0,-3],[-1,-4],[-1,-2],[-6,-3],[-1,-3],[-1,-5],[-1,-3],[-1,-2],[-4,-2],[-1,-2],[-1,-3],[-1,-3],[1,-5],[-1,-7],[0,-4],[0,-3],[-1,-2],[-1,-2],[-2,-2],[-1,-2],[1,-2],[1,-1],[2,-1],[3,0],[3,1],[4,1],[5,4]],[[7862,7013],[-1,-7],[-1,-3],[-3,-4],[-3,-5],[-4,-6],[-13,-46],[-2,-4],[0,-5],[0,-3],[0,-2],[1,-2],[1,-1],[2,-4],[1,-2],[1,-2],[0,-3],[-1,-3],[-2,-2],[-4,-12],[-2,-3],[-3,-3],[-5,-4],[-3,-2],[-4,-2],[-3,-6],[-1,-11],[0,-3],[1,-6],[1,-2],[1,-1],[1,0],[4,-2],[2,-1],[2,-2],[1,-2],[1,-2],[2,-6],[1,-5],[0,-4],[0,-3],[-2,-9],[0,-4],[2,-3],[2,-1],[3,-1],[2,0],[2,-1],[2,-2],[1,-5],[2,-2],[1,-2],[2,-1],[2,-1],[6,0],[2,-1],[1,-2],[0,-4],[2,-9],[1,-3],[-1,-4],[-1,-3],[-1,-3],[-1,-3],[-4,-6],[-2,-8],[-2,-4],[-4,-4],[-5,-2],[-2,-2],[1,-3],[1,-5],[0,-4],[-1,-3],[-2,-4],[-4,-5],[-3,-3],[-6,-5],[-1,-2],[-1,-2],[0,-2],[2,-3]],[[7416,6755],[1,16],[0,3],[-1,4],[-2,2],[-2,3],[-2,4],[-3,9],[-1,5],[1,4],[15,48],[1,2],[15,24],[1,3],[4,10],[0,4],[1,3],[0,2],[-1,2],[-1,1],[-2,2],[-2,2],[-1,1],[-1,5],[-3,6],[-1,1],[-3,1],[-30,7],[-4,2],[-5,4],[-9,4],[-3,2],[-2,3],[0,3],[1,11],[-1,6],[-5,9],[-7,11],[-2,7],[-3,19],[-1,4],[2,9],[0,4],[0,8],[-1,4],[-1,4],[-1,2],[-13,46],[-2,5],[-4,12],[0,1],[0,2],[2,6],[1,3],[-1,4],[-3,12],[-3,35],[-3,14],[0,8],[2,16],[-1,4],[-5,26],[0,13],[0,5],[-2,3],[-2,3],[-6,4],[-4,4],[-5,3],[-3,5],[-5,5],[-2,5],[0,8],[2,9],[1,8],[-1,10],[-4,7],[-2,8],[-3,6],[-3,6],[0,6],[-1,8],[-4,6],[-7,7],[-2,5],[-1,6],[0,10],[1,16],[-2,6],[-2,4],[-4,7],[-3,6],[0,9],[0,9],[-1,6],[-2,4],[0,8],[1,7],[1,5],[2,5],[6,12],[7,5],[6,6],[4,6],[6,11],[4,9],[-3,18],[-1,5],[-6,15],[-3,4],[-4,5],[-6,4],[-4,8],[-7,13],[-3,19],[-1,9],[-4,15],[-3,8],[-1,9],[-3,6],[-6,7],[-7,13],[-4,11],[0,1],[-1,8],[-1,10],[-1,4],[-5,14],[-4,8],[-2,6],[-3,8],[0,7],[2,9],[1,7],[2,7],[5,6],[6,7],[27,49],[1,3],[1,11],[0,3]],[[7259,7877],[1,-1],[1,7],[-1,4],[-3,6],[-2,5],[-4,4],[-1,3],[-2,-1],[-1,0],[-2,0],[-1,1],[3,1],[6,5],[4,1],[13,0],[7,-1],[6,-2],[6,-3],[5,-5],[1,0],[0,3],[-1,3],[-3,5],[3,-2],[1,0],[32,4],[3,-1],[4,-1],[2,0],[2,0],[1,3],[1,0],[7,1],[2,-1],[1,-5],[2,0],[2,3],[11,6],[3,2],[38,3],[12,6],[4,1],[1,1],[2,3],[1,0],[1,-1],[1,-1],[1,0],[17,-3],[29,-1],[19,-3],[2,-1],[5,-5],[2,-1],[3,1],[1,2],[1,2],[3,-2],[3,1],[3,-1],[3,-2],[4,-1],[11,0],[3,0],[19,-14],[6,-2],[3,-1],[12,-14],[2,-2],[3,0],[4,-2],[5,-5],[4,-5],[-1,-2],[1,-1],[1,-1],[2,0],[2,0],[-2,3],[3,3],[4,-1],[8,-5],[1,0],[5,0],[1,-1],[0,-3],[1,-1],[8,-8],[17,-11],[2,-3],[20,-10],[3,-1],[2,0],[1,1],[2,0],[2,-1],[1,-2],[1,-2],[5,-1],[7,-7],[2,1],[1,-1],[2,-1],[0,-1],[1,-2],[0,-1],[15,-11],[6,-7],[2,-1],[2,-1],[5,0],[2,-1],[3,-3],[2,-4],[3,-4],[5,-1],[9,-1],[4,-1],[3,-2],[6,-5],[3,-7],[6,-16],[5,2],[3,-2],[2,-4],[4,-3],[10,-3],[4,-7],[6,-6],[7,-6],[6,-2],[2,-2],[6,-9],[2,-1],[15,-4],[15,-7],[7,-1],[3,6],[3,-2],[2,-3],[5,-10],[5,-9],[2,-5],[2,-8],[1,-3],[3,-4],[12,-14],[3,-1],[10,-6],[3,-3],[13,-23],[19,-27],[17,-20],[21,-18],[3,-2],[15,-16],[4,-2],[5,-2],[4,-1],[5,0],[13,-30],[6,-9],[8,-8],[9,-7],[10,-6],[6,-2],[2,1],[3,3],[6,-2],[13,-8],[23,-9],[7,-5],[4,-7],[8,-22]],[[7232,6416],[-4,-7],[-3,-11],[-1,-3],[0,-1],[-3,-2],[-1,-2],[-2,-4],[0,-1],[-8,-8],[-1,-3],[-4,-12],[-1,-2],[0,-1],[-1,0],[-7,-4],[-1,-2],[-3,-3],[-2,-1],[-1,0],[-3,0],[-2,1],[-1,0],[-1,1],[-2,0],[-1,0],[-1,0],[-2,0],[-8,-3],[-3,-1],[-7,1],[-2,0],[-3,-1],[-2,0],[-2,-2],[0,-1],[-1,-2],[0,-1],[2,-13],[1,-13],[0,-4],[0,-3],[0,-2],[0,-1],[-1,-1],[-1,-1],[-1,-1],[-9,-4],[-2,-1],[0,-1],[-1,-1],[-1,-1],[-4,-11],[-2,-3],[-2,-1],[-2,-2],[-1,0],[-1,0],[-2,0],[-2,1],[0,1],[-2,4],[0,1],[-1,1],[-1,1],[-1,0],[-1,1],[-2,1],[-2,0],[-1,0],[-2,-1],[-1,-1],[-1,-1],[-1,0],[-2,0],[-2,1],[-1,1],[-2,1],[-1,0],[-1,0],[-2,-1],[-2,-1],[-1,-1],[-2,1],[-2,2],[-1,1],[-1,0],[-3,-1],[-1,-2],[-1,-1],[-2,-3],[-6,-9],[-2,-2],[-1,-1],[-6,-2],[-2,-2],[-25,-5],[-2,-1],[-3,1],[-3,2],[-1,0],[-1,0],[-2,-1],[-3,-2],[-2,-1],[-2,-3],[-1,-2],[-1,-6],[-1,-1],[0,-1],[-1,0],[0,-1],[-2,-1],[-2,-1],[-7,-3],[-1,0],[-1,-1],[-1,-2],[-2,-3],[-5,-9],[-2,-2],[-1,-2],[-1,-1],[0,-3],[0,-1],[-1,-1],[0,-1],[-1,0],[-4,0],[-10,2],[-2,1],[-2,0],[-1,1],[-2,-1],[-1,-1],[-1,-1],[0,-1],[-3,-11],[-1,-2],[-1,-3],[0,-1],[-2,0],[-1,0],[-3,1],[-1,1],[-1,1],[-4,5],[-1,1],[-2,0],[-9,2],[-7,0],[-6,-1],[-4,0],[-2,-1],[-2,-1],[-2,-1],[-1,-1],[-2,-2],[-1,0],[-1,0],[-11,6],[-5,2],[-1,0],[-1,1],[-1,1],[-1,1],[0,1],[0,1],[0,1],[0,2],[2,4],[0,1],[0,1],[0,2],[0,1],[-1,1],[-1,0],[-5,1],[-4,2],[-1,1],[-2,0],[-5,-1],[-1,0],[-1,1],[-1,1],[0,1],[-1,5],[0,1],[-1,1],[-1,1],[-10,2],[-1,1],[-4,2],[-2,0],[-2,0],[-3,-1],[-5,-3],[-1,0],[-1,-2],[-1,-4],[0,-1],[-1,0],[-1,-1],[-2,1],[-1,0],[-2,2],[-1,1],[-2,0],[-2,0],[-4,-1],[-3,0],[-6,1],[-2,0],[-2,-1],[-1,-1],[-1,-1],[-2,-2],[-1,-1],[-1,0],[-1,-1],[-2,0],[-3,1],[-1,1],[-1,1],[-1,1],[0,1],[-6,17],[0,1],[-1,1],[-3,2],[-6,7],[-1,0],[-2,0],[-4,-3],[-1,-1],[-1,-2],[-2,-4],[0,-1],[-2,-2],[-1,-1],[-1,0],[-2,-1],[-2,1],[-3,0],[-1,1],[-5,2],[-7,3],[-2,-1],[-2,0],[-4,-3],[-2,-2],[-1,-2],[-2,-4],[-1,-3],[-2,-9],[0,-1],[-1,-1],[-1,-1],[0,-1],[-1,0],[-2,-1],[-2,1],[-9,3],[-5,1],[-8,0],[-2,-1],[-1,0],[-1,-4],[-1,-8],[1,-5],[1,-2],[3,-5],[1,-2],[3,-4],[0,-1],[1,-1],[2,-2],[0,-1],[0,-1],[1,-1],[6,-22],[1,-6],[0,-6],[1,-4],[1,-3],[1,-1],[1,-2],[6,-5],[1,-1],[1,-1],[0,-1],[1,-6],[1,-11],[0,-1],[0,-4],[-1,-4],[-5,-12],[-1,-4],[0,-2],[1,-5],[1,-4],[1,-5],[0,-3],[-1,-5],[-1,-3],[-2,-4],[-8,-10],[0,-2],[-1,-2],[-1,-2],[1,-9],[-1,-1],[0,-2],[-2,-1],[-2,-2],[-3,-2],[-1,-1],[-1,-2],[-1,-4],[-1,-3],[0,-2],[-8,-13],[-3,-6],[-1,-8],[-1,-2],[-1,-2],[-1,-1],[-4,-2],[-2,-2],[0,-2],[-1,-8],[-1,-3],[-1,-1],[-1,-1],[-3,-2],[-2,0],[-2,0],[-2,1],[-3,-1],[-1,0],[-2,-1],[-25,-31],[-3,-4],[-4,-3],[-2,-2],[-16,-6],[-1,0],[-2,0],[-2,1],[-16,7],[-21,3],[-3,-1],[-1,0],[-3,-2],[-6,-4],[-6,-2],[-7,-1],[-3,-1],[-1,0],[-2,-1],[-1,-1],[-4,-7],[-1,-1],[-1,-1],[-1,-1],[-4,-1],[-2,-1],[-1,0],[-1,-1],[0,-1],[-3,-7],[-1,-2],[0,-1],[-1,-1],[-1,-1],[-1,0],[-2,-1],[-6,-2],[-9,-4],[-2,-1],[-2,-2],[-1,-1],[-6,-19],[-1,-1],[-1,-1],[-1,-1],[-2,-1],[-2,-1],[-2,0],[-3,-1],[-4,1],[-18,4],[-2,-1],[-8,-1],[-2,-1],[-2,-1],[-3,-2],[-1,-1],[-1,-1],[-2,-1],[-3,0],[-1,0],[-2,0],[-2,1],[-12,6],[-4,1],[-1,1],[-9,7],[-4,2],[-10,3],[-8,6],[-2,1],[-2,1],[-3,0],[-2,1],[-1,1],[-3,5],[-8,17],[-13,18],[-1,1],[-4,10],[0,2],[-1,9],[-1,6],[-1,6],[0,1],[-2,5],[-8,12],[-14,17],[-3,3],[-2,2],[-7,0],[-27,0]],[[7127,7940],[2,1],[2,1],[4,3],[6,-9],[19,-13],[6,-6],[2,-3],[-1,0],[-4,2],[-1,1],[0,-1],[1,-2],[-2,1],[-2,0],[0,-1],[3,-2],[2,-1],[3,0],[3,3],[2,-5],[4,-2],[4,-2],[19,-1],[6,1],[6,3],[2,-2],[1,-2],[0,-3],[-2,-3],[1,0],[2,0],[0,-1],[-1,-1],[0,-2],[1,1],[1,0],[2,1],[-2,6],[4,1],[18,-3],[1,0],[2,-3],[0,-2],[-1,-2],[-2,0],[1,-1],[2,-2],[1,-1],[2,1],[1,-1],[1,-1],[1,-2],[1,0],[0,3],[5,-4],[4,-6],[2,-2]],[[8610,6364],[-9,-20],[-10,-14],[-6,-17],[-6,-10],[-4,-10],[-19,-29],[-5,-5],[0,2],[-5,-3],[-6,-5],[-4,-5],[-2,-6],[-1,-4],[-17,-30],[-2,-3],[-11,-7],[-6,-4],[-4,-8],[-4,-16],[-3,-1],[-3,-1],[-5,0],[-2,-1],[-2,-1],[-4,-3],[4,6],[3,4],[0,4],[-4,8],[-2,3],[-2,3],[-3,1],[-3,-3],[0,-2],[4,-6],[0,-4],[0,-7],[0,-2],[-2,-1],[-1,-1],[-10,-11],[-1,-1],[-3,4],[-2,5],[0,3],[-6,12],[0,4],[-3,4],[-5,2],[-5,-3],[3,-4],[6,-5],[4,-3],[1,-3],[5,-20],[1,-2],[3,-1],[1,1],[0,3],[1,1],[7,1],[3,2],[2,2],[-3,-6],[-11,-13],[-5,-15],[-4,-6],[-11,-9],[-5,-14],[-1,-2],[-3,-1],[-2,-4],[-8,-18],[-3,-3],[-9,-4],[-11,-17],[-24,-23],[-7,-8],[-2,-4],[0,-6],[0,-3],[0,-2],[0,-1],[0,-3],[-26,-37]],[[8331,5958],[-2,4],[-2,12],[-1,2],[-5,4],[-2,1],[-13,-3],[-8,0],[-2,2],[0,6],[1,9],[-1,6],[-2,5],[-2,4],[-8,11],[-3,1],[-5,-2],[-4,-4],[-1,-1],[-2,0],[-8,4],[-6,6],[-3,2],[-9,2],[-4,2],[-2,3],[-1,4],[-3,5],[-4,4],[-3,3],[-8,3],[-3,2],[-1,5],[-1,22],[-2,4],[-3,5],[-4,3],[-5,-1],[-4,-2],[-5,1],[-3,3],[-13,13],[-6,3],[-9,2],[-2,0],[-3,-1],[-2,0],[-3,2],[-1,2],[-2,5],[-1,2],[-11,13],[-5,4],[-9,4],[-17,5],[-7,5],[-5,-2],[-6,0],[-6,2],[-5,2],[-11,9],[-7,3],[-6,8],[-5,2],[-16,2],[-5,-2],[-2,7],[-7,5],[-7,3],[-3,4],[-4,2],[-19,6],[-3,2]],[[7979,6207],[-2,3],[-1,5],[-1,4],[-1,2],[-12,5],[-3,2],[-4,1],[-4,2],[-8,0],[-2,1],[-3,1],[-2,1],[-2,2],[0,1],[0,1],[-1,3],[-7,16]],[[7778,5217],[2,-17],[-1,-4],[-4,-3],[2,-3],[-1,-4],[-2,-3],[-2,-4],[-1,-5],[1,-3],[3,-3],[1,-3],[2,-2],[-1,-2],[0,-4],[3,-2],[0,-2],[-2,-8],[-2,0],[-1,1],[-1,3],[-3,0],[-3,-1],[-2,7],[-5,8],[-1,7],[0,4],[1,2],[1,8],[1,2],[1,2],[0,1],[-2,2],[-11,5],[-4,3],[2,4],[-2,5],[0,5],[3,3],[3,1],[4,0],[3,-1],[4,-1],[5,1],[6,2],[3,-1]],[[7842,5336],[5,-10],[1,-6],[-4,-2],[-4,-2],[-4,-3],[-8,-8],[-9,-7],[-4,-4],[-3,-6],[-3,-1],[-1,-1],[-2,-2],[0,-2],[-2,0],[0,4],[-1,11],[0,5],[1,2],[6,3],[6,5],[14,14],[0,2],[-2,1],[-1,1],[0,1],[1,2],[1,0],[0,-1],[1,0],[0,4],[-2,4],[-2,3],[-2,4],[3,2],[9,-5],[4,-3],[2,-5]],[[7979,6207],[-3,-3],[-1,-1],[-1,-1],[-1,-4],[0,-2],[-3,-4],[-1,-3],[-1,-2],[0,-3],[1,-3],[3,-2],[2,0],[4,-1],[1,-1],[1,-1],[0,-2],[-3,-4],[-2,-8],[-1,-2],[-1,-2],[-1,-2],[0,-3],[1,-3],[5,-10],[8,-22],[2,-3],[3,-3],[3,-1],[5,-1],[1,-2],[0,-2],[0,-2],[0,-3],[1,-3],[11,-12],[2,-3],[2,-1],[2,-2],[9,-15],[1,-5],[1,-3],[-1,-14],[0,-11],[-2,-25],[-2,-7],[-1,-4],[-2,-3],[-2,-2],[-2,-6],[-1,-2],[-1,-3],[0,-3],[4,-16],[0,-8],[-2,-8],[0,-3],[0,-2],[1,-3],[2,-2],[4,-3],[1,-2],[1,-2],[0,-3],[0,-4],[-2,-3],[-2,-3],[-3,-3],[-12,-8],[-22,-11],[-6,-2],[-1,0],[-2,1],[-10,8],[-5,3],[-2,1],[-5,1],[-10,0],[-3,-1],[-3,0],[-2,-2],[-2,-2],[-1,-2],[-1,-2],[-2,-7],[-5,-14],[-1,-3],[0,-3],[0,-7],[1,-3],[2,-3],[3,-5],[3,-2],[4,-5],[1,-7],[1,-3],[5,-4],[1,-1],[4,-4],[3,-1],[2,-2],[2,-3],[2,-9],[1,-8],[2,-4],[2,-9],[1,-3],[5,-3],[6,-3],[3,-1],[1,-1],[1,-2],[1,-3],[1,-5],[1,-3],[-1,-5],[-2,-9],[0,-5],[-2,-4],[-1,-2],[0,-2],[0,-3],[2,-2],[2,-2],[4,-4],[7,-2],[2,-1],[2,-1],[1,0],[1,1],[2,1],[2,-1],[2,-2],[3,-2],[3,-2],[2,-2],[2,-3],[1,-5],[3,-6],[5,-7],[8,-4],[5,-2],[10,-2],[3,-3],[2,0],[3,2],[2,4],[3,6],[14,-5],[6,0],[14,5]],[[8093,5696],[2,0],[4,1],[5,1],[4,2],[3,4],[2,4],[3,3],[4,2],[-2,-5],[-15,-25],[-16,-39],[-1,-10],[-2,-4],[-5,-7],[-13,-37],[-6,-12],[-5,-14],[-14,-22],[-16,-33],[-18,-30],[-14,-24],[-14,-22],[-12,-20],[-3,-2],[-2,-2],[-16,-20],[-15,-22],[-17,-19],[-7,-11],[-4,-4],[-5,-3],[-2,0],[-5,-1],[-3,0],[-2,-1],[-5,-5],[-6,-3],[-5,-3],[-5,-2],[-5,1],[-1,4],[4,9],[3,9],[2,4],[3,0],[1,-5],[0,5],[-2,5],[-1,4],[4,8],[-1,2],[-2,2],[-1,1],[0,2],[0,1],[-2,3],[0,1],[0,1],[1,1],[0,1],[-2,18],[-4,0],[-4,0],[-3,2],[-4,3],[-7,-3],[-4,3],[-3,6],[-2,10],[-2,2],[-3,0],[-3,1],[-3,4],[0,3],[1,3],[0,5],[-1,0],[-4,-9],[-2,-5],[0,-5],[0,-7],[-1,-2],[-1,-1],[-1,0],[0,-1],[-3,-7],[0,-3],[3,-3],[-9,-18],[-3,-3],[-1,-1],[-2,-3],[-2,-1],[-2,0],[-3,3],[-2,0],[-2,3],[-2,5],[-4,19],[0,4],[3,4],[4,4],[-3,5],[-1,0],[1,-4],[-1,-2],[-3,-1],[-3,-3],[-2,-4],[0,-3],[-1,-2],[-3,-2],[2,-3],[2,-6],[2,-3],[2,-2],[1,0],[1,-1],[2,-2],[0,-1],[0,-3],[0,-4],[1,-3],[2,-1],[4,-3],[2,-1],[3,3],[2,1],[2,0],[1,-2],[1,-2],[1,-2],[1,1],[3,1],[3,0],[3,0],[3,-2],[-2,-1],[-1,-1],[-1,-4],[-1,-2],[-1,-2],[0,-3],[0,-6],[0,-2],[-1,-2],[-3,-4],[-4,-7],[-3,-4],[-3,-4],[-5,-3],[-5,-3],[-4,-1],[-3,-1],[-1,-3],[0,-4],[0,-3],[0,-1],[1,-2],[1,-1],[2,-1],[15,-4],[0,-3],[-2,0],[-3,-1],[-2,-1],[-2,-2],[-6,-6],[-12,-10],[-4,-4],[-2,-4],[-1,-11],[-2,-5],[3,-8],[1,-4],[-2,-2],[-6,4],[-2,1],[-2,0],[-7,-1],[0,2],[1,2],[-1,2],[0,2],[-5,-17],[-1,-10],[1,-8],[-2,-2],[-2,-4],[-1,-5],[-1,-5],[1,-12],[-2,-3],[-5,-2],[0,-2],[7,1],[2,3],[-1,13],[1,6],[4,6],[4,3],[6,-4],[1,-2],[1,-4],[2,-3],[0,-2],[-1,-2],[-1,-1],[-1,-2],[1,-7],[2,-5],[3,-5],[2,-5],[1,-7],[-2,-5],[-2,-4],[-1,-6],[-1,-16],[1,-4],[2,-4],[0,-3],[-2,0],[-3,0],[-2,1],[-4,5],[-2,2],[0,3],[-1,3],[-1,3],[-1,3],[-2,1],[-1,1],[-2,2],[-1,1],[-1,0],[-1,0],[-1,7],[-1,1],[-3,0],[-5,0],[-2,-3],[-1,-4],[1,-2],[6,5],[1,-2],[1,-2],[-1,-2],[-1,-2],[10,-6],[2,-3],[4,-9],[3,-4],[7,-3],[1,-3],[-1,-3],[-2,-1],[-6,0],[-3,1],[-4,2],[-2,-6],[1,-3],[2,-8],[1,-1],[4,-2],[4,-2],[3,-4],[2,-4],[2,-3],[-1,-3],[0,-3],[0,-2],[3,-6],[0,-2],[0,-2],[-2,-1],[-8,-2],[-3,1],[-3,4],[-4,-4],[0,-3],[2,-3],[-1,-2],[-1,-2],[-1,-3],[0,-4],[2,-2],[2,-1],[3,-2],[1,-4],[1,0],[-5,11],[-1,6],[4,3],[4,1],[5,1],[10,6],[0,3],[0,3],[0,2],[-2,1],[-1,2],[0,3],[2,4],[-1,1],[0,1],[-1,1],[1,1],[1,1],[2,0],[1,1],[-1,3],[-1,2],[-2,1],[-2,0],[0,1],[1,3],[-4,-1],[0,2],[1,4],[2,3],[3,2],[3,2],[3,0],[1,-2],[0,-22],[2,-6],[-5,-25],[-3,-5],[-1,-3],[-1,-3],[0,-6],[-1,-3],[-4,-8],[0,-4],[0,-10],[1,-8],[0,-4],[-2,-3],[-1,-3],[-1,-3],[1,-3],[-2,-3],[0,-3],[0,-4],[0,-4],[-4,-12],[-2,-20],[-4,-13],[-1,-8],[-2,-8],[0,-6],[3,-20],[0,-3],[4,-3],[0,-4],[-2,-1],[-2,-1],[0,-3],[1,-1],[2,0],[2,1],[2,-1],[-1,-10],[1,-11],[3,-18],[1,-67],[5,-24],[2,-22],[6,-40],[5,-38],[4,-11],[3,-5],[0,-2],[2,-7],[1,-3],[3,-5],[0,-3],[-1,-4],[-5,-9],[-1,-3],[-1,-6],[-5,-17],[0,-4],[-2,-4],[-3,-7],[-1,-4],[-1,-22],[-1,-4],[-9,-18],[-1,-6],[-1,-6],[0,-7],[0,-8],[-2,-6],[-8,-14],[1,-3],[0,-2],[-3,-6],[-7,-46],[-9,-36],[0,-12],[0,-3],[3,-5],[0,-4],[-1,-1],[-5,-14],[-5,-32],[-3,-10],[-4,-8],[-1,-4],[-2,-34],[1,-23],[5,-12],[0,-5],[0,-33],[1,-6],[4,-8],[4,-6],[2,-6],[-2,-8],[-25,-28],[-2,-4],[0,-2],[-1,-4],[0,-2],[-2,-1],[-1,-1],[-6,-4],[-15,-3],[-8,-5],[-7,-7],[-11,-14],[-28,-48],[-7,-21],[-3,-13]],[[7608,3952],[-114,81],[-5,8]],[[9898,3374],[-1,-1],[-2,6],[1,2],[2,0],[4,-4],[-2,-1],[-1,-1],[-1,-1]],[[9998,3390],[0,-1],[0,1],[0,1],[0,1],[1,-1],[0,-1],[-1,0]],[[7465,3452],[1,-2],[1,0],[1,1],[2,-1],[1,-2],[0,-2],[0,-1],[-2,-1],[-2,-2],[-4,-1],[-4,0],[-3,1],[0,1],[1,2],[2,4],[2,3],[3,1],[1,-1]],[[7608,3952],[-12,-50],[-4,-42],[1,-56],[4,-48],[5,-39],[-1,-35],[-1,-10],[-17,-48],[-5,-8],[-6,-6],[-26,-12],[-13,-11],[-4,-4],[-12,-34],[-1,-5],[-2,-4],[-10,-4],[-4,-3],[5,0],[1,-3],[-3,-13],[-2,-2],[-2,0],[-1,-1],[-2,-3],[0,-4],[0,-2],[2,-5],[1,-2],[-1,-3],[-2,-5],[-3,-16],[-1,-2],[-2,-3],[-4,-11],[-2,-4],[-2,-2],[-1,-1],[-1,1],[-1,3],[-3,1],[-1,-2],[-2,-3],[-1,-1],[-3,2],[1,8],[-1,3],[-4,1],[-4,0],[-8,-1],[3,-3],[2,-3],[-2,-3],[-4,0],[0,-2],[1,0],[1,-1],[1,-1],[-2,-5],[1,-5],[4,-1],[5,0],[0,-3],[3,1],[3,4],[4,1],[5,-2],[-4,-3],[-3,-4],[-3,-6],[-2,-11],[-5,-10],[-3,-12],[-11,-17],[-4,-12],[-4,-4],[-4,3],[-5,-5],[-2,-3],[-9,-17],[-2,-3],[-5,-4],[-2,-3],[-4,-12],[-6,-1],[-2,-7],[-2,-2],[-1,3],[-1,3],[-1,2],[-2,0],[-3,-1],[-1,-1],[-7,-5],[-7,-2],[-3,-2],[-3,-3],[0,-5],[-3,-1],[-1,-4],[-3,-3],[-2,-4],[-2,-8],[0,-9],[0,-6],[-1,-4],[-4,-3],[-2,-5],[0,-3],[-1,-4],[-17,-25],[-7,-12],[-3,-9]],[[7321,3196],[-3,2],[-1,4],[-1,1],[-1,1],[-10,3],[-2,1],[-3,3],[-1,0],[-8,0],[-16,-4],[-11,0],[-5,-1],[-2,0],[-2,1],[-7,3],[-1,1],[-1,1],[0,1],[-1,1],[-2,1],[-9,2],[-7,1],[-2,0],[-1,-1],[-3,-3],[-2,0],[-1,0],[-1,1],[-4,1],[-1,1],[-5,4],[-4,1],[-1,0],[-1,0],[-1,-1],[-1,0],[-4,1],[-2,0],[-1,1],[-2,0],[-2,1],[-2,1],[-3,2],[-4,3],[-3,1],[-5,1],[-2,1],[-4,4],[-1,1],[-2,0],[-1,1],[-2,0],[-1,-1],[-1,0],[-1,0],[-1,0],[1,2],[0,1],[-1,1],[-1,1],[-1,2],[0,2],[0,2],[0,2],[-1,4],[1,1],[0,1],[1,1],[0,2],[0,2],[1,1],[0,3],[0,3],[1,2],[0,1],[-1,5],[-2,5],[-1,2],[0,2],[1,3],[0,1],[0,5],[1,1],[0,1],[0,1],[0,1],[-2,1],[-1,1],[-1,2],[-1,2],[1,4],[0,2],[-1,1],[0,1],[-1,1],[-2,0],[-12,4],[-12,5]],[[8651,6982],[1,-9],[0,-11],[-3,-9],[2,-6],[1,-3],[1,-6],[1,-3],[2,-2],[1,-3],[0,-5],[-1,-5],[-1,-5],[2,-6],[0,2],[4,-22],[3,-5],[2,-2],[6,-4],[2,-1],[0,-13],[-1,-3],[-1,-2],[-2,-1],[-1,-2],[0,-3],[1,-6],[-1,-3],[-3,-10],[0,-1],[-2,-2],[-1,0],[-1,0],[-2,2],[2,-2],[1,-3],[0,-3],[-1,-4],[4,4],[4,5],[4,6],[1,5],[1,6],[3,10],[-1,5],[3,-3],[1,-5],[-2,-10],[0,-15],[1,-8],[0,-2],[2,-1],[4,-3],[1,-1],[0,-5],[0,-4],[-1,-4],[-1,-4],[0,-37],[-2,-19],[0,-10],[2,-8],[-2,-7],[-1,-2],[-1,0],[-2,1],[-2,1],[-9,0],[-3,-1]],[[7862,7013],[3,7],[1,1],[2,1],[1,-2],[0,-5],[0,-2],[2,-4],[3,-2],[3,-1],[5,-1],[27,-18],[4,-4],[1,-1],[2,-1],[2,2],[3,3],[2,1],[2,0],[24,-9],[2,0],[2,2],[7,13],[2,3],[2,1],[2,0],[1,-2],[1,-2],[1,-2],[4,-2],[3,6],[0,3],[2,2],[0,1],[2,0],[2,1],[16,12],[15,10],[2,2],[1,4],[1,3],[1,4],[2,1],[1,0],[2,-1],[1,-1],[1,2],[2,5],[0,2],[0,7],[2,4],[0,4],[1,3],[2,3],[2,2],[2,1],[8,3],[14,7],[5,1],[8,1],[2,0],[2,2],[2,3],[3,0],[2,1],[7,0],[6,2],[2,0],[2,-1],[4,-2],[3,0],[3,1],[2,2],[6,2],[9,6],[9,3],[7,5],[3,0],[7,-1],[2,-1],[2,-1],[2,-2],[1,-1],[1,-1],[1,-17],[-3,-6],[-5,-4],[-3,-4],[-14,-23],[-10,-11],[-11,-15],[-2,-5],[-1,-2],[-3,-18],[-5,-15],[-6,-4],[-6,-2],[-2,-1],[-3,-2],[-1,-2],[0,-3],[-3,-13],[0,-7],[1,-2],[0,-3],[2,-2],[1,-1],[2,-1],[4,0],[13,-3],[2,0],[5,0],[2,0],[3,0],[5,0],[2,0],[3,-1],[3,-1],[3,-2],[4,-4],[2,-3],[1,-3],[2,-8],[3,-7],[3,-3],[2,0],[3,1],[7,6],[2,2],[3,1],[19,5],[3,1],[2,2],[2,1],[2,3],[4,5],[1,2],[1,0],[2,0],[2,-1],[2,-2],[4,-5],[2,-2],[3,0],[2,1],[3,0],[15,-2],[8,-2],[3,-2],[2,-3],[4,-5],[3,-4],[2,-2],[0,-3],[0,-3],[-6,-16],[-1,-3],[0,-3],[2,-3],[2,-3],[4,-4],[3,-2],[3,1],[11,11],[2,1],[3,1],[8,-2],[2,0],[4,1],[2,2],[1,2],[5,9],[1,2],[4,10],[2,5],[1,4],[0,3],[-1,2],[-1,2],[-1,2],[-1,2],[-2,2],[-1,3],[-1,5],[0,6],[0,5],[0,3],[1,5],[1,3],[2,3],[1,1],[2,0],[2,-1],[2,-1],[4,-3],[2,-1],[2,0],[2,1],[0,2],[-2,8],[-5,14],[-2,2],[-5,5],[-1,3],[-1,5],[1,9],[1,10],[1,5],[2,2],[2,1],[7,2],[4,4],[7,10],[2,2],[2,0],[3,0],[2,0],[3,0],[2,0],[6,2],[5,-2],[2,-3],[1,-3],[0,-3],[-1,-3],[0,-4],[1,-5],[2,-3],[3,-4],[29,-5],[11,-3],[3,-1],[3,1],[5,-1],[14,-3],[8,-1],[20,1],[10,3],[15,1],[2,1],[6,3],[3,1],[3,0],[3,-1],[6,-3],[12,-4],[15,-1],[6,-1],[6,-3],[17,-10],[13,-3],[2,0],[4,1],[5,4],[16,-1],[15,-3],[8,0],[4,-2],[3,-1],[2,0],[4,4],[2,1],[10,3],[1,0]],[[6603,2727],[5,-4],[3,2],[2,-1],[2,-3],[3,-1],[1,1],[1,1],[1,2],[1,1],[2,-1],[0,-1],[-1,-2],[0,-1],[2,-2],[2,-3],[3,-3],[1,-2],[-3,-1],[-2,-1],[-1,-1],[-1,1],[-1,1],[0,2],[-2,0],[-2,0],[-1,-1],[-1,-1],[-3,2],[-2,-1],[-2,-3],[-3,-1],[-9,-2],[-2,0],[-3,1],[-3,2],[-2,2],[-4,0],[-2,-1],[-2,-4],[-1,-4],[-1,-3],[-1,0],[-1,0],[0,1],[0,1],[-2,2],[0,2],[0,2],[0,2],[-3,0],[-2,1],[-1,1],[0,2],[1,0],[9,5],[6,7],[2,-1],[3,2],[5,6],[1,1],[1,5],[1,0],[1,-1],[1,-1],[2,0],[2,-1],[3,-1],[2,-2],[0,-1],[-2,-1],[-1,0],[0,-1],[-2,0]],[[7321,3196],[2,-4],[0,-4],[-1,-4],[-1,-4],[1,-7],[-5,-7],[-7,-13],[-7,-7],[-2,-4],[-3,-10],[3,-10],[9,-12],[1,-11],[-3,-17],[4,-27],[9,-32],[-1,-10],[-5,-7],[-33,-21],[-22,-12],[-23,-7],[-26,-8],[-20,-8],[-25,-12],[-16,-13],[-7,-6],[-1,-2],[-1,-5],[-1,-2],[-4,-3],[-7,-5],[-3,-3],[-5,-9],[-1,-2],[-2,0],[-2,-1],[-2,-2],[-1,-1],[-1,-4],[-4,-3],[-8,-4],[-5,-8],[-2,-11],[0,-13],[1,-11],[2,-4],[8,-9],[2,-3],[1,-1],[2,2],[3,3],[2,1],[5,1],[2,2],[0,-5],[-1,-3],[-2,-2],[-2,-3],[-4,2],[-3,-2],[-5,-7],[-6,-3],[-2,0],[-1,-1],[-1,-2],[0,-2],[-1,-5],[0,-2],[0,-2],[-2,0],[-2,0],[-1,-1],[-1,-1],[-1,-2],[-1,-5],[1,-6],[1,-2],[2,3],[2,0],[1,-4],[-1,-3],[-2,-6],[-3,2],[-4,4],[-3,1],[-25,1],[-45,4],[-35,0],[-20,-1],[-7,-2],[-3,0],[-1,-1],[-3,-3],[-2,-1],[-16,0],[-21,-3],[-15,2],[-22,-1],[-6,5],[-4,3],[-3,-3],[-3,3],[-4,3],[-2,3],[3,0],[1,-1],[2,-1],[2,3],[0,2],[-1,2],[-3,0],[-4,2],[1,3],[3,5],[2,6],[5,6],[10,10],[-4,-1],[-2,1],[0,3],[1,2],[5,3],[1,1],[1,1],[1,6],[0,2],[-1,7],[-1,1],[-2,1],[-6,0],[-2,1],[-2,-1],[-2,-4],[-2,-2],[-3,-1],[-1,0],[-2,1],[-3,0],[-2,-1],[-5,-3],[-9,-6],[-5,0],[-4,-1],[-3,-3],[-1,-5],[1,-5],[6,-15],[2,0],[1,2],[0,1],[1,0],[1,1],[0,-2],[1,-2],[1,-2],[3,-1],[-2,0],[-1,-1],[-1,-1],[9,-6],[3,-2],[0,-3],[0,-5],[0,-3],[2,2],[0,-5],[-4,-5],[-6,-4],[-5,-2],[-50,-6],[-11,-3],[-10,-5],[-2,-2],[-1,-1],[-1,-2],[-2,0],[-2,4],[-1,1],[-9,2],[-55,-7],[-10,0],[-4,-1],[-4,-2],[-4,-3],[-4,-1],[-4,1],[-1,6],[2,5],[3,2],[8,0],[3,-1],[5,-3],[2,0],[1,2],[2,7],[5,-5],[8,-2],[18,0],[18,3],[10,3],[5,5],[-4,0],[-5,2],[-4,2],[-2,3],[-1,0],[-3,0],[-2,0],[-2,1],[-2,2],[-3,5],[-1,2],[-3,1],[-10,2],[-2,-1],[-1,6],[-4,0],[-4,-1],[-5,2],[3,1],[0,2],[-3,-1],[-6,-3],[-2,-1],[-12,-2],[-2,-1],[-7,-3],[-2,-1],[-2,-2],[-1,-3],[-3,-3],[-4,-1],[2,4],[1,4],[-1,2],[-3,-1],[-2,-2],[-3,-10],[-3,-2],[-5,-7],[-3,-2],[-5,0],[-2,-1],[-3,-2],[-2,-1],[-1,-1],[-1,0],[0,2],[-1,2],[-2,-1],[-4,-3],[-3,0],[-2,2],[1,8],[0,3],[-2,0],[-5,1],[-4,-4],[-2,-1],[-1,5],[-3,-2],[-2,-2],[-1,-1],[-5,4],[0,3],[3,2],[4,1],[2,1],[0,2],[-1,4],[-1,1],[-1,1],[-1,1],[3,2],[-2,2],[-2,0],[-3,0],[-2,0],[1,-4],[-1,-2],[-1,-2],[-2,-3],[-1,2],[-1,2],[-1,2],[-2,-1],[-1,-1],[-3,3],[-3,-3],[-3,-9],[1,-4],[-5,-3],[-7,-2],[-10,-2],[-16,-8],[1,2],[0,2],[1,1],[-7,0],[-6,-2],[-4,-4],[-6,-12],[1,-2],[0,-1],[1,-2],[-2,-5],[-3,-7],[0,-3],[1,-8],[5,1],[5,4],[4,3],[4,-3],[-10,-8],[-1,-5],[2,2],[3,2],[3,1],[4,-2],[-4,-4],[-1,-3],[-1,-2],[0,-4],[1,1],[4,6],[3,4],[3,2],[4,2],[6,0],[-2,-3],[-1,-1],[-1,-1],[4,-4],[5,-1],[5,-2],[2,-6],[-5,2],[-4,-3],[-5,-9],[-4,-4],[-4,1],[-3,2],[-4,-1],[-3,2],[-6,0],[-7,-1],[-5,-2],[0,-1]],[[8147,7411],[2,-3],[10,-18],[11,-5],[4,2],[4,1],[3,-1],[8,-4],[2,0],[6,2],[7,0],[18,-2],[4,-3],[7,-9],[1,-2],[3,-1],[2,-3],[3,-3],[1,-2],[3,-6],[8,-4],[8,-2],[5,0],[0,-4],[3,0],[9,0],[8,-1],[4,-2],[6,-5],[4,-1],[3,1],[1,4],[-2,1],[-8,3],[-2,3],[8,-3],[27,3],[18,-3],[9,-3],[4,-1],[5,1],[0,2],[-7,0],[0,1],[35,-1],[4,1],[8,5],[8,2],[6,3],[4,1],[18,-3],[33,-7],[24,-6],[17,-2],[7,-3],[9,-4],[4,-3],[8,-10],[4,-2],[4,-2],[3,-4],[3,-4],[5,-9],[1,-6],[2,-6],[0,-5],[2,-3],[6,-7],[13,-26],[2,-10],[1,-6],[3,-5],[2,-4],[-1,-2],[1,-2],[4,-18],[0,-3],[2,-2],[1,-19],[1,-3],[2,-3],[2,-3],[1,-6],[-1,-3],[0,-3],[1,-3],[3,-5],[1,0],[0,-3],[0,-9],[1,-3],[2,-3],[0,-3],[1,-1],[4,-4],[1,-2],[0,-3],[0,-8],[-1,-5],[0,-3],[2,-1],[1,-1],[1,-31],[-6,6],[-1,-5],[-5,-6],[-1,-2],[4,-3],[3,3],[3,4],[3,2],[1,-2],[3,-6],[1,-1],[5,0],[2,-1],[0,-2],[1,-5],[2,-11],[0,-5],[0,-4],[0,-2],[2,-3],[1,-2],[4,-2],[1,-2],[2,-3],[2,-11],[2,-18]],[[9209,7654],[-2,0],[-2,1],[1,2],[2,2],[2,1],[0,2],[3,1],[3,1],[2,1],[2,1],[2,-2],[-1,-3],[-2,-2],[-4,-1],[-6,-4]],[[9890,8863],[-5,-1],[-4,1],[-3,2],[-1,4],[1,3],[3,4],[6,1],[6,-2],[2,-4],[-1,-4],[-1,-3],[-3,-1]],[[8331,5958],[0,-1],[-3,-2],[-8,-3],[-6,0],[-5,-2],[-3,-1],[-4,-3],[-8,-1],[-2,-1],[-2,-4],[-1,-1],[-3,-1],[-35,-25],[-30,-25],[-11,-17],[-2,-7],[-4,-6],[-11,-12],[-2,-4],[-1,-4],[0,-5],[-1,-4],[-17,-29],[-3,-3],[-2,1],[0,3],[1,3],[0,2],[-1,2],[-1,0],[-1,1],[-1,2],[-2,0],[-1,-4],[-2,3],[-4,8],[-1,1],[-9,5],[-2,0],[-1,1],[-2,0],[-1,-1],[-1,-3],[1,-2],[1,-3],[1,-3],[2,-2],[1,0],[2,0],[1,1],[2,-2],[2,-1],[2,-2],[3,-1],[0,-2],[-4,2],[-1,-1],[1,-3],[3,-1],[2,0],[1,2],[0,1],[1,0],[2,-1],[2,-2],[0,-1],[-1,-3],[2,-3],[-1,-8],[2,-5],[0,2],[2,-2],[-5,-4],[-6,-3],[-5,-3],[-2,-6],[-1,-3],[-3,-1],[-2,-1],[-2,-2],[-1,-2],[-4,-8],[-6,-23],[-3,-3],[-10,-3],[-3,1],[-1,2],[2,2],[0,2],[-4,1],[6,9],[1,3],[2,7],[0,2],[3,4],[9,8],[2,3],[1,1],[4,1],[-3,4],[0,7],[-3,3],[0,-6],[0,-3],[0,-3],[-1,0],[-4,9],[-3,5],[-1,1],[-1,-5],[6,-12],[0,-5],[-1,2],[-5,3],[0,-3],[1,-1],[1,-2],[1,-2],[-1,-2],[-1,-1],[-2,0],[-2,-1],[-3,-2],[-1,-3],[-4,-7],[-3,-13],[-1,-3],[-3,1],[-2,4],[-1,9],[-1,-3],[-1,-2],[-2,1],[-2,2],[2,-8],[1,-3],[3,-3],[9,-4],[1,-2],[-2,-8],[-6,-6],[-7,-4],[-6,-2],[2,-1]],[[2355,9222],[3,8],[1,4],[-1,17],[0,4],[3,9],[-1,3],[-5,2],[-27,1],[-14,3],[-29,1],[-14,-2],[-14,-1],[-27,9],[-13,2],[-5,-2],[-3,2],[-2,5],[-1,5],[2,7],[8,17],[1,5],[1,15],[2,7],[0,2],[-1,2],[-3,5],[-3,14],[-17,38],[-7,11],[-8,16],[-7,10],[-4,9],[-1,10],[2,22],[-1,11],[-5,32],[1,6],[2,5],[6,9],[1,5],[1,4],[0,10],[-2,6],[-4,6],[-10,9],[-13,18],[-5,4],[-10,5],[-9,5],[-22,20],[-9,15],[-5,6],[-10,9],[-5,6],[-10,22],[-2,11],[-2,4],[-3,4],[-5,4],[-4,2],[-4,3],[-3,5],[-1,5],[1,6],[2,5],[3,3],[10,1],[10,-6],[9,-10],[3,-5],[2,-4],[4,-11],[2,-5],[5,-2],[49,8],[28,-2],[15,-5],[6,-3],[4,-6],[4,-8],[3,-9],[4,-18],[3,-10],[6,-8],[9,0],[9,5],[9,7],[9,5],[10,0],[9,-4],[4,-1],[5,0],[13,4],[4,0],[11,-2],[15,-16],[10,-5],[9,3],[3,9],[1,10],[5,7],[8,1],[9,-3],[14,-10],[8,-9],[13,-20],[14,-12],[23,-32],[3,-6],[3,-4],[5,-4],[5,-3],[5,-2],[5,0],[4,0],[4,1],[5,3],[4,4],[2,1],[3,0],[3,0],[2,2],[3,5],[5,9],[2,10],[0,11],[-2,11],[-4,10],[0,6],[-1,2],[-2,2],[-1,2],[-1,7],[2,6],[2,5],[1,6],[0,6],[-1,5],[1,3],[5,4],[4,1],[13,1],[18,-3],[6,2],[3,10],[0,5],[0,4],[2,3],[5,2],[7,2],[2,1],[1,2],[1,4],[1,2],[7,2],[10,-2],[42,-21],[9,-1],[10,4],[16,14],[10,2],[5,-2],[4,-2],[4,-1],[5,0],[5,1],[5,1],[4,3],[4,3],[11,14],[5,3],[4,2],[4,0],[9,0],[7,-2],[2,-1],[2,1],[4,2],[3,0],[3,0],[2,-1],[2,0],[3,2],[3,2],[1,2],[2,3],[1,4],[1,19],[3,7],[10,5],[4,0],[13,-1],[5,1],[6,1],[5,2],[4,4],[-1,5],[-6,11],[2,3],[4,0],[13,-2],[4,-1],[7,-4],[4,-1],[4,0],[13,4],[18,3],[8,4],[6,10],[2,5],[2,12],[6,16],[2,2],[1,0],[5,0],[2,1],[21,11],[10,7],[9,9],[14,21],[5,13],[-1,12],[-15,44],[-5,5],[-5,2],[-7,1],[10,3],[5,0],[13,-1],[3,-1],[3,-1],[2,-2],[2,-1],[3,0],[13,2],[4,-1],[2,-2],[2,-1],[1,-2],[2,0],[2,2],[2,5],[2,2],[5,0],[10,-4],[4,0],[5,4],[9,10],[4,2],[9,3],[3,-1],[2,-6],[3,-3],[10,4],[2,-3],[7,-19],[1,-1],[2,-3],[5,-4],[10,-7],[6,-3],[0,-8],[-4,-15],[0,-10],[-1,-5],[-1,-5],[-2,-7],[0,-15],[-3,-12],[0,-11],[0,-5],[-1,-4],[-2,-5],[-7,-10],[-1,-3],[0,-3],[-1,-3],[0,-2],[-2,-2],[-2,-1],[-5,0],[-2,-1],[-6,-7],[0,-5],[1,-5],[2,-3],[4,-2],[2,-1],[2,0],[2,1],[0,3],[1,2],[3,0],[2,-2],[1,-1],[1,-5],[3,-1],[3,1],[5,1],[5,-2],[3,-1],[1,2],[1,2],[2,1],[3,0],[2,-1],[2,-1],[3,-5],[1,-1],[2,0],[4,2],[3,0],[1,-1],[0,-3],[0,-1],[1,-1],[3,0],[1,0],[5,-1],[2,0],[1,3],[3,-5],[13,-8],[2,-2],[2,-3],[2,-2],[2,-1],[3,0],[1,-1],[-1,-3],[0,-1],[-1,-6],[-8,-10],[-2,-4],[0,-2],[3,-2],[0,-2],[0,-2],[-2,-3],[-1,-1],[0,-5],[0,-2],[0,-3],[3,-7],[3,-3],[10,-3],[5,-4],[-1,-4],[-3,-4],[0,-6],[2,-4],[7,-8],[3,-7],[2,-1],[1,-2],[0,-6],[1,-1],[2,0],[7,-2],[3,-1],[1,-2],[1,-2],[-1,-2],[-1,-1],[-2,-1],[-4,-2],[-4,-5],[-3,-6],[-2,-5],[1,-6],[1,-4],[-1,-3],[-4,-4],[-9,-5],[-3,-3],[-2,-7],[0,-3],[0,-2],[0,-2],[-1,-3],[-2,-2],[-5,-3],[-9,-9],[-18,-7],[-5,-7],[-1,-8],[4,-5],[4,-5],[2,-7],[-4,-11],[-1,-4],[4,2],[-1,-13],[0,-2],[2,-3],[0,-2],[-1,-1],[-2,0],[-1,0],[-1,-1],[-2,-8],[-6,-11],[-1,-3],[-3,-11],[-2,-3],[-1,-1],[-1,-2],[0,-4],[0,-1],[2,-3],[1,-1],[-1,-1],[-3,-1],[0,-1],[0,-1],[1,-3],[1,-2],[-1,-1],[-1,-1],[-2,-1],[-1,-1],[-6,-11],[-2,-6],[-1,-7],[1,-14],[-1,-6],[-4,-21],[-2,-42],[1,-4],[7,-16],[0,-2],[-1,-3],[0,-1],[1,-1],[3,-1],[0,-1],[2,-4],[1,-2],[0,-3],[0,-5],[7,-17],[0,-3],[0,-5],[1,-3],[0,-3],[-2,-4],[-1,-2],[3,-5],[4,-4],[9,-5],[6,-7],[3,-1],[2,-1],[5,0],[2,-1],[4,-6],[1,-9],[-2,-10],[1,-9],[2,-8],[0,-2],[-1,-3],[-2,-4],[-1,-3],[0,-4],[3,-5],[0,-3],[0,-2],[-1,-4],[0,-2],[0,-7],[0,-2],[-1,-3],[-3,-5],[-1,-3],[0,-4],[1,-6],[1,-5],[2,-3],[2,0],[5,2],[2,0],[9,-4],[2,-1],[2,1],[1,-4],[-5,-10],[-4,-6],[1,-2],[5,-6],[2,-1],[2,-2],[3,-1],[4,1],[4,1],[4,1],[5,-2],[4,-5],[6,-11],[4,-6],[7,-6],[2,-3],[4,-9],[2,-2],[1,-1],[3,0],[1,-1],[1,-1],[2,-4],[0,-2],[3,0],[5,1],[2,0],[2,-4],[1,-5],[1,-4],[4,-3],[2,-3],[4,-12],[3,-4],[4,-3],[14,-5],[37,-8],[9,-4]],[[5301,8884],[6,-4],[7,1],[3,-3],[-2,-5],[-3,-6],[-3,-8],[-4,-3],[-2,-2],[-1,-5],[-5,-6],[-2,-1],[-2,-1],[-6,0],[-12,0],[-8,-1],[-8,0],[-2,6],[2,10],[11,13],[15,7],[6,7],[4,1],[6,0]],[[5313,8888],[-7,-2],[-2,2],[-6,1],[0,6],[6,4],[5,3],[3,5],[1,2],[3,3],[5,2],[6,2],[5,5],[4,2],[3,-3],[-5,-9],[-1,-4],[-2,-3],[-1,-2],[-2,-3],[-7,-6],[-2,-2],[-1,-1],[-3,-1],[-2,-1]],[[5232,9191],[3,-5],[4,-7],[2,-2],[1,-7],[3,-6],[3,-5],[3,-6],[0,-5],[-2,-3],[-4,-6],[-8,-9],[-4,-2],[-6,-2],[-4,2],[-4,3],[-4,16],[-5,6],[0,5],[-2,2],[-4,2],[1,8],[2,6],[0,6],[2,4],[3,1],[4,0],[4,3],[2,-1],[4,1],[3,0],[3,1]],[[5206,9210],[5,-1],[7,0],[3,-2],[4,-3],[3,-5],[0,-5],[-2,-2],[-4,0],[-3,0],[-2,-1],[-2,-2],[-2,1],[-3,-1],[-3,1],[-2,1],[-1,6],[-2,2],[-2,0],[-2,1],[0,2],[2,3],[6,5]],[[4262,9279],[4,2],[4,0],[4,-2],[3,-2],[1,-1],[1,-5],[0,-2],[1,-3],[0,-1],[0,-2],[-1,0],[-1,0],[-1,0],[-1,-5],[2,-6],[0,-3],[0,-2],[0,-2],[3,-2],[4,0],[4,0],[5,1],[4,1],[6,0],[5,-3],[5,-4],[4,-4],[-5,-1],[0,-3],[8,-6],[4,-5],[4,-3],[9,-1],[2,0],[3,-2],[2,-1],[3,0],[2,0],[1,0],[3,-2],[6,-6],[3,-2],[2,-1],[11,-1],[4,0],[3,2],[5,1],[3,0],[1,0],[7,-10],[2,-2],[3,-1],[5,1],[1,0],[2,3],[4,11],[1,4],[2,1],[4,0],[2,0],[2,-2],[1,-1],[1,1],[3,2],[1,1],[9,4],[4,3],[2,5],[0,6],[1,2],[3,-1],[4,-1],[3,3],[2,4],[3,4],[5,0],[3,1],[2,3],[2,5],[2,3],[4,3],[4,1],[4,-1],[2,-4],[0,-3],[-2,-5],[0,-1],[1,-1],[7,-1],[15,-7],[3,-1],[8,0],[3,-1],[7,-5],[4,-1],[4,1],[9,1],[2,1],[8,7],[8,3],[3,2],[6,9],[0,2],[1,0],[3,-1],[2,-2],[6,-9],[14,-13],[0,-3],[-5,-1],[-4,-4],[-1,-4],[2,-2],[4,0],[26,6],[5,0],[4,-2],[7,-7],[9,-1],[9,-2],[5,0],[1,1],[2,3],[1,2],[1,0],[3,-1],[1,1],[2,2],[2,2],[2,6],[2,6],[4,4],[10,4],[24,18],[4,3],[3,5],[5,10],[8,8],[6,11],[5,12],[1,2],[2,2],[1,2],[0,3],[-1,3],[-4,6],[0,3],[1,1],[4,2],[2,2],[1,2],[1,7],[17,45],[2,3],[1,1],[2,2],[3,1],[3,2],[-1,2],[-1,2],[-1,3],[1,4],[14,30],[0,2],[-2,11],[0,6],[1,5],[8,6],[5,13],[4,4],[3,1],[2,-1],[2,0],[2,2],[3,3],[30,56],[0,3],[-1,2],[0,2],[5,2],[2,3],[2,8],[9,16],[2,6],[2,11],[2,4],[3,5],[2,1],[2,0],[2,0],[1,2],[1,2],[-1,6],[1,2],[1,2],[7,4],[15,18],[3,6],[3,7],[2,8],[3,8],[6,6],[16,9],[7,2],[5,6],[8,23],[-1,14],[3,5],[3,1],[3,-3],[1,-5],[3,-15],[6,-17],[14,-28],[3,-11],[2,7],[-2,8],[-6,11],[-8,19],[-10,39],[-4,26],[1,3],[2,13],[3,3],[4,2],[6,-3],[8,-7],[14,-11],[21,-26],[16,-24],[8,-22],[2,-13],[0,-26],[0,-31],[-4,-27],[5,-13],[0,6],[4,17],[2,23],[2,10],[5,10],[5,0],[3,-6],[-2,-40],[1,-34],[1,-26],[-4,-11],[1,-19],[13,-37],[2,-13],[-3,-7],[1,-7],[4,-9],[1,-5],[-2,-4],[1,-5],[3,-3],[1,-5],[2,-6],[1,-6],[1,-5],[4,-6],[2,-6],[2,-4],[0,-3],[-1,-4],[0,-3],[1,-4],[2,-2],[3,-1],[1,-2],[3,-2],[1,-4],[1,-4],[3,-4],[1,-5],[1,-6],[1,-5],[3,-5],[2,-5],[0,-5],[2,-8],[4,-11],[-1,-6],[-2,-3],[-1,-1],[-1,-2],[0,-2],[2,-2],[2,0],[1,2],[1,1],[2,1],[3,-3],[4,-7],[2,-6],[1,-6],[2,-6],[2,-4],[-1,-3],[1,-4],[2,-10],[3,-5],[0,-9],[1,-6],[4,-5],[2,-5],[2,-6],[-4,-7],[-2,-1],[-2,-1],[-3,0],[-2,-1],[-6,2],[-3,2],[-2,3],[-1,0],[0,-2],[0,-1],[1,-2],[1,-2],[2,0],[1,-1],[1,-2],[0,-1],[-2,-3],[-1,-6],[-1,-3],[2,-3],[1,-2],[2,-2],[2,0],[1,2],[0,3],[0,3],[0,3],[2,4],[4,4],[4,3],[5,1],[4,-1],[9,-6],[4,-8],[2,-12],[1,-3],[6,-14],[6,-8],[3,-5],[1,-10],[1,-4],[2,-3],[2,-3],[6,-5],[7,-3],[9,-1],[9,2],[5,3],[6,-1],[3,-1],[5,0],[2,-1],[8,2],[3,0],[6,1],[4,-1],[6,-4],[10,-4],[19,-8],[12,-8],[6,-8],[3,-7],[2,-13],[0,-9],[1,-5],[0,-7],[2,-16],[3,-9],[0,-10],[0,-9],[-2,-13],[-3,-5],[-4,-4],[-6,-3],[-7,-4],[-11,-4],[-10,-1],[-7,-3],[-4,1],[-3,1],[-2,1],[-2,-1],[0,-4],[3,-3],[4,-2],[4,2],[7,-2],[9,3],[6,0],[6,0],[6,5],[6,0],[3,-3],[3,-5],[1,-3],[0,-2],[-4,-9],[-7,-9],[-9,-6],[-8,-1],[-4,9],[-2,-4],[-1,-9],[-3,-9],[-8,-4],[-2,-2],[-8,-14],[-3,-3],[-4,-3],[-17,-10],[-3,-2],[-9,-12],[-2,-2],[-7,-20],[-2,-3],[-3,-3],[-15,-9],[-4,-4],[-3,-4],[-7,-24],[-14,-27],[-11,-19],[-19,-23],[-21,-30],[-2,0],[-4,1],[-8,0],[-17,-4],[-11,-9],[-8,-13],[-12,-23],[-2,-3],[-4,-2],[-14,0],[-9,-3],[-1,-1],[-1,-2],[-1,-2],[-5,-1],[-6,-2],[-10,1],[-4,0],[0,-2],[2,-1],[6,-2],[2,-2],[2,-2],[0,-2],[2,-2],[3,0],[-16,-22],[-3,-12],[-4,-8],[-2,-9],[-1,-4],[-4,-8],[-3,-4],[-7,-6],[-2,-4],[-1,-3],[0,-4],[0,-4],[-2,-4],[-7,-8],[-4,-3],[-4,-2],[-3,1],[-6,2],[-4,0],[0,-1],[2,0],[2,-1],[2,-1],[0,-2],[-3,-1],[-4,-1],[0,-1],[3,-1],[2,1],[3,1],[1,2],[3,-2],[-11,-13],[-11,-18],[-1,-2],[-3,-2],[-2,-1],[-9,-14],[0,-3],[-3,-8],[-3,-22],[3,-26],[0,-8],[0,-3],[-1,-1],[-1,-2],[-1,-1],[-2,-2],[-4,-3],[-7,-7],[-4,-2],[-4,-8],[-3,-3],[-16,-6]]],"transform":{"scale":[0.004514592470147016,0.0039013406548654827],"translate":[-74.01847469099997,-33.74228037499992]}};
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
