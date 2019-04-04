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
  Datamap.prototype.chlTopo = '__CHL__';
  Datamap.prototype.chnTopo = '__CHN__';
  Datamap.prototype.civTopo = {"type":"Topology","objects":{"civ":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Savanes"},"id":"CI.","arcs":[[0,1,2,3,4]]},{"type":"Polygon","properties":{"name":"Denguélé"},"id":"CI.DE","arcs":[[-4,5,6,7]]},{"type":"Polygon","properties":{"name":"Bafing"},"id":"CI.BF","arcs":[[8,9,10,-7]]},{"type":"Polygon","properties":{"name":"Dix-Huit Montagnes"},"id":"CI.DH.BA","arcs":[[11,12,13,14,-10]]},{"type":"Polygon","properties":{"name":"Worodougou"},"id":"CI.WR","arcs":[[15,16,17,-12,-9,-6,-3]]},{"type":"Polygon","properties":{"name":"Marahoué"},"id":"CI.MR.ZU","arcs":[[18,19,20,-17,21]]},{"type":"Polygon","properties":{"name":"Fromager"},"id":"CI.FR","arcs":[[22,23,24,25,26,-20]]},{"type":"Polygon","properties":{"name":"Haut-Sassandra"},"id":"CI.","arcs":[[-21,-27,27,28,-13,-18]]},{"type":"Polygon","properties":{"name":"Sud-Bandama"},"id":"CI.SB.LA","arcs":[[29,30,31,32,33,-25]]},{"type":"Polygon","properties":{"name":"Bas-Sassandra"},"id":"CI.BS.SO","arcs":[[-26,-34,34,35,-28]]},{"type":"Polygon","properties":{"name":"Zanzan"},"id":"CI.ZA","arcs":[[36,37,38,-1,39]]},{"type":"Polygon","properties":{"name":"Vallée du Bandama"},"id":"CI.VB","arcs":[[-39,40,41,-22,-16,-2]]},{"type":"Polygon","properties":{"name":"Agnéby"},"id":"CI.AG.AV","arcs":[[42,43,44]]},{"type":"Polygon","properties":{"name":"N'zi-Comoé"},"id":"CI.NC.BG","arcs":[[45,-44,46,47,-41,-38]]},{"type":"MultiPolygon","properties":{"name":"Lagunes"},"id":"CI.LG.AB","arcs":[[[-32,48]],[[-47,-43,49,50,51,-30,-24,52]]]},{"type":"Polygon","properties":{"name":"Moyen-Cavally"},"id":"CI.","arcs":[[-29,-36,53,-14]]},{"type":"Polygon","properties":{"name":"Moyen-Comoe"},"id":"CI.","arcs":[[54,55,-50,-45,-46,-37]]},{"type":"Polygon","properties":{"name":"Lacs"},"id":"CI.LC.TM","arcs":[[-48,-53,-23,-19,-42]]},{"type":"MultiPolygon","properties":{"name":"Sud-Comoé"},"id":"CI.SC","arcs":[[[56]],[[-51,-56,57]]]}]}},"arcs":[[[7028,8248],[20,-8],[73,-92],[12,-9],[13,-7],[10,-9],[4,-17],[0,-17],[1,-13],[6,-11],[10,-13],[44,-40],[13,-21],[8,-52],[16,-25],[3,-12],[-2,-12],[-8,-16],[-2,-15],[-2,-6],[-4,-8],[-3,-11],[-1,-13],[4,-14],[7,-7],[7,-5],[4,-6],[5,-26],[-6,-18],[-7,-16],[-4,-25],[3,-12],[6,-14],[8,-12],[5,-6],[20,-7],[4,5],[1,11],[10,12],[30,15],[26,8],[15,1],[12,0],[10,1],[8,7],[45,-36],[44,-28],[67,-13],[33,-15],[18,-4],[13,-7],[5,-17],[3,-17],[7,-12],[12,-3],[50,3],[26,-11],[-20,-52],[22,-24],[-6,-3],[-2,0],[-1,-1],[-3,-6],[34,5],[26,9],[20,0],[11,-24],[0,-41],[-12,-2],[-18,19],[-16,24],[-16,-37],[-6,-34],[12,-26],[59,-14],[27,-9],[24,-14],[13,-17],[-4,-22],[-18,-6],[-23,-1],[-22,-3],[-41,-16],[-34,-21],[-13,-27],[26,-38],[26,-22],[49,-55],[31,-24],[0,-12],[-14,-2],[-6,-3],[-4,-6],[-9,-11],[6,-2],[1,-1],[0,-2],[3,-5],[20,2],[23,-11],[18,-19],[8,-21],[-4,-34],[-11,-6],[-16,7],[-20,6],[-10,-11],[-42,-63],[-30,-23],[-6,-14],[26,-7],[-13,-13],[-22,-6],[-49,-1],[-28,-9],[-17,-21],[-17,-57],[16,-13],[9,-24]],[[7667,6689],[-24,-4],[-16,-4],[-25,-9],[-9,-1],[-9,2],[-8,7],[-16,18],[-5,3],[-5,3],[-26,6],[-21,0],[-13,-1],[-29,-7],[-14,0],[-20,2],[-36,7],[-19,1],[-14,0],[-9,-3],[-9,-1],[-10,0],[-12,3],[-12,9],[-13,14],[-8,5],[-10,2],[-16,-1],[-11,-3],[-18,-7],[-9,-2],[-10,1],[-10,4],[-12,9],[-6,9],[-8,16],[-8,8],[-32,18],[-10,9],[-6,9],[-3,19],[-4,7],[-7,5],[-11,3],[-19,0],[-12,-1],[-38,-9],[-10,1],[-9,4],[-8,8],[-4,9],[-3,9],[-14,94],[-5,17],[-4,7],[-5,6],[-13,10],[-29,15],[-6,5],[-5,6],[-16,28],[-15,8],[-23,8],[-55,13],[-22,8],[-14,9],[-9,13],[-5,6],[-5,5],[-60,21],[-14,4],[-12,0],[-19,-6],[-20,-10],[-597,19],[0,57],[13,8],[12,5],[12,12],[22,30],[6,16],[2,11],[-1,2],[0,1],[0,1],[21,143],[0,18],[-3,13],[-4,7],[-6,5],[-6,4],[-16,2],[-14,7],[-7,3],[-25,4],[-7,3],[-18,16],[-16,6],[-8,3],[-9,7],[-9,10],[-19,46],[-4,7],[-5,6],[-16,14],[-6,8],[-9,16],[-3,11],[-2,12],[0,22],[-6,48],[-5,18],[-18,9],[-25,6],[-168,27],[-13,-3],[-7,-4],[-10,-11],[-12,-12],[-6,-5],[-8,-3],[-8,-3],[-11,1],[-12,4],[-13,9],[-7,7],[-4,9],[-40,90],[-10,15],[-9,8],[-10,2],[-20,0],[-75,-11],[-35,8],[-55,-63],[-25,-42],[-10,-41],[-4,-50],[-16,-47],[-31,-28],[-50,3],[22,-24],[10,-23],[0,-27],[-20,-69],[-17,-35],[-26,-22],[-36,6],[-3,-42],[99,-60],[27,-48],[-15,6],[-17,4],[-17,1],[-17,-1],[0,-10],[9,-4],[24,-18],[-40,-24],[9,-60],[-42,-12],[-11,-8],[17,-18],[24,-15],[10,-3],[2,-20],[-12,-16],[-11,-3],[-16,-5],[-16,0],[-10,-6],[-9,0],[-17,1],[-16,8],[-13,3],[-11,1],[-28,-2],[-18,-4],[-9,-3],[-7,-3],[-6,-5],[-24,-21],[-6,-5],[-7,-4],[-15,-6],[-8,-3],[-9,-2],[-9,0],[-18,4],[-30,3],[-9,3],[-13,8],[-9,2],[-11,0],[-13,-3],[-8,-11],[-23,-54],[-17,-56],[-1,-14],[3,-9],[5,0],[8,7],[5,12],[7,6],[9,2],[7,-3],[7,-5],[5,-6],[5,-17],[4,-6],[15,-8],[6,-5],[0,-10],[-5,-5],[-8,-2],[-18,0],[-10,-7],[-1,-7],[2,-7],[5,-6],[3,-8],[2,-10],[-5,-29],[-1,-11],[-3,-14],[-6,-3],[-8,-2],[-2,-6],[0,-25],[2,-9],[5,-6],[16,-16],[6,-3],[8,1],[13,9],[7,3],[9,1],[9,-1],[9,-2],[8,-3],[7,-4],[6,-6],[4,-9],[-1,-43],[-1,-9],[-1,-9],[2,-8],[4,-6],[5,-4],[6,-4],[6,-4],[9,0],[8,2],[8,0],[7,-5],[2,-8],[1,-14],[-13,-12]],[[4921,6557],[-216,49],[-337,118],[-13,7],[-249,371],[-29,56],[-2,8],[-3,21],[-3,13],[-6,8],[-8,6],[-32,15],[-106,65],[-1,1],[-4,5],[-3,6],[-9,23],[-4,9],[-17,23],[-8,15],[-3,8],[-1,8],[0,9],[1,10],[3,8],[24,44],[10,12],[18,15],[5,7],[4,7],[1,9],[0,9],[-1,10],[-7,13],[-39,47],[-35,20],[-19,3],[-12,2],[-10,0],[-32,8],[-45,-9],[-16,-11],[-4,-7],[-7,-16],[-10,-34],[-9,-17],[-9,-6],[-12,-3],[-12,-1],[-19,-7],[-9,-7],[-30,-39],[-32,-36],[-19,-13],[-14,-7],[-9,3],[-8,3],[-6,5],[-12,11],[-9,13],[-9,13],[-13,34],[-6,11],[-9,13],[-17,16],[-10,4],[-13,2],[-22,0],[-13,-2],[-10,-4],[-6,-5],[-5,-6],[-3,-7],[-3,-8],[1,-9],[2,-8],[14,-29],[-3,-11],[-9,-14],[-29,-23],[-17,-10],[-15,-4],[-139,9],[-9,3],[-6,3],[-12,11],[-19,20],[1,15],[13,10],[-58,8]],[[3063,7479],[13,44],[-1,9],[-2,12],[-13,22],[1,21],[19,90],[2,25],[-4,16],[-6,5],[-11,12],[-4,7],[-6,5],[-24,40],[-19,65],[-6,29],[-1,20],[15,21],[2,13],[-3,12],[-7,18],[-2,10],[0,6],[4,6],[5,4],[5,7],[3,8],[4,19],[3,8],[5,6],[7,4],[8,3],[8,7],[6,10],[7,21],[1,13],[-2,10],[-5,4],[-9,6],[-23,18],[-14,19],[-10,9],[-30,17],[19,76],[10,27],[5,7],[25,29],[3,13],[2,18],[6,11],[7,9],[11,8],[2,8],[-3,6],[-5,8],[-4,9],[-1,15],[6,11],[8,13],[3,11],[0,9],[-4,7],[-7,5],[-16,9],[-6,9],[1,15],[8,25],[5,30],[6,16],[6,10],[8,8],[10,15],[0,10],[-2,8],[-9,12],[-4,7],[-10,39],[-4,10],[-5,7],[-6,5],[-7,4],[-7,7],[-7,10],[-13,30],[-5,8],[-7,5],[-8,4],[-9,2],[-10,0],[-208,-6],[-11,2],[-9,3],[-8,7],[-1,8],[2,7],[29,41],[12,14],[35,30],[4,9],[4,14],[0,12],[4,20],[6,15],[14,21],[6,13],[1,12],[-2,8],[-13,14],[19,23],[30,14],[44,7],[22,-2],[61,11],[17,-30],[19,-16],[18,-9],[13,-4],[12,-2],[10,0],[19,3],[65,20],[133,69],[6,4],[5,6],[1,8],[-4,27],[1,19],[7,34],[-2,10],[-51,14],[-10,8],[-14,13],[-4,10],[-2,10],[1,10],[5,20],[-1,12],[-6,26],[-12,16],[-28,56],[-19,18]],[[3191,9434],[7,50],[7,12],[11,12],[8,14],[0,17],[-10,11],[-17,7],[-18,6],[-13,6],[-20,30],[-3,27],[16,50],[8,72],[-5,12],[-6,11],[-3,13],[4,29],[8,29],[3,2],[23,37],[-2,5],[36,11],[22,-13],[33,-54],[25,-21],[33,-22],[66,-34],[27,-8],[89,-17],[34,-2],[40,7],[31,19],[6,37],[-12,15],[-21,9],[-19,11],[-8,22],[3,61],[11,29],[28,13],[36,2],[34,-6],[42,-1],[32,14],[30,20],[39,16],[39,5],[17,-9],[2,-22],[-8,-64],[4,-13],[31,-10],[18,-10],[15,-11],[5,-13],[-8,-18],[-17,-10],[-18,-7],[-13,-14],[10,-22],[5,-19],[-3,-18],[-10,-13],[-30,-23],[-8,-13],[-1,-24],[9,-4],[14,4],[14,-2],[9,-8],[9,-11],[9,-9],[11,-3],[19,2],[13,1],[10,-6],[7,-15],[-3,-9],[-17,-29],[-4,-13],[6,-15],[26,-30],[-24,-48],[-5,-29],[24,-19],[-40,-42],[1,-5],[4,-10],[2,-10],[-3,-8],[-14,-5],[-11,4],[-8,7],[-4,2],[-20,-21],[-4,-21],[5,-58],[25,4],[18,-11],[32,-37],[22,-13],[124,-42],[146,1],[31,29],[19,30],[11,33],[6,40],[19,14],[77,-25],[19,13],[-7,86],[7,29],[18,26],[25,17],[118,59],[210,44],[92,8],[45,11],[16,1],[20,-7],[36,-23],[45,-16],[28,-15],[29,-36],[20,-39],[2,-27],[23,-8],[12,-2],[15,-1],[9,-5],[8,-13],[5,-14],[5,-10],[18,-14],[22,-11],[28,-7],[33,-1],[7,5],[7,9],[6,6],[8,-4],[7,-4],[9,-2],[19,1],[19,4],[10,10],[8,11],[12,7],[28,-1],[76,-11],[26,7],[80,-45],[15,2],[12,21],[27,-2],[26,-17],[1,0],[12,-24],[0,-86],[-4,-8],[-7,-9],[2,-7],[20,-2],[12,4],[9,8],[8,10],[5,10],[4,-32],[-14,-28],[-1,-17],[44,1],[-11,-28],[10,-16],[41,-26],[3,-12],[-38,-13],[-15,-13],[14,0],[11,-3],[9,-4],[11,-3],[-23,-10],[14,-18],[18,-3],[19,8],[16,13],[9,-28],[17,-15],[22,-10],[19,-12],[19,-24],[11,-29],[-6,-21],[-35,-1],[7,-16],[19,-23],[18,-36],[3,-10],[-24,-64],[2,-18],[48,-43],[14,-4],[10,10],[8,14],[13,7],[19,-3],[7,-8],[6,-7],[13,-3],[38,-3],[33,-10],[23,-19],[11,-32],[31,9],[14,-23],[8,-36],[15,-26],[-26,-9],[-14,-2],[-16,1],[0,-12],[15,-12],[3,-6],[5,-13],[21,6],[22,-33],[25,5],[-9,8],[-3,7],[6,5],[16,2],[17,-2],[8,-5],[5,-9],[10,-11],[19,-16],[6,-10],[2,-17],[4,-12],[8,-6],[22,-9],[9,-9],[-1,-6],[1,-1],[14,5],[13,9],[11,10],[6,9],[-2,4],[24,0],[20,3],[19,10],[21,20],[19,-14],[24,-34],[18,-6],[24,6],[6,17],[1,21],[8,21],[5,11],[2,6],[5,3],[30,0],[12,-3],[10,-4],[4,-8],[-4,-27],[-16,-41],[-3,-28],[23,-33],[53,-5],[59,3],[39,-9],[15,-23],[14,-51],[11,-17],[22,-10],[6,14],[0,25],[4,25],[26,-6],[44,-18]],[[3063,7479],[-60,-34],[-40,-11],[-15,-6],[-21,-13],[-19,-7],[-65,-15],[-17,-8],[-10,-9],[-2,-10],[-5,-11],[-10,-15],[-4,-12],[-1,-11],[1,-22],[0,-1],[8,-70],[0,-10],[-4,-10],[-5,0],[-6,3],[-12,11],[-8,4],[-10,3],[-19,-1],[-12,1],[-9,4],[-6,5],[-9,4],[-11,2],[-47,-9],[-26,-3],[-11,1],[-9,1],[-9,3],[-7,4],[-7,5],[-5,6],[-18,26],[-6,5],[-7,4],[-9,1],[-29,-2],[-9,1],[-8,4],[-6,4],[-3,3],[-1,0],[0,1],[-1,1],[-4,3],[-9,4],[-15,3],[-10,0],[-8,-4],[-5,-4],[-3,-3],[-2,-6],[-15,-18],[-20,-12],[-27,-23],[-22,-16],[-42,-11],[-22,-1],[-3,-3],[-1,-7],[4,-6],[7,-4],[13,-1],[15,-4],[0,-9],[-10,-18],[0,-21],[-4,-16],[-7,-15],[-12,-13],[23,-9],[14,-18],[7,-25],[2,-28],[3,-9],[15,-27],[3,-12],[-4,-12],[-14,-13],[-3,-13],[-3,-27],[-20,-75],[-2,-59],[-5,-30],[-16,-29],[22,-1],[12,-6],[-2,-8],[-20,-7],[21,-15],[18,-29],[11,-32],[9,-59]],[[2343,6548],[-53,46],[-14,23],[-6,16],[-5,8],[-9,10],[-15,13],[-41,26],[-12,5],[-17,5],[-16,7],[-14,8],[-22,21],[-44,57],[-16,27],[-8,9],[-11,9],[-37,22],[-18,9],[-14,8],[-72,80],[-60,33],[-6,4],[-6,6],[-45,68],[-12,12],[-95,79],[-51,17],[-30,14],[-14,8],[-12,11],[-10,14],[-74,131],[-40,54],[-20,4]],[[1424,7412],[2,2],[-20,24],[-68,36],[-37,27],[-18,17],[-22,40],[-14,3],[-16,-7],[-20,-3],[-84,31],[-1,57],[58,136],[5,37],[43,124],[-8,14],[-68,0],[-34,-7],[-63,-33],[-33,-12],[-30,-3],[-37,2],[-35,7],[-27,13],[-27,28],[-96,128],[-12,25],[-8,28],[-5,36],[-1,34],[2,14],[60,408],[-7,33],[-31,-2],[-7,2],[-7,14],[5,6],[8,2],[3,4],[-3,8],[-3,28],[-7,8],[-9,3],[-9,0],[-6,3],[-5,13],[-6,16],[2,14],[35,13],[20,15],[6,15],[-20,7],[-16,17],[17,40],[34,42],[30,27],[83,29],[38,20],[31,39],[6,22],[8,22],[12,19],[17,18],[31,-11],[34,0],[34,9],[30,13],[30,24],[16,10],[42,5],[16,6],[14,9],[16,12],[39,48],[6,12],[6,17],[11,8],[12,8],[9,12],[3,22],[20,32],[-22,27],[33,6],[36,21],[19,26],[-20,23],[15,7],[7,2],[0,11],[23,17],[14,4],[20,-3],[14,5],[8,16],[7,20],[9,13],[34,5],[59,-34],[38,-4],[16,2],[30,0],[15,5],[12,11],[39,47],[24,1],[19,-4],[15,-9],[15,-14],[8,-18],[2,-18],[-2,-17],[2,-14],[6,-15],[28,-44],[2,-17],[-4,-15],[2,-10],[21,0],[15,3],[45,16],[37,-2],[10,-24],[-11,-64],[2,-38],[14,-19],[26,-7],[103,-2],[130,-19],[161,-42],[28,-16],[26,-29],[25,-36],[29,-25],[40,2],[38,12],[34,24],[20,33],[-3,40],[-16,18],[-21,13],[-18,14],[-3,21],[39,124],[19,20],[37,6],[93,-12],[32,5],[96,42],[35,3],[36,-11],[62,-34],[36,-4],[38,12],[14,18],[1,8]],[[2343,6548],[21,-44],[10,-35],[0,-65],[16,-96],[17,-31],[25,-25],[32,-19],[-19,-12],[-5,-9],[1,-9],[0,-69],[-17,-26],[11,-39],[20,-41],[20,-21],[-10,-30],[7,-22],[15,-20],[9,-26],[-2,-12],[-15,-21],[-4,-13],[0,-55],[8,-32],[28,-65]],[[2511,5711],[-206,-1],[-49,9],[-14,29],[-56,85],[-5,7],[-6,5],[-60,37],[-28,12],[-57,13],[-13,5],[-9,6],[-5,6],[-8,14],[-6,7],[-9,8],[-17,12],[-25,21],[-11,3],[-15,0],[-8,-5],[-7,-6],[-9,-12],[-12,-10],[-25,-18],[-12,-10],[-5,-5],[-3,-5],[-6,-10],[-15,-53],[-2,-40],[1,-9],[3,-8],[5,-7],[10,-10],[2,-4],[1,-3],[-1,-3],[-8,-10],[-3,-8],[-1,-8],[0,-8],[1,-6],[2,-3],[10,-17],[2,-5],[2,-7],[2,-48],[2,-9],[0,-8],[-3,-8],[-11,-9],[-9,-6],[-6,-5],[-1,-6],[3,-7],[3,-6],[2,-6],[-3,-4],[-6,-4],[-5,-4],[-6,-5],[-5,-7],[-7,-8],[-10,0],[-8,-3],[-7,-4],[-16,-14],[-16,-9],[-12,-3],[-12,0],[-14,1],[-14,-6],[-12,0],[-7,1],[-5,7],[-3,8],[-6,5],[-5,0],[-5,-5],[-6,-6],[-8,-6],[-18,-17],[-25,-13],[-12,-3],[-9,-1],[-4,5],[-5,6],[-5,5],[-7,2],[-12,-12],[-6,-1],[-6,3],[-5,15],[-5,7],[-9,5],[-7,6],[-6,8],[-13,9],[-27,8],[-34,5],[-17,5],[-9,7],[-3,7],[-13,20],[-5,5],[-12,11],[-4,7],[-3,8],[-4,8],[-9,4],[-7,5],[-12,11],[-7,4],[-9,3],[-8,5],[-11,3],[-6,3],[-1,7],[3,6],[2,6],[-1,7],[-10,12],[-3,7],[-3,7],[-2,7],[-1,1],[-1,0],[-23,21],[-22,8],[-11,-2],[-7,-6],[-6,-8],[-11,-2],[-38,6],[-30,12],[-31,13]],[[1068,5770],[-4,16],[-20,34],[-27,29],[-31,17],[-9,22],[0,24],[9,48],[13,19],[9,22],[-1,15],[-21,0],[-98,-32],[-16,-3],[-159,47],[-136,85],[2,16],[27,27],[5,18],[-4,30],[0,29],[20,89],[-2,32],[-9,20],[-11,17],[-9,17],[0,19],[9,11],[79,60],[23,3],[59,-11],[33,3],[55,21],[33,2],[14,-4],[18,-15],[10,-5],[14,-1],[28,2],[15,-2],[49,12],[25,3],[24,-4],[20,-15],[11,-21],[9,-22],[13,-21],[18,-15],[23,-13],[27,-7],[27,-1],[28,12],[3,22],[-5,26],[6,24],[36,5],[35,-45],[52,-98],[37,-22],[45,-6],[95,10],[-34,66],[-10,34],[5,37],[12,40],[0,27],[-21,65],[-3,33],[4,60],[-9,29],[-12,14],[-45,29],[-16,17],[-39,68],[-11,13],[-31,26],[-8,8],[-13,20],[-10,7],[-10,0],[-17,-8],[-7,-1],[-98,28],[-37,4],[-75,22],[-16,48],[30,136],[7,77],[8,37],[16,38],[24,25],[147,71],[32,3],[32,0],[39,6],[26,18]],[[2511,5711],[20,-49],[0,-32],[-12,-18],[-16,-15],[-17,-20],[-6,-12],[-3,-10],[-2,-25],[3,-16],[15,-17],[3,-11],[6,-102],[11,-55],[18,-41]],[[2531,5288],[1,-18],[-1,-17],[-4,-16],[-8,-14],[10,-25],[18,-69],[11,-14],[36,11],[18,0],[15,-28],[36,-4],[13,-10],[0,-31],[-24,-17],[-29,-13],[-14,-20],[9,-37],[2,-16],[-2,-5],[-3,-3],[-4,-4],[-2,-10],[5,-5],[22,-13],[6,-9],[-4,-42],[-28,-17],[-32,-11],[-15,-21],[-5,-18],[-11,-15],[-11,-12],[-9,-14],[-7,-3],[-8,-4],[-4,-10],[2,-10],[7,-17],[15,-78],[3,-38],[-10,-27],[-9,-17],[3,-17],[8,-17],[4,-14],[-12,-54],[0,-16],[62,-144],[3,-24],[-6,-22],[-28,-89],[-8,-50],[0,-17],[3,-33]],[[2545,4050],[-11,1],[-77,13],[-24,9],[-40,26],[-8,4],[-17,0],[-125,-12],[-56,12],[-10,1],[-22,1],[-154,-24],[-46,-12],[-17,-3],[-172,-1],[-106,-15],[-20,-36],[-3,-11],[-7,-82],[-22,-4],[-273,-4],[-27,2],[-23,5],[-16,14],[-7,10],[-18,50],[-8,14],[-8,7],[-12,7],[-40,10],[-23,4],[-12,5],[-14,9],[-35,30],[-13,9],[-8,5],[-42,17],[-37,-12],[-64,-59],[-19,-9],[-13,-3],[-9,2],[-5,-4],[-4,-8],[-7,-10],[-9,-6],[-12,-5],[-2,-5],[5,-11],[-7,-20],[-14,-27],[-3,-10],[0,-8],[3,-6],[5,-1],[6,-1],[4,-5],[16,-38],[-1,-10],[-7,-4],[-10,-3],[-13,-7],[-15,-12],[-19,-11],[-10,-4],[-9,-12],[-19,-13],[-3,-7],[-1,-15],[-6,-32],[-7,-17],[-12,-13],[-10,-6],[-10,-1],[-6,4],[-3,6],[-1,6],[-4,5],[-9,0],[-33,-19],[-5,-9],[1,-6],[11,-22],[1,-11],[-6,-4],[-17,-3],[-7,-2],[-9,-1],[-17,2],[-4,-3],[3,-13],[1,-9],[-3,-10],[-1,-9],[1,-8],[0,-7],[-1,-10],[-12,-6],[-40,-30],[-11,-1],[-21,-7],[-13,-6],[-18,-13],[-12,1],[-15,6],[-160,98],[-11,4]],[[290,3621],[147,157],[23,34],[21,45],[13,47],[3,22],[-1,22],[-8,9],[-14,8],[-8,12],[21,43],[2,25],[-2,25],[2,28],[9,14],[33,24],[12,15],[4,38],[-28,149],[-2,38],[-4,15],[-10,16],[-25,23],[-5,10],[-2,10],[4,20],[-1,11],[-7,12],[-19,23],[-8,13],[-13,48],[-10,21],[-28,38],[-11,18],[-9,31],[-20,152],[-33,110],[-30,55],[-68,33],[74,66],[42,20],[39,-42],[30,2],[58,17],[55,-14],[62,-46],[60,-24],[47,50],[0,11],[-5,25],[1,12],[7,18],[33,40],[7,6],[19,10],[7,6],[1,7],[-5,15],[1,6],[53,58],[8,23],[5,52],[7,25],[7,9],[11,6],[9,9],[4,15],[-9,17],[-36,30],[-12,17],[3,63],[82,117],[16,61],[3,38],[-3,13],[25,0],[69,10],[16,-5],[15,-13],[20,-11],[29,-3],[-5,19]],[[4921,6557],[9,-26],[134,-73],[-18,-19],[-15,-6],[-40,3],[-30,9],[-15,2],[-15,-3],[-15,-8],[-9,-7],[5,-3],[15,-12],[46,-52],[18,-12],[8,-3],[5,-8],[8,-7],[13,-3],[56,0],[8,-5],[3,-10],[2,-10],[4,-7],[78,-17],[11,-4],[33,-22],[19,-9],[8,-5],[7,-7],[17,-34],[6,-9],[19,-9],[23,-6],[22,-13],[13,-27],[-33,0],[30,-76],[3,-40],[-22,-34],[-24,0],[-24,-1],[-23,-7],[19,-37],[-4,-22],[-13,-14],[-20,5],[-13,-21],[-22,11],[-28,7],[-23,-5],[-14,-24],[-26,7],[-49,1],[-18,-5],[-9,-4],[2,-24],[-1,-13],[-5,-9],[-10,-10],[-95,-59],[-43,-18],[-70,-11],[-55,4],[-15,0],[-25,-3],[-15,-5],[-15,-74],[1,-15],[7,-28],[6,-16],[2,-9],[0,-10],[-1,-9],[-5,-16],[-7,-16],[-24,-31],[-3,-7],[-7,-26],[-1,-9],[1,-20],[5,-17],[8,-24],[-1,-12],[-5,-14],[-16,-23],[-9,-10],[-27,-16]],[[4618,5326],[-48,-1],[-17,-3],[-24,-8],[-31,-20],[-31,-16],[-30,-10],[-126,47],[-23,5],[-17,-3],[-53,-37],[-46,-41],[-6,-17],[-1,-12],[4,-28],[1,-7],[-6,-10],[-5,-8],[-48,-27]],[[4111,5130],[-29,39],[-28,17],[-43,13],[-62,24],[-15,10],[-7,9],[-6,49],[-3,8],[-3,8],[-18,29],[-20,42],[-51,2],[-243,-56],[-50,-2],[-37,2],[-243,68],[-600,-34],[-47,-10],[-36,-21],[-39,-39]],[[4837,4564],[-5,-14],[3,-8],[-4,-7],[-6,-5],[-10,-4],[-1,-7],[2,-8],[10,-18],[7,-7],[7,-4],[9,-1],[9,0],[11,-1],[12,-4],[28,-22],[20,-12],[2,-9],[1,-10],[5,-17],[8,-8],[14,-10],[10,-4],[10,-2],[9,0],[9,2],[7,3],[7,4],[5,4],[9,3],[15,3],[11,-1],[11,-3],[44,-16],[6,-8],[2,-9],[-13,-45],[-9,-21],[-2,-10],[1,-11],[5,-17],[8,-12],[7,-8],[7,-5],[7,-4],[8,-3],[32,-9],[4,-6],[-1,-7],[-5,-6],[-6,-5],[-20,-9],[-17,-6],[-11,-18],[-6,-12],[-14,-45],[-3,-25],[-8,-27],[-34,-25],[-3,-29],[14,-29],[44,-49],[10,-35],[16,-18],[80,-73],[3,-13],[18,-37],[17,-35],[6,-32],[-5,-79],[-1,-2]],[[5243,3597],[-2,0],[-109,1],[-50,-18],[-324,-210],[-49,-10],[-492,49]],[[4217,3409],[-78,78],[-11,54],[6,38],[-57,75],[-63,80],[-13,58],[-1,53],[-3,26],[-60,117],[-9,35],[-4,31],[2,54],[4,27],[9,27],[20,20],[295,182],[36,6],[46,3],[22,4],[12,5],[4,12],[4,7],[17,19],[-64,30],[-41,5],[-6,2],[-30,23],[-20,8],[-75,38],[-43,15],[-10,5],[-6,5],[-4,7],[-8,21],[-12,16],[-73,17],[-32,3],[-22,0],[-10,-1],[-16,-6],[-5,-6],[-2,-9],[1,-45],[-4,-23],[-10,-23],[-33,-8],[-34,-3],[-44,1],[-55,9],[-25,1],[-14,6],[-11,8],[-10,13],[-12,13],[-16,13],[-15,2],[-20,-6],[-18,-10],[-38,-14],[-3,33],[78,149],[87,125],[20,36],[12,40],[18,35],[22,17],[319,168]],[[4618,5326],[20,-57],[5,-27],[-9,-104],[2,-15],[3,-11],[6,-5],[7,-4],[9,-3],[10,-2],[15,-13],[19,-23],[31,-60],[11,-28],[5,-19],[-4,-7],[-5,-5],[-7,-4],[-16,-3],[-14,0],[6,-29],[4,-6],[22,-26],[-12,-101],[3,-31],[10,-12],[6,-4],[16,-5],[13,-13],[2,-10],[-1,-9],[-5,-6],[-13,-11],[-5,-8],[1,-7],[4,-7],[12,-10],[5,-6],[6,-5],[6,-4],[25,-9],[9,-6],[8,-10],[11,-18],[3,-10],[-5,-9]],[[5243,3597],[0,-11],[7,-30],[18,-11],[90,2],[37,-9],[20,-21],[-15,-34],[6,-24],[-16,-23],[-21,-29],[26,-9],[21,-3],[4,-6],[-9,-23],[-3,-20],[-4,-8],[-9,-9],[-6,-12],[7,-9],[10,-8],[5,-9],[-2,-42],[2,-30],[12,-25],[28,-27],[27,-8],[57,19],[32,-9]],[[5567,3169],[2,-55],[3,-10],[-4,-41],[-48,-127]],[[5520,2936],[-76,20],[-36,5],[-315,-105],[-366,46],[-45,-89],[-10,-33],[7,-57],[8,-34],[0,-14],[-46,-80],[3,-29],[-3,-29],[-5,-10],[-9,-11],[-23,-14],[-15,-5],[-13,-2],[-75,-65],[-302,-340]],[[4199,2090],[-4,18],[-5,4],[-8,4],[-6,5],[-3,10],[0,10],[3,17],[-1,8],[-4,7],[-5,6],[-36,28],[-14,29],[-6,9],[-39,23],[-12,5],[-38,-1],[-95,-25],[-49,103],[-9,14],[-7,10],[-7,4],[-13,10],[-5,10],[-5,14],[-9,88],[-3,13],[-5,13],[-12,24],[-8,12],[-13,14],[-22,18],[0,1],[-4,3],[-9,8],[-11,12],[-32,55],[-32,83],[-21,75],[-20,241]],[[3630,3072],[48,6],[60,15],[50,20],[28,6],[23,3],[82,-5],[18,3],[15,8],[95,76],[7,3],[8,1],[8,-2],[8,-3],[30,-15],[13,-8],[10,6],[13,17],[40,72],[14,39],[17,95]],[[3630,3072],[-41,-7],[-100,-39],[-28,0],[-29,9],[-82,47],[-18,7],[-13,-8],[-122,-86],[-17,-10],[-16,-3],[-235,-1],[-19,5],[-23,15],[-190,217],[-33,81],[0,9],[7,12],[7,6],[9,4],[9,2],[16,4],[6,4],[4,5],[2,8],[1,11],[-1,13],[-3,18],[-13,28],[-56,45]],[[2652,3468],[-15,12],[-5,6],[5,27],[52,75],[-5,44],[3,21],[4,7],[3,8],[2,9],[1,9],[-28,134],[-7,18],[-9,15],[-21,25],[-12,11],[-10,8],[-33,11],[-7,4],[-7,6],[-6,9],[-7,14],[-3,12],[0,13],[7,17],[6,9],[6,8],[4,16],[-25,34]],[[5520,2936],[112,-101],[66,-26],[168,-19],[24,-8],[17,-14],[6,-33],[8,-193],[20,-121],[81,-147],[-91,-223],[-3,-13],[1,-8],[3,-7],[9,-12],[15,-28],[3,-8],[7,-33],[0,-20],[-4,-21],[-18,-58],[-103,-237],[-6,-17],[-1,-11],[-1,-12],[3,-37],[-1,-9],[-2,-9],[-57,-121],[-8,-10],[-6,-6],[-7,-5],[-9,-3],[-12,0],[-19,6],[-23,18],[-15,2],[-22,0],[-103,-8],[-15,-7]],[[5537,1377],[-3,4],[-10,0],[-18,-18],[-29,8],[-32,13],[-24,-3],[-10,0],[-17,7],[-10,-6],[-1,-15],[7,-19],[-5,2],[-19,8],[1,-16],[-1,-5],[14,4],[2,-5],[7,-9]],[[5389,1327],[-3,0],[-23,10],[-18,12],[-85,69],[-15,8],[-17,6],[-21,3],[-12,-42],[24,-210]],[[5219,1183],[-110,-6],[-48,7],[-42,24],[-46,-32],[34,-10],[12,-1],[-130,-38],[-362,-52],[-12,-4]],[[4515,1071],[-1,5],[-22,155],[0,19],[8,25],[5,12],[6,10],[16,16],[14,8],[16,7],[131,32],[15,100],[-139,444],[-205,-66],[-25,-4],[-5,6],[-4,8],[-7,9],[-17,6],[-10,6],[-6,5],[-7,9],[-10,10],[-5,6],[-4,7],[-8,32],[-3,7],[-3,6],[-4,7],[-2,18],[0,8],[2,8],[4,6],[3,8],[0,16],[-16,26],[-7,7],[-6,9],[-9,9],[-11,17]],[[4515,1071],[-184,-55],[-28,-14],[-12,-14],[-19,1],[-86,-31],[-129,-63],[-447,-143],[-14,-11],[-10,-24],[-24,-12],[-173,-41],[-34,-4],[-26,-8],[-44,-40],[-27,-16],[-206,-58],[-165,-11],[-42,-20],[-39,-9],[-18,-10],[-45,-53],[-88,-71],[-102,-59],[-67,-19],[-122,-12],[-97,-40],[-20,-13],[-17,-31],[-17,-3],[-21,1],[-15,-6],[-30,-23],[-88,-46],[-129,-102],[-29,-11],[-40,3],[-71,14],[-26,-3],[-55,35],[-8,19],[2,15],[17,30],[5,15],[-2,15],[-12,31],[3,40],[-3,16],[-4,15],[-3,14],[8,335],[-8,82],[-4,14],[-10,11],[-13,9],[-12,12],[-8,18],[0,2],[0,12],[9,32],[2,18],[-11,48],[0,15],[50,38],[22,-2],[14,-10],[6,0],[0,23],[-9,31],[-16,20],[-11,22],[2,34],[-13,90],[4,28],[21,28],[26,12],[28,-1],[23,-9],[44,77],[10,28],[1,26],[-13,74],[17,51],[7,15],[12,14],[42,22],[4,4],[19,-3],[-3,-6],[-8,-8],[2,-8],[5,-10],[0,-12],[4,-6],[16,7],[8,9],[6,26],[4,11],[20,26],[9,16],[2,18],[-4,30],[-9,30],[-13,2],[-17,-3],[-24,13],[-15,21],[-12,27],[-6,28],[0,25],[22,-12],[8,17],[-1,59],[12,23],[19,14],[8,13],[-2,3],[-17,15],[11,0],[32,2],[-22,27],[-8,30],[11,18],[35,-5],[-21,25],[-35,67]],[[1964,2011],[30,6],[500,93],[21,483],[-8,140],[-18,67],[-22,307],[-8,207],[9,49],[18,15],[13,8],[11,5],[8,2],[7,3],[6,5],[6,5],[21,30],[4,4],[26,14],[7,3],[45,10],[12,1]],[[9033,4246],[0,1],[-2,29],[-68,124],[-19,20],[-26,22],[-55,32],[-36,28],[-20,11],[-119,35],[-35,5],[-21,-1],[-13,-21],[-10,-12],[-6,-5],[-8,-1],[-10,3],[-26,30],[-17,14],[-6,7],[-4,7],[-4,6],[-25,80],[-6,8],[-10,8],[-20,10],[-11,7],[-9,3],[-8,-3],[-6,0],[-15,8],[-10,-3],[-26,8],[-6,1],[-8,-1],[-52,-16]],[[8316,4690],[24,36],[-2,36],[26,13],[5,25],[-10,64],[-5,1],[-36,51],[-5,12],[-7,9],[-14,7],[-19,3],[-21,6],[-19,8],[-13,10],[-3,15],[32,29],[9,19],[-13,47],[-32,7],[-65,-16],[-15,9],[-8,14],[-10,14],[-19,6],[-6,10],[-1,23],[-7,22],[-19,10],[-41,7],[-18,17],[-15,52],[13,36],[-21,17],[-36,4],[-33,-3],[-10,11],[-13,7],[-16,0],[-18,-8],[-11,32],[-17,16],[-26,5],[-36,1],[0,10],[17,8],[3,11],[-10,31],[-4,6],[-11,14],[-2,10],[6,9],[9,10],[4,8],[-8,27],[-10,18],[-7,11],[-21,15],[-22,-17],[-17,13],[-48,11],[-24,8],[-26,14],[-1,5],[15,4],[22,10],[29,23],[13,15],[4,14],[-13,31],[-16,-2],[-17,-12],[-16,0],[-23,5],[-28,-8],[-24,0],[-10,25],[10,71]],[[7539,5772],[8,58],[18,38],[28,21],[37,-12],[6,7],[13,17],[4,8],[-21,19],[-63,73],[-17,8],[-17,2],[-12,4],[-5,19],[6,19],[24,32],[5,19],[-10,15],[-39,22],[-8,11],[-2,16],[-7,22],[-1,15],[17,2],[82,0],[24,4],[12,16],[4,17],[-3,15],[-8,12],[-17,17],[0,6],[7,4],[5,14],[2,5],[5,5],[4,7],[0,11],[-5,7],[-7,2],[-7,-1],[-4,2],[-8,12],[-10,9],[-4,13],[11,20],[5,-5],[22,4],[35,11],[10,29],[7,20],[-15,31],[-60,32],[-4,28],[10,9],[28,8],[12,21],[46,33],[3,22],[-10,34],[-8,8]],[[7028,8248],[11,12],[21,40],[4,19],[-5,37],[0,14],[9,14],[50,50],[-19,6],[-7,1],[21,19],[29,9],[61,8],[30,16],[47,62],[30,21],[28,4],[93,-27],[17,-8],[10,-3],[10,2],[3,7],[1,8],[1,5],[25,11],[14,4],[52,1],[11,22],[7,26],[24,12],[35,8],[62,38],[30,9],[3,1],[108,1],[32,9],[14,10],[26,27],[16,10],[24,7],[80,10],[12,-2],[21,-11],[11,-2],[8,4],[16,18],[5,4],[22,-7],[13,-11],[10,-13],[18,-12],[28,-5],[97,12],[258,-20],[20,-7],[29,-26],[18,-8],[14,5],[20,11],[17,6],[7,-10],[-2,-32],[3,-32],[17,-20],[39,4],[22,21],[56,75],[25,17],[20,-12],[1,-30],[-4,-37],[7,-31],[29,-16],[37,-1],[37,-8],[33,-38],[21,-76],[16,-36],[28,-23],[30,-1],[56,16],[31,-7],[26,-25],[20,-36],[29,-73],[81,-151],[164,-206],[37,-27],[39,-3],[31,26],[40,80],[51,46],[22,-27],[2,-22],[-7,-50],[2,-12],[8,-27],[0,-42],[-8,-26],[-20,-12],[-22,-10],[-17,-21],[-2,-29],[13,-25],[23,-16],[28,-6],[26,-13],[-2,-30],[-20,-30],[-52,-26],[-19,-28],[-28,-56],[-35,-34],[-7,-13],[-3,-78],[-7,-25],[-15,-22],[16,-8],[10,-11],[13,-8],[23,-4],[42,-2],[41,-9],[41,-20],[11,-26],[2,-32],[25,-73],[10,-7],[11,-2],[9,-3],[4,-14],[2,-27],[33,-109],[-2,-22],[-17,-9],[-12,-10],[-4,-20],[8,-12],[0,-1],[15,7],[7,-25],[76,-439],[75,-439],[-11,-23],[-74,-42],[-22,-7],[-19,2],[-21,9],[-13,1],[-11,-9],[-11,-21],[-7,-25],[4,-20],[22,-45],[10,-37],[-1,-27],[-17,-21],[-33,-16],[-98,-31],[-30,-21],[-75,-82],[-26,-21],[-3,5],[-8,9],[-11,7],[-10,-1],[-5,-12],[-7,-117],[-5,-17],[-13,-13],[-37,-21],[-14,-13],[-1,-8],[5,-20],[-1,-9],[-6,-10],[-17,-19],[-6,-10],[-118,-241],[-22,-64],[-80,-480],[2,-18],[10,-22],[11,-13],[7,-13],[-1,-21],[-15,-31],[-75,-89],[-8,-16],[-13,-78],[-9,-11],[-81,-26],[-2,-1]],[[7539,5772],[-240,-46],[-36,-10],[-13,-10],[-8,-7],[-36,-53],[-94,-97],[-30,-22],[-129,-60],[-42,-35],[-24,-11],[-27,-6],[-19,-2],[-22,1],[-34,12],[-16,2],[-12,0],[-64,-14],[-15,-60],[2,-27],[5,-9],[5,-16],[25,-185],[-5,-18],[-8,-9],[-10,0],[-52,14],[-10,0],[-10,-1],[-10,-3],[-9,-7],[-9,-9],[-15,-20],[-17,-18],[-9,-8],[-42,-28],[-35,-40]],[[6474,4970],[-131,-5],[-42,4],[-9,6],[-30,29],[-21,12],[-14,5],[-12,0],[-97,-5],[-25,-6],[-19,-10],[-29,-33],[-24,-44],[-13,-11],[-20,-12],[-93,-33],[-22,-13],[-11,-8],[-9,-9],[-8,-9],[-7,-9],[-10,-20],[-3,-10],[-11,-12],[-17,-13],[-183,-85],[-30,-32],[-17,-36],[-9,-11],[-10,-3],[-12,1],[-13,-2],[-20,-8],[-13,-13],[-30,-36],[-12,-8],[-12,-3],[-31,5],[-10,0],[-52,-13],[-15,-3],[-13,1],[-10,3],[-10,5],[-10,7],[-28,30],[-33,46],[-8,9],[-10,8],[-15,6],[-12,0],[-12,-2],[-68,-27],[-188,-45],[-26,0],[-48,6]],[[8426,2340],[-410,107],[-10,2],[-13,-2],[-15,-6],[-120,-73],[-69,-69],[-20,-17],[-19,-7],[-13,-3],[-25,-11],[-33,-46],[11,-176],[-2,-11],[-3,-11],[-17,-16],[-615,-32],[-53,3],[-49,20],[-77,41],[-25,17],[-16,19],[7,24],[-40,80],[-323,199],[321,573]],[[6798,2945],[51,82],[7,4],[9,1],[12,-8],[6,-7],[5,-8],[6,-16],[5,-5],[7,-5],[22,-11],[40,-26],[12,-10],[7,-5],[10,-4],[55,-13],[54,-18],[36,-7],[7,-4],[36,7],[131,69],[3,23],[-1,20],[-2,8],[-7,15],[-8,34],[2,16],[0,18],[2,17],[0,10],[-4,27],[-1,10],[1,20],[8,35],[14,30],[9,13],[41,43],[7,12],[5,12],[2,8],[9,9],[15,11],[88,28],[425,197]],[[7924,3577],[9,-18],[22,7],[23,4],[36,-1],[9,1],[23,26],[16,8],[17,-13],[3,-20],[-12,-45],[-1,-20],[6,-11],[20,-15],[7,-6],[4,-12],[4,-26],[8,-11],[8,-15],[10,-71],[-4,-11],[-8,-9],[-8,-7],[-4,-5],[2,-12],[4,-9],[4,-7],[2,-4],[7,-10],[32,-31],[11,-6],[17,-76],[35,5],[31,-10],[26,1],[21,36],[68,-73],[38,-52],[23,-64],[11,-15],[-2,-8],[-32,-3],[-10,-6],[4,-13],[8,-12],[8,-5],[12,-16],[9,-18],[-3,-6],[19,-2],[8,26],[18,9],[21,-10],[27,-54],[13,-13],[6,-79],[-11,-19],[-21,-14],[-21,-17],[-4,-30],[10,4],[25,7],[-3,-8],[-5,-17],[-4,-8],[27,-14],[17,-26],[2,-31],[-18,-31],[-15,-8],[-17,-3],[-13,-6],[-6,-15],[-1,-21],[-4,-17],[-53,-97],[-7,-28],[-2,-31]],[[8316,4690],[-15,-23],[3,-34],[12,4],[11,6],[2,-5],[0,-4],[1,-2],[8,1],[-11,-24],[-12,-8],[-33,-1],[-43,-9],[-2,-9],[1,-46],[4,-17],[1,-16],[-6,-20],[-9,-20],[-7,-10],[-10,-5],[-20,-9],[-5,27],[-17,5],[-20,-11],[-13,-21],[0,-19],[15,-51],[7,-15],[14,-17],[18,-7],[47,-8],[1,4],[11,7],[14,3],[7,-9],[-2,-11],[-4,-8],[-7,-5],[-10,-4],[12,-26],[-21,-1],[-59,17],[-4,-33],[-21,-15],[-52,-6],[-30,-12],[-17,-17],[-13,-18],[-19,-17],[-61,-10],[-39,-33],[-9,-40],[16,-25],[15,-2],[11,36],[23,-16],[16,-30],[3,-28],[-14,-13],[-16,-9],[-22,-23],[-18,-28],[-5,-25],[14,-9],[27,-22],[17,-23],[-19,-10],[-4,-12],[-69,-64],[42,-85],[-3,-34],[-50,-20],[23,-18],[11,-20],[7,-23],[5,-8]],[[6798,2945],[-390,91]],[[6408,3036],[11,3],[1,7],[-5,12],[-4,9],[-7,6],[-8,0],[-17,-2],[-7,2],[-2,5],[15,30],[6,5],[7,8],[5,12],[4,24],[5,12],[2,10],[-3,9],[-17,15],[-1,5],[9,4],[5,5],[1,5],[-6,3],[-19,0],[-7,4],[-3,7],[1,15],[-1,10],[-8,6],[-9,2],[-7,5],[-1,6],[5,8],[6,2],[5,6],[-1,12],[-9,25],[-8,12],[-10,6],[-26,6],[-8,-1],[-15,-6],[-9,-3],[-9,0],[-7,4],[-5,9],[1,22],[3,17],[7,24],[2,24],[3,7],[10,3],[25,-4],[7,3],[4,6],[-3,12],[-5,8],[-3,8],[-1,15],[-4,5],[-6,5],[1,6],[4,5],[43,10],[-113,39],[-7,1],[-8,-2],[-8,0],[-23,4],[-8,-1],[-8,-1],[-8,-3],[-7,-5],[-12,-9],[-7,-4],[-9,-2],[-20,-1],[-9,-2],[-6,-4],[-1,-6],[0,-7],[-2,-7],[-6,-4],[-8,-1],[-9,2],[-9,4],[-9,7],[-9,13],[0,15],[4,4],[5,4],[1,6],[-1,8],[-2,7],[-5,5],[-10,3],[-11,5],[-21,22],[-4,11],[1,19],[10,18],[4,19],[5,6],[1,8],[-4,9],[-17,11],[-13,11],[-9,6],[-7,22],[21,64],[6,36],[0,7],[2,8],[37,18],[13,-6],[8,-2],[12,0],[150,65],[14,8],[6,6],[6,7],[4,11],[-1,12],[-10,22],[-1,11],[0,10],[11,24],[3,12],[1,9],[-15,37],[-15,35],[0,2],[-1,7],[1,8],[5,8],[22,19],[50,76],[4,15],[14,30],[84,258],[-1,18],[-37,196],[2,17],[7,16],[27,15],[21,9],[43,11],[63,-1],[-5,24],[-3,10],[-40,72]],[[5389,1327],[1,-2],[11,7],[9,2],[23,3],[0,-12],[-12,-13],[-39,-18],[-16,-10],[0,31],[-23,-65],[-11,-21],[-55,76],[-12,0],[-1,-5],[1,-16],[-22,10],[24,-44],[67,-29],[81,-8],[64,16],[-26,19],[-28,0],[-29,-5],[-30,8],[0,10],[17,-1],[13,2],[12,5],[13,6],[9,7],[20,20],[7,5],[24,-5],[27,-13],[27,-7],[22,14],[20,-11],[20,-4],[17,6],[10,20],[-30,-4],[-13,12],[-11,17],[-24,7],[0,11],[22,-11],[55,8],[99,-56],[42,11],[23,17],[22,4],[56,-6],[7,-12],[9,-27],[14,-29],[21,-18],[-414,-12],[-64,-23],[-219,-11]],[[8426,2340],[0,-10],[4,-38],[12,-17],[18,-10],[21,-15]],[[8481,2250],[25,-31],[7,-13],[-1,-8],[-6,-12],[-19,-20],[-5,-12],[-9,-123],[2,-16],[6,-7],[8,-4],[7,-4],[5,-7],[3,-7],[3,-13],[9,-70],[4,-12],[3,-7],[3,-8],[0,-13],[-2,-15],[-15,-42],[-31,-66],[-5,-17],[-1,-37],[12,-112],[-13,-70],[0,-9],[1,-8],[2,-8],[3,-8],[4,-6],[5,-6],[31,-24],[6,-6],[4,-6],[3,-7],[3,-8],[0,-9],[-41,-35],[-182,-90]],[[8310,1274],[-152,31],[-77,4],[-51,10],[-13,4],[-6,8],[3,15],[4,11],[-3,11],[-16,13],[12,20],[-16,-13],[-14,-20],[-9,-23],[-4,-20],[-12,0],[-20,11],[-32,3],[-66,-2],[-22,6],[-74,38],[-114,14],[-51,15],[-25,35],[31,-10],[34,4],[30,14],[18,24],[24,-28],[12,-11],[13,-5],[11,4],[5,10],[-2,11],[-8,9],[0,10],[22,-5],[57,-22],[11,0],[17,5],[37,-14],[59,-30],[-4,10],[-3,16],[-4,8],[25,-1],[44,-5],[18,6],[22,25],[-11,14],[-21,11],[-11,19],[-19,52],[-3,23],[-6,12],[-14,9],[-18,2],[-17,-7],[-11,7],[-15,5],[-14,-3],[-6,-14],[5,-9],[35,-23],[41,-54],[25,-25],[28,-12],[-15,-20],[-25,2],[-27,6],[-21,-10],[-13,0],[-20,23],[-15,7],[-17,-1],[-26,3],[-17,6],[-19,10],[-15,16],[-5,20],[-7,-7],[-10,-7],[-5,-6],[-7,13],[-4,12],[-2,13],[1,16],[-11,0],[-2,-22],[-8,-19],[-14,-9],[-20,7],[-12,-9],[-18,-3],[-20,3],[-18,9],[-38,-6],[-19,-5],[16,-14],[26,-6],[27,2],[21,8],[23,-22],[-22,-16],[-28,-16],[-30,-6],[-27,12],[-20,11],[-36,15],[-34,10],[-15,-5],[-14,-14],[-30,8],[-47,23],[-21,-6],[-18,-11],[-17,-5],[-23,11],[-9,-10],[-11,0],[-12,8],[-12,13],[-44,-29],[-22,-8],[-24,5],[3,7],[5,18],[3,7],[-42,8],[-18,-3],[-19,-16],[-12,10],[-15,7],[-12,0],[-10,-25],[-26,-20],[-13,-15],[-12,11],[-19,15],[-21,12],[-15,5],[-18,-9],[-17,-15],[-17,-5],[-16,18],[5,3],[2,1],[1,1],[4,6],[-61,-3],[-23,-11],[-6,-29],[15,7],[14,-2],[10,-10],[6,-17],[-31,7],[-116,5],[-6,15],[-8,13],[-18,25],[-10,-15],[0,-13],[6,-9],[14,-6],[0,-10],[-30,-5],[-22,-10],[-38,-29],[-30,19],[-35,-2],[-30,-13],[-16,-14],[-12,0],[-10,4],[-15,8],[-12,10],[-7,10],[19,8],[16,-2],[18,-5],[24,-1],[-4,15],[-5,10],[-9,5],[-15,2],[0,12],[17,7],[11,11],[5,15],[0,19],[-10,0],[-20,-36],[-28,-19],[-34,-8],[-42,-1],[44,-32],[-33,-28],[-60,-24],[-40,-23],[-11,-23],[3,-15],[15,-9],[26,-7],[29,-1],[29,5],[17,11],[-8,16],[0,12],[41,11],[21,11],[7,-7],[8,-11],[13,-4],[21,5],[33,14],[25,2],[50,0],[16,-3],[10,-7],[7,-7],[6,-4],[24,-3],[17,2],[38,12],[-17,-2],[-20,1],[-15,8],[-5,14],[10,8],[57,14],[0,-22],[13,0],[36,17],[96,-6],[47,21],[8,-23],[13,9],[13,22],[11,14],[30,-1],[25,-12],[23,-5],[21,18],[31,-12],[32,5],[33,11],[67,12],[42,22],[26,6],[202,5],[51,-17],[-16,-7],[-16,-3],[-17,-1],[-18,1],[122,-54],[-511,-40],[-512,-40],[-268,-58],[-148,-12],[-29,-12],[-17,9],[-20,3],[-88,2],[-21,-2],[0,10],[5,0],[11,-1],[5,1],[0,10],[-45,0],[-11,18],[0,29],[-11,29],[22,24],[-21,5],[-89,-11],[-30,-8],[-27,-14],[-22,-18],[-27,22],[-48,23],[-54,11],[-50,-13],[-6,7],[-11,8],[-3,4]],[[5567,3169],[29,18],[8,4],[9,0],[14,-6],[252,-196],[30,-16],[54,-9],[44,-1],[16,3],[100,28],[14,1],[23,-2],[25,-5],[8,-3],[14,-4],[9,-1],[16,-5],[51,-3],[47,3],[38,16],[40,45]],[[1964,2011],[-21,41],[-30,123],[1,57],[11,67],[-7,54],[-53,22],[-5,-47],[-8,-25],[-13,-12],[-15,9],[-8,22],[-11,20],[-26,5],[6,26],[-13,-5],[-20,-16],[-19,-9],[-11,6],[-22,26],[-13,11],[14,16],[-9,10],[-35,15],[-4,1],[-34,17],[-3,6],[-29,4],[-24,19],[-18,20],[-10,8],[-18,-21],[-19,-31],[-23,-11],[-29,39],[-20,19],[-65,32],[-21,25],[-2,12],[1,44],[4,7],[15,8],[3,9],[-3,10],[-9,4],[-8,2],[-6,6],[-5,35],[-7,15],[-15,14],[-15,1],[-21,-6],[-15,-8],[-1,-7],[-18,22],[-4,32],[4,35],[7,33],[22,60],[-4,22],[-25,29],[-73,56],[-6,8],[-4,18],[-3,5],[-10,3],[-8,-2],[-7,-3],[-8,2],[-106,23],[-27,18],[-28,6],[-44,-1],[-76,-10],[-19,-8],[-37,-19],[-22,-5],[-27,0],[-14,4],[-11,8],[-17,10],[-20,7],[-127,27],[-15,5],[-2,7],[0,10],[-2,13],[-8,13],[-12,6],[-7,-5],[-5,-7],[-8,-1],[-18,15],[-15,17],[-17,7],[-22,-17],[-17,7],[-20,1],[-20,-8],[-18,-16],[-19,19],[6,9],[15,8],[8,14],[-4,12],[-14,29],[-3,15],[8,26],[12,10],[2,9],[-21,23],[-51,26],[-19,24],[-11,6],[-8,-13],[-7,-29],[-13,-29],[-20,-16],[-30,10],[-49,62],[-18,15],[-19,6],[-39,-2],[-16,4],[-28,1],[40,49],[8,3],[20,4],[7,4],[4,7],[7,21],[-2,3],[2,0],[27,15],[4,0],[22,25],[118,90],[33,34]],[[9033,4246],[-1,0],[-20,-12],[-189,-309],[-27,-60],[-2,-57],[7,-16],[20,-25],[22,-41],[4,-10],[-32,-86],[-9,-10],[-30,-16],[-12,-17],[-2,-26],[129,-553],[20,-23]],[[8911,2985],[-1,0],[-64,-112],[-16,-40],[0,-9],[6,-32],[2,-18],[-4,-15],[-3,-10],[-5,-7],[-11,-11],[-15,-12],[-16,-25],[-98,-227],[-119,-187],[-5,-6],[-7,-4],[-8,-4],[-66,-16]],[[8889,1235],[35,-11],[7,0],[7,4],[14,-10],[24,-21],[22,-2],[5,2],[-7,-26],[-1,0],[-72,16],[-160,15],[-24,11],[7,22],[31,27],[31,22],[44,-11],[12,-8],[4,-9],[3,-9],[4,-6],[14,-6]],[[8911,2985],[4,-5],[48,-42],[35,-88],[50,-261],[24,-56],[63,-110],[20,-57],[4,-56],[-16,-179],[106,9],[-17,-98],[9,-41],[39,-20],[32,3],[53,31],[27,10],[116,-28],[21,-17],[13,-20],[6,-25],[4,-83],[29,-112],[45,-100],[7,-28],[-4,-27],[-16,-20],[-22,-4],[-55,10],[-11,-97],[5,-22],[22,-31],[8,-18],[-1,-13],[-7,-33],[1,-14],[5,-6],[22,-18],[9,-10],[-16,-29],[-23,-16],[-38,-5],[-65,2],[-4,44],[-54,7],[-67,-8],[-43,1],[13,-32],[-8,-31],[-24,-25],[-32,-9],[-26,7],[-86,38],[-27,20],[-33,-9],[-65,-1],[-27,-12],[-13,29],[-25,36],[-30,30],[-27,12],[-13,12],[18,25],[25,22],[10,6],[8,22],[4,46],[10,18],[23,14],[17,4],[11,10],[4,31],[-4,23],[-10,11],[-20,3],[-27,0],[-7,-3],[-10,-8],[-12,-7],[-15,-4],[-14,2],[-22,9],[-14,1],[-16,-6],[-32,-20],[-20,-7],[16,-36],[8,-32],[-12,-22],[-46,-5],[7,-12],[0,-12],[-6,-10],[-12,-10],[15,-10],[7,-2],[-11,0],[16,-6],[17,-3],[17,-2],[18,1],[0,-10],[-15,-7],[-25,2],[-17,-5],[-14,-10],[-12,-14],[-11,-15],[-7,-17],[-18,12],[-11,-6],[3,-14],[26,-12],[-10,-21],[10,-12],[20,-7],[24,-4],[-59,-45],[-108,5],[-263,53]]],"transform":{"scale":[0.0006113003065127525,0.0006383054884488428],"translate":[-8.618719848820945,4.34406159100007]}};
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
