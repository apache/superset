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
  Datamap.prototype.ghaTopo = '__GHA__';
  Datamap.prototype.gibTopo = '__GIB__';
  Datamap.prototype.ginTopo = '__GIN__';
  Datamap.prototype.gmbTopo = '__GMB__';
  Datamap.prototype.gnbTopo = '__GNB__';
  Datamap.prototype.gnqTopo = '__GNQ__';
  Datamap.prototype.grcTopo = '__GRC__';
  Datamap.prototype.grdTopo = '__GRD__';
  Datamap.prototype.grlTopo = {"type":"Topology","objects":{"grl":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Pituffik"},"id":"GL.VG","arcs":[[0,1]]},{"type":"MultiPolygon","properties":{"name":"Kommuneqarfik Sermersooq"},"id":"GL.VG","arcs":[[[2]],[[3]],[[4]],[[5]],[[6]],[[7]],[[8]],[[9]],[[10]],[[11]],[[12]],[[13]],[[14]],[[15]],[[16]],[[17]],[[18]],[[19]],[[20]],[[21]],[[22,23]],[[24]],[[25]],[[26]],[[27]],[[28]],[[29]],[[30]],[[31]],[[32]],[[33]],[[34]],[[35]],[[36]],[[37]],[[38]],[[39]],[[40]],[[41,42,43,44,45,46]],[[47,48]],[[49,50]]]},{"type":"MultiPolygon","properties":{"name":"Kommune Kujalleq"},"id":"GL.VG","arcs":[[[51]],[[52]],[[53]],[[54]],[[55]],[[56]],[[57]],[[58]],[[59]],[[60]],[[61]],[[62]],[[63]],[[64]],[[65]],[[66]],[[67]],[[68]],[[69]],[[70]],[[71]],[[72]],[[73]],[[74]],[[75]],[[76]],[[77]],[[78]],[[79]],[[80]],[[81]],[[82]],[[-42,83]]]},{"type":"MultiPolygon","properties":{"name":"Qeqqata Kommunia"},"id":"GL.VG","arcs":[[[84]],[[85,-44,86,-23,87]]]},{"type":"MultiPolygon","properties":{"name":"Nationalparken"},"id":"GL.NG","arcs":[[[88]],[[89]],[[90]],[[91]],[[92]],[[93]],[[94]],[[95]],[[96]],[[97]],[[98]],[[99]],[[100]],[[101]],[[102]],[[103]],[[104]],[[105]],[[106]],[[107]],[[108]],[[109]],[[110]],[[111]],[[112]],[[113]],[[114]],[[115]],[[116]],[[117]],[[118]],[[119]],[[-50,120,-48,121,-46,122,123]]]},{"type":"MultiPolygon","properties":{"name":"Qaasuitsup Kommunia"},"id":"GL.NG","arcs":[[[124]],[[125]],[[126]],[[127]],[[128]],[[129]],[[130]],[[131]],[[132]],[[133]],[[134]],[[135]],[[136]],[[137]],[[138]],[[139]],[[140]],[[141]],[[142]],[[143]],[[144]],[[145]],[[146]],[[147]],[[148]],[[149]],[[-45,-86,150,-2,151,-123]]]}]}},"arcs":[[[645,7007],[28,9],[15,14],[-3,2],[-11,1],[5,3],[22,7],[57,0],[57,-1],[4,3],[3,4]],[[822,7049],[28,0],[28,0],[0,-17],[0,-17],[-44,0],[-44,0],[0,-46],[0,-46],[-30,0],[-30,1],[-43,41],[-42,42]],[[4046,542],[9,-7],[-3,-3],[-3,-1],[-7,1],[-5,-2],[-1,0],[-4,4],[-2,1],[-6,-6],[-8,0],[-8,2],[-4,4],[0,2],[0,1],[-1,1],[-1,1],[4,7],[8,3],[9,-1],[13,-5],[7,-1],[3,-1]],[[3917,615],[-5,-2],[-3,0],[-2,2],[1,1],[2,2],[4,10],[11,6],[12,1],[8,-6],[-2,-2],[-14,-1],[-4,-2],[-5,-7],[-3,-2]],[[3978,648],[-2,-5],[-9,-5],[0,2],[1,5],[0,2],[-8,-7],[-3,-2],[-3,1],[-8,8],[-10,-3],[-6,0],[-3,6],[17,10],[6,1],[21,2],[6,-5],[1,-10]],[[3884,772],[-4,-2],[-4,1],[-11,11],[3,3],[2,5],[3,11],[3,0],[4,-3],[4,-4],[2,-4],[0,-8],[0,-6],[-2,-4]],[[4978,1267],[8,-5],[10,3],[38,-11],[3,-7],[-8,0],[7,-6],[21,-2],[0,-3],[-4,-1],[-6,-4],[-4,-1],[-3,2],[-6,8],[-4,2],[-25,-6],[-4,-3],[5,-4],[6,-1],[10,2],[5,3],[3,0],[1,-3],[0,-4],[-1,-3],[-2,-2],[-2,-2],[1,-2],[2,-4],[-13,0],[-3,2],[-5,8],[-3,2],[-4,0],[-2,0],[-1,-2],[-1,-2],[-1,-2],[-3,-1],[-2,3],[-1,5],[1,7],[-7,-12],[-4,-2],[-1,1],[0,1],[-1,1],[-1,-1],[-1,-4],[-1,-1],[-1,-1],[-2,-1],[-1,0],[-2,5],[0,1],[-1,2],[-1,3],[-1,5],[2,9],[1,3],[-7,0],[7,13],[7,11],[2,1]],[[5054,1268],[-2,0],[-2,0],[-2,0],[8,-5],[4,0],[5,2],[-4,-8],[-6,-5],[-7,1],[-3,6],[-3,9],[0,6],[0,3],[3,3],[4,-2],[7,-4],[-2,-6]],[[5115,1319],[-2,-5],[-4,-14],[-2,-2],[-2,-4],[-3,-1],[-1,5],[1,6],[6,8],[2,4],[-3,1],[-7,-9],[-2,3],[0,1],[0,2],[4,14],[0,4],[0,4],[-1,4],[0,5],[1,5],[4,3],[6,1],[7,-1],[5,-2],[-3,-11],[0,-5],[3,-1],[-9,-15]],[[3630,1366],[-2,-11],[-3,6],[-10,13],[3,3],[6,5],[3,5],[3,3],[3,-1],[3,-5],[-1,-7],[-2,-4],[-3,-7]],[[5142,1368],[-8,-3],[-8,2],[-9,5],[-2,2],[-4,5],[4,7],[6,5],[10,3],[5,-2],[7,-11],[4,-4],[-5,-9]],[[3626,1393],[-2,-1],[-1,0],[-2,-1],[-4,-3],[-3,-4],[-4,-3],[-5,-1],[-4,3],[-3,7],[-3,8],[0,5],[2,4],[8,6],[1,2],[3,7],[2,3],[2,1],[6,-9],[4,-15],[4,-5],[-1,-4]],[[3639,1395],[-2,-1],[-3,0],[-2,2],[-2,2],[-2,5],[0,4],[0,3],[4,4],[8,17],[5,3],[5,-6],[1,-4],[2,-2],[2,-2],[2,-2],[2,-3],[2,-4],[1,-4],[-3,-2],[-15,-4],[-5,-6]],[[5162,1414],[0,-3],[-17,3],[4,-7],[13,-6],[5,-4],[-10,0],[-5,1],[-12,0],[-5,3],[-9,10],[-4,8],[0,8],[4,6],[5,2],[17,-6],[14,-15]],[[5110,1519],[3,-1],[5,3],[3,-2],[7,-8],[1,-2],[1,-7],[-1,-4],[-4,-6],[26,0],[3,-1],[4,-3],[4,-4],[3,-10],[8,-10],[7,-17],[1,-9],[-4,-4],[-6,3],[-5,9],[-8,20],[1,-12],[2,-9],[0,-6],[-6,-2],[-5,6],[-9,22],[-4,-2],[3,-4],[1,-6],[-1,-6],[-2,-4],[-4,-2],[-4,2],[-4,3],[-4,5],[-4,6],[-11,19],[-19,21],[-8,12],[-3,2],[-6,2],[-12,14],[-3,7],[1,9],[4,7],[6,3],[16,2],[3,-1],[5,-7],[5,-4],[2,-2],[1,-2],[0,-7],[1,-3],[2,-3],[8,-7]],[[3536,1548],[-24,-7],[0,2],[6,6],[1,3],[1,2],[0,8],[0,2],[4,3],[6,0],[5,-2],[5,-4],[0,-1],[1,-1],[1,-2],[1,-2],[-7,-7]],[[5251,1615],[-4,-9],[-2,-4],[-4,-1],[-12,0],[-3,3],[-3,7],[2,4],[5,1],[4,-1],[14,5],[3,-5]],[[3425,1821],[-10,-5],[-6,2],[-3,-9],[-6,9],[3,16],[6,7],[15,1],[7,3],[2,-10],[-8,-14]],[[5242,1860],[2,0],[7,1],[1,-1],[-2,-3],[2,-2],[2,0],[2,2],[2,3],[-1,-9],[-4,-1],[-7,4],[-38,0],[-14,-5],[-3,2],[-2,5],[-1,2],[-1,2],[0,3],[2,0],[1,2],[0,2],[-1,4],[2,2],[4,1],[2,1],[1,3],[2,5],[1,3],[4,3],[20,7],[17,-3],[7,-5],[-2,-2],[-1,-3],[-3,-9],[1,-1],[2,-4],[1,-1],[-3,-3],[-4,-2],[2,-3]],[[3555,1893],[-2,-18],[-2,-4],[-5,-2],[-8,-10],[-4,-2],[-4,1],[-5,4],[-4,6],[0,7],[5,5],[10,-8],[5,2],[-2,4],[-2,2],[-4,3],[3,7],[4,1],[5,-2],[4,2],[-5,10],[-2,5],[2,4],[1,3],[1,3],[1,1],[2,1],[2,1],[1,3],[2,4],[-2,2],[-2,2],[-2,1],[-2,0],[4,6],[7,6],[5,8],[0,9],[1,8],[3,6],[6,9],[-1,3],[-1,5],[1,5],[1,2],[25,0],[6,-3],[4,-9],[-3,-18],[-6,-10],[-15,-12],[-7,-12],[-7,-14],[-4,-15],[-3,-6],[-4,-2],[-3,-4]],[[3533,1932],[-6,-8],[-3,-2],[-4,0],[-4,1],[-6,8],[-3,0],[-13,-5],[-2,1],[0,3],[1,3],[2,1],[7,1],[4,3],[2,5],[-1,1],[0,1],[0,2],[-1,1],[7,2],[7,4],[-1,12],[12,23],[2,11],[27,3],[0,-3],[-1,0],[0,-1],[-6,-10],[-3,-5],[-2,-7],[0,-4],[0,-11],[-1,-5],[-5,-5],[-6,-15],[-3,-5]],[[5285,2069],[-3,-2],[-2,1],[-2,1],[-2,0],[-2,-1],[-3,-3],[-1,-3],[6,-3],[8,-10],[9,-5],[2,-6],[1,-7],[2,-8],[-2,0],[-3,-2],[-2,0],[-1,1],[-4,6],[-1,1],[-4,-1],[0,-4],[5,-9],[-2,-1],[-3,-5],[6,-7],[8,-5],[21,-5],[7,-6],[7,-8],[6,-9],[-2,-3],[-5,-7],[-1,-5],[2,-5],[-1,-2],[-2,0],[-1,3],[-2,3],[-17,2],[-15,5],[-5,6],[-2,1],[-3,2],[-3,3],[-1,4],[0,5],[3,5],[0,4],[-1,4],[-2,3],[-3,1],[-2,2],[-1,3],[-1,3],[0,4],[-1,5],[5,0],[1,2],[-1,5],[-6,10],[-1,5],[-1,6],[-1,6],[1,0],[-2,5],[-1,3],[-5,4],[2,3],[0,2],[-3,2],[-8,10],[-6,11],[-10,12],[-6,12],[-2,7],[-1,6],[0,4],[-2,6],[-5,8],[7,10],[9,4],[9,-2],[10,-15],[7,-5],[6,-11],[12,-13],[-2,0],[-1,-2],[-2,-3],[-1,-3],[2,-4],[4,-4],[2,-4],[-1,-3],[7,-9],[2,-5],[-3,-6]],[[3410,2014],[1,0],[2,1],[1,0],[1,1],[3,0],[3,0],[2,1],[1,1],[2,0],[2,1],[2,0],[3,0],[2,1],[2,0],[1,0],[1,0],[1,1],[2,0],[1,1],[1,1],[1,0],[1,0],[1,1],[1,0],[2,1],[1,1],[2,0],[1,1],[1,0],[1,1],[1,1],[1,1],[0,1],[1,1],[0,1],[1,1],[0,1],[1,0],[0,1],[0,1],[0,1],[0,1],[1,1],[0,1],[1,1],[0,1],[0,1],[0,1],[1,0],[0,1],[0,1],[-1,0],[0,1],[0,1],[0,1],[1,0],[0,1],[1,0],[0,1],[1,1],[1,0],[0,1],[1,0],[0,2],[1,2],[1,2],[1,1],[1,3],[1,3],[3,7],[2,8],[2,1],[2,1],[0,1],[1,1],[0,1],[0,1],[1,0],[0,1],[1,0],[0,1],[1,0],[2,0],[1,0],[1,1],[1,1],[0,1],[-1,1],[0,1],[-1,1],[0,1],[-1,1],[0,1],[0,1],[1,1],[0,1],[1,1],[0,1],[1,0],[1,1],[1,0],[1,0],[1,0],[1,1],[1,1],[1,1],[1,1],[1,1],[1,1],[0,1],[1,0],[1,1],[-1,1],[0,1],[-1,1],[0,1],[-1,0],[0,1],[0,1],[0,1],[0,1],[0,1],[1,3],[0,2],[0,1],[0,1],[0,1],[0,2],[20,6],[20,5],[9,0],[8,0],[2,-1],[2,0],[1,0],[1,0],[1,0],[1,0],[1,0],[1,0],[0,1],[1,1],[1,1],[1,2],[1,1],[1,1],[2,1],[2,1],[0,1],[1,1],[1,1],[0,1],[0,1],[0,1],[0,1],[0,1],[0,1],[1,1],[2,1],[2,1],[6,2],[5,3],[1,0],[2,1],[0,1],[1,1],[1,1],[0,1],[1,1],[1,2],[1,2]],[[3603,2178],[11,7],[7,-4],[-3,-8],[3,-12],[-3,-5],[2,-2],[2,-3],[1,-3],[1,-4],[-3,-5],[-8,-9],[4,-3],[7,-2],[6,-3],[3,-8],[-1,-5],[-3,-2],[-3,-2],[-2,-3],[-1,-6],[2,-3],[5,-1],[4,-4],[0,-5],[-4,-3],[-5,-2],[-1,2],[0,4],[-1,4],[-2,1],[-2,-1],[-24,-32],[-5,-4],[-25,-8],[-2,-6],[3,-2],[4,2],[3,-2],[1,-3],[0,-2],[-2,-2],[-20,-6],[-9,4],[-2,-1],[5,20],[3,17],[3,5],[4,3],[2,4],[2,8],[4,0],[4,-2],[4,3],[-2,0],[-3,2],[1,2],[1,3],[0,1],[-4,3],[-6,2],[-5,0],[-19,-14],[-4,-5],[-3,-6],[-2,-10],[-2,-11],[-1,-9],[-1,-4],[-3,0],[-3,0],[-2,-2],[-6,-11],[-1,-4],[-2,-28],[-1,-4],[0,-2],[-1,-4],[-2,-4],[-3,-3],[-2,-5],[-1,-4],[-1,-4],[-12,-15],[-4,-16],[-4,-5],[-10,-4],[-3,-3],[-1,-4],[2,-2],[4,0],[0,-3],[-2,-4],[0,-5],[2,-5],[2,-3],[-7,-3],[-2,-3],[-3,-5],[-4,-10],[-2,-4],[-3,-4],[-7,-6],[-3,-2],[-4,0],[-9,1],[-2,-1],[2,-3],[1,0],[-1,-1],[-5,-2],[-6,0],[-4,-3],[-4,-2],[-3,-1],[-2,5],[0,6],[-2,5],[-1,3],[-2,-7],[-5,1],[-1,8],[-2,6],[2,8],[4,8],[1,7],[-1,7],[-6,2],[1,7],[3,5],[2,7],[3,6],[-5,6],[-1,5],[-2,6],[-4,5],[-1,6],[-1,6],[3,2],[5,-4],[6,-1],[1,5],[2,3],[3,3],[4,1],[1,3],[-1,3],[-7,-3],[-5,1],[0,4],[0,2],[2,4],[-5,-1],[-3,5],[3,6],[8,4],[5,3],[2,3],[3,4],[1,4]],[[5402,2334],[4,-3],[16,0],[3,-1],[5,-4],[2,-1],[6,1],[2,-2],[1,-5],[-7,-2],[-2,1],[-2,1],[-2,0],[-2,-1],[-1,-1],[4,-9],[-1,-3],[1,-1],[5,2],[2,1],[2,0],[3,-2],[-4,-4],[-4,-2],[-4,1],[-26,17],[-11,2],[-1,2],[0,3],[1,3],[3,1],[0,10],[4,4],[4,-1],[-1,-7]],[[5837,2426],[4,-11],[-1,-6],[-3,2],[-4,4],[-3,2],[-4,-2],[-8,-8],[-5,1],[1,0],[-2,3],[-1,4],[-1,4],[2,4],[-1,1],[0,2],[-1,3],[7,3],[10,-1],[10,-5]],[[5845,2434],[0,-4],[-4,1],[-3,4],[-8,4],[-3,4],[6,6],[1,3],[-2,3],[-4,1],[-7,1],[-1,1],[-3,6],[-2,2],[-2,0],[-2,2],[-1,4],[18,13],[3,5],[2,2],[3,-2],[8,-9],[3,-1],[-1,-4],[0,-1],[10,-6],[-4,-4],[1,-3],[7,-5],[-3,-6],[-4,-4],[-10,-1],[2,-6],[0,-6]],[[5873,2495],[-3,-1],[-3,4],[-2,7],[-3,3],[-4,1],[-3,3],[1,1],[1,2],[1,2],[1,3],[-7,1],[-3,2],[-3,3],[4,0],[5,2],[8,7],[8,12],[5,4],[4,-2],[4,-7],[-2,-5],[-3,-3],[-2,-5],[0,-4],[3,-22],[-7,-8]],[[5781,2529],[5,-15],[15,-11],[-3,-2],[-18,1],[-3,3],[-3,5],[-2,6],[-2,3],[-2,2],[-2,2],[-1,1],[-1,-3],[2,-3],[2,-3],[1,-3],[0,-4],[0,-3],[-1,-3],[1,-4],[2,-3],[7,-3],[-10,-3],[-3,-3],[4,-5],[14,4],[5,-3],[2,-3],[3,-1],[2,-3],[-1,-6],[-1,-5],[-6,-2],[-2,-5],[0,-4],[-2,-3],[-6,-1],[1,6],[-2,4],[-2,1],[-3,-3],[1,-1],[1,-2],[0,-2],[-4,-2],[-1,-1],[-1,-2],[1,-3],[-1,-3],[-1,-1],[-4,2],[-1,3],[0,4],[-1,3],[-3,-1],[-2,-7],[-2,-8],[-5,-2],[1,7],[1,2],[-1,1],[-3,5],[2,3],[-2,2],[-2,1],[-11,4],[-3,-1],[-1,-2],[3,-6],[1,-3],[2,-1],[2,-1],[3,-1],[2,-3],[1,-4],[-12,-13],[-5,-1],[-3,1],[-6,6],[-8,3],[-2,0],[1,-4],[-5,-3],[-5,4],[-4,8],[-3,8],[1,4],[0,6],[-1,5],[-1,5],[-1,3],[0,1],[-1,1],[-2,5],[-1,1],[0,1],[3,15],[1,7],[0,8],[2,10],[3,2],[5,0],[4,0],[3,6],[3,19],[3,4],[2,1],[8,5],[10,3],[0,1],[0,2],[0,2],[1,1],[8,0],[6,-2],[3,-3],[11,-17],[4,-4],[10,-5],[6,-4]],[[5975,2550],[-3,-6],[-4,-2],[-1,4],[-2,-1],[-2,-2],[-2,0],[-2,0],[1,-4],[0,-1],[-7,-9],[-4,-1],[-3,7],[0,13],[1,6],[2,2],[5,2],[4,3],[1,3],[2,4],[1,2],[8,0],[-1,-7],[2,-3],[7,-5],[-3,-5]],[[5923,2566],[-7,-10],[-3,0],[-2,1],[-2,0],[-1,-5],[0,-3],[1,-4],[3,-4],[-1,-4],[0,-4],[0,-3],[1,-4],[-5,-7],[-3,-1],[-1,4],[-15,-2],[1,7],[8,9],[-1,6],[-1,3],[-2,9],[-2,3],[-5,7],[6,10],[14,10],[13,4],[7,-4],[0,-10],[-3,-8]],[[6091,2681],[-6,-2],[-6,5],[1,2],[0,1],[0,2],[0,1],[4,10],[7,5],[16,3],[-2,-5],[-4,-3],[1,-4],[-5,-9],[-6,-6]],[[6347,2952],[1,-3],[2,-2],[3,0],[0,2],[2,2],[1,0],[1,-2],[1,-5],[-1,-4],[-3,-2],[-15,-1],[-3,4],[0,11],[1,10],[2,-1],[3,-6],[3,-3],[1,5],[0,9],[1,7],[5,-4],[1,-5],[-1,-6],[-3,-4],[-2,-2]],[[6427,3087],[-6,-5],[-6,5],[4,5],[1,2],[2,1],[-5,6],[4,4],[13,5],[5,-1],[-6,-12],[-6,-10]],[[6454,3151],[-2,-3],[-4,2],[-8,14],[3,7],[4,6],[4,3],[2,-4],[-1,-2],[0,-1],[1,0],[0,-2],[1,-1],[0,-2],[0,-1],[-5,-5],[4,-5],[1,-6]],[[7007,3503],[-5,-1],[-6,1],[-5,3],[-9,7],[-2,4],[-2,6],[0,9],[5,6],[5,4],[12,2],[10,-5],[14,-2],[3,-2],[1,-1],[1,-3],[0,-2],[-1,-2],[0,-6],[-2,-5],[-3,-3],[-7,-2],[-9,-8]],[[8076,4136],[-6,-3],[-33,3],[-11,9],[-7,16],[5,6],[7,3],[12,3],[15,2],[8,-2],[7,-6],[5,-19],[0,-5],[-2,-7]],[[7605,4504],[8,-1],[3,-2],[-4,-5],[-1,-2],[0,-3],[1,-5],[-9,-10],[-5,-3],[-13,-1],[-3,2],[-3,3],[-3,4],[-6,3],[-4,2],[1,2],[2,3],[1,1],[-1,2],[-3,7],[4,0],[6,7],[3,1],[3,0],[6,-5],[3,0],[0,3],[-2,0],[-4,5],[2,3],[3,2],[2,1],[3,0],[2,0],[2,-2],[2,-8],[4,-4]],[[7383,4654],[3,-1],[41,3],[-1,-2],[-1,-2],[-2,-1],[-1,-1],[-2,-3],[-6,-8],[-5,-12],[-3,-3],[-6,-5],[-14,-6],[-14,-13],[-15,-9],[-4,-2],[-3,2],[-4,6],[-1,6],[0,8],[1,11],[-1,5],[-1,7],[-1,7],[1,6],[5,7],[8,3],[14,2],[4,-1],[8,-4]],[[7713,4604],[3,-1],[17,0],[5,-3],[1,-6],[1,-5],[2,-9],[3,-9],[-1,-10],[-2,-4],[-4,-2],[-6,0],[-9,-5],[-25,-3],[-13,-11],[-7,-1],[-15,0],[-6,-2],[-23,-25],[-6,-3],[-11,-1],[-1,1],[0,2],[-1,2],[-1,0],[-7,0],[-1,2],[-4,13],[-5,3],[-7,1],[-7,-2],[-11,-9],[-25,-6],[-7,-8],[-5,-2],[-56,-3],[-3,2],[-2,2],[-3,0],[-2,-1],[-2,-3],[-1,-2],[-1,-3],[-2,-1],[-57,-10],[-56,-10],[-57,-10],[-8,2],[-3,10],[2,6],[4,5],[14,11],[3,4],[1,4],[-1,4],[-9,7],[-2,10],[3,6],[5,4],[8,11],[6,3],[40,6],[5,3],[11,20],[4,6],[11,10],[6,3],[4,6],[2,1],[3,1],[20,11],[5,6],[4,10],[11,17],[13,7],[66,1],[57,18],[4,3],[7,9],[3,3],[23,8],[10,8],[51,30],[5,0],[0,-3],[-1,0],[0,-1],[0,-2],[0,-2],[0,-4],[1,-12],[0,-2],[-2,-5],[-2,-3],[-2,-2],[-2,-4],[8,-6],[27,-3],[4,-2],[12,-16],[2,-5],[4,-17],[-2,-3],[-1,-2],[-2,-2],[-2,-1],[3,-4],[7,-4],[2,-4],[0,-6],[-3,-4],[-15,-2],[-3,-2],[-2,-5],[1,-4]],[[7699,4748],[0,-3],[4,2],[5,0],[7,-2],[2,-3],[3,-6],[2,-3],[3,0],[3,2],[4,1],[3,-3],[-2,-1],[-2,-4],[-1,-4],[1,-2],[3,-1],[3,-3],[2,-4],[2,-6],[-4,0],[-4,3],[-7,8],[0,-8],[-3,1],[-2,5],[-2,5],[-1,4],[-1,6],[-3,5],[-2,2],[-9,-3],[-3,2],[-4,7],[1,0],[1,1],[0,1],[1,1]],[[4848,1244],[-29,-7],[-29,-6],[-40,4],[-40,4],[-292,-352],[-292,-351],[-7,-7],[-7,-7],[-1,-1],[-1,0],[-1,-1],[-1,0],[-1,-1],[-1,0],[-1,0],[-1,0],[-5,-1],[-5,0],[-2,1],[-2,1],[-1,0],[-1,0],[0,1],[-1,-1],[-1,0],[0,-1],[-1,0],[0,-1],[-1,-1],[0,-1],[0,-1],[0,-1],[1,0],[0,-1],[-1,0],[0,-1],[-2,-1],[-1,-1]],[[4081,510],[-2,4],[-1,1],[-1,-1],[-3,-2],[-1,0],[-1,-1],[-1,-2],[-2,-4],[-2,-2],[-1,0],[-5,0],[-2,3],[-1,0],[-1,-1],[-3,-4],[-1,-1],[0,-1],[-1,-2],[0,-2],[-1,-1],[-2,1],[-2,4],[-1,1],[-3,-1],[-4,-6],[-3,-1],[1,1],[0,2],[0,1],[1,1],[-4,4],[-6,3],[-10,2],[-4,-1],[-8,-7],[-4,-1],[-5,4],[1,5],[4,4],[23,8],[2,-1],[6,-5],[2,-1],[8,1],[2,1],[2,6],[2,1],[2,1],[5,4],[3,1],[22,-6],[5,2],[2,2],[1,3],[0,3],[-2,5],[-1,4],[-1,1],[-3,-1],[-4,-6],[-2,-1],[-1,1],[-2,10],[8,8],[4,7],[4,13],[8,10],[2,6],[-4,-2],[-6,-11],[-5,-4],[-1,-3],[0,-3],[-1,-3],[-3,-3],[-15,-8],[-8,-1],[-2,-1],[-4,-5],[-2,0],[-1,2],[-3,7],[-1,2],[7,14],[4,10],[0,5],[-3,-5],[-5,-9],[-6,-7],[-3,3],[-1,6],[-2,3],[-3,2],[-2,2],[-1,4],[-1,2],[0,7],[3,4],[15,12],[-1,4],[0,1],[2,3],[-1,3],[-1,2],[-1,1],[-2,0],[0,3],[3,1],[4,6],[1,2],[3,0],[6,5],[15,3],[3,3],[-8,5],[-9,-2],[-16,-12],[-2,6],[-3,0],[-3,-4],[-1,-6],[-1,-9],[0,-5],[-4,-9],[-2,-2],[-4,0],[-3,-2],[-1,-6],[-3,-12],[-1,-5],[3,-3],[9,-12],[-3,-3],[-9,-2],[-19,2],[-4,3],[0,3],[0,1],[-2,2],[0,3],[12,3],[11,5],[-4,3],[-1,1],[5,5],[0,3],[1,4],[0,3],[-4,-6],[-6,-6],[-2,-1],[1,6],[-5,-3],[-9,-10],[-5,-1],[0,1],[1,5],[-6,-1],[-3,1],[-2,2],[3,8],[1,4],[1,6],[-2,-2],[-8,-10],[1,4],[2,8],[0,2],[5,3],[3,3],[2,6],[-5,0],[-4,-4],[-6,-10],[-3,-9],[-2,-3],[-3,0],[-1,2],[1,6],[-1,4],[5,11],[5,6],[5,2],[18,3],[6,4],[3,5],[-11,0],[-7,-5],[-3,0],[4,17],[0,2],[6,4],[4,1],[4,-5],[8,-1],[2,1],[1,5],[0,4],[-1,3],[-2,-3],[-3,2],[-28,3],[-5,4],[1,5],[-2,0],[-4,-4],[-1,0],[-3,2],[-7,-1],[1,6],[3,6],[1,5],[-2,4],[-3,-2],[-15,-19],[-8,-6],[-7,-1],[1,10],[-4,1],[-3,0],[-1,-3],[-3,-6],[-3,-4],[-2,-3],[-3,-2],[-3,0],[0,3],[4,5],[2,2],[2,6],[0,1],[-17,-2],[-4,2],[2,2],[2,1],[5,0],[1,2],[4,6],[7,2],[13,10],[4,2],[14,-2],[4,2],[7,7],[31,15],[37,7],[5,7],[-40,-6],[4,4],[14,5],[3,4],[2,7],[1,7],[-3,5],[-4,-1],[-26,-27],[-26,-8],[-12,-8],[-6,-8],[-12,0],[-4,-1],[-4,-4],[-10,-7],[-5,0],[1,5],[1,2],[2,2],[2,0],[-4,6],[-5,1],[-11,-1],[-1,1],[0,5],[0,4],[1,3],[2,2],[5,2],[3,3],[-3,0],[-8,3],[-3,0],[-8,-3],[-19,9],[2,3],[7,5],[3,1],[-4,2],[-2,2],[-1,4],[4,2],[47,-8],[42,11],[11,10],[5,-1],[-4,4],[-4,2],[-4,0],[-11,-9],[-40,-8],[0,3],[3,0],[2,2],[2,2],[1,4],[-2,3],[-2,0],[-3,-3],[-7,0],[-2,-1],[-1,-2],[-2,-2],[-2,-1],[1,3],[0,2],[0,2],[-1,3],[0,12],[0,3],[-1,1],[-1,2],[1,4],[2,3],[2,1],[4,2],[11,9],[6,2],[5,-5],[-3,11],[-1,5],[3,4],[2,8],[-5,-4],[-10,-16],[-8,-4],[-3,-3],[-3,-2],[-6,4],[-6,-3],[-3,0],[2,5],[3,6],[2,6],[0,6],[-2,6],[-1,7],[2,7],[4,5],[5,2],[5,0],[3,2],[-2,8],[3,2],[6,1],[3,4],[1,5],[1,7],[1,7],[2,3],[1,1],[3,4],[1,0],[2,1],[5,2],[14,0],[0,2],[0,1],[-1,3],[1,3],[-5,6],[-6,0],[-15,-4],[-5,-3],[-6,-6],[-30,-44],[-4,-8],[-1,-10],[2,-12],[0,-2],[-1,-5],[1,-4],[0,-3],[-3,-7],[-3,-5],[-3,-2],[-4,3],[-1,2],[-3,6],[-3,3],[-7,6],[20,46],[2,3],[4,3],[2,3],[0,2],[-3,1],[-3,0],[-2,-1],[-8,-8],[-2,0],[0,-2],[0,-8],[-1,-2],[-2,-2],[-1,-6],[-2,-6],[-3,-3],[-7,-1],[-3,1],[-3,3],[2,3],[-4,8],[1,5],[8,7],[-2,2],[-1,1],[-1,0],[0,2],[2,3],[1,4],[-1,4],[1,4],[2,1],[6,0],[2,2],[-3,3],[-7,-3],[-3,3],[3,3],[8,3],[5,7],[3,3],[6,1],[15,-3],[3,2],[5,8],[7,6],[12,18],[3,2],[2,-3],[4,-1],[6,0],[3,2],[5,7],[2,2],[0,3],[-14,-3],[-4,1],[-7,5],[-4,0],[6,11],[2,6],[-2,3],[-4,-4],[-8,-16],[-4,-3],[-3,8],[4,17],[6,17],[5,10],[-4,3],[-6,-4],[-5,-9],[-3,-15],[-6,-17],[0,-6],[0,-6],[1,-7],[0,-5],[-3,-11],[-6,-1],[-7,1],[-6,-5],[-4,-6],[-8,-4],[-7,0],[-6,3],[3,3],[4,1],[7,2],[-2,4],[-7,3],[-2,4],[3,6],[1,4],[1,4],[-4,-1],[-4,-5],[-4,-7],[-3,-8],[-10,-8],[-3,0],[-5,-5],[-2,-1],[-6,2],[-6,5],[-3,7],[4,7],[6,1],[11,-7],[5,3],[-11,9],[-2,4],[8,2],[5,4],[3,1],[5,-1],[2,2],[2,5],[-8,0],[-4,-1],[-3,-3],[-3,-3],[-5,2],[-3,3],[-1,5],[-3,0],[-4,0],[-4,1],[0,8],[3,3],[13,0],[43,-18],[-2,4],[-13,11],[16,8],[2,0],[2,-1],[1,1],[1,4],[-1,3],[0,3],[0,3],[1,4],[-4,-1],[-3,-3],[-3,-2],[-3,3],[1,4],[1,4],[0,4],[2,3],[0,2],[-7,0],[-4,-3],[-1,-7],[-2,-8],[-3,-5],[-4,-2],[-4,0],[-10,2],[-8,0],[-8,-2],[-4,0],[0,3],[5,2],[4,2],[3,5],[3,8],[0,4],[1,5],[2,2],[10,3],[7,8],[2,-1],[4,-4],[5,-3],[5,-1],[5,2],[4,5],[4,9],[-2,1],[-2,-1],[-1,-2],[-2,-1],[-2,-1],[-20,4],[-14,-8],[-3,2],[0,5],[5,11],[0,5],[-3,1],[-2,-5],[-3,-8],[-2,-3],[-1,-1],[0,-2],[0,-2],[-1,-1],[-1,0],[-1,2],[-1,1],[-10,3],[-16,-3],[-1,-1],[-1,-1],[-2,-5],[-2,-2],[-9,3],[6,6],[-1,0],[-3,3],[3,0],[4,-1],[2,1],[2,1],[4,7],[-1,5],[-1,3],[-2,1],[-2,0],[0,-6],[-4,-3],[-5,0],[-3,2],[-1,6],[-1,7],[1,13],[-1,5],[-3,-6],[-4,-9],[-2,-6],[-4,-1],[-4,3],[-3,5],[3,4],[-4,9],[-3,1],[-4,1],[-2,2],[-5,6],[-1,3],[-3,3],[-2,1],[-2,-1],[-3,1],[-2,3],[-1,2],[0,2],[-4,12],[-2,6],[-10,12],[-2,6],[2,4],[2,7],[3,15],[1,6],[5,11],[1,6],[2,9],[0,7],[1,6],[4,7],[4,2],[5,2],[3,2],[0,5],[5,8],[2,3],[1,6],[2,10],[1,4],[2,5],[3,4],[7,2],[5,6],[7,7],[-1,0],[-1,1],[-2,2],[2,4],[2,4],[4,6],[0,3],[-7,-4],[-7,-7],[-12,-20],[-11,-10],[-5,-9],[-3,0],[-1,4],[2,9],[-8,0],[0,-3],[4,-8],[-1,-7],[-8,-13],[-3,-8],[-2,-3],[-2,-1],[-2,2],[-1,6],[-1,5],[-4,1],[1,6],[7,15],[1,3],[0,9],[0,2],[2,1],[1,3],[0,4],[0,4],[2,2],[8,17],[4,4],[0,1],[-1,2],[1,2],[3,8],[55,30],[10,10],[6,12],[-11,2],[-6,-1],[-4,-5],[-3,-6],[-28,-26],[-21,-3],[-5,-4],[-9,-28],[-1,-1],[-1,-2],[-2,-3],[-1,-5],[-1,-6],[-1,-2],[-2,-1],[-2,-1],[-3,-7],[-2,-7],[-2,-7],[-4,-2],[-2,2],[1,5],[3,3],[2,0],[-1,8],[-1,2],[-2,0],[-2,3],[-1,1],[-1,2],[0,3],[5,11],[0,3],[7,18],[1,2],[3,2],[2,3],[3,3],[2,4],[3,9],[2,4],[2,1],[6,0],[3,3],[2,6],[-14,10],[-3,0],[-2,-5],[-2,-17],[0,-6],[-17,-12],[-6,-2],[-8,3],[-2,1],[-2,9],[-2,2],[-2,-3],[0,-5],[-1,0],[-2,3],[-2,3],[-2,2],[-6,-3],[-3,2],[20,15],[0,4],[-1,2],[-1,3],[-1,2],[0,5],[-2,2],[-2,-1],[-3,-3],[1,-2],[1,-6],[-3,-1],[-3,1],[-3,2],[-3,3],[2,6],[1,2],[2,1],[-1,4],[-1,4],[-2,6],[3,1],[7,-1],[2,1],[0,2],[0,2],[1,1],[4,6],[5,4],[6,2],[2,2],[0,5],[-1,4],[-3,0],[0,3],[8,8],[55,16],[-7,5],[-32,-3],[-8,3],[-2,-2],[0,-5],[-2,-3],[-9,-9],[-4,-4],[-5,-1],[-5,4],[0,2],[1,1],[1,3],[-9,8],[-5,2],[-3,-6],[-2,-5],[-9,5],[-3,-2],[-14,-4],[-3,-3],[-4,-7],[-5,-7],[-5,-6],[-4,-2],[-2,2],[-1,3],[0,5],[0,5],[2,3],[11,13],[4,3],[4,4],[4,8],[-6,-1],[-7,-4],[-7,-8],[-4,-8],[-4,-9],[-2,-4],[-3,-3],[-3,0],[-7,7],[-2,2],[0,3],[1,7],[1,7],[2,3],[2,1],[2,4],[2,1],[1,-1],[1,-2],[1,-1],[2,1],[1,4],[-3,3],[-7,1],[-2,-1],[-2,-3],[-2,-2],[-3,3],[2,7],[2,2],[4,1],[3,5],[-3,2],[-8,-2],[-3,4],[-1,6],[-1,7],[1,6],[2,3],[41,3],[-2,0],[57,6],[3,2],[0,1],[2,6],[2,2],[28,3],[-10,7],[-10,2],[-11,-4],[-14,-10],[-32,-3],[-4,-4],[-2,7],[-2,2],[-3,-1],[-4,-2],[-1,-2],[-1,-2],[-2,-1],[-1,-1],[-3,0],[-5,3],[-7,-1],[-7,-3],[-6,-1],[-6,5],[4,6],[4,9],[3,11],[2,11],[-4,1],[-3,-2],[-2,-4],[-1,-10],[-1,-7],[-4,-8],[-4,-7],[-2,-3],[-6,2],[1,8],[3,9],[1,6],[-4,5],[-7,-8],[-2,7],[7,7],[2,5],[3,6],[3,3],[7,-4],[2,1],[3,4],[2,2],[40,10],[5,4],[3,8],[-10,0],[-40,-12],[-3,0],[-3,2],[-2,2],[-2,9],[-3,8],[-2,8],[0,7],[4,8],[3,-4],[3,3],[2,6],[3,3],[3,-1],[8,-6],[11,-5],[1,-1],[0,-3],[1,-1],[1,0],[2,2],[1,1],[50,11],[2,-3],[-1,-6],[0,-5],[3,3],[2,4],[2,6],[3,13],[-4,3],[-59,-20],[-6,1],[-19,13],[-5,0],[-8,-9],[-5,-3],[-4,-3],[-1,-8],[2,-9],[8,-26],[0,-6],[-6,-2],[-2,1],[-3,6],[-1,1],[-4,1],[-8,8],[-15,3],[-2,-1],[-1,-1],[0,-3],[1,-4],[-2,0],[-2,1],[-3,2],[1,4],[1,3],[2,1],[2,1],[-1,3],[0,1],[0,1],[11,16],[3,8],[-9,-4],[-2,2],[-4,6],[-23,18],[0,3],[7,6],[24,6],[0,3],[-13,3],[-8,-4],[-2,-4],[-7,-4],[-3,0],[-1,4],[1,6],[1,6],[3,9],[5,6],[47,15],[-4,4],[2,5],[17,17],[26,16],[5,7],[0,3],[-3,-3],[-13,-3],[-24,-14],[-21,-26],[-6,-4],[-11,-3],[-9,2],[-3,11],[2,6],[4,-2],[4,-4],[3,0],[0,6],[-1,8],[0,5],[5,1],[0,3],[-3,2],[-3,3],[1,8],[-3,4],[-3,3],[1,4],[3,2],[4,-1],[3,1],[2,5],[-9,6],[-3,0],[-8,-5],[-3,-1],[-6,3],[-13,12],[-6,2],[6,9],[7,3],[22,-1],[4,-2],[11,-9],[4,0],[3,3],[-13,15],[4,4],[39,10],[10,-5],[4,-1],[8,10],[17,-1],[9,6],[23,26],[5,1],[9,-6],[5,-1],[11,0],[2,-1],[4,-6],[2,-2],[2,0],[3,2],[1,4],[2,4],[3,3],[6,-2],[3,1],[14,15],[5,2],[10,-2],[5,-4],[3,-7],[0,-10],[0,-4],[1,-5],[1,-2],[2,-2],[1,-3],[-1,-4],[0,-3],[3,4],[-1,6],[-2,6],[-1,6],[0,7],[1,6],[2,4],[2,4],[-2,5],[-4,2],[-4,0],[-4,2],[1,1],[1,3],[1,2],[-8,4],[-44,-22],[-14,-2],[-5,-4],[2,10],[1,5],[12,23],[3,4],[3,5],[1,7],[5,8],[9,10],[-5,4],[-5,-1],[-5,-6],[-10,-20],[-3,-5],[-10,-7],[-1,-2],[-2,-4],[-1,-3],[-1,-3],[-5,-2],[-4,-4],[-3,-1],[-8,0],[-3,0],[-4,-5],[-8,-13],[-51,-20],[-51,-20],[-1,1],[-2,4],[-2,1],[-15,0],[1,3],[-4,2],[-4,1],[-4,2],[-3,6],[3,3],[9,12],[3,2],[6,1],[10,-2],[11,-8],[6,-2],[-4,7],[-13,12],[-5,3],[-6,2],[-3,-3],[-3,-4],[-17,-14],[-4,0],[-1,5],[1,9],[-3,2],[-8,-2],[5,10],[11,4],[41,1],[1,-2],[5,-6],[4,-6],[2,-2],[12,-2],[21,13],[2,2],[6,10],[2,1],[10,0],[2,-1],[5,-6],[2,-1],[1,1],[4,6],[2,1],[3,1],[7,5],[0,3],[-7,3],[-17,-4],[-8,10],[3,1],[3,3],[4,8],[1,2],[2,2],[1,1],[0,3],[1,2],[0,1],[0,2],[0,2],[-1,3],[0,3],[0,2],[3,2],[2,1],[3,10],[2,4],[2,2],[13,7],[7,0],[3,-8],[4,-5],[17,-7],[6,2],[-3,4],[-4,3],[-9,1],[-1,3],[-1,5],[0,7],[-1,5],[7,-7],[22,-13],[2,0],[1,1],[1,0],[5,-4],[7,0],[8,-3],[4,0],[1,6],[2,2],[8,-2],[1,1],[2,2],[2,0],[0,1],[0,3],[0,3],[0,2],[2,1],[5,1],[3,4],[1,0],[0,1],[0,3],[0,1],[-1,2],[-2,1],[-1,0],[0,2],[1,3],[0,1],[-5,-1],[-4,-3],[-9,-10],[-7,-4],[-5,-4],[-2,-1],[-5,0],[-32,17],[-5,6],[0,3],[4,2],[12,10],[10,4],[5,5],[3,8],[-5,-5],[-17,-4],[-10,-5],[-5,1],[-3,10],[2,2],[4,5],[2,5],[2,5],[-10,-4],[-6,0],[-4,4],[1,3],[-6,2],[-16,-8],[-6,8],[5,6],[8,12],[5,3],[11,-1],[9,-5],[12,-3],[3,2],[6,7],[2,1],[3,4],[2,1],[4,-4],[2,0],[2,2],[2,2],[-5,4],[-4,1],[-14,-4],[-3,2],[-9,5],[0,3],[30,9],[3,-2],[6,-5],[3,-2],[11,-3],[5,-5],[5,-8],[2,-7],[4,-23],[2,-8],[9,-25],[4,-7],[21,-15],[11,-13],[5,-2],[4,-4],[5,-1],[2,-2],[23,-21],[9,-6],[10,3],[1,0],[-2,7],[-4,5],[-6,4],[-4,4],[0,3],[0,11],[-7,5],[-14,1],[-5,9],[-6,8],[-2,1],[-4,1],[-14,10],[-6,5],[-3,5],[-2,6],[0,5],[-2,6],[-4,13],[-1,4],[-1,6],[0,5],[1,7],[2,4],[3,2],[12,5],[3,4],[-1,5],[-4,3],[-9,2],[-3,-1],[-6,-5],[-3,0],[-3,1],[-3,3],[-4,7],[1,9],[2,3],[1,3],[3,3],[3,1],[2,3],[2,4],[-2,6],[2,5],[21,21],[-2,3],[-5,-3],[-5,-6],[-4,-3],[-11,-2],[-5,-4],[-2,-7],[-2,-6],[-4,-10],[-5,-7],[-3,-4],[-3,0],[-1,1],[-1,2],[-2,4],[-2,3],[-1,-1],[-2,-2],[-2,-1],[-25,3],[-4,3],[-3,4],[-1,7],[-2,16],[-2,6],[-2,7],[-7,9],[-3,6],[0,8],[-1,1],[0,4],[-1,3],[1,3],[-1,3],[-3,6],[2,4],[1,5],[0,4],[-1,4],[-4,3],[-4,0],[-4,1],[-3,8],[1,3],[0,6],[-1,6],[-1,5],[-6,14],[-1,3],[2,5],[14,12],[4,5]],[[3621,2261],[1,-1],[9,9],[3,4],[3,3],[2,2],[3,3],[2,3],[3,3],[3,3],[4,3],[3,3],[4,3],[3,3],[4,2],[3,3],[4,3],[3,3],[4,2],[4,3],[4,2],[4,2],[3,2],[4,2],[4,2],[4,2],[4,1],[4,2],[2,1],[3,0],[2,1],[3,1],[3,0],[4,1],[2,0],[3,0],[47,0],[47,0],[34,0],[33,0],[81,0],[81,0],[81,0],[81,0],[81,0],[81,0],[81,0],[81,0],[81,0],[81,0],[0,364],[0,363],[0,95],[0,94]],[[4710,3253],[0,206],[0,206],[0,56],[0,56],[0,42],[0,43],[0,248],[0,248],[0,171],[0,171]],[[4710,4700],[82,0],[69,0],[12,0],[81,0],[81,0],[81,0],[81,0],[81,0],[81,0],[81,0],[81,0],[81,0],[81,0],[81,0],[81,0],[81,0],[81,0],[82,0],[81,0],[81,0],[81,0],[81,0],[81,0],[81,0],[81,0],[82,0],[81,0],[81,0],[81,0],[82,0],[81,0],[13,0],[14,0],[66,21],[65,21],[11,5],[5,2]],[[7318,4749],[7,-11],[4,-7],[6,-16],[3,-5],[10,-4],[5,-4],[5,-5],[5,-7],[3,-9],[-3,-4],[-11,-1],[-6,2],[-16,12],[-19,0],[-2,2],[-5,6],[-3,1],[-6,-1],[-20,-8],[-8,0],[-3,2],[-5,6],[-2,1],[-12,-3],[-5,-4],[-2,-5],[49,-12],[6,-7],[1,-12],[8,0],[2,1],[1,1],[12,-7],[0,-6],[-2,-7],[-3,-5],[-4,-10],[-3,-21],[-2,-11],[-6,-11],[-17,-27],[-7,-6],[-8,-3],[-15,0],[0,-3],[3,-5],[4,-2],[8,-2],[0,-2],[-4,-3],[-7,-10],[-9,-3],[-8,-6],[-5,-1],[-12,1],[-4,-1],[-2,-2],[-4,-6],[-2,-1],[-20,3],[-52,-19],[-4,-6],[-2,-1],[-16,3],[-4,-1],[-4,-2],[-2,-6],[0,-1],[0,-2],[8,-6],[1,-2],[0,-4],[-2,-2],[-1,-3],[-1,-3],[15,0],[13,8],[4,1],[4,2],[7,10],[4,2],[5,1],[15,8],[35,2],[5,2],[8,11],[6,1],[10,-2],[19,3],[-2,-3],[-1,-3],[-2,0],[-2,0],[1,-4],[1,-2],[1,-2],[0,-2],[-4,-8],[-2,-4],[-1,-4],[1,-7],[3,-4],[8,-10],[6,-5],[21,6],[11,-1],[69,15],[70,15],[19,-6],[26,6],[17,10],[9,2],[35,-4],[7,-5],[26,-35],[-3,-5],[-3,-3],[-4,-2],[-10,-2],[-1,-2],[0,-6],[-40,-17],[-4,-1],[-21,5],[-13,11],[-6,1],[-8,-9],[-10,-4],[-9,-11],[-6,-3],[-13,-3],[-6,-3],[-17,-22],[-2,-6],[-4,-3],[-44,-17],[-12,-12],[-6,-4],[-14,-2],[-33,21],[-24,1],[-1,-2],[-9,-2],[-18,-18],[-9,-3],[-15,6],[-2,-3],[1,-7],[3,-7],[5,-5],[3,-2],[11,4],[13,0],[22,8],[21,0],[3,-3],[8,-14],[6,-4],[3,-3],[2,-2],[1,0],[4,3],[11,2],[10,7],[34,9],[7,0],[4,-5],[1,-4],[0,-5],[-1,-10],[0,-5],[0,-4],[1,-2],[2,-3],[6,-4],[21,5],[5,3],[4,6],[16,40],[1,6],[-1,3],[-1,2],[-1,5],[1,5],[2,3],[1,4],[-2,5],[14,15],[4,2],[8,-3],[4,0],[4,3],[11,17],[4,4],[6,1],[34,-4],[5,-3],[11,-13],[35,-6],[8,6],[6,6],[41,21],[13,13],[71,30],[5,5],[12,3],[9,6],[9,0],[6,-2],[2,-4],[-6,-8],[-6,-2],[-14,-1],[-6,-5],[20,0],[-2,-4],[-6,-5],[-2,-4],[0,-2],[-2,-4],[-1,-5],[2,-7],[0,-1],[2,-2],[1,0],[14,-1],[3,1],[1,3],[1,4],[1,4],[3,3],[20,20],[4,3],[5,-1],[7,-3],[6,-5],[2,-7],[1,-6],[1,-4],[2,-3],[2,0],[2,1],[0,3],[0,2],[1,2],[6,3],[6,-3],[5,-5],[12,-6],[10,-9],[4,0],[3,-3],[14,-6],[1,-3],[1,-3],[0,-3],[0,-2],[2,-1],[5,1],[34,-6],[7,-4],[23,-5],[3,-3],[2,-5],[3,-3],[3,-2],[7,-1],[2,-1],[3,-5],[5,-2],[11,7],[6,-3],[4,-3],[13,-1],[4,-1],[7,-6],[4,-2],[64,1],[64,0],[65,0],[4,4],[9,3],[13,8],[16,2],[2,-2],[3,-5],[0,-3],[-2,-2],[-2,-3],[-8,-16],[-1,-4],[-14,-14],[-8,-16],[-7,-4],[-7,-8],[-3,0],[-2,5],[-1,5],[-2,4],[-2,2],[-4,1],[-1,-1],[0,-4],[-1,-5],[0,-3],[-2,-2],[-2,0],[-7,1],[-2,-4],[-1,-10],[-3,-3],[-25,4],[-3,-2],[-3,-6],[-4,3],[1,3],[0,2],[1,2],[2,1],[-4,0],[-9,3],[-4,0],[-2,-1],[-3,-3],[-2,-4],[-1,-5],[2,-6],[5,-3],[15,-2],[3,-2],[1,-3],[-1,-1],[-5,-5],[-3,4],[-15,2],[-3,3],[-5,12],[-6,6],[-5,1],[-5,-4],[-4,-6],[7,-12],[2,-4],[-2,-4],[-3,-1],[-21,4],[-7,-1],[-6,-8],[1,0],[4,-2],[44,-6],[7,-8],[2,-1],[1,-2],[-1,-7],[-1,-3],[-12,-10],[-6,-2],[-12,4],[-11,7],[-5,6],[-9,16],[-5,6],[-6,3],[-6,-1],[-3,-3],[0,-2],[2,-1],[4,0],[2,-1],[3,-6],[5,-5],[3,-9],[2,-9],[1,-4],[1,-4],[-1,-1],[-16,4],[-9,-5],[-37,-7],[-48,10],[3,-5],[34,-11],[3,-5],[3,-7],[1,-8],[2,-6],[3,-5],[8,-5],[0,-3],[-7,-3],[-12,-2],[-6,-3],[0,-3],[13,0],[5,-3],[-4,-12],[-7,-7],[-20,-15],[-20,10],[-2,5],[-1,6],[-1,7],[-4,5],[-3,2],[-2,-3],[-1,-8],[-2,-4],[-5,-1],[-31,12],[-8,7],[-4,2],[-4,-3],[24,-19],[10,-1],[5,-3],[3,-5],[2,-6],[1,-7],[1,-7],[-2,-4],[-4,-1],[-8,1],[2,-5],[0,-2],[2,-2],[-3,-3],[0,-2],[3,-1],[4,-4],[2,-1],[-2,-4],[-4,0],[-20,10],[-1,2],[-13,-2],[-4,2],[4,-5],[0,-7],[-4,-7],[-8,-13],[-5,-4],[-5,1],[-5,4],[0,3],[6,2],[-3,3],[-15,-3],[-13,6],[-3,4],[-1,1],[-1,8],[-2,2],[-4,-1],[-2,-1],[1,-4],[-1,-2],[0,-2],[-1,-1],[-1,0],[1,-4],[6,-7],[6,-4],[6,-7],[4,-16],[-3,0],[-6,-2],[-5,-5],[-7,0],[-3,-2],[0,-3],[4,-2],[14,2],[4,-1],[2,-3],[0,-4],[-3,-6],[-7,-5],[-22,-1],[0,3],[1,1],[1,0],[0,1],[1,1],[0,3],[-4,-1],[-14,2],[-7,6],[-21,9],[-4,-2],[0,3],[-2,-3],[-12,-5],[-3,-4],[-1,-2],[1,-3],[1,-6],[-9,2],[-3,-2],[-1,-5],[2,-2],[33,-1],[-1,0],[8,-2],[4,-4],[2,-6],[-1,-3],[-1,-3],[0,-4],[1,-4],[-5,-3],[-11,-1],[-4,-5],[2,-2],[4,-3],[3,-1],[3,0],[-6,-9],[-11,0],[-11,5],[-6,7],[0,3],[-1,0],[-4,-3],[-8,-3],[6,-7],[8,-15],[5,-6],[-2,-8],[-3,-3],[-8,-1],[0,-3],[1,0],[0,-3],[-5,2],[-6,5],[-3,6],[4,5],[-21,0],[-18,13],[-5,1],[-6,-3],[17,-19],[1,-6],[-6,-4],[-12,-6],[6,-4],[20,2],[5,-4],[3,-6],[0,-5],[-6,-2],[-25,2],[-10,-2],[0,-2],[-2,-7],[-1,-3],[5,-3],[15,-3],[3,-2],[-2,-6],[-6,-11],[-7,-2],[-19,8],[-6,-7],[8,-6],[-2,-1],[-4,-1],[-1,-2],[-3,-1],[-2,1],[-1,-1],[2,-3],[0,-3],[-17,-17],[-19,-4],[-4,2],[-4,3],[-7,-3],[-3,0],[-3,2],[-7,1],[-2,-1],[-2,-2],[-1,-1],[-3,-4],[0,-4],[0,-3],[1,-2],[1,-2],[1,-2],[1,0],[2,-2],[0,-4],[-1,-2],[-2,-1],[-2,0],[-1,0],[0,-3],[3,0],[-3,-8],[-6,-7],[-15,-9],[-6,0],[-2,1],[-2,2],[-3,6],[-2,1],[-4,-1],[-12,-9],[-6,-2],[-5,2],[-5,3],[-2,7],[4,8],[-8,2],[-16,-29],[-12,7],[-6,-2],[-6,-5],[-4,-4],[0,-4],[1,-9],[0,-2],[-2,-1],[-4,-3],[-2,-1],[-14,5],[-3,4],[-3,4],[-11,-2],[-8,3],[-4,-1],[-2,-4],[3,-7],[9,-5],[4,-5],[3,-7],[-3,-2],[-6,2],[-7,-3],[-23,1],[-11,5],[0,3],[2,2],[3,4],[1,3],[-15,0],[-4,-4],[-4,-8],[-4,-6],[-11,3],[-4,-3],[-1,-6],[25,-11],[-5,-6],[-18,-2],[-6,-3],[-5,4],[-12,7],[-5,7],[-2,10],[-1,8],[-2,5],[-6,2],[-6,-4],[-1,-5],[2,-8],[-2,-11],[0,-4],[3,-10],[0,-6],[-2,-1],[-3,2],[-3,6],[-2,-4],[-2,-5],[-2,-4],[-3,-1],[-2,2],[-7,8],[-9,12],[-7,3],[-15,1],[2,-3],[6,-3],[2,-3],[2,-3],[5,-11],[0,-3],[-7,-6],[-24,9],[-10,0],[2,-11],[-2,-4],[-4,0],[-3,1],[-4,-1],[-4,-2],[-3,-4],[-3,-2],[0,-3],[1,-1],[2,-1],[1,-1],[-3,-7],[-5,0],[-21,8],[-5,0],[-3,-4],[-1,-8],[-1,-10],[-16,13],[-5,1],[0,-7],[-4,1],[-17,14],[-3,4],[-3,3],[-4,1],[-3,-3],[-1,-5],[0,-6],[3,-6],[4,-4],[4,-2],[3,-3],[2,-9],[-6,-13],[-4,-5],[-5,-2],[-3,4],[-11,21],[-1,1],[-1,-2],[-6,-4],[-1,-2],[-2,-5],[0,-13],[-2,-5],[-5,-1],[-9,7],[-5,-6],[4,-5],[9,-6],[3,-7],[0,-2],[-5,4],[-6,3],[-11,1],[-2,1],[-8,8],[-6,2],[-2,3],[-2,3],[1,4],[3,11],[-11,-3],[-3,1],[-5,4],[-7,2],[-2,5],[0,6],[0,6],[0,9],[-1,3],[-3,1],[-2,3],[-3,5],[-1,5],[-1,2],[-3,0],[-4,-8],[-2,-1],[-5,-3],[-6,-1],[-3,-2],[-2,-4],[0,-9],[-3,-5],[-4,-3],[-3,-3],[1,-10],[3,-5],[8,-9],[1,-4],[-1,-2],[-3,-2],[-4,-1],[-2,0],[-4,0],[-10,8],[-5,3],[-5,1],[-12,-2],[-5,-5],[2,-5],[5,0],[9,3],[5,-1],[4,-4],[4,-6],[3,-7],[0,-1],[0,-3],[0,-4],[1,-3],[1,-1],[3,-2],[1,-2],[10,-18],[-4,-3],[-4,-3],[-6,5],[-2,1],[-2,-1],[-2,-3],[-1,-3],[-2,-2],[-2,-1],[-9,4],[-2,-1],[-5,-4],[-2,-1],[-11,1],[-4,3],[-5,8],[-1,5],[-1,4],[0,9],[2,12],[0,7],[-1,3],[-9,1],[-35,14],[-23,-1],[3,-6],[49,-23],[3,-5],[2,-18],[2,-7],[1,-7],[-3,-5],[4,-3],[3,-3],[-5,-4],[-6,-1],[-7,3],[-4,5],[0,1],[1,1],[1,1],[-4,-2],[-9,-6],[-4,-1],[-6,0],[-2,1],[-3,4],[-1,1],[-6,3],[-3,0],[-5,-5],[-2,-1],[-8,3],[-4,0],[-4,-3],[1,-2],[3,-4],[-3,-5],[-13,4],[-3,-3],[-1,-3],[-3,3],[-5,7],[-2,0],[-1,0],[-1,-2],[0,-3],[-2,0],[-3,2],[-3,1],[-9,8],[-35,17],[-7,6],[4,5],[5,1],[10,-1],[-4,6],[-7,1],[-6,-1],[-5,-3],[-2,0],[-2,-3],[-1,-5],[2,-6],[2,-4],[8,-3],[3,-5],[-4,-4],[-5,-1],[-18,-1],[-4,3],[-4,6],[1,1],[0,1],[1,1],[-13,-2],[-1,2],[0,4],[-2,8],[0,5],[0,3],[2,6],[2,5],[1,1],[0,2],[-3,4],[-2,1],[-2,0],[-2,2],[-1,5],[2,0],[3,1],[2,3],[-1,5],[3,2],[3,-1],[3,-3],[12,-2],[5,1],[3,3],[-3,4],[-3,3],[-4,1],[-50,6],[-2,-1],[-4,-4],[-2,-1],[-3,1],[-4,1],[-3,4],[-1,7],[-1,5],[-7,9],[-2,5],[0,6],[1,5],[-1,4],[-3,5],[-8,4],[-2,4],[0,9],[1,5],[3,12],[1,6],[-3,5],[-3,0],[-2,-4],[-7,-19],[-3,-3],[-3,-2],[-9,10],[-3,5],[2,4],[3,13],[-6,8],[-1,4],[-1,4],[-1,8],[0,5],[-2,6],[-7,15],[-2,5],[-5,2],[-5,-3],[-3,-8],[2,-11],[2,-7],[4,-4],[5,-3],[4,-1],[-4,-2],[-1,-12],[-4,-3],[-14,1],[-5,2],[12,-34],[6,-13],[9,-8],[18,-10],[10,2],[4,-5],[2,-8],[2,-8],[3,-5],[1,-8],[14,-35],[-3,-3],[-4,2],[-3,3],[-14,9],[-28,3],[-8,5],[-1,-1],[-1,-2],[1,-7],[-1,-4],[2,-3],[3,-2],[2,1],[5,6],[4,1],[6,-3],[23,-17],[-1,-1],[-2,-5],[15,3],[8,-2],[4,-8],[1,-6],[3,-7],[1,-6],[0,-3],[0,-3],[-1,-4],[1,-7],[-3,1],[-10,5],[-2,-1],[-6,-5],[-3,0],[1,-5],[3,-3],[5,-3],[-1,-5],[-2,-3],[-2,-2],[3,1],[5,0],[-1,-6],[-3,-4],[-2,-3],[1,-7],[2,-4],[7,-2],[2,-6],[-3,1],[-9,3],[0,-3],[1,-7],[1,-2],[-5,0],[-5,5],[-3,1],[-2,-10],[3,-3],[4,-6],[3,-7],[-2,-3],[-22,5],[-5,7],[-4,2],[-14,-5],[-16,0],[-4,-2],[-1,-5],[2,-5],[2,-6],[-6,-5],[-13,-4],[-7,-5],[2,-7],[-1,-4],[-3,-4],[-12,-8],[-1,-2],[-1,-3],[-1,-2],[-5,-2],[-4,-5],[-9,-3],[-5,-5],[-20,-2],[-13,7],[-4,0],[-4,-1],[-3,-2],[-1,-8],[1,-5],[3,-3],[4,-1],[9,-1],[5,-2],[2,-6],[-1,-1],[-4,-6],[-1,-3],[-1,-4],[-2,-2],[-3,-1],[-2,-2],[-7,-12],[-3,-5],[-4,-1],[-6,-1],[-2,1],[-7,8],[-2,0],[-5,-5],[1,-7],[4,-7],[4,-4],[-5,-8],[7,2],[4,-1],[1,-6],[-2,-6],[-3,-5],[-7,-4],[0,-3],[10,-7],[2,-2],[-1,-5],[-2,-2],[-2,-1],[-2,-2],[-3,-9],[-2,-3],[-3,-1],[-6,-1],[-2,2],[-2,5],[3,3],[-2,4],[-3,2],[-2,-5],[-1,-1],[-9,2],[0,-1],[1,-2],[0,-1],[0,-1],[-4,0],[-4,2],[-4,1],[-3,-3],[5,-6],[0,-1],[-1,0],[0,-1],[0,-1],[4,-2],[20,-4],[0,-2],[-2,-1],[-6,-2],[0,-3],[3,-1],[3,-2],[1,-3],[-2,-6],[2,-6],[8,-6],[2,-5],[-19,-6],[-11,0],[-2,1],[-2,3],[-1,3],[-1,2],[-2,0],[-1,-1],[-10,-13],[0,-2],[3,-3],[10,4],[3,-1],[9,-7],[-2,-10],[-3,-4],[0,-4],[5,-5],[-4,-6],[-1,-4],[-1,-5],[1,-3],[2,-3],[1,-4],[-1,-4],[-2,1],[-7,8],[-3,0],[-7,0],[1,0],[-3,-1],[-2,-3],[-1,-4],[-1,-5],[-1,-4],[-3,-2],[-17,-5],[-6,-5],[-4,-6],[7,-2],[6,4],[6,2],[5,-10],[0,-1],[0,-2],[-3,-2],[-36,2],[2,-3],[11,-8],[1,2],[3,-5],[1,-3],[-4,-3],[-5,2],[-5,3],[-4,1],[-4,-2],[1,-5],[3,-4],[4,-3],[-1,-4],[-5,-7],[-1,-4],[-4,-16],[-1,-5],[1,-6],[2,-7],[1,-7],[1,-2],[3,-3],[2,0],[2,1],[2,-1],[0,-5],[-2,-7],[-4,-4],[-3,1],[1,10],[-7,4],[-1,1],[-2,4],[-2,5],[-2,3],[-2,0],[1,-5],[3,-15],[2,-3],[0,-2],[-1,-2],[-1,-2],[-2,2],[-2,4],[-1,2],[-2,1],[2,-17],[-4,-5],[-9,2],[3,-6],[-1,-1],[-1,-1],[-1,-1],[4,-5],[-1,-4],[-5,-5],[-2,-4],[-2,-5],[-2,-5],[1,-3],[-7,-14],[-2,-4],[-4,-1],[-1,3],[0,5],[4,12],[1,12],[1,5],[0,5],[-1,4],[-3,0],[-3,-5],[1,-6],[-1,-6],[-8,-16],[-3,-3],[-2,8],[-2,5],[-1,7],[2,13],[0,6],[-1,7],[-2,6],[-1,12],[-3,-6],[-1,-11],[2,-7],[-1,-2],[-7,-14],[-2,-2],[-4,-2],[-2,-3],[6,0],[2,-2],[3,-6],[-3,-4],[-5,-2],[-2,-3],[4,-8],[10,-6],[4,-9],[-6,-8],[-2,-4],[-2,-2],[-8,1],[-3,-4],[-1,-7],[0,-9],[-2,-6],[-3,-1],[-1,-3],[-3,0],[-6,0],[-3,-1],[-3,-2],[-4,-6],[0,-3],[2,0],[1,2],[2,3],[1,1],[2,0],[3,-2],[1,-1],[1,-3],[-2,-6],[-2,-7],[-1,-4],[-3,0],[-3,2],[-4,11],[-2,2],[-1,-3],[-1,-5],[1,-4],[0,-9],[2,-1],[0,-2],[1,-2],[-8,-1],[-2,-3],[-1,-5],[-3,-3],[-3,0],[-3,2],[-1,3],[1,1],[1,1],[1,2],[0,4],[-1,3],[-1,2],[-2,-1],[-2,-2],[-1,-1],[-11,-2],[1,0],[-1,-1],[-1,1],[1,-4],[3,-4],[1,-4],[-3,-6],[-3,-4],[-4,-1],[-24,19],[-2,4],[2,5],[1,7],[1,8],[0,7],[-1,5],[-3,-2],[-5,-7],[-1,-2],[-1,-6],[-1,-1],[-3,0],[-1,-1],[-2,-2],[-1,-6],[0,-5],[0,-6],[-2,-3],[1,-5],[2,-1],[3,1],[2,-1],[9,-8],[12,-7],[3,-5],[-4,-8],[-9,-3],[-16,2],[-21,18],[-6,3],[-6,-1],[-2,1],[-2,2],[1,4],[1,5],[0,4],[-2,2],[-2,-1],[-3,-3],[-4,-8],[0,-1],[1,-4],[-15,0],[-3,3],[-4,14],[-3,3],[-3,2],[-3,4],[-7,16],[-4,4],[-3,3],[-4,2],[0,3],[3,2],[3,1],[2,1],[2,5],[-13,-2],[-3,3],[-3,-2],[-4,-8],[1,0],[0,-2],[3,-4],[3,-4],[3,-1],[2,-2],[4,-8],[3,-3],[4,-6],[2,-1],[3,0],[2,0],[1,-3],[2,-3],[0,-3],[-1,-3],[1,-3],[-2,-5],[-3,-4],[-6,-5],[0,-3],[11,3],[3,0],[3,-2],[4,-5],[2,-2],[6,-1],[2,-1],[0,-4],[-6,-3],[-13,-3],[-5,-8],[10,3],[2,-2],[2,-4],[1,-4],[2,-4],[2,-5],[1,-5],[1,-5],[-1,-5],[-2,-5],[0,-4],[-3,0],[-4,2],[-2,4],[1,8],[-2,2],[-1,2],[-2,5],[0,2],[-1,5],[0,1],[-3,4],[-4,2],[-4,0],[-4,-3],[3,-4],[5,-1],[3,-3],[0,-3],[2,-12],[-4,-6],[-6,0],[-11,3],[-5,5],[-6,0],[-6,-6],[-3,-10],[4,1],[8,4],[4,1],[18,-9],[2,-3],[-6,-4],[-8,-2],[-13,6],[-4,0],[0,-3],[2,0],[1,0],[2,-3],[-6,1],[-3,-2],[-1,-4],[3,0],[5,-3],[3,0],[0,-3],[-2,0],[-2,0],[-2,-1],[-2,-2],[0,-3],[1,-1],[2,-3],[2,-1],[0,-3],[-16,-13],[-9,-4],[0,-4],[1,0],[1,-2],[-7,-11],[-2,-1],[-2,1],[-5,5],[-3,-1],[-4,-3],[-4,-2],[-4,3],[3,9],[1,6],[-1,2],[-6,-9],[-3,-3],[-2,5],[1,5],[2,6],[1,5],[-2,3],[-2,-2],[-3,-5],[-1,-2],[-2,0],[-6,0],[0,-3],[1,0],[3,-2],[-1,-6],[0,-9],[-1,-6],[1,-3],[0,-3],[-6,2],[-2,6],[-1,9],[-1,27],[1,10],[2,9],[5,6],[-3,7],[-5,-1],[-10,-6],[-11,4],[-5,-1],[-5,-5],[2,-4],[3,-2],[3,-2],[3,-1],[2,1],[2,1],[1,0],[1,-2],[0,-2],[-1,-2],[-1,-1],[-5,-19],[-3,-3],[-23,-10],[-10,-11],[-3,-1],[-24,0],[2,-5],[3,-1],[4,1],[4,0],[-3,-14],[-2,-4],[-3,-4],[-18,-11],[-4,-1],[-3,2],[-2,5],[4,7],[-3,5],[1,0],[1,1],[-1,3],[-1,3],[-3,4],[-1,2],[0,5],[-1,2],[-1,1],[-2,2],[-1,1],[0,7],[2,9],[3,8],[2,5],[0,4],[3,9],[0,4],[-1,4],[-2,1],[-3,1],[-2,-1],[-3,-6],[-1,-7],[1,-8],[2,-8],[-3,-2],[-2,3],[-3,5],[-4,3],[-1,-3],[2,-6],[5,-12],[-3,-4],[-3,-4],[2,-5],[3,-6],[1,-7],[-2,-2],[-16,3],[0,-3],[18,-13],[6,-2],[-2,-11],[-2,-8],[-4,-6],[-5,-1],[-4,4],[-4,5],[-4,4],[-5,-1],[0,-3],[10,-9],[4,-5],[2,-2],[2,-1],[-4,-3],[-4,0],[-41,34],[-14,21],[-4,3],[-11,5],[-6,9],[-2,0],[0,-2],[-1,-7],[-1,-2],[-3,-3],[-7,-1],[-3,-2],[-3,-5],[-2,-5],[-2,-2],[-4,3],[0,3],[2,2],[2,5],[2,6],[1,4],[2,3],[4,3],[2,3],[1,3],[2,6],[2,2],[-8,5],[-2,4],[2,6],[-2,0],[-2,2],[-1,4],[0,4],[2,4],[6,7],[4,3],[14,-1],[-2,2],[4,12],[2,4],[4,2],[7,-3],[2,1],[0,3],[-1,4],[-1,2],[0,3],[-1,3],[0,4],[1,4],[1,2],[2,1],[7,13],[4,4],[5,4],[21,30],[3,1],[6,-2],[4,1],[3,2],[7,6],[0,3],[-4,7],[-4,3],[-28,-10],[-5,2],[-6,7],[-4,2],[-4,-2],[-7,-8],[-4,-1],[-7,2],[-12,10],[-10,3],[-8,7],[-3,4],[-2,5],[-1,6],[-1,12],[-1,2],[-1,-2],[-1,-4],[0,-5],[0,-3],[0,-10],[1,-1],[-2,-3],[-4,-2],[-4,-1],[-3,3],[-1,1],[-1,1],[-1,1],[0,1],[0,2],[-7,-2],[-16,3],[-5,-6],[-2,-5],[0,-4],[0,-8],[62,-19],[3,-2],[6,-7],[2,-2],[0,-3],[-8,-14],[-4,-3],[-3,0],[-4,2],[-1,3],[3,3],[0,4],[-17,-4],[-4,2],[-4,3],[-4,1],[-4,-6],[10,-6],[5,-8],[6,0],[3,-3],[-5,-6],[3,-1],[0,-3],[-2,-4],[-2,-3],[-1,-1],[-4,-1],[-2,-1],[-1,-2],[-2,-8],[-3,-4],[-3,-3],[-3,-2],[-4,-1],[-3,-2],[-2,-1],[-2,2],[0,2],[-1,3],[-1,2],[-3,-2],[-1,-4],[1,-5],[3,-4],[3,-1],[8,1],[6,4],[2,-2],[2,-5],[0,-7],[-2,-3],[-3,-2],[-3,-3],[1,-4],[1,-8],[1,-8],[0,-9],[1,-9],[-3,-4],[-5,-5],[-5,-3],[-3,0],[1,4],[1,7],[0,6],[-2,2],[-2,-1],[-3,-6],[-3,-1],[0,3],[0,3],[0,1],[0,1],[-3,0],[-1,-2],[-2,4],[-3,1],[-1,-4],[1,-7],[2,-2],[4,-3],[1,-2],[0,-4],[-1,-3],[-1,-2],[-2,-1],[-17,0],[-7,4],[-6,10],[1,3],[1,5],[-1,5],[-4,4],[-2,9],[-1,3],[-2,1],[-4,4],[-3,1],[-4,-1],[-1,-1],[-1,-1],[4,-15],[1,-6],[0,-6],[-1,-6],[0,-5],[1,-6],[3,-4],[23,-17],[3,-4],[0,-2],[-1,-4],[7,-1],[18,-8],[3,-2],[1,-5],[-1,-6],[-1,-5],[-2,-2],[-11,3],[1,-4],[3,-4],[1,-3],[-1,0],[-1,0],[1,-4],[0,-2],[0,-2],[-3,-7],[0,-2],[0,-2],[1,-4],[1,-3],[-4,0],[-2,3],[-2,3],[-3,2],[-3,0],[2,-5],[4,-6],[2,-2],[-2,-12],[-4,-4],[-5,2],[-6,4],[0,2],[-2,1],[-5,0],[-2,0],[-2,-2],[-2,-1],[-1,1],[-2,4],[-1,1],[-2,-3],[-1,-16],[-2,-7],[-2,-2],[-2,-1],[-2,-1],[-2,1],[-1,3],[0,3],[0,3],[0,4],[1,11],[3,4],[4,2],[4,5],[-3,2],[-7,-4],[-3,2],[-1,2],[0,7],[-1,2],[-2,2],[-1,-2],[0,-3],[2,-2],[-2,-6],[-1,-3],[-1,-3],[1,-3],[0,-3],[1,-3],[0,-2],[-3,-2],[-2,2],[-3,3],[-1,2],[0,3],[2,9],[-3,2],[-4,0],[-2,-1],[1,-4],[0,-3],[-8,-1],[-3,1],[-3,4],[-2,5],[-3,3],[-3,-3],[-2,-9],[5,-8],[7,-4],[5,-2],[2,1],[1,1],[1,1],[2,-3],[2,0],[0,-2],[0,-6],[0,-1],[4,-8],[1,-6],[-1,-3],[-2,1],[-6,6],[-2,1],[-15,0],[-3,1],[-6,9],[-3,2],[-1,-1],[-2,-1],[-2,-3],[-3,-11],[-5,-5],[-5,1],[-4,6],[1,0],[1,1],[0,1],[1,0],[-5,-1],[-5,-3],[-10,-10],[1,9],[0,3],[-2,5],[-5,17],[-2,5],[-3,8],[-1,2],[-2,0],[-2,-2],[-1,0],[-9,12],[-7,2],[-6,5],[-4,15],[-4,-11],[1,-5],[5,-2],[4,-5],[2,-4],[3,-11],[4,-7],[1,-4],[-1,-6],[3,1],[2,-2],[2,-3],[1,-6],[-1,-5],[-3,-1],[-6,2],[-2,2],[-4,8],[-2,1],[-2,-3],[0,-6],[1,-6],[1,-5],[-1,-4],[-1,-3],[-2,0],[-2,4],[-1,5],[0,5],[1,5],[1,5],[0,6],[0,3],[-1,1],[-1,-1],[0,-1],[-2,-8],[-1,-1],[-3,-5],[1,-9],[0,-7],[-3,-3],[-4,-1],[-4,2],[-3,6],[-6,12],[1,2],[1,1],[0,3],[-3,1],[-3,2],[-3,4],[1,6],[2,4],[3,4],[1,2],[-3,3],[-3,-3],[-3,-4],[-3,-1],[-3,3],[-6,11],[-3,3],[-2,-1],[-3,-2],[-3,-3],[-1,-3],[1,-4],[11,-13],[-4,-3],[-4,3],[-4,6],[-4,3],[-4,-2],[-3,-5],[0,-6],[5,-5],[0,-3],[-8,1],[-3,-2],[-3,-4],[17,-8],[2,-4],[0,-5],[-3,-4],[-3,1],[-6,6],[-3,2],[-2,-3],[0,-6],[1,-7],[1,-4],[-3,-3],[-4,0],[-4,2],[-19,21],[-4,7],[-2,3],[-3,2],[-3,-1],[-3,-3],[-3,-4],[-2,-4],[0,-3],[2,-2],[3,-4],[2,-2],[1,-4],[1,-3],[1,-3],[2,-2],[0,-2],[-6,2],[-8,5],[-7,3],[-6,-5],[-2,0],[5,-12],[9,-8],[27,-10],[7,1],[7,-1],[7,-7],[3,3],[3,-2],[2,-4],[2,-6],[-13,5],[-5,-2],[1,-12],[-10,-4],[-1,-3],[1,-3],[10,-10],[2,-5],[1,-5],[-1,-5],[-3,-2],[-1,-1],[1,-2],[2,-4],[2,-2],[2,-2],[4,-1],[-2,12],[3,0],[9,-9],[0,-3],[-3,0],[0,-2],[1,-1],[1,0],[2,-2],[-3,-2],[-8,-1],[-5,-2],[-2,0],[0,2],[-2,2],[-1,2],[-3,2],[-2,0],[-1,-4],[-1,-5],[1,-5],[1,-3],[-1,-4],[-1,-3],[-2,-2],[-2,0],[-7,3],[-2,-1],[-2,-2],[-1,-2],[10,-4],[8,-6],[-4,-7],[-4,-1],[-10,3],[-10,6],[-5,0],[1,-9],[-1,-3],[8,-4],[3,-3],[-2,-5],[5,-3],[11,2],[5,-5],[-3,-2],[-4,0],[-4,2],[-3,0],[-18,-3],[-3,-3],[-2,-4],[-1,-7],[1,-6],[1,-5],[-1,-2],[-4,2],[0,1],[1,5],[-7,-1],[-3,-3],[-2,-5],[0,-8],[-4,-1],[-3,4],[0,5],[-4,8],[-4,10],[-4,8],[-6,3],[6,-15],[1,-7],[-2,-3],[-3,1],[-4,2],[-3,3],[-6,11],[-14,12],[-6,10],[2,6],[-2,3],[-5,0],[-2,-1],[-2,-4],[-2,-10],[1,-2],[-2,-5],[-4,-16],[1,-7],[-2,-4],[-2,0],[-2,7],[-6,10],[0,1],[1,2],[0,1],[1,2],[-14,5],[-5,0],[4,-12],[-3,-2],[-11,9],[-13,2],[-6,5],[-3,8],[-2,5],[-2,-1],[-3,-3],[-1,-2],[-1,-5],[0,-6],[1,-4],[7,-6],[7,-16],[5,-6],[-1,-4],[0,-2],[3,-4],[2,-6],[-1,-5],[-4,-2],[-19,9],[-4,-2],[1,-7],[0,-3],[4,-5],[2,-4],[6,-18],[1,-3],[2,-1],[7,-1],[3,-2],[0,-3],[4,0],[14,-3],[-2,-2],[-4,-6],[-3,-1],[-5,0],[-2,0],[-2,-3],[17,-8],[2,-9],[14,-17],[4,-3],[5,0],[5,-3],[3,-6],[-1,-11],[10,0],[4,-4],[2,-9],[-1,-2],[0,-2],[-1,0],[-1,-1],[0,-3],[1,-5],[1,-4],[1,-7],[0,-3],[1,-7],[2,-20],[2,-7],[-9,-13],[-3,-8],[5,-3],[6,-1],[27,-16],[2,-4],[2,-5],[1,-2],[0,-8],[1,-3],[1,-1],[0,-2],[-2,-4],[-2,-2],[-5,-1],[-2,-2],[-2,6],[-3,3],[-4,-1],[-3,-3],[-2,-3],[0,-3],[-1,-2],[-3,0],[-2,1],[-1,3],[1,4],[1,3],[0,3],[-10,5],[-2,2],[-1,5],[-3,-1],[-4,-5],[-3,1],[-4,4],[-2,0],[-2,-1],[-4,-4],[-2,0],[1,3],[-6,2],[-6,-4],[-15,-20],[-6,-3],[-18,-6],[-42,8],[1,1],[2,4],[-5,3],[-18,-8],[-7,0],[-3,-2],[-3,-8],[-4,-10],[0,-7],[2,-3],[4,-2],[11,0],[3,-3],[-1,-7],[-1,-4],[0,-3],[9,-13],[2,-2],[49,-12],[4,-3],[2,-5],[4,-13],[3,-5],[3,-3],[4,1],[4,4],[2,8],[-3,3],[-4,5],[2,5],[4,6],[2,4],[1,-3],[4,3],[20,0],[0,-1],[2,-4],[1,-1],[2,1],[1,1],[1,1],[1,0],[3,-4],[2,-3],[1,-4],[14,-5],[5,-6],[2,-8],[1,-8],[0,-4],[-6,-3],[-3,-3],[-3,-5],[-2,-5],[-3,-3],[1,-5],[6,-9],[-3,-5],[-4,-1],[-3,3],[-8,9],[-3,0],[-2,-6],[3,-2],[1,-1],[-4,-4],[-16,-4],[6,-6],[8,-2],[7,0],[6,5],[6,-6],[3,-3],[0,-6],[0,-3],[2,-5],[1,-2],[2,-1],[0,-3],[-3,-4],[2,-5],[6,-8],[0,-3],[-5,-3],[-4,-6],[0,-6],[5,-3],[0,-2],[-1,-1],[-2,-2],[3,-2],[1,-8],[2,-2],[6,0],[2,-2],[1,-6],[-2,-13],[-6,-5],[-13,0],[1,5],[1,2],[1,2],[-4,3],[-5,0],[-4,-5],[1,-10],[-49,11],[-14,8],[-9,11],[-29,10],[-6,4],[-4,7],[-4,10],[-1,2],[-1,7],[-1,2],[-1,3],[-2,2],[-2,1],[-3,0],[-2,-1],[-1,-1],[1,-3],[0,-5],[-2,-7],[-6,-4],[-10,-5],[-4,-3],[-1,-2],[0,-5],[2,-3],[1,-3],[2,-2],[2,-2],[3,1],[4,4],[2,1],[10,0],[4,-2],[8,-8],[9,-3],[15,-16],[4,-2],[41,-8],[10,-6],[4,-1],[6,-26],[-7,0],[2,-6],[4,-4],[4,0],[4,1],[1,2],[1,1],[1,2],[3,1],[1,0],[1,-1],[2,0],[1,1],[-1,-3],[-1,-3],[-2,-5],[2,-10],[-1,-9],[-3,-6],[-5,-1],[-3,4],[-3,6],[-2,3],[-4,-4],[0,-3],[2,-3],[-2,0],[-2,0],[-2,1],[-2,2],[-1,2],[-3,6],[-1,3],[0,-4],[0,-3],[-1,-4],[-2,1],[-1,3],[0,2],[-1,4],[-6,11],[-1,-1],[-1,-4],[0,-2],[1,-3],[4,-8],[-6,-4],[-12,5],[-7,1],[3,-6],[3,-2],[7,0],[3,-2],[5,-11],[3,-4],[-3,-7],[-4,-2],[-5,1],[-4,2],[-3,4],[-13,29],[-3,5],[-8,9],[-3,1],[-1,-1],[0,-4],[1,-3],[0,-3],[-1,-3],[3,-3],[7,-4],[4,-4],[2,-5],[2,-8],[1,-7],[0,-3],[3,-2],[7,-8],[4,-2],[8,1],[3,-2],[3,-4],[-2,-3],[-3,-1],[-6,1],[-2,-1],[-6,-5],[-2,-1],[-7,1],[-1,1],[-1,5],[-2,12],[-1,2],[-3,4],[-11,17],[-6,11],[-8,11],[-4,8],[-2,2],[-3,1],[17,-35],[6,-16],[5,-7],[2,-4],[1,-6],[-25,22],[-7,12],[-9,19],[0,-3],[0,-9],[-1,-7],[-2,0],[0,-3],[-2,3],[-3,2],[-4,1],[-3,0],[2,0],[-1,-1],[0,-1],[2,0],[1,-1],[2,-4],[1,-1],[5,-2],[25,-18],[17,-23],[15,-11],[4,-5],[3,-8],[0,-3],[-3,2],[-7,10],[-3,3],[-27,12],[-2,2],[-1,4],[-2,5],[2,3],[-4,7],[-5,2],[-10,-1],[-5,3],[-22,33],[-6,15],[-2,3],[-3,0],[-4,-2],[0,-2],[0,-3],[1,-2],[1,-2],[-4,-7],[-19,-13],[-2,-4],[-1,-2],[0,-3],[1,-5],[6,-15],[1,-4],[4,-1],[24,-19],[0,-3],[0,-4],[-1,-3],[-2,0],[-14,8],[-3,-2],[0,-3],[4,-3],[3,-2],[2,-4],[-1,-1],[0,-2],[0,-2],[3,3],[11,3],[4,-1],[4,-3],[5,-7],[4,-7],[0,-6],[13,-9],[2,-5],[0,-8],[-2,-8],[-1,-7],[2,-9],[7,-3],[1,-2],[0,-5],[-2,-2],[-4,-2],[-9,-8],[-5,0],[-5,5],[-4,12],[-2,3],[-32,29],[-15,5],[-18,11],[3,-7],[6,-6],[17,-11],[21,-24],[9,-6],[9,-12],[12,-18],[1,-4],[1,-4],[-21,3],[-8,9],[-5,3],[-4,-3],[8,-6],[1,-3],[-3,-3],[-4,0],[-13,6],[-3,3],[-2,7],[-2,7],[-1,3],[-7,3],[-5,0],[-2,-6],[2,0],[1,-2],[3,-3],[-3,-3],[-3,2],[-8,15],[-4,17],[-4,11],[-6,8],[-6,5],[-5,0],[2,-4],[2,-8],[2,-8],[1,-7],[0,-6],[-3,-3],[-4,-2],[-5,-3],[5,-5],[11,-2],[4,-2],[9,-10],[4,-7],[0,-8],[41,-3],[2,-2],[6,-8],[2,-2],[3,1],[4,1],[4,-1],[2,-7],[-2,-1],[0,-3],[1,-3],[1,-4],[-4,-10],[-7,-6],[-7,-1],[-6,6],[-2,5],[-1,-1],[-2,-10],[5,-12],[-1,0],[-1,-1],[-1,-1],[-1,1],[-2,1],[-2,-1],[-2,-1],[5,-5],[4,-4],[2,-3],[0,-2],[-8,-3],[-3,-2],[-4,-1],[-13,7],[-10,1],[0,2],[-1,4],[-1,4],[-2,2],[-2,-2],[1,-4],[2,-9],[-2,-19],[-7,-3],[-18,11],[-24,0],[-4,3],[-2,6],[1,8],[3,5],[4,3],[4,1],[3,0],[0,2],[-14,-1],[-2,4],[1,6],[4,6],[5,6],[3,2],[-4,3],[-5,-2],[-5,-4],[-4,-7],[-2,0],[-2,1],[-2,0],[-1,-4],[0,-6],[1,-3],[0,-3],[-1,-4],[-4,-3],[-5,0],[-5,2],[-3,3],[-5,3],[-4,-4],[-1,-6],[4,-6],[5,-2],[15,2],[5,-2],[1,-4],[-1,-5],[-8,-13],[-2,-3],[-2,1],[-2,2],[-1,4],[-1,4],[-1,3],[-1,2],[-1,3],[-2,2],[-2,1],[-2,-2],[0,-3],[13,-38],[2,-12],[-3,2],[-2,3],[-1,5],[-2,4],[-2,3],[-3,2],[-2,2],[0,4],[-2,3],[-2,0],[-2,-2],[0,-5],[1,-6],[2,-4],[6,-5],[-3,-6],[-4,-4],[-4,-2],[-4,0],[1,4],[1,6],[0,5],[-1,2],[-2,2],[-4,17],[-2,3],[-2,1],[-2,-3],[-1,-6],[1,-3],[5,-16],[-3,-9],[-5,0],[-10,6],[-16,1],[-22,7],[-4,4],[-3,6],[-5,5],[-4,2],[-3,-3]],[[7342,4759],[3,1],[22,9],[22,8],[42,16],[42,15],[51,19],[51,18],[8,13],[8,13],[3,14],[4,13],[1,7],[1,2]],[[7600,4907],[3,-1],[8,0],[15,5],[34,-5],[13,-7],[11,-13],[11,-17],[5,-6],[6,-3],[10,1],[3,-1],[1,-3],[1,-3],[1,-4],[2,-1],[-1,-7],[0,-22],[-2,-5],[-12,-16],[-2,-8],[-5,0],[-26,19],[-7,1],[-5,-3],[7,-9],[23,-17],[2,-3],[-3,-8],[-13,-5],[-4,-5],[-3,-4],[-10,-3],[-10,-8],[-11,-3],[-3,-3],[-4,-4],[-4,-7],[-3,-3],[-3,-1],[-12,0],[-12,-6],[-10,0],[-4,-1],[-1,-3],[-4,-9],[-2,-3],[-6,0],[-3,-2],[-5,-7],[-7,-4],[-65,-17],[-53,6],[-16,-6],[-41,3],[-2,6],[-5,16],[-4,7],[-27,39],[-2,4],[-1,6],[-1,4],[0,1]],[[7727,4888],[4,3],[1,1],[0,1],[1,0],[0,1],[0,1],[1,0],[1,-2],[1,-2],[1,-1],[2,-1],[2,0],[2,-1],[2,0],[2,0],[1,0],[2,-1],[1,0],[2,0],[2,0],[1,0],[2,-1],[1,0],[2,-1],[1,-1],[2,-1],[1,-1],[2,-1],[1,-1],[1,0],[0,-1],[2,0],[1,0],[1,0],[1,0],[1,0],[2,0],[0,1],[1,1],[1,0],[1,-1],[0,-1],[1,0],[0,-1],[1,-1],[1,0],[1,0],[1,-1],[1,0],[1,0],[3,-1],[2,0],[1,-1],[2,-1],[1,0],[1,-1],[2,-1],[2,-1],[1,-2],[2,-1],[2,-1],[2,-2],[2,-1],[2,-1],[1,0],[1,0],[0,1],[1,0],[0,1],[1,0],[1,0],[2,-1],[1,0],[2,0],[1,0],[2,0],[2,0],[2,-1],[2,0],[0,1],[1,0],[0,1],[1,0],[0,1],[1,1],[0,1],[0,1],[0,2],[-1,2],[0,1],[0,1],[-1,1],[0,1],[-1,2],[0,1],[0,1],[0,1],[-1,0],[0,1],[0,1],[0,1],[0,1],[0,1],[0,1],[-1,0],[0,1],[0,1],[-1,0],[0,1],[-1,0],[0,1],[0,1],[0,1],[0,1],[1,1],[0,1],[0,1],[1,0],[1,-1],[1,-1],[1,-2],[2,-2],[2,-3],[3,-4],[3,-5],[1,-1],[1,-2],[1,0],[1,0],[0,-1],[1,0],[0,1],[1,0],[1,0],[0,1],[0,1],[1,0],[0,1],[1,1],[1,1],[1,0],[1,1],[0,-1],[0,-1],[1,-1],[1,0],[1,0],[0,1],[1,0],[1,0],[0,1],[0,1],[0,1],[1,0],[0,1],[1,0],[0,1],[1,0],[0,1],[1,0],[1,1],[-1,0],[-1,0],[0,1],[0,1],[-1,0],[0,1],[1,0],[1,1],[-1,0],[0,1],[1,0],[0,1],[0,1],[1,1],[0,1],[0,1],[1,0],[0,1],[0,1],[0,1],[1,0],[0,1],[-1,1],[0,1],[1,0],[-1,0],[0,1],[0,1],[1,1],[0,1],[-1,0],[1,0],[-1,1],[0,1],[1,0],[-1,1],[0,1],[0,1],[0,1],[0,1],[1,0],[0,1],[-1,1],[1,0],[0,1],[-1,0],[0,1],[1,1],[0,1],[0,1],[0,1],[0,1],[0,1],[0,1],[0,1],[1,0],[0,1],[0,1],[0,1],[0,-1],[1,0],[0,1],[0,1],[-1,0],[1,1],[0,1],[0,1],[0,1],[0,1],[0,2],[-1,1],[0,1],[0,1],[0,1],[0,1],[-1,0],[1,0],[0,1],[1,0],[-1,0],[0,1],[0,1],[0,2],[0,1],[0,1],[0,1],[-1,0],[0,1],[0,1],[0,1],[0,1],[-1,0],[0,1],[0,1],[-1,0],[-1,1],[0,1],[-1,0],[-1,0],[0,1],[-1,0],[-1,0],[0,1],[-1,0],[-1,1],[-1,0],[0,1],[-1,0],[-1,1],[-1,0],[-1,0],[-1,0],[0,1],[-1,0],[0,1],[1,0],[1,0],[1,0],[1,0],[1,0],[1,0],[1,1],[1,0],[1,0],[1,0],[0,-1],[1,0],[1,0],[1,0],[1,0],[1,0],[1,-1],[1,0],[1,0],[0,-1],[1,0],[1,0],[0,-1],[1,0],[0,-1],[1,0],[0,-1],[1,0],[1,1],[1,0],[0,1],[0,1],[-1,0],[0,1],[0,1],[1,0],[0,1],[0,1],[0,1],[0,1],[0,1],[0,1],[0,1],[-1,0],[0,1],[0,1],[0,1],[-1,0],[1,0],[0,1],[0,1],[-1,0],[0,1],[0,1],[0,1],[-1,0],[0,1],[0,1],[0,1],[0,1],[0,1],[0,1],[0,1],[0,1],[0,1],[0,1],[0,1],[0,1],[-1,0],[0,1],[0,1],[0,1],[0,1],[-1,0],[-1,0],[-1,0],[-1,0],[1,1],[1,0],[1,0],[1,0],[0,1],[0,1],[0,1],[1,0],[-1,0],[0,1],[0,1],[1,0],[0,-1],[1,0],[2,0],[2,0],[1,0],[1,1],[0,1],[0,1],[1,0],[0,1],[0,1],[-1,0],[0,1],[1,1],[-1,1],[-1,1],[-1,0],[-1,0],[-1,0],[1,1],[1,1],[0,1],[0,1],[0,1],[1,1],[0,1],[-1,0],[1,1],[0,1],[0,1],[0,1],[0,1],[0,1],[0,1],[0,1],[0,1],[0,1],[0,1],[0,1],[1,0],[0,1],[-1,0],[0,1],[0,1],[1,1],[0,1],[0,1],[0,1],[1,0],[1,-1],[1,0],[0,1],[1,0],[-1,0],[-1,0],[0,1],[0,1],[1,1],[0,-1],[1,0],[0,1],[1,0],[-1,0],[0,1],[1,0],[0,1],[-1,0],[0,1],[0,1],[0,1],[0,-1],[1,0],[0,-1],[0,1],[0,-1],[1,0],[0,-1],[1,0],[1,0],[1,0],[0,1],[-1,0],[0,1],[1,0],[0,1],[1,1],[0,1],[1,0],[0,1],[1,1],[0,1],[1,0],[0,1],[1,0],[0,1],[1,1],[1,0],[0,1],[1,0],[0,1],[0,1],[1,0],[0,1],[1,0],[3,0],[3,-1],[9,-1],[8,-2],[3,0],[3,0],[6,-1],[5,-1],[15,8],[15,8],[30,4],[30,4],[9,7],[8,7],[10,0],[11,0],[14,-6],[14,-7],[10,7],[11,7],[9,3],[9,4],[18,-7],[18,-6],[12,-1],[12,0]],[[8193,5082],[2,-4],[0,-5],[-2,-3],[-4,-3],[-20,-6],[-10,-6],[-2,-11],[-7,-12],[-29,-18],[-16,-15],[-8,-11],[-4,-13],[1,-3],[1,-7],[6,0],[12,4],[3,3],[7,7],[6,3],[5,9],[2,1],[7,2],[41,28],[7,2],[12,9],[6,1],[2,-10],[-3,-8],[-6,-7],[-6,-6],[-6,-3],[-1,-6],[-2,-2],[-1,-1],[-4,-1],[-9,-6],[-2,-3],[0,-8],[3,-17],[-1,-8],[1,-4],[3,-3],[3,0],[3,5],[0,5],[0,3],[-2,1],[-1,0],[0,2],[3,1],[5,3],[7,7],[4,1],[9,-6],[5,0],[0,2],[0,1],[-1,2],[0,1],[3,7],[6,5],[4,5],[2,7],[0,4],[0,3],[0,6],[2,3],[13,9],[5,1],[4,-1],[3,-6],[-3,-9],[3,-2],[40,11],[-2,-3],[-1,-3],[-5,-2],[0,-5],[-4,-3],[-9,-1],[5,-6],[-3,-6],[-11,-1],[-18,-10],[-4,-5],[10,-6],[7,-1],[2,-3],[-8,-9],[-21,2],[-9,-2],[-4,-2],[-11,0],[-4,-2],[-7,-10],[-2,-2],[-1,-3],[-3,-20],[-1,-5],[0,-5],[1,-4],[5,-16],[1,-6],[0,-7],[0,-4],[-1,-1],[0,-2],[0,-5],[1,-3],[5,-5],[2,-3],[-2,-6],[-1,-3],[0,-9],[0,1],[1,-2],[1,-3],[-1,-1],[-1,-1],[0,-3],[-1,-5],[6,-3],[7,0],[6,5],[3,14],[1,7],[0,4],[-2,2],[-2,1],[0,3],[1,6],[7,24],[4,7],[24,25],[5,3],[8,0],[8,-3],[4,-4],[3,-4],[3,-3],[4,2],[-1,4],[-2,3],[-1,3],[-2,2],[9,-3],[3,1],[-2,10],[4,-1],[5,-10],[3,0],[2,2],[0,4],[1,4],[3,1],[1,-1],[2,-3],[1,-3],[1,-4],[-4,-6],[-11,-6],[-5,-6],[6,-3],[14,4],[6,-3],[-4,-3],[-9,-3],[-4,0],[0,-3],[20,-2],[5,-6],[-4,-2],[-8,-6],[-12,-3],[-4,-3],[-2,-3],[-1,-5],[2,-1],[3,1],[2,3],[4,2],[12,0],[-2,-4],[-5,-3],[-4,-6],[-2,-2],[-4,-3],[4,0],[11,6],[20,0],[0,-3],[-58,-23],[3,-3],[6,-1],[3,-2],[0,-3],[-1,0],[-3,-2],[4,-3],[4,1],[4,5],[4,6],[3,2],[5,-2],[4,-5],[3,-4],[-3,-3],[-2,0],[0,-3],[4,-1],[4,-4],[7,-13],[-3,-6],[-2,-9],[-4,-6],[-5,3],[-7,15],[-3,6],[-6,0],[1,-5],[2,-6],[1,-4],[-2,-5],[5,0],[14,-11],[-6,-4],[-60,-14],[-6,-4],[-28,-4],[6,-7],[53,10],[13,-4],[3,4],[-1,3],[4,1],[7,4],[4,0],[9,0],[5,-3],[4,-5],[-1,-4],[0,-6],[0,-5],[3,-3],[-3,-2],[-11,-6],[-4,-3],[-10,-1],[-9,-6],[-17,-2],[0,-3],[13,-2],[31,12],[4,-4],[-11,-9],[-5,-7],[1,-7],[9,12],[6,3],[5,-3],[-6,-6],[6,-2],[11,12],[4,-4],[-6,-11],[-17,-17],[-7,-10],[2,-3],[5,-7],[2,-1],[0,-1],[-1,-3],[-2,-5],[-2,-6],[-2,-1],[-13,-1],[-3,1],[-7,5],[-2,0],[-1,0],[-1,0],[-3,0],[3,-7],[5,-5],[5,-2],[5,-1],[6,1],[19,9],[2,1],[2,-1],[1,-3],[0,-6],[-1,-2],[-4,-2],[-8,-7],[-3,-1],[-5,0],[-3,-2],[-1,-4],[3,0],[4,2],[4,1],[3,-3],[6,4],[8,-1],[7,-6],[5,-9],[-36,0],[0,-2],[3,-3],[19,-2],[4,-3],[4,-4],[-3,-3],[-3,-1],[-6,1],[1,-4],[1,-3],[3,-4],[-4,-3],[-18,0],[2,-2],[0,-2],[1,-5],[-4,-3],[-1,-7],[2,-5],[5,1],[8,7],[4,1],[5,-2],[0,-4],[-8,-5],[3,-4],[14,-2],[3,-5],[1,-1],[4,4],[3,0],[2,-1],[2,-3],[-10,-20],[-3,-4],[-7,-7],[-6,-10],[-5,-4],[-4,-3],[-10,-1],[-2,1],[-4,3],[-1,2],[-7,-4],[-16,-17],[-9,3],[-1,5],[2,7],[5,9],[2,6],[0,3],[-1,2],[-12,10],[-8,1],[-9,-3],[-25,-20],[-9,-3],[-7,4],[-3,7],[-3,13],[0,16],[2,13],[-2,3],[2,3],[-5,25],[-2,3],[-3,5],[-1,3],[0,2],[1,2],[1,15],[3,24],[0,7],[1,4],[1,7],[1,8],[-1,7],[-3,3],[-5,1],[-5,-2],[-3,-2],[-7,-9],[-1,-3],[-1,-5],[0,-3],[-3,-7],[-1,-5],[1,-5],[3,-6],[-2,-3],[-8,-6],[1,-3],[-1,-4],[0,-2],[0,-2],[1,-2],[1,-3],[-1,-3],[-1,-3],[0,-2],[1,-6],[3,-5],[5,-7],[2,-4],[1,-6],[1,-6],[0,-5],[0,-6],[-2,-4],[0,-5],[0,-5],[-1,-6],[-2,-15],[-2,-6],[-4,-6],[-4,-3],[-58,1],[-13,-6],[-40,6],[-55,43],[-10,4],[-10,7],[-20,18],[-15,19],[-7,13],[-2,11],[-1,0],[-1,1],[-1,3],[-1,3],[-2,8],[-8,15],[-3,8],[-4,23],[-1,16],[-1,6],[-1,8],[0,10],[4,17],[1,6],[-3,7],[-1,3],[-1,4],[-1,3],[-1,3],[-4,9],[-27,35],[-13,11],[-10,12],[-2,4],[0,6],[2,9],[-5,3],[-6,-1],[-5,1],[-2,7],[1,6],[10,16],[-4,9],[-5,-2],[-6,-6],[-6,-4],[-9,0],[-1,-1],[-2,-5],[-2,-3],[-3,-2],[-3,-1],[-4,1],[-3,2],[0,2],[-3,1],[-6,0],[-3,-1],[-5,-4],[-3,-1],[-10,0],[-4,3],[-8,15],[-11,6],[-4,5],[-5,11],[-2,3],[-6,7],[-1,4],[-5,5],[-2,1]],[[4758,46],[8,-8],[3,-6],[-1,-6],[-2,-1],[-2,2],[-1,3],[-2,2],[-1,-2],[-5,-10],[-1,1],[-1,1],[-1,1],[-1,-1],[-1,-2],[0,-5],[-2,-2],[-2,-2],[-2,-1],[-2,5],[1,5],[0,1],[-1,2],[4,6],[2,7],[0,5],[-3,-1],[-3,-4],[-3,-6],[-2,-8],[1,-7],[-3,-7],[-4,-5],[-4,-3],[-3,1],[-3,6],[1,7],[4,19],[0,2],[1,2],[-1,3],[-2,4],[-1,-3],[0,-4],[-1,-4],[-3,-3],[-3,-3],[-2,-3],[1,-7],[-6,-6],[-7,-5],[-7,0],[-4,11],[1,4],[0,7],[1,4],[0,3],[6,13],[7,11],[3,6],[8,13],[8,-3],[8,-9],[8,-5],[5,-2],[4,-3],[8,-10]],[[4627,69],[-5,-5],[-5,1],[-3,7],[1,6],[5,3],[5,1],[2,-4],[0,-9]],[[4835,80],[4,-5],[-2,0],[-2,0],[-2,-1],[-2,-2],[6,-6],[-3,-3],[-5,1],[-3,-2],[-2,-5],[0,4],[-2,5],[1,3],[-1,2],[-1,1],[-1,-1],[-1,-3],[0,-6],[-1,-5],[-1,-4],[-2,-2],[-3,1],[0,2],[1,1],[1,3],[5,27],[2,4],[5,-1],[5,-3],[4,-5]],[[4709,83],[-10,-15],[-3,-2],[-2,-2],[-5,-13],[-3,-5],[-2,5],[0,5],[2,16],[0,9],[-1,0],[-1,-7],[0,-8],[-4,-16],[-1,-4],[-2,-2],[-7,-2],[-5,-6],[-3,-1],[-7,-1],[-2,2],[-7,13],[4,4],[4,5],[6,14],[6,7],[1,3],[1,6],[2,4],[2,1],[2,3],[4,3],[28,-4],[5,-4],[-2,-8]],[[4812,70],[-3,-9],[-4,-3],[-2,1],[-1,4],[-1,4],[-1,2],[-2,-2],[-2,-4],[-1,-6],[1,-5],[-3,-2],[-4,-1],[1,3],[1,5],[3,15],[-2,3],[2,5],[1,9],[1,9],[4,6],[6,-2],[6,-5],[4,-7],[-5,-7],[3,-5],[-2,-8]],[[4672,127],[3,-12],[1,-4],[1,-2],[1,-2],[-2,-5],[-1,-2],[-7,-2],[-6,-9],[0,-2],[-1,-3],[0,-4],[-2,-2],[-2,1],[-1,3],[-1,4],[0,4],[1,2],[3,7],[1,5],[-5,-3],[-4,-8],[-1,-9],[4,-4],[-3,-7],[-5,-6],[-5,2],[-1,11],[1,4],[2,9],[1,13],[1,5],[4,10],[-5,-2],[-2,-9],[-2,-11],[-3,-9],[-3,-2],[-2,0],[-2,4],[0,6],[2,5],[3,7],[1,6],[0,11],[1,10],[2,8],[3,5],[6,0],[8,-4],[7,-5],[4,-6],[3,-3],[2,-5]],[[4709,107],[-4,-3],[-17,0],[-2,3],[-2,4],[-4,15],[-1,4],[-2,2],[-1,1],[-5,6],[-1,2],[1,8],[2,8],[4,3],[2,-5],[2,-2],[2,-4],[0,-6],[-1,-5],[2,-6],[3,-5],[6,-9],[4,-4],[8,-4],[4,-3]],[[4772,139],[73,-21],[3,-1],[3,-2],[0,-3],[-2,-2],[-1,-2],[-1,-1],[3,-7],[-3,-8],[-5,-7],[-5,-2],[-3,2],[-1,3],[-2,4],[-2,3],[-3,2],[-5,1],[-3,3],[-1,3],[0,3],[-1,3],[-2,2],[-1,-1],[-1,-4],[-1,-3],[-1,1],[-2,2],[-4,2],[-13,11],[-6,3],[-6,-2],[0,-3],[8,-2],[5,-3],[3,-4],[0,-6],[-2,-7],[-1,-7],[-1,-3],[-3,-3],[0,-12],[-3,-2],[-2,-3],[-1,-5],[-1,-5],[-4,-1],[-2,1],[-2,1],[-2,2],[-1,3],[-1,3],[0,2],[0,2],[-1,7],[0,3],[-1,3],[-1,3],[-2,1],[-1,0],[-1,-2],[-1,-5],[1,-6],[-1,-4],[-1,-2],[-4,-1],[-8,2],[-4,3],[-4,4],[-4,1],[-9,8],[-3,5],[6,8],[3,2],[14,8],[1,0],[7,6],[-11,0],[-5,-4],[-5,3],[-3,0],[-6,-5],[-3,0],[-2,0],[-2,2],[-2,3],[-2,4],[-2,3],[-5,2],[-11,8],[-4,5],[1,7],[-4,6],[2,6],[3,6],[5,2],[73,-22]],[[4506,145],[-4,-1],[-3,3],[2,9],[4,8],[4,2],[3,-8],[0,-2],[0,-1],[0,-3],[0,-2],[-6,-5]],[[4502,249],[6,-11],[3,9],[4,4],[4,-1],[5,-3],[2,-9],[-1,-7],[-5,-13],[-1,-14],[0,-3],[-2,-1],[-5,-6],[-7,-5],[-8,-16],[-4,-4],[-10,-2],[-1,2],[4,9],[-1,6],[0,7],[3,13],[1,6],[1,6],[1,28],[1,6],[2,3],[4,-1],[4,-3]],[[4542,250],[-3,-3],[-6,0],[-3,3],[-3,6],[0,13],[6,6],[15,1],[0,-2],[0,-1],[-1,-3],[-3,-14],[-2,-6]],[[4538,221],[-5,-3],[-4,0],[3,3],[2,4],[1,5],[0,6],[4,2],[5,4],[4,7],[1,11],[1,10],[3,6],[3,1],[4,-7],[0,-1],[-1,-1],[0,-2],[0,-1],[-1,-5],[-2,-4],[-3,-7],[-4,-12],[-2,-4],[-9,-12]],[[4484,266],[-2,-1],[-3,1],[-2,2],[1,3],[3,2],[2,3],[1,8],[2,3],[3,2],[1,-2],[1,-8],[-1,-4],[-3,-1],[-3,-4],[0,-4]],[[4420,361],[-3,-4],[-3,-2],[-2,3],[-2,0],[-10,-7],[-6,-3],[-4,0],[-2,6],[2,14],[0,4],[4,1],[23,-4],[4,-4],[-1,-4]],[[4379,364],[-3,-5],[-4,-2],[-2,-1],[-2,1],[-2,1],[-1,4],[-1,0],[-2,0],[-3,-3],[-1,0],[-4,9],[-1,3],[5,5],[43,6],[1,-1],[2,-1],[-13,-1],[-3,-1],[-3,-3],[-6,-11]],[[4294,398],[-11,-3],[-1,2],[2,6],[4,6],[6,3],[6,-2],[4,-7],[-5,0],[-2,-4],[-3,-1]],[[4335,396],[-7,-7],[-6,2],[-4,-3],[3,-2],[9,-10],[0,-8],[-16,3],[-1,1],[-1,2],[-1,4],[0,2],[-2,1],[-4,1],[6,13],[12,12],[12,8],[6,-4],[2,-1],[1,-2],[1,-2],[1,-3],[-11,-7]],[[4173,423],[2,-1],[3,1],[2,0],[8,-6],[-3,-8],[-7,2],[-12,8],[1,4],[2,2],[4,3],[0,-5]],[[4226,413],[-2,-2],[-2,2],[-4,7],[-2,3],[1,4],[2,1],[3,0],[2,-3],[2,-4],[1,-5],[-1,-3]],[[4198,424],[-4,-2],[-3,1],[-3,5],[1,5],[4,1],[4,-3],[3,-3],[-2,-4]],[[4327,416],[-6,-1],[-4,8],[11,10],[5,1],[1,0],[1,-1],[2,-2],[-4,-9],[-6,-6]],[[4076,431],[2,-8],[3,1],[3,5],[3,2],[12,-3],[2,-3],[-1,-4],[-2,-3],[-3,-4],[2,-2],[1,-1],[1,0],[0,-3],[-5,1],[-2,0],[-2,-2],[0,-5],[3,-2],[6,-2],[2,-3],[2,3],[2,4],[2,3],[3,1],[8,-1],[-5,-7],[-5,-5],[-6,-4],[-9,-1],[-2,-2],[-3,-2],[-4,-6],[-3,-3],[-3,-2],[-2,1],[1,5],[1,4],[2,2],[3,0],[-4,8],[-4,-3],[-5,-7],[-3,-3],[-11,-1],[-5,2],[-1,7],[-2,0],[-2,0],[-2,1],[-3,2],[2,3],[1,2],[1,1],[2,0],[-1,3],[-1,1],[-1,1],[-1,2],[-1,2],[-2,-2],[-1,-3],[-1,-2],[-3,1],[0,2],[0,4],[-1,5],[-2,4],[-8,8],[2,2],[3,1],[6,-1],[25,7],[5,6],[2,2],[6,-2],[3,-3],[0,-4]],[[4210,438],[-5,-4],[-7,1],[-5,5],[3,4],[12,7],[2,0],[0,-13]],[[4188,444],[-4,-3],[-1,3],[1,7],[3,5],[4,1],[4,-3],[-2,-4],[-5,-6]],[[4930,457],[-7,-5],[-13,-4],[-23,6],[-7,0],[2,1],[3,5],[3,1],[9,4],[12,0],[24,-2],[-3,-6]],[[4200,457],[-4,0],[3,6],[4,3],[3,4],[0,7],[7,0],[-3,-6],[-2,-7],[-4,-4],[-4,-3]],[[4219,466],[-3,-3],[2,7],[4,5],[5,4],[3,-2],[0,-2],[0,-1],[-1,0],[-3,-5],[-7,-3]],[[4358,465],[-21,-20],[-6,-2],[-8,5],[-2,-1],[0,-3],[-1,-2],[-1,-1],[-1,-2],[-2,-5],[-3,-5],[-2,-2],[-3,-2],[-6,1],[-3,-1],[-3,-4],[-2,-3],[-3,-1],[-6,0],[-2,0],[-1,2],[-1,1],[-2,-1],[-1,-1],[0,-1],[0,-2],[1,-1],[-6,-6],[-10,-5],[-8,0],[-6,8],[26,23],[22,11],[11,15],[46,26],[-3,-5],[1,-2],[4,-1],[3,-2],[1,-7],[-2,-4]],[[4313,475],[-6,0],[-4,5],[1,6],[-1,6],[-3,11],[4,3],[5,-2],[8,-7],[-1,0],[0,-2],[-1,-1],[2,-14],[-4,-5]],[[4963,697],[-4,-7],[-4,6],[2,5],[5,9],[6,5],[3,-5],[-4,-3],[-4,-10]],[[5008,840],[2,-1],[3,1],[2,-2],[1,-5],[-3,-2],[-5,0],[-16,-9],[-4,3],[2,1],[5,5],[11,20],[-1,3],[1,1],[2,4],[0,7],[4,5],[5,3],[4,0],[-2,-6],[1,-6],[0,-6],[-1,-4],[-3,-3],[-9,-4],[1,-5]],[[4990,1164],[7,-7],[12,12],[6,-8],[-3,-7],[0,-7],[0,-6],[3,-6],[-4,0],[-4,-3],[-4,-2],[-4,2],[1,3],[-2,3],[-6,2],[-3,4],[-1,4],[-1,13],[-1,6],[2,2],[2,1],[2,-1],[2,-5],[-4,0]],[[4848,1244],[1,-4],[6,-10],[-4,-6],[2,-4],[5,-3],[36,-8],[17,-13],[4,-1],[1,-1],[1,-3],[0,-3],[-1,-1],[0,-1],[1,-2],[2,-3],[4,-5],[2,-3],[0,3],[0,5],[0,3],[3,0],[7,6],[4,-2],[22,-18],[8,-2],[3,-3],[3,-6],[4,-16],[3,-5],[0,-1],[-2,-5],[1,-4],[-3,-3],[-3,-3],[-3,-1],[-7,5],[-6,6],[-9,18],[-5,3],[0,-3],[7,-10],[3,-7],[2,-7],[-3,-1],[-3,1],[-3,2],[-3,2],[-1,-2],[1,-2],[2,-4],[2,-1],[4,0],[2,0],[9,-10],[4,-2],[2,-2],[2,-4],[2,-2],[3,3],[-1,1],[0,4],[3,2],[15,-2],[-1,-1],[-1,-4],[3,-4],[0,-4],[-2,-5],[-3,-5],[4,2],[14,1],[0,-3],[-10,-6],[-5,-2],[-3,4],[-10,2],[-13,7],[-3,4],[-5,3],[-1,2],[-2,5],[0,2],[-3,0],[-5,-3],[-2,0],[-3,2],[-7,12],[-4,2],[-4,0],[-4,2],[-3,4],[1,2],[1,4],[-7,5],[-3,0],[-3,-6],[-3,-1],[-11,11],[-13,1],[-4,3],[-2,1],[0,-6],[0,-8],[-1,-6],[2,-2],[3,1],[3,1],[3,0],[24,-19],[14,-16],[3,-2],[1,-3],[1,-3],[1,-6],[0,-2],[3,-5],[2,-3],[3,-1],[29,6],[2,-3],[8,-8],[3,-2],[11,-1],[-1,-7],[-2,-2],[-3,-2],[-3,-4],[-1,-5],[0,-2],[5,-1],[4,-6],[2,-8],[-1,-9],[-3,-9],[-6,-11],[-2,-3],[0,-5],[1,-2],[2,-1],[2,-4],[-2,-8],[-5,-3],[-7,-1],[-4,-2],[3,-5],[1,-1],[-2,-4],[-2,-4],[-2,-2],[-13,-3],[-3,-1],[4,-4],[10,-3],[3,-5],[-11,-11],[-10,-15],[8,-3],[10,10],[9,14],[8,8],[30,2],[5,-7],[-2,-7],[-7,-11],[-3,-14],[-3,-5],[-4,-1],[-25,3],[-5,-2],[2,-3],[10,-6],[19,-4],[0,-2],[-2,0],[-1,-1],[-1,-1],[0,-4],[10,0],[-1,-3],[-1,-5],[-3,-6],[-6,-7],[-1,-3],[-3,-8],[-3,-6],[-3,-4],[-4,-4],[-5,-3],[-30,-7],[-5,1],[-2,2],[-6,7],[-7,7],[-2,3],[-2,2],[-3,2],[-2,3],[-2,9],[-3,0],[-2,-1],[-10,-9],[-3,-6],[-1,-6],[2,0],[14,7],[24,-31],[4,-3],[29,-2],[5,2],[11,9],[6,1],[5,-7],[-21,-10],[-2,-2],[-1,-4],[1,-5],[1,-2],[5,0],[4,-4],[2,-5],[-1,-5],[-4,-3],[-4,0],[-8,7],[-5,1],[7,-4],[3,-3],[3,-4],[-15,3],[4,-12],[2,-8],[-1,-3],[-15,0],[-14,-6],[-4,1],[-7,4],[-30,2],[-13,11],[-8,4],[-8,1],[-6,-3],[19,-14],[3,-5],[3,-8],[12,5],[11,-6],[42,2],[-2,-16],[-1,-4],[3,-6],[1,-8],[2,-7],[5,-2],[2,1],[5,5],[2,0],[1,-2],[2,-10],[-2,-6],[-3,4],[-3,1],[-2,-1],[-2,-4],[0,-1],[-2,-7],[-1,-2],[-1,-1],[0,-1],[1,-2],[0,-3],[-5,-2],[-8,-1],[-2,-1],[-2,-2],[0,-2],[3,-1],[1,-2],[-2,-4],[-3,-2],[-10,0],[-3,-3],[2,-2],[2,-2],[3,-1],[2,0],[0,-4],[-12,0],[-24,19],[-12,2],[-6,-2],[-39,6],[-7,-4],[5,-5],[54,-9],[18,-12],[0,-3],[-5,-3],[-7,1],[-6,-2],[-3,-8],[18,1],[4,4],[3,5],[5,0],[9,-4],[1,0],[0,-1],[-1,-5],[3,0],[1,-3],[1,-4],[2,-1],[3,-1],[2,-2],[1,-4],[1,-5],[-25,0],[-1,-1],[-3,-4],[-1,-1],[-1,1],[-4,2],[-4,2],[-5,5],[-2,2],[-8,2],[-4,0],[-2,-4],[-2,-1],[-35,6],[0,-3],[5,0],[45,-15],[6,-6],[11,-7],[3,-1],[2,1],[3,2],[1,0],[2,-2],[0,-2],[0,-3],[1,-1],[9,-9],[0,-3],[-24,3],[-12,6],[-6,0],[-2,-5],[-3,-3],[-40,12],[-6,-4],[-3,2],[-12,-2],[-35,10],[-9,-1],[-6,-6],[5,-5],[11,3],[9,-4],[6,0],[3,-2],[2,-3],[3,-1],[33,3],[1,0],[1,-2],[0,-3],[1,-1],[8,0],[-1,3],[4,-4],[10,-1],[5,-4],[-2,-7],[-1,-2],[-2,-2],[4,0],[8,7],[4,1],[9,-1],[3,-2],[3,-5],[3,4],[6,3],[6,0],[4,-4],[-3,-2],[-3,-1],[-2,-1],[-2,-5],[3,-2],[7,1],[4,-2],[2,-3],[0,-3],[-1,-3],[-2,-2],[0,-3],[4,0],[1,0],[-6,-7],[-7,7],[-6,10],[-4,-1],[-1,-4],[0,-3],[1,-3],[1,-3],[1,-4],[-1,-4],[-1,-3],[0,-4],[1,-3],[11,-7],[-41,-14],[0,-3],[-8,-3],[-29,14],[-15,2],[-21,11],[-5,2],[-3,-1],[-1,-3],[1,-9],[0,-4],[2,0],[1,1],[2,1],[51,-15],[5,-8],[-2,0],[0,-1],[-1,-2],[-1,-2],[5,3],[6,1],[28,-5],[5,-5],[-1,-3],[2,-2],[2,0],[3,2],[2,0],[3,-1],[0,-4],[-2,-4],[-4,-2],[-16,-4],[-33,15],[-61,9],[-4,-3],[2,-3],[1,-2],[16,-1],[2,-1],[5,-4],[3,-1],[9,0],[2,-3],[1,-3],[0,-2],[0,-2],[0,-1],[2,-2],[2,-1],[2,1],[2,3],[4,3],[18,2],[19,-6],[2,-1],[5,-8],[12,-4],[5,-5],[3,0],[2,2],[1,-1],[3,-5],[-2,-3],[-9,-18],[-7,-9],[-9,-5],[-8,-1],[-12,7],[-35,5],[2,-7],[3,-2],[7,0],[48,-14],[0,3],[-3,3],[0,3],[4,3],[8,9],[4,3],[3,4],[2,0],[8,0],[-4,-5],[-8,-11],[-2,-5],[1,-9],[0,-3],[-10,-4],[-42,3],[0,-3],[6,-4],[21,1],[18,-6],[6,0],[-3,-5],[-3,0],[-4,2],[-3,1],[-3,-2],[-5,-8],[-3,-2],[-27,0],[3,-7],[5,-2],[11,0],[-3,-7],[-5,-2],[-5,1],[-10,9],[-3,4],[-1,6],[-1,1],[-5,-4],[-2,0],[-5,6],[-4,0],[-1,-5],[5,-9],[18,-12],[3,-8],[-13,-3],[-47,27],[-5,4],[-4,7],[-12,28],[-3,12],[0,9],[-1,5],[-1,9],[-2,5],[-4,-3],[0,-8],[2,-10],[2,-10],[10,-33],[1,-4],[-6,-3],[-3,1],[-5,4],[-61,12],[-4,5],[-6,14],[-4,5],[-4,-3],[1,-6],[4,-6],[1,-4],[-7,-2],[6,-10],[22,-2],[9,-4],[4,-4],[11,-3],[5,-3],[3,-5],[2,-7],[2,-7],[2,-7],[0,-2],[-5,-7],[-2,-2],[5,-3],[3,4],[1,8],[-2,11],[4,10],[7,1],[48,-17],[15,-11],[1,-2],[2,-2],[0,-5],[-1,-1],[-3,-1],[-20,-15],[-3,-6],[1,0],[1,-1],[2,-5],[-13,-8],[-5,-7],[-2,-2],[-2,-2],[0,-4],[1,-2],[2,1],[2,3],[2,2],[4,1],[12,13],[5,0],[6,-8],[5,-1],[-2,4],[-3,5],[-1,2],[-1,6],[0,1],[1,0],[4,6],[9,4],[22,0],[0,-2],[-2,-2],[-4,-1],[9,-9],[1,0],[0,-2],[-2,-2],[-1,-1],[-6,0],[-19,11],[-5,-3],[4,-10],[2,-1],[2,1],[2,1],[2,1],[19,-18],[2,6],[2,0],[6,-6],[-2,-6],[-3,-5],[-3,-2],[-4,-1],[11,-5],[3,-3],[-2,-7],[-2,-2],[-15,5],[-3,4],[-4,-6],[-9,-7],[-4,-5],[7,-2],[21,1],[5,-8],[-1,1],[-2,0],[-2,-1],[-1,-2],[6,-3],[3,0],[-2,-5],[0,-2],[-2,-2],[4,-3],[-5,-3],[-4,3],[-3,4],[-4,2],[0,-3],[2,-3],[0,-3],[-1,-3],[-2,-2],[3,-1],[4,-4],[2,-1],[2,1],[1,2],[1,1],[3,-1],[1,-3],[2,-5],[1,-4],[-2,-2],[-2,-1],[-2,-4],[-2,-1],[-4,0],[-14,6],[-10,0],[-4,3],[-4,5],[-4,-3],[-16,12],[-11,-1],[-6,2],[-2,6],[-1,4],[-1,5],[-1,5],[-1,2],[-3,0],[0,-3],[0,-7],[-3,-5],[-5,0],[-11,6],[-3,-3],[-4,-1],[-22,6],[-8,7],[-25,-3],[-2,-2],[-1,-2],[-1,1],[-1,8],[1,7],[2,5],[2,3],[24,32],[0,2],[-7,0],[-2,3],[-2,9],[0,3],[1,3],[0,3],[-1,4],[-2,4],[-2,2],[-2,0],[-1,-2],[3,-13],[1,-4],[0,-3],[-2,-5],[0,-5],[0,-1],[2,-2],[-1,-4],[-1,-4],[-3,-2],[-2,-1],[-2,-3],[-2,-4],[-1,-4],[-3,12],[-6,14],[-6,10],[-4,-1],[1,-7],[6,-15],[1,-5],[1,-8],[-1,-8],[-2,-3],[-11,6],[-2,0],[0,-6],[3,-5],[6,-7],[0,-2],[-5,-10],[-3,-5],[-3,-2],[-4,0],[-8,2],[-4,0],[-5,-4],[-4,-9],[-2,-12],[-1,-13],[-2,-11],[-6,-12],[-6,-9],[-6,0],[-5,6],[-2,6],[-1,8],[2,22],[0,8],[-4,-3],[-2,-4],[-2,-7],[0,-9],[0,-12],[0,-7],[-2,-3],[-5,-1],[-4,2],[-4,6],[-3,7],[-2,13],[-3,9],[-3,9],[-2,3],[1,4],[6,11],[-5,2],[-4,-4],[-3,-8],[-2,-9],[3,-9],[10,-18],[1,-9],[-4,7],[-12,-2],[-6,4],[2,5],[2,6],[-3,2],[-1,1],[0,3],[2,-1],[3,-2],[-1,4],[-3,3],[-8,6],[-3,1],[-2,-1],[0,-2],[-1,-2],[-2,0],[-3,4],[-2,1],[-2,-2],[0,-3],[1,-4],[3,-2],[-3,-4],[-4,0],[-7,7],[3,7],[14,13],[-3,5],[1,3],[4,2],[20,6],[4,3],[25,10],[-1,6],[-2,1],[-4,-2],[-2,-1],[-1,-3],[-2,-1],[-1,3],[0,2],[1,3],[2,9],[12,12],[1,2],[0,9],[1,6],[1,6],[2,4],[3,1],[11,14],[1,5],[2,10],[3,10],[4,6],[6,1],[-1,2],[0,1],[-1,2],[-1,1],[5,4],[2,3],[0,4],[2,3],[4,11],[-1,5],[0,5],[0,4],[1,4],[-10,-29],[-4,-2],[-4,-5],[-7,-16],[-4,-14],[-2,-8],[-3,-4],[-4,-2],[-5,-5],[-4,-8],[-3,-8],[-4,-12],[-2,-4],[-5,-1],[-3,-3],[-1,-8],[-1,-8],[-1,-7],[-3,-4],[-9,-7],[-3,-1],[-14,3],[-4,-3],[-5,-8],[-5,-11],[-5,-7],[-5,4],[1,5],[4,7],[3,5],[-4,-1],[-3,-3],[-1,1],[1,8],[2,7],[7,16],[2,4],[3,1],[3,8],[2,2],[2,1],[11,10],[8,3],[4,3],[-2,8],[0,8],[2,7],[3,7],[1,4],[1,8],[1,4],[1,4],[2,4],[5,7],[0,2],[-8,-4],[-8,-1],[-2,2],[2,6],[20,30],[1,4],[1,2],[2,2],[2,2],[1,5],[1,8],[1,5],[-2,14],[8,13],[16,19],[0,2],[-1,1],[-1,0],[-12,-6],[-2,-4],[-3,-9],[-10,-4],[-2,-5],[-2,-14],[-2,-16],[-3,-6],[-3,-7],[-20,-33],[-7,-8],[-16,-6],[-7,-6],[-4,-2],[-4,1],[-4,4],[-3,6],[2,3],[3,2],[0,4],[-3,3],[1,5],[3,4],[1,3],[1,7],[2,7],[2,6],[3,2],[4,5],[13,24],[3,8],[-5,-3],[-13,-14],[-4,5],[-2,1],[-2,-1],[-2,-2],[-1,-2],[5,-4],[0,-6],[-1,-7],[-2,-4],[-2,4],[-2,3],[-2,0],[-1,-5],[0,-1],[0,-3],[0,-3],[-1,-4],[-2,-1],[-4,-4],[-5,-3],[-7,-7],[-7,-3],[-10,-8],[2,6],[4,7],[4,5],[3,2],[3,4],[2,9],[1,9],[1,7],[8,11],[25,18],[6,10],[3,7],[-1,3],[-4,-2],[-11,-15],[-4,-3],[-11,0],[-2,4],[0,9],[-1,7],[-5,0],[-3,-7],[0,-8],[1,-9],[-1,-8],[-4,-4],[-5,-1],[-4,-3],[-2,-9],[0,-11],[-1,-3],[-1,-3],[-1,2],[0,4],[-1,3],[-2,-1],[-1,-1],[-1,-7],[0,-2],[0,-5],[0,-2],[-1,-2],[-1,-2],[-2,-5],[-3,-5],[-1,-3],[-1,-4],[0,-5],[0,-4],[-2,-1],[-2,1],[0,4],[0,5],[-1,4],[-1,2],[-1,5],[0,4],[4,1],[0,2],[-3,-1],[-6,-4],[-2,-1],[-3,2],[2,5],[6,9],[3,0],[2,1],[1,6],[-1,4],[-2,3],[-2,2],[-2,0],[1,-5],[0,-5],[-2,-3],[-9,-2],[-1,1],[-1,2],[-3,5],[-1,2],[0,2],[8,12],[5,3],[3,3],[1,5],[-9,-3],[-1,1],[0,-3],[-11,-1],[-3,-1],[-2,-3],[-2,-5],[-2,-7],[0,-4],[1,-4],[1,-6],[-1,-5],[-2,1],[-2,4],[0,2],[-3,-1],[-1,-2],[0,-4],[-1,-5],[-1,-7],[-1,-1],[-1,-1],[-2,3],[0,2],[1,4],[-1,5],[-3,8],[-3,3],[-6,0],[-3,1],[12,11],[3,4],[1,0],[7,5],[5,3],[7,8],[4,1],[6,2],[8,5],[7,6],[6,7],[-5,3],[-6,-4],[-6,-7],[-5,-3],[-12,0],[-6,3],[-6,6],[3,2],[6,-1],[3,1],[3,3],[5,9],[2,3],[24,11],[0,3],[-6,0],[-2,0],[0,3],[0,2],[0,1],[7,5],[1,1],[4,1],[2,5],[2,6],[3,5],[2,2],[6,1],[2,4],[4,10],[1,1],[3,2],[1,1],[2,3],[12,2],[7,-1],[1,3],[-1,5],[-3,5],[-3,2],[-3,-2],[-2,-3],[-3,-1],[-3,3],[4,5],[1,2],[1,4],[0,5],[0,5],[-1,2],[-3,3],[-3,5],[-4,3],[-4,-5],[1,-4],[1,-2],[2,-4],[1,-5],[0,-3],[-2,-1],[-2,-3],[-3,-4],[-6,-9],[-3,-2],[0,-9],[-3,-7],[-28,-34],[-3,-6],[-2,-3],[-3,-2],[-7,-1],[-7,-5],[-5,-1],[-4,3],[-4,7],[2,3],[9,9],[5,7],[3,3],[4,1],[-3,7],[-5,2],[-11,-1],[-1,0],[-2,-2],[-4,-5],[-2,-1],[-2,3],[1,0],[0,3],[-4,-2],[-4,-6],[-3,-8],[-1,-9],[0,-17],[-1,-4],[-3,-2],[-3,-1],[-2,-1],[-16,4],[-3,2],[-4,4],[-2,6],[0,8],[7,5],[18,2],[9,18],[19,14],[6,10],[-2,1],[-3,-1],[-12,-12],[-1,1],[-1,2],[-1,2],[0,1],[-2,0],[-1,1],[0,-1],[-2,-3],[-1,-2],[-1,-6],[-12,-15],[-2,3],[-2,-1],[0,-3],[-1,-2],[-5,-2],[-5,-1],[-1,2],[1,4],[2,4],[2,2],[2,1],[43,39],[61,22],[6,10],[1,2],[1,7],[1,2],[2,4],[1,3],[3,2],[2,0],[4,3],[8,11],[5,3],[1,0],[4,3],[1,1],[1,5],[0,5],[-1,4],[0,5],[3,6],[4,6],[2,6],[-1,8],[-6,-8],[-5,-13],[-2,-2],[-3,-4],[-5,-18],[-4,-4],[-2,3],[-4,7],[-3,8],[-2,6],[0,3],[-1,1],[-1,1],[0,1],[0,3],[2,4],[0,2],[-1,4],[-1,4],[-5,5],[-5,12],[-1,0],[0,-8],[0,-3],[1,-3],[1,-3],[-3,-10],[0,-5],[1,-4],[4,-15],[0,-5],[1,-1],[0,-1],[-1,-3],[0,-1],[-9,-8],[-12,-25],[-4,-6],[-22,-19],[-2,-1],[-2,0],[-4,4],[-2,1],[-20,-17],[-11,-7],[-6,10],[4,0],[1,0],[-2,4],[-2,2],[-3,1],[-2,2],[-1,3],[0,4],[1,3],[8,4],[16,17],[27,13],[6,0],[6,2],[4,8],[-9,0],[-4,1],[-2,3],[1,4],[10,6],[-2,2],[-1,3],[-2,4],[3,2],[4,1],[4,-1],[3,-2],[1,1],[2,-1],[2,1],[0,5],[-2,2],[-10,4],[-5,-1],[-2,-2],[-3,-5],[-1,-2],[-2,0],[-1,3],[-2,4],[3,7],[-2,5],[-7,8],[-6,3],[-1,2],[0,4],[1,4],[3,4],[8,15],[3,4],[7,8],[4,2],[0,3],[-9,3],[-4,0],[-4,-3],[-8,-9],[-3,-10],[-1,-1],[-5,-16],[-3,-4],[-2,0],[-9,4],[-4,8],[-3,2],[-3,-1],[-7,-5],[0,-3],[5,-1],[9,-6],[6,-3],[3,-3],[2,-3],[0,-4],[4,-3],[6,-1],[6,-1],[3,-9],[1,-5],[-1,-4],[-1,-4],[-3,-1],[-14,3],[1,-6],[1,-4],[2,-3],[2,-2],[0,-3],[-14,-15],[-5,-2],[-12,-2],[-6,1],[-5,7],[1,6],[-2,3],[-13,0],[-3,-2],[-3,-5],[3,-2],[8,0],[3,-3],[6,-7],[4,-3],[2,-4],[3,-2],[-1,-3],[-2,-4],[-3,-3],[-8,-3],[-3,-6],[-2,1],[-1,1],[-2,1],[0,2],[0,3],[1,5],[0,5],[-2,6],[-2,5],[-2,3],[-4,-3],[-1,0],[-1,2],[-3,8],[-3,4],[-3,2],[-6,1],[1,-3],[5,-8],[-1,-6],[-1,-3],[-3,0],[-2,0],[-4,7],[-2,1],[-1,-5],[2,-4],[6,-10],[-5,-5],[-2,-1],[-2,1],[-3,6],[-2,2],[-7,2],[-2,-1],[-3,-7],[4,-7],[1,-4],[-1,-6],[1,-6],[-2,2],[-7,9],[-2,4],[-3,2],[-4,-3],[3,-4],[8,-19],[2,-8],[-3,1],[-2,4],[-3,9],[-1,-6],[-1,-7],[-2,-4],[-3,4],[-3,5],[-7,7],[-3,4],[1,-6],[2,-4],[2,-3],[3,-2],[0,-2],[-4,1],[-8,8],[-4,2],[-14,0],[2,-6],[11,-2],[4,-5],[3,-3],[5,-2],[3,-3],[-2,-5],[1,-8],[-5,-6],[-10,-6],[-2,-3],[-5,-7],[-2,-1],[-12,0],[0,2],[5,4],[2,3],[2,5],[-11,-5],[-4,-1],[1,6],[13,10],[7,10],[-8,-3],[-6,-6],[-3,3],[-2,0],[-3,-4],[-3,-6],[-3,-4],[-4,3],[1,0],[0,1],[0,2],[-3,5],[2,8],[4,7],[8,5],[6,8],[3,1],[-5,12],[-8,-2],[-8,-6],[-6,2],[3,3],[7,5],[3,1],[-5,4],[-8,-3],[-15,-13],[-5,-10],[-4,-5],[-3,-2],[-2,0],[-1,2],[-1,2],[-2,10],[-1,4],[0,3],[-2,6],[-3,-2],[-4,-6],[-1,-3],[-3,-2],[-13,4],[-1,1],[-1,0],[-1,-3],[-2,-2],[-2,-2],[-5,-2],[-2,-1],[-1,-2],[-1,-3],[2,-2],[2,0],[5,0],[-5,-4],[-5,0],[-17,8],[-4,-5],[-3,-1],[-4,0],[-2,2],[1,6],[-3,0],[-4,-7],[-5,-3],[-8,-10],[5,-1],[12,7],[5,-3],[-5,-8],[-2,-3],[5,2],[9,8],[5,1],[19,0],[2,2],[4,5],[2,2],[20,-5],[4,-3],[2,-7],[-3,-3],[-16,-11],[-14,1],[-15,-4],[-30,4],[-7,4],[-14,1],[-3,3],[6,11],[-4,3],[-5,-3],[-4,-6],[-3,-7],[-4,-6],[-4,-2],[-9,1],[-3,-1],[-5,-4],[-2,-1],[-3,0],[-4,3],[-2,0],[-1,2],[0,4],[1,4],[4,3],[7,7],[14,9],[8,11],[2,0],[2,-1],[1,-6],[2,-1],[3,2],[4,5],[4,7],[2,5],[2,3],[23,9],[3,3],[0,6],[5,5],[3,1],[0,3],[-5,2],[-16,-5],[-10,0],[-1,1]],[[3252,2418],[-7,-6],[-3,1],[-11,3],[-6,3],[-4,7],[-6,7],[-1,4],[2,5],[4,4],[3,3],[39,11],[8,1],[4,-2],[2,-6],[-1,-7],[-2,-6],[-2,-5],[-12,-14],[-7,-3]],[[3721,3235],[4,0],[1,0],[1,1],[1,1],[2,0],[0,1],[1,0],[1,0],[1,0],[1,0],[2,-1],[1,0],[4,-1],[3,-1],[2,1],[3,1],[3,2],[4,2],[3,1],[2,2],[2,2],[3,2],[3,1],[3,1],[2,1],[2,0],[1,0],[2,0],[2,0],[1,0],[2,0],[1,0],[2,0],[1,0],[23,1],[22,1],[34,0],[33,0],[81,0],[81,0],[81,0],[81,0],[81,0],[81,0],[81,0],[81,0],[81,0],[81,0]],[[3621,2261],[2,4],[3,6],[-2,1],[-2,0],[-4,-1],[-2,-6],[-21,-17],[-1,0],[-1,1],[-1,3],[0,3],[-1,1],[-2,2],[-2,4],[-3,7],[-1,5],[-2,2],[-2,0],[-1,-2],[0,-3],[1,-3],[0,-2],[1,-1],[1,-1],[0,-2],[0,-3],[0,-3],[1,-10],[3,-8],[4,-6],[5,-2],[-1,-4],[-3,-2],[-5,-2],[0,-3],[7,-3],[3,-3],[1,-7],[0,-4],[-1,-7],[0,-7],[-1,-7],[0,-4],[3,-2],[6,3]],[[3410,2014],[0,1],[-1,6],[-2,-4],[-4,-7],[-4,2],[-3,-8],[-5,3],[-2,6],[-2,6],[-1,8],[1,3],[11,-9],[8,1],[0,5],[-2,3],[-9,3],[-1,2],[-1,4],[0,5],[-1,3],[-2,2],[-2,0],[4,15],[6,7],[6,4],[7,0],[4,-2],[2,1],[2,3],[4,16],[1,2],[2,0],[2,0],[1,-1],[2,0],[1,4],[-4,0],[2,8],[4,5],[22,13],[2,0],[5,0],[2,0],[5,4],[2,2],[1,2],[1,3],[1,3],[2,0],[2,-2],[2,-7],[2,-2],[4,0],[3,2],[2,4],[2,7],[3,5],[8,9],[1,6],[2,5],[4,6],[5,3],[7,3],[5,4],[4,6],[3,6],[-4,5],[-4,-4],[-4,-6],[-5,-4],[-9,4],[-3,-1],[-2,-3],[2,-2],[6,-4],[-11,-6],[-3,-3],[-3,-5],[-15,-17],[-13,-8],[-6,-1],[1,2],[2,2],[1,4],[1,4],[-3,1],[1,2],[3,7],[1,3],[1,8],[0,2],[2,0],[8,0],[2,0],[1,3],[3,5],[-12,6],[-6,7],[-2,2],[-3,-1],[-2,-2],[-1,-4],[0,-6],[-1,-4],[-2,-3],[-1,-3],[1,-6],[-5,-2],[-5,-4],[-4,-6],[-4,-8],[2,0],[3,0],[2,-1],[1,-3],[1,-6],[4,-5],[1,-5],[-2,-1],[-3,-2],[-2,0],[0,3],[2,3],[-5,7],[-3,1],[-3,-1],[-2,-5],[0,-4],[1,-4],[-1,-6],[-2,-2],[-10,-9],[-1,-1],[-4,-2],[-6,0],[-9,-5],[-4,-1],[-2,1],[1,4],[5,7],[9,4],[3,3],[1,1],[2,6],[5,9],[-3,2],[-7,6],[-3,0],[-2,3],[-2,5],[-2,3],[-2,-5],[5,-13],[-6,-13],[-17,-20],[-2,3],[-3,2],[-2,3],[1,6],[6,3],[4,9],[-9,8],[-2,5],[1,7],[3,3],[6,3],[6,6],[3,2],[5,0],[2,2],[4,3],[3,5],[2,5],[-4,2],[-11,0],[3,6],[1,6],[-1,3],[-4,0],[-6,-6],[-2,-1],[-1,4],[-3,4],[-1,2],[2,5],[2,4],[-13,5],[-6,7],[1,11],[3,3],[4,0],[7,-1],[2,-1],[2,-1],[1,-1],[2,2],[1,2],[2,2],[4,3],[0,3],[-3,0],[-4,-3],[-3,0],[-2,2],[-1,3],[-1,7],[-1,2],[-2,2],[0,3],[1,4],[1,2],[6,7],[15,33],[10,16],[-4,-1],[-5,-4],[-4,-8],[-6,-13],[-9,-14],[-2,-1],[-3,-3],[-4,-3],[-4,-2],[-3,0],[-3,1],[-3,3],[0,3],[3,1],[5,5],[7,11],[3,11],[-3,5],[4,6],[0,6],[-2,3],[-4,-1],[-2,-2],[-4,-7],[-2,-2],[-5,-4],[-1,-2],[-2,4],[-1,6],[0,7],[1,6],[-3,-3],[-2,-8],[-1,-9],[-2,-7],[-8,-22],[-2,-5],[-2,-3],[-2,-1],[-4,1],[-5,-5],[-2,-1],[1,4],[3,7],[6,9],[2,6],[-3,0],[1,2],[2,2],[1,1],[2,0],[0,3],[-4,3],[0,3],[1,1],[2,2],[-4,3],[-2,-2],[-2,-3],[-2,-1],[-3,2],[-6,10],[0,2],[3,7],[4,6],[5,3],[4,2],[5,2],[9,12],[5,3],[10,2],[9,7],[13,16],[19,12],[9,1],[2,1],[2,5],[1,2],[4,5],[2,1],[2,0],[5,5],[2,3],[1,3],[1,6],[0,3],[5,4],[11,-2],[5,3],[-5,1],[-6,6],[-4,2],[-8,-3],[-4,2],[-4,7],[5,7],[18,14],[4,2],[3,6],[5,5],[32,15],[59,8],[6,-3],[3,0],[7,6],[7,-1],[7,-3],[5,-4],[18,-20],[10,-8],[10,-1],[24,6],[-1,2],[-1,2],[-1,2],[-1,2],[-21,-3],[-10,-5],[-4,2],[-4,9],[6,3],[10,-1],[5,1],[0,3],[-1,0],[-3,3],[0,4],[1,1],[0,1],[-14,2],[-7,-2],[-5,-6],[-3,4],[-4,6],[-4,5],[-5,2],[-16,-4],[-34,9],[-31,-9],[-77,-46],[-3,-1],[-6,7],[-3,-2],[7,-18],[2,-10],[0,-12],[3,-3],[-2,-6],[-10,-14],[-9,-3],[-4,-4],[-3,-3],[-15,1],[-2,-3],[-5,-12],[-2,-2],[-6,-6],[-4,-2],[-3,-1],[-8,1],[-4,-1],[-13,-18],[-3,-2],[-2,3],[-7,14],[2,5],[7,10],[-1,3],[7,14],[2,4],[-2,3],[-4,-4],[-5,-5],[-5,-10],[-4,-3],[-3,-1],[-3,2],[-2,6],[1,4],[7,4],[-6,6],[-1,3],[6,12],[8,13],[7,15],[1,20],[-5,-8],[-4,-9],[-2,-9],[-1,-4],[-2,-2],[-2,-1],[-3,-3],[-2,-4],[-2,-5],[0,-2],[0,-3],[-1,-2],[-2,-2],[-3,-2],[-1,-2],[-2,-4],[-1,-4],[-1,-4],[-2,-2],[-3,1],[-1,3],[-1,3],[-2,2],[-5,1],[-4,4],[-1,7],[2,11],[3,-1],[6,5],[11,13],[-5,-1],[-12,-9],[-5,1],[4,7],[20,17],[12,6],[5,5],[-4,3],[-6,-3],[-13,-12],[-9,-5],[-5,0],[3,14],[6,8],[12,9],[-5,3],[-2,0],[2,14],[-1,15],[-2,8],[-4,-11],[-6,-29],[-5,-12],[-6,-5],[-2,1],[-4,6],[-2,2],[-2,-1],[-4,-4],[-15,-7],[-30,4],[-8,5],[14,17],[9,4],[13,3],[4,3],[4,4],[6,10],[8,4],[4,3],[-4,3],[-2,1],[-2,0],[-2,-2],[-3,-3],[-13,-8],[-8,-10],[-7,-4],[-21,-3],[-4,2],[0,3],[1,2],[6,0],[2,1],[2,4],[2,1],[3,4],[4,2],[4,3],[12,7],[3,3],[-5,-2],[-3,0],[-3,2],[2,4],[4,12],[3,4],[7,2],[10,7],[6,3],[4,-1],[3,-3],[3,-1],[3,2],[-2,3],[0,2],[-2,1],[4,6],[6,5],[13,6],[7,-3],[14,-14],[25,-9],[8,0],[4,-1],[3,-5],[0,-2],[0,-4],[1,-2],[1,-2],[1,-1],[2,0],[0,4],[2,6],[3,3],[6,4],[0,3],[-7,4],[0,8],[4,9],[7,8],[35,21],[8,0],[7,-4],[7,-6],[11,-15],[6,-6],[4,4],[-5,10],[-13,14],[-3,5],[-3,6],[5,7],[5,6],[11,7],[0,2],[-11,-2],[-47,-28],[-15,-2],[-5,-4],[-4,-6],[-8,-25],[-3,-4],[-32,0],[-5,2],[-4,5],[-5,11],[-1,4],[4,7],[8,8],[-6,6],[-3,0],[-18,-19],[-4,-1],[-4,3],[-7,10],[-3,1],[0,-6],[3,-14],[-4,-1],[-10,-8],[-12,-7],[-4,-5],[-6,-2],[-25,-13],[-4,0],[-4,1],[-4,3],[2,8],[4,1],[8,-3],[0,2],[-1,1],[-1,3],[-18,5],[0,4],[22,14],[6,5],[36,24],[-8,6],[-9,-6],[-9,-10],[-15,-7],[-22,-18],[1,3],[1,3],[-8,0],[-2,0],[-2,-3],[-4,-5],[-2,-1],[-5,1],[-5,4],[-5,7],[-3,8],[4,1],[3,3],[3,4],[3,4],[4,1],[11,-4],[31,9],[-8,3],[-25,-6],[0,3],[1,1],[0,1],[2,3],[-22,-5],[-6,5],[14,18],[44,31],[18,8],[42,38],[3,13],[1,8],[2,5],[3,4],[32,24],[20,21],[20,4],[30,16],[8,-1],[4,1],[2,6],[-3,0],[-3,1],[-3,4],[-2,3],[2,6],[2,5],[5,7],[1,7],[5,10],[11,16],[6,5],[18,7],[18,13],[25,1],[2,1],[3,6],[-4,0],[-4,2],[-4,2],[-3,5],[10,10],[3,5],[3,3],[9,4],[1,3],[13,18],[4,2],[12,0],[10,-5],[3,0],[-3,6],[-4,5],[5,7],[10,-3],[26,-18],[28,3],[7,4],[4,1],[4,-1],[10,-6],[33,-2],[5,7],[-43,5],[-13,7],[-4,-3],[-5,-7],[-8,0],[-37,23],[8,13],[18,10],[11,10],[7,2],[7,7],[2,1],[6,1],[11,-5],[14,-1],[2,0],[29,0],[27,-12],[12,0],[10,6],[-5,4],[-12,2],[-16,-2],[-3,1],[-11,8],[-10,1],[-14,-3],[-5,-3],[-2,0],[-2,0],[-3,0],[-10,7],[-10,-1],[0,3],[3,2],[6,5],[3,2],[12,0],[30,9],[3,2],[-6,4],[-45,-16],[-11,-9],[-8,-3],[-5,-4],[-2,-1],[-9,1],[-13,-4],[-33,-26],[-5,-2],[-8,0],[-1,-1],[-5,-7],[-17,-9],[-13,-15],[-10,-4],[-5,-4],[-36,-45],[-42,-26],[-9,-15],[-11,-33],[-7,-13],[-23,-15],[-3,0],[-68,-55],[-27,-42],[-19,-21],[-57,-37],[-16,-3],[-24,9],[-8,-1],[20,12],[7,0],[0,3],[-29,-9],[4,5],[5,9],[4,9],[0,6],[0,3],[9,8],[9,5],[23,3],[34,16],[-15,-3],[-12,3],[-4,0],[-10,-8],[-17,-4],[-3,-3],[0,3],[-5,-4],[-6,-2],[-6,-1],[-4,3],[-5,10],[0,4],[1,3],[2,2],[0,2],[-2,8],[-6,3],[-2,8],[1,5],[1,3],[1,2],[1,3],[2,11],[1,3],[3,-3],[3,3],[6,13],[3,5],[3,4],[8,4],[0,3],[-5,0],[-6,-6],[-6,-8],[-7,-12],[-1,3],[0,7],[0,3],[1,4],[7,5],[2,4],[-8,9],[2,3],[17,8],[20,0],[2,1],[1,3],[2,2],[7,-6],[6,-2],[12,-1],[0,-3],[-23,3],[4,-4],[6,-4],[15,-4],[5,1],[2,2],[5,5],[28,14],[20,2],[2,-1],[5,-4],[53,-7],[3,2],[2,6],[2,1],[0,3],[-7,4],[-25,-4],[-18,6],[-13,-1],[-2,3],[0,3],[-28,0],[-5,-1],[-11,-8],[-5,-2],[-17,1],[-7,4],[-23,4],[-3,5],[2,1],[5,4],[3,1],[4,0],[2,2],[0,7],[-3,0],[-1,-1],[-1,-2],[-4,3],[-11,-6],[-5,3],[2,2],[7,4],[0,2],[-2,1],[-3,2],[5,3],[23,20],[4,2],[4,0],[9,-5],[14,1],[3,-2],[4,-4],[35,7],[8,6],[3,1],[16,-6],[5,0],[0,2],[-1,1],[3,3],[2,0],[5,0],[-1,3],[-1,3],[0,4],[1,5],[-13,-3],[-4,0],[-9,5],[-6,-1],[-32,-16],[-3,1],[-6,4],[-3,1],[-9,-1],[-4,1],[-11,11],[3,2],[7,-4],[11,2],[5,-2],[2,1],[5,4],[3,1],[27,0],[9,7],[3,1],[5,0],[3,1],[7,9],[0,4],[-2,7],[-3,3],[-2,-2],[-5,-5],[-11,-3],[-3,1],[-5,4],[-3,1],[-12,-3],[-25,-21],[-3,2],[1,5],[3,4],[3,3],[2,1],[0,3],[-2,0],[-4,3],[9,12],[5,4],[5,1],[11,-8],[4,-1],[1,9],[62,-1],[24,-16],[8,-1],[6,3],[4,10],[-16,-3],[-4,3],[-7,9],[-2,2],[-6,1],[-3,2],[3,2],[22,4],[3,3],[-1,0],[0,1],[-1,1],[1,2],[1,7],[-4,-1],[-8,-4],[-17,-2],[-4,4],[1,3],[0,4],[0,2],[-2,2],[4,7],[5,5],[0,3],[-7,-1],[-4,-6],[-8,-16],[-6,-6],[-32,-8],[-4,1],[-9,7],[-30,0],[0,4],[1,2],[-6,2],[-43,-4],[-2,-2],[-3,-1],[-10,2],[-31,-3],[-6,3],[0,4],[2,2],[3,3],[-3,2],[-17,5],[-5,6],[-3,1],[-1,1],[0,3],[1,3],[1,1],[9,0],[20,-5],[35,5],[18,-5],[8,1],[7,4],[-5,5],[-50,4],[-3,-2],[-4,-5],[-2,-2],[-3,1],[-9,8],[-14,1],[-7,4],[1,10],[-3,6],[4,3],[11,2],[24,-3],[26,11],[4,4],[1,3],[-5,-1],[-20,-8],[-67,-6],[3,7],[1,2],[-1,0],[-3,3],[5,4],[2,1],[3,1],[-3,2],[1,2],[1,2],[2,1],[1,1],[-4,3],[-1,0],[2,3],[3,0],[2,-1],[3,1],[1,2],[0,2],[1,3],[0,1],[1,2],[21,6],[49,2],[4,4],[-3,1],[-8,2],[-13,-1],[-5,0],[-4,4],[5,5],[6,4],[6,1],[10,-5],[6,1],[12,6],[38,3],[3,1],[6,6],[3,1],[12,-2],[7,4],[5,2],[5,4],[39,13],[4,-1],[6,-4],[4,-1],[3,1],[2,2],[1,3],[2,3],[5,4],[24,6],[13,7],[6,0],[17,-13],[80,-4],[10,-7],[5,-5],[3,-7],[4,-11],[0,-4],[1,-3],[6,-7],[12,-27],[4,-6],[5,-5],[11,-5],[6,0],[22,8],[11,8],[7,2],[11,6],[25,5],[41,-8],[12,5],[0,2],[-1,1],[1,0],[-3,2],[-3,0],[-6,-2],[-2,1],[-7,4],[-6,8],[-2,1],[-50,-12],[-46,-25],[-11,3],[-5,4],[-4,6],[-12,22],[-9,10],[-3,10],[-5,18],[-4,7],[-4,3],[-3,1],[-3,1],[-3,4],[1,6],[2,2],[39,6],[12,9],[6,1],[3,2],[3,6],[-70,-14],[-69,-14],[-6,2],[-17,15],[-6,2],[-45,-12],[-9,-6],[-4,-2],[-10,0],[-7,-5],[-40,-14],[-41,-14],[-19,7],[2,6],[6,8],[2,6],[-3,0],[-10,-7],[-8,-8],[-7,-12],[-7,-3],[-20,0],[-14,-7],[-13,-11],[-15,-10],[-6,0],[0,4],[5,5],[-3,3],[-10,-2],[-4,2],[2,2],[1,2],[2,1],[1,1],[0,3],[-3,1],[-4,2],[2,6],[1,3],[1,3],[-2,12],[1,2],[5,3],[-4,7],[2,8],[4,6],[5,4],[-1,1],[-4,5],[3,5],[4,5],[4,3],[3,2],[1,1],[3,5],[1,2],[2,1],[3,-1],[8,11],[8,4],[16,5],[11,8],[4,1],[1,1],[5,7],[6,6],[30,11],[4,3],[-6,4],[-11,-9],[-5,2],[19,19],[14,4],[7,4],[13,14],[-8,-1],[-5,-2],[-6,-8],[-5,-2],[-5,0],[-3,1],[4,9],[6,7],[11,7],[13,6],[13,0],[3,-2],[6,-5],[3,-1],[24,4],[5,3],[5,7],[-36,-5],[-12,5],[7,3],[23,1],[15,7],[23,0],[5,-2],[10,-10],[12,-4],[19,-13],[1,0],[4,0],[1,0],[1,2],[0,3],[0,3],[0,2],[4,-1],[6,-7],[6,-3],[7,-6],[4,-1],[2,-1],[3,-3],[1,-3],[-1,-3],[-1,-2],[1,-2],[4,-5],[17,-1],[36,11],[21,0],[4,3],[-4,3],[-2,0],[0,3],[11,0],[6,-2],[9,-10],[34,-18],[5,-6],[2,-2],[7,1],[2,-2],[2,-3],[8,-7],[14,-17],[4,-3],[3,0],[3,-2],[5,-5],[2,-2],[10,0],[9,-5],[3,0],[3,1],[6,3],[3,1],[42,-7],[5,-4],[1,3],[-2,3],[5,5],[11,5]],[[7964,5489],[21,-9],[14,0],[13,-9],[79,1],[2,0],[1,-1],[1,-3],[1,-4],[2,-2],[6,-9],[3,-15],[5,-5],[5,-4],[3,-4],[3,-5],[13,-4],[4,-8],[19,-8],[4,-8],[-1,-2],[-1,-1],[0,-1],[0,-2],[21,-11],[5,0],[6,2],[4,5],[2,0],[1,-5],[1,-4],[4,-3],[7,-1],[4,-2],[8,-8],[23,-11],[3,-2],[2,-5],[0,-4],[-2,-3],[-1,-1],[-2,-2],[-2,-4],[-1,-4],[28,8],[7,-1],[6,-6],[2,-8],[-2,-13],[0,-3],[2,-7],[1,-2],[-5,-8],[-7,-1],[-8,2],[-17,12],[-15,3],[-3,4],[1,1],[0,1],[1,2],[0,2],[-4,-1],[-8,-7],[-5,-1],[-45,15],[-6,-1],[-8,-4],[-5,-5],[-1,-2],[1,-2],[1,-4],[2,-1],[0,-2],[1,-2],[-1,-1],[-1,-1],[1,-6],[1,-3],[9,-10],[57,-21],[4,-8],[-3,-11],[3,-3],[3,-1],[4,2],[2,5],[0,4],[4,2],[10,-1],[9,-4],[10,-1],[-3,-4],[-10,-8],[-9,-13],[-3,-1],[1,-6],[2,-2],[4,-4],[3,-5],[2,-4],[-4,-4],[-6,-8],[-3,-3],[-8,-2],[-44,6],[-12,9],[0,3],[9,6],[4,5],[3,9],[-7,3],[-3,-2],[-5,-9],[-3,-4],[-6,-4],[-6,0],[-6,3],[-13,12],[-24,13],[-4,5],[-3,4],[-6,12],[-6,9],[-47,23],[-47,24],[-19,2],[-23,16],[-8,3],[-7,-1],[-3,-3],[-4,-7],[-2,-2],[-2,1],[-1,3],[-1,4],[0,4],[4,4],[6,3],[3,5],[-5,9],[-6,7],[-5,4],[-7,2],[1,-3],[-5,-6],[-7,5],[-13,16],[-7,2],[-3,3],[-4,5],[-1,4],[-3,13],[0,5],[-1,9],[-1,5],[1,5],[0,5],[0,4],[-1,6],[-2,11],[-3,10],[-7,16],[3,7],[5,5],[6,2],[76,9]],[[7826,5498],[-3,-6],[-13,-8],[1,-6],[1,-8],[0,-9],[-1,-6],[-4,-7],[-7,-1],[-16,3],[-9,8],[-31,12],[-5,5],[5,-1],[12,3],[5,4],[1,2],[3,7],[1,2],[4,2],[11,-2],[4,2],[6,5],[4,2],[28,3],[2,0],[2,-1],[0,-2],[-1,-3]],[[8076,5571],[51,-15],[17,0],[4,-2],[8,-6],[80,-18],[25,-20],[2,0],[0,1],[0,2],[1,2],[1,1],[4,-2],[4,-3],[4,0],[5,5],[2,-7],[3,-1],[4,-1],[2,-3],[0,-2],[1,-2],[0,-3],[1,-2],[-5,-4],[-10,-3],[-4,-7],[1,-1],[4,-5],[-2,-1],[-6,1],[-2,-1],[-6,-5],[-14,-4],[-5,-5],[5,-3],[4,0],[3,1],[4,0],[0,-1],[0,-2],[1,-2],[2,-1],[13,-4],[2,-1],[3,-4],[-3,-2],[-7,-3],[1,-4],[2,-2],[5,0],[1,0],[1,2],[1,0],[1,0],[2,-4],[1,-1],[5,-2],[4,-4],[0,-6],[-4,-5],[1,-1],[0,-1],[-1,-1],[1,0],[-4,-2],[-12,-1],[-3,2],[-1,4],[-4,0],[-7,-3],[7,11],[-4,2],[-6,-1],[-5,-3],[-4,-3],[-2,-4],[-15,6],[-63,-5],[-6,3],[-5,5],[17,3],[0,6],[-2,3],[-13,0],[-5,3],[-5,6],[2,5],[-1,4],[-2,3],[-3,2],[2,3],[-6,5],[-56,25],[-16,-3],[-14,3],[-19,-1],[1,0],[-25,-2],[-17,11],[-18,4],[-56,-1],[-57,-1],[-4,3],[-3,8],[-2,9],[1,10],[7,8],[61,5],[61,5],[13,6],[24,1],[51,18]],[[8386,5581],[-11,0],[-11,9],[16,11],[6,0],[20,-1],[6,-5],[-2,0],[-1,-1],[-1,-2],[0,-2],[-22,-9]],[[7951,5690],[63,-23],[63,-23],[4,-8],[-8,-4],[-69,11],[-70,11],[-69,11],[-70,11],[-3,-2],[-3,-4],[4,-2],[4,1],[5,3],[4,0],[4,-1],[10,-5],[62,-12],[10,-7],[11,3],[40,-13],[41,-14],[3,1],[4,-3],[55,-4],[56,-4],[14,-10],[5,-2],[11,4],[-4,-4],[-7,-14],[-3,-3],[-80,-10],[-81,-10],[-80,-10],[-9,5],[-6,2],[-15,-2],[-4,1],[-12,10],[-22,2],[-29,17],[-59,1],[-23,11],[-14,12],[-7,3],[-1,1],[-1,1],[0,3],[1,2],[1,3],[2,1],[7,2],[7,6],[4,1],[2,2],[5,11],[14,15],[22,9],[4,6],[0,6],[-1,5],[-1,5],[0,6],[4,7],[5,4],[64,2],[63,3],[10,-4],[63,-23]],[[8448,6139],[4,-2],[10,2],[50,-9],[3,-1],[3,-7],[3,-3],[6,-6],[3,-4],[1,-6],[-1,-3],[-3,-3],[-1,-4],[0,-5],[2,-1],[1,-1],[2,-3],[1,-3],[0,-2],[1,-2],[2,-3],[9,-9],[9,-8],[4,-2],[4,1],[4,-4],[7,0],[6,-3],[2,-10],[-5,-9],[-49,-10],[-49,-11],[-18,2],[-24,-11],[-40,-4],[-1,1],[-21,20],[-43,15],[-42,15],[-8,7],[-1,10],[4,11],[0,2],[3,5],[0,2],[7,7],[1,0],[1,0],[1,0],[1,2],[0,3],[0,2],[0,2],[3,4],[3,3],[48,22],[48,22],[43,-3],[2,-1],[2,-1],[1,-2],[1,-4]],[[8795,6224],[-1,-5],[6,1],[3,1],[3,3],[2,0],[0,-3],[-1,-3],[-2,-1],[0,-2],[0,-1],[0,-1],[-1,0],[3,-8],[-1,-6],[-4,-5],[-10,-6],[-53,2],[-4,-3],[2,3],[1,2],[0,2],[-6,3],[-2,3],[-3,5],[3,4],[9,4],[11,12],[29,17],[8,0],[10,-2],[5,-3],[2,-6],[-6,-3],[-3,-4]],[[8829,6263],[20,-6],[16,0],[9,1],[2,-1],[-1,-2],[-1,-1],[-2,-1],[-1,1],[-2,0],[-2,-2],[-3,-4],[0,-3],[5,-5],[4,-8],[0,-7],[-6,-3],[-20,0],[-3,2],[1,4],[-2,5],[-5,6],[-2,3],[0,7],[-2,5],[-2,4],[-3,5]],[[8573,6338],[3,-2],[3,1],[1,2],[0,4],[1,4],[2,2],[2,-2],[2,0],[4,2],[5,0],[2,-1],[0,-2],[4,0],[30,-14],[7,-2],[4,-2],[2,-5],[-1,-6],[-3,-4],[-6,-5],[-16,-25],[-13,-7],[-12,-17],[-7,-5],[-8,-2],[-19,3],[-12,8],[-17,3],[-37,30],[-3,7],[3,6],[11,11],[3,5],[2,7],[2,7],[1,8],[-1,8],[-4,7],[-6,10],[2,5],[6,4],[13,13],[23,7],[24,-5],[15,-8],[15,-3],[5,-3],[2,-5],[-1,-6],[-3,-4],[-30,-15],[-5,-6],[1,-5],[4,-3]],[[8957,6510],[-5,-8],[-23,-15],[-24,3],[-3,-3],[4,0],[2,-1],[2,-2],[-13,-3],[-4,-2],[-2,-4],[0,-4],[15,-5],[15,9],[2,-1],[-1,-5],[0,-3],[-1,-2],[-3,-8],[-1,-2],[5,-10],[3,-4],[4,-3],[3,-2],[6,1],[1,-1],[2,-2],[0,-3],[0,-2],[1,-2],[6,-6],[8,-5],[14,-3],[20,7],[2,2],[1,2],[0,4],[-2,2],[-1,1],[-1,2],[3,10],[5,1],[7,-2],[7,0],[6,3],[6,1],[7,-3],[6,-7],[-10,-15],[-3,-10],[2,-12],[2,-3],[2,0],[1,-1],[1,-4],[-1,-1],[-5,-4],[-10,-4],[-11,-1],[3,-3],[0,-5],[-2,-6],[-2,-4],[-5,-5],[-5,-5],[-6,-1],[-4,4],[2,1],[2,3],[2,4],[0,5],[0,6],[-1,3],[-5,0],[-15,6],[-13,-3],[0,3],[1,0],[-4,8],[-7,2],[-36,1],[-13,-9],[-43,-13],[-61,9],[-11,-3],[-3,4],[-2,7],[-1,9],[1,3],[0,3],[-1,3],[0,5],[1,6],[2,4],[11,19],[2,3],[-2,4],[-7,10],[5,1],[3,5],[-1,24],[-2,14],[-6,5],[-6,3],[-3,8],[24,1],[5,2],[9,8],[2,1],[4,-3],[2,1],[20,7],[4,-1],[15,-13],[4,-6],[1,-7],[1,-1],[2,-1],[9,-2],[17,4],[8,5],[6,8],[-1,4],[0,3],[0,4],[0,3],[-1,4],[1,3],[2,3],[2,2],[2,7],[7,0],[8,-3],[5,-4],[2,-2],[4,-7],[2,-3],[9,-6],[3,-5],[-1,-6],[6,-5],[2,-3]],[[8818,7063],[0,-10],[-2,-12],[-6,-18],[-2,-5],[0,-6],[1,-5],[2,-4],[1,-5],[-1,-10],[-1,-9],[0,-10],[1,-11],[1,-6],[0,-11],[1,-6],[1,-6],[2,-6],[9,-21],[2,-6],[0,-7],[-2,-6],[-3,-5],[-3,-5],[2,-7],[4,-16],[2,-6],[6,-11],[0,-4],[1,-4],[2,-5],[0,-5],[0,-12],[0,-6],[-3,-13],[0,-5],[3,-5],[-3,-7],[-5,-10],[-5,-5],[-4,5],[1,7],[2,9],[1,8],[-1,9],[-38,89],[-5,18],[0,14],[2,8],[-2,7],[-7,12],[-26,58],[-4,16],[1,18],[5,11],[6,5],[7,1],[32,-5],[9,2],[-2,3],[-1,2],[-1,1],[-2,0],[2,2],[0,1],[0,3],[-24,3],[-8,-3],[0,4],[-3,4],[-3,5],[-2,4],[-1,6],[0,8],[-1,6],[-6,6],[1,6],[4,7],[3,4],[5,2],[4,1],[5,-2],[4,-4],[4,-5],[28,-21],[4,-5],[4,-10],[2,-9]],[[8945,7487],[-21,-3],[-36,0],[-6,8],[6,4],[15,27],[23,18],[4,7],[1,14],[2,9],[4,5],[6,5],[5,2],[22,4],[4,-1],[0,-4],[11,-18],[2,-9],[-3,-11],[-10,-15],[-3,-5],[-4,-16],[-2,-5],[-9,-11],[-11,-5]],[[8400,7584],[-14,-9],[-4,0],[-5,4],[-2,4],[-1,4],[-1,4],[1,5],[5,10],[6,7],[6,6],[8,3],[3,4],[16,6],[4,0],[3,-2],[-1,-1],[-1,-2],[0,-2],[0,-1],[-4,-1],[-5,-3],[-3,-6],[2,-7],[-3,-4],[-6,-5],[-3,-4],[0,-2],[-1,-2],[0,-5],[0,-1]],[[8608,7629],[5,-14],[2,-5],[3,-3],[24,-15],[63,1],[7,-6],[4,-2],[5,-6],[3,-7],[1,-8],[-4,-8],[-8,-2],[-63,20],[-63,20],[-63,21],[-2,4],[3,5],[5,2],[38,-1],[7,1],[7,5],[11,1],[6,4],[3,0],[3,-2],[3,-5]],[[8781,7685],[-3,-5],[-3,-4],[-1,-8],[1,-8],[3,-6],[2,0],[-35,-46],[-7,-5],[-3,-1],[-2,1],[-2,3],[-1,6],[0,7],[2,6],[2,5],[1,4],[8,12],[3,8],[-1,8],[-8,6],[-12,4],[-10,8],[-4,17],[4,-1],[12,-10],[7,-4],[4,0],[33,8],[12,7],[3,0],[-2,-8],[-3,-4]],[[8540,7693],[-9,-3],[-27,2],[-35,17],[4,4],[13,3],[4,2],[22,20],[7,3],[6,0],[6,-4],[6,-6],[5,-9],[3,-9],[1,-8],[-2,-7],[-4,-5]],[[8706,7726],[-15,-6],[-8,1],[-3,3],[2,8],[-9,9],[-12,2],[-3,4],[-1,8],[-1,10],[1,10],[1,8],[3,6],[4,-1],[7,-10],[15,-12],[5,-7],[2,-5],[4,-18],[2,-6],[1,-3],[2,-1],[3,0]],[[8776,7776],[-3,-1],[-13,1],[-3,-1],[-3,-3],[-1,-6],[1,-7],[3,-5],[23,-16],[3,-5],[-1,-5],[-2,-4],[-3,-2],[-14,-4],[-8,-4],[-4,0],[-2,6],[-30,13],[2,6],[0,5],[0,6],[-1,7],[-2,7],[-4,12],[-2,6],[4,8],[5,7],[52,38],[2,0],[1,-3],[0,-3],[1,-7],[4,-15],[0,-6],[-2,0],[-2,-1],[-2,-2],[-1,-3],[4,-11],[1,-5],[-3,-3]],[[8843,7857],[-9,-1],[-9,3],[-5,10],[3,5],[11,6],[10,12],[8,7],[10,4],[22,-2],[4,-3],[-1,-3],[-2,-5],[-11,-10],[-25,-14],[0,-1],[0,-3],[1,-2],[-7,-3]],[[8896,7934],[-4,-6],[-1,5],[1,3],[0,4],[0,5],[-5,6],[-1,5],[2,6],[-2,3],[6,12],[7,7],[8,1],[7,-6],[6,-10],[5,-6],[0,-6],[-7,-8],[-22,-15]],[[8739,8000],[2,-1],[6,1],[13,0],[-5,-7],[-16,-6],[-6,-7],[2,1],[2,-1],[1,-1],[2,-2],[-3,-4],[-2,-3],[-3,-2],[-3,1],[5,-5],[20,5],[-1,-3],[3,-3],[-8,-6],[-30,0],[3,-5],[6,-2],[7,0],[10,4],[11,-2],[5,-3],[-4,-4],[-15,-8],[2,-3],[-5,-4],[-26,-2],[-13,4],[-19,16],[-10,2],[-5,3],[-1,6],[5,8],[69,58],[7,2],[6,0],[4,-4],[0,-1],[0,-1],[-1,-2],[0,-2],[-18,-5],[2,-2],[1,-3],[0,-3],[0,-4]],[[9014,8074],[-1,0],[-6,0],[-2,-1],[-3,-3],[-1,-1],[-24,3],[-4,-3],[3,-5],[1,-1],[-3,-3],[-4,-2],[-8,-1],[3,-4],[2,-1],[-4,-3],[-3,-2],[-8,-1],[3,-4],[-2,-3],[-11,-5],[-4,0],[-4,1],[-3,2],[2,3],[3,1],[6,2],[-3,6],[-5,4],[-2,7],[1,12],[5,10],[20,16],[9,22],[3,3],[6,4],[7,7],[6,3],[7,-8],[5,-1],[18,-15],[3,-6],[-1,-8],[-2,-7],[-5,-18]],[[9036,8466],[-4,-7],[-2,-8],[-39,-42],[-39,-42],[-55,-21],[-50,-3],[-14,9],[-42,15],[-43,15],[-11,7],[-14,15],[-24,7],[-3,0],[9,10],[34,13],[13,11],[6,1],[12,-1],[6,2],[-1,6],[-1,4],[-4,7],[-5,12],[-2,5],[24,5],[4,-1],[2,-1],[5,-5],[2,-4],[1,-4],[0,-7],[5,0],[8,3],[14,13],[4,2],[68,16],[67,15],[13,-1],[62,-32],[2,-1],[1,-3],[-9,-10]],[[8806,8533],[5,-5],[-2,-2],[-6,-2],[-3,-2],[-61,-17],[-61,-17],[-21,-4],[-2,2],[-6,13],[10,7],[2,5],[-1,2],[-1,1],[2,5],[1,1],[2,2],[1,1],[1,2],[0,2],[-1,1],[0,2],[0,6],[1,3],[1,3],[4,5],[13,10],[22,7],[24,-1],[76,-30]],[[9033,9147],[-7,-5],[-57,2],[-11,9],[-67,32],[-11,11],[4,4],[5,3],[70,4],[4,-4],[3,-7],[5,-3],[9,-3],[16,-13],[9,-11],[4,-4],[10,-3],[9,-8],[5,-1],[0,-3]],[[8823,9238],[-9,-2],[-58,4],[-67,54],[-23,16],[-6,10],[-2,6],[-2,10],[-1,9],[2,8],[3,3],[18,7],[19,1],[8,-3],[8,-6],[8,-3],[27,-20],[4,-9],[3,-11],[7,-6],[14,-6],[39,-41],[5,-9],[3,-12]],[[3537,9309],[-9,-4],[-66,3],[-65,4],[-17,9],[-53,13],[-12,7],[-66,10],[-12,7],[-16,3],[-7,8],[0,2],[-1,5],[0,2],[-2,3],[-1,2],[-3,3],[-10,8],[-2,4],[1,24],[16,17],[31,14],[43,-6],[38,-17],[-8,-3],[1,-4],[2,-3],[9,-14],[2,-3],[8,-5],[67,-26],[67,-26],[66,-26],[7,-8],[-2,-2],[-6,-1]],[[4388,9582],[55,-16],[54,-16],[0,-3],[-1,0],[0,-3],[18,0],[51,-21],[11,-10],[49,-26],[12,-5],[5,-7],[-1,-11],[-2,-2],[-14,-8],[-30,-8],[-58,-39],[5,-11],[22,-14],[27,-27],[-6,-8],[-8,-4],[-34,-4],[-9,2],[-35,27],[-3,10],[-16,13],[-79,25],[-78,24],[-79,25],[-19,13],[-2,2],[0,4],[1,3],[-7,13],[-11,17],[-11,11],[-8,0],[-4,4],[-18,7],[-32,33],[-30,4],[3,5],[5,3],[68,0],[68,1],[8,-3],[4,0],[4,3],[-4,5],[-12,7],[43,0],[44,1],[54,-16]],[[4138,9642],[-52,0],[-78,4],[-6,2],[-5,5],[-2,8],[0,10],[1,7],[2,4],[5,3],[12,5],[64,-15],[63,-14],[10,-7],[-6,-8],[-8,-4]],[[5436,9736],[-23,-5],[-11,3],[-5,3],[-12,3],[-22,19],[-12,4],[-43,3],[-7,3],[-6,6],[0,1],[1,4],[-5,1],[-8,6],[-4,2],[-3,2],[-4,5],[-2,5],[3,2],[45,-1],[45,-2],[25,-15],[62,-8],[22,-3],[2,-2],[0,-3],[-3,-6],[-6,-9],[-29,-18]],[[5220,9805],[8,-5],[10,-14],[4,-3],[14,-3],[24,-15],[36,-2],[13,-5],[9,1],[4,-2],[8,-13],[3,-1],[8,-2],[7,-3],[13,-12],[-68,9],[-68,10],[-33,18],[-20,3],[-5,2],[-16,15],[-47,18],[-6,-1],[1,3],[-1,0],[9,5],[46,-1],[47,-2]],[[5311,9880],[11,-8],[37,-13],[37,0],[16,-10],[16,-14],[16,-10],[52,-9],[52,-10],[4,-1],[24,-18],[3,-4],[-45,-4],[-5,4],[1,0],[-73,17],[-73,17],[-4,3],[-6,9],[-23,14],[-47,2],[-47,2],[-6,5],[0,8],[3,8],[5,7],[8,4],[27,-4],[0,3],[-12,1],[-11,5],[9,3],[31,-7]],[[7727,4888],[-8,1],[-3,4],[-3,4],[-8,6],[-3,4],[-2,6],[-3,6],[-3,4],[-4,3],[-3,1],[-10,-1],[-7,3],[-3,0],[-1,2],[-10,4],[-2,2],[-1,2],[-2,1],[-2,0],[-13,-3],[-6,1],[-14,8],[-6,0],[-13,-6],[-13,0],[-7,3],[-6,8],[-5,14],[-3,5],[-3,-1],[-2,-1],[-2,-3],[-1,-3],[-1,-3],[-2,-17],[-5,-7],[-15,-5],[-31,0],[-5,5],[-10,3],[-9,6],[-36,37],[-3,4],[-6,19],[0,1],[0,1],[1,0],[-3,7],[-16,15],[-7,1],[-3,1],[-6,7],[-7,3],[-24,24],[-2,6],[4,8],[-46,33],[-8,13],[-2,-2],[-3,-9],[-3,-3],[-4,-1],[-10,1],[-9,6],[-10,3],[-3,0],[-20,23],[-21,12],[-16,18],[-5,3],[-5,1],[-2,-1],[-2,-4],[0,-3],[-1,-3],[-3,-2],[-4,-2],[-2,-2],[0,-3],[5,-2],[11,3],[5,-2],[3,-3],[16,-6],[16,-23],[-7,-7],[-11,-5],[-3,-8],[5,-9],[48,-6],[49,-7],[6,-4],[3,-10],[-7,2],[-16,8],[-8,1],[-2,-1],[-3,-4],[-1,-4],[0,-2],[10,-1],[52,-32],[52,-32],[-1,-4],[-4,-10],[-1,-4],[-1,-4],[-1,-4],[-2,-4],[-3,-2],[-8,-1],[-28,5],[-9,-2],[-20,-15],[-7,-2],[-14,8],[-7,2],[-4,-8],[10,-2],[2,-3],[-5,-4],[-69,-8],[-14,6],[-3,-3],[1,-1],[0,-2],[-1,-2],[12,-7],[42,4],[41,5],[18,10],[14,3],[10,4],[43,-8],[42,-9],[-2,-7],[-5,-4],[-13,-7],[-9,-1],[-4,-4],[18,-15],[2,1],[1,4],[4,7],[8,5],[15,4],[9,-1],[26,-10],[8,1],[4,-1],[6,-9],[3,-1],[27,3],[12,9],[20,-5],[9,5],[15,-7]],[[7342,4759],[-1,3],[-2,3],[-3,1],[-3,-2],[-2,-3],[-2,-2],[-10,0],[-3,-2],[2,-8]],[[4710,4700],[0,38],[0,37],[0,38],[0,37],[0,38],[0,38],[0,37],[0,38],[0,37],[0,38],[0,37],[0,38],[0,37],[0,38],[0,37],[0,38],[0,146],[0,146],[0,146],[0,5],[0,141],[0,146],[0,146],[0,146],[0,146],[0,145],[0,146],[0,146],[0,146],[0,146],[0,146],[0,146],[0,146],[-133,54],[-133,53],[-22,9],[-111,44],[-134,54],[-133,53],[-133,54],[-134,53],[-133,53],[-133,54],[-133,53],[-134,54],[-133,53],[-133,53],[-134,54],[-133,53],[-133,54],[-46,23],[-47,23],[-28,15],[-28,14],[-25,12],[-25,11],[-30,14],[-31,13],[-18,8],[-17,7],[-20,10],[-20,10],[-31,12],[-31,13],[-24,11],[-25,10],[-12,7],[-13,7],[-18,9],[-18,9],[-12,8],[-11,8],[-13,12],[-13,12],[-14,12],[-13,12],[-22,24],[-22,24],[-29,25],[-29,25],[-41,30],[-35,27]],[[1817,8948],[49,-26],[7,5],[-4,8],[4,5],[21,2],[10,4],[38,-1],[5,5],[8,5],[4,1],[1,1],[2,5],[1,2],[2,1],[7,-1],[-8,8],[-16,8],[-7,7],[-11,15],[-5,9],[-3,10],[1,2],[4,3],[2,1],[-22,14],[-3,7],[3,2],[74,37],[6,5],[4,8],[-2,8],[-9,7],[-16,7],[-8,1],[-5,2],[-2,4],[0,7],[-1,3],[-2,1],[-23,18],[-11,17],[-13,5],[-6,8],[-1,9],[-11,10],[3,9],[4,4],[21,16],[61,21],[60,20],[9,-1],[8,4],[8,0],[8,5],[43,7],[51,-10],[24,-13],[38,2],[43,-7],[43,-8],[8,-6],[3,-9],[2,-11],[5,-6],[5,-3],[5,-4],[-11,-6],[-4,-6],[1,-11],[4,-8],[7,-5],[60,-19],[60,-18],[40,0],[8,-2],[17,-12],[1,-2],[-1,-6],[52,-23],[7,-5],[-3,-4],[-10,0],[-4,-2],[7,-11],[8,-4],[48,-8],[9,-5],[14,-1],[7,-3],[23,-19],[4,-2],[15,1],[-2,4],[-9,8],[-7,9],[-3,3],[-73,15],[-6,4],[-5,5],[1,10],[-14,10],[1,9],[-4,5],[-12,6],[-10,2],[-33,24],[-23,5],[-11,12],[-63,7],[1,4],[1,1],[-4,7],[-13,8],[-14,14],[-16,28],[-4,2],[-6,5],[3,5],[0,7],[-2,6],[-3,2],[-21,6],[-33,15],[-28,2],[-70,19],[-7,10],[69,21],[70,22],[45,0],[-2,6],[5,4],[49,8],[48,8],[56,4],[55,5],[13,8],[15,-2],[20,9],[44,4],[6,-2],[12,-10],[6,-2],[-3,-5],[-1,-1],[5,-9],[8,0],[7,5],[5,8],[-2,5],[9,11],[3,2],[4,8],[3,2],[12,0],[3,0],[5,4],[56,-5],[55,-5],[3,-1],[2,-2],[3,-3],[-3,-2],[-4,-1],[-4,0],[-6,3],[-1,-1],[2,-7],[0,-2],[0,-1],[0,-2],[1,-2],[2,-1],[18,-4],[9,-10],[4,-2],[3,7],[-2,6],[-19,11],[7,6],[3,2],[-7,10],[-8,7],[-9,5],[-7,1],[-36,-6],[-4,3],[5,4],[36,3],[16,9],[65,11],[66,11],[56,-22],[3,-3],[2,-5],[3,-5],[4,-3],[10,-3],[5,-4],[7,-9],[6,-3],[2,-2],[4,-6],[10,-11],[6,-4],[4,-4],[4,-5],[2,-3],[4,-5],[8,-5],[3,-6],[1,-4],[-1,-12],[1,-5],[-7,-6],[-3,-5],[-1,-5],[1,-6],[3,-4],[7,-6],[6,-11],[2,-11],[-1,-11],[-10,-33],[-3,-8],[-3,-5],[-18,-13],[-8,-10],[-1,-3],[0,-2],[0,-3],[0,-4],[-1,-2],[-7,-5],[7,-8],[1,-4],[-3,-5],[1,-2],[0,-4],[1,-2],[-4,-22],[0,-9],[2,-4],[18,-13],[11,-5],[23,-2],[-14,8],[-15,3],[0,3],[27,3],[3,6],[-5,5],[-3,10],[-6,22],[2,8],[3,4],[9,3],[32,32],[30,13],[6,6],[5,7],[11,11],[3,5],[0,10],[0,8],[-1,7],[-1,7],[-2,7],[-2,5],[-6,9],[-3,7],[1,6],[4,4],[4,2],[7,1],[25,-2],[9,-6],[31,-4],[22,-12],[33,-1],[10,-8],[1,-2],[10,-5],[54,-8],[54,-8],[48,-21],[48,-22],[9,-9],[73,-24],[8,-6],[3,-4],[0,-4],[0,-9],[1,-4],[2,-5],[3,-2],[43,-13],[49,14],[-36,4],[-5,3],[-5,6],[0,2],[0,3],[0,4],[0,4],[-2,3],[-2,2],[-48,14],[-47,15],[-21,18],[0,3],[3,2],[-4,6],[-5,1],[-10,-1],[-25,9],[-28,23],[5,9],[65,-12],[65,-11],[66,-12],[11,5],[17,1],[29,17],[6,0],[-4,9],[-61,28],[-60,29],[-60,29],[-25,24],[-4,10],[-6,26],[-2,6],[-1,13],[-6,10],[-32,30],[-2,4],[0,4],[0,9],[-4,1],[-3,3],[-3,4],[2,6],[68,-5],[68,-5],[68,-4],[68,-5],[68,-5],[16,-9],[21,-25],[8,-6],[61,-18],[60,-17],[61,-18],[8,-7],[-1,0],[2,-3],[-4,-6],[-4,-6],[7,-5],[54,1],[66,-19],[66,-18],[66,-19],[7,-9],[-7,-8],[2,-5],[2,-3],[3,-1],[3,0],[-4,-5],[-9,-1],[-4,-2],[3,-4],[17,0],[43,-16],[43,-17],[3,-4],[6,-10],[2,-1],[4,-1],[9,-4],[12,-11],[3,-1],[61,-6],[12,-7],[7,-2],[5,3],[-8,6],[5,4],[56,12],[8,9],[4,1],[9,0],[-9,3],[-20,0],[-9,5],[2,3],[3,1],[7,-1],[-4,2],[-7,1],[-3,3],[5,3],[1,0],[-9,4],[-19,-3],[-9,5],[3,1],[4,2],[2,2],[-6,5],[-15,1],[-6,6],[5,2],[28,-4],[3,2],[2,2],[3,7],[2,2],[-9,6],[-60,-1],[-7,7],[4,3],[-1,5],[-4,8],[-1,4],[34,1],[54,25],[-18,1],[-9,4],[-14,15],[-21,12],[-2,4],[1,5],[14,23],[22,15],[54,11],[46,-9],[46,-8],[9,-5],[70,-3],[70,-3],[5,-5],[0,3],[1,-2],[5,-4],[-2,-2],[0,-2],[-1,-2],[-1,-2],[65,0],[-5,7],[-60,14],[-61,13],[-16,-8],[-10,0],[-48,14],[-49,13],[-5,5],[-3,8],[6,7],[13,3],[7,4],[-6,5],[-28,6],[-14,8],[-28,5],[-12,8],[-7,2],[-11,1],[-2,0],[-7,2],[-1,2],[-1,2],[0,2],[-1,1],[-7,2],[-7,4],[-3,3],[-3,9],[-3,4],[-18,7],[-13,2],[-4,1],[-7,6],[-3,2],[-8,0],[-14,5],[-15,13],[-31,12],[-15,2],[-45,18],[-13,12],[-4,7],[3,3],[45,1],[44,1],[17,6],[13,-5],[9,-7],[78,-1],[79,-1],[79,0],[78,-1],[79,-1],[79,-1],[-16,-12],[-4,-8],[44,-16],[6,-4],[5,-8],[5,-13],[-10,-16],[-2,-8],[6,-7],[4,-3],[3,-3],[9,-14],[3,-2],[2,-1],[15,-1],[4,4],[6,18],[-5,9],[-9,7],[-5,6],[5,6],[-2,3],[6,13],[-3,7],[-14,9],[-9,12],[-8,3],[-12,7],[5,8],[8,2],[39,-2],[11,-6],[41,-9],[8,-4],[5,-9],[-1,-2],[70,-25],[20,-17],[17,-1],[48,-2],[3,-3],[-2,-5],[3,-5],[13,-11],[19,-9],[-4,-6],[-5,-4],[-4,-6],[1,-10],[4,-7],[21,-10],[0,-2],[-1,-4],[21,-5],[5,6],[2,9],[-1,6],[-3,4],[-4,3],[-8,3],[-3,5],[0,9],[3,6],[16,8],[-3,5],[-14,1],[-16,10],[-5,5],[-3,5],[0,5],[3,3],[3,4],[3,2],[9,3],[3,3],[2,3],[0,5],[-2,5],[-3,8],[-1,2],[0,2],[-1,3],[-1,2],[-5,4],[-60,16],[-42,-6],[-38,16],[-18,2],[-8,6],[-76,5],[-76,4],[-75,4],[-76,5],[-75,4],[-76,4],[-75,4],[-76,5],[-10,4],[-10,10],[-38,10],[0,-3],[32,-14],[0,-3],[-16,-9],[-54,7],[-54,7],[-8,-2],[2,-4],[1,-1],[2,-1],[0,-3],[-53,-4],[-9,3],[-10,0],[-9,4],[-66,14],[1,3],[1,3],[1,2],[1,1],[-7,4],[-29,7],[-15,8],[-7,1],[7,6],[70,-12],[70,-11],[-39,25],[-77,9],[3,7],[6,2],[21,-1],[2,3],[-1,10],[13,4],[51,0],[6,7],[6,8],[11,0],[11,-5],[19,-13],[54,-14],[54,-14],[7,-11],[-2,-3],[-3,-3],[-1,-2],[1,-3],[60,14],[66,-7],[66,-6],[66,-7],[5,-3],[0,1],[0,1],[0,1],[5,-2],[15,2],[0,2],[-72,12],[-71,11],[-71,12],[-71,11],[-2,3],[2,4],[-3,2],[-7,-1],[-3,1],[0,1],[0,2],[0,2],[-1,1],[-1,1],[-2,1],[-17,2],[-25,13],[-6,5],[1,5],[5,5],[6,3],[6,2],[5,-3],[-4,-1],[0,-4],[3,-4],[3,-2],[22,4],[12,11],[4,2],[3,-1],[6,-5],[57,-20],[7,3],[-3,3],[-2,3],[3,1],[3,2],[0,3],[-3,0],[-3,1],[-6,4],[7,8],[10,2],[72,-11],[73,-10],[-1,0],[4,-2],[5,-2],[6,1],[2,4],[2,3],[64,-8],[64,-7],[-5,4],[-60,13],[-61,13],[-61,13],[60,1],[60,1],[60,0],[0,4],[-24,-2],[-7,4],[17,3],[0,3],[-56,0],[0,3],[9,1],[3,2],[-1,2],[-1,1],[0,3],[48,3],[49,4],[25,-13],[5,-4],[7,-5],[52,6],[15,-8],[16,-3],[14,-8],[16,-1],[5,-9],[-28,-21],[-8,-13],[42,20],[50,-9],[39,-24],[17,-3],[45,-21],[8,-8],[68,-3],[67,-3],[68,-4],[70,-26],[-1,-1],[-2,-3],[-1,-2],[4,-12],[7,-9],[15,-9],[31,-9],[6,-9],[-2,-3],[1,-2],[1,-2],[1,-2],[3,-1],[4,0],[8,4],[-9,8],[2,4],[3,4],[12,9],[2,2],[1,4],[-27,-2],[-16,4],[-4,5],[-2,2],[0,2],[-1,4],[0,14],[-7,7],[-14,8],[1,0],[-5,4],[-11,1],[-19,10],[-4,5],[3,5],[5,4],[74,0],[74,1],[74,0],[74,1],[-7,3],[-15,1],[-30,9],[-63,1],[-63,1],[-63,1],[-7,4],[3,4],[75,8],[75,8],[75,8],[75,7],[9,5],[-4,3],[-59,-1],[-59,-2],[13,3],[4,3],[-10,5],[-52,4],[-14,-3],[-5,3],[10,3],[3,3],[-46,0],[-47,0],[-27,2],[-4,5],[-4,5],[-21,11],[5,5],[6,3],[12,0],[-1,4],[-2,4],[-1,2],[-2,2],[3,1],[5,2],[2,0],[0,2],[-5,1],[-6,2],[-6,5],[-4,7],[1,2],[3,6],[3,3],[7,6],[-10,6],[-11,8],[5,4],[7,2],[6,-1],[11,-5],[71,-14],[71,-14],[13,5],[-12,13],[-28,4],[-13,9],[6,4],[18,5],[-2,5],[-1,4],[-2,2],[-3,0],[8,7],[53,4],[63,-15],[62,-16],[8,-6],[7,-9],[3,-2],[41,-13],[8,4],[-32,9],[-1,5],[-5,3],[-10,1],[8,6],[27,2],[-8,7],[-53,13],[-7,6],[19,-1],[6,4],[-3,2],[-2,1],[-6,0],[5,8],[8,4],[80,0],[81,-1],[81,0],[44,15],[44,14],[4,-1],[8,-5],[3,-4],[3,-4],[2,-5],[2,-4],[3,-3],[4,-1],[4,1],[3,2],[3,4],[1,5],[1,4],[1,4],[3,4],[4,1],[6,1],[5,-2],[4,-4],[1,-5],[0,-5],[1,-4],[7,-4],[7,-7],[42,-19],[1,-3],[1,-4],[2,-2],[15,0],[8,3],[6,8],[-7,5],[-36,12],[-6,5],[-6,10],[1,1],[1,2],[10,6],[61,5],[62,5],[62,5],[61,5],[14,-6],[32,-3],[0,-3],[-4,0],[-8,-3],[-3,-3],[1,0],[2,-2],[-1,-2],[-2,-4],[44,8],[45,7],[19,-8],[71,-1],[71,-1],[18,7],[75,-9],[74,-10],[75,-9],[1,-2],[2,1],[2,-1],[2,0],[2,-2],[-4,-2],[-4,-4],[7,-9],[11,-5],[11,1],[8,4],[-3,7],[-1,2],[69,5],[12,-3],[7,-11],[-26,-6],[-16,5],[-9,0],[-16,-4],[7,-6],[52,-18],[67,6],[-12,1],[-24,8],[-12,0],[10,7],[74,-12],[74,-13],[74,-12],[73,-12],[74,-12],[74,-12],[-5,-8],[-6,-4],[-19,-4],[-13,-8],[-8,-3],[-9,-7],[-9,-3],[-75,-3],[-76,-3],[-75,-3],[-76,-3],[-76,-3],[-75,-3],[-76,-3],[-75,-3],[-76,-3],[-75,-3],[-26,-14],[-68,-6],[-69,-6],[-68,-6],[-13,6],[-17,3],[-17,9],[-80,12],[-81,11],[-7,-6],[23,-2],[17,-10],[17,7],[51,-14],[51,-14],[3,-4],[1,-5],[-2,-3],[-75,-7],[-16,-8],[-68,-6],[-68,-5],[-68,-6],[-68,-6],[-68,-6],[-68,-5],[-8,-6],[13,-5],[27,3],[12,-4],[-4,-3],[-16,-7],[-1,-4],[-1,-5],[-2,-4],[3,-3],[4,-2],[0,-3],[-13,-6],[-8,-7],[-3,-9],[4,-7],[9,-1],[16,1],[-4,6],[-4,4],[0,4],[5,6],[16,6],[5,6],[-6,5],[-2,3],[4,4],[54,21],[76,3],[75,3],[29,-14],[4,-7],[2,-11],[-2,-8],[-19,-11],[8,-1],[26,10],[6,7],[-1,8],[-6,16],[-1,6],[5,7],[17,9],[77,9],[13,7],[71,1],[71,2],[2,2],[54,0],[11,-5],[3,-2],[3,-4],[1,-4],[-2,-5],[0,-1],[1,-1],[1,-2],[4,-2],[4,-1],[8,3],[3,2],[1,3],[0,3],[1,5],[6,10],[7,4],[7,1],[11,7],[62,10],[61,11],[62,11],[25,12],[75,-4],[74,-5],[75,-4],[74,-4],[1,-10],[8,-5],[10,-1],[6,2],[26,12],[74,-1],[18,-8],[61,2],[62,1],[12,8],[71,11],[72,12],[72,11],[31,-5],[30,-18],[-17,-4],[-4,-4],[-1,-6],[1,-4],[11,-11],[19,-6],[3,-2],[2,-3],[0,-2],[1,-3],[-1,-3],[-1,-1],[-4,-1],[-17,-16],[-33,-18],[-3,-4],[-2,-4],[-1,-5],[4,-3],[-7,-9],[-71,-26],[-51,-3],[5,-4],[17,-2],[13,3],[17,-3],[11,8],[56,15],[56,16],[56,16],[37,-6],[31,8],[3,2],[7,3],[11,0],[9,-3],[6,-7],[-8,-1],[-15,-7],[-7,0],[3,-11],[15,-11],[5,-10],[-5,-7],[-13,-4],[-5,-3],[36,4],[6,4],[4,6],[-2,7],[4,5],[10,5],[45,6],[29,-6],[5,-5],[0,-9],[12,-5],[27,3],[11,-14],[4,-3],[15,5],[10,-1],[4,2],[3,5],[0,8],[13,-3],[27,-14],[34,-7],[11,-8],[12,-5],[22,-2],[5,-3],[11,-1],[4,-2],[1,-7],[26,-3],[24,-14],[22,-6],[3,-3],[0,-5],[-1,-3],[-5,-6],[-2,-4],[-5,-8],[-8,-4],[-14,-1],[-49,-25],[-49,-10],[-27,-14],[5,-4],[10,-5],[3,-6],[-5,-5],[-34,-17],[-76,-6],[-75,-7],[-76,-6],[-8,-6],[-81,-5],[-80,-5],[-81,-5],[-80,-5],[-81,-5],[-81,-5],[-80,-5],[-81,-4],[-80,-5],[-81,-5],[-80,-5],[-81,-5],[-3,2],[-6,8],[-4,2],[-47,1],[-28,11],[-55,2],[-55,3],[-56,3],[-26,2],[-8,-5],[73,-5],[72,-6],[72,-5],[14,-6],[18,-2],[10,-4],[2,-3],[5,-6],[2,-3],[11,-6],[-6,-6],[-60,-11],[-61,-11],[-61,-11],[-6,-3],[-4,0],[-2,-1],[-1,-2],[-3,-5],[-1,-2],[-9,-3],[-44,-1],[-45,-2],[-4,-5],[-6,-4],[-12,0],[-12,-7],[-15,4],[-78,-20],[-19,-13],[-17,-5],[-1,-2],[-2,-3],[-1,-6],[-1,-9],[0,-8],[1,-6],[3,-4],[9,1],[4,-3],[1,-5],[0,-6],[-3,-12],[9,-6],[9,-1],[17,4],[58,-1],[0,10],[3,8],[3,5],[28,24],[42,17],[71,7],[71,6],[17,7],[17,0],[17,9],[61,7],[8,5],[44,7],[2,-1],[3,-3],[2,-1],[29,3],[0,-14],[1,-6],[2,-2],[34,5],[3,4],[2,3],[1,3],[1,4],[1,4],[0,6],[0,2],[1,1],[2,1],[5,0],[33,13],[41,0],[19,6],[18,-3],[26,10],[10,0],[14,-4],[9,3],[41,-2],[20,13],[9,3],[73,-5],[72,-4],[73,-5],[73,-4],[73,-5],[72,-4],[73,-5],[-2,-7],[-8,-11],[-3,-8],[7,-6],[5,-13],[2,-16],[-4,-15],[-3,-4],[-2,-3],[-6,-3],[-65,-17],[-65,-18],[-65,-17],[-66,-17],[-24,-18],[-23,-6],[-16,-8],[-3,-4],[4,1],[34,-7],[2,-2],[2,-4],[-1,-5],[-4,-8],[-2,-6],[4,-2],[6,-8],[4,-2],[6,0],[62,28],[63,28],[22,-2],[77,18],[77,19],[5,-1],[5,-3],[5,-1],[6,4],[7,8],[7,6],[44,14],[45,15],[47,-13],[11,2],[5,4],[3,5],[5,15],[3,7],[-3,2],[1,6],[-3,10],[1,7],[-2,1],[-2,3],[-1,5],[0,3],[3,3],[9,5],[4,8],[-1,6],[-7,13],[13,11],[1,3],[0,3],[0,2],[5,5],[6,1],[12,-1],[-1,-2],[-4,-4],[-1,-2],[6,1],[5,2],[16,13],[64,4],[63,5],[64,4],[63,5],[10,-3],[6,-5],[27,-37],[5,-8],[4,-10],[2,-9],[0,-5],[-1,-4],[-4,-12],[-1,-2],[1,-6],[1,-3],[2,-3],[2,-3],[1,-3],[1,-8],[3,-10],[0,-2],[-1,-2],[0,-7],[-2,-6],[-6,-3],[-1,-5],[-1,-8],[-2,-9],[-3,-8],[-5,-4],[1,-3],[-2,-6],[-6,-20],[-7,-15],[-3,-9],[-45,-43],[-45,-44],[-39,-13],[-4,-4],[-2,0],[0,-5],[-1,-16],[-2,0],[-7,-4],[-5,-2],[-9,0],[-3,-1],[-1,-3],[-1,-4],[-1,-5],[0,-5],[1,-5],[-28,-11],[-19,-1],[-2,-2],[-1,-4],[0,-5],[0,-4],[-1,-2],[-2,-2],[-11,-4],[-72,-60],[-4,-2],[-7,0],[-14,-9],[-2,-3],[1,-5],[2,-3],[5,-5],[2,-4],[0,-6],[-2,-5],[-7,-9],[-6,-4],[-9,-8],[-23,-9],[2,-4],[4,-2],[2,-3],[-1,-6],[-2,-3],[-22,-10],[-11,-1],[-6,-2],[-22,-17],[-6,-8],[-2,-7],[2,-6],[4,-1],[50,27],[50,27],[16,2],[9,4],[2,10],[-5,4],[-2,1],[3,9],[7,4],[20,9],[4,4],[0,6],[-2,5],[-9,9],[1,3],[37,22],[71,13],[3,2],[2,3],[2,4],[4,13],[1,2],[5,2],[19,-6],[9,0],[12,4],[1,2],[2,4],[1,8],[1,4],[5,6],[15,4],[55,34],[12,11],[4,2],[67,15],[15,18],[17,5],[5,6],[1,4],[1,11],[1,5],[2,3],[68,39],[68,38],[3,5],[-35,14],[2,4],[4,3],[22,7],[-11,11],[2,5],[5,4],[31,11],[11,-2],[0,-14],[0,-4],[1,-5],[1,-2],[1,0],[39,2],[11,-6],[4,-1],[0,-3],[5,-1],[17,6],[11,1],[10,-3],[5,-3],[2,-1],[-4,-5],[-39,-18],[-5,-6],[-2,-3],[0,-3],[-1,-4],[-1,-5],[0,-3],[-2,-4],[-1,-3],[-1,-8],[-1,-2],[-6,-12],[-15,-10],[-7,-11],[8,-2],[65,27],[65,27],[21,1],[9,-2],[8,-8],[9,-2],[25,3],[38,-15],[3,-3],[7,-11],[10,-4],[3,-1],[3,3],[-1,6],[-6,18],[1,0],[38,-15],[3,-3],[7,-13],[2,-1],[6,-1],[7,2],[12,7],[40,2],[-1,5],[-2,3],[-5,6],[-1,3],[-1,3],[-1,4],[-1,4],[4,1],[29,0],[4,4],[5,6],[6,4],[14,3],[4,5],[-4,6],[-6,2],[-19,-1],[-7,4],[-2,0],[0,1],[3,7],[1,1],[3,3],[4,1],[7,-1],[3,0],[3,2],[7,10],[3,2],[17,3],[25,-6],[16,3],[3,3],[1,4],[-2,3],[-12,15],[4,3],[2,6],[2,9],[1,10],[54,2],[1,8],[1,4],[2,1],[30,-6],[16,4],[3,4],[-1,4],[1,5],[1,5],[2,2],[2,1],[41,2],[41,1],[8,-3],[0,-1],[-1,-1],[-2,-1],[8,-4],[70,0],[69,-1],[70,0],[70,-20],[70,-21],[22,4],[19,-4],[17,-9],[21,1],[44,-12],[43,-12],[26,-17],[20,-20],[2,-3],[4,-11],[2,-3],[3,-2],[40,-6],[9,-6],[-3,-6],[-39,-31],[-43,-12],[-43,-12],[-3,-2],[-2,-3],[-3,-7],[-2,-3],[-3,-3],[-6,-3],[-24,-17],[-10,-3],[-6,-4],[1,-8],[-1,-5],[-1,-2],[-49,-21],[-49,-21],[-3,0],[-5,2],[-2,0],[-14,-12],[-3,-4],[-2,-5],[-3,-6],[-1,-2],[-2,-1],[-53,-8],[-64,8],[-77,-13],[10,-9],[47,-23],[11,-11],[-4,-19],[-7,-9],[-15,-15],[-53,-16],[-17,2],[-48,-8],[-48,-7],[-3,-2],[-4,-6],[-6,-15],[-3,-5],[-68,-3],[-67,-2],[-18,8],[-57,2],[-57,1],[-4,2],[-13,17],[-6,4],[-5,2],[-37,-3],[3,-15],[1,-11],[-3,-5],[-26,3],[-35,-8],[-37,-22],[-42,-8],[-44,6],[-58,25],[-35,1],[-11,6],[-38,7],[-61,-21],[-61,-21],[-48,0],[-47,-1],[-6,-2],[3,-5],[4,-3],[64,0],[5,-2],[3,-4],[1,-6],[0,-7],[0,-14],[9,3],[12,12],[60,29],[59,29],[76,-19],[9,-6],[20,-1],[27,-13],[45,-8],[45,-7],[10,-6],[61,4],[60,5],[67,30],[6,-1],[6,-4],[20,-19],[41,-20],[53,-9],[53,-9],[6,-7],[-5,-6],[-78,-48],[-3,0],[-2,1],[-2,2],[-6,11],[-2,1],[-2,0],[-3,-3],[-2,-5],[0,-5],[1,-5],[3,-3],[6,-4],[2,-2],[-7,-8],[-1,-2],[-1,-1],[-10,-7],[-65,-7],[-7,-5],[-37,-3],[-22,13],[-5,1],[-48,-12],[-47,-12],[-64,9],[-65,8],[-17,9],[-41,6],[-25,13],[-48,-3],[-26,-16],[-15,-25],[-8,-7],[-64,-17],[0,-3],[30,-4],[4,-2],[-4,-6],[-11,-12],[-4,-2],[-18,-1],[-6,-4],[13,-5],[12,-9],[-45,-44],[-6,-9],[-3,-4],[-2,-3],[0,-3],[11,-9],[39,2],[2,-1],[1,-3],[2,-4],[0,-5],[1,-4],[0,-4],[1,-4],[4,-6],[8,-1],[3,-4],[1,-5],[-1,-6],[0,-5],[0,-5],[1,-4],[2,0],[4,3],[14,-1],[3,3],[2,4],[2,8],[1,4],[2,2],[48,17],[4,0],[3,-2],[12,-10],[18,-8],[9,-7],[0,-6],[-2,-1],[-2,-3],[-3,-8],[-2,-2],[-20,-16],[1,-7],[2,-7],[2,-7],[0,-9],[-2,-3],[-7,-10],[-8,-7],[-2,-3],[-2,-7],[-3,-17],[-2,-7],[-9,-16],[-1,-5],[2,-3],[9,-4],[2,-3],[3,-4],[1,-5],[1,-6],[-1,-3],[-4,-10],[-3,-11],[-1,-4],[-7,-14],[-4,-5],[-2,-4],[-1,-5],[2,2],[6,9],[9,12],[11,19],[5,3],[9,-1],[4,2],[3,7],[-1,3],[-1,7],[0,3],[0,3],[0,3],[0,2],[1,3],[1,5],[2,4],[2,3],[3,-1],[0,-3],[2,-3],[2,-4],[1,-5],[1,-6],[0,-11],[-1,-3],[0,-3],[-1,-3],[-1,-4],[0,-4],[2,1],[4,5],[2,2],[2,0],[2,-1],[3,-1],[2,-2],[0,-2],[0,-3],[0,-1],[32,-3],[11,-10],[-1,-5],[-2,-2],[-10,2],[-4,-2],[-2,-2],[-2,-4],[0,-6],[1,-5],[5,-9],[1,-4],[-6,1],[-12,-3],[-6,3],[-5,7],[-3,1],[-3,0],[-3,-3],[-1,-6],[-2,-13],[-3,-9],[-5,0],[-10,7],[-5,2],[-5,-3],[-9,-10],[-5,-1],[-8,12],[-5,0],[-3,-3],[-5,-9],[-3,-4],[-2,-1],[-11,2],[-6,-1],[-3,-2],[-2,-2],[-6,-8],[-12,-6],[-5,-6],[0,-10],[3,-6],[17,-21],[3,-6],[0,-7],[-2,-7],[-3,-5],[-14,-14],[-7,-3],[-51,-1],[-15,5],[-12,8],[-5,1],[-32,-11],[-2,-2],[7,-8],[4,-6],[2,-8],[-19,-4],[-43,6],[-3,-1],[-2,-5],[10,-8],[10,-13],[3,-1],[-4,-4],[-38,-14],[-15,-12],[-3,-4],[52,-3],[4,-2],[4,-6],[-1,-6],[-4,-7],[-3,-5],[-26,-25],[-2,-6],[-2,-7],[0,-8],[-2,-8],[-4,-9],[-19,-23],[-11,-25],[-1,-3],[0,-4],[0,-6],[2,-6],[4,-10],[4,-20],[-4,-10],[-16,-6],[2,-5],[4,-8],[2,-7],[-1,-9],[-4,-4],[-7,-3],[-39,-26],[-3,-4],[1,-4],[13,-13],[2,-6],[1,-9],[-2,-5],[-4,-5],[-7,-5],[-25,-10],[-4,0],[-2,-1],[-1,-3],[1,-3],[2,-7],[1,-3],[-1,-2],[-7,-11],[-2,-4],[-2,-9],[-1,-4],[-4,-6],[-4,-4],[-4,-6],[-3,-9],[52,-9],[25,6],[2,0],[6,-4],[-2,-4],[-23,-39],[-1,-5],[2,0],[3,0],[2,2],[2,2],[5,11],[27,33],[10,5],[-7,1],[-7,5],[-5,10],[1,15],[4,11],[67,82],[4,1],[29,-1],[59,-33],[59,-33],[11,-10],[49,-12],[49,-12],[11,-8],[6,-2],[10,-8],[2,0],[6,-1],[3,-2],[2,-2],[7,-11],[8,-8],[5,-6],[2,-1],[-3,-7],[-7,-2],[-12,1],[-3,-2],[-20,-21],[-17,-7],[-4,2],[-5,5],[-49,32],[-49,31],[-12,4],[-27,-5],[-13,-12],[-2,-1],[-76,-2],[2,-10],[6,-6],[69,-26],[11,-9],[0,-1],[0,-2],[0,-1],[0,-2],[-10,-1],[-11,3],[-10,-2],[-2,-2],[3,-1],[3,-4],[1,-5],[-2,-5],[-3,-1],[-11,1],[-45,21],[-13,1],[-5,-3],[1,-6],[3,-2],[7,-3],[6,-4],[50,-14],[50,-14],[4,-2],[2,-5],[-2,-3],[-46,-6],[-5,-3],[-1,-5],[4,-2],[40,6],[41,-7],[40,-6],[13,-14],[3,-2],[22,-4],[5,-5],[2,-8],[1,-22],[8,3],[2,0],[18,-12],[3,0],[13,1],[8,-1],[5,-2],[3,-1],[2,2],[-3,7],[-2,3],[-2,2],[0,3],[0,1],[1,2],[0,2],[1,2],[0,15],[2,12],[0,6],[7,1],[33,-12],[34,1],[10,-2],[4,-3],[5,-5],[7,-12],[3,-3],[14,-6],[6,-5],[4,-12],[5,-22],[1,-11],[0,-12],[-1,-24],[0,-9],[1,-20],[0,-6],[-1,-5],[-5,-11],[-2,-6],[-4,-12],[-2,-6],[-5,-7],[-13,-4],[-5,-10],[-1,-5],[0,-6],[-1,-5],[-2,-3],[-2,0],[-4,3],[-6,8],[-4,4],[-2,0],[-2,-4],[0,-6],[0,-8],[1,-13],[-8,9],[-8,11],[-4,4],[-9,2],[-4,4],[-4,5],[-3,2],[-15,6],[-2,2],[-8,10],[-5,2],[-53,-3],[-9,3],[-3,3],[-7,12],[-2,1],[-10,-2],[-11,2],[-40,20],[-53,3],[-3,-1],[-6,-3],[-6,-2],[-32,12],[-13,-2],[2,-5],[0,-4],[-2,-2],[-25,-11],[-1,-2],[-4,-4],[-2,-2],[-2,1],[-13,6],[-25,7],[-51,-7],[-25,7],[-36,-5],[2,-6],[6,-1],[15,0],[24,-6],[60,6],[9,-2],[14,-10],[5,-1],[15,3],[4,-3],[-27,-7],[-16,-14],[-4,-2],[-4,-1],[-3,1],[-5,5],[-6,1],[-1,1],[1,1],[-12,2],[-5,-2],[-5,-6],[5,-3],[10,1],[4,-3],[-17,-6],[-3,-4],[-1,-5],[-27,-21],[-28,-5],[5,-6],[6,-5],[-4,-5],[-6,0],[-11,5],[-15,16],[-1,2],[-3,7],[-1,3],[-7,7],[-5,10],[-4,4],[-19,9],[-4,4],[-10,16],[-3,4],[-4,2],[-11,1],[-33,-10],[0,-3],[6,-1],[6,-3],[2,-3],[0,-2],[0,-3],[0,-3],[3,-5],[6,-7],[3,-5],[-8,-5],[-28,5],[-19,-3],[-9,-7],[-7,-13],[4,-7],[4,-4],[5,-2],[24,-1],[5,-4],[1,-3],[2,-2],[1,-2],[-3,-3],[-5,-4],[-1,-2],[1,-6],[9,-9],[3,-5],[-1,-5],[2,-3],[5,-3],[11,-11],[2,-1],[2,0],[3,1],[1,1],[0,4],[-1,2],[-2,1],[-4,7],[0,3],[2,4],[-1,1],[-1,1],[-1,3],[-1,3],[6,2],[6,5],[8,11],[5,4],[6,2],[7,0],[6,-4],[-3,-2],[-1,0],[4,-6],[21,2],[11,-5],[10,-9],[-4,-5],[-21,-4],[-7,-4],[-13,-1],[5,-5],[8,-5],[8,0],[3,7],[9,7],[12,-1],[22,-15],[-55,-18],[-4,-7],[33,4],[12,8],[6,2],[7,-4],[-3,-9],[-8,-8],[-7,-5],[-58,0],[-13,5],[-6,5],[-6,9],[-7,7],[-15,0],[3,-5],[11,-9],[-5,-7],[-7,-1],[-13,2],[15,-11],[5,-1],[16,5],[15,-10],[47,7],[47,7],[4,-1],[1,-2],[-1,-4],[-3,-5],[5,-8],[1,-5],[-9,-12],[-3,-9],[-3,-9],[-1,-9],[-3,-8],[-2,-5],[-1,-3],[1,-1],[7,-6],[17,-6],[17,9],[6,0],[0,4],[-2,0],[-6,2],[3,9],[6,5],[7,1],[5,-3],[-3,-3],[-10,-3],[8,-4],[38,9],[6,-3],[27,-24],[20,-5],[4,-3],[12,-14],[4,-2],[10,0],[4,-1],[5,-5],[-5,-3],[-14,-3],[3,-5],[27,8],[8,-3],[3,0],[0,3],[-6,1],[-16,11],[-13,3],[-2,1],[-3,6],[-2,1],[-31,14],[-3,4],[-1,2],[-1,4],[-1,4],[-12,-3],[-5,1],[-8,12],[-4,3],[4,7],[6,2],[21,-4],[33,-20],[17,-5],[16,-10],[29,2],[13,7],[47,5],[15,-5],[14,-17],[10,-25],[5,-4],[-1,-3],[-8,-22],[1,-2],[0,-4],[-6,-2],[-12,4],[-27,-1],[-45,-30],[-70,-1],[-70,-1],[-70,-1],[-7,-4],[-7,-2],[-8,1],[-17,8],[-5,5],[-9,16],[-5,2],[-5,-3],[1,-3],[0,-2],[0,-2],[1,-1],[-5,-8],[-2,-4],[3,-2],[10,-1],[-1,0],[2,-1],[1,-2],[1,-3],[1,-2],[3,-3],[3,0],[44,1],[44,2],[59,-1],[59,0],[13,-6],[8,-1],[18,-10],[65,5],[30,-19],[17,-26],[2,-4],[10,-16],[12,-10],[24,-10],[-4,-3],[-18,6],[-11,-2],[-4,-4],[2,-9],[-8,-8],[3,-7],[15,-10],[-3,-8],[3,-6],[10,-9],[3,-6],[4,-6],[2,-8],[1,-9],[1,-4],[0,-4],[0,-11],[0,-5],[3,-11],[1,-5],[1,-6],[0,-3],[-1,-3],[-1,-4],[-2,-5],[0,-11],[0,-6],[-4,-23],[-2,-11],[-4,-12],[-6,-11],[-4,-4],[-7,-5],[-7,-12],[-2,-2],[-47,3],[-5,3],[-9,9],[-6,3],[0,2],[0,3],[0,3],[-2,2],[-3,1],[-1,2],[-2,3],[4,3],[1,3],[0,4],[0,3],[2,4],[3,3],[7,3],[-4,6],[-4,3],[-11,4],[-13,11],[-4,2],[-23,-2],[-15,-10],[-43,-8],[-8,2],[-22,20],[-28,10],[-22,15],[-6,7],[-3,14],[-3,9],[-8,8],[-62,40],[-49,17],[-48,16],[-3,-4],[1,-4],[3,-3],[54,-25],[54,-26],[30,-27],[-6,-4],[-77,14],[-78,14],[-10,8],[-1,2],[0,2],[0,2],[0,2],[-1,3],[-3,0],[-2,-4],[0,-5],[1,-5],[6,-7],[56,-11],[56,-11],[55,-11],[5,-3],[2,-4],[6,-14],[6,-8],[55,-20],[5,-8],[9,-7],[6,-9],[3,-3],[30,-11],[14,-11],[7,-23],[-28,-7],[-50,7],[-12,-8],[-18,-1],[-64,-49],[-29,-8],[-2,1],[-6,4],[-5,3],[-1,2],[-2,2],[-1,3],[-1,3],[0,6],[-3,10],[-6,7],[-68,36],[-15,0],[4,-6],[11,-4],[10,-7],[23,-9],[32,-22],[-2,-8],[-3,-3],[-7,-4],[3,-3],[11,-3],[3,-1],[7,-10],[16,-8],[17,-1],[25,10],[64,46],[14,-1],[15,-7],[16,-2],[18,4],[8,-1],[9,-6],[-1,0],[-2,-2],[0,-13],[-12,-18],[-1,-8],[4,-9],[2,-5],[1,-5],[0,-8],[-2,-4],[-5,-7],[-5,-3],[-1,-3],[-1,-7],[1,-4],[2,-4],[4,-6],[11,-14],[6,-9],[1,-7],[-2,-3],[-6,-4],[-5,-8],[-16,-14],[-50,3],[-3,-3],[3,-5],[9,-3],[56,0],[4,2],[5,6],[8,1],[12,7],[27,-6],[24,3],[8,-1],[14,-5],[2,-3],[5,-7],[2,-2],[1,0],[4,-5],[2,0],[6,2],[7,0],[3,-3],[5,-11],[7,-3],[13,0],[2,1],[10,13],[12,9],[6,3],[14,14],[7,3],[8,-2],[7,-6],[7,-9],[-7,-15],[0,-7],[3,-7],[-4,-3],[-11,-5],[4,-2],[7,1],[6,0],[3,-8],[-1,-1],[-2,-2],[-1,0],[3,-4],[2,-2],[6,0],[15,-5],[13,-1],[6,-2],[5,-6],[-5,-4],[-6,-7],[-5,-9],[-2,-9],[-3,0],[-7,-2],[-3,-2],[-2,-4],[1,-2],[1,-3],[0,-4],[-1,-7],[-2,-4],[-26,-27],[-2,-2],[-1,-5],[-1,-1],[-41,-11],[-47,8],[-46,9],[-4,7],[0,3],[1,2],[0,1],[0,4],[-2,4],[-1,2],[-1,4],[1,9],[-1,4],[-2,4],[-5,5],[-4,8],[-4,4],[-4,8],[-2,2],[-3,-1],[-8,-4],[-2,0],[-1,1],[-1,6],[-1,1],[-5,1],[-9,-3],[-5,0],[-11,5],[-28,-5],[-69,9],[-39,-6],[-12,-5],[-10,0],[-29,13],[-2,4],[-1,4],[-2,9],[-2,5],[-4,7],[-28,22],[-5,1],[-6,-3],[6,-8],[23,-18],[1,-2],[1,-2],[2,-7],[6,-13],[11,-12],[4,-1],[2,-2],[1,-5],[-1,-5],[-3,-4],[-2,-4],[-2,-6],[-2,-3],[-22,-17],[-14,-6],[-26,1],[-15,-8],[-22,7],[-4,-1],[-1,-2],[1,-2],[8,-2],[11,-7],[29,5],[16,-2],[5,-18],[-4,-8],[-6,-8],[-7,-5],[-8,-3],[-8,-6],[-4,-1],[-6,-1],[-3,-1],[-3,-4],[5,-3],[11,6],[5,0],[2,-3],[3,-5],[4,-10],[-4,-6],[-8,-5],[-17,-3],[-14,3],[-10,-6],[-1,-3],[2,-4],[3,-2],[18,-3],[10,-8],[29,-6],[-2,0],[5,0],[9,-5],[7,-6],[0,-2],[-1,-3],[-2,-7],[2,-1],[1,-3],[0,-3],[-2,-4],[6,-6],[11,-5],[6,-6],[-2,-3],[9,-20],[-4,-11],[0,-2],[0,-3],[1,-5],[0,-3],[-1,-2],[-2,-3],[0,-3],[0,-5],[0,-5],[1,-5],[1,-2],[1,-2],[0,-5],[0,-9],[-1,-4],[-1,-4],[0,-3],[1,-5],[2,-2],[4,5],[2,-1],[3,-2],[4,5],[7,12],[-1,8],[-2,5],[-6,10],[1,1],[1,1],[0,1],[-1,2],[0,3],[-1,4],[0,4],[0,2],[-1,3],[0,2],[0,2],[2,4],[0,2],[0,3],[-1,3],[-1,4],[1,4],[0,3],[-1,4],[-3,4],[-1,4],[-1,4],[-1,3],[-2,2],[-3,1],[-6,1],[-2,3],[-1,4],[3,6],[0,4],[-2,3],[-1,2],[-4,2],[0,2],[1,1],[0,2],[1,1],[-1,10],[6,8],[14,8],[31,2],[73,-36],[73,-36],[53,4],[7,-2],[4,-2],[3,-5],[1,-4],[0,-5],[1,-4],[3,-1],[-2,-4],[-2,-2],[-1,-2],[-2,-10],[-1,-3],[-2,-2],[-16,-1],[-7,-4],[-5,-7],[2,-4],[2,-2],[2,-2],[3,0],[0,-3],[-10,1],[-5,-2],[-2,-8],[1,-3],[4,-7],[1,-2],[2,-8],[1,-3],[1,-2],[1,-2],[0,-4],[-1,-3],[-1,-2],[-1,-2],[0,-4],[0,-5],[-6,-11],[0,-7],[5,-5],[12,1],[5,-4],[0,-8],[-3,-9],[-4,-8],[-4,-5],[-15,-7],[-60,2],[-60,2],[-28,12],[-14,2],[-13,-14],[2,0],[1,-1],[5,-6],[3,-7],[1,-7],[-4,-5],[-4,-2],[-9,1],[-8,-5],[-12,-3],[-30,-17],[-23,-23],[-17,-10],[-17,-2],[-52,17],[-52,16],[-9,6],[-14,3],[-3,2],[-17,19],[-37,15],[-6,5],[-10,13],[-6,5],[-38,23],[-12,13],[-4,3],[-8,2],[-3,4],[-2,4],[-3,10],[-2,8],[1,15],[-2,4],[3,10],[5,2],[11,-3],[24,2],[13,-5],[19,3],[9,-3],[14,-9],[6,-7],[8,-6],[35,-11],[46,-30],[30,-5],[7,6],[20,4],[20,15],[32,8],[-6,2],[-19,-2],[-8,-5],[-10,0],[-28,-18],[-31,-2],[-11,5],[-11,16],[-33,16],[-5,0],[1,0],[-63,34],[-44,1],[-6,2],[-6,5],[-17,24],[-4,3],[-5,0],[-18,-7],[-13,-10],[-2,0],[-10,2],[-3,-2],[2,-11],[-3,-4],[-5,-3],[-5,-4],[-4,-6],[-2,-7],[-4,-17],[16,-40],[-4,-6],[-4,-2],[-5,0],[-79,30],[-7,7],[-2,7],[3,8],[2,8],[-1,8],[-4,6],[-29,14],[-27,29],[-3,1],[-8,-1],[-2,0],[-1,2],[-1,1],[0,3],[-1,2],[-1,1],[-9,28],[-3,3],[-3,3],[-13,6],[-8,8],[-3,1],[-3,-1],[-2,-3],[-3,-4],[0,-4],[2,-5],[22,-21],[4,-9],[-2,-8],[4,-7],[15,-10],[12,-13],[15,-5],[33,-20],[0,-2],[0,-8],[0,-4],[-2,-6],[-1,-2],[-1,-3],[3,-6],[6,-9],[8,-6],[26,-8],[1,-1],[1,-4],[23,-10],[2,-3],[-1,-7],[-2,-4],[-3,-2],[-46,-4],[-47,-4],[-33,-30],[3,-3],[6,3],[3,-3],[-3,-5],[0,-5],[1,-4],[0,-3],[-3,-4],[-19,-8],[-22,-23],[-9,-5],[-19,-2],[-14,-5],[-30,-1],[-4,3],[-24,29],[-13,10],[-13,3],[-4,-2],[-6,-6],[-3,-1],[-13,-1],[-29,8],[-56,43],[-10,18],[-5,4],[-12,0],[-2,-1],[-8,-10],[-6,-3],[-3,-3],[-1,-6],[13,2],[6,-2],[9,-14],[25,-23],[35,-12],[-1,0],[3,-1],[8,-7],[4,-1],[11,1],[51,-11],[7,-7],[1,-11],[-2,-2],[-21,-2],[-7,-5],[-2,-3],[-2,-3],[-1,-4],[0,-6],[-2,-2],[-7,-6],[-7,-10],[-7,0],[-18,7],[-8,6],[-13,3],[-8,5],[-7,2],[-18,-3],[-5,3],[-27,-12],[-34,2],[-10,-3],[-9,-11],[8,-4],[33,4],[6,-3],[5,-6],[-1,-13],[1,-3],[-1,-3],[7,-22],[0,-4],[-1,-6],[-2,-3],[-9,-11],[-11,-4],[-3,-5],[7,-4],[7,5],[6,7],[12,6],[2,5],[-1,20],[1,4],[1,4],[2,7],[1,4],[-1,4],[-2,3],[-1,3],[3,7],[6,5],[18,9],[72,-19],[9,0],[8,7],[18,27],[7,6],[73,2],[18,-5],[27,-22],[54,-11],[54,-12],[1,-3],[0,-5],[1,-5],[2,-3],[7,-8],[-3,-12],[-6,-5],[-6,-4],[-9,-15],[-6,-4],[-15,-5],[-3,-2],[-2,-3],[-2,-3],[-2,-3],[-61,4],[-7,-2],[-6,-8],[-5,-7],[-11,-13],[-19,-14],[-15,-6],[-15,-2],[-15,3],[-54,32],[-29,4],[-52,-19],[-8,0],[-20,14],[-7,2],[-6,-1],[-5,-6],[4,-6],[34,-12],[4,3],[4,-1],[25,8],[40,2],[28,-17],[4,1],[6,-2],[11,-8],[-23,-10],[-21,-3],[-7,-5],[-8,-4],[-3,-1],[10,-5],[60,17],[7,-6],[-3,-9],[-6,-25],[-4,-9],[-11,-12],[-4,-8],[1,-1],[6,1],[5,3],[28,43],[4,10],[5,5],[13,-4],[34,11],[6,6],[23,16],[9,11],[7,4],[14,4],[7,-3],[15,-12],[7,-2],[14,5],[4,-2],[1,-3],[2,-9],[1,-3],[1,-2],[2,-3],[6,-3],[14,0],[2,-1],[6,-7],[3,-1],[24,-3],[3,-1],[6,-7],[12,-7],[4,-5],[-6,-8],[-2,-4],[2,-7],[1,-4],[2,-4],[0,-4],[-2,-3],[0,-3],[3,0],[2,-1],[3,-2],[2,-3],[-2,-5],[-1,-2],[-1,-2],[3,-3],[8,5],[3,-2],[-1,-8],[-3,-3],[-3,-1],[-9,-6],[-11,-4],[-19,-13],[-40,-13],[-63,-3],[-63,-3],[0,-3],[5,-3],[23,-7],[51,6],[13,-4],[5,-1],[4,-1],[-2,-7],[-21,-42],[-5,-6],[-5,-9],[-1,-4],[0,-4],[0,-7],[2,-6],[3,-11],[-2,-5],[-5,-6],[-3,-4],[3,-1],[4,0],[4,2],[7,5],[2,3],[1,4],[0,7],[0,5],[-1,3],[-1,3],[1,7],[2,5],[2,4],[2,4],[-1,7],[5,8],[13,15],[9,15],[4,4],[22,7],[4,0],[2,3],[14,5],[12,13],[3,2],[4,-2],[7,-8],[4,-2],[2,1],[7,5],[2,0],[7,-3],[13,3],[5,-3],[11,-19],[17,-16],[11,-5],[6,3],[-1,1],[-3,5],[5,-2],[26,-25],[4,-2],[17,-1],[2,-1],[5,-4],[5,-1],[5,1],[3,-2],[2,-10],[-3,-1],[-3,0],[-3,1],[-2,3],[-1,-2],[-1,-1],[-1,0],[1,-3],[2,-2],[13,0],[3,2],[-1,6],[3,3],[3,-3],[3,-5],[3,-3],[-1,-4],[-1,-2],[1,-9],[-15,-20],[-2,-8],[2,-2],[3,1],[5,3],[11,12],[5,3],[6,0],[4,-2],[3,-2],[76,-33],[4,-4],[-3,-7],[-5,-4],[-5,-2],[-5,-4],[9,-7],[4,-2],[5,2],[4,4],[4,2],[5,-2],[12,-7],[40,-15],[11,-9],[10,-5],[5,-4],[1,-2]],[[3260,3638],[3,-7],[4,2],[-1,3],[3,-1],[3,-3],[2,-5],[1,-7],[-1,-6],[-4,-4],[-4,-4],[-6,-9],[-5,-2],[-18,-1],[-4,1],[0,6],[-2,1],[-5,2],[-6,5],[-2,1],[0,6],[-1,5],[-2,3],[5,1],[10,6],[6,2],[5,-3],[5,-4],[5,-3],[5,4],[-3,3],[-7,8],[-3,5],[0,5],[4,2],[6,0],[4,-4],[3,-8]],[[3439,3697],[1,-1],[-4,1],[-4,-1],[4,3],[3,-2]],[[3408,3687],[-10,-8],[-3,0],[-3,1],[-3,5],[-3,2],[-6,2],[-20,-4],[-5,2],[-1,-1],[-5,-6],[-2,-1],[-1,2],[-1,4],[0,5],[0,3],[4,8],[5,2],[11,-1],[5,2],[10,8],[5,1],[19,-4],[4,-4],[-3,-4],[-8,-3],[-2,-5],[1,-2],[2,-3],[2,-1],[2,0],[0,3],[2,3],[12,5],[3,4],[2,7],[2,4],[19,-4],[3,-2],[0,-2],[-14,-1],[-5,-2],[1,-3],[1,-2],[1,-1],[-21,-9]],[[3390,3736],[-2,0],[-2,0],[-6,-2],[-1,-2],[-5,-9],[-4,-5],[-5,-6],[-4,-4],[-4,4],[-4,6],[-3,2],[-4,0],[-11,-8],[-24,-7],[-3,-2],[-3,-2],[-11,4],[-32,-9],[-20,-12],[-10,-2],[4,15],[5,9],[6,6],[33,5],[9,5],[-2,3],[-11,-3],[0,3],[35,11],[-1,0],[-1,2],[0,2],[-1,2],[20,0],[0,-1],[-1,-1],[-1,-2],[0,-2],[46,3],[2,1],[3,4],[1,-1],[4,-3],[3,-1],[8,0],[-2,-2],[-1,-1]],[[3575,4248],[12,-10],[5,-2],[10,3],[5,0],[5,-5],[-2,-3],[-2,-6],[19,2],[3,-6],[1,-6],[0,-3],[-1,-3],[-17,-19],[-3,-6],[-3,-2],[-3,0],[-5,5],[-3,0],[-2,-2],[-8,-12],[-4,-5],[-2,-5],[2,-9],[0,-5],[0,-5],[-1,-4],[-3,-9],[0,-4],[0,-6],[5,-17],[1,-8],[-5,-3],[-3,-1],[-8,-4],[-11,-11],[-3,-2],[-5,1],[-8,4],[-5,7],[1,10],[0,1],[-8,18],[-2,8],[-4,21],[-1,5],[-6,3],[-3,3],[0,4],[4,8],[2,3],[1,2],[9,-1],[4,3],[-1,10],[9,14],[5,6],[10,5],[15,16],[4,8],[-7,-2],[-6,-3],[-13,-10],[-8,-4],[-24,4],[7,7],[18,8],[4,8],[-2,0],[-1,0],[-2,1],[-1,2],[4,3],[10,-1],[8,3],[11,0],[2,-2]],[[3296,4251],[15,-6],[18,-14],[14,-4],[20,-12],[17,-2],[-2,0],[36,-14],[10,-12],[4,-8],[0,-6],[-1,-5],[-7,-17],[-1,-1],[-2,0],[-6,-3],[-2,-3],[22,-14],[6,3],[1,1],[2,-3],[0,-5],[-3,-4],[-5,-5],[-3,-8],[-20,-29],[-4,-3],[-7,-6],[-7,-9],[-22,-13],[-11,0],[-77,-40],[-11,0],[-3,-3],[-5,3],[-44,-16],[-13,-11],[-37,-15],[-6,-7],[-4,0],[-2,2],[-5,7],[-3,2],[-15,-2],[-18,4],[-4,6],[-3,12],[-7,6],[-36,6],[-11,11],[-2,3],[0,5],[-1,0],[-5,5],[-1,2],[1,8],[2,3],[6,4],[-1,1],[-4,4],[4,3],[3,-1],[7,-4],[3,-2],[22,3],[34,-8],[19,6],[3,4],[2,-1],[3,-1],[2,-1],[35,-1],[5,3],[-27,3],[-7,6],[0,3],[2,3],[3,11],[1,5],[6,11],[6,8],[13,2],[7,3],[0,3],[-12,0],[-23,-7],[-5,-5],[-2,-2],[2,-9],[-4,-10],[-6,-8],[-4,-5],[-15,-7],[-7,0],[-7,4],[16,13],[5,7],[-5,4],[-29,-15],[-5,0],[-5,5],[5,9],[8,8],[7,8],[-1,10],[-3,4],[-4,4],[-5,2],[-3,0],[-2,-2],[0,-3],[0,-3],[1,-4],[1,-2],[-1,-3],[-1,-3],[-1,-1],[-22,-3],[-19,7],[-4,1],[-11,-4],[-64,12],[-6,3],[-9,9],[1,3],[1,6],[-7,2],[-9,5],[-8,8],[-5,11],[2,0],[1,1],[1,1],[1,1],[-2,6],[2,4],[12,8],[5,1],[4,-1],[6,-4],[2,3],[16,3],[4,-2],[3,-3],[6,-9],[4,-5],[14,-4],[9,-9],[4,-3],[4,3],[-18,20],[-9,4],[-2,4],[-2,3],[-6,8],[-2,1],[-30,7],[-15,12],[-4,19],[7,4],[3,1],[13,0],[-7,8],[-2,4],[-2,5],[-1,5],[0,5],[6,4],[7,5],[3,2],[17,2],[7,-7],[60,-18],[4,3],[-5,7],[-6,4],[-36,9],[-40,28],[-5,7],[-6,12],[0,2],[-2,37],[2,11],[4,7],[4,6],[4,7],[2,3],[15,4],[32,20],[20,5],[5,-3],[64,-11],[21,-13],[46,-7],[19,-10],[6,-6],[11,-1],[11,-12],[13,-9],[8,-10],[6,-4],[4,-8],[7,-15],[5,-9],[16,-20],[12,-20],[6,-8]],[[2983,4442],[-2,-3],[-8,1],[-23,-4],[-11,2],[-9,11],[-2,4],[-2,6],[-1,6],[-2,16],[0,4],[1,1],[36,-13],[19,-18],[3,-6],[1,-7]],[[3494,4564],[-5,-8],[-8,1],[-45,27],[1,6],[1,3],[5,3],[3,-3],[14,-4],[6,-4],[2,-1],[6,-2],[20,-18]],[[3484,4650],[-5,-9],[-6,-4],[-5,-1],[-29,3],[-14,5],[-27,-2],[-8,5],[-3,8],[1,7],[2,9],[2,9],[3,8],[8,3],[9,1],[12,-2],[13,-11],[6,-3],[7,-3],[17,-17],[13,-3],[4,-3]],[[3168,4716],[-25,-2],[-33,17],[-4,4],[-11,8],[-3,7],[1,12],[4,10],[5,7],[11,11],[8,11],[6,3],[3,4],[17,24],[5,3],[7,-11],[15,-31],[8,-12],[3,-7],[3,-9],[2,-7],[-1,-8],[-2,-9],[-4,-9],[-4,-8],[-5,-6],[-6,-2]],[[3306,4771],[-48,-6],[-2,1],[-19,18],[-2,1],[-3,5],[-2,9],[-6,28],[-1,11],[1,8],[5,3],[7,1],[20,13],[46,-7],[45,-7],[4,-4],[6,-15],[3,-5],[-3,-9],[-8,-4],[-14,-1],[-6,-1],[-7,-4],[-6,-6],[-5,-8],[-1,-5],[0,-4],[0,-4],[0,-4],[-4,-4]],[[3239,4977],[3,0],[10,3],[36,-1],[2,-1],[-8,-10],[-16,-12],[-26,-10],[-5,-6],[0,-2],[0,-3],[1,-3],[-1,-3],[-2,-2],[-8,-4],[-11,0],[-10,3],[-18,4],[-5,5],[-3,8],[-2,23],[-2,9],[7,6],[6,2],[42,-1],[10,-5]],[[2836,5045],[-8,0],[-14,5],[-4,4],[-7,10],[-3,4],[-4,2],[4,8],[16,7],[6,4],[7,3],[7,0],[16,-7],[5,-4],[4,-6],[-7,-13],[-8,-11],[-10,-6]],[[2919,5253],[2,-4],[1,-2],[1,-2],[-3,1],[-5,4],[-2,1],[-3,-3],[-1,-5],[-1,-5],[-2,-4],[-3,-3],[-8,-3],[-3,-3],[-2,-4],[-4,-11],[-2,-4],[-12,-12],[-6,-4],[-9,-3],[-6,-4],[-3,-1],[-3,2],[-4,7],[-4,2],[-15,2],[-5,4],[1,12],[6,7],[30,10],[3,4],[0,5],[-4,1],[-12,-3],[-11,1],[-4,3],[-1,4],[1,4],[4,1],[3,-3],[26,-3],[7,3],[12,11],[6,3],[9,0],[2,1],[8,15],[3,2],[14,4],[5,-1],[0,-7],[0,-8],[-2,-8],[-4,-4]],[[2818,5443],[-3,-3],[-1,-3],[2,-5],[-2,-5],[-2,-7],[-2,-6],[-4,-2],[-3,-1],[-3,-2],[-3,0],[-6,3],[-6,5],[3,3],[-3,3],[-4,0],[-4,-2],[-2,-6],[1,-6],[1,-4],[5,-8],[-4,0],[-5,5],[-3,1],[-4,-1],[-7,-6],[-4,-1],[-15,2],[-4,3],[-1,4],[-2,5],[-2,4],[-2,2],[0,2],[4,3],[12,-1],[4,3],[5,4],[11,6],[5,0],[-2,5],[-1,2],[-2,2],[5,3],[17,-1],[15,5],[4,1],[1,-3],[0,-4],[3,2],[6,5],[3,0],[3,-2],[1,-2],[-2,-2],[-3,0]],[[2931,5457],[-11,-6],[-4,-5],[-1,-5],[-1,-7],[-1,-6],[-4,-2],[-2,-1],[-5,-4],[-11,-3],[-3,-2],[-6,-8],[-2,-4],[0,-3],[0,-4],[0,-2],[-4,-6],[-4,-2],[-3,-2],[-2,-8],[0,-3],[1,-4],[0,-3],[-3,-1],[-2,0],[-1,2],[0,2],[1,4],[-5,4],[-3,-5],[-3,-9],[-4,-4],[-2,-1],[-4,-6],[-2,0],[-5,5],[-2,3],[-1,5],[3,4],[14,7],[-4,3],[-13,0],[-4,4],[-3,6],[-3,4],[-4,-2],[0,-2],[0,-3],[0,-2],[-1,-2],[-2,-3],[-2,-2],[-3,-1],[-3,0],[-13,2],[-4,-2],[2,11],[3,7],[4,4],[18,4],[7,6],[4,8],[1,10],[-1,7],[1,4],[5,3],[11,0],[10,6],[7,2],[4,8],[21,7],[17,-9],[3,0],[3,3],[-15,5],[-4,3],[-1,6],[2,2],[3,1],[35,-10],[3,-5],[-2,-3]],[[2843,5561],[58,-23],[10,-7],[5,-10],[-2,0],[-2,-1],[-2,-2],[-2,-4],[-2,-3],[-27,-5],[-5,4],[2,6],[-1,5],[-5,6],[0,2],[1,4],[0,4],[-1,1],[-2,0],[0,-3],[-1,-3],[-1,-2],[-4,-5],[-5,-3],[-11,-4],[-4,1],[-11,11],[-13,3],[-3,5],[13,16],[4,2],[8,2],[3,3]],[[2777,5775],[1,-3],[2,-4],[2,-2],[13,-8],[15,-3],[9,-8],[7,-2],[2,-2],[3,-7],[2,-2],[5,-2],[5,0],[5,-3],[3,-10],[-13,-2],[-6,-3],[-4,-9],[2,-1],[1,-1],[0,-2],[1,-2],[-6,-1],[-2,1],[-2,2],[-1,3],[-1,3],[-2,1],[-4,-1],[-2,-2],[-3,-2],[-4,2],[3,8],[5,0],[5,-1],[4,3],[1,8],[-2,3],[-4,2],[-3,0],[2,2],[2,3],[1,4],[1,5],[-10,-7],[-5,-1],[-4,3],[0,1],[0,2],[0,2],[-1,0],[-2,1],[-3,2],[-8,1],[-3,3],[-2,5],[1,0],[3,3],[-4,4],[-11,-2],[-5,0],[-14,12],[-6,3],[3,5],[4,2],[4,0],[3,-3],[4,-4],[6,8],[4,-2],[2,-2],[1,-3]],[[2718,5910],[50,-12],[3,-4],[2,-6],[-2,-7],[-6,-4],[-20,9],[-6,-1],[-6,-4],[-6,-8],[-2,-2],[-11,-2],[-5,1],[-2,7],[2,2],[2,2],[1,4],[2,4],[-3,2],[-46,-10],[-7,2],[-5,9],[10,8],[-4,8],[-15,-5],[-4,6],[24,17],[5,-4],[49,-12]],[[2687,6168],[-6,-2],[-34,0],[0,1],[-59,-4],[-17,-6],[-51,3],[-7,5],[0,2],[57,9],[58,8],[13,8],[9,2],[15,-4],[15,-8],[-1,-3],[-1,-1],[-2,-2],[13,-3],[-2,-5]],[[561,7025],[-13,-4],[-55,10],[-3,5],[2,6],[7,3],[68,10],[6,-2],[4,-7],[2,-3],[2,-1],[1,-2],[-2,-4],[-2,-3],[-7,-2],[-10,-6]],[[138,7405],[2,-1],[10,2],[61,-15],[13,4],[4,-2],[12,-13],[9,0],[11,4],[10,1],[8,-10],[-6,-8],[-21,-4],[-9,-7],[-14,-1],[-6,-5],[-3,-1],[-69,3],[0,3],[2,0],[2,2],[2,2],[-1,2],[-18,6],[-11,-2],[-40,15],[-8,9],[2,6],[4,2],[28,7],[0,1],[-1,1],[5,4],[17,-1],[2,-1],[3,-3]],[[350,7415],[44,-11],[44,-12],[37,-1],[12,-5],[-6,-4],[-13,1],[-12,-4],[-68,-2],[-67,-2],[-6,2],[-4,5],[-5,9],[-4,6],[-18,9],[3,3],[2,0],[11,0],[13,2],[25,-1],[12,5]],[[957,8678],[-2,-1],[-4,0],[-2,1],[-2,0],[-2,1],[-2,1],[-1,1],[-2,1],[-4,2],[-2,1],[0,1],[2,0],[2,1],[2,0],[7,0],[2,0],[2,-1],[0,-1],[0,-1],[1,-1],[4,-2],[1,0],[0,-3]],[[997,8758],[2,0],[2,0],[0,-1],[2,0],[2,0],[1,-1],[2,0],[1,0],[1,0],[3,-1],[8,-4],[3,-1],[1,-1],[1,-1],[2,-2],[0,-1],[2,-1],[8,-4],[3,-1],[1,0],[2,-1],[0,-1],[1,0],[1,0],[2,-1],[1,-1],[0,-4],[-2,-1],[-2,0],[-4,0],[-1,-1],[-9,0],[-1,0],[-2,0],[-2,0],[-1,-1],[-2,0],[-2,-1],[-1,-1],[-2,0],[-2,0],[-2,0],[-1,1],[-2,0],[-4,2],[0,3],[-2,1],[-4,0],[-1,0],[-2,1],[-1,0],[-1,1],[-2,2],[-1,1],[-1,1],[-1,1],[-1,1],[0,2],[-1,1],[0,3],[-1,1],[0,1],[-1,1],[0,1],[-1,0],[0,3],[-1,0],[0,3],[1,0],[0,1],[2,0],[1,0],[1,0],[6,0],[1,0]],[[1090,8824],[2,-1],[2,0],[2,-1],[0,-2],[-2,-1],[-2,0],[-3,0],[-2,0],[-3,2],[0,1],[-1,0],[0,1],[1,1],[2,0],[2,0],[2,0]],[[3721,3235],[5,4],[-4,0],[-8,-4],[-22,-5],[-4,1],[-13,8],[-27,-2],[-31,15],[-13,18],[-8,3],[0,3],[4,1],[7,7],[33,11],[26,20],[16,6],[7,9],[3,2],[5,0],[9,-4],[15,-2],[4,-4],[-1,-1],[-1,-3],[-1,-4],[14,-4],[7,0],[5,6],[-5,4],[-12,5],[-10,8],[-30,2],[-5,-1],[-20,-16],[-10,-3],[-14,-13],[-11,-4],[-12,-1],[-21,-9],[-24,-3],[0,3],[4,1],[9,8],[5,2],[-4,4],[-5,0],[-13,-5],[-11,1],[-3,2],[-27,21],[-5,0],[0,5],[1,2],[1,2],[2,0],[2,-1],[1,-1],[2,-2],[1,-1],[4,-1],[10,3],[17,-4],[10,1],[6,9],[-3,0],[0,3],[34,10],[6,8],[7,4],[6,8],[3,1],[36,-1],[11,-7],[3,0],[4,1],[3,3],[1,4],[3,9],[-7,-2],[-9,0],[-8,3],[-7,5],[1,9],[-3,6],[-4,2],[-4,-3],[1,-1],[2,-4],[1,-1],[-5,-2],[-12,4],[-4,-2],[-3,4],[-18,10],[-5,0],[-5,-3],[-3,-8],[3,0],[0,-3],[-10,-5],[-2,-3],[2,-4],[4,0],[7,4],[6,6],[3,1],[3,-1],[10,-9],[4,0],[-9,-5],[-2,-4],[1,-3],[-22,-2],[-4,-6],[7,0],[-5,-5],[-6,1],[-6,3],[-4,1],[-3,-3],[-3,-8],[-2,-4],[-3,0],[-9,3],[-3,-1],[-8,-4],[-4,-1],[-3,1],[-8,8],[0,3],[7,5],[3,1],[-4,3],[-4,2],[-4,4],[-1,9],[-3,7],[-12,4],[-3,5],[5,1],[19,7],[23,2],[2,-3],[2,-2],[4,-6],[2,-2],[4,0],[3,4],[0,5],[-3,6],[1,0],[3,3],[-13,8],[1,5],[0,5],[-1,3],[-2,2],[3,2],[-33,-4],[-4,-6],[-3,-5],[-4,-5],[-5,-4],[-3,-1],[-5,0],[-2,2],[-5,5],[-6,1],[-3,3],[-2,-2],[-8,-1],[-3,-2],[2,-7],[8,-8],[4,-4],[2,-10],[3,-2],[6,-1],[3,-1],[10,-8],[2,-6],[-4,-8],[-6,-9],[-2,-6],[3,-5],[0,-3],[-7,0],[-3,-1],[-5,-7],[-4,-1],[-3,1],[-3,2],[5,2],[4,4],[1,4],[-4,1],[-2,0],[-7,-5],[-3,0],[-2,2],[-2,0],[-2,-4],[-3,-6],[-4,-6],[-5,-4],[-3,-3],[-5,-1],[-6,1],[-5,3],[-3,7],[3,0],[0,2],[-4,0],[-2,1],[-2,2],[5,8],[6,3],[22,0],[2,2],[1,4],[-3,2],[-4,1],[-3,2],[-7,1],[-12,-4],[-2,-1],[-2,-4],[-2,-4],[-3,-2],[-60,6],[-5,5],[-6,13],[-5,2],[-2,2],[2,5],[2,4],[4,6],[9,4],[2,2],[5,5],[6,4],[1,0],[2,-1],[0,-2],[-1,-1],[-2,-2],[38,3],[3,2],[5,6],[7,3],[11,8],[5,2],[11,-1],[6,2],[4,4],[0,3],[1,2],[4,4],[-6,3],[-37,-15],[-13,-11],[-5,-2],[-42,-1],[-5,-2],[-4,-5],[-2,-2],[-19,-6],[-3,-2],[-2,-3],[-3,-8],[-1,-4],[-3,-3],[-3,-2],[-11,-2],[-12,-8],[-6,-2],[-26,3],[-2,-2],[-4,-5],[-2,-2],[-2,0],[-3,-2],[-1,-1],[-5,0],[-10,-4],[-10,-10],[-43,-58],[-40,-33],[-15,-6],[-2,0],[-1,2],[2,5],[-1,1],[-4,0],[-3,4],[-1,2],[3,11],[-2,1],[-2,3],[-1,4],[2,3],[-4,6],[3,4],[24,16],[5,1],[0,2],[-23,-5],[18,11],[6,6],[-1,1],[-2,2],[2,3],[2,4],[1,4],[-1,1],[-1,5],[-2,4],[-1,3],[3,4],[-3,0],[-3,2],[-3,2],[-5,8],[-3,2],[-8,1],[3,6],[15,8],[6,7],[3,2],[2,-1],[2,-1],[2,-1],[3,3],[-1,1],[0,2],[2,0],[1,-2],[2,-3],[0,-5],[0,-6],[-2,-2],[-5,0],[0,-2],[4,-3],[8,5],[4,0],[-2,-2],[-1,-2],[-3,-1],[-2,0],[0,-3],[28,4],[6,7],[-23,2],[-7,4],[0,3],[2,3],[7,6],[-5,3],[-9,0],[-4,2],[4,6],[4,3],[9,0],[1,-1],[5,-5],[5,0],[2,-1],[1,-4],[-1,-2],[-2,-2],[-2,-3],[0,-4],[2,-2],[3,-2],[2,-1],[3,-1],[13,2],[0,3],[-10,-1],[-4,2],[-3,5],[22,13],[5,1],[8,-4],[3,1],[-6,7],[-6,4],[-6,1],[-7,-3],[-7,-5],[-2,-1],[0,1],[-1,2],[0,2],[-1,1],[-4,1],[-1,0],[-1,2],[2,2],[5,0],[2,2],[2,4],[3,1],[6,0],[-7,3],[-4,3],[-2,5],[3,1],[8,2],[7,-4],[13,7],[30,2],[-4,4],[-9,5],[-4,0],[-2,-1],[-2,-4],[-2,0],[-37,0],[2,3],[0,4],[0,3],[-2,4],[5,2],[9,7],[22,8],[50,-41],[16,-2],[1,-1],[1,-2],[0,-2],[0,-1],[5,-2],[8,5],[46,-6],[6,-5],[2,-1],[4,1],[7,4],[4,1],[2,2],[7,13],[0,2],[-4,0],[-5,-2],[-8,-8],[-5,-3],[-46,8],[-45,8],[-11,7],[-29,30],[-22,14],[-4,7],[3,5],[7,6],[3,3],[-2,5],[-3,3],[-3,0],[-3,-2],[0,-7],[-5,-3],[-9,-2],[-5,-5],[-3,-1],[-2,2],[0,4],[2,4],[2,3],[1,2],[-3,1],[-7,-5],[-4,-2],[-17,0],[25,14],[25,7],[6,-2],[6,-3],[12,-10],[5,-3],[13,-1],[4,-5],[3,1],[5,-3],[9,-9],[6,-3],[31,-7],[14,-11],[5,0],[5,4],[-5,1],[-15,9],[-3,3],[0,3],[3,4],[-5,3],[-13,-3],[-3,1],[0,3],[0,3],[0,1],[-2,2],[-6,2],[-3,2],[2,2],[1,1],[0,3],[-4,2],[-7,-4],[-4,-1],[1,0],[-3,0],[-1,4],[1,5],[3,3],[8,3],[3,-1],[5,-5],[2,0],[13,1],[5,-1],[13,-11],[5,-1],[0,-2],[9,-4],[10,-7],[10,-4],[10,-11],[6,-3],[13,0],[6,-2],[12,-11],[7,-3],[58,5],[58,5],[8,-3],[3,-2],[6,-9],[8,-4],[10,-8],[15,-7],[7,-6],[24,-9],[4,-2],[1,-3],[10,-13],[3,-2],[6,-1],[-1,3],[2,2],[2,1],[5,0],[1,1],[3,4],[2,1],[40,-10],[9,4],[5,11],[-25,-5],[-2,1],[-5,3],[-19,4],[-7,5],[-2,1],[-5,0],[-2,0],[-2,3],[1,2],[2,2],[1,3],[0,4],[-7,3],[-14,-6],[-7,3],[4,3],[2,3],[1,4],[-4,5],[-5,1],[-10,-3],[-5,2],[-6,5],[-11,1],[-2,2],[-2,2],[-2,5],[-2,2],[-2,2],[-6,1],[-3,2],[4,4],[14,8],[0,3],[-6,-2],[-11,-6],[-5,-1],[-5,1],[-1,2],[-1,4],[-1,4],[-2,1],[-6,0],[-2,1],[-5,8],[-3,2],[-2,-1],[-3,-3],[-2,-1],[-6,7],[-9,4],[-3,3],[-5,7],[-3,2],[0,2],[71,-11],[5,1],[2,3],[-1,3],[-8,8],[-4,2],[-4,0],[-9,-3],[-4,1],[-8,12],[-4,2],[-23,-1],[-4,3],[3,5],[3,1],[20,2],[2,3],[3,3],[5,3],[2,3],[0,3],[-1,4],[1,2],[0,3],[4,9],[-1,1],[-1,2],[-1,2],[-1,3],[3,0],[-2,2],[-3,1],[-3,2],[-1,5],[1,5],[2,3],[27,14],[9,1],[2,2],[8,11],[4,3],[5,-3],[-4,-2],[-3,-3],[3,-1],[5,3],[5,4],[3,5],[-13,5],[-62,-38],[-14,1],[-18,-6],[-5,1],[-13,9],[-5,1],[-4,-2],[-9,-5],[5,-4],[10,-4],[8,-12],[4,-3],[28,3],[6,-5],[7,-11],[2,-6],[-4,-4],[2,-3],[2,0],[-15,-6],[-54,-4],[-6,-4],[-2,-1],[-6,1],[-2,-2],[-5,-6],[-3,0],[-5,2],[-37,-6],[-8,-6],[-6,-1],[-14,1],[-9,-9],[-27,-8],[-4,2],[-3,4],[-2,0],[7,9],[3,5],[-4,4],[-9,3],[-4,3],[-3,5],[2,4],[4,3],[3,4],[-5,2],[-17,-8],[-18,3],[-6,-3],[1,0],[7,-5],[12,-1],[4,-3],[3,-5],[-7,-8],[-7,-3],[-8,0],[-7,2],[-1,1],[-2,4],[-2,1],[-2,0],[-4,-3],[-1,0],[-3,2],[1,4],[6,5],[-7,0],[-4,0],[-2,3],[3,7],[5,5],[22,11],[6,1],[6,-5],[1,1],[2,2],[2,1],[0,2],[0,3],[-1,1],[6,-1],[2,2],[0,5],[1,0],[1,0],[0,3],[-16,-6],[-16,-1],[-7,-8],[-39,-12],[-11,1],[-5,3],[-6,5],[-2,0],[-6,-8],[-8,-1],[-6,-7],[-2,1],[-2,4],[-1,6],[3,-2],[2,1],[1,4],[-7,7],[-2,4],[16,8],[7,1],[7,-3],[10,-9],[5,-3],[4,0],[10,12],[11,1],[2,3],[3,4],[3,3],[7,3],[11,0],[3,3],[-2,2],[-3,2],[-1,2],[1,3],[1,2],[2,1],[2,0],[1,4],[9,0],[4,3],[2,3],[7,6],[12,4],[1,-1],[2,-2],[1,0],[1,1],[0,2],[0,2],[0,1],[14,-3],[4,3],[-9,11],[11,5],[4,1],[-5,3],[-5,0],[-21,-5],[-5,1],[-6,3],[5,5],[68,19],[2,-2],[2,-2],[1,-2],[1,-3],[2,-2],[2,-1],[2,0],[2,0],[0,2],[-1,1],[0,1],[0,2],[24,13],[13,2],[12,-6],[-6,-4],[-19,-2],[0,-3],[8,0],[0,-3],[-2,0],[-1,-1],[-2,-2],[-1,-3],[4,-3],[11,-5],[3,1],[4,4],[3,2],[7,1],[20,-5],[10,0],[6,8],[0,5],[3,3],[4,2],[3,-1],[0,-3],[-5,-6],[0,-3],[7,5],[8,1],[7,-2],[3,1],[1,7],[-9,0],[0,3],[3,3],[6,2],[5,0],[4,-2],[-2,-3],[25,-3],[4,6],[-1,0],[-3,2],[9,8],[3,1],[0,-2],[-1,-3],[-1,-4],[-2,-2],[7,0],[3,2],[0,5],[-1,4],[0,5],[1,5],[2,1],[3,4],[-3,10],[-8,15],[4,0],[4,-2],[9,-10],[4,-8],[2,-7],[1,-3],[2,-1],[5,-3],[3,0],[1,4],[0,4],[-4,3],[-1,3],[2,4],[8,5],[3,3],[-15,-5],[-5,2],[1,1],[0,2],[0,1],[1,1],[-1,5],[-2,1],[-2,-1],[-2,1],[-2,3],[-3,12],[18,14],[16,3],[3,6],[0,5],[18,12],[-15,4],[-7,0],[-6,-4],[-7,-9],[-12,-9],[-12,-15],[-3,-2],[-13,-5],[-22,6],[-7,-1],[2,6],[3,3],[3,2],[3,2],[2,4],[2,4],[1,4],[3,1],[-1,5],[-4,5],[-1,5],[5,4],[13,4],[5,7],[4,7],[10,9],[4,6],[-5,-1],[-7,-4],[-5,-5],[-1,-7],[-4,-3],[-10,0],[-4,-3],[0,1],[0,1],[-1,1],[0,3],[2,4],[1,3],[10,10],[2,3],[2,4],[-1,12],[-1,10],[-2,8],[-4,9],[2,2],[5,-1],[2,2],[-3,11],[-2,5],[-2,4],[7,3],[3,4],[-3,7],[47,-2],[6,-3],[1,-9],[-4,-5],[-21,-4],[-5,-11],[-2,-2],[-5,-1],[-3,-3],[11,-3],[4,0],[0,3],[-2,0],[0,3],[34,16],[11,-4],[-1,-7],[-1,-2],[3,-3],[2,2],[2,3],[3,-1],[7,-9],[3,-1],[-2,-8],[-1,-4],[1,-4],[2,-7],[0,-3],[0,-4],[0,-3],[1,-1],[10,-3],[4,-3],[5,-2],[1,-2],[1,-4],[1,-2],[1,-1],[2,-1],[5,1],[2,3],[0,4],[-3,5],[-2,3],[-1,4],[0,4],[-1,2],[-2,2],[-2,0],[-4,-2],[-5,0],[-2,1],[-2,2],[-1,3],[-1,7],[-1,2],[-1,1],[1,3],[2,4],[2,3],[4,1],[3,0],[3,-2],[5,-11],[3,-2],[3,5],[-4,11],[3,8],[6,5],[6,-3],[1,-8],[-1,-8],[-3,-8],[-3,-5],[9,-11],[4,-1],[3,6],[-1,1],[-2,4],[-2,1],[3,7],[0,3],[0,4],[4,-2],[1,1],[1,1],[0,3],[-5,14],[-2,4],[-6,3],[-27,-8],[-14,4],[-27,17],[-2,7],[6,5],[26,-5],[17,2],[12,-4],[2,0],[5,6],[2,2],[3,2],[10,3],[3,3],[3,8],[2,9],[-1,8],[-5,4],[-3,-2],[-2,-3],[-2,-4],[-2,-3],[-4,-2],[-10,-1],[1,0],[-3,0],[-7,3],[-4,0],[-7,-3],[-3,1],[-3,5],[3,7],[1,2],[-1,1],[-1,1],[-1,3],[1,3],[0,1],[-1,1],[-1,1],[1,6],[0,5],[-1,4],[0,5],[3,5],[10,4],[3,6],[-10,3],[-9,-8],[-18,-21],[6,-5],[3,-3],[0,-5],[-2,-4],[-2,-3],[-4,-4],[0,-2],[-3,0],[-6,0],[-3,3],[4,3],[0,2],[-7,-1],[-14,-13],[-10,-4],[-6,-5],[-3,-2],[-5,-1],[-14,3],[-1,0],[-1,2],[-1,2],[-2,2],[-10,3],[-3,2],[0,3],[6,7],[-1,1],[-2,3],[-1,1],[3,2],[2,0],[4,-2],[2,2],[2,8],[2,2],[12,1],[11,5],[-4,6],[-10,0],[-3,4],[-2,9],[3,3],[9,1],[0,4],[-1,1],[4,1],[7,-6],[3,2],[-10,17],[0,6],[2,5],[4,2],[1,5],[1,6],[-1,2],[-2,2],[-1,4],[18,6],[8,6],[4,1],[4,-3],[6,-6],[8,-6],[8,-4],[6,0],[0,3],[-2,2],[-1,4],[-1,4],[-1,5],[8,5],[8,3],[21,-4],[5,2],[9,8],[-5,4],[-17,-4],[-2,1],[-2,3],[-4,6],[-1,1],[-9,-2],[-5,-4],[-9,-10],[-5,-4],[-4,-2],[-8,-1],[-8,2],[-5,4],[2,3],[2,1],[5,-1],[-8,4],[-8,-6],[-8,-9],[-7,-3],[-3,4],[-1,7],[1,6],[3,3],[3,2],[4,4],[3,5],[-1,6],[0,7],[-2,5],[-3,6],[-3,5],[12,10],[13,-2],[44,-19],[3,3],[-3,5],[-4,6],[-2,5],[4,4],[-12,-4],[-3,1],[-11,10],[-4,1],[-19,-3],[-9,2],[-5,13],[5,7],[14,5],[6,4],[8,10],[3,8],[1,3],[4,-1],[7,-4],[17,-2],[11,-5],[14,1],[7,-2],[3,0],[3,2],[-9,5],[-3,3],[-2,3],[-3,10],[-2,4],[-2,1],[-1,2],[2,5],[1,3],[1,2],[0,3],[-1,5],[-4,7],[-7,3],[-18,2],[-12,6],[-5,5],[4,8],[-3,3],[4,8],[35,2],[7,3],[15,13],[-5,9],[-6,3],[-24,-3],[-1,1],[-3,6],[-1,1],[-3,0],[-1,-1],[0,-2],[-2,-3],[-1,-1],[-36,-19],[-14,-2],[-21,-11],[-52,-1],[-5,3],[6,0],[4,4],[7,10],[3,1],[3,0],[2,0],[3,4],[3,8],[2,2],[5,-1],[3,-2],[3,-3],[1,-3],[2,-4],[1,-3],[2,-2],[19,12],[-6,6],[-13,-2],[-6,4],[1,1],[3,3],[0,2],[-6,4],[-31,3],[-4,-1],[-2,-2],[-2,-2],[-3,-8],[-15,-23],[-9,-9],[-6,4],[-13,-1],[-3,4],[0,3],[5,9],[1,5],[-1,2],[-1,1],[-3,-1],[-7,-5],[-3,-1],[-34,3],[-14,-4],[-7,0],[-7,3],[-8,13],[-3,0],[-4,-1],[-15,-3],[-13,7],[-4,0],[-1,0],[-1,-2],[-1,0],[-2,0],[-2,4],[-6,5],[-14,25],[-6,8],[-3,2],[-3,2],[-2,1],[-1,5],[-2,5],[-1,4],[-5,8],[-51,28],[-50,29],[-49,6],[-50,6],[-29,13],[-9,15],[-6,6],[-12,6],[0,5],[-2,6],[-3,6],[-17,23],[-22,20],[-13,15],[-3,2],[-3,0],[-6,-2],[-3,-1],[0,3],[5,5],[2,4],[1,4],[0,6],[1,3],[1,3],[1,3],[7,5],[13,6],[19,18],[13,9],[14,5],[29,0],[7,-5],[7,-1],[11,-9],[8,-1],[17,3],[4,-2],[10,-10],[24,-7],[39,8],[65,-7],[56,-22],[29,-29],[24,-14],[4,-7],[7,-6],[14,-9],[20,-17],[27,-14],[21,-18],[22,1],[35,-13],[21,-15],[38,-5],[28,-12],[8,-1],[7,4],[6,11],[-2,5],[-2,4],[-2,3],[-3,2],[-4,1],[-5,-2],[-4,0],[-3,4],[4,6],[10,12],[1,8],[3,5],[9,10],[2,1],[0,2],[1,1],[1,2],[-1,5],[-1,1],[-4,4],[-2,1],[-3,-3],[-7,-10],[-6,-5],[-2,-11],[-3,-3],[-3,-1],[-9,-13],[-4,-4],[-36,2],[-11,6],[-6,13],[25,0],[-3,6],[-7,5],[-12,6],[-18,-3],[-5,3],[-3,10],[-14,9],[-4,7],[5,4],[14,10],[4,7],[2,3],[2,-1],[1,-3],[0,-4],[0,-4],[-1,-3],[4,-6],[5,-4],[15,-4],[10,-10],[5,-2],[4,0],[2,-2],[1,-5],[0,-2],[2,0],[2,1],[1,2],[1,7],[-3,5],[-3,5],[-2,6],[4,0],[16,-10],[8,-2],[-4,8],[-6,4],[-11,5],[2,4],[3,4],[1,4],[-4,0],[-6,-4],[-3,-2],[-3,1],[-10,5],[4,11],[7,7],[7,3],[20,-6],[6,-8],[4,-2],[10,-2],[1,1],[1,2],[-2,6],[-3,4],[-43,16],[-30,-12],[0,3],[4,4],[0,5],[-1,6],[0,8],[3,11],[1,5],[-3,1],[-3,-3],[-4,-5],[-8,-17],[-1,-2],[-2,-2],[-3,-1],[-31,2],[-5,5],[-2,10],[1,6],[3,4],[5,1],[8,-1],[4,0],[3,3],[2,4],[1,3],[0,4],[1,4],[1,5],[2,1],[13,-3],[12,-8],[9,0],[5,-1],[31,-27],[21,-6],[5,3],[1,2],[2,5],[1,4],[-1,2],[-12,0],[-4,5],[0,12],[-25,10],[-3,3],[-1,4],[0,6],[3,5],[8,9],[-6,3],[-9,-2],[-8,-5],[-7,-6],[-6,-4],[-8,2],[-8,5],[-6,7],[3,3],[0,3],[-43,9],[-13,9],[-9,0],[-4,2],[-8,11],[-41,25],[-6,1],[1,4],[6,5],[3,5],[2,2],[2,2],[6,1],[50,-22],[51,-23],[34,2],[7,4],[3,5],[1,11],[2,4],[-46,-2],[-8,2],[-10,8],[-17,4],[-10,5],[-1,3],[2,5],[7,4],[22,-6],[-4,3],[-5,1],[-5,2],[-2,9],[28,11],[0,3],[-20,0],[-27,-13],[-27,-2],[-6,4],[-3,5],[-2,2],[-3,1],[-13,-1],[-1,-1],[-3,-3],[-16,-5],[-6,-6],[-4,-1],[-24,2],[-8,5],[-3,4],[0,4],[2,3],[4,2],[11,3],[4,3],[2,3],[7,13],[5,6],[20,14],[15,4],[31,-3],[8,3],[4,3],[3,4],[1,4],[0,6],[-1,4],[-1,2],[-22,11],[-3,4],[4,3],[2,2],[2,3],[-18,-3],[-48,-47],[-14,-7],[-16,-15],[-18,-8],[-13,-10],[-10,-2],[-5,1],[-3,2],[-3,4],[-1,6],[1,5],[3,7],[6,8],[23,5],[11,7],[5,8],[2,9],[-2,10],[-4,7],[-1,6],[5,7],[23,13],[11,2],[3,2],[5,6],[3,2],[5,1],[10,5],[44,7],[31,-7],[7,3],[-2,6],[4,4],[3,5],[-2,4],[-3,2],[-49,5],[-69,-26],[-21,-18],[-15,-4],[-16,-10],[-45,11],[-46,10],[0,3],[2,1],[2,2],[3,4],[7,6],[12,4],[4,3],[11,15],[6,6],[72,22],[19,-3],[58,13],[3,3],[3,4],[3,5],[4,11],[4,6],[4,10],[1,9],[-4,3],[1,2],[-15,1],[-5,-3],[-2,-1],[-2,-4],[-3,-11],[-5,-9],[-6,-5],[-43,-17],[-66,11],[0,6],[1,5],[0,5],[0,5],[-3,3],[-3,0],[-6,-5],[-4,-2],[-49,7],[-49,6],[1,0],[-1,0],[0,1],[0,2],[9,7],[17,20],[17,7],[9,6],[8,10],[7,13],[-6,4],[-3,2],[-1,5],[1,8],[4,4],[8,3],[3,4],[3,11],[3,5],[8,7],[8,4],[0,3],[-10,4],[-5,-1],[-8,-13],[-31,-23],[-3,-5],[1,-7],[2,-9],[3,-8],[2,-4],[0,-2],[-39,-15],[-7,-6],[-5,-6],[-3,-2],[-2,0],[-2,-2],[-2,0],[-2,2],[-1,2],[6,14],[2,6],[0,11],[-1,7],[-7,13],[-2,13],[-3,8],[-1,5],[0,2],[-1,4],[0,2],[0,3],[1,2],[1,2],[1,5],[1,3],[0,4],[-1,4],[-2,3],[-11,13],[-36,20],[-4,9],[0,4],[0,5],[0,4],[-2,1],[-1,2],[-4,30],[-2,6],[-2,5],[-1,5],[-2,2],[-4,2],[-2,3],[-1,7],[3,4],[12,4],[29,0],[5,2],[0,3],[-52,-2],[-8,-3],[-6,-9],[6,-10],[8,-10],[5,-12],[-1,-14],[1,-6],[1,-5],[0,-6],[0,-6],[4,-10],[5,-7],[29,-27],[5,-8],[4,-7],[7,-23],[2,-9],[1,-9],[2,-7],[3,-8],[7,-9],[2,-4],[0,-5],[-2,-4],[-3,-3],[-2,-1],[-2,-2],[-6,-13],[-24,-18],[-7,-2],[-24,5],[-9,0],[-5,-7],[7,0],[9,-2],[8,-6],[6,-10],[1,-10],[-2,-8],[-5,-5],[-5,-2],[-18,2],[-3,2],[-6,10],[-3,2],[0,3],[-1,5],[-2,5],[-2,2],[-7,3],[-4,0],[-3,-3],[6,-5],[2,-4],[1,-7],[-1,-5],[-6,-6],[-2,-4],[3,0],[3,-3],[5,-7],[12,-5],[10,-8],[5,-6],[3,-9],[0,-8],[-2,-10],[-2,-8],[-2,-6],[-4,-8],[-7,-5],[-20,-6],[-21,-12],[-11,-2],[-7,-5],[-7,-1],[-12,-5],[-19,2],[-12,-7],[-4,0],[-8,4],[-4,-1],[-7,-2],[-3,0],[1,0],[-6,1],[-18,12],[-3,4],[-1,4],[2,4],[-7,9],[-18,-1],[-8,4],[-10,16],[-6,6],[-4,-5],[2,-2],[4,-9],[2,-4],[6,-6],[8,-12],[2,-7],[-3,-3],[-24,0],[-19,11],[-8,11],[-10,7],[-7,13],[-17,49],[-2,6],[0,8],[0,1],[6,-3],[3,1],[3,1],[5,4],[-2,3],[-29,7],[-7,4],[-14,1],[-2,2],[4,10],[5,7],[10,9],[9,3],[27,-3],[0,3],[-1,6],[-1,3],[18,13],[6,1],[23,-15],[4,4],[-5,3],[-13,17],[-1,10],[3,8],[5,6],[4,2],[73,10],[48,51],[5,8],[2,11],[0,1],[-2,8],[1,1],[-1,3],[1,1],[2,2],[2,4],[2,9],[3,8],[3,11],[1,4],[2,3],[7,5],[-4,4],[-4,-3],[-7,-12],[-8,-8],[-2,-7],[2,-11],[-2,-3],[-5,-3],[-2,-2],[-1,-3],[-2,-6],[-1,-3],[-2,-3],[-2,-1],[-2,-3],[-1,-5],[0,-5],[1,-4],[2,-3],[0,-2],[-2,-3],[-10,-3],[-15,-16],[-11,-8],[-5,-6],[-4,-2],[-56,-3],[-45,24],[-11,3],[3,3],[2,3],[2,3],[1,6],[2,5],[19,9],[17,-1],[8,3],[-5,4],[-16,5],[4,8],[25,15],[21,20],[2,0],[4,9],[29,17],[-7,6],[-3,5],[-1,9],[4,5],[3,3],[1,6],[-3,1],[-2,2],[-1,4],[-2,5],[5,3],[6,1],[17,-7],[15,6],[-3,3],[-3,0],[-7,-3],[-23,5],[-6,4],[-4,8],[3,4],[8,0],[3,5],[-12,-3],[-7,2],[-3,-2],[0,-6],[-4,-3],[-14,-3],[-10,-9],[-2,-2],[-3,-3],[-3,1],[-7,5],[0,3],[6,2],[0,3],[-3,1],[-3,2],[-2,5],[-2,7],[1,3],[-1,2],[1,8],[-2,4],[-3,0],[-1,-4],[-1,-8],[-2,-5],[0,-5],[3,-4],[-3,-2],[-2,1],[-2,3],[-2,1],[-3,-1],[-7,-6],[-4,-2],[-8,2],[-6,5],[-13,13],[0,4],[22,27],[5,4],[4,0],[8,-6],[4,-1],[7,1],[12,-5],[23,2],[38,-14],[24,6],[19,-1],[7,-4],[3,-1],[23,11],[5,-1],[11,-7],[5,3],[-3,4],[-21,8],[-16,-7],[-26,1],[-14,7],[-2,15],[-4,-2],[-7,-11],[-5,-1],[1,0],[-13,0],[-6,2],[-1,5],[1,5],[0,5],[2,5],[2,4],[3,2],[10,4],[0,1],[-1,4],[40,3],[4,4],[-2,5],[-5,1],[-10,-5],[-14,4],[-5,3],[-1,6],[-2,4],[-1,1],[0,3],[4,0],[7,-4],[4,-2],[3,2],[1,4],[1,5],[1,4],[7,4],[14,-8],[6,4],[-6,7],[-7,5],[-14,5],[3,7],[11,-2],[5,2],[4,6],[14,4],[-2,6],[-4,3],[-4,1],[-3,-3],[-4,-7],[-16,-8],[-22,2],[-6,3],[-3,6],[16,8],[3,4],[14,-3],[10,3],[5,3],[4,5],[-4,2],[-4,3],[-3,5],[-3,8],[0,10],[-7,8],[-14,7],[4,4],[2,3],[-1,5],[-2,1],[-8,2],[3,5],[6,1],[2,5],[-5,4],[-5,3],[-5,0],[-18,-6],[-7,-1],[-5,6],[6,17],[1,8],[-5,-3],[-15,-16],[-4,-3],[-1,-3],[-1,2],[-4,8],[-3,2],[-7,1],[-1,2],[0,2],[-2,0],[-4,-2],[-11,0],[-4,1],[-7,7],[-4,3],[-32,-7],[-3,1],[-2,4],[-1,4],[0,1],[-1,1],[-1,2],[1,5],[4,5],[3,5],[3,1],[11,-6],[11,-2],[6,1],[3,2],[2,3],[1,2],[1,7],[1,2],[4,4],[7,6],[3,5],[-5,0],[-5,-2],[-5,-1],[-5,6],[5,2],[43,-5],[3,3],[0,9],[-2,2],[-10,3],[0,2],[0,5],[1,2],[-30,1],[-10,4],[0,3],[3,3],[8,13],[8,2],[1,0],[3,6],[0,2],[-5,0],[-3,1],[-1,2],[17,22],[3,3],[5,-8],[7,-5],[13,-3],[1,5],[-2,4],[-3,3],[-2,4],[-2,5],[-57,25],[-4,3],[-2,5],[0,2],[0,2],[1,2],[0,3],[-1,2],[-2,1],[-1,1],[-2,2],[-10,19],[-7,8],[-3,-4],[-4,-4],[-5,3],[-5,5],[-4,7],[5,5],[2,1],[-3,5],[-6,-1],[-11,-4],[-13,3],[-12,7],[-6,6],[2,2],[11,-1],[6,1],[18,11],[-8,5],[-17,-7],[-8,5],[0,2],[7,5],[12,4],[3,3],[-6,4],[-1,2],[-2,6],[-1,4],[1,1],[8,-2],[4,-3],[3,-5],[3,-5],[11,-2],[4,-5],[4,-2],[14,-3],[3,1],[-1,3],[4,5],[-5,1],[-12,-2],[-1,2],[-3,-1],[-1,1],[-1,2],[-2,5],[-1,2],[-2,2],[-3,2],[-2,2],[1,2],[-2,3],[-6,3],[-2,3],[-5,14],[-7,17],[17,-3],[10,1],[9,-5],[4,-1],[6,1],[3,2],[2,3],[-2,8],[-4,4],[-14,4],[-10,7],[-11,4],[-5,3],[-9,10],[-6,2],[-12,2],[-5,4],[1,5],[0,3],[-1,4],[2,0],[2,2],[1,1],[-2,2],[-1,1],[-2,0],[-2,0],[5,3],[16,-3],[5,2],[-1,4],[-4,3],[-55,4],[-5,4],[1,4],[-3,2],[-6,0],[2,3],[7,3],[10,1],[9,4],[7,11],[-16,-4],[-3,4],[8,11],[3,7],[-2,6],[3,2],[3,2],[8,2],[1,3],[0,3],[1,9],[-1,4],[1,4],[1,2],[2,1],[1,3],[1,4],[1,4],[-6,2],[-3,0],[-13,-20],[-49,-30],[-60,-14],[-59,-14],[-3,2],[-1,3],[0,4],[2,4],[2,4],[1,1],[14,3],[12,-5],[4,0],[3,2],[-7,5],[-3,4],[-2,6],[19,-3],[7,3],[15,10],[33,1],[3,1],[4,6],[3,2],[7,0],[3,2],[-1,2],[-2,3],[-1,1],[46,18],[3,8],[-11,3],[-34,-9],[7,10],[1,4],[-18,1],[-6,3],[-5,5],[6,4],[15,-3],[13,8],[56,0],[3,3],[1,6],[-1,2],[-4,5],[-2,1],[-54,3],[-3,-1],[-3,-3],[-3,-1],[-32,17],[-6,0],[0,3],[30,0],[51,14],[21,-3],[4,6],[-16,2],[-3,6],[1,8],[3,4],[7,6],[-5,3],[-32,-3],[-2,0],[-5,7],[-3,2],[-5,0],[-9,5],[-4,3],[-2,5],[12,4],[5,4],[4,7],[0,3],[-37,-2],[-10,8],[2,4],[-2,2],[-6,2],[-3,3],[-6,7],[-3,2],[-8,-2],[-4,-3],[-3,-10],[-4,-1],[-3,2],[-2,5],[2,3],[-3,2],[-5,2],[-2,2],[1,3],[2,3],[2,2],[1,0],[-3,6],[-6,0],[-11,-3],[2,2],[1,3],[1,3],[1,4],[-3,-1],[-7,4],[8,8],[4,3],[4,-1],[4,-6],[4,-4],[4,-3],[5,0],[2,1],[2,2],[1,3],[2,2],[2,2],[5,1],[5,5],[4,3],[8,1],[-3,9],[-6,5],[-22,3],[-2,6],[1,14],[-4,2],[-6,6],[-4,1],[-34,-7],[-5,3],[-1,8],[-2,2],[-6,1],[-2,2],[-1,5],[-5,3],[-21,7],[-18,14],[-4,2],[-25,0],[-5,3],[-2,7],[-3,3],[-11,4],[-13,0],[-7,-5],[-4,-1],[-3,3],[-3,6],[2,7],[4,2],[7,0],[-1,4],[-3,2],[-4,2],[31,18],[2,5],[-2,7],[-12,8],[-25,-1],[-12,7],[-1,7],[-4,4],[-10,6],[1,1],[0,5],[-10,7],[-6,6],[-2,7],[1,4],[4,1],[6,-3],[3,1],[3,1],[5,4],[-2,3],[-3,2],[-5,4],[3,9],[11,5],[5,6],[-9,3],[-11,0],[-10,-5],[-7,-11],[-4,-7],[-3,-3],[-30,0],[3,8],[4,4],[22,12],[13,2],[4,2],[7,8],[4,1],[18,0],[5,3],[0,1],[-2,5],[2,5],[4,6],[3,7],[0,8],[-4,6],[-7,4],[-26,5],[-5,4],[2,11],[3,7],[14,15],[-5,5],[-7,2],[-16,-5],[-6,0],[-6,2],[-5,4],[-1,7],[2,5],[4,4],[4,1],[11,-2],[5,2],[4,6],[-7,6],[-43,1],[-13,-6],[-40,-8],[-6,4],[3,3],[-1,1],[-3,2],[5,8],[-2,8],[-5,5],[-6,0],[-12,-6],[-6,-1],[-6,3],[7,4],[3,4],[0,7],[-3,5],[-3,1],[-7,0],[5,5],[8,4],[13,2],[-7,13],[-14,3],[-38,-6],[-5,-2],[-6,-5],[-7,-11],[-4,-4],[-2,2],[-1,4],[-2,1],[-2,-3],[-3,-6],[-2,-2],[-2,-1],[-7,0],[-5,2],[-2,6],[3,9],[3,5],[8,8],[4,5],[4,5],[11,3],[3,5],[-8,5],[-12,15],[-3,3],[-4,1],[-4,-2],[-10,-10],[-8,0],[-4,-3],[1,-6],[-9,1],[-4,2],[-4,3],[5,12],[-4,3],[-10,0],[-11,5],[1,5],[2,3],[1,0],[1,2],[3,2],[-5,8],[-55,0],[1,9],[-3,4],[-4,2],[-4,0],[-2,-1],[-2,-7],[-2,-2],[-2,-2],[-6,-1],[-4,-5],[-8,-5],[-4,-6],[-2,0],[-2,0],[-2,1],[-2,2],[-2,4],[-2,4],[-6,1],[-2,2],[1,3],[1,6],[-3,0],[1,9],[1,2],[-13,0],[2,6],[7,4],[3,5],[-3,1],[-1,4],[1,4],[3,2],[-7,7],[-8,3],[-9,0],[-14,-6],[-7,1],[-21,10],[-29,1],[-11,-4],[-28,5],[-16,9],[-3,0],[-13,-1],[-2,3],[-6,9],[-6,4],[-13,0],[-15,-7],[-9,-1],[-4,8],[2,1],[6,7],[-6,7],[-7,4],[-7,2],[-6,-2],[-6,-4],[-3,-3],[-2,-10],[-4,0],[-30,10],[-25,-5],[-7,-7],[8,-9],[0,-3],[-4,-4],[-3,-2],[-3,0],[2,6],[-10,7],[-2,5],[0,6],[5,6],[1,5],[-5,10],[-33,16],[-10,0],[-9,8],[-15,-2],[-5,1],[-8,6],[-4,1],[-18,0],[-1,-1],[-2,-2],[2,-12],[-5,-13],[-13,-15],[-2,-5],[-4,-10],[-3,-5],[-4,-3],[-9,-3],[-3,-6],[1,0],[1,-1],[2,-2],[0,-2],[-1,-3],[-1,0],[-2,0],[-1,0],[-9,-8],[-36,-10],[-10,4],[-9,11],[-7,17],[-5,20],[2,5],[1,2],[1,2],[0,3],[-1,2],[-1,1],[-2,0],[2,4],[2,3],[2,1],[3,0],[0,3],[-25,13],[-17,-1],[1,-5],[5,-7],[3,-6],[-1,-1],[-2,-3],[-1,-1],[4,-2],[0,-6],[-2,-7],[-3,-2],[-4,-2],[-3,-4],[-3,-2],[-7,4],[-5,-2],[-2,0],[-11,12],[-4,2],[-5,-1],[-3,-7],[1,-8],[3,-8],[3,-5],[7,-4],[4,-4],[1,-4],[-4,-2],[-9,5],[-4,1],[-3,-5],[3,-7],[14,-9],[-9,-5],[-8,1],[-8,6],[-8,9],[-9,6],[-28,1],[2,-6],[4,-7],[2,-5],[0,-4],[0,-1],[1,-3],[-1,-2],[-2,-2],[-2,1],[-4,6],[-4,5],[-3,1],[-15,-3],[-12,2],[5,15],[-1,4],[-4,2],[-17,-4],[-3,-5],[2,0],[1,-1],[2,-2],[1,-3],[-6,-6],[8,-19],[2,-6],[-3,-6],[-5,-2],[-3,-3],[2,-9],[-50,5],[1,2],[1,2],[1,5],[-11,0],[-2,1],[-5,6],[-3,1],[-14,5],[-5,4],[5,8],[13,3],[4,6],[1,5],[-1,9],[0,4],[3,1],[3,-1],[2,0],[2,5],[-7,1],[-4,1],[-2,4],[31,8],[5,4],[-15,12],[-16,4],[-46,-8],[-7,2],[-11,8],[-7,1],[-5,-3],[1,-10],[-1,0],[-1,-12],[-8,-7],[-14,-8],[5,-10],[-3,-2],[-6,0],[-5,-5],[3,-5],[3,-5],[1,-6],[-3,-7],[-5,-4],[-17,4],[-2,2],[-4,8],[-2,2],[-2,1],[-8,9],[-5,3],[-6,2],[-6,3],[-4,8],[4,1],[4,3],[4,5],[2,5],[-14,-2],[-8,3],[-1,8],[-8,7],[-10,4],[-20,0],[-8,-3],[-4,-4],[-3,-4],[-2,-3],[-1,-2],[2,-3],[1,-1],[2,-1],[3,-2],[0,-3],[-7,-2],[-16,2],[-7,-6],[1,-2],[-1,-2],[-1,-2],[-1,-5],[36,-7],[5,-3],[4,-5],[3,-11],[-2,-3],[-2,-2],[-4,-4],[4,-7],[40,-14],[7,-6],[9,-4],[12,-12],[9,-4],[7,-6],[3,-1],[2,-2],[3,-8],[3,-2],[-6,-6],[-13,3],[-29,18],[-31,7],[-14,-1],[-4,1],[-8,6],[-55,9],[-55,10],[-55,9],[-11,8],[-32,2],[-1,-2],[-3,0],[-4,2],[-7,5],[-12,5],[-3,3],[0,3],[1,2],[3,2],[17,6],[-5,9],[-8,2],[-45,-1],[8,8],[-4,3],[-8,1],[-18,13],[2,7],[-1,2],[-28,15],[-9,2],[-9,4],[-14,1],[-15,6],[-26,21],[-11,3],[-4,5],[2,3],[1,3],[0,4],[0,4],[3,6],[4,3],[40,13],[41,13]],[[822,7049],[0,1],[0,8],[-3,7],[-11,3],[-4,5],[15,7],[3,4],[-16,9],[-3,1],[-38,-14],[-46,-2],[-47,-2],[-37,9],[-16,-4],[-8,3],[-8,5],[-47,12],[-47,11],[-7,6],[-8,2],[-4,2],[-8,9],[-3,2],[3,10],[4,7],[22,11],[5,6],[-1,9],[7,5],[18,23],[9,5],[17,3],[4,2],[3,5],[-30,5],[-5,-3],[-1,-7],[-10,-7],[-14,-15],[-9,-5],[-14,-16],[-57,-39],[-19,-5],[-3,3],[-3,0],[-1,2],[-1,2],[-2,2],[-2,2],[-1,0],[-7,-5],[-2,1],[-28,16],[-2,3],[1,4],[3,5],[-4,2],[-10,-4],[-4,3],[-2,4],[-7,7],[5,4],[20,-2],[-1,3],[23,9],[3,3],[-21,-3],[-45,14],[1,-2],[-7,-4],[4,-8],[-41,25],[-6,14],[2,14],[5,5],[13,0],[4,1],[1,4],[-1,6],[1,6],[2,2],[3,1],[2,2],[-1,6],[31,8],[15,-4],[34,2],[-8,6],[-28,5],[3,6],[63,7],[64,6],[63,7],[3,-2],[6,-5],[3,-1],[13,2],[69,-7],[69,-8],[7,-4],[10,-1],[1,-1],[0,-2],[60,7],[60,7],[64,-13],[64,-12],[9,1],[13,-7],[72,2],[15,-8],[8,0],[-3,3],[-9,5],[-2,4],[2,4],[31,4],[8,5],[4,10],[-75,-19],[-73,10],[-74,10],[-73,10],[-36,-8],[-69,11],[-68,11],[-7,7],[59,21],[60,22],[76,1],[75,2],[54,-6],[54,-6],[43,-32],[40,-12],[5,1],[5,3],[-7,10],[-33,4],[-9,8],[-7,10],[-7,13],[-2,4],[0,2],[-11,15],[13,6],[62,-3],[13,3],[9,14],[-3,5],[-1,1],[1,2],[5,4],[-2,3],[-5,2],[-3,2],[-1,2],[-2,7],[-2,1],[-7,2],[-4,2],[-2,4],[2,3],[6,1],[3,2],[-5,4],[-18,-1],[6,4],[3,3],[1,3],[-3,5],[-4,3],[-32,7],[-17,10],[-2,4],[-2,2],[-12,-1],[-6,4],[1,5],[5,6],[3,5],[-9,-2],[-20,-12],[-48,-5],[-4,-4],[4,-3],[-2,-7],[-5,-14],[-5,-8],[-6,-5],[-55,-21],[-62,-6],[-62,-5],[-5,3],[3,17],[0,8],[-3,4],[-6,2],[-17,12],[-19,23],[-6,2],[-7,0],[-14,-4],[33,-39],[2,-6],[0,-7],[-2,-7],[-5,-4],[-47,-11],[-47,-12],[-56,14],[-56,15],[-56,14],[-3,3],[-2,5],[5,1],[9,6],[33,14],[19,2],[26,14],[14,2],[19,8],[3,6],[-4,13],[7,9],[-5,3],[-5,-4],[-10,-10],[-19,-10],[-45,-5],[-4,-1],[-7,-7],[-50,2],[-49,1],[-5,5],[4,7],[51,26],[17,18],[8,6],[7,-1],[4,-1],[25,2],[3,3],[-16,9],[-34,-4],[-15,7],[-6,0],[-8,-3],[-13,-9],[-17,-20],[-5,-3],[-52,-2],[-51,-2],[-19,9],[-2,3],[2,5],[4,3],[27,14],[4,8],[-6,7],[-10,0],[-10,-2],[-16,-10],[-9,-1],[-17,3],[6,13],[1,4],[-1,8],[-3,1],[-32,-8],[-7,-5],[-8,-3],[-8,3],[-16,13],[-15,5],[-16,0],[1,5],[1,2],[0,2],[-17,18],[-3,5],[2,6],[4,5],[3,3],[0,4],[-46,2],[-4,2],[-8,10],[-3,3],[-13,2],[-5,2],[-11,14],[-7,6],[-26,1],[5,9],[7,1],[14,-4],[13,2],[13,7],[-3,5],[-10,6],[0,3],[5,0],[5,3],[-2,2],[-2,1],[-2,0],[-2,0],[5,3],[10,-1],[5,4],[-1,0],[-1,1],[-2,4],[7,10],[12,2],[21,-3],[-7,7],[-56,4],[5,3],[-1,2],[0,2],[0,1],[-1,1],[1,6],[1,4],[3,1],[6,1],[20,11],[6,6],[3,8],[-11,6],[-4,0],[3,7],[11,5],[3,8],[-6,0],[-3,1],[-1,2],[-1,3],[8,9],[52,7],[53,8],[63,36],[54,0],[17,-9],[41,-3],[4,-2],[4,-5],[2,0],[2,5],[-1,1],[-2,1],[-1,1],[4,13],[-1,4],[-1,9],[9,7],[42,9],[8,5],[10,-2],[9,5],[54,7],[4,4],[-2,3],[-4,2],[-4,0],[9,9],[9,3],[77,2],[13,-4],[3,3],[2,4],[12,12],[8,4],[4,4],[-2,3],[4,4],[3,0],[11,-6],[10,1],[5,-2],[12,-10],[5,-1],[16,0],[-4,4],[-9,6],[-3,4],[-1,2],[0,5],[-1,2],[-1,2],[-2,2],[-2,1],[-2,0],[-5,-2],[-29,7],[-4,4],[5,10],[5,6],[12,7],[81,20],[80,21],[46,-16],[14,7],[-11,5],[-1,4],[2,5],[3,2],[31,7],[5,-2],[3,0],[0,3],[-1,3],[-2,1],[-1,2],[-1,5],[45,-10],[8,1],[-1,4],[-1,2],[-4,3],[3,2],[1,0],[-1,3],[2,3],[3,0],[5,-3],[2,1],[2,1],[2,0],[2,-5],[-1,0],[-2,-2],[-1,0],[5,-8],[6,-2],[7,3],[5,7],[-2,5],[3,1],[5,-3],[4,-7],[-1,-2],[-1,-2],[-1,-3],[-1,-4],[8,3],[14,13],[8,1],[-6,-6],[-6,-5],[4,-4],[5,3],[9,9],[5,3],[15,0],[2,-1],[4,-6],[3,-1],[3,0],[4,4],[3,2],[17,2],[6,-2],[-1,-3],[0,-7],[0,1],[0,-4],[3,-1],[7,-1],[14,5],[11,-5],[23,0],[-3,7],[-4,2],[-5,0],[-4,2],[41,0],[6,4],[-11,-1],[-5,1],[-2,4],[-2,1],[3,6],[5,5],[27,13],[5,5],[-3,0],[-2,1],[-2,2],[-1,5],[7,6],[7,3],[13,0],[4,3],[-3,5],[-2,3],[2,3],[9,3],[1,2],[1,2],[1,1],[2,1],[1,1],[3,6],[2,2],[23,6],[6,5],[9,3],[4,2],[3,7],[-2,3],[4,6],[8,4],[5,4],[-4,2],[-3,1],[6,10],[21,9],[10,9],[4,9],[2,10],[0,12],[0,7],[-2,6],[-4,7],[-6,5],[-13,4],[-6,4],[4,5],[9,8],[4,7],[-10,12],[-10,8],[3,6],[8,3],[3,3],[-10,6],[-5,5],[-2,6],[8,0],[0,2],[-4,0],[-12,5],[-5,4],[5,4],[16,2],[-1,4],[-6,10],[6,6],[-1,7],[3,5],[7,8],[-4,9],[-16,11],[5,7],[57,11],[57,12],[35,27],[7,1],[28,-6],[15,3],[6,6],[-59,2],[-3,2],[-2,4],[-2,5],[-3,4],[4,12],[2,7],[-2,5],[-3,1],[-4,1],[-3,-1],[-3,-3],[-1,-6],[1,-5],[1,-4],[-1,-1],[-5,-5],[-7,-20],[-5,-4],[-4,-1],[-13,-13],[-74,-14],[-61,10],[-24,-16],[-67,-19],[-32,4],[-6,5],[-6,10],[-6,6],[-13,4],[-11,8],[-9,1],[-5,3],[-2,2],[-2,1],[-3,0],[-8,-14],[-9,-4],[-80,-5],[-5,6],[4,3],[-1,4],[-7,7],[-3,7],[0,3],[7,5],[-5,1],[-9,6],[-4,2],[-14,-3],[-30,10],[-7,10],[2,2],[3,1],[5,-1],[-5,6],[3,3],[1,1],[2,-1],[-2,5],[-3,3],[-3,3],[-5,2],[1,4],[5,6],[4,6],[1,5],[-1,2],[-5,1],[5,9],[21,9],[6,-1],[4,1],[9,8],[3,0],[-1,0],[5,2],[21,11],[20,17],[20,3],[2,2],[1,4],[2,3],[6,2],[2,2],[-1,1],[-1,0],[-1,1],[-1,1],[2,3],[1,3],[1,2],[2,1],[-9,-1],[-4,1],[-2,4],[1,6],[4,3],[50,11],[50,12],[5,4],[3,6],[2,6],[1,6],[3,2],[43,0],[43,-1],[4,4],[-31,9],[-3,4],[3,5],[11,7],[40,10],[41,10],[8,6],[4,4],[0,1],[0,3],[0,2],[1,3],[4,2],[2,1],[1,2],[2,3],[1,3],[-9,11],[3,7],[7,3],[32,2],[7,5],[-1,1],[-3,2],[8,6],[-9,4],[-4,4],[-2,7],[2,6],[6,3],[38,3],[14,10],[31,0],[20,8],[31,4],[16,24],[17,10],[8,2],[3,3],[10,1],[14,-9],[11,-14],[2,-20],[6,-9],[14,-31],[9,-11],[31,-21],[6,-9],[5,-12],[6,-11],[15,-9],[7,-7],[6,-2],[7,10],[-3,3],[-15,4],[-3,2],[-1,4],[3,5],[-6,3],[-5,6],[-11,16],[-6,7],[-21,15],[-4,6],[-23,46],[-3,10],[1,9],[-1,6],[-3,7],[-2,9],[28,15],[8,7],[28,7],[23,-1],[12,-5],[46,-3],[46,-3],[56,-30]]],"transform":{"scale":[0.006168658858085809,0.002384385573957406],"translate":[-73.05724036399991,59.79262929900001]}};
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
