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
  Datamap.prototype.cmrTopo = '__CMR__';
  Datamap.prototype.codTopo = '__COD__';
  Datamap.prototype.cogTopo = {"type":"Topology","objects":{"cog":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Cuvette-Ouest"},"id":"CG.CO","arcs":[[0,1,2]]},{"type":"Polygon","properties":{"name":"Bouenza"},"id":"CG.BO","arcs":[[3,4,5,6]]},{"type":"Polygon","properties":{"name":"Likouala"},"id":"CG.LI","arcs":[[7,8,9]]},{"type":"Polygon","properties":{"name":"Sangha"},"id":"CG.SA","arcs":[[10,-3,11,-9]]},{"type":"Polygon","properties":{"name":"Pool"},"id":"CG.PO","arcs":[[12,13,14,-7,15,16]]},{"type":"Polygon","properties":{"name":"Cuvette"},"id":"CG.CU","arcs":[[-8,17,18,19,-1,-11]]},{"type":"Polygon","properties":{"name":"Kouilou"},"id":"CG.KO","arcs":[[20,21,22,23]]},{"type":"Polygon","properties":{"name":"Lékoumou"},"id":"CG.LE","arcs":[[24,-16,-6,25,26]]},{"type":"Polygon","properties":{"name":"Niari"},"id":"CG.NI","arcs":[[-26,-5,27,-21,28]]},{"type":"Polygon","properties":{"name":"Plateaux"},"id":"CG.PL","arcs":[[29,-17,-25,30,-19]]},{"type":"Polygon","properties":{"name":"Brazzaville"},"id":"CG.BR","arcs":[[31,-14]]},{"type":"Polygon","properties":{"name":"Pointe Noire"},"id":"CG.KO","arcs":[[32,-23]]}]}},"arcs":[[[5540,6222],[-31,-39],[-33,-25],[-40,-19],[-51,-20],[-46,-23],[39,-66],[85,-54],[20,-78],[-66,-61],[-98,-28],[-102,-17],[-25,1],[-25,3],[-52,-7],[-46,4],[-44,-5],[-12,-42],[11,-44],[1,-18],[-2,-19],[8,-26],[36,-66],[13,-44],[15,-37],[42,-17],[98,-11],[45,-12],[19,-39],[62,-205],[-9,-39],[-20,-40],[-26,-38],[-75,-65],[-57,-63],[209,-157],[24,-38],[-28,-39],[-24,-50],[-131,-128],[-73,-54],[-99,-19],[-250,-9],[-55,11],[-32,-13],[-32,-26],[-94,-23],[-172,-26]],[[4417,4392],[-6,5],[-9,14],[0,10],[7,19],[1,10],[-4,14],[-15,24],[-38,90],[1,17],[14,24],[6,50],[7,26],[21,28],[23,22],[15,25],[-5,35],[-9,29],[-1,28],[8,28],[54,101],[9,37],[-12,34],[-31,56],[-17,15],[-52,31],[-30,34],[-45,24],[-50,19],[-37,10],[-23,-3],[-21,-9],[-20,-6],[-21,5],[-25,8],[-22,0],[-22,-6],[-23,-11],[-2,43],[-10,47],[-16,46],[-23,40],[-34,29],[-49,20],[-53,7],[-48,-11],[-10,11],[-11,8],[-13,4],[-47,5],[-10,-3],[-5,-7],[-4,-9],[-6,-5],[-17,-5],[-9,-2],[-8,5],[-61,63],[1,33],[14,28],[60,69],[17,19],[13,11],[14,15],[-1,12],[-7,13],[-2,17],[5,11],[19,21],[2,12],[-10,14],[-16,3],[-16,0],[-9,8],[-5,82],[-6,28],[-13,36],[-7,29],[6,27],[45,58],[47,91],[29,26],[98,47],[25,24],[5,24],[-8,23],[-15,24],[40,49],[66,7],[74,-7],[67,3],[18,6],[7,5],[5,6],[99,73],[9,25],[4,59],[38,47],[61,46],[46,47],[-9,53],[-5,14],[10,10],[16,8],[12,10],[3,16],[-10,9],[-32,14],[-25,20],[-23,22],[-18,25],[-15,27],[-21,59],[-18,23],[-63,25],[-21,24],[-11,30],[1,86],[-3,30],[-20,72],[-8,12],[-14,10],[-15,5],[-12,7],[-2,6]],[[4125,7303],[21,10],[22,5],[25,3],[51,11],[7,0],[9,1],[59,-5],[16,2],[25,4],[11,3],[7,2],[9,0],[23,-4],[15,-1],[64,10],[8,-1],[6,-4],[8,-11],[2,-10],[1,-19],[3,-9],[7,-18],[11,-72],[3,-9],[6,-8],[40,-23],[28,-11],[144,-38],[72,-8],[11,2],[10,0],[11,0],[13,-3],[16,-6],[29,-18],[10,-11],[16,-23],[11,-9],[15,-8],[74,-32],[50,-29],[35,-11],[35,-5],[35,-2],[42,2],[10,-1],[9,-3],[16,-17],[4,-4],[9,-4],[38,-14],[11,-5],[7,-4],[1,-2],[17,-31],[3,-11],[0,-3],[-1,-6],[-2,-5],[-3,-5],[-6,-3],[-6,-2],[-16,-2],[-14,-3],[-6,-3],[-5,-4],[-4,-4],[-5,-8],[-3,-3],[-4,-3],[-5,-1],[-5,-2],[-2,-3],[-7,-10],[-4,-3],[-10,-6],[-2,-3],[-2,-3],[0,-7],[4,-19],[4,-12],[3,-5],[18,-24],[3,-11],[0,-9],[-12,-60],[1,-84],[4,-20],[17,-47],[2,-6],[-1,-7],[-1,-6],[-18,-23],[-2,-4],[-1,-3],[0,-2],[-1,-12],[0,-14],[5,-28],[1,-6],[3,-6],[5,-5],[9,-4],[69,-21],[6,-3],[5,-4],[9,-5],[3,-5],[0,-6],[3,-5],[8,-4],[21,-6],[13,-7],[-2,-7],[1,-5],[3,-4],[6,-4],[12,1],[42,-10],[7,-3],[6,-4],[3,-5],[1,-7],[1,-7],[1,-6],[4,-3],[6,4],[4,4],[3,1],[5,0],[3,-2]],[[3707,607],[-1,0],[-37,-2],[-12,3],[-15,11],[-19,30],[-12,14],[-30,16],[-27,3],[-84,-26],[-15,-7],[-6,-13],[15,-111],[-5,-22],[-21,-46],[-5,-25],[18,-49],[-9,-10],[-10,1],[-11,2],[-10,-5],[-6,-12],[4,-21],[-7,-8],[-12,-1],[-30,7],[-13,1],[-28,-16],[-29,-46],[-15,-4]],[[3275,271],[-1,5],[-6,33],[-3,9],[-5,8],[-8,9],[-14,10],[-22,12],[-52,22],[-97,57],[-10,3],[-21,3],[-10,5],[-7,9],[-5,12],[-2,20],[-3,9],[-8,10],[-14,12],[-14,15],[-13,20],[-13,15],[-7,17],[-12,20],[-56,68],[-29,22],[-19,10],[-22,1],[-21,6],[-10,2],[-10,0],[-10,3],[-20,7],[-10,1],[-19,-2],[-10,1],[-10,4],[-9,5],[-10,2],[-9,-1],[-11,-2],[-10,0],[-22,3],[-21,0],[-12,4],[-14,9],[-21,22],[-14,8],[-11,5],[-9,1],[-5,1],[-14,16],[-94,160],[-46,58],[-25,42],[-17,19],[-29,26],[-60,38],[-9,8],[-71,70],[-48,71],[-30,34],[-10,8],[-20,14],[-40,21],[-8,7],[-3,9],[8,16],[7,11],[9,9],[8,5],[10,4],[7,5],[4,8],[-16,31],[-2,9],[-1,18],[11,19],[1,10],[-15,31],[-14,58],[-1,20],[2,12],[2,9],[3,8],[12,14],[34,25]],[[2049,1709],[5,-6],[16,3],[26,10],[12,3],[30,-6],[-7,-29],[28,-12],[53,3],[22,-5],[15,-22],[-18,-8],[20,-6],[5,-10],[-1,-14],[3,-17],[6,-3],[17,-2],[5,-2],[4,-6],[2,-13],[3,-5],[11,-11],[6,-8],[20,-52],[10,-12],[17,-3],[-9,-22],[-5,-6],[-6,-8],[5,-6],[15,-6],[0,-43],[13,-25],[41,-27],[16,-4],[3,-3],[12,-7],[32,-8],[9,-7],[5,-8],[4,-8],[7,-4],[5,-2],[7,-2],[7,-3],[5,-7],[5,-7],[6,-7],[9,-5],[13,-1],[15,1],[24,3],[69,6],[11,0],[10,-2],[32,-9],[16,2],[59,17],[20,2],[16,-1],[29,-17],[10,-3],[12,-1],[33,5],[26,-5],[9,-1],[8,6],[9,-2],[5,-6],[7,-8],[3,-9],[-2,-8],[-4,-9],[-1,-9],[1,-9],[22,-55],[6,-8],[8,-7],[9,-4],[10,-2],[20,-1],[43,-8],[15,1],[23,4],[19,5],[17,7],[5,3],[7,7],[7,9],[11,43],[0,9],[-1,18],[1,8],[6,10],[11,12],[35,31],[9,14],[2,10],[0,10],[0,8],[5,8],[13,10],[11,11],[10,15],[3,7],[0,4],[-11,4],[-5,3],[-1,5],[5,14],[0,1],[-2,1],[-5,1],[-7,0],[-7,1],[-5,2],[-3,6],[-2,19],[0,2],[1,3],[4,2],[7,2],[18,4],[10,0],[8,-2],[6,-2],[7,-2],[8,0],[10,4],[22,11],[6,5],[0,12],[2,4],[11,4],[10,1],[9,-1],[21,-5],[7,-1],[13,1],[7,-1],[6,1],[6,3],[1,10],[0,15],[1,7],[7,9],[9,8],[19,11],[11,5],[15,5],[5,4],[4,7],[6,14],[1,9],[0,8],[-2,5],[1,6],[2,6],[3,5],[5,5],[6,5],[12,4],[10,2],[23,14],[51,59]],[[3648,1697],[47,-23],[12,-2],[38,-3],[16,-4],[21,-9],[14,-4],[11,-1],[57,4],[12,3],[10,4],[75,79],[10,7],[27,15],[8,6],[9,17],[9,6],[9,-3],[16,-13],[9,-6],[50,-17],[29,-5],[19,-7],[8,-10],[10,-7],[7,-9],[12,-19],[10,-11],[6,-9],[2,-9],[0,-16],[6,-26],[5,-10],[10,-11],[6,-9],[3,-6],[-5,-1],[-34,-16],[-10,-2],[-10,-4],[-18,-19],[-13,-8],[-19,-2],[-14,4],[-5,-1],[3,-18],[35,-55],[29,-29],[44,-61],[0,-20],[3,-19],[13,-14],[25,-6],[25,-11],[15,-27],[12,-31],[17,-25],[-16,-5],[-11,-7],[-19,-19],[-21,-27],[-6,-6],[-55,0],[-43,23],[-12,2],[-6,-6],[-7,-24],[-4,-9],[-9,-9],[-68,-40],[-17,-15],[-16,-23],[24,-45],[-1,-19],[-23,-14],[10,-8],[-21,-8],[-44,-9],[-18,-7],[-14,-9],[-40,-38],[-30,-19],[-48,-21],[-19,-3],[-8,-5],[-6,-7],[-3,-4],[-12,-34],[-7,-77],[-3,-12],[-16,-26],[-4,-9],[-5,-17],[-5,-8],[-13,-20],[-11,-33]],[[8543,4884],[-1,0],[-5,3],[-14,4],[-333,5],[-24,3],[-13,5],[-14,12],[-2,22],[-3,6],[-6,3],[-8,6],[-12,6],[-8,0],[-6,3],[-6,42],[1,13],[14,23],[-1,14],[-18,48],[1,8],[26,52],[5,25],[-10,21],[-20,17],[-27,16],[-25,2],[-15,-24],[-16,27],[9,30],[44,54],[-23,17],[-26,6],[-10,9],[47,48],[0,10],[-20,4],[-4,6],[1,89],[9,16],[21,6],[15,12],[-2,25],[-18,42],[-5,22],[-3,77],[-5,23],[-20,53],[-2,22],[7,14],[13,8],[15,6],[15,7],[11,13],[0,10],[-4,11],[-6,27],[-14,26],[-2,11],[8,13],[9,0],[11,-2],[10,5],[3,12],[2,9],[-2,5],[-34,54],[-94,116],[-20,18],[-56,22]],[[7883,6202],[-443,495],[-12,19],[-10,19],[-7,31],[-1,115],[4,15],[7,9],[16,16],[10,7],[10,6],[32,13],[19,10],[9,7],[6,8],[4,9],[2,9],[0,60],[5,16],[7,13],[7,9],[2,16],[-3,22],[-29,100],[-11,14],[-10,10],[-9,8],[-7,9],[-10,17],[-29,70],[-3,15],[2,18],[2,11],[1,11],[-3,8],[-19,14],[-5,9],[3,11],[4,9],[6,7],[23,23],[5,9],[3,9],[0,10],[-16,97],[-14,28],[-4,12],[3,13],[13,19],[51,122],[2,10],[-1,16],[-10,22],[-17,58],[-1,10],[0,10],[3,22],[-3,48],[-9,26],[-10,71],[1,19],[4,18],[3,9],[5,8],[8,6],[19,8],[7,4],[4,8],[1,8],[-5,22],[-13,18],[-13,35],[-4,54],[11,74],[-4,36],[2,28],[-3,13],[-7,16],[-64,100],[-8,9],[-10,8],[-23,11],[-47,15],[-11,-1],[-10,-3],[-32,-10],[-9,-1],[-7,0],[-4,1],[-2,3],[-4,6],[-1,31],[-3,9],[-6,11],[-49,46],[-10,8],[-9,5],[-6,3],[-8,6],[-7,10],[-4,20],[1,12],[5,10],[3,10],[-2,11],[-9,16],[-17,21],[-36,14],[-18,7]],[[7057,8874],[31,56],[38,70],[6,28],[-12,20],[-19,19],[-16,21],[-4,51],[52,85],[8,41],[-10,26],[-14,23],[-10,25],[1,28],[15,26],[46,55],[7,24],[1,29],[33,72],[12,95],[21,52],[41,42],[55,31],[62,16],[31,1],[26,-1],[110,-24],[28,2],[26,11],[3,10],[-4,12],[2,9],[19,2],[13,-3],[24,-8],[12,-2],[37,4],[13,-1],[14,-7],[10,-10],[11,-5],[18,5],[10,2],[18,-2],[8,0],[11,4],[15,11],[9,6],[22,9],[12,2],[36,-2],[18,3],[36,12],[18,4],[53,-1],[20,2],[22,9],[12,10],[11,12],[18,14],[19,6],[17,-2],[35,-10],[48,3],[28,23],[27,29],[51,23],[17,7],[21,13],[21,8],[31,-4],[5,-5],[6,-15],[6,-5],[19,-1],[6,-3],[49,-36],[48,-18],[54,-7],[108,0],[8,1],[15,5],[9,1],[9,-4],[13,-12],[9,-4],[12,-1],[26,5],[11,-1],[20,-10],[17,-17],[13,-21],[6,-23],[9,-18],[19,-3],[25,6],[51,22],[8,5],[7,-3],[46,-26],[13,-4],[17,2],[41,17],[45,11],[47,0],[45,-13],[24,-20],[17,-45],[17,-17],[29,-4],[28,12],[23,19],[15,20],[5,11],[10,34],[8,16],[10,3],[12,-3],[14,0],[106,8],[8,-2],[15,-6],[9,0],[5,4],[6,15],[6,5],[15,2],[22,-1],[13,4],[24,21],[14,15],[18,1],[33,-24],[22,-22],[54,-75],[21,-43],[16,-14],[59,0],[11,-32],[10,-143],[-15,-166],[-12,-26],[-3,-14],[-9,-19],[-21,-15],[-47,-21],[-27,-16],[-17,-20],[-44,-113],[-21,-29],[-5,-11],[-6,-25],[-6,-12],[-24,-30],[-32,-58],[-4,-15],[-5,-31],[-33,-78],[-102,-149],[-4,-9],[-13,-4],[-76,-62],[-18,-18],[-10,-19],[-15,-67],[-8,-23],[-12,-21],[-15,-21],[-18,-40],[-14,-17],[-22,-6],[-6,-12],[-32,-33],[-10,-13],[-51,-121],[0,-17],[8,-35],[3,-35],[-6,-109],[7,-53],[0,-18],[-4,-20],[-14,-38],[-2,-20],[10,-328],[-3,-24],[-79,-148],[-7,-23],[-7,-42],[-46,-128],[-5,-71],[-9,-23],[-55,-80],[-30,-28],[-26,-43],[-8,-27],[15,-79],[0,-91],[39,-146],[0,-31],[-20,-89],[1,-32],[8,-28],[25,-55],[20,-10],[14,-18],[8,-22],[3,-20],[-9,-111],[-7,-18],[-114,-138],[-105,-246],[-24,-41],[-54,-214],[-4,-28],[4,-29],[32,-115],[12,-203],[-10,-11],[-18,-23],[-85,-68],[-8,-8],[-5,-9],[-3,-17],[-2,-5],[-4,-4],[-16,-10],[-17,-17],[-28,-17],[-74,-78]],[[7883,6202],[-940,-403],[-4,3],[-4,5],[-3,5],[-3,6],[-1,5],[-2,5],[-1,2],[-2,2],[-7,0],[-40,-2],[-8,1],[-5,3],[-4,5],[-10,14],[-5,4],[-5,3],[-19,7],[-6,3],[-5,4],[-10,8],[-7,3],[-13,1],[-7,0],[-8,-3],[-24,-10],[-12,-2],[-9,-1],[-7,2],[-26,11],[-8,2],[-12,2],[-4,3],[-2,3],[3,26],[0,10],[-3,11],[-3,5],[-3,4],[-4,2],[-9,5],[-5,3],[-4,4],[-3,5],[-1,5],[-1,4],[2,63],[-1,5],[-24,42],[-8,9],[-16,10],[-18,16],[-6,3],[-6,2],[-55,15],[-32,5],[-9,3],[-5,3],[-6,4],[-3,4],[-3,5],[-2,7],[0,21],[-3,6],[-4,4],[-4,4],[-13,5],[-26,9],[-6,2],[-11,7],[-5,3],[-9,8],[-6,3],[-6,3],[-5,3],[-5,4],[-8,4],[-44,6],[-33,1],[-32,6],[-7,1],[-4,-1],[-12,-5],[-8,-4],[-13,-3],[-9,0],[-6,3],[-3,5],[-3,6],[-4,5],[-10,5],[-10,1],[-15,-1],[-7,-1],[-5,-2],[-10,-4],[-2,-1],[-41,-3],[-5,-1],[-10,-5],[-7,-3],[-8,-2],[-12,-1],[-8,-3],[-6,-3],[-7,-5],[-3,-2],[-7,-2],[-16,-2],[-6,-1],[-4,-1],[-3,-2],[-3,-2],[-2,-2],[-6,-10],[-6,-19],[-3,-5],[-3,-5],[-4,-4],[-16,-10],[-5,-3],[-18,-19],[-8,-4],[-9,-1],[-7,1],[-7,2],[-11,7],[-9,3],[-14,3],[-14,-1],[-7,0],[-7,0],[-5,3],[-5,3],[-6,2],[-6,2],[-17,4],[-14,2],[-10,2],[-20,5],[-16,3],[-9,-1],[-9,-3],[-7,-4],[-11,-5],[-9,0],[-9,0],[-25,2],[-41,10],[-5,-1],[-11,-4],[-6,1],[-3,5],[0,6],[3,9],[0,4],[-2,5],[-2,1]],[[4125,7303],[-2,6],[-16,3],[-10,6],[-8,8],[-12,7],[-52,12],[-27,2],[-24,-5],[-47,-16],[-28,2],[-21,12],[-20,17],[-24,12],[-23,5],[-251,20],[-18,-4],[-1,-5],[-13,-30],[-16,-27],[-5,-3],[-14,-4],[-4,1],[-15,6],[-7,1],[-9,-3],[-16,-10],[-9,-4],[-24,-4],[-12,-1],[-13,1],[-26,-2],[-19,-11],[-17,-12],[-48,-16],[-30,-35],[-17,-11],[-45,-7],[-40,0],[-41,7],[-46,14],[-20,1],[-29,-2],[-26,-7],[-11,-8],[-9,-20],[-22,-6],[-24,-3],[-25,-26],[-24,-9],[-28,-5],[-45,3],[-27,-3],[-14,1],[-1,0],[-4,16],[-12,8],[-16,5],[-14,10],[26,3],[10,14],[4,16],[11,7],[19,2],[22,7],[19,11],[13,23],[8,4],[3,6],[-11,14],[-5,8],[0,9],[0,9],[-1,54],[1,10],[-21,11],[-24,56],[-27,12],[7,16],[-1,15],[-10,14],[-15,10],[-9,-9],[-24,30],[-22,33],[23,23],[4,27],[-8,52],[5,25],[9,21],[4,20],[-10,20],[17,8],[14,15],[10,18],[14,42],[2,18],[-6,14],[-7,8],[-11,21],[-17,20],[6,5],[16,4],[9,18],[9,14],[8,9],[9,7],[7,8],[3,11],[-8,22],[1,10],[12,4],[7,4],[24,23],[8,5],[47,22],[14,28],[5,37],[-1,68],[229,-1],[204,-2],[56,0],[214,-2],[238,-2],[211,-1],[140,-1],[12,1],[58,19],[85,-9],[21,-11],[25,-20],[19,-4],[8,2],[27,15],[105,19],[12,4],[4,10],[-3,10],[0,11],[12,10],[7,7],[34,-8],[44,-42],[32,-12],[-12,-19],[13,-5],[35,1],[18,-10],[26,-23],[20,-7],[-9,28],[10,4],[35,-16],[-19,-13],[-8,-3],[13,-4],[14,1],[12,3],[6,0],[2,-8],[-1,-26],[4,-5],[82,8],[19,4],[10,11],[2,13],[0,15],[9,7],[20,-17],[17,-22],[4,-11],[26,-16],[-14,-32],[-6,-28],[53,-3],[29,3],[12,5],[11,27],[13,-1],[63,-43],[20,-6],[26,8],[16,-21],[22,6],[21,19],[14,18],[8,0],[19,-6],[18,34],[42,-13],[18,6],[21,5],[28,-9],[6,-7],[8,-18],[5,-7],[7,-4],[45,-14],[11,-7],[7,-9],[3,-9],[-2,-15],[-2,-6],[2,-5],[10,-9],[7,-1],[31,-12],[-1,-3],[16,2],[25,11],[27,8],[68,34],[58,7],[58,-9],[113,-29],[126,-12],[6,-5],[14,-7],[16,-5],[31,-5],[10,-5],[51,-55],[16,-8],[36,-11],[31,-18],[13,-5],[9,-8],[4,-17],[6,-10],[16,1],[18,6],[14,6],[4,-18],[20,-8],[26,-5],[22,-8],[14,7],[16,-1],[15,-5],[11,-9],[5,-13],[-2,-11],[-3,-11],[0,-12],[11,-20],[52,-58],[60,74],[12,3],[28,-8],[14,5],[5,18],[-32,127],[-45,100],[-24,35],[-11,8],[-8,4],[-5,6],[-2,42],[4,11],[20,25],[0,10],[-5,9],[-2,10],[-1,3],[0,6],[1,6],[4,5],[6,2],[6,0],[2,1],[3,16],[-3,11],[-6,10],[-3,15],[3,13],[16,25],[9,26],[21,11],[27,-4],[25,-20],[53,34],[11,12],[-7,11],[-7,5],[68,125],[60,110],[43,79],[60,110],[57,104],[18,33]],[[6734,2382],[6,-41],[-6,-57],[8,-65],[-6,-61],[6,-20],[12,-21],[0,-26],[-8,-50],[7,-25],[16,-13],[15,-9],[8,-12],[-3,-27],[-6,-21],[-18,-35],[-65,-98],[-27,-61],[-30,-50],[-83,-87],[-54,-94],[-10,-26],[-18,-16],[-23,-54],[-22,-33]],[[6433,1380],[-27,29],[-21,22],[-22,28],[-5,41],[-21,50],[-32,55],[-42,59],[-35,38],[-74,23],[-47,18],[-48,-9],[-37,-32],[-26,-41],[-32,-59],[-32,-28],[-35,8],[-42,36],[-48,50],[-37,32],[-32,32],[-58,18],[-74,19],[-43,27],[-37,5],[-26,-42],[-11,-73],[-5,-77],[-10,-73],[-27,-68],[-50,-46],[-74,-37],[-37,-59],[0,-59],[27,-73],[5,-60],[-21,-86],[-43,-59],[-31,-69],[-27,-55],[-58,-63],[-35,-51],[47,-41],[37,-36],[32,-55],[43,-47]],[[5262,572],[-70,-31],[-11,-12],[-9,-15],[-102,-87],[-109,-157],[-10,-19],[-14,-17],[-21,-14],[-62,-24],[-88,-47],[-39,-12],[-51,-4],[-15,5],[-41,21],[-17,5],[-6,3],[-11,15],[-6,6],[-11,0],[-29,-1],[-6,5],[-10,12],[-25,1],[-26,-6],[-16,-7],[-27,-25],[-16,-7],[-26,-4],[-23,-3],[-5,35],[21,89],[-5,11],[-7,11],[-5,11],[-1,13],[3,11],[11,20],[2,11],[-5,29],[-15,18],[-20,16],[-20,22],[-11,43],[-10,26],[1,9],[11,16],[21,17],[50,18],[16,14],[15,18],[22,21],[19,23],[4,21],[-9,8],[-46,25],[-26,27],[-21,28],[-9,17],[-1,6],[5,6],[6,16],[2,15],[0,12],[-3,9],[-8,6],[-24,-2],[-58,-27],[-60,-12],[-27,-16],[-50,-38],[-50,-20],[-51,-15],[-116,-12],[-50,-17],[-39,-45],[-2,-4],[-3,-2],[-21,-13],[-23,-23],[-14,-7],[-13,-1],[-39,10]],[[3648,1697],[15,8],[3,4],[3,5],[1,9],[-1,13],[0,3],[2,3],[15,11],[8,9],[16,25],[6,13],[10,17],[2,7],[-1,5],[0,3],[0,2],[1,4],[5,5],[28,23],[21,12],[9,4],[3,2],[49,47],[6,7],[8,15],[6,7],[6,6],[21,11],[3,3],[9,20],[5,6],[5,4],[13,7],[17,7],[4,3],[1,7],[-2,5],[1,5],[2,3],[7,4],[7,6],[6,8],[12,24],[4,6],[13,7],[4,4],[1,3],[0,9],[1,15],[4,12],[20,39],[21,68],[5,9],[5,8],[25,17],[97,49]],[[4180,2335],[32,-38],[27,-9],[42,2],[18,-3],[28,-14],[10,-3],[9,0],[15,3],[45,1],[8,-2],[6,-3],[5,-4],[4,-4],[10,-7],[16,-10],[37,-17],[20,-5],[12,-1],[5,5],[16,22],[20,18],[9,8],[19,31],[4,4],[4,3],[23,12],[32,27],[10,7],[22,13],[4,2],[2,3],[7,16],[1,3],[3,3],[5,4],[36,22],[39,31],[8,9],[1,3],[17,12],[47,22],[10,9],[14,9],[1,1],[2,1],[2,3],[3,7],[4,14],[1,5],[0,20],[1,7],[5,6],[9,6],[32,15],[12,9],[40,20],[15,4],[11,0],[4,-3],[4,-5],[10,-15],[8,-9],[2,-6],[1,-6],[-2,-19],[2,-5],[4,-4],[10,-8],[4,-4],[3,-5],[2,-7],[0,-7],[0,-30],[10,-37],[1,-6],[-1,-3],[-3,-11],[0,-6],[1,-6],[8,-5],[13,-3],[26,-2],[24,1],[27,7],[29,11],[10,0],[84,-7],[13,-2],[5,-4],[4,-4],[7,-10],[14,-11],[4,-5],[2,-5],[6,-35],[8,-17],[3,-5],[5,-4],[6,-3],[7,-2],[21,-3],[8,-2],[5,-4],[3,-3],[1,-3],[1,-2],[3,-2],[4,-3],[17,-4],[5,-2],[5,-2],[26,-9],[52,-7],[13,0],[24,5],[26,3],[14,0],[12,-1],[48,-12],[12,-1],[10,1],[95,27],[17,7],[33,19],[8,4],[10,6],[19,15],[11,7],[5,3],[5,3],[14,13],[9,6],[19,9],[12,4],[30,7],[11,4],[3,2],[8,6],[5,2],[7,2],[17,3],[9,3],[6,5],[2,6],[6,11],[4,4],[5,4],[12,7],[15,9],[20,9],[12,4],[86,16],[9,-2],[13,-6],[5,2],[9,10],[9,4],[6,-1],[7,-4],[21,-6],[16,-7],[16,-3],[37,-13],[16,-8],[15,-11],[5,-3],[7,-2],[7,-1],[7,-3],[5,-3],[8,-9],[5,-4],[4,-4],[4,-5],[6,-18],[4,-4],[6,-3],[7,-2],[6,-3],[4,-4],[4,-5],[7,-4],[11,-4],[21,-4],[17,-1],[3,1],[4,2],[4,3],[9,4],[12,4],[25,5],[15,1],[11,0],[34,-3],[30,-5],[52,-5],[1,0]],[[8543,4884],[-179,-185],[-34,-28],[-28,-28],[-10,-8],[-36,-15],[-3,-5],[-26,-27],[-14,-7],[-69,-17],[-68,-8],[-25,-6],[-89,-32],[-64,-15],[-42,-6],[-8,-3],[-14,-8],[-9,-3],[-3,-7],[-32,-32],[-51,-39],[-42,-42],[-62,-43],[-30,-16],[-9,-7],[-6,-8],[-14,-32],[-31,-48],[-21,-42],[-22,-27],[-49,-85],[-44,-49],[-30,-53],[-18,-24]],[[7361,3929],[-1,0],[-43,0],[-30,-3],[-4,10],[6,18],[1,16],[-6,12],[-1,2],[-5,-2],[-39,14],[-27,5],[-27,-2],[-24,-13],[-22,-5],[-35,-1],[-28,4],[-3,9],[-6,6],[-22,6],[-19,10],[9,19],[-57,2],[-33,27],[-42,101],[-29,32],[-20,38],[-6,8],[-11,9],[-8,4],[-51,6],[-10,5],[-8,7],[-147,79],[-41,18],[-43,14],[-85,7],[-24,10],[0,27],[-5,11],[-15,-7],[-10,0],[-11,11],[-18,25],[-11,4],[-61,15],[-7,6],[-5,8],[-8,8],[-29,11],[-61,11],[-25,9],[-20,22],[-5,26],[-1,27],[-7,23],[-18,14],[-22,5],[-52,4],[-72,16],[-25,-1],[-21,-6],[-40,-17],[-21,-7],[-7,1],[-14,6],[-5,1],[-10,-2],[-17,-9],[-47,-13],[-22,-15],[-37,-49],[-19,-19],[-22,-16],[-7,-2],[-13,4],[-6,-1],[-11,-9],[-15,-22],[-10,-10],[-30,-16],[-65,-25],[-28,-20],[-87,-99],[-27,-49],[-69,-186],[-92,-102],[-50,-40],[-20,-11],[-37,-13],[-16,-3],[-52,3],[-11,-1],[-11,-2],[-65,-25],[-17,-10],[-65,-46],[-17,-17],[-11,-14],[-5,-27],[-3,-9],[-18,-25],[-9,-10],[-37,-31],[-12,-13],[-15,-22],[-27,-25],[-6,-9],[-15,-34],[-5,-8],[-53,-63],[-29,-24],[-20,-12],[-23,-9],[-14,-3],[-10,-6],[-7,-7],[-11,-19],[-3,-4],[-6,-5],[-9,-7],[-10,-4],[-50,-8],[-10,-1],[-11,0],[-21,2],[-20,4],[-11,6],[-9,15],[-8,23],[-5,61],[-3,8]],[[4323,3549],[2,1],[36,16],[9,16],[-10,50],[1,10],[8,29],[4,91],[9,25],[16,16],[31,16],[-10,7],[-28,4],[-23,6],[-16,47],[-26,12],[-8,9],[12,9],[27,8],[12,6],[13,8],[9,11],[5,13],[9,10],[43,7],[0,18],[-15,20],[-18,15],[17,33],[2,28],[5,11],[16,13],[16,9],[10,13],[-8,24],[-46,26],[-20,18],[-8,22],[4,12],[9,9],[11,7],[10,9],[7,13],[5,11],[5,25],[2,36],[-2,10],[-11,15],[-22,19]],[[965,1500],[27,-35],[9,-6],[12,-6],[29,-4],[39,-16],[178,-112],[47,-17],[12,-3],[43,-3],[40,-11],[23,-13],[22,-9],[7,-5],[2,-5],[0,-14],[1,-7],[3,-6],[8,-3],[27,-4],[41,-12],[34,-5],[32,-9],[25,-2],[18,-3],[29,-9],[14,-7],[8,-5],[1,-2],[0,-5],[-2,-7],[0,-7],[4,-8],[8,-4],[45,-9],[15,-7],[11,-9],[111,-109],[13,-19],[9,-11],[3,-8],[0,-8],[-12,-54],[0,-9],[1,-9],[3,-10],[9,-18],[47,-54],[12,-8],[11,-5],[11,-1],[10,-1],[85,3],[12,-1],[13,-3],[20,-8],[14,-7],[26,-17],[36,-31],[5,-13]],[[2216,710],[-9,4],[-19,6],[-31,-16],[-15,-26],[-11,-28],[-18,-18],[-24,-12],[-22,-15],[-18,-18],[-29,-46],[-15,-14],[-21,-6],[-147,-23],[-90,-26],[-20,-1],[-36,4],[-13,-16],[2,-50],[-6,-24],[-56,-94],[-14,-14],[-19,-7],[-45,-4],[-20,-4],[-19,-6],[-12,-9],[-17,27],[-12,13],[-12,6],[-16,0],[-6,-5],[-41,-117],[-35,-49],[-149,-109],[-11,-13],[-21,16],[-18,19],[-30,43],[-50,52],[-33,27],[-12,31]],[[1026,188],[15,0],[1,130],[-76,1]],[[966,319],[-23,26],[-56,44],[-7,14],[1,12],[32,-1],[25,24],[6,26],[-24,43],[-151,130],[-138,102],[-121,92],[-63,34],[-65,50],[-25,34],[-7,8],[-17,25],[-4,11],[2,25],[-1,13],[-6,9],[-117,80],[-129,74],[-45,28],[-33,18],[21,34],[88,205],[22,36],[34,25],[46,26],[39,28],[43,23],[55,9],[50,15],[30,32],[25,36],[37,21],[66,-8],[49,-33],[106,-147],[22,-20],[29,-9],[72,8],[27,-2],[76,-19],[25,-1],[3,1]],[[3967,2912],[13,-17],[13,-32],[38,-31],[5,-8],[2,-5],[-4,-5],[-4,-4],[-7,-2],[-18,-3],[-7,-8],[3,-7],[7,-7],[20,-12],[9,-4],[8,-1],[6,5],[7,4],[11,1],[13,-8],[2,-8],[-4,-9],[-8,-7],[-19,-10],[-17,-14],[-18,-11],[-5,-8],[2,-8],[5,-7],[9,-6],[10,-3],[21,0],[11,-1],[11,-4],[14,-7],[11,-3],[11,2],[23,10],[11,2],[11,-1],[13,-6],[10,-5],[13,0],[12,2],[17,-3],[5,-8],[1,-9],[-4,-9],[-18,-27],[-4,-10],[-1,-11],[5,-5],[7,3],[11,11],[6,0],[3,-7],[2,-18],[43,-102],[4,-15],[-2,-11],[-7,-8],[-10,-6],[-18,-8],[-9,-6],[-7,-7],[-4,-7],[-3,-13],[-2,-5],[-4,-5],[-5,-4],[-15,-10],[-9,-7],[-5,-8],[-2,-4],[-6,-12]],[[2049,1709],[0,37],[-6,5],[-12,-1],[-13,2],[-5,10],[-1,12],[-4,9],[-9,5],[-14,1],[0,8],[9,14],[-17,14],[2,12],[5,4],[4,3],[8,3],[4,1],[26,-1],[7,2],[5,2],[4,3],[2,3],[10,20],[12,49],[3,5],[3,5],[6,5],[4,3],[4,2],[18,7],[20,12],[8,3],[7,2],[9,1],[16,0],[40,-5],[9,0],[8,1],[6,2],[24,9],[3,1],[14,2],[8,0],[8,-1],[7,-2],[16,-9],[7,-2],[10,2],[11,4],[18,10],[11,4],[8,0],[9,-9],[6,-3],[10,2],[4,4],[1,6],[0,31],[1,9],[5,2],[8,-1],[18,-4],[10,-1],[10,2],[31,10],[9,2],[9,1],[21,9],[12,14],[14,8],[36,16],[46,41],[11,15],[5,13],[-3,67],[13,52],[17,39],[2,6],[0,9],[-4,9],[-7,9],[-9,8],[-61,43],[-9,3],[-20,1],[-29,7],[-8,4],[-5,7],[-4,8],[-5,18],[-10,14],[-3,6],[0,10],[4,5],[6,4],[19,6],[10,5],[18,14],[9,4],[22,2],[11,4],[3,7],[-1,9],[-28,53],[-6,19],[-15,162],[6,196],[12,53],[0,11],[-5,7],[-8,5],[-9,0],[-10,-4],[-9,-4],[-10,-2],[-7,2],[-8,6],[-10,9]],[[2497,3047],[24,21],[17,4],[33,-5],[86,-34],[27,-5],[15,2],[25,13],[16,2],[13,-3],[231,-74],[24,-2],[26,5],[28,-4],[7,0],[19,5],[8,-2],[12,-14],[6,-2],[14,7],[6,9],[4,11],[7,11],[14,11],[43,26],[11,9],[19,21],[14,10],[15,7],[32,9],[13,8],[6,10],[4,24],[9,12],[101,85],[11,12],[5,12],[2,23],[3,13],[14,22],[28,36],[3,6],[4,-1],[14,-9],[18,-15],[17,-22],[11,-24],[12,-47],[30,-53],[17,-21],[24,-22],[9,-11],[4,-32],[11,-8],[14,-6],[13,-8],[18,-22],[-5,-7],[-16,-9],[-19,-34],[-27,-12],[-10,-10],[-1,-44],[-2,-6],[22,-17],[30,-8],[33,-2],[28,5],[23,12],[12,5],[13,0],[13,-7],[4,-21],[8,-7],[10,0],[61,16],[9,2],[13,-1],[20,-11],[14,-4],[12,1],[8,9],[6,15]],[[3275,271],[-12,-3],[-16,6],[-26,23],[-17,7],[-15,-2],[-44,-22],[14,-10],[5,-9],[-4,-9],[-15,-7],[-68,-43],[-37,-38],[-14,-10],[-28,50],[-9,40],[-8,14],[-12,10],[-20,9],[-80,25],[-24,14],[-63,47],[-35,19],[-13,12],[-17,37],[-23,30],[-11,17],[-29,29],[-32,-3],[-22,-25],[3,-39],[-62,27],[-87,90],[-53,36],[-26,25],[-24,55],[-19,23],[-21,10],[-16,-1],[-15,-6],[-21,-4],[-18,3],[-25,12]],[[965,1500],[24,8],[28,19],[24,24],[10,25],[-9,25],[-26,12],[-31,8],[-28,14],[-13,24],[4,27],[76,154],[18,28],[57,37],[18,24],[-14,37],[-51,21],[-63,15],[-49,20],[-53,38],[-28,14],[-76,27],[-10,7],[-11,10],[-3,4],[2,7],[2,79],[6,20],[18,29],[14,7],[18,-1],[31,2],[32,18],[0,24],[-19,27],[-101,92],[-46,58],[-22,21],[-26,7],[-38,-10],[-54,-32],[-23,-4],[-6,27],[13,44],[2,9],[97,136],[12,29],[7,23],[0,24],[-7,30],[-13,25],[-33,47],[-11,24],[0,20],[9,63],[-4,25],[-29,67],[11,23],[2,0],[50,-1],[67,-18],[18,-8],[8,-9],[6,-9],[10,-10],[45,-31],[24,-11],[22,-1],[22,11],[45,36],[29,10],[48,8],[56,16],[42,17],[14,-7],[24,-15],[45,-48],[40,-24],[41,-4],[528,97],[-15,26],[9,37],[18,39],[9,33],[-9,47],[2,17],[10,18],[24,32],[6,20],[-52,20],[-28,37],[-11,46],[-11,124],[5,15],[15,-3],[15,-14],[26,-23],[23,-7],[17,8],[6,12],[1,13],[2,9],[8,15],[7,8],[8,6],[65,38],[14,4],[66,2],[56,-21],[88,-54],[6,-4],[56,-16],[22,-13],[16,-28],[29,-83],[12,-24],[8,-9],[20,-17],[6,-7],[5,-26],[-2,-1],[0,-5],[-1,-7],[3,-6],[25,-5],[-1,-7],[-5,-8],[-3,-5],[-6,-9],[-2,-7],[3,-7],[18,-15],[5,-8],[1,-12],[6,-20],[18,0],[33,14],[11,-9],[25,-35],[13,-14],[6,-30],[4,-10],[9,-8],[8,0],[7,-1],[3,-13],[-11,-10],[-7,-10],[-3,-11],[-1,-10],[-4,-10],[-5,-10],[-6,-8],[-15,-11],[-7,-10],[4,-7],[18,1],[15,13]],[[7361,3929],[-27,-35],[-9,-19],[-7,-19],[-2,-13],[1,-39],[-8,-34],[-17,-29],[-105,-120],[-4,-3],[-7,-14],[-4,-16],[-8,-3],[-23,-15],[-21,-8],[-6,-3],[-12,-9],[-21,-22],[-83,-71],[-57,-37],[-74,-61],[-37,-22],[-33,-25],[-33,-37],[-16,-24],[-10,-26],[2,-26],[2,-9],[0,-8],[-18,-51],[-2,-19],[4,-17],[12,-16],[4,-6],[2,-11],[1,-55],[44,-275],[-28,-169],[-31,-82],[-4,-16],[-1,-17],[9,-66]],[[3967,2912],[8,20],[11,10],[13,9],[9,10],[0,30],[6,12],[11,9],[25,19],[12,7],[13,5],[64,13],[5,-3],[-9,36],[-101,74],[-4,39],[18,12],[45,14],[18,17],[0,8],[-8,21],[1,11],[8,6],[23,7],[9,7],[6,17],[7,60],[9,23],[1,11],[-6,10],[-11,7],[-7,6],[-1,7],[7,10],[0,14],[3,10],[7,8],[9,9],[155,52]],[[6433,1380],[-19,-29],[-9,-9],[-8,-12],[-24,-67],[-32,-27],[-7,-5],[-51,-23],[-59,-16],[-60,-7],[-58,-8],[-192,-52],[-23,-10],[-21,-13],[-17,-22],[-40,-113],[-8,-10],[-29,-26],[-5,-8],[-12,-4],[-33,-15],[-51,-16],[-148,-64],[-26,-15],[-36,-13],[-33,-16],[-14,-23],[-7,-15],[-50,-61],[-70,-86],[-29,-23]],[[1026,188],[-74,67],[-14,14],[-1,6],[6,8],[8,-1],[18,-18],[6,4],[7,14],[-4,24],[-12,13]]],"transform":{"scale":[0.0007529143470284136,0.0008728779775977512],"translate":[11.114016304062915,-5.019630835999862]}};
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
