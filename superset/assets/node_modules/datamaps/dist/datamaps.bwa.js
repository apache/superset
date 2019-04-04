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
  Datamap.prototype.bwaTopo = {"type":"Topology","objects":{"bwa":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Ghanzi"},"id":"BW.GH","arcs":[[0,1,2,3,4]]},{"type":"Polygon","properties":{"name":"Kgalagadi"},"id":"BW.KG","arcs":[[5,6,7,-2]]},{"type":"Polygon","properties":{"name":"North-West"},"id":"BW.NW","arcs":[[8,-4,9]]},{"type":"Polygon","properties":{"name":"Central"},"id":"BW.CE","arcs":[[10,11,12,13,14,-5,-9],[15],[16]]},{"type":"Polygon","properties":{"name":"Kgatleng"},"id":"BW.KL","arcs":[[17,18,19,20,-14]]},{"type":"Polygon","properties":{"name":"Kweneng"},"id":"BW.KW","arcs":[[-21,21,22,23,24,25,-6,-1,-15]]},{"type":"Polygon","properties":{"name":"South-East"},"id":"BW.SE","arcs":[[26,27,-23,28,-19],[29]]},{"type":"Polygon","properties":{"name":"Southern"},"id":"BW.SO","arcs":[[30,-24,-28,31,-7,-26]]},{"type":"Polygon","properties":{"name":"North-East"},"id":"BW.NE","arcs":[[-12,32],[33]]},{"type":"Polygon","properties":{"name":"Gaborone"},"id":"BW.","arcs":[[-29,-22,-20]]},{"type":"Polygon","properties":{"name":"Francistown"},"id":"BW.","arcs":[[-34]]},{"type":"Polygon","properties":{"name":"Lobatse"},"id":"BW.","arcs":[[-30]]},{"type":"Polygon","properties":{"name":"Selebi-Phikwe"},"id":"BW.","arcs":[[-17]]},{"type":"Polygon","properties":{"name":"Sowa"},"id":"BW.","arcs":[[-16]]},{"type":"Polygon","properties":{"name":"Jwaneng"},"id":"BW.","arcs":[[-31,-25]]}]}},"arcs":[[[5826,4324],[-210,-402],[-2331,8]],[[3285,3930],[-3263,3],[-20,0]],[[2,3933],[0,114],[-1,189],[0,189],[0,188],[0,166],[0,165],[-1,165],[0,165],[0,94],[250,0],[250,0],[249,0],[250,0],[61,0],[14,41],[0,45],[-1,63],[0,63],[0,64],[0,63],[0,63],[-1,63],[0,64],[0,63],[0,63],[0,64],[-1,63],[0,63],[0,63],[0,63],[-1,64],[0,63],[0,1]],[[1070,6467],[20,0],[3074,0]],[[4164,6467],[1662,-2143]],[[3285,3930],[-15,-95],[-22,-18],[-48,1],[-11,-4],[-9,-9],[-4,-41],[2,-106],[2,-8],[7,-3],[11,-1],[60,0],[19,-80],[4,-391]],[[3281,3175],[-4,-905],[2,-13],[5,-11],[15,-4],[16,-2],[1023,6],[16,-2],[17,-4],[17,-12],[123,-121],[14,-17],[11,-18],[5,-24],[17,-522],[35,-43],[123,-116],[17,-5],[49,-3],[28,-21],[15,-93]],[[4825,1245],[-47,16],[-21,-3],[-22,-8],[-29,-7],[-54,8],[-45,31],[-73,82],[-47,25],[-56,0],[-111,-28],[-23,-3],[-2,5],[6,10],[-1,8],[-11,9],[-11,6],[-12,3],[-55,-13],[-21,12],[-16,21],[-48,33],[-41,50],[-9,5],[-22,7],[-10,6],[-7,9],[-11,23],[-10,9],[-59,17],[-14,13],[-8,11],[-112,82],[-27,16],[-32,13],[-10,8],[-14,13],[-17,24],[-9,9],[-15,4],[-14,-2],[-35,-12],[-19,-2],[-17,4],[-48,17],[-59,11],[-53,-4],[-50,-14],[-80,-36],[-11,-7],[-13,-7],[-6,5],[-5,11],[-7,9],[-25,4],[-26,-13],[-41,-39],[-6,-10],[-2,-9],[-5,-9],[-12,-7],[-15,-6],[-11,-7],[-9,-10],[-9,-13],[-17,-43],[-12,-13],[-27,-10],[-7,-11],[-21,-68],[-9,-17],[-3,-8],[0,-10],[6,-11],[10,-11],[5,-12],[-9,-10],[-15,-11],[-1,-9],[4,-9],[1,-12],[-2,-16],[-3,-11],[-6,-11],[-47,-52],[-15,-23],[-6,-23],[1,-16],[4,-3],[6,-2],[8,-11],[6,-16],[2,-7],[-12,-18],[-16,-17],[-21,-17],[-12,-19],[14,-19],[5,-14],[1,-25],[-3,-26],[-6,-18],[-9,-14],[-10,-7],[-31,-10],[-11,-9],[0,-10],[4,-11],[-1,-13],[-44,-63],[-3,-3],[-10,-10],[-21,-13],[-12,-15],[-17,-38],[-20,-29],[-19,-7],[-48,10],[-34,-6],[-23,-18],[-37,-50],[-55,-50],[-26,-12],[-17,-5],[-49,-8],[-9,-7],[-11,-22],[-43,-41],[-21,-39],[-34,-87],[-41,-58],[-53,-50],[-63,-36],[-67,-15],[-104,-1],[-34,-5],[-28,-10],[-13,-11],[-1,-17],[9,-49],[2,-22],[-5,-20],[-12,-19],[-19,-18],[-61,-38],[-24,-8],[-23,0],[-63,16],[-91,2],[-52,22],[-25,4],[-49,-2],[-89,-22],[-15,-1],[-30,4],[-15,0],[-93,-25],[-33,-1],[-141,29],[-43,25],[-45,18],[-60,-7],[-28,-14],[-49,-32],[-69,-30],[-23,-15],[-3,-3],[-5,11],[-11,35],[-11,12],[-16,10],[-6,6],[-6,8],[-15,30],[-11,40],[-6,41],[0,33],[23,74],[2,25],[-5,16],[-17,23],[-7,14],[-3,28],[3,31],[14,59],[4,14],[32,21],[15,18],[31,54],[62,73],[24,39],[20,42],[46,61],[4,17],[-40,66],[-4,20],[3,79],[-10,95],[-28,66],[-1,4],[-12,12],[-6,1],[-10,-5],[-15,-5],[1,10],[11,22],[-22,72],[-11,20],[-11,8],[-27,13],[-9,11],[0,12],[9,23],[0,12],[-8,7],[-13,2],[-11,4],[-3,12],[5,7],[24,14],[6,11],[-8,29],[-48,39],[2,31],[7,17],[32,19],[-14,11],[-10,0],[-9,-5],[-10,-4],[-11,4],[0,12],[5,13],[1,9],[-16,-2],[-4,22],[-6,10],[-31,13],[-17,11],[-7,12],[-7,34],[-5,9],[-11,14],[-4,8],[0,8],[4,6],[4,7],[-2,10],[-7,7],[-19,9],[-7,7],[-2,7],[-2,28],[-20,8],[-20,11],[-10,15],[9,18],[2,17],[-12,23],[-29,43],[-33,68],[-12,14],[-137,107],[-82,46],[-11,3],[-22,1],[-10,3],[-12,8],[-28,30],[-56,41],[-20,30],[-18,13],[-7,8],[-6,18],[0,189],[0,189],[0,188],[0,189],[-1,189],[0,31],[0,158],[0,188],[0,189],[0,75]],[[6390,8662],[-1032,0],[-10,0],[1,-1093],[4,-3],[2,-2],[176,-73],[6,-7],[2,-12],[-8,-255],[-2,-14],[-5,-10],[-11,-4],[-684,-55],[-12,1],[-15,2],[-23,0],[-38,-13],[-21,-2],[-26,10],[-17,18],[-29,44],[-41,32],[-16,16],[-29,56],[-13,0],[-14,-8],[-21,8],[-28,30],[-12,10],[-16,8],[-10,-1],[-10,-5],[-14,-6],[-41,-7],[-11,-6],[-18,-17],[-12,-5],[-13,-3],[-10,-4],[-8,-6],[-25,-29],[0,-4],[2,-6],[1,-6],[-3,-6],[-66,-17],[-12,-1],[-14,5],[-27,17],[-5,-22],[2,-750]],[[1070,6467],[0,136],[-1,137],[0,138],[0,137],[-1,137],[0,27],[0,110],[-1,137],[0,137],[0,138],[-1,137],[0,137],[-1,137],[0,137],[-1,138],[0,86],[0,51],[-1,137],[0,45],[0,45],[0,44],[0,45],[0,45],[0,45],[0,45],[0,44],[0,45],[0,45],[0,45],[0,45],[0,45],[0,44],[0,45],[0,45],[0,31],[20,1],[33,1],[60,3],[60,2],[60,2],[61,3],[50,2],[50,2],[50,2],[50,2],[20,1],[21,1],[18,3],[18,4],[18,3],[18,4],[91,17],[89,17],[91,17],[90,17],[90,18],[90,17],[90,17],[90,17],[90,17],[90,18],[90,17],[90,17],[90,17],[90,17],[90,18],[90,17],[93,18],[126,10],[92,8],[74,6],[40,-1],[14,-7],[6,-5],[2,-8],[0,-14],[3,-8],[8,-2],[8,-1],[3,-4],[-1,-26],[1,-8],[3,-6],[12,-16],[13,-27],[32,-38],[6,-11],[1,-6],[-2,-19],[1,-6],[6,-3],[10,-3],[9,-1],[11,11],[16,-14],[15,-18],[6,-9],[15,-6],[14,-2],[11,-5],[4,-13],[6,-12],[12,-9],[5,-10],[-9,-18],[35,-37],[10,-23],[-15,-23],[10,-15],[16,-47],[9,-46],[14,-11],[19,0],[38,13],[4,3],[7,6],[26,29],[22,4],[16,10],[100,106],[17,6],[12,12],[19,28],[13,12],[32,21],[17,16],[3,38],[37,26],[7,1],[5,-2],[5,-3],[5,-3],[4,7],[5,6],[13,9],[30,13],[9,6],[31,30],[8,4],[39,7],[36,26],[51,61],[38,19],[21,3],[22,-3],[12,-4],[19,-9],[9,-2],[10,7],[30,53],[18,17],[16,6],[36,-2],[24,-5],[13,-12],[18,-34],[8,-8],[7,-3],[5,-6],[2,-17],[36,-34],[14,4],[49,5],[11,2],[3,7],[15,17],[4,6],[4,3],[53,63],[16,15],[37,23],[29,36],[5,4],[8,5],[10,4],[9,1],[10,4],[6,15],[7,4],[22,4],[25,21],[18,5],[21,1],[78,25],[7,4],[8,8],[4,7],[5,6],[12,2],[-7,-16],[11,-7],[7,-10],[9,-4],[16,7],[9,-13],[14,2],[29,18],[11,-22],[33,1],[35,14],[35,35],[43,-1],[70,-12],[-43,-95],[0,-31],[7,-26],[31,-76],[44,-74],[29,-31],[36,-21],[32,-25],[23,-41],[34,-84],[35,-56],[8,-21],[10,-47],[6,-14],[13,-23],[71,-73],[36,-24],[14,-15],[51,-71],[31,-26],[41,-21],[27,-23],[12,-39],[6,-80],[39,-83],[133,-118],[29,-86]],[[6390,8662],[0,-1],[-3,-23],[-18,-41],[-3,-22],[4,-26],[8,-21],[27,-44],[32,-41],[24,-49],[103,-282],[27,-40],[41,-25],[48,-12],[57,-1],[12,-6],[10,-7],[8,-9],[11,-14],[2,-9],[-7,-23],[-8,-13],[-7,-4],[0,-2],[13,-8],[8,-4],[33,-6],[24,-12],[29,-45],[20,-18],[20,-8],[42,-9],[21,-8],[43,-28],[18,-18],[9,-21],[8,-24],[14,-15],[20,-9],[48,-13],[16,-9],[3,-3],[8,-9],[15,-20],[16,-16],[19,-9],[21,-4],[25,-1],[40,-7],[121,-60],[38,-7],[36,1],[34,-4],[36,-19],[10,-11],[18,-25],[11,-9],[14,-5],[10,-1],[11,1],[13,0],[22,-4],[23,-6],[19,-12],[14,-19],[54,-136],[20,-128],[-17,-159]],[[7778,7020],[4,-73],[-23,-62],[-23,-93],[-15,-78],[0,-78],[15,-108],[46,-62],[37,-70],[46,-109],[37,-101],[23,-101],[38,-70],[53,-62],[83,-39],[75,0],[91,-23],[68,8],[75,0],[61,-31],[79,-7]],[[8548,5861],[13,-14],[15,-9],[18,-5],[61,-4],[80,-16],[128,-1],[39,-8],[43,-14],[86,-43],[23,-5],[18,3],[17,7],[38,9],[11,5],[12,2],[34,-9],[31,-2],[15,-5],[42,-32],[49,-14],[156,-71],[32,-8],[65,-4],[31,-7],[19,-12],[43,-13],[17,-13],[3,-21],[-13,-26],[-18,-26],[-11,-24],[-5,-46],[9,-47],[20,-42],[32,-33],[40,-20],[39,-6],[101,2],[5,-3],[11,-12],[5,-10],[9,-22],[6,-10],[82,-68],[-20,-6],[-30,2],[-59,12],[-28,-3],[-20,-13],[-17,-15],[-19,-7],[-129,-7],[-10,-4],[-22,-29],[0,-5],[-17,-9],[-20,-20],[-25,-31],[8,-77],[-5,-13],[-10,-10],[-25,-44],[-19,-14],[-46,5],[-24,-1],[-11,-14],[-6,-21],[-15,-12],[-21,-6],[-24,-3],[-46,-14],[-77,-42],[-38,-12],[-28,1],[-21,3],[-19,-4],[-23,-19],[-17,-5],[-67,17],[-88,-6],[-41,-10],[-39,-22],[-16,-13],[-39,-43],[-11,-6],[-26,-3],[-11,-3],[-10,-6],[-34,-41],[-5,-10],[-2,-14],[2,-14],[3,-8],[0,-9],[-8,-14],[-10,-9],[-11,-4],[-10,-2],[-9,-4],[-5,-7],[-6,-17],[-4,-6],[-16,-7],[-24,-7],[-20,-8],[-2,-12],[9,-24],[-4,-24],[-13,-22],[-17,-17],[-15,-9],[-20,-10],[-22,-8],[-21,-3],[-12,-11],[0,-25],[9,-46],[-17,-31],[-37,-25],[-44,-17],[-41,-10],[7,-20],[-17,-6],[-23,1],[-11,2],[-3,-8],[3,-9],[5,-8],[2,-5],[2,-3],[5,-5],[2,-4],[-5,-2],[-2,-2],[-8,-6],[-1,0],[-16,-42],[-6,-11],[-16,-7],[-14,6],[-29,31],[-43,-33],[-12,-4],[-15,4],[-15,7],[-12,1],[-9,-31],[-20,-21],[-5,-17],[-1,-6],[-2,-6],[-4,-5],[-4,-2],[-2,-3],[1,-7],[3,-9],[2,-7],[-6,-25],[-16,-19],[-21,-14],[-23,-6],[-45,-2],[-13,-5],[-11,-11],[-8,-13],[-11,-6],[-15,7],[8,16],[-8,2],[-16,-5],[-13,-6],[-3,-6],[-10,-13],[-11,-6],[-12,34],[-15,-12],[-25,-38],[-18,-16],[-19,-13],[-41,-20],[-39,-11],[-12,-13],[15,-22],[-11,-4],[-9,0],[-9,4],[-7,9],[-3,-7],[-8,-9],[-5,-7],[-8,10],[-13,4],[-10,-2],[-5,-8],[5,-14],[8,-7],[6,-7],[-4,-13],[-14,7],[-11,-1],[-11,-8],[-8,-13],[7,0],[-20,-14],[-6,-6],[-3,-10],[-7,4],[-8,3],[2,-22],[7,-19],[0,-16],[-16,-11],[-18,1],[-9,12],[-5,13],[-12,5],[-10,-8],[-19,-45],[-20,-35],[-6,-21],[3,-10]],[[7454,3452],[0,-1],[-6,-1],[-21,-2],[-13,-11],[-25,-32],[-3,6],[-9,11],[-3,6],[-8,-20],[-11,-17],[-24,-31],[-5,-8],[-6,-17],[-4,-5],[-8,-2],[-20,3],[-8,-1],[-27,-25],[-50,-58],[-2,-1],[-3,-8],[-4,-4],[-4,-3],[-744,419]],[[6446,3650],[-143,193],[-48,45],[-94,29],[-14,6],[-9,8],[-312,393]],[[6694,6907],[4,43],[-24,9],[-25,-4],[-16,-4],[-55,13],[-18,3],[-7,-26],[28,-13],[57,-16],[56,-5]],[[8373,5410],[-8,3],[-11,-6],[-1,-5],[3,-4],[2,-5],[-4,-7],[0,-8],[2,-5],[12,2],[9,7],[8,-2],[7,-6],[9,2],[8,6],[15,5],[4,10],[1,10],[5,5],[-3,4],[-10,6],[2,11],[1,8],[-4,11],[-4,4],[-12,-3],[-5,-11],[0,-7],[-9,-9],[0,-10],[-11,-5],[-6,-1]],[[7454,3452],[2,-9],[-30,-53],[7,-22],[-4,-30],[-75,-291],[-2,-49],[-21,-96],[-11,-20],[-17,-14],[-22,-12],[-94,-29],[-23,-11],[-9,-17],[-65,-63],[-70,-43],[-29,-22],[-26,-34],[-32,-78],[-7,-12],[-70,-68],[-24,4],[-19,2],[-21,4],[-20,2],[-50,-7],[-120,-35]],[[6602,2449],[-10,15],[-47,42],[-85,55]],[[6460,2561],[-87,56]],[[6373,2617],[-18,11],[-21,10],[-12,3],[-10,8],[-7,21],[-2,31],[16,62],[13,32],[14,25],[32,160],[68,670]],[[6373,2617],[-124,-126]],[[6249,2491],[-158,-161]],[[6091,2330],[-90,3],[-19,4],[-126,66],[-697,209]],[[5159,2612],[-186,56]],[[4973,2668],[-1692,507]],[[6602,2449],[-163,-48],[-34,-24],[-17,-8],[-54,2],[-36,-12],[-8,-1],[-6,-5],[-1,-27],[11,-80],[-1,-44],[-11,-36],[-31,-67],[-2,-41],[-32,-53],[-24,-73],[-93,-196],[-34,-143],[-12,-25]],[[6054,1568],[-111,43],[-6,12],[-1,12],[122,399],[4,15],[0,15],[-11,4],[-14,2],[-29,-2],[-9,1],[-2,5],[0,1],[34,97],[6,28],[-2,15],[10,9],[13,16],[13,12],[20,78]],[[6249,2491],[5,-32],[5,-39],[14,-24],[36,-8],[25,7],[45,3],[27,35],[0,28],[53,74],[1,26]],[[6061,1815],[12,1],[11,3],[7,-5],[13,6],[6,10],[0,11],[-9,0],[-3,6],[7,6],[-1,5],[7,7],[-6,5],[-1,8],[-13,-3],[-2,12],[-5,1],[-4,-10],[-6,-19],[0,-17],[-4,-13],[-8,-11],[-1,-3]],[[4973,2668],[-2,-219],[195,9],[-7,154]],[[6054,1568],[-47,-105],[-23,-67],[-137,-100],[-77,-36],[-223,-21],[-44,7],[-49,14],[-41,7],[-41,-6],[-48,-22],[-64,-45],[-21,-8],[-64,-16],[-32,-4],[-30,8],[-35,7],[-78,-8],[-37,8],[-57,36],[-81,28]],[[7778,7020],[40,20],[37,5],[121,0],[85,-11],[61,11],[37,-17],[43,-1],[19,-7],[15,-14],[8,-20],[-3,-43],[-13,-39],[-8,-39],[26,-87],[3,-44],[-16,-89],[-6,-13],[-8,-9],[-6,-10],[-1,-14],[0,-13],[-3,-25],[0,-10],[9,-62],[-2,-23],[-13,-58],[0,-19],[9,-21],[36,-49],[17,-17],[74,-52],[31,-38],[28,-41],[38,-45],[10,-15],[2,-9],[0,-17],[2,-8],[6,-11],[18,-18],[31,-62],[3,-12],[-3,-8],[-8,-13],[-3,-11],[4,-2],[8,-2],[4,-7],[-6,-14],[5,-11],[5,-1],[6,1],[7,-4],[6,-9],[9,-22],[6,-10]],[[8010,6235],[6,14],[16,-4],[30,-15],[4,0],[19,4],[3,7],[-2,8],[-1,12],[1,14],[-4,8],[-10,5],[-6,3],[-4,16],[6,15],[12,9],[1,9],[-7,9],[-9,0],[-10,-5],[-23,-11],[-12,-3],[-8,-13],[-6,-8],[-14,-11],[-11,-2],[0,-4],[1,-8],[-6,-6],[-7,-4],[-4,-12],[-1,-13],[4,-8],[18,-5],[24,-1]]],"transform":{"scale":[0.0009372664967496691,0.0009110897661766216],"translate":[19.978345988000115,-26.891794127999987]}};
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
