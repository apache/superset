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
  Datamap.prototype.eriTopo = '__ERI__';
  Datamap.prototype.esbTopo = '__ESB__';
  Datamap.prototype.espTopo = {"type":"Topology","objects":{"esp":{"type":"GeometryCollection","geometries":[{"type":"MultiPolygon","properties":{"name":null},"id":"-99","arcs":[[[0]],[[1]],[[2]],[[3]],[[4]],[[5]]]},{"type":"Polygon","properties":{"name":"Álava"},"id":"ES.PV","arcs":[[6,7,8,9,10],[11]]},{"type":"Polygon","properties":{"name":"Albacete"},"id":"ES.CM","arcs":[[12,13,14,15,16,17,18]]},{"type":"Polygon","properties":{"name":"Alicante"},"id":"ES.VC","arcs":[[19,-13,20,21]]},{"type":"Polygon","properties":{"name":"Almería"},"id":"ES.AN","arcs":[[22,23,24]]},{"type":"Polygon","properties":{"name":"Asturias"},"id":"ES.AS","arcs":[[25,26,27,28]]},{"type":"Polygon","properties":{"name":"Ávila"},"id":"ES.CL","arcs":[[29,30,31,32,33,34,35,36]]},{"type":"Polygon","properties":{"name":"Badajoz"},"id":"ES.EX","arcs":[[37,38,39,40,41,42,43,44]]},{"type":"MultiPolygon","properties":{"name":"Baleares"},"id":"ES.PM","arcs":[[[45]],[[46]],[[47]],[[48]],[[49]]]},{"type":"Polygon","properties":{"name":"Barcelona"},"id":"ES.CT","arcs":[[50,51,52,53]]},{"type":"MultiPolygon","properties":{"name":"Burgos"},"id":"ES.CL","arcs":[[[-12]],[[54,55,56,57,58,59,60,-10],[61]]]},{"type":"Polygon","properties":{"name":"Cáceres"},"id":"ES.EX","arcs":[[-35,62,-42,63,64]]},{"type":"Polygon","properties":{"name":"Cádiz"},"id":"ES.AN","arcs":[[65,66,67]]},{"type":"MultiPolygon","properties":{"name":"Cantabria"},"id":"ES.CB","arcs":[[[68]],[[69,-60,70,71,-26,72]]]},{"type":"Polygon","properties":{"name":"Castellón"},"id":"ES.VC","arcs":[[73,74,75,76]]},{"type":"Polygon","properties":{"name":"Ceuta"},"id":"ES.CE","arcs":[[77]]},{"type":"MultiPolygon","properties":{"name":"Ciudad Real"},"id":"ES.CM","arcs":[[[78,-43]],[[79,-17,80,81,-45,82]]]},{"type":"Polygon","properties":{"name":"Córdoba"},"id":"ES.AN","arcs":[[83,84,85,86,-38,-82]]},{"type":"Polygon","properties":{"name":"Cuenca"},"id":"ES.CM","arcs":[[87,88,89,90,-18,-80,91,92,93]]},{"type":"MultiPolygon","properties":{"name":"Gerona"},"id":"ES.CT","arcs":[[[94]],[[-54,95,96]]]},{"type":"Polygon","properties":{"name":"Granada"},"id":"ES.AN","arcs":[[97,-24,98,99,-85,100,-15]]},{"type":"Polygon","properties":{"name":"Guadalajara"},"id":"ES.CM","arcs":[[101,102,-94,103,104,105]]},{"type":"Polygon","properties":{"name":"Gipuzkoa"},"id":"ES.PV","arcs":[[106,-7,107,108]]},{"type":"Polygon","properties":{"name":"Huelva"},"id":"ES.AN","arcs":[[109,110,-40]]},{"type":"Polygon","properties":{"name":"Huesca"},"id":"ES.AR","arcs":[[111,112,113,114]]},{"type":"Polygon","properties":{"name":"Jaén"},"id":"ES.AN","arcs":[[-101,-84,-81,-16]]},{"type":"Polygon","properties":{"name":"La Coruña"},"id":"ES.GA","arcs":[[115,116,117]]},{"type":"Polygon","properties":{"name":"La Rioja"},"id":"ES.LO","arcs":[[118,119,120,-55,-9]]},{"type":"MultiPolygon","properties":{"name":"Las Palmas"},"id":"ES.CN","arcs":[[[121]],[[122]],[[123]],[[124]]]},{"type":"Polygon","properties":{"name":"León"},"id":"ES.CL","arcs":[[-72,125,126,127,128,129,130,131,-27],[132]]},{"type":"Polygon","properties":{"name":"Lérida"},"id":"ES.CT","arcs":[[-96,-53,133,134,-112,135]]},{"type":"Polygon","properties":{"name":"Lugo"},"id":"ES.GA","arcs":[[-28,-132,136,137,-116,138]]},{"type":"MultiPolygon","properties":{"name":"Madrid"},"id":"ES.MD","arcs":[[[139,-31]],[[-93,140,-33,141,-104]]]},{"type":"Polygon","properties":{"name":"Málaga"},"id":"ES.AN","arcs":[[-100,142,-66,143,-86]]},{"type":"Polygon","properties":{"name":"Melilla"},"id":"ES.CE","arcs":[[144]]},{"type":"MultiPolygon","properties":{"name":"Murcia"},"id":"ES.MU","arcs":[[[145]],[[-20,146,-25,-98,-14]]]},{"type":"MultiPolygon","properties":{"name":"Navarra"},"id":"ES.NA","arcs":[[[147]],[[148]],[[-114,149,-119,-8,-107,150]]]},{"type":"Polygon","properties":{"name":"Orense"},"id":"ES.GA","arcs":[[-131,151,152,153,-137]]},{"type":"MultiPolygon","properties":{"name":"Palencia"},"id":"ES.CL","arcs":[[[-62]],[[-59,154,-126,-71]]]},{"type":"Polygon","properties":{"name":"Pontevedra"},"id":"ES.GA","arcs":[[-138,-154,155,-117]]},{"type":"Polygon","properties":{"name":"Salamanca"},"id":"ES.CL","arcs":[[156,-36,-65,157,158]]},{"type":"MultiPolygon","properties":{"name":"Santa Cruz de Tenerife"},"id":"ES.CN","arcs":[[[159]],[[160]],[[161]],[[162]]]},{"type":"Polygon","properties":{"name":"Segovia"},"id":"ES.CL","arcs":[[163,-105,-142,-32,-140,-30,164,-57]]},{"type":"Polygon","properties":{"name":"Sevilla"},"id":"ES.AN","arcs":[[-87,-144,-68,165,-110,-39]]},{"type":"Polygon","properties":{"name":"Soria"},"id":"ES.CL","arcs":[[166,-106,-164,-56,-121]]},{"type":"Polygon","properties":{"name":"Tarragona"},"id":"ES.CT","arcs":[[167,-74,168,169,-134,-52]]},{"type":"Polygon","properties":{"name":"Teruel"},"id":"ES.AR","arcs":[[-169,-77,170,-90,171,-88,-103,172]]},{"type":"Polygon","properties":{"name":"Toledo"},"id":"ES.CM","arcs":[[-92,-83,-44,-79,-63,-34,-141]]},{"type":"MultiPolygon","properties":{"name":"Valencia"},"id":"ES.VC","arcs":[[[-76,173,-21,-19,-91,-171]],[[-89,-172]]]},{"type":"MultiPolygon","properties":{"name":"Valladolid"},"id":"ES.CL","arcs":[[[174,-129]],[[-133]],[[-155,-58,-165,-37,-157,175,-127]]]},{"type":"Polygon","properties":{"name":"Bizkaia"},"id":"ES.PV","arcs":[[-108,-11,-61,-70,176],[-69]]},{"type":"Polygon","properties":{"name":"Zamora"},"id":"ES.CL","arcs":[[-175,-128,-176,-159,177,-152,-130]]},{"type":"Polygon","properties":{"name":"Zaragoza"},"id":"ES.AR","arcs":[[-135,-170,-173,-102,-167,-120,-150,-113],[-148],[-149]]}]}},"arcs":[[[6163,4662],[-1,-1],[-1,1],[1,0],[1,0]],[[6988,4666],[-1,-2],[-2,1],[1,1],[1,1],[1,-1]],[[6998,4666],[-2,-2],[-1,2],[1,2],[2,-2]],[[6994,4668],[-2,-2],[-2,1],[0,3],[3,0],[1,-2]],[[5666,5121],[-1,-2],[-1,0],[-1,2],[1,1],[2,-1]],[[6723,5140],[-1,-1],[-1,0],[1,1],[1,0]],[[6941,9562],[6,-25],[-1,-8],[-3,-5],[-21,-10],[-3,-4],[-3,-13],[19,-12],[2,0],[2,1],[5,5],[2,0],[2,-2],[12,-6],[66,-6],[20,-13],[8,-14],[4,-4],[13,0]],[[7071,9446],[6,-26],[0,-5],[-1,-7],[-10,-16],[-5,-14],[-1,-9],[0,-10],[-1,-5],[-2,-4],[-12,-5],[-4,-5],[0,-5],[4,-24],[2,-1],[5,-2],[1,-3],[0,-6],[-2,-3],[-14,-9],[-4,-2],[-4,-1],[-8,0],[-3,2],[-4,7],[-2,2],[-2,1],[-4,1],[-4,0],[-4,-1],[-9,-8],[-6,-6],[-9,-8],[-3,-2],[-7,-6],[0,-5],[0,-4],[2,-3],[3,-3],[4,0],[7,-4],[3,-2],[4,2],[9,12],[4,0],[3,-1],[2,-4],[1,-4],[2,-12],[-4,-32],[-1,-10]],[[7003,9196],[-9,2],[-16,5],[-13,8],[-4,11],[-5,-2],[-3,-3],[-2,-3],[-3,-5],[1,-1],[1,-1],[0,-1],[1,-1],[-8,1],[-7,-1],[-7,-3],[-5,-6],[-1,10],[-4,3],[-5,0],[-2,-2],[-3,-4],[-7,3],[-15,13],[-4,2],[-4,1],[-1,9],[0,9],[1,5],[0,4],[-2,5],[-4,5],[-16,11],[-6,2],[-6,-3],[-4,-3],[-1,-5],[-3,-10],[-6,1],[-6,-3],[-3,-1],[-3,2],[-3,4],[0,4],[5,6],[1,3],[-1,6],[-6,-4],[-3,4],[-1,8],[0,6]],[[6811,9287],[-2,8],[-4,6],[-30,25],[-11,5],[-11,14],[-7,4],[-8,6],[-13,12],[-14,8],[-14,-7],[-11,-3],[-2,0],[-6,0],[2,5],[2,5],[-3,5],[-3,3],[-3,3],[-1,4],[0,5],[1,5],[3,5],[5,7],[5,8],[3,6],[1,7],[-2,5],[-3,2],[-4,-1],[-6,-9],[-3,-4],[-4,-2],[-8,0],[-4,-1],[-4,-2],[-3,-3],[-2,-4],[-2,-3],[1,-4],[-1,-3],[-3,-2],[-3,2],[-3,2],[-13,18],[-7,6],[-1,4],[0,4],[2,4],[2,4],[6,7],[5,8],[2,4],[3,5],[4,3],[16,2],[6,-1],[4,-2],[4,-2],[3,-3],[2,-8],[2,-3],[4,-2],[4,-1],[9,-2],[4,-1],[4,-1],[5,0],[7,2],[9,0],[4,1],[3,3],[6,5],[4,0],[6,2],[2,2],[1,3],[1,3],[0,3],[-3,4],[-12,5],[-6,4],[-4,5],[-3,3],[1,6],[5,-1],[8,2],[3,0],[1,0],[1,1],[2,2],[2,4],[1,5],[-1,4],[-4,4],[-8,3],[-3,3],[0,4],[0,3],[-3,3],[-3,2],[-9,-5],[-8,-18],[-5,-2],[-3,1],[-13,1],[-14,4],[-3,2],[-2,2],[2,4],[2,4],[3,7],[0,15],[3,11],[0,7],[-3,5],[-7,3],[-3,4],[-1,5],[4,10],[2,5],[8,6]],[[6676,9610],[11,-9],[6,-3],[27,6],[5,3],[3,6],[1,13],[3,6],[7,3],[7,-2],[6,-6],[9,-12],[7,-16],[-1,-7],[-8,-17],[-1,-8],[4,-7],[24,-23],[14,1],[5,-1],[10,-6],[21,-7],[19,4],[18,-7],[5,0],[9,4],[12,-3],[1,0],[2,1],[2,7],[-3,7],[-10,14],[0,2],[0,2],[9,6],[7,1],[10,-4],[24,4]],[[6944,9287],[6,1],[4,3],[1,2],[0,8],[-2,5],[0,4],[-2,4],[-1,2],[-3,-1],[-3,-2],[-4,-5],[-2,-1],[-3,-1],[-3,0],[-3,2],[-4,7],[-2,2],[-3,3],[-2,2],[-2,3],[1,3],[1,2],[2,2],[5,2],[3,1],[2,3],[4,8],[0,3],[2,3],[0,5],[-1,2],[-5,0],[-4,1],[-3,2],[-3,3],[-2,3],[-2,1],[-3,0],[-4,-1],[-4,-1],[-6,1],[-27,9],[-6,3],[-5,1],[-12,1],[-28,-2],[-5,-1],[-3,-3],[-9,-14],[-6,-8],[-1,-4],[2,-5],[11,-12],[12,-9],[27,-13],[30,-7],[23,-10],[34,-1],[3,-1],[2,-1],[1,-2],[2,-2]],[[7658,6899],[-4,-4],[-4,-1],[-1,-5],[-1,-4],[2,-12],[3,-8],[4,-7],[3,-3],[5,-8],[3,-4],[3,-4],[0,-3],[-3,-2],[-13,-11],[-8,-3],[-9,-1],[-11,0],[-2,1],[-7,-2]],[[7618,6818],[-25,20],[-12,12],[-2,4],[-1,4],[0,5],[-1,4],[-3,4],[-3,2],[-16,5],[-5,1],[-26,-7],[-4,-3],[-5,-4],[-11,-12],[-25,-15],[-5,-1],[-3,3],[-2,3],[-3,4],[-3,0],[-7,-3],[-7,-8],[-14,-18],[-7,-17],[-2,-10],[0,-4],[0,-10],[-2,-4],[-3,-4],[-5,-4],[-4,-4],[-5,-11],[-1,-3],[-1,-3],[0,-4],[0,-4],[1,-2],[2,-4],[2,-8],[2,-10],[1,-20],[0,-10],[2,-15],[0,-5],[0,-5],[-1,-4],[-2,-5],[-4,-5],[-32,-29],[-27,-9],[-4,0],[-4,1],[-4,1],[-6,3],[-3,2],[-2,3],[-1,3],[-1,3],[-1,3],[1,3],[1,4],[0,3],[-1,3],[-1,2],[-2,3],[-3,1],[-3,1],[-7,-2],[-2,2],[-6,3],[-3,1],[-3,0],[-4,-2],[-3,-1],[-3,-4],[-6,-1],[-2,0],[-1,-2],[0,-3],[-1,-4],[-23,-15],[-17,-14],[-11,-7],[-7,-2],[-14,-3],[-12,-5],[-3,0],[-3,2],[-8,8],[-3,2],[-4,1],[-5,-1],[-7,-5],[-11,-15],[-19,-19],[-5,-3],[-9,-2],[-5,-2],[-6,-4],[-13,-13],[-4,-8],[-13,-29],[-13,-21],[-17,-21],[-3,-4],[-6,-22]],[[7033,6429],[-6,-2],[-4,0],[-47,16],[-36,19]],[[6940,6462],[5,8],[6,7],[3,5],[4,8],[28,39],[1,5],[-1,5],[-2,8],[0,3],[1,2],[2,2],[2,3],[1,3],[1,4],[0,5],[1,4],[0,4],[-1,4],[-3,6],[-14,10],[-3,6],[-1,6],[0,5],[0,10],[-1,9],[-1,5],[-1,4],[-1,5],[1,9],[-1,3],[-30,10],[-5,5],[-2,3],[-1,4],[1,5],[1,4],[0,9],[-1,4],[-1,9],[2,7],[0,2],[-1,1],[-1,1],[-3,2],[-8,3],[-12,1],[-7,-1],[-6,-2],[-9,-4],[-19,9],[-17,11]],[[6847,6742],[4,9],[-8,17],[7,19],[4,7],[6,5],[22,7],[4,8],[11,36],[0,12],[-3,10],[-14,21],[-22,9],[-8,13],[-5,43],[-17,16],[-21,-1],[-10,4],[-6,12],[1,9],[33,67],[0,9],[-1,10],[-15,31],[53,83],[-8,30]],[[6854,7228],[35,3],[19,11],[23,-8],[17,0],[8,9],[61,-67],[11,28],[13,3],[14,-35],[54,33],[53,-8],[-19,57],[31,-5],[-4,-8],[18,-28],[46,7],[18,-11],[34,-4],[13,25],[106,63]],[[7405,7293],[6,-2],[1,-2],[2,-4],[2,-2],[3,-1],[1,-2],[1,-3],[4,-1],[2,-3],[0,-3],[1,-4],[0,-3],[2,-4],[2,-1],[2,1],[4,-1],[3,1],[2,2],[4,0],[10,-4],[20,-14],[4,-2],[4,0],[5,-1],[59,-20],[2,-5],[1,-5],[-2,-5],[-1,-4],[-1,-10],[1,-5],[0,-4],[0,-5],[-1,-9],[-1,-5],[-1,-3],[-1,-4],[-2,-6],[-1,-4],[-4,-9],[-3,-4],[-3,-3],[-5,-8],[-2,-4],[-3,-9],[-2,-5],[-4,-9],[-2,-4],[0,-4],[-2,-5],[-1,-5],[1,-6],[2,-10],[3,-6],[43,-55],[8,-7],[6,-3],[12,0],[12,3],[13,0],[8,2],[7,5],[2,1],[4,0],[4,-1],[5,-2],[5,-4],[14,-27],[3,-6],[0,-5],[-3,-9],[0,-5],[6,-19],[1,-3],[-2,-4],[-1,-3],[-1,-10],[-5,-4]],[[7734,6317],[-8,-2],[-4,1],[-2,1],[-2,3],[-3,3],[-4,3],[-8,2],[-4,3],[-18,21],[-4,3],[-12,16],[-3,5],[-5,12],[-6,10],[-3,5],[-5,9],[0,1],[-7,16],[-10,16],[-1,3],[-3,3],[-3,4],[-3,6],[-2,11],[-1,13],[2,11],[3,7],[12,21],[4,9],[1,5],[3,19],[1,5],[2,11],[0,7],[-6,25],[-5,9],[-2,2],[-6,4],[-16,6],[-9,1],[-3,2],[-2,6],[-2,9],[0,26],[1,9],[3,7],[3,5],[17,17],[3,4],[2,4],[1,5],[-1,14],[2,10],[4,17],[0,16],[-7,40]],[[7658,6899],[7,-8],[3,-2],[5,0],[9,3],[5,0],[4,-3],[12,-15],[6,-3],[31,8],[8,-1],[35,-21],[7,-10],[9,-5],[48,30],[-6,9],[-6,3],[-6,0],[-8,-4],[-14,25],[80,15],[47,38],[36,-17],[88,18]],[[8058,6959],[10,-8],[12,-4],[20,-2],[21,-6],[19,-12],[14,-17],[-2,-1],[-4,-4],[5,-2],[4,-5],[12,-10],[4,1],[3,-7],[0,-10],[-3,-5],[-8,0],[-8,-2],[-6,-4],[-7,-7],[-5,-13],[-1,-2],[-2,-2],[-8,0],[-3,-2],[-6,-6],[-5,-3],[-5,-4],[-5,-10],[4,-9],[-9,2],[-6,-1],[-6,-3],[-8,-2],[-14,0],[-6,-2],[-6,-6],[-5,-10],[-1,-9],[1,-9],[-3,-8],[-7,-8],[-6,-3],[-19,0],[-20,-5],[-11,-5],[-14,-11],[-42,-20],[-7,-5],[-3,-7],[-3,-3],[-17,-19],[-4,-10],[-2,-12],[0,-6],[-2,-3],[-14,-1],[-6,-2],[-5,-5],[-2,-9],[-16,1],[-4,-25],[7,-56],[-5,-8],[-8,-2],[-16,2],[-10,-3],[-8,-7],[-6,-10],[-5,-10],[-3,-9],[-2,-10],[-1,-26],[-2,-41],[-1,-11],[-4,-6],[-12,-5],[-8,-10],[-4,-8],[-18,-49],[-1,-10],[0,-1]],[[7343,6029],[-2,-7],[-3,-5],[-8,1],[-5,-5],[-2,-11],[-6,-13],[-13,-21],[-26,-29],[-11,-18],[-8,-25],[-4,-21],[-5,-17],[-2,-17],[-14,-38],[-9,-17],[0,-8],[1,-6],[2,-4],[0,-6],[0,-5],[-3,-3],[-3,-2],[-10,-1],[-3,-1],[-5,-6],[-16,-12],[-6,-9],[-4,-25],[-6,-8],[-7,-5],[-7,-9],[-2,-5],[-2,-12],[-2,-5],[-4,-3],[-5,-1],[-4,-2],[-5,-12],[-7,-6],[-9,-4],[-8,-1],[-17,6],[-13,14],[-10,17],[-12,14],[-16,11],[-9,4],[-10,1],[-9,-2],[-14,-8],[-9,-2],[-4,1],[-12,6],[-6,1],[-35,-7],[-7,-5],[-9,-23],[-9,-28],[-11,-13],[-2,-2],[-5,-6],[-12,-5],[-15,-3],[-8,4],[-9,-5],[-12,9],[-8,8],[-8,4],[-4,-1],[-4,-6],[-5,-1],[-4,3],[-12,18],[-13,10],[-8,1],[-25,-9],[-39,7],[-23,-2]],[[6682,5636],[-5,26],[49,35],[-6,21],[-4,6],[-6,4],[-3,5],[2,7],[31,35],[3,10],[-1,8],[-7,23],[-3,20],[2,10],[6,6],[16,1],[4,3],[4,7],[3,19],[4,9],[5,3],[10,5],[4,5],[11,51],[3,4],[3,2],[5,1],[14,-2],[4,-4],[11,-15],[6,-4],[21,-2],[22,-10],[-2,44],[0,4],[4,9],[1,5],[2,35],[3,9],[68,65],[58,21],[-8,55],[27,6],[-3,47],[4,11],[11,19],[3,11],[-4,35],[2,28],[3,6],[4,4],[27,21]],[[7090,6360],[17,-12],[21,2],[5,-2],[16,-9],[42,-7],[3,-3],[0,-3],[-5,-8],[-2,-4],[-1,-5],[0,-11],[0,-3],[-3,-10],[-1,-4],[1,-22],[2,-6],[0,-4],[-1,-9],[-2,-6],[-1,-5],[0,-9],[0,-5],[0,-11],[2,-6],[2,-4],[4,-5],[66,-114],[5,-6],[4,-2],[3,-2],[3,-1],[1,2],[0,4],[2,2],[2,0],[23,-6],[4,-1],[41,-36]],[[6066,9757],[0,-4],[1,-7],[-4,-9],[-6,-10],[-1,-4],[1,-3],[2,-3],[4,-11],[1,-9],[0,-6],[-2,-5],[-3,-4],[-3,-3],[-4,0],[-2,2],[-3,7],[-3,2],[-8,2],[-5,0],[-4,0],[-7,-5],[-3,-3],[-2,-4],[-2,-2],[-4,-2],[-9,-1],[-5,1],[-4,0],[-4,0],[-5,-1],[-5,-3],[-3,-4],[-1,-4],[1,-9],[-1,-4],[0,-4],[-1,-5],[-1,-6],[-3,-6],[-3,-3],[-4,0],[-9,1],[-4,0],[-4,-2],[-14,-2],[-5,1]],[[5925,9625],[-12,21],[-9,7],[-4,2],[-4,0],[-5,0],[-23,-13],[-7,-7],[-14,-8],[-17,-5],[-8,-4],[-4,-3],[-4,-9],[-2,-4],[-1,-5],[-3,-10],[-3,-5],[-7,-7],[-5,-1],[-5,2],[-4,2],[-4,0],[-24,-12],[-42,-5],[-24,3],[-6,-1],[-4,-2],[-3,-14],[-4,-4],[-4,-2],[-5,-1],[-24,-1],[-2,-3],[-1,-4],[-2,-3],[-3,-3],[-3,-1],[-8,1],[-11,-5],[-5,0],[-4,1],[-4,2],[-4,3],[-10,2],[-6,0],[-10,2],[-12,7],[-7,1],[-11,-1],[-6,-2],[-5,-3],[-2,-4],[-2,-4],[-2,-4],[-3,-3],[-2,-4],[-1,-4],[-1,-1],[0,-2],[-1,-3],[-2,-4],[-2,-4],[-4,-4],[-4,-1],[-7,-1],[-18,0],[-4,2],[-4,2],[-12,5],[-2,3],[-5,1],[-6,4],[-5,5],[-11,7],[-2,3],[-2,4],[-2,5],[-1,9],[-2,4],[-5,2],[-13,-3],[-6,1],[-22,4],[-4,-2],[-1,-3],[-1,-5],[-1,-4],[-3,-5],[-9,-4],[-6,0],[-6,1],[-12,5],[-11,2],[-5,-1],[-3,-3],[-1,-9],[-2,-3],[-4,0],[-9,2],[-19,10],[-6,0],[-8,2],[-4,4],[-4,3],[-8,2],[-12,-6],[-3,-4],[-1,-4],[-4,-4],[-2,-4],[0,-4],[0,-3],[-2,-3],[-3,-2],[-9,-3],[-13,0],[-2,-3],[-1,-3],[2,-4],[4,-2],[8,-3],[3,-2],[-1,-4],[-1,-4],[-24,-14],[-6,0],[-16,-7],[-5,-1],[-20,2],[-3,2],[-4,2],[-5,1],[-21,0],[-8,-2],[-9,-3],[-4,-3],[-4,-3],[-3,-4],[-3,-4],[-5,-3],[-3,1],[-3,6],[-8,5],[-15,2]],[[5038,9455],[-2,23],[-2,7],[-4,5],[-10,11],[-4,1],[-8,0],[-4,1],[-4,2],[-4,3],[-1,1],[-9,14],[-3,0],[-1,0],[0,-12],[0,-2],[-1,-1],[0,-1],[-2,-2],[-2,-1],[-4,3],[-4,6],[-2,7],[1,7],[3,3],[4,2],[3,2],[2,5],[2,6],[1,4],[1,3],[2,3],[3,2],[3,1],[4,-1],[4,1],[16,7],[4,2],[17,15],[0,6],[-1,6],[-7,12],[-4,7],[-4,3],[-3,0],[-3,-3],[-2,-3],[-1,-4],[-2,-3],[-3,-3],[-4,-2],[-9,-5],[-7,-3],[-4,1],[-3,3],[-3,3],[-2,5],[-2,4],[1,6],[3,9],[0,4],[0,4],[-3,2],[-3,1],[-7,3],[-5,7],[-3,0],[-4,1],[-10,8],[-3,4],[-2,4],[-3,7],[-4,26],[-3,3],[-4,3],[-3,1],[-6,6],[-3,5],[-3,6],[-2,7],[0,6],[0,5],[0,5],[-2,3],[-3,2],[-7,0],[-6,3],[-2,3],[0,3],[1,13],[1,4],[2,3],[6,2],[5,0],[4,-2],[3,0],[4,1],[3,2],[5,4],[6,10],[13,13],[1,1],[1,3]],[[4941,9807],[1,-3],[3,0],[2,11],[2,10],[2,8],[6,5],[4,14],[26,6],[43,2],[7,-2],[27,2],[18,-6],[11,-1],[25,13],[23,-2],[22,-8],[16,-9],[5,3],[5,1],[11,0],[0,3],[-2,7],[0,3],[6,-1],[10,-6],[7,-2],[22,5],[23,0],[7,1],[11,6],[11,2],[3,4],[3,3],[6,1],[14,-11],[6,-2],[34,-4],[7,4],[7,-4],[7,4],[7,5],[7,3],[51,0],[3,6],[-3,4],[-2,5],[5,7],[-1,2],[-1,4],[-1,2],[15,0],[5,3],[2,7],[3,6],[7,0],[14,-7],[10,-9],[24,-29],[8,-13],[4,0],[2,9],[3,-3],[5,-11],[23,-4],[90,4],[13,-3],[2,-9],[-6,-10],[-8,-7],[3,-5],[5,3],[9,3],[5,3],[3,4],[1,4],[3,3],[6,1],[19,-1],[7,-3],[32,-22],[15,-5],[39,-2],[10,-3],[5,-8],[5,3],[31,-9],[4,1],[6,6],[6,1],[4,-2],[10,-5],[32,-7],[36,-17],[9,-3],[98,-9]],[[5983,8366],[-5,-40],[6,-14],[25,-24],[5,-8],[9,-25],[4,-5],[5,-4],[7,-3],[3,-2],[2,-5],[2,-19],[6,-24],[-1,-8],[-6,-14],[1,-6],[6,-4],[16,5],[7,-1],[3,-4],[2,-5],[1,-12],[3,-9],[9,-12],[4,-7],[11,-73],[34,8],[10,7]],[[6152,8058],[28,2],[-8,19]],[[6172,8079],[7,4],[6,1],[27,-3],[11,-5]],[[6223,8076],[-3,-12],[0,-4],[-1,-10],[0,-10],[-2,-4],[-4,-4],[-5,-2],[-5,-1],[-7,-4],[-9,-1],[-4,1],[-4,1],[-3,3],[-3,7],[-2,3],[-3,0],[-2,-4],[0,-5],[1,-5],[1,-4],[1,-5],[-1,-4],[-2,-7],[0,-2],[-2,-2],[-1,-2],[-4,-2],[-3,-4],[-3,-6],[0,-6],[0,-5],[0,-9],[1,-4],[0,-3],[-1,-3],[0,-8],[1,-4],[1,-4],[-1,-4],[-2,-5],[-3,-14],[2,-8],[-1,-4],[-4,-2],[-13,-1],[-3,-2],[-2,0],[-2,1],[-3,1],[-4,1],[-3,0],[-2,-1],[-3,-1],[-2,-2],[-4,-5],[-2,-3],[-1,-11],[-1,-3],[0,-5],[-2,-6],[-4,-9],[-4,-6],[-5,-3],[-4,-2],[-8,-1],[-2,1],[-3,3],[-4,8],[-4,2],[-3,0],[-2,-3],[0,-5],[0,-5],[3,-8],[0,-5],[0,-4],[-3,-4],[-6,-13],[-3,-21],[-6,-10]],[[6041,7782],[-14,-6],[-10,-3],[-6,0],[-6,1],[-9,5],[-3,2],[-2,4],[-1,4],[-2,15],[-2,4],[0,5],[0,4],[-2,4],[-5,0],[-10,-3],[-21,-3],[-9,0],[-3,-3],[-2,-9],[0,-4],[-1,-6],[-6,-8],[-7,-7],[-10,-6],[-4,-4],[-8,-5],[-5,-5],[-4,-7],[0,-5],[-2,-5],[-2,-4],[-3,-3],[-10,-7],[-7,-3],[-10,-3],[-6,2],[-2,3],[-3,18],[-3,3],[-5,-1],[-11,-3],[-6,-4],[-3,-3],[-4,-5],[-2,-2],[-18,-15],[-2,-2],[-2,-3],[-5,-2],[-7,-1],[-10,0],[-5,4],[-13,6],[-43,6]],[[5705,7722],[-8,14],[-2,4],[-2,4],[-3,9],[-2,27],[1,5],[1,5],[5,12],[0,4],[-2,3],[-8,-1],[-23,-7],[-15,-14],[-3,-3],[-6,-7],[-4,-2],[-3,-1],[-3,-1],[-17,0],[-17,6],[-12,7],[-10,16],[-14,13],[-13,10],[-18,8]],[[5527,7833],[21,33],[2,7],[1,7],[-3,9],[-5,12],[-1,6],[3,6],[31,27],[12,4],[5,-1],[2,-3],[1,-12],[10,-13],[7,-5],[6,0],[5,6],[-3,17],[17,2],[5,6],[3,7],[10,42],[-33,0],[-2,21],[2,0],[29,3],[15,8],[12,12],[10,34],[53,41],[12,20],[17,12],[8,16],[1,7],[-2,24],[23,29],[-7,24],[10,12],[3,8],[1,10],[-2,11],[-2,5],[-3,4],[-3,2],[-9,2],[-3,3],[-1,3],[-2,20],[3,11],[9,19]],[[5795,8351],[8,6],[6,2],[15,-4],[18,13],[9,1],[11,-3],[39,-31],[13,-5],[9,4],[19,20],[41,12]],[[5834,6863],[-12,-2],[-7,-3],[-35,-1],[-5,-3],[-1,-3],[1,-5],[1,-4],[-2,-7],[-1,-4],[-1,-3],[-2,-3],[-13,-5],[-20,-15],[-15,-13],[-2,-4],[-2,-2],[-1,-3],[-1,-3],[0,-2],[-2,-3],[-2,-1],[-2,0],[-6,1],[-9,0],[-6,-1],[-7,-8],[-3,-3],[-4,-7],[-2,-4],[-2,-3],[-1,-4],[-1,-3],[-1,-5],[-4,-5],[-13,-10],[-1,0],[-6,-7],[-3,-4],[-4,-8],[-4,-3],[-7,-3],[-20,-12],[-5,-5],[-4,-4],[-2,-13],[-1,-3],[1,-4],[1,-2],[4,-5],[1,-3],[1,-3],[-1,-3],[-1,-7],[-1,-3],[-1,-7],[0,-2],[2,-3],[2,-2],[2,-3],[2,-2],[1,-3],[1,-3],[2,-7],[1,-3],[2,-3],[1,-3],[4,-9],[1,-2],[-1,-5],[1,-5],[1,-4],[0,-5],[1,-4],[0,-5],[-2,-8],[-3,-5],[-1,-4],[-2,-9],[0,-4],[0,-4],[-2,-3],[-19,-17]],[[5592,6496],[-19,1],[-8,-6],[-3,-4],[-10,-10],[-10,-8],[-7,-2],[-5,1],[-3,3],[-3,13],[0,5],[0,4],[3,3],[3,2],[4,2],[7,4],[2,4],[-1,3],[-2,4],[-7,9],[-6,5],[-6,1],[-29,-4],[-14,-6],[-4,-3],[-3,-4],[-3,-8],[-3,-3],[-3,-3],[-12,-8],[-4,-4],[-2,-4],[-2,-5],[-2,-4],[0,-4],[2,-4],[2,-4],[2,-4],[0,-4],[-2,-5],[-7,-11],[-2,-3],[0,-3],[-1,-4],[-2,-4],[-5,-7],[-4,-3],[-6,-2],[-19,-5],[-9,-1],[-34,-7],[-11,-6],[-13,-12],[-6,-6]],[[5325,6375],[-8,8],[-58,26],[-11,3],[0,1],[-2,3],[0,5],[-2,4],[-3,7],[-18,14],[-5,2],[-5,0],[-4,-1],[-3,-3],[-1,-3],[-3,-4],[-6,-6],[-3,-3],[-1,-4],[-1,-1],[-7,-1],[-11,4],[-21,1],[-3,3],[-1,4],[1,5],[-1,4],[-2,5],[-8,12],[-6,6],[-6,3],[-6,1],[-15,2],[-11,-2],[-21,0],[-12,5],[-5,3],[-6,2],[-4,2],[-1,4],[0,4],[3,9],[2,3],[3,4],[1,4],[0,5],[-2,4],[-61,23],[-7,-7]],[[4984,6535],[-6,5],[-13,-1],[-11,-4],[-2,0],[-2,1],[-5,-8],[-11,-6],[-11,-2],[-7,0],[-6,6],[-5,5],[-18,50],[-2,3],[-7,6],[-3,3],[-2,4],[-3,8],[-2,4],[-47,66],[-13,10],[-6,4],[7,7],[4,7],[0,7],[-5,8],[5,8],[8,31],[18,29],[3,9],[-2,5],[-2,2],[-3,2],[-3,3],[0,5],[0,7],[0,14],[4,21],[1,4],[4,9],[1,2],[19,18],[7,5],[6,3],[8,7],[6,8],[2,6],[5,4],[20,4],[7,4],[6,6],[5,5],[4,3],[-1,9],[3,9],[-7,12],[10,9],[10,15],[15,32],[4,6],[3,6],[-1,6],[-5,4],[3,11],[-3,12],[-6,11],[-7,7],[-10,8],[-12,4],[-12,-2],[-10,-7],[-6,-2],[-7,1],[-6,4],[-5,5],[0,5],[5,12],[1,6],[-6,12],[-10,5],[-13,4],[-11,7],[-6,9],[-3,13],[0,13],[6,11]],[[4850,7199],[21,-3],[21,30],[1,3],[-1,4],[-5,6],[-1,5],[1,2],[2,7],[1,2],[19,12],[10,2],[10,-2],[-2,-28],[2,-12],[9,-3],[4,2],[2,4],[8,33],[0,5],[-1,4],[-2,4],[-3,3],[-14,9],[8,14],[71,-33],[8,-1],[17,4],[8,0],[7,-7],[8,-22],[9,-8],[4,-16],[-5,-15],[-17,-24],[10,-25],[4,-6],[39,-8],[10,14],[33,-11],[2,-2],[1,-2],[1,-5],[1,-3],[2,-2],[2,-2],[5,-1],[4,1],[4,8],[3,3],[70,-7],[23,14],[1,-34],[2,-9],[9,-9],[19,-1],[9,-6],[8,-14],[3,-4],[4,-1],[10,1],[2,-1],[12,-17],[23,33],[31,26],[4,-36],[1,-2],[3,-1],[7,1],[20,27],[8,-16],[29,12],[13,10],[8,16],[19,-5],[35,-33],[19,12],[14,-1],[6,3],[5,7],[6,13],[0,6],[-13,23],[-3,2],[21,13],[11,3],[10,-3],[22,-24],[11,-7],[15,3],[6,5],[11,14],[11,21],[1,5],[-1,4],[-3,8],[0,4],[2,24],[4,14],[9,3],[33,-12],[30,0],[17,11],[8,8],[2,5],[1,5],[0,13],[1,6],[7,7],[6,-4],[12,-18],[29,5],[21,13]],[[5875,7274],[29,-15],[11,7],[2,0],[3,1],[3,2],[10,5],[16,5],[5,3],[6,8]],[[5960,7290],[22,13],[5,7]],[[5987,7310],[7,-20],[-2,-11],[-7,-13],[-6,-22],[-4,-5],[-5,-4],[-4,-1],[-4,-2],[-4,-5],[1,-6],[1,-5],[8,-23],[8,-15],[1,-3],[2,-4],[5,-5],[13,-16],[5,-11],[-6,0],[-2,1],[-15,8],[-4,3],[-3,2],[-8,2],[-8,-3],[-4,0],[-4,0],[-8,3],[-4,0],[-3,-3],[-2,-4],[-3,-4],[-6,-7],[-4,-3],[-1,-4],[-2,-7],[-6,-26],[0,-9],[2,-6],[3,-3],[7,-5],[3,-4],[1,-5],[-1,-4],[-11,-7],[-4,-2],[-4,0],[-8,3],[-11,7],[-4,1],[-4,1],[-4,-1],[-3,-3],[0,-4],[1,-5],[2,-4],[0,-5],[1,-5],[2,-3],[3,-2],[1,0],[0,-1],[1,-5],[0,-4],[0,-5],[2,-4],[2,-4],[3,-3],[15,-4],[3,-2],[12,-2],[2,-4],[2,-7],[-2,-9],[-2,-13],[-2,-4],[-4,0],[-12,2],[-4,-1],[-4,-1],[-4,-2],[-3,-4],[-3,-4],[-7,-13],[-2,-6],[-11,-43],[-4,-13],[-5,-6],[-3,-2],[-2,-1],[-3,1],[-5,-1],[-7,-4]],[[8711,6876],[21,-34],[18,-10],[18,8],[7,-10],[0,-13],[-11,-3],[-15,0],[-22,16],[-7,4],[-9,-7],[-4,-3],[-7,-11],[-7,-5],[-7,2],[2,12],[-1,5],[0,7],[2,4],[2,5],[0,5],[-3,2],[-2,3],[3,5],[5,6],[4,-3],[4,2],[4,7],[2,10],[2,0],[0,-1],[0,-1],[1,-2]],[[8773,7096],[5,-1],[4,-3],[4,-4],[-3,-6],[3,-12],[7,-20],[-7,-1],[-6,-5],[-4,-8],[-1,-10],[-3,-3],[-15,-12],[-14,-23],[-6,-5],[-12,-7],[-5,-6],[-2,2],[-2,3],[-2,3],[-7,-11],[-6,-3],[-5,-21],[-1,-15],[-14,-1],[-4,13],[-8,6],[-7,-3],[-3,0],[-1,1],[-1,1],[-4,-2],[-3,8],[-8,3],[-7,-3],[-3,-8],[-14,11],[-5,6],[-2,12],[5,14],[1,10],[-4,7],[4,4],[5,3],[5,1],[5,-4],[3,3],[4,2],[11,-1],[-4,27],[0,14],[6,6],[5,3],[7,6],[11,13],[3,0],[4,-4],[8,7],[5,-3],[9,8],[13,6],[12,4],[9,-2],[4,6],[7,3],[6,0],[7,-7],[3,-1],[8,-1]],[[9397,7118],[-9,-15],[-14,2],[-7,21],[11,12],[18,8],[2,-12],[-1,-16]],[[9485,7631],[6,-8],[2,2],[1,1],[6,-3],[-5,-4],[-15,-8],[-6,-1],[-6,-4],[-6,-7],[-6,-5],[-5,3],[-3,0],[-1,-20],[16,-3],[34,10],[0,-4],[-5,-3],[0,-4],[0,-5],[-1,-4],[-3,-4],[-2,-1],[-8,-4],[-14,-4],[-3,-5],[-1,-12],[6,-14],[11,-12],[14,-9],[13,-3],[31,0],[8,3],[13,15],[6,3],[13,-4],[25,-16],[16,-1],[-3,-7],[0,-5],[2,-5],[1,-5],[-2,-3],[-3,-2],[-1,-4],[3,-8],[-6,-17],[-5,-9],[-6,-3],[-8,-3],[-5,-8],[-1,-9],[3,-10],[-18,-18],[-18,-24],[-14,-30],[-5,-34],[-4,2],[-2,2],[-7,-25],[-14,-17],[-41,-27],[-17,-16],[-3,-6],[-2,-2],[-4,-3],[-4,-2],[-2,2],[-12,20],[-3,2],[-7,4],[-2,2],[-3,6],[0,7],[-2,5],[-3,3],[-4,1],[-7,6],[-4,2],[-6,-1],[-7,-3],[-4,-1],[-39,4],[-17,7],[-11,15],[-5,34],[-6,5],[1,10],[7,15],[-5,12],[-13,13],[-15,9],[-11,4],[-10,-3],[-29,-17],[-6,-8],[-4,-16],[-11,-13],[-12,-1],[-9,15],[-1,2],[-1,5],[1,4],[4,2],[-12,13],[-3,-5],[-4,-2],[-3,1],[-2,6],[-12,-8],[-3,0],[-5,3],[-3,11],[-8,7],[-3,11],[1,13],[3,9],[31,22],[10,2],[8,6],[22,25],[6,4],[9,1],[8,3],[7,7],[14,16],[2,3],[3,7],[1,2],[2,1],[5,-1],[2,0],[11,12],[1,3],[2,1],[9,11],[3,3],[4,1],[13,7],[6,6],[5,5],[5,5],[7,2],[1,1],[3,5],[2,2],[9,-1],[4,1],[14,6],[26,20],[14,4],[25,2],[25,7],[46,20]],[[9901,7687],[10,-8],[-1,-2],[-1,-4],[0,-5],[3,-2],[3,2],[4,4],[4,7],[-1,9],[3,3],[3,-4],[-2,-8],[3,-4],[12,-9],[3,-5],[2,-3],[4,-4],[3,-2],[6,-1],[3,-2],[5,-7],[4,-10],[-1,-9],[-8,-4],[7,-3],[7,0],[6,-1],[2,-11],[2,-9],[9,-17],[4,-10],[-3,0],[-2,4],[-3,4],[-3,3],[-4,2],[-1,-41],[-24,-3],[-31,17],[-72,51],[-15,6],[-18,0],[-32,-7],[-17,7],[2,7],[0,9],[2,8],[5,6],[-4,3],[-9,4],[-4,3],[-4,8],[0,3],[2,3],[1,7],[5,8],[31,7],[11,-4],[43,4],[17,0],[5,0],[7,3],[7,7],[5,3],[1,-8],[4,-5]],[[9306,8669],[-56,-25],[-90,-43],[-9,-10],[-25,-19],[-34,-14],[-13,-11],[-12,-17],[-21,-40],[-13,-18],[-14,-14],[-32,-18],[-18,-6],[-30,-3],[-30,-8],[-9,-6],[-4,-1],[-15,0],[-87,-27]],[[8794,8389],[1,16],[-1,3],[-3,1],[-15,2],[-5,4],[1,6],[2,3],[11,6],[3,4],[2,4],[-1,6],[-2,4],[-10,8],[-9,20],[-1,15],[-2,5],[-10,12],[-23,14],[-6,12],[4,17],[1,14],[-11,8],[-24,10],[-3,9],[13,20],[4,8],[-2,5],[-6,1],[-11,0]],[[8691,8626],[6,9],[-8,6],[-8,2],[2,10],[6,6],[21,5],[1,4],[-14,38],[1,48],[1,4],[4,5],[5,3],[6,0],[5,-2],[8,-11],[4,-2],[12,2],[4,-1],[11,-10],[4,0],[3,3],[31,38],[2,6],[0,6],[-9,22],[1,7],[12,21],[0,15],[1,5],[4,4],[4,1],[14,0],[4,2],[4,4],[1,5],[0,5],[-3,5],[-3,1],[-3,0],[-11,-5],[-3,1],[-2,3],[0,5],[1,4],[10,9],[2,6],[2,6],[0,6],[-1,11],[0,3],[2,3],[5,2],[3,2],[1,6],[-4,16],[0,2],[1,3],[2,4],[1,2],[6,3],[2,4],[2,5],[0,5],[-1,6],[-1,2],[-14,7],[-3,3],[-2,4],[-3,23],[0,4],[1,4],[13,16],[57,11]],[[8891,9078],[31,8],[11,-3],[16,-12],[6,0],[13,3],[6,0],[3,-2],[2,-2],[1,-2],[1,-4],[0,-6],[-1,-5],[-6,-9],[-3,-15],[1,-2],[9,-12],[2,-4],[2,-8],[0,-20],[2,-5],[3,-4],[3,-1],[8,1],[3,0],[12,-10],[2,-1],[13,5],[20,0],[2,1],[5,5],[5,3],[22,1],[3,-4],[3,-9],[6,-6],[9,-1],[17,6],[18,-25],[6,-5],[18,0],[8,-6],[7,-10],[4,-13],[-2,-13],[-4,-9],[-22,-26],[0,-3],[2,-4],[4,-3],[4,-7],[0,-7],[-9,-14],[-8,1],[-14,-9],[-4,-2],[-20,11],[-3,-1],[-3,-5],[-4,-9],[1,-12],[5,-12],[7,-11],[8,-6],[3,0],[11,4],[19,-1],[49,-52],[40,9],[13,8],[8,2],[7,-1],[21,-8],[9,-9],[3,-13],[-2,-3],[-4,-5],[-1,-3],[1,-5],[7,-18]],[[6811,9287],[-31,-11],[-11,3],[-7,3],[-29,3],[-19,-2],[-7,-3],[-2,-4],[5,-7],[2,-5],[0,-4],[-3,-5],[-3,-4],[-2,-4],[-2,-3],[-14,-16],[0,-5],[2,-2],[3,0],[4,1],[4,1],[3,0],[3,-3],[1,-4],[0,-5],[-2,-5],[-3,-8],[-1,-5],[1,-4],[7,-5],[2,-3],[2,-4],[2,-4],[1,-4],[0,-4],[-4,-13],[0,-13],[0,-6],[1,-4],[0,-5],[-7,-13],[-3,-2],[-8,-2],[-5,-2],[-1,-4],[2,-3],[3,-3],[1,-5],[-1,-11],[1,-5],[1,-5],[2,-4],[1,-5],[0,-4],[0,-6],[-1,-7],[-5,-19],[-3,-6],[-6,-5],[1,-3],[14,-23],[1,-5],[3,-8],[4,-3],[6,-5],[5,-7],[2,-4],[2,-5],[4,-7],[7,-3],[6,-1],[3,1],[7,0],[7,0],[4,1],[4,0],[3,-1],[3,-4],[2,-4],[1,-4],[2,-4],[3,-21]],[[6779,8903],[-10,-3],[-14,-34],[-2,-14],[-2,-6],[-4,-1],[-4,0],[-4,-2],[-1,-3],[-6,-21],[-13,1],[-13,-4],[-43,-55],[-11,21],[-3,2],[-12,6],[-2,2],[-1,3],[-7,9],[-9,1],[-6,-6],[-1,-13],[5,-39],[-1,-2],[-2,-2],[-17,-12],[-14,-5],[-2,-27],[-16,-2],[-29,-62],[-30,11],[-4,-1],[-2,-3],[-1,-5],[0,-10]],[[6498,8627],[-14,-7],[-22,5],[-11,-2],[-11,-7],[-2,-3],[-6,-12],[-3,-3],[-10,-5],[-3,-5],[-1,-6],[0,-29],[-18,1],[-7,26],[-22,-1],[-24,29],[-41,23]],[[6303,8631],[-5,15],[-17,14],[1,33],[-1,11],[-11,24],[6,17]],[[6276,8745],[2,14],[-23,25],[0,25],[16,-1],[25,10],[3,3],[2,4],[1,5],[1,12],[2,3],[28,8],[6,5],[3,8],[0,7],[-1,6],[-4,4],[-5,1],[-40,-22],[-8,0],[-2,12],[25,34],[1,5],[-4,6],[-4,2],[-41,-7],[-2,1],[-9,12],[-7,41],[-38,4],[7,29],[-21,20],[1,10],[-18,95],[2,1],[-20,-2],[-5,6],[-1,9],[0,20],[2,7],[4,4],[6,2],[26,-2],[-1,22],[-7,28],[-6,9],[-9,9],[-1,-1],[-2,3],[9,4],[-5,18],[9,8],[-1,22],[-4,14],[1,6],[7,12],[1,-2],[3,-3],[6,-3],[12,8],[14,20],[12,7],[6,2],[6,-2],[7,-7],[2,-1],[4,2],[3,4],[5,11]],[[6257,9361],[17,4],[12,29],[4,3],[3,2],[2,-2],[0,-3],[0,-15],[1,-4],[-1,-10],[15,-4],[7,1],[9,3],[5,3],[16,14],[7,2],[16,0],[4,2],[3,4],[0,4],[0,5],[-1,3],[-4,6],[-1,5],[1,7],[-1,5],[-1,4],[-4,2],[-5,0],[-5,-2],[-3,-5],[-4,-6],[-3,-2],[-4,0],[-3,2],[-2,4],[0,4],[-2,8],[1,3],[3,2],[0,4],[1,2],[13,1],[13,9],[2,4],[-1,4],[-2,4],[-3,4],[-3,3],[-4,2],[-4,-2],[-4,-1],[-2,-3],[-4,-8],[-3,-3],[-11,-8],[-8,-2],[-5,0],[-4,1],[-4,3],[-3,4],[-2,5],[0,4],[1,5],[10,29],[4,7],[0,1],[4,3],[4,2],[8,5],[9,10],[7,4],[7,3],[4,2],[6,6],[1,6],[1,6],[0,5],[2,3],[4,1],[5,0],[12,-1],[5,1],[4,2],[6,6],[8,4],[6,5],[6,7],[11,15],[9,10],[6,4],[5,0],[4,-1],[7,-6],[4,-2],[13,-2],[12,-3],[12,-6],[9,-2],[8,1],[13,-2],[13,1]],[[6551,9595],[27,11],[37,24],[5,2],[4,0],[3,0],[2,-2],[8,-6],[10,-2],[15,0],[10,-2],[2,-2],[2,-2],[0,-6]],[[6254,8975],[8,-3],[7,2],[2,1],[1,3],[-1,8],[-3,5],[-5,4],[-5,2],[-5,-2],[-2,-2],[-1,-2],[-1,-3],[0,-3],[1,-6],[2,-3],[2,-1]],[[5705,7722],[-13,-6],[-2,-3],[-2,-5],[-2,-15],[-1,-7],[1,-5],[-2,-34],[-7,-46],[0,-16],[2,-8],[4,2],[8,2],[13,1],[4,-1],[3,-2],[3,-3],[3,-4],[3,-3],[2,-4],[0,-4],[-1,-4],[-5,-8],[-2,-6],[-2,-7],[0,-7],[-1,-6],[-1,-14],[1,-5],[2,-3],[16,-3],[6,-1],[3,1],[2,2],[5,9],[4,5],[9,8],[3,1],[8,2],[3,0],[4,-3],[2,-5],[2,-8],[0,-6],[-3,-9],[1,-4],[6,-7],[3,-6],[1,-5],[-1,-4],[-2,-4],[-1,-9],[-1,-13],[-1,-4],[-2,-4],[-1,-4],[-5,-8],[-2,-4],[-2,-4],[-3,-4],[-4,-7],[-1,-4],[1,-4],[3,-3],[3,-3],[7,-5],[4,-3],[16,-23],[9,-11],[7,-6],[3,-4],[7,-5],[8,-2],[3,-3],[6,-11],[14,-17],[4,-7],[6,-7],[2,-2],[5,-4],[5,-5]],[[4850,7199],[-22,29],[-8,7],[-3,8],[-2,13],[-1,14],[3,8],[3,9],[2,14],[0,14],[-3,6],[-18,5],[-10,5],[-7,6],[-4,14],[-4,5],[-15,8],[-7,8],[-13,19],[-8,8],[-15,43],[-3,9],[-1,1],[96,-5],[6,2],[7,4],[9,1],[17,0],[8,2],[10,-6],[14,-1],[65,9],[6,3],[5,13],[0,5],[-1,4],[0,6],[2,6],[5,10],[2,6],[-1,5],[-2,6],[0,6],[3,9],[3,3],[11,4],[4,3],[11,18],[1,6],[1,10],[1,6],[0,3],[-2,6],[0,4],[1,3],[5,3],[1,2],[3,16],[1,5],[-1,7],[3,7],[7,13],[-18,35],[-10,13],[-6,10],[-4,5],[-5,2],[-12,2],[-5,1],[-6,9],[-3,21],[-3,9],[3,7],[5,14],[4,6],[8,4],[19,13],[5,1],[3,1],[9,-1],[9,1],[8,6],[1,3],[1,5]],[[5018,7823],[5,-4],[8,-10],[4,-4],[5,-2],[4,-1],[5,0],[4,2],[4,1],[4,-2],[8,-1],[14,8],[4,1],[9,-5],[4,-1],[5,2],[4,3],[6,3],[31,6],[6,3],[4,3],[3,3],[1,4],[0,5],[-2,8],[0,5],[2,3],[3,4],[14,12],[3,2],[10,4],[3,2],[17,6],[9,11],[4,3],[4,2],[14,3],[4,3],[2,4],[2,4],[2,4],[3,4],[4,3],[5,3],[7,1],[6,2],[6,3],[15,12],[4,2],[6,1],[7,-2],[15,-10],[5,-4],[7,-8],[4,-3],[9,-2],[0,-4],[1,-4],[3,-3],[6,-3],[9,-4],[2,-3],[0,-2],[-2,-5],[-1,-2],[-1,-3],[-1,-2],[-1,-3],[-1,-4],[-2,-3],[-3,-2],[2,-3],[6,-3],[15,-6],[10,-7],[6,-5],[4,-5],[6,-5],[16,-8],[11,-5],[6,-1],[4,3],[3,3],[2,4],[2,5],[1,4],[2,4],[3,3],[3,2],[15,4],[9,6],[4,1],[4,-1],[4,-6],[2,-5],[0,-5],[-1,-5],[-3,-7],[0,-4],[3,-2],[10,-1],[15,6]],[[5787,5796],[20,-30],[6,-19],[-2,-20],[-7,-17],[-12,-13],[-13,-9],[-15,-1],[-30,28],[-13,-1],[-6,-4],[-13,-16],[-3,-9],[4,-12],[15,-22],[-1,-12],[-9,-14],[-8,-38],[-8,-11],[-12,-9],[-27,-10],[-5,-5],[-8,-17],[-4,-6],[-12,-8],[-37,-13],[-4,-4],[-3,-8],[4,-7],[6,-6],[7,-3],[9,0],[16,11],[16,6],[16,1],[7,-3],[5,-7],[10,-25],[17,-20],[9,-24],[6,-44],[19,8],[11,-25]],[[5738,5358],[-3,-3],[-3,-3],[-3,-3],[-8,-3],[1,-5],[2,-5],[-5,-9],[-15,-30],[-2,-7],[-2,-28],[-9,0],[-3,13],[-8,6],[-10,4],[-9,0],[-1,-6],[-4,-5],[-2,-8],[0,-9],[3,-8],[-2,-4],[1,-10],[3,-6],[1,-5],[-1,-7],[-3,-4],[-4,-3],[-9,-4],[-44,-18],[-7,-5],[-13,-5],[-8,19],[-19,12],[-8,7],[-10,-5],[-10,4],[-8,6],[-19,6],[-7,7],[-10,16],[-29,32],[-8,6],[-10,0],[-20,-4],[-23,8],[-12,17],[-8,20],[-10,19],[-25,15],[-3,8],[-1,11],[-3,11],[-4,11],[-15,19],[-10,28],[-7,18],[-10,22],[-10,9],[-4,5],[6,3],[4,-1],[14,-15],[3,-5],[-2,-6],[3,-6],[7,-8],[6,1],[3,4],[5,8],[9,12],[-3,1],[-9,-4],[-8,1],[-3,10],[3,19],[-4,12],[-22,22],[-4,3],[-31,2],[-8,3],[-6,7],[-6,25],[-4,12],[-7,12],[-2,11],[2,11],[8,10],[8,5],[17,7],[6,5],[4,15],[-4,26],[3,14],[15,15],[32,-3]],[[5303,5733],[33,-10],[23,-18],[59,-8],[14,5],[22,-6],[5,20],[7,14],[10,8],[16,6],[40,0],[11,20],[10,8],[12,-4],[25,-23],[9,-1],[9,4],[10,7],[7,10],[5,13],[1,8],[-2,22],[2,6],[2,4],[8,3],[5,1],[7,-2],[5,-5],[3,-6],[-1,-11],[-9,-19],[1,-11],[4,-6],[6,1],[48,40],[4,1],[5,-3],[20,-35],[6,-4],[8,0],[10,5],[9,8],[15,21]],[[6620,9649],[-14,-7],[-2,3],[0,24],[8,-2],[8,-12],[0,-6]],[[6672,9731],[0,-4],[1,-18],[-2,-6],[-3,-5],[-19,-9],[-5,0],[-9,4],[-12,-1],[-27,2],[-6,-3],[-5,-5],[-37,-27],[-5,-7],[-2,-5],[2,-5],[0,-4],[1,-5],[-1,-4],[0,-5],[2,-4],[2,-4],[3,-13],[1,-8]],[[6257,9361],[-5,8],[-2,3],[-4,3],[-5,2],[-12,1],[-5,2],[-8,8],[-4,3],[-1,4],[2,4],[3,2],[8,2],[4,1],[4,1],[2,3],[2,5],[-1,4],[-3,3],[-4,2],[-11,-3],[-4,-3],[-6,-5],[-2,-1],[-3,0],[-3,2],[-3,3],[-1,3],[0,3],[0,3],[-1,5],[0,4],[-1,5],[-1,4],[0,5],[-2,8],[-1,9],[0,4],[0,5],[-1,4],[-6,5],[-46,17],[-6,4],[-3,5],[0,1],[-2,4],[-8,15],[-4,4],[-11,6],[-5,1],[-8,0],[-8,-5],[-4,-2],[-7,0],[-6,-1],[-15,-8],[-6,-1],[-15,2],[-17,-4],[-23,0],[-7,-2],[-9,0]],[[5972,9518],[-4,15],[-2,5],[-8,8],[-3,6],[-3,4],[-18,10],[-4,4],[-3,5],[-3,10],[-1,6],[2,34]],[[6066,9757],[1,0],[2,0],[12,-12],[9,10],[13,2],[12,-3],[8,-9],[3,0],[5,8],[4,2],[21,-2],[55,6],[12,10],[28,8],[11,2],[20,0],[2,2],[1,3],[0,3],[4,1],[3,-1],[11,-8],[2,3],[2,1],[2,0],[3,0],[-2,1],[-4,4],[0,4],[15,11],[8,4],[7,-3],[6,4],[1,-1],[2,-3],[13,9],[14,2],[13,-2],[12,-9],[-19,-8],[-8,-6],[-6,-7],[5,-5],[2,-2],[2,-2],[-2,0],[-1,0],[0,-1],[0,-2],[5,-1],[4,1],[6,3],[3,4],[6,8],[2,2],[4,-1],[4,-6],[4,-2],[2,3],[-1,5],[-3,6],[-3,3],[0,4],[7,-1],[2,-1],[3,-2],[1,3],[1,0],[1,1],[-3,4],[5,3],[13,1],[5,3],[5,4],[5,3],[34,11],[11,-1],[-1,-11],[8,0],[5,-5],[5,-5],[4,-3],[31,-5],[2,-2],[2,-3],[0,-4],[0,-6],[-2,0],[-3,0],[-4,-1],[-1,2],[-5,3],[-4,1],[-2,-3],[-1,-4],[-4,-3],[-7,-5],[9,-1],[5,-7],[4,-3],[6,11],[5,-7],[6,0],[14,4],[6,-2],[21,-7],[28,-4],[20,-8],[5,-1],[5,-3],[10,-11],[12,-4]],[[8149,8103],[11,-2],[9,2],[2,-3],[2,-4],[2,-5],[5,-5],[10,-3],[6,-4],[4,-5],[-1,-4],[-2,-4],[-2,-5],[0,-5],[3,-9],[4,-5],[11,-6],[31,-12],[14,-8],[5,-4],[3,-4],[0,-4],[2,-5],[3,-5],[4,-3],[28,-13],[2,-2]],[[8305,7976],[-3,-7],[-7,-19],[-8,-12],[-8,-8],[-6,-11],[-3,-16],[-11,-12],[-31,-64],[-5,-7],[-12,-10],[-6,-7],[-15,-23],[-27,-23],[-27,-58],[-12,-14],[-23,-15],[-11,-18],[-19,-44],[-12,-18],[-28,-34],[-45,-82]],[[7986,7474],[-35,22],[-16,23],[-16,6],[-16,-9],[-13,-23],[-10,-10],[-11,-4],[-9,3],[-25,42],[-16,-10],[-7,-12],[-7,-6],[-8,-3],[-7,2],[-5,6],[-1,5],[2,6],[0,10],[-6,27],[-15,10],[-10,-22],[-10,3],[-17,30],[-8,5]],[[7720,7575],[-2,6],[-6,6],[-3,2],[-3,4],[-4,8],[-2,8],[0,4],[-1,4],[0,4],[2,9],[2,5],[3,4],[10,6],[5,1],[5,4],[2,1],[4,5],[1,6],[2,10],[2,3],[3,1],[4,-1],[7,0],[17,3],[31,17],[1,4],[-2,8],[-1,5],[1,5],[1,4],[8,8],[6,5],[4,6],[2,6],[1,9],[2,5],[3,5],[2,10],[-1,4],[1,4],[0,9],[1,4],[2,3],[5,0],[4,-1],[4,-3],[6,-2],[3,0],[3,1],[4,1],[4,1],[8,1],[4,1],[17,8],[3,4],[3,4],[1,6],[-1,5],[-1,5],[1,4],[10,7],[5,6],[7,12],[5,6],[17,12],[3,4],[0,6],[-1,4],[-3,5],[-6,7],[-3,3],[-6,6],[-3,3],[-1,5],[-1,5],[3,4],[4,4],[21,10],[2,2],[0,4],[-2,3],[-2,8],[0,1],[-7,4],[0,4],[0,4],[1,4],[1,4],[0,9],[-1,4],[-1,5],[-1,9],[1,4],[1,5],[0,9],[-3,2],[-3,-1],[-7,-2],[-4,0],[-4,2],[-4,2],[-3,0],[-4,2],[-3,2],[-2,4],[1,9],[0,4],[-1,5],[0,4],[4,5],[5,3],[5,1],[8,-2],[7,-5],[4,0],[5,3],[3,3],[23,14],[2,4],[0,4],[0,4],[1,10],[2,9],[2,4],[2,4],[8,11],[5,2],[8,0],[6,-3],[5,-3],[3,-4],[7,-6],[20,-14],[12,-2],[22,1],[7,-2],[3,-4],[1,-4],[0,-4],[1,-4],[3,-2],[4,0],[5,3],[4,4],[3,3],[4,2],[5,2],[7,1],[16,1],[13,5]],[[5699,5080],[-10,10],[-7,11],[-5,13],[-4,13],[6,1],[9,0],[10,-7],[7,-6],[8,-2],[12,7],[-4,-14],[-20,-17],[-2,-9]],[[5875,7274],[20,78],[11,21],[5,3],[39,-23],[10,-11],[3,-6],[2,-9],[-11,-27],[6,-10]],[[6770,7323],[10,-25],[17,-25],[-12,-15],[6,-9],[23,2],[19,27],[21,-50]],[[6847,6742],[-5,-5],[-1,-2],[-9,-9],[-7,-4],[-2,-2],[-2,-1],[-13,-7],[-3,-3],[-4,-4],[0,-1],[-1,-1],[-1,-1],[-2,-1],[-2,-1],[-1,-2],[-1,0],[-2,0],[-5,3],[-4,4],[-4,1],[-5,1],[-6,0],[-6,-1],[-7,-4],[-9,-7],[-3,-3],[-1,-8],[-1,-4],[-1,-1],[-4,2],[-6,8],[-11,16],[-3,4],[-3,2],[-4,0],[-13,-9],[-6,-6],[-5,-3],[-6,0],[-15,5],[-31,1],[-8,2],[-8,3],[-8,5],[-6,2],[-6,0],[-11,-2],[-7,-4],[-3,-4],[-2,-5],[-1,-4],[0,-4],[-2,-4],[-7,-8],[-10,-7],[-12,-5],[-5,-1],[-6,0],[-7,1],[-15,4],[-3,3],[-2,3],[-1,5],[0,4],[-2,4],[-3,3],[-4,1],[-6,-1],[-4,-3],[-2,-5],[-2,-14],[-2,-3],[-3,-3],[-5,-1],[-5,0],[-24,6],[-9,1],[-11,6],[-3,0],[-4,-1],[-3,-2],[-8,3],[-4,2],[-5,1],[-7,-1],[-6,-2],[-7,-5],[-3,-4],[-4,-10],[-9,-4],[-15,-2],[-126,5],[-17,7],[-9,1],[-9,0],[-4,-1],[-3,-4],[-1,-4],[-1,-23]],[[6172,6630],[-6,-2],[-5,1],[-29,13],[-6,1],[-12,4],[-19,10],[-5,4],[-4,5],[-9,14],[-12,14],[-12,11],[-6,4],[-6,5],[-6,2],[-4,0],[-4,1],[-4,3],[-3,6],[-2,5],[-4,5],[-16,14],[-8,3],[-8,6],[-1,3],[-4,5],[-6,4],[-18,9],[-6,2],[-8,0],[-6,2],[-6,2],[-10,7],[-5,7],[-2,5],[-1,10],[0,5],[-1,10],[-1,4],[-5,3],[-13,-1],[-5,-1],[-10,1],[-14,6],[-26,21]],[[5987,7310],[33,3],[2,9],[6,8],[7,6],[7,3],[3,16],[4,10],[6,6],[12,0],[6,-28],[5,-7],[5,-4],[6,0],[5,2],[2,3],[3,6],[2,2],[4,1],[82,-19],[22,13],[15,49],[15,-9],[37,8],[1,-6],[1,-12],[-2,-5],[-4,-4],[-6,-3],[-5,-3],[-1,-8],[1,-4],[6,-7],[1,-5],[0,-6],[-2,-5],[-7,-9],[-17,3],[-4,-29],[-7,-20],[-1,-6],[2,-5],[11,-9],[5,-2],[3,2],[11,13],[45,-8],[2,-34],[29,-11],[12,-11],[15,-2],[12,16],[7,4],[8,2],[20,-16],[6,1],[19,15],[41,8],[14,-5],[35,27],[3,18],[32,20],[25,0],[7,3],[4,9],[5,24],[5,5],[49,2],[0,8],[18,5],[33,-28],[21,4],[20,-7],[21,16]],[[6172,6630],[15,-8],[1,-1],[11,-30],[0,-20],[2,-13],[6,-13],[13,-21],[0,-27],[-11,-6],[-26,-41],[-1,-5],[-3,-17],[-1,-4],[-10,-9],[11,-25],[-10,-89],[2,-7],[4,-6],[11,-7],[6,-8],[1,-26],[4,-10],[15,-7],[6,-5],[1,-11],[-4,-7],[-13,-17],[-2,-9],[4,-4],[10,-5],[11,-21],[21,-25],[7,-24],[3,-8],[22,-18],[16,-34]],[[6294,6042],[-33,1],[-8,-4],[-19,-24],[-8,-6],[-8,-1],[-16,3],[-4,-1],[-3,-4],[-5,-10],[-1,-19],[-11,-23],[3,-19],[-29,-26]],[[6152,5909],[-2,10],[-21,8],[-5,38],[-27,0],[-16,-24],[-26,-17],[-25,6],[-8,21],[-18,1]],[[6004,5952],[-2,13],[-5,13],[-3,26],[-7,9],[-8,4],[-23,-20],[-10,1],[-17,17],[-12,33],[-15,17],[-2,15],[-9,20],[-16,15],[4,11],[3,29],[-2,11],[-2,4],[-5,3],[-3,3],[-1,5],[1,9],[0,4],[-5,15],[-7,12],[-9,8],[-10,4],[-12,-1],[-23,-11],[-8,-13],[-3,-3],[-10,-2],[-12,1],[-5,4],[-39,-28],[-30,-9],[-15,1],[-10,12],[-6,26],[11,15],[35,0],[1,47],[-11,8],[-3,4],[-3,8],[-1,15],[-5,7],[-14,10],[-5,6],[-4,11],[-1,26],[-3,9],[-25,25],[-8,38],[-38,45],[0,12]],[[7269,7899],[12,-6],[8,-8],[18,-27],[3,-8],[0,-7],[-3,-5],[1,-8],[3,-1],[2,2],[4,2],[6,-1],[11,-6],[47,-48],[6,-5],[4,-2],[6,4],[4,0],[7,-2],[6,-2],[5,-1],[11,2],[2,-2],[1,-4],[0,-5],[0,-4],[-2,-8],[-3,-6]],[[7428,7743],[-1,-12],[2,-3],[3,-3],[10,-7],[2,-3],[1,-4],[2,-8],[13,-39],[3,-3],[5,-2],[4,0],[29,-5],[12,-5],[7,0],[3,1],[1,1],[4,1],[8,1],[9,1],[2,2],[8,2]],[[7555,7658],[8,-25]],[[7563,7633],[-6,-5],[-17,-8],[-3,-4],[-1,-3],[1,-4],[2,-5],[1,-4],[0,-5],[-1,-10],[0,-9],[-1,-10],[-7,-32],[-4,-10],[-3,-5],[-5,-7],[-10,-20],[-1,-6],[-1,-5],[1,-5],[2,-9],[0,-6],[-2,-4],[-3,-4],[-3,-3],[-4,-2],[-4,-1],[-9,0],[-4,1],[-3,3],[-8,4],[-4,0],[-4,0],[-4,-2],[-8,-7],[-10,-11],[-2,-4],[-16,-34],[-5,-7],[-5,-5],[-4,-2],[-2,-3],[-2,-6],[0,-3],[0,-2],[0,-2],[1,-2],[1,-2],[0,-1],[-1,-4],[-1,-3],[0,-3],[0,-3],[0,-6],[1,-2],[1,0],[0,-1],[0,-1],[-1,-2],[-2,-2],[-1,-2],[1,-7],[-3,-10],[-3,-5],[0,-3],[1,-3],[1,-3],[2,-3],[1,-1],[3,-5]],[[6770,7323],[2,81],[8,25],[-41,49],[-7,27],[-11,14],[-8,31],[-17,20],[-13,5],[13,34],[0,33],[-20,-1],[-13,39],[3,12]],[[6666,7692],[23,1],[8,3],[7,5],[5,6],[2,4],[0,5],[-1,4],[-3,3],[-2,4],[-1,5],[-1,4],[-2,5],[-1,5],[2,3],[1,0],[4,-1]],[[6707,7748],[4,7],[22,-8],[-3,23],[10,10],[23,-24],[15,-8],[5,1],[4,3],[3,5],[5,13],[3,3],[19,4],[4,3],[6,36],[-6,36],[3,50],[17,9],[21,-15],[19,23],[24,12],[11,0],[12,-3],[27,-18],[3,1],[2,3],[1,3],[0,4],[-1,4],[-2,5],[-9,6],[-3,5],[0,5],[2,10],[0,3],[-7,11],[-1,7],[1,6],[2,2],[6,2],[12,-17],[3,-2],[3,0],[24,14],[16,-4],[2,1],[2,5],[-1,7],[-12,19],[0,5],[2,6],[2,5],[3,3],[6,0],[9,-7],[16,-17],[5,0],[5,3],[4,4],[3,7],[1,7],[0,17],[2,6],[6,2],[12,-9],[15,-5],[8,0],[8,3],[3,3],[2,4],[4,11],[5,1],[26,-12],[25,-25],[16,-8],[5,0],[12,7],[7,0],[4,-4],[18,-37],[15,-64],[22,-17]],[[8954,9162],[-1,0],[-10,1],[-6,5],[-1,8],[5,11],[5,2],[5,-6],[4,-11],[5,-8],[-1,-1],[-5,-1]],[[8891,9078],[-4,13],[1,5],[0,5],[0,5],[-2,5],[-7,10],[-2,5],[0,18],[-2,4],[-29,11],[-6,6],[-4,9],[-2,10],[-1,10]],[[8833,9194],[8,-3],[27,-4],[10,-4],[25,-18],[10,-2],[8,-1],[7,-3],[6,-10],[6,-23],[4,-10],[9,-8],[6,-3],[6,-1],[11,1],[8,2],[5,3],[7,9],[11,8],[2,4],[3,9],[2,3],[7,3],[21,-2],[28,9],[14,1],[12,-7],[6,-5],[25,-12],[14,-3],[7,-1],[4,-10],[7,-9],[8,-7],[8,-3],[9,-5],[5,-2],[5,0],[3,3],[4,11],[3,3],[9,0],[20,-7],[10,-2],[12,1],[0,2],[-6,7],[-4,12],[4,5],[18,15],[8,4],[9,1],[18,-3],[9,2],[7,4],[14,14],[7,4],[7,1],[7,0],[8,1],[14,12],[15,-6],[7,5],[5,-1],[13,0],[3,-1],[3,-7],[3,-6],[5,-4],[5,-4],[9,-3],[12,-1],[11,0],[19,4],[-1,-9],[-3,-13],[1,-9],[0,-11],[6,-9],[8,-6],[10,2],[10,0],[6,-8],[3,0],[5,4],[5,-1],[11,-7],[-10,-22],[-2,-6],[-2,-10],[-3,-4],[-4,-3],[-3,-7],[-7,4],[-17,-4],[-14,6],[-3,6],[-9,-1],[-9,-11],[-5,-13],[-1,-22],[0,-15],[2,-11],[7,-8],[16,-10],[8,-12],[10,-15],[0,-8],[-6,-6],[-2,-8],[2,-9],[3,-13],[0,-4],[2,-4],[8,-7],[3,-5],[-2,-12],[-11,-20],[-5,-15],[-8,-9],[-12,-18],[-15,1],[-17,-13],[-4,-17],[-13,-7],[-40,-33],[-8,-13],[-14,-4],[-11,-3],[-11,-3],[-5,-1],[-2,-2],[-7,-6],[-1,-3],[-2,-4],[-4,-1],[-5,0],[-7,-15]],[[7033,6429],[15,-13],[4,-3],[0,-1],[0,-1],[6,-12],[9,-15],[13,-17],[10,-7]],[[6682,5636],[-13,-1],[-31,6],[-45,-6],[-7,-5],[-6,-6],[-9,-8],[-16,-11],[-28,0],[-17,16],[-9,-2],[-6,-4],[-17,9],[-6,10],[-14,-1],[-15,-1],[-6,-7],[-23,-3],[-20,8]],[[6394,5630],[-3,17],[7,24],[-27,33],[-21,-2],[-121,59],[-50,47],[-6,9],[-3,11],[-3,39],[-15,42]],[[6294,6042],[23,-14],[48,4],[22,50],[49,32],[24,7],[54,52],[7,2],[10,-6],[20,-24],[11,-2],[37,8],[8,6],[10,18],[10,10],[13,4],[16,-2],[43,-25],[9,7],[8,4],[9,0],[21,-7],[4,19],[33,20],[0,52],[5,16],[46,85],[38,37],[4,1],[2,-1],[7,-6],[32,27],[-1,35],[24,11]],[[7160,8363],[36,12],[12,-4],[3,-4],[4,-4],[6,-5],[11,-5],[18,-15],[15,-8],[22,-20],[2,-4],[3,-4],[1,-4],[3,-4],[6,-8],[24,-22],[3,-4],[4,-5],[3,-4],[15,-14]],[[7351,8237],[6,-12],[-1,-5],[-1,-21],[2,-9],[4,-8],[3,-5],[6,-7],[12,-9],[4,-4],[1,-5],[1,-6],[0,-15],[-1,-5],[-4,-10],[-2,-5],[-1,-5],[0,-7],[2,-5],[3,-5],[3,-9],[1,-6],[0,-13],[-2,-5],[-3,-8],[-3,-10],[0,-7],[2,-12],[-2,-4],[-3,-4],[-4,-3],[-7,-4],[-4,-1],[-4,1],[-3,2],[-4,3],[-7,3],[-4,0],[-12,3],[-2,-2],[-3,-4],[-7,-23],[0,-8],[0,-22],[-3,-5],[-3,-3],[-9,-5],[-4,-3],[-4,-5],[-14,-24],[-3,-3],[-3,-1],[-5,-8]],[[6707,7748],[-5,25],[1,13],[-1,5],[-1,8],[-4,11],[-4,8],[-5,3],[-4,0],[-12,-9],[-3,-4],[-3,-4],[-3,-3],[-3,0],[-4,4],[-1,9],[1,6],[1,6],[1,6],[1,5],[1,7],[3,4],[6,7],[2,4],[1,3],[0,3],[2,6],[1,3],[1,2],[0,4],[-1,5],[1,2],[1,3],[0,5],[-1,7],[-7,12],[-5,5],[-5,3],[-4,1],[-3,2],[-2,4],[1,18],[-1,12],[0,3],[-1,2],[-1,4],[-9,10],[-4,3],[-3,3],[-3,2],[-4,1],[-3,-2],[-3,-1],[-3,-2],[-3,-1],[-3,0],[-1,1],[-1,2],[1,3],[1,1],[1,2],[0,3],[-1,5],[-1,5],[-6,6],[-4,2],[-3,4],[-2,6],[1,16],[3,14],[-3,1],[-3,-2],[-3,-1],[-3,0],[-5,4],[-5,5],[-6,12],[-4,5],[-3,0],[-2,-3],[-2,-2],[-6,1],[-7,-2],[-3,1],[-3,3],[-3,4],[-2,4],[2,5],[5,8],[2,4],[0,5],[-2,4],[0,9],[-1,6],[-3,7],[-3,4],[-13,4],[-3,2],[-1,2],[0,2],[1,3],[2,2],[2,6],[3,6],[1,4],[2,18],[1,3],[2,2],[2,2],[2,1],[2,2],[2,4],[0,6],[-2,5],[0,5],[2,4],[1,6],[3,5],[1,5],[4,14],[2,4],[1,5],[4,8],[1,6],[0,8],[-7,19],[-5,22],[-4,1],[-3,1],[-11,6],[-3,2],[-4,5],[-5,8],[-17,18],[-1,11]],[[6497,8370],[7,-1],[4,1],[35,27],[10,3],[3,2],[1,5],[2,9],[-1,5],[-2,4],[-2,3],[-1,3],[1,2],[12,-5],[22,-1],[22,4],[5,3],[13,1],[13,16],[10,5]],[[6651,8456],[51,-13],[15,1],[30,3],[10,3],[7,5],[1,4],[3,3],[2,3],[4,3],[5,1],[6,0],[8,-5],[2,-4],[1,-5],[1,-4],[3,-9],[3,-4],[5,-3],[17,-4],[11,0],[5,3],[4,3],[4,2],[5,0],[6,-1],[3,-4],[3,-4],[2,-4],[5,-3],[8,-2],[11,-2],[7,-4],[4,-4],[2,-4],[4,-1],[4,1],[4,0],[3,0],[3,-4],[-1,-3],[-2,-4],[-7,-5],[-1,-3],[4,-3],[7,-4],[3,-5],[0,-4],[-4,-7],[1,-3],[3,-2],[5,0],[8,3],[4,2],[4,2],[4,-3],[2,-4],[2,-4],[1,-4],[2,-3],[1,-2],[2,-2],[5,-3],[3,-2],[2,-4],[3,-9],[2,-4],[3,-4],[5,-3],[12,-6],[6,0],[14,8],[5,2],[6,-2],[3,-3],[8,-5],[6,-1],[11,2],[7,3],[6,3],[5,4],[5,4],[8,1],[10,-2],[4,1],[4,1],[15,14],[3,3],[4,-1],[3,-3],[3,-4],[11,-7],[3,-3],[2,-4],[3,-3],[3,-1],[3,2],[1,3],[-1,4],[-1,12],[4,16],[0,9]],[[7295,9690],[-1,0],[-10,-3],[-4,-3],[-4,-4],[-6,-13],[-7,-11],[-6,-6],[-6,-4],[-4,0],[-3,1],[-4,2],[-2,-2],[-1,-3],[0,-4],[-2,-1],[-2,0],[-6,2],[-3,2],[-1,-3],[-4,-13],[0,-5],[1,-9],[1,-5],[1,-4],[1,-6],[-1,-7],[-6,-12],[-5,-6],[-6,-4],[-6,-3],[-22,-17],[-6,-11],[-4,-8],[-2,-5],[0,-5],[1,-5],[0,-5],[-2,-6],[-3,-3],[-3,-3],[-13,-3],[-4,-2],[-8,-12],[-4,-4],[-5,-2],[-5,-1],[-4,0],[-9,-1],[-4,1],[-8,4],[-6,-1],[-5,-5],[-3,-4],[-1,-4],[-1,-4],[-7,-14]],[[6941,9562],[14,4],[5,6],[2,9],[-4,27],[0,2],[1,1],[1,1],[2,-1],[1,1],[3,9],[-1,24],[6,4],[4,-2],[2,0],[2,2],[19,24],[-10,13],[15,26]],[[7003,9712],[17,-9],[18,-5],[19,-2],[19,2],[15,4],[5,1],[3,-2],[3,-5],[4,-4],[5,-2],[1,1],[2,1],[2,2],[3,0],[2,-1],[1,-3],[1,-3],[4,-1],[12,10],[6,2],[9,1],[32,12],[10,7],[5,2],[7,0],[5,-4],[3,-6],[3,-3],[7,4],[-3,2],[-4,4],[-3,3],[18,8],[17,16],[16,8],[8,-5],[-1,-7],[-1,-13],[1,-8],[12,-6],[6,-8],[1,-12],[2,-3]],[[5325,6375],[7,-19],[4,2],[10,-1],[4,-2],[-9,-36],[10,-28],[-10,-6],[-17,6],[-8,-3],[-6,-10],[1,-24],[-1,-6],[-3,-3],[-2,0],[-6,1],[-3,2],[-2,3],[-1,7],[0,4],[-5,4],[-20,1],[-61,-19],[-9,-6],[-16,-29],[-8,-9],[-2,-3],[-2,-17],[11,-6],[28,1],[22,-12],[-3,-17],[11,-19],[9,-31],[18,-35],[1,-6],[-2,-6],[-4,-3],[-11,-2],[-4,-3],[-2,-5],[3,-17],[-1,-7],[-6,-8],[-3,-5],[1,-7],[14,-15],[3,-8],[0,-9],[-6,-18],[-1,-7],[5,-36],[-4,-19],[0,-20],[-1,-4],[-9,-15],[-2,-6],[0,-8],[0,-8],[12,-39],[-11,-32],[17,-18]],[[5255,5734],[-2,-2],[-4,-13],[3,-37],[-3,-7],[-15,0],[-13,18],[-14,41],[-10,19],[-13,15],[-109,88],[-12,7],[-10,3],[-8,4],[-18,17],[-9,5],[-9,4],[-8,14],[-3,16],[3,8],[6,5],[15,26],[5,11],[-22,-28],[-13,-10],[-14,0],[0,-4],[10,-16],[5,-11],[1,-7],[-6,-1],[-39,22],[-15,5],[-17,6],[-12,-6],[13,-2],[6,-3],[-108,-3],[-7,-3],[-8,-9],[-9,-1],[-7,3],[-7,5],[-7,27],[-2,14],[3,9],[-5,21],[-3,49],[-8,19],[1,7],[-1,14],[-3,15],[-3,11],[-2,4],[-8,7],[-3,4],[-4,6],[0,1],[-1,4],[-1,4],[-2,8],[-2,0],[0,1],[-1,6],[2,3],[5,6],[0,3],[1,3],[0,3],[-1,4],[4,3],[12,14],[3,5],[3,9],[3,30],[6,18],[8,13],[41,38],[12,24],[5,21],[10,29],[2,11],[0,6],[-1,6],[0,5],[3,4],[14,3],[5,4],[5,-1],[6,-2],[5,-1],[6,4],[6,1],[3,3],[5,7],[4,12],[4,5],[8,-1],[25,-11],[11,1],[4,15],[4,8],[4,19],[8,19],[6,20],[4,9],[4,18],[-1,1]],[[8367,9320],[5,-5],[9,-16],[6,-18],[3,-5],[4,-3],[4,-2],[9,-2],[5,-3],[2,-2],[0,-3],[-2,-4],[0,-3],[-1,-9],[-1,-4],[0,-3],[-2,-2],[-2,-4],[-2,-5],[-2,-5],[-2,-3],[-2,-3],[-1,-6],[1,-6],[-1,-4],[-1,-1],[-1,-2],[-2,0],[-2,-1],[-3,0],[-3,-2],[-1,-5],[1,-5],[2,-5],[1,-5],[0,-6],[2,-5],[1,-2],[2,-2],[2,-2],[3,-4],[2,-8],[4,-15],[2,-26],[0,-12],[-1,-6],[-2,-8],[0,-3],[0,-8],[-1,-11],[0,-4],[-4,-11],[-4,-6],[-1,-3],[-1,-3],[-4,-19],[-1,-5],[-2,-6],[0,-6],[1,-4],[1,-6],[-1,-7],[-2,-13],[-1,-7],[-3,-5],[-4,-3],[0,-4],[-7,-25],[-6,-14],[0,-4],[0,-4],[-2,-7],[-2,-4],[-2,-2],[-5,-2],[-3,-3],[-2,-3],[-3,-7],[-2,-2],[-3,-2],[-4,-1],[-4,-2],[-3,-3],[-3,-4],[-2,-4],[1,-4],[6,-6],[4,-3],[2,-3],[0,-4],[2,-20],[-2,-4],[-3,-4],[-3,-4],[-4,-2],[-6,-4],[-4,-7],[-3,-5],[-4,-3],[-8,-2],[-4,-1],[-2,-2],[-2,-3],[-6,-10],[-5,-10],[-4,-5],[-4,-3],[-15,-3],[-4,-1],[-3,-2],[-1,-2],[-3,-5],[-1,-3],[-3,-3],[-3,-3],[-6,-11],[-11,-10],[-6,-10],[0,-5],[0,-5],[6,-15],[3,-14],[1,-4],[2,-4],[4,-2],[14,-2],[4,1],[5,-1],[3,-1],[3,-5],[0,-5],[0,-5],[1,-5],[2,-4],[2,-5],[-1,-4],[-3,-4],[-8,-11],[-3,-4],[-1,-3],[-1,-3],[-1,-2],[-1,-1],[-4,-2],[-12,-4],[-5,-5],[-1,-3],[0,-12],[0,-12],[-5,-17]],[[8222,8521],[-43,14],[-10,-16],[-16,-5],[-8,7],[-16,-11],[-10,-23],[-39,6],[-3,2],[-5,7],[-7,5],[-8,0],[-16,-7],[-15,64],[-6,14],[-16,19],[-6,25],[-4,8],[-4,6],[-6,2],[-5,0],[-13,-11],[-3,-1],[-6,2],[-24,27],[-14,5],[-3,4],[-10,26],[-3,3],[-48,32],[-4,6],[-3,6],[-9,53],[-6,9],[-7,8],[-24,12],[-20,36],[-7,6],[-49,1],[-33,25],[-5,9],[-1,10],[4,20],[4,8],[3,3],[3,2],[3,1],[4,0],[4,-2],[2,-2],[7,-11],[4,-1],[6,3],[5,6],[4,9],[1,9],[-6,98],[4,9],[7,11],[1,4],[0,7],[-4,20],[0,21],[-2,6],[-3,3],[-2,1],[-11,0],[-1,-1],[0,-4],[5,-18],[0,-6],[-14,-38],[-2,-2],[-3,-3],[-3,-1],[-3,1],[-6,4],[-4,1],[-5,0],[-4,-2],[-3,-4],[-3,-11],[-4,-4],[-5,0],[-5,3],[-3,5],[0,6],[37,60],[2,7],[0,5],[-3,12],[-25,16],[-1,2],[0,2],[5,12],[0,4],[0,4],[-3,14],[-4,73],[-9,21],[0,3],[1,3],[3,2],[10,3],[4,3],[2,6],[-1,6],[-12,11],[-1,6],[3,16]],[[7670,9348],[4,8],[2,3],[6,3],[5,3],[4,11],[3,18],[-1,10],[1,5],[2,6],[12,16],[2,4],[-1,4],[2,5],[3,5],[15,8],[12,0]],[[7741,9457],[2,-4],[0,-5],[-2,-3],[0,-3],[2,-6],[5,-4],[4,-1],[4,1],[5,-1],[15,-9],[8,-7],[17,-24],[1,-3],[-1,-2],[0,-3],[3,-1],[7,0],[2,-1],[3,-3],[-1,-4],[0,-4],[4,-3],[4,1],[7,5],[4,1],[1,15],[11,0],[24,-12],[14,1],[10,7],[22,17],[4,-4],[3,1],[3,5],[3,6],[6,-6],[1,-1],[26,-16],[5,-12],[12,-1],[13,4],[8,3],[-1,-11],[3,-10],[5,-10],[8,-6],[2,-3],[1,-5],[1,-3],[5,-3],[5,-1],[3,-3],[3,-3],[2,-3],[18,-7],[15,1],[34,13],[28,4],[8,6],[7,1],[24,-6],[7,-4],[9,-17],[7,-8],[7,1],[12,18],[8,8],[8,3],[13,-11],[1,-2],[-1,-2],[1,-3],[2,-2],[9,-2],[8,1],[17,4],[8,-3],[55,2],[16,-3],[6,3],[3,5]],[[4652,9961],[-5,-36],[8,-12],[-15,-18],[-2,-6],[1,-11],[0,-7],[-2,-3],[-10,-11],[-2,-6],[0,-5],[5,-10],[1,-2],[-1,-3],[-15,-45],[-12,-7],[-4,-14],[-4,-5],[-5,-3],[-20,3],[-3,-41],[-4,-7],[-15,-19],[-2,-4],[-1,-5],[2,-5],[1,-3],[2,-4],[-1,-6],[-14,-41],[16,-60],[-1,-5],[-2,-5],[-2,-7],[0,-8],[13,-40],[0,-16],[-2,-15],[-11,-21],[-4,-4],[-9,-5],[-5,-4],[-10,-21]],[[4518,9414],[-15,-7],[-7,-2],[-56,12],[-8,-4],[-5,-8],[-3,-2],[-5,-1],[-14,4],[-4,-1],[-12,-9],[-4,1],[-3,4],[-2,6],[-3,4],[-3,2],[-3,-1],[-3,-2],[-1,-3],[0,-3],[2,-12],[0,-7],[-1,-6],[-3,-5],[-5,-2],[-17,5],[-13,-20],[-10,-8],[-6,-1],[-6,1],[-14,8],[-33,-7],[-8,-4],[-2,-4],[-1,-4],[0,-2],[-1,-2],[-2,-1],[-16,5],[-32,-12],[-6,-11]],[[4193,9315],[-3,0],[-3,-10],[-5,-10],[-5,-7],[-8,-3],[-9,4],[-5,7],[-5,10],[-6,5],[-6,-13],[-1,-7],[4,-6],[-10,-14],[-5,-4],[-6,6],[2,6],[-6,-3],[-15,-12],[7,-8],[-6,-4],[-15,-5],[-2,-3],[-3,-14],[-4,-1],[-4,-4],[-6,-8],[-7,8],[-1,11],[-2,11],[-10,4],[-6,7],[2,15],[6,16],[6,9],[0,7],[1,10],[3,12],[5,7],[2,5],[3,4],[6,2],[1,1],[13,8],[11,16],[7,7],[10,2],[3,5],[3,9],[-1,10],[-9,5],[-2,-14],[-7,-8],[-10,-5],[-12,-2],[-22,4],[-10,-2],[2,-11],[-10,-11],[-6,-3],[-8,2],[-6,5],[-3,8],[-3,10],[-4,11],[6,0],[4,2],[3,4],[3,7],[-4,7],[-6,4],[-9,4],[0,4],[-2,9],[-1,3],[1,3],[4,4],[1,4],[1,6],[-1,4],[-3,2],[-7,1],[-4,2],[-7,12],[-6,2],[0,-3],[3,-7],[-3,-4],[-4,-1],[-2,1],[-2,8],[-4,1],[-6,-4],[-3,-3],[-4,-6],[-4,-12],[-3,-5],[-2,1],[-5,14],[-4,4],[0,4],[3,6],[10,26],[0,3],[1,5],[1,5],[2,4],[2,5],[-3,4],[-7,5],[-3,15],[4,3],[6,0],[3,6],[2,11],[5,6],[5,3],[2,8],[7,-6],[6,-2],[6,2],[6,6],[2,3],[2,3],[1,3],[4,3],[4,2],[3,1],[8,1],[0,5],[-7,-4],[-10,-2],[-7,0],[0,6],[-14,-8],[-6,1],[-5,11],[22,21],[14,8],[17,-8],[7,0],[8,2],[6,2],[5,5],[6,4],[5,8],[2,10],[3,0],[8,-8],[12,1],[12,4],[8,6],[-10,0],[-5,4],[-6,13],[-2,0],[-6,3],[-4,4],[4,2],[4,0],[18,8],[19,13],[14,4],[3,5],[4,3],[5,1],[5,-3],[14,-15],[8,-3],[8,-1],[17,-6],[8,-2],[13,5],[16,9],[16,6],[15,-7],[24,11],[3,4],[2,5],[3,5],[5,3],[9,3],[2,2],[1,3],[3,2],[24,7],[2,-8],[4,-6],[9,-9],[6,7],[2,5],[-2,15],[5,8],[8,-2],[13,-8],[7,-2],[3,-6],[1,-7],[3,-7],[10,-10],[5,-6],[3,-9],[3,10],[0,9],[-3,19],[0,10],[2,5],[5,5],[9,6],[-9,4],[-8,1],[-15,-1],[-8,2],[-11,12],[-7,3],[8,7],[45,6],[3,1],[3,3],[2,4],[0,4],[-3,1],[-10,-5],[-27,-4],[2,2],[1,1],[3,1],[-2,2],[-4,2],[-5,-8],[-9,-3],[-20,-1],[4,9],[2,13],[2,10],[5,-3],[6,9],[-4,3],[-3,5],[-3,6],[1,7],[1,0],[8,-2],[3,2],[10,-2],[13,7],[65,50],[2,-7],[3,-3],[5,-1],[5,3],[-4,-1],[-2,1],[0,4],[2,1],[2,2],[2,1],[-8,7],[-1,7],[2,7],[1,7],[3,5],[7,2],[15,-1],[13,4],[12,8],[11,10],[9,12],[12,-2],[6,-9],[3,-11],[7,-8],[0,-4],[-3,2],[-4,1],[-3,1],[-3,-5],[-2,-6],[0,-5],[3,-4],[-5,-4],[-1,1],[-4,3],[-3,-3],[-1,-1],[-2,-1],[0,-4],[22,-2],[4,5],[-8,14],[5,3],[6,1],[11,-4],[-1,2],[-1,4],[-1,2],[6,7],[8,7],[9,6],[18,4],[9,7],[8,9],[3,9],[1,2],[3,-2],[4,-5],[1,-6],[-2,-4],[-10,-12],[-1,-9]],[[7003,9196],[10,-1],[18,-7],[29,4],[4,-2],[13,-9],[4,-4],[5,-8],[6,-4],[6,-2],[9,-1],[30,2],[12,-1],[10,-9],[-2,-3],[-2,-4],[-3,-2],[7,-9],[10,-4],[25,0],[33,-42],[17,-13],[1,-3],[0,-5],[0,-4],[2,-4],[2,-1],[7,1],[3,0],[4,-3],[11,-11],[22,-12],[9,-3],[13,-10],[0,-13],[2,-4],[2,-4],[-1,-3],[0,-1],[-1,-2],[0,-3],[1,-6],[2,-5],[-1,-4],[-3,-3],[-4,-1],[-4,0],[-10,5],[-4,1],[-4,0],[-9,-4],[-4,0],[-4,1],[-6,3],[-4,1],[-4,-1],[-3,-3],[-1,-4],[-2,-4],[-2,-4],[-7,-6],[-17,-22],[-2,-4],[-1,-5],[0,-5],[0,-5],[2,-6],[3,-7],[17,-15]],[[7249,8889],[3,-11],[-1,-3],[-4,-14]],[[7247,8861],[-18,-10],[-3,-3],[-8,-5],[-5,-2],[-5,-2],[-10,-1],[-5,2],[-4,4],[-5,4],[-11,4],[-7,1],[-25,6],[-4,3],[-3,4],[-2,9],[-1,4],[1,4],[2,3],[2,2],[1,1],[0,1],[0,1],[-1,3],[-4,8],[-11,10],[-3,3],[-1,5],[-1,5],[1,4],[3,3],[3,2],[4,3],[2,4],[0,4],[-2,4],[-5,3],[-7,1],[-8,1],[-8,-1],[-25,-9],[-5,0],[-4,4],[-3,4],[-1,4],[0,5],[-1,4],[-2,4],[-2,3],[-4,2],[-23,3],[-28,-3],[-12,-4],[-6,-5],[-10,-7],[-4,-2],[-9,1],[-3,0],[-1,-3],[0,-5],[-1,-9],[-1,-9],[-2,-3],[-2,-2],[-2,-2],[-3,-3],[-3,-4],[-1,-4],[-5,-10],[-5,-8],[-1,-3],[-1,-2],[0,-1],[-8,-1],[-13,2],[-16,-1],[-2,-1],[-2,0],[-3,1],[-9,7],[-4,2],[-6,1],[-7,0],[-6,4],[-2,4],[0,4],[2,5],[1,4],[2,5],[1,3],[6,6],[2,4],[2,9],[0,4],[-1,5],[-1,3],[-4,3],[-4,1],[-12,-1],[-6,-4],[-5,-7],[-2,-5],[-2,-5],[-1,-4],[0,-4],[0,-5],[1,-5],[-3,-5],[-5,-6],[-12,-8],[-14,-6],[-17,5]],[[1223,309],[0,-17],[3,-24],[1,-4],[1,-8],[2,-8],[3,-8],[4,-3],[7,-6],[2,-3],[-1,-11],[-4,-11],[-1,-11],[6,-10],[0,-4],[-5,-3],[-3,-5],[-5,-14],[4,-8],[3,-11],[-1,-10],[-7,-4],[-6,-5],[-14,-22],[-6,-7],[-31,-12],[-5,-3],[-3,-1],[-11,-16],[-6,-3],[-4,3],[-4,4],[-5,3],[-19,2],[-8,2],[-7,4],[-24,25],[-4,7],[-2,4],[-9,6],[-4,4],[-2,4],[-13,35],[-3,13],[3,12],[-2,7],[-1,10],[1,10],[2,7],[4,6],[17,11],[8,8],[11,13],[8,15],[-3,15],[5,6],[2,11],[-1,12],[-3,9],[5,1],[5,-1],[5,-1],[4,-3],[6,2],[24,-10],[34,0],[27,-8],[11,4],[-2,21],[13,3],[2,-1],[3,-8],[-1,-5],[-3,-2],[-3,-8]],[[1743,301],[-12,-20],[-13,-18],[-19,-10],[-11,0],[-18,10],[-9,3],[-29,-3],[-6,3],[2,2],[2,7],[1,7],[0,3],[3,1],[15,-3],[9,1],[16,6],[26,15],[32,25],[13,16],[7,11],[5,10],[2,12],[3,31],[4,11],[9,19],[12,44],[2,7],[6,5],[13,27],[10,30],[18,32],[5,31],[6,19],[2,22],[3,8],[4,6],[8,6],[16,8],[17,3],[15,-6],[13,-18],[5,-20],[1,-28],[-3,-53],[-3,-13],[-8,-23],[-2,-9],[0,-21],[0,-6],[2,-4],[4,-9],[0,-5],[-2,-5],[-8,-9],[-2,-4],[0,-6],[0,-6],[-2,-5],[-7,-13],[-4,-11],[-5,-21],[-10,-20],[-15,-10],[-47,-10],[-20,-7],[-15,-13],[-18,-6],[-9,-6],[-14,-20]],[[2092,932],[-2,-10],[2,-8],[2,-9],[1,-11],[-1,-5],[-4,-8],[-1,-4],[0,-6],[0,-11],[0,-5],[-7,-15],[-13,-13],[-14,-10],[-21,-7],[-5,-5],[-3,-6],[-5,-3],[-7,0],[-11,-3],[-7,-1],[-15,-4],[-12,-12],[-10,-16],[-7,-19],[-3,0],[-5,9],[-9,3],[-21,1],[-3,3],[-3,7],[-1,8],[1,3],[5,2],[4,5],[4,10],[2,10],[2,31],[1,8],[15,29],[8,11],[6,5],[7,4],[9,3],[10,1],[8,3],[15,15],[9,7],[8,4],[7,1],[23,0],[6,2],[5,8],[6,15],[4,20],[4,11],[5,9],[8,2],[8,-6],[13,-15],[-4,-13],[-2,-10],[-3,-8],[-9,-7]],[[2077,991],[-11,-10],[-11,2],[0,4],[7,9],[4,14],[4,10],[10,-3],[4,-12],[-7,-14]],[[5972,9518],[-15,-7],[-13,-10],[-5,-9],[-6,-30],[-4,-6],[-11,-9],[-3,-6],[-5,-20],[-11,2],[-3,-2],[-1,-3],[-1,-4],[-1,-43],[-2,-6],[-9,-14],[-1,-4],[1,-5],[4,-4],[14,-9],[3,-4],[0,-4],[-5,-9],[-2,-9],[1,-29],[-9,-48],[12,-5],[0,-12],[-11,-72],[1,-12],[-27,-5],[-4,-22],[17,5],[-6,-31],[-21,-4]],[[5849,9068],[-16,5],[-1,-19],[-10,4],[-13,22],[-9,-2],[-5,-3],[-10,-13],[-10,-7],[-11,-4],[-11,5],[-5,-1],[-3,-3],[-6,-10],[-4,-14],[-1,-2],[-1,-2],[-1,0],[-2,0],[-2,1],[-5,-2],[-10,-8],[-6,0],[-13,12],[-4,1],[-9,-6],[-3,-12],[5,-38],[-5,-32],[5,-26]],[[5683,8914],[-20,-6]],[[5663,8908],[-44,41]],[[5619,8949],[-9,0],[-5,-21],[-32,12],[1,12],[0,3],[-1,3],[-8,10],[-6,4],[-11,4],[2,-13],[-30,-4],[-5,14],[-37,-11],[-14,2],[-6,13],[-4,5],[-5,0],[-2,-2],[-2,-4],[-1,-2],[-3,-1],[-5,0],[-2,-1],[-6,-5],[-2,0],[-40,19],[-70,-5],[-5,1],[-13,11],[-16,6],[-5,5],[-5,10],[-4,4],[-4,-1],[-9,-4],[-39,1],[-28,-11],[-15,10],[-15,4],[-26,-1],[-12,6],[-5,1],[-16,-2],[-6,2],[-35,22]],[[5058,9045],[6,6],[6,12],[5,6],[2,4],[1,5],[0,4],[0,9],[0,4],[1,5],[-2,6],[-7,7],[-15,10],[-22,20],[3,1],[2,2],[3,5],[2,4],[2,5],[1,11],[1,5],[-6,13],[-31,9],[-3,1],[-5,5],[-5,2],[-5,0],[-9,-3],[-4,-2],[-2,-2],[-1,-2],[-2,-1],[-5,-1],[-19,4],[-20,1]],[[4930,9200],[4,12],[0,11],[1,5],[8,18],[0,7],[-1,18],[2,5],[3,4],[4,2],[4,4],[1,4],[-2,4],[-3,3],[-3,5],[-2,5],[-2,8],[1,6],[2,5],[5,7],[2,2],[13,6],[10,10],[4,1],[4,-1],[4,0],[4,2],[5,5],[10,14],[14,17],[3,6],[2,7],[0,5],[-4,15],[1,8],[7,9],[2,5],[1,5],[4,6]],[[5709,9040],[7,5],[0,13],[-3,12],[-9,-2],[-8,-7],[0,-11],[5,-9],[8,-1]],[[8691,8626],[-10,-6],[-72,4],[-3,-1],[-3,-3],[-8,-13],[-4,-16],[1,-15],[-1,-5],[-5,-4],[-12,-4],[-6,-1],[-19,6],[-4,-1],[-1,-3],[0,-10],[0,-5],[-7,-15],[-10,-13],[-15,-5],[-4,-4],[-6,-17],[-5,-6],[-34,-8],[-5,1],[-12,9],[-4,1],[-2,-2],[-2,-2],[-3,-7],[-5,-6],[-21,0],[-10,-8],[-51,-12],[-11,2],[-12,11],[-3,2],[-4,-1],[-3,-4],[-4,-10],[-3,-4],[-5,-3],[-5,0],[-4,2],[-4,5],[-8,18],[-4,3],[-4,1],[-4,-2],[-3,-4],[-3,-30],[-21,1],[-11,-28]],[[8232,8414],[-3,14],[0,14],[11,27],[-2,10],[-4,9],[-6,6],[-7,4],[-4,1],[-1,12],[6,10]],[[8367,9320],[1,1],[0,10],[-3,10],[-5,6],[-7,3],[3,6],[2,3],[3,2],[-5,7],[6,18],[-1,13],[3,9],[10,4],[12,1],[8,-1],[15,-6],[8,-2],[9,1],[7,-1],[19,-12],[14,-5],[3,-3],[7,-8],[5,-2],[4,3],[5,3],[4,2],[4,-2],[7,-6],[4,-2],[38,-3],[9,-3],[8,-7],[4,-9],[3,-10],[5,-8],[8,-6],[5,0],[14,5],[55,-1],[11,-3],[-2,-8],[2,-3],[4,0],[4,-2],[8,-15],[8,-12],[8,-21],[6,-9],[-2,-3],[-2,-7],[-1,-6],[4,-2],[0,-2],[-8,-14],[-1,-7],[10,2],[8,-7],[1,-10],[-9,-7],[-2,0],[-8,-4],[13,-21],[0,-7],[5,-4],[27,-4],[4,1],[5,3],[3,3],[2,4],[2,3],[13,1],[15,2],[14,6],[5,17],[2,2],[1,1],[1,-1],[2,-2],[5,-2],[5,0],[5,3],[4,5],[2,-1],[1,-1],[0,-2],[0,-2]],[[4930,9200],[-14,-28],[-16,-11],[-5,-8],[-23,-63],[-24,50],[-6,5],[-23,7],[-18,-4],[-4,2],[-16,14],[-5,-7],[-46,-24],[-25,8],[-18,-3],[-43,30],[-16,1],[-1,-1],[-12,13],[-36,20],[-16,1],[2,19],[-1,6],[-2,6],[-14,14]],[[4548,9247],[17,35],[1,20],[2,7],[8,12],[0,9],[-5,6],[-15,5],[-8,6],[-21,25],[-1,9],[7,29],[-15,4]],[[4652,9961],[2,-3],[4,1],[4,2],[0,1],[0,3],[1,3],[3,2],[3,0],[8,4],[1,-9],[11,-21],[-1,-10],[4,2],[6,7],[3,9],[6,-2],[4,3],[4,5],[6,3],[18,-2],[5,-2],[37,-21],[18,-7],[28,-51],[21,-10],[-2,-3],[-1,-2],[-1,-1],[-3,-2],[0,-5],[6,-3],[4,2],[3,3],[6,3],[6,0],[9,-3],[17,-3],[27,1],[8,5],[7,-5],[8,-1],[5,-4],[1,-12],[-3,-7],[-5,-7],[-2,-9],[3,-8]],[[6152,8058],[1,15],[9,9],[10,-3]],[[6666,7692],[-1,6],[-1,2],[-8,5],[-18,-6],[-27,-16],[-18,-3],[-6,-2],[-5,1],[-8,7],[-15,-7],[-43,2],[-6,-6],[-3,-7],[-2,-3],[-4,-2],[-18,-5],[-3,-2],[-3,-2],[-3,-3],[-1,0],[-8,-3],[-7,-3],[-2,-2],[0,-9],[-1,-3],[-3,-2],[-11,-3],[-8,-6],[-5,-3],[-8,-1],[-5,-1],[-3,-2],[-3,-3],[-4,-5],[-6,-7],[-4,-2],[-7,-6],[-3,-4],[-6,-1],[-7,1],[-14,9],[-5,6],[-2,4],[4,4],[5,3],[28,9],[5,1],[2,2],[8,9],[2,2],[8,3],[7,6],[21,24],[6,3],[3,1],[5,4],[2,1],[1,3],[4,6],[1,2],[4,13],[1,3],[0,6],[0,3],[-2,3],[-4,5],[-22,11],[-8,1],[-7,2],[-7,1],[-11,-2],[-5,2],[-3,1],[-3,2],[-7,11],[-3,3],[-3,1],[-8,-2],[-4,0],[-4,4],[-3,3],[-2,3],[-2,2],[-21,5],[-15,8],[-23,8],[-6,3],[-4,3],[-2,5],[-3,4],[-3,3],[-4,3],[-10,4],[-4,1],[-4,-3],[-4,-3],[-6,-2],[-8,1],[-7,2],[-13,14],[-2,4],[-4,2],[-4,0],[-11,-7],[-11,-2],[-5,-4],[-3,-3],[-3,-7],[-4,-6],[-3,-3],[-6,-6],[-2,-1],[-2,0],[-6,8],[-7,3],[-4,3],[-3,4],[-3,8],[-1,4],[0,5],[1,9],[-1,4],[-2,4],[-2,2],[-3,1],[-2,-1],[-6,-9],[-2,-4],[-3,-4],[-13,-15],[-3,-5],[-4,-5],[-6,-5],[-13,-6],[-6,-4],[-4,-4],[-2,-4],[-5,-2],[-5,-1],[-7,2],[-10,7]],[[6223,8076],[13,20],[1,4],[18,27],[4,4],[9,5],[6,0],[5,-1],[3,-2],[4,0],[11,2],[2,1],[3,3],[1,5],[2,4],[4,9],[1,5],[0,9],[1,5],[2,4],[3,6],[1,5],[0,5],[-1,8],[0,5],[2,4],[6,11],[6,9],[4,6],[4,5],[5,4],[38,14],[4,2],[4,4],[6,10],[3,4],[2,5],[5,9],[4,6],[7,6],[19,14],[8,10],[8,10],[3,5],[3,4],[5,5],[14,9],[21,5]],[[6394,5630],[-12,4],[-16,6],[-22,-6],[-32,-10],[-42,13],[-11,-2],[-13,-12],[-39,-6],[-12,-2],[-79,7],[-8,-2],[-6,-6],[-12,-24],[-3,-5],[-6,-8],[-4,-9],[-2,-10],[-13,-24],[-28,-5],[-13,-26],[-15,-12],[-4,-3],[-10,-4],[-18,-5],[-19,1],[-51,7],[-10,1],[-5,-2],[-5,-4],[-31,-25],[-30,-3],[-21,-14],[-5,-2],[-17,-3],[-7,-2],[-5,-4],[-6,-9],[-13,-24],[0,-6],[-7,-23],[-4,-9]],[[5787,5796],[100,67],[7,13],[-20,13],[-4,8],[0,2],[2,1],[3,3],[5,1],[6,0],[18,-8],[4,1],[4,4],[3,9],[3,3],[4,-1],[19,-21],[8,3],[18,11],[7,9],[2,12],[-8,19],[7,9],[29,-2]],[[6778,4727],[-14,-6],[-9,11],[-1,17],[8,10],[12,-26],[4,-6]],[[7743,6228],[6,-23],[-9,12],[-2,18],[1,20],[-2,18],[2,0],[1,-1],[0,-2],[0,-1],[2,-3],[2,-6],[2,-4],[-4,-14],[1,-14]],[[7734,6317],[2,-25],[-2,-6],[-12,17],[-11,-33],[-6,-5],[-10,-4],[-3,-8],[1,-12],[15,-29],[4,-6],[14,-10],[11,-6],[8,-1],[4,8],[8,-6],[3,-7],[-1,-7],[-7,-6],[-3,-4],[-4,-3],[-4,0],[-4,3],[-4,-3],[-13,-5],[-7,-1],[-13,-8],[-16,0],[-6,-1],[-6,-3],[-11,-9],[-4,4],[-18,9],[-14,3],[-28,1],[-8,-1],[-7,-3],[-5,-5],[-3,-6],[2,-6],[5,-10],[-14,3],[-14,4],[-2,7],[-3,5],[-9,2],[-13,6],[-6,2],[-7,-8],[-2,-5],[-12,0],[-15,2],[-13,-7],[-7,-6],[-20,-21],[-8,-5],[-8,-2],[-3,-2],[-3,-3],[-4,-3],[-1,-3],[-1,-3],[-5,-20],[0,-5],[-4,-3],[-3,1],[-2,2],[-3,0],[-4,-2],[-9,-9],[-4,-2],[-7,-1],[-22,-11],[-10,-7]],[[7549,9139],[-6,-1],[-3,6],[1,7],[4,5],[6,3],[4,3],[2,-3],[0,-7],[-3,-8],[-5,-5]],[[7598,9159],[-4,-2],[-5,0],[-10,2],[-6,2],[-5,4],[0,6],[3,7],[1,4],[6,5],[3,1],[3,-1],[1,-4],[1,-8],[4,-2],[4,-5],[4,-3],[0,-6]],[[7670,9348],[-9,-4],[-12,-12],[-6,-4],[-5,-2],[-21,-6],[-3,-4],[-2,-4],[1,-5],[-1,-4],[-2,-8],[-2,-4],[-5,-3],[-9,0],[-4,1],[-27,-3],[-3,-4],[-1,-4],[0,-3],[0,-3],[-5,-3],[-3,0],[2,-2],[7,-3],[-1,-3],[-3,-3],[-11,-7],[-4,-6],[-4,-6],[-1,-5],[-3,-2],[-3,-2],[-4,-1],[-8,2],[-5,0],[-3,-3],[-3,-4],[-3,-6],[-2,-5],[-1,-4],[1,-4],[1,-4],[2,-4],[1,-2],[1,-4],[-4,-7],[-6,-11],[-12,-11],[-9,-16],[-3,-11],[-1,-7],[1,-5],[1,-3],[3,-2],[3,-4],[1,-4],[-2,-5],[-13,-16],[-9,-14],[-3,-8],[-2,-7],[0,-4],[-2,-10],[-2,-6],[-4,-9],[-1,-6],[-1,-5],[1,-4],[2,-5],[3,-4],[2,-4],[1,-4],[1,-5],[0,-13],[1,-5],[-1,-8],[1,-5],[3,-3],[6,-6],[2,-4],[2,-4],[1,-4],[2,-5],[3,-3],[4,-2],[4,-2],[4,0],[3,-2],[2,-6],[-2,-10],[-3,-6],[-9,-13],[-8,-14],[-6,-15],[-2,-4],[-2,-6],[-4,-7],[-5,-4],[-2,-6],[-3,-3],[-2,-2],[-3,2],[-8,2],[-4,0],[-13,5],[-3,0],[-4,-1],[-2,-1],[-7,-4],[-8,-1],[-4,-1],[-4,1],[-8,3],[-7,5],[-3,3],[-5,8],[-3,3],[-4,3],[-7,3],[-8,3],[-4,-1],[-9,-4],[-4,0],[-4,1],[-9,3],[-4,3],[-3,3],[-6,7],[-3,4],[-3,2],[-4,1],[-17,2],[-4,-1],[-5,3],[-1,1],[-1,0],[-1,1],[-5,-1]],[[7295,9690],[1,-2],[4,1],[6,2],[9,2],[9,4],[4,-1],[9,-4],[4,-3],[0,-3],[-1,-4],[0,-5],[4,-11],[2,-3],[5,-2],[5,-1],[6,1],[5,3],[2,5],[4,11],[6,4],[9,-1],[14,-4],[18,-10],[5,1],[5,2],[6,0],[12,-14],[2,-22],[-5,-25],[-7,-19],[-5,-8],[-18,-20],[-4,-6],[5,-13],[9,-9],[9,-6],[11,-3],[12,-1],[8,2],[4,9],[1,16],[3,12],[8,9],[10,4],[10,-3],[-10,-8],[-3,-8],[2,-8],[7,-9],[9,-5],[25,-5],[16,-9],[14,-12],[17,2],[4,-2],[7,-4],[3,-3],[16,-2],[7,-2],[5,-7],[16,-12],[17,-5],[35,-3],[35,6],[11,-4],[7,-18]],[[5058,9045],[-7,-9],[-1,-4],[-2,-8],[-2,-1],[-9,2],[-6,0],[-10,-2],[-7,-5],[-7,-5],[-15,-16],[-4,-6],[-2,-4],[-4,-16],[-4,-4],[-3,-3],[-4,-1],[-3,-4],[-11,-17],[-6,-6],[-2,-5],[1,-4],[3,-3],[3,-3],[4,-1],[9,0],[3,-2],[4,-7],[1,-2],[0,-3],[-8,-19],[-1,-5],[-1,-4],[2,-5],[0,-7]],[[4969,8866],[-4,2],[-10,-8],[-16,-7],[-14,6],[-14,13],[-14,9],[-6,-1],[-8,-5],[-7,-5],[-3,-4],[-1,-8],[3,-20],[-1,-10],[-5,-8],[-4,-6],[-15,-10],[-32,-11],[-8,-1],[-16,0],[-6,-1],[-6,-4],[-11,-13],[-6,-5],[-2,9],[-4,11],[-6,8],[-6,3],[-4,0],[-7,5],[-3,0],[-4,-3],[-1,-4],[0,-4],[-2,-4],[-7,-5],[-9,-4],[-10,-1],[-8,1],[-7,4],[0,6],[7,19],[-24,1],[-8,4],[-12,9],[-7,2],[-13,-6],[-27,-7],[-12,0],[-5,-1],[-2,-4],[-1,-4],[-3,-3],[-15,0],[-3,18],[-1,16],[-9,-3],[-2,-7],[-2,-11],[-4,-8],[-8,0],[-7,1],[-7,-3],[-5,-6],[-5,-7],[-14,-16],[-1,0],[-19,-6],[-38,3],[0,1],[2,15],[-1,8],[-4,5],[-15,6],[-6,11],[1,12],[4,11],[18,26],[12,14],[13,8],[7,6],[5,8],[1,11],[-3,9],[-7,7],[-9,4],[-9,-1],[-8,-4],[-7,-2],[-5,5],[-2,10],[2,26],[-4,10],[-4,6]],[[4419,8984],[17,12],[2,23],[6,22],[-31,-9],[-5,3],[-10,13],[-3,6],[0,7],[6,23],[-6,2],[-5,3],[-14,23],[0,4],[1,10],[-1,4],[-7,14],[-4,12],[2,33],[-1,4],[17,-1],[24,26],[15,5],[18,20],[12,-15],[36,2],[21,-6],[3,2],[9,16],[3,1],[12,-2],[12,6]],[[6276,8745],[-25,4],[-11,20],[-13,-5],[-39,4],[-8,-2],[-15,-14],[-9,-5],[-39,6],[-6,-2],[-10,-8],[-3,-1],[-9,2],[-14,9],[1,36],[-13,-10],[-23,-4],[-26,29],[-4,14],[-2,3],[-7,4],[-3,1],[-3,-1],[-8,-5],[-7,-6],[-9,-17],[-13,-16],[-14,-5],[-22,50],[-13,20],[-27,-10],[-9,12],[-17,-13],[-8,15],[15,30],[2,10],[1,3],[3,3],[4,1],[2,3],[1,5],[-2,13],[1,4],[7,11],[2,6],[1,7],[-2,36],[-45,2],[6,19],[-2,28],[7,37]],[[4419,8984],[-14,-10],[-8,-4],[-7,0],[-4,-1],[-4,-2],[-11,-11],[-8,-4],[-68,-12],[-9,-3],[-15,-11],[-8,-4],[-16,0],[-8,-2],[-8,-6],[-3,-6],[-5,-13],[-4,-6],[-9,-7],[-11,-3],[-10,-6],[-5,-3],[-5,-11],[-7,-9],[-8,-7],[-9,-3],[-8,-5],[-7,-9],[-7,-6],[-7,3],[1,8],[-9,121],[2,10],[4,5],[18,0],[8,3],[4,5],[-3,5],[-8,4],[-2,4],[2,2],[12,7],[1,2],[1,6],[2,6],[5,3],[2,1],[8,11],[24,19],[6,2],[2,2],[14,14],[8,3],[9,6],[3,4],[1,5],[0,19],[0,4],[-2,0],[-4,-1],[-6,-7],[-5,-11],[-6,-11],[-11,-5],[-9,-2],[-24,-12],[-5,-5],[-5,-1],[-23,1],[-9,-3],[2,8],[4,14],[0,8],[3,0],[6,-9],[3,4],[0,20],[-1,5],[-1,3],[2,2],[6,1],[16,-4],[2,2],[4,8],[16,20],[8,8],[15,10],[6,6],[3,9],[-4,-2],[-3,0],[-5,2],[-4,-1],[-1,0],[-1,-1],[-10,-6],[-11,-9],[-6,-4],[-10,-3],[-14,-1],[-14,2],[-11,6],[-4,7],[-2,12],[-3,7],[-6,3],[-15,3],[-3,2],[3,6],[8,6],[9,3],[7,2],[5,-2],[4,-5],[0,-6],[-6,-4],[4,-2],[6,-3],[7,-1],[4,2],[2,6],[-1,7],[0,7],[5,5],[-5,21],[-1,11],[2,9],[4,8],[5,5],[6,1],[6,8],[16,38],[4,14]],[[5722,8382],[12,9],[4,0],[4,-2],[6,-10],[3,-4],[6,-1],[10,0],[6,-2],[22,-21]],[[5018,7823],[0,6],[1,4],[3,4],[19,15],[4,4],[8,15],[-15,15],[-10,18],[-3,20],[8,22],[11,16],[1,7],[-2,11],[-5,8],[-5,6],[-4,6],[-1,11],[3,10],[10,20],[3,10],[0,8],[-1,11],[-3,21],[-6,20],[-1,9],[0,11],[1,7],[1,3],[1,3],[-2,7],[0,4],[0,16],[8,2],[1,8],[-2,8],[-5,4],[-6,2],[-4,5],[-4,13],[-9,25],[-6,11],[-14,16],[-5,7],[-1,8],[5,8],[2,11],[9,5],[28,-2],[12,1],[6,7],[17,27],[4,11],[-1,16],[2,4],[5,8],[16,14],[3,5],[3,9],[16,25],[5,6],[8,2],[29,0],[4,3],[26,12],[6,5]],[[5192,8457],[71,-14],[86,-51],[9,9],[23,-2],[11,-5],[3,-3],[1,-4],[0,-5],[-2,-8],[0,-2],[9,-9],[3,-1],[4,1],[5,7],[2,1],[3,0],[1,-4],[2,-4],[1,-4],[6,-2],[6,2],[5,4],[3,7],[0,4],[-2,7],[-1,16],[2,10],[4,7],[8,1],[35,-11],[44,7],[17,11],[6,-1],[13,-18],[9,-4],[27,-1],[24,-19],[39,5],[3,-23],[2,-1],[15,-1],[3,-2],[9,-12],[3,-2],[4,-1],[5,0],[4,2],[2,3],[1,4],[2,31]],[[125,96],[-18,-34],[-1,-4],[1,-3],[0,-4],[-2,-4],[-2,-2],[-2,-1],[-2,-2],[-1,-3],[-2,-4],[-3,-3],[-3,-4],[-2,-6],[-1,-14],[-4,-8],[-6,0],[-10,7],[-6,9],[-4,8],[-6,6],[-33,6],[-9,5],[-6,9],[-3,21],[12,7],[19,-2],[18,-5],[7,5],[17,21],[3,6],[1,6],[2,3],[9,6],[16,12],[8,-2],[8,-5],[6,-8],[2,-8],[-3,-11]],[[427,238],[-12,-5],[-11,4],[-23,18],[-15,27],[0,22],[2,23],[13,23],[22,6],[21,-7],[19,-15],[24,-22],[5,-14],[3,-14],[-7,-12],[-9,-7],[-13,-16],[-10,-8],[-9,-3]],[[911,576],[-5,-18],[-13,-12],[-33,-22],[-7,-17],[-9,-11],[-13,-16],[-12,-12],[-8,-4],[-6,-7],[-5,-11],[0,-13],[3,-11],[1,-6],[-2,-6],[-4,-5],[-4,-5],[-3,-14],[-14,-34],[-4,-27],[0,-11],[-6,-10],[-7,-11],[-29,-36],[-6,-13],[-5,-8],[-15,4],[-24,-11],[-10,-5],[-9,-4],[-7,1],[-5,9],[-1,6],[1,7],[-4,2],[-3,4],[-2,5],[-1,12],[0,4],[-7,10],[-17,21],[-3,10],[-3,13],[-7,10],[-7,9],[-5,8],[-3,27],[-2,6],[-6,12],[-5,14],[-15,19],[-4,12],[11,9],[24,14],[9,-5],[10,-9],[5,-2],[6,0],[12,5],[10,6],[15,6],[10,5],[9,-3],[17,2],[9,1],[9,9],[11,1],[5,3],[10,1],[9,9],[20,23],[9,9],[3,6],[1,9],[2,3],[8,6],[4,3],[7,6],[10,2],[9,4],[2,12],[8,-4],[43,-1],[27,12],[11,-7]],[[134,742],[11,-3],[18,8],[8,-4],[8,-8],[4,-7],[-1,-12],[3,-15],[4,-10],[9,-6],[0,-11],[-13,-19],[-6,-14],[3,-12],[5,-23],[-3,-11],[-3,-16],[-10,-18],[-9,-24],[-8,-21],[-5,-13],[-2,0],[-3,6],[-10,7],[-3,12],[-3,30],[-5,7],[-4,10],[-9,16],[-2,13],[-17,33],[-2,16],[-2,10],[-2,9],[-7,7],[-5,7],[3,18],[11,21],[16,17],[11,9],[9,-7],[11,-2]],[[6498,8627],[3,-13],[2,-5],[3,-5],[19,-11],[3,1],[8,4],[3,0],[6,-4],[4,-4],[1,-3],[2,-15],[1,-3],[2,-2],[14,-9],[15,-3],[4,-2],[1,-3],[0,-3],[-4,-27],[1,-10],[5,-7],[60,-47]],[[5983,8366],[23,27],[0,14],[31,35],[-12,12],[4,14],[18,-11],[10,10],[28,-17],[1,7],[-1,4],[-9,16],[-1,4],[-1,14],[-8,28],[13,0],[35,20],[19,-2],[18,8],[32,0],[38,16],[14,2],[53,21],[7,8],[4,8],[4,27]],[[5303,5733],[4,0],[13,18],[-9,-6],[-11,-5],[-12,-1],[-8,8],[-19,-8],[-6,-5]],[[7247,8861],[2,-30],[7,-20],[9,-14],[0,-5],[-1,-5],[-1,-5],[-2,-4],[-3,-4],[-5,-9],[-1,-6],[1,-5],[3,-3],[8,-12],[3,-8],[1,-5],[3,-3],[3,-2],[5,-6],[-2,-8],[-2,-6],[-3,-6],[-3,-10],[-4,-6],[-4,-2],[-4,0],[-5,-1],[-4,-2],[-5,-6],[-4,-4],[-9,-5],[-7,-9],[-3,-4],[-3,-3],[-3,-1],[-9,3],[-3,1],[-3,0],[-2,0],[-3,-2],[-2,-2],[-3,-4],[-2,-4],[1,-4],[1,-4],[2,-3],[3,-17],[-1,-22],[1,-10],[3,-7],[3,-4],[3,-4],[1,-6],[3,-26],[-2,-3],[-4,-1],[-4,-1],[-5,-2],[-7,-4],[-8,-6],[-4,-2],[-3,0],[-3,2],[-2,4],[0,4],[1,6],[0,4],[-1,5],[-2,3],[-3,3],[-8,3],[-13,2],[-5,-3],[-2,-4],[-2,-5],[0,-5],[0,-5],[-1,-5],[-3,-14],[-2,-5],[-3,-4],[-3,-2],[-3,-1],[-3,-3],[-3,-4],[-2,-11],[-1,-21],[4,-8],[2,-4],[1,-4],[3,-23],[1,-23],[2,-5],[3,-3],[4,-1],[8,-2],[4,0],[4,-1],[4,-2],[10,-8],[4,-5]],[[8794,8389],[-38,-3],[-112,-44],[-31,-8],[-3,-3],[-8,-14],[-2,-5],[-2,-4],[-5,-2],[-10,7],[-4,1],[-19,-1],[-19,-3],[-17,-8],[-12,-8],[-50,-52],[-24,-35],[-49,-52],[-8,-18],[12,-7],[12,-6],[6,1],[2,3],[-2,4],[-6,5],[8,0],[6,-4],[5,-5],[11,-14],[11,-10],[5,0],[9,-3],[0,-13],[-7,-13],[-4,-6],[-29,-9],[-12,-12],[-22,-36],[-13,-12],[-13,-5],[-14,-2],[-11,18],[22,3],[10,-8],[14,10],[17,27],[-9,1],[-14,-1],[-37,-13],[-8,-6],[-8,-8],[-6,-11],[-11,-29]],[[8149,8103],[-3,8],[3,2],[24,15],[3,4],[4,8],[8,11],[3,4],[2,4],[0,5],[-5,11],[-1,5],[-1,6],[0,5],[-3,10],[1,6],[1,5],[2,5],[1,4],[1,4],[6,9],[1,6],[3,4],[2,15],[-7,22],[-7,6],[-7,3],[-7,6],[-5,17]],[[8168,8313],[-2,9],[-2,3],[-1,5],[0,4],[1,5],[1,5],[2,3],[5,3],[4,0],[4,1],[2,3],[2,3],[3,3],[8,2],[4,2],[3,4],[3,4],[3,11],[0,5],[1,5],[2,5],[4,4],[6,5],[6,2],[4,3],[1,2]],[[7720,7575],[-24,-14],[-6,-1],[-8,-1],[-5,2],[-4,3],[-2,3],[0,5],[0,5],[0,4],[-1,4],[-2,4],[-1,4],[0,4],[1,4],[1,4],[1,5],[-2,5],[-6,8],[-22,11],[-8,3],[-4,1],[-8,-2],[-16,1],[-11,-2],[-8,-3],[-4,-1],[-11,-3],[-7,5]],[[7555,7658],[11,3],[21,11],[3,3],[3,3],[1,5],[0,4],[-2,4],[-6,7],[-14,13],[-11,8],[-29,3],[-9,5],[-3,3],[-1,4],[0,3],[-1,3],[-2,2],[-3,2],[-3,3],[-3,4],[-2,4],[-4,9],[-3,8],[-1,3],[-3,1],[-6,-5],[-3,-4],[-1,-6],[2,-9],[0,-5],[-3,-4],[-8,-4],[-9,-2],[-14,0],[-24,6]],[[7351,8237],[30,-2],[13,6],[14,1],[9,-4],[4,1],[4,5],[3,7],[0,7],[-3,13],[-1,7],[3,5],[10,4],[3,3],[2,4],[4,11],[2,4],[5,4],[5,2],[5,0],[5,-2],[13,-10],[27,0],[5,4],[2,7],[-2,6],[-2,6],[-2,6],[0,4],[5,13],[4,3],[5,2],[9,1],[21,-10],[4,0],[16,9],[6,12],[2,2],[2,1],[6,-1],[38,-27],[1,-7],[2,-4],[3,-3],[15,-8],[4,0],[3,2],[24,29],[27,-23],[4,-1],[6,2],[4,5],[9,31],[4,5],[5,1],[5,-4],[21,-27],[37,49],[-15,29],[8,6],[-2,38],[1,7],[4,3],[4,0],[4,-4],[30,-53],[4,-4],[3,1],[3,6],[1,4],[0,3],[-6,17],[-17,30],[-2,7],[1,6],[5,4],[26,1],[3,-2],[3,-4],[2,-11],[2,-3],[2,-2],[9,-1],[2,-2],[5,-10],[11,-16],[30,-19],[11,9],[20,-25],[103,-50],[8,-8],[17,-42],[9,-3],[2,2],[4,9],[2,3],[2,1],[4,2],[21,0],[11,-6],[10,-1],[22,3]],[[7986,7474],[-3,-6],[-1,-15],[-3,-10],[-5,-8],[-10,-13],[-6,-9],[-6,-11],[-2,-10],[-3,-8],[-14,-22],[-5,-11],[-3,-22],[1,-31],[3,-26],[9,-41],[28,-66],[5,-10],[5,-11],[-5,-4],[-7,-6],[3,-11],[4,-22],[8,-21],[11,-22],[12,-25],[16,-32],[7,-9],[16,-14],[17,-19]],[[5663,8908],[-7,-40],[-21,11],[6,14],[-16,31],[-6,25]],[[5722,8382],[-16,-2],[-7,10],[14,15],[5,9],[2,12],[-2,25],[-2,8],[-9,17],[-2,6],[-1,9],[4,33],[-3,4],[-3,3],[-2,7],[-1,10],[1,10],[3,9],[5,7],[6,4],[19,3],[4,3],[12,13],[-27,21],[-2,6],[2,5],[3,5],[1,5],[-1,5],[-14,6],[-4,10],[-2,25],[-4,10],[-15,20],[-9,26],[49,32],[-10,23],[-2,13],[1,13],[3,10],[1,8],[-4,14],[0,7],[11,15],[-43,38]],[[6672,9731],[9,-3],[8,-1],[10,8],[14,-9],[22,-20],[0,5],[-5,15],[-1,8],[-3,4],[0,3],[2,3],[6,2],[5,6],[20,12],[7,2],[0,5],[-3,0],[0,3],[7,5],[11,1],[23,-1],[21,2],[9,4],[8,3],[6,-1],[9,-8],[9,-8],[3,-7],[6,-16],[1,-13],[2,3],[4,11],[0,3],[0,4],[0,3],[2,3],[6,1],[5,-2],[5,-2],[14,-2],[25,-12],[20,-4],[10,-4],[8,-13],[26,-12]],[[5192,8457],[8,7],[15,16],[14,23],[1,1],[6,-1],[2,0],[1,4],[0,5],[0,3],[-1,1],[5,4],[7,3],[13,1],[0,5],[17,29],[1,4],[-2,4],[0,5],[3,6],[11,13],[22,33],[-5,6],[-6,9],[-19,21],[-20,13],[-22,8],[-36,8],[-6,0],[-3,-2],[-3,-4],[-6,-5],[-6,-3],[-5,-1],[-13,5],[-6,9],[-2,13],[-1,11],[-2,6],[-3,5],[-1,6],[2,5],[3,6],[2,5],[11,51],[5,12],[-11,4],[-8,1],[-4,4],[4,27],[-2,10],[-6,8],[-11,4],[-6,-13],[-15,-5],[-31,-1],[-14,4],[-16,26],[-13,3],[-3,-19],[-11,-7],[-27,-2],[-13,3],[-11,9],[-6,3]]],"transform":{"scale":[0.00225065638073807,0.0016152819708970863],"translate":[-18.16722571499986,27.64223867400007]}};
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
