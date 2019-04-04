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
  Datamap.prototype.grlTopo = '__GRL__';
  Datamap.prototype.gtmTopo = '__GTM__';
  Datamap.prototype.gumTopo = '__GUM__';
  Datamap.prototype.guyTopo = '__GUY__';
  Datamap.prototype.hkgTopo = '__HKG__';
  Datamap.prototype.hmdTopo = '__HMD__';
  Datamap.prototype.hndTopo = {"type":"Topology","objects":{"hnd":{"type":"GeometryCollection","geometries":[{"type":"MultiPolygon","properties":{"name":"Atlántida"},"id":"HN.AT","arcs":[[[0,1,2,3]],[[4]],[[5]]]},{"type":"Polygon","properties":{"name":"Colón"},"id":"HN.CL","arcs":[[6,7,8,-1,9]]},{"type":"Polygon","properties":{"name":"Francisco Morazán"},"id":"HN.FM","arcs":[[10,11,12,13,14,15,16]]},{"type":"MultiPolygon","properties":{"name":"Gracias a Dios"},"id":"HN.GD","arcs":[[[17]],[[18]],[[19]],[[20]],[[21]],[[22]],[[23]],[[24]],[[25]],[[26]],[[27]],[[28]],[[29]],[[30]],[[31]],[[32]],[[33]],[[34]],[[35]],[[36]],[[37]],[[38]],[[39]],[[40]],[[41]],[[42]],[[43]],[[44,-7,45]],[[46]],[[47]]]},{"type":"MultiPolygon","properties":{"name":"Islas de la Bahía"},"id":"HN.IB","arcs":[[[48]],[[49]],[[50]],[[51]],[[52]],[[53]]]},{"type":"Polygon","properties":{"name":"Olancho"},"id":"HN.OL","arcs":[[-45,54,55,-11,56,-8]]},{"type":"Polygon","properties":{"name":"Yoro"},"id":"HN.YO","arcs":[[-9,-57,-17,57,58,-2]]},{"type":"MultiPolygon","properties":{"name":"Valle"},"id":"HN.VA","arcs":[[[59]],[[60]],[[-14,61,62,63]]]},{"type":"Polygon","properties":{"name":"Comayagua"},"id":"HN.CM","arcs":[[-16,64,65,66,67,-58]]},{"type":"Polygon","properties":{"name":"Cortés"},"id":"HN.CR","arcs":[[-59,-68,68,69,-3]]},{"type":"Polygon","properties":{"name":"Intibucá"},"id":"HN.IN","arcs":[[70,71,72,73,-66]]},{"type":"Polygon","properties":{"name":"La Paz"},"id":"HN.LP","arcs":[[-15,-64,74,-71,-65]]},{"type":"Polygon","properties":{"name":"Santa Bárbara"},"id":"HN.SB","arcs":[[-67,-74,75,76,77,-69]]},{"type":"Polygon","properties":{"name":"Copán"},"id":"HN.CP","arcs":[[78,79,80,-77]]},{"type":"Polygon","properties":{"name":"Lempira"},"id":"HN.LE","arcs":[[-73,81,82,-79,-76]]},{"type":"Polygon","properties":{"name":"Ocotepeque"},"id":"HN.OC","arcs":[[-83,83,-80]]},{"type":"Polygon","properties":{"name":"Choluteca"},"id":"HN.CH","arcs":[[84,85,-62,-13]]},{"type":"Polygon","properties":{"name":"El Paraíso"},"id":"HN.EP","arcs":[[86,-85,-12,-56]]}]}},"arcs":[[[4282,6332],[1,-18],[-11,-1],[-2,-2],[-1,-5],[1,-8],[2,-12],[2,-14],[3,-32],[5,-18],[9,-17],[21,-26],[13,-19],[16,-56],[5,-12],[14,-7],[8,-6],[5,0],[9,1],[5,-8],[4,-7],[2,-52],[1,-51],[-7,-29],[-13,-21],[-35,-20],[-32,-28]],[[4307,5864],[-32,21],[-40,9],[-37,-6],[-11,-4],[-9,-5],[-13,-4],[-12,2],[-16,9],[-14,3],[-54,-5],[-52,22],[-25,7],[-17,-5],[-32,-15],[-31,-21],[-60,-50],[-37,-20],[-32,-11],[-45,0],[-22,-4],[-28,9],[-17,37],[-105,-42],[-66,3],[-27,-7],[-55,-72],[-24,-40],[-14,-17],[-26,-22],[-95,-52],[-45,-47],[-14,-19],[-7,-6],[-61,1],[-104,37],[-15,-1],[-14,4],[-14,15],[-16,9],[-11,2],[-10,-4],[-8,-8],[-8,-4],[-6,-8],[-9,-6],[-7,-4],[-9,2],[-8,3],[-22,16],[-12,12],[-9,11],[-11,20],[-10,24],[-8,57],[-1,29],[-2,23],[-25,25],[-14,2],[-7,-5],[-57,-48],[-21,4],[-62,-25],[-65,-8],[-23,14],[-58,97],[-5,11],[-4,14],[-8,69],[-2,33],[-13,78],[-16,43],[-24,19],[-107,110]],[[2307,6175],[21,8],[13,11],[9,23],[0,26],[-4,21],[-10,11],[-11,-5],[-6,30],[-22,38],[-1,24],[8,20],[23,35],[11,23],[13,54],[9,22],[16,22],[14,13],[8,21],[-4,53]],[[2394,6625],[9,5],[26,-5],[24,-13],[65,-58],[25,-4],[0,14],[-15,22],[15,26],[51,46],[-28,-57],[-10,-35],[13,-16],[8,-15],[137,-185],[44,-29],[47,14],[8,13],[15,36],[7,11],[14,2],[38,-3],[8,10],[9,38],[21,20],[30,4],[151,-51],[132,-69],[135,-22],[156,-54],[52,-6],[56,8],[90,40],[26,6],[4,7],[24,28],[6,4],[8,11],[18,-10],[18,-15],[7,-8],[62,-8],[286,37],[48,-2],[45,-27],[3,-3]],[[4208,6710],[-7,-12],[-7,7],[5,11],[4,13],[5,-19]],[[4242,6733],[-6,-7],[-4,9],[-6,9],[-1,7],[9,9],[8,-7],[0,-20]],[[6387,6776],[0,-2070]],[[6387,4706],[-88,154],[-48,66],[-205,135],[-24,23],[-85,154],[-78,171],[-52,63],[-160,91],[-150,193],[-118,95],[-30,10],[-13,-10],[-15,-9],[-11,-3],[-14,9],[-10,13],[-10,6],[-8,2],[-32,-25],[2,-20],[-4,-17],[-12,-20],[-31,-38],[-29,-27],[-16,1],[-17,17],[-10,5],[-10,3],[-10,-7],[-7,-12],[-36,-87],[-89,-130],[-84,-68],[-6,-14],[-10,0],[-10,7],[-12,5],[-15,2],[-26,-5],[-13,-9],[-24,-7],[-28,-20],[-33,-12],[-34,11],[-90,72]],[[4582,5474],[-2,59],[-10,30],[-1,11],[9,102],[-2,29],[-4,19],[-5,6],[-6,1],[-4,-3],[-2,-6],[-2,-3],[-2,0],[-2,3],[-3,4],[-4,2],[-5,2],[-4,2],[-4,4],[-5,9],[-4,6],[-4,3],[-4,3],[-3,1],[-9,-1],[-37,14],[-70,-4],[-15,2],[-7,4],[-4,8],[-16,30],[-44,53]],[[4282,6332],[34,-32],[23,-9],[36,-4],[29,7],[24,17],[139,129],[36,59],[17,21],[51,30],[50,18],[210,12],[18,8],[15,11],[57,62],[31,51],[13,54],[-24,46],[-92,20],[-45,16],[8,25],[38,5],[113,-33],[78,-22],[55,-9],[69,-30],[69,-26],[24,-8],[16,-11],[4,-26],[-1,-30],[4,-25],[11,0],[-1,15],[3,7],[5,4],[3,5],[24,-1],[13,-29],[26,-31],[31,-34],[65,-41],[111,-43],[76,9],[109,17],[158,6],[84,53],[107,115],[70,62],[111,4]],[[3478,4587],[4,-25],[5,-16],[16,-27],[13,-19],[34,-27],[17,-27],[21,-17],[6,-7],[3,-6],[-14,-17],[-12,-61],[-14,-19],[9,-47],[5,-16],[10,-24],[7,-24],[3,-61],[4,-24],[12,-25],[12,-83],[45,-168],[18,-49],[19,-32],[13,-16],[29,-11],[13,-21],[51,-71],[28,-53],[-1,-40],[-6,-36],[1,-19],[4,-21],[15,-36],[5,-17],[3,-34],[4,-31],[19,-76],[-1,-31]],[[3878,3253],[-109,-125],[-48,-69],[-11,-74],[-28,-75],[-71,-94],[-18,-70],[-16,-34],[-3,-12],[2,-8],[12,-5],[8,-7],[6,-11],[1,-8],[-15,-46],[-31,-6],[-23,6],[-20,0],[-31,-18],[8,-40],[39,-78],[40,-45],[11,-9],[4,-14],[3,-25],[-5,-89],[-16,-46],[-17,-27],[-24,-19],[-51,13],[6,-32],[2,-17],[-1,-19],[-8,-22],[-3,-29],[2,-44],[-6,-104],[-28,-102],[-24,-49],[-7,-8],[-23,0],[-36,10],[-12,9],[-33,45],[-22,15],[-10,-18],[-3,-8],[-2,-18],[-1,-32],[1,-31],[4,-24],[9,-17],[17,-47],[-1,-35],[-11,-24],[-11,-36],[-4,-39],[-1,-10],[-7,2],[-70,46],[-46,-23]],[[3146,1557],[-72,39],[-50,-9],[-15,10],[-17,14],[-59,-11],[-20,29],[-28,41],[-3,29],[10,38],[2,9],[-6,3],[-9,0],[-6,-3],[-17,6],[-17,7],[-28,-1],[-16,-7],[-5,-26],[-4,-59],[-8,-49],[1,-32],[6,-30]],[[2785,1555],[-12,-10],[-14,7],[-39,36],[-52,59],[-4,8],[-7,6],[-5,4],[-27,-5],[-45,13],[-60,62],[-11,25],[3,98],[1,67]],[[2513,1925],[40,78],[12,52],[4,9],[4,15],[11,80],[2,43],[-27,296]],[[2559,2498],[1,46],[31,55],[11,15],[9,7],[10,0],[46,8],[42,29],[18,16],[9,17],[1,12],[16,48],[29,27],[38,13],[11,9],[6,14],[0,13],[-2,10],[-5,14],[-2,4],[-3,3],[-5,3],[-5,3],[-7,7],[-8,11],[-9,15],[-4,13],[-4,24],[-2,89],[2,24],[4,13],[7,4],[7,0],[8,-2],[18,-13],[11,6],[8,8],[38,78],[15,48],[-5,16],[-35,42],[-3,6],[-1,7],[5,6],[3,10],[1,21],[-3,11],[-4,8],[-34,46],[-24,23],[-7,16],[-6,21],[-4,18],[-4,35],[74,111],[13,40],[1,11],[2,13],[1,13],[0,33],[2,9],[5,5],[5,-1],[7,-3],[6,-5],[7,-4],[6,-2],[5,-1],[4,1],[4,-1],[2,-4],[2,-9],[2,-4],[5,-4],[6,-2],[6,-2],[16,-2],[22,58],[5,31],[0,12],[-1,13],[-2,17],[1,8],[2,3],[2,-3],[2,-3],[3,-3],[5,2],[2,6],[1,14],[2,6],[3,3],[5,1],[8,4],[13,15],[5,3],[5,2],[7,4],[7,5],[11,12],[3,5],[0,4],[-1,4],[1,9],[16,62],[9,53],[-7,77],[-6,35],[1,35],[4,22],[5,11],[4,7],[4,2],[31,4],[24,27],[-15,34],[-2,16],[-7,12],[-6,7],[-25,17]],[[3100,4320],[28,59],[9,32],[15,32],[29,38],[5,13],[2,13],[2,46],[-1,23],[26,33],[70,14],[14,-2],[17,-5],[12,-9],[22,-9],[79,5],[49,-16]],[[9960,4714],[0,-1],[1,-4],[-2,-1],[-1,1],[-1,3],[3,2]],[[9785,4749],[1,-2],[0,1],[1,-4],[-2,-2],[-1,2],[-1,3],[2,2]],[[9907,4832],[-1,-2],[-2,4],[3,5],[0,-7]],[[9923,4850],[0,-2],[1,1],[0,-4],[-2,-1],[0,1],[-2,3],[3,2]],[[9755,4902],[-6,-7],[-2,4],[8,3]],[[9999,4900],[-3,0],[0,8],[3,-8]],[[9993,4938],[-1,-1],[-3,6],[4,-5]],[[9984,4964],[0,-2],[1,1],[0,-4],[-1,-2],[-1,1],[-2,4],[3,2]],[[9968,4971],[-5,-5],[-2,6],[7,-1]],[[9843,4988],[-1,-9],[-3,3],[4,6]],[[9922,4995],[-2,-1],[-2,3],[4,7],[0,-9]],[[9900,5063],[-2,-10],[-5,8],[7,2]],[[9757,5067],[-3,-6],[-2,5],[3,10],[2,-9]],[[9860,5102],[-2,0],[-2,10],[4,-10]],[[8883,6439],[-1,-5],[-2,6],[3,-1]],[[8872,6476],[-1,-4],[-2,2],[1,1],[1,1],[1,0]],[[8869,6481],[0,-2],[1,0],[0,-3],[0,-1],[-1,-1],[-1,1],[-2,3],[3,3]],[[8867,6486],[1,-2],[-1,0],[0,2]],[[8867,6488],[0,-1],[-5,7],[5,-6]],[[8934,6606],[-1,-5],[0,1],[-1,4],[2,0]],[[8938,6615],[1,-1],[1,-4],[-2,-1],[-1,1],[-1,3],[2,2]],[[8931,6622],[-2,-2],[0,2],[1,5],[1,-5]],[[8915,6628],[1,-3],[-2,0],[1,3]],[[8921,6625],[-1,0],[1,3],[0,-3]],[[8925,6645],[-1,-5],[-1,2],[2,3]],[[8908,6708],[1,-2],[0,1],[1,-4],[-2,-2],[-1,2],[-2,3],[3,2]],[[8899,6710],[-2,-1],[-2,1],[2,3],[2,-3]],[[6387,3970],[0,1],[0,537],[0,198]],[[6387,6776],[72,-36],[141,-95],[177,-78],[83,-43],[21,-23],[-9,-28],[-18,-42],[0,-35],[0,-56],[30,-45],[29,-6],[36,18],[5,45],[4,21],[14,-2],[10,-28],[26,-26],[37,8],[35,-6],[72,-14],[13,23],[23,15],[-31,20],[-37,12],[-116,29],[-43,28],[-37,27],[-13,36],[59,-19],[201,-56],[131,-20],[87,-7],[30,-15],[79,-99],[108,-130],[159,-201],[154,-197],[86,-107],[112,-102],[27,-24],[27,-18],[52,-13],[13,-10],[10,-22],[0,-17],[-9,-12],[-22,-4],[-26,15],[-55,65],[-41,21],[-28,30],[-14,9],[-44,1],[-20,6],[-17,25],[7,4],[6,7],[7,3],[-12,28],[-49,81],[-10,0],[-16,-12],[-19,18],[-21,25],[-19,14],[-30,-6],[-13,-14],[-11,-19],[-21,-21],[-9,9],[-40,21],[18,25],[8,14],[4,15],[-7,5],[-16,4],[-17,1],[-11,-4],[-4,-24],[9,-39],[17,-41],[18,-33],[-3,-4],[-2,-2],[-1,-3],[-3,-7],[-10,0],[-44,127],[-16,26],[-17,5],[-19,-6],[-25,-12],[-18,1],[-25,9],[-17,3],[11,-51],[9,-17],[27,-14],[1,-19],[-5,-25],[-3,-27],[10,0],[4,34],[30,21],[13,62],[14,7],[13,-12],[20,-74],[24,-60],[8,-51],[-31,-21],[-15,-25],[11,-57],[25,-62],[25,-39],[37,-30],[32,-11],[13,21],[-13,66],[19,-23],[18,-31],[6,-34],[-12,-36],[20,-38],[29,-7],[71,14],[0,-15],[-14,0],[-9,-4],[-17,-12],[0,-14],[13,-38],[17,-35],[24,-26],[31,-10],[27,5],[34,13],[33,19],[22,25],[-19,26],[-62,51],[-10,15],[-5,15],[-6,11],[-14,5],[-15,1],[-112,59],[-19,18],[-34,73],[-16,19],[13,17],[14,12],[33,17],[130,-85],[21,-46],[9,-24],[20,-22],[24,-16],[42,-13],[17,-19],[15,-25],[13,-28],[-10,-10],[-11,-15],[-9,-6],[0,-14],[24,-8],[21,22],[15,3],[11,-66],[-3,-83],[3,-23],[11,-16],[11,1],[7,16],[0,30],[11,0],[13,-44],[12,10],[25,66],[23,20],[30,13],[52,10],[7,11],[-3,51],[2,18],[10,10],[9,-1],[11,-6],[95,-27],[25,7],[0,-14],[-9,-13],[1,-9],[5,-10],[3,-17],[0,-67],[-8,-34],[-17,-14],[-17,9],[-7,39],[-6,11],[-12,8],[-16,4],[-12,1],[-9,-9],[-8,-21],[-9,-33],[-7,-12],[-6,-7],[-5,-11],[-2,-24],[3,-20],[9,-4],[10,6],[8,11],[-8,19],[-1,14],[3,14],[6,14],[11,0],[3,-55],[10,-40],[18,-15],[29,18],[8,13],[13,33],[9,14],[11,11],[66,35],[-1,8],[-6,24],[-7,14],[-8,10],[-8,14],[-6,22],[-5,32],[-11,43],[-18,26],[-27,-21],[-44,39],[-21,7],[-26,-16],[-9,15],[3,8],[6,23],[-24,4],[-63,35],[-13,15],[-15,25],[-31,15],[-23,19],[9,42],[24,17],[23,-18],[20,-30],[18,-15],[16,-8],[158,-123],[197,-111],[75,-83],[18,-42],[23,-145],[26,-90],[39,-86],[44,-54],[181,-107],[-19,-5],[-50,5],[-20,-6],[-39,-27],[-65,2],[-6,-2],[-17,11],[-11,11],[1,12],[17,13],[-64,10],[-25,-3],[-22,-21],[-8,29],[-15,15],[-19,11],[-18,22],[-14,-40],[-23,-37],[-30,-27],[-34,-6],[-14,11],[-17,41],[-8,11],[-19,5],[-15,-2],[-5,-12],[10,-21],[-8,-15],[-2,-14],[-1,-34],[-15,20],[-8,-10],[-2,-26],[5,-31],[-8,6],[-22,10],[3,-7],[4,-16],[3,-8],[-21,-9],[-37,-44],[-36,-20],[-7,-24],[-3,-30],[-6,-28],[-11,0],[-12,24],[-27,12],[-33,2],[-29,-6],[-27,-19],[-6,-25],[14,-65],[-11,0],[-5,19],[-11,10],[-15,4],[-19,-2],[3,-35],[-30,-18],[-82,-7],[11,-27],[7,-11],[11,-11],[-27,-1],[-29,-14],[-26,-21],[-18,-24],[-8,16],[-5,5],[-6,3],[-11,6],[8,-21],[1,-9],[-18,7],[-24,38],[-18,15],[-7,-52],[0,-21],[7,-18],[-144,-12],[-25,5],[-3,17],[-8,6],[-24,-1],[-16,3],[-5,8],[-4,11],[-34,32],[-10,-2],[-16,-20],[17,-53],[10,-20],[13,-19],[0,-17],[-10,-9],[-7,1],[-6,5],[-13,3],[-13,-4],[-8,-9],[-5,-11],[-9,-8],[-36,-15],[-21,-3],[-18,11],[-35,56],[-11,14],[-13,11],[-20,11],[-19,-2],[-8,-27],[8,-106],[-8,-49],[-30,-24],[-16,2],[-36,12],[-22,3],[-11,12],[-11,58],[-14,22],[-19,-42],[-20,-57],[-27,-50],[-55,-29],[-38,-31],[-16,-7],[-23,10],[-15,19],[-15,13],[-23,-10],[5,44],[5,16],[-106,5],[-33,10],[-57,37],[-28,4],[-27,-24],[-22,77],[-16,38],[-29,30],[1,30],[-4,27],[-29,6],[1,4],[11,22],[5,7],[-22,53],[-32,36],[-38,17],[-39,-3],[-87,-24],[-24,-20],[-67,-97],[-26,-28],[-23,-23]],[[8840,6873],[-3,-3],[-3,11],[6,-8]],[[8833,6881],[-3,-1],[-1,7],[4,-6]],[[3634,7039],[3,-26],[-27,2],[-23,-9],[-40,-24],[-34,-29],[-23,26],[-27,13],[13,26],[65,48],[38,12],[21,5],[20,8],[17,-1],[9,-14],[-12,-37]],[[4627,7755],[-31,-23],[-29,13],[-44,-16],[-31,10],[-26,-6],[-10,-8],[-20,-20],[-9,-5],[-13,-1],[-21,-8],[-26,-28],[-54,-39],[-53,-29],[-55,-58],[-51,-24],[-33,-5],[-23,-32],[-25,-36],[-29,-30],[-9,35],[11,55],[42,52],[58,54],[45,28],[88,63],[95,46],[63,28],[44,8],[58,-6],[46,-4],[72,-1],[-30,-13]],[[4711,7811],[11,-7],[12,4],[7,-3],[-5,-16],[-13,-14],[-9,3],[-8,4],[-9,-1],[-10,-4],[-8,-3],[0,11],[24,22],[8,4]],[[5076,7787],[-75,-75],[-6,20],[15,40],[20,56],[23,16],[23,60],[17,32],[48,32],[28,-15],[22,-27],[-7,-28],[-33,-5],[-7,-33],[-20,-38],[-29,-3],[-19,-32]],[[8001,9979],[-1,-14],[-10,3],[0,12],[11,-1]],[[7979,9982],[-14,-5],[-13,1],[-9,7],[-7,14],[12,-2],[10,-3],[11,-5],[10,-7]],[[6387,3970],[-3,-3],[-20,-29],[-13,-35],[-8,-83],[-5,-14],[-7,-5],[-23,-9],[8,-22],[41,-44],[-32,-46],[-9,-17],[38,0],[-2,-8],[-9,-30],[-52,-78],[-31,-22],[-25,28],[-23,38],[-27,10],[-11,-32],[-7,-62],[-2,-114],[-6,-15],[-33,-54],[-2,-14],[3,-34],[-1,-15],[-41,-46],[24,-23],[26,-36],[19,-45],[1,-51],[-17,-37],[-30,-27],[-36,-18],[-36,-10],[-56,0],[-15,-5],[-35,-26],[-14,-5],[-8,-13],[-6,-15],[-10,-19],[-4,-16],[-4,-7],[-6,-2],[-16,3],[-6,-1],[-14,-21],[-17,-33],[-14,-35],[-11,-58],[-12,-43],[-16,-43],[-17,-32],[-38,-44],[-25,-22],[-53,-22],[-8,-29],[-3,-36],[-14,-31],[-27,-14],[-24,-6]],[[5563,2393],[-1,1],[-18,73],[-6,10],[-12,13],[-11,10],[-15,17],[-6,17],[-2,23],[0,26],[-6,47],[-9,28],[-14,24],[-23,29],[-13,6],[-7,-2],[-2,-17],[-5,-2],[-10,1],[-56,26],[-69,23],[-9,-2],[-6,-10],[-18,-52],[-6,-8],[-9,-4],[-20,5],[-14,12],[-19,20],[-15,3],[-12,-2],[-6,-6],[-6,-8],[-6,-6],[-15,-10],[-5,-7],[-4,-8],[-3,-11],[-1,-23],[-2,-10],[-3,-10],[-8,-8],[-11,-6],[-20,-1],[-10,3],[-16,21],[-29,57],[-57,39],[-11,14],[-7,18],[-2,20],[-6,31],[-9,30],[-18,45],[-15,20],[-16,12],[-26,9],[-6,0],[-6,-3],[-5,-6],[-4,-7],[-5,-19],[-6,-9],[-12,-1],[-37,13],[-42,23],[-10,17],[-39,106],[-14,24],[-12,10],[-19,5],[-38,1],[-15,-3],[-28,-12],[-22,-16],[-15,-14],[-9,-4],[-8,-6],[-7,-8],[-14,-20],[-33,-30],[-11,-7],[-17,-4],[-107,10],[-14,7],[-7,9],[-8,31],[-7,15],[-7,11],[-27,30],[-34,14],[-5,6],[-30,44],[-82,34],[-31,6],[-11,-3],[-6,3],[-6,9],[-7,23],[-15,25],[-6,6],[-6,1],[-15,-3],[-5,-4],[-5,-3],[-14,-2],[-8,2],[-63,39]],[[3478,4587],[21,55],[5,7],[9,9],[6,0],[12,-4],[44,18],[29,40],[22,22],[8,21],[2,17],[1,14],[1,15],[3,16],[7,20],[10,25],[3,13],[0,8],[-1,9],[0,7],[12,38],[-12,136],[1,19],[5,30],[5,9],[6,7],[10,3],[22,17],[5,3],[12,14],[4,19],[68,22],[45,-55],[12,-5],[16,-4],[27,0],[11,4],[10,7],[14,17],[15,7],[10,32],[11,21],[15,57],[5,13],[8,9],[6,-2],[7,-2],[8,-1],[10,6],[125,101],[18,7],[16,0],[35,-16],[21,-17],[19,-19],[13,-18],[12,-19],[7,-16],[5,-13],[9,-12],[16,-8],[35,0],[20,3],[38,27],[81,74],[19,9],[65,71]],[[3100,4320],[-39,53],[-10,4],[-9,3],[-9,-13],[-8,-4],[-9,7],[-11,14],[-6,5],[-53,20],[-35,4],[-28,-41],[-36,-27],[-22,0],[-16,5],[-7,7],[-4,6],[0,5],[0,6],[0,5],[-4,14],[-1,10],[-5,16],[-2,12],[0,11],[1,21],[-2,11],[-4,14],[-8,6],[-6,12],[-6,6],[-14,7],[-7,8],[-7,9],[-3,8],[-3,10],[-4,28],[-5,20],[-15,34],[-11,17],[-19,20],[-9,5],[-7,3],[-4,-2],[-5,-3],[-43,-47],[-5,-19],[-64,-22],[-17,3],[-136,-3]],[[2383,4588],[-8,101],[1,15],[4,16],[6,6],[2,8],[0,12],[-2,17],[-6,23],[-1,15],[-43,64],[-23,-6],[-7,1],[-9,5],[-3,22],[-5,9],[-16,1],[-5,2],[-5,8],[-7,4],[-21,-1],[-9,2],[-3,11],[-2,9],[-4,10],[-6,10],[-22,25],[-15,6],[-28,3],[-31,-12],[-6,7],[0,9],[4,22],[-1,15],[5,32],[0,27],[-2,3],[-3,3],[-9,-6],[-6,-1],[-6,17],[13,32],[-3,24],[4,15],[2,15],[0,16],[-2,15],[17,27],[4,11],[0,8],[-2,7],[-1,7],[2,7],[7,6],[20,8],[8,7],[14,16],[7,5],[5,7],[11,19],[35,89],[22,27],[5,18],[-5,31],[-15,22],[-18,14],[-9,13],[9,20],[16,0],[16,-17],[12,-3],[4,40],[-8,29],[-12,28],[-6,31],[17,42],[14,15],[8,32],[6,36],[10,31],[4,-1],[9,-5],[10,-2],[10,8],[-1,8],[10,58],[4,7],[-22,52],[-38,46],[-24,41],[21,36],[-27,9],[8,22],[45,44]],[[2546,615],[-33,-8],[-17,4],[-6,4],[-7,7],[0,14],[10,0],[-5,12],[-9,25],[-6,12],[24,12],[19,4],[43,-2],[5,-16],[-3,-35],[-15,-33]],[[2549,877],[14,-7],[40,13],[21,1],[0,-14],[-25,-18],[17,-89],[-22,-32],[-68,33],[-31,29],[4,39],[19,42],[13,13],[18,-10]],[[2785,1555],[3,-5],[25,-32],[13,-10],[10,-11],[6,-15],[-4,-89],[7,-17],[6,-18],[2,-15],[21,-69],[52,-58],[-5,-47],[3,-21],[8,-34],[16,-47],[3,-46],[-16,-55],[-30,-35]],[[2905,931],[-22,30],[-10,11],[-13,4],[-30,-8],[-11,3],[-14,22],[-25,-28],[-8,-12],[-7,-22],[-3,-30],[5,-16],[1,-13],[-14,-18],[-9,-1],[-51,1],[-23,-8],[-13,-1],[-14,9],[0,16],[21,0],[0,14],[-28,9],[-28,15],[-26,3],[-19,-27],[-10,0],[3,22],[16,56],[-20,12],[-4,24],[5,64],[-8,34],[-18,-6],[-20,-26],[-15,-25],[14,-64],[-22,-60],[-39,-44],[-42,-17],[-26,8],[-34,31],[-28,14],[-2,16],[0,15],[-5,7],[-15,1],[-10,4],[-20,11],[115,80],[25,43],[4,29],[-3,30],[-8,27],[-11,19],[-21,13],[-31,-16],[-15,8],[-16,52],[9,62],[35,127],[3,41],[-1,84],[6,40],[12,27],[15,21],[7,24],[-9,38],[7,37],[30,102],[13,32],[-26,16],[-41,53]],[[2363,1950],[22,7],[61,3],[35,-35],[32,0]],[[2559,2498],[-52,-8],[-19,-21],[-38,-56],[-1,76],[-9,24],[-10,20],[-16,12],[-26,33],[-16,14],[-16,10],[-15,5],[-24,14],[-6,8],[-1,8],[2,12],[3,9],[7,35],[-20,36],[-51,32],[-4,45],[4,15],[3,3],[4,2],[3,-1],[8,-5],[55,20],[29,-4],[23,5],[19,7],[31,17],[14,10],[19,22],[22,-5],[23,7],[13,8],[7,8],[14,27],[4,29],[-12,17],[10,24],[-5,44],[-4,17],[-18,58],[-6,8],[-66,-40],[-12,5],[-16,2],[-30,16],[-15,12],[-45,14],[-4,2],[-14,22],[-1,4],[-58,24],[-20,31],[-15,34]],[[2211,3265],[6,8],[1,5],[1,7],[-1,8],[-11,32],[-47,89],[-17,25],[1,21],[0,23],[-6,10],[-9,11],[-35,26],[-12,14],[-9,28],[-3,14],[-2,24],[-1,8],[-12,34],[-14,27],[-26,15],[-25,27],[-51,19],[-11,2],[-14,7],[-8,5],[-20,42]],[[1886,3796],[19,47],[-14,57],[-9,23],[1,31],[4,17],[7,10],[17,11],[7,8],[45,69],[52,15],[2,98]],[[2017,4182],[8,-36],[10,-22],[15,-16],[116,123],[21,42],[32,50],[6,6],[32,11],[28,20],[66,73],[25,33],[7,48],[0,74]],[[2017,4182],[-3,93],[-12,52],[-45,63],[-33,1],[-6,4],[-5,36],[10,95],[9,19],[19,102],[18,30],[-6,16],[-10,6],[-10,14],[-10,7],[-33,17],[-42,41],[-17,30],[-11,38],[8,42],[60,96],[8,35],[-29,13],[-19,19],[-12,13],[-31,97],[-11,219],[-5,11],[-36,10],[-14,11],[-20,20],[-22,27],[-43,39],[-10,15],[-6,14],[-3,13],[-2,13],[1,16],[3,27],[0,12],[-3,21],[1,18],[-2,9],[-10,13],[-20,17],[-139,64],[-78,18],[-83,-44],[-1,0]],[[1312,5724],[100,117],[68,99],[44,114],[9,16],[30,1],[24,13],[21,18],[25,16],[9,-17],[10,30],[-1,25],[5,20],[17,9],[8,-5],[67,-71],[35,-16],[39,25],[85,135],[36,34],[-8,36],[15,7],[57,-12],[86,77],[10,31],[3,22],[-8,10],[-16,7],[-13,16],[-7,16],[6,7],[62,2],[24,11],[24,26],[43,21],[126,13],[26,11],[9,32],[12,5]],[[2211,3265],[-65,-73],[-18,-14],[-18,-12],[-15,0],[-12,4],[-10,6],[-7,-1],[-4,-12],[-4,-30],[6,-69],[-23,-67],[-8,-14],[-14,-15],[-17,-10],[-9,-11],[-6,-29],[1,-17],[-12,-31],[-61,-4],[-50,-62],[-24,-37],[-13,-46],[-12,-26],[-4,-6],[-42,-32],[-16,-22],[-79,-132],[-10,-13],[-5,3],[-4,-7],[0,-10],[10,-23],[9,-15],[13,-42],[-13,-113],[2,-5],[0,-1]],[[1677,2277],[-3,2],[-22,3],[-14,-8],[-1,-8],[1,-44],[3,-8],[13,-18],[3,-6],[-7,-31],[-9,-3],[-13,3],[-18,-12],[-9,-15],[-6,-16],[-5,-13],[-12,-17],[-16,-8],[-17,-2],[-16,-9],[-10,-28],[-10,6],[-11,5],[-12,3],[-10,0],[-4,-8],[-1,-14],[0,-14],[-2,-6],[-11,1],[-23,14],[-14,1],[-59,-19],[-27,-17],[-27,-25],[-39,-3],[13,32],[-1,36],[-16,59],[-4,21],[3,34],[5,27],[1,26],[-8,25],[-1,5],[6,-1],[1,1]],[[1268,2228],[4,3],[16,33],[1,6],[4,11],[25,27],[47,32],[82,72],[32,45],[14,8],[7,3],[4,3],[4,9],[0,18],[1,14],[3,10],[7,13],[5,6],[4,32],[-10,99],[-3,49],[1,9],[0,22],[2,9],[-2,23],[-27,23],[-31,10],[-9,1],[-8,-1],[-7,-2],[-6,1],[-7,3],[-8,7],[-9,9],[-10,7],[-8,7],[-7,8],[-3,12],[1,16],[14,46],[2,41],[-15,112],[-10,20],[-5,7],[-32,6],[-30,40],[-29,58],[-10,94],[5,17],[24,24],[36,16],[67,-1],[34,7],[40,32],[16,38],[3,26],[8,43],[29,78],[-17,142],[-14,41]],[[1493,3772],[114,-12],[85,13],[65,9],[49,-15],[43,-6],[10,11],[27,24]],[[2363,1950],[-24,30],[-8,8],[-21,11],[-8,7],[-11,27],[-15,59],[-13,17],[-22,-2],[-15,-18],[-12,-23],[-14,-15],[-15,-2],[-28,9],[-15,2],[-11,-6],[-19,-22],[-7,-5],[-10,4],[-21,21],[-9,3],[-3,1],[-22,-9],[-66,-50],[-13,56],[-23,43],[-27,37],[-22,38],[-21,83],[-17,21],[-39,3],[-76,-13],[-23,1],[-36,11]],[[1493,3772],[31,78],[8,69],[-9,26],[-18,-3],[-25,5],[-21,17],[-24,59],[-8,15],[41,105],[-30,27],[-39,-1],[-18,38],[-3,6],[-17,10],[-12,-1],[-17,-24],[-15,-36],[-23,-29],[-11,-6],[-27,51],[-40,99],[-32,127],[-69,15],[-11,-9],[-51,-23]],[[1053,4387],[-52,-14],[-9,4],[-9,9],[-5,13],[-3,14],[-3,11],[-4,19],[19,74],[15,78],[2,40],[13,43],[36,46],[3,16],[-1,17],[-3,13],[-12,27],[-6,12],[-10,56],[18,35],[-1,8],[-3,9],[-12,13],[-24,16],[-30,48],[-27,46],[2,31],[2,14],[-1,18],[-61,114],[-5,9]],[[882,5226],[127,147],[127,147],[128,148],[48,56]],[[1053,4387],[7,-71],[-6,-60],[-19,-21],[3,-24],[-3,-10],[-11,-20],[-8,-11],[-6,-17],[-4,-19],[-2,-30],[1,-33],[10,-25],[15,-50],[7,-41],[0,-13],[-1,-13],[-11,-2],[-42,-18],[-53,-6],[-73,13],[-21,-11],[-3,-33],[1,-10],[16,-57],[44,-63],[11,-24],[17,-47],[5,-137]],[[927,3534],[-35,-4],[-28,7],[-12,0],[-14,-3],[-14,-6],[-24,-13],[-10,-11],[-5,-18],[0,-27],[0,-9],[4,-7],[1,-7],[-4,-4],[-15,-7],[-18,5],[-17,23],[-20,7],[-26,17],[-26,40],[-19,46],[-3,16],[1,59],[-9,31],[-94,106],[-12,32],[-11,68],[-22,47],[-88,18],[-19,-10],[-47,-21],[-23,-10]],[[318,3899],[-6,15],[-13,18],[-16,30],[-28,100],[-14,34],[-29,53],[-13,29],[-7,31],[2,43],[11,26],[36,47],[15,30],[11,24],[18,64],[0,59],[-29,40],[24,104],[17,40],[20,25],[10,12],[45,34],[148,74],[51,36],[185,214],[126,145]],[[1268,2228],[1,2],[1,5],[1,7],[-13,19],[-14,9],[-65,8],[-111,53],[-37,3],[-37,-8],[-9,-5],[0,4],[0,11],[-3,19],[-7,15],[-11,14],[-6,4],[-32,6],[-23,22],[1,32],[9,37],[1,38],[-10,26],[-13,-2],[-15,-14],[-18,-10],[-64,7],[-26,-6],[-9,64],[-22,67],[-31,58],[-36,35],[-23,0],[-20,-13],[-18,-15],[-14,-5],[-13,14],[-5,24],[-1,19]],[[576,2772],[2,60],[-3,73],[-12,55],[2,17],[6,12],[10,13],[9,15],[13,31],[9,16],[9,10],[24,4],[47,33],[8,19],[9,31],[2,29],[3,22],[9,5],[10,0],[14,-26],[8,-11],[17,-12],[38,2],[-18,36],[-1,11],[0,16],[4,21],[2,5],[3,1],[9,-10],[31,-7],[43,21],[11,10],[9,11],[4,9],[4,26],[38,168],[-5,34],[-4,4],[-13,8]],[[576,2772],[-1,10],[-5,28],[-13,34],[-14,24],[-37,42],[-7,20],[-5,69],[-10,28],[-23,18],[-50,9],[-17,21],[6,22],[1,23],[-3,23],[-7,20],[-9,17],[-7,10],[-8,3],[-13,-6],[-12,-18],[-21,-61],[-14,-19],[-68,31],[-37,39],[-74,24],[-46,32],[-56,14],[-23,5],[-3,70],[3,36],[9,29],[15,15],[33,12],[12,19],[14,40],[21,33],[45,59],[14,24],[7,18],[11,11],[25,5],[18,-5],[37,-19],[16,2],[18,25],[7,37],[0,40],[-6,113],[5,14],[16,26],[4,17],[-3,39],[-3,5]],[[3146,1557],[-14,-95],[10,-29],[16,-8],[12,-21],[10,-12],[6,-43],[4,-28],[21,-18],[67,-6],[12,-14],[1,-22],[13,-42],[25,-31],[18,-3],[10,5],[45,39],[33,57],[4,34],[5,18],[16,23],[22,10],[11,11],[16,19],[24,38],[11,25],[6,21],[5,41],[3,8],[10,-5],[7,-5],[44,7],[5,-17],[57,55],[12,7],[25,4],[11,-1],[10,3],[12,28],[10,13],[11,3],[21,13],[2,1]],[[3795,1640],[-5,-120],[3,-20],[6,-12],[6,-7],[13,-14],[5,-15],[1,-36],[-9,-72],[1,-38],[47,-271],[-2,-35],[-19,-62],[-2,-32],[5,-23],[9,-6],[10,-4],[10,-13],[10,-29],[3,-13],[9,-65],[-3,-34],[-12,-30],[-20,-28],[-10,-11],[-11,-10],[-13,-6],[-14,7],[-84,62],[-26,3],[-23,-10],[-20,-20],[-70,-91],[-12,-22],[-10,-30],[-11,-64],[-2,-6],[3,-13],[11,-36],[2,-5],[-12,-119],[3,-14],[9,-6],[5,-8],[-4,-22],[-7,-11],[-22,-17],[-8,-9],[-34,-81],[-17,-27],[-37,-36],[-31,-22],[-8,-37],[-17,2],[-34,31],[-21,3],[-336,-32],[1,1],[14,15],[4,28],[11,22],[16,17],[20,11],[0,14],[-41,2],[-29,9],[-22,19],[-19,33],[-10,22],[-2,12],[3,36],[9,5],[45,10],[15,7],[-85,34],[-48,8],[-27,-13],[-9,0],[-4,87],[-20,89],[-28,79],[-29,56],[-9,36],[-2,2],[-4,9],[-8,-1],[-10,-3],[-7,3],[-10,20],[-5,18],[2,19],[13,21],[12,12],[25,17],[13,17],[29,63],[11,14],[20,-6],[23,8],[47,28],[-2,19],[0,13],[2,15]],[[5563,2393],[-13,-4],[-32,-15],[-14,-32],[-14,-22],[-51,-23],[4,-24],[-4,-2],[-4,0],[-2,-3],[0,-10],[-9,0],[-12,5],[-30,-38],[-19,-14],[-26,3],[-15,5],[-7,-12],[-2,-49],[-14,-68],[-6,-44],[5,-19],[22,-10],[9,-27],[-4,-34],[-12,-37],[-10,-14],[-3,-4],[-1,1],[-3,1],[-19,33],[-30,4],[-34,-2],[-32,17],[-24,43],[-14,46],[-17,39],[-32,21],[-20,-2],[-14,-8],[-13,-4],[-21,10],[-9,14],[-32,63],[-103,112],[-5,60],[16,48],[1,25],[-112,-25],[-21,-15],[-16,-23],[-8,-19],[-5,-22],[-11,-28],[-17,-27],[-18,-14],[-17,-10],[-15,-15],[-51,-119],[-96,-154],[-23,-55],[-11,-67],[-9,-34],[-17,-29],[-22,-16],[-26,-10],[-76,-7],[-10,2],[-14,7],[-9,9],[-23,36],[-21,-5],[-20,-15],[-21,-11],[-26,11],[-49,40],[-57,-5],[-120,-34],[-64,12],[-30,-4],[-33,-25],[-17,-17],[-7,-10],[-3,-13],[-3,-32],[-1,-39]]],"transform":{"scale":[0.0006832584089408926,0.0004439313159315904],"translate":[-89.36379125999991,12.979777324000082]}};
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
