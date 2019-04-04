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
  Datamap.prototype.civTopo = '__CIV__';
  Datamap.prototype.clpTopo = '__CLP__';
  Datamap.prototype.cmrTopo = {"type":"Topology","objects":{"cmr":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Extrême-Nord"},"id":"CM.EN","arcs":[[0,1]]},{"type":"MultiPolygon","properties":{"name":"Littoral"},"id":"CM.LT","arcs":[[[2,3]],[[4,5,6,7,8]]]},{"type":"Polygon","properties":{"name":"Nord-Ouest"},"id":"CM.NW","arcs":[[9,10,11,12]]},{"type":"Polygon","properties":{"name":"Centre"},"id":"CM.CE","arcs":[[13,14,-5,15,16]]},{"type":"Polygon","properties":{"name":"Est"},"id":"CM.ES","arcs":[[17,18,-14,19]]},{"type":"Polygon","properties":{"name":"Adamaoua"},"id":"CM.AD","arcs":[[20,-20,-17,21,-10,22,23]]},{"type":"Polygon","properties":{"name":"Nord"},"id":"CM.NO","arcs":[[24,-24,25,-1]]},{"type":"Polygon","properties":{"name":"Ouest"},"id":"CM.OU","arcs":[[-16,-9,26,-11,-22]]},{"type":"Polygon","properties":{"name":"Sud-Ouest"},"id":"CM.SW","arcs":[[-27,-8,27,-3,28,-12]]},{"type":"Polygon","properties":{"name":"Sud"},"id":"CM.SU","arcs":[[-19,29,-6,-15]]}]}},"arcs":[[[7388,7285],[-2,2],[12,53],[-13,14],[-120,24],[-21,0],[-39,6],[-26,24],[-42,19],[-5,4],[-32,32],[-18,7],[-42,10],[-70,9],[-27,1],[-53,-4],[-51,4],[-82,11],[-20,-1],[-19,-4],[-22,-12],[-11,-10],[-6,-11],[0,-9],[6,-10],[19,-19],[6,-9],[-6,-9],[-16,-7],[-83,-18],[-31,-9],[-19,-5],[-26,3],[-47,0],[-63,-13],[-16,0],[-16,5],[-12,7],[-26,29],[-4,6]],[[6345,7405],[12,5],[27,14],[16,13],[20,30],[3,11],[-2,10],[-9,18],[0,12],[29,54],[45,165],[48,110],[36,50],[231,220],[7,11],[10,13],[-9,34],[6,18],[14,15],[21,11],[50,19],[15,14],[22,35],[31,37],[43,36],[49,33],[50,27],[40,0],[51,-10],[91,-26],[27,-2],[29,4],[28,10],[23,11],[35,25],[16,4],[35,3],[10,3],[116,71],[25,9],[76,16],[28,11],[47,28],[28,11],[67,16],[22,8],[15,16],[14,21],[10,22],[5,18],[-1,22],[-7,18],[-15,15],[-21,14],[-7,6],[-4,6],[-6,6],[-9,4],[-23,-1],[-5,2],[-12,10],[-1,8],[6,8],[47,41],[10,15],[28,89],[14,28],[5,29],[0,6],[-2,10],[-25,38],[-2,17],[23,10],[-3,9],[22,63],[8,10],[6,5],[4,6],[25,16],[-2,10],[-7,8],[-15,6],[-11,-3],[-18,-6],[-17,-4],[-7,4],[-9,18],[-20,11],[-26,9],[-26,12],[13,5],[5,1],[0,7],[-14,4],[-39,19],[-9,6],[-3,8],[7,13],[-4,9],[-36,13],[-83,13],[-266,5],[-20,3],[-18,7],[-11,13],[-1,11],[7,26],[1,17],[-7,15],[-2,4],[-2,67],[-73,233],[-73,233],[459,3],[22,-9],[60,-62],[1,-1],[18,-13],[11,-13],[4,-15],[-2,-17],[-20,-40],[-1,-12],[14,-12],[39,-20],[24,-16],[0,-33],[2,-8],[5,-4],[8,-1],[11,3],[0,-8],[2,-8],[6,-5],[12,1],[25,13],[9,1],[10,-3],[2,-4],[1,-6],[4,-5],[23,-9],[8,-6],[22,-8],[38,7],[21,-5],[9,-14],[-20,-29],[16,-14],[19,22],[7,2],[12,-3],[11,-7],[9,-9],[4,-8],[9,-14],[23,-2],[43,7],[15,-18],[42,-107],[-4,-5],[-11,-14],[-2,-5],[-1,-10],[2,-2],[6,0],[10,-7],[-2,4],[5,1],[9,-2],[6,-3],[2,-3],[-3,-10],[1,-4],[18,-22],[22,-66],[-2,-8],[-2,-60],[0,-1],[-3,-10],[-6,-15],[0,-11],[4,-6],[6,-4],[6,-4],[1,-9],[-5,-6],[-10,-2],[-6,-4],[4,-12],[6,-6],[34,-16],[28,-22],[19,-9],[15,1],[22,11],[24,2],[24,-7],[24,-14],[-6,-5],[-5,-10],[0,-10],[7,-9],[9,-7],[1,-5],[-3,-7],[-3,-11],[14,-12],[22,-13],[6,-10],[-38,-4],[-5,-4],[3,-8],[6,-9],[5,-5],[6,-9],[-9,-7],[-13,-8],[-6,-6],[3,-22],[8,-14],[16,-7],[22,-2],[8,-10],[32,-50],[-7,-9],[-21,-13],[-7,-8],[2,-4],[14,-9],[1,-5],[-5,-5],[-9,0],[-8,0],[-5,-1],[-10,-18],[-2,-18],[3,-17],[21,-39],[14,-16],[36,-30],[15,-29],[-17,-24],[-60,-43],[-12,-16],[-8,-17],[-8,-46],[-7,-13],[0,-10],[4,-7],[7,-3],[6,-5],[1,-9],[-9,-14],[-30,-29],[-6,-14],[-9,-54],[10,-90],[8,-75],[35,-56],[14,-13],[8,-15],[-5,-22],[-16,-37],[4,-33],[99,-128],[10,-21],[-2,-14],[-13,-15],[-8,-21],[-1,-22],[9,-17],[8,-4],[12,-4],[14,-3],[15,-1],[13,-2],[9,-4],[6,-4],[27,-8],[11,-15],[18,-32],[19,-14],[17,-10],[13,-10],[5,-17],[2,-23],[8,-17],[15,-15],[178,-111],[49,-46],[18,-7],[0,-4],[59,-35],[87,-34],[45,-10],[57,-34],[-23,-4],[-291,-48],[-74,-1],[-218,47],[-77,2],[-59,-4],[-12,-3],[-15,-6],[-23,-14],[-13,-6],[-37,-5],[-40,2],[-75,12],[-60,1],[-163,-34],[-52,2],[-379,63],[-317,-14]],[[1073,1984],[43,27],[23,9],[13,2],[4,3],[2,4],[3,8],[14,22],[51,57],[4,4]],[[1230,2120],[6,-5],[10,-3],[12,-2],[13,-5],[2,-4],[13,-21],[15,-11],[21,-11],[12,-15],[-18,-16],[-19,5],[-9,1],[-9,2],[-17,9],[-17,19],[-8,4],[-5,2],[-4,3],[-1,8],[-16,-1],[-11,-3],[-7,-7],[-2,-9],[35,-14],[9,-8],[3,-10],[-3,-7],[-5,-9],[-3,-12],[4,-7],[20,-8],[11,-6],[-17,-5],[-21,-4],[-47,-3],[-24,2],[-44,8],[-21,2],[-15,5]],[[2594,2847],[-25,-38],[-27,-22],[-44,-24],[-53,-18],[-11,-7],[-11,-17],[-10,-47],[10,-5],[12,-2],[64,26],[43,14],[30,3],[14,-13],[5,-12],[2,-11],[-1,-11],[-5,-15],[-5,-9],[-9,-9],[-57,-39],[-50,-56],[-10,-16],[-5,-13],[1,-9],[2,-5],[2,-4],[6,-3],[11,-4],[15,0],[14,3],[15,1],[14,-2],[24,-14],[13,-5],[11,-1],[13,0],[10,-1],[13,-5],[14,-6],[11,-7],[15,-7],[52,-5],[17,3],[18,6],[52,33],[21,6],[18,10],[4,5],[8,7],[13,8],[10,-3],[5,-6],[3,-11],[10,-7],[21,-6],[39,25],[15,23],[14,45],[6,13],[12,8],[15,5],[16,1],[16,-2],[14,-4],[14,-1],[11,2],[24,8],[14,1],[12,-1],[11,-5],[5,-24],[-8,-82],[43,-74],[64,-72],[134,-82],[6,-5],[12,-12],[-31,-19],[-40,-18],[-11,-4],[-10,-3],[-70,-12],[-16,-6],[-17,-11],[-22,3],[-50,-16],[-60,-9],[-47,-16],[-25,-5],[-30,1],[-15,-1],[-10,-3],[-6,-3],[-9,-3],[-14,-2],[-8,-2],[-17,-8],[-11,-2],[-11,-12],[-14,-15],[-12,-18],[-30,-33],[-13,-19],[-8,-15],[0,-11],[8,-23],[1,-12],[0,-8],[-13,-34],[3,-23],[-13,-26],[-10,-11],[-10,-10],[-14,-7],[-14,-2],[-14,3],[-12,8],[-22,20],[-15,10],[-18,8],[-43,7],[-13,3],[-8,4],[-12,7],[-10,7],[-17,10],[-71,-23],[-30,-20],[-16,-21],[-4,-11],[-9,-41],[-27,-48],[-7,-14],[-5,-42],[-5,-4],[-3,-3],[-5,-2],[-12,-5],[-33,-19],[-6,-3],[-9,-2],[-4,-1],[-5,0],[-4,0],[-6,0],[-6,2],[-5,1],[-9,5]],[[2262,1662],[-9,18],[-22,11],[-24,10],[-19,5],[-3,-1],[-2,-1],[-9,-6],[-3,-2],[-3,-1],[-6,-1],[-30,-3],[-8,-2],[-8,-2],[-5,-2],[-3,-2],[-8,-5],[-8,-7],[-4,-4],[-5,-7],[-19,-18],[-9,-7],[-23,-13],[-4,-2],[-3,-4],[-5,-14],[-1,-18],[1,-11],[6,-13],[0,-2],[0,-3],[-3,-3],[-3,-4],[-12,-8],[-2,-3],[-1,-3],[2,-9],[0,-5],[-2,-2],[-1,-3],[-31,-37],[-5,-4],[-8,-5],[-34,-13],[-14,-9],[-13,-8],[-12,-11],[-8,-5],[-8,-4],[-22,-6]],[[1849,1413],[0,2],[-20,-1],[-14,2],[-11,5],[-9,6],[-8,8],[-34,43],[-97,82],[-54,31],[-126,58],[29,4],[31,11],[107,55],[29,7],[34,1],[-41,8],[-36,-10],[-34,-14],[-35,-8],[-89,-6],[-16,5],[-6,12],[6,12],[21,7],[-38,61],[-62,58],[-18,22],[-7,21],[33,-22],[7,-2],[6,-4],[11,-19],[6,-7],[16,-5],[23,-2],[50,0],[-13,5],[-41,8],[-13,5],[-5,3],[-4,5],[-9,8],[-11,18],[4,22],[15,21],[23,14],[49,-30],[27,-4],[13,21],[44,-14],[16,-9],[11,-12],[8,9],[0,9],[-6,9],[-10,8],[4,1],[14,-1],[-61,15],[-29,12],[-9,16],[17,12],[34,7],[36,4],[28,1],[0,4],[-2,2],[-6,6],[3,1],[3,0],[2,1],[0,4],[-129,-15],[-40,3],[-20,15],[6,22],[21,20],[25,9],[22,13],[56,58],[38,13],[5,4],[6,9],[-3,5],[-21,-6],[-25,-12],[-11,-8],[-9,-10],[-9,0],[0,18],[-23,-12],[-42,-44],[-24,-17],[-28,-10],[-35,-6],[-26,3],[0,20],[-18,-12],[-25,9],[-23,16],[-13,20],[7,21],[-2,1]],[[1295,2142],[9,2],[9,3],[11,7],[14,18],[9,8],[18,10],[7,7],[-1,9],[-11,20],[-10,9],[-18,9],[-92,11],[-27,10],[3,23],[7,25],[90,96],[7,19],[-12,24],[-3,13],[7,50],[8,24],[42,49],[21,20],[10,6],[30,0],[17,-3],[10,1],[12,3],[10,8],[8,29],[37,35],[34,19],[14,21],[0,22],[2,10],[6,14],[13,13],[42,26],[24,22],[13,8],[9,9],[2,10],[-29,20],[-9,12],[4,12],[10,22],[17,27],[22,18],[46,6],[13,10],[-4,16],[-25,38],[-18,21],[-49,40],[-22,35],[-10,33],[-1,9],[6,8],[11,1],[14,0],[15,2],[16,6],[45,36],[44,7]],[[1772,3240],[-9,-64],[21,-19],[14,-1],[13,3],[12,6],[13,6],[15,1],[17,-4],[43,-21],[9,-7],[4,-7],[4,-14],[18,-23],[2,-36],[-14,-20],[2,-4],[2,-4],[9,-12],[9,-16],[5,-8],[6,-5],[49,-18],[5,-5],[3,-7],[6,-23],[4,-10],[2,-2],[6,-5],[11,-6],[6,-2],[18,-12],[8,-29],[11,-8],[6,-1],[5,-1],[4,0],[8,1],[5,1],[13,1],[33,47],[9,8],[7,7],[48,22],[17,10],[9,12],[6,12],[12,14],[13,2],[15,-2],[14,-3],[14,-2],[14,2],[28,6],[15,3],[36,2],[17,-14],[10,-31],[15,-14],[11,-16],[23,-42],[15,-10],[29,-7],[12,-10],[11,-7],[24,-7]],[[3501,4185],[9,-45],[-2,-25],[-14,-38],[-12,-20]],[[3482,4057],[-49,-33],[-17,-6],[-25,-7],[-18,-2],[-16,0],[-104,7],[-9,-20],[8,-41],[-18,-56],[-10,-13],[-12,-10],[-15,-9],[-60,-22],[-59,-13],[-28,-3],[-22,-20],[-56,9],[-92,12],[-18,-2],[-21,-5],[-8,-6],[-6,-9],[-51,-82],[-53,-59],[-12,-5],[-29,-7],[-69,4],[-23,0],[-229,-28],[-21,-54],[-11,-9],[-15,-8],[-13,3],[-9,7],[-7,9],[-8,9],[-12,7],[-14,4],[-62,11],[-20,2],[-14,-2],[-11,-4],[-79,-41]],[[2065,3565],[-40,9],[-65,10],[-50,11],[-74,-26],[-81,26],[-76,15],[-38,13],[-16,12],[-12,10],[-11,15],[-7,6],[-13,3],[-34,-4],[-30,6],[-32,29],[-14,10],[-14,5],[-14,4],[-11,8],[-5,12],[15,44],[-13,12],[-9,5],[-2,2],[-2,0],[-1,1],[-1,2],[-4,6],[6,12],[17,14],[126,53],[31,26],[27,5],[12,-4],[15,-1],[13,3],[10,10],[7,15],[-1,28],[8,18],[6,45],[-63,136],[-13,18],[-17,36],[-32,34],[-20,11]],[[1543,4270],[99,210],[24,18],[31,-1],[25,-9],[25,-5],[31,9],[318,181],[30,11],[18,-2],[11,-14],[19,-65],[13,-17],[27,-14],[36,-7],[334,3],[1,20],[6,13],[10,12],[16,15],[8,4],[8,1],[5,3],[8,67],[11,33],[16,31],[19,25],[24,-21],[7,-43],[23,-12],[34,-8],[91,-32],[107,-27],[43,-19],[21,-35],[12,-40],[26,-38],[41,-28],[121,-15],[44,-23],[25,-36],[4,-41],[-2,-35],[4,-34],[22,-68],[26,-41],[21,-14],[35,-3],[80,6]],[[5683,3803],[-4,-11],[-2,-15],[5,-18],[1,-9],[-9,-29],[1,-4],[4,-8],[7,-10],[35,-26],[32,-33],[10,-13],[18,-40],[7,-9],[8,-9],[34,-26],[5,-5],[5,-7],[4,-13],[19,-33],[26,-29],[13,-21],[21,-20],[3,-14],[-7,-23],[-56,-93],[-62,-71],[-9,-7],[-16,-5],[-21,-3],[-82,2],[-66,-12],[14,-15],[88,-46],[146,-103],[17,-16],[24,-30],[8,-17],[1,-14],[-6,-20],[-3,-5],[-1,-8],[3,-8],[16,-7],[67,-17],[15,-2],[16,-1],[30,-1],[16,-5],[20,-14],[47,-64],[19,-33],[-36,-196],[-12,-14],[-11,-4],[-14,0],[-29,6],[-15,1],[-14,-1],[-30,-7],[-16,-3],[-15,1],[-31,6],[-15,1],[-35,-3],[-18,0],[-15,2],[-10,1],[-11,3],[-10,2],[-10,0],[-14,-1],[-15,-4],[-61,-25],[-16,-12],[-15,-18],[-20,-35],[-21,-59],[-17,-22],[-43,-23],[14,-29],[2,-10],[1,-11],[-11,-36],[-46,-100],[1,-14],[14,-17],[14,-15],[5,-7],[1,-9],[-5,-10],[-10,-8],[-25,-9],[-14,-2],[-20,-6],[-8,-3],[-8,-5],[-27,-16],[-10,-10],[-2,-3],[-1,-1],[-29,-16],[-4,-3],[-3,-3],[-2,-2],[-2,-1],[-4,-1],[-6,-2],[-29,1],[-78,-21],[-9,-1],[-9,-3],[-6,-5],[-8,-9],[-11,-11],[-22,-7],[-9,-1],[-4,-1],[-8,-5],[-6,-9],[-1,-11],[3,-11],[17,-24],[26,-17],[78,-23],[11,-6],[6,-11],[-3,-16],[2,-51],[-3,-22],[-12,-27],[-39,-53]],[[5276,1666],[-20,14],[-27,23],[-31,42],[-9,7],[-6,4],[-11,4],[-14,-1],[-16,-5],[-72,-52],[-138,-74],[-45,-32],[-16,-19],[-45,-111],[-25,-11],[-63,-12],[-22,-2],[-15,3],[-3,10],[4,6],[2,2],[7,11],[-2,7],[-19,9],[-146,47],[-30,14],[-16,6],[-46,7],[-22,11],[-24,8],[-42,-55],[-10,-8],[-59,-22],[-25,-12],[-16,-6],[-29,-5],[-13,-9],[-42,-50],[-10,-24],[-20,-33],[-14,-7],[-97,-31],[-62,-13],[-30,-2],[-203,1],[-53,-8],[-22,-2],[-54,7],[-36,-2],[-48,-6],[-55,38],[-16,9],[-7,8],[-6,25],[-6,10],[-12,5],[-13,3],[-15,7],[-14,13],[-21,65],[-14,23],[-38,32],[-17,8],[-14,0],[-41,-4],[-15,-1],[-11,5],[-19,5],[-30,4],[-61,-6],[-55,-2],[-7,4],[-5,20],[-7,19],[-6,6],[-11,5],[-23,3],[-29,-1],[-84,-12],[-34,-6],[-408,-81],[-103,-11],[-9,3],[-65,143],[12,28]],[[2594,2847],[97,-11],[18,0],[20,3],[179,58],[13,6],[13,8],[7,8],[4,6],[2,2],[2,2],[4,4],[10,6],[13,2],[18,-4],[16,-7],[55,-36],[17,-3],[28,-2],[31,0],[15,4],[13,8],[14,23],[3,7],[27,48],[13,30],[4,21],[5,11],[8,12],[19,16],[22,12],[34,11],[27,6],[-6,11],[-3,7],[-1,10],[1,7],[10,25],[0,5],[-5,20],[0,11],[3,6],[6,7],[16,10],[10,3],[10,3],[8,0],[7,1],[5,2],[7,5],[33,36],[3,1],[19,5],[5,3],[3,4],[5,9],[4,6],[2,6],[0,4],[-18,16],[16,16],[4,3],[5,6],[5,6],[12,25],[2,15],[-1,32],[-3,9],[-3,4],[-13,15],[-2,4],[-1,6],[-4,10],[10,13],[17,15],[10,14],[-11,12],[29,10],[12,8],[9,16],[10,3],[12,2],[9,3],[7,7],[24,33],[19,6],[4,5],[-5,12],[-13,2],[-14,-2],[-12,3],[-9,11],[1,8],[5,9],[3,11],[-3,11],[-5,7],[-7,4],[-4,5],[-2,10],[-1,17],[-6,9],[19,8],[8,14],[-3,13],[-15,6],[12,9],[21,10]],[[3617,3796],[22,8],[12,1],[21,-6],[27,5],[45,16],[294,43],[22,8],[10,4],[30,11],[63,39],[51,21],[24,15],[24,10],[27,3],[26,-1],[26,2],[7,4],[6,4],[9,3],[18,2],[16,4],[17,16],[11,4],[10,-2],[5,-4],[5,-3],[11,2],[1,4],[-2,12],[1,3],[13,3],[35,2],[8,-7],[7,-6],[42,-31],[30,-15],[30,-10],[17,-5],[23,-3],[32,-2],[30,0],[15,2],[14,4],[15,5],[30,12],[22,6],[27,4],[48,0],[26,-3],[22,-6],[166,-82],[13,-8],[9,-9],[6,-10],[3,-9],[4,-7],[6,-6],[22,-16],[9,-8],[5,-6],[30,-8],[135,-2],[333,0]],[[7695,3872],[1,-5],[-6,-8],[-4,-4],[-4,-8],[-6,-3],[-7,0],[-13,7],[-7,-1],[-9,-7],[-4,-6],[3,-7],[10,-11],[11,-7],[15,-12],[19,-10],[19,-14],[9,-14],[6,-15],[10,-14],[21,-10],[22,0],[41,-3],[19,2],[35,14],[16,0],[17,-18],[7,-17],[19,-17],[8,-93],[9,-18],[-8,-12],[-18,-48],[-23,-40],[-4,-13],[2,-15],[7,-12],[18,-21],[8,-14],[2,-11],[-1,-26],[-5,-9],[-19,-25],[-4,-14],[1,-25],[-5,-10],[-17,-5],[-1,-6],[-11,-15],[-13,-13],[-6,-4],[-3,-12],[-7,-15],[-11,-15],[-15,-9],[-11,-2],[5,-10],[21,-15],[27,-12],[56,-13],[27,-8],[21,-14],[14,-18],[9,-21],[6,-19],[0,-44],[6,-34],[-10,-33],[0,-4],[-1,-12],[5,-10],[9,-8],[6,-8],[-3,-23],[4,-9],[8,-9],[7,-10],[19,-83],[-1,-9],[-6,-21],[-6,-10],[-1,-6],[8,-14],[9,-67],[17,-41],[35,-37],[46,-31],[206,-95],[57,-14],[15,-6],[9,-9],[9,-22],[8,-12],[45,-37],[20,-25],[12,-24],[13,-53],[2,-50],[9,-23],[14,-8],[20,1],[20,-5],[8,-12],[4,-12],[8,-6],[18,0],[20,-2],[16,-7],[3,-10],[-26,-7],[-28,-5],[-51,-16],[-26,-4],[-21,2],[-42,7],[-22,0],[76,-122],[113,-111],[105,-76],[13,-9],[87,-62],[110,-78],[135,-97],[128,-92],[122,-87],[97,-69],[10,-4],[10,-2],[16,-2],[6,1],[15,6],[6,1],[8,-1],[14,-6],[5,-1],[56,4],[21,-5],[25,-14],[22,-18],[10,-17],[17,-44],[4,-5],[4,-4],[6,-4],[17,4],[14,2],[13,0],[13,-4],[11,-7],[27,-27],[19,-29],[16,-19],[13,-19],[4,-23],[-11,-21],[-35,-24],[-5,-23],[5,-30],[-1,-12],[5,-7],[13,-1],[17,2],[17,-1],[15,-2],[-12,-12],[-10,-13],[-4,-9],[3,-18],[20,-31],[4,-18],[-6,-17],[-20,-30],[-1,-19],[5,-11],[16,-21],[6,-16],[0,-32],[2,-8],[10,-18],[17,-21],[24,-19],[9,-9],[5,-8],[2,-8],[2,-18],[4,-4],[18,-8],[5,-3],[0,-7],[-7,-11],[-2,-9],[17,-6],[5,-3],[7,-4],[7,-8],[-11,-9],[-52,-26],[-24,15],[-26,3],[-21,-8],[-9,-20],[-15,-19],[-3,-10],[2,-11],[6,-8],[3,-8],[-2,-13],[-3,0],[-5,-1],[-6,-1],[-4,-4],[-2,-5],[0,-4],[1,-2],[1,0],[2,-8],[4,-7],[0,-8],[-19,-18],[-4,-9],[2,-32],[5,-5],[8,-2],[11,-7],[23,-27],[44,-76],[31,-97],[-4,-14],[-14,-4],[-28,7],[-12,-3],[-58,-56],[-51,45],[-11,15],[0,9],[4,8],[2,9],[-6,10],[-11,6],[-14,4],[-16,0],[-13,-4],[-22,5],[-26,4],[-19,7],[-4,13],[-14,-5],[-17,-4],[-16,-1],[-6,8],[-3,13],[-9,6],[-13,4],[-31,14],[-34,8],[-17,6],[-49,42],[-10,4],[-30,3],[-16,5],[-14,5],[-5,4],[-124,9],[-110,22],[-57,7],[-57,-5],[-66,-27],[-26,-5],[-25,-9],[-15,-1],[1,2],[-31,9],[-6,0],[-10,8],[-2,3],[2,5],[2,12],[-3,6],[-7,7],[-10,6],[-45,11],[-7,2],[-5,6],[-7,13],[-6,6],[-28,7],[-20,-4],[-17,-5],[-42,10],[-17,-26],[-19,5],[-8,0],[-13,-14],[-21,-14],[-22,-5],[-15,16],[-25,-6],[-20,4],[-62,33],[-12,1],[-11,-21],[-12,-4],[-28,-2],[-51,3],[5,21],[14,25],[-25,12],[-5,8],[-17,17],[-18,13],[-9,-6],[0,-11],[-3,-10],[-9,-8],[-19,-3],[-80,-6],[-4,4],[1,19],[-1,6],[-7,0],[-11,-2],[-14,-1],[-13,3],[8,3],[19,9],[-35,13],[-9,-3],[8,-22],[-19,6],[-25,17],[-19,8],[-33,-1],[-13,4],[11,14],[-31,10],[-43,32],[-33,6],[-7,-6],[-12,-7],[0,-8],[3,-8],[-4,-8],[-11,-3],[-103,-14],[-26,-11],[-8,-2],[-18,3],[-25,15],[-21,8],[-82,8],[-57,-15],[-12,-1],[-137,1],[-206,1],[-232,1],[-210,1]],[[6695,440],[0,1],[-1,2],[-41,598],[-12,54],[-14,-4],[-17,-3],[-15,-6],[-49,-27],[-20,-4],[-2,-6],[14,-14],[-18,3],[-17,5],[-14,1],[-5,-12],[9,-24],[-3,-10],[-19,-4],[-76,0],[-14,3],[-49,20],[-3,4],[-9,7],[-9,2],[-4,-10],[-4,-3],[-9,0],[-19,0],[-11,4],[-25,21],[-12,3],[-13,6],[-12,1],[-12,-10],[1,-7],[16,-27],[9,-9],[-17,0],[-14,1],[-9,5],[-7,22],[-10,7],[-31,8],[3,12],[-13,11],[-19,4],[-16,-10],[-11,4],[-6,1],[-7,-1],[-11,-4],[-16,8],[-21,2],[-18,-3],[-8,-10],[-4,-7],[-9,-3],[-9,3],[-7,16],[-8,0],[-9,-6],[-6,-6],[-19,5],[-58,11],[-17,-1],[-8,1],[-22,16],[-10,4],[-1,-2],[-26,-16],[-17,9],[-19,2],[-43,1],[-18,4],[-24,7],[-30,2],[-5,3],[-4,4],[-9,4],[-25,7],[-6,2],[-39,38],[-4,11],[-4,98],[-12,44],[-21,38],[-48,57],[-34,28],[-91,58],[-41,35],[-15,18],[-6,9],[-3,7],[-1,8],[23,105]],[[5683,3803],[630,0],[511,2],[120,10],[135,35],[19,2],[22,-1],[65,-15],[23,-3],[106,10],[68,6],[123,21],[67,2],[17,5],[8,7],[7,7],[5,5],[9,6],[12,1],[12,-2],[22,-19],[27,-10],[3,0],[1,0]],[[8751,4911],[-29,-17],[-25,-41],[-18,-20],[-6,-10],[-1,-8],[6,-51],[-3,-9],[-11,-9],[-30,-9],[-12,-5],[-14,-15],[-9,-16],[-21,-54],[-43,-76],[-27,-37],[-22,-39],[-10,-13],[-16,-9],[-78,-26],[-21,-9],[-17,-14],[-14,-21],[-149,-226],[-33,-30],[-2,-10],[5,-21],[1,-9],[-3,-10],[-13,-16],[-49,-42],[-21,-11],[-185,-59],[-53,0],[-12,-14],[-20,-17],[-37,-24],[-20,-4],[-30,-20],[-17,-10],[2,-3],[1,-5]],[[3617,3796],[7,18],[21,35],[-1,16],[-7,19],[-21,37],[-7,20],[-3,15],[3,20],[4,10],[13,20],[1,9],[-4,10],[-20,9],[-17,6],[-104,17]],[[3501,4185],[39,2],[7,-1],[14,-6],[9,-1],[8,2],[14,8],[5,2],[14,-1],[28,-4],[14,-1],[33,5],[33,11],[25,16],[8,20],[8,36],[20,30],[34,19],[51,3],[35,13],[31,29],[38,59],[8,23],[4,24],[-7,16],[-28,21],[-9,14],[7,23],[24,22],[80,49],[75,32],[5,5],[4,11],[6,4],[6,1],[13,-1],[15,3],[20,0],[9,2],[7,7],[3,9],[3,8],[20,8],[55,34],[15,6],[17,3],[15,-1],[12,-3],[11,-2],[12,3],[12,20],[-16,22],[-51,37],[-64,63],[-19,10],[-31,4],[-7,5],[10,8],[24,11],[26,17],[80,80],[77,51],[81,53],[35,34],[20,10],[16,10],[5,18],[-18,51],[-2,18],[4,20],[9,18],[46,57],[129,120],[49,34],[8,13],[-4,14],[-9,22],[-7,34],[0,33],[7,22],[53,50],[6,12]],[[4840,5718],[16,-10],[54,-51],[248,-150],[31,-11],[29,-6],[32,-3],[49,-1],[18,-1],[20,-4],[12,-9],[27,-30],[3,-9],[-1,-9],[-7,-9],[-8,-7],[-4,-9],[4,-20],[1,-27],[9,-14],[13,-9],[16,-6],[31,-8],[17,-3],[13,-1],[32,-11],[22,-13],[105,-21],[208,-20],[19,-4],[111,-39],[20,-4],[18,0],[29,3],[30,6],[37,4],[68,-3],[9,11],[4,34],[2,11],[4,8],[14,9],[9,10],[14,5],[91,-13],[36,-18],[13,-11],[22,-13],[22,-8],[28,-8],[69,-30],[17,-2],[13,4],[17,12],[13,6],[46,11],[15,4],[31,13],[18,5],[23,4],[19,-1],[32,-8],[14,-1],[16,1],[148,23],[30,1],[15,-2],[16,-10],[2,-39],[10,-7],[14,-8],[34,-6],[226,-16],[12,-4],[10,-7],[10,-32],[6,-9],[7,-8],[7,-5],[54,-28],[14,-9],[8,-7],[3,-15],[25,-28],[69,-50],[23,-12],[16,-6],[19,-11],[20,-28],[4,-48],[-3,-11],[-4,-11],[3,-14],[10,-8],[14,-5],[16,-2],[32,-1],[94,6],[17,-1],[18,-4],[21,-9],[14,-11],[13,-14],[7,-11],[33,-32],[80,-11],[19,-19],[10,-5],[17,-8],[15,-3],[16,0],[14,1],[15,3],[16,4],[16,5],[97,40],[270,79],[21,5],[21,2],[20,0],[30,2],[20,5],[18,7],[80,47],[29,12],[21,5],[17,1],[15,-2],[11,-3],[3,-1]],[[7388,7285],[-19,-1],[-11,-3],[-3,-7],[0,-8],[-3,-9],[-63,-84],[-41,-37],[-106,-61],[-79,-76],[2,-13],[115,-61],[370,-284],[13,-38],[24,-28],[288,-155],[289,-155],[20,-5],[13,3],[11,1],[11,0],[12,-2],[18,-6],[52,-26],[11,-8],[7,-11],[8,-4],[10,-2],[9,-6],[7,-8],[12,-22],[3,-11],[0,-8],[5,-6],[17,-3],[49,-5],[33,-7],[27,-13],[21,-17],[55,-61],[75,-49],[20,-17],[35,-50],[175,-250],[79,-188],[44,-72],[62,-30],[27,-1],[41,-6],[29,-4],[-1,-89],[-17,-52],[-35,-48],[-53,-46],[-10,-13],[-70,-63],[-5,-14],[25,-16],[-3,-11],[-6,-1],[-24,-1],[-8,-1],[-8,-5],[-11,-15],[-5,-5],[-61,-31],[-100,-38],[-19,-11]],[[4840,5718],[4,7],[1,17],[-20,71],[-3,40],[10,38],[29,28],[29,8],[50,-6],[27,3],[15,7],[11,10],[8,11],[10,9],[39,18],[11,8],[-1,24],[-3,13],[-31,49],[-10,13],[35,-8],[19,-2],[18,2],[20,6],[15,7],[17,5],[23,2],[17,-3],[42,-13],[19,-3],[20,4],[133,47],[23,17],[19,28],[12,24],[9,11],[15,5],[18,-1],[17,-2],[16,0],[17,5],[28,26],[15,37],[29,165],[-9,32],[1,35],[26,42],[60,72],[8,15],[5,16],[1,35],[-10,26],[-13,18],[-37,4],[-6,3],[9,16],[9,4],[76,24],[11,5],[14,9],[38,33],[17,9],[90,26],[102,11],[85,22],[36,62],[7,57],[16,59],[13,21],[12,14],[3,14],[-14,20],[-38,26],[-13,14],[-2,20],[10,18],[30,32],[6,21],[-5,16],[-16,29],[0,17],[23,30],[43,11],[102,8],[24,7],[19,7]],[[1772,3240],[50,25],[54,91],[6,15],[6,38],[12,14],[21,18],[102,59],[58,14],[5,10],[1,7],[-22,34]],[[1295,2142],[-16,12],[-15,-4],[-37,-27],[3,-3]],[[1073,1984],[-23,8],[-15,30],[7,32],[24,21],[0,5],[-32,-5],[-15,-14],[-7,-15],[-45,-28],[-38,5],[-13,-2],[1,16],[2,12],[-3,11],[-18,9],[-16,2],[-23,0],[-23,-2],[-13,-3],[-20,2],[-69,29],[-113,36],[-16,8],[-2,24],[25,53],[3,25],[-40,25],[-31,29],[-23,34],[-31,124],[7,22],[33,39],[13,21],[-29,-22],[-17,-6],[-7,12],[3,11],[6,11],[3,11],[-3,12],[-10,7],[-29,7],[-10,14],[-10,10],[-12,8],[-10,3],[-5,-12],[40,-41],[10,-20],[-8,-13],[-12,-3],[-10,5],[-5,14],[-63,33],[-1,-11],[2,-9],[6,-7],[12,-3],[-18,-21],[-5,-3],[-9,2],[-26,10],[-5,4],[-10,7],[-21,5],[-22,8],[-9,15],[-14,33],[-58,56],[-8,34],[-22,-22],[9,-25],[20,-26],[33,-81],[11,-7],[15,-5],[14,-8],[7,-23],[-27,-10],[-162,-8],[-15,5],[7,10],[16,12],[14,9],[-15,5],[-15,0],[-10,-5],[-8,-19],[-11,-3],[-14,0],[-15,3],[-20,14],[-7,21],[6,15],[21,-2],[6,11],[28,31],[-18,-8],[-16,-1],[-13,8],[-6,14],[3,11],[10,12],[23,18],[37,17],[8,8],[0,10],[-5,11],[-3,10],[8,11],[8,-7],[-4,35],[2,18],[15,7],[6,2],[1,0],[22,14],[-5,13],[-4,12],[-4,19],[12,13],[35,18],[8,15],[51,55],[19,18],[12,17],[19,39],[9,11],[25,26],[13,10],[14,4],[16,2],[13,4],[9,11],[35,119],[-1,9],[-11,22],[-1,11],[8,21],[28,37],[8,20],[0,18],[-5,17],[-2,17],[8,19],[20,17],[24,16],[20,17],[6,21],[-13,24],[-25,17],[-29,15],[-26,17],[-17,22],[10,13],[23,11],[23,19],[5,22],[-11,15],[-14,14],[-2,18],[13,14],[46,21],[18,15],[22,14],[28,-3],[28,-7],[23,2],[5,12],[3,25],[7,6],[20,7],[17,12],[27,27],[120,84],[178,96],[33,31],[37,53],[18,13],[18,7],[15,1],[17,-1],[20,1],[36,15],[40,51],[38,16],[8,2],[52,12],[26,9],[21,14],[30,38],[19,11],[39,6],[16,0],[46,0],[16,8],[1,3]],[[6695,440],[-55,1],[-199,1],[-224,1],[0,22],[5,26],[-5,13],[-13,10],[-19,12],[-20,10],[-15,4],[-9,-2],[-18,-5],[-12,0],[-9,3],[-18,9],[-36,5],[-40,1],[-11,-3],[-15,-7],[-26,-17],[-13,-3],[-55,-5],[-36,11],[-21,3],[-18,-6],[-14,-3],[-23,3],[-39,9],[-13,-8],[-15,-4],[-16,1],[-18,5],[-12,-10],[-25,3],[-30,9],[-22,4],[-16,-4],[-15,-8],[-18,-8],[-27,-4],[-175,18],[-31,8],[-21,10],[-30,-4],[-23,4],[-72,16],[-50,3],[-72,-12],[-23,4],[-43,17],[-16,4],[-12,-1],[-27,-10],[-14,-2],[-25,-3],[-50,-11],[-26,-3],[-56,2],[-53,5],[-23,1],[-77,-4],[-98,4],[-99,-6],[-114,3],[-44,-5],[-20,2],[-67,15],[-26,14],[-13,5],[-18,1],[-16,-2],[-34,-8],[-347,-9],[-2,-8],[6,-11],[2,-12],[-8,-12],[-10,-9],[-8,-10],[-2,-15],[0,-10],[-3,-11],[-5,-10],[-8,-10],[-388,0],[-389,0],[-388,0],[-20,0],[-285,0],[-83,0],[-175,0],[-26,3],[-82,28],[-23,3],[-23,6],[-33,15],[-30,18],[-17,14],[-3,18],[4,18],[-1,17],[-15,14],[17,11],[0,5],[9,15],[5,163],[39,117],[22,36],[5,15],[5,111],[13,39],[20,37],[24,25],[28,23],[16,24],[3,27],[-50,128],[-22,21],[0,5],[12,0],[8,1],[15,5],[0,4]]],"transform":{"scale":[0.0007703437586758741,0.0011427732129212817],"translate":[8.505056186000047,1.654551290000143]}};
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
