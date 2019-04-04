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
  Datamap.prototype.dnkTopo = '__DNK__';
  Datamap.prototype.domTopo = {"type":"Topology","objects":{"dom":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Santiago"},"id":"DO.ST","arcs":[[0,1,2,3,4,5]]},{"type":"Polygon","properties":{"name":"Santiago Rodríguez"},"id":"DO.SR","arcs":[[6,-4,7,8,9,10]]},{"type":"Polygon","properties":{"name":"Valverde"},"id":"DO.VA","arcs":[[-5,-7,11,12]]},{"type":"Polygon","properties":{"name":"San Juan"},"id":"DO.JU","arcs":[[-3,13,14,15,16,-8]]},{"type":"Polygon","properties":{"name":"Santo Domingo"},"id":"DO.SD","arcs":[[17,18,19,20,21,22]]},{"type":"Polygon","properties":{"name":"Sánchez Ramírez"},"id":"DO.SZ","arcs":[[23,24,25,26]]},{"type":"Polygon","properties":{"name":"San Pedro de Macorís"},"id":"DO.PM","arcs":[[27,28,29,-18,30,31]]},{"type":"Polygon","properties":{"name":"Monte Cristi"},"id":"DO.MC","arcs":[[32,-12,-11,33,34]]},{"type":"Polygon","properties":{"name":"Puerto Plata"},"id":"DO.PP","arcs":[[35,-6,-13,-33,36]]},{"type":"Polygon","properties":{"name":"Dajabón"},"id":"DO.DA","arcs":[[-10,37,38,-34]]},{"type":"Polygon","properties":{"name":"Espaillat"},"id":"DO.ES","arcs":[[39,40,41,42,-1,-36,43]]},{"type":"Polygon","properties":{"name":"Hermanas"},"id":"DO.","arcs":[[44,45,-42]]},{"type":"Polygon","properties":{"name":"Bahoruco"},"id":"DO.BR","arcs":[[46,47,48,-16]]},{"type":"Polygon","properties":{"name":"Barahona"},"id":"DO.BH","arcs":[[49,50,51,52,-48]]},{"type":"Polygon","properties":{"name":"Independencia"},"id":"DO.IN","arcs":[[-49,-53,53,54,55]]},{"type":"Polygon","properties":{"name":"La Estrelleta"},"id":"DO.EP","arcs":[[-17,-56,56,-38,-9]]},{"type":"MultiPolygon","properties":{"name":"Pedernales"},"id":"DO.PN","arcs":[[[57]],[[58,-54,-52]]]},{"type":"Polygon","properties":{"name":"Azua"},"id":"DO.AZ","arcs":[[59,60,61,-50,-47,-15,62]]},{"type":"Polygon","properties":{"name":"La Vega"},"id":"DO.VE","arcs":[[-46,63,-26,64,65,-63,-14,-2,-43]]},{"type":"Polygon","properties":{"name":"Monseñor Nouel"},"id":"DO.MN","arcs":[[-25,66,67,68,-65]]},{"type":"Polygon","properties":{"name":"Peravia"},"id":"DO.PV","arcs":[[69,-61,70,71]]},{"type":"Polygon","properties":{"name":"San José de Ocoa"},"id":"DO.JO","arcs":[[72,-71,-60,-66,-69]]},{"type":"Polygon","properties":{"name":"Duarte"},"id":"DO.DU","arcs":[[73,74,75,-27,-64,-45,-41]]},{"type":"Polygon","properties":{"name":"Hato Mayor"},"id":"DO.HM","arcs":[[76,-32,77,78,79]]},{"type":"Polygon","properties":{"name":"Monte Plata"},"id":"DO.MP","arcs":[[80,-78,-31,-23,81,-67,-24,-76]]},{"type":"Polygon","properties":{"name":"María Trinidad Sánchez"},"id":"DO.MT","arcs":[[82,-74,-40,83]]},{"type":"Polygon","properties":{"name":"Samaná"},"id":"DO.SM","arcs":[[-79,-81,-75,-83,84]]},{"type":"Polygon","properties":{"name":"San Cristóbal"},"id":"DO.CR","arcs":[[-22,85,-72,-73,-68,-82]]},{"type":"Polygon","properties":{"name":"Distrito Nacional"},"id":"DO.NC","arcs":[[86,-20]]},{"type":"Polygon","properties":{"name":"El Seybo"},"id":"DO.SE","arcs":[[87,88,-28,-77,89]]},{"type":"MultiPolygon","properties":{"name":"La Altagracia"},"id":"DO.AL","arcs":[[[90]],[[91,-88,92]]]},{"type":"Polygon","properties":{"name":"La Romana"},"id":"DO.RO","arcs":[[93,-29,-89,-92]]}]}},"arcs":[[[3971,8244],[-11,-85],[-41,-66],[-37,-89],[-15,-105],[7,-95],[0,-92],[-42,-47],[-40,-44]],[[3792,7621],[-144,-68],[-136,-105],[-67,-27],[-20,-85],[66,-73],[83,-34],[43,-110],[-20,-142],[8,-120],[-71,20],[-59,-5],[-33,-112],[-142,-157],[-169,-120],[-89,-56],[-80,-57],[20,-89],[-11,-93]],[[2971,6188],[-71,32],[-70,33],[-67,-22],[-62,-44],[-123,55],[-121,114],[-51,68],[-8,103],[-24,62],[-45,34],[-111,80],[-102,88]],[[2116,6791],[14,131],[-3,127],[-45,62],[-10,88],[8,129],[9,127],[38,76],[49,60],[34,56],[42,41],[51,-8],[51,4],[98,68],[104,52],[-23,41],[-36,37],[6,83],[36,71]],[[2539,8036],[75,-61],[79,-49],[40,-13],[39,8],[26,54],[24,44],[112,-70],[120,1],[11,74],[-62,68],[18,121],[3,115],[-40,36],[-40,28],[-21,75],[-5,84],[67,-70],[70,14],[39,127],[18,140]],[[3112,8762],[85,-29],[75,-31],[61,-76],[61,-79],[121,9],[10,245],[145,-93],[56,-200],[80,-188],[165,-76]],[[2243,8322],[96,-234],[200,-52]],[[2116,6791],[-145,2],[-117,85]],[[1854,6878],[-120,93],[-121,89],[-84,163],[-112,106]],[[1417,7329],[-46,73],[-27,90],[133,87],[33,265],[20,88],[-6,95],[34,176],[63,153]],[[1621,8356],[36,67],[47,-51],[82,-45],[88,11],[53,39],[58,11],[85,-72],[85,-12],[41,41],[47,-23]],[[2243,8322],[31,144],[-17,152],[17,89],[66,-10],[-7,139],[-8,138],[24,125],[30,123]],[[2379,9222],[93,-48],[88,-63],[60,-67],[73,-28],[111,-50],[91,-107],[103,-75],[114,-22]],[[2971,6188],[44,-67],[23,-90]],[[3038,6031],[-22,-89],[-57,-41],[-11,-81],[-38,-54],[-67,-68],[-33,-105],[-18,-207],[-1,-215],[-22,-71],[-37,-52],[-39,23],[-23,73],[-88,-41],[17,-157],[-4,-53],[-28,-57],[18,-45],[6,-54],[-51,-36],[-44,-24],[-72,-156],[-119,-47]],[[2305,4474],[-99,81],[-129,-56],[-75,-19],[-75,12],[-62,-31],[-59,-55],[-132,15],[-122,90],[-134,40],[-128,69]],[[1290,4620],[38,133],[-31,119],[-73,25],[-51,78],[0,103],[-19,96],[-55,71],[-62,58],[33,203],[-47,88],[23,226],[67,208],[60,80],[77,11],[84,36],[42,132],[32,179],[55,150],[92,-21],[86,-76],[103,9],[85,95],[6,129],[19,126]],[[6613,4609],[-34,-54],[-16,-65],[15,-2],[15,10],[12,-105],[-5,-104],[-56,-106],[-43,-110],[107,-168],[160,-47],[-18,-133],[-9,-110]],[[6741,3615],[-141,142],[-60,47],[-40,7],[-17,-39],[1,-47],[5,-47],[-7,-38],[-25,-12],[-38,0],[-35,10],[-15,15],[-46,114],[-22,31],[-20,9],[-418,67],[-76,-5]],[[5787,3869],[4,125],[-76,16],[-51,-20],[-51,7],[-34,77],[-33,69],[-73,-60],[-7,-119],[61,-131],[-16,-151]],[[5511,3682],[-34,-16],[-29,-21]],[[5448,3645],[-10,26],[-2,90],[-35,75],[-61,3],[-61,-3],[-31,50],[-8,71],[-50,90],[-67,73],[-50,134],[-29,147],[13,103],[24,93],[-74,174],[-2,187]],[[5005,4958],[77,-40],[49,-131],[87,-47],[89,-36],[128,-36],[116,78],[7,38],[12,38],[32,15],[35,3],[63,-4],[63,-5],[73,-85],[62,-102],[38,-72],[15,-83],[57,-81],[22,-118],[125,192],[158,85],[59,19],[51,48],[92,29],[98,-54]],[[5676,6244],[-41,-269],[-47,-272],[-76,-86],[-88,64],[-55,14],[-33,-73],[-48,11],[-57,17],[-72,-26],[-52,-67],[-115,-41],[-141,-44]],[[4851,5472],[-71,180],[-116,121],[-57,61],[-43,83],[-8,61],[-25,46],[-69,49],[-13,113],[-24,97],[-31,99]],[[4394,6382],[76,129],[108,75],[67,50],[60,33],[-5,11],[-5,12]],[[4695,6692],[-2,17],[-8,-3],[50,24],[53,-21],[57,-15],[56,14],[120,3],[119,-20],[77,-8],[71,-47],[61,-42],[64,-29],[84,-1],[88,-9],[67,-31],[58,-54],[-10,-111],[-24,-115]],[[7487,4576],[35,-39],[37,-33],[46,7],[44,-18],[66,-106],[78,-83],[85,17],[80,-12],[-14,-96],[-20,-109]],[[7924,4104],[-44,-106],[-35,-110],[18,-56],[33,-40],[33,-121],[17,-116]],[[7946,3555],[-3,-1],[-51,14],[-119,59],[-54,13],[-47,22],[-79,98],[-60,23],[-52,-16],[-53,-27],[-54,-5],[-55,48],[-56,-77],[-353,-40],[-106,-57],[-55,-2],[-8,8]],[[6613,4609],[155,398],[160,247]],[[6928,5254],[0,-145],[49,-132],[15,-173],[19,-170],[62,-138],[62,-138],[38,-140],[42,-137],[77,133],[58,111],[44,156],[93,95]],[[2141,9568],[18,-142],[54,-121],[85,-36],[81,-47]],[[1621,8356],[-112,77],[-103,99],[-41,109],[-68,29],[-286,-52],[-264,163],[-30,11]],[[717,8792],[2,67],[-9,74],[-24,115],[52,-17],[48,-36],[-10,82],[-48,162],[3,41],[0,31],[-73,6],[-9,44],[29,66],[43,68],[12,13],[14,4],[30,-1],[19,11],[30,54],[16,21],[32,19],[25,8],[23,17],[31,41],[-18,53],[-3,47],[14,33],[35,13],[21,-5],[33,-21],[21,-5],[9,9],[18,39],[10,9],[279,31],[71,-15],[70,-36],[260,-196],[76,-23],[72,41],[55,-58],[39,-26],[120,-6],[6,2]],[[4447,9065],[-29,-119],[-41,-111],[-45,-21],[-49,1],[-48,-19],[-48,-9],[-35,12],[-35,0],[-43,-56],[-20,-83],[-22,-221],[-61,-195]],[[2141,9568],[26,11],[7,32],[2,42],[14,44],[32,18],[23,-39],[30,-110],[21,19],[16,20],[12,24],[7,27],[-23,11],[-5,5],[-1,11],[-8,28],[42,-24],[36,3],[36,13],[44,8],[28,31],[50,138],[33,31],[42,15],[88,64],[48,9],[43,-16],[42,-36],[23,-53],[-14,-66],[52,-31],[20,0],[-13,64],[-7,24],[132,-31],[38,5],[81,28],[31,-2],[33,-33],[120,-208],[9,-39],[-14,-39],[102,-1],[39,-28],[104,-127],[98,-73],[105,-53],[121,-27],[164,-2],[14,12],[14,28],[33,33],[37,28],[27,13],[106,-49],[166,-255]],[[1417,7329],[-47,-71],[-55,-49],[-65,32],[-66,26],[-34,-58],[-20,-77],[-57,-31],[-55,-48],[-45,-63]],[[973,6990],[-176,125],[-90,134],[-11,17],[-49,99],[-13,83],[18,27],[73,61],[26,29],[34,128],[15,24],[31,96],[2,186],[-32,327],[-76,262],[-13,95],[5,109]],[[5204,8741],[1,-25],[-50,-218],[-134,-114],[-64,7],[-58,-6],[-16,-107],[-8,-119]],[[4875,8159],[-29,8],[-29,-1]],[[4817,8166],[-62,147],[-79,101],[-81,-68],[-56,-118],[-64,-64],[-32,112],[-45,32],[-50,26],[-90,-163],[1,-279],[-11,-235],[-58,-245]],[[4190,7412],[-77,-22],[-54,201],[-56,-18],[-61,-35],[-86,13],[-64,70]],[[4447,9065],[99,-153],[45,-47],[50,-37],[55,-24],[124,-19],[100,-53],[182,-52],[41,1],[27,15],[24,30],[10,15]],[[4817,8166],[-17,-106],[-21,-134],[-78,-96],[-114,-81],[-53,-176],[-22,-196],[-38,-179],[-3,-178]],[[4471,7020],[-111,11],[-76,107],[-54,133],[-40,141]],[[2305,4474],[129,-191],[169,-86],[86,-22],[72,-71],[-1,-74],[-57,-32]],[[2703,3998],[-54,100],[-36,-109],[-42,-103],[-70,-75],[-84,-44],[-43,-53],[-31,-69],[-44,-44],[-46,-42],[-47,-110],[-8,-135]],[[2198,3314],[-98,-10],[-76,91],[-70,194],[-130,12],[-104,-60],[-106,39],[-98,89],[-104,69],[-279,160],[-76,364],[31,88],[18,94],[-4,53],[13,47],[87,40],[88,36]],[[2703,3998],[27,-68],[9,-133],[-55,-105],[-83,-105],[13,-48],[13,-48],[26,-29],[34,-19],[87,-36],[79,-28],[-6,-60],[9,-89],[21,-135],[-41,-100]],[[2836,2995],[-17,34],[-14,42],[-18,37],[-28,31],[-29,19],[-118,37],[-55,2],[-42,-25],[-17,-64],[-6,-35],[-24,-61],[-6,-47],[5,-53],[14,-30],[18,-26],[19,-46],[44,-228],[15,-39],[0,-50],[-53,-117],[-45,-168],[-257,-552],[-23,-94],[-11,-34],[-26,-26],[-54,-41],[-33,-42],[-24,-41],[-18,-50],[-17,-70],[-21,11],[-7,7],[-8,10]],[[1980,1286],[-2,11],[0,162],[-44,146],[-81,6],[-69,-25],[-134,163],[-58,213],[19,37],[28,15],[27,16],[15,45],[5,75],[-2,77],[-4,170],[-83,71]],[[1597,2468],[12,113],[49,78],[69,-28],[63,12],[-43,230],[-40,239],[120,38],[137,-68],[144,56],[90,176]],[[1597,2468],[-81,100],[-78,107],[-94,56],[-99,36],[-232,168],[-224,186],[-6,3]],[[783,3124],[1,4],[32,81],[-6,12],[-25,33],[-38,37],[-146,81],[-103,100],[-22,37],[-41,89],[-23,30],[-106,39],[-41,33],[-16,77],[10,46],[21,17],[14,23],[-7,63],[-17,40],[-246,368],[-24,69],[47,51],[101,31],[204,-55],[105,53],[35,55],[56,140],[37,60],[7,7],[19,17]],[[611,4762],[151,-27],[183,-41],[174,-20],[171,-54]],[[611,4762],[73,66],[38,45],[32,78],[19,71],[13,77],[4,79],[-22,164],[-2,169],[-15,78],[-21,37],[-62,84],[-25,42],[-38,119],[-25,29],[-63,3],[-68,-34],[-49,-11],[-8,73],[47,46],[140,55],[35,32],[118,191],[81,166],[41,54],[92,96],[35,74],[14,72],[12,249],[-34,24]],[[1365,24],[-47,-24],[-45,38],[-1,90],[25,105],[31,84],[38,-32],[39,-42],[69,-98],[-42,-19],[-67,-102]],[[1980,1286],[-3,3],[-4,-30],[-5,-11],[-10,-13],[19,0],[-11,-35],[-14,-27],[-18,-18],[-21,-6],[-10,-17],[-18,-83],[-10,-31],[-33,-70],[-92,-393],[-28,-76],[-112,-231],[-28,18],[-23,33],[-1,18],[-27,33],[-187,453],[-45,73],[-91,52],[-217,-43],[-93,33],[26,30],[87,132],[18,54],[-4,90],[-11,63],[-42,119],[-29,66],[-6,24],[-2,50],[18,158],[-20,73],[-47,82],[-100,120],[-151,85],[32,126],[10,72],[-6,122],[2,69],[-7,47],[-29,120],[-4,39],[7,83],[22,78],[121,304]],[[3558,4729],[78,-225],[57,-212],[40,-36],[20,-62],[48,-67],[63,-32],[90,-87],[88,-66],[56,-142],[60,-173]],[[4158,3627],[18,-77],[-27,-77],[-21,-112],[7,-119],[-98,-164],[-151,-42],[-1,0]],[[3885,3036],[-35,33],[-12,39],[7,42],[16,19],[18,14],[15,29],[12,84],[2,88],[-8,78],[-15,50],[-59,109],[-36,38],[-63,35],[-54,19],[-68,7],[-58,-23],[-24,-73],[9,-87],[-7,-35],[-80,-117],[-23,-21],[-29,-12],[-32,2],[-56,26],[-25,3],[-21,-12],[-38,-39],[-25,-9],[-35,7],[-12,-11],[-27,-37],[-7,-16],[-17,-51],[-4,-19],[-7,-16],[-36,-18],[-14,-10],[-72,-126],[-39,-33],[-64,-12],[-26,14]],[[3038,6031],[143,-142],[31,-385],[115,-230],[166,-123],[103,-183],[-38,-239]],[[4471,7020],[88,-198],[136,-130]],[[4394,6382],[-21,108],[-65,57],[-53,-28],[-30,-78],[-129,-51],[-56,-154],[-3,-286],[-162,-195],[-25,-289],[160,-273]],[[4010,5193],[-39,-185],[-71,-132],[-57,-77],[-42,-68],[-120,2],[-123,-4]],[[4851,5472],[-56,-91],[-18,-130]],[[4777,5251],[-93,-66],[-39,-119],[-36,-159],[-101,3]],[[4508,4910],[-69,71],[-73,43],[-65,-35],[-68,-10],[-109,117],[-114,97]],[[4969,2878],[-59,-2],[-51,-13],[-33,-27],[-48,43],[-51,16],[-348,-2],[-58,-27],[-112,-93],[-63,-20],[-189,0],[-43,26],[-4,36],[20,28],[25,24],[13,26],[-8,45],[-18,25],[-20,16],[-20,41],[-17,16]],[[4158,3627],[73,159],[133,57],[68,69],[59,92]],[[4491,4004],[131,-83],[107,-152],[86,-59],[-5,-101],[-70,-60],[-14,-108],[51,-93],[54,-94],[19,-54],[20,-52],[36,-51],[35,-44],[11,-94],[17,-81]],[[4508,4910],[-50,-170],[-10,-181],[12,-147],[-30,-148],[20,-135],[41,-125]],[[4875,8159],[96,-86],[92,-91],[32,-132],[8,-144],[34,-176],[94,-100],[83,-16],[37,-97],[132,-163],[186,-68],[183,-126],[188,-53]],[[6040,6907],[133,93],[164,-57],[0,-114],[-72,-70],[-43,-41],[-36,-67],[-10,-131],[-54,-74]],[[6122,6446],[-178,10],[-145,-25],[-6,-47],[-3,-65],[-41,-79],[-73,4]],[[7600,6167],[-1,-15],[0,-1],[-13,-229],[75,-197],[-224,77],[-154,-40],[97,-291],[156,-236],[42,-168],[-12,-178],[-47,-159],[-32,-154]],[[6928,5254],[49,98],[56,86],[56,51],[52,52],[-50,74],[-99,18],[-133,107],[-136,99],[-155,114],[-125,164]],[[6443,6117],[36,119],[16,127],[-8,112],[2,31]],[[6489,6506],[34,-36],[149,34],[52,-28],[65,30],[128,-72],[67,11],[-17,21],[-21,19],[-26,14],[-30,5],[0,29],[145,11],[42,-11],[48,-52],[37,-128],[46,-51],[47,-18],[93,-17],[252,-100]],[[6122,6446],[78,-87],[78,-85],[86,-71],[79,-86]],[[5005,4958],[-66,71],[-70,58],[-47,80],[-45,84]],[[6080,7347],[-6,-21],[-10,-112],[-25,-105],[-17,-103],[18,-99]],[[5204,8741],[89,140],[52,34],[150,-3],[74,10],[33,-6],[42,-35],[92,-143],[30,-97],[-2,-106],[-45,-230],[55,-34],[20,-74],[0,-191],[6,-83],[18,-66],[181,-394],[81,-116]],[[6080,7347],[10,-15],[93,-55],[55,14],[106,59],[54,13],[122,7],[54,17],[56,33],[80,78],[31,10],[28,-9],[58,-41],[36,-9],[65,24],[29,4],[16,-1],[14,-5],[11,-13],[5,-24],[8,-20],[19,8],[30,27],[157,-94],[47,-49],[31,91],[49,67],[124,99],[79,35],[19,-48],[-21,-100],[-40,-118],[54,-29],[61,0],[60,23],[49,37],[16,-92],[-35,-72],[-49,-65],[-25,-72],[-11,-76],[-32,-68],[-47,-50],[-60,-21],[-213,57],[-233,-26],[-55,23],[-101,73],[-346,63],[-39,-16],[-15,-56],[-9,-199],[-20,-170],[8,-63],[26,-27]],[[5448,3645],[-34,-26],[-61,-79],[-45,-105],[-18,-126],[-15,-34],[-62,-48],[-14,-31],[-11,-46],[-92,-125],[-66,-111],[-37,-47],[-17,11],[-7,0]],[[5787,3869],[-12,-1],[-44,-19],[-85,-60],[-70,-70],[-27,-19],[-38,-18]],[[8759,5995],[-51,-96],[-77,-88],[1,-57],[-15,-45],[-21,-176],[74,-206],[-57,-236],[-139,-162],[-72,-17],[-61,-53],[-10,-90],[20,-87]],[[8351,4682],[-119,-68],[-68,-193],[-104,-193],[-136,-124]],[[7600,6167],[105,-41],[43,4],[51,43],[-17,30],[-34,30],[0,40],[48,21],[43,-57],[57,-135],[37,-31],[41,-18],[35,-23],[18,-45],[33,39],[66,45],[31,33],[-20,34],[10,8],[24,1],[23,12],[29,43],[8,17],[11,1],[98,-8],[56,-16],[51,-27],[46,-37],[5,-11],[0,-15],[2,-16],[11,-14],[56,-29],[5,1],[97,-29],[61,-4],[24,-13],[5,-5]],[[8961,2633],[127,-26],[140,6],[37,-19],[28,-53],[30,-82],[20,-76],[-5,-33],[-41,14],[-88,59],[-45,13],[-49,-9],[-84,-39],[-46,-9],[-95,37],[-68,90],[-44,113],[-24,103],[40,17],[48,-13],[47,-34],[41,-43],[31,-16]],[[8444,3587],[48,170],[48,190],[37,120],[-3,131],[-57,104],[-68,91],[-53,139],[-45,150]],[[8759,5995],[22,-23],[25,-20],[48,-6],[28,-15],[316,-429],[116,-206],[164,-183],[117,-119],[34,-22],[17,-17],[123,-173],[155,-138],[75,-167],[-15,-164],[-255,-569],[-18,-23],[-18,-28],[-8,-40],[5,-145],[-5,-42],[-31,-71],[-45,-33],[-56,-10],[-65,0],[-49,24],[-108,104],[-39,17],[-45,-44],[7,-67],[15,-79],[-24,-82],[-33,-65],[-21,-76],[-42,-243],[-15,-43],[-31,-17],[-230,-27],[-46,25],[-7,153],[-66,202],[-90,197],[-80,135],[-85,87],[-55,34]],[[8444,3587],[-58,36],[-114,24],[-131,-79],[-195,-13]]],"transform":{"scale":[0.00036816030983098197,0.00023923697709770723],"translate":[-72.0098376059999,17.545558986000074]}};
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
