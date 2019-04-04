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
  Datamap.prototype.braTopo = '__BRA__';
  Datamap.prototype.brbTopo = '__BRB__';
  Datamap.prototype.brnTopo = '__BRN__';
  Datamap.prototype.btnTopo = '__BTN__';
  Datamap.prototype.norTopo = '__NOR__';
  Datamap.prototype.bwaTopo = '__BWA__';
  Datamap.prototype.cafTopo = '__CAF__';
  Datamap.prototype.canTopo = '__CAN__';
  Datamap.prototype.cheTopo = '__CHE__';
  Datamap.prototype.chlTopo = {"type":"Topology","objects":{"chl":{"type":"GeometryCollection","geometries":[{"type":"MultiPolygon","properties":{"name":"Aisén del General Carlos Ibáñez del Campo"},"id":"CL.AI","arcs":[[[0]],[[1]],[[2]],[[3]],[[4]],[[5]],[[6]],[[7]],[[8]],[[9]],[[10]],[[11]],[[12]],[[13]],[[14]],[[15]],[[16]],[[17]],[[18]],[[19]],[[20]],[[21]],[[22]],[[23]],[[24]],[[25]],[[26]],[[27]],[[28]],[[29]],[[30]],[[31]],[[32]],[[33]],[[34]],[[35]],[[36]],[[37]],[[38]],[[39]],[[40]],[[41]],[[42]],[[43]],[[44]],[[45]],[[46]],[[47]],[[48]],[[49]],[[50]],[[51]],[[52]],[[53]],[[54]],[[55]],[[56]],[[57]],[[58]],[[59]],[[60]],[[61]],[[62,63,64,65]],[[66]]]},{"type":"MultiPolygon","properties":{"name":"Magallanes y Antártica Chilena"},"id":"CL.MA","arcs":[[[67]],[[68]],[[69]],[[70]],[[71]],[[72]],[[73]],[[74]],[[75]],[[76]],[[77]],[[78]],[[79]],[[80]],[[81]],[[82]],[[83]],[[84]],[[85]],[[86]],[[87]],[[88]],[[89]],[[90]],[[91]],[[92]],[[93]],[[94]],[[95]],[[96]],[[97]],[[98]],[[99]],[[100]],[[101]],[[102]],[[103]],[[104]],[[105]],[[106]],[[107]],[[108]],[[109]],[[110]],[[111]],[[112]],[[113]],[[114]],[[115]],[[116]],[[117]],[[118]],[[119]],[[120]],[[121]],[[122]],[[123]],[[124]],[[125]],[[126]],[[127]],[[128]],[[129]],[[130]],[[131]],[[132]],[[133]],[[134]],[[135]],[[136]],[[137]],[[138]],[[139]],[[140]],[[141]],[[142]],[[143]],[[144]],[[145]],[[146]],[[147]],[[148]],[[149]],[[150]],[[-64,151]],[[152]],[[153]],[[154]]]},{"type":"Polygon","properties":{"name":"Tarapacá"},"id":"CL.TA","arcs":[[155,156,157,158]]},{"type":"Polygon","properties":{"name":"Arica y Parinacota"},"id":"CL.","arcs":[[-158,159]]},{"type":"Polygon","properties":{"name":"Antofagasta"},"id":"CL.AN","arcs":[[160,161,-156,162]]},{"type":"Polygon","properties":{"name":"Atacama"},"id":"CL.AT","arcs":[[163,164,-161,165]]},{"type":"Polygon","properties":{"name":"Coquimbo"},"id":"CL.CO","arcs":[[166,167,168,-164]]},{"type":"Polygon","properties":{"name":"Región Metropolitana de Santiago"},"id":"CL.RM","arcs":[[169,170,171]]},{"type":"MultiPolygon","properties":{"name":"Valparaíso"},"id":"CL.VS","arcs":[[[172]],[[173]],[[174,-172,175,176,-168]],[[177]],[[178]],[[179]],[[180]]]},{"type":"MultiPolygon","properties":{"name":"La Araucanía"},"id":"CL.AR","arcs":[[[181]],[[182]],[[183]],[[184]],[[185]],[[186,187,188,189]]]},{"type":"Polygon","properties":{"name":"Los Ríos"},"id":"CL.AR","arcs":[[190,191,192,-188]]},{"type":"MultiPolygon","properties":{"name":"Bío-Bío"},"id":"CL.BI","arcs":[[[193]],[[194,-190,195,196]]]},{"type":"Polygon","properties":{"name":"Libertador General Bernardo O'Higgins"},"id":"CL.LI","arcs":[[197,198,199,-176,-171]]},{"type":"MultiPolygon","properties":{"name":"Los Lagos"},"id":"CL.LL","arcs":[[[200]],[[201]],[[202]],[[203]],[[204]],[[205]],[[206]],[[207]],[[208]],[[209]],[[210]],[[211]],[[212,-66,213,-192]]]},{"type":"Polygon","properties":{"name":"Maule"},"id":"CL.ML","arcs":[[214,-197,215,-199]]}]}},"arcs":[[[7926,2015],[1,0],[2,0],[2,1],[3,0],[1,0],[2,-2],[1,-3],[1,-5],[0,-4],[-2,-4],[-5,-1],[-2,-1],[-3,-1],[-2,1],[-2,1],[-2,1],[-3,0],[-1,1],[1,2],[1,3],[0,1],[1,0],[-4,1],[-3,-3],[-5,-6],[-2,-2],[-4,-1],[-2,-1],[-2,-1],[-2,-3],[-1,-1],[-4,-2],[-4,-1],[-9,-1],[-10,-3],[-5,0],[-5,1],[-3,3],[-1,4],[0,12],[2,4],[7,-1],[13,-4],[12,0],[11,5],[26,19],[2,0],[2,0],[1,-2],[-1,-2],[-1,-1],[-2,0],[-1,-1],[0,-2],[1,-1]],[[7917,2068],[1,-2],[0,1],[2,1],[1,2],[2,3],[3,2],[1,-2],[-1,-6],[-2,-16],[-1,-1],[-3,-4],[4,0],[2,-1],[2,-1],[1,-1],[2,-3],[0,-3],[1,-4],[-1,-2],[-4,-4],[-39,-21],[-8,-1],[-4,0],[-4,0],[-3,1],[-3,3],[-2,2],[0,2],[1,2],[2,1],[16,-2],[7,1],[6,3],[4,5],[3,5],[-5,-1],[-12,-5],[-7,-1],[4,2],[7,4],[2,3],[-11,-1],[-3,-1],[-9,-6],[-3,-1],[-6,1],[-4,4],[-7,9],[4,4],[1,5],[-2,11],[1,5],[3,1],[4,0],[3,4],[0,2],[-2,2],[0,1],[4,2],[2,0],[4,-2],[3,-1],[2,-2],[2,-4],[6,0],[6,3],[4,2],[7,6],[3,1],[1,-8],[2,0],[2,1],[1,5],[1,1],[2,1],[1,0],[3,0],[0,-2],[-1,-3],[1,-2]],[[8145,2050],[-7,0],[-2,2],[-5,9],[-1,2],[0,2],[-1,1],[-1,1],[-8,8],[-1,5],[8,0],[16,-3],[22,-12],[2,0],[0,-1],[0,-3],[0,-2],[-2,-1],[-6,-2],[-14,-6]],[[8225,2068],[-3,-7],[-5,0],[-5,2],[-16,8],[-5,5],[-10,7],[-1,4],[3,3],[6,1],[4,0],[7,-2],[10,-8],[8,-2],[7,-4],[0,-7]],[[8168,2091],[4,-5],[12,-10],[2,-6],[-5,-3],[-6,-1],[-16,10],[-28,10],[-8,9],[8,2],[8,-1],[16,-7],[-6,6],[-3,5],[1,4],[5,5],[3,2],[3,1],[3,0],[4,0],[4,-1],[0,-5],[-3,-7],[2,-8]],[[8070,2127],[3,-2],[2,1],[1,0],[3,-2],[3,-4],[1,-3],[-3,-7],[0,-3],[9,-4],[5,-4],[5,-6],[3,-5],[0,-7],[-7,-1],[-7,0],[-7,-3],[9,-3],[4,-3],[3,-4],[1,-4],[-1,-14],[1,-5],[1,-4],[1,-3],[11,-11],[4,-1],[1,4],[0,6],[1,0],[5,0],[3,-2],[1,-4],[-1,-5],[-1,-4],[-6,-6],[-3,-3],[-8,-1],[-7,-3],[-3,0],[-3,0],[-8,5],[-3,1],[-6,2],[-3,1],[-2,0],[-6,6],[-2,1],[-4,0],[-6,-2],[-6,0],[-12,3],[-18,2],[-6,1],[-6,3],[-3,4],[-1,11],[-3,5],[-1,5],[2,5],[4,4],[14,13],[4,2],[2,0],[5,1],[3,1],[3,0],[6,3],[4,0],[2,-3],[2,-12],[3,-5],[4,-4],[4,-1],[3,1],[4,3],[4,5],[1,4],[-3,3],[-7,0],[-13,16],[0,6],[2,14],[1,5],[7,9],[2,5],[0,6],[-1,5],[0,4],[3,5],[4,2],[3,-1],[3,-3],[2,-4],[1,-3],[0,-4],[-2,-3],[-3,-1],[-2,-2],[1,-4]],[[8133,2136],[10,-6],[6,-6],[2,-2],[0,-3],[-1,-3],[-3,-4],[-3,-2],[-3,-1],[-6,-1],[-1,-1],[0,-1],[-2,-1],[-8,-2],[-7,-4],[-3,-1],[-2,4],[-2,5],[-1,4],[-1,11],[7,9],[2,3],[-5,-1],[-3,-3],[-2,-4],[-3,-3],[-4,-2],[-2,3],[0,7],[2,7],[2,4],[-1,1],[-2,1],[-2,0],[6,6],[5,3],[6,-1],[7,-4],[7,-10],[2,-1],[3,-1]],[[7978,2158],[11,-2],[0,2],[-1,1],[-1,1],[-1,1],[9,-1],[7,3],[9,-3],[15,-5],[5,-1],[6,-3],[9,-4],[3,-7],[2,0],[0,-10],[-1,-5],[-6,-5],[-1,-5],[0,-19],[-1,-4],[-2,-3],[-3,-1],[-2,1],[-2,0],[-3,0],[-2,-1],[-4,-3],[-10,-4],[-8,-6],[-8,-4],[-6,2],[0,2],[-1,1],[0,1],[-1,4],[-2,2],[-1,2],[-1,3],[-8,10],[-6,4],[-3,2],[-1,4],[1,3],[7,3],[2,3],[-5,0],[-4,1],[-3,2],[-1,6],[-1,0],[-3,1],[-2,1],[-2,2],[1,1],[2,1],[2,2],[0,3],[-2,2],[-5,2],[-1,2],[0,2],[1,2],[0,1],[-3,4],[0,2],[-2,1],[-1,1],[-1,2],[-1,2],[0,3],[-1,2],[0,2],[21,-2],[3,-1],[2,-4],[6,-2]],[[7924,2169],[4,-4],[2,-4],[0,-2],[0,-2],[1,-1],[4,2],[1,-6],[4,-5],[3,-5],[-3,-6],[-1,-2],[-1,-3],[0,-2],[2,-1],[1,1],[1,1],[0,1],[2,-1],[1,-2],[-1,-2],[-1,-2],[0,-1],[3,-1],[2,-2],[9,-16],[0,-3],[1,-3],[2,-3],[3,-3],[1,-1],[3,-1],[-1,-4],[-4,-7],[8,1],[4,-4],[3,-5],[6,-6],[-3,-1],[-7,-2],[-2,-1],[1,-2],[9,-3],[4,0],[1,-2],[0,-4],[-2,-6],[1,-3],[3,-6],[1,-3],[-3,-5],[-5,-5],[-6,-5],[-4,-1],[-4,-2],[-9,-9],[-5,-2],[-3,2],[-2,3],[-1,6],[1,2],[2,2],[1,1],[1,0],[0,2],[-3,0],[-3,-1],[-2,0],[-3,1],[-1,2],[0,2],[1,1],[2,2],[-3,1],[-3,4],[-2,3],[1,3],[2,4],[-1,3],[-5,6],[-1,6],[3,8],[4,7],[5,2],[0,2],[-8,3],[-3,1],[-2,2],[2,8],[0,4],[-3,1],[-2,-1],[-5,-7],[-2,-2],[-3,-2],[-4,-1],[-4,0],[-3,1],[-2,-4],[-5,-2],[-6,-2],[-6,-1],[-6,3],[-4,5],[0,4],[4,2],[3,1],[11,4],[10,1],[6,1],[5,3],[9,8],[0,2],[-4,0],[-3,-2],[-4,-2],[-3,-2],[1,6],[2,5],[-4,-2],[-7,-6],[-5,-3],[-1,2],[-2,1],[-1,1],[-7,-5],[-4,-1],[-4,1],[-2,3],[0,4],[3,3],[2,2],[14,7],[6,5],[3,7],[-6,-1],[-9,-6],[-5,-1],[-3,0],[-2,1],[-1,2],[1,3],[2,2],[0,2],[-5,4],[-2,1],[-1,0],[-1,4],[0,10],[-1,2],[-2,3],[0,3],[8,8],[3,3],[7,3],[7,2],[3,-5],[2,-5],[2,1],[6,8],[3,2],[7,3],[6,1],[3,-3],[-1,-3],[-2,-6],[0,-2]],[[8045,2233],[3,-1],[7,0],[2,-4],[3,-6],[0,-8],[-3,-5],[-2,-3],[-5,-3],[-1,-3],[7,-3],[1,-5],[-1,-5],[-8,-1],[-4,-4],[3,-1],[9,0],[4,-2],[2,-6],[7,-16],[-15,7],[-14,2],[-10,1],[-11,3],[-5,2],[-11,2],[-5,2],[-1,2],[2,5],[0,3],[-2,1],[-4,1],[-3,0],[-8,-1],[-4,-2],[-4,-3],[-3,-4],[-5,-2],[-6,-2],[-7,-1],[-5,1],[-2,0],[-3,3],[9,6],[2,3],[-3,5],[6,15],[10,6],[18,6],[10,0],[9,0],[15,-4],[5,5],[4,5],[3,4],[4,4],[4,-2],[3,1],[3,2]],[[8244,2220],[10,-5],[5,-1],[6,1],[5,3],[6,3],[4,-2],[2,-6],[0,-6],[-5,-7],[1,0],[0,-1],[0,-1],[-1,-2],[-1,0],[-6,0],[-11,0],[-3,-2],[-2,1],[-1,5],[1,0],[1,1],[1,2],[0,2],[-1,1],[-2,-1],[-4,-1],[-3,-1],[-7,-5],[-7,-2],[-21,2],[-3,0],[-9,-3],[-35,-6],[-6,2],[-4,3],[-3,3],[-4,2],[-5,1],[-11,1],[-5,1],[-5,3],[6,6],[13,9],[6,5],[7,3],[10,-4],[9,-5],[8,-3],[-3,4],[-5,4],[-11,6],[10,4],[10,0],[40,-11],[18,-1],[5,-2]],[[8117,2226],[-1,-8],[-5,-1],[-11,2],[-6,-4],[-1,-6],[1,-4],[-6,-1],[-3,5],[-4,3],[-3,8],[0,7],[0,5],[9,4],[5,-1],[8,-1],[8,0],[8,-2],[1,-6]],[[7988,2261],[3,-8],[1,-5],[-9,-4],[-2,0],[-2,-1],[-2,-3],[2,-1],[3,1],[3,1],[3,2],[2,-2],[5,-3],[5,-3],[-6,-5],[-10,-1],[-1,-2],[-8,-2],[-7,1],[-15,-4],[1,2],[6,2],[3,2],[-2,6],[-7,4],[-10,4],[-9,2],[-9,-4],[2,6],[-5,6],[4,4],[5,4],[5,0],[6,-2],[5,-3],[9,2],[5,1],[5,1],[3,1],[0,2],[8,5],[6,-1],[4,-5]],[[8022,2242],[-7,0],[-2,1],[-4,1],[-5,4],[-5,3],[-3,7],[-3,6],[3,6],[9,1],[12,-4],[11,-2],[4,-7],[6,-8],[-2,-5],[-14,-3]],[[8136,2399],[-4,-1],[-3,0],[-1,2],[2,3],[-1,2],[-3,4],[-2,2],[0,4],[1,3],[2,2],[2,1],[7,4],[9,3],[10,1],[7,-2],[2,-3],[1,-3],[-2,-4],[-2,-3],[-3,-1],[-8,-3],[-3,-3],[-11,-8]],[[8210,2433],[2,-6],[4,1],[3,5],[2,2],[6,0],[6,-2],[11,-5],[-11,-8],[-2,-3],[-1,-4],[-4,-4],[-4,-4],[-18,-8],[-6,0],[-3,3],[2,2],[5,0],[0,1],[-2,2],[-1,1],[-1,0],[-2,1],[-7,0],[-2,1],[-2,1],[-1,5],[2,6],[3,6],[6,9],[2,1],[2,1],[2,0],[8,-3],[1,-1]],[[7975,2498],[-7,-1],[-11,7],[-10,2],[-3,5],[-10,3],[-8,3],[4,4],[10,1],[7,0],[8,2],[10,-1],[7,-5],[2,-7],[3,-6],[-2,-7]],[[8286,2686],[3,-1],[7,1],[3,0],[3,-2],[3,-2],[3,-2],[3,-2],[1,-4],[-1,-4],[-5,-6],[-2,-3],[0,-1],[-2,0],[-2,-1],[-1,-1],[0,-5],[-2,-4],[-3,-3],[-4,0],[-4,0],[-4,2],[-3,2],[-2,4],[0,1],[1,3],[1,2],[3,1],[-3,1],[-4,2],[-12,9],[-8,4],[-3,2],[5,11],[2,3],[3,1],[5,0],[9,0],[3,-2],[7,-6]],[[8296,2716],[3,0],[5,1],[2,-1],[1,-3],[-1,-9],[6,-12],[-7,-1],[-25,6],[-2,4],[1,4],[9,14],[3,4],[4,2],[1,-7],[0,-2]],[[8070,2746],[2,-3],[0,-7],[-2,-5],[-5,-8],[-2,-7],[-2,-8],[-1,-8],[-1,-3],[-2,-3],[-4,-4],[-4,-2],[-9,-3],[-4,-3],[-6,-8],[-6,-4],[-7,-2],[-8,0],[-15,2],[-3,1],[-3,2],[-1,3],[-2,3],[-1,4],[-3,2],[2,3],[3,2],[22,5],[8,0],[8,-2],[7,0],[7,4],[-1,2],[-9,-4],[-2,-1],[-12,7],[-4,1],[-3,0],[-6,-3],[-3,0],[-3,0],[-8,2],[2,2],[3,1],[7,0],[0,2],[-14,4],[1,8],[-1,2],[-5,5],[-1,1],[1,3],[3,2],[4,1],[3,0],[3,0],[9,-3],[11,-3],[2,-2],[4,-3],[7,-4],[7,-2],[5,1],[-4,4],[-20,10],[-2,2],[3,2],[3,0],[2,-2],[2,-2],[3,-1],[2,-1],[3,-1],[1,0],[1,3],[0,4],[1,0],[2,-1],[3,-1],[6,1],[1,3],[0,4],[0,6],[6,-3],[2,0],[3,0],[5,3],[2,0],[4,0],[3,0]],[[8306,2732],[3,-7],[-5,1],[-5,2],[-6,2],[-6,-1],[-3,-4],[-3,-6],[-2,-4],[-5,1],[0,-2],[1,-1],[1,-2],[-5,-6],[-6,-3],[-6,-1],[-6,3],[-2,8],[0,4],[1,4],[3,4],[4,5],[4,4],[4,1],[9,1],[8,4],[14,11],[6,-5],[1,-6],[1,-7]],[[8236,2762],[5,0],[9,0],[5,0],[-9,-6],[-2,-3],[2,-1],[1,-3],[-1,-2],[-1,-3],[0,-1],[-1,-1],[-1,-1],[-1,-2],[1,-1],[2,-3],[0,-2],[-1,-5],[-5,-6],[-5,-3],[-3,3],[-3,9],[-2,3],[-2,2],[-2,2],[-1,3],[2,3],[-6,0],[-3,7],[2,6],[7,0],[1,5],[4,2],[4,-1],[4,-1]],[[8059,2773],[-1,-1],[-5,2],[-13,11],[-3,1],[-1,0],[-1,1],[-1,3],[0,3],[0,3],[2,2],[2,1],[5,0],[5,-1],[5,-2],[1,-5],[10,-17],[-1,0],[-4,-1]],[[8096,2761],[-6,-1],[-6,1],[-5,2],[-4,4],[-1,7],[1,6],[2,8],[3,6],[4,5],[4,2],[10,2],[5,3],[2,0],[4,0],[3,-1],[1,-2],[-1,-3],[0,-1],[-5,-8],[-2,-5],[5,-5],[-1,-4],[-2,-5],[-5,-7],[-2,-3],[-4,-1]],[[8248,2770],[-10,-2],[-10,2],[-7,6],[-7,13],[-1,6],[-1,2],[-1,2],[1,4],[6,4],[1,1],[3,2],[4,4],[5,3],[4,-1],[3,-2],[5,-2],[2,-1],[6,-5],[1,0],[7,-4],[2,-10],[-1,-10],[-4,-8],[-8,-4]],[[8171,2794],[4,-4],[5,0],[5,1],[5,-1],[-3,-3],[-3,-4],[-2,-3],[-5,-2],[-17,-1],[-5,-3],[4,0],[3,-1],[1,-3],[-2,-3],[-2,-2],[-15,-8],[-8,-3],[-7,1],[-6,7],[-2,3],[9,10],[2,5],[0,6],[2,2],[-2,3],[-6,3],[-2,2],[0,2],[7,3],[3,2],[-4,3],[-1,7],[1,7],[3,6],[7,11],[4,2],[8,-1],[12,-5],[6,-3],[4,-4],[4,-5],[2,-5],[-1,-5],[-5,-3],[3,-1],[5,-1],[4,-2],[0,-5],[-2,-3],[-4,-2],[-9,0]],[[8326,2795],[2,-3],[-4,-2],[-4,0],[-8,4],[3,-6],[1,-3],[3,-2],[5,-2],[2,-2],[2,-3],[0,-6],[-4,-6],[-6,-4],[-6,0],[-4,6],[-5,6],[-11,7],[-2,1],[-2,1],[-5,4],[-3,4],[3,1],[15,7],[0,2],[-10,8],[3,15],[11,14],[13,5],[9,-2],[6,-3],[4,-6],[1,-8],[-1,-2],[-1,-2],[-1,-2],[-1,-2],[1,-6],[-1,-2],[-2,-4],[-2,-4],[-1,-3]],[[8260,2833],[4,-1],[10,5],[5,0],[1,-6],[-1,-4],[-2,-5],[-9,-13],[-4,0],[-3,1],[-5,2],[-2,1],[-6,3],[-6,1],[-8,3],[-3,1],[-7,-1],[-3,-1],[-6,-3],[-2,-1],[-2,-2],[-1,-5],[-1,-2],[-4,0],[-1,4],[1,6],[2,4],[2,2],[1,1],[1,2],[1,3],[1,4],[3,5],[4,5],[3,3],[4,0],[13,-1],[5,-2],[3,-3],[6,-3],[6,-3]],[[8122,2809],[-1,-7],[-5,2],[-1,3],[-1,3],[-2,2],[-3,1],[-4,2],[1,4],[4,6],[7,14],[5,5],[7,2],[5,-3],[-2,-6],[-10,-13],[-1,-6],[1,-9]],[[8252,2859],[11,-2],[8,1],[7,0],[1,-6],[-3,-4],[-6,-3],[-7,-1],[-7,-1],[-14,2],[-7,3],[-2,5],[3,3],[7,2],[9,1]],[[8158,2850],[-3,0],[-5,0],[-26,12],[-5,4],[-3,6],[0,6],[6,2],[16,2],[9,-1],[5,-4],[0,-2],[7,-8],[1,-4],[1,-4],[2,-3],[3,-3],[-3,-1],[-2,-1],[-3,-1]],[[8231,2888],[10,-4],[26,2],[12,-1],[3,-3],[4,-6],[3,-6],[-1,-2],[-7,-3],[-3,-1],[-35,0],[-4,-1],[-4,0],[-14,5],[-11,1],[-2,1],[-2,3],[-3,5],[-3,6],[-1,4],[2,5],[5,2],[5,1],[11,5],[3,-3],[6,-10]],[[8166,2878],[-4,-2],[-3,1],[-12,7],[-3,3],[-3,3],[-1,4],[0,8],[3,7],[5,4],[7,0],[3,-2],[9,-9],[2,0],[4,-1],[1,-1],[1,-2],[-1,-1],[-3,-2],[-3,-12],[-2,-5]],[[8274,2953],[15,-10],[2,-2],[3,-4],[0,-1],[-2,-1],[-1,-2],[3,-2],[5,-3],[5,-4],[3,-6],[0,-6],[-1,-5],[-3,-5],[-3,-4],[-2,-5],[2,-8],[-2,-4],[-6,-1],[-5,3],[-5,4],[-5,4],[-3,1],[-6,0],[-21,-3],[-7,1],[-4,4],[-4,10],[-3,2],[-5,2],[-6,9],[-4,1],[-2,-1],[-1,-2],[-1,-3],[-3,-1],[-2,2],[-4,3],[-2,1],[-1,-3],[-3,-4],[-5,0],[-5,2],[-3,3],[-2,10],[3,10],[7,7],[8,4],[5,1],[18,-2],[2,0],[5,3],[2,0],[10,0],[4,0],[5,2],[9,4],[6,1],[5,0],[5,-2]],[[8257,2964],[-5,-3],[-1,-1],[-3,0],[-4,-2],[-3,-1],[-3,0],[-6,3],[-4,1],[-3,1],[-2,0],[1,-2],[1,-2],[5,-3],[-7,-2],[-29,2],[-6,-2],[-8,-4],[-7,-3],[-7,2],[-6,0],[-5,2],[-2,4],[4,6],[4,2],[14,5],[4,4],[10,11],[5,5],[6,1],[6,-1],[22,-7],[13,-1],[4,-1],[7,-7],[5,-4],[1,-1],[-1,-2]],[[8229,2991],[-8,0],[-6,3],[-18,6],[-3,3],[5,1],[30,5],[7,2],[3,1],[5,-1],[2,-2],[1,-2],[0,-5],[-3,-6],[-7,-4],[-8,-1]],[[8280,2996],[13,-25],[-4,-4],[-3,-3],[-5,-1],[-6,1],[-10,8],[-9,9],[-2,3],[0,4],[1,2],[2,0],[7,-7],[3,-2],[4,-1],[-3,2],[-2,2],[-1,3],[-1,6],[-2,2],[-3,1],[-3,1],[-2,2],[-2,2],[0,3],[2,3],[5,4],[3,1],[2,1],[8,-1],[4,-4],[4,-12]],[[7986,2973],[-6,-1],[-5,0],[-5,1],[-3,2],[2,2],[2,4],[1,3],[-2,4],[-7,6],[-4,6],[0,3],[6,6],[6,5],[8,-1],[3,-3],[2,-5],[7,-9],[10,-3],[-2,-2],[-3,-5],[1,-5],[1,-3],[-4,-1],[-5,-3],[-3,-1]],[[8330,3019],[0,-4],[-4,-6],[0,-2],[2,-6],[-3,-4],[-6,-3],[-6,0],[-6,2],[-6,3],[-5,5],[-1,6],[3,6],[6,1],[6,-1],[6,3],[3,2],[4,1],[4,-1],[3,-2]],[[8162,2992],[-16,-2],[-3,1],[-4,2],[-7,2],[-3,3],[-1,1],[-4,7],[-8,10],[-1,3],[1,2],[4,3],[4,1],[6,1],[5,0],[4,-1],[2,-2],[1,-5],[1,-4],[0,-3],[2,-3],[5,-3],[5,-2],[4,0],[2,-2],[3,-4],[1,-3],[-3,-2]],[[8132,3037],[-1,-4],[-2,-2],[-4,-1],[-19,2],[-6,3],[-4,-1],[-3,-1],[-3,0],[-4,1],[-2,1],[-2,3],[1,3],[1,1],[8,6],[1,2],[12,1],[5,-1],[12,-3],[4,-1],[3,0],[2,-2],[1,-3],[0,-4]],[[8255,3048],[8,-8],[3,-5],[1,-3],[-22,-3],[-10,-3],[-19,-10],[-24,-6],[-12,-6],[-2,-1],[-3,0],[-2,0],[-10,4],[-4,3],[-4,3],[-3,5],[-1,6],[3,3],[5,1],[5,-1],[0,2],[-4,0],[-17,3],[-1,2],[0,8],[3,7],[7,1],[17,-2],[-2,3],[3,3],[6,1],[56,0],[13,-2],[10,-5]],[[8056,3067],[1,-6],[9,2],[2,-6],[-2,-8],[-2,-8],[0,-2],[-4,-2],[-5,-1],[-4,1],[-3,4],[-2,7],[0,7],[0,6],[3,5],[3,3],[4,-2]],[[8312,3070],[4,-4],[3,-4],[-5,0],[2,-3],[7,-5],[2,-4],[0,-5],[-3,-3],[-3,-3],[-2,-3],[4,0],[4,0],[2,0],[4,-3],[2,-5],[-3,-2],[-5,-1],[-5,0],[-15,-4],[-10,-2],[-4,5],[-4,5],[-11,10],[-2,3],[3,3],[3,-3],[1,4],[-1,6],[0,3],[-2,2],[1,4],[3,4],[3,3],[5,0],[5,0],[5,0],[3,2],[5,2],[4,-2]],[[8197,3080],[5,-9],[5,-2],[-5,-3],[-22,-2],[-12,-3],[-6,0],[-4,1],[-3,4],[-3,5],[0,4],[10,3],[8,3],[9,-1],[10,3],[4,0],[4,-3]],[[8247,3068],[-6,-1],[-14,1],[-5,0],[-8,2],[-5,3],[-2,3],[3,2],[20,4],[-6,5],[-19,5],[-6,7],[3,0],[2,-2],[2,-2],[3,-1],[2,-1],[23,-1],[3,0],[5,-3],[3,0],[3,-2],[1,-5],[1,-12],[-3,-2]],[[8186,3090],[-4,-3],[-15,-2],[-12,-3],[-15,-2],[2,-2],[2,-3],[2,-3],[1,-3],[-7,0],[-17,3],[-7,3],[-4,6],[-1,6],[1,6],[6,4],[3,1],[15,-1],[2,-2],[1,-3],[1,-3],[13,15],[4,2],[6,2],[4,1],[5,-3],[4,-1],[2,-1],[4,-7],[4,-7]],[[8280,3091],[-11,-1],[-5,2],[-4,3],[-2,7],[1,6],[2,4],[3,3],[5,-2],[3,-2],[1,-5],[3,-2],[3,-1],[6,-1],[2,-1],[1,-5],[-3,-3],[-5,-2]],[[8486,3094],[-11,-16],[6,0],[11,15],[8,4],[5,0],[9,-4],[6,-1],[4,-2],[5,-11],[4,-3],[2,-2],[-2,-5],[-4,-6],[-13,-15],[-2,-2],[-21,2],[-9,2],[-9,5],[1,-5],[3,-3],[5,-2],[4,-3],[5,-2],[13,-2],[3,-2],[-1,-9],[-9,-8],[-21,-11],[-9,-7],[-2,-3],[-1,-1],[-3,0],[-2,-2],[-2,-4],[-1,-1],[-22,-14],[-10,-4],[-15,-3],[-5,0],[-3,1],[-3,5],[-15,12],[-6,7],[-3,5],[1,2],[10,0],[3,1],[4,3],[5,3],[4,-1],[8,-6],[3,1],[5,1],[3,1],[0,2],[-2,1],[-19,8],[-2,-1],[-7,-4],[-5,-3],[-3,0],[-3,-1],[-2,1],[-2,3],[-1,3],[0,3],[-1,2],[-5,6],[-3,4],[-3,12],[-2,5],[9,10],[2,2],[3,0],[3,2],[2,0],[2,-1],[4,-5],[2,-1],[7,3],[2,0],[3,-1],[6,-5],[5,-2],[1,-1],[1,0],[2,1],[2,3],[-2,2],[-5,3],[-3,4],[-3,6],[0,6],[5,2],[5,-1],[18,-9],[3,0],[2,1],[2,3],[0,3],[-2,2],[-2,1],[-6,0],[-12,3],[-4,2],[-4,9],[3,10],[8,8],[10,0],[2,-2],[3,-5],[2,-2],[0,1],[0,1],[1,0],[3,0],[2,1],[3,1],[4,-1],[3,-2],[5,-8],[3,-4],[-3,10],[0,3],[-1,4],[-3,1],[-3,1],[-3,2],[2,5],[15,3],[4,3],[5,-4],[6,-5],[5,-5],[1,-6],[-1,-3]],[[8313,3098],[-3,-1],[-4,1],[-5,3],[-14,10],[10,5],[3,1],[8,0],[2,0],[2,3],[2,1],[4,-1],[1,-3],[-1,-2],[-1,-4],[-2,-1],[-14,0],[7,-3],[4,-2],[2,-3],[-1,-4]],[[8231,3119],[6,-1],[12,2],[6,-1],[-2,-7],[1,-13],[-2,-5],[-11,8],[-5,2],[-5,1],[-3,0],[-5,4],[-4,2],[-2,2],[-1,3],[-3,7],[-1,3],[5,1],[5,-2],[4,-4],[5,-2]],[[8414,3130],[6,-4],[1,0],[8,-11],[0,-2],[-20,-3],[-5,2],[-3,3],[-1,5],[3,6],[2,1],[5,3],[2,1],[2,-1]],[[8284,3139],[3,-9],[-4,-4],[-8,-2],[-6,0],[-7,0],[-8,1],[-7,4],[-3,6],[3,2],[19,-4],[7,0],[2,2],[1,4],[0,1],[2,1],[2,0],[1,1],[2,-1],[1,-1],[0,-1]],[[8171,3133],[-2,-3],[-4,2],[-6,1],[-9,1],[-7,3],[-2,5],[1,1],[2,1],[4,1],[5,1],[5,0],[5,0],[4,-3],[3,-4],[1,-6]],[[8315,3142],[-2,-4],[-5,-4],[-5,-2],[-5,1],[-4,4],[0,5],[1,3],[3,-3],[10,5],[5,1],[2,-6]],[[8229,3168],[10,-10],[3,-2],[16,-2],[2,-1],[3,-5],[-5,-1],[-8,1],[-5,-2],[-4,-2],[-3,0],[-2,0],[-2,-4],[1,-4],[5,-10],[-6,-1],[-3,1],[-3,1],[-12,10],[-1,3],[-1,8],[-1,3],[-4,7],[3,3],[8,0],[6,-2],[0,2],[-2,2],[-2,3],[-1,4],[2,1],[4,-1],[2,-2]],[[8176,3164],[-16,-3],[-12,8],[2,2],[5,1],[14,1],[2,-1],[3,-1],[1,-1],[2,-3],[1,-2],[-2,-1]],[[8266,3169],[2,-1],[1,1],[2,1],[1,-1],[3,0],[1,0],[1,-1],[0,-3],[-1,-2],[-2,-2],[-3,-1],[-3,-1],[-9,1],[-10,2],[-8,4],[-7,7],[15,10],[8,1],[8,-5],[4,-3],[0,-2],[-2,-1],[-1,-1],[0,-1],[0,-1],[0,-1]],[[8190,3204],[-21,-3],[-2,1],[-2,2],[-1,1],[1,1],[4,0],[4,0],[17,-2]],[[8323,3178],[-4,-2],[-3,0],[-2,4],[1,5],[-1,4],[-3,2],[-5,4],[-4,2],[-1,1],[-1,2],[0,5],[-1,2],[-3,3],[-1,3],[0,4],[2,4],[4,4],[4,1],[2,-2],[-1,-5],[4,-1],[5,-3],[4,-3],[3,-4],[0,-4],[-3,-2],[-1,-2],[2,-4],[7,-5],[1,-3],[-2,-6],[-3,-4]],[[8430,3203],[-3,0],[-4,0],[-3,2],[-3,1],[-2,3],[-9,2],[-1,3],[-1,8],[0,4],[3,4],[5,4],[8,4],[7,2],[6,0],[4,-3],[1,-3],[-1,-7],[-1,-4],[-4,-6],[-1,-3],[2,-4],[2,-3],[0,-2],[-5,-2]],[[8271,3269],[15,-16],[4,-7],[3,-8],[-19,-1],[-6,1],[-9,4],[-1,1],[2,2],[7,1],[2,3],[-6,1],[-8,0],[-8,-2],[-3,-5],[4,-3],[9,-4],[3,-3],[-6,-1],[-9,-6],[-6,0],[-3,1],[-2,3],[-1,3],[0,2],[-2,2],[-5,-1],[-8,-1],[-12,2],[-3,2],[-2,2],[-2,0],[0,1],[0,3],[0,2],[4,2],[1,5],[7,4],[16,4],[12,-5],[7,-4],[12,4],[-2,4],[5,1],[5,1],[3,0],[0,5],[0,2],[2,-1]],[[8762,3198],[-4,-5],[-8,-6],[-9,-2],[-6,-3],[4,-10],[7,-11],[2,-4],[0,-5],[-5,-7],[-1,-5],[2,-4],[2,-4],[2,-3],[-1,-5],[-4,-2],[-5,-2],[-4,-3],[1,-4],[9,-7],[10,0],[10,3],[10,0],[12,-3],[47,1],[35,-6],[12,0],[6,-1],[6,-3],[3,-3],[2,-4],[0,-4],[2,-4],[3,-4],[3,-2],[1,-2],[1,-5],[-3,-6],[-3,-2],[-5,-1],[-5,0],[-2,-2],[-4,-4],[-5,-8],[-1,-5],[0,-4],[2,-9],[-1,-10],[-6,-8],[-8,-4],[-9,-2],[-10,2],[-18,11],[-10,2],[-10,-2],[-21,-7],[-9,0],[-16,5],[-5,1],[-6,-1],[-3,-2],[-3,-3],[-4,-3],[-6,0],[-30,4],[-6,2],[-8,3],[-7,-2],[-3,-5],[3,-14],[0,-4],[-1,-9],[2,-4],[4,-1],[10,1],[10,-3],[9,-5],[9,-3],[10,1],[5,2],[5,1],[5,1],[5,-1],[4,-3],[6,-6],[4,-2],[9,-1],[9,1],[8,-1],[8,-7],[9,-16],[5,-11],[2,-3],[9,-10],[12,-6],[8,-6],[5,-7],[5,-8],[2,-9],[-6,-6],[-4,-2],[-5,-7],[-3,-3],[-5,-2],[-23,-7],[-1,-3],[2,-5],[5,-8],[1,-4],[-3,-4],[-8,-5],[-9,-1],[-18,1],[-7,-1],[-10,-2],[-8,-5],[-4,-6],[1,-1],[4,-2],[0,-2],[0,-2],[-2,-1],[-1,-2],[-2,-1],[-4,-6],[-1,-3],[0,-4],[0,-2],[1,-2],[1,-2],[-1,-2],[-4,-5],[0,-1],[0,-4],[3,-3],[6,-5],[3,-4],[-1,-4],[-2,-4],[-1,-4],[2,-4],[3,-3],[10,-2],[8,-4],[6,-6],[4,-7],[3,-10],[-9,-7],[-17,-15],[-3,-3],[-5,-8],[-3,-3],[-5,-2],[-6,-2],[-17,-1],[-3,-1],[-2,-2],[-1,-2],[2,-1],[2,-1],[2,-1],[11,-8],[14,-8],[5,-5],[1,-7],[-1,-12],[0,-10],[2,-9],[16,-32],[1,-5],[-1,-4],[-2,-4],[-1,-5],[4,-18],[-2,-8],[-7,-6],[-13,-6],[-4,-4],[-6,-7],[-4,-2],[-5,-2],[-12,0],[-6,-1],[-4,-4],[0,-2],[1,-2],[2,-2],[1,-2],[-1,-2],[-1,-2],[-1,-1],[-1,-2],[-4,-15],[0,-4],[2,-4],[8,-5],[2,-4],[-4,-4],[-15,-7],[-2,-5],[5,-5],[15,-7],[6,-3],[5,-6],[3,-7],[-1,-7],[-4,-6],[-7,-3],[-8,1],[-15,8],[-4,0],[-3,-2],[-1,-3],[1,-4],[1,-4],[2,-3],[0,-2],[-2,-5],[-5,-6],[-20,-18],[-6,-7],[-4,-2],[-5,-1],[-12,2],[-6,-1],[-10,-3],[-4,-2],[-3,-4],[-2,-6],[2,-2],[5,-1],[4,-3],[0,-4],[-4,-13],[0,-5],[-1,-5],[-2,-4],[-3,-4],[-22,-29],[-4,-9],[-6,-18],[-5,-8],[-5,-8],[2,-8],[6,-7],[8,-5],[5,-2],[4,-1],[4,-1],[4,-4],[1,-2],[0,-3],[1,-2],[1,-1],[3,-2],[8,-2],[2,-5],[6,-31],[-1,-5],[-3,-9],[0,-5],[2,-3],[3,-5],[2,-4],[-2,-4],[-3,0],[-6,1],[-4,0],[-3,0],[-1,-1],[-3,-4],[-6,-7],[-4,-2],[-15,-4],[-9,-4],[-9,-6],[-9,-14],[2,-13],[5,-15],[1,-27],[-1,-10],[-2,-7],[-6,-8],[-12,-11],[-17,-13],[-9,-5],[-10,-3],[-23,-2],[-11,-3],[-9,-6],[-2,-2],[-14,-16],[-3,-6],[-1,-3],[0,-4],[0,-3],[-3,-3],[-15,-14],[-3,-7],[1,-6],[3,-3]],[[8431,1864],[-208,130],[-1,0]],[[8222,1994],[3,1],[0,2],[-8,4],[-9,2],[-9,1],[-9,-1],[-15,-4],[-8,-1],[-6,4],[2,2],[2,2],[3,1],[3,0],[-2,2],[-2,1],[-2,1],[-1,3],[-3,-3],[-4,-2],[-4,0],[-1,4],[0,8],[0,2],[-2,1],[-2,1],[-2,0],[-1,3],[2,3],[15,13],[4,2],[5,1],[4,0],[-3,3],[3,3],[9,6],[2,1],[2,1],[2,2],[2,0],[3,-1],[4,-3],[7,-3],[12,-10],[8,-3],[2,-1],[1,-2],[3,-5],[1,-2],[6,-2],[5,4],[0,5],[-3,2],[-5,2],[-3,4],[0,5],[0,6],[-2,11],[2,2],[24,5],[6,2],[-2,2],[-1,1],[-2,0],[-5,1],[-14,-5],[-8,1],[-2,1],[-3,3],[-1,1],[-2,0],[-4,0],[-2,0],[-4,2],[-3,1],[-4,4],[-4,2],[-17,1],[-2,0],[0,2],[3,2],[4,2],[12,0],[12,3],[4,0],[-5,3],[-7,1],[-12,-2],[-5,-1],[-12,-6],[-2,0],[-2,3],[1,2],[2,2],[1,2],[0,3],[-1,2],[-2,4],[-4,3],[-4,3],[-2,3],[0,5],[-19,3],[-10,5],[-4,7],[-2,2],[-8,10],[-1,3],[-1,1],[3,4],[7,5],[0,2],[-1,2],[0,1],[1,2],[-6,-1],[-11,-8],[-5,-3],[-6,-1],[-4,1],[-5,4],[-1,6],[1,4],[1,4],[5,2],[2,1],[5,1],[8,7],[5,1],[3,-1],[4,-4],[3,-1],[11,0],[2,0],[7,-7],[3,-1],[5,-1],[2,-1],[2,-3],[6,-10],[1,-4],[2,-11],[3,-10],[2,-4],[1,-1],[4,1],[2,-1],[1,-2],[1,-2],[0,-1],[2,-5],[5,-1],[6,2],[2,1],[-3,0],[-3,2],[-1,2],[0,3],[-1,1],[-3,2],[-3,4],[-1,2],[0,2],[1,1],[2,1],[0,1],[-1,2],[-1,0],[-1,0],[-1,0],[-2,3],[-2,1],[-1,2],[0,4],[-5,6],[-1,1],[-2,2],[-4,5],[-3,5],[-1,4],[5,3],[15,-3],[5,1],[4,2],[34,-3],[2,-1],[2,-6],[2,-1],[2,0],[1,1],[1,1],[3,-1],[3,-1],[4,-3],[3,-1],[10,5],[6,2],[3,-3],[1,-2],[1,0],[2,0],[1,0],[0,-2],[-1,-1],[0,-1],[-1,-2],[-1,-1],[-2,-2],[-1,-3],[1,-2],[3,1],[10,9],[8,3],[2,4],[2,0],[2,-1],[1,-2],[0,-3],[-1,-3],[-7,-7],[-3,-4],[3,-2],[2,1],[5,6],[3,1],[3,0],[8,-5],[6,-1],[6,-1],[3,-1],[6,-3],[3,-1],[2,-3],[0,-6],[-1,-6],[-2,-4],[4,-2],[2,-2],[5,-7],[2,3],[4,9],[3,4],[4,2],[3,1],[5,1],[8,-2],[19,-11],[-1,4],[1,3],[2,3],[6,2],[5,5],[2,1],[2,3],[0,7],[-1,8],[-2,4],[0,-2],[0,-11],[-1,-3],[-3,-2],[-6,-2],[-4,-3],[-6,-2],[-6,0],[-8,5],[-11,5],[-5,7],[-2,1],[-4,2],[-14,11],[2,4],[0,3],[-2,2],[-8,3],[-4,3],[-1,2],[3,2],[0,2],[-3,2],[-2,5],[-1,5],[2,3],[2,1],[14,-3],[2,-1],[4,-6],[2,-5],[2,-2],[2,-1],[5,-3],[2,-1],[17,-2],[19,3],[7,-1],[10,-5],[6,-2],[4,1],[-1,5],[-6,2],[-13,2],[-9,4],[-20,-3],[-7,0],[-3,1],[-10,8],[0,1],[3,5],[1,2],[0,3],[-2,2],[-2,2],[-2,1],[-1,-4],[-2,-2],[-3,1],[-3,2],[-2,1],[-7,2],[-2,1],[2,4],[5,5],[5,3],[4,3],[-6,2],[-22,1],[-6,2],[-3,3],[-1,3],[-4,5],[-2,10],[8,8],[9,7],[0,8],[-4,-2],[-4,-2],[-1,5],[1,5],[3,3],[4,3],[-2,2],[-3,1],[-2,0],[-3,-1],[-2,2],[-1,2],[0,1],[2,2],[0,1],[-4,-2],[-4,-10],[-5,-3],[0,-2],[10,-7],[-2,-9],[-8,-10],[-3,-11],[1,-2],[3,-4],[0,-2],[0,-2],[-3,-4],[-1,-1],[-3,-2],[-18,-4],[-8,-5],[-2,0],[-3,0],[-4,1],[-10,1],[-3,0],[-3,1],[-3,2],[-1,2],[0,1],[-1,2],[-6,8],[-1,0],[-29,-5],[-6,1],[-9,4],[-7,1],[-6,-6],[-8,1],[-8,2],[-5,3],[4,1],[11,1],[1,1],[-4,3],[-5,0],[-23,-5],[-13,-5],[-4,0],[2,2],[0,2],[-9,-1],[-11,1],[-10,3],[-2,6],[-3,-2],[-4,1],[-4,1],[-2,3],[0,4],[2,2],[5,4],[5,6],[3,2],[3,2],[5,-1],[10,-3],[4,-2],[-2,-1],[-2,-6],[4,1],[2,2],[4,4],[-3,3],[-5,3],[-5,2],[-4,1],[-2,2],[2,5],[2,6],[1,3],[13,5],[5,0],[3,-3],[-1,-6],[1,-5],[4,2],[2,2],[1,6],[2,2],[2,2],[3,-1],[5,-1],[4,-2],[2,-10],[3,-3],[0,3],[1,3],[3,1],[3,0],[0,-2],[4,-8],[2,-3],[-7,-5],[-19,-3],[-6,-7],[22,5],[5,1],[2,1],[3,0],[4,-2],[0,-1],[-1,-1],[1,-3],[7,-7],[10,-6],[11,-2],[11,2],[-22,2],[-4,2],[-3,4],[-5,10],[8,4],[23,-3],[9,2],[-6,2],[-13,-1],[-6,1],[-5,4],[2,3],[6,1],[8,1],[4,1],[3,1],[2,-1],[5,-2],[2,-1],[12,1],[4,1],[3,3],[-11,0],[-3,0],[-3,2],[-3,2],[-3,2],[1,1],[6,2],[5,2],[4,4],[4,5],[-5,-3],[-9,-2],[-5,-2],[-3,-2],[-2,-2],[-2,-2],[-3,-1],[-3,0],[-5,1],[-2,0],[-3,0],[-7,-2],[-2,-2],[-2,-1],[-2,0],[-3,1],[-2,1],[-3,3],[-2,5],[-1,7],[-1,4],[-6,-3],[-5,0],[-5,2],[-5,5],[-4,6],[2,3],[13,3],[-2,3],[-3,0],[-4,0],[-3,0],[-2,2],[-1,3],[-1,2],[-2,0],[0,-3],[-5,-6],[-5,-4],[-5,10],[0,2],[4,1],[2,2],[2,3],[3,6],[3,4],[4,2],[10,3],[-2,5],[5,4],[7,4],[3,5],[6,14],[3,-1],[2,-2],[3,-2],[2,-2],[1,5],[1,2],[2,1],[2,-1],[5,-5],[1,-1],[2,1],[0,2],[-1,3],[1,2],[2,1],[3,0],[6,0],[2,-3],[2,-16],[2,-5],[4,-5],[3,-4],[2,0],[0,1],[1,2],[1,2],[-2,2],[-3,5],[-3,5],[-1,3],[1,9],[1,4],[4,3],[5,2],[5,0],[4,-1],[2,0],[1,2],[1,1],[2,0],[2,1],[1,-1],[3,-5],[4,-10],[3,-5],[1,7],[0,3],[-4,8],[-1,5],[-2,0],[-13,2],[23,25],[2,3],[2,5],[-2,4],[-17,9],[-5,2],[-5,0],[-9,-4],[-4,0],[-4,2],[-4,3],[-12,15],[-1,4],[2,3],[5,3],[2,0],[3,0],[2,0],[1,3],[0,2],[1,1],[2,2],[2,1],[0,2],[-10,-3],[-3,-1],[-2,-2],[-5,-4],[-3,-1],[-5,1],[-5,9],[-5,2],[1,3],[3,1],[1,1],[1,2],[-1,4],[-2,0],[-3,0],[-4,0],[-1,1],[-2,0],[-1,1],[-1,2],[0,2],[-2,-1],[-1,-1],[0,-1],[-24,0],[-3,1],[-6,2],[-9,2],[-17,6],[0,-2],[17,-8],[10,-2],[-1,-3],[-5,-3],[-5,-1],[-15,1],[-3,1],[-3,2],[-3,1],[-3,0],[-2,-2],[-1,-2],[1,-3],[1,-3],[-1,-3],[-1,-2],[-5,-3],[29,4],[4,-1],[6,-5],[4,-1],[9,2],[4,0],[-10,-12],[-16,1],[-17,5],[-14,-2],[-3,2],[-2,3],[-2,3],[-1,2],[-2,2],[-9,6],[-6,2],[-3,2],[-1,2],[-1,4],[-2,2],[-2,0],[-3,-3],[2,0],[-4,-7],[-2,-2],[-3,2],[-6,5],[-1,1],[-13,6],[-1,0],[-11,2],[-2,1],[0,2],[0,3],[0,3],[-14,15],[-2,5],[2,5],[4,5],[8,5],[2,4],[2,3],[2,4],[4,2],[5,1],[4,2],[2,4],[-1,5],[-1,3],[0,3],[2,6],[-7,-4],[-6,-10],[-6,-7],[-8,1],[-6,-11],[-8,-8],[-21,-11],[-2,7],[0,2],[-6,-7],[-3,-2],[-4,-1],[-14,-1],[-3,-1],[0,-1],[0,-1],[0,-1],[-1,-1],[-10,1],[-2,1],[-1,1],[-1,4],[-3,0],[-3,-3],[-2,-2],[-29,-8],[-3,-1],[-2,-2],[-2,-1],[-1,-1],[-1,-2],[0,-2],[0,-1],[-1,-1],[0,-2],[-3,-2],[-7,-4],[-3,-3],[7,-4],[8,6],[7,11],[6,5],[18,0],[5,-2],[4,-2],[2,-2],[-2,-1],[-6,0],[2,-4],[-2,-4],[-3,-3],[-3,-1],[18,-1],[3,-1],[1,-7],[-4,-5],[-5,-5],[-3,-4],[9,3],[5,0],[5,-1],[1,-3],[0,-3],[-1,-6],[-2,0],[-12,-8],[-3,0],[-10,-3],[-12,-1],[-8,0],[-4,2],[-3,8],[0,1],[-2,1],[-6,2],[-2,1],[-4,2],[-2,2],[0,2],[0,5],[0,3],[-2,3],[-11,9],[-1,11],[1,23],[1,4],[2,3],[5,3],[3,4],[3,4],[3,3],[5,1],[10,0],[3,0],[2,1],[2,2],[2,1],[3,0],[-4,5],[-2,4],[1,1],[16,0],[4,1],[2,3],[1,3],[2,2],[3,1],[7,0],[4,1],[0,2],[-6,4],[-1,2],[3,3],[10,9],[3,1],[5,1],[4,2],[3,3],[3,1],[3,-1],[4,-2],[3,-4],[1,-4],[2,18],[2,1],[0,3],[0,3],[1,2],[1,0],[2,1],[2,0],[1,-2],[5,-5],[11,-6],[11,-3],[7,4],[-7,1],[-11,4],[-6,0],[-2,2],[1,5],[3,4],[6,2],[0,2],[-3,1],[-1,3],[0,3],[2,3],[3,3],[5,1],[5,0],[5,0],[5,-4],[5,-6],[6,-5],[7,-1],[-5,6],[-2,5],[0,4],[8,7],[1,2],[2,7],[5,1],[3,0],[3,-1],[6,-5],[7,-7],[3,-3],[4,0],[-2,4],[-1,1],[2,2],[2,1],[2,0],[2,0],[-4,3],[-7,3],[-3,3],[-2,5],[1,3],[2,3],[0,4],[7,10],[2,2],[17,1],[-1,3],[-1,0],[-2,0],[-2,-1],[-3,1],[0,2],[3,4],[1,2],[1,1],[1,1],[-1,2],[-1,2],[-1,2],[0,4],[8,26],[6,5],[5,2],[4,-2],[3,-4],[2,-2],[2,1],[4,3],[5,1],[3,-4],[1,-8],[-4,-7],[3,-1],[4,1],[3,-1],[2,-2],[0,-4],[1,0],[2,1],[1,0],[3,0],[1,0],[1,0],[2,-2],[2,-3],[-1,-3],[-1,-2],[0,-3],[-1,-3],[-3,-2],[-1,-3],[1,-3],[3,-1],[3,2],[2,2],[1,1],[0,3],[2,2],[1,1],[1,2],[1,3],[0,3],[1,2],[3,1],[0,2],[-6,3],[-5,6],[-4,7],[-1,8],[2,-1],[2,0],[4,-1],[-4,4],[-2,3],[3,2],[13,2],[7,3],[4,-1],[3,-2],[1,-2],[0,-4],[1,-2],[2,0],[2,1],[2,2],[2,1],[23,6],[4,0],[4,-1],[12,-10],[-3,-5],[-5,-3],[-2,0],[-2,-1],[-4,-2],[-5,-1],[2,0],[15,-4],[-1,-2],[-1,-2],[-2,-1],[-2,-2],[0,-1],[15,2],[5,-2],[-1,-9],[-4,-4],[-6,-4],[-7,-2],[-7,-1],[0,-1],[4,-2],[11,2],[4,-2],[0,-3],[-3,-13],[-4,-5],[-12,-9],[7,1],[7,4],[7,5],[3,5],[2,13],[-1,2],[-2,2],[0,4],[2,4],[4,0],[1,-2],[1,-3],[1,-2],[11,-6],[1,-2],[2,-6],[0,-3],[0,-3],[-5,-8],[-7,-8],[-10,-6],[-30,-12],[-16,-3],[-12,-5],[-6,-1],[-5,2],[-8,6],[-5,1],[-2,1],[-13,12],[-2,1],[0,-7],[6,-4],[13,-8],[2,-2],[3,-1],[3,-2],[4,-1],[3,0],[36,5],[26,10],[6,3],[2,-2],[-3,-4],[-4,-5],[8,-3],[-1,-7],[-8,-13],[4,2],[5,6],[3,1],[4,0],[16,-4],[2,-3],[3,-3],[3,-2],[3,-1],[11,-1],[-23,20],[-3,4],[1,5],[-5,2],[-10,1],[-1,4],[2,4],[3,5],[3,4],[4,2],[6,1],[11,1],[3,-1],[3,-4],[3,-7],[7,-6],[7,-3],[6,-4],[2,-10],[-2,-12],[-5,-11],[-7,-9],[-8,-9],[-13,-9],[-2,-4],[-1,-4],[-11,-10],[-4,-6],[2,-1],[4,-1],[9,-7],[6,-2],[6,1],[5,1],[5,5],[3,5],[1,6],[5,7],[1,2],[2,1],[2,-1],[3,-2],[1,-2],[3,-5],[1,3],[0,4],[-2,3],[-1,1],[-4,1],[0,4],[3,7],[3,6],[12,12],[4,4],[12,6],[5,4],[4,2],[16,1],[6,2],[-10,0],[-5,1],[-3,2],[-1,5],[2,3],[2,3],[2,3],[5,15],[4,5],[7,1],[-2,2],[14,19],[4,3],[11,4],[3,4],[-4,1],[-5,1],[-6,-1],[-5,-2],[-3,-5],[-6,-10],[-25,-29],[-8,-4],[0,-2],[3,-5],[-6,-8],[-15,-12],[-3,8],[3,9],[5,8],[8,2],[-3,6],[1,8],[3,8],[2,8],[0,5],[-1,3],[-6,5],[0,2],[0,12],[-1,3],[-1,1],[0,1],[3,3],[6,4],[0,1],[0,3],[3,8],[5,4],[7,2],[8,1],[-3,1],[-3,2],[-3,2],[-1,3],[1,4],[4,4],[2,2],[31,26],[10,4],[37,3],[2,1],[1,2],[-1,2],[-2,-1],[-23,3],[-3,1],[-1,2],[-1,2],[-2,3],[-1,-1],[-6,-3],[-2,-2],[-3,-1],[-9,-1],[-2,-2],[-11,-14],[-3,-4],[-6,-2],[-5,-2],[-7,-9],[-6,-1],[2,8],[2,7],[1,16],[1,7],[5,13],[2,12],[2,8],[1,8],[1,3],[2,2],[2,2],[6,5],[7,3],[5,-1],[2,-8],[2,0],[2,16],[1,3],[5,2],[4,-1],[7,-6],[0,4],[-1,6],[0,4],[3,2],[2,0],[5,2],[2,1],[3,0],[1,0],[2,1],[1,2],[5,2],[4,0],[3,-3],[3,-4],[1,-2],[1,-4],[1,-3],[2,-1],[5,-2],[8,-6],[4,-2],[5,-1],[5,-1],[7,-8],[5,-1],[21,-4],[10,0],[0,5],[5,4],[2,3],[-1,3],[-3,3],[-3,1],[-4,1],[-4,-1],[-2,-1],[-3,-2],[-2,-1],[-4,-1],[-3,1],[-6,1],[-23,12],[-23,19],[-9,6],[-9,3],[-10,-3],[-7,-7],[-4,-1],[-7,-1],[-5,0],[-7,1],[-5,3],[-3,3],[0,5],[1,7],[2,5],[3,2],[12,-1],[7,1],[5,4],[0,4],[4,2],[3,2],[-3,5],[-4,4],[-1,2],[0,2],[0,2],[0,1],[-4,0],[-4,2],[-3,3],[-3,5],[-2,4],[0,6],[2,4],[3,4],[3,2],[5,2],[27,-2],[3,0],[2,1],[5,3],[2,1],[5,1],[10,-2],[4,2],[4,5],[12,9],[6,6],[2,1],[9,0],[5,1],[5,2],[24,21],[11,4],[9,-2],[0,3],[4,4],[0,2],[0,2],[-4,4],[0,2],[-1,5],[0,2],[5,6],[1,2],[4,14],[1,5],[1,4],[2,3],[6,3],[6,3],[5,1],[-5,10],[1,11],[5,21],[-1,-2],[-3,-6],[-1,0],[-4,-5],[0,-1],[-3,-2],[-1,-1],[-3,0],[-1,-1],[1,-5],[0,-2],[-3,-4],[-3,-9],[-3,-2],[-5,-1],[-3,2],[-1,3],[-1,5],[-2,3],[-5,3],[-5,2],[-4,0],[-1,1],[-5,5],[-3,1],[-17,8],[-2,2],[0,5],[2,3],[-1,3],[-3,4],[-5,2],[-12,2],[-9,4],[-25,4],[-3,1],[-2,2],[-2,2],[-1,2],[1,1],[12,4],[4,6],[1,1],[0,7],[-2,3],[-3,0],[-3,-8],[-5,-3],[-6,-2],[-5,0],[-6,1],[-5,1],[-4,4],[-1,5],[1,8],[2,3],[3,1],[5,-2],[2,-1],[1,-2],[1,0],[1,4],[0,9],[1,2],[3,2],[4,0],[3,0],[1,-1],[2,-4],[2,-2],[6,-2],[2,2],[0,5],[-1,2],[-3,3],[-1,6],[0,10],[2,5],[2,4],[6,6],[3,2],[1,0],[2,1],[2,4],[0,2],[0,2],[0,3],[1,3],[6,9],[3,5],[1,6],[0,3],[2,-1],[3,-3],[1,-2],[0,-3],[1,-2],[4,-1],[4,4],[5,4],[7,3],[6,-1],[1,-2],[1,-3],[2,-2],[3,-2],[3,1],[1,1],[0,2],[-4,6],[-2,4],[0,5],[0,6],[2,4],[0,3],[-1,3],[-2,0],[-1,-3],[0,-4],[-1,-2],[-1,-3],[-1,-2],[-1,-3],[-2,-2],[-3,0],[-6,0],[-2,0],[-3,-1],[-3,-2],[-3,0],[-2,1],[-2,5],[-2,1],[-6,0],[-5,2]],[[8460,3279],[10,3],[14,6],[3,2],[3,0],[5,-2],[3,-1],[1,0],[2,1],[1,3],[1,2],[0,3],[1,2],[1,2],[3,2],[2,1],[1,0],[1,-1],[1,-2],[2,-3],[6,-13],[1,-2],[2,-2],[4,-2],[6,-2],[22,-3],[3,-1],[2,-1],[3,-2],[3,-1],[5,-1],[4,-1],[4,1],[3,1],[17,8],[5,2],[9,1],[4,0],[4,-1],[3,-2],[3,-2],[9,-8],[4,-2],[1,-1],[0,-2],[-1,-2],[-2,-3],[0,-2],[1,-1],[2,-3],[3,-2],[6,-3],[4,-2],[3,-3],[3,-3],[3,-4],[1,-2],[5,-6],[3,-2],[5,-2],[4,-1],[28,0],[40,-11],[12,-11]],[[8087,3324],[7,-6],[9,-5],[5,-8],[-4,-2],[-22,-1],[-12,-4],[-4,-4],[-4,-2],[-4,1],[-4,4],[-6,6],[1,4],[-3,6],[0,6],[0,3],[4,-1],[6,-3],[5,1],[4,2],[1,3],[-1,4],[1,2],[6,-1],[4,-2],[4,-3],[7,0]],[[9470,0],[-3,0],[0,1],[2,0],[1,-1]],[[9468,3],[1,-1],[-2,0],[-2,2],[1,1],[1,-1],[1,-1]],[[9805,178],[2,-3],[4,-1],[3,-2],[0,-2],[-2,-4],[1,0],[3,-1],[1,0],[-5,-5],[-8,2],[-14,6],[-4,1],[-2,2],[-1,2],[-2,3],[-3,1],[-7,-1],[-3,1],[3,4],[5,1],[5,1],[18,-3],[6,-2]],[[9844,156],[-3,0],[-3,1],[-2,1],[-4,4],[-2,1],[-4,2],[-1,1],[-1,3],[1,3],[1,3],[2,2],[4,4],[4,2],[5,1],[5,-2],[-1,-1],[0,-1],[-1,-1],[-1,0],[-1,-4],[0,-4],[2,-5],[2,-4],[2,-3],[-2,-2],[-2,-1]],[[9733,184],[3,-2],[7,1],[2,0],[1,-2],[2,-1],[1,2],[4,1],[2,-2],[-1,-3],[1,-4],[-8,4],[-6,-3],[0,-4],[-3,-9],[-6,-2],[-6,4],[-3,-2],[0,-4],[-3,-3],[-4,1],[-2,3],[1,4],[2,4],[1,3],[-4,0],[-4,-1],[-2,1],[-3,-2],[-2,-3],[0,-3],[-4,1],[-5,3],[3,2],[-1,1],[-2,2],[-3,2],[-2,-3],[-4,-2],[-5,-1],[-1,-2],[-1,-5],[-5,2],[-3,3],[-4,-1],[-5,0],[-7,2],[1,3],[-2,3],[-1,4],[3,2],[6,1],[6,0],[5,2],[6,1],[3,-2],[6,-1],[7,0],[5,0],[5,0],[5,2],[3,-1],[9,-1],[8,-4],[5,1],[-2,4],[-4,3],[0,2],[5,-1]],[[9828,191],[-3,-1],[-2,-1],[-3,1],[-3,1],[-2,-4],[-4,-1],[-2,2],[1,5],[5,2],[6,1],[5,-1],[2,-4]],[[9782,239],[-1,-1],[-1,0],[4,-1],[0,-2],[-1,-4],[1,-3],[4,-3],[2,-2],[-4,-2],[-3,-3],[-2,-3],[-1,-6],[3,-1],[19,-1],[0,-1],[-2,-4],[-1,-1],[1,-2],[3,-1],[2,-1],[1,-2],[-3,-4],[-6,-1],[-7,-1],[-5,-2],[0,6],[0,3],[-3,1],[-5,1],[-2,1],[-1,1],[-1,0],[-2,0],[-5,-4],[-2,-1],[-3,0],[-2,1],[-1,2],[-2,2],[-2,0],[-9,0],[-4,0],[-5,2],[-4,2],[-3,3],[0,2],[7,0],[3,12],[8,2],[3,-1],[6,-4],[4,-1],[3,-2],[2,-3],[2,-3],[3,2],[0,3],[1,10],[-2,3],[-3,2],[-2,2],[-1,3],[1,4],[3,2],[14,3],[2,0],[-1,-3],[0,-1]],[[9698,232],[-3,-1],[-2,1],[0,3],[1,3],[2,2],[2,0],[3,1],[3,1],[1,2],[1,2],[0,3],[-2,2],[-1,1],[-1,2],[-1,5],[1,2],[2,2],[1,1],[2,0],[1,1],[2,0],[1,0],[1,-1],[3,-1],[6,-4],[5,-5],[2,-6],[-2,-4],[1,-2],[1,-2],[-7,0],[-10,-6],[-13,-2]],[[9247,297],[4,-3],[1,-3],[-5,1],[-7,3],[-4,-1],[1,-2],[7,-4],[-4,-2],[-4,0],[-23,0],[2,2],[1,2],[2,2],[2,1],[-2,4],[-5,8],[21,-3],[9,-3],[4,-2]],[[9180,314],[-8,-7],[-1,-2],[0,-7],[-1,-1],[-4,-3],[-3,4],[-2,5],[-3,2],[1,1],[1,1],[1,0],[0,2],[-5,2],[-4,0],[-5,0],[-5,5],[3,0],[6,1],[4,0],[2,-1],[5,-3],[2,-1],[10,5],[5,1],[1,-4]],[[9889,305],[-10,0],[-29,2],[3,5],[-1,2],[-3,1],[-2,4],[1,3],[3,3],[4,3],[3,2],[8,2],[27,-1],[3,0],[2,-2],[1,-2],[0,-2],[1,-2],[-1,-1],[-1,-1],[6,-3],[-2,-5],[-7,-5],[-6,-3]],[[9987,344],[3,0],[5,0],[3,-1],[1,-4],[-4,-2],[-8,-2],[-2,-3],[-5,-8],[-3,-1],[-5,-1],[-8,-4],[-4,-1],[-1,1],[-1,2],[-2,1],[-3,-2],[-3,0],[-1,2],[-2,2],[0,3],[0,5],[2,4],[1,3],[3,2],[12,4],[5,3],[3,2],[2,0],[4,0],[5,-4],[3,-1]],[[9904,374],[5,-13],[-10,2],[-18,11],[-14,4],[-11,5],[-7,2],[-1,1],[0,2],[1,2],[4,3],[6,-1],[10,-3],[20,-3],[6,-2],[5,-4],[4,-6]],[[9552,391],[2,-3],[2,-5],[0,-4],[-2,-5],[-3,-2],[-6,-1],[-4,3],[-5,3],[-4,2],[-2,0],[-1,-2],[1,-3],[2,-4],[-12,-6],[-7,-2],[-4,0],[-4,4],[-6,5],[-7,2],[-5,-3],[1,-2],[3,-1],[3,-1],[3,-1],[1,-3],[2,-3],[0,-3],[-2,-2],[-3,0],[-6,-3],[-3,0],[-4,0],[-11,3],[-14,2],[-9,3],[-3,1],[-5,1],[-15,9],[-17,6],[-7,1],[-2,3],[-6,4],[-5,2],[-3,-7],[1,-4],[3,-1],[3,1],[3,0],[4,-1],[1,-1],[1,-2],[2,-3],[4,-3],[5,-3],[37,-14],[6,-1],[19,0],[17,-2],[5,-2],[5,-2],[35,3],[7,-1],[6,-7],[14,-2],[5,-3],[-3,1],[-9,-2],[21,-6],[4,0],[2,-1],[1,-2],[0,-3],[-2,-2],[-3,0],[-3,0],[-8,3],[-2,-1],[-2,-1],[-3,-1],[-29,-2],[-5,2],[-3,0],[-2,-1],[-1,-2],[-2,-2],[-3,0],[-22,-1],[-5,2],[-3,3],[-5,8],[-3,1],[-9,1],[-5,-1],[-5,-3],[10,1],[5,0],[2,-4],[-1,-1],[-1,-1],[0,-2],[5,-1],[2,-1],[1,-1],[-1,-2],[4,-2],[6,-1],[11,1],[-3,-2],[-3,-2],[-2,-2],[-2,-3],[4,0],[17,7],[5,1],[10,1],[5,-1],[4,-1],[1,-1],[1,-1],[2,-1],[3,0],[5,1],[3,-1],[2,-2],[1,-3],[0,-2],[-1,-2],[0,-2],[3,-3],[2,1],[3,2],[3,2],[3,0],[2,0],[2,-1],[4,-4],[2,0],[2,1],[3,0],[10,0],[5,-2],[0,-4],[-1,-2],[0,-1],[0,-2],[0,-1],[-1,-2],[-4,-1],[-1,-2],[5,-2],[18,2],[5,-2],[-2,-4],[-7,-6],[-1,-5],[2,-2],[4,-2],[5,-3],[2,-2],[0,-2],[1,-2],[3,-2],[3,0],[8,0],[3,-2],[-3,-1],[-2,-2],[-1,-3],[-2,-2],[-4,-4],[-2,-2],[-2,-3],[8,0],[4,-1],[-1,-3],[-1,0],[-10,-5],[-6,-4],[-3,-1],[-4,0],[-2,1],[-4,4],[-4,4],[-2,2],[-2,3],[0,1],[2,3],[0,1],[-1,2],[-2,2],[0,1],[1,5],[-1,2],[-2,0],[-3,0],[-8,-5],[-6,-1],[-7,0],[-5,2],[1,5],[7,8],[1,5],[-1,4],[-4,2],[-13,3],[-3,3],[-3,5],[-6,-2],[-11,-6],[-7,0],[-10,4],[-9,4],[-4,6],[0,5],[0,2],[-1,0],[-3,0],[-1,0],[-1,-2],[-1,-1],[-2,0],[-1,1],[0,3],[-1,2],[-3,1],[0,-4],[0,-4],[1,-3],[2,-3],[-19,1],[-6,-2],[-5,0],[-10,10],[-6,1],[6,-7],[1,-3],[-7,0],[6,-5],[2,-3],[-3,-1],[-5,0],[-7,-3],[-5,0],[-3,1],[-4,3],[-4,3],[-1,2],[-1,3],[-6,2],[-3,2],[-5,4],[-1,2],[2,4],[2,1],[12,4],[5,1],[13,-1],[13,2],[4,0],[-3,1],[-10,4],[0,2],[11,5],[-6,0],[-38,-12],[-3,-1],[-2,2],[2,2],[9,7],[2,2],[2,0],[2,1],[1,3],[-1,4],[1,3],[2,2],[7,6],[-1,2],[-1,1],[-1,1],[1,3],[2,2],[3,1],[3,1],[1,1],[4,5],[2,1],[-6,0],[-18,-9],[-10,-2],[-3,-1],[-1,-5],[-1,-1],[-2,-1],[-2,-1],[-12,1],[-4,2],[-8,8],[-2,2],[-2,1],[-2,2],[-2,2],[0,4],[1,5],[-1,4],[-6,-6],[1,-7],[5,-6],[3,-6],[-5,-1],[-8,1],[-6,3],[-5,4],[-1,3],[-2,3],[-1,4],[0,3],[-1,2],[-2,1],[-1,2],[2,5],[-2,-1],[-4,-2],[-2,-1],[-11,1],[-7,-4],[-15,-1],[-5,-1],[4,-1],[8,2],[5,0],[3,-2],[11,0],[4,-1],[-2,-1],[-1,0],[2,-4],[4,-6],[2,-5],[-7,2],[-6,-1],[-13,-4],[-7,-1],[-4,0],[-2,2],[-1,2],[-3,1],[-4,-1],[-3,-1],[0,-2],[2,-1],[2,-3],[2,-2],[1,-1],[0,-2],[0,-2],[0,-2],[-2,-3],[3,1],[4,3],[3,1],[2,1],[3,-1],[3,-2],[3,-1],[2,-2],[1,-1],[2,-1],[3,-1],[3,0],[3,1],[3,0],[4,-1],[-2,-2],[-4,-1],[-3,-1],[0,-2],[3,0],[0,-1],[0,-2],[-1,-2],[4,-1],[7,0],[5,-1],[-1,-4],[-8,-4],[-5,-4],[0,-3],[2,-1],[6,1],[3,0],[1,-2],[1,-1],[1,-2],[2,-1],[6,3],[2,1],[7,-1],[7,-1],[-8,-5],[-2,-2],[1,-2],[5,-2],[1,-2],[-3,-5],[-6,2],[-9,9],[-5,0],[-12,-5],[-4,1],[-3,1],[-2,2],[-2,2],[0,4],[0,8],[0,3],[-4,5],[-3,-1],[-2,-3],[-1,-5],[0,-6],[-1,-6],[-2,-5],[-3,-2],[-5,2],[-1,4],[1,11],[-3,6],[-13,0],[-3,3],[4,4],[24,5],[-4,2],[-16,-2],[0,2],[1,1],[3,2],[-6,1],[-4,-2],[-3,-4],[-5,-1],[-14,0],[-6,1],[4,2],[2,1],[-1,2],[-2,3],[-3,1],[-8,-1],[-3,1],[-2,1],[-3,2],[-2,1],[-4,1],[-14,0],[2,3],[4,1],[4,0],[3,0],[14,4],[5,1],[19,0],[-6,2],[-5,0],[-13,0],[-1,1],[1,2],[3,4],[4,2],[22,6],[3,1],[7,5],[1,2],[-2,0],[-10,0],[-4,-2],[-9,-6],[-4,-1],[-4,0],[-2,1],[-2,0],[-3,-2],[-1,-2],[0,-1],[-1,-2],[-3,-1],[-6,-2],[-30,-4],[-5,1],[1,5],[-3,1],[-8,1],[-3,1],[11,1],[6,1],[4,4],[-14,0],[-4,1],[2,3],[14,4],[-6,1],[-21,1],[-6,-1],[-4,-1],[-4,1],[-3,3],[0,2],[2,1],[8,7],[3,-3],[2,0],[2,2],[3,8],[2,2],[12,4],[15,0],[11,3],[29,0],[7,3],[7,0],[3,-7],[1,-8],[2,-7],[-5,-7],[10,2],[1,6],[-2,9],[1,9],[-1,4],[4,1],[11,0],[8,4],[2,0],[3,-1],[0,-3],[-2,-2],[-3,-1],[4,-2],[3,1],[3,1],[3,2],[4,-1],[7,-2],[3,-1],[-2,3],[-10,6],[14,6],[8,2],[8,-1],[9,-6],[4,-1],[3,1],[-1,2],[-3,2],[-3,2],[7,-1],[13,1],[7,0],[8,-3],[3,0],[2,0],[4,4],[3,1],[41,0],[23,8],[12,2],[25,0],[3,1],[6,2],[3,1],[3,0],[17,-3],[5,-2],[3,-2],[7,-7],[7,-4]],[[9677,413],[19,-6],[5,1],[6,2],[6,1],[44,-1],[37,-1],[19,-5],[9,-5],[8,-7],[8,-10],[4,-3],[4,-3],[4,-4],[2,-6],[0,-2],[0,-5],[0,-3],[-1,-3],[-4,-5],[-1,-3],[-2,-3],[-32,-26],[-10,-4],[-19,1],[-15,2],[-4,3],[-3,2],[-1,1],[-2,1],[0,3],[1,4],[5,3],[2,3],[-5,9],[-13,2],[-16,-1],[-9,-3],[-3,-3],[-2,-3],[-3,-8],[-1,-3],[1,-1],[-1,-1],[-4,0],[-3,0],[-8,1],[-5,1],[-16,-2],[-4,0],[-15,5],[5,3],[29,-1],[-5,3],[-18,4],[-6,2],[-5,6],[-3,2],[-2,-1],[0,-3],[-2,-3],[-2,0],[-2,4],[-1,0],[-5,-8],[-7,-3],[-22,-2],[-7,0],[-5,3],[-5,6],[1,2],[3,1],[5,3],[-7,3],[-2,2],[-2,2],[-6,11],[0,2],[1,1],[1,4],[1,1],[2,3],[1,1],[0,2],[-1,1],[-1,2],[-1,10],[-2,5],[-4,0],[-5,-3],[-9,-1],[-9,0],[-6,1],[-4,3],[-3,6],[-1,6],[4,3],[21,-1],[7,1],[1,1],[1,1],[1,1],[63,1],[31,-2]],[[9050,403],[-1,-10],[-4,-2],[-11,3],[-5,0],[0,-4],[-15,0],[-7,2],[-7,3],[-2,-6],[0,-2],[3,-1],[4,0],[11,-4],[20,0],[2,1],[3,3],[3,0],[5,0],[3,0],[2,-2],[-1,0],[-3,-1],[-2,-1],[5,-2],[6,-2],[14,-1],[2,1],[5,4],[3,0],[12,1],[4,-1],[4,-4],[-5,-2],[-7,-2],[-3,-1],[1,-3],[8,0],[2,-1],[0,-3],[2,-1],[2,-1],[2,-3],[-10,-3],[-6,-1],[-3,4],[-2,4],[-4,3],[-6,2],[-4,0],[5,-7],[-4,0],[-5,1],[-4,-1],[2,-5],[4,-3],[10,-2],[3,-4],[-4,-2],[-9,-1],[-4,0],[-4,-3],[-4,-5],[-4,-1],[2,6],[-2,5],[-4,2],[-6,1],[-2,-2],[6,-8],[-1,-4],[-5,-1],[-3,3],[-1,6],[-1,5],[1,4],[3,4],[4,2],[5,1],[0,2],[-8,2],[-3,2],[-3,8],[-4,2],[-4,1],[-2,-3],[2,0],[1,0],[3,-3],[-2,-1],[-5,0],[-2,0],[-1,0],[-1,1],[-2,0],[0,-1],[1,-2],[-1,-1],[-5,-5],[-2,-2],[-5,0],[0,-3],[-4,1],[-4,3],[-3,3],[4,3],[1,5],[-1,4],[-6,0],[-3,-1],[-1,-2],[-3,-2],[-3,0],[-1,-1],[-1,-1],[-1,-1],[-1,-1],[-2,1],[-1,1],[-1,1],[0,1],[-2,0],[-2,2],[-2,1],[-3,0],[-3,-1],[-4,-3],[-3,-1],[-4,1],[-2,1],[-5,3],[-4,3],[-3,1],[-4,0],[0,2],[4,1],[0,2],[-1,3],[1,3],[4,1],[10,-1],[3,3],[-8,1],[-9,2],[-5,3],[6,5],[5,0],[9,-1],[5,1],[3,1],[3,2],[4,1],[3,-1],[-4,-6],[1,-2],[4,-1],[6,1],[2,0],[4,-3],[-1,6],[1,2],[-1,3],[1,0],[1,1],[2,-1],[1,-1],[1,-1],[2,0],[3,-3],[2,0],[3,0],[2,-1],[2,-1],[1,-2],[4,2],[3,0],[7,-2],[20,0],[0,2],[-10,1],[-3,1],[2,3],[4,2],[10,2],[13,7],[23,0],[10,2],[8,-2],[0,-2],[-30,-8],[-11,-1],[-3,-2]],[[9281,414],[-2,-5],[-3,-3],[1,-2],[3,0],[3,0],[2,1],[7,7],[4,3],[5,1],[6,0],[6,-2],[11,-4],[6,-1],[15,-1],[15,-6],[2,0],[-11,-4],[-12,0],[-22,4],[4,-4],[2,-2],[-2,-1],[-7,-1],[-13,-3],[-4,0],[-3,1],[-4,4],[-3,1],[-3,-1],[3,-4],[-3,-3],[-6,-1],[-6,0],[-10,1],[-2,1],[-2,-1],[-4,-4],[-2,-1],[-33,-2],[-4,1],[-5,3],[-5,-4],[-6,-2],[-13,1],[0,1],[3,2],[1,2],[0,2],[0,3],[-2,3],[-3,1],[-3,1],[-3,1],[0,5],[8,2],[17,0],[0,1],[-15,5],[-4,2],[-1,5],[3,2],[5,2],[7,1],[3,1],[3,0],[3,-1],[5,-6],[4,-2],[2,-3],[0,-5],[1,-4],[2,2],[3,2],[3,1],[4,-3],[2,0],[2,0],[1,2],[-1,2],[-7,4],[3,2],[2,0],[3,0],[2,-2],[-3,4],[-2,1],[-2,1],[-7,0],[-4,1],[-1,2],[3,3],[7,1],[14,0],[36,-7],[2,-1],[-1,-3]],[[9072,429],[2,-3],[1,-2],[-1,-1],[-12,-2],[-13,0],[-17,-4],[-17,-1],[-5,1],[-4,2],[2,2],[-1,1],[-5,1],[-1,-1],[-1,-1],[-1,-1],[-2,-1],[0,1],[-3,3],[0,2],[8,3],[5,2],[3,-1],[5,-2],[4,2],[4,3],[3,1],[16,0],[27,-3],[3,-1]],[[8855,434],[5,-2],[3,-1],[3,1],[22,-2],[2,2],[3,2],[4,-1],[2,-1],[2,-1],[0,-1],[0,-3],[5,0],[11,-6],[4,1],[3,2],[5,2],[5,1],[3,0],[1,-4],[2,-2],[4,1],[3,1],[0,-4],[-2,-2],[-1,-2],[-1,-1],[2,-2],[7,0],[4,-1],[-4,-2],[-4,-1],[-9,1],[-2,0],[-1,1],[-2,1],[-2,0],[-2,-2],[-2,-2],[-1,-2],[-7,-2],[-12,4],[-8,0],[2,3],[4,2],[4,2],[4,0],[-4,3],[-3,1],[-14,-4],[-3,0],[-3,0],[0,2],[1,1],[-2,5],[1,1],[-1,1],[-3,1],[-9,-2],[-2,1],[-2,1],[-1,-1],[0,-3],[-1,-1],[-2,-1],[-3,0],[1,-4],[-1,-5],[-2,-5],[-3,-1],[-2,-1],[-1,-1],[-2,0],[-1,2],[-1,2],[1,1],[1,0],[1,2],[3,4],[0,2],[-3,1],[-8,-7],[-5,-4],[-2,1],[-1,7],[-2,2],[-3,3],[-5,3],[13,6],[-3,5],[3,2],[5,0],[4,0],[2,1],[3,-1]],[[8700,483],[5,-7],[2,-2],[3,-2],[3,-2],[2,-3],[4,2],[2,-3],[0,-5],[-1,-3],[-3,-2],[-4,-2],[-3,-1],[-4,0],[-3,1],[-2,1],[-1,3],[2,2],[2,2],[2,1],[0,2],[-1,3],[-7,6],[-3,4],[-2,2],[-2,1],[-3,-1],[-1,-3],[1,-2],[-1,-1],[-3,0],[-2,1],[-3,3],[-1,3],[4,3],[4,1],[8,1],[2,-1],[2,-1],[2,-1]],[[8480,532],[1,-2],[-3,-3],[-2,-5],[-3,-2],[-6,1],[-6,1],[-4,-2],[-7,0],[-3,2],[5,4],[6,4],[4,0],[15,3],[3,-1]],[[8624,562],[6,0],[3,-1],[1,-3],[-2,-5],[-6,1],[-6,3],[-5,-1],[1,-1],[3,-2],[1,-3],[-1,-1],[-7,0],[-2,1],[-1,1],[-1,1],[-1,1],[-5,-3],[-4,-11],[-5,-2],[-1,1],[-6,8],[-7,8],[-2,5],[10,-2],[-1,5],[13,-1],[4,1],[-1,5],[2,1],[2,1],[2,-1],[2,-1],[4,-1],[6,-3],[4,-1]],[[9078,598],[5,0],[12,1],[5,-1],[1,0],[3,-4],[1,-1],[3,-1],[5,0],[2,-1],[2,-4],[-3,-3],[-4,-3],[-2,-3],[-3,-1],[-17,2],[-4,1],[-5,3],[-13,2],[-5,1],[-5,3],[-4,4],[-4,4],[-2,5],[7,7],[9,-2],[16,-9]],[[8643,621],[4,-3],[-1,-4],[3,0],[2,-1],[4,-2],[0,-2],[-7,1],[-3,-1],[-2,-4],[1,-3],[1,-3],[-1,-3],[-3,-1],[-4,0],[-2,1],[-1,-1],[-2,-4],[1,-6],[0,-3],[-5,-1],[-6,2],[-7,6],[-5,-1],[-3,-3],[-1,-2],[-2,-2],[-4,0],[-4,0],[-4,1],[-6,2],[0,2],[2,1],[1,1],[2,3],[-8,4],[5,3],[12,5],[5,1],[12,0],[6,2],[3,5],[-8,0],[-3,0],[-3,-2],[0,5],[7,2],[9,0],[6,2],[-11,2],[-5,-1],[-2,1],[-3,1],[-2,1],[6,3],[7,4],[6,2],[4,-4],[4,-3],[5,-3]],[[9099,629],[1,-6],[-2,-9],[-6,-6],[-6,-1],[-13,1],[-14,7],[-11,8],[2,5],[6,1],[10,-4],[8,2],[10,2],[4,3],[7,1],[4,-4]],[[8414,636],[-2,-8],[5,1],[5,3],[5,1],[1,-5],[0,-1],[-1,-4],[0,-2],[1,0],[4,-1],[1,0],[-4,-6],[-6,1],[-7,3],[-5,0],[0,-4],[-6,0],[-8,2],[-2,2],[-1,2],[-1,3],[0,4],[-1,3],[-3,0],[-4,-1],[-1,-2],[-3,-1],[-8,0],[-8,1],[-5,1],[4,2],[7,2],[3,2],[5,5],[3,1],[5,1],[19,-2],[8,-3]],[[8813,650],[2,-1],[4,1],[0,2],[0,2],[1,2],[2,3],[0,2],[2,0],[3,1],[2,-2],[1,-2],[0,-4],[-1,-2],[2,-1],[3,-5],[4,-11],[5,-4],[4,5],[0,10],[-5,7],[6,2],[8,-2],[9,-4],[4,-5],[2,-3],[1,-7],[1,-3],[1,-3],[-2,-3],[-3,-3],[-1,-2],[4,1],[4,-3],[3,-4],[2,-5],[-1,-3],[0,-2],[1,-2],[3,-3],[2,0],[0,3],[-1,2],[0,4],[6,14],[2,3],[4,0],[0,-5],[-2,-12],[1,-1],[3,0],[3,1],[1,2],[0,10],[2,5],[4,4],[5,1],[5,0],[9,-5],[3,-3],[1,-1],[0,-6],[-2,-6],[-7,-9],[-2,-5],[3,0],[3,2],[4,6],[3,1],[2,-2],[0,-4],[-1,-3],[1,-3],[1,-3],[-2,-2],[-3,-1],[-4,0],[1,-1],[4,-2],[4,-4],[0,-2],[-4,-2],[-3,-2],[-3,-1],[-3,0],[-3,0],[1,-1],[2,-2],[1,-3],[-1,-2],[-2,-2],[-2,1],[-1,1],[-2,1],[-5,1],[-9,4],[-5,1],[2,-4],[2,-1],[6,-3],[7,-1],[1,-1],[0,-2],[-1,-2],[-1,-2],[-1,0],[-1,-1],[-1,-2],[-1,-2],[-1,-1],[-8,0],[-2,2],[-3,6],[-2,6],[-2,-3],[-2,-5],[0,-2],[-3,-1],[-3,2],[-5,4],[-13,7],[-8,1],[-4,1],[-2,4],[2,3],[3,0],[3,-1],[3,-1],[3,1],[1,2],[2,2],[3,1],[2,-1],[4,-2],[1,1],[2,1],[-1,1],[-2,1],[-1,1],[1,3],[5,3],[2,2],[-2,2],[-2,1],[-1,0],[-3,-1],[-3,-5],[0,-2],[-2,0],[-2,0],[-5,-3],[-3,1],[-2,4],[-2,3],[1,1],[0,1],[1,2],[-1,2],[-1,0],[-1,0],[-1,-2],[-1,-1],[-2,-7],[-7,0],[-7,3],[-5,4],[-3,8],[4,4],[7,2],[7,2],[-4,1],[-6,0],[-1,2],[0,1],[1,2],[1,1],[1,0],[-2,3],[-1,1],[0,-1],[-3,-5],[-7,0],[-7,0],[-4,-1],[1,-3],[4,-2],[1,-3],[-1,-1],[-3,-1],[-2,-2],[2,-6],[-3,-2],[-5,-1],[-1,-3],[-1,-9],[-8,3],[-3,3],[-2,4],[2,4],[3,3],[4,2],[2,3],[-9,-3],[-3,0],[-1,-2],[-1,-7],[-2,-2],[-7,1],[-3,3],[-2,4],[-4,5],[-3,5],[2,5],[5,4],[4,3],[9,4],[3,1],[1,3],[0,2],[-3,1],[-5,0],[0,8],[-4,8],[-2,8],[6,7],[5,2],[7,2],[6,0],[3,-5],[1,-2],[1,-3],[2,-2]],[[8734,676],[8,-9],[-2,-4],[-3,-6],[0,-4],[5,2],[0,1],[5,8],[3,7],[1,2],[2,0],[4,-3],[2,3],[4,0],[3,0],[7,-4],[7,-1],[3,-2],[-14,-11],[-5,-3],[-10,-2],[-3,-3],[1,-2],[6,1],[10,5],[4,-1],[2,-5],[-2,-6],[-5,-2],[-6,-1],[-5,-2],[3,0],[3,-1],[2,0],[2,-1],[-2,-6],[-1,-1],[5,0],[7,2],[6,1],[2,-4],[-2,-4],[-12,-11],[-12,-4],[-10,4],[-14,16],[-9,7],[-4,5],[1,2],[1,1],[-1,2],[-1,3],[-3,1],[-2,-1],[-1,-2],[-1,-3],[1,-3],[0,-3],[1,-2],[2,-2],[1,-2],[3,-9],[1,-2],[5,-4],[14,-8],[3,-4],[2,-4],[3,-4],[10,-3],[3,-3],[0,-3],[-4,-5],[-3,1],[-10,1],[-4,2],[-1,-4],[-2,-2],[-2,-2],[-3,-1],[2,-1],[7,-2],[-4,-4],[-2,0],[0,-2],[1,0],[5,-3],[-4,-2],[-4,1],[-5,1],[-4,1],[-10,0],[-6,0],[-4,2],[6,5],[6,14],[8,4],[-6,4],[-7,2],[-13,1],[-6,1],[-16,11],[4,2],[8,0],[4,2],[-4,1],[-5,1],[-10,-1],[2,5],[5,1],[12,0],[-3,1],[-5,2],[-3,1],[-1,2],[-1,6],[-1,2],[-4,-1],[-4,-3],[-8,-8],[-4,0],[-4,3],[-4,5],[-1,4],[5,13],[0,3],[-6,1],[-2,3],[-1,4],[-3,5],[-1,4],[7,1],[24,-2],[2,-2],[2,-3],[1,-3],[1,-2],[2,-2],[4,-1],[3,0],[2,2],[-1,2],[-2,2],[-4,3],[3,0],[3,0],[2,-1],[2,-3],[1,3],[-1,2],[0,2],[2,3],[3,2],[3,1],[1,3],[-1,4],[3,0],[3,0],[5,-2],[-2,2],[-1,2],[-3,2],[-2,1],[11,3],[10,-2],[9,-6]],[[9070,680],[-8,-4],[2,-5],[4,-4],[5,-2],[2,-2],[9,-11],[5,-7],[-1,-5],[-10,-6],[-13,-3],[-13,7],[-9,8],[-18,14],[-8,2],[-5,-3],[-1,-4],[9,-9],[9,-8],[6,-8],[1,-3],[-1,-3],[-1,-2],[-2,-1],[8,-5],[2,-4],[1,-6],[-1,-2],[-1,-2],[-1,-2],[0,-3],[1,-2],[2,-1],[3,-2],[2,-1],[-6,-1],[-13,2],[-21,6],[-32,20],[4,4],[-6,5],[-8,6],[-4,7],[0,7],[-3,13],[0,4],[2,3],[6,0],[-7,8],[-2,4],[5,2],[5,2],[-5,4],[6,1],[8,0],[7,2],[3,2],[14,-5],[10,-2],[9,-6],[7,2],[1,9],[-8,4],[-15,7],[-2,11],[1,1],[1,1],[0,2],[-1,1],[-1,1],[-1,2],[0,2],[0,1],[3,3],[8,1],[9,7],[4,2],[10,7],[4,7],[0,5],[3,4],[6,1],[5,-1],[4,-1],[2,-3],[2,-9],[-2,-8],[-3,-6],[1,-6],[6,-19],[5,-10],[-2,-6],[3,-11]],[[8310,769],[-3,-4],[-3,-1],[-9,1],[-6,0],[-1,-2],[0,-3],[-1,-4],[-4,-2],[-5,-1],[-5,-1],[-2,2],[1,4],[2,2],[3,2],[2,3],[-12,0],[-3,0],[-1,3],[2,2],[4,0],[3,1],[5,2],[-3,6],[-4,6],[2,3],[2,0],[2,-2],[2,-2],[1,-2],[1,-2],[2,-1],[19,-4],[5,-2],[4,-4]],[[8341,799],[2,0],[3,0],[5,3],[2,0],[13,1],[3,-1],[10,-3],[0,-2],[-15,-6],[-7,-4],[-5,-6],[3,-1],[1,1],[1,1],[3,1],[2,-1],[3,-4],[2,0],[2,-2],[10,-9],[-2,-3],[-3,-1],[-7,0],[-2,-1],[-4,-4],[-3,-2],[-6,1],[-3,4],[-2,6],[-3,5],[-2,-8],[-2,-1],[-4,0],[-4,5],[-1,1],[-12,2],[-3,1],[-6,7],[-4,2],[-13,5],[-4,0],[0,1],[-4,4],[-1,1],[0,3],[1,1],[4,-1],[3,-1],[18,-11],[2,0],[6,0],[4,0],[2,-1],[4,-3],[4,-2],[5,0],[2,2],[-7,3],[-3,2],[-3,2],[5,2],[5,0],[5,-1],[5,-1],[-3,3],[-12,5],[0,8],[2,2],[3,0],[2,-1],[3,-4]],[[8468,778],[2,-1],[2,2],[1,5],[0,4],[-1,4],[-2,3],[-3,2],[0,2],[7,-1],[11,-7],[5,3],[0,-7],[-1,-5],[-2,-5],[-2,-4],[-1,-3],[1,-2],[2,-1],[0,1],[1,3],[3,1],[3,0],[3,-1],[3,-5],[-1,-4],[-2,-5],[-3,-8],[-3,-3],[-1,-3],[1,-2],[1,-2],[3,-4],[1,-4],[1,-3],[3,1],[2,2],[0,3],[-2,6],[1,2],[2,2],[3,1],[1,2],[0,3],[4,6],[2,2],[0,7],[-2,4],[-3,3],[-2,7],[-4,3],[0,3],[1,2],[3,-2],[5,-4],[4,0],[3,-1],[3,-1],[1,-4],[2,-1],[2,-2],[6,-1],[-2,-6],[-1,-2],[4,-2],[9,-8],[3,-4],[1,-3],[0,-3],[-1,-2],[-3,-3],[-1,-3],[1,-3],[3,-2],[1,1],[1,0],[6,0],[3,1],[0,2],[-1,16],[-2,5],[-2,4],[-5,4],[0,2],[4,0],[23,-10],[3,-3],[3,-1],[8,4],[4,1],[4,0],[4,-3],[2,-3],[-1,-3],[1,-2],[5,-2],[4,-2],[-1,-5],[-3,-1],[-9,0],[-5,-1],[-2,-4],[0,-3],[2,-3],[9,-2],[0,-2],[-4,-7],[4,-2],[2,2],[2,3],[3,2],[0,2],[4,4],[4,3],[2,-1],[4,-5],[26,-5],[-9,-8],[1,-1],[10,0],[9,-3],[8,-5],[3,0],[-4,-3],[-10,-2],[-4,-1],[-2,-4],[1,-4],[-2,-5],[-5,-2],[-5,1],[-5,3],[-8,6],[-4,2],[-5,0],[-5,-4],[9,-3],[-1,-5],[3,-8],[-2,-5],[-8,6],[-6,3],[-2,-1],[1,-5],[2,-4],[4,-2],[4,-2],[-2,-3],[-2,-1],[-4,0],[-3,-1],[8,-3],[14,-3],[2,-3],[-1,-4],[-2,-4],[-3,-3],[-3,0],[-3,0],[-3,1],[-2,2],[-2,0],[-6,-2],[-2,-1],[-5,2],[-1,3],[1,9],[-3,-1],[-4,0],[-4,1],[-3,2],[-1,-3],[-1,-3],[-2,-4],[3,-2],[0,-4],[-2,-8],[-4,-6],[-7,1],[-8,5],[-5,5],[1,2],[1,3],[-1,3],[-2,1],[-2,-1],[-1,-2],[-1,-3],[-1,-1],[-5,-5],[-3,-2],[-3,0],[-1,-1],[0,-1],[-1,-2],[1,-1],[0,-2],[-1,0],[-3,1],[-14,2],[-2,-1],[-5,-8],[-6,-2],[-13,4],[-7,0],[7,2],[4,2],[1,3],[-2,2],[-3,-1],[-3,-2],[-2,-1],[-1,1],[-2,2],[-1,1],[-2,-1],[-2,-1],[-7,-1],[-3,0],[-3,1],[-4,5],[5,2],[17,2],[25,-3],[7,3],[-20,6],[-1,3],[6,1],[22,-3],[-2,3],[-8,3],[-4,3],[4,0],[2,1],[3,1],[2,3],[-15,4],[-2,1],[2,2],[14,5],[6,7],[3,2],[5,2],[10,2],[4,1],[4,4],[-23,-5],[-6,1],[6,3],[2,2],[2,4],[-6,-1],[-8,-4],[-5,0],[6,7],[-2,3],[-3,0],[-3,0],[-7,-6],[-12,-6],[-5,-2],[-6,1],[-2,3],[-3,2],[-9,-6],[-2,3],[-2,10],[-4,4],[-4,-1],[-2,-5],[-1,-6],[-1,-5],[-6,-9],[-1,-6],[3,-5],[11,-6],[2,-3],[-2,-3],[-4,-5],[-5,-3],[-4,-2],[-1,1],[-1,1],[-2,2],[-1,2],[-2,0],[-1,1],[-2,0],[-11,5],[-3,0],[-16,2],[-9,2],[-6,5],[3,1],[7,2],[3,1],[4,2],[0,2],[0,1],[0,3],[3,2],[2,0],[1,1],[-3,3],[-4,1],[-3,0],[-2,1],[0,4],[-1,3],[-4,2],[-1,2],[1,3],[4,1],[4,0],[2,1],[3,4],[1,4],[-2,3],[-2,2],[-3,2],[-3,1],[-4,1],[0,2],[12,4],[3,3],[-4,3],[-3,0],[-6,-3],[-3,0],[-11,0],[-40,-10],[-13,-1],[6,4],[11,5],[8,5],[-3,6],[0,4],[-7,0],[-9,-1],[-5,1],[-3,1],[-2,1],[-2,1],[-1,4],[1,3],[0,3],[1,2],[2,1],[4,5],[5,0],[16,-2],[3,0],[3,2],[3,3],[2,1],[3,1],[4,-1],[12,-3],[7,-3],[3,-3],[2,-5],[3,-4],[5,-3],[4,-2],[14,-3],[53,-1],[5,2],[2,4],[-3,4],[-4,-1],[-5,-3],[-4,-2],[-11,1],[-4,1],[0,3],[10,9],[1,4],[-2,-2],[-2,-1],[-2,0],[-3,-1],[-3,0],[-1,-2],[-3,-5],[-4,-3],[-4,-2],[-5,0],[-12,1],[-12,2],[-4,2],[-3,6],[0,4],[6,8],[-12,1],[-6,2],[-17,14],[-1,3],[-1,2],[0,1],[2,1],[3,0],[3,1],[10,-2],[11,-4],[5,-3],[3,-4],[9,4],[13,-1],[21,-8],[-2,4],[-4,3],[-3,1],[-3,3],[-1,4],[0,4],[0,4],[-4,2],[-5,1],[0,2],[3,3],[5,1],[6,0],[5,1],[8,4],[5,0],[1,-1],[-1,-8],[-1,-1],[0,-1],[0,-2],[4,-5],[1,-2],[2,-6]],[[8194,819],[-1,-1],[-2,0],[-4,1],[-1,1],[-4,2],[0,1],[-1,2],[1,1],[1,0],[0,2],[3,3],[18,10],[5,2],[7,1],[5,0],[3,-5],[-1,-3],[-3,-1],[-3,0],[-3,-1],[1,-6],[-4,-4],[-7,-2],[-6,0],[-1,-1],[-3,-2]],[[8999,925],[-9,0],[-6,3],[5,4],[8,5],[11,5],[13,4],[2,-3],[-3,-3],[-3,-5],[-7,-5],[-11,-5]],[[8328,949],[14,-8],[5,3],[5,-3],[7,-4],[7,-1],[4,1],[11,-8],[1,-3],[0,-4],[-2,-4],[-3,-3],[-4,-1],[-4,0],[-5,1],[-4,2],[-3,3],[-1,3],[1,2],[2,2],[4,0],[0,2],[-3,0],[-4,3],[-2,0],[-12,0],[-2,0],[-2,-1],[-2,0],[-2,2],[-2,1],[-3,0],[-6,0],[-7,-3],[-2,-1],[-10,1],[-3,-1],[-14,-5],[-5,0],[3,4],[9,2],[4,3],[-2,2],[3,1],[4,0],[4,1],[2,3],[2,0],[3,0],[6,-1],[7,-2],[4,-1],[2,2],[-3,2],[-7,5],[5,3]],[[8081,974],[8,-6],[10,-6],[6,-2],[19,-5],[-1,-4],[-1,-2],[-1,-1],[3,-3],[10,-3],[2,-2],[1,-3],[4,-1],[8,1],[3,-1],[-3,-4],[-6,-7],[2,-2],[10,-7],[3,6],[4,0],[13,-8],[2,-1],[3,0],[1,0],[1,3],[1,0],[2,0],[2,-1],[2,-1],[1,1],[2,2],[2,1],[3,-1],[5,-6],[0,-3],[3,-2],[5,1],[8,6],[-6,2],[-3,2],[-2,3],[10,-3],[4,-1],[10,-8],[1,4],[4,0],[9,-6],[5,-1],[2,-1],[1,-2],[-1,-1],[-8,0],[2,-3],[1,-1],[1,0],[-1,0],[4,-1],[10,-3],[-1,4],[1,3],[2,2],[4,0],[2,-1],[6,-8],[3,-1],[1,-1],[1,-2],[1,-2],[2,-1],[2,1],[1,1],[1,1],[0,1],[4,0],[4,-2],[6,-3],[11,-10],[3,-1],[2,-1],[5,-6],[2,-2],[4,2],[-1,2],[-5,5],[-2,3],[-3,11],[4,0],[4,0],[4,-2],[2,-3],[0,-1],[-1,-2],[0,-3],[1,-2],[1,0],[6,-1],[0,4],[0,-2],[3,-2],[1,-1],[2,-6],[0,-4],[-3,-3],[-5,-5],[7,-5],[1,-2],[2,-5],[1,-3],[-1,-1],[4,-3],[3,-1],[1,3],[0,4],[2,2],[2,1],[4,1],[-2,3],[-2,2],[-2,2],[-2,2],[4,4],[-3,7],[3,3],[6,0],[5,-2],[3,-3],[-2,-4],[3,0],[2,0],[3,-1],[1,-2],[-3,-2],[12,-4],[4,-3],[4,-4],[2,-2],[-2,-1],[-9,-1],[-3,1],[2,-3],[1,-1],[-2,-4],[6,0],[13,3],[4,-2],[17,-9],[-2,-1],[-1,-1],[0,-1],[7,-1],[9,-2],[8,-3],[3,-4],[-4,-4],[-19,3],[-6,-1],[-3,-1],[-4,0],[-7,4],[-3,3],[-2,0],[-1,-2],[-2,-1],[-1,0],[-7,2],[-7,5],[-6,5],[-4,5],[-4,-3],[-2,-3],[-3,-3],[-5,-1],[-19,0],[-5,2],[-5,2],[-1,2],[1,2],[5,0],[12,-2],[5,0],[3,2],[-4,2],[-10,2],[-5,2],[-3,3],[-2,4],[0,4],[4,1],[-3,1],[-3,2],[-1,2],[0,4],[-2,-1],[-3,-4],[-2,0],[-3,0],[-1,1],[0,2],[-2,2],[-6,8],[-4,4],[-4,2],[0,-3],[3,-6],[-7,0],[-4,4],[-1,6],[-1,5],[-2,0],[-9,-1],[-4,1],[-5,8],[-5,5],[-1,0],[-1,-2],[-1,-1],[-5,-2],[-2,-1],[-4,1],[-22,6],[-5,-1],[2,-2],[7,-5],[-2,-1],[-1,0],[-4,0],[-2,-1],[-1,-2],[-2,-1],[-4,0],[-2,1],[-2,2],[-2,1],[-2,-1],[-2,-1],[-2,0],[-8,2],[-11,11],[-7,2],[3,-5],[1,-4],[-2,-2],[-5,-2],[-6,1],[-1,0],[1,-3],[-1,0],[-3,0],[-3,0],[-2,1],[-1,3],[0,3],[1,3],[0,2],[-1,3],[-1,1],[-2,1],[-3,0],[0,-2],[-2,-2],[-4,1],[-3,2],[-3,1],[0,2],[1,1],[0,2],[-2,2],[1,2],[0,2],[0,5],[-4,-1],[-17,1],[-2,1],[-2,1],[0,1],[0,3],[-1,1],[-1,0],[-1,0],[-12,2],[-4,3],[3,7],[0,2],[-1,2],[-1,0],[1,2],[1,2],[3,3],[-2,1],[-3,3],[-4,4],[-23,9],[-5,3],[-4,5],[1,1],[2,1],[2,0],[1,1],[1,0],[3,0],[1,0],[0,1],[0,2],[0,1],[1,0],[0,1],[1,1],[2,0],[2,-1]],[[8384,973],[-4,-3],[-3,3],[7,5],[2,1],[7,2],[0,-1],[-9,-7]],[[8157,1000],[-5,-2],[-12,5],[-9,5],[-5,5],[-2,5],[6,4],[3,2],[6,6],[2,0],[5,-4],[3,-6],[5,-7],[2,-7],[1,-6]],[[9357,988],[10,-4],[12,1],[16,8],[13,-1],[10,3],[10,5],[10,4],[5,4],[3,4],[2,4],[3,3],[3,0],[5,-2],[16,-15],[5,-3],[6,-4],[0,-68],[-1,-69],[0,-69],[0,-68],[-1,-69],[0,-68],[-1,-69],[0,-69],[-14,4],[-2,-1],[1,-2],[5,-2],[10,-3],[0,-14],[-3,-8],[-3,0],[-4,1],[-13,9],[-44,17],[-8,-1],[0,-2],[19,-4],[3,-4],[2,-3],[5,-4],[6,-4],[4,-2],[12,-3],[2,-3],[-6,-4],[-6,-2],[-65,-7],[-15,1],[-35,11],[-52,10],[-13,4],[-7,4],[-2,1],[-4,1],[-3,0],[-4,0],[-3,2],[-3,2],[-1,2],[0,3],[1,2],[4,1],[4,0],[2,1],[2,3],[-1,2],[0,2],[-1,2],[1,11],[-3,-1],[-5,-14],[-4,-3],[-3,4],[-1,12],[-5,3],[-1,-2],[2,-17],[0,-5],[0,-2],[-2,-2],[-2,-1],[-4,-1],[-3,1],[-2,2],[2,12],[0,5],[-3,3],[-4,-1],[-1,-5],[0,-12],[-3,-6],[-8,-3],[-9,0],[-7,1],[-5,2],[-4,4],[-4,4],[-1,5],[0,10],[0,3],[2,2],[1,2],[0,3],[-3,1],[-3,-3],[-3,-6],[-1,-5],[1,-6],[3,-8],[1,-4],[0,-5],[-1,-2],[-2,-1],[-20,-4],[-3,0],[-1,4],[0,3],[2,4],[1,3],[-1,4],[-2,0],[-2,-4],[-1,-4],[-7,3],[-1,-2],[0,-5],[-5,-5],[-8,-2],[-9,-1],[-9,1],[-8,4],[-4,5],[1,5],[4,5],[8,7],[8,10],[3,5],[-4,1],[-3,-3],[-2,-4],[-3,-2],[-3,-1],[-8,-5],[-1,-1],[-1,-2],[-1,-2],[-2,-1],[-1,-1],[-1,-2],[0,-4],[-1,-1],[0,-2],[1,-4],[-1,-2],[-2,0],[-2,0],[-1,2],[-1,0],[-11,3],[-7,1],[-10,3],[-9,4],[-9,1],[-7,0],[1,-3],[-4,-3],[-6,-1],[-10,-1],[-5,-2],[-5,-3],[-5,-3],[-7,2],[-8,3],[-2,3],[-1,6],[2,2],[5,3],[6,2],[16,2],[20,5],[19,9],[21,16],[-9,5],[-12,-2],[-20,-11],[3,-2],[5,-2],[3,-2],[-6,-4],[-7,-3],[-8,-3],[-6,0],[-4,0],[-3,2],[-3,0],[-4,-1],[-3,-1],[-3,-3],[-3,-2],[-4,-1],[-18,1],[-8,3],[1,6],[7,4],[20,1],[7,3],[-5,2],[-14,-2],[-6,0],[-10,3],[-4,-1],[-4,-4],[5,-3],[-2,-5],[-14,-13],[-4,-1],[-4,0],[-1,4],[1,3],[3,3],[4,3],[3,2],[1,4],[-1,4],[0,3],[0,3],[9,8],[3,1],[0,1],[-1,2],[-2,1],[-4,-2],[-2,0],[-4,0],[-3,1],[-6,5],[-4,1],[1,-4],[2,-3],[1,-2],[0,-3],[-2,-5],[-2,-1],[-3,1],[-2,1],[-1,1],[0,2],[-1,2],[-3,0],[0,-1],[-10,-12],[-4,-3],[-4,-1],[-3,1],[-6,4],[-3,2],[-9,-1],[-4,0],[-3,3],[-1,3],[4,2],[16,1],[4,1],[2,3],[-6,1],[-5,1],[-3,1],[-2,9],[-1,1],[0,2],[1,3],[2,2],[3,2],[2,3],[-7,-1],[-4,-4],[-4,-3],[-6,4],[-4,6],[-2,1],[-3,-2],[0,-3],[2,-3],[2,-3],[2,-1],[-6,-1],[-5,2],[-4,1],[-3,-6],[10,-2],[4,-2],[4,-3],[-3,-2],[-3,1],[-2,2],[-3,1],[-3,-1],[-1,-3],[0,-3],[-1,-3],[-3,-3],[-1,1],[-2,2],[-3,1],[-2,-1],[-2,-2],[-2,-2],[-4,0],[2,-6],[-2,-2],[-5,1],[-3,5],[0,6],[2,5],[4,7],[-5,-2],[-4,-3],[-3,-5],[-1,-6],[-2,1],[-2,1],[-2,-1],[-1,-1],[-2,4],[1,5],[4,5],[3,4],[-2,0],[-1,-1],[-2,-1],[-1,0],[-2,1],[-1,1],[-1,1],[-2,-2],[-1,-2],[0,-2],[1,-1],[-2,-2],[-5,-5],[-1,-1],[0,-2],[0,-1],[-1,-1],[-2,0],[-2,0],[-2,0],[-1,1],[-2,4],[1,3],[6,6],[-2,0],[-6,-2],[-3,0],[-3,1],[-6,2],[-3,1],[3,-6],[-4,-2],[-8,0],[-6,1],[2,-3],[1,-2],[-1,-3],[-3,-1],[-6,2],[-5,0],[-12,-2],[-5,0],[-5,2],[-2,3],[-2,6],[5,1],[4,1],[4,-1],[5,-1],[-2,2],[-2,1],[4,2],[2,2],[1,1],[0,3],[-1,0],[-2,0],[-2,-1],[-8,0],[-2,2],[5,3],[-3,1],[-13,-6],[0,4],[1,2],[2,2],[2,3],[-4,3],[-2,1],[0,2],[1,2],[1,0],[3,-2],[4,-1],[4,-1],[3,1],[-12,8],[-3,5],[7,3],[7,-3],[5,-1],[1,-1],[0,-1],[1,-1],[6,-2],[5,-5],[1,-3],[1,-3],[2,-3],[4,-1],[8,-1],[21,-6],[8,-1],[-3,2],[-5,3],[-3,1],[-5,8],[-2,2],[9,0],[18,-9],[12,0],[-18,8],[-8,6],[0,5],[-6,2],[-4,-1],[-5,-1],[-6,-1],[-11,2],[-2,0],[-3,3],[0,2],[1,2],[4,0],[0,2],[-1,2],[-2,1],[-2,1],[9,0],[2,0],[1,2],[1,1],[2,2],[4,1],[5,-1],[6,-2],[2,-3],[-5,-1],[0,-2],[11,-3],[17,-16],[12,-2],[0,5],[16,-1],[0,5],[-5,3],[-15,0],[-5,4],[-2,1],[-1,3],[-1,3],[1,2],[4,3],[3,-1],[4,-6],[2,-2],[4,-2],[3,-1],[3,1],[1,3],[-1,2],[-2,3],[-2,1],[3,0],[6,-4],[8,-3],[2,0],[4,1],[4,-1],[2,0],[1,0],[0,-2],[0,-2],[2,-1],[2,0],[5,3],[7,1],[3,3],[-5,3],[-14,1],[-7,3],[3,1],[1,1],[2,1],[1,2],[3,-1],[2,1],[2,1],[2,1],[3,0],[5,-3],[7,-1],[26,-10],[5,-3],[4,-10],[5,-3],[9,-5],[-11,15],[-2,4],[5,1],[26,-4],[9,-5],[2,0],[0,7],[1,2],[3,1],[3,3],[0,7],[-4,13],[5,-2],[6,3],[5,3],[5,1],[14,1],[7,-1],[6,-3],[0,-4],[5,0],[9,2],[1,0],[1,3],[1,0],[2,0],[2,-1],[2,0],[4,0],[2,-1],[3,-1],[-22,-20],[-1,-1],[-4,-1],[-1,-1],[0,-2],[1,-1],[1,-1],[1,-4],[1,-3],[0,-2],[-2,-5],[-13,-12],[-1,-4],[0,-3],[1,-3],[1,-3],[2,-1],[1,2],[3,8],[1,2],[9,-7],[4,-4],[10,-2],[2,1],[-2,3],[-2,2],[-6,4],[-6,8],[1,10],[5,10],[6,7],[4,4],[6,3],[5,3],[5,-2],[0,-1],[1,-3],[0,-1],[1,0],[3,-1],[3,-3],[8,-2],[9,-7],[4,-3],[10,-2],[12,-5],[4,-3],[11,-11],[7,-4],[4,6],[-5,3],[-5,2],[-3,4],[-3,5],[10,-2],[20,-9],[10,-1],[-5,4],[-13,4],[-10,7],[-41,13],[-5,3],[-2,2],[0,2],[0,6],[-10,5],[-3,2],[4,4],[-3,5],[-10,9],[-6,3],[-19,3],[-34,-1],[-9,1],[-5,5],[-3,6],[-2,6],[-2,4],[1,2],[4,-2],[4,-2],[8,-1],[-11,7],[-4,1],[-3,2],[-4,3],[-2,4],[-1,4],[91,-37],[27,-9],[23,-9],[3,-2],[3,-2],[2,-2],[10,-2],[5,-3],[8,-8],[9,-6],[4,-1],[-2,9],[2,1],[11,1],[3,2],[0,2],[-5,3],[-16,2],[-5,3],[-3,5],[2,2],[8,2],[4,2],[1,2],[2,3],[4,3],[4,3],[4,1],[4,0],[5,-2],[8,-4],[4,-3],[3,-3],[0,-5],[-1,-4],[0,-4],[5,-2],[-3,-7],[7,2],[3,0],[3,-2],[1,-2],[0,-3],[1,-3],[4,-1],[2,-1],[1,-4],[0,-3],[-2,-2],[-1,-1],[0,-11],[3,1],[3,3],[1,1],[1,0],[3,2],[3,2],[2,-1],[1,-1],[6,-2],[0,-5],[-2,-5],[-2,-4],[3,-1],[4,-3],[1,0],[3,1],[0,2],[0,1],[-2,3],[0,2],[4,5],[2,2],[-1,3],[-1,3],[-3,3],[-4,3],[-5,3],[-4,3],[-1,4],[3,5],[0,1],[-1,0],[-2,3],[-5,2],[-2,3],[0,3],[0,1],[-1,2],[-3,2],[-2,1],[-1,1],[1,4],[4,4],[6,0],[13,-3],[7,-3],[13,-4],[9,-6],[3,-4],[-1,-2],[2,-3],[1,-1],[5,-3],[1,-1],[3,0],[1,-1],[1,-2],[0,-3],[1,-1],[5,-3],[5,-2],[3,2],[-1,5],[-7,7],[-3,4],[1,4],[5,4],[5,1],[5,-1],[50,-22],[9,-2],[2,-1],[1,-3],[2,-3],[0,-4],[-2,-1],[-6,-2],[-3,-3],[-4,-4],[-4,-3],[-8,-4],[-3,-2],[-2,-2],[-2,-5],[-2,-2],[-8,-9],[6,-6],[-1,-3],[0,-3],[2,-2],[2,-1],[2,5],[-1,6],[0,6],[5,2],[5,2],[3,4],[3,5],[4,5],[4,3],[5,2],[6,0],[5,-4],[5,-8],[2,-1],[3,5],[0,4],[-4,14],[0,3],[1,1],[2,2],[1,3],[2,1],[12,0],[4,0],[2,-1],[7,-5],[7,0],[4,1],[0,2],[-1,2],[2,3],[0,2],[-12,6],[-12,4],[-18,3],[-5,2],[-9,7],[-11,6],[-53,16],[-6,1],[-1,1],[-5,4],[-2,3],[-4,1],[-8,0],[-62,15],[-6,5],[-2,1],[-1,0],[-11,5],[-10,2],[-10,6],[-4,9],[-2,11],[-5,11],[-4,4],[-3,4],[-3,4],[-2,12],[-5,10],[-2,6],[3,13],[9,6],[18,6],[18,7],[13,2],[2,4],[8,1],[17,-2],[36,8],[68,29],[8,8],[2,11],[-3,9],[-1,6],[-4,7],[0,2],[-11,0],[-15,0],[-49,-1],[-30,-6],[-22,-1],[-12,-3],[-9,-5],[-8,-5],[-8,3],[-14,-2],[-5,-2],[-9,-6],[-6,-1],[-6,0],[-6,2],[-6,3],[-5,4],[-6,7],[-4,4],[-5,1],[-6,1],[-6,2],[-5,3],[-4,5],[-2,4],[-2,5],[3,9],[0,13],[2,7],[1,3],[3,4],[1,4],[-1,6],[-1,6],[2,9],[0,7],[1,4],[2,4],[6,3],[7,4],[5,4],[3,1],[3,-1],[0,-3],[-3,-3],[-3,-4],[3,-2],[3,-3],[-1,-4],[-4,-2],[3,-3],[6,1],[13,-1],[14,8],[11,5],[4,8],[2,4],[3,5],[2,9],[-5,6],[-5,2],[-2,0],[-1,-1],[-1,0],[-2,-1],[-1,1],[-3,2],[-1,1],[-6,1],[-4,1],[-2,-1],[-3,-3],[-5,-4],[-3,-3],[-6,-2],[0,3],[4,5],[7,4],[-3,11],[-3,7],[-13,5],[-18,0],[-3,0],[0,3],[3,2],[11,3],[22,3],[17,-1],[9,2],[7,0],[4,-7],[16,-14],[10,-7],[12,-2],[9,0],[13,12],[7,5],[9,1],[12,1],[5,3],[3,4],[2,3],[4,5],[8,8],[5,4],[3,3],[3,4],[-2,6],[-1,5],[-3,5],[-1,5],[1,5],[3,5],[5,3],[18,5],[8,5],[5,1],[2,2],[3,1],[3,1],[5,-2],[5,-3],[7,-9],[3,-5],[3,-4],[5,-6],[5,-4],[11,-16],[10,-7]],[[8127,1035],[-5,-5],[-9,4],[-9,3],[-2,6],[6,1],[6,-2],[6,-3],[7,-4]],[[8302,1056],[4,-10],[7,-8],[0,-3],[-3,-4],[-1,-2],[-5,-1],[-2,-1],[-2,-2],[-2,-6],[-2,-1],[-7,0],[-2,-1],[2,-2],[2,-3],[3,-1],[5,-4],[-3,-9],[-6,-9],[-5,-6],[-2,-1],[-7,-2],[-5,0],[0,-1],[-1,-1],[-2,-2],[-2,0],[-2,2],[-1,0],[-1,-1],[-1,-1],[-1,-1],[-2,-1],[-5,1],[-2,1],[-3,2],[1,5],[3,3],[7,5],[10,12],[5,3],[-7,-3],[-20,-12],[-5,1],[0,5],[4,4],[19,13],[3,4],[-9,-2],[-20,-14],[-10,-11],[-20,-13],[-4,0],[-1,3],[2,2],[2,6],[-12,4],[-2,8],[1,8],[10,3],[10,1],[11,2],[8,6],[9,11],[8,4],[-1,3],[-9,1],[-11,-3],[-2,7],[3,5],[13,1],[8,0],[10,5],[10,-3],[8,-1],[7,-1],[3,5],[6,2],[6,-1]],[[8131,1047],[-5,-1],[-6,4],[-7,6],[0,9],[2,10],[5,6],[7,-1],[-2,-5],[4,-6],[-4,-6],[-1,-4],[9,-1],[-2,-5],[0,-6]],[[8045,1103],[4,-4],[5,1],[7,4],[18,0],[2,1],[7,2],[6,0],[7,-2],[3,-6],[7,-3],[2,-6],[-1,-5],[-4,-6],[-2,-6],[-1,-8],[-5,-7],[-18,1],[-8,1],[1,10],[-3,1],[-7,1],[-3,-6],[-6,-1],[-8,4],[-1,8],[5,5],[-2,4],[-16,8],[-7,5],[-1,4],[0,4],[3,4],[5,0],[3,-1],[8,-7]],[[8234,1118],[2,0],[3,1],[1,-1],[2,-1],[2,-3],[1,-1],[2,-1],[1,-1],[1,-2],[6,-2],[8,-5],[18,-5],[3,-2],[1,-2],[2,-2],[2,-2],[1,-3],[-1,-3],[-4,-6],[0,-3],[4,-2],[5,-2],[2,-2],[-5,-6],[-3,-2],[-5,-2],[-5,0],[-5,2],[-5,3],[-3,2],[-1,1],[2,2],[13,3],[0,2],[-4,0],[-1,2],[-2,1],[-1,2],[-11,2],[-3,2],[-4,4],[-2,2],[-5,3],[-6,1],[-3,2],[-4,4],[-8,10],[-9,4],[0,5],[4,4],[5,3],[3,-1],[2,-1],[2,-2],[2,-2]],[[8183,1131],[27,-18],[9,-8],[9,-6],[5,-3],[6,-8],[10,-7],[4,-5],[-1,-2],[-10,0],[3,-3],[-5,-1],[-7,1],[-4,0],[1,-4],[-6,-4],[-7,-4],[-8,-2],[-5,3],[-5,3],[-5,2],[-2,4],[2,7],[-9,0],[-2,0],[-2,2],[0,2],[2,1],[3,0],[2,1],[2,2],[2,2],[1,1],[-10,9],[7,5],[8,-2],[9,-3],[7,0],[-6,5],[-17,6],[-5,4],[5,0],[8,-1],[5,0],[-16,6],[-6,1],[-3,0],[-5,4],[-2,1],[-3,-1],[-6,-3],[-4,-1],[-5,0],[-7,2],[-5,4],[-1,3],[4,3],[13,7],[5,2],[3,0],[3,0],[2,-1],[5,-4],[7,-2]],[[8085,1128],[-1,-3],[-1,-4],[-1,-4],[-3,0],[-7,0],[-8,-5],[-5,-1],[-5,2],[-3,2],[0,3],[2,8],[0,1],[2,1],[4,1],[1,0],[2,-2],[1,1],[1,1],[14,8],[12,2],[1,1],[1,3],[2,1],[3,-1],[1,0],[1,-2],[-3,-3],[-11,-10]],[[8155,1140],[-4,-1],[-3,0],[-3,2],[-1,2],[-1,1],[0,2],[0,2],[11,-3],[4,-2],[-3,-3]],[[8071,1138],[-4,0],[1,2],[2,6],[4,7],[3,2],[3,1],[8,5],[1,2],[3,1],[20,16],[1,-2],[4,-2],[3,-2],[2,-2],[0,-3],[0,-2],[2,-2],[-1,-4],[-5,-3],[-26,-10],[-3,-2],[-2,-2],[-2,-1],[-2,-1],[-6,-2],[-6,-2]],[[8233,1179],[8,-7],[4,-2],[4,-1],[4,-1],[35,-24],[6,-6],[7,-11],[5,-9],[0,-5],[0,-2],[1,-1],[3,-2],[0,-2],[1,-2],[-2,-7],[-3,1],[-3,2],[-2,2],[-2,3],[-2,4],[-1,2],[-11,7],[-2,4],[-1,2],[-14,11],[-9,3],[-13,8],[-13,4],[-16,7],[-5,4],[2,-2],[1,0],[2,0],[1,2],[3,-2],[2,-1],[2,-1],[3,0],[-2,4],[-4,1],[-3,0],[-4,2],[-3,3],[0,3],[3,1],[5,0],[-4,4],[0,3],[3,1],[6,-1],[-2,4],[3,1],[4,-2],[3,-2]],[[8068,1193],[1,-1],[3,1],[10,0],[2,0],[2,3],[9,3],[2,2],[2,0],[-2,-5],[-4,-6],[-4,-5],[-6,-3],[-6,-8],[-3,-3],[-3,-2],[-2,-2],[-2,-3],[3,0],[6,3],[4,0],[-1,-2],[-3,-3],[-2,-2],[-3,-1],[-2,-2],[-5,-9],[-5,-6],[-3,-4],[-5,-2],[-8,0],[1,-5],[-4,-5],[-4,-2],[-4,3],[-2,3],[1,6],[4,5],[3,4],[14,8],[4,4],[-7,0],[-3,0],[-1,0],[0,-1],[-1,-1],[-2,1],[0,1],[-1,2],[1,1],[0,1],[2,2],[13,29],[6,10],[2,0],[2,0],[2,-1],[0,-3],[-2,-3],[1,-2]],[[8278,1197],[3,-3],[6,3],[2,5],[2,1],[8,-1],[4,-4],[3,-9],[2,-6],[0,-9],[-5,1],[2,-5],[2,-5],[-2,-5],[-6,-4],[-7,2],[-9,6],[-7,10],[-1,7],[-8,4],[-9,0],[-7,2],[-2,6],[-6,8],[3,5],[7,2],[8,2],[5,-3],[4,-4],[8,-6]],[[8009,1220],[-3,-4],[5,0],[-6,-17],[-2,-4],[-3,-2],[-6,-2],[-3,-2],[-3,-2],[-3,-2],[-3,0],[-4,1],[0,4],[1,5],[3,4],[2,5],[-3,5],[2,8],[10,13],[3,2],[5,1],[5,-1],[4,-1],[3,-4],[-1,-3],[-3,-4]],[[8152,1218],[3,0],[9,2],[-1,-1],[-2,-2],[0,-1],[5,-2],[-1,-2],[-1,-3],[1,-2],[4,-2],[4,0],[9,1],[3,-1],[1,-1],[0,-2],[2,-1],[2,0],[6,0],[2,0],[2,-5],[-3,-2],[-6,-2],[-5,0],[10,-3],[5,-1],[5,1],[8,3],[2,-1],[-2,-6],[-2,-3],[-6,-7],[-2,-2],[-5,-1],[-6,0],[-7,1],[-4,1],[-3,4],[-1,1],[-6,2],[-3,0],[-2,1],[-1,2],[-1,1],[-2,1],[-2,1],[-9,0],[-3,2],[-1,4],[-1,1],[-10,5],[3,3],[2,3],[1,3],[-8,3],[-3,3],[-1,3],[3,1],[0,2],[-5,3],[-6,7],[-3,2],[1,2],[20,-5],[10,-4],[1,-7]],[[8268,1241],[3,-1],[1,0],[1,0],[1,-2],[0,-3],[-2,-4],[0,-2],[3,-1],[8,1],[4,-2],[2,-3],[2,-5],[0,-4],[-3,-2],[-1,2],[-2,1],[-2,0],[-3,0],[3,-4],[3,-3],[-1,-2],[-5,-1],[-5,1],[-3,3],[-3,4],[-2,7],[-3,5],[-3,4],[-2,2],[-5,2],[-2,3],[0,5],[0,4],[2,1],[5,-1],[9,-5]],[[8039,1252],[4,-2],[4,3],[3,0],[4,-3],[2,-3],[-2,-6],[3,-8],[-3,-4],[4,-3],[1,-3],[0,-4],[2,-4],[-2,0],[-3,-2],[-2,0],[2,-4],[-1,-3],[-1,-3],[-3,-7],[-5,-6],[-1,-4],[0,-9],[-1,-4],[-2,-2],[-3,-2],[-5,-8],[-3,-2],[-3,-1],[1,-3],[2,-4],[1,-3],[-15,-17],[-3,-2],[-3,2],[1,3],[6,11],[-10,-9],[-6,-3],[-2,5],[4,2],[3,2],[3,4],[1,4],[-4,-1],[-3,1],[-2,2],[-5,3],[-3,2],[-4,4],[-1,3],[2,3],[9,1],[2,4],[1,1],[8,3],[2,2],[-5,0],[-4,-2],[-4,0],[-3,4],[7,8],[5,12],[6,7],[9,-6],[-3,-5],[4,-2],[7,-1],[5,-3],[2,3],[4,5],[2,3],[-6,0],[-3,1],[0,3],[4,5],[-5,3],[-2,2],[-1,2],[1,2],[2,1],[4,-1],[3,1],[0,2],[-4,2],[-1,3],[1,4],[2,3],[-3,2],[-3,0],[-2,0],[-3,0],[1,3],[1,1],[1,1],[0,2],[-8,4],[-1,6],[5,3],[9,1],[-2,-2],[2,-2],[2,-1]],[[8117,1255],[1,-2],[-8,0],[-6,3],[-4,4],[-3,3],[4,1],[3,-1],[6,-2],[2,-5],[5,-1]],[[8155,1264],[-6,0],[-8,2],[2,2],[7,8],[5,-1],[3,-4],[-3,-7]],[[8078,1271],[1,-3],[-7,3],[-10,1],[-2,3],[5,1],[9,-3],[4,-2]],[[8231,1262],[0,-4],[1,-4],[2,-3],[6,-5],[1,-4],[-3,-3],[-2,-4],[0,-3],[2,-1],[1,0],[3,0],[2,0],[6,-5],[1,0],[2,-1],[1,-2],[1,-2],[0,-2],[0,-2],[-1,-1],[-2,0],[-9,-5],[-8,0],[-9,1],[-42,22],[-2,3],[1,4],[4,2],[6,-2],[2,3],[4,0],[3,0],[4,1],[1,3],[0,4],[-2,3],[-2,3],[0,3],[6,0],[8,-1],[4,1],[-7,10],[0,3],[1,3],[4,1],[4,-2],[3,-3],[2,-3],[2,-4],[1,-4]],[[8030,1275],[-5,-1],[-6,1],[-7,2],[-3,2],[2,7],[1,3],[1,3],[4,0],[6,4],[5,-2],[0,-4],[-2,-5],[2,-4],[5,-2],[-3,-4]],[[8167,1308],[-7,-2],[-8,2],[-6,2],[-1,5],[1,5],[-4,1],[4,5],[3,3],[6,0],[3,-1],[4,-4],[4,-5],[3,-5],[-2,-6]],[[8200,1342],[1,-3],[0,-3],[1,-2],[2,-5],[2,-3],[4,-5],[2,-3],[1,-5],[-1,-7],[-2,-5],[-4,0],[-5,7],[-2,2],[-2,0],[-2,-3],[-3,-1],[-6,1],[-4,4],[0,4],[4,3],[-6,2],[-2,5],[-1,6],[0,8],[2,2],[4,0],[5,-1],[2,0],[3,2],[4,1],[3,-1]],[[7970,1322],[1,-1],[2,1],[2,1],[2,2],[1,7],[1,2],[1,2],[0,2],[0,1],[2,1],[2,-1],[2,-1],[1,-1],[1,-1],[1,-1],[2,-3],[1,-1],[2,-1],[4,1],[2,0],[3,-2],[2,-1],[1,-2],[0,-3],[0,-4],[-1,-4],[-1,-3],[-2,-2],[-4,0],[-5,2],[-4,1],[-2,-3],[0,-4],[-2,-2],[-2,-1],[-2,-2],[-1,-2],[0,-2],[0,-1],[0,-1],[-1,-1],[-2,1],[-2,1],[0,1],[-1,3],[-1,3],[-2,2],[-3,1],[1,-6],[4,-14],[2,-7],[-2,-8],[-5,-2],[-6,2],[-6,4],[-2,-7],[3,-4],[1,-3],[-8,0],[-3,-1],[-9,-5],[-2,-1],[-2,0],[-1,0],[-1,2],[0,2],[0,3],[0,2],[-1,1],[-1,2],[0,2],[1,1],[1,7],[0,2],[2,1],[3,1],[2,1],[1,1],[3,2],[5,2],[3,1],[2,3],[0,2],[0,2],[-1,2],[2,14],[1,2],[3,4],[1,1],[1,0],[2,1],[0,1],[-1,2],[-1,1],[-2,0],[-1,0],[-1,4],[-2,6],[0,5],[4,3],[5,2],[5,3],[4,3],[4,-2],[0,-4],[-4,-14],[-2,-6]],[[8295,1339],[-1,-4],[-2,-4],[-1,-5],[-2,-4],[-3,-2],[-2,1],[-2,1],[-1,1],[-1,2],[-3,-1],[-3,-1],[-3,0],[-3,1],[-2,1],[-3,2],[-1,3],[1,2],[3,-1],[5,1],[4,3],[4,3],[-12,-3],[-6,0],[-5,3],[5,6],[8,5],[10,3],[7,-3],[6,-6],[3,-4]],[[8080,1364],[5,-1],[4,2],[9,-2],[11,-12],[1,-8],[-18,5],[1,-4],[10,-10],[1,-5],[2,-1],[3,-1],[1,-2],[2,-3],[-12,-9],[-7,-2],[-5,4],[0,1],[1,2],[0,3],[0,2],[-2,2],[-4,2],[-2,2],[-1,2],[-1,4],[-1,4],[0,4],[-3,-3],[-1,-4],[-3,-1],[-4,5],[-1,-3],[0,-3],[1,-2],[2,-2],[1,-2],[-1,-3],[-2,-2],[-1,-2],[-12,-13],[2,-2],[-4,-1],[-7,-2],[-8,-1],[-10,-3],[-3,1],[-3,0],[-3,0],[-3,-2],[-3,-3],[-3,-1],[-4,0],[-3,2],[-2,3],[1,3],[4,3],[8,2],[23,12],[3,2],[3,4],[3,2],[4,2],[3,2],[2,3],[-30,-12],[-7,1],[-3,4],[0,4],[3,3],[4,4],[5,3],[12,2],[5,2],[1,5],[4,7],[6,4],[4,1],[3,-1],[4,1],[4,2],[3,2],[4,-1],[4,-1]],[[8034,1375],[-3,-1],[-7,1],[-5,-1],[-14,-4],[-4,1],[-1,3],[2,4],[2,3],[2,3],[2,2],[2,1],[3,2],[5,1],[8,-1],[8,-2],[3,-3],[0,-1],[1,-2],[0,-2],[-1,-3],[-3,-1]],[[8132,1404],[-1,-4],[-3,-2],[-3,1],[-2,4],[-4,-3],[-2,-5],[0,-4],[3,-2],[2,0],[6,-2],[4,-2],[3,0],[3,2],[2,0],[6,-3],[2,-5],[-1,-7],[-3,-6],[-2,-2],[-3,-1],[-2,0],[-2,1],[-3,2],[-1,1],[-3,2],[-11,3],[-7,1],[-6,3],[-3,6],[-3,8],[-1,5],[24,15],[4,0],[4,-1],[2,-2],[1,-3]],[[8177,1354],[-3,-1],[-2,2],[0,6],[0,4],[-1,5],[-7,17],[-3,20],[-1,5],[1,5],[2,5],[0,3],[-1,2],[-1,2],[-2,1],[-2,2],[-1,3],[7,1],[5,-5],[3,-7],[1,-8],[2,-7],[7,-11],[4,-16],[7,-11],[-1,-7],[-2,-2],[-9,-7],[-3,-1]],[[8127,1467],[3,-6],[5,-1],[5,-1],[5,-4],[1,-6],[-2,-5],[-7,-9],[4,-3],[3,-4],[4,-8],[2,-5],[0,-7],[-3,-2],[-4,4],[1,-4],[2,-7],[1,-4],[-2,-2],[-2,2],[-3,5],[-2,8],[-3,4],[-4,3],[-4,2],[-3,-1],[-11,-6],[-9,-3],[-9,-1],[-4,-1],[-1,-3],[1,-4],[1,-5],[-19,-4],[-4,0],[-3,1],[-2,2],[-2,4],[4,1],[1,2],[-1,3],[-2,3],[4,1],[5,1],[4,2],[3,4],[-15,0],[-4,1],[-3,3],[0,-2],[0,-5],[-1,-4],[-5,-7],[-3,-2],[-4,-1],[-1,0],[-7,3],[-4,1],[-2,1],[-1,2],[13,19],[-3,1],[-1,0],[-2,-1],[-3,2],[-3,2],[-2,0],[-3,0],[-3,-2],[-2,-3],[-3,-1],[-3,2],[-2,3],[0,3],[1,4],[2,3],[2,1],[4,0],[7,0],[-7,7],[0,1],[6,1],[6,0],[42,-8],[8,-4],[2,2],[2,1],[2,0],[3,-1],[6,7],[3,3],[-13,0],[-4,3],[4,7],[5,2],[12,1],[2,4],[-7,-1],[-4,3],[-3,4],[-3,5],[-11,8],[0,2],[4,2],[26,-6],[3,-3],[12,-5],[2,-4]],[[8065,1491],[-2,-4],[0,-3],[0,-3],[-1,-3],[2,-4],[6,-5],[2,-3],[-15,0],[4,-4],[5,-1],[3,-3],[1,-5],[1,-2],[2,2],[2,3],[0,1],[6,7],[3,-3],[-4,-13],[-3,-4],[-5,1],[-16,1],[-14,3],[-4,1],[-5,3],[-3,1],[-3,0],[-3,-1],[-2,1],[-3,3],[4,2],[15,2],[-5,1],[-5,1],[-5,1],[-4,4],[8,0],[-9,4],[-4,3],[4,1],[-3,9],[8,1],[19,-6],[-3,4],[-9,4],[-3,4],[2,7],[5,-2],[11,-6],[2,3],[-1,4],[-1,3],[6,0],[14,-10]],[[7999,1500],[2,-1],[1,1],[1,1],[2,1],[2,2],[2,-1],[1,-4],[-1,-4],[-2,-5],[-1,-4],[0,-9],[0,-5],[0,-3],[3,-1],[1,0],[0,-1],[-1,-1],[-3,-2],[-2,-1],[-2,1],[-5,1],[-7,4],[-2,0],[-2,2],[-3,7],[-1,3],[-3,3],[0,3],[2,2],[3,2],[3,-1],[3,-2],[3,-1],[2,4],[-4,4],[-4,5],[0,4],[7,1],[1,-1],[2,-1],[2,-3]],[[8098,1527],[-9,-5],[-8,2],[1,5],[-3,6],[1,5],[3,3],[4,0],[5,-2],[4,-1],[6,-4],[-4,-9]],[[7921,1547],[3,-4],[2,4],[1,3],[2,2],[4,0],[3,-2],[2,-5],[3,-2],[2,1],[2,1],[1,1],[0,1],[2,-1],[1,-1],[1,-1],[1,-1],[1,0],[1,-1],[1,0],[2,-1],[1,1],[1,1],[1,1],[1,1],[8,1],[8,-1],[5,0],[2,-1],[0,-1],[-3,-5],[-2,-3],[-3,-2],[-2,-2],[-3,0],[-3,0],[-2,-1],[-1,-4],[-2,1],[-2,1],[-2,1],[-2,0],[2,-6],[1,-3],[-3,-1],[-8,0],[-5,2],[-7,8],[-5,2],[-6,-3],[18,-15],[-5,-7],[-2,2],[-1,-2],[5,-2],[2,-1],[2,-2],[-2,-2],[-2,-2],[0,-1],[0,-2],[0,-1],[1,-3],[-1,-2],[-5,1],[0,-2],[3,-2],[3,-3],[1,-3],[-1,-5],[-3,-3],[-4,-2],[-4,1],[-3,3],[0,1],[1,4],[1,1],[-2,3],[-2,-1],[-2,-3],[-1,-2],[-6,-2],[-6,0],[-12,2],[1,3],[2,1],[1,1],[3,1],[-4,4],[-1,3],[1,2],[3,0],[3,1],[3,2],[1,3],[0,2],[0,1],[-17,-1],[-4,0],[-2,2],[-2,2],[0,2],[3,1],[4,0],[2,1],[1,1],[1,5],[3,3],[6,1],[13,-2],[-1,1],[0,3],[-1,1],[5,0],[-4,5],[-3,5],[-4,4],[-6,0],[0,2],[1,3],[0,1],[-3,0],[-3,1],[-2,1],[-1,3],[2,1],[1,0],[5,1],[2,1],[2,5],[3,1],[5,-1],[2,-3],[2,-3]],[[8124,1550],[3,0],[11,0],[5,2],[3,2],[3,1],[4,-5],[2,-4],[2,-5],[4,-17],[3,-4],[8,-5],[3,-3],[7,-13],[-2,-1],[-22,3],[-10,4],[-5,1],[-4,-1],[5,-3],[14,-2],[8,-5],[3,-1],[2,-1],[1,-3],[1,-3],[3,0],[6,2],[4,-2],[5,-5],[3,-6],[2,-5],[0,-6],[-1,-7],[-3,-4],[-9,2],[-1,9],[-4,4],[-3,1],[-2,0],[-2,-2],[-6,-1],[-1,-3],[2,-6],[-3,-3],[-6,1],[-6,4],[-3,5],[-2,4],[-5,4],[-2,4],[6,3],[-8,1],[-11,1],[-8,2],[3,8],[-8,2],[-1,1],[-1,2],[-5,7],[-3,5],[2,4],[10,4],[0,1],[1,3],[1,2],[2,1],[11,2],[1,1],[-2,5],[0,2],[2,2],[3,1],[4,0],[2,-1],[-2,2],[-3,2],[-3,0],[-3,-2],[-4,2],[-4,1],[-13,1],[-5,1],[-3,3],[-3,4],[-3,-1],[-5,-1],[-4,1],[-4,1],[5,3],[10,6],[4,2],[6,1],[4,1],[3,0],[5,-4],[2,-2],[1,-3],[1,-2],[2,-2]],[[8103,1575],[3,0],[4,0],[1,-1],[1,-3],[-3,-3],[-6,-1],[-11,-1],[0,-1],[1,-3],[-1,-3],[-3,-2],[-4,-1],[-4,-1],[-2,-1],[-8,-8],[-3,-1],[-3,0],[-8,0],[-2,1],[1,3],[1,5],[3,4],[7,8],[-2,1],[-4,3],[6,7],[9,2],[20,0],[3,-1],[4,-3]],[[8011,1561],[-16,-11],[-15,2],[-14,1],[0,8],[11,13],[12,9],[23,15],[11,3],[8,-5],[-9,-11],[-8,-5],[2,-8],[-5,-11]],[[7938,1664],[1,-2],[1,-3],[1,-2],[1,-2],[3,1],[6,8],[1,0],[1,0],[6,-1],[7,3],[3,0],[7,-2],[1,-5],[-2,-5],[0,-4],[2,-2],[3,1],[3,2],[3,1],[1,-1],[6,-11],[2,0],[2,1],[1,1],[0,2],[1,1],[3,1],[3,1],[3,1],[2,3],[1,2],[3,0],[2,-2],[2,-3],[-1,-4],[-3,-2],[-6,-2],[-19,-14],[0,-2],[5,0],[3,1],[10,4],[3,0],[8,0],[1,0],[2,-1],[1,0],[1,0],[1,3],[1,0],[4,2],[1,0],[4,-1],[2,-1],[2,1],[4,4],[-2,1],[0,1],[-1,2],[-1,2],[11,-1],[3,-1],[2,-6],[0,-6],[-6,-6],[1,-5],[-5,-1],[-25,-1],[-2,-1],[0,-2],[0,-3],[0,-3],[-7,-2],[-9,-5],[-5,-1],[-4,-3],[-4,-4],[-4,-2],[-6,2],[1,-2],[0,-2],[0,-3],[-2,0],[-3,-1],[-1,-1],[-1,-2],[0,-1],[-6,-4],[-2,-1],[-1,-1],[-1,-2],[-1,-2],[-3,-4],[-2,-3],[-2,-2],[-6,-1],[-13,2],[-4,1],[-1,2],[0,3],[0,2],[2,2],[9,5],[1,1],[5,2],[5,5],[8,10],[-4,0],[-7,-3],[-6,-3],[-6,-5],[-3,0],[-1,1],[1,2],[4,3],[1,2],[-1,2],[-3,1],[-2,-2],[-1,-2],[-2,-3],[-3,-1],[-2,0],[-2,1],[-3,0],[-5,-2],[-5,-4],[-5,-3],[-5,1],[-2,3],[4,19],[2,2],[2,1],[6,2],[0,2],[-4,4],[0,3],[1,1],[1,1],[1,2],[2,9],[2,2],[5,4],[5,1],[11,-4],[7,0],[2,-1],[1,-2],[-1,-2],[-1,-1],[-2,-1],[-10,-1],[-5,-1],[-3,-2],[4,-4],[3,-2],[3,0],[3,2],[2,-2],[2,-4],[2,-2],[3,0],[3,1],[4,0],[3,-2],[4,-1],[4,0],[8,2],[-3,7],[3,6],[4,7],[2,8],[-11,-6],[-5,0],[-6,2],[-3,2],[-5,5],[-3,1],[-7,-1],[-3,1],[-4,3],[-4,4],[-4,4],[-6,1],[-1,1],[-3,7],[0,2],[1,2],[3,-1],[4,0],[3,0],[2,2],[3,5],[1,1],[3,1],[4,-1],[2,-2],[0,-2],[-1,-3]],[[7893,1783],[3,-2],[3,1],[3,-2],[3,-1],[5,-1],[4,-1],[3,-4],[6,-1],[2,-7],[4,-4],[4,-5],[1,-2],[2,-5],[0,-2],[2,-1],[2,0],[2,-1],[1,-3],[1,-1],[0,-2],[0,-2],[3,-4],[9,-8],[3,-5],[5,-19],[0,-5],[-3,4],[-4,1],[-3,2],[-3,2],[-3,4],[-1,3],[-2,2],[-5,1],[1,-3],[2,-4],[1,-4],[0,-3],[-1,-3],[-4,1],[-4,2],[-2,2],[-6,5],[-7,8],[-2,7],[7,5],[-5,15],[-1,0],[-3,-7],[-11,-2],[-4,-5],[-6,-1],[-3,-2],[-4,-2],[-3,-1],[-5,-2],[-1,-4],[0,-3],[-7,-3],[-10,-4],[-4,9],[3,5],[-3,7],[2,6],[9,3],[8,3],[7,-2],[3,6],[-3,3],[-4,1],[-5,-1],[-6,5],[1,5],[0,6],[-7,2],[9,6],[3,3],[3,3],[5,1],[4,-1],[3,2],[0,2],[-3,3],[1,1],[3,0],[2,-2]],[[8146,1770],[-5,-2],[-2,2],[-2,4],[0,7],[-1,6],[1,4],[-1,2],[-6,5],[-1,2],[0,2],[2,1],[2,2],[1,2],[1,2],[0,2],[1,5],[1,3],[2,0],[2,-1],[1,-2],[1,-3],[3,-1],[3,0],[3,0],[4,-3],[11,-14],[1,-3],[2,-2],[1,-2],[-1,-2],[-18,-10],[-2,-3],[-4,-3]],[[7896,1825],[2,-4],[-1,-4],[0,-4],[2,-2],[3,2],[2,-2],[2,-2],[-1,-4],[0,-2],[0,-4],[-2,-4],[-2,0],[-1,2],[-3,4],[-6,0],[-1,3],[-4,1],[-4,4],[-3,3],[2,3],[4,1],[4,0],[0,4],[-4,2],[-4,-2],[-3,3],[2,5],[4,3],[4,-2],[4,-4],[4,0]],[[7987,1918],[6,-4],[9,-4],[4,-2],[2,0],[1,12],[3,0],[13,-10],[3,-2],[3,-4],[-1,-11],[-4,-18],[-1,-11],[-1,-6],[-3,-2],[-4,1],[-3,2],[-11,8],[-11,11],[-5,6],[1,1],[1,1],[2,0],[1,0],[-7,1],[-26,-3],[0,2],[8,5],[8,2],[3,1],[-9,1],[-11,-3],[-7,-1],[1,7],[2,3],[15,14],[4,1],[10,0],[-3,1],[-1,1],[-2,2],[-1,3],[3,-1],[4,-2],[4,-2]],[[7920,1918],[-1,-4],[6,2],[2,0],[3,0],[3,-2],[2,-3],[4,-5],[-2,-5],[-5,-7],[-5,-3],[-2,5],[-10,-14],[-3,-2],[-4,2],[0,3],[2,5],[3,4],[-4,-1],[-1,-2],[-2,-4],[-1,-3],[-2,-1],[-3,0],[-2,-1],[-1,-7],[-1,0],[-1,-1],[-1,0],[0,-2],[0,-1],[0,-1],[1,-2],[0,-1],[-2,-4],[-2,-2],[-3,-2],[-4,0],[-2,1],[-4,3],[-2,2],[-2,0],[-5,1],[-11,3],[-4,3],[-2,3],[3,1],[2,-1],[2,0],[2,-1],[-2,7],[5,8],[9,8],[9,3],[-4,-9],[3,1],[7,2],[2,2],[-2,-1],[-1,0],[-3,1],[9,6],[5,3],[3,-2],[2,3],[4,4],[2,2],[-4,1],[-2,1],[0,2],[3,5],[5,5],[3,3],[10,3],[3,-1],[2,-6],[-2,-3],[-7,-4]],[[7906,1959],[2,-1],[3,1],[1,-3],[2,-4],[4,-2],[4,-1],[-5,10],[-1,3],[1,4],[4,0],[8,-1],[5,-2],[5,-5],[4,-6],[2,-8],[5,-13],[0,-2],[1,-1],[1,-1],[3,-2],[1,-1],[1,-5],[-1,-4],[-3,-4],[-5,-1],[-7,2],[-3,6],[-6,19],[1,2],[-1,1],[-3,0],[-5,-3],[-3,0],[-2,3],[-1,-3],[-1,-1],[-1,0],[-2,-1],[-1,0],[-3,0],[-1,-1],[-1,-1],[-1,-3],[-1,0],[-8,-11],[-4,-2],[-4,1],[-5,2],[-3,3],[1,4],[4,3],[4,3],[3,2],[3,5],[-5,0],[-4,-2],[-4,-4],[-5,-2],[-6,-1],[-6,0],[-7,2],[-5,4],[-2,3],[0,5],[0,6],[2,5],[3,5],[5,3],[4,0],[3,-5],[1,5],[3,2],[3,0],[4,-3],[-1,8],[4,-1],[6,-2],[7,0],[-3,-3],[-9,-11],[-2,-2],[4,-1],[5,3],[6,4],[2,2],[2,3],[5,5],[4,4],[3,0],[-1,-3],[-2,-2],[-2,-3],[-2,-1],[-1,-1],[0,-3]],[[7984,1950],[-2,-2],[-2,-1],[-4,2],[-2,0],[-1,-1],[1,-2],[1,-1],[2,-1],[2,0],[8,2],[4,-5],[-2,-5],[-8,0],[-7,0],[-7,-4],[-7,-3],[-6,4],[-3,6],[-3,8],[0,8],[3,6],[-4,1],[-4,1],[-3,3],[-2,2],[-3,7],[-1,4],[0,2],[8,-1],[15,-4],[20,-9],[7,-6],[3,-6],[-1,-2],[-2,-3]],[[8431,1864],[2,-2],[15,-2],[-1,-2],[-7,-1],[-3,-2],[0,-5],[-73,-1],[-3,-2],[0,-7],[2,-8],[-1,-3],[-4,-4],[-9,-4],[-4,-3],[-3,-4],[0,-5],[2,-3],[0,-4],[-3,-4],[-7,-6],[0,-2],[3,-5],[3,-3],[6,-6],[3,-4],[1,-5],[-2,-4],[-3,-4],[-2,-4],[2,-4],[3,-4],[8,-5],[6,-9],[1,-7],[-5,-6],[-12,-9],[-1,-4],[0,-4],[-1,-4],[-2,-4],[-4,-3],[-1,-3],[4,-4],[13,-8],[3,-3],[2,-5],[0,-3],[-12,-16],[-3,-7],[3,-7],[29,-20],[9,-4],[5,-3],[5,-6],[5,-8],[4,-9],[3,-8],[0,-5],[-1,-10],[1,-5],[2,-14],[0,-15],[1,-4],[3,-4],[10,-10],[3,-4],[1,-9],[0,-10],[2,-8],[9,-6],[10,0],[10,4],[10,5],[17,13],[8,5],[29,12],[5,1],[5,-2],[12,-9],[5,-2],[10,0],[16,13],[10,4],[29,-5],[8,-5],[6,-1],[4,-2],[0,-4],[-9,-12],[-1,-4],[0,-4],[2,-4],[6,-7],[7,-6],[4,-7],[2,-9],[-2,-22],[-3,-12],[-4,-6],[-6,-1],[-4,-1],[-3,-2],[-4,-6],[-6,-6],[-2,-4],[0,-5],[5,-9],[7,-6],[18,-8],[4,-4],[0,-3],[-3,-4],[-10,-10],[-2,-4],[0,-5],[-1,-15],[-1,-4],[-1,-2],[-2,-2],[-1,-2],[-1,-2],[0,-3],[1,-2],[0,-2],[-1,-2],[-16,-12],[-7,-8],[5,-6],[6,-1],[6,0],[6,-1],[5,-4],[2,-4],[2,-15],[3,-5],[4,-2],[22,-5],[11,-5],[16,-10],[14,-13],[7,-4],[5,-6],[3,-7],[-3,-8],[-1,-11],[11,-5],[18,0],[53,-1],[52,0],[53,-1],[52,0],[52,-1],[53,0],[52,-1],[53,0],[18,-1],[28,-8],[39,-11],[42,-13],[63,-1],[48,-11],[35,-14],[8,-2],[47,-5],[4,-1],[7,-4],[4,0],[18,-3],[5,-2],[2,-2],[0,-10],[-6,3],[-21,-1],[-35,9],[-16,-2],[-9,2],[-18,0],[-11,5],[-4,1],[-10,4],[-18,11],[-11,4],[-12,2],[-12,-1],[-26,-10],[-13,-1],[-9,-1],[-2,-2],[-5,-4],[-2,-2],[0,-2],[-2,-20],[-2,-5],[-5,-1],[-6,-2],[-2,-4],[-1,-5],[-1,-5],[-3,-4],[-9,-5],[-5,-3],[-4,-4],[-5,-4],[-10,-1],[-14,3],[-8,5],[-4,3],[-4,2],[-6,-3],[-9,-4],[-8,-5],[-32,-11],[-16,-3],[-7,-4],[-4,-5],[-2,-8],[-8,3],[-7,0],[-4,2],[-7,-1],[-2,-2],[-1,-4],[-8,1],[-4,-4],[-31,-13],[-7,0],[0,5],[6,4],[5,3],[-1,4],[-5,0],[-5,-2],[-5,0],[-3,-1],[-2,-4],[5,-4],[-4,-3],[-5,3],[-6,-1],[-6,-4],[-6,0],[-3,-4],[-4,0],[0,4],[-2,5],[-2,0],[-3,-1],[-2,-2],[-2,-2],[-10,-1],[-4,0],[-3,0],[-2,2],[-2,0],[-2,-1],[1,-3],[3,-1],[2,0],[7,-2],[1,-1],[0,-1],[0,-3],[0,-1],[2,-2],[2,0],[2,1],[8,-1],[1,-2],[-2,-3],[-2,-1],[-9,-3],[-3,-1],[-1,-1],[-3,-5],[-1,-2],[-1,-5],[-1,-1],[-1,-8],[-4,0],[-5,0],[-2,-3],[6,-1],[6,-1],[6,-1],[0,-4],[0,-5],[0,-5],[-1,-3],[-12,-15],[-1,-3],[-1,-7],[-3,-6],[-12,-16],[-3,-6],[-1,-6],[0,-21],[-2,-6],[-5,-9],[-1,-5],[-1,-6],[1,-5],[2,-11],[8,-20],[2,-12],[0,-5],[-1,-7],[-3,-5],[-3,-2],[-2,-3],[0,-7],[1,-7],[0,-6],[-5,-8],[-9,-6],[-45,-16],[-13,-3],[-12,2],[-22,9],[-11,3],[-39,2],[-17,7],[-3,1],[-3,3],[-2,1],[-15,4],[-5,4],[-2,1],[-4,2],[-2,9],[-4,1],[-3,-2],[-3,-6],[-3,-1],[-3,1],[-4,5],[-4,2],[-4,5],[-2,1],[-3,0],[-1,-2],[1,-1],[-1,-2],[-5,-3],[-3,0],[-3,2],[-2,2],[-6,0],[-3,2],[-17,14],[-9,7],[-6,3],[-7,2],[-1,2],[-1,3],[-1,3],[-3,1],[-4,2],[-3,2],[-12,12],[-2,1],[-2,5],[-8,10],[-3,4],[2,5],[5,3],[4,3],[-2,5],[-2,3],[0,2],[1,2],[2,1],[5,2],[21,14],[4,2],[29,-4],[5,1],[5,-1],[4,-3],[4,-15],[1,-6],[-2,-5],[-1,-3],[-3,-2],[-2,0],[-6,5],[-2,-1],[-1,-6],[-5,-3],[-11,-4],[-6,-2],[8,-2],[6,1],[7,1],[11,2],[3,1],[5,4],[4,3],[1,1],[2,0],[4,-1],[2,0],[3,11],[-4,14],[0,13],[9,6],[4,0],[6,-3],[3,0],[3,0],[4,2],[3,1],[6,-1],[3,-2],[2,-5],[4,-23],[0,-5],[2,-4],[2,-5],[3,-5],[0,-6],[-4,-4],[-5,-4],[-7,-3],[-4,-1],[-6,-1],[-16,-6],[-6,-2],[-2,-1],[-1,-4],[0,-3],[0,-2],[2,-1],[3,0],[5,1],[10,6],[5,2],[13,1],[7,2],[5,3],[7,9],[2,2],[0,3],[-3,5],[-1,3],[2,6],[0,3],[-1,2],[0,1],[-2,8],[0,6],[7,25],[4,3],[8,1],[3,1],[2,0],[6,0],[4,1],[2,1],[8,7],[3,1],[7,1],[15,6],[2,1],[11,0],[4,0],[5,2],[5,2],[5,4],[5,3],[2,3],[3,6],[2,3],[2,2],[4,2],[2,3],[1,5],[1,5],[2,5],[9,8],[6,-1],[12,3],[0,10],[-7,9],[-4,8],[-10,-1],[-9,7],[-14,-4],[-10,-1],[-4,6],[-3,4],[-4,11],[0,-6],[0,-5],[-1,-5],[1,-8],[0,-3],[-5,-1],[-6,1],[-5,2],[-3,0],[-2,-1],[-2,-3],[-2,-1],[-1,0],[-4,-6],[-11,-6],[-8,-1],[-7,-6],[-6,0],[-9,-4],[-7,-2],[-10,-6],[-14,-5],[-5,-5],[-11,-2],[-3,-6],[-17,-14],[-5,-7],[-1,-2],[-3,0],[-3,0],[-3,1],[-6,-3],[-4,0],[-4,1],[-4,3],[-5,3],[-2,2],[-2,2],[-2,4],[-2,2],[-3,3],[-2,1],[-3,1],[-6,1],[-5,3],[-3,0],[-6,-1],[1,-2],[5,-3],[4,-4],[-4,0],[-5,0],[-13,5],[-4,0],[-26,-1],[-10,-3],[-6,-3],[5,-2],[5,1],[5,2],[5,1],[10,-3],[5,-1],[4,3],[6,2],[11,-17],[22,-5],[4,-1],[3,-3],[1,-3],[0,-3],[-3,-3],[-5,-1],[-6,0],[-6,1],[-5,5],[-5,1],[-10,0],[0,-2],[8,-1],[3,-4],[-2,-4],[-9,0],[-20,8],[-9,1],[9,-5],[3,-2],[-1,-4],[-5,0],[-5,3],[-7,6],[-5,-1],[0,-2],[3,-3],[5,-3],[12,-1],[6,-2],[3,-4],[-3,-2],[-2,-2],[-3,-2],[-5,-1],[-4,2],[-4,3],[-3,1],[-5,-2],[5,-4],[3,-7],[-1,-8],[-4,-6],[-8,-2],[-8,3],[-7,5],[-5,7],[-2,-6],[4,-5],[10,-7],[3,-3],[2,-3],[3,-2],[4,-1],[1,1],[1,3],[1,1],[1,1],[6,-1],[3,-2],[24,-29],[4,-4],[-37,-2],[-2,1],[-1,1],[-1,2],[-2,2],[-5,2],[-11,2],[-5,3],[-2,2],[-1,2],[-1,2],[-3,1],[-10,1],[-2,0],[-3,4],[1,8],[-3,4],[-5,4],[-1,-3],[0,-5],[-2,-4],[-4,-2],[-1,4],[-1,6],[-1,4],[-5,0],[-6,0],[-5,1],[1,4],[-4,2],[-13,2],[-31,17],[-15,4],[-7,3],[-6,4],[-5,5],[-7,10],[-3,2],[-7,3],[-2,3],[28,-9],[10,0],[5,1],[8,3],[24,3],[5,0],[4,-2],[3,-2],[3,-4],[2,-1],[6,0],[3,-1],[2,-1],[19,-8],[4,0],[2,-2],[-1,-4],[-2,-4],[-3,-3],[2,-1],[3,-2],[2,1],[3,2],[3,-2],[2,1],[-1,2],[-2,4],[2,1],[4,3],[3,2],[-2,2],[-6,1],[-8,5],[-6,5],[-3,5],[4,0],[12,-4],[-3,5],[-4,3],[-2,3],[4,1],[5,0],[17,-3],[-2,3],[-3,1],[-4,1],[-4,2],[-1,4],[0,1],[-3,0],[-1,-1],[-1,-1],[-2,-1],[-10,0],[-4,0],[-6,-7],[-4,-2],[-15,9],[-5,3],[1,4],[9,8],[3,6],[0,5],[-4,-4],[-3,-1],[-2,-1],[-1,2],[-2,2],[0,2],[1,2],[2,5],[-3,5],[-3,5],[-1,4],[-1,2],[1,1],[1,4],[1,1],[2,2],[1,2],[-1,3],[-9,6],[-2,3],[3,4],[7,1],[13,2],[10,7],[16,4],[5,3],[9,13],[3,0],[2,-1],[6,-4],[9,-3],[2,-1],[0,-8],[-9,-7],[-11,-7],[-6,-6],[2,-5],[4,3],[6,5],[10,4],[4,4],[5,3],[6,-2],[-4,-2],[-3,-3],[-1,-3],[5,-1],[3,2],[6,4],[2,1],[9,2],[4,0],[1,-4],[2,-5],[3,-4],[3,0],[3,4],[-1,4],[1,4],[3,4],[2,2],[4,3],[16,6],[2,1],[2,1],[2,3],[1,1],[2,5],[1,2],[5,1],[11,1],[5,3],[0,6],[4,1],[11,-2],[4,2],[5,0],[3,-1],[5,-5],[6,1],[2,4],[2,3],[4,0],[4,-1],[3,-5],[7,-3],[16,-4],[52,3],[7,2],[3,4],[15,1],[10,3],[-3,8],[-10,9],[-9,4],[-14,-3],[-13,3],[-9,0],[-8,-1],[-17,4],[-18,2],[-15,-4],[-6,2],[-6,-2],[-4,0],[-6,6],[-4,4],[-2,1],[-6,1],[-19,-3],[-18,3],[-6,-1],[-5,-2],[-4,-4],[-3,-5],[-1,-4],[-2,-3],[-11,-5],[-3,-3],[2,1],[2,0],[2,0],[2,-1],[-3,-8],[-2,-1],[-3,0],[-2,2],[-4,3],[-10,5],[-1,1],[-5,2],[-5,3],[2,3],[8,7],[5,3],[4,1],[10,0],[5,1],[4,3],[-1,3],[-5,2],[-3,-1],[-4,-2],[-3,-1],[-2,0],[-6,0],[-3,0],[-7,-3],[-2,-1],[-2,-1],[-2,-4],[-3,-1],[-4,0],[-6,2],[-4,2],[0,2],[-6,3],[-5,-1],[-5,-2],[-18,-3],[-4,1],[-1,1],[-1,3],[-1,2],[-9,3],[-3,1],[-1,-3],[1,-5],[-1,-2],[-1,-2],[-1,-2],[0,-2],[-4,-7],[-1,-1],[-1,-5],[-2,-4],[-2,-3],[-3,-3],[-12,-11],[-2,-2],[4,-4],[8,7],[17,20],[5,5],[5,2],[5,-7],[6,-3],[12,-2],[6,0],[2,0],[2,-2],[1,-3],[-1,-3],[-8,-7],[-12,-9],[-4,-5],[-2,-2],[-4,0],[-6,-1],[-3,0],[-1,-2],[-2,-6],[-6,-2],[-13,0],[-15,-9],[-2,-2],[2,-4],[9,-6],[3,-4],[-4,-3],[0,-5],[1,-8],[1,-2],[3,-3],[1,-2],[-2,-10],[-2,-4],[-4,-4],[-4,-2],[-1,2],[-2,0],[-25,-11],[-5,0],[-6,2],[-3,4],[-2,2],[0,2],[1,2],[3,2],[2,2],[0,3],[-4,2],[-4,-4],[-3,-6],[-1,-3],[2,-2],[3,-1],[2,-2],[0,-1],[-1,-3],[-3,-1],[-3,1],[-2,1],[-3,1],[-2,2],[-2,1],[-18,3],[-7,5],[-6,9],[-3,0],[-7,-1],[-2,2],[-4,4],[-1,2],[3,2],[9,0],[3,0],[2,-1],[2,-2],[2,-1],[4,0],[-2,2],[-1,2],[-2,2],[0,2],[1,2],[3,1],[7,-1],[0,1],[0,2],[1,2],[1,1],[2,0],[2,-2],[5,-1],[5,-3],[3,-1],[-1,2],[-4,7],[6,-1],[2,-1],[-1,5],[2,3],[5,1],[-2,3],[-18,-4],[-3,5],[-1,2],[-3,-1],[-4,-1],[-3,-1],[-3,3],[-2,4],[-3,4],[-4,1],[-21,4],[-12,3],[-5,4],[6,4],[10,2],[9,-3],[-2,-7],[4,1],[6,7],[3,1],[3,-1],[3,-6],[2,1],[2,1],[3,1],[3,0],[4,-1],[2,1],[2,1],[2,1],[10,-2],[5,1],[3,3],[-3,0],[-2,0],[-2,1],[0,3],[-2,2],[-7,-2],[-3,2],[-1,1],[-1,2],[0,5],[1,2],[2,0],[4,-2],[4,2],[3,3],[3,3],[2,5],[1,2],[-1,2],[1,2],[2,1],[8,0],[4,0],[3,3],[1,3],[1,5],[4,11],[1,2],[17,-1],[6,-2],[3,0],[1,1],[-1,2],[-2,1],[-7,-1],[-14,4],[-2,1],[0,2],[2,2],[1,3],[3,3],[7,0],[12,-1],[19,-4],[5,-4],[2,-1],[3,2],[-1,2],[-2,3],[-2,2],[-3,1],[-10,1],[-14,4],[-8,0],[-5,-1],[-5,-3],[-5,-1],[-5,1],[-4,2],[-5,9],[-3,4],[-1,-2],[0,-2],[1,-3],[1,-2],[-1,-3],[-2,-1],[-3,0],[-3,0],[-1,-4],[9,-1],[3,-4],[2,-5],[3,-7],[-6,-7],[-4,-4],[-5,-1],[-3,-3],[-4,-10],[-3,-3],[-5,0],[-7,2],[-4,5],[1,4],[4,4],[2,3],[1,3],[-1,1],[-2,0],[-3,-1],[-2,0],[-3,0],[-3,1],[-2,1],[0,4],[-1,2],[-2,3],[-2,1],[-2,-1],[-1,-4],[5,-11],[0,-5],[-3,-3],[-3,0],[-6,1],[-3,-1],[-1,-2],[0,-2],[-1,-3],[-4,0],[-4,2],[-4,0],[0,-6],[-6,1],[-5,-2],[-10,-10],[-1,0],[-2,0],[-1,0],[-1,0],[1,-2],[0,-1],[1,0],[0,-1],[-1,-3],[-3,1],[-5,5],[-8,1],[-3,2],[0,3],[6,6],[3,2],[12,2],[5,3],[4,5],[-5,0],[-13,-3],[-5,0],[-2,3],[-1,4],[-2,5],[7,2],[4,1],[1,3],[1,3],[1,0],[2,0],[2,0],[2,1],[0,1],[1,1],[2,0],[2,0],[0,-1],[1,0],[1,0],[3,0],[2,1],[0,2],[-1,2],[-2,1],[-12,2],[-1,1],[3,2],[6,3],[1,1],[3,5],[1,0],[15,0],[-5,3],[-3,2],[0,3],[4,7],[-5,1],[-3,-3],[-3,-4],[-5,-2],[-17,5],[-3,2],[1,6],[1,4],[2,2],[5,1],[2,-1],[2,-2],[1,-1],[2,0],[2,2],[1,2],[1,6],[1,1],[2,3],[1,3],[-2,1],[-6,4],[-1,1],[-2,5],[1,3],[3,4],[3,4],[0,7],[-2,2],[-5,0],[-5,2],[0,1],[-1,3],[-1,3],[-1,0],[-1,2],[-7,3],[-2,6],[-7,7],[-6,7],[2,10],[5,2],[4,-1],[5,-5],[1,-2],[8,-12],[3,-8],[2,-4],[4,1],[4,2],[3,-4],[2,-6],[2,-4],[5,-2],[5,2],[3,2],[4,2],[2,1],[-3,3],[-9,5],[6,1],[8,-1],[7,-4],[10,-10],[6,-4],[7,-3],[7,-1],[7,2],[7,3],[5,6],[2,8],[-1,6],[1,2],[2,3],[3,1],[4,-1],[4,-2],[3,-3],[6,6],[7,5],[8,4],[8,1],[5,0],[2,-2],[1,-2],[1,-5],[0,-3],[-1,-4],[-1,-4],[-1,-3],[-3,0],[-4,1],[-2,1],[-2,-1],[-1,-2],[-1,-2],[-1,-1],[-3,-3],[-2,-4],[-2,-4],[0,-3],[1,-4],[3,2],[9,10],[3,1],[5,0],[11,-3],[5,-4],[2,-2],[-2,-4],[3,-1],[6,-1],[3,-2],[1,-1],[2,1],[4,4],[2,1],[0,3],[0,3],[1,3],[4,5],[1,3],[0,6],[2,4],[7,8],[3,6],[0,5],[-3,1],[-13,-10],[-4,-4],[-2,-5],[0,-9],[-1,-4],[-3,-5],[-4,-1],[-5,3],[-6,3],[-3,3],[1,3],[-2,8],[2,7],[-2,8],[1,4],[3,2],[3,-1],[2,-4],[2,-1],[2,2],[2,8],[1,3],[1,3],[1,8],[2,4],[2,1],[5,2],[4,1],[3,0],[14,-8],[11,-3],[2,-2],[0,-5],[-4,-3],[-3,-4],[3,-6],[2,-2],[6,-3],[3,-1],[1,-2],[1,-2],[1,-2],[3,-1],[1,2],[1,1],[2,-1],[3,-2],[1,-2],[4,-5],[1,-1],[2,-6],[4,-4],[3,-4],[0,-7],[-1,-1],[-2,-2],[-2,-2],[-1,-2],[0,-2],[-2,-4],[-1,-9],[-2,-5],[-4,-3],[-5,-1],[-3,0],[-3,1],[-3,1],[-2,2],[-2,1],[-2,-1],[-2,-5],[-4,-4],[-6,-3],[-6,-1],[-4,4],[2,-5],[-2,-1],[-3,0],[-2,0],[-2,-1],[-5,-6],[-4,-3],[-7,-2],[-6,-2],[-6,0],[0,-2],[1,-1],[1,0],[2,0],[6,0],[12,4],[11,2],[10,5],[6,1],[7,0],[18,-3],[6,-2],[4,-4],[5,-3],[6,1],[4,4],[-3,2],[-20,2],[-4,1],[-2,2],[-2,2],[1,1],[3,1],[3,1],[8,6],[7,6],[4,3],[4,1],[3,2],[7,24],[0,5],[-2,4],[-24,23],[-7,4],[-9,9],[-2,3],[-2,17],[-1,2],[2,1],[2,2],[2,1],[3,0],[1,-2],[2,-3],[1,-2],[4,0],[2,1],[1,6],[2,1],[3,0],[5,-3],[3,0],[6,1],[4,2],[4,3],[3,4],[-3,5],[-7,6],[-2,3],[0,6],[2,4],[7,8],[-6,5],[-4,11],[-3,4],[-9,2],[-11,7],[-3,3],[-3,3],[-8,12],[-4,3],[-6,3],[-6,2],[-6,1],[-15,0],[-2,1],[-5,4],[-2,1],[-7,0],[-4,0],[-3,1],[-1,3],[-2,4],[-1,2],[-6,3],[-13,2],[-6,1],[-4,2],[-2,5],[-1,6],[1,4],[-3,0],[-7,-5],[-4,-2],[-25,-5],[-3,-1],[-2,-3],[1,-3],[4,-3],[5,-1],[12,3],[4,2],[4,1],[4,-3],[4,-1],[12,0],[2,-3],[1,-2],[0,-2],[0,-2],[-2,-2],[-1,-2],[-5,-2],[-7,-6],[-1,-3],[2,-2],[15,10],[3,1],[0,1],[0,2],[0,1],[2,2],[3,2],[3,1],[2,-2],[7,-7],[1,-1],[5,-1],[15,-8],[5,0],[5,1],[5,0],[5,-3],[4,-4],[9,-15],[2,-3],[1,-1],[3,-1],[13,-2],[1,0],[2,-3],[1,0],[2,-1],[4,1],[7,-1],[2,-1],[1,-3],[-1,-5],[-2,-5],[-4,-4],[-6,-3],[-6,-5],[-3,-2],[-3,0],[-10,0],[-4,-1],[-2,0],[0,1],[-1,1],[-1,3],[-1,0],[-11,2],[-3,2],[-3,4],[-4,5],[-7,1],[-6,-3],[-3,0],[-2,2],[-1,2],[-2,0],[-10,-2],[-3,-1],[-3,2],[0,2],[0,3],[1,3],[-1,3],[-2,0],[-8,1],[-1,1],[-1,3],[-2,1],[-3,1],[-2,0],[-12,-2],[-7,-1],[-5,3],[-3,6],[1,5],[0,3],[-11,2],[-3,5],[-3,2],[-3,0],[-3,-1],[-2,-1],[-2,-2],[10,-5],[4,-2],[2,-5],[0,-4],[-1,-2],[0,-2],[2,-4],[3,-1],[3,-1],[30,-1],[10,-5],[8,-12],[-8,3],[-9,6],[-9,3],[-8,-7],[2,-1],[3,0],[3,0],[2,2],[3,1],[2,0],[3,-2],[3,-2],[1,-5],[-1,-5],[0,-4],[-8,-5],[-21,-2],[-8,-5],[4,-2],[5,-1],[5,1],[4,3],[3,1],[9,0],[3,1],[5,4],[8,5],[9,3],[7,-2],[5,-8],[-4,-2],[-15,-4],[-14,-8],[-4,-1],[-6,-1],[-5,-1],[-4,-3],[-2,-5],[-1,-4],[-4,-13],[0,-6],[0,-5],[-1,-4],[-4,-2],[-7,0],[-4,3],[-7,10],[-1,4],[2,13],[-1,3],[-2,2],[-5,14],[2,7],[-1,10],[-7,27],[-2,7],[-5,6],[-6,6],[-1,-4],[2,-4],[5,-6],[2,-3],[2,-8],[2,-13],[1,-15],[4,-25],[1,-16],[5,-22],[1,-9],[-3,-6],[-5,0],[-6,2],[-4,3],[-8,3],[-2,1],[0,3],[-2,3],[-2,1],[-8,2],[-20,10],[-6,4],[-4,5],[0,4],[2,5],[-2,5],[-4,4],[-3,4],[3,0],[1,0],[2,1],[2,1],[-4,4],[-6,8],[-6,8],[-1,5],[7,4],[5,-2],[8,-11],[6,-5],[3,-3],[1,-4],[0,-3],[2,-4],[2,-3],[9,-4],[3,-7],[4,-6],[8,0],[-3,7],[-16,19],[2,1],[1,1],[2,0],[2,0],[-2,3],[-2,1],[-2,0],[-2,2],[-1,2],[0,5],[-2,1],[-5,2],[-2,3],[0,4],[2,4],[-7,3],[-6,6],[-3,4],[13,4],[7,3],[7,5],[3,5],[-6,-1],[-5,-2],[-10,-6],[0,10],[-2,-2],[-4,-6],[-3,-2],[-5,0],[-3,3],[-1,4],[-1,2],[-5,-1],[-1,-1],[0,-3],[-4,-6],[-2,-4],[0,-3],[1,-4],[-4,-4],[-5,3],[-10,10],[0,5],[-11,7],[1,5],[5,2],[11,3],[5,3],[-5,0],[-5,-1],[-6,-1],[-5,3],[-3,1],[-2,0],[-3,0],[-3,-1],[-2,1],[-3,2],[-3,1],[-3,-2],[-1,2],[0,2],[0,1],[1,2],[2,3],[2,1],[2,0],[2,2],[9,7],[2,3],[-15,0],[-6,2],[-3,8],[1,2],[2,1],[1,2],[-1,2],[-1,1],[-1,3],[-1,1],[-2,3],[1,6],[-2,2],[0,2],[8,6],[5,2],[2,-3],[2,-3],[11,0],[3,-3],[1,-4],[4,-3],[7,-6],[9,-4],[3,-3],[2,-3],[6,-12],[2,-7],[6,-7],[2,-8],[2,0],[2,4],[0,5],[-1,3],[-7,11],[5,4],[3,2],[-1,1],[-7,0],[-3,1],[-2,3],[1,6],[13,5],[0,5],[-9,-4],[-7,2],[-6,6],[-6,15],[0,2],[0,10],[0,3],[1,1],[0,2],[-2,2],[-4,3],[-1,1],[-1,3],[-1,1],[-5,2],[-2,1],[0,3],[1,2],[2,2],[0,1],[3,3],[5,-4],[8,-8],[0,-2],[0,-3],[0,-2],[2,-2],[3,0],[0,3],[-2,5],[-1,8],[1,3],[4,2],[0,1],[-4,0],[-4,0],[-2,1],[-3,1],[2,3],[6,8],[-3,2],[-2,-1],[-2,-2],[-3,-1],[-2,1],[-6,6],[-1,-2],[1,-2],[1,-1],[1,-2],[0,-3],[0,-1],[-1,-1],[-4,-2],[-17,-14],[-5,-2],[-4,-1],[-4,2],[-6,6],[-6,4],[-2,1],[-1,2],[-1,7],[-2,4],[-4,5],[-3,2],[-2,-4],[1,-6],[2,-5],[0,-5],[-3,-5],[-6,-1],[-6,2],[-5,3],[-6,1],[-2,3],[1,17],[0,5],[-4,3],[-1,2],[0,3],[2,2],[11,13],[5,4],[-2,1],[0,2],[1,2],[2,2],[0,1],[-4,0],[-3,-2],[-19,-18],[-3,-1],[-8,0],[-2,2],[0,10],[0,4],[4,2],[0,3],[-3,2],[-5,2],[6,8],[8,6],[11,3],[11,1],[25,-4],[5,-1],[5,-1],[5,2],[1,5],[6,-2],[6,-4],[5,-5],[-1,-6],[13,-7],[0,3],[3,4],[0,3],[-7,11],[-9,8],[-1,1],[-2,0],[-2,0],[0,2],[0,2],[2,0],[1,1],[0,1],[3,5],[5,1],[7,-3],[6,-5],[3,-1],[4,0],[1,3],[-1,2],[-7,2],[-3,2],[1,2],[2,3],[1,4],[0,4],[0,4],[-3,7],[0,4],[3,4],[4,3],[4,1],[9,1],[7,3],[4,0],[3,0],[4,-1],[4,-2],[3,-2],[7,-11],[2,-1],[4,0],[1,1],[0,1],[0,3],[2,2],[3,1],[8,0],[-3,4],[-5,0],[-5,0],[-5,2],[-1,4],[-1,2],[-2,1],[-2,0],[-5,0],[-8,1],[-8,4],[-13,11],[-1,3],[2,4],[2,3],[3,2],[9,0],[4,1],[4,2],[4,5],[6,13],[4,7],[-5,0],[-5,-5],[-9,-13],[-3,-2],[-2,-1],[-3,-1],[-7,-1],[-4,-3],[-7,-2],[-2,-5],[-2,-11],[-2,-3],[-2,-1],[-2,-2],[0,-4],[0,-3],[1,-2],[0,-3],[-7,-8],[1,-5],[2,-5],[1,-6],[-3,-4],[-5,-5],[-6,-4],[-4,0],[-2,0],[-3,-2],[-3,-5],[-3,-2],[-3,-1],[-9,0],[-13,2],[-4,2],[-12,9],[-3,4],[13,7],[3,2],[-1,4],[-4,3],[-10,4],[1,-4],[0,-1],[1,-2],[-5,-5],[-3,1],[-5,11],[-3,5],[-9,10],[-4,6],[4,5],[4,3],[1,4],[-6,4],[-3,0],[-3,0],[-2,2],[-2,7],[-2,3],[-5,4],[4,1],[14,3],[3,0],[1,-4],[2,-4],[3,-5],[2,-3],[3,-4],[4,-10],[4,-3],[4,1],[-2,5],[-7,8],[1,2],[2,3],[2,1],[-6,2],[-2,3],[2,3],[6,1],[4,-2],[8,-7],[5,-2],[26,-4],[5,-2],[5,-1],[4,2],[-6,3],[-16,5],[-7,0],[-3,2],[-1,3],[1,4],[1,3],[1,2],[-2,2],[-2,0],[-2,0],[-5,-5],[-4,-1],[-2,1],[-4,5],[-5,4],[-2,2],[3,2],[3,0],[4,2],[2,2],[1,3],[2,2],[4,2],[7,3],[-4,0],[-8,2],[-4,-1],[0,-1],[-1,-5],[0,-1],[-2,0],[-3,-1],[-13,-5],[-3,-1],[-7,2],[-4,0],[-6,-9],[-8,3],[-7,7],[-1,4],[2,2],[6,10],[1,2],[3,1],[2,3],[-3,3],[1,6],[-3,4],[-4,2],[-2,-2],[-1,-5],[-5,-7],[-1,-4],[-4,-8],[-9,-2],[-10,2],[-9,4],[2,0],[2,2],[1,1],[-3,2],[-6,-1],[-3,1],[-2,1],[-5,6],[3,3],[7,6],[3,3],[-4,0],[-5,-3],[-4,0],[-3,2],[2,2],[2,3],[2,3],[-5,-1],[-5,-2],[-6,-2],[-6,2],[1,2],[2,3],[1,2],[2,1],[-1,2],[-6,-3],[-7,-2],[-7,1],[-2,7],[0,4],[2,2],[5,3],[5,6],[3,2],[3,1],[3,1],[7,2],[3,1],[5,-1],[1,-3],[0,-2],[1,-3],[2,-1],[4,1],[2,2],[-1,3],[-2,2],[0,3],[1,2],[2,2],[4,-2],[4,-3],[-2,0],[2,0],[26,3],[3,-1],[1,-5],[1,-1],[6,-3],[3,-2],[-7,-8],[-2,-2],[3,1],[3,0],[3,1],[3,-1],[1,0],[1,-2],[1,-1],[5,-2],[4,-3],[3,-3],[2,-5],[-3,-5],[5,-3],[4,2],[7,6],[6,2],[6,-2],[32,-15],[12,-3],[11,3],[-4,3],[-23,5],[-6,4],[-5,4],[-1,3],[7,0],[-2,3],[-5,0],[-9,-1],[-1,0],[-3,3],[-2,0],[-2,0],[-4,-1],[-10,-1],[-4,1],[-4,3],[-3,3],[-1,2],[-1,7],[-2,4],[-4,7],[0,4],[-2,0],[-9,4],[-3,2],[-11,11],[-4,6],[2,5],[-2,5],[4,4],[5,2],[2,0],[1,-5],[3,0],[4,2],[4,2],[9,-2],[7,-5],[11,-13],[3,-1],[2,1],[2,1],[2,1],[2,0],[6,-3],[1,-1],[2,-3],[2,-1],[2,-1],[22,3],[4,-1],[4,-3],[3,-7],[4,-2],[1,5],[-1,6],[-2,4],[-4,3],[-8,-3],[-8,2],[-6,5],[2,7],[9,9],[2,1],[9,0],[4,0],[4,2],[-6,0],[-1,4],[1,11],[-3,-2],[-4,-7],[-3,-3],[-2,0],[-6,1],[-2,-1],[0,-1],[-1,-6],[0,-2],[-4,-5],[-5,-1],[-12,1],[-6,1],[-3,4],[-2,4],[-3,3],[-10,4],[-23,1],[-9,6],[-4,10],[-1,7],[0,3],[3,1],[3,0],[3,-1],[3,-1],[3,1],[1,2],[1,1],[1,1],[5,3],[6,3],[6,1],[24,0],[5,2],[-1,2],[0,1],[1,2],[2,2],[-8,0],[-16,-1],[-8,-3],[-11,1],[-7,-4],[-2,0],[-7,6],[-2,11],[1,11],[4,7],[10,5],[1,0],[1,1],[2,2],[3,2],[2,1],[13,1],[5,1],[10,3],[6,1],[5,0],[5,-4],[1,-4],[-1,-5],[0,-4],[3,-3],[3,12],[2,3],[4,1],[5,0],[5,-1],[3,-3],[-2,-3],[2,-2],[2,-3],[1,-3],[0,-4],[1,-3],[2,-3],[2,-2],[19,-7],[3,-4],[10,-6],[2,-3],[1,-2],[1,-3],[0,-4],[2,-2],[4,4],[4,7],[1,4],[-5,2],[-3,0],[-3,2],[-1,1],[-1,3],[-1,2],[-5,4],[-4,1],[-5,0],[-6,1],[-4,2],[0,2],[-3,7],[-1,2],[-1,2],[-1,3],[1,12],[-1,4],[-8,4],[-38,3],[-3,1],[-3,1],[-2,2],[0,4],[1,5],[0,3],[-2,1],[-2,3],[1,5],[7,20],[1,6],[0,6],[3,4],[5,1],[6,-2],[4,-2],[4,-5],[3,-5],[3,-4],[9,-3],[4,-2],[2,-1],[13,0],[0,2],[-19,6],[-5,3],[-9,9],[-4,6],[-1,6],[1,3],[5,7],[1,4],[0,2],[-1,1],[-2,2],[-2,7],[-1,2],[-2,3],[-7,6],[15,11],[8,4],[10,-1],[7,-5],[4,-3],[4,1],[3,3],[-2,3],[-9,3],[-4,3],[-6,0],[-27,-4],[-4,1],[-2,2],[-2,-2],[0,-4],[0,-2],[1,-2],[3,-5],[1,-2],[-1,-6],[-2,-4],[1,-4],[4,-3],[-10,-14],[-7,-6],[-6,-1],[-2,1],[-4,5],[-2,1],[-2,0],[-2,-1],[-2,-1],[1,-2],[1,-2],[5,-2],[1,-2],[0,-2],[2,-4],[1,-2],[-1,-2],[-1,-2],[1,-2],[1,-2],[-1,-3],[-1,-3],[-1,-4],[0,-3],[-1,-4],[-3,-5],[-1,-2],[-3,-19],[1,-5],[-6,-9],[-6,-1],[-7,4],[-8,9],[-3,3],[-2,4],[-2,4],[-4,2],[-6,2],[-4,1],[-3,3],[-3,4],[-1,4],[2,3],[3,3],[2,4],[0,4],[-4,25],[2,6],[8,2],[-7,8],[-3,4],[0,6],[0,3],[3,4],[0,3],[-1,3],[-3,-1],[-4,-3],[-1,-2],[-4,3],[-2,3],[-1,4],[0,5],[2,3],[4,2],[4,1],[3,2],[2,3],[1,4],[-1,3],[-3,3],[-1,4],[4,1],[5,0],[4,-1],[-3,3],[-8,2],[-3,2],[-2,3],[-1,3],[1,2],[3,1],[0,2],[-6,3],[-1,5],[1,6],[3,5],[8,7],[2,3],[1,3],[1,3],[3,2],[7,-8],[1,-1],[0,1],[-1,3],[8,-3],[8,2],[8,4],[8,2],[19,-2],[4,-1],[3,-2],[3,-1],[2,0]],[[8080,1998],[3,-1],[7,3],[3,-1],[1,-3],[-1,-3],[-3,-3],[-1,-3],[1,-3],[2,-7],[0,-2],[-2,-3],[-5,-4],[-2,-3],[4,0],[3,0],[4,1],[2,2],[0,3],[0,5],[0,4],[-1,3],[0,6],[4,7],[6,6],[7,1],[4,-4],[0,-7],[-1,-16],[0,-14],[-2,-4],[-4,-2],[-2,-3],[1,-4],[7,3],[5,0],[4,-3],[3,-7],[1,-7],[-3,-6],[-5,-4],[-5,-4],[5,-3],[3,-5],[2,-5],[6,-11],[-3,-7],[1,-6],[1,-2],[3,-3],[1,-2],[1,-4],[-1,-2],[0,-2],[0,-3],[0,-15],[0,-6],[-4,-14],[-1,-11],[-2,-5],[-2,-5],[-2,-3],[-2,-3],[-6,-4],[-2,-2],[0,-3],[1,-1],[1,-1],[2,-6],[3,-3],[1,-3],[0,-3],[-1,-2],[-6,-4],[-3,-2],[-2,-1],[-1,-2],[1,-5],[-1,-3],[-3,-2],[-4,-3],[-3,-4],[-1,-5],[3,-3],[4,3],[3,4],[6,8],[1,7],[2,3],[4,2],[5,-1],[6,-2],[4,-2],[3,-5],[2,-3],[0,-5],[0,-11],[-1,-3],[-2,0],[-6,0],[-2,0],[-3,2],[-3,1],[-3,0],[-2,-1],[-5,-2],[6,-3],[13,-4],[5,-4],[1,-5],[-1,-9],[-2,-7],[-3,-4],[-1,6],[-1,3],[-3,2],[0,-5],[-3,-2],[-4,1],[-4,2],[0,-3],[2,-4],[3,-2],[4,-1],[3,-2],[1,-5],[-1,-5],[-3,-2],[-4,-1],[-3,-1],[-4,0],[-4,2],[-11,8],[-3,2],[15,-15],[2,-6],[-6,-2],[-15,-10],[-3,-1],[-5,-1],[-4,0],[-3,2],[-2,3],[2,3],[2,3],[2,3],[-3,-1],[-9,-4],[-2,-3],[-1,-4],[-3,-2],[-4,-1],[-3,1],[-5,3],[-3,4],[0,4],[3,5],[-4,0],[-3,-3],[-1,-3],[2,-5],[-9,4],[3,6],[8,7],[19,11],[4,1],[4,-2],[6,-5],[4,-2],[-4,6],[-6,5],[-7,3],[-8,-2],[-16,-10],[-10,-4],[-4,3],[-1,1],[-2,3],[0,2],[0,2],[1,4],[1,6],[3,3],[4,0],[4,1],[4,-1],[4,-2],[5,-1],[3,1],[4,3],[6,3],[4,2],[-15,-2],[-7,0],[-4,4],[1,2],[2,4],[3,3],[1,1],[3,1],[3,3],[3,2],[-1,1],[-8,1],[-2,-1],[-7,-7],[-2,-1],[-2,-1],[-2,0],[-1,1],[-1,1],[-2,9],[0,3],[2,2],[4,0],[0,2],[-4,2],[-5,4],[-3,4],[-1,4],[3,2],[5,-2],[5,-2],[5,-2],[0,2],[-9,7],[-4,4],[1,3],[1,5],[6,0],[19,-7],[3,-1],[2,1],[3,1],[3,1],[4,0],[2,-2],[-2,4],[-4,0],[-4,0],[-3,1],[-1,2],[3,6],[0,3],[-3,-2],[-2,-2],[-2,-2],[-5,-1],[-4,1],[-5,1],[-4,2],[-3,3],[-2,3],[-1,4],[1,4],[4,2],[1,1],[13,7],[4,4],[2,0],[8,-9],[1,-1],[0,2],[0,5],[-1,4],[-1,3],[0,2],[4,3],[4,1],[9,1],[4,1],[-4,2],[-4,-1],[-4,-1],[-5,0],[5,6],[12,9],[4,6],[-6,-1],[-13,-9],[-3,-1],[-2,-1],[-6,0],[-2,1],[-4,3],[-3,1],[2,-3],[4,-4],[4,-2],[4,-1],[1,-2],[-4,-3],[-7,-5],[-5,-5],[-8,-6],[-7,-1],[-1,8],[-3,-4],[-3,-6],[-2,-5],[-6,-3],[-4,3],[0,12],[-4,3],[-2,-2],[0,-3],[0,-3],[-1,-1],[-2,-1],[-2,-2],[0,-3],[0,-3],[2,-10],[-2,-2],[-8,0],[2,-2],[5,-3],[1,-2],[1,-3],[-1,-3],[-1,-2],[0,-4],[1,-3],[3,3],[4,5],[4,3],[3,-2],[-2,-6],[-3,-5],[-2,-4],[-8,-7],[-2,-4],[2,-5],[3,4],[2,2],[3,-1],[3,-3],[1,-2],[0,-1],[0,-2],[1,-3],[-8,-6],[-5,-1],[-5,-2],[-2,-2],[4,-1],[4,-2],[1,-4],[-1,-11],[-3,1],[-6,0],[-3,2],[-4,4],[-3,1],[-4,1],[-6,1],[-3,4],[-6,11],[-6,7],[-1,3],[-1,2],[1,10],[-1,2],[-1,2],[-3,2],[-6,1],[-3,2],[1,1],[2,4],[1,2],[-8,3],[-3,0],[0,2],[-1,3],[1,3],[2,1],[5,1],[3,3],[4,9],[-4,-2],[-7,-1],[-5,2],[-3,2],[1,3],[10,7],[3,5],[-4,-2],[-11,-3],[-3,0],[-3,4],[0,2],[2,3],[3,4],[-6,0],[-3,0],[-2,-1],[-1,2],[1,2],[3,4],[-5,0],[-6,2],[-4,4],[-2,6],[-2,4],[-3,5],[-1,2],[-1,1],[-1,2],[0,2],[1,5],[4,3],[4,3],[5,2],[6,-2],[3,-4],[3,-4],[6,-9],[9,-18],[20,-16],[9,-5],[-2,4],[-4,4],[-2,5],[3,3],[-8,3],[-9,6],[-6,8],[-1,8],[-4,3],[-3,3],[-1,5],[2,4],[-2,5],[4,2],[6,0],[5,-3],[18,-21],[1,-3],[2,-2],[4,-3],[4,0],[10,2],[-4,2],[-8,1],[-4,2],[-2,3],[-4,11],[0,2],[6,-1],[12,-7],[3,3],[-1,2],[-2,4],[-1,3],[4,1],[7,0],[4,1],[3,1],[-4,3],[-4,4],[-4,4],[-1,5],[6,-3],[15,-15],[11,-7],[6,-4],[2,-5],[0,-3],[1,-4],[2,-2],[3,1],[2,13],[0,15],[3,5],[7,-1],[-6,3],[-2,3],[0,3],[0,3],[2,2],[3,1],[3,0],[0,2],[-3,2],[0,3],[2,3],[2,2],[-2,2],[-1,1],[-2,3],[3,1],[3,0],[7,0],[-35,25],[4,2],[19,6],[3,-1],[6,-7],[0,9],[-1,6],[-4,3],[-6,-2],[-11,-7],[-7,-3],[-6,0],[1,2],[1,1],[-6,1],[0,4],[7,9],[-8,0],[-3,0],[-3,2],[-1,3],[1,2],[3,1],[4,1],[3,1],[7,3],[14,5],[2,1],[-10,0],[-11,-5],[-11,-2],[-9,4],[-3,5],[1,5],[3,4],[4,2],[7,-3],[5,-1],[3,-2],[3,-1],[2,-2],[-1,2],[0,1],[-1,0],[-2,1],[-3,6],[0,1],[0,1],[-6,0],[-1,1],[-2,1],[6,4],[25,10],[2,2],[5,4],[4,2],[2,-4],[3,-8],[3,-3],[1,2],[-1,3],[0,4],[1,3],[2,3],[3,2],[3,1],[14,-1],[4,-1],[3,-3],[1,-4],[0,-2],[-4,-2]],[[7978,1975],[-3,-1],[-4,1],[-15,4],[-4,2],[-4,2],[0,5],[4,4],[7,2],[5,1],[0,2],[-1,3],[10,7],[3,6],[8,7],[2,1],[3,0],[2,-2],[1,-2],[0,-5],[-1,-7],[-4,-13],[-1,-5],[-1,-3],[-2,-4],[-3,-3],[-2,-2]],[[8013,2017],[5,-1],[11,4],[6,-1],[11,-3],[0,-2],[-6,-3],[-18,-11],[-14,-5],[-8,-1],[-5,3],[1,3],[3,5],[1,3],[1,2],[3,0],[7,-1],[-3,2],[-3,2],[-2,3],[0,5],[10,-4]],[[9509,9122],[-4,-25],[-3,-10],[-1,-1],[-1,-1],[-20,-7],[-4,-2],[-4,-4],[-3,-4],[-12,-18],[-5,-5],[-5,-3],[-75,-25],[-52,-20],[-25,-8],[-13,1],[-20,9],[-3,2],[-2,2],[-25,0],[-3,2],[-2,0],[-2,0],[-3,-1],[-2,-1],[-2,0],[-7,1],[-17,-6],[-6,-10],[-3,0],[-3,-1],[-5,2],[-7,0],[-16,0],[-1,0]],[[9153,8989],[1,4],[-2,4],[-4,6],[-2,7],[-1,5],[2,2],[1,3],[2,3],[1,2],[-1,6],[-1,5],[-2,2],[0,3],[1,1],[1,2],[-1,2],[-1,2],[-2,4],[0,3],[-3,4],[-1,3],[-1,6],[-1,1],[-1,1],[-1,2],[0,1],[1,2],[0,1],[1,-1],[-1,6],[-3,3],[-6,9],[-1,7],[0,5],[2,2],[2,6],[5,4],[1,3],[-3,5],[1,4],[-1,5],[-2,4],[-1,3],[-4,3],[-3,4],[-3,3],[-4,0],[0,1],[4,2],[1,3],[-3,8],[0,6],[3,5],[0,1],[-1,1],[-1,0],[-1,1],[2,8],[0,8],[-2,26],[0,4],[1,3],[5,6],[2,4],[1,7],[-2,7],[0,5],[-4,6],[0,3],[1,3],[5,4],[4,2],[1,8],[2,2],[1,7],[-7,11],[-1,4],[1,3],[1,1],[2,1],[1,2],[0,2],[-2,6],[0,3],[2,3],[4,9],[1,5],[-1,1],[-2,4],[0,2],[0,3],[2,6],[1,2],[-1,6],[-2,7],[-1,8],[-1,7],[0,3],[2,5],[0,3],[-5,8],[0,7],[2,13],[-1,5],[-5,15],[-1,5],[-1,3],[-6,3],[-7,4],[-1,1],[7,0],[1,5],[1,2],[0,5],[1,4],[-2,12],[-1,7],[-3,6],[0,7],[-4,10],[-5,9],[0,2],[1,1],[-2,3],[-3,2],[-2,1],[0,2],[2,5],[0,3],[0,10],[0,5],[3,7],[0,1]],[[9105,9572],[13,4],[10,7],[13,6],[11,10],[12,6],[13,3],[13,2],[11,6],[16,3],[17,0],[12,0],[7,-3],[10,-5],[7,-2],[22,-1],[15,-6],[13,-3],[10,-6],[13,-1],[12,-2],[13,3],[14,10],[5,8],[7,8],[8,11]],[[9402,9630],[4,-2],[3,-4],[4,-8],[5,-13],[3,-4],[3,-2],[11,-4],[8,-6],[21,-20],[6,-6],[8,-15],[6,-4],[9,-3],[24,-19],[5,-5],[4,-5],[2,-5],[-2,-2],[-9,-4],[-3,-4],[-6,-7],[-10,-16],[-13,-20],[-4,-5],[-9,-9],[-3,-5],[-1,-5],[2,-3],[11,-9],[7,-8],[4,-3],[7,-3],[3,-2],[1,-4],[1,-1],[0,-8],[1,-3],[1,-2],[0,-2],[0,-3],[-5,-12],[0,-5],[-2,-9],[-2,-3],[-2,-2],[-2,-1],[-2,1],[-3,1],[-8,-1],[-28,-9],[-4,-4],[1,-5],[7,-5],[7,-2],[1,-2],[-1,-8],[0,-10],[2,-8],[9,-17],[-13,-5],[-5,-4],[-3,-7],[1,-8],[4,-8],[5,-7],[5,-5],[5,-4],[24,-12],[10,-8],[7,-2],[6,-6],[0,-5],[-16,-14],[-3,-5],[-2,-6],[0,-34],[4,-10],[6,-4]],[[9105,9572],[-2,2],[-1,1],[1,7],[1,3],[-1,3],[-8,23],[-1,3],[2,10],[-3,7],[-2,16],[-4,10],[-2,11],[-1,6],[1,3],[3,7],[0,7],[0,3],[1,5],[0,4],[0,2],[-3,3],[0,1],[3,5],[0,10],[1,9],[2,5],[0,3],[0,3],[-1,6],[0,2],[5,3],[1,3],[-3,4],[-2,5],[-6,7],[-5,6],[-5,6],[6,3],[11,1],[25,-2],[12,1],[6,2],[17,10],[5,2],[7,0],[5,2],[4,3],[11,14],[9,9],[5,5],[5,8],[14,33],[0,5],[0,5],[-2,5],[-5,9],[-1,5],[-1,6],[-2,11],[-4,9],[-3,9],[2,11],[8,8],[9,0],[11,-1],[11,2],[10,7],[30,31],[1,-20],[2,-9],[5,-8],[19,-18],[8,-10],[6,-12],[2,-9],[0,-19],[2,-9],[3,-6],[3,0],[3,2],[4,1],[5,-6],[1,-2],[2,0],[5,-2],[7,-4],[4,-2],[4,-1],[5,0],[4,1],[2,1],[3,-4],[0,-1],[-2,-11],[-9,-7],[-6,-7],[3,-12],[7,-8],[2,-4],[1,-6],[0,-3],[0,-2],[4,-11],[0,-3],[0,-13],[1,-5],[8,-15],[2,-5],[0,-6],[-2,-12],[0,-13],[2,-13],[5,-10],[2,-4],[0,-3],[0,-3],[-2,-4],[13,-29],[1,-3],[0,-5],[-2,-5],[-7,-10]],[[9503,8004],[-5,-1],[-3,-2],[-6,-3],[-12,-11],[-5,-3],[-6,-3],[-9,-1],[-8,1],[-11,3],[-5,0],[-6,-1],[-11,-2],[-16,0],[-2,-1],[-1,-1],[-1,-4],[-1,-3],[1,-3],[2,-2],[2,-3],[0,-1],[1,-2],[0,-3],[0,-2],[-1,-3],[0,-1],[-6,-9],[-9,-16],[-2,-4],[-1,-5],[-1,-6],[-84,-8],[-29,9],[-34,-4],[-13,-8],[-27,-14],[-30,-3],[-9,10],[-22,-4],[-29,-23],[-12,2],[-17,-1],[-36,-26],[-17,-26],[-2,-1]],[[9020,7815],[1,5],[-1,9],[-3,8],[-4,6],[-8,9],[-1,4],[-1,7],[-1,2],[-5,1],[-2,0],[2,7],[2,6],[6,1],[2,9],[-1,7],[0,5],[2,6],[3,4],[5,1],[4,6],[-1,12],[0,2],[-3,5],[0,3],[0,3],[1,2],[6,4],[1,1],[1,0],[2,0],[4,2],[8,6],[3,1],[2,3],[2,13],[2,5],[9,0],[2,1],[2,2],[1,3],[1,2],[1,2],[0,3],[-2,4],[1,3],[2,8],[1,10],[0,11],[-3,10],[-5,9],[-4,2],[-2,2],[-1,2],[0,3],[1,4],[0,2],[2,6],[3,4],[1,6],[0,6],[-12,14],[-1,6],[-1,6],[-4,11],[-2,5],[0,12],[-1,2],[-3,5],[-1,1],[0,21],[5,12],[0,2],[-1,3],[-1,6],[-1,2],[-2,2],[-1,2],[0,3],[1,2],[1,2],[1,2],[2,5],[2,9],[2,9],[-1,7],[0,2],[-2,2],[0,1],[1,0],[1,2],[1,1],[1,1],[-1,2],[-1,4],[2,2],[2,4],[-1,3],[1,3],[-1,5],[1,4],[4,8],[-1,3],[0,3],[3,6],[-2,6],[-1,5],[2,1],[1,1],[1,5],[0,8],[-2,7],[-4,11],[2,8],[4,13],[-1,7],[-2,4],[0,3],[4,6],[0,13],[0,4],[3,4],[7,6],[3,4],[4,8],[4,8],[3,10],[1,9],[-4,7],[-2,10],[-6,5],[-6,3],[-7,3],[-4,-3],[-2,-6],[-2,-3],[-2,-4],[-5,1],[-5,2],[-5,2],[-4,-5],[-2,4],[1,11],[2,5],[1,2],[3,0],[2,3],[1,3],[-2,4],[-1,0],[-1,7],[0,6],[3,8],[-1,6],[-1,5],[0,5],[0,5],[3,8],[4,3],[2,6],[-3,5],[2,7],[-4,5],[2,8],[3,5],[6,7],[5,4],[1,2],[1,0],[2,-3],[1,-2],[0,-2],[-1,-3],[-1,-2],[2,-5],[2,-3],[4,-2],[4,-1],[6,2],[6,5],[6,5],[4,6],[4,7],[2,8],[0,2],[0,1],[1,3],[1,0],[3,3],[2,4],[2,4],[0,5],[0,4],[-1,6],[-3,7],[-1,7],[2,7],[0,4],[3,6],[2,7],[-2,8],[2,2],[0,2],[-1,2],[-1,3],[2,2],[1,0],[2,1],[0,3],[0,3],[-2,4],[-1,3],[1,3],[8,15],[0,3],[0,2],[-3,5],[2,19],[0,15],[1,3],[2,4],[3,35],[-1,4],[3,11],[0,5],[3,2],[2,4],[1,5],[0,4],[-3,5],[0,1],[1,0],[1,0],[0,2],[3,5],[-1,3],[1,2],[1,2],[0,4],[0,4],[-1,2],[-3,6],[9,6],[1,13],[-1,13],[2,7],[-1,3],[-1,14],[0,3],[3,6],[4,3],[4,3],[2,4],[0,5],[2,3],[0,4],[3,2],[1,4],[-1,3],[-1,2],[-1,3],[0,2],[3,4],[2,4],[0,1]],[[9509,9122],[5,-3],[3,0],[10,0],[5,-1],[3,-4],[49,-83],[3,-11],[-1,-63],[2,-9],[14,-27],[5,-20],[3,-42],[1,-3],[2,-3],[5,-6],[12,-11],[4,-3],[4,-6],[3,-6],[1,-5],[-1,-3],[-3,-4],[0,-3],[0,-2],[7,-10],[2,-6],[0,-5],[-4,-16],[0,-5],[2,-5],[9,-17],[2,-6],[2,-12],[7,-15],[0,-5],[-8,-38],[0,-20],[1,-6],[3,-4],[9,-2],[1,0],[5,-8],[2,-2],[7,-2],[36,-2],[16,1],[9,1],[73,17],[42,-46],[-1,-8],[-4,-14],[-17,-54],[-16,-55],[-16,-54],[-1,-3],[-8,-26],[-7,-25],[-6,-17],[-5,-8],[-11,-6],[-10,-4],[-2,-1],[-4,-2],[-5,-1],[-2,-1],[-29,-13],[-29,-13],[-29,-14],[-29,-13],[-12,-5],[-12,-5],[-11,-5],[-12,-5],[-8,-3],[-4,-3],[-1,-2],[-2,-7],[-9,-14],[-3,-3],[-4,0],[-4,1],[-4,1],[-4,-2],[-10,-21],[-1,-7],[-2,-5],[-2,1],[-5,6],[-3,0],[-2,-3],[-1,-4],[0,-3],[-3,-9],[-12,-24],[-1,-6],[0,-4],[5,-14],[1,-2],[2,-2],[6,-3],[2,-2],[4,0],[3,-1],[1,-2],[2,-3],[0,-1],[-1,-1],[0,-1],[0,-1],[1,-1],[3,-2],[1,-2],[1,-2],[1,-1],[0,-2],[0,-2],[-1,-10],[5,-7],[8,-7],[5,-7],[0,-5],[-3,-3],[-5,-2],[-5,-1],[-5,0],[-3,0],[-4,0],[-4,-2],[-1,-1],[-5,-6],[-9,-28]],[[9184,6870],[-5,-2],[-8,-5],[-3,-1],[-1,0],[-20,0],[-6,2],[-6,2],[-6,4],[-6,2],[-19,4],[-7,4],[-4,5],[-4,10],[-2,4],[-3,2],[-15,11],[-5,5],[-3,6],[-3,9],[-19,76],[-5,16],[-3,4],[-4,2],[-16,5],[-4,1],[-4,-1],[-4,-2],[-1,-2],[-1,-2],[0,-3],[-1,-4],[-2,-4],[-4,-3],[-7,-3],[-29,-6],[-8,-3],[-5,-2],[-1,-3],[-1,-3],[-4,-21],[-2,-6],[-3,-7],[-3,-4],[-4,-2],[-5,0],[-5,3],[-1,2],[-1,2],[-1,2],[-1,2],[-1,1],[-2,1],[-3,0],[-6,-2],[-4,0],[-4,2],[-4,4],[-3,4],[-4,12],[-2,3],[-2,4],[-4,3],[-4,2],[-9,4],[-7,2],[-6,0],[-14,-2],[-8,-4],[0,-1]],[[8822,6999],[-2,5],[0,13],[0,1],[0,1],[0,2],[1,1],[2,3],[0,1],[0,4],[-2,1],[-2,2],[0,3],[0,2],[2,4],[1,2],[-3,12],[0,1],[0,2],[0,2],[-4,-2],[-1,10],[2,13],[6,11],[7,5],[4,1],[9,4],[2,2],[3,5],[2,10],[3,4],[9,8],[4,5],[3,14],[0,3],[-1,2],[-3,2],[-2,2],[0,3],[2,3],[4,2],[4,3],[2,5],[-2,9],[1,3],[1,1],[3,0],[2,0],[2,0],[5,6],[5,11],[4,11],[0,9],[-1,5],[-2,2],[-1,0],[-1,1],[2,3],[3,4],[0,5],[3,10],[0,17],[0,6],[-3,7],[1,2],[2,3],[2,2],[1,4],[2,27],[1,5],[2,6],[1,2],[2,1],[2,1],[1,3],[-1,6],[0,3],[1,2],[2,0],[1,2],[1,3],[0,3],[1,5],[5,9],[2,6],[1,5],[0,6],[1,3],[2,3],[1,0],[1,-2],[2,-2],[10,3],[4,0],[1,3],[2,3],[2,2],[2,0],[2,2],[0,3],[-1,6],[0,11],[5,10],[1,3],[-1,6],[-2,7],[-3,7],[-6,11],[0,6],[2,5],[1,8],[-2,4],[-2,5],[-2,5],[3,7],[-1,3],[-3,4],[0,2],[0,3],[0,2],[3,7],[0,2],[2,3],[2,2],[3,0],[2,-3],[0,-3],[2,-1],[2,1],[2,0],[3,3],[0,2],[0,2],[0,2],[1,2],[2,2],[1,2],[1,2],[0,4],[1,0],[1,0],[2,-1],[3,1],[1,2],[-1,2],[-1,2],[2,2],[5,3],[1,2],[0,5],[-4,12],[0,2],[0,2],[-4,7],[0,3],[0,2],[9,20],[2,3],[1,1],[5,3],[4,3],[-4,5],[-1,2],[0,2],[0,3],[2,3],[4,3],[0,2],[1,3],[2,13],[5,11],[0,6],[-2,8],[-1,5],[3,5],[1,2],[1,2],[0,3],[0,3],[-1,3],[-2,6],[0,2],[2,2],[5,0],[3,7],[6,4],[-3,7],[-9,2],[1,7],[5,3],[2,8],[-2,4],[-2,4],[0,7],[-2,4],[2,3],[1,4],[0,9],[0,7],[0,2],[2,2],[2,2],[1,1],[1,4]],[[9503,8004],[-12,-37],[-1,-10],[1,-5],[1,-4],[8,-11],[3,-5],[-3,-4],[2,-5],[0,-7],[0,-7],[4,-7],[5,-4],[3,-6],[2,-7],[3,-21],[16,-66],[2,-13],[-2,-9],[-30,-23],[-7,-8],[-2,-9],[-2,-11],[0,-20],[2,-13],[4,-11],[6,-10],[8,-10],[44,-62],[3,-7],[1,-7],[-1,-5],[-4,-9],[-1,-5],[-1,-3],[1,-6],[-1,-2],[-1,-1],[-7,1],[-3,0],[-10,-5],[-5,-1],[-12,0],[-5,-3],[-5,-3],[-4,-4],[-3,-6],[-2,-5],[-2,-4],[-6,0],[-9,3],[-8,7],[-8,5],[-11,0],[-8,-2],[-3,-2],[-4,-4],[-9,-16],[-2,-6],[-1,-4],[1,-10],[-1,-5],[-11,-25],[-3,-4],[-4,-3],[-8,-4],[-4,-3],[-1,-3],[-1,-3],[0,-4],[1,-3],[-1,-6],[-2,-7],[-6,-13],[-2,-2],[-5,-5],[-2,-3],[0,-4],[1,-3],[2,-4],[1,-3],[-1,-2],[-6,-3],[-3,-2],[-1,-3],[-2,-10],[-9,-39],[-4,-7],[-6,-4],[-14,-4],[-4,-1],[-3,-3],[-2,-4],[0,-2],[0,-2],[0,-2],[-4,-4],[-9,-20],[-5,-8],[-5,-10],[-2,-3],[-4,1],[-4,4],[-5,2],[-3,-3],[-3,-13],[-2,-5],[-10,-13],[-12,-9],[-11,-11],[0,-1],[-5,-14],[0,-27],[-1,-3],[-1,-1],[-2,-1],[-2,-1],[-5,-7],[-4,-7],[-3,-9],[-1,-9],[1,-5],[4,-11],[0,-6],[0,-4],[-7,-12],[0,-3],[0,-2],[-1,-2],[-1,-2],[-3,-3],[-2,-4],[-2,-5],[-1,-5],[0,-5],[1,-5],[2,-13],[-1,-7],[-1,-6],[-4,-5],[-5,-3],[-12,-2],[-4,-1],[-1,-2],[0,-1],[-2,-4],[-2,-2],[-6,-4],[-4,-3],[-1,0],[-1,-1],[-1,-1],[0,-2],[3,-3],[0,-2],[-1,-3],[-2,-1],[-3,-2],[-2,-1],[-5,-2],[-2,-6],[-1,-12],[0,-4],[2,-4],[2,-3],[2,-4],[2,-13],[2,-3],[1,-3],[1,-3],[6,-24],[0,-8],[-1,-7],[0,-6],[2,-5],[6,-5],[2,-3]],[[9184,6870],[0,-1],[3,-22],[-2,-34],[-1,-10],[-3,-9],[-8,-12],[-1,-3],[2,-5],[3,0],[9,1],[9,-3],[7,-7],[4,-9],[-4,-10],[-2,-1],[-4,-2],[-2,-2],[-1,-2],[-1,-3],[-1,-4],[0,-10],[-1,-5],[-2,-4],[-6,-7],[-6,-5],[-7,-3],[-9,-2],[-8,2],[-19,9],[-6,-3],[0,-5],[6,-9],[1,-5],[-2,-6],[-3,-2],[-3,-2],[-4,-2],[-5,-8],[-4,-19],[-4,-9],[-4,-8],[-2,-4],[-1,-5],[0,-4],[1,-2],[0,-3],[-1,-3],[-4,-5],[-2,-2],[-3,-9],[-4,-35],[0,-5],[3,-4],[4,-4],[6,-6],[3,-3],[0,-3],[-2,-1],[-10,1],[-5,-2],[-5,-8],[-2,-5],[-2,-7],[-3,-4],[-4,-3],[-3,-1],[-3,3],[-1,6],[-2,5],[-4,2],[-3,-2],[-13,-19],[-1,-4],[-1,-5],[0,-10],[-1,-5],[-5,-10],[1,-5],[1,-5],[1,-5],[0,-5],[-4,-8],[-1,-5],[0,-9],[-1,-10],[-2,-11],[0,-4],[3,-7],[12,-23],[7,-8],[2,-4],[0,-11],[1,-6],[2,-6],[3,-5],[8,-8],[8,-2],[8,0],[11,-1],[4,-2],[4,-4],[5,-5],[3,-4],[0,-5],[-1,-4],[-3,-3],[-2,-4],[-2,-9],[-2,-2],[-6,-1],[-10,4],[-4,1],[-4,-3],[0,-3],[1,-2],[4,-4],[1,-2],[1,-2],[0,-5],[1,-3],[4,-2],[0,-2],[0,-3],[-2,-4],[0,-2],[1,-3],[2,-6]],[[9090,6231],[-11,-3],[-10,1],[-5,1],[-4,2],[-4,4],[-4,9],[-3,3],[-7,4],[-15,4],[-10,5],[-10,11],[-7,5],[-6,3],[-6,2],[-5,0],[-5,-1],[-5,0],[-24,8],[-5,2],[-6,-3],[-4,-9],[-5,0],[-5,-2],[-21,11],[-10,-3],[-5,-2],[-5,-3],[-22,-13],[-5,-3],[-13,5],[-7,6],[-5,-1],[-3,-8],[-18,-31],[-1,0]],[[8809,6235],[0,9],[1,3],[2,5],[1,11],[4,27],[-1,5],[-2,2],[-1,3],[-1,3],[0,3],[2,3],[2,1],[2,2],[1,1],[-2,5],[-7,8],[0,4],[4,4],[1,4],[0,4],[-11,43],[-2,4],[1,19],[-6,19],[-3,6],[-9,56],[-5,8],[0,5],[3,21],[1,12],[-1,12],[-3,10],[-1,2],[-1,1],[-1,2],[0,6],[-1,5],[-1,8],[-4,17],[2,18],[-1,3],[-3,21],[1,5],[4,13],[-1,4],[-1,5],[0,6],[4,9],[2,27],[8,24],[1,2],[1,1],[1,0],[2,-2],[3,-7],[4,-3],[6,0],[5,0],[6,2],[2,2],[2,2],[-1,3],[-1,2],[1,1],[3,0],[1,3],[9,17],[3,-3],[2,-3],[3,-1],[3,3],[3,4],[1,3],[1,9],[1,9],[-2,8],[-3,8],[-4,6],[1,3],[2,1],[2,0],[2,-2],[0,2],[1,2],[1,1],[4,1],[0,1],[-1,2],[1,2],[1,1],[0,1],[1,1],[2,0],[1,0],[2,-3],[2,0],[5,2],[2,6],[1,8],[0,7],[0,4],[-2,3],[-5,4],[-1,3],[-1,3],[-3,15],[0,4],[2,2],[2,2],[0,4],[0,4],[-1,2],[6,9],[2,5],[-2,2],[-3,2],[-3,5],[-2,6],[-1,5],[1,5],[3,9],[1,7],[1,3],[1,3],[-1,3],[-1,2],[-4,2],[-1,3],[-1,6],[-1,5],[-1,5],[-3,6],[-3,3],[-22,14],[-4,4]],[[9143,6015],[0,-1],[2,-4],[1,-5],[-4,-15],[0,-5],[2,-4],[3,-4],[8,-6],[3,-4],[7,-15],[6,1],[10,13],[8,1],[9,-3],[7,-4],[6,-6],[2,-14],[4,-9],[0,-5],[-2,-4],[-6,-7],[-2,-4],[-1,-4],[-1,-12],[-1,-3],[-2,-1],[-4,-2],[-2,-1],[0,-3],[0,-2],[1,-2],[0,-3],[-5,-14],[0,-5],[2,-4],[6,-9],[0,-4],[-3,-3],[-8,-5],[-2,-3],[0,-6],[4,-20],[0,-4],[-2,-10],[-1,-7],[3,-1],[3,1],[5,-1],[2,-7],[0,-12],[-2,-19],[-1,-4],[-1,-2],[0,-3],[1,-4],[1,-3],[6,-10],[2,-7],[-1,-2],[-16,-7],[-1,-1],[0,-2],[-1,-1],[-8,3],[-5,1],[-5,0],[-12,-2],[-2,-1]],[[9156,5700],[-3,10],[-3,4],[-4,5],[-13,8],[-2,5],[-1,4],[-1,5],[-3,6],[-3,4],[-3,3],[-4,1],[-10,-1],[-6,0],[-6,3],[-3,4],[-3,5],[-2,7],[-4,8],[-6,8],[-5,5],[-5,4],[-5,0],[-30,-9],[-8,-1],[-14,1],[-5,-1],[-3,-1],[-3,-2],[-3,-1],[-5,-1],[-6,1],[-3,0],[-2,-1],[-1,-2],[1,-9],[0,-4],[-1,-3],[-2,-2],[-2,-3],[-14,-9],[-4,-4],[-9,-14],[-4,-2],[-5,-3],[-19,-3],[-6,0],[-8,1],[-6,1],[-6,3],[-27,20],[-5,1],[-3,-1],[-3,-2],[-3,-3],[-2,1],[-3,1],[-20,13],[-14,6],[-5,1],[-3,0],[-8,-3],[-2,-1],[-5,-1],[-11,10],[-8,4],[-1,1],[-2,3]],[[8768,5780],[28,14],[3,2],[3,3],[12,15],[5,3],[6,2],[10,1],[4,1],[3,3],[0,4],[-4,8],[-1,5],[4,7],[3,4],[6,4],[1,4],[0,7],[-1,14],[0,16],[-20,20],[-2,13],[4,12],[88,72],[3,3],[20,9],[3,3],[1,1],[7,2],[6,1],[4,0],[18,6],[13,0],[9,-11],[6,-3],[6,5],[8,5],[29,-25],[3,0],[3,-1],[14,-3],[4,-5],[10,-8],[4,-8],[6,0],[14,12],[21,17],[11,1]],[[6678,5830],[-4,0],[-4,0],[-3,2],[-4,8],[3,9],[6,4],[7,-5],[0,-3],[1,-5],[1,-5],[-1,-3],[-2,-2]],[[7119,5872],[2,0],[4,0],[2,-1],[5,-7],[-2,0],[-3,0],[-2,-1],[-2,-1],[-2,1],[-1,-1],[-7,3],[-5,2],[-5,-1],[-9,-4],[-5,-1],[-3,-1],[-5,-3],[-2,0],[-1,3],[6,6],[5,4],[3,1],[5,2],[2,1],[1,2],[0,2],[1,2],[2,1],[3,0],[5,-2],[5,-2],[2,-4],[1,-1]],[[9090,6231],[1,-3],[0,-2],[0,-5],[0,-2],[2,-6],[2,-2],[4,-1],[6,-2],[3,-4],[3,-4],[-1,-19],[5,-8],[9,-5],[3,-2],[3,-6],[1,-5],[-1,-5],[1,-4],[4,-7],[-2,-1],[-5,0],[-2,-2],[0,-2],[-1,-5],[0,-6],[6,-28],[4,-7],[12,-14],[8,-7],[4,-3],[5,-2],[3,-2],[0,-3],[-4,-7],[-1,-5],[-3,-11],[-2,-4],[-3,-2],[-7,-2],[-4,-2],[-1,-5],[1,-4]],[[8768,5780],[-3,2],[-4,1],[-3,1],[-1,1],[-3,3],[-2,-1],[-1,0],[-2,-1],[-2,1],[-3,1],[-2,1],[-2,0],[-7,0]],[[8733,5789],[2,6],[6,22],[4,10],[2,2],[2,1],[1,1],[2,2],[3,1],[5,-1],[2,1],[4,4],[5,3],[4,3],[4,5],[4,11],[1,6],[1,5],[0,9],[0,3],[1,2],[3,3],[1,2],[-4,10],[-15,17],[0,12],[1,2],[1,3],[2,1],[3,0],[1,2],[0,2],[0,6],[-1,6],[-2,5],[-3,4],[-2,5],[-3,21],[-2,3],[-6,10],[-2,3],[4,4],[13,1],[2,3],[1,3],[1,3],[1,3],[2,2],[3,3],[2,0],[2,-1],[8,0],[3,1],[2,2],[1,2],[1,5],[3,5],[-1,2],[0,3],[0,3],[2,2],[4,4],[2,3],[1,6],[-2,5],[-3,6],[-1,7],[-1,2],[0,3],[1,2],[2,2],[6,-1],[2,1],[1,5],[-2,6],[-1,4],[10,2],[2,4],[2,5],[0,6],[0,12],[-2,6],[-5,10],[1,5],[4,4],[4,3],[-1,4],[3,11],[1,5],[2,2],[1,2],[1,2],[-1,4],[-8,7],[-1,1],[-3,1],[-1,1],[0,4],[-2,10],[-1,2],[-3,4],[-4,3],[-4,4],[-3,5],[0,3]],[[41,7541],[2,0],[2,0],[2,1],[2,1],[3,-1],[2,-3],[-1,-3],[-4,-3],[-7,-2],[-4,-2],[-3,-1],[-5,0],[-2,-1],[-2,0],[-2,-2],[-2,-2],[-2,-1],[-3,-1],[-2,0],[-2,0],[-3,-2],[-2,-2],[-2,-2],[-3,-1],[-2,2],[-1,2],[1,2],[1,2],[5,19],[2,3],[4,4],[4,3],[3,-1],[13,-6],[2,0],[6,-3]],[[928,7704],[0,-1],[-3,2],[2,1],[0,-1],[1,-1]],[[6869,7731],[-1,-1],[-3,1],[2,2],[2,-1],[0,-1]],[[6823,7752],[-2,0],[-2,0],[3,2],[0,-1],[1,0],[0,-1]],[[8260,4634],[-1,-1],[0,1],[1,0]],[[8261,4639],[0,-1],[-1,1],[1,0]],[[8254,4641],[-1,0],[0,1],[1,-1]],[[8263,4641],[-2,0],[-3,1],[-3,4],[-5,6],[0,3],[0,5],[-2,4],[1,3],[5,-3],[11,-9],[2,-2],[1,-5],[-2,-4],[-1,-2],[-2,-1]],[[8246,4666],[-1,0],[0,1],[1,-1]],[[8931,4710],[2,-5],[0,-1],[0,-1],[-2,-8],[-1,-8],[1,-8],[10,-41],[6,-9],[7,-6],[9,-5],[7,-6],[3,-10],[0,-5],[-3,-4],[-5,-7],[-3,-4],[0,-1],[0,-3],[0,-2],[2,-2],[1,-2],[-1,-2],[-1,-1],[-7,-3],[-1,-1],[-4,-6],[-3,-3],[-5,-1],[-10,1],[-9,0],[-7,-3],[-14,-9],[-4,-2],[-17,-2],[-2,-1],[-1,-2],[-3,-3],[-6,-5],[-21,-9],[-7,-6],[-4,-7],[-3,-16],[0,-7],[4,-19],[3,-35],[-3,-21],[-2,-6],[-4,-3],[-5,-3],[-4,-4],[0,-5],[4,-8],[-2,-4],[-3,-3],[-5,-7],[-3,-4],[-6,-8],[11,-8],[-2,-9],[-4,-4],[-4,0],[-4,1],[-5,-1],[-6,-1],[-4,1],[-3,2],[-2,2]],[[8786,4337],[0,1],[-1,0],[0,1],[0,1],[-1,3],[0,4],[-1,3],[0,3],[-1,2],[0,1],[-1,1],[-1,1],[-1,1],[0,2],[-1,1],[-1,2],[-1,1],[-1,1],[-1,1],[-1,0],[-1,1],[-1,1],[-1,1],[-1,0],[-1,1],[-1,1],[-1,0],[-1,1],[-1,0],[-1,0],[-1,1],[-1,0],[-1,0],[-4,0],[-4,-1],[-3,-2],[-6,-12],[-9,-15],[-9,-17],[-8,-13],[-13,-10],[-17,-4],[-17,-1],[-12,0],[-7,1],[-5,3],[-5,3],[-6,2],[-7,-2],[-6,-2],[-6,-1],[-6,6],[-8,9],[-12,8],[-14,5],[-12,2],[-13,2],[-16,3],[-16,3],[-13,1],[-9,-2],[-7,-1],[-6,0],[-6,1],[-2,7],[2,14],[3,15],[3,10],[-1,5],[-3,2],[-5,2],[-6,2],[-7,0],[-5,0],[-4,-2],[-2,0],[0,-1],[-1,-1],[-1,0],[-1,-1],[-3,0],[-3,-1],[-2,0],[-3,0],[-6,0],[-6,0],[-6,1],[-6,0]],[[8413,4392],[-1,2],[2,2],[2,2],[2,2],[1,3],[-1,6],[-3,12],[1,6],[5,9],[1,5],[-6,3],[0,-6],[-1,-4],[-2,0],[-1,11],[-3,9],[-5,18],[-18,41],[-16,58],[-2,0],[1,-12],[2,-11],[-2,1],[-2,3],[-2,7],[-1,5],[0,5],[-1,5],[-5,10],[-4,17],[-4,8],[-1,4],[-1,12]],[[8348,4625],[1,0],[14,4],[17,8],[6,1],[3,-1],[3,-7],[3,-3],[4,-3],[4,-1],[4,2],[1,7],[-5,19],[0,6],[2,5],[3,3],[8,6],[5,4],[28,37],[1,5],[-2,5],[-10,5],[-4,3],[-2,5],[0,6],[1,6],[3,5],[2,5],[1,5],[0,6],[1,6],[3,5],[9,8],[5,8],[0,6],[-1,5],[-10,9],[-2,3],[1,4],[6,12],[3,3],[2,1],[3,-1],[4,-2],[4,-1],[5,-1],[5,0],[17,7],[15,1],[32,-2],[6,-1],[9,-3],[10,-2],[9,-1],[6,-1],[4,-2],[2,-3],[2,-4],[0,-4],[1,-5],[2,-4],[9,-8],[4,-4],[6,-9],[4,-3],[7,-4],[18,-6],[12,-6],[11,-7],[4,-3],[3,-4],[6,-8],[3,-2],[3,-2],[4,-1],[5,0],[8,2],[5,2],[3,0],[4,-1],[4,-2],[4,-4],[5,-3],[6,-2],[5,1],[11,3],[6,0],[7,-1],[5,-2],[4,-3],[1,-2],[-1,-1],[-2,-2],[-4,-3],[-1,-1],[1,-2],[7,-8],[1,-4],[1,-5],[1,-7],[2,-6],[3,-3],[6,-4],[4,2],[6,6],[3,2],[9,1],[4,2],[4,3],[10,3],[4,3],[11,13],[3,3],[3,2],[14,6],[4,1],[4,0],[22,-2],[12,-3],[21,-9],[3,-2],[7,-5]],[[8786,4337],[-8,8],[-3,0],[-4,-4],[-2,-4],[-1,-6],[1,-5],[5,-8],[-1,-4],[-3,-5],[-1,-4],[1,-6],[4,-11],[1,-5],[1,-6],[1,-3],[2,-3],[9,-7],[3,-3],[1,-3],[-2,-6],[-9,-16],[-1,-2],[-2,-1],[-1,-1],[-1,-2],[1,-3],[2,-5],[0,-3],[-3,-10],[-9,1],[-10,5],[-8,-1],[-3,-3],[0,-2],[1,-2],[1,-2],[0,-2],[-1,-3],[-2,-8],[0,-2],[1,-3],[0,-1],[-2,-3],[0,-2],[1,-5],[4,-4],[7,-6],[5,-6],[1,-1],[3,-1],[1,1],[1,1],[1,1],[3,1],[2,0],[2,-1],[2,-2],[1,-2],[0,-3],[0,-3],[-1,-4],[-9,-18],[-2,-2],[-3,0],[-10,2],[-3,-1],[-2,-3],[-8,-23],[-5,-6],[0,-2],[0,-3]],[[8735,4091],[-7,-9],[-13,-8],[-15,-6],[-14,-3],[-18,-1],[-27,-1],[-31,-2],[-30,1],[-25,5],[-20,9],[-16,10],[-13,8],[-9,7],[-6,7],[-4,10],[-5,14],[-10,12],[-16,3],[-17,-1],[-15,-2],[-14,2],[-16,5],[-16,5],[-12,3],[-12,0],[-13,0],[-13,0],[-13,0],[-10,1],[-5,2],[-3,2],[-1,1]],[[8296,4165],[0,3],[1,3],[2,4],[1,3],[2,2],[1,1],[0,1],[-1,2],[-1,1],[0,-1],[0,2],[-1,2],[-1,2],[4,2],[1,1],[4,8],[0,1],[3,0],[3,0],[2,2],[1,2],[-1,11],[-1,6],[-1,4],[-6,8],[-4,5],[1,3],[2,1],[5,5],[2,2],[2,1],[7,-1],[5,2],[7,6],[10,2],[5,2],[4,4],[4,4],[4,5],[2,1],[3,1],[2,-1],[3,-1],[2,-1],[0,-2],[1,-6],[1,-6],[3,-3],[3,2],[2,5],[-1,6],[-2,5],[-3,4],[-1,5],[2,5],[2,6],[1,4],[-1,6],[-3,3],[-2,4],[2,4],[9,4],[3,2],[-3,2],[10,10],[4,6],[2,6],[0,3],[2,3],[1,2],[3,2],[0,1],[1,3],[1,3],[3,1],[-2,6],[0,4],[3,5],[3,4],[0,2],[-5,5],[0,1]],[[8361,4994],[3,-3],[3,-3],[-4,1],[-3,2],[-4,2],[-4,-3],[-2,-5],[0,-2],[-3,3],[-1,7],[-4,3],[2,3],[1,4],[0,3],[2,4],[2,0],[0,-4],[0,-4],[4,-3],[5,-2],[3,-3]],[[8929,5136],[-4,0],[-4,-10],[-2,-12],[0,-9],[3,-17],[0,-5],[-4,-2],[-4,2],[-5,3],[-4,0],[-4,-3],[-1,-4],[1,-9],[-1,-5],[-6,-14],[-1,-2],[-2,-2],[-1,-2],[-1,-3],[1,-2],[3,-2],[2,0],[2,-2],[1,-3],[0,-1],[0,-1],[0,-2],[-1,-2],[-1,-2],[0,-2],[6,-4],[1,-3],[-1,-4],[-5,-2],[-4,0],[-5,1],[-1,-1],[4,-3],[8,-4],[1,-3],[3,-12],[3,-5],[8,-6],[-8,-4],[-3,-4],[-2,-5],[0,-6],[0,-5],[0,-5],[-3,-5],[-9,-10],[-2,-5],[0,-5],[3,-8],[6,-12],[7,-9],[3,-4],[2,-6],[-1,-5],[-4,-10],[-1,-5],[1,-3],[2,-4],[0,-3],[-1,-2],[-6,-3],[-3,-3],[-3,-3],[-1,-4],[-1,-5],[2,-12],[12,-34],[9,-15],[2,-11],[6,-9],[2,-6],[1,-5],[2,-4],[7,-8],[0,-1],[0,-2],[0,-1],[0,-1],[-3,-5],[0,-4],[1,-6]],[[8348,4625],[-4,14],[0,6],[4,12],[0,3],[-1,2],[1,1],[3,2],[1,1],[0,2],[-3,11],[0,2],[2,3],[2,2],[2,1],[2,2],[1,2],[5,33],[0,10],[-2,10],[-8,20],[-12,23],[-15,22],[-2,2],[-5,2],[-2,2],[-2,2],[0,2],[0,15],[0,2],[-4,5],[-1,3],[1,6],[2,5],[2,4],[4,3],[7,6],[4,4],[1,5],[0,12],[-1,4],[-2,5],[-14,12],[-2,4],[1,6],[5,9],[2,5],[0,18],[3,4],[3,5],[3,3],[3,0],[4,-1],[3,-4],[2,-2],[2,-2],[1,0],[10,-5],[5,1],[3,-1],[0,-2],[0,-2],[0,-3],[1,-2],[3,0],[5,4],[6,-2],[3,0],[6,2],[10,1],[9,3],[10,5],[7,8],[8,22],[0,12],[-1,5],[0,2],[-1,3],[1,1],[4,7],[1,2],[3,30],[-2,6],[-3,4],[-5,3],[-5,2],[2,3],[3,3],[3,3],[3,1],[3,-3],[4,3],[1,5],[-6,2],[5,8],[1,3],[-2,4],[1,5],[2,4],[1,5],[6,-6],[0,-18],[5,-6],[4,-2],[4,0],[4,0],[4,2],[3,3],[1,3],[1,9],[0,2],[1,2],[2,1],[1,2],[1,2],[-1,1],[-1,2],[-1,4],[-3,4],[-1,1],[0,11],[0,2],[2,1],[2,1],[2,-1],[0,-2],[0,-2],[1,-1],[4,1],[2,2],[2,4],[4,14],[2,4],[4,4],[1,2],[1,10],[1,3],[4,5],[2,5],[2,5],[2,5],[0,6],[-3,17],[0,5],[2,2],[4,4],[1,3],[-1,3],[-2,5],[-1,3],[1,5],[5,7]],[[8517,5246],[1,0],[22,10],[11,-4],[16,-4],[20,-4],[6,-4],[91,-12],[1,1],[2,-1],[4,0],[61,-23],[10,-1],[5,-2],[4,-2],[73,-36],[33,-11],[4,0],[4,2],[13,-1],[3,2],[4,1],[5,0],[4,-1],[3,-2],[2,-2],[2,-3],[1,-3],[3,-5],[3,-4],[1,-1]],[[9156,5700],[-2,-2],[-2,-6],[1,-8],[1,-7],[0,-6],[-2,-5],[-11,-8],[-3,-6],[-6,-13],[-4,-5],[-9,-7],[-5,-5],[-3,-9],[-2,-19],[-5,-8],[-5,-3],[-4,0],[-1,-2],[2,-4],[3,-4],[3,-2],[1,-3],[-18,-40],[-4,-18],[0,-1]],[[9081,5509],[-34,7],[-5,0],[-4,0],[-14,-4],[-3,0],[-5,0],[-3,2],[-3,1],[-1,1],[-19,17],[-5,3],[-6,2],[-19,-2],[-6,0],[-9,2],[-10,4],[-12,7],[-7,2],[-8,2],[-3,2],[-3,2],[-1,3],[-1,1],[-2,1],[-3,0],[-4,0],[-6,-2],[-10,-5],[-4,-2],[-12,3],[-2,-2],[-4,-3],[-1,-1],[-3,-1],[-1,-2],[-4,-7],[-2,-3],[-4,-2],[-6,-1],[-46,2],[-7,-1],[-4,-1],[-2,-2],[-2,-2],[-4,-2],[-3,0],[-5,3],[-2,2],[-8,10],[-4,5],[-3,2],[-6,1],[-13,1],[-4,1],[-3,1],[-11,10],[-15,9],[-11,4]],[[8679,5577],[1,3],[1,4],[7,14],[1,5],[1,23],[3,16],[0,6],[-3,9],[0,5],[1,7],[5,3],[4,3],[4,2],[1,4],[1,5],[-1,21],[-1,11],[-2,3],[-4,5],[-2,4],[2,6],[11,13],[3,4],[4,9],[3,5],[5,3],[1,3],[0,3],[0,3],[1,2],[5,5],[2,3]],[[8179,3359],[-1,-3],[-2,1],[-4,2],[1,2],[1,5],[0,5],[0,2],[5,3],[1,-1],[1,-4],[-2,-5],[2,-3],[3,-1],[0,-2],[-3,0],[-2,-1]],[[8320,3407],[-3,-4],[-7,3],[-7,4],[-2,7],[3,3],[6,-3],[4,0],[4,-2],[2,-8]],[[8342,3427],[2,-4],[3,0],[-1,3],[3,2],[3,-3],[1,-5],[-5,-4],[-7,-2],[-4,0],[2,4],[-2,4],[-2,6],[5,1],[2,-2]],[[8381,3473],[4,-5],[-2,0],[-1,0],[-1,-1],[-2,-1],[-7,0],[-6,1],[-5,3],[-5,4],[-2,2],[-8,1],[-3,2],[-3,2],[-8,0],[-4,1],[6,6],[8,-1],[14,-7],[7,-1],[10,-2],[8,-4]],[[8475,3534],[5,-1],[1,4],[2,1],[3,-1],[1,-9],[2,-8],[-4,-1],[-5,-4],[-3,4],[-3,8],[-8,7],[-4,5],[1,4],[5,1],[3,-1],[2,-5],[2,-4]],[[8399,3561],[7,0],[1,0],[7,-1],[1,-5],[-5,-2],[-8,1],[-7,3],[-8,4],[3,2],[9,-2]],[[8329,3563],[0,-4],[-2,-1],[-9,4],[-4,0],[-4,0],[-4,-1],[-3,-2],[-3,2],[-4,4],[-1,4],[4,1],[17,2],[4,1],[3,2],[3,1],[4,-2],[1,-4],[-2,-7]],[[8373,3580],[0,-3],[-1,1],[-2,2],[-9,14],[-2,1],[-2,1],[-3,0],[-2,0],[-8,5],[-2,1],[-4,0],[-10,4],[-3,2],[-1,2],[0,3],[-1,5],[-1,2],[-2,1],[-1,2],[1,3],[4,2],[5,-1],[15,-2],[2,-4],[1,-4],[3,-4],[23,-24],[1,-2],[0,-1],[-1,-2],[0,-1],[-1,-1],[1,-2]],[[8454,3651],[-1,-3],[-3,-3],[-7,-3],[-6,0],[-2,2],[-2,1],[-2,2],[-3,2],[0,2],[-1,1],[-1,3],[-1,3],[2,1],[2,-1],[4,-6],[4,-1],[5,6],[4,3],[4,-1],[2,-3],[1,-2],[1,-3]],[[8585,3686],[-3,-3],[-5,3],[-16,7],[-2,2],[2,4],[4,5],[4,3],[4,2],[7,-1],[3,-2],[1,-3],[1,-11],[0,-6]],[[8248,3770],[2,0],[1,1],[1,1],[1,4],[0,1],[4,1],[4,-2],[2,-4],[1,-5],[-2,-5],[-5,0],[-10,4],[-5,2],[-3,0],[-2,-2],[-1,-2],[0,-2],[2,-2],[1,-1],[3,-3],[18,-4],[4,-1],[5,-1],[5,1],[2,6],[2,2],[6,-4],[6,-5],[1,-3],[3,2],[-1,2],[-3,4],[0,3],[7,6],[9,4],[4,3],[3,-1],[5,-4],[5,-1],[3,7],[3,1],[4,1],[3,0],[3,-2],[2,-3],[5,-6],[2,1],[2,1],[2,-1],[2,-1],[0,-2],[-7,-2],[-1,-1],[-3,-3],[0,-1],[1,0],[1,-4],[2,-2],[0,-1],[0,-1],[-1,-2],[-1,-4],[-2,0],[-3,1],[-2,-1],[-2,-4],[2,-2],[5,-1],[3,-2],[9,-13],[3,-2],[3,-2],[3,-3],[2,-5],[0,-4],[-2,-3],[-9,-3],[-1,-4],[3,-7],[7,-6],[17,-7],[-1,-1],[-2,-3],[-1,-1],[4,-3],[2,-4],[0,-4],[-1,-5],[-1,-4],[-1,-2],[-2,-2],[-1,0],[-5,2],[-2,0],[-5,-1],[-8,-4],[-5,-2],[-15,1],[-4,-1],[-14,-5],[-4,-2],[-3,-4],[0,-3],[1,-3],[1,-4],[-1,-5],[-2,-3],[-1,-3],[2,-4],[4,-4],[8,-4],[4,-3],[-3,-1],[-19,-6],[-5,0],[-6,1],[-5,3],[-3,5],[3,2],[2,2],[3,6],[-2,2],[-9,-6],[-4,-3],[-1,-6],[1,-2],[4,-3],[1,-2],[0,-3],[-4,-6],[-1,-2],[2,-6],[5,-4],[6,-3],[6,-6],[3,0],[6,-1],[0,-1],[2,-2],[3,-3],[1,-1],[7,-11],[2,-2],[3,-1],[5,-1],[5,-2],[14,-8],[4,-3],[2,-5],[1,-6],[-2,-6],[-3,-3],[-5,-1],[-10,0],[-3,1],[-6,3],[-2,-5],[-7,1],[-7,2],[-6,2],[0,-2],[12,-6],[2,-2],[0,-2],[-2,-4],[1,-2],[1,-1],[2,-1],[2,0],[2,-5],[2,0],[5,0],[3,-1],[1,-1],[0,-2],[1,-3],[11,-16],[-6,1],[-9,4],[-5,0],[-1,-4],[10,-1],[9,-5],[9,-7],[-2,-7],[-6,-1],[-5,2],[-5,3],[-4,1],[-6,-1],[-9,-4],[-16,-4],[-2,2],[-1,3],[-1,4],[-6,0],[-3,-3],[4,-4],[3,-9],[-1,-6],[-1,-4],[2,-4],[4,-4],[4,-2],[3,-2],[5,-6],[3,-4],[0,-4],[-4,-2],[-5,1],[-7,0],[5,-3],[4,-3],[5,-3],[1,-4],[-3,-4],[-6,-2],[-6,-1],[-4,2],[-3,3],[-3,1],[-6,3],[0,-5],[1,-4],[-1,-4],[-3,0],[-3,2],[-1,-3],[-4,-3],[-6,1],[-3,5],[-4,2],[-3,4],[-3,3],[-6,0],[-4,-1],[-4,-5],[-3,4],[-5,2],[-6,1],[-6,-4],[-2,-6],[-3,2],[-4,6],[-3,3],[-9,4],[-8,-1],[-3,4],[-8,1],[-10,2],[-5,6],[-5,4],[-6,-3],[-4,6],[-5,2],[-2,6],[1,2],[7,3],[4,10],[0,5],[1,1],[5,3],[4,1],[1,4],[-3,1],[-3,2],[-1,3],[2,3],[3,4],[4,-1],[5,2],[5,6],[4,3],[3,3],[0,3],[-5,2],[-1,3],[2,3],[6,1],[2,3],[-1,4],[-2,3],[-2,2],[0,3],[2,1],[3,0],[7,2],[3,6],[1,6],[0,5],[-2,3],[1,3],[2,3],[-1,3],[-2,2],[0,5],[5,2],[1,2],[-1,4],[-3,4],[2,2],[4,2],[1,2],[1,6],[0,8],[-2,9],[-2,7],[-2,5],[0,1],[-2,2],[0,2],[-1,3],[-2,1],[-2,0],[-2,2],[1,5],[1,3],[0,5],[-1,3],[0,5],[8,18],[3,11],[-4,8],[-2,6],[2,6],[3,6],[5,6],[13,11],[4,6],[-1,4],[-2,6],[1,2],[2,3],[1,3],[0,3],[-1,2],[-2,13],[0,6],[1,5],[2,2],[-1,1],[2,2],[2,1],[2,1],[3,3],[1,1],[0,4],[-3,5],[-2,4],[-2,1],[-4,1],[-1,3],[-1,3],[0,4],[3,2],[1,2],[2,3],[1,2],[3,0],[1,-2],[2,-3],[2,-1],[3,0],[4,-3],[2,-1],[1,-1]],[[8468,3758],[-6,0],[-6,1],[-4,1],[-2,2],[0,2],[1,2],[2,2],[1,2],[-3,10],[-1,7],[5,2],[3,-2],[6,-16],[4,-4],[2,-5],[-2,-4]],[[8735,4091],[2,-3],[1,-2],[-1,-9],[-5,-8],[-18,-16],[-1,-3],[8,-28],[2,-5],[10,-12],[2,-5],[2,-6],[0,-5],[-4,-10],[0,-3],[1,-3],[3,-9],[0,-6],[-2,-9],[-1,-9],[-1,-4],[-3,-2],[-2,-2],[1,-5],[2,-9],[1,-4],[-1,-5],[-6,-17],[0,-8],[3,-10],[2,-4],[1,-4],[0,-3],[-1,-5],[-2,-8],[1,-3],[1,-4],[3,-4],[3,-3],[1,-3],[-3,-5],[-3,-2],[-8,-4],[-3,-3],[0,-8],[13,-16],[3,-9],[0,-9],[4,-7],[6,-6],[4,-8],[5,-18],[0,-5],[-1,-4],[0,-4],[2,-3],[2,-2],[4,-4],[1,-2],[1,-14],[-3,-5],[-6,-4],[-6,-2],[-17,-3],[-2,-1],[-3,-2],[-1,-3],[-2,-2],[-4,-1],[-5,2],[-3,6],[-4,5],[-8,0],[-7,-5],[-2,-7],[-2,-7],[-4,-6],[-6,-5],[-5,-5],[-2,-7],[2,-6],[12,-10],[3,-5],[-4,-14],[0,-2],[7,-9],[2,-3],[-1,-3],[-12,-5],[-7,-5],[-5,-7],[-1,-9],[1,-2],[2,-4],[1,-2],[0,-2],[-2,-6],[0,-4],[3,-8],[1,-4],[2,-37],[-1,-9],[-5,-17],[-2,-9],[5,-11],[7,-9],[10,-7],[10,-4],[35,-3],[21,-8],[5,-2],[1,-5],[0,-2],[-2,-5],[-1,-2],[0,-3],[1,-4],[1,-2],[0,-4],[0,-5],[-3,-3],[-10,2],[-5,-1],[-9,-4],[-6,0],[-3,-1],[-1,-2],[0,-7],[-1,-3],[-2,-1],[-1,-1],[-2,-1],[-2,-3],[0,-1],[1,-8],[-1,-2],[-2,-1],[-1,-1],[2,-2],[2,-1],[3,0],[2,1],[2,1],[5,-1],[4,-3],[3,-4],[-1,-5],[-4,-5],[-1,-2],[2,-3],[5,-1],[7,0],[5,-1],[2,-1],[2,-2],[1,-1],[1,-2],[2,-1],[10,-6],[2,-2],[1,-3],[1,-14],[-1,-4],[-4,-3],[-4,-2],[-10,-3],[-4,-2],[-2,-4],[-1,-5],[1,-4],[4,-1],[5,1],[3,2],[2,-1],[0,-6],[-1,-2],[-1,-2],[-1,-2],[1,-3],[1,-1],[5,-2],[2,-1],[3,-3],[13,-18],[0,-3],[-3,-5],[-17,-22]],[[8460,3279],[-3,3],[3,5],[4,3],[5,2],[4,3],[4,11],[4,2],[6,0],[5,2],[-2,5],[-4,1],[-11,-3],[-6,1],[-5,1],[-3,4],[-7,15],[-2,5],[-8,9],[0,4],[5,11],[1,5],[1,17],[2,3],[4,4],[24,10],[6,1],[4,2],[1,6],[0,6],[-2,5],[-4,12],[0,7],[2,3],[4,2],[10,15],[4,2],[5,1],[5,-2],[3,-10],[4,-4],[4,-2],[5,-1],[-5,12],[-1,6],[2,6],[0,2],[1,18],[-1,2],[-4,3],[-12,8],[-5,5],[-2,7],[0,5],[-3,10],[0,4],[1,3],[0,4],[-1,3],[6,3],[2,2],[1,3],[-1,4],[-6,5],[-2,3],[-1,8],[3,9],[3,7],[4,6],[7,2],[10,1],[9,-1],[8,-2],[3,-2],[3,-3],[3,-3],[8,-2],[6,-5],[4,-1],[5,2],[0,4],[-4,4],[-5,2],[-5,1],[-13,6],[-5,3],[-9,12],[-1,3],[1,5],[-1,4],[-2,0],[-5,1],[-3,0],[-2,4],[-4,13],[-1,3],[-5,0],[-4,0],[-3,2],[1,5],[7,9],[11,4],[21,4],[13,7],[5,0],[6,-2],[3,-5],[24,-59],[3,-5],[4,-1],[1,6],[-1,11],[-4,11],[-2,4],[-3,4],[-3,4],[-1,5],[2,5],[4,3],[5,2],[5,3],[-6,0],[-5,1],[-4,3],[-1,6],[1,6],[3,3],[4,2],[5,2],[-4,1],[-4,0],[-4,1],[-3,3],[0,3],[0,9],[0,4],[6,21],[0,2],[-5,4],[-8,3],[-5,-7],[-5,-9],[-4,-5],[-7,-1],[-2,1],[-2,4],[-1,2],[-5,-3],[-3,1],[-3,3],[-2,2],[-5,-5],[-7,0],[-18,9],[-2,2],[-3,3],[-1,1],[0,3],[0,1],[-2,1],[-3,1],[-2,1],[-2,2],[-2,1],[0,2],[6,1],[2,2],[3,4],[2,0],[3,2],[1,0],[0,1],[0,3],[0,1],[2,3],[20,17],[4,2],[3,1],[7,8],[4,3],[5,0],[6,-2],[6,0],[9,4],[2,0],[3,0],[4,0],[2,0],[6,3],[8,2],[2,1],[8,6],[1,1],[4,3],[2,1],[3,0],[8,0],[-6,3],[-2,2],[-1,4],[0,3],[4,9],[1,2],[-1,4],[0,1],[5,3],[0,1],[-1,3],[-4,5],[-1,2],[1,7],[6,13],[-1,7],[-4,3],[-4,-1],[-1,-4],[4,-5],[-1,-4],[-3,-5],[-2,-4],[-5,-34],[-2,-5],[-2,-3],[-4,-6],[-2,-3],[-2,-2],[-8,-2],[-14,-2],[-3,-1],[-2,-2],[-7,-4],[-3,-1],[-6,1],[-10,5],[-4,1],[-2,3],[-2,11],[-2,4],[-8,6],[0,1],[-1,1],[-4,9],[-2,1],[-7,3],[-7,6],[-5,2],[-3,1],[-2,-1],[-3,-2],[-2,-1],[-2,1],[-2,2],[-2,1],[-6,3],[-2,0],[-3,0],[-5,-8],[-10,0],[-3,-3],[0,-7],[-10,-3],[-2,-1],[-2,-1],[-2,-1],[-2,-2],[2,-1],[2,-3],[1,-1],[-1,-1],[0,-1],[0,-1],[-1,-1],[5,-2],[1,-2],[-1,-7],[1,-2],[2,-4],[2,-2],[-2,-2],[-5,0],[-3,-2],[-4,-7],[-3,-2],[-3,-2],[-3,-1],[-4,2],[-7,-9],[-17,0],[-20,3],[-15,-1],[1,-1],[0,-1],[1,-1],[1,-1],[0,-1],[-5,1],[-5,-1],[-9,-2],[-4,0],[-13,7],[-21,5],[-18,1],[-5,1],[1,2],[3,2],[3,2],[4,7],[3,5],[0,3],[1,4],[-1,4],[3,3],[4,2],[7,1],[13,0],[6,1],[3,5],[2,6],[7,9],[2,5],[-7,-6],[-5,-8],[-6,-6],[-10,-2],[-2,0],[-5,2],[-3,1],[-2,0],[-4,-1],[-2,-1],[-5,1],[-7,4],[-3,1],[-2,0],[-1,2],[-1,1],[-2,-1],[-1,0],[-1,-1],[-1,0],[-2,3],[-1,2],[2,3],[0,3],[-3,7],[-6,8],[-2,6],[-1,5],[2,7],[1,16],[-3,14],[-5,13],[-5,11],[-5,8],[1,5],[-1,5],[-3,5],[0,5],[-2,6],[1,8],[-1,7],[-2,5],[2,4],[3,1],[6,1],[2,3],[5,2],[4,4],[-1,3],[-4,4],[-3,2],[-1,4],[0,3],[3,3],[2,5],[0,7],[2,8],[4,6],[4,6],[4,3],[-3,4],[-4,3],[0,3],[2,2],[3,4],[3,3],[11,6],[2,8],[5,8],[-2,6],[-3,4],[0,4],[0,4],[-3,5],[-1,2],[-2,1],[-1,1],[-1,4],[1,2],[3,4],[1,3],[0,10],[0,6],[3,14]],[[9081,5509],[1,-18],[-4,-18],[-37,-11],[-8,-13],[4,-10],[9,-2],[11,-2],[8,-4],[3,-7],[-3,-2],[-5,-1],[-2,-2],[0,-4],[6,-17],[3,-5],[4,-3],[1,-4],[-2,-10],[2,-11],[0,-5],[-3,-9],[0,-4],[11,-26],[3,-6],[1,-8],[-14,-14],[0,-9],[2,-1],[5,1],[1,-2],[0,-2],[-2,-2],[-1,-1],[-2,-2],[-2,-4],[0,-3],[7,-16],[1,-4],[-2,-3],[-4,-4],[-1,-3],[-3,-8],[-2,-4],[-1,-1],[-4,-4],[-4,-3],[-7,0],[-10,5],[-6,1],[-3,-1],[-1,-2],[-3,-5],[0,-1],[0,-4],[-1,-1],[-1,-1],[-3,-1],[-1,-1],[-8,-10],[-3,-2],[-5,-1],[-2,-1],[-2,-2],[-1,-2],[1,-2],[0,-2],[0,-2],[-4,-7],[-1,-2],[1,-3],[4,-6],[1,-3],[0,-6],[-3,-3],[-20,-4],[-2,0],[-1,2],[-2,1],[-9,4],[-6,1],[-4,-1],[-2,-4],[-1,-9],[-3,-4],[-4,-3],[-4,-1],[-5,1],[-4,1],[-4,-1]],[[8517,5246],[1,1],[1,5],[0,3],[0,3],[-1,2],[-2,2],[1,3],[1,3],[3,4],[22,18],[4,4],[1,5],[13,7],[3,2],[3,10],[-1,11],[-3,10],[-11,21],[-1,6],[1,5],[4,3],[21,14],[3,2],[5,11],[4,8],[0,3],[-1,4],[1,3],[2,4],[4,3],[4,1],[3,3],[2,6],[0,6],[1,5],[2,5],[3,4],[8,7],[18,10],[7,6],[6,7],[4,9],[2,10],[3,34],[1,6],[3,5],[4,5],[3,5],[3,11],[1,2],[6,4]]],"transform":{"scale":[0.004303722201720167,0.0039020765308530898],"translate":[-109.45372473899988,-56.52345142999997]}};
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
