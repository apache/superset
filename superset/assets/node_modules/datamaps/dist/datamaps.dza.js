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
  Datamap.prototype.domTopo = '__DOM__';
  Datamap.prototype.dzaTopo = {"type":"Topology","objects":{"dza":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Adrar"},"id":"DZ.AR","arcs":[[0,1,2,3,4,5]]},{"type":"Polygon","properties":{"name":"Aïn Témouchent"},"id":"DZ.AT","arcs":[[6,7,8,9]]},{"type":"Polygon","properties":{"name":"Oran"},"id":"DZ.OR","arcs":[[10,11,12,-10,13]]},{"type":"Polygon","properties":{"name":"Sidi Bel Abbès"},"id":"DZ.SB","arcs":[[14,15,16,-7,-13,17]]},{"type":"Polygon","properties":{"name":"Tlemcen"},"id":"DZ.TL","arcs":[[-17,18,19,-8]]},{"type":"Polygon","properties":{"name":"Béchar"},"id":"DZ.BC","arcs":[[-4,20,21,22,23]]},{"type":"Polygon","properties":{"name":"Naâma"},"id":"DZ.NA","arcs":[[24,25,-23,26,-19,-16]]},{"type":"Polygon","properties":{"name":"Tindouf"},"id":"DZ.TN","arcs":[[-3,27,-21]]},{"type":"Polygon","properties":{"name":"Annaba"},"id":"DZ.AN","arcs":[[28,29,30,31]]},{"type":"Polygon","properties":{"name":"El Tarf"},"id":"DZ.ET","arcs":[[32,33,-29,34]]},{"type":"Polygon","properties":{"name":"Jijel"},"id":"DZ.JJ","arcs":[[35,36,37,38,39]]},{"type":"Polygon","properties":{"name":"Skikda"},"id":"DZ.SK","arcs":[[-31,40,41,42,-40,43]]},{"type":"Polygon","properties":{"name":"Illizi"},"id":"DZ.IL","arcs":[[44,45,46]]},{"type":"Polygon","properties":{"name":"Tamanghasset"},"id":"DZ.TM","arcs":[[-45,47,-1,48,49]]},{"type":"Polygon","properties":{"name":"El Bayadh"},"id":"DZ.EB","arcs":[[50,51,-5,-24,-26,52,53]]},{"type":"Polygon","properties":{"name":"El Oued"},"id":"DZ.","arcs":[[54,55,56,57,58,59]]},{"type":"Polygon","properties":{"name":"Ghardaïa"},"id":"DZ.GR","arcs":[[60,-49,-6,-52,61,62]]},{"type":"Polygon","properties":{"name":"Laghouat"},"id":"DZ.LG","arcs":[[-62,-51,63,64]]},{"type":"Polygon","properties":{"name":"Ouargla"},"id":"DZ.OG","arcs":[[65,-46,-50,-61,66,-58]]},{"type":"Polygon","properties":{"name":"Alger"},"id":"DZ.AL","arcs":[[67,68,69,70]]},{"type":"Polygon","properties":{"name":"Boumerdès"},"id":"DZ.BM","arcs":[[71,72,73,-68,74]]},{"type":"Polygon","properties":{"name":"Tizi Ouzou"},"id":"DZ.TO","arcs":[[75,76,-72,77]]},{"type":"Polygon","properties":{"name":"Tipaza"},"id":"DZ.TP","arcs":[[-70,78,79,80,81]]},{"type":"Polygon","properties":{"name":"Aïn Defla"},"id":"DZ.AD","arcs":[[82,83,84,85,-80]]},{"type":"Polygon","properties":{"name":"Chlef"},"id":"DZ.CH","arcs":[[-81,-86,86,87,88,89]]},{"type":"Polygon","properties":{"name":"Mascara"},"id":"DZ.MC","arcs":[[90,91,92,-18,-12,93]]},{"type":"Polygon","properties":{"name":"Mostaganem"},"id":"DZ.MG","arcs":[[94,-94,-11,95,-89]]},{"type":"Polygon","properties":{"name":"Relizane"},"id":"DZ.RE","arcs":[[96,97,-91,-95,-88]]},{"type":"Polygon","properties":{"name":"Saïda"},"id":"DZ.SD","arcs":[[98,-53,-25,-15,-93]]},{"type":"Polygon","properties":{"name":"Tiaret"},"id":"DZ.TR","arcs":[[99,100,-64,-54,-99,-92,-98,101]]},{"type":"Polygon","properties":{"name":"Tissemsilt"},"id":"DZ.TS","arcs":[[-85,102,-102,-97,-87]]},{"type":"Polygon","properties":{"name":"Bordj Bou Arréridj"},"id":"DZ.BB","arcs":[[103,104,105,106]]},{"type":"Polygon","properties":{"name":"Béjaïa"},"id":"DZ.BJ","arcs":[[-38,107,-107,108,-76,109]]},{"type":"Polygon","properties":{"name":"Blida"},"id":"DZ.BL","arcs":[[110,111,-83,-79,-69,-74]]},{"type":"Polygon","properties":{"name":"Bouira"},"id":"DZ.BU","arcs":[[-77,-109,-106,112,113,-111,-73]]},{"type":"Polygon","properties":{"name":"Biskra"},"id":"DZ.BS","arcs":[[114,-60,115,116,117]]},{"type":"Polygon","properties":{"name":"Djelfa"},"id":"DZ.DJ","arcs":[[118,-116,-59,-67,-63,-65,-101,119]]},{"type":"Polygon","properties":{"name":"Médéa"},"id":"DZ.MD","arcs":[[120,-120,-100,-103,-84,-112,-114]]},{"type":"Polygon","properties":{"name":"M'Sila"},"id":"DZ.MS","arcs":[[121,122,-117,-119,-121,-113,-105]]},{"type":"Polygon","properties":{"name":"Sétif"},"id":"DZ.SF","arcs":[[123,124,-122,-104,-108,-37]]},{"type":"Polygon","properties":{"name":"Batna"},"id":"DZ.BT","arcs":[[125,126,-118,-123,-125,127]]},{"type":"Polygon","properties":{"name":"Constantine"},"id":"DZ.CO","arcs":[[128,129,130,-42]]},{"type":"Polygon","properties":{"name":"Guelma"},"id":"DZ.GL","arcs":[[-34,131,132,-129,-41,-30]]},{"type":"Polygon","properties":{"name":"Khenchela"},"id":"DZ.KH","arcs":[[133,-55,-115,-127,134]]},{"type":"Polygon","properties":{"name":"Mila"},"id":"DZ.ML","arcs":[[-43,-131,135,-128,-124,-36]]},{"type":"Polygon","properties":{"name":"Oum el Bouaghi"},"id":"DZ.OB","arcs":[[-133,136,137,-135,-126,-136,-130]]},{"type":"Polygon","properties":{"name":"Souk Ahras"},"id":"DZ.SA","arcs":[[138,-137,-132,-33,139]]},{"type":"Polygon","properties":{"name":"Tébessa"},"id":"DZ.TB","arcs":[[140,-56,-134,-138,-139]]}]}},"arcs":[[[5211,5552],[26,-300],[-6,-112],[-27,-119],[-61,-698],[-4,-14],[-5,-13],[-9,-13],[-21,-24],[-15,-13],[-31,-33],[-2,-2],[-4,-1],[-50,-8],[-6,-2],[-3,-1],[-4,-3],[-31,-44],[-13,-15],[-8,-6],[-14,-7],[-39,-12],[-5,0],[-67,0],[-4,0],[-18,-7],[-7,0],[-27,4],[-35,-3],[-4,-2],[-4,-2],[-33,-25],[-36,-13],[-22,-11],[-4,-4],[-10,-12],[-4,-12],[1,-7],[5,-8],[41,-40],[76,-107],[5,-10],[4,-10],[3,-11],[2,-12],[1,-32],[-7,-54],[4,-15],[6,-12],[82,-64],[6,-6],[3,-6],[1,-8],[-4,-1805],[10,-18],[24,-33],[1067,-667],[51,-50],[35,-55],[15,-126],[4,-821],[0,-1]],[[6039,47],[-36,-8],[-83,-17],[-51,-11],[-39,-10],[-12,-1],[-7,1],[-5,2],[-12,8],[-28,31],[-23,10],[-10,6],[-9,8],[-9,10],[-8,12],[-1,10],[5,10],[7,12],[3,11],[3,5],[6,5],[11,11],[2,10],[2,21],[5,10],[9,9],[10,6],[9,7],[5,13],[-2,12],[-5,9],[-6,8],[-4,10],[0,5],[3,11],[0,4],[-2,5],[-3,2],[-2,2],[-3,3],[-6,20],[-1,21],[9,112],[-2,7],[-6,7],[-8,4],[-17,6],[-8,4],[-28,24],[-62,29],[-132,30],[-27,1],[-44,10],[-5,0],[-10,2],[-17,11],[-10,4],[-11,3],[-8,3],[-6,6],[-19,38],[-16,24],[-17,21],[-30,25],[-9,6],[-8,2],[-11,-2],[-11,-8],[-20,-20],[-12,-6],[-7,1],[-31,12],[-5,3],[-4,3],[-4,3],[-5,1],[-7,-2],[-8,-8],[-6,-3],[-10,0],[-4,7],[-2,11],[-4,11],[-8,6],[-8,1],[-8,-2],[-11,1],[-10,5],[-58,52],[-5,8],[1,41],[-3,20],[-10,16],[-31,25],[-19,11],[-18,3],[-8,6],[-9,3],[-20,3],[-21,7],[-8,7],[-7,10],[-11,19],[-6,6],[-12,3],[-10,0],[-19,-4],[-10,0],[-11,1],[-7,3],[-4,7],[-1,14],[0,11],[11,49],[6,61],[-1,12],[-9,35],[-6,11],[-57,43],[-42,31],[-42,31],[-42,31],[-42,32],[-42,31],[-41,31],[-42,32],[-42,31],[-42,31],[-42,31],[-42,32],[-35,26],[-7,5],[-42,31],[-42,31],[-42,32],[-42,31],[-42,31],[-42,31],[-42,32],[-42,31],[-42,31],[-42,31],[-42,32],[-42,31],[-42,31],[-42,32],[-41,31],[-42,31],[-42,31],[-42,32],[-42,31],[-42,31],[-42,31],[-42,32],[-42,31],[-42,31],[-42,31],[-42,32],[-42,31],[-42,31],[-42,31],[-42,32],[-42,31],[-42,31],[-42,32],[-42,31],[-42,31],[-41,31],[-39,29],[-39,29],[-38,29],[-39,28],[-38,29],[-39,29],[-39,29],[-38,28],[-39,29],[-38,29],[-39,29],[-39,28],[-38,29],[-39,29],[-38,29],[-39,28],[-54,41],[-37,26],[-37,26],[-37,26],[-36,27],[-1,0],[-84,59],[-84,59],[-84,59],[-84,59],[-58,40],[-12,8]],[[1463,3606],[6,5],[1295,930],[-376,752]],[[2388,5293],[96,9],[86,-45],[51,-35],[119,-59],[102,-20],[118,48],[68,42],[152,120],[60,36],[56,21],[444,80],[64,47],[303,406],[290,532]],[[4397,6475],[170,177],[45,37],[92,58],[510,252]],[[5214,6999],[-7,-440],[-62,-423],[66,-584]],[[3880,9027],[-41,-8],[-7,-5],[-15,-20],[-7,-4],[-9,-1],[-7,0],[-11,-2],[-6,-3],[-3,-6],[2,-7],[3,-8],[1,-9],[-1,-11],[-6,-11],[-7,-5],[-9,-2],[-8,-1],[-9,-5],[-7,-6],[-14,-21]],[[3719,8892],[-23,5],[-108,54],[-3,1],[-4,-1],[-6,-1],[-2,-1],[-4,-1],[-4,-1],[-6,0],[-3,2],[-2,2],[-1,3],[0,5],[-1,5],[0,3],[7,4],[1,2],[1,2],[1,2],[0,13],[2,7],[0,3],[0,3],[-3,5],[-3,2],[-3,1],[-4,0],[-3,-1],[-2,2],[-1,2],[0,5],[-1,1]],[[3544,9020],[2,1],[13,15],[9,3],[9,6],[8,7],[5,7],[4,11],[6,26],[5,10],[6,9],[17,41],[3,6],[6,2],[11,1],[3,2],[12,17],[5,3]],[[3668,9187],[1,-1],[13,-30],[16,-13],[14,-6],[4,-4],[1,-4],[-3,-5],[-4,-5],[-17,-12],[-4,-6],[-3,-7],[-1,-10],[1,-6],[1,-5],[4,-2],[5,1],[5,7],[4,9],[3,5],[3,2],[5,-1],[11,-7],[6,-2],[9,0],[103,25],[12,0],[13,-4],[8,-8],[19,-21],[2,-8],[-2,-6],[-10,-7],[-3,-2],[-1,-3],[1,-3],[3,-5],[1,-4],[0,-5],[-8,-7]],[[4149,9279],[-1,-3]],[[4148,9276],[-19,-20],[-24,-29],[-8,-6],[-8,-4],[-11,1],[-5,0],[-7,-1],[-9,-4],[-4,-6],[-5,-12],[-7,-8],[-7,-7],[-27,-20],[-6,-6],[-3,-6],[-2,-11],[-2,-3],[-2,-5],[-4,-5],[-5,-4],[-12,-4],[-6,-2],[-2,-2],[-2,-2],[0,-3],[0,-4],[0,-9],[-4,-8],[-4,-4],[-12,-7],[-1,-4]],[[3940,9071],[-5,0],[-3,-1],[-4,-3],[-3,-5],[-2,-7],[-4,-22],[-3,-7],[-3,-6],[-5,-5],[-5,-4],[-5,-3],[-6,-2],[-5,1],[-5,3],[-2,17]],[[3668,9187],[12,8],[14,13],[6,9],[4,3],[17,4],[10,6],[7,6],[8,4],[11,4],[6,-1],[3,-5],[2,-2],[6,3],[19,10],[11,19],[12,3],[4,-3],[3,-3],[5,-4],[6,-2],[5,0],[9,-3],[6,-1],[5,-2],[3,-4],[2,-4],[5,-5],[4,-1],[19,1],[9,2],[9,5],[9,6],[5,16],[6,1],[7,-2],[5,-1],[5,3],[3,4],[23,44],[0,6],[-1,1],[-1,4],[0,3],[1,3],[2,0],[3,-1],[3,-2],[2,-1],[4,0],[11,0],[4,0],[21,9],[13,4],[6,-3],[2,-7],[6,-3],[5,-1],[4,-2],[1,-6],[-3,-8],[2,-5],[8,-8],[12,-6],[35,-7],[21,-8],[10,-2],[5,1]],[[4124,8911],[-8,1],[-4,0],[-2,-1],[-3,-2],[-3,-4],[-3,-1],[-2,-1],[-7,-1],[-3,-1],[-3,-1],[-2,-2],[-2,-3],[-1,-4],[0,-7],[0,-4],[2,-10],[1,-4],[4,-4],[2,-2],[-1,-3],[-3,-5],[-2,-2],[-3,-1],[-3,0],[-6,3],[-3,0],[-3,0],[-2,-2],[-1,-4],[-1,-5],[-2,-4],[-1,-3],[1,-2],[1,-3],[1,-3],[-1,-15],[0,-5],[2,-3],[5,-3],[2,-2],[2,-2],[1,-3],[-1,-2],[-3,-3],[-3,-1],[-12,-3],[-10,-5],[-3,0],[-5,3],[-3,0],[-2,-1],[-2,-2],[-2,-2],[-1,-3],[0,-3],[2,-3],[3,-1],[19,-8],[2,-1],[5,-4],[1,-2],[1,-3],[0,-7],[1,-4],[2,-3],[3,-2],[9,-3],[2,-1],[2,-1],[1,-2],[1,-2],[2,-1],[2,0],[3,0],[7,0],[3,-1],[2,-1],[2,-3],[1,-4],[0,-6],[2,-3],[3,-2],[3,-2],[2,-1],[4,-4],[16,-12],[16,-16],[26,-35],[3,-5],[0,-3],[1,-9],[0,-4],[-1,-7],[-3,-10],[-3,-8],[-2,-3],[-200,-166]],[[3969,8418],[-8,20],[-4,6],[-6,8],[-8,5],[-9,5],[-10,2],[-10,1],[-9,-2],[-10,-3],[-20,-12],[-30,-23],[-11,-7],[-13,-4],[-22,-4],[-37,3],[-11,3],[-9,5],[-8,5],[-9,6],[-5,2],[-6,0],[-15,-4],[-10,-1],[-8,2],[-7,3],[-13,7]],[[3661,8441],[12,19],[20,19],[77,62],[8,9],[2,4],[1,4],[1,4],[-1,3],[-1,3],[-1,2],[-2,4],[-2,3],[-5,5],[-3,3],[-1,4],[0,5],[4,4],[6,3],[21,7],[4,1],[1,2],[2,2],[8,21],[9,20],[7,11],[7,14],[2,5],[-1,4],[-4,7],[-1,2],[-3,2],[-31,-3],[-12,1],[-10,5],[-5,9],[0,14],[3,18],[1,10],[-1,4],[-6,1],[-6,-1],[-6,-2],[-4,0],[-3,2],[-1,4],[2,5],[7,9],[0,3],[-2,3],[-3,1],[-2,0],[-1,0],[-3,1],[-3,3],[-3,6],[-3,9],[0,3],[0,7],[1,11],[5,22],[2,3],[5,8],[5,11],[0,3],[-2,3],[-27,17],[-2,1],[-4,2]],[[3940,9071],[10,1],[11,3],[9,3],[9,2],[2,-1],[3,-3],[0,-8],[-6,-8],[-8,-10],[3,-4],[6,-5],[17,-6],[10,-3],[6,0],[8,8],[3,2],[6,-1],[75,-27],[4,-2],[4,-3],[0,-7],[-2,-11],[-2,-9],[-1,-2],[-2,-3],[-1,-3],[0,-5],[0,-7],[0,-4],[-1,-2],[-2,-2],[-2,-2],[0,-3],[1,-4],[10,-9],[6,-8],[8,-17]],[[3661,8441],[-8,-6],[-6,-4],[-29,-12],[-3,-2],[-6,-5],[-7,-5],[-3,-2],[-5,-1],[-33,-3],[-11,1],[-24,-1],[-14,1],[-7,-1],[-18,-4],[-86,-50],[-7,-5]],[[3394,8342],[-1,8],[-35,102],[-12,24],[-18,21],[51,59],[-5,3],[-18,5],[-58,57],[4,9],[25,37],[12,25],[6,5],[2,4],[-9,8],[-51,30],[-16,15],[-26,15],[-6,8],[-3,7],[0,8],[-2,6],[-6,5],[-22,2],[-16,10],[-16,13],[-18,12],[-14,5],[-9,11],[-5,15],[0,22],[11,3],[2,0],[1,0],[2,-1],[1,-3],[15,7],[16,-3],[18,-7],[16,-4],[31,4],[12,-4],[4,0],[3,1],[8,6],[46,13],[12,8],[4,1],[15,0],[6,1],[8,5],[16,18],[31,9],[5,4],[4,10],[58,45],[9,4],[46,4],[13,4],[2,1],[1,1]],[[2388,5293],[-734,-198],[-356,757]],[[1298,5852],[58,11],[61,8],[17,-50],[40,-15],[48,15],[50,66],[44,69],[34,66],[48,50],[50,34],[55,47],[40,30],[51,27],[71,31],[68,54],[54,70],[47,27],[58,15],[74,4],[81,19],[92,47],[-4,34],[-3,35],[24,23],[27,43],[-26,41],[-1,11],[-2,9],[-5,11],[-6,5],[-17,8],[-9,8],[-13,21],[-7,7],[-8,2],[-7,-3],[-15,-13],[-8,-4],[-8,0],[-6,5],[-2,10],[3,11],[11,17],[1,12],[-3,42],[2,10],[6,7],[26,20],[36,2],[7,142],[33,17],[21,-4],[18,1],[141,25],[28,8],[77,23],[85,11],[-21,54],[-33,87],[28,15],[90,7],[87,24],[66,-3],[31,-2],[35,-1],[38,-2],[40,-2],[42,-2],[42,-2],[43,-2],[41,-1],[40,-2],[37,-2],[34,-1],[29,-2],[24,-1],[19,-1],[11,0],[4,0],[37,-2],[19,4],[9,20],[-2,11],[-8,7],[-10,3],[-9,0],[-18,-7],[-8,0],[-2,9],[2,4],[8,6],[3,3],[3,6],[0,4],[0,5],[1,6]],[[3587,7314],[8,0],[69,8],[32,-1],[10,-2],[9,-3],[4,-3],[4,-2],[5,-5],[5,-5],[6,-8],[5,-10],[15,-36],[11,-1],[25,3],[390,119]],[[4185,7368],[-175,-495],[0,-21],[15,-30],[104,-118],[268,-229]],[[3969,8418],[-6,-13],[-1,-7],[2,-11],[3,-8],[37,-69],[13,-32],[1,-7],[-1,-4],[-1,-5],[2,-4],[8,-10],[3,-3],[2,0],[2,1],[2,2],[0,3],[0,3],[-1,5],[0,2],[0,2],[1,3],[1,1],[4,3],[2,0],[4,1],[4,-1],[3,0],[2,1],[1,2],[5,9],[17,23],[15,16],[2,2],[2,1],[5,2],[9,3],[17,6],[4,3],[2,1],[3,1],[12,-1],[15,-2],[4,-3],[3,-3],[3,-11],[1,-16],[1,-5],[0,-3],[-1,-4],[-1,-1],[0,-1],[0,-1],[1,-4],[2,-1],[3,0],[3,1],[21,10],[23,16],[10,6],[9,1]],[[4246,8318],[-1,-23],[-17,-112],[-2,-99],[11,-137],[-2,-37],[-5,-21],[-26,-85],[-9,-31],[-4,-22],[-1,-11],[11,-101],[0,-7],[-4,-12],[-41,-106],[-1,-13],[1,-12],[7,-12],[8,-5],[7,-2],[8,-1],[6,-2],[5,-3],[1,0],[1,-3],[2,-4],[1,-7],[0,-8],[0,-9],[-4,-24],[-13,-41]],[[3587,7314],[8,51],[6,20],[5,10],[8,9],[8,4],[20,3],[18,7],[16,12],[28,31],[-7,12],[-136,101],[-30,10],[-16,14],[-66,105],[21,14],[3,4],[3,5],[2,5],[1,6],[2,12],[0,12],[-3,12],[-8,8],[-14,9],[-13,11],[-10,14],[-7,17],[-8,16],[-25,23],[-4,18],[0,54],[5,14],[7,14],[9,31],[7,10],[6,15],[-2,19],[-22,49],[-5,7],[-9,6],[-17,6],[-7,5],[-3,8],[2,9],[5,5],[6,5],[5,6],[3,8],[1,6],[-6,16],[-4,27],[2,26],[22,89],[1,11],[-1,7]],[[1463,3606],[-70,46],[-81,54],[-81,55],[-81,54],[-96,64],[-96,65],[-96,64],[-95,64],[-96,64],[-96,65],[-96,64],[-96,64],[-96,64],[-95,65],[-96,64],[-96,64],[0,52],[0,52],[0,52],[0,51],[0,34],[0,33],[0,33],[0,33],[0,33],[0,33],[0,33],[0,33],[0,33],[0,33],[0,33],[0,33],[0,33],[0,33],[0,34],[0,33],[0,25],[2,15],[5,10],[9,8],[62,34],[22,17],[22,12],[6,7],[17,29],[7,6],[17,8],[8,5],[32,30],[33,23],[55,24],[16,11],[44,42],[51,35],[30,28],[23,12],[8,6],[29,30],[17,7],[22,-1],[22,-4],[11,0],[10,1],[10,4],[55,-3],[44,46],[54,23],[38,4],[54,-4],[84,-34],[41,38],[68,8],[71,19],[33,4],[34,4],[71,0],[61,0]],[[7968,9886],[-2,-1],[-3,0],[-2,-2],[-1,-4],[-1,-51],[-1,-7],[-3,-4],[-10,-3],[-5,-3],[-3,-4],[-9,-18],[-13,-15],[-7,-13]],[[7908,9761],[-10,-14],[-4,-4],[-4,-4],[-5,-2],[-5,-2],[-14,-2],[-7,1],[-7,1],[-7,3],[-9,4],[-2,1],[-8,2],[-3,3],[-1,5],[0,12],[-4,8],[-4,5],[-35,18]],[[7779,9796],[-6,35],[-9,25],[0,7],[1,6],[3,5],[1,8],[-2,5],[-5,5],[-13,6],[-7,10],[-21,78],[-1,3]],[[7720,9989],[2,-1],[2,-2],[2,-1],[3,2],[4,4],[2,2],[2,0],[5,-2],[9,-5],[5,-1],[4,2],[12,6],[7,0],[1,-1],[0,-2],[4,-5],[2,-6],[3,-3],[7,-2],[9,0],[5,-1],[4,-3],[8,5],[9,3],[17,-13],[14,-13],[16,-12],[22,-4],[5,2],[4,2],[5,1],[6,-1],[5,-3],[5,-3],[4,-3],[4,-4],[24,2],[4,2],[9,9],[5,4],[-4,-12],[-6,-12],[-2,-11],[8,-7],[-8,-16]],[[8159,9667],[-1,0],[-4,-3],[-8,-6],[-7,-7],[-10,-13],[-5,-5],[-6,-5],[-7,-3],[-7,-3],[-7,-2],[-8,-2],[-5,1],[-3,4],[-2,26],[-8,14]],[[8071,9663],[-2,5],[-1,4],[-1,1],[-2,2],[-4,3],[-88,34],[-6,4],[-4,6],[-2,8],[-4,6],[-5,6],[-16,13],[-5,3],[-23,3]],[[7968,9886],[17,-12],[28,-7],[20,-3],[69,16],[11,5],[9,8],[68,31],[9,-5],[8,-8],[10,-5],[22,1],[11,-1],[8,-4],[8,3],[6,-3],[6,-4],[7,-4],[17,-1],[16,1],[51,20],[2,-15],[-1,-6],[2,-6],[16,-23],[0,-7],[-9,-6],[-33,-12],[-17,-3],[-18,1],[-19,-2],[-15,-7],[-3,-9],[17,-8],[10,-11],[-4,-20],[-11,-19],[-11,-11],[-59,-33],[-31,-11],[-14,-8],[-11,-13],[-1,-18]],[[7330,9715],[-62,12],[-5,2],[-2,2],[-2,7],[-3,2],[-4,0],[-13,-7],[-11,-5],[-4,-3],[-2,-3],[-3,-4],[-6,-1],[-8,-1],[-16,2],[-19,4],[-25,2],[-17,5],[-8,1],[-9,-2],[-18,-7],[-8,-5],[-5,-6],[-2,-6],[-6,-5],[-9,-3],[-17,-1],[-12,0],[-11,4],[-8,4],[-9,2],[-6,1],[-18,-4]],[[6982,9702],[-30,-11],[-6,1],[-6,1],[-13,8],[-5,1],[-7,-3],[-4,-3],[-8,-7],[-4,-3],[-6,-1],[-5,-1],[-6,1],[-5,3],[-5,4],[-3,9],[0,7],[-3,10],[-11,3]],[[6855,9721],[-9,7],[-12,3],[-2,2],[0,3],[2,3],[1,3],[1,2],[-3,15],[-1,3]],[[6832,9762],[3,0],[15,0],[2,2],[6,7],[4,2],[19,7],[10,7],[6,20],[7,8],[8,7],[9,4],[21,6],[9,5],[18,14],[11,4],[12,0],[34,-6],[19,0],[82,17],[77,27],[19,11],[6,7]],[[7229,9911],[2,-1],[8,-8],[3,-3],[0,-3],[0,-6],[-2,-10],[0,-4],[2,-2],[10,-1],[5,-1],[5,-2],[4,-3],[4,-4],[3,-5],[2,-6],[1,-9],[1,-15],[3,-9],[6,-14],[26,-26],[23,-11],[4,-3],[2,-5],[-10,-21],[-1,-24]],[[7779,9796],[-8,-3],[-10,-4],[-3,-4],[-6,-7],[-2,-6],[-2,-13],[-2,-4],[-5,-2],[-9,-1],[-11,-2],[-13,-5],[-55,-26],[-10,-8],[-12,-15],[-4,-7],[1,-5],[1,-4],[2,-4],[-1,-3],[-2,-2],[-5,-2],[-37,-10],[-11,-6],[-12,-19]],[[7563,9634],[-36,9],[-7,3],[-8,1],[-5,2],[-2,4],[1,4],[3,3],[4,2],[2,3],[1,2],[1,3],[0,2],[-1,6],[-1,5],[1,3],[2,3],[3,1],[4,1],[6,1],[5,-1],[6,-3],[5,-1],[3,3],[3,4],[1,5],[0,4],[-4,2],[-8,0],[-57,-3],[-21,5],[-26,12],[-3,4],[-2,5],[-3,2],[-5,1],[-26,-19],[-9,-2],[-20,4],[-17,0]],[[7353,9714],[-23,1]],[[7229,9911],[4,6],[1,12],[-2,9],[0,9],[6,10],[4,4],[19,13],[7,7],[5,4],[16,8],[21,5],[23,1],[19,-6],[18,-13],[2,0],[1,-6],[1,-4],[2,-3],[5,0],[5,-5],[5,-20],[8,-10],[7,3],[9,-3],[9,-5],[10,-2],[73,-4],[6,-2],[9,-5],[8,-6],[5,-6],[0,-9],[14,-5],[19,-2],[13,1],[43,12],[14,7],[7,-3],[13,-3],[11,0],[5,4],[5,6],[20,16],[7,3],[3,2],[4,6],[3,7],[2,5],[-1,7],[-3,4],[-19,19],[-14,11],[0,3],[5,1],[10,2],[5,1],[5,-2],[9,-4],[4,-1],[1,-1]],[[9874,2773],[-1452,1],[-6,1],[-4,1],[-5,4],[-13,15],[-13,16],[-12,19],[-21,47],[-5,9],[-6,7],[-4,4],[-3,2],[-6,1],[-5,1],[-12,0],[-40,4],[-44,14],[-3,2],[-15,14],[-3,2],[-2,1],[-11,0],[-3,1],[-7,3],[-18,12],[-36,12],[-13,2],[-24,1],[-32,6],[-1,1],[-2,1],[-15,10],[-6,5],[-11,12],[-4,3],[-10,5],[-6,5],[-29,32],[-1,0],[-3,2],[-12,4],[-2,1],[-21,13],[-5,5],[-5,7],[-12,13],[-4,3],[-8,5],[-3,1],[-3,0],[-7,0],[-3,0],[-3,1],[-3,2],[-6,6],[-3,2],[-3,1],[-6,2],[-3,1],[-2,2],[-9,8],[-4,3],[-3,1],[-3,1],[-3,0],[-20,-2],[-19,3],[-22,9],[-2,1],[-3,2],[-9,9],[-9,6],[-3,2],[-3,4],[-6,9],[-14,19],[-14,25],[-6,9],[-8,8],[-31,22],[-9,8],[-6,8],[-3,7],[-10,44],[0,59],[1,6],[1,4],[9,25],[3,5],[21,32],[3,5],[1,5],[1,5],[1,5],[0,6],[-1,6],[-3,6],[-4,10],[-8,11],[-14,15],[-55,71],[-5,103],[-6,25],[-7,14],[-119,34],[-16,7],[-12,8],[-52,23],[-5,3],[-3,2],[-6,7],[-102,140],[-4,3],[-50,25],[-4,3],[-2,2],[-2,3],[-2,7],[-1,8],[1,18],[2,12],[4,13],[40,98],[2,8],[0,6],[0,7],[-2,10],[-4,16],[-9,16],[-18,18],[-95,74],[-21,22],[-4,7],[-3,4],[-1,4],[-53,188],[-12,66],[10,47],[17,28],[31,27],[36,26],[120,117],[130,51],[19,17],[-10,67],[-17,44],[-29,29],[-241,192]],[[7086,5251],[227,133],[177,75],[73,1],[101,-16],[1076,653]],[[8740,6097],[26,-30],[62,-92],[57,-107],[38,-132],[39,-133],[10,-84],[2,-105],[-12,-92],[-24,-194],[6,-32],[71,-189],[-1,-22],[-2,-5],[-32,-110],[-9,-11],[-13,-7],[-12,-9],[1,-12],[8,-12],[4,-11],[-4,-11],[-20,-23],[-7,-12],[-7,-33],[-8,-21],[-2,-9],[0,-9],[41,-148],[9,-57],[5,-11],[5,-5],[22,-13],[8,-6],[1,-8],[-12,-59],[-1,-19],[5,-15],[2,-12],[-21,-71],[-9,-11],[-171,-84],[0,-11],[-2,-9],[-4,-8],[-17,-16],[-9,-22],[-7,-9],[-12,-26],[12,-31],[68,-98],[74,-106],[59,-86],[74,-106],[19,-35],[6,-35],[2,-73],[2,-78],[1,-77],[6,-14],[72,-44],[9,-15],[9,-52],[6,-19],[9,-10],[63,-53],[9,-4],[20,2],[56,22],[54,20],[10,2],[11,-2],[92,-32],[116,-40],[153,-53],[20,-7],[16,-9],[12,-17],[34,-71],[35,-75],[1,-1]],[[9874,2773],[54,-116],[34,-72],[37,-79],[-33,-22],[-33,-22],[-33,-22],[-33,-22],[-33,-22],[-33,-22],[-33,-22],[-33,-23],[-33,-22],[-32,-22],[-33,-22],[-33,-22],[-33,-22],[-33,-22],[-33,-23],[-33,-22],[-33,-22],[-33,-22],[-33,-22],[-33,-22],[-33,-22],[-33,-23],[-33,-22],[-33,-22],[-33,-22],[-33,-22],[-33,-22],[-33,-22],[-32,-23],[-33,-22],[-33,-22],[-33,-22],[-33,-22],[-33,-22],[-33,-22],[-33,-23],[-33,-22],[-33,-22],[-33,-22],[-33,-22],[-33,-22],[-33,-22],[-33,-23],[-33,-22],[-33,-22],[-33,-22],[-33,-22],[-33,-22],[-32,-22],[-33,-23],[-33,-22],[-33,-22],[-33,-22],[-33,-22],[-33,-22],[-33,-22],[-33,-23],[-33,-22],[-33,-22],[-33,-22],[-33,-22],[-33,-22],[-33,-22],[-33,-23],[-63,-42],[-48,-45],[-35,-32],[-34,-32],[-35,-32],[-34,-32],[-38,-35],[-18,-18],[-28,-27],[-31,-30],[-30,-30],[-31,-30],[-30,-30],[-31,-30],[-30,-30],[-31,-30],[-30,-30],[-31,-30],[-30,-29],[-31,-30],[-30,-30],[-31,-30],[-30,-30],[-31,-30],[-31,-30],[-38,-37],[-21,-16],[-21,-9],[-63,-14],[-48,-10],[-106,-23],[-106,-24],[-48,-10],[-92,-20],[-91,-20],[-91,-20],[-92,-20],[-83,-18],[-82,-17],[-47,-10]],[[5211,5552],[439,48]],[[5650,5600],[401,-318],[453,-47],[582,16]],[[4851,8330],[26,-50],[9,-10],[9,-5],[26,-11],[21,-11],[75,-20],[23,-9],[16,-9],[8,-7],[8,-8],[9,-11],[34,-69],[67,-95],[5,-17],[3,-24],[-3,-18],[-5,-14],[-18,-20],[-3,-6],[-2,-6],[1,-9],[6,-10],[9,-13],[4,-7],[4,-9],[5,-34],[3,-12],[7,-16],[12,-18],[47,-56],[15,-33],[27,-95],[14,-26]],[[5313,7572],[4,-18],[3,-25],[-4,-133],[3,-19],[15,-55],[4,-19],[1,-20],[-1,-22],[-5,-20],[-8,-19],[-42,-61],[-7,-16],[-1,-19],[3,-16],[9,-26],[2,-11],[-1,-10],[-8,-12],[-11,-9],[-41,-29],[-14,-14]],[[4246,8318],[5,15],[5,9],[4,7],[14,14],[18,15],[8,7],[3,5],[1,2],[2,6],[4,9],[4,5],[1,2],[3,2],[4,3],[8,2],[10,1],[29,-1],[5,2],[20,16],[4,4],[106,60],[2,2],[35,21],[16,6],[14,1]],[[4571,8533],[104,-31],[20,-14],[9,-9],[-8,-66],[1,-10],[3,-6],[7,-1],[74,4],[19,-3],[9,-5],[6,-8],[10,-23],[26,-31]],[[7446,8499],[9,-27],[15,-16],[104,-57],[28,-9],[57,-10]],[[7659,8380],[32,-16],[33,-10],[28,-3],[102,3]],[[7854,8354],[-10,-10],[-7,-15],[-1,-41],[-11,-55],[3,-21],[7,-31],[3,-9],[14,-26],[5,-29],[4,-14],[31,-51],[37,-62],[7,-21],[0,-3],[1,-73],[7,-26],[13,-13],[17,-5],[24,-2],[17,-6],[54,-37],[9,-5],[10,-2],[10,-1],[11,2],[10,-6],[46,-69],[49,-74],[7,-17],[6,-78],[5,-57],[6,-18],[0,-1],[14,-14],[59,-36],[77,-54],[102,-71],[81,-57],[7,-8],[5,-11],[9,-39]],[[8592,7188],[-847,1],[-70,8],[-67,20],[-49,49],[-38,54],[-60,104],[-21,46],[-106,357],[-42,88],[-90,33],[-573,36]],[[6629,7984],[55,72]],[[6684,8056],[46,75],[26,32],[21,20],[6,11],[4,13],[19,117],[-1,27],[-1,12],[-5,20],[-8,19],[-5,10],[-15,21],[-18,20],[-34,28],[-3,3],[-1,4],[1,7],[2,7],[3,7],[4,5],[5,5],[6,3],[19,7],[9,5],[6,5],[1,8],[-1,9],[3,8],[3,3],[2,0],[1,0],[31,-13],[46,-14],[252,-30],[95,18],[8,0],[77,-20],[28,-12],[5,-5],[4,-6],[5,-6],[7,-5],[10,-4],[7,-2],[10,-2],[15,1],[16,2],[17,6],[17,10],[17,14]],[[6614,7652],[-116,-171],[-95,-86],[-69,-44],[-12,-13],[-7,-9],[-18,-31],[-20,-52],[-39,-73],[-44,-100],[-29,-132],[-120,-863],[-39,-69],[-59,-53],[-36,-41],[-22,-31],[-40,-150],[-26,-33],[-173,-101]],[[5313,7572],[174,31],[56,20],[59,13],[103,10],[28,-4],[12,-4],[40,-19],[14,-2],[13,2],[13,8],[9,10],[19,24],[10,10],[149,68],[2,1],[12,2],[24,-2],[5,-1],[13,-8],[17,-1],[141,26]],[[6226,7756],[388,-104]],[[4851,8330],[148,103],[8,9],[5,14],[3,11],[8,15],[12,16],[26,27],[17,14],[13,9],[61,17],[11,6],[52,43],[45,25],[7,7],[4,6],[4,8],[4,4],[9,3],[37,6],[20,1]],[[5345,8674],[4,-29],[-3,-7],[-4,-9],[-13,-14],[-7,-13],[-4,-17],[-4,-31],[1,-20],[5,-15],[6,-7],[10,-10],[6,-7],[5,-9],[4,-13],[9,-48],[3,-9],[6,-9],[18,-19],[7,-10],[6,-11],[6,-13],[2,-9],[-1,-9],[-10,-29],[-3,-14],[0,-6],[4,-30],[4,-8],[7,-3],[14,0],[39,-5],[16,1],[4,0],[1,3],[2,13],[1,17],[-1,60],[0,6],[2,5],[3,2],[5,2],[44,7],[22,7],[7,4],[5,5],[5,13],[3,7],[7,7],[36,32],[8,5],[7,1],[5,-1],[12,-6],[4,-2],[7,-1],[24,0],[11,-4],[5,-6],[11,-32],[7,-40],[4,-13],[5,-13],[35,-57],[198,-212],[187,-157],[15,-15],[13,-16],[16,-30],[23,-59],[5,-18]],[[8592,7188],[1,-6],[14,-61],[14,-60],[14,-61],[13,-61],[14,-61],[14,-60],[14,-61],[13,-61],[14,-60],[14,-61],[14,-61],[13,-61],[14,-60],[14,-61],[13,-61],[14,-61],[-113,-61],[12,-18],[28,-34]],[[6614,7652],[-12,221],[16,53],[11,58]],[[5740,9805],[1,0],[27,-32]],[[5768,9773],[-24,-10],[-23,-4],[-5,-3],[-6,-2],[-6,0],[-8,2],[-5,4],[-3,5],[-1,3],[0,4],[0,3],[-1,2],[-2,4],[-2,2],[-13,4]],[[5669,9787],[0,13],[-1,2],[-3,2],[-19,0],[-5,2],[-1,2],[1,3],[2,3],[2,3],[0,11],[4,13],[0,4]],[[5649,9845],[14,-2],[17,-9],[12,-13],[14,-11],[18,-5],[16,0]],[[6160,9890],[0,-3],[-1,-15],[-2,-8],[-4,-7],[-14,-18],[-12,-12],[-8,-4],[-7,-1],[-4,-2],[-1,-5],[1,-4],[3,-4],[4,-6],[8,-9],[1,-4],[-3,-4],[-8,-8],[-5,-6],[-6,-5],[-6,-1],[-9,0],[-15,5],[-6,1],[-5,-1],[-4,-6],[-3,-5],[-4,-5],[-4,-1],[-4,1],[-3,2],[-2,3],[-3,2],[-5,1],[-4,-1],[-4,-1],[-4,-2],[-3,-4],[-1,-4],[-1,-18]],[[6012,9731],[-33,-6],[-7,0],[-5,2],[-1,4],[1,4],[4,6],[13,17],[2,5],[0,4],[-3,4],[-4,2],[-9,4],[-6,2],[-6,0],[-8,-2],[-18,-7],[-15,-1],[-29,6]],[[5888,9775],[-11,-6],[-4,-1],[-5,1],[-23,9],[-2,3],[-2,3],[-5,3],[-8,2],[-15,-1],[-17,-2],[-28,-13]],[[5740,9805],[3,0],[15,8],[6,8],[2,8],[0,15],[6,0],[31,-13],[18,-5],[58,-3],[10,1],[19,5],[10,2],[5,1],[4,4],[3,3],[3,3],[4,0],[11,-1],[5,1],[18,8],[29,27],[16,10],[41,12],[23,2],[18,-3],[18,-10],[7,-1],[5,1],[11,2],[17,1],[4,-1]],[[6427,9889],[1,-3],[1,-9],[3,-6],[20,-28],[2,-4],[0,-5],[0,-5],[-3,-13],[-3,-5],[-5,-2],[-5,0],[-12,5],[-5,1],[-7,-1],[-5,-4],[-5,-4],[-2,-7],[1,-4],[3,-4],[5,-3],[5,-2],[5,-1],[4,-2],[3,-3],[3,-5],[-1,-7],[-3,-8],[-19,-29],[-7,-15],[-5,-7],[-36,-37],[-1,-1],[-5,-2],[-7,-4],[-27,-9]],[[6320,9656],[-9,3],[-21,-4],[-8,0],[-21,5],[-7,1],[-16,-7],[-7,-1],[-121,4],[-23,8],[-18,10],[-16,14],[-13,8],[-15,12],[-13,22]],[[6160,9890],[22,-2],[9,-5],[21,10],[6,1],[6,-1],[12,-5],[7,-1],[6,2],[12,7],[6,2],[8,0],[14,-6],[7,-1],[58,7],[6,0],[7,-3],[7,-3],[5,-3],[6,-3],[15,0],[7,-3],[15,6],[5,0]],[[5669,9787],[-1,-7],[2,-4],[1,-2],[0,-1],[1,-1],[0,-2],[1,-1],[0,-2],[0,-1],[0,-3],[-2,-2],[-4,-2],[-9,-2],[-3,-1],[-3,-1],[-3,-4],[-4,-3],[-7,-1],[-56,2],[-4,-2],[-2,-3],[-1,-4],[-3,-5],[-6,-5],[-30,-14],[-9,-3],[-9,-4],[-9,-7],[-22,-19],[-8,-5],[-2,-4],[-2,-2],[0,-4],[-2,-6],[-4,-5],[-5,-4],[-10,-2],[-17,0],[-5,0],[-14,4],[-4,0],[-4,-3],[-2,-3],[-5,-22]],[[5403,9627],[-93,-3],[-68,13],[-12,0],[-33,-10],[-17,-4],[-6,-1],[-13,0],[-14,5],[-67,7],[-8,0],[-5,-4],[-4,-13],[-2,-5],[-5,-4],[-5,-4],[-11,-5],[-5,-1],[-4,0],[-13,26],[-16,16]],[[5002,9640],[2,10],[13,19],[5,11],[5,17]],[[5027,9697],[8,1],[5,1],[11,5],[6,1],[4,0],[10,-3],[6,0],[26,6],[28,2],[22,-4],[6,-1],[42,5],[121,33],[10,4],[10,1],[11,-3],[9,-5],[3,-5],[1,-5],[2,-4],[6,-2],[5,0],[10,-3],[5,0],[69,3],[16,5],[46,33],[31,16],[13,10],[12,16],[3,7],[12,12],[28,19],[21,4],[4,-1]],[[5403,9627],[5,-10],[3,-3],[3,-3],[4,-2],[2,-2],[1,-7],[4,-4],[9,1],[24,9],[14,2],[12,7],[2,-1],[2,-2],[4,-16]],[[5492,9596],[0,-7],[-2,-4],[-4,-6],[-8,-8],[-8,-5],[-9,-3],[-29,0],[-5,-2],[-3,-3],[-5,-6],[-6,-6],[-3,-3],[-2,-5],[0,-9],[1,-4],[1,-3],[8,-7],[3,-4],[2,-5],[4,-4],[2,-2],[1,0],[2,0],[3,1],[10,9],[4,2],[3,0],[8,-4],[17,0],[3,-1],[3,-2],[1,-4],[-2,-6],[-16,-13],[-6,-10],[-6,-15],[-5,-7],[-50,-30],[-4,-4],[-4,-5],[-2,-7],[-4,-13],[-4,-8],[-6,-8],[-31,-27],[-21,-26]],[[5323,9322],[-33,11],[-23,13],[-12,4],[-12,0],[-23,-4],[-26,1],[-18,3],[-10,-3],[-5,-6],[-2,-8],[-4,-4],[-8,-1],[-24,5],[-7,-1],[-9,-11],[-6,-3],[-5,3],[-4,5],[-14,15],[-45,12]],[[5033,9353],[-1,10],[2,8],[2,5],[-1,5],[-3,5],[-11,10],[-16,29],[-3,10],[-1,14],[-2,3],[-11,6],[-7,5],[-8,11],[-2,7],[2,5],[5,2],[6,2],[5,4],[3,5],[0,13],[-2,6],[-5,3],[-4,1],[-5,3],[0,4],[5,15],[-1,5],[-10,12],[-6,11],[-7,17],[-1,9],[3,8],[34,24],[9,10]],[[5033,9353],[-13,-3],[-5,2],[-18,7],[-13,7],[-2,3],[-2,2],[-2,3],[-1,5],[-1,3],[-1,3],[-3,4],[-12,9],[-4,0],[-2,-1],[-1,-1],[-1,-1],[0,-1],[-5,-7],[-8,-7],[-2,-3],[-1,-10],[-1,-4],[-2,-3],[-4,-3],[-21,-7],[-3,-2],[0,-3],[2,-4],[1,-5],[-2,-3],[-15,-9],[-4,-3],[-1,-4],[-1,-3],[2,-6]],[[4887,9308],[-16,6],[-5,3],[-5,6],[-5,9],[-3,4],[-8,9],[-4,6],[-10,23],[-3,2],[-4,2],[-5,-1],[-46,-12],[-8,0],[-9,3],[-18,11],[-7,4],[-5,3],[-3,4],[-3,6],[-6,9],[-3,3],[-3,1],[-18,2],[-18,-2],[-5,1],[-4,3],[-13,18],[-1,5],[0,4],[3,8],[1,4],[0,4],[-9,23],[-2,5],[-2,16],[-2,4],[-5,2],[-8,0],[-29,-7],[-19,-7],[-8,-1],[-9,1],[-15,6]],[[4545,9498],[-1,11],[16,44],[2,7],[1,10],[-1,9],[0,3]],[[4562,9582],[7,0],[7,4],[16,10],[31,8],[7,5],[5,5],[11,7],[6,5],[2,4],[1,5],[2,5],[5,5],[8,3],[21,5],[19,11],[35,0],[10,4],[20,9],[11,2],[21,0],[10,1],[11,3],[28,13],[10,2],[9,-2],[21,-7],[11,-2],[12,0],[20,6],[88,4]],[[4315,9227],[18,-14],[5,-16],[4,-21],[4,-10],[6,-9],[6,-6],[12,-1],[7,0],[17,4],[9,1],[11,-1],[11,-3],[13,-8],[15,-13],[9,-5],[8,0],[10,2],[9,1],[7,-1],[11,-7],[4,-4],[5,-4],[8,-4],[31,-5],[27,-11],[23,-4]],[[4605,9088],[-3,-10],[3,-4],[5,-4],[17,-10],[3,-3],[-1,-7],[-5,-9],[-23,-29],[-9,-8],[-11,-6],[-7,-1],[-7,1],[-7,4],[-17,6],[-8,1],[-5,0],[-6,-2],[-7,-3],[-7,-3],[-7,-5],[-7,-8],[-5,-10],[-13,-29],[-25,-31],[-11,-27]],[[4442,8891],[-7,-4],[-14,-11],[-8,-5],[-11,-2],[-10,0],[-20,5],[-8,0],[-18,-8],[-15,-3],[-8,-2],[-8,-4],[-10,-2],[-9,1],[-12,8],[-6,7],[-8,16],[-6,6],[-6,3],[-5,-1],[-7,-2],[-8,-1],[-13,3],[-9,0],[-6,-6],[-4,-8],[-4,-2],[-5,0],[-10,6],[-8,8],[-4,2],[-7,1],[-5,4],[-3,3],[-1,3],[0,3],[0,7],[0,3],[0,3],[-3,6],[-1,2],[-2,2],[-3,0],[-4,-2],[-3,-4],[-1,-4],[-1,-4],[-1,-2],[-2,-2],[-14,-3]],[[4148,9276],[1,-4],[1,-2],[1,-2],[1,-2],[2,-1],[1,-2],[1,-2],[0,-2],[-1,-3],[1,-3],[4,-4],[18,-8],[3,-2],[2,-1],[2,-1],[5,0],[9,1],[23,6],[14,6],[14,9],[4,2],[3,-1],[4,-2],[5,-7],[2,-5],[8,-24],[2,-2],[1,0],[5,2],[2,2],[6,2],[4,1],[19,0]],[[4545,9498],[-11,-11],[-5,-9],[-6,-7],[-17,-15],[-4,-5],[-5,-12],[-4,-4],[-7,-3],[-12,-4],[-5,-2],[-2,-4],[-1,-6],[0,-13],[-1,-4],[-1,-4],[-1,-5],[0,-6],[-1,-4],[-2,-2],[-6,-3],[-4,-1],[-13,-1],[-5,0],[-4,-1],[-5,-3],[-7,-11],[-2,-7],[-2,-6],[1,-3],[1,-2],[4,-2],[2,-1],[1,-1],[0,-2],[0,-2],[-7,-28],[-1,-4],[-4,-5],[-5,-6],[-10,-9],[-7,-5],[-7,-1],[-9,0],[-4,0],[-3,-1],[-6,-2],[-6,-4],[-15,-13],[-5,-7],[-6,-4],[-8,-7],[-3,-9]],[[4149,9279],[15,3],[21,10],[20,14],[16,14],[17,32],[5,14],[16,35],[4,13],[1,6],[2,3],[4,3],[4,2],[4,3],[24,23],[8,6],[31,9],[5,4],[3,4],[10,6],[4,3],[2,5],[2,13],[3,5],[8,4],[12,3],[21,0],[11,2],[9,5],[7,7],[35,22],[19,5],[8,7],[8,7],[8,6],[9,2],[37,3]],[[4887,9308],[-3,-14],[-13,-16],[-8,-6],[-7,-4],[-6,0],[-14,4],[-7,2],[-7,-3],[-4,-6],[-2,-8],[0,-18],[-1,-9],[-8,-29]],[[4807,9201],[-19,-1],[-10,-3],[-26,-15],[-18,-5],[-23,-14],[-14,0],[-4,-2],[0,-4],[2,-4],[4,-4],[0,-4],[-2,-1],[-2,0],[-2,1],[-3,3],[-3,1],[-4,2],[-5,-1],[-4,-1],[-6,-3],[-33,-35],[-3,-4],[-1,-4],[1,-9],[-2,-6],[-3,-3],[-4,-1],[-4,0],[-5,1],[-9,3]],[[4442,8891],[65,5],[13,-3],[0,-12],[1,-1],[1,-3],[1,-1],[12,-7],[17,-8],[9,-6],[8,-7],[10,-13],[3,-7],[2,-8],[-1,-5],[-4,-7],[-45,-38],[-6,-6],[-1,-8],[0,-12],[3,-17],[10,-29],[78,-129],[1,-2],[-1,-1],[-1,-3],[-3,-4],[-5,-4],[-29,-15],[-9,-7]],[[5293,9152],[18,-66]],[[5311,9086],[0,-61],[3,-4],[4,-4],[9,-4],[4,-2],[9,-1],[3,-3],[4,-5],[6,-13],[3,-7],[1,-8],[-2,-7],[-1,-6],[2,-4],[4,-4],[105,-79],[6,-7],[2,-6],[-4,-5],[-8,-3],[-34,-9],[-1,-1],[-8,-15],[-23,-56],[-10,-16],[-34,-36],[-6,-46]],[[4807,9201],[12,-14],[5,-2],[6,-1],[5,4],[3,5],[4,16],[3,8],[5,6],[6,1],[6,-2],[7,-3],[13,-2],[27,-12],[6,-4],[4,-4],[2,-6],[2,-13],[3,-6],[5,-1],[7,2],[9,3],[12,2],[8,-5],[16,-17],[12,-9],[12,-1],[6,3],[6,11],[4,4],[4,-1],[3,-3],[3,-5],[2,-3],[6,-3],[8,-1],[55,2],[44,9],[49,2],[4,-2],[3,-6],[0,-5],[2,-4],[5,0],[16,6],[23,3],[43,-1]],[[5323,9322],[-34,-68],[-7,-6],[-9,-4],[-9,-1],[-8,-3],[-5,-5],[-2,-6],[1,-8],[4,-10],[10,-10],[8,-6],[18,-6],[5,-6],[4,-5],[-6,-26]],[[6528,9605],[-5,-8],[-2,-4],[0,-6],[2,-7],[7,-9],[8,-6],[9,-1],[7,0],[21,-3],[8,0],[15,1],[22,7],[4,1],[4,-1],[14,-2],[13,-5],[6,-4],[4,-7],[12,-20],[9,-7],[9,-2],[7,3],[7,4],[7,2],[5,-2],[2,-5],[2,-7],[1,-7],[2,-6],[3,-1],[4,2],[5,4],[5,-1],[3,-4],[0,-9],[-2,-6],[-3,-9],[-8,-9],[-8,-4],[-8,-1],[-4,-3],[-1,-4],[2,-7],[4,-11],[0,-5],[-5,-7],[-2,-5],[-2,-10],[-1,-10],[-11,-19],[-4,-9],[-4,-16],[0,-13],[2,-23],[0,-8],[-3,-5],[-6,-1],[-22,-1],[-5,-2],[-4,-6],[-2,-5],[0,-24]],[[6651,9272],[-18,1],[-8,3],[-12,7],[-10,10],[-5,2],[-7,1],[-6,2],[-6,3],[-4,4],[-11,14],[-4,4],[-5,2],[-9,0],[-17,-4],[-19,0],[-7,-1],[-14,-4],[-38,-15],[-10,-3],[-10,-1],[-49,1],[-8,1],[-7,4],[-9,9],[-2,6],[2,5],[15,13],[4,5],[2,6],[3,8],[1,2],[3,1],[9,2],[6,1],[1,2],[0,4],[-2,4],[-5,7],[-2,4],[-4,11],[-2,9],[-2,4],[-2,3],[-3,2],[-6,0],[-10,-4],[-18,-11],[-10,-5],[-12,-1],[-16,2],[-63,12],[-15,-1],[-7,-3],[-3,-2],[-1,-3],[-1,0],[-1,-2],[-4,0],[-6,0],[-12,2],[-1,1],[-1,5],[-2,4],[-2,3],[-8,3]],[[6181,9411],[5,10],[3,3],[15,11],[7,9],[5,11],[6,20],[4,9],[7,9],[22,17],[11,12],[23,33],[24,28]],[[6313,9583],[10,-11],[7,-29],[8,-16],[8,-7],[10,-2],[32,2],[8,1],[17,6],[28,5],[5,3],[1,6],[-2,6],[-1,6],[0,8],[2,16],[2,5],[4,4],[17,7],[8,5],[5,5],[14,19],[7,5],[5,3],[4,0],[3,-2],[3,-4],[8,-15],[0,-1],[2,-3]],[[6855,9721],[-7,-9],[-1,-4],[-1,-3],[0,-7],[0,-4],[1,-5],[1,-4],[1,-5],[0,-4],[-1,-3],[-2,-2],[-2,-2],[-13,-8],[-9,-4],[-18,-4],[-16,-7],[-4,-3],[-3,-3],[-3,-5],[-2,-7],[0,-6],[-1,-7],[-3,-5],[-13,-4],[-11,-2],[-16,3],[-7,5],[-9,9],[0,4],[3,13],[0,5],[-2,7],[-3,5],[-8,10],[-1,3],[1,2],[1,1],[5,3],[5,4],[2,5],[-1,3],[-2,4],[-15,11],[-7,6],[-4,3],[-4,2],[-12,2],[-6,0],[-6,-2],[-6,-6],[-2,-6],[-1,-7],[-2,-5],[-4,-3],[-8,-1],[-6,1],[-4,2],[-3,0],[-1,1],[-21,-12],[-3,-3],[-1,-1],[0,-1],[1,-2],[2,-3],[11,-8],[4,-4],[0,-4],[-3,-3],[-9,-5],[-5,-5],[-2,-5],[0,-6],[-1,-6],[-4,-4],[-7,-6],[-7,-3],[-10,-3],[-8,-1],[-34,2]],[[6313,9583],[5,5],[6,4],[6,3],[3,2],[1,5],[-2,8],[1,6],[1,6],[2,4],[0,4],[-1,6],[-10,11],[-5,9]],[[6427,9889],[15,1],[37,-3],[34,4],[9,-2],[79,-30],[8,-8],[3,-4],[6,-1],[7,0],[4,0],[4,-3],[4,-7],[2,-2],[8,-4],[10,-2],[10,-2],[9,0],[-10,-26],[2,-9],[14,-10],[57,-26],[16,-4],[17,-1],[33,5],[27,7]],[[5888,9775],[14,-25],[2,-6],[-1,-5],[-5,-3],[-3,-3],[-8,-11],[-4,-5],[-6,-3],[-6,-3],[-52,-9],[-7,-3],[-4,-4],[-4,-5],[-5,-11],[-6,-13]],[[5793,9666],[-18,-4],[-12,-1],[-8,-4],[-4,-4],[-3,-6],[-3,-6],[-10,-9],[-12,-6],[-17,-6],[-24,-14],[-13,-10],[-9,-4],[-5,-2],[-7,1],[-8,3],[-7,7],[-5,8],[-4,9],[-4,5],[-7,1],[-6,-3],[-11,-12],[-7,-5],[-7,-5],[-11,-2],[-9,0],[-11,1],[-48,-4],[-11,2]],[[6181,9411],[-18,-45],[-3,-21],[1,-8],[0,-8],[-3,-5],[-7,-2],[-8,2],[-18,9],[-7,2],[-6,-1],[-7,-3],[-17,-10],[-9,-2],[-11,0],[-9,4],[-7,6],[-6,6],[-4,4],[-6,3],[-6,2],[-6,3],[-9,8],[-2,2],[-15,1],[-37,-5]],[[5961,9353],[-24,42],[-7,28],[-2,16],[1,15],[5,48],[0,15],[-2,11],[-7,22],[-1,10],[0,5],[2,4],[9,8],[4,5],[-1,6],[-9,14],[-1,10],[0,11],[-3,6],[-4,3],[-6,1],[-12,4],[-4,1],[-5,-2],[-16,-6],[-4,-3],[-7,-8],[-6,1],[-8,6],[-12,14],[-9,8],[-10,6],[-29,12]],[[7394,8721],[8,0],[6,0],[25,7],[7,1],[7,0],[4,-1],[4,-1],[3,-2],[3,-6],[8,-17],[2,-10],[1,-7],[-4,-23],[-1,-19],[-2,-19],[-8,-35],[-7,-23],[-2,-5],[-2,-7],[0,-6],[5,-29],[-5,-20]],[[6684,8056],[-347,196],[-21,16],[-10,10],[-3,6],[-4,15],[-9,56],[-2,6],[-3,5],[-5,4],[-16,4],[-10,3],[-8,6],[-3,5],[-1,4],[3,9],[0,5],[-1,14]],[[6244,8420],[35,2],[6,1],[7,3],[2,5],[-1,6],[-4,6],[-6,6],[-6,7],[-7,17],[-12,16],[-6,10],[-11,49],[-3,7],[-4,4],[-3,5],[-1,8],[5,10],[19,20],[6,10],[6,14],[7,11],[36,35],[8,11],[15,21],[9,8],[10,6],[9,1],[9,0],[14,-2],[6,-1],[8,2],[19,6],[23,3],[41,13],[8,2],[13,-3],[7,1],[14,4],[6,1],[8,-1],[7,0],[49,11],[13,6],[20,13],[14,14],[6,11],[1,10],[-2,80]],[[6644,8889],[17,-1],[33,-15],[20,-12],[25,-6],[18,-1],[16,1],[12,5],[12,8],[11,5],[10,3],[56,2],[11,2],[7,3],[7,5],[5,2],[10,4],[6,4],[2,4],[0,7],[-1,4],[-3,6],[-3,3],[-20,17],[-4,7],[2,3],[35,8],[42,25],[22,10],[30,10],[5,1],[6,-2],[17,-15],[41,-15],[10,0],[7,-1],[4,-2],[0,-6],[-3,-6],[-5,-6],[-20,-16],[-6,-6],[-2,-5],[6,-20],[0,-9],[-8,-17],[0,-9],[6,-8],[11,-10],[6,-5],[9,-7],[9,-1],[6,4],[3,2],[7,20],[4,8],[4,4],[5,1],[6,-1],[6,-3],[4,-5],[3,-6],[2,-7],[3,-7],[2,-3],[3,-2],[7,-3],[10,0],[11,5],[2,0],[9,-1],[1,1],[1,1],[4,10],[4,5],[15,8],[7,3],[8,1],[12,0],[25,4],[11,4],[9,1],[8,-2],[9,-10],[5,-8],[0,-8],[-1,-4],[-4,-10],[-1,-6],[-1,-8],[0,-23],[-6,-29],[0,-9],[4,-10],[6,-7],[8,-7],[14,-17],[5,-3],[7,-4],[9,-2],[8,-1],[8,2],[3,1],[4,5]],[[5840,9258],[28,-44],[6,-7],[35,-27],[7,-4],[12,-8],[58,-51],[5,-6],[2,-7],[1,-10],[-1,-9],[-2,-9],[-4,-7],[-4,-4],[-4,-5],[-3,-5],[-1,-5],[1,-9],[5,-21],[0,-7],[-3,-7],[-4,-5],[-88,-70],[1,-6],[23,-44],[4,-8],[4,-1],[5,1],[18,8],[6,1],[4,-2],[1,-5],[-3,-5],[-4,-5],[-5,-6],[-4,-5],[-2,-5],[-1,-3],[0,-2],[1,-1],[2,-6],[7,-14],[2,-5],[0,-6],[-2,-12],[-1,-5],[2,-7],[3,-7],[5,-8],[7,-6],[9,-6],[3,-4],[1,-6],[1,-7],[2,-8],[6,-8],[9,-4],[8,0],[16,4],[8,0],[73,-16],[4,-2],[3,-3],[0,-7],[-1,-17],[0,-9],[1,-11],[21,-71],[8,-15],[24,-33],[3,-9],[2,-10],[0,-10],[-1,-10],[0,-8],[5,-10],[10,-11],[41,-26],[8,-7],[13,-18],[8,-5]],[[5311,9086],[93,30],[23,4],[2,0],[36,-27],[7,-4],[9,-2],[8,1],[8,2],[8,4],[7,6],[6,7],[8,14],[2,3],[6,7],[9,8],[57,42],[5,5],[2,5],[2,7],[0,7],[-2,16],[0,5],[0,11],[0,5],[-5,16],[-2,8],[0,8],[4,6],[4,2],[6,2],[9,0],[14,4],[10,-3],[7,-5],[2,-6],[4,-13],[2,-6],[4,-5],[9,-6],[3,-3],[2,-6],[4,-15],[4,-4],[8,-2],[47,8],[9,5],[5,4],[4,8],[7,29],[5,9],[7,6],[5,2],[4,-3],[6,-12],[4,-5],[6,-5],[7,-3],[7,-1],[21,2]],[[5961,9353],[0,-7],[2,-12],[-1,-5],[-3,-5],[-6,-8],[-2,-10],[-3,-3],[-19,-7],[-11,-9],[-2,-6],[2,-8],[5,-14],[2,-7],[1,-9],[0,-18],[-3,-7],[-4,-4],[-9,8],[-6,6],[-4,7],[-5,9],[-6,10],[-23,29],[-6,4],[-5,1],[-4,-3],[-4,-3],[-7,-24]],[[6651,9272],[3,-5],[3,-3],[6,-5],[11,-7],[34,-12],[2,-4],[4,-12],[7,-7],[13,-7],[75,-17]],[[6809,9193],[-56,-46],[-14,-8],[-12,-4],[-18,-10],[-9,-2],[-8,3],[-7,4],[-9,2],[-29,0],[-11,-1],[-8,-4],[-4,-2],[-4,-5],[-2,-2],[-11,-5],[-7,1],[-6,3],[-2,2],[-9,10],[-4,3],[-4,2],[-5,1],[-3,-2],[-2,-3],[0,-5],[10,-32],[2,-20],[1,-20],[-1,-14],[-6,-30],[-3,-9],[-8,-12],[-15,-15],[-18,-15],[-7,-9],[-3,-6],[1,-4],[1,-3],[4,-3],[4,-2],[36,-3],[13,-2],[13,-4],[10,-5],[10,-6],[4,-4],[4,-4],[6,-9],[2,-2],[2,-1],[4,-2],[8,0],[5,0]],[[6982,9702],[7,-7],[3,-4],[3,-6],[2,-6],[1,-9],[-3,-16],[1,-9],[5,-7],[7,-4],[9,-1],[9,0],[9,0],[8,-6],[4,-10],[2,-21],[-1,-36],[-3,-13],[-1,-11],[6,-8],[7,-2],[9,0],[7,-1],[4,-6],[-2,-9],[-5,-6],[-5,-4],[-5,-5],[0,-6],[5,-8],[6,-6],[3,-5],[1,-3],[1,-7],[2,-4],[5,-6],[8,-4],[7,-7],[3,-11],[-5,-54],[3,-8],[-1,-17]],[[7098,9349],[-15,-9],[0,-3],[0,-4],[2,-5],[0,-7],[-5,-2],[-9,2],[-20,16],[-12,7],[-16,4],[-11,0],[-10,-4],[-16,-9],[-7,-5],[-5,-6],[-4,-6],[-1,-6],[3,-5],[4,-3],[8,-3],[7,-4],[3,-6],[-8,-16],[-5,-6],[-6,-1],[-20,7],[-5,4],[-6,4],[-5,4],[-12,4],[-8,4],[-9,3],[-7,-3],[-4,-6],[-3,-7],[-3,-7],[-9,-5],[-24,-16],[-4,-4],[-3,-5],[-1,-7],[-1,-16],[-3,-9],[-4,-7],[-7,-8],[-7,-4],[-7,-2],[-14,1]],[[7181,9340],[61,-19],[9,1],[11,1],[7,8],[4,2],[6,-1],[13,-12],[7,-4],[7,-2],[25,-2],[4,-1],[5,-4],[2,-6],[0,-6],[-1,-7],[0,-6],[4,-7],[7,-2],[9,2],[29,11],[11,1],[11,-1],[11,-3],[24,-17],[34,-45]],[[7481,9221],[3,-27],[6,-24],[-1,-9],[-2,-7],[-7,-14],[-5,-7],[-7,-6],[-10,-5],[-26,-8],[-9,-4],[-10,-6],[-8,-8],[-9,-11],[-3,-9],[2,-16],[-3,-18],[0,-9],[2,-5],[5,-4],[7,2],[5,0],[2,-2],[0,-6],[-4,-7],[-18,-18],[-6,-10],[-6,-37],[-18,-30],[-3,-7],[-1,-6],[-1,-21],[1,-10],[3,-8],[14,-21],[18,-37],[3,-9],[4,-9],[-2,-4],[-10,-20],[-2,-9],[0,-8],[2,-7],[4,-13],[3,-6]],[[7098,9349],[19,-6],[5,-2],[20,-5],[39,4]],[[7563,9634],[4,-3],[1,-1],[7,-13],[2,-8],[2,-7],[4,-6],[9,-5],[1,-3],[2,-5],[-1,-10],[1,-5],[3,-7],[6,-3],[5,-1],[4,-4],[2,-6],[2,-20],[-2,-14],[-3,-10],[-14,-22]],[[7598,9481],[-13,-4],[-9,0],[-7,-3],[-15,-13],[-10,-7],[-5,1],[-1,5],[0,8],[-3,8],[-45,25],[-7,0],[-6,-2],[-4,-3],[-5,-4],[-6,-2],[-24,-6],[-8,-3],[-9,-6],[-23,-10],[-1,-1],[0,-2],[-2,-4],[-3,-3],[-4,1],[-2,1],[-12,15],[-15,15]],[[7359,9487],[4,21],[-2,6],[-25,32],[-44,42],[-8,3],[-13,-1],[-7,3],[-1,5],[2,6],[4,6],[5,3],[4,3],[9,4],[5,1],[11,4],[31,4],[7,3],[2,7],[-2,8],[-6,14],[-1,5],[1,3],[2,2],[7,4],[2,2],[2,3],[1,5],[1,4],[3,25]],[[8071,9663],[-56,-29],[-14,-1],[-19,6],[-4,0],[-1,-4],[7,-17],[1,-4],[0,-6],[1,-6],[4,-5],[5,-8],[2,-9],[-2,-11],[-8,-5],[-9,-4],[-8,-2],[-17,-1],[-48,-23],[-49,-15],[-4,-3],[-7,-10],[-6,-3],[-6,-1],[-10,0],[-31,-7],[-7,-4],[-4,-5],[-6,-12],[-4,-4],[-5,-3],[-5,-1],[-10,0]],[[7751,9466],[-17,8],[-25,2],[-7,-1],[-5,-3],[-2,-6],[-2,-16],[-5,-10],[-11,-7],[-19,-8],[-13,-4],[-14,-2],[-6,2],[-2,5],[-1,5],[-3,4],[-5,5],[-5,5],[-4,5],[-3,7],[-1,8],[-1,11],[-2,5]],[[7857,9091],[-12,-11],[-46,-17],[-6,-6],[0,-6],[3,-7],[0,-8],[-3,-18],[1,-8],[1,-9],[-1,-9],[-5,-11],[-1,-9],[2,-8],[3,-10],[2,-10],[-3,-14],[-4,-11],[-7,-11],[-29,-30],[-17,-22],[-15,-13],[-16,-23],[-3,-6],[-1,-5],[0,-3],[1,-2],[1,-3],[0,-3],[0,-6],[0,-3],[1,-3],[3,-5],[2,-5],[1,-2],[1,-6],[2,-5],[5,-10],[2,-2],[3,0],[3,2],[2,3],[0,2],[-2,5],[-1,3],[-1,9],[0,3],[-1,3],[-1,2],[-2,2],[-1,2],[-2,2],[0,4],[2,10],[1,4],[2,4],[2,2],[3,1],[3,1],[3,1],[2,3],[4,7],[2,3],[2,2],[3,0],[7,-3],[4,-1],[6,0],[3,-1],[3,-1],[2,-2],[2,-2],[1,-3],[0,-3],[0,-13],[0,-3],[0,-3],[1,-3],[1,-2],[3,-5],[1,-2],[1,-4],[1,-4],[-2,-30],[0,-3],[1,-2],[7,-21],[1,-4],[0,-5],[0,-8],[-1,-6],[-1,-5],[-11,-24],[-9,-17],[-18,-23],[-10,-21],[-1,-3],[-6,-6],[-2,-3],[-3,-5],[-10,-26],[-4,-17],[-9,-52],[-11,-40],[-33,-75]],[[7481,9221],[9,-13],[7,-11],[5,-5],[6,-4],[13,-3],[10,0],[59,7],[5,-1],[6,-4],[9,-19],[8,-6],[15,0],[10,4],[7,8],[6,6],[6,4],[4,1],[27,-3],[4,0],[1,2],[1,1],[1,2],[1,2],[2,0],[11,-1],[9,-2],[10,-4],[7,-7],[3,-11],[0,-20],[3,-5],[8,1],[5,5],[5,8],[4,5],[5,3],[7,-2],[7,-5],[12,-16],[6,-2],[3,2],[5,3],[4,0],[4,-4],[5,-16],[2,-4],[4,-5],[14,-9],[11,-12]],[[7359,9487],[-4,0],[-8,-2],[-7,-2],[-15,-8],[-12,-11],[-7,-8],[-4,-11],[2,-17],[-1,-8],[-2,-9],[-9,-8],[-13,-9],[-25,-10],[-31,-9],[-22,-4],[-10,-3],[-5,-3],[-4,-5],[-1,-5],[0,-15]],[[7751,9466],[0,-27],[20,-42],[15,-20],[9,-8],[17,-18],[7,-6],[8,-3],[19,-6],[8,-4],[5,-7],[7,-18],[7,-4],[31,-1],[9,2],[4,4],[1,7],[0,7],[3,5],[8,7],[4,6],[3,8],[5,7],[8,4],[12,0],[10,-5],[8,-5],[33,-32]],[[8012,9317],[-2,-9],[0,-2],[0,-3],[2,-6],[-1,-5],[-19,-41],[-1,-14],[1,-13],[8,-23],[2,-10],[-2,-8],[-8,-5],[-8,-3],[-8,-1],[-7,-3],[-112,-80]],[[8207,9379],[-18,7],[-4,2],[-5,3],[-6,6],[-3,1],[-2,-1],[-2,-1],[-1,-1],[-5,-3],[-3,-1],[-18,-1],[-3,0],[-5,-3],[-16,-3],[-21,-1],[-16,-4],[-6,-2],[-3,-2],[-2,-2],[-2,-3],[-2,-5],[-1,-3],[-1,-2],[-2,-2],[-5,-4],[-18,-8],[-5,-4],[-2,-2],[-3,-4],[-5,-7],[-10,-12]],[[8159,9667],[0,-1],[19,-7],[42,-5],[10,-5],[9,-2],[7,-4],[5,-10],[0,-11],[0,-23],[-2,-7],[0,-3],[-23,-59],[-2,-23],[2,-11],[4,-10],[1,-10],[-5,-11],[-5,-9],[-10,-40],[-2,-31],[-2,-6]],[[8207,9379],[-10,-35],[-3,-44],[2,-23],[6,-19],[24,-37],[8,-18],[2,-17],[5,-46],[-1,-16],[-17,-39],[-5,-19],[-1,-21],[3,-22],[11,-20],[18,-8],[21,-6],[16,-12],[-5,-11],[-29,-42],[-23,-24],[-6,-19],[-9,-41],[-11,-29],[-5,-22],[1,-20],[9,-56],[-2,-7],[-3,-5],[-1,-1],[-16,-16],[-5,-8],[-2,-9],[13,-18],[-4,-6],[-17,-11],[-3,-4],[-4,-10],[-2,-3],[-4,-4],[-11,-7],[-20,-16],[-4,-4],[-46,-20],[-20,-13],[-42,-18],[-19,-13],[-10,-19],[-18,-65],[-4,-9],[-6,-7],[-10,-5],[-30,-5],[-19,-9],[-13,-13],[-12,-15],[-20,-19]]],"transform":{"scale":[0.00206533112611261,0.0018120190321032098],"translate":[-8.682385212999918,18.97556121800008]}};
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
