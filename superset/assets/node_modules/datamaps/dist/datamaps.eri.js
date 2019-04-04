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
  Datamap.prototype.egyTopo = '__EGY__';
  Datamap.prototype.eriTopo = {"type":"Topology","objects":{"eri":{"type":"GeometryCollection","geometries":[{"type":"MultiPolygon","properties":{"name":null},"id":"-99","arcs":[[[0]],[[1]],[[2]],[[3]],[[4]],[[5]],[[6]]]},{"type":"Polygon","properties":{"name":"Gash Barka"},"id":"ER.GB","arcs":[[7,8,9,10]]},{"type":"Polygon","properties":{"name":"Anseba"},"id":"ER.AN","arcs":[[11,-8,12,13]]},{"type":"MultiPolygon","properties":{"name":"Debub"},"id":"ER.DU","arcs":[[[14]],[[15]],[[16,17,18,-14,19,20]]]},{"type":"Polygon","properties":{"name":"Semenawi Keyih Bahri"},"id":"ER.SK","arcs":[[-13,-11,21,-20]]},{"type":"Polygon","properties":{"name":"Maekel"},"id":"ER.MA","arcs":[[22,-9,-12,-19]]},{"type":"Polygon","properties":{"name":"Debubawi Keyih Bahri"},"id":"ER.DK","arcs":[[-17,23]]}]}},"arcs":[[[9996,639],[3,-7],[-2,-7],[-7,-3],[-6,1],[-6,8],[-1,4],[3,3],[2,1],[3,-3],[3,0],[3,3],[5,0]],[[9697,834],[2,-15],[-15,7],[-11,11],[-4,23],[2,5],[10,-7],[16,-24]],[[9697,931],[15,-25],[-6,0],[-20,19],[-10,16],[-2,20],[14,6],[7,-14],[2,-22]],[[9641,1070],[65,-36],[8,-10],[2,-14],[-12,-4],[-4,-27],[-11,-7],[-11,8],[-4,11],[-2,9],[-7,2],[-12,0],[-9,-3],[-4,-3],[-2,-6],[-5,-2],[-7,8],[-12,29],[-3,28],[9,9],[10,-5],[10,-9],[5,5],[-4,12],[0,5]],[[9584,1210],[4,-11],[-13,6],[-4,-3],[-12,6],[-8,-6],[1,-10],[7,-2],[7,-13],[8,-8],[6,-11],[10,-4],[-5,-11],[-28,11],[-15,5],[-4,7],[-8,5],[4,22],[20,18],[11,1],[19,-2]],[[5774,4648],[-16,-11],[-10,2],[-33,-4],[-6,9],[-1,14],[34,72],[6,34],[7,11],[17,1],[32,-9],[7,-7],[10,-19],[7,-40],[-9,-13],[-17,-9],[-28,-31]],[[5730,4887],[-31,-17],[-13,0],[-7,10],[-19,7],[-3,5],[-5,30],[0,16],[7,14],[-1,18],[4,10],[5,6],[64,41],[18,2],[6,-1],[1,-10],[-5,-11],[-14,-15],[-8,-22],[-6,-8],[-13,0],[-5,-8],[18,-22],[8,-26],[-1,-19]],[[3510,5663],[3,-711]],[[3513,4952],[-99,13],[-47,-9],[-61,-29],[-128,-36],[-133,-12],[-22,-5],[-22,-11],[-27,-19],[-57,-74],[-32,-64],[-22,-33],[-20,-21],[-56,-25],[-33,-23],[-27,-28],[-14,-23],[-21,-70],[-28,-65],[-6,-32],[3,-42],[10,-50],[47,-120],[7,-64],[-18,-49]],[[2707,4061],[-9,26],[-15,22],[-23,11],[-35,2],[-85,-16],[-27,5],[-161,77],[-12,12],[-9,17],[-1,16],[-3,13],[-14,13],[-17,4],[-7,8],[-3,12],[-6,13],[-1,5],[1,19],[-1,7],[-5,6],[-14,2],[-7,6],[-28,65],[-18,31],[-26,26],[-61,-169],[-96,-269],[-96,-267],[-93,-259],[-86,-238],[-53,-149],[-17,-20],[-27,20],[-15,21],[-7,30],[-2,45],[-4,17],[-12,13],[-15,9],[-15,3],[-19,9],[-9,19],[-8,45],[-11,33],[-6,11],[-60,58],[-22,14],[-4,19],[1,41],[-2,26],[-6,14],[-23,27],[-56,94],[-28,19],[-36,36],[-21,-3],[-32,-13],[-110,2],[-51,-13],[-43,-38],[-22,-38],[-12,-35],[-5,-36],[-1,-42],[-4,-37],[-12,-30],[-16,-22],[-18,-15],[-12,-2],[-27,4],[-12,-2],[-22,-20],[-8,-4],[-15,2],[-13,5],[-12,7],[-12,10],[-27,43],[-9,7],[-49,7],[-97,34],[-47,7],[-102,0],[-14,-4],[-25,-17],[-12,-4],[-67,0],[-30,-6],[-46,-25],[-20,-5],[-32,-1],[-25,-7],[-19,-18],[-11,-35],[-28,1],[-33,325],[-23,220],[-22,222],[-18,172],[-10,98],[-30,297],[-17,168],[2,39],[12,31],[109,123],[27,48],[76,258],[29,55],[48,38],[-20,77],[4,75],[80,339],[19,39],[73,88],[40,76],[71,233],[67,221],[50,161],[24,46],[62,75],[15,45],[-4,37],[-27,72],[-7,37],[2,38],[5,32],[1,31],[-10,31]],[[748,7219],[42,-8],[29,-49],[12,-39],[10,-46],[10,-99],[9,-44],[10,-27],[10,-18],[12,-12],[13,-12],[12,-15],[12,-20],[21,-55],[10,-17],[21,-15],[34,-14],[139,-38],[76,-30],[92,-65],[57,-66],[45,-79],[28,-75],[24,-42],[30,-25],[51,-18],[45,-22],[28,-21],[11,-18],[2,-16],[-1,-17],[11,-13],[22,-9],[108,1],[105,16],[42,-1],[41,-12],[53,-30],[42,-35],[31,-18],[34,-8],[51,-2],[40,-6],[48,-17],[86,-44],[145,-113],[27,-10],[37,3],[32,14],[83,47],[36,13],[40,-1],[49,-17],[70,-53],[50,-56],[40,-62],[41,-92],[31,-27],[49,-14],[272,-9],[152,21]],[[4313,4988],[-16,-23],[-12,-8],[-19,-8],[-15,3],[-738,0]],[[3510,5663],[18,15],[12,2],[20,-4],[12,-7],[17,-16],[11,-1],[17,4],[56,22],[94,18]],[[3767,5696],[25,-78],[37,-80],[135,-241],[87,-110],[71,-73],[129,-79],[62,-47]],[[5353,6240],[54,-25],[33,-25],[10,-8],[14,-25],[7,-13],[-8,-25],[-15,-20],[-3,-19],[11,-14],[14,0],[14,6],[12,8],[-2,6],[-8,12],[-1,11],[16,6],[16,-11],[3,-22],[0,-2],[-9,-144],[5,-27],[8,-21],[1,-5],[27,-51],[5,-14],[15,-2],[87,-29],[22,50],[9,10],[12,4],[-20,9],[-30,10],[-13,20],[11,20],[27,10],[33,3],[31,-3],[16,-4],[14,-5],[6,-3],[5,-3],[10,-9],[5,-14],[3,-16],[4,-13],[13,-6],[21,-5],[31,-24],[19,-6],[22,-1],[7,-4],[12,-71],[-9,-32],[-21,-14],[-31,18],[-11,3],[-13,4],[-72,-21],[-31,-3],[-32,13],[-52,29],[-34,6],[-73,-18],[-15,3],[-8,1],[-6,7],[-9,13],[-6,9],[-3,3],[-7,7],[-13,-29],[-17,-15],[-25,-3],[-37,8],[-60,28],[-8,1],[-20,5],[-33,-8],[-1,0],[-12,19],[-10,16],[-39,134],[17,0],[10,-4],[1,-7],[1,-1],[-9,-12],[12,-8],[9,-11],[3,-7],[3,-6],[3,-17],[11,0],[14,7],[20,-9],[21,-14],[16,-8],[19,1],[63,23],[-28,57],[-36,46],[-44,31],[-50,12],[-49,-12],[-18,5],[-10,32],[2,35],[13,20],[20,2],[35,-26],[9,-7],[20,-2],[6,14],[-18,31],[-8,30],[-2,6],[29,16],[39,4],[17,-1],[1,0],[6,21],[0,1],[-9,28],[-17,24],[-15,10],[0,1],[-52,-4],[-17,9],[-18,30],[54,-5],[58,-15]],[[5484,6423],[-27,-9],[-43,17],[-36,23],[-64,7],[-15,18],[0,29],[12,28],[26,11],[34,3],[13,10],[-5,15],[-3,17],[-1,19],[3,19],[11,8],[37,-34],[11,-8],[15,-3],[27,-14],[11,-21],[-10,-17],[-24,-9],[-22,-24],[-5,-27],[9,-10],[13,-8],[10,-12],[16,-12],[7,-16]],[[6164,4590],[-1,-12],[3,-55],[29,-171],[3,-72],[-6,-66],[-23,-66],[-132,-219],[-75,-190],[-107,-207],[-16,-33]],[[5839,3499],[-114,123],[-58,40],[-64,31],[-134,37],[-26,0],[-74,-25],[-21,-1],[-34,7],[-30,7],[-27,-8],[-46,-45],[-29,-10],[-28,6],[-23,12],[-78,79],[-41,30],[-45,17],[-47,-2],[-18,-3]],[[4902,3794],[-82,164],[-429,858],[-31,83],[-47,89]],[[3767,5696],[-51,217],[-131,253],[-22,33],[-19,16],[-200,29],[-71,24],[-69,34],[-73,57],[-32,48],[-16,58],[-4,144],[5,44],[10,32],[13,28],[7,25],[4,35],[-1,40],[-9,53],[-18,60],[-43,89],[-38,51],[-35,35],[-33,44],[-15,45],[-22,95],[-18,39],[-30,49],[-13,36],[-9,36],[-10,26],[-16,16],[-338,70],[-37,21],[-34,41],[-9,40],[5,53],[21,115],[-1,57],[-8,36],[-19,31],[-24,30],[-32,49],[-11,36],[3,42],[11,37],[16,87],[26,727],[-11,198],[-2,17]],[[2364,9174],[1,2],[35,14],[34,0],[14,-18],[1,-29],[-2,-36],[9,-38],[22,0],[25,25],[15,34],[1,18],[-4,12],[-2,12],[7,16],[8,1],[53,19],[24,-17],[22,-26],[27,-19],[35,6],[25,29],[4,35],[-2,37],[7,35],[26,27],[74,41],[30,27],[41,76],[89,271],[42,69],[211,202],[3,-19],[14,-19],[11,-55],[63,-102],[5,-17],[2,-37],[3,-18],[27,-44],[5,-10],[7,-30],[140,-244],[103,-276],[104,-205],[36,-151],[17,-35],[-18,-69],[27,-53],[41,-49],[20,-54],[8,-68],[13,-60],[44,-104],[7,-35],[5,-71],[7,-37],[24,-51],[8,-72],[7,-29],[49,-129],[32,-138],[-20,12],[30,-79],[8,-39],[3,-52],[-28,-33],[24,-81],[-6,-45],[-11,12],[2,-27],[15,-8],[16,-1],[8,-6],[-2,-61],[2,-17],[5,-16],[7,-14],[6,-15],[2,-22],[-2,-70],[2,-22],[5,-16],[14,-29],[2,-22],[-2,-21],[-9,-44],[0,-25],[46,-232],[6,-78],[5,-27],[35,-88],[52,-230],[29,-62],[89,-63],[13,-27],[12,-12],[54,-28],[15,-15],[1,-23],[-7,-20],[-9,-17],[-5,-19],[5,-21],[21,-26],[4,-14],[3,-47],[8,-29],[40,-52],[-26,-2],[-17,-18],[-6,-25],[9,-28],[6,15],[13,18],[17,8],[14,-16],[-3,-33],[-29,-16],[-33,-5],[-16,0],[4,-17],[27,-50],[6,-59],[4,-13],[21,-10],[34,-3],[33,5],[14,14],[11,21],[27,4],[30,-7],[22,-12],[36,-56],[78,-290],[6,-7],[28,-12],[6,-6],[4,-31],[9,-29],[12,-26],[16,-17],[-22,-97],[-8,-152],[4,-7],[14,-11],[3,-7],[5,-27],[14,-14],[20,-1],[21,12],[14,-33],[18,-5],[23,8],[32,6],[11,9],[8,21],[4,22],[-3,15],[-7,16],[6,12],[18,14],[28,59],[3,34],[-30,60],[-16,71],[-12,26],[-20,0],[-12,-27],[-10,-16],[-13,37],[-3,35],[3,91],[-2,20],[-7,33],[-2,20],[4,22],[8,7],[10,3],[8,11],[10,61],[10,17],[21,-18],[10,0],[2,15],[10,34],[9,0],[0,-6],[0,-17],[16,15],[20,38],[13,19],[22,-46],[30,-36],[141,-136],[22,-13],[34,-8],[12,-5],[15,-11],[17,-16],[12,-18],[4,-19],[-2,-19],[-11,-21],[-27,-25],[-13,-16],[-8,-17],[-23,-66],[17,1],[12,-4],[9,-11],[3,-18],[-4,-6],[-15,-6],[-2,-6],[2,-8],[7,-7],[2,-4],[8,-15],[35,-30],[8,-15],[4,-23],[19,-46],[7,-22],[-1,-20],[-4,-23],[-1,-23],[6,-20],[19,8],[20,-5],[16,-14],[7,-18],[3,-14],[6,-4],[7,-2],[4,-10],[-1,-17],[-8,-26],[-2,-13],[15,-31],[34,-20],[110,-46],[24,-13],[11,-10],[10,-33],[22,6],[34,33],[34,15],[23,36],[19,40],[21,29],[-2,-28],[5,-24],[14,-14],[24,6],[8,15],[-3,20],[3,18],[27,7],[16,1],[4,1],[15,-13],[-2,-6],[-3,-12],[3,-13],[18,-5],[11,-5],[4,-11],[6,-9],[14,-1],[10,6],[9,9],[7,11],[6,11],[-8,14],[-3,14],[0,33],[8,-8],[7,-20],[6,-8],[40,-12],[4,-15],[-1,-16],[0,-15],[7,-16],[12,-8],[5,1]],[[748,7219],[-1,5],[-21,33],[-24,28],[-19,31],[-10,41],[1,25],[18,70],[5,35],[-3,57],[2,32],[14,33],[22,24],[49,40],[16,25],[37,106],[6,106],[2,8],[11,14],[3,7],[-2,11],[-9,16],[-2,6],[3,72],[-4,22],[-12,22],[-16,17],[-5,20],[36,59],[7,34],[-5,34],[-30,47],[-3,16],[3,14],[0,1],[10,13],[30,5],[24,-12],[22,-18],[27,-13],[38,-7],[15,-7],[58,-40],[14,-3],[81,15],[22,-4],[45,4],[71,50],[43,4],[139,-45],[83,115],[13,35],[7,40],[32,66],[10,37],[7,74],[-2,32],[-16,81],[3,20],[16,11],[197,70],[60,10],[61,36],[64,133],[52,32],[31,-9],[44,-49],[34,-12],[36,9],[29,26],[46,68],[101,77]],[[4902,3794],[-67,-14],[-40,5],[-76,26],[-9,5],[-9,11],[-30,42],[-23,22],[-29,19],[-26,1],[-11,-36],[-27,-41],[-61,-34],[-121,-40],[-29,-2],[-80,16],[-37,-7],[-20,-22],[-33,-60],[-37,0],[-30,65],[-44,147],[-20,38],[-26,37],[-30,31],[-32,24],[-15,7],[-42,11],[-53,7],[-3,7],[-19,-22],[-2,-30],[2,-33],[-4,-32],[-21,-32],[-31,-23],[-62,-33],[-49,-52],[-27,-23],[-66,-7],[-89,-43],[-28,-7],[-28,-3],[-27,3],[-27,10],[-29,2],[-92,-56],[-55,-17],[-113,-15],[-74,1],[-12,-5],[-13,2],[-18,16],[-8,16],[-10,38],[-12,13],[-80,51],[-23,21],[-17,26],[-12,31],[-15,67],[-9,23],[-16,14],[-17,11],[-14,15],[-7,18],[-8,48],[-3,9]],[[6164,4590],[2,0],[9,6],[13,1],[27,-4],[15,-8],[6,-16],[5,-70],[5,-14],[43,-21],[-6,30],[12,10],[41,-3],[10,-8],[4,-16],[-7,-10],[-23,9],[-9,-12],[71,-85],[0,4],[6,3],[7,-3],[7,-15],[2,-14],[-2,-48],[-12,-40],[-1,-20],[13,-24],[38,-31],[12,-20],[1,-34],[15,11],[15,8],[15,1],[16,-7],[0,34],[35,-17],[79,4],[44,-28],[45,-38],[42,-14],[100,-4],[173,-46],[16,-8],[18,-27],[24,-65],[20,-30],[66,-54],[44,-35],[35,-51],[24,-61],[8,-65],[12,-28],[24,-17],[25,-13],[11,-15],[7,-14],[27,-39],[20,-71],[31,-43],[68,-70],[39,-52],[13,-25],[10,-32],[12,-57],[6,-21],[13,-20],[20,-18],[49,-35],[26,-25],[22,-32],[54,-119],[16,-73],[13,-27],[94,-33],[20,-1],[48,21],[18,3],[12,-9],[29,-58],[24,-29],[11,-7],[21,-6],[17,0],[33,10],[11,2],[26,-12],[52,-40],[19,-8],[17,-14],[8,-33],[4,-36],[7,-27],[61,-56],[10,-23],[6,0],[34,-54],[11,-25],[3,-2],[13,-7],[4,-3],[6,-20],[9,-39],[11,-19],[15,-5],[18,8],[16,10],[6,-1],[5,-11],[26,-21],[10,-11],[6,-16],[8,-41],[6,-15],[34,-30],[7,-2],[5,-24],[12,0],[9,11],[-1,6],[-7,7],[-22,32],[-5,11],[-3,3],[-4,3],[-4,6],[-1,13],[5,1],[21,-2],[5,1],[1,47],[-20,20],[-25,16],[-32,2],[-12,5],[4,10],[13,8],[20,1],[51,-48],[55,-86],[21,-11],[27,-20],[9,-43],[0,-72],[17,-59],[13,-27],[16,-11],[14,-20],[11,-45],[23,-205],[22,-42],[8,-86],[-2,-8],[4,-5],[46,-32],[31,-11],[68,-7],[28,6],[17,16],[11,23],[9,28],[20,-5],[5,-12],[1,-15],[5,-17],[9,-8],[10,-7],[8,-9],[4,-18],[11,-24],[75,-73],[52,-101],[19,-15],[30,-5],[24,-13],[21,-17],[17,-20],[11,-27],[15,-99],[24,-65],[6,-33],[4,-50],[5,-29],[11,-18],[21,-6],[20,7],[19,12],[21,10],[20,-48],[29,-29],[41,-14],[53,-4],[-7,-9],[-13,-28],[14,-1],[12,4],[14,10],[-1,2],[28,21],[4,1],[18,23],[13,25],[4,16],[0,12],[3,10],[14,9],[-9,18],[-2,17],[3,16],[8,12],[42,-38],[20,-23],[9,-19],[6,-18],[16,-15],[18,-14],[16,-14],[10,-23],[2,-53],[4,-27],[39,-84],[-9,-13],[-323,-162],[-15,-2],[-18,18],[-14,1],[-25,-25],[-34,-96],[-65,-72],[5,-52],[14,-56],[-8,-48],[-19,-11],[-44,-10],[-13,-16],[-20,-34],[-47,-15],[-7,-3],[-20,-33],[-233,241],[-68,36],[-40,12],[-26,-5],[-77,-96],[-71,87],[-121,193],[-97,193],[-71,71],[-82,54],[-85,41],[-116,87],[-78,127],[-115,292],[-47,92],[-51,78],[-58,70],[-113,109],[-156,149],[-258,192],[-200,150],[-45,52],[-105,216],[-116,238],[-157,208],[-155,206],[-91,75],[-101,44],[-134,22],[-42,16],[-157,88],[-87,52],[-101,109]]],"transform":{"scale":[0.0006730334115082135,0.000564537085808571],"translate":[36.423647095000035,12.3600218710001]}};
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
