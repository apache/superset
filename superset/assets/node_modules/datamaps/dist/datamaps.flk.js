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
  Datamap.prototype.espTopo = '__ESP__';
  Datamap.prototype.estTopo = '__EST__';
  Datamap.prototype.ethTopo = '__ETH__';
  Datamap.prototype.finTopo = '__FIN__';
  Datamap.prototype.fjiTopo = '__FJI__';
  Datamap.prototype.flkTopo = {"type":"Topology","objects":{"flk":{"type":"GeometryCollection","geometries":[{"type":"MultiPolygon","properties":{"name":"Falkland Islands"},"id":"FK","arcs":[[[0]],[[1]],[[2]],[[3]],[[4]],[[5]],[[6]],[[7]],[[8]],[[9]],[[10]],[[11]],[[12]],[[13]],[[14]],[[15]],[[16]],[[17]],[[18]],[[19]],[[20]],[[21]],[[22]]]}]}},"arcs":[[[5904,5],[-6,-5],[-19,55],[7,96],[17,20],[18,-16],[2,-53],[-8,-28],[-1,-10],[0,-14],[1,-28],[-3,-10],[-8,-7]],[[6170,2561],[-21,-22],[-45,6],[-44,30],[10,33],[30,21],[167,46],[68,-37],[-5,-10],[-105,-35],[-7,-11],[-48,-21]],[[4396,3004],[62,-48],[109,17],[76,44],[34,-64],[-71,-61],[-56,-65],[-24,-76],[-76,43],[-62,48],[-43,53],[-71,-11],[-34,64],[-62,54],[85,81],[71,23],[-10,59],[46,92],[71,28],[95,1],[10,-59],[-66,-23],[0,-70],[-51,-60],[-33,-70]],[[4286,4144],[45,-144],[138,18],[59,-17],[42,-69],[-13,-25],[-11,-35],[-10,-42],[-6,-47],[49,-39],[-6,-71],[-40,-68],[-50,-31],[-23,-7],[-29,-19],[-24,-29],[-23,-79],[-26,3],[-22,37],[-3,63],[-1,8],[-2,8],[-4,8],[-5,7],[30,39],[26,68],[12,85],[-9,92],[-35,67],[-45,33],[-39,41],[-17,89],[14,99],[28,-43]],[[8019,4840],[15,-3],[25,5],[16,23],[-3,35],[12,6],[14,-9],[38,-42],[0,-7],[-12,-9],[-4,-36],[-8,-42],[-33,-2],[-52,27],[-26,-1],[0,-22],[17,-51],[-13,-22],[-31,5],[-3,-14],[29,-23],[30,16],[24,31],[5,-11],[-13,-47],[-6,-50],[5,-48],[24,-60],[-3,-31],[-8,-22],[2,-32],[18,-39],[-13,-23],[-58,12],[-22,28],[20,28],[2,36],[-16,0],[-30,-12],[-44,27],[-40,36],[-64,38],[-7,26],[-1,46],[-14,42],[-35,39],[-24,45],[20,34],[34,29],[39,24],[41,13],[28,22],[25,6],[8,7],[-20,24],[10,14],[42,-3],[32,-15],[16,-25],[12,-23]],[[4587,5020],[7,-53],[-24,-37],[-28,-12],[-16,7],[-5,15],[-6,17],[-11,15],[-14,1],[-17,-4],[-11,21],[16,63],[-5,40],[10,54],[35,39],[28,-11],[1,-35],[-9,-42],[15,-39],[18,-14],[16,-25]],[[232,5743],[0,-32],[26,-18],[28,-5],[30,7],[30,16],[-65,-128],[-97,1],[-102,81],[-82,114],[14,16],[13,11],[30,11],[25,-14],[60,-20],[46,-52],[13,21],[10,65],[9,26],[6,35],[12,33],[30,13],[24,-7],[21,-21],[18,-34],[15,-45],[-30,-11],[-84,-63]],[[4805,5874],[-44,-26],[-29,11],[-15,50],[6,38],[28,27],[92,12],[14,14],[74,83],[12,5],[-19,-68],[-2,-121],[-25,-23],[-92,-2]],[[1224,5601],[-17,-61],[-61,-152],[116,0],[-22,-48],[-19,-95],[-17,-38],[-39,-32],[-131,-35],[-81,-32],[-56,4],[-132,63],[12,52],[8,19],[-41,1],[-17,33],[-8,43],[-12,30],[-28,13],[-59,7],[-28,15],[-10,13],[-6,13],[-8,10],[-14,0],[22,114],[-19,74],[-44,43],[-52,18],[48,68],[39,31],[44,8],[114,-3],[16,5],[34,87],[53,97],[32,38],[40,24],[13,3],[30,0],[13,-3],[22,-18],[7,-20],[3,-18],[6,-12],[57,-33],[24,-39],[-13,-54],[-52,-52],[-137,-92],[-50,-89],[-7,-43],[14,-12],[202,80],[85,90],[55,36],[46,54],[25,118],[-12,43],[-27,17],[-13,22],[32,60],[35,38],[31,5],[22,-30],[9,-68],[-6,-46],[-13,-53],[-16,-48],[-14,-30],[-15,-48],[-6,-127],[-7,-58]],[[346,6460],[-47,-33],[-110,8],[-45,-30],[-22,-52],[-8,-60],[0,-156],[-34,16],[-35,25],[-29,41],[-16,61],[17,103],[22,70],[35,45],[59,30],[60,2],[101,-56],[52,-14]],[[1804,6564],[-30,-14],[-13,15],[-8,19],[-4,20],[12,36],[2,173],[-12,31],[-11,18],[-9,32],[6,26],[16,-9],[33,-59],[4,-25],[-1,-27],[14,-91],[11,-24],[29,-36],[-2,-23],[-11,-29],[-26,-33]],[[1636,7024],[-17,-18],[-200,43],[-18,37],[22,22],[153,-27],[33,-22],[27,-35]],[[5450,8221],[21,-33],[283,-135],[75,-61],[42,-75],[-120,7],[-49,-26],[-24,-82],[11,-78],[36,-3],[46,18],[41,-11],[-75,-51],[-129,-172],[-65,-61],[-18,57],[-30,19],[-33,-11],[-33,-30],[0,-35],[10,-28],[-3,-30],[-24,-84],[19,14],[59,19],[0,-33],[-89,-145],[-10,-33],[-9,-145],[-20,-33],[-34,-23],[-69,-102],[-39,-19],[-32,20],[-15,46],[-1,56],[11,55],[-87,-122],[-47,-45],[-39,25],[-153,-178],[78,8],[-12,-57],[-96,-146],[-124,-267],[-75,-105],[-185,-196],[-295,-498],[-56,-134],[-26,-80],[-30,-67],[-43,-46],[-123,-37],[-178,-154],[-21,152],[-9,23],[-71,12],[-37,15],[-16,24],[-12,57],[-27,-2],[-29,-28],[-18,-27],[-6,-54],[33,-107],[-8,-49],[-56,-37],[-241,21],[-64,-42],[-33,-5],[-17,47],[9,31],[50,62],[17,43],[-183,-88],[-45,-48],[-30,-95],[17,-79],[32,-88],[17,-116],[-14,-77],[-34,-65],[-224,-307],[-33,-31],[-61,4],[-87,73],[-61,-6],[11,-8],[4,-27],[-2,-33],[-5,-21],[-19,-14],[-19,21],[-19,30],[-46,38],[-53,98],[-16,22],[-32,14],[-55,56],[-37,1],[-17,-22],[-5,-36],[8,-34],[76,-43],[42,-72],[31,-92],[18,-92],[-114,-156],[-157,-103],[-151,19],[-96,205],[36,-4],[27,-12],[25,-4],[30,20],[-53,46],[-69,90],[-61,101],[-29,82],[21,16],[37,51],[16,54],[-44,25],[-281,14],[-36,-14],[-23,-38],[17,-23],[36,-11],[36,-3],[56,-31],[63,-78],[54,-95],[28,-83],[-162,0],[-46,10],[-23,25],[-15,35],[-126,199],[-33,37],[-36,6],[-38,-1],[-38,12],[-49,55],[-91,147],[-50,47],[-129,33],[-42,58],[19,124],[29,53],[70,-18],[150,-73],[122,-10],[29,-23],[12,-50],[-2,-59],[13,-41],[54,6],[-39,177],[188,29],[177,81],[0,35],[-89,59],[-75,16],[-65,40],[-58,131],[242,3],[127,-37],[51,-108],[19,0],[11,38],[12,24],[35,48],[4,-54],[15,-46],[21,-19],[28,27],[29,36],[27,2],[29,-13],[78,-15],[29,-17],[46,-44],[46,-59],[24,-1],[25,60],[-38,33],[0,35],[71,-2],[79,18],[75,37],[61,54],[72,154],[16,23],[8,22],[-16,40],[-31,24],[-39,-29],[-101,-107],[-133,-60],[-139,4],[-115,74],[222,-17],[56,33],[20,17],[55,28],[11,28],[9,47],[21,47],[26,40],[22,26],[-26,61],[2,41],[15,34],[9,42],[-4,49],[-14,113],[-3,71],[29,89],[67,65],[77,27],[57,-21],[-21,-43],[-24,-38],[-50,-61],[85,24],[36,0],[14,-42],[-8,-48],[-53,-147],[33,-24],[82,-86],[4,85],[22,64],[38,34],[52,-5],[-33,76],[-11,60],[6,169],[10,49],[26,31],[32,13],[29,-4],[18,-24],[20,-83],[17,-38],[19,5],[25,25],[23,6],[9,-53],[12,-14],[28,21],[85,90],[8,96],[-3,109],[5,76],[-74,30],[-69,-17],[-67,-33],[-67,-19],[-164,29],[-71,-26],[17,-109],[-22,-60],[-21,0],[-23,22],[-31,5],[-125,-94],[-38,-15],[-125,0],[-40,-18],[-21,-43],[-15,-47],[-20,-34],[-57,-1],[-28,77],[-27,93],[-49,44],[-62,31],[-52,79],[-31,105],[3,108],[39,88],[45,-9],[53,-49],[278,-102],[80,-3],[66,35],[128,118],[65,25],[220,-26],[196,91],[58,-11],[117,-137],[66,-37],[156,-19],[-41,97],[-67,53],[-78,23],[-72,5],[-56,32],[-164,216],[-30,21],[-56,25],[-30,28],[-76,140],[-73,9],[-409,220],[-34,38],[-30,108],[-6,62],[26,27],[164,0],[134,-41],[29,25],[-39,105],[-58,71],[-74,47],[-78,30],[-106,17],[-77,-8],[-38,6],[-87,59],[-38,9],[-28,12],[-31,32],[-21,40],[3,40],[11,57],[-15,62],[-42,112],[32,-4],[29,3],[27,14],[25,26],[92,-73],[310,-144],[97,-69],[285,-282],[228,-134],[250,-44],[459,104],[-67,91],[-198,21],[27,118],[59,90],[65,70],[16,68],[18,22],[33,-37],[10,-32],[20,-130],[169,165],[92,46],[82,-31],[0,-36],[-16,-16],[-8,-17],[-5,-18],[-9,-20],[262,-58],[83,-48],[-45,-25],[-47,-11],[-99,0],[80,-106],[148,0],[525,142],[50,24],[94,101],[57,17],[0,-36],[-196,-166],[-72,-43],[126,-84],[134,-3],[275,122],[-19,49],[-34,45],[-38,33],[-34,13],[-18,29],[-2,153],[-7,66],[23,-4],[48,7],[24,-3],[-5,23],[-7,59],[-6,24],[40,1],[51,-13],[43,-28],[19,-49]],[[4468,8263],[76,-67],[5,106],[62,-11],[14,-83],[62,-44],[105,-16],[10,-61],[-81,-22],[-104,-62],[-86,-56],[-81,-12],[-81,61],[9,78],[57,55],[-67,22],[-109,-23],[-86,61],[-19,55],[76,12],[81,11],[23,95],[57,-6],[39,-49],[38,-44]],[[3906,8304],[-64,-28],[-56,2],[-55,40],[-48,58],[-40,72],[-29,79],[131,48],[43,1],[43,-14],[109,-73],[19,-1],[-41,-30],[-18,-3],[0,-39],[39,-61],[-33,-51]],[[3104,8492],[76,-10],[70,6],[151,42],[69,-23],[30,-108],[12,-21],[22,-56],[7,-57],[-33,-26],[-105,-142],[-44,-120],[-13,-21],[-29,3],[-81,53],[-32,14],[-199,-45],[-42,8],[-51,27],[-40,48],[-8,70],[40,75],[69,43],[134,26],[30,-23],[57,-100],[29,-22],[41,3],[36,12],[33,22],[33,34],[-50,57],[-153,103],[-107,39],[-131,113],[-38,46],[-46,75],[-3,35],[30,32],[45,6],[25,-33],[17,-52],[18,-47],[58,-57],[73,-29]],[[2224,8429],[-17,-8],[-8,29],[-3,29],[-9,23],[-34,15],[-55,16],[-56,54],[-29,111],[39,43],[77,-74],[39,-55],[21,-18],[37,-49],[10,-63],[-12,-53]],[[7211,8360],[66,-14],[142,0],[32,-17],[28,-26],[31,-22],[42,-3],[0,32],[-11,65],[43,56],[65,41],[265,30],[49,-30],[46,-44],[114,-45],[50,-55],[126,-177],[18,-72],[11,-105],[12,-72],[-14,-58],[-66,-63],[-54,-29],[-72,-22],[-71,-6],[-52,18],[-28,60],[-46,176],[-40,48],[-48,-15],[-44,-58],[-80,-137],[95,-3],[17,-70],[-36,-230],[37,-37],[177,114],[64,-8],[13,-54],[-5,-66],[-11,-69],[-6,-61],[3,-90],[9,-32],[43,-1],[11,8],[20,49],[17,11],[11,-17],[18,-77],[10,-29],[37,-29],[44,3],[39,30],[22,51],[58,-40],[35,-54],[18,-73],[5,-101],[16,-70],[40,-89],[47,-77],[41,-32],[48,34],[-23,78],[-72,137],[30,63],[60,-14],[119,-85],[-20,123],[-67,52],[-72,32],[-33,61],[19,38],[37,33],[26,41],[-14,66],[-36,22],[-85,-46],[-42,8],[-28,41],[-2,40],[3,43],[-11,53],[-13,29],[-20,33],[-18,6],[-8,-48],[-11,-50],[-28,-28],[-34,-11],[-32,-1],[-32,20],[13,46],[49,75],[128,306],[34,47],[32,16],[75,76],[37,17],[585,51],[153,56],[84,0],[74,-25],[31,-29],[30,-53],[47,-213],[19,-32],[29,-28],[86,-171],[29,-35],[39,-27],[76,-27],[-22,-51],[-54,-39],[-21,-54],[72,0],[22,-47],[-25,-59],[-69,-34],[-347,56],[-235,164],[-58,15],[-24,-41],[34,-126],[-149,73],[-176,-105],[49,-96],[94,-79],[103,-55],[79,-22],[160,46],[78,-56],[261,-32],[104,-35],[88,-70],[36,-119],[-51,-67],[-116,-50],[-198,-43],[0,-39],[168,-71],[62,3],[111,46],[55,9],[63,-19],[0,-36],[-78,-8],[-283,-162],[-58,-13],[-189,-5],[-37,-15],[-3,-40],[-35,-38],[-37,-18],[-424,-59],[-217,40],[-109,-5],[0,-35],[34,-8],[97,-66],[46,-20],[147,-13],[0,-35],[-79,-28],[-164,12],[-81,-20],[-194,-142],[-75,-3],[60,-34],[58,5],[173,98],[187,2],[-38,-58],[-70,-58],[-76,-44],[-119,-40],[-213,-155],[-133,-68],[-258,47],[-144,-12],[-100,-38],[-444,7],[-67,31],[-95,104],[-129,56],[-63,63],[-60,38],[-28,38],[-14,44],[-10,53],[-15,45],[-28,21],[-35,-30],[-30,-74],[-22,-79],[-8,-49],[15,-66],[37,-63],[47,-49],[129,-47],[113,-68],[102,-93],[54,-99],[-39,-91],[73,-27],[158,51],[81,-6],[105,-34],[80,-67],[1,-107],[76,-71],[-145,-114],[-46,-64],[33,-36],[20,-47],[13,-59],[24,-178],[-1,-52],[-22,-19],[-47,-2],[-26,25],[-87,191],[-32,55],[-32,45],[-40,31],[-51,11],[-25,11],[-33,47],[-18,10],[-17,-10],[-8,-23],[-11,-24],[-31,-11],[-24,6],[-41,24],[-21,5],[-37,-17],[2,-41],[15,-49],[1,-37],[-38,-48],[-87,-62],[-38,-48],[-46,-38],[-30,61],[-32,174],[-58,-75],[-31,43],[-20,94],[-22,76],[-60,36],[-62,-18],[-48,1],[-21,91],[-50,-32],[-42,15],[-81,91],[-20,39],[-16,20],[-21,6],[-34,-17],[-12,-26],[-9,-31],[-21,-30],[-40,-23],[-36,-6],[-36,10],[-40,19],[-25,20],[-19,25],[-21,19],[-33,7],[-19,-11],[-41,-48],[-24,-12],[-29,-30],[16,-59],[41,-36],[83,61],[146,-43],[41,-33],[5,-74],[-1,-75],[21,-33],[55,11],[38,20],[37,4],[52,-35],[-95,-139],[101,7],[50,-10],[41,-36],[-47,-51],[-108,-52],[-37,-39],[-21,-97],[40,-31],[65,6],[160,65],[54,3],[9,-52],[-30,-44],[-144,-102],[36,-68],[63,-64],[38,-69],[-40,-83],[-60,-16],[-69,34],[-120,88],[-73,10],[-63,-12],[-57,7],[-55,70],[-14,45],[-6,43],[-11,43],[-28,47],[-32,22],[-34,9],[-33,20],[-32,55],[-48,-25],[-112,150],[-53,17],[-12,-33],[-12,-61],[-14,-102],[-15,-33],[-32,35],[-48,87],[-63,-51],[27,-92],[93,-141],[-11,1],[-19,-32],[-19,-47],[-8,-48],[14,-35],[34,-12],[66,-8],[69,-46],[44,-60],[18,-77],[-13,-100],[-17,-20],[-33,-48],[-15,-51],[34,-24],[6,-20],[63,-80],[15,-6],[-21,-92],[-56,32],[-94,131],[-65,44],[-141,33],[-61,62],[11,100],[-34,65],[-56,36],[-129,37],[-48,43],[-1,65],[67,86],[-48,29],[-96,-37],[-39,26],[-7,29],[2,68],[-5,24],[-87,114],[-103,91],[-27,32],[-31,50],[-19,58],[6,56],[19,18],[24,-5],[25,-16],[19,-19],[59,-77],[20,-15],[52,4],[36,38],[6,61],[-37,75],[115,28],[51,40],[27,78],[-51,27],[-55,49],[-46,62],[-22,74],[4,47],[14,21],[22,-7],[28,-43],[27,-21],[40,-5],[77,8],[-44,102],[-23,37],[-30,36],[46,27],[99,19],[47,25],[0,39],[-157,50],[-72,56],[-2,103],[67,49],[92,-39],[95,-62],[72,-19],[59,64],[-42,64],[-73,65],[-39,62],[16,58],[36,3],[43,-10],[38,17],[18,43],[-2,46],[-18,36],[-36,18],[48,35],[209,90],[56,-63],[35,55],[37,238],[43,-52],[45,-10],[100,29],[-47,123],[-10,55],[269,216],[46,-71],[36,33],[35,70],[45,39],[213,46],[45,-10],[16,-41],[1,-46],[-3,-48],[4,-46],[15,-39],[19,-35],[16,-38],[7,-48],[-8,-48],[-16,-47],[-10,-43],[16,-76],[-2,-44],[-8,-44],[-8,-36],[46,23],[54,15],[46,32],[25,73],[-13,75],[-34,90],[-26,93],[10,137],[-37,44],[-31,60],[17,108],[24,26],[32,5],[27,12],[12,46],[-9,48],[-22,5],[-28,-4],[-58,41],[-197,87],[-126,127],[-62,124],[50,87],[79,107],[28,180],[142,-318],[88,-110],[59,141],[-74,121],[-18,118],[42,62],[106,-49],[-73,86],[-254,136],[-56,46],[10,78],[27,84],[36,69],[41,34],[18,-10],[54,-48],[24,-14],[34,0],[92,33],[24,22],[15,50],[9,50],[8,22],[189,7],[66,23],[55,43],[25,70],[-16,71],[-80,138],[-29,90],[-26,41],[-30,36],[-20,14],[-14,23],[-34,158],[59,-28],[89,-124],[43,-29],[61,-10],[132,-59],[231,-165]],[[4473,8731],[68,-27],[286,36],[25,-8],[2,-19],[-4,-25],[7,-26],[19,-35],[9,-33],[17,-23],[41,-9],[19,14],[12,32],[9,34],[8,20],[28,27],[21,11],[27,4],[63,-28],[47,-74],[31,-103],[12,-118],[-68,-19],[-65,-42],[-163,-10],[-65,40],[-93,172],[-72,40],[-314,32],[-118,35],[-26,18],[-19,44],[-6,45],[14,33],[40,6],[63,38],[72,-29],[73,-53]],[[1122,8953],[-68,-7],[29,24],[100,45],[112,36],[39,-13],[-43,-33],[-72,-32],[-97,-20]],[[1284,9469],[-6,-61],[-48,6],[-47,44],[-52,69],[-42,44],[16,80],[84,-125],[58,-44],[37,-13]],[[752,9650],[-22,-7],[-38,13],[-92,50],[-38,10],[-25,12],[-2,28],[23,24],[17,23],[-2,25],[-19,50],[1,45],[38,-11],[37,-44],[39,-65],[13,-30],[11,-35],[6,-16],[34,-24],[16,-22],[3,-26]],[[430,9777],[-9,-18],[-39,5],[-44,34],[-32,47],[-56,30],[-19,24],[-18,2],[-17,10],[-7,32],[-3,39],[14,17],[32,-17],[63,-65],[17,-26],[84,-58],[26,-27],[8,-29]]],"transform":{"scale":[0.0003584261421142103,0.00019223927602759005],"translate":[-61.31818600199989,-52.93539804499985]}};
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
