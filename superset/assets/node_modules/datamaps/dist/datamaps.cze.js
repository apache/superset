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
  Datamap.prototype.criTopo = '__CRI__';
  Datamap.prototype.csiTopo = '__CSI__';
  Datamap.prototype.cubTopo = '__CUB__';
  Datamap.prototype.cuwTopo = '__CUW__';
  Datamap.prototype.cymTopo = '__CYM__';
  Datamap.prototype.cynTopo = '__CYN__';
  Datamap.prototype.cypTopo = '__CYP__';
  Datamap.prototype.czeTopo = {"type":"Topology","objects":{"cze":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Ústecký"},"id":"CZ.","arcs":[[0,1,2,3,4]]},{"type":"Polygon","properties":{"name":"Plzeňský"},"id":"CZ.","arcs":[[5,6,7,8,-3]]},{"type":"Polygon","properties":{"name":"Jihomoravský"},"id":"CZ.","arcs":[[9,10,11,12,13,14]]},{"type":"Polygon","properties":{"name":"Zlínský"},"id":"CZ.","arcs":[[15,-11,16,17]]},{"type":"Polygon","properties":{"name":"Olomoucký"},"id":"CZ.","arcs":[[18,-17,-10,19,20]]},{"type":"Polygon","properties":{"name":"Pardubický"},"id":"CZ.","arcs":[[-15,21,22,23,24,-20]]},{"type":"Polygon","properties":{"name":"Karlovarský"},"id":"CZ.KK","arcs":[[-4,-9,25]]},{"type":"Polygon","properties":{"name":"Jihočeský"},"id":"CZ.CK","arcs":[[26,-13,27,-7,28]]},{"type":"Polygon","properties":{"name":"Vysočina"},"id":"CZ.JK","arcs":[[-14,-27,29,-22]]},{"type":"Polygon","properties":{"name":"Prague"},"id":"CZ.SK","arcs":[[30]]},{"type":"Polygon","properties":{"name":"Středočeský"},"id":"CZ.SK","arcs":[[31,-23,-30,-29,-6,-2,32],[-31]]},{"type":"Polygon","properties":{"name":"Liberecký"},"id":"CZ.LK","arcs":[[33,-33,-1,34]]},{"type":"Polygon","properties":{"name":"Královéhradecký"},"id":"CZ.HK","arcs":[[-24,-32,-34,35]]},{"type":"Polygon","properties":{"name":"Moravskoslezský"},"id":"CZ.VK","arcs":[[-18,-19,36]]}]}},"arcs":[[[3745,9246],[-1,-11],[-4,-23],[-4,-13],[-6,-11],[-7,-8],[-44,-6],[-6,-8],[-5,-14],[-3,-21],[-3,-62],[-4,-30],[-8,-26],[-9,-21],[-12,-13],[-12,-5],[-12,6],[-78,138],[-10,8],[-8,-4],[-6,-20],[-16,-166],[-19,-30],[-7,-16],[-5,-18],[-3,-20],[1,-43],[-2,-17],[-4,-14],[-33,-54],[-7,-14],[-27,-122],[-21,-22],[-6,-13],[-6,-16],[-2,-18],[2,-21],[83,-454],[106,-151],[11,-92]],[[3548,7801],[-10,-12],[-6,-15],[-4,-15],[-2,-14],[-2,-19],[0,-24],[-1,-33],[-5,-31],[-3,-10],[-2,-8],[-9,-12],[-12,-12],[-44,-62],[-12,-13],[-9,-7],[-8,2],[-8,3],[-19,16],[-12,4],[-6,-8],[-1,-16],[2,-17],[7,-35],[2,-16],[1,-16],[-2,-25],[0,-14],[2,-13],[5,-29],[2,-13],[0,-15],[-1,-10],[-7,-19],[-3,-9],[-3,-17],[-5,-20],[-12,-31],[-11,-11],[-12,-4],[-26,3],[-41,-6],[-12,-6],[-12,-14],[-32,-46],[-11,-9],[-8,-4],[-48,32],[-116,-35],[-30,7],[-35,22],[-36,12],[-62,-4],[-18,-7],[-11,-9],[-6,-18],[-4,-17],[-1,-22],[-1,-17],[2,-26],[0,-14],[-3,-15],[-9,-23],[-11,-8],[-13,-2],[-20,2],[-14,-10],[-87,-96],[-9,-18],[-10,-22],[-8,-15],[-17,-23],[-10,-3],[-11,8],[-10,12],[-12,9],[-12,-2],[-141,-128],[-26,-12],[-8,0],[-6,3],[-9,8],[-9,4],[-16,1],[-13,-7],[-11,-12],[-5,-7],[-14,-26],[-63,-72],[-86,-63],[-18,-17],[-8,-16],[-20,-55],[-14,-60],[-14,-31],[-17,-20],[-38,-67],[-15,-13],[-23,-11],[-18,-17],[-16,-38]],[[1966,6161],[-31,-40],[-21,1],[-66,29],[-14,12],[-9,17],[-16,39],[-14,27]],[[1795,6246],[-17,28],[-31,39],[-11,20],[-5,12],[3,16],[2,9],[22,49],[6,17],[5,18],[-3,33],[-10,44],[-31,84],[-12,41],[-4,33],[3,19],[3,19],[1,22],[-2,41],[-5,52],[-2,47],[-1,27],[3,87],[0,35],[-3,34],[-7,54],[-8,26],[-9,19],[-23,21],[-42,19],[-45,4],[-37,14],[-19,24],[-10,25],[-10,34],[-8,17],[-9,12],[-96,20],[-25,25],[-50,72]],[[1308,7458],[32,55],[21,43],[10,74],[9,164],[13,15],[12,5],[12,-4],[12,-15],[13,-7],[14,-2],[13,2],[14,6],[0,1],[42,25],[78,-8],[36,47],[22,67],[49,228],[29,-5],[24,-29],[24,-19],[31,28],[16,81],[8,26],[56,68],[9,17],[1,15],[4,5],[18,-12],[8,-15],[20,-61],[10,-21],[33,-28],[28,11],[25,40],[25,56],[15,14],[9,19],[1,24],[-8,33],[24,32],[20,44],[6,54],[-17,62],[60,63],[67,22],[133,-1],[29,10],[56,36],[32,5],[68,-13],[26,10],[43,46],[9,0],[9,5],[10,25],[1,22],[-4,28],[-2,34],[7,39],[13,29],[13,1],[14,-7],[19,4],[15,20],[22,50],[16,19],[29,11],[54,-12],[29,4],[230,182],[18,29],[27,71],[16,27],[54,19],[116,-16],[43,64],[9,100],[-40,39],[-54,28],[-38,64],[2,43],[12,15],[2,8],[-29,20],[-50,12],[-17,19],[16,41],[21,116],[35,62],[47,13],[55,-31],[12,-17],[7,-23],[10,-22],[16,-15],[16,0],[42,31],[53,-5],[17,15],[13,56],[9,-34],[3,-25],[5,-24],[14,-33],[18,-22],[40,-17],[18,-25],[18,-37],[11,-32],[5,-39],[-3,-61],[-11,-48],[-18,-58],[-8,-49],[17,-23],[82,58],[18,-1],[8,-45],[-9,-54],[-25,-101],[-5,-72]],[[1966,6161],[18,-81],[1,-17],[-1,-22],[-4,-20],[-6,-21],[-7,-29],[1,-17],[5,-13],[7,-5],[9,-2],[7,1],[16,7],[30,29],[8,4],[8,0],[20,-14],[24,-10],[26,-21],[72,-122],[13,-14],[26,-6],[21,3],[20,8],[12,2],[14,-2],[28,-13],[16,-13],[13,-15],[39,-75],[10,-16],[8,-8],[49,-26],[10,-11],[6,-15],[1,-15],[4,-19],[77,-69],[13,-24],[7,-20],[-3,-14],[-1,-17],[1,-17],[2,-21],[15,-86],[1,-20],[0,-10],[-2,-7],[-4,-5],[-6,-5],[-8,-4],[-14,-3],[-4,-2],[-4,-5],[-3,-14],[0,-17],[1,-35],[-1,-18],[-1,-16],[-2,-11],[-18,-82],[0,-11],[0,-14],[4,-24],[1,-18],[0,-20],[-15,-89],[-3,-20],[0,-24],[2,-11],[4,-5],[14,-11],[11,-11],[3,-13],[1,-13],[-5,-17],[-37,-73],[-11,-19],[-12,-10],[-43,-19],[-19,-13],[-16,-19],[-18,-30],[-8,-19],[-4,-19],[6,-17],[23,-35],[2,-15],[-3,-12],[-12,-12],[-9,-13],[1,-6],[19,-20],[3,-11],[1,-10],[-2,-10],[-9,-14],[-4,-10],[-1,-14],[3,-31],[6,-15],[7,-9],[7,-4],[7,-6],[10,-13],[13,-27],[6,-20],[3,-22],[-1,-100],[2,-41],[3,-25],[5,-18],[15,-31],[10,-27],[3,-28],[0,-24],[-4,-39],[-7,-35],[-3,-11],[-2,-14],[1,-37]],[[2484,3753],[21,-83],[18,-131],[2,-34],[-1,-20],[-10,-76],[-3,-62],[3,-49],[8,-71],[2,-35],[-2,-27],[-6,-25],[-28,-84],[-14,-52],[-8,-51],[-6,-28],[-5,-18],[-7,-11],[-26,-27],[-6,-10],[-7,-16],[-1,-16],[0,-13],[8,-38],[0,-22],[-2,-16],[-4,-15],[-10,-22],[-5,-16],[-1,-16],[2,-14],[6,-14],[21,-38],[6,-29],[-1,-15],[-8,-13],[-12,-8],[-15,-18],[-13,-23],[-39,-132],[-15,-34],[-5,-8],[-7,-2],[-18,6],[-14,-11],[-15,-32],[-19,-88],[-6,-58],[1,-44],[3,-23],[1,-20],[0,-35],[-5,-24],[-7,-21],[-32,-56],[-34,-96],[-32,-123],[2,-37],[0,-2]],[[2139,1657],[-10,4],[-20,-17],[-14,-44],[-16,-70],[-34,29],[-47,61],[-42,71],[-22,62],[-1,113],[-16,70],[-63,115],[-45,107],[-18,28],[-29,20],[-90,8],[-42,44],[-23,67],[-20,80],[-138,335],[-19,19],[0,1],[-47,100],[-7,37],[-2,39],[-8,33],[-26,19],[-41,78],[-22,31],[-25,24],[-56,28],[-21,-12],[7,-51],[-28,-7],[-87,23],[-29,19],[-24,43],[-48,193],[-30,54],[-68,57],[-29,43],[-17,58],[-7,66],[-4,132],[-2,68],[-11,16],[-16,-4],[-17,9],[-16,29],[-11,31],[-10,36],[-9,48],[-6,47],[-7,89],[-10,44],[-16,31],[-35,34],[-15,32],[1,10],[7,32],[-12,10],[-4,5],[13,50],[-1,53],[-13,43],[-20,19],[-49,42],[-23,27],[-21,34],[-31,77],[-15,52],[-7,42],[17,61],[61,46],[24,42],[5,66],[0,85],[9,56],[30,-16],[11,63],[34,111],[12,61],[4,79]],[[662,5427],[70,-24],[14,5],[11,11],[40,71],[8,6],[9,1],[43,-29],[26,-5],[21,6],[7,8],[45,93],[10,9],[114,-4],[33,-60],[5,-6],[6,-2],[5,3],[37,48],[12,6],[5,-1],[39,-36],[24,-10],[10,5],[6,14],[20,171],[6,20],[8,12],[137,131],[31,62],[16,16],[7,3],[102,-35],[53,-105],[19,-13],[20,1],[8,6],[5,11],[3,15],[-18,119],[-1,24],[1,20],[3,16],[5,11],[86,33],[7,11],[-1,15],[-11,42],[-3,24],[-2,26],[2,24],[5,21],[10,17],[15,12]],[[6970,4230],[-6,-49],[-7,-30],[-8,-16],[-9,-4],[-47,20],[-10,-6],[-5,-16],[2,-24],[5,-28],[20,-60],[63,-111],[4,-13],[0,-11],[-4,-9],[-17,-14],[-3,-17],[1,-22],[4,-28],[37,-166],[1,-23],[0,-22],[-2,-20],[-5,-20],[-6,-19],[-10,-17],[-7,-18],[2,-20],[7,-20],[80,-111],[13,1],[13,10],[13,18],[24,47],[17,48],[5,22],[1,25],[-2,26],[-3,26],[-11,47],[-27,80],[-2,14],[-1,17],[3,49],[5,24],[10,14],[12,5],[15,-1],[58,-42],[10,-17],[18,-51],[13,-61],[10,-94],[5,-20],[8,-22],[68,-119],[5,-14],[4,-18],[2,-20],[-2,-79],[4,-22],[9,-18],[24,-26],[55,-31],[31,-51],[27,-74],[18,-73],[2,-29],[0,-23],[-2,-19],[-1,-7]],[[7501,2878],[-1,-9],[-25,-78],[-3,-26],[1,-34],[13,-79],[20,-74],[19,-47],[39,-42],[6,-11],[5,-16],[4,-22],[1,-24],[-3,-19],[-6,-16],[-18,-24],[-40,-26],[-8,-13],[-38,-98],[-22,-36],[-3,-19],[3,-19],[8,-18],[11,-15],[27,-21],[26,-1],[72,44],[11,-1],[9,-10],[4,-20],[1,-28],[-4,-125],[3,-21],[6,-15],[8,-13],[60,-51],[92,-34],[7,-9],[6,-15],[7,-43],[5,-58],[52,-40],[27,-38],[16,-44],[9,-10],[11,-2],[12,4],[47,46],[43,-11],[34,-24],[6,-10],[10,-29],[7,-38],[5,-42],[4,-18],[10,-12],[80,-43],[14,-17],[11,-26],[10,-32],[14,-71],[11,-91]],[[8237,1144],[-164,-116],[-54,15],[-45,86],[-22,18],[-35,-18],[-27,-32],[-29,-34],[-26,-9],[-168,154],[-71,33],[-67,-25],[-79,-104],[-14,-38],[-8,-76],[-22,-48],[-50,-79],[-37,-112],[-75,-389],[-17,-56],[-23,-51],[-4,-77],[-51,108],[-20,266],[-35,89],[-24,3],[-57,-36],[-29,-6],[-27,18],[-53,64],[-23,14],[-56,-4],[-24,7],[-19,25],[-11,47],[-5,58],[-12,49],[-28,20],[-28,6],[-88,46],[-25,29],[-14,9],[-13,-4],[-27,-20],[-15,-1],[-43,11],[-26,-31],[-75,-231],[-16,-28],[-23,-12],[-9,5],[-19,29],[-31,-9],[-1,-2],[-207,55],[-137,-15],[-78,61],[-149,195],[-2,20],[0,28],[-8,17],[-25,-11],[-2,42],[-11,18],[-16,1],[-19,-7],[15,36],[-12,-2],[-11,9],[-16,21],[-29,4],[-10,8],[-7,20],[-6,50],[-9,12],[-45,-1],[-13,-5],[-52,-50],[-25,-14],[-34,0],[-33,14],[-115,116],[-88,62]],[[5129,1389],[0,1],[4,38],[6,24],[5,32],[23,102],[7,42],[0,17]],[[5174,1645],[4,18],[7,11],[9,4],[10,-3],[10,-10],[11,-17],[28,-79],[9,-9],[8,4],[8,11],[12,32],[5,17],[10,22],[15,22],[10,7],[10,1],[10,-7],[44,-69],[9,-5],[9,2],[107,174],[42,34],[51,-8],[10,8],[7,18],[7,56],[6,19],[7,12],[8,5],[14,-1],[6,-3],[38,85],[11,11],[10,-2],[8,-18],[6,-25],[7,-17],[8,-11],[18,-8],[44,3],[9,6],[27,36],[6,3],[102,-30],[16,10],[12,18],[30,81],[6,10],[105,60],[32,71],[10,39],[2,19],[1,19],[-3,18],[-12,52],[-2,18],[0,19],[3,19],[6,21],[21,44],[6,23],[4,21],[-1,19],[-2,17],[-6,15],[-8,11],[-18,17],[-6,15],[-4,19],[-1,23],[2,51],[7,49],[5,19],[7,12],[31,22],[5,9],[2,14],[-1,15],[-3,12],[-10,34],[-3,15],[-1,19],[1,25],[3,28],[6,26],[15,45],[19,33],[129,140],[6,20],[1,24],[-1,28],[-28,155],[-3,29],[-4,184],[-8,54],[0,18],[5,14],[6,9],[45,14],[5,12],[5,19],[2,23],[1,25],[-1,25],[-4,23],[-5,19],[-41,72],[-3,17],[0,22],[18,80],[7,46],[4,45]],[[6383,4187],[35,-6],[175,31],[13,19],[5,16],[3,27],[2,33],[7,18],[13,9],[79,1],[11,-5],[19,-16],[13,-3],[50,7],[37,-6],[35,-22],[74,-66],[16,6]],[[9333,3302],[-3,-142],[-35,-49],[-54,-76],[-199,-138],[-44,-74],[-36,-103],[-27,-123],[-19,-132],[-5,-108],[0,-24],[2,-180],[-10,-89],[-31,-93],[-43,-73],[-49,-40],[-80,11],[-35,-10],[-32,-36],[-19,-70],[-9,-60],[-12,-125],[-12,-55],[-27,-47],[-28,-3],[-31,9],[-37,-11],[-24,-36],[-51,-157],[-26,-39],[-120,-85]],[[7501,2878],[2,-6],[6,-21],[5,-10],[6,-7],[6,-2],[8,4],[6,13],[4,20],[6,74],[4,21],[7,14],[10,6],[96,4],[6,-2],[5,0],[7,6],[5,10],[7,20],[8,18],[50,87],[5,11],[14,48],[-13,29],[-12,69],[2,69],[6,64],[28,-6],[9,-2],[23,-15],[36,-56],[32,-30],[13,-5],[63,-51],[15,-5],[9,6],[9,14],[8,22],[7,27],[7,23],[6,13],[7,11],[20,20],[25,19],[12,5],[105,-4],[11,3],[9,6],[6,12],[5,12],[3,17],[0,18],[-4,25],[-10,41],[-2,16],[3,12],[6,8],[18,13],[16,4],[23,-2],[130,-47],[40,32],[-5,43],[0,40],[1,20],[4,18],[4,14],[6,8],[18,18],[6,11],[5,16],[10,48],[6,18],[7,12],[8,6],[7,0],[8,-5],[8,-11],[14,-28],[8,-8],[18,-3],[22,10],[22,105]],[[8622,3905],[65,-2],[6,-6],[5,-11],[4,-17],[6,-50],[6,-20],[8,-14],[11,-10],[12,-5],[231,41],[14,-10],[44,-56],[10,-7],[113,3],[25,-17],[8,-15],[30,-117],[10,-20],[26,-28],[9,-19],[6,-23],[5,-25],[11,-116],[6,-24],[7,-17],[8,-11],[9,-6],[16,-1]],[[7856,6908],[23,-238],[-2,-19],[-4,-21],[-6,-21],[-8,-19],[-10,-14],[-10,-8],[-11,0],[-20,23],[-9,2],[-8,-6],[-8,-12],[-34,-87],[-120,-117],[-19,-40],[-7,-24],[-5,-28],[-3,-62],[-4,-21],[-15,-43],[-3,-15],[-1,-18],[16,-119],[1,-19],[-2,-18],[-5,-17],[-88,-217],[-6,-20],[-3,-22],[-2,-23],[1,-22],[3,-22],[6,-21],[41,-71],[4,-11],[0,-12],[-2,-14],[-43,-98],[-4,-20],[-3,-22],[-7,-147],[1,-18],[4,-15],[7,-13],[19,-15],[64,-15],[6,-8],[4,-11],[4,-40],[3,-13],[6,-11],[127,-113],[10,-1],[42,40],[10,3],[10,-7],[114,-217],[22,-19],[75,-7],[34,47],[8,6],[9,-1],[54,-64],[38,-5],[53,31],[43,-36],[34,-52],[7,-18],[2,-18],[-8,-133],[1,-26],[5,-22],[8,-15],[10,-6],[10,4],[27,31],[8,5],[9,-4],[8,-15],[45,-168],[10,-18],[47,-39],[39,-60],[16,-36],[5,-22],[7,-44],[3,-51],[42,-19],[19,-26],[22,-46]],[[6970,4230],[15,27],[9,61],[4,81],[3,28],[46,84],[-11,137],[-15,39],[-24,16],[-7,14],[-6,23],[-4,68],[-61,219],[-24,63],[-8,29],[-3,34],[2,32],[24,90],[-2,97],[1,109],[-1,24],[-11,77],[-6,90],[-3,20],[-4,18],[-10,32],[-1,19],[5,21],[25,26],[5,4],[9,10],[31,57],[45,57],[7,12],[4,14],[2,16],[-1,27],[-2,14],[-9,44],[2,42],[37,219],[56,250]],[[7089,6574],[17,7],[14,22],[24,59],[18,22],[13,1],[27,-17],[14,1],[3,15],[0,49],[4,11],[22,-1],[9,-10],[6,-25],[16,-41],[18,-12],[10,35],[-3,53],[-20,44],[-2,98],[-15,72],[-27,52],[-36,37],[-28,49],[-14,79],[-11,85],[-17,74],[-48,122],[0,56],[40,42],[34,-7],[42,-44],[22,-22],[34,7],[152,-74],[16,-18],[35,-50],[18,-18],[21,0],[45,16],[17,-9],[-3,-11],[5,-44],[9,-52],[9,-35],[15,-27],[52,-58],[35,-18],[69,4],[31,-23],[-27,-19],[4,-15],[5,-14],[6,-11],[7,-10],[-2,-53],[3,-51],[10,-41],[20,-26],[16,73],[33,5]],[[6383,4187],[-29,16],[-61,69],[-52,34],[-16,20],[-10,26],[-10,30],[-13,29],[-19,29],[-56,65],[-43,39],[-30,16],[-38,3],[-32,-5],[-16,6],[-11,14],[-5,18],[-4,20],[-11,19],[-16,16],[-34,13],[-22,14],[-20,18],[-21,25],[-10,7],[-9,0],[-6,-10],[-4,-10],[-7,-33],[-5,-16],[-7,-9],[-17,-10],[-7,-7],[-22,-46],[-15,-16],[-14,0],[-16,8],[-20,15],[-13,-2],[-11,-10],[-37,18],[-23,84],[-21,48],[-24,34],[-38,33],[-6,10],[-3,13],[-3,41],[-6,19],[-8,15],[-20,23],[-40,16],[-67,93],[-26,13],[-113,-16],[-9,8],[-15,31],[-38,109],[-29,59],[-64,75]],[[5041,5308],[2,32],[6,42],[8,38],[3,24],[2,22],[1,80],[1,18],[1,11],[4,15],[3,20],[-2,20],[-13,29],[-11,15],[-11,10],[-19,10],[-12,15],[-54,91],[-10,12],[-50,28],[-35,40],[-11,19],[-17,48],[7,19],[28,23],[30,14],[13,-1],[3,41],[0,14],[0,14],[-6,46],[-1,20],[0,21],[1,14],[4,12],[24,41]],[[4930,6225],[82,-54],[11,2],[90,148],[29,25],[22,3],[58,-50],[22,0],[45,23],[8,-4],[60,-72],[11,-5],[10,6],[7,16],[19,109],[7,26],[10,19],[73,38],[8,-6],[5,-13],[14,-104],[11,-42],[5,-15],[6,-10],[7,-3],[8,7],[94,162],[14,12],[62,2],[41,-21],[8,-11],[4,-15],[2,-22],[0,-82],[3,-26],[7,-21],[12,-15],[85,-30],[9,-12],[11,-41],[14,-38],[18,-28],[17,-15],[13,-6],[5,-8],[24,-52],[7,-9],[17,-7],[57,-87],[22,29],[22,16],[133,22],[20,18],[9,15],[7,18],[6,22],[6,51],[7,18],[8,12],[153,128],[9,19],[3,25],[2,55],[3,24],[5,19],[6,14],[7,7],[157,-88]],[[6667,6323],[51,-83],[62,-56],[60,8],[45,109],[33,41],[18,45],[16,55],[27,70],[33,50],[29,7],[30,-3],[18,8]],[[662,5427],[-9,29],[-21,14],[-60,62],[1,44],[11,55],[-4,58],[-25,42],[-55,10],[-22,39],[-2,0],[-223,210],[-5,26],[-1,37],[-3,41],[-13,40],[-21,32],[-24,24],[-21,34],[-13,61],[-1,60],[11,92],[-4,60],[-12,48],[-16,45],[-37,70],[-73,79],[-15,48],[19,49],[15,17],[10,19],[3,52],[-6,57],[-12,36],[-34,62],[37,-5],[71,-9],[29,-35],[8,-37],[0,-69],[6,-32],[16,-25],[22,-12],[42,-2],[11,-10],[5,-15],[-1,-18],[-7,-23],[-2,0],[-2,-2],[-2,-2],[-2,-3],[-4,-8],[-1,-8],[1,-9],[4,-9],[26,-46],[7,-15],[6,-26],[2,-24],[2,-20],[17,-111],[15,-41],[26,-6],[20,26],[0,36],[-8,43],[-5,50],[5,72],[8,38],[29,65],[4,64],[12,32],[17,20],[16,31],[46,145],[16,28],[44,42],[17,27],[5,6],[14,-1],[6,6],[3,14],[-1,16],[-2,14],[0,8],[4,18],[3,21],[5,20],[11,16],[41,61],[60,31],[110,14],[79,-25],[19,4],[17,28],[33,88],[19,33],[24,15],[24,3],[26,-7],[9,6],[21,24],[13,5],[13,-6],[137,-145],[50,-5],[12,20]],[[4210,3974],[21,-40],[6,-18],[4,-19],[0,-19],[-6,-18],[-10,-14],[-52,-27],[-9,-10],[-3,-16],[22,-141],[4,-65],[-2,-75],[-31,-218],[0,-29],[4,-24],[6,-20],[25,-42],[4,-11],[2,-14],[1,-19],[-3,-83],[2,-20],[4,-20],[8,-21],[55,-93],[28,-30],[14,-3],[13,7],[25,42],[13,8],[13,-2],[24,-25],[33,-57],[42,-51],[39,-92],[60,-69],[6,0],[6,8],[26,70],[8,10],[8,4],[9,-1],[78,-72],[6,-8],[17,-8],[72,-15],[13,-9],[8,-21],[6,-34],[3,-65],[3,-36],[5,-27],[8,-18],[70,-119],[5,-6],[7,-2],[25,8],[7,0],[69,-23],[21,3],[58,41],[6,3],[5,-1],[6,-7],[70,-123],[9,-23],[3,-14],[0,-11],[-4,-9],[-6,-9],[-8,-7],[-10,-5],[-33,-3],[-7,-3],[-4,-7],[-4,-16],[-1,-18],[-2,-29],[-3,-19],[-8,-27],[-48,-102],[-6,-16],[-3,-16],[-3,-32],[1,-16],[2,-10],[3,-2],[5,0],[5,-4],[4,-10],[7,-27],[5,-18],[9,-11],[11,-5],[23,-3],[17,-7],[8,-8],[6,-11],[8,-21],[1,-14]],[[5129,1389],[-34,23],[-73,114],[-32,33],[-66,39],[-71,65],[-33,17],[-69,2],[-7,9],[-7,20],[-7,16],[-11,0],[-6,-16],[-4,-54],[-5,-22],[-20,-44],[-8,-8],[-113,-55],[-29,1],[10,58],[0,54],[-6,55],[-11,57],[-115,17],[-82,50],[-33,-7],[-4,-7],[-3,-13],[0,-19],[2,-22],[-20,-85],[-1,-115],[6,-123],[0,-111],[-31,-253],[-11,-50],[-3,-28],[3,-26],[7,-32],[6,-26],[4,-7],[-17,-71],[-30,-5],[-77,57],[-77,19],[-22,-15],[-9,-39],[-6,-49],[-15,-47],[-7,-77],[-78,-123],[-28,-82],[-5,-109],[0,-123],[-7,-105],[-7,-12],[-23,-41],[-24,3],[-12,26],[-8,38],[-16,38],[-10,4],[-23,-14],[-11,2],[-5,17],[0,27],[-2,25],[-9,15],[-23,-3],[-44,-38],[-22,-9],[-18,7],[-59,56],[-35,75],[-22,-26],[-33,-159],[-23,-44],[-77,-60],[-30,-43],[-12,-8],[-14,-3],[-147,94],[-209,42],[-51,38],[-12,20],[-25,58],[-7,22],[-7,55],[3,11],[8,6],[10,38],[5,6],[7,-3],[7,4],[2,25],[-3,25],[-9,11],[-10,7],[-8,13],[-9,33],[-25,68],[-13,26],[-100,98],[-32,49],[-27,38],[-28,27],[-59,29],[-29,54],[-72,256],[-34,96],[-21,21],[-55,16],[-28,24],[-25,45],[-23,63],[-16,73],[-4,76],[-27,-5],[-25,25],[-25,36],[-26,28],[-24,9]],[[2484,3753],[85,89],[9,2],[7,-3],[17,-21],[8,-5],[31,-2],[10,-4],[8,-6],[9,-10],[27,-28],[12,-2],[15,3],[27,24],[8,11],[11,10],[71,40],[5,6],[4,8],[8,46],[7,28],[10,14],[16,16],[11,3],[11,-2],[15,-14],[18,-26],[9,-5],[27,-4],[19,-12],[40,-2],[86,20],[29,21],[27,48],[6,7],[7,4],[18,6],[24,0],[17,-8],[8,-8],[5,-9],[5,-26],[3,-11],[3,-6],[5,-3],[5,-1],[7,-5],[6,-7],[6,-13],[3,-9],[7,-18],[3,-6],[4,-5],[4,-4],[7,-4],[11,-2],[15,3],[70,69],[12,5],[18,1],[20,-8],[24,-24],[28,-7],[164,12],[19,-9],[-2,-12],[0,-11],[0,-10],[3,-5],[35,-10],[16,4],[16,8],[35,40],[22,39],[10,8],[48,19],[21,29],[9,25],[4,105],[1,13],[1,11],[9,33],[6,16],[5,10],[18,28],[7,4],[6,-2],[8,-15],[11,-26],[4,-9],[8,-8],[44,-23],[8,-13],[5,-15],[1,-11],[1,-26],[7,-8],[15,-3],[29,10],[17,-12],[10,-11],[4,-13],[4,-25],[5,-18],[6,-17],[8,-15],[7,-11],[6,-7],[7,-5],[10,3]],[[4210,3974],[12,9],[17,27],[6,20],[5,18],[2,14],[5,15],[4,8],[28,27],[4,8],[2,11],[-3,24],[-1,10],[0,10],[3,9],[4,7],[7,3],[12,-1],[58,-46],[17,-1],[20,4],[35,18],[43,-2],[24,-17],[42,11],[116,99],[4,49],[-4,44],[-8,35],[-7,22],[-8,17],[-67,88],[-7,16],[-3,18],[5,29],[7,22],[34,69],[12,31],[4,16],[2,16],[2,18],[3,17],[5,14],[6,13],[6,10],[2,2],[10,5],[5,0],[3,-2],[6,-8],[13,-13],[8,-3],[6,0],[6,2],[60,64],[52,35],[52,83],[9,9],[6,0],[8,-4],[24,-6],[20,7],[13,10],[8,14],[6,15],[3,17],[6,64],[2,17],[3,17],[3,9],[4,14],[6,14],[11,20],[5,6],[15,10],[5,11],[3,20],[-1,43],[1,33]],[[3715,5789],[-26,5],[-21,10],[-4,4],[-3,3],[-4,0],[-10,-2],[-14,-8],[-24,-31],[-22,-36],[-9,-9],[-66,-37],[-106,-33],[-62,-44],[-16,5],[-5,3],[-4,5],[-3,5],[-2,6],[-1,24],[1,27],[1,12],[1,28],[-2,14],[-4,16],[-40,81],[-4,9],[-3,11],[-3,14],[-8,48],[-6,25],[-4,12],[-37,80],[-4,12],[-2,9],[0,11],[1,10],[2,10],[5,16],[1,10],[1,9],[-2,8],[-4,8],[-9,13],[-27,29],[-4,10],[-3,7],[0,6],[1,6],[2,6],[3,7],[28,28],[70,45],[9,2],[9,-2],[36,-26],[8,-2],[8,3],[8,9],[6,11],[2,10],[0,13],[-3,14],[-1,16],[1,13],[4,11],[6,8],[194,99],[73,15],[16,-6],[10,-7],[8,-10],[23,-43],[18,-23],[7,-15],[5,-26],[6,-17],[11,-9],[35,-16],[6,-6],[5,-8],[10,-25],[5,-17],[5,-13],[5,-8],[10,-10],[31,-17],[9,-13],[6,-19],[2,-20],[0,-13],[-4,-15],[-12,-29],[-41,-71],[-5,-11],[-2,-8],[0,-7],[2,-8],[7,-24],[1,-11],[1,-13],[-2,-36],[1,-11],[3,-14],[3,-12],[3,-13],[1,-9],[-1,-10],[-2,-9],[-8,-29],[-33,-15],[-54,-5]],[[4518,7882],[3,-15],[-1,-15],[-4,-14],[-5,-13],[-1,-2],[-6,-21],[0,-32],[3,-24],[11,-32],[4,-18],[3,-18],[14,-163],[1,-39],[-2,-33],[-5,-23],[-13,-40],[-13,-31],[-4,-19],[-4,-32],[-3,-60],[3,-26],[3,-15],[4,-5],[73,-55],[9,-11],[9,-15],[13,-36],[5,-32],[4,-46],[5,-21],[8,-16],[9,-6],[11,-1],[10,1],[27,11],[14,-2],[40,-17],[61,14],[11,-2],[10,-7],[12,-19],[6,-24],[5,-23],[5,-68],[1,-55],[3,-33],[6,-43],[23,-114],[3,-23],[-1,-10],[-2,-9],[-2,-8],[-6,-16],[-24,-44],[-2,-12],[-1,-21],[4,-12],[4,-10],[24,-28],[11,-20],[14,-30],[20,-51],[6,-25],[1,-17],[-5,-11]],[[3548,7801],[16,8],[66,3],[28,-8],[23,3],[10,-3],[7,-6],[3,-10],[2,-12],[2,-9],[0,-12],[1,-13],[2,-11],[3,-10],[5,-5],[12,-3],[26,4],[133,60],[60,69],[54,45],[13,17],[17,30],[12,14],[24,23],[12,19],[11,23],[16,54],[6,16],[9,18],[31,45],[8,18],[17,49],[6,11],[7,6],[8,-1],[15,-10],[12,-1],[17,13],[11,5],[10,-2],[14,-21],[12,-10],[36,4],[7,-3],[8,-10],[28,-58],[9,-14],[11,-8],[10,-3],[38,17],[13,-118],[16,-50],[53,-82]],[[5096,8961],[21,-116],[49,-172],[4,-32],[-3,-22],[-5,-23],[-4,-30],[-2,-37],[2,-78],[4,-36],[7,-31],[18,-41],[7,-20],[4,-23],[3,-23],[1,-25],[-1,-24],[-11,-86],[1,-16],[2,-15],[50,-203],[3,-23],[1,-25],[-2,-27],[-6,-22],[-8,-12],[-11,-4],[-113,35],[-17,20],[-31,57],[-9,8],[-8,2],[-9,-1],[-38,-23],[-8,-11],[-5,-22],[-5,-128],[-3,-29],[-7,-21],[-8,-13],[-10,-5],[-10,2],[-11,8],[-22,33],[-46,101],[-28,40],[-64,45],[-16,0],[-15,-10],[-64,-126],[-8,-6],[-9,2],[-10,9],[-82,119],[-24,15],[-8,-1],[-7,-3],[-4,-4],[-3,-6]],[[3745,9246],[7,-30],[51,-25],[21,-20],[57,-75],[55,-21],[32,-2],[24,11],[14,29],[14,47],[24,108],[31,-2],[54,26],[168,-22],[4,35],[-2,140],[-2,11],[-1,16],[1,22],[5,14],[14,28],[5,21],[-2,117],[-22,56],[-24,33],[-7,45],[7,14],[8,11],[8,6],[8,4],[22,26],[7,19],[4,33],[28,-44],[75,-29],[12,-39],[18,-30],[21,-18],[16,6],[5,41],[0,1],[13,52],[20,23],[17,-15],[7,-61],[14,-59],[84,-2],[39,-34],[24,-66],[-2,-39],[-12,-42],[-11,-74],[5,-57],[13,-71],[18,-67],[16,-44],[29,-41],[27,-20],[22,-32],[18,-76],[0,-39],[-4,-40],[-1,-38],[10,-34],[18,-10],[3,-1],[16,30],[14,42],[14,30],[61,9],[119,-72]],[[5096,8961],[177,-107],[17,-19],[20,-52],[10,-19],[16,-8],[123,51],[37,-6],[3,-27],[5,-25],[74,-220],[10,-6],[41,2],[87,57],[25,-6],[20,-33],[19,-63],[13,-55],[8,-55],[-4,-48],[-21,-30],[-3,-13],[-1,-13],[1,-13],[3,-12],[63,20],[92,154],[62,-11],[47,-62],[22,-18],[25,9],[18,40],[11,51],[11,41],[19,7],[54,-2],[48,-22],[45,-44],[126,-231],[14,-77],[-47,-33],[6,-31],[0,-13],[-4,-11],[-7,-24],[-2,-20],[-2,-31],[0,-24],[4,3],[-12,-31],[-31,-53],[-14,-33],[-25,-10],[-47,23],[-24,-13],[-11,-53],[-22,-33],[-26,-26],[-23,-34],[-8,-5],[-14,-15],[-9,-2],[7,-44],[3,-13],[-29,12],[-12,-64],[14,-72],[48,-15],[19,-104],[7,-23],[19,-27],[11,5],[10,16],[18,9],[67,0],[14,-7],[11,-38],[1,-37],[-2,-37],[4,-35],[27,-61],[65,-42],[33,-40],[22,-53],[37,-119],[22,-51],[18,-59],[45,-82],[16,-76],[17,-137],[14,-51],[26,-59]],[[7856,6908],[32,-46],[14,-75],[7,-9],[8,-3],[8,3],[7,9],[44,92],[70,11],[132,-40],[35,15],[25,36],[44,106],[8,33],[4,28],[10,11],[25,-17],[8,-13],[27,-64],[4,-9],[1,-11],[-1,-12],[-4,-13],[-16,-75],[-3,-37],[4,-41],[15,-27],[23,-74],[-14,-61],[-30,-46],[-63,-66],[-39,-27],[-71,-5],[-17,-14],[-10,-41],[3,-29],[71,-159],[24,-19],[15,5],[12,13],[16,6],[19,-9],[40,-35],[21,-7],[1,-4],[0,-4],[0,-3],[-1,-3],[-14,-21],[-4,-22],[4,-23],[14,-24],[17,-35],[10,-44],[8,-50],[11,-48],[17,-40],[96,-168],[54,-20],[54,29],[43,68],[27,12],[59,4],[49,25],[7,18],[-3,40],[-10,28],[-13,0],[-11,-6],[-8,6],[-7,91],[25,-11],[21,-9],[86,-99],[-10,-75],[20,-39],[94,-31],[23,-22],[46,-71],[18,-13],[34,-13],[18,-23],[6,-22],[10,-62],[9,-28],[29,-42],[21,7],[42,64],[-2,7],[-2,4],[-2,3],[-4,0],[60,13],[57,-36],[110,-107],[34,0],[59,66],[22,-24],[9,-73],[-4,-61],[6,-50],[40,-37],[-41,-83],[1,-108],[25,-123],[35,-126],[15,-117],[9,-30],[20,-25],[46,-7],[21,-11],[19,-28],[29,-61],[19,-19],[21,3],[23,17],[23,7],[23,-29],[6,-31],[10,-139],[6,-38],[18,-71],[6,-36],[22,-172],[4,-83],[-6,-68],[-61,-2],[-27,-19],[-61,-99],[-42,-4],[-42,23],[-49,43],[-10,4],[-10,-4],[-42,-39],[-66,16],[-30,-34],[-8,-33],[-4,-75],[-7,-35],[-12,-22],[-49,-47],[-63,-137],[-33,-38],[-43,17],[-1,-49]]],"transform":{"scale":[0.0006761968921892251,0.0002482344791479239],"translate":[12.076140991000045,48.557915752000014]}};
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
