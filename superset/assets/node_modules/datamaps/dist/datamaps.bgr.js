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
  Datamap.prototype.bgrTopo = {"type":"Topology","objects":{"bgr":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Sliven"},"id":"BG.SL","arcs":[[0,1,2,3,4,5]]},{"type":"Polygon","properties":{"name":"Haskovo"},"id":"BG.KK","arcs":[[6,7,8,9,10]]},{"type":"Polygon","properties":{"name":"Stara Zagora"},"id":"BG.SZ","arcs":[[-4,11,-11,12,13,14]]},{"type":"Polygon","properties":{"name":"Pazardzhik"},"id":"BG.PZ","arcs":[[15,16,17,18]]},{"type":"Polygon","properties":{"name":"Plovdiv"},"id":"BG.PD","arcs":[[19,-13,-10,20,21,-16,22,23]]},{"type":"Polygon","properties":{"name":"Smolyan"},"id":"BG.SM","arcs":[[24,25,26,-17,-22]]},{"type":"Polygon","properties":{"name":"Kardzhali"},"id":"BG.KZ","arcs":[[-9,27,-25,-21]]},{"type":"Polygon","properties":{"name":"Grad Sofiya"},"id":"BG.SG","arcs":[[28,29]]},{"type":"Polygon","properties":{"name":"Sofia"},"id":"BG.SF","arcs":[[30,31,-23,-19,32,33,34,-30,35,36,37]]},{"type":"Polygon","properties":{"name":"Pernik"},"id":"BG.PN","arcs":[[-29,-35,38,39,-36]]},{"type":"Polygon","properties":{"name":"Gabrovo"},"id":"BG.GB","arcs":[[40,-14,-20,41]]},{"type":"Polygon","properties":{"name":"Lovech"},"id":"BG.LV","arcs":[[42,-42,-24,-32,43,44]]},{"type":"Polygon","properties":{"name":"Pleven"},"id":"BG.PV","arcs":[[45,-45,46,47]]},{"type":"Polygon","properties":{"name":"Veliko Tarnovo"},"id":"BG.VT","arcs":[[48,49,-5,-15,-41,-43,-46,50]]},{"type":"Polygon","properties":{"name":"Montana"},"id":"BG.MT","arcs":[[51,-38,52,53,54]]},{"type":"Polygon","properties":{"name":"Vratsa"},"id":"BG.VR","arcs":[[-47,-44,-31,-52,55]]},{"type":"Polygon","properties":{"name":"Kyustendil"},"id":"BG.KY","arcs":[[-34,56,57,-39]]},{"type":"Polygon","properties":{"name":"Vidin"},"id":"BG.VD","arcs":[[-54,58]]},{"type":"Polygon","properties":{"name":"Burgas"},"id":"BG.BR","arcs":[[59,60,-2,61,62]]},{"type":"Polygon","properties":{"name":"Yambol"},"id":"BG.YA","arcs":[[63,-7,-12,-3,-61]]},{"type":"Polygon","properties":{"name":"Razgrad"},"id":"BG.RG","arcs":[[64,65,66,67]]},{"type":"Polygon","properties":{"name":"Targovishte"},"id":"BG.TU","arcs":[[68,-6,-50,69,-66]]},{"type":"Polygon","properties":{"name":"Shumen"},"id":"BG.SH","arcs":[[70,71,-62,-1,-69,-65,72]]},{"type":"Polygon","properties":{"name":"Dobrich"},"id":"BG.DO","arcs":[[73,-71,74,75]]},{"type":"Polygon","properties":{"name":"Varna"},"id":"BG.VN","arcs":[[76,-63,-72,-74]]},{"type":"Polygon","properties":{"name":"Silistra"},"id":"BG.SI","arcs":[[-75,-73,-68,77,78]]},{"type":"Polygon","properties":{"name":"Ruse"},"id":"BG.RS","arcs":[[-67,-70,-49,79,-78]]},{"type":"Polygon","properties":{"name":"Blagoevgrad"},"id":"BG.BL","arcs":[[-18,-27,80,-57,-33]]}]}},"arcs":[[[6757,5847],[-35,-97],[32,-114]],[[6754,5636],[5,-66],[-15,-76],[23,-90],[19,-86],[-24,-48],[-7,-62],[8,-84],[-36,-50],[-50,-29],[-40,-56],[22,-87],[50,-25],[39,-39],[39,-31],[55,25],[53,42]],[[6895,4874],[5,-110],[-16,-99],[-17,-38],[-21,-19],[-42,12],[-16,-32],[-23,-24],[-24,-36],[-25,-49],[-92,-45],[-92,13],[-46,-18],[-42,-46],[16,-54],[17,-45],[-30,-24],[-27,-39],[-34,-133],[-74,-38],[-81,46],[-34,-32],[17,-104],[-47,-50],[-58,-7],[11,-123],[50,-4],[29,-33],[-82,-307],[11,-162],[-23,-123],[-58,-78]],[[6047,3073],[-37,-12],[-36,25],[-46,-2],[-49,-26],[-81,150],[8,245],[-32,152],[-74,160],[-21,76],[2,84],[-45,127],[19,66],[-4,81],[-28,80],[-36,20],[-18,50],[84,99],[-7,119],[-45,135],[-46,236],[-18,227]],[[5537,5165],[73,4],[72,24],[105,-23],[36,40],[33,58],[37,13],[37,-1],[20,74],[-4,97],[25,59],[38,18],[69,62],[36,131]],[[6114,5721],[43,11],[41,21],[20,48],[23,43],[27,18],[10,46],[2,51],[-2,48],[28,-9],[26,2],[44,30],[40,-28],[-7,-40],[11,-37],[16,17],[13,33],[59,-62],[41,-4],[40,14],[36,35],[35,-22],[47,-50],[50,-39]],[[6068,2700],[137,-107],[146,-30],[48,-57],[12,-104],[14,-53],[24,60],[34,71],[55,-19],[39,-83],[-3,-126],[33,-59],[40,-40],[40,-32],[35,30],[1,1]],[[6723,2152],[-2,-24],[-6,-61],[-14,-61],[-21,-46],[-76,-37],[-165,11],[-66,-90],[-22,-81],[-6,-72],[11,-67],[16,-36],[-61,-9],[-34,15],[-21,28],[-42,76],[-13,13],[-23,2],[-35,-53],[-88,-4],[-42,-18],[-43,-55],[-12,-8],[-11,-1],[-11,-5],[-11,-19],[-9,-42],[-1,-48],[5,-48],[7,-39],[7,-17]],[[5934,1356],[0,1],[-11,9],[-68,-36],[-17,-56],[-30,1],[-26,-23],[-11,-69],[-64,-98],[-70,52],[-73,123],[-11,65],[-6,68],[-55,33],[-57,-43],[-19,-66],[-32,-37],[-29,8],[-26,24],[-35,-25],[-31,-9],[-54,45],[10,92],[36,133],[-42,133],[-17,41],[-18,28],[-30,0],[-27,28],[-30,56],[-35,-2],[-28,-49],[-34,-5],[-35,47],[-65,46],[-15,48],[2,65],[-17,51],[-31,-2],[-27,-25],[-36,-70],[-49,-27],[-84,25],[-58,205],[18,85]],[[4597,2226],[82,85],[54,143],[5,53],[-18,30],[-8,30],[9,38],[-12,120],[-16,114],[2,154],[15,1],[25,-7],[33,-23]],[[4768,2964],[57,-39],[35,4],[18,-3],[12,-13],[18,-26],[18,-6],[18,1],[16,-4],[16,119],[23,107],[52,33],[54,-30],[78,85],[54,-42],[2,-58],[-3,-58],[-24,-52],[40,-18],[50,38],[45,-59],[66,-106],[38,-84],[75,56],[66,102],[18,39],[22,23],[13,-13],[114,-51],[84,-143],[41,-94],[47,-59],[67,55],[70,32]],[[6047,3073],[-1,-189],[22,-90],[0,-94]],[[4768,2964],[-40,90],[-59,65],[-51,20],[-56,-24],[-29,-5],[-24,-81],[-29,8],[6,47],[-17,22],[-26,17],[-17,31],[-13,-12],[-31,34],[-23,137],[20,115],[54,34],[47,42],[-36,111],[-17,74],[-3,82],[-9,118],[45,49],[59,-39],[28,-5],[10,48],[-8,43],[-21,16],[-36,65],[31,118],[-26,68],[-53,-27],[-72,3],[-62,73],[-27,57],[-12,73],[1,45],[-39,135],[30,17],[15,65],[-26,239],[8,118]],[[4260,5050],[82,-11],[83,25],[82,61],[80,6],[23,-57],[27,-43],[64,59],[87,-26],[83,-56],[52,7],[38,46],[27,-7],[27,-14],[29,20],[24,24],[30,-19],[38,66],[26,-18],[27,-57],[32,-41],[23,35],[-12,62]],[[5232,5112],[38,-4],[28,-28],[25,25],[29,38],[59,42],[29,-14],[30,-7],[33,9],[34,-8]],[[3296,4427],[-18,-159],[-4,-169],[35,-11],[20,-85],[-3,-33],[1,-74],[16,-74],[-1,-65],[29,-19],[37,-99],[-23,-87],[2,-49],[26,-59],[12,-91],[-8,-95],[-1,-67],[27,-32],[25,-47],[-24,-50],[-44,-18],[-36,-45],[5,-139],[-20,-75],[9,-93],[25,-158],[-18,-155]],[[3365,2379],[-18,-94],[-26,-107],[-59,-47],[-46,-47],[-68,-147],[-1,-155],[-69,-97],[-92,-4],[-30,-46],[-29,4],[12,58],[7,62],[-63,90],[-80,20],[-58,-17],[5,-80],[29,-37],[24,-50],[5,-109],[-48,-77]],[[2760,1499],[-29,23],[-20,57],[-182,196],[-16,52],[-20,40],[-31,-13],[-28,9],[-35,56],[-40,40],[-41,124],[-10,150],[-24,54],[-19,60],[8,55],[-2,67],[41,148],[45,82],[-30,58],[-1,74],[20,38],[4,54],[-10,69],[-28,46],[-31,39],[-15,64]],[[2266,3141],[28,12],[24,26],[-3,44],[11,31],[75,48],[52,120],[13,98],[38,17],[19,-42],[21,-34],[33,-17],[26,51],[-1,55],[-26,33],[-25,124],[28,152],[64,12],[62,41],[26,124],[-25,66],[-81,-21],[-60,85],[-20,46],[-27,33],[-22,61],[-15,71],[10,75],[47,26],[44,7],[43,-25],[35,-46],[40,-16],[74,65],[40,1],[37,28],[45,98],[58,37],[28,8],[28,18],[45,-5],[44,-23],[18,-52],[9,-59],[29,-21],[30,-13],[19,-43],[24,-2],[34,11],[34,-19]],[[4260,5084],[0,-34]],[[4597,2226],[-42,16],[-37,-37],[-14,-39],[-24,-14],[-25,-51],[-15,-73],[-35,-45],[-8,-74],[-10,-52],[-38,5]],[[4349,1862],[-27,19],[-30,1],[-60,127],[-43,-22],[-53,-3],[-31,89],[-39,56],[-71,70],[-59,118],[-77,34],[-79,-16],[-83,-37],[-78,-79],[-76,-55],[-178,215]],[[3296,4427],[54,4],[42,46],[8,74],[-41,45],[-50,108],[-69,56],[-20,153],[58,159]],[[3278,5072],[65,-11],[100,135],[60,1],[76,-13],[73,-44],[54,-110],[63,-86],[77,-24],[24,8],[12,24],[84,0],[82,-30],[73,13],[67,61],[5,41],[17,29],[50,18]],[[4349,1862],[-28,-48],[-18,-66],[17,-58],[27,-61],[18,-112],[22,-35],[-10,-65],[3,-77],[12,-32],[-6,-25],[-40,-47],[-44,-17],[-37,10],[-34,-20],[1,-74],[28,-62],[26,-101],[31,-95],[38,-29],[28,68],[86,38],[17,-154],[-9,-42],[7,-32],[-5,-82],[-22,-75],[15,-41],[17,-41],[-8,-29],[-5,-32],[13,-158],[-1,-36]],[[4488,232],[-60,44],[-6,12],[-13,33],[-4,9],[-9,0],[-26,-9],[-261,175],[-49,47],[-21,5],[-16,-6],[-33,-18],[-63,-7],[-4,-45],[4,-58],[-14,-49],[-32,3],[-34,49],[-55,110],[-31,44],[-29,22],[-31,7],[-37,0],[10,34],[-56,-2],[-22,9],[-25,36],[-1,12],[4,37],[-2,17],[-6,11],[-15,15],[-6,10],[-8,19],[-8,13],[-7,16],[-5,27],[-5,93],[-20,88],[-33,47],[-46,-28],[-35,-13],[-33,-73],[-24,-8],[-33,9],[-25,-4],[-53,-25],[-15,-3],[-42,8],[-14,-3],[-11,-10],[-11,-5],[-15,8],[-2,18],[3,28],[-1,30],[-32,31],[-25,46],[-28,-6],[-30,-20],[-27,-27]],[[2960,1035],[-1,1],[-190,254],[41,43],[31,60],[-43,46],[-15,42],[-23,18]],[[5934,1356],[12,-27],[23,-17],[23,-7],[18,-14],[14,-25],[9,-28],[15,-86],[1,-25],[-3,-53],[3,-22],[9,-12],[25,-7],[9,-16],[8,-44],[2,-38],[-2,-38],[-6,-42],[-19,-30],[-2,-23],[16,-59],[7,-15],[22,-33],[5,-20],[-3,-27],[-8,-8],[-10,-5],[-9,-21],[-17,-83],[-25,-85],[-18,-46],[-10,-8],[-12,4],[-137,-50],[-20,-16],[-43,-45],[-36,-28],[-18,-3],[-21,6],[-22,1],[-40,-33],[-23,-8],[-31,21],[-47,82],[-35,21],[-17,-10],[-59,-63],[-56,-7],[-18,-10],[-20,-23],[-11,-18],[-11,-11],[-18,-4],[-15,6],[-33,31],[-16,9],[-141,15],[-22,-11],[-12,-32],[-11,-37],[-14,-27],[-15,-10],[-13,2],[-12,6],[-17,3],[-41,-11],[-268,-138],[-37,-4],[-37,9],[-31,30],[-68,147],[-31,41],[-6,5]],[[1491,4327],[-29,53],[-95,112],[-49,30],[-8,117],[-11,63],[-17,56],[-33,26],[-28,35],[-37,59],[-42,43]],[[1142,4921],[49,97],[67,11],[34,-35],[38,-9],[28,23],[24,45],[3,66],[-19,61],[78,100],[1,153],[39,117],[25,-15],[20,-37],[80,-82],[77,-34],[80,53],[73,24],[63,-87],[60,-6],[57,61],[-20,-88],[-33,-95],[-87,-292],[-29,-204],[24,-74],[68,-254],[83,-229],[51,-74],[16,-112],[-40,-63],[-45,30],[-68,-17],[-43,45],[19,111],[-33,91],[-10,58],[-1,41],[-65,20],[-30,-97],[-39,-96],[-57,22],[-58,69],[-131,108]],[[1684,6436],[52,-3],[49,-39],[12,-45],[-34,-1],[-22,-28],[1,-67],[24,-36],[27,-28],[42,-62],[37,-74],[24,-75],[33,-56],[63,59],[68,88],[25,-37],[24,-46],[43,-3],[40,24],[34,68],[44,43],[60,-39],[158,-44],[26,-21],[27,-30],[38,39],[29,69]],[[2608,6092],[46,1],[29,-49],[12,-49],[23,-35],[10,-69],[-13,-71],[34,-61],[40,-60],[62,-22],[35,-91],[4,-108],[-3,-109],[-21,-134],[31,-76],[203,-4],[38,-33],[37,-41],[51,-17],[52,8]],[[2266,3141],[-26,3],[-18,-38],[-28,-22],[-32,21],[-54,-14],[-43,-26],[-60,-13],[-31,-122],[-53,-101],[-86,50]],[[1835,2879],[41,48],[17,73],[-43,31],[-47,6],[-31,86],[-42,49],[-70,-29],[-72,-16],[-23,75],[51,104],[19,59],[32,17],[17,42],[-23,70],[-35,21],[-26,44],[-12,33],[-18,16],[-54,189],[-34,-13],[-37,-4],[-26,22],[-28,-7]],[[1391,3795],[6,62],[21,49],[-16,146],[36,150],[53,125]],[[1142,4921],[-25,100],[-31,77],[-48,-10],[-31,10],[-17,45],[-48,0],[-27,83],[-31,58],[-40,-36],[-31,34],[10,105],[-24,20],[-21,-59],[-27,-9],[-11,17],[-16,-3],[-14,32],[-9,41],[-27,66],[-35,48],[-9,13]],[[630,5553],[10,38],[28,162],[10,42],[11,29],[19,17],[44,16],[21,12],[0,1],[21,46],[67,98],[9,26],[11,61],[8,24],[14,18],[27,20],[13,14],[33,76],[29,111],[17,111],[-3,43]],[[1019,6518],[74,25],[115,-211],[42,-49],[148,-20],[55,40],[50,20],[52,-28],[71,43],[58,98]],[[1391,3795],[-44,-8],[-43,36],[-48,12],[-45,61],[-20,-91],[-28,-5],[-30,29],[-86,45],[-36,-14],[-97,-12],[-63,-83],[-44,-13],[-38,36],[-26,71],[-36,54],[-36,35],[-25,64],[-32,62],[-26,59],[5,106],[-28,65],[-47,-20],[-27,48],[-6,70],[-28,45],[-30,81],[-21,94],[-49,40],[-61,-9],[-78,19],[-64,-8]],[[154,4664],[5,35],[7,82],[-11,46],[42,123],[21,31],[2,10],[0,10],[0,10],[-2,10],[-24,30],[-21,50],[-38,142],[-6,13],[3,12],[4,12],[11,24],[14,20],[40,33],[17,22],[25,59],[14,19],[22,1],[29,-7],[11,10],[0,1],[8,19],[22,23],[44,9],[120,-50],[49,18],[48,32],[19,35],[1,5]],[[4358,6497],[9,-64],[36,-40],[26,-85],[42,-50],[217,-6],[23,-71],[21,-89],[42,-29],[103,-19],[112,7],[49,-23],[98,-26],[27,-130],[-37,-184],[68,-105],[32,-15],[18,-49],[0,-88],[-14,-78],[-34,-104],[36,-137]],[[4260,5084],[-14,163],[-40,154],[-63,68],[-69,51],[-16,36],[-9,43],[6,51],[-8,48],[-17,149],[84,157],[-13,109],[20,136],[60,67],[11,126],[26,104],[75,-16],[65,-33]],[[4420,6827],[8,-216],[-70,-114]],[[2608,6092],[-22,88],[-8,94],[24,26],[28,-38],[40,0],[17,75],[13,134],[-13,128]],[[2687,6599],[85,78],[84,58],[38,-48],[36,12],[49,-41],[41,-10],[39,18],[47,29],[45,18],[27,49],[32,45],[30,15],[31,-1],[29,-47],[22,-65],[30,-45],[115,-51],[79,-6],[10,-18],[6,-25],[24,14],[57,74],[30,57],[13,48],[18,39],[17,-39],[18,19],[23,53],[85,95],[97,8],[37,-4],[60,11],[35,-63],[42,3],[44,20],[48,31],[42,48],[29,42],[8,88],[32,-68],[41,-126],[58,-87]],[[4698,8200],[-5,-20],[-43,-41],[-39,-54],[-22,-135],[-48,-89],[13,-103],[26,-7],[12,-32],[-36,-117],[-46,-89],[-51,-78],[18,-71],[69,6],[14,-121],[34,-107],[8,-125],[-66,-97],[-29,-31],[-26,-38],[-30,-14],[-31,-10]],[[2687,6599],[-108,67],[-14,45],[17,67],[28,98],[118,71],[23,-9],[24,-16],[18,35],[30,30],[54,5],[56,-14],[76,61],[13,193],[12,65],[-1,57],[-30,158],[-73,22],[-44,104],[-18,121],[-32,102],[40,57],[43,80],[44,58],[51,-8],[90,68],[66,154],[12,160]],[[3182,8430],[34,3],[28,13],[89,101],[56,28],[54,-10],[258,-147],[70,-40],[76,-16],[337,36],[188,-103],[207,-23],[66,-24],[53,-48]],[[5013,8131],[11,-38],[30,-147],[-35,-115],[-35,-42],[9,-72],[81,-95],[3,-41],[25,-6],[21,38],[24,-22],[-15,-94],[-11,-90],[88,-136],[92,-53],[20,61],[39,0],[13,-38],[24,0],[24,-40],[32,-45],[54,-24],[55,-8],[41,-14],[42,2],[45,36],[46,-2],[8,-72],[15,-78],[55,-32],[58,-6]],[[5872,6958],[61,-36],[44,-76],[-33,-56],[-3,-74],[52,-106],[18,-124],[-22,-7],[-23,0],[-10,-48],[0,-58],[-22,-72],[-3,-80],[21,-72],[18,-74],[7,-51],[20,-31],[22,-12],[-2,-44],[-35,-45],[9,-76],[65,-22],[58,-73]],[[4698,8200],[5,-5],[55,-64],[58,-52],[70,-14],[36,15],[67,44],[24,7]],[[2038,8680],[20,-110],[-17,-291],[-25,-119],[-32,-111],[-4,-40],[2,-41],[-18,-44],[-29,-31],[-8,-49],[27,-41],[17,-19],[19,-10],[13,-32],[17,-26],[19,-17],[2,-41],[-22,-30],[-26,26],[-38,-46],[-36,-63],[-32,-4],[-32,4],[-38,36],[-65,-58],[-49,-107],[3,-129],[-12,-130],[-39,-83],[-33,-93],[-39,-75],[-14,-93],[120,-65],[98,-83],[-21,-76],[-41,-6],[-45,-57],[4,-90]],[[1019,6518],[-2,39],[-27,18],[-79,26],[-28,27],[-22,34],[-42,89],[-39,59],[-10,22],[-5,27],[-5,61],[-6,26],[-20,45],[-114,176],[-14,15]],[[606,7182],[75,105],[43,175],[-1,71],[32,27],[59,34],[93,16],[89,43],[14,56],[-10,64],[-35,11],[-18,50],[24,180],[56,132],[77,44],[17,48],[-17,68],[-11,68],[-30,20],[-33,12],[-23,46],[25,47],[39,-4],[40,16],[12,79],[7,120]],[[1130,8710],[127,17],[48,31],[56,18],[60,49],[145,31],[255,-20],[172,-144],[45,-12]],[[2038,8680],[25,-6],[135,46],[35,-11],[91,-81],[559,-213],[16,-6],[283,21]],[[1835,2879],[-79,-98],[-91,-25],[-202,102],[-31,-8],[-30,5],[-35,-1],[-80,-63],[-45,-51],[-48,-22],[-51,-8],[-41,44],[-47,27],[-47,-5],[-27,63],[-41,-4],[-46,-118],[-12,-68],[-35,9],[-27,-44],[-20,-42]],[[800,2572],[-3,24],[-9,17],[-18,18],[-9,1],[-25,-13],[-11,0],[-12,15],[-6,23],[-4,21],[-7,14],[-16,3],[-73,-5],[-10,6],[-8,14],[-5,15],[-8,10],[-47,15],[-78,62],[-15,12],[-139,155],[-33,53],[-5,14],[-20,52],[-21,96],[-60,71],[-158,331],[31,25],[66,2],[29,14],[23,48],[26,122],[24,50],[25,19],[20,6],[18,20],[17,53],[22,123],[5,69],[-6,50],[0,1],[-13,47],[-20,39],[-49,55],[-83,119],[-7,5],[6,67],[20,134]],[[606,7182],[-8,9],[-26,18],[-16,3],[-30,-3],[-15,9],[-9,15],[-4,7],[-18,57],[-12,20],[-15,6],[-35,-2],[-17,5],[-15,18],[-22,46],[-11,17],[-53,39],[-22,31],[-15,64],[-30,159],[-20,61],[-1,17],[2,17],[4,16],[2,9],[1,8],[-1,9],[-2,8],[-5,11],[-2,13],[2,12],[5,12],[0,1],[1,2],[-1,2],[0,2],[-12,41],[-2,77],[-10,44],[-17,24],[-47,40],[-20,28],[-14,35],[-13,41],[-10,44],[-7,43],[-1,28],[6,56],[-1,26],[-42,75],[-21,91],[9,73],[20,77],[15,103],[3,100],[5,17],[16,44],[4,15],[4,52],[1,97],[3,42],[20,45],[36,24],[50,12],[25,6],[35,2],[18,34],[13,49],[18,41],[33,18],[33,-4],[28,9],[19,52],[0,29],[-11,71],[-1,32],[3,38],[16,99],[-2,0],[-3,11],[-2,17],[2,21],[4,4],[26,45],[24,60],[14,23],[69,48],[343,-353],[58,-38],[72,-15],[33,-22],[36,-25],[14,-102],[-27,-103],[-56,-47],[-34,-7],[-64,-31],[-33,-8],[-32,-31],[-18,-75],[-38,-251],[0,-76],[20,-63],[41,-53],[49,-18],[212,29]],[[8849,5383],[0,-54],[13,-72],[8,-88],[0,-160],[-3,-62],[-4,-24],[-82,-7],[-86,23],[-71,3],[-16,-5],[-12,-20],[-10,-47],[-5,-36],[2,-31],[11,-25],[25,-20],[-43,-11],[-70,-47],[-36,-10],[-29,-39],[3,-88],[18,-93],[14,-56],[-26,19],[-149,6],[-47,-42],[-20,-69],[-12,-83],[-18,-83],[-28,23],[-15,-32],[0,-50],[20,-32],[-6,-23],[-1,-17],[7,-51],[5,25],[2,4],[-1,1],[-6,13],[11,69],[50,-82],[17,-7],[19,28],[13,39],[16,16],[28,-40],[14,35],[14,-5],[13,-19],[13,-11],[22,10],[16,16],[16,9],[22,-10],[-1,-17],[-2,-3],[-3,1],[-5,-6],[9,-58],[16,-41],[25,-8],[38,41],[3,-32],[9,-16],[14,-4],[18,6],[0,-25],[-9,-4],[-25,-19],[12,-32],[7,-9],[15,-4],[-15,-34],[-2,-45],[9,-47],[19,-34],[23,-16],[19,4],[20,10],[25,2],[0,-21],[-9,-18],[-1,-19],[8,-18],[14,-18],[-40,-51],[-19,-62],[8,-62],[39,-51],[-7,-9],[-1,-3],[-3,-13],[58,-58],[9,-22],[7,-24],[18,-32],[22,-30],[18,-16],[-3,-11],[-5,-27],[-3,-10],[48,-43],[12,-23],[27,-92],[86,-85],[11,-32],[13,-31],[22,-11],[-6,-37],[8,-31],[15,-26],[16,-21],[1,-16],[-2,-5],[-5,0],[-5,-4],[18,-30],[12,-43],[2,-47],[-10,-39],[5,-34],[-58,20],[-24,12],[-78,-14],[-22,10],[-42,33],[-39,15],[-15,1],[-30,-7],[-7,4],[-6,1],[-7,-1],[-6,-4],[-5,-34],[0,-45],[-3,-33],[24,-24],[-4,-20],[-20,-13],[-21,-1],[-22,11],[-83,72],[-59,4],[-124,-51],[-4,-33],[-6,-17],[-8,0],[-12,15],[-13,-27],[-17,-17],[-34,-19],[2,-8],[5,-5],[4,-4],[5,-5],[-5,-7],[-10,-8],[-4,-7],[22,-15],[-26,-18],[-21,23],[-38,84],[-24,32],[-118,104],[-38,52],[-35,65],[-68,163],[-43,67],[-51,47],[-56,21],[-35,-8],[-20,-25],[-36,-74],[-4,-13],[-1,-12],[-7,-5],[-39,16],[-36,3],[-17,-3],[-25,31],[-27,25],[-29,14],[-28,1]],[[7514,2825],[-2,35],[13,123],[-34,91],[-22,90],[15,98],[17,68],[-5,58],[0,78],[21,57],[53,48],[10,105],[-31,92],[-48,47],[-49,2],[-47,25],[-18,57],[-13,59],[-145,166],[-1,68],[-34,31],[-63,120],[-14,31],[-3,43],[-11,44],[-21,29],[-20,85],[-12,93],[-61,184],[-94,22]],[[6754,5636],[116,45],[17,-50],[-2,-74],[56,-37],[63,18],[53,47],[35,101],[27,28],[32,-3],[90,12],[51,-52],[52,16],[64,5],[67,-39],[77,32],[75,51]],[[7627,5736],[93,32],[95,85],[77,-39],[63,-95],[50,-124],[34,-18],[37,-7],[73,-67],[79,-27],[141,54],[60,58],[43,-20],[41,-38],[38,-56],[35,-68],[41,-46],[45,-36],[46,-28],[48,16],[34,47],[38,23],[11,1]],[[7514,2825],[-3,0],[-38,-30],[-35,-104],[-31,-34],[-22,-14],[-15,-34],[-13,-41],[-18,-33],[-13,-6],[-30,8],[-17,-11],[-17,-27],[-15,0],[-15,9],[-17,-1],[-18,-17],[-19,-25],[-16,-22],[-13,-10],[-18,7],[-30,41],[-14,11],[-20,-9],[-34,-54],[-16,-19],[-31,-5],[-150,39],[-29,-5],[-26,-29],[-46,-77],[-12,-14],[-9,-16],[-7,-22],[3,-13],[19,-19],[5,-11],[-2,-19],[-6,-29],[-2,-18],[-1,-20]],[[7438,8231],[20,-108],[-40,-53],[-105,-214],[-25,24],[-18,44],[-18,-2],[-18,-13],[-40,-68],[-47,-66],[-41,-46],[27,-67],[-23,-64],[-60,-29],[-55,-57],[-8,-83],[22,-70],[-14,-94]],[[6995,7265],[-34,14],[-33,1],[-7,-130],[-33,-15],[-35,-9],[-58,-90],[-38,-1],[-38,26],[-101,0],[-12,98],[9,129],[-82,41],[-96,19],[-22,20],[-19,23],[24,117],[-65,106],[-82,75],[-70,34],[-69,-40]],[[6134,7683],[-35,88],[5,116],[-3,26],[-3,23],[8,13],[7,18],[-4,76],[18,61],[21,-27],[21,-34],[60,68],[82,-18],[21,53],[22,74],[33,27],[-4,136],[28,59],[-39,33],[-48,6],[-83,59],[4,134],[73,69],[35,125],[120,199]],[[6473,9067],[56,12],[53,-22],[43,-73],[45,20],[41,47],[36,-27],[29,-60],[12,-57],[38,-109],[135,-72],[53,-9],[29,-64],[22,-62],[13,40],[24,7],[29,17],[22,53],[24,4],[11,-64],[25,-61],[29,-33],[17,-37],[23,-32],[1,-76],[16,-39],[28,29],[26,-24],[38,-86],[47,-58]],[[6995,7265],[79,-24],[14,-119],[-30,-32],[-22,-49],[-16,-78],[-9,-77],[52,-151],[-2,-144],[-23,0],[-24,-29],[-18,-87],[-22,-65],[-52,-29],[-33,-84],[17,-47],[30,-28],[-13,-47],[-35,-13],[-4,-49],[-14,-57],[-28,-6],[-21,-33],[22,-47],[3,-57],[-40,-14],[-23,-36],[-26,-16]],[[5872,6958],[3,75],[-6,74],[-36,26],[-42,8],[-29,68],[-9,75],[40,18],[41,46],[37,59],[23,73],[8,108],[50,35],[38,44],[36,-12],[36,12],[40,-12],[32,28]],[[7757,8128],[90,-112],[33,-102],[46,-34],[63,31],[64,18],[37,-36],[16,-91]],[[8106,7802],[-128,-57],[-85,-115],[78,-40],[-18,-75],[-19,-40],[19,-26],[20,-46],[-57,-126],[-32,-56],[-14,-63],[1,-84],[28,-58],[21,-58],[-39,-48],[-44,-25],[0,-84],[-3,-66],[-54,-20],[-57,-8],[-35,-41],[-6,-83],[41,-63],[53,-32],[-1,-79],[-52,-45],[-26,-71],[37,-67],[-45,-56],[73,-39],[9,-81],[-75,-29],[-96,-82],[-38,-44],[24,-83],[41,-76]],[[7438,8231],[86,73],[63,-62],[64,-110],[106,-4]],[[9174,7079],[-5,4],[-56,-11],[-57,0],[-32,65],[-44,68],[-51,5],[-47,-34],[-26,-46],[-33,-17],[-94,75],[-79,147],[-29,84],[-41,55],[-60,19],[-63,90],[-55,121],[-25,-14],[-17,-65],[-30,-22],[-33,-7],[-12,-20],[-17,-16],[-40,30],[-11,81],[-47,102],[-64,29]],[[7757,8128],[31,-11],[28,17],[-39,91],[4,150],[78,107],[20,67],[32,26],[73,-91],[70,2],[-20,164],[40,49],[50,16],[82,-45],[64,70],[-4,104],[19,102],[40,16],[36,-49],[47,15],[4,63],[-9,39],[30,2],[29,50],[-8,74],[30,39],[43,-2],[1,0]],[[8528,9193],[62,-129],[105,39],[110,94],[89,16],[38,-97],[72,-385],[54,-64],[330,-228],[341,-89],[230,20],[-4,-46],[-5,-406],[4,-43],[17,-58],[16,-41],[11,-36],[1,-49],[-14,-86],[-26,-106],[-29,-90],[-24,-38],[-16,-13],[-75,-108],[-15,-32],[-8,-42],[-1,-58],[-22,46],[-72,61],[-15,20],[-18,32],[-40,25],[-75,21],[-36,-10],[-60,-47],[-30,-11],[-104,7],[-33,-7],[-61,-54],[-44,-93],[-7,-29]],[[9174,7079],[-90,-355],[-21,-54],[-28,-32],[-109,-45],[-18,-19],[-11,-6],[-16,0],[0,-23],[56,-63],[11,-26],[-2,-39],[-31,-146],[-22,-162],[-11,-31],[-14,-22],[-13,-24],[-6,-37],[3,-75],[24,-153],[5,-69],[-8,-226],[8,-50],[-32,-38],[0,-1]],[[6473,9067],[-22,132],[-11,101],[-42,10],[-24,77],[-4,32]],[[6370,9419],[134,29],[317,71],[53,28],[32,6],[16,7],[31,30],[19,7],[72,0],[57,26],[151,136],[188,28],[41,40],[116,-109],[169,-51],[33,-28],[39,5],[3,-2],[26,-31],[-8,-76],[34,-58],[90,-64],[19,-26],[31,-83],[17,-18],[305,4],[94,45],[37,-20],[31,-101],[11,-21]],[[5013,8131],[10,3],[72,-7],[36,6],[30,23],[30,11],[36,24],[34,32],[25,36],[28,31],[99,5],[10,0],[67,44],[37,93],[3,13],[53,83],[48,41],[75,146],[13,47],[15,40],[192,214],[12,51],[28,65],[59,99],[55,46],[129,50],[127,84],[34,8]],[[2960,1035],[-2,-2],[-24,-32],[-6,-22],[-7,-52],[-5,-13],[-12,2],[-7,14],[-7,20],[-12,15],[-48,22],[-64,9],[-46,-34],[4,-108],[4,-74],[-1,-28],[-10,-25],[-17,-14],[-19,6],[-36,37],[-5,-24],[-8,-8],[-9,-3],[-9,-10],[-26,-41],[-24,-3],[-75,87],[-13,2],[-43,-63],[-26,-19],[-33,-14],[-34,-6],[-28,3],[-24,-19],[-36,-94],[-26,-11],[-53,19],[-53,-1],[-31,-18],[-40,-64],[-4,-4],[-20,-21],[-54,4],[-105,86],[-157,7],[-31,-16],[-48,-55],[-29,-25],[-34,-6],[-16,25],[-15,38],[-30,33],[-28,-3],[-38,-25],[-35,-36],[-23,-35],[-6,-25],[-2,-61],[-9,-33],[-14,-23],[-17,-16],[-36,-16],[-67,-13],[-317,78],[38,47],[6,62],[-8,70],[-4,71],[5,21],[19,36],[4,16],[-2,19],[-9,34],[-2,16],[-5,234],[-1,52],[8,55],[1,20],[-3,22],[-15,38],[-5,19],[-3,44],[1,48],[5,47],[8,38],[8,11],[25,12],[9,8],[5,17],[10,49],[14,35],[21,53],[18,78],[-1,79],[-29,70],[-17,13],[-37,3],[-18,12],[-10,25],[-34,126],[-17,114],[-10,40],[-8,13],[-18,16],[-5,8],[-2,4],[-4,25],[1,50],[-3,23],[-17,76],[-12,77],[-3,81],[-4,36],[-12,36],[-1,0],[-1,45],[0,1]]],"transform":{"scale":[0.0006259128916891722,0.00029906294549454345],"translate":[22.345023234000053,41.23810414700006]}};
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
