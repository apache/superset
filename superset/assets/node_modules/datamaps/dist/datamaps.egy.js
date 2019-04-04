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
  Datamap.prototype.ecuTopo = '__ECU__';
  Datamap.prototype.egyTopo = {"type":"Topology","objects":{"egy":{"type":"GeometryCollection","geometries":[{"type":"MultiPolygon","properties":{"name":null},"id":"-99","arcs":[[[0]],[[1]],[[2]],[[3]],[[4]],[[5]]]},{"type":"Polygon","properties":{"name":"Al Gharbiyah"},"id":"EG.GH","arcs":[[6,7,8,9,10]]},{"type":"Polygon","properties":{"name":"Al Isma`iliyah"},"id":"EG.IS","arcs":[[11,12,13,14,15,16,17]]},{"type":"Polygon","properties":{"name":"Al Minufiyah"},"id":"EG.MF","arcs":[[18,19,20,-9]]},{"type":"Polygon","properties":{"name":"Al Qahirah"},"id":"EG.QH","arcs":[[21,22,23,24,-14]]},{"type":"Polygon","properties":{"name":"Al Qalyubiyah"},"id":"EG.QL","arcs":[[25,-24,26,-19,-8,27]]},{"type":"MultiPolygon","properties":{"name":"Ash Sharqiyah"},"id":"EG.SQ","arcs":[[[-15,-25,-26,28,29]],[[-17,30,31]]]},{"type":"Polygon","properties":{"name":"As Suways"},"id":"EG.SW","arcs":[[32,33,34,35,36,-22,-13]]},{"type":"MultiPolygon","properties":{"name":"Ad Daqahliyah"},"id":"EG.DQ","arcs":[[[37,38]],[[39,40]],[[41,42,-29,-28,-7,43,44]]]},{"type":"Polygon","properties":{"name":"Bur Sa`id"},"id":"EG.BS","arcs":[[45,-18,-32,46,-38,47]]},{"type":"Polygon","properties":{"name":"Dumyat"},"id":"EG.DT","arcs":[[-40,48,-42,49]]},{"type":"Polygon","properties":{"name":"Matruh"},"id":"EG.MT","arcs":[[50,51,52,53,54]]},{"type":"Polygon","properties":{"name":"Al Buhayrah"},"id":"EG.BH","arcs":[[55,-10,-21,56,-52,57,58]]},{"type":"Polygon","properties":{"name":"Al Fayyum"},"id":"EG.FY","arcs":[[59,60]]},{"type":"Polygon","properties":{"name":"Al Iskandariyah"},"id":"EG.IK","arcs":[[-58,-51,61]]},{"type":"Polygon","properties":{"name":"Al Jizah"},"id":"EG.JZ","arcs":[[-27,-23,-37,62,63,-61,64,65,66,-53,-57,-20]]},{"type":"Polygon","properties":{"name":"Al Minya"},"id":"EG.MN","arcs":[[67,68,69,-66,70]]},{"type":"Polygon","properties":{"name":"Bani Suwayf"},"id":"EG.BN","arcs":[[71,-71,-65,-60,-64]]},{"type":"Polygon","properties":{"name":"Kafr ash Shaykh"},"id":"EG.KS","arcs":[[-44,-11,-56,72]]},{"type":"Polygon","properties":{"name":"Aswan"},"id":"EG.AN","arcs":[[73,74,75,76]]},{"type":"Polygon","properties":{"name":"Asyut"},"id":"EG.AT","arcs":[[77,78,79,-69]]},{"type":"Polygon","properties":{"name":"Al Wadi at Jadid"},"id":"EG.WJ","arcs":[[-80,80,81,-75,82,-54,-67,-70]]},{"type":"Polygon","properties":{"name":"Qina"},"id":"EG.QN","arcs":[[-76,-82,83,84],[85]]},{"type":"Polygon","properties":{"name":"Suhaj"},"id":"EG.SJ","arcs":[[86,-84,-81,-79]]},{"type":"MultiPolygon","properties":{"name":"Al Bahr al Ahmar"},"id":"EG.BA","arcs":[[[87]],[[88]],[[-36,89,-77,-85,-87,-78,-68,-72,-63]]]},{"type":"MultiPolygon","properties":{"name":"Janub Sina'"},"id":"EG.JS","arcs":[[[90]],[[91]],[[-34,92,93]]]},{"type":"MultiPolygon","properties":{"name":"Shamal Sina'"},"id":"EG.SS","arcs":[[[94]],[[95]],[[96]],[[-93,-33,-12,-46,97]]]},{"type":"Polygon","properties":{"name":"Luxor"},"id":"EG.UQ","arcs":[[-86]]}]}},"arcs":[[[9804,276],[-1,-17],[-1,11],[-10,-1],[-7,-1],[-6,-1],[1,4],[0,10],[3,4],[2,7],[4,3],[5,2],[2,-4],[-1,-1],[-5,-3],[6,-2],[5,-8],[3,-3]],[[9429,685],[-2,-5],[-6,11],[-4,5],[-3,6],[-6,3],[-6,8],[20,2],[8,-16],[0,-5],[2,-5],[-3,-4]],[[9315,775],[0,-5],[2,-6],[0,-5],[-4,2],[-2,4],[-3,10],[-10,-12],[3,-6],[-4,-5],[-3,17],[10,13],[4,11],[9,6],[-2,-6],[-2,-5],[1,-3],[1,-10]],[[9443,831],[1,-5],[5,0],[11,-2],[8,-1],[-4,-3],[-7,0],[-11,1],[-10,-1],[-4,-3],[-8,7],[6,-1],[5,3],[6,1],[0,7],[-1,7],[-2,7],[5,-9],[3,-3],[0,-2],[-3,-3]],[[9014,1283],[1,-4],[2,-1],[3,-9],[-4,3],[-1,-3],[3,-4],[7,-10],[7,-9],[1,-7],[-4,6],[-9,2],[-4,2],[-4,7],[-5,2],[-7,10],[-4,5],[-4,0],[-5,2],[0,-4],[-2,-2],[-3,4],[-9,2],[-8,2],[-9,-2],[-10,-9],[-4,-6],[-6,4],[5,-6],[8,-3],[2,-5],[-4,0],[-7,5],[-13,4],[0,2],[0,4],[-2,4],[-2,3],[-2,3],[3,2],[3,0],[2,-2],[3,0],[9,3],[8,0],[11,3],[8,0],[7,5],[8,-4],[11,-3],[4,0],[2,1],[4,3],[6,4],[4,-1],[0,-3]],[[9430,1663],[-11,-9],[-5,10],[1,8],[-2,15],[6,-2],[6,-2],[5,-4],[2,-2],[-2,-14]],[[5372,9433],[-5,2],[-2,2],[-2,1],[-1,-2],[-6,-49],[-8,-27],[-1,-8],[4,-6],[5,-2],[5,-2],[8,-3],[2,-1],[9,3],[7,5],[8,2],[8,2],[8,4],[4,-1],[3,-3],[-1,-5],[2,-8],[-6,-29],[-2,-5],[-8,-6],[-10,-1],[-9,-3],[-7,-11],[-1,-13],[2,-8],[4,-8],[1,-13],[-5,-9],[-9,-7],[-3,-9],[11,-11],[-4,-2],[-3,-2],[-3,-2],[-6,-1],[5,-3],[5,-5],[5,-6],[1,-4],[0,-11],[-2,-3],[-3,0],[-6,-4],[-18,-6],[-4,-4],[2,-7],[4,-8],[7,-9],[4,-43],[5,-26],[2,-3],[4,-1],[4,-2],[1,-8],[3,-28],[10,-47],[-1,-28],[-13,-47]],[[5376,8894],[-2,-24]],[[5374,8870],[-18,12],[-6,12],[-17,17],[-7,6],[-3,7],[-2,8],[-6,5],[-6,5],[-11,7],[-10,4],[-29,3],[-12,-2],[-5,0],[-2,3],[-2,6],[-17,31],[-3,3],[-2,0],[-14,-7],[-4,-1],[-6,-1],[-5,1],[-7,1],[-14,-2],[-4,1],[-8,11],[-7,1],[-7,3],[-13,17],[-9,4],[-9,1],[-10,-1],[-8,-3],[-10,-5],[-8,-5],[-42,-6],[-8,-3],[-11,-7],[-11,-7]],[[5001,8989],[-2,15],[-4,11],[-7,4],[-4,7],[5,15],[9,13],[4,4],[-4,17],[-8,0],[-11,-4],[-11,5],[-2,11],[6,14],[8,12],[5,6],[22,6],[10,6],[1,10],[-8,6],[-11,-1],[-26,-5],[19,14],[4,6],[3,10],[1,12],[-4,10],[-8,4],[-18,5],[2,10],[11,14],[7,14],[-4,17],[-19,33],[-2,6],[10,7]],[[4975,9303],[7,20],[6,1],[6,-2],[2,-1],[49,-19],[9,2],[15,6],[11,1],[13,-2],[7,4],[2,1],[-1,4],[0,2],[3,3],[10,4],[8,6],[7,2],[59,4],[13,7],[7,9],[5,20],[4,9],[2,9],[1,6],[-2,17],[0,10],[2,10],[6,9],[44,-2],[18,-9],[9,0],[18,18],[9,5],[10,0],[8,-1],[8,-2],[5,-3],[17,-18]],[[6480,9292],[34,-358],[2,-92],[2,-22],[3,-14],[2,-4],[75,-131],[43,-123]],[[6641,8548],[-155,12],[-26,-3],[-26,-8],[-7,-4],[-32,-34],[-4,-2],[-24,-12],[-4,-1],[-10,0],[-42,7],[-15,5],[-11,5],[-24,17],[-71,6],[-295,-11]],[[5895,8525],[-36,111]],[[5859,8636],[-25,107],[-3,38],[-7,26],[-8,12],[-9,8],[-10,13],[-3,11],[0,10],[2,4],[2,2],[3,-1],[6,-2],[1,0],[3,1],[37,-13],[3,0],[36,0],[22,3],[12,5],[21,3],[24,1],[22,15],[26,29],[54,78],[17,40],[9,27],[-11,54],[1,40],[10,26],[5,18],[12,21],[11,39],[24,33],[5,16],[2,13],[-1,12],[-7,32],[-15,12],[-12,7],[-14,21],[0,6]],[[6104,9403],[3,-1],[-4,8]],[[6103,9410],[1,0],[70,9],[30,7],[21,11]],[[6225,9437],[17,6],[238,-151]],[[5374,8870],[9,-14],[-11,-4],[-7,4],[-5,7],[-5,1],[-5,-8],[-1,-10],[1,-11],[5,-8],[0,-6],[-23,-21],[-13,-6],[-1,-1],[-3,-3],[0,-6],[1,-8],[-1,-5],[-6,-6],[-14,-3],[-8,-5],[-7,-10],[-1,-9],[0,-10],[-3,-14],[-5,-12],[-2,1],[-3,7],[-6,4],[-8,1],[-1,1],[2,-4],[0,-12],[1,-7],[2,-6],[0,-6],[-8,-8],[-8,-5],[-8,0],[-18,5],[9,-15],[22,-17],[8,-12],[1,-11],[-3,-46],[6,-7],[2,-16],[1,-29],[3,-12],[15,-24],[9,-18]],[[5287,8466],[-12,8],[-10,6],[-20,19],[-10,5],[-11,10],[-7,2],[-7,-2],[-11,-9],[-7,-3],[-16,0],[-15,6],[-10,10],[-4,16],[-1,23],[-2,11],[-5,4],[-1,3],[-10,5],[-9,3],[-8,3],[-2,1],[-6,14],[-2,11],[1,11],[-2,10],[-6,4],[-22,6],[-25,-21],[-15,8]],[[5032,8630],[-6,15],[6,14],[38,12],[-5,11],[-24,18],[-2,15],[2,15],[4,13],[2,11],[-2,11],[-4,11],[-11,24],[6,9],[6,12],[4,14],[1,15],[-7,2],[-6,-1],[-5,0],[-5,5],[-2,9],[0,8],[4,7],[9,5],[0,7],[-16,9],[-11,19],[-5,25],[-2,44]],[[5895,8525],[1,-59],[21,-101],[18,-212],[-6,-93]],[[5929,8060],[-522,-24],[-6,14],[5,12],[5,22],[0,39],[-6,43],[-10,39],[-12,27],[-21,26],[-9,16],[-4,19],[14,111]],[[5363,8404],[56,23],[3,2],[2,2],[2,3],[2,3],[1,4],[2,9],[1,3],[1,1],[3,1],[3,0],[5,-3],[3,-3],[4,0],[5,1],[9,5],[5,4],[19,8],[40,9],[126,6]],[[5655,8482],[204,154]],[[5457,8879],[-18,-18],[-21,-16],[-9,-14],[-4,-11],[-2,-18],[-10,-36],[-1,-29],[5,-8],[14,-12],[8,-19],[6,-9],[8,-8],[8,-11],[8,-14],[6,-25],[7,-17],[7,-21],[7,-9],[8,-9],[171,-93]],[[5363,8404],[0,9],[-3,10],[-4,8],[-9,5],[-32,4],[-10,6],[-18,20]],[[5376,8894],[24,-10],[11,-9],[11,1],[10,3],[7,5],[18,-5]],[[5457,8879],[19,23],[4,21],[-1,20],[-2,10],[-5,18],[-4,30],[-7,35],[1,21],[2,15],[5,11],[7,9],[8,7],[13,5],[16,4],[40,1],[8,-1],[8,-1],[12,2],[8,3],[27,-4],[11,2],[13,8],[8,12],[25,23],[5,10],[1,9],[-3,16],[0,12],[7,7],[7,4],[9,2],[6,3],[11,9],[5,10],[4,13],[8,17],[43,56],[30,61],[4,6],[2,0],[4,1],[4,-1],[5,-1],[4,0],[2,1],[3,1],[4,0],[6,0],[2,1],[7,4],[4,1],[2,0],[2,-1],[6,-3],[3,-1],[2,0],[2,0],[4,1],[5,3],[2,1],[12,1],[38,10],[10,1],[2,0],[1,1],[25,22],[4,1],[4,0],[14,0],[2,0],[8,4],[25,18]],[[6030,9453],[2,-6],[5,-6],[8,-3],[0,-8],[-9,-2],[-6,-4],[-4,-6],[-3,-9],[4,-2],[7,-5],[8,6],[7,1],[7,-2],[5,-5],[0,-6],[-5,0],[0,-8],[8,-8],[10,-5],[11,-1],[10,8],[0,6],[-12,0],[-8,7],[-5,10],[-3,11],[13,-3],[16,-9],[8,-1]],[[6103,9410],[-2,6],[13,1],[4,-1],[0,8],[-4,1],[-1,1],[1,1],[-2,3],[2,1],[9,7],[1,-6],[2,-2],[4,1],[5,-1],[-4,12],[7,7],[9,1],[9,-17],[10,-4],[13,-1],[12,2],[19,13],[9,18],[-2,19],[-15,15],[20,1],[1,0]],[[6223,9496],[0,-1],[2,-58]],[[6641,8548],[16,-97],[10,-210],[7,-22],[7,-14],[6,-9]],[[6687,8196],[-166,-128],[0,-1]],[[6521,8067],[-3,5],[-19,22],[-17,9],[4,10],[9,9],[4,4],[0,29],[-10,20],[-34,36],[8,5],[3,5],[-1,5],[-5,6],[5,2],[2,2],[-2,2],[-5,1],[-3,7],[-4,5],[-4,5],[-2,4],[1,3],[3,2],[3,2],[6,1],[0,6],[-2,8],[0,6],[2,9],[-5,0],[-10,-26],[-1,-11],[2,-8],[4,-5],[4,-8],[1,-14],[-6,0],[-2,13],[-6,8],[-9,0],[-11,-7],[-13,6],[-16,-11],[-14,-19],[-8,-18],[-1,-19],[5,-15],[12,-11],[18,-5],[-14,-13],[-69,-106],[-4,-8],[-8,-10],[-24,-48],[-5,-17],[0,-43],[-5,-17],[-11,-14],[0,-8],[8,-8],[10,-14],[7,-14],[7,-22],[9,-11],[41,-30],[11,-10],[37,-49],[26,-17],[23,-26],[20,-30],[9,-20],[3,-26],[8,-34],[11,-32],[11,-19],[0,-6],[-3,-19],[23,-101]],[[6525,7375],[-79,-1],[-16,-2],[-34,-12],[-23,-16],[-249,-121],[-18,-6],[-12,-3],[-67,4],[-112,-18],[-35,17]],[[5880,7217],[52,795],[-3,48]],[[6197,9619],[0,-8],[0,-5],[0,-1]],[[6197,9605],[-8,4],[-16,3],[-10,-4],[-6,17],[10,-1],[11,-1],[19,-4]],[[6055,9691],[3,2],[6,5]],[[6064,9698],[9,-4],[20,-25],[5,-4],[12,-6],[32,-28],[9,-6],[-25,6],[-81,55],[4,-1],[4,1],[2,-1],[6,-6],[-2,7],[-3,5],[-1,0]],[[5636,9779],[0,-2],[-3,-9],[-2,-6],[-4,-8],[-5,-6],[-29,-23],[-14,-18],[-2,-4],[1,-6],[7,-5],[37,-6],[5,-3],[2,-7],[-1,-7],[0,-7],[2,-5],[6,-3],[6,2],[6,-1],[10,-10],[6,-3],[6,-1],[4,-4],[5,-13],[3,-2],[5,-2],[9,5],[5,5],[2,6],[0,4],[-3,10],[0,3],[2,4],[15,7],[5,1],[5,0],[3,-8],[2,-7],[2,-9],[-3,-4],[0,-8],[5,-8],[-3,-5],[-7,0],[-6,7],[-6,0],[-2,-4],[-1,-3],[-3,-8],[16,-9],[-2,-11],[-12,-11],[-15,-5],[-14,-1],[-1,-4],[5,-9],[1,-14],[-15,-22],[-14,-5],[2,-12],[3,-10],[6,-5],[10,1],[46,43],[21,12],[37,10],[25,18],[12,33]],[[5819,9607],[2,1],[-2,1],[-1,1],[-1,1],[-2,4],[12,-6],[6,-1],[7,0],[7,-5],[1,-9],[0,-10],[3,-4],[10,-3],[12,-7],[13,-9],[8,-10],[6,17],[4,7],[6,5],[-3,-10],[-1,-6],[1,-6],[3,-7],[-11,0],[0,-7],[11,0],[-2,-2],[-3,-2],[-1,-3],[1,-7],[4,1],[2,1],[2,3],[3,3],[1,-2],[0,-3],[1,-2],[4,-1],[0,8],[5,0],[-4,-15],[4,-10],[7,1],[4,16],[10,1],[13,15],[15,12],[19,-7],[-12,0],[0,-7],[12,-6],[2,4],[5,4],[4,5],[12,-7],[0,-6],[-4,-5],[-1,-3],[-1,-14],[9,4],[2,3],[-1,-9],[-2,-6],[-3,-4],[-5,-2],[0,-7],[5,-9],[0,-11],[-17,-16],[0,-7],[9,0],[7,2],[5,5],[2,7],[5,0],[1,-11],[1,-2]],[[5372,9433],[13,8],[7,6],[9,5],[8,1],[5,2],[-3,10],[-14,14],[-5,8],[-1,10],[8,23],[3,17],[-1,30],[-2,18],[-1,18],[2,45],[0,33],[-8,62],[-2,10],[-4,10],[-11,14],[-4,5],[-2,9],[1,9],[2,9],[3,6],[20,18],[60,35]],[[5455,9868],[23,-12],[34,-28],[85,-43],[27,-7],[12,1]],[[6478,9383],[0,-1],[2,-90]],[[6223,9496],[2,-1],[4,31],[0,14],[-4,18],[-14,19],[-2,9],[10,8],[-12,8],[-10,3]],[[6197,9619],[36,-8],[11,-9],[5,0],[10,-1],[2,-18],[8,-13],[12,-9],[26,-7],[9,-10],[15,-21],[35,-37],[15,-12],[23,-44],[22,-21],[24,-16],[28,-10]],[[6055,9691],[-5,2],[-17,2],[-4,4],[-2,5],[-4,4],[-22,13],[-8,8],[-4,-1],[-6,0],[-2,14],[-5,13],[-7,10],[-8,6],[11,0],[10,2],[-41,55],[-9,17],[-12,17],[-9,6],[-1,-5],[-13,7],[-6,-3],[-3,-11],[-11,7],[0,-3],[0,-7],[0,-3],[-3,2],[-6,2],[-3,2],[1,-8],[-2,-6],[-4,-7],[17,0],[-5,-12],[13,-24],[-2,-14],[5,0],[0,-7],[-5,0],[1,-4],[3,-5],[1,-5],[-5,0],[-3,12],[-6,10],[-8,6],[-11,1],[3,7],[-4,1],[-6,-7],[-5,-16],[5,0],[3,1],[4,6],[5,-5],[5,-2],[6,0],[0,-7],[-6,0],[0,-7],[3,-6],[5,-5],[7,-2],[8,-1],[-6,-6],[-8,-3],[-8,3],[-6,6],[-5,0],[0,-5],[-1,-1],[-3,0],[-3,-1],[4,-3],[3,-4],[5,-8],[-11,-15],[-3,-12],[8,-7],[17,0],[0,-8],[-11,2],[-9,4],[-7,1],[-7,-7],[-5,0],[-5,6],[-6,0],[-4,-6],[-2,-11],[4,-5],[6,-4],[1,-4],[-11,-4],[0,-7],[5,-10],[-6,-3],[-9,-3],[-7,-6],[-2,-15],[6,-9],[9,-2],[8,4]],[[5636,9779],[22,1],[123,38],[74,45],[29,11],[32,-1],[26,-14],[12,-28],[4,-12],[26,-38],[11,-30],[13,-17],[26,-26],[9,-4],[20,-5],[1,-1]],[[4020,9329],[22,-695]],[[4042,8634],[39,-88],[538,-367]],[[4619,8179],[-637,-429],[-532,-594],[-166,-139],[-649,-188],[-61,-28],[-39,-47],[-22,-39],[-354,-844]],[[2159,5871],[-1904,-1],[-15,0]],[[240,5870],[0,364],[0,81],[0,409],[0,412],[0,174],[0,128],[-6,59],[-14,56],[-68,182],[-8,35],[-2,40],[7,75],[0,26],[-12,42],[-42,78],[-5,43],[14,54],[1,21],[-4,23],[-71,194],[-23,46],[-7,22],[0,40],[13,36],[34,67],[14,36],[8,14],[22,31],[25,28],[48,79],[16,36],[7,35],[3,20],[25,72],[8,57],[11,41],[12,36],[5,35],[-11,42],[-36,83],[-11,53],[-28,64],[-6,21],[-19,111],[-1,84],[-8,88],[1,37],[10,33],[133,118],[30,88],[23,36],[51,44],[-1,-8],[10,-67],[9,-34],[15,-20],[17,-6],[42,-2],[32,-18],[17,0],[37,6],[8,-3],[9,-5],[10,-2],[15,10],[20,5],[24,3],[133,42],[154,56],[37,6],[80,-4],[324,-98],[236,-35],[13,-8],[13,-5],[41,4],[17,-2],[58,-31],[34,-11],[38,-1],[29,12],[15,2],[14,-10],[11,-12],[8,-4],[8,0],[9,-2],[22,-14],[52,-19],[55,-7],[21,-6],[13,-11],[5,5],[8,5],[3,4],[10,-1],[52,1],[5,-2],[6,-4],[6,-7],[0,-4],[-2,-4],[2,-7],[6,-13],[4,-6],[4,-2],[3,-3],[1,-16],[2,-6],[6,-12],[8,-31],[8,-14],[20,-18],[23,-14],[26,-10],[52,-8],[20,-10],[18,-4],[18,11],[42,-24],[48,10],[95,50],[14,2],[9,-7],[4,-14],[1,-21],[3,-8],[14,-38],[3,-33],[3,-9],[24,-16],[39,-6],[147,0],[10,-2],[7,-6],[7,-7],[7,-5],[10,-3],[24,3],[19,-3],[35,-9],[15,-2],[17,4],[36,19],[18,4],[16,-3],[15,-7],[13,-10],[9,-11],[8,-5],[29,1],[11,-3],[9,-3],[13,-8],[146,-57],[29,-18],[16,-7],[20,-3],[5,-6],[5,-28],[4,-9],[5,-5],[15,-5],[143,-81],[132,6],[24,5],[112,59],[121,64],[43,35],[34,19]],[[4676,9779],[14,-3],[7,-12],[2,-20],[-1,-26],[4,-3],[7,-3],[8,-4],[3,-11],[1,-10],[4,-7],[5,-5],[8,-4],[0,4],[3,7],[4,5],[7,-4],[3,-4],[7,-5],[3,-3],[5,-5],[4,-7],[2,-8],[1,-11],[-1,-21],[-5,-20],[-7,-16],[-10,-11],[0,-6],[4,-2],[0,-1],[1,-2],[1,-3],[5,0],[0,8],[6,0],[4,-9],[5,-28],[0,-6],[14,-1],[0,1],[4,1],[3,3],[3,2],[6,1],[6,-4],[9,-14],[5,-3],[9,-3],[7,-7],[37,-61],[39,-23],[6,-9],[2,-5],[12,-17],[3,-10],[1,-11],[-3,-15],[2,-9],[7,-6],[14,-15],[9,-15]],[[5032,8630],[-380,-375],[-33,-76]],[[4042,8634],[49,129],[36,42],[134,69],[30,22],[26,32],[21,34],[22,45],[-11,39],[-12,26],[-38,50],[-52,93],[-6,18],[-3,24],[12,25],[15,19],[10,18],[1,6],[-8,27],[-16,11],[-5,10],[-3,5],[-1,4],[-1,3],[-1,9],[0,4],[1,3],[1,2],[4,4],[47,23],[56,35],[9,9],[22,33],[47,101],[2,6]],[[4430,9614],[31,-10],[30,-3],[-7,-5],[-9,-12],[-7,-4],[-1,-5],[2,-2],[2,0],[3,-1],[-10,-7],[3,-8],[9,-7],[9,-6],[34,22],[-4,-12],[4,-6],[7,-1],[4,1],[3,6],[25,26],[2,-5],[1,0],[3,-3],[2,6],[1,4],[2,4],[1,8],[5,0],[-1,-11],[2,-8],[4,-6],[6,-3],[3,7],[9,28],[-13,7],[-12,-3],[-12,-7],[-14,-4],[0,7],[2,0],[6,-1],[3,1],[0,7],[-13,-5],[-49,-2],[0,7],[31,8],[29,18],[50,48],[17,32],[12,42],[3,43],[-7,36],[6,0],[4,-20],[7,-19],[11,-14],[17,-4],[0,1]],[[5252,7664],[-33,-36],[-32,-69],[-33,-41],[-15,-32],[-26,-44],[-56,-67],[-69,-40],[-341,-106],[-38,-4],[-55,44],[-356,72]],[[4198,7341],[382,411],[60,53],[149,97],[171,87],[172,24],[38,-33],[23,-26],[59,-290]],[[4020,9329],[5,3],[6,10],[6,8],[121,95],[13,28],[22,-6],[24,12],[38,37],[-7,12],[-3,-1],[-7,-4],[4,10],[7,8],[6,0],[5,-11],[6,0],[10,11],[38,37],[11,8],[11,6],[16,25],[7,5],[11,3],[7,5],[5,7],[8,7],[-3,1],[-2,0],[-1,1],[0,5],[23,14],[-3,-30],[23,-20],[3,-1]],[[5880,7217],[-301,101],[-16,8],[-24,17],[-16,14],[-32,37],[-10,14],[-4,7],[-11,29],[-6,10],[-5,7],[-18,16],[-60,82]],[[5377,7559],[3,12],[0,8],[0,12],[-2,10],[-4,10],[-8,15],[-5,8],[-7,7],[-8,6],[-12,6],[-24,9],[-21,3],[-37,-1]],[[4198,7341],[-33,-261],[-21,-79]],[[4144,7001],[-133,-388],[-104,-154],[-124,-103],[-378,-223],[-59,-49],[-41,-69],[-58,-144]],[[3247,5871],[-1088,0]],[[5123,6956],[-26,-253],[-5,-21],[-4,-12],[-40,-76],[-24,-69],[-5,-24],[-2,-18],[1,-11],[9,-47],[3,-45],[2,-12],[4,-12],[44,-97],[13,-41],[4,-28],[7,-98],[4,-23],[19,-56],[4,-20],[4,-31],[1,-25],[-1,-16],[-15,-99]],[[5120,5822],[-87,-12],[-9,2],[-48,21],[-5,0],[-8,-1],[-26,-6],[-16,0],[-22,10]],[[4899,5836],[4,13],[10,22],[-1666,0]],[[4144,7001],[835,22],[15,-17],[129,-50]],[[5377,7559],[-3,-44],[3,-41],[-1,-14],[-6,-19],[-9,-22],[-15,-43],[-10,-22],[-12,-19],[-36,-44],[-23,-34],[-47,-85],[-55,-81],[-18,-36],[-15,-48],[-6,-30],[-1,-21]],[[4676,9779],[-23,18],[-12,31],[5,18],[30,-18],[22,-18],[25,-12],[30,-3],[35,5],[116,33],[243,94],[0,-7],[-12,-2],[-76,-31],[-63,-39],[-44,-23],[-35,-25],[-4,-3],[-11,-2],[-7,-2],[-31,-24],[-14,-5],[-33,-3],[-7,-4],[-4,0],[-12,-21],[0,-8],[17,-5],[6,0],[5,5],[5,0],[13,-8],[23,2],[22,7],[10,10],[7,17],[17,-5],[17,-15],[9,-15],[6,0],[5,18],[13,18],[15,15],[12,6],[7,4],[9,-5],[11,-7],[12,-6],[8,1],[11,3],[11,1],[10,-5],[-3,-1],[-2,0],[-1,-1],[0,-5],[11,-4],[14,5],[14,10],[11,10],[-2,2],[-2,-1],[-1,1],[0,5],[3,2],[0,1],[0,1],[2,4],[28,-14],[6,-8],[7,7],[6,8],[9,21],[-5,9],[3,7],[13,12],[3,6],[-1,6],[-1,4],[5,5],[5,1],[30,-2],[8,-3],[13,-10],[2,-4],[0,-5],[2,-4],[7,-1],[7,2],[5,5],[3,7],[-15,8],[6,4],[5,2],[5,-1],[-16,23],[-33,27],[-39,18],[-37,1],[8,5],[21,8],[69,12],[26,-3],[75,-26],[106,-52]],[[5573,1],[-48,0],[26,92],[19,66],[1,26],[-7,23],[-18,21],[-15,9],[-16,3],[-16,-4],[-15,-9],[-21,-28],[-37,-88]],[[5426,112],[-2,3],[-6,11],[-8,11],[-36,31],[-8,9],[-7,10],[-5,12],[-1,11],[2,14],[6,15],[13,22],[11,13],[11,10],[20,12],[20,7],[21,4],[41,2],[20,4],[20,8],[20,11],[13,9],[29,26],[58,86],[6,17],[6,16],[6,33],[0,7],[-5,56],[-13,61],[-4,23],[0,11],[4,15],[6,17],[14,26],[12,15],[12,12],[11,6],[11,4],[10,3],[10,1],[19,-1],[70,-22],[9,-1],[9,2],[261,145],[23,8],[11,1],[9,-1],[10,-4],[18,-14],[38,-36],[9,-5],[11,-3],[11,0],[23,5],[10,0],[9,-2],[9,-6],[7,-9],[10,-20],[7,-9],[8,-3],[9,4],[8,11],[16,40],[6,10],[7,10],[9,20],[8,28],[9,58],[9,29],[8,20],[8,11],[2,6],[8,19],[24,93],[40,104],[21,33],[72,90],[7,14],[5,14],[3,19],[0,17],[-6,18],[-8,6],[-10,1],[-111,-19],[-81,4],[-34,7],[-9,4],[-9,6],[-7,11],[-3,16],[5,26],[4,14],[7,19],[6,27],[11,78],[10,46],[5,10],[20,34],[15,21],[18,20],[10,7],[9,6],[10,5],[21,6],[100,16],[11,5],[9,6],[5,12],[0,13],[-7,19],[-8,11],[-9,7],[-19,11],[-37,25],[-9,9],[-7,10],[-4,14],[-2,18],[3,29],[5,32],[6,14],[2,4],[4,6],[8,7],[8,5],[10,4],[19,3],[53,-2],[20,4],[10,3],[10,6],[9,7],[9,9],[7,11],[2,8],[8,9],[1,10],[9,37],[0,19],[-11,43],[-2,14],[2,33],[2,12],[0,24],[6,52],[0,12],[-7,72],[2,57],[2,22],[0,14],[-1,3],[5,41],[30,84],[8,39],[-3,14],[0,6],[-7,39],[-15,55],[-35,84],[-6,18],[-3,14],[-9,106],[-12,39],[-10,23],[-14,24],[-17,23],[-29,25],[-66,44]],[[6523,3261],[14,14],[7,4],[8,7],[3,10],[3,15],[0,55],[6,24]],[[6564,3390],[166,-146],[31,-45],[28,-56],[11,-31],[6,-29],[8,-62],[2,-139],[5,-36],[4,-15],[89,-213],[1,-9],[-1,-19],[-6,-26],[-3,-9],[-10,-23],[-13,-22],[-67,-102],[-7,-19],[-17,-82],[-8,-70],[23,-177],[8,-24],[19,-41],[22,-71],[7,-18],[13,-20],[16,-16],[17,-14],[9,-9],[9,-12],[10,-22],[3,-16],[1,-13],[-1,-16],[0,-20],[5,-54],[-1,-17],[-4,-11],[-16,-32],[-3,-17],[1,-26],[18,-97],[5,-16],[23,-42],[10,-24],[3,-16],[0,-14],[-1,-11],[-6,-26],[-29,-88],[-5,-11],[-6,-9],[-25,-23],[-8,-11],[-5,-12],[-12,-35],[-4,-11],[-6,-10],[-16,-21],[-5,-14],[2,-13],[5,-11],[9,-9],[56,-40],[49,-21],[9,-6],[8,-9],[7,-10],[11,-23],[7,-10],[16,-17],[7,-10],[5,-11],[35,-135],[1,-27],[-3,-11],[-7,-6],[-8,1],[-9,3],[-8,5],[-53,46],[-66,79],[-19,14],[-19,8],[-21,2],[-67,-13],[-8,0],[-9,2],[-9,3],[-9,4],[-19,18],[-36,45],[-9,10],[-10,7],[-9,2],[-8,-1],[-6,-8],[-5,-9],[-8,-31],[-6,-10],[-16,-18],[-6,-15],[-1,-14],[6,-44],[-1,-30],[-3,-19],[-5,-14],[-11,-21],[-21,-33],[-106,-112],[-27,-34],[-30,-31],[-14,-11],[-16,-10],[-37,-14],[-39,-8],[-46,1],[-11,2],[-21,8],[-20,11],[-8,7],[-8,7],[-34,46],[-37,36],[-9,6],[-10,5],[-9,1],[-9,-3],[-8,-8],[-5,-10],[-9,-22],[-54,-176],[-13,-26],[-15,-22],[-11,-14],[-33,-29],[-9,-6],[-10,-4],[-10,-2],[-28,-1],[-10,-2],[-11,-5],[-9,-10],[-7,-11],[-11,-23],[-14,-21],[-10,-9],[-169,-93],[-18,-13],[-19,-17],[-18,-25],[-23,-52],[-1,-5],[-1,0]],[[5120,5822],[-3,-92],[2,-30],[2,-14],[8,-29],[5,-13],[6,-12],[7,-11],[8,-8],[72,-47],[83,-39],[52,-19],[12,-7],[12,-9],[19,-19],[10,-14],[7,-15],[13,-42],[6,-16],[6,-9],[6,-6],[19,-13],[34,-32],[51,-60],[12,-16],[19,-36],[87,-206]],[[5675,5008],[-33,-5],[-9,3],[-12,6],[-9,9],[-8,11],[-7,12],[-13,33],[-6,12],[-7,9],[-14,15],[-10,5],[-9,0],[-5,-4],[-7,-7],[-8,-12],[-5,-11],[-6,-8],[-8,-9],[-9,-8],[-76,-47]],[[5414,5012],[-103,235],[-10,16],[-38,47],[-16,15],[-13,10],[-75,35],[-40,26],[-109,116],[-13,17],[-14,24],[-76,182],[-9,33],[-2,28],[3,40]],[[5414,5012],[114,-159],[78,-76],[342,-487]],[[5948,4290],[130,-139],[8,-7],[15,-10],[20,-11],[12,-4],[15,-3],[23,-2],[39,8],[73,23],[189,101],[22,7],[37,5],[14,-1],[12,-2],[9,-5],[9,-7],[8,-8],[7,-10],[5,-11],[4,-11],[3,-21],[0,-22],[-2,-14],[-3,-10],[-8,-21],[-35,-67],[-4,-12],[-3,-12],[-7,-49],[-5,-23],[-4,-11],[-5,-10],[-6,-10],[-15,-21],[-113,-102],[-24,-28],[-12,-20],[-4,-11],[-2,-11],[-1,-21],[1,-16],[28,-125],[22,-149],[13,-37],[7,-16],[8,-13],[17,-21],[78,-69]],[[5426,112],[-3,-7],[-40,-97],[-11,-8],[-32,0],[-79,0],[-80,0],[-80,0],[-79,0],[-80,0],[-80,0],[-79,0],[-80,0],[-80,0],[-79,0],[-80,0],[-80,0],[-80,0],[-79,0],[-80,0],[-80,0],[-79,0],[-80,0],[-80,0],[-79,0],[-80,0],[-80,0],[-80,0],[-79,0],[-80,0],[-80,0],[-79,0],[-80,0],[-80,0],[-79,0],[-80,0],[-80,0],[-80,0],[-79,1],[-80,0],[-80,0],[-79,0],[-80,0],[-80,0],[-80,0],[-79,0],[-80,0],[-80,0],[-79,0],[-80,0],[-80,0],[-79,0],[-80,0],[-80,0],[-79,0],[-80,0],[-80,0],[-79,0],[-80,0],[-80,0],[-80,0],[-79,0],[-80,0],[-80,0],[-79,0],[-80,0],[-80,0],[-80,0],[-79,0],[0,302],[0,302],[0,302],[0,302],[0,302],[0,302],[0,302],[0,302],[0,302],[0,302],[0,302],[0,302],[0,302],[0,302],[0,302],[0,302],[0,202],[0,196],[0,92],[0,349],[0,158],[0,40]],[[5948,4290],[32,34],[9,7],[9,5],[47,7],[12,4],[10,7],[19,28],[5,4],[9,4],[9,-2],[11,-11],[24,-46],[16,-21],[18,-16],[19,-12],[11,-1],[9,1],[22,27]],[[6239,4309],[25,6],[165,91],[43,9],[24,2],[52,-4],[64,-21],[15,-10],[21,-16],[28,-30],[32,-49],[12,-24],[8,-23],[12,-49],[9,-75],[1,-37],[-2,-25],[-4,-28],[-7,-27],[-42,-99],[-16,-24],[-18,-24],[-79,-81],[-54,-69],[-12,-20],[-9,-21],[-10,-34],[-1,-15],[1,-55],[14,-78],[10,-29],[10,-22],[7,-10],[26,-28]],[[6519,3866],[-20,-44],[10,-3],[12,-2],[5,17],[9,14],[0,9],[-16,9]],[[5675,5008],[138,-109],[36,-40],[13,-34],[19,-37],[21,-33],[9,-19],[4,-16],[4,-46],[2,-12],[13,-28],[20,-34],[12,-19],[12,-14],[15,-12],[21,-12],[24,-11],[53,-13],[11,-5],[12,-10],[9,-11],[7,-13],[22,-47],[87,-124]],[[7627,4902],[1,-24],[-12,13],[-5,14],[-23,58],[13,1],[4,-1],[16,-40],[6,-21]],[[7630,5707],[18,-7],[6,-18],[2,-19],[11,-12],[0,-7],[-6,1],[-11,2],[-14,20],[-5,6],[-18,6],[-8,6],[-7,10],[-9,7],[-18,-10],[-8,7],[-6,12],[-3,11],[5,7],[5,4],[6,2],[7,1],[19,-3],[6,-5],[7,-5],[7,-7],[4,-4],[10,-5]],[[6525,7375],[2,-10],[0,-23],[-4,-8],[-8,-9],[-5,-12],[-8,-4],[-3,-9],[6,-11],[-4,-31],[-2,-36],[6,-12],[25,-28],[9,-13],[2,-11],[1,-21],[3,-11],[18,-22],[4,-3],[34,-53],[29,-6],[18,-22],[11,-31],[37,-154],[3,-21],[8,-3],[40,-25],[19,-21],[10,-14],[8,-19],[8,-3],[9,-3],[8,-4],[2,-7],[6,-21],[23,-50],[8,-8],[0,-4],[-1,-2],[-3,0],[-2,0],[36,-34],[15,-22],[-1,-22],[7,-6],[5,-11],[4,-13],[2,-9],[3,-4],[18,-29],[39,-46],[10,-22],[8,-6],[9,-4],[7,-6],[4,-14],[0,-11],[2,-8],[14,-3],[14,-8],[27,-37],[18,-12],[-1,-6],[1,-8],[0,-7],[-2,-8],[6,-7],[10,-2],[9,2],[7,-15],[18,-9],[37,-11],[58,-59],[19,-44],[9,-11],[6,-10],[18,-48],[2,-12],[0,-7],[4,-8],[3,-20],[4,-8],[0,-6],[-6,0],[-11,0],[-9,23],[-20,13],[-21,9],[-18,12],[-5,0],[-5,-15],[-2,-9],[1,-8],[6,-11],[16,-18],[8,-13],[4,-15],[5,-9],[12,4],[12,6],[5,-1],[-1,-15],[-3,-14],[-6,-14],[-7,-11],[3,-4],[4,-6],[4,-4],[15,-12],[5,-2],[2,-4],[8,-19],[4,-6],[0,-7],[-9,8],[-19,28],[-6,0],[0,-7],[3,-6],[3,-9],[-6,0],[-5,20],[-15,-2],[-16,-14],[-8,-18],[19,-11],[13,-20],[24,-46],[-4,-7],[-2,-8],[-1,-10],[1,-11],[14,-12],[35,-18],[12,-13],[3,-9],[1,-23],[3,-10],[5,-9],[14,-17],[6,-10],[5,-21],[6,-46],[5,-14],[28,-29],[31,-24],[35,-19],[16,-13],[11,-18],[1,-11],[-1,-39],[-2,-3],[-8,-7],[-2,-4],[1,-6],[4,-9],[1,-6],[1,-23],[3,-18],[9,-14],[15,-12],[14,-15],[15,-23],[6,-17],[-12,2],[0,-17],[6,-14],[16,-26],[7,-16],[11,-30],[7,-14],[11,-10],[12,-7],[10,-8],[4,-11],[5,-33],[1,-16],[-6,-12],[-14,0],[-9,9],[-7,4],[-9,-20],[-2,-13],[0,-19],[1,-18],[3,-14],[1,-26],[-17,-63],[8,-30],[11,-11],[27,-9],[13,-9],[8,-15],[9,-32],[26,-39],[12,-29],[28,-91],[12,-27],[17,-29],[11,-26],[19,-34],[69,-181],[32,-54],[31,-89],[65,-102],[6,-13],[8,-30],[55,-93],[30,-37],[7,-11],[71,-161],[11,-49],[20,-44],[8,-53],[15,-29],[36,-51],[5,-13],[7,-30],[5,-14],[25,-43],[10,-45],[38,-75],[70,-140],[3,-33],[9,-28],[13,-19],[16,-22],[3,-19],[1,-39],[2,-19],[5,-15],[6,-12],[10,-10],[13,-9],[21,-23],[14,-29],[19,-82],[5,-13],[14,-27],[15,-33],[12,-12],[0,-16],[-13,-32],[0,-29],[34,-15],[41,-88],[110,-98],[18,-24],[30,-100],[22,-28],[31,-52],[14,3],[-6,14],[-8,14],[8,2],[17,-20],[23,-11],[30,-36],[11,-29],[2,-30],[25,-18],[26,6],[20,-6],[21,-8],[18,-11],[12,-15],[17,-46],[15,-23],[-6,-9],[-12,20],[-17,21],[-11,0],[-30,-15],[-13,-8],[-16,8],[-15,8],[-16,3],[-11,-2],[-12,3],[-15,7],[-6,8],[-9,13],[-9,4],[0,5],[-13,6],[-17,6],[-8,-6],[-11,-25],[-6,-31],[6,-49],[-8,-43],[-5,-32],[7,-26],[15,-4],[7,-13],[-1,-15],[-3,-7],[2,-17],[0,-12],[2,-24],[-4,-42],[-2,-90],[-2,-17],[-8,-28],[-1,-16],[3,-15],[7,-16],[18,-29],[14,-30],[5,-17],[3,-17],[-1,-49],[7,-49],[7,-38],[6,-34],[38,-76],[12,-30],[16,-38],[11,-94],[6,-17],[16,-36],[34,-49],[22,-14],[-10,16],[-23,47],[16,0],[11,-10],[7,-15],[5,-18],[9,-51],[3,-8],[13,-11],[7,-12],[6,-12],[10,-15],[15,-23],[31,-28],[30,-14],[15,-6],[2,-4],[11,-8],[11,-7],[12,-4],[45,-4],[66,-15],[64,-25],[23,-17],[40,-44],[13,-25],[4,-48],[14,-31],[25,-26],[25,-22],[13,-7],[12,-6],[-2,16],[4,0],[17,-23],[-4,-30],[14,-42],[55,-30],[27,-18],[19,-14],[49,-49],[74,-83],[16,-10],[12,1],[3,7],[2,6],[2,4],[7,-2],[14,-11],[7,-7],[4,-7],[12,-31],[7,-13],[12,-13],[32,-22],[19,-9],[3,-37],[-1,-13],[-5,-11],[-7,-11],[0,-1],[-191,0],[-191,0],[-190,0],[-191,0],[-190,0],[-191,0],[-190,0],[-191,0],[-190,0],[-191,0],[-190,0],[-191,0],[-5,0],[-186,0],[-190,0],[-191,0],[-173,0],[-17,0],[-84,0],[-84,0],[-84,0],[-83,0],[-84,0],[-84,0],[-17,0],[-67,0],[-84,0],[-84,0],[-83,0],[-84,0],[-84,0],[-84,0],[-84,0],[-84,0],[-83,0],[-23,0]],[[8225,6131],[-23,-11],[-19,7],[-16,16],[16,29],[41,-1],[1,-40]],[[8071,6211],[-22,-5],[-9,-5],[-3,-11],[4,-5],[3,-4],[14,-1],[24,4],[10,4],[2,-2],[2,0],[4,-7],[3,-7],[1,-3],[13,-13],[16,-16],[0,-7],[-31,-3],[-29,2],[-24,11],[-16,24],[-2,2],[2,14],[-3,20],[-4,8],[3,5],[1,1],[1,-6],[3,8],[4,6],[5,5],[6,2],[14,-8],[5,-6],[3,-7]],[[6687,8196],[226,11],[522,-101],[210,-124],[166,-69],[95,-57],[102,-41],[342,-59]],[[8350,7756],[-8,-4],[-7,-6],[-6,-7],[-6,-10],[-4,-12],[-3,-11],[-5,-8],[-10,-5],[3,0],[2,-1],[1,-1],[0,-5],[-7,-4],[-5,-6],[-2,-6],[3,-5],[-8,-2],[-4,-3],[1,-4],[5,-5],[-9,-10],[-19,-33],[-4,-4],[-9,-5],[-4,-4],[-3,-7],[-3,-6],[-4,-5],[-7,-5],[0,-6],[7,-15],[-2,-14],[-7,-15],[-4,-13],[0,-53],[-4,-13],[-10,-9],[-10,-8],[-4,-6],[-1,-14],[-3,-17],[-5,-16],[-8,-13],[2,-12],[-2,-62],[2,-10],[8,-13],[2,-13],[-3,-12],[-6,-6],[-7,-3],[-18,-13],[-3,-5],[-3,-14],[1,-6],[4,-21],[1,-62],[-22,-18],[0,-6],[2,-9],[3,-15],[0,-15],[-5,-12],[3,-3],[3,-5],[5,-12],[-8,-6],[-1,-6],[2,-6],[1,-7],[-2,-11],[-3,-7],[-4,-6],[-2,-5],[-4,-18],[-20,-30],[-11,-48],[-33,-55],[-10,-30],[-1,-3],[0,-2],[-1,-2],[-4,1],[11,-32],[-10,-20],[-19,-16],[-16,-18],[2,-2],[1,0],[2,-5],[-11,-7],[-6,-13],[-8,-46],[-3,-11],[-9,-18],[-2,0],[-3,-12],[-11,-26],[-3,-12],[1,-18],[2,-13],[4,-12],[4,-11],[0,-6],[-6,-18],[7,-15],[11,-14],[7,-17],[7,-8],[3,-6],[0,-8],[-2,-4],[-3,-3],[-1,-3],[0,-13],[-8,-37],[-10,-29],[15,-29],[-14,-72],[6,-8],[-21,-4],[-7,-3],[-3,-6],[-2,-10],[-4,-9],[-10,-7],[-5,-15],[-7,-3],[-6,-1],[-12,-4],[-8,-2],[2,-4],[0,-1],[1,0],[3,-3],[-6,-15],[-8,-32],[-8,-9],[-6,0],[-2,5],[-7,3],[-6,5],[-5,-7],[-6,-23],[-7,-11],[6,-13],[-10,-11],[-16,-8],[-11,-3],[-7,1],[-3,-1],[4,-16],[2,-6],[30,0],[0,-7],[-6,0],[0,-7],[4,-4],[3,-5],[4,-12],[-8,4],[-3,3],[1,-4],[0,-2],[1,-1],[4,0],[0,-8],[-6,0],[-4,9],[-15,22],[-15,18],[-7,7],[-9,4],[-12,5],[-79,10],[-19,14],[-55,75],[-4,3],[-7,-1],[-47,49],[-11,6],[-10,1],[-10,-9],[-11,28],[-6,-6],[-7,10],[-28,27],[-7,3],[-2,2],[-3,5],[-3,8],[-3,5],[-6,5],[-6,3],[-13,3],[1,26],[-40,27],[0,18],[-12,11],[-14,22],[-9,22],[1,15],[-3,3],[-4,3],[-2,3],[-2,6],[-5,0],[0,-8],[-6,0],[-3,5],[-7,10],[-2,3],[-12,50],[-4,8],[-6,-4],[-6,13],[-20,33],[-7,16],[-108,72],[-5,11],[-3,1],[-19,38],[-16,16],[-10,13],[0,6],[-52,43],[-9,10],[-3,8],[-3,8],[-7,13],[-9,12],[-9,5],[5,8],[0,-8],[6,0],[-6,34],[-13,3],[-7,-14],[15,-15],[-14,5],[-9,13],[-4,19],[-4,42],[-5,18],[-14,31],[8,20],[10,48],[9,24],[-10,13],[-5,8],[-4,21],[-6,5],[-7,3],[-7,6],[-5,19],[-3,46],[-3,13],[0,7],[7,9],[2,9],[-4,24],[-1,6],[-4,15],[-1,15],[4,7],[6,7],[-6,14],[-10,11],[-5,0],[-1,11],[-5,8],[-7,3],[-8,-4],[-9,13],[-22,13],[-9,9],[-10,26],[-1,6],[-3,6],[-12,10],[-2,5],[-3,2],[-14,23],[-2,2],[-7,4],[-2,1],[-2,3],[-2,9],[-1,3],[-37,42],[-13,5],[-19,11],[-17,14],[-11,12],[-4,17],[-4,21],[-6,19],[-10,8],[-8,3],[-5,8],[-17,44],[-1,1],[3,39],[-4,17],[-22,12],[-40,32],[7,0],[-3,7],[-4,4],[-4,2],[-6,1],[2,2],[2,2],[1,4],[0,7],[-5,0],[-4,-9],[-2,-8],[1,-7],[5,-5],[-11,0],[6,38],[1,48],[-9,43],[-26,20],[0,6],[5,13],[-1,14],[-3,16],[-1,14],[2,16],[7,21],[1,10],[0,17],[-2,11],[-3,9],[-5,9],[-20,27],[-3,12],[-1,1]],[[6795,9406],[2,-10],[-8,8],[-3,5],[-5,0],[6,5],[5,-1],[3,-7]],[[7161,9498],[35,-32],[-18,14],[-127,60],[-24,4],[26,-1],[42,-22],[19,-5],[25,-5],[22,-13]],[[6892,9568],[129,-17],[-5,-4],[-10,0],[-26,5],[-24,4],[-25,3],[-27,-8],[-14,3],[-21,-8],[-99,-58],[-17,-15],[9,16],[19,10],[16,9],[10,7],[11,8],[43,22],[9,10],[22,13]],[[6478,9383],[2,0],[36,-1],[34,4],[61,18],[73,39],[14,11],[34,19],[9,7],[6,0],[0,-7],[-27,-11],[-45,-38],[-27,-8],[-45,-23],[-70,-19],[40,0],[0,-7],[-12,-7],[25,0],[10,4],[5,10],[5,0],[0,-6],[3,-1],[4,1],[4,-1],[51,35],[42,14],[9,8],[5,0],[3,-6],[12,-3],[-3,-5],[-6,-1],[0,-7],[8,3],[20,11],[0,8],[-23,0],[0,6],[11,5],[14,-4],[13,-9],[8,-13],[2,-6],[1,-10],[2,-5],[-12,0],[28,-11],[12,1],[11,10],[0,8],[-7,5],[-4,1],[0,7],[31,9],[8,6],[-4,8],[2,7],[4,9],[4,11],[-6,0],[-5,-7],[-17,-14],[-3,-4],[-2,-3],[0,-3],[5,-4],[-11,-3],[-19,1],[-19,3],[-13,5],[25,3],[14,16],[10,21],[13,17],[10,6],[20,4],[9,5],[16,16],[10,5],[14,0],[0,-7],[-23,0],[0,-7],[10,-8],[29,-42],[9,-17],[-3,-6],[-10,-3],[-12,-9],[-1,2],[0,3],[-1,2],[-4,-1],[0,-6],[13,-10],[8,-14],[-1,-16],[-9,-17],[30,13],[15,3],[11,-1],[5,1],[4,0],[7,-1],[0,6],[-11,8],[-5,0],[0,-8],[-5,0],[0,8],[43,18],[12,10],[6,0],[-6,-8],[6,-7],[6,6],[7,1],[6,-5],[3,-9],[6,0],[1,9],[-1,10],[-1,2],[12,1],[-8,4],[-8,-1],[-7,1],[-10,2],[90,8],[-8,19],[11,4],[13,1],[0,18],[9,-4],[3,-3],[5,0],[11,3],[33,-18],[15,-6],[60,-7],[16,-7],[0,7],[19,-6],[27,2],[169,48],[158,68],[124,87],[1,1],[20,-40],[5,-17],[14,-50],[9,-28],[32,-109],[26,-87],[31,-90],[42,-120],[50,-145],[18,-83],[2,-42],[5,-18],[13,-19],[8,-13],[0,-14],[-8,-31],[-1,-18],[1,-12],[6,-10],[45,-43],[9,-15],[27,-85],[48,-153],[32,-99],[2,-6],[2,-6],[0,-7],[0,-6],[5,-56],[36,-108],[32,-98],[21,-106],[-1,-72],[5,-24],[19,-43],[7,-15],[-1,-1]]],"transform":{"scale":[0.001221205900890092,0.0009663077315731498],"translate":[24.688342732000137,21.994369202000115]}};
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
