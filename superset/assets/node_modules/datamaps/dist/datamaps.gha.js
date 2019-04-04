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
  Datamap.prototype.flkTopo = '__FLK__';
  Datamap.prototype.fraTopo = '__FRA__';
  Datamap.prototype.froTopo = '__FRO__';
  Datamap.prototype.fsmTopo = '__FSM__';
  Datamap.prototype.gabTopo = '__GAB__';
  Datamap.prototype.psxTopo = '__PSX__';
  Datamap.prototype.gbrTopo = '__GBR__';
  Datamap.prototype.geoTopo = '__GEO__';
  Datamap.prototype.ggyTopo = '__GGY__';
  Datamap.prototype.ghaTopo = {"type":"Topology","objects":{"gha":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Northern"},"id":"GH.NP","arcs":[[0,1,2,3,4,5]]},{"type":"Polygon","properties":{"name":"Upper East"},"id":"GH.UE","arcs":[[-5,6,7]]},{"type":"Polygon","properties":{"name":"Upper West"},"id":"GH.UW","arcs":[[-7,-4,8]]},{"type":"Polygon","properties":{"name":"Ashanti"},"id":"GH.AH","arcs":[[9,10,11,12]]},{"type":"Polygon","properties":{"name":"Brong Ahafo"},"id":"GH.BA","arcs":[[13,14,-13,15,16,-2]]},{"type":"Polygon","properties":{"name":"Central"},"id":"GH.CP","arcs":[[17,18,19,20,-11]]},{"type":"Polygon","properties":{"name":"Eastern"},"id":"GH.EP","arcs":[[21,22,-18,-10,-15]]},{"type":"Polygon","properties":{"name":"Western"},"id":"GH.WP","arcs":[[-12,-21,23,-16]]},{"type":"Polygon","properties":{"name":"Greater Accra"},"id":"GH.AA","arcs":[[24,-19,-23,25]]},{"type":"Polygon","properties":{"name":"Volta"},"id":"GH.TV","arcs":[[26,-26,-22,-14,-1]]}]}},"arcs":[[[8157,6262],[-1,0],[-1,0],[-87,8],[-14,0],[-72,-10],[-13,-1],[-14,0],[-14,2],[-12,2],[-52,21],[-11,3],[-13,1],[-12,0],[-23,-4],[-55,-15],[-8,-4],[-8,-6],[-4,-10],[-2,-9],[9,-7],[7,-6],[4,-8],[-1,-9],[-10,-12],[-15,-27],[-18,-25],[-45,-39],[-9,-13],[-4,-12],[3,-9],[3,-8],[5,-7],[13,-12],[25,-16],[7,-5],[5,-7],[3,-9],[-3,-9],[-8,-7],[-19,-6],[-15,0],[-12,3],[-20,8],[-12,2],[-13,-3],[-12,-7],[-24,-25],[-17,-24],[-24,-49],[-3,-8],[-2,-9],[0,-8],[3,-8],[7,-7],[8,-4],[43,-14],[8,-5],[6,-7],[1,-8],[-6,-8],[-11,-7],[-23,-5],[-16,-3],[-13,-5],[-10,-6],[-4,-13],[1,-9],[8,-16],[5,-17],[0,-10],[-5,-17],[2,-8],[5,-5],[9,-4],[10,-3],[25,-5],[25,-2],[11,0],[53,5],[49,9],[68,5],[14,0],[12,-3],[11,-3],[10,-4],[8,-6],[24,-25],[4,-8],[3,-18],[-1,-9],[-2,-9],[-9,-6],[-14,-4],[-69,-2],[-15,-2],[-11,-5],[-7,-10],[-1,-9],[15,-64],[5,-6],[2,-7],[0,-8],[-3,-9],[-21,-9],[-37,-7],[-90,-7],[-39,0],[-25,1],[-28,14],[-49,33],[-20,17],[-32,22],[-79,34],[-36,11],[-48,11],[-55,7],[-46,-1],[-100,-24],[-17,-7],[-23,-11],[-34,-21],[-11,-12],[-3,-11],[2,-8],[0,-9],[-2,-9],[-24,-27],[-5,-9],[-7,-6],[-18,-4],[-12,-5],[-10,-11],[-14,-11],[-18,-8],[-38,-5],[-22,0],[-17,1],[-12,3],[-53,17],[-12,3],[-15,0],[-78,-18],[-21,-2],[-17,0],[-25,4],[-13,-5],[-15,-10],[-45,-67],[-47,-33]],[[6443,5294],[-24,-6],[-41,-1],[-91,10],[-42,9],[-125,51],[-232,129],[-7,6],[-8,6],[-6,6],[-8,5],[-26,25],[-37,26],[-17,10],[-11,3],[-12,3],[-15,2],[-50,-3],[-50,-6],[-23,-1],[-29,1],[-43,5],[-28,1],[-13,-1],[-10,-1],[-7,-2],[-6,-3],[-8,-3],[-15,-11],[-28,-26],[-15,-11],[-16,-10],[-10,-4],[-10,-3],[-33,-7],[-21,-7],[-21,-8],[-18,-11],[-7,-5],[-6,-6],[-6,-6],[-36,-65],[-11,-14],[-14,-12],[-33,-21],[-18,-8],[-11,-4],[-72,-11],[-20,-6],[-10,-4],[-8,-5],[-7,-7],[-6,-7],[-4,-8],[-2,-9],[-2,-10],[0,-10],[4,-17],[10,-14],[24,-26],[8,-14],[3,-8],[3,-8],[0,-38],[-2,-10],[-3,-9],[-7,-7],[-10,-6],[-11,-3],[-9,-4],[-7,-4],[-4,-3],[-19,-26],[-14,-13],[-11,-13],[-7,-4],[-11,2],[-17,8],[-15,6],[-24,4],[-16,6],[-12,15],[-240,460],[-23,28],[-31,28],[-62,28],[-23,14],[-11,11],[3,8],[5,8],[6,6],[14,13],[16,10],[8,5],[16,10],[7,5],[7,7],[5,7],[4,8],[2,9],[2,51],[2,10],[4,8],[11,14],[13,12],[115,72],[13,11],[23,30],[9,15],[2,9],[0,9],[-2,7],[-8,25],[-33,52],[-11,34],[-12,24],[-12,6],[-19,4],[-48,0],[-34,2],[-48,6],[-39,9],[-19,7],[-112,51],[-33,19],[-20,16],[-9,4],[-16,11],[-9,5],[-20,7],[-26,4],[-28,1],[-120,-3],[-55,-5],[-37,-16],[-8,-6],[-7,-5],[-6,-7],[-5,-8],[-3,-8],[-13,-45],[-5,-8],[-8,-6],[-9,-4],[-19,-8],[-43,-13],[-26,-4],[-55,-4],[-23,1],[-133,18],[-18,0],[-27,-5],[-16,-5],[-12,-6],[-6,-7],[-5,-7],[-8,-16],[-5,-7],[-7,-6],[-16,-9],[-29,-5],[-66,-21],[-167,37],[-92,-27],[-29,-26],[-19,-31],[-10,-32],[-3,-34],[6,-93],[-6,-29],[-10,-18],[-12,-16],[-31,-25],[-11,-15],[4,-14],[10,-12],[5,-12],[5,-29],[12,-26],[19,-22],[24,-14],[86,-10],[86,5],[70,-11],[37,-59],[2,-28],[-8,-27],[-23,-21],[-42,-9],[-48,8],[-90,30],[-54,4],[-47,-16],[-37,-28],[-28,-28],[-19,-13],[-37,-42],[-14,-10],[-10,-5],[-214,-30],[-97,-1],[-82,14],[-39,25],[-58,67],[-68,25],[-64,54],[-32,21],[-34,13],[-30,15],[-21,21],[-18,97],[-21,56],[-27,34],[-3,14],[-10,13],[-42,9],[-10,10],[-14,24],[-27,23],[-18,25],[13,29],[-40,54],[-6,16],[-12,14],[-54,22],[-12,17],[-19,35],[-84,45],[-66,85],[-30,21],[-9,3],[-12,0],[-9,-1],[-2,-2],[-91,68],[-47,17],[-18,3],[-6,2],[-7,7],[-14,-5]],[[1481,6299],[-20,-7],[0,1],[-11,12],[6,20],[16,10],[24,10],[2,21],[-45,108],[-3,27],[-5,13],[-13,4],[-15,2],[-13,7],[-35,73],[-3,32],[-14,25],[-57,20],[-57,9],[-57,2],[-31,4],[-18,8],[-14,10],[-22,9],[21,22],[9,24],[4,78],[10,13],[48,34],[39,55],[26,28],[71,26],[27,29],[3,30],[-35,13],[-39,6],[-32,16],[-18,24],[4,30],[23,20],[31,10],[26,12],[12,26],[0,42],[-11,26],[-3,13],[9,49],[-3,22],[-30,27],[-81,70],[-80,50],[-12,16],[-4,26],[3,25],[12,25],[19,23],[29,17],[-8,4]],[[1166,7650],[255,24],[16,4],[18,9],[19,14],[10,11],[13,15],[7,6],[11,5],[14,5],[41,7],[16,4],[12,6],[11,13],[14,29],[5,7],[13,12],[8,6],[14,5],[18,6],[34,7],[34,4],[112,1],[27,3],[208,44],[13,1],[199,-10],[14,1],[72,14],[27,3],[30,0],[59,-3],[27,-4],[54,-5],[86,2],[292,45],[146,-7],[28,2],[36,5],[9,0],[125,-11],[55,1],[13,5],[14,9],[18,22],[15,12],[20,11],[53,10],[10,4],[9,6],[7,10],[4,17],[9,17],[3,13],[1,11],[-2,9],[-4,8],[-19,19],[-3,8],[-1,8],[1,8],[-3,26],[2,9],[9,17],[4,7],[7,6],[11,7],[18,6],[14,2],[30,12],[13,0],[13,0],[13,-2],[14,0],[12,4],[7,6],[3,12],[-7,7],[-11,4],[-37,6],[-6,4],[2,5],[14,4],[28,3],[11,2],[11,2],[11,-2],[22,-6],[14,-1],[13,0],[11,0],[10,2],[28,10],[24,6],[9,6],[6,9],[-9,11],[-17,13],[-172,104],[-14,11],[1,10],[7,11],[36,45],[5,11],[2,9],[6,61],[6,18],[4,8],[13,17],[21,20],[28,20],[90,46],[32,21],[14,12],[44,58],[31,27],[8,5],[10,4],[17,3],[15,1],[16,0],[30,-2],[48,-13],[81,-29],[72,-16]],[[4261,8797],[4,-14],[8,-14],[6,-7],[7,-5],[10,-5],[10,-3],[9,-5],[8,-6],[8,-15],[5,-7],[9,-5],[12,-2],[13,-1],[12,-2],[10,-4],[9,-5],[40,-15],[11,-3],[14,-1],[36,1],[15,-1],[10,-5],[6,-7],[4,-7],[10,-4],[14,-1],[30,12],[15,8],[10,10],[3,8],[2,10],[0,10],[-2,19],[-17,52],[0,9],[0,9],[3,8],[5,8],[12,12],[16,11],[78,26],[17,10],[11,9],[9,26],[10,15],[7,7],[7,5],[9,5],[18,9],[236,59],[26,5],[17,0],[24,-2],[30,-6],[29,-2],[13,-2],[10,-3],[10,-5],[14,-3],[20,-2],[34,1],[14,-4],[3,-6],[-5,-6],[-11,-8],[-1,0],[0,-1],[-27,-18],[-5,-6],[0,-6],[9,-3],[15,1],[23,8],[25,13],[6,5],[11,7],[89,55],[7,6],[5,8],[8,16],[6,6],[10,8],[5,5],[3,6],[3,17],[3,9],[10,6],[15,5],[24,7],[14,6],[11,7],[5,8],[5,29],[4,8],[14,5],[23,3],[135,-3],[19,-4],[13,-5],[6,-7],[3,-7],[-1,-8],[-5,-7],[-7,-5],[-5,-6],[-2,-7],[2,-8],[6,-6],[8,-5],[9,-5],[9,-5],[6,-6],[4,-8],[2,-9],[0,-9],[-2,-9],[-4,-9],[-5,-7],[-7,-6],[-23,-17],[-4,-7],[-1,-8],[4,-6],[8,-4],[10,1],[19,11],[12,-2],[9,-5],[11,-4],[13,1],[21,9],[11,8],[14,15],[11,5],[14,3],[74,1],[33,-8],[13,0],[14,4],[28,16],[14,5],[15,3],[25,-1],[14,-3],[11,-5],[9,-3],[13,1],[14,4],[15,10],[8,8],[5,8],[13,48],[5,7],[5,7],[7,7],[9,4],[11,2],[16,-3],[9,-6],[16,-11],[10,-3],[13,-2],[41,-3],[15,1],[55,10],[104,31],[18,2],[17,8],[30,6],[229,34],[109,6],[142,50],[43,7],[1,0]],[[7124,9279],[-14,-39],[-1,-33],[23,-32],[20,-11],[24,-8],[27,-5],[52,-5],[16,-7],[14,-9],[20,-10],[71,-16],[20,-8],[18,-15],[26,-34],[19,-16],[119,-51],[35,-26],[115,-146],[6,-5],[17,1],[10,9],[6,10],[6,5],[59,-16],[22,-2],[25,4],[22,7],[20,5],[23,-4],[22,-15],[1,-17],[-7,-17],[-4,-13],[26,-28],[38,-24],[23,-25],[-19,-31],[31,0],[99,11],[21,-7],[46,-26],[-55,-28],[-11,-24],[-6,-25],[-17,-21],[4,-53],[-12,-110],[22,-40],[29,-13],[25,-4],[18,-10],[6,-31],[-8,-26],[-1,-5],[-25,-5],[-35,4],[-39,-5],[13,-15],[-1,-10],[-8,-10],[-4,-14],[4,-10],[26,-37],[16,-31],[-2,-13],[-15,-9],[-29,-22],[-18,-23],[-5,-22],[10,-62],[0,-18],[-49,-121],[4,-29],[11,-17],[17,-12],[14,-15],[11,-23],[5,-29],[-6,-27],[-24,-19],[-40,-3],[-38,14],[-60,43],[-32,-44],[2,-46],[36,-32],[70,-5],[91,16],[44,-6],[20,-33],[-16,-21],[-36,-7],[-42,5],[-31,14],[-40,-18],[-54,-2],[-113,8],[-5,-10],[-11,-44],[1,-9],[6,-5],[16,-10],[22,-11],[24,-6],[57,7],[32,-1],[19,-17],[-8,-16],[-29,-14],[-35,-9],[-94,-13],[0,-22],[16,-25],[-18,-18],[10,-21],[41,-3],[42,6],[103,25],[17,9],[9,14],[7,31],[11,12],[34,11],[50,6],[91,3],[42,-4],[119,-30],[15,-14],[4,-15],[-5,-16],[-15,-18],[-1,-1],[1,-2],[1,-1],[67,-16],[41,-25],[14,-36],[-21,-79],[-4,-46],[-9,-19],[-23,-16],[-25,-10],[-19,-15],[-2,-31],[28,-56],[1,-24],[-27,-32],[-51,-31],[-14,-15],[0,-25],[-12,-50],[-38,-48],[-23,-48],[30,-48],[1,0],[108,-127],[28,-76],[-49,-48],[-1,-1],[-11,-19],[-3,-24],[-8,-21],[-25,-8],[-29,3],[-23,5],[-21,2],[-23,-6],[12,-6],[-15,-26],[-24,-18],[-24,35],[-26,7],[-29,-3],[-15,-15],[5,-20]],[[4261,8797],[16,10],[3,9],[3,25],[-5,32],[-12,27],[-10,13],[-10,9],[-21,7],[-13,1],[-11,-2],[-10,-4],[-21,-17],[-7,-4],[-7,-2],[-5,0],[-5,2],[-23,14],[-19,8],[-18,9],[-7,5],[-6,7],[-7,17],[-2,9],[4,14],[2,10],[-6,11],[-9,5],[-31,11],[-12,2],[-27,2],[-11,3],[-7,5],[-9,9],[-7,4],[-8,4],[-11,3],[-8,5],[-6,7],[-4,8],[-5,7],[-7,6],[-11,3],[-14,2],[-13,0],[-14,1],[-9,5],[-6,6],[-9,16],[-5,7],[-5,7],[-3,8],[-13,55],[-4,8],[-10,14],[-2,11],[0,14],[11,44],[7,16],[8,12],[21,17],[15,8],[13,5],[22,7],[12,6],[32,26],[31,19],[4,7],[1,9],[1,20],[5,13],[16,15],[34,17],[8,6],[10,4],[12,2],[10,7],[8,10],[1,65],[-3,9],[-1,9],[3,8],[9,12],[5,13],[1,21],[-4,24],[11,30],[45,67]],[[4132,9773],[22,-6],[75,-20],[56,-7],[286,-2],[271,-1],[19,23],[64,7],[310,-17],[19,-2],[17,-8],[16,-21],[11,-5],[24,0],[-15,-21],[39,4],[50,37],[48,6],[13,11],[13,4],[13,-4],[11,-11],[256,-4],[16,0],[3,-17],[10,-2],[16,4],[21,-1],[13,-11],[-9,-13],[-17,-12],[-7,-11],[108,-71],[39,17],[23,35],[16,38],[21,26],[32,8],[47,4],[88,-2],[7,2],[8,2],[7,4],[5,4],[21,18],[59,19],[27,15],[12,16],[5,35],[11,23],[43,37],[43,0],[43,-23],[40,-33],[113,56],[28,19],[18,23],[-5,14],[-9,15],[6,25],[305,-43],[16,-26],[38,-24],[45,-17],[42,-7],[41,3],[76,13],[42,1],[75,-20],[34,-36],[8,-48],[-7,-55],[-5,-20],[-16,-11],[-20,-8],[-18,-13],[-10,-15],[-49,-156],[2,-15],[11,-31],[-4,-16],[-19,-13],[-46,-21],[-32,-28],[-17,-27],[-12,-65],[-8,-22]],[[1166,7650],[-17,9],[-7,14],[-3,15],[-11,12],[-20,7],[-12,-1],[-13,1],[-18,14],[-15,33],[8,32],[38,52],[77,60],[15,16],[-7,15],[-53,59],[-10,39],[21,71],[3,40],[-15,28],[-51,52],[-11,32],[0,83],[0,50],[-23,70],[1,31],[29,32],[45,25],[17,14],[8,20],[-2,20],[-7,8],[-15,5],[-22,10],[-22,5],[-20,0],[-14,4],[-6,17],[-8,11],[-19,3],[-23,2],[-19,6],[-19,25],[0,33],[12,31],[15,23],[16,15],[17,9],[22,5],[29,2],[25,7],[20,14],[10,15],[-9,6],[-55,1],[-36,5],[-28,9],[-79,48],[-17,20],[-7,30],[-7,7],[-30,21],[-10,9],[-7,15],[-3,34],[-6,15],[-67,82],[-10,29],[7,16],[30,37],[14,26],[6,5],[5,7],[0,10],[-7,7],[-10,4],[-10,1],[-4,0],[-2,7],[-6,16],[7,9],[24,16],[12,15],[9,36],[37,42],[25,72],[17,32],[30,24],[36,19],[30,23],[13,35],[-14,30],[-24,28],[-14,29],[6,11],[-3,9],[194,-2],[1,-17],[49,1],[211,1],[438,3],[544,4],[505,3],[492,4],[349,2],[26,10],[17,27],[39,9],[284,-6],[28,-8]],[[6850,3821],[-129,-16],[-41,-10],[-17,-9],[-16,-10],[-44,-39],[-14,-10],[-28,-16],[-27,-11],[-112,-26],[-25,-7],[-17,-7],[-15,-11],[-7,-8],[-25,-18],[-21,-5],[-300,-4],[-34,-5],[-26,-15],[-404,-389],[-18,-11],[-14,-6],[-12,-3],[-162,-15],[-49,-13],[-55,-18],[-23,-11],[-14,-10],[-9,-15],[-6,-17],[-1,-9],[0,-9],[3,-9],[4,-7],[11,-13],[14,-12],[16,-11],[53,-28],[7,-5],[8,-6],[12,-13],[10,-14],[6,-16],[0,-9],[0,-5],[-8,-10],[-15,-12],[-63,-44],[-13,-12],[-5,-7],[-11,-10],[-291,-208],[-96,-105],[-34,-62],[-27,-68],[-5,-21],[-6,-12],[-12,-17],[-10,-10],[-9,-7],[-17,-9],[-51,-20],[-4,-6],[3,-5],[7,-6],[6,-6],[4,-8],[1,-9],[0,-10],[-4,-19],[-5,-12],[-26,-30],[-5,-8],[1,-7],[4,-7],[-2,-15],[6,-5],[9,-2],[10,-4],[6,-6],[-1,-10],[-8,-5],[-28,-6],[-8,-6],[-3,-9],[-3,-9],[-16,-34],[-6,-10],[-19,-22],[-17,-32],[-2,-11],[0,-1],[-3,-9],[-14,-20],[-3,-7],[1,-7],[4,-5],[9,0],[9,1],[11,0],[8,-4],[7,-5],[1,-21],[-41,-56]],[[4545,1833],[-2,-8],[-3,-2],[-5,-4],[-16,-7],[-3,-8],[-2,-7],[-3,-6],[-6,1],[-7,5],[-7,3],[-12,-2],[-18,-9],[-11,-3],[-11,-3],[-12,0],[-10,1],[-6,8],[-5,8],[-3,9],[-5,7],[-9,4],[-15,-2],[-13,-2],[-13,0],[-11,4],[-16,8],[-51,9],[-18,0],[-13,-3],[-7,-5],[-11,-3],[-11,-1],[-13,-1],[-43,-5],[-7,-6],[-6,-6],[-7,-5],[-20,-2],[-9,-3],[-11,-2],[-25,1],[-21,-4],[-5,-5],[2,-6],[3,-6],[1,-8],[-13,-21],[-6,-6],[-9,-3],[-11,1],[-20,5],[-21,7],[-36,14],[-8,10],[-1,8],[9,4],[11,1],[9,1],[4,5],[0,7],[-5,9],[-10,8],[-17,12],[-14,6],[-36,4],[-21,5],[-13,-1],[-11,-2],[-12,0],[-24,0],[-21,-4],[-13,0],[-18,4],[-28,1],[-24,-3],[-50,-2],[-25,-4],[-16,1],[-11,-3],[-14,-1],[-21,3],[-34,13],[-19,5],[-15,6],[-11,12],[-11,8],[-61,17],[-24,0],[-32,5],[-8,5],[-7,9],[-7,6],[-49,17],[-10,6],[-4,11],[0,8],[0,5],[3,9],[3,7],[1,8],[-5,7],[-30,9],[-24,2],[-10,-1],[-9,-3],[-13,-9],[-9,-4],[-10,-3],[-15,0],[-18,2],[-29,10],[-15,0],[-9,-4],[-6,-7],[-7,-5],[-10,0],[-14,3],[-21,12],[-36,32],[-8,6],[-9,2],[-10,0],[-14,8],[-14,17],[-32,61],[-11,13],[-14,4],[-12,-1],[-17,-4],[-8,0],[-11,9],[-10,19],[-34,120],[5,10],[7,8],[7,6],[5,7],[2,8],[-3,23],[0,10],[4,8],[10,15],[4,8],[1,8],[-2,7],[-5,11],[-26,11],[-104,3]],[[2679,2428],[-52,-1],[-18,1],[-14,5],[-13,10],[-7,10],[-5,8],[-10,25],[-5,8],[-17,19],[-8,6],[-10,4],[-11,3],[-164,27],[-21,7],[-5,7],[-3,8],[-1,9],[3,19],[43,88],[0,9],[-1,8],[-1,5],[-3,6],[-7,6],[-11,4],[-17,2],[-18,-2],[-48,-11],[-17,0],[-14,2],[-70,30],[-21,6],[-12,3],[-13,0],[-12,-4],[-12,-8],[-12,-17],[-6,-13],[-23,-108],[-6,-18],[-9,-16],[-10,-15],[-8,-8],[-28,-19],[-9,-4],[-20,-7],[-12,-2],[-14,-1],[-16,0],[-20,1],[-13,6],[-5,4],[7,37]],[[1880,2567],[4,15],[0,7],[-4,8],[-7,5],[-23,6],[-9,4],[-5,6],[0,8],[5,7],[12,11],[0,6],[-8,11],[1,7],[17,18],[7,17],[6,8],[8,6],[12,7],[11,17],[6,8],[9,6],[13,7],[14,14],[8,5],[9,4],[7,6],[9,16],[7,6],[-1,7],[-3,8],[-11,13],[-2,7],[2,8],[5,6],[13,13],[1,6],[-4,7],[-6,5],[-29,13],[-8,5],[-4,7],[-3,28],[-5,7],[-8,5],[-21,6],[-6,5],[-3,9],[1,9],[8,26],[2,9],[2,7],[6,4],[18,-1],[56,-9],[29,-2],[21,2],[26,5],[46,12],[22,8],[15,7],[7,5],[7,6],[11,15],[9,17],[3,9],[16,91],[8,16],[5,7],[6,7],[8,5],[11,5],[13,6],[20,6],[13,4],[8,6],[3,7],[-4,6],[-6,7],[-8,6],[-9,4],[-12,4],[-25,5],[-45,3],[-113,2],[-81,-16],[-13,-1],[-12,1],[-12,4],[0,5],[3,7],[4,8],[7,6],[10,4],[21,6],[9,4],[26,15],[8,5],[13,13],[16,10],[7,5],[5,8],[6,6],[7,6],[5,6],[3,7],[-1,25],[3,8],[9,13],[3,7],[5,7],[1,17],[3,8],[5,6],[142,108],[28,12],[14,3],[18,1],[33,-3],[15,-6],[10,-7],[5,-7],[6,-16],[4,-8],[7,-6],[22,-2],[274,11],[43,11],[62,24],[61,30],[31,23],[52,49],[25,17],[15,5],[22,4],[48,4],[24,3],[18,4],[8,4],[7,7],[16,31],[2,8],[-6,25],[2,8],[4,8],[18,21],[2,7],[0,5],[-7,3],[-110,20],[-23,5],[-18,9],[-60,44],[-85,49],[-8,3],[-11,0],[-8,0],[-84,-12],[-12,0],[-12,2],[-10,4],[-9,5],[-50,40],[-9,5],[-11,3],[-13,1],[-27,0],[-27,-1],[-27,2],[-11,3],[-10,3],[-5,3],[-2,5],[1,7],[2,9],[9,15],[3,8],[0,27],[2,9],[4,7],[14,11],[5,7],[7,17],[4,7],[6,7],[4,9],[2,9],[3,8],[18,5],[29,0],[106,-12],[33,3],[13,4],[19,10],[16,3],[55,-1],[18,2],[17,1],[13,-2],[25,-10],[16,-3],[21,-2],[84,2],[13,2],[23,6],[49,8],[15,1],[15,-2],[19,-7],[8,-9],[5,-9],[5,-68],[6,-18],[4,-7],[6,-7],[20,-7],[36,-8],[50,-19],[27,-15],[20,-17],[8,-5],[12,-4],[14,-2],[22,3],[15,3],[46,12],[12,2],[14,1],[15,-1],[35,-12],[18,-3],[21,-1],[37,3],[18,5],[13,6],[15,11],[35,39],[24,17],[19,7],[11,3],[17,2],[52,0],[22,3],[24,6],[8,9],[3,9],[-2,10],[-13,33],[-17,30],[-3,8],[0,9],[3,6],[3,3],[6,5],[66,33],[91,37],[17,10],[28,24],[73,81],[15,11],[9,5],[19,8],[12,3],[11,2],[12,1],[17,-1],[20,-5],[32,-14],[15,-9],[11,-8],[10,-14],[17,-31],[4,-16],[5,-76],[5,-15],[8,-14],[5,-7],[13,-13],[12,-9],[12,-7],[18,-5],[25,-4],[53,-5],[48,-1],[50,5],[44,0],[12,2],[13,3],[10,3],[12,2],[24,3],[12,2],[15,2],[20,1],[34,5],[26,1],[41,8],[9,4],[7,6],[8,16],[5,7],[7,6],[16,11],[28,13],[7,5],[13,13],[6,6],[15,3],[20,0],[64,-7],[11,-3],[20,-14],[11,-4],[18,0],[27,4],[12,0],[11,-2],[17,-15],[10,-7],[11,-3],[22,0],[29,3],[26,-2],[11,2],[16,9],[11,3],[15,2],[20,-1],[15,1],[14,-1],[24,-10],[20,-6],[31,-5],[16,-1],[12,-4],[3,-5],[7,-6],[9,-2],[14,2],[9,6],[7,6],[11,15],[6,4],[9,1],[14,-8],[16,-2],[13,2],[33,20],[20,8],[46,11],[10,3],[9,5],[18,-3],[26,-10],[54,-31],[39,-28],[52,-58],[40,-67],[23,-27],[15,-11],[14,-6],[19,-7],[69,-15],[234,-29],[317,-80],[12,-4],[13,-5],[44,-39],[100,-122]],[[6443,5294],[128,-23],[44,-15],[313,-173],[27,-22],[26,-29],[97,-156],[6,-16],[9,-57],[8,-15],[5,-8],[55,-61],[18,-13],[21,-11],[22,-6],[24,-4],[51,-5],[16,-4],[27,-12],[12,-12],[9,-15],[3,-20],[54,-103],[148,-175],[26,-45],[3,-8],[7,-93],[4,-13],[10,-19],[9,-9],[10,-7],[83,-29],[61,-12],[16,-5],[18,-8],[28,-16],[13,-11],[8,-10],[10,-46],[0,-21],[-9,-47],[-38,-82],[-3,-19],[0,-9],[10,-48]],[[7832,3782],[-105,25],[-15,1],[-16,-1],[-35,-10],[-40,-17],[-33,-9],[-13,-2],[-15,-1],[-19,3],[-26,7],[-50,18],[-22,6],[-25,4],[-568,15]],[[1880,2567],[-18,0],[-20,7],[-29,15],[-25,10],[-12,2],[-13,2],[-62,2],[-12,2],[-13,3],[-10,7],[-100,146],[-10,8],[-13,6],[-26,8],[-45,9],[-11,3],[-11,5],[-11,7],[-12,11],[-9,17],[-9,31],[-9,9],[-14,8],[-30,10],[-21,3],[-19,2],[-85,-5],[-29,0],[-24,5],[-11,3],[-88,47],[-21,7],[-60,11],[-11,4],[-9,5],[-7,7],[1,11],[-3,13],[-5,15],[-15,25],[-6,16],[-2,13],[1,10],[4,8],[18,30],[2,8],[0,9],[-7,16],[-5,7],[-3,9],[-2,8],[-1,28],[-4,10],[-35,53],[-11,33],[-53,68],[-25,20],[-34,20],[-68,26],[-33,9],[-25,4],[-24,-3],[-85,-24],[-12,-2],[-13,-1],[-28,2],[-14,4],[-13,5],[-17,9],[-11,8],[-7,7],[-24,29],[-15,31],[-24,82],[-2,5]],[[371,3605],[2,1],[2,1],[112,25],[11,11],[19,78],[11,16],[103,88],[20,31],[2,21],[-10,13],[-16,12],[-14,22],[-2,18],[110,477],[30,63],[162,240],[9,10],[23,19],[8,10],[1,9],[-7,20],[2,8],[20,12],[50,21],[17,13],[8,17],[10,117],[6,11],[14,1],[15,-7],[12,-9],[3,-5],[36,22],[103,81],[41,20],[134,31],[47,17],[22,20],[2,27],[-14,37],[-30,45],[-6,19],[10,25],[16,21],[14,9],[18,-1],[29,-9],[26,-2],[31,7],[100,41],[16,24],[-103,436],[-104,436],[-11,24]],[[4545,1833],[74,-27],[66,-17],[10,-6],[6,-7],[71,-105],[32,-39],[12,-9],[6,-3],[14,-2],[20,-2],[194,2],[16,-1],[21,-3],[34,-8],[17,-6],[22,-11],[15,-4],[20,-1],[56,5],[27,4],[26,2],[43,-3],[219,-33],[11,-3],[26,-4],[48,-1],[380,21],[60,-6],[101,-27]],[[6192,1539],[83,-114],[34,-35],[19,-10],[22,-7],[12,-3],[36,-13],[31,-15],[14,-10],[10,-9],[35,-55],[35,-83]],[[6523,1185],[-28,-9],[-165,-96],[-18,-17],[-11,-24],[-31,-22],[-80,-34],[-157,-27],[-27,0],[-17,-11],[-36,-19],[-37,-9],[-19,22],[-116,-56],[-29,-7],[-131,-75],[-54,-43],[-33,-15],[-167,-17],[-52,2],[-33,20],[-15,-13],[-21,-5],[-56,-3],[-54,-9],[-27,0],[-11,14],[-8,14],[-18,-3],[-28,-16],[-37,-2],[-36,-7],[-234,-70],[-24,-22],[-20,-14],[-46,-18],[-89,-28],[-46,-7],[-146,-3],[-24,-5],[-52,-21],[-25,-7],[-22,-1],[-47,2],[-23,-1],[-41,-9],[-82,-28],[-156,-15],[-51,-13],[-38,-19]],[[3805,439],[-19,101],[1,17],[9,38],[7,17],[10,16],[44,57],[14,11],[8,5],[10,5],[9,3],[10,3],[23,4],[11,2],[31,-1],[13,1],[12,2],[10,3],[9,3],[9,5],[8,5],[28,24],[67,36],[7,5],[1,9],[-7,11],[-23,19],[-15,9],[-91,40],[-73,46],[-29,23],[-8,9],[-7,12],[-15,34],[-8,12],[-10,9],[-19,12],[-14,7],[-14,5],[-23,6],[-18,9],[-8,6],[-36,30],[-15,27],[-6,18],[-1,10],[1,9],[4,18],[7,16],[6,7],[7,6],[10,4],[10,2],[10,4],[6,5],[12,13],[2,6],[-1,7],[-2,8],[-22,22],[-28,21],[-30,18],[-41,16],[-21,7],[-24,5],[-28,3],[-54,1],[-13,2],[-11,3],[-11,3],[-26,15],[-10,4],[-12,3],[-14,1],[-13,1],[-26,-2],[-23,-5],[-75,-20],[-12,-1],[-13,0],[-10,9],[-10,13],[-7,31],[-1,17],[2,14],[14,25],[13,33],[2,17],[-1,32],[1,9],[4,8],[6,7],[7,6],[15,10],[6,6],[1,8],[-5,10],[-16,9],[-29,8],[-9,7],[-5,10],[-2,16],[3,24],[9,28],[1,9],[-5,14],[-11,16],[-31,29],[-17,14],[-14,8],[-11,3],[-53,9],[-11,3],[-11,4],[-40,22],[-7,5],[-7,5],[-102,102],[-42,30],[-9,4],[-9,5],[-34,12],[-71,21],[-9,3],[-8,5],[-8,7],[-25,41],[-7,10],[-22,17],[-19,8],[-46,11],[-12,2],[-18,4],[-37,12],[-66,30],[-9,7],[-17,19],[-6,12],[-4,10],[-2,20],[1,20],[4,18],[3,9],[11,9],[18,10],[38,14],[61,17],[28,13],[36,24],[16,15],[12,23]],[[7832,3782],[10,-84],[-5,-27],[-6,-7],[-17,-27],[-15,-31],[-4,-17],[0,-13],[4,-8],[9,-36],[6,-44],[-2,-25],[-5,-16],[-5,-8],[-19,-19],[-32,-21],[-9,-5],[-39,-25],[-11,-13],[-12,-18],[-21,-41],[-6,-20],[-2,-15],[7,-17],[11,-14],[7,-5],[8,-5],[10,-4],[34,-9],[21,-7],[18,-9],[15,-11],[12,-13],[9,-15],[13,-67],[-2,-17],[-4,-13],[-6,-6],[-8,-5],[-89,-35],[-9,-5],[-30,-22],[-7,-6],[-7,-5],[-7,-6],[-7,-6],[-7,-6],[-11,-18],[-35,-91],[-7,-29],[-1,-20],[7,-5],[11,-3],[66,4],[12,-2],[11,-2],[10,-5],[8,-5],[5,-7],[7,-16],[9,-36],[3,-9],[4,-7],[12,-13],[16,-11],[28,-12],[10,-8],[10,-10],[9,-22],[1,-14],[-2,-13],[-65,-136],[-5,-7],[-12,-13],[-7,-6],[-7,-5],[-36,-18],[-38,-16],[-101,-26],[-10,-9],[12,-17],[16,-29],[4,-28],[-11,-19],[-16,-21],[-8,-28],[3,-26],[14,-16],[106,-55],[40,-9],[154,3],[39,-4],[29,-11],[47,-28],[78,-32],[9,-11],[4,-12],[-6,-143]],[[8049,1878],[-97,-76],[-35,-22],[-29,-13],[-13,-3],[-18,-1],[-14,2],[-12,3],[-9,4],[-23,16],[-15,11],[-29,32],[-7,6],[-10,7],[-62,18],[-9,4],[-19,9],[-16,10],[-13,12],[-30,43],[-8,7],[-14,6],[-29,2],[-31,0],[-27,-3],[-16,-4],[-81,-38],[-27,-8],[-17,-4],[-8,-1],[-8,2],[-15,13],[-11,6],[-14,5],[-25,6],[-13,-2],[-8,-6],[-37,-90],[-9,-10],[-17,-9],[-95,-27],[-12,-5],[-8,-7],[-25,-36],[-24,-60],[-22,-31],[-6,-6],[-6,-6],[-12,-8],[-16,-9],[-32,-13],[-20,-4],[-17,-1],[-24,6],[-19,8],[-9,5],[-7,5],[-12,6],[-15,5],[-26,2],[-14,-2],[-12,-4],[-43,-36],[-13,-7],[-19,-8],[-39,-13],[-22,-5],[-18,-3],[-56,2],[-23,2],[-41,11],[-10,3],[-35,9],[-20,8],[-8,6],[-5,7],[0,26],[-14,6],[-25,2],[-97,-5],[-22,-2],[-20,-5],[-5,-2],[-6,-3],[-4,-5],[-2,-5],[-10,-34],[0,-13],[1,-9],[2,-7],[5,-11]],[[3805,439],[-1,-1],[-33,11],[-39,2],[-38,-7],[-28,-15],[-4,-13],[16,-23],[-5,-13],[-14,-11],[-10,-6],[-153,-52],[-28,-14],[-65,-50],[-5,-11],[4,-11],[-1,-7],[-20,-3],[-20,-1],[-155,-30],[-172,-54],[-36,-22],[-54,-53],[-34,-22],[-32,-9],[-155,-14],[-30,-8],[-60,-2],[-13,2],[-17,10],[-6,16],[2,18],[-5,14],[-29,5],[-18,2],[-34,7],[-26,2],[3,7],[-21,16],[-96,52],[-47,14],[-22,9],[-9,14],[-4,12],[-10,11],[-12,10],[-234,63],[-380,54],[-370,87],[-293,15],[-324,40],[-311,66],[-36,5],[10,26],[15,3],[21,5],[26,3],[161,-1],[48,-10],[14,-9],[27,-27],[12,-6],[30,3],[46,13],[24,5],[-6,43],[63,18],[80,9],[49,15],[89,-2],[52,5],[32,16],[22,29],[-13,10],[-29,17],[-7,6],[-2,14],[9,33],[2,13],[-10,18],[-32,31],[-6,21],[15,97],[75,-10],[30,4],[22,20],[6,27],[-10,28],[-61,99],[-40,111],[-5,82],[-8,25],[-18,20],[-29,16],[-160,29],[-36,-10],[-74,-31],[-44,-3],[-53,20],[-12,40],[23,98],[-146,-9],[22,177],[-6,57],[-27,56],[-87,109],[-32,56],[-68,259],[-48,87],[-66,42],[-7,5],[-27,23],[-177,549],[3,27],[16,16],[42,16],[12,10],[44,85],[-5,11],[-30,40],[-29,25],[-9,16],[3,56],[37,60],[260,306],[27,12]],[[8843,1590],[-693,35],[-97,-3],[-53,-9],[-28,-8],[-11,-9],[-11,-4],[-54,-2],[-19,-4],[-43,-21],[-150,-28],[-35,-17],[-62,-39],[-87,-18],[-31,-23],[-25,-28],[-36,-25],[-179,-42],[-11,-4],[-29,-20],[-13,-8],[-20,-4],[-36,-3],[-482,-107],[-101,-9],[-14,-5]],[[8049,1878],[17,24],[7,7],[16,11],[42,22],[40,15],[22,5],[22,3],[16,0],[1,1],[183,-6],[175,-28],[31,-10],[19,-10],[23,-16],[79,-149],[25,-22],[25,-13],[31,-14],[49,-13],[32,-11],[18,-9],[9,-4],[8,-6],[6,-8],[4,-10],[-6,-9],[-7,-6],[-45,-9],[-48,-23]],[[8157,6262],[14,-57],[66,-97],[89,-86],[90,-43],[39,-30],[54,-35],[58,-29],[148,-47],[39,-57],[29,-59],[86,-49],[5,-17],[-1,-17],[6,-23],[-2,-16],[1,-7],[9,-6],[27,-2],[9,-6],[8,-38],[-17,-24],[-36,-15],[-99,-30],[-37,-17],[-75,-47],[-19,-6],[-17,-1],[-12,-6],[-2,-21],[9,-16],[17,-11],[16,-14],[4,-21],[-12,-20],[-18,-10],[-11,-11],[12,-38],[8,-73],[21,-58],[1,-30],[-2,-58],[22,-103],[2,-8],[-2,-93],[20,-89],[-5,-81],[7,-30],[-65,7],[-29,-32],[-7,-48],[1,-42],[-13,-21],[-31,-11],[-36,-7],[-29,-9],[-23,-15],[-14,-17],[-8,-19],[-9,-90],[12,-77],[36,-68],[71,-43],[41,-4],[44,5],[83,21],[15,-13],[36,-102],[-3,-34],[-30,-57],[-21,-72],[-54,-94],[-8,-61],[10,-70],[-1,-67],[-43,-54],[-29,-11],[-95,-17],[-33,-2],[-33,-7],[26,-23],[64,-35],[26,-32],[-5,-27],[-47,-54],[-16,-33],[8,-15],[21,-9],[28,-14],[65,-84],[15,-13],[38,-6],[39,-15],[33,-21],[19,-26],[2,-25],[-19,-78],[12,-33],[30,-19],[32,-16],[19,-24],[21,-2],[63,2],[21,-3],[28,-20],[-1,-14],[-16,-15],[-14,-20],[-1,-9],[-3,-32],[14,-38],[27,-37],[35,-38],[48,-33],[111,-38],[56,-25],[73,-61],[29,-15],[46,-8],[172,-1],[58,-124],[35,-35],[18,-9],[17,-5],[17,-6],[17,-14],[30,-31],[24,-20],[31,-10],[186,-15],[26,-25],[-6,-55],[-1,0],[-15,-3],[-101,-38],[-77,-42],[-114,-84],[-27,-28],[-55,-76],[-10,-30],[-4,-32],[-23,-73],[-19,-29],[-72,-46],[-91,-22],[-429,-33],[-112,5]]],"transform":{"scale":[0.0004450922794279457,0.0006426451965196462],"translate":[-3.262509317999985,4.737127997000101]}};
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
