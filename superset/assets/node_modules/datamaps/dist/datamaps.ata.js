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
  Datamap.prototype.ataTopo = {"type":"Topology","objects":{"ata":{"type":"GeometryCollection","geometries":[{"type":"MultiPolygon","properties":{"name":"Antarctica"},"id":"AQ","arcs":[[[0]],[[1]],[[2]],[[3]],[[4]],[[5]],[[6]],[[7]],[[8]],[[9]],[[10]],[[11]],[[12]],[[13]],[[14]],[[15]],[[16]],[[17]],[[18]],[[19]],[[20]],[[21]],[[22]],[[23]],[[24]],[[25]],[[26]],[[27]],[[28]],[[29]],[[30]],[[31]],[[32]],[[33]],[[34]],[[35]],[[36]],[[37]],[[38]],[[39]],[[40]],[[41]],[[42]],[[43]]]},{"type":"MultiPolygon","properties":{"name":null},"id":"-99","arcs":[[[44]],[[45]],[[46]],[[47]],[[48]],[[49]],[[50]],[[51]],[[52]],[[53]],[[54]],[[55]],[[56]],[[57]],[[58]],[[59]],[[60]],[[61]],[[62]],[[63]],[[64]],[[65]],[[66]],[[67]],[[68]],[[69]],[[70]],[[71]],[[72]],[[73]],[[74]],[[75]],[[76]],[[77]],[[78]],[[79]],[[80]],[[81]],[[82]],[[83]],[[84]],[[85]],[[86]],[[87]],[[88]],[[89]],[[90]],[[91]],[[92]],[[93]],[[94]],[[95]],[[96]],[[97]],[[98]],[[99]],[[100]],[[101]],[[102]],[[103]],[[104]],[[105]],[[106]],[[107]],[[108]],[[109]],[[110]],[[111]],[[112]],[[113]],[[114]],[[115]],[[116]],[[117]],[[118]],[[119]],[[120]],[[121]],[[122]],[[123]],[[124]],[[125]],[[126]],[[127]],[[128]],[[129]],[[130]],[[131]],[[132]],[[133]],[[134]],[[135]],[[136]],[[137]],[[138]],[[139]],[[140]],[[141]],[[142]],[[143]],[[144]],[[145]],[[146]],[[147]],[[148]],[[149]],[[150]],[[151]],[[152]],[[153]],[[154]],[[155]],[[156]],[[157]],[[158]],[[159]],[[160]],[[161]],[[162]],[[163]],[[164]],[[165]],[[166]],[[167]],[[168]],[[169]],[[170]],[[171]],[[172]],[[173]],[[174]],[[175]],[[176]],[[177]],[[178]],[[179]]]}]}},"arcs":[[[489,2409],[2,-9],[2,-8],[9,-13],[10,-13],[-7,-5],[-1,-2],[-1,-5],[-1,-14],[-1,-5],[-1,-4],[-11,-7],[-12,11],[-12,11],[-1,7],[0,1],[1,3],[0,1],[-1,7],[-6,5],[-3,7],[0,3],[0,4],[0,6],[0,4],[2,6],[-1,3],[-1,2],[-3,6],[-1,4],[1,2],[1,1],[-1,3],[-2,5],[1,4],[12,-4],[12,-5],[12,-5],[2,-7]],[[542,2850],[-2,-1],[-13,6],[-12,5],[-13,6],[-12,6],[-13,6],[-13,5],[-12,6],[-1,4],[3,1],[0,2],[0,2],[-8,12],[-1,5],[0,4],[1,5],[0,6],[1,6],[2,8],[12,8],[12,9],[12,-13],[13,-14],[13,-13],[13,-13],[13,-13],[1,-9],[0,-2],[-1,-4],[-1,-2],[2,-1],[5,-15],[1,-4],[-1,-6],[-1,-2]],[[3331,3495],[-1,0],[-1,-4],[-2,0],[-8,-11],[3,-6],[8,-2],[8,-2],[1,-2],[-1,-5],[0,-4],[0,-3],[-1,-3],[1,-2],[0,-1],[1,0],[1,3],[1,-3],[2,-8],[-4,6],[-1,0],[-1,-2],[-1,-2],[0,-5],[0,-6],[0,-2],[1,-7],[1,-1],[1,2],[1,3],[0,2],[0,1],[2,-1],[1,-2],[0,-5],[-2,0],[-1,-2],[1,-3],[0,-2],[0,-2],[0,-2],[1,-4],[0,-2],[-1,-1],[0,1],[-1,5],[-1,2],[-2,-3],[0,-2],[0,-3],[0,-3],[0,-3],[1,-7],[0,-1],[1,-7],[0,-4],[0,-4],[0,-4],[0,-2],[-4,-4],[-1,-3],[1,-8],[1,-2],[0,-1],[10,1],[3,-5],[0,-3],[0,-4],[-1,-3],[-1,-4],[4,3],[0,-2],[1,-1],[0,-2],[0,-1],[1,-1],[0,-1],[0,-2],[0,-1],[-1,-1],[1,-5],[0,-2],[-1,-1],[0,1],[-1,4],[-1,1],[-5,-3],[-1,-1],[0,-1],[0,-2],[0,-4],[0,-4],[-1,-3],[0,-2],[1,-1],[0,-1],[1,-2],[0,-3],[0,-2],[-1,-1],[-1,2],[0,-3],[-1,-3],[0,-7],[-1,-3],[-1,0],[0,-1],[-1,-6],[0,-1],[0,-3],[0,-1],[0,-1],[0,-2],[0,-1],[0,-7],[0,-3],[1,-2],[-1,-2],[0,-1],[0,-2],[0,-2],[0,-5],[0,-7],[-1,-8],[0,-8],[-1,-4],[1,-1],[4,6],[0,1],[0,2],[1,3],[-1,2],[0,2],[1,2],[0,1],[2,-1],[0,-1],[0,-3],[1,-1],[0,1],[1,1],[1,-1],[0,-2],[-1,-4],[0,-4],[0,-3],[-2,-4],[0,1],[-1,3],[0,1],[0,-1],[-1,-2],[0,-4],[0,-1],[-3,-9],[-2,-2],[-1,-2],[0,-2],[0,-5],[-1,-13],[3,-3],[2,5],[1,0],[0,-2],[0,-6],[0,-2],[-1,-1],[0,-2],[-1,-5],[-1,-7],[-1,-8],[0,-2],[-8,-29],[-7,-29],[-8,-15],[-13,8],[-13,8],[-13,8],[-13,8],[-12,30],[-1,6],[0,7],[0,4],[1,3],[0,3],[-1,4],[0,3],[-1,5],[-1,2],[0,2],[0,7],[0,5],[0,4],[-1,2],[-1,5],[-9,-2],[-9,-2],[-1,-1],[0,-3],[-1,-5],[0,-2],[0,-2],[-1,0],[-7,-3],[-1,-4],[0,-1],[1,-1],[0,-1],[0,-2],[-1,-6],[0,-4],[0,-6],[0,-2],[-1,-4],[-2,-2],[-13,23],[-14,23],[-13,23],[-14,23],[-13,23],[-2,6],[0,1],[0,4],[0,7],[0,4],[-1,1],[0,1],[0,2],[0,2],[0,7],[1,6],[5,21],[7,3],[2,3],[0,-1],[0,5],[0,1],[1,0],[1,-1],[0,-1],[0,-2],[1,-4],[0,-3],[-1,-3],[-1,-4],[1,-3],[0,-5],[-1,-7],[0,-7],[0,-2],[1,-8],[1,-5],[7,-13],[12,1],[13,1],[13,1],[13,1],[13,1],[13,1],[13,1],[13,1],[12,1],[8,17],[7,16],[1,6],[0,1],[-7,0],[-2,3],[-1,2],[0,2],[0,5],[0,2],[-1,2],[-2,8],[0,2],[0,2],[0,1],[0,1],[0,2],[0,5],[0,2],[-1,4],[-1,3],[0,6],[0,2],[-1,3],[-1,6],[0,3],[0,2],[0,2],[1,1],[0,1],[3,0],[0,1],[-1,7],[11,0],[1,2],[0,2],[1,6],[0,2],[-1,2],[-1,10],[-5,11],[-1,6],[0,1],[0,2],[1,2],[10,2],[1,14],[1,9],[14,26],[13,25],[1,-1],[0,-4],[0,-3],[-1,-3],[0,-2]],[[4135,3460],[0,-3],[1,-1],[12,-12],[5,1],[3,-5],[2,1],[2,5],[-8,16],[-9,15],[0,2],[-1,5],[0,2],[0,6],[-1,2],[0,2],[0,1],[-1,1],[2,7],[1,4],[1,1],[1,-3],[1,-4],[0,-10],[1,-4],[1,-8],[0,-1],[11,-13],[10,-13],[4,-12],[4,-20],[0,-1],[-2,-5],[0,-1],[-3,0],[-2,4],[0,2],[-1,4],[0,8],[-1,3],[-2,5],[-1,1],[-1,-2],[-2,-7],[-3,-3],[3,-15],[3,-4],[1,0],[0,-2],[0,-5],[1,-1],[-6,-13],[-5,-5],[-2,3],[-1,7],[4,2],[1,3],[1,0],[-1,2],[-5,8],[-1,3],[0,2],[0,4],[0,3],[0,2],[-3,-1],[-1,-3],[0,-1],[1,-3],[0,-4],[-1,-4],[0,-2],[-1,0],[-5,11],[-9,4],[-10,5],[-5,13],[-3,2],[-1,2],[1,3],[0,2],[3,5],[1,3],[-3,3],[-5,-7],[-2,1],[-1,3],[5,13],[1,2],[0,4],[-1,2],[-1,1],[0,2],[-1,5],[0,2],[0,1],[-5,2],[5,4],[1,2],[-1,2],[-1,1],[-1,5],[0,1],[1,5],[7,7],[4,-2],[1,-5],[4,-20],[7,-19],[2,-11]],[[3120,3548],[0,-4],[1,2],[2,-3],[1,1],[2,-6],[7,0],[8,1],[0,-3],[-2,-3],[3,-1],[0,-1],[1,-4],[2,-6],[9,-2],[8,-2],[8,9],[1,-2],[1,-5],[0,-1],[-4,-11],[-1,0],[0,1],[0,1],[-1,2],[0,1],[-7,-10],[-11,5],[0,-1],[-1,-2],[1,-8],[2,-4],[9,-6],[4,-16],[3,-2],[9,8],[1,-3],[1,-6],[1,-2],[1,2],[0,-2],[-1,-4],[1,-1],[0,-2],[0,-2],[-1,-1],[-8,-6],[-1,-3],[1,-4],[9,-11],[1,-1],[0,-2],[0,-4],[0,-3],[0,-4],[0,-3],[0,-2],[1,-2],[1,-2],[-1,-1],[-1,-4],[-6,-8],[0,-2],[-1,-2],[0,-6],[-1,-3],[-12,-20],[-2,2],[-3,7],[1,3],[0,3],[-1,2],[0,1],[0,1],[2,5],[0,5],[-1,5],[0,4],[-1,2],[0,3],[-9,8],[-1,6],[-6,-1],[-1,3],[0,5],[1,7],[4,19],[0,2],[1,6],[0,2],[-2,-2],[-2,2],[-10,26],[-11,26],[-2,15],[0,2],[-1,1],[-1,2],[0,7],[1,4],[0,3],[3,4],[1,0],[0,-3],[0,-1]],[[3137,3641],[0,-6],[-1,-4],[-3,-9],[-1,1],[0,3],[-1,0],[-2,-6],[-5,-24],[1,-3],[0,-2],[4,-4],[1,-1],[1,-4],[-1,-1],[0,-3],[0,-2],[2,0],[-1,-2],[-2,-4],[-1,-6],[-1,-3],[-1,-2],[-13,6],[-13,6],[-2,8],[-2,1],[-1,2],[0,4],[1,4],[1,3],[14,14],[13,13],[2,6],[-1,2],[-5,0],[-1,1],[0,1],[0,1],[0,2],[0,3],[0,-1],[-3,-3],[-1,3],[-12,-16],[-4,0],[-1,2],[1,3],[5,10],[3,5],[0,3],[1,6],[1,3],[1,3],[12,5],[7,-9],[8,-8],[0,-1]],[[4055,3639],[2,-15],[-1,-12],[-3,-4],[-12,3],[-12,4],[-13,4],[-12,3],[-12,4],[-13,3],[-3,13],[-2,27],[1,-4],[5,-24],[3,-2],[0,-2],[0,6],[-1,5],[0,4],[-1,3],[12,9],[11,9],[1,5],[3,16],[2,5],[3,1],[14,-20],[14,-20],[14,-21]],[[547,3640],[5,-9],[4,-12],[4,-7],[8,-28],[0,-1],[0,-2],[0,-3],[0,-2],[0,-1],[1,-1],[0,-1],[0,-6],[0,-1],[1,-1],[0,-1],[4,-13],[0,-3],[0,-3],[0,-2],[-1,1],[3,-11],[1,-2],[0,-5],[1,-5],[-1,-6],[1,-3],[0,-3],[6,-23],[0,-6],[0,-2],[0,-4],[0,-2],[0,-1],[0,-1],[1,-1],[-1,-6],[-1,-2],[0,-2],[-1,-1],[0,-3],[0,-1],[-1,-1],[-11,-3],[-11,-3],[-12,-3],[-11,-3],[-13,20],[-13,21],[-13,21],[-13,20],[-12,21],[-13,20],[-3,12],[-10,15],[-6,26],[-4,11],[-1,5],[1,0],[1,2],[1,-1],[0,4],[0,3],[-2,11],[0,4],[0,3],[0,3],[1,1],[0,2],[0,5],[-1,12],[0,2],[0,2],[1,2],[0,2],[0,1],[0,2],[0,4],[1,0],[0,1],[1,4],[0,4],[-1,5],[0,3],[0,2],[0,1],[0,3],[1,3],[0,6],[1,3],[0,1],[5,8],[0,1],[0,2],[0,3],[1,1],[0,2],[4,3],[1,1],[0,3],[-2,5],[0,3],[2,4],[1,5],[0,1],[1,1],[0,1],[1,6],[5,12],[0,2],[5,10],[1,6],[0,1],[-1,11],[1,5],[13,-8],[12,-8],[1,-2],[0,-5],[0,-2],[1,-1],[4,-3],[11,-28],[10,-29],[1,-5],[0,-1],[0,-1],[-1,-2],[0,-2],[1,-1],[11,-33],[12,-32],[6,-27]],[[3143,3922],[1,-2],[1,1],[0,1],[1,0],[0,-2],[-1,-3],[-3,-3],[-5,-12],[0,-1],[1,-6],[-1,-4],[-3,-9],[-3,-18],[-1,-4],[-1,-2],[0,-2],[-1,-2],[0,-7],[-1,-3],[-10,-36],[-11,-37],[-11,-37],[-10,-36],[-1,-4],[0,-2],[0,-3],[0,-1],[0,-4],[-1,-3],[-8,-24],[-1,-3],[0,-2],[0,-5],[0,-2],[-1,-6],[-3,-10],[-4,-25],[0,-2],[0,-4],[0,-2],[0,-2],[-1,-3],[0,-2],[1,0],[2,2],[1,-1],[-8,-10],[-1,-5],[1,-4],[3,-6],[1,-2],[2,-9],[0,-2],[2,-2],[-5,-3],[-1,-1],[0,-2],[0,-3],[0,-3],[2,-12],[-10,-16],[-9,-16],[-10,5],[-11,5],[-10,5],[-3,10],[-3,14],[-3,20],[-1,8],[0,4],[0,3],[0,9],[0,8],[1,8],[0,7],[1,20],[1,22],[3,21],[5,33],[12,37],[11,36],[5,1],[1,4],[3,11],[12,13],[4,16],[2,3],[1,2],[3,12],[0,4],[1,2],[12,22],[12,23],[11,22],[12,23],[3,13],[2,4],[8,11],[8,11],[7,-5],[2,-6],[2,-9],[-1,-5],[-1,-3],[-5,-9],[-1,-5],[1,-2]],[[9654,4006],[-2,-13],[-3,-8],[-3,-1],[-10,10],[-1,-2],[-5,-16],[-11,-12],[-3,4],[-2,4],[-1,7],[-2,24],[-1,29],[1,7],[2,2],[1,-2],[1,-8],[4,1],[9,-17],[4,-14],[0,-3],[8,19],[8,33],[1,16],[2,5],[1,1],[2,-3],[1,-10],[0,-8],[0,-9],[1,-16],[0,-1],[-2,-19]],[[3740,3835],[3,-15],[-4,-17],[2,-8],[3,-3],[13,2],[14,2],[14,2],[0,-3],[5,-24],[1,-11],[1,-14],[1,-12],[0,-16],[0,-16],[0,-9],[1,3],[1,1],[0,-1],[1,-2],[1,-10],[3,-7],[1,-7],[0,-1],[-1,-3],[-4,-17],[1,-9],[4,-16],[1,-7],[1,-7],[0,-3],[0,-2],[1,-4],[0,-3],[0,-3],[1,-7],[1,-3],[0,-4],[0,-4],[1,-4],[0,-5],[0,-5],[0,-10],[-1,-65],[0,-24],[-1,-22],[-2,-20],[-2,-14],[-2,-9],[-2,-4],[-8,9],[-8,-11],[1,-1],[-1,0],[11,-33],[1,-5],[0,-7],[0,-11],[-3,-12],[-13,-13],[-13,-13],[-13,-12],[-13,-13],[-14,-13],[-13,-12],[-13,-13],[-13,-13],[-14,-12],[-13,-13],[-13,-13],[-13,-12],[-13,-13],[-1,-3],[0,-4],[-1,-5],[1,-7],[1,-7],[0,-2],[-3,-8],[-13,-3],[-14,-3],[-13,-4],[-14,-3],[-13,-3],[-13,-3],[-14,-4],[-13,-3],[-14,-3],[-3,7],[0,6],[-2,19],[0,4],[-1,6],[-1,4],[0,8],[0,10],[0,9],[1,8],[0,5],[0,4],[1,5],[-1,7],[3,14],[2,4],[1,-2],[1,-5],[0,-6],[0,-3],[1,4],[0,5],[1,12],[0,6],[1,7],[7,37],[5,44],[5,13],[-1,4],[0,2],[0,3],[0,2],[1,18],[2,0],[4,-18],[1,-5],[2,-2],[5,1],[6,12],[2,12],[6,18],[1,0],[2,-2],[0,-6],[0,-8],[-1,-9],[-4,-22],[-1,-2],[0,-1],[3,6],[13,44],[13,43],[4,21],[7,22],[4,23],[11,32],[4,23],[1,5],[2,4],[0,3],[1,4],[0,10],[0,5],[0,4],[0,2],[0,1],[0,2],[0,1],[0,2],[-1,6],[-1,4],[-1,5],[1,11],[-2,12],[-2,7],[-7,10],[-1,-1],[3,14],[3,28],[1,8],[0,3],[0,4],[0,7],[0,5],[1,20],[0,6],[0,7],[-2,3],[-1,5],[1,5],[4,5],[1,6],[2,7],[1,10],[1,10],[-3,-2],[-2,3],[-1,6],[4,30],[0,1],[-1,0],[-1,9],[0,1],[0,3],[2,1],[0,3],[1,5],[0,12],[1,6],[0,4],[4,19],[1,4],[0,8],[1,4],[1,5],[2,7],[8,43],[9,43],[1,7],[0,2],[0,7],[0,4],[0,3],[3,13],[1,5],[-1,3],[0,6],[2,3],[12,23],[13,23],[13,23],[13,23],[12,-5],[12,-5],[12,-5],[1,-4],[13,-24],[12,-25],[13,-24],[10,-35],[9,-35],[2,-8],[1,-13],[0,-19],[0,-9],[0,-7],[-2,-11],[0,-6],[-1,-13],[-2,-28],[0,-4],[-2,-2],[-11,-7],[-11,-6],[-11,-7],[-4,-6],[-1,-4]],[[9641,4313],[-1,-12],[0,1],[0,-1],[2,-8],[12,-24],[9,7],[9,6],[13,-10],[12,-10],[4,-7],[1,-4],[1,-5],[0,-6],[1,-8],[-2,-5],[-7,-12],[-4,-20],[-1,-3],[-13,-19],[-9,17],[-9,0],[-10,0],[-1,-7],[-2,-14],[-1,-3],[-5,-10],[-5,-16],[-3,-18],[-3,-5],[0,1],[-2,7],[1,9],[4,14],[2,17],[1,2],[-11,-3],[-1,4],[1,2],[4,-1],[1,4],[4,1],[2,5],[0,1],[-1,1],[-13,20],[-1,2],[0,3],[-1,7],[-1,3],[0,1],[-1,-1],[-1,2],[-1,9],[1,5],[4,8],[1,4],[2,19],[5,23],[1,1],[-2,8],[-1,1],[-1,6],[-4,16],[2,19],[2,10],[4,6],[4,1],[4,-7],[2,-7],[1,-13],[1,-14]],[[1458,5289],[2,-2],[2,2],[1,0],[3,-6],[0,-2],[0,-2],[0,-4],[1,-2],[0,-1],[1,1],[0,-2],[0,-1],[0,-1],[0,-1],[1,-1],[-1,-2],[0,-3],[0,-1],[-1,-8],[-1,-4],[0,-3],[1,-8],[0,-2],[-1,-4],[0,-1],[1,-1],[-1,-3],[-5,-16],[-3,-4],[-1,1],[-10,31],[0,1],[0,2],[0,3],[0,2],[0,2],[-1,3],[0,3],[-1,2],[0,1],[0,2],[-1,1],[0,2],[-2,-3],[-1,4],[1,4],[0,1],[0,4],[0,4],[0,2],[-1,3],[0,1],[0,2],[1,1],[-1,3],[-1,1],[1,3],[0,1],[-1,8],[0,5],[0,2],[-1,7],[0,3],[0,4],[1,0],[11,-13],[7,-21]],[[1680,5390],[-5,-6],[-4,1],[-1,3],[-1,4],[-1,5],[1,5],[1,2],[1,2],[0,1],[0,2],[0,3],[0,1],[1,2],[0,1],[0,1],[3,2],[1,2],[1,5],[-1,4],[0,3],[-3,11],[0,3],[0,3],[-1,8],[0,3],[0,3],[-2,4],[1,3],[1,2],[1,4],[-3,6],[-1,3],[6,2],[3,11],[3,4],[10,-3],[4,-8],[2,-7],[0,-2],[0,-2],[0,-3],[0,-6],[0,-3],[0,-2],[0,-1],[1,-1],[-2,-12],[-1,-3],[0,-2],[1,-5],[-1,-6],[-1,-5],[-6,-21],[-6,-8],[0,-1],[0,-3],[-1,-3],[0,-4],[-1,-2]],[[1635,5511],[12,-6],[5,5],[3,-7],[1,-8],[0,-12],[0,-3],[-1,-2],[-8,-7],[-1,-4],[3,-6],[10,-7],[0,-3],[0,-1],[-1,-6],[0,-2],[1,-2],[1,-3],[0,-5],[0,-2],[-1,-2],[0,-3],[-10,-25],[-10,-24],[-1,-3],[-1,-3],[0,-4],[0,-6],[0,-3],[1,-4],[0,-2],[0,-3],[-1,-1],[-1,0],[1,-4],[0,-4],[0,-3],[0,-2],[0,-1],[0,-3],[3,-5],[0,-3],[0,-1],[-4,-13],[-11,-7],[-10,-8],[-11,-7],[-6,12],[-3,-3],[-1,2],[-2,5],[-6,10],[-1,4],[-2,9],[0,7],[0,5],[-1,5],[1,5],[1,2],[6,0],[1,4],[0,3],[-1,1],[0,1],[-1,3],[-1,2],[0,7],[-3,9],[0,1],[0,3],[0,4],[0,2],[0,6],[1,2],[1,0],[1,2],[0,2],[0,4],[1,1],[1,1],[0,2],[0,2],[0,4],[0,2],[0,1],[0,1],[0,1],[0,1],[0,1],[0,1],[0,2],[0,1],[1,1],[3,11],[2,1],[5,13],[1,2],[0,1],[-1,3],[-2,2],[-4,-2],[-10,9],[0,1],[0,2],[-1,3],[0,2],[0,3],[0,3],[0,1],[-1,2],[-10,-6],[0,1],[0,2],[0,1],[1,1],[2,3],[1,1],[0,2],[0,3],[-1,3],[-1,4],[0,4],[0,3],[1,4],[2,16],[2,8],[1,2],[11,-1],[11,-1],[6,-11],[13,-6],[13,-6]],[[4425,5399],[0,-4],[0,-3],[1,-9],[1,-22],[1,-10],[4,-30],[1,-7],[0,-10],[1,-11],[0,-11],[0,-3],[0,-3],[0,-2],[-1,-9],[-1,-3],[0,-2],[-1,-3],[-2,-1],[-7,9],[-1,4],[-1,8],[0,3],[0,4],[0,3],[0,3],[-1,9],[-2,46],[0,10],[-1,8],[-2,8],[-1,7],[-5,12],[-12,6],[-8,-8],[-1,2],[4,22],[8,6],[8,7],[3,8],[2,10],[2,13],[2,14],[0,15],[2,26],[0,15],[1,9],[1,6],[1,5],[5,9],[0,1],[0,2],[0,4],[0,3],[0,1],[1,-2],[1,-4],[1,-5],[0,-7],[1,-6],[0,-7],[0,-6],[-1,-6],[0,-8],[0,-7],[1,-12],[-1,-8],[-1,-6],[0,-6],[0,-4],[0,-4],[0,-4],[-1,-10],[0,-6],[0,-5],[1,-7],[-1,-7],[0,-3],[-1,-2],[0,-4],[0,-3],[0,-6],[0,-3],[0,-5],[-1,-4]],[[1498,5662],[2,-16],[1,-8],[10,-18],[1,-5],[0,-6],[-1,-6],[-1,-5],[0,-3],[1,-5],[2,-15],[2,-6],[6,-11],[0,-4],[1,-6],[0,-7],[-1,-6],[0,-4],[-1,-3],[-13,-6],[-2,5],[-2,-1],[-1,-6],[0,-11],[2,-9],[2,-9],[3,-6],[2,1],[6,11],[3,0],[1,-2],[1,-6],[1,-2],[1,-1],[1,-3],[1,-4],[0,-5],[0,-1],[-1,-1],[1,-4],[0,-1],[2,-1],[2,4],[0,4],[-1,2],[0,3],[0,4],[0,1],[0,1],[0,4],[1,7],[4,7],[4,14],[1,3],[2,-1],[0,-3],[0,-6],[11,-27],[1,-4],[1,-1],[1,-3],[0,-7],[-1,-4],[-4,-16],[0,-8],[2,-6],[5,-9],[0,-2],[-1,-5],[1,0],[1,-2],[1,-3],[0,-2],[0,-4],[1,-2],[0,-1],[2,-2],[0,-6],[0,-3],[0,-2],[-1,-2],[-1,-2],[0,-1],[-1,-3],[0,-3],[0,-2],[1,-2],[0,-1],[0,-4],[-1,-3],[0,-2],[-1,0],[3,-13],[-1,-5],[-1,-5],[-2,-6],[-2,0],[-6,16],[-8,-2],[-7,-1],[-12,21],[-1,4],[4,10],[-9,14],[-8,14],[-1,5],[0,2],[0,4],[0,2],[-1,2],[-1,2],[0,2],[0,1],[1,1],[0,1],[-1,3],[-3,3],[0,1],[-1,6],[-1,5],[-13,27],[0,2],[1,5],[1,6],[0,8],[-1,4],[-2,3],[0,5],[0,5],[0,2],[1,2],[0,4],[0,2],[-3,5],[1,4],[0,1],[-5,2],[-3,6],[-1,0],[-2,-3],[-1,-4],[0,-6],[0,-12],[0,-2],[-1,-5],[-6,3],[-1,1],[0,2],[0,2],[0,3],[0,10],[0,5],[0,7],[1,6],[1,8],[0,3],[-5,10],[-2,0],[0,1],[-1,4],[1,2],[0,3],[1,3],[-1,3],[0,2],[0,3],[0,3],[0,3],[0,1],[0,1],[-1,6],[0,3],[-1,4],[0,4],[0,1],[2,9],[2,14],[2,13],[2,9],[2,5],[1,0],[1,-4],[0,-2],[-1,-2],[0,-1],[2,-2],[7,7],[7,7],[12,-9],[1,-3]],[[2093,5694],[-3,-3],[-3,4],[-2,7],[-2,8],[-1,8],[-2,18],[0,8],[-1,14],[0,6],[2,17],[2,4],[1,0],[1,-3],[1,-13],[6,-36],[1,-7],[1,-5],[2,-5],[0,-10],[-3,-12]],[[2918,5811],[3,0],[9,-6],[6,-13],[2,-24],[-1,-10],[-4,-28],[0,-5],[0,-11],[0,-6],[-1,-4],[-2,-9],[0,-15],[-5,-8],[-2,-10],[1,-2],[4,1],[1,-3],[0,-5],[0,-8],[0,-11],[1,-2],[1,-3],[0,-5],[1,-6],[2,-9],[0,-7],[-1,-15],[0,-8],[-1,-6],[-1,-5],[-1,-8],[-2,-3],[-12,30],[-12,30],[-12,31],[-4,21],[-1,7],[-2,28],[0,7],[1,13],[1,8],[1,5],[5,12],[3,-3],[6,-19],[3,2],[-1,11],[0,7],[2,3],[8,-4],[1,5],[0,1],[-4,11],[-6,1],[-3,5],[-5,22],[-2,9],[0,1],[2,5],[3,4],[1,-1],[0,3],[3,12],[1,2],[3,1],[10,-16]],[[2474,5822],[0,-5],[1,3],[1,1],[2,-2],[1,-3],[0,-5],[1,-7],[0,-9],[-1,-11],[0,-12],[-2,-19],[-3,-22],[-3,-17],[-5,-15],[-5,-6],[-3,5],[-1,2],[1,23],[1,14],[0,4],[0,3],[0,10],[0,20],[1,8],[0,3],[1,4],[2,11],[-6,39],[0,9],[-2,29],[-2,13],[0,8],[8,20],[10,2],[3,-6],[2,-6],[1,-8],[1,-11],[1,-21],[-1,-16],[-3,-26],[-1,-4]],[[2365,5882],[-10,-7],[-2,8],[0,6],[1,7],[1,9],[1,2],[10,16],[7,22],[0,1],[1,-1],[1,-3],[0,-4],[0,-11],[0,-4],[0,-2],[0,-2],[2,-17],[1,-4],[-3,-8],[-10,-8]],[[2270,6078],[-1,-17],[0,-3],[-1,-7],[1,1],[1,2],[3,19],[1,3],[2,2],[2,-2],[4,-11],[-1,-2],[-2,-14],[3,1],[2,6],[0,17],[0,7],[-1,3],[-1,1],[0,3],[-1,11],[1,13],[0,12],[0,4],[-1,8],[1,5],[3,4],[4,-2],[3,-7],[0,1],[-4,-15],[6,-12],[1,2],[0,-11],[-1,-7],[-1,-5],[-4,-12],[-1,-4],[1,-4],[1,-5],[1,-13],[0,-3],[1,-7],[2,-6],[3,10],[2,20],[2,19],[1,10],[0,12],[1,24],[1,17],[2,10],[1,4],[2,1],[1,-2],[3,-7],[10,8],[2,-2],[2,-6],[4,-18],[-1,-19],[0,-9],[-1,-6],[-1,-3],[0,-1],[-7,7],[-2,-3],[3,-14],[0,-1],[-1,-7],[-2,-5],[-3,-5],[-11,-36],[3,-12],[2,-6],[3,1],[8,24],[13,17],[6,29],[3,3],[1,-10],[-2,-5],[-1,-4],[0,1],[0,-1],[6,-16],[-1,-9],[-2,-5],[-1,-5],[-8,-4],[-8,-5],[-3,-7],[-1,-5],[-1,-7],[1,-2],[9,13],[2,0],[1,-7],[2,-13],[1,-3],[0,-2],[2,0],[5,6],[2,-1],[2,-6],[0,-7],[-1,-8],[-1,-8],[-7,-12],[-8,0],[-2,-8],[2,2],[1,-5],[2,-11],[0,-15],[-2,-9],[-1,-4],[-8,4],[-8,4],[-1,5],[-1,7],[-1,3],[0,-1],[-1,-7],[-1,-9],[-2,-4],[-2,0],[-5,6],[-1,5],[-1,5],[-1,4],[0,4],[-1,0],[-9,-17],[-14,-2],[-14,-3],[-2,11],[1,4],[1,6],[2,16],[-12,-6],[-12,-6],[-2,13],[2,11],[4,6],[2,12],[-8,0],[-8,1],[-4,14],[-2,4],[-5,13],[-2,3],[-3,-5],[-1,1],[-2,8],[-11,8],[-11,8],[-11,8],[-2,8],[-1,1],[-5,-10],[-2,0],[-6,9],[-3,13],[-1,22],[1,9],[1,6],[5,15],[11,8],[12,8],[11,8],[12,8],[5,19],[3,1],[3,-7],[3,-18],[-2,-13],[-1,-3],[-8,-4],[-2,-5],[-2,-10],[12,9],[3,-2],[2,-6],[-1,-12],[0,-5],[1,-1],[3,3],[1,2],[1,6],[1,21],[1,5],[2,3],[1,0],[3,-4],[5,-19],[5,-25],[1,-4],[5,-3],[2,-4],[2,-1],[1,3],[-3,27],[-1,6],[-5,11],[-4,16],[-1,2],[0,9],[1,6],[2,6],[2,5],[2,22],[1,3],[1,2],[8,1],[7,-18],[8,-17],[-2,-19],[-2,-10],[-5,-10],[1,-11],[1,-3],[0,-3],[0,-7],[0,-2],[-1,-6],[0,-3]],[[2947,6589],[8,-33],[2,-16],[-1,-12],[-1,-8],[-11,-34],[-11,-34],[-7,-8],[-7,-8],[-11,-13],[-12,-13],[-11,-13],[-6,5],[-2,5],[0,4],[-1,4],[0,5],[-2,33],[0,2],[2,16],[2,10],[8,18],[12,10],[13,10],[2,7],[1,10],[1,12],[0,7],[0,17],[1,4],[0,6],[2,2],[1,1],[1,-3],[1,-5],[4,-32],[3,-32],[0,1],[3,10],[0,4],[0,32],[0,21],[0,6],[2,1],[2,-4],[2,-7],[2,-12],[1,-3],[1,-3],[-1,22],[0,3],[1,7],[0,4],[1,2],[1,0],[4,-8]],[[4913,6603],[-9,-3],[-1,3],[-1,2],[0,3],[1,12],[0,7],[2,12],[3,25],[1,6],[3,11],[4,7],[5,-1],[3,-11],[1,-10],[0,-15],[0,-16],[0,-12],[-1,-9],[-1,-5],[-2,-4],[-8,-2]],[[5745,6648],[0,-5],[-1,-4],[-1,-2],[-1,1],[-2,5],[-1,0],[-2,-3],[-1,-8],[-2,-2],[-11,20],[-2,8],[0,7],[-1,5],[0,5],[-1,6],[0,5],[1,8],[0,5],[0,4],[0,4],[1,4],[0,6],[4,14],[0,3],[2,11],[1,6],[1,5],[2,4],[3,2],[4,-5],[2,-6],[0,-3],[1,-4],[0,-5],[1,-20],[1,-12],[1,-18],[2,-10],[0,-4],[0,-5],[0,-5],[-1,-17]],[[5040,6750],[0,-18],[0,-1],[-2,-17],[-3,-24],[-1,-10],[-1,-26],[0,-9],[-1,-4],[-1,7],[0,12],[0,15],[-2,17],[-2,10],[-1,16],[0,29],[1,13],[1,7],[8,8],[1,-1],[2,-5],[0,-8],[1,-11]],[[2924,6863],[0,-14],[5,-17],[0,-2],[1,-3],[0,-7],[0,-3],[1,-3],[1,-6],[1,-2],[0,-2],[0,-3],[0,-5],[0,-1],[-1,-3],[-4,-5],[-1,1],[-1,-3],[0,-4],[0,-5],[0,-5],[1,-4],[0,-3],[1,-6],[0,-6],[-1,-5],[0,-3],[-1,-3],[-2,-6],[-1,-8],[0,-2],[-3,-5],[-9,9],[-8,8],[-6,7],[-2,12],[-2,21],[1,8],[0,11],[1,13],[1,11],[4,9],[10,7],[0,2],[-1,12],[-1,3],[0,1],[-2,-1],[-1,2],[-1,6],[13,18],[5,-7],[2,-9]],[[3001,6890],[-2,-9],[0,-2],[2,-12],[-1,0],[-1,4],[-2,13],[-1,4],[-1,2],[-1,-1],[0,-1],[0,-4],[0,-2],[0,-1],[1,-3],[0,-3],[-1,-2],[-8,14],[-8,14],[0,4],[-1,7],[-1,2],[0,2],[0,2],[0,5],[-1,6],[-2,10],[-1,9],[1,9],[1,9],[3,12],[2,4],[2,-1],[8,-17],[2,-12],[1,-7],[0,-6],[1,-7],[1,-5],[1,-2],[0,-3],[0,-6],[0,-3],[0,-1],[1,-2],[3,-9],[2,-6],[0,-5]],[[3283,6950],[0,-7],[-1,-1],[-1,2],[-1,-5],[0,-11],[1,-6],[0,-1],[0,-2],[-1,-7],[-1,-4],[0,-2],[1,-7],[0,-1],[-1,-1],[0,-3],[-1,-4],[1,-8],[-1,-4],[-1,-3],[-1,-2],[-1,1],[-1,4],[0,4],[0,3],[0,3],[0,7],[-2,14],[0,7],[0,3],[0,2],[0,1],[0,2],[0,3],[0,2],[0,2],[0,2],[0,3],[0,4],[0,3],[0,7],[-2,16],[-1,15],[-5,31],[-1,17],[-1,15],[-1,14],[2,10],[2,4],[2,-1],[5,-12],[3,-14],[1,-9],[1,-10],[4,-26],[1,-4],[0,-4],[0,-5],[0,-4],[1,-4],[1,-5],[0,-2],[0,-4],[1,-4],[0,-3],[0,-4],[0,-2],[-1,-3],[0,-1],[-1,-1]],[[3055,7057],[-1,-1],[0,1],[0,-2],[0,-2],[0,-4],[0,-2],[0,-1],[-1,-2],[0,-3],[0,-2],[-1,0],[-1,2],[1,-10],[1,-3],[0,-1],[-1,-7],[1,3],[1,1],[5,-5],[3,5],[1,-2],[1,-7],[3,-41],[1,-3],[0,-2],[0,-3],[0,-1],[0,-4],[1,-11],[1,-5],[0,-3],[0,-3],[0,-3],[0,-3],[0,-3],[0,-2],[2,-5],[2,-13],[0,-8],[0,-2],[0,-3],[0,-11],[0,-2],[0,-2],[0,-2],[0,-2],[0,-2],[0,-7],[0,-6],[0,-5],[0,-4],[0,-5],[0,-8],[1,-12],[1,-6],[0,-4],[0,-5],[-1,-5],[1,-4],[0,-3],[1,-4],[0,-3],[0,-4],[0,-4],[0,-3],[2,-18],[3,-37],[9,-71],[1,-21],[1,-12],[1,-22],[1,-8],[0,-5],[2,-7],[1,-5],[0,-2],[0,-2],[0,-1],[0,-2],[0,-4],[0,-1],[0,-2],[1,-2],[0,-6],[0,-13],[0,-5],[1,-1],[0,-1],[0,-2],[0,-2],[0,-5],[0,-1],[0,-2],[1,-4],[0,-7],[1,-2],[-4,-3],[-1,0],[1,-4],[3,-5],[1,-6],[0,-5],[0,-12],[1,-29],[0,-2],[-1,-7],[1,-14],[0,-6],[0,-2],[0,-2],[0,-2],[0,-2],[0,-6],[1,-18],[0,-9],[0,-13],[0,-22],[0,-3],[0,-3],[0,-4],[1,-4],[-1,-3],[-1,-6],[0,-7],[1,-7],[-1,-2],[0,-3],[0,-2],[0,-2],[1,-8],[0,-8],[1,-8],[0,-16],[0,-6],[1,-3],[0,-9],[-1,-9],[0,-10],[0,-13],[0,-41],[0,-13],[-1,-8],[-2,-4],[-3,1],[-2,-2],[1,-4],[0,-6],[1,-7],[0,-7],[0,-4],[0,-3],[0,-1],[2,-7],[0,-3],[0,-3],[0,-4],[0,-5],[0,-5],[0,-4],[-1,-12],[-1,-12],[0,-22],[0,-7],[-2,-4],[-2,3],[-3,9],[-1,1],[-1,-1],[0,-2],[-1,-4],[0,-4],[1,-4],[0,-2],[-1,-4],[-2,-6],[-2,0],[1,-2],[0,-4],[0,-2],[0,-1],[0,-2],[0,-2],[0,-1],[0,-4],[0,-1],[-1,-4],[0,-2],[-1,-1],[-1,1],[-4,-3],[0,-1],[0,-2],[0,-2],[0,-3],[0,-2],[0,-3],[-1,-3],[0,-1],[-1,0],[0,-15],[1,-2],[1,-9],[-2,-14],[-12,-15],[-12,-16],[-5,2],[-7,-13],[-4,0],[0,3],[-1,5],[0,8],[0,9],[0,7],[-1,4],[0,1],[-1,-1],[0,-1],[-1,-4],[0,-1],[-1,0],[0,-1],[-1,-3],[0,-5],[0,-5],[0,-4],[-1,-5],[0,-1],[-8,3],[-7,4],[-13,-8],[-14,-7],[-3,12],[1,4],[0,5],[0,4],[0,3],[2,13],[-2,-1],[-1,-2],[-3,-13],[-1,-2],[-1,-1],[-3,5],[-8,41],[-1,7],[-1,7],[1,3],[1,13],[8,31],[4,7],[6,-1],[4,-7],[1,-2],[0,-5],[1,-5],[0,-3],[0,-2],[0,-1],[2,-4],[1,0],[0,5],[0,2],[0,3],[0,2],[1,2],[1,1],[5,-11],[11,-5],[11,-6],[11,-5],[1,3],[1,1],[0,1],[0,2],[0,2],[0,1],[0,2],[0,3],[1,1],[11,26],[0,1],[1,7],[0,1],[1,2],[0,1],[-2,5],[-3,4],[-1,4],[0,8],[-1,6],[-1,5],[-1,1],[-8,-13],[-9,-27],[-9,-10],[-5,3],[-4,15],[0,1],[1,4],[-11,21],[1,8],[0,5],[13,12],[13,12],[9,20],[1,3],[0,4],[0,2],[-1,3],[0,2],[0,5],[0,5],[1,2],[0,2],[0,4],[-2,8],[-1,7],[-1,2],[-5,-13],[-2,0],[-1,1],[-4,13],[-2,3],[-3,-2],[-8,-20],[-2,0],[0,4],[0,2],[0,3],[0,1],[0,2],[0,1],[0,2],[1,3],[0,4],[-1,10],[0,2],[-1,-1],[0,1],[0,1],[-1,5],[0,1],[0,2],[-2,6],[0,1],[0,1],[-1,3],[0,1],[0,1],[-3,11],[-1,0],[-1,-2],[1,2],[0,6],[0,3],[-3,11],[1,1],[0,4],[0,1],[-3,4],[0,-1],[0,-2],[0,-4],[0,-2],[-1,-2],[-1,-2],[0,-2],[-1,-3],[0,-5],[0,-6],[-2,-12],[-1,-5],[-2,5],[-1,0],[0,-2],[0,-5],[0,-5],[0,-5],[0,-3],[0,-4],[-1,-8],[0,-11],[-1,-9],[-1,-5],[-2,-7],[-3,-2],[-2,0],[-5,10],[-5,17],[-3,4],[-8,-1],[-2,-8],[10,-51],[-8,-28],[0,-12],[-3,-9],[-3,-5],[-3,0],[-3,9],[-3,27],[-1,7],[-1,2],[-7,-12],[-5,3],[-7,24],[-8,24],[-1,8],[-1,9],[0,13],[1,12],[2,4],[1,1],[2,2],[-1,7],[2,2],[0,4],[0,3],[-1,3],[0,2],[0,1],[0,1],[0,1],[0,4],[-1,2],[-1,0],[-3,7],[0,3],[1,9],[1,4],[4,6],[0,6],[1,6],[0,5],[1,4],[1,3],[2,3],[4,-1],[2,-8],[4,-25],[7,-14],[1,0],[2,3],[0,3],[0,5],[0,4],[-1,4],[-2,10],[0,7],[0,8],[0,8],[-1,7],[1,7],[-1,8],[0,7],[2,7],[4,9],[3,0],[7,-25],[2,-10],[1,-8],[5,-20],[1,-13],[2,4],[4,20],[-2,13],[-5,14],[-2,15],[-1,8],[0,7],[1,6],[0,5],[2,4],[5,3],[9,-15],[9,-16],[3,1],[0,1],[1,8],[1,4],[10,-3],[0,5],[0,2],[0,4],[0,2],[0,1],[1,1],[-4,14],[-8,10],[-8,9],[-5,17],[-2,13],[1,9],[1,5],[4,0],[2,2],[0,2],[1,6],[0,1],[1,2],[7,-4],[4,3],[10,-15],[9,-16],[4,7],[5,23],[1,3],[0,3],[1,7],[0,3],[-1,2],[0,4],[-1,5],[1,6],[0,2],[4,-10],[1,-1],[1,3],[2,8],[1,1],[6,-12],[2,0],[9,18],[3,-2],[2,-12],[3,-18],[3,-36],[0,-2],[2,-3],[1,1],[1,0],[0,3],[0,1],[1,-2],[0,2],[0,7],[0,2],[0,2],[0,1],[0,1],[0,2],[0,1],[0,6],[0,6],[0,5],[1,2],[-1,13],[0,7],[0,8],[0,6],[0,6],[1,9],[0,3],[0,2],[0,3],[0,2],[0,4],[0,1],[-1,6],[-1,0],[0,-1],[0,-1],[-1,-10],[-1,-2],[0,-1],[0,1],[-2,7],[0,3],[-4,-3],[-2,6],[-5,7],[-8,-4],[-3,4],[-6,18],[-4,3],[-1,4],[0,2],[-1,3],[0,3],[0,8],[0,2],[0,1],[-1,3],[0,11],[1,7],[4,23],[1,4],[0,3],[1,7],[0,1],[0,10],[1,7],[12,23],[12,23],[1,-1],[11,-30],[2,-1],[1,2],[0,8],[-1,6],[-2,8],[-12,37],[-3,3],[0,2],[0,2],[-1,11],[1,4],[1,1],[1,3],[-1,3],[0,3],[0,2],[0,1],[-1,1],[-7,-10],[-2,0],[-1,3],[-2,13],[0,1],[-1,1],[-2,-4],[-1,-3],[0,-5],[0,-1],[0,-2],[-1,-2],[-3,-18],[-1,-1],[0,3],[-1,0],[-1,-4],[-1,0],[0,3],[-1,5],[-1,4],[-4,4],[-1,2],[0,3],[-1,7],[0,2],[-1,2],[-4,6],[-4,12],[-2,11],[-1,5],[0,3],[-1,6],[0,3],[0,1],[-1,3],[-1,5],[0,4],[0,5],[0,3],[1,7],[-1,6],[1,4],[0,5],[1,6],[0,15],[0,2],[0,2],[-1,3],[0,2],[0,3],[0,3],[0,2],[1,1],[-1,5],[0,5],[-1,5],[0,3],[1,5],[1,4],[3,8],[0,3],[0,1],[0,2],[0,2],[0,4],[0,2],[0,5],[0,1],[0,8],[0,7],[2,12],[0,1],[-1,1],[0,1],[0,1],[1,6],[0,2],[0,2],[0,2],[1,3],[0,3],[-2,11],[1,3],[0,1],[0,2],[0,3],[-4,4],[0,2],[-1,4],[0,2],[-2,3],[-1,4],[0,4],[-1,1],[-3,-1],[0,2],[1,3],[1,2],[-1,6],[-2,16],[-1,2],[1,6],[0,12],[1,4],[-1,2],[-1,12],[-1,4],[0,4],[0,5],[1,5],[0,4],[3,22],[1,10],[0,2],[9,16],[8,16],[11,1],[3,5],[0,7],[1,3],[8,3],[3,8],[1,0],[1,-2],[3,-17],[4,-9],[1,-9],[1,-4],[0,-4],[0,-8],[0,-5],[0,-4],[0,-8],[-1,-4],[1,-17],[0,-2],[1,-5],[1,-8],[0,-1],[-1,-3],[-1,-2],[0,-2],[0,-6],[1,-4],[0,-3],[1,-6],[0,-6]],[[2485,7186],[0,-1],[-1,1],[0,-1],[-1,-1],[0,2],[-1,3],[0,3],[0,3],[0,4],[0,1],[0,3],[0,3],[1,3],[0,3],[0,1],[0,1],[0,1],[1,-1],[1,0],[0,-1],[0,-4],[1,-3],[0,-2],[0,-2],[0,-2],[0,-3],[0,-2],[0,-4],[0,-4],[-1,-1]],[[3111,7779],[0,-1],[2,1],[1,-1],[1,-3],[1,-5],[1,-2],[0,-3],[0,-3],[-1,-4],[1,-3],[2,-2],[1,-3],[0,-1],[-2,-8],[-1,-5],[0,-1],[-1,0],[-1,0],[0,-1],[0,-1],[0,-2],[0,-2],[0,-2],[0,-3],[0,-2],[0,-3],[-1,-2],[-1,-2],[-1,0],[0,-1],[-1,-3],[0,-2],[0,-3],[1,-3],[-1,-3],[0,-1],[0,-2],[-3,-5],[-4,-17],[2,-5],[1,-2],[3,2],[2,-4],[0,-11],[0,-7],[0,-7],[-3,-20],[-1,-4],[0,-2],[0,-3],[0,-3],[-1,-2],[0,-1],[-2,9],[-1,3],[0,2],[0,3],[-1,0],[-3,-9],[-1,-4],[0,-5],[0,-2],[1,-4],[0,-5],[0,-6],[-1,-5],[-1,-13],[-2,-18],[-1,-3],[0,-1],[-1,1],[-1,9],[-1,1],[0,-2],[0,-1],[1,-1],[-1,-2],[0,-2],[-2,-5],[-4,-4],[-1,2],[0,3],[0,3],[0,4],[0,4],[0,1],[0,1],[0,1],[0,1],[0,2],[-1,1],[-1,7],[0,2],[-1,0],[0,1],[-1,2],[0,1],[0,4],[0,1],[-1,5],[-1,7],[0,5],[-1,4],[0,4],[0,5],[0,9],[0,9],[1,8],[1,15],[1,15],[7,41],[1,11],[0,1],[0,2],[0,8],[2,31],[9,98],[2,11],[13,55],[1,2],[0,1],[1,-1],[1,-1],[2,-9],[0,-4],[0,-3],[0,-2],[1,-2],[-1,-5],[0,-2],[0,-4],[0,-1],[-2,-6],[0,-2],[0,-1],[0,-1],[0,-2],[-1,-4],[-1,-2],[-1,-4],[1,-2],[0,-5],[-2,-3],[-1,0],[0,-1],[0,-3],[-1,-2],[1,-4],[0,-2],[-1,-3],[0,-2],[-1,-2],[0,-5],[0,-1],[-1,-5],[0,-3],[0,-7],[0,-4],[0,-3],[2,-11],[1,-5],[0,-3],[0,-2],[-1,-2],[1,-3],[-1,-2],[-1,-2],[0,-5],[0,-3]],[[7805,8253],[-1,-6],[-12,-7],[-1,2],[1,4],[0,1],[0,1],[-1,2],[-4,-2],[-1,2],[-1,5],[0,9],[-1,13],[1,20],[3,19],[2,16],[3,10],[4,7],[6,1],[5,-11],[4,-28],[0,-16],[-1,-11],[-6,-31]],[[3242,8724],[1,-1],[1,0],[1,0],[0,-4],[0,-2],[0,-1],[0,-1],[0,-2],[-1,-1],[1,-5],[0,-3],[-3,-7],[-1,-3],[0,-4],[0,-1],[1,-1],[0,-1],[0,-2],[0,-1],[-1,-2],[0,-4],[0,-2],[0,-2],[-1,-4],[0,-3],[1,0],[1,2],[2,10],[0,3],[1,1],[2,0],[-1,-4],[-3,-17],[0,-7],[1,0],[0,1],[2,7],[1,1],[0,-2],[0,-6],[-1,-6],[-3,-16],[-1,-4],[-1,-4],[1,-4],[0,-2],[1,0],[3,2],[0,-1],[0,3],[0,1],[0,2],[2,5],[1,9],[0,1],[1,1],[-1,-6],[1,-1],[1,0],[1,5],[0,1],[0,-1],[0,-1],[2,-14],[0,-2],[0,-4],[-5,-12],[-1,0],[0,-1],[0,-1],[0,-4],[-1,-2],[0,-1],[0,1],[-2,-1],[0,-2],[-1,-3],[0,-2],[0,-4],[0,-2],[0,-1],[-1,-8],[-1,-4],[0,-1],[-1,-5],[0,-4],[-1,-3],[0,-1],[-1,-2],[-1,3],[0,3],[0,3],[0,3],[0,2],[-1,1],[0,1],[-3,-4],[0,-3],[0,-1],[1,-2],[1,-3],[-1,-1],[-1,-2],[0,-2],[-2,-14],[-1,-4],[0,-7],[0,-2],[-1,1],[-1,4],[0,1],[0,3],[0,3],[0,2],[0,3],[-1,2],[0,1],[-1,3],[-5,5],[-1,-1],[0,2],[-2,11],[-1,7],[-4,2],[0,1],[0,1],[0,1],[0,2],[0,2],[1,0],[0,1],[0,3],[0,3],[1,3],[0,2],[0,1],[1,4],[0,3],[0,6],[0,5],[-1,2],[2,4],[0,1],[2,7],[5,7],[1,11],[0,2],[-2,11],[0,2],[0,1],[1,0],[1,6],[0,1],[4,0],[1,2],[0,4],[0,5],[0,1],[0,4],[0,1],[0,1],[1,0],[0,1],[0,1],[0,5],[-1,2],[-1,2],[1,1],[0,7],[3,3],[0,1],[0,2],[0,5],[0,3],[0,3],[0,4],[6,2],[0,3],[0,2],[0,1],[0,-1],[1,-4],[1,-2],[0,-1],[0,-1],[0,-2],[0,-1]],[[3270,8784],[7,-15],[0,-4],[-1,-2],[-2,-1],[-2,-2],[0,-3],[0,-4],[1,-1],[2,1],[0,-1],[0,-1],[0,-2],[0,-2],[0,-1],[1,0],[0,-1],[0,-5],[-3,-20],[-1,-1],[0,-1],[0,-2],[0,-3],[0,-4],[0,-3],[0,-2],[0,-3],[0,-2],[0,-2],[0,-2],[1,0],[-2,-11],[-1,0],[0,3],[-1,0],[-1,-3],[0,-1],[0,-2],[1,-2],[0,-2],[0,-2],[0,-2],[-1,-1],[0,-5],[-1,-7],[0,-1],[-1,1],[-1,-1],[0,-2],[0,-1],[0,-3],[0,-1],[-1,-2],[0,4],[0,6],[0,2],[-1,1],[-1,-2],[0,-3],[0,-2],[0,-3],[0,-3],[0,-3],[-1,-6],[0,-1],[-1,0],[0,2],[-1,5],[-1,1],[-1,0],[-1,0],[0,5],[0,6],[1,0],[1,-2],[1,0],[2,7],[-1,4],[-1,3],[0,7],[0,3],[0,2],[0,2],[0,1],[1,1],[0,1],[0,1],[0,2],[0,1],[1,4],[0,3],[0,2],[1,6],[0,2],[0,3],[1,5],[0,2],[1,7],[0,7],[1,4],[0,4],[-1,4],[0,2],[-1,1],[0,1],[0,1],[-1,5],[0,1],[0,1],[0,1],[0,2],[0,6],[-1,4],[-1,3],[0,5],[1,0],[0,-1],[1,1],[1,5],[1,4],[0,1],[-1,8],[-1,2],[0,2],[0,2],[2,5],[0,1],[0,4],[0,1],[3,1],[2,-2],[1,-5],[0,-3],[0,-6],[0,-7],[0,-5],[0,-2]],[[3394,8879],[1,-21],[0,-5],[-1,-3],[0,-2],[-1,-2],[0,-3],[1,-2],[0,-2],[0,-2],[-1,-2],[-1,-9],[1,-6],[1,-4],[-1,-3],[0,-1],[0,-2],[1,-2],[0,-4],[0,-3],[-1,-2],[0,-3],[-1,-1],[1,-3],[1,-1],[1,0],[1,1],[0,15],[0,4],[3,13],[2,14],[2,5],[-1,-1],[0,-2],[0,-4],[0,-3],[1,-2],[0,-3],[-1,-5],[0,-1],[0,-3],[0,-1],[0,-2],[0,-2],[0,-1],[0,-1],[0,-2],[10,-21],[-1,-3],[0,-1],[0,-3],[0,-1],[0,-1],[1,-1],[-1,-4],[-1,-1],[-3,1],[-1,-1],[0,-1],[-1,-4],[0,-1],[2,0],[0,-2],[0,-2],[1,0],[0,-1],[0,-6],[-1,-1],[1,0],[1,1],[1,4],[2,1],[1,-2],[0,3],[1,2],[0,-2],[0,-8],[0,-5],[-1,-3],[-2,-5],[-1,0],[-1,2],[1,-3],[-1,-3],[0,-2],[0,-1],[-1,0],[0,1],[-3,8],[0,1],[-1,-1],[-1,-5],[4,-7],[0,-2],[1,-4],[-2,-3],[-4,8],[-1,-11],[0,-2],[5,-4],[0,-2],[1,-2],[1,-10],[0,-3],[0,-2],[0,-3],[-2,-6],[-1,0],[-1,1],[0,1],[0,3],[0,7],[0,2],[-1,2],[0,1],[-1,0],[0,-1],[1,-5],[0,-4],[0,-2],[-1,-1],[0,2],[0,3],[-1,3],[0,2],[0,2],[-1,1],[0,-1],[0,-5],[0,1],[-1,6],[-1,1],[0,-1],[0,-8],[0,-4],[0,-4],[0,-4],[-1,0],[-1,0],[0,4],[0,5],[0,5],[0,4],[1,3],[0,5],[1,4],[0,1],[-1,4],[-1,-2],[-1,-4],[-1,-3],[0,2],[-1,4],[0,-2],[0,-1],[0,-5],[0,-2],[0,-2],[0,-4],[0,-3],[1,-2],[0,-3],[0,-4],[0,-3],[-1,-2],[0,-3],[0,1],[-1,-2],[1,-3],[-1,-1],[-1,1],[-1,4],[-1,2],[1,4],[0,2],[0,2],[0,2],[0,7],[0,1],[1,1],[0,2],[-1,5],[0,2],[-3,0],[0,-1],[0,-3],[0,-3],[0,-8],[0,-3],[-1,-4],[0,-3],[-1,-1],[0,4],[1,7],[0,3],[-1,1],[-1,-2],[-1,-7],[0,-2],[0,-1],[-1,2],[0,2],[0,3],[0,2],[-2,13],[0,4],[1,3],[1,4],[2,2],[0,-1],[0,1],[0,1],[0,1],[0,1],[0,1],[1,2],[1,1],[1,2],[1,2],[0,3],[-1,4],[-2,3],[-2,2],[1,9],[1,23],[0,6],[-2,5],[-2,-5],[-1,-8],[-1,-5],[-2,1],[-1,3],[0,5],[0,1],[1,2],[-1,5],[0,1],[0,6],[0,3],[1,2],[1,4],[0,5],[0,5],[0,4],[1,3],[1,1],[0,1],[0,3],[0,2],[-1,6],[1,10],[1,6],[3,5],[1,0],[0,-2],[1,4],[0,2],[0,1],[0,3],[0,5],[0,2],[2,4],[2,-8],[0,2],[0,2],[0,3],[0,3],[0,1],[-1,4],[1,4],[1,1],[3,3],[0,-6],[-1,0],[0,-1],[1,-1],[0,-1]],[[0,1915],[1,-1],[11,4],[12,4],[12,4],[11,4],[4,-4],[0,-1],[0,-2],[-1,-2],[5,-7],[0,-4],[1,-6],[8,-11],[4,6],[6,-2],[6,8],[10,-2],[10,-1],[9,-1],[-1,-4],[-10,-5],[-1,-5],[7,-9],[7,-8],[0,-2],[-1,-1],[1,-1],[1,-7],[2,-8],[0,-2],[9,9],[9,8],[2,4],[1,11],[-1,3],[0,1],[-1,1],[0,6],[1,2],[14,-6],[13,-5],[14,-6],[14,-5],[14,-6],[13,-6],[14,-5],[14,-6],[14,-6],[13,-5],[14,-6],[14,-6],[13,-5],[14,-6],[1,-3],[2,-11],[1,-2],[-1,-9],[3,-17],[1,-3],[7,-5],[7,-6],[1,-8],[-2,-4],[3,-6],[7,8],[8,8],[13,-4],[13,-3],[13,-3],[14,-3],[13,-3],[13,-3],[3,-7],[13,-3],[13,-3],[1,1],[3,9],[14,-8],[14,-8],[14,-8],[14,-8],[13,-9],[14,-8],[14,-8],[14,-8],[5,-19],[6,-8],[0,7],[-1,5],[-2,7],[2,3],[2,-1],[2,-3],[5,-19],[1,-2],[11,-4],[12,-4],[12,-4],[12,-4],[12,-4],[-1,7],[-12,1],[-12,1],[13,2],[13,2],[1,2],[1,7],[-1,5],[-4,0],[1,3],[8,2],[7,1],[-13,13],[-13,14],[-13,13],[-1,3],[-1,10],[-1,4],[-9,10],[-8,11],[2,4],[12,-1],[13,-2],[12,-2],[12,-2],[1,1],[1,0],[-2,4],[-8,2],[11,2],[-1,4],[-4,2],[8,7],[-1,4],[-13,2],[-13,2],[-13,3],[-12,2],[-13,2],[-13,2],[3,3],[1,5],[-13,6],[-13,6],[-13,6],[-13,6],[-13,6],[-13,6],[-13,7],[-13,6],[-13,6],[-13,6],[-13,6],[-13,6],[-1,2],[0,5],[0,1],[0,2],[0,1],[0,2],[-5,11],[11,-2],[12,-2],[-2,5],[-9,16],[-14,1],[-13,1],[-14,1],[-1,-4],[-1,-1],[-11,8],[-12,7],[-11,7],[13,-5],[13,-4],[-1,6],[3,5],[14,0],[13,0],[13,1],[14,0],[13,0],[0,1],[-1,4],[0,2],[-11,6],[-10,5],[-10,6],[0,1],[-1,2],[1,4],[1,0],[1,3],[-1,-1],[-3,5],[-1,4],[1,1],[1,3],[-12,14],[-3,10],[-12,6],[1,7],[1,2],[2,-3],[-1,6],[-1,5],[0,5],[2,6],[12,0],[13,1],[12,1],[-1,6],[-9,14],[1,0],[0,5],[1,1],[2,0],[0,1],[0,2],[0,2],[-1,2],[-1,4],[-13,20],[-13,20],[-1,7],[-1,2],[-12,10],[-2,6],[-1,1],[-11,-14],[-1,-1],[-1,-4],[-2,-5],[-11,4],[-11,4],[-12,4],[-11,4],[2,-7],[10,-7],[2,-5],[-3,-4],[-11,10],[-11,10],[3,4],[-2,4],[-6,4],[8,0],[8,0],[-1,7],[-14,3],[-3,7],[-3,13],[-5,11],[0,6],[2,9],[0,2],[0,10],[-1,4],[-12,5],[-1,3],[-1,6],[2,5],[7,0],[-8,5],[-8,6],[0,1],[-2,9],[0,1],[-13,12],[-13,13],[-13,12],[-13,13],[-13,12],[2,3],[10,-7],[10,-8],[-12,17],[-12,17],[-12,17],[-13,16],[-12,17],[-12,17],[-12,17],[-9,35],[-1,11],[1,7],[2,1],[10,-18],[10,-19],[10,-18],[13,0],[6,16],[10,-9],[10,-10],[11,-9],[12,-35],[1,-3],[3,-22],[1,-13],[0,-5],[2,-5],[10,-13],[11,-13],[10,-12],[2,3],[-6,19],[12,-1],[11,-1],[11,-1],[12,-1],[1,3],[1,11],[0,2],[8,-3],[8,-3],[0,1],[2,8],[1,1],[12,0],[13,-1],[12,0],[13,0],[12,-1],[7,-16],[-1,-5],[0,-1],[-1,-1],[-1,-2],[0,-1],[0,-2],[0,-1],[0,-2],[0,-2],[0,-1],[0,-5],[-1,-7],[0,-6],[1,1],[4,-8],[1,-5],[2,-16],[1,-3],[0,-1],[0,-2],[-1,-2],[0,-2],[0,-6],[1,-4],[1,-3],[12,-7],[2,7],[-1,9],[0,4],[-1,8],[0,5],[0,5],[0,4],[1,3],[8,4],[8,5],[3,11],[5,-1],[4,8],[8,-2],[1,-4],[1,-11],[-1,-1],[0,-1],[1,-7],[1,-2],[11,-9],[3,-9],[-2,-4],[-4,-4],[2,-7],[6,-10],[12,3],[12,3],[11,3],[12,3],[12,3],[8,-11],[8,-11],[8,0],[2,4],[1,2],[0,9],[1,9],[1,6],[14,7],[13,8],[13,8],[1,2],[1,10],[1,4],[8,19],[7,19],[-3,8],[-13,5],[-13,4],[-14,4],[-1,3],[-1,9],[1,5],[14,4],[13,4],[14,4],[13,4],[13,4],[14,4],[4,13],[-1,18],[10,26],[0,5],[1,16],[1,5],[11,14],[12,15],[12,14],[11,15],[12,14],[12,14],[-1,8],[0,4],[-2,6],[0,4],[-2,10],[0,4],[-3,10],[-2,13],[-12,28],[-13,28],[-12,28],[-1,9],[4,10],[-10,18],[-9,18],[-1,7],[2,7],[6,15],[3,14],[2,5],[8,5],[7,6],[2,5],[2,10],[-1,4],[-2,15],[-1,3],[-1,1],[-3,1],[-1,2],[-1,6],[-1,3],[-6,12],[-1,2],[0,7],[-1,2],[-1,5],[-12,9],[-5,15],[-11,10],[-11,9],[-12,9],[-11,10],[-12,9],[-2,11],[0,4],[0,2],[0,6],[1,6],[1,3],[9,19],[8,18],[14,4],[13,4],[14,5],[14,4],[13,4],[14,5],[13,4],[14,4],[14,5],[13,4],[14,4],[13,4],[14,5],[14,4],[13,4],[14,5],[14,4],[13,4],[1,5],[1,7],[-1,8],[-1,5],[-8,4],[-9,4],[-1,4],[5,2],[-2,5],[-8,3],[1,2],[0,1],[2,1],[-1,8],[-10,3],[-10,3],[-10,3],[8,4],[8,3],[-8,3],[-7,3],[2,5],[0,1],[9,1],[-6,6],[2,6],[13,-2],[13,-1],[-3,3],[-7,1],[-8,1],[-3,9],[0,1],[-10,0],[-9,0],[-1,3],[6,4],[-2,4],[-6,2],[5,5],[-1,4],[-8,-1],[-8,0],[-3,5],[2,6],[5,0],[-10,14],[0,3],[1,2],[0,1],[1,0],[-1,3],[-9,0],[-8,0],[2,6],[6,-1],[-4,5],[12,1],[13,1],[-1,5],[-6,8],[-2,8],[-3,5],[-9,-1],[4,5],[-1,12],[-1,5],[-4,3],[2,10],[2,2],[5,-4],[10,12],[-1,8],[-1,6],[-1,5],[-2,8],[-1,4],[-1,7],[11,-5],[10,-5],[11,-4],[11,-5],[0,1],[0,1],[0,4],[0,2],[1,1],[3,4],[4,7],[13,4],[14,3],[-1,4],[-12,2],[-12,3],[-1,6],[8,0],[9,1],[-1,6],[-10,2],[-9,1],[-10,2],[2,3],[10,-2],[9,-1],[-1,3],[-11,3],[2,1],[2,5],[-1,3],[-2,1],[1,3],[2,1],[-10,4],[1,2],[0,1],[1,0],[-3,6],[-2,1],[-1,4],[8,-1],[5,-8],[14,-1],[-1,-6],[-4,0],[1,-4],[5,0],[-1,-4],[1,-3],[12,-1],[11,-1],[0,9],[3,3],[-2,3],[-1,1],[-3,-1],[-2,-7],[-1,-1],[-5,8],[-9,0],[1,4],[7,5],[-13,13],[-2,9],[3,-2],[1,1],[2,5],[1,-1],[-2,5],[5,2],[-11,11],[-12,10],[-11,11],[-2,7],[1,5],[-2,7],[-12,8],[-13,8],[-12,8],[-3,8],[-13,22],[-14,22],[-13,21],[3,10],[3,12],[1,1],[1,1],[1,2],[-1,5],[-1,2],[-13,-22],[-2,1],[-1,3],[-3,12],[3,9],[9,11],[-3,1],[3,11],[0,1],[0,4],[0,1],[7,23],[-1,1],[-8,-9],[-1,1],[-3,10],[-1,-1],[0,-7],[0,-4],[-3,-11],[-6,-11],[-1,1],[0,6],[-3,14],[-6,-19],[-3,6],[-1,4],[-13,9],[-14,9],[-13,9],[-13,9],[-1,4],[-1,8],[0,2],[-10,28],[-11,28],[-10,28],[-10,28],[-1,4],[0,9],[1,6],[1,4],[11,13],[2,5],[-1,5],[0,3],[-2,3],[2,5],[10,3],[9,3],[10,3],[1,4],[-2,10],[4,1],[3,-9],[2,-2],[6,7],[-2,6],[2,4],[4,0],[2,6],[-1,5],[1,7],[3,6],[-1,9],[0,9],[2,11],[6,0],[3,6],[-11,3],[0,1],[0,3],[-1,3],[0,3],[0,3],[-1,3],[-1,2],[0,2],[-1,6],[0,2],[-1,2],[-5,0],[-4,-7],[2,-7],[0,-3],[-3,-8],[0,-2],[0,-5],[0,-2],[-10,-8],[-3,4],[-1,14],[5,4],[3,-4],[-1,5],[0,10],[-1,2],[-4,-2],[-2,-11],[-2,-2],[0,1],[-2,7],[0,2],[-1,-1],[-1,-6],[-1,-1],[-6,-4],[-6,6],[-2,-4],[-9,0],[-1,2],[-2,9],[0,2],[0,5],[-3,-2],[-2,3],[0,-1],[-1,-4],[0,-1],[0,-2],[0,-1],[0,-8],[-2,-7],[-6,-13],[-7,0],[-1,4],[-3,15],[-9,24],[-8,25],[-1,3],[-2,10],[0,3],[-3,0],[-2,8],[-2,0],[0,2],[-1,4],[-1,5],[-1,6],[0,6],[-1,5],[-5,12],[0,5],[1,6],[2,22],[1,3],[1,4],[1,3],[1,5],[0,6],[1,16],[1,7],[1,7],[4,9],[1,11],[-5,14],[1,11],[1,7],[2,12],[-1,9],[-3,8],[-1,11],[0,16],[1,13],[3,18],[-1,8],[0,3],[-2,7],[0,3],[-1,4],[1,9],[1,7],[1,4],[8,6],[2,-7],[5,-23],[1,-3],[1,-2],[0,-4],[1,-3],[0,-3],[2,-5],[3,-16],[4,-8],[0,-2],[-1,-1],[-1,0],[2,-7],[5,-16],[1,-3],[1,1],[0,5],[2,-4],[1,2],[0,3],[0,4],[0,2],[2,1],[10,19],[-2,5],[-5,4],[-1,3],[-2,12],[-1,1],[2,8],[3,2],[2,16],[2,2],[3,9],[3,4],[12,3],[5,-8],[3,-11],[2,-16],[1,-2],[3,1],[1,-2],[1,0],[0,2],[0,5],[0,4],[0,3],[11,9],[2,-3],[0,-4],[2,-8],[0,-2],[10,0],[6,-8],[0,-3],[2,-8],[0,-2],[8,-7],[8,-6],[6,-29],[-2,-14],[-2,-6],[-12,-3],[-1,-3],[1,-7],[1,-2],[9,-1],[8,-1],[5,-9],[2,1],[2,-3],[0,1],[1,3],[1,1],[1,-1],[0,-1],[1,-5],[1,-2],[5,-3],[0,6],[-1,5],[0,10],[1,4],[2,6],[0,7],[1,16],[-1,8],[2,5],[2,0],[4,-7],[1,-3],[0,-2],[1,-13],[0,-2],[1,-3],[1,-1],[2,2],[13,-9],[4,-12],[-1,-8],[-1,-3],[0,-1],[1,-8],[11,-17],[3,-11],[13,-30],[0,-3],[2,-10],[1,-6],[2,-10],[0,-2],[5,-2],[1,-5],[1,-6],[1,-2],[3,-1],[7,6],[3,10],[7,5],[0,2],[-1,8],[-1,2],[-2,1],[0,2],[-1,5],[0,2],[-2,5],[-1,3],[-1,7],[-7,0],[1,1],[0,1],[1,0],[0,1],[-1,5],[4,5],[4,0],[8,-17],[7,-16],[2,0],[6,11],[-3,31],[0,1],[0,1],[-1,4],[0,1],[2,4],[5,-3],[8,11],[7,11],[4,-1],[3,2],[1,10],[-12,14],[-12,14],[-12,14],[0,2],[-1,4],[0,9],[1,6],[0,4],[1,3],[6,7],[-5,3],[0,4],[1,10],[2,16],[0,4],[1,5],[1,2],[8,-1],[9,-26],[9,-27],[2,-16],[0,-20],[2,-13],[1,-5],[1,2],[-2,15],[0,6],[1,2],[0,-2],[2,-9],[0,-1],[3,11],[3,4],[2,9],[1,1],[1,-1],[-1,10],[0,5],[0,4],[8,8],[3,-7],[11,-62],[2,-19],[1,-3],[1,0],[1,1],[8,-6],[2,6],[-1,1],[0,2],[-1,4],[6,1],[8,-16],[1,0],[1,6],[0,1],[0,2],[-1,1],[1,2],[0,2],[0,1],[1,0],[-4,10],[-1,2],[0,2],[0,2],[0,2],[-2,14],[-2,6],[-6,2],[0,1],[1,4],[1,0],[2,0],[-1,3],[-1,2],[-1,1],[0,1],[1,3],[0,1],[-2,12],[-1,8],[1,8],[1,2],[1,-3],[0,-3],[1,-3],[3,3],[4,-3],[1,1],[0,1],[0,3],[0,1],[1,0],[2,-4],[5,5],[-1,4],[-9,26],[-9,26],[-1,1],[-2,-1],[-3,3],[-4,10],[-2,9],[1,4],[11,-11],[11,-11],[0,-1],[0,-5],[1,-1],[0,-1],[5,7],[1,0],[-1,6],[-1,4],[-6,16],[1,4],[0,7],[-1,8],[0,3],[-6,-1],[-2,4],[-1,4],[-1,5],[-1,8],[1,9],[1,5],[1,0],[2,-4],[2,0],[6,10],[0,1],[1,5],[0,1],[2,0],[-2,9],[-2,5],[-8,5],[-8,4],[0,2],[0,2],[-2,12],[-3,11],[-1,1],[-2,0],[-1,3],[-1,9],[1,8],[1,2],[0,1],[-1,4],[-5,5],[-13,34],[-13,-3],[-13,-2],[-2,-5],[-3,-1],[-7,-14],[-11,9],[-11,8],[-11,9],[-1,5],[-1,6],[0,7],[1,7],[1,6],[1,8],[2,5],[2,2],[12,-2],[5,12],[9,12],[-3,7],[-1,6],[0,10],[1,9],[1,6],[5,10],[6,0],[10,-16],[9,-16],[10,-17],[0,-2],[-1,-1],[1,-5],[6,-14],[5,-5],[5,-16],[0,1],[1,6],[1,3],[1,1],[0,-4],[2,-12],[0,-5],[4,-12],[1,1],[2,4],[4,-2],[2,-9],[6,-8],[10,11],[0,8],[-3,19],[-1,8],[0,3],[-1,2],[-10,19],[-8,29],[-9,29],[1,9],[1,4],[2,4],[0,2],[0,4],[0,2],[2,7],[0,2],[0,5],[0,3],[3,17],[7,11],[10,-4],[11,-5],[-1,5],[1,4],[4,2],[4,12],[9,-1],[5,10],[2,0],[1,-3],[2,1],[0,1],[1,4],[-1,19],[0,5],[0,5],[1,2],[6,6],[-1,7],[-1,3],[-5,2],[-3,6],[-1,6],[1,4],[6,0],[10,13],[10,12],[10,-3],[10,-4],[0,1],[1,2],[0,2],[0,2],[1,1],[1,-2],[0,1],[1,1],[0,2],[0,4],[0,5],[-1,5],[-1,13],[2,5],[1,2],[10,-10],[3,-12],[3,-3],[1,-6],[4,-35],[1,-10],[1,-5],[0,-9],[0,-4],[2,-8],[1,-10],[1,-2],[2,0],[1,1],[0,3],[0,4],[1,1],[2,-4],[11,-4],[0,-1],[1,-9],[1,-2],[0,-1],[5,-2],[-4,22],[1,1],[2,-2],[-4,21],[-11,29],[-2,11],[-1,13],[1,9],[2,3],[8,-6],[2,-5],[1,-2],[8,17],[7,16],[2,8],[0,6],[0,6],[1,7],[1,5],[8,33],[1,2],[1,0],[1,1],[0,2],[2,3],[0,7],[0,7],[1,5],[1,3],[1,2],[6,0],[4,8],[5,-6],[10,4],[11,4],[10,4],[2,4],[1,8],[1,3],[1,0],[7,-9],[11,-31],[0,1],[1,3],[0,4],[1,3],[0,1],[3,-4],[8,-4],[7,-3],[0,6],[-1,4],[-1,5],[1,2],[2,1],[-1,5],[-7,12],[-7,12],[-3,8],[-1,2],[0,1],[1,4],[3,4],[0,2],[0,4],[0,6],[0,5],[-1,11],[0,7],[0,3],[1,3],[0,2],[0,9],[0,4],[0,8],[1,11],[1,4],[6,-3],[5,6],[1,8],[4,5],[3,0],[5,-7],[2,-8],[0,-1],[4,0],[0,1],[1,2],[0,2],[0,2],[1,5],[0,5],[-2,7],[2,13],[4,20],[2,6],[2,1],[12,-14],[11,-14],[1,-5],[0,-6],[-1,-6],[-1,-8],[-1,-7],[1,-6],[1,-6],[0,-3],[4,-7],[0,-3],[0,-6],[0,-6],[-1,-4],[2,-4],[3,5],[2,0],[2,-9],[1,-1],[4,0],[-1,-1],[0,-3],[0,-3],[0,-5],[0,-1],[2,-2],[8,16],[8,16],[3,-2],[11,24],[1,1],[1,-3],[0,-6],[1,-3],[2,-6],[1,-2],[14,21],[8,-6],[6,-21],[1,-1],[7,5],[8,5],[1,-4],[0,-1],[4,6],[1,-3],[1,-4],[0,-1],[11,-13],[10,-13],[10,13],[10,12],[0,1],[1,5],[0,1],[1,-2],[14,1],[1,3],[4,14],[1,3],[13,8],[0,1],[1,6],[0,1],[2,0],[1,-3],[1,1],[1,5],[0,1],[2,0],[3,-5],[7,4],[1,2],[2,6],[0,2],[4,-4],[5,5],[1,-2],[3,-8],[3,-5],[2,-8],[14,-6],[1,4],[1,1],[2,-2],[1,0],[3,8],[1,7],[1,1],[11,-2],[11,-1],[3,-6],[0,-1],[10,7],[1,-2],[1,0],[0,1],[1,3],[2,-1],[3,-12],[3,-21],[1,-1],[8,5],[8,5],[4,9],[3,0],[0,-7],[1,-4],[2,-3],[3,0],[5,10],[3,-3],[7,8],[1,-1],[3,-7],[3,7],[0,1],[6,-8],[2,4],[3,-7],[0,-1],[1,1],[0,1],[1,6],[0,2],[1,2],[0,1],[2,-3],[5,1],[0,1],[0,5],[1,1],[5,3],[-1,-3],[0,-2],[-1,-2],[1,-3],[2,0],[2,4],[1,7],[1,2],[1,0],[0,-2],[1,-8],[1,0],[3,2],[4,9],[7,9],[8,9],[3,-6],[4,-1],[10,13],[4,-5],[0,1],[1,3],[1,8],[0,2],[6,6],[2,-2],[2,3],[2,-2],[1,0],[5,13],[2,6],[0,8],[-1,4],[-14,2],[2,22],[3,12],[12,16],[12,15],[2,10],[1,7],[1,2],[1,-1],[0,-4],[2,-15],[0,-7],[-1,-9],[-2,-12],[1,-7],[1,0],[2,2],[1,-6],[-3,-13],[1,-14],[2,-2],[3,4],[2,-2],[3,-8],[4,-4],[6,4],[12,-8],[5,14],[2,2],[4,-3],[3,8],[1,-3],[3,3],[-1,6],[0,4],[0,6],[0,6],[0,4],[1,2],[0,2],[2,5],[2,2],[0,-4],[0,-4],[0,-4],[0,-5],[1,-6],[2,-16],[2,-7],[2,-3],[7,7],[5,-2],[6,12],[4,0],[1,3],[-1,3],[0,4],[0,5],[-1,5],[0,8],[1,4],[0,1],[1,0],[-1,2],[0,1],[-1,2],[0,2],[0,5],[-1,2],[-1,2],[0,4],[-3,23],[0,4],[0,13],[-1,11],[0,8],[0,7],[1,6],[-1,6],[3,16],[3,10],[-1,8],[4,11],[0,8],[2,4],[6,2],[2,4],[2,9],[4,6],[1,-1],[2,-8],[4,-8],[0,-11],[-1,-7],[-8,-31],[1,-6],[2,0],[8,18],[8,0],[1,-1],[0,-3],[4,-22],[0,-6],[0,-3],[0,-5],[0,-7],[0,-4],[-13,-21],[-1,-7],[0,-3],[4,-4],[1,2],[1,-1],[0,-6],[1,-1],[-3,-13],[0,-3],[-1,-4],[1,-13],[0,-3],[0,-1],[1,-2],[-1,-14],[2,-6],[2,1],[4,12],[8,10],[-1,-17],[-2,-10],[-7,-25],[-1,-9],[-1,-2],[-11,-14],[-2,-9],[-1,-2],[-5,-7],[-1,-5],[2,-5],[1,-2],[3,1],[5,11],[2,1],[1,-4],[1,-3],[0,-5],[0,-5],[0,-7],[-1,-3],[-2,-8],[0,-7],[-1,-19],[0,-9],[-1,-9],[-4,-8],[-3,-23],[-1,-6],[1,-7],[1,-4],[3,-5],[1,0],[3,10],[2,1],[1,3],[2,17],[1,4],[1,1],[2,-1],[4,6],[2,-1],[7,13],[7,13],[2,-1],[4,-8],[1,1],[0,2],[1,6],[0,5],[0,2],[2,2],[9,-5],[0,3],[1,5],[0,2],[2,2],[1,4],[1,2],[7,1],[7,1],[0,7],[0,7],[0,5],[1,2],[-1,6],[-3,-5],[-1,6],[-1,12],[-2,10],[-3,12],[0,6],[0,5],[0,6],[0,6],[0,6],[0,4],[2,6],[1,5],[9,-4],[2,5],[2,4],[0,5],[-4,2],[-6,11],[-1,4],[-1,7],[-3,25],[-1,11],[1,11],[0,2],[-1,1],[1,5],[0,1],[2,1],[4,16],[2,1],[4,-5],[1,2],[1,-1],[1,-2],[3,-3],[2,-8],[3,-6],[0,-2],[1,-5],[0,-1],[2,-2],[2,-4],[0,-5],[1,-6],[0,-4],[1,-1],[1,1],[1,2],[0,5],[1,17],[1,5],[3,-2],[3,-9],[5,-34],[-4,-8],[-1,-5],[0,-3],[1,-3],[1,-3],[0,-1],[4,4],[1,-1],[2,-13],[0,-3],[0,-1],[0,-4],[-1,-1],[1,-3],[0,-6],[0,-9],[0,-10],[-1,-7],[0,-4],[-2,1],[-1,-1],[-2,-15],[0,-4],[1,-5],[1,-4],[0,-4],[1,-6],[-1,-10],[0,-5],[-1,-5],[-5,-14],[-3,-3],[-2,1],[-1,0],[0,-3],[-1,-7],[-3,-25],[-3,-8],[-1,-9],[-1,-2],[-7,-11],[-1,-4],[-2,-14],[-4,-12],[-2,-7],[0,-9],[2,1],[1,-1],[-1,-6],[-3,-8],[2,-1],[2,2],[1,-2],[1,-6],[1,-5],[2,-3],[1,1],[2,10],[2,3],[9,1],[10,2],[1,-3],[1,-7],[1,-2],[4,-4],[5,6],[3,-4],[1,1],[1,2],[0,4],[3,19],[1,3],[1,0],[0,-2],[11,-9],[11,-8],[10,-9],[11,-9],[1,-3],[1,-6],[5,-14],[13,4],[1,-2],[1,-6],[1,-2],[2,0],[1,2],[0,2],[1,6],[0,1],[6,0],[3,-7],[3,-1],[1,-13],[2,-2],[2,2],[1,6],[1,11],[0,2],[10,11],[10,11],[1,2],[0,6],[1,2],[7,7],[7,7],[1,1],[0,3],[0,3],[0,1],[0,1],[0,2],[0,8],[1,4],[1,1],[6,1],[0,-2],[0,-1],[1,-3],[0,-4],[1,-2],[3,-6],[3,0],[6,12],[6,1],[5,-11],[3,0],[7,12],[7,11],[10,-7],[10,-8],[4,7],[3,-7],[5,2],[2,-2],[6,8],[2,8],[1,0],[3,-6],[2,-6],[1,-10],[0,-9],[0,-8],[-1,-6],[0,-7],[-1,-7],[0,-2],[0,-3],[-1,-8],[0,-4],[3,-14],[11,-8],[0,-8],[0,-6],[0,-5],[1,-1],[3,3],[2,0],[9,10],[2,9],[3,5],[3,0],[3,-3],[2,-8],[1,-1],[0,1],[2,6],[1,0],[1,4],[4,8],[11,9],[11,-12],[1,1],[1,5],[0,2],[5,-2],[4,4],[0,2],[1,7],[0,3],[1,2],[2,3],[2,8],[0,6],[-2,1],[-2,-4],[-5,1],[8,31],[-3,3],[-9,-17],[-1,1],[-3,8],[-10,12],[1,6],[0,6],[1,8],[0,16],[0,11],[0,4],[0,3],[-2,9],[-1,4],[-5,-11],[-1,0],[-3,8],[-4,0],[-6,-7],[-6,6],[-6,12],[0,2],[0,4],[0,5],[0,1],[5,5],[1,-1],[3,-6],[2,1],[2,4],[0,5],[1,9],[1,3],[2,9],[-1,9],[-1,4],[-3,5],[0,2],[1,7],[1,4],[0,3],[1,9],[-1,2],[-2,2],[1,7],[1,3],[4,8],[2,14],[1,0],[-1,4],[0,1],[-1,0],[0,-1],[-1,0],[-1,5],[0,1],[-2,-1],[-1,1],[0,2],[-2,8],[0,1],[-1,1],[-3,-6],[-2,3],[-2,-1],[-1,2],[0,1],[-1,-2],[0,-1],[-2,1],[-2,-1],[-9,-23],[-13,17],[-2,9],[2,7],[0,4],[1,6],[-1,1],[-1,3],[0,5],[0,8],[1,6],[0,5],[2,5],[1,7],[0,3],[0,5],[0,3],[0,1],[-2,-3],[-2,0],[1,4],[1,4],[0,4],[0,7],[0,9],[0,7],[-1,6],[-1,2],[0,8],[0,5],[-1,4],[-1,5],[-1,5],[0,8],[0,9],[-1,8],[-2,2],[-4,-3],[-3,2],[-4,14],[-5,-2],[-4,10],[-10,-2],[-3,6],[-1,6],[-1,15],[1,14],[2,13],[1,10],[-1,11],[-1,6],[-3,5],[-1,1],[0,2],[0,7],[0,6],[0,6],[0,4],[1,7],[2,1],[13,-9],[14,-9],[3,-9],[12,-1],[0,-1],[3,-9],[0,-1],[0,-3],[0,-5],[0,-5],[0,-3],[1,-3],[2,-5],[7,-2],[7,-2],[1,1],[0,2],[0,7],[1,2],[1,-2],[1,1],[0,5],[1,2],[0,1],[8,-1],[9,-1],[5,10],[3,-1],[0,2],[2,6],[1,2],[-1,5],[-2,9],[2,6],[8,-9],[11,4],[-1,9],[-1,4],[0,2],[-8,7],[-9,7],[-3,8],[1,8],[2,3],[3,1],[-6,13],[-1,0],[-1,-2],[-1,-4],[0,2],[-1,4],[1,11],[0,6],[0,5],[-1,4],[0,2],[-1,1],[-12,4],[-13,4],[-12,4],[-3,4],[-13,-7],[-5,11],[-10,-4],[-10,-5],[-8,8],[0,1],[0,3],[-1,2],[0,3],[-2,15],[-2,4],[-2,13],[0,3],[-3,2],[-1,2],[0,2],[-1,4],[0,6],[0,5],[1,5],[1,8],[0,3],[-1,3],[0,2],[0,2],[0,4],[0,4],[0,6],[-1,10],[-1,5],[0,8],[-1,18],[-1,8],[0,4],[2,26],[1,6],[8,16],[9,-5],[10,-5],[2,-5],[5,-6],[-1,-4],[-1,-4],[0,-5],[0,-7],[0,-4],[0,-3],[-1,-2],[0,-1],[1,-7],[-1,-5],[-2,-2],[-1,-3],[0,-3],[0,-3],[-1,-3],[0,-1],[-2,0],[-1,-1],[-1,-5],[0,-2],[-2,0],[-4,-12],[1,-2],[8,4],[8,5],[3,-3],[0,-18],[1,-6],[7,8],[8,7],[3,7],[7,3],[8,2],[3,-11],[8,-19],[1,-1],[2,3],[3,13],[1,1],[2,-2],[5,10],[5,-8],[13,0],[14,-1],[14,-1],[13,0],[-2,-23],[-1,-6],[-4,-20],[2,-7],[1,-3],[2,-1],[1,2],[5,20],[4,4],[1,0],[2,-8],[1,-1],[0,1],[1,0],[1,-2],[1,-9],[1,-2],[5,-2],[0,-3],[2,-9],[6,-13],[3,-3],[3,-8],[9,-6],[8,-5],[1,2],[0,4],[1,10],[0,3],[1,7],[2,3],[5,0],[3,7],[1,2],[2,-3],[0,1],[1,3],[0,2],[1,0],[6,-11],[12,2],[1,-3],[4,-22],[1,-4],[6,3],[5,12],[4,19],[1,2],[1,1],[1,0],[1,-3],[1,-1],[0,3],[0,3],[1,6],[0,2],[0,2],[1,1],[7,-3],[8,-3],[1,4],[2,3],[1,6],[2,4],[1,-2],[0,-3],[0,-3],[1,-4],[0,-2],[5,6],[8,-3],[8,-3],[1,-3],[0,-3],[0,-4],[0,-4],[2,-9],[1,-1],[5,3],[7,-9],[8,-10],[0,-1],[0,-2],[0,-6],[1,-2],[0,-1],[9,10],[3,10],[0,1],[2,-3],[1,1],[5,20],[2,10],[2,14],[1,3],[0,1],[3,-1],[3,5],[2,0],[2,-5],[2,0],[6,13],[2,-6],[5,5],[1,-1],[-1,7],[0,9],[0,9],[1,7],[4,19],[0,2],[1,4],[0,4],[0,3],[-1,3],[-1,3],[0,7],[1,19],[0,6],[-1,15],[-1,12],[-5,18],[-2,11],[2,3],[10,-9],[11,-8],[10,-9],[1,-7],[1,-10],[1,-7],[0,-8],[0,-7],[0,-6],[-2,-11],[-3,-8],[-2,-3],[-1,-3],[-1,-6],[0,-7],[0,-4],[1,-7],[0,-11],[-1,-6],[-8,-27],[1,-3],[2,-7],[2,-6],[0,-7],[2,-19],[1,-7],[1,-2],[1,1],[3,16],[1,2],[1,1],[1,0],[1,-1],[0,-2],[1,-7],[1,-1],[3,-3],[1,2],[2,8],[5,9],[4,-2],[1,2],[3,9],[1,-2],[0,-3],[0,-6],[-1,-4],[0,-2],[-1,-2],[1,-11],[1,-4],[4,-3],[1,-3],[1,-8],[-1,-14],[2,-5],[1,-4],[3,-2],[7,4],[2,8],[4,4],[1,3],[0,6],[1,12],[1,4],[0,2],[1,0],[1,-2],[0,-3],[1,-3],[1,1],[4,10],[2,16],[3,8],[3,3],[3,-3],[3,-8],[-2,-4],[-1,-3],[0,-6],[0,-5],[1,-3],[1,-5],[0,-2],[0,-4],[1,-8],[0,-5],[0,-3],[2,-3],[-1,-7],[0,-4],[0,-1],[1,0],[0,-2],[1,-4],[0,-2],[1,1],[1,4],[0,1],[1,-1],[3,-15],[2,-6],[2,-10],[1,-1],[1,-4],[3,-4],[2,-6],[10,-13],[8,4],[2,3],[2,-6],[1,1],[1,5],[1,1],[0,-1],[2,-5],[3,1],[0,-17],[0,-8],[-1,-2],[-1,-1],[-1,-3],[0,-5],[0,-4],[1,-2],[1,-3],[0,-1],[-1,-4],[0,-5],[0,-3],[1,-3],[0,-1],[3,6],[1,-1],[0,-2],[0,-5],[1,-1],[1,6],[1,2],[0,-1],[0,-2],[1,0],[0,4],[1,8],[1,6],[1,-1],[3,-6],[10,-2],[6,-11],[1,-9],[1,0],[1,1],[7,-20],[2,-11],[2,-7],[2,-3],[2,1],[2,5],[2,15],[1,3],[3,-3],[2,0],[13,33],[2,8],[1,13],[0,16],[1,5],[0,4],[0,8],[-2,5],[-2,6],[-1,5],[-1,7],[0,7],[-1,8],[1,8],[0,19],[0,8],[0,6],[-1,4],[1,18],[2,8],[3,3],[9,-8],[1,-4],[0,-4],[1,-7],[0,-3],[1,-3],[3,-3],[6,-27],[3,-3],[1,2],[1,5],[-1,1],[-3,12],[0,6],[0,4],[0,3],[0,4],[0,4],[-1,5],[-1,27],[-1,6],[0,5],[-2,5],[0,2],[-1,13],[0,2],[-2,4],[-1,5],[0,7],[0,6],[0,4],[0,4],[0,5],[1,3],[0,4],[0,2],[1,2],[3,7],[3,1],[10,-15],[10,-15],[1,-3],[1,-11],[10,-39],[2,-18],[2,-6],[3,-7],[1,-1],[1,-1],[1,-6],[2,-9],[1,-9],[0,-17],[0,-11],[-1,-7],[-1,-6],[-1,-8],[0,-4],[0,-3],[0,-2],[0,-2],[0,-14],[0,-6],[1,-3],[1,-1],[6,10],[1,7],[1,2],[8,0],[7,11],[3,0],[9,19],[1,0],[2,-2],[2,-10],[1,-2],[2,-2],[1,2],[1,5],[2,8],[1,2],[5,2],[1,-2],[2,-9],[2,-11],[0,-8],[0,-9],[-1,-6],[-6,-26],[0,-4],[-1,-7],[0,-3],[-7,-35],[1,-8],[2,-12],[2,-3],[1,3],[3,13],[4,14],[5,1],[1,-1],[1,-7],[0,-1],[6,-3],[1,1],[0,2],[1,7],[0,3],[1,1],[7,10],[0,2],[0,3],[1,2],[0,2],[3,-1],[3,6],[1,0],[2,-1],[1,0],[1,2],[4,25],[2,3],[1,2],[10,-8],[3,-9],[2,-6],[1,-9],[1,-7],[1,0],[3,6],[0,3],[2,8],[0,3],[1,2],[2,-1],[1,4],[1,-1],[4,-18],[2,-2],[3,5],[2,14],[2,3],[1,3],[0,5],[2,16],[1,2],[1,-4],[0,-6],[0,-6],[1,-4],[0,-2],[0,2],[2,16],[0,4],[1,6],[2,1],[2,-3],[3,3],[0,4],[2,22],[0,5],[1,4],[0,3],[1,2],[7,0],[5,-9],[3,3],[3,-3],[1,0],[1,5],[-2,6],[5,16],[7,6],[3,-2],[4,9],[5,-3],[4,2],[10,30],[5,3],[10,-6],[2,2],[3,-7],[0,-2],[1,1],[11,25],[8,7],[8,6],[11,26],[2,-3],[2,2],[3,6],[1,3],[1,5],[0,3],[2,1],[2,13],[7,15],[7,15],[1,3],[2,17],[2,5],[0,1],[1,-1],[1,-2],[0,-4],[1,-2],[1,1],[1,5],[0,2],[2,3],[0,4],[0,6],[0,8],[0,8],[0,1],[0,8],[1,2],[0,2],[1,5],[2,17],[3,15],[1,9],[0,2],[1,12],[-1,12],[1,6],[0,6],[0,7],[1,11],[1,2],[1,3],[0,2],[1,9],[2,7],[0,4],[0,14],[1,3],[0,3],[1,4],[0,6],[0,4],[0,4],[0,5],[0,3],[3,14],[0,5],[1,6],[1,9],[0,7],[-1,8],[0,7],[0,8],[0,13],[0,4],[-1,5],[0,2],[-1,2],[0,1],[-1,5],[0,5],[0,3],[0,3],[-1,3],[-2,1],[0,3],[-5,38],[0,1],[2,3],[-1,11],[-8,34],[-2,11],[0,16],[-1,11],[-1,12],[-2,14],[0,19],[1,8],[0,3],[1,6],[1,10],[1,5],[0,3],[0,5],[0,3],[1,2],[0,2],[0,5],[-1,3],[-2,2],[1,3],[2,3],[0,8],[-1,12],[-1,7],[1,7],[1,4],[1,3],[0,5],[0,6],[0,8],[0,7],[-3,13],[0,4],[-1,11],[0,5],[-1,5],[-1,4],[0,5],[-1,11],[0,5],[-1,7],[0,4],[0,4],[0,5],[1,5],[0,5],[0,11],[0,4],[0,5],[0,7],[0,4],[-3,25],[0,7],[-2,8],[0,3],[-1,19],[0,18],[-1,14],[-1,13],[-1,8],[0,1],[-1,0],[0,1],[0,5],[-1,2],[0,2],[-3,7],[-1,3],[-1,12],[0,5],[-1,4],[0,4],[-1,10],[0,5],[-1,3],[-2,4],[-1,3],[0,4],[-1,5],[0,7],[0,9],[1,8],[0,4],[0,6],[-1,6],[0,6],[1,6],[0,3],[1,2],[1,1],[0,4],[0,8],[0,25],[0,4],[1,15],[0,5],[0,6],[-1,5],[0,3],[-3,7],[0,4],[0,7],[-1,3],[-1,4],[0,5],[-1,11],[0,5],[-1,3],[-1,4],[-2,8],[0,3],[0,6],[-1,3],[-1,5],[0,6],[0,3],[5,7],[5,0],[3,-7],[1,-1],[0,1],[1,1],[0,3],[0,9],[0,5],[0,3],[-1,7],[0,6],[0,5],[1,2],[1,-1],[2,-10],[1,-1],[1,0],[0,-1],[0,-3],[1,-1],[2,2],[0,-13],[1,-3],[3,4],[1,-2],[8,-22],[1,-7],[1,-11],[0,-5],[1,-2],[1,1],[1,8],[1,4],[1,4],[0,4],[-1,5],[0,3],[-1,4],[0,5],[1,7],[0,1],[0,1],[1,3],[0,17],[0,7],[1,5],[0,3],[1,2],[5,-1],[4,10],[0,4],[0,6],[1,9],[-1,4],[-1,11],[-1,3],[0,5],[1,3],[2,4],[2,5],[0,1],[-1,12],[-1,0],[-2,-4],[-1,-1],[1,7],[1,5],[1,4],[0,2],[0,8],[-1,3],[-11,7],[-2,9],[-3,17],[-1,4],[0,4],[0,7],[1,3],[2,7],[9,2],[1,0],[0,1],[1,3],[1,9],[-1,5],[0,5],[0,5],[0,6],[-1,5],[0,15],[0,5],[-2,11],[-2,8],[0,11],[0,12],[1,4],[4,0],[0,2],[1,4],[0,12],[1,2],[1,0],[-1,6],[-1,5],[0,6],[0,4],[1,-1],[1,-3],[-1,6],[-4,4],[-2,-1],[-1,3],[0,5],[0,6],[1,4],[0,3],[1,1],[9,-12],[1,3],[0,3],[1,7],[0,2],[2,7],[-1,17],[-1,3],[-2,0],[-1,-3],[-1,-5],[-1,-4],[0,-2],[-2,2],[0,8],[-1,8],[-3,20],[-1,9],[-1,3],[-1,3],[0,3],[1,1],[1,-3],[1,2],[1,8],[-3,5],[0,3],[-1,4],[0,4],[0,2],[-1,3],[-1,4],[7,14],[4,3],[1,1],[0,3],[0,4],[0,8],[-1,14],[1,5],[0,2],[1,3],[1,8],[-1,-1],[-3,3],[-5,-3],[2,11],[0,2],[7,6],[1,-3],[-1,12],[-4,-3],[-2,4],[2,11],[3,19],[1,5],[2,1],[3,-7],[2,0],[-1,8],[0,3],[1,3],[0,5],[0,8],[0,5],[-1,2],[-1,-3],[0,-6],[-1,-3],[-3,5],[-2,9],[-1,2],[-1,1],[-3,8],[-14,-27],[-3,-1],[0,2],[1,8],[0,3],[1,2],[-1,6],[-1,2],[-1,1],[-1,-1],[4,43],[1,10],[-2,6],[0,6],[0,10],[1,8],[1,6],[1,11],[-1,2],[-2,-3],[-1,5],[0,4],[2,9],[1,9],[0,11],[0,4],[0,3],[0,2],[1,2],[0,-1],[1,-1],[0,-6],[1,-3],[2,-7],[1,2],[1,13],[0,5],[0,6],[0,11],[1,6],[0,-1],[1,-4],[0,-4],[1,-5],[0,-1],[1,2],[1,4],[-1,10],[-1,6],[0,6],[1,3],[0,1],[1,1],[1,0],[2,-6],[1,-6],[0,-9],[0,-3],[0,-16],[0,-5],[0,-5],[-1,-8],[0,-4],[0,-5],[1,-10],[0,-3],[0,-2],[1,-2],[-2,-12],[0,-4],[0,-8],[-1,-4],[0,-9],[1,-2],[2,0],[2,-9],[1,-1],[0,8],[0,3],[0,4],[0,2],[0,4],[1,6],[0,4],[0,5],[1,4],[0,2],[0,-2],[1,-9],[2,-6],[0,-2],[1,-11],[0,-3],[0,-14],[0,-4],[1,-2],[1,0],[1,3],[0,9],[0,32],[0,6],[-1,12],[0,5],[-1,7],[0,4],[2,10],[-1,3],[-1,10],[-1,1],[-1,0],[-1,2],[1,9],[0,6],[3,26],[0,1],[1,0],[0,5],[1,6],[0,7],[-1,5],[-3,12],[1,12],[0,11],[-1,10],[0,12],[0,10],[1,7],[6,15],[1,0],[5,-2],[0,-2],[0,-2],[1,-6],[0,-2],[0,-1],[1,-1],[0,-1],[1,-3],[0,-7],[1,-3],[0,-1],[1,0],[2,-4],[0,-2],[1,-5],[0,-2],[1,2],[0,3],[1,3],[0,2],[1,0],[0,3],[1,8],[-3,15],[0,2],[0,3],[1,0],[0,-1],[1,0],[0,4],[0,1],[-1,6],[0,3],[0,3],[1,6],[0,11],[1,11],[0,5],[0,5],[0,4],[2,4],[1,4],[-2,7],[-1,0],[0,6],[0,6],[0,4],[-1,4],[-1,0],[-2,-1],[-1,0],[-1,8],[2,8],[1,1],[1,1],[2,18],[1,5],[-1,7],[0,3],[-1,7],[2,9],[0,1],[0,6],[1,2],[0,-1],[1,-7],[0,-1],[1,1],[1,0],[1,-8],[1,-1],[2,0],[4,-8],[1,1],[2,6],[-5,29],[-1,5],[-1,4],[0,6],[0,7],[0,7],[0,3],[1,3],[1,2],[6,-2],[0,1],[1,5],[0,2],[2,4],[1,0],[2,-5],[0,-2],[0,-8],[1,-3],[0,-2],[1,-2],[0,-7],[1,-2],[0,-5],[1,-2],[3,2],[0,1],[1,8],[1,5],[0,4],[0,5],[0,5],[0,4],[-1,5],[-1,12],[0,2],[-1,0],[-1,1],[-1,5],[0,8],[0,9],[0,21],[1,5],[1,0],[1,-9],[5,-15],[0,1],[1,3],[0,11],[0,3],[-1,2],[0,3],[1,2],[1,6],[-3,20],[-1,9],[4,0],[2,-3],[1,-5],[0,-6],[1,-4],[1,2],[2,-5],[1,0],[-1,8],[-1,9],[-1,7],[0,3],[1,1],[-1,8],[-1,7],[0,4],[-1,1],[4,13],[2,0],[1,-14],[0,-5],[0,-2],[1,-1],[1,-7],[2,-3],[1,1],[0,5],[-1,5],[0,10],[1,5],[3,3],[-1,6],[-1,3],[0,8],[-2,-4],[0,2],[0,4],[0,2],[-3,-2],[-4,13],[-1,5],[1,2],[1,3],[1,5],[0,5],[0,5],[0,4],[-1,6],[-2,17],[0,3],[1,-1],[0,2],[0,8],[0,16],[0,9],[0,7],[2,-1],[1,5],[0,1],[0,4],[0,1],[0,1],[0,1],[0,3],[1,2],[0,1],[1,4],[0,6],[0,3],[0,3],[2,5],[0,1],[1,0],[1,-5],[1,0],[0,1],[1,-3],[0,-6],[0,-2],[1,-1],[1,-3],[1,0],[1,1],[1,-4],[1,0],[1,-1],[1,-5],[1,0],[1,6],[1,3],[0,1],[1,-3],[0,-9],[0,-7],[1,-3],[1,1],[2,-7],[0,-1],[1,3],[1,8],[1,3],[-1,13],[1,4],[0,1],[0,1],[-1,4],[0,1],[1,4],[0,2],[-1,2],[0,1],[-1,0],[-1,-3],[-1,3],[-1,6],[-2,15],[1,6],[3,5],[0,1],[0,3],[1,5],[0,1],[1,-2],[0,-4],[1,-1],[0,1],[0,1],[1,1],[0,-1],[1,-3],[1,-1],[0,3],[2,15],[1,4],[-1,4],[-1,3],[0,4],[1,7],[2,-4],[4,-28],[0,-1],[1,0],[0,3],[0,4],[1,2],[1,1],[1,0],[1,1],[-7,34],[0,5],[1,1],[1,0],[1,2],[1,7],[1,0],[-2,11],[0,5],[0,10],[0,2],[0,3],[0,1],[0,1],[1,-2],[1,1],[0,2],[0,3],[0,3],[-1,1],[1,5],[0,1],[1,0],[1,-2],[0,-2],[-1,-4],[0,-2],[2,-12],[0,-3],[0,8],[1,-1],[1,-1],[0,-2],[0,-3],[0,-3],[0,-1],[-1,-3],[0,-6],[-1,-7],[0,-9],[7,-12],[-1,5],[-1,6],[-1,5],[1,1],[1,0],[1,-3],[0,5],[0,5],[0,11],[2,-12],[0,1],[1,5],[0,2],[1,0],[0,1],[1,4],[0,4],[1,10],[-2,9],[1,4],[0,5],[1,4],[1,0],[0,-1],[1,-6],[1,4],[0,3],[-1,13],[0,6],[0,1],[1,6],[0,1],[1,-1],[0,-3],[0,-4],[1,-15],[0,-7],[1,-5],[0,-4],[0,-3],[1,-1],[0,-1],[0,-3],[0,-4],[0,-3],[0,-2],[1,-3],[1,2],[3,16],[-3,10],[-1,8],[0,10],[1,3],[2,-1],[1,-3],[1,-4],[0,5],[0,7],[0,8],[0,8],[-2,-7],[-1,2],[-1,12],[0,2],[1,6],[1,2],[0,1],[1,1],[0,4],[0,5],[0,3],[1,2],[1,-1],[1,4],[0,-6],[0,-3],[-2,-3],[1,-5],[1,1],[1,-1],[1,-8],[0,9],[1,4],[3,0],[2,3],[-1,1],[0,4],[0,5],[-1,8],[1,-1],[0,3],[0,4],[1,4],[0,1],[0,1],[2,-1],[1,1],[1,5],[0,10],[0,1],[-1,3],[0,6],[0,3],[1,1],[-1,19],[3,-4],[1,1],[-1,3],[0,3],[0,1],[0,1],[-1,1],[0,7],[0,2],[-3,10],[1,6],[1,3],[1,3],[1,-1],[0,-2],[1,-6],[0,-1],[1,1],[1,3],[0,-7],[0,2],[1,5],[0,9],[0,9],[5,8],[6,24],[2,-1],[1,2],[1,-1],[5,-14],[1,-1],[0,1],[0,2],[0,2],[0,2],[0,3],[0,3],[1,5],[0,3],[0,2],[0,3],[-1,2],[1,4],[0,3],[0,2],[0,1],[1,-1],[1,-2],[0,-1],[1,5],[-1,5],[0,4],[0,5],[1,6],[0,4],[0,1],[1,-1],[0,-3],[1,-6],[-1,-4],[0,-3],[0,-4],[0,-7],[0,-2],[2,0],[1,-5],[2,0],[1,-5],[1,-1],[0,1],[1,3],[0,1],[1,-3],[1,-8],[1,16],[-1,2],[0,2],[0,3],[0,4],[2,13],[0,2],[0,4],[0,4],[0,10],[0,3],[0,5],[1,4],[2,5],[0,1],[1,-1],[1,-2],[1,-7],[1,-3],[0,1],[2,15],[1,1],[1,-1],[1,1],[0,6],[0,7],[-1,15],[0,7],[1,6],[1,2],[9,15],[8,15],[3,-3],[1,1],[0,5],[0,10],[0,-1],[-1,1],[-1,2],[0,6],[1,5],[1,-1],[0,-4],[1,-4],[0,-2],[1,-2],[1,1],[0,2],[0,5],[1,1],[0,1],[1,1],[2,23],[0,3],[2,-1],[9,19],[2,9],[1,3],[2,1],[5,-9],[3,-14],[-1,-22],[1,-1],[0,-3],[0,-1],[0,-4],[0,-5],[-1,-9],[2,7],[1,-1],[0,-8],[0,-6],[-1,-5],[0,-2],[0,-4],[0,-1],[1,0],[0,-2],[0,-4],[0,-3],[1,-3],[0,-2],[2,-5],[1,-5],[1,-6],[0,-7],[0,-7],[-1,-8],[-1,-4],[0,-2],[-1,1],[-1,2],[-1,8],[-1,0],[-1,-7],[-2,-6],[-1,-1],[-1,4],[0,7],[-1,8],[1,6],[0,4],[1,3],[1,0],[-1,4],[0,4],[0,2],[-1,2],[1,1],[0,4],[0,2],[-1,2],[-1,7],[0,1],[-3,-3],[-1,3],[-2,7],[-1,3],[-1,-5],[1,-11],[0,-7],[0,-7],[2,-3],[-1,-7],[-2,-1],[-6,4],[-1,0],[0,-5],[0,-4],[-1,-2],[1,-4],[4,-2],[-1,-1],[-1,-6],[0,-2],[-1,0],[0,-1],[-1,-1],[0,-4],[0,-1],[-1,-2],[0,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-3],[0,-1],[0,-1],[0,-1],[0,-5],[-1,0],[0,-1],[0,1],[-2,4],[-1,-1],[-2,4],[0,-1],[-1,-3],[-1,-10],[0,-4],[-4,-13],[-1,-8],[-1,-18],[-1,-4],[-1,1],[0,-1],[-1,-6],[1,-1],[0,-2],[0,-1],[-1,-13],[-4,-12],[-1,-6],[-1,-11],[-1,-12],[0,-12],[1,-7],[0,-4],[-1,-5],[-1,-6],[0,-6],[-1,-13],[0,-3],[0,-3],[0,-3],[0,-2],[-2,0],[0,2],[-2,5],[-2,3],[-1,-1],[0,-2],[0,-5],[0,-1],[-1,-1],[0,-3],[0,-3],[0,-3],[0,-3],[9,-9],[1,-4],[0,-8],[-1,-5],[0,-2],[-2,0],[-1,-1],[-1,-6],[-1,0],[1,-8],[0,-6],[1,-4],[2,-2],[1,-5],[0,-9],[0,-14],[0,-9],[-1,-6],[-2,-3],[-1,2],[-1,5],[-1,6],[-1,6],[1,5],[0,6],[0,7],[-1,5],[-4,-10],[-1,-1],[-2,2],[-1,5],[-1,10],[-2,27],[-1,7],[-1,0],[-1,-2],[0,-3],[-1,-4],[-1,-14],[-1,-4],[-1,0],[1,-5],[0,-9],[1,-5],[0,-7],[-1,-12],[0,-6],[0,2],[1,1],[1,-1],[0,-4],[0,-6],[0,-6],[0,-5],[-1,-4],[-1,-2],[-1,2],[-3,7],[1,4],[0,5],[0,15],[0,21],[-1,3],[0,2],[-1,1],[-3,8],[-1,2],[-1,-4],[0,-10],[0,-4],[0,-5],[0,-4],[-1,-3],[0,-2],[-4,-11],[-1,0],[-1,-2],[0,-5],[0,-6],[0,-4],[-1,-2],[-2,11],[0,2],[-2,3],[1,-24],[1,-4],[0,-4],[0,-4],[0,-5],[0,-1],[-1,0],[-1,3],[-1,0],[0,-2],[0,-3],[-1,-4],[-4,-11],[0,-4],[-2,-8],[0,-9],[0,-7],[0,-11],[-3,-11],[-1,-6],[-4,-42],[-1,-8],[-1,0],[-2,4],[-1,-1],[-5,-18],[-1,1],[0,2],[-1,8],[0,2],[0,2],[-2,10],[-1,2],[-5,2],[-1,-2],[0,-6],[1,-28],[0,-4],[0,-2],[0,-1],[1,-6],[0,-2],[2,-2],[1,0],[0,-2],[1,-9],[-2,-4],[0,-10],[0,-9],[0,-5],[-1,-2],[-2,2],[-2,-2],[-1,1],[-3,17],[0,1],[-1,-3],[-1,-5],[-1,-5],[1,-7],[-1,-4],[-2,-11],[-1,-2],[-1,-2],[0,-9],[1,-4],[0,-2],[4,-8],[-1,-4],[0,-2],[-1,-1],[0,-3],[0,-8],[0,-8],[0,-4],[1,-5],[2,-3],[1,-3],[0,-4],[0,-9],[1,-3],[1,-3],[1,1],[2,5],[1,1],[1,-6],[-1,-5],[-1,-3],[-3,-3],[-1,1],[-1,4],[-3,-9],[0,-1],[-1,-1],[0,-3],[0,-7],[0,-3],[1,-2],[0,-3],[0,-6],[0,-8],[-1,-7],[-1,-5],[-1,-3],[-1,-2],[0,-2],[-1,-2],[0,-8],[-1,-2],[-1,-1],[-1,-3],[-1,-7],[0,-4],[1,-4],[0,-3],[0,-4],[0,-4],[-1,-15],[3,-2],[0,-3],[0,-3],[0,-11],[0,-4],[0,-5],[1,-4],[6,-35],[3,-7],[1,0],[2,4],[1,5],[0,2],[1,-4],[0,-9],[1,-2],[3,-7],[0,9],[-1,9],[-1,16],[0,11],[1,4],[1,0],[7,-22],[1,0],[-1,8],[0,8],[0,7],[1,7],[-1,6],[0,8],[-1,8],[1,4],[2,3],[1,-3],[1,-7],[2,-14],[0,-4],[1,-10],[0,-2],[0,-1],[1,-1],[1,1],[0,7],[0,30],[0,4],[1,0],[1,-1],[2,1],[8,-9],[1,-7],[-1,-13],[-1,-13],[-1,-6],[0,1],[-1,3],[-1,-8],[1,-9],[0,-8],[-1,-5],[0,2],[-2,9],[-1,5],[0,2],[0,8],[0,2],[0,1],[-2,2],[0,-3],[-1,-4],[0,-2],[0,-1],[-2,-2],[0,-3],[-1,-8],[1,-9],[1,-8],[3,-10],[-1,-4],[0,-8],[0,-2],[0,-6],[0,-4],[0,-4],[-2,-19],[-1,-6],[-1,-2],[-1,-1],[-1,2],[-1,5],[0,9],[0,8],[0,9],[0,11],[0,7],[-1,7],[-2,7],[-1,2],[-2,-2],[-1,2],[0,4],[-1,6],[-1,3],[0,-4],[-1,-9],[0,-13],[0,-13],[1,-10],[-1,3],[-2,9],[0,2],[-4,6],[-1,-1],[0,-3],[0,-6],[0,-8],[1,-9],[1,-7],[0,-5],[0,-5],[0,-4],[0,-4],[0,-4],[1,-9],[-1,-17],[0,-5],[-1,-5],[-1,-2],[-1,1],[0,4],[-1,7],[0,8],[-1,9],[-1,22],[0,2],[0,1],[0,1],[-1,10],[-1,3],[0,3],[0,10],[1,6],[0,5],[-1,3],[-4,-3],[-1,1],[-1,7],[-1,3],[-1,0],[-2,-4],[-2,1],[0,-1],[-2,-7],[0,-2],[-5,-5],[-1,-3],[-1,-8],[-1,-10],[0,-9],[2,-13],[2,-9],[2,-11],[1,-22],[-3,-5],[-2,-6],[-1,-11],[1,-13],[2,-4],[3,0],[-1,-11],[0,-5],[0,-8],[1,1],[1,2],[1,4],[0,-9],[0,-7],[-1,-4],[-1,-3],[0,-2],[-2,-2],[-1,0],[-1,1],[-3,19],[-1,5],[0,14],[0,3],[0,3],[-1,1],[0,2],[0,5],[0,10],[0,8],[-1,7],[-1,6],[-7,42],[0,6],[0,3],[-1,7],[0,3],[0,5],[0,4],[0,3],[0,4],[-1,3],[0,-1],[-2,-7],[0,-1],[0,1],[-1,2],[-2,0],[0,1],[0,1],[-1,5],[0,1],[0,1],[-1,0],[0,1],[-1,2],[-1,6],[0,2],[-1,-5],[-2,0],[-4,8],[1,-5],[1,-4],[-1,-5],[0,-4],[2,-3],[-1,-4],[-3,0],[-1,-3],[1,-6],[2,-3],[2,-1],[0,-1],[-1,-4],[0,-1],[3,-5],[1,-6],[1,-2],[0,-4],[0,-7],[-1,-1],[-8,4],[0,-10],[1,-5],[3,-3],[-3,-3],[-1,-2],[0,-4],[0,-6],[-1,-8],[3,-9],[0,-5],[0,-5],[0,-5],[1,-5],[-3,-3],[0,-2],[-1,-2],[-1,3],[-1,11],[-1,3],[0,-2],[-1,-6],[0,-7],[0,-8],[0,-2],[-1,0],[-1,-1],[0,-3],[0,-4],[1,-8],[0,-3],[3,-3],[2,-3],[2,-11],[3,-17],[0,-1],[-1,-4],[0,-2],[2,-18],[-1,-12],[-2,-7],[-6,-6],[-2,2],[-2,15],[-1,4],[-1,9],[-1,2],[-1,2],[0,-6],[-1,-11],[0,-9],[-2,5],[-2,-3],[-1,4],[0,7],[0,4],[0,3],[0,7],[0,26],[-2,-6],[0,1],[0,1],[0,-1],[-1,-11],[-1,-6],[-3,-9],[1,-7],[1,-13],[0,-7],[0,-4],[0,-14],[0,-2],[0,-2],[-1,0],[-1,2],[-1,5],[0,6],[-1,6],[-1,9],[-1,2],[-1,2],[1,-9],[1,-7],[0,-6],[0,-8],[-1,-6],[-1,-10],[0,-3],[1,-5],[1,-3],[0,-5],[0,-6],[1,-4],[0,-1],[1,1],[0,5],[1,1],[2,-2],[0,-7],[0,-4],[1,-6],[-2,-5],[-3,-2],[0,1],[-1,-9],[-1,-3],[-4,0],[2,-12],[6,-9],[1,-15],[-2,-7],[-2,-1],[-1,2],[-1,6],[0,3],[-1,0],[0,-2],[-1,-6],[0,-2],[0,-4],[0,-7],[-1,-1],[-1,4],[-1,8],[0,2],[-1,-3],[-1,-10],[0,-1],[0,-1],[-1,-2],[0,-6],[0,-2],[-1,-2],[-1,1],[-1,5],[-1,11],[0,5],[0,6],[0,5],[0,4],[-2,10],[0,-5],[1,-7],[0,-3],[0,-5],[0,-5],[-1,-3],[0,-2],[-1,-1],[-1,4],[-1,5],[0,6],[-1,-20],[1,-5],[1,-4],[1,-4],[0,-13],[0,-6],[0,-2],[-2,-3],[0,-2],[-1,-4],[0,-4],[0,-3],[1,-2],[0,-11],[1,-7],[3,-8],[0,-1],[0,-2],[0,-3],[0,-4],[0,-3],[1,-3],[2,-4],[-1,-4],[0,-9],[0,-2],[-5,-6],[-1,-3],[0,-9],[1,-19],[-1,-11],[-1,-5],[-1,-1],[-1,1],[0,-10],[3,-9],[2,-11],[1,-2],[1,0],[1,-2],[2,-9],[-1,-9],[-4,-11],[-2,0],[-1,-1],[0,-3],[-1,-7],[0,-3],[-1,-3],[-2,2],[-1,-2],[1,-12],[0,-5],[0,-7],[7,8],[0,-2],[0,-2],[1,-2],[3,7],[0,-1],[2,-10],[2,3],[3,17],[2,13],[1,3],[0,7],[0,3],[2,4],[0,-6],[-2,-16],[1,-4],[4,0],[0,2],[0,6],[0,2],[0,-2],[1,-3],[1,-8],[0,-2],[-1,-3],[1,-4],[0,-3],[-1,-7],[-6,-20],[-1,-2],[-1,2],[-1,5],[-1,0],[0,-2],[-2,-8],[-1,-6],[-1,1],[-1,-5],[0,-4],[-1,-3],[-1,-3],[-2,-4],[-1,-3],[0,-6],[1,-6],[0,-4],[1,-5],[1,-2],[6,8],[2,-1],[1,0],[0,-1],[3,-13],[-1,-6],[-2,-13],[-3,-8],[-1,-6],[0,-4],[-3,-3],[-1,-3],[1,-5],[0,-5],[0,-3],[0,-2],[2,-2],[0,-12],[0,-3],[2,1],[1,-1],[0,-2],[0,-3],[1,-3],[0,-1],[1,1],[7,-13],[1,0],[2,5],[1,1],[1,0],[0,-3],[0,-6],[0,-4],[2,-14],[0,-2],[1,-5],[1,0],[0,1],[1,2],[0,-1],[3,-6],[0,6],[-1,4],[-1,6],[2,0],[2,-14],[6,-17],[1,-1],[0,7],[-1,4],[-2,10],[-1,7],[1,0],[3,-3],[1,1],[-2,14],[-5,14],[-2,10],[1,3],[3,-5],[1,6],[-1,4],[-1,4],[-1,4],[0,7],[1,1],[2,-5],[0,9],[0,5],[2,5],[2,13],[1,2],[2,-1],[8,13],[8,12],[12,-2],[1,-4],[-1,-9],[-1,-12],[0,-4],[-1,0],[-1,2],[-4,15],[-1,3],[-2,1],[-1,-3],[-1,-6],[-3,-23],[-1,-3],[-6,0],[-1,-3],[-1,-5],[0,-3],[-1,-4],[-1,-9],[0,-7],[0,-4],[0,-3],[1,-3],[0,-3],[-1,-1],[-1,1],[1,-13],[12,-20],[3,-8],[2,-13],[-2,-7],[-4,14],[-3,1],[1,-8],[3,-15],[-1,-6],[-1,-1],[-1,-7],[2,-4],[-1,-4],[-5,-5],[-5,7],[0,-1],[-2,-5],[0,-3],[0,-5],[0,-5],[1,-4],[0,-1],[1,0],[5,-11],[9,-2],[0,-2],[0,-5],[0,-9],[-1,-8],[-2,-13],[1,-9],[1,-4],[3,3],[1,3],[0,4],[1,2],[1,-4],[0,-6],[2,-21],[0,-4],[0,-7],[0,-7],[0,-7],[1,-11],[1,-5],[1,-2],[4,11],[2,-2],[1,-5],[1,-7],[1,-11],[1,-16],[1,-8],[3,2],[1,-10],[1,-7],[-1,-15],[0,-8],[1,-9],[0,-8],[0,-9],[0,-9],[-1,-4],[0,-7],[0,-4],[-1,-4],[0,-3],[0,-4],[0,-8],[0,-3],[-1,-2],[-1,-7],[0,-3],[0,-4],[5,-16],[1,-3],[0,-7],[1,-4],[-1,-1],[0,-2],[0,-4],[-1,-3],[1,-5],[1,-1],[2,0],[1,-3],[2,-16],[2,-7],[1,-6],[0,-11],[1,-6],[2,-15],[0,-7],[0,-8],[-1,-6],[-3,-15],[0,1],[-1,9],[-1,3],[-1,2],[-2,1],[0,1],[-1,6],[0,2],[-1,1],[-1,-2],[-2,3],[0,-2],[0,-7],[0,-4],[2,-8],[-1,-5],[-2,-2],[-1,-3],[1,-4],[0,-3],[0,-2],[0,-2],[0,-5],[0,-13],[0,-5],[1,-3],[5,0],[1,-2],[0,-6],[1,-10],[0,-9],[-1,-8],[-1,-6],[1,-6],[2,2],[4,16],[11,0],[2,2],[1,0],[1,-3],[0,-5],[1,-15],[-2,-10],[-7,-9],[1,-5],[1,-6],[0,-7],[-1,-8],[-1,-4],[-4,-10],[-1,-1],[-4,7],[-3,-2],[0,-4],[0,-4],[0,-4],[0,-4],[2,-4],[1,-3],[0,-5],[0,-10],[0,-3],[-1,-5],[0,-4],[0,-5],[1,-6],[0,-6],[1,-1],[2,2],[3,0],[1,3],[1,3],[0,10],[1,3],[0,3],[1,2],[3,2],[7,-5],[1,-4],[0,-9],[0,-12],[-1,-10],[0,-10],[-1,-6],[-1,-3],[1,-6],[0,-2],[2,4],[1,0],[1,-2],[0,-8],[-1,-9],[0,-6],[1,-2],[2,-2],[3,-7],[1,-7],[1,-9],[0,-13],[-1,-5],[-7,6],[-1,-3],[0,-8],[2,-4],[2,-2],[3,-6],[1,-7],[1,-11],[-1,-10],[-2,0],[-7,18],[-2,2],[-1,-5],[1,-3],[0,-3],[1,-8],[0,-2],[1,-1],[5,-14],[-1,-1],[-2,-8],[-3,-8],[-2,0],[-4,6],[0,-20],[-1,-8],[-4,-1],[1,-18],[0,-4],[-1,-2],[-2,-8],[-2,-2],[-5,4],[0,-1],[-1,-5],[-1,0],[1,-7],[0,-4],[1,-1],[11,-2],[2,-5],[1,1],[7,33],[1,4],[0,2],[0,3],[0,2],[0,1],[2,9],[1,0],[1,-2],[0,-3],[0,-4],[1,-5],[1,-5],[2,-6],[1,-4],[-1,-1],[0,-2],[-1,-4],[1,-8],[0,-1],[2,2],[2,-1],[1,-5],[0,-5],[0,-3],[-1,-4],[0,-5],[1,-6],[1,-5],[-1,-7],[-1,-3],[-1,0],[-3,6],[-2,11],[0,2],[-1,7],[0,1],[-2,-3],[0,-4],[0,-8],[1,-3],[2,-12],[-2,-3],[1,-4],[0,-3],[1,-2],[-1,-4],[0,-2],[0,-6],[0,-1],[-7,-1],[-5,7],[-7,-5],[-2,-8],[-2,-2],[-7,-4],[-8,-3],[1,-14],[3,-9],[5,-8],[0,-6],[-1,-3],[-2,-5],[-3,-16],[1,-11],[1,-1],[4,8],[6,6],[5,15],[2,1],[6,-7],[2,-4],[2,-19],[3,-11],[1,-1],[0,5],[0,9],[-1,7],[0,7],[0,7],[2,5],[2,2],[3,-3],[2,3],[3,12],[2,4],[0,-4],[1,-11],[0,-12],[0,-10],[-1,-4],[-3,-5],[-2,-5],[-2,-3],[-2,2],[0,-1],[-2,-12],[2,-2],[3,3],[2,-1],[2,-5],[2,-9],[0,-4],[1,-4],[0,-6],[-1,-5],[0,-4],[1,-5],[-1,-4],[0,-2],[-1,0],[-1,5],[-2,1],[-1,-1],[-4,-13],[1,-5],[8,-2],[1,-3],[0,-8],[0,-7],[-1,-6],[-4,-6],[-9,3],[-9,16],[1,-7],[0,-5],[2,-5],[0,-3],[0,-2],[-1,-3],[0,-1],[-2,-4],[1,-9],[1,-4],[1,1],[1,3],[2,-1],[0,-10],[1,-28],[-1,-5],[-4,2],[0,-8],[4,-7],[1,-6],[0,-4],[0,-4],[0,-7],[0,-4],[1,-2],[1,-4],[1,1],[0,4],[1,5],[1,12],[0,6],[1,5],[4,1],[4,10],[3,1],[2,-2],[1,-9],[0,-13],[0,-12],[0,-12],[0,-12],[-1,-12],[-1,-10],[-1,-3],[-1,-5],[0,-4],[0,-3],[0,-1],[1,-1],[-1,-6],[-3,-26],[-1,-5],[1,-8],[1,3],[3,15],[1,4],[0,6],[1,4],[0,-1],[1,-4],[2,-8],[2,-11],[1,-2],[1,4],[1,4],[1,6],[0,7],[1,13],[2,23],[1,5],[0,2],[1,0],[1,-1],[1,-4],[0,-2],[0,-2],[0,-5],[1,-4],[0,-4],[0,-4],[1,-16],[-1,-11],[-2,-19],[0,-6],[-1,-8],[0,-8],[0,-8],[0,-6],[1,-7],[0,-7],[1,-3],[-2,-14],[-2,-7],[-5,-8],[-3,0],[-2,7],[0,25],[-1,5],[-3,10],[0,-4],[-1,-10],[-1,-37],[0,-13],[-1,-6],[0,-3],[-1,0],[-1,1],[-1,4],[0,7],[0,5],[0,5],[0,8],[-1,23],[-1,-2],[0,-7],[0,-9],[-1,-7],[0,-5],[0,-4],[-1,-3],[-3,1],[-1,4],[-1,6],[-2,16],[-1,9],[0,6],[0,6],[1,3],[-2,1],[-1,-2],[-1,0],[-1,3],[-1,13],[0,-2],[-3,-4],[-13,24],[0,-3],[-1,-3],[0,-2],[0,-1],[2,-15],[1,-3],[8,-23],[1,-11],[-1,5],[-3,8],[-5,7],[-2,-2],[6,-10],[2,-15],[3,-7],[1,-9],[1,-14],[-1,0],[-3,6],[-5,4],[-2,-3],[0,-8],[1,-4],[0,-3],[1,-1],[2,-2],[2,-8],[0,-4],[0,-6],[0,-7],[0,-6],[1,-6],[1,-3],[2,0],[1,2],[0,3],[1,10],[0,4],[1,2],[0,1],[1,0],[4,-6],[1,-5],[0,-5],[1,-3],[0,-1],[2,4],[0,1],[1,0],[9,-19],[-1,-14],[-2,-9],[-4,-9],[1,-2],[0,-5],[0,-2],[-4,-13],[5,-3],[1,4],[2,11],[1,1],[1,2],[1,-2],[1,-5],[-2,-9],[-1,-10],[-1,-25],[-1,-3],[0,-12],[0,-4],[-2,-15],[0,-4],[-1,-2],[-1,-1],[-5,2],[-3,11],[-1,2],[0,3],[0,4],[0,3],[-1,3],[-1,3],[-3,-6],[-3,3],[-1,-1],[-3,-7],[1,-8],[5,-14],[-2,-7],[-6,-13],[3,-4],[8,9],[1,-2],[1,-4],[1,-8],[0,-3],[8,1],[1,-4],[0,-10],[-1,-11],[-1,-9],[-3,-16],[-5,-13],[-2,-2],[0,4],[0,2],[0,3],[1,1],[-1,1],[-1,-3],[0,-1],[-1,3],[-1,4],[0,6],[1,7],[-2,-3],[-1,-2],[-2,-18],[-1,-3],[-1,-1],[-3,4],[-2,-1],[1,-4],[1,-3],[1,-4],[0,-7],[0,-1],[-1,-2],[1,-6],[0,-1],[6,10],[5,-10],[5,-1],[6,10],[6,19],[3,3],[2,-1],[1,-5],[0,-13],[-1,-11],[-3,-12],[-3,-6],[0,-2],[0,-5],[-1,-1],[0,-2],[-1,-5],[0,-1],[1,-2],[0,-2],[1,-4],[-2,-16],[-3,-8],[-13,-8],[-1,2],[-2,13],[-1,-2],[-12,14],[-2,11],[-5,9],[1,-18],[2,-12],[2,-9],[2,-15],[0,-2],[2,-2],[1,-3],[0,-4],[2,-12],[0,-8],[1,-2],[0,-2],[1,-2],[0,-3],[0,-5],[0,-2],[1,-1],[1,0],[0,-1],[0,-1],[1,-4],[-1,-19],[-1,-14],[-1,-11],[-7,-34],[-10,-15],[-1,0],[-2,7],[0,9],[0,8],[0,9],[0,9],[0,8],[0,10],[0,9],[0,7],[-1,3],[0,1],[-1,0],[-1,3],[0,5],[0,7],[1,5],[-1,8],[-1,0],[-2,-9],[-1,-1],[-1,1],[-7,18],[-1,-1],[0,-4],[-1,-1],[-1,2],[-1,-1],[0,-2],[0,-16],[4,-23],[1,-12],[1,-15],[0,-9],[0,-5],[-1,-2],[-2,-2],[-7,7],[-3,11],[-1,-1],[-1,-16],[0,-2],[0,-5],[-1,-2],[-11,-12],[-1,-6],[0,-3],[2,-1],[1,-1],[1,-7],[1,-1],[7,5],[8,5],[2,-3],[1,-4],[5,-32],[1,-9],[-8,-10],[-2,1],[-2,4],[-1,1],[-9,-11],[-10,-11],[-1,-4],[-1,0],[-1,-2],[-2,-13],[-1,-4],[-1,-3],[0,-6],[0,-3],[1,-1],[1,-2],[0,-5],[0,-5],[1,0],[3,9],[0,1],[3,-5],[10,9],[9,-5],[9,-4],[0,-12],[-2,-8],[-13,-32],[-12,-32],[-13,-32],[-13,-32],[-7,-1],[-1,-2],[-2,-13],[0,-3],[-11,-24],[-11,-24],[-2,-9],[-13,-11],[-13,-12],[-13,-12],[-13,-11],[-1,-2],[0,-4],[1,-6],[0,-2],[1,-8],[1,-2],[0,-1],[2,2],[-10,-11],[-11,-11],[-11,-10],[-10,-11],[0,1],[-1,3],[0,1],[-1,0],[-2,-3],[-3,-11],[-2,-3],[-2,-6],[-2,1],[-5,-11],[-1,-7],[-1,-2],[2,-6],[1,-2],[6,8],[2,-2],[1,-4],[-8,-10],[1,-8],[5,0],[-1,-4],[-3,0],[-2,-5],[-2,-6],[0,-8],[1,-9],[3,-3],[4,4],[-1,-3],[-3,-4],[-2,-5],[-1,-9],[3,4],[1,-1],[-1,-7],[-1,-2],[-9,5],[-7,-11],[2,-3],[4,1],[-1,-3],[0,-2],[-3,-1],[-2,-5],[-5,5],[0,-1],[-1,-4],[0,-1],[-5,4],[-10,-4],[-10,-4],[-10,13],[-10,12],[-4,-5],[-9,11],[0,-1],[0,-2],[-1,-5],[0,-2],[0,-2],[0,-1],[-1,-1],[-3,7],[-12,7],[-12,6],[0,-6],[1,-3],[3,-2],[1,-3],[0,-8],[-6,8],[-3,1],[-11,14],[-10,15],[-10,14],[-2,0],[0,-10],[-2,-3],[-8,15],[-1,0],[1,-7],[1,-2],[0,-7],[0,-5],[-1,-2],[-2,-6],[-3,2],[-2,6],[-5,20],[-2,5],[-5,-7],[-2,0],[-3,15],[-1,3],[-2,-2],[-1,-6],[0,-2],[0,-3],[0,-2],[0,-2],[-4,-4],[0,-10],[1,-8],[0,-7],[1,-8],[-1,2],[-5,22],[-5,15],[-5,-1],[-1,3],[-1,7],[-3,18],[1,-6],[1,-16],[-1,-4],[-2,0],[0,-8],[1,-5],[1,-11],[-2,6],[-1,5],[-1,6],[-1,9],[-2,22],[-1,-10],[1,-7],[2,-8],[3,-24],[-1,-3],[0,-3],[0,-9],[0,-3],[0,-2],[-1,-3],[1,-11],[10,-32],[4,-34],[1,-8],[3,-8],[1,-4],[1,-7],[-1,-7],[0,-1],[-3,6],[-1,0],[0,-1],[0,-2],[0,-3],[0,-3],[4,-16],[3,2],[1,-1],[6,-28],[5,-33],[1,-8],[5,-16],[5,-1],[1,-5],[-1,-5],[3,-17],[1,-3],[2,-4],[1,-4],[2,-14],[1,-5],[0,-3],[0,-4],[0,-4],[1,-2],[2,-3],[0,1],[2,16],[2,9],[1,6],[5,7],[13,-10],[13,-9],[13,-10],[14,-9],[13,-9],[-2,-9],[0,-6],[1,-6],[0,-7],[-1,-8],[-1,-6],[-6,-35],[-2,-10],[0,-6],[0,-3],[-1,-1],[-1,-1],[0,-5],[-1,-3],[-5,-21],[-1,-7],[-1,-2],[0,-1],[-1,-3],[2,-4],[-1,-5],[0,-1],[-1,-1],[0,3],[0,2],[0,2],[-1,0],[-2,-9],[-9,-18],[-9,-17],[2,-2],[5,7],[2,1],[-3,-9],[-12,-5],[-12,-5],[-2,-5],[-1,-1],[1,-1],[0,-5],[-1,-6],[0,-3],[-1,-1],[-1,2],[0,2],[0,3],[0,3],[-1,4],[0,3],[-1,5],[-2,8],[-13,14],[-14,15],[-14,14],[-13,15],[-14,14],[-2,-5],[-1,-1],[-13,12],[-12,12],[-13,11],[-1,0],[-3,-11],[-3,0],[-8,11],[-8,11],[-1,-1],[-6,6],[-4,16],[-6,9],[-5,19],[1,-7],[1,-5],[1,-7],[-1,-13],[-2,-9],[-11,-21],[-6,6],[-8,-3],[2,-7],[13,-21],[13,-21],[13,-21],[13,-21],[12,-21],[13,-21],[13,-21],[13,-21],[13,-21],[2,-9],[0,-19],[0,-3],[1,-4],[0,-3],[-1,-9],[0,-4],[1,-6],[0,-3],[0,-3],[-1,-3],[0,-3],[-9,-28],[-1,-6],[0,-2],[-1,-2],[-12,-6],[-12,-6],[-11,-7],[-12,-6],[-12,-6],[-12,-7],[-11,26],[-12,26],[-12,25],[-12,26],[-11,25],[-2,0],[-1,2],[-11,51],[-11,51],[-11,52],[-1,11],[-1,3],[-1,1],[0,-1],[-1,-2],[0,-2],[0,-5],[0,-5],[1,-8],[1,-4],[0,-22],[1,-8],[1,-7],[1,-4],[1,-2],[2,-1],[-1,-3],[0,-6],[0,-5],[0,-3],[6,-25],[2,-1],[1,-6],[1,-5],[1,-9],[5,-23],[0,-3],[0,-8],[0,-1],[2,-3],[-1,-6],[-2,-5],[-2,0],[-1,7],[0,1],[1,3],[0,1],[-1,10],[-1,8],[-1,6],[-2,3],[-2,-5],[-1,0],[-2,4],[1,5],[0,3],[1,2],[0,4],[-1,1],[-1,-1],[-6,9],[0,-3],[-1,-2],[0,-5],[0,-2],[0,-5],[0,-3],[0,-3],[0,-1],[0,-7],[-2,-2],[-2,1],[0,-8],[2,-19],[2,-20],[5,-24],[3,-22],[1,-7],[4,-19],[9,-30],[6,-5],[2,4],[2,-2],[0,-9],[-1,-5],[0,-7],[1,-5],[2,-3],[1,-4],[0,-1],[2,0],[9,-16],[9,-17],[1,-5],[0,-3],[1,-2],[1,-2],[5,-22],[1,-2],[-1,-5],[1,-7],[1,-3],[1,0],[1,7],[1,1],[5,-3],[-3,-11],[-2,-7],[-1,-15],[0,-9],[4,-41],[1,-8],[9,-18],[9,-18],[1,1],[0,3],[1,4],[1,6],[0,9],[-1,7],[-3,14],[0,5],[-1,6],[0,7],[1,24],[0,6],[1,11],[2,5],[13,-2],[14,-3],[13,-2],[14,-2],[13,-3],[14,-2],[13,-2],[14,-3],[6,-21],[3,-5],[1,-4],[1,-7],[0,-1],[2,-3],[1,-10],[0,-11],[1,-9],[1,0],[0,2],[1,-1],[0,-7],[-1,-9],[0,-7],[-2,-11],[0,-9],[-1,-20],[-1,-9],[-2,-12],[-3,-13],[-4,-25],[-6,-20],[-11,-13],[-11,-12],[-12,2],[-13,2],[-13,2],[-12,2],[-13,2],[1,-13],[12,-14],[12,-15],[12,-15],[2,-8],[0,-1],[11,10],[3,-5],[2,-5],[1,-1],[13,11],[13,11],[13,12],[1,-3],[0,-7],[-1,-8],[0,-7],[1,-10],[0,-6],[2,-10],[0,-5],[1,-12],[1,-4],[0,-1],[1,2],[0,5],[1,1],[2,-1],[0,-1],[0,-1],[-1,-7],[1,-4],[1,2],[1,0],[8,-32],[1,-3],[0,-8],[1,-2],[0,-2],[1,-3],[0,-7],[1,-2],[1,-2],[0,-11],[0,-7],[-1,-5],[-2,-5],[-4,-5],[0,-4],[-1,-5],[0,-9],[1,-8],[5,-14],[3,-1],[0,-2],[1,-3],[3,-7],[3,-1],[3,-9],[2,0],[-1,-7],[-2,-1],[-4,8],[-4,-10],[-11,-6],[-1,-7],[3,-1],[1,-1],[0,-3],[0,-6],[1,-2],[0,-2],[1,-3],[2,-2],[3,6],[4,-1],[2,7],[1,-1],[1,-6],[1,1],[2,-6],[0,1],[1,2],[1,1],[2,-11],[1,3],[2,8],[2,4],[1,0],[1,1],[3,12],[5,4],[4,8],[1,1],[2,-2],[1,-8],[2,-4],[2,2],[1,-1],[1,-4],[10,-14],[9,-14],[9,-13],[5,2],[0,10],[0,4],[-1,4],[1,26],[1,12],[1,9],[2,7],[1,2],[2,-2],[2,-5],[9,11],[9,11],[1,-1],[1,-4],[1,0],[7,17],[4,21],[2,0],[2,-7],[1,-1],[3,5],[11,-16],[1,-3],[1,-6],[0,-8],[0,-5],[-1,-9],[0,-5],[0,-6],[1,-4],[0,-5],[-1,-5],[0,-1],[2,-5],[4,-16],[1,-2],[3,1],[0,-7],[0,-6],[0,-5],[0,-5],[1,-4],[1,-2],[5,-3],[3,3],[7,-9],[7,-9],[2,2],[4,13],[8,8],[6,-5],[4,-9],[2,0],[2,-7],[3,-5],[-1,-4],[-5,-13],[-4,0],[1,-7],[13,-20],[13,-19],[13,-20],[12,-19],[13,-20],[13,-19],[12,-20],[7,0],[7,0],[2,-6],[1,-1],[12,-2],[12,-1],[12,-2],[12,-1],[12,-2],[4,-10],[2,-2],[0,-2],[0,-3],[1,-8],[0,-3],[1,-2],[1,0],[-1,-8],[-1,-5],[-1,-3],[-11,-2],[-11,-3],[-11,-3],[-2,6],[4,17],[-2,6],[-3,-3],[-7,-17],[-8,-2],[-1,3],[6,22],[-1,7],[-1,-2],[-5,-20],[-3,-7],[-7,-2],[-7,-2],[1,8],[5,13],[-2,5],[-1,1],[-5,-6],[-5,-19],[-9,-8],[-3,5],[-8,-3],[0,-1],[-1,-2],[0,-3],[1,-11],[0,-3],[0,-1],[0,-1],[2,-3],[10,-2],[10,-2],[-2,-6],[1,-2],[5,8],[2,-1],[1,2],[11,2],[11,1],[10,2],[-1,-8],[0,-9],[1,-2],[0,-1],[-1,-8],[-1,-3],[-13,-2],[-12,-1],[-12,-1],[-13,-1],[-12,-1],[-13,-20],[8,-4],[8,-3],[2,-6],[-1,-7],[-1,-3],[-2,-4],[-4,-18],[-1,-5],[-1,-19],[-1,-6],[-1,-9],[0,-7],[5,2],[-1,-6],[-1,-3],[-2,-1],[1,-4],[3,2],[-1,-6],[-5,-10],[2,-7],[7,3],[8,4],[3,10],[4,2],[0,-1],[0,-2],[1,-3],[0,-3],[0,-2],[0,-2],[1,-1],[0,-1],[0,-2],[0,-2],[0,-2],[0,-2],[-1,-5],[1,-4],[0,-2],[1,-2],[1,-2],[0,-2],[-1,-6],[1,-3],[0,-2],[9,9],[8,9],[-1,-5],[-1,-3],[1,-9],[2,-2],[8,18],[8,19],[7,-7],[7,-6],[2,3],[2,12],[-1,9],[1,4],[5,2],[0,-8],[0,-2],[8,4],[7,4],[11,-10],[13,14],[13,14],[12,15],[2,-2],[-1,-11],[8,9],[-3,-15],[-9,-22],[-8,-22],[-5,1],[-13,-20],[-6,-20],[-12,-10],[-11,-10],[1,-12],[1,-8],[7,-35],[-1,-10],[0,-2],[-1,-1],[1,-2],[1,2],[1,0],[0,-2],[1,-7],[9,-35],[0,-2],[0,-2],[0,-3],[0,-4],[0,-3],[4,-28],[-1,-9],[-2,-5],[-4,-1],[0,-6],[2,-1],[5,3],[1,3],[1,9],[1,1],[1,-1],[4,-22],[1,-2],[1,2],[0,3],[1,9],[0,4],[0,3],[5,12],[0,6],[1,14],[0,4],[1,2],[0,1],[1,-1],[0,-2],[1,-14],[1,-7],[1,-2],[1,5],[0,11],[1,4],[0,-1],[2,-13],[1,-10],[0,-10],[-1,-23],[-1,-16],[-2,-15],[-2,-11],[-2,-4],[-2,-1],[-4,-14],[-4,-20],[-6,-19],[0,-2],[1,1],[2,3],[5,4],[1,-2],[0,-6],[0,-6],[0,-4],[1,-1],[2,5],[4,6],[2,-2],[1,-10],[1,-1],[6,8],[-3,-12],[-3,-8],[5,-10],[1,1],[6,15],[2,1],[5,-14],[8,7],[8,7],[0,-2],[0,-7],[1,-2],[10,0],[11,38],[11,38],[11,39],[10,38],[6,33],[13,30],[12,30],[13,30],[0,3],[1,5],[8,28],[2,9],[0,1],[0,2],[0,6],[0,1],[0,2],[2,5],[0,-1],[1,-3],[0,-3],[1,-1],[3,9],[3,0],[2,-5],[2,-1],[0,-1],[0,-2],[0,-2],[0,-2],[1,-3],[5,-4],[1,3],[1,7],[-1,11],[1,4],[0,2],[0,5],[1,10],[0,4],[2,11],[1,1],[4,0],[0,2],[1,6],[0,3],[2,5],[7,5],[7,4],[2,4],[-1,3],[-2,0],[10,16],[-2,3],[-8,-1],[-1,3],[11,5],[3,-6],[14,14],[0,2],[1,2],[0,4],[1,1],[0,1],[8,-6],[8,-6],[13,16],[13,17],[13,17],[14,18],[5,-12],[12,7],[12,7],[13,7],[12,7],[12,7],[4,-9],[0,1],[1,5],[0,2],[0,1],[8,-10],[13,1],[2,-2],[1,-9],[-1,-2],[0,-3],[0,-2],[3,0],[-5,-12],[-4,-5],[0,-6],[1,-3],[1,-2],[1,0],[2,3],[1,0],[2,-8],[1,-1],[1,2],[1,4],[3,17],[1,3],[10,15],[11,14],[1,-3],[0,-9],[0,-4],[0,-6],[0,-5],[1,-5],[0,-4],[2,-7],[2,-16],[2,-4],[-1,-3],[0,-3],[0,-5],[0,-5],[2,6],[0,-1],[-2,-9],[-1,-6],[0,-7],[0,-6],[-1,-5],[-5,-28],[-11,-33],[1,-9],[5,-14],[0,-5],[0,-3],[-2,-3],[13,-17],[1,1],[0,4],[2,16],[4,14],[3,3],[4,-27],[1,-2],[14,25],[13,25],[7,22],[3,20],[2,4],[1,-1],[2,-5],[0,-4],[0,-4],[-1,-2],[0,-2],[0,-4],[0,-9],[0,-5],[-1,-4],[0,-4],[-2,-5],[2,-4],[2,3],[9,31],[9,31],[1,3],[0,7],[0,3],[2,10],[3,6],[0,3],[0,6],[-1,6],[0,3],[0,3],[-2,5],[1,6],[1,7],[0,6],[-1,9],[0,3],[0,5],[0,5],[1,9],[1,5],[1,2],[3,4],[1,2],[2,11],[3,4],[8,21],[7,22],[-1,4],[2,12],[0,2],[6,6],[2,3],[1,9],[-1,8],[0,2],[-1,1],[1,6],[1,14],[1,5],[0,2],[0,3],[0,3],[0,2],[1,1],[0,1],[1,0],[0,1],[0,2],[0,5],[1,3],[0,1],[1,3],[3,20],[13,39],[1,1],[1,11],[0,3],[5,8],[-1,-4],[-1,-2],[1,-5],[10,12],[4,-5],[8,16],[7,17],[1,8],[0,1],[4,8],[1,0],[1,0],[2,8],[9,16],[8,15],[3,0],[2,5],[-2,2],[0,4],[1,4],[0,1],[0,-1],[1,-3],[6,-14],[4,0],[11,-14],[11,-14],[-1,-4],[0,-1],[-1,-1],[6,-6],[2,-13],[1,-3],[3,-4],[1,0],[0,2],[2,8],[0,1],[4,1],[2,8],[2,15],[1,4],[6,-10],[0,11],[1,7],[3,5],[12,5],[0,3],[1,7],[0,2],[3,6],[1,10],[1,3],[1,1],[0,6],[0,3],[1,5],[7,15],[7,16],[-7,16],[3,11],[13,0],[14,0],[13,0],[13,0],[8,20],[-7,11],[-1,9],[1,0],[8,-12],[2,0],[4,-3],[12,18],[13,18],[10,-4],[11,-4],[11,-3],[10,-4],[3,-7],[2,0],[-1,10],[-2,4],[-4,0],[-10,25],[-10,26],[1,4],[12,1],[13,1],[12,2],[1,1],[0,4],[0,2],[1,0],[4,1],[-2,9],[-2,6],[1,10],[2,4],[13,2],[14,3],[14,3],[13,2],[14,3],[14,2],[13,3],[1,1],[2,8],[1,1],[13,2],[14,1],[13,1],[14,2],[1,2],[3,17],[1,3],[11,3],[11,3],[10,3],[3,7],[-1,1],[0,4],[0,1],[2,6],[5,-1],[2,4],[-12,10],[-11,10],[-11,10],[-1,3],[0,2],[-1,-1],[-2,-3],[-1,-1],[-5,4],[-3,-3],[-1,2],[-2,6],[1,5],[0,2],[0,3],[0,6],[0,5],[0,5],[1,4],[-13,-23],[-14,6],[-14,5],[-14,6],[-13,5],[-14,6],[-14,5],[-14,6],[-13,5],[-14,6],[-14,5],[-14,6],[-13,5],[0,9],[10,32],[11,32],[10,32],[-1,4],[-1,0],[-5,-16],[-1,-2],[-1,4],[0,3],[1,8],[-6,4],[-13,-8],[-1,4],[0,9],[3,11],[12,25],[2,11],[-1,6],[-6,-4],[0,4],[1,3],[0,2],[0,1],[-1,11],[-1,3],[-2,-1],[-4,-10],[-1,-1],[0,-6],[0,-2],[-1,-1],[-2,-3],[0,2],[0,5],[0,2],[-1,1],[-12,-11],[-12,-12],[-13,-11],[-12,-12],[-12,-11],[-13,12],[-13,12],[-13,12],[1,4],[0,2],[1,1],[-1,9],[-2,5],[-11,15],[-11,15],[-11,15],[-11,16],[-11,15],[-3,12],[-2,21],[0,8],[0,16],[-1,17],[0,7],[1,7],[0,7],[1,2],[0,6],[0,2],[2,29],[0,6],[1,5],[0,2],[0,6],[0,3],[6,43],[1,6],[0,3],[0,4],[0,3],[0,2],[3,9],[2,0],[0,1],[0,2],[0,7],[1,1],[1,-2],[4,-1],[1,1],[0,3],[0,3],[-1,7],[0,7],[0,6],[1,3],[0,2],[2,3],[1,2],[0,22],[0,7],[2,14],[1,11],[0,10],[2,6],[7,8],[11,-11],[2,3],[2,-3],[0,1],[1,2],[0,6],[0,2],[-5,10],[0,10],[-1,4],[-2,1],[1,6],[0,6],[-1,6],[0,3],[1,19],[1,4],[2,4],[1,3],[2,8],[1,10],[1,5],[0,2],[1,5],[0,4],[1,5],[1,6],[5,8],[2,4],[3,4],[3,10],[1,4],[3,22],[1,2],[1,0],[1,2],[0,4],[1,2],[1,0],[1,-1],[1,-1],[2,7],[1,3],[5,-1],[2,3],[4,22],[13,21],[10,-15],[6,7],[1,2],[0,6],[0,20],[1,5],[3,20],[1,6],[9,14],[10,14],[9,15],[1,-1],[0,2],[0,4],[1,5],[0,3],[0,2],[1,3],[1,4],[3,13],[1,3],[0,2],[1,8],[0,3],[4,11],[2,10],[14,20],[1,3],[2,9],[-1,1],[0,4],[0,2],[1,2],[0,6],[0,2],[1,1],[1,-1],[0,1],[2,5],[0,4],[1,6],[1,2],[5,5],[8,24],[10,14],[9,15],[10,14],[6,0],[7,19],[3,3],[7,-3],[3,7],[0,5],[1,1],[0,2],[0,5],[0,1],[0,4],[1,2],[5,-1],[1,2],[2,11],[3,5],[1,3],[2,12],[2,4],[3,4],[5,14],[11,13],[11,13],[12,13],[11,13],[3,8],[13,3],[13,3],[1,2],[1,5],[0,2],[1,0],[2,2],[7,-1],[3,6],[2,0],[1,2],[1,3],[1,11],[1,0],[4,-12],[0,1],[1,2],[0,7],[1,1],[6,-20],[1,7],[0,1],[5,-10],[2,1],[1,3],[2,9],[12,-14],[2,3],[3,8],[2,12],[2,4],[2,-1],[1,4],[1,6],[1,1],[1,-1],[1,-4],[1,-1],[0,3],[-2,12],[0,5],[0,7],[0,5],[6,11],[2,5],[1,3],[9,-13],[8,-13],[1,1],[2,5],[0,1],[2,-4],[6,-2],[0,1],[1,3],[0,1],[3,-6],[0,8],[0,8],[7,-7],[1,2],[1,9],[-3,12],[1,4],[9,-13],[1,-1],[1,6],[1,1],[1,-1],[2,-5],[1,0],[5,7],[-8,15],[0,3],[-1,10],[0,6],[-2,10],[0,4],[-1,2],[-2,4],[-1,7],[-1,2],[0,1],[-1,3],[-1,4],[1,7],[0,2],[2,-2],[0,1],[1,1],[0,2],[1,4],[0,4],[0,8],[0,3],[1,4],[2,-3],[1,4],[1,15],[0,17],[0,10],[1,1],[1,-2],[1,3],[1,4],[0,4],[2,5],[1,-3],[1,2],[0,5],[1,4],[1,3],[1,3],[-1,5],[0,7],[1,6],[1,4],[1,5],[1,4],[0,5],[1,3],[2,7],[2,2],[0,2],[1,5],[-1,3],[0,3],[0,5],[-1,6],[0,4],[0,1],[-1,1],[0,1],[0,2],[0,4],[-1,2],[0,5],[0,3],[0,7],[0,2],[1,-1],[3,6],[3,10],[1,0],[1,-2],[0,3],[0,11],[1,11],[1,2],[-1,5],[0,4],[0,4],[-1,2],[0,1],[1,5],[0,2],[-1,15],[1,11],[2,7],[2,4],[12,5],[12,5],[9,-12],[9,-12],[5,-18],[3,0],[1,3],[0,7],[0,1],[1,0],[10,13],[-2,7],[-1,7],[0,10],[0,3],[0,2],[0,3],[0,3],[0,9],[0,3],[1,2],[2,1],[0,2],[0,2],[0,2],[0,3],[1,2],[1,4],[0,1],[0,1],[0,2],[1,7],[0,2],[0,1],[2,-1],[1,1],[1,6],[0,2],[4,8],[1,5],[1,15],[1,4],[0,3],[3,5],[1,0],[1,3],[0,2],[0,3],[0,7],[0,3],[3,8],[1,7],[1,10],[-2,6],[-5,0],[-1,1],[-1,3],[0,6],[-1,8],[0,3],[-1,-2],[-1,-6],[-13,-25],[-12,-24],[-14,3],[0,2],[-2,10],[0,3],[-6,0],[-1,3],[-1,7],[1,3],[2,-7],[1,-1],[6,15],[8,6],[1,3],[1,7],[-1,8],[-2,5],[-11,14],[-1,-4],[-1,-1],[-3,3],[-1,6],[-1,4],[-1,6],[0,11],[0,11],[1,10],[0,8],[1,7],[-1,9],[1,6],[0,5],[3,19],[13,37],[0,5],[0,8],[0,9],[-1,8],[1,7],[2,15],[1,4],[6,13],[2,7],[1,1],[3,-5],[5,5],[0,2],[1,6],[0,2],[1,1],[5,-2],[3,3],[8,-14],[3,-13],[1,-13],[0,-2],[1,2],[1,10],[1,-5],[1,1],[0,5],[1,2],[1,1],[1,0],[2,-4],[1,-1],[1,3],[1,-2],[1,1],[1,5],[1,2],[-1,5],[-1,5],[-1,4],[1,8],[1,9],[0,7],[2,3],[-4,26],[-4,21],[-1,4],[-1,3],[0,4],[0,6],[0,4],[0,3],[-2,6],[-2,6],[-1,6],[1,4],[1,1],[4,-1],[5,-9],[3,-11],[3,-5],[4,-2],[1,-2],[1,-10],[2,-6],[1,-1],[1,5],[2,-1],[1,2],[1,7],[1,1],[2,1],[1,1],[1,4],[2,13],[1,3],[0,2],[1,1],[0,1],[1,6],[0,2],[1,1],[0,1],[0,2],[1,5],[0,4],[0,3],[0,2],[8,23],[1,0],[1,1],[2,8],[0,1],[1,0],[2,-3],[0,1],[2,7],[10,17],[10,16],[1,-1],[1,2],[2,8],[1,3],[0,4],[0,6],[1,12],[0,5],[-2,3],[0,5],[0,1],[0,3],[1,1],[0,3],[0,7],[0,1],[2,4],[0,2],[0,3],[0,4],[0,4],[0,2],[1,4],[0,5],[0,3],[-1,1],[-2,-5],[-1,2],[1,3],[3,8],[0,2],[0,3],[0,1],[-1,3],[1,4],[3,7],[1,4],[0,2],[2,5],[0,4],[-1,0],[-1,-1],[0,1],[0,4],[0,2],[2,5],[2,8],[0,2],[0,1],[0,2],[0,1],[0,2],[0,1],[1,11],[0,4],[0,5],[0,6],[0,4],[0,5],[0,6],[2,18],[-1,9],[-2,4],[-8,-2],[-8,-3],[-6,17],[-6,9],[-5,15],[-1,4],[-4,44],[-1,15],[0,18],[1,14],[1,9],[2,9],[4,2],[6,12],[2,0],[4,-5],[-1,-10],[-1,-8],[0,-9],[1,-12],[1,-6],[1,-3],[7,-2],[2,-5],[2,-10],[4,-28],[1,-4],[2,-5],[3,-3],[3,3],[2,6],[2,11],[0,9],[-1,7],[-2,18],[-1,6],[1,7],[0,9],[2,12],[1,10],[7,19],[7,20],[2,9],[1,12],[-1,11],[-2,8],[-3,8],[-4,3],[-2,4],[-1,10],[1,5],[1,5],[3,10],[6,6],[2,-2],[1,-9],[-1,-14],[0,-14],[1,-12],[2,-7],[1,-3],[11,-2],[10,-29],[1,-8],[1,-10],[1,-7],[0,-6],[0,-6],[-1,-5],[-1,-5],[-2,-12],[0,-3],[0,-5],[0,-4],[0,-4],[0,-3],[0,-4],[1,0],[1,2],[0,1],[2,-4],[2,3],[2,0],[0,-2],[2,-16],[-2,-20],[2,-7],[1,-5],[0,-6],[1,-18],[0,-6],[0,-4],[-1,-11],[0,-1],[1,-1],[1,2],[1,0],[2,-4],[3,-6],[1,0],[0,2],[1,5],[0,2],[0,3],[0,1],[0,3],[0,2],[1,4],[1,10],[0,3],[2,8],[1,7],[1,2],[1,-2],[1,-4],[0,-6],[0,-7],[0,-8],[7,-5],[1,1],[1,4],[1,3],[2,-4],[1,2],[0,7],[1,7],[0,6],[-1,4],[-3,7],[0,4],[-1,5],[0,6],[-1,8],[1,16],[0,6],[3,25],[2,4],[0,3],[0,8],[1,37],[-1,18],[0,12],[-3,17],[-3,12],[-2,8],[0,5],[-1,7],[-1,26],[-1,7],[2,10],[1,6],[10,14],[6,-3],[9,-22],[10,-23],[0,4],[1,26],[0,7],[4,26],[1,7],[2,4],[8,9],[10,-18],[0,-3],[3,-21],[0,-6],[0,-7],[0,-6],[-1,-5],[0,-3],[-1,-4],[-1,-21],[-1,-6],[0,-14],[0,-5],[-1,-3],[-8,-23],[0,-4],[-1,-9],[-1,-4],[1,-6],[1,-4],[0,-5],[-1,-6],[0,-4],[-4,-20],[-1,-5],[-1,-2],[3,-16],[1,-3],[0,1],[2,6],[5,-5],[2,7],[6,-4],[1,0],[1,4],[1,-3],[2,3],[3,-5],[1,0],[1,7],[1,1],[11,-4],[3,3],[3,-3],[6,7],[1,-1],[5,-15],[0,9],[1,1],[1,-6],[4,-3],[-1,8],[0,10],[0,6],[1,1],[2,-4],[3,-20],[1,-3],[0,-2],[0,-3],[1,-4],[-1,-3],[0,-4],[0,-4],[0,-7],[1,-1],[1,-3],[1,-2],[1,-9],[0,-4],[1,-2],[2,-3],[0,1],[-1,12],[0,6],[1,6],[0,4],[1,1],[1,-3],[1,-1],[0,2],[1,5],[0,34],[0,8],[1,4],[0,1],[1,-2],[1,-3],[1,-14],[1,-4],[4,-2],[0,9],[0,7],[0,6],[0,5],[1,3],[1,1],[1,1],[3,-6],[2,0],[1,9],[1,-10],[4,-28],[2,-4],[3,-3],[1,5],[1,0],[0,-4],[1,-13],[0,-7],[2,-9],[0,-3],[1,-1],[1,1],[1,5],[0,3],[1,11],[1,1],[1,-6],[1,-2],[0,-1],[1,1],[2,9],[1,2],[4,-9],[0,1],[1,3],[0,1],[2,-11],[1,0],[2,5],[0,3],[2,9],[0,2],[0,15],[0,6],[0,7],[1,10],[1,8],[2,4],[1,0],[5,-15],[1,-6],[3,-20],[0,-6],[0,-9],[0,-5],[-1,-3],[-1,-2],[1,-18],[-1,-14],[-1,-13],[-1,-14],[2,-3],[0,-3],[1,-5],[0,-2],[2,2],[1,0],[3,-10],[1,-3],[0,-5],[1,-9],[1,-10],[1,4],[7,45],[7,44],[0,6],[1,12],[1,6],[4,24],[2,5],[3,3],[1,2],[2,16],[1,4],[2,2],[1,2],[1,9],[0,2],[3,1],[3,12],[8,10],[7,10],[0,2],[0,5],[1,2],[1,1],[0,1],[1,6],[1,1],[1,2],[2,9],[4,5],[3,10],[5,4],[1,1],[0,5],[1,2],[7,12],[1,5],[0,1],[1,0],[0,-3],[1,0],[1,5],[1,1],[1,-1],[1,0],[1,3],[2,-1],[4,2],[3,-4],[3,8],[0,2],[1,2],[1,-2],[1,0],[1,3],[7,2],[1,3],[2,2],[2,7],[2,-1],[-1,6],[1,1],[1,-2],[1,0],[3,7],[2,3],[4,-3],[1,3],[1,4],[1,3],[0,2],[0,4],[1,1],[1,2],[0,6],[0,-1],[1,-3],[0,-1],[1,0],[1,2],[3,-1],[6,13],[2,0],[1,-2],[1,2],[0,3],[0,4],[0,4],[1,3],[0,2],[1,1],[4,-6],[0,1],[1,1],[0,1],[2,-3],[1,1],[2,6],[1,0],[4,-6],[0,3],[1,4],[1,4],[0,1],[1,-1],[1,1],[0,-2],[0,-2],[1,-3],[1,0],[4,8],[1,-1],[1,-4],[1,0],[1,5],[2,-3],[1,-3],[0,2],[-1,6],[1,1],[2,-7],[1,2],[1,2],[0,5],[0,1],[0,1],[1,0],[1,3],[1,-1],[0,-2],[1,0],[1,4],[0,1],[1,-1],[2,-7],[0,-1],[2,2],[1,-1],[1,-1],[0,2],[0,2],[1,2],[-1,9],[1,6],[0,2],[1,-4],[1,-5],[2,11],[1,1],[3,-8],[1,-5],[0,1],[0,2],[1,2],[0,2],[1,-2],[1,1],[0,3],[0,7],[0,-2],[2,-2],[1,1],[0,4],[1,1],[1,-4],[2,0],[1,-3],[1,2],[0,4],[0,5],[1,4],[0,-3],[1,-6],[0,-2],[0,10],[0,5],[-5,33],[0,6],[-1,7],[0,9],[-1,20],[0,11],[1,5],[1,5],[10,9],[2,-4],[0,-6],[1,-8],[0,-9],[-1,-22],[0,-4],[-1,-2],[-1,-2],[0,-3],[0,-8],[0,-11],[1,-10],[0,-7],[1,-6],[1,-2],[5,-1],[3,-7],[1,1],[1,6],[1,2],[1,0],[2,-5],[3,4],[3,8],[0,2],[1,6],[0,1],[2,0],[0,1],[1,4],[1,8],[0,10],[4,-7],[0,2],[1,3],[1,1],[2,-7],[1,6],[0,8],[0,9],[0,6],[-1,3],[-1,2],[-2,2],[-2,8],[-2,11],[1,10],[5,32],[1,5],[2,2],[3,-3],[3,-9],[0,-1],[0,-2],[0,-8],[1,-4],[0,-2],[2,-10],[1,-4],[0,-7],[1,-4],[1,-4],[1,-2],[0,-7],[0,-8],[0,-9],[0,-9],[1,2],[2,-3],[3,-15],[2,-18],[1,-3],[8,-24],[1,-4],[1,-1],[1,0],[1,-3],[1,-8],[2,-2],[2,-9],[1,-3],[2,-7],[0,-1],[3,-4],[4,-14],[3,-4],[1,1],[0,-1],[1,-9],[2,-8],[1,-2],[2,6],[1,1],[8,-13],[1,1],[4,-4],[1,1],[0,2],[1,8],[0,2],[0,2],[3,5],[0,1],[0,3],[1,9],[0,2],[1,2],[0,8],[0,16],[0,20],[1,5],[1,5],[0,10],[0,5],[1,3],[1,3],[1,2],[0,5],[1,6],[0,7],[1,8],[1,4],[5,2],[2,11],[1,2],[2,-2],[2,8],[1,1],[0,10],[2,6],[3,2],[1,2],[-1,6],[-1,15],[-1,3],[-13,13],[-1,7],[0,7],[0,5],[1,3],[1,2],[1,0],[5,-6],[7,9],[1,-2],[2,-8],[1,-5],[1,-20],[1,-6],[1,-7],[2,-20],[1,-9],[2,-4],[4,-2],[1,-3],[2,-8],[5,-8],[5,2],[2,-2],[0,1],[1,5],[0,1],[1,0],[1,-2],[0,2],[1,8],[0,3],[3,-4],[0,1],[0,2],[0,2],[0,1],[1,1],[0,-1],[1,-3],[1,0],[0,1],[1,3],[1,0],[0,-2],[1,0],[1,-1],[0,-1],[0,-3],[1,-1],[0,2],[1,0],[2,-7],[1,-2],[2,1],[0,1],[1,3],[0,5],[4,3],[3,-6],[11,-10],[2,2],[1,0],[2,-11],[1,-5],[2,1],[1,8],[0,10],[0,4],[0,3],[0,3],[0,4],[0,4],[0,4],[1,14],[1,6],[1,3],[5,6],[0,2],[0,7],[1,2],[3,-3],[6,8],[2,-2],[1,-7],[1,-3],[0,-4],[0,-4],[0,-5],[0,-7],[0,-4],[-1,-2],[0,-2],[0,-12],[0,-11],[0,-11],[0,-10],[-1,-8],[-1,-7],[-1,-6],[-1,-4],[1,-2],[10,5],[2,-9],[-1,-4],[1,-3],[0,1],[1,1],[4,0],[2,5],[1,0],[7,-5],[8,-5],[1,-6],[2,-2],[1,1],[5,-9],[7,1],[0,1],[0,3],[0,2],[1,5],[1,1],[2,0],[-5,44],[0,3],[0,2],[0,3],[-1,2],[0,2],[0,2],[-1,2],[2,1],[4,8],[2,7],[1,5],[4,2],[2,7],[1,6],[0,7],[1,6],[1,3],[2,1],[5,-11],[4,-15],[0,-2],[-1,0],[0,1],[-1,0],[0,-2],[-1,-6],[1,-5],[2,-18],[0,-9],[0,-5],[-1,-2],[0,-4],[0,-5],[-1,-2],[0,-2],[-1,-2],[0,-2],[-1,-12],[0,-4],[0,-3],[-3,-35],[-1,-4],[-2,-5],[0,-3],[0,-7],[0,-8],[0,-20],[1,-5],[0,-1],[1,1],[0,1],[1,-2],[0,-3],[1,-6],[0,-6],[1,-17],[1,-4],[4,-18],[8,-11],[2,2],[3,16],[1,0],[3,-7],[4,-2],[1,-3],[1,-1],[2,8],[1,1],[5,-6],[1,0],[2,7],[2,-1],[0,1],[1,4],[1,1],[2,1],[3,9],[2,1],[3,-6],[1,3],[4,17],[0,10],[-1,9],[0,10],[1,9],[0,8],[-1,4],[0,5],[0,6],[1,4],[1,3],[-1,6],[1,6],[2,24],[1,5],[0,3],[3,1],[0,4],[1,10],[0,1],[0,5],[0,1],[0,4],[1,7],[3,38],[0,5],[2,8],[1,3],[2,-3],[5,-23],[1,-5],[0,-3],[1,-3],[0,-2],[0,-3],[4,-12],[2,-17],[2,-7],[3,-7],[1,-4],[1,-9],[1,-3],[1,-5],[0,-8],[-1,-7],[-1,-4],[-1,-5],[-9,-5],[-9,-5],[0,-5],[5,-10],[6,-1],[2,-3],[1,1],[1,-1],[-1,-22],[0,-1],[1,0],[1,-2],[1,1],[0,3],[1,1],[0,-1],[2,-7],[1,2],[4,1],[1,-3],[2,-9],[0,-1],[2,-2],[0,-1],[1,-4],[1,1],[5,4],[3,-3],[1,4],[3,22],[0,9],[0,9],[1,2],[0,1],[1,0],[0,1],[1,3],[0,4],[0,3],[1,7],[0,8],[0,7],[-1,4],[1,2],[1,1],[1,5],[1,9],[0,10],[1,23],[1,8],[10,-2],[2,-5],[3,-12],[3,-25],[1,-4],[0,-6],[0,-7],[0,-5],[1,-6],[-3,-20],[-1,-2],[-1,-1],[-1,2],[1,-14],[1,-7],[4,-19],[1,-5],[1,-9],[1,-3],[11,-34],[8,-12],[5,0],[2,-4],[2,0],[0,1],[-1,4],[0,1],[1,1],[1,-2],[0,-3],[1,-4],[0,-1],[1,1],[0,3],[1,0],[0,-1],[1,-3],[1,-2],[1,0],[2,-9],[2,-3],[3,0],[2,3],[2,6],[1,3],[3,-8],[2,0],[1,4],[1,-1],[3,5],[0,3],[1,11],[1,2],[2,0],[1,-1],[0,3],[1,3],[0,1],[1,0],[1,4],[0,2],[1,-1],[1,-4],[8,-17],[1,2],[0,5],[0,6],[0,5],[0,4],[0,5],[-1,1],[-1,0],[-1,1],[0,2],[-1,4],[0,5],[0,6],[1,3],[1,2],[2,-2],[0,1],[1,6],[0,-5],[1,2],[0,4],[1,4],[1,0],[1,0],[2,6],[0,1],[1,2],[0,8],[1,4],[0,2],[11,5],[1,2],[1,3],[0,2],[2,-3],[1,0],[1,4],[0,5],[1,4],[1,0],[4,-6],[0,2],[1,4],[2,6],[1,9],[1,3],[2,5],[2,5],[1,0],[6,8],[0,1],[0,2],[1,7],[0,2],[2,2],[0,2],[1,8],[0,3],[1,3],[2,7],[1,0],[1,2],[0,6],[0,2],[2,7],[0,2],[0,4],[1,1],[4,6],[4,3],[0,1],[0,2],[1,6],[0,3],[0,2],[1,2],[0,2],[9,9],[0,1],[1,3],[0,1],[0,-1],[0,-4],[1,-1],[2,4],[2,-1],[2,4],[5,2],[2,-5],[1,1],[6,20],[1,0],[1,-4],[1,-2],[6,-2],[4,5],[2,6],[3,2],[7,18],[4,4],[2,6],[6,10],[1,7],[1,3],[0,2],[6,0],[2,4],[1,6],[1,2],[1,1],[0,5],[1,6],[0,6],[1,3],[1,3],[0,5],[1,9],[-1,7],[0,5],[-1,1],[0,3],[1,8],[0,3],[0,2],[0,8],[0,4],[0,1],[0,3],[0,4],[1,0],[0,3],[0,5],[1,6],[0,3],[1,5],[0,3],[0,5],[1,4],[0,5],[0,7],[0,2],[0,2],[0,4],[0,3],[0,2],[0,2],[0,3],[0,18],[0,5],[0,2],[0,7],[-1,3],[1,2],[0,2],[0,2],[-1,22],[0,9],[-1,5],[-4,18],[-1,10],[-1,6],[-5,43],[0,3],[0,5],[-1,3],[0,1],[1,9],[0,2],[0,5],[0,15],[-1,10],[0,10],[0,10],[2,16],[0,1],[1,0],[0,3],[7,31],[10,28],[14,-2],[14,-1],[2,-3],[2,-13],[1,-23],[-1,-4],[-8,-16],[0,-3],[0,-9],[0,-1],[-1,1],[0,-4],[-1,-10],[-1,-6],[-4,-21],[-6,-15],[1,-3],[4,3],[0,-2],[0,-8],[1,-3],[1,-7],[2,-4],[12,-3],[1,2],[1,13],[1,2],[3,5],[1,-1],[1,-4],[-1,-3],[1,-7],[0,-1],[2,1],[1,-2],[0,-3],[2,-5],[1,-3],[1,-8],[1,-6],[2,-13],[3,-10],[2,-12],[0,-6],[-1,-4],[0,-6],[0,-10],[0,-10],[0,-9],[-1,-7],[0,-4],[0,-12],[0,-4],[1,-3],[2,-7],[-1,-15],[-1,-5],[-1,-4],[-1,-8],[0,-14],[1,-9],[3,-13],[1,0],[1,1],[1,1],[1,5],[2,1],[1,4],[2,1],[4,11],[6,0],[2,4],[2,5],[1,1],[0,-3],[1,-19],[1,-1],[1,5],[5,11],[-1,13],[1,4],[1,0],[2,-5],[6,-3],[1,-2],[0,-2],[0,-3],[0,-3],[0,-3],[1,-9],[0,-3],[4,-16],[1,-13],[1,-3],[-1,-5],[0,-8],[1,-9],[0,-6],[1,-2],[1,3],[0,4],[1,1],[1,0],[2,7],[1,4],[0,5],[-1,6],[0,6],[2,18],[6,-9],[3,8],[-2,5],[0,4],[-1,5],[1,2],[7,1],[0,-2],[0,-4],[0,-1],[0,-1],[0,-3],[0,-1],[0,-2],[0,-2],[0,-1],[-1,1],[1,-10],[2,-1],[5,15],[1,-1],[4,-13],[1,-3],[0,-5],[0,-5],[-1,-2],[-3,-6],[-2,-10],[0,-5],[1,-1],[1,-2],[1,-3],[2,-15],[1,-6],[0,-2],[0,-6],[0,-4],[0,-2],[-1,-10],[0,-3],[1,-2],[1,-2],[1,2],[1,2],[1,1],[1,-2],[0,-4],[1,-5],[2,-19],[1,-4],[3,-10],[1,-5],[0,-8],[2,0],[4,-6],[2,2],[1,4],[1,2],[0,3],[0,6],[0,3],[-4,13],[-3,18],[-1,9],[0,14],[8,28],[2,0],[1,4],[0,11],[1,-1],[0,1],[0,1],[1,2],[-2,1],[-1,2],[0,5],[-1,6],[1,16],[0,12],[2,7],[7,7],[2,6],[0,14],[1,10],[1,-4],[0,-9],[1,-5],[1,-2],[0,3],[-1,8],[0,7],[1,1],[2,-4],[0,6],[0,3],[-1,1],[0,-2],[0,1],[-1,4],[0,6],[0,5],[2,6],[1,-1],[-2,13],[1,0],[0,1],[1,3],[0,5],[0,14],[1,3],[0,6],[0,3],[0,6],[0,3],[-3,15],[-1,3],[1,5],[0,3],[2,1],[0,11],[0,6],[-2,11],[2,5],[-2,25],[-1,14],[0,16],[1,9],[0,6],[2,17],[0,7],[1,17],[0,7],[1,2],[1,2],[10,7],[3,9],[1,4],[1,10],[1,3],[1,2],[5,-3],[0,-1],[1,-5],[0,-2],[1,1],[0,3],[0,2],[3,8],[3,20],[1,6],[0,4],[0,9],[0,1],[1,1],[0,1],[0,1],[1,4],[0,2],[1,1],[2,1],[1,2],[1,6],[2,7],[3,3],[1,5],[1,7],[13,22],[3,-1],[2,8],[3,3],[7,-1],[0,10],[0,5],[0,3],[0,3],[1,11],[-1,2],[0,5],[0,7],[1,7],[0,3],[0,2],[1,1],[0,2],[1,8],[0,2],[0,2],[6,10],[-1,13],[1,-2],[4,4],[3,9],[8,10],[1,-2],[2,-6],[7,4],[1,3],[2,9],[0,2],[2,2],[0,3],[1,3],[0,4],[1,1],[4,-4],[9,7],[1,-1],[2,-14],[1,-2],[1,1],[1,8],[0,2],[3,0],[1,4],[-2,11],[-4,24],[1,17],[2,9],[7,18],[1,0],[2,-4],[1,-1],[1,2],[1,6],[1,3],[3,-1],[0,2],[1,5],[1,0],[1,-4],[1,-2],[1,-2],[1,-3],[1,-5],[-1,-7],[0,-5],[-1,-4],[0,-2],[1,-7],[1,-2],[2,2],[1,5],[0,8],[1,6],[1,1],[-1,13],[0,4],[2,15],[1,2],[10,2],[1,-4],[1,-14],[1,-3],[1,-10],[1,-1],[1,6],[-1,11],[0,6],[0,7],[0,9],[0,4],[1,2],[4,-2],[1,3],[0,7],[0,4],[-7,3],[-1,3],[-1,2],[0,2],[0,9],[0,3],[0,3],[1,10],[-2,9],[0,11],[0,6],[0,9],[1,8],[0,5],[3,13],[1,4],[1,3],[3,0],[3,-4],[0,-1],[2,5],[2,-1],[1,3],[1,1],[1,0],[0,-2],[1,-6],[0,-8],[0,-7],[1,-4],[1,-2],[7,-6],[4,-14],[-3,-8],[0,-2],[-1,-7],[-1,-2],[0,-1],[-1,2],[-8,-15],[1,-2],[0,-3],[0,-6],[0,-2],[0,-2],[-1,-4],[0,-6],[1,1],[4,12],[3,-1],[3,-7],[-1,-6],[-1,-5],[-1,-4],[0,-1],[-1,1],[-1,-2],[-1,-4],[0,-10],[2,0],[-2,-7],[0,-2],[-1,0],[1,-7],[1,0],[1,4],[1,7],[1,6],[0,1],[11,-3],[-1,-11],[-1,-6],[-8,-11],[1,-6],[1,-4],[3,-7],[1,0],[1,3],[0,2],[0,2],[0,2],[3,7],[6,31],[1,2],[6,-1],[1,-2],[4,-21],[2,-3],[2,-1],[0,-5],[0,-2],[-1,-1],[0,-1],[-7,-44],[1,-7],[1,-8],[0,-2],[-1,-4],[0,-1],[1,-3],[0,-15],[1,-5],[0,-2],[3,1],[1,4],[0,5],[1,6],[2,13],[2,10],[1,11],[1,13],[1,30],[1,8],[0,8],[0,8],[-1,5],[-1,7],[-1,3],[0,6],[-1,6],[0,4],[0,10],[0,15],[-1,7],[1,7],[1,5],[0,3],[11,19],[1,6],[1,2],[1,0],[1,-2],[1,3],[0,4],[0,3],[0,3],[0,5],[1,4],[0,2],[1,3],[2,3],[0,3],[-1,11],[0,3],[0,6],[1,0],[1,-1],[1,0],[-2,14],[-2,3],[-5,-7],[1,8],[-1,5],[-1,2],[-9,-24],[-2,1],[-2,3],[-2,6],[-1,1],[-1,2],[-1,8],[-1,6],[0,7],[-1,9],[0,10],[0,10],[1,7],[6,26],[13,18],[2,6],[1,10],[1,7],[2,-4],[0,-4],[2,-14],[0,-7],[0,-12],[0,-6],[-3,-5],[-2,-10],[1,0],[1,0],[0,-3],[1,-9],[0,-2],[1,-2],[5,8],[9,-1],[0,-4],[1,-5],[1,-8],[0,-10],[0,-9],[-1,-11],[-1,-15],[-1,-3],[-3,-20],[1,-4],[1,1],[1,4],[0,7],[1,4],[3,2],[0,4],[1,3],[0,10],[1,4],[0,3],[1,2],[1,0],[1,2],[0,9],[1,3],[0,1],[1,0],[1,-2],[3,-14],[2,-3],[2,-8],[4,-7],[0,-2],[1,-5],[0,-2],[1,0],[1,1],[0,6],[-2,5],[-1,7],[1,3],[1,0],[2,-2],[0,-2],[2,-7],[0,-2],[2,0],[-2,13],[1,4],[1,1],[2,-2],[0,4],[0,4],[-1,4],[1,6],[-1,-2],[-1,2],[-1,6],[-5,5],[-1,6],[0,1],[-1,1],[-1,1],[0,1],[-3,-5],[0,3],[1,3],[0,5],[0,5],[0,5],[0,2],[1,2],[-2,5],[-1,6],[1,7],[1,13],[0,4],[1,1],[0,2],[1,8],[0,3],[5,10],[1,4],[1,12],[-1,6],[-1,-4],[-1,2],[-1,1],[-2,-1],[0,-2],[-2,-6],[-1,-2],[-1,5],[0,1],[-3,-1],[-2,2],[-1,9],[-1,20],[0,8],[0,17],[0,8],[0,6],[0,4],[0,8],[1,4],[0,11],[0,5],[2,28],[3,19],[3,11],[7,8],[7,8],[2,5],[1,7],[1,2],[1,1],[3,-5],[1,2],[0,6],[1,7],[0,7],[2,14],[4,9],[4,20],[13,21],[9,2],[8,2],[12,21],[4,0],[9,19],[2,0],[4,-14],[2,-1],[6,4],[13,-9],[13,-9],[12,-33],[4,-27],[1,-3],[0,-1],[2,1],[0,-1],[0,-10],[0,-11],[2,-10],[0,-5],[3,-8],[0,-3],[2,-15],[0,-3],[1,-2],[1,-1],[0,1],[1,-1],[0,-4],[0,-6],[1,-7],[0,-4],[2,-6],[0,-4],[1,-14],[1,-4],[0,12],[1,7],[0,4],[2,3],[8,-6],[11,-43],[1,-5],[1,-5],[0,-7],[1,-7],[-1,-8],[0,-9],[0,-4],[1,-10],[0,-3],[-1,-2],[0,-2],[-1,-2],[-6,-3],[0,1],[-1,5],[-1,1],[-4,-2],[-1,2],[-4,9],[-1,10],[0,13],[-1,-2],[-1,-4],[0,-8],[0,-10],[-4,18],[-1,2],[-1,2],[-1,3],[-1,8],[-1,2],[-1,-1],[-3,4],[0,-1],[-1,-3],[2,-5],[0,-4],[0,-7],[0,-5],[-2,-5],[2,-5],[1,0],[1,-1],[0,-4],[0,-4],[1,-3],[1,3],[0,1],[4,-8],[1,-7],[2,1],[1,-1],[-1,-5],[-3,-6],[0,-7],[0,-3],[1,-1],[0,1],[1,0],[2,5],[1,0],[-4,-14],[2,-9],[1,-1],[3,5],[1,-1],[1,-4],[-1,-10],[2,-3],[-1,-7],[-1,-4],[0,-3],[-1,-1],[-5,6],[0,1],[-1,2],[0,3],[0,3],[-1,5],[-1,3],[-2,0],[2,-11],[-1,-7],[-3,-1],[-1,-7],[3,-4],[1,-4],[0,-1],[0,-2],[-1,-4],[2,-1],[1,-3],[-2,-15],[-2,-10],[-10,-30],[-3,-12],[-1,-19],[12,23],[0,-12],[-2,-40],[0,-3],[1,-6],[0,-4],[1,-3],[1,-5],[0,10],[0,8],[1,7],[1,14],[1,7],[0,3],[1,8],[0,3],[3,23],[3,19],[4,12],[4,6],[1,-1],[0,-2],[0,-1],[1,2],[0,3],[0,2],[2,0],[8,-13],[2,1],[1,-2],[-2,16],[1,3],[1,1],[3,-2],[1,1],[0,3],[1,7],[0,3],[1,2],[1,-2],[1,-3],[2,-7],[3,-3],[0,-2],[1,-6],[0,-1],[2,-5],[1,-2],[0,-7],[1,-3],[1,5],[2,0],[0,-1],[1,-4],[0,-6],[0,-5],[-1,-3],[-2,-9],[0,-6],[-1,-8],[1,-2],[0,1],[6,25],[4,0],[0,-13],[1,-3],[7,13],[5,-3],[1,-4],[3,-20],[2,-3],[-2,-15],[0,-5],[-1,-2],[-7,12],[-4,14],[-1,1],[0,-15],[1,-8],[2,-9],[0,-2],[0,-2],[0,-2],[1,-1],[1,2],[1,1],[0,-2],[5,-11],[3,-18],[1,-3],[1,4],[0,-7],[-1,-5],[0,-2],[-2,-2],[0,-2],[-1,-3],[1,-1],[0,-1],[1,-5],[4,3],[1,5],[1,0],[1,-6],[3,-14],[2,-18],[0,-4],[1,1],[2,4],[-2,10],[-1,13],[1,4],[1,-3],[1,0],[0,1],[1,3],[0,8],[0,9],[0,7],[1,6],[-1,2],[0,3],[0,3],[1,1],[7,-2],[5,-1],[4,8],[2,1],[2,-2],[2,5],[0,-1],[1,-5],[0,-1],[3,-4],[1,-6],[1,-3],[2,-5],[1,0],[1,-7],[1,-2],[1,1],[2,-5],[0,-1],[1,2],[0,4],[0,-6],[1,-2],[1,-1],[2,-4],[0,-5],[0,-4],[0,-2],[-1,-1],[1,-4],[0,-2],[1,1],[1,-8],[1,-4],[0,-1],[10,18],[7,-4],[7,-4],[1,-2],[1,-6],[1,-1],[3,0],[0,-3],[2,-9],[2,-3],[4,-9],[1,3],[1,2],[2,1],[9,35],[0,2],[8,5],[7,5],[6,-8],[3,0],[13,-21],[1,-6],[2,-3],[0,-2],[1,-1],[1,2],[0,-2],[1,-4],[2,-5],[11,-10],[11,-9],[12,-10],[11,-9],[11,-9],[1,5],[0,1],[3,-5],[0,1],[2,6],[2,3],[3,0],[4,-10],[1,-2],[0,-4],[1,-2],[10,-6],[10,-6],[3,-10],[6,-6],[9,7],[2,-4],[9,13],[1,5],[1,7],[0,2],[1,8],[0,3],[0,3],[0,2],[2,7],[2,3],[5,-3],[2,-4],[1,-5],[0,-5],[0,-9],[0,-8],[0,-8],[1,-4],[-1,-25],[-1,-27],[0,-9],[0,-9],[1,-17],[5,-56],[4,-29],[1,-3],[0,-3],[0,-3],[0,-2],[1,-3],[0,-5],[1,-10],[0,-9],[1,-3],[2,-1],[-2,-5],[0,-2],[-1,-2],[-1,1],[0,-2],[-1,-7],[-1,-6],[-1,-4],[-1,-2],[-1,0],[-2,2],[-4,-1],[0,-4],[0,-2],[1,-2],[-2,-3],[-1,-4],[1,-3],[2,-1],[-1,-6],[-1,-17],[0,-6],[1,0],[1,2],[-2,-7],[-5,-16],[-2,-11],[-2,-3],[0,-3],[0,-7],[1,1],[-1,-6],[1,-1],[2,-5],[9,8],[4,-4],[-1,-8],[-3,-14],[1,-2],[-1,-8],[-2,-6],[-10,-21],[1,-2],[1,-2],[0,-2],[0,-4],[-1,-4],[0,-4],[2,-1],[9,-23],[1,-9],[0,-17],[0,-17],[-1,-10],[-2,-5],[-1,-4],[-2,0],[-4,11],[-1,0],[-3,-16],[-1,0],[-7,20],[-1,0],[-1,-2],[-1,-4],[-1,-12],[0,-4],[-1,-2],[-1,-3],[1,-7],[2,-8],[1,-7],[-4,-13],[0,-4],[0,-6],[0,-10],[4,3],[4,-5],[9,-20],[-2,-14],[-1,-11],[-1,-5],[-2,-2],[-4,2],[-2,-3],[-1,-9],[4,-11],[4,-5],[1,-4],[0,-8],[-1,-10],[-1,-8],[-3,-25],[-4,-15],[-4,-8],[-4,-3],[-1,2],[-1,6],[-1,8],[0,7],[-4,21],[-1,12],[-1,3],[0,2],[0,4],[-1,21],[-1,9],[0,7],[-1,2],[-1,-2],[0,-4],[0,-6],[0,-9],[0,-5],[0,-4],[0,-4],[0,-6],[0,-4],[-1,-2],[0,-2],[-1,-11],[-2,-5],[-2,-5],[0,-19],[-2,-8],[-7,-4],[-1,-4],[0,-5],[0,-8],[0,-11],[-1,-2],[-1,-5],[0,-7],[0,-9],[0,-8],[0,-5],[-1,-2],[-6,-15],[-1,-3],[0,-6],[1,-6],[0,-3],[12,11],[1,-1],[1,-4],[0,-4],[-2,-8],[0,-8],[1,-1],[1,1],[0,-3],[0,-3],[0,-5],[1,-4],[0,-2],[3,2],[0,-2],[0,-3],[0,-4],[1,-5],[0,-2],[1,-5],[1,0],[0,1],[1,2],[0,1],[1,-4],[1,1],[1,6],[7,11],[1,-1],[1,-3],[1,-14],[0,-4],[1,-2],[1,-1],[1,2],[0,5],[1,2],[0,2],[0,18],[1,12],[2,6],[5,10],[6,-1],[1,-3],[2,-30],[0,-9],[0,-10],[-1,-35],[0,-36],[0,-7],[-1,-6],[-2,-20],[-1,-3],[1,-5],[0,-7],[-2,-14],[-1,-7],[0,-7],[1,-8],[-1,-8],[-4,-28],[0,-2],[0,-1],[1,-1],[-2,-14],[-6,-24],[-1,-4],[-1,-7],[2,-6],[1,0],[1,-2],[-4,-14],[-5,-4],[-1,-2],[0,-5],[0,-10],[-2,-6],[-5,-10],[1,-3],[-1,-5],[-1,-7],[-3,-27],[-2,-10],[0,-5],[0,-5],[0,-5],[0,-1],[0,-4],[0,-4],[0,-2],[-1,-2],[1,-3],[0,-1],[1,0],[0,-6],[0,-3],[-1,-2],[1,-5],[0,-5],[0,-6],[-1,-5],[-2,-6],[0,-2],[0,-6],[0,-3],[-2,-7],[-5,-10],[1,-6],[0,-3],[1,-1],[-3,-15],[-1,-8],[1,-3],[1,-11],[0,-3],[0,-4],[0,-3],[0,-5],[0,-4],[-1,-4],[0,-2],[-1,-4],[0,-2],[0,-6],[-1,-2],[0,-4],[-1,-3],[-3,0],[0,-3],[-1,-9],[1,-4],[2,-3],[0,-4],[0,-3],[0,-3],[0,-3],[0,-2],[0,-3],[-1,-5],[0,-7],[0,-16],[0,-13],[0,-3],[0,-2],[0,-4],[0,-4],[0,-5],[0,-4],[-2,-18],[-1,-7],[1,-3],[-1,-4],[0,-4],[0,-5],[-1,-13],[0,-4],[-1,-13],[-1,-20],[0,-4],[0,-4],[0,-7],[0,-14],[-1,-6],[0,-12],[-1,-22],[-1,-22],[0,-8],[-1,-7],[-2,-9],[-5,-8],[-4,-13],[0,-2],[-1,-13],[-1,-3],[-4,-13],[0,-1],[0,-2],[0,-2],[0,-2],[1,-3],[0,-4],[0,-8],[0,-3],[1,-5],[1,-1],[3,-4],[1,0],[1,4],[1,-1],[0,-2],[0,-3],[1,-2],[1,-1],[5,16],[1,1],[1,-2],[0,-4],[1,-1],[1,1],[1,5],[0,-9],[0,-6],[-2,-10],[1,-4],[1,0],[2,6],[0,-12],[2,-4],[3,4],[13,40],[2,2],[0,3],[1,5],[1,3],[1,0],[1,0],[0,10],[0,10],[1,10],[-1,9],[2,6],[0,4],[0,8],[0,8],[0,3],[0,5],[0,3],[-1,6],[0,9],[0,4],[-2,3],[0,4],[-1,6],[0,7],[0,18],[0,5],[0,3],[-1,6],[0,6],[1,7],[2,9],[0,5],[0,3],[1,1],[1,2],[1,4],[2,5],[-1,4],[4,23],[3,9],[2,2],[3,-2],[3,-5],[1,1],[8,25],[1,1],[2,-3],[6,3],[4,-5],[0,-3],[0,-3],[0,-3],[-1,-2],[1,-2],[2,2],[1,5],[1,6],[-2,12],[1,9],[0,3],[1,2],[-1,1],[0,2],[0,1],[1,8],[1,6],[0,4],[1,3],[2,1],[0,1],[1,7],[1,1],[2,-5],[0,3],[0,13],[-1,7],[-1,2],[-2,2],[1,10],[0,8],[1,5],[1,3],[0,-1],[1,0],[0,11],[0,1],[1,0],[6,5],[2,-3],[3,6],[4,1],[0,1],[4,18],[1,12],[1,5],[0,1],[0,5],[-1,2],[1,0],[0,3],[0,2],[-2,1],[-1,1],[-1,7],[0,2],[-4,4],[0,2],[0,6],[0,3],[1,1],[6,-1],[4,9],[1,4],[3,14],[2,1],[2,6],[1,-2],[1,-6],[2,9],[-1,3],[-3,7],[-1,7],[-1,2],[0,4],[0,4],[1,4],[0,3],[0,2],[1,0],[0,-2],[1,0],[0,1],[1,2],[0,3],[1,1],[5,-11],[1,1],[3,9],[-4,14],[0,2],[-1,6],[0,2],[-2,2],[-3,14],[-1,6],[0,6],[0,3],[1,5],[0,3],[1,9],[1,3],[-1,8],[-1,4],[0,6],[1,2],[0,2],[1,4],[0,6],[1,2],[4,4],[1,8],[1,1],[0,1],[0,7],[1,3],[-1,4],[0,1],[-3,1],[-1,3],[-1,3],[0,5],[1,3],[0,2],[1,12],[4,53],[1,3],[1,-1],[2,0],[-1,14],[0,1],[1,1],[0,2],[0,4],[1,3],[0,2],[2,-1],[1,4],[0,7],[0,12],[-2,3],[0,2],[-1,6],[0,1],[2,20],[0,4],[1,2],[2,1],[1,2],[0,2],[0,4],[1,2],[0,1],[1,0],[1,-1],[0,-3],[2,-8],[1,-2],[-1,12],[2,5],[1,-1],[2,-4],[1,-2],[1,10],[2,14],[-1,11],[1,2],[0,1],[1,2],[0,3],[3,12],[0,2],[1,7],[0,3],[0,3],[1,1],[1,0],[1,-2],[1,1],[2,8],[0,4],[0,6],[0,6],[0,3],[-1,3],[0,3],[0,3],[0,5],[-1,12],[-2,16],[-1,12],[-1,12],[0,5],[0,6],[1,5],[1,8],[1,5],[0,2],[0,3],[0,4],[0,3],[1,1],[3,10],[0,5],[1,0],[1,-1],[0,1],[1,2],[0,6],[0,1],[1,-1],[0,-4],[1,0],[0,2],[1,5],[0,4],[1,-1],[0,-3],[1,0],[1,5],[0,9],[0,3],[0,4],[1,7],[0,8],[0,5],[0,5],[1,3],[2,4],[0,2],[1,3],[0,6],[0,2],[1,1],[1,5],[1,-2],[0,-4],[0,-2],[1,0],[1,-1],[0,-3],[1,-12],[1,-2],[2,-2],[0,4],[1,5],[2,12],[2,19],[1,5],[1,4],[2,0],[1,2],[4,-7],[0,-1],[1,-3],[0,-3],[0,-4],[2,-14],[0,-4],[0,-6],[-2,-24],[1,-4],[1,1],[2,7],[0,-11],[2,1],[3,11],[2,15],[2,5],[1,-3],[-1,-13],[1,-7],[0,-2],[1,2],[2,11],[1,4],[1,0],[1,-4],[1,-14],[1,-7],[1,-2],[1,4],[2,16],[1,4],[-1,9],[1,6],[1,3],[0,1],[1,-3],[0,-4],[1,-17],[0,-2],[1,0],[0,-2],[1,-10],[0,-4],[0,-3],[1,2],[2,12],[1,3],[1,-1],[0,-1],[0,1],[1,9],[1,3],[2,4],[1,6],[1,-2],[0,1],[1,6],[1,7],[0,6],[1,-2],[-2,18],[-1,5],[0,8],[0,11],[-1,8],[0,5],[0,2],[1,4],[0,2],[0,4],[0,3],[0,4],[1,2],[-1,0],[0,3],[0,9],[1,0],[2,-2],[0,1],[1,4],[1,9],[0,2],[1,1],[2,4],[3,16],[5,5],[0,-7],[-1,-8],[0,-6],[1,-3],[1,1],[0,3],[1,5],[2,16],[1,8],[1,5],[2,4],[2,1],[0,-2],[1,-2],[1,-1],[0,2],[0,2],[1,2],[-1,4],[1,5],[0,5],[-1,3],[0,3],[1,2],[1,3],[0,1],[1,-1],[1,-2],[0,1],[1,6],[0,1],[-1,4],[0,2],[1,9],[2,3],[5,0],[1,1],[1,6],[3,-1],[0,-1],[1,-4],[0,-2],[1,1],[0,5],[1,3],[9,17],[-1,6],[0,5],[0,5],[1,4],[1,6],[0,2],[1,11],[0,2],[1,2],[2,0],[-2,8],[0,8],[1,4],[0,3],[1,3],[-3,2],[0,7],[0,8],[0,7],[1,4],[0,1],[0,5],[1,2],[3,19],[1,2],[6,2],[0,2],[2,7],[0,2],[7,7],[-2,10],[-1,5],[-2,2],[-1,0],[0,2],[2,9],[0,5],[0,3],[0,5],[-1,4],[0,5],[0,6],[0,5],[1,4],[-1,2],[0,1],[-1,-1],[0,5],[0,3],[0,2],[1,1],[0,3],[0,8],[0,4],[1,8],[0,9],[1,3],[1,6],[4,29],[10,39],[9,18],[9,19],[3,2],[12,25],[12,25],[2,1],[2,-4],[9,21],[8,20],[2,0],[9,25],[1,-3],[0,1],[2,7],[2,4],[1,1],[4,-7],[0,-1],[0,-2],[0,-2],[1,-2],[0,1],[0,2],[1,1],[1,-2],[1,11],[1,5],[2,10],[1,1],[0,1],[1,5],[0,1],[3,-2],[3,4],[0,-1],[2,-8],[0,-3],[1,-1],[3,9],[1,2],[1,-2],[1,0],[1,8],[1,2],[1,1],[1,-1],[1,-5],[1,-4],[1,-9],[1,-3],[2,-5],[4,7],[0,2],[0,3],[1,4],[0,4],[0,2],[-2,8],[-2,1],[-2,7],[-2,22],[1,12],[0,6],[5,10],[1,5],[1,10],[1,8],[1,6],[10,17],[5,13],[0,2],[1,9],[0,3],[1,5],[2,15],[1,3],[1,2],[3,-1],[10,12],[3,-4],[-1,-14],[1,0],[1,1],[1,-3],[0,-5],[1,-3],[4,-3],[1,-4],[2,-3],[1,0],[0,1],[1,4],[0,1],[4,-6],[0,2],[2,6],[1,2],[1,-1],[3,8],[0,2],[1,8],[0,3],[0,2],[2,6],[0,1],[1,2],[0,2],[0,3],[1,2],[0,2],[2,1],[3,-3],[9,7],[0,-2],[2,-9],[1,-2],[1,0],[6,18],[2,16],[3,11],[10,20],[3,11],[2,1],[1,5],[1,1],[3,-1],[0,1],[2,12],[1,3],[1,2],[4,-1],[1,-2],[1,-2],[0,-3],[0,-2],[1,-4],[0,-11],[0,-3],[1,-2],[2,4],[1,0],[2,2],[5,15],[2,1],[1,3],[5,-8],[0,1],[3,6],[3,-7],[2,-1],[3,2],[2,-2],[2,-9],[1,-1],[3,-2],[2,2],[3,14],[1,4],[2,0],[2,-2],[4,8],[1,0],[2,-3],[2,-8],[1,1],[1,0],[0,-2],[1,-5],[1,7],[1,16],[1,3],[1,0],[1,1],[1,8],[2,4],[1,-1],[0,1],[3,11],[5,20],[2,9],[0,3],[2,2],[7,-9],[1,1],[6,13],[1,7],[3,0],[5,13],[3,-5],[2,1],[2,-3],[4,-26],[2,-2],[2,2],[4,-10],[3,-3],[1,2],[2,5],[3,14],[1,4],[2,-1],[3,-9],[3,3],[4,-2],[3,3],[2,-1],[3,-8],[-1,-9],[0,-4],[0,-3],[0,-1],[0,-3],[0,-1],[0,-5],[0,-8],[1,-8],[0,-6],[1,1],[3,19],[1,1],[1,-2],[0,-5],[1,-5],[-1,-5],[1,1],[3,5],[0,2],[0,3],[0,5],[1,3],[0,2],[5,7],[3,10],[1,4],[0,7],[1,7],[1,6],[0,3],[5,10],[2,2],[3,10],[1,1],[0,-1],[1,-3],[1,0],[1,-2],[1,-5],[1,-2],[2,2],[1,-1],[2,-6],[1,-10],[1,-14],[0,-5],[0,-4],[0,-4],[0,-2],[4,-4],[1,1],[-1,-3],[0,-16],[0,3],[0,-1],[2,-3],[0,2],[2,9],[0,1],[1,0],[1,0],[1,6],[2,3],[1,0],[1,-3],[2,0],[1,10],[1,12],[2,8],[1,-1],[1,-11],[1,-3],[0,1],[2,5],[3,4],[1,-1],[3,-9],[2,0],[10,36],[3,5],[3,-2],[1,-3],[1,-3],[0,-5],[2,-17],[2,5],[1,-2],[0,-10],[0,-3],[1,-5],[0,-2],[0,-1],[1,-1],[0,-2],[2,1],[0,-2],[2,-10],[1,-1],[1,7],[2,23],[1,8],[1,4],[3,3],[2,13],[3,8],[1,8],[1,4],[8,0],[0,-2],[1,-6],[0,-3],[0,-2],[0,-22],[-1,-11],[-1,-7],[1,-6],[3,5],[8,35],[2,4],[2,1],[0,-12],[-2,-9],[-8,-31],[1,-2],[1,-3],[0,-4],[1,-15],[0,-5],[-3,-15],[1,-5],[0,-1],[1,-1],[0,-2],[0,-4],[0,-11],[0,-12],[1,-7],[0,-3],[1,2],[1,7],[0,7],[0,9],[0,9],[1,9],[2,20],[0,5],[0,3],[1,2],[1,-2],[0,-3],[1,-7],[0,-3],[0,-2],[2,-3],[0,2],[0,7],[1,5],[1,3],[1,2],[1,-1],[1,0],[0,3],[1,7],[0,2],[1,1],[0,14],[1,13],[2,8],[1,3],[-1,-16],[0,-9],[0,-9],[1,-8],[0,1],[1,7],[1,7],[1,12],[4,14],[1,9],[1,6],[1,3],[1,0],[1,0],[1,3],[1,-2],[1,2],[1,4],[1,6],[0,2],[1,1],[2,7],[1,0],[0,-6],[0,-12],[0,1],[3,10],[0,-1],[1,-6],[1,-16],[1,9],[1,6],[2,6],[-1,3],[-2,-1],[1,9],[-1,4],[-2,5],[10,5],[1,2],[1,4],[5,34],[1,7],[0,9],[0,6],[1,5],[0,3],[0,1],[1,1],[1,1],[1,7],[0,3],[1,9],[0,4],[1,4],[0,2],[3,5],[1,3],[-9,10],[1,2],[0,2],[1,1],[0,3],[0,1],[-1,1],[1,6],[2,7],[1,6],[7,-1],[3,-7],[9,3],[9,3],[5,20],[2,7],[3,3],[6,-6],[1,1],[3,-4],[0,-1],[0,-4],[0,-4],[1,-3],[0,-1],[1,4],[1,-1],[1,-3],[2,1],[1,-1],[0,-2],[1,-4],[0,-2],[2,-2],[4,-15],[1,-3],[1,1],[3,8],[0,2],[5,-1],[7,-13],[7,-14],[4,-24],[2,-4],[6,0],[12,-25],[2,3],[0,-1],[1,-7],[1,-1],[1,-1],[0,-6],[1,-2],[11,-20],[11,-21],[1,-3],[0,-2],[0,-4],[0,-4],[0,-4],[0,-1],[1,2],[0,3],[0,3],[1,3],[5,-4],[2,-4],[1,-15],[1,0],[1,5],[10,-3],[6,-12],[2,-10],[10,-8],[1,-3],[1,-11],[1,-7],[0,-6],[0,-7],[-1,-5],[-2,-5],[0,-4],[-2,-15],[0,-6],[0,-11],[0,-20],[1,1],[0,3],[1,13],[0,2],[1,0],[0,-1],[0,1],[1,4],[0,11],[1,4],[0,2],[4,17],[3,18],[1,2],[1,-2],[0,-9],[0,-6],[1,-9],[1,-7],[0,-7],[0,-6],[1,-4],[1,0],[1,1],[2,-10],[1,-2],[2,-2],[1,-4],[2,-8],[1,-14],[0,-12],[0,-3],[0,-2],[1,-3],[2,-9],[1,-1],[1,1],[2,6],[1,-1],[0,1],[0,1],[0,2],[0,3],[0,1],[2,11],[1,4],[1,0],[2,-7],[1,1],[1,1],[1,-2],[1,-7],[1,-2],[6,4],[0,3],[-1,5],[0,2],[1,5],[7,7],[-2,9],[3,7],[-1,3],[7,11],[1,7],[3,17],[4,13],[0,1],[1,-1],[2,-5],[1,-6],[2,-9],[0,-3],[1,-1],[2,5],[0,6],[0,4],[-2,6],[1,14],[-1,5],[0,6],[0,9],[0,12],[-1,1],[-1,0],[3,13],[0,6],[0,16],[1,7],[-3,7],[0,4],[-1,4],[0,2],[-1,1],[-1,1],[0,4],[0,4],[-1,6],[1,4],[1,7],[1,16],[1,4],[2,2],[0,5],[1,5],[-1,4],[1,4],[0,3],[1,6],[1,5],[4,21],[0,2],[2,1],[8,19],[9,19],[6,-1],[13,19],[13,18],[3,10],[9,11],[0,-3],[1,-14],[1,-6],[1,-3],[3,-6],[3,-13],[3,-6],[4,-11],[0,-4],[1,-11],[2,-10],[3,-14],[2,-2],[0,-2],[2,-15],[0,-3],[1,-1],[1,1],[1,-2],[1,-16],[1,-3],[0,1],[1,-2],[0,-2],[0,-4],[1,-1],[0,-1],[1,-3],[-1,-4],[0,-6],[0,-7],[0,-5],[-2,-8],[0,-6],[-1,-9],[1,2],[2,-5],[0,-1],[0,-4],[1,-7],[0,-1],[-1,-4],[0,-1],[2,1],[-3,-21],[-1,-10],[10,10],[2,-5],[1,-1],[3,8],[4,-3],[1,1],[1,0],[0,-3],[1,-7],[0,-4],[1,-2],[2,-2],[2,-8],[3,-1],[4,-12],[2,-7],[1,-10],[-1,-10],[1,-4],[0,-4],[0,-3],[0,-3],[0,-3],[0,-3],[1,-2],[0,-3],[1,-3],[0,-6],[0,-5],[-2,-25],[-3,-20],[-6,-28],[-6,-17],[-11,-6],[-5,-16],[-3,-4],[-2,3],[-10,-24],[-1,-4],[-3,-27],[-1,-5],[-1,-7],[1,-2],[1,-2],[-1,-11],[-1,-5],[-2,-6],[0,-3],[-1,-8],[-1,-3],[-1,-5],[0,-4],[0,-7],[1,1],[0,-2],[0,-3],[1,-2],[0,1],[2,4],[1,1],[2,-2],[4,4],[9,23],[8,23],[-1,-17],[-1,-8],[1,-4],[1,1],[3,7],[0,2],[1,8],[0,3],[7,13],[5,1],[1,4],[-2,7],[1,12],[2,8],[1,5],[5,-2],[2,4],[2,1],[2,3],[1,7],[1,0],[0,-8],[0,-6],[1,-1],[3,9],[1,4],[0,10],[1,4],[1,0],[1,-2],[1,-6],[1,1],[0,5],[1,16],[1,3],[0,-2],[2,-13],[1,-3],[0,-1],[4,9],[1,4],[2,11],[3,12],[3,19],[4,14],[0,-10],[-1,-10],[-1,-19],[-1,-13],[0,-8],[1,-4],[3,-3],[3,5],[1,-1],[3,7],[1,2],[5,0],[1,2],[1,5],[0,1],[1,-7],[0,-4],[2,-3],[1,-4],[0,-3],[0,-4],[0,-3],[0,-2],[1,0],[0,1],[4,23],[2,6],[12,12],[2,5],[-1,-13],[0,-6],[-1,-5],[-3,-15],[0,-1],[1,-2],[0,-3],[0,-5],[4,7],[0,-1],[1,-7],[0,2],[1,3],[3,2],[0,-1],[1,-5],[1,0],[1,3],[2,2],[0,-1],[1,-6],[1,0],[0,1],[0,1],[0,5],[0,1],[1,1],[1,0],[6,15],[1,0],[2,-5],[1,0],[1,1],[3,11],[4,6],[2,10],[8,12],[2,7],[9,19],[2,-3],[1,-11],[-3,-12],[-11,-23],[-11,-22],[-12,-23],[-11,-22],[1,-2],[0,-1],[1,-1],[0,-2],[-1,-4],[0,-2],[2,-13],[0,-2],[1,2],[1,1],[0,-1],[0,-2],[0,-4],[0,-1],[2,-3],[-2,-13],[1,-1],[1,0],[1,3],[3,10],[0,1],[0,-1],[1,-3],[0,-1],[1,1],[0,1],[2,7],[0,2],[1,1],[2,0],[1,-2],[1,1],[8,16],[2,-3],[4,11],[7,10],[8,10],[2,6],[2,2],[8,27],[1,0],[1,-4],[1,0],[11,18],[3,-1],[4,14],[0,1],[1,-1],[0,1],[1,3],[0,1],[1,2],[0,2],[0,4],[0,2],[0,-1],[1,-2],[0,-3],[1,3],[0,-1],[0,8],[-1,1],[0,6],[0,2],[3,14],[0,3],[4,9],[3,12],[2,4],[5,4],[2,6],[1,1],[2,0],[8,14],[7,13],[2,-1],[3,-5],[5,-1],[1,1],[1,4],[2,11],[1,7],[0,4],[0,3],[1,2],[0,3],[6,14],[1,-1],[0,1],[0,2],[0,2],[1,2],[0,1],[0,-1],[1,-3],[-1,-5],[1,0],[0,1],[1,7],[0,1],[5,-3],[0,-9],[0,-5],[3,-5],[0,-2],[0,-5],[0,-4],[0,-4],[-1,-7],[1,-1],[1,3],[1,-1],[0,-2],[1,1],[0,-2],[-1,-4],[0,-2],[1,2],[1,1],[1,-1],[1,1],[0,2],[0,-2],[1,-6],[0,-2],[0,-3],[1,0],[2,2],[1,6],[1,4],[0,4],[0,4],[1,3],[0,-1],[1,-5],[0,-1],[4,13],[3,4],[0,3],[2,9],[1,7],[0,7],[0,10],[1,7],[0,6],[1,2],[1,23],[2,11],[8,9],[1,4],[1,7],[3,17],[1,2],[1,0],[0,-1],[0,-3],[1,-3],[0,-3],[2,-3],[1,-7],[0,-12],[0,-15],[2,-10],[1,3],[0,2],[1,2],[1,-2],[1,-5],[0,-6],[-1,-4],[1,-5],[1,-13],[0,-3],[1,3],[0,9],[1,20],[-1,26],[0,6],[1,6],[1,-1],[1,-3],[0,-2],[0,-11],[0,-6],[0,-3],[1,0],[1,-4],[0,-1],[0,2],[2,8],[0,2],[1,2],[1,0],[-1,-6],[0,-7],[1,-1],[1,4],[1,0],[2,-5],[-1,-10],[0,-3],[0,-1],[-1,-2],[-1,-2],[0,-7],[0,-5],[0,-6],[0,-7],[-1,-6],[-1,-3],[-1,-3],[-1,-3],[0,-4],[-1,-12],[3,8],[1,1],[1,-4],[1,-2],[1,-8],[0,-3],[-1,-8],[-2,-8],[-1,-6],[0,-5],[0,-16],[0,-5],[0,-4],[1,-1],[7,13],[3,-14],[-1,-15],[-1,-8],[0,-5],[2,-8],[0,-4],[0,-5],[0,-6],[0,-7],[0,-3],[-1,-2],[0,-5],[0,-2],[0,-2],[1,-2],[0,-2],[0,-4],[0,-7],[0,-6],[0,-4],[1,1],[0,3],[1,15],[0,4],[0,5],[0,6],[0,5],[1,6],[0,5],[0,3],[5,16],[-1,-17],[1,-3],[0,-2],[0,-3],[0,-9],[0,-4],[0,-3],[1,-5],[1,-1],[5,8],[2,-3],[4,12],[1,0],[2,-3],[4,3],[0,-2],[0,-3],[1,-14],[0,-2],[1,-6],[1,-1],[0,1],[3,9],[1,1],[1,-2],[0,-4],[0,-8],[0,-2],[3,-9],[1,0],[3,7],[2,2],[0,3],[1,7],[0,10],[1,11],[2,-3],[5,-26],[0,-3],[1,-12],[0,-6],[1,2],[3,23],[0,3],[0,2],[0,6],[0,3],[1,3],[0,9],[1,6],[5,13],[0,3],[0,5],[0,6],[-1,5],[-1,12],[0,6],[1,5],[2,7],[0,3],[0,4],[1,6],[0,3],[1,9],[1,7],[-1,3],[-2,1],[0,9],[1,13],[0,8],[0,5],[1,5],[2,8],[1,5],[0,5],[1,5],[0,6],[1,9],[0,10],[0,7],[2,11],[2,14],[1,4],[3,2],[0,5],[1,13],[1,5],[4,6],[0,-1],[1,-6],[1,1],[1,4],[0,-2],[0,-5],[0,-3],[3,15],[2,3],[1,-6],[0,6],[1,15],[1,4],[2,13],[1,0],[3,-10],[0,-2],[5,-1],[1,-4],[1,-1],[1,2],[1,-1],[0,-2],[1,-6],[0,-3],[1,-1],[1,-1],[1,-1],[0,1],[1,2],[1,5],[0,1],[10,-10],[8,9],[3,13],[9,9],[1,-1],[1,-7],[2,-4],[6,-1],[5,15],[2,14],[1,2],[4,6],[6,-1],[3,-8],[6,1],[0,-3],[1,-5],[1,-6],[0,-8],[1,-5],[1,-3],[0,-2],[1,0],[0,1],[1,0],[1,-7],[2,-4],[0,-3],[2,-15],[1,2],[1,-2],[0,-2],[0,-7],[0,-2],[0,-2],[1,0],[2,4],[1,1],[0,-2],[1,-6],[-1,-5],[-2,-8],[-2,-16],[-1,-10],[-4,-21],[2,-3],[5,10],[-1,-2],[0,-2],[0,-4],[0,-3],[1,-1],[2,8],[10,54],[-1,-10],[4,3],[1,5],[1,0],[1,-5],[0,-3],[1,1],[4,11],[0,7],[0,6],[0,6],[0,5],[1,4],[2,9],[0,2],[1,18],[0,12],[0,7],[1,2],[4,-3],[0,-2],[0,-2],[0,-3],[0,-3],[1,-12],[0,-2],[1,-2],[0,-1],[1,-19],[1,-11],[0,-8],[0,-8],[0,-8],[1,-2],[1,9],[0,11],[1,7],[2,2],[0,-3],[1,1],[1,5],[1,1],[1,-1],[1,0],[2,8],[1,0],[1,-3],[2,-14],[2,-10],[0,-4],[1,-10],[1,-4],[1,-3],[3,-6],[1,-1],[0,-4],[0,-4],[1,-4],[0,-8],[0,-5],[2,-19],[0,-4],[1,0],[1,9],[0,6],[0,6],[0,1],[-2,5],[0,1],[0,20],[1,11],[1,6],[6,7],[13,-8],[1,2],[1,-1],[0,-4],[1,-2],[4,-4],[1,3],[1,0],[0,-2],[1,-7],[0,-2],[0,-2],[2,-1],[0,-2],[2,-9],[0,-2],[0,-2],[1,-2],[0,-2],[1,-1],[0,-4],[1,-2],[3,-4],[1,-2],[0,-7],[0,-3],[1,-1],[-2,-29],[1,2],[2,6],[2,16],[1,4],[1,2],[6,-2],[1,0],[0,5],[0,1],[0,-2],[1,-6],[0,-2],[0,-1],[2,-5],[0,1],[1,1],[4,3],[1,-2],[2,-5],[1,0],[1,3],[2,-1],[2,1],[6,-9],[-1,-10],[1,-6],[0,-3],[1,0],[1,1],[1,6],[1,1],[2,-2],[1,-3],[2,-10],[1,-3],[1,-1],[0,-3],[1,-10],[-1,-4],[0,-6],[-1,-7],[0,-9],[1,7],[2,6],[1,2],[2,-7],[0,4],[1,6],[0,4],[1,1],[5,0],[1,-2],[0,-4],[1,-13],[1,-1],[0,2],[0,5],[1,5],[-1,3],[1,2],[0,2],[1,2],[1,0],[5,-8],[6,-1],[3,-5],[7,-30],[1,-2],[0,3],[0,9],[1,-4],[1,0],[1,1],[1,8],[4,11],[11,-7],[3,-9],[3,-17],[1,-5],[0,-14],[1,-5],[0,-1],[1,0],[0,-1],[0,-4],[0,-2],[1,-1],[0,-1],[1,-5],[1,-8],[2,-4],[9,2],[2,4],[3,16],[13,39],[1,1],[7,-12],[2,-7],[1,-7],[1,-7],[-1,-18],[0,-7],[1,-6],[0,-3],[0,-3],[0,-8],[-1,-7],[-2,-9],[-1,-6],[8,17],[1,1],[0,-2],[0,-5],[0,-9],[1,-7],[0,-6],[0,-2],[1,5],[0,24],[0,6],[1,10],[1,7],[2,5],[1,2],[3,1],[2,-5],[1,-6],[3,-21],[1,-7],[-1,-15],[-1,-9],[-1,-3],[-2,-1],[-1,4],[-2,5],[-1,3],[-1,-3],[1,-8],[0,-4],[1,-1],[1,1],[1,-2],[1,-4],[0,-3],[0,-5],[0,-7],[-1,-4],[0,-14],[0,-4],[-1,-3],[-1,-6],[0,-2],[-2,-13],[-1,-4],[0,-2],[-1,3],[-1,7],[0,10],[-1,5],[-1,-4],[0,-5],[0,-3],[0,-3],[0,-5],[-1,-3],[0,-1],[-1,-2],[0,-7],[1,-2],[1,-1],[0,-1],[0,-4],[1,-3],[0,-5],[0,-7],[0,-4],[0,-5],[0,-8],[0,-6],[0,-5],[0,-4],[-1,-13],[-1,-6],[0,-5],[-2,-7],[-1,-6],[-2,-13],[-1,-9],[-1,-10],[0,-12],[3,5],[-1,-6],[0,-4],[0,-6],[0,-5],[-1,-5],[0,-9],[2,-4],[2,4],[3,17],[0,-11],[0,-6],[0,-6],[1,4],[1,0],[0,-3],[1,-2],[1,3],[2,16],[2,25],[1,11],[3,11],[1,3],[1,2],[5,-3],[1,2],[1,4],[1,6],[3,29],[5,36],[2,4],[1,2],[3,0],[0,-1],[1,-7],[0,-14],[0,-7],[0,-9],[1,-3],[1,-3],[0,-4],[0,-4],[0,-5],[0,-4],[0,-7],[1,-6],[1,-3],[1,0],[1,12],[1,20],[0,17],[2,6],[3,-5],[4,1],[1,-2],[1,-7],[2,-3],[0,-7],[0,-9],[1,-6],[-1,-6],[-2,-15],[0,-5],[2,-2],[0,-4],[1,-5],[1,-8],[0,-5],[1,-6],[1,7],[1,13],[1,14],[1,7],[1,-3],[1,-10],[1,-11],[-1,-13],[-1,-11],[-1,-9],[-2,-5],[1,-13],[1,1],[2,5],[1,-1],[-1,-4],[0,-4],[0,-4],[1,-5],[0,2],[1,7],[1,3],[0,3],[1,2],[1,0],[0,-1],[-1,-5],[1,-1],[3,13],[2,-6],[-2,-21],[-5,-30],[-2,-19],[1,-2],[0,-10],[1,-1],[2,4],[3,11],[5,29],[1,6],[1,-1],[0,-5],[1,-8],[0,-8],[-1,-6],[0,-6],[-1,-4],[-1,-8],[-3,-13],[-2,-11],[-2,-10],[0,-6],[0,-5],[0,-4],[1,-3],[1,2],[2,9],[2,-1],[0,-3],[0,-2],[0,-2],[4,7],[0,-6],[0,-10],[0,-6],[-1,-7],[-1,-4],[0,-8],[1,-2],[1,1],[2,8],[1,0],[0,-5],[1,-1],[1,1],[3,11],[1,1],[0,-1],[1,-4],[2,5],[3,6],[1,0],[2,-5],[1,-1],[1,2],[1,-1],[1,-12],[1,-3],[2,-3],[0,-4],[0,-3],[0,-3],[0,-3],[1,2],[0,3],[0,2],[1,1],[1,-2],[1,0],[2,9],[1,2],[1,-1],[0,-4],[1,-6],[-1,-7],[4,-3],[3,8],[2,-6],[0,4],[0,3],[0,3],[1,3],[0,4],[0,3],[1,1],[0,1],[1,0],[1,-4],[1,-9],[1,-4],[1,0],[2,3],[1,0],[1,2],[2,9],[1,3],[1,1],[0,-1],[-1,-6],[1,-10],[2,-3],[1,3],[2,15],[0,4],[1,2],[1,2],[0,-1],[2,-11],[9,-23],[1,1],[2,7],[-2,11],[0,4],[-1,2],[-1,1],[-1,3],[0,4],[-1,7],[1,5],[2,-4],[2,-16],[1,-4],[10,-1],[3,-4],[8,10],[5,20],[2,3],[1,0],[2,-3],[1,-7],[1,-12],[1,-17],[0,-6],[-2,-14],[0,-7],[0,-8],[1,-5],[-2,-39],[-1,-9],[0,-4],[1,-5],[0,-6],[0,-6],[2,-16],[2,-14],[0,-4],[0,3],[2,13],[1,1],[1,-4],[3,-15],[0,-3],[1,-2],[1,-1],[2,-5],[1,25],[-1,12],[0,8],[0,1],[0,1],[1,1],[-1,16],[0,7],[0,5],[1,1],[1,-3],[8,11],[0,-1],[1,-4],[0,-1],[1,1],[0,-1],[0,-3],[1,-3],[2,-3],[2,-9],[1,1],[6,12],[0,-1],[1,-1],[0,-5],[0,-2],[1,0],[1,3],[0,1],[1,-3],[1,-10],[1,-5],[0,-1],[3,4],[0,-1],[3,-10],[1,-4],[1,-11],[2,-9],[1,-5],[2,-1],[2,2],[1,-2],[1,0],[0,1],[0,3],[1,2],[1,0],[0,1],[0,2],[1,21],[0,1],[0,1],[0,3],[1,2],[3,-7],[1,-2],[2,1],[2,9],[2,2],[3,0],[-1,10],[-1,31],[0,8],[-2,24],[1,4],[1,1],[1,3],[1,10],[-1,6],[-3,9],[-1,9],[0,15],[0,15],[1,11],[1,7],[1,2],[1,0],[1,-2],[2,-3],[2,-9],[1,-2],[1,-2],[1,-7],[1,-3],[1,0],[0,-2],[0,-3],[0,-2],[5,-15],[2,-12],[1,-4],[1,-3],[1,-1],[2,2],[0,-1],[0,-3],[0,-3],[1,-2],[0,-4],[1,-4],[1,-1],[0,-10],[0,-5],[0,-4],[1,-5],[0,-3],[0,-5],[-1,-7],[-1,-1],[0,1],[-1,4],[-6,2],[1,-9],[1,-8],[2,-11],[0,-6],[0,-10],[-2,-17],[2,0],[1,5],[2,20],[1,7],[2,0],[1,-6],[3,-25],[1,-5],[0,-9],[0,-8],[0,-6],[1,-5],[1,-1],[0,2],[2,7],[0,2],[5,-8],[1,-4],[0,-2],[1,-4],[0,-3],[0,-4],[0,-6],[0,-11],[0,-6],[-2,-5],[0,-3],[3,-2],[0,-1],[1,-7],[0,-6],[2,-8],[3,-10],[1,1],[3,11],[-1,5],[0,1],[-1,-1],[0,2],[-2,10],[-1,7],[-1,5],[0,10],[0,10],[1,3],[4,1],[1,-1],[1,-3],[0,-2],[1,-4],[0,-1],[1,1],[0,-1],[0,-2],[2,-16],[0,-4],[1,-5],[0,-7],[0,-4],[0,-4],[0,-4],[1,-2],[2,6],[1,-1],[1,-5],[2,-6],[1,-6],[0,-8],[1,-5],[1,-4],[4,-1],[2,3],[3,9],[1,-1],[2,1],[0,-1],[1,-1],[0,-5],[0,-1],[1,0],[1,1],[4,16],[3,-6],[1,-3],[1,-17],[1,-12],[3,-23],[1,-10],[0,-12],[0,-8],[0,-6],[1,-2],[1,9],[0,-1],[1,-3],[1,-3],[0,6],[1,5],[2,5],[-1,4],[-2,1],[0,2],[-1,4],[0,9],[0,15],[0,6],[0,6],[1,4],[1,6],[1,5],[1,2],[2,0],[0,-1],[1,-6],[0,-3],[1,-1],[1,1],[0,3],[1,7],[0,5],[0,3],[1,0],[3,-1],[0,-1],[2,-11],[1,-3],[3,0],[1,-2],[4,-20],[0,-3],[0,-3],[0,-3],[1,-6],[2,-5],[1,-3],[1,1],[0,3],[0,4],[1,0],[1,3],[1,0],[1,-3],[2,4],[1,0],[0,-3],[1,-3],[2,-17],[1,-5],[0,-13],[1,-8],[1,-11],[0,-2],[1,-1],[1,-4],[0,-1],[0,5],[1,13],[1,9],[1,3],[2,-2],[6,-22],[1,-1],[2,1],[4,-1],[0,-2],[2,-7],[0,-3],[1,-13],[3,-16],[0,-3],[2,-2],[0,-2],[1,-5],[0,-6],[0,-3],[1,-1],[0,-2],[2,-15],[3,-11],[1,-9],[0,-11],[0,-7],[-1,-4],[-1,-3],[-1,-2],[-2,0],[-1,-4],[-1,0],[-3,5],[-3,-3],[-2,3],[-1,-1],[0,-3],[0,-8],[0,-3],[1,-1],[0,-1],[1,-4],[0,-7],[1,-5],[0,-5],[0,-2],[0,-1],[2,2],[2,-3],[1,1],[2,8],[3,-6],[11,-21],[0,-2],[0,-3],[1,-3],[0,-3],[-2,-8],[4,3],[1,-2],[1,-5],[0,-8],[1,-8],[2,-15],[0,-4],[2,-7],[0,-3],[0,-4],[1,-6],[1,-8],[1,-5],[0,-8],[0,-13],[2,-11],[1,-4],[1,-13],[0,-5],[0,-6],[0,-5],[-1,-4],[-1,-4],[0,-8],[0,-6],[1,-2],[0,4],[1,7],[0,5],[1,2],[0,-5],[0,-8],[0,-13],[0,-7],[1,-9],[1,-5],[3,-7],[-2,-22],[-2,-12],[0,-3],[0,-4],[0,-6],[0,-6],[0,-5],[0,-1],[0,-5],[1,-5],[0,-4],[1,-1],[1,0],[3,8],[2,0],[0,1],[1,4],[0,1],[0,-3],[1,-9],[0,-4],[1,-5],[2,0],[3,6],[1,0],[2,-5],[1,-9],[2,-10],[-1,-3],[0,-3],[0,-3],[0,-2],[1,-10],[1,-8],[2,-5],[2,0],[0,-2],[2,-9],[1,3],[1,5],[0,5],[0,2],[0,3],[-1,4],[0,4],[1,1],[-3,33],[0,1],[-1,1],[-1,1],[0,2],[-1,9],[0,10],[0,3],[0,2],[-1,3],[-1,1],[-1,-4],[-1,1],[-1,2],[0,3],[0,10],[0,4],[0,2],[0,1],[0,4],[0,9],[0,5],[0,3],[1,9],[0,5],[0,5],[0,3],[-1,3],[0,2],[0,5],[0,3],[0,4],[-1,8],[1,4],[0,3],[0,2],[0,6],[0,6],[0,5],[-1,4],[0,9],[0,9],[1,18],[0,3],[0,3],[1,3],[0,4],[0,9],[1,2],[3,-5],[0,2],[3,13],[1,3],[7,2],[1,-2],[1,-3],[1,-5],[2,-27],[0,-5],[1,-3],[1,-1],[1,-1],[0,-6],[0,-2],[0,-1],[-1,1],[0,1],[0,-14],[2,-11],[1,-6],[1,-3],[2,0],[1,-1],[0,-3],[1,-3],[0,-10],[1,-3],[5,-12],[2,-10],[0,-1],[1,0],[1,1],[3,-4],[1,1],[1,2],[1,8],[2,1],[1,3],[1,-2],[0,-5],[0,-10],[0,-6],[0,-22],[0,-5],[1,-4],[0,-1],[1,1],[1,-1],[1,-2],[0,-1],[0,2],[0,4],[0,3],[1,3],[0,1],[0,3],[0,7],[1,4],[0,5],[0,3],[1,4],[0,5],[1,4],[1,3],[0,1],[-4,30],[-1,6],[2,9],[2,4],[2,1],[7,-10],[2,-6],[1,-2],[3,-1],[2,3],[0,-1],[0,-2],[1,-3],[1,-4],[1,-2],[6,4],[1,-8],[1,0],[3,7],[1,2],[1,-2],[1,-1],[0,-2],[0,-1],[0,1],[1,2],[0,1],[1,0],[0,-3],[-1,-6],[1,-3],[2,1],[1,0],[0,-2],[-1,-3],[0,-1],[11,-23],[0,7],[0,3],[1,2],[2,0],[0,1],[2,9],[7,12],[2,-2],[0,-2],[0,-5],[0,-1],[8,-2],[1,-4],[2,-7],[0,-5],[0,-4],[0,-5],[-1,-3],[-1,-2],[0,1],[0,3],[-1,0],[-1,-2],[0,1],[0,4],[-1,-1],[-1,-4],[-3,0],[-1,-3],[-1,-8],[1,-4],[0,-4],[0,-3],[1,-1],[2,1],[1,-4],[0,-2],[1,-1],[2,3],[2,4],[1,-6],[1,-2],[1,2],[0,3],[1,1],[1,1],[1,-2],[2,3],[9,2],[2,-1],[2,-7],[4,-3],[1,-6],[1,-3],[0,-5],[0,-4],[0,-1],[1,1],[0,-1],[1,-4],[0,-6],[1,-7],[0,-9],[-1,-6],[-10,-2],[-1,-5],[-6,-6],[-1,-4],[-1,-1],[1,-12],[2,-2],[7,11],[10,-3],[1,-4],[1,-13],[1,-5],[4,-10],[-1,-6],[0,-4],[-1,-2],[-1,0],[-1,2],[0,1],[0,-1],[-1,-3],[-1,1],[0,3],[-1,1],[0,-4],[-1,-6],[0,-4],[-2,-4],[0,-3],[-1,-6],[1,-4],[0,-2],[10,11],[1,-2],[1,1],[2,5],[3,-4],[0,1],[2,6],[1,5],[1,0],[1,-3],[1,-4],[0,-1],[2,1],[1,-3],[1,-11],[1,-5],[0,-1],[0,-12],[7,-17],[1,-3],[0,-4],[0,-2],[1,-1],[0,1],[1,5],[0,1],[0,-2],[1,-3],[0,-3],[0,-2],[2,-3],[1,-2],[2,-15],[0,-3],[1,-2],[1,-2],[1,-7],[1,0],[0,-1],[0,-3],[0,-2],[-1,-3],[1,-1],[0,-5],[1,-2],[1,-2],[1,0],[3,5],[2,-1],[0,-4],[3,-13],[0,-3],[0,-2],[1,-1],[2,5],[0,-7],[0,-4],[1,-7],[0,-5],[1,-5],[0,-4],[1,-1],[1,1],[1,-6],[1,0],[1,2],[0,2],[1,4],[-1,3],[0,5],[0,5],[1,1],[0,5],[1,10],[1,7],[-1,35],[0,6],[-2,14],[0,5],[-1,5],[0,13],[0,4],[1,3],[1,0],[0,-2],[1,-16],[0,-3],[1,0],[0,-1],[1,-6],[0,-11],[2,-14],[1,-11],[1,-19],[1,-4],[1,-8],[2,-28],[0,-6],[0,-2],[4,-7],[-1,-4],[1,-7],[0,-5],[1,-2],[1,-2],[-1,-3],[0,-5],[1,-5],[0,-4],[0,-4],[1,-3],[1,-1],[0,-9],[-1,-6],[-2,-9],[-2,-16],[-1,-3],[-2,0],[-1,-3],[-1,-6],[0,-4],[0,-2],[0,-1],[-1,0],[0,3],[-1,4],[0,11],[1,0],[0,2],[0,3],[-2,15],[-1,4],[-1,3],[0,3],[0,3],[-1,5],[0,3],[-1,6],[0,5],[-1,-7],[-2,-17],[-3,-20],[3,-3],[0,-4],[0,-9],[-1,-8],[0,-6],[-1,-6],[-1,-2],[-2,6],[0,2],[0,-4],[0,-4],[0,-4],[-1,-3],[2,-7],[-1,-2],[0,-2],[0,-3],[0,-3],[0,-3],[-1,-7],[0,-4],[0,-3],[0,-2],[-1,-3],[0,-1],[-1,1],[-1,-2],[-1,-7],[-1,-1],[-1,-1],[-1,-3],[0,-9],[0,1],[1,-2],[0,-2],[0,-2],[2,-2],[1,-1],[0,-3],[0,-1],[1,0],[1,-3],[1,1],[-1,-7],[-3,-30],[-1,-6],[1,-5],[2,1],[3,8],[0,3],[1,10],[1,4],[3,11],[1,0],[0,-2],[0,-13],[1,-1],[0,-1],[0,-3],[0,-9],[0,-4],[1,-5],[0,-2],[-1,-3],[0,-5],[0,-4],[0,-4],[-1,-10],[0,-17],[0,-8],[-1,-5],[-1,-4],[-2,-1],[-1,2],[-1,4],[-3,9],[-1,2],[-1,4],[-1,2],[-3,-1],[-1,2],[0,1],[-1,2],[-1,9],[0,3],[-1,1],[0,-1],[-1,-4],[0,-1],[0,1],[-4,14],[-1,2],[-2,-7],[-5,1],[-12,43],[0,-2],[-1,-6],[-2,-2],[-5,6],[-3,-1],[8,-35],[8,-34],[1,-2],[11,2],[1,-7],[1,-7],[0,-3],[1,-5],[0,-2],[0,-3],[0,-3],[2,-6],[0,-2],[1,1],[1,5],[2,2],[1,0],[6,-16],[1,-8],[-2,-22],[-2,-18],[-1,-5],[-1,-2],[0,-9],[0,-4],[-1,-3],[-2,-12],[0,-2],[0,-10],[0,-2],[0,-3],[0,-1],[1,-12],[-1,-7],[0,-5],[-1,-4],[-4,-6],[-1,0],[0,1],[0,3],[-1,3],[0,3],[0,1],[-2,-1],[-3,-8],[2,-10],[0,-19],[0,-20],[-1,-9],[-3,3],[-2,-2],[-1,3],[0,8],[-1,0],[-1,1],[0,5],[0,1],[0,2],[0,1],[-1,6],[0,5],[0,5],[1,5],[1,4],[0,2],[0,4],[0,1],[1,1],[1,1],[-1,6],[-1,1],[-3,-5],[-1,-5],[0,-2],[-1,0],[-1,2],[0,3],[0,2],[0,2],[1,0],[0,7],[-1,2],[-2,-1],[-1,2],[0,4],[-2,12],[0,4],[-4,13],[-1,1],[-1,-1],[-1,-6],[1,-13],[1,-14],[1,-12],[0,-8],[-1,-7],[0,-4],[-1,-2],[-1,1],[-1,6],[-1,3],[0,-1],[-1,-4],[0,-1],[-1,0],[-2,11],[-1,1],[-1,-1],[-1,-4],[-1,-1],[-1,3],[-1,-1],[-2,-6],[0,-2],[-2,1],[-1,2],[-1,10],[-1,-1],[-2,-7],[-1,-3],[-9,-2],[-3,9],[-1,1],[0,12],[-1,13],[-1,5],[-1,4],[-3,9],[-6,8],[-1,6],[-1,9],[1,11],[0,5],[-1,0],[-2,-6],[-3,0],[0,-1],[-1,-3],[1,-6],[0,-6],[1,-10],[1,-3],[1,-3],[2,-11],[6,-13],[0,-7],[0,-6],[-1,-5],[0,-1],[1,-14],[1,-9],[1,-6],[1,-5],[-3,-36],[1,-13],[1,4],[3,19],[1,8],[4,8],[6,-7],[-1,-3],[0,-5],[0,-3],[1,-3],[3,3],[14,-18],[-5,-4],[-4,4],[1,-8],[1,-7],[2,-10],[-1,-5],[-1,0],[-5,9],[-1,6],[0,1],[-1,-2],[-1,3],[-1,1],[-3,-4],[-1,-2],[0,-2],[0,-6],[1,-3],[1,-3],[-2,-8],[1,-2],[1,2],[1,-2],[1,-3],[2,-4],[-1,-7],[-2,-3],[-1,1],[-3,12],[-4,11],[-1,-1],[2,-12],[0,-5],[-1,-11],[0,-7],[-1,-2],[-2,4],[-1,0],[0,-1],[-1,-2],[0,-5],[0,-2],[-1,1],[0,3],[0,2],[0,3],[0,2],[0,3],[0,2],[-1,1],[1,6],[-1,9],[-1,3],[-1,-2],[-2,-9],[0,-6],[0,-8],[-1,-7],[0,-3],[-1,0],[-3,3],[0,-1],[0,-1],[0,-2],[-1,1],[0,2],[-1,7],[-5,25],[-2,3],[-1,-4],[0,-8],[3,-17],[-2,-2],[-7,2],[-2,-4],[0,-7],[1,-3],[4,-5],[6,-17],[-1,-3],[0,-3],[0,-2],[-1,-1],[2,-1],[2,-2],[0,-6],[0,-2],[-1,-9],[-1,-2],[0,1],[-1,1],[0,-1],[0,-3],[0,-7],[0,-3],[-1,-3],[0,-2],[-3,2],[-1,-2],[-1,-5],[-1,-1],[-7,12],[-2,-3],[1,-10],[1,-6],[3,-7],[0,-2],[-2,-2],[0,-2],[-1,-6],[-1,-2],[-2,1],[-2,4],[-6,2],[-2,12],[0,10],[1,17],[0,12],[0,2],[0,3],[0,2],[0,2],[0,5],[0,2],[-1,12],[0,5],[1,7],[0,7],[0,4],[-1,4],[0,2],[-1,4],[0,5],[-1,13],[0,12],[0,5],[-2,15],[-1,2],[4,20],[2,3],[3,1],[-1,4],[-2,2],[-1,0],[-2,-3],[-3,-14],[-1,-5],[-2,0],[-10,21],[-1,-2],[-2,-13],[1,-10],[2,-6],[1,-3],[3,2],[2,-1],[2,-5],[1,-8],[0,-8],[0,-14],[1,-16],[0,-9],[0,-20],[-1,-8],[0,-5],[-1,-3],[-1,0],[-1,-3],[-1,-7],[0,-9],[-1,-7],[2,-9],[1,-2],[1,0],[0,-3],[0,-4],[0,-5],[1,-5],[0,-3],[2,-6],[-2,-11],[0,-3],[0,-5],[1,-2],[2,-7],[1,-1],[1,1],[-1,10],[3,-12],[4,-7],[-1,-3],[2,-7],[-1,-4],[-1,-1],[-1,-1],[-3,-3],[-1,1],[0,2],[0,8],[0,2],[-5,6],[-2,12],[-6,13],[-2,1],[-1,-2],[-2,-5],[1,-2],[2,-3],[2,-7],[0,-2],[0,-4],[0,-7],[2,6],[0,-6],[0,-5],[0,-4],[1,-1],[0,2],[1,7],[1,2],[0,-2],[1,-6],[1,-9],[1,-8],[-2,-4],[1,-4],[0,-2],[1,-1],[0,-4],[-1,-2],[-1,-2],[2,-9],[-1,-13],[2,-6],[4,-7],[0,-3],[1,-5],[0,-4],[0,-8],[0,-2],[1,-2],[0,-3],[0,-4],[-1,-1],[1,-4],[1,-12],[0,-4],[1,-3],[1,-2],[0,-3],[0,-5],[1,-3],[0,-3],[0,-3],[4,-4],[1,-5],[0,-13],[0,-8],[0,-18],[-1,-7],[0,-4],[-1,2],[-1,11],[-3,19],[-2,7],[-1,-2],[-1,-5],[0,-3],[-1,-1],[-2,0],[-1,-3],[-1,1],[0,-1],[-2,-6],[-1,1],[0,3],[-1,1],[-5,-2],[-1,3],[-1,-1],[-1,1],[0,2],[-3,18],[-1,2],[-1,0],[-5,-16],[-5,-3],[1,-9],[-4,-11],[-1,-3],[-2,4],[-1,-1],[-1,3],[0,4],[0,4],[0,5],[0,9],[0,9],[0,9],[0,5],[-1,7],[-1,2],[-1,-3],[0,9],[0,16],[0,8],[0,7],[-1,1],[-1,-2],[-2,-7],[-3,-13],[-1,-4],[-1,0],[-1,1],[-2,0],[0,-1],[0,-2],[-1,-3],[0,-3],[1,-3],[2,0],[0,-3],[1,-9],[0,-7],[1,-14],[-1,-15],[-1,-2],[-1,-5],[-2,-17],[0,-4],[0,-6],[0,-4],[-1,-3],[-1,2],[0,9],[-1,20],[-1,4],[0,1],[-1,-1],[0,-1],[-1,-1],[-1,2],[0,-11],[0,-5],[0,-4],[0,-2],[-1,-2],[0,-2],[0,-2],[0,-6],[-1,-3],[-1,-6],[-4,-6],[1,-6],[0,-4],[0,-3],[1,-1],[-1,-12],[-1,-8],[-1,-5],[-1,-2],[-1,2],[-2,9],[-1,-1],[1,-5],[2,-9],[0,-13],[1,-8],[1,-3],[4,-2],[2,-4],[1,-7],[-1,-8],[-1,-5],[-3,0],[1,-4],[0,-2],[1,-1],[-1,-10],[-1,-5],[-2,-2],[1,-7],[0,-6],[1,-3],[0,-2],[1,-5],[0,-7],[-1,-7],[0,-5],[-2,-5],[-8,-11],[-6,4],[-3,8],[-1,3],[-1,8],[-1,3],[0,2],[-1,0],[-3,-4],[-2,-5],[0,-5],[-1,-11],[-1,-5],[-2,-3],[-13,0],[-2,-5],[-1,-1],[-1,-2],[-1,-10],[-3,-9],[-3,-4],[1,-7],[8,-10],[2,2],[3,13],[10,-1],[10,0],[10,0],[1,-4],[1,-15],[1,-5],[0,-7],[0,-9],[1,-8],[-1,-5],[-4,2],[-2,-2],[-1,-11],[1,-3],[0,-3],[1,-1],[3,1],[0,-2],[0,-5],[0,-5],[0,-3],[0,-2],[1,-2],[0,-4],[0,-2],[0,-1],[1,0],[0,-1],[1,-6],[0,-1],[4,-7],[0,1],[1,0],[0,-2],[0,-6],[0,-4],[0,-1],[1,-1],[1,1],[0,1],[1,-1],[0,-4],[6,-11],[2,-10],[0,-5],[-2,-5],[0,-5],[0,-1],[-1,-1],[0,-2],[1,-4],[0,-2],[-1,-2],[0,-2],[-1,-2],[-5,2],[0,-1],[-1,-4],[0,-3],[1,-3],[0,-1],[1,0],[0,-1],[3,-12],[0,-4],[-1,-9],[1,-2],[0,-5],[1,-11],[-3,-6],[-7,11],[1,-5],[3,-8],[-2,-4],[-1,1],[-1,4],[-1,5],[0,-1],[-2,-6],[1,-5],[3,-5],[0,-6],[-2,-2],[-3,2],[-2,-3],[-2,-5],[0,-11],[1,0],[0,-1],[1,-4],[0,-11],[2,-2],[2,-7],[1,0],[2,14],[1,5],[3,2],[0,-1],[1,-1],[0,-2],[0,-2],[0,-1],[3,1],[1,-1],[1,-3],[0,-5],[0,-9],[0,-5],[-1,-3],[-1,1],[0,-1],[0,-3],[1,-14],[2,-13],[2,-14],[-2,-18],[-3,-17],[-1,-3],[-3,6],[-1,-5],[0,-1],[0,-2],[1,-1],[-1,-2],[-1,0],[0,-2],[-1,-7],[0,-2],[0,-1],[-1,-13],[1,-4],[1,-2],[7,3],[2,-6],[1,-3],[2,-11],[0,-4],[1,-13],[0,-5],[0,-6],[-1,-3],[0,-4],[-1,-6],[0,-4],[0,-3],[-1,0],[-2,5],[0,1],[-1,0],[-2,2],[-2,0],[-5,-25],[3,-2],[1,-4],[-1,-7],[-7,-5],[7,-3],[-1,-5],[-1,-3],[-2,-1],[1,-8],[1,-1],[4,4],[1,0],[1,-8],[1,-1],[3,4],[3,-1],[2,2],[2,-2],[2,-8],[0,-7],[-1,-7],[2,-8],[1,-5],[0,-7],[1,-5],[2,-2],[1,-4],[1,-4],[0,-9],[0,-4],[1,-2],[1,-2],[0,-4],[1,-10],[0,-4],[1,-3],[0,-4],[0,-6],[0,-6],[0,-5],[1,-5],[1,-4],[1,-2],[2,-1],[0,-2],[1,-6],[0,-3],[1,0],[1,0],[-2,-6],[2,-10],[0,-6],[0,-8],[-1,-3],[-7,-7],[-1,-7],[4,-9],[2,-7],[-2,-11],[-2,-5],[-4,-2],[3,-16],[0,-1],[10,8],[0,-2],[0,-2],[1,-2],[8,-23],[-1,-9],[-2,-2],[-4,4],[-4,-5],[-4,-11],[1,-10],[2,0],[2,6],[9,1],[9,1],[0,-4],[1,-3],[0,-5],[0,-8],[-1,-2],[0,-23],[-1,-11],[-2,-3],[-2,-1],[1,-4],[0,-3],[1,-4],[0,-8],[-1,-4],[-2,-3],[-3,-12],[-5,-9],[-4,-17],[-1,-2],[3,-2],[5,6],[2,-4],[5,-18],[2,-1],[1,-2],[1,-10],[1,-1],[2,-2],[1,2],[3,10],[9,12],[1,3],[0,9],[1,4],[1,3],[0,2],[1,0],[-1,4],[-1,5],[2,17],[2,10],[3,21],[1,2],[1,0],[1,-2],[1,-3],[1,-4],[0,-4],[1,-6],[0,-9],[-1,-7],[0,-5],[-7,-21],[0,-4],[3,-5],[1,-6],[2,-4],[3,0],[0,-2],[1,-3],[1,-7],[0,-6],[0,-5],[0,-1],[0,-2],[1,-1],[-1,-4],[0,-2],[-2,-4],[2,-12],[1,-7],[10,-17],[6,-1],[6,-11],[12,2],[2,-3],[1,-6],[3,-25],[0,-8],[1,-8],[-1,-7],[0,-4],[-2,-5],[-2,-4],[-7,-1],[-8,-1],[-3,9],[-1,9],[-5,24],[-3,7],[-9,1],[-9,0],[0,-3],[0,-2],[1,-1],[0,-1],[-5,-7],[-13,1],[-12,0],[-9,-28],[-3,0],[3,-7],[-1,-2],[-2,2],[-1,-1],[0,-2],[-1,-6],[0,-1],[-2,0],[-5,7],[-2,-2],[0,-1],[0,-3],[0,-1],[0,-2],[0,-1],[-1,0],[0,-2],[0,-4],[0,-2],[-2,-5],[0,1],[-1,13],[0,3],[-1,-2],[0,-2],[-1,0],[-3,4],[-1,0],[-2,-4],[-1,0],[-1,2],[0,1],[-1,-3],[-1,-6],[-1,-10],[0,-3],[-1,-2],[-1,-2],[0,-1],[0,-2],[0,-4],[0,-5],[0,-3],[0,-7],[0,-1],[0,-3],[-3,-12],[-1,-5],[-2,-2],[-2,0],[-1,4],[0,8],[-1,5],[-2,1],[0,5],[0,4],[0,5],[0,4],[0,3],[2,12],[-2,5],[-1,0],[-3,-5],[-5,12],[-1,4],[-1,10],[-3,14],[0,1],[-2,1],[-1,5],[-3,16],[1,3],[1,16],[1,6],[1,4],[-1,8],[-1,6],[-1,-3],[-1,-7],[-1,-3],[-3,5],[-1,0],[-2,-3],[0,-2],[0,-6],[-1,-3],[-3,-11],[1,-4],[0,-7],[1,-10],[0,-9],[1,-4],[0,-4],[1,-11],[0,-3],[2,-6],[-1,-8],[0,-4],[0,-3],[0,-4],[3,1],[1,-1],[1,-3],[1,-8],[0,-7],[-1,-2],[-2,-2],[4,-13],[1,-3],[0,-3],[0,-4],[1,-4],[1,-4],[1,-12],[4,-24],[-8,0],[-8,17],[0,10],[-1,6],[-1,5],[-1,12],[-1,2],[-2,0],[0,-1],[-1,-2],[0,-3],[0,-2],[-1,-1],[-6,3],[6,-10],[-1,-5],[0,-4],[-1,-5],[0,-15],[-1,-4],[-1,-1],[-10,9],[1,-13],[-1,-7],[-9,-25],[3,-10],[0,-2],[0,-5],[0,-2],[1,-5],[0,-6],[-1,-4],[-1,-2],[0,-9],[1,-3],[3,0],[2,-3],[2,-7],[-1,-6],[-1,-3],[-1,-4],[0,-5],[1,-4],[1,-5],[7,-3],[2,-4],[0,-12],[0,-2],[-8,5],[-1,6],[-2,0],[-3,-5],[-1,-4],[-1,-7],[0,-6],[-1,-3],[-5,-6],[0,-2],[-2,-8],[-1,-3],[-1,0],[-13,18],[1,-4],[0,-2],[1,-3],[1,-3],[0,-5],[0,-5],[0,-4],[0,-5],[1,-3],[1,-3],[2,-8],[0,-1],[13,7],[14,8],[-2,-11],[-10,-21],[-9,-20],[-8,-3],[-4,-9],[-4,-4],[1,-2],[2,0],[1,-3],[-1,-7],[-1,-3],[-2,-4],[4,-12],[5,-5],[4,1],[10,20],[1,0],[2,-12],[5,-5],[5,-14],[1,-1],[13,27],[4,-8],[0,-4],[-1,-8],[-1,-4],[-12,-17],[-12,-18],[-12,-18],[-12,-17],[-12,-18],[-12,-17],[0,-14],[-2,-9],[-7,-14],[-7,-13],[-1,-5],[0,-8],[2,-3],[8,-2],[0,-1],[1,-5],[12,6],[12,7],[12,6],[12,7],[12,6],[1,-1],[1,-4],[1,-4],[0,-3],[1,-7],[0,-2],[0,-2],[1,1],[1,-1],[1,-3],[1,-14],[-1,-8],[-2,0],[-8,18],[-2,-1],[1,-12],[1,-5],[1,-2],[-1,-6],[-8,-8],[-7,-7],[-1,2],[-3,11],[0,1],[-4,-6],[-1,-1],[2,-12],[0,-12],[1,-3],[11,-10],[8,12],[8,11],[3,-3],[4,-9],[1,1],[0,2],[1,0],[1,-3],[0,-9],[0,-3],[-1,-1],[0,-1],[-1,-3],[0,-9],[0,-3],[-1,-3],[-2,-6],[9,-9],[-3,-6],[-10,2],[-10,3],[-10,2],[-3,-5],[-9,2],[-4,8],[-2,-4],[1,-3],[0,-1],[1,-2],[0,-3],[-2,-9],[0,-4],[0,-3],[7,8],[11,-7],[12,-6],[0,-2],[0,-4],[0,-2],[8,-8],[-5,-11],[0,2],[-1,3],[-1,0],[1,-7],[1,-2],[4,4],[1,-1],[1,-7],[0,-7],[-10,-5],[1,-7],[1,-4],[0,-1],[-1,-1],[0,-1],[2,-7],[4,-10],[-1,-9],[-6,2],[6,-13],[1,-5],[0,-6],[-1,-3],[-5,2],[8,-11],[6,2],[1,-9],[-6,-8],[-11,11],[-11,11],[1,-6],[1,-4],[2,-5],[0,-4],[2,-9],[1,-2],[7,-8],[-1,-3],[-5,0],[-1,-4],[0,-8],[-2,-7],[1,-4],[2,0],[2,6],[11,6],[5,-9],[-2,-11],[-1,-2],[-3,-2],[1,-4],[-1,-7],[1,-3],[1,1],[3,6],[12,9],[2,-10],[-1,-9],[-1,-4],[-12,-20],[8,-4],[8,-4],[-1,-2],[-2,-2],[2,-7],[12,-5],[-1,-3],[-1,-2],[2,-4],[6,-7],[7,-7],[0,-2],[0,-4],[0,-2],[2,-3],[-3,-2],[1,-2],[1,-5],[2,-1],[1,-2],[-6,-14],[2,-4],[-3,-5],[-3,0],[1,-5],[0,-3],[1,-1],[9,5],[3,-4],[0,1],[0,3],[0,1],[1,7],[1,2],[2,-1],[1,-7],[2,-3],[1,-5],[2,-7],[-2,-5],[-2,-2],[-7,2],[-1,-1],[-2,-7],[1,-4],[6,3],[1,-2],[1,-5],[3,-2],[-1,-3],[-1,-1],[-2,1],[5,-17],[5,-8],[-1,-2],[0,-3],[10,-18],[0,-3],[-3,-1],[2,-6],[6,-3],[-1,-4],[-3,-2],[8,-14],[-1,-9],[-1,-5],[-13,-10],[-12,-9],[-13,-9],[-13,-9],[-12,-10],[-13,-9],[-13,-9],[2,-10],[1,-8],[2,-6],[1,-3],[11,1],[11,0],[11,1],[11,0],[2,6],[1,0],[6,-3],[5,-15],[4,-5],[1,1],[0,7],[1,2],[8,-10],[-1,11],[-2,10],[-5,12],[4,7],[13,10],[12,10],[13,10],[2,-6],[4,-8],[10,-4],[3,-14],[2,-11],[1,-4],[3,-5],[-1,-5],[-1,-3],[-1,-3],[0,-11],[-2,-5],[-1,-3],[-1,1],[2,-9],[10,-8],[10,-8],[2,3],[1,0],[9,-20],[-2,-14],[-1,-2],[1,-1],[0,-1],[1,-5],[1,-3],[0,-1],[1,0],[9,8],[11,-20],[1,-4],[1,-5],[-1,-5],[-4,-13],[0,-1],[6,-9],[-1,-7],[0,-2],[-8,-1],[1,-5],[10,-4],[0,-5],[-1,-5],[0,-3],[0,-2],[3,-5],[2,-6],[1,-1],[2,2],[5,11],[4,18],[2,3],[13,-13],[1,-2],[0,-1],[0,-2],[-1,-3],[0,-2],[0,-9],[2,-5],[3,-8],[1,-5],[2,-13],[-1,-8],[-1,-4],[-1,-3],[-10,1],[-9,2],[3,-14],[10,-3],[-1,-5],[-3,-7],[-7,6],[-7,6],[-1,-1],[-2,-5],[-1,-2],[-7,11],[-7,11],[-7,-3],[1,-6],[1,-3],[13,-13],[14,-14],[-3,-7],[1,-8],[2,-3],[3,-3],[4,5],[1,-4],[1,0],[3,4],[1,-1],[1,-4],[2,-7],[0,-2],[1,-1],[10,10],[10,11],[0,-1],[1,-3],[0,-3],[0,-3],[0,-2],[0,-5],[-1,-7],[0,-5],[1,-4],[1,-5],[3,-1],[0,1],[1,4],[0,4],[0,2],[1,1],[-1,6],[0,2],[1,6],[0,2],[13,-12],[-1,-3],[0,-3],[0,-2],[1,-1],[0,-1],[0,-4],[0,-1],[1,-5],[2,-7],[5,-3],[1,1],[0,2],[0,6],[1,1],[8,4],[0,1],[0,3],[0,3],[0,1],[2,1],[10,-7],[2,-6],[4,-2],[2,-7],[2,-2],[1,-2],[-2,-6],[-2,-3],[-7,-1],[-7,-1],[1,-3],[0,-1],[2,0],[-2,-6],[1,-2],[9,5],[11,-11],[0,-2],[2,-6],[5,-3],[-1,-5],[-1,-2],[-1,-1],[5,-5],[-1,-4],[-1,-3],[-2,-3],[3,-10],[3,-1],[7,14],[13,3],[11,-15],[2,-6],[0,-2],[0,-4],[0,-1],[3,-3],[6,4],[3,-5],[-2,-9],[-10,-22],[3,-8],[12,2],[1,3],[0,1],[1,-1],[0,-1],[1,-4],[0,-1],[10,6],[9,6],[9,5],[5,-13],[8,-11],[-1,-9],[-6,-10],[3,-8],[0,-1],[11,8],[13,-8],[13,-8],[13,-9],[13,-8],[2,-5],[-2,-2],[2,-5],[7,-4],[7,-4],[1,-2],[1,-7],[1,0],[5,9],[3,-1],[-3,-12],[2,-8],[2,-2],[6,5],[3,-4],[13,-5],[11,-24],[1,-5],[-2,-7],[-3,-3],[3,-7],[-9991,-7]],[[3456,9113],[2,-7],[1,-1],[-1,-1],[0,-2],[-1,-3],[0,-3],[3,-10],[0,2],[0,2],[1,2],[0,1],[6,-5],[1,-2],[1,-4],[1,-9],[1,-12],[-1,-13],[-1,-8],[-2,-5],[-2,-1],[-2,2],[-3,8],[-2,2],[-2,-4],[-1,1],[-5,17],[0,-6],[0,-2],[0,-4],[0,-2],[-1,0],[0,1],[0,1],[-1,2],[0,3],[0,3],[-1,1],[0,-1],[0,-2],[0,-2],[0,-3],[-1,-3],[0,-5],[-2,2],[-1,-4],[0,-7],[-2,-7],[-4,-6],[-1,-4],[-1,-6],[-1,-1],[-1,0],[-1,3],[-1,1],[0,2],[0,3],[0,5],[-1,2],[0,2],[0,1],[-1,2],[0,3],[0,7],[1,6],[2,5],[-1,6],[0,1],[1,13],[2,9],[3,13],[8,15],[7,0],[2,5],[2,1]],[[3331,9309],[0,-4],[0,-6],[1,-12],[0,-4],[1,-1],[5,6],[-9,-35],[0,-4],[-3,-9],[-1,-1],[-1,5],[0,1],[0,1],[1,15],[0,4],[-1,1],[-1,-4],[-1,-5],[-1,-4],[1,13],[0,4],[0,1],[1,1],[0,1],[1,8],[0,2],[-2,6],[-6,-10],[-2,8],[-1,1],[-1,-3],[0,-4],[0,-5],[0,-3],[-2,-5],[-6,-4],[-2,2],[-1,5],[0,8],[0,7],[0,5],[-1,3],[1,4],[4,-8],[1,-2],[2,4],[2,6],[0,3],[0,2],[1,2],[-1,4],[0,3],[0,2],[-1,1],[1,10],[1,6],[0,6],[2,-11],[0,-2],[0,-1],[0,-2],[0,-2],[0,-1],[1,-8],[1,-6],[1,-2],[3,-2],[1,3],[1,7],[1,-2],[2,1],[1,3],[2,5],[1,6],[0,4],[1,4],[0,8],[0,1],[1,-6],[1,-6],[0,-1],[1,-5],[1,-4],[-2,-9]],[[3392,9517],[1,-2],[4,9],[1,1],[0,-1],[0,-3],[0,-4],[0,-4],[0,-3],[0,-2],[-1,-1],[0,-2],[0,-3],[1,-5],[1,-4],[0,-4],[1,-2],[-5,6],[-1,0],[0,-2],[-1,-5],[-2,-13],[-1,-4],[-1,0],[-4,8],[-1,-1],[0,-2],[0,-2],[0,-3],[0,-4],[0,-3],[-1,-2],[0,-2],[0,-3],[1,-3],[1,-4],[0,-5],[-1,-4],[-2,-5],[-1,0],[-1,2],[0,4],[-1,8],[-1,6],[0,2],[0,4],[0,1],[1,0],[1,1],[1,6],[-1,2],[-1,0],[-1,-3],[-1,0],[-1,4],[0,1],[-1,0],[0,-1],[-1,-3],[1,-4],[1,-2],[0,-5],[-1,-4],[0,-4],[-4,-11],[0,-3],[1,-1],[0,-1],[1,1],[3,7],[0,-9],[0,-6],[0,-3],[-4,-12],[-1,1],[0,7],[-1,1],[-2,-5],[-1,4],[0,2],[1,2],[0,2],[0,1],[-2,3],[0,1],[0,1],[1,3],[0,1],[-1,2],[0,1],[-4,-8],[0,-2],[0,-4],[0,-5],[-1,0],[-1,2],[1,12],[1,9],[7,36],[0,4],[0,2],[0,1],[0,2],[0,2],[0,3],[0,1],[1,1],[6,13],[0,2],[0,2],[0,4],[0,2],[1,1],[1,-1],[1,-4],[3,-4],[2,3],[3,13],[1,3],[4,-11]],[[3470,9803],[3,-4],[9,0],[-1,-2],[-1,-9],[0,-3],[-1,-2],[-8,-1],[-1,-1],[0,-3],[0,-2],[0,-5],[0,-3],[-1,-2],[-1,-1],[0,-2],[0,-6],[-1,-9],[-1,-4],[-1,0],[-1,4],[-2,10],[0,7],[-1,9],[1,7],[0,1],[0,1],[0,4],[-2,6],[-1,3],[1,11],[1,4],[9,-8]],[[3763,9945],[2,-9],[-2,-4],[0,-2],[0,-6],[-1,-3],[-2,-1],[-2,2],[-1,-2],[0,-8],[0,3],[-2,8],[-1,2],[0,1],[0,4],[0,1],[1,-5],[1,-1],[1,3],[1,0],[0,1],[0,1],[0,4],[0,3],[0,8],[1,-3],[1,-8],[1,0],[0,3],[0,1],[1,0],[0,3],[0,2],[1,2]],[[3749,9934],[0,-1],[-1,1],[0,2],[-1,5],[0,1],[1,4],[0,4],[0,10],[0,-1],[1,-8],[0,-1],[0,-4],[0,-3],[0,-3],[0,-1],[0,-2],[1,-1],[-1,-2]],[[3731,9996],[3,-10],[2,3],[1,-3],[2,-8],[0,-6],[0,-6],[1,-5],[0,-1],[2,2],[2,-3],[0,-6],[0,-1],[1,-4],[0,-5],[1,-2],[-1,2],[0,-1],[-1,-5],[1,-5],[1,-8],[-1,0],[0,1],[-2,6],[-1,8],[0,3],[-1,2],[-1,1],[0,1],[0,1],[0,3],[-1,1],[-1,3],[0,1],[-1,-2],[-1,1],[-1,2],[-2,1],[-2,-3],[-1,1],[-1,7],[0,4],[0,1],[0,1],[0,4],[-1,4],[-1,-1],[-3,-12],[-1,-1],[-1,1],[0,1],[0,2],[0,2],[0,2],[0,2],[0,3],[0,2],[0,2],[0,2],[0,2],[1,0],[0,-1],[0,11],[0,2],[1,1],[2,-8],[0,1],[1,3],[1,1],[0,-1],[1,2],[0,1],[0,2],[0,1],[0,1],[1,0],[1,-3]],[[311,2301],[-1,-4],[-13,7],[-14,8],[0,1],[0,2],[-1,7],[0,2],[-14,24],[-14,24],[-13,24],[-14,24],[-2,8],[2,5],[13,-18],[13,-19],[13,-18],[13,-19],[13,-19],[13,-18],[3,-12],[3,-4],[0,-5]],[[611,2680],[-2,-2],[-1,3],[1,3],[0,1],[1,2],[-1,10],[-1,4],[-8,14],[-8,30],[-9,30],[0,10],[0,3],[1,0],[2,-1],[7,-17],[7,-16],[1,-2],[0,-5],[0,-1],[2,-9],[1,-8],[9,-22],[2,-1],[1,-1],[0,-5],[-3,-16],[-2,-4]],[[724,3389],[1,-5],[-1,-6],[-5,1],[-7,2],[1,2],[1,3],[-2,3],[-1,-1],[-1,2],[0,2],[0,4],[0,2],[-2,5],[-13,12],[-1,5],[0,7],[-13,13],[-5,13],[0,1],[0,2],[1,2],[1,1],[12,-17],[11,-18],[12,-17],[11,-18]],[[676,3458],[-4,-6],[-1,2],[0,6],[1,7],[0,2],[2,1],[4,-5],[-1,-4],[-1,-3]],[[468,3480],[1,-2],[11,-17],[0,-2],[1,-5],[-1,-7],[-2,-2],[-8,7],[-8,8],[-1,5],[3,1],[1,4],[3,0],[2,-5],[1,2],[0,3],[-1,1],[-2,6],[0,3]],[[4105,3520],[0,-2],[0,-5],[0,-5],[1,-2],[1,0],[-1,-2],[-9,-2],[-3,4],[2,3],[1,3],[0,1],[-1,0],[-1,5],[1,1],[1,-1],[1,1],[0,1],[0,2],[0,3],[0,4],[0,1],[1,3],[0,1],[0,4],[0,2],[-1,2],[0,2],[1,1],[2,5],[2,3],[2,1],[8,-14],[0,-4],[0,-9],[-1,-4],[-7,-3]],[[3119,3688],[0,-4],[0,1],[3,-1],[-8,-8],[-8,-8],[-1,5],[5,12],[9,5],[0,-2]],[[2903,3777],[-1,-1],[-1,0],[-1,4],[-1,3],[-1,4],[0,8],[1,7],[0,7],[1,4],[2,7],[2,2],[1,-4],[0,-1],[-1,-6],[-1,-3],[0,-5],[0,-1],[-1,-3],[0,-3],[0,-3],[0,-3],[1,-5],[0,-4],[0,-4]],[[3631,4113],[-3,-3],[-1,1],[-1,5],[1,3],[2,8],[10,16],[4,13],[1,2],[1,0],[0,-3],[0,-1],[-13,-39],[-1,-2]],[[862,4246],[-1,0],[-6,8],[1,3],[-1,1],[0,2],[3,5],[1,1],[7,-9],[-2,-5],[-2,-6]],[[854,4305],[1,-3],[0,-2],[0,-2],[0,-1],[0,-3],[8,-12],[0,-4],[0,-3],[-1,-1],[-12,5],[-5,14],[-3,13],[1,3],[1,0],[1,-4],[1,1],[0,-1],[0,3],[-2,5],[3,3],[5,-3],[2,-5],[0,-3]],[[820,4292],[1,-1],[3,1],[-1,-4],[0,-3],[-1,-2],[0,-1],[-3,-1],[-9,10],[-9,9],[-9,9],[-1,3],[0,5],[1,3],[0,1],[10,14],[4,-2],[12,-31],[1,-8],[1,-2]],[[748,4320],[-1,-1],[-9,11],[-1,7],[1,3],[9,-1],[1,-4],[0,-3],[1,-5],[0,-1],[0,-1],[-1,-1],[0,-1],[0,-3]],[[907,4322],[-1,-1],[-2,3],[0,1],[0,2],[-1,2],[0,1],[0,1],[0,3],[0,2],[-3,7],[0,3],[1,7],[1,1],[8,-9],[1,-8],[0,-1],[-4,-6],[1,-1],[0,-2],[0,-1],[-1,-4]],[[721,4362],[-4,-6],[-9,7],[-1,3],[0,1],[0,1],[0,1],[0,1],[0,5],[1,3],[2,6],[4,3],[5,-5],[2,-6],[0,-1],[0,-2],[0,-2],[0,-6],[0,-3]],[[9637,4421],[-3,-3],[0,3],[0,5],[0,4],[0,3],[0,1],[2,-2],[1,-2],[0,-4],[0,-5]],[[875,4408],[-12,-9],[-9,11],[0,3],[-1,6],[0,1],[1,3],[0,2],[-1,4],[0,3],[0,4],[0,3],[2,4],[10,-8],[9,-9],[2,-8],[1,0],[-1,-6],[-1,-4]],[[840,4445],[0,-11],[2,-4],[7,-30],[0,-1],[0,-2],[-1,-3],[0,-2],[1,-2],[0,-2],[0,-3],[0,-3],[3,-2],[1,-4],[2,-7],[-1,-5],[-2,-3],[-11,4],[-3,2],[1,4],[0,2],[-2,2],[-8,2],[-7,1],[-5,18],[-5,10],[-1,6],[0,4],[1,3],[3,9],[7,7],[-1,4],[0,4],[-1,3],[1,2],[1,2],[0,-1],[0,-9],[12,13],[4,-3],[2,-5]],[[938,4447],[0,-2],[0,-1],[0,-1],[1,-1],[0,-1],[1,-9],[0,-2],[0,-2],[1,-2],[0,-3],[-1,0],[-3,6],[-1,3],[-1,6],[0,1],[1,2],[-1,0],[0,3],[-1,2],[-1,-1],[0,-1],[0,-1],[0,-3],[0,-1],[0,-1],[0,-3],[0,-1],[0,-2],[-2,-6],[-13,-20],[-2,1],[-2,5],[1,4],[0,1],[1,6],[0,10],[-1,2],[-2,14],[1,7],[0,2],[-1,5],[1,4],[1,1],[11,-9],[11,-10],[1,-2]],[[859,4502],[8,-4],[0,1],[0,1],[1,3],[0,2],[9,-8],[3,-6],[0,-3],[-1,-9],[-2,-3],[-3,2],[-5,-3],[0,-2],[-1,-1],[0,-6],[0,-1],[-1,-2],[-4,-3],[-6,4],[-10,24],[3,12],[1,4],[1,2],[7,-4]],[[827,4484],[-10,-6],[-6,9],[-2,10],[0,4],[1,3],[0,3],[9,4],[9,4],[3,-7],[0,-2],[0,-2],[-1,-3],[1,-2],[0,-2],[-1,-6],[-1,-3],[-2,-4]],[[874,4512],[-1,-3],[-4,-1],[-1,1],[-1,1],[-4,6],[-6,15],[0,1],[4,10],[5,-2],[10,-22],[-2,-6]],[[899,4537],[2,-14],[-2,-1],[-3,4],[-7,19],[0,2],[0,4],[0,2],[1,5],[2,0],[4,-8],[3,-13]],[[914,4568],[0,-1],[-1,0],[1,-5],[1,-1],[3,3],[1,-1],[-1,-6],[-1,-1],[1,0],[4,-5],[0,-3],[0,-2],[0,-2],[0,-3],[1,-4],[0,-4],[1,-2],[-1,-3],[-1,-1],[-7,8],[0,-2],[3,-7],[0,-1],[-2,-1],[1,-1],[1,-2],[1,-5],[2,-6],[-1,-4],[-2,-1],[-3,4],[-6,15],[0,2],[-1,5],[0,3],[0,1],[-2,4],[1,4],[0,1],[1,0],[-1,5],[0,1],[0,1],[1,0],[1,3],[0,5],[0,3],[0,2],[-1,4],[0,5],[1,2],[1,1],[2,1],[2,-3],[0,-2],[0,-2],[0,-2]],[[915,4722],[4,-10],[1,-3],[0,-3],[0,-4],[0,-3],[1,-2],[4,-19],[0,-5],[1,-13],[0,-6],[-1,-5],[-2,-2],[-1,1],[-7,16],[-1,4],[0,-1],[1,1],[1,3],[-1,6],[-9,16],[-1,4],[1,0],[0,3],[1,0],[-3,15],[0,6],[1,4],[2,2],[8,-5]],[[9673,4708],[-1,-1],[-1,5],[-1,13],[0,3],[1,-2],[3,-6],[0,-4],[0,-5],[-1,-3]],[[9521,4851],[-1,-2],[-3,4],[-1,4],[-1,5],[4,20],[0,6],[1,4],[5,6],[1,1],[0,-4],[0,-2],[-2,-16],[0,-4],[0,-2],[0,-4],[-1,-2],[0,-1],[0,-2],[0,-1],[-1,-2],[0,-4],[0,-2],[0,-1],[-1,-1]],[[952,4911],[8,-21],[1,-3],[1,-9],[3,-18],[1,-4],[1,-2],[-1,-6],[-1,-3],[0,-2],[-4,1],[-8,16],[-9,16],[-3,11],[-1,5],[0,2],[1,5],[0,4],[4,11],[3,2],[4,-5]],[[9515,4924],[-1,-1],[-1,3],[0,6],[1,10],[1,2],[1,-5],[0,-8],[-1,-7]],[[9546,5124],[-1,-8],[-1,0],[0,6],[-1,8],[1,4],[0,1],[0,2],[0,3],[1,-1],[1,-4],[0,-6],[0,-5]],[[9561,5216],[0,-2],[0,-2],[-4,2],[-1,-4],[0,-4],[0,-7],[0,-6],[-1,-2],[1,-4],[1,-5],[1,-5],[-1,-8],[-1,-2],[-3,-3],[1,-5],[2,-6],[-2,-12],[1,-1],[0,-1],[-1,-5],[0,-2],[-1,0],[0,2],[0,2],[0,2],[0,2],[0,3],[0,1],[0,2],[-1,2],[-1,0],[0,-1],[0,-1],[0,-2],[-1,-1],[-1,2],[-1,6],[0,1],[0,1],[0,1],[0,2],[0,1],[-1,1],[0,3],[0,2],[0,6],[0,3],[-1,7],[0,1],[1,3],[2,5],[0,4],[6,30],[7,17],[1,0],[0,-2],[-1,-5],[0,-2],[-1,-4],[0,-4],[0,-4],[0,-2]],[[1324,5289],[-1,-4],[0,-2],[0,-2],[0,-3],[-2,-7],[-1,-10],[-2,-4],[-1,-1],[-8,10],[0,4],[0,3],[0,2],[1,0],[-1,5],[-1,2],[1,-1],[1,1],[1,1],[0,3],[1,-1],[5,9],[2,2],[2,-5],[2,-1],[1,-1]],[[1342,5317],[1,-3],[0,-1],[2,1],[0,-2],[-1,-4],[1,-6],[1,-3],[11,-18],[4,6],[1,-1],[0,-1],[0,-2],[0,-1],[0,-3],[1,-2],[0,-1],[0,-2],[0,-1],[-1,-2],[0,-4],[0,-10],[0,-5],[0,-2],[0,-1],[0,-1],[0,-2],[-2,-13],[-1,-4],[0,-1],[0,-1],[0,-3],[0,-1],[-1,-1],[-3,-2],[-7,12],[-7,12],[-1,-1],[-2,-4],[-1,-1],[0,3],[0,3],[-1,3],[0,3],[0,1],[-4,4],[-1,5],[1,4],[1,3],[0,1],[-1,0],[0,2],[-2,8],[-1,4],[-1,0],[5,15],[0,1],[0,3],[1,3],[5,13],[2,-1],[1,1]],[[1742,5298],[-2,0],[-1,4],[1,13],[1,6],[8,10],[1,-1],[1,-3],[-3,-13],[-3,-9],[-3,-7]],[[1329,5369],[-1,-2],[-1,3],[-1,3],[-1,3],[0,4],[1,2],[1,1],[1,-1],[1,-4],[1,-3],[-1,-6]],[[1760,5404],[4,-6],[0,1],[-1,-9],[-2,-12],[-5,-11],[-12,-9],[-2,6],[-1,3],[-2,6],[0,8],[0,13],[1,5],[13,36],[13,36],[3,1],[5,-13],[-2,-12],[-4,-12],[-4,-20],[-4,-8],[0,-3]],[[2950,5632],[0,-1],[-1,1],[0,2],[1,5],[0,5],[1,1],[1,-5],[-1,-3],[0,-3],[-1,-2]],[[9717,5558],[-5,-7],[0,1],[0,4],[0,4],[-1,3],[0,3],[0,2],[-1,1],[-2,4],[-2,4],[3,20],[3,22],[0,3],[0,5],[-1,4],[0,4],[1,7],[0,8],[1,5],[1,2],[2,-3],[0,-7],[0,-9],[0,-9],[1,-5],[0,-8],[1,-11],[2,-14],[0,-6],[-1,-4],[-2,-7],[1,0],[0,-4],[0,-5],[0,-3],[-1,-3],[0,-1]],[[3004,5682],[-2,-4],[-2,0],[-2,5],[-1,10],[0,6],[2,4],[1,1],[3,-3],[1,-4],[1,-6],[-1,-9]],[[2955,5728],[2,-7],[-4,-25],[0,-4],[-1,-7],[0,-1],[1,-3],[0,-4],[0,-4],[0,-4],[-1,-3],[-1,-7],[-2,-7],[-2,-11],[0,-2],[-1,0],[-1,1],[-1,-4],[0,-6],[0,-2],[-1,-1],[0,2],[-1,3],[0,5],[0,4],[0,5],[-2,10],[0,5],[0,2],[0,2],[0,2],[0,4],[1,2],[3,7],[0,1],[-1,8],[-1,2],[1,0],[1,0],[3,5],[0,3],[1,2],[0,3],[0,4],[0,2],[-1,2],[0,3],[0,10],[6,7],[1,-1],[1,-3]],[[2514,5774],[-1,-8],[-1,-18],[-1,-7],[-1,-4],[-2,-2],[-3,-1],[-5,8],[-4,-9],[-2,4],[-2,12],[-2,21],[2,15],[2,-1],[3,-14],[1,0],[2,3],[1,6],[1,10],[1,15],[0,4],[0,3],[1,2],[0,2],[2,1],[6,-4],[4,-11],[2,-11],[0,-6],[-4,-10]],[[2394,5790],[-2,0],[-3,3],[-2,5],[-2,10],[2,16],[2,3],[5,-13],[1,-6],[0,-2],[1,-3],[0,-6],[-1,-4],[-1,-3]],[[2282,5861],[-3,-2],[-3,3],[-2,8],[2,10],[3,1],[6,-8],[-3,-12]],[[2410,5889],[-1,-1],[-1,3],[-1,4],[-1,5],[0,8],[1,6],[2,5],[1,2],[2,-2],[1,-4],[0,-12],[-1,-7],[-1,-4],[-1,-3]],[[3310,5906],[-3,-4],[-1,2],[0,7],[2,9],[0,1],[2,-2],[1,-5],[0,-5],[-1,-3]],[[4552,5871],[-2,-7],[-3,0],[-2,6],[-2,9],[-1,14],[-1,18],[0,17],[1,13],[2,9],[0,1],[1,-1],[1,-2],[0,-3],[1,-5],[3,-36],[1,-14],[1,-9],[0,-10]],[[3040,6010],[-1,-1],[-2,10],[1,7],[1,2],[1,1],[3,-2],[1,-3],[-4,-14]],[[3329,6019],[-1,-1],[-2,6],[0,11],[0,9],[2,1],[1,-6],[1,-11],[-1,-9]],[[6910,6066],[0,-1],[0,-1],[1,-3],[1,-9],[0,-5],[0,-8],[0,-7],[-1,-5],[0,-4],[-2,-8],[-8,-17],[-1,0],[-1,6],[2,16],[4,26],[1,8],[0,9],[0,4],[1,5],[1,2],[1,0],[0,-2],[0,-3],[0,-1],[0,-1],[1,-1]],[[4646,6095],[2,-11],[2,-14],[2,-9],[1,-13],[-3,-10],[-2,-1],[-2,5],[-4,14],[-1,7],[-1,10],[-1,12],[2,19],[3,0],[2,-9]],[[6938,6086],[-1,-2],[-1,1],[1,5],[-1,18],[-1,5],[0,2],[1,6],[0,1],[0,1],[0,1],[0,3],[0,1],[1,5],[0,2],[0,1],[0,1],[0,1],[0,2],[1,1],[1,1],[1,0],[2,-7],[-1,-7],[0,-6],[-3,-26],[0,-6],[0,-1],[0,-1],[0,-1],[0,-1]],[[4910,6426],[1,-20],[6,-25],[1,-14],[-3,-4],[-3,0],[-2,3],[-2,7],[-1,5],[-1,7],[-1,8],[0,6],[0,3],[0,3],[1,7],[0,1],[-1,8],[1,5],[2,1],[2,-1]],[[3318,6426],[-2,-4],[-4,5],[-4,10],[-2,14],[2,12],[2,9],[4,2],[3,-5],[1,-10],[1,-13],[0,-12],[-1,-8]],[[4919,6551],[8,-5],[1,-4],[2,-7],[-2,-9],[-4,-12],[0,-9],[3,-7],[9,16],[4,-6],[2,-5],[-1,-2],[-1,-12],[0,-3],[-2,-4],[0,-3],[-1,-4],[0,-4],[0,-5],[-1,-12],[0,-7],[0,-5],[0,-4],[-8,-39],[-4,-13],[-2,1],[-1,4],[0,10],[0,5],[0,6],[0,4],[-1,5],[0,4],[1,0],[0,3],[1,9],[1,3],[2,5],[0,1],[-8,19],[0,1],[1,5],[0,7],[0,7],[-1,4],[0,3],[-1,2],[-5,9],[-7,25],[-4,4],[0,16],[2,4],[3,-4],[6,8],[8,-5]],[[5059,6562],[-1,-8],[-1,0],[-2,7],[-1,8],[0,2],[0,2],[0,2],[0,3],[1,2],[2,-1],[1,-6],[1,-11]],[[3313,6542],[-3,-2],[-1,2],[-1,3],[0,5],[-2,22],[0,4],[0,4],[0,4],[0,1],[0,4],[0,4],[0,4],[0,3],[2,6],[2,3],[7,2],[2,-4],[1,-8],[1,-3],[0,-11],[0,-5],[0,-8],[-1,-6],[-2,-11],[-5,-13]],[[4835,6639],[-2,-14],[1,-11],[2,-18],[-1,-5],[-5,-16],[-1,-1],[-1,3],[-1,8],[1,1],[0,2],[0,1],[-7,34],[-1,9],[3,-5],[2,0],[5,18],[3,1],[2,-7]],[[5082,6575],[-6,-6],[-2,2],[-1,7],[-1,12],[-1,15],[2,10],[11,37],[3,4],[2,-6],[1,-16],[0,-16],[-1,-15],[-2,-11],[-2,-11],[-3,-6]],[[9541,6654],[-5,-5],[-1,3],[1,0],[0,1],[0,1],[0,2],[1,2],[1,8],[1,2],[2,-3],[2,-6],[-2,-5]],[[3009,6682],[2,0],[3,7],[2,4],[3,-12],[-1,-8],[-1,-10],[-1,-8],[-3,-20],[-2,-5],[-1,-1],[-1,2],[-1,6],[0,1],[0,1],[0,1],[-1,4],[0,3],[-1,4],[0,6],[0,3],[0,4],[0,2],[0,3],[0,2],[-1,11],[2,9],[2,2],[0,-11]],[[7004,6562],[-2,-1],[-8,10],[-1,6],[-3,30],[0,5],[0,5],[-1,12],[0,8],[0,17],[0,8],[0,5],[0,2],[1,1],[0,9],[1,9],[2,5],[1,0],[0,-4],[0,-6],[1,-7],[0,-5],[0,-11],[0,-9],[1,-8],[1,-6],[1,-6],[1,-4],[1,-1],[0,-1],[1,-4],[0,-5],[0,-6],[0,-5],[1,-3],[0,-1],[2,-1],[1,-1],[0,-3],[0,-4],[0,-4],[0,-4],[0,-4],[0,-1],[0,-1],[0,-1],[0,-6],[0,-2],[0,-5],[-1,-2]],[[3036,6669],[-1,0],[-1,3],[0,8],[0,7],[0,6],[1,5],[0,3],[1,1],[0,-1],[1,-2],[1,-3],[-1,-2],[0,-2],[0,-3],[0,-4],[0,-2],[1,-2],[0,-2],[-1,-4],[0,-3],[-1,-3]],[[5124,6613],[-4,-1],[-4,11],[-2,24],[-2,33],[2,16],[5,6],[5,-2],[3,-11],[1,-26],[-1,-23],[-1,-18],[-2,-9]],[[5161,6680],[-2,-13],[-3,4],[-3,12],[-2,13],[3,9],[3,1],[2,-8],[2,-18]],[[9496,6695],[-1,-1],[-1,2],[0,5],[0,6],[1,2],[1,-2],[1,-6],[-1,-6]],[[5180,6707],[-1,0],[-1,3],[-3,15],[-1,8],[0,8],[2,0],[3,-5],[2,-9],[0,-15],[-1,-5]],[[5305,6757],[-2,-2],[-3,2],[-7,15],[-1,7],[3,2],[7,-4],[3,-10],[0,-10]],[[7017,6784],[1,-3],[1,1],[1,-1],[0,-6],[-5,-23],[-3,-6],[-1,11],[0,5],[1,3],[1,-2],[0,2],[1,3],[0,4],[2,15],[0,3],[1,3],[0,-3],[0,-2],[0,-2],[0,-2]],[[3300,6789],[-2,-2],[-1,1],[-1,3],[-1,4],[-1,7],[0,13],[0,3],[1,4],[0,4],[0,2],[1,2],[1,3],[1,0],[2,-5],[1,-5],[0,-3],[1,-3],[0,-4],[0,-2],[0,-2],[0,-1],[0,-3],[0,-1],[0,-3],[0,-6],[-2,-6]],[[5449,6758],[-2,0],[-6,28],[-6,9],[-3,11],[0,20],[0,12],[2,11],[1,8],[1,6],[7,15],[8,4],[8,-4],[3,-8],[-2,-12],[-7,-17],[-1,-4],[0,-3],[-1,-5],[0,-4],[0,-8],[0,-6],[0,-6],[0,-10],[0,-8],[-2,-23],[0,-6]],[[3314,7191],[-2,-1],[-1,2],[-3,11],[-3,13],[0,5],[1,9],[2,1],[3,-5],[2,-8],[1,-10],[1,-10],[-1,-7]],[[3134,7407],[-1,-5],[-1,1],[-1,9],[1,4],[1,0],[2,-2],[-1,-7]],[[3142,7500],[-1,-1],[-2,2],[-1,3],[-1,4],[3,4],[1,-1],[2,-7],[-1,-4]],[[3133,7497],[-1,0],[-1,3],[0,3],[-1,2],[2,7],[0,5],[0,1],[-3,5],[3,6],[1,2],[1,-2],[1,-1],[1,-10],[0,-6],[-1,-5],[-1,-7],[-1,-3]],[[3206,7593],[0,-3],[-2,-14],[-1,-3],[-1,-2],[-1,1],[0,3],[0,4],[-1,4],[0,1],[-1,-1],[-2,-9],[-1,0],[-1,2],[1,1],[0,3],[0,4],[0,3],[0,3],[0,2],[0,5],[1,0],[4,-6],[0,2],[-1,6],[1,0],[5,-6]],[[3132,7570],[0,-11],[-1,1],[-1,-1],[0,-5],[1,-1],[-2,-12],[-1,-6],[-4,-3],[-3,5],[-2,5],[-1,5],[0,5],[0,1],[1,1],[0,2],[0,1],[1,3],[0,2],[0,2],[0,2],[1,2],[-1,1],[0,-1],[-2,-5],[0,-1],[-1,1],[0,5],[0,6],[1,4],[7,22],[8,-3],[1,-4],[1,-11],[-3,-12]],[[6319,7606],[5,-7],[1,1],[1,3],[2,8],[1,0],[0,-2],[1,-8],[1,0],[-4,-11],[-7,-8],[-2,2],[-2,5],[2,22],[0,6],[1,4],[1,2],[2,-1],[-1,-5],[-1,-6],[-1,-4],[0,-1]],[[3139,7600],[-3,-4],[-2,5],[2,10],[2,4],[0,2],[1,5],[0,2],[0,1],[1,2],[2,-1],[2,-3],[-1,-4],[0,-3],[-1,0],[-1,-9],[-2,-7]],[[3120,7679],[-1,-4],[-1,3],[0,7],[1,7],[2,4],[1,-3],[-1,-6],[-1,-8]],[[9577,7614],[-1,-7],[-2,0],[-1,11],[0,4],[0,5],[-1,4],[0,3],[1,6],[1,8],[0,11],[0,10],[0,5],[-1,10],[0,3],[0,2],[0,2],[0,2],[0,1],[0,12],[0,6],[0,1],[1,-4],[3,-19],[1,-5],[0,-8],[0,-4],[1,-4],[1,-6],[0,-9],[0,-8],[-1,-8],[-1,-8],[0,-1],[0,-1],[1,-1],[0,-2],[-2,-11]],[[3119,7704],[-2,-4],[-1,11],[3,17],[1,3],[1,1],[1,0],[1,-5],[-2,-12],[-2,-11]],[[3122,7753],[-1,-1],[-1,2],[0,3],[0,2],[0,2],[1,2],[0,3],[0,2],[-1,2],[1,3],[0,1],[0,2],[0,1],[1,5],[0,1],[0,1],[1,0],[0,-2],[0,-4],[1,-6],[0,-5],[0,-2],[-1,-3],[0,-2],[0,-2],[-1,-3],[0,-2]],[[8352,7831],[0,-1],[1,1],[3,7],[1,1],[-10,-28],[-1,2],[0,4],[0,5],[0,5],[0,3],[1,6],[0,2],[1,2],[0,1],[1,0],[2,-3],[0,-3],[0,-1],[0,-2],[1,0],[0,-1]],[[8361,7852],[-2,-3],[-2,3],[2,6],[3,14],[2,3],[2,0],[0,-2],[-1,-7],[-2,-8],[-2,-6]],[[3128,7833],[-2,-2],[-1,2],[-3,8],[1,4],[1,16],[1,7],[0,4],[-1,3],[0,3],[0,3],[1,6],[1,3],[1,-1],[3,-8],[1,-3],[0,-1],[0,-2],[0,-1],[0,-2],[0,-2],[0,-2],[0,-2],[1,-7],[0,-2],[-1,-8],[-1,-7],[-1,-5],[-1,-4]],[[7385,7822],[-3,-11],[-5,-6],[0,1],[0,8],[1,4],[0,3],[0,-1],[-7,22],[-1,6],[-1,9],[-1,10],[0,12],[0,10],[1,5],[1,1],[4,0],[2,-5],[2,-1],[1,-2],[3,-5],[0,-4],[2,-8],[3,-33],[-1,-7],[-1,-8]],[[6355,7879],[-1,-5],[-5,2],[-5,-11],[-3,0],[0,14],[0,5],[0,6],[0,5],[1,4],[1,3],[10,-1],[1,-6],[1,-16]],[[9535,7874],[1,0],[-1,0],[0,-1],[1,0],[-1,-4],[0,-8],[0,-2],[0,-1],[1,0],[-1,-2],[0,-1],[0,-16],[-1,3],[-2,11],[-1,11],[-2,34],[0,1],[0,1],[1,6],[2,-1],[1,-4],[1,-5],[0,-5],[0,-3],[0,-3],[0,-5],[1,-4],[1,-1],[-1,0],[0,-1]],[[7404,7896],[1,-1],[2,0],[-2,-9],[-3,-13],[-3,-4],[-1,1],[-1,3],[-1,8],[-1,6],[0,5],[0,8],[1,6],[1,3],[5,4],[1,-1],[0,-3],[0,-3],[0,-2],[0,-3],[1,-5]],[[7368,7923],[-2,-3],[-2,4],[-2,10],[1,9],[0,11],[0,9],[2,1],[0,-3],[1,-10],[0,-4],[1,-5],[3,-8],[-2,-11]],[[7744,7975],[-1,-1],[-1,2],[-2,6],[-1,11],[-1,15],[0,3],[1,3],[1,2],[1,0],[4,-9],[3,-10],[0,-4],[-3,-16],[-1,-2]],[[7705,7996],[0,-3],[-9,9],[-1,3],[-1,5],[1,13],[2,5],[1,1],[4,-5],[1,-7],[1,-3],[0,-3],[1,-9],[0,-6]],[[3136,8008],[-1,-1],[-1,0],[1,4],[0,3],[0,2],[0,2],[0,3],[-1,2],[0,4],[0,2],[1,1],[1,0],[1,-2],[1,-5],[0,-6],[0,-4],[-1,-2],[-1,-3]],[[9515,7959],[-1,-1],[0,1],[-1,3],[-1,4],[0,1],[-3,33],[-1,2],[-1,2],[1,5],[1,4],[0,4],[0,2],[-1,1],[0,2],[0,2],[0,6],[0,3],[0,3],[0,2],[-1,2],[0,13],[1,1],[7,-63],[0,-3],[1,-6],[0,-2],[-1,-19],[0,-2]],[[3137,8053],[1,-2],[3,3],[1,-4],[-1,-5],[-1,-3],[-1,0],[-1,0],[-2,4],[0,4],[0,1],[-1,3],[1,4],[0,1],[1,1],[0,-1],[0,-6]],[[7785,8072],[1,0],[-1,-1],[-1,-7],[-2,-4],[-2,1],[-1,3],[0,6],[0,7],[2,15],[2,8],[1,3],[0,1],[1,-3],[0,-1],[0,-1],[1,-4],[0,-2],[0,-5],[0,-2],[0,-5],[-1,-3],[-1,-1],[0,-1],[0,-3],[1,-1]],[[3143,8030],[-1,-1],[0,1],[-1,4],[0,3],[1,5],[2,16],[1,4],[0,2],[0,6],[0,7],[0,2],[0,1],[0,3],[0,2],[0,2],[0,2],[0,4],[0,1],[-1,1],[0,2],[1,6],[1,5],[3,8],[1,1],[0,-1],[0,-1],[1,-2],[0,-3],[0,-4],[-1,-6],[-1,-4],[1,-8],[0,-2],[0,-8],[0,-9],[0,-1],[-2,-9],[-3,-18],[-2,-11]],[[7686,8118],[1,-2],[1,0],[2,5],[1,0],[2,-7],[1,-11],[1,-11],[-1,-11],[-3,-13],[-7,-3],[-7,-3],[-1,2],[-1,8],[-1,5],[2,22],[0,9],[2,9],[1,5],[2,4],[1,1],[2,-1],[1,-2],[1,-6]],[[3174,8142],[-2,0],[0,5],[0,2],[0,2],[0,2],[0,2],[0,2],[1,1],[0,-2],[0,-3],[1,-3],[0,-7],[0,-1]],[[3169,8167],[-3,-4],[0,1],[-1,1],[1,6],[1,6],[1,4],[1,0],[0,-1],[0,-1],[0,-1],[0,-2],[0,-7],[0,-2]],[[3189,8188],[0,-9],[-1,-4],[0,-2],[-1,0],[0,1],[-1,2],[0,6],[-1,3],[0,8],[0,1],[1,1],[1,-2],[2,-5]],[[7799,8215],[5,-4],[1,-3],[0,-5],[0,-9],[-1,-9],[-2,-4],[-4,-2],[-2,3],[0,3],[-1,2],[-3,-5],[-2,-1],[-1,3],[-1,5],[4,21],[1,2],[1,2],[3,-2],[2,3]],[[7571,8201],[-4,-2],[-4,7],[-2,18],[2,13],[2,6],[2,0],[2,-3],[3,-8],[1,-8],[0,-12],[-2,-11]],[[3174,8296],[1,-2],[1,2],[1,1],[0,-5],[-1,-8],[0,-4],[0,-9],[0,-4],[-1,-3],[0,-1],[1,-8],[-6,-11],[-1,-5],[2,-10],[0,-6],[0,-4],[0,-4],[0,-3],[0,-6],[0,-3],[0,-3],[0,-2],[1,-1],[0,-3],[-1,-2],[-1,0],[-5,-12],[-1,-2],[-2,5],[-1,2],[0,6],[0,2],[0,4],[0,1],[0,1],[0,1],[0,1],[0,1],[0,2],[0,2],[1,6],[0,6],[0,2],[0,1],[2,-3],[0,2],[1,8],[0,2],[-1,3],[0,5],[0,5],[0,2],[0,2],[0,2],[0,1],[0,1],[0,1],[0,1],[1,2],[1,2],[0,1],[1,7],[0,2],[0,2],[0,2],[0,4],[0,3],[0,3],[0,3],[0,1],[0,5],[0,1],[5,11],[1,-1],[1,-5]],[[3178,8320],[1,-3],[0,1],[0,-5],[-1,-3],[-2,-5],[-1,1],[-1,2],[0,6],[0,5],[1,-1],[0,-3],[1,-1],[0,1],[1,5],[1,0]],[[7871,8321],[-2,-3],[-3,1],[-1,3],[-1,6],[0,4],[0,17],[0,6],[0,9],[-1,11],[0,3],[-2,5],[-5,10],[-2,7],[0,2],[-1,16],[1,13],[2,4],[2,-1],[5,-14],[2,-9],[1,-10],[0,-12],[-1,-13],[0,-11],[1,-7],[1,-6],[1,-7],[3,-8],[1,-2],[0,-4],[0,-5],[-1,-3],[0,-2]],[[3349,8399],[-3,-4],[-3,9],[-4,15],[-2,16],[2,14],[4,-12],[6,-38]],[[3249,8523],[0,-1],[1,3],[0,1],[1,-1],[0,-2],[1,-3],[0,-1],[-1,-5],[-1,-1],[-2,3],[-1,2],[-1,5],[0,2],[0,4],[0,1],[1,2],[1,0],[0,-1],[1,-2],[0,-2],[0,-3],[0,-1]],[[3254,8543],[-2,-5],[-2,3],[-1,1],[0,2],[1,3],[1,1],[3,-5]],[[3243,8549],[-1,-5],[0,-3],[0,-12],[-1,-3],[0,-2],[-2,-4],[-1,-7],[-1,-2],[-2,-4],[-1,0],[-1,3],[1,2],[1,5],[1,8],[1,10],[-1,4],[0,1],[-1,-1],[2,11],[1,1],[1,0],[1,-4],[0,1],[1,2],[2,20],[1,4],[1,2],[0,-4],[0,-4],[0,-3],[0,-2],[0,-2],[-2,-12]],[[3259,8564],[-1,0],[-1,3],[0,1],[0,3],[0,1],[0,2],[-1,3],[1,3],[0,2],[1,4],[0,3],[0,1],[1,0],[0,-1],[1,-2],[0,-1],[0,-6],[0,-2],[0,-1],[0,-1],[0,-1],[0,-1],[0,-1],[0,-2],[-1,-4],[0,-3]],[[3277,8596],[-1,-3],[0,1],[-1,3],[0,4],[1,2],[0,2],[1,1],[0,-3],[0,-3],[0,-2],[0,-2]],[[3276,8609],[-1,-2],[-1,2],[0,4],[0,2],[0,1],[0,2],[-1,2],[0,1],[1,1],[1,2],[0,2],[0,1],[0,2],[0,1],[0,1],[0,1],[1,2],[0,1],[1,-5],[0,-2],[-1,-7],[0,-3],[0,-5],[0,-3],[0,-1]],[[3401,8668],[-1,-10],[-2,7],[2,11],[1,-8]],[[3291,8683],[-1,0],[-1,3],[-1,2],[0,3],[0,2],[0,3],[0,1],[1,2],[1,0],[1,-4],[0,-4],[1,-4],[-1,0],[0,-4]],[[3410,8626],[-2,-3],[-3,4],[-1,5],[0,4],[0,6],[0,7],[0,3],[0,5],[0,4],[0,3],[1,3],[3,3],[1,3],[9,33],[1,-1],[1,-1],[-2,-14],[0,-3],[0,-12],[-1,-12],[-1,-11],[-1,-7],[-5,-19]],[[3424,8714],[-2,-6],[-3,2],[1,2],[0,3],[0,4],[1,4],[3,15],[2,4],[2,-4],[-1,-14],[-3,-10]],[[3287,8759],[-1,0],[-1,1],[0,2],[-1,2],[0,4],[0,3],[0,2],[0,3],[0,3],[0,2],[1,2],[0,2],[1,-2],[0,-7],[1,-17]],[[3279,8789],[-1,-2],[-1,0],[-1,1],[0,3],[0,2],[0,3],[0,3],[0,3],[1,0],[0,1],[0,1],[0,1],[0,2],[0,1],[0,3],[0,1],[0,2],[1,2],[1,1],[0,3],[1,2],[0,1],[1,0],[1,2],[0,1],[0,2],[0,2],[0,1],[1,0],[0,-1],[0,-2],[0,-2],[-1,-9],[0,-2],[-1,-2],[0,-1],[-1,-8],[0,-3],[0,-2],[0,-1],[-1,-3],[0,-6]],[[3405,8872],[1,-1],[4,11],[1,0],[1,0],[0,-3],[1,-4],[1,-3],[0,-2],[-1,-1],[-1,-1],[0,-1],[0,-1],[0,-1],[0,-1],[0,-4],[0,-1],[-1,-1],[0,-1],[-1,-6],[0,6],[0,3],[0,3],[-1,0],[-1,-2],[-1,-4],[-1,0],[-3,10],[-1,-2],[0,-5],[0,3],[-1,1],[0,1],[0,1],[0,1],[-1,1],[-1,-1],[0,1],[-1,1],[-1,11],[1,4],[8,5],[0,-1],[0,-2],[0,-3],[0,-3],[1,-2],[-1,-4],[-1,-2]],[[3287,8884],[-1,-1],[0,1],[0,8],[0,3],[0,3],[-1,4],[0,3],[-2,4],[0,3],[5,-2],[0,-2],[0,-10],[0,-9],[-1,-5]],[[3317,8919],[-1,-9],[0,-3],[0,-1],[-1,-2],[0,-4],[-1,-9],[0,-4],[0,-4],[0,-1],[0,-5],[0,-6],[1,-4],[1,-2],[-2,-4],[-1,-8],[-1,-3],[0,1],[0,1],[0,1],[0,1],[-1,1],[0,-1],[0,-2],[-1,-5],[-2,3],[0,2],[1,4],[0,3],[0,2],[0,2],[0,2],[-1,0],[0,1],[-2,-1],[0,1],[0,5],[0,1],[0,-1],[1,-2],[2,0],[2,3],[0,2],[0,1],[1,2],[0,3],[0,2],[0,2],[-1,2],[0,2],[0,4],[0,4],[0,5],[0,1],[2,0],[1,2],[0,3],[0,1],[0,1],[0,1],[1,2],[-1,2],[-2,-2],[-1,1],[1,3],[0,3],[-1,4],[0,2],[0,1],[0,2],[0,1],[0,2],[0,-1],[1,-4],[1,-3],[4,0],[1,-3],[-1,-1]],[[3403,8921],[-1,-1],[0,2],[-1,1],[0,2],[0,9],[0,4],[-1,1],[3,6],[1,2],[1,-3],[0,-2],[-1,-15],[-1,-4],[0,-2]],[[3428,8949],[-2,-4],[-1,11],[1,8],[1,4],[2,-1],[2,-2],[-3,-16]],[[3339,8954],[-1,-1],[-1,2],[0,4],[-1,3],[1,4],[1,3],[-1,0],[0,2],[0,1],[1,-1],[1,-1],[0,-1],[0,-1],[0,-1],[0,-2],[0,-2],[0,-6],[0,-2],[0,-1]],[[3446,8960],[-1,-1],[-5,19],[-2,14],[-1,2],[0,2],[1,2],[0,1],[0,1],[0,6],[0,3],[6,8],[5,1],[2,-7],[1,-16],[0,-8],[-6,-17],[0,-10]],[[3277,9040],[-2,-3],[-5,0],[0,1],[0,3],[1,4],[0,3],[0,6],[0,4],[-1,3],[0,3],[2,6],[0,1],[0,3],[0,2],[0,-1],[1,-3],[3,-3],[1,-1],[0,-1],[0,-2],[0,-2],[0,-5],[1,-3],[0,-1],[0,-2],[1,-1],[-1,-7],[-1,-4]],[[3427,9084],[-1,-2],[-1,1],[0,4],[0,5],[0,5],[0,4],[1,2],[1,2],[0,1],[1,-2],[0,-3],[0,-13],[0,-2],[-1,-2]],[[3431,9165],[4,-10],[6,0],[2,-4],[0,-14],[-1,-10],[-4,-25],[-1,-6],[-2,1],[-2,7],[-4,19],[-2,10],[0,6],[0,7],[1,4],[2,6],[0,4],[0,1],[0,2],[1,1],[0,1]],[[3316,9192],[2,-10],[1,-13],[-1,-6],[-1,1],[-1,6],[0,9],[0,3],[-1,1],[-1,-1],[0,-2],[0,-6],[0,-1],[0,-3],[0,-1],[0,-1],[0,-3],[4,-11],[-1,-3],[-1,0],[-2,5],[-1,2],[0,5],[-1,6],[0,8],[2,15],[2,0]],[[3259,9128],[-1,-2],[0,4],[1,2],[0,2],[0,4],[0,1],[0,2],[1,2],[0,3],[0,6],[1,5],[0,4],[0,4],[1,5],[0,1],[0,3],[0,5],[1,2],[0,5],[1,3],[3,5],[0,1],[0,3],[1,1],[1,0],[-1,-20],[-2,-18],[-5,-27],[-2,-6]],[[3294,9217],[-2,-1],[-1,3],[0,1],[0,1],[0,2],[0,1],[0,3],[0,3],[0,3],[0,3],[0,2],[1,5],[0,3],[2,2],[6,1],[-1,-2],[-1,-3],[0,-4],[0,-5],[-4,-18]],[[3341,9325],[2,7],[1,1],[1,-2],[0,-5],[0,-2],[-1,-1],[0,-1],[0,-7],[0,-4],[-2,-2],[-1,2],[-1,0],[0,1],[0,1],[-1,1],[0,5],[0,2],[0,2],[-4,7],[-2,12],[2,5],[6,-4],[-1,-8],[-1,-2],[0,-2],[1,-2],[0,-2],[1,-2]],[[3350,9369],[1,-11],[0,-1],[-1,-9],[0,-2],[0,-1],[0,-1],[-2,0],[-1,-3],[-2,4],[-1,5],[-1,7],[1,3],[0,2],[0,2],[0,2],[0,-1],[-2,-1],[0,1],[0,1],[-1,1],[0,1],[0,1],[0,2],[0,1],[1,1],[0,1],[2,4],[5,-3],[1,-6]],[[3361,9406],[1,-2],[1,3],[1,0],[0,-3],[1,-5],[0,-8],[-5,-13],[-1,-1],[-1,1],[0,2],[-1,6],[-1,1],[0,1],[-1,7],[0,2],[1,6],[0,5],[4,9],[1,0],[0,-3],[0,-3],[0,-2],[0,-2],[0,-1]],[[3498,9732],[-1,-3],[-1,1],[-2,9],[-1,4],[1,6],[3,25],[1,4],[0,3],[0,9],[0,2],[1,-1],[0,-3],[0,-5],[0,-4],[0,-1],[-1,-3],[0,-5],[0,-4],[0,-1],[0,-2],[1,-2],[0,-2],[0,-2],[0,-5],[-1,-8],[0,-7],[0,-5]]],"transform":{"scale":[0.036003600360036005,0.0029486740082008247],"translate":[-180,-90]}};
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
