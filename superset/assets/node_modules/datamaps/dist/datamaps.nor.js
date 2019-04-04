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
  Datamap.prototype.norTopo = {"type":"Topology","objects":{"nor":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Bouvet Island"},"id":"NO","arcs":[[0]]},{"type":"MultiPolygon","properties":{"name":null},"id":"-99","arcs":[[[1]],[[2]],[[3]]]},{"type":"MultiPolygon","properties":{"name":"Finnmark"},"id":"NO.FI","arcs":[[[4]],[[5]],[[6]],[[7]],[[8]],[[9]],[[10]],[[11]],[[12]],[[13]],[[14]],[[15]],[[16]],[[17]],[[18]],[[19,20]],[[21]]]},{"type":"MultiPolygon","properties":{"name":"Nordland"},"id":"NO.NO","arcs":[[[22,23]],[[24]],[[25]],[[26]],[[27]],[[28]],[[29]],[[30]],[[31]],[[32]],[[33]],[[34]],[[35]],[[36]],[[37]],[[38]],[[39]],[[40]],[[41]],[[42]],[[43]],[[44]],[[45]],[[46]],[[47]],[[48]],[[49]],[[50]],[[51]],[[52]],[[53]],[[54]],[[55]],[[56]],[[57]],[[58]],[[59]],[[60]],[[61]],[[62]],[[63]],[[64]],[[65]],[[66]],[[67]],[[68]],[[69]],[[70]],[[71]],[[72]],[[73]],[[74]],[[75]],[[76]],[[77]],[[78]],[[79]],[[80,81,82,83]],[[84]],[[85,86]],[[87]],[[88]],[[89]]]},{"type":"MultiPolygon","properties":{"name":"Troms"},"id":"NO.TR","arcs":[[[90]],[[91]],[[-86,92]],[[93]],[[94]],[[95]],[[96]],[[97]],[[98]],[[99]],[[100]],[[101]],[[102]],[[103]],[[104]],[[105]],[[106]],[[107]],[[108]],[[109]],[[110]],[[111]],[[112]],[[113]],[[114]],[[115]],[[116]],[[-20,117,-83,118]],[[119]],[[120]],[[121]],[[122]]]},{"type":"MultiPolygon","properties":{"name":"Svalbard"},"id":"SJ.SV","arcs":[[[123]],[[124]],[[125]],[[126]],[[127]],[[128]],[[129]],[[130]],[[131]],[[132]],[[133]],[[134]],[[135]],[[136]],[[137]],[[138]],[[139]],[[140]],[[141]],[[142]],[[143]],[[144]]]},{"type":"MultiPolygon","properties":{"name":"Møre og Romsdal"},"id":"NO.MR","arcs":[[[145]],[[146]],[[147]],[[148]],[[149]],[[150]],[[151]],[[152]],[[153]],[[154]],[[155]],[[156]],[[157]],[[158,159,160,161]],[[162]],[[163]],[[164]],[[165,166]],[[167]]]},{"type":"MultiPolygon","properties":{"name":"Sør-Trøndelag"},"id":"NO.ST","arcs":[[[168]],[[169,170,171,172,-162,173,-167,174]],[[175]],[[176]],[[177]],[[178]],[[179]],[[180]],[[181]],[[182]],[[183]],[[184]],[[185]],[[-187]],[[187,188]]]},{"type":"Polygon","properties":{"name":"Aust-Agder"},"id":"NO.AA","arcs":[[189,190,191,192]]},{"type":"MultiPolygon","properties":{"name":"Hordaland"},"id":"NO.HO","arcs":[[[193,194]],[[195]],[[196]],[[197]],[[198]],[[199]],[[200]],[[201]],[[202]],[[203]],[[204]],[[205]],[[206]],[[207]],[[208]],[[209,210,211,212,213]]]},{"type":"MultiPolygon","properties":{"name":"Rogaland"},"id":"NO.RO","arcs":[[[214]],[[215]],[[216]],[[217]],[[218]],[[219]],[[220,-192,221,222,-194,223,-212]]]},{"type":"MultiPolygon","properties":{"name":"Sogn og Fjordane"},"id":"NO.SF","arcs":[[[224]],[[225]],[[226]],[[227]],[[228]],[[229]],[[230]],[[231]],[[232]],[[233]],[[234]],[[235]],[[-160,236,237,-214,238]]]},{"type":"MultiPolygon","properties":{"name":"Vest-Agder"},"id":"NO.VA","arcs":[[[239]],[[240,-222,-191]]]},{"type":"Polygon","properties":{"name":"Akershus"},"id":"NO.AK","arcs":[[241,242,243,244,245,246]]},{"type":"Polygon","properties":{"name":"Buskerud"},"id":"NO.BU","arcs":[[247,248,249,250,-210,-238,251]]},{"type":"Polygon","properties":{"name":"Hedmark"},"id":"NO.HE","arcs":[[252,-247,253,-172]]},{"type":"Polygon","properties":{"name":"Oppland"},"id":"NO.OP","arcs":[[-173,-254,-246,254,-252,-237,-159]]},{"type":"Polygon","properties":{"name":"Oslo"},"id":"NO.OS","arcs":[[-245,255,-248,-255]]},{"type":"Polygon","properties":{"name":"Telemark"},"id":"NO.TE","arcs":[[256,257,-193,-221,-211,-251]]},{"type":"MultiPolygon","properties":{"name":"Vestfold"},"id":"NO.VF","arcs":[[[258]],[[259]],[[260]],[[-257,-250,261]]]},{"type":"MultiPolygon","properties":{"name":"Østfold"},"id":"NO.OF","arcs":[[[262]],[[263]],[[264]],[[-243,265]]]},{"type":"MultiPolygon","properties":{"name":"Nord-Trøndelag"},"id":"NO.NT","arcs":[[[266]],[[267]],[[268]],[[269]],[[270]],[[271]],[[272]],[[273]],[[274]],[[275,-170,276,-188,277,-23,278,-81]]]}]}},"arcs":[[[2941,5],[4,0],[2,-1],[-1,-1],[-2,-1],[-1,0],[-6,-1],[-14,0],[-4,-1],[-1,0],[-1,0],[-1,1],[-2,2],[8,2],[10,1],[9,-1]],[[3309,8526],[-1,0],[-1,0],[-3,0],[-4,0],[-3,0],[-2,1],[-2,0],[0,1],[1,0],[0,1],[-2,1],[-1,3],[2,0],[3,0],[4,-1],[3,-1],[6,-5],[1,0],[-1,0]],[[4216,8740],[1,0],[2,0],[0,-1],[-2,0],[-2,0],[-1,0],[-1,-1],[-1,0],[-2,0],[-2,0],[-1,0],[-1,1],[-2,0],[2,0],[2,1],[1,0],[3,0],[3,0],[1,0]],[[4755,8744],[-5,0],[-8,0],[-3,0],[-22,-3],[-1,0],[-2,-1],[-2,0],[-6,0],[-2,0],[2,1],[5,1],[2,1],[2,1],[3,0],[4,0],[31,1],[3,0],[2,0],[-3,-1]],[[9186,9187],[-9,0],[-3,0],[3,1],[1,0],[2,0],[7,-1],[-1,0]],[[9155,9194],[3,0],[7,0],[1,0],[-1,-1],[1,0],[3,-1],[-6,0],[-5,0],[-3,1],[-1,1],[1,0]],[[9153,9191],[0,-1],[18,0],[2,0],[-5,-1],[-7,0],[-19,-1],[-11,-1],[-6,-1],[-4,1],[-5,0],[-4,1],[-4,-1],[4,-1],[-3,0],[-9,-1],[-19,0],[5,2],[15,2],[7,2],[-5,2],[2,2],[6,1],[8,0],[22,-1],[5,0],[1,-1],[0,-1],[1,0],[1,0],[5,-1],[0,-1],[-1,0]],[[8056,9224],[1,0],[3,0],[1,0],[1,-1],[-1,0],[-1,0],[0,-1],[-1,0],[-23,-2],[-1,1],[5,1],[1,1],[1,0],[3,0],[0,1],[2,0],[7,1],[2,-1]],[[7214,9222],[-4,0],[-3,0],[-3,1],[-3,1],[1,1],[2,2],[0,2],[-1,1],[1,0],[1,0],[1,0],[2,1],[2,0],[4,0],[2,0],[12,-2],[2,-1],[-1,-1],[-7,-3],[-4,-1],[-4,-1]],[[7151,9228],[-13,-1],[-1,0],[1,1],[-2,0],[-1,0],[-1,1],[9,2],[3,0],[1,0],[0,-1],[1,0],[1,-1],[1,-1],[2,0],[-1,0]],[[7439,9231],[0,-1],[1,-1],[4,-1],[4,0],[1,2],[-1,1],[6,1],[5,-1],[5,-1],[1,-2],[5,-1],[31,0],[-3,0],[-2,-1],[-2,0],[-1,-1],[4,0],[6,0],[5,-1],[5,-1],[2,-1],[0,-1],[-4,0],[-63,1],[-67,2],[-15,3],[-2,0],[1,1],[5,1],[5,0],[5,0],[3,-1],[4,0],[8,-1],[-7,1],[-1,1],[-1,1],[2,1],[2,0],[11,-1],[10,1],[6,-1],[2,1],[3,0],[3,0],[2,-1],[1,0],[1,1],[2,1],[4,0],[3,0],[1,-1]],[[9409,9230],[-7,0],[-1,0],[-2,0],[-1,0],[-1,1],[-1,0],[0,1],[-1,0],[0,1],[2,0],[1,-1],[1,0],[2,-1],[1,0],[3,0],[3,0],[1,-1]],[[7628,9248],[4,0],[9,0],[4,0],[-3,0],[2,-1],[7,-2],[-1,0],[-2,-1],[-1,-1],[-1,-1],[3,-1],[5,0],[5,-1],[5,0],[-1,0],[-4,-1],[-1,0],[1,-1],[5,0],[2,-1],[-7,-2],[-10,-2],[-43,-4],[-21,-1],[-6,-1],[5,0],[6,0],[6,0],[4,-1],[-39,-2],[-14,-1],[-12,1],[-5,1],[1,2],[6,2],[3,1],[2,1],[1,1],[-1,1],[-14,-4],[-8,-1],[-7,1],[-3,0],[-4,0],[-4,0],[-3,0],[-3,1],[-15,2],[-4,1],[6,0],[14,0],[5,1],[-10,1],[-3,0],[-3,1],[1,0],[6,0],[3,1],[2,0],[2,0],[1,0],[1,0],[0,1],[2,0],[5,0],[1,0],[2,0],[2,1],[1,0],[25,2],[4,0],[2,-1],[5,0],[7,1],[5,0],[-5,1],[-5,0],[-1,1],[5,0],[4,0],[6,0],[5,-1],[2,-1],[-1,-1],[-1,-1],[0,-1],[4,0],[3,0],[4,3],[4,1],[-5,0],[-2,1],[3,0],[6,0],[4,0],[8,-1],[5,0],[-3,1],[-2,0],[6,1],[22,-1],[8,0],[-6,1],[-6,1],[-12,1],[1,0],[2,1],[2,1],[-14,0],[-2,0],[17,1],[5,0],[4,-1]],[[8179,9252],[-11,0],[-2,0],[-4,1],[0,1],[1,0],[14,1],[6,0],[0,-1],[3,0],[-1,-1],[-6,-1]],[[7702,9255],[3,0],[3,0],[3,0],[3,0],[22,0],[3,0],[13,-1],[3,-1],[2,0],[2,-1],[1,0],[0,-2],[4,0],[11,-1],[-7,-3],[-21,-1],[-19,-4],[-14,0],[-15,0],[-13,0],[-3,1],[-6,2],[-3,1],[-1,0],[0,1],[0,1],[-2,0],[-10,0],[5,1],[4,1],[0,1],[-6,1],[5,0],[2,0],[1,1],[-11,1],[-2,1],[1,1],[3,0],[6,1],[5,2],[3,0],[24,0],[6,0],[-2,-1],[-1,0],[2,-1],[3,0],[-2,0],[-1,-1],[-1,0],[-3,0]],[[7603,9265],[9,-1],[2,0],[1,-1],[2,-1],[3,0],[4,0],[-6,-1],[-11,0],[-6,0],[4,-1],[4,0],[9,0],[-3,-1],[-5,0],[-2,0],[-1,0],[-1,-1],[-1,0],[-4,0],[-9,0],[-3,0],[-2,0],[0,-2],[-2,-1],[-1,0],[-2,0],[-2,0],[-3,0],[-8,-1],[4,-1],[1,0],[-21,1],[-3,0],[-2,0],[-1,-1],[-2,-1],[-1,0],[-2,0],[2,-1],[3,0],[6,0],[-3,0],[-4,-2],[-2,0],[-5,0],[-10,0],[-4,0],[12,-1],[-5,-2],[-8,0],[-9,1],[-8,0],[5,0],[1,-1],[-3,-1],[-5,-1],[-5,1],[-11,0],[-6,0],[13,-1],[-3,-1],[-2,0],[-3,0],[-3,-1],[-4,1],[-7,0],[-2,0],[-3,0],[-5,-1],[-3,-1],[-3,1],[-2,0],[0,1],[3,0],[-21,1],[-11,0],[-2,-1],[-2,0],[2,-1],[-3,-1],[-3,0],[-1,1],[-2,0],[-1,0],[-1,-1],[-2,-1],[-1,0],[-2,0],[-11,2],[-7,0],[-3,-2],[-2,-1],[-4,0],[-5,1],[-1,0],[-4,1],[-2,0],[-6,-1],[-7,0],[-8,0],[-4,1],[5,1],[-6,1],[-4,-1],[-6,-3],[-5,-1],[-9,0],[-7,0],[-3,0],[2,2],[3,0],[5,2],[4,1],[10,1],[5,1],[-2,0],[-5,0],[18,2],[5,1],[-55,0],[-2,-1],[-3,0],[-2,-1],[-7,1],[-6,0],[3,1],[7,1],[4,1],[-15,0],[-7,0],[-7,1],[9,1],[13,-1],[36,-2],[6,0],[5,1],[1,1],[1,0],[-2,1],[-3,1],[8,0],[13,-1],[22,-3],[0,1],[-3,1],[-4,1],[-3,2],[3,1],[5,0],[2,0],[1,0],[3,-1],[4,-1],[5,0],[5,0],[4,0],[-3,1],[1,1],[4,1],[5,0],[7,-1],[19,-1],[1,-1],[-3,-1],[-9,-1],[-2,0],[3,-1],[5,0],[5,0],[5,1],[4,1],[3,-1],[1,-1],[1,-1],[1,-1],[2,-1],[2,1],[1,1],[0,1],[3,1],[6,0],[12,0],[-4,1],[-6,1],[2,1],[-3,1],[-6,0],[-5,2],[-2,0],[-1,1],[1,0],[7,0],[12,1],[-2,-1],[-1,0],[4,0],[10,0],[4,-1],[-3,0],[0,-1],[4,0],[8,0],[4,0],[2,0],[-3,-1],[-6,-1],[6,-1],[6,-1],[5,0],[6,0],[-4,1],[5,1],[5,0],[3,1],[-1,1],[5,0],[11,-1],[6,0],[-2,0],[-3,1],[-1,1],[1,0],[15,0],[4,0],[-2,0],[-2,1],[-4,0],[-3,0],[-1,0],[0,1],[-14,0],[-4,1],[-5,1],[4,1],[12,0],[-2,0],[-2,0],[-2,0],[-2,1],[6,0],[11,-2],[6,0],[4,0],[2,1],[-2,1],[-4,0],[0,1],[6,-1],[13,-2],[6,-1],[4,0],[10,0],[2,1],[0,1],[-4,1],[0,1],[0,1],[-2,1],[3,1],[4,0],[3,0],[4,-1],[3,-1],[2,0]],[[7762,9277],[8,0],[18,0],[9,-1],[-8,0],[-19,0],[-8,-1],[1,0],[1,0],[1,-1],[-3,0],[32,0],[8,-1],[-8,0],[-3,-1],[-3,0],[-4,0],[2,0],[-4,-1],[-4,0],[-4,1],[-4,0],[-3,-1],[-1,0],[-3,-1],[-8,0],[-5,0],[-4,1],[-2,1],[-3,0],[-18,1],[8,1],[16,0],[7,1],[-8,0],[-15,0],[-8,0],[-5,1],[2,1],[13,0],[-3,0],[-1,1],[-2,0],[8,1],[30,-1],[-2,0],[-1,-1]],[[7973,9280],[5,-1],[3,0],[5,0],[3,0],[1,0],[-1,0],[-1,-1],[-4,0],[-1,-1],[1,0],[1,0],[-3,0],[-1,0],[-2,-1],[-7,0],[-1,1],[3,0],[-5,0],[-7,1],[1,1],[2,0],[-1,1],[1,0],[8,0]],[[7927,9284],[2,-1],[4,1],[3,0],[4,0],[-4,-1],[-1,0],[3,-1],[-2,0],[-7,0],[-3,-1],[3,0],[0,-1],[-4,-1],[-4,-1],[-8,1],[-4,0],[-4,0],[-4,1],[-8,0],[-5,1],[1,1],[7,1],[6,0],[5,0],[3,-1],[-1,0],[4,0],[3,0],[1,0],[-1,1],[-6,1],[1,1],[8,0],[4,-1],[1,0],[1,0],[2,0]],[[7264,9134],[6,0],[110,1],[19,2],[6,1],[3,0],[5,2],[1,1],[1,1],[1,1],[0,1],[0,1],[-1,1],[-3,1],[-4,1],[-20,5],[-11,2],[-8,1],[-8,2],[-2,1],[-2,1],[-1,1],[-1,1],[0,1],[1,1],[3,0],[58,2],[38,1],[3,0],[1,0],[0,1],[-1,0],[-1,0],[1,1],[5,0],[3,1],[2,1],[1,0],[2,1],[5,1],[16,2],[3,1],[-1,0],[-3,1],[-7,0],[-5,0],[-17,0],[-17,1],[-13,1],[-8,2],[-3,1],[-5,2],[-4,1],[-8,1],[-3,1],[-1,1],[1,0],[2,1],[9,1],[2,1],[-3,1],[-4,0],[-4,1],[2,1],[3,1],[1,1],[-2,1],[-4,0],[-13,0],[-34,2],[-4,0],[-2,1],[-4,1],[-12,3],[-2,0],[0,1],[0,1],[-11,3],[-5,2],[-3,1],[-3,1],[-3,1],[-4,0],[-3,0],[-5,0],[-7,-1],[-3,0],[-12,0],[-2,0],[-3,0],[-5,-1],[-2,0],[-1,0],[1,0],[0,-1],[-6,0],[-7,-1],[-4,0],[-26,3],[-23,3],[-8,1],[-7,0],[-14,-1],[-68,3]],[[7098,9219],[8,1],[9,1],[7,0],[16,1],[8,1],[-1,-2],[2,-1],[11,-2],[0,1],[0,1],[3,1],[1,1],[1,1],[0,1],[1,1],[4,1],[4,0],[5,0],[3,0],[0,-1],[0,-1],[1,0],[5,-1],[6,-1],[11,0],[6,-1],[20,-3],[2,-1],[1,0],[3,-1],[2,-1],[10,-1],[2,1],[-1,0],[-1,1],[-1,1],[-1,0],[-1,0],[0,1],[2,0],[2,0],[2,0],[2,0],[-5,1],[-11,0],[-4,1],[-1,2],[4,1],[39,4],[5,0],[5,-1],[-3,0],[-6,-1],[-2,-1],[6,0],[15,1],[5,0],[2,0],[1,-1],[0,-3],[2,-1],[6,0],[3,1],[0,1],[-3,2],[29,0],[9,0],[3,-1],[-4,-1],[-6,-2],[-4,0],[4,-1],[1,-1],[1,-2],[2,-1],[-3,-1],[-7,0],[-3,-1],[9,0],[31,1],[28,-2],[8,0],[-6,1],[-6,1],[-43,1],[2,1],[6,3],[4,2],[-1,0],[7,1],[7,0],[8,0],[11,-1],[9,-1],[3,0],[3,0],[2,1],[3,-1],[-1,-1],[2,0],[17,0],[68,-1],[2,-1],[-1,0],[-26,-5],[-5,0],[-8,-1],[-16,-1],[-43,-1],[-18,0],[-9,0],[-10,-1],[-25,-2],[4,0],[6,0],[7,0],[8,1],[59,1],[16,2],[36,1],[26,2],[9,1],[-4,-3],[0,-1],[-1,-1],[1,-1],[2,-2],[2,-1],[3,0],[5,0],[8,1],[7,0],[3,-1],[-1,-1],[-1,-1],[1,-1],[6,-1],[-3,-1],[-3,0],[-4,0],[-3,-1],[7,0],[8,0],[29,3],[4,0],[3,0],[1,0],[1,0],[3,-1],[1,0],[-1,0],[-6,-2],[5,0],[21,2],[11,1],[2,0],[2,1],[4,1],[5,0],[4,0],[-12,1],[-45,1],[-5,0],[-23,4],[4,0],[8,0],[4,0],[3,1],[4,0],[19,0],[5,1],[6,1],[-6,1],[-13,0],[-5,1],[6,1],[18,0],[4,1],[-21,0],[-12,0],[-8,2],[7,0],[26,1],[7,0],[17,0],[3,0],[1,1],[6,0],[-7,0],[-7,1],[-42,-1],[5,1],[20,1],[40,1],[10,1],[-24,0],[2,0],[6,2],[-5,0],[-9,-1],[-5,0],[5,1],[7,3],[5,0],[6,1],[7,0],[12,2],[25,3],[15,3],[6,0],[18,1],[63,-1],[26,-1],[3,-1],[6,0],[3,-1],[2,1],[0,1],[-3,0],[-7,0],[-13,3],[-6,0],[-28,1],[-2,1],[2,0],[23,3],[6,1],[2,0],[2,0],[2,0],[2,1],[1,1],[0,2],[2,0],[2,1],[10,1],[4,1],[4,0],[9,-1],[16,0],[5,0],[27,-4],[8,-1],[9,0],[9,1],[3,1],[-3,2],[-15,2],[-4,1],[1,0],[2,0],[-16,1],[-5,1],[-5,1],[-3,0],[-4,0],[-12,0],[-27,1],[-13,0],[-6,1],[-5,1],[5,1],[0,1],[1,2],[22,1],[7,1],[5,-1],[-2,-1],[10,0],[4,-1],[-1,-1],[13,0],[13,-1],[10,-2],[4,0],[4,2],[-3,0],[-2,1],[-7,1],[2,1],[0,1],[1,0],[4,1],[5,0],[7,-1],[7,0],[3,1],[-20,2],[-7,0],[3,1],[2,0],[-8,1],[-3,0],[-2,1],[4,0],[5,1],[5,0],[5,0],[-4,0],[-8,0],[-4,1],[5,0],[7,1],[6,0],[26,-1],[2,0],[1,0],[2,-1],[2,0],[7,-1],[3,0],[3,-1],[-2,0],[-4,-1],[-4,0],[39,0],[-4,1],[2,2],[3,1],[-4,0],[5,1],[9,-1],[7,-1],[-2,-2],[-7,-1],[-8,-1],[-9,-1],[-8,-1],[4,0],[9,0],[4,0],[4,-1],[10,0],[4,0],[0,1],[2,1],[9,2],[5,1],[2,0],[2,0],[2,-1],[1,0],[4,-1],[12,-2],[2,-1],[6,-2],[-5,-3],[3,0],[2,0],[2,1],[2,0],[2,1],[4,0],[7,0],[2,0],[10,5],[1,1],[-2,1],[-3,0],[-3,1],[-3,1],[-2,1],[6,2],[12,-1],[28,-3],[0,-1],[-2,-1],[-4,-1],[-4,0],[-12,-2],[-5,0],[5,-1],[5,0],[11,2],[2,0],[4,-1],[4,0],[1,0],[7,2],[7,0],[10,1],[10,0],[5,-1],[1,0],[2,-1],[2,-1],[2,0],[3,0],[2,1],[2,1],[1,0],[8,0],[7,1],[7,0],[6,-1],[2,-1],[2,0],[0,-1],[-7,-1],[-6,-1],[-11,0],[-5,-1],[-11,-2],[-7,-1],[-22,-1],[1,-1],[1,0],[4,-1],[-4,-1],[-5,-1],[-5,0],[-9,-1],[-11,-2],[-15,0],[-4,-2],[-18,-2],[-11,-1],[-4,-1],[-8,-1],[-4,-1],[-32,-3],[-6,-1],[40,2],[10,-2],[-11,-1],[-43,0],[9,-1],[34,0],[11,-2],[-5,0],[-4,0],[-1,-1],[4,-2],[0,-1],[-2,-1],[-13,1],[-10,0],[-18,-3],[3,0],[4,0],[6,0],[-4,-1],[-3,0],[0,-1],[4,-1],[4,1],[6,0],[5,1],[4,-1],[1,-1],[-1,-1],[-34,-4],[-7,0],[-3,0],[-3,-1],[-2,0],[-1,0],[-2,0],[-1,-1],[-2,-1],[0,-1],[-1,0],[1,-1],[-1,-1],[-4,-1],[-1,-4],[5,-1],[9,-2],[8,0],[-1,3],[-2,0],[-3,1],[-1,0],[1,2],[4,0],[16,1],[-2,0],[-3,-2],[4,0],[4,0],[3,0],[3,0],[-7,0],[-3,-1],[-3,0],[3,-1],[2,-1],[3,0],[5,-1],[6,1],[10,0],[6,1],[6,0],[4,2],[9,3],[3,1],[4,1],[5,0],[5,0],[3,0],[4,1],[4,1],[2,1],[3,1],[15,2],[6,2],[-6,1],[-22,1],[5,1],[50,7],[50,9],[6,1],[7,0],[8,1],[7,2],[5,1],[10,5],[4,1],[3,1],[8,0],[4,0],[2,1],[3,1],[2,1],[6,1],[15,2],[12,2],[16,3],[56,6],[18,0],[-1,0],[-2,-1],[11,-1],[-2,-1],[1,0],[2,0],[1,-1],[-1,-1],[-2,0],[-3,-1],[-3,0],[-3,-1],[-3,0],[-1,-1],[1,-1],[2,0],[3,0],[3,0],[4,0],[3,1],[3,-1],[-1,0],[-2,-1],[-4,-1],[-3,-1],[-3,-1],[-1,-2],[1,-1],[-12,-2],[-70,-4],[8,-1],[29,2],[9,0],[20,-1],[8,-1],[-13,-6],[1,-1],[-3,-1],[-5,0],[-3,-1],[0,-1],[1,-1],[2,0],[2,-1],[-9,-1],[-5,-1],[-2,-1],[1,-1],[2,-1],[0,-1],[-2,-1],[-1,0],[-1,-1],[2,-1],[9,0],[3,0],[2,0],[1,1],[1,0],[2,1],[4,0],[6,0],[3,0],[-4,1],[-1,1],[2,0],[5,1],[1,0],[7,0],[7,0],[7,0],[7,1],[4,1],[1,1],[2,1],[31,0],[-3,-1],[4,0],[24,1],[6,0],[6,-1],[-3,1],[-8,0],[-2,1],[-5,1],[-11,2],[-3,0],[6,1],[2,0],[2,1],[-6,0],[-2,0],[4,2],[7,1],[8,1],[6,0],[2,0],[4,-1],[2,0],[3,0],[10,0],[17,-1],[5,0],[-7,1],[-24,2],[-8,1],[2,1],[12,2],[-4,1],[-10,0],[-4,1],[7,2],[7,0],[34,1],[7,-1],[3,1],[3,1],[-5,0],[-6,0],[-3,1],[2,1],[5,2],[3,1],[6,0],[65,-2],[-35,2],[4,0],[3,0],[3,1],[3,0],[-3,1],[-3,0],[-2,1],[-2,0],[-5,0],[-2,0],[-1,0],[0,1],[-1,0],[-2,0],[-8,-1],[-4,0],[-2,1],[1,1],[4,1],[1,0],[-4,0],[-5,-1],[-4,-1],[-4,0],[-34,1],[-9,1],[-7,1],[2,2],[4,1],[5,0],[42,-2],[-2,1],[-2,1],[-6,1],[-4,0],[-10,1],[-4,0],[-2,2],[7,1],[53,-2],[5,-1],[2,-2],[5,-1],[6,0],[5,1],[-2,1],[-1,1],[1,1],[3,1],[-8,0],[-3,1],[-1,1],[-1,1],[0,1],[2,1],[8,1],[10,-1],[7,1],[2,2],[15,-2],[3,-1],[-7,-2],[6,0],[15,0],[6,0],[10,-1],[5,-1],[20,1],[5,1],[4,0],[5,1],[5,0],[4,-1],[1,0],[0,-1],[1,0],[3,0],[1,0],[14,2],[5,1],[6,0],[4,0],[5,-1],[5,0],[2,-1],[-2,-1],[-5,-1],[-4,0],[-3,-1],[4,0],[-2,0],[-2,-1],[-2,0],[-2,-1],[4,1],[9,0],[-1,0],[-2,-1],[-2,0],[-3,-1],[6,0],[26,2],[35,0],[9,-2],[2,0],[2,0],[0,-1],[-2,0],[-2,-2],[-6,-1],[-1,-1],[-4,-2],[-9,0],[-18,0],[4,-1],[4,0],[5,0],[5,0],[-5,-1],[-6,-1],[-13,0],[2,0],[1,-1],[1,0],[1,0],[-32,0],[4,0],[4,-1],[9,0],[-8,-2],[-10,0],[-10,0],[-10,0],[-13,1],[-5,0],[-9,-1],[-3,1],[1,1],[-3,0],[-3,0],[-3,-1],[-4,0],[-2,0],[-30,-1],[-3,0],[-2,1],[-6,-1],[-3,0],[4,-1],[8,0],[4,0],[-4,-1],[-4,0],[-3,0],[-2,-1],[20,1],[10,0],[20,0],[1,-1],[1,0],[3,0],[17,0],[6,0],[6,-1],[-14,-2],[-33,-2],[-14,-1],[1,0],[-19,-2],[-10,-1],[-7,0],[-11,-1],[-6,0],[34,0],[84,5],[23,3],[7,0],[4,-1],[-3,-4],[-12,-3],[-16,-2],[-25,-2],[-6,-1],[-9,-1],[-20,-1],[-9,-1],[-5,-2],[3,-1],[2,0],[3,-3],[2,1],[5,3],[3,0],[4,1],[8,0],[-5,-1],[-4,-1],[28,2],[29,1],[-24,-2],[-7,-1],[-2,-1],[2,-1],[8,1],[6,1],[5,0],[-1,0],[-4,0],[-2,-1],[1,0],[5,-1],[2,1],[10,2],[8,1],[9,1],[10,1],[9,0],[-3,-2],[-4,0],[-5,-1],[-4,-1],[-4,-1],[-8,-2],[-10,-2],[-2,-1],[-1,-1],[2,-1],[2,-2],[-1,-1],[-3,-2],[0,-3],[5,-5],[0,-2],[-3,-1],[-3,-1],[-4,-1],[-9,-2],[-6,-1],[-8,0],[-6,0],[12,-1],[15,2],[13,2],[8,3],[2,2],[-2,0],[-2,1],[-2,2],[1,2],[-1,0],[-1,1],[-1,2],[1,1],[5,2],[2,1],[1,2],[0,1],[0,1],[4,1],[2,1],[8,1],[7,0],[1,1],[0,1],[1,0],[6,1],[8,1],[9,0],[7,0],[0,-1],[3,-2],[4,0],[5,0],[1,1],[-1,0],[-2,1],[2,1],[4,0],[7,1],[-17,1],[-6,0],[-12,2],[-2,0],[1,1],[18,5],[1,1],[2,1],[2,1],[4,1],[4,0],[10,0],[8,-1],[2,1],[-2,1],[-8,1],[-9,0],[-3,1],[7,2],[20,3],[12,3],[8,1],[8,2],[8,0],[61,1],[6,0],[5,-1],[-10,0],[0,-1],[38,0],[9,-1],[0,-1],[0,-1],[1,0],[2,0],[2,-1],[4,0],[19,-1],[6,0],[-6,-1],[-20,-2],[6,-1],[23,0],[-5,0],[-6,-1],[-12,0],[2,-1],[2,0],[3,0],[3,0],[-3,-1],[-5,0],[-6,-1],[-5,0],[1,0],[2,0],[-3,-1],[5,-1],[6,0],[9,3],[6,0],[29,1],[42,3],[11,0],[8,-2],[1,-2],[-5,-2],[-14,-2],[-5,-1],[33,1],[4,0],[2,1],[3,0],[2,1],[21,3],[8,0],[18,1],[8,-1],[24,-2],[-5,-1],[-7,-1],[-14,0],[8,-1],[26,0],[22,-3],[3,0],[-5,-1],[-14,-1],[-27,-1],[-6,-1],[3,0],[3,0],[2,0],[1,-1],[-9,0],[-20,1],[-9,0],[0,-1],[38,-1],[68,3],[11,0],[19,-1],[4,-1],[-9,-1],[40,-4],[2,-2],[11,-1],[6,-1],[2,1],[4,1],[20,1],[5,0],[6,-2],[4,-1],[4,0],[13,-3],[-3,-1],[-4,-1],[-3,0],[1,-1],[2,-1],[4,0],[4,-1],[3,-1],[-9,0],[-25,-2],[-90,-1],[-8,-1],[0,-1],[-6,-1],[-21,-1],[-6,-1],[-4,-1],[7,-1],[-7,-2],[-9,-1],[-40,-1],[-6,-1],[-1,-1],[4,0],[6,0],[-110,2],[-110,2],[2,0],[-67,2],[-67,2],[-9,0],[-4,-1],[36,0],[-5,-1],[-10,-1],[-11,-1],[-7,0],[4,-1],[8,-1],[16,0],[10,1],[3,0],[11,-1],[4,0],[-22,0],[-6,-1],[45,-1],[16,-1],[34,0],[-2,-1],[-1,0],[9,0],[5,0],[2,-1],[-2,0],[-13,-1],[7,-1],[43,1],[11,-1],[69,-3],[-5,0],[-21,-2],[-10,-1],[-10,-1],[-11,-1],[-5,0],[-1,-1],[-1,0],[-1,-1],[-2,0],[-2,0],[-6,-1],[11,0],[6,0],[8,2],[10,2],[5,0],[3,0],[4,0],[3,0],[3,0],[3,-1],[6,1],[9,-1],[11,1],[6,0],[-2,-1],[1,-1],[2,0],[-1,-1],[8,-2],[-5,-1],[-4,-2],[-9,-1],[-11,-1],[-1,-1],[-5,-1],[-3,0],[-2,-1],[-3,-1],[-5,0],[-10,-1],[-4,0],[8,0],[-2,-1],[-7,-1],[-4,-1],[8,0],[4,1],[6,1],[27,3],[8,1],[25,0],[19,-1],[1,0],[20,3],[9,0],[7,0],[-4,-1],[-6,-2],[-4,-1],[-11,0],[-4,-1],[0,-1],[4,1],[5,1],[12,0],[10,1],[3,0],[4,-1],[3,-1],[15,-2],[2,1],[1,0],[-2,1],[-4,0],[-10,3],[-2,1],[5,0],[13,0],[4,1],[1,1],[-4,0],[-4,1],[-4,1],[1,1],[1,1],[0,2],[-1,1],[18,0],[11,0],[3,0],[5,-1],[-1,-1],[-11,-1],[7,0],[17,0],[6,0],[1,-1],[0,-1],[0,-1],[2,-1],[0,-1],[0,-3],[0,-2],[-6,-2],[-11,0],[5,-1],[16,1],[3,0],[2,1],[1,2],[-2,0],[0,1],[4,0],[0,1],[1,0],[-1,1],[-2,1],[-1,1],[2,0],[-2,2],[8,0],[50,0],[5,-1],[-3,-1],[-2,0],[1,-1],[3,0],[4,0],[4,0],[8,1],[1,0],[12,1],[1,-3],[6,-1],[2,-1],[1,-1],[0,-1],[4,-1],[7,-2],[0,-5],[-1,-2],[-6,-2],[-11,-1],[-23,-1],[-57,1],[-7,1],[-43,6],[-15,1],[-11,0],[-10,0],[-5,0],[1,-1],[5,-1],[15,0],[2,-1],[2,-1],[1,-2],[-2,-1],[-3,-1],[-4,-1],[-7,0],[-2,-1],[-2,-1],[-1,-1],[0,-1],[-1,-1],[-3,-1],[-29,-3],[-8,-2],[-4,0],[-12,-1],[-34,0],[-6,0],[-15,-2],[-14,-1],[-40,0],[-13,-1],[-10,-2],[-2,-1],[-2,-2],[-2,-1],[-1,0],[0,-1],[-2,-1],[-5,-1],[-1,-1],[-4,-3],[-3,-1],[-4,-1],[-12,-2],[-12,-2],[-13,-1],[-13,0],[-8,0],[-5,0],[-27,4],[-2,0],[-1,2],[4,5],[2,2],[3,1],[85,12],[27,6],[-33,9],[-13,6],[-3,1],[-77,4],[-76,4],[-8,0],[-9,1],[-6,2],[0,2],[-45,2],[-5,1],[-43,8],[-13,4],[-7,1],[-7,0],[-18,-1],[-29,1],[-13,-1],[-9,-1],[-2,-2],[-28,-1],[-15,-2],[-4,0],[-3,0],[-4,-1],[-2,0],[1,0],[4,-1],[2,0],[-10,-2],[-49,-2],[-5,0],[-17,2],[-6,0],[-7,0],[-13,1],[-8,0],[-21,-1],[-15,1],[-41,-1],[-8,0],[-4,-2],[-8,-1],[-3,-1],[3,-1],[-7,-1],[-24,-3],[-11,-3],[-11,-2],[-2,-1],[-3,0],[-4,-1],[-35,-1],[-7,0],[-5,-1],[-3,-1],[-2,-1],[1,-1],[4,0],[5,-2],[0,-2],[-4,-1],[-6,-2],[-14,-1],[-3,-1],[1,0],[2,-1],[1,0],[-3,-1],[-1,-1],[0,-2],[-2,0],[-3,-1],[-6,-1],[7,-3],[2,-1],[-22,-4],[-2,-1],[-9,-6],[-1,-2],[4,-2],[1,0],[3,-2],[1,0],[-1,-1],[-1,0],[-1,-1],[0,-2],[-1,-1],[-1,0],[0,-1],[3,-1],[1,0],[-1,-1],[1,0],[1,0],[5,-1],[2,0],[1,-1],[-2,-1],[-10,-1],[-3,-1],[-1,-1],[-3,-1],[-7,-1],[-4,-1],[-3,-1],[-3,-1],[-6,-1],[-6,0],[-28,1],[-11,0],[-11,-1],[-43,-4],[-10,-2],[-3,-2],[-1,-1],[0,-4],[-1,0],[-2,-1],[3,-1],[-3,-1],[-3,-1],[-5,0],[-6,-1],[-15,-1],[-6,0],[-7,0],[-3,-2],[-3,-1],[-5,-1],[-6,0],[-4,0],[-7,3],[-18,3],[-21,2],[-43,2],[-35,1],[-34,3],[-5,1],[-8,1],[-47,3],[-18,0],[-15,-1],[-5,-3],[-7,-3],[-22,-2],[-38,-1],[-66,-5],[-5,1],[-18,3],[-7,1],[-12,1],[-39,-1],[-60,3],[-6,1],[-6,-1],[-27,-1],[-4,1],[-3,1],[-6,7],[-4,0],[-18,2],[-18,4],[-3,1],[-3,2],[-4,0],[-32,5],[-18,4]],[[8137,9288],[1,-1],[29,1],[-1,-1],[-4,-2],[0,-1],[5,0],[12,1],[6,0],[-1,-1],[4,0],[6,1],[4,0],[5,0],[11,1],[5,-1],[1,-2],[-10,-1],[-13,-1],[-10,-1],[3,0],[5,0],[4,-1],[5,0],[0,-1],[-6,-1],[-2,0],[6,0],[8,0],[8,0],[7,0],[5,1],[9,1],[5,0],[12,1],[5,0],[2,-1],[-2,-1],[-7,-1],[-15,-1],[-2,0],[-4,-1],[-4,0],[-24,0],[-5,0],[-6,-1],[-5,0],[-23,0],[-11,1],[-6,0],[-3,-2],[6,0],[3,0],[0,-1],[-20,1],[-16,-1],[-11,-1],[-5,1],[-3,0],[-7,2],[-8,1],[-9,0],[28,2],[6,1],[-17,0],[-4,1],[-4,0],[-30,-2],[-5,0],[-3,1],[0,1],[0,1],[13,1],[-8,1],[4,0],[5,1],[11,0],[4,0],[5,-1],[5,0],[4,0],[-1,1],[-2,0],[-2,0],[4,1],[4,0],[8,-1],[7,0],[1,0],[4,0],[4,-1],[10,1],[17,-2],[2,-1],[-1,2],[-3,1],[-4,1],[-30,3],[3,1],[9,-1],[5,1],[3,0],[3,1],[3,0],[3,-1]],[[4980,8834],[-3,0],[-2,1],[-7,-1],[-4,0],[-4,1],[-3,0],[-5,1],[-2,1],[-1,0]],[[4949,8837],[2,1],[1,-1],[1,0],[0,-1],[3,0],[3,0],[4,0],[2,1],[5,-1],[4,0],[3,-1],[3,-1]],[[4999,8844],[-8,-2],[6,0],[8,0],[6,-1],[-2,-1],[-7,-1],[-10,-1],[-17,-1],[-6,0],[-9,1],[-5,0],[-5,0],[-12,1],[-5,0],[4,0],[9,0],[4,0],[0,1],[-2,0],[1,1],[4,1],[9,0],[5,1],[-3,0],[-3,0],[-1,0],[-1,1],[1,0],[0,1],[1,1],[4,1],[6,1],[6,1],[6,0],[4,-1],[8,-2],[7,-1],[-3,-1]],[[4947,8849],[0,-1],[-3,0],[-5,0],[-1,0],[-3,1],[-4,0],[-1,0],[0,1],[4,1],[4,0],[5,0],[1,-1],[1,0],[1,0],[1,-1]],[[4978,8868],[-9,-3],[-3,-1],[-2,0],[0,-1],[1,0],[-1,-1],[-1,0],[-3,0],[-3,0],[-1,0],[1,1],[1,0],[1,0],[0,1],[-1,-1],[-1,0],[-7,-1],[-1,1],[-1,1],[1,0],[11,2],[2,-1],[9,2],[-2,0],[-2,0],[2,0],[1,1],[2,0],[1,0],[1,0],[1,0],[2,0],[1,0]],[[5031,8871],[11,-3],[1,-1],[0,-2],[1,-1],[2,0],[3,-1],[4,-1],[4,0],[-4,0],[-7,-1],[-4,-1],[-12,0],[-3,-1],[-3,-1],[-3,0],[-4,-1],[-23,0],[-6,0],[-2,0],[2,-2],[1,0],[5,0],[2,-1],[-3,-1],[-3,0],[-6,-1],[-3,-1],[-24,-2],[-6,0],[5,1],[5,2],[6,3],[-3,0],[-2,0],[-3,0],[-2,1],[4,1],[3,1],[3,1],[5,1],[3,0],[3,-1],[3,0],[1,0],[4,1],[2,1],[-7,0],[-1,0],[-1,1],[-2,0],[-1,0],[3,1],[9,1],[13,2],[14,2],[-1,0],[-1,1],[-1,0],[0,1],[-13,-2],[-7,0],[-7,0],[8,1],[-7,0],[6,2],[3,1],[1,1],[-2,0],[-2,0],[-1,1],[5,0],[3,1],[3,1],[6,-1],[4,-2],[2,-1],[3,0],[12,-1],[2,0]],[[4979,8881],[1,-1],[-1,-1],[-3,-1],[-2,-1],[-1,0],[-4,0],[-1,0],[0,1],[-1,0],[1,0],[0,1],[1,0],[3,0],[1,1],[1,0],[1,0],[-1,0],[3,1],[1,0],[1,0]],[[4928,8884],[2,0],[4,1],[4,0],[2,-1],[-2,-1],[-3,0],[-6,-1],[3,-1],[1,-1],[-1,0],[-3,-1],[-8,-2],[-2,0],[-2,0],[-1,0],[-1,0],[-2,1],[-3,0],[-2,-1],[-3,0],[-2,1],[5,0],[-5,0],[-16,0],[-5,1],[1,1],[5,2],[6,1],[3,1],[16,1],[8,0],[7,-1]],[[5043,8886],[-24,-5],[-4,0],[-4,0],[-1,1],[7,1],[1,1],[1,0],[1,0],[1,0],[1,0],[6,0],[3,1],[1,0],[2,1],[9,1],[0,-1],[1,0],[-1,0]],[[5041,8889],[-9,-1],[-1,0],[-3,0],[-1,0],[-1,0],[5,1],[1,0],[0,1],[1,0],[2,1],[14,1],[1,0],[2,0],[1,0],[1,0],[-1,0],[0,-1],[-1,-1],[-6,-1],[-5,0]],[[5024,8901],[-2,0],[-2,0],[-4,-1],[-2,0],[0,-1],[1,0],[-1,0],[-2,0],[-1,0],[-1,0],[-2,0],[-1,-1],[-1,0],[-5,-1],[-2,-1],[-1,0],[1,0],[-1,0],[-2,0],[-1,-1],[-2,0],[1,1],[0,1],[1,0],[2,0],[1,1],[1,0],[5,0],[10,3],[-2,-1],[-1,1],[-1,0],[2,1],[9,0],[3,0],[2,0],[0,-1],[-2,0]],[[4992,8908],[5,-1],[-2,0],[1,0],[0,-1],[-2,0],[-2,0],[-2,0],[-1,-1],[-2,0],[-1,1],[1,0],[1,0],[1,0],[0,1],[-2,0],[-1,0],[-1,0],[-1,0],[1,1],[2,0],[2,0],[3,0]],[[5110,8905],[-14,-2],[-12,0],[-30,-5],[-7,0],[-8,-1],[3,1],[4,0],[2,1],[2,0],[-25,0],[3,1],[11,2],[3,1],[4,2],[3,1],[4,0],[26,3],[6,0],[5,-1],[-7,-2],[-2,-1],[1,0],[5,0],[5,1],[5,0],[5,1],[10,1],[14,1],[13,0],[11,-1],[-3,-1],[-8,0],[-29,-2]],[[5016,8918],[-1,-1],[-2,0],[-1,0],[-2,-1],[-1,0],[-1,1],[-1,-1],[-2,0],[0,1],[1,0],[6,2],[4,1],[3,0],[2,-1],[-1,-1],[-4,0]],[[5080,8920],[1,-1],[-5,-1],[-10,-1],[18,0],[-4,-1],[-4,0],[0,-1],[9,0],[5,0],[2,0],[-2,-1],[-2,0],[-9,-1],[-3,0],[-3,0],[-10,-2],[-56,-3],[10,2],[3,0],[4,1],[3,0],[3,1],[7,1],[2,0],[-3,1],[-5,-1],[-8,0],[-5,0],[4,0],[7,1],[3,1],[13,0],[4,0],[1,1],[1,0],[1,1],[9,0],[12,2],[-8,1],[-9,0],[-9,0],[-8,-1],[0,1],[22,2],[2,0],[2,0],[2,1],[3,0],[4,0],[4,-1],[1,-1],[1,-1]],[[5211,8928],[-55,-4],[-2,0],[1,0],[5,1],[5,1],[4,1],[40,1],[3,0],[-1,0]],[[5127,8929],[1,0],[3,0],[1,0],[2,0],[1,0],[4,0],[2,-1],[1,0],[1,0],[2,-1],[1,-1],[-2,-1],[-3,0],[-2,-1],[-3,0],[-5,-1],[-3,0],[-6,0],[-6,0],[-2,1],[-2,1],[-5,0],[-4,0],[-1,0],[1,0],[2,1],[6,1],[4,0],[9,2],[0,1],[1,0],[2,-1]],[[5078,8933],[-2,0],[-2,0],[1,0],[1,0],[6,0],[1,0],[-15,-2],[-2,0],[0,1],[-2,0],[-4,-1],[-5,0],[-1,1],[2,0],[1,0],[4,1],[2,0],[1,0],[1,0],[1,0],[2,0],[2,0],[1,1],[4,0],[5,0],[1,0],[-1,0],[-2,-1]],[[5029,8935],[-1,-1],[-1,0],[-1,1],[-1,0],[0,-1],[1,0],[-1,0],[-1,0],[-1,0],[1,-1],[-1,0],[-2,0],[-2,0],[2,-1],[-1,0],[-3,0],[-3,1],[-2,0],[-2,0],[1,1],[7,1],[4,-1],[1,0],[0,1],[3,0],[-1,0],[1,0],[1,0],[1,0],[1,0]],[[5161,8939],[-1,-2],[-2,-1],[-2,0],[-3,0],[-2,0],[-2,1],[0,1],[-2,-1],[-1,0],[-2,-1],[1,-1],[3,-1],[1,-1],[-6,0],[-2,1],[-2,0],[-2,0],[-3,0],[-1,1],[-1,0],[-3,0],[-3,0],[2,1],[8,0],[1,1],[-3,1],[-2,1],[-2,0],[-1,1],[3,0],[14,1],[2,0],[1,-1],[1,0],[1,-1],[1,0],[1,0],[2,1],[1,0],[0,1],[2,0],[5,0],[1,-1],[-3,-1]],[[4952,8945],[1,-1],[-2,0],[-5,-1],[-3,0],[2,1],[-2,0],[-2,0],[2,0],[4,1],[1,0],[2,0],[2,0]],[[5144,8946],[-11,-1],[-5,0],[-2,1],[-2,0],[0,1],[1,0],[1,0],[5,0],[-4,1],[8,0],[4,1],[2,-1],[1,0],[-1,0],[-3,0],[1,-1],[5,0],[1,0],[0,-1],[-1,0]],[[5185,8950],[2,-1],[-4,-1],[-6,0],[-5,0],[-1,0],[-2,1],[1,-1],[2,1],[-1,0],[-1,0],[-2,0],[-1,0],[0,1],[2,0],[1,0],[2,0],[3,0],[-1,0],[1,0],[2,0],[3,0],[3,1],[1,-1],[1,0]],[[5090,8951],[2,0],[5,0],[1,-1],[0,-1],[-2,0],[-1,0],[-3,-1],[0,-1],[-2,0],[-6,1],[-2,0],[-1,0],[1,1],[4,0],[-2,0],[-1,0],[-1,0],[-1,1],[-4,0],[-1,0],[1,1],[3,0],[0,-1],[1,0],[1,1],[1,0],[1,0],[1,0],[1,0],[1,1],[3,0],[3,0],[2,-1],[-1,0],[-3,0],[-1,0]],[[5202,8952],[0,-1],[-1,-1],[-1,0],[-2,0],[-1,0],[-1,0],[-1,1],[-1,0],[1,0],[-1,1],[-1,0],[1,1],[3,0],[3,0],[1,0],[1,0],[0,-1]],[[5188,8955],[-3,0],[-2,0],[2,0],[-2,0],[0,1],[2,0],[-2,0],[-2,0],[0,1],[1,0],[2,1],[6,0],[3,0],[1,0],[1,-1],[-1,0],[-1,-1],[-1,0],[-1,0],[0,-1],[-2,0],[-1,0]],[[5259,8965],[21,-1],[2,0],[1,0],[-1,0],[-6,-1],[-24,-1],[-20,0],[-2,1],[4,0],[1,0],[-1,0],[21,2],[2,0],[2,0]],[[5227,8967],[-5,-1],[-2,0],[-2,0],[-2,0],[5,1],[4,0],[2,0]],[[5276,8976],[-1,0],[2,0],[3,0],[1,0],[0,-1],[2,0],[-1,0],[-2,-1],[-6,0],[-2,0],[2,1],[-1,0],[-3,0],[-3,0],[3,1],[4,0],[3,0],[-1,0]],[[5375,8985],[-26,-1],[-1,0],[0,1],[3,0],[1,0],[-3,1],[1,0],[15,1],[7,0],[2,-1],[1,0],[0,-1]],[[5390,8989],[-1,0],[-3,-1],[-3,0],[-2,0],[-4,0],[-1,0],[0,1],[1,0],[-2,0],[-1,0],[-2,0],[-1,0],[-2,0],[-1,0],[-2,0],[2,0],[-1,1],[4,0],[13,-1],[6,0]],[[5462,8989],[-5,-1],[-6,-1],[5,-3],[0,-1],[-4,0],[1,-1],[1,0],[-3,-1],[-4,0],[-4,0],[-2,1],[0,1],[-1,0],[-1,1],[-10,1],[-7,1],[-18,1],[5,1],[4,0],[8,2],[-2,1],[3,0],[15,-2],[5,0],[4,0],[5,1],[6,2],[7,2],[6,-1],[-3,-2],[-5,-2]],[[5412,9002],[0,-1],[-2,0],[-3,0],[-1,0],[-3,0],[-1,0],[-6,-1],[-1,0],[-1,0],[1,0],[-8,0],[2,1],[7,0],[1,0],[1,0],[-1,0],[-5,0],[-2,0],[1,0],[6,1],[1,0],[2,0],[12,0]],[[5402,9012],[1,0],[-7,-1],[2,1],[-2,0],[2,0],[-2,0],[-1,0],[2,0],[3,1],[3,0],[-1,0],[-1,-1],[-1,0],[1,0],[1,0]],[[5499,9012],[3,0],[2,0],[-1,-1],[-5,-1],[-6,0],[-19,-1],[-3,0],[-4,-1],[-4,1],[-3,0],[1,0],[4,1],[-1,0],[1,0],[3,0],[2,0],[2,1],[7,1],[15,1],[4,0],[3,0],[-1,-1]],[[4925,9015],[-3,-1],[-1,0],[1,0],[0,1],[3,0],[2,1],[1,-1],[-1,0],[-1,0],[-1,0]],[[4964,9020],[3,0],[3,0],[2,0],[1,0],[3,0],[1,0],[-2,0],[-1,0],[-1,-1],[-1,0],[0,1],[-1,0],[-1,-1],[-1,0],[-2,0],[-2,0],[-1,0],[-2,0],[-1,0],[-1,0],[-1,-1],[-1,0],[-2,0],[1,0],[-1,0],[1,0],[2,1],[-2,0],[1,0],[1,1],[1,0],[2,0],[2,0]],[[5656,9028],[-11,0],[-2,0],[1,1],[1,0],[1,0],[4,0],[-1,0],[16,1],[2,0],[0,-1],[-6,0],[-5,-1]],[[5106,9030],[1,0],[1,-1],[-1,0],[-3,1],[-1,0],[-1,0],[1,0],[1,-1],[-1,-1],[-1,0],[-1,0],[0,1],[-1,0],[-2,0],[0,1],[-1,0],[-3,0],[-5,-1],[-3,0],[-3,0],[-3,0],[-1,-1],[-2,-1],[-3,1],[-2,1],[10,1],[2,0],[6,1],[16,1],[2,0],[-1,0],[-2,-1],[-1,0],[2,-1]],[[5543,9034],[-1,0],[-1,0],[1,1],[1,0],[2,0],[2,0],[-2,0],[-1,-1],[-1,0]],[[5118,9036],[-3,-1],[-3,1],[1,0],[3,1],[3,0],[-1,-1]],[[5572,9041],[-1,0],[-1,0],[0,-1],[-2,0],[-1,0],[-1,1],[0,-1],[-2,0],[-1,0],[-3,0],[0,1],[2,0],[2,0],[1,0],[3,0],[3,0],[2,0],[-1,0]],[[5665,9053],[8,-1],[5,-1],[11,0],[4,0],[1,-1],[4,0],[2,0],[1,0],[4,0],[0,1],[4,0],[2,0],[0,-1],[-3,-1],[-9,0],[-1,0],[-1,0],[-19,-1],[-4,0],[-6,1],[-23,0],[-10,-1],[-2,1],[-2,1],[1,1],[3,1],[-2,1],[2,0],[9,0],[5,-1],[3,0],[2,1],[2,0],[6,1],[3,1],[1,0],[0,-1],[-1,-1]],[[5855,9056],[2,-1],[1,0],[-2,-1],[-9,0],[-10,0],[-13,0],[-14,2],[-5,0],[-6,-2],[-4,0],[-3,0],[-8,0],[-22,0],[-3,0],[-1,0],[-2,1],[-3,0],[3,0],[3,0],[3,1],[3,0],[9,1],[67,0],[7,-1],[7,0]],[[5703,9052],[-20,0],[-3,1],[-1,1],[-2,0],[1,1],[2,0],[1,1],[3,0],[5,1],[3,0],[0,1],[2,0],[2,-1],[4,-1],[4,-2],[3,-1],[-4,-1]],[[5949,9058],[-2,0],[-7,0],[-6,1],[-3,0],[-15,0],[0,1],[22,2],[3,0],[0,-1],[2,0],[8,-1],[-1,-2],[-1,0]],[[5195,9059],[9,0],[-4,-1],[-4,-1],[-5,1],[-4,-1],[-3,0],[0,-1],[2,0],[4,-1],[2,1],[4,1],[2,0],[2,-2],[2,-1],[1,-2],[0,-1],[-2,0],[-4,-1],[-12,0],[-3,0],[-11,2],[-4,1],[2,-2],[-4,0],[-2,0],[0,-1],[3,0],[4,0],[8,0],[4,-1],[1,0],[-1,-1],[-2,-1],[-4,0],[0,-1],[-1,0],[-5,-1],[-22,-1],[-3,-1],[-3,-1],[-7,-1],[-13,0],[2,1],[9,1],[3,1],[1,0],[-1,1],[-1,1],[2,1],[2,0],[5,2],[2,1],[1,1],[2,1],[1,0],[4,0],[1,0],[1,1],[0,1],[11,3],[3,1],[5,1],[8,1],[4,0],[3,1],[-2,0],[-2,1],[-1,0],[0,1],[6,-1],[18,-1],[-3,0],[-3,-1],[-2,-1],[-3,0],[-3,0]],[[5265,9059],[-4,0],[0,-1],[-2,-2],[-1,0],[-2,0],[-6,1],[-3,0],[-12,-2],[-7,-1],[-3,1],[0,1],[-1,1],[-1,1],[-5,-1],[-1,0],[0,-1],[-2,-1],[-2,0],[-2,1],[0,1],[0,1],[1,0],[2,1],[14,3],[5,0],[4,-1],[5,-1],[3,-1],[4,0],[2,2],[-4,1],[-6,2],[-3,0],[3,2],[9,0],[16,0],[2,-1],[4,-1],[3,0],[-6,-3],[-4,-2]],[[5833,9064],[-2,0],[-2,0],[-7,1],[-6,0],[1,1],[10,1],[7,0],[1,-1],[-2,0],[1,0],[-2,-1],[2,0],[1,0],[-2,0],[0,-1]],[[5567,9066],[-1,0],[-1,0],[-4,1],[3,0],[1,0],[3,0],[2,0],[-2,-1],[-1,0]],[[5599,9071],[0,-1],[-3,0],[-2,1],[-2,-1],[-2,0],[-4,-1],[-7,0],[-3,0],[-1,1],[1,0],[1,0],[2,1],[2,0],[15,0],[3,0]],[[5616,9073],[-6,-2],[-7,1],[-7,0],[-4,1],[5,2],[16,2],[13,0],[3,-2],[-13,-2]],[[5462,9078],[7,-2],[-6,-2],[-10,-1],[-9,1],[-4,1],[-2,1],[2,1],[-9,0],[-11,0],[-4,1],[9,0],[-3,1],[11,1],[7,0],[6,-1],[7,-1],[9,0]],[[5398,9075],[7,-1],[8,0],[13,2],[9,-1],[8,-1],[-11,-4],[-11,0],[-3,-1],[-2,-1],[-2,0],[-20,0],[-3,0],[-3,-1],[-3,0],[-2,1],[-3,0],[-3,0],[-1,0],[-2,-1],[-2,0],[-3,0],[-16,0],[3,-1],[9,-1],[4,0],[1,-1],[-2,-1],[-3,0],[-12,-1],[-3,1],[-1,0],[-2,1],[-1,0],[-5,0],[-2,-1],[-1,0],[-3,-1],[2,-1],[1,0],[2,0],[-4,-1],[-4,0],[-4,0],[-5,0],[1,1],[-1,0],[-3,0],[-2,0],[0,2],[-7,1],[-8,0],[-4,-2],[1,0],[1,-1],[2,0],[1,0],[-1,-1],[-2,0],[-1,0],[-2,-1],[-3,-1],[-3,0],[-13,2],[7,3],[24,4],[-6,0],[-13,-2],[-7,0],[3,0],[2,0],[2,1],[1,1],[-2,0],[-2,0],[-4,0],[12,1],[-3,0],[-9,1],[9,1],[13,1],[10,1],[-4,0],[-4,0],[-4,0],[-15,1],[32,4],[7,-1],[3,0],[2,0],[3,-1],[3,0],[5,0],[4,1],[4,-1],[5,0],[2,0],[2,0],[3,1],[2,0],[4,1],[7,2],[10,1],[15,0],[6,-3],[-10,-2]],[[5914,9080],[-19,-1],[-2,0],[-5,0],[-2,0],[-1,0],[-1,0],[1,1],[10,1],[17,0],[4,0],[1,-1],[-1,0],[-2,0]],[[5676,9087],[-28,-5],[-5,-1],[1,1],[0,1],[-1,0],[-2,0],[-1,-1],[-13,-1],[4,-1],[4,0],[-10,-1],[-40,-5],[-7,0],[-4,0],[1,1],[4,2],[8,1],[-4,0],[-2,1],[-2,0],[-1,1],[-4,0],[-2,-1],[-4,-1],[2,-1],[-2,-1],[-4,-1],[-6,0],[-2,0],[-3,0],[-1,-1],[1,0],[10,-1],[-3,0],[-10,-2],[-10,0],[-4,0],[-8,-1],[-5,-1],[-19,0],[-3,0],[-3,-1],[-2,0],[-4,0],[-7,1],[-4,0],[1,-1],[1,0],[-4,-1],[-8,0],[-7,0],[-8,-1],[-4,0],[3,1],[1,1],[1,0],[-1,0],[-2,1],[-1,0],[-1,1],[9,1],[19,1],[9,1],[-12,-1],[-7,0],[-5,1],[4,1],[5,0],[9,0],[-5,1],[-3,1],[2,2],[6,1],[7,-1],[8,-2],[7,0],[-2,1],[1,0],[3,0],[2,1],[1,0],[2,0],[5,-1],[5,0],[0,1],[-3,1],[-4,1],[-2,0],[-3,0],[-2,0],[1,1],[-10,1],[-3,0],[25,1],[6,0],[11,-1],[6,0],[-2,1],[-7,1],[-2,1],[26,1],[4,0],[0,-1],[2,-1],[4,-1],[3,0],[0,1],[-1,1],[2,1],[3,1],[4,0],[4,0],[8,-1],[5,0],[1,-1],[1,-1],[-1,0],[-16,-3],[7,0],[14,1],[7,1],[2,0],[1,3],[3,1],[8,0],[18,-1],[13,2],[9,0],[16,0],[-4,-1]],[[5969,9087],[2,-1],[-4,-1],[-39,0],[-12,-1],[-9,-1],[-4,0],[-2,0],[-5,1],[5,1],[13,1],[-3,0],[-3,0],[-7,1],[5,2],[7,3],[6,1],[7,1],[28,1],[4,-1],[7,0],[3,-1],[2,0],[1,0],[1,-1],[1,-1],[2,0],[5,-1],[3,-1],[-6,0],[-12,0],[-4,-1],[3,-1],[5,0]],[[5584,9091],[-10,0],[-3,2],[-11,1],[-7,1],[-6,1],[4,1],[12,1],[10,-1],[17,0],[19,0],[15,-1],[16,0],[0,-2],[-1,0],[-1,0],[-1,0],[-1,0],[-1,0],[-1,0],[-1,-1],[-1,0],[-1,0],[-1,0],[-1,0],[-1,0],[-1,0],[-1,0],[-1,-1],[-1,0],[-9,-1],[-31,0]],[[5484,8841],[-25,2],[-128,-2],[-8,0],[-21,0],[-54,0],[-39,1],[-3,0],[-3,0],[-2,-1],[-4,-1],[-3,-1],[-3,0],[-13,-2],[-8,-1],[-9,0],[-3,-1],[-2,-1],[1,0],[2,-1],[-1,0],[-1,-1],[-4,0],[-5,-1],[-22,0],[-3,-1],[-2,0],[-3,-1],[-2,0],[-12,0],[-20,0],[-7,1],[-4,1],[-4,0],[-32,1],[-17,0],[-9,-1],[-4,0],[-4,0],[-5,1],[-3,1],[-5,0],[-4,0]],[[4986,8833],[1,0],[1,1],[-2,0],[-2,1],[-2,1],[-1,0],[3,1],[20,0],[14,2],[7,1],[16,-1],[8,1],[3,1],[5,1],[23,0],[7,1],[-4,0],[-2,0],[-2,0],[4,1],[4,0],[5,0],[5,1],[9,2],[13,2],[4,0],[2,0],[1,1],[1,1],[3,0],[4,1],[22,4],[2,1],[-2,1],[-8,-2],[-9,-1],[-3,-1],[-5,-1],[-36,-6],[-24,-2],[-3,0],[-3,0],[-6,-1],[-3,0],[-17,-1],[-9,1],[-5,0],[3,2],[20,0],[7,2],[-3,0],[-6,0],[-2,0],[-3,1],[0,1],[-5,0],[-9,-1],[-6,0],[0,1],[9,1],[4,0],[5,0],[12,0],[6,0],[3,1],[37,-1],[8,1],[-7,0],[-22,0],[-17,1],[-3,0],[-7,-1],[-3,0],[1,1],[-7,0],[-21,0],[-6,-1],[-5,-1],[-5,-1],[-7,0],[2,1],[11,2],[2,0],[5,2],[2,0],[9,1],[9,0],[8,0],[6,2],[-4,0],[-12,-1],[2,1],[4,0],[13,2],[2,0],[2,0],[1,0],[1,-1],[20,0],[6,0],[3,-1],[4,-1],[4,0],[4,0],[-7,2],[-9,0],[-9,0],[-9,1],[-2,1],[-1,1],[-1,1],[-3,1],[-6,1],[-3,1],[12,0],[5,0],[4,-1],[1,0],[-1,0],[0,-1],[2,0],[2,0],[2,1],[2,0],[7,-1],[12,-3],[7,-1],[-17,4],[-2,1],[4,1],[31,1],[-9,1],[-31,-1],[0,1],[3,0],[5,0],[3,1],[-5,0],[-9,0],[-4,1],[-4,1],[2,0],[5,1],[5,0],[-5,0],[-3,2],[-2,1],[1,2],[-6,-2],[-3,-2],[-6,-2],[-11,1],[5,1],[5,1],[4,1],[2,1],[-5,-1],[-11,-2],[-6,-1],[-8,1],[-2,1],[2,1],[3,2],[-5,0],[-3,0],[-3,0],[-4,1],[1,0],[0,1],[0,1],[-2,0],[4,1],[7,2],[4,0],[4,2],[2,0],[2,1],[5,0],[2,1],[4,0],[7,0],[7,0],[5,-1],[1,0],[1,-1],[1,0],[0,-1],[1,0],[10,0],[-2,-1],[-3,0],[-1,-1],[0,-1],[1,0],[10,-1],[8,1],[5,0],[7,-1],[4,0],[4,0],[2,0],[-2,1],[-4,0],[-5,1],[-10,0],[-3,0],[-2,0],[-2,1],[-2,1],[0,1],[-2,0],[-6,1],[-9,1],[-2,0],[-4,2],[2,1],[11,1],[5,1],[2,1],[4,0],[3,0],[3,-1],[3,-1],[4,0],[-3,1],[2,2],[-4,1],[-7,0],[-9,-1],[-3,0],[-1,1],[1,1],[1,0],[3,1],[1,0],[1,0],[0,1],[1,1],[4,1],[5,1],[25,3],[7,1],[7,-1],[16,-1],[3,0],[5,-1],[3,-1],[5,0],[9,1],[4,-1],[2,0],[2,-1],[2,-1],[2,0],[4,0],[2,0],[1,0],[2,0],[1,0],[1,0],[0,-1],[8,-2],[4,0],[-2,1],[-3,2],[-1,1],[-4,1],[-1,1],[-1,1],[-2,0],[-15,0],[-17,1],[-8,1],[-4,1],[4,1],[5,1],[1,1],[-4,1],[4,1],[13,1],[4,1],[-9,0],[-18,-2],[-50,-1],[1,0],[0,1],[1,0],[1,0],[-3,0],[-3,1],[-7,0],[4,0],[15,3],[5,0],[8,0],[15,2],[41,1],[7,0],[3,0],[2,0],[1,1],[13,0],[4,1],[12,1],[19,2],[51,2],[9,-1],[3,-1],[-4,-1],[-8,-1],[-8,0],[21,0],[-2,-1],[-6,-2],[-3,-1],[-1,-1],[2,-1],[2,0],[4,0],[2,1],[7,2],[3,0],[6,1],[17,0],[8,0],[3,0],[3,0],[4,-1],[7,0],[2,0],[1,1],[-2,1],[-11,0],[-17,0],[-22,1],[7,2],[13,2],[14,0],[12,-1],[-2,-1],[-6,-1],[-3,0],[7,0],[11,1],[32,2],[3,0],[2,0],[2,1],[1,1],[6,0],[4,1],[8,1],[6,0],[6,1],[2,2],[-3,0],[-8,0],[-12,-2],[-19,-1],[-6,0],[-6,-2],[-2,0],[-24,0],[-5,1],[-4,1],[-3,0],[-3,-1],[0,-1],[-4,-1],[-5,0],[-19,-1],[-6,0],[-4,1],[11,1],[-2,1],[-3,0],[-3,0],[-3,0],[-3,0],[-14,-2],[-8,0],[-13,-1],[-20,0],[-10,0],[-19,-3],[-32,-2],[-6,0],[-2,2],[5,1],[8,0],[6,1],[5,1],[6,1],[37,3],[41,0],[9,1],[-7,0],[-23,0],[1,1],[3,0],[7,1],[-5,0],[-4,0],[-8,0],[-3,0],[-2,0],[-1,1],[-3,0],[-4,1],[-3,1],[-1,-1],[2,-1],[4,-1],[1,-1],[-1,0],[-4,0],[-21,-2],[-3,0],[-13,0],[-5,0],[3,1],[2,0],[1,1],[-3,0],[-4,0],[-8,-1],[-8,0],[-6,1],[-5,1],[-4,1],[33,2],[7,2],[-1,1],[-1,0],[-1,1],[-2,1],[-11,0],[3,1],[4,0],[8,0],[-4,1],[-7,0],[-4,0],[-2,1],[-1,0],[-2,1],[-3,0],[-6,0],[-6,0],[-5,1],[-5,1],[30,1],[3,0],[4,-1],[13,-1],[5,0],[2,-1],[1,-1],[2,-1],[-1,-1],[0,-1],[32,1],[8,0],[-25,0],[-5,0],[0,2],[4,1],[1,1],[-7,0],[0,1],[6,0],[10,1],[6,0],[20,0],[6,0],[6,1],[6,-1],[12,-1],[12,-1],[12,0],[-5,1],[-6,1],[-34,1],[-5,1],[12,1],[22,2],[29,0],[-9,0],[-43,0],[-7,-1],[-12,-2],[-6,-1],[-14,0],[-16,-1],[-7,0],[-8,1],[1,1],[2,1],[7,1],[-2,0],[-1,1],[4,0],[9,0],[10,1],[11,0],[6,0],[-7,1],[-29,0],[-19,1],[5,1],[5,0],[6,-1],[5,0],[6,1],[5,-1],[5,0],[5,0],[6,0],[12,1],[6,0],[16,-2],[6,0],[-6,2],[-10,1],[-49,2],[-10,1],[7,0],[56,0],[1,-1],[4,-1],[3,0],[38,0],[6,1],[-5,0],[0,1],[24,0],[12,0],[9,1],[-41,0],[-8,0],[-16,-1],[-8,0],[-7,0],[-1,2],[4,1],[7,0],[30,-1],[8,1],[-7,1],[-37,0],[-3,0],[-2,0],[-8,1],[8,1],[16,1],[18,0],[19,-1],[52,-1],[-10,1],[-34,1],[-4,0],[-6,1],[-5,1],[-8,-1],[-4,1],[-2,1],[1,0],[2,0],[1,0],[-3,1],[-6,0],[-3,0],[-2,1],[0,1],[-1,0],[-6,1],[-14,-1],[-6,1],[5,1],[5,1],[6,0],[36,0],[9,1],[-2,0],[-1,1],[-2,0],[18,0],[6,0],[1,1],[4,1],[1,0],[3,0],[3,0],[6,0],[8,0],[-4,-1],[-5,-1],[-5,0],[-6,-1],[7,-1],[4,-1],[5,0],[-1,1],[-5,0],[11,1],[1,1],[1,0],[1,0],[7,0],[2,0],[3,1],[0,1],[-3,2],[-4,1],[2,0],[3,1],[1,1],[5,0],[3,0],[2,-1],[1,0],[0,-1],[3,-2],[3,-1],[9,-1],[4,0],[2,0],[4,0],[2,0],[2,0],[3,0],[1,1],[1,0],[5,1],[4,2],[0,1],[-5,1],[6,0],[34,1],[4,-1],[9,-1],[4,0],[9,0],[3,0],[3,-1],[-1,-1],[4,0],[5,1],[1,1],[-3,1],[-7,1],[-13,0],[-28,1],[-20,-1],[-5,1],[4,0],[4,1],[4,1],[4,1],[-4,1],[2,1],[4,0],[4,1],[21,0],[-3,0],[-3,-1],[-3,-2],[-1,0],[3,-1],[4,0],[4,1],[4,1],[-2,0],[0,1],[-1,0],[-1,0],[51,1],[8,-1],[6,-2],[2,0],[2,0],[0,1],[-1,1],[-3,0],[-3,1],[-17,1],[-32,0],[6,1],[7,1],[8,0],[6,-1],[5,0],[7,0],[6,0],[9,1],[6,1],[3,0],[24,-1],[22,1],[0,-1],[-10,0],[-3,0],[2,-2],[-3,0],[-4,-1],[-3,-1],[2,-1],[10,-1],[8,-1],[4,-1],[4,0],[-1,1],[-4,1],[-9,1],[-4,1],[3,1],[14,2],[3,1],[13,1],[5,0],[8,-2],[5,0],[16,0],[5,0],[10,-1],[4,-1],[13,0],[7,-1],[2,-1],[0,-1],[-4,-2],[6,-1],[8,-1],[8,0],[7,0],[-2,1],[-9,1],[-3,0],[0,1],[0,1],[7,1],[2,1],[-1,0],[-5,2],[-12,1],[-6,1],[8,1],[10,0],[61,-3],[6,0],[-2,1],[-3,0],[-3,0],[-3,1],[3,1],[-23,-1],[-13,1],[-34,1],[-5,0],[-7,0],[-10,-2],[-6,0],[-6,1],[5,0],[6,0],[5,1],[3,1],[-14,0],[-3,0],[-3,0],[-4,-1],[-6,0],[-35,1],[3,1],[5,0],[5,0],[4,1],[2,0],[5,3],[-7,0],[-19,-1],[-7,0],[-3,-1],[-1,0],[-1,-1],[-1,0],[-3,0],[-2,0],[-16,0],[-32,0],[4,-1],[7,0],[3,0],[-5,-1],[-32,-2],[-14,0],[13,1],[5,1],[0,2],[2,0],[-4,0],[-5,0],[-9,-1],[-11,-1],[-39,0],[-5,0],[-4,-1],[-5,0],[-5,1],[15,1],[4,1],[-1,0],[3,1],[8,1],[9,2],[26,4],[2,1],[-1,0],[-7,0],[2,0],[3,0],[4,1],[2,1],[7,0],[21,0],[7,0],[6,0],[5,-1],[-2,0],[-1,-1],[-3,-1],[7,0],[7,1],[7,1],[6,0],[8,1],[9,0],[15,2],[-25,-1],[-28,1],[2,0],[3,1],[-5,0],[-9,0],[-3,0],[3,1],[-3,0],[-3,1],[-4,0],[-3,0],[3,1],[6,1],[7,1],[46,3],[16,1],[5,-1],[8,0],[7,-1],[3,-2],[-3,0],[-3,0],[-6,0],[-2,0],[-4,1],[-7,0],[-5,1],[-5,1],[-5,-2],[4,0],[7,-2],[5,0],[-11,-2],[-29,0],[-13,-1],[6,0],[31,-1],[7,1],[5,0],[4,1],[5,1],[6,0],[5,0],[4,0],[4,1],[4,0],[4,0],[-1,-1],[1,0],[2,0],[3,-1],[-4,0],[-3,-1],[-8,0],[2,0],[3,-1],[-2,-1],[-2,0],[-3,-1],[-1,-1],[4,0],[8,2],[5,0],[2,0],[1,1],[1,0],[0,1],[1,0],[2,0],[31,1],[13,0],[11,-2],[1,-1],[3,-1],[12,-4],[0,-1],[0,-1],[1,0],[1,0],[6,-2],[7,-1],[9,-1],[-10,-1],[5,-1],[8,0],[10,2],[-2,1],[-13,1],[-4,1],[-1,1],[-4,2],[-1,0],[-2,1],[-6,1],[-11,1],[4,1],[8,1],[4,1],[-6,0],[-4,0],[-2,0],[7,2],[9,2],[44,3],[26,0],[-7,1],[-47,-1],[-26,-3],[-13,0],[-55,1],[-6,0],[-3,1],[0,1],[1,1],[7,1],[-1,0],[-4,0],[8,1],[8,0],[16,-1],[8,0],[3,0],[3,-2],[2,0],[3,1],[2,1],[-11,2],[1,0],[4,0],[-4,1],[-4,1],[-4,0],[-4,-1],[2,-1],[1,0],[-6,0],[-7,0],[-7,1],[-6,0],[-12,-1],[-7,0],[-3,1],[4,2],[33,3],[-8,0],[-3,0],[-4,0],[4,2],[2,0],[4,0],[3,0],[9,-1],[10,-1],[31,-1],[-5,1],[-2,0],[34,-1],[-17,2],[-9,0],[-14,0],[-7,0],[-12,2],[0,1],[45,0],[14,-1],[33,-4],[5,0],[4,1],[-4,0],[-3,0],[-3,1],[-3,0],[1,1],[0,1],[-28,2],[-9,0],[3,1],[4,1],[4,0],[4,1],[-4,0],[-4,0],[-11,-2],[-4,0],[-43,2],[2,1],[6,1],[0,1],[-3,1],[-3,0],[-2,-1],[-1,-1],[-5,2],[-4,1],[-3,-1],[1,-1],[5,-2],[1,-1],[-18,-2],[-11,-2],[-9,0],[-7,-2],[-3,0],[-4,0],[-29,-3],[-20,-1],[-4,-1],[-4,0],[-19,-1],[-7,1],[-13,0],[-6,1],[35,3],[-22,1],[2,1],[5,0],[6,-1],[4,0],[5,1],[56,1],[-7,0],[-8,0],[-9,0],[-5,2],[5,0],[5,1],[-37,-1],[-11,-1],[2,0],[1,1],[-1,0],[-2,0],[0,1],[-2,1],[-4,0],[-4,-1],[-2,0],[-2,0],[-2,1],[-2,0],[5,1],[4,1],[4,0],[15,0],[20,1],[25,0],[9,1],[-6,1],[-53,-2],[0,1],[2,0],[2,0],[4,0],[3,1],[11,1],[13,1],[8,0],[12,-1],[25,0],[9,-1],[-4,0],[-3,-1],[-2,0],[1,-2],[25,5],[8,0],[5,0],[29,2],[12,0],[2,0],[-6,-2],[-2,-1],[-1,0],[1,-1],[1,-1],[2,0],[2,0],[3,0],[-4,1],[0,1],[2,1],[3,0],[4,1],[4,0],[4,1],[1,1],[35,1],[8,0],[8,-1],[3,-1],[1,-1],[1,-1],[2,0],[2,0],[1,1],[2,1],[3,1],[11,2],[3,0],[2,1],[3,1],[-3,0],[3,1],[8,1],[15,-1],[0,1],[-38,1],[-12,1],[9,1],[2,1],[-5,0],[-3,0],[-9,-1],[-2,-1],[-7,-1],[-43,1],[-2,0],[-2,1],[-2,0],[-4,1],[-4,0],[-2,0],[-3,-1],[-32,-3],[2,0],[3,0],[4,0],[4,-1],[-10,-1],[-10,0],[-9,2],[-8,2],[3,0],[3,1],[4,0],[4,0],[3,2],[11,2],[14,1],[11,1],[-2,-1],[1,-1],[2,-1],[4,0],[1,0],[0,1],[1,0],[10,0],[3,0],[8,2],[2,0],[0,2],[1,0],[6,0],[-1,0],[-1,-1],[4,0],[9,0],[5,-1],[-4,0],[-4,-1],[3,0],[3,-1],[2,-1],[-6,-1],[-15,1],[-7,0],[3,-1],[0,-1],[-1,0],[-2,-1],[3,0],[3,0],[3,-1],[3,1],[-2,1],[2,0],[16,0],[6,1],[1,0],[3,1],[11,0],[4,0],[5,1],[6,1],[4,1],[4,0],[-8,1],[-4,1],[0,2],[4,0],[6,0],[6,0],[3,1],[-1,1],[-1,0],[0,1],[1,0],[3,1],[4,0],[8,0],[6,0],[1,-1],[1,-2],[4,0],[-2,-1],[-2,0],[-2,-1],[-3,0],[4,-1],[4,0],[5,1],[3,0],[2,-1],[-1,-2],[-2,-1],[-5,-1],[1,-1],[4,-2],[-2,-1],[-3,-1],[-4,0],[-2,-1],[27,-2],[8,-2],[4,-1],[1,-2],[0,-2],[1,-1],[4,-1],[11,0],[4,-1],[2,0],[30,-4],[11,-1],[7,0],[-6,1],[-7,0],[-4,1],[3,2],[-33,1],[-10,2],[-4,0],[1,1],[2,1],[2,0],[0,1],[-1,2],[1,1],[-3,1],[-4,0],[-9,1],[9,0],[7,0],[6,-1],[25,-5],[1,-1],[10,-1],[3,0],[-1,1],[-1,0],[-3,1],[1,1],[3,0],[1,0],[-4,1],[-10,0],[-3,1],[-5,1],[-9,1],[0,1],[5,0],[6,0],[4,0],[6,-2],[6,-1],[7,0],[8,0],[7,0],[-5,0],[-10,1],[-4,0],[0,1],[3,1],[6,1],[-32,1],[2,1],[4,1],[4,1],[4,0],[4,0],[2,1],[3,1],[6,0],[14,-2],[27,-1],[5,0],[-1,0],[-4,0],[3,1],[3,0],[-26,1],[-5,1],[-8,1],[-5,1],[-13,-1],[-23,-2],[-14,1],[1,0],[3,1],[-8,0],[-4,1],[-3,1],[12,-1],[7,0],[9,1],[10,0],[2,1],[-1,0],[-2,0],[4,1],[4,-1],[5,0],[4,0],[-2,1],[-3,1],[-9,0],[0,1],[31,-2],[11,0],[-4,1],[-10,0],[-13,2],[-2,0],[-2,0],[0,1],[-1,1],[-3,-1],[-6,-1],[-2,0],[-55,0],[-2,0],[5,1],[7,1],[31,0],[2,0],[-2,1],[-2,0],[-35,1],[-16,1],[-4,1],[4,0],[7,2],[5,0],[5,0],[8,-1],[5,0],[3,0],[2,0],[3,1],[3,-1],[2,0],[1,-1],[2,0],[5,-1],[12,1],[2,-1],[26,-1],[12,-2],[0,-3],[42,-4],[7,0],[8,0],[-13,1],[-2,1],[-2,1],[-21,2],[-7,1],[-5,2],[3,1],[-9,1],[-10,1],[-26,1],[-13,1],[-4,1],[-5,0],[-12,0],[-6,0],[10,1],[-4,0],[-7,0],[-4,1],[10,1],[22,0],[16,2],[63,1],[7,-1],[19,-1],[10,0],[5,-1],[2,-1],[-1,0],[-9,-2],[-3,0],[6,0],[34,1],[9,1],[4,1],[18,0],[5,0],[7,-2],[1,0],[3,-2],[1,-1],[6,-1],[25,-2],[-4,-2],[-1,0],[1,-1],[1,0],[2,0],[1,-1],[-1,-1],[-2,-1],[0,-1],[4,0],[5,1],[2,0],[0,1],[-3,1],[0,1],[5,1],[11,0],[-7,3],[-9,1],[-20,2],[-4,0],[-3,1],[-3,1],[-2,1],[-2,1],[2,1],[5,0],[4,1],[-1,1],[18,0],[40,-3],[19,-1],[-8,2],[-42,2],[7,1],[34,0],[40,-1],[25,-2],[12,1],[-13,0],[-47,4],[-34,0],[18,5],[0,1],[-5,0],[-10,-1],[-10,-1],[-17,0],[-9,-1],[-16,-3],[-49,-1],[-11,1],[5,0],[14,1],[3,0],[-1,1],[-5,1],[-5,0],[-5,0],[-2,1],[-5,0],[-2,0],[-3,0],[-18,-2],[-2,-1],[-10,-1],[-25,0],[-17,-1],[-31,0],[-6,0],[-2,1],[0,1],[-1,1],[-2,1],[-3,1],[-2,0],[-1,1],[2,0],[3,1],[14,1],[9,-1]],[[6010,9094],[-1,0],[1,0],[1,-1],[4,0],[15,-1],[17,1],[34,4],[113,0],[46,3],[60,0],[50,1],[34,-6],[2,0]],[[6386,9095],[-4,-1],[-3,0],[-1,-1],[-5,-7],[0,-2],[13,-15],[-6,-2],[-43,-11],[-7,-2],[-7,-1],[-6,0],[-67,5],[-67,5],[-5,-1],[-19,-4],[-96,-10],[-6,-1],[-5,-1],[-36,-17],[-5,-2],[-24,-5],[-13,-2],[-14,-1],[-40,-1],[-4,0],[-13,-6],[73,-16],[2,-2],[-7,-9],[-4,-1],[-7,-1],[-14,-1],[-43,-6],[-20,-3],[-87,-22],[-56,-8],[0,-2],[11,-8],[2,-1],[1,-2],[1,-2],[-2,-1],[-101,-9],[-60,-1],[-60,-1],[25,-21],[1,-3],[-3,-1],[-16,-5],[-2,-1],[-12,-18],[1,-3],[1,-4],[-1,-4],[-7,-2],[-19,-2],[-5,-1],[-3,-2],[-7,-7],[-1,-1]],[[5630,9120],[-13,-1],[-2,0],[-8,1],[-4,0],[0,1],[3,1],[-1,1],[2,0],[3,0],[6,1],[14,-1],[6,0],[3,-2],[-2,-1],[-7,0]],[[5852,9126],[-4,-1],[-2,0],[-2,-1],[0,-1],[3,-1],[0,-1],[0,-1],[-1,0],[-8,-3],[-13,-4],[-14,-2],[-2,-1],[-1,0],[1,-1],[4,-1],[4,0],[4,-1],[2,0],[0,-1],[-2,-1],[-6,-2],[-3,0],[-5,-1],[-8,-2],[-9,-5],[0,-1],[1,0],[3,-1],[4,-1],[0,-1],[-1,0],[-2,0],[-5,-1],[-1,-1],[1,0],[3,0],[5,0],[46,6],[6,2],[4,1],[2,0],[2,1],[7,0],[16,0],[50,2],[59,-3]],[[5990,9098],[1,-1],[1,0],[-2,-1],[-4,-1],[-5,0],[-9,1],[-17,0],[-29,-1],[-16,-1],[-3,-1],[-3,1],[-3,0],[-2,1],[-3,-1],[-3,-1],[-3,-2],[-4,-2],[-9,-1],[-4,-1],[-7,-3],[-6,-1],[-9,-1],[-6,0],[0,1],[-1,1],[0,1],[2,1],[1,2],[-1,1],[-1,0],[-1,1],[0,1],[-3,0],[0,-1],[1,-1],[0,-1],[-2,-1],[-1,0],[-7,-1],[-2,0],[-4,1],[-3,0],[-2,0],[1,-1],[7,-1],[2,-1],[-6,0],[-2,1],[-2,0],[-3,1],[-3,0],[-2,-1],[-2,-1],[-3,0],[1,0],[0,-1],[1,-1],[-8,0],[-4,0],[-4,0],[2,0],[3,-1],[3,0],[3,0],[-3,-1],[-12,-2],[-1,-1],[-3,0],[-6,0],[-4,0],[2,1],[1,0],[-5,0],[-7,1],[-4,1],[-35,-1],[-9,0],[-4,2],[5,0],[4,0],[7,2],[4,1],[16,1],[8,1],[14,3],[10,1],[-7,1],[-1,0],[-1,1],[-2,0],[-3,1],[-2,-1],[2,-1],[0,-1],[-2,-1],[-24,-3],[-7,-1],[-1,0],[-5,1],[-2,0],[-1,-1],[-2,0],[-11,-1],[-9,-2],[-16,0],[-6,-1],[7,0],[3,0],[1,-1],[-3,0],[-17,-2],[-3,0],[-4,-2],[-7,-1],[-11,-1],[-9,0],[-3,1],[1,0],[1,0],[2,0],[1,1],[-3,1],[3,1],[6,1],[5,0],[3,1],[8,3],[5,1],[16,3],[7,1],[7,1],[4,0],[20,0],[-6,0],[-16,0],[-5,1],[2,1],[7,0],[14,0],[-13,0],[-2,1],[0,1],[-1,0],[-21,0],[4,2],[5,1],[5,1],[7,0],[10,-1],[3,0],[-4,2],[20,0],[3,0],[6,-2],[5,0],[-3,1],[-12,3],[4,0],[7,-1],[4,0],[-2,1],[-1,0],[0,1],[25,0],[2,0],[3,-1],[1,0],[4,0],[3,0],[3,0],[3,0],[-3,0],[-3,1],[-2,0],[-3,1],[-4,0],[-12,0],[-4,0],[-4,1],[-5,1],[-4,1],[0,2],[1,1],[1,1],[28,0],[3,0],[3,0],[2,0],[3,0],[6,-1],[5,0],[12,-1],[-7,0],[-1,1],[-1,0],[-2,1],[-7,1],[-32,0],[-6,0],[-4,1],[-1,1],[1,2],[-1,1],[2,0],[6,-1],[2,0],[3,0],[1,1],[1,0],[3,1],[6,0],[13,-1],[6,1],[-4,0],[-7,0],[-6,1],[-4,1],[1,1],[6,1],[11,0],[-1,1],[-1,0],[-2,1],[-3,0],[3,1],[5,2],[4,0],[7,1],[24,-1],[18,2],[7,-1],[5,0]],[[5685,9124],[0,-1],[3,0],[3,0],[5,-1],[-7,0],[-3,-1],[-3,-1],[7,0],[13,3],[6,-1],[-3,-3],[-2,-1],[-8,-2],[15,1],[4,1],[1,0],[2,0],[1,0],[1,0],[1,-1],[9,1],[-3,-1],[-2,-2],[-3,-1],[-5,0],[-7,0],[-4,0],[-2,0],[1,-1],[6,-1],[-5,-1],[-2,0],[9,-1],[11,0],[8,-1],[1,-3],[-5,-2],[-9,-1],[-64,-5],[-45,0],[-7,1],[2,0],[2,0],[1,1],[-13,0],[0,1],[2,1],[4,0],[10,1],[17,1],[6,0],[14,0],[2,0],[2,1],[1,0],[2,1],[6,0],[12,0],[6,1],[-3,1],[-2,0],[0,1],[1,2],[-29,1],[-8,-1],[5,0],[13,-1],[-4,-1],[-8,-2],[-7,0],[-7,0],[1,1],[-1,1],[-2,-1],[-6,-2],[-5,-1],[-5,0],[-4,1],[-8,-1],[-5,0],[3,1],[0,1],[-1,1],[-3,-1],[-2,0],[-2,-2],[-3,0],[-5,-1],[-7,1],[-6,1],[-4,1],[-1,-1],[-3,-1],[-7,-2],[-2,0],[0,-2],[-2,0],[-13,0],[-4,0],[-5,-1],[-7,0],[-13,0],[-4,1],[-1,1],[1,1],[3,1],[-3,1],[-1,-1],[-2,0],[-2,0],[-2,0],[-2,0],[-2,2],[2,0],[3,1],[7,0],[1,1],[9,0],[18,1],[0,1],[-6,0],[-18,1],[4,1],[7,2],[9,0],[5,0],[1,0],[1,-2],[1,-1],[3,-1],[3,-1],[5,0],[4,0],[-2,1],[-2,0],[-2,0],[-2,0],[2,2],[2,0],[4,1],[5,0],[-7,1],[-2,0],[2,2],[3,0],[5,0],[5,0],[3,0],[-1,-1],[3,0],[-3,-3],[2,-1],[7,0],[19,2],[10,1],[10,-1],[-3,0],[0,-1],[2,-1],[3,0],[3,0],[5,1],[4,1],[-1,0],[0,1],[1,1],[2,0],[-11,2],[8,1],[3,1],[5,-2],[4,0],[0,-1],[0,-1],[2,-1],[1,-1],[3,1],[2,1],[-1,1],[7,2],[8,-1],[9,-1],[8,-1],[-3,2],[-6,1],[-7,1],[-5,1],[2,1],[-3,1],[-9,2],[-2,1],[-2,1],[0,1],[18,3],[4,0],[5,0],[3,0],[4,-1],[3,-1],[1,-1],[-5,-1],[10,-2],[3,0],[-2,0],[-1,0]],[[5831,9130],[-13,-1],[-30,-1],[-9,0],[-7,2],[-4,0],[-4,-1],[4,0],[3,-1],[2,-1],[0,-1],[-1,-1],[-8,-3],[-7,-1],[-9,-1],[-7,0],[-3,2],[2,1],[0,1],[0,1],[-1,1],[2,1],[5,2],[1,1],[14,3],[6,2],[6,2],[10,1],[11,1],[23,1],[8,1],[12,4],[7,1],[-1,0],[-1,1],[4,1],[8,0],[4,0],[10,2],[30,2],[7,0],[4,-2],[-1,-1],[-3,-2],[-5,-1],[-3,-2],[-2,-3],[-3,-1],[-4,-1],[-11,0],[-10,-2],[-3,0],[-3,-1],[-3,0],[-4,-2],[-1,0],[-4,0],[-4,-1],[-1,0],[0,-1],[-3,-1],[-3,0],[-7,-1]],[[270,9290],[6,-2],[0,-1],[-5,-2],[-7,0],[-5,-1],[2,-1],[3,-2],[1,-1],[-5,-1],[-93,-5],[-5,0],[-11,1],[-6,0],[-29,-1],[-9,-1],[-9,-1],[-38,-6],[-4,0],[-8,0],[-4,-1],[-2,0],[-4,-1],[-2,-1],[-5,0],[-8,-1],[-8,0],[-6,1],[1,0],[1,1],[1,0],[-10,2],[-2,1],[7,1],[7,0],[3,0],[3,0],[8,2],[8,0],[2,0],[2,1],[2,0],[5,1],[20,0],[9,1],[11,1],[2,0],[1,1],[9,1],[28,0],[2,1],[1,0],[1,0],[2,0],[5,0],[2,1],[3,0],[7,2],[2,1],[4,1],[2,0],[10,3],[6,1],[11,2],[32,0],[3,0],[5,1],[2,1],[6,0],[18,0],[9,0],[5,0],[5,0]],[[6132,9111],[-62,-3],[-5,1],[1,1],[2,0],[1,1],[1,0],[1,1],[8,1],[8,1],[15,3],[6,1],[3,0],[2,0],[1,-1],[6,-2],[5,0],[13,-2],[4,-1],[-10,-1]],[[6160,9118],[7,0],[7,0],[-4,1],[-11,1],[-3,1],[0,1],[4,1],[22,0],[11,-1],[9,-1],[9,-2],[-22,-2],[-11,-3],[-9,-1],[-9,0],[-7,1],[-4,1],[-1,2],[-3,2],[-12,1],[-5,1],[-1,1],[5,1],[6,-1],[10,-2],[6,-1],[6,-1]],[[5852,9126],[1,-1],[-2,-1],[-1,-1],[1,-1],[3,-1],[2,-1],[-2,-1],[-9,-4],[-1,-1],[0,-1],[-2,0],[-4,-1],[-2,-1],[-3,0],[-15,-2],[10,0],[12,1],[10,1],[9,2],[4,0],[5,0],[3,-2],[-1,-1],[-3,-1],[-4,-2],[-3,-1],[-2,-1],[-2,0],[-2,0],[-2,0],[-3,-1],[-4,-1],[-1,0],[-6,0],[-13,-1],[-4,0],[-2,-2],[1,-1],[2,0],[1,-1],[-1,-2],[-3,0],[-3,-1],[-3,-1],[10,1],[5,1],[3,1],[0,1],[0,1],[0,1],[5,1],[5,1],[17,1],[11,1],[6,1],[5,0],[4,-3],[4,-1],[5,1],[2,1],[-2,2],[-6,1],[-1,0],[-3,1],[-1,0],[2,1],[6,1],[2,0],[7,1],[25,-1],[-3,2],[-5,1],[-13,1],[-4,0],[-3,1],[-1,1],[1,1],[3,1],[20,1],[3,0],[4,0],[7,-1],[3,0],[4,0],[3,0],[0,1],[-8,1],[-3,1],[-1,1],[2,1],[14,-3],[18,-1],[9,0],[2,0],[1,-1],[0,-1],[3,-1],[18,1],[6,0],[-4,-1],[-8,-1],[-3,-1],[4,0],[5,0],[4,0],[2,-1],[-7,-1],[0,-1],[2,0],[-2,-2],[12,-1],[-3,-1],[-7,-1],[6,-1],[-1,-1],[-3,-1],[-5,-1],[-2,-1],[-3,0],[-2,0],[-1,-1],[1,-1],[1,0]],[[6042,9127],[7,-1],[4,0],[1,0],[-1,0],[-21,-2],[-1,0],[-1,0],[-3,1],[1,1],[6,0],[1,0],[2,1],[3,0],[2,0]],[[5971,9127],[12,-1],[12,0],[11,0],[4,0],[4,-1],[1,-1],[-5,-1],[1,-2],[-5,-1],[-21,0],[-10,1],[-9,0],[-12,3],[-14,1],[-5,1],[10,2],[13,0],[13,-1]],[[6201,9128],[-5,0],[-6,0],[-2,1],[1,0],[1,1],[-1,1],[1,0],[3,1],[5,1],[8,2],[7,0],[23,1],[2,0],[3,-1],[-1,0],[-3,0],[-2,-1],[1,0],[-1,-1],[-1,0],[-4,-1],[-5,0],[-6,-1],[-4,0],[-4,-1],[-5,-2],[-5,0]],[[6280,9170],[4,-1],[4,0],[7,2],[4,1],[4,1],[6,-1],[3,-1],[4,-3],[-2,0],[-5,-1],[-2,-1],[-2,0],[-1,-1],[0,-1],[-4,-1],[2,-1],[3,0],[3,0],[4,2],[2,1],[2,1],[6,0],[4,1],[2,0],[7,0],[18,-2],[-2,0],[-5,-1],[-9,0],[3,-1],[-2,-1],[-10,-2],[9,-1],[5,0],[3,1],[-1,1],[3,0],[6,0],[5,0],[2,-1],[0,-3],[2,0],[3,0],[-1,-1],[-1,-1],[-2,0],[-3,0],[-13,0],[-14,-1],[-8,-1],[-4,-1],[4,0],[0,-1],[0,-1],[1,0],[2,-1],[6,0],[2,-1],[-4,-1],[-6,0],[-11,0],[8,-1],[5,0],[2,-1],[2,-1],[4,0],[5,0],[5,0],[-5,-1],[-7,-1],[-32,-1],[-27,1],[-22,-2],[-22,0],[-7,0],[1,1],[2,1],[7,2],[-8,0],[-6,0],[-6,-1],[-6,-1],[-10,-2],[-34,-3],[-10,-2],[-7,-3],[3,0],[6,0],[4,0],[-7,-1],[-13,-1],[-13,-1],[-8,1],[1,1],[3,1],[5,0],[4,0],[-2,0],[-1,0],[2,1],[3,1],[4,0],[4,0],[-7,1],[-67,-2],[-3,1],[-7,0],[-1,1],[3,2],[7,1],[13,-2],[5,0],[-1,2],[23,1],[10,-1],[6,1],[3,1],[-1,0],[-1,0],[-1,0],[0,1],[20,1],[7,2],[-21,-2],[-8,0],[-17,1],[-18,0],[0,1],[2,0],[1,0],[1,0],[1,1],[-5,0],[-2,0],[-3,0],[16,1],[33,0],[14,2],[-5,-1],[-2,0],[-2,0],[0,1],[1,0],[-1,1],[-2,1],[-3,0],[-1,-1],[-3,0],[-7,0],[-14,0],[0,1],[2,0],[2,0],[2,1],[-19,-1],[-4,1],[-2,1],[4,0],[50,0],[-1,0],[-5,1],[3,0],[-9,0],[-5,0],[-4,1],[4,1],[4,0],[9,0],[-7,0],[-6,1],[-20,-1],[-22,0],[0,1],[4,0],[3,0],[6,1],[-1,0],[-1,1],[3,0],[3,0],[7,0],[3,-1],[1,0],[2,0],[2,1],[2,0],[4,0],[5,0],[4,-1],[4,0],[7,1],[4,0],[31,0],[22,-2],[7,0],[-2,1],[-5,0],[-9,1],[-8,1],[-3,0],[38,0],[12,1],[-40,1],[-20,1],[-13,4],[9,0],[5,-1],[4,-1],[4,-1],[5,0],[4,0],[-2,1],[-1,0],[16,0],[4,0],[-5,1],[-10,2],[-5,0],[3,1],[6,0],[7,0],[7,-1],[4,0],[7,0],[3,0],[3,-1],[3,-1],[5,0],[5,0],[12,-2],[4,0],[11,0],[-7,1],[-3,0],[-3,1],[-2,0],[-3,2],[-1,0],[-17,2],[-4,1],[-2,0],[-2,1],[2,1],[1,0],[0,1],[-1,0],[11,0],[9,-2],[15,-4],[3,0],[6,-1],[6,0],[3,1],[-1,1],[-5,0],[-1,1],[-1,2],[-1,1],[-1,0],[0,1],[2,0],[3,0],[3,0],[3,0],[2,-1],[7,-2]],[[6370,9179],[2,0],[4,0],[4,-1],[1,0],[-1,-1],[-9,-1],[-3,0],[-9,0],[-1,1],[1,0],[3,0],[1,0],[-2,0],[9,1],[-1,0],[-10,0],[1,1],[5,0],[5,0]],[[6398,9182],[-3,0],[-3,0],[-9,1],[-2,0],[-2,1],[1,0],[13,1],[2,-1],[2,0],[3,-1],[-2,-1]],[[6453,9189],[-7,0],[-2,1],[1,1],[4,0],[8,1],[1,0],[2,0],[17,0],[2,-1],[-1,0],[0,-1],[-2,0],[-23,-1]],[[6538,9194],[4,-1],[-2,-1],[-1,0],[-2,-1],[5,0],[10,0],[20,-1],[3,0],[5,-1],[6,-1],[4,-1],[-1,-2],[-6,-1],[-15,-1],[-13,-3],[-8,0],[-9,0],[-9,-1],[-2,0],[-2,-1],[-3,-1],[-1,0],[2,-1],[4,-1],[4,0],[4,0],[2,-2],[-3,-1],[-13,-1],[-8,0],[-25,0],[-3,0],[-8,-1],[-4,0],[-18,0],[-52,-2],[-16,0],[-6,1],[-10,2],[-5,0],[-13,0],[-7,0],[-6,2],[3,0],[5,1],[2,1],[-2,1],[3,-1],[2,0],[5,0],[2,0],[3,0],[5,1],[5,0],[24,-1],[6,0],[1,-1],[4,0],[-1,-1],[-1,0],[3,0],[2,0],[4,1],[2,0],[5,0],[2,1],[3,0],[5,1],[3,0],[-18,0],[-4,0],[-3,0],[-25,5],[7,1],[24,-1],[-2,0],[10,0],[29,0],[31,-1],[5,1],[-9,0],[-48,1],[-8,1],[-2,1],[-4,1],[2,1],[5,1],[6,1],[3,0],[2,-1],[4,-1],[4,0],[7,0],[3,0],[1,0],[-1,-1],[0,-1],[5,0],[3,0],[1,1],[3,1],[6,2],[6,0],[16,0],[-3,-3],[6,-4],[10,-1],[13,0],[-5,0],[-1,1],[1,1],[3,2],[8,3],[-3,1],[-20,3],[-4,0],[-2,1],[3,2],[9,0],[11,-1],[8,0],[-3,1],[4,0],[5,0],[4,0]],[[6964,9188],[-13,-1],[-12,1],[-5,1],[-2,0],[-1,2],[2,1],[5,1],[1,1],[1,1],[1,0],[3,0],[5,1],[27,0],[2,0],[0,-1],[-1,0],[-1,0],[-2,-1],[-2,0],[2,-2],[4,-1],[-4,-2],[-10,-1]],[[7209,9198],[-3,-1],[-3,1],[-1,0],[-2,0],[-1,1],[4,0],[4,0],[4,0],[4,0],[-1,-1],[-3,0],[-2,0]],[[6734,9192],[-46,-1],[-11,0],[2,1],[16,3],[5,2],[3,0],[11,1],[23,2],[8,1],[6,1],[5,1],[6,0],[4,0],[4,-1],[6,-1],[-5,-2],[-10,-2],[-8,-2],[-9,-2],[-10,-1]],[[6808,9204],[-11,-1],[-7,1],[-2,0],[-2,0],[4,0],[7,1],[7,-1],[4,0]],[[7028,9203],[5,0],[33,0],[-27,-2],[-2,-1],[-8,-1],[-11,-1],[-12,0],[-9,1],[-6,2],[-4,1],[0,1],[5,1],[5,1],[5,1],[8,0],[6,-1],[12,-2]],[[7212,9204],[1,0],[0,-1],[-4,0],[-1,0],[1,0],[-2,-1],[-3,0],[-24,2],[-9,0],[-1,0],[4,0],[1,0],[-1,1],[-1,0],[1,0],[10,1],[13,-1],[5,0],[10,-1]],[[6472,9205],[-5,0],[-2,0],[-1,0],[-1,0],[-1,0],[1,0],[4,1],[3,1],[4,-1],[1,0],[1,0],[-1,-1],[-3,0]],[[7048,9205],[-15,-1],[2,1],[6,1],[7,1],[5,0],[1,-1],[-6,-1]],[[6628,9208],[2,-1],[5,1],[5,0],[5,1],[6,-1],[-4,0],[-3,-2],[0,-1],[11,-1],[12,-2],[7,0],[-1,2],[5,1],[7,1],[16,1],[5,0],[4,-1],[2,-1],[-1,-1],[-2,0],[0,-1],[2,-1],[3,1],[3,0],[3,1],[4,0],[4,0],[4,0],[3,-1],[0,-1],[-8,-2],[-25,-1],[-2,0],[-2,-1],[-1,0],[0,-1],[-1,-1],[-2,0],[-4,-1],[-1,0],[-3,-1],[-9,-1],[-3,-1],[-1,0],[-1,-1],[-2,0],[-7,-1],[-10,-1],[-49,-2],[-8,1],[-8,2],[-2,1],[-47,5],[-19,0],[-7,2],[-1,1],[9,0],[23,-1],[4,1],[7,1],[5,0],[-14,1],[-7,0],[-3,2],[3,1],[7,0],[14,1],[12,-1],[3,1],[4,0],[3,0],[3,0],[2,0],[1,-1],[1,0],[4,0],[10,1],[-4,1],[-4,0],[-4,1],[-1,1],[5,0],[4,0],[4,0],[21,2],[4,0],[0,-1],[0,-1]],[[6528,9208],[2,-1],[3,0],[2,1],[15,3],[4,-1],[3,0],[11,-1],[2,-1],[-4,-1],[-5,0],[-7,-1],[-17,0],[-17,-2],[-8,-1],[-2,-1],[-2,0],[-1,0],[-1,0],[-4,0],[-4,1],[0,1],[4,0],[1,1],[-6,0],[-1,0],[-1,1],[4,1],[7,1],[2,1],[-1,0],[1,1],[-2,0],[0,1],[4,0],[8,0],[6,-1],[4,-1],[0,-1]],[[7126,9210],[-4,0],[-5,0],[-5,0],[-2,1],[1,0],[2,1],[7,0],[1,0],[7,-1],[-2,-1]],[[6539,9210],[-3,-1],[-3,0],[-2,1],[-1,1],[-1,0],[0,1],[4,1],[7,-1],[0,-1],[1,-1],[-2,0]],[[7018,9209],[-7,-1],[-9,0],[-4,1],[-2,1],[-1,1],[3,2],[6,1],[6,-1],[13,-2],[0,-1],[-5,-1]],[[6704,9210],[-3,0],[-11,0],[-17,0],[-14,1],[-3,0],[-2,1],[1,1],[6,1],[10,1],[9,-1],[24,-2],[5,-1],[-1,-1],[-4,0]],[[6820,9214],[-2,-1],[-22,2],[1,0],[4,1],[5,0],[14,-1],[2,0],[1,-1],[1,0],[-4,0]],[[6547,9217],[4,0],[0,-1],[-1,-1],[-1,0],[1,-1],[-3,-1],[-19,0],[-3,1],[-1,0],[2,1],[4,0],[3,1],[4,1],[6,0],[3,0],[1,0]],[[7264,9134],[-66,14],[-6,1],[-76,1],[-50,-4],[-4,0],[-4,-1],[-7,-3],[29,-7],[-14,-3],[-6,-1],[-9,1],[-68,4],[-6,0],[-22,-5],[-61,0],[-61,-1],[56,-8],[2,-1],[2,-7],[-1,-1],[-4,-2],[-23,-7],[-20,-4],[-45,-5],[67,-5],[-55,-8],[-10,-1],[-9,0],[-105,5],[-104,6],[-79,-1],[-13,1],[-38,4],[-11,1],[-57,-2]],[[6010,9094],[5,0],[4,0],[3,1],[-1,1],[-3,0],[-5,0],[-3,0],[-2,1],[-2,1],[-1,1],[2,1],[6,1],[8,1],[16,1],[26,2],[27,1],[8,1],[8,0],[6,-1],[6,-1],[9,-1],[0,-1],[2,-1],[9,0],[4,0],[5,0],[4,0],[-1,1],[-3,0],[-5,0],[-3,0],[-4,1],[-2,0],[-2,0],[-1,1],[1,1],[2,0],[2,0],[21,1],[10,1],[5,0],[9,-1],[5,0],[5,0],[4,0],[8,-2],[4,0],[5,-1],[4,0],[7,0],[20,1],[19,-2],[5,1],[-13,1],[-30,1],[-11,2],[-4,1],[-6,1],[-7,0],[-6,-1],[-6,0],[-7,0],[-14,2],[7,1],[17,1],[14,1],[8,1],[7,0],[25,-2],[36,-1],[15,-2],[0,2],[-11,1],[-21,1],[-42,2],[18,1],[15,2],[5,1],[8,0],[7,1],[3,0],[3,0],[5,-1],[6,-1],[7,0],[6,0],[7,0],[-6,2],[-28,1],[1,1],[2,1],[-46,-1],[-15,-2],[-8,0],[3,1],[10,3],[3,0],[7,0],[2,1],[1,1],[-1,1],[-3,0],[-7,0],[16,3],[11,2],[12,2],[5,1],[-2,0],[-6,0],[-3,1],[7,0],[49,1],[21,2],[15,0],[30,0],[-17,1],[-2,1],[1,1],[1,1],[3,1],[3,1],[-6,0],[-15,0],[-6,0],[3,1],[0,3],[3,1],[7,1],[16,1],[6,2],[-2,1],[3,1],[5,1],[4,1],[-2,0],[-1,1],[-1,0],[1,1],[-1,0],[-2,0],[-1,1],[1,1],[1,0],[1,0],[7,0],[11,1],[2,0],[1,1],[2,0],[3,0],[6,0],[5,-1],[4,-1],[10,-2],[1,-1],[-1,-1],[-2,0],[-1,-1],[-1,0],[1,0],[18,0],[5,0],[4,-1],[4,-1],[2,-1],[-1,-1],[-2,-3],[-1,-1],[4,0],[1,-1],[-1,-1],[-2,0],[-1,-1],[1,-1],[5,2],[2,1],[1,1],[0,3],[0,1],[2,1],[5,1],[3,-1],[2,-2],[1,-1],[2,-1],[6,-1],[6,0],[4,-1],[2,0],[3,-1],[3,0],[1,1],[-1,1],[-3,0],[-2,1],[-2,0],[4,1],[10,1],[21,0],[9,-1],[16,-1],[18,-1],[1,0],[1,0],[-1,1],[-1,0],[-2,0],[-2,0],[-8,2],[-5,0],[-63,3],[-8,1],[-4,0],[-2,1],[-1,0],[-1,1],[-1,1],[-3,1],[-4,0],[-8,0],[-9,0],[-5,1],[-3,0],[0,1],[2,1],[3,0],[3,0],[-5,2],[1,1],[6,0],[16,1],[15,1],[52,1],[2,-1],[1,-1],[0,-1],[-1,0],[-2,-1],[-2,0],[4,0],[4,0],[3,0],[3,-1],[2,-1],[0,-1],[1,0],[4,-1],[18,-2],[-2,-1],[3,-1],[10,-1],[15,-2],[5,0],[48,-1],[7,-1],[-2,-2],[-5,-1],[-15,-1],[-13,1],[-3,0],[-6,-1],[-6,-1],[1,0],[2,-1],[2,0],[2,0],[7,1],[2,0],[4,1],[4,-1],[1,-1],[-5,0],[3,-1],[9,-1],[4,0],[4,0],[7,1],[3,1],[8,-1],[15,-1],[7,1],[-5,1],[-5,0],[-4,1],[-2,2],[1,0],[1,1],[2,0],[0,1],[-2,1],[-4,1],[-19,3],[-6,0],[-6,0],[-33,0],[-9,0],[-2,1],[-6,1],[0,1],[-1,1],[-2,0],[-6,0],[-6,1],[-4,1],[-2,1],[3,2],[6,1],[8,1],[26,1],[4,0],[6,-1],[3,0],[4,0],[3,-1],[-2,1],[-3,1],[-2,1],[-1,1],[-19,0],[-11,-1],[-11,0],[-5,-1],[-4,-1],[-5,1],[-5,0],[-3,1],[-4,4],[33,6],[3,3],[5,1],[5,0],[10,0],[4,0],[8,2],[4,0],[10,1],[35,-1],[9,1],[18,1],[42,1],[11,-1],[-2,-1],[-2,0],[-9,-2],[1,-1],[1,-1],[-2,-1],[-5,-1],[-4,-1],[-4,-1],[4,-1],[6,-1],[2,-1],[-2,-2],[-4,-1],[-13,-4],[-2,-1],[-1,-1],[-1,-1],[0,-1],[1,0],[3,-1],[1,-1],[-1,-1],[-7,0],[-8,-1],[-7,-1],[-5,-2],[37,4],[3,1],[4,2],[2,2],[-4,1],[11,5],[-1,0],[-1,0],[0,1],[-1,0],[5,0],[9,0],[29,-1],[16,-1],[15,0],[12,0],[-8,0],[-10,0],[-10,1],[-8,1],[-7,0],[-9,0],[-7,1],[-3,2],[-1,1],[-3,1],[-1,0],[0,1],[0,1],[3,1],[5,1],[5,1],[-2,1],[4,1],[9,1],[4,0],[8,3],[3,1],[4,0],[0,-1],[-1,-1],[-5,-1],[-3,-3],[9,1],[6,1],[11,4],[8,3],[7,3],[2,1],[3,0],[1,0],[0,-1],[-1,0],[1,-2],[0,-1],[2,-1],[3,0],[3,-1],[1,0],[0,2],[-2,3],[2,1],[6,1],[8,1],[6,1],[5,-1],[24,-5],[2,-1],[-2,-1],[-2,-1],[-2,-1],[-1,-1],[0,-1],[-1,-1],[-2,0],[-2,-1],[-3,-1],[-1,-1],[-1,0],[-1,-1],[-2,-1],[-1,-1],[-4,-3],[1,-1],[1,0],[11,-2],[2,0],[0,-1],[0,-1],[0,-1],[-2,-1],[-2,0],[-9,0],[-9,-1],[-4,-1],[7,-1],[-3,0],[-3,-1],[-2,-1],[-1,-1],[3,-1],[-2,-2],[-6,0],[-6,0],[-2,-2],[-4,-2],[-5,-1],[-13,-1],[-13,-2],[-14,-1],[-4,0],[1,0],[3,-1],[1,0],[-15,-3],[-5,-1],[7,-1],[6,1],[6,1],[7,1],[4,2],[6,1],[36,3],[10,0],[2,1],[18,5],[4,1],[12,2],[4,1],[2,2],[1,1],[2,1],[3,0],[2,0],[3,0],[4,0],[3,-1],[11,-1],[17,-2],[34,-1],[4,0],[4,-1],[3,0],[4,0],[-10,1],[-22,2],[-8,1],[-6,2],[-2,1],[-5,1],[-20,1],[-12,1],[-2,1],[1,1],[9,2],[4,2],[-2,2],[-5,1],[-7,1],[7,1],[31,0],[33,2],[4,1],[4,1],[1,1],[-2,1],[-4,1],[-2,1],[9,0],[52,5],[10,0],[0,-1],[-26,-2],[-15,-3],[-6,-1],[5,-1],[5,1],[5,-1],[3,-1],[-3,0],[-1,0],[-2,0],[-1,-1],[13,-2],[6,0],[7,1],[-4,0],[-7,1],[-2,1],[5,0],[7,0],[5,1],[-2,1],[6,1],[20,0],[4,0],[-2,-1],[-9,-2],[-3,-1],[5,0],[7,0],[6,1],[4,1],[0,1],[-3,4],[27,0],[-5,1],[-8,0],[-7,1],[-7,0],[4,3],[6,2],[9,1],[10,1],[14,0],[39,-3],[-1,-1],[3,-1],[9,-1],[-7,-2],[7,-1],[9,-1],[9,0],[17,-1],[35,-4],[6,-1],[2,-2],[4,-1],[22,-2],[-4,0],[-5,0],[-8,0],[5,-1],[7,0],[7,0],[6,0],[3,1],[-2,1],[-7,1],[-1,1],[-11,2],[-22,2],[5,0],[15,-1],[4,1],[-1,1],[-6,1],[-10,0],[-3,1],[-1,1],[0,1],[-1,1],[-2,1],[0,1],[3,1],[-1,1],[-1,0],[2,0],[3,1],[10,-1],[6,1],[4,0],[2,-1],[-2,-2],[6,-1],[2,1],[0,3],[-2,2],[4,0],[7,0],[3,0],[0,1],[-38,-1],[-19,0],[-16,1],[9,2],[34,0],[5,0],[4,1],[7,1],[7,1],[3,0],[1,2],[-18,-2],[-3,0],[-5,-1],[-7,0],[-28,1],[-2,-1],[-3,-1],[-3,0],[-20,-1],[-7,0],[-13,3],[-5,0],[-23,-1],[-7,1],[-3,1],[-7,2],[-1,1],[4,0],[6,1],[4,1],[-32,-1],[-11,0],[-4,0],[-3,1],[-2,0],[-3,1],[-3,0],[-8,1],[-1,0],[6,1]],[[6989,9211],[1,0],[4,-1],[1,-2],[-2,-1],[-4,0],[-5,0],[-5,0],[-5,1],[-4,0],[-3,0],[-3,-1],[-3,-1],[-3,0],[-5,0],[-3,0],[-3,0],[1,1],[1,0],[1,2],[0,1],[-2,1],[-4,0],[-3,-1],[-1,0],[1,-2],[-11,0],[1,-1],[-3,0],[-9,0],[-4,0],[-5,1],[-4,0],[-3,1],[-2,1],[-1,0],[1,1],[0,1],[2,2],[3,1],[6,1],[5,1],[15,1],[5,0],[0,1],[1,1],[2,0],[7,0],[34,0],[10,0],[7,-1],[4,-1],[0,-1],[-4,-2],[-4,-1],[-2,-1],[-1,-1],[-1,0],[-1,-1]],[[6623,9221],[2,0],[4,-1],[0,-1],[0,-1],[3,0],[1,-1],[1,-1],[-5,-2],[-1,0],[0,-1],[1,0],[-1,0],[-12,-2],[-8,0],[-9,0],[-16,2],[-5,0],[-4,1],[2,0],[10,1],[4,0],[3,0],[3,-1],[2,0],[0,2],[4,1],[5,0],[1,1],[-5,0],[-1,1],[-1,0],[-3,1],[-2,0],[1,0],[3,1],[7,-1],[2,0],[2,0],[1,0],[0,1],[1,0],[2,1],[2,0],[2,-1],[1,0],[1,1],[2,-1]],[[6739,9221],[4,-1],[4,0],[4,-1],[4,0],[5,-1],[3,-1],[3,-2],[7,1],[2,0],[3,2],[1,1],[5,-1],[11,-1],[-2,-1],[2,-1],[4,-1],[6,0],[30,-2],[10,0],[0,-1],[-23,-1],[-7,0],[3,-1],[-2,-1],[-3,0],[-9,-1],[-37,0],[-10,1],[-6,1],[-1,1],[1,2],[-1,1],[-1,0],[-2,0],[-2,1],[-6,2],[-2,1],[-4,0],[-2,1],[-8,1],[-17,1],[-5,1],[3,1],[3,0],[7,-1],[0,1],[-1,1],[6,0],[15,1],[3,0],[1,-1],[0,-1],[1,-1]],[[6861,9219],[-2,0],[-1,0],[-2,0],[-1,1],[0,2],[-1,0],[-1,1],[-5,1],[0,1],[2,0],[3,1],[3,-1],[11,-2],[9,-1],[1,0],[-2,-1],[-11,-2],[-3,0]],[[6613,9537],[21,-2],[8,-1],[3,0],[-1,-1],[-3,0],[-1,-1],[2,0],[0,-1],[-2,0],[-3,0],[-6,-2],[-1,0],[0,-1],[-11,-2],[2,0],[-6,-1],[-22,-1],[-7,0],[-3,2],[-1,0],[-3,0],[-3,0],[-9,1],[-3,0],[-5,1],[-15,2],[-12,3],[-6,1],[7,2],[13,1],[25,0],[11,-1],[20,1],[11,0]],[[7979,9679],[-5,0],[-6,0],[-3,0],[1,1],[5,2],[6,1],[9,1],[15,3],[60,6],[16,4],[-1,0],[3,1],[7,1],[4,0],[6,0],[18,0],[0,-1],[-4,0],[-40,-6],[-24,-2],[-11,-1],[-6,-1],[1,0],[1,-1],[-10,-1],[-32,-3],[-6,-2],[1,-1],[2,0],[0,-1],[-3,0],[-4,0]],[[7587,9809],[22,-2],[12,-1],[0,-1],[-18,-1],[-5,0],[0,-1],[-5,-1],[-49,-1],[-9,0],[-8,-2],[-3,-2],[4,-2],[11,-2],[58,-2],[6,-1],[18,-2],[22,-1],[11,-2],[4,0],[73,-2],[13,1],[9,1],[9,1],[38,1],[5,0],[6,0],[5,1],[4,-1],[3,-1],[3,-1],[8,0],[6,-1],[4,-3],[-21,-2],[-21,-3],[-4,-3],[-18,-2],[-13,-3],[-4,0],[-4,-1],[-4,-1],[-4,0],[-8,-1],[-2,-1],[-5,-2],[-11,-3],[-5,-1],[-37,-4],[-46,-2],[-35,-4],[-8,0],[-20,-4],[4,-2],[-12,-2],[-73,-1],[-52,-1],[-21,1],[-32,1],[-6,0],[-5,0],[-2,0],[-1,1],[-3,0],[-3,2],[9,1],[18,1],[-3,2],[0,1],[-2,0],[-8,1],[-6,2],[-2,0],[-1,0],[3,1],[3,1],[30,2],[9,1],[17,1],[13,2],[7,1],[4,1],[-26,0],[-14,-1],[-7,-2],[-6,1],[2,0],[5,1],[6,1],[-10,1],[-13,1],[-15,0],[-36,-2],[-2,0],[-9,-2],[-12,-1],[-97,-2],[-96,-1],[-12,-1],[-52,-1],[-13,0],[-27,0],[-7,0],[-6,1],[-1,1],[4,1],[12,1],[-3,1],[-7,0],[-7,1],[5,1],[-2,0],[-3,0],[-6,0],[3,1],[3,0],[7,0],[-2,1],[-2,0],[74,3],[7,0],[4,1],[0,1],[-1,1],[0,1],[1,0],[3,1],[1,0],[-1,1],[-1,0],[0,1],[1,1],[2,1],[1,0],[16,2],[8,2],[12,0],[5,1],[0,2],[10,1],[19,2],[1,1],[-2,0],[-3,1],[-1,1],[4,0],[25,1],[-3,1],[-3,1],[-3,0],[-4,0],[-6,0],[-50,2],[-12,1],[-17,1],[-85,7],[-1,0],[6,1],[21,2],[83,3],[82,3],[82,-1],[82,0],[22,1],[10,1],[101,2],[22,-1],[17,-1],[45,-2]],[[7154,9838],[6,-2],[12,1],[22,1],[7,1],[28,-1],[2,0],[2,0],[1,-1],[2,0],[5,0],[4,0],[3,0],[9,-1],[6,0],[10,0],[14,2],[5,0],[5,0],[1,0],[1,-1],[1,-1],[8,-3],[5,-1],[12,0],[4,-1],[3,-1],[0,-1],[-1,0],[-6,-2],[-2,0],[2,-1],[2,-1],[3,0],[1,-1],[-1,-2],[1,0],[3,-1],[-1,-1],[-2,-1],[-1,-2],[4,-1],[-2,-1],[8,-1],[-94,-2],[-94,-1],[-95,-2],[-11,0],[1,1],[2,0],[-53,1],[-7,0],[-7,-1],[-2,0],[-1,-1],[-1,0],[-5,-1],[-6,0],[-6,1],[-5,0],[11,1],[3,0],[-5,0],[0,1],[12,0],[-1,2],[5,0],[8,1],[5,0],[-2,1],[-4,1],[-4,0],[-5,1],[-60,1],[3,0],[6,1],[6,0],[6,1],[21,-1],[6,1],[2,1],[0,1],[-3,1],[-2,0],[-6,1],[-12,0],[-30,3],[-71,2],[2,1],[2,0],[3,1],[80,2],[81,2],[19,0],[16,-1],[15,1],[10,2],[-1,0],[-3,1],[-1,0],[17,2],[29,1],[28,-1],[12,-2]],[[8387,9841],[-2,0],[-5,0],[-6,1],[1,0],[1,1],[-3,1],[-12,0],[-40,3],[-1,1],[-5,2],[-10,2],[11,2],[13,0],[27,0],[5,-1],[3,-1],[23,-3],[6,-1],[14,-1],[44,-1],[-12,-1],[-5,-1],[1,-1],[-10,-1],[-32,0],[-6,-1]],[[4772,9835],[-7,-2],[23,2],[21,0],[4,-1],[2,0],[2,-2],[2,0],[4,-1],[8,0],[6,-1],[45,-3],[26,0],[7,-1],[-5,-1],[-1,0],[1,-1],[2,-1],[38,-6],[12,-1],[-1,-2],[4,0],[4,-1],[3,-1],[1,-1],[2,-1],[1,0],[-1,-1],[-4,0],[-5,0],[-4,0],[-11,2],[-30,0],[-8,0],[-6,1],[-12,2],[8,2],[2,0],[-2,1],[-4,0],[-7,1],[-42,3],[-5,1],[-3,1],[-3,0],[-28,2],[-11,1],[-15,1],[-9,1],[-33,-2],[-10,1],[-9,1],[-10,2],[-9,3],[-1,2],[-7,0],[-4,1],[-3,2],[-5,1],[-7,2],[-8,1],[-15,1],[3,2],[1,0],[-6,0],[-30,3],[-4,1],[-13,1],[-7,1],[-5,1],[4,2],[5,0],[2,1],[-2,2],[-3,1],[-5,1],[-11,1],[7,1],[11,0],[66,-2],[36,-3],[1,-1],[-2,-2],[9,-1],[16,0],[3,0],[5,-1],[11,-3],[-28,-3],[14,-1],[7,-1],[2,-1],[1,-1],[19,-1],[6,-1],[-3,0],[-1,-1],[3,-1],[5,-1],[2,0],[-2,-1]],[[8922,9862],[7,-1],[87,0],[34,1],[19,0],[10,-1],[-88,-3],[1,-1],[-23,0],[-72,3],[-9,1],[-5,1],[-58,-2],[-59,-1],[-62,-4],[-4,0],[-57,2],[4,0],[40,2],[9,1],[9,0],[7,2],[3,0],[50,0],[9,1],[6,1],[-2,2],[86,-1],[48,-2],[10,-1]],[[9199,9866],[-8,0],[-11,0],[-11,1],[-5,2],[56,0],[2,0],[1,-1],[4,0],[-6,-1],[-9,0],[-16,0],[3,-1]],[[6858,9877],[-3,0],[64,0],[6,0],[5,0],[13,-1],[45,-2],[10,0],[6,-2],[-31,-2],[-47,-1],[-22,-1],[-11,0],[-11,0],[-10,1],[-6,1],[-28,0],[-13,1],[-5,0],[13,1],[8,1],[-1,1],[-5,1],[1,0],[4,1],[2,1],[-2,0],[-3,0],[-2,0],[-3,0],[21,1],[7,-1],[-2,0]],[[6845,9895],[6,-1],[-1,-1],[-7,0],[-8,0],[-5,0],[-6,1],[-7,0],[-78,-1],[-6,0],[-3,1],[0,1],[5,1],[-10,1],[-3,0],[9,1],[11,0],[21,0],[15,-1],[45,-1],[22,-1]],[[4708,9919],[-2,0],[9,0],[5,-1],[2,-1],[-17,1],[-4,0],[-5,-1],[-4,0],[-5,-1],[-24,0],[-10,1],[-6,1],[-4,1],[26,0],[-8,1],[-17,0],[-7,1],[38,1],[28,-2],[9,0],[-2,-1],[-2,0]],[[4707,9923],[-6,-1],[-63,1],[-7,0],[-7,1],[-2,0],[7,1],[8,1],[37,0],[33,-3]],[[6066,9933],[7,-1],[8,1],[6,1],[-2,0],[-7,2],[-2,0],[1,1],[4,1],[18,1],[72,-1],[30,-2],[38,-1],[7,-2],[10,-1],[13,0],[49,-5],[10,-2],[12,0],[9,-1],[15,-2],[-7,-3],[-12,-1],[-24,-1],[-10,0],[-4,-1],[-9,-2],[-15,-1],[4,-1],[-7,-2],[-11,0],[-12,0],[-11,-1],[19,-1],[14,1],[4,0],[4,-1],[1,-2],[3,-1],[-5,-2],[-1,0],[-1,-1],[1,-1],[2,0],[2,-1],[-5,-2],[-29,-1],[5,-2],[10,1],[17,1],[18,0],[9,1],[13,2],[8,1],[7,1],[3,2],[1,1],[2,1],[4,1],[4,2],[4,1],[6,2],[8,1],[9,1],[15,1],[25,0],[12,-2],[12,-1],[25,0],[40,-4],[6,-1],[2,-1],[2,-2],[1,-1],[5,0],[9,-1],[5,0],[6,-1],[-1,0],[-4,-1],[-2,-1],[1,-1],[4,0],[5,0],[4,-1],[-5,0],[-5,-1],[-5,0],[-3,-1],[1,-2],[2,0],[7,-2],[-22,-2],[-37,-1],[-8,-1],[14,0],[45,0],[20,-2],[4,-1],[-1,-1],[-7,-1],[1,-1],[6,-1],[27,0],[8,-1],[25,0],[6,1],[5,0],[4,1],[6,1],[8,0],[20,0],[3,0],[44,-3],[13,0],[28,1],[12,-1],[-2,0],[-2,0],[-1,-1],[-3,0],[-2,0],[1,-1],[2,0],[1,0],[2,-1],[2,-1],[3,0],[19,-2],[3,-1],[-1,0],[-4,-2],[-2,-1],[19,0],[6,1],[4,0],[11,-1],[29,-1],[58,-4],[110,-3],[110,-3],[12,-1],[6,0],[13,0],[5,0],[1,-1],[-3,-1],[-3,0],[-3,-1],[0,-1],[2,-1],[4,0],[4,0],[-5,-2],[-5,-1],[-6,0],[-11,-1],[-7,0],[-7,-1],[-4,-1],[2,0],[5,-2],[1,0],[-2,-1],[-5,0],[-6,0],[-16,1],[-33,-1],[-1,-1],[-6,-1],[-14,1],[-12,1],[-11,0],[-2,0],[-3,0],[-3,1],[-4,1],[-2,0],[-2,0],[-3,-1],[-39,1],[-12,-1],[-3,-1],[-2,-1],[-3,-1],[-7,0],[-17,0],[-10,1],[-4,0],[-52,0],[-3,-1],[-7,0],[-12,0],[-7,0],[-11,0],[-4,-1],[-1,-1],[-62,1],[-21,-1],[-21,-2],[-1,0],[1,-1],[4,-1],[13,-2],[6,-1],[-81,-2],[-80,-1],[-8,-1],[11,-2],[6,-1],[8,-3],[-1,-1],[-3,-1],[-4,-1],[-9,-1],[-3,0],[3,0],[-2,-1],[-4,0],[-3,-1],[0,-1],[2,-1],[15,-1],[8,0],[4,-1],[1,-1],[-1,-1],[-4,0],[-5,-1],[-3,0],[-18,0],[-6,-1],[-1,-1],[3,0],[14,-2],[17,-2],[7,-1],[-8,-1],[-59,-5],[-53,2],[-21,0],[-21,-2],[5,-1],[18,-2],[-6,-2],[-8,0],[-9,-1],[-8,0],[1,-1],[-2,-1],[-4,-1],[-4,0],[8,-2],[3,0],[4,-1],[5,0],[4,0],[3,-1],[-2,-2],[3,-2],[1,-2],[-2,-1],[-22,-5],[-1,-1],[3,-2],[-2,-1],[-16,-4],[6,-2],[-2,-2],[-14,-2],[-11,-1],[-23,1],[-15,0],[-5,0],[-4,0],[-8,1],[-5,0],[-29,-1],[-16,0],[-4,0],[2,-2],[-8,-1],[-18,-1],[1,-1],[1,0],[3,0],[3,0],[-2,-1],[-2,0],[-3,-1],[-3,0],[-5,-3],[-6,-1],[-14,-1],[-5,-1],[2,0],[-3,-1],[0,-1],[3,-1],[1,-1],[0,-1],[-2,0],[-8,-1],[-6,-2],[-2,-1],[1,-2],[4,-2],[-4,-1],[-9,-1],[-4,0],[-2,-1],[0,-1],[-6,-1],[-2,0],[3,-1],[1,0],[0,-1],[-2,0],[-4,-1],[-53,1],[4,-1],[22,-1],[14,-2],[13,-1],[-8,-2],[-47,-6],[-7,-2],[1,-1],[-19,-1],[-10,0],[-4,-2],[5,-1],[33,-1],[12,-1],[6,-1],[7,-1],[2,-1],[-1,-1],[-8,-1],[-16,-1],[2,-1],[1,-1],[-7,0],[-15,-1],[-4,-1],[2,-1],[-2,0],[-20,-1],[-10,-1],[-13,-1],[-51,1],[-6,0],[-1,1],[1,1],[-4,0],[-11,0],[-11,1],[-5,0],[-6,0],[-1,0],[0,-1],[-1,0],[-2,-1],[-2,0],[-2,0],[-1,0],[-1,-1],[-5,0],[-6,0],[-5,1],[2,1],[8,1],[-3,0],[0,1],[1,1],[2,1],[-3,0],[-3,0],[-6,1],[3,1],[-1,1],[-3,1],[-25,1],[-13,1],[-28,1],[-14,1],[-14,2],[-47,4],[-42,2],[6,2],[12,1],[35,1],[3,0],[8,2],[7,0],[13,-1],[7,1],[12,1],[25,1],[33,-1],[6,0],[4,-1],[1,0],[0,-1],[-4,0],[5,-1],[21,1],[-3,2],[3,1],[6,0],[26,0],[9,0],[5,1],[-10,1],[-39,0],[-9,-1],[-5,0],[-3,0],[-11,1],[-8,1],[-9,0],[-8,0],[-6,2],[-1,0],[1,1],[-2,1],[-2,0],[-1,0],[-3,1],[-6,0],[-7,-1],[-4,0],[0,-1],[-17,0],[-7,0],[-1,-1],[4,-1],[10,-1],[-6,-1],[-18,0],[-16,-1],[-5,0],[-7,1],[-80,0],[-11,1],[-14,0],[-11,1],[-9,1],[-7,1],[3,1],[1,0],[-1,1],[-3,0],[-9,0],[-5,0],[-4,0],[3,1],[2,1],[2,0],[-9,1],[-100,4],[-32,-1],[-6,1],[-12,1],[-6,0],[-12,3],[-1,0],[-1,0],[-1,0],[0,1],[0,1],[3,1],[-38,1],[-4,1],[-1,1],[3,1],[4,1],[-39,4],[-6,1],[-4,1],[2,0],[3,1],[-1,0],[-1,0],[-1,0],[-2,0],[0,1],[18,-1],[5,1],[-8,1],[-16,1],[-8,1],[1,1],[0,1],[-1,0],[-2,1],[10,0],[29,2],[85,2],[19,-1],[17,-3],[-3,-1],[-4,-1],[-4,0],[-5,0],[5,-1],[8,0],[16,0],[14,0],[7,0],[5,1],[0,2],[1,1],[2,0],[31,0],[21,1],[11,0],[23,-1],[83,-1],[83,0],[6,-1],[4,-1],[11,-1],[14,0],[8,-1],[16,-3],[5,0],[18,0],[5,0],[-1,0],[-6,2],[6,0],[21,0],[-9,1],[-41,1],[-16,1],[-9,2],[-9,0],[-3,1],[-9,1],[-12,1],[-103,2],[-103,1],[-13,0],[-6,0],[-4,0],[-8,1],[-4,1],[-10,0],[-5,1],[-3,0],[28,2],[41,0],[19,1],[88,2],[87,2],[88,1],[22,2],[62,1],[63,0],[20,-1],[14,0],[5,0],[4,-1],[6,0],[6,0],[5,0],[-11,1],[-13,1],[-24,1],[-9,0],[-8,1],[-14,3],[6,1],[7,0],[7,-1],[6,0],[16,2],[6,0],[-2,0],[-2,1],[-2,0],[-2,1],[3,0],[3,0],[3,0],[2,1],[-57,-2],[-8,-1],[-3,-2],[-8,-1],[-104,-1],[-105,-1],[-45,3],[-9,0],[-58,-1],[-51,-5],[-75,-1],[-12,-1],[-11,0],[-24,2],[-11,-1],[26,-1],[-8,-1],[-33,0],[-24,1],[-15,-1],[-7,0],[-12,2],[-8,0],[-15,-1],[-23,-2],[-13,-2],[-10,1],[-7,1],[-6,0],[-14,-1],[-6,1],[-5,0],[-3,1],[-5,1],[13,1],[7,0],[4,2],[-8,1],[-10,1],[-11,0],[-11,1],[4,1],[1,1],[0,1],[-2,1],[-2,1],[-5,2],[0,1],[3,2],[4,0],[2,1],[-3,1],[-4,1],[-8,1],[-4,1],[6,1],[19,0],[21,1],[10,0],[6,1],[3,0],[21,0],[12,0],[16,-2],[38,-5],[4,0],[2,0],[1,-1],[2,-1],[2,0],[10,0],[4,0],[3,1],[-1,0],[-1,2],[-1,1],[-5,1],[-17,2],[-7,1],[2,1],[94,1],[94,1],[-2,0],[-8,1],[7,1],[15,1],[6,0],[7,1],[11,2],[12,0],[13,2],[29,1],[32,0],[14,-1],[18,-1],[6,0],[3,1],[-5,1],[-18,1],[-4,1],[-6,2],[5,1],[7,0],[36,3],[8,-1],[8,0],[9,0],[38,1],[6,1],[3,0],[9,0],[35,-2],[76,1],[75,0],[37,3],[12,0],[12,1],[17,1],[5,0],[1,1],[-9,1],[-14,0],[-81,-4],[-52,1],[-6,1],[-4,0],[-1,1],[-1,1],[-2,0],[-10,0],[-27,-1],[-5,0],[-9,2],[-5,0],[4,0],[4,0],[8,1],[7,1],[2,0],[2,1],[3,2],[2,0],[3,1],[4,1],[35,3],[7,1],[3,1],[3,1],[4,0],[3,0],[18,0],[4,1],[1,2],[-10,0],[-37,0],[-3,0],[0,1],[-1,1],[-2,0],[-12,1],[-7,0],[-7,-1],[-9,-2],[-9,-1],[-8,0],[-4,-1],[-2,-1],[4,0],[0,-1],[-3,-1],[-4,-1],[-1,0],[-2,-1],[-1,0],[-2,-1],[-64,-3],[1,-2],[-11,-1],[-66,-1],[-65,-1],[-23,2],[-19,4],[-1,2],[-4,1],[-4,0],[-7,1],[3,0],[2,1],[3,0],[1,0],[40,1],[5,0],[5,1],[5,2],[3,2],[3,2],[2,1],[-6,1],[-1,1],[-1,1],[-6,0],[-2,1],[-2,0],[4,1],[4,0],[7,1],[-5,1],[-11,1],[-4,1],[-5,0],[-7,0],[-11,-2],[-16,-3],[-3,-1],[-1,-1],[-1,-1],[-4,0],[1,-1],[2,0],[2,0],[2,-1],[-5,-1],[3,0],[2,0],[0,-1],[-2,-1],[3,0],[3,0],[2,0],[2,-1],[-12,0],[-36,-1],[-8,-2],[1,0],[4,-1],[-14,-1],[-15,1],[-28,3],[4,1],[3,0],[4,1],[1,1],[-2,1],[-6,2],[-21,1],[-11,-1],[-12,-1],[-12,-2],[-21,0],[-10,-1],[19,-1],[4,0],[1,-1],[-1,-1],[-1,0],[-1,-1],[1,0],[1,0],[1,0],[0,-1],[-1,-1],[1,-1],[3,-1],[4,0],[3,-1],[-6,-1],[-14,1],[-7,-1],[-21,-3],[8,-2],[15,-1],[27,0],[10,0],[8,-1],[7,-2],[7,-2],[-17,-1],[-49,1],[1,-1],[-6,-1],[-7,1],[-14,1],[-7,0],[-6,0],[-5,-1],[-4,-1],[3,-1],[6,0],[4,-1],[1,0],[3,-2],[-9,0],[-36,-3],[-6,-1],[-6,-1],[-9,0],[2,1],[4,1],[4,1],[4,1],[-18,-1],[-4,0],[-2,0],[-3,0],[-4,0],[-3,-1],[-2,-1],[0,-2],[-5,1],[-6,1],[-23,1],[-6,0],[-6,0],[6,-1],[15,-2],[4,-1],[-82,0],[-83,1],[-16,-1],[-11,-1],[-6,0],[-11,1],[-8,2],[-4,0],[9,1],[2,1],[-1,0],[-2,1],[-1,1],[3,0],[-22,2],[11,0],[-4,2],[-7,1],[-47,1],[-21,2],[-14,2],[-7,1],[-11,2],[-12,0],[-4,1],[40,2],[110,0],[46,2],[-13,1],[-14,0],[-26,-1],[-64,0],[-63,0],[-9,1],[-5,2],[1,0],[-6,1],[-77,2],[-18,1],[-9,0],[-5,1],[-5,1],[-3,1],[5,1],[-6,1],[-9,1],[-16,0],[-6,0],[-7,1],[-6,1],[-3,0],[5,1],[16,4],[11,1],[25,0],[12,0],[-9,2],[-10,0],[-68,3],[-14,1],[-15,1],[-17,2],[-6,1],[-2,1],[54,1],[80,-3],[80,-3],[52,0],[8,1],[-2,0],[-5,2],[-4,1],[-1,1],[-1,1],[-6,1],[-8,0],[-76,-2],[-21,1],[7,1],[8,0],[16,0],[-6,1],[-6,0],[-13,0],[-54,3],[-14,1],[-7,0],[13,1],[6,0],[10,3],[12,0],[6,1],[-2,0],[-2,1],[-2,0],[-2,0],[11,1],[3,1],[4,1],[2,0],[4,1],[11,0],[22,0],[10,1],[-3,1],[-11,0],[-4,1],[10,1],[3,0],[-1,1],[-2,0],[-1,1],[1,1],[3,0],[-8,1],[-22,-2],[-35,1],[16,-3],[3,-1],[-5,-1],[-10,0],[-11,1],[-6,0],[2,1],[-4,0],[-11,2],[-2,0],[-1,1],[-2,1],[-3,0],[0,1],[-22,-1],[1,-1],[-2,0],[-3,-1],[-6,0],[9,-1],[23,-4],[8,-2],[-6,-1],[-98,-6],[-12,1],[-11,1],[5,1],[-1,0],[-5,1],[-1,1],[-1,2],[-2,2],[-5,2],[-6,1],[-11,0],[-3,1],[-3,0],[-7,3],[-2,0],[-4,0],[-17,1],[-17,4],[14,0],[4,1],[-11,0],[-2,1],[-1,1],[1,0],[2,0],[3,0],[6,1],[2,1],[-1,0],[-1,1],[-1,0],[-1,1],[-2,0],[-2,0],[-10,2],[-12,1],[-11,0],[-6,0],[-5,1],[-4,1],[7,2],[111,0],[-8,1],[-68,1],[2,1],[6,1],[29,2],[98,-1],[6,0],[-1,1],[-6,0],[-18,1],[-28,3],[-4,0],[-4,1],[1,1],[2,0],[1,0],[-1,1],[1,0],[5,1],[-11,1],[9,1],[13,0],[45,-1],[11,0],[8,1],[-8,2],[6,0],[13,0],[5,0],[3,1],[3,1],[4,0],[25,1],[11,0],[8,-2],[4,-1],[12,-1],[4,0],[0,-1],[-1,0],[0,-1],[5,-1],[16,-2],[1,-1],[4,0],[2,0],[2,0],[-1,0],[-4,-2],[15,-1],[8,0],[6,0],[-2,1],[-1,0],[-3,1],[6,1],[7,-1],[19,-3],[4,0],[8,1],[1,0],[2,1],[1,2],[-11,2],[-23,1],[3,1],[-4,0],[1,0],[-4,1],[-3,0],[-2,1],[0,1],[2,1],[7,1],[44,0],[14,-1],[9,-1],[1,0],[3,-1],[4,0],[2,-1],[2,-1],[-2,0],[-9,-1],[10,-1],[34,2],[20,0],[35,2],[10,1],[23,1],[45,1],[24,2],[54,0],[50,1],[10,0],[10,-1],[15,-2],[1,0],[1,-2],[1,0],[-1,-1],[1,-1],[3,-1],[-18,-2],[-37,-3],[-111,-1],[-6,1],[-11,-1],[-42,0],[4,-1],[-4,0],[-86,-6],[-19,0],[-15,0],[-7,0],[-4,-2],[7,0],[15,-1],[7,0],[8,0],[22,1],[46,0],[31,2],[35,0],[25,1],[25,-1],[13,0],[6,-1],[3,-1],[-14,-2],[-5,-1],[-4,0],[-8,-1],[-4,0],[-4,0],[-9,1],[-4,0],[2,-1],[2,-1],[-2,0],[-2,-1],[-1,0],[-1,-1],[9,0],[37,-2],[5,0],[2,1],[-2,0],[-9,2],[8,0],[12,1],[13,-1],[8,0],[2,-1],[0,-1],[2,0],[3,0],[7,0],[20,-1],[5,-1],[1,-1],[5,0],[15,-2],[2,0],[4,-2],[2,0],[3,0],[-3,-2],[0,-1],[1,-1],[-4,0],[1,-1],[6,-1],[5,0],[8,0],[5,0],[10,-1],[7,0],[8,2],[12,3],[-4,1],[-9,2],[-5,1],[-11,1],[-5,0],[2,1],[2,0],[2,0],[2,1],[-4,0],[-2,1],[-3,1],[-10,1],[-5,1],[-2,1],[4,0],[-12,2],[-4,1],[4,1],[12,2],[29,2],[41,0],[7,1],[-8,0],[-16,1],[-8,0],[7,1],[22,1],[9,1],[-7,0],[-4,0],[-3,0],[7,1],[29,4],[21,3],[5,2],[3,0],[5,0],[73,-3],[15,-1],[39,-7],[8,-1],[11,0],[9,-1],[12,-1],[4,-1],[4,0],[-5,-1],[0,-1],[2,-1],[2,0],[2,-1],[1,0],[-2,-1],[3,-1],[5,-1],[10,-1],[-3,-1],[1,-1],[8,-1],[3,-1],[5,-2],[3,-1],[-1,-1],[3,-1],[4,-1],[2,-1],[4,-1],[9,-1],[17,-1],[5,-1],[8,-2],[5,-1],[14,0],[7,-1],[3,-2],[-2,0],[-1,0],[-7,-1],[-16,-2],[-4,-2],[0,-2],[5,-1],[7,0],[22,4],[18,0],[18,-2],[15,-2],[4,-1],[15,-1],[4,-1],[1,-1],[2,-1],[0,-1],[-1,-1],[1,-1],[4,-1],[5,0],[10,-1],[5,-1],[3,0],[8,0],[3,0],[1,-1],[2,-1],[5,-1],[4,0],[21,0],[9,0],[4,1],[-9,2],[1,0],[0,1],[-13,0],[-5,1],[-4,3],[-3,0],[-4,1],[-3,0],[-9,4],[-4,1],[-13,1],[-4,1],[-3,1],[-4,2],[-2,1],[-1,1],[0,1],[0,1],[-2,1],[-4,0],[-27,4],[-12,1],[3,2],[-4,3],[-6,2],[-3,4],[-3,1],[-5,3],[-3,0],[-2,1],[-2,0],[1,1],[3,1],[12,1],[-5,0],[-11,0],[-4,1],[-2,1],[-1,1],[-2,1],[-5,1],[-12,1],[-3,1],[4,1],[-3,1],[-11,1],[1,0],[4,1],[-1,1],[-1,0],[-1,0],[-2,1],[-3,1],[-3,1],[-3,0],[4,1],[2,0],[-4,1],[-3,1],[0,2],[2,1],[7,1],[8,1],[91,-1],[8,1],[-8,1],[-22,1],[-9,2],[-3,1],[-1,0],[1,1],[4,1],[4,0],[15,2],[-3,0],[-2,0],[-2,1],[-1,0],[4,0],[9,1],[15,0],[26,3],[10,0],[8,0],[9,-1],[40,0],[4,-1],[1,0],[2,-2],[1,0],[4,-1],[6,-1],[11,-1],[7,-1],[4,0],[2,-1],[-1,0],[-4,-1],[-1,-1],[3,0],[27,-3]],[[9999,9958],[-10,-1],[-13,-1],[-59,0],[-60,-1],[-47,-3],[-95,-2],[-95,-1],[-96,-2],[-27,2],[-4,1],[1,0],[4,1],[112,2],[113,2],[112,2],[13,1],[6,0],[13,0],[5,1],[47,1],[80,-2]],[[6502,9965],[3,0],[4,0],[3,0],[3,0],[3,-1],[-13,0],[-4,-1],[-4,0],[-6,-1],[-3,-1],[-32,-1],[-9,0],[-36,2],[-32,1],[-10,0],[5,2],[4,1],[8,0],[4,0],[7,1],[15,2],[4,0],[63,-2],[19,-1],[4,-1]],[[7834,9971],[-50,-1],[-9,2],[3,0],[3,1],[1,1],[2,1],[6,1],[6,0],[5,0],[6,-1],[6,-1],[16,-2],[5,-1]],[[7785,9980],[14,-1],[14,-1],[-8,-1],[-10,0],[-48,1],[-8,1],[4,0],[5,1],[6,0],[4,0],[13,0],[14,0]],[[7544,9970],[6,0],[12,0],[-1,-1],[-2,0],[-2,0],[-2,0],[5,0],[14,-1],[10,0],[5,0],[4,-1],[-13,-1],[0,-1],[1,0],[1,-1],[0,-1],[-2,0],[-4,0],[-4,-1],[-8,0],[-34,-1],[-6,-1],[-7,-4],[-5,-1],[0,-1],[3,-1],[10,-1],[14,-1],[15,-1],[11,1],[-9,1],[-5,0],[-7,2],[-9,0],[-4,1],[37,-1],[-3,1],[-1,0],[-2,0],[1,1],[4,0],[8,0],[5,0],[3,0],[2,0],[0,-1],[6,-1],[6,-1],[7,0],[7,1],[-8,2],[-2,0],[3,1],[6,1],[11,0],[-3,-1],[2,0],[3,0],[3,0],[1,-1],[-1,0],[-2,-1],[-5,0],[2,0],[5,-1],[2,0],[9,0],[-1,-1],[-1,-1],[8,0],[8,1],[15,2],[33,1],[7,1],[-15,0],[-3,1],[-2,0],[-2,1],[-2,0],[3,1],[8,0],[3,0],[-13,1],[-5,0],[2,1],[3,0],[2,0],[3,0],[-2,1],[-1,1],[-2,0],[7,1],[8,0],[16,-2],[21,0],[4,0],[5,-1],[4,0],[4,0],[-24,2],[-8,1],[43,-1],[26,-2],[8,1],[-3,1],[-2,0],[31,-1],[9,1],[-3,0],[-4,1],[-5,0],[-4,0],[0,1],[18,-1],[5,1],[-6,1],[-39,0],[-15,1],[9,2],[17,0],[52,-2],[7,0],[21,-2],[-7,0],[-8,-1],[-9,0],[-6,-1],[1,0],[2,-1],[2,0],[-2,0],[-3,-1],[-2,0],[6,-1],[7,0],[8,0],[6,1],[5,1],[29,1],[3,0],[3,1],[1,1],[7,1],[5,1],[6,0],[9,-1],[4,-1],[-2,-1],[-3,0],[-3,0],[-3,-1],[2,-1],[-4,-1],[-12,-2],[9,1],[17,0],[36,0],[16,1],[57,1],[-8,-1],[-23,-1],[11,-2],[11,0],[31,0],[15,1],[7,0],[5,0],[5,-1],[4,-1],[2,-1],[20,2],[10,0],[9,-1],[-4,-1],[-14,-2],[34,0],[21,1],[102,-1],[101,0],[23,-2],[23,-2],[9,-1],[35,0],[11,-1],[-16,-2],[-2,0],[-3,-1],[-3,-1],[2,0],[2,-1],[2,0],[2,0],[-3,-1],[-9,-2],[-4,-1],[8,-1],[21,-2],[3,-2],[-7,-2],[-14,-2],[-54,-1],[-14,0],[-16,-3],[-8,0],[-25,-1],[-4,0],[1,-1],[-5,-1],[-7,0],[-12,0],[-1,-2],[-8,0],[-46,-2],[-18,-2],[-92,-4],[-4,0],[0,-1],[3,0],[7,-1],[2,0],[8,-1],[3,-1],[1,0],[12,-3],[1,-1],[-3,0],[-6,-1],[-18,-2],[-7,0],[4,-1],[-3,-1],[-5,-1],[-5,0],[-33,-2],[-55,-2],[-10,-1],[-43,-2],[-48,0],[-3,0],[-1,0],[-1,1],[-1,1],[-1,0],[0,1],[-3,0],[-3,0],[-35,0],[-49,-4],[-64,-1],[-7,-2],[3,-1],[0,-1],[-3,-1],[-5,-1],[-43,-3],[-88,1],[-88,1],[-88,1],[-44,3],[-13,1],[-7,2],[-1,0],[-1,1],[3,3],[56,4],[-89,-2],[-23,1],[-82,-1],[-83,-1],[-49,2],[-80,-1],[-80,-1],[-6,1],[4,0],[7,1],[4,0],[-21,2],[-3,1],[-5,1],[-62,0],[-63,1],[-28,1],[-14,2],[-77,3],[-6,1],[-4,2],[-3,1],[43,2],[92,1],[4,0],[12,-2],[32,-2],[86,-1],[87,-1],[-6,2],[-112,2],[-36,4],[-5,1],[108,0],[107,1],[107,0],[4,1],[-1,0],[-2,1],[-3,0],[12,2],[91,1],[15,1],[-14,2],[-17,0],[-97,-3],[2,0],[6,1],[-23,0],[8,2],[20,0],[8,1],[-101,-1],[-100,0],[-100,-1],[-101,-1],[-41,-3],[-43,1],[-18,-2],[-58,-1],[-17,2],[-5,0],[-19,0],[-16,-1],[-68,1],[-39,-1],[-10,0],[1,0],[4,1],[-5,0],[-5,0],[-3,1],[3,1],[-9,1],[-11,1],[-36,-1],[-5,0],[-2,1],[-7,2],[-6,1],[-17,0],[-3,1],[-10,2],[-8,1],[-9,1],[-19,0],[8,1],[35,2],[27,0],[25,1],[15,0],[9,0],[9,0],[5,2],[-29,0],[5,0],[9,1],[12,1],[4,0],[-1,-1],[6,-1],[13,-1],[6,0],[4,1],[1,1],[-2,0],[-4,1],[9,1],[9,0],[9,1],[8,1],[-23,-2],[-108,1],[-16,1],[-17,0],[-5,0],[-9,1],[-5,1],[11,-1],[14,0],[14,0],[11,1],[-51,1],[-8,1],[-11,2],[-10,0],[-7,-1],[-2,0],[-6,0],[-6,1],[-31,0],[-4,0],[8,0],[16,2],[15,1],[13,1],[7,0],[6,0],[2,-1],[4,0],[12,1],[47,-1],[13,0],[4,0],[7,1],[30,0],[18,-2],[8,0],[7,0],[13,2],[-16,1],[36,0],[13,-1],[12,-2],[52,-3],[14,-2],[7,-1],[7,0],[7,1],[14,1],[3,1],[-1,1],[22,0],[21,1],[-9,2],[-14,0],[-26,0],[-23,1],[-12,1],[-8,2],[-10,1],[-3,0],[-2,1],[-3,0],[-2,0],[-2,1],[1,0],[-1,1],[-1,1],[-1,0],[-2,1],[-4,1],[-15,1],[-4,0],[3,1],[6,0],[3,1],[58,-2],[13,-1],[65,-7],[13,-1],[43,0],[-7,1],[-20,0],[-5,1],[3,1],[25,2],[-2,1],[-6,0],[3,0],[2,0],[3,1],[-4,0],[-11,1],[5,0],[6,0],[6,1],[3,0],[-16,1],[-4,0],[8,0],[17,2],[8,0],[0,1],[-90,0],[-10,0],[-4,1],[-1,2],[0,2],[1,0],[7,1],[10,0],[18,-1],[10,-1],[3,0],[3,0],[-1,1],[-7,0],[-4,2],[1,1],[4,0],[34,0],[8,-1],[-1,-1],[42,0],[6,0],[-4,-2],[-1,0],[7,-1],[8,0],[-2,-1],[4,0],[2,0],[-2,-1],[-2,-1],[1,-1],[5,0],[5,0],[3,1],[5,1],[7,1],[10,1],[36,-1],[8,0],[1,-2],[13,-1],[15,-1],[-2,-2],[-2,0],[-1,-1],[8,-1],[8,-1],[8,0],[40,1],[9,0],[-4,-1],[-11,0],[-4,-1],[-2,-1],[2,-1],[7,-1],[6,-1],[3,-1],[7,0],[7,0],[72,1],[21,2],[10,0],[-2,0],[-2,0],[-1,-1],[-1,0],[2,0],[2,-1],[4,-1],[-3,0],[6,0],[5,0],[6,1],[5,0],[1,1],[0,1],[3,0],[3,0],[2,0],[3,0],[2,1],[13,0],[28,-2],[12,0],[-8,1],[-3,0],[5,1],[11,1],[29,-1],[5,-1],[7,-2],[0,-1],[-4,-1],[-9,0],[-16,-1],[-13,-1],[-28,-4],[5,0],[7,0],[27,2],[14,0],[7,0],[12,-1],[37,-2],[-1,0],[5,-1],[9,-1],[8,-1],[10,-1],[5,-1],[-3,0],[-7,-1],[11,-1],[-5,-2],[-1,0],[9,0],[11,0],[11,0],[9,2],[-6,1],[-6,1],[11,0],[17,-2],[9,0],[-9,2],[-3,0],[-11,1],[-4,0],[-3,1],[24,0],[3,0],[-3,1],[-18,2],[4,1],[4,2],[-1,1],[1,1],[7,1],[5,1],[2,1],[-1,2],[-3,1],[7,1],[16,1],[7,1],[-3,1],[-43,2],[-2,0],[-7,1],[-2,1],[1,1],[4,2],[6,1],[2,1],[16,1],[52,-1],[0,-1],[-3,-1],[-8,-2],[-5,-1],[5,-2],[10,0],[17,-1],[-3,1],[-4,0],[-3,1],[-2,1],[4,0],[14,1],[4,0],[2,0],[1,1],[1,0],[1,1],[2,0],[3,1],[-2,0],[-3,1],[4,0],[-5,1],[-4,1],[3,2],[-3,0],[-4,0],[-4,1],[-2,0],[3,1],[5,0],[10,0],[35,-3],[68,-1],[22,-2],[-4,0],[-4,-1],[-10,0],[4,0],[2,0],[2,0],[-5,-1],[-25,0],[-11,-1],[-5,0],[5,-1]],[[6806,9978],[-19,0],[-6,0],[-5,1],[-1,0],[4,1],[21,2],[15,0],[9,0],[9,-1],[7,-1],[-6,0],[-14,-1],[-14,-1]],[[6991,9989],[-3,0],[-3,0],[1,-1],[-7,1],[-14,1],[-32,1],[-8,0],[5,0],[64,0],[-1,-1],[-2,-1]],[[7122,9994],[2,-1],[3,0],[2,-1],[-45,-1],[-9,0],[-11,0],[-10,0],[-5,2],[8,0],[36,2],[28,-1],[-1,0],[-1,0],[3,0]],[[7044,9995],[-2,-1],[-4,0],[-19,-1],[-2,0],[-3,0],[-2,-1],[-11,0],[-2,0],[-1,1],[-1,0],[0,1],[1,0],[-2,0],[-5,0],[-5,1],[-4,0],[-10,-1],[-5,0],[-3,1],[-4,1],[-3,0],[-17,1],[-7,0],[-3,2],[25,0],[7,-1],[9,-1],[6,0],[28,-1],[31,-1],[8,0]],[[3402,8631],[4,0],[2,0],[2,0],[2,0],[1,0],[2,0],[0,-1],[-4,0],[-2,0],[-1,0],[1,0],[2,0],[1,0],[1,-1],[1,0],[2,0],[-2,0],[-2,0],[-1,0],[-1,-1],[-1,0],[-2,1],[-1,0],[-3,0],[-1,0],[-2,0],[-2,0],[-1,0],[-1,1],[-1,0],[-2,0],[1,0],[2,0],[1,1],[1,0],[1,0],[1,0],[2,0]],[[3466,8633],[2,0],[1,-1],[2,0],[3,0],[10,0],[5,0],[1,-1],[-3,0],[-1,-1],[-1,0],[0,-1],[1,-1],[1,0],[1,0],[-1,-1],[-1,0],[-3,-1],[-18,-1],[-36,0],[-2,1],[-2,0],[-1,0],[-1,1],[-1,0],[-3,1],[19,-1],[5,1],[-4,0],[-5,1],[-9,0],[-2,0],[1,1],[4,0],[4,0],[-1,1],[-1,0],[-1,0],[4,2],[8,0],[17,0],[2,0],[2,0],[2,0],[2,0]],[[3470,8638],[2,0],[3,0],[0,-1],[-2,-1],[1,0],[-2,-1],[-7,0],[-6,0],[-1,0],[-1,1],[-1,-1],[-2,0],[-1,0],[-3,0],[-5,0],[-3,0],[2,1],[5,0],[5,1],[5,0],[1,0],[2,1],[2,0],[5,0],[1,0]],[[3436,8636],[-8,0],[-5,0],[-1,0],[0,1],[-1,1],[3,0],[5,0],[4,0],[4,0],[4,-1],[-1,-1],[-4,0]],[[3551,8637],[3,-1],[-3,0],[-2,0],[-5,0],[-38,-6],[-15,-1],[2,1],[5,1],[3,1],[-2,0],[-2,0],[-1,0],[2,2],[-3,2],[-4,1],[-1,1],[2,2],[5,1],[6,1],[6,0],[7,1],[6,0],[6,-1],[5,-2],[1,0],[0,-1],[1,-1],[3,0],[3,0],[10,-1]],[[3586,8644],[11,-2],[9,1],[4,-1],[3,0],[-1,0],[-1,-1],[-1,0],[-36,-1],[-18,1],[-15,3],[41,0],[4,0]],[[3530,8647],[5,0],[8,0],[3,0],[-1,-1],[-3,0],[-2,0],[-2,0],[-3,0],[-5,-1],[-2,0],[-2,0],[-1,0],[-2,0],[-3,1],[1,0],[2,1],[2,0],[1,0],[2,0],[2,0]],[[3566,8653],[0,-1],[1,-2],[-1,0],[-8,2],[-2,0],[-10,-1],[-6,0],[1,0],[1,0],[1,0],[-2,1],[-2,0],[7,1],[2,0],[8,0],[0,1],[-3,1],[6,0],[5,0],[1,-1],[0,-1],[1,0]],[[3747,8665],[3,-1],[-1,-1],[-39,-2],[-15,-1],[-3,0],[-1,0],[0,1],[-1,0],[-1,0],[-3,0],[0,1],[3,0],[2,0],[2,0],[2,1],[-2,1],[2,1],[5,1],[4,-1],[-1,0],[6,0],[26,1],[6,0],[6,-1]],[[3644,8665],[-2,0],[-2,0],[-4,1],[-1,0],[-1,0],[5,1],[-1,0],[-7,1],[7,1],[1,0],[1,0],[6,0],[1,0],[-1,-1],[2,-1],[0,-1],[-4,-1]],[[3724,8674],[6,-1],[6,1],[8,0],[7,0],[5,-1],[0,-1],[-11,0],[-4,-1],[2,0],[2,-1],[2,0],[-1,-1],[-3,-1],[-5,1],[-6,1],[-13,1],[-4,1],[1,0],[3,0],[4,0],[-4,1],[-2,0],[0,1],[3,1],[4,-1]],[[3983,8691],[-3,-1],[-7,-2],[-7,-1],[-8,0],[-5,0],[-2,0],[-2,0],[-3,0],[-1,1],[-4,0],[-13,1],[0,1],[5,0],[1,0],[1,1],[1,1],[2,0],[1,0],[2,0],[10,-1],[17,1],[8,0],[7,-1]],[[3928,8687],[4,-1],[2,0],[-5,-1],[-5,0],[-9,-1],[-3,0],[-3,-1],[-17,-2],[-4,0],[-4,0],[-4,1],[-2,1],[-17,1],[-4,0],[-2,1],[2,1],[5,0],[9,1],[-3,0],[-1,1],[4,1],[-4,0],[-2,0],[-2,0],[0,1],[5,0],[16,0],[-3,-1],[6,0],[5,0],[9,-2],[2,0],[1,1],[-3,1],[2,0],[4,1],[1,0],[3,1],[0,1],[-5,2],[8,0],[4,0],[3,-1],[0,-1],[0,-1],[0,-1],[-2,-1],[3,0],[2,-1],[4,-1]],[[4258,8639],[-16,0],[-13,0],[-27,1],[-47,0],[-56,-1],[-26,-1],[-30,-1],[-4,0],[-2,-1],[-3,-1],[-11,-5],[-3,-1],[-6,-1],[-6,-1],[-12,-2],[-15,0],[-15,1],[-8,0],[-5,0],[-5,0],[-5,0],[-4,0],[-4,-2],[-7,-1],[-11,-2],[-5,-1],[0,-1],[2,-1],[-2,0],[-4,0],[-6,0],[-4,0],[-7,1],[-5,0],[-8,-1],[-21,-2],[-11,-1]],[[3846,8615],[-45,-1],[-6,-1],[-18,-2],[-53,-2],[-6,1],[-4,1],[-14,4],[-8,2],[-46,-4],[-5,0],[-7,-1],[-10,-1],[-5,-1],[-4,-1],[-7,0],[-9,1],[-9,1],[-1,0],[-1,0],[-3,1],[-5,0],[-10,-1],[-3,0],[0,-1],[-1,0],[-1,-1],[-5,0],[-8,0],[-34,2],[-29,-1],[-17,0],[-36,-2],[-8,2],[-14,1],[-4,0],[-1,1]],[[3409,8612],[2,0],[3,0],[3,1],[8,3],[1,1],[1,0],[3,0],[3,0],[4,-1],[3,0],[-7,2],[-33,1],[-5,1],[-2,0],[0,1],[5,2],[2,1],[2,1],[6,0],[5,0],[11,-1],[23,-1],[4,0],[2,-1],[1,-1],[2,-1],[7,0],[14,-2],[-5,1],[-8,1],[-6,2],[-1,2],[5,0],[7,1],[13,-1],[3,1],[12,1],[5,0],[6,0],[5,-1],[4,-1],[1,-1],[0,-1],[-1,-2],[-3,-2],[-13,-3],[-2,-2],[15,3],[6,2],[5,4],[3,-1],[18,-3],[2,0],[-1,-2],[9,1],[9,0],[19,0],[37,-1],[-65,3],[-3,1],[-6,1],[-2,1],[-3,0],[-11,3],[-12,1],[-2,1],[1,1],[3,0],[4,0],[9,-1],[5,-1],[11,0],[-3,1],[-5,0],[-9,0],[-2,1],[-2,0],[-2,1],[-4,0],[7,3],[12,2],[13,1],[11,0],[27,3],[15,1],[6,-2],[1,0],[7,-3],[5,-2],[5,-1],[11,-2],[5,-1],[16,-4],[2,-2],[-1,-1],[-6,-2],[15,2],[-3,2],[-20,7],[-18,4],[-5,2],[-2,2],[3,2],[8,0],[10,1],[5,0],[6,-1],[2,0],[7,-3],[0,2],[0,1],[-1,1],[-3,0],[0,1],[4,0],[20,1],[9,1],[5,1],[3,-1],[6,-1],[31,-1],[0,-1],[-2,-2],[1,-2],[2,-1],[22,-4],[3,-1],[1,0],[1,-1],[2,-3],[-1,-1],[-2,-1],[-12,-4],[-1,-1],[4,-1],[7,-1],[8,0],[18,1],[6,1],[4,0],[3,0],[8,-1],[-9,2],[-28,-2],[-12,1],[-1,1],[3,1],[9,2],[3,1],[0,1],[-3,4],[1,1],[2,0],[3,1],[14,0],[23,-2],[6,0],[4,1],[7,1],[7,0],[6,-1],[3,-1],[5,-1],[6,0],[4,-1],[0,1],[-10,2],[-9,1],[-3,1],[-6,0],[-31,-1],[-33,2],[-15,1],[-10,4],[8,0],[3,0],[3,0],[-29,6],[-2,0],[-5,0],[-10,0],[-5,1],[4,0],[4,1],[-23,-1],[-49,-3],[-20,0],[-9,0],[-4,1],[-5,1],[-4,0],[-4,0],[-5,0],[-5,0],[-5,0],[7,1],[20,0],[18,1],[4,1],[5,0],[19,0],[9,0],[24,0],[-5,0],[-9,2],[-11,-1],[-21,0],[0,1],[15,0],[5,0],[-7,1],[-63,-1],[1,1],[-1,0],[2,1],[-2,1],[-2,0],[-1,1],[1,0],[2,1],[6,1],[7,0],[51,1],[5,-1],[6,-1],[4,-1],[1,-1],[1,0],[3,2],[0,1],[-3,0],[3,1],[2,0],[2,0],[1,-1],[10,2],[10,1],[6,1],[5,-1],[24,-3],[5,-1],[0,-1],[-1,0],[1,0],[4,0],[1,0],[0,1],[-2,0],[-1,1],[1,0],[3,1],[-2,0],[-3,1],[-2,0],[-2,1],[10,1],[38,-1],[-2,-1],[-3,0],[-4,-1],[-4,0],[3,-1],[11,0],[2,-1],[1,-1],[3,-2],[1,-1],[1,0],[1,0],[3,2],[1,1],[-1,0],[-3,1],[-1,0],[6,3],[3,0],[9,-1],[25,-1],[11,-1],[16,-3],[13,0],[7,-1],[2,-1],[2,-1],[2,-1],[4,1],[2,1],[0,1],[1,1],[4,0],[44,2],[-8,0],[-56,-1],[-10,1],[-5,0],[-4,1],[-2,2],[1,1],[6,1],[8,-1],[5,-1],[-1,-2],[6,-1],[3,1],[0,2],[-6,2],[0,1],[3,1],[12,1],[10,1],[52,2],[26,0],[11,1],[5,-1],[6,0],[20,-3],[4,0],[-4,2],[-15,2],[-5,1],[3,0],[2,1],[1,0],[1,1],[-6,0],[-11,-1],[-21,0],[-11,-1],[-51,-2],[-28,-3],[-8,0],[-25,0],[-6,1],[8,0],[2,1],[-2,0],[-6,1],[8,1],[16,2],[49,2],[-5,0],[-11,0],[-38,-2],[-8,-1],[-4,0],[-11,0],[-9,-1],[-80,-1],[-5,0],[3,0],[2,1],[2,0],[1,1],[-1,0],[-4,1],[-1,0],[1,1],[4,1],[7,1],[12,1],[37,-1],[-6,1],[-9,2],[-5,0],[-27,-1],[-3,1],[-11,3],[-2,1],[-5,1],[-11,0],[3,0],[4,1],[21,1],[18,3],[7,0],[15,1],[16,1],[8,0],[6,-1],[10,-1],[7,-1],[12,-1],[1,-1],[3,-2],[14,0],[14,1],[13,2],[12,2],[5,0],[21,-1],[1,0],[-1,0],[-2,-1],[-5,-1],[-19,-2],[6,0],[33,2],[3,1],[8,0],[4,0],[10,1],[8,0],[24,-2],[2,0],[2,-1],[2,-1],[2,0],[1,-1],[2,-3],[4,-2],[3,-2],[8,-1],[21,-1],[10,0],[22,-4],[8,-1],[7,0],[8,-1],[6,-1],[1,-2],[6,2],[-1,1],[-5,1],[-21,3],[-18,2],[-11,1],[-19,2],[-15,2],[-3,1],[-1,1],[1,1],[2,1],[3,0],[4,1],[-3,0],[-3,0],[-2,0],[-2,1],[-2,0],[-1,1],[-2,1],[-4,0],[-10,1],[-20,3],[-1,0],[-2,1],[-1,0],[-3,0],[-2,0],[-2,0],[-2,0],[2,0],[2,-1],[1,0],[1,0],[-5,-1],[-8,0],[-7,0],[-2,1],[4,1],[9,1],[4,1],[8,2],[3,1],[5,1],[5,0],[6,0],[5,0],[4,0],[4,-1],[3,-1],[-1,-2],[3,-1],[4,-1],[4,0],[17,-1],[5,-1],[4,-1],[2,0],[4,0],[2,-1],[2,0],[2,0],[0,-1],[-7,-1],[3,-1],[4,-1],[-2,-2],[0,-1],[4,0],[6,1],[4,0],[3,0],[20,-3],[8,0],[4,0],[-3,2],[-17,0],[-6,1],[5,0],[29,-1],[5,-1],[3,0],[4,-1],[2,-1],[4,0],[8,-1],[4,0],[-19,4],[-6,1],[-17,0],[-5,1],[-5,0],[-13,3],[-2,1],[54,1],[5,1],[-6,0],[-16,0],[-7,0],[-5,0],[3,1],[12,2],[-8,0],[-15,-2],[-22,-2],[-5,0],[-1,0],[-2,1],[-1,0],[-2,1],[-6,0],[8,1],[19,0],[8,1],[-8,0],[-31,0],[-10,0],[-5,0],[-4,1],[0,1],[1,1],[-2,0],[-4,2],[-5,1],[-3,1],[5,1],[7,0],[6,-1],[4,-1],[7,-1],[-1,-1],[5,0],[2,0],[2,1],[-2,0],[-1,1],[2,0],[-4,1],[-5,1],[-11,1],[72,-1],[23,-2],[-4,2],[-11,1],[-3,1],[3,1],[7,0],[57,2]],[[4202,8700],[-10,-1],[-1,0],[1,0],[9,-2],[3,-2],[10,0],[11,0],[12,1],[8,1],[26,-1],[14,0],[3,0],[0,1],[-1,1],[0,1],[1,0],[4,1],[10,1],[12,0],[20,-1],[12,-1],[2,-1],[0,-1],[0,-3],[1,-1],[2,-1],[0,-1],[-1,-1],[1,-1],[7,-1],[5,0],[6,-1],[4,0],[-6,-2],[-20,-2],[-5,-1],[-2,-1],[1,-1],[1,-1],[1,-1],[-1,-1],[-8,-4],[-11,-1],[-15,-1],[-83,-5],[-3,0],[-1,-1],[2,-1],[53,-10],[4,0],[11,-1],[2,0],[1,0],[0,-1],[-1,-1],[-4,-1],[-3,-1],[-3,-2],[-1,-2],[-3,-2],[-3,-1],[-18,-3]],[[4075,8697],[-18,0],[-5,0],[-3,0],[-1,1],[-3,2],[-1,1],[-2,0],[1,0],[4,1],[5,0],[6,0],[10,-2],[3,0],[4,-1],[2,0],[0,-1],[2,0],[-4,-1]],[[4047,8697],[-39,-2],[-10,1],[-12,2],[2,1],[13,1],[13,2],[7,1],[8,0],[5,-1],[5,-1],[4,-2],[-1,-1],[4,-1],[1,0]],[[4116,8703],[15,-2],[6,-1],[-2,-2],[-33,-1],[-12,0],[-6,1],[-13,3],[-6,1],[1,1],[1,2],[1,0],[2,1],[3,-1],[2,0],[2,0],[2,-1],[2,0],[3,1],[2,0],[3,-1],[3,-1],[4,-1],[2,1],[-1,1],[0,1],[2,1],[4,0],[4,0],[3,-1],[6,-2]],[[4206,8701],[-51,-1],[-6,0],[-3,0],[-2,2],[-2,1],[-5,1],[-11,2],[-6,0],[-6,1],[9,1],[44,1],[8,1],[7,1],[-9,0],[-4,0],[-3,0],[-2,1],[-2,1],[-1,0],[-9,1],[2,1],[6,1],[11,-1],[5,1],[6,0],[5,1]],[[4187,8717],[2,-1],[6,-1],[3,-1],[5,0],[9,-1],[3,-1],[2,-1],[-1,-1],[-6,-5],[-2,-3],[-2,-1]],[[4026,8710],[-1,0],[-1,0],[-1,-1],[-11,0],[-4,0],[-6,-1],[-4,0],[-1,1],[-10,1],[-4,0],[4,1],[15,-1],[-7,1],[-37,2],[-5,0],[1,2],[-1,0],[-2,1],[7,0],[7,1],[14,0],[6,0],[12,2],[7,1],[15,0],[8,-1],[5,-2],[11,-2],[2,-1],[-7,-2],[-3,-1],[-2,0],[-7,-1]],[[4101,8729],[0,-1],[2,0],[1,0],[1,0],[1,-1],[-1,0],[-2,0],[-2,0],[1,0],[1,0],[-2,0],[-1,0],[-1,0],[-1,0],[-1,0],[-1,0],[1,0],[1,1],[1,0],[1,0],[-1,0],[-2,0],[-1,-1],[-1,0],[-2,0],[-1,0],[0,1],[-3,0],[-1,0],[2,0],[3,0],[1,1],[1,0],[2,0],[1,0],[1,0],[-1,0],[1,0],[2,0]],[[4675,8718],[2,-4],[3,-1],[5,-1],[4,-1],[7,0],[116,-1],[43,-10],[97,0]],[[4952,8700],[38,-15],[-27,-6],[-3,-1],[1,-1],[14,-12],[-1,-1],[-3,-2],[-9,-4],[-3,-2],[1,-1],[44,-18]],[[5004,8637],[-26,-1],[-37,2],[-44,2],[-7,-1],[-17,-1],[-4,1],[-4,0],[-5,1],[-6,0],[-15,0],[-8,1],[-6,2],[-5,1],[-4,1],[-57,8],[-4,1],[-4,1],[-3,2],[-3,1],[0,1],[-1,1],[-10,1],[-54,2],[-21,0],[-12,-2],[-3,0],[-3,0],[-1,0],[-2,0],[-1,1],[-2,0],[-7,1],[-20,-1],[-71,1],[-30,-3],[-14,-6],[-4,-3],[-1,-2],[3,-2],[4,-3],[-4,-1],[-3,0],[-21,-2],[-3,-1],[-4,0],[-5,-2],[-4,0],[-3,-1],[-9,1],[-2,0],[-1,-1],[-1,0],[-3,-1],[-2,-1],[-10,-3]],[[4420,8632],[-44,-1],[-20,2],[-11,1],[-51,3],[-36,2]],[[4202,8700],[22,1],[-18,0]],[[4187,8717],[1,0],[8,0],[4,-1],[4,-1],[5,-1],[2,2],[9,0],[9,0],[7,0],[-5,0],[-2,1],[2,1],[6,2],[1,0],[3,0],[8,-1],[15,-3],[2,-1],[1,-1],[1,0],[4,-1],[-6,-1],[-5,-2],[-3,-1],[1,-2],[7,2],[4,1],[12,0],[17,2],[39,1],[10,2],[-6,0],[-13,-1],[-31,-1],[-7,0],[-3,0],[-3,0],[-3,0],[-6,2],[0,1],[4,1],[70,3],[0,1],[-1,0],[-2,0],[-3,0],[-22,-1],[-7,0],[-8,0],[-3,1],[-2,0],[-3,1],[-2,0],[1,-1],[1,-1],[3,-1],[3,0],[-19,0],[-10,1],[-4,1],[3,2],[7,0],[12,0],[-2,2],[5,0],[6,-1],[4,0],[4,1],[6,1],[6,1],[5,0],[-3,-1],[-1,-1],[1,-1],[3,0],[3,-1],[3,1],[10,3],[4,0],[5,1],[5,0],[4,-1],[6,-2],[3,0],[-3,2],[-4,1],[-5,1],[-7,0],[6,1],[7,0],[14,1],[14,1],[7,1],[6,-1],[-1,-1],[5,-1],[10,-2],[4,-1],[2,-1],[1,-2],[-2,-1],[22,-3],[11,-2],[3,-1],[-4,-3],[-3,-1],[-22,-4],[5,0],[9,1],[9,0],[11,2],[8,0],[8,-1],[12,-2],[9,0],[17,0],[7,0],[3,-1],[1,-3],[2,0],[1,1],[0,2],[1,0],[1,0],[0,1],[-2,0],[-1,0],[0,1],[-5,1],[-38,1],[-3,0],[-3,1],[-2,0],[-1,1],[-1,1],[2,1],[3,0],[5,1],[3,1],[14,1],[34,1],[4,-1],[9,-1],[4,0],[3,0],[7,1],[7,0],[8,0],[8,-1],[7,-1],[8,0],[26,2],[1,-1],[15,0],[6,-2],[3,0],[3,0],[5,2],[2,0],[8,0]],[[4229,8734],[2,-1],[-1,0],[-1,-1],[-2,0],[1,-1],[3,0],[3,-2],[6,0],[8,1],[8,0],[9,-2],[1,0],[0,-1],[3,0],[9,0],[-8,-1],[-8,-1],[-58,-4],[-33,0],[-13,-1],[-21,-1],[-16,-2],[-6,0],[-17,0],[-4,0],[-10,2],[-1,0],[-1,0],[-1,0],[-2,0],[-1,0],[-1,-1],[-1,0],[-3,0],[-3,0],[-1,1],[1,1],[-2,0],[2,1],[3,1],[4,1],[23,3],[5,1],[42,0],[18,0],[4,0],[3,0],[-10,1],[-22,1],[-10,1],[5,0],[4,0],[9,0],[39,2],[9,0],[2,-1],[3,0],[2,0],[1,1],[2,1],[4,0],[8,0],[7,1],[4,0]],[[4265,8733],[1,0],[5,0],[1,0],[1,0],[1,0],[2,0],[1,0],[-2,-1],[-7,0],[-5,-1],[-8,-1],[-11,1],[-4,0],[3,1],[1,0],[2,1],[1,0],[1,1],[2,0],[7,0],[5,0],[3,0],[0,-1]],[[4254,8736],[7,-1],[1,0],[1,0],[1,0],[-1,0],[-2,-1],[-15,0],[-1,0],[0,1],[2,1],[7,0]],[[4337,8734],[1,0],[1,-1],[5,0],[-3,-1],[-5,0],[-2,1],[-1,1],[-3,0],[-1,-1],[1,0],[1,0],[-1,0],[-2,0],[-2,0],[-2,0],[-1,0],[1,1],[2,1],[2,0],[1,0],[2,1],[2,0],[2,0],[1,0],[1,-1],[1,0],[-1,-1]],[[4169,8744],[-7,-1],[-3,0],[-2,0],[-10,-1],[1,1],[1,0],[7,1],[2,0],[1,0],[1,0],[1,0],[1,0],[7,0]],[[4189,8745],[-1,-1],[3,0],[2,-1],[0,-2],[1,0],[1,-1],[1,-1],[0,-1],[-8,-1],[-11,-1],[-47,-1],[-16,-1],[-4,1],[16,1],[-13,0],[-3,-1],[-4,1],[-6,0],[-13,-1],[-6,0],[-5,0],[-4,0],[-6,1],[14,1],[44,1],[53,4],[-4,1],[-4,0],[-5,-1],[-3,0],[2,1],[12,2],[4,-1],[4,1],[4,0],[4,0],[-1,0],[-1,0]],[[4336,8746],[1,0],[2,0],[1,-1],[-2,0],[-1,-1],[-2,0],[-3,0],[-1,-1],[-1,0],[-1,0],[-2,0],[-1,1],[3,1],[-1,0],[-1,0],[1,1],[3,0],[1,0],[2,0],[3,0],[-1,0]],[[4114,8748],[2,0],[1,0],[1,0],[1,0],[-1,-1],[-1,0],[0,-1],[-1,1],[-1,1],[-1,0],[-1,0],[-1,-1],[-1,0],[-1,0],[-1,0],[-2,0],[-1,0],[1,1],[2,0],[1,0],[1,0],[1,0],[1,0],[1,0]],[[4269,8758],[1,0],[-1,0],[-3,0],[0,-1],[-1,0],[-5,1],[2,0],[1,0],[1,0],[1,0],[1,0],[2,1],[1,0],[0,-1]],[[4454,8761],[3,0],[1,-1],[-4,-1],[-5,0],[-4,0],[-2,0],[-3,1],[-4,0],[1,0],[4,0],[2,1],[-1,0],[-2,0],[-3,0],[-2,0],[-1,0],[2,1],[5,0],[2,0],[2,1],[3,-1],[3,0],[1,-1],[2,0]],[[4474,8763],[-2,-1],[-10,0],[-4,0],[-1,1],[-2,1],[2,0],[2,1],[4,0],[5,0],[7,-1],[-1,-1]],[[4329,8772],[-1,0],[-4,0],[3,0],[1,0],[1,0]],[[4617,8789],[8,-1],[11,-1],[13,-2],[6,-1],[23,-2],[18,-1],[-13,-5],[-18,-2],[-5,-4],[8,-1],[8,-1],[9,-1],[-10,-2],[-12,-3],[-1,0],[0,-1],[2,-1],[-1,-1],[-4,0],[-1,-1],[-1,-1],[-3,-1],[-33,-5],[-14,-2],[-13,-4],[-6,-4],[-1,0],[0,-1],[-4,0],[-15,-2],[-41,-5],[-9,-1],[-5,-2],[-2,0],[-2,-1],[1,-2],[2,-1],[5,-1]],[[4517,8725],[-1,0],[-6,0],[-21,-2],[-9,-1],[-10,0],[-1,0],[-2,0],[-1,0],[-1,0],[-2,0],[-1,0],[-2,1],[-8,0],[-3,1],[-1,2],[-4,2],[3,0],[1,1],[-4,0],[-8,0],[-4,1],[-4,1],[-2,0],[1,1],[5,1],[-2,0],[-2,1],[-6,0],[1,1],[1,0],[1,0],[-1,1],[10,1],[19,1],[18,1],[8,0],[8,2],[7,1],[-6,0],[-10,-2],[-6,0],[1,1],[2,1],[2,0],[3,0],[-2,1],[-5,0],[-4,-1],[-4,0],[-5,0],[-11,-1],[-12,-2],[-18,0],[-12,-2],[-18,0],[-1,0],[-1,-1],[-1,0],[-3,0],[-1,0],[-8,-1],[-10,-1],[2,2],[4,1],[-4,1],[0,1],[39,3],[14,0],[-46,-1],[-9,1],[28,4],[39,3],[10,0],[-10,0],[-4,1],[-5,0],[23,2],[5,0],[1,-1],[-2,0],[0,-1],[4,0],[3,1],[8,1],[23,1],[11,2],[13,-1],[6,0],[-6,2],[-3,0],[-4,0],[-4,0],[-7,-1],[-7,0],[-8,-1],[-9,0],[-7,-1],[-5,0],[7,2],[27,2],[10,1],[-4,0],[-2,0],[-3,-1],[-3,0],[-2,0],[-1,1],[-2,0],[-15,-2],[-7,0],[-6,0],[2,1],[6,1],[3,1],[1,1],[1,1],[1,1],[5,0],[-1,0],[0,1],[3,1],[-3,0],[-3,1],[-1,1],[0,1],[4,1],[5,0],[11,-1],[4,-1],[2,0],[20,1],[3,0],[3,1],[-7,0],[-19,0],[2,1],[4,0],[4,0],[4,0],[-2,1],[-1,0],[0,1],[10,0],[-3,0],[-2,0],[0,1],[2,1],[-2,0],[-1,0],[0,1],[-1,0],[5,0],[4,-1],[4,0],[3,1],[-1,0],[5,0],[10,1],[5,-1],[11,-1],[2,0],[-2,1],[-10,1],[-18,1],[3,1],[6,1],[12,0],[-1,1],[-1,0],[6,0],[11,0],[-2,1],[4,0],[7,0],[3,1],[3,0],[3,0],[4,0],[-8,0],[-2,1],[0,2],[0,1],[5,0],[1,0],[-1,0],[5,0],[6,0],[9,-2],[-1,1],[-3,1],[-8,1],[10,0],[4,0],[8,-1],[3,0],[8,0],[0,1],[-6,0],[-3,0],[-2,1],[-2,1],[-2,0],[-3,0],[-1,0],[-1,1],[-2,0],[-21,0],[2,1],[3,0],[3,1],[3,0],[8,0],[13,-2],[7,-1],[-1,1]],[[4327,8373],[-3,0],[-5,-1],[-3,-1],[-8,-1],[-13,0],[-39,0],[-3,0],[-2,0],[-1,-1],[2,0],[18,-1],[6,0],[-12,1],[-4,1],[27,-1],[0,-2],[-7,0],[-21,-1],[-8,0],[7,0],[15,0],[7,0],[4,-1],[-3,0],[-9,-2],[-14,-2],[-13,-2],[-10,1],[-2,0],[0,-1],[-1,0],[-2,0],[-2,0],[-2,1],[-1,0],[-6,0],[-2,0],[1,0],[5,-1],[2,-1],[-1,-1],[1,-1],[-1,-2],[-4,-1],[-4,-1],[-15,-2],[-5,-1],[-7,-1],[-4,-1],[-6,0],[-3,-1],[-2,-1],[-4,-1],[-2,-1],[-5,0],[-4,0],[-3,-1],[-3,0],[-2,0],[-1,-1],[-2,-1],[-3,0],[-3,0],[-1,0],[-1,1],[-2,0],[-8,-2],[-7,-2],[-2,-1],[3,-1],[-4,-1],[-5,1],[-5,0],[-5,-1],[-3,1],[-3,1],[-2,-1],[1,-1],[0,-1],[-4,0],[-8,0],[-2,0],[-7,-1],[-2,0],[-3,-1],[-8,0],[-4,-1],[2,0],[3,0],[1,0],[-3,-1],[-2,-1],[-5,-1],[-1,0]],[[4055,8327],[-2,1],[-7,2],[2,1],[1,0],[1,1],[1,0],[1,0],[1,0],[3,1],[0,1],[-1,1],[-3,2],[-23,1],[-4,0],[1,1],[1,0],[1,0],[-1,1],[-1,0],[-1,1],[-1,1],[-13,1],[-6,-1],[-1,0],[-1,-1],[-3,0],[-3,0],[-3,1],[-1,0],[-2,2],[-4,1],[-7,1],[-17,1],[-4,0],[0,1],[0,1],[-2,0],[-3,1],[-6,1],[-10,0],[-2,0],[-7,-1],[-16,0],[-5,0],[-3,1],[-4,2],[-1,1],[-3,2],[1,1],[2,0],[8,1],[2,0],[3,1],[1,1],[-1,0],[-4,2],[-3,1],[-1,2],[1,1],[1,1],[3,0],[2,0],[1,0],[3,0],[2,1],[2,0],[3,1],[2,2],[3,1],[0,2],[-13,4],[-5,2],[-2,0],[-3,1],[-9,0],[-28,0],[-18,-1],[-34,-1],[-4,-1],[-1,-1],[-2,0],[-3,0],[-11,0],[-9,1],[-2,1],[2,1],[2,1],[17,3],[3,2],[-1,1],[-5,2],[-5,2],[3,0],[3,0],[3,1],[1,0],[-1,1],[-2,1],[-1,1],[0,2],[2,2],[1,1],[1,1],[2,0],[3,1],[-1,0],[-2,1],[-35,2],[-18,0]],[[3756,8405],[-20,-1],[-7,1],[0,1],[0,3],[-3,3],[0,1],[2,1],[4,2],[3,1],[1,2],[2,1],[3,1],[3,1],[2,0],[0,1],[2,0],[7,1],[5,0],[8,1],[3,1],[2,0],[-1,0],[0,1],[-2,0],[-4,1],[-1,2],[1,1],[0,1],[0,1],[-1,0],[1,1],[2,0],[14,2],[6,1],[7,2],[3,0],[6,1],[3,0],[3,0],[2,0],[2,0],[2,0],[10,0]],[[3826,8440],[6,-1],[7,0],[2,0],[4,0],[3,-1],[6,0],[3,0],[1,0],[0,1],[1,0],[3,0],[7,1],[3,-1],[3,0],[2,0],[2,-1],[1,0],[3,-1],[3,-1],[2,-1],[9,0],[-7,-2],[0,-1],[1,0],[2,-2],[2,-1],[2,0],[10,-1],[6,-1],[1,-1],[-1,-1],[-4,-2],[-4,0],[-3,-1],[-7,0],[-2,-1],[-1,0],[2,0],[10,-1],[4,-2],[4,-1],[3,-1],[3,0],[6,0],[15,-3],[12,-4],[3,-2],[-3,-1],[-3,-1],[-1,-1],[0,-2],[2,-1],[3,-1],[7,-1],[7,-1],[30,-8],[0,-1],[15,-1],[13,-1],[7,1],[4,0],[1,0],[-1,0],[-2,0],[-1,1],[1,0],[5,0],[4,0],[5,0],[4,0],[15,-2],[15,-1],[8,1],[3,-1],[3,0],[4,-1],[3,-1],[7,-1],[5,0],[4,0],[8,1],[6,1],[6,0],[6,0],[5,-1],[14,-3],[11,-2],[7,0],[5,0],[2,0],[2,0],[2,1],[-1,1],[0,1],[4,1],[3,1],[-1,1],[-4,2],[1,1],[2,1],[3,0],[2,1],[13,0],[21,0],[5,0],[0,-1],[3,-1],[1,-1],[30,-5],[7,-1],[2,-1],[1,0],[1,-2],[0,-2],[2,0],[3,-1],[7,0],[30,-2]],[[3397,8428],[-7,-1],[-7,0],[-1,0],[-7,-1],[-9,0],[-13,-1],[-7,0]],[[3346,8425],[-1,1],[0,1],[-1,0],[1,1],[3,0],[3,0],[7,0],[0,1],[-9,0],[0,1],[4,0],[4,1],[12,3],[3,2],[5,1],[5,0],[5,1],[5,-1],[1,0],[2,-3],[3,-1],[1,2],[2,1],[-2,1],[-4,1],[0,1],[3,1],[6,2],[12,2],[-1,-1],[-1,0],[3,-1],[1,0],[1,0],[1,-1],[-1,-2],[-1,-2],[-3,-1],[-1,-1],[0,-1],[1,0],[1,-1],[-1,-1],[0,-1],[-6,0],[-1,0],[-1,-1],[-4,0],[-3,0],[-1,-1],[-1,0],[-1,-1]],[[3440,8450],[-3,0],[-2,0],[-1,1],[-2,1],[-1,0],[0,1],[8,1],[3,-1],[3,-1],[-3,-1],[-1,0],[1,0],[-1,-1],[-1,0]],[[3351,8451],[2,-1],[1,0],[1,-1],[2,0],[3,0],[2,0],[5,-2],[3,-1],[3,-1],[3,0],[4,-2],[2,-1],[-8,-2],[-5,0],[-4,0],[2,0],[7,1],[-2,1],[-1,2],[-2,1],[-4,0],[0,-1],[-3,0],[-4,0],[-4,1],[-1,0],[-2,0],[-3,0],[-1,-1],[-1,0],[0,-1],[1,-1],[-2,-1],[-6,-1],[-2,-1],[2,-1],[3,0],[4,1],[4,1],[-4,-2],[-1,0],[1,-1],[2,0],[1,-1],[-2,-1],[2,0],[-2,-1],[-2,0],[-2,0],[-5,-1],[-1,0],[-1,1],[-3,0],[-3,1],[-2,1],[0,2],[1,2],[3,2],[6,2],[7,1],[-10,0],[-4,1],[-2,1],[-3,-1],[-4,0],[-3,0],[-1,1],[1,1],[3,1],[2,0],[0,2],[1,-1],[3,0],[1,0],[1,1],[1,0],[2,0],[3,0],[-2,1],[-8,2],[3,0],[2,0],[6,0],[2,-1],[2,-1],[6,-1],[2,0],[2,0]],[[3418,8449],[-4,-1],[-14,-3],[-7,0],[-7,1],[-1,0],[3,1],[4,-1],[3,0],[1,1],[-1,1],[-2,0],[-3,0],[-2,0],[-1,-1],[-3,0],[-4,0],[-3,0],[-2,1],[-1,0],[-2,1],[-4,3],[-3,1],[-4,1],[2,1],[0,1],[-1,0],[-2,1],[9,2],[2,1],[-4,0],[-1,0],[2,1],[2,0],[2,1],[3,0],[3,0],[2,-1],[2,0],[10,-1],[8,-1],[6,-2],[5,-2],[5,-2],[0,-1],[1,-2],[1,-1]],[[3347,8464],[2,0],[1,-1],[2,0],[0,-1],[-1,0],[-2,0],[-12,-1],[-3,0],[-4,0],[-5,1],[-1,1],[2,0],[5,1],[1,0],[1,0],[5,0],[2,0],[2,0],[1,0],[0,1],[2,0],[2,-1]],[[3456,8468],[0,-3],[-2,-2],[-11,-3],[4,-1],[4,-2],[-4,0],[-7,1],[-5,0],[-10,-2],[-5,0],[-4,1],[-2,3],[-1,1],[-3,-1],[-2,0],[-5,0],[-6,0],[-5,1],[-4,1],[-2,1],[3,0],[17,1],[1,0],[-2,1],[-1,1],[1,0],[2,1],[2,0],[2,0],[2,0],[2,0],[2,0],[1,0],[2,1],[1,0],[16,0],[1,0],[1,0],[1,0],[2,0],[1,0],[1,1],[2,0],[7,0],[2,0],[1,-1]],[[3362,8469],[1,0],[1,0],[1,0],[2,0],[2,0],[2,-1],[1,-1],[-1,0],[0,-1],[0,-1],[-4,-1],[-1,0],[-2,-1],[-3,0],[-2,0],[0,1],[-1,0],[-3,0],[-3,0],[-3,0],[-1,1],[0,1],[-6,1],[1,1],[4,1],[2,1],[1,0],[0,-1],[1,0],[1,-1],[1,-1],[1,-1],[2,0],[1,1],[1,0],[1,0],[-1,0],[-3,1],[-1,1],[-1,1],[-1,0],[-3,1],[0,1],[3,0],[1,0],[2,0],[4,-1],[2,-1],[-1,0],[2,-1]],[[3322,8474],[1,-1],[-1,0],[-3,-1],[-1,0],[-1,1],[-1,-1],[-1,0],[1,0],[1,0],[1,0],[-1,0],[-1,0],[-3,0],[-1,0],[-2,0],[1,0],[0,1],[-1,0],[1,0],[2,1],[3,0],[1,0],[1,0],[4,0]],[[3383,8475],[-1,0],[-1,-1],[-2,0],[-2,0],[-2,0],[-2,0],[-1,1],[0,-1],[-1,0],[-1,0],[-1,0],[-1,0],[0,1],[2,0],[1,0],[1,0],[1,0],[2,1],[1,0],[1,0],[1,0],[3,0],[2,-1]],[[3323,8487],[1,-2],[-3,-1],[-8,0],[2,0],[7,-1],[2,-1],[2,-1],[1,-1],[0,-1],[1,-1],[-2,-1],[-5,0],[-4,0],[-2,1],[-1,1],[-2,1],[-2,1],[-3,0],[-2,-1],[-5,0],[-7,1],[-4,1],[-2,2],[-1,0],[2,1],[12,0],[3,0],[4,-1],[3,2],[-4,0],[-3,0],[-3,1],[-4,0],[-1,1],[-2,2],[-1,0],[3,2],[-1,0],[-2,1],[-1,0],[-3,2],[1,1],[5,0],[2,0],[1,0],[5,-3],[16,-4],[5,-2]],[[3308,8502],[29,-2],[10,-2],[2,-2],[0,-1],[-3,-1],[-12,-1],[-3,0],[-2,1],[-1,1],[1,0],[3,1],[-12,1],[-4,1],[2,0],[1,0],[1,0],[0,1],[-4,0],[-1,0],[0,1],[-1,0],[-2,1],[-3,0],[-3,-1],[-3,0],[-4,1],[-3,1],[-4,3],[3,-1],[1,0],[1,0],[11,-2]],[[3274,8505],[0,-1],[3,-1],[4,-1],[-1,0],[-1,0],[1,0],[1,-1],[1,0],[1,0],[1,0],[0,-1],[-1,0],[-1,0],[-3,1],[-3,0],[0,-1],[-1,0],[-2,0],[-1,0],[-1,1],[2,0],[-2,0],[-3,1],[-1,0],[-1,0],[0,1],[1,0],[-1,0],[-2,0],[1,0],[7,2],[1,0],[1,0]],[[3261,8510],[1,0],[1,0],[2,0],[2,-1],[-2,-1],[-1,0],[1,-1],[-2,0],[-3,-1],[-5,1],[-4,0],[-1,1],[2,-1],[0,1],[-1,1],[1,0],[1,0],[0,1],[-1,0],[0,1],[-1,0],[0,1],[2,1],[2,0],[2,-1],[2,0],[1,-1],[1,0],[1,0],[0,-1],[-1,0]],[[3459,8498],[-3,0],[-6,0],[-3,0],[-1,-1],[-2,-1],[-19,-1],[-6,1],[-4,0],[-6,2],[-4,0],[-2,1],[-10,2],[-16,3],[4,0],[11,0],[5,1],[1,0],[2,0],[3,1],[10,1],[10,1],[5,1],[7,0],[2,1],[2,1],[0,1],[1,1],[4,1],[6,0],[7,0],[5,-1],[0,-4],[0,-2],[-3,-3],[0,-2],[2,-3],[-2,-1]],[[3229,8522],[2,-1],[2,0],[1,0],[1,0],[1,0],[1,0],[2,0],[1,0],[1,0],[-1,-1],[1,0],[1,0],[-1,-1],[-2,0],[-1,0],[-5,0],[-1,0],[-1,0],[1,0],[1,0],[-2,1],[-1,1],[-1,0],[1,0],[-1,0],[-1,0],[1,1]],[[3881,8515],[21,-2],[5,-1],[4,-2],[2,-1],[12,-5],[2,-2],[1,-1],[-3,-6],[-1,-1],[2,-5],[-1,-1],[-2,-1],[-11,-3],[-13,-7],[-17,-4],[-3,-1]],[[3879,8472],[-10,-5],[-8,-2],[-10,-1],[-21,-2],[-4,0],[-5,-1],[-11,-3],[-3,-1],[-1,-1],[0,-2],[0,-1],[1,-1],[-2,-1],[-1,0],[-13,-3]],[[3791,8448],[-21,0],[-7,0],[-46,-5],[-17,-1],[-7,0],[-3,1],[-2,0],[0,1],[2,1],[3,1],[2,1],[1,1],[0,2],[-2,1],[-2,1],[-5,1],[-6,0],[-6,0],[-9,0],[-7,0],[-11,-1],[-12,-1],[-5,-1],[-16,-1],[-5,-1],[-2,0],[-2,0],[-2,0],[-2,-1],[-3,-1],[-3,-2],[-3,-1],[-9,-3],[-6,-2],[0,-3],[-3,0],[-37,0],[-6,-1],[-2,0],[-6,1],[-2,0],[-7,-1],[-7,-1],[-10,0],[-24,0],[-19,-1],[-14,-1],[-16,0]],[[3425,8431],[2,1],[1,2],[-3,0],[-1,1],[2,2],[4,1],[3,1],[4,1],[7,-1],[4,0],[16,0],[6,-1],[2,-1],[-1,-1],[-2,-2],[6,0],[3,0],[2,1],[0,2],[1,0],[5,1],[7,0],[14,0],[0,1],[-21,-1],[-6,0],[-4,1],[2,1],[10,2],[1,0],[1,1],[2,0],[14,1],[3,0],[1,0],[0,1],[0,1],[3,0],[2,0],[2,-1],[1,0],[2,-1],[12,0],[12,0],[29,4],[2,1],[2,0],[3,0],[2,0],[3,1],[1,1],[17,0],[5,1],[-16,0],[-28,-3],[-20,-3],[-4,0],[-4,-1],[-9,1],[-5,0],[-2,1],[0,1],[2,1],[3,0],[1,1],[-1,2],[1,0],[2,1],[-5,0],[-3,-1],[-1,-2],[-1,-1],[-3,-1],[-7,-1],[-7,0],[-5,-1],[-5,1],[-5,1],[-7,2],[-6,1],[-4,0],[-2,0],[3,2],[-4,-1],[-5,0],[-5,-1],[-3,1],[5,1],[6,0],[11,2],[-1,2],[8,1],[11,1],[9,1],[25,0],[2,0],[1,1],[1,0],[0,1],[-1,0],[-7,1],[15,5],[20,2],[45,2],[0,1],[-5,0],[-2,0],[1,2],[-2,0],[-2,0],[-3,0],[-3,-1],[-1,0],[-4,-1],[-8,-1],[-8,-1],[-6,0],[0,2],[-5,3],[-2,2],[16,1],[3,1],[2,1],[4,1],[6,2],[1,0],[-3,1],[14,1],[4,0],[3,1],[5,1],[2,1],[3,0],[1,0],[0,1],[1,0],[1,0],[2,0],[7,1],[8,1],[6,0],[8,2],[6,1],[8,0],[9,0],[15,-1],[-11,-4],[-5,-2],[1,-2],[-2,-1],[-7,-2],[-2,0],[-2,-6],[-2,-2],[0,-2],[0,-2],[1,-2],[2,0],[0,4],[1,2],[4,2],[7,3],[1,1],[0,1],[-2,1],[6,2],[8,5],[5,2],[4,0],[7,1],[4,1],[7,2],[4,1],[4,1],[5,0],[33,2],[21,-1],[11,0],[6,2],[-48,0],[2,0],[2,0],[2,1],[1,1],[3,0],[2,0],[2,0],[13,4],[-7,0],[-9,-1],[-8,-2],[-6,-1],[-8,-3],[-3,0],[-16,-1],[-9,-1],[-14,-2],[-4,-1],[-6,0],[-6,0],[-3,1],[2,2],[17,2],[5,2],[-11,-1],[-20,-3],[-12,-1],[-7,-1],[-13,-1],[-7,0],[-6,0],[-12,-2],[-5,-1],[-6,0],[-6,1],[-5,1],[-4,1],[-3,3],[-2,0],[-2,0],[-1,-1],[1,-1],[1,0],[2,-1],[5,-2],[5,-1],[2,0],[-1,-1],[-3,0],[-8,1],[-6,-1],[-8,0],[-3,-1],[4,0],[12,0],[-2,-2],[-6,-1],[-3,-1],[2,-1],[1,0],[2,-1],[-2,-1],[-3,-1],[-4,0],[-4,-1],[-5,1],[-11,1],[-5,0],[-5,0],[-2,-1],[-2,-1],[-2,-2],[-8,-2],[-5,-1],[-2,-1],[-3,0],[-4,0],[-3,0],[-2,-1],[0,-1],[4,-3],[1,-3],[-4,-2],[-8,-1],[-9,0],[1,1],[-4,0],[-4,-2],[-4,0],[-7,1],[-2,0],[0,1],[-1,1],[-2,0],[-1,0],[1,2],[3,0],[8,0],[5,0],[5,0],[3,1],[2,1],[-10,0],[-1,0],[-1,0],[-1,-1],[-2,0],[-3,0],[-1,1],[-2,1],[-2,0],[2,0],[4,1],[1,1],[-6,2],[1,1],[4,1],[15,1],[0,1],[-7,0],[-10,-1],[-8,-1],[-7,-1],[0,-1],[-1,-1],[-3,0],[-4,0],[-6,0],[-5,0],[-4,0],[-2,1],[3,1],[4,0],[1,1],[-4,1],[9,1],[16,1],[9,0],[0,1],[-20,0],[-6,-1],[7,2],[3,1],[-2,0],[-4,0],[-3,0],[-3,-1],[-4,-1],[1,1],[3,1],[3,0],[1,1],[1,0],[6,2],[3,1],[1,1],[2,1],[1,1],[4,0],[9,1],[3,0],[1,1],[-5,0],[-5,-1],[-2,0],[-3,0],[-3,-1],[-3,0],[-2,-1],[-1,1],[-1,0],[-3,-1],[-5,-1],[-3,-2],[-1,-1],[-3,-1],[-9,-4],[0,-1],[-3,0],[-10,-2],[-8,-1],[-3,-1],[-1,0],[-1,-1],[-2,-1],[-5,1],[-8,1],[3,0],[1,0],[0,1],[-12,1],[-4,0],[3,1],[2,0],[7,1],[-8,1],[-16,-1],[-6,0],[17,3],[3,1],[-8,0],[-25,1],[-2,0],[0,1],[1,1],[1,1],[3,0],[4,0],[7,0],[-4,1],[-3,0],[-10,1],[-2,0],[-2,0],[2,1],[7,2],[21,0],[7,1],[-3,0],[-8,2],[2,1],[1,1],[-6,1],[0,1],[10,3],[6,0],[7,-1],[7,-1],[5,-1],[2,0],[12,-3],[7,-1],[12,-1],[10,0],[11,0],[8,1],[-1,1],[4,1],[6,0],[4,1],[1,1],[0,1],[-1,3],[0,2],[1,3],[2,3],[5,1],[-4,1],[0,1],[3,1],[3,1],[-5,0],[-5,-1],[-10,0],[-1,1],[2,1],[4,1],[2,1],[-5,0],[-3,-1],[-3,-1],[-4,-1],[-3,0],[-4,-1],[-2,0],[-3,0],[-11,0],[-2,-1],[3,-3],[-2,-1],[-6,0],[-14,-1],[-17,-3],[-16,-1],[-6,0],[-6,0],[-6,1],[-8,1],[-7,2],[-15,2],[-3,1],[9,0],[8,-1],[16,-2],[1,0],[-16,4],[-18,3],[4,0],[11,-1],[-5,2],[-7,0],[-8,0],[-7,1],[-11,3],[-6,1],[-8,0],[6,1],[7,0],[7,0],[11,-2],[12,-1],[9,-1],[7,-1],[24,-1],[6,-1],[-1,-1],[2,-2],[4,-1],[5,-1],[5,-1],[-2,1],[-1,0],[-1,1],[5,0],[9,-2],[5,0],[-4,1],[-6,1],[-5,1],[2,1],[4,0],[7,-2],[2,0],[-1,1],[-2,1],[-3,0],[1,1],[-7,1],[-3,0],[-1,1],[0,1],[-1,0],[-2,0],[-10,0],[-6,1],[-7,0],[-2,1],[-2,0],[0,1],[6,1],[5,0],[10,1],[6,0],[-4,2],[5,1],[17,2],[4,-1],[4,0],[4,0],[4,0],[3,0],[6,1],[-7,0],[-6,1],[-2,1],[5,1],[-5,-1],[-17,-2],[-12,0],[-5,-1],[-2,-1],[-6,-2],[-13,0],[-12,0],[-4,2],[-1,-1],[-4,-1],[-4,-1],[-3,1],[3,1],[-4,0],[-2,0]],[[3326,8525],[2,1],[6,3],[6,3],[8,1],[16,1],[3,0],[5,0],[14,-1],[15,0],[18,1],[6,0],[10,1],[14,2],[17,-1],[7,0],[6,0],[4,1],[4,0],[16,-2],[33,5],[2,0],[3,0],[3,0],[3,-1],[2,0],[1,0],[1,-1],[2,0],[2,0],[6,-1],[2,0],[1,-1],[0,-1],[1,-1],[2,0],[14,-2],[17,-1],[4,0],[4,0],[9,1],[35,2],[2,0],[1,0],[-3,-1],[1,-1],[2,0],[7,-1],[5,1],[6,0],[9,1],[3,1],[3,1],[2,0],[3,0],[3,0],[4,0],[8,-1],[3,-1],[16,0],[2,0],[1,-1],[-2,0],[-17,-2],[-3,-1],[-3,-1],[1,0],[3,-1],[4,0],[23,-1],[3,0],[2,-1],[-1,-1],[-1,-1],[0,-1],[1,0],[18,0],[3,0],[2,0],[2,-1],[1,-1],[1,-1],[116,-4]],[[3444,8399],[3,0],[3,0],[3,0],[7,-1],[5,0],[5,1],[4,0],[6,-1],[3,0],[0,-1],[0,-2],[-6,0],[-20,2],[-15,1],[-6,1],[2,0],[2,0],[4,0]],[[3506,8402],[-3,-1],[-2,0],[-2,-1],[-1,0],[-4,0],[-3,0],[-3,0],[-2,0],[-2,0],[-2,1],[1,0],[-1,1],[2,0],[1,0],[2,-1],[1,1],[2,0],[-1,0],[0,1],[2,0],[0,1],[1,0],[2,0],[2,0],[3,0],[4,-1],[3,0],[1,-1],[-1,0]],[[3407,8401],[-2,0],[-2,0],[-1,1],[1,0],[-1,0],[-1,0],[-1,0],[-6,1],[-3,1],[-1,1],[-1,1],[1,0],[1,1],[3,0],[2,0],[2,0],[3,0],[1,0],[2,-1],[3,0],[2,-1],[1,-1],[1,0],[-1,-1],[-3,-2]],[[3536,8406],[-11,0],[-6,1],[0,2],[5,1],[8,1],[7,0],[13,-1],[7,0],[-2,-1],[-9,-2],[-12,-1]],[[3279,8413],[0,-1],[1,0],[-5,-1],[-1,0],[-1,0],[-3,0],[-1,1],[-1,0],[1,1],[2,0],[1,0],[1,0],[1,0],[2,0],[3,0]],[[3367,8411],[3,-1],[5,0],[1,-2],[0,-2],[-4,-1],[-1,-3],[-8,-1],[-6,-1],[-7,0],[-5,1],[-2,1],[-3,2],[0,1],[2,2],[0,1],[0,1],[-2,1],[3,1],[12,-1],[-11,3],[-2,1],[0,1],[3,1],[3,0],[2,1],[-5,1],[-2,1],[2,1],[5,0],[9,-3],[2,-2],[2,0],[2,-1],[2,0],[1,-1],[-1,-1],[-1,-1],[1,0]],[[3791,8448],[3,-2],[2,-2],[3,-1],[4,-1],[23,-2]],[[3756,8405],[-7,-2],[-6,-1],[-2,0],[0,-1],[2,-1],[-2,-1],[-3,0],[-8,-2],[-7,-1],[-4,-1],[-3,-1],[-3,-1],[-44,-8],[-2,-1],[-1,0],[1,-1],[3,-1],[1,-1],[0,-1],[-1,-1],[-10,-4],[-4,-2],[1,0],[3,0],[7,-1],[3,-2],[6,-1],[-1,-1],[-3,-1],[-7,-1],[-23,-1],[-3,-1],[6,-2],[4,0],[13,0],[7,-1],[3,0],[1,-1],[0,-1],[2,-2],[0,-1],[-1,-1],[-1,-1],[1,-1],[8,-8],[1,-1],[-1,-1],[-3,-2],[-4,-1],[-5,0],[-3,-1],[-3,0],[-26,-2],[-7,-1],[-3,0]],[[3628,8336],[-11,1],[-14,1],[-2,1],[-4,0],[-4,0],[-4,0],[-3,1],[-3,0],[-15,1],[-13,1],[-5,1],[-3,0],[-7,1],[-2,0],[-2,0],[-5,1],[-1,1],[-1,1],[-1,1],[0,1],[-1,1],[-2,1],[-6,0],[-22,0],[-9,1],[-5,2],[-8,0],[-9,0],[-13,2],[1,1],[-9,2],[-10,3],[-5,3],[-6,2],[-1,1],[-3,1],[-7,2],[4,1],[8,1],[2,1],[1,2],[0,1],[-1,2],[-2,1],[2,0],[4,0],[2,1],[2,1],[-2,0],[-3,1],[-2,2],[-1,0],[0,1],[2,0],[3,-1],[2,0],[7,-2],[5,-1],[2,2],[-2,1],[-6,1],[-10,1],[2,1],[3,0],[2,0],[3,0],[-3,1],[-9,-1],[-4,1],[3,0],[1,1],[2,2],[39,-4],[-2,-2],[-2,-3],[1,-2],[3,-1],[4,4],[5,0],[11,0],[4,1],[0,1],[1,1],[7,0],[3,0],[4,-1],[8,-1],[4,0],[5,-2],[3,-1],[29,-4],[10,-1],[22,1],[-6,0],[-20,1],[-4,0],[-5,1],[-4,1],[-1,1],[1,1],[3,1],[7,2],[5,1],[16,1],[101,5],[0,1],[-64,-2],[-13,-2],[-32,-1],[-8,-1],[-22,-6],[-12,4],[-2,1],[3,1],[5,1],[6,0],[4,0],[-3,1],[-4,1],[-3,0],[-4,0],[-9,0],[-4,0],[-5,0],[-5,2],[-4,1],[-1,2],[5,1],[7,1],[23,1],[7,0],[14,1],[4,0],[-9,1],[-12,-1],[-7,0],[5,2],[8,3],[4,0],[11,2],[10,2],[19,1],[17,3],[11,0],[21,0],[-28,0],[-6,0],[-26,-3],[-12,-1],[-9,1],[-7,2],[36,0],[0,1],[-3,1],[-3,0],[-3,1],[-1,-1],[-2,-1],[-4,0],[-1,1],[-2,0],[-2,0],[-1,0],[-3,-1],[-2,0],[-3,0],[-2,0],[-2,0],[-3,0],[-3,1],[-1,1],[-1,1],[-1,-2],[-4,0],[-5,0],[-5,0],[3,1],[2,1],[1,0],[2,1],[3,1],[3,0],[6,1],[11,1],[6,1],[5,1],[1,0],[2,-1],[1,1],[2,0],[3,1],[1,1],[0,1],[1,1],[5,1],[43,3],[28,1],[-10,1],[-39,-2],[-15,-2],[-8,0],[3,1],[3,1],[3,2],[2,1],[0,1],[1,2],[2,1],[3,1],[-6,-1],[-4,-1],[-3,-3],[-1,-2],[-1,0],[-2,-1],[-5,-2],[-4,-1],[-9,-3],[-2,-1],[-3,0],[-10,-2],[-4,-1],[-9,-1],[-3,0],[-5,0],[-2,2],[-4,0],[2,-1],[-2,0],[-2,0],[-1,0],[0,-1],[2,0],[2,0],[1,-1],[1,0],[-11,-2],[-5,0],[-3,1],[-1,1],[-2,0],[-2,1],[-1,0],[-1,1],[0,1],[1,1],[8,0],[54,3],[-5,1],[-6,0],[-8,-1],[-11,-1],[-29,1],[-3,0],[-4,0],[-2,1],[-3,1],[-2,0],[-1,0],[-3,2],[-1,0],[-3,0],[-4,-1],[-3,0],[6,-2],[1,-1],[-2,-1],[-5,-1],[-7,-1],[-6,1],[-3,1],[1,-2],[-4,-1],[-11,-1],[4,-1],[16,2],[7,0],[5,0],[4,-1],[12,-2],[1,-1],[0,-2],[-3,0],[-14,0],[-5,0],[-3,-1],[-3,0],[-8,0],[-1,0],[0,-1],[-1,0],[-3,-1],[-1,0],[-3,0],[-10,-1],[-2,0],[-1,1],[2,1],[3,0],[4,0],[0,1],[-6,2],[-4,2],[-4,2],[-6,0],[2,-1],[2,0],[1,0],[-1,-2],[-1,-3],[-2,-1],[-4,-1],[-5,-2],[-5,0],[-7,0],[-5,1],[-5,1],[-2,2],[1,1],[2,2],[1,1],[-2,1],[-5,0],[-2,-2],[0,-1],[0,-3],[0,-1],[-1,-1],[-2,0],[-3,0],[-1,1],[-1,1],[-1,1],[-3,2],[-1,0],[2,2],[0,1],[-1,1],[-1,0],[-3,0],[-1,0],[0,-4],[-8,-1],[-16,6],[-6,0],[-2,1],[-1,2],[0,1]],[[3397,8428],[0,-1],[2,0],[1,0],[3,0],[2,1],[15,1],[2,0],[3,1],[0,1]],[[3260,8532],[1,0],[7,0],[3,0],[3,0],[-1,0],[-2,0],[1,-1],[3,0],[2,-1],[6,-2],[1,0],[-1,-1],[2,0],[-1,0],[-2,0],[-4,0],[-5,0],[-1,1],[0,1],[-1,0],[-1,0],[-1,0],[-4,0],[-2,0],[-1,1],[0,1],[-1,0],[-1,0],[-1,0],[-2,0],[-2,0],[-2,0],[-2,0],[-1,0],[1,0],[-1,1],[-1,0],[1,0],[3,1],[10,0],[2,0],[-2,-1],[-3,0]],[[3240,8539],[0,-1],[-1,-1],[-3,0],[-3,-1],[-1,1],[1,1],[0,1],[-2,-1],[-2,-1],[-2,0],[-2,0],[-1,1],[-1,1],[-2,0],[-2,0],[0,1],[-1,1],[1,0],[-1,0],[0,1],[4,0],[1,0],[1,0],[1,1],[1,0],[3,0],[2,0],[2,0],[0,-1],[2,0],[-1,-1],[2,-1],[3,0],[1,-1]],[[3320,8545],[-2,0],[-11,1],[-2,0],[-1,3],[-1,0],[2,0],[6,0],[8,-2],[1,-1],[0,-1]],[[3276,8548],[1,-1],[2,1],[0,1],[-1,1],[2,0],[2,0],[2,0],[2,0],[-1,1],[-1,0],[-1,0],[3,0],[2,0],[2,0],[2,-1],[6,-4],[0,-1],[-4,-1],[-10,-1],[-4,-1],[-3,-1],[-3,1],[-2,2],[-4,1],[0,-1],[-7,-1],[-2,0],[-1,-1],[-1,-1],[-2,0],[-1,1],[0,1],[0,3],[0,1],[-1,0],[-1,1],[1,1],[6,0],[3,0],[5,-2],[2,-1],[2,1],[0,1],[-6,4],[4,0],[3,0],[3,-3],[1,-1]],[[3240,8561],[0,-1],[1,0],[1,-1],[5,0],[2,0],[1,0],[-2,-1],[-2,0],[-1,0],[-3,1],[-10,-1],[-1,1],[-1,0],[-1,0],[0,1],[3,0],[-1,0],[1,0],[1,0],[0,1],[2,0],[2,0],[3,0]],[[3268,8564],[1,0],[0,-1],[-6,-1],[-1,0],[-2,1],[2,0],[3,1],[2,0],[1,0]],[[3293,8576],[1,0],[1,0],[1,-1],[1,0],[1,0],[1,1],[1,0],[0,-1],[-2,0],[-3,-1],[-3,0],[-2,0],[-1,1],[-2,0],[-2,0],[-1,0],[1,1],[-3,0],[2,0],[-1,0],[0,1],[1,0],[1,0],[1,0],[3,-1],[1,0],[1,0],[2,0]],[[3273,8582],[4,-1],[1,0],[-3,0],[-18,-1],[-1,0],[-1,0],[-2,0],[-1,1],[1,0],[3,0],[2,0],[4,1],[3,0],[1,0],[-1,1],[-1,0],[-1,1],[3,1],[-1,0],[1,0],[2,-2],[5,-1]],[[3279,8587],[0,-1],[0,-1],[0,1],[-1,0],[-2,0],[-2,0],[-4,0],[-2,0],[-1,0],[-1,0],[-2,1],[-1,0],[-1,1],[0,1],[2,0],[2,0],[2,0],[1,1],[2,0],[2,0],[0,-1],[1,0],[2,-1],[1,0],[2,-1]],[[3273,8593],[-8,-1],[-1,1],[-1,0],[1,0],[1,0],[1,1],[-2,0],[-3,1],[-7,0],[-1,1],[1,0],[10,1],[2,0],[5,-1],[3,-1],[0,-1],[-1,-1]],[[3290,8604],[64,-4],[-5,-1],[-6,-1],[-14,0],[3,0],[2,1],[0,1],[-3,1],[-8,-3],[-9,-1],[-10,-1],[-22,-1],[-6,0],[-5,1],[0,1],[2,0],[5,0],[2,0],[1,1],[3,0],[-6,0],[-16,1],[-7,0],[5,1],[5,1],[5,1],[0,1],[10,1],[10,0]],[[3317,8612],[3,0],[1,0],[1,0],[3,1],[5,0],[3,0],[4,-2],[-1,-1],[-2,0],[-2,-2],[-1,0],[-1,-1],[-2,-1],[-4,0],[-5,0],[-8,0],[-2,0],[-3,1],[-1,0],[0,1],[2,0],[3,0],[2,0],[1,0],[1,0],[0,1],[-13,2],[-3,1],[0,1],[0,1],[2,0],[4,-1],[13,-1]],[[3846,8615],[5,0],[2,-1],[2,0],[4,-1],[3,0],[2,-2],[0,-2],[-3,-4],[0,-2],[0,-1],[7,-3],[10,-4],[6,-2],[7,0],[55,0],[19,0],[7,-1],[5,0],[4,-1],[1,-1],[1,-3],[1,-1],[1,-1],[3,-1],[4,-2],[9,-2],[3,-1],[47,-3],[16,-3],[8,-3],[-33,-1],[-6,0],[0,-2],[2,-1],[5,-1],[5,-1],[3,-2],[-17,-4],[-18,-3],[-2,-1],[-1,0],[2,-1],[4,-2],[27,-6],[3,-2]],[[4049,8543],[-1,-4],[-4,-1],[-4,0],[-3,-1],[-6,-1],[-10,-2],[-9,-2],[-13,0],[-8,0],[-5,0],[-13,0],[-23,-3],[-8,-2],[-12,-4],[-1,-1],[-1,-1],[-2,-1],[-5,0],[-6,0],[-9,-1],[-25,-4]],[[3326,8525],[-9,0],[-5,1],[-1,1],[-3,2],[-2,1],[-1,0],[-1,1],[0,1],[-1,0],[-5,1],[-1,1],[2,0],[5,1],[6,-1],[5,0],[4,-1],[2,0],[-1,-3],[1,-1],[2,-1],[2,0],[1,1],[-2,4],[0,1],[4,0],[4,1],[3,0],[-1,2],[-1,-1],[-1,0],[-2,0],[-7,-1],[-3,0],[-13,1],[-3,0],[-2,1],[0,1],[1,2],[2,1],[12,2],[16,0],[16,-1],[18,-2],[7,0],[15,-1],[11,0],[3,0],[1,0],[1,-1],[1,-1],[3,0],[2,1],[-1,0],[-2,1],[0,1],[1,1],[3,0],[4,1],[9,1],[9,0],[10,-1],[7,0],[-7,1],[-3,1],[1,0],[9,0],[4,0],[4,0],[5,1],[10,0],[8,1],[4,-1],[-2,-2],[0,-1],[3,0],[3,1],[3,1],[3,0],[3,0],[-2,1],[-1,0],[7,1],[7,0],[20,0],[8,0],[4,0],[16,0],[8,0],[15,-1],[8,0],[7,-1],[3,-1],[-1,-1],[-6,-1],[7,0],[3,0],[4,1],[2,0],[4,0],[4,0],[3,0],[3,-1],[-2,0],[-3,-2],[-3,-1],[4,0],[4,0],[0,1],[1,1],[2,1],[7,1],[6,1],[6,1],[13,0],[6,1],[5,1],[4,2],[2,2],[2,0],[3,0],[5,-1],[3,0],[32,-1],[12,0],[3,-1],[1,0],[1,-1],[0,-1],[1,-1],[1,0],[3,0],[14,0],[4,0],[2,-1],[4,-2],[4,-2],[2,0],[0,-1],[-1,-1],[-4,-1],[-4,0],[-7,-1],[-15,-2],[21,2],[11,0],[9,0],[15,-2],[4,-1],[0,-1],[-6,-4],[6,1],[6,2],[3,2],[-2,2],[-2,0],[-12,0],[-2,1],[-3,0],[-9,4],[-2,1],[-2,0],[-3,1],[-2,2],[-1,1],[4,1],[10,0],[25,0],[7,2],[3,0],[3,1],[19,-1],[3,0],[5,-1],[7,-1],[16,0],[-4,0],[-4,0],[-2,1],[-9,1],[-2,1],[3,0],[11,2],[2,0],[3,1],[6,0],[36,1],[11,1],[10,1],[-8,0],[-7,0],[-8,-1],[-35,-1],[-14,0],[-7,0],[-3,2],[-1,2],[-1,1],[0,1],[-2,0],[-2,0],[-2,0],[0,2],[10,1],[3,2],[1,1],[2,1],[10,1],[3,1],[4,2],[3,1],[5,0],[6,0],[5,1],[5,1],[4,1],[-20,-2],[-33,-5],[-5,0],[-9,0],[-5,0],[4,0],[4,-1],[2,-1],[-1,-1],[-14,-3],[-1,-1],[5,-1],[5,-1],[4,-1],[3,-3],[3,-1],[4,0],[4,-1],[-9,-1],[-4,-1],[-3,0],[-2,0],[-6,1],[-1,0],[-4,1],[-1,0],[-4,0],[-9,-1],[-3,0],[-1,0],[0,-1],[-1,0],[-1,-1],[-3,0],[-30,-1],[-8,-1],[-5,-1],[-4,1],[-4,1],[5,1],[9,2],[6,1],[-12,-1],[-7,-1],[-7,0],[-19,2],[-34,1],[-25,2],[3,1],[8,1],[4,1],[9,4],[2,0],[5,1],[1,1],[2,2],[1,0],[2,1],[-1,1],[-3,0],[-1,0],[-14,-7],[-8,-2],[-9,-1],[-2,0],[-4,1],[-2,0],[-2,0],[-3,0],[-2,-1],[3,-1],[3,-2],[0,-1],[3,-1],[-16,1],[-1,0],[3,-1],[2,0],[3,-1],[1,0],[0,-1],[1,-1],[0,-1],[-3,-1],[-2,0],[-12,-1],[-15,0],[-21,0],[-18,2],[-7,3],[-10,-2],[-14,-1],[-13,0],[-13,1],[11,1],[5,1],[2,1],[-23,-2],[-15,-1],[-16,0],[-5,0],[-1,2],[0,1],[-2,-1],[-2,0],[-1,-2],[-2,0],[-3,0],[-5,0],[-3,0],[-2,-1],[-5,0],[-27,-1],[-5,0],[-14,-3],[-13,-1],[-11,0],[-9,1],[-9,3],[-4,-1],[-5,-1],[-13,0],[-1,0],[-1,0],[-3,0],[-2,1],[-1,1],[-2,0],[2,1],[4,0],[5,-1],[5,1],[-6,0],[-5,1],[-5,0],[-4,-1],[-4,0],[-16,1],[-3,0],[3,2],[14,0],[25,-2],[-1,1],[-1,0],[0,1],[8,0],[-12,2],[-7,1],[-7,0],[-28,-1],[-7,1],[4,0],[6,0],[5,1],[2,0],[-7,0],[-5,0],[-3,0],[-2,1],[-2,0],[-2,0],[-4,0],[2,1],[4,1],[8,0],[6,1],[5,0],[3,0],[3,1],[2,0],[10,0],[5,0],[4,2],[6,1],[6,-1],[5,0],[4,0],[3,-1],[2,-1],[2,-1],[3,-2],[2,-1],[4,0],[0,1],[0,1],[-2,2],[-2,1],[-3,1],[-8,0],[-4,1],[43,1],[45,0],[-7,1],[-11,0],[-91,-1],[-3,-1],[-6,-1],[-8,0],[-8,-1],[-5,0],[-3,1],[-4,1],[-3,1],[1,1],[3,1],[4,1],[4,0],[2,-1],[1,-1],[1,0],[4,1],[-1,1],[1,1],[1,0],[8,0],[0,1],[-1,0],[-5,-1],[-5,0],[-10,0],[-9,0],[-10,0],[26,2],[25,1],[5,1],[-1,0],[8,0],[12,-1],[10,-1],[6,2],[35,-3],[8,0],[6,1],[-2,0],[5,0],[10,1],[4,0],[2,1],[3,0],[3,1],[3,0],[11,0],[6,0],[3,-1],[5,-1],[2,0],[6,0],[-6,1],[-8,2],[-6,0],[-13,0],[-6,0],[-6,-1],[-7,-1],[-2,0],[-12,0],[-8,-1],[-7,0],[-5,0],[1,2],[-11,0],[-25,0],[-8,1],[-18,1],[-9,1],[2,1],[-2,1],[4,0],[11,0],[2,0],[8,0],[26,0],[0,1],[-6,0],[-37,2],[-6,0],[44,0],[-4,0],[-2,0],[0,-1],[22,0],[5,1],[-18,1],[-18,1],[11,1],[5,1],[-13,0],[-10,-1],[-3,0],[-55,0],[-6,0],[-1,1],[-5,2],[-1,0],[2,1],[2,1],[3,0],[-2,0],[1,1],[2,1],[4,0],[-1,0],[-1,1],[-2,0],[4,0],[3,1],[8,0],[4,0],[4,-1],[1,0],[1,-1],[1,0],[4,0],[1,0],[4,-1],[1,0],[3,0],[2,0],[5,1],[-8,1],[-2,1],[5,0],[10,1],[-30,-1],[4,1],[6,1],[6,1],[27,2],[6,0],[-2,1],[-2,0],[10,0],[9,0],[-4,1],[-4,0],[-2,0],[-1,1],[2,0],[15,3],[8,1],[21,-1],[9,0],[4,0],[9,0],[5,0],[8,-1],[9,0],[4,-1],[6,-1],[6,-1],[-7,-1],[-9,0],[-8,0],[-5,-2],[7,0],[20,2],[44,1],[4,0],[2,-1],[-1,-1],[-1,-1],[-3,-2],[-6,-2],[0,-1],[4,1],[3,0],[3,1],[3,1],[2,3],[2,1],[4,0],[5,0],[11,-2],[9,-2],[6,-1],[14,0],[-3,1],[-3,0],[-5,1],[-3,0],[-3,1],[-4,1],[-4,0],[-4,0],[0,1],[54,0],[5,0],[11,-2],[6,0],[21,0],[7,0],[4,0],[3,1],[4,2],[4,1],[5,1],[6,0],[6,0],[6,0],[13,-1],[6,0],[2,-1],[2,0],[3,-1],[2,1],[4,1],[2,0],[2,1],[-4,0],[-7,0],[-4,0],[-3,0],[-11,1],[-1,0],[-2,0],[-1,1],[-2,-1],[-2,0],[-1,0],[-24,-1],[-4,-1],[-3,-1],[-3,-1],[-8,-1],[-51,3],[-38,-1],[-4,0],[-10,2],[-4,0],[-14,0],[-13,0],[-4,1],[-4,-1],[-6,0],[-4,0],[-1,-1],[-3,0],[-1,0],[-2,0],[-16,2],[0,1],[48,0],[6,0],[0,1],[-74,1],[-30,1],[-15,-1],[-2,0],[-1,0],[-3,1],[-18,-1],[-11,-1],[-6,-1],[-13,1],[-6,0],[-6,-1],[-3,-1],[-5,1],[-9,1],[4,1],[3,1],[3,2],[4,0],[1,0],[1,-1],[2,0],[2,0],[2,1],[1,0],[2,0],[2,0],[3,-1],[1,0],[2,0],[1,1],[2,1],[9,1],[3,0],[2,2],[7,0],[8,-1],[6,1],[-3,1],[-4,0],[-7,0],[-3,0],[-3,1],[-4,1],[-21,3],[-23,0],[-4,1],[2,0],[2,0],[4,1],[-4,0],[-7,1],[-2,1],[1,0],[3,1],[1,0],[-1,0],[-1,1],[-1,0],[1,0],[3,0],[7,0],[1,0],[2,0],[2,0],[0,1],[5,1],[3,0],[7,-1],[7,-1],[3,-1],[1,0],[2,0],[2,0],[0,-1],[-2,-1],[1,-1],[11,-2],[17,-1],[14,-2],[2,-4]],[[3680,8332],[2,0],[1,0],[0,-1],[-1,-1],[-1,0],[-1,0],[-1,0],[-6,0],[-1,0],[-6,2],[-1,0],[1,0],[0,-1],[-2,0],[-2,0],[-2,0],[0,1],[-1,0],[0,1],[-1,0],[-1,0],[1,0],[21,0],[1,-1]],[[4055,8327],[0,-1],[0,-1],[-5,-1],[-3,1],[-4,1],[-3,0],[-5,-2],[-3,-1],[-3,0],[-3,0],[-8,1],[-3,0],[-1,0],[-3,1],[-2,1],[6,0],[4,1],[3,0],[-5,2],[-3,1],[-4,2],[-6,0],[4,-2],[1,-1],[-1,-1],[-3,-2],[-13,-1],[-4,-2],[5,-1],[-10,-1],[-37,0],[-10,-1],[-4,0],[-8,0],[-2,0],[2,-1],[-5,0],[-1,0],[-2,0],[0,-1],[-3,-1],[-5,0],[-4,2],[0,-1],[0,-1],[-44,0],[-28,1],[-4,1],[0,1],[-14,-1],[-4,-1],[-2,1],[-3,0],[-17,-1],[0,-1],[-1,0],[0,-1],[-2,0],[-2,0],[-8,-1],[-4,0],[-3,0],[2,1],[-1,2],[5,1],[8,0],[5,1],[3,1],[2,-1],[2,0],[2,0],[2,0],[4,2],[2,0],[0,1],[-5,0],[-15,-2],[-3,0],[-4,-1],[-18,-1],[-5,0],[4,1],[6,2],[4,1],[-4,0],[-13,-3],[-5,-1],[1,1],[2,1],[0,1],[-1,1],[-3,-1],[-4,0],[-3,-1],[-4,0],[-4,1],[-4,0],[-3,1],[11,1],[5,0],[18,0],[6,1],[4,1],[-7,0],[-13,-1],[-7,0],[-6,1],[-11,3],[-6,0],[8,-4],[-1,-1],[-12,0],[-6,0],[-3,1],[2,1],[0,1],[-1,1],[0,1],[-5,-4],[-3,-1],[4,0],[1,0],[2,-1],[1,0],[3,-1],[4,0],[5,-1],[2,0],[0,-1],[-4,0],[-2,0],[-5,0],[-3,0],[-24,0],[-5,1],[-13,2],[-3,1],[5,0],[4,1],[3,1],[1,2],[3,0],[13,1],[5,0],[-3,0],[-2,0],[5,2],[12,1],[9,2],[19,1],[-4,1],[-6,-1],[-11,-1],[-13,-2],[-4,0],[-3,1],[-7,2],[-2,1],[2,1],[4,1],[4,0],[5,-1],[3,2],[-5,1],[-5,-1],[-6,0],[-5,0],[0,-4],[2,-2],[-15,0],[-15,2],[-23,1],[-1,0]],[[4909,8455],[-6,-1],[-1,-3],[2,-1],[7,-1]],[[4911,8449],[-19,0],[-12,-1],[-6,-1],[-2,-1],[-1,-1],[-1,-1],[-1,0],[-2,-1],[-2,-1],[-3,0],[-8,-1],[-6,-1],[-21,-4],[-6,0],[-1,0],[-1,0],[3,2],[0,1],[-2,0],[-3,1],[-3,1],[-2,0],[-4,0],[-5,0],[-5,1],[-6,2],[-4,2],[-16,2],[-5,-1],[-2,-1],[0,-2],[-1,-2],[-10,0],[-29,0],[-16,1],[-9,0],[-1,-1],[-3,-2],[-3,-1],[-1,0],[-6,-1],[-5,-1],[-2,-1],[-8,-2],[-3,-1],[-6,-1],[-2,-1],[-4,-1],[-2,-1],[-4,-1],[-8,-2],[-1,0],[-2,0],[-7,-1]],[[4632,8425],[-2,1],[-2,0],[-2,1],[-3,1],[-1,2],[0,2],[2,1],[-4,2],[-3,1],[-2,2],[-1,3],[-4,-1],[-5,1],[-3,2],[0,2],[4,1],[5,4],[3,1],[10,2],[6,-2],[4,-4],[5,-3],[2,3],[4,3],[3,2]],[[4648,8452],[9,-1],[19,0],[7,0],[2,1],[4,1],[0,1],[0,8],[-1,1],[-16,3],[-17,5],[-5,2],[-3,0],[-5,1],[-12,1]],[[4630,8475],[6,0],[4,1],[4,-1],[2,0],[1,1],[5,3],[6,3],[4,1],[22,6],[2,0],[0,1],[0,1],[-15,3],[-6,1],[-5,1],[-28,0],[-1,0],[-1,1],[1,1],[3,1],[4,2],[0,1],[4,1],[4,-1],[3,0],[6,-1],[2,-1],[15,0],[55,3],[3,0],[1,1],[1,0],[0,1],[0,1],[1,1],[1,1],[8,1],[1,0]],[[4743,8509],[5,-1],[2,-1],[5,-1],[2,-2],[1,-1],[1,-1],[1,-1],[1,0],[11,-1],[4,0],[11,-3],[6,-2],[3,-1],[9,-4],[19,-3],[17,-3],[1,-1],[1,-1],[-4,-3],[1,-2],[1,0],[3,-1],[6,-1],[27,-3],[19,-4],[5,0],[1,-1],[-1,-2],[0,-1],[-2,0],[0,-1],[2,-5],[2,-1],[2,-1],[1,-1],[3,0]],[[4616,8475],[-12,-6],[-4,-1],[-5,-1],[-10,0],[-12,-1],[-13,-4],[-2,-1],[1,-2],[-3,-3],[-3,-2],[-1,-2],[0,-1],[3,-1],[9,-1],[9,0],[11,0]],[[4584,8449],[0,-1],[0,-3],[2,-2],[2,-1],[4,-2],[5,-1],[5,0],[5,-1],[4,-1],[2,-2],[1,-1],[-5,-2],[-11,-3],[-14,-2],[-11,1],[-3,1],[-1,1],[2,4],[-3,3],[-1,1],[-1,1],[-1,1],[-1,0],[-6,1],[-1,1],[-2,0],[-2,0],[-1,0],[-4,0],[-8,1],[-7,1],[-6,0],[-4,-1],[3,0],[5,-2],[3,0],[3,0]],[[4537,8441],[-1,-1],[-26,1],[-9,-1],[-14,-1],[-4,1],[-5,0],[-19,-3],[-5,-1],[0,-1],[1,-1],[2,0],[11,-2],[9,-2],[9,-3],[0,-1],[-4,0],[-7,0],[-55,0],[-2,-1],[2,-4]],[[4420,8421],[-24,1],[-11,1],[-2,1],[-7,1],[-5,2],[-3,0],[-3,0],[-13,0],[-3,1],[-1,0],[0,1],[2,0],[3,1],[2,1],[-1,0],[-5,1],[-3,1],[-5,4],[-5,3],[-4,1],[-5,1],[-4,1],[-3,0],[-1,1],[-1,1],[1,1],[1,2],[1,1],[-12,2],[-11,0],[-14,1],[1,2],[-1,3],[-4,1],[-1,0],[1,0],[-1,1],[-2,1],[-8,1],[-5,1],[-22,1],[-6,2],[-4,2],[-5,4],[-6,2],[-3,0],[-18,2],[-8,1],[-93,1],[-8,0],[-23,1],[-13,0],[-12,0],[-66,-4],[-15,-1],[-27,1],[-20,0],[-36,-2]],[[4049,8543],[15,2],[4,1],[14,-3],[11,-1],[17,-2],[26,-2],[8,0],[2,-1],[1,0],[1,-1],[2,-1],[1,0],[7,-2],[18,-1],[36,-1],[18,-3],[57,-5],[15,-1],[5,-1],[3,0],[2,-1],[1,-1],[-1,-1],[0,-2],[17,-5],[3,-1],[1,-3],[7,-1],[8,-1],[25,0],[6,0],[3,-1],[2,-1],[2,-1],[5,-1],[21,-1],[19,-1],[-1,1],[-5,4],[0,1],[1,1],[3,1],[5,1],[19,1],[3,0],[2,1],[-1,1],[-2,0],[1,1],[1,0],[24,0],[8,-2],[3,-1],[3,-2],[9,-2],[6,-2],[3,-2],[8,-7],[2,-1],[3,-2],[16,-5],[6,-2],[11,-3],[5,0],[37,-4],[15,-2]],[[5004,8637],[1,-1],[7,-4],[0,-1],[1,-3],[-19,-18],[-18,-19],[3,-1],[27,-5],[11,-1],[19,-4],[6,0],[9,-1],[16,0],[8,0],[7,-1],[61,-13],[3,-1],[0,-1],[-8,-7],[-3,-2],[-5,-2],[-17,-4],[-2,0],[-1,-1],[-5,-5],[0,-1],[-2,0],[-5,-1],[-26,1],[-14,0],[-54,-3],[-6,-1],[0,-1],[9,-4],[5,-2],[5,-5],[3,-3],[7,-3],[24,-7],[26,-11],[4,-2],[1,-2],[-2,-3],[-3,-2],[-3,-1],[-5,-1],[-13,-3],[-3,-1],[-1,-1],[2,-2],[6,-5],[1,-3],[-3,-3],[-7,-3],[-8,-2],[-37,-7],[-34,-4],[-10,-1],[-37,1],[-12,-1],[-4,0]],[[4743,8509],[-4,2],[-4,0],[-1,0],[-18,3],[-57,6],[-4,1],[-2,0],[-3,0],[-9,2],[-2,0],[-2,1],[0,1],[1,1],[4,1],[1,0],[-2,2],[-30,7],[-6,0],[-14,2],[-13,2],[-2,1],[-1,0],[7,1],[2,0],[3,0],[25,4],[8,2],[22,6],[1,0],[2,1],[8,1],[17,2],[-39,15],[-1,5],[-13,11],[-4,3],[-3,0],[-3,0],[-4,0],[-11,0],[-6,-1],[-4,-1],[-18,-2],[-2,0],[-7,0],[-11,1],[-3,1],[-5,1],[-52,2],[2,3],[10,4],[-5,4],[-10,1],[-9,0],[-2,-1],[1,0],[1,0],[1,0],[0,-1],[-3,-1],[-10,2],[-23,1],[-10,1],[-2,1],[1,2],[0,1],[-1,1],[0,1],[1,0],[2,1],[4,1],[16,1],[1,1],[-1,1],[-3,0],[-15,2],[-32,4],[-7,1],[-1,1],[4,1],[26,6]],[[4630,8475],[-14,0]],[[4648,8452],[-3,3],[2,0],[-3,1],[-7,0],[-5,1],[-2,-1],[-2,-1],[-2,0],[-10,1],[-1,-1],[-3,0],[-2,0],[-10,0],[-6,0],[-5,-1],[-7,-2],[-1,0],[6,-1],[-2,-1],[-1,-1]],[[4420,8421],[-3,-4],[2,-2],[2,-1],[19,-4],[-1,-1],[2,-2],[1,-1],[2,-2],[-1,0],[-3,-1],[-4,0],[-3,-1],[-1,0],[-1,-1],[1,0],[2,-2],[2,-1],[1,-1],[-1,-1],[-1,-1],[0,-3],[-5,-1]],[[4430,8391],[-2,0],[-8,2],[-4,0],[-2,-1],[-2,0],[-6,2],[-1,0],[-2,0],[-1,0],[-1,1],[0,1],[-3,0],[-1,-1],[0,-1],[0,-1],[-4,0],[-2,1],[-2,1],[-1,1],[-1,1],[-3,0],[3,1],[-1,1],[-2,0],[-7,-1],[-14,0],[5,-1],[14,-2],[3,-2],[5,-1],[9,0],[8,-2],[-1,-2],[-1,0],[-1,0],[-1,1],[-2,0],[-2,-1],[-2,0],[-7,0],[3,0],[2,-1],[2,0],[1,-1],[-6,0],[-16,-1],[1,0],[2,-1],[-8,0],[-24,0],[9,-1],[3,-1],[-3,0],[-9,0],[-4,0],[-1,-1],[-5,0],[-7,1],[-6,0],[-3,-1],[5,0],[3,0],[2,0],[-1,-1],[-2,0],[-1,0],[-11,-1],[-5,0],[-4,2],[-1,-1],[-6,-3],[3,0],[5,0],[2,-1],[2,1],[8,1],[6,0],[5,0],[5,0],[6,-1],[-3,-1],[-11,-1],[-5,-1],[5,0],[4,1],[0,-1],[-3,0],[-2,-1]],[[4572,8396],[1,0],[2,0],[1,0],[0,-2],[-2,0],[-2,0],[-2,1],[-1,2],[1,0],[1,1],[1,0],[0,-1],[-1,0],[0,-1],[1,0]],[[4602,8405],[-5,0],[1,1],[4,-1]],[[4597,8417],[-2,-1],[-2,1],[-3,0],[2,1],[-1,0],[3,0],[2,0],[1,0],[0,-1]],[[4537,8441],[3,-1],[15,-1],[4,-1],[3,-1],[1,-2],[0,-2],[-1,-2],[-2,-2],[-4,-1],[-8,1],[-14,2],[-8,0],[3,-1],[4,-2],[6,-1],[4,0],[5,-1],[9,-3],[21,-1],[4,-1],[1,-1],[-2,-2],[-6,-2],[0,-1],[4,-1],[8,-1],[4,-1],[-2,-1],[-4,-1],[-3,-1],[-2,-1],[-4,0],[-8,1],[-10,1],[-3,-1],[0,-2],[1,-1],[-1,0],[-6,-1],[-1,0],[-1,-1],[-2,-1],[-1,-2],[0,-1],[0,-1],[-6,0],[0,-1],[2,-2],[2,-2],[-3,1],[-1,1],[-1,1],[-3,1],[-1,-2],[1,-3],[-2,-1],[-1,1],[-6,5],[-2,0],[0,-1],[-3,-2],[0,-1],[1,0],[2,-1],[2,-1],[-1,-1],[-5,0],[-7,-1],[-8,-1],[-7,1],[3,0],[9,1],[1,1],[-1,1],[-4,0],[-7,-1],[-3,0],[-6,-1],[-4,0],[-2,0],[-5,1],[-3,0],[3,-3],[-4,-2],[-7,-1],[-6,0],[-26,0],[-8,1],[6,0],[1,2],[-2,1],[-2,1]],[[4693,8396],[1,-1],[1,0],[0,-1],[0,-1],[1,0],[1,-1],[-4,0],[-1,0],[-1,0],[-1,0],[1,0],[-1,1],[-1,0],[1,0],[-2,0],[-2,1],[2,0],[0,1],[1,0],[1,1],[2,0],[1,0]],[[4714,8395],[2,0],[5,0],[1,0],[2,0],[0,-1],[-2,0],[-2,-1],[-3,0],[-1,-1],[1,0],[-2,-1],[-3,0],[-3,0],[-1,0],[-1,0],[-2,1],[-2,0],[0,1],[0,1],[0,1],[2,1],[4,0],[4,0],[1,-1]],[[4671,8397],[4,0],[6,1],[3,0],[0,-1],[-1,-1],[-6,-1],[-1,0],[-1,0],[-1,0],[-3,0],[-3,0],[-1,1],[-2,1],[3,0],[3,1],[2,0],[1,0],[-1,-1],[-1,0],[-1,0]],[[4911,8449],[2,0],[2,-2],[1,-1],[-2,-3],[0,-1],[-1,0],[-9,-3],[-6,-1],[-31,-3],[-5,-1],[-1,-2],[2,-1],[25,-15],[5,-5],[1,-2],[0,-1],[-2,-1],[-4,-2],[-2,-1],[-6,-4],[-1,-4],[-3,-2],[-6,-3],[-2,-2],[-1,-2],[-7,-4],[-12,-2],[-16,0],[-15,0],[-7,1],[0,4],[-3,3],[-8,3],[-1,1],[-1,2],[-1,0],[-5,2],[-6,1],[-7,0],[-23,0],[-8,0],[-3,1],[1,1],[2,0],[4,0],[2,0],[-1,1],[-2,0],[-1,0],[-2,0],[-1,1],[0,1],[1,0],[-1,1],[-3,0],[-7,-1],[4,-1],[0,-1],[-1,-1],[-3,0],[-4,0],[-2,0],[-5,2],[2,-2],[1,-1],[-2,0],[-14,0],[2,1],[-3,1],[-5,0],[-2,1],[-2,0],[-10,1],[-2,0],[2,-1],[-1,-2],[-2,0],[-4,0],[-2,0],[-2,1],[0,2],[1,1],[-5,-1],[-2,0],[-3,0],[-3,0],[0,-1],[-2,-1],[-4,0],[-5,2],[-5,0],[1,2],[-4,1],[1,2],[-2,-1],[-3,-1],[-3,-1],[-1,2],[3,2],[4,2],[4,1],[-4,1],[-2,0],[-2,1],[-3,0],[-2,0],[-4,-2],[-1,0],[-7,1],[-2,1],[-1,2],[-4,1],[3,1],[1,1],[-2,1],[-4,0],[-9,1],[-1,0],[2,2],[6,2],[4,1],[3,0],[2,-1],[-1,-1],[-3,-2],[4,0],[3,0],[2,1],[1,1],[0,1]],[[4667,8797],[-1,0],[-2,0],[-7,0],[-3,0],[-2,1],[2,0],[-2,0],[-1,1],[2,0],[1,0],[2,0],[2,0],[1,0],[1,-1],[1,0],[1,0],[3,0],[2,-1]],[[4790,8806],[6,-2],[-1,1],[1,0],[3,0],[9,-2],[3,0],[2,0],[2,-2],[2,0],[0,-1],[-4,0],[-6,0],[-1,0],[1,-1],[-1,0],[-5,0],[-6,1],[-8,1],[-2,0],[1,1],[1,0],[4,1],[0,1],[-2,1],[1,1]],[[4758,8804],[9,-1],[4,-3],[7,-1],[26,0],[6,-2],[-3,0],[-2,-1],[-3,-2],[-6,1],[-18,0],[-3,1],[-4,1],[-9,0],[-15,0],[-12,3],[3,1],[6,0],[13,0],[-8,2],[-25,0],[-9,0],[-2,1],[1,2],[3,1],[3,0],[5,0],[4,0],[9,-1],[20,-2]],[[4787,8807],[-2,-1],[-1,0],[1,-1],[-1,0],[-1,0],[-2,-1],[-1,0],[-2,-1],[-4,1],[-4,0],[-3,1],[-3,1],[-2,0],[-2,0],[-1,0],[-1,0],[-2,0],[-11,0],[-1,1],[3,0],[0,1],[-3,0],[1,0],[3,1],[28,1],[3,0],[-1,-1],[7,0],[3,-1],[-1,-1]],[[4641,8820],[0,-1],[-1,0],[-1,0],[-1,0],[-1,0],[-1,0],[-1,0],[-1,0],[0,1],[1,0],[3,0],[3,0]],[[4753,8826],[14,-1],[-1,0],[-1,0],[-10,-2],[-9,-1],[-11,-1],[-12,0],[1,1],[1,0],[-2,0],[-3,0],[-2,0],[-3,0],[4,1],[4,1],[3,1],[0,1],[-2,-1],[-18,0],[-15,-1],[-8,-2],[-7,0],[-7,0],[-5,0],[61,7],[3,1],[4,-1],[5,0],[7,-1],[3,0],[3,-1],[1,0],[2,-1]],[[4662,8823],[-19,-1],[1,1],[1,0],[-8,0],[4,1],[3,1],[2,1],[4,1],[4,0],[16,0],[5,1],[12,1],[9,1],[16,1],[0,1],[6,0],[8,0],[5,-1],[-1,0],[-1,0],[-33,-4],[-15,-1],[-14,-2],[-5,-1]],[[4689,8832],[3,0],[3,0],[1,0],[-5,0],[-1,0],[4,0],[1,-1],[-1,0],[-2,0],[1,0],[-1,0],[-3,0],[-2,0],[-2,0],[-10,-1],[-2,0],[0,1],[2,0],[0,1],[-2,0],[-1,0],[1,-1],[-4,0],[-1,-1],[2,1],[1,0],[0,-1],[-4,0],[-1,0],[-1,-1],[-1,0],[-1,0],[-1,0],[-1,0],[-1,0],[-1,0],[-1,0],[1,1],[2,0],[-3,0],[-1,0],[-1,1],[-1,0],[-1,0],[-7,0],[-2,0],[0,-1],[-1,0],[-2,0],[0,1],[2,0],[4,0],[1,0],[4,0],[-1,0],[-2,1],[-1,0],[3,0],[2,0],[-1,0],[3,0],[1,0],[1,1],[2,0],[1,-1],[1,0],[4,0],[1,0],[3,1],[1,0],[2,0],[0,-1],[-2,0],[8,1],[1,-1],[1,0],[1,0],[-1,0],[-2,0],[1,0],[1,0],[1,0],[1,0],[1,0],[-1,0],[2,1],[1,0],[2,0],[2,0],[-1,0],[0,-1]],[[4886,8841],[-3,0],[-4,-1],[-9,-1],[-4,0],[-4,-1],[3,0],[3,0],[0,-1],[-3,0],[-4,-1],[-3,0],[-1,0],[0,1],[1,1],[-2,0],[-5,-1],[-5,0],[-6,-1],[-5,0],[-9,1],[2,1],[-1,0],[1,1],[1,0],[2,1],[3,0],[3,1],[3,0],[19,1],[7,0],[4,-1],[3,0],[1,0],[1,0],[1,0],[2,1],[5,0],[3,0],[0,-1]],[[5484,8841],[-5,-2],[-33,-7],[-62,-15],[-61,-15],[69,-7],[10,0],[18,-1],[9,-1],[4,-1],[11,-18],[0,-1],[-3,-1],[-39,-12],[-4,0],[-6,0],[-83,3],[-82,3],[-59,-3],[-53,-5],[-17,-2],[-47,-11],[-44,-11],[-29,-5],[12,-7],[0,-2],[-4,-1],[-49,-13],[15,-6]],[[4675,8718],[1,0],[4,0],[3,1],[2,1],[-22,0],[-10,1],[-5,2],[5,2],[12,1],[21,0],[0,1],[-10,0],[-5,0],[1,1],[4,0],[4,0],[4,1],[2,1],[-16,-1],[-8,0],[-8,-1],[-4,0],[-9,-1],[-3,0],[-3,-1],[-4,0],[-3,0],[-4,0],[4,0],[2,1],[1,1],[3,0],[2,0],[0,1],[1,0],[1,0],[1,1],[2,0],[1,0],[5,1],[8,1],[13,1],[5,0],[9,3],[30,2],[6,0],[6,-1],[8,0],[9,1],[6,0],[6,1],[8,3],[6,0],[16,1],[25,0],[4,1],[1,0],[-1,1],[-2,1],[-3,0],[-3,0],[2,1],[1,0],[-5,1],[-15,0],[-6,0],[-6,1],[-6,0],[-6,0],[-32,-1],[-3,0],[-1,1],[0,1],[0,1],[1,0],[3,0],[15,1],[5,1],[3,1],[3,1],[18,1],[32,2],[6,1],[5,1],[3,1],[-10,-1],[-3,1],[-4,0],[-14,0],[-24,1],[-2,0],[-3,1],[0,1],[3,0],[6,1],[15,2],[4,1],[-8,-1],[-6,0],[-18,-3],[-5,-3],[-1,0],[-6,-1],[-49,-5],[-6,-1],[-6,-1],[-5,-1],[-5,-1],[-7,0],[-28,-2],[-7,0],[-10,-2],[-12,-1],[-5,-1],[5,0],[4,0],[4,0],[14,2],[3,0],[16,1],[30,3],[8,1],[16,-2],[7,0],[6,-1],[4,-2],[-5,0],[-6,-1],[-5,-1],[-3,-1],[-2,0],[-1,-2],[-1,0],[-1,0],[-4,-1],[-2,0],[-9,-2],[-23,-1],[-16,-2],[-16,0],[-7,-1],[-2,0],[-5,-3],[-2,0],[-9,-1],[-8,0],[-27,-3],[-3,0],[-9,-1],[-7,0],[-3,0],[-19,0],[-3,-1],[-5,-1],[-2,0]],[[4617,8789],[-1,0],[-2,1],[-3,1],[-1,-1],[-1,1],[-1,0],[1,1],[2,0],[1,0],[3,0],[3,0],[2,-1],[2,0],[3,-1],[1,0],[13,0],[3,0],[1,-1],[1,0],[1,-1],[2,0],[14,-2],[5,0],[5,1],[-13,2],[-3,0],[4,1],[-2,1],[-5,1],[-5,0],[-17,-1],[-6,1],[3,1],[6,1],[2,0],[3,0],[6,0],[3,-1],[0,1],[1,0],[1,1],[7,0],[3,-1],[5,0],[3,-1],[-1,2],[-2,0],[-3,1],[-3,1],[6,0],[5,-1],[5,-1],[4,-1],[1,0],[2,1],[2,0],[2,1],[2,-1],[3,0],[2,0],[2,0],[-7,1],[-1,1],[2,0],[2,0],[6,0],[-3,1],[1,1],[0,1],[-1,0],[-3,1],[-3,0],[-2,1],[2,0],[2,0],[4,1],[1,0],[0,1],[4,0],[5,-1],[14,-1],[2,0],[0,-1],[-1,-1],[1,-1],[3,-1],[2,0],[4,0],[16,-3],[2,-1],[0,-1],[-3,-1],[5,0],[14,0],[6,1],[5,-1],[6,0],[5,-1],[-2,-1],[-3,-1],[-12,-3],[-10,-3],[5,0],[5,1],[8,2],[18,2],[3,1],[-5,0],[-2,0],[2,1],[6,2],[3,0],[2,0],[4,0],[2,-1],[3,1],[5,0],[10,1],[22,1],[10,1],[-51,-2],[2,1],[1,2],[2,1],[4,0],[10,0],[5,1],[-3,0],[-2,0],[-2,1],[-1,1],[16,0],[-5,-1],[-2,0],[6,0],[20,2],[22,1],[7,1],[-28,0],[-6,-1],[-2,1],[0,1],[2,0],[-1,1],[-5,1],[-5,-1],[-5,-1],[-3,0],[2,-1],[2,0],[3,0],[3,0],[-5,-1],[-6,-1],[-8,0],[-5,1],[-2,1],[-5,1],[-2,1],[-3,0],[-3,1],[-2,0],[1,1],[-3,1],[-2,0],[-2,1],[0,1],[2,0],[2,0],[2,0],[1,0],[-1,1],[-2,0],[-2,0],[-2,0],[6,1],[14,0],[12,2],[7,0],[6,-1],[7,1],[-2,0],[-3,0],[0,1],[-3,0],[-4,0],[-3,1],[55,1],[8,1],[4,0],[-24,0],[2,1],[-7,0],[-11,1],[-6,0],[8,1],[26,0],[-1,0],[-1,1],[2,0],[-16,-1],[-9,0],[-8,0],[14,1],[4,2],[5,0],[5,1],[11,0],[24,2],[17,1],[4,0],[3,1],[7,1],[3,0],[38,-2],[-9,2],[-10,1],[-21,0],[-5,0],[-8,-1],[-4,0],[-16,-1],[-41,-4],[-28,-2],[-2,0],[3,-1],[0,-1],[-17,-1],[-6,-1],[-7,0],[-4,0],[-3,-1],[-4,-1],[-5,-1],[-5,-1],[-6,0],[-27,-2],[-6,1],[3,0],[14,1],[7,1],[3,0],[2,0],[14,3],[2,0],[-19,0],[-11,1],[-11,-1],[-5,1],[5,1],[6,0],[57,2],[33,2],[8,1],[-6,0],[-17,-1],[-83,-3],[5,1],[31,4],[5,0],[7,0],[14,-2],[5,0],[5,1],[5,0],[5,1],[-4,0],[-7,-1],[-4,0],[-2,0],[-11,2],[4,1],[15,1],[5,-1],[10,0],[3,0],[-1,0],[-2,1],[-1,0],[3,0],[2,0],[3,0],[3,0],[11,0],[13,1],[2,0],[10,1],[4,0],[-4,0],[-3,1],[-1,1],[3,0],[14,2],[8,1],[8,1],[8,0],[8,-1],[0,-1],[1,-1],[2,0],[2,1],[1,1],[2,0]],[[4980,8834],[-1,-1],[2,0],[3,0],[1,0],[1,0]]],"transform":{"scale":[0.004276208870887092,0.01352461092459247],"translate":[-9.11742102799991,-54.46249765399998]}};
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
