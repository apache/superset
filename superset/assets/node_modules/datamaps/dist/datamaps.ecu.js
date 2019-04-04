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
  Datamap.prototype.dzaTopo = '__DZA__';
  Datamap.prototype.ecuTopo = {"type":"Topology","objects":{"ecu":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Azuay"},"id":"EC.AZ","arcs":[[0,1,2,3,4,5]]},{"type":"Polygon","properties":{"name":"El Oro"},"id":"EC.EO","arcs":[[-4,6,7,8]]},{"type":"Polygon","properties":{"name":"Loja"},"id":"EC.LJ","arcs":[[9,10,-7,-3]]},{"type":"Polygon","properties":{"name":"Zamora Chinchipe"},"id":"EC.ZC","arcs":[[11,-10,-2,12]]},{"type":"MultiPolygon","properties":{"name":"Galápagos"},"id":"EC.GA","arcs":[[[13]],[[14]],[[15]],[[16]],[[17]],[[18]],[[19]],[[20]],[[21]],[[22]],[[23]],[[24]]]},{"type":"Polygon","properties":{"name":"Bolivar"},"id":"EC.BO","arcs":[[25,26,27,28,29]]},{"type":"Polygon","properties":{"name":"Cañar"},"id":"EC.CN","arcs":[[30,-6,31,32]]},{"type":"Polygon","properties":{"name":"Cotopaxi"},"id":"EC.CT","arcs":[[33,34,-30,35,36,37]]},{"type":"MultiPolygon","properties":{"name":"Guayas"},"id":"EC.GU","arcs":[[[38]],[[39]],[[-28,-32,-5,-9,40,41,42,43]]]},{"type":"Polygon","properties":{"name":"Los Rios"},"id":"EC.LR","arcs":[[-36,-29,-44,44,45]]},{"type":"Polygon","properties":{"name":"Manabi"},"id":"EC.MN","arcs":[[46,-45,-43,47,48,49]]},{"type":"Polygon","properties":{"name":"Chimborazo"},"id":"EC.CB","arcs":[[50,-33,-27,51]]},{"type":"Polygon","properties":{"name":"Morona Santiago"},"id":"EC.MS","arcs":[[52,-13,-1,-31,-51,53,54]]},{"type":"Polygon","properties":{"name":"Orellana"},"id":"EC.NA","arcs":[[55,56,57,58]]},{"type":"Polygon","properties":{"name":"Pichincha"},"id":"EC.PI","arcs":[[59,60,61,-38,62,63]]},{"type":"Polygon","properties":{"name":"Pastaza"},"id":"EC.PA","arcs":[[64,-55,65,66,-57]]},{"type":"Polygon","properties":{"name":"Napo"},"id":"EC.","arcs":[[-66,-54,-52,-26,-35,67]]},{"type":"Polygon","properties":{"name":"Tungurahua"},"id":"EC.TU","arcs":[[-58,-67,-68,-34,-62,68]]},{"type":"MultiPolygon","properties":{"name":"Esmeraldas"},"id":"EC.ES","arcs":[[[69]],[[70,71,-64,72,-50,73]]]},{"type":"Polygon","properties":{"name":"Carchi"},"id":"EC.CR","arcs":[[74,75,-71,76]]},{"type":"Polygon","properties":{"name":"Imbabura"},"id":"EC.IM","arcs":[[77,-60,-72,-76]]},{"type":"Polygon","properties":{"name":"Sucumbios"},"id":"EC.SU","arcs":[[-59,-69,-61,-78,-75,78]]},{"type":"Polygon","properties":{"name":"Santa Elena"},"id":"EC.SE","arcs":[[-42,79,-48]]},{"type":"Polygon","properties":{"name":"Santo Domingo de los Tsáchilas"},"id":"EC.SD","arcs":[[-37,-46,-47,-73,-63]]}]}},"arcs":[[[8020,3667],[-4,-44],[1,-15],[2,-15],[5,-11],[5,-6],[5,2],[2,8],[1,16],[3,16],[3,16],[6,13],[6,8],[6,5],[5,-1],[4,-4],[18,-35],[4,-10],[3,-14],[1,-12],[0,-13],[-2,-13],[-7,-14],[-66,-85],[-6,-12],[-5,-16],[-19,-88],[0,-10],[1,-10],[4,-12],[5,-14],[4,-15],[2,-14],[1,-15],[-4,-21],[-28,-117],[-4,-24],[-1,-16],[-15,-75],[-2,-24],[0,-24],[1,-22],[-2,-27],[-6,-26],[-15,-43],[-15,-30],[-21,-27],[-22,-19],[-12,-29],[-73,-147],[-3,-15],[-1,-11],[3,-27]],[[7788,2529],[-12,-28],[-34,-47],[-10,-20],[-8,-19],[-5,-20],[-3,-15],[-1,-13],[1,-12],[3,-23],[3,-8],[2,-10],[0,-12],[-4,-29],[-2,-16],[0,-18],[4,-53],[-7,-87],[-3,-14],[-3,-12],[-4,-6],[-4,-3],[-10,-4]],[[7691,2060],[-11,38],[-2,45],[0,35],[-4,30],[-18,72],[-7,32],[-4,29],[-4,10],[-5,-3],[-16,-21],[-9,-4],[-12,0],[-15,16],[-7,19],[-4,20],[-1,32],[1,29],[-1,16],[-3,23],[-7,15],[-7,9],[-8,1],[-16,-4],[-21,1],[-16,6],[-15,15]],[[7479,2521],[-20,19],[-10,4],[-8,0],[-22,-6],[-34,-19],[-21,1],[-7,6],[-3,8],[1,12],[2,7],[12,14],[6,10],[3,14],[3,31],[14,65],[2,20],[1,21],[-1,23],[-3,19],[-23,50],[-73,96]],[[7298,2916],[1,29],[2,13],[4,19],[33,100],[0,12],[-1,42],[-4,41],[-1,28],[3,38],[5,36],[130,342],[3,5],[4,5],[3,6],[5,12],[13,35],[4,14],[1,17],[-5,18],[-7,38]],[[7491,3766],[20,-3],[9,-13],[7,-20],[11,-58],[5,-15],[8,-7],[15,-4],[10,-16],[5,-16],[3,-15],[4,-16],[5,-17],[53,-138],[8,-13],[6,-5],[7,9],[1,11],[1,14],[0,13],[4,10],[5,8],[12,12],[5,10],[3,10],[1,11],[2,11],[4,7],[4,1],[6,-6],[8,-13],[9,-19],[8,-21],[17,-57],[10,-18],[14,-34],[3,-14],[3,-15],[3,-37],[3,-16],[9,-9],[22,-5],[9,1],[6,2],[6,4],[4,1],[6,-2],[4,-3],[2,2],[1,10],[-2,24],[1,12],[2,13],[12,35],[2,9],[1,10],[0,11],[-2,15],[-2,17],[2,14],[4,15],[5,11],[6,7],[8,-1],[12,-6],[4,1],[6,8],[8,14],[11,25],[7,10],[13,8],[7,6],[9,16],[3,20],[1,17],[3,17],[6,16],[22,37],[9,-2]],[[7479,2521],[-4,-79],[2,-26],[2,-26],[3,-14],[3,-6],[5,-3],[4,-4],[3,-6],[2,-9],[1,-8],[-1,-10],[-2,-8],[-21,-59],[-3,-17],[-2,-17],[-1,-35],[1,-20],[-9,-69],[-1,-19],[1,-15],[3,-10],[4,5],[4,9],[7,18],[7,23],[4,9],[5,5],[7,-4],[4,-7],[7,-17],[7,-11],[4,-7],[4,-13],[3,-16],[1,-21],[-1,-23],[-2,-23],[-4,-15],[-2,-10],[-9,-21],[-3,-11],[-1,-9],[5,-40],[-1,-16],[-2,-14],[-4,-16],[-5,-12],[-8,-10],[-10,-7],[-12,1],[-7,4],[-11,11],[-8,4],[-20,-8],[-10,3],[-7,7],[-10,23],[-3,11],[-5,20],[-3,3],[-5,-1],[-6,-9],[-8,-9],[-18,-25],[-7,-15],[-15,-44],[-9,-11],[-12,-7],[-39,-5],[-10,2],[-12,11],[-9,5],[-11,1],[-34,-9],[-12,-6],[-35,-43],[-38,-20],[-44,-6],[-9,-1]],[[7057,1694],[0,1],[-3,9],[-6,9],[-5,15],[-1,13],[0,28],[-1,13],[-5,30],[-12,48],[-3,30],[1,12],[3,10],[2,12],[-1,15],[-4,28],[0,11],[0,15],[1,13],[4,29],[1,15],[-1,17],[-4,28],[0,17],[-1,14],[-5,6],[-6,5],[-4,10],[0,12],[4,40],[2,29],[0,15],[-2,13],[-4,11],[-9,10],[-4,8],[-1,32],[3,31],[1,26],[-8,16],[-22,15],[-10,13],[-4,5],[-2,11],[0,11],[2,16],[8,12],[3,17],[3,21],[6,21],[-6,-42],[-2,-10],[3,-31],[8,14],[3,47],[6,22],[16,-41],[8,9],[44,22],[7,-2],[5,-3],[4,0],[6,5],[14,40],[2,6],[23,118],[6,21],[13,-6],[3,-36],[-4,-72],[6,10],[4,14],[4,17],[4,16],[6,11],[19,30],[9,26],[5,31],[4,34],[2,58],[10,54],[13,51]],[[7218,2945],[5,-2],[45,-6],[6,-3],[24,-18]],[[7691,2060],[-12,-37],[-5,-6],[-8,-18],[-3,-10],[1,-22],[-1,-9],[-3,-9],[-2,-5],[-3,-3],[-7,-1],[-3,0],[-3,0],[-3,-4],[-2,-8],[-1,-10],[1,-14],[2,-12],[6,-27],[8,-48],[6,-23],[11,-34],[7,-31],[2,-14],[1,-25],[0,-14],[-2,-17],[-6,-32],[-4,-33],[-1,-48],[1,-34],[3,-45],[-1,-22],[-9,-84],[-2,-32],[0,-22],[2,-11],[1,-8],[2,-4],[2,-5],[2,-3],[6,-6],[3,-5],[3,-7],[2,-8],[6,-20],[2,-12],[0,-12],[1,-25],[-1,-20],[1,-39],[-4,-85],[1,-17],[0,-37],[-1,-31],[-3,-48],[-2,-12],[-3,-11],[-7,-16],[-9,-31],[-5,-22],[-3,-9],[-5,-6],[-6,-2],[-5,-4],[-3,-8],[-3,-13],[-4,-9],[-5,1],[-5,11],[-6,11],[-6,6],[-7,2],[-7,7],[-6,4],[-5,-2],[-4,-8],[-4,-18],[-3,-11],[-9,-18],[-4,-44],[1,-17],[2,-26],[0,-17],[-3,-20],[-4,-18],[-19,-66],[-7,-21],[-20,-80],[-26,-70],[-5,-6]],[[7477,361],[0,2],[-16,73],[-7,89],[-17,64],[0,32],[14,62],[2,22],[-4,14],[-12,17],[-14,0],[-4,5],[-8,16],[-5,5],[-30,75],[-17,21],[-21,-8],[-21,-30],[-40,-31],[-22,8],[-15,39],[-12,47],[-15,35],[-16,10],[-15,0],[-16,5],[-16,22],[-12,21],[-19,53],[-11,23],[-10,9],[-12,6],[-10,8],[-4,16],[-2,-2],[-24,-8],[-6,-5],[-6,-8],[-5,-10],[-5,-21],[-7,-52],[-4,-24],[-9,-25],[-46,-89],[-25,-32],[-5,-14],[-5,-1],[-11,0],[-10,9],[-26,38],[-8,18],[-6,31],[3,26],[78,262],[7,34],[-27,-9],[-26,-19],[-21,5],[-13,67],[0,14],[3,28],[-1,14],[-3,19],[-10,34],[-3,19],[2,27],[0,2],[5,37],[7,37],[6,24],[9,16],[11,8],[12,2],[12,-2],[12,-10],[26,-34],[11,-5],[12,15],[10,31],[9,35],[8,26],[47,54],[9,27],[0,14]],[[8123,2220],[-1,-7],[-11,-60],[-4,-31],[-1,-29],[0,-54],[3,-30],[-1,-15],[-4,-8],[-8,-4],[-3,-2],[0,-8],[0,-19],[8,-96],[-4,-29],[-14,-36],[-5,-7],[-7,-9],[-4,-7],[-6,-29],[-4,-28],[-6,-111],[0,-11],[-3,-6],[-8,-11],[-8,-6],[-7,-2],[-7,-4],[-6,-16],[-3,-24],[1,-90],[-6,-66],[-37,-191],[-5,-65],[-5,-29],[-11,-23],[-5,-32],[0,-56],[5,-56],[7,-28],[15,-22],[-2,-24],[-9,-28],[-9,-35],[-1,-28],[0,-30],[-1,-28],[-5,-25],[-16,-27],[-7,-10],[-54,-55],[-25,-35],[-27,-63],[-11,-39],[-7,-41],[0,-41],[14,-67],[3,-36],[-6,-30],[-14,-7],[-16,-1],[-12,-7],[-6,-25],[-7,-73],[-4,-31],[-15,-41],[-18,-36],[-11,27],[-6,12],[-7,8],[-6,2],[-9,-6],[-6,-1],[-11,6],[-20,17],[-10,5],[-15,-2],[-28,-2],[-13,9],[-8,25],[-7,32],[-8,28],[-5,9],[-12,11],[-5,10],[-3,12],[-4,30],[-3,13],[-10,19],[-13,17],[-10,20],[-4,32],[-2,28]],[[7788,2529],[49,-88],[4,-11],[2,-11],[0,-9],[-1,-10],[-3,-7],[-7,-16],[-3,-8],[-2,-10],[-1,-9],[1,-11],[2,-20],[1,-27],[1,-14],[1,-10],[3,-9],[3,-10],[5,-10],[2,-9],[2,-9],[0,-11],[4,-9],[6,-8],[17,-6],[25,-17],[20,-7],[6,-5],[11,-12],[3,-1],[4,7],[3,8],[6,29],[2,6],[3,6],[6,4],[7,2],[23,-6],[12,0],[44,20],[74,-1]],[[1400,5499],[16,-13],[12,-32],[1,-32],[-18,-15],[-20,6],[-48,55],[12,31],[10,-5],[28,1],[7,4]],[[917,5684],[6,-22],[12,8],[16,-8],[14,-17],[7,-18],[1,-4],[3,-5],[3,-7],[1,-10],[0,-10],[-2,-6],[-1,-4],[-1,-5],[-2,-6],[-7,-5],[-3,-4],[-1,-6],[1,-19],[0,-6],[-4,-10],[-19,-30],[-4,-2],[-22,8],[-8,16],[-8,20],[-13,18],[6,16],[5,19],[4,22],[4,45],[5,23],[7,9]],[[1611,6479],[7,-12],[8,1],[8,7],[7,10],[1,-56],[-11,-61],[-17,-54],[-17,-35],[-22,-16],[-3,-9],[-1,-14],[-7,-44],[-12,-45],[-8,-22],[-9,-15],[-9,-7],[-9,-3],[-21,1],[-6,-5],[-12,-22],[-8,-5],[-6,5],[-13,20],[-6,7],[-21,8],[-5,6],[-1,14],[4,16],[7,22],[5,12],[24,29],[8,16],[6,51],[6,1],[25,16],[7,17],[9,48],[5,17],[16,37],[3,13],[5,9],[21,20],[7,16],[9,1],[18,12],[8,-7]],[[1055,6747],[-1,-18],[1,-14],[5,-6],[6,-1],[11,-7],[7,-1],[7,-15],[-2,-36],[-7,-62],[0,-18],[3,-22],[1,-17],[-1,-4],[-5,-33],[0,-8],[-10,-10],[-7,-23],[-7,-28],[-7,-22],[-5,-9],[-3,-3],[-29,2],[-3,-5],[-4,-30],[-7,-15],[-11,-4],[-11,2],[-20,18],[-13,6],[-4,7],[-3,8],[-3,3],[-5,10],[-12,47],[-5,15],[-9,-3],[-11,7],[-11,12],[-6,15],[-1,19],[1,73],[3,39],[7,36],[9,32],[9,25],[6,10],[16,17],[7,5],[6,-1],[14,-8],[4,-1],[6,4],[7,11],[4,4],[56,16],[13,17],[3,-4],[4,-5],[3,-6],[3,-7],[1,-14]],[[331,7120],[21,-53],[5,-8],[8,-14],[1,-32],[-2,-56],[0,-129],[-6,-9],[-41,-41],[-11,-6],[-6,0],[-5,4],[-13,22],[-11,7],[-18,18],[-3,1],[-6,-2],[-3,1],[-3,5],[0,5],[1,5],[-2,6],[-10,27],[-8,31],[-5,33],[-4,69],[-7,56],[1,19],[53,-3],[22,28],[27,16],[14,13],[4,-2],[7,-11]],[[735,7285],[12,-21],[41,-35],[14,-6],[20,-18],[31,-88],[17,-27],[-3,-2],[-2,-2],[-3,-7],[8,-11],[-4,-27],[-13,-49],[-4,-31],[-11,-9],[-13,5],[-26,19],[-42,0],[-11,9],[-11,17],[-11,9],[-13,-14],[-8,26],[-4,38],[-6,32],[-15,7],[25,88],[1,20],[-3,26],[5,26],[10,19],[11,6],[4,-8],[2,1],[2,7]],[[400,7736],[10,-21],[4,-35],[3,-32],[2,-14],[8,-14],[7,-64],[5,-15],[4,-6],[8,-28],[4,-7],[13,-1],[6,-3],[4,-6],[4,-26],[1,-37],[-1,-70],[11,-167],[6,-26],[25,-57],[2,-6],[1,-9],[0,-18],[2,-17],[4,-7],[4,-2],[2,-5],[61,-96],[4,-16],[1,-14],[4,-12],[8,-21],[2,-4],[10,-6],[0,-9],[-1,-9],[-2,-8],[-1,-4],[5,-57],[3,-62],[-4,-28],[-16,-35],[-4,-23],[13,22],[4,-13],[0,-28],[3,-23],[25,-12],[12,-16],[-1,-34],[9,-2],[7,-9],[5,-13],[4,-17],[-4,-21],[8,-8],[21,-53],[6,-8],[3,0],[2,-5],[1,-22],[-3,-9],[-15,-15],[-5,-7],[-18,-147],[2,-37],[-1,-27],[-13,10],[-7,-25],[-15,-43],[-7,-24],[-10,11],[-10,3],[-19,-4],[-11,-8],[-19,-35],[-69,-57],[-13,8],[-9,-7],[-53,19],[-67,-2],[-13,10],[-9,21],[-3,16],[-1,16],[0,35],[-2,17],[-5,4],[-7,0],[-7,5],[-15,59],[6,68],[16,64],[18,44],[70,114],[3,12],[0,10],[2,7],[9,2],[15,16],[21,14],[7,0],[6,-5],[4,-6],[3,-6],[3,-4],[10,-9],[7,-1],[6,5],[3,9],[5,23],[4,4],[0,16],[5,31],[9,23],[8,-8],[8,24],[0,23],[-4,19],[-8,16],[-8,10],[-18,13],[-7,8],[-14,32],[-14,48],[-11,54],[-6,50],[1,43],[-2,16],[-7,14],[-5,3],[-7,2],[-4,5],[-2,6],[-6,24],[-36,49],[-14,38],[1,47],[-12,18],[-8,33],[2,31],[14,10],[-11,39],[-4,22],[-2,26],[0,52],[0,13],[-3,24],[0,14],[-6,50],[-13,25],[-18,1],[-21,-19],[-20,-36],[-11,-5],[-12,15],[-12,41],[-2,10],[2,13],[3,7],[4,4],[41,57],[11,29],[4,60],[15,-12],[12,8],[11,15],[20,14],[4,12],[3,14],[5,10],[7,6],[11,-1],[6,5]],[[928,7907],[-13,-7],[-7,6],[-8,20],[-8,5],[-5,5],[-6,12],[-5,14],[-2,10],[1,34],[10,25],[13,16],[13,6],[13,-10],[14,-18],[12,-23],[5,-30],[-4,-22],[-10,-24],[-13,-19]],[[755,8383],[-10,-48],[-26,27],[4,32],[-4,64],[4,27],[24,-34],[8,-68]],[[118,9562],[-3,-7],[-2,5],[-2,9],[0,8],[4,6],[2,-3],[3,-11],[-2,-7]],[[116,9595],[-2,-5],[-1,5],[3,0]],[[7,9979],[-4,-2],[-3,13],[3,9],[4,-7],[0,-13]],[[7831,5741],[-13,-59],[-1,-20],[-1,-57],[-3,-25],[-8,-43],[-4,-27],[-6,-76],[2,-21],[14,-52],[7,-20],[5,-21]],[[7823,5320],[-1,-31],[1,-14],[4,-19],[9,-38],[3,-20],[0,-24],[-2,-35],[-1,-35],[1,-50],[-2,-40],[-6,-39],[-12,-46],[-21,-47],[-9,-6],[-21,-7],[-7,-9],[-6,-11],[-3,-12],[-2,-14],[1,-27],[-3,-67],[2,-48],[4,-32],[0,-16],[-16,-193],[1,-19],[2,-13],[3,-14],[1,-16],[-1,-15],[-3,-18],[-12,-43],[-21,-54],[-32,-43]],[[7674,4205],[2,62],[-3,12],[-5,12],[-5,1],[-6,-9],[-4,-9],[-4,-6],[-7,-1],[-7,1],[-24,11]],[[7611,4279],[9,46],[5,51],[4,25],[0,12],[-4,21],[-20,83],[-19,62],[-1,14],[3,12],[7,12],[2,9],[11,99],[5,30],[2,21],[-3,17],[-4,15],[-5,20],[-2,20],[-1,15],[3,30],[-1,13],[-18,66],[-6,33],[-5,15],[-4,5],[-4,-1],[-3,3],[-2,8],[-3,4],[-5,3],[-3,3],[-2,7],[1,10],[3,5],[5,8],[5,10],[16,47],[4,2],[3,-3],[3,-5],[3,0],[3,5],[3,12],[3,14],[3,21],[0,20],[-3,19],[-5,13],[-19,31],[-8,20],[-5,26],[-3,32],[1,116],[1,15],[3,10],[3,2],[3,-1],[3,4],[3,7],[2,8],[-1,7],[-17,31],[-5,28],[-5,6],[-3,0],[-4,-8],[-7,-28],[-5,-10],[-5,-6],[-4,3],[-2,9],[2,18],[9,26],[14,58],[11,37],[28,34]],[[7584,5705],[28,4],[43,55],[14,10],[17,6],[9,0],[8,-4],[3,-8],[3,-10],[4,-11],[18,-29],[12,-13],[14,-10],[13,1],[11,8],[16,35],[10,12],[7,3],[17,-13]],[[8002,4044],[1,-17],[8,-12],[37,-41],[9,-17],[4,-17],[-2,-14],[-1,-16],[1,-85],[-2,-28],[-1,-14],[0,-17],[-1,-13],[-2,-11],[-14,-55],[-6,-19],[-3,-4],[-2,-3],[-2,0],[-2,0],[-4,6]],[[7491,3766],[-17,-13],[-14,-18],[-9,3],[-5,10],[-1,21],[33,77],[20,33],[1,8],[-2,10],[-2,13],[0,11],[3,13],[0,36],[5,19],[7,17],[16,31],[8,11],[7,8],[70,32],[12,9],[14,14],[14,19],[8,16],[6,17],[3,11],[6,31]],[[7674,4205],[2,-39],[2,-9],[4,-14],[3,-6],[4,-4],[3,-5],[3,-6],[3,-23],[3,-11],[3,-7],[6,-9],[6,-12],[19,-66],[8,-21],[9,-16],[13,-13],[12,-20],[7,-9],[14,-4],[17,4],[18,11],[21,27],[10,21],[14,35],[15,13],[22,14],[75,21],[12,-13]],[[8111,6481],[-5,-39],[0,-15],[6,-54],[4,-52],[0,-34],[-2,-28],[-7,-31],[-6,-24],[-3,-20],[-1,-15],[0,-21],[-1,-14],[-3,-10],[-4,-7],[-3,-6],[-2,-10],[2,-10],[5,-8],[14,-6],[9,-14]],[[8114,6063],[-17,-37],[-2,-13],[-4,-14],[-2,-15],[-1,-16],[0,-26],[-7,-31],[-5,-15],[-8,-8],[-14,-3],[-7,6],[-5,9],[-4,9],[-4,6],[-4,4],[-6,2],[-6,-4],[-6,-13],[-1,-10],[0,-20],[-2,-11],[-4,-9],[-6,-5],[-16,-3],[-6,-5],[-14,-28],[-10,-12],[-9,-6],[-15,1],[-28,15],[-11,0],[-11,-6],[-15,-12],[-16,-35],[-17,-17]],[[7584,5705],[-4,48],[-15,51],[-6,23],[0,35],[2,38],[9,105],[-2,26],[1,27],[2,27],[7,52],[6,22],[6,15],[7,14],[6,15],[16,75],[5,13],[6,11],[5,7],[5,9],[4,12],[9,39],[40,243],[7,67]],[[7700,6679],[9,-35],[2,-5],[4,-5],[4,-4],[4,0],[6,6],[4,11],[2,12],[2,22],[3,7],[4,6],[7,6],[4,5],[2,5],[0,8],[-1,11],[-2,13],[-3,11],[-5,9],[-10,12],[-3,6],[-1,7],[0,7],[3,8],[5,25],[7,43],[3,9],[2,7],[3,4],[10,11],[3,6],[2,7],[1,10],[1,12],[2,11],[2,10],[3,7],[3,3],[7,3],[2,5],[2,6],[2,5],[3,3]],[[7798,6989],[5,-11],[2,-8],[0,-19],[2,-9],[22,-73],[9,-42],[7,-27],[2,-13],[4,-37],[2,-16],[8,-18],[38,-67],[10,-35],[6,-32],[1,-24],[2,-16],[4,-13],[4,-5],[5,4],[16,28],[5,7],[5,2],[4,5],[4,6],[7,12],[7,9],[6,2],[4,-10],[3,-10],[4,-4],[7,5],[15,22],[6,3],[9,-1],[15,-6],[7,3],[17,-17],[39,-103]],[[7087,3016],[-9,-35],[-22,6],[-12,-18],[-10,-7],[-14,2],[-14,10],[-9,11],[-3,33],[3,53],[3,180],[2,20],[20,93],[8,61],[9,15],[36,27],[33,40],[12,11],[27,-2],[41,-64],[26,-16],[-1,-12],[-2,-10],[-2,-10],[-4,-9],[-6,-14],[-30,-33],[-2,-13],[-8,-20],[-2,-8],[-4,-23],[-5,-23],[-5,-13],[-1,0],[-6,-27],[-8,-36],[-7,-35],[-4,-24],[-10,-10],[-7,-22],[0,-35],[-9,-22],[-4,-21]],[[7255,3558],[-14,-23],[-12,2],[-3,34],[8,57],[13,82],[16,73],[7,-39],[14,-14],[7,-31],[-12,-48],[-21,-27],[-3,-66]],[[7218,2945],[7,29],[5,30],[-6,27],[2,33],[8,59],[2,26],[18,153],[13,57],[1,10],[6,32],[2,34],[13,88],[7,25],[18,46],[5,27],[0,36],[-3,67],[-8,52],[-2,9],[-13,-2],[-7,1],[-5,6],[-7,28],[-12,80],[-7,29],[-4,19],[-1,21],[1,87],[-4,70],[0,19],[3,33],[1,21],[-3,9],[-1,6],[-7,25],[-2,4],[-1,11],[-2,7],[-1,10],[0,19],[3,16],[4,13],[2,13],[-5,19],[9,24],[10,7],[7,11],[3,35],[4,17],[10,11],[10,17],[4,32],[-35,-50],[-4,-8],[-1,-13],[-1,-26],[-4,-5],[-19,-3],[-5,-13],[-1,-12],[-5,-36],[-5,-60],[-1,-43],[4,-44],[18,-79],[1,-46],[-9,-291],[-6,-61],[-4,-16],[-17,-46],[-5,-10],[-10,-7],[-21,-30],[-8,-4],[-6,7],[-4,20],[-5,4],[-12,-3],[-5,3],[-7,15],[-3,24],[8,24],[17,30],[6,31],[3,23],[6,13],[16,5],[3,-7],[4,-12],[5,-12],[6,-1],[6,9],[3,12],[-1,16],[-3,16],[-3,-31],[-8,6],[-14,34],[-13,-3],[-12,-16],[-9,-6],[-3,21],[2,33],[12,64],[2,35],[2,19],[6,7],[7,4],[6,6],[4,12],[12,48],[-5,-3],[-3,-5],[-6,-16],[-5,-5],[-12,2],[-6,-1],[-7,-12],[-5,-18],[-26,-167],[-40,-143],[-19,-50],[-19,-21],[-4,-20],[-5,-14],[-5,-8],[-6,0],[-3,6],[-2,9],[-3,10],[-9,10],[-6,-11],[-2,-25],[2,-30],[2,-4],[17,-42],[2,-12],[0,-17],[0,-33],[-6,-13],[-14,4],[-25,25],[-25,54],[-9,12],[-8,19],[-3,7],[-4,3],[-11,3],[-5,4],[-23,37],[-45,132]],[[6832,3717],[43,103],[36,66],[51,31],[29,42],[26,102],[10,152],[2,132],[-24,90],[-21,49],[-35,54],[-47,29],[-31,47],[-17,70],[-6,65]],[[6848,4749],[25,-2],[17,5],[5,5],[3,7],[1,11],[1,10],[1,11],[0,13],[1,16],[5,17],[5,15],[4,16],[4,18],[4,13],[7,14],[6,8],[9,8],[3,8],[6,26],[5,11],[5,5],[4,-6],[4,-9],[4,-6],[4,3],[3,10],[8,11],[24,-5],[8,7],[3,15],[-6,44],[-1,14],[0,12],[1,7],[-1,6],[-4,3],[-6,3],[-6,8],[-8,16],[-6,19],[-3,12],[0,10],[36,12],[21,35],[3,13],[-1,10],[-6,26],[-3,16],[-1,18],[0,18],[2,40],[3,16],[4,13],[3,4],[4,2],[9,15],[13,10],[4,7],[1,9],[-3,35],[2,30],[4,21],[6,13],[13,15],[24,47],[5,18],[12,82],[5,46],[5,30],[4,34],[4,22],[5,16],[4,5],[2,-3],[0,-11],[-1,-13],[1,-8],[3,-2],[9,1],[5,-2],[5,-4],[11,8],[9,12],[30,62],[7,20],[10,40],[8,22],[5,16],[3,14],[1,12],[1,10],[-1,11],[1,13],[3,8],[9,15],[3,13],[3,19],[2,17],[23,80],[6,14],[7,9],[10,8],[38,16]],[[7382,6233],[20,13],[21,6],[9,0],[8,-12],[3,-23],[-2,-48],[-10,-66],[0,-14],[2,-11],[1,-9],[-4,-12],[-4,-8],[-5,-9],[-4,-12],[-3,-16],[-2,-13],[-3,-51],[-4,-16],[-4,-10],[-5,-5],[-5,-2],[-6,-5],[-4,-8],[-2,-10],[-6,-18],[-6,-22],[-4,-8],[-9,-3],[-4,-4],[-2,-10],[-2,-18],[-1,-11],[-2,-9],[-4,-5],[-4,-3],[-2,0],[-3,-5],[0,-7],[-2,-17],[-2,-7],[-3,-3],[-6,-4],[-3,-2],[-2,-5],[-2,-6],[-1,-10],[0,-29],[-1,-16],[-2,-14],[-34,-158],[-4,-17],[-11,-29],[-7,-27],[-3,-15],[-10,-67],[-1,-17],[-3,-95],[0,-16],[9,-66],[-1,-10],[-4,-26],[0,-18],[1,-22],[1,-14],[3,-10],[49,-64],[8,-20],[7,-30],[4,-33],[6,-24],[15,-50],[4,-19],[8,-50],[13,-62],[4,-34],[5,-13],[13,-7],[20,9],[31,28],[11,2],[12,-3],[12,-15],[27,-47],[13,-15],[8,-12],[17,-35],[7,-19],[45,-187],[30,-70]],[[7382,6233],[12,61],[8,103],[5,26],[6,17],[5,9],[6,3],[6,10],[2,9],[7,53],[14,67],[5,31],[8,70]],[[7466,6692],[17,-2],[13,-5],[33,4],[13,-6],[6,-7],[-3,-9],[-3,-11],[-3,-14],[1,-21],[3,-25],[2,-22],[-3,-17],[-4,-20],[-1,-13],[1,-15],[2,-12],[2,-13],[6,-10],[8,-7],[7,-3],[8,0],[8,6],[6,11],[6,18],[8,19],[8,14],[16,20],[6,11],[44,111],[10,13],[6,2],[11,-10]],[[7397,7486],[-5,-14],[-1,-10],[-1,-17],[2,-30],[3,-16],[5,-11],[4,-3],[4,-4],[5,-12],[7,-12],[5,-10],[15,-47],[16,-36],[4,-5],[21,-16],[3,-2],[10,2],[4,-1],[5,-4],[3,-14],[-1,-25],[4,-267],[-2,-22],[-4,-23],[-19,-73],[-1,-34],[-1,-12],[-7,-44],[-9,-32]],[[6848,4749],[-12,8],[-10,11],[-5,17],[-1,14],[0,14],[2,13],[2,13],[7,27],[1,9],[2,44],[-1,13],[-2,12],[-8,19],[-1,9],[0,10],[1,14],[-3,13],[-8,11],[-18,6],[-11,0],[-20,-18],[-12,-6],[-43,6],[-8,-7],[-4,-2],[-12,4],[-16,-9]],[[6668,4994],[-10,65],[-8,27],[-3,19],[-1,22],[2,17],[21,37],[-2,35],[0,43],[5,13],[7,16],[8,5],[9,0],[3,19],[0,21],[1,30],[3,25],[-3,35],[3,21],[10,13],[-1,36],[-17,62],[-36,107],[-29,128],[-12,76],[-8,44],[4,31],[7,18],[8,18],[8,21],[5,15],[4,14],[8,21],[7,21],[2,13],[6,7],[9,-7],[8,0],[9,13],[7,8],[9,-5],[7,7],[7,6],[-1,-13],[11,-13],[9,-1],[7,15],[5,5],[4,15],[7,5],[5,-22],[6,-3],[11,-3],[14,15],[13,29],[14,35],[8,93],[3,30],[7,97],[11,74],[14,68],[7,44],[3,8],[5,9],[9,4],[7,6],[2,-39],[8,-31],[16,-17],[16,-5],[32,-2],[0,18],[-17,11],[-18,10],[-12,0],[-9,16],[-6,42],[-8,36],[-8,8],[-5,16],[0,36],[-7,42],[-2,43],[-8,47],[-11,33],[-7,63],[6,21],[13,3],[19,39],[19,71],[6,26],[1,20],[5,33],[6,24],[12,12],[8,30],[8,33],[11,-25],[13,17],[14,27],[17,31],[35,97],[28,92],[10,31],[5,29],[1,19],[3,6],[4,3],[12,10],[9,57],[5,50],[4,79],[-1,36],[-5,63],[-1,114],[5,39],[0,13],[2,6],[6,-8],[3,-7],[2,-11],[3,-23],[5,0],[0,19],[3,12]],[[7156,8023],[15,-91],[8,-27],[4,-5],[4,-3],[5,-2],[3,0],[3,1],[2,2],[4,8],[2,5],[3,6],[2,6],[1,5],[2,13],[3,18],[2,16],[0,4],[1,3],[1,1],[2,2],[2,0],[20,-2],[10,1],[11,5],[8,8],[4,4],[6,12],[12,34],[3,6],[4,6],[7,7],[4,2],[4,0],[3,-3],[3,-4],[6,-12],[5,-12],[1,-4],[1,-4],[0,-3],[0,-3],[0,-3],[-1,-2],[-6,-16],[-2,-9],[-1,-5],[-1,-5],[0,-5],[0,-6],[0,-6],[1,-5],[2,-6],[2,-5],[28,-42],[2,-6],[1,-4],[1,-4],[0,-3],[-1,-4],[-1,-5],[-4,-9],[-4,-7],[-3,-8],[-3,-10],[-3,-11],[-11,-41],[-1,-3],[1,-6],[2,-7],[7,-14],[3,-5],[3,-1],[2,2],[1,2],[3,3],[1,2],[4,1],[1,-4],[1,-5],[1,-25],[1,-8],[1,-4],[2,-1],[1,1],[2,2],[5,9],[3,3],[3,-1],[2,-6],[4,-11],[12,-27],[4,-5],[4,-3],[4,0],[2,-2],[1,-2],[0,-3],[0,-2],[-16,-43],[-1,-6],[-1,-6],[-1,-11],[0,-7],[-1,-3],[0,-2],[-1,-2],[-1,-1],[-2,-2],[-2,-2],[-1,-3],[-1,-4],[-1,-4],[-1,-6],[0,-5],[0,-5],[2,-14],[0,-5],[0,-12],[2,-8],[10,-39]],[[8137,5220],[-6,-23],[-1,-12],[0,-21],[5,-42],[1,-15],[-1,-17],[-2,-13],[-5,-13],[-5,-11],[-14,-20],[-5,-12],[-5,-13],[-5,-16],[-4,-10],[-3,-9],[-4,-9],[-2,-13],[-2,-17],[0,-32],[1,-26],[2,-24],[3,-13],[3,-9],[3,-8],[3,-12],[1,-36],[5,-45],[-2,-20],[-24,-66],[-16,-64],[-2,-16],[0,-18],[2,-12],[4,-11],[5,-8],[4,-14],[3,-19],[-1,-36],[3,-19],[6,-28],[-2,-12],[-8,-14],[-9,-9],[-8,-19],[-6,-24],[-4,-42],[2,-58],[1,-8],[3,-8],[0,-9],[-4,-12],[-10,-19],[-6,-14],[-2,-20],[0,-16],[-3,-19],[-3,-14],[-21,-37]],[[7823,5320],[12,11],[19,31],[9,9],[8,2],[7,-6],[9,-10],[18,-33],[12,-17],[14,-15],[31,-17],[16,0],[15,5],[10,9],[11,4],[9,-4],[10,-5],[7,5],[6,17],[3,24],[6,16],[6,2],[8,-9],[14,-23],[8,-9],[11,-8],[7,-7],[6,-10],[8,-7],[4,-5],[3,-7],[2,-27],[5,-16]],[[9140,3665],[-9,-14],[-55,-48],[-75,-66],[-75,-66],[-75,-65],[-75,-66],[-75,-66],[-75,-66],[-74,-66],[-75,-66],[-17,-14],[-23,-20],[-11,-15],[-44,-96],[-60,-203],[-29,-60],[-8,-23],[-19,-89],[-7,-26],[-22,-41],[-7,-21],[0,-33],[7,-27],[9,-17],[8,-21],[1,-42],[-5,-30],[-10,-10],[-10,-6],[-10,-19],[-8,-10],[-5,27],[-9,97],[-4,22],[-7,15],[-26,18],[-13,5],[-10,-8],[-6,-28],[0,-10],[4,-29],[0,-17],[-5,-64],[-8,-61]],[[8137,5220],[10,34],[6,12],[12,16],[8,4],[20,-7],[15,1],[9,6],[10,12],[5,11],[12,30]],[[8244,5339],[26,-14],[14,-29],[9,-23],[7,-23],[6,-22],[18,-118],[5,-50],[6,-34],[7,-18],[9,4],[27,14],[11,-2],[9,-16],[7,-33],[8,-99],[11,-43],[2,-14],[0,-33],[2,-21],[9,-37],[3,-21],[2,-44],[2,-22],[5,-18],[10,-14],[24,-14],[11,-11],[8,-18],[3,-24],[3,-24],[4,-24],[8,-17],[9,-9],[21,-14],[164,-175],[137,-222],[10,-7],[9,-9],[7,-23],[11,-48],[21,-64],[5,-21],[4,-8],[4,-11],[2,-14],[1,-5],[8,-51],[14,-43],[20,-34],[25,-18],[27,2],[17,16],[7,-2],[10,-19],[8,-11],[20,-10],[25,-31],[13,10],[12,14],[8,-5],[1,0]],[[9976,6543],[-8,-9],[-6,-11],[-3,-17],[1,-15],[2,-28],[1,-15],[-2,-15],[-3,-27],[-1,-19],[27,-226],[0,-13],[-1,-26],[1,-14],[5,-17],[6,-13],[4,-14],[0,-11],[-5,0],[-28,0],[-26,-8],[-13,1],[-6,12],[-4,15],[-8,23],[-17,39],[-3,-13],[-8,-74],[-18,-176],[-18,-177],[-18,-177],[-17,-176],[-9,-87],[-8,-52],[-5,-13]],[[9788,5190],[-6,29],[-3,33],[-3,13],[-5,6],[-4,1],[-7,5],[-4,9],[-3,5],[-4,0],[-3,10],[-18,16],[-6,3],[-2,6],[-2,6],[-1,7],[-1,2],[-3,-4],[-2,-7],[-4,-4],[-2,4],[-2,12],[-6,20],[-5,23],[-1,3],[-2,13],[-3,5],[-7,0],[-9,6],[-8,1],[-3,4],[-2,7],[-3,5],[-5,6],[-4,1],[-3,0],[-4,-3],[-1,2],[0,5],[-1,9],[-5,24],[-4,5],[-14,10],[-3,7],[0,7],[1,8],[0,6],[-2,1],[-3,-1],[-4,-1],[-1,-3],[-1,-6],[1,-8],[0,-6],[-3,-4],[-3,-2],[-6,3],[-11,0],[-10,3],[-8,11],[-3,11],[-3,4],[-8,-1],[-3,7],[-3,9],[-4,11],[-7,5],[-7,3],[-7,9],[-4,3],[-2,-1],[-1,-4],[-3,-2],[-1,5],[0,7],[0,9],[-1,8],[-2,9],[-2,1],[-2,-2],[-1,-6],[-4,-3],[-6,2],[-10,12],[-7,0],[-2,-2],[-1,-4],[-2,-3],[-1,3],[0,5],[-1,2],[-2,-1],[-2,-5],[-6,-14],[-2,-5],[-2,-5],[-2,-1],[-4,1],[-2,1],[-4,-1],[-2,3],[-3,6],[-3,0],[-11,-3],[-5,6],[-3,1],[-3,-2],[-3,-5],[-3,-4],[-3,2],[-1,5],[-2,6],[-1,1],[-2,-6],[-2,-7],[-3,-5],[-2,2],[-3,-1],[-1,-1],[-1,-4],[-4,-6],[-2,-5],[-1,-6],[-3,-5],[-1,1],[0,12],[-2,4],[-5,4],[-9,3],[-15,10],[-9,3],[-3,5],[1,6],[1,5],[-1,5],[-2,9],[-1,6],[-3,1],[-3,-1],[-5,1],[-4,5],[-4,8],[-3,0],[-4,-2],[-4,-5],[-7,-4],[-6,4],[-6,-3],[-2,4],[-1,5],[1,7],[-1,5],[-1,-2],[-3,-5],[-5,-1],[-3,5],[-3,11],[-1,9],[-1,9],[-1,7],[-3,7],[-5,11],[-3,8],[-3,11],[-5,17],[-3,22],[-2,32],[1,59],[2,20],[0,22],[-2,18],[-8,22],[-8,9],[-10,8],[-11,3],[-9,-3],[-14,-11],[-12,-5],[-3,-4],[-4,-17],[-3,-6],[-6,-4],[-5,-1],[-12,-9],[-12,-5],[-15,-1],[-4,-3],[-9,-11],[-5,-2],[-8,4],[-7,10],[-6,3],[-3,-3],[-11,-26],[-4,-13],[-2,-16],[-1,-18],[-2,-15],[-4,-13],[-10,0],[-58,59],[-48,27],[-7,9],[-4,16],[-3,43],[-2,12],[-1,10],[1,10],[12,34]],[[8912,5993],[5,33],[-5,17],[-3,8],[-3,12],[2,9],[10,24],[4,14],[-1,10],[-3,7],[-8,6],[-25,10],[-10,9],[-27,46],[-5,7],[-5,4],[-6,8],[-4,13],[-2,24],[1,24],[4,25],[7,24],[28,68],[6,17],[3,18],[-2,9],[-4,7],[-9,0],[-7,-13],[-8,-10],[-27,-62],[-15,-72],[-7,-25],[-5,-7],[-22,-19],[-94,-113],[-6,-13],[-12,-7],[-2,-4],[-9,-11],[-12,-6],[-15,-3],[-13,6],[-8,11],[0,13],[6,14],[5,15],[5,22],[14,84],[2,23],[-5,46],[0,22],[4,27],[4,25],[4,19],[9,28],[1,15],[0,20],[-4,37],[-4,16],[-5,11],[-8,12],[-3,10],[-6,32],[-17,53],[-6,14],[-6,7],[-7,5],[-7,10],[-1,12],[0,12],[4,12],[6,12],[18,28],[4,10],[3,11],[-1,18],[0,13],[2,12],[5,2],[9,-8],[25,-39],[13,-15],[15,-13],[11,-4],[8,3],[7,7],[6,11],[14,59],[6,37],[3,11],[2,5],[4,0],[7,-6],[3,3],[2,9],[-1,24],[1,12],[1,10],[18,20],[7,9],[5,11],[2,14],[0,23],[1,10],[3,8],[4,9],[1,13],[0,21],[-5,28],[1,7],[1,7],[1,9],[0,12],[-1,10],[-7,27],[-8,25],[-4,14],[-4,18],[0,14],[2,22],[2,41],[1,15],[-5,105]],[[8765,7418],[9,17],[8,-5],[9,-9],[17,-20],[17,-31],[7,-3],[7,3],[6,7],[10,5],[11,-5],[33,-24],[15,-1],[13,5],[8,12],[7,12],[9,11],[9,9],[15,7],[9,-6],[8,-14],[4,-12],[6,-25],[61,-183],[18,-40],[3,-9],[0,-4],[1,-14],[1,-9],[11,-41],[5,-15],[6,-22],[2,-9],[3,-11],[7,-15],[34,-59],[5,-16],[2,-12],[7,-22],[14,19],[14,10],[12,-43],[31,-59],[12,-14],[23,1],[10,-5],[4,-23],[6,-14],[14,16],[24,44],[6,6],[19,15],[12,15],[6,4],[46,12],[56,-10],[3,-7],[4,-17],[3,-19],[2,-36],[3,-10],[12,-14],[24,-44],[14,-20],[13,-8],[14,-2],[7,-2],[3,4],[1,6],[-1,7],[-3,10],[-2,18],[-6,123],[0,24],[2,16],[7,9],[10,6],[19,-1],[11,-7],[8,-11],[7,-13],[7,-4],[5,1],[6,6],[5,2],[15,0],[6,3],[6,5],[7,4],[4,-3],[6,-8],[3,-10],[5,-21],[4,-11],[7,-9],[7,1],[8,5],[6,6],[6,2],[5,-7],[7,-10],[13,-15],[7,-10],[4,-8],[1,-9],[2,-9],[2,0],[6,7],[2,-3],[2,-8],[0,-16],[2,-10],[3,-10],[3,-9],[7,-14],[19,-15],[6,0],[4,2],[27,-2],[6,-6],[7,-10],[5,-3],[9,-1],[3,-5],[3,-12],[1,-15],[2,-13],[3,-9],[5,-3],[6,-3],[9,-11],[21,-15],[7,1],[4,2],[4,4],[2,-4],[1,-4],[-2,-18],[2,-9],[1,-3],[9,1],[1,0]],[[7745,7907],[10,-58],[6,-10],[9,-10],[10,-6],[9,1],[7,4],[13,4],[23,18],[52,15],[14,-4],[61,-32],[12,-1],[8,4],[6,5],[32,9],[12,9],[9,-1],[31,15],[32,5],[16,-5],[10,-9],[3,-13],[2,-15],[1,-18],[0,-14],[-4,-26],[-1,-11],[2,-7],[3,2],[11,26],[6,7],[6,-3],[7,-11],[13,-28],[9,-17],[10,-13],[17,-13],[15,2],[16,9],[26,31],[11,16],[13,28],[8,10],[10,-1],[69,-53]],[[8380,7748],[-15,-63],[0,-2],[0,-2],[0,-2],[1,-3],[2,-2],[7,-5],[7,-7],[1,0],[1,0],[3,2],[1,-1],[15,-20],[9,-8],[2,-1],[3,-1],[3,-3],[8,-13],[3,-7],[2,-8],[2,-13],[1,-17],[0,-3],[1,-3],[2,-6],[8,-6]],[[8447,7554],[-8,-33],[-7,-13],[-42,-55],[-22,-19],[-4,-9],[-2,-14],[-1,-39],[-2,-17],[-3,-7],[-4,-4],[-3,-8],[-6,-28],[-4,-6],[-5,0],[-13,8],[-5,0],[-3,-3],[-2,-11],[-1,-16],[-7,-29],[-5,-13],[-8,-8],[-4,0],[-4,3],[-6,15],[-4,4],[-5,0],[-14,-10],[-5,-3],[-6,-4],[-4,-10],[-2,-12],[1,-16],[-1,-135],[-4,-35],[-8,-35],[-17,-57],[-6,-28],[-3,-22],[9,-41],[-1,-16],[-3,-19],[-8,-31],[-3,-17],[-1,-15],[1,-16],[-1,-20],[-6,-30],[-7,-23],[-10,-28],[-6,-19],[-4,-20],[-2,-41],[-2,-21],[-3,-11],[-5,-8],[-16,-7],[-7,-5],[-12,-16]],[[7798,6989],[18,71],[76,19],[11,105],[-30,85],[-57,76],[-19,48],[-105,-10],[-4,124],[-121,9],[-32,60]],[[7535,7576],[12,74],[7,34],[7,45],[8,27],[2,10],[-1,8],[-1,10],[-5,11],[-5,12],[-15,27],[-2,9],[0,10],[3,12],[5,9],[12,13],[9,14],[12,26],[5,8],[8,8],[6,8],[17,28],[7,4],[9,1],[14,-3],[16,1],[63,-34],[4,-7],[4,-5],[9,-29]],[[9788,5190],[-9,-29],[-33,-76],[-24,-71],[-29,-87],[-30,-87],[-30,-87],[-30,-87],[-29,-87],[-30,-87],[-30,-87],[-30,-88],[-35,-68],[-36,-68],[-35,-69],[-36,-68],[-35,-69],[-36,-68],[-36,-68],[-35,-69],[-34,-65],[-26,-40]],[[8244,5339],[15,34],[16,76],[3,24],[1,22],[-1,164]],[[8278,5659],[30,-5],[17,2],[42,17],[15,0],[9,-3],[6,-7],[5,-8],[6,-2],[4,9],[3,20],[2,6],[4,1],[5,-5],[6,-8],[7,-4],[9,4],[14,19],[23,39],[7,8],[12,11],[7,4],[12,18],[6,6],[8,3],[8,5],[7,2],[9,-5],[6,-2],[6,1],[7,9],[8,4],[29,7],[53,61],[8,11],[6,6],[20,0],[17,6],[56,45],[14,19],[6,12],[7,7],[9,3],[99,18]],[[8114,6063],[13,-52],[15,-44],[5,-26],[3,-22],[-1,-71],[-1,-21],[-1,-15],[-5,-27],[-2,-16],[2,-7],[3,0],[21,32],[7,4],[8,1],[13,-8],[5,-1],[10,6],[6,3],[3,-6],[2,-8],[1,-14],[3,-4],[6,3],[4,0],[2,-7],[6,-31],[10,-7],[20,-7],[4,-10],[2,-13],[0,-36]],[[8447,7554],[26,-16],[6,-8],[0,-3],[0,-4],[0,-3],[-1,-3],[0,-3],[-1,-2],[-1,-1],[0,-4],[-1,-6],[0,-15],[4,-50],[4,-29],[8,-13],[11,-5],[59,-4],[17,-10],[8,-8],[6,-11],[4,2],[6,12],[13,33],[7,11],[10,3],[5,5],[4,7],[2,8],[2,6],[3,4],[3,3],[8,14],[7,7],[4,-4],[2,-11],[2,-16],[2,-11],[2,-7],[0,-6],[0,-8],[-2,-8],[-1,-7],[0,-8],[2,-13],[1,-7],[-1,-8],[-1,-9],[-1,-10],[0,-10],[2,-9],[5,-5],[28,-17],[10,-2],[7,0],[4,6],[3,8],[4,12],[6,33],[5,19],[16,45]],[[7811,9410],[-7,-39],[-15,18],[-5,-17],[-7,-14],[-12,23],[-9,25],[-2,27],[9,33],[47,98],[0,-14],[1,-10],[3,-18],[0,-50],[-3,-62]],[[8062,9284],[-10,-23],[-1,-11],[0,-21],[2,-27],[0,-47],[-4,-34],[-14,-56],[-4,-29],[-2,-86],[1,-27],[5,-26],[3,-6],[7,-17],[6,1],[9,-14],[11,-28],[10,-17],[3,-4]],[[8084,8812],[-1,-56],[1,-28],[-2,-22],[-3,-18],[-5,-11],[-4,-7],[-5,-3],[-11,-2],[-6,-3],[-6,-8],[-1,-10],[2,-13],[18,-82],[2,-15],[5,-45],[2,-16],[4,-14],[16,-50],[4,-25],[1,-21],[-2,-20],[-3,-11],[-4,-9],[-6,-5],[-8,-4],[-7,0],[-9,5],[-5,-1],[-6,-7],[-19,-33],[-5,-13],[-8,-30],[-20,-54],[-19,-66],[-11,-26],[-10,-20],[-3,-4],[-5,-2],[-4,4],[-5,9],[-8,20],[-4,8],[-6,5],[-5,2],[-6,1],[-12,7],[-7,6],[-21,6],[-18,14],[-7,-1],[-7,-5],[-11,-17],[-7,-16],[-7,-21],[-4,-12],[-2,-9],[0,-8],[0,-9],[0,-4],[-7,-9],[-13,-34],[-19,-77],[-3,-11],[-3,-5],[-4,-2],[-10,2]],[[7535,7576],[-4,-16],[-8,-20],[-8,-9],[-16,-10],[-5,-7],[-11,-9],[-1,-7],[1,-10],[7,-21],[2,-4],[1,-1],[2,2],[2,0],[2,-3],[2,-5],[-1,-9],[-3,-5],[-2,-5],[-2,-6],[-1,1],[-6,11],[-5,7],[-6,7],[-17,11],[-37,11],[-12,9],[-12,-2]],[[7156,8023],[4,17],[1,13],[-1,19],[-4,14],[-8,20],[-14,58],[-4,29],[-2,31],[2,33],[4,17],[5,14],[5,24],[2,31],[-4,31],[-4,26],[-4,43],[-5,17],[-9,12],[-10,4],[-8,7],[-5,18],[-4,23],[-2,23],[0,65],[7,63],[13,54],[17,35],[10,-13],[9,-3],[20,5],[9,6],[11,27],[9,7],[8,3],[15,15],[19,8],[11,21],[8,5],[4,5],[18,36],[4,12],[8,28],[4,11],[15,16],[35,28],[16,28],[3,-15],[0,-14],[-12,-94],[3,-22],[5,-13],[6,-11],[7,-16],[8,-40],[4,-12],[-10,67],[-7,17],[-3,9],[0,9],[3,13],[1,9],[-1,37],[1,29],[6,21],[10,15],[26,-19],[28,41],[40,92],[13,9],[42,-9],[5,4],[14,13],[6,3],[16,-1],[8,3],[6,9],[15,-19],[16,6],[18,15],[15,8],[11,15],[45,150],[8,12],[15,-13],[12,-24],[7,-31],[4,-37],[1,-42],[12,15],[6,23],[3,28],[2,65],[3,18],[5,13],[7,23],[2,-13],[3,-6],[5,1],[6,8],[5,13],[1,10],[0,12],[2,16],[10,28],[10,4],[25,-22],[-4,22],[-11,7],[-13,3],[-9,10],[-4,21],[2,20],[5,17],[22,56],[4,20],[0,23],[-3,20],[2,16],[34,-60],[13,-44],[18,-35],[6,-26],[6,-33],[9,-30],[11,-23],[14,-11],[10,4],[8,7],[5,-4],[1,-29],[3,-15],[12,-34],[4,-24],[8,13],[9,1],[33,-19],[4,-8]],[[8637,8495],[-2,-6],[-22,-41],[-10,-6],[-11,12],[-4,1],[-16,1],[-5,2],[-10,7],[-5,3],[-3,0],[-3,-1],[-2,-4],[-2,-8],[-1,-15],[1,-10],[2,-7],[6,-13],[3,-8],[2,-7],[0,-7],[1,-6],[-3,-9],[-4,-10],[-22,-42],[-5,-11],[-41,-132],[-5,-21],[-3,-18],[-1,-25],[0,-14],[2,-20],[-3,-18],[-13,-38]],[[8458,8024],[-15,18],[-10,34],[-7,12],[-28,39],[-24,43],[-27,38],[-21,12],[-11,3],[-12,8],[-7,12],[-4,10],[-23,10],[-6,23],[-3,26],[-1,27],[1,43],[-1,13],[-12,87],[-24,75],[-15,67],[-15,43],[-18,40],[-27,45],[-10,24],[-5,7],[-7,5],[-22,5],[-12,9],[-8,10]],[[8062,9284],[7,-13],[56,-157],[14,-27],[12,-13],[35,-24],[12,-17],[78,-147],[25,-31],[42,-4],[41,-38],[6,0],[3,4],[3,-1],[6,-16],[2,-15],[0,-16],[1,-17],[6,-13],[14,-14],[13,-7],[12,0],[12,6],[47,45],[15,0],[18,-35],[4,-108],[12,-47],[39,-68],[22,-22],[18,6]],[[8458,8024],[-19,-61],[-4,-19],[0,-10],[1,-4],[0,-2],[1,-2],[1,-1],[2,-1],[1,0],[2,-1],[2,-3],[1,-6],[-1,-5],[-2,-5],[-2,-5],[-7,-21],[-11,-40],[-3,-8],[-2,-4],[-3,-4],[-3,-3],[-3,-2],[-9,-14],[-20,-55]],[[8637,8495],[2,1],[25,-15],[8,-73],[4,-157],[5,-50],[3,-45],[6,-38],[16,-31],[21,-20],[63,-32],[12,-10],[8,-11],[10,-7],[13,2],[30,28],[10,5],[8,-5],[13,-8],[22,-65],[18,-15],[24,-1],[7,-3],[10,-9],[6,-11],[13,-33],[10,-18],[9,-8],[9,-1],[41,15],[8,-1],[21,-24],[9,0],[-1,60],[7,7],[21,-14],[29,-8],[8,-7],[10,-16],[16,-38],[11,-9],[9,2],[15,20],[59,18],[11,17],[-7,100],[2,111],[0,10],[5,-3],[13,2],[6,4],[6,5],[15,44],[3,8],[3,4],[11,21],[7,5],[6,-7],[16,-44],[11,-19],[12,-13],[13,-7],[15,-3],[13,2],[6,-1],[5,-6],[4,-16],[3,-39],[3,-12],[11,1],[15,12],[14,5],[6,-23],[2,-18],[40,-127],[3,-18],[3,-29],[6,-24],[15,-35],[36,-56],[5,-21],[24,-44],[17,-24],[10,-9],[11,-8],[14,-2],[13,3],[26,15],[11,3],[12,-10],[9,-21],[8,-21],[6,-10],[11,-9],[28,-63],[34,-53],[15,-13],[11,-21],[34,-16],[38,-35],[11,-16],[-8,-23],[-13,-24],[-8,-10],[-8,-6],[-9,-1],[-20,7],[-5,-1],[-16,-27],[-16,4],[-42,56],[-8,5],[-8,1],[-11,-3],[-9,4],[-11,11],[-11,7],[-8,-7],[-4,-26],[3,-33],[6,-29],[5,-16],[6,-3],[13,2],[5,-2],[8,-11],[12,-29],[8,-10],[12,-10],[10,-15],[7,-22],[19,-169],[11,-64],[17,-59],[11,-26],[7,-10],[6,-3],[7,2],[3,-5],[3,-9],[23,-45],[3,-7],[3,-18],[2,-7],[3,-1],[6,7],[2,-2],[7,-27],[2,-28],[-2,-58],[1,-13],[1,-11],[1,-11],[-1,-13],[-5,-15]],[[6832,3717],[-18,55],[-49,116],[-20,15],[-17,21],[-19,-1],[-32,26],[-11,13],[-25,55],[-13,13],[-9,0],[-8,3],[-4,14],[-4,50],[-4,23],[-10,35],[-8,21],[-22,44],[-3,10],[-3,16],[-1,14],[3,7],[4,-3],[2,-6],[2,-7],[2,-4],[15,-10],[7,-1],[3,-4],[3,-26],[8,-21],[15,2],[21,19],[30,61],[24,30],[21,59],[4,89],[-8,46],[-5,46],[-2,13],[3,15],[7,3],[8,12],[2,36],[-2,38],[-16,160],[-9,63],[-4,27],[-5,23],[-6,18],[-7,27],[-4,22]]],"transform":{"scale":[0.0016786000709070922,0.0006676414311431224],"translate":[-92.01158606699991,-5.011372578999925]}};
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
