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
  Datamap.prototype.cogTopo = '__COG__';
  Datamap.prototype.cokTopo = '__COK__';
  Datamap.prototype.colTopo = '__COL__';
  Datamap.prototype.comTopo = '__COM__';
  Datamap.prototype.cpvTopo = '__CPV__';
  Datamap.prototype.criTopo = {"type":"Topology","objects":{"cri":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Cartago"},"id":"CR.CA","arcs":[[0,1]]},{"type":"Polygon","properties":{"name":"Heredia"},"id":"CR.HE","arcs":[[2,3,4,5]]},{"type":"Polygon","properties":{"name":"Limón"},"id":"CR.LI","arcs":[[6,7,-2,8,-3,9]]},{"type":"MultiPolygon","properties":{"name":"Puntarenas"},"id":"CR.PU","arcs":[[[10]],[[11]],[[12,13]],[[14]],[[15,-7,16,17,18]]]},{"type":"Polygon","properties":{"name":"San José"},"id":"CR.SJ","arcs":[[-1,-8,-16,19,-4,-9]]},{"type":"Polygon","properties":{"name":"Alajuela"},"id":"CR.AL","arcs":[[-5,-20,-19,20,21]]},{"type":"Polygon","properties":{"name":"Guanacaste"},"id":"CR.GU","arcs":[[-21,-18,22,-13,23]]}]}},"arcs":[[[7971,6940],[-232,111],[-5,1],[-22,9],[-19,12],[-56,46],[-26,-6],[-9,-8],[-10,-15],[-4,-4],[-4,-2],[-4,-3],[-5,-2],[-5,-2],[-6,-1],[-7,0],[-7,-1],[-26,2],[-6,-1],[-11,-3],[-31,-12],[-4,0],[-4,3],[-5,23],[-7,19],[-2,4],[-6,5],[-10,5],[-33,8],[-11,6],[-6,4],[-24,27],[-42,-4],[-11,0],[-48,8],[-6,1],[-7,5],[-7,6],[-11,14],[-9,14],[-5,8],[-1,4],[-15,25],[-17,22],[-3,3],[-7,4],[-9,2],[-17,2],[-9,-1],[-7,-3],[-4,-2],[-6,-2],[-11,2],[-45,18],[-27,8],[-6,1],[-12,8],[-48,51],[-20,25],[0,4],[-2,4],[-12,8],[-42,11],[-15,22],[-4,8],[-4,9],[-5,17],[-18,2],[-81,-15],[-13,3],[-13,1],[-6,0],[-18,-4],[-27,-8],[-6,-1],[-6,0],[-5,2],[-3,4],[-3,4],[-1,5],[0,5],[2,8],[6,11],[15,20],[39,27],[27,15],[16,14],[63,81],[-44,15],[-8,4],[-4,2],[4,14],[58,76],[101,29],[2,1],[58,0],[20,-2],[5,-3],[7,-1],[8,1],[7,2],[28,24],[26,2],[12,4],[9,6],[6,7],[5,14],[-9,39],[-5,45],[-6,16],[-8,10],[-44,39],[-4,2],[-10,5],[-19,10],[-19,13],[-8,8],[-5,7],[-31,84]],[[6970,8114],[275,-98],[96,-36],[133,-50],[215,-79],[57,-16],[317,-2],[232,-5],[44,-7],[-5,-7],[-27,-31],[-17,-29],[-8,-31],[4,-38],[25,-62],[6,-32],[-15,-31],[-94,-92],[-66,-64],[-17,-22],[-50,-99],[-127,-120],[-30,-50],[-8,-53],[5,-17],[5,-22],[13,-23],[4,-5],[7,-6],[5,-5],[14,-23],[8,-19]],[[7363,9233],[6,-4],[25,-5],[7,-2],[5,-3],[5,-3],[11,-9],[9,-7],[6,-9],[1,-6],[0,-6],[-6,-35],[1,-9],[2,-6],[6,-6],[8,-6],[8,-6],[19,-9],[8,-6],[6,-5],[5,-5],[0,-3],[-2,-2],[-10,3],[-8,0],[-9,0],[-23,-5],[-64,-4],[-13,-2],[-23,-6],[-37,-19],[-22,-19],[-9,-5],[-21,-9],[-18,-9],[-9,-6],[-3,-3],[-4,-10],[-3,-16],[-3,-54],[2,-16],[-13,-76],[1,-10],[2,-4],[3,-4],[7,-6],[3,-4],[3,-4],[0,-5],[0,-6],[-2,-14],[1,-6],[1,-6],[9,-17],[1,-5],[0,-8],[-13,-37],[-19,-24],[-9,-7],[-4,-3],[-5,-2],[-6,-1],[-6,-1],[-5,-2],[-5,-4],[-17,-27],[-6,-7],[-8,-12],[-2,-8],[-1,-10],[5,-26],[3,-7],[29,-43],[7,-19],[4,-9],[5,-7],[7,-6],[3,-4],[0,-9],[-2,-12],[-7,-26],[-2,-21],[1,-5],[-2,-9],[-6,-13],[-27,-45],[-7,-9],[-103,-87]],[[7034,8224],[-81,-7],[-43,-43],[-13,-11],[-11,-3],[-48,-3],[-43,-7],[-97,-6],[-11,-3],[2,-9],[8,-14],[50,-59],[29,-25],[6,-14],[4,-42],[17,-16],[11,-7],[7,-6],[2,-13],[-13,-35],[-27,-58],[-43,-20],[-58,-15],[-23,-3],[-56,3],[-10,0],[-81,-29],[-25,9],[-43,17],[-39,-6]],[[6405,7799],[-4,16],[0,9],[1,5],[1,6],[11,13],[40,34],[1,5],[25,266],[4,241],[3,201],[5,282],[5,375],[1,7]],[[6498,9259],[19,-2],[26,3],[41,-31],[25,-8],[26,15],[15,0],[26,-20],[55,27],[37,-7],[26,21],[30,4],[24,-13],[10,-30],[132,-83],[15,-5],[21,-3],[21,4],[31,16],[14,4],[60,-9],[9,4],[45,41],[145,44],[12,2]],[[9172,6243],[-1,1],[-21,13],[-7,4],[-35,9],[-38,29],[-11,13],[-13,31],[-12,14],[-9,5],[-14,5],[-76,17],[-6,3],[-6,4],[-7,9],[-3,7],[-24,94],[-8,17],[-5,8],[-3,3],[-4,3],[-4,3],[-79,35],[-9,5],[-16,12],[-85,88],[-10,2],[-14,2],[-47,-3],[-31,-5],[-7,0],[-12,2],[-16,4],[-34,14],[-21,11],[-10,4],[-41,11],[-11,4],[-5,2],[-5,2],[-41,28],[-9,5],[-11,4],[-7,1],[-10,-2],[-16,-6],[-8,-5],[-5,-4],[-26,-28],[-4,-3],[-9,-3],[-41,-3],[-12,-2],[-9,-3],[-7,-7],[-4,-2],[-5,-3],[-5,0],[-5,2],[-6,13],[-1,6],[-2,5],[-8,5],[-7,3],[-57,14]],[[8097,6740],[-27,15],[-8,6],[-19,20],[-72,159]],[[6970,8114],[30,79],[14,15],[20,16]],[[7363,9233],[144,27],[77,32],[6,47],[-20,63],[-2,75],[1,9],[-3,9],[16,8],[13,-2],[14,1],[16,-2],[44,-40],[56,-81],[40,-87],[-5,-55],[-32,31],[-58,112],[37,-140],[-4,-56],[-63,-43],[33,5],[23,12],[21,15],[29,14],[-10,-8],[-2,-11],[4,-13],[8,-14],[8,20],[10,41],[12,22],[106,-233],[134,-248],[157,-208],[419,-433],[34,-21],[140,-135],[86,-68],[52,24],[20,-11],[58,-8],[12,-13],[2,-33],[7,-27],[16,-24],[28,-24],[103,-120],[32,-18],[127,-136],[95,-71],[56,14],[13,-28],[12,-71],[20,-32],[34,-21],[147,-40],[53,-4],[51,1],[49,-3],[42,-18],[55,-66],[37,-17],[2,-2],[24,-65],[-17,-1],[-34,14],[-33,4],[-16,-19],[-9,-67],[-14,-23],[-29,-3],[-41,5],[-38,10],[-22,8],[-23,20],[-28,43],[-23,20],[-17,-7],[-22,7],[-91,61],[-127,40],[-41,-4],[-41,-27],[-25,-28],[-4,-16],[27,-37],[15,-49],[10,-10],[14,-3],[10,-5],[-3,-14],[-33,-15],[-117,-13],[-41,-11],[-19,-25],[-5,-34],[2,-145],[3,-211],[5,-287]],[[41,2],[-41,-2],[29,39],[26,17],[31,14],[30,5],[0,-18],[-2,-23],[-28,-24],[-45,-8]],[[7129,5595],[-17,-5],[-28,4],[-13,9],[29,12],[31,1],[-2,-21]],[[4145,7391],[1,1],[5,4],[13,5],[5,1],[5,2],[14,24],[7,4],[5,3],[6,4],[4,8],[7,15],[4,8],[5,5],[12,8],[2,3],[0,4],[-7,6],[-3,7],[1,11],[22,67],[9,18],[6,11],[-1,4],[-4,4],[-32,6],[-6,1],[-4,3],[-3,3],[-3,10],[-2,11],[-5,8],[-3,4],[-2,4],[-6,7],[-12,9],[-9,10],[-5,3],[-5,2],[-17,5],[-14,6],[-13,3],[-21,-1],[-6,1],[-5,2],[-10,5],[-5,2],[-20,2],[-6,1],[-7,-1],[-21,-2],[-9,1],[-9,4],[-9,6],[-7,8],[-4,10],[9,14],[20,14],[54,21],[23,6],[15,1],[4,-3],[4,-3],[4,-3],[4,-2],[10,3],[57,26],[11,3],[48,9],[13,15],[22,57]],[[4281,7909],[51,-36],[133,-42],[17,-8],[15,5],[35,-11],[85,-39],[39,-10],[42,-1],[40,14],[25,-17],[56,-27],[25,-17],[0,-11],[-44,-9],[2,-25],[27,-29],[29,-22],[-18,-5],[-17,-10],[-27,-21],[33,-12],[38,-3],[79,2],[0,-11],[-31,-17],[-39,-13],[-34,-18],[-15,-31],[-8,-7],[-51,-23],[-10,-13],[-11,-32],[-9,-14],[-69,27],[-37,2],[-16,-23],[10,-14],[34,-34],[-6,-7],[-71,-28],[-12,-2],[-8,-9],[-52,-21],[-10,-14],[-48,-121],[-20,-31],[-27,-27],[-16,0],[-61,100],[-183,197],[-1,0]],[[4330,8056],[21,-9],[9,1],[22,-4],[12,-8],[18,-4],[23,0],[0,-11],[-27,-7],[-33,-7],[-38,-2],[-37,3],[-38,13],[-20,16],[-30,44],[41,11],[19,1],[70,-9],[64,-16],[0,-12],[-76,0]],[[5590,7566],[-19,-12],[21,-8],[16,-7],[8,-5],[9,-6],[3,-3],[13,-14],[11,-16],[1,-7],[2,-10],[-4,-14],[-3,-7],[-5,-5],[-4,-2],[-5,-2],[-6,-1],[-7,-1],[-42,2],[-13,-1],[-6,-2],[-6,-2],[-4,-3],[-3,-3],[-1,-4],[-1,-5],[1,-5],[17,-44],[5,-21],[-1,-34],[0,-6],[5,-10],[49,-68],[2,-4],[14,-58],[6,-13],[10,-17],[14,-14],[15,-12],[7,-4],[23,-2],[68,9],[15,-5],[6,-1],[8,0],[35,8],[6,0],[7,-1],[5,-2],[5,-2],[10,-10],[5,-3],[4,-2],[6,-1],[6,-1],[6,1],[7,2],[6,5],[13,21],[3,4],[6,4],[25,16],[8,6],[5,5],[2,5],[1,10],[-8,35],[1,4],[5,3],[13,2],[25,0],[58,8],[94,4],[32,-2],[12,-8],[8,-5],[15,-15],[3,-2],[24,-4],[78,2],[29,-10],[32,-2],[99,7],[19,-2],[6,-1],[7,-5],[6,-8],[5,-14],[0,-8],[0,-7],[-5,-15],[-1,-11],[1,-5],[3,-7],[8,-7],[17,-12],[17,-5],[10,-1],[20,2],[28,1],[20,-2],[12,-4],[5,-2],[5,-7],[4,-9],[5,-22],[0,-11],[-2,-7],[-6,-8],[-4,-9],[8,-11],[48,-17],[36,-55],[50,-38],[143,-76],[34,-9],[3,4],[4,3],[4,3],[4,3],[5,1],[6,2],[6,1],[7,0],[6,-1],[7,-4],[7,-7],[16,-22],[3,-7],[10,-34],[2,-4],[71,-57],[14,-15],[8,-11],[-3,-18],[1,-10],[3,-20],[14,-35],[11,-17],[6,-7],[8,-8],[15,-10],[109,-39],[17,-4],[6,1],[5,1],[4,3],[4,3],[19,21],[4,3],[5,2],[6,2],[7,1],[7,1],[6,0],[6,-1],[6,-1],[21,-8],[31,-24],[50,-48],[7,-11],[1,-5],[1,-4],[17,-45],[2,-4],[6,-7],[15,-14],[199,-102],[5,-2],[24,1],[19,3],[5,0],[8,-1],[6,-2],[9,-5],[10,-9],[3,-3],[10,-5],[6,-1],[6,-1],[6,0],[5,1],[5,3],[4,3],[23,26],[8,6],[7,4],[5,2],[4,2],[5,3],[2,6],[2,9],[-6,41],[1,7],[4,9],[16,25],[5,11],[-2,20],[-2,10],[-4,7],[-3,4],[-1,5],[-3,3],[-3,3],[-6,0],[-6,-1],[-6,0],[-5,1],[-4,3],[-3,3],[-4,3],[-5,2],[-20,3],[-4,2],[-3,4],[0,4],[21,89],[2,4],[7,9],[60,53],[5,7],[6,10],[14,43],[7,9],[6,7],[48,40]],[[9172,6243],[0,-20],[66,22],[20,0],[16,-9],[7,-13],[7,-14],[9,-11],[13,-6],[50,-17],[100,-59],[100,-27],[30,-16],[57,-75],[8,-17],[-1,-2],[-30,-39],[-66,-32],[-227,-74],[-25,-14],[-22,-23],[11,-8],[17,-8],[0,-24],[-20,-19],[-66,-32],[-18,-15],[-2,-27],[11,-24],[19,-24],[69,-61],[37,-41],[27,-45],[17,-53],[13,-123],[-6,-62],[-21,-51],[-48,-48],[-57,-22],[-63,-15],[-63,-26],[-97,-74],[-100,-44],[-19,-13],[-3,-22],[21,-17],[61,-29],[12,-9],[21,-25],[12,-8],[14,-1],[27,9],[20,-2],[38,-17],[15,-18],[10,-55],[116,-202],[-11,-78],[-14,-40],[-30,19],[4,26],[16,30],[10,27],[-6,21],[-150,204],[-52,45],[-273,157],[-75,58],[65,63],[12,5],[12,18],[24,23],[15,27],[-14,28],[-72,72],[-12,19],[-1,26],[16,9],[27,7],[34,17],[-25,7],[-65,-3],[-31,9],[-16,15],[-44,68],[7,9],[4,6],[4,10],[15,0],[21,-28],[7,-14],[2,-24],[10,-4],[65,21],[0,13],[-30,10],[-32,19],[-27,23],[-16,20],[-15,0],[-17,-21],[-39,-2],[-46,5],[-34,-6],[-16,24],[-26,25],[-30,12],[-32,-13],[-69,33],[-21,26],[14,37],[-15,1],[-15,-1],[9,29],[-31,14],[-46,7],[-37,10],[-13,-21],[-11,2],[-15,8],[-22,0],[-11,-9],[-2,-13],[-9,-10],[-30,-5],[-73,9],[-29,-9],[-11,-35],[17,10],[-1,1],[14,0],[77,-92],[10,-28],[45,-56],[18,-17],[29,-12],[82,-19],[33,-4],[30,-14],[29,-28],[27,-19],[27,13],[2,-43],[-5,-18],[-13,-12],[0,-12],[33,-36],[13,-61],[-5,-64],[-25,-44],[-49,-1],[-80,21],[-76,29],[-36,23],[14,0],[10,-6],[8,-3],[29,-3],[-42,16],[-17,9],[-18,12],[0,-25],[-127,44],[-45,5],[-134,-12],[-38,-1],[-31,12],[-29,24],[-54,55],[-191,141],[-12,16],[-10,2],[-44,15],[-14,7],[-7,54],[67,82],[15,14],[35,16],[23,8],[11,-5],[7,-11],[15,12],[54,65],[14,12],[-27,28],[33,31],[60,26],[54,11],[0,11],[-47,4],[-24,-1],[-17,-11],[-25,-21],[-26,-10],[-8,17],[10,30],[31,29],[54,21],[25,14],[11,20],[-14,17],[-28,13],[-26,16],[-6,31],[43,-17],[20,-5],[27,-1],[-13,13],[-17,10],[-31,13],[-14,9],[-7,8],[-12,5],[-26,2],[27,13],[-4,9],[-15,7],[-8,6],[10,19],[11,14],[16,13],[22,15],[-58,121],[-11,15],[-36,32],[-15,-12],[-49,51],[-45,59],[-58,46],[-88,13],[5,45],[-48,39],[-66,26],[-50,11],[-172,130],[-169,63],[-27,16],[-211,66],[-14,0],[-14,-8],[-13,0],[-10,8],[-8,13],[-30,-10],[-18,11],[-21,17],[-37,5],[23,33],[-31,45],[-57,40],[-55,15],[0,-12],[19,-3],[13,-4],[29,-17],[-57,8],[-91,42],[-57,10],[-56,4],[-293,64],[-56,4],[-27,-4],[-28,-7],[-29,-4],[-29,3],[-26,17],[-9,21],[-10,17],[-30,5],[5,-7],[4,-5],[4,-13],[-36,23],[-81,42],[-16,26],[-8,24],[-19,12],[-25,7],[-23,12],[-8,18],[3,18],[-6,12],[-34,-1],[9,20],[-3,19],[-6,18],[0,16],[13,20],[38,29],[15,30],[15,15],[15,19],[7,25],[-7,21],[-17,19],[-34,27],[-89,104],[-25,16],[-36,12],[5,26],[31,41],[-54,35],[-10,17],[12,26],[-63,15],[-195,-15],[0,13],[27,8],[35,3],[76,0],[0,12],[-70,2],[-63,9],[-56,15],[-52,23],[-67,43],[-10,9],[-14,3],[-28,15],[-19,17],[10,7],[-37,15],[-90,67],[-48,19],[-22,17],[-14,3],[-11,-4],[-10,-6],[-12,-2],[-19,12],[12,19],[5,12],[-1,0]],[[4498,8148],[1,0],[44,11],[18,-1],[6,0],[7,-1],[14,1],[13,2],[6,0],[5,-1],[5,-1],[9,-6],[4,-2],[5,-2],[6,-1],[5,0],[4,1],[11,2],[9,1],[7,0],[6,-1],[11,-3],[21,-9],[4,-3],[16,-11],[27,-27],[8,-6],[17,-10],[21,-9],[5,-1],[6,-1],[6,0],[3,3],[-1,6],[-8,19],[-3,10],[0,6],[2,10],[6,8],[11,10],[39,28],[10,5],[42,14],[4,5],[4,6],[1,12],[-1,7],[-3,5],[-7,6],[-3,4],[-2,4],[-2,4],[0,5],[2,6],[13,22],[2,5],[5,34],[11,23],[1,5],[-1,5],[-2,4],[-3,4],[-16,12],[-3,3],[-3,4],[-1,4],[0,6],[2,5],[4,6],[6,7],[9,8],[13,7],[20,8],[8,5],[19,16],[13,7],[8,2],[9,2],[17,0],[11,0],[12,-3],[10,-4],[34,-22]],[[5117,8428],[49,-62],[14,-13],[4,-3],[15,-7],[12,-1],[18,1],[42,6],[30,7],[14,6],[5,2],[6,2],[17,-2],[39,-20],[12,-27],[9,-10],[13,-8],[4,-3],[0,-7],[-2,-9],[-23,-33],[-7,-13],[-12,-40],[0,-6],[1,-7],[12,-18],[3,-10],[1,-6],[-9,-45],[10,-28],[25,-39],[13,-16],[35,-35],[18,-23],[36,-34],[14,-17],[1,-4],[3,-6],[2,-2],[5,-1],[7,0],[17,3],[17,11],[6,2],[16,-6],[27,-36],[-1,-13],[-2,-4],[-7,-6],[-11,-4],[-35,-11],[-108,-56],[-24,-6],[-17,-13],[-41,-50],[-15,-6],[-4,-2],[-3,-4],[-1,-5],[0,-10],[-3,-9],[7,-7],[15,-8],[46,-15],[36,-8],[29,-1],[26,-4],[20,-12],[47,-51]],[[5590,7566],[16,1],[4,3],[3,13],[3,7],[41,40],[1,6],[-1,4],[7,6],[14,9],[38,15],[26,20],[2,5],[3,2],[17,9],[68,23],[98,7],[53,8],[43,-10],[43,-5],[9,-2],[10,-2],[26,-3],[12,-3],[39,5],[147,32],[61,16],[32,27]],[[5117,8428],[35,53],[4,18],[-5,7],[-3,4],[-6,12],[-9,32],[34,97],[-48,75],[-16,21],[-126,76],[-39,16],[-121,25],[-31,9],[-23,21],[-59,41],[-7,7],[-12,15],[-7,12],[-10,47],[-25,36],[-31,39],[-14,12],[-14,6],[-29,10],[-25,6],[-116,22],[-35,9],[-13,8],[-17,12],[-65,35],[-17,7],[-12,4],[-14,1],[-15,0],[-27,-3],[-48,-9],[-57,-5],[-66,2],[-54,85],[-19,23],[-10,6],[-5,2],[-5,2],[-6,1],[-49,5],[-14,4],[-53,25],[-25,15],[-100,91],[-2,3],[-5,7],[-1,5],[1,4],[8,7],[75,5],[20,7],[7,8],[4,8],[172,92],[105,94],[8,4],[6,2],[9,0],[13,4],[16,3],[6,4]],[[4130,9724],[315,-92],[354,-104],[51,-4],[51,15],[227,118],[162,84],[69,13],[39,-13],[84,-48],[38,-4],[47,2],[51,-13],[109,-38],[12,-3],[11,-3],[11,-5],[9,-5],[50,-49],[19,-12],[20,-9],[23,-8],[24,-1],[21,6],[118,61],[19,9],[21,-8],[5,-14],[-1,-17],[5,-22],[9,-13],[30,-29],[6,-12],[23,-17],[102,-31],[23,-12],[20,-18],[42,-17],[38,-25],[8,-42],[-31,-12],[-9,-5],[-9,-14],[4,-10],[9,-7],[5,-6],[48,-31],[11,-12],[25,14],[34,0],[16,-2]],[[4498,8148],[-9,5],[-9,4],[-28,20],[-40,-10],[-149,-2],[-39,8],[-35,20],[-55,45],[0,11],[13,32],[-39,37],[-94,52],[13,-35],[64,-37],[14,-43],[6,-81],[13,-48],[26,-33],[-28,-14],[4,-25],[26,-22],[67,-19],[24,-21],[29,-44],[13,0],[18,6],[8,-4],[3,-12],[-19,-2],[-20,2],[-19,5],[-16,5],[0,-10],[41,-29]],[[4145,7391],[-11,22],[-9,9],[-20,10],[-55,18],[-5,14],[1,16],[-2,12],[-52,46],[-73,32],[-236,67],[-21,-4],[-32,-17],[-14,-4],[-21,4],[-30,17],[-24,4],[-14,1],[-5,2],[-3,6],[-8,8],[-15,5],[-13,-2],[-8,-6],[-2,-3],[-124,31],[-59,8],[-14,6],[-12,9],[-17,7],[-25,-1],[-16,-8],[-14,-1],[-20,21],[16,32],[-23,44],[-225,219],[-14,19],[-17,47],[-27,34],[-86,165],[-8,50],[-9,30],[-13,22],[30,24],[13,16],[-5,15],[-47,47],[-29,14],[16,17],[38,24],[26,30],[18,29],[37,-12],[21,19],[16,27],[46,28],[-18,31],[-33,33],[-23,19],[14,7],[6,3],[10,2],[0,12],[-30,0],[0,12],[25,4],[16,12],[19,33],[15,0],[31,-20],[43,14],[44,20],[33,-3],[14,0],[-3,23],[8,11],[12,6],[12,8],[20,27],[8,-1],[27,-2],[66,54],[-5,15],[-12,11],[-28,16],[-90,-72],[-2,6],[0,5],[-2,3],[-11,-1],[0,11],[25,22],[16,9],[19,5],[-15,12],[-2,-2],[-3,-3],[-4,-4],[-7,-3],[5,14],[1,5],[25,6],[0,11],[-15,0],[0,13],[37,23],[7,59],[-13,116],[-33,31],[-72,25],[-73,10],[-33,-18],[-13,0],[-61,40],[-17,15],[10,-3],[13,5],[6,9],[-13,13],[-16,2],[-42,-3],[-18,1],[-65,19],[-50,23],[-57,20],[-83,8],[0,13],[50,10],[93,33],[52,5],[-8,11],[-7,7],[-10,4],[-20,2],[0,12],[109,5],[27,-5],[12,-13],[-3,-16],[-5,-13],[4,-6],[9,-3],[28,-21],[14,0],[16,13],[0,11],[-25,20],[24,13],[47,5],[44,-2],[15,-5],[20,-16],[18,-3],[14,4],[6,11],[-2,11],[-11,10],[0,13],[33,10],[9,19],[-8,23],[-18,20],[-16,9],[-37,13],[-15,8],[-19,16],[0,4],[11,2],[15,8],[34,25],[19,-9],[23,-16],[44,0],[26,19],[-5,26],[-24,24],[-27,16],[-19,6],[53,68],[40,69],[62,66],[74,24],[62,-26],[62,-44],[71,-31],[222,-65],[297,-86],[79,-23]]],"transform":{"scale":[0.0004555283822382185,0.0005695424476447636],"translate":[-87.11766516799989,5.515082098000121]}};
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
