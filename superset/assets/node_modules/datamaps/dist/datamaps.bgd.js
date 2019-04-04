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
  Datamap.prototype.bgdTopo = {"type":"Topology","objects":{"bgd":{"type":"GeometryCollection","geometries":[{"type":"MultiPolygon","properties":{"name":"Dhaka"},"id":"BD.DA","arcs":[[[0]],[[1,2,3,4,5,6,7,8]]]},{"type":"MultiPolygon","properties":{"name":"Khulna"},"id":"BD.KH","arcs":[[[9]],[[-6,10,11,12]]]},{"type":"MultiPolygon","properties":{"name":"Barisal"},"id":"BD.BA","arcs":[[[13]],[[14]],[[15]],[[16]],[[17]],[[18]],[[19]],[[20]],[[21]],[[22]],[[23]],[[24]],[[25]],[[26]],[[27,-11,-5]]]},{"type":"MultiPolygon","properties":{"name":"Chittagong"},"id":"BD.CG","arcs":[[[28]],[[29]],[[30]],[[31]],[[32]],[[33,-3,34]]]},{"type":"Polygon","properties":{"name":"Sylhet"},"id":"BD.SY","arcs":[[-35,-2,35]]},{"type":"Polygon","properties":{"name":"Rajshahi"},"id":"BD.RJ","arcs":[[-7,-13,36,37]]},{"type":"Polygon","properties":{"name":"Rangpur"},"id":"BD.RP","arcs":[[-8,-38,38]]}]}},"arcs":[[[5448,4437],[82,-45],[19,-37],[-79,42],[-44,12],[-12,-19],[-38,-14],[-42,8],[-39,22],[-68,51],[-23,24],[6,16],[57,-1],[78,-20],[103,-39]],[[6303,7506],[-6,-73],[32,-74],[-1,-23],[-7,-17],[-23,-25],[-19,-28],[-24,-61],[141,-167],[62,-20],[257,19],[29,-77],[15,-35],[7,-75],[-15,-89],[14,-31],[12,-3],[10,0],[12,2],[17,1],[66,-2],[23,-8],[12,-13],[10,-20],[-2,-13],[-7,-10],[-9,-9],[-6,-10],[-2,-11],[0,-10],[-2,-11],[-6,-9],[-17,-7],[-22,-6],[-12,-5],[1,-13],[27,-24],[11,-18],[14,-11],[11,-7],[39,-15],[-30,-57],[-23,-31],[-19,-19],[-14,-12],[-7,-3],[-2,-6],[0,-7],[17,-14],[17,-7],[23,-1],[26,-9],[8,-31],[4,-9],[-2,-21],[-36,-18],[47,-31],[13,-11],[11,-13],[5,-12],[-12,-16],[-15,-3],[-23,-19],[29,-34],[-47,-24],[-73,-23],[-32,-58],[-17,-12],[-17,-20]],[[6776,5977],[-28,-14],[-37,-9],[-42,-3],[-20,-8],[0,-18],[5,-19],[-6,-13],[-15,-2],[-16,5],[-30,16],[-71,-71],[-25,-7],[-25,-5],[-13,-6],[10,-33],[-3,-8],[38,-40],[-15,-24],[42,-19],[-17,-35],[-42,-35],[-35,-16],[-25,-17],[-19,-40],[9,-32],[-10,-42],[-45,-71],[-82,-83],[-30,-17],[-20,-8],[-13,2],[-12,3],[-16,6],[-49,24],[-13,-6],[-15,-5],[-14,-3],[-16,-2],[-66,2],[-16,-2],[-14,-4],[-14,-7],[-14,-8],[-12,-11],[-8,-11],[-2,-14],[12,-37],[1,-13],[-3,-12],[-45,-84],[-34,-37],[-4,-15],[7,-11],[32,-16],[12,-8],[9,-11],[5,-12],[-1,-12],[-17,-23],[-19,-13],[58,-43],[18,-19],[-5,-9],[-33,-3],[-25,-10],[-10,-14],[16,-19],[-22,-18],[-47,-22],[-20,-21]],[[5800,4785],[-14,1],[-38,-1],[-6,-7],[19,-15],[39,-23],[-15,-35],[-38,16],[-24,2],[-42,-18],[-55,-13],[-31,-15],[-9,6],[-33,67],[9,48],[34,39],[55,19],[-14,12],[-3,-7],[-1,-2],[-2,-1],[-10,-2],[-16,16],[-36,-3],[-80,-24],[13,-23],[-11,-15],[-27,-7],[-34,-2],[-36,2],[-28,7],[-55,26],[18,-27],[30,-17],[36,-10],[35,-4],[81,-3],[18,-13],[4,-152],[-6,-19],[-17,-10],[-18,-25],[-13,-30],[-4,-27],[-73,23],[-424,59],[-82,22],[-74,36],[-2,-20],[20,-18],[281,-123],[34,-20],[20,-22],[14,-21],[19,-16],[68,-11],[60,-21],[34,-9],[142,-12],[18,-11],[63,-70],[9,-28],[8,-60],[-9,10],[-16,17],[-20,15],[10,-33],[10,-101],[-8,-40],[-59,-61],[-14,-10],[-25,5],[-6,14],[10,17],[21,12],[0,11],[-15,0],[-24,-23],[-23,-17],[-30,-12],[-42,-7],[-81,2],[-27,-8],[-10,-28],[2,-11]],[[5254,3926],[-5,-3],[-10,-16],[-8,-6],[-37,-16],[-57,19],[-29,21],[-49,27],[-44,8],[-26,4],[-6,-4],[-26,-6],[-24,-11],[-20,-28],[21,-2],[34,3],[17,-9],[2,-30],[-2,1],[-4,-9],[-9,-9],[-4,-10],[-17,-11],[-23,-28],[-22,-11],[-13,-1],[-19,-2],[-25,8],[-31,15],[-42,37],[-12,28],[-5,44],[-7,13],[-13,13],[-18,6],[-24,3],[-106,-15],[-20,-26],[-17,-32],[-40,-15],[-36,-27],[-18,-20],[-43,-30],[-11,-10],[-30,-48],[-54,-54],[-52,-38],[-30,-12],[-37,-6],[-77,-9]],[[4126,3622],[-1,0],[-88,34],[-17,10],[-43,37],[-14,6],[-32,11],[-12,7],[-10,12],[-12,31],[-9,16],[-29,28],[-69,46],[-35,30],[-53,82],[-21,22],[-17,8],[-37,5],[-19,12],[-9,10],[-7,13],[-3,16],[2,19],[42,-26],[23,-6],[16,24],[33,34],[14,7],[27,7],[7,15],[-12,16],[-30,9],[-26,-5],[-18,-11],[-19,-10],[-27,3],[-32,30],[7,35],[-5,29],[-116,23],[19,25],[43,31],[24,26],[-64,-1],[-55,46],[-32,64],[2,54],[16,0],[8,-9],[9,-6],[28,-9],[-41,140],[-20,34],[-42,29],[-67,27],[-63,4],[-35,-37],[-8,10],[-6,12],[-2,12],[3,13],[14,6],[29,16],[20,17],[-12,8],[-23,8],[-13,18],[-9,22],[-14,17],[-27,22],[-129,138],[-22,8],[-28,-2],[-36,-7],[-62,-3],[-89,82],[-7,15],[112,211],[3,33],[-4,14],[-32,68]],[[2863,5407],[1,-1],[71,-34],[193,-60],[49,-21],[87,-56],[55,-8],[38,8],[66,31],[35,10],[120,8],[49,9],[0,20],[-23,79],[-5,26],[9,37],[28,52],[185,111],[27,18],[20,24],[17,23],[5,60],[22,29],[-7,3],[5,24],[8,25],[-7,11],[-2,7],[4,15],[-8,16],[-39,7],[-1,37],[-2,9],[-7,6],[-24,13],[-58,46],[-4,6],[-12,6],[-4,2],[-2,3],[-2,15],[2,66],[-14,65],[0,17],[20,122],[2,64],[18,53],[3,33],[-2,32],[-6,21],[11,18],[24,21],[16,43],[0,21],[-10,33],[3,19],[23,77],[-1,36],[-11,31],[-14,18],[-17,16],[-40,26],[-64,24],[-37,19],[-22,17],[-29,41],[-19,34],[-53,183],[-3,15],[13,142],[20,90],[28,91]],[[3591,7511],[49,73],[20,23],[26,22],[32,33],[12,43],[-19,92],[49,84],[6,12],[13,13],[31,14],[36,5]],[[3846,7925],[-9,-49],[7,-58],[20,-60],[25,-33],[34,-5],[77,23],[82,2],[480,-145],[339,-54],[168,-51],[76,-1],[220,33],[178,-11],[86,16],[31,-1],[25,-5],[46,-16],[81,-10],[18,1],[13,6],[23,17],[11,4],[35,-3],[28,-12],[27,-14],[31,-12],[61,-5],[244,24]],[[2430,1700],[-27,-30],[-65,26],[-110,96],[0,6],[14,11],[14,32],[-1,33],[-22,56],[-6,27],[-14,29],[2,16],[26,1],[9,-4],[7,-8],[6,-10],[8,-24],[22,-115],[24,-50],[50,-21],[50,-24],[13,-47]],[[4126,3622],[31,-22],[41,-51],[-30,-18],[-5,-1],[-17,2],[-6,0],[-7,-4],[-7,-9],[-8,-12],[-1,-6],[2,-4],[6,-4],[8,-6],[1,-6],[-5,-7],[-10,-4],[-12,-4],[-10,-4],[-8,-12],[0,-13],[3,-9],[5,-6],[20,-8],[10,-8],[-2,-7],[-9,-8],[-66,-31],[-20,-18],[1,-8],[13,-5],[55,-4],[18,-5],[12,-12],[2,-12],[-4,-12],[-6,-4],[-9,-1],[-10,4],[-11,2],[-12,-1],[-12,-6],[1,-7],[23,-16],[14,-14],[25,-52],[7,-5],[28,-13],[13,-9],[7,-12],[10,-25],[1,-21],[-2,-17],[-3,-8],[-19,-31],[-5,-12],[-3,-15],[2,-8],[7,-7],[34,-13],[2,-1],[4,-6],[5,-5],[18,-39]],[[4236,2942],[-69,-52],[-30,-27],[-12,-27],[-17,-27],[-37,8],[-66,37],[5,-35],[12,-29],[8,-29],[-8,-36],[-91,-127],[27,-36],[22,-60],[25,-115],[3,-59],[-6,-29],[-18,-22],[-36,-14],[-32,2],[-33,7],[-41,0],[0,-13],[45,-14],[38,-18],[26,-26],[10,-40],[-3,-16],[-11,-31],[1,-18],[8,-16],[30,-33],[17,-33],[21,-19],[12,-22],[-14,-27],[-16,-4],[-48,-7],[-56,-36],[-12,-12],[-4,-7],[-8,-7],[-20,-9],[-40,-12],[-23,-2],[-10,8],[-11,25],[-27,-5],[-32,-16],[-28,-10],[-36,2],[-40,7],[-37,10],[-26,16],[-10,13],[-8,18],[-1,19],[23,30],[-4,16],[-31,33],[-61,-94],[25,-31],[42,-43],[48,-38],[43,-16],[19,-16],[-23,-34],[-47,-24],[-54,10],[-26,12],[-24,1],[-54,-8],[-6,-9],[24,-46],[5,-14],[-41,-31],[-46,21],[-62,69],[4,30],[-25,70],[6,39],[18,22],[40,34],[16,26],[7,28],[-9,123],[17,99],[11,35],[52,67],[12,37],[-8,37],[-19,35],[-26,32],[-30,25],[-1,24],[66,63],[18,29],[2,36],[8,35],[14,33],[20,30],[-24,-13],[-20,-22],[-29,-46],[-26,-19],[-8,-15],[20,-39],[-13,-15],[-41,-23],[-26,-30],[2,-22],[46,-59],[11,-21],[5,-16],[1,-39],[-5,-20],[-22,-32],[-5,-17],[-17,-109],[-11,-24],[-40,-16],[-18,26],[-3,76],[6,18],[22,35],[2,22],[-98,169],[-5,35],[10,76],[-3,34],[-21,36],[-16,0],[-18,-112],[18,-215],[16,0],[2,24],[10,22],[12,13],[6,-5],[3,-15],[7,-21],[11,-20],[14,-15],[11,-19],[-2,-25],[-18,-43],[-10,-8],[-27,-3],[-5,-6],[2,-12],[5,-8],[9,-9],[8,-20],[26,-41],[16,-15],[4,-12],[-20,-90],[-23,-20],[-28,-16],[-29,-19],[-24,-30],[-2,-24],[7,-28],[6,-41],[-8,-39],[-21,-33],[-29,-26],[-79,-50],[-24,-2],[-56,46],[-11,25],[-3,44],[6,76],[12,31],[28,52],[6,40],[-9,34],[-41,58],[-9,29],[-16,0],[-14,-26],[6,-22],[14,-21],[10,-24],[0,-27],[-8,-16],[-37,-26],[-22,-21],[-13,-17],[-36,-63],[-10,-14],[-11,0],[-12,22],[-15,0],[1,-43],[22,-66],[-8,-42],[-37,-59],[6,-19],[45,-16],[-25,-21],[-37,-20],[-43,-14],[-42,-3],[-41,17],[-13,32],[8,30],[23,14],[4,18],[-67,139],[-3,15],[-1,20],[-10,7],[-20,-10],[-20,-16],[-9,-15],[-13,-8],[-29,6],[-47,18],[-22,14],[-10,11],[-53,139],[-5,28],[6,35],[23,72],[1,39],[-16,36],[-48,48],[-10,27],[13,78],[-7,32],[1,1],[38,34],[-4,41],[-12,34],[-19,29],[-94,90],[-21,35],[32,16],[-36,45],[-12,21],[-26,90],[0,17],[6,18],[18,22],[4,13],[-9,40],[-40,67],[-19,63],[-26,15],[-67,19],[48,24],[13,39],[-9,46],[-21,43],[-27,36],[-9,38],[-7,22],[-26,49],[-5,31],[15,23],[24,21],[23,26],[9,23],[9,33],[4,33],[-5,23],[-25,17],[-61,14],[-25,23],[-46,80],[-23,26],[-41,38],[-8,19],[1,33],[20,49],[6,87],[29,43],[118,91],[58,34],[19,16],[11,19],[0,14],[-12,8],[-59,-2],[-20,4],[-18,6],[-151,38],[-37,6],[-28,-4],[-19,-9],[-15,-10],[-17,-5],[-23,0],[-142,33],[-29,19],[-21,33],[-2,37],[20,32],[52,61],[105,202],[5,37],[-29,17],[-28,-16],[-25,-29],[-27,-7],[-32,46],[-24,7],[-63,32],[-37,28],[-50,66],[-33,26],[-17,2],[-43,-3],[-22,7],[-21,16],[-1,11],[7,13],[4,21],[-11,7],[-22,3],[-20,8],[-3,19],[45,154],[-3,16],[-16,26],[1,16],[11,18],[31,36],[11,20],[1,15],[-5,16],[-2,15],[7,16],[34,20],[43,2],[45,-3],[41,6],[29,17],[82,58],[21,19],[7,31],[-6,36],[-13,32],[-15,20],[26,33],[26,24],[-1,17],[-52,8],[-7,22],[-41,25],[-11,20],[3,15],[14,36],[3,19],[-10,35],[-1,16],[12,21],[22,15],[48,13],[34,12]],[[1536,5864],[2,-13],[8,-13],[34,-37],[14,-9],[52,-20],[32,-17],[17,-6],[43,-5],[39,7],[140,47],[29,14],[21,21],[23,1],[20,-3],[20,-6],[20,-8],[17,-11],[50,-47],[49,-35],[22,-13],[8,-8],[9,-15],[4,-14],[6,-13],[15,-14],[15,-12],[14,-14],[9,-15],[0,-18],[-7,-21],[-3,-17],[6,-15],[21,-18],[84,-51],[46,-21],[47,-16],[59,-8],[179,13],[59,-3],[54,-9],[50,-15]],[[5559,2033],[-22,-39],[-18,9],[-15,0],[-18,-34],[-35,-37],[-43,-24],[-38,1],[0,13],[16,3],[27,7],[17,2],[-18,19],[-11,9],[-16,8],[14,11],[0,13],[-3,15],[5,18],[9,12],[9,8],[146,73],[0,-34],[8,-9],[8,-11],[12,-27],[-34,-6]],[[4999,1887],[-20,-9],[-9,4],[0,79],[8,41],[21,37],[47,65],[38,30],[50,9],[-8,-37],[-55,-67],[-51,-133],[-21,-19]],[[5029,2096],[-14,0],[14,36],[27,50],[33,38],[30,5],[-14,-43],[-61,-51],[-15,-35]],[[5215,1986],[-35,-12],[-29,11],[-17,25],[0,29],[11,24],[15,18],[12,21],[5,36],[-5,54],[8,16],[28,17],[14,-12],[83,-64],[27,-45],[-21,-54],[-46,-21],[-50,-43]],[[5608,2422],[-43,-105],[0,17],[-4,11],[-12,20],[-25,-59],[-13,-64],[-19,-59],[-47,-40],[-40,-9],[-23,8],[-10,19],[-2,23],[12,15],[76,49],[-13,11],[-93,-39],[-11,-17],[-14,0],[4,39],[13,37],[25,28],[38,10],[28,13],[57,47],[27,0],[19,19],[25,18],[25,10],[20,-2]],[[6345,2497],[6,-16],[0,-92],[-17,-39],[-43,-8],[-22,26],[3,47],[15,51],[18,38],[13,-13],[12,12],[9,1],[6,-7]],[[6418,2475],[-25,-16],[2,91],[12,33],[31,-9],[1,-31],[-6,-37],[-15,-31]],[[6423,2621],[-81,-93],[-34,11],[7,23],[22,29],[14,24],[7,77],[13,41],[22,27],[16,-12],[13,-26],[8,-31],[2,-35],[-9,-35]],[[5650,2876],[32,-41],[24,-47],[5,-40],[-24,34],[-6,13],[-15,-30],[14,-68],[-14,-29],[-12,15],[-2,18],[1,19],[-2,17],[15,0],[-14,31],[-17,67],[-14,30],[-13,6],[-14,-2],[-12,3],[-5,22],[5,11],[13,3],[15,-2],[11,-6],[29,-24]],[[5695,2875],[-14,-10],[13,100],[6,-5],[11,-1],[9,-19],[4,-18],[0,-33],[-22,-9],[-7,-5]],[[6072,2402],[-115,-130],[-38,-24],[-3,7],[-13,17],[-49,-38],[-20,-9],[-57,-70],[-19,-5],[-27,-11],[-27,-8],[-23,2],[-17,37],[26,49],[40,51],[26,47],[-121,-128],[-35,-5],[-14,34],[9,48],[25,49],[31,37],[-24,38],[21,63],[90,143],[11,28],[7,32],[0,99],[13,30],[-17,50],[-5,33],[9,21],[0,11],[-25,31],[-25,103],[-25,41],[-34,22],[-122,64],[-36,7],[-10,62],[5,59],[48,140],[15,19],[23,13],[38,10],[38,7],[42,3],[22,-50],[24,-60],[27,-48],[37,-55],[31,-40],[34,-31],[34,-40],[16,-82],[27,-53],[51,-37],[95,-63],[45,-40],[-44,-162],[3,-274],[-18,-44]],[[5593,3634],[44,-34],[40,-14],[39,-35],[32,-34],[-34,-5],[-75,11],[-80,3],[-63,-43],[-33,-8],[-32,-25],[-4,-42],[10,-27],[-29,-29],[-22,19],[-28,19],[-3,16],[-8,17],[-22,11],[-58,13],[18,19],[3,16],[-6,47],[1,31],[6,30],[16,23],[29,9],[74,-10],[36,4],[14,23],[18,2],[86,1],[31,-8]],[[5677,3799],[47,-26],[0,-11],[-55,-1],[-18,1],[24,-12],[22,-14],[17,-16],[10,-17],[-67,6],[-20,6],[-16,13],[-26,34],[-18,11],[-23,5],[-8,-3],[-8,-7],[-19,-6],[-23,-2],[-59,-1],[-23,3],[-34,39],[43,54],[72,43],[54,3],[45,-28],[83,-74]],[[5314,3863],[-18,-8],[-18,70],[-11,24],[83,0],[18,3],[17,7],[14,-16],[-3,-13],[-33,-23],[-49,-44]],[[5254,3926],[10,-37],[30,-53],[40,-51],[43,-41],[5,-9],[-3,-20],[6,-12],[5,-2],[9,0],[9,-2],[6,-6],[26,-15],[9,-12],[-11,-16],[-32,-11],[-33,2],[-31,6],[-31,-2],[-41,-38],[-20,-56],[-26,-48],[-61,-10],[35,-22],[-9,-23],[-29,-8],[-26,20],[-47,-23],[31,-17],[62,-15],[42,-16],[20,31],[37,-5],[38,-23],[24,-25],[6,-18],[8,-53],[27,-55],[8,-59],[-6,-12],[-21,-20],[-19,-8],[-50,-5],[-20,-10],[-12,-25],[-25,-95],[0,-25],[6,18],[14,10],[14,7],[11,11],[1,18],[-6,34],[5,18],[21,23],[32,14],[38,4],[41,-5],[78,-35],[39,-49],[25,-57],[37,-59],[-33,9],[-11,4],[0,-38],[16,-31],[43,-61],[11,-34],[1,-35],[-12,-70],[-69,-130],[-51,-59],[-43,-8],[-57,-23],[-23,-15],[-10,-15],[-5,-23],[-13,-26],[-62,-80],[-21,-19],[-24,-8],[-29,5],[-37,12],[-31,15],[-14,13],[12,43],[53,80],[9,41],[-25,48],[-5,23],[13,53],[-6,21],[-36,7],[9,-35],[-22,-76],[5,-24],[18,-11],[14,-5],[11,-6],[8,-17],[-3,-13],[-10,-12],[-17,-12],[-3,-3],[-4,-3],[-4,-6],[-6,-24],[-9,1],[-10,4],[-8,-4],[-7,-17],[-7,-53],[-8,-21],[-9,-15],[-40,-44],[-27,-23],[-6,-6],[-9,-30],[-42,-62],[-9,-31],[-9,-65],[-21,-63],[-16,-33],[-22,-23],[-120,-75],[-30,-15],[-41,-6],[-44,5],[-81,25],[-39,6],[-34,14],[-10,28],[15,21],[37,-5],[-16,24],[12,16],[22,16],[12,20],[-4,15],[-6,9],[-1,11],[11,17],[-22,-21],[-38,-69],[-21,-15],[-21,-5],[-27,-23],[-19,-7],[-19,3],[-28,17],[-26,2],[15,46],[6,92],[24,39],[20,12],[25,11],[24,14],[19,20],[10,26],[5,22],[7,20],[21,24],[89,59],[11,10],[15,21],[11,10],[19,7],[20,-4],[17,-7],[12,-2],[45,23],[34,39],[16,45],[-7,45],[-38,-73],[-27,-39],[-31,-17],[-58,-5],[-36,-16],[-128,-101],[-16,-17],[-17,-37],[-27,-32],[-7,-12],[-12,-8],[-31,-4],[-22,3],[-68,20],[12,24],[2,26],[17,20],[20,13],[19,7],[14,12],[6,26],[-8,51],[10,19],[8,25],[20,17],[24,8],[21,10],[12,21],[-56,-15],[-27,-29],[-34,-84],[-19,-19],[-58,-42],[-13,-14],[5,-77],[-5,-22],[-32,-20],[-39,11],[-33,28],[-14,33],[-4,17],[-19,39],[-6,20],[-5,125],[-20,71],[-5,42],[-6,17],[-27,32],[-11,17],[-8,22],[-3,18],[3,18],[8,23],[42,77],[179,190],[12,21],[8,20],[13,19],[26,16],[-59,-29],[-7,-5]],[[8475,1659],[79,-113],[19,-67],[-5,-36],[-20,-71],[-4,-38],[-20,-30],[-48,-1],[-54,7],[-42,-5],[0,-9],[10,-13],[1,-13],[-26,-10],[-23,1],[-19,10],[-12,14],[-10,30],[-6,12],[0,12],[34,36],[6,17],[0,41],[-11,68],[-45,113],[12,63],[20,34],[21,15],[24,-1],[31,-18],[11,-22],[-10,-26],[-16,-27],[-7,-24],[34,30],[13,41],[-2,43],[-16,38],[39,4],[36,7],[0,-27],[0,-9],[6,-76]],[[8264,1694],[-18,-17],[-19,29],[34,141],[-15,87],[8,29],[15,22],[52,42],[8,-5],[4,-5],[2,-14],[27,-63],[3,-24],[-7,-27],[-30,-44],[-17,-59],[-47,-92]],[[6623,2315],[-42,-19],[-53,2],[-35,6],[-24,13],[-14,25],[63,54],[39,45],[15,28],[20,83],[2,120],[12,131],[38,5],[75,-28],[47,-30],[17,-43],[32,-21],[22,-61],[1,-40],[10,-55],[-35,-52],[-21,-26],[-14,-21],[-28,-40],[-45,-27],[-31,-14],[-27,-5],[-24,-30]],[[6789,2909],[-54,-2],[-45,20],[22,47],[75,24],[90,20],[23,-33],[-21,-40],[-45,-22],[-45,-14]],[[7646,2826],[-104,-9],[-68,28],[-64,68],[-36,68],[-13,55],[50,86],[45,17],[192,-183],[16,-73],[-18,-57]],[[7112,5529],[-8,2],[-29,1],[-38,-11],[-28,-18],[-23,-23],[-74,-94],[-9,-24],[2,-23],[24,-40],[9,-21],[-6,-32],[-44,-93],[-22,-28],[-40,-14],[-41,-3],[-34,-9],[-20,-32],[9,-37],[34,-14],[36,-9],[13,-26],[-19,-27],[-30,1],[-28,-2],[-7,-41],[10,-30],[63,-85],[16,-30],[18,-56],[20,-27],[18,-13],[38,-17],[14,-15],[5,-13],[11,-43],[29,-72],[22,-34],[27,-15],[29,-6],[7,-10],[-10,-13],[-21,-16],[-16,-15],[4,-13],[12,-14],[9,-18],[50,-273],[29,-70],[51,-51],[73,-14],[8,56],[-41,142],[0,76],[11,40],[24,24],[49,1],[41,-23],[32,-33],[18,-25],[-1,2],[7,11],[1,2],[14,-14],[1,-11],[-3,-10],[2,-9],[32,-22],[5,-1],[15,-52],[10,-18],[50,-124],[11,-43],[6,-6],[21,-4],[5,-6],[3,-50],[9,-18],[28,-23],[29,-8],[29,-3],[29,-11],[14,-19],[0,-16],[6,-6],[36,14],[12,13],[8,16],[11,14],[19,6],[15,-2],[16,-4],[15,-3],[16,3],[29,8],[58,9],[27,12],[16,13],[37,25],[15,12],[36,40],[3,7],[-2,8],[1,8],[11,6],[7,1],[20,-2],[6,1],[32,26],[10,15],[-8,20],[-28,52],[-33,117],[-32,54],[-12,68],[41,84],[63,79],[57,55],[34,22],[120,38],[35,18],[28,23],[49,60],[3,66],[-57,197],[-3,65],[4,36],[14,23],[30,1],[27,-24],[27,-31],[91,-75],[33,-12],[51,9],[37,24],[70,71],[36,29],[91,22],[43,-47],[22,-65],[29,-30],[33,23],[28,79],[36,15],[44,-17],[1,-7],[4,-30],[-25,-72],[6,-57],[83,-193],[12,-83],[10,-25],[12,-14],[28,-19],[12,-15],[3,-13],[-3,-23],[3,-12],[11,-11],[28,-17],[8,-8],[2,-16],[-6,-33],[1,-17],[11,-28],[10,-17],[2,-17],[-15,-30],[-39,-59],[-9,-26],[-2,-68],[55,-240],[-2,-118],[17,-58],[40,-44],[72,-21],[31,-29],[19,-132],[15,-52],[26,-25],[58,-37],[24,-26],[9,-26],[15,-131],[-4,-99],[8,-28],[28,-53],[3,-29],[126,-555],[-4,-43],[-24,-9],[-32,0],[-26,-16],[49,-115],[28,-112],[5,-15],[1,-15],[31,-103],[6,-51],[-38,-260],[32,-405],[6,-43],[22,-85],[78,-173],[4,-17],[4,-17],[-20,-28],[-42,-32],[-50,-24],[-44,-3],[-26,21],[-15,36],[-17,68],[-42,69],[-56,9],[-72,-12],[-91,7],[-50,12],[-23,10],[-18,14],[-15,30],[-5,28],[-9,28],[-28,28],[-70,17],[-82,-73],[-69,1],[-36,-4],[-24,-34],[-29,-72],[-61,-64],[-11,-30],[-1,-33],[16,-68],[-3,-33],[-12,-50],[-7,-27],[12,-30],[16,-23],[51,-35],[15,-25],[12,-27],[89,-54],[-15,-66],[-3,-70],[10,-70],[23,-62],[62,-70],[10,-18],[5,-31],[39,-90],[16,-22],[7,-18],[-5,-18],[-19,-13],[-13,6],[-11,12],[-11,7],[-18,15],[-49,88],[-148,198],[-37,111],[-14,17],[-113,71],[-21,22],[-35,50],[-24,27],[-96,83],[-16,27],[-3,36],[18,110],[-4,40],[-11,33],[-120,161],[-20,16],[-24,10],[-21,24],[-15,31],[-7,28],[14,0],[4,-6],[2,-1],[3,0],[7,-4],[16,31],[26,32],[35,18],[41,-11],[-27,19],[-22,31],[-12,35],[0,32],[19,19],[30,21],[21,23],[-9,29],[32,29],[7,12],[-9,17],[13,16],[-4,14],[-16,12],[-13,3],[6,18],[8,15],[0,15],[-8,13],[-3,-14],[-4,-5],[-9,-5],[16,0],[-28,-58],[-25,-25],[-37,1],[-17,20],[6,26],[12,27],[-1,20],[-15,0],[-11,-29],[-20,3],[-19,20],[-9,24],[7,38],[20,10],[27,4],[33,23],[-13,12],[-36,-19],[-15,14],[14,25],[50,16],[0,11],[-100,-5],[-42,-11],[-34,-7],[-20,14],[4,41],[22,36],[39,15],[-17,17],[9,16],[23,14],[29,10],[0,12],[-23,-2],[-20,-7],[-16,-12],[-14,-16],[-12,22],[-10,35],[-10,67],[-6,16],[-31,26],[-7,16],[0,64],[-55,174],[-4,58],[23,-7],[7,-3],[-11,22],[-19,-3],[-16,-22],[0,-32],[-14,0],[-23,29],[-21,37],[-14,41],[-2,42],[11,26],[19,17],[19,13],[11,15],[-3,28],[-18,14],[-23,8],[-16,9],[-7,43],[39,20],[56,12],[46,18],[24,30],[50,121],[-13,-1],[-31,1],[-5,-26],[-21,-65],[4,-14],[-15,-8],[-25,-20],[-33,-20],[-38,-10],[-6,-8],[-54,-21],[-15,-17],[5,-27],[23,-13],[28,-7],[19,-11],[-1,-33],[-36,-20],[-48,2],[-33,38],[-37,195],[-24,62],[-146,209],[-277,282],[-68,20],[-39,26],[-30,31],[-17,26],[-17,-7],[-14,9],[-10,17],[-3,22],[4,20],[20,21],[14,49],[34,72],[2,41],[-16,0],[-8,-32],[-37,-89],[-22,-18],[-47,-11],[-30,-28],[-11,-37],[7,-41],[-33,18],[-32,11],[-36,5],[-47,2],[0,-13],[45,-10],[6,-16],[-22,-15],[-37,-7],[-113,-1],[40,-9],[35,-12],[16,-10],[-6,-25],[-27,-14],[-36,-7],[-35,-2],[-2,2],[-67,10],[-9,-2],[-8,1],[-3,6],[1,26],[-1,5],[-26,7],[-33,3],[-74,0],[0,-10],[27,-18],[10,-19],[-15,-12],[-50,1],[0,-12],[125,-24],[58,-17],[24,-34],[-8,-22],[-17,-24],[-25,-65],[-44,-31],[-40,-24],[-57,-11],[-106,-16],[-83,29],[-42,46],[-24,73],[-21,20],[-24,30],[-24,52],[-18,15],[-32,-8],[33,-24],[29,-47],[17,-49],[-5,-33],[-44,-16],[-70,-8],[-65,2],[-29,18],[-13,23],[-59,31],[-14,16],[-7,15],[-32,31],[-16,48],[-24,8],[-64,-4],[-10,9],[-25,61],[-17,10],[-20,7],[-17,9],[-14,30],[-30,32],[-7,12],[-3,17],[-27,47],[-16,58],[-17,29],[-20,26],[-16,28],[-6,39],[-11,20],[-167,166],[-24,45],[-5,19],[1,18],[24,104],[4,70],[12,38],[24,33],[18,31],[-9,32],[13,0],[-35,55],[-2,23],[24,15],[-7,1],[-7,1],[-3,2],[1,8],[-55,-14],[-37,36],[-21,51],[-5,32],[2,100],[19,38],[53,24],[126,0],[51,20],[1,62],[-10,24],[-12,9],[-7,1]],[[6776,5977],[178,-67],[54,-7],[73,44],[13,5],[16,5],[25,3],[16,-2],[12,-7],[2,-5],[-2,-6],[-9,-7],[-29,-17],[-60,-25],[-8,-6],[-5,-6],[0,-8],[12,-4],[52,-11],[11,-6],[3,-4],[-5,-3],[-9,-2],[-46,-7],[-9,-2],[-7,-3],[-9,-6],[-6,-7],[-3,-12],[1,-16],[16,-26],[7,-14],[3,-15],[-2,-21],[4,-31],[4,-12],[8,-18],[3,-12],[11,-27],[18,-16],[12,-13],[1,-2],[-1,-13],[-8,-29],[-1,-10]],[[6303,7506],[19,2],[68,18],[347,39],[120,-3],[27,4],[47,17],[23,1],[105,-39],[320,-70],[84,-7],[21,2],[44,10],[23,3],[26,4],[36,21],[19,6],[37,-2],[16,-13],[15,-19],[34,-21],[37,-6],[55,-2],[51,6],[22,15],[11,28],[25,0],[28,-10],[19,-4],[15,9],[13,21],[14,9],[33,3],[105,-7],[231,21],[120,-13],[41,9],[58,13],[70,-2],[69,-12],[58,-17],[16,-9],[22,-24],[12,-10],[18,-4],[31,-1],[15,-8],[12,-3],[29,6],[18,-2],[14,-9],[32,-30],[30,-19],[26,-13],[30,-9],[38,-7],[113,-11],[18,-10],[35,-35],[61,-19],[54,-23],[8,-31],[4,-16],[0,-1],[17,-3],[37,-10],[1,0],[0,-5],[1,-1],[69,-36],[0,-1],[20,-7],[9,-7],[0,-1],[-17,-11],[-1,-1],[53,-16],[21,-15],[16,-26],[0,-1],[7,-29],[-6,-19],[-30,-34],[-78,-14],[-132,-32],[-21,2],[-16,5],[-9,9],[-3,13],[-147,64],[-82,20],[-63,-20],[-12,-29],[9,-29],[0,-1],[28,-54],[1,0],[4,-28],[-1,-26],[-6,-27],[-110,-221],[-21,-66],[-10,-58],[-11,-26],[-23,-24],[-6,-4],[-25,-15],[-33,-14],[-27,-19],[-11,-32],[12,-104],[-8,-48],[-42,-41],[-55,-18],[-64,-4],[-180,11],[-3,-20],[49,-58],[2,-23],[-42,12],[-47,24],[-20,13],[-48,-11],[-7,-31],[23,-67],[-3,-34],[-46,-144],[-16,-30],[-27,-13],[-44,8],[-66,47],[-5,16],[-4,38],[-6,11],[-22,1],[-138,21],[-21,-22],[6,-32],[13,-35],[1,-30],[-24,-26],[-38,-10],[-42,4],[-39,18],[-20,26],[-38,69],[-23,6],[-9,-20],[-24,-108],[-16,-36],[-21,-23],[-32,-15],[-50,-11],[-89,-8],[-80,5],[-164,26],[-90,-6],[-27,-44],[-3,-64],[-22,-70],[-26,-12],[-24,2],[-16,6]],[[1536,5864],[7,14],[25,27],[7,16],[-5,6],[-5,28],[-4,7],[-12,67],[-50,48],[-71,32],[-47,7],[-23,-39],[-32,-36],[-48,-2],[-107,26],[-140,5],[-49,7],[-161,92],[-568,214],[-62,10],[-5,11],[-19,25],[-19,18],[-9,6],[-2,9],[0,88],[-7,11],[-32,23],[-21,35],[-36,10],[-41,9],[12,51],[18,31],[28,30],[10,74],[24,7],[27,4],[16,15],[3,23],[6,21],[14,12],[28,-4],[21,31],[30,22],[21,21],[-6,32],[-29,59],[-10,15],[-12,9],[0,7],[108,42],[40,10],[42,-3],[35,-17],[31,-28],[19,-34],[2,-30],[26,-2],[91,-17],[36,-2],[20,10],[39,51],[76,70],[26,39],[7,45],[50,45],[25,50],[18,112],[-6,95],[22,29],[74,9],[35,-7],[68,-19],[58,-11],[10,-4],[10,0],[25,4],[15,7],[27,21],[19,6],[76,-2],[66,-9],[130,-35],[129,-9],[17,9],[22,37],[15,12],[17,3],[14,-4],[14,-5],[148,-38],[56,-2],[-32,36],[40,6],[6,17],[-6,22],[2,23],[19,18],[81,43],[15,16],[6,18],[-5,16],[-16,14]],[[2063,7755],[214,-5],[234,0],[89,-16],[7,-65],[55,-87],[69,-48],[144,59],[131,-21],[206,-49],[214,0],[165,-12]],[[2063,7755],[-105,-4],[-52,5],[-36,27],[-13,7],[-45,2],[-22,4],[-15,10],[-51,45],[-10,19],[-1,16],[-7,14],[-23,13],[-1,10],[37,60],[-3,37],[-20,22],[-27,17],[-26,23],[-19,11],[-66,19],[2,-30],[-22,-7],[-20,0],[-20,3],[-17,-2],[-23,-14],[-18,-16],[-20,-14],[-25,-5],[-46,7],[-69,33],[-43,15],[-92,2],[-45,6],[-21,16],[-17,24],[-58,32],[-22,34],[-82,30],[-30,21],[-10,104],[-57,46],[-157,76],[-131,108],[-70,26],[-97,-20],[-35,-15],[-43,-14],[-41,-1],[-28,21],[-14,32],[-11,15],[-34,27],[0,16],[3,14],[-15,26],[-16,75],[6,8],[12,6],[11,12],[40,96],[42,57],[55,31],[15,32],[-4,19],[-11,9],[-14,6],[-8,9],[-2,17],[3,8],[6,9],[25,56],[17,20],[72,33],[19,11],[13,13],[15,11],[24,6],[44,7],[127,31],[38,16],[18,26],[-4,62],[8,24],[33,33],[32,21],[102,46],[16,14],[11,16],[12,7],[22,-10],[15,-5],[20,-1],[21,2],[17,3],[48,-5],[-5,43],[-43,92],[-31,37],[-58,19],[-125,17],[-50,16],[-15,-1],[-8,-12],[-6,-39],[-10,-10],[-28,6],[-16,23],[-3,28],[12,22],[28,34],[44,109],[16,24],[27,32],[28,20],[19,-9],[4,-32],[-2,-36],[6,-33],[28,-23],[77,-17],[34,-11],[29,-23],[27,-16],[23,-19],[18,-12],[43,-21],[49,-15],[18,-1],[46,0],[26,-8],[15,-16],[12,-20],[17,-15],[24,-11],[23,-8],[50,-8],[-10,-14],[-4,-15],[5,-11],[19,-5],[16,-5],[-2,-30],[13,-13],[49,-17],[30,-17],[5,-21],[-20,-31],[-28,-17],[-80,-28],[-16,-12],[38,-20],[183,48],[78,-22],[18,-26],[14,-29],[20,-24],[37,-12],[34,10],[32,56],[44,21],[58,-8],[96,-68],[61,-14],[96,17],[44,22],[-12,31],[-23,5],[-26,1],[-16,11],[8,36],[-20,-9],[-20,-4],[-17,4],[-14,14],[-20,49],[-54,19],[-62,15],[-44,34],[-2,29],[18,32],[27,28],[27,19],[36,12],[20,-4],[20,-14],[34,-18],[25,-9],[33,-27],[19,-12],[24,-6],[47,-9],[20,-11],[10,-20],[-7,-15],[2,-12],[36,-11],[52,-10],[15,-12],[2,-23],[-19,-8],[-32,11],[-24,-3],[1,-45],[14,-28],[43,-51],[16,-27],[18,-103],[17,-30],[26,-22],[144,-44],[32,-15],[22,-21],[14,-33],[18,-16],[76,-25],[52,-43],[40,-19],[43,-14],[35,-3],[35,15],[26,17],[26,0],[32,-35],[11,-3],[10,-1],[11,1],[11,3],[118,7],[10,-1],[11,-2],[10,-4],[31,-38],[19,-18],[22,-8],[29,4],[16,16],[6,21],[-3,23],[19,46],[94,56],[18,29],[-16,21],[-28,1],[-30,-4],[-21,8],[-1,20],[24,14],[32,11],[25,12],[-40,3],[-35,13],[-15,21],[23,31],[15,9],[14,5],[16,1],[44,-9],[2,8],[-15,20],[-4,51],[15,14],[46,11],[40,-5],[11,-25],[-1,-35],[-1,-37],[-3,-7],[5,-4],[26,-9],[16,-1],[43,3],[19,-2],[26,-14],[13,-25],[10,-28],[17,-24],[28,-28],[3,-21],[-5,-21],[3,-30],[12,-15],[45,-41],[16,-23],[12,-12],[13,-3],[14,4],[15,11],[1,0],[4,2],[3,0],[3,0],[3,-2],[29,-26],[-7,-24],[-30,-18],[-43,-10],[41,-17],[34,-3],[17,-9],[-9,-41],[-94,-117],[-8,-42],[40,-152],[49,-86],[22,-67],[-20,-119],[-4,-128],[-32,-85],[-17,-45],[-3,-17]]],"transform":{"scale":[0.00046215237573758456,0.0005885417637763822],"translate":[88.02178959200006,20.73871491100003]}};
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
