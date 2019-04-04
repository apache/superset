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
  Datamap.prototype.ausTopo = {"type":"Topology","objects":{"aus":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Macquarie Island"},"id":"AU","arcs":[[0]]},{"type":"Polygon","properties":{"name":"Jervis Bay Territory"},"id":"AU.JB","arcs":[[1,2]]},{"type":"MultiPolygon","properties":{"name":"Northern Territory"},"id":"AU.NT","arcs":[[[3]],[[4]],[[5]],[[6]],[[7]],[[8]],[[9]],[[10]],[[11]],[[12]],[[13]],[[14]],[[15]],[[16]],[[17]],[[18]],[[19]],[[20]],[[21]],[[22]],[[23]],[[24]],[[25]],[[26]],[[27]],[[28]],[[29]],[[30]],[[31]],[[32]],[[33]],[[34]],[[35]],[[36]],[[37]],[[38]],[[39]],[[40]],[[41]],[[42]],[[43]],[[44]],[[45]],[[46]],[[47]],[[48]],[[49]],[[50]],[[51]],[[52]],[[53,54,55,56]],[[57]],[[58]],[[59]],[[60]]]},{"type":"MultiPolygon","properties":{"name":"Western Australia"},"id":"AU.WA","arcs":[[[61]],[[62]],[[63]],[[64]],[[65]],[[66]],[[67]],[[68]],[[69]],[[70]],[[71]],[[72]],[[73]],[[74]],[[75]],[[76]],[[77]],[[78]],[[79]],[[80]],[[81]],[[82]],[[83]],[[84]],[[85]],[[86]],[[87]],[[88]],[[89]],[[90]],[[91]],[[92]],[[93]],[[94]],[[95]],[[96]],[[97]],[[98]],[[99]],[[100]],[[101]],[[102]],[[103]],[[104]],[[105]],[[106]],[[107]],[[108]],[[109]],[[110]],[[111]],[[112]],[[113]],[[114]],[[115]],[[116]],[[117]],[[118]],[[119]],[[-56,120,121]]]},{"type":"Polygon","properties":{"name":"Australian Capital Territory"},"id":"AU.CT","arcs":[[122]]},{"type":"Polygon","properties":{"name":"New South Wales"},"id":"AU.NS","arcs":[[-2,123,124,125,126,127],[-123]]},{"type":"MultiPolygon","properties":{"name":"South Australia"},"id":"AU.SA","arcs":[[[128]],[[129]],[[130]],[[131]],[[132]],[[133]],[[134,135,-121,-55,136,-126]]]},{"type":"MultiPolygon","properties":{"name":"Victoria"},"id":"AU.VI","arcs":[[[137]],[[138]],[[139]],[[140,-135,-125]]]},{"type":"MultiPolygon","properties":{"name":"Queensland"},"id":"AU.QL","arcs":[[[141]],[[142]],[[143]],[[144]],[[145]],[[146]],[[147]],[[148]],[[149]],[[150]],[[151]],[[152]],[[153]],[[154]],[[155]],[[156]],[[157]],[[158]],[[159]],[[160]],[[161]],[[162]],[[163]],[[164]],[[165]],[[166]],[[167]],[[168]],[[169]],[[170]],[[171]],[[172]],[[173]],[[174]],[[175]],[[176]],[[177]],[[178]],[[179]],[[180]],[[181]],[[182]],[[183]],[[184]],[[185]],[[186]],[[187]],[[188]],[[189]],[[190]],[[191]],[[-127,-137,-54,192]],[[193]],[[194]],[[195]],[[196]],[[197]],[[198]],[[199]],[[200]],[[201]],[[202]],[[203]],[[204]],[[205]],[[206]],[[207]],[[208]]]},{"type":"Polygon","properties":{"name":"Norfolk Island"},"id":"AU.CT","arcs":[[209]]},{"type":"MultiPolygon","properties":{"name":"Tasmania"},"id":"AU.TS","arcs":[[[210]],[[211]],[[212]],[[213]],[[214]],[[215]],[[216]],[[217]],[[218]],[[219]],[[220]],[[221]],[[222]],[[223]],[[224]]]}]}},"arcs":[[[9953,53],[3,3],[9,2],[3,4],[0,-5],[-2,-13],[-1,-5],[-5,-9],[-2,-8],[-5,-8],[-1,-4],[-1,-6],[-1,-3],[-3,-1],[-6,0],[-1,3],[0,1],[1,1],[-1,4],[0,4],[3,8],[0,1],[2,2],[1,2],[-1,0],[0,1],[-1,2],[0,1],[1,2],[1,1],[1,1],[1,2],[2,4],[3,13]],[[8160,4298],[5,10],[8,4],[7,1]],[[8180,4313],[0,-1],[4,-2],[3,0],[3,2],[4,0],[0,-2],[0,-3],[-1,-4],[-1,-3],[-2,-1],[-2,0],[-1,1],[-1,-1],[-1,-1],[-1,-1],[-2,-1],[-2,0],[-4,5],[-10,-1],[-6,-2]],[[5147,8571],[-7,-9],[-1,2],[-3,2],[-3,3],[-2,4],[-1,4],[1,4],[4,3],[3,1],[4,3],[1,-4],[3,-1],[3,-2],[2,-2],[-1,-4],[-3,-4]],[[5170,8592],[3,-2],[3,-3],[1,-3],[-2,-2],[-3,1],[-1,3],[-2,0],[-3,0],[-1,-2],[2,-5],[1,-1],[1,0],[0,-2],[-1,-1],[-1,-1],[-3,-1],[-4,-3],[-3,-1],[-2,1],[1,5],[1,5],[1,5],[-3,6],[4,1],[7,-1],[4,1]],[[5212,8603],[2,0],[3,0],[1,-2],[1,-5],[4,-3],[3,2],[1,0],[1,-4],[3,-1],[0,-7],[0,-9],[0,-3],[-1,-3],[0,-1],[2,-1],[2,-1],[2,-2],[-1,-6],[-2,-4],[-4,-6],[-6,3],[-1,4],[0,2],[-2,3],[-2,0],[-3,1],[-2,1],[-3,8],[0,1],[0,5],[-1,2],[-2,0],[-2,0],[-1,0],[-1,0],[-1,-4],[-1,0],[-1,1],[-1,1],[1,5],[0,3],[1,4],[2,2],[2,4],[3,-4],[2,-1],[1,0],[-2,6],[2,1],[2,3],[-1,5]],[[5142,8603],[0,-1],[1,0],[1,-1],[0,-1],[0,-1],[-1,0],[-2,1],[-1,-1],[-2,1],[-1,0],[0,2],[1,1],[2,0],[2,0]],[[5178,8609],[0,-3],[-1,0],[-3,0],[-2,0],[-1,0],[-3,1],[-2,-1],[-1,1],[2,3],[3,1],[5,0],[2,0],[1,-2]],[[5127,8599],[-3,-5],[-2,1],[-4,-1],[-3,2],[-1,-2],[-1,-1],[-4,-1],[-1,1],[-1,1],[-2,2],[2,1],[1,3],[-2,3],[-1,1],[3,3],[2,2],[1,2],[0,2],[-1,2],[0,1],[4,1],[5,1],[4,2],[4,0],[3,-5],[-3,-5],[0,-11]],[[5183,8596],[-3,-2],[0,1],[0,1],[-1,0],[0,1],[1,0],[0,1],[-1,2],[-1,2],[1,1],[1,1],[1,1],[1,2],[0,1],[-1,1],[-2,2],[0,1],[1,4],[2,3],[3,3],[3,2],[-2,-5],[1,-5],[4,-10],[-3,0],[-2,-2],[-1,-2],[1,-3],[-2,-1],[-1,0]],[[4946,8758],[-1,-3],[-3,1],[-4,0],[-5,-3],[-3,1],[-1,1],[2,2],[2,1],[2,2],[1,3],[0,1],[-2,1],[-1,1],[2,0],[1,2],[2,2],[4,-1],[3,-2],[1,-5],[0,-4]],[[3618,8762],[-1,-1],[-3,2],[-1,2],[-4,4],[-1,3],[-1,4],[0,1],[2,-1],[4,-2],[2,-2],[2,-2],[1,-3],[1,-3],[-1,-2]],[[3640,8776],[-3,-2],[-4,1],[-5,3],[-1,2],[2,0],[5,-1],[5,-2],[1,-1]],[[3609,8753],[0,-11],[0,2],[-1,2],[-1,2],[-2,1],[-3,5],[-5,11],[-3,4],[-3,8],[-1,1],[1,3],[2,-1],[2,-1],[2,-1],[9,-14],[2,-5],[1,-6]],[[5075,8987],[-4,0],[-2,2],[1,2],[4,4],[3,0],[0,-5],[-2,-3]],[[5172,8994],[0,-1],[0,1],[0,1],[1,1],[1,1],[-2,-2],[0,-1]],[[5108,9001],[-1,0],[-2,0],[-7,9],[0,3],[2,2],[3,1],[2,1],[1,2],[0,1],[1,0],[1,0],[1,-1],[2,-3],[2,-5],[-2,-2],[1,-4],[-1,-2],[-3,-2]],[[5057,9011],[-2,-1],[-2,0],[-2,0],[-1,-4],[3,0],[2,-1],[1,-3],[1,-3],[-4,0],[-1,-3],[-1,-4],[-1,-4],[-2,-1],[-3,-2],[-3,0],[-3,0],[2,2],[0,1],[0,1],[0,1],[1,1],[-1,3],[-4,9],[-2,2],[-5,-1],[-1,-6],[2,-5],[0,-5],[-8,4],[-1,2],[0,20],[8,-4],[2,0],[2,3],[0,5],[2,4],[3,4],[3,2],[2,-1],[3,0],[3,-2],[1,-1],[2,-3],[2,-1],[3,-1],[1,-1],[0,-3],[0,-1],[0,-1],[-2,-2]],[[5153,9022],[-2,-4],[-6,-3],[-2,-3],[0,-2],[1,-3],[2,-1],[3,-1],[2,0],[3,0],[-2,-1],[-3,-5],[2,-3],[0,-3],[1,-2],[3,-3],[3,-1],[11,-2],[4,1],[3,2],[2,3],[1,4],[-1,2],[-1,1],[-1,0],[-2,-1],[1,1],[1,1],[3,9],[3,-1],[7,0],[3,-1],[1,-1],[2,-3],[2,-3],[0,-3],[-2,-3],[-7,-6],[-2,-3],[-4,-12],[-7,2],[-7,-3],[-5,-6],[-2,-7],[1,-4],[2,-2],[2,-1],[3,-2],[2,-1],[1,-1],[-1,-1],[-2,0],[-2,-1],[-1,-1],[0,-2],[-4,1],[-2,-1],[-1,-3],[1,-3],[-3,3],[-2,1],[-3,-1],[-3,-2],[1,-2],[0,-4],[-1,-6],[3,-8],[0,-3],[1,-2],[3,0],[4,-1],[6,1],[0,2],[0,3],[2,3],[4,-2],[13,-10],[2,-1],[3,3],[2,2],[1,2],[1,3],[1,4],[2,0],[2,-2],[3,0],[3,1],[4,1],[-2,-2],[-2,-2],[-2,-4],[-1,0],[-1,0],[-1,0],[0,-1],[0,-2],[1,-2],[0,-2],[1,0],[1,-2],[1,-2],[-1,-1],[-3,-1],[0,-3],[1,-3],[2,-2],[-3,1],[-1,-1],[-1,-1],[2,-2],[-3,2],[-3,1],[-1,-1],[-1,-3],[-7,4],[-4,1],[-3,-2],[-3,2],[-4,1],[-9,1],[-4,2],[-3,0],[-2,-1],[-9,-5],[-9,1],[-39,14],[-1,0],[-4,4],[-2,0],[-2,0],[-8,-2],[-5,-4],[-3,-1],[-1,-1],[-2,0],[-1,1],[1,3],[1,1],[5,3],[2,2],[7,3],[3,2],[2,6],[2,2],[1,2],[0,2],[-3,5],[-1,7],[-2,13],[1,7],[3,12],[1,7],[-1,3],[-2,3],[-2,4],[0,3],[4,2],[3,-2],[5,-5],[2,2],[5,0],[4,0],[3,3],[-2,3],[2,4],[2,-1],[2,-4],[3,-2],[3,5],[1,-1],[3,-3],[0,7],[3,-2],[4,1],[1,2],[-3,3],[-2,-2],[-1,4],[0,4],[-2,3],[-4,0],[1,2],[1,2],[-1,2],[-2,0],[1,2],[1,1],[2,0],[3,0],[3,-1],[1,0],[-1,-1],[0,-1],[0,-1],[0,-2],[0,-1],[1,-1],[1,1],[1,1],[1,1],[1,1],[1,1],[3,-1],[4,6],[0,2],[1,1],[6,1],[2,2],[2,-4],[-1,-5]],[[5204,9035],[-1,-2],[-2,-1],[-1,-1],[-3,0],[0,2],[1,1],[1,0],[1,0],[1,1],[2,1],[1,-1]],[[5020,9071],[0,-2],[-2,0],[-2,0],[-2,-1],[-2,0],[1,2],[0,1],[1,1],[0,2],[1,1],[1,-2],[2,0],[2,-1],[0,-1]],[[5040,9073],[1,-1],[-2,-4],[-5,5],[0,-5],[-4,1],[1,-4],[1,-5],[-3,-5],[-1,-5],[-3,3],[1,3],[2,4],[-1,2],[-2,2],[-1,5],[2,8],[0,6],[-3,4],[-1,4],[-5,3],[5,-1],[4,-5],[3,-1],[3,-4],[4,-7],[1,-1],[1,-1],[2,-1]],[[3703,9143],[1,-3],[4,1],[5,-3],[2,-4],[-4,-1],[-3,-1],[-3,1],[-4,0],[0,8],[1,8],[1,-1],[0,-5]],[[3782,9252],[-2,-1],[-2,0],[0,1],[-1,1],[-1,1],[2,2],[2,1],[1,-1],[1,0],[1,-1],[0,-1],[0,-1],[-1,-1]],[[3789,9263],[-2,-1],[-2,3],[0,2],[5,1],[1,-2],[0,-2],[-1,0],[-1,-1]],[[5022,9355],[2,-1],[2,1],[1,0],[2,0],[0,-2],[1,-2],[-4,-2],[-5,0],[-1,1],[0,3],[1,1],[1,0],[0,1]],[[3924,9366],[-2,-2],[-6,2],[3,3],[4,0],[1,-3]],[[5176,9364],[-2,-2],[-1,1],[-1,2],[-3,4],[1,5],[4,2],[1,-2],[0,-4],[0,-4],[1,-2]],[[4219,9363],[-4,0],[-11,8],[1,3],[3,2],[4,1],[3,0],[5,-3],[1,-6],[-2,-5]],[[3941,9377],[-6,-2],[-3,0],[-3,1],[-2,1],[2,1],[1,1],[1,0],[1,0],[1,1],[3,0],[3,0],[2,0],[0,-3]],[[4764,9369],[-4,-2],[-4,1],[-2,3],[-3,5],[-2,8],[5,-3],[1,-1],[5,0],[3,-1],[1,-1],[2,-5],[-2,-4]],[[3927,9385],[-6,-6],[-7,2],[3,2],[4,2],[3,0],[3,0]],[[4777,9384],[-8,-3],[-3,1],[-3,2],[-2,1],[-1,3],[11,1],[2,-2],[4,-2],[0,-1]],[[5062,9390],[-7,-6],[-7,-2],[-4,-1],[-2,-2],[-2,-2],[-3,-2],[-4,0],[-4,1],[-3,2],[-1,2],[1,2],[0,2],[-1,3],[0,2],[3,-2],[2,-1],[2,-1],[2,2],[4,4],[2,2],[2,-1],[0,-1],[-1,-2],[0,-2],[1,-1],[2,0],[3,1],[2,0],[4,2],[4,7],[3,2],[5,-3],[-3,-5]],[[4799,9404],[-6,-1],[-3,2],[2,5],[6,0],[6,-1],[3,-1],[-4,-3],[-4,-1]],[[4988,9418],[-3,-5],[0,1],[0,1],[0,1],[-1,2],[1,1],[2,2],[3,2],[2,1],[1,2],[1,-2],[-3,-4],[-1,-1],[-1,0],[-1,-1]],[[5142,9429],[-6,-2],[0,1],[1,1],[2,0],[5,2],[-2,-2]],[[5099,9413],[-1,0],[0,1],[-1,2],[2,6],[0,6],[1,5],[5,4],[-1,-4],[-4,-11],[0,-2],[1,-2],[0,-1],[-1,-2],[-1,-2]],[[5016,9445],[-3,-3],[0,2],[1,1],[0,1],[1,2],[2,0],[2,0],[-1,-1],[-1,-1],[-1,-1]],[[5126,9442],[-2,-2],[-1,-3],[-5,1],[-7,-1],[-2,2],[2,3],[2,0],[4,0],[3,0],[3,2],[5,4],[3,3],[1,0],[-1,-2],[-1,-3],[-4,-4]],[[4814,9461],[1,-2],[1,0],[-2,-3],[-1,0],[0,1],[-1,2],[0,2],[2,0]],[[5177,9468],[1,-2],[-1,-1],[-1,0],[-1,-2],[-2,1],[0,1],[2,2],[2,1]],[[4998,9457],[-4,-2],[-7,2],[-1,5],[7,5],[9,5],[7,-2],[-8,-9],[-3,-4]],[[4256,9470],[3,0],[6,0],[5,1],[0,-1],[1,-4],[0,-3],[-2,-3],[-1,-2],[-1,-1],[-4,-2],[-6,-1],[-5,0],[-3,3],[-4,3],[-3,5],[-1,5],[5,3],[3,1],[2,-1],[3,-2],[2,-1]],[[4434,9467],[-3,-1],[-3,0],[-3,1],[2,2],[-2,5],[0,3],[3,1],[2,0],[6,4],[4,1],[6,1],[4,-1],[2,-3],[-2,-2],[-5,-1],[-9,-1],[-3,-1],[0,-2],[2,-2],[1,-2],[-2,-2]],[[4160,9475],[-3,-1],[-3,2],[0,2],[2,3],[0,2],[-1,1],[0,2],[2,1],[2,-2],[2,-4],[1,-4],[-2,-2]],[[4199,9481],[-1,-1],[-2,1],[-2,3],[1,2],[0,1],[2,0],[3,-3],[-1,-3]],[[5022,9490],[-1,-3],[-1,4],[1,2],[1,0],[0,-3]],[[5096,9497],[-12,-7],[-2,0],[-1,-1],[-3,-7],[-11,-5],[-2,-2],[-1,0],[-1,0],[-1,1],[-1,1],[-3,-2],[-2,-3],[-3,-3],[-6,-2],[0,2],[-8,-6],[-4,-2],[1,1],[0,1],[0,1],[2,6],[2,2],[3,1],[4,2],[2,3],[3,4],[2,4],[4,2],[1,-2],[3,-4],[4,-2],[2,2],[1,1],[7,10],[1,-1],[1,-1],[1,4],[3,2],[6,3],[7,5],[3,3],[2,3],[1,-5],[-1,-5],[-4,-4]],[[4458,9502],[-4,-1],[-4,0],[-3,1],[-4,0],[-3,-1],[-3,-3],[-3,-3],[-1,-2],[0,1],[0,1],[1,2],[0,3],[0,2],[0,2],[-1,1],[6,1],[4,2],[4,2],[3,2],[1,-3],[2,-3],[2,-2],[3,-2]],[[3781,9509],[0,-3],[0,-8],[3,-3],[10,-7],[4,-6],[0,-6],[0,-6],[-1,-6],[-2,-4],[0,-2],[2,1],[2,1],[1,1],[3,0],[3,0],[7,-2],[1,-2],[3,1],[5,-3],[10,-7],[3,-3],[0,-1],[0,-5],[-1,-3],[-3,-2],[-9,-4],[-11,0],[-6,-2],[-5,3],[-7,3],[-7,2],[-7,1],[-3,1],[-5,4],[-4,1],[-3,0],[-5,-3],[-10,-1],[-19,-8],[-6,-1],[-8,0],[-7,2],[-3,2],[-3,4],[-1,2],[-1,2],[2,3],[2,1],[4,-1],[4,1],[0,4],[-1,10],[1,5],[4,-1],[7,-4],[5,-1],[5,1],[4,4],[3,5],[-1,5],[-2,18],[2,3],[1,3],[0,3],[-1,3],[-2,1],[-2,1],[-3,0],[-3,-1],[5,9],[2,3],[3,2],[5,3],[2,3],[7,11],[2,2],[4,1],[5,0],[4,1],[3,3],[2,-5],[2,-6],[3,-6],[5,-9],[0,-2],[-3,-6]],[[3807,9551],[3,-4],[2,2],[2,2],[2,2],[3,0],[3,-1],[3,-3],[2,-3],[0,-3],[-1,-4],[-7,-6],[0,-4],[1,-3],[3,-1],[2,1],[2,2],[9,9],[4,3],[2,-3],[-3,-8],[1,-1],[2,-2],[6,-7],[0,-2],[6,11],[14,3],[13,2],[6,6],[3,5],[7,0],[7,-1],[3,-3],[2,-1],[6,-3],[1,-2],[2,-10],[1,-2],[2,3],[4,18],[3,2],[3,1],[5,3],[7,7],[4,2],[2,-4],[1,-5],[1,-5],[1,-4],[9,-14],[1,-1],[2,1],[0,5],[-3,7],[0,2],[0,5],[0,2],[-1,0],[-1,0],[-2,1],[0,1],[0,1],[1,2],[1,6],[2,5],[3,4],[4,3],[6,1],[3,-2],[3,-4],[0,-6],[-1,-1],[-1,-2],[-1,-3],[3,-2],[2,1],[2,3],[1,2],[1,2],[3,0],[1,-1],[2,-1],[2,-1],[3,1],[4,2],[3,0],[3,-2],[2,-3],[0,-4],[-1,-4],[5,-2],[1,-4],[0,-6],[2,-6],[1,-1],[1,-2],[1,2],[4,2],[3,0],[3,-2],[1,-2],[1,-3],[0,-8],[-1,-3],[-1,-3],[-2,-1],[-5,2],[-3,-1],[-3,-4],[-2,-7],[-1,-8],[3,-5],[0,1],[1,-5],[-4,-1],[-5,0],[-3,1],[0,1],[-5,3],[-2,1],[-2,-1],[-11,-21],[-5,-5],[-2,-5],[-3,-1],[-3,0],[-2,0],[-6,-3],[-3,-3],[-2,-2],[-1,-2],[-22,-12],[-26,-21],[-4,-2],[-4,1],[-5,7],[-6,4],[-7,4],[-11,4],[-11,6],[-1,1],[-4,1],[-5,2],[-5,2],[-3,3],[0,1],[1,1],[0,1],[-1,0],[-2,1],[-1,0],[-11,9],[-6,4],[-2,2],[-2,4],[-1,1],[-5,1],[-5,1],[-4,2],[-1,4],[-1,15],[-1,4],[-1,1],[-2,1],[-1,1],[-5,7],[-2,3],[-5,24],[0,4],[-1,1],[-1,1],[-1,1],[0,2],[0,2],[0,2],[1,2],[2,2],[-6,6],[-2,4],[-1,4],[0,6],[1,5],[3,3],[3,4],[8,-11],[15,-17]],[[4328,9577],[1,-1],[-1,-2],[0,1],[-1,1],[-2,0],[-5,-2],[0,1],[-2,3],[-2,1],[4,1],[3,0],[2,0],[2,1],[1,-3],[0,-1]],[[5430,8395],[0,-3],[0,-65],[0,-65],[0,-65],[0,-64],[0,-65],[0,-65],[0,-65],[0,-65],[0,-65],[0,-65],[0,-64],[0,-65],[0,-65],[0,-65],[0,-65],[0,-65],[0,-64],[0,-65],[0,-65],[0,-65],[0,-65],[0,-65],[0,-65],[0,-64],[0,-65],[0,-65],[0,-65],[0,-65],[0,-65],[0,-65],[0,-64],[0,-65]],[[5430,6317],[-61,0],[-61,0],[-61,0],[-61,0],[-61,0],[-61,0],[-60,0],[-61,0],[-61,0],[-61,0],[-61,0],[-61,0],[-61,0],[-61,0],[-61,0],[-60,0],[-61,0],[-61,0],[-10,0],[-51,0],[-61,0],[-61,0],[-61,0],[-61,0],[-61,0],[-60,0],[-61,0],[-61,0],[-61,0],[-61,0],[-61,0],[-61,0],[-61,0]],[[3481,6317],[0,76],[0,77],[0,76],[0,76],[0,77],[0,76],[0,77],[0,76],[0,76],[0,77],[0,76],[0,77],[0,76],[0,76],[0,77],[0,76],[0,77],[0,76],[0,77],[0,76],[0,76],[0,77],[0,76],[0,77],[0,76],[0,76],[0,77],[0,76],[0,77],[0,76],[0,76],[0,77]],[[3481,8762],[2,0],[9,-2],[9,-4],[2,-2],[2,-2],[1,-2],[1,-3],[0,-2],[2,0],[6,-1],[4,-3],[2,-3],[1,-5],[-1,-4],[-1,-4],[-1,-4],[2,-4],[3,-5],[0,-4],[-1,-4],[-5,-9],[-4,-11],[5,1],[6,12],[4,-1],[-2,-3],[-1,-4],[0,-4],[2,-4],[6,28],[4,1],[0,4],[-1,13],[-1,3],[-2,2],[-1,5],[-1,11],[-2,15],[-1,5],[2,1],[3,-1],[3,-4],[1,-6],[2,0],[4,6],[8,0],[7,-4],[3,-6],[22,-6],[5,-4],[0,-1],[3,-11],[3,-2],[6,-3],[2,-2],[2,-3],[3,-8],[2,-3],[1,-3],[-3,-8],[0,-4],[10,7],[3,1],[4,-1],[1,-2],[0,-6],[1,-4],[1,-1],[4,1],[4,0],[3,0],[1,2],[-1,3],[-1,3],[-14,15],[-2,3],[-4,12],[-3,14],[-1,3],[1,2],[4,6],[1,3],[1,12],[1,1],[3,0],[6,-4],[3,0],[6,0],[8,-2],[3,0],[4,0],[5,2],[5,2],[1,1],[3,0],[1,1],[0,1],[1,1],[9,8],[2,0],[2,1],[4,-1],[6,-4],[-1,6],[3,12],[-2,3],[-2,-6],[-4,-4],[-13,-3],[-21,-10],[-8,-1],[8,10],[0,2],[-2,0],[-7,-4],[-4,-1],[-3,0],[-3,1],[-9,7],[-1,3],[2,3],[-5,3],[-5,4],[-4,5],[-4,9],[0,3],[1,2],[3,0],[8,1],[10,0],[6,1],[2,5],[2,1],[9,6],[2,2],[-4,0],[-6,-1],[-5,-3],[-7,-5],[-4,0],[-9,2],[-2,0],[-5,0],[-2,0],[-1,0],[-1,1],[-2,1],[-3,1],[-4,1],[-13,11],[-1,0],[-2,0],[-1,0],[-1,1],[-1,3],[-1,1],[-3,1],[-1,1],[-1,3],[-1,1],[-10,6],[-2,2],[3,18],[1,1],[6,6],[1,3],[0,2],[0,3],[1,2],[1,4],[2,3],[10,9],[2,4],[2,3],[1,5],[0,8],[-1,2],[-2,4],[0,2],[1,1],[3,-2],[3,-1],[3,2],[1,-2],[0,-3],[1,-2],[2,-1],[2,1],[3,2],[2,-1],[1,-3],[4,6],[-1,6],[-1,6],[2,3],[1,-7],[5,-2],[13,3],[6,2],[4,5],[2,7],[0,6],[0,4],[-3,2],[-2,2],[-2,3],[0,3],[2,4],[4,5],[12,9],[4,6],[-3,4],[0,-2],[-2,-2],[-1,-1],[-1,1],[1,4],[0,3],[-1,8],[0,3],[6,14],[3,7],[1,3],[0,7],[1,3],[1,3],[2,1],[2,1],[2,1],[2,6],[1,4],[2,3],[2,0],[2,-2],[0,-4],[0,-8],[1,-2],[4,-2],[8,-3],[3,2],[13,4],[4,3],[11,9],[5,-2],[6,6],[11,16],[5,5],[4,3],[4,1],[4,-2],[5,-4],[4,0],[-2,6],[-2,2],[-4,3],[-5,2],[-5,0],[-2,2],[-2,3],[-4,6],[-11,14],[-2,1],[-5,0],[-2,1],[-1,2],[1,24],[0,3],[2,2],[1,5],[-1,7],[0,6],[4,4],[2,0],[2,1],[2,1],[1,3],[3,-3],[0,-3],[2,-2],[4,-1],[5,1],[8,4],[4,1],[4,2],[3,4],[3,5],[1,5],[0,13],[2,7],[-1,4],[-2,4],[-1,4],[2,5],[3,0],[4,-2],[3,0],[1,1],[0,3],[0,2],[2,1],[2,1],[3,3],[3,1],[3,-1],[8,-4],[4,-1],[-4,5],[-1,3],[0,3],[2,2],[3,-2],[9,-17],[2,-1],[2,-1],[2,-1],[0,-3],[2,1],[2,-1],[2,-1],[2,0],[1,1],[1,1],[2,0],[1,0],[2,-1],[2,0],[2,0],[2,0],[2,2],[0,2],[-18,5],[1,-1],[-1,0],[-1,-1],[-2,0],[0,1],[-1,2],[-1,0],[0,1],[-3,4],[-1,1],[0,1],[-2,1],[2,2],[2,0],[2,-1],[2,0],[2,1],[2,2],[0,1],[0,1],[-1,2],[-1,1],[-5,0],[-1,1],[0,3],[6,14],[0,4],[-3,5],[0,2],[2,2],[4,2],[-1,2],[-4,3],[-1,0],[-3,1],[0,2],[6,3],[8,0],[7,-2],[4,-4],[4,0],[6,-1],[6,-2],[3,-2],[-2,-4],[0,-3],[2,-8],[1,-13],[1,-5],[1,3],[0,3],[1,3],[2,2],[7,-5],[8,-13],[5,-5],[-1,4],[0,1],[-1,1],[4,3],[4,-1],[8,-5],[-2,6],[-5,4],[-6,4],[-4,4],[-3,4],[0,3],[1,1],[5,0],[4,-1],[7,-4],[3,-1],[-1,3],[-2,3],[-5,5],[-1,0],[-5,1],[-1,2],[-1,2],[-2,2],[-4,2],[-2,-2],[-3,-1],[-4,2],[0,2],[1,2],[1,3],[-2,4],[8,1],[-3,3],[2,3],[7,3],[1,2],[1,1],[0,1],[2,1],[2,0],[1,-1],[1,-1],[2,-1],[20,-4],[5,-2],[0,4],[-1,3],[-3,5],[-1,3],[1,11],[-1,4],[-5,6],[-2,4],[1,4],[3,3],[3,2],[4,1],[2,-1],[4,-3],[1,-1],[2,1],[2,3],[2,1],[2,-2],[3,-4],[2,-2],[5,1],[6,-5],[4,-2],[2,-2],[1,-2],[3,-3],[5,1],[-4,5],[-1,2],[1,2],[3,4],[1,1],[0,5],[1,3],[2,8],[0,7],[1,2],[2,2],[2,1],[2,-1],[1,-5],[2,-3],[0,-2],[0,-10],[2,-10],[4,-8],[6,-6],[7,-5],[5,-2],[4,-2],[5,-1],[5,-1],[5,1],[9,2],[5,0],[2,0],[5,-3],[2,1],[18,3],[17,2],[8,3],[4,2],[5,5],[3,1],[2,1],[2,0],[2,-1],[1,-2],[0,-2],[1,-2],[4,-3],[10,-3],[5,-4],[5,-1],[5,-2],[2,0],[5,2],[8,5],[7,7],[4,4],[1,1],[10,3],[1,2],[2,6],[1,2],[3,1],[3,-2],[1,-3],[0,-4],[2,-6],[4,0],[5,3],[6,2],[3,0],[2,-1],[2,-2],[7,-12],[1,-5],[1,-1],[0,-1],[0,-2],[-1,-1],[-3,-2],[-1,-1],[-2,-2],[0,-1],[-1,-2],[1,-6],[3,5],[6,6],[4,7],[-6,15],[1,9],[3,8],[6,3],[5,1],[12,8],[4,2],[3,-1],[6,-4],[8,-3],[8,-2],[8,-1],[9,1],[-3,1],[-4,0],[-2,1],[-2,1],[-2,2],[-2,1],[-9,5],[-3,4],[-1,5],[-1,9],[6,30],[0,4],[-1,3],[-2,3],[-8,6],[-2,2],[2,4],[8,9],[3,4],[3,7],[2,2],[4,1],[0,2],[-10,4],[-8,1],[-3,2],[-4,2],[-3,3],[-3,3],[0,2],[1,1],[1,4],[-2,2],[-3,1],[-3,2],[2,4],[-5,1],[-3,7],[-13,6],[-4,2],[-10,1],[-5,-1],[-8,-5],[-5,0],[-5,1],[-5,0],[-2,0],[-1,-1],[-2,-1],[-2,-2],[-2,-2],[-1,-1],[-1,0],[-2,1],[-1,0],[-1,0],[-6,-6],[-4,-2],[-4,-1],[-5,2],[-3,2],[-2,3],[-3,1],[-1,1],[-1,2],[-1,3],[-1,2],[1,1],[3,0],[2,1],[0,2],[-3,3],[-6,-1],[-5,0],[-2,6],[-1,0],[-3,-2],[-2,1],[-2,2],[1,3],[4,1],[2,2],[0,3],[-3,2],[-5,-2],[-3,0],[-1,2],[1,3],[0,2],[-3,1],[-4,0],[-5,2],[-3,1],[-2,-1],[-5,-2],[-2,0],[-11,1],[0,1],[2,2],[3,1],[3,1],[-3,5],[3,0],[4,-2],[4,-1],[2,3],[-2,5],[-3,4],[-1,5],[1,0],[5,-1],[2,-1],[2,-2],[2,1],[0,2],[0,1],[-1,2],[1,3],[1,2],[1,-2],[1,-1],[3,-4],[7,-10],[1,-1],[1,0],[4,2],[4,4],[0,3],[-2,5],[-1,5],[4,-2],[1,1],[-2,5],[0,4],[1,0],[2,-1],[4,-1],[2,-2],[2,-4],[2,-3],[8,-3],[-1,-6],[2,-2],[3,1],[2,2],[2,1],[1,-2],[-1,-2],[-2,-4],[0,-1],[0,-2],[1,-3],[0,-3],[-1,-6],[0,-4],[2,-1],[1,0],[1,-1],[2,1],[0,2],[-1,1],[0,2],[2,3],[3,-5],[-1,-7],[1,-6],[5,-5],[6,-1],[0,4],[-3,6],[0,3],[3,1],[3,-2],[2,-2],[2,3],[0,3],[-2,2],[-4,4],[-1,1],[-1,-1],[-1,0],[-1,2],[0,1],[1,2],[0,1],[0,3],[0,3],[-1,3],[-2,3],[2,3],[-2,4],[-3,5],[-2,2],[-2,2],[0,4],[3,3],[6,-2],[2,-3],[1,-4],[3,-3],[3,-2],[2,-2],[3,-9],[2,-4],[4,-3],[1,3],[-2,8],[-1,9],[1,4],[4,2],[3,-1],[1,-1],[1,0],[3,2],[0,1],[1,3],[1,3],[1,-2],[1,-4],[7,-15],[0,-1],[0,-1],[-1,-1],[2,-4],[-2,-8],[2,-1],[3,1],[2,4],[2,8],[5,4],[7,-5],[5,-9],[4,-8],[-1,-2],[0,-2],[1,-2],[1,0],[1,0],[2,1],[0,1],[1,-1],[3,-3],[1,-2],[2,-4],[10,-7],[4,-7],[3,-8],[6,-7],[9,-2],[4,2],[5,3],[4,5],[2,6],[2,1],[2,0],[2,1],[3,3],[1,1],[0,1],[0,2],[0,1],[5,-1],[5,-2],[3,-2],[2,5],[-1,6],[-1,3],[-5,4],[1,2],[1,1],[2,-1],[5,-1],[1,0],[0,-1],[1,-1],[2,-1],[1,-1],[1,0],[1,-2],[3,-6],[1,-1],[5,-2],[6,-7],[4,-7],[3,-6],[1,0],[2,-2],[2,0],[2,-2],[0,-2],[-1,-6],[0,-3],[6,-8],[9,-17],[2,-3],[3,-3],[4,-3],[5,-1],[12,-2],[4,2],[2,7],[4,-1],[6,1],[2,0],[4,-2],[-1,-1],[-4,-2],[-2,-2],[-3,-3],[0,-3],[1,-3],[5,0],[4,0],[2,0],[1,2],[2,4],[2,2],[2,0],[2,-1],[2,-3],[-1,-1],[-2,-1],[-1,-2],[0,-1],[1,-1],[2,0],[4,0],[6,-3],[3,-1],[1,2],[2,1],[3,1],[4,2],[1,3],[3,-4],[0,-7],[-2,-8],[-2,-5],[1,-2],[2,3],[2,6],[2,3],[6,3],[1,0],[2,-1],[1,-1],[0,-2],[1,-1],[1,-2],[2,-1],[3,2],[4,1],[2,0],[1,3],[3,8],[4,-1],[3,0],[4,0],[4,1],[3,3],[8,9],[6,0],[2,0],[1,-1],[0,-1],[1,-1],[4,-1],[4,-1],[3,0],[3,4],[4,-5],[2,-3],[-2,-1],[-3,-1],[-2,-2],[-2,-2],[-1,-3],[-5,1],[-6,-3],[-2,-5],[2,-6],[10,-7],[11,-5],[9,5],[5,2],[2,2],[1,3],[1,3],[3,0],[4,0],[3,-2],[1,-4],[0,-1],[1,0],[1,-1],[1,-2],[-1,-3],[0,-2],[0,-1],[1,-3],[9,10],[2,1],[1,-2],[3,-7],[1,-2],[1,-2],[3,-1],[3,-1],[0,-3],[-1,0],[-3,-1],[-2,0],[0,-2],[1,-2],[1,-1],[1,-2],[1,-2],[1,-2],[0,-5],[0,-2],[-1,-2],[-1,-2],[1,-2],[1,-1],[2,1],[2,5],[8,6],[3,2],[0,4],[0,3],[1,2],[4,2],[14,-12],[7,-5],[11,-3],[20,-2],[8,3],[5,0],[2,-3],[3,4],[6,4],[14,14],[1,1],[4,2],[6,1],[4,0],[1,-1],[0,-2],[0,-5],[0,-2],[2,-2],[2,-3],[1,-2],[1,-3],[1,-1],[2,0],[3,1],[2,0],[1,-2],[1,-9],[1,-5],[2,-3],[4,-2],[10,0],[3,0],[2,-1],[4,-1],[1,-1],[1,-2],[3,-5],[2,-5],[1,-1],[8,-4],[1,-2],[1,0],[4,-5],[3,-1],[2,0],[5,3],[4,1],[3,0],[2,-2],[3,-4],[4,-2],[3,-3],[3,-1],[5,2],[-2,3],[-9,5],[-4,6],[8,-1],[6,1],[5,1],[2,-3],[3,-3],[5,-2],[4,2],[3,1],[3,2],[0,2],[-5,-2],[-5,1],[-3,1],[-6,4],[-5,0],[-4,4],[4,2],[6,0],[9,5],[1,1],[2,2],[0,1],[-3,1],[-1,1],[5,4],[5,2],[4,3],[4,0],[6,1],[1,-1],[-2,-4],[4,-2],[7,1],[5,1],[5,2],[2,4],[0,3],[4,1],[0,-4],[8,-4],[3,0],[8,7],[1,0],[5,3],[1,1],[12,7],[-2,2],[-11,-3],[-3,-1],[-9,-7],[-3,0],[-2,3],[-1,4],[1,7],[4,6],[2,2],[5,1],[1,-1],[1,-1],[1,-1],[2,0],[2,0],[1,1],[1,2],[1,1],[3,2],[4,1],[4,1],[4,-3],[8,5],[8,7],[5,3],[1,1],[1,3],[2,1],[3,1],[2,1],[2,4],[-1,4],[-2,4],[-1,5],[2,2],[5,0],[5,-2],[3,-2],[-3,-9],[-4,-7],[-14,-14],[-6,-9],[-4,-2],[-8,-2],[-1,-1],[-1,-2],[-7,-4],[2,-2],[9,3],[4,2],[14,1],[4,1],[6,4],[5,0],[0,-1],[-3,-2],[-11,-3],[-5,-4],[-8,-6],[-6,-8],[-8,-7],[-2,-1],[-6,-5],[-5,-4],[-4,-4],[0,-8],[4,-7],[4,-3],[4,-4],[2,-2],[4,-8],[4,9],[3,3],[3,-1],[1,0],[2,6],[3,4],[9,6],[7,8],[2,2],[1,-1],[2,-2],[1,-3],[0,-1],[1,-1],[1,1],[3,4],[1,2],[2,1],[2,-1],[3,1],[13,14],[5,3],[-1,-4],[-3,-4],[-3,-4],[-2,-1],[-1,-1],[-3,-3],[0,-1],[-1,-3],[-1,-1],[-6,-4],[-3,-2],[-1,-2],[0,-2],[1,-2],[1,-1],[1,-2],[1,-5],[4,-1],[5,1],[3,2],[3,2],[4,2],[4,0],[1,-5],[-1,-2],[-2,-2],[-2,0],[-1,-1],[0,-1],[-3,-7],[-7,-9],[-2,-2],[1,-2],[0,-3],[1,-2],[2,1],[3,1],[0,-2],[-1,-4],[1,-5],[2,-4],[2,-3],[4,2],[0,2],[1,2],[0,2],[3,1],[1,-1],[1,-1],[0,-1],[1,-1],[1,-1],[2,1],[1,0],[8,2],[2,0],[2,-1],[2,-4],[1,-1],[5,1],[5,1],[7,3],[7,5],[5,7],[6,18],[6,10],[1,4],[-1,4],[-3,2],[-3,2],[-4,0],[-3,0],[-5,-1],[-4,0],[-5,-1],[-3,4],[-2,1],[-6,-1],[-1,1],[-1,4],[1,2],[3,1],[6,1],[2,5],[11,14],[4,4],[4,0],[2,-1],[2,1],[5,5],[5,4],[7,7],[3,2],[2,1],[2,4],[3,0],[4,-2],[7,3],[3,4],[5,1],[3,2],[0,3],[2,-1],[2,-2],[-1,-2],[-3,-2],[-4,-3],[-4,-2],[-3,-1],[-3,-1],[-4,0],[-3,-2],[1,-4],[1,-4],[3,-1],[3,3],[3,1],[3,-1],[3,-10],[3,-9],[6,-1],[-1,-6],[0,-8],[2,-6],[4,-4],[2,-3],[6,-6],[2,-5],[1,-1],[6,-4],[6,0],[6,3],[5,5],[-2,2],[-1,2],[-6,1],[-3,3],[-3,4],[-4,-3],[1,4],[6,0],[4,3],[6,2],[5,-2],[6,-5],[3,-4],[6,0],[5,-2],[7,-9],[4,-6],[2,-7],[-1,-6],[4,-2],[5,3],[3,0],[-3,-5],[-2,-1],[-1,-1],[-2,0],[-4,0],[-5,-3],[-10,-10],[-14,-18],[-3,-4],[-2,-1],[-1,3],[3,4],[4,6],[0,1],[1,2],[0,2],[-1,2],[-2,1],[-2,-1],[-2,-2],[-1,-1],[-6,-3],[-1,-7],[2,-9],[4,-6],[-5,1],[-2,-1],[-6,-9],[-5,-12],[4,-6],[-2,-3],[-4,2],[-9,0],[-5,-2],[-1,-5],[2,-3],[2,-3],[0,-5],[0,-2],[1,-3],[-1,-2],[-2,-3],[-3,0],[-2,2],[-1,3],[-1,4],[-2,6],[0,2],[-1,1],[-1,1],[-2,0],[-2,0],[-2,-1],[-1,-1],[0,-3],[1,-3],[0,-3],[0,-2],[-4,0],[-4,5],[-4,3],[-1,-1],[0,-4],[2,-8],[1,-3],[1,-2],[8,-7],[4,2],[0,-4],[0,-5],[2,0],[3,0],[9,-6],[6,-3],[0,-5],[4,-4],[0,-3],[-1,-1],[-2,1],[-2,2],[-1,1],[-2,1],[0,2],[-1,0],[-3,0],[-4,-7],[-4,0],[0,7],[-2,4],[-3,0],[-2,-2],[0,-1],[-1,0],[-2,2],[-1,0],[-4,-2],[0,-1],[-1,-3],[1,-1],[1,-2],[1,-1],[1,-1],[3,0],[0,-1],[0,-2],[2,-4],[8,-2],[-7,-10],[-1,-11],[-4,2],[-5,-1],[-2,-4],[-1,-5],[0,-8],[-1,-3],[-3,-2],[0,2],[-1,2],[-1,3],[-1,0],[-2,-2],[-8,-3],[-2,-5],[-5,-7],[-3,-3],[-2,-3],[-3,1],[1,2],[-3,0],[0,3],[5,3],[0,3],[-2,2],[1,2],[3,0],[3,-1],[3,2],[2,4],[-2,3],[-3,4],[1,7],[-1,3],[0,12],[1,7],[-1,2],[-5,2],[-2,0],[-3,-4],[-2,-3],[-1,-3],[0,-3],[3,-4],[-2,-3],[0,-4],[-1,-2],[-4,0],[-3,1],[-3,7],[-2,-1],[-3,-2],[-1,-2],[1,-4],[2,-3],[0,-3],[-3,-3],[-2,1],[-1,0],[-1,-2],[-1,-2],[0,1],[0,-3],[-3,-1],[-4,0],[-4,-6],[-2,5],[-2,7],[4,8],[0,6],[-2,5],[-3,-1],[-7,-7],[-4,-9],[0,-7],[-2,0],[-2,2],[-2,0],[-1,-2],[0,-3],[1,-10],[-1,-5],[-1,0],[-2,6],[0,6],[-2,5],[-5,5],[-3,-1],[-3,-3],[-2,-10],[-3,-2],[-1,5],[-2,2],[-4,-3],[-3,-4],[0,-4],[-6,-5],[0,-9],[7,-1],[2,-1],[1,-2],[0,-3],[-2,-1],[1,-2],[3,-1],[5,1],[1,0],[1,-3],[0,-2],[-1,-3],[-4,1],[-2,-1],[-4,-3],[-4,6],[-4,1],[-4,-1],[-2,-4],[2,-6],[0,-5],[1,-8],[0,-2],[-1,-2],[-1,0],[-2,-2],[0,-2],[-1,-5],[2,-3],[4,-9],[3,-3],[7,3],[0,-1],[1,-2],[0,-1],[-6,-3],[-2,-6],[3,-5],[8,-3],[7,2],[6,4],[8,11],[1,2],[-1,1],[1,1],[2,2],[2,0],[1,0],[2,-1],[1,-1],[1,-2],[-2,-2],[-4,-3],[-1,-3],[-3,-11],[-6,-10],[1,-3],[0,-3],[-1,-5],[-1,-1],[-1,-1],[-1,-1],[0,-2],[0,-6],[0,-1],[-6,-8],[-9,-5],[-4,-39],[1,-13],[-4,2],[-5,-1],[-3,-2],[-1,-3],[-2,-1],[-5,-1],[-1,-1],[-1,0],[-4,-3],[-1,0],[-5,-5],[-6,-7],[-13,-24],[-1,-5],[-4,-2],[-6,1],[-3,-4],[-12,-21],[-5,-7],[-3,-8],[1,-8],[-4,-2],[-5,-2],[-6,-3],[-2,-4],[-1,-2],[-1,-2],[-4,-1],[-2,1],[-3,2],[-3,0],[-2,-3],[3,0],[2,-3],[1,-9],[2,-8],[9,-22],[5,-7],[18,-16],[6,-3],[7,-3],[3,1],[4,1],[2,-1],[3,-5],[6,-5],[3,-2],[2,-4],[4,1],[5,-1],[4,-2],[1,-3],[3,-2],[14,-6],[5,-5],[7,-8],[7,-7],[8,-3],[3,0],[9,-5],[4,-2],[6,-6],[3,-2],[2,-1],[5,-1],[7,-5],[8,-4],[4,-2],[3,-3],[1,-1],[3,-10],[3,-16],[1,-3],[2,-3],[10,-7],[4,-2],[10,-1],[5,-1],[11,-12],[6,-3],[3,-3],[4,-3],[6,-2],[2,1],[2,2],[2,1],[2,-1],[1,-1],[2,-6],[1,-2],[10,-8],[3,-2],[7,-11],[3,-1],[1,-2],[-1,-4],[-2,-4],[-1,-4],[3,-4],[4,-1],[3,3],[2,3],[2,3],[4,0],[9,-2],[7,0],[2,0],[2,-1],[4,-4],[2,-1],[4,0],[0,1],[-1,3],[2,5],[3,2],[9,4],[1,1],[4,-6],[8,-7],[10,-5],[9,-3],[4,-3],[2,-1],[4,-1],[2,0],[2,-1],[11,-8],[2,-2],[2,-2],[5,-7],[15,-11],[4,-1],[5,0],[3,-1],[1,-2],[0,-2],[3,0],[2,0],[2,0],[5,-5],[2,-1],[3,0],[5,1],[2,1],[4,-1],[24,-9],[7,-4],[8,-3],[4,-2],[7,-11],[1,-3],[13,-18],[1,-3],[4,-5],[10,-9],[8,-7],[11,-7]],[[4348,9593],[-2,-1],[-2,3],[0,3],[-2,3],[3,-2],[3,-1],[1,0],[1,-2],[-1,-1],[-1,-2]],[[5162,9608],[0,-4],[-4,-12],[-2,-10],[-3,-8],[-1,-7],[-2,-1],[-1,0],[-5,-3],[-3,-7],[-6,-7],[-3,-9],[-3,-1],[-5,-10],[-10,-11],[-1,-3],[-3,-1],[0,2],[-2,1],[-1,-1],[-3,-4],[-4,2],[4,3],[1,3],[-4,2],[3,3],[7,5],[7,4],[1,2],[3,4],[0,6],[1,4],[7,10],[8,11],[8,2],[2,9],[2,4],[1,5],[2,2],[2,2],[1,3],[-4,3],[5,5],[0,-1],[1,0],[1,0],[1,-1],[0,2],[2,2]],[[4310,9619],[0,-1],[-1,-2],[0,-2],[0,-2],[-1,2],[0,2],[-1,1],[0,1],[2,0],[1,1]],[[4258,9604],[2,-6],[-1,0],[2,-2],[1,-2],[1,-3],[1,-3],[-1,-3],[-2,0],[-2,0],[-1,-2],[-1,-4],[3,-2],[5,0],[3,-3],[-5,-2],[0,-3],[2,-4],[2,-7],[-2,-5],[-4,-10],[-1,-6],[-7,7],[-1,8],[-2,6],[-4,6],[-9,12],[0,1],[1,2],[1,1],[2,1],[2,1],[0,2],[-2,9],[0,2],[-3,1],[-2,2],[-1,3],[-2,3],[-1,2],[3,-1],[4,-1],[2,-2],[2,1],[3,1],[4,1],[2,3],[0,4],[1,4],[3,3],[4,0],[0,-3],[-3,-4],[-1,-2],[1,-3],[1,-3]],[[2019,4523],[-2,0],[-1,1],[1,2],[0,4],[-1,2],[2,2],[3,-1],[1,-1],[-2,-3],[0,-3],[-1,-3]],[[597,4951],[1,-5],[-4,1],[-1,0],[0,5],[-2,6],[0,5],[2,3],[1,-6],[3,-9]],[[570,4997],[-4,-3],[-4,-1],[-5,1],[-7,-1],[-4,1],[4,2],[5,0],[2,3],[7,1],[4,-2],[2,-1]],[[168,5771],[-2,-1],[-1,4],[0,4],[5,1],[1,2],[2,2],[4,0],[3,0],[-4,-3],[-4,-4],[-3,-2],[-1,-3]],[[9,6430],[2,-2],[3,0],[3,1],[2,-2],[0,-1],[0,-6],[0,-5],[3,-8],[5,-9],[1,-11],[1,-8],[4,-7],[4,-10],[6,-12],[4,-8],[-5,-12],[0,-5],[7,-1],[-1,1],[-1,2],[-1,1],[3,1],[2,-3],[2,-4],[3,-4],[1,-1],[3,-4],[1,-2],[2,-2],[0,-5],[1,-2],[2,-4],[0,-5],[-1,-5],[-3,-2],[-2,1],[-4,2],[-2,7],[-3,9],[-4,4],[-2,3],[-10,12],[-8,6],[-7,21],[-10,11],[-3,5],[2,2],[1,2],[-2,12],[-8,15],[0,12],[1,4],[-1,7],[3,4],[3,3],[3,2]],[[32,6476],[-1,0],[-1,2],[-1,1],[0,5],[5,15],[1,7],[0,17],[2,7],[6,4],[-2,-7],[0,-4],[1,-2],[-2,-2],[0,-5],[0,-8],[-1,-4],[-4,-7],[-1,-4],[0,-8],[0,-4],[-2,-3]],[[44,6542],[-1,-5],[0,3],[0,1],[-1,2],[-1,2],[5,35],[4,10],[2,-4],[0,-6],[-5,-20],[0,-5],[3,-3],[-5,-6],[-1,-4]],[[540,7451],[-1,-4],[-3,-2],[-7,-3],[-1,3],[-2,2],[-3,1],[-1,0],[-1,-3],[-2,-2],[-2,1],[-2,3],[1,3],[2,9],[4,6],[15,18],[6,5],[5,0],[1,-3],[0,-7],[2,-3],[1,-4],[-1,-4],[-5,-7],[0,-1],[0,-2],[-1,-2],[-1,-1],[-1,0],[-3,-3]],[[788,7508],[0,-5],[-1,-4],[-5,0],[-8,0],[-4,1],[-2,2],[3,4],[8,1],[1,-3],[3,0],[0,3],[3,3],[2,-2]],[[2295,8376],[-1,-2],[-2,-1],[-4,0],[-2,2],[-2,0],[-1,1],[-2,1],[1,1],[3,0],[2,0],[4,-2],[1,1],[1,2],[1,1],[2,-1],[0,-1],[-1,-2]],[[2266,8383],[-1,-1],[-1,0],[-4,4],[-2,5],[-1,4],[1,2],[1,0],[0,-1],[0,-1],[2,-4],[4,-3],[1,-2],[0,-3]],[[2257,8416],[-1,1],[1,1],[-1,1],[1,1],[-1,1],[2,1],[1,0],[0,-1],[0,-1],[0,-1],[1,0],[-1,-1],[-1,-1],[-1,-1]],[[2210,8419],[0,-1],[-2,0],[-2,0],[-2,1],[-1,0],[-2,1],[1,1],[1,0],[0,1],[1,1],[1,-1],[1,-1],[0,-1],[1,0],[1,-1],[2,0]],[[2229,8422],[-1,-1],[-1,0],[-1,0],[-1,0],[0,1],[1,2],[1,1],[1,1],[1,2],[1,-1],[0,-2],[0,-1],[-1,-1],[0,-1]],[[2224,8422],[-1,-3],[-2,0],[-1,0],[-1,0],[-1,1],[-2,0],[-1,0],[2,1],[2,2],[1,2],[0,2],[-2,1],[1,1],[1,0],[2,0],[2,-1],[2,0],[1,0],[0,-1],[-1,-2],[-1,-2],[-1,-1]],[[2450,8430],[1,0],[0,1],[1,0],[1,-1],[1,0],[0,-1],[-1,-2],[-4,1],[-3,3],[0,3],[-1,1],[0,1],[1,1],[0,1],[1,-1],[0,-2],[0,-1],[1,0],[1,-1],[0,-1],[1,0],[0,-1],[0,-1]],[[2259,8436],[1,-2],[-1,0],[-1,1],[-1,0],[-1,0],[-1,0],[-1,3],[1,2],[1,1],[0,-1],[1,0],[1,-1],[0,-1],[1,-2]],[[2318,8436],[-1,0],[-1,1],[-1,0],[-2,2],[-1,2],[0,1],[1,0],[3,-2],[1,-1],[1,-1],[0,-2]],[[2299,8456],[-1,-2],[-1,-1],[-1,0],[0,1],[-1,0],[-1,1],[0,1],[-1,0],[-1,1],[1,0],[2,-1],[2,0],[1,1],[1,0],[0,1],[0,-2]],[[2373,8462],[9,-6],[3,-3],[0,-1],[-3,0],[-3,1],[-1,0],[0,1],[0,1],[-1,1],[-1,1],[-5,2],[-2,2],[0,1],[2,-1],[1,-1],[0,1],[0,1],[1,0]],[[2424,8462],[0,-1],[1,1],[1,-1],[2,-1],[2,-1],[-4,-1],[-3,1],[-2,-2],[0,1],[-1,0],[-1,1],[0,1],[1,1],[1,0],[2,0],[0,1],[-1,1],[1,0],[1,0],[0,-1]],[[2290,8460],[7,-2],[-1,0],[-5,0],[-2,0],[1,-3],[2,-1],[-2,-2],[0,-1],[-1,0],[-2,1],[0,1],[0,1],[-2,5],[0,1],[-1,2],[-2,0],[-3,2],[0,1],[1,1],[0,1],[1,1],[2,-1],[2,0],[2,-2],[0,-1],[2,-3],[1,-1]],[[2254,8481],[0,-1],[1,0],[2,1],[1,-2],[-1,0],[1,-1],[-1,-1],[0,-1],[-2,1],[-1,1],[-1,1],[-1,0],[0,1],[0,1],[1,0],[1,0]],[[2294,8478],[-1,0],[-2,1],[1,3],[1,0],[1,0],[1,0],[1,-1],[0,-2],[-1,-1],[-1,0]],[[2413,8484],[2,-1],[0,1],[2,-2],[1,-1],[0,-2],[1,-1],[-1,-1],[-2,0],[-2,1],[-1,1],[-1,1],[-1,1],[1,0],[0,1],[0,1],[0,1],[0,1],[1,0],[0,-1]],[[2269,8488],[2,-1],[1,-1],[1,0],[0,-2],[-2,0],[0,1],[-1,1],[0,-1],[-1,0],[-1,-1],[-1,1],[-1,1],[1,0],[0,2],[1,0],[0,1],[-1,1],[1,0],[1,-1],[0,-1]],[[2340,8489],[1,-1],[1,1],[7,-2],[1,1],[1,1],[2,-1],[-1,-1],[0,-2],[2,-2],[0,-1],[-2,-1],[1,-1],[-1,-1],[-2,2],[-2,0],[0,-1],[1,-1],[-2,1],[-7,5],[-6,3],[-3,0],[-1,1],[1,1],[6,0],[2,0],[1,-1]],[[2419,8491],[0,-3],[-1,0],[0,1],[0,1],[-1,0],[-2,-2],[-1,0],[-1,-1],[-1,0],[0,2],[1,1],[-2,0],[0,1],[1,1],[1,2],[0,1],[3,-1],[3,-3]],[[2309,8496],[2,-1],[1,0],[1,0],[1,0],[3,-1],[1,-1],[2,0],[1,-1],[-1,0],[-1,-1],[-1,0],[0,-1],[-3,1],[-2,1],[-2,2],[-1,1],[-2,0],[1,1]],[[2267,8501],[1,-1],[1,0],[1,-1],[3,-1],[1,0],[-1,-1],[-3,2],[-4,0],[-2,1],[1,0],[1,0],[1,1]],[[2303,8498],[0,-1],[-1,0],[-1,-2],[1,-2],[-2,-1],[1,0],[-1,2],[-1,1],[0,-1],[-1,-1],[-1,1],[0,1],[-1,0],[0,1],[0,2],[-1,1],[2,2],[1,0],[2,-2],[1,0],[2,-1]],[[2247,8506],[1,0],[0,-2],[-3,-1],[-2,-1],[-1,1],[0,1],[1,1],[1,0],[1,0],[1,1],[1,0]],[[2297,8508],[-1,0],[0,-1],[2,1],[0,-1],[1,-1],[0,-1],[1,0],[1,0],[0,-2],[-1,0],[-1,0],[0,-1],[-1,0],[-1,1],[-1,1],[-2,2],[-1,2],[0,1],[1,-1],[0,2],[1,0],[2,-1],[0,-1]],[[2331,8522],[0,-1],[-1,0],[0,2],[1,1],[0,2],[0,2],[0,1],[1,0],[0,-1],[1,-1],[0,-2],[-1,-1],[0,-1],[-1,-1]],[[2448,8528],[-3,-1],[0,4],[2,0],[1,-3]],[[2443,8528],[1,-4],[4,1],[2,-2],[-1,-3],[-6,1],[-2,2],[-1,5],[0,2],[0,2],[3,-1],[0,-3]],[[2526,8535],[1,-2],[0,-2],[0,-1],[0,-1],[-1,-1],[0,-1],[-1,0],[0,-2],[-1,-1],[-1,0],[-1,0],[-2,-1],[-1,-1],[-1,-1],[-2,0],[-1,0],[-1,0],[0,3],[1,2],[1,2],[3,1],[1,0],[1,1],[0,2],[2,2],[0,-1],[2,1],[1,1]],[[2498,8532],[0,-1],[1,1],[0,-3],[0,-3],[-1,-1],[0,-1],[-1,-2],[-2,-6],[0,4],[1,0],[0,1],[0,2],[-1,2],[1,2],[0,1],[0,1],[0,2],[0,1],[0,1],[1,1],[0,1],[1,0],[0,-1],[1,0],[0,-1],[-1,-1]],[[2459,8667],[0,-2],[-2,0],[-2,1],[-1,0],[-1,0],[-4,-3],[-1,0],[0,4],[0,1],[9,4],[1,-1],[1,-4]],[[2495,8668],[-3,-2],[-2,0],[-2,1],[-3,1],[-1,-1],[-1,-1],[-1,-2],[-2,-1],[0,1],[-7,2],[-1,2],[-1,0],[0,1],[11,3],[5,2],[2,4],[1,1],[3,0],[2,-1],[2,-3],[-1,-2],[-3,-2],[-1,-2],[3,-1]],[[2521,8677],[-3,-9],[0,-2],[2,0],[3,-1],[2,-1],[-2,-4],[6,-2],[6,-10],[5,-1],[-4,-2],[-18,-7],[-4,-1],[-3,1],[-1,3],[1,2],[2,0],[2,-1],[4,6],[3,2],[3,1],[-3,0],[-7,2],[-2,-1],[-2,-2],[-2,0],[1,4],[-3,-3],[-3,0],[-2,1],[-4,2],[3,2],[0,3],[0,2],[0,1],[2,2],[1,1],[2,-1],[3,-2],[-1,2],[-1,2],[1,2],[2,1],[-4,0],[2,3],[10,7],[4,1],[-1,-3]],[[2579,8671],[-2,-1],[-4,1],[-3,2],[0,2],[0,2],[1,1],[2,4],[1,1],[3,-2],[2,0],[2,-1],[1,-1],[1,-2],[0,-1],[-2,-3],[-1,0],[-1,0],[0,-1],[0,-1]],[[3307,8695],[-2,-3],[-1,2],[-2,1],[-2,2],[-2,1],[-4,3],[-2,3],[0,3],[0,16],[1,2],[5,-3],[1,-8],[1,-2],[2,-1],[2,0],[1,-1],[2,-4],[1,-6],[-1,-5]],[[2601,8741],[-1,-2],[-2,-2],[1,-2],[2,-1],[1,0],[0,-4],[0,-2],[-2,-1],[-4,3],[-1,1],[-1,3],[-1,2],[-1,0],[-4,-1],[-1,1],[-1,4],[1,3],[4,1],[4,-4],[0,2],[1,2],[1,2],[2,2],[1,-2],[1,-3],[0,-2]],[[2559,8750],[-1,-4],[0,3],[0,2],[0,1],[0,1],[1,1],[2,0],[-1,-2],[0,-1],[-1,-1]],[[3360,8730],[0,-5],[-6,5],[-12,13],[-1,5],[-1,11],[1,3],[4,-1],[3,-4],[5,-11],[2,-3],[3,-2],[2,-5],[0,-6]],[[3333,8786],[-1,-1],[-2,3],[0,1],[-1,2],[1,1],[2,-1],[2,-1],[1,0],[2,-3],[-1,-1],[-1,0],[-1,0],[-1,0]],[[2613,8838],[0,-1],[-1,1],[-1,0],[0,-1],[-1,1],[1,1],[-1,2],[0,1],[1,0],[0,2],[1,0],[1,1],[0,1],[0,-1],[1,-1],[0,-1],[0,-1],[1,-1],[0,-2],[-2,-1]],[[2711,8847],[7,-2],[1,1],[1,1],[0,-1],[1,-1],[-2,-2],[-1,-2],[-1,0],[-2,1],[-2,2],[-2,3]],[[2661,8847],[-2,-6],[-4,-5],[-1,-2],[1,-2],[3,-6],[2,-3],[-3,-1],[-5,-3],[-1,0],[-1,1],[-1,-1],[-2,-1],[0,-2],[1,-2],[0,-1],[-1,-1],[-2,-1],[-2,4],[-2,2],[-1,1],[-2,0],[-2,-1],[-1,0],[0,3],[1,6],[0,7],[1,2],[3,-1],[3,-2],[2,-2],[0,4],[0,7],[-1,0],[-4,3],[2,4],[4,3],[3,2],[-1,3],[2,1],[3,-1],[1,-2],[0,-2],[1,-1],[1,-1],[2,0],[2,-1],[1,-2]],[[2735,8846],[-3,0],[-2,0],[-1,1],[-1,4],[-2,2],[0,2],[1,1],[3,4],[1,0],[0,-1],[1,-2],[-1,-1],[0,-1],[1,-1],[1,0],[0,-2],[-1,-2],[1,-1],[2,-1],[0,-2]],[[2611,8860],[-1,1],[-1,2],[1,2],[-2,1],[-1,0],[1,2],[1,0],[1,1],[0,-1],[2,-3],[-1,-1],[0,-3],[0,-1]],[[2823,8871],[-2,-2],[-3,0],[-2,2],[1,1],[1,0],[1,1],[-1,1],[3,3],[0,2],[1,1],[1,1],[0,1],[1,0],[1,0],[0,-2],[0,-1],[1,-1],[-1,-1],[-1,-1],[-1,-1],[0,-4]],[[2833,8887],[2,-1],[0,1],[2,-1],[2,-1],[2,-2],[0,-2],[-1,-1],[-2,0],[-2,0],[0,-3],[-2,-1],[-2,3],[0,1],[-1,3],[-2,2],[1,1],[0,2],[1,2],[1,1],[1,-1],[0,-2],[0,-1]],[[2681,8890],[-1,-1],[-1,1],[-1,0],[0,2],[0,1],[1,1],[1,-1],[3,0],[-1,-1],[-1,-2]],[[2768,8923],[-1,-2],[-1,1],[0,1],[0,1],[-1,3],[0,1],[1,1],[0,-1],[2,-1],[-1,-1],[1,-3]],[[2752,8966],[2,-1],[1,0],[0,-1],[-2,-1],[-1,-1],[-1,0],[0,2],[0,2],[-1,1],[2,2],[1,-1],[-1,-1],[0,-1]],[[2900,8970],[-2,-1],[-1,2],[0,2],[2,2],[1,0],[0,-4],[0,-1]],[[2964,8976],[0,-1],[-3,-1],[-2,1],[-4,1],[-3,0],[-3,0],[-3,-2],[-3,0],[-1,2],[-1,1],[-1,4],[5,1],[7,-1],[7,-2],[5,-3]],[[3481,6317],[0,-78],[0,-79],[0,-78],[0,-78],[0,-78],[0,-78],[0,-78],[0,-79],[0,-78],[0,-78],[0,-78],[0,-78],[0,-78],[0,-79],[0,-78],[0,-77]],[[3481,5067],[-2,-1],[-13,-3],[-34,-16],[-4,-3],[-7,-2],[-14,-10],[-95,-37],[-43,-15],[-55,-9],[-39,-13],[-4,0],[-2,-1],[-4,-4],[-2,-1],[-52,-14],[-39,-4],[-4,-2],[-2,2],[-6,-2],[-26,0],[-25,-2],[-6,2],[-7,-2],[-17,-1],[-67,7],[-20,6],[-6,3],[-10,1],[-4,1],[-3,-1],[-7,-1],[-3,-2],[-3,-3],[-2,-2],[-5,-1],[-16,1],[-6,-2],[-11,-5],[-12,-6],[-15,-9],[-28,-18],[-29,-20],[-14,-3],[-30,-9],[-17,-8],[-35,-16],[-13,-4],[-4,0],[-4,-2],[-21,-21],[-15,-7],[-19,-6],[-8,-2],[-41,-5],[-35,-6],[-9,-3],[-4,-2],[-9,-8],[-3,-2],[-4,-1],[-5,-3],[-7,-6],[-11,-12],[-5,-7],[-3,-8],[-1,-9],[-1,-5],[-3,-4],[-2,-3],[-8,-15],[-1,-2],[0,-1],[0,-2],[0,-3],[-2,-5],[-2,-5],[-4,-10],[-1,-4],[-1,-10],[-1,-5],[-4,-2],[-5,0],[-5,-2],[-3,-3],[-3,-4],[0,-1],[1,-1],[-1,-1],[-1,-1],[-9,-5],[-13,-12],[-3,-5],[-2,-5],[0,-2],[0,-3],[1,-1],[0,-2],[-2,-2],[-4,-3],[-9,-3],[-4,-2],[-2,-2],[-3,-5],[-1,-1],[-2,0],[-7,0],[-3,-2],[-9,-11],[-3,-1],[-4,2],[-3,3],[-1,2],[-3,2],[-17,2],[-8,-3],[-7,-6],[-10,-12],[-7,-3],[-1,0],[-1,1],[-2,1],[-1,0],[-1,-1],[-3,-2],[-1,0],[-7,-1],[-2,2],[-3,13],[-4,8],[-6,6],[-9,3],[-5,1],[-3,-1],[-3,-1],[-9,-1],[-16,-5],[-8,-2],[-5,0],[-2,1],[-5,4],[-2,1],[-3,0],[-6,-3],[-19,0],[-9,-1],[-7,-3],[2,-3],[0,-3],[-2,-3],[-3,-2],[-4,4],[-1,1],[-1,0],[-1,1],[-1,0],[-4,-3],[-3,0],[-22,7],[-8,0],[-9,-2],[-7,-5],[-2,-3],[-1,-3],[0,-7],[-1,-4],[-4,1],[-4,4],[-1,2],[-2,-1],[-2,-2],[-1,-3],[-2,0],[-20,0],[-4,1],[0,2],[6,5],[1,4],[-5,8],[-2,8],[-2,3],[-1,1],[-5,4],[-5,6],[-2,1],[-2,0],[-3,-1],[-10,0],[-5,-2],[-7,-7],[-3,-2],[-4,-1],[-8,-3],[-4,0],[-4,1],[-7,5],[-3,1],[-2,0],[-5,1],[-2,1],[-2,-1],[-3,-1],[-1,-2],[-2,-1],[-5,0],[-3,3],[-2,3],[-4,2],[-2,0],[-5,2],[-4,3],[-3,0],[-5,-1],[-35,2],[-5,-1],[-7,-3],[-11,-1],[-4,-2],[-10,-5],[-1,0],[-1,1],[-5,3],[-5,1],[-2,1],[-4,-1],[-9,-3],[-5,-1],[-5,0],[-3,0],[-2,-1],[-5,1],[-6,1],[-11,1],[-6,-2],[-5,-3],[-6,-2],[-5,1],[-4,-2],[-38,0],[-2,0],[-2,-1],[-2,-2],[0,-2],[0,-2],[-1,-1],[-3,-2],[-23,-7],[-6,-1],[-3,2],[-22,6],[-21,1],[-5,-1],[-8,-3],[-4,0],[-4,1],[-6,3],[-4,2],[-4,0],[-4,-1],[-3,-1],[-4,-1],[-5,-4],[-4,-2],[-4,0],[-11,-1],[-11,-4],[-3,-1],[-13,-13],[-7,-3],[-13,-5],[-6,-4],[2,-1],[-1,-2],[-2,-2],[-6,-1],[-2,-2],[-7,-15],[-1,-2],[-8,-4],[-3,-5],[-2,-6],[-1,-6],[0,-5],[3,-5],[5,-2],[6,-1],[5,-2],[-2,-1],[-3,-1],[-5,-1],[-7,-2],[-8,7],[-7,1],[-5,-4],[-2,-5],[1,-7],[4,-4],[-2,-1],[-5,-3],[0,-1],[0,-2],[-1,-1],[-2,1],[-1,0],[-2,4],[-1,5],[-4,1],[-3,0],[-4,-1],[-2,-2],[-1,-1],[-1,-5],[0,-5],[-1,-3],[-3,-1],[-4,-1],[-2,0],[-1,2],[0,3],[-1,1],[-2,2],[-3,1],[-2,0],[-4,-1],[-3,1],[-2,1],[-3,3],[-1,0],[-40,6],[-2,0],[-4,-2],[-2,-1],[-11,2],[-1,0],[9,-9],[1,-2],[-3,-1],[-14,-2],[-4,-1],[-8,-5],[-3,-1],[-3,-3],[0,-4],[1,-4],[6,-2],[-7,-7],[-4,-2],[-9,-2],[-7,-5],[-4,-2],[-20,-3],[-9,-3],[-8,-6],[-3,-3],[-4,-7],[-3,-4],[-2,-4],[0,-5],[3,-7],[-1,-5],[-3,-2],[-9,1],[-17,-1],[-4,-1],[-9,-5],[-8,-1],[-1,-1],[-1,-2],[2,-1],[2,-1],[1,0],[3,-4],[1,-4],[0,-3],[-4,-1],[-2,1],[-11,6],[-2,-1],[-1,1],[-3,-1],[-10,-3],[-3,-1],[-1,-1],[-2,0],[-2,0],[-5,1],[-2,1],[-1,-1],[-4,-1],[-2,0],[-1,0],[-1,1],[-2,1],[-1,0],[-1,-1],[-2,-2],[-13,-1],[-3,-2],[0,-3],[2,-3],[4,-2],[6,-3],[2,0],[1,2],[-1,2],[-1,2],[0,2],[2,1],[3,-1],[4,-8],[3,-1],[8,1],[3,-1],[-1,-3],[-3,0],[-3,0],[-4,-3],[-4,-1],[-9,1],[-6,1],[-11,9],[-14,4],[-13,1],[-4,0],[-6,-3],[-3,-4],[-1,-6],[0,-7],[-7,3],[-11,7],[-8,2],[-7,1],[-2,1],[-12,6],[-3,2],[-7,3],[-4,1],[-2,0],[-1,-3],[-5,1],[-8,3],[-4,0],[-2,0],[-1,-1],[-2,0],[-3,1],[-2,1],[-2,1],[-4,-2],[-3,-3],[-4,-7],[-3,1],[-4,4],[-3,1],[-4,0],[-5,2],[-3,1],[-3,-1],[-2,-1],[-3,0],[-2,1],[-3,1],[-3,1],[-3,0],[-3,-1],[-5,-4],[-3,-3],[-5,-1],[-7,2],[-3,1],[-9,5],[-9,2],[-3,1],[-1,-2],[0,-1],[-1,0],[1,-2],[-16,0],[-2,-2],[-2,-3],[-4,2],[-7,5],[-12,1],[-4,2],[-2,1],[-3,1],[-5,-1],[-2,1],[-5,5],[-9,5],[-4,4],[2,2],[18,-3],[5,-2],[2,0],[1,2],[-1,2],[-2,2],[-3,1],[-7,2],[-4,3],[-2,4],[-4,2],[-1,1],[-1,1],[-2,0],[-1,-2],[5,-9],[-5,-3],[-9,2],[-9,3],[-9,4],[-33,9],[-17,2],[-2,0],[-4,-1],[-3,-1],[-1,2],[1,2],[1,4],[-2,4],[-6,6],[-2,7],[-4,5],[-7,5],[-30,30],[-29,21],[-9,5],[-8,1],[-2,1],[-1,2],[-1,2],[-2,2],[-2,1],[-2,0],[-33,15],[-10,3],[-6,0],[-17,0],[-4,-2],[-6,-9],[-4,-3],[-2,4],[-20,18],[-1,4],[-1,6],[1,9],[0,3],[-2,4],[-6,12],[-1,2],[1,4],[0,31],[-3,9],[0,5],[1,4],[3,9],[2,4],[-4,6],[-2,8],[-1,8],[3,6],[6,5],[1,3],[0,5],[-3,12],[0,4],[3,0],[9,-3],[6,-6],[4,-7],[6,-5],[8,-3],[9,-3],[9,-1],[10,0],[9,1],[9,3],[8,4],[6,4],[18,18],[13,19],[6,13],[3,10],[2,3],[2,2],[2,0],[3,-1],[4,-1],[5,2],[2,6],[0,14],[-1,3],[-1,0],[-2,-2],[-1,-8],[-3,-10],[-1,0],[1,36],[0,21],[-3,19],[-7,28],[-3,18],[-2,8],[0,7],[2,9],[4,6],[10,13],[5,5],[-1,-9],[-12,-12],[0,-11],[6,-16],[5,-9],[5,-2],[2,4],[-1,5],[-4,8],[-4,3],[0,2],[0,3],[-1,2],[-1,3],[-2,2],[-1,1],[2,2],[2,0],[4,-3],[2,0],[10,-1],[3,3],[1,5],[-1,5],[-4,2],[-4,1],[-1,2],[-2,4],[0,3],[1,1],[2,4],[2,2],[2,8],[0,8],[-3,7],[-5,4],[5,5],[1,3],[-2,4],[-3,3],[-6,3],[-3,3],[10,0],[4,2],[1,5],[1,5],[2,8],[0,5],[-1,2],[-3,3],[0,2],[1,3],[0,3],[-1,2],[-2,4],[0,4],[3,28],[-4,34],[-5,18],[-4,10],[-17,22],[-11,25],[-21,29],[-16,37],[-15,31],[-16,25],[-12,11],[-4,14],[0,2],[-1,3],[-13,24],[0,2],[-1,4],[-7,18],[-1,4],[0,8],[-1,4],[-4,18],[-3,6],[0,1],[-2,2],[-1,2],[1,1],[2,2],[0,2],[1,5],[-1,2],[0,2],[-2,1],[-5,3],[-2,1],[-1,4],[1,5],[1,5],[1,5],[-1,2],[-2,5],[-1,5],[-2,2],[-2,2],[-1,1],[-1,8],[5,28],[0,5],[-3,8],[-1,3],[-1,19],[1,19],[3,17],[4,13],[0,4],[0,5],[-6,11],[-3,9],[-1,6],[0,4],[-1,4],[-4,7],[-3,13],[-12,28],[-2,3],[-39,40],[-1,2],[-7,10],[-2,4],[-3,9],[-3,3],[4,8],[0,10],[-1,10],[-13,30],[-5,6],[-19,20],[-11,17],[-1,3],[-2,4],[-10,14],[-3,2],[-8,3],[-3,3],[-17,19],[-3,6],[-1,2],[0,2],[-1,7],[0,2],[-8,25],[-2,9],[0,10],[1,5],[4,8],[1,4],[1,3],[3,4],[0,2],[0,3],[-15,53],[-13,29],[-20,31],[-34,56],[-24,31],[-14,22],[-12,12],[-15,14],[-23,23],[-3,2],[-7,6],[-3,4],[0,5],[-1,5],[1,3],[-3,5],[-3,6],[-6,11],[-6,5],[-8,9],[-5,5],[1,3],[6,-4],[5,-4],[4,-1],[6,-1],[2,-6],[2,-5],[1,8],[1,7],[2,8],[-1,8],[-1,8],[2,7],[3,6],[3,-27],[2,-25],[-1,-9],[2,-8],[3,-4],[3,-6],[1,-4],[4,-1],[-2,7],[-4,9],[-1,7],[2,11],[3,4],[1,24],[-5,12],[1,7],[5,-11],[2,-25],[4,5],[2,-1],[6,0],[0,-9],[2,-5],[0,-6],[3,-3],[1,-4],[2,-4],[2,-6],[1,-11],[-3,-5],[1,-8],[-3,-8],[2,-2],[4,3],[0,7],[0,5],[2,4],[2,9],[-3,9],[1,4],[0,5],[3,1],[3,-4],[1,-4],[1,-5],[2,-6],[-2,-7],[2,-6],[1,-7],[-2,-6],[2,-4],[0,-9],[0,-7],[3,0],[3,2],[1,3],[0,5],[1,2],[4,5],[0,4],[-1,5],[2,1],[4,-9],[0,-4],[0,-6],[0,-5],[-2,-5],[1,-3],[-2,-3],[3,-1],[4,1],[1,-4],[1,-4],[-1,-4],[4,0],[0,5],[2,4],[3,1],[6,2],[5,1],[3,2],[1,-3],[7,0],[1,8],[4,2],[4,2],[4,5],[3,6],[1,7],[-1,9],[-3,5],[3,5],[0,7],[-4,6],[-5,5],[-6,6],[-7,6],[-7,0],[-14,4],[-1,5],[0,3],[-3,4],[-4,6],[-8,10],[-8,1],[-1,7],[-1,5],[2,6],[-3,2],[-2,6],[1,7],[-8,4],[1,6],[-1,5],[-2,4],[-2,2],[-3,4],[-3,2],[-1,3],[0,2],[-2,4],[-3,2],[-5,8],[-2,6],[1,5],[1,6],[2,4],[4,7],[3,7],[5,6],[3,6],[3,2],[1,-7],[1,-9],[-1,-5],[3,-3],[3,0],[2,-1],[1,-2],[5,0],[2,-8],[3,-8],[5,-7],[6,-3],[4,-7],[5,-3],[6,0],[-1,-8],[-1,-3],[1,-5],[1,-1],[4,-2],[2,-1],[1,-4],[-1,-4],[-4,-3],[0,-4],[0,-7],[-1,-5],[-3,-5],[1,-4],[-2,-6],[0,-10],[-2,-6],[5,-7],[0,-4],[8,0],[0,-2],[7,0],[11,19],[4,9],[3,8],[-3,10],[-1,2],[-2,4],[0,2],[0,3],[0,1],[1,0],[2,-1],[4,-1],[5,-5],[0,-5],[-1,-7],[2,-13],[-1,-6],[4,-5],[5,0],[-3,-11],[2,-8],[2,-7],[1,-5],[1,-6],[1,-5],[12,-13],[10,-10],[3,-3],[4,0],[5,4],[4,4],[3,4],[6,3],[5,1],[2,7],[4,6],[-4,9],[-3,7],[-1,6],[-2,5],[2,6],[1,4],[3,10],[1,1],[1,2],[0,3],[0,3],[-2,4],[-6,9],[-1,5],[1,2],[2,-1],[3,-4],[1,-1],[3,1],[3,0],[2,1],[1,0],[2,0],[-2,4],[-2,2],[-3,3],[0,5],[1,4],[3,5],[2,5],[-1,4],[-4,3],[-10,6],[-8,3],[-2,4],[-1,3],[-2,2],[0,3],[-1,4],[-3,3],[-3,2],[-1,1],[-1,4],[-1,1],[-8,4],[-2,3],[-6,14],[-14,18],[-5,9],[-14,32],[-1,5],[-1,3],[-8,13],[-2,5],[-1,3],[-3,2],[-9,5],[-7,3],[-5,4],[-3,5],[-2,8],[-3,5],[-1,4],[-1,3],[0,2],[1,1],[2,4],[1,1],[1,5],[-2,5],[-4,3],[-6,1],[-1,5],[0,4],[-1,5],[2,3],[2,4],[-1,6],[-1,5],[-2,4],[-13,19],[-22,24],[-5,8],[-4,9],[-2,9],[-1,36],[1,5],[1,3],[6,5],[2,5],[0,5],[-3,9],[-1,8],[0,4],[2,4],[3,3],[2,2],[2,4],[1,5],[0,5],[-1,4],[1,4],[7,8],[2,4],[5,20],[3,3],[5,2],[8,24],[1,2],[2,1],[2,0],[1,1],[1,3],[1,1],[5,2],[5,1],[2,3],[1,2],[1,2],[8,5],[3,3],[1,6],[0,2],[2,2],[1,2],[0,15],[2,9],[1,5],[-3,19],[-4,13],[-1,4],[2,5],[0,3],[1,2],[2,1],[2,2],[2,2],[4,4],[1,6],[-1,26],[-1,7],[-3,5],[-3,5],[-3,14],[-10,11],[-2,1],[-3,1],[-3,1],[-4,0],[3,8],[0,5],[-2,4],[-1,2],[0,7],[-1,3],[-1,2],[-1,2],[2,3],[2,2],[4,2],[2,2],[6,9],[3,3],[0,2],[2,10],[1,5],[3,5],[7,7],[2,4],[18,48],[1,5],[1,5],[1,4],[5,8],[5,13],[14,20],[6,5],[6,4],[5,2],[4,0],[5,2],[3,1],[3,1],[3,-2],[1,-4],[-2,-3],[-3,-3],[-2,-3],[0,-4],[-3,-9],[-7,-41],[-3,-7],[-1,-8],[3,-8],[2,-2],[4,-9],[1,-3],[-3,-8],[0,-4],[3,-1],[1,2],[2,4],[2,3],[4,-2],[1,-3],[0,-5],[-2,-4],[-2,0],[-6,-7],[-2,-2],[1,-3],[1,-6],[-3,-8],[2,-6],[6,-4],[7,0],[3,3],[3,5],[3,4],[6,2],[3,0],[2,2],[3,1],[3,-1],[1,-3],[1,-3],[2,-3],[4,-1],[4,2],[2,1],[1,3],[0,5],[1,2],[2,5],[0,2],[1,5],[1,5],[6,13],[2,6],[2,6],[1,1],[5,7],[0,3],[-1,3],[1,2],[2,1],[3,0],[2,1],[1,8],[4,8],[0,4],[-1,2],[-2,3],[-1,1],[-1,2],[-1,4],[0,3],[2,1],[4,-3],[4,-4],[2,-3],[11,19],[2,7],[1,0],[1,0],[0,1],[1,0],[1,2],[1,3],[1,9],[2,3],[5,1],[2,1],[3,4],[2,1],[17,7],[32,19],[9,2],[8,-2],[10,4],[3,1],[2,2],[3,2],[2,0],[1,-3],[26,15],[50,18],[5,3],[2,4],[2,4],[2,3],[7,6],[14,18],[5,5],[8,5],[31,14],[3,2],[2,7],[6,8],[4,9],[6,7],[7,5],[5,3],[3,0],[11,6],[7,2],[3,1],[3,3],[8,1],[7,4],[5,6],[3,8],[0,10],[1,3],[5,1],[3,-1],[3,-2],[4,-2],[6,0],[4,2],[5,5],[3,1],[10,0],[9,1],[4,2],[6,5],[2,1],[2,0],[1,1],[2,2],[2,5],[2,1],[4,0],[8,2],[24,17],[10,9],[8,13],[3,2],[-1,3],[3,2],[2,0],[2,0],[3,-1],[2,-1],[0,-1],[-2,0],[-3,-2],[-2,-4],[-1,-9],[-1,-2],[-3,-3],[-1,-3],[0,-2],[0,-2],[11,-9],[4,-1],[5,-1],[5,1],[4,3],[4,2],[2,3],[2,1],[23,10],[2,1],[4,-3],[1,-1],[3,0],[2,2],[6,5],[2,2],[1,0],[2,-2],[0,-1],[0,-1],[0,-2],[-2,-3],[0,-2],[1,-1],[2,-2],[2,-3],[3,-2],[16,-7],[9,-2],[9,-1],[18,1],[17,4],[6,3],[8,5],[5,3],[4,-1],[3,-3],[3,0],[3,3],[0,1],[2,-1],[1,-2],[-1,-1],[4,1],[8,4],[2,-2],[3,2],[8,3],[5,3],[4,1],[2,0],[2,3],[3,5],[1,1],[3,3],[1,0],[6,1],[1,1],[3,4],[1,2],[-1,4],[1,2],[1,2],[42,28],[4,2],[2,0],[2,1],[1,1],[3,-1],[0,-1],[0,-2],[1,-2],[3,2],[5,-2],[4,2],[3,2],[4,1],[2,1],[4,2],[3,0],[2,0],[1,-2],[1,-2],[2,-2],[4,0],[9,4],[30,5],[1,0],[2,0],[1,1],[1,0],[1,1],[6,1],[2,0],[3,0],[1,-1],[1,-1],[2,-1],[3,0],[4,0],[5,1],[8,6],[5,1],[5,0],[4,1],[6,4],[4,6],[7,11],[16,18],[3,7],[1,5],[2,2],[3,1],[4,3],[7,2],[2,1],[1,2],[0,2],[1,2],[6,3],[5,-1],[9,-8],[0,6],[1,3],[2,2],[4,0],[4,0],[18,-6],[9,-1],[5,-1],[4,0],[9,-3],[4,-1],[2,0],[2,3],[2,0],[2,-1],[1,-2],[1,-2],[1,-2],[8,-5],[5,-2],[4,-1],[5,1],[7,4],[3,1],[2,1],[4,6],[2,0],[4,-1],[2,0],[4,2],[0,2],[-1,3],[0,2],[4,2],[5,1],[10,-1],[23,4],[35,5],[36,3],[29,9],[61,23],[33,14],[32,14],[38,25],[8,8],[3,1],[3,2],[26,26],[22,29],[23,33],[4,13],[4,5],[1,3],[1,5],[1,2],[1,2],[3,3],[2,2],[3,10],[4,9],[2,3],[2,6],[0,2],[-1,3],[-1,2],[-2,1],[-2,2],[-2,6],[3,0],[4,-1],[3,0],[2,2],[2,0],[8,1],[2,1],[10,9],[2,4],[0,4],[-1,3],[-3,2],[-6,4],[6,4],[3,4],[5,12],[3,6],[3,2],[3,-1],[3,-1],[3,-2],[5,0],[4,1],[25,18],[4,5],[2,7],[2,2],[13,6],[5,3],[3,4],[6,8],[0,-1],[2,-1],[1,-1],[2,6],[3,3],[6,2],[16,8],[5,7],[3,7],[2,5],[-1,9],[-1,5],[-4,4],[-6,3],[-7,1],[-7,1],[-7,-2],[-4,-6],[-2,0],[-1,1],[-1,1],[-1,1],[-1,1],[5,7],[3,8],[0,8],[-3,15],[1,14],[0,2],[1,2],[0,3],[-1,2],[-2,4],[-3,4],[0,2],[-1,6],[-3,7],[-1,2],[-2,3],[0,2],[-1,23],[2,26],[4,10],[1,8],[2,3],[2,3],[4,2],[1,3],[12,13],[2,3],[-1,2],[-2,0],[-2,1],[2,5],[3,2],[29,26],[8,5],[-1,-4],[1,-3],[3,0],[3,2],[1,5],[-1,4],[-1,3],[4,1],[3,-1],[2,-2],[2,-3],[1,-3],[3,-1],[12,-3],[-3,4],[-5,10],[-6,8],[-1,2],[0,3],[1,1],[1,1],[1,1],[1,-1],[1,1],[1,1],[-1,3],[1,1],[1,3],[2,3],[3,2],[4,1],[1,-3],[2,-2],[2,-1],[4,0],[2,1],[3,2],[2,0],[5,0],[1,0],[3,2],[3,2],[2,2],[4,0],[3,-1],[11,-4],[-13,11],[-4,6],[0,8],[1,1],[2,4],[0,1],[0,8],[1,2],[2,4],[3,2],[2,2],[7,-1],[2,0],[3,2],[1,3],[1,3],[2,2],[4,1],[2,5],[1,9],[3,7],[5,0],[15,10],[3,-2],[-1,-3],[-4,-6],[9,-4],[4,-3],[-1,-4],[-3,-1],[-3,0],[-2,1],[-3,0],[-3,0],[-1,-2],[-1,-5],[2,-5],[-6,-12],[2,-3],[1,-5],[1,-2],[2,0],[4,2],[3,1],[1,-3],[0,-5],[1,-6],[3,-3],[5,2],[3,-5],[2,-1],[2,-1],[3,1],[1,1],[0,2],[2,2],[1,0],[0,-2],[0,-3],[-1,-3],[-3,-1],[-1,0],[-2,-1],[-1,-3],[0,-5],[2,-4],[4,-2],[4,-1],[2,-2],[1,-3],[0,-5],[0,-2],[-3,-8],[0,-5],[4,-2],[5,-1],[3,-3],[5,-8],[9,-8],[1,-3],[0,-9],[1,-4],[2,-3],[8,-8],[4,-6],[1,-5],[2,-4],[4,-5],[2,-6],[-2,-5],[4,-8],[3,-3],[7,-4],[3,-4],[2,-4],[2,-1],[3,-4],[3,-2],[2,-3],[2,-10],[6,-6],[3,-4],[2,-4],[1,-9],[0,-3],[1,-1],[1,1],[2,2],[1,3],[0,12],[-1,2],[-1,3],[-4,8],[0,2],[0,9],[1,10],[1,2],[4,5],[1,3],[0,3],[0,2],[0,3],[1,2],[1,2],[1,2],[0,5],[1,3],[2,1],[2,2],[1,0],[2,-1],[0,5],[-1,2],[-4,4],[-9,13],[-1,12],[0,4],[3,5],[1,3],[3,-2],[2,0],[2,1],[2,0],[3,-1],[1,0],[3,-3],[0,-1],[3,-10],[1,0],[1,2],[1,1],[4,-2],[4,-2],[4,-4],[2,-3],[0,-3],[1,-2],[1,-2],[2,-1],[2,-2],[5,-2],[2,-1],[3,-4],[3,-4],[3,-4],[4,-2],[5,0],[2,1],[1,2],[-1,1],[-2,1],[-2,0],[-3,1],[-6,6],[-3,7],[-5,17],[-4,8],[-1,4],[2,2],[3,-1],[8,-5],[2,-2],[2,5],[-3,3],[-3,3],[-2,4],[2,3],[6,5],[1,2],[2,4],[3,2],[5,2],[3,2],[3,4],[1,5],[-1,4],[-4,2],[-2,-8],[-4,-5],[-15,-5],[-9,-2],[-5,3],[-8,14],[-1,4],[-2,8],[-2,4],[-4,2],[-7,4],[-3,2],[-7,7],[-4,2],[-18,2],[0,1],[0,2],[4,2],[5,1],[3,2],[-3,5],[9,5],[3,2],[0,4],[-3,2],[-8,-1],[-5,2],[2,-7],[0,-1],[-7,0],[-3,1],[-1,3],[-1,1],[-6,4],[0,1],[-3,2],[-2,1],[-1,1],[-1,1],[-1,2],[10,-3],[3,0],[2,1],[-1,3],[-5,5],[5,-1],[8,-7],[4,-1],[5,-1],[6,-3],[5,-2],[6,1],[-2,3],[-3,1],[-7,1],[4,2],[7,1],[3,1],[-25,13],[-7,2],[0,2],[7,-1],[2,0],[1,4],[21,-7],[13,-1],[-5,5],[-2,2],[-4,1],[-2,1],[-1,1],[-3,3],[0,2],[2,1],[2,0],[3,-2],[4,-2],[4,-1],[2,0],[1,2],[0,3],[0,3],[-1,3],[-2,0],[-9,1],[-2,1],[-1,2],[-2,2],[-2,2],[-2,0],[-2,0],[-1,-1],[0,-1],[2,0],[1,-1],[-1,-1],[-1,-1],[-1,0],[-2,0],[-1,2],[-1,1],[-1,1],[-5,3],[-2,2],[-2,3],[6,0],[2,5],[-1,4],[-4,3],[2,5],[2,2],[2,2],[1,-1],[3,-1],[1,0],[-2,5],[21,1],[6,-1],[1,4],[2,-1],[2,-3],[2,-2],[4,0],[1,0],[1,-1],[1,-3],[1,0],[2,-1],[2,-1],[1,-2],[-2,-2],[-1,0],[-5,1],[-2,0],[1,-3],[4,-2],[5,-1],[4,0],[-4,-3],[-5,-1],[-7,-1],[-5,-1],[15,-11],[6,-2],[3,-1],[2,0],[2,-1],[2,-3],[0,-4],[-1,-2],[-2,-1],[-2,3],[-3,-2],[4,-11],[2,-3],[2,3],[1,0],[1,-1],[1,-1],[1,-1],[1,5],[-1,9],[2,3],[-2,3],[4,0],[4,-1],[4,-2],[1,-1],[4,-3],[4,-3],[1,2],[-7,12],[-2,6],[8,2],[0,2],[-5,2],[-5,3],[-4,4],[-2,4],[4,-1],[9,-4],[5,-1],[5,0],[2,-1],[1,-1],[1,-2],[2,0],[5,1],[8,-1],[4,-2],[5,-4],[4,-1],[1,-2],[6,-16],[2,-3],[3,-1],[17,-2],[7,-1],[2,0],[5,10],[4,3],[3,-1],[6,-4],[5,-3],[5,-2],[26,-1],[7,0],[6,3],[1,-2],[5,2],[10,1],[9,-1],[4,-3],[4,-4],[8,-2],[8,1],[6,4],[-5,1],[-9,-1],[-4,1],[-3,3],[-4,1],[-8,2],[-12,6],[-22,4],[-5,0],[-16,-2],[-3,-2],[-2,-1],[-4,4],[-1,-1],[-1,-1],[-1,0],[-3,0],[-4,1],[-2,1],[-2,7],[-1,2],[-1,1],[0,1],[0,2],[2,5],[1,2],[-1,2],[-2,2],[-1,2],[2,3],[1,2],[0,3],[0,2],[5,2],[2,1],[1,3],[0,15],[1,3],[2,1],[2,0],[3,-1],[1,-3],[0,-3],[0,-4],[0,-2],[1,-2],[5,-4],[2,-4],[2,-4],[2,5],[4,6],[5,4],[6,-1],[-1,4],[-1,15],[-1,8],[2,3],[5,0],[-2,4],[0,5],[1,8],[2,4],[5,3],[5,1],[3,-4],[1,0],[2,5],[1,5],[2,3],[5,3],[-7,3],[-4,1],[-10,-1],[-3,-1],[-2,-2],[-5,-9],[-6,-6],[-10,-21],[-6,-6],[0,3],[0,2],[1,3],[1,3],[-1,2],[-2,1],[-1,2],[-2,7],[-4,11],[-2,4],[0,-3],[0,-2],[-1,-1],[-2,0],[-1,-2],[-1,0],[-3,-3],[-1,16],[-1,3],[-2,4],[-1,5],[1,5],[1,2],[-2,7],[-1,2],[1,2],[0,1],[1,-1],[1,-2],[2,0],[-1,3],[1,2],[0,2],[1,2],[3,-8],[2,5],[0,6],[-2,4],[-4,-1],[1,11],[-1,4],[-5,3],[3,1],[4,-1],[3,-2],[1,0],[1,1],[4,1],[1,1],[0,7],[4,5],[7,0],[7,-3],[6,-5],[3,-1],[4,-1],[5,1],[2,1],[0,15],[0,2],[1,1],[1,1],[2,-1],[0,-1],[-1,-5],[0,-2],[2,-3],[4,-2],[3,1],[2,4],[-5,3],[0,6],[3,5],[3,4],[6,3],[1,1],[-1,2],[-4,1],[0,2],[-6,-3],[-2,-1],[-1,3],[0,3],[2,1],[3,0],[2,2],[0,3],[-2,1],[-4,0],[-1,0],[-1,2],[0,2],[1,5],[4,-2],[1,0],[2,-1],[0,1],[0,1],[1,1],[1,0],[1,0],[0,-4],[1,-1],[1,0],[8,-2],[1,-2],[-2,-3],[-3,-6],[1,0],[8,7],[4,2],[1,0],[2,-4],[2,0],[3,-1],[0,-3],[-2,-3],[-1,-2],[4,0],[6,1],[3,0],[5,-1],[3,-2],[6,-6],[0,-1],[1,-2],[1,-1],[4,-1],[2,0],[1,-1],[1,-1],[0,-4],[-4,-7],[1,-1],[3,-1],[1,2],[2,1],[2,1],[2,-1],[0,-2],[0,-2],[0,-1],[5,-2],[1,3],[0,4],[2,4],[5,-1],[16,-11],[5,-3],[-2,3],[-9,7],[-2,2],[-11,9],[0,3],[4,13],[2,2],[3,2],[3,2],[4,0],[0,2],[-4,0],[-3,1],[-2,2],[-2,3],[-1,-5],[-4,1],[-4,2],[-3,3],[-3,-1],[-9,-6],[-7,-2],[-5,-4],[-2,0],[-3,1],[-1,3],[-1,5],[-1,0],[-1,0],[-1,0],[0,2],[0,2],[1,1],[2,2],[2,2],[3,1],[1,1],[-1,2],[1,2],[3,2],[2,1],[4,1],[1,1],[1,0],[3,-3],[4,0],[4,4],[6,9],[-2,1],[-4,1],[-3,1],[-1,-6],[-1,-1],[-2,0],[-2,0],[-1,2],[0,2],[-1,-1],[-3,-4],[0,-1],[-1,-1],[-5,-2],[-10,-8],[-4,-3],[0,4],[1,1],[1,1],[-2,2],[-1,-3],[-2,0],[1,2],[-1,5],[0,1],[1,2],[2,2],[0,2],[-2,1],[-3,-1],[-3,0],[2,5],[3,2],[1,1],[0,2],[1,1],[2,2],[2,1],[3,0],[2,0],[2,0],[3,-2],[5,-1],[2,-1],[2,-3],[6,8],[3,3],[2,-4],[1,4],[1,5],[-1,5],[-3,2],[0,1],[0,4],[-1,5],[-2,3],[3,0],[2,-1],[4,-3],[2,2],[2,2],[3,0],[2,-1],[0,-4],[-4,-4],[0,-4],[1,1],[2,-8],[2,2],[3,5],[2,1],[0,-1],[1,-1],[2,-1],[1,-2],[-1,-2],[-1,-1],[0,-2],[3,-8],[0,-2],[2,-1],[3,-7],[2,-2],[1,1],[0,2],[-1,1],[1,2],[1,2],[0,2],[-3,12],[-3,4],[0,3],[4,4],[0,-5],[2,-2],[3,-2],[3,0],[3,-1],[1,-2],[2,-1],[4,1],[0,-3],[2,-1],[1,-1],[4,-4],[0,-1],[0,-2],[-1,-2],[3,-2],[5,-3],[3,0],[1,2],[6,2],[13,-3],[3,2],[0,4],[-2,1],[-6,-1],[-3,1],[-2,2],[-1,2],[0,3],[1,0],[2,0],[1,1],[1,1],[-1,2],[-1,0],[-2,0],[-1,1],[0,2],[0,1],[3,0],[2,1],[3,3],[6,2],[-1,3],[-2,1],[-8,-3],[-3,2],[-3,3],[-2,-1],[-2,0],[-1,0],[-1,3],[-1,0],[-1,0],[-1,-1],[-1,0],[-2,-1],[-2,0],[-2,0],[-1,2],[0,2],[0,2],[3,2],[-3,0],[-2,-1],[-2,-1],[-1,-1],[-2,1],[-1,3],[-2,1],[-2,-1],[0,-1],[-1,0],[-2,0],[-2,1],[-2,1],[-1,2],[3,1],[2,0],[1,3],[0,2],[1,1],[3,0],[3,1],[2,0],[1,-1],[0,-1],[1,-2],[3,0],[3,0],[1,1],[0,2],[-1,3],[4,2],[-2,3],[-7,3],[-7,-1],[-1,2],[-6,2],[-2,2],[-1,12],[-1,2],[-3,-1],[-2,-1],[-1,1],[0,3],[-2,0],[-1,0],[-1,1],[0,5],[2,1],[2,0],[3,0],[2,0],[0,2],[-1,2],[0,1],[2,2],[1,-1],[2,0],[3,0],[-2,4],[1,3],[2,1],[8,-2],[2,1],[0,4],[2,0],[3,1],[4,3],[-5,1],[-5,-1],[-4,0],[-1,4],[2,5],[5,4],[5,2],[4,-2],[1,0],[2,4],[2,1],[1,2],[0,6],[1,3],[2,1],[1,-2],[0,-14],[0,-3],[-2,-5],[2,4],[4,3],[3,3],[1,5],[3,-3],[7,-18],[0,-1],[1,0],[1,4],[-2,5],[1,2],[4,-1],[0,2],[0,3],[1,2],[2,2],[-2,1],[0,1],[0,2],[0,2],[6,-5],[-1,7],[0,3],[1,2],[2,1],[2,0],[1,0],[2,-1],[2,-1],[4,0],[1,-4],[-3,-3],[-2,-2],[-1,-2],[2,-1],[4,0],[4,0],[3,1],[-1,3],[0,2],[1,3],[1,0],[1,0],[1,1],[0,1],[-1,2],[-1,1],[2,12],[2,5],[1,2],[-1,4],[-3,4],[-2,3],[1,3],[-1,3],[-1,4],[0,4],[2,4],[0,1],[-2,2],[0,2],[2,2],[3,-1],[-1,3],[3,1],[4,-2],[2,-5],[1,0],[0,1],[2,0],[1,-3],[6,-3],[3,-3],[1,2],[1,1],[1,2],[2,1],[1,-1],[-1,-2],[-3,-6],[1,-2],[0,-2],[-2,-2],[-2,-1],[-3,0],[-1,2],[-2,1],[-3,-2],[1,-2],[0,-1],[-1,-2],[0,-1],[3,-21],[2,-4],[0,-7],[-10,-20],[0,-8],[4,3],[9,25],[2,3],[1,5],[1,10],[1,5],[3,1],[2,-3],[-2,-4],[2,-1],[0,-2],[-2,-6],[8,1],[3,2],[1,2],[1,2],[1,1],[2,-1],[0,-2],[0,-1],[-1,-1],[1,-1],[2,-1],[1,1],[1,1],[2,2],[2,0],[1,-2],[0,-2],[-1,-2],[-2,-1],[-4,-1],[4,-8],[-3,-3],[0,-1],[4,-2],[0,-1],[-2,-2],[0,-3],[1,-2],[1,-2],[2,-2],[2,0],[7,-6],[4,-2],[2,0],[2,9],[-1,1],[-1,2],[-2,2],[-1,1],[0,1],[1,1],[1,0],[1,5],[1,3],[1,1],[7,0],[1,0],[1,-1],[2,-4],[1,-1],[3,1],[1,3],[-1,2],[1,2],[2,0],[4,-2],[1,0],[2,2],[0,3],[-1,3],[-1,2],[0,3],[-3,3],[-1,2],[0,3],[-1,1],[-2,1],[-2,1],[-1,1],[-1,1],[-1,2],[1,3],[1,-1],[3,1],[2,2],[0,1],[1,0],[4,2],[6,1],[1,2],[-1,3],[0,2],[1,2],[2,2],[0,1],[0,2],[-2,4],[-1,2],[0,3],[0,2],[2,2],[7,1],[1,1],[2,1],[5,4],[1,0],[0,4],[0,4],[-1,4],[3,2],[-4,8],[-6,4],[-22,0],[-3,2],[-1,3],[-1,2],[-2,3],[0,3],[0,1],[1,3],[1,2],[2,-2],[4,-5],[2,-2],[3,1],[0,2],[0,3],[0,3],[3,2],[6,-9],[5,0],[-1,2],[0,2],[0,2],[-1,3],[-1,3],[0,1],[-2,1],[-8,4],[-2,1],[-2,3],[0,1],[3,-1],[6,-2],[1,1],[1,4],[1,2],[3,3],[2,0],[1,-2],[-1,-3],[-1,-2],[0,-1],[6,-1],[2,-1],[2,0],[3,2],[-1,-2],[-1,-2],[-3,-3],[1,0],[2,-1],[2,-1],[0,-1],[-4,-1],[-2,-3],[-2,-3],[-1,-4],[4,2],[3,2],[6,5],[2,2],[2,1],[7,2],[-3,-5],[-7,-4],[-2,-3],[5,-1],[4,-3],[1,-2],[-4,-2],[-6,-1],[0,-1],[0,-3],[0,-4],[7,2],[3,-1],[0,-4],[-6,-5],[-1,-2],[4,1],[-2,-7],[5,-3],[6,-2],[1,-3],[-2,-1],[-1,0],[-1,-1],[0,-2],[1,0],[3,-1],[0,-1],[3,2],[3,1],[2,0],[1,-4],[2,0],[0,3],[1,3],[2,2],[8,2],[0,2],[-2,3],[-4,3],[-1,1],[-2,0],[-2,0],[-1,1],[1,2],[3,3],[0,4],[1,2],[2,2],[4,1],[-1,1],[-1,1],[-1,1],[3,3],[4,0],[3,1],[3,8],[7,5],[2,3],[4,-5],[5,0],[3,3],[3,3],[4,6],[2,2],[3,-1],[6,-2],[-3,-1],[-3,-2],[-3,-2],[-1,-2],[-1,-2],[-1,-1],[-2,-1],[-1,-1],[-1,-6],[0,-2],[-7,-6],[-2,-4],[2,-2],[4,1],[8,3],[2,-1],[-7,-9],[1,-1],[3,-5],[2,-1],[3,0],[3,2],[2,1],[2,-2],[1,-2],[-1,-7],[0,-3],[1,-3],[2,-1],[2,-1],[2,-2],[0,6],[1,3],[1,3],[2,1],[3,1],[3,1],[1,4],[0,2],[-1,2],[0,2],[2,3],[0,1],[-1,2],[-1,2],[1,3],[1,-1],[4,-2],[1,-2],[1,-2],[1,-4],[1,-1],[2,0],[4,7],[3,3],[-2,3],[2,3],[2,4],[1,4],[-2,0],[-1,-2],[-1,-1],[-2,-2],[-3,3],[-1,3],[-1,3],[2,2],[1,0],[5,-2],[3,0],[0,2],[3,3],[2,-1],[3,0],[1,1],[6,-3],[2,0],[3,3],[-4,1],[-2,2],[-1,1],[2,2],[3,0],[5,-2],[-1,3],[-1,1],[-2,1],[-4,0],[-2,1],[-2,2],[-1,3],[0,4],[-1,1],[-4,5],[-1,2],[-3,9],[-1,3],[3,0],[5,1],[4,2],[1,2],[1,0],[2,-2],[1,-3],[-1,-5],[2,0],[2,-1],[1,3],[2,1],[2,1],[3,0],[0,1],[-4,2],[-3,3],[0,3],[4,3],[4,-1],[3,-2],[4,-2],[4,1],[-5,3],[-1,1],[2,1],[3,1],[5,2],[6,-7],[3,-2],[4,-2],[2,-1],[0,-3],[0,-8],[3,3],[3,0],[1,-1],[-1,-5],[4,3],[1,-3],[-2,-6],[-2,-4],[7,1],[2,-4],[0,-6],[3,-5],[4,-4],[3,3],[3,5],[4,4],[-2,1],[-1,2],[0,2],[1,2],[4,-2],[1,-2],[0,-7],[0,-3],[2,-1],[2,2],[2,1],[2,7],[3,3],[3,-1],[8,-9],[3,-3],[6,-2],[0,4],[-2,5],[2,4],[3,-1],[2,-2],[1,-3],[2,-2],[3,0],[2,-1],[1,-2],[1,-3],[1,0],[0,2],[3,3],[2,-3],[3,-3],[1,-4],[1,-4],[0,-2],[-1,-7],[1,-2],[4,-3],[2,-2],[2,4],[3,-1],[4,-4],[2,-2],[4,-1],[6,-6],[3,-2],[1,0],[3,0],[1,0],[0,-1],[2,-2],[9,-7],[2,-4],[2,-4],[3,-5],[13,-10],[1,-3],[6,-15],[2,-1],[4,-1],[2,-1],[0,-2],[0,-8],[0,-3],[2,-1],[1,0],[1,1],[0,3],[2,2],[1,0],[3,-2],[2,-3],[-6,-6],[1,-4],[4,3],[2,-1],[4,-5],[8,-5],[3,-3],[-2,-1],[-1,-1],[0,-3],[0,-2],[1,-2],[3,-1],[2,0],[5,2],[2,2],[1,0],[3,-2],[5,-4],[1,-1],[1,-2],[2,-3],[1,-4],[3,-2],[4,0],[2,0],[2,-2],[9,-8],[4,-2],[4,-1],[3,0],[1,1],[1,-1],[2,-2],[1,-2],[0,-2],[0,-2],[-1,-1],[-3,2],[-3,0],[-3,-1],[-1,-3],[0,-4],[3,-8],[0,-3],[-1,-2],[-2,-1],[-4,0],[-3,0],[-2,-1],[-5,-3],[5,-2],[-1,-7],[-5,-15],[-1,-3],[-3,-5],[-1,-3],[0,-4],[1,-4],[-1,-3],[-3,-6],[-1,-4],[-1,-4],[1,-4],[2,-4],[1,-3],[-2,-23],[-1,-2],[-2,-1],[-4,0],[6,-16],[0,-8],[-3,-9],[-8,-8],[-1,-2],[2,-2],[5,2],[5,4],[3,3],[4,7],[2,10],[1,10],[0,9],[-3,14],[2,1],[0,3],[-1,3],[1,2],[3,2],[2,-2],[2,-2],[7,-3],[10,-11],[3,-3],[0,-1],[4,-7],[5,-16],[1,-4],[1,0],[2,19],[-1,6],[-3,4],[-8,7],[-2,3],[-3,4],[0,5],[1,4],[1,1],[-2,10],[-1,1],[-2,1],[-1,1],[-1,10],[5,8],[11,11],[1,0],[1,1],[1,1],[0,1],[0,2],[0,1],[3,4],[4,4],[2,-1],[1,-5],[3,-19],[2,-4],[3,-2],[-1,7],[-1,4],[2,3],[7,-9],[4,-3],[6,-2],[1,1],[1,2],[1,2],[1,2],[-1,3],[0,2],[-1,1],[-1,1],[-6,10],[-1,5],[-2,5],[0,2],[0,3],[1,1],[1,0],[2,1],[2,1],[1,1],[0,1],[-1,2],[-2,1],[-3,1],[-2,1],[-3,5],[1,1],[10,1],[9,3],[4,2],[3,2],[4,2],[5,-1],[8,-5],[18,-2],[8,-2],[8,-6],[4,1],[5,-1],[5,-2],[4,-1],[19,0],[4,-2],[8,-4],[4,0],[1,-1]],[[7887,4260],[-16,3],[-2,-1],[-1,0],[-3,-3],[-1,-3],[-1,0],[-2,-1],[-1,1],[-3,1],[-1,1],[-2,-1],[-1,0],[-2,-1],[0,-2],[-4,-5],[-1,-2],[-2,-1],[-1,0],[0,-1],[-1,-1],[0,-1],[0,-1],[1,-2],[0,-1],[-2,-3],[0,-1],[1,-3],[1,-1],[0,-1],[1,-3],[0,-2],[-1,-2],[-3,-6],[-1,-2],[1,-1],[-2,-3],[-6,-2],[-1,-1],[-1,-3],[0,-4],[3,-12],[1,-7],[0,-3],[-2,-7],[0,-1],[0,-2],[2,-9],[0,-2],[0,-3],[-1,-3],[0,-1],[-1,-1],[-1,-1],[-2,-1],[-1,-1],[-1,0],[-1,-1],[-1,-2],[-1,-4],[-1,-1],[-1,-1],[-1,0],[-1,-1],[-1,0],[-1,1],[-6,3],[-12,3],[-2,1],[-1,1],[-1,1],[-2,2],[-3,6],[-1,4],[-2,13],[0,4],[-1,2],[-1,1],[-2,0],[-1,0],[-1,-1],[-1,0],[-1,-2],[-1,-1],[-1,-1],[-1,1],[-1,0],[-1,1],[-7,6],[-1,1],[-1,1],[0,2],[0,1],[0,3],[0,1],[-1,1],[-3,2],[0,2],[0,3],[1,7],[1,3],[0,3],[-2,7],[-1,9],[0,3],[3,10],[1,5],[1,2],[3,6],[0,3],[0,1],[0,1],[-1,2],[0,1],[0,1],[1,2],[1,2],[2,2],[1,1],[25,15],[35,22],[6,2],[11,-7],[1,-1],[1,-1],[1,-1],[0,-2],[0,-2],[0,-1],[0,-1],[0,-1],[1,-1],[2,-1],[3,-1],[2,0],[1,0],[2,-1],[0,-2],[0,-1],[0,-1],[0,-1],[1,-2],[2,-1],[11,-4],[2,-1],[2,0],[5,-2],[10,-4],[1,-1],[1,-1],[-3,-3],[-2,-1],[-3,-2],[-2,-1],[-2,0]],[[8160,4298],[-6,-2],[-7,-4],[-1,-1],[-1,-4],[-1,-2],[-1,-2],[-2,-2],[-5,-5],[-3,-4],[-1,-4],[1,-6],[0,-3],[1,-1],[0,-1],[-1,-2],[-7,-4],[-1,-1],[-1,-4],[-3,-3],[-3,-4],[-2,-2],[0,-5],[0,-11],[0,-2],[-4,-2],[-4,-5],[-8,-13],[-6,-14],[-3,-4],[-4,-2],[-5,1],[-4,3],[-2,-1],[-7,-2],[6,-6],[1,-6],[1,-1],[2,-3],[1,-3],[-1,-5],[-1,-2],[-3,-1],[-6,-2],[0,-1],[-8,-7],[-1,-1],[0,-3],[2,-6],[1,-4],[-2,-15],[-1,-8],[-4,1],[-5,2],[-4,-3],[0,-2],[0,-1],[-2,-2],[2,0],[1,0],[1,1],[1,1],[3,-2],[4,-3],[2,-4],[-5,-8],[0,-5],[0,-4],[5,-13],[0,-4],[-3,-2],[0,-1],[2,-5],[0,-3],[-1,-2],[-2,-2],[-4,-3],[-3,-3],[-3,-4],[-2,-5],[-1,-5],[1,-5],[1,-2],[-1,-2],[-3,-4],[-1,-2],[2,-10],[1,-5],[-2,-4],[-6,-9],[-7,-13],[-2,-4],[0,-4],[-1,-5],[-1,-6],[-3,-5],[-4,-5],[-4,-3],[3,-5],[-2,-4],[-5,-7],[-1,-5],[1,-3],[4,-1],[3,-2],[-2,-2],[-2,-4],[-1,-5],[2,-3],[1,-2],[2,-2],[0,-1],[0,-3],[0,-2],[-1,-1],[-1,-1],[-1,1],[-1,1],[-4,-2],[-3,-3],[-1,-1],[-2,-1],[1,-3],[3,-2],[4,-1],[3,0],[2,1],[2,0],[3,-1],[8,-6],[2,-2],[1,-3],[1,-7],[1,-4],[7,-10],[0,-2],[-5,2],[-5,2],[-5,0],[-4,-2],[-3,-4],[0,-3],[4,-8],[-3,-9],[0,-8],[2,-9],[4,-9],[-2,-3]],[[8022,3788],[-46,19],[-47,19],[-47,19],[-47,19],[-47,19],[-47,20],[-47,19],[-47,19],[-5,2],[-13,1],[-5,1],[-3,1],[0,1],[16,21],[2,4],[2,5],[1,5],[-1,2],[-4,7],[-2,1],[-3,0],[-2,1],[-2,1],[-1,2],[0,2],[-1,2],[1,9],[-1,1],[-1,1],[-1,1],[0,5],[-1,2],[-2,2],[-8,5],[-4,4],[-1,4],[0,3],[3,3],[1,2],[-1,3],[0,2],[-2,3],[-5,13],[0,2],[-3,3],[1,5],[2,9],[-2,4],[-8,5],[-1,4],[1,6],[1,3],[-1,3],[-6,2],[-4,1],[-2,0],[-3,2],[-1,2],[-2,3],[-1,2],[-2,0],[-6,1],[-28,12],[-3,0],[-3,1],[-3,0],[-2,-1],[-3,-3],[-1,-1],[-25,-8],[-4,2],[-1,4],[-3,3],[-4,2],[-4,1],[-2,-1],[-4,-2],[-2,-1],[-6,1],[-2,-1],[-3,-1],[-3,-3],[-3,-3],[-2,-3],[-3,-12],[-1,-3],[-4,3],[-4,2],[-4,1],[-3,0],[-1,0],[-11,-3],[-7,0],[-4,1],[-3,2],[-2,2],[-2,0],[-2,-1],[-6,-6],[-1,-2],[0,-1],[-2,-3],[-1,-1],[0,-2],[1,-1],[0,-2],[1,-1],[1,-6],[0,-2],[2,-3],[2,-2],[2,-2],[3,-1],[3,-1],[6,0],[3,0],[2,-3],[-20,-4],[-3,1],[-9,9],[-2,4],[-1,8],[2,7],[-6,3],[-3,1],[-3,0],[-4,-1],[-1,-2],[-1,-2],[-1,-1],[-6,0],[-5,4],[-6,2],[-7,-2],[-4,4],[-2,1],[-1,1],[-6,0],[-3,1],[-4,4],[-4,1],[-5,0],[-5,0],[-4,3],[-7,7],[-3,1],[-17,0],[-3,1],[-4,3],[-2,0],[-2,0],[-2,-2],[-3,-1],[-2,1],[-2,1],[-3,0],[-2,-1],[-10,-14],[-3,-1],[-15,2],[-8,2],[-5,0],[-3,-1],[-1,0],[-2,-4],[-3,2],[-4,1],[-5,1],[-13,1],[-5,2],[-3,2],[-7,1],[-8,-1],[-2,0],[-2,2],[-1,2],[-1,3],[-1,2],[-4,2],[-5,1],[-5,-1],[-14,-4],[-10,1],[-9,3],[-37,27],[-8,3],[-9,0],[-9,-2],[-17,-7],[-9,-1],[-9,1],[-9,3],[-7,1],[-21,0],[-24,-3],[-3,-2],[-4,-3],[-1,-1],[-2,-13],[-5,-8],[-1,-4],[2,-4],[4,-3],[3,-5],[2,-4],[-2,-4],[-4,0],[-10,4],[-5,1],[-4,-2],[-8,-7],[-5,-3],[-9,-1],[-6,0],[-3,2],[0,2],[-1,1],[-1,0],[-3,0],[0,1],[-1,2],[-4,3],[-4,1],[-9,1],[-4,2],[-24,23],[-8,3],[-4,4],[-3,4],[-10,21],[-5,9],[-6,5],[-3,0],[-5,0],[-3,1],[-1,1],[-4,4],[-3,2],[-4,3],[-1,1],[-1,2],[-2,1],[-2,0],[-2,1],[-7,7],[-11,13],[-7,4],[-10,1],[-5,2],[-4,7],[-4,3],[-13,4],[-9,5],[-5,4],[-2,1],[-2,1],[-5,1],[-1,1],[-1,2],[-2,1],[-9,4],[-18,3],[-12,6],[-2,2],[-2,2],[0,3],[1,2],[1,1],[1,2],[0,4],[0,5],[-2,4],[-4,3],[-3,2],[-19,3],[-5,3],[-4,2],[-3,2],[-5,7],[-4,9],[-3,9],[-2,13],[-2,6],[0,4],[0,1],[2,5],[1,2],[0,1],[-1,2],[-1,2],[0,2],[1,1],[2,1],[1,2],[1,2],[0,1],[-1,3],[-1,2],[2,5],[0,2],[-1,1],[-6,4],[-3,0],[-4,-2],[-3,0],[-1,5],[-2,3],[-4,2],[-4,1],[-2,2],[-14,7],[-3,0],[-20,2],[-8,4],[-4,1],[-1,-3],[-2,-2],[-4,2],[-6,5],[-3,0],[-1,0],[-2,-2],[-6,-2],[0,1],[-2,3],[-1,2],[-1,5],[-1,2],[-2,1],[-6,2],[-3,3],[-1,1],[-2,1],[-3,0],[-4,-2],[-3,-1],[-4,-1],[-2,-4],[-2,-10],[-1,-1],[-1,-1],[-1,-2],[0,-1],[0,-4],[1,-2],[-1,-4],[-2,-1],[-2,1],[-4,0],[-4,0],[-2,-1],[0,-1],[1,-4],[2,-4],[0,-2],[-4,-2],[-4,3],[-3,1],[-3,0],[-5,1],[-2,1],[-2,1],[-2,2],[-1,1],[0,5],[0,2],[-6,12],[-5,5],[-1,2],[0,2],[0,1],[0,2],[0,1],[-2,3],[-14,10],[-2,3],[-3,19],[0,5],[2,4],[4,7],[2,4],[-3,4],[-3,0],[-3,-1],[-5,0],[-3,2],[-5,3],[-5,5],[-2,3],[-2,1],[-1,1],[-1,2],[0,5],[-1,5],[-3,5],[0,1],[-3,0],[-5,0],[-2,1],[-3,3],[-3,2],[-3,1],[-4,0],[-2,0],[-4,-2],[-2,0],[-4,7],[-5,5],[-6,0],[-12,-2],[-2,0],[-2,0],[-3,0],[-2,1],[-5,-2],[-4,-1],[-10,0],[-5,1],[-10,4],[-5,1],[-9,-1],[-9,-4],[-7,-5],[-6,-4],[-5,-7],[-3,-3],[-5,-1],[-2,1],[-1,1],[-1,2],[-2,5],[-1,1],[-11,1],[-3,1],[-7,4],[-1,1],[-4,2],[-5,-1],[-5,-2],[-3,0],[-2,2],[-3,5],[-2,1],[-3,1],[-2,2],[-2,2],[-2,1],[-1,0],[-2,1],[-2,1],[-1,-1],[-3,-2],[-2,-1],[-4,0],[-2,2],[-1,1],[-3,2],[-6,1],[-19,0],[-5,3],[-5,7]],[[6079,4555],[0,67],[0,69],[0,69],[0,69],[0,69],[0,69],[0,69],[0,70],[0,69],[0,69],[0,69],[0,69],[0,69],[0,69],[0,69],[0,69]],[[6079,5658],[105,0],[106,0],[105,0],[105,0],[105,0],[105,0],[105,0],[105,0],[106,0],[105,0],[105,0],[105,0],[105,0],[105,0],[106,0],[105,0],[42,0],[1,0],[6,5],[5,2],[5,3],[4,4],[2,4],[2,10],[2,5],[4,2],[5,0],[5,2],[5,3],[4,2],[1,2],[2,3],[1,2],[4,2],[3,1],[3,3],[1,2],[2,0],[22,10],[4,1],[4,2],[4,4],[8,15],[3,2],[20,3],[4,1],[3,-3],[1,-3],[1,-3],[4,-2],[8,1],[4,-1],[3,-3],[5,3],[3,1],[3,1],[25,0],[8,0],[9,1],[4,1],[7,-1],[4,0],[8,4],[10,2],[12,4],[3,1],[14,-1],[4,1],[4,2],[5,2],[5,-2],[9,-7],[12,-11],[7,-5],[9,-2],[28,0],[9,0],[19,5],[9,0],[9,-3],[8,-5],[4,-2],[10,-2],[3,-2],[3,-3],[4,-3],[4,0],[6,-1],[4,-1],[2,-4],[0,-8],[0,-5],[1,-4],[4,-2],[5,0],[8,-1],[5,-1],[4,-2],[8,-6],[15,-8],[3,-14],[2,-3],[-2,-3],[1,-1],[0,-2],[1,-1],[0,-7],[1,-8],[1,-2],[4,-2],[1,-1],[1,-4],[-1,-3],[2,-3],[5,-1],[2,1],[5,2],[4,1],[0,1],[0,1],[1,2],[5,2],[2,1],[1,3],[4,5],[2,1],[4,3],[2,1],[0,2],[0,6],[1,4],[5,8],[1,3],[1,1],[1,0],[2,1],[2,0],[1,0],[1,1],[4,2],[2,1],[1,0],[3,0],[1,0],[3,1],[2,1],[8,5],[3,2],[1,0],[1,0],[1,0],[7,-13],[1,-1],[1,0],[1,-1],[1,0],[3,0],[2,0],[1,-1],[1,-2],[1,0],[1,-1],[2,1],[1,1],[1,6],[2,3],[1,1],[1,1],[1,0],[2,0],[1,0],[4,0],[5,-2],[1,0],[1,0],[1,0],[7,3],[2,1],[2,0],[3,0],[1,0],[1,1],[1,1],[1,1],[1,1],[1,2],[0,1],[0,5],[0,2],[3,5],[1,2],[0,3],[0,6],[1,5],[0,3],[1,1],[0,1],[2,2],[1,2],[0,1],[0,1],[-2,3],[-6,6],[-5,4],[-1,1],[-1,2],[0,2],[-1,4],[-2,3],[-5,5],[0,3],[0,1],[1,1],[1,0],[1,1],[1,1],[3,0],[2,0],[2,1],[5,4],[1,1],[2,3],[25,11],[2,1],[3,0],[7,-1],[1,0],[2,1],[2,1],[2,1],[3,4],[6,4],[2,1],[2,1],[10,1],[6,2],[4,2],[1,1],[1,1],[0,1],[3,8],[1,0],[4,2],[6,6],[2,1],[1,1],[2,0],[2,-1],[4,-3],[1,-2],[1,-2],[0,-2],[0,-1],[0,-1],[1,-1],[1,-1],[1,-1],[3,-1],[2,0],[2,0],[2,2],[1,1],[0,2],[1,1],[0,1],[1,1],[1,1],[1,0],[1,0],[6,-5],[1,-1],[21,-8],[2,0],[2,0],[3,0],[3,1],[6,2],[1,1],[3,2],[1,1],[1,0],[3,0],[5,0],[4,-1],[6,-2],[2,-1],[12,0],[1,-1],[1,0],[12,0],[2,0],[2,0],[2,-1],[1,-1],[2,1],[2,0],[4,3],[4,7],[2,1],[1,0],[1,1],[1,2],[1,2],[3,4],[5,0],[3,0],[18,4],[2,0],[7,-2],[6,3],[19,14],[8,6]],[[8787,5845],[5,-7],[7,1],[2,-4],[2,-12],[2,-5],[0,-11],[-6,-31],[0,-10],[3,-18],[2,-4],[7,-8],[3,-4],[-1,-1],[-2,-5],[0,-2],[0,-2],[0,-2],[0,-3],[-4,-7],[0,-5],[2,-9],[-1,-9],[-5,-7],[-13,-10],[-10,-12],[-5,-8],[-3,-8],[-1,-3],[0,-2],[2,-10],[1,-3],[-1,-1],[-4,-1],[-1,-1],[-1,-2],[-10,-14],[-4,-9],[-2,-9],[2,-9],[3,-4],[1,-4],[-2,-3],[-1,-3],[0,-4],[1,-4],[1,-2],[-3,-4],[-2,-10],[-3,-7],[-1,-2],[0,-5],[0,-1],[1,-2],[0,-1],[0,-2],[-2,-2],[-1,-2],[1,-5],[1,-3],[0,-4],[-6,-8],[-1,-4],[-1,-4],[0,-3],[2,-9],[-1,-2],[-3,-3],[-1,-2],[0,-9],[-1,-5],[-2,-5],[-7,-9],[-1,-3],[-1,-2],[-3,-4],[-1,-2],[0,-2],[2,-6],[-1,-12],[-3,-11],[-11,-18],[2,-6],[-3,-8],[-10,-15],[-1,-3],[-2,-7],[-5,-8],[-2,-5],[-4,-18],[-1,-12],[-2,-4],[0,-1],[-5,-18],[3,-3],[1,-19],[5,-8],[2,-2],[1,-1],[3,-1],[2,0],[1,1],[1,1],[1,-1],[2,-2],[0,-2],[0,-5],[0,-2],[-1,-2],[-4,-3],[-4,-7],[-1,-8],[1,-4],[3,-1],[0,-2],[0,-4],[-4,-3],[-7,-7],[-6,-9],[0,-8],[-5,-9],[3,-3],[1,-14],[-10,-10],[-3,-7],[0,-5],[4,-4],[1,-4],[0,-1],[-1,-5],[-6,-5],[-7,-6],[-6,-8],[1,-7],[-3,-5],[2,-4],[-3,-3],[-5,-4],[-5,-6],[4,-4],[-1,-3],[-6,-5],[-6,-8],[-2,-8],[2,-3],[-7,-4],[-4,-5],[-7,-4],[-12,-10],[-13,-21],[2,-6],[-6,-6],[-2,-4],[-1,-5],[-1,-5],[1,-4],[5,-1],[2,-3],[4,-2],[1,-3],[-3,-3],[-2,-3],[-2,-3],[-1,-2],[-2,-2],[0,-3],[1,-4],[2,-1],[4,-1],[-1,-2],[-1,-1],[-1,0],[0,-2],[-1,-2],[-1,-4],[-2,-4],[-1,-5],[0,-3],[4,-4],[-29,-10],[-11,-6],[-13,-9],[-2,-7],[-4,-1],[-6,-3],[-6,-5],[-4,-5],[-1,-4],[4,-3],[3,-3],[-3,0],[-1,1],[-1,1],[-1,1],[-1,0],[-3,0],[-1,0],[-5,4],[-2,1],[0,-1],[-4,-3],[-2,-1],[-10,-3],[5,-4],[2,0],[16,0],[2,-1],[3,-1],[1,-1],[-1,-1],[0,-5],[-1,-2],[-3,-1],[-5,1],[-2,-1],[-2,-2],[-1,-1],[-1,-1],[-3,-1],[-11,2],[-16,-3],[-10,-4],[-13,-6],[-5,-3],[-4,-2],[-8,-6],[1,-6],[-3,-2],[-4,-3],[-5,-3],[-2,-3],[-1,-5],[0,-4],[-3,-1],[-4,-3],[-4,-4],[-3,-3],[-1,-2],[0,-3],[-3,-6],[-1,-7],[-2,-3],[-2,-4],[0,-3],[-3,-4],[-5,-2],[-5,-6],[-1,-4],[3,-4],[-2,-2],[-8,-6],[-3,-2],[0,2],[3,3],[2,6],[-5,3],[-6,-2],[-8,-7],[0,-2],[4,-3],[-3,-1],[-3,-1],[0,-2],[2,-2],[2,-1],[3,-1],[3,3],[1,2],[2,-1],[0,-3],[-3,-4],[-1,-4],[-6,-5],[-3,-4],[2,-2],[0,-2],[-3,-2],[1,-3],[1,-2],[-1,-1],[-3,-1],[1,-3],[-1,-1],[0,-2],[-1,-1],[-2,-1],[-2,-1],[-4,0],[-2,0],[-3,1],[-2,-2],[-3,-2],[-5,0],[-2,0],[-6,-3],[-3,0],[-3,4],[-2,5],[-3,-3],[-1,-4],[2,-4],[4,-2],[-1,-2],[-2,-1],[-1,-1],[-2,-1],[0,-1],[5,1],[7,7],[4,0],[2,-1],[-2,-6],[-2,-7],[1,-3],[3,3],[2,3],[2,7],[3,-6],[-4,-11],[-3,-5],[-1,-6],[0,-2],[2,-2],[1,-2],[0,-3],[-2,-5],[-1,-10],[-3,-1],[-3,1],[-2,0],[-3,-3],[-2,-3],[1,-3],[1,-1],[3,-1],[3,1],[1,3],[0,1],[2,-3],[-1,-5],[-4,-10],[2,-3],[-3,-7],[-2,-2],[-2,-3],[-2,1],[-6,7],[-2,2],[-4,-1],[-1,-2],[-1,-3],[-2,-3],[-4,-1],[-5,1],[-4,0],[-2,-3],[6,-1],[2,-1],[2,-2],[1,0],[3,3],[13,-1],[2,0],[0,-4],[-1,-1],[-10,0],[-1,0],[-1,0],[-1,-2],[-2,-2],[0,-2],[-2,-1],[-2,-1],[2,-1],[5,0],[1,-1],[0,-2],[-1,-2],[-4,-3],[-9,-6],[-3,-3],[-6,-2],[-9,-6],[-4,-4],[-9,-10],[-6,-8],[-3,-7],[1,-7],[-5,-10],[-1,-9],[3,-8],[-4,-3],[-2,-6],[-3,-4],[-4,1],[2,4],[-1,2],[-3,1],[-1,0],[-2,-1],[-7,-7],[1,-2],[1,-1],[2,0],[5,0],[3,-2],[6,-5],[3,-2],[4,-1],[-7,0],[-3,-5],[-5,-27],[-3,-7],[-5,-3],[-7,-2],[-5,-11],[-6,-3],[0,-1],[2,-2],[4,-2],[2,-1],[3,-1],[0,-2],[-3,-2],[-4,0],[2,-2],[5,-2],[2,-2],[-2,-1],[2,-2],[-2,-6],[4,-4],[7,-1],[5,-1],[1,-1],[-3,-8],[0,-5],[-2,-3],[-6,-4],[-2,3],[-2,2],[-2,2],[1,3],[2,3],[-2,5],[1,3],[-4,2],[-4,-1],[-4,-1],[-8,-2],[-2,-3],[-2,-8],[4,-1],[1,-3],[0,-4],[1,-2]],[[5348,4211],[3,-1],[-1,-3],[-3,-2],[-4,-1],[-4,-3],[0,-3],[4,-2],[7,0],[3,0],[0,-2],[-5,-6],[-9,-8],[4,-4],[5,0],[5,0],[9,-3],[5,0],[9,2],[3,1],[1,1],[2,0],[2,-2],[1,-2],[-1,-2],[0,-1],[0,-3],[1,-4],[4,-2],[5,1],[4,1],[4,2],[3,3],[2,4],[0,4],[3,3],[6,1],[6,-1],[9,-2],[9,-4],[4,-1],[0,-1],[2,-7],[1,-2],[3,-2],[4,0],[4,0],[-2,-3],[1,-4],[0,-3],[-6,-2],[-3,-1],[-5,-8],[-3,-1],[-5,-1],[-5,2],[-4,2],[-7,5],[-4,1],[-4,0],[-5,0],[-4,0],[-6,2],[-5,1],[-5,-1],[-9,-1],[-18,-7],[-10,-2],[-3,-3],[-1,-4],[0,-5],[1,-1],[1,-1],[1,-2],[0,-1],[-1,-2],[-1,-2],[-1,-1],[0,-1],[-1,-2],[-11,-2],[-13,-8],[-7,-3],[-3,3],[-7,3],[-9,10],[-8,2],[-10,1],[-10,3],[-3,1],[-4,0],[-5,-3],[-2,-4],[-2,-5],[-7,-2],[-3,1],[-7,2],[-4,0],[-6,-1],[-3,0],[-3,3],[-14,-5],[-7,-1],[-7,1],[-4,3],[-2,0],[-2,0],[-4,-2],[-2,-1],[-4,1],[-3,-1],[-2,0],[-2,-3],[-2,0],[-1,1],[-3,-1],[-4,-1],[-2,0],[-2,1],[-1,4],[-1,3],[-3,4],[-6,7],[-3,2],[-8,1],[-3,1],[-13,10],[1,2],[0,5],[1,2],[1,1],[1,1],[1,2],[1,5],[1,2],[1,2],[2,1],[1,2],[-1,5],[1,2],[3,2],[5,1],[15,1],[11,5],[6,0],[3,1],[3,2],[2,1],[58,8],[5,1],[10,5],[30,6],[3,2],[2,2],[3,2],[4,1],[3,0],[19,-6],[2,0],[1,1],[4,2],[4,0],[6,0],[4,0],[7,3],[4,0],[4,-1],[4,1]],[[5105,4302],[-2,-2],[-1,2],[-5,-1],[-3,1],[-2,2],[2,3],[3,2],[3,-1],[2,-3],[3,-3]],[[5041,4324],[-1,-1],[-2,1],[-6,1],[-2,4],[-1,5],[-1,5],[-10,7],[-3,5],[6,2],[3,-2],[10,-14],[3,-2],[2,-1],[1,-2],[1,-3],[0,-3],[0,-2]],[[5293,4444],[-3,-3],[-3,2],[-1,3],[2,3],[5,6],[1,-5],[-1,-6]],[[4670,4608],[-3,-1],[-1,3],[2,7],[1,1],[0,3],[0,1],[3,2],[6,1],[3,1],[0,-1],[1,-3],[1,-4],[-2,-2],[-3,0],[-4,-1],[-4,-7]],[[4477,4931],[-7,-3],[-6,2],[1,4],[4,4],[4,3],[4,2],[5,2],[6,1],[5,0],[0,-1],[-11,-4],[1,-3],[1,-1],[-2,-1],[-1,-2],[-1,-2],[-1,-1],[-2,0]],[[6079,4555],[-3,4],[-4,3],[0,-18],[0,-109],[0,-110],[0,-110],[0,-110],[0,-109],[0,-110],[0,-110],[0,-109]],[[6072,3667],[-3,1],[-52,-3],[-5,0],[-4,2],[-4,2],[-4,2],[-2,1],[-5,0],[-2,1],[-2,2],[-2,1],[-4,2],[-17,13],[-4,3],[-9,2],[-4,2],[-1,1],[0,3],[-1,0],[-1,1],[-2,0],[-1,1],[-2,2],[-1,2],[0,3],[-1,3],[-3,7],[-11,14],[-1,4],[-9,15],[-6,5],[-17,10],[-5,6],[0,1],[5,2],[-1,4],[-4,4],[-4,2],[-2,1],[-5,3],[-2,1],[-1,0],[-2,1],[-2,0],[-1,-1],[-1,-1],[0,-2],[-7,3],[-42,48],[-5,10],[-6,9],[1,2],[4,2],[3,2],[2,6],[-3,5],[-5,5],[-3,6],[-1,8],[-1,3],[-4,4],[-5,2],[-3,2],[0,3],[24,11],[7,6],[5,7],[4,8],[1,9],[-1,29],[-1,3],[-27,55],[-20,37],[-15,28],[-4,4],[-7,5],[-10,11],[-1,3],[-2,3],[-40,33],[-16,13],[-8,4],[-7,7],[-6,3],[-8,6],[-7,3],[-7,6],[-7,2],[-11,7],[9,2],[9,-4],[76,-58],[21,-17],[11,-11],[15,-16],[7,-14],[14,-25],[2,0],[-2,9],[-12,24],[-2,8],[-1,4],[-26,27],[-4,3],[-8,3],[-4,3],[-5,6],[-41,31],[-5,1],[-13,9],[-2,2],[-9,5],[-3,2],[-1,3],[1,3],[3,1],[5,-1],[0,5],[2,4],[6,5],[4,3],[5,-1],[6,-6],[4,-1],[4,-1],[3,-2],[1,-4],[-1,-5],[-1,-3],[-1,-3],[2,-3],[2,-1],[2,0],[1,0],[-1,-4],[-2,-1],[-2,-2],[-2,-2],[1,-3],[3,-1],[12,-2],[3,0],[5,3],[1,4],[-1,5],[2,4],[3,5],[-1,3],[-15,12],[-3,2],[-8,1],[-3,2],[0,2],[2,1],[7,2],[1,1],[1,1],[3,1],[2,0],[12,-3],[2,1],[3,3],[0,2],[-1,3],[-3,2],[-1,3],[3,9],[0,3],[-3,1],[-3,-1],[-5,-5],[-3,9],[-7,6],[-10,2],[-9,1],[1,-1],[0,-1],[1,-1],[2,0],[-3,-3],[-10,-5],[-4,-3],[-4,-2],[-6,-1],[-6,1],[-4,1],[-10,-4],[-4,-3],[-2,-4],[1,-7],[2,-2],[10,-3],[4,-2],[1,-2],[-1,-2],[-5,-1],[-3,0],[-4,2],[-13,2],[-2,2],[-2,3],[-2,1],[-2,1],[-16,-1],[-2,-2],[3,-4],[4,-1],[15,0],[3,-1],[2,-1],[3,-3],[3,-2],[2,1],[3,1],[2,0],[4,-2],[-1,-2],[-5,-1],[-5,-1],[-2,0],[-4,2],[-3,0],[-2,-1],[-3,-2],[-3,0],[-4,1],[-8,4],[-5,1],[-10,-1],[-18,-4],[-5,-2],[-2,-3],[-1,-4],[-4,-3],[-8,-4],[-8,-4],[-21,-2],[-34,1],[0,2],[-3,-2],[-4,-2],[-5,-2],[-5,0],[-5,1],[-4,1],[-11,9],[-1,2],[2,3],[1,5],[1,4],[4,4],[4,2],[21,9],[7,4],[6,7],[5,8],[4,4],[3,2],[4,0],[4,2],[4,3],[3,2],[1,5],[-1,8],[1,5],[2,2],[1,1],[2,2],[1,2],[0,3],[-1,2],[-1,2],[-1,3],[0,4],[2,12],[2,4],[7,8],[1,4],[-1,9],[-4,18],[-1,9],[2,18],[1,5],[4,0],[4,-3],[2,-4],[1,4],[-1,5],[-2,4],[-4,2],[-3,1],[-2,1],[-1,2],[-1,3],[-1,1],[-6,1],[-2,1],[-1,3],[0,2],[0,2],[0,2],[-1,2],[-8,7],[-6,3],[-3,3],[-3,9],[-3,4],[-8,3],[-3,5],[-4,10],[-7,26],[-5,7],[-7,3],[-4,3],[0,2],[2,4],[-1,5],[-13,14],[-4,4],[-3,-3],[-1,-5],[-2,-4],[-8,-10],[-1,-4],[0,-4],[3,-4],[1,-2],[2,-2],[0,-2],[-8,-10],[-15,-13],[-1,-3],[-8,-22],[0,-3],[0,-6],[0,-3],[-2,-2],[6,-7],[-3,-5],[-2,-4],[-1,-6],[-2,-15],[0,-3],[-2,-3],[-4,-5],[0,-2],[-1,-2],[-4,-5],[-1,-2],[-1,-3],[-2,-10],[-6,-12],[-2,-7],[2,-6],[-5,-3],[-1,-3],[1,-7],[0,-7],[-1,-1],[0,-1],[-6,-2],[-6,-7],[-2,-1],[-2,0],[-12,3],[-8,5],[-4,3],[-3,0],[-6,0],[-3,0],[-4,2],[-1,1],[-9,0],[-4,-1],[-4,-1],[-5,-3],[-7,-6],[-4,-1],[-15,1],[-5,-1],[-7,-6],[-3,-6],[-5,-4],[-10,0],[-13,4],[-5,-1],[-13,-6],[-6,-6],[-9,-3],[-8,1],[-4,5],[-1,1],[-3,2],[0,2],[0,1],[2,4],[0,2],[2,2],[7,4],[3,2],[-1,2],[1,1],[4,2],[2,1],[1,1],[1,3],[5,8],[0,3],[-1,5],[-2,3],[-1,2],[-1,2],[3,3],[5,4],[1,3],[-2,4],[9,10],[1,4],[3,0],[14,-5],[9,0],[19,4],[9,0],[4,-1],[3,-2],[2,-2],[11,-2],[3,-2],[4,-2],[6,2],[6,6],[1,8],[0,9],[1,9],[4,6],[1,3],[0,2],[0,6],[0,2],[7,21],[-3,6],[-1,8],[-3,6],[1,10],[-1,4],[-4,4],[-4,-1],[-2,-3],[-4,-2],[0,2],[5,10],[2,3],[3,0],[1,0],[0,1],[1,3],[1,2],[2,5],[2,16],[0,5],[-1,5],[-1,5],[-2,5],[-5,6],[0,2],[1,1],[1,2],[2,1],[5,-3],[3,0],[3,3],[6,11],[1,3],[0,3],[0,2],[-3,5],[-1,2],[-1,1],[2,3],[3,3],[4,4],[4,4],[5,2],[2,2],[1,3],[0,2],[0,2],[-2,2],[-2,1],[-1,2],[3,2],[3,2],[5,6],[11,9],[2,1],[8,13],[5,7],[4,-1],[2,0],[13,16],[3,6],[6,3],[1,-2],[-2,-4],[1,-3],[6,2],[0,3],[0,6],[1,5],[0,6],[-2,3],[-2,6],[-3,7],[-3,3],[-2,3],[-2,3],[-2,4],[0,5],[1,3],[-1,3],[-4,5],[-6,6],[-1,8],[2,3],[2,4],[2,5],[3,3],[9,2],[12,8],[1,0],[2,-1],[2,0],[1,0],[2,3],[1,0],[3,-1],[2,-1],[2,-1],[3,2],[1,2],[0,1],[0,1],[-1,2],[1,5],[-1,2],[-1,3],[-1,4],[-2,3],[-2,2],[-2,1],[-5,0],[-2,1],[-2,2],[0,1],[-12,47],[0,3],[2,2],[5,3],[-9,7],[-1,1],[-1,2],[-1,0],[-2,1],[-2,1],[-2,0],[-1,0],[0,1],[0,1],[0,1],[-1,1],[0,1],[1,4],[0,2],[-1,2],[-5,4],[-2,3],[-2,3],[1,3],[3,3],[-2,1],[-2,1],[-2,0],[-1,1],[-1,2],[-1,4],[-1,1],[-2,-1],[-1,-3],[-1,-5],[-1,-3],[2,-4],[0,-5],[0,-10],[-2,-5],[0,-2],[6,-2],[2,-2],[2,-3],[1,-3],[1,-9],[0,-15],[0,-2],[-1,-2],[-1,-2],[-2,-6],[-2,-2],[-2,0],[-1,1],[-1,0],[-2,-2],[0,-2],[0,-3],[1,-2],[4,-5],[1,-2],[-2,-2],[-5,-1],[-3,1],[-2,0],[-4,2],[-7,6],[-4,0],[-5,-2],[-5,-3],[-3,-4],[0,-1],[0,-5],[0,-1],[-1,-2],[-17,-16],[-4,-3],[-5,-1],[-4,-3],[-1,-5],[-1,-5],[0,-4],[-2,-4],[-10,-16],[-1,-4],[-1,-17],[-2,-5],[-2,-4],[-9,-11],[-3,-4],[-11,-25],[-6,-9],[-5,-4],[-4,-1],[-6,-6],[-5,-2],[-11,-1],[-13,-3],[-2,1],[-2,0],[-2,2],[-1,1],[0,1],[-1,2],[-4,3],[-5,1],[-3,-2],[-1,-5],[-1,-2],[-2,-2],[-2,-1],[-2,-1],[-2,-1],[0,-2],[1,-2],[0,-2],[13,5],[4,-1],[-12,-6],[-3,-2],[-4,-3],[-5,0],[-5,0],[-5,-1],[-4,-2],[-3,-2],[-3,-2],[-6,-1],[-2,-1],[-3,-5],[-2,0],[-2,-1],[-5,-2],[-14,-5],[-3,-2],[-2,-2],[0,-1],[0,-5],[-9,-5],[-7,-6],[-3,-2],[-10,-2],[-4,-2],[-13,-10],[-2,-2],[-1,-2],[0,-5],[-1,-2],[-1,-2],[-3,-4],[-1,-2],[-2,-6],[-6,-5],[-13,-22],[-7,-5],[-13,-5],[-5,-6],[2,-3],[-1,-3],[-2,-2],[0,-2],[2,-3],[1,-2],[-1,-7],[-1,-7],[-3,-4],[-3,0],[-2,6],[-2,5],[-6,-1],[-11,-6],[-6,0],[-3,-1],[-3,-3],[-1,-4],[-2,-6],[-1,-3],[5,-6],[0,-4],[-2,-3],[-5,4],[-4,0],[-3,-2],[-2,-6],[0,-2],[-1,-4],[0,-3],[0,-2],[4,-4],[2,-2],[-2,-5],[-4,0],[-5,1],[-3,-3],[-1,-2],[-4,-3],[-1,-1],[2,-2],[2,-1],[7,-1],[4,1],[4,1],[4,2],[8,8],[1,0],[3,-1],[1,-1],[2,-2],[2,1],[2,3],[-1,5],[1,1],[2,2],[2,-1],[1,-1],[1,-3],[0,-10],[-2,-4],[-3,-4],[-3,-3],[-2,-2],[-1,-4],[6,-15],[0,-3],[1,-1],[2,-3],[-2,-3],[-5,-1],[-3,-2],[-4,2],[-4,9],[-3,2],[-2,1],[-6,2],[-3,1],[-1,1],[0,2],[-1,2],[-7,7],[-8,4],[-9,-1],[-8,-7],[-2,-4],[0,-1],[-1,0],[-2,-1],[1,-2],[1,-2],[0,-2],[-2,-1],[-11,0],[-2,1],[0,2],[0,3],[0,3],[-4,7],[-20,18],[-8,10],[-4,4],[-6,4],[-10,4],[-2,2],[-3,1],[-6,-2],[-3,1],[5,8],[0,3],[-4,4],[-7,6],[-8,5],[-5,1],[-4,-1],[-4,-1],[-4,-1],[-4,-1],[-4,-3],[-4,-2],[-2,2],[0,4],[7,8],[1,4],[1,5],[3,3],[3,2],[2,3],[1,2],[1,2],[1,2],[2,1],[2,-1],[-1,-2],[-1,-5],[0,-5],[3,-3],[4,-1],[15,-3],[3,-1],[-4,-2],[-1,-3],[1,-3],[2,-3],[7,-2],[1,-1],[-3,-3],[2,-2],[4,-3],[5,-2],[3,-2],[2,1],[5,2],[13,2],[1,3],[-5,1],[-9,1],[0,3],[1,4],[0,2],[-1,3],[-2,-1],[-2,-1],[-1,-1],[-1,-2],[-1,-2],[-2,0],[-2,2],[0,2],[-1,3],[0,2],[-1,1],[0,2],[0,2],[3,2],[1,2],[0,3],[0,2],[-2,5],[-5,6],[-1,3],[-3,30],[-4,11],[-6,10],[-7,0],[-5,4],[-1,2],[-2,3],[4,0],[4,2],[1,3],[-1,2],[1,3],[0,2],[-1,2],[0,2],[0,10],[-2,4],[-3,4],[-6,7],[-6,13],[-2,2],[-5,1],[-4,2],[-16,16],[-13,11],[-13,8],[-2,2],[-5,3],[-1,1],[-4,5],[-1,2],[-7,3],[-2,1],[3,2],[-2,4],[1,4],[2,5],[2,4],[-1,10],[-1,4],[-1,5],[-7,14],[-2,9],[-3,4],[-8,6],[-7,8],[-2,1],[-6,2],[-2,2],[-2,3],[4,2],[5,0],[3,0],[-1,3],[-2,4],[-2,5],[-3,2],[-5,0],[-14,4],[-5,0],[-3,-3],[1,-4],[4,-2],[6,1],[2,-1],[1,-2],[1,-2],[2,-2],[2,-1],[1,-2],[-2,0],[-2,-1],[-1,-1],[-2,-2],[-5,7],[-4,2],[-10,2],[-14,8],[-7,1],[-5,-2],[-4,-2],[-5,-1],[0,1],[-2,2],[-3,2],[-1,-2],[0,-3],[0,-3],[-1,-2],[-3,-1],[-12,9],[-2,4],[0,4],[-1,4],[-5,11],[-2,2],[-2,2],[-5,0],[-6,-1],[-3,1],[-2,3],[3,2],[8,1],[2,3],[1,4],[-2,4],[-3,4],[-3,1],[-3,0],[-1,-1],[-1,-1],[-1,-1],[-2,1],[-4,2],[-8,1],[-3,1],[-2,4],[1,1],[3,4],[2,1],[6,4],[2,2],[1,5],[-1,6],[-4,6],[-8,10],[-1,2],[2,3],[3,0],[6,-1],[17,-1],[5,-1],[-3,-3],[-1,-2],[-1,-3],[0,-2],[0,-3],[0,-2],[1,-2],[3,-1],[2,1],[1,5],[1,3],[3,3],[4,3],[1,2],[2,2],[1,4],[3,5],[0,4],[-5,16],[-4,8],[-6,6],[-7,7],[-10,8],[-4,1],[-3,0],[-2,0],[-2,-2],[-2,-1],[-1,-1],[-5,2],[-2,1],[-4,-2],[-3,-4],[-3,-3],[-2,-2],[-6,1],[-4,1],[-3,-1],[-5,-4],[-1,-2],[0,-2],[-2,-1],[-3,-1],[-2,0],[-3,0],[-1,2],[-1,2],[0,1],[2,3],[0,1],[1,0],[-1,3],[0,1],[-1,7],[1,1],[1,4],[3,5],[3,3],[2,-3],[1,-2],[5,0],[3,3],[1,4],[-2,3],[-7,7],[-1,4],[-2,3],[-10,8],[-4,6],[-1,1],[-3,-1],[-2,-1],[-2,-2],[-1,-1],[-3,0],[-1,2],[-1,2],[0,6],[-1,1],[-1,0],[-5,2],[-5,1],[-1,1],[-3,1],[0,1],[1,1],[0,2],[-1,3],[-2,0],[-2,1],[-2,1],[0,2],[1,1],[2,2],[1,2],[-2,2],[-5,2],[-6,1],[-4,1],[-4,-2],[-1,-4],[0,-5],[-2,-4],[-2,-2],[-2,0],[-10,4],[-2,2],[-2,1],[0,5],[-3,1],[-5,-4],[-3,0],[-2,0],[-2,-1],[-1,-3],[1,-2],[2,-1],[5,0],[5,-3],[3,-3],[1,-2],[-4,-2],[-2,1],[-4,2],[-2,1],[-1,-1],[-1,-2],[-2,-1],[-2,-1],[-12,1],[-6,2],[-5,2],[-5,-6],[-2,-1],[-2,1],[-4,3],[-4,2],[-5,1],[-2,1],[-3,-1],[-4,-2],[-1,0],[-2,0],[0,1],[-1,1],[-2,3],[-17,15],[-4,2],[-5,1],[-2,-1],[-2,-2],[-1,-1],[-3,1],[-1,1],[0,3],[-1,3],[-3,2],[-4,1],[-14,10],[-6,6],[-9,7],[-5,1],[-5,1],[-11,-1],[-10,1],[-15,3],[-5,0],[-11,-2],[-4,-1],[-4,-2],[-3,-2],[-2,-4],[1,-3],[3,-3],[2,-3],[-2,-1],[-2,0],[-5,2],[-4,1],[-5,1],[-5,-1],[-11,-4],[-10,-1],[-10,1],[-8,4],[-7,5],[-12,13],[-6,6],[-34,18],[-30,21],[-54,27],[-41,17],[-36,11],[-9,1],[-10,-4],[-21,-14],[-35,-10],[-9,-1],[-20,0],[-33,5],[-51,0],[-9,2],[-24,0],[-5,-1],[-12,-3],[-29,1],[-42,-6],[-46,-2],[-15,-4],[-4,0],[-19,0],[-12,-3],[-5,0],[-14,0],[-4,0],[-14,-5],[-3,0],[-7,0],[-20,-2]],[[5430,6317],[81,0],[81,0],[81,0],[81,0],[82,0],[81,0],[81,0],[81,0],[0,-83],[0,-82],[0,-82],[0,-83],[0,-82],[0,-83],[0,-82],[0,-82]],[[7268,3516],[9,-2],[10,2],[5,0],[5,-2],[2,1],[2,0],[2,0],[2,-1],[-1,-2],[-1,-1],[-2,0],[-13,0],[-2,-1],[-2,-4],[-2,-1],[-4,0],[-5,2],[-4,2],[-4,3],[-1,4],[4,0]],[[7019,3566],[1,-1],[2,-2],[1,-3],[0,-3],[-2,-2],[0,1],[0,1],[-1,1],[-6,4],[-6,3],[-6,1],[-7,-1],[-2,-1],[-2,-1],[-1,-1],[-2,1],[-4,2],[-1,0],[-3,0],[-7,-1],[-3,0],[1,2],[8,5],[4,5],[3,2],[3,1],[13,1],[2,1],[2,0],[1,0],[3,-1],[1,-1],[2,-1],[1,-1],[-2,-1],[-1,0],[2,-4],[1,-1],[-1,-1],[1,-1],[1,-1],[3,0],[1,0],[1,-1],[-1,-1]],[[7024,3609],[3,0],[10,2],[4,0],[2,-1],[2,-2],[7,-8],[-1,-1],[-4,-1],[-9,0],[-3,-1],[-8,-8],[-5,-3],[-7,2],[-2,1],[-6,3],[-1,2],[0,3],[-2,4],[6,8],[-1,1],[-1,2],[0,2],[2,1],[2,0],[1,-1],[1,-1],[1,-1],[9,-3]],[[8022,3788],[-5,-5],[-12,-4],[-25,-1],[1,0],[1,2],[0,1],[-1,1],[3,4],[-1,2],[-2,-1],[-3,-3],[-2,1],[-9,2],[9,-12],[1,-3],[-2,-3],[-7,-5],[-3,-7],[-7,-9],[-3,-2],[-11,-2],[-1,-2],[-1,-2],[-2,-2],[-4,-1],[-10,-1],[-4,-2],[-1,-1],[-2,-4],[-2,-1],[-2,-1],[-30,0],[-9,-3],[-6,-5],[-1,1],[-1,2],[-1,2],[0,2],[-1,0],[-17,0],[-5,1],[-4,2],[-9,-3],[-32,0],[-9,-1],[-25,0],[-5,-2],[-6,-3],[-3,-1],[-26,3],[-64,-3],[-38,-7],[-46,-14],[-35,-15],[-36,-21],[-42,-30],[-47,-39],[-21,-17],[-21,-21],[-20,-14],[-2,-1],[-1,-1],[-7,-9],[-2,0],[-1,2],[3,3],[-4,1],[-30,-5],[-11,1],[-5,-1],[-9,-5],[-5,-1],[-5,1],[-5,0],[-10,-2],[-6,-2],[-2,-3],[-2,-1],[-5,3],[-4,4],[-1,1],[-4,2],[-20,-2],[-4,-1],[-3,-2],[-9,-9],[7,-6],[1,-2],[2,-3],[2,-2],[1,-1],[4,1],[1,-1],[0,-1],[0,-2],[0,-1],[0,-3],[0,-2],[1,-3],[3,-1],[-1,-4],[2,-3],[3,0],[4,1],[3,3],[4,5],[4,3],[3,0],[4,0],[2,0],[1,2],[0,2],[0,2],[1,3],[2,3],[4,3],[3,-1],[3,-4],[-2,-3],[0,-3],[0,-7],[1,-2],[0,-1],[1,-2],[1,-2],[0,-1],[0,-1],[0,-1],[0,-2],[-1,-1],[-3,-2],[-2,-2],[-1,-4],[-1,-2],[-2,-7],[0,-3],[0,-1],[2,-1],[2,0],[2,1],[1,-1],[3,-8],[-1,-1],[-3,-1],[-3,-1],[-3,-2],[0,-2],[1,-2],[-1,-4],[-2,-2],[-4,-2],[-3,0],[-3,1],[-7,2],[-3,2],[-2,3],[-1,4],[2,1],[3,1],[1,3],[-2,2],[-9,4],[-2,2],[-5,7],[-3,13],[-15,15],[-20,11],[-16,-2],[-2,-4],[0,-4],[-1,-7],[-2,-1],[-12,-1],[-3,0],[-2,2],[-4,15],[-9,15],[-7,9],[-12,10],[-2,3],[6,-2],[9,-6],[6,-1],[-5,7],[-5,4],[-7,2],[-9,1],[-8,-2],[-12,-7],[-9,0],[-6,4],[-9,15],[-4,3],[-2,1],[-12,5],[-12,2],[-4,1],[0,2],[5,1],[5,2],[3,3],[-3,3],[2,3],[1,3],[-1,4],[-2,3],[7,3],[2,0],[2,-1],[2,-1],[1,-1],[5,1],[3,3],[2,3],[2,1],[4,2],[-1,3],[-3,4],[-4,2],[-1,1],[0,2],[2,4],[-2,2],[-3,4],[-6,8],[-2,3],[-4,1],[-4,0],[-10,-1],[-8,0],[-2,-1],[-1,-2],[-1,0],[-3,2],[-4,1],[-5,0],[-4,-2],[2,-3],[-1,-2],[-2,-2],[-2,-2],[-2,-5],[-2,-1],[-2,-1],[-2,-2],[0,-3],[3,-3],[1,-2],[1,-6],[1,-6],[-20,3],[-5,-1],[-2,-2],[-1,-2],[-2,-3],[-7,-2],[-2,-2],[-3,-6],[2,-1],[-5,-1],[-15,-1],[-2,-3],[-5,2],[-7,4],[-35,29],[-3,2],[-5,1],[-3,1],[-1,2],[1,2],[2,-1],[2,-1],[7,-2],[5,-2],[7,-7],[5,-1],[10,0],[9,1],[13,6],[6,1],[3,2],[1,2],[-1,2],[-1,2],[2,2],[5,3],[1,2],[1,3],[1,3],[2,2],[3,3],[3,4],[10,10],[2,8],[-1,8],[-3,8],[-5,6],[-3,1],[-6,2],[-3,2],[-1,1],[-5,8],[-3,9],[-2,4],[-4,4],[-6,3],[-5,0],[-1,-7],[-14,2],[-4,-1],[-1,-3],[-2,-4],[-1,-3],[-2,-1],[-4,-2],[-4,-1],[-3,0],[-3,-2],[-8,-6],[-1,-2],[-4,-3],[-24,-6],[-4,-3],[-2,-3],[-2,-2],[0,-2],[1,-1],[0,-2],[-2,-1],[-2,0],[-3,0],[-2,2],[-1,1],[-6,-2],[-13,0],[-5,-3],[-2,-6],[4,-2],[12,-1],[19,-4],[7,1],[6,2],[15,9],[11,-5],[5,-4],[-2,-6],[0,-1],[0,-3],[-1,-1],[-1,-1],[-3,0],[-1,0],[-4,-4],[-2,-3],[-2,-2],[0,-6],[-9,-1],[-18,0],[-2,-1],[-2,-1],[-2,0],[-2,0],[-3,0],[-5,2],[-2,0],[-5,0],[-4,-2],[-20,-12],[-11,-9],[-2,-1],[-5,0],[-3,-1],[-1,-1],[-3,-4],[-2,-1],[-11,-3],[-1,-1],[-2,-3],[-1,-1],[-10,-1],[-4,-3],[-12,-10],[0,-1],[0,-2],[1,-2],[-2,-3],[-3,-1],[-5,-1],[-3,-1],[-3,-4],[-5,-9],[-3,-2],[-2,-1],[-3,-2],[-3,-4],[-2,-2],[-21,-6],[-5,0],[-4,-2],[-3,-3],[-2,-4],[-3,-4],[0,-1],[0,-1],[-1,0],[0,-1],[-3,1],[-1,0],[-8,-4],[-2,-2],[-6,-6],[-3,-2],[-5,-1],[-4,1],[-7,6],[-3,2],[-1,0],[-2,3],[-1,1],[-8,3],[-8,4],[-4,2],[-5,0],[-21,-1],[-4,1],[-4,3],[-4,4],[-1,3],[-13,10],[-8,5],[-5,2],[-24,3],[-10,4],[-7,1],[-3,2],[-2,1],[-8,1],[-10,9],[-6,3],[-18,11],[-14,7],[-8,5],[-3,1],[-1,1],[-1,1],[-2,0],[-1,0],[-2,5],[0,1],[-1,1],[-3,0],[-2,-1],[-1,-1],[-1,-3],[0,-2],[-5,2],[-3,1],[-4,5],[-3,1],[-19,0],[-6,-2],[-3,-4],[-10,-3],[-10,2],[-19,7],[-23,15],[-8,3],[-2,0],[-8,0],[-3,1],[-5,2],[-22,2],[-9,-2],[-10,-3],[-9,-6],[-3,-6],[1,-3],[5,-5],[1,-3],[1,-3],[-2,0],[-5,1],[-2,0],[-1,1],[-2,0],[-1,-1],[-5,-4],[-1,-1],[-1,-3],[-1,-1],[-3,1],[-2,2],[-3,6],[-3,2],[-2,2],[-3,1],[-4,0],[-3,0],[-4,0],[-1,-2],[0,-2],[-1,-2],[-3,-1],[-3,1],[-4,2],[-2,1],[2,2],[3,4],[1,4],[1,1],[-1,4],[-1,3],[-4,3],[-35,26],[-17,10],[-32,13],[-3,2],[-1,0]],[[8783,6006],[3,-1],[10,1],[-5,-9],[-4,-11],[-11,-47],[-1,-1],[-4,0],[-3,0],[-2,-1],[-2,0],[-2,6],[0,3],[1,6],[1,1],[1,1],[1,1],[0,2],[0,2],[-2,3],[-1,2],[0,3],[3,7],[0,3],[0,3],[-3,9],[1,3],[5,6],[2,3],[0,7],[0,3],[2,1],[3,-1],[3,-2],[1,-2],[3,-1]],[[8770,6019],[-1,-1],[-3,4],[0,4],[-1,6],[-2,6],[-2,2],[-2,3],[-2,4],[-1,14],[1,13],[-1,5],[-1,4],[1,2],[4,2],[8,2],[4,3],[3,1],[2,-1],[2,-3],[-1,-5],[-9,-27],[-1,-9],[0,-11],[0,-2],[2,-6],[1,-3],[-1,-3],[0,-4]],[[8678,6464],[-2,-2],[-7,9],[-2,4],[2,2],[7,-7],[2,-6]],[[8739,6594],[-1,-26],[1,-4],[3,-12],[3,-3],[2,-1],[8,-6],[2,-3],[1,-5],[-2,-4],[-2,-4],[-1,-3],[-1,-5],[-17,-38],[-23,-45],[-17,-45],[1,-5],[3,-7],[0,-8],[-4,-6],[-6,-3],[-8,10],[-4,5],[-1,4],[1,4],[-3,11],[0,5],[-6,2],[-3,6],[1,7],[3,3],[5,3],[2,7],[1,13],[2,3],[2,2],[2,1],[2,2],[3,7],[2,2],[2,6],[-3,12],[3,6],[-1,2],[-2,1],[-2,0],[-5,2],[-2,0],[0,1],[0,2],[2,3],[3,3],[24,15],[7,6],[6,7],[4,6],[4,8],[1,8],[-2,9],[-4,7],[-6,9],[-7,7],[-5,-1],[12,15],[2,0],[7,6],[8,4],[2,2],[1,-10]],[[8328,6786],[-1,-3],[-4,1],[-1,6],[-2,3],[-5,6],[-1,7],[0,1],[1,2],[1,2],[2,0],[1,-7],[1,-3],[5,-5],[2,-5],[1,-5]],[[8252,6877],[1,-1],[2,1],[2,0],[2,1],[2,-1],[0,-2],[0,-2],[1,-1],[4,-2],[9,-1],[2,-3],[2,-1],[4,-1],[2,-1],[-3,-3],[4,-1],[4,2],[3,5],[3,2],[0,-6],[-3,-10],[0,-4],[1,-6],[2,-6],[2,-4],[4,-3],[4,-2],[2,-7],[1,-6],[-1,-3],[-1,0],[-1,-1],[-1,-2],[-1,0],[0,-1],[-1,-1],[-1,-1],[-1,1],[-7,-1],[-2,0],[-2,0],[-2,2],[-2,3],[-3,3],[-2,2],[-2,8],[-3,4],[-9,11],[-6,4],[-2,2],[-3,5],[-7,9],[-5,7],[-4,4],[8,3],[1,1],[0,1],[-1,2],[2,2],[2,-1]],[[8239,6938],[2,-1],[1,0],[0,-2],[-1,-1],[-2,1],[-2,0],[-1,-1],[-3,0],[-1,-1],[-1,0],[-1,1],[0,2],[0,1],[0,1],[1,0],[2,0],[1,0],[1,3],[1,1],[1,0],[1,0],[1,-1],[-1,-1],[1,-2]],[[8223,6960],[2,-2],[-1,-1],[-2,1],[-1,0],[-2,0],[0,2],[1,3],[1,0],[1,0],[0,-1],[1,-2]],[[7969,7101],[-1,-2],[-2,2],[-1,1],[1,2],[1,3],[-1,2],[-1,2],[1,2],[1,5],[2,3],[1,0],[3,-2],[4,-4],[-2,0],[-1,-2],[0,-2],[0,-3],[-5,-7]],[[8149,7131],[-1,-3],[-2,-1],[-2,-1],[-1,-1],[0,-2],[-1,-1],[-2,-1],[-1,-1],[-4,-2],[-3,2],[-1,3],[3,3],[-3,3],[-1,0],[-1,-1],[-1,0],[-1,-1],[2,4],[3,4],[2,5],[-1,3],[-1,2],[-1,2],[0,1],[3,1],[3,-1],[1,-2],[1,-2],[2,-2],[1,-2],[0,-2],[0,-2],[2,-1],[1,0],[2,-1],[1,-2],[1,-1]],[[8029,7173],[4,-1],[1,0],[1,0],[1,-1],[-1,0],[-4,0],[1,-2],[-1,-1],[-9,-7],[-5,-2],[-2,0],[-1,2],[0,2],[4,3],[1,0],[4,3],[4,1],[1,1],[0,1],[1,1]],[[8008,7148],[-5,-2],[-2,1],[0,2],[1,2],[0,2],[-1,2],[-1,1],[-1,1],[0,3],[0,4],[1,6],[2,4],[3,3],[-1,2],[1,3],[2,3],[2,1],[-1,-7],[0,-2],[1,-4],[3,-4],[0,-3],[0,-6],[-1,-6],[-3,-6]],[[8001,7195],[-3,-3],[-1,1],[-3,0],[1,2],[2,0],[1,0],[0,1],[1,1],[2,1],[1,0],[1,-1],[-1,-1],[-1,-1]],[[8060,7202],[2,-1],[1,0],[1,1],[1,-1],[2,1],[1,-2],[-1,-1],[-1,-1],[1,-1],[-4,-2],[0,2],[0,2],[-3,1],[0,2]],[[8107,7256],[-2,-4],[-1,-4],[-2,-2],[-4,0],[-7,5],[0,1],[5,2],[3,0],[2,-2],[6,4]],[[8094,7270],[-1,-4],[-1,1],[-1,1],[-1,-2],[0,-1],[-2,0],[-1,1],[-2,2],[-2,0],[-1,0],[-1,-2],[-1,2],[0,1],[1,2],[1,1],[-1,2],[0,1],[0,3],[1,0],[3,-3],[5,-2],[4,-3]],[[7985,7282],[-2,-2],[-1,2],[0,-1],[-1,1],[2,2],[1,0],[1,0],[0,1],[2,0],[0,-1],[1,-2],[-3,0]],[[7960,7342],[-1,0],[-1,2],[-1,2],[-1,0],[2,3],[0,-2],[2,0],[1,-2],[0,-1],[0,-1],[-1,-1]],[[8008,7410],[-2,0],[0,2],[-1,2],[3,0],[0,-1],[1,-2],[-1,-1]],[[7905,7428],[-1,-1],[0,1],[1,2],[0,1],[-1,2],[-1,1],[1,1],[2,1],[1,0],[2,0],[1,-1],[1,-2],[0,-1],[-1,-1],[-2,-2],[-1,-1],[-2,0]],[[7899,7437],[1,0],[1,-1],[1,-4],[0,-1],[-1,1],[-2,0],[-1,1],[-1,0],[-1,0],[0,1],[0,1],[-1,0],[1,1],[2,1],[1,0]],[[7946,7445],[0,-2],[-1,-2],[-2,-1],[-2,0],[-3,1],[-1,3],[2,1],[2,0],[1,1],[0,1],[0,1],[2,0],[2,-2],[0,-1]],[[7873,7456],[0,-3],[-2,2],[-1,-1],[-2,-1],[0,1],[1,2],[-1,0],[-2,1],[1,1],[3,1],[1,0],[1,-1],[1,-2]],[[7877,7459],[-1,-1],[-1,1],[-2,0],[-2,0],[0,1],[-1,2],[3,2],[2,-2],[1,-1],[1,-2]],[[7914,7470],[-2,2],[0,3],[1,-1],[2,-1],[1,-2],[-2,-1]],[[7847,7486],[-1,-1],[-1,0],[0,-1],[-2,-1],[-2,-2],[0,2],[1,0],[1,2],[0,2],[1,0],[0,2],[1,-1],[2,-2]],[[7831,7528],[-2,-3],[-2,-3],[-4,-3],[-1,1],[-2,1],[0,2],[0,2],[1,1],[3,0],[2,1],[3,4],[1,4],[0,4],[1,4],[1,-4],[0,-4],[2,-2],[2,-3],[-5,-2]],[[7785,7548],[-1,-1],[-1,1],[0,1],[-1,0],[-1,3],[0,1],[-1,1],[0,1],[0,1],[0,2],[0,1],[0,1],[-1,1],[1,0],[0,4],[1,0],[1,0],[0,-2],[-1,-4],[1,-3],[2,-2],[1,-2],[1,-2],[0,-1],[-1,-1]],[[7775,7579],[1,-2],[3,2],[-1,-3],[0,-1],[-2,-2],[-1,-1],[-1,3],[0,1],[1,0],[-1,1],[0,1],[1,1]],[[7821,7575],[5,-4],[1,-2],[-1,-3],[-2,1],[-2,1],[-2,4],[-3,-7],[-2,-2],[-3,4],[-3,-1],[-2,-2],[-2,0],[0,9],[-4,-2],[-1,-1],[-2,0],[-2,1],[-1,1],[2,2],[6,6],[1,3],[-4,1],[2,5],[1,5],[1,5],[4,3],[0,-3],[4,-6],[0,-2],[0,-6],[1,-2],[4,-1],[0,-1],[4,-6]],[[7807,7622],[-2,-4],[-4,-4],[-2,-4],[0,-1],[3,-4],[0,-2],[-1,-1],[-7,-6],[1,4],[0,2],[-1,-1],[-1,-1],[0,1],[-1,1],[-1,0],[-1,-3],[-2,1],[-1,1],[-1,2],[-1,2],[2,3],[6,7],[-1,1],[-1,1],[0,1],[0,2],[3,2],[1,-1],[1,-1],[1,0],[3,1],[1,1],[1,2],[1,2],[4,-4]],[[7961,7629],[0,-1],[-1,1],[1,0]],[[7698,7629],[-2,-4],[-1,0],[-1,1],[-1,0],[-1,0],[0,7],[0,3],[-1,2],[1,5],[5,-4],[2,-5],[-1,-5]],[[7351,7831],[0,-3],[0,-5],[-1,-2],[-1,-2],[-2,2],[-8,-5],[-4,3],[-2,3],[-1,2],[-1,2],[1,2],[2,1],[3,0],[3,0],[2,3],[1,-1],[1,-1],[4,-1],[1,3],[1,0],[1,-1]],[[7299,7913],[4,-2],[7,0],[0,-2],[-2,-3],[-3,0],[-2,-1],[-3,1],[-3,1],[-2,0],[-3,0],[-4,-1],[-3,1],[0,4],[3,6],[0,3],[-2,3],[1,2],[3,-2],[2,-2],[2,-1],[2,-3],[3,-4]],[[7213,8025],[2,-2],[9,0],[3,-1],[-1,-3],[-3,-4],[-1,-4],[0,-4],[1,-4],[5,-6],[2,-1],[4,0],[1,-1],[1,-3],[-1,-1],[-2,-1],[-2,0],[1,-2],[5,-2],[1,-2],[0,-2],[-1,-1],[-2,-1],[-1,0],[-3,-8],[-2,-3],[-4,-3],[-4,2],[-8,2],[-3,2],[-2,5],[-2,12],[-1,3],[-6,9],[-2,2],[-9,6],[-3,2],[-2,2],[-1,3],[1,5],[5,-1],[11,-4],[10,-3],[1,4],[-1,7],[2,7],[2,-6]],[[7200,8035],[-3,-1],[-3,1],[1,2],[0,1],[1,3],[1,0],[2,-1],[2,-1],[1,-2],[-2,-2]],[[7199,8083],[0,-2],[-2,3],[-3,0],[-1,2],[-2,1],[1,2],[1,1],[2,-1],[3,-3],[1,-3]],[[5769,8272],[-3,-1],[-7,-1],[-1,0],[-1,-2],[-1,-1],[-3,0],[-2,1],[0,2],[-1,1],[0,1],[-4,0],[-3,-2],[-3,-3],[0,-4],[-2,0],[0,1],[-1,1],[0,1],[-3,6],[1,3],[4,1],[4,4],[6,8],[3,4],[1,2],[0,3],[3,-1],[9,-7],[3,-4],[-2,-3],[1,-2],[3,-2],[1,-2],[-2,-4]],[[7162,8308],[-3,-2],[-2,3],[2,1],[2,1],[1,-1],[0,-2]],[[5671,8325],[-2,-1],[-1,1],[-1,2],[0,2],[0,2],[-2,1],[4,2],[6,1],[5,0],[0,-3],[-2,-2],[-5,0],[-2,-2],[0,-3]],[[5797,8415],[-1,-2],[0,-1],[4,-1],[2,2],[1,3],[2,0],[1,-2],[0,-4],[0,-4],[-1,-3],[-1,1],[-1,2],[-1,1],[-2,-2],[-1,-2],[1,-2],[0,-2],[-1,-1],[-2,1],[-4,1],[-5,0],[-4,-2],[-4,-2],[-2,-4],[-2,3],[-4,8],[-2,1],[0,1],[-2,2],[-2,1],[-1,-1],[-1,-1],[-4,-5],[-1,0],[-6,0],[-1,-1],[-1,-2],[2,-2],[3,-1],[2,0],[2,-1],[0,-3],[-2,-2],[-3,1],[-2,2],[-2,0],[-2,-1],[-2,-2],[1,-7],[1,-2],[-1,-1],[-3,-4],[0,-1],[0,-1],[-1,-3],[-2,-2],[-2,-1],[-2,1],[-3,4],[-3,1],[-2,-2],[-3,-8],[-3,-2],[-4,-1],[-5,-4],[-3,-1],[-14,0],[-3,0],[-1,3],[-7,8],[-2,2],[1,-4],[0,-7],[0,-4],[-3,0],[-1,-3],[-3,-2],[-1,0],[-1,6],[-1,4],[0,3],[1,1],[1,2],[2,2],[0,3],[1,5],[1,4],[2,4],[2,3],[5,4],[2,3],[1,4],[0,2],[2,2],[2,1],[2,0],[2,1],[4,6],[2,2],[5,2],[4,1],[10,0],[25,6],[12,6],[8,2],[5,-1],[2,-1],[1,-3],[3,-3],[3,-1],[3,-1],[9,-1],[-1,-1]],[[7046,8803],[-1,0],[-3,1],[-1,0],[-1,2],[1,1],[1,2],[-1,1],[1,1],[1,0],[2,-1],[2,-2],[0,-2],[0,-2],[-1,-1]],[[6939,8844],[2,-4],[-1,0],[-1,1],[-2,0],[-2,1],[1,2],[1,-1],[2,1]],[[6788,8910],[0,-1],[-4,1],[-4,2],[-1,2],[2,1],[1,2],[2,1],[2,-1],[2,-3],[1,-3],[-1,-1]],[[6773,8913],[0,1],[0,1],[4,4],[-1,4],[1,1],[1,0],[1,-1],[1,0],[1,-1],[2,0],[2,-1],[-1,-1],[-2,0],[-2,-1],[-2,-1],[-1,-1],[-2,-1],[-2,-3]],[[6844,8926],[-2,-2],[-3,2],[3,2],[2,-2]],[[6601,9330],[0,-2],[-2,0],[0,1],[2,1]],[[6571,9394],[-1,0],[-1,1],[-1,1],[0,2],[2,-1],[1,-3]],[[6615,9409],[-1,-1],[0,3],[1,-1],[0,-1]],[[6732,9481],[1,-1],[-1,0],[0,1]],[[5430,8395],[13,-16],[9,-4],[11,-10],[7,-4],[7,-3],[4,-2],[5,-1],[2,0],[2,-1],[2,-3],[1,-1],[4,-1],[13,1],[7,-3],[9,-4],[10,-4],[12,4],[22,0],[2,-1],[6,-6],[2,-1],[3,-1],[7,-3],[3,-2],[11,-2],[8,-5],[6,-1],[22,-2],[8,-2],[6,-4],[6,-14],[6,-5],[14,-7],[-3,-7],[0,-12],[2,-11],[3,-8],[10,-18],[6,-8],[8,-5],[8,-3],[19,-1],[8,-2],[2,-2],[6,-4],[7,-4],[2,-2],[3,-3],[10,-6],[9,-10],[5,-4],[6,-2],[6,0],[18,-5],[5,-1],[4,-2],[2,-2],[20,-7],[2,-3],[5,-8],[8,-7],[2,-1],[25,-2],[27,3],[35,7],[4,2],[2,2],[2,2],[5,1],[10,0],[3,2],[3,2],[6,5],[2,1],[5,0],[2,2],[2,1],[6,4],[7,6],[3,2],[10,2],[2,1],[0,3],[2,4],[3,2],[5,2],[5,2],[4,0],[3,2],[2,5],[6,16],[2,19],[3,8],[1,2],[5,5],[1,7],[1,2],[1,3],[2,14],[0,4],[-2,4],[0,4],[2,4],[20,25],[7,19],[2,1],[4,0],[2,0],[1,2],[5,6],[11,12],[2,4],[1,3],[3,7],[2,15],[2,4],[4,-1],[5,9],[2,5],[0,5],[2,4],[0,3],[-1,1],[-2,1],[0,2],[0,4],[1,3],[5,7],[1,3],[1,5],[4,9],[1,4],[0,9],[1,2],[2,3],[1,4],[12,22],[1,4],[-3,5],[-8,22],[0,2],[1,3],[4,3],[1,3],[0,8],[7,45],[11,37],[18,42],[1,4],[0,8],[1,3],[2,3],[3,1],[-1,4],[2,3],[4,3],[2,3],[0,4],[-1,4],[1,3],[5,0],[-1,4],[0,4],[2,5],[0,5],[-1,5],[-1,4],[-2,3],[-3,3],[0,2],[1,2],[-5,6],[-2,4],[-13,57],[0,14],[-1,4],[-3,8],[-1,4],[0,9],[3,9],[12,34],[2,9],[1,10],[-1,10],[-3,9],[-5,6],[-6,6],[-11,16],[-4,18],[2,19],[11,45],[5,11],[1,5],[1,2],[7,8],[2,4],[6,15],[1,5],[2,-1],[3,-1],[2,1],[2,1],[-3,4],[1,3],[2,3],[1,3],[1,2],[2,4],[0,2],[0,2],[-1,3],[0,2],[-1,1],[0,1],[-2,1],[-2,1],[-1,1],[-1,2],[-1,1],[-2,2],[-1,3],[-3,6],[0,3],[-2,15],[-2,9],[-1,1],[-1,1],[-2,1],[0,2],[0,2],[4,7],[3,4],[2,4],[1,3],[3,-3],[3,2],[4,4],[8,4],[5,5],[4,5],[1,4],[1,3],[5,14],[1,6],[2,4],[1,2],[3,0],[0,-2],[-1,-6],[1,0],[3,5],[4,-1],[3,-3],[3,-4],[2,-13],[0,-10],[1,-5],[1,-2],[2,-1],[6,-11],[0,4],[0,5],[0,4],[-3,8],[-2,9],[-2,3],[18,6],[4,4],[-5,-1],[-7,1],[-6,1],[-4,1],[-3,5],[-2,2],[-11,3],[-2,1],[3,3],[8,4],[5,4],[5,2],[2,1],[2,1],[3,0],[5,0],[-6,2],[-3,2],[-3,0],[-4,-4],[-3,1],[-3,0],[-8,-1],[-5,0],[-3,1],[-3,2],[-3,3],[-3,5],[-2,3],[-2,1],[-10,3],[9,6],[4,3],[-2,2],[-9,-1],[-4,1],[-4,3],[0,-1],[-1,-1],[0,-4],[0,-13],[1,0],[5,-1],[2,-1],[1,-2],[-3,0],[-5,0],[-9,-4],[-5,0],[-2,5],[1,3],[21,47],[3,14],[2,3],[4,1],[8,-3],[4,0],[2,1],[2,1],[-2,1],[-1,1],[-1,3],[0,2],[-1,0],[-1,-1],[-1,-2],[-2,-1],[-2,1],[-1,2],[1,3],[2,9],[4,8],[4,14],[6,10],[9,9],[9,3],[-2,-5],[-1,-3],[0,-4],[4,-13],[0,-4],[0,-5],[7,14],[3,1],[2,0],[10,-7],[3,7],[-1,2],[-4,1],[-3,7],[-1,2],[-3,1],[-2,0],[-2,0],[-2,1],[-1,7],[0,10],[5,19],[9,12],[0,2],[-1,4],[1,5],[26,81],[1,5],[-1,12],[1,5],[1,4],[3,7],[1,8],[0,19],[-3,18],[1,7],[5,5],[11,2],[1,-2],[2,2],[4,2],[5,1],[5,0],[5,1],[3,2],[6,7],[7,9],[2,3],[0,3],[4,10],[2,4],[3,3],[3,1],[9,-1],[1,1],[4,3],[1,0],[1,1],[1,1],[1,0],[1,-1],[0,-1],[-1,-1],[1,-2],[3,-1],[8,-4],[3,-3],[0,-1],[-1,-2],[-1,-3],[-1,-1],[-2,-2],[-3,-1],[-2,-1],[-1,-2],[-2,-5],[-1,-2],[-2,-1],[-4,-1],[-2,-1],[-1,-6],[1,-5],[0,-5],[-3,-5],[5,1],[4,4],[2,4],[1,5],[2,3],[6,1],[5,-1],[2,-3],[2,-10],[1,-1],[2,1],[2,-1],[2,-4],[-2,-7],[2,-4],[3,4],[4,3],[6,0],[3,-1],[1,-3],[2,-6],[1,-2],[2,-3],[2,-3],[3,-7],[1,-6],[0,-7],[2,-5],[1,-1],[-1,-2],[-2,-3],[-1,-5],[1,-7],[1,-7],[4,-4],[2,1],[3,-3],[1,-4],[1,-4],[1,-2],[3,-4],[0,-3],[0,-2],[-1,-2],[-3,-2],[-5,-9],[-2,-6],[2,-2],[2,-2],[1,-5],[-1,-10],[1,-2],[3,-4],[0,-3],[2,-28],[-2,-19],[1,-4],[3,-3],[11,-9],[3,0],[8,-7],[3,-2],[7,1],[4,1],[8,4],[6,1],[4,-2],[11,-11],[2,0],[4,0],[5,2],[3,-1],[2,-2],[-2,-3],[-3,0],[-5,-1],[-21,-33],[-1,-1],[-2,-1],[-1,-1],[-1,-4],[1,-1],[1,-6],[0,-3],[-1,-2],[-1,-1],[-1,-2],[1,-1],[1,-1],[1,-1],[-2,-4],[-1,-4],[0,-10],[2,-1],[4,-2],[7,0],[8,1],[2,-1],[5,-3],[1,0],[9,-7],[1,-1],[1,-1],[2,-4],[1,-3],[0,-14],[2,-5],[2,-4],[3,-3],[3,-2],[9,-2],[3,-1],[3,-1],[3,-3],[6,-5],[0,-1],[-5,-7],[-2,-4],[2,-2],[0,-1],[-7,-11],[0,-4],[-3,-12],[0,-13],[-1,-4],[4,6],[2,-1],[3,-2],[3,0],[2,1],[3,3],[2,0],[2,-2],[3,0],[6,0],[3,2],[3,2],[4,2],[-11,-20],[4,-7],[0,-9],[-2,-18],[5,-27],[0,-29],[1,-2],[1,-2],[8,-6],[0,-2],[3,-4],[1,-2],[1,-3],[0,-2],[-3,-14],[0,-4],[4,-1],[-2,-4],[-6,-13],[-2,-7],[-1,-13],[-3,-9],[-1,-4],[1,-3],[4,-8],[1,-5],[1,-2],[7,-10],[1,-2],[0,-6],[0,-3],[1,-2],[1,-2],[2,-2],[13,-11],[2,-2],[2,-13],[-1,-4],[3,-5],[0,-21],[9,-28],[8,-14],[4,-7],[6,-5],[3,-2],[3,-2],[3,-1],[4,-1],[8,-1],[2,-1],[1,-4],[2,3],[3,1],[5,0],[9,6],[8,3],[10,10],[4,3],[3,1],[4,3],[2,4],[2,4],[0,5],[0,6],[1,6],[3,2],[1,-1],[1,-2],[1,-1],[1,1],[1,0],[0,1],[1,1],[2,0],[3,-8],[1,-1],[3,-1],[2,0],[3,0],[2,-2],[30,13],[2,2],[4,10],[1,2],[1,0],[0,2],[0,3],[0,1],[2,0],[3,-2],[3,-1],[2,-2],[1,-2],[1,-1],[2,-2],[9,-13],[-2,-4],[0,-4],[-1,-9],[2,-5],[5,0],[4,2],[3,4],[1,-4],[-1,-5],[-2,-3],[-2,-2],[-1,-3],[1,-12],[1,-3],[1,-2],[6,-4],[1,-2],[3,-6],[1,-2],[5,-1],[9,2],[3,0],[4,-3],[2,-4],[3,-4],[5,-1],[14,-1],[4,-1],[1,-1],[1,-2],[0,-2],[1,-2],[1,-2],[4,-3],[-1,-1],[1,-11],[1,-2],[2,-2],[13,-9],[4,-5],[5,3],[5,-2],[5,-3],[5,-2],[3,-1],[4,-2],[3,0],[3,0],[5,1],[3,0],[-2,-6],[2,-4],[12,-15],[4,0],[4,1],[7,0],[-3,-6],[-16,-23],[-2,-4],[-3,-16],[1,-4],[3,-6],[1,-6],[2,-2],[3,-2],[3,0],[3,1],[2,2],[1,6],[4,-3],[2,-5],[-1,-4],[-9,-3],[-4,-3],[-1,-5],[4,-3],[-2,-2],[-1,-2],[0,-2],[0,-3],[-2,0],[-3,-2],[-1,-1],[-2,-4],[-1,-5],[0,-3],[3,2],[1,0],[3,-9],[1,-4],[-3,-2],[-1,-1],[0,-2],[1,-2],[1,-1],[0,-1],[8,-6],[1,-1],[2,-5],[0,-2],[0,-2],[-3,-5],[0,-1],[1,-1],[9,-18],[2,-3],[0,-3],[-1,-10],[0,-4],[1,-2],[1,-1],[1,-1],[0,-2],[-1,-3],[-3,-4],[-1,-3],[1,-4],[2,-3],[5,-4],[9,-12],[5,-8],[2,-7],[0,-9],[-5,-15],[-1,-7],[1,-1],[4,-2],[1,-2],[2,-5],[0,-3],[-2,-3],[-7,-7],[-3,-7],[0,-16],[-3,-8],[1,-2],[1,-2],[1,-2],[3,-1],[4,1],[3,-2],[2,-4],[1,-5],[1,-2],[8,-8],[3,-7],[4,-5],[1,-1],[0,-3],[3,-3],[2,-4],[11,-9],[2,-1],[5,-2],[2,-2],[1,-2],[1,-4],[1,-3],[2,-2],[5,-2],[2,-1],[4,-11],[3,-2],[4,-4],[0,-2],[0,-3],[-2,0],[-3,-1],[-2,-1],[-1,-3],[2,-2],[3,-2],[2,-4],[0,-1],[0,-4],[1,-1],[2,-1],[2,0],[1,2],[-2,4],[-1,4],[1,4],[1,1],[2,1],[6,6],[2,2],[4,-2],[2,-3],[3,0],[5,4],[1,2],[2,1],[1,1],[3,0],[4,-1],[0,-3],[-1,-2],[0,-1],[-1,0],[-2,-3],[-1,0],[0,-2],[2,0],[0,-2],[-2,-4],[-2,-2],[-1,-1],[-2,-2],[-4,-7],[-1,-3],[-1,-5],[0,-4],[1,-3],[4,-2],[2,-1],[8,-17],[2,-4],[0,-5],[1,-5],[1,-3],[7,-11],[6,-14],[3,-4],[4,-3],[2,-1],[1,-2],[-1,-10],[1,-13],[-2,-2],[3,-5],[6,-8],[6,-6],[2,-3],[1,-4],[-2,-3],[-5,-5],[-2,-3],[-1,-5],[1,-14],[-1,-1],[-3,-2],[-1,-3],[1,-1],[1,-1],[0,-2],[0,-3],[0,-1],[3,-4],[1,-3],[-2,-2],[-1,-8],[-1,-1],[1,-4],[-6,-14],[-11,-19],[-1,-7],[-2,-6],[-1,-3],[1,-3],[0,-3],[1,-3],[1,-3],[-1,-6],[3,-5],[16,-19],[4,-3],[3,-1],[7,0],[2,-1],[2,-2],[1,-3],[1,-7],[5,-15],[-1,-4],[4,1],[5,-1],[4,-2],[1,-1],[3,2],[3,0],[8,-2],[0,-10],[-2,-9],[-2,-8],[-6,-14],[-3,-26],[-1,-1],[0,-2],[-1,-2],[0,-2],[1,-3],[4,-5],[1,-2],[1,-1],[3,-2],[1,-2],[3,-6],[17,-12],[3,-3],[4,-7],[4,-4],[3,-2],[9,-2],[3,-3],[5,-4],[1,-3],[2,0],[2,0],[2,-1],[14,-8],[9,-3],[11,5],[3,-2],[4,-7],[6,-5],[3,-3],[2,-1],[5,-2],[5,-6],[7,-3],[8,2],[3,-1],[4,3],[7,7],[2,4],[1,4],[0,4],[-1,5],[1,0],[1,-4],[4,-4],[1,-4],[1,-1],[2,-2],[0,-2],[-1,-1],[-2,-7],[0,-2],[2,-4],[5,-6],[1,-2],[10,-13],[3,3],[4,0],[12,-3],[5,-2],[2,-1],[2,1],[5,2],[29,0],[6,4],[1,3],[-2,5],[-3,3],[-5,4],[-2,3],[1,2],[5,-2],[4,-6],[10,-25],[13,-15],[2,-3],[1,-6],[1,-6],[2,-5],[4,-5],[-1,-6],[2,-5],[0,-4],[-8,0],[4,-2],[2,-2],[5,-7],[15,-16],[8,-1],[14,-1],[-5,13],[-2,2],[1,2],[-1,15],[15,-5],[5,-5],[3,-20],[3,-6],[5,-5],[7,-5],[5,-2],[4,-1],[10,0],[0,1],[1,2],[0,3],[2,0],[1,0],[2,-1],[1,0],[2,1],[3,2],[3,-2],[6,-7],[2,-2],[2,-2],[14,-2],[13,-4],[5,0],[-2,-5],[2,-4],[6,-6],[-5,-2],[-4,-1],[2,-2],[1,-2],[-1,-2],[-2,-2],[5,-2],[3,-2],[5,-7],[1,-1],[2,-1],[8,-5],[6,-2],[1,-2],[-1,-4],[3,0],[4,0],[4,1],[2,2],[0,3],[-2,0],[-3,0],[-4,2],[2,2],[3,1],[3,0],[2,1],[2,3],[-1,2],[-2,2],[-2,1],[-2,1],[-2,3],[0,4],[2,2],[3,1],[2,-1],[3,-3],[3,-1],[6,0],[1,1],[3,3],[4,2],[1,-1],[1,-12],[1,-7],[3,-6],[6,-1],[-2,-3],[-1,-3],[2,-2],[4,0],[2,2],[0,3],[1,3],[1,3],[2,-2],[1,-2],[0,-2],[-2,-2],[5,2],[1,1],[0,-2],[0,-3],[-2,-2],[-2,-2],[4,-2],[2,-1],[-1,-1],[-1,-2],[0,-2],[0,-2],[9,3],[4,2],[4,-1],[-1,6],[6,-3],[5,-6],[-3,-4],[1,-2],[3,-3],[1,-1],[0,-2],[2,0],[2,0],[1,-1],[2,-5],[0,-3],[-1,-2],[-1,-4],[3,-7],[4,-4],[11,-7],[-5,-1],[2,-4],[4,-4],[2,-5],[-1,1],[-2,1],[-2,-1],[-2,-1],[-1,3],[-3,1],[-2,-1],[-1,-1],[-2,3],[-2,2],[-2,2],[-3,1],[1,2],[0,3],[0,3],[-1,2],[-1,1],[-3,2],[-2,0],[-2,0],[0,-1],[0,-2],[-1,-2],[-1,-2],[-2,-1],[-3,-1],[-4,1],[-1,1],[0,2],[-3,2],[-5,1],[1,-3],[3,-6],[1,-4],[-1,-5],[-4,-4],[-5,-3],[-5,0],[1,-4],[2,-3],[5,-5],[0,-1],[1,-3],[0,-1],[2,0],[3,0],[1,0],[1,-3],[0,-2],[-4,-5],[4,-2],[3,-7],[4,-2],[2,-1],[3,-5],[1,-2],[1,-1],[2,1],[2,0],[2,1],[3,-1],[1,-1],[1,-2],[1,-2],[1,-10],[0,-1],[-1,-1],[-1,-2],[-1,-2],[0,-2],[0,-2],[-1,-1],[-1,-2],[4,1],[3,3],[3,7],[3,-2],[2,-3],[3,-2],[3,-1],[7,2],[3,0],[1,-2],[5,-5],[3,-2],[1,1],[1,1],[1,1],[3,0],[3,0],[3,-2],[1,-4],[-4,1],[-4,1],[-2,-1],[2,-4],[1,-3],[-2,-3],[-1,-3],[4,0],[7,2],[4,0],[1,-3],[2,-2],[9,-1],[2,-2],[1,-4],[2,-3],[3,-2],[2,0],[1,-2],[6,-7],[0,-8],[-7,-12],[0,-9],[6,-12],[2,-2],[1,1],[2,4],[1,1],[2,0],[1,-1],[1,-2],[0,-1],[0,-1],[1,-1],[3,1],[0,-1],[2,-3],[0,-2],[-1,-1],[-1,-2],[2,-5],[4,-8],[-1,-1],[-2,-2],[-2,-1],[-2,0],[2,-3],[7,-1],[3,-2],[-4,-3],[-3,-2],[-4,-3],[-1,-5],[1,-6],[3,0],[9,7],[2,-3],[4,-2],[3,0],[2,0],[-1,-7],[1,-3],[3,-2],[1,-1],[0,-3],[3,-2],[5,2],[1,2],[3,6],[2,2],[2,-1],[1,-2],[1,-6],[-11,-11],[-1,-4],[1,-5],[4,-8],[2,-3],[1,-2],[0,-1],[-2,-3],[-2,0],[-2,-1],[-3,-2],[-1,-4],[0,-4],[2,-5],[3,-4],[2,-2],[1,-1],[1,-2],[1,-3],[-1,-2],[-1,-5],[0,-2],[1,-5],[2,-5],[8,-13],[1,-4],[1,-10],[1,-4],[8,-14],[-3,-3],[-1,-2],[0,-1],[4,-2],[2,-4],[1,-1],[5,-6],[-1,-2],[-3,-5],[-1,-1],[1,-1],[10,-4],[2,-1],[1,-1],[2,-3],[2,-4],[2,-2],[4,2],[1,-4],[1,-5],[-1,-8],[-1,-6],[-2,-3],[-3,-3],[-2,-4],[6,1],[8,4],[8,6],[4,4],[4,8],[2,2],[4,-2],[6,-7],[3,-4],[1,-4],[1,-2],[18,-15],[1,-2],[2,-7],[5,-7],[5,-6],[5,-2],[-6,20],[-14,33],[-4,5],[-2,5],[0,4],[5,-1],[-2,3],[-2,4],[-2,3],[2,4],[2,3],[4,10],[2,7],[2,3],[2,3],[3,1],[3,0],[8,3],[1,-1],[4,-2],[1,-1],[1,-2],[4,-10],[1,-4],[2,-2],[3,-2],[1,-1],[2,-1],[2,-1],[0,-3],[1,-2],[0,-2],[0,-1],[1,-2],[5,-3],[1,-3],[-3,-2],[4,-7],[4,-3],[18,-5],[3,-2],[6,-4],[4,-2],[6,-3],[4,-2],[2,-1],[4,-5],[3,-2],[3,-2],[12,-3],[4,-3],[16,-14],[2,2],[-4,3],[-3,7],[-2,6],[1,4],[0,1],[-7,6],[-3,12],[2,13],[5,10],[2,-2],[6,-3],[3,2],[4,-2],[2,-3],[-3,-2],[1,-2],[0,-1],[-1,-2],[-2,-1],[3,0],[2,-2],[2,-1],[2,-3],[2,2],[-2,3],[0,3],[0,4],[3,2],[1,-5],[1,-5],[2,-5],[2,-3],[2,-1],[6,-2],[2,0],[1,-1],[1,-3],[0,-2],[-2,-2],[-6,-7],[-4,-2],[-1,6],[-2,1],[-3,-2],[-1,-3],[4,-3],[-3,-6],[6,1],[3,-1],[0,-4],[0,-6],[1,-3],[2,-1],[2,1],[3,2],[0,3],[1,3],[0,6],[1,5],[2,1],[2,-3],[1,-6],[-2,-12],[1,-6],[5,0],[2,-4],[2,-6],[1,-3],[-1,-5],[-3,-8],[-1,-9],[-2,-8],[-1,-11],[-1,-1],[0,-2],[0,-2],[0,-1],[-1,0],[-4,0],[-5,-1],[-1,0],[1,-3],[2,-1],[4,-3],[1,-1],[0,-2],[-1,-2],[-1,-2],[1,-2],[2,-2],[0,-1],[0,-5],[-4,-18],[1,-8],[8,-5],[-2,-4],[1,-3],[1,-3],[3,-3],[0,1],[1,1],[0,1],[4,-5],[-1,-6],[-5,-5],[-5,-2],[6,-23],[6,-5],[7,-9],[2,-3],[-3,-2],[-4,-1],[-8,0],[0,-1],[5,-1],[4,-1],[3,-3],[1,-5],[2,-4],[5,2],[5,3],[1,2],[5,-1],[6,-4],[5,-1],[4,-3],[3,-7],[6,-2],[7,-7],[3,-2],[2,-3],[4,-7],[2,-4],[0,-5],[1,-3],[1,-1],[3,-5],[3,-3],[5,-2],[9,-2],[1,0],[2,0],[2,0],[1,-1],[0,-2],[1,-2],[1,-1],[1,-2],[0,1],[2,0],[2,-1],[2,0],[2,-2],[2,-4],[1,-2],[12,-12],[5,-5],[2,-6],[1,-1],[2,-1],[1,1],[1,2],[2,2],[3,0],[4,-2],[3,-2],[4,-3],[1,-1],[2,-1],[1,-2],[-1,-1],[-1,-1],[-1,-1],[0,-1],[0,-4],[1,-2],[2,-2],[4,-1],[0,1],[1,0],[0,1],[0,1],[0,1],[2,4],[0,4],[1,-1],[1,-2],[1,0],[6,1],[5,-3],[4,-5],[6,-2],[-2,7],[-2,4],[-2,4],[-3,1],[-6,4],[-2,2],[2,3],[4,1],[4,0],[4,-1],[3,-2],[2,-2],[2,-3],[5,0],[0,-2],[-5,-4],[2,-4],[4,-1],[0,3],[2,1],[7,5],[0,-7],[1,-7],[3,-7],[3,-5],[5,-5],[3,-2],[4,0],[2,0],[1,2],[1,1],[0,1],[1,1],[1,1],[1,-2],[0,-5],[1,-2],[2,-2],[4,-3],[1,-2],[1,-4],[13,-38],[12,-23],[6,-4],[8,-13],[6,-6],[34,-23],[4,-1],[4,0],[13,-4],[8,-5],[6,-8],[5,-9],[2,-10],[0,-19],[1,-4],[16,-23],[1,-1],[2,-3],[8,-5],[1,-4],[-1,-2],[-1,-1],[-5,0],[-1,0],[-3,1],[-1,1],[-2,-1],[-1,-1],[0,-1],[1,0],[6,-1],[5,-2],[4,-2],[2,-3],[3,-3],[3,-3],[4,-2],[11,-1],[6,-2],[5,-2],[4,-2],[0,3],[0,3],[1,2],[2,1],[1,-1],[2,-5],[2,-1],[11,-2],[2,-1],[1,-2],[0,-6],[3,-20],[-1,-2],[-8,-4],[-2,-2],[-1,-3],[-1,-2],[4,1],[12,7],[4,0],[1,-3],[-2,-2],[-3,-2],[-1,-1],[1,-2],[3,-1],[2,-2],[-3,-3],[-8,-7],[-3,-4],[-1,-5],[2,-13],[0,-6],[-5,-1],[2,-3],[3,-2],[7,-4],[-3,-1],[-2,0],[2,-4],[4,-3],[4,-2],[4,0],[9,-14],[1,-4],[1,-9],[1,-4],[-1,-1],[-2,-3],[0,-1],[-1,-3],[1,-6],[1,0],[6,11],[1,3],[0,7],[1,4],[2,3],[-2,4],[-1,1],[4,-2],[1,-2],[1,-7],[5,-11],[2,-4],[6,-2],[7,0],[6,2],[-2,-3],[-4,-6],[-1,-5],[-4,-8],[-2,-3],[-1,-3],[-2,-9],[-2,-2],[-3,-11],[-1,-4],[-6,-22],[-1,-8],[0,-4],[1,-4],[2,-3],[3,-1],[3,-1],[3,0],[2,-4],[-3,-6],[-2,-8],[-1,-41],[1,-4],[0,-2],[1,-1],[7,-2],[-2,-10],[0,-4],[2,-7],[1,-3],[1,-1],[-2,-1],[-1,-4],[-1,-5],[0,-3],[0,1],[1,-8],[1,-8],[12,-26],[1,-7],[-4,-5],[-9,4],[-8,-2],[-7,-4],[-6,-7],[-2,-2],[-2,-5],[0,-4],[5,-2],[4,-1],[3,1],[2,0],[2,2],[1,-1],[0,-10],[-2,-3],[-4,-1],[-3,-3],[-3,-5],[1,-3],[3,-3],[2,-2],[5,-2],[9,-2],[3,-3],[2,-4],[2,-10],[2,-5],[3,-3],[3,-1],[4,0],[2,-1],[2,-2],[2,-3],[3,-6],[0,-2],[0,-2],[1,-1],[4,-5],[1,-2],[0,-14],[1,-3],[2,-3],[5,-4],[1,-3],[1,-5],[1,-2],[1,-1],[2,0],[6,-6],[2,-4],[-1,-3],[-1,-3],[2,-1],[3,1],[3,4],[2,0],[-1,-4],[-2,-11],[-1,-4],[1,-12],[-3,5],[-2,-2],[-2,-3],[0,-5],[0,-3],[3,-1],[1,1],[2,3],[2,2],[1,-7],[1,-21],[3,-4],[4,-4],[5,-8],[1,0]],[[6438,9689],[-1,-1],[-1,2],[-2,3],[-1,1],[0,1],[2,1],[1,-1],[1,0],[1,0],[2,-1],[1,0],[-1,-1],[0,-2],[-1,-1],[-1,-1]],[[6357,9675],[-1,-1],[-1,0],[-2,1],[-3,-1],[-5,-1],[-2,-1],[-3,-1],[-2,-3],[-1,-3],[-1,-2],[-7,3],[-2,1],[-2,5],[-3,4],[-2,6],[1,6],[1,2],[0,1],[1,0],[4,1],[1,0],[1,1],[1,2],[4,2],[1,0],[0,1],[2,4],[5,-1],[3,-5],[6,-10],[5,-6],[1,-2],[0,-3]],[[6361,9693],[-6,-2],[-4,4],[-2,5],[3,5],[7,1],[6,-3],[1,-5],[-5,-5]],[[6343,9708],[-4,-2],[-1,0],[-1,1],[-2,1],[0,2],[1,1],[3,2],[3,3],[2,1],[1,-1],[0,-2],[-2,-6]],[[6365,9714],[-3,-2],[-1,1],[-2,1],[-1,3],[2,0],[3,2],[0,1],[1,0],[1,-2],[0,-4]],[[6364,9785],[-6,-10],[-3,1],[-2,2],[-4,1],[-3,1],[-2,-1],[-3,2],[-2,3],[-1,3],[-1,3],[3,1],[1,1],[1,1],[0,4],[0,1],[4,3],[5,1],[8,0],[5,-3],[4,-4],[1,-5],[-1,-2],[-4,-3]],[[6332,9792],[-3,-1],[-2,0],[-1,3],[-3,3],[-4,3],[-2,2],[0,4],[9,15],[4,-1],[2,-1],[5,-5],[1,-2],[0,-2],[-1,-10],[-2,-2],[-1,-1],[-2,-5]],[[6480,9828],[0,-1],[1,0],[1,0],[1,-3],[0,-2],[-2,-2],[-4,4],[-1,4],[4,0]],[[6336,9844],[1,0],[1,0],[1,-1],[0,-1],[-1,0],[-3,-2],[-1,-3],[-2,4],[-1,1],[1,1],[2,1],[2,0]],[[6741,9852],[-3,-4],[-1,2],[1,1],[3,1]],[[6497,9862],[-3,-1],[-3,0],[-1,1],[0,2],[4,2],[3,-1],[1,-1],[1,0],[1,-1],[-3,-1]],[[6436,9882],[-5,-1],[0,2],[3,1],[1,0],[1,-2]],[[6678,9920],[-1,-1],[-1,4],[3,1],[1,2],[2,-3],[-1,-1],[-1,-2],[-2,0]],[[6363,9926],[-2,-1],[-4,1],[-4,2],[-1,2],[6,0],[5,-2],[0,-2]],[[6463,9970],[2,-3],[-3,-3],[-3,-2],[-3,-2],[-2,-2],[-4,0],[-15,0],[-3,0],[-4,2],[-2,4],[2,4],[6,2],[6,0],[6,-2],[5,1],[8,2],[4,-1]],[[6352,9988],[-8,0],[-9,1],[-7,3],[3,5],[9,2],[16,-5],[1,-3],[-1,-2],[-4,-1]],[[9986,5104],[5,0],[3,-3],[2,-4],[3,-4],[-2,-2],[-2,-2],[-2,-1],[-3,1],[3,3],[1,4],[-2,4],[-3,3],[-2,-2],[-1,1],[0,2]],[[7457,2498],[0,-2],[0,-1],[-1,-3],[-1,-2],[-2,-3],[-1,-1],[-1,-3],[-2,-6],[-3,-5],[-2,-2],[-4,1],[-5,3],[-1,0],[-2,0],[-1,0],[-1,1],[-1,1],[1,2],[0,1],[1,-1],[-2,5],[-1,1],[-3,0],[1,1],[2,2],[2,0],[-5,3],[-3,-2],[-1,-10],[-3,-4],[-4,-3],[-4,1],[-3,3],[-2,5],[-3,3],[-4,2],[-1,2],[1,4],[4,0],[11,-9],[2,-1],[2,1],[1,4],[-1,8],[-1,4],[-2,3],[2,2],[1,1],[2,0],[2,-1],[4,-4],[2,-2],[2,3],[1,2],[0,1],[-1,3],[-1,3],[1,2],[4,3],[7,7],[4,3],[2,-1],[5,-16],[0,-1],[5,-5],[1,-3]],[[7473,2529],[-3,-2],[-5,1],[-2,0],[-3,-1],[-2,-1],[-2,-1],[-1,2],[-2,5],[2,2],[4,1],[3,4],[-4,2],[-11,2],[-5,2],[-1,3],[3,2],[11,1],[-1,1],[-3,2],[-2,1],[1,4],[3,5],[3,1],[3,-6],[5,-3],[1,-3],[0,-3],[1,-2],[1,-3],[1,-2],[1,-3],[2,-5],[2,-6]],[[7633,2659],[-6,-4],[-10,0],[-7,0],[3,-7],[5,-4],[-1,-1],[-13,-2],[-3,-1],[-2,-4],[-2,0],[0,5],[3,2],[2,4],[2,7],[-5,1],[-2,3],[1,5],[2,4],[3,2],[6,2],[3,3],[3,-1],[5,0],[4,-1],[1,-3],[1,-4],[1,-3],[2,-2],[4,-1]],[[7667,2723],[-1,0],[-2,1],[-3,1],[-3,2],[-3,2],[-6,1],[-2,1],[-2,5],[3,1],[4,-1],[7,-2],[4,-2],[2,-2],[1,-2],[2,-4],[-1,-1]],[[6895,3081],[1,0],[1,1],[2,1],[1,0],[8,-1],[14,-5],[8,-1],[8,1],[4,0],[3,-2],[3,-3],[3,-1],[7,-3],[3,-5],[2,0],[3,-1],[5,-2],[4,1],[2,2],[-3,4],[20,-1],[5,1],[3,3],[0,5],[-1,5],[-2,3],[4,0],[6,-4],[3,-4],[-7,-3],[-1,-1],[-1,-3],[1,-2],[1,-2],[9,-5],[3,-2],[2,-2],[3,0],[7,0],[4,-1],[8,-4],[6,1],[12,4],[2,-9],[8,-5],[11,-3],[19,-2],[4,-2],[1,-4],[2,-3],[4,-4],[6,-6],[4,-2],[5,-1],[5,-1],[11,0],[2,-1],[2,-1],[0,-3],[2,0],[5,0],[5,-1],[8,-5],[6,-2],[4,-2],[2,-1],[2,-1],[8,-1],[21,-8],[30,-3],[15,1],[15,3],[12,4],[2,-1],[0,-5],[1,-2],[2,-2],[3,0],[4,1],[-4,3],[2,3],[7,4],[2,2],[3,4],[1,2],[3,1],[5,0],[3,0],[2,2],[4,2],[3,1],[2,0],[2,-1],[3,-1],[2,-1],[2,-3],[3,-5],[0,-4],[-2,-2],[2,-3],[3,-1],[4,-1],[4,-1],[3,2],[1,1],[3,0],[3,0],[2,-1],[2,-1],[2,0],[3,1],[-3,2],[-3,2],[-3,2],[-10,2],[-5,2],[-3,3],[-1,6],[4,7],[9,3],[11,2],[9,4],[2,1],[1,1],[2,1],[3,1],[1,1],[1,0],[1,0],[2,0],[0,-2],[1,-1],[29,-3],[9,3],[16,11],[2,-3],[10,3],[3,-2],[0,-3],[1,-2],[1,0],[6,-1],[1,-2],[1,-2],[1,-2],[8,-1],[9,5],[8,8],[13,17],[1,4],[2,2],[12,4],[4,0],[3,-2],[4,-4],[3,-3],[8,3],[5,-3],[5,-4],[5,-2],[6,2],[8,3],[6,4],[3,6],[1,2],[3,5],[1,7],[2,3],[2,1],[3,2],[2,-1],[1,0],[5,-1],[2,0],[1,-1],[2,-4],[2,0],[4,1],[2,-1],[3,-2],[4,-4],[4,-6],[3,-3],[4,-1],[8,1],[2,-1],[17,-18],[6,-8],[2,-5],[1,-4],[-1,-2],[-4,-1],[-3,-2],[-3,-3],[-1,-2],[2,0],[2,-1],[2,-2],[1,-1],[-4,-9],[0,-2],[-3,-2],[-1,-6],[0,-7],[1,-4],[1,-3],[1,-2],[7,-7],[1,-3],[-1,-3],[-10,-6],[-3,-4],[0,-4],[17,12],[4,0],[-5,-7],[-11,-28],[0,-3],[1,-4],[0,-5],[0,-3],[-1,-2],[0,-2],[6,-8],[1,-3],[1,-4],[-1,-5],[-2,-5],[-3,-4],[0,-4],[4,-14],[-3,-3],[-4,-3],[-3,-5],[2,-5],[1,-1],[2,-6],[0,-2],[1,-2],[5,-4],[1,-2],[0,-1],[1,-1],[1,-1],[-3,-7],[-2,-12],[-1,-11],[14,-13],[0,-1],[-1,-1],[-2,-2],[-6,-6],[-1,-3],[10,-3],[0,-5],[-2,-8],[-1,-1],[-4,-3],[-1,-1],[-1,-3],[-2,1],[-2,3],[-1,1],[-7,1],[-2,2],[1,2],[4,2],[1,1],[1,1],[2,2],[1,2],[1,3],[-1,1],[-2,2],[-2,2],[-2,1],[6,3],[3,2],[1,3],[-6,0],[-4,2],[-7,6],[-3,2],[-14,3],[6,4],[3,2],[3,1],[3,1],[2,4],[0,3],[-7,3],[-1,4],[-1,3],[-1,1],[-3,-1],[0,-3],[3,-4],[0,-5],[-2,0],[-2,2],[-3,1],[-4,-2],[0,-3],[2,-4],[0,-4],[-1,0],[-2,-1],[-2,-1],[0,-1],[2,-2],[1,-1],[2,-1],[3,-1],[11,-2],[-22,0],[-5,-2],[-3,-3],[0,-5],[0,-10],[-1,-3],[-8,-6],[-1,-2],[0,-3],[-1,-2],[-3,0],[0,-2],[-1,-3],[-6,-9],[-4,-4],[2,1],[4,4],[3,1],[3,-1],[2,-4],[0,-3],[-5,-4],[-1,-7],[2,-10],[0,-10],[-1,-6],[-3,-2],[-3,-1],[-3,-4],[-3,-1],[-2,1],[-3,5],[-3,2],[0,-3],[-1,-2],[-2,-1],[-3,0],[11,-10],[1,-5],[0,-4],[0,-1],[1,-1],[1,-1],[1,-1],[0,-1],[0,-6],[0,-3],[-1,-2],[0,-4],[-2,-3],[-5,-3],[-3,-1],[-3,-2],[-2,-4],[0,-5],[1,-4],[-1,-2],[-1,0],[-2,1],[-4,-6],[-1,-3],[0,-3],[3,-2],[4,-1],[5,0],[3,1],[0,2],[-7,2],[2,5],[6,2],[4,-4],[0,-3],[2,-1],[2,1],[2,1],[2,0],[1,-1],[1,-1],[0,-2],[1,-2],[3,-1],[1,-2],[-1,-1],[-1,-2],[-1,-1],[0,-2],[0,-1],[2,0],[1,-1],[1,-1],[0,-5],[-2,-1],[-3,-1],[-3,-2],[-2,-5],[0,-11],[-3,-2],[5,-6],[1,-2],[0,-2],[-1,-2],[-2,-3],[5,-1],[2,-1],[1,-2],[-1,-4],[-1,-1],[-1,-1],[-2,-1],[0,-3],[2,-2],[2,-2],[0,-2],[-4,1],[-3,1],[-13,9],[-2,3],[-1,3],[-1,3],[-1,2],[-3,-2],[-2,-4],[-1,-3],[1,-4],[2,-3],[-7,0],[-3,-2],[-3,-4],[-3,-3],[-5,6],[-15,12],[-1,6],[2,1],[6,3],[3,2],[-18,6],[-4,2],[-2,2],[-2,4],[-2,5],[1,3],[2,1],[7,3],[3,1],[1,0],[1,2],[-1,1],[0,1],[0,1],[0,1],[-1,2],[0,2],[3,1],[5,-1],[2,0],[1,-2],[0,-6],[0,-3],[-3,-3],[10,-8],[5,-2],[7,-1],[1,0],[3,1],[1,1],[4,0],[4,1],[2,1],[5,4],[-7,0],[-4,2],[-3,4],[-2,6],[2,0],[1,0],[2,1],[0,2],[-5,1],[-1,3],[2,3],[0,3],[-3,2],[-13,-2],[-2,1],[-4,2],[-2,0],[-2,0],[-7,-1],[-2,1],[-2,1],[-1,2],[-2,2],[-2,0],[-4,1],[-1,0],[-1,2],[0,2],[-1,2],[-2,2],[-2,1],[-2,0],[-11,-3],[-4,-2],[-3,-2],[0,-6],[4,-8],[8,-13],[-4,-6],[-2,-3],[-4,-2],[-13,-3],[-3,-1],[-3,1],[-2,3],[-3,3],[0,3],[3,3],[3,-2],[3,-4],[2,-1],[4,1],[2,4],[1,3],[-1,2],[-3,2],[0,4],[2,8],[-4,-1],[-4,-3],[-4,0],[-1,3],[-1,5],[-4,3],[-4,1],[-4,2],[-12,16],[-1,2],[-2,0],[-3,-1],[-3,-1],[2,-2],[3,-2],[1,-1],[4,-4],[3,-4],[4,-7],[5,-7],[0,-3],[-4,-7],[-2,-5],[-1,-4],[1,-10],[-2,-1],[-4,3],[-7,5],[-4,-3],[2,-4],[6,-5],[2,-4],[-1,-2],[-4,-1],[-4,-3],[-2,-4],[-1,-3],[1,-4],[2,-8],[0,-4],[0,-8],[-2,-3],[-4,-3],[-5,-1],[-3,1],[-2,1],[-4,1],[-2,2],[-1,1],[1,2],[0,2],[-3,0],[-9,0],[-2,2],[2,4],[4,3],[0,2],[-1,2],[-2,6],[-2,-5],[-4,-3],[-4,-3],[-2,1],[-5,3],[-1,1],[0,9],[-1,6],[-3,1],[-4,-3],[-3,-2],[-1,-4],[-1,-6],[1,-5],[3,-2],[2,-1],[16,-9],[4,-3],[3,-3],[1,-4],[-1,-2],[-3,-2],[-2,-1],[-2,-1],[-2,0],[-2,1],[0,1],[-2,1],[-4,0],[-5,-1],[-4,-2],[-3,-3],[13,1],[3,-1],[4,-2],[0,-2],[-5,-4],[-2,-2],[-4,-6],[-1,-2],[-4,-2],[-4,0],[-9,0],[5,-3],[12,-2],[4,-5],[-12,1],[-4,-1],[-2,-4],[1,-2],[2,-1],[1,-2],[-1,-3],[-2,-1],[-3,-1],[-3,1],[-2,1],[-2,-6],[3,-2],[4,-1],[4,-2],[0,-4],[-4,-3],[-15,-6],[-2,0],[-3,0],[-1,1],[1,1],[-2,2],[-5,3],[-4,0],[-5,-1],[-11,-4],[-2,2],[-1,3],[-4,5],[-15,6],[-1,1],[-2,4],[-2,9],[-3,4],[-3,2],[-2,-3],[1,-5],[1,-5],[-3,1],[-1,1],[-5,-4],[-6,0],[-24,2],[-4,1],[-4,4],[-4,-4],[-3,-2],[-3,0],[-3,1],[-1,2],[-1,3],[-1,3],[-2,1],[-4,0],[-3,0],[-3,-1],[-1,-3],[0,-3],[-1,-3],[-2,-2],[-2,4],[-2,2],[-2,2],[-3,0],[-7,-2],[-2,-1],[-1,-1],[1,-4],[0,-1],[-2,-1],[-1,1],[-2,1],[-1,0],[-12,-3],[1,16],[-1,6],[-5,8],[-13,7],[-2,2],[2,3],[5,-1],[5,-3],[3,0],[-1,2],[-5,5],[4,1],[20,-2],[6,-2],[4,-4],[2,-4],[5,-4],[1,3],[-2,4],[1,2],[1,0],[1,-1],[2,0],[-1,3],[1,1],[2,-1],[1,0],[2,-2],[4,-3],[1,-1],[2,2],[0,6],[-1,5],[-1,3],[-1,1],[-6,4],[-4,3],[-2,2],[-2,-1],[-6,-10],[-4,-2],[-6,3],[0,2],[-1,5],[0,1],[-3,1],[-2,-1],[-1,-2],[0,-2],[-2,-5],[-4,0],[-4,3],[-4,3],[-3,3],[-1,4],[-1,4],[0,5],[-1,1],[-5,2],[-4,4],[-1,-1],[0,-5],[1,-4],[-1,-2],[-2,0],[-2,0],[-2,-1],[-2,0],[-1,-1],[-1,-3],[3,-1],[8,1],[2,-1],[0,-3],[-3,-2],[-4,-2],[-8,1],[-3,1],[-3,1],[-5,11],[-1,1],[1,6],[-1,1],[-6,4],[-3,2],[-1,1],[0,1],[-1,3],[0,1],[-1,1],[-3,1],[-1,3],[-1,3],[1,4],[-2,-1],[-2,-1],[-3,0],[-2,0],[-3,2],[-1,2],[1,4],[1,1],[2,2],[0,2],[-2,1],[-3,0],[-2,1],[-5,3],[-8,12],[-3,2],[-13,0],[-2,1],[-9,9],[-5,7],[-4,8],[-4,12],[-3,3],[-1,2],[-1,1],[-3,1],[-2,1],[0,1],[1,1],[0,1],[3,4],[1,2],[-2,1],[-2,2],[-4,11],[0,1],[-5,0],[-1,0],[-1,3],[-1,3],[-2,2],[-2,1],[-6,1],[-1,2],[8,8],[-6,4],[-5,8],[-3,8],[2,8],[-6,13],[-2,7],[-1,7],[0,13],[-1,3],[-2,5],[0,3],[3,-1],[3,-4],[3,-3],[1,-3],[1,-4],[3,-1],[8,-2],[3,-1],[1,-1],[2,-2],[1,-2],[1,-2],[1,-2],[6,-1],[14,-9],[2,-2],[1,-3],[1,-8],[2,-8],[2,-8],[2,-2],[2,0],[1,5],[0,16],[5,-3],[3,1],[1,7],[2,4],[4,5],[1,2],[-3,0],[-2,-1],[-1,-1],[0,-1],[-1,-1],[-1,0],[-1,1],[0,1],[0,1],[-1,2],[0,1],[0,2],[-2,1],[-2,0],[-1,-1],[0,-2],[-1,-1],[-5,2],[-12,13],[-4,4],[-3,2],[-2,1],[-1,6],[-3,6],[-1,4],[1,4],[-3,1],[-2,0],[-4,-3],[-1,-3],[-1,0],[-3,-2],[-1,-1],[0,-2],[1,-3],[0,-2],[-2,-2],[-2,1],[-7,5],[8,16],[-3,18],[-10,17],[-11,11],[-18,13],[-2,0],[-1,1],[-1,6],[-1,2],[-2,0],[-2,2],[-9,13],[-4,3],[-1,2],[-2,2],[-2,1],[-3,0],[-2,0],[-1,2],[-1,3],[-1,2],[1,6],[-11,23],[-12,15],[-3,7],[-2,1],[-2,1],[-3,2],[-3,3],[1,1],[0,1],[0,1],[6,2],[0,6],[-3,6],[-15,21],[-4,4],[2,5],[0,7],[-1,7],[-4,4],[2,8],[-4,7],[-11,12],[3,1],[2,1],[2,3],[0,3],[-4,5],[-1,2],[2,1],[3,0],[4,5],[2,1],[4,0],[2,2],[2,3],[1,7],[0,7],[-4,23],[0,5],[2,5],[5,4],[1,-4],[2,-3],[4,-5],[1,-2],[1,-3],[1,-2]],[[6955,3091],[3,-3],[1,-3],[-6,0],[-4,3],[-8,-1],[-12,-5],[-1,0],[-1,0],[-2,0],[-2,-1],[-2,0],[-1,1],[-2,1],[-1,10],[0,2],[10,9],[3,2],[2,-3],[1,-3],[4,-2],[3,0],[4,-3],[4,-1],[4,-1],[3,-2]],[[7639,3113],[-2,-3],[-6,2],[-1,3],[-4,1],[-4,1],[-1,0],[-1,1],[-2,3],[0,2],[-1,1],[1,0],[1,2],[4,2],[9,1],[3,2],[14,2],[-1,-2],[-2,-2],[-1,-2],[-1,-2],[0,-3],[0,-2],[-3,0],[-1,-3],[-1,-4]],[[6900,3147],[0,-17],[-1,-1],[-5,-3],[0,-14],[-5,-1],[-2,3],[0,2],[-1,12],[0,2],[-4,2],[0,1],[2,3],[3,0],[3,0],[4,2],[1,2],[2,11],[0,1],[1,-1],[2,-3],[0,-1]],[[6925,3139],[-1,-1],[-6,0],[-3,3],[-3,3],[-3,3],[1,0],[5,1],[1,0],[2,2],[1,2],[1,1],[-2,1],[0,1],[1,1],[2,1],[2,0],[5,0],[2,0],[2,-1],[5,-3],[0,-2],[-2,-2],[-1,-4],[1,-3],[-1,-1],[-5,0],[-2,-1],[-2,-1]],[[7681,3161],[5,-1],[2,-1],[8,-9],[3,-3],[-1,-2],[-2,-1],[-1,1],[-2,2],[0,-1],[-2,-4],[-4,-1],[-1,0],[-2,-3],[-1,-2],[0,-3],[-4,2],[-4,-1],[-4,-2],[-3,-2],[0,8],[-3,7],[-6,0],[-14,-6],[-2,3],[-1,1],[-2,1],[-3,0],[-1,-1],[-2,-2],[-1,0],[-2,0],[-2,1],[-2,0],[-15,-1],[-5,1],[-2,1],[-2,3],[-1,1],[-5,0],[-2,0],[-1,2],[1,6],[2,3],[14,6],[4,1],[9,0],[5,-1],[3,0],[5,-4],[2,2],[1,4],[9,1],[6,1],[3,2],[1,1],[5,2],[1,1],[3,0],[1,-1],[10,-10],[2,-2]],[[7563,3177],[2,-2],[4,0],[5,1],[0,-3],[-3,-3],[-6,0],[-2,2],[-4,2],[4,3]],[[7543,3220],[-5,-2],[-3,0],[0,3],[4,3],[2,9],[5,3],[2,-3],[-2,-4],[-2,-4],[-1,-5]],[[7584,3304],[41,-41],[2,-3],[4,-5],[9,-4],[19,-2],[-1,-5],[0,-17],[-2,-4],[-9,-6],[-4,-4],[5,-1],[4,1],[5,3],[2,3],[2,-3],[3,-5],[3,-9],[-1,-3],[-2,0],[-6,5],[-1,-5],[3,-2],[5,-2],[0,-3],[-4,-3],[-4,1],[-4,3],[-5,2],[-5,1],[-2,0],[-3,-1],[-1,-2],[-1,-6],[-1,-1],[-4,-1],[-5,-2],[-5,-2],[-10,4],[-6,3],[-2,4],[4,4],[-6,6],[-3,3],[0,3],[0,3],[-1,4],[-2,3],[-2,3],[-5,0],[-2,0],[-2,1],[0,5],[-2,4],[-4,2],[-5,1],[-3,0],[0,2],[4,7],[1,3],[-1,3],[-3,7],[-1,3],[-1,5],[-4,0],[-8,-4],[-4,0],[-11,7],[4,3],[4,4],[4,2],[9,3],[2,2],[-2,4],[2,1],[4,2],[-3,4],[-1,1],[-1,2],[1,2],[3,0],[2,-2],[2,-1],[3,2],[9,8]],[[6744,3230],[-1,-2],[-2,-2],[-1,-2],[-3,0],[-4,-1],[-21,-10],[-4,0],[-4,4],[-1,4],[-2,9],[3,-1],[1,4],[0,9],[-1,6],[-3,2],[-4,2],[-3,3],[-1,4],[2,12],[1,2],[3,2],[1,5],[0,10],[-1,1],[-2,2],[0,1],[0,1],[2,3],[1,1],[-2,5],[1,3],[3,1],[4,1],[5,2],[4,3],[2,3],[0,4],[-2,6],[-1,4],[3,2],[2,1],[4,1],[2,0],[2,-1],[7,-5],[9,-4],[4,-2],[2,-5],[2,-2],[1,-2],[1,-2],[-2,-10],[1,-5],[3,-9],[1,-5],[-1,-5],[-4,-9],[0,-5],[2,-2],[2,-1],[2,0],[2,-1],[1,-3],[0,-2],[-1,-2],[0,-8],[-1,-2],[-1,-1],[-2,-1],[-1,-3],[0,-2],[-1,-2],[-2,-1],[-5,-2],[-2,-1]],[[7455,3354],[-2,-3],[-1,1],[-2,0],[-2,-3],[-1,1],[0,1],[-1,2],[0,1],[-2,1],[0,1],[1,0],[1,0],[0,2],[2,2],[1,0],[1,1],[1,0],[1,0],[4,-3],[0,-1],[-1,-1],[0,-1],[0,-1]]],"transform":{"scale":[0.004619163088108814,0.004551480538653874],"translate":[112.91944420700005,-54.75042083099996]}};
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
