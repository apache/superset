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
  Datamap.prototype.czeTopo = '__CZE__';
  Datamap.prototype.deuTopo = '__DEU__';
  Datamap.prototype.djiTopo = '__DJI__';
  Datamap.prototype.dmaTopo = '__DMA__';
  Datamap.prototype.dnkTopo = {"type":"Topology","objects":{"dnk":{"type":"GeometryCollection","geometries":[{"type":"MultiPolygon","properties":{"name":"Midtjylland"},"id":"DK.","arcs":[[[0]],[[1]],[[2]],[[3,4,5,6]]]},{"type":"MultiPolygon","properties":{"name":"Syddanmark"},"id":"DK.","arcs":[[[7]],[[8]],[[9]],[[10]],[[11]],[[12,-6]]]},{"type":"MultiPolygon","properties":{"name":"Nordjylland"},"id":"DK.","arcs":[[[13]],[[14]],[[-4,15]]]},{"type":"MultiPolygon","properties":{"name":"Hovedstaden"},"id":"DK.","arcs":[[[16]],[[17]],[[18]],[[19]],[[20,21]],[[22,23]]]},{"type":"MultiPolygon","properties":{"name":"Sjaælland"},"id":"DK.","arcs":[[[24]],[[25]],[[26]],[[-21,27,-23,28]]]}]}},"arcs":[[[3135,3697],[-10,-9],[-95,20],[-10,12],[5,17],[74,17],[1,10],[16,63],[9,5],[12,-32],[6,-49],[-8,-54]],[[3559,4120],[25,-43],[17,12],[12,34],[10,18],[4,-21],[-20,-46],[-38,-61],[-7,-57],[2,-105],[-14,-55],[-46,-54],[-49,18],[-38,73],[-12,115],[8,64],[14,26],[21,14],[24,25],[19,40],[12,49],[-2,53],[-18,53],[-26,23],[-29,16],[-18,33],[5,78],[14,41],[21,28],[18,-7],[11,-132],[22,-54],[32,-36],[36,-13],[-12,-32],[-6,-33],[1,-33],[7,-31]],[[4911,6637],[-24,-11],[-29,3],[-27,19],[-17,34],[-4,46],[16,17],[120,16],[61,29],[0,-24],[-6,0],[-4,-5],[-9,-14],[-25,-15],[-19,-32],[-17,-35],[-16,-28]],[[1735,6600],[101,-61],[53,-36],[34,72],[-12,44],[11,31],[41,-4],[21,-29],[-9,-75],[39,-54],[160,-2],[28,-33],[-37,-53],[-10,-68],[27,-11],[46,31],[70,-98],[61,20],[38,-26],[24,-6],[59,11],[46,69],[56,40],[35,13],[84,12],[96,74],[47,82],[66,68],[46,65]],[[2956,6676],[69,-16],[59,4],[37,29],[34,16],[26,-70],[7,-104],[-24,-89],[-95,-90],[-70,-97],[-13,-8],[-10,-102],[-5,-29],[11,-35],[-6,-45],[-16,-42],[-17,-26],[43,3],[16,17],[-2,119],[5,86],[14,42],[59,55],[47,78],[25,20],[29,-23],[5,-20],[7,-67],[1,-20],[7,-10],[41,-44],[106,-74],[115,-17],[335,65],[46,-6],[46,-32],[21,-30],[46,-99],[87,-109],[0,-19],[-33,-40],[-17,-73],[-7,-83],[-1,-74],[-16,-70],[-129,-230],[-66,-56],[-25,-43],[-7,-42],[3,-98],[-19,-95],[-45,-12],[-49,45],[-33,73],[36,8],[15,17],[8,39],[-4,42],[-14,13],[-19,4],[-17,16],[-33,15],[-35,-51],[-32,-69],[-45,-66],[10,-73],[18,-80],[6,-53],[-13,-22],[-23,-14],[-24,-3],[-17,8],[-15,26],[-14,60],[-10,31],[11,15],[24,21],[13,7],[-10,35],[-12,17],[-58,22],[-13,-4],[-32,-25],[-39,-10],[-24,25],[-22,44],[-30,48],[31,4],[47,48],[27,12],[20,-18],[24,-33],[24,-12],[19,44],[-24,50],[2,39],[41,104],[-19,0],[-20,10],[-19,18],[-14,24],[-15,14],[-37,-22],[-19,20],[-5,-42],[-8,-26],[-12,-14],[-20,-4],[-10,-16],[-38,-104],[-35,-55],[-76,-78],[-34,-60],[-20,-73],[10,-46],[23,-43],[22,-65],[9,-79],[-5,-61],[-18,-55],[-25,-62],[34,20],[24,4],[7,-22],[-35,-99],[-4,-40],[3,-80],[-2,-54],[-2,-25],[-5,-26],[-34,-56],[-5,-22],[-7,0],[-15,-12],[-17,-20],[-9,-19],[7,-8],[10,-31],[5,-33],[-12,-23],[-5,-15],[-7,-15],[-13,-7],[-18,6],[-13,15],[-22,43],[-6,21],[-4,23],[-6,23],[-13,21],[-18,8],[-137,-8],[-18,-8],[-12,-19],[-9,-21],[-9,-16],[-37,-19],[-74,6],[-34,-11],[35,-49],[202,-56],[14,-14],[-5,-33],[-24,-64],[-11,-55],[3,-24],[20,-6],[37,1],[0,-22],[-58,-41],[-17,-36],[16,-51],[-5,-6],[-13,-18],[-33,26],[-155,-57],[-71,-48],[-41,-5],[-87,43],[-49,56],[-13,9],[-16,0]],[[2227,3582],[6,34],[2,28],[-8,27],[-16,19],[-31,12],[-47,8],[-15,12],[-2,24],[3,19],[6,18],[4,19],[-7,18],[-27,7],[-50,-7],[-22,10],[-20,31],[-35,76],[-32,48],[-8,29],[-5,22],[-2,16],[-10,24],[-72,112],[-35,40],[-45,35],[-132,55],[-53,-15],[-38,-98],[-66,-104],[-24,-25],[-25,-9],[-13,-12],[-12,-18],[-8,-16],[-12,-40],[-18,3],[-15,-18],[-49,-7],[-19,19],[-56,92],[-43,50],[-69,8],[-51,-32],[-22,-93],[-15,-28],[8,-53],[0,-21],[-23,-18],[-46,-18],[-24,9],[-99,89],[-45,15],[-15,-3],[-23,-13],[-24,-5],[-17,4],[-15,7],[-13,12],[-13,0],[-13,-4],[-10,-8],[-7,-9],[1,-10],[7,-20],[3,-10],[-1,-8],[-3,-7],[-71,-100],[-18,-25],[-26,-6],[-17,5],[-50,40],[-35,20],[-44,39],[-271,-4]],[[115,3873],[-56,517],[-7,32],[-4,7],[-2,15],[2,14],[4,7],[8,-4],[4,-8],[2,-8],[4,-3],[10,-17],[35,-241],[25,-83],[4,-35],[-4,-30],[-13,-43],[-4,-35],[5,-43],[12,-9],[64,45],[67,67],[32,14],[54,55],[57,74],[8,51],[-10,54],[-19,53],[-23,48],[-52,86],[0,98],[-16,112],[-37,73],[-48,43],[-109,62],[-30,5],[-12,-26],[1,-134],[-2,-64],[-9,-71],[5,-53],[-4,-20],[-20,8],[-6,17],[-6,33],[-5,38],[-7,228],[5,70],[34,197],[4,74],[-16,1087],[6,53],[10,54],[63,272],[29,84],[21,41],[8,-9],[6,-27],[13,-16],[-1,-22],[-32,-102],[-11,-28],[0,-21],[9,-11],[10,-6],[25,-3],[5,-13],[5,-31],[8,-30],[11,-14],[58,-12],[15,-14],[-20,-15],[5,-29],[-3,-50],[8,-30],[13,-12],[11,8],[4,21],[-9,26],[0,22],[44,18],[69,2],[62,-16],[28,-37],[13,-5],[69,-70],[20,11],[18,28],[15,35],[11,34],[8,0],[43,-148],[1,-24],[-5,-13],[2,-30],[9,-29],[23,-23],[28,-45],[16,-12],[24,0],[86,23],[9,6],[8,16],[5,24],[2,29],[0,46],[2,31],[8,65],[6,18],[8,7],[3,10],[-7,27],[-44,43],[-14,2],[-11,7],[-6,16],[-2,28],[-7,28],[-24,15],[1,33],[19,21],[64,5],[91,190],[21,16],[58,22],[78,4],[2,7],[-33,16],[-62,2],[-14,18],[13,56],[20,49],[17,27],[45,41],[67,80],[26,7],[15,-3],[26,-16],[16,-4],[16,5],[9,14],[7,14],[11,12],[25,1],[32,-13],[28,-26],[12,-38],[9,-74],[19,-43],[23,-31],[17,-35],[19,-67],[-39,-12],[-42,-81],[-35,-12],[0,-24],[5,-28],[-15,-28],[-38,-49],[-14,-44],[-1,-40],[6,-100],[10,-30],[23,5],[24,33],[18,103],[21,7],[26,-6],[22,6],[-9,30],[-11,11],[-14,-4],[-14,-14],[11,34],[11,25],[9,27],[7,43],[10,0],[-9,-71],[37,-10],[50,10],[32,-5],[19,-16],[22,5],[19,-2],[13,-40],[-4,-31],[-33,-58],[-12,-41],[15,-8],[3,-14],[1,-19],[9,-24],[14,-17],[35,-26],[6,-13],[4,-17],[6,-13],[13,-2],[21,53],[8,16],[20,-23],[17,25],[0,39],[-32,21],[-43,-32],[-3,-10],[-6,-2],[-15,1],[-12,9],[-1,18],[4,15],[4,1],[2,117],[23,100],[13,89]],[[3177,1031],[20,-12],[22,0],[16,8],[7,25],[-10,53],[20,-37],[17,-94],[15,-19],[30,-1],[19,7],[4,25],[-19,55],[23,-29],[27,-22],[19,-29],[0,-49],[13,-12],[15,-10],[-111,-33],[-30,-43],[-18,-9],[-32,19],[-242,341],[-23,71],[-8,49],[20,-30],[120,-86],[35,-41],[33,-68],[18,-29]],[[2393,1609],[84,-128],[45,-31],[62,-12],[45,-35],[36,-55],[35,-69],[21,-50],[55,-217],[-1,-30],[-20,-7],[-40,1],[-21,-14],[-27,-28],[-28,-20],[-20,10],[-23,26],[-65,26],[-24,22],[0,21],[38,24],[44,-24],[44,-41],[39,-23],[0,21],[-67,77],[-64,29],[-15,2],[-14,-7],[-20,-26],[-14,-10],[-55,4],[-47,49],[-28,83],[5,102],[-9,0],[0,19],[31,-28],[33,-49],[33,-37],[29,9],[-6,11],[-10,21],[-5,21],[5,9],[8,7],[-10,15],[-58,54],[-10,25],[17,30],[0,21],[-110,-13],[-20,3],[-14,13],[-17,4],[-15,8],[-7,28],[5,14],[26,26],[8,25],[-26,-2],[-23,-11],[-23,-6],[-24,19],[0,23],[124,76],[50,10],[58,-15]],[[3864,1158],[-136,-581],[-14,-38],[-19,-14],[-34,-1],[-16,30],[-36,185],[-16,34],[-19,28],[-43,46],[34,4],[22,12],[18,26],[22,46],[13,53],[8,15],[13,-16],[8,-5],[36,16],[-4,31],[-6,35],[-12,-13],[-12,-5],[-12,5],[-13,13],[20,76],[30,56],[78,117],[34,32],[80,148],[10,89],[47,155],[55,120],[32,-19],[-68,-388],[-26,-103],[-74,-189]],[[448,2734],[23,-17],[29,7],[20,-26],[0,-36],[-18,-71],[3,-31],[11,-35],[10,-58],[13,-26],[-35,-18],[-37,49],[-33,77],[-44,149],[-9,68],[14,45],[48,16],[5,-93]],[[3161,3272],[97,-85],[22,-34],[17,-39],[13,-21],[13,-9],[26,-4],[23,-11],[43,-38],[-23,12],[-22,0],[-16,-16],[-7,-37],[5,-14],[21,-21],[3,-19],[-7,-26],[-12,-7],[-14,-1],[-15,-9],[-53,-96],[23,-53],[50,3],[28,70],[16,-5],[91,60],[53,21],[6,10],[-3,21],[-6,22],[-7,10],[-13,4],[-13,11],[-11,14],[-6,16],[4,27],[17,-10],[19,-24],[8,-15],[18,35],[-5,49],[-14,56],[-9,53],[7,-14],[22,-29],[0,53],[-9,78],[0,21],[27,2],[41,-59],[67,-140],[3,-20],[1,-28],[3,-25],[7,-10],[4,-7],[30,-38],[9,-44],[-3,-25],[-13,-18],[-41,-33],[-66,-36],[-97,11],[-24,-6],[-17,-19],[-7,-40],[13,-20],[22,-1],[21,16],[-6,16],[-2,10],[11,33],[27,-9],[95,-28],[21,-24],[139,-257],[9,-28],[36,-135],[8,-52],[-10,0],[-17,34],[-25,21],[-24,-9],[-10,-56],[8,-38],[37,-77],[12,-46],[2,-68],[-3,-62],[-10,-53],[-21,-65],[-4,-23],[-2,-63],[-4,-16],[-35,-60],[-13,-38],[-10,-36],[-12,-31],[-23,-24],[-17,-5],[-55,5],[-64,0],[-23,-5],[-26,-16],[-25,-24],[-17,-31],[-26,-32],[-30,5],[-55,39],[-94,10],[-31,12],[-14,12],[-11,14],[-12,11],[-16,5],[-36,-4],[-18,2],[-111,90],[-41,5],[-10,-24],[-1,-69],[-22,21],[-33,50],[-23,17],[-29,1],[-53,-17],[-25,16],[108,106],[19,45],[-24,44],[-18,52],[-19,41],[-26,14],[-22,-7],[-16,-12],[-16,-8],[-23,4],[-32,42],[-19,9],[-17,-28],[5,-49],[48,-95],[-5,-53],[-7,-4],[-49,11],[-4,9],[2,13],[0,17],[4,-3],[4,13],[-2,26],[-20,70],[-3,34],[3,33],[9,30],[-2,25],[-21,17],[-57,18],[-18,14],[-15,18],[-7,15],[-3,17],[-13,29],[-3,19],[3,19],[13,28],[3,18],[-3,34],[-13,56],[-3,17],[4,108],[-14,15],[-22,2],[-41,-6],[-19,9],[-20,23],[-34,56],[23,11],[27,4],[23,12],[14,35],[-77,43],[12,-3],[36,3],[-14,37],[-26,20],[-56,10],[-20,10],[-47,75],[0,20],[37,-22],[40,-44],[39,-32],[37,12],[-139,157],[-53,15],[11,32],[14,13],[15,7],[19,14],[52,86],[76,19],[26,-6],[5,-16],[1,-27],[12,-34],[68,-47],[73,33],[140,121],[182,77],[62,58],[35,15],[37,3],[12,-3],[0,-10],[9,-44],[1,-10],[20,9],[5,24],[-5,64],[20,7],[43,-26]],[[2227,3582],[-130,1],[-33,20],[-4,-12],[-3,-9],[-2,-9],[-1,-15],[30,-18],[101,-1],[18,-15],[73,-95],[15,-37],[11,-34],[14,-24],[28,-10],[134,0],[-23,-36],[-73,-73],[-39,-64],[-19,-16],[-33,-6],[-12,-13],[-2,-30],[-1,-29],[-5,-14],[-88,-28],[-32,-29],[-20,-7],[-17,5],[-31,17],[-19,0],[4,-13],[6,-9],[-21,-37],[-52,-21],[-24,-28],[25,-20],[27,3],[69,23],[13,9],[13,5],[82,-56],[5,-35],[-6,-43],[-15,-38],[-19,-17],[-48,-12],[-21,-14],[8,-35],[17,-47],[5,-25],[-4,-35],[-8,-28],[2,-23],[29,-23],[17,-21],[17,-29],[4,-31],[-19,-24],[0,-24],[14,-21],[52,-114],[18,-9],[16,-21],[6,-51],[-5,-37],[-10,-23],[-9,-27],[-5,-51],[-7,-23],[-18,-16],[-22,-9],[-20,-4],[-83,20],[-19,-7],[-11,-16],[-9,-21],[-13,-20],[-34,-28],[-21,-11],[-18,-4],[-11,-14],[0,-27],[12,-23],[24,0],[0,-22],[-42,2],[-19,-7],[-17,-19],[14,-13],[18,-6],[40,0],[19,-12],[21,-28],[33,-67],[-36,-62],[-24,-29],[-27,-18],[-64,-17],[-25,-25],[12,-44],[17,-1],[80,42],[36,-3],[12,3],[10,10],[10,15],[12,14],[16,6],[30,-17],[57,-81],[29,-31],[77,-27],[19,-18],[11,-46],[31,-238],[4,-14],[-3,-10],[-13,-14],[-21,0],[-20,15],[-16,3],[-11,-39],[17,-8],[17,-13],[14,-19],[9,-23],[6,-26],[3,-37],[-7,-32],[-20,-14],[-17,14],[-20,58],[-12,14],[-59,-6],[-18,6],[-26,20],[2,13],[11,12],[3,19],[-25,47],[-9,28],[10,13],[37,19],[-7,36],[-34,25],[-40,-16],[-7,-18],[-19,-64],[-16,-35],[-9,-24],[-6,-11],[-11,-4],[-23,4],[-10,-10],[-24,-37],[-58,-64],[-19,-39],[-10,-66],[2,0],[-1,-1],[-21,-9],[-23,3],[-29,35],[-25,-7],[-16,-18],[-20,-7],[-13,-19],[-22,-5],[-102,1],[-25,13],[-11,37],[-4,44],[-6,31],[-24,27],[-298,91],[-111,59],[-113,25],[-32,-7],[-96,-46],[-52,3],[-50,20],[12,54],[-11,21],[19,87],[-12,80],[-22,77],[-14,80],[6,102],[16,84],[20,77],[16,82],[-150,34],[-17,-2],[-5,-26],[-3,-122],[-9,-16],[-14,-3],[-18,-26],[-19,-35],[-22,-17],[-22,7],[-19,34],[-16,78],[2,76],[9,76],[5,81],[26,62],[59,11],[59,-22],[30,-40],[-19,-6],[-15,-17],[-25,-41],[5,-35],[83,-16],[77,-23],[29,14],[-4,60],[-25,107],[-19,135],[-10,134],[3,36],[12,44],[3,27],[-2,40],[-16,79],[-13,142],[-10,67],[-20,60],[-36,36],[-50,16],[-94,3],[-68,27],[-57,68],[-128,242],[1,23],[30,7],[0,19],[-27,14],[-33,4],[-31,-11],[-25,-26],[-16,-45],[4,-29],[42,-57],[-13,-4],[-8,-7],[-18,-32],[32,-7],[39,-32],[32,-47],[13,-54],[-18,-9],[-169,178],[-34,25],[-83,20],[-21,27],[-2,47],[79,268],[27,122],[17,129],[3,127],[-11,100]],[[1151,7501],[-4,-23],[3,-14],[14,-43],[3,-27],[-3,-7],[-17,-102],[-11,-39],[-8,-14],[-10,-11],[0,37],[-7,24],[-11,15],[-11,9],[-33,-33],[-6,-12],[-4,-33],[3,-20],[7,-14],[4,-17],[12,-104],[12,-32],[25,-14],[-9,-15],[-9,-7],[-10,-2],[-12,1],[11,-9],[9,-12],[-18,-35],[-22,-72],[-18,-42],[-19,-29],[-58,-58],[-7,-55],[-113,-38],[-39,-26],[-14,9],[-38,103],[-15,26],[-35,45],[-34,21],[-8,2],[-44,-20],[-15,3],[5,37],[7,15],[10,14],[13,10],[13,4],[7,14],[-3,30],[-5,30],[-3,12],[39,36],[99,17],[36,56],[-18,-2],[-18,2],[-16,7],[-16,12],[8,30],[28,47],[12,33],[-4,-3],[-3,26],[-2,52],[4,11],[11,0],[13,-2],[9,1],[41,19],[82,17],[42,28],[31,-13],[28,46],[47,120],[33,-26],[20,35],[16,41],[18,-7],[-8,-26],[-17,-39]],[[4360,8662],[10,-38],[-1,-34],[-10,-26],[-31,7],[-34,15],[-108,-32],[23,-23],[16,-47],[-4,-51],[-34,-45],[-19,-38],[-12,-43],[-23,-34],[-43,-12],[-28,28],[-37,84],[-50,12],[-39,25],[-25,29],[-23,31],[0,20],[47,13],[47,54],[35,39],[57,4],[33,13],[25,34],[104,-1],[57,37],[39,1],[16,-7],[12,-15]],[[1735,6600],[0,1],[-29,81],[-13,19],[-8,8],[-28,-5],[-56,-32],[-14,-25],[-31,-24],[-29,-2],[-13,40],[16,38],[65,49],[14,52],[9,44],[-3,22],[-36,15],[-14,16],[-12,21],[-10,22],[-7,20],[-8,32],[-6,38],[2,39],[7,10],[32,62],[4,15],[7,16],[-1,37],[-7,36],[-9,16],[-17,5],[-12,10],[-23,30],[27,79],[26,62],[28,51],[44,55],[10,7],[11,4],[12,2],[7,10],[8,44],[5,10],[208,86],[47,-2],[164,-84],[0,-23],[-18,-15],[-1,-20],[11,-18],[19,-12],[19,2],[14,17],[51,99],[23,57],[26,45],[56,25],[46,36],[67,-21],[151,21],[-84,95],[-42,19],[-28,29],[-15,7],[-12,-7],[-49,-83],[-27,-34],[-30,-18],[-27,25],[-25,32],[-27,-9],[-49,-56],[-57,-29],[-122,-2],[-323,-142],[-27,-4],[-27,15],[-158,162],[9,-41],[-11,-22],[-47,-23],[-34,-32],[-18,-10],[-24,-1],[9,20],[-25,20],[-25,-7],[-24,-24],[-23,-32],[-23,3],[-29,-35],[-24,-37],[-11,-6],[-12,42],[-28,16],[-32,-4],[-24,-20],[21,-27],[-51,-59],[-70,-45],[-50,18],[-33,-9],[-33,-18],[-15,-23],[-8,-61],[-19,-37],[-22,-28],[-19,-35],[-8,-89],[-1,-7],[-3,-28],[-6,-15],[-10,-13],[-44,-85],[-32,-4],[-15,-9],[-7,-18],[-10,-12],[-23,-12],[-23,-21],[-11,-42],[12,-106],[-1,-50],[-21,-29],[0,-19],[56,7],[13,-7],[10,-39],[-8,-26],[-18,-16],[-19,-5],[-16,6],[-33,30],[-19,7],[-16,-6],[-29,-29],[-17,-8],[0,-24],[67,24],[20,-8],[29,-29],[14,-6],[100,53],[20,-10],[4,-23],[-4,-60],[0,-26],[21,-42],[10,-30],[-21,-46],[-14,-22],[-19,-11],[-20,-3],[-13,-10],[1,-14],[18,-14],[-29,0],[-39,44],[-35,58],[-14,37],[-13,47],[-32,38],[-39,25],[-37,9],[-25,16],[-29,40],[-28,49],[-18,43],[-16,113],[-9,18],[-19,8],[-40,32],[-23,3],[20,-116],[7,-68],[-3,-43],[-21,-4],[-11,66],[-3,145],[17,130],[31,97],[253,504],[76,97],[116,225],[45,52],[50,-1],[118,-51],[66,-5],[127,36],[57,35],[67,92],[25,14],[353,-63],[128,19],[127,58],[121,99],[106,144],[303,680],[54,96],[97,131],[49,113],[18,16],[34,59],[68,16],[130,-11],[127,26],[115,62],[100,88],[172,214],[93,84],[39,18],[42,5],[41,-12],[33,-32],[-77,-35],[-73,-85],[-115,-215],[-43,-188],[40,-142],[71,-130],[53,-153],[-41,-139],[1,-163],[29,-322],[-24,-47],[-72,-65],[-33,-51],[-50,-127],[-23,-86],[-16,-135],[-35,-151],[-17,-50],[-12,-22],[-11,-12],[-16,-6],[-66,1],[-20,-6],[-26,-10],[-118,98],[-87,115],[-58,29],[-47,59],[-35,13],[-29,-19],[-40,-80],[-27,-8],[27,-4],[29,47],[25,21],[25,16],[29,-16],[139,-179],[46,-27],[54,-61],[31,-13],[114,-4],[26,-18],[-39,-60],[-9,-26],[-7,-41],[-7,-86],[-5,-23],[10,-51],[15,-161],[6,-126],[10,-67],[35,-133],[12,-21],[14,-18],[3,-21],[-19,-28],[-12,-1],[-33,19],[-18,6],[-63,0],[-22,-13],[-26,-30],[-23,31],[-27,24],[-30,8],[-36,-20],[-31,-31],[-14,-7],[-22,-5],[-22,-13],[-43,-44],[-52,-23],[-63,-59],[-197,-35],[0,-21],[64,-14],[211,80],[47,36],[21,7],[5,7],[1,14],[2,15],[11,7],[11,-4],[19,-16],[9,-4],[15,5],[17,13],[15,17],[6,21],[9,42],[22,7],[47,-19],[-4,-11],[-7,-30],[24,-6]],[[9570,2088],[53,-55],[39,11],[27,-10],[23,-63],[15,-24],[17,-14],[101,-92],[66,-29],[28,-38],[-6,-16],[-3,-10],[-4,-9],[-6,-8],[10,-46],[4,-29],[-4,-27],[-15,-38],[-30,-64],[-9,-31],[5,-26],[0,-20],[4,-37],[-22,-33],[-15,-27],[-20,-24],[-69,24],[-57,6],[-78,39],[-97,78],[-110,40],[-114,120],[-22,38],[18,67],[6,132],[7,191],[4,32],[12,35],[28,62],[11,47],[10,54],[12,33],[20,-17],[56,-105],[20,-27],[32,-43],[53,-47]],[[9999,2360],[-1,-12],[-3,10],[0,12],[4,-10]],[[6590,3271],[-9,-7],[-8,10],[-2,14],[-5,7],[-9,6],[-9,15],[-13,36],[1,11],[12,73],[13,21],[13,7],[13,-9],[12,-23],[4,-42],[-1,-63],[7,-17],[0,-5],[-4,-11],[-15,-23]],[[6315,3096],[-31,-11],[-30,59],[-20,86],[0,71],[15,40],[18,26],[18,21],[15,22],[15,39],[24,78],[19,31],[6,-19],[2,-8],[2,-14],[82,-259],[1,-14],[-50,-72],[-21,-8],[-26,-20],[-24,-25],[-15,-23]],[[5462,3622],[-67,52],[-22,8],[-2,-3],[-3,-8],[-17,-11],[-53,-5],[-2,1]],[[5296,3656],[1,2],[-3,22],[-13,40],[-3,12],[5,36],[11,45],[23,71],[21,28],[50,18],[25,18],[23,89],[-29,102],[-33,93],[10,59],[25,-2],[50,-66],[26,-17],[13,-14],[0,-32],[-6,-35],[-2,-25],[6,-39],[5,-15],[7,-9],[11,-24],[26,-92],[25,-130],[4,-121],[-36,-67],[-51,23],[-25,-4]],[[6007,3255],[-60,37],[-50,8],[-41,-8],[-17,16],[-28,-21],[-27,-2],[-43,25],[-2,37],[-6,14],[-3,17],[2,22],[1,12],[3,10],[0,8],[-1,7],[-1,6],[-11,19],[49,50],[33,16],[55,51],[4,14],[-3,7],[-27,21],[-5,7],[-3,8],[-3,8],[-3,17],[20,23],[-103,23],[-23,29],[-54,66],[-52,1]],[[5608,3803],[-32,186],[0,111],[-5,45],[-33,168],[-22,44],[-26,16],[-30,-2],[-108,-55],[-40,-9],[-24,27],[24,78],[73,78],[134,104],[215,229],[112,79],[118,-6],[121,-88],[101,0],[27,-18],[49,-56],[42,-22],[73,-77],[-19,-50],[-58,-99],[-21,-53],[-38,-125],[-18,-36],[0,-23],[39,-71],[20,-49],[8,-40],[7,-59],[15,-70],[19,-61],[18,-38],[-6,-31],[-3,-42],[-1,-67],[-8,-54],[-2,-21],[2,-15],[5,-16],[13,-33],[-29,-49],[-57,-139],[-53,-47],[-9,-38],[-14,-38],[-31,-13],[-23,10],[-17,18],[-18,14],[-29,1],[-62,-46]],[[4453,1213],[67,-70],[25,-15],[25,-27],[42,-119],[34,-27],[34,-10],[250,-183],[-13,55],[-17,34],[-1,27],[31,34],[39,0],[34,20],[14,3],[-13,34],[-3,40],[2,39],[4,36],[108,-126],[8,-46],[34,-56],[21,-21],[23,-9],[-14,-17],[-6,-4],[21,-56],[70,-76],[16,-30],[4,-52],[5,-23],[0,-18],[-14,-37],[-16,-23],[-14,-8],[-13,-10],[-11,-34],[56,-32],[-6,-68],[-45,-66],[-62,-27],[-220,62],[-71,-21],[-67,-41],[-53,-64],[-32,7],[-131,101],[-86,97],[-155,128],[-70,20],[-75,46],[-76,23],[-30,35],[-14,47],[9,54],[35,26],[43,-9],[40,4],[26,66],[-23,11],[-19,19],[-75,121],[-9,21],[0,54],[19,50],[59,91],[20,-13],[202,54],[34,-21]],[[4878,1244],[-26,-53],[-8,6],[-50,94],[29,17],[42,0],[17,-17],[5,-20],[-2,-17],[-7,-10]],[[6258,1363],[23,-108],[-3,-34],[-13,-19],[-23,-8],[-33,-1],[-166,46],[-51,-9],[-49,-29],[-48,-51],[-75,-132],[-26,-20],[-41,9],[-90,57],[0,20],[20,0],[-6,32],[6,25],[13,17],[15,11],[-7,10],[-14,24],[-7,9],[31,46],[18,11],[18,-14],[11,24],[-11,42],[23,-2],[34,-31],[21,-9],[14,3],[46,25],[17,14],[-8,32],[0,25],[6,19],[12,10],[0,22],[-46,42],[-12,22],[-7,32],[4,21],[16,11],[25,0],[31,-69],[47,-28],[115,-10],[124,-33],[46,-54]],[[5462,3622],[-10,-52],[-10,-36],[-49,-61],[-19,-44],[29,-7],[40,23],[33,43],[4,51],[23,12],[23,-10],[20,-27],[12,-40],[-44,19],[-6,-7],[9,-29],[21,-22],[48,-25],[12,66],[33,100],[4,70],[-27,157]],[[6007,3255],[-39,-29],[-28,-36],[-89,-118],[0,-1],[-71,-184],[38,-165],[68,-78],[24,-10],[87,-8],[23,-14],[61,-65],[32,-49],[14,-47],[3,-53],[6,-46],[20,-85],[-21,-33],[-8,-10],[-73,-66],[-296,-89],[-22,-31],[-36,-29],[-28,-53],[-17,-64],[8,-54],[-11,-27],[-12,-11],[-12,2],[-13,15],[10,67],[-16,43],[-29,12],[-27,-26],[-13,-15],[-11,-5],[-7,-11],[-3,-33],[7,-13],[41,-40],[118,-14],[53,-23],[12,-73],[-8,-31],[-9,-13],[-10,-6],[-12,-12],[-29,-21],[-14,-17],[10,-7],[53,-150],[-1,-60],[-19,-32],[-29,-13],[-33,-3],[-22,-11],[-47,-46],[-33,-9],[-49,27],[-76,93],[-48,11],[0,-15],[2,-4],[4,1],[4,-4],[-8,-6],[-4,-7],[-5,-6],[-11,-4],[6,-60],[-10,-36],[-13,-31],[-3,-45],[10,-35],[19,-21],[21,-3],[18,18],[-4,12],[-7,29],[13,3],[36,21],[11,-18],[20,-58],[3,-12],[13,-12],[46,-58],[23,-16],[26,4],[27,11],[26,1],[21,-26],[40,-78],[43,-64],[0,-20],[-125,-131],[-20,-30],[-56,-136],[-7,-26],[-14,-13],[-38,-59],[-15,-14],[-20,-44],[-1,-99],[16,-179],[-4,-112],[-28,-4],[-29,48],[-7,45],[-20,36],[-46,117],[-10,40],[2,65],[17,51],[38,79],[-28,8],[-20,17],[-5,32],[15,52],[-16,12],[-9,16],[-14,37],[-65,87],[-5,15],[-6,26],[-3,25],[1,17],[0,17],[-9,25],[-24,36],[-22,23],[-16,31],[-5,62],[-1,58],[-4,44],[-15,31],[-28,17],[0,24],[54,55],[13,7],[20,-9],[27,-44],[16,-9],[15,12],[32,44],[6,-5],[9,-17],[20,14],[29,38],[0,19],[-15,25],[-26,96],[-17,31],[-94,58],[-27,7],[-8,6],[-18,30],[-12,6],[-89,7],[-27,19],[-23,27],[-20,35],[76,-21],[148,-88],[74,-21],[-31,73],[-87,83],[-37,79],[122,29],[8,13],[-4,25],[-30,32],[-80,-7],[-24,41],[20,28],[12,37],[-2,36],[-22,26],[-31,-1],[-24,-27],[-20,-35],[-21,-23],[-18,2],[-52,30],[-106,34],[-26,20],[-19,-13],[-97,56],[-18,-6],[-39,-28],[-20,-9],[-97,0],[0,-22],[29,-21],[-49,2],[-35,17],[-22,44],[-9,87],[20,-19],[21,-1],[17,20],[9,43],[-15,-14],[-15,-7],[-33,-2],[-4,17],[4,76],[-9,18],[-26,19],[-77,91],[-13,29],[13,8],[20,3],[17,11],[2,32],[-11,15],[-20,8],[-21,1],[-15,-3],[-10,-17],[-6,-26],[-10,-21],[-22,0],[-9,14],[-20,70],[0,23],[38,-5],[20,3],[14,13],[13,20],[16,17],[17,12],[17,4],[29,17],[14,38],[-1,38],[-17,17],[5,32],[-12,70],[-28,112],[-18,39],[-18,27],[-21,15],[-29,5],[-26,-23],[-16,-6],[-6,17],[2,43],[8,23],[14,9],[19,1],[37,18],[15,45],[-4,59],[-19,61],[-63,99],[-68,52],[-154,52],[0,24],[222,-24],[-23,53],[-88,48],[-34,28],[-15,31],[-8,24],[-11,18],[-24,15],[-73,7],[-23,16],[0,20],[222,-43],[46,10],[88,44],[49,10],[0,-21],[-16,3],[-15,-2],[-14,-6],[-13,-15],[22,-54],[37,-43],[41,-16],[36,26],[-59,64],[19,23],[14,-17],[23,-7],[51,1],[23,12],[48,43],[48,14],[22,15],[16,29],[7,47],[2,24],[6,44],[2,20],[-5,25],[-25,45],[-9,25],[36,-30],[35,-7],[33,17],[30,44],[48,-14],[39,86],[8,124],[-47,104],[-41,21],[-90,9],[-112,53],[-32,35],[-13,55],[180,-108],[37,11],[217,-43],[26,-31],[58,4],[100,39],[51,39],[29,8],[16,-28],[-6,-31],[-40,-60],[-12,-37],[17,-33],[-10,-21],[-22,-5],[-23,16],[3,11],[5,32],[-45,-4],[-18,-12],[-14,-27],[70,-155],[27,-86],[-20,-62],[-21,-4],[-44,15],[-21,-11],[-26,-46],[-16,-18],[-26,0],[0,-23],[23,-10],[69,10],[19,10],[22,22],[25,17],[26,-4],[9,-26],[15,-51],[11,-51],[-1,-23],[-113,-26],[-25,-13],[-11,-19],[18,-26],[20,-3],[64,6],[13,7],[11,16],[23,-30],[34,-64],[10,-41],[0,-16],[-9,-19],[-11,-53],[25,30],[18,30],[59,163],[3,4]]],"transform":{"scale":[0.0007100563571357142,0.00031828947874788083],"translate":[8.094004754000082,54.56858958500008]}};
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
