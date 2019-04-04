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
  Datamap.prototype.btnTopo = {"type":"Topology","objects":{"btn":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Chhukha"},"id":"BT.CK","arcs":[[0,1,2,3,4,5,6]]},{"type":"Polygon","properties":{"name":"Daga"},"id":"BT.DA","arcs":[[7,8,-1,9,10]]},{"type":"Polygon","properties":{"name":"Ha"},"id":"BT.HA","arcs":[[11,-5,12,13]]},{"type":"Polygon","properties":{"name":"Paro"},"id":"BT.PR","arcs":[[-6,-12,14,15]]},{"type":"Polygon","properties":{"name":"Gasa"},"id":"BT.GA","arcs":[[16,17,18,19]]},{"type":"Polygon","properties":{"name":"Samchi"},"id":"BT.SM","arcs":[[-4,20,-13]]},{"type":"Polygon","properties":{"name":"Thimphu"},"id":"BT.TM","arcs":[[21,22,-10,-7,-16,23,-19]]},{"type":"Polygon","properties":{"name":"Punakha"},"id":"BT.PN","arcs":[[24,-22,-18]]},{"type":"Polygon","properties":{"name":"Bumthang"},"id":"BT.BU","arcs":[[25,26,27,28,29,30]]},{"type":"Polygon","properties":{"name":"Chirang"},"id":"BT.CR","arcs":[[31,-8,32]]},{"type":"Polygon","properties":{"name":"Geylegphug"},"id":"BT.GE","arcs":[[33,34,-2,-9,-32,35,36]]},{"type":"Polygon","properties":{"name":"Lhuntshi"},"id":"BT.LH","arcs":[[37,38,-26,39]]},{"type":"Polygon","properties":{"name":"Tashi Yangtse"},"id":"BT.TY","arcs":[[40,41,-38,42]]},{"type":"Polygon","properties":{"name":"Shemgang"},"id":"BT.SG","arcs":[[43,44,45,-34,46,-28]]},{"type":"Polygon","properties":{"name":"Tongsa"},"id":"BT.TO","arcs":[[-47,-37,47,-29]]},{"type":"Polygon","properties":{"name":"Wangdi Phodrang"},"id":"BT.WP","arcs":[[-48,-36,-33,-11,-23,-25,-17,-30]]},{"type":"Polygon","properties":{"name":"Mongar"},"id":"BT.MO","arcs":[[48,49,-44,-27,-39,-42]]},{"type":"Polygon","properties":{"name":"Pemagatsel"},"id":"BT.PM","arcs":[[50,-50,51]]},{"type":"Polygon","properties":{"name":"Samdrup Jongkhar"},"id":"BT.SJ","arcs":[[52,-45,-51,53]]},{"type":"Polygon","properties":{"name":"Tashigang"},"id":"BT.TA","arcs":[[-54,-52,-49,-41,54]]}]}},"arcs":[[[2660,2677],[44,-118],[57,-301],[70,-42],[17,-62],[-4,-34],[-7,-27],[-8,-81],[187,-2],[60,-213],[14,-77],[38,-267],[-50,-188],[-2,-76],[6,-24],[33,-88],[15,-81],[2,-58],[-3,-80],[-8,-73],[-6,-44],[-20,-71],[-6,-18],[-17,-27]],[[3072,625],[-21,-87],[-26,-33],[-31,-146],[13,-126],[22,-61],[18,-34],[5,-21],[0,-64],[-2,-22],[0,-2]],[[3050,29],[-47,14],[-160,128],[-65,6],[-104,-78],[-55,-2],[-37,52],[48,166],[-6,105],[-76,109],[-117,81],[-123,37],[-186,-40],[-106,98],[-114,144]],[[1902,849],[0,2],[-1,129],[-10,94],[-15,7],[-24,1],[-63,-26],[-12,6],[-3,14],[4,22],[0,27],[-9,36],[-15,92],[-22,32],[-61,60],[-17,9],[-12,-3],[-8,-9],[-15,2],[-8,12],[-12,54],[103,129],[115,286],[12,131],[-7,30],[-13,45],[-14,30],[-16,24],[-16,14],[-35,12],[-2,154],[-10,117],[10,70],[15,46],[43,46]],[[1784,2544],[4,110],[33,108],[26,66],[3,43],[-6,30],[-21,39],[-13,32],[-24,123]],[[1786,3095],[208,-8],[84,-29],[39,-29],[50,-51],[25,-13],[91,-23],[28,22],[3,17],[2,21],[-2,18],[-5,20],[-3,23],[-2,43],[1,52],[42,231],[21,77],[10,60],[8,148]],[[2386,3674],[50,-67],[19,-67],[11,-65],[10,-83],[11,-25],[12,-8],[20,13],[94,-47],[15,-19],[6,-49],[-168,-211],[-61,-147],[3,-48],[78,-78],[32,-44],[73,-68],[69,16]],[[3954,2449],[15,-198],[-17,-101],[23,-55],[-3,-135],[-13,-188],[0,-21],[-1,-174],[-29,-159],[-46,-96],[-27,-93],[-53,-53],[-10,-41],[1,-29],[-6,-55],[0,-25],[6,-53],[0,-16]],[[3794,957],[-110,-134],[-11,-24],[-11,-30],[7,-10],[7,-8],[7,-2],[-3,-22],[-13,-4],[-16,6],[-15,18],[-7,26],[-2,40],[-6,46],[-10,41],[-25,36],[-13,2],[-7,-13],[0,-55],[-3,-44],[-8,-50],[-12,-48],[-10,-18],[-11,-4],[-8,11],[-6,12],[-2,17],[-2,15],[-5,32],[-16,-76],[-18,-18],[-76,-52],[-28,-2],[-21,18],[-30,58],[-20,30],[-39,31],[-18,-1],[-9,-12],[3,-49],[-1,-25],[-4,-24],[-5,-16],[-5,-35],[-39,33],[-12,3],[-21,0],[-15,-5],[-53,-26]],[[2660,2677],[29,162],[11,139],[15,74],[15,45],[15,20],[16,17],[34,24],[18,18],[25,46],[20,60],[25,128],[33,-13]],[[2916,3397],[173,66],[63,-64],[89,13],[24,-17],[44,-51],[36,-65],[65,-94],[29,-63],[21,-58],[8,-30],[15,-73],[38,-124],[71,-170],[123,-26],[116,-90],[46,-15],[77,-87]],[[1108,5579],[8,-16],[59,-115],[93,-141],[37,-28],[14,-5],[16,-14],[37,-49],[9,-8],[11,-1],[11,6],[13,11],[16,-4],[15,-40],[54,-297],[9,-74],[27,-100],[36,-52],[21,-41],[20,-25],[10,-95],[34,-87],[79,-249],[47,-114],[124,-323],[-26,-67],[-37,-58],[-19,-17],[-43,-30],[-18,-21],[-17,-34],[-12,-41],[-7,-52],[25,-103],[6,-64],[26,-136]],[[1784,2544],[-137,48],[-64,-52],[-28,-106],[-7,-48],[-39,-109],[-3,-5],[-135,315],[-100,-163],[-45,7],[-8,23],[-7,52],[-6,22],[-6,19],[-5,22],[-8,16],[-5,17],[-4,19],[-4,35],[-11,41],[-215,39],[-57,46],[-5,22],[0,21],[-4,23],[-6,24],[-14,41],[-6,28],[-4,27],[-2,21],[-1,14],[0,12],[0,12],[-2,17],[-5,23],[-6,26],[-1,28],[-13,58],[-9,9],[-10,-2],[-18,-21],[-8,-14],[-17,-24],[-33,-8],[-71,145],[-38,129],[-14,21],[-22,23],[-106,51],[-40,27]],[[435,3515],[25,35],[23,176],[68,92],[106,-16],[63,-95],[75,111],[-47,143],[-52,230],[-38,242],[19,143],[26,127],[50,88],[-9,32],[-14,54],[-7,65],[16,76],[43,43],[36,73],[-6,65],[40,93],[51,19],[19,92],[33,84],[39,46],[82,60],[32,-14]],[[1108,5579],[11,-4],[11,-4],[29,-25],[16,-20],[8,75],[85,231],[126,390],[22,102]],[[1416,6324],[53,-31],[16,-13],[45,-23],[13,-12],[19,-34],[10,-11],[61,-40],[23,-7],[26,10],[32,38],[34,30],[72,8],[30,10],[44,47],[57,32],[-7,-175],[1,-38],[5,-78],[5,-32],[44,-119],[-81,-168],[46,10],[20,-12],[28,-28],[51,-91],[68,-165],[43,-153],[32,-53],[33,-28],[-24,-93],[-6,-76],[-3,-139],[-23,-270],[-3,-226],[21,-65],[24,-22],[13,-5],[37,-25],[12,-25],[7,-46],[4,-61],[-22,-162],[76,-83],[19,-38],[11,-28],[3,-140],[1,-20]],[[5195,8278],[-134,-4],[-65,-89],[-7,-123],[-19,-77],[-32,-89],[-27,-45],[-94,-100],[-18,-57],[-5,-50],[6,-34],[-3,-47],[3,-27],[7,-28],[6,-30],[2,-27],[1,-59],[4,-38],[1,-32],[-8,-32],[-16,-23],[-32,-4],[-18,-7],[-18,0],[-41,20],[-20,-2],[-17,-12],[-18,-28],[-14,-18],[-18,-3],[-25,29],[-41,65],[-58,173],[-7,36],[0,16],[3,15],[3,17],[-4,28],[-10,34],[-50,76],[-48,-3],[-98,-13],[-14,-5],[-14,-19],[-13,-32],[-21,-102],[-126,-390],[-11,-44],[-20,-47],[-26,-50],[-60,-58],[-33,-22],[-61,-19],[-15,-8],[-13,-4],[-14,-2],[-13,-22],[-8,-20],[-16,-195]],[[3788,6647],[-50,22],[-12,14],[-35,47],[-138,100],[-72,108],[-17,20],[-17,4],[-20,-9],[-36,-30],[-21,-13],[-20,-8],[-15,-2],[-39,-14],[-15,-10],[-17,-30],[-18,-45],[-57,-176],[-98,-226],[-85,-12],[-48,-15],[-57,-69],[15,-58],[-118,-66],[-55,34],[-23,9],[-20,1],[-34,-6],[-20,-9],[-12,-9],[-19,-69]],[[2615,6130],[-112,117],[-11,17],[-13,28],[-4,46],[-21,97],[-9,72],[-65,8],[-20,-20],[-7,-20],[-19,-45],[-21,-60],[-10,-6],[-10,1],[-11,9],[-8,9],[-8,12],[-8,13],[-7,15],[-6,18],[-5,16],[-7,40],[24,51],[17,127],[2,48],[-1,40],[-5,34],[-5,47],[6,33],[15,46],[103,242],[14,25],[16,20],[16,14],[21,26],[2,18],[-9,13],[-73,25],[-39,28],[-19,57],[-18,201],[-36,87],[-81,83],[-26,17],[-41,8],[-70,-12]],[[2046,7775],[11,36],[70,220],[42,100],[50,81],[59,40],[59,84],[138,317],[54,60],[54,31],[358,116],[113,92],[53,171],[21,96],[45,69],[101,114],[26,53],[46,116],[27,51],[31,29],[23,-18],[104,109],[108,-45],[57,59],[56,16],[240,148],[156,-60],[89,-79],[68,20],[69,139],[78,59],[108,-139],[0,-217],[88,-228],[114,-33],[72,261],[98,0],[89,-99],[117,0],[147,-199],[128,-19],[117,-80],[30,-198],[-88,-59],[-59,-198],[-98,-20],[-89,-178],[-31,-315]],[[1902,849],[-81,103],[-124,-60],[-41,3],[-38,-6],[-32,-46],[-30,-57],[-35,-42],[-84,-41],[-84,-15],[-168,18],[-94,48],[-42,87],[-24,123],[-41,151],[-47,94],[-69,93],[-74,61],[-64,-6],[-28,-38],[-34,-17],[-35,7],[-31,33],[-21,61],[1,58],[4,62],[-7,74],[-53,117],[-60,-13],[-58,-88],[-46,-113],[-18,297],[0,329],[-14,154],[-40,137],[-66,91],[-187,178],[-28,38],[-9,12],[25,173],[47,198],[64,170],[76,93],[179,84],[44,61]],[[2615,6130],[45,-125],[7,-22],[14,-147],[2,-119],[-10,-73],[0,-40],[8,-48],[15,-55],[25,-55],[18,-54],[23,-98],[16,-55],[40,-69],[37,-101],[80,116],[122,72],[21,-58],[49,-133],[5,-31],[16,-35],[9,-13],[71,-18]],[[3228,4969],[7,-54],[-2,-31],[-5,-61],[-12,-76],[-46,-77],[-156,-79],[-14,-111],[-4,-114],[22,-122],[-158,-248],[24,-50],[23,-32],[9,-9],[5,-14],[1,-62],[-6,-66],[0,-366]],[[1416,6324],[32,142],[25,221],[101,119],[121,100],[109,150],[101,242],[141,477]],[[3788,6647],[4,-180],[-29,-102],[-30,-47],[-46,-90],[-11,-29],[-8,-33],[-7,-45],[-2,-67],[3,-60],[24,-44],[21,-20],[20,-5],[39,12],[21,-3],[22,-17],[21,-35],[24,-53],[24,-43],[10,-28],[1,-45],[-8,-37],[-42,-78],[-68,-40],[-76,-184],[-104,-156],[0,-2],[-15,-91],[-69,-105],[-148,-66],[-4,0],[-123,15],[-4,0]],[[6029,8175],[-14,-190],[0,-61],[3,-48],[10,-60],[3,-142],[-6,-45],[-9,-26],[-29,-34],[-14,-28],[-7,-30],[-4,-42],[-15,-51],[3,-28],[11,-32],[35,-53],[21,-21],[18,-12],[34,-13],[15,-11],[17,-35],[44,-188],[8,-155],[42,-36],[43,-79],[23,-60],[17,-33],[13,-15],[21,-8],[12,-11],[30,-34],[18,-13],[10,-39],[29,-234],[0,-141],[7,-19],[20,-18],[47,-11],[13,-6],[14,-16],[83,-145],[11,-43],[9,-61],[11,-137],[5,-140],[-21,-126],[-27,-156],[-4,-41],[-1,-22],[26,-107],[7,-143],[-1,-37],[-8,-32],[-3,-25],[6,-33],[16,-38],[34,-44],[46,-112],[-46,-183],[-14,-33],[-14,-29],[-5,-40],[0,-28],[46,-168]],[[6668,4174],[-61,-36],[-9,-10],[-44,-80]],[[6554,4048],[-9,-60],[-8,-16],[-19,-20],[-23,-18],[-68,-5],[-38,-53],[-35,-11],[-93,-75],[-94,80],[-36,70],[-6,26],[-7,21],[-26,38],[-25,48],[-12,18],[-18,8],[-14,3],[-17,-1],[-19,-5],[-20,-19],[-16,-21],[-15,-129]],[[5936,3927],[-163,323],[-60,78],[-22,20],[-40,23],[-27,21],[-16,21],[-13,36],[-9,16],[-12,10],[-31,12],[-73,47],[-24,121],[16,75],[-12,153],[-70,429],[-24,27],[-11,75],[-12,165],[-7,17],[-14,22],[-4,25],[0,45],[5,72],[1,47],[3,35],[22,130],[7,158],[0,71],[-4,53],[-6,28],[-7,23],[-35,92],[-8,17],[-14,15],[-16,11],[-17,2],[-13,-4],[-10,-6],[-9,2],[-9,12],[-9,16],[-24,35]],[[5165,6497],[-22,239],[3,25],[7,30],[10,-2],[16,18],[18,45],[33,115],[16,175],[-3,57],[-4,35],[-6,24],[-8,22],[-7,23],[-6,44],[-5,28],[-8,24],[-8,10],[-10,8],[-36,15],[-7,10],[-7,22],[-9,39],[-8,46],[-8,28],[-9,21],[-3,13],[1,14],[4,12],[7,14],[8,23],[9,30],[8,55],[-1,42],[-7,42],[-65,152],[47,142],[90,141]],[[5195,8278],[52,13],[52,-2],[194,-50],[66,29],[73,14],[87,84],[49,20],[49,-19],[128,-153],[84,-39]],[[4712,2853],[56,-131],[-43,-52],[-35,-34],[-48,-59],[-23,-36],[-42,-80],[-9,-37],[-6,-120],[-7,-58],[-29,-147],[-46,-86],[6,-205],[-47,-138],[-51,-95],[-25,-82],[-2,-61],[-21,-67],[-46,-55],[-106,-290],[-3,-23],[1,-19],[3,-15],[2,-13],[1,-16],[0,-43],[-11,-23],[-19,-14],[-53,-20],[-31,-21],[-38,-48],[-14,-36],[-16,-29],[-24,-21],[-67,25],[-40,13],[-19,24],[-33,87],[-5,70],[-28,59]],[[3954,2449],[-4,414],[62,28],[153,-122],[40,-11],[105,14],[44,26],[15,1],[11,-9],[44,-68],[31,-32],[28,-50],[87,87],[65,37],[77,89]],[[5319,2584],[18,-95],[53,-98],[50,-70],[76,-75],[43,-32],[17,-9],[16,0],[15,11],[25,24],[25,18],[70,-67],[27,-57],[13,-38],[4,-64],[7,-52],[18,-38],[6,-32],[0,-63],[3,-35],[9,-48],[2,-28],[-6,-47],[-18,-50],[14,-95],[28,-26],[89,-25],[15,-17],[20,-33],[25,-71],[19,-40],[13,-13],[17,-7],[13,-16],[15,-35],[28,-31],[22,-72],[7,-38],[31,-108],[6,-31],[13,-126],[19,-79],[16,-33],[17,-15],[50,21],[110,-19],[28,-12],[15,-4],[109,15],[11,6],[11,12],[50,43],[29,-240],[-7,-12],[-8,-8],[-19,-11],[-5,-20],[-1,-1]],[[6592,498],[-677,-72],[-385,79],[-335,315],[-275,357],[-101,29],[-60,-36],[-43,-62],[-40,-73],[-49,-67],[-54,-33],[-110,8],[-54,-9],[-100,-116],[-75,-363],[-75,-123],[-113,-58],[-339,-59],[-188,-91],[-65,-11],[-30,8],[-60,34],[-4,1],[-24,7],[-11,10],[-24,38],[-12,2],[-15,-24],[-6,-31],[-2,-27],[-1,-13],[0,-14],[-5,-35],[-9,-40],[-14,-29],[-11,0],[-29,22],[-12,4],[-118,-2],[-17,5]],[[4712,2853],[1,94],[28,64],[42,76]],[[4783,3087],[188,-192],[96,-141],[38,-42],[23,-48],[17,-21],[14,-11],[13,-6],[12,-4],[13,3],[18,0],[16,-5],[44,-26],[44,-10]],[[8057,7779],[-52,-103],[-45,-72],[-15,-14],[-15,-3],[-29,16],[-14,1],[-17,-18],[-95,-205],[-15,-18],[-14,-9],[-13,-3],[-13,-9],[-9,-28],[-4,-34],[2,-70],[-8,-499],[-14,-103],[1,-67],[-7,-99],[-14,-70],[-12,-44],[-6,-44],[2,-42],[21,-138],[1,-45],[-14,-146],[13,-365],[-30,-128],[37,-95]],[[7679,5325],[-30,-16],[-12,-3],[-15,-15],[-9,-29],[4,-99],[-5,-48],[-72,-106],[-30,-59],[-23,-101],[17,-74],[22,-52],[5,-27],[-5,-109],[-39,-181],[-240,-232],[-69,194],[-20,23],[-57,20],[-52,5],[-63,-38],[-165,-261],[-153,57]],[[6029,8175],[100,-46],[185,-21],[174,-68],[152,-229],[44,-76],[100,-92],[128,-24],[121,54],[80,138],[0,1],[1,0],[42,116],[125,261],[56,79],[77,26],[76,-21],[71,8],[61,112],[57,-211],[95,-155],[231,-216],[52,-32]],[[8922,4594],[-1,-10],[-7,-34],[-17,-37],[-23,-19],[-81,-22],[-103,-77],[-175,-101],[-33,-4],[-68,-144],[-13,-21],[-73,-51],[-10,-25],[-276,172],[-115,24]],[[7927,4245],[48,168],[6,52],[-3,23],[-38,163],[-207,499],[-54,175]],[[8057,7779],[30,-18],[43,-12],[109,-2],[119,-88],[122,-28],[66,-33],[63,-51],[48,-66],[44,-139],[-12,-117],[-35,-120],[-26,-148],[-3,-138],[17,-423],[-19,-259],[-139,-351],[-20,-230],[65,-442],[28,-85],[85,-123],[26,-101],[47,-95],[68,-38],[73,-24],[66,-53],[0,-1]],[[6554,4048],[37,-207],[24,-97],[28,-198],[29,-130],[10,-12],[44,-74],[8,-34],[4,-25],[1,-101],[29,-73],[4,-97],[-4,-96],[-5,-38],[-19,-88],[-20,-107],[6,-161],[97,-388],[112,-61],[14,-17],[36,-66],[27,-274],[17,-31],[25,-39],[26,-7],[22,-19],[30,-39],[21,-58],[23,-38],[25,-21],[14,-2],[34,38],[53,-8]],[[7306,1480],[-33,-219],[-31,-92],[-52,-39],[-140,-11],[-27,-111],[-9,3],[-12,8],[-6,-1],[-38,-43],[-130,-52],[-18,-18],[-21,-31],[-15,-44],[-4,-35],[-9,-41],[-2,-22],[0,-26],[36,-174],[1,-1]],[[6796,531],[-16,-14],[-188,-19]],[[5319,2584],[33,62],[49,37],[21,27],[39,67],[21,22],[17,5],[14,-17],[13,-22],[14,-16],[18,-9],[110,14],[17,11],[5,14],[-4,17],[-84,203],[-21,66],[218,183],[85,110],[8,29],[-1,20],[-2,16],[-1,16],[1,16],[0,19],[-1,22],[-6,41],[5,67],[28,127],[21,196]],[[4783,3087],[56,144],[16,99],[-2,80],[-50,55],[-13,171],[-13,59],[-21,44],[-90,144],[-12,35],[-6,27],[2,20],[0,24],[3,22],[-38,85],[-48,152],[-15,184],[-9,48],[-53,165],[107,47],[18,23],[52,89],[26,25],[40,20],[23,3],[17,-6],[15,-15],[10,3],[8,10],[10,21],[13,19],[32,56],[-87,78],[-32,71],[-52,198],[-6,28],[-12,53],[-2,17],[-3,23],[-6,26],[-14,51],[-5,33],[1,42],[40,95],[9,37],[6,109],[6,38],[7,26],[12,28],[10,13],[11,3],[10,-6],[11,-10],[11,-5],[11,-1],[17,2],[25,10],[21,14],[17,7],[15,1],[30,-39],[14,-9],[15,0],[136,104],[32,43],[15,47],[12,65],[27,280],[2,85]],[[7927,4245],[14,-74],[-30,-55],[71,-82],[42,-72],[79,-81],[15,-22],[6,-26],[2,-24],[18,-59],[6,-29],[2,-21],[1,-22],[7,-74],[-119,-110],[-116,-204],[-21,-102],[-8,-307],[-8,-73]],[[7888,2808],[-7,-60],[-24,-145],[-33,-137],[-38,-110],[-58,-86],[-202,-163],[-62,-90],[-52,-113],[-81,-260],[-25,-164]],[[8219,1933],[-113,-64],[-8,-52],[-52,-181],[-5,-39],[-3,-65],[10,-82],[1,-36],[-10,-47],[-43,-131],[-39,-79],[-33,-56],[-23,-47],[-25,-51],[-31,-114],[-38,-25],[-82,57],[25,178],[10,24],[3,31],[1,26],[-36,144],[-68,11],[-29,34],[-21,33],[-18,57],[-17,16],[-29,9],[-116,-26],[-83,15],[-41,7]],[[7888,2808],[124,-28],[-41,-128],[-30,-67],[-5,-43],[1,-28],[21,-56],[29,-92],[12,-25],[10,-15],[63,-77],[13,-20],[40,-36],[107,-2],[5,-7],[-18,-251]],[[9752,2887],[-8,-21],[-22,-88],[-15,-103],[-8,-112],[-1,-109],[36,-196],[149,-269],[51,-192],[51,-346],[-11,-95],[-23,-203],[-110,-198],[-180,-50],[-53,46],[-95,147],[-52,39],[-44,-23],[7,-79],[0,-88],[-64,-56],[35,-81],[3,-98],[-25,-69],[-46,10],[-32,83],[-8,98],[-17,88],[-56,54],[-89,-29],[-189,-225],[-88,-76],[-144,-34],[-47,7],[-132,70],[-54,-3],[-108,-68],[-55,-8],[-40,63],[-68,269],[-28,77],[-43,23],[-120,13],[-42,-12],[-53,-67],[-31,-94],[-24,-109],[-34,-111],[-39,-69],[-46,-56],[-50,-41],[-49,-24],[-62,-3],[-41,30],[-88,97],[-102,43],[-212,-9],[-105,23],[-89,-1],[-146,-121]],[[8219,1933],[43,-46],[1,0],[239,248],[135,-54],[403,257],[67,217],[61,98],[138,81],[77,23],[43,-5],[7,11],[3,22],[5,193],[-6,112],[7,91],[15,70],[14,23],[15,5],[14,-18],[11,-22],[6,-28],[15,-97],[7,-35],[17,-61],[5,-26],[7,-26],[14,-22],[24,-25],[27,-14],[27,-8],[84,-7],[7,-3],[1,0]],[[8922,4594],[50,-125],[3,-92],[16,-46],[88,16],[231,146],[80,25],[109,-13],[38,24],[88,119],[36,22],[66,-143],[260,-869],[12,-72],[-21,-103],[-93,-143],[-41,-90],[-11,-54],[-9,-114],[-9,-52],[-16,-48],[-39,-75],[-8,-20]]],"transform":{"scale":[0.0003359045621562224,0.0001662415778363971],"translate":[88.73006677200004,26.696149394000116]}};
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
