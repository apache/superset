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
  Datamap.prototype.hndTopo = '__HND__';
  Datamap.prototype.hrvTopo = '__HRV__';
  Datamap.prototype.htiTopo = '__HTI__';
  Datamap.prototype.hunTopo = '__HUN__';
  Datamap.prototype.idnTopo = '__IDN__';
  Datamap.prototype.imnTopo = '__IMN__';
  Datamap.prototype.indTopo = {"type":"Topology","objects":{"ind":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":null},"id":"-99","arcs":[[0]]},{"type":"Polygon","properties":{"name":"Chandigarh"},"id":"IN.CH","arcs":[[1,2]]},{"type":"Polygon","properties":{"name":"Delhi"},"id":"IN.DL","arcs":[[3,4]]},{"type":"Polygon","properties":{"name":"Himachal Pradesh"},"id":"IN.HP","arcs":[[5,6,7,8,9]]},{"type":"Polygon","properties":{"name":"Haryana"},"id":"IN.HR","arcs":[[10,-5,11,12,13,-2,14,-8]]},{"type":"Polygon","properties":{"name":"Jammu and Kashmir"},"id":"IN.JK","arcs":[[-10,15,16]]},{"type":"MultiPolygon","properties":{"name":"Andhra Pradesh"},"id":"IN.AP","arcs":[[[17]],[[18,19,20,21,22,23,24,25],[26]]]},{"type":"Polygon","properties":{"name":"Kerala"},"id":"IN.KL","arcs":[[27,28,29,30,31]]},{"type":"MultiPolygon","properties":{"name":"Lakshadweep"},"id":"IN.LD","arcs":[[[32]],[[33]],[[34]],[[35]],[[36]],[[37]],[[38]],[[39]],[[40]],[[41]],[[42]]]},{"type":"Polygon","properties":{"name":"Orissa"},"id":"IN.OR","arcs":[[43,44,-20,45,46]]},{"type":"Polygon","properties":{"name":"Dadra and Nagar Haveli"},"id":"IN.DN","arcs":[[47,48]]},{"type":"Polygon","properties":{"name":"Karnataka"},"id":"IN.KA","arcs":[[-25,49,-32,50,51,52]]},{"type":"Polygon","properties":{"name":"Maharashtra"},"id":"IN.MH","arcs":[[53,-26,-53,54,55,56,-48,57,58]]},{"type":"MultiPolygon","properties":{"name":"Andaman and Nicobar"},"id":"IN.AN","arcs":[[[59]],[[60]],[[61]],[[62]],[[63]],[[64]],[[65]],[[66]],[[67]],[[68]],[[69]],[[70]],[[71]],[[72]],[[73]],[[74]],[[75]],[[76]],[[77]],[[78]],[[79]],[[80]],[[81]],[[82]]]},{"type":"Polygon","properties":{"name":"Assam"},"id":"IN.AS","arcs":[[83,84,85,86,87,88,89,90,91,92]]},{"type":"Polygon","properties":{"name":"Manipur"},"id":"IN.MN","arcs":[[93,94,-85,95]]},{"type":"Polygon","properties":{"name":"Nagaland"},"id":"IN.NL","arcs":[[96,-96,-84,97]]},{"type":"Polygon","properties":{"name":"Meghalaya"},"id":"IN.ML","arcs":[[98,-89]]},{"type":"Polygon","properties":{"name":"Punjab"},"id":"IN.PB","arcs":[[-15,-3,-14,99,100,-16,-9]]},{"type":"Polygon","properties":{"name":"Rajasthan"},"id":"IN.RJ","arcs":[[-13,101,102,103,104,-100]]},{"type":"Polygon","properties":{"name":"Uttar Pradesh"},"id":"IN.UP","arcs":[[105,106,107,108,109,-102,-12,-4,-11,110]]},{"type":"Polygon","properties":{"name":"Uttaranchal"},"id":"IN.UT","arcs":[[-111,-7,111]]},{"type":"Polygon","properties":{"name":"Jharkhand"},"id":"IN.JH","arcs":[[112,-47,113,-108,114]]},{"type":"MultiPolygon","properties":{"name":"West Bengal"},"id":"IN.WB","arcs":[[[115]],[[116]],[[117]],[[118]],[[119,-91,120,-44,-113,121,122,123]]]},{"type":"Polygon","properties":{"name":"Bihar"},"id":"IN.BR","arcs":[[-122,-115,-107,124]]},{"type":"Polygon","properties":{"name":"Sikkim"},"id":"IN.SK","arcs":[[-124,125]]},{"type":"Polygon","properties":{"name":"Chhattisgarh"},"id":"IN.CT","arcs":[[-46,-19,-54,126,-109,-114]]},{"type":"Polygon","properties":{"name":"Madhya Pradesh"},"id":"IN.MP","arcs":[[-127,-59,127,-103,-110]]},{"type":"MultiPolygon","properties":{"name":"Puducherry"},"id":"IN.PY","arcs":[[[128,129]],[[130,131]],[[132,-30]],[[-27]]]},{"type":"MultiPolygon","properties":{"name":"Tamil Nadu"},"id":"IN.","arcs":[[[-22,133]],[[134,-132,135,-130,136,-28,-50,-24]]]},{"type":"Polygon","properties":{"name":"Gujarat"},"id":"IN.","arcs":[[-128,-58,-49,-57,137,138,139,140,141,-104]]},{"type":"Polygon","properties":{"name":"Goa"},"id":"IN.GA","arcs":[[-52,142,-55]]},{"type":"Polygon","properties":{"name":"Arunachal Pradesh"},"id":"IN.AR","arcs":[[-98,-93,143]]},{"type":"Polygon","properties":{"name":"Mizoram"},"id":"IN.MZ","arcs":[[-95,144,145,-86]]},{"type":"Polygon","properties":{"name":"Tripura"},"id":"IN.TR","arcs":[[-146,146,-87]]},{"type":"MultiPolygon","properties":{"name":"Daman and Diu"},"id":"IN.","arcs":[[[147,-139]],[[-141,148]]]}]}},"arcs":[[[3740,854],[2,-1],[3,-1],[-1,-1],[-3,1],[-3,1],[-2,-1],[-1,2],[2,1],[3,-1]],[[2967,8362],[-1,-4],[1,-2],[2,-5],[2,-3],[0,-2],[0,-3],[-1,-4],[-1,-7],[3,-8]],[[2972,8324],[-6,1],[-1,0],[-3,0],[-1,-1],[-4,-2],[-1,0],[-2,1],[-2,3],[-3,2],[-10,11],[-10,8],[-1,1],[-1,3],[-1,2],[0,3],[1,2],[2,2],[13,5],[6,0],[5,1],[14,-4]],[[3100,7697],[5,-11],[-4,-8],[5,-6],[3,-7],[27,-22],[2,-5],[1,-4],[1,-3],[0,-2],[5,-13],[1,-3],[0,-3],[0,-2],[-2,-2],[-2,-2],[-5,-4],[-2,-2],[-1,-3],[-1,-5],[2,-2],[8,-15]],[[3143,7573],[-20,-3],[-4,-2],[-6,-3],[-5,-4],[-1,-3],[1,-2],[2,-2],[2,-2],[1,-2],[0,-2],[-2,-2],[-3,-2],[-11,-1],[-14,4],[-5,4],[-8,4],[-5,3],[-2,2],[-2,2],[-3,10],[-1,2],[-2,2],[-23,11],[-2,0],[-2,-1],[-2,-3],[0,-4],[-3,-1],[-5,-1],[-19,-1],[-12,-3],[-1,3],[0,2],[-1,2],[-1,2],[-2,2],[-5,4],[-3,3],[0,3],[1,2],[7,7],[3,6],[2,2],[4,1],[6,1],[3,1],[2,1],[1,8],[1,2],[6,5],[3,4],[-1,4],[-2,4],[-1,2],[1,6],[-2,18],[1,4],[0,3],[3,5],[3,3],[8,4],[9,2],[11,0],[6,5],[2,2],[3,3],[3,0],[16,-4],[4,-2],[5,-1],[2,0],[16,5]],[[3503,8967],[10,-18],[14,-17],[1,-4],[-2,-2],[-2,-2],[-2,-3],[0,-4],[0,-2],[1,-2],[8,-32],[0,-7],[-2,-6],[1,-5],[3,-1],[1,0],[2,-1],[13,-5],[7,-10],[6,-10],[33,-40],[10,-7],[15,-8],[4,-3],[4,-7],[-1,-7],[-8,-14],[-2,-7],[-2,-15],[-2,-7],[-9,-12],[-1,-5],[8,-9],[0,-3],[-1,-3],[0,-4],[2,-2],[4,-5],[3,-6],[2,-2],[2,-2],[3,-1],[6,0],[13,-11],[8,-9],[-1,-5],[-6,-5],[-34,-24],[-1,-8],[13,-7],[10,-8],[-1,-11],[-5,-14],[-2,-13],[1,-6],[1,-3],[3,-2],[10,-5],[4,0],[9,2],[9,-1],[5,0],[5,2],[1,1]],[[3674,8540],[6,-9],[3,-2],[10,-10],[10,-13],[10,-14],[1,-5],[-1,-6],[-11,-3],[-5,-1],[-5,0],[-21,1],[-8,5],[-5,4],[-4,6],[-7,12],[-3,3],[-5,0],[-8,0],[-11,2],[-12,1],[-7,-1],[-5,0],[-6,2],[-4,2],[-6,2],[-8,0],[-14,-2],[-7,-1],[-7,-1],[-3,1],[-6,3],[-10,11],[-4,2],[-3,1],[-4,-1],[-4,0],[-3,2],[-2,3],[-2,2],[-4,0],[-7,0],[-12,2],[-5,0],[-5,-1],[-17,-11],[-16,-4],[-24,-12],[-16,-10],[-10,-5],[-4,0],[-7,-1],[-15,3],[-4,0],[-4,-1],[-4,-3],[-11,-9],[-11,-13],[-20,-18],[-3,-3],[-1,-4],[4,-6],[0,-3],[-2,-4],[-3,-3],[-3,-1],[-3,0],[-3,1],[-3,0],[-3,-1],[1,-4],[4,-7],[3,-3],[3,-1],[3,-3],[1,-3],[0,-9],[-2,-7],[-4,0],[-2,1],[-3,2],[-3,0],[-3,-5],[-5,-11],[-8,-16],[0,-6],[1,-5],[9,-8],[2,-6],[0,-8],[2,-4],[5,-6],[2,-2],[2,-9],[-1,-4],[-2,-3],[-6,-4],[-1,-1],[8,-12],[3,-3],[3,-1],[5,-1],[4,0],[1,-2],[1,-2],[0,-3],[-1,-4],[-4,-4],[-3,-1],[-8,-3],[-28,-15],[-8,-3],[-7,-1],[-7,-1],[-9,-1],[-7,-3],[-4,-5],[1,-3],[5,-6],[1,-2]],[[3231,8221],[-16,7],[-9,8],[-5,-1],[-3,-1],[-5,-1],[-4,0],[-7,0],[-3,1],[0,2],[6,5],[1,3],[0,2],[-3,0],[-11,-7],[-5,-2],[-6,0],[-3,2],[-2,3],[-2,2],[-3,1],[-16,3],[-4,1],[-6,4],[-12,5],[-9,-5],[-2,1],[-1,2],[-1,1],[0,5],[-19,13],[-4,6],[-2,5],[3,5],[3,4],[1,5],[-1,9],[1,10],[0,5],[-3,5],[-5,6],[-4,4],[-9,5],[-15,8],[-11,4],[-4,2],[-1,2],[0,3],[-1,4],[-3,2],[-3,1],[-4,2],[-3,1],[-3,3],[-1,4],[-2,7],[-2,3],[-3,5],[-6,6],[-6,0],[-4,0],[-5,-1],[-6,0],[-3,2],[-3,3],[-3,6],[-1,1],[-2,1],[-3,-1],[-2,-1],[-5,-3],[-3,-3],[-2,-2]],[[2951,8403],[-15,12],[-8,7],[-19,13],[-6,6],[-4,5],[-1,4],[-1,4],[-1,3],[0,4],[1,3],[1,2],[4,7],[-1,3],[-6,4],[-1,2],[0,15],[1,3],[1,3],[5,5],[3,4],[-2,2],[-3,1],[-8,-1],[-3,1],[0,1],[1,6],[0,4],[-3,4],[-2,2],[-1,1],[-1,0],[-1,-1],[-3,-4],[-1,-2],[-1,-1],[-2,-1],[-2,2],[-1,2],[0,4],[-2,3],[-2,1],[-5,1],[-1,0],[-1,-1],[-1,-1],[-1,-1],[-1,0],[-3,3],[-3,4],[-2,2],[-2,-1],[-1,-1],[-2,-2],[-2,0],[-3,1],[-2,6],[-7,13],[-14,22],[-4,4],[-2,-1],[-1,-2],[-1,0],[-1,-1],[-8,-2],[-2,-4],[2,-13],[-1,-3],[-2,-2],[-4,1],[-3,-2],[-1,-2],[-1,-6],[-2,-3],[-2,-1],[-3,-1],[-2,1],[-6,2],[-4,0],[-3,-1],[-8,-3],[-7,4],[-7,7],[-4,6],[-2,5],[-5,21],[-19,47],[-44,72],[-7,12],[0,3],[0,3],[2,2],[2,1],[3,0],[4,0],[3,0],[2,1],[0,2],[-2,3],[-12,20],[-13,16],[-4,7],[-6,3],[-20,8],[-17,10],[-16,6],[-2,2],[-5,-1],[-8,2],[-21,3],[-3,1],[-4,2],[-1,2],[2,3],[19,19],[4,5],[2,5],[2,5],[-1,2],[-2,1],[-2,0],[-2,-1],[-1,0],[-2,-1],[-3,0],[-3,2],[-2,4],[-1,6],[1,5],[1,4],[2,1],[2,1],[23,5],[7,2],[5,3],[6,4],[12,13],[27,19],[16,8],[3,2],[0,2],[-1,2],[-14,24],[-1,2],[-3,3],[-4,1]],[[2636,8963],[3,3],[4,8],[0,4],[10,13],[6,5],[2,1],[1,1],[1,5],[0,3],[0,4],[-7,14],[-1,4],[1,11],[3,7],[0,2],[-1,4],[-2,3],[-6,6],[-2,4],[-2,3],[-2,3],[-4,4],[-12,11],[-4,5],[-2,5],[-1,5],[2,4],[2,2],[4,3],[7,1],[4,0],[4,-1],[8,-3],[3,-1],[3,-1],[3,-2],[6,-6],[2,-1],[4,1],[6,3],[27,20],[8,9],[3,2],[6,5],[18,6],[14,4],[8,3],[7,4],[8,8],[3,6],[1,5],[1,3],[2,4],[4,4],[21,11],[14,6],[40,7],[10,5],[6,0],[18,-13],[5,-2],[39,3],[5,-1],[5,-3],[20,-21],[7,-4],[19,-14],[8,-10],[4,-4],[6,-3],[15,-6],[30,-20],[16,-8],[29,-9],[44,-12],[8,0],[2,2],[3,4],[1,1],[2,1],[17,1],[11,3],[7,3],[14,3],[5,1],[5,3],[5,3],[9,8],[3,2],[3,1],[6,2],[3,1],[3,2],[4,5],[1,0],[6,3],[4,2],[3,0],[3,0],[4,-4],[3,-5],[8,-9],[20,-18],[11,-13],[13,-24],[5,-5],[5,-5],[2,-4],[1,-18],[2,-6],[4,-4],[8,-8],[3,-4],[2,-5],[2,-5],[5,-3],[12,0],[5,2],[4,5],[2,3],[3,2],[3,1],[2,2],[2,3],[3,2],[6,1],[8,1],[8,5],[5,1],[5,0],[7,-1],[5,1],[4,2],[5,6],[4,2],[8,3],[4,2],[1,3],[-1,6],[1,1],[2,1],[3,0],[7,1],[2,-1],[2,-1],[2,-1],[1,-2],[2,-9],[1,-5],[1,-5],[-2,-11],[-1,-4],[-1,-3],[-2,-3],[-3,-3],[-9,-5],[-7,-4],[-3,-3],[-1,-3],[-3,-5],[-2,-10],[-2,-5],[-2,-4],[-1,-5],[1,-5],[3,-4],[4,-2],[3,-1],[3,0],[16,16],[7,4]],[[3231,8221],[1,-1],[0,-3],[-1,-16],[-5,-16],[-6,-6],[-15,-10],[-22,-21],[-10,-7],[-3,-4],[-1,-10],[-12,-6],[-10,-9],[-6,-2],[-1,-1],[0,-2],[0,-5],[-1,-1],[-2,1],[-2,-1],[-1,0],[-4,0],[-2,0],[-1,-2],[-1,-2],[0,-2],[0,-1],[-13,-12],[-3,-2],[-4,-6],[-3,-11],[-10,-43],[-7,-12],[-2,-1],[-2,1],[-3,0],[-2,-2],[-1,-3],[1,-3],[1,-3],[1,-2],[-1,-4],[-3,-3],[-8,-4],[3,-7],[-9,-8],[2,-6],[-3,-6],[1,-4],[3,-4],[1,-4],[-2,-3],[-5,-2],[-5,-2],[-2,-5],[1,-2],[3,-4],[1,-3],[-1,-6],[-1,-3],[-1,0],[4,-4],[10,1],[5,-4],[-4,-5],[-12,-10],[-3,-5],[4,-1],[9,1],[10,0],[6,-4],[0,-4],[-1,-2],[-3,-3],[-1,-3],[-1,-3],[1,-10],[1,-3],[3,-3],[1,-4],[-2,-4],[-3,-4],[-1,-3],[3,-53],[0,-2],[-1,-1],[-1,-1],[0,-1],[0,-2],[2,-2],[1,0],[2,-1],[7,-22],[9,-14],[-2,-3],[-4,-3],[-1,-6],[9,-7],[3,-3],[2,-4],[1,-3],[0,-3],[-2,-3],[-4,-7]],[[3143,7573],[3,-4],[2,-4],[4,-2],[3,-1],[5,-1],[0,-5],[-1,-4],[1,-1],[3,0],[6,4],[1,0],[3,-1],[1,-2],[0,-2],[2,-4],[0,-2],[1,-2],[4,-1],[6,2],[3,0],[2,-3],[-1,-10],[3,-2],[7,1],[-9,-18],[-2,-9],[8,-6],[0,-4],[0,-5],[1,-3],[4,-3],[9,-1],[3,-3],[-2,-1],[-1,-1],[-1,-2],[-1,-2],[-1,-3],[-3,-2],[-4,0],[-1,-1],[1,-4],[10,-2],[3,-4],[-11,-4],[-4,-6],[0,-9],[3,-12],[-11,7],[0,-4],[2,-10],[-3,-9],[4,-3],[5,-3],[3,-3],[3,-7],[5,-9],[1,-7],[-7,-4],[-5,-6],[-2,-2],[-3,-7],[-3,-4],[-4,-1],[-4,2],[-4,1],[-4,-1],[-9,-9],[-3,-1],[-12,-3],[-4,-2],[-3,-2],[-2,-1],[-2,0],[-3,-1],[-2,-1],[-9,-8]],[[3127,7326],[-10,2],[-5,-7],[-1,-1],[-1,0],[-3,1],[-2,3],[-2,3],[-2,2],[-2,-1],[-2,-4],[-2,-2],[-3,0],[-2,2],[-1,3],[-2,2],[-2,-1],[-5,-5],[-3,-2],[-6,-1],[-6,2],[-12,4],[-4,1],[-4,-2],[-3,-5],[0,-4],[2,-3],[10,-4],[3,-2],[0,-3],[-2,-2],[-17,-2],[-5,-2],[-4,-4],[-5,-10],[-2,-3],[-12,0],[-10,-3],[-3,1],[-2,1],[-1,2],[-1,2],[1,3],[2,1],[6,2],[1,0],[0,2],[-2,2],[-1,2],[-2,2],[-1,2],[0,3],[5,25],[1,3],[6,8],[1,2],[1,2],[1,2],[-2,13],[1,5],[0,3],[-1,3],[-2,5],[0,4],[0,3],[1,2],[0,2],[0,3],[-1,4],[-3,6],[-1,6],[0,6],[1,6],[5,19],[1,4],[-1,4],[-2,4],[-3,3],[-13,10],[-3,3],[-3,5],[-2,2],[-2,2],[-3,1],[-2,1],[-3,-1],[-3,-1],[-7,-4],[-3,-2],[-2,-3],[-2,-6],[-9,-9],[-7,-4],[-3,-2],[-6,-5],[-4,-2],[-2,-1],[-4,-4],[-2,-2],[-6,-2],[-2,-2],[-2,-2],[-1,-2],[0,-2],[-1,-2],[1,-3],[1,-3],[4,-8],[0,-2],[0,-2],[-3,-1],[-5,-1],[-7,-1],[-4,-1],[-4,-1],[-1,-1],[-2,-2],[-5,-6],[-3,-2],[-2,0],[-3,3],[-2,2],[-1,3],[-3,13],[-2,2],[-2,2],[-2,0],[-4,0],[-4,0],[-12,6],[-2,2],[1,2],[2,1],[6,2],[2,1],[0,1],[-1,1],[-2,1],[-8,4],[-1,3],[-1,2],[1,2],[1,0],[2,0],[4,-2],[3,0],[3,-1],[1,1],[0,2],[-2,2],[-8,12],[-3,1],[-4,1],[-7,-2],[-15,-2],[-2,0],[-2,1],[-1,2],[-2,2],[-1,2],[-1,2],[-2,2],[-2,1],[-4,1],[-4,2],[-2,-1],[-2,-2],[1,-5],[2,-4],[3,-2],[6,-3],[2,-2],[1,-2],[-1,-3],[-1,-1],[-6,-1],[-3,-1],[-1,-2],[1,-3],[2,-2],[5,-2],[3,-1],[2,-3],[1,-3],[-1,-5],[-3,-4],[-6,-1],[-4,0],[-13,10],[-5,1],[-2,0],[-2,-1],[-3,-2],[-2,-1],[-3,0],[-3,0],[-7,2],[-2,0],[-2,-1],[-2,0],[-1,-2],[-1,-3],[-2,-4],[0,-4],[0,-5],[2,-10],[5,-12],[1,-5],[-1,-7],[0,-4],[2,-4],[4,-3],[2,-2],[0,-2],[1,-5],[1,-3],[1,-3],[1,-2],[0,-2],[-2,-3],[-10,-7],[-12,8],[-8,8],[-10,0],[-31,-4],[-5,2],[-2,3],[-2,5],[0,3],[-1,3],[-1,3],[-2,2],[-11,6],[-2,6],[2,6],[2,1],[7,-1],[4,0],[1,1],[2,2],[3,3],[0,2],[-2,4],[-2,2],[-3,2],[0,1],[0,1],[2,2],[2,1],[2,2],[1,3],[1,5],[1,3],[7,5],[5,6],[1,3],[0,4],[-3,2],[-2,1],[-3,-1],[-2,-1],[-1,-1],[-3,-4],[-1,-2],[-2,0],[-2,0],[-9,6],[-2,2],[0,3],[1,4],[2,2],[4,2],[3,1],[8,3],[2,1],[3,2],[3,6],[2,3],[3,0],[2,0],[5,-6],[3,-2],[4,-2],[2,2],[0,4],[-3,7],[-3,4],[-3,3],[-2,2],[-3,7],[-4,7],[-24,29],[-16,14],[-8,7],[-5,1],[-5,1],[-8,3],[-6,4],[-4,1],[-2,0],[-3,-2],[-3,0],[-3,2],[-2,4],[1,4],[1,2],[0,3],[-3,3],[-7,3],[-16,11],[-8,12],[-4,3],[-2,1],[-2,3],[-9,11],[-5,5],[-5,8],[-5,9],[-10,29],[-7,14],[-1,4],[0,5],[-1,5],[-6,10],[-2,6],[-3,10],[-2,7],[0,2],[1,2],[2,1],[4,3],[3,2],[2,3],[0,4],[-1,4],[-1,3],[-2,1],[-2,1],[-15,5],[-3,2],[-10,14],[-5,7],[-3,4],[-2,4],[0,3],[0,3],[0,2],[0,2],[-1,3],[-3,3],[-1,4],[-1,2],[1,2],[1,2],[2,1],[5,1],[1,0],[1,1],[1,2],[0,2],[-1,2],[0,2],[-5,7],[-1,7],[-1,2],[-2,0],[-6,-2],[-3,-3],[-2,-2],[-2,-1],[-2,0],[-3,1],[-2,3],[0,2],[0,3],[3,7],[0,3],[-1,2],[-2,1],[-3,0],[-13,-6],[-1,-1],[-1,-2],[0,-2],[-1,-1],[-2,-1],[-4,-2],[-7,-1],[-5,0],[-6,4],[-3,2],[-2,1],[-3,0],[-5,-5],[-3,-2],[-7,-1],[-3,-1],[-5,-3],[-3,-1],[-3,0],[-3,0],[-3,1],[-2,3],[-4,7],[-2,4],[-2,2],[-5,2],[-4,0],[-6,-4],[-2,0],[-2,0],[-4,1],[-2,1],[-2,2],[-3,3],[-4,8],[-3,8],[0,3],[-1,2],[-2,2],[-6,5],[-4,1],[-4,2],[-7,1],[-3,1],[-5,3],[-3,0],[-4,0],[-4,-2],[-4,-2],[-4,-3],[-3,-4],[-3,-2],[-3,0],[-5,0],[-12,2],[-2,0],[-10,-2],[-4,1],[-2,-1],[-3,-1],[-1,-1],[-1,-3],[-1,-4],[-1,-2],[-2,-1],[-3,0],[-3,1],[-3,2],[-2,3],[-3,7],[-3,3],[-5,6],[-2,3],[-2,5],[-4,5],[-1,1],[-1,2],[0,3],[2,4],[3,2],[2,1],[10,-1],[3,1],[2,1],[2,2],[1,4],[1,11],[0,4],[-4,4],[-5,6],[-3,4],[-1,6],[3,29],[1,6],[5,13],[2,5],[-1,5],[-2,3],[-2,1],[-3,1],[-2,-1],[-1,-1],[-2,-2],[-1,-1],[-2,0],[-4,0],[-3,-1],[-2,-1],[-4,-3],[-2,-1],[-4,-1],[-2,0],[-4,0],[-3,1],[-4,2],[-2,2],[-1,4],[1,7],[2,6],[3,6],[2,2],[1,1],[3,1],[11,4],[3,2],[3,3],[1,2],[1,3],[0,4],[-1,3],[-4,3],[-3,2],[-2,2],[-2,2],[1,11]],[[2181,8069],[21,-4],[19,-7],[6,0],[1,1],[2,2],[3,5],[1,2],[2,2],[11,7],[3,1],[3,0],[6,0],[8,1],[13,4],[4,0],[2,0],[1,-2],[2,-3],[2,-1],[1,-1],[4,-1],[17,-3],[4,-1],[2,-1],[3,-3],[1,-1],[0,-2],[1,-4],[1,-2],[1,-2],[2,-1],[8,-5],[2,-1],[2,-2],[1,-1],[4,-2],[3,-1],[5,1],[10,3],[4,1],[3,1],[1,1],[2,2],[0,1],[1,3],[0,2],[0,2],[2,1],[3,2],[2,-2],[2,-2],[0,-2],[0,-3],[0,-3],[-1,-3],[-1,-2],[-1,-1],[-1,-1],[-1,-1],[0,-1],[2,-3],[1,-1],[0,-2],[-1,-6],[1,-2],[1,-2],[8,-4],[2,-2],[2,-2],[2,-2],[1,0],[1,0],[0,1],[1,7],[1,1],[1,2],[2,1],[5,2],[3,0],[2,0],[1,-2],[0,-5],[1,-2],[1,-3],[3,-4],[6,-8],[2,-3],[1,-2],[0,-1],[-1,0],[-1,0],[-2,-1],[-2,0],[-1,1],[-1,0],[-2,0],[-1,-1],[0,-1],[0,-3],[0,-5],[0,-3],[0,-1],[0,-1],[-2,-1],[-6,-3],[-1,0],[-2,-1],[-1,-1],[0,-1],[1,-2],[6,-5],[1,-2],[0,-1],[-1,-1],[-1,-2],[1,-1],[1,-2],[4,-4],[3,-2],[1,-2],[0,-2],[1,-2],[0,-1],[2,-4],[1,-2],[2,-8],[4,0],[7,3],[9,2],[3,2],[0,3],[-1,3],[-2,2],[-1,3],[0,3],[2,4],[5,8],[3,2],[3,0],[2,0],[3,0],[0,3],[0,3],[1,3],[2,3],[8,6],[3,3],[8,14],[8,8],[5,7],[2,1],[3,0],[6,-3],[11,-4],[7,-1],[3,1],[3,-1],[9,-5],[10,-2],[7,1],[6,2],[7,1],[12,-3],[5,1],[2,3],[0,2],[0,3],[1,3],[2,3],[11,4],[9,3],[4,0],[3,-1],[5,-1],[3,-1],[8,-6],[2,-3],[5,-11],[1,-2],[4,-3],[7,-1],[11,-3],[6,0],[5,1],[7,4],[4,1],[9,-1],[5,2],[2,2],[11,13],[15,6],[7,1],[5,3],[8,5],[10,5],[4,3],[0,3],[-2,3],[-7,3],[-2,2],[-2,3],[-1,3],[-1,4],[-1,2],[-1,4],[1,3],[1,7],[7,16],[3,4],[3,4],[1,1],[0,1],[-1,2],[-1,1],[0,2],[0,2],[0,2],[1,1],[1,1],[8,1],[2,2],[0,1],[-3,1],[-9,3],[-2,1],[-2,2],[-1,2],[0,2],[1,2],[3,3],[2,0],[3,0],[10,-7],[3,-2],[2,0],[5,-1],[4,-1],[3,0],[3,0],[3,2],[2,1],[-1,3],[0,2],[0,3],[2,1],[2,0],[2,-2],[4,-4],[2,-2],[2,-1],[1,0],[2,1],[2,2],[3,7],[0,2],[0,1],[0,2],[-1,2],[-1,2],[0,3],[3,2],[2,1],[3,-1],[2,-1],[1,-2],[4,-12],[2,-6],[4,-6],[2,-2],[3,-2],[8,-2],[4,-2],[11,0],[20,14],[12,6],[2,2],[0,4],[0,3],[3,5],[1,3],[0,3],[0,1],[-1,1],[-2,1],[-1,1],[-5,1],[-2,1],[-1,2],[-1,1],[-1,2],[0,2],[-1,1],[-1,2],[-1,1],[-2,0],[-1,0],[-2,-2],[-5,-6],[-2,-1],[-2,-1],[-2,-1],[-2,1],[-1,2],[-1,3],[2,4],[4,3],[5,3],[14,4],[4,2],[7,4],[4,2],[22,14],[5,4],[3,3],[1,2],[0,1],[-2,1],[-4,1],[-1,1],[-1,1],[0,1],[2,11],[0,2],[2,1],[8,3],[5,0],[7,-2],[4,0],[10,1],[4,-1],[2,-2],[2,-4],[3,-10],[3,-5],[4,-2],[4,1],[3,4],[1,4],[1,4],[0,4],[-3,12],[-1,5],[0,11],[1,3],[1,1],[2,3],[1,3],[0,2],[-2,2],[-2,3],[-2,3],[1,6],[2,11],[0,2],[-1,2],[-1,2],[-1,6],[-2,2],[-2,1],[-3,1],[-2,1],[-2,1],[-2,11],[-1,1],[0,1],[-1,0],[-1,0],[-1,-1],[-2,0],[-3,0]],[[2967,8362],[6,7],[1,5],[1,2],[-1,2],[0,3],[-2,1],[-2,1],[-5,1],[-2,2],[-2,2],[-4,8],[-2,4],[-4,3]],[[2636,8963],[-2,-3],[-4,-4],[-4,-1],[-7,-4],[-18,-6],[-2,-3],[-2,-7],[-1,-2],[-2,-2],[-6,-4],[-3,-2],[-5,-3],[-24,-1],[-13,-7],[-13,-11],[-12,-15],[-7,2],[-2,2],[-4,2],[-4,2],[-2,2],[-1,2],[0,6],[0,2],[-2,1],[-5,-3],[-3,-2],[-8,-4],[-22,2],[-9,-3]],[[2449,8899],[-24,17],[-11,6],[-24,5],[-12,6],[-13,9],[-10,3],[-12,-1],[-14,-5],[-14,-1],[-24,10],[-13,0],[-13,-4],[-13,0],[-12,3],[-9,10],[-10,24],[-1,7],[2,6],[4,6],[3,6],[0,7],[-2,14],[0,8],[2,8],[9,14],[2,8],[-1,7],[-5,4],[-6,-1],[-6,-6],[-3,-7],[-2,-6],[-3,-5],[-7,-4],[-6,-2],[-19,-2],[-6,0],[-6,2],[-10,9],[-6,3],[-6,-1],[-12,-6],[-6,-1],[-7,1],[-6,3],[-5,5],[-3,7],[3,4],[1,1],[2,2],[3,7],[1,7],[-4,18],[-1,17],[-3,8],[-10,5],[-31,5],[-13,6],[-19,23],[-11,9],[-13,8],[-9,8],[-5,11],[1,15],[4,6],[5,3],[13,5],[6,3],[4,4],[4,5],[3,6],[11,26],[7,26],[-5,19],[-19,13],[-22,10],[-16,12],[-3,4],[-1,5],[-1,6],[1,10],[1,5],[1,4],[2,4],[12,18],[8,6],[37,6],[12,4],[12,8],[9,7],[8,11],[3,11],[-4,11],[-11,6],[-12,0],[-13,-3],[-12,0],[-18,5],[-7,1],[-24,-5],[-10,1],[-10,7],[-8,9],[-3,10],[3,11],[8,7],[20,9],[7,5],[1,7],[-3,8],[-5,7],[-7,17],[-6,6],[-10,1],[-10,-1],[-9,1],[-8,3],[-9,4],[-7,7],[-3,8],[2,9],[5,7],[4,3],[9,4],[3,2],[1,5],[1,13],[5,8],[17,9],[5,7],[0,10],[-3,9],[1,8],[10,7],[4,2],[55,8],[8,4],[26,16],[22,7],[22,2],[21,-3],[87,-27],[120,-20],[32,1],[23,4],[12,0],[4,-2],[4,-2],[5,-7],[6,-5],[13,-8],[15,-6],[90,-21],[15,0],[20,4],[7,0],[14,-2],[7,2],[7,4],[19,18],[23,14],[9,2],[3,1],[4,5],[7,10],[6,4],[12,3],[21,-8],[12,0],[36,8],[47,23],[14,4],[13,-2],[15,-9],[5,-2],[6,0],[29,6],[5,2],[31,25],[3,6],[-1,19],[3,8],[8,6],[12,3],[12,1],[10,-2],[9,-5],[5,-1],[4,3],[7,6],[20,14],[6,6],[2,11],[-3,9],[-1,9],[6,7],[3,1],[128,67],[129,67],[5,-8],[6,-7],[8,-5],[9,-2],[10,3],[16,14],[9,5],[20,-1],[4,-14],[-6,-19],[-10,-17],[-3,-28],[12,-26],[33,-48],[3,-13],[3,-26],[5,-12],[13,-15],[3,-6],[22,-66],[7,-12],[14,-10],[15,-6],[78,-11],[19,-7],[30,-19],[17,-20],[13,-6],[16,-4],[13,-5],[10,-8],[2,-3],[6,-11],[3,-7],[1,-9],[-1,-8],[-3,-8],[-25,-20],[-33,-12],[-26,-16],[-3,-29],[17,-42],[5,-23],[3,-22],[-5,-67],[7,-20],[8,-12],[31,-25],[1,-1],[19,-26],[6,-3],[12,-3],[6,-2],[6,-4],[4,-4],[2,-7],[0,-8],[3,-2],[12,5],[11,-1],[26,-12],[12,-4],[27,-1],[12,-5],[1,-13],[-3,-5],[-8,-9],[-2,-7],[-1,-18],[-3,-7],[1,-13],[6,-9],[20,-15],[7,-11],[2,-11],[4,-10],[9,-9],[8,-8],[2,-11],[-3,-13],[-7,-11],[-14,-15],[-33,-23],[-15,-15],[-6,-1],[-7,2],[-7,3],[-7,1],[-8,-1],[-11,-3],[-9,-4],[-7,-4],[-4,-8],[-3,-21],[-6,-7],[-3,0],[-9,2],[-4,0],[-5,-1],[-8,-3],[-5,-1],[-11,-5],[-11,3],[-10,7],[-9,9],[-29,21],[-6,11],[-6,18],[0,5],[1,7],[3,6],[1,5],[-5,6],[-8,3],[-6,-3],[-10,-10],[-6,-5],[-6,-3],[-14,-2],[-49,-2],[-13,-2],[-8,-4],[-2,-7]],[[4390,3132],[-10,-3],[-8,4],[-17,20],[3,10],[3,2],[17,-9],[11,-9],[5,-5],[2,-3],[-2,-3],[-4,-4]],[[4150,4162],[4,1],[4,-1],[3,-3],[2,-3],[2,-4],[1,-4],[0,-7],[1,-3],[2,-4],[4,-4],[2,-3],[2,-5],[1,-2],[3,3],[3,3],[1,2],[4,-1],[2,-3],[1,-4],[5,-1],[7,3],[12,3],[8,0],[5,-2],[7,-6],[3,-2],[7,-4],[4,-2],[7,-6],[16,-18],[5,-7],[7,-7],[5,-7],[6,-6],[3,-6],[2,-5],[3,-10],[9,-19],[8,-14],[1,-3],[1,-4],[-1,-2],[-3,-2],[-7,-2],[-2,-2],[-2,-3],[-1,-3],[0,-4],[2,-4],[3,-3],[3,-1],[9,1],[4,0],[3,1],[2,1],[1,2],[0,2],[2,7],[1,2],[1,1],[3,1],[3,0],[3,-2],[2,-4],[1,-5],[0,-5],[1,-5],[2,-4],[3,-2],[4,0],[4,1],[9,4],[4,1],[6,-1],[3,-1],[0,-3],[-1,-4],[-3,-4],[-2,-5],[-2,-6],[0,-7],[2,-6],[2,-7],[2,-5],[7,-12],[1,-5],[3,-43],[5,-12],[5,-7],[5,-3],[5,-1],[4,3],[9,6],[9,4],[9,6],[4,2],[3,1],[4,-1],[3,-1],[9,-6],[7,-2],[8,-2],[10,0],[15,2],[26,-1]],[[4535,3847],[19,-4],[3,-2],[4,-1],[3,0],[2,2],[2,3],[2,6],[2,2],[3,1],[4,-1],[12,-7],[7,-2],[9,5],[6,6],[6,4],[5,3],[12,2],[5,2],[4,4],[3,4],[5,5],[6,4],[23,10],[34,21],[12,1],[12,3],[16,11],[17,3],[14,-4],[6,-4],[5,-3],[5,-7],[1,0],[4,0],[5,0],[3,0],[2,-1],[2,-1],[4,0],[4,1],[2,4],[1,4],[3,5],[3,2],[5,1],[9,0],[4,1],[2,3],[1,4],[-1,6],[-2,6],[0,4],[1,3],[4,2],[4,2],[1,3],[0,2],[-2,3],[-11,8],[-3,3],[-1,3],[0,4],[2,4],[12,17],[2,4],[1,5],[0,3],[-3,6],[0,2],[1,2],[5,13],[0,5],[0,5],[0,6],[0,2],[2,2],[12,14],[3,5],[4,11],[3,3],[4,1],[6,-2],[3,-2],[4,0],[3,0],[2,0],[1,-3],[0,-2],[0,-3],[0,-3],[1,-2],[1,-2],[0,-2],[0,-3],[-1,-7],[1,-4],[2,-4],[4,-5],[17,-14],[2,-3],[2,-2],[1,-3],[1,-3],[0,-2],[0,-3],[-5,-10],[-1,-4],[0,-3],[1,-3],[2,-3],[2,-1],[3,-1],[4,0],[3,-1],[4,-2],[3,0],[3,4],[1,3],[2,8],[1,3],[2,3],[4,2],[6,3],[11,8],[10,4],[4,2],[3,5],[2,4],[0,4],[-2,9],[0,3],[2,3],[3,2],[7,1],[4,-2],[4,-2],[3,-3],[5,-1],[5,0],[3,-2],[1,-3],[-1,-6],[0,-3],[1,-3],[2,-1],[3,-1],[14,0],[3,1],[12,6],[4,1],[2,0],[5,0],[3,1],[4,3],[1,9],[0,5],[-2,3],[-1,2],[-2,2],[1,4],[2,3],[16,19],[-1,5],[-1,1],[-1,0],[-2,1],[-6,-1],[-2,0],[-1,2],[-2,6],[-6,8],[0,2],[0,3],[1,3],[1,3],[0,3],[0,2],[1,2],[8,8],[4,4],[4,5],[7,13],[4,5],[6,6],[4,2],[5,1],[3,-1],[4,-2],[3,-3],[3,-2],[4,-1],[19,8],[5,4],[9,8],[11,8],[5,3],[7,2],[5,2],[4,4],[1,3],[0,3],[-1,1],[-2,0],[-2,2],[0,2],[-2,4],[-1,1],[-1,0],[-2,0],[-2,0],[-1,1],[-2,1],[-7,9],[-1,1],[-2,7],[-1,2],[-2,2],[-2,2],[-1,2],[-1,2],[1,3],[4,3],[3,1],[4,0],[3,1],[4,-2],[1,0],[4,-2],[8,-3],[4,-2],[7,-5],[4,-1],[5,2],[2,3],[0,3],[-1,2],[-1,3],[0,1],[5,3],[0,3],[1,2],[-4,12],[1,3],[2,2],[4,-2],[3,-3],[2,-3],[1,-4],[2,-8],[1,-3],[2,-1],[3,1],[3,3],[2,4],[3,8],[2,2],[3,2],[6,2],[3,4],[2,4],[1,4],[1,5],[2,3],[2,2],[3,-1],[4,-5],[5,-10],[2,-4],[14,-14],[5,-8],[2,-3],[6,-20],[3,-4],[2,-2],[2,1],[1,2],[1,4],[0,3],[-1,3],[0,2],[-1,3],[0,3],[1,2],[0,2],[1,0],[2,2],[2,1],[3,0],[3,0],[7,-3],[6,-13],[3,-15],[1,-2],[3,-4],[4,-11],[1,-4],[1,-1],[1,-2],[3,-2],[2,-3],[2,-4],[1,-1],[1,-2],[1,0],[3,-3],[2,-1],[16,1],[17,0],[19,4],[6,0],[4,-2],[3,-2],[4,-2],[9,0],[3,-1],[5,-4],[3,-1],[7,1],[24,6],[22,2],[6,2],[6,4],[6,8],[2,6],[3,9],[2,3],[3,1],[3,-1],[3,0],[4,1],[12,14],[1,3],[1,2],[-1,2],[-1,1],[0,2],[0,2],[1,2],[3,5],[-1,2],[-1,5],[-1,2],[1,2],[2,1],[5,-1],[4,0],[4,-1],[4,1],[11,10],[3,2],[26,12],[3,-1],[2,-1],[2,-2],[2,0],[4,4],[2,4],[1,5],[0,3],[-1,2],[-1,2],[-1,2],[2,2],[3,1],[5,0],[12,0],[4,0],[2,-2],[3,-3],[1,-2],[1,-9]],[[5692,4302],[-4,3],[-5,5],[-4,3],[-2,-3],[0,-3],[-4,-5],[0,-5],[1,-2],[4,-4],[2,-3],[5,8],[2,1],[2,0],[3,0],[1,-1],[0,-2],[-10,-13],[-3,-9],[-14,-18],[-7,-11],[-5,-5],[-12,-5],[-28,-42],[-2,-7],[-32,-33],[-4,-6],[-2,-6],[-3,-3],[-18,-13],[-7,-11],[-6,-5],[-7,-3],[-2,-1],[-6,-5],[-2,-1],[-3,0],[-8,0],[-1,0],[-3,-5],[4,-3],[7,-1],[9,6],[10,7],[8,6],[-6,-5],[-15,-12],[-17,-16],[-3,-5],[-14,-9],[-5,-7],[-7,-5],[-3,-3],[-2,-4],[-1,-4],[-1,-3],[-3,-4],[-4,-12],[-12,-9],[-104,-46],[-55,-33],[-11,-9],[-2,-3],[-4,-10],[-2,-2],[0,-1],[-6,-6],[-2,-1],[-3,-4],[-13,-9],[-5,-5],[-3,0],[-1,2],[-3,5],[-1,-5],[1,-7],[0,-7],[-7,-4],[-2,-6],[-3,-11],[-5,-8],[-21,-23],[-8,-5],[-2,-1],[-3,-3],[-2,-1],[-2,1],[-1,1],[-1,0],[0,1],[-1,1],[-1,2],[-1,2],[-3,2],[-7,0],[-2,-4],[2,-4],[8,-2],[7,-4],[2,-2],[0,-3],[-3,-2],[-7,-3],[-5,-4],[-2,-1],[-12,0],[7,-9],[2,-5],[-6,-3],[-4,-1],[-5,-2],[-8,-6],[-29,-10],[-12,-8],[-11,-6],[-8,-6],[-7,-7],[-2,-1],[-6,-1],[-3,-1],[-16,-12],[-3,0],[-2,4],[-5,-3],[-5,-3],[-5,-4],[-15,-3],[-13,-9],[-13,-3],[-84,-50],[-7,-8],[-6,-10],[-4,-5],[-12,-4],[-6,-6],[-10,-13],[-10,-9],[-5,-6],[-2,-11],[-14,-24],[0,-8],[1,-7],[5,-7],[10,-3],[2,-1],[1,-2],[2,-1],[2,0],[3,1],[2,1],[0,1],[6,-3],[4,4],[-1,12],[-1,11],[-3,11],[4,-7],[2,-9],[1,-17],[-1,-17],[-5,-18],[-2,-19],[-2,-9],[-9,-18],[0,-3],[0,-2],[0,-2],[-3,0],[-2,1],[-2,5],[-2,1],[-2,-2],[2,-5],[3,-6],[4,-4],[-16,-5],[-19,-18],[-6,-3],[-5,-1],[-17,-8],[-11,-8],[-8,-4],[-10,1],[-5,-4],[-5,-5],[-6,-4],[-3,-1],[-5,1],[-4,-1],[-3,-5],[-2,-1],[-14,-1],[-7,-2],[-6,-2],[-27,-13],[-7,-5],[-16,-4],[-2,0],[-5,1],[-7,4],[-7,4],[-7,-2],[-5,3],[-12,1],[-6,1],[2,4],[-2,3],[-4,2],[-5,1],[3,-8],[-5,-1],[-14,4],[-7,-1],[-20,-6],[2,4],[1,2],[1,3],[-1,3],[-5,3],[-4,0],[-4,-2],[-4,-4],[-5,3],[-5,0],[-5,-2],[-5,-1],[-19,-12],[-4,-4],[0,-3],[2,-3],[2,-5],[-2,-6],[-9,-10],[-4,-15],[-9,-21],[-4,-18],[-6,-11],[-2,-6],[0,-18],[-2,-6],[-5,-1],[-16,-16],[-16,-9],[-5,-5],[-10,-12],[0,-4],[2,-3],[2,-3],[1,-2],[2,-7],[0,-2],[-2,-3],[-3,1],[-3,2],[-2,2],[-4,4],[-10,9],[-3,2],[-6,2],[-4,4],[-2,7],[-1,7],[3,26],[0,6],[-1,6],[-4,10],[-1,-3],[1,-4],[-2,-2],[-1,2],[-1,1],[-3,2],[5,-14],[2,-15],[-2,-14],[-12,-25],[-8,-26],[-4,-7],[-4,-4],[0,30],[-2,14],[-9,14],[-5,3],[-9,2],[-15,1],[-3,1],[-2,1],[-2,1],[-3,-3],[-1,-2],[1,-2],[-15,0],[-6,-2],[-6,-4],[-4,-1],[-4,4],[-2,0],[-4,-4],[-6,-4],[-11,-6],[-3,-1],[-3,0],[-2,-1],[-3,-2],[-5,-5],[-3,-2],[-15,-4],[-11,-7],[-28,-26],[-5,-10],[-15,-37],[-1,-7],[-6,-10],[-1,-5],[5,-2],[-4,-5],[-6,-11],[-3,-5],[-12,-11],[-4,-6],[-2,-6],[-11,-23],[1,-3],[-3,-32],[-10,-39],[0,-27],[3,-14],[4,-11],[-1,-8],[11,-54],[1,-18],[1,-3],[2,-2],[4,-4],[8,-5],[3,-3],[2,-12],[3,-5],[2,-3],[-1,-5],[-2,-2],[-3,-2],[-7,-3],[3,-2],[3,0],[8,2],[3,0],[2,-2],[0,-3],[-2,-2],[0,-1],[-1,-8],[-4,-20],[1,-28],[-2,-15],[-5,-7],[-8,-19],[-3,-5],[-10,-1],[-4,-1],[-5,-6],[-1,-1],[-5,-3],[-3,-5],[2,-4],[8,2],[6,5],[5,6],[5,3],[5,-4],[-4,-13],[1,-15],[8,-42],[5,-14],[25,-52],[4,-13],[-2,-16],[-6,-12],[-2,-8],[2,-7],[4,-6],[7,-24],[10,-22]],[[4156,2359],[-1,-2],[-2,-3]],[[4153,2354],[-12,27],[-16,18],[-5,12],[-10,14],[-4,4],[0,-28],[-2,-10],[-5,2],[-1,4],[1,9],[-1,4],[-3,2],[-3,2],[-2,3],[-1,-8],[0,-5],[-6,-3],[-7,-10],[1,-9],[4,-7],[11,-13],[4,-9],[2,-4],[5,-1],[7,-1],[8,-2],[15,0],[2,-1],[3,-2],[3,-3],[3,-1],[2,0]],[[4146,2338],[0,-1],[-11,-5],[-8,-1],[-17,4],[-6,0],[-8,-1],[-3,1],[-2,2],[0,1],[0,3],[1,1],[2,3],[1,2],[0,2],[0,3],[0,1],[-9,1],[-5,2],[-7,5],[-2,1],[-3,-1],[-1,-2],[-1,-1],[1,-2],[1,-2],[2,-2],[3,-2],[2,-2],[0,-2],[0,-2],[-1,-3],[-3,-2],[-8,-2],[-7,-3],[-5,-4],[-5,-6],[-3,-4],[0,-3],[0,-2],[1,-2],[1,-3],[-1,-3],[-2,-5],[-29,-16],[-19,-8],[-6,-1],[-5,1],[-3,1],[-4,0],[-2,-2],[-1,-3],[-1,-2],[1,-3],[1,-2],[2,-1],[3,-1],[2,-2],[2,-2],[2,-2],[0,-2],[-2,-4],[-3,-1],[-4,0],[-3,1],[-7,0],[-5,0],[-8,4],[-2,3],[-1,2],[1,3],[0,3],[-1,6],[-3,2],[-4,1],[-23,-5],[-7,0],[-3,2],[-3,4],[-2,4],[-5,6],[-3,2],[-4,2],[-6,1],[-5,0],[-8,0],[-6,-3],[-2,-1],[-1,-2],[-1,-2],[0,-7],[-1,-3],[-3,-6],[-1,-3],[1,-3],[0,-3],[0,-4],[-2,-4],[-11,-6],[-3,-2],[-3,-4],[-7,-6],[-7,-9],[-5,-4],[-4,-1],[-3,1],[-3,3],[-3,3],[-5,1],[-4,-1],[-4,-4],[-12,-17],[-8,-11],[-3,-2],[-3,-2],[-4,-1],[-13,-1],[-7,-2],[-5,1],[-4,2],[-3,2],[-4,1],[-9,1],[-2,1],[-2,2],[-1,5],[-1,1],[-1,1],[-2,1],[-3,1],[-8,2],[-6,0],[-3,-1],[-1,-1],[-2,-6],[0,-3],[-1,-3],[-3,-3],[-5,-3],[-3,0],[-3,2],[-1,3],[-1,5],[-2,3],[-4,2],[-15,-1],[-5,-1],[-8,-3],[-14,-2],[-4,-1],[-2,-2],[-3,-6],[-2,-3],[-3,-2],[-4,0],[-5,0],[-3,-2],[-2,-3],[-3,-5],[-1,-2],[-1,-4],[-1,-10],[-1,-4],[-2,-6],[-6,-23],[-10,-25],[-1,-3],[-2,-2],[-13,-10],[-3,0],[-3,1],[-2,2],[-2,1],[-2,0],[-1,-2],[0,-3],[0,-5],[0,-4],[-2,-6],[-15,-16],[-4,-2],[-3,-1],[-3,-1],[-7,0],[-3,0],[-3,1],[-9,3],[-19,11],[-8,8],[-15,22]],[[3452,2092],[2,3],[3,4],[1,4],[0,3],[-2,10],[-1,5],[1,2],[1,1],[1,1],[1,1],[3,0],[3,-1],[2,-1],[3,-3],[1,0],[1,0],[1,1],[3,3],[1,1],[3,0],[2,0],[3,1],[3,2],[1,1],[1,2],[-1,9],[1,2],[1,2],[3,1],[2,0],[2,0],[2,0],[2,-2],[22,-15],[4,-1],[3,0],[2,1],[0,4],[-1,4],[-5,7],[-5,3],[-4,2],[-3,1],[-1,1],[0,2],[1,4],[9,11],[4,6],[1,1],[0,3],[2,8],[2,4],[1,2],[2,2],[7,3],[2,2],[3,3],[2,4],[1,5],[0,9],[1,4],[2,3],[6,5],[2,4],[2,4],[1,7],[1,2],[0,2],[1,2],[-1,3],[1,3],[1,5],[0,4],[0,3],[-1,4],[-1,2],[-2,2],[-2,1],[-4,-5],[-2,-1],[-2,-1],[-2,-1],[-2,0],[-2,1],[-2,0],[-14,11],[-2,1],[-2,0],[-2,0],[-2,0],[-2,0],[-2,1],[-3,2],[-2,1],[-2,0],[-5,-3],[-2,0],[-3,2],[-1,5],[-1,3],[-3,3],[-2,2],[-2,3],[-1,2],[0,4],[0,2],[2,2],[1,2],[0,1],[1,2],[-1,15],[0,4],[1,4],[1,3],[1,4],[-2,10],[0,4],[1,4],[2,7],[1,3],[0,2],[-2,2],[-3,0],[-3,0],[-4,-1],[-2,0],[-2,0],[-2,0],[-4,3],[-2,1],[-2,0],[-2,-1],[-4,-3],[-3,-1],[-3,0],[-3,0],[-8,1],[-6,3],[-4,0],[-4,1],[-2,0],[-3,2],[-2,3],[-12,14],[-3,1],[-3,1],[-2,1],[-3,-1],[-6,-2],[-3,0],[-3,2],[-2,4],[-1,4],[-1,3],[2,2],[2,0],[6,-1],[3,0],[2,1],[2,1],[0,3],[-1,3],[-4,5],[-2,4],[-1,3],[2,4],[3,7],[0,4],[0,5],[-2,7],[-4,9],[-16,10],[-10,-6],[-2,0],[-2,0],[-3,1],[-4,0],[-4,-1],[-4,-3],[-5,-7],[-2,-2],[-2,-1],[-1,2],[-1,2],[-1,3],[-1,8],[0,3],[1,2],[1,2],[7,5],[1,2],[1,1],[0,1],[0,10],[0,2],[-1,2],[0,1],[-2,0],[-2,0],[-4,-3],[-2,-2],[-2,-2],[-1,-3],[-1,-3],[-3,-2],[-3,-1],[-6,1],[-2,2],[-2,2],[-2,1],[-2,0],[-8,1],[-6,2],[-2,0],[-3,-2],[-2,-2],[-2,-2],[0,-3],[0,-2],[1,-3],[2,-2],[2,-2],[1,-2],[1,-3],[-1,-2],[-2,-2],[-3,-3],[-7,-4],[-3,-3],[-4,-4],[-2,-1],[-3,-2],[-6,-1],[-3,-2],[-2,-3],[-2,-3],[-1,-4],[-1,-4],[-2,-2],[-2,0],[-3,2],[-1,2],[-1,2],[-3,1],[-5,0],[-4,-1],[-3,-1],[-3,-1],[-1,-2],[-1,-2],[0,-3],[2,-4],[-2,-1],[-2,0],[-7,1],[-5,-1],[-9,-5],[-8,-7],[-2,0],[-2,-1],[-8,1],[-1,0],[-3,-2],[-2,1],[-2,0],[0,6],[0,9],[-1,3],[-3,8],[-1,4],[-1,4],[-2,3],[-4,2],[-3,3],[-1,2],[0,3],[-2,3],[-2,1],[-10,-2],[-6,2],[-7,1],[-2,0],[-3,-1],[-3,0],[-4,2],[-4,3],[-4,2],[-3,0],[-6,-1],[-4,1],[-5,7],[-3,1],[-2,0],[-3,-1],[-7,-5],[-2,0],[-1,2],[0,3],[0,3],[0,3],[-1,1],[-2,1],[-2,-1],[-1,-1],[-1,-2],[-1,-1],[0,-2],[-1,-1],[0,-2],[0,-2],[0,-1],[-1,-1],[-1,-1],[-6,-2],[-1,-1],[0,-2],[1,-1],[2,-2],[3,-1],[2,-2],[1,-2],[0,-4],[0,-4],[1,-2],[1,-6],[0,-3],[-1,-3],[-3,-1],[-4,-1],[-3,0],[-4,1],[-6,2],[-2,0],[-2,-1],[-1,-1],[-1,-3],[-2,-3],[-2,-1],[-3,1],[-3,3],[-5,5],[-1,1],[-2,2],[-1,0],[-1,1],[-1,-1],[0,-1],[-1,-3],[-1,-2],[-2,-3],[-2,-1],[-2,1],[-2,5],[-1,5],[-2,9],[0,5],[1,4],[2,3],[5,5],[2,2],[1,2],[1,3],[1,3],[1,1],[2,1],[1,1],[1,2],[1,2],[0,3],[-1,4],[-2,2],[-6,7],[-2,2],[-5,9],[-4,5],[-1,1],[-2,1],[-2,3],[-1,4],[0,6],[1,4],[2,2],[0,1],[0,2],[-3,5],[-21,20],[-1,3],[0,3],[2,3],[3,1],[4,1],[2,0],[2,4],[1,2],[2,1],[2,0],[2,-1],[2,-1],[3,-3],[3,-2],[1,0],[2,0],[1,1],[2,0],[1,-3],[1,-3],[2,-17],[2,-8],[1,-3],[2,-3],[2,-1],[1,-2],[6,-2],[5,-2],[10,-2],[3,-1],[3,-1],[2,-2],[3,-5],[2,-2],[3,-1],[4,0],[6,0],[9,0],[5,0],[21,6],[3,0],[2,-1],[3,-1],[2,-1],[4,0],[2,-1],[1,-2],[2,-2],[4,-9],[6,-8],[1,-4],[0,-3],[0,-3],[-1,-3],[2,-2],[3,-1],[5,-1],[7,-3],[3,-1],[3,1],[2,1],[0,2],[-1,3],[-4,8],[-1,2],[0,2],[2,6],[-1,2],[-2,2],[-3,2],[-3,2],[-2,3],[-1,1],[-1,1],[-1,7],[-1,2],[-4,5],[-1,2],[-1,2],[0,2],[1,2],[8,10],[1,2],[1,3],[-1,2],[-2,1],[-4,1],[-3,0],[-1,2],[0,1],[2,1],[5,5],[7,7],[2,1],[3,1],[5,1],[14,1],[4,0],[3,2],[2,2],[1,2],[0,2],[-1,3],[-3,8],[-1,3],[0,3],[1,4],[2,7],[1,2],[-1,2],[-4,1],[-9,1],[-2,1],[-1,2],[0,2],[-1,1],[-1,2],[-1,1],[-2,2],[-4,2],[-2,1],[-3,-1],[-4,-2],[-1,-2],[-1,-3],[1,-3],[1,-3],[1,-3],[6,-9],[2,-3],[-1,-3],[-2,-2],[-4,0],[-5,3],[-4,3],[-5,9],[-3,1],[-5,2],[-9,2],[-3,2],[-2,3],[0,2],[0,3],[-1,2],[-1,1],[-4,0],[-4,0],[-9,-2],[-8,0],[-5,0],[-3,2],[-7,4],[-3,0],[-3,-1],[-4,-4],[-4,-7],[-4,-5],[-2,-3],[-1,-3],[1,-9],[0,-3],[-1,-2],[-2,-2],[-4,-1],[-6,1],[-7,2],[-8,2],[-11,1],[-21,4],[0,3],[1,4],[2,2],[2,3],[0,2],[0,2],[-2,2],[-11,5],[-3,2],[-2,3],[-2,3],[-1,3],[-1,4],[0,5],[1,3],[1,3],[2,1],[2,2],[1,0],[2,0],[2,0],[2,-1],[2,1],[2,1],[1,1],[1,5],[2,2],[3,4],[1,1],[0,3],[0,3],[-3,4],[-2,2],[-2,1],[-6,0],[-8,1],[-3,0],[-2,0],[-5,-3],[-2,-1],[-1,1],[-2,0],[-1,2],[-3,5],[-3,8],[-2,4],[-3,2],[-2,2],[-2,1],[-6,2],[-2,1],[-1,3],[-4,16],[-1,6],[0,5],[2,8],[3,9],[3,5],[1,4],[1,5],[-2,11],[1,3],[2,1],[7,3],[2,0],[0,2],[1,1],[6,22],[1,9],[0,6],[1,7],[0,3],[-1,3],[-3,4],[-3,1],[-2,1],[-2,1],[-3,1],[-6,4],[-2,1],[-10,2],[-2,1],[-1,1],[0,1],[2,4],[3,3],[2,1],[1,2],[1,3],[-1,5],[1,8],[6,11],[4,-2],[30,-17],[6,-1],[9,-1],[4,-1],[6,-3],[4,-1],[3,1],[5,3],[4,0],[4,1],[2,-1],[2,-1],[2,-1],[2,-2],[1,-3],[2,-2],[3,0],[2,0],[3,1],[2,2],[8,8],[3,3],[2,4],[2,9],[3,5],[2,3],[2,3],[1,3],[2,3],[1,3],[0,5],[0,7],[-1,6],[-5,17],[-3,23],[-4,5],[-3,2],[-4,2],[-12,3],[-2,1],[-2,2],[-1,5],[-3,18],[-3,6],[-2,3],[-1,1],[-2,2],[-2,3],[-2,7],[-3,6],[-1,1],[0,2],[-1,3],[2,2],[3,-1],[6,-4],[1,-1],[1,0],[2,3],[0,4],[0,16],[-3,15],[0,2],[0,2],[1,3],[2,4],[3,3],[4,2],[3,1],[3,0],[3,-1],[4,-1],[3,-1],[2,2],[1,3],[-3,8],[-4,8],[-4,8],[-2,2],[-2,0],[-2,1],[-2,1],[-1,4],[-1,8],[2,15],[0,8],[2,4],[-1,5],[14,16],[24,14],[7,2],[21,3],[3,0],[6,-3],[4,-2],[15,-1],[42,-1],[1,0],[5,-1],[3,5],[6,6],[2,4],[1,2],[-1,16],[1,7],[1,9],[0,6],[-2,19],[0,7],[1,5],[2,4],[1,4],[-1,10],[1,4],[2,3],[1,1],[10,6],[4,3],[2,3],[2,3],[0,5],[-2,4],[-3,2],[-2,4],[-13,6],[-7,1],[-22,0],[-5,0],[-35,9],[-3,3],[-9,12],[1,2],[4,3],[13,7],[12,9],[9,5],[2,3],[2,3],[0,5],[2,3],[3,2],[7,3],[3,2],[2,3],[1,4],[1,6],[2,4],[1,2],[-1,2],[-2,2],[-2,0],[-3,0],[-4,-1],[0,2],[2,3],[2,3],[6,5],[1,2],[0,2],[-3,3],[-7,4],[-2,1],[0,2],[0,4],[2,15],[1,3],[2,2],[3,2],[0,4],[0,43],[1,7],[2,7],[3,6],[5,6],[1,5],[-1,6],[-8,14],[-3,5],[-2,14],[-1,2],[-3,2],[-3,2],[-7,1],[-3,2],[-2,2],[-2,4],[0,5],[3,10],[42,53],[4,7],[2,8],[4,4],[3,2],[4,0],[5,1],[3,2],[3,4],[1,6],[3,3],[3,2],[17,3],[1,1],[10,19],[2,5],[-1,2],[-3,1],[-7,-2],[-4,-2],[-8,-4],[-4,-2],[-3,0],[-2,1],[-2,1],[-2,9],[-11,-2],[-5,0],[-7,1],[-4,0],[-4,0],[-2,2],[-5,3],[-5,3],[-11,4],[-4,7],[4,7],[10,13],[3,9],[3,2],[3,2],[12,5],[4,2],[2,3],[0,3],[0,5],[-2,3],[-2,3],[-5,3],[-1,2],[-1,1],[0,1],[1,2],[2,5],[2,4],[3,2],[2,1],[4,1],[3,2],[3,2],[21,19],[1,3],[1,3],[0,5],[-2,11],[-3,10],[-3,6],[-3,4],[-11,9],[-1,2],[0,3],[1,4],[1,1],[3,1],[4,1],[2,1],[2,1],[1,1],[0,4],[-3,17],[-7,17],[-1,4],[1,5],[2,4],[2,5],[1,3],[-1,3],[-11,5]],[[3219,4021],[3,8],[0,2],[-2,4],[-2,2],[-15,10],[0,3],[2,2],[4,2],[3,3],[3,2],[2,4],[1,5],[1,8],[1,2],[2,3],[0,3],[0,2],[-1,2],[1,3],[6,5],[2,2],[1,4],[3,3],[3,3],[3,1],[3,1],[14,1],[3,0],[4,1],[2,2],[3,3],[2,5],[3,9],[0,5],[-1,4],[-1,3],[0,4],[0,3],[3,4],[4,4],[4,1],[3,0],[8,0],[2,0],[2,0],[3,4],[10,23],[4,6],[3,4],[4,2],[5,2],[3,2],[4,0],[7,2],[2,1],[0,4],[0,2],[-3,3],[-2,2],[-15,10],[-4,4],[-1,3],[0,3],[1,5],[-1,3],[-2,1],[-2,0],[-3,0],[-2,0],[-2,2],[-1,1],[0,2],[0,3],[0,2],[-1,1],[-2,2],[-2,0],[-4,-1],[-3,0],[-1,1],[-1,2],[0,2],[0,3],[-1,3],[-1,4],[-2,6],[0,3],[2,2],[4,2],[3,2],[4,4],[4,6],[3,3],[3,1],[3,2],[2,1],[1,2],[0,3],[-1,3],[0,2],[0,3],[1,4],[3,9],[3,11],[2,4],[3,3],[7,8],[1,3],[-2,1],[-6,3],[-1,1],[0,1],[1,2],[5,5],[3,2],[4,2],[3,1],[3,0],[2,0],[3,0],[6,-2],[3,-1],[8,1],[1,0],[1,-1],[8,-12],[4,-3],[4,-3],[4,-2],[5,0],[4,0],[6,2],[2,0],[2,0],[5,-2],[3,-1],[10,0],[3,1],[3,2],[2,3],[0,7],[0,4],[-3,16],[0,3],[1,3],[2,4],[2,2],[2,3],[4,10],[3,4],[3,4],[3,2],[3,1],[14,2],[4,2],[2,2],[2,2],[1,3],[0,3],[-1,18],[1,8],[1,5],[6,11],[2,8],[3,4],[3,4],[11,6],[3,3],[2,2],[1,4],[1,3],[0,3],[-1,3],[-3,3],[-3,1],[-4,1],[-3,3],[-11,28],[-3,8],[3,10],[14,-6],[4,-3],[1,-1],[2,-3],[4,-7],[1,-2],[2,-1],[1,-1],[22,-8],[2,0],[2,1],[2,1],[1,2],[0,1],[1,1],[1,1],[2,0],[3,1],[2,0],[3,1],[2,0],[4,-2],[3,-1],[3,-1],[5,0],[6,1],[5,0],[21,-8],[12,-7],[2,0],[7,1],[14,0],[9,-4],[2,-3],[5,-4],[1,-1],[3,-2],[2,-1],[0,-2],[1,-1],[9,-26],[1,-2],[1,-1],[3,-2],[9,-2],[2,-2],[1,-1],[1,-4],[1,-2],[2,-2],[3,-1],[7,-2],[3,-2],[1,-1],[1,-1],[1,-1],[2,-1],[4,0],[9,2],[4,2],[3,1],[4,8],[1,2],[2,1],[14,6],[22,4],[4,0],[3,-1],[7,-2],[3,-2],[2,-2],[5,-8],[1,-2],[2,-1],[4,-1],[30,-4],[5,-2],[2,-3],[5,-6],[2,-2],[2,-1],[3,-1],[5,0],[28,0],[1,-1],[2,0],[10,0],[3,-1],[1,-2],[1,-2],[1,-1],[2,-1],[3,-2],[1,0],[3,0],[2,1],[4,3],[1,2],[1,2],[0,4],[1,3],[1,2],[2,2],[6,2],[25,8],[2,1],[1,1],[6,2],[21,-3],[3,-5],[2,-2],[8,-7],[2,-3],[5,-9],[2,-3],[1,-1],[2,-1],[1,0],[7,-2],[5,-2],[4,-1],[1,-1],[2,-1],[1,-1],[4,-6],[3,-3],[1,-2],[1,-2],[2,-7],[1,-4],[0,-4],[-2,-13],[-1,-5],[-1,-6],[1,-7],[-2,-5],[-1,-4],[-1,-1],[-4,-4],[-1,-1],[-1,-2],[0,-1],[1,-4],[-1,-7],[1,-6],[1,-7],[3,-8],[-8,-4],[-9,-7],[-7,-10],[-4,-10],[1,-11],[6,-2],[18,3],[3,-5],[4,-24],[3,-11],[0,-18],[-1,-6],[-4,-4],[-11,-10],[1,-1],[16,-10],[12,-4],[13,-11],[7,-5],[2,-3],[6,-10],[2,-1],[28,-3],[24,3],[4,1],[6,4]],[[4827,3459],[4,0],[4,0],[4,2],[-6,2],[2,2],[4,0],[4,0],[2,3],[0,6],[-1,1],[-1,2],[-1,0],[-2,-2],[-2,-3],[-3,-2],[-3,-1],[-11,0],[-5,1],[-1,3],[3,7],[-3,-1],[-3,-2],[-2,-2],[-2,-2],[-3,-2],[-2,-1],[0,-1],[4,-3],[4,-2],[8,-1],[8,-4]],[[2831,1712],[1,-3],[0,-1],[0,-2],[-1,-1],[-2,-1],[-3,-1],[-5,-1],[-4,-3],[-3,-3],[-2,-3],[-3,-5],[-4,-3],[-8,-1],[-6,0],[-8,3],[-3,2],[-9,1],[-2,-4],[-1,-3],[0,-3],[2,-5],[0,-3],[-2,-6],[0,-2],[0,-3],[2,-2],[0,-2],[1,-2],[0,-1],[0,-1],[1,-1],[1,-3],[3,-3],[16,-3],[37,-11],[3,-2],[7,-7],[3,-2],[5,-2],[3,-1],[5,-2],[3,-3],[7,-11],[9,-5],[-3,-8],[-20,-15],[-3,-3],[-7,-10],[-2,-4],[1,-3],[2,-2],[3,-1],[3,0],[8,3],[2,0],[2,0],[2,0],[8,-4],[4,-1],[3,0],[8,2],[23,1],[5,1],[2,2],[10,7],[3,1],[1,-1],[0,-2],[0,-6],[-2,-5],[-2,-4],[-1,-2],[0,-3],[3,-4],[2,-2],[3,-2],[3,-4],[2,-6],[4,-12],[3,-6],[3,-3],[2,-2],[2,-1],[0,-2],[-1,-4],[-3,-1],[-3,-1],[-3,0],[-7,3],[-3,1],[-3,0],[-2,-1],[-2,-2],[-2,-2],[-1,-3],[-2,-5],[0,-5],[0,-5],[1,-7],[5,-8],[4,-3],[6,-3],[17,-5],[17,-8],[3,-3],[2,-3],[2,-3],[1,-6],[2,-3],[2,-4],[3,-2],[3,-2],[2,-1],[2,-1],[1,-2],[1,-4],[0,-3],[-1,-4],[-2,-6],[-1,-4],[0,-13],[-1,-5],[-4,-5],[-4,-2],[-4,-2],[-4,0],[-2,-3],[0,-4],[2,-28],[-2,-18],[0,-2],[0,-1],[-4,-8],[-1,-11],[1,-4],[1,-4],[1,-3],[5,-7],[2,-4],[1,-5],[-1,-9],[0,-4],[2,-4],[2,-3],[7,-4],[4,-3],[4,-4],[7,-8],[3,-3],[2,-1],[3,-1],[2,-1],[5,-2],[4,0],[6,2],[12,9],[15,14],[3,2],[5,3],[15,5],[12,7],[8,2],[6,-4],[1,-2],[8,-14],[3,-3],[1,-7],[1,-7],[2,-5],[2,-3],[4,-3],[2,-1],[0,-3],[0,-3],[-1,-7],[-16,-34],[-1,-3],[0,-3],[5,-11],[7,-22],[0,-4],[-1,-5],[-10,-19],[-1,-4],[0,-4],[2,-14],[2,-8],[0,-6],[-1,-5],[-16,-53],[0,-3],[0,-2],[1,-2],[1,-1],[1,-1],[3,-1],[3,-1],[2,-1],[2,-1],[1,-1],[3,-3],[2,-2],[4,0],[3,0],[15,7],[3,1],[6,0],[2,0],[3,-2],[1,-2],[3,-7],[3,-4],[10,-13],[2,-5],[0,-9],[-10,-8],[-2,-3],[-2,-4],[-8,-25],[-9,-15],[-20,-62],[-8,-21],[-7,-10],[-13,-8],[-2,-3],[-1,-1],[1,-5],[8,-22],[4,-10],[5,-4],[7,-4],[2,-2],[2,-2],[1,-2],[1,-1],[-1,-4],[-6,-19],[-14,-23],[-4,-5],[-1,-3],[1,-4],[1,-3],[0,-3],[0,-6],[1,-3],[1,-4],[2,-3],[3,-3],[16,-13],[6,-7],[2,-3],[1,-3],[0,-4],[-2,-5],[-3,-5],[-7,-7],[-4,-2],[-2,-1],[-2,1],[-2,3],[-1,0],[-1,0],[-1,0],[0,-2],[0,-3],[0,-3],[3,-10],[1,-3],[-2,-4],[-3,-5],[-7,-9],[-4,-7],[-1,-4],[0,-1],[0,-4],[0,-2],[-1,-3],[-1,-2],[-2,-2],[-3,-1],[-7,1],[-2,0],[-1,-1],[-2,-3]],[[3069,535],[-40,29],[-11,13],[-28,40],[-19,17],[-4,11],[-25,29],[-3,9],[-12,11],[-12,20],[-6,7],[-29,25],[-5,8],[1,4],[4,0],[5,-7],[6,1],[6,4],[4,2],[-5,0],[-4,-1],[-4,-1],[-4,4],[1,4],[3,5],[4,4],[3,2],[19,-3],[1,2],[-3,2],[-4,3],[-2,1],[2,1],[5,1],[4,2],[0,3],[-3,1],[-5,-1],[-4,-2],[-2,-2],[-2,-3],[-5,0],[-8,4],[-2,-2],[-4,-11],[-2,-4],[-3,5],[3,3],[1,2],[1,5],[-5,-3],[-4,-4],[-1,-6],[1,-6],[-4,3],[-2,5],[-1,5],[-1,5],[-1,4],[-4,7],[-4,11],[-10,21],[1,8],[1,-2],[0,-1],[1,-2],[0,-2],[3,0],[0,5],[2,14],[-3,-3],[-1,-1],[-1,-3],[-2,0],[-7,21],[-5,11],[-5,1],[1,-4],[11,-26],[0,-5],[-2,0],[-27,62],[-18,59],[-7,48],[2,9],[-6,53],[-9,25],[-2,4],[-2,16],[-2,4],[6,4],[6,-4],[5,-8],[2,-7],[-2,-1],[-8,2],[-1,-1],[0,-4],[1,-4],[2,-3],[4,-2],[0,2],[2,5],[2,-5],[-1,-5],[-1,-5],[-1,-2],[3,1],[3,1],[2,3],[-3,5],[4,3],[2,-6],[9,-57],[2,0],[0,10],[-3,22],[3,9],[-8,10],[-1,6],[4,3],[2,-5],[5,-9],[3,-5],[0,-4],[-1,-8],[1,-5],[3,-18],[3,-7],[5,-6],[0,-5],[-2,-5],[-3,-4],[-2,-5],[-6,-31],[1,-5],[7,-2],[16,-3],[4,1],[8,-4],[6,2],[9,11],[-7,3],[-6,5],[-6,2],[-7,-3],[-4,2],[-3,3],[4,9],[0,7],[-1,7],[-1,17],[-1,6],[-3,3],[-3,-1],[0,3],[1,7],[-1,4],[-1,3],[-3,7],[0,3],[1,6],[3,4],[1,3],[-1,7],[-2,7],[-8,13],[-1,5],[-14,14],[-3,4],[-6,-5],[-5,9],[-3,14],[1,6],[-6,4],[-3,19],[-4,1],[-2,2],[-2,3],[-3,7],[-2,-7],[2,-7],[3,-6],[2,-5],[1,-14],[1,-7],[3,-6],[-5,4],[-5,8],[-11,29],[0,5],[1,5],[0,3],[-3,4],[0,5],[16,9],[4,5],[1,2],[1,3],[1,2],[-1,3],[-2,0],[-2,-2],[-2,0],[-3,7],[-3,3],[-4,2],[5,-12],[0,-6],[-2,-6],[-6,-3],[-5,1],[-3,5],[-3,4],[-5,15],[-6,28],[-5,15],[-12,16],[-2,6],[-1,7],[-3,16],[-3,5],[-9,8],[-4,5],[-2,13],[-21,42],[-2,7],[-1,2],[-1,2],[-2,3],[0,4],[1,1],[4,4],[2,2],[-11,4],[-5,14],[-5,29],[-17,58],[-30,74],[-2,3],[-2,2],[-1,2],[0,4],[3,3],[1,2],[-2,5],[-4,-2],[-4,5],[-6,14],[-6,10],[-4,5],[-5,1],[-7,1],[-5,1],[-2,4],[-1,7],[-2,7],[-6,9],[1,5],[-19,45],[-8,12],[-44,48],[-2,-1],[-6,-2],[-1,1],[-1,4],[-9,9],[-5,12],[6,1],[25,-5],[0,2],[-4,3],[-2,4],[1,4],[3,6],[-4,-2],[-7,-6],[-4,-2],[-6,1],[-5,2],[-5,4],[-4,5],[-4,8],[1,2],[11,-1],[5,2],[-1,3],[-7,7]],[[2451,1842],[0,6],[-1,4],[2,8],[5,5],[3,-2],[2,-1],[4,2],[3,3],[5,2],[3,3],[5,0],[0,5],[-5,2],[-4,-2],[-5,-3],[-6,2],[-5,1],[-5,-4],[-2,-3],[-5,-2],[-2,-3],[-2,-2],[-6,1],[-6,1],[-6,-3],[-1,-21],[0,-6]],[[2422,1835],[-2,0],[-2,-2],[-1,-1],[1,-2],[-5,5],[-3,7],[-2,12],[-12,30],[-5,16],[3,12],[0,2],[-4,-1],[-3,-2],[-2,-3],[-2,-4],[0,5],[-1,4],[-2,8],[-5,13],[-22,38],[-3,7],[0,3],[-1,2],[-3,2],[-2,2],[-1,3],[-2,7],[-3,6],[-7,10],[-26,66],[-3,6],[-5,6],[0,2]],[[2297,2094],[14,4],[8,1],[5,-1],[2,-1],[2,0],[0,-1],[1,-2],[0,-2],[1,-5],[1,-3],[1,-2],[2,-2],[2,-1],[2,0],[6,-1],[2,-1],[1,0],[1,-1],[0,-1],[-1,-3],[0,-1],[0,-1],[2,-2],[2,-1],[3,-1],[1,0],[1,1],[4,3],[3,2],[4,0],[4,-1],[8,-5],[2,-1],[0,-1],[0,-2],[-1,-2],[0,-3],[0,-2],[0,-3],[1,-2],[3,-3],[3,-1],[2,0],[2,1],[3,1],[3,0],[2,-2],[5,-8],[3,-2],[2,-1],[2,0],[3,1],[2,1],[1,1],[2,2],[5,1],[15,-5],[-2,-7],[-5,-6],[-1,-4],[0,-3],[1,-2],[5,-4],[2,-4],[2,-2],[1,-2],[1,0],[1,-1],[3,-2],[3,-6],[1,-1],[1,-1],[1,0],[1,0],[2,0],[10,3],[2,0],[3,-1],[1,-1],[0,-1],[1,-1],[-1,-2],[0,-2],[-2,-2],[-1,-1],[-5,-4],[-1,-2],[-1,-3],[1,-6],[0,-2],[2,-3],[4,-4],[4,-6],[2,-6],[2,-10],[1,-5],[2,-2],[1,-1],[2,0],[2,0],[3,0],[2,0],[2,0],[6,-5],[32,-38],[6,-5],[10,-2],[3,-2],[5,-3],[2,-2],[2,-3],[2,-4],[2,-2],[2,-1],[1,0],[5,1],[3,0],[3,-1],[8,-6],[3,-2],[2,-1],[3,0],[1,0],[3,1],[2,0],[3,0],[4,-2],[2,-1],[1,-3],[2,-11],[2,-6],[2,-3],[5,-6],[6,-6],[6,-3],[5,-3],[6,-1],[6,-1],[8,-1],[19,-4],[8,0],[13,8],[12,4],[5,0],[3,-2],[1,-3],[0,-8],[-1,-13],[1,-4],[1,-2],[4,-4],[3,-1],[3,0],[3,1],[2,1],[3,1],[6,0],[4,-1],[3,-2],[3,-3],[2,-3],[3,-6],[2,-3],[2,-3],[3,-1],[1,0],[4,2],[2,1],[3,-1],[3,-1],[3,-2],[7,-11],[5,-5],[2,-2],[3,-1],[6,-1],[3,0],[2,0],[5,2],[3,1],[3,-1],[3,-2],[2,-2],[0,-4],[1,-7],[1,-7],[5,-6]],[[1681,527],[-4,-3],[-4,-1],[-3,2],[0,7],[2,0],[0,-4],[0,-1],[7,2],[5,4],[3,6],[1,7],[2,0],[0,-1],[1,-1],[-6,-14],[-4,-3]],[[1880,1154],[-2,-2],[0,3],[1,4],[1,3],[2,3],[1,-1],[0,-3],[-1,-2],[-1,-3],[-1,-2]],[[1887,1182],[1,0],[1,0],[-1,-1],[-1,-1],[-1,1],[0,1],[1,0]],[[1535,1325],[-1,0],[2,2],[6,4],[0,-1],[0,-1],[-4,-3],[-2,-1],[-1,0]],[[1508,1403],[-3,-2],[0,1],[1,1],[2,0]],[[1896,1420],[-3,-1],[-1,0],[0,1],[3,0],[1,0]],[[1384,1423],[-5,-10],[0,8],[2,6],[2,3],[2,3],[2,2],[1,2],[0,-4],[-4,-10]],[[1575,1518],[-2,0],[0,1],[1,1],[1,0],[1,1],[0,-1],[-1,-1],[0,-1]],[[1585,1545],[-1,5],[-1,0],[0,1],[2,6],[5,14],[2,0],[0,-2],[-1,-1],[0,-1],[-1,-1],[-1,-6],[-1,-5],[-3,-10]],[[1665,1648],[-1,-2],[-1,4],[0,2],[1,2],[2,0],[0,-4],[-1,-2]],[[1560,1718],[1,2],[1,1],[3,0],[-3,-2],[-1,0],[-1,-1]],[[6346,5381],[6,-10],[4,-2],[5,-2],[6,-1],[6,-2],[5,-5],[18,-11],[5,-1],[5,0],[5,0],[5,-1],[18,-7],[9,-6],[6,-4],[3,-4],[1,-2],[0,-2],[2,-7],[0,-4],[0,-3],[0,-2],[-4,-9],[1,-6],[3,-7],[9,-10],[5,-2],[4,2],[2,4],[2,3],[2,2],[3,1],[3,2],[2,3],[2,4],[3,3],[2,2],[6,0],[6,-1],[12,-6],[6,-5],[2,-6],[2,-14],[2,-7],[2,-5],[3,-6],[4,-3],[8,-3],[46,-10],[5,-4],[3,-5],[0,-5],[-2,-10],[0,-5],[1,-5],[2,-4],[11,-16],[3,-6]],[[6616,5171],[-3,-1],[-21,-8],[-22,-9],[-17,-3],[-12,3],[-4,-2],[-4,-1],[-8,0],[-3,0],[-30,-16],[-17,-11],[-50,-52],[-18,-24],[-10,-29],[3,-32],[37,-81],[4,-15],[-4,-9],[-6,3],[-7,0],[-13,-3],[4,-5],[7,-3],[16,-1],[8,1],[2,-2],[3,-4],[2,-4],[1,-3],[-2,-3],[-3,-2],[-4,2],[-5,1],[-5,-2],[-3,-3],[4,-1],[4,0],[2,-2],[2,-2],[3,0],[1,0],[2,-2],[1,-3],[9,3],[4,4],[4,3],[-6,-7],[-8,-8],[-9,-6],[-18,-6],[-51,-38],[-8,-8],[-6,-9],[-3,-11],[-2,-22],[8,4],[5,5],[4,2],[7,-4],[-1,5],[1,4],[2,8],[5,-8],[-5,-13],[-9,-12],[-6,-5],[-4,-1],[-7,-4],[-6,-4],[-3,-3],[3,-3],[6,2],[12,8],[-13,-9],[-30,-18],[-15,-6],[-17,-5],[-8,-3],[-6,-4],[-1,-4],[-4,-15],[-4,-7],[0,-5],[-18,-21],[-8,-5],[1,-4],[3,-2],[3,-2],[5,1],[-10,-6],[-17,9],[-25,20],[-15,-1],[-8,1],[-3,4],[-1,1],[-8,7],[-2,4],[-1,8],[-2,3],[-2,0],[-3,-8],[4,-11],[1,-3],[3,-3],[7,-3],[9,-7],[6,-3],[13,-3],[1,0],[4,0],[2,0],[1,-2],[0,-2],[0,-2],[1,-1],[2,-3],[2,-2],[3,-2],[4,0],[5,-2],[5,-3],[5,-2],[-35,-19],[-54,-19],[-8,-4],[-3,-1],[-4,3],[-4,2],[-3,-1],[-3,-3],[-2,-1],[-7,-1],[-42,-13],[-15,-2],[-13,-8],[-7,-3],[-3,0],[-12,0],[-3,0],[-7,-4],[-10,-2],[-21,-10],[1,1],[3,2],[1,1],[-8,-1],[-23,-13],[-23,-8],[-8,-1],[-3,1],[0,3],[-1,5],[-1,1],[-2,-1],[-2,1],[-2,2],[1,2],[1,0],[2,0],[1,1],[4,3],[9,3],[15,5],[1,-2],[0,-2],[-2,-2],[-1,-4],[15,10],[6,2],[-3,2],[-2,2],[1,3],[2,3],[-1,6],[1,30],[-5,2],[-14,2],[-13,4],[-5,1],[-8,-2],[-8,-6],[-14,-15],[-19,-15],[-5,0],[-5,-1],[-4,-2],[-4,-2],[-7,-6],[-9,-9],[-6,-10],[1,-8],[-5,-5],[-6,-11],[-3,-4],[-5,-5],[-4,-5],[0,-6],[4,-5],[0,-2],[-4,-1],[-5,-3],[-5,-4],[-2,-3],[0,-5],[2,-3],[2,1],[3,4],[2,-4],[0,-4],[0,-3],[-2,-4],[4,2],[2,1],[1,3],[2,2],[4,1],[3,0],[3,0],[2,1],[6,4],[0,3],[-2,4],[1,6],[2,-2],[3,-1],[3,1],[3,2],[-10,5],[-3,2],[0,2],[6,0],[4,3],[3,4],[5,3],[0,2],[-2,1],[-1,1],[-1,2],[-1,2],[1,1],[4,6],[0,1],[5,0],[16,-5],[14,13],[5,0],[4,-1],[3,0],[2,5],[3,-4],[1,-3],[1,-3],[0,-5],[-1,-1],[-4,-2],[-2,-1],[-1,-1],[0,-4],[-1,-2],[-3,-2],[-6,-4],[-5,-1],[-3,3],[-1,5],[-3,0],[-2,-3],[-1,-5],[-2,1],[-3,1],[-2,0],[5,-5],[1,-2],[-1,-2],[10,0],[84,40],[-13,-7],[-26,-14],[-28,-12],[-15,-7],[-18,-13],[-15,-7],[-21,-15],[-38,-36],[-25,-17],[-42,-36],[-28,-34],[-5,-2]],[[4535,3847],[-2,4],[0,7],[1,6],[1,6],[0,2],[1,2],[1,1],[2,1],[2,-1],[2,-1],[2,-2],[2,0],[1,-1],[2,1],[2,0],[1,2],[0,3],[0,4],[1,4],[1,3],[2,4],[1,3],[3,3],[1,2],[1,4],[2,8],[0,12],[-1,3],[0,2],[1,3],[2,3],[2,4],[2,1],[1,2],[1,2],[3,11],[1,6],[2,6],[0,3],[0,3],[-3,5],[-1,2],[0,2],[1,2],[0,3],[2,3],[3,4],[4,12],[2,2],[2,0],[2,-1],[2,0],[3,0],[7,2],[17,7],[3,2],[2,2],[4,7],[2,2],[2,1],[3,1],[9,2],[3,1],[3,2],[2,3],[11,19],[7,9],[4,4],[13,9],[9,11],[7,6],[8,7],[4,2],[3,1],[3,1],[2,4],[0,4],[-2,5],[-3,2],[-6,4],[-2,1],[-2,3],[-1,1],[1,3],[2,2],[2,1],[3,1],[3,0],[3,2],[2,2],[5,7],[2,3],[4,3],[3,2],[3,1],[3,1],[13,1],[5,1],[4,3],[2,3],[5,12],[1,2],[2,0],[1,0],[1,-1],[4,-4],[3,-2],[4,-1],[2,7],[2,5],[1,2],[1,1],[3,16],[0,11],[1,2],[1,2],[2,2],[1,2],[1,1],[1,1],[1,2],[9,4],[2,1],[2,2],[1,4],[-1,22],[0,3],[0,3],[-1,4],[-5,7],[-2,4],[-1,9],[-1,3],[-3,3],[-8,5],[-1,3],[0,3],[2,8],[1,4],[-1,4],[-5,8],[-1,4],[-1,4],[0,7],[1,5],[1,4],[6,13],[1,3],[-1,3],[-4,3],[-6,4],[-1,2],[-1,2],[2,3],[2,2],[6,3],[2,2],[0,3],[-1,4],[-3,4],[-2,3],[-3,1],[-9,2],[-2,1],[-2,1],[-1,2],[-6,12],[-1,3],[-3,2],[-2,1],[-10,2],[-2,2],[-1,3],[1,27],[2,10],[1,5],[-1,5],[-2,8],[-2,7],[0,7],[4,14],[-1,4],[-2,3],[-3,2],[-3,1],[-12,1],[-3,1],[-3,2],[-2,3],[-3,9],[-3,4],[-2,2],[-29,16],[-4,3],[-3,4],[-3,3],[-1,4],[0,4],[1,3],[1,4],[14,25],[3,3],[3,2],[7,3],[11,13],[3,2],[2,1],[2,-1],[3,-2],[17,-19],[2,-3],[0,-2],[0,-2],[0,-2],[2,-2],[4,0],[3,1],[2,1],[1,2],[3,6],[1,2],[1,2],[2,2],[2,0],[2,0],[1,0],[2,-1],[2,-2],[10,-9],[5,-4],[3,-2],[1,-2],[1,-2],[0,-1],[1,-2],[1,-1],[1,-1],[2,-1],[4,0],[8,1],[2,-1],[2,-2],[4,-5],[21,-42],[3,-4],[2,-1],[3,1],[2,3],[5,9],[2,3],[1,1],[2,2],[2,1],[2,1],[4,1],[3,0],[33,-5],[4,-1],[9,-5],[4,-1],[13,-1],[3,0],[2,-2],[0,-3],[-1,-3],[-1,-4],[0,-3],[0,-5],[0,-3],[0,-2],[0,-2],[1,-1],[6,1],[3,1],[13,11],[3,2],[4,2],[7,2],[4,2],[5,5],[2,2],[0,3],[-1,2],[-7,6],[-1,1],[-1,2],[0,2],[0,4],[5,17],[1,5],[0,4],[-2,6],[0,1],[-1,0],[-2,1],[-7,1],[-5,0],[-1,-1],[-2,0],[-2,-1],[0,-1],[-4,-2],[-3,-1],[-2,0],[-3,0],[-1,1],[-2,1],[-1,2],[-4,5],[-2,1],[-2,2],[-3,0],[-3,0],[-14,-1],[-4,1],[-2,0],[-2,1],[-5,5],[-2,2],[-17,7],[-1,4],[0,5],[7,23],[1,5],[0,9],[-3,15],[0,18],[-1,4],[-2,3],[-1,2],[-1,2],[0,7],[3,29],[0,8],[-1,4],[-2,-1],[-2,-1],[-2,-2],[-1,0],[-2,2],[-2,3],[-1,6],[-1,6],[-1,2],[-2,0],[-1,-1],[-1,-1],[-1,0],[-1,-1],[0,1],[-6,10],[-1,4],[0,5],[6,24],[2,5],[1,6],[1,5],[-1,4],[0,4],[-2,4],[-3,8],[-1,3],[-1,4],[-1,39],[0,2],[1,2],[1,2],[2,1],[2,1],[2,0],[10,-3],[2,-1],[1,-1],[1,-1],[0,-2],[-1,-4],[1,-2],[0,-1],[1,-2],[2,0],[3,0],[5,2],[5,2],[3,3],[4,4],[5,9],[3,5],[6,6],[3,2],[2,1],[3,0],[3,3],[5,5],[16,24],[7,20],[5,8],[1,7],[-1,4],[0,1],[1,2],[1,1],[3,2],[4,1],[28,1],[3,0],[3,-2],[2,-2],[3,-1],[2,0],[3,1],[4,2],[4,2],[7,1],[7,0],[35,6],[4,-1],[4,-3],[3,-2],[2,-2],[2,-2],[4,-1],[3,-1],[4,-1],[2,-2],[5,-5],[3,-2],[3,-1],[17,2],[5,1],[5,1],[6,5],[4,5],[4,7],[10,26],[2,5],[8,10],[1,3],[0,2],[-1,1],[-1,1],[0,2],[1,2],[1,3],[2,4],[2,3],[3,2],[3,1],[4,-1],[15,-6],[3,-1],[3,0],[3,0],[3,1],[2,2],[1,4],[0,7],[-1,4],[-1,4],[-2,2],[-12,10],[-2,3],[-2,3],[-1,4],[0,8],[0,4],[3,7],[2,11],[1,3],[3,6],[31,50],[5,10],[2,6],[0,9],[1,3],[2,2],[5,1],[2,-1],[2,-2],[2,-1],[2,0],[2,1],[1,4],[0,5],[1,1],[2,1],[6,0],[2,0],[2,1],[2,6],[-1,6],[0,2],[0,3],[3,8],[1,3],[-1,3],[-1,1],[-3,2],[-9,6],[-4,2],[-2,3],[0,3],[0,3],[1,13],[2,3],[2,3],[6,3],[4,1],[2,2],[3,2],[0,3],[-1,2],[-1,2],[-2,2],[-4,3],[-1,3],[1,4],[3,5],[16,24],[7,6],[5,3],[8,4],[20,7],[4,3],[29,24],[8,6],[12,3],[14,2],[5,0],[5,2],[3,3],[10,11],[2,2],[1,3],[0,2],[1,4],[0,4],[0,6],[-2,4],[-7,12],[-1,2],[1,6]],[[5416,5493],[13,-3],[10,-4],[10,-7],[20,-25],[2,-5],[2,-4],[4,-5],[10,-8],[4,-1],[2,0],[8,0],[4,-1],[21,-10],[7,-2],[33,2],[4,1],[22,10],[2,2],[2,2],[2,1],[1,3],[0,3],[0,3],[0,3],[1,2],[3,2],[5,1],[69,1],[5,1],[4,2],[1,2],[2,1],[4,1],[7,1],[6,-1],[21,-5],[10,-4],[3,1],[2,0],[5,6],[2,1],[3,1],[11,1],[1,1],[18,10],[9,7],[8,-19],[4,-19],[1,-12],[0,-10],[-2,-9],[-2,-5],[-1,-3],[-17,-22],[-10,-23],[-4,-5],[-2,-3],[-3,-5],[1,-3],[1,0],[5,0],[13,5],[3,0],[4,1],[6,-1],[6,-2],[4,-2],[27,-17],[7,-8],[2,-2],[2,0],[2,0],[2,2],[16,17],[15,14],[4,2],[15,6],[6,3],[5,2],[5,1],[4,0],[4,-1],[4,-2],[31,-17],[20,-6],[16,-2],[8,-3],[2,0],[7,4],[4,1],[6,2],[4,2],[3,2],[4,3],[5,3],[4,1],[2,-1],[1,-3],[-1,-4],[-1,-3],[-5,-6],[-1,-3],[0,-2],[0,-4],[0,-5],[1,-6],[1,-3],[17,-9],[15,3],[7,4],[6,5],[16,22],[3,4],[1,3],[0,2],[-1,3],[0,5],[2,5],[2,8],[2,6],[-1,5],[-5,9],[-2,6],[0,6],[2,4],[6,9],[1,5],[0,7],[-2,20],[-1,6],[-3,5],[-8,10],[-4,5],[-1,6],[0,4],[0,1],[1,0],[2,2],[7,3],[3,0],[5,1],[2,1],[1,0],[3,2],[5,8],[3,2],[3,1],[4,0],[2,-2],[3,-2],[13,-16],[56,-27],[8,-4],[5,-5],[6,-9],[4,-5],[4,-4],[7,-5],[6,-2],[6,-1],[6,0],[5,1],[13,4],[5,1],[4,-1],[3,-2],[33,-20],[15,-13],[14,-6]],[[1719,4650],[0,-13],[0,-5],[-2,-6],[-3,-5],[-1,-1],[-2,-1],[-2,0],[-5,4],[-2,3],[-2,2],[-3,1],[-3,0],[-3,-1],[-4,-3],[-2,-1],[-1,0],[-2,1],[-2,3],[-2,2],[-3,0],[-2,-1],[-6,-4],[-2,-1],[-2,-1],[-2,1],[-2,2],[-4,6],[-3,8],[-8,14]],[[1644,4654],[-1,4],[-1,14],[-1,2],[-1,3],[-2,2],[-3,2],[-6,4],[-2,2],[-2,2],[-1,2],[0,2],[0,2],[1,2],[1,2],[3,1],[2,-1],[6,-1],[3,0],[2,0],[1,1],[5,11],[2,2],[1,1],[2,1],[4,-2],[2,0],[2,0],[7,4],[11,9],[3,1],[2,1],[2,0],[2,-3],[-1,-5],[0,-3],[-1,-3],[1,-2],[3,-2],[3,0],[3,0],[3,1],[3,0],[2,-1],[0,-2],[-1,-4],[-1,-3],[-2,-2],[-22,-11],[-2,-2],[-1,-1],[-1,-2],[0,-2],[-1,-1],[1,-2],[2,-12],[2,-3],[2,-3],[4,-1],[7,0],[4,1],[2,2],[1,1],[0,5],[0,3],[2,2],[1,1],[2,0],[12,-1],[3,-3],[2,-2],[-1,-17]],[[3452,2092],[-23,5],[-10,5],[-16,13],[-11,7],[-5,1],[-4,0],[-5,-8],[-2,-2],[0,-1],[-1,-2],[-1,-2],[-5,-1],[-4,2],[-4,2],[-6,7],[-2,3],[-2,3],[-3,3],[-4,2],[-4,2],[-3,0],[-17,0],[-15,-6],[-4,-16],[-4,-7],[-6,-9],[-1,-4],[-1,-3],[1,-1],[1,-2],[2,-2],[0,-4],[-2,-1],[-2,-1],[-3,-2],[-15,-8],[-4,-2],[-4,0],[-3,0],[-6,2],[-4,0],[-3,-1],[-8,-3],[-8,-16],[-4,-15],[-2,-8],[1,-5],[2,-2],[2,-4],[0,-3],[-2,-7],[0,-1],[1,-1],[2,-1],[3,1],[3,1],[3,0],[1,-1],[2,-4],[0,-5],[-5,-21],[-2,-6],[-3,-4],[-6,-7],[-4,-6],[-11,-11],[-13,-7],[-4,-2],[-3,-3],[-2,-3],[0,-2],[0,-4],[4,-2],[1,-4],[0,-6],[1,-2],[3,-1],[60,-1],[11,-2],[9,-4],[1,-2],[3,-2],[10,-16],[1,-3],[0,-2],[0,-1],[-1,-4],[-1,-1],[0,-1],[-1,-2],[-2,-1],[-1,-1],[-2,-2],[-3,-4],[-4,-2],[-3,-7],[-12,-15],[-4,-9],[-3,-2],[-3,-2],[-3,-1],[-7,-2],[-36,-3],[-4,-2],[-6,-3],[-1,-4],[-6,-7],[-2,-4],[-7,-19],[-3,-6],[-5,-6],[-4,-1],[-9,0],[-9,-3],[-5,0],[-5,2],[-6,5],[-3,1],[-6,2],[-3,2],[-4,0],[-4,-2],[-5,-2],[-5,-1],[-16,0],[-10,-1],[-4,-1],[-3,-2],[-2,-2],[-1,-7],[-2,-5],[-4,0],[-5,2],[-19,20],[-5,3],[-5,1],[-3,-1],[-7,-3],[-5,-1],[-8,0],[-4,-2],[-4,-2],[-13,-19],[-8,-14],[-5,-22],[-1,-3],[-3,-3],[-18,5],[-5,1],[-50,-4],[-8,0],[-5,1],[-4,2],[-2,2],[-1,3],[0,3],[1,8],[-2,4],[-4,4],[-10,4],[-7,0],[-6,-2],[-5,-3],[-4,-3],[-3,-3],[-2,-2],[-1,-2],[-2,-3]],[[2297,2094],[0,7],[-1,4],[-3,3],[-3,3],[-3,3],[0,5],[9,-4],[2,-1],[3,2],[5,6],[3,2],[4,0],[5,2],[5,3],[3,4],[-16,-3],[-15,-4],[-11,1],[-16,66],[4,12],[-3,3],[-2,2],[-2,7],[0,8],[-1,4],[-2,2],[-2,4],[-3,17],[-2,15],[-6,23],[-3,6],[-4,7],[-2,5],[2,4],[-3,6],[-1,11],[-1,9],[4,-10],[1,-8],[5,-1],[-3,2],[1,8],[-1,7],[-8,22],[0,8],[-2,19],[1,6],[-2,1],[0,1],[0,1],[-1,1],[2,-1],[2,0],[1,3],[0,3],[2,0],[4,-2],[4,0],[5,2],[4,3],[-5,-1],[-3,1],[-4,7],[-4,4],[0,2],[4,1],[-4,6],[-4,-4],[-6,-14],[-4,11],[-9,29],[-2,21],[-7,12],[-4,12],[-11,14],[-5,9],[-11,14],[-3,7],[0,3],[0,7],[0,4],[-2,3],[-4,5],[-1,4],[-1,19],[-2,7],[-10,14],[-3,7],[1,8],[5,-4],[8,-1],[9,-1],[4,1],[-3,3],[-21,7],[-3,2],[-5,6],[-1,15],[-3,6],[-2,4],[-1,4],[0,9],[-1,3],[-1,2],[-2,2],[-3,13],[-7,13],[0,8],[5,-6],[3,-9],[4,-8],[7,0],[-4,4],[1,2],[10,-1],[-15,16],[-4,2],[0,2],[1,2],[1,1],[-4,2],[-1,0],[-2,-2],[-1,5],[0,2],[1,3],[-5,-3],[-1,-4],[1,-5],[-2,-5],[-5,-2],[-5,1],[-3,2],[1,4],[-3,10],[0,7],[4,5],[11,2],[0,2],[-5,2],[-4,-1],[-4,-2],[-5,-1],[-3,1],[-3,4],[0,4],[3,3],[-3,6],[-2,15],[-3,6],[-7,5],[-4,2],[-4,-2],[-5,-6],[-5,9],[-2,3],[-2,0],[-4,0],[-1,0],[-3,4],[0,1],[-12,5],[-5,5],[-2,6],[7,-3],[1,2],[0,5],[2,3],[3,2],[4,1],[4,-2],[3,-3],[3,7],[3,4],[4,2],[6,1],[4,0],[3,-1],[2,1],[1,4],[-2,1],[-3,1],[-4,2],[-1,4],[-3,-3],[-11,-5],[-2,-2],[-2,-3],[-5,-3],[-5,-3],[-5,0],[-3,4],[-4,11]],[[2035,2832],[12,6],[8,6],[2,2],[2,0],[8,-1],[5,1],[4,2],[6,3],[5,5],[1,1],[0,2],[1,4],[2,8],[2,4],[2,4],[0,3],[1,3],[0,3],[-3,12],[0,2],[0,3],[1,5],[1,3],[8,16],[1,4],[0,3],[0,3],[-1,2],[-2,1],[-1,2],[-11,5],[-1,2],[-1,3],[0,3],[0,2],[2,1],[1,0],[11,2],[2,2],[3,2],[2,2],[0,3],[-1,14],[-1,3],[-1,2],[-1,2],[-10,10],[-1,3],[-1,3],[0,3],[1,4],[0,2],[0,3],[-2,3],[-1,2],[-4,4],[-1,6],[3,5],[3,5],[1,6],[-1,5],[-3,19],[-2,10],[-2,2],[-2,3],[-10,5],[-7,3],[-2,0],[-2,0],[-4,-3],[-2,-2],[-3,0],[-4,-1],[-4,0],[-5,2]],[[2039,3094],[-1,5],[-2,3],[0,2],[1,1],[4,1],[2,2],[1,3],[3,8],[4,6],[17,12],[3,1],[3,1],[2,-1],[1,-1],[1,-3],[0,-2],[0,-4],[-1,-2],[0,-1],[1,-1],[1,0],[2,-1],[11,0],[9,2],[4,1],[3,2],[6,5],[4,3],[6,9],[7,13],[1,3],[-1,4],[-2,2],[-4,4],[0,2],[0,1],[10,13],[6,12],[5,7],[3,5],[2,5],[1,9],[0,5],[0,3],[-1,1],[-2,1],[-1,1],[-8,2],[-3,1],[-1,1],[-1,3],[2,2],[3,4],[3,2],[4,1],[14,1],[2,1],[2,3],[1,6],[-1,12],[2,14],[0,5],[-1,4],[-1,3],[-1,2],[-3,2],[-2,2],[-29,14],[-3,0],[-1,0],[-2,-1],[-3,-2],[-1,-1],[-2,-1],[-2,0],[-1,1],[-1,2],[0,3],[0,7],[0,1],[0,2],[-3,3],[-1,3],[-1,3],[-1,6],[1,3],[2,1],[3,2],[6,0],[3,1],[2,1],[1,1],[1,2],[-1,1],[-1,1],[-5,2],[-2,1],[-2,2],[-1,1],[-1,2],[-1,3],[0,2],[0,3],[-1,1],[-1,1],[-2,0],[-4,0],[-1,0],[-2,0],[-2,1],[-1,2],[-1,1],[0,1],[0,2],[-1,4],[-1,1],[0,1],[-2,0],[-1,0],[-3,-1],[-4,-3],[-1,-1],[-1,0],[-2,1],[0,1],[-1,1],[0,1],[5,9],[2,7],[1,2],[3,0],[3,-2],[2,-2],[2,-2],[3,0],[2,0],[2,2],[1,2],[2,7],[2,1],[1,1],[2,0],[2,-2],[2,-1],[1,-2],[2,-2],[2,-1],[2,1],[3,2],[5,7],[2,1],[2,1],[4,3],[2,1],[2,2],[1,2],[1,2],[3,12],[1,2],[2,1],[2,-1],[5,-1],[5,-3],[3,-1],[11,-1],[3,-1],[2,0],[0,-3],[1,-6],[1,-2],[3,-4],[2,-2],[0,-2],[0,-1],[0,-2],[0,-1],[0,-1],[1,-1],[1,0],[2,-1],[2,1],[3,1],[3,2],[11,10],[3,2],[3,1],[2,0],[6,1],[4,1],[1,3],[1,4],[-9,9],[5,4],[3,2],[1,2],[1,1],[4,11],[1,2],[2,0],[3,0],[3,1],[3,1],[2,2],[3,4],[1,1],[2,1],[5,1],[7,4],[3,2],[3,1],[3,1],[6,-1],[5,-2],[4,-1],[3,0],[2,2],[0,1],[1,2],[0,2],[-3,14],[-1,4],[-1,4],[-3,4],[0,1],[0,1],[1,1],[2,2],[16,4],[5,2],[3,2],[2,3],[2,2],[5,4],[1,2],[3,10],[1,2],[2,0],[10,-4],[15,3],[2,0],[2,-1],[1,-2],[1,-4],[2,-3],[3,-3],[6,-2],[2,-2],[1,-1],[2,-3],[4,-4],[5,-1],[4,-2],[3,-1],[4,0],[11,3],[15,8],[1,6],[-1,7],[0,3],[1,2],[4,2],[17,0],[7,2],[4,2],[8,4],[3,1],[19,0],[3,-1],[3,-1],[1,-3],[3,-2],[2,-1],[4,1],[13,4],[3,2],[3,3],[2,2],[3,6],[2,1],[2,0],[3,-2],[9,-8],[5,-3],[4,-1],[4,0],[2,3],[2,2],[1,3],[0,4],[0,3],[-1,3],[-5,8],[-1,1],[1,3],[2,2],[4,3],[2,2],[0,3],[-1,4],[-4,6],[-3,3],[-3,3],[-2,3],[-2,4],[0,8],[2,4],[1,4],[2,3],[1,3],[0,4],[0,4],[-2,5],[-1,4],[-3,3],[-6,3],[-1,1],[-2,3],[-1,7],[-2,6],[-5,11],[-1,8],[3,3],[5,3],[2,3],[3,3],[4,11],[2,3],[2,2],[3,2],[4,1],[4,-1],[5,-3],[3,-7],[3,-8],[10,-3],[8,1],[4,-1],[4,-4],[2,-3],[1,-4],[3,-2],[5,-1],[5,4],[6,7],[5,3],[5,-5],[8,5],[3,-1],[3,-6],[1,-6],[1,-5],[2,-4],[4,-2],[3,-2],[3,-3],[3,-2],[5,4],[4,2],[11,2],[5,1],[4,-2],[2,0],[4,1],[8,3],[11,7],[6,1],[5,0],[7,-3],[3,-1],[4,2],[6,3],[4,1],[5,1],[3,-1],[3,-2],[6,-5],[3,-2],[3,-1],[9,0],[5,-1],[9,-2],[4,1],[4,2],[7,5],[2,2],[-1,4],[-3,3],[-7,5],[-3,4],[-1,7],[-1,3],[-4,4],[-2,3],[0,5],[4,5],[3,2],[1,3],[0,2],[-3,4],[0,2],[2,4],[0,3],[0,3],[-2,3],[-5,6],[-2,2],[1,3],[3,3],[23,7],[7,6],[1,4],[1,2],[2,2],[3,2],[8,3],[3,2],[1,3],[0,2],[0,2],[0,3],[1,2],[3,2],[4,1],[3,1],[1,2],[3,6],[1,2],[3,2],[5,-1],[6,-3],[6,0],[4,1],[3,0],[3,-1],[6,-7],[3,-3],[4,-3],[8,-7],[5,-1],[4,17],[3,8],[3,5],[3,3],[7,3],[3,1],[3,3],[1,2],[1,3],[-1,5],[-4,9],[-1,8],[5,1],[2,0],[4,-1],[18,-5],[5,0],[4,2],[4,5],[5,10],[2,8],[0,6],[-1,10],[0,6],[1,3],[4,18],[1,5],[0,4],[-2,13],[3,5],[5,4],[12,4],[7,1],[9,-2],[3,0],[3,2],[4,2],[4,1],[4,0],[7,-1],[3,1],[3,2],[1,4],[1,3],[1,4],[3,4],[4,5],[20,15],[10,3],[3,1],[3,1],[2,3],[1,4],[0,8],[-2,10],[1,5],[1,4],[11,15],[6,2],[3,0],[4,0],[4,-1],[4,-3],[4,-4],[2,-4],[0,-3],[0,-16],[0,-3],[1,-4],[4,-2],[5,-2],[12,-4],[5,-2],[2,-2],[1,-7],[1,-3],[2,-2],[3,-1],[5,1],[5,4],[6,6],[3,1],[2,1],[14,-3]],[[4290,5080],[0,-17],[-4,-8],[-10,-10],[-4,-3],[-27,-13],[-22,-13],[-4,-4],[-2,-3],[-2,-4],[-1,-4],[-3,-22],[-4,-13],[-1,-4],[0,-5],[2,-7],[3,-7],[2,-3],[3,-2],[3,-3],[3,-1],[4,-1],[2,0],[2,1],[5,1],[3,1],[2,0],[3,-1],[2,-3],[1,-2],[1,-4],[1,-4],[0,-7],[0,-34],[6,-29],[-1,-5],[-2,-3],[-2,-2],[-15,-7],[-2,-2],[-2,-3],[-3,-5],[0,-3],[0,-3],[1,-2],[1,-1],[2,-1],[3,0],[3,0],[3,1],[5,3],[6,4],[2,1],[3,0],[2,0],[5,-1],[3,-1],[2,-1],[2,-2],[1,-2],[0,-2],[0,-2],[-1,-15],[0,-2],[1,-3],[2,-1],[2,-4],[-2,-4],[-2,-4],[-2,-6],[-1,-3],[-1,-22],[0,-5],[1,-5],[2,-3],[2,-7],[0,-3],[-2,-3],[-2,-1],[-7,-2],[-3,-2],[-4,-3],[-9,-9],[-5,-2],[-4,-2],[-4,-1],[-19,-2],[-5,-1],[-3,-2],[-2,-5],[-1,-4],[1,-4],[0,-5],[-4,-11],[0,-3],[2,-2],[2,-1],[28,-2],[3,0],[2,-1],[3,-1],[8,-22],[1,-8],[0,-5],[-1,-1],[-1,-3],[-2,-9],[-2,-18],[-1,-6],[-2,-3],[-2,-1],[-2,0],[-3,1],[-4,1],[-11,5],[-2,1],[-3,-1],[-2,-2],[-5,-7],[-2,-3],[0,-3],[1,-2],[1,-2],[2,-1],[3,0],[9,-2],[3,-1],[1,-2],[1,-4],[-1,-3],[-2,-2],[-1,-2],[-1,-1],[-3,-2],[-6,-3],[-6,-2],[-3,-2],[-3,-2],[-1,-3],[1,-2],[3,-2],[4,-2],[9,-2],[4,-1],[3,1],[2,0],[1,1],[1,1],[-1,2],[0,2],[0,1],[0,2],[1,2],[2,2],[2,2],[3,1],[3,1],[3,0],[3,-2],[3,-3],[1,-3],[3,-13],[3,-6],[3,-4],[4,-3],[5,-2],[13,-3],[4,-1],[3,-2],[3,-2],[3,-5],[3,-19],[2,-5],[3,-3],[4,-2],[17,-4],[5,-3],[10,-7],[3,-1],[3,0],[3,-1],[2,-1],[6,-6],[8,-7],[5,-7],[1,-6],[0,-6],[-2,-4],[-3,-4],[-4,-3],[-5,-2],[-10,-1],[-4,-1],[-3,-2],[-1,-3],[1,-3],[6,-8],[3,-6],[0,-4],[-3,-3],[-13,-5],[-8,-4],[-3,-3],[-5,-4],[-5,-5],[-1,-1],[-1,0],[-2,6],[-7,11],[-4,4],[-9,0],[-7,-2],[-5,1],[-6,8],[-5,14],[-3,3],[-8,-1],[-4,-3],[-5,-8],[-4,-4],[-3,-2],[-6,-2],[-3,-2],[-3,-4],[-5,-11],[-3,-4],[-4,-3],[-8,-3],[-3,-2],[-3,-6],[-8,-28],[-1,-5],[-1,-7],[-7,-13],[-19,-21],[-7,-14],[0,-11],[5,-10],[20,-24],[2,-7],[-4,-6],[-21,-13],[-4,-3],[-1,-4],[0,-4],[1,-4],[2,-7]],[[2039,3094],[-14,-1],[-20,-8],[-4,-1],[-4,1],[-5,1],[-7,5],[-4,4],[-3,5],[-4,18],[-1,4],[-3,3],[-3,2],[-5,1],[-6,1],[-3,1],[-2,1],[-1,2],[-1,3],[-1,5],[-1,2],[-2,0],[-3,-2],[-2,-2],[-5,-8],[-2,-2],[-3,-1],[-4,-1],[-17,-1],[-7,-4]],[[1902,3122],[-4,1],[-6,1],[-6,1],[-3,2],[-1,4],[1,15],[-2,9],[-12,22],[-6,8],[-20,16],[-6,6],[-7,9],[-1,8],[10,1],[0,2],[-6,0],[-5,1],[-4,3],[-2,5],[-1,1],[-2,0],[-3,2],[-1,4],[2,1],[2,2],[1,3],[0,20],[1,5],[2,3],[3,3],[3,4],[-8,-2],[-4,-5],[-2,-9],[0,-10],[-2,17],[0,14],[-2,5],[-2,1],[-1,-2],[-2,1],[-2,3],[-2,2],[-1,7],[-9,28],[-1,2],[1,7],[-1,1],[-6,2],[0,5],[2,3],[3,2],[4,2],[-6,3],[-6,3],[-3,5],[-3,12],[-5,15],[-2,3],[-2,1],[-1,4],[0,8],[1,3],[3,-2],[2,-4],[1,-1],[7,-7],[4,-2],[8,0],[-4,1],[-2,1],[-2,2],[-2,3],[1,2],[4,3],[2,2],[-6,0],[-6,2],[-5,4],[-1,5],[-1,3],[3,3],[1,0],[11,5],[0,-6],[1,-3],[2,1],[1,4],[-2,6],[-4,2],[-5,-1],[-5,-3],[-4,8],[-1,2],[1,3],[3,4],[1,3],[-1,4],[-2,3],[-5,5],[-4,9],[2,10],[3,9],[0,6],[-2,-2],[-4,5],[-4,10],[-2,9],[4,4],[-1,2],[-3,13],[1,5],[1,5],[5,9],[-9,4],[-3,4],[3,4],[-4,5],[0,3],[3,1],[3,-5],[3,8],[-1,9],[-2,8],[-5,7],[3,4],[-1,6],[-2,5],[-6,12],[0,7],[-6,12],[-1,5],[-2,2],[-6,7],[-2,4],[6,-3],[4,-4],[5,-2],[6,2],[-5,6],[-9,17],[-4,6],[-9,7],[-1,4],[0,4],[4,5],[2,5],[-4,6],[3,7],[-5,9],[-12,12],[-2,6],[1,3],[3,1],[4,0],[5,0],[13,6],[-5,3],[-11,1],[-5,1],[-4,4],[-2,5],[-1,6],[2,4],[-2,3],[-3,4],[-2,5],[1,4],[3,4],[2,4],[0,4],[-3,5],[-1,3],[-2,10],[-1,3],[-6,6],[-2,4],[-2,12],[-3,7],[-16,25],[0,8],[6,6],[-6,1],[-3,2],[-1,5],[1,4],[4,4],[4,2],[3,2],[1,7],[-4,-2],[-3,-2],[-3,-3],[-2,-3],[-3,4],[-4,5],[-3,5],[1,1],[1,2],[1,3],[-1,2],[-2,3],[-1,2],[-3,27],[-4,8],[-10,2],[3,7],[1,3],[-1,2],[-1,3],[1,3],[1,4],[5,-2],[1,-2],[1,-3],[2,-4],[3,-4],[1,0],[2,0],[4,0],[6,0],[7,-2],[6,-4],[5,-6],[-6,-3],[0,-4],[4,-1],[4,6],[1,7],[-3,12],[2,5],[-5,3],[-4,0],[-11,-1],[-6,2],[-6,4],[-3,5],[2,6],[-5,0],[-3,2],[-6,8],[-2,1],[-2,-1],[-1,0],[-2,2],[-1,2],[0,2],[1,1],[0,3],[-1,5],[-2,3],[-2,3],[-2,5],[-1,4],[1,13],[1,8],[4,7],[6,5],[8,-2],[5,-5],[10,-16],[6,-7],[2,7],[-4,3],[-5,4],[-3,6],[-1,6],[-2,5],[-4,5],[-3,2],[-10,-2],[-4,2],[-1,6],[-8,20],[-6,5],[-4,11],[-1,14],[0,17],[2,6],[3,4],[5,3],[2,0],[5,-3],[4,0],[5,10],[4,-4],[12,-13],[-3,-6],[2,-5],[3,-4],[5,-2],[-2,8],[1,9],[4,8],[5,4],[-10,4],[-2,3],[-3,5],[1,2],[1,3],[1,3],[-2,2],[-2,-1],[-1,0],[-2,-2],[0,-1],[-5,-2],[-11,4],[-6,8],[5,10],[5,-4],[3,3],[0,10],[5,1],[4,-1],[5,0],[4,6],[-12,0],[0,2],[5,0],[8,4],[17,5],[2,-1],[3,7],[-5,1],[-10,-3],[-8,-3],[-2,4],[2,9],[-3,3],[4,7],[-2,3],[-4,1],[-2,5],[2,25],[-2,0],[-6,-12],[-5,-5],[-1,-12],[-2,-5],[6,-4],[-4,-7],[-14,-15],[0,3],[-2,9],[-6,-5],[-6,-8],[-5,-10],[-3,-14],[-2,-6],[-3,-2],[-4,5],[0,3],[1,4],[1,4],[-2,5],[-2,0],[-1,-2],[-1,-2],[-5,-3],[-2,4],[2,4],[7,9],[2,5],[1,4],[-1,10],[4,-2],[1,-1],[2,4],[1,4],[-1,3],[-4,1],[4,11],[0,4],[0,3],[-3,7],[-1,3],[1,2],[3,4],[0,2],[-1,2],[-3,0],[-2,-1],[-2,-5],[-2,-3],[-3,0],[-1,4],[1,3],[6,15],[6,10],[4,4],[-5,0],[-5,-5],[-4,-7],[-5,-5],[-1,21],[1,12],[4,5],[18,2],[9,-1],[7,-7],[5,-2],[10,-1],[6,1],[4,2],[5,-1],[5,-5],[8,-19],[5,-7],[8,5],[-7,3],[0,6],[0,5],[-3,3],[-3,2],[-3,5],[-5,5],[-6,2],[-19,-1],[-6,1],[-5,3],[-10,8],[-6,3],[-6,-6],[-6,0],[-5,5],[-8,12],[-1,3],[-4,20],[-1,8],[3,5],[5,3],[38,14],[-8,3],[-7,-1],[-7,-3],[-7,-1],[-3,1],[-2,3],[-1,3],[-1,4],[-1,3],[-4,2],[-6,3],[-3,0],[1,-4],[1,-3],[0,-3],[-2,-2],[5,-4],[2,-3],[0,-2],[-2,-3],[-2,1],[-7,8],[-4,17],[2,7],[-2,15],[-8,26],[2,-2],[2,-2],[2,-2],[1,-3],[6,2],[0,4],[-2,4],[-2,6],[1,2],[3,1],[2,0],[1,3],[0,3],[0,3],[-2,5],[-13,-15],[-4,-1],[-1,6],[1,12],[-2,5],[-8,10],[0,3],[3,5],[2,6],[1,12],[-1,9],[0,3],[4,2],[3,2],[3,6],[3,6],[2,5],[0,21]],[[1562,4635],[8,1],[7,4],[2,2],[5,2],[2,1],[2,0],[8,-3],[1,0],[2,2],[2,1],[3,1],[9,-1],[5,0],[9,2],[17,7]],[[1719,4650],[9,-2],[3,1],[5,2],[5,3],[2,2],[2,2],[1,3],[0,2],[0,3],[0,2],[1,3],[2,4],[3,1],[3,1],[23,-3],[5,-2],[3,0],[5,1],[2,2],[0,2],[-1,6],[-1,3],[1,3],[3,6],[1,4],[1,5],[-2,17],[-1,5],[0,2],[-1,3],[-1,2],[-1,1],[-3,1],[-2,1],[-1,2],[2,5],[9,12],[17,27],[4,9],[2,6],[-3,12],[-1,2],[0,2],[-1,1],[-2,0],[-4,1],[-2,0],[-1,1],[-1,1],[-1,2],[-1,8],[-1,2],[-1,1],[-2,1],[-3,0],[-3,0],[-3,1],[-2,1],[0,2],[0,2],[2,2],[11,4],[5,5],[4,9],[2,2],[1,1],[3,0],[2,-1],[2,-2],[2,-3],[4,-8],[2,-2],[2,-1],[3,-1],[2,-1],[12,-9],[11,-5],[6,-3],[4,-4],[8,-12],[3,-2],[2,-1],[4,-1],[17,1],[5,2],[8,5],[9,4],[6,2],[4,3],[3,3],[2,4],[1,4],[1,4],[-1,7],[1,2],[9,10],[17,12],[4,4],[2,4],[1,5],[1,5],[0,5],[-3,27],[-3,8],[-3,7],[-4,13],[-2,4],[-3,2],[-4,3],[-5,5],[-6,7],[-6,9],[-3,3],[-5,1],[-11,4],[-4,5],[-2,3],[-4,6],[-3,2],[-3,1],[-4,1],[-3,-1],[-4,-1],[-4,0],[-6,0],[-13,7],[-12,12],[-3,4],[0,2],[0,2],[2,1],[3,-1],[3,-1],[19,-10],[3,0],[2,1],[3,1],[3,1],[3,-1],[3,-1],[2,-1],[2,0],[1,0],[1,0],[6,5],[3,2],[3,2],[4,1],[4,1],[3,2],[4,5],[5,17],[3,5],[3,2],[2,-1],[6,-5],[3,-1],[4,1],[19,6],[3,2],[4,6],[6,23],[5,7],[4,4],[6,3],[6,4],[8,9],[4,3],[4,2],[3,-1],[8,-4],[4,-1],[3,1],[46,12],[8,3],[5,3],[4,3],[2,3],[1,2],[0,3],[0,3],[-1,3],[-2,5],[-1,1],[-1,1],[-2,0],[-2,0],[-3,-1],[-6,-4],[-3,-1],[-3,-1],[-13,-3],[-3,1],[-3,2],[-2,2],[-3,3],[-2,0],[-3,1],[-3,0],[-2,-1],[-1,-1],[-1,-2],[-2,-1],[-4,-1],[-24,2],[-6,0],[-8,-1],[-14,-4],[-11,-5],[-23,-3],[-10,-4],[-2,-1],[-2,2],[-1,2],[-4,8],[-3,4],[-10,11],[-2,4],[-2,5],[1,3],[3,2],[10,1],[6,2],[7,6],[3,11],[-1,5],[-3,4],[-4,2],[-3,4],[-1,5],[1,5],[-1,4],[-2,10],[-1,4],[1,3],[4,8],[5,1],[3,1],[13,4],[10,5],[6,-1],[9,3],[7,4],[4,5],[29,14],[23,4]],[[2048,5289],[8,-2],[11,-6],[7,-2],[8,1],[7,1],[7,2],[6,3],[1,2],[0,2],[0,2],[0,2],[2,0],[4,1],[5,2],[7,2],[4,2],[13,12],[6,0],[7,-5],[19,-21],[3,-10],[0,-5],[-2,-29],[0,-5],[1,-4],[4,-8],[2,-3],[0,-9],[2,-4],[3,-3],[4,-3],[9,-6],[11,-8],[5,-3],[18,-5],[4,-3],[4,-4],[4,-3],[5,-2],[7,-1],[12,0],[30,3],[4,0],[10,-2],[3,-1],[4,-1],[5,-5],[4,-3],[5,-1],[17,-1],[2,-1],[9,-4],[4,-3],[7,-6],[13,-18],[3,-9],[2,-3],[3,-4],[3,-3],[5,-2],[19,-7],[35,-8],[12,1],[5,0],[2,-1],[5,-2],[34,0],[14,-1],[4,0],[12,3],[8,0],[6,1],[5,1],[13,-2],[15,-1],[37,2],[22,6],[10,-3],[10,0],[5,0],[12,-5],[18,-4],[3,0],[4,0],[4,1],[4,0],[4,-4],[5,-9],[7,-18],[1,-15],[4,-15],[-2,-4],[-2,-2],[-4,0],[-2,0],[-2,-1],[-1,0],[-1,-2],[0,-1],[0,-2],[2,-2],[12,-16],[8,-5],[7,-3],[34,-3],[10,2],[21,2],[11,3],[9,4],[4,5],[7,10],[5,6],[5,4],[9,4],[6,2],[25,2],[4,2],[3,4],[3,5],[3,6],[0,15],[-5,9],[-1,4],[-1,3],[2,3],[3,3],[8,6],[13,7],[4,3],[3,3],[7,14],[2,3],[5,4],[3,3],[2,4],[0,2],[0,1],[0,1],[0,1],[1,8],[0,3],[1,4],[1,9],[7,8],[10,5],[20,0],[6,2],[38,26],[14,6],[15,4],[18,2],[4,-1],[3,-1],[1,-2],[1,-1],[2,-2],[2,-2],[2,-1],[3,0],[3,2],[3,1],[2,3],[3,5],[2,1],[10,2],[3,3],[3,4],[4,3],[6,2],[43,-2],[5,-1],[5,-2],[2,-2],[1,-3],[1,-2],[0,-1],[1,-2],[2,-1],[8,-2],[3,-2],[2,-3],[2,-4],[3,-25],[0,-5],[0,-5],[0,-4],[2,-4],[2,-3],[1,-3],[0,-3],[-3,-1],[-4,-1],[-34,2],[-4,0],[-3,-2],[-1,-3],[-1,-4],[0,-3],[1,-4],[0,-1],[7,-13],[10,-13],[1,-4],[1,-4],[1,-3],[1,0],[2,2],[3,5],[2,1],[2,1],[4,-1],[2,-1],[3,-2],[2,-3],[3,-3],[2,-1],[4,-1],[4,1],[3,1],[6,3],[3,1],[4,-1],[4,-1],[9,0],[3,-1],[2,-2],[2,-2],[2,-1],[4,1],[10,7],[7,2],[8,6],[3,0],[3,0],[17,-7],[6,-2],[7,0],[6,1],[41,13],[19,8],[14,8],[6,5],[8,8],[4,6],[5,4],[5,3],[19,4],[16,6],[8,9],[3,2],[2,1],[4,1],[2,0],[8,0],[2,-1],[4,-2],[2,-4],[1,-9],[2,-6],[2,-4],[1,-8],[0,-4],[-1,-1],[0,-1],[0,-1],[2,0],[2,0],[3,0],[3,1],[4,2],[2,2],[4,2],[4,0],[6,0],[4,-2],[3,-2],[7,-6],[2,-1],[22,-6],[24,-1],[7,0],[8,3],[21,2],[13,4],[9,2],[13,1],[5,1],[4,4],[1,4],[0,3],[-2,3],[-1,4],[0,3],[3,3],[6,3],[16,4],[29,4],[12,3],[17,6],[10,3],[7,2],[4,4],[2,6],[1,4],[0,3],[1,2],[0,1],[7,1],[12,-6],[5,-1],[8,-1],[13,0],[5,-1],[5,1],[5,0],[4,-1],[15,-6],[6,-3],[4,-8],[12,-7],[1,-7],[1,-3],[1,-2],[1,-2],[1,-3],[1,-7],[1,-3],[4,-1],[4,0],[8,3],[4,3],[7,5],[6,4],[3,1],[4,1],[11,-1],[19,3],[8,0],[5,-2],[6,-3],[3,-3],[2,-5],[2,-4],[2,-4],[3,-1],[4,-1],[7,1],[5,1],[6,2],[3,1],[4,4],[4,1],[7,2],[4,0],[0,-1],[0,-1],[1,-2],[1,-1],[2,0],[5,0],[26,8],[3,7],[7,5],[19,6],[3,2],[3,2],[1,2],[6,-5],[15,-10],[10,-4],[12,-2],[2,-1],[1,-3],[0,-2],[0,-4],[1,-3],[5,-6],[17,-11],[5,-4],[3,-4],[1,-3],[1,-5],[0,-2],[0,-1],[-1,-2],[-6,-6],[-1,-3],[1,-2],[2,-2],[3,-1],[3,0],[3,1],[10,2],[2,1],[4,0],[3,-1],[6,-2],[38,-22],[5,-2],[2,0],[2,1],[2,1],[6,5],[6,2]],[[8799,163],[3,-5],[2,-7],[2,-6],[2,-6],[0,-14],[2,-5],[5,-10],[4,-9],[2,-4],[3,-4],[0,-19],[-3,-9],[-9,-19],[-1,-13],[1,-2],[2,-3],[2,-2],[-1,-4],[-1,-2],[-3,-1],[-4,0],[-2,2],[-5,-1],[-4,-6],[-4,-14],[-8,3],[-1,5],[1,7],[1,7],[-3,3],[-5,3],[-2,4],[3,4],[-4,3],[-2,3],[-1,4],[2,4],[-3,2],[-2,2],[0,4],[0,4],[-6,0],[-3,7],[-3,9],[-4,8],[-5,5],[-7,5],[-6,2],[-6,-5],[1,37],[1,4],[8,18],[3,1],[7,0],[4,1],[2,2],[2,3],[2,1],[1,1],[9,4],[2,-3],[9,8],[6,3],[6,-2],[8,-8]],[[8727,178],[-6,-1],[-3,2],[-1,2],[0,4],[0,3],[-2,3],[-6,7],[5,4],[1,7],[2,7],[8,3],[10,3],[3,5],[2,8],[5,8],[0,-9],[1,-7],[3,-3],[4,-3],[3,-4],[2,-6],[-2,-5],[-5,-4],[-6,-4],[-6,-6],[-12,-14]],[[8654,420],[10,-15],[0,-4],[-1,-6],[-1,-4],[-3,1],[-3,4],[-6,3],[-2,0],[-4,-1],[-5,-1],[-3,-2],[-4,-1],[-5,2],[-3,3],[-1,3],[0,4],[2,4],[-2,3],[-3,-3],[-3,0],[-3,2],[-3,3],[0,4],[2,14],[4,4],[7,4],[9,1],[7,0],[1,-3],[1,-4],[0,-7],[1,-3],[8,-3],[2,-1],[1,-1]],[[8700,436],[1,-4],[2,-7],[0,-15],[-19,14],[-3,5],[0,6],[3,3],[7,-2],[0,6],[3,1],[3,-2],[3,-5]],[[8686,469],[4,-13],[0,-3],[-2,-5],[-1,0],[-5,-2],[-1,-1],[0,-2],[-5,-8],[-4,-2],[-2,4],[0,10],[1,3],[2,2],[3,1],[1,5],[2,0],[3,-2],[1,2],[-2,4],[-4,3],[-2,-7],[-5,0],[-4,4],[-3,6],[-4,22],[0,4],[3,1],[3,5],[3,5],[2,4],[2,4],[7,2],[6,0],[3,-5],[0,-6],[-3,-5],[-4,-5],[-2,-7],[1,-6],[6,-12]],[[8592,522],[0,-10],[-5,5],[-2,0],[-2,2],[0,2],[-1,3],[4,3],[3,1],[1,-2],[1,-2],[1,-2]],[[8567,510],[-4,-3],[-4,1],[-10,2],[-8,3],[-7,8],[-5,9],[-2,8],[0,10],[1,5],[2,4],[5,3],[4,0],[2,-3],[0,-17],[1,-8],[3,-7],[7,-5],[9,-4],[4,-3],[2,-3]],[[8533,593],[0,-8],[-5,4],[-1,6],[6,-2]],[[8715,589],[-3,0],[0,4],[2,14],[0,6],[-4,12],[0,5],[4,4],[0,-7],[5,-10],[2,-5],[0,-6],[-1,-5],[-2,-7],[-3,-5]],[[8449,835],[-11,-13],[-24,8],[-4,5],[-2,10],[-2,9],[2,4],[6,2],[5,4],[3,5],[-1,6],[4,1],[3,-2],[8,-6],[6,-4],[7,-10],[0,-19]],[[8363,1407],[1,-7],[1,-12],[4,-9],[-1,-11],[-7,-8],[-5,-5],[-3,-2],[-4,-5],[0,-10],[5,-1],[6,-3],[-9,-12],[-4,-8],[-7,-5],[-12,2],[-5,6],[-7,4],[-8,1],[-5,-6],[-8,0],[-2,4],[9,12],[4,11],[1,8],[-3,6],[-6,5],[-4,4],[0,16],[0,11],[-1,8],[0,4],[3,-1],[7,3],[3,3],[3,8],[2,10],[18,12],[16,3],[7,-7],[5,-9],[1,-12],[5,-8]],[[8385,1605],[-4,-1],[-5,1],[-3,2],[-2,2],[-4,2],[2,8],[1,2],[2,2],[5,0],[3,1],[2,5],[-1,6],[-2,11],[2,10],[7,0],[7,-6],[5,-8],[2,-4],[-2,-4],[-3,-5],[-2,-6],[3,-4],[4,-3],[1,-3],[-5,-4],[-4,-2],[-9,-2]],[[8257,1664],[-7,0],[-6,4],[-1,12],[-5,5],[0,3],[4,0],[9,-2],[4,-1],[4,-2],[3,-7],[0,-7],[-5,-5]],[[8352,1673],[-3,-1],[-1,0],[1,10],[0,4],[1,3],[2,0],[1,-1],[1,-2],[3,-1],[4,-2],[0,-1],[-1,-4],[-5,-4],[-3,-1]],[[8529,1792],[-6,-1],[-5,6],[-3,7],[0,3],[-4,2],[-4,1],[-4,2],[-4,3],[-2,3],[-2,2],[-5,1],[-2,3],[4,6],[5,7],[3,3],[11,0],[4,-2],[-2,-5],[7,-16],[1,-3],[2,-3],[6,-19]],[[8526,1850],[-2,-6],[-3,2],[-9,10],[-2,16],[1,6],[3,4],[3,2],[1,0],[0,-3],[-1,-3],[-1,-1],[-1,0],[3,-4],[1,-4],[1,-5],[5,-10],[1,-4]],[[8542,1863],[-4,-4],[-3,2],[-3,5],[-4,6],[-1,4],[0,5],[0,6],[2,6],[2,4],[3,2],[3,0],[3,-2],[2,-3],[0,-1],[0,-1],[0,-2],[-3,-7],[0,-3],[2,-11],[1,-6]],[[8805,1921],[-7,-3],[0,4],[3,3],[4,-4]],[[8402,2107],[-4,-2],[-5,24],[1,4],[2,4],[2,19],[0,6],[4,4],[2,3],[2,2],[3,0],[2,-1],[2,-1],[1,-2],[1,-1],[1,-4],[-1,-6],[-1,-17],[-2,-8],[-2,-4],[-6,-6],[-1,-2],[-1,-5],[0,-4],[0,-3]],[[8510,2172],[1,-2],[-4,-4],[-2,-2],[-1,-4],[1,-3],[-2,-4],[-1,-4],[-1,2],[-1,1],[-1,1],[-3,1],[-2,-1],[0,1],[3,2],[2,0],[0,1],[-1,1],[-1,0],[-3,5],[3,-1],[-1,2],[-2,1],[-1,2],[4,3],[2,-2],[0,-2],[2,-2],[2,2],[1,2],[1,4],[2,-1],[3,1]],[[8412,2199],[-2,-3],[-3,4],[-4,4],[0,5],[3,2],[3,-1],[1,-1],[5,-2],[-2,-4],[-1,-4]],[[8948,2322],[-6,-1],[-4,4],[7,5],[3,-8]],[[8512,2373],[2,-1],[3,1],[4,1],[2,-2],[6,-10],[-4,-12],[0,-11],[2,-22],[1,0],[4,1],[2,1],[-1,-6],[-7,-5],[-2,-4],[-2,-4],[-4,-4],[-6,-2],[-4,-4],[-1,7],[-2,3],[-4,-1],[-3,-4],[1,-5],[4,-4],[5,-2],[7,1],[3,-3],[6,-8],[8,-5],[1,-3],[-7,-13],[-2,-9],[0,-22],[-1,-11],[-4,-14],[-6,-10],[-7,3],[-3,0],[-1,-3],[-3,-1],[-3,0],[-2,2],[-1,4],[2,8],[-1,5],[-3,0],[0,-7],[-6,1],[-3,-6],[0,-8],[1,-5],[6,-7],[2,-4],[-1,-4],[-3,-6],[-3,0],[0,7],[-3,3],[-3,0],[-4,0],[-1,-3],[-8,-15],[0,-3],[-1,-2],[0,-2],[3,-2],[4,-2],[3,3],[3,4],[3,-2],[2,-3],[0,-3],[1,-1],[3,-1],[8,-9],[-1,-6],[2,-7],[0,-8],[-4,-7],[6,-7],[4,-6],[2,-8],[0,-8],[-5,-16],[-1,-9],[5,-13],[1,-8],[0,-17],[-3,-5],[-6,-5],[-3,-4],[5,-4],[-3,-4],[-4,-3],[-4,-3],[-1,-6],[-2,0],[-2,3],[-3,4],[-3,3],[-4,2],[1,-2],[2,-6],[-10,-1],[-9,1],[0,-2],[2,-4],[4,-10],[2,-3],[4,-1],[4,-3],[3,-3],[0,-5],[4,-2],[-1,-1],[-3,-2],[-3,-2],[-3,-3],[-1,0],[-1,-1],[0,-3],[2,-3],[3,-2],[2,-2],[1,-5],[-2,-3],[-4,-2],[-2,-4],[2,-4],[1,-2],[1,-4],[1,-3],[-1,-2],[-6,1],[0,-7],[-3,-4],[-8,-5],[-5,-6],[2,-5],[0,-2],[-2,-1],[-7,-4],[1,-3],[-3,-2],[-6,-2],[-5,0],[-4,-3],[4,-5],[8,-9],[-4,1],[-3,-1],[-3,-2],[-1,-3],[2,0],[-7,-9],[-2,-4],[-1,-8],[0,-29],[3,0],[1,12],[2,7],[3,3],[5,-1],[4,-1],[2,-5],[2,-8],[-1,-11],[-13,-55],[-2,-2],[-7,-1],[-4,-2],[-11,-12],[-2,-3],[0,-5],[0,-7],[1,-2],[3,0],[4,1],[1,3],[0,13],[2,-1],[4,-1],[1,0],[0,6],[2,4],[3,0],[5,-3],[1,-4],[1,-11],[0,-4],[-2,-3],[-4,-4],[-1,-4],[0,-11],[-3,-11],[-3,-6],[-4,-4],[-1,4],[-2,1],[-3,1],[-3,1],[-11,11],[-1,3],[0,4],[0,2],[-3,1],[-4,2],[-3,5],[-1,5],[0,3],[2,2],[3,1],[3,1],[1,3],[-2,2],[-4,1],[-4,1],[-2,4],[0,4],[-2,7],[0,4],[-1,5],[-3,0],[-3,-1],[-3,-1],[-5,4],[-1,6],[2,15],[0,14],[-1,3],[-3,1],[-3,1],[-4,2],[-1,0],[-1,0],[-1,2],[0,2],[0,1],[2,1],[0,1],[3,10],[8,12],[2,1],[2,-2],[6,-7],[1,-3],[1,-1],[5,1],[-2,-5],[1,-5],[2,-1],[2,3],[1,19],[1,5],[0,5],[-2,6],[0,4],[1,6],[4,7],[2,4],[-1,35],[2,7],[8,15],[4,7],[3,-4],[3,0],[2,6],[3,2],[3,-2],[1,-7],[-2,-7],[0,-3],[3,-1],[2,0],[1,1],[0,1],[2,0],[6,0],[2,0],[6,3],[2,2],[1,5],[-3,14],[-3,1],[-2,1],[-3,2],[0,2],[0,4],[2,-1],[5,2],[3,0],[2,1],[-1,5],[-2,3],[-3,1],[-8,0],[-7,3],[-4,7],[-1,9],[1,82],[2,5],[6,7],[2,4],[1,1],[2,1],[5,0],[2,0],[1,5],[-2,1],[-4,1],[-4,2],[-2,5],[-1,25],[-3,15],[2,5],[2,2],[3,3],[3,3],[7,-1],[5,6],[3,9],[1,8],[0,18],[5,9],[3,6],[-2,3],[-8,3],[1,9],[7,20],[6,12],[2,2],[0,1],[-1,2],[-4,5],[-2,3],[4,4],[-1,8],[0,6],[8,3],[0,3],[-5,16],[1,5],[0,2],[-4,5],[2,7],[13,17],[2,3],[1,4],[0,3],[0,9],[0,2],[3,5],[4,3],[8,9],[2,2],[1,4],[0,6],[1,3],[3,2],[6,1],[3,1],[2,-2],[2,-2],[2,1],[3,1],[-2,2],[0,2],[0,2],[2,3],[2,-3]],[[8521,2406],[3,-8],[-11,3],[-7,3],[-3,3],[10,5],[5,0],[2,-5],[1,-1]],[[9251,7056],[-4,-3],[-2,-5],[-2,-2],[-1,-1],[0,-1],[-1,0],[-40,-23],[-4,-2],[-7,-1],[-6,0],[-5,1],[-4,2],[-8,5],[-2,1],[-3,0],[-2,-1],[-3,-3],[-10,-8],[-4,-5],[-10,-15],[-11,-15],[-12,-9],[-25,-17],[-8,-3],[-28,-11],[-10,0],[-3,1],[-3,-2],[-3,-3],[-3,-3],[-4,-1],[-5,0],[-3,0],[-3,-2],[-3,-3],[-3,-5],[-11,-11],[-2,-4],[0,-4],[0,-3],[-1,-6],[-8,-12],[-3,-3],[-6,-4],[-4,-5],[-4,-3],[-6,-3],[-4,0],[-3,1],[-2,3],[-1,2],[0,1],[-3,10],[0,4],[-7,4],[-8,-10],[-14,-14],[-4,-7],[-2,-6],[-2,-18],[-2,-8],[-2,-4],[-4,-3],[-9,-6],[-10,-11],[-33,-41],[-2,-4],[0,-3],[2,-8],[1,-4],[-3,-19],[-1,-3],[-2,-2],[-3,-3],[-4,-4],[-1,-5],[0,-10],[0,-2],[1,-3],[1,-2],[2,-4],[3,-7],[-1,-3],[-2,-2],[-2,-3],[-9,-13],[-5,-4],[-10,-6],[-7,-2],[-17,-2],[-10,-4],[-6,-1],[-3,0],[-2,1],[0,2],[0,2],[2,3],[5,6],[3,3],[2,4],[0,4],[0,5],[0,5],[-2,4],[-2,3],[-4,1],[-6,2],[-3,0],[-2,-1],[-2,-1],[-8,-4],[-9,-4],[-4,-2],[-3,-2],[0,-3],[1,-3],[2,-3],[6,-5],[1,-2],[1,-2],[-1,-2],[-3,-3],[-34,-26],[-6,-6],[-19,-25],[-16,-13],[-20,-13],[-14,-12],[-11,-9],[-3,-2],[-1,-4],[2,-3],[5,-5],[2,-3],[1,-2],[0,-1],[1,-1],[1,-1],[3,-1],[2,-3],[2,-4],[2,-3],[3,-2],[4,-2],[4,-2],[3,-4],[2,-4],[2,-6],[2,-3],[1,-5],[0,-6],[-1,-9],[0,-5],[-2,-7]],[[8660,6454],[-9,-9],[-4,-5],[-6,-9],[-10,-20],[-6,-19],[-3,-4],[-3,-5],[-3,-4],[-2,-4],[-1,-3],[-3,-2],[-5,-1],[-3,-1],[-2,-1],[-2,-2],[-2,-4],[-1,-2],[0,-7],[6,-10],[0,-2],[-1,-3],[-3,-3],[-3,-1],[-2,-1],[-1,0],[-2,-1],[-1,-1],[0,-2],[3,-3],[1,-1],[1,-5],[-9,-12],[-7,-11],[-1,-6],[0,-2],[-2,-3],[-3,-2],[-3,0],[-2,0],[-2,1],[-4,3],[-1,1],[-1,0],[-1,0],[-3,-1],[-1,-1],[-3,-2],[-1,-1],[-3,-5],[-2,-6],[-2,-13],[-2,-5],[-2,-4],[-1,-1],[-1,-2],[0,-6],[1,-3],[3,-1],[3,-2],[-3,-6],[-6,-11],[5,-11],[2,-5],[-4,-3],[-6,-1],[-3,-3],[-4,-12],[-2,-27],[-3,-11],[-9,0],[3,-5]],[[8513,6140],[-10,-7],[-5,0],[-11,2],[-5,2],[-23,-9],[-4,0],[-4,1],[-3,3],[-16,30],[-2,2],[-4,4],[-3,1],[-2,-1],[-2,-3],[-10,-27],[-2,-6],[-1,-2],[-2,-3],[-7,-7],[-17,-16],[-3,-5],[0,-6],[1,-3],[0,-3],[0,-3],[-3,-1],[-2,-1],[-4,-1],[-4,-3],[-10,-10],[-11,-9],[-5,-6],[-3,-3],[-5,-3],[-3,-1],[-3,-1],[-2,1],[-4,1],[-3,2],[-3,3],[-1,2],[-3,6],[-3,9],[0,2],[1,2],[2,4],[1,2],[1,2],[0,1],[-1,1],[-1,1],[-3,0],[-16,1],[-24,-1]],[[8266,6084],[-23,3],[-2,3],[-2,3],[12,25],[1,5],[1,6],[0,6],[-1,4],[-6,11],[-1,3],[-1,4],[0,11],[-1,3],[-1,2],[-2,2],[-22,13],[-3,2]],[[8215,6190],[1,0],[4,5],[2,6],[1,12],[4,13],[17,45],[1,6],[0,5],[-1,6],[-4,11],[-2,6],[2,6],[10,4],[13,-4],[24,-13],[0,-3],[1,-1],[0,-1],[3,-1],[3,0],[21,6],[12,3],[5,7],[1,4],[-1,6],[-2,6],[-4,3],[-8,3],[3,3],[-2,1],[-3,2],[-11,7],[0,1],[-6,2],[-3,1],[0,3]],[[8296,6350],[8,8],[15,15],[12,8],[8,7],[4,3],[4,1],[4,0],[4,1],[1,2],[-1,3],[1,3],[1,1],[8,-1],[5,0],[13,2],[3,0],[11,11],[43,14],[2,2],[-1,2],[-4,4],[-1,3],[-1,2],[0,2],[-2,2],[0,2],[0,3],[2,5],[2,3],[0,5],[-1,3],[-2,4],[-2,3],[-6,4],[-4,2],[-4,6],[-14,12],[-4,2],[-2,1],[-5,1],[-11,3],[-2,2],[-2,2],[-2,4],[-2,2],[-9,4],[-1,2],[0,1],[1,1],[8,5],[6,5],[3,3],[2,3],[3,6],[2,2],[3,2],[2,2],[2,3],[2,3],[-1,4],[-1,1],[-3,1],[-2,0],[-3,-1],[-4,-2],[-6,-4],[-3,-1],[-4,-2],[-2,0],[-1,0],[0,1],[-1,0],[-25,26],[-15,13],[-15,10],[-6,8],[-6,3],[-5,2],[-5,-2],[-5,-2],[-4,-3],[-4,-3],[-5,-3],[-17,-2],[-13,-3],[-8,-3],[-5,-4],[-4,-3],[-3,0],[-1,2],[0,3],[2,19],[0,6],[-1,6],[-1,4],[0,3],[0,3],[6,10],[5,14],[5,12],[0,4],[-2,2],[-7,2],[-3,1],[-1,4],[0,4],[0,4],[1,2],[2,2],[26,22],[4,6],[-1,2],[-2,1],[-3,1],[-31,1],[-5,-1],[-11,-4],[-22,-6],[-3,0],[-4,1],[-4,0],[-23,-6],[-11,-1],[-6,1],[-4,1],[-5,3],[-10,9],[-8,4],[-6,-1],[-5,-2],[-14,-12],[-2,-3],[-2,-3],[-2,-10],[-1,-4],[-4,-8],[-4,-5],[-5,-4],[-7,-3],[-6,-1],[-5,1],[-3,3],[-1,3],[1,4],[2,4],[2,7],[1,3],[-1,5],[-2,4],[-4,2],[-7,2],[-5,-1],[-3,-3],[-5,-9],[-3,-6],[-6,-6],[-6,-5],[-7,-12],[-3,-2],[-7,-6],[-1,-2],[1,-2],[5,0],[3,0],[2,1],[8,5],[2,0],[-1,-2],[-1,-2],[-18,-9],[-20,-2],[-19,-5],[-6,-3],[-5,-5],[-5,-7],[-15,-17],[-6,-5],[-6,-2],[-4,0],[-5,2],[-3,8],[-1,12],[-1,7],[0,5],[2,10],[-1,4],[-6,0],[-28,-10],[-5,-1],[-3,1],[-1,2],[-2,2],[-1,0],[-5,-3],[-6,-3],[-2,2],[0,2],[2,10],[0,4],[0,5],[-2,3],[-3,2],[-4,1],[-3,0],[-3,2],[-2,5],[-2,2],[-4,0],[-13,-1],[-9,2],[-10,2],[-15,-2],[-4,-1],[-9,-6],[-3,0],[-2,1],[-1,2],[0,6],[-1,3],[-2,0],[-3,0],[-21,-4],[-8,-3],[-8,-3],[-2,0],[-2,2],[0,3],[-1,4],[-1,2],[-3,2],[-3,0],[-2,-1],[-2,-5],[-1,-1],[-5,-4],[-14,-9],[-1,0],[-2,0],[0,1],[1,2],[2,5],[3,6],[1,3],[0,5],[-2,2],[-10,7],[-7,3],[-4,1],[-3,0],[-4,-1],[-6,0],[-17,3],[-4,-1],[-4,0],[-5,-3],[-7,-6],[-2,-1],[-3,-1],[-9,-1],[-6,-2],[-21,0],[-28,-5],[-5,-3],[-2,-2],[-9,-9],[-11,-7],[-5,-5],[-3,-4],[-2,-5],[-3,-3],[-10,-9],[-3,-4],[-2,-4],[-1,-8],[0,-3],[-2,-3],[-1,-3],[-4,-6],[-2,-4],[-1,-3],[-1,-4],[1,-5],[2,-9],[2,-3],[2,-3],[2,-3],[9,-8],[3,-2],[1,-2],[0,-2],[-1,-4],[-1,-2],[-2,-2],[-4,-3],[-5,-2],[-5,-1],[-11,1],[-5,-3],[-3,-4],[0,-5],[0,-10],[-1,-4],[-1,-5],[-2,-2],[-3,-2],[-14,-4],[-9,-3]],[[7414,6502],[5,17],[1,26],[3,25],[-4,13],[-7,18],[-7,31],[2,9],[14,24],[2,8],[-3,2],[-5,0],[-7,4],[7,2],[5,4],[1,4],[-5,6],[-1,0],[-1,0],[-2,-2],[-2,-1],[-2,0],[-2,3],[-3,4],[-7,9],[-2,3],[0,6],[0,4],[0,5],[-5,6],[-2,4],[-2,6],[-2,5],[-4,3],[-3,0],[-7,0],[-2,0],[-4,2],[-1,1],[0,1],[0,8]],[[7362,6762],[10,2],[8,2],[6,2],[3,2],[1,3],[0,4],[-2,2],[-1,2],[1,3],[4,1],[5,3],[5,12],[2,3],[1,1],[8,4],[6,1],[2,2],[0,2],[-1,2],[-4,3],[0,2],[0,2],[1,1],[3,2],[5,3],[1,1],[3,25],[2,6],[4,10],[0,2],[1,1],[0,1],[5,8],[-3,36],[-1,6],[-7,19],[1,5]],[[7431,6948],[1,0],[7,-2],[3,-1],[7,1],[22,5],[39,4],[13,3],[9,7],[8,21],[12,7],[6,0],[13,0],[6,2],[6,4],[4,4],[5,3],[7,2],[12,-1],[31,-21],[39,-18],[44,-5],[78,4],[21,2],[2,0],[17,7],[10,0],[12,-1],[25,1],[11,-3],[10,-5],[5,-2],[7,0],[6,1],[6,3],[5,3],[4,4],[4,6],[3,7],[4,5],[6,4],[5,1],[13,-1],[5,-1],[4,-5],[7,-15],[5,-4],[6,0],[13,4],[6,1],[15,-5],[5,0],[17,2],[10,4],[22,13],[10,2],[7,-3],[1,-5],[1,-6],[4,-5],[5,0],[3,4],[0,6],[-4,4],[7,3],[0,6],[-1,4],[6,1],[6,-2],[10,-8],[6,-3],[21,3],[13,11],[2,12]],[[8191,7017],[11,0],[34,-3],[16,4],[7,3],[13,0],[5,1],[12,5],[38,9],[24,8],[20,4],[7,3],[5,3],[5,5],[8,7],[7,1],[14,-1],[26,-4],[30,-11],[11,-6],[1,-1],[0,-1],[0,-3],[2,-3],[7,-5],[8,-2],[11,-2],[122,12],[8,-1],[7,-3],[4,-3],[10,-7],[6,1],[16,6],[7,2],[19,1],[10,3],[22,7],[8,5],[6,5],[8,8],[5,3],[8,5],[10,6],[3,3],[0,3],[-3,10],[0,8],[3,6],[4,6],[39,37],[7,7],[4,3],[12,9],[13,9],[16,12],[45,36],[2,3],[2,5],[0,1],[-2,5],[-3,3],[-4,3],[-4,5],[-2,5],[2,5],[9,8],[2,0],[2,-1],[3,-2],[2,-2],[4,-5],[2,-2],[8,-1],[4,-2],[10,-4],[33,8],[9,-8],[8,4],[6,0],[3,-1],[11,4],[2,1],[15,10],[19,8],[21,6],[22,5],[4,0],[9,5],[24,11],[18,8],[102,34],[16,9],[4,1],[3,0],[9,-5],[4,-2],[5,-1],[6,-1],[8,0],[29,5],[18,6],[8,5],[7,5],[29,16],[15,5],[85,1],[3,-2],[-1,-2],[-2,-4],[-5,-8],[-4,-10],[-13,-19],[-30,-31],[-9,-12],[-4,-8],[2,-4],[2,-4],[3,-20],[1,-3],[2,-3],[2,-2],[4,-2],[2,-1],[3,-4],[4,-2],[8,-4],[3,-3],[2,-4],[2,-15],[1,-6],[-5,-12],[0,-1],[0,-3],[2,-1],[1,-3],[0,-4],[-2,-6],[1,-3],[2,-1],[3,2],[11,13],[1,1],[1,1],[2,0],[3,1],[2,0],[3,0],[3,0],[3,-2],[6,-8],[2,-3],[1,-3],[0,-10],[-1,-2],[-1,-2],[-1,-1],[-1,-1],[-6,-3],[-2,-1],[-2,-1],[-1,-2],[-1,-5],[-1,-2],[-1,-1],[-2,-1],[-1,0],[-7,-2],[-1,-1],[-2,-2],[-1,-3],[-2,-2],[-1,-2],[-2,-1],[-9,4],[-2,0],[-4,0],[-3,-1],[-2,0],[-12,1],[-4,0],[-53,-20],[-7,1],[-9,6],[-7,5],[-6,3],[-5,1],[-4,-1],[-7,-4],[-4,-2],[-3,-2],[-1,-3],[-2,-3],[-2,-8],[-1,-5],[-4,-6],[-5,-6],[-8,-6],[-7,-3],[-6,-2],[-6,-2],[-4,-3],[-18,-12],[-15,-11],[-4,-1],[-4,-1],[-8,2],[-5,0],[-3,-1],[-2,-1],[-3,-3]],[[9071,6504],[-7,-7],[-8,-11],[-19,-52],[1,-14],[8,-11],[12,-4],[14,-3],[12,-5],[6,-10],[3,-14],[-2,-15],[-7,-11],[-5,-7],[-7,-30],[-5,-9],[-14,-17],[-2,-10],[0,-7],[-1,-6],[-3,-6],[-4,-5],[-4,-2],[-5,-1],[-4,0],[-5,-1],[-3,-5],[-7,-24],[-4,-8],[-15,-9],[-4,-4],[-3,-5],[-5,-18],[-5,-3],[-4,-3],[-2,-4],[-1,-14],[-3,-4],[-4,-3],[-4,-4],[0,-2],[1,-6],[0,-3],[-3,-3],[-7,-4],[-3,-3],[-1,-6],[-1,-12],[-2,-5],[-17,-37],[-4,-13],[-1,-13],[-1,-6],[-4,-4],[-1,-3],[-2,-14],[-1,-5],[-16,-19],[-3,-7],[-1,-7],[1,-8],[-1,-7],[-1,-1],[-5,-4],[-5,0],[-5,5],[-5,7],[-6,4],[-19,10],[-8,1],[-12,3],[-10,4],[-10,2],[-27,-3],[-7,3],[-14,17],[-10,4],[-18,2],[-16,-1],[-9,-5],[0,-2],[-2,-3],[-1,-2],[-2,-2],[-4,-1],[-2,2],[-2,2],[-2,1],[-6,-2],[-10,-5],[-7,-1],[-7,1],[-2,3],[-1,5],[-3,4],[-11,11],[-3,4],[-10,14],[-7,4],[-9,-3],[-4,-6],[-2,-8],[0,-2]],[[8610,6013],[-3,0],[-13,-6],[-3,0],[0,2],[0,2],[1,2],[1,2],[0,3],[-2,3],[-3,3],[-2,1],[-2,-1],[-1,-1],[-2,-3],[-2,-2],[-3,-2],[-6,-1],[-3,0],[-2,0],[-1,1],[0,1],[1,2],[-1,1],[-3,2],[-4,1],[-3,0],[-1,-1],[-4,-4],[-4,-2],[-3,1],[-2,1],[-2,3],[-3,2],[-5,3],[-25,8],[-4,2],[-2,1],[0,2],[1,1],[1,2],[2,1],[2,2],[0,2],[1,2],[0,8],[1,8],[2,5],[0,2],[0,4],[3,6],[0,2],[-1,8],[0,4],[2,5],[2,4],[6,6],[1,4],[-2,5],[-6,4],[-1,5],[1,8],[-1,3]],[[8660,6454],[3,-3],[3,-3],[2,-1],[3,-1],[2,-1],[2,0],[2,-1],[1,0],[2,-3],[2,-2],[4,-1],[7,-2],[4,-1],[3,-2],[2,-3],[5,-7],[3,-2],[3,-1],[2,2],[2,3],[11,15],[11,18],[0,3],[0,2],[6,6],[9,6],[29,29],[2,4],[-1,2],[0,3],[-1,3],[-3,2],[-3,1],[-10,3],[-1,1],[0,1],[2,4],[1,3],[1,3],[4,2],[7,2],[43,4],[16,-3],[7,1],[11,1],[4,-2],[4,-2],[7,-5],[4,-3],[4,-1],[5,0],[6,0],[8,2],[4,-1],[3,-1],[2,-3],[2,-2],[1,0],[0,-1],[3,-1],[5,0],[15,2],[25,4],[14,5],[7,5],[5,4],[7,11],[4,4],[14,7],[5,3],[26,21],[2,1],[1,-1],[0,-3],[0,-3],[-1,-5],[0,-11],[-3,-9],[-3,-6],[-6,-19],[0,-4],[2,-3],[4,-5],[16,-10],[5,-3],[12,-2]],[[9275,6922],[-3,1],[-5,7],[-6,-1],[-3,-3],[-5,-6],[-3,-3],[-3,-1],[-8,-2],[-3,-2],[-3,-3],[-2,-2],[-1,-10],[0,-2],[0,-3],[-2,-4],[-3,-5],[-10,-10],[-6,-4],[-4,-7],[0,-6],[7,-11],[1,-7],[0,-5],[-5,-12],[-2,-10],[-1,-14],[1,-14],[5,-11],[2,-2],[3,-1],[3,-1],[3,-1],[1,-3],[-2,-2],[-2,-3],[-2,-3],[4,-23],[4,-4],[13,-4],[4,-4],[0,-7],[-4,-7],[-10,-12],[-15,-14],[-5,-4],[-13,-4],[-4,-4],[-2,-7],[-1,-7],[7,-36],[1,-8],[-2,-6],[-3,-2],[-8,-1],[-3,-1],[-3,-3],[-30,-41],[-2,-1],[-3,-2],[-2,-1],[0,-2],[3,-3],[0,-2],[-3,-1],[-7,-1],[-3,-1],[-5,-6],[-9,-13],[-6,-4],[-6,-2],[-12,-1],[-7,-3],[-11,-7],[-3,-3]],[[9251,7056],[1,-10],[4,-3],[3,-1],[3,-2],[6,-5],[2,-4],[1,-6],[-1,-13],[-1,-3],[-1,-3],[-2,-3],[-2,-2],[-2,-1],[-2,-2],[-1,-3],[-1,-6],[1,-4],[2,-3],[7,-5],[2,-3],[1,-2],[-3,-11],[0,-6],[0,-4],[0,-3],[7,-15],[0,-11]],[[8296,6350],[-2,7],[-8,5],[-10,3],[-5,8],[-3,2],[-18,2],[-6,1],[-5,2],[-4,3],[-5,4],[-5,6],[-2,2],[-3,0],[-4,-1],[-2,1],[-3,1],[-5,0],[-2,1],[-2,2],[-4,5],[-2,2],[-9,3],[-11,3],[-11,0],[-10,-2],[-6,-2],[-19,3],[-37,-5],[-16,2],[-5,-1],[-3,-2],[-2,-4],[-2,-2],[-3,1],[-4,2],[-4,0],[-2,-6],[-4,-3],[-8,-1],[-8,0],[-6,2],[-6,4],[-2,4],[-2,2],[-6,1],[-3,-1],[-6,-5],[-4,-1],[-4,0],[-7,-2],[-3,-1],[-13,2],[-51,14],[-17,8],[-3,0],[-8,-4],[-4,0],[-19,0],[-55,-8],[-11,-3],[-3,-1],[-38,-5],[-10,1],[-5,3],[-4,3],[-4,2],[-6,1],[-2,-1],[-3,-4],[-2,-1],[-3,0],[-13,2],[-7,3],[-4,1],[-5,0],[-14,-3],[-28,2],[-35,-6],[-12,0],[-26,10],[-54,11],[-76,30],[-13,0],[-12,-5],[-5,1],[-4,7],[-3,12],[-2,12],[2,10],[0,3],[3,10]],[[2181,8069],[-45,6],[-32,0],[-129,6],[-9,1],[-1,6],[0,2],[4,10],[25,36],[0,1],[2,7],[0,6],[-2,6],[-8,3]],[[1986,8159],[1,4],[-5,16],[-8,14],[-7,9],[-17,9],[1,1],[2,5],[6,5],[7,4],[6,-1],[-1,2],[0,5],[-1,3],[6,-2],[4,0],[3,3],[18,21],[2,5],[3,3],[13,3],[5,5],[1,8],[-1,7],[0,5],[3,7],[5,5],[5,4],[5,4],[8,3],[7,1],[3,2],[1,5],[1,3],[5,3],[3,7],[2,3],[6,4],[7,9],[3,3],[5,3],[2,3],[0,2],[-3,7],[1,2],[7,2],[7,4],[4,6],[-3,7],[3,3],[2,3],[4,3],[4,0],[4,0],[9,-2],[8,-1],[2,3],[2,5],[3,6],[6,5],[6,2],[7,1],[7,0],[7,2],[5,5],[5,6],[5,4],[0,7],[5,6],[8,5],[20,10],[-3,3],[-7,5],[-5,3],[-7,0],[-15,-3],[-5,3],[-5,5],[-3,4],[-1,5],[-2,7],[1,7],[6,13],[0,16],[2,8],[14,30],[4,6],[6,6],[4,6],[1,6],[0,7],[-11,14],[-10,32],[-19,31],[-3,4],[1,1],[3,6],[1,0],[3,1],[1,1],[1,2],[1,4],[0,1],[3,4],[1,1],[1,1],[0,5],[1,8],[4,5],[5,5],[26,17],[5,2],[4,3],[10,16],[22,-4],[7,1],[7,9],[3,13],[6,7],[15,-5],[5,6],[7,1],[8,0],[8,1],[4,2],[3,2],[1,3],[3,3],[3,2],[8,-1],[4,0],[-3,10],[6,1],[21,-7],[3,0],[3,2],[4,3],[3,1],[8,-2],[4,0],[0,7],[7,7],[11,5],[8,2],[5,1],[10,-1],[1,4],[4,12],[3,6],[11,10],[3,7],[-2,8],[-9,10],[-9,7]],[[3127,7326],[4,-14],[1,-9],[0,-8],[0,-2],[2,-1],[1,-1],[2,0],[2,-1],[1,-2],[3,-4],[2,-6],[0,-6],[0,-2],[-1,-2],[-3,-3],[-1,-2],[-1,-2],[1,-2],[1,-1],[4,-3],[2,-3],[1,-2],[0,-2],[-1,-3],[-1,-6],[1,-3],[2,-3],[15,-16],[5,-8],[4,-5],[4,-14],[2,-4],[3,-4],[3,-2],[3,-2],[3,-1],[6,0],[3,-1],[3,-1],[18,-13],[2,-1],[3,-1],[8,0],[3,-1],[1,-2],[1,-2],[0,-3],[-1,-4],[2,-7],[2,-3],[3,-4],[1,-4],[2,-7],[2,-2],[2,-1],[2,-1],[2,-4],[-6,-9],[-8,-4],[-4,-2],[-2,-3],[0,-3],[-3,-4],[-5,-3],[-21,-5],[-3,-1],[-2,-2],[0,-2],[0,-2],[0,-1],[1,-2],[1,-1],[2,-1],[2,-1],[4,0],[1,0],[1,-1],[2,-5],[1,-3],[2,-2],[3,-1],[12,-2],[9,0],[1,0],[2,2],[1,1],[1,2],[1,1],[2,0],[2,-1],[1,-2],[5,-9],[2,-2],[2,-1],[2,1],[3,4],[1,1],[2,1],[2,1],[2,-2],[2,-2],[0,-5],[-2,-2],[-5,-3],[-17,-3],[-7,-2],[-57,-24],[-13,-7],[-5,-4],[-3,-3],[0,-3],[-1,-2],[1,-6],[-1,-8],[-1,-7],[0,-2],[1,-2],[3,-1],[9,2],[5,5],[2,4],[4,9],[2,2],[3,-1],[4,-1],[3,0],[4,0],[44,18],[8,4],[10,9],[4,3],[5,1],[5,0],[9,-2],[21,-3],[4,-1],[2,-1],[2,-1],[1,-1],[2,-1],[1,0],[4,3],[4,1],[3,0],[10,-3],[20,-1],[4,-1],[3,-2],[1,-2],[1,-3],[1,-2],[1,-2],[3,-1],[1,1],[0,2],[0,6],[0,3],[1,1],[2,2],[3,0],[7,0],[3,1],[1,2],[2,2],[1,2],[3,2],[2,2],[5,2],[5,1],[10,0],[6,0],[4,-1],[3,-2],[4,-1],[7,-1],[3,0],[2,-2],[2,-1],[1,-1],[0,-2],[-1,-2],[-12,-11],[-3,-2],[-3,0],[-3,0],[-2,-1],[-1,-1],[0,-2],[2,-2],[3,-4],[2,-2],[2,-3],[1,-3]],[[3442,6983],[-7,-2],[-4,2],[-2,-11],[-4,-3],[-11,4],[-6,0],[-3,-5],[0,-4],[2,-5],[0,-4],[0,-1],[-3,-4],[-1,-3],[-1,-6],[0,-5],[-2,-2],[-7,-1],[-3,0],[-4,1],[-3,1],[-3,2],[-3,1],[-3,0],[-8,-3],[-10,-5],[-6,-2],[-7,0],[-3,0],[-3,-2],[-2,-3],[-1,-6],[-2,-3],[-3,-2],[-18,-5],[4,-10],[-7,-6],[-13,-4],[-10,-4],[-6,-7],[-3,-3],[-6,-2],[-6,-1],[-12,-3],[-5,-1],[-5,-1],[-18,-13],[-13,-7],[-4,-4],[-5,-1],[-14,2],[-6,-2],[-4,-4],[1,-5],[-1,-4],[-5,-4],[-3,3],[-4,-2],[-5,-1],[-11,0],[-4,-1],[-5,-3],[-6,-7],[-1,-3],[-2,-5],[-3,-3],[-2,-2],[-5,-3],[-4,-4],[-8,-4],[-7,-7],[-10,-2],[-10,1],[-9,-1],[-9,-5],[-1,-3],[-1,-5],[-1,-3],[-3,-2],[-2,0],[-5,1],[-4,-1],[-11,-5],[-3,-2],[-2,-3],[-2,-4],[-2,-3],[-8,-2],[-3,-3],[-5,-5],[-3,-1],[-10,-2],[-3,-3],[-1,-3],[-1,-3],[-2,-3],[-5,-4],[-19,-12],[-3,-4],[0,-4],[0,-4],[-1,-3],[-3,-4],[-3,-1],[-3,-1],[-3,-1],[-3,-3],[-7,-8],[-5,-3],[-4,0],[-3,1],[-18,2],[-4,-1],[-2,-2],[-3,-8],[-2,-2],[-3,-2],[-7,0],[-3,-2],[-8,-7],[-2,-1],[-3,-1],[-7,-13],[-2,-4],[-1,-5],[1,-10],[-2,-4],[-2,-2],[-7,-1],[-2,-2],[-1,-4],[1,-4],[2,-3],[2,-4],[10,-48],[7,-19],[2,-8],[1,-4],[3,-3],[3,-1],[3,-1],[5,-1],[4,-2],[3,-2],[7,-14],[3,-2],[4,-2],[3,-1],[7,0],[4,0],[4,-2],[4,-1],[14,-11],[3,-1],[2,-1],[3,0],[10,4],[3,1],[3,0],[14,-3],[3,-1],[12,-9],[3,-1],[2,1],[7,4],[18,-1],[10,4],[10,5],[7,4],[6,0],[4,0],[6,-3],[5,-1],[8,-1],[6,1],[4,2],[3,2],[2,4],[2,3],[3,10],[2,3],[3,4],[6,4],[9,3],[7,1],[4,0],[5,-1],[2,-1],[3,-2],[1,-1],[2,-2],[1,-3],[2,-2],[0,-2],[-2,-2],[-1,-2],[-2,-2],[-1,-3],[0,-4],[1,-4],[1,-3],[5,-6],[1,-2],[0,-3],[0,-2],[-2,-3],[-1,-2],[0,-3],[0,-3],[1,-3],[1,-3],[2,-4],[8,-8],[2,-2],[0,-3],[0,-3],[-2,-2],[-1,-3],[-1,-3],[1,-7],[0,-4],[-2,-3],[-3,-1],[-3,-1],[-2,0],[-2,-2],[-1,-2],[-3,-4],[-5,-1],[-6,0],[-5,3],[-5,3],[-5,1],[-4,0],[-7,-3],[-6,1],[-6,2],[-4,-1],[-34,-12],[-17,-2],[-7,1],[-4,0],[-2,-1],[-29,-12],[-11,-2],[-5,-2],[-3,-2],[-3,-6],[-1,-2],[-1,-2],[0,-1],[0,-1],[1,-2],[5,-10],[5,-11],[2,-5],[0,-8],[-1,-2],[-1,-3],[-3,-3],[-4,-3],[-3,-1],[-8,-2],[-7,0],[-3,-1],[-1,-1],[-2,-2],[-2,-3],[0,-3],[5,-4],[18,-20],[10,-5],[15,-2],[3,1],[3,0],[2,1],[4,-1],[3,-2],[17,-13],[4,-4],[4,-6],[3,-7],[4,-17],[1,-8],[-1,-6],[-2,-3],[-1,-2],[-5,-3],[-32,-13],[-1,0],[-6,-1],[-3,0],[-3,0],[-1,1],[-1,0],[0,1],[0,6],[0,2],[-1,3],[-2,5],[-2,2],[-1,2],[-2,2],[-2,0],[-5,0],[-2,1],[-2,1],[-3,1],[-2,1],[-2,-1],[-4,-1],[-1,-2],[0,-4],[2,-12],[0,-3],[0,-2],[0,-1],[-2,-9],[-1,-3],[0,-2],[1,-3],[3,-10],[-1,-23],[2,-8],[4,-7],[16,-19],[5,-7],[1,-4],[-1,-3],[-2,-3],[-3,-3],[-1,-5],[-2,-3],[-2,-2],[-4,-1],[-4,0],[-4,1],[-2,0],[-3,-1],[-6,-4],[-10,0],[-8,5],[-6,5],[-19,12],[-5,4],[-1,2],[1,2],[1,3],[3,6],[2,4],[0,4],[-1,3],[-3,2],[-4,0],[-10,-3],[-9,-4],[-4,-3],[-3,-3],[-3,-4],[-3,-12],[-1,-2],[-4,-2],[-4,-2],[-6,0],[-4,0],[-2,2],[-1,2],[-3,7],[-2,4],[-4,3],[-3,1],[-17,-2],[-9,0],[-8,2],[-18,6],[-6,1],[-12,-2],[-8,0],[-5,2],[-4,3],[-3,3],[-1,3],[-1,2],[0,2],[1,6],[0,2],[-1,2],[-2,1],[-3,-1],[-6,-3],[-5,-2],[-3,-2],[-2,-3],[-1,-4],[0,-10],[-2,-7],[0,-4],[1,-6],[-2,-13],[0,-4],[1,-8],[0,-4],[0,-5],[-12,-13],[-29,-16],[-5,-5],[-1,-4],[2,-3],[5,-5],[0,-1],[0,-1],[0,-1],[-1,-4],[-1,-2],[-3,-4],[-4,-4],[-26,-12],[-18,-5],[-12,-6],[-6,-2],[-6,0],[-3,4],[-3,3],[-4,3],[-2,2],[-4,0],[-2,-2],[-1,-2],[0,-2],[2,-8],[1,-3],[-1,-3],[-5,-10],[-1,-3],[0,-3],[-1,-3],[-2,-4],[-2,-1],[-3,0],[-7,5],[-4,2],[-5,1],[-14,2],[-3,6],[0,7],[-2,4],[-2,3],[-18,10],[-6,4],[-2,2],[-4,6],[-1,14],[0,3],[6,9],[3,8],[4,1],[2,1],[3,-1],[3,-2],[6,-5],[3,-1],[5,-1],[3,-2],[4,-3],[4,-2],[4,0],[4,2],[10,8],[3,1],[4,-2],[6,-5],[4,-2],[1,0],[1,0],[3,3],[2,4],[2,5],[5,7],[10,9],[4,6],[2,4],[-2,3],[-14,8],[-4,4],[-2,7],[0,6],[4,8],[12,14],[3,7],[1,7],[-2,5],[-1,2],[-2,3],[-3,1],[-4,1],[-4,2],[-2,3],[-2,5],[-2,15],[-1,4],[-1,4],[0,6],[3,10],[3,5],[4,4],[4,1],[6,-1],[11,-7],[4,-2],[4,1],[4,3],[3,4],[1,2],[0,1],[1,5],[-2,29],[-10,12],[-7,6],[-2,5],[0,4],[1,3],[1,5],[-2,7],[-11,14],[-5,4],[-3,2],[-4,1],[-5,0],[-5,-2],[-24,-12],[-17,-4],[-16,-1],[-35,-7],[-11,-1],[-10,1],[-16,5],[-11,2],[-10,0],[-13,-2],[-7,1],[-6,1],[-4,3],[-3,3],[-3,3],[-1,4],[1,4],[2,4],[7,6],[3,3],[0,4],[-1,4],[-2,4],[-4,8],[-2,3],[0,3],[1,3],[3,1],[3,-1],[3,-3],[8,-8],[4,-4],[5,-2],[6,-2],[6,0],[8,0],[6,1],[6,2],[5,2],[5,3],[3,4],[3,3],[1,3],[1,2],[-1,2],[-2,1],[-4,0],[-15,-5],[-8,-1],[-8,0],[-10,2],[-5,2],[-3,4],[0,3],[0,2],[1,2],[1,2],[3,0],[3,0],[5,-2],[4,-2],[4,0],[3,1],[2,2],[0,3],[-1,4],[-6,7],[-2,3],[0,1],[-1,3],[6,12],[4,5],[1,3],[0,2],[-1,0],[-2,0],[-3,0],[-12,-3],[-12,-3],[-10,0],[-17,2],[-5,-1],[-3,-1],[-1,-2],[0,-1],[-2,-5],[-1,-2],[-1,-2],[-2,-2],[-4,-3],[-1,-2],[-1,-1],[0,-2],[3,-13],[0,-4],[-1,-8],[-2,-3],[-2,-2],[-2,-1],[-2,0],[-2,1],[-6,2],[-2,0],[-2,0],[-10,-8],[-4,-3],[-2,0],[-5,-1],[-5,1],[-5,3],[-8,5],[-3,1],[-4,1],[-3,1],[-3,2],[-5,6],[-5,2],[-5,2],[-8,0],[-2,-1],[-1,-4],[7,-16],[1,-4],[0,-4],[0,-4],[-2,-11],[0,-2],[2,-1],[4,0],[10,0],[6,-1],[8,-2],[3,-1],[4,1],[3,1],[3,0],[3,0],[3,-2],[1,-3],[0,-5],[-2,-5],[-2,-4],[0,-4],[1,-4],[-1,-7],[-3,-3],[-4,-3],[-5,-2],[-4,-1],[-13,-1],[-4,0],[-4,3],[-3,3],[-3,8],[-3,2],[-5,4],[-2,2],[-2,3],[-1,9],[-2,4],[-2,3],[-3,0],[-2,-2],[-2,-4],[-1,-12],[1,-9],[1,-3],[3,-6],[1,-4],[-13,-26],[-10,-16],[-1,-3],[-1,-5],[0,-3],[1,-3],[2,-2],[33,-9],[5,-3],[4,-4],[1,-7],[-3,-5],[-5,-5],[-20,-16],[-1,-4],[-1,-4],[0,-5],[-2,-6],[-3,-5],[-4,-5],[-1,-3],[2,-2],[3,-2],[5,0],[16,2],[6,0],[6,-2],[5,-3],[5,-4],[3,-5],[2,-6],[1,-17],[2,-7],[2,-6],[3,-6],[4,-4],[3,-4],[8,-6],[3,-3],[3,-4],[0,-3],[-3,-3],[-2,-3],[-3,-4],[-13,-37],[-2,-14],[0,-11],[0,-7],[1,-5],[4,-4],[5,-9],[2,-11],[1,-6],[0,-6],[-2,-7],[-3,-5],[-3,-4],[-3,-3],[-3,-4],[-2,-4],[-5,-14],[-2,-6],[-3,-5],[-4,-4],[-10,-9],[-3,-1],[-8,-2],[-4,-1],[-20,-13],[-7,-2],[-18,-5],[-6,-4],[-21,-18],[-4,-6],[-12,-21],[-1,-5],[1,-3],[3,-4],[2,-2],[2,-1],[3,-1],[10,-2],[10,-3],[4,-1],[8,0],[5,0],[3,-2],[3,-2],[3,-5],[3,-3],[7,-4],[1,-4],[-3,-2],[-14,-6],[-19,-12],[-22,-4],[-25,-13],[-7,-1],[-6,1],[-5,2],[-5,1],[-7,0],[-5,0],[-3,-2],[-3,-2],[-5,-5],[-6,-3]],[[2115,5666],[-3,6],[-2,5],[-3,3],[-3,1],[-3,2],[-3,2],[-6,9],[-1,4],[-3,4],[-4,5],[-9,6],[-5,2],[-3,0],[-4,-4],[-2,-1],[-3,-1],[-4,-1],[-4,1],[-4,3],[-5,8],[0,5],[0,5],[0,5],[-1,4],[-2,5],[-5,4],[-19,9],[-11,11],[-13,10],[-4,1],[-3,0],[-1,-1],[-1,-4],[-1,-1],[-1,-2],[-2,-1],[-3,0],[-2,-1],[-4,1],[-3,1],[-10,11],[-13,19],[-2,3],[-3,2],[-5,0],[-27,-8],[-4,0],[-7,7],[-4,2],[-13,-1],[-3,4],[3,8],[1,5],[-1,3],[-2,5],[-2,5],[0,7],[1,5],[0,8],[-1,6],[-8,9],[-5,3],[-4,0],[-4,-2],[-6,-6],[-5,-3],[-3,-1],[-3,1],[-2,1],[0,5],[1,5],[0,8],[1,4],[1,3],[1,2],[-1,3],[-2,3],[-2,2],[-3,1],[-9,2],[-4,2],[-4,3],[-3,5],[-2,6],[-2,3],[-2,3],[-3,2],[-3,1],[-11,-1],[-1,1],[-1,2],[3,16],[0,4],[-1,9],[1,4],[1,4],[2,3],[6,4],[5,2],[4,4],[2,1],[-2,10],[-4,6],[-2,5],[-1,1],[0,2],[0,7],[-1,5],[-2,5],[-12,16],[-2,2],[-3,-2],[-3,-3],[-4,-10],[-2,-4],[-3,-3],[-3,-3],[-13,-8],[-4,0],[-5,5],[-8,9],[-1,3],[-1,5],[-2,3],[-2,3],[-7,2],[-3,2],[-4,6],[-3,2],[-8,3],[-3,4],[-2,3],[-3,7],[-5,9],[0,4],[0,4],[10,23],[2,2],[3,2],[3,3],[1,3],[0,3],[1,2],[1,0],[4,-1],[5,0],[5,0],[4,1],[3,1],[2,3],[2,3],[1,4],[0,4],[-1,3],[-3,1],[-3,0],[-3,-2],[-3,-2],[-2,-1],[-2,1],[-18,5],[-3,2],[-3,2],[-2,2],[0,2],[0,1],[3,8],[1,7],[0,8],[-1,2],[-1,3],[-1,1],[-1,1],[-4,1],[-6,-1],[-11,-3],[-5,-1],[-3,0],[-2,0],[-2,-2],[-3,-3],[-2,-3],[-2,-3],[0,-2],[-1,-1],[0,-5],[0,-3],[0,-1],[-1,-2],[-1,-1],[-1,-2],[0,-1],[0,-4],[0,-1],[-1,-2],[-1,-2],[-2,-2],[-9,-6],[-4,-1],[-5,0],[-13,4],[-8,2],[-14,0],[-17,1],[-4,2],[-6,2],[-4,3],[-3,3],[-2,3],[-4,10],[-2,3],[-2,2],[-3,2],[-3,1],[-7,1],[-5,1],[-5,2],[-15,9],[-4,1],[-7,1],[-3,-1],[-2,-1],[-1,-1],[-1,-1],[-1,-1],[-5,-19],[-1,-1],[-1,-1],[-1,-1],[-2,-1],[-2,-1],[-3,1],[-3,1],[-2,4],[-3,7],[-4,5],[-1,3],[0,4],[0,3],[0,3],[-2,2],[-5,1],[-4,-1],[-5,0],[-3,0],[-2,0],[-3,3],[-1,3],[-1,3],[-1,1],[-3,1],[-5,1],[-4,0],[-5,1],[-5,3],[-7,5],[-2,3],[-1,2],[2,2],[1,1],[2,1],[16,1],[4,0],[3,2],[1,1],[1,2],[0,3],[-2,2],[-3,1],[-6,0],[-12,-3],[-21,-2],[-11,1],[-25,8],[-7,5],[-4,7],[-2,4],[-4,2],[-5,0],[-17,-4],[-2,-2],[-2,-1],[-6,-6],[-3,-3],[-5,-1],[-4,-1],[-7,2],[-3,2],[-3,5],[-2,1],[-4,1],[-3,-1],[-5,-2],[-3,-3],[-2,-2],[0,-3],[1,-4],[-1,-2],[-2,-1],[-5,0],[-8,3],[-3,2],[-1,4],[-1,3],[-2,2],[-4,1],[-34,-7],[-5,0],[-6,1],[-4,2],[-6,5],[-7,2],[-9,0],[-26,0],[-7,-2],[-3,-2],[-11,-7],[-5,-2],[-5,-1],[-7,1],[-7,4],[-5,0],[-9,-1],[-6,-2],[-4,-2],[-5,-4],[-6,0],[-4,0],[-32,9],[-15,9],[-10,2]],[[997,6242],[-7,10],[-11,30],[-21,30],[-9,18],[-8,19],[-11,48],[-4,9],[-6,7],[-22,17],[-11,12],[-4,7],[-2,8],[-3,9],[-13,13],[-6,8],[-2,12],[2,40],[1,30],[-1,14],[-7,10],[-14,2],[-13,-3],[-13,-5],[-13,-3],[-40,-1],[-20,4],[-13,4],[-5,4],[-5,8],[-7,19],[-7,7],[-14,12],[-13,14],[-11,17],[-7,18],[0,5],[3,18],[1,12],[1,6],[19,28],[5,13],[1,13],[-2,14],[-1,7],[2,6],[3,8],[1,6],[-1,13],[2,29],[-2,13],[-9,11],[-13,6],[-12,3],[-83,-3],[-15,6],[-24,20],[-14,8],[-53,20],[-11,11],[-3,15],[7,41],[8,43],[9,26],[14,22],[31,28],[22,14],[40,35],[21,30],[29,26],[8,10],[25,67],[4,7],[30,28],[3,3],[24,15],[19,19],[6,4],[6,2],[14,2],[13,4],[6,2],[8,-1],[10,-3],[9,-4],[9,-6],[11,-12],[10,-7],[4,-5],[3,-7],[-1,-13],[1,-6],[10,-23],[13,-17],[18,-11],[24,-3],[28,6],[39,17],[42,19],[26,8],[29,6],[30,2],[27,-2],[28,2],[49,14],[54,15],[5,3],[2,5],[4,43],[2,6],[3,7],[28,32],[42,32],[13,12],[10,15],[6,17],[21,70],[8,14],[25,28],[10,6],[49,23],[45,21],[39,18],[44,21],[6,3],[4,6],[11,24],[9,13],[21,25],[27,46],[17,29],[19,33],[17,51],[15,42],[15,42],[5,6],[59,24],[62,13],[13,6],[57,42],[1,6]],[[4082,7678],[3,-1],[12,-6],[11,-13],[5,-4],[6,-2],[13,-2],[5,-3],[2,-2],[4,-6],[2,-2],[3,-2],[6,-1],[3,-2],[9,-17],[4,-5],[7,-2],[7,1],[6,1],[7,0],[6,-3],[15,-16],[7,-3],[1,4],[-3,22],[1,6],[4,5],[7,4],[5,-1],[8,0],[1,-2],[-1,-3],[0,-3],[2,-3],[6,-3],[6,-1],[13,-2],[4,-3],[7,-12],[4,-4],[6,-2],[10,-3],[6,-4],[13,-12],[6,-3],[6,-1],[14,0],[5,-2],[3,-5],[0,-5],[2,-5],[6,-5],[6,-1],[7,-1],[6,-1],[5,2],[4,-2],[2,-4],[0,-4],[3,-4],[16,-3],[34,-5],[8,-4],[7,-8],[7,-21],[4,-10],[20,-20],[5,-9],[-5,-2],[-2,-2],[3,-3],[5,-1],[-1,-5],[4,-2],[5,1],[5,2],[4,4],[1,5],[2,3],[5,1],[8,-3],[7,-5],[7,-6],[4,-6],[2,-5],[0,-4],[1,-3],[6,-4],[30,-14],[7,-4],[4,-7],[7,-4],[17,-4],[8,-3],[8,-5],[13,-13],[17,-9],[10,-7],[9,-5],[10,0],[8,5],[14,14],[10,4],[17,-1],[8,-3],[1,0],[6,-5],[7,-6],[6,-3],[15,-6],[40,-30],[27,-12],[18,-17],[14,-4],[29,3],[43,10],[7,-2],[2,-1],[6,-9],[5,-13],[3,-26],[4,-13],[7,-8],[43,-3],[8,-3],[16,-8],[22,-4],[42,0],[12,-5],[17,-13],[4,-4],[4,-7],[2,-5],[4,-3],[8,-3],[7,1],[7,3],[6,6],[7,9],[3,5],[0,4],[-5,6],[-1,4],[1,5],[2,3],[9,3],[32,0],[37,-5],[25,-8],[48,-23],[15,-6],[2,-1]],[[5376,7165],[-1,-3],[0,-2],[-1,-1],[1,-1],[11,1],[3,-1],[1,-1],[-1,-4],[-2,-9],[0,-2],[2,-3],[5,-4],[2,-1],[4,-3],[2,-2],[5,-7],[0,-6],[-2,-6],[0,-8],[1,-4],[3,-4],[8,-5],[2,-3],[5,-10],[2,-3],[6,-4],[2,-4],[2,-5],[0,-5],[0,-10],[0,-1],[11,-21],[3,-5],[6,-3],[4,-2],[4,-2],[4,-4],[9,-6],[4,0],[2,2],[2,2],[2,1],[4,1],[3,1],[3,0],[3,0],[4,-1],[2,-3],[3,-3],[2,-8],[0,-6],[0,-5],[-3,-17],[1,-3],[2,-2],[3,-1],[6,0],[3,0],[4,-1],[4,-3],[26,-23],[2,-3],[2,-2],[0,-3],[0,-2],[-4,-2],[-52,-1],[-13,2],[-9,3],[-4,0],[-6,-1],[-10,0],[-3,-1],[-2,-1],[-2,-3],[-2,-4],[-3,-12],[-2,-3],[-2,-4],[-2,-2],[-3,-2],[-4,-1],[-14,-3],[-1,-1],[-1,0],[-1,-2],[-4,-6],[-2,-1],[-1,-1],[-2,0],[-1,2],[0,2],[-1,3],[-1,2],[-1,2],[-1,1],[-2,0],[-2,0],[-2,-1],[-1,-3],[-1,-2],[0,-11],[-1,-6],[1,-4],[2,-3],[5,-3],[5,-1],[5,0],[4,1],[3,1],[3,1],[1,1],[1,2],[2,1],[2,0],[3,-1],[5,-4],[9,-8],[7,-3],[6,-3],[25,-5],[2,-1],[1,-2],[0,-4],[-2,-5],[-6,-8],[0,-3],[0,-3],[3,-6],[5,-7],[0,-1],[0,-1],[-7,-4],[-7,1],[-3,1],[-3,0],[-2,0],[-3,-1],[-2,-1],[-4,-3],[-2,-1],[-3,-1],[-20,-2],[-5,-1],[-2,-1],[-1,-1],[-2,-2],[-2,-2],[-1,-2],[0,-4],[1,-3],[4,-3],[8,-5],[5,-8],[10,-20],[3,-2],[4,-3],[3,0],[4,-1],[8,-5],[4,-1],[3,-1],[3,-4],[3,-5],[2,-7],[4,0],[4,-1],[3,-1],[1,-3],[3,-11],[2,-4],[2,-2],[5,-5],[6,-4],[6,-2],[6,1],[12,3],[4,1],[10,0],[4,-2],[4,-4],[4,-5],[1,-5],[3,-2],[13,-7],[4,-1],[11,1],[6,-1],[4,-1],[26,-22],[1,-3],[1,-2],[-1,-4],[-4,-4],[1,-5],[-3,-3],[-2,-2],[-15,-10],[-2,-1],[-4,-1],[-9,0],[-4,0],[-3,1],[-5,3],[-9,3],[-6,4],[-11,10],[-5,2],[-6,-2],[-5,-2],[-5,-2],[-4,-2],[-1,-8],[4,-10],[1,-2],[0,-2],[1,-2],[0,-2],[-1,-2],[-1,-1],[-2,-2],[-3,-1],[-6,-2],[-5,-1],[-6,0],[-3,1],[-2,0],[-2,1],[-3,2],[-1,1],[-2,2],[-1,1],[-1,2],[0,2],[-1,2],[0,2],[0,2],[1,2],[0,3],[0,5],[-1,2],[-11,6],[-13,-3],[-29,-22],[-19,-23],[-7,-6],[-22,-14],[-3,-4],[-1,-3],[-6,-4],[-11,-6],[-13,-4],[-2,-1],[-2,-4],[-2,-4],[-9,-6],[-36,-20],[-47,-25],[-5,-4],[-11,-7],[-5,-3],[-19,-8],[-10,-6],[-5,-3],[-5,-5],[-4,-5],[-1,-3],[-1,-2],[-2,-4],[-1,-10],[-2,-19],[0,-4],[0,-4],[1,-3],[4,-7],[7,-10],[1,-3],[1,-1],[1,-10],[-1,-13],[-1,-6],[-1,-4],[-1,-2],[-1,-3],[1,-5],[1,-4],[8,-7],[3,-1],[2,-1],[2,-2],[7,-10],[3,-3],[4,-4],[5,-2],[5,-2],[12,-3],[3,-2],[2,-3],[2,-7],[1,-5],[0,-3],[-7,-10],[0,-3],[0,-2],[4,-8],[1,-3],[-1,-5],[-1,-8],[2,-12],[-1,-10]],[[5263,6185],[-29,-3],[-6,-3],[-5,-3],[-1,-2],[-2,-1],[0,-2],[-1,-3],[0,-2],[0,-3],[1,-3],[4,-8],[2,-4],[2,-3],[5,-6],[5,-6],[1,-3],[0,-3],[0,-3],[-2,-3],[-9,-11],[-1,-3],[-1,-3],[0,-3],[0,-4],[-1,-3],[-1,-2],[-10,-10],[-4,-8],[-3,-4],[-8,-20]],[[5199,6050],[-3,-6],[-4,-10],[-2,-4],[-3,-2],[-11,-6],[-3,-4],[-2,-5],[0,-10],[-1,-2],[-1,-2],[-7,-11],[-2,-3],[-2,-2],[-3,-1],[-8,-3],[-9,-2],[-4,-1],[-10,-5],[-4,-1],[-6,0],[-16,2],[-12,0],[-10,-1],[-4,0],[-10,2],[-8,4],[-6,4],[-19,16],[-13,4]],[[5016,6001],[-11,14],[-7,6],[-2,2],[-3,1],[0,2],[0,4],[2,4],[0,4],[-1,3],[-2,2],[-4,3],[-6,4],[-5,5],[-3,4],[-2,5],[1,2],[2,1],[2,1],[8,1],[4,2],[4,4],[3,23],[5,9],[2,4],[1,5],[0,19],[-1,5],[-2,3],[-6,2],[-2,2],[0,3],[0,4],[3,16],[0,7],[-2,7],[-1,6],[0,3],[2,3],[2,2],[2,1],[2,0],[9,-3],[5,0],[4,2],[3,5],[0,3],[-1,2],[-5,4],[-2,3],[-2,4],[-2,9],[-2,3],[-2,2],[-2,1],[-12,1],[-3,0],[-2,3],[0,2],[0,8],[-1,3],[-2,1],[-2,0],[-3,-1],[-24,-9],[-4,-1],[-5,-1],[-16,2],[-33,10],[-4,0],[-5,-1],[-1,-3],[0,-3],[0,-3],[0,-3],[1,-6],[0,-3],[-1,-4],[-5,-4],[-5,-1],[-13,1],[-17,-1],[-2,2],[3,3],[5,11],[0,5],[-2,3],[-3,2],[-3,1],[-2,0],[-2,-1],[-2,-1],[-1,0],[-2,0],[-2,2],[-1,2],[-1,2],[1,15],[0,7],[-1,2],[-2,0],[-1,-1],[-2,-2],[-2,-5],[-2,-1],[-1,-2],[-3,-1],[-2,0],[-4,3],[-1,2],[0,3],[1,2],[2,3],[1,4],[0,8],[-1,3],[-2,2],[-1,1],[-1,0],[-2,-1],[-14,-9],[-3,-1],[-3,-2],[-3,0],[-2,0],[-2,0],[-4,2],[-17,12],[-8,4],[-3,0],[-8,0],[-7,1],[-4,1],[-4,2],[-26,17],[-3,3],[-1,3],[-1,2],[0,2],[1,2],[2,3],[0,3],[0,3],[-4,6],[-1,1],[-2,5],[-4,4],[-4,2],[-5,1],[-3,0],[-3,0],[-2,-1],[-5,-3],[-4,-1],[-5,0],[-6,1],[-3,2],[-1,3],[-1,4],[-2,4],[-2,1],[-15,0],[-14,4],[-8,0],[-5,1],[-3,2],[-1,3],[0,2],[0,2],[2,1],[0,2],[0,1],[-1,3],[-3,4],[-2,3],[-1,9],[-8,10],[-31,-8],[-7,-4],[1,-1],[2,-2],[10,-6],[2,-2],[0,-2],[-1,-3],[-3,-2],[-4,-2],[-9,-1],[-9,0],[-5,1],[-3,2],[-1,1],[0,2],[0,2],[1,5],[1,1],[0,1],[-2,2],[-2,1],[-8,3],[-4,1],[-6,2],[-4,-1],[-5,-2],[-4,0],[-4,1],[-5,1],[-2,-2],[-1,-3],[2,-11],[0,-3],[0,-4],[-1,-2],[-1,-3],[-4,-7],[-6,-7],[-9,-8],[-1,-3],[-1,-2],[0,-4],[1,-2],[2,-3],[0,-2],[1,-3],[0,-2],[-1,-3],[-2,-1],[-2,-1],[-8,0],[-3,-1],[-2,-1],[-3,-2],[-9,-11],[-10,4],[-13,11],[-5,4],[-4,1],[-2,0],[-9,-4],[-4,0],[-6,0],[-3,1],[-3,2],[-3,4],[-3,2],[-2,1],[-3,0],[-18,-4],[-2,-1],[-10,0],[-9,1],[-4,2],[-2,2],[0,3],[1,2],[0,1],[4,4],[2,2],[2,2],[1,3],[0,3],[1,3],[0,2],[1,2],[1,1],[2,2],[6,5],[1,1],[1,10],[0,3],[10,22],[1,5],[-2,2],[-2,2],[-2,1],[-3,1],[-2,0],[-3,-1],[-3,-1],[-2,0],[-1,-1],[-1,-1],[-1,-2],[-1,-1],[-2,-9],[-1,-2],[-2,-2],[-3,-1],[-3,0],[-26,-1],[-3,0],[-2,-1],[-1,-1],[-1,-1],[1,-2],[2,-1],[15,-9],[3,-3],[1,-3],[-1,-3],[-3,-2],[-3,0],[-8,0],[-3,-1],[-7,-2],[-3,-1],[-3,1],[-3,2],[-8,8],[-2,3],[-2,3],[-3,7],[-2,3],[-2,1],[-3,1],[-2,-1],[-2,-1],[-1,-2],[0,-2],[1,-3],[0,-3],[-1,-3],[-2,-1],[-2,-1],[-3,0],[-3,0],[-11,2],[-6,2],[-3,1],[-2,-1],[0,-1],[0,-1],[1,-4],[1,-2],[1,-4],[1,-3],[3,-2],[9,-3],[2,-2],[1,-1],[1,-3],[-13,-8],[-3,-1],[-4,0],[-2,1],[-2,2],[-5,8],[-6,5],[-2,1],[-1,-1],[0,-1],[0,-2],[2,-9],[0,-2],[-1,-3],[-3,0],[-2,0],[-3,1],[-3,1],[-3,1],[-5,1],[-5,-1],[-10,-3],[-4,0],[-3,1],[-4,6],[-2,3],[-2,8],[0,3],[1,4],[1,2],[1,0],[1,-1],[2,0],[2,-1],[6,2],[2,2],[3,4],[7,6],[2,2],[1,3],[2,2],[2,1],[2,1],[2,1],[5,2],[5,2],[4,2],[2,2],[1,2],[0,1],[-1,2],[-3,6],[0,2],[-1,6],[-1,2],[-1,1],[-1,2],[-1,1],[-2,0],[-2,-1],[-1,0],[-2,0],[-1,1],[-3,5],[-1,1],[-2,2],[-4,2],[-6,2],[-1,2],[-1,4],[-1,13],[-2,11],[-1,3],[-1,3],[-5,6],[-2,4],[-3,1],[-3,0],[-5,-1],[-6,-2],[-3,0],[-2,0],[-5,2],[-3,1],[-2,-1],[-1,-2],[-3,-5],[-2,-3],[-2,-2],[-15,-10],[-1,-1],[-2,0],[-2,1],[-8,4],[-24,-11],[-6,-4],[-9,-8],[-13,-9],[-7,-4],[-4,-1],[-9,-1],[-8,-2],[-4,-3],[-2,-2],[0,-2],[0,-1],[0,-3],[1,-2],[1,-3],[2,-2],[6,-7],[1,-2],[1,-2],[-1,-3],[-1,-1],[-5,-1],[-4,-1],[-8,-4],[-4,-1],[-4,0],[-4,6],[-2,1],[-2,1],[-2,0],[-9,-1],[-26,-2],[-4,1],[-11,3],[-13,6],[-4,1],[-2,0],[-2,0],[-4,-1],[-4,-3],[-3,-3],[-6,-11],[-1,-2],[-3,-3],[-5,-3],[-4,0],[-3,1],[-2,1],[0,3],[-1,2],[0,2],[-1,2],[-3,2],[-4,1],[-6,0],[-3,-1],[-2,-2],[0,-2],[0,-6],[1,-5],[0,-4],[-2,-4],[-11,-1],[-4,1],[-3,2],[-2,3],[-1,3],[0,5],[1,5],[1,4],[1,3],[2,2],[8,8],[4,4],[4,9],[12,15],[5,10],[0,4],[-1,2],[-2,-1],[-3,-2],[-6,-6],[-3,-1],[-3,1],[-3,1],[-3,1],[-4,-1],[-4,-2],[-2,-3],[-2,-2],[-1,-2],[-1,-2],[-2,-1],[-2,-1],[-3,1],[-2,1],[-3,4],[-1,4],[-1,3],[1,3],[0,2],[2,3],[8,13],[1,3],[0,3],[-2,2],[-2,1],[-3,0],[-9,-11],[-4,-9],[-1,-4],[0,-3],[0,-5],[9,-24],[1,-6],[0,-3],[-2,-3],[-2,-2],[-4,0],[-8,3],[-3,1],[-3,0],[-3,-1],[-3,0],[-6,2],[-3,1],[-4,0],[-4,-2],[-3,-3],[-3,-6],[-3,-2],[-3,0],[-2,1],[-1,2],[-1,11],[-1,4],[-3,0],[-6,0],[-11,-5],[-6,-2],[-4,0],[-2,1],[-2,2],[-1,2],[0,4],[1,4],[2,4],[9,9],[1,2],[0,1],[-1,1],[-4,2],[-1,1],[-1,1],[-1,1],[-3,2],[-5,0],[-3,-1],[-1,-1],[-1,-3],[1,-3],[-1,-4],[0,-4],[-4,-3],[-4,-1],[-5,0],[-3,-2],[-3,-2],[-4,-6],[-3,-3],[-6,-4],[-4,0],[-3,2],[-2,3],[-1,6],[0,5],[2,5],[2,6],[4,4],[5,4],[8,5],[2,2],[2,3],[1,3],[0,3],[-1,5],[0,3],[1,4],[6,10],[1,4],[1,10],[0,2],[-1,2],[-2,2],[-1,0],[-3,-1],[-4,-1],[-4,0],[-3,1],[-1,2],[1,3],[2,3],[1,4],[1,4],[0,6],[-1,4],[-1,3],[-5,4],[-3,1],[-4,-2],[-3,-3],[-3,-3],[-2,-5],[-1,-1],[0,-2],[0,-4],[1,-13],[-1,-3],[-2,-3],[-4,-2],[-6,-1],[-4,1],[-2,2],[0,4],[0,14],[-1,8],[-1,1],[-1,2],[-3,5],[-7,-5],[-3,0],[-3,-1],[-4,-2],[-2,-2],[-1,-4],[-1,-8],[2,-2],[6,-5],[1,-2],[0,-3],[-1,-3],[-3,-5],[-2,-3],[0,-2],[1,-3],[1,-4],[1,-3],[-1,-3],[-3,-2],[-3,1],[-3,2],[-4,4],[-2,3],[-6,3],[-2,2],[-1,4],[-2,2],[-3,1],[-7,2],[-7,0],[-5,0],[-3,-1],[-2,-2],[-1,-2],[-1,-2],[0,-2],[1,-2],[1,-3],[-1,-2],[-1,-1],[-5,-4],[-2,-2],[-8,-11],[-4,-6],[-1,-4],[-1,-2],[0,-3],[1,-3],[2,-2],[2,-3],[7,-5],[4,-4],[4,-4],[13,-27],[2,-9],[1,-16],[7,-35],[3,-8],[4,-6],[13,-12],[4,-5],[5,-9],[2,-6],[1,-6],[-1,-16],[2,-10],[0,-5],[-1,-3],[-1,-3],[-4,-5],[-1,-3],[0,-5],[1,-5],[3,-4],[2,-3],[2,-2],[4,0],[4,1],[10,3],[8,2],[4,0],[5,-1],[5,-2],[5,-4],[3,-5],[1,-5],[2,-5],[2,-4],[7,-9],[3,-5],[-1,-3],[-2,-5],[0,-2],[0,-1],[0,-1],[0,-1],[1,-3],[1,-1],[3,-1],[3,0],[8,-1],[6,-3],[0,-10],[-2,-6],[-3,-6],[-3,-4],[-3,-3],[-4,-3],[-11,-11],[-5,-7],[-3,-10],[-4,-8],[-6,-6],[-8,-9],[-6,-3],[-6,-1],[-6,2],[-4,4],[-2,5],[-1,4],[0,3],[-1,2],[-1,1],[-4,1],[-5,-1],[-11,1],[-6,2],[-6,2],[-5,4],[-10,10],[-7,4],[-19,15],[-9,5],[-6,3],[-4,0],[-4,-1],[-1,-2],[-2,-3],[-2,-3],[-1,-4],[-1,-4],[0,-3],[0,-3],[-2,-3],[-2,-3],[-4,-3],[-5,-4],[-8,-2],[-5,0],[-5,3],[-4,3],[-3,4],[-2,4],[0,4],[1,3],[6,11],[1,2],[-1,3],[-2,2],[-3,2],[-9,4],[-6,4],[-5,4],[-2,5],[-1,3],[-2,1],[-3,1],[-3,2],[-1,1],[-5,9],[-1,1],[1,4],[9,11],[4,7],[2,7],[0,7],[-1,2],[-3,3],[-1,2],[2,6],[1,3],[-2,8],[-3,5],[-3,4],[-4,5],[-1,7],[0,7],[-1,7],[-9,16],[-2,1],[-4,1],[-3,3],[-1,4],[0,4],[4,5],[15,12],[11,5],[19,16],[4,6],[4,7],[2,8],[-4,7],[0,5],[2,2],[1,10],[1,5],[1,3],[5,7],[2,9],[0,4],[-2,5],[-4,6],[-17,35],[-5,6],[-4,4],[-5,7],[-2,4],[0,3],[1,2],[3,3],[23,18],[6,8],[3,18],[5,5],[31,8],[7,1],[5,0],[10,-2],[7,0],[4,1],[5,2],[3,3],[12,6],[34,6],[11,6],[1,3],[1,1],[0,2],[0,2],[0,3],[-1,4],[-2,5],[-5,7],[-1,4],[0,3],[0,4],[1,3],[1,5],[2,5],[3,4],[4,3],[5,2],[6,4],[6,5],[5,13],[4,10],[15,17],[3,5],[1,3],[1,8],[7,14],[11,16],[2,4],[1,4],[-2,2],[-6,3],[-2,3],[-2,4],[-1,6],[1,4],[2,1],[7,3],[3,2],[0,2],[0,2],[-4,6],[-2,4],[-1,5],[1,3],[1,3],[5,4],[3,1],[2,1],[4,1],[9,2],[4,2],[3,2],[3,3],[7,12],[1,2],[0,2],[-1,1],[-2,2],[-1,0],[-3,4],[4,13],[-1,10],[-3,9],[-4,11],[-19,25],[-4,9],[-5,14],[-3,11],[0,3],[0,3],[-1,3],[-3,4],[-2,1],[-5,0],[-11,-3],[-4,0],[-7,4],[-10,13],[-7,5],[-3,0],[-4,0],[-3,1],[-1,2],[-2,5],[-3,1],[-4,-1],[-3,-3],[-5,7],[-6,0],[-13,-7],[-4,-1],[-7,1],[-3,0],[-2,-2],[-2,-3],[-2,-2],[-4,-1],[-7,1],[-16,9],[-6,2],[-13,1],[-5,3],[-3,3],[-2,3],[-1,2],[-4,0],[-7,0],[-4,1],[-5,9],[-7,2],[-8,1],[-14,-2],[-2,-1],[-3,-3],[-5,-8],[-1,-1],[-7,1],[-5,1],[-6,0]],[[3231,8221],[12,7],[6,-1],[8,-2],[31,-24],[21,-12],[40,-16],[6,-6],[-3,-4],[-6,-6],[-18,-12],[-11,-12],[-16,-32],[-15,-21],[-1,-6],[2,-14],[-1,-15],[2,-6],[6,-14],[3,-18],[2,-9],[16,-29],[32,15],[10,7],[5,1],[5,-2],[20,-11],[12,-8],[3,-1],[8,-2],[16,7],[12,11],[3,14],[-3,16],[-10,29],[-1,8],[-1,9],[2,4],[2,3],[4,2],[5,2],[5,-1],[4,0],[3,-3],[20,-19],[13,-17],[10,-19],[3,-4],[6,-5],[34,-14],[12,-11],[8,-15],[6,-9],[12,-14],[18,-15],[56,-29],[9,-4],[25,-4],[5,-3],[0,-4],[-2,-4],[-3,-4],[-16,-13],[-4,-2],[-3,0],[-2,2],[-3,1],[-3,-1],[-2,-3],[-4,-7],[-3,-1],[-4,1],[-3,2],[-3,1],[-1,-1],[-3,-1],[-6,-2],[-1,-1],[-1,-2],[1,-2],[0,-2],[-4,-2],[-1,-1],[3,-2],[50,-24],[6,-6],[4,-7],[3,-7],[3,-18],[12,7],[22,5],[8,4],[2,1],[4,-1],[26,-13],[3,-3],[1,-3],[0,-4],[1,-3],[3,-4],[6,-5],[43,-28],[8,-2],[7,-1],[4,1],[3,2],[3,-1],[3,-2],[2,-3],[6,-5],[3,-3],[2,-3],[5,-16],[4,-9],[28,10],[14,0],[3,-3],[2,-4],[3,-4],[4,0],[4,2],[7,3],[23,-4],[9,3],[1,2],[0,3],[0,2],[5,2],[7,0],[16,-3],[7,-4],[3,-3],[-1,-4],[-3,-7],[0,-4],[2,-3],[3,0],[10,4],[5,1],[2,-2],[1,-3],[-2,-4],[0,-4],[2,-2],[3,0],[5,1],[4,1],[1,-2],[-2,-3],[0,-3],[2,-4],[7,-4],[6,-1],[5,0],[5,2],[4,2],[5,3],[9,9],[4,5],[1,4],[1,6]],[[3674,8540],[4,3],[3,5],[6,11],[6,-3],[8,-7],[6,-2],[4,8],[3,15],[6,14],[17,2],[5,-2],[9,-7],[12,-6],[2,-5],[1,-6],[4,-5],[3,-1],[6,0],[3,-2],[1,-3],[0,-4],[-1,-3],[0,-4],[1,-3],[5,-3],[2,-3],[0,-3],[0,-3],[-1,-3],[1,-3],[6,-4],[6,-1],[4,-3],[2,-7],[0,-7],[1,-6],[3,-5],[4,-5],[9,-4],[9,-3],[9,-4],[3,-5],[2,-3],[2,-12],[3,-4],[4,-1],[6,1],[5,0],[5,-1],[5,-3],[2,-1],[1,-2],[1,-1],[0,-2],[4,-5],[5,-5],[5,-5],[5,-2],[8,-1],[4,-2],[4,1],[14,7],[6,2],[14,0],[17,4],[8,0],[24,-6],[6,-2],[5,-5],[6,-10],[7,-8],[4,-2],[2,-1],[5,-3],[24,-9],[8,-5],[6,-9],[6,-7],[10,-4],[6,1],[11,6],[5,0],[4,-3],[10,-13],[9,-5],[3,-3],[-9,-14],[-2,-2],[-3,0],[-3,0],[-3,0],[-3,-2],[1,-4],[3,-4],[5,-4],[3,-5],[1,-6],[-2,-6],[-3,-5],[-3,-6],[12,3],[13,-1],[25,-6],[34,-17],[17,-6],[11,-6],[6,-2],[7,1],[5,2],[5,0],[8,-2],[33,-17],[10,-7],[4,-5],[7,-11],[4,-5],[5,-4],[29,-11],[26,-6],[11,-5],[7,-10],[3,-5],[-3,-6],[-2,0],[-23,-7],[-6,1],[-4,7],[-3,4],[-6,-4],[-6,-6],[-4,-4],[4,-9],[-7,-10],[-20,-13],[-5,-5],[-10,-14],[-4,-4],[-12,-7],[-9,-7],[-4,-3],[-7,-2],[-12,-1],[-5,-3],[-3,-6],[-4,-12],[-8,-11],[-18,-20],[-7,-5],[-20,-5],[-9,-6],[-5,-10],[0,-9],[3,-9],[5,-9],[3,-9],[-1,-8],[-4,-7],[-7,-8],[-2,-1],[-5,-2],[-2,-1],[-1,-3],[1,-2],[1,-2],[-1,-2],[-2,-3],[-3,-2],[-7,-5],[-3,-4],[-3,-2],[-2,-2],[-1,-4],[-2,-4],[-10,-2],[-4,-3],[-1,-6],[2,-6],[7,-11],[3,-14],[2,-4],[3,0],[3,0],[2,-2],[1,-7],[-1,-8],[-7,-23],[-3,1],[-5,3],[-6,-1],[-1,-5],[5,-14],[1,-6],[-4,-4],[-7,-2],[-7,0],[-6,1],[-10,-5],[-7,-13],[-3,-15],[1,-12],[-3,-6],[-4,-3],[-6,-3],[-5,-4],[-5,-5],[-2,-6],[-1,-7],[0,-7],[2,-14],[6,-4],[6,-1]],[[6721,6423],[0,-5],[-1,-2],[-2,-3],[-2,-4],[0,-5],[1,-4],[2,-8],[0,-2],[-1,-5],[1,-3],[1,-2],[2,-1],[2,0],[2,-1],[13,-13],[3,-2],[2,-4],[3,-7],[6,-24],[1,-9],[1,-8],[-1,-4],[-4,-6],[-2,-4],[-1,-18],[-1,-1],[-1,-2],[-2,-1],[-2,0],[-4,2],[-2,1],[-3,-1],[-2,-3],[1,-3],[2,-3],[2,-1],[2,-1],[8,-1],[2,-1],[1,-2],[2,-5],[2,-3],[1,-4],[0,-5],[1,-3],[1,-2],[2,-2],[2,-4],[0,-3],[-1,-2],[-4,-2],[-2,-2],[-1,-3],[1,-2],[3,-1],[2,0],[4,-2],[-2,-6],[-2,-2],[-4,-3],[-4,-2],[-5,-1],[-5,-1],[-4,1],[-4,2],[-3,2],[-4,1],[-3,2],[-5,0],[-4,-1],[-2,-2],[0,-2],[3,-2],[4,-1],[4,-1],[2,-2],[1,-2],[-2,-10],[1,-3],[3,-4],[1,-2],[0,-3],[-1,-2],[-1,-3],[-2,-2],[-3,-3],[-1,-3],[-1,-3],[1,-3],[1,-4],[-2,-5],[-14,-30],[-4,-5],[-10,-8],[-9,-6],[-5,-1],[-7,-2],[-3,-3],[0,-4],[0,-4],[0,-3],[1,-2],[1,-2],[2,1],[2,1],[2,0],[2,-2],[4,-6],[-1,-5],[-3,-3],[-5,0],[-11,1],[-4,-1],[-1,-3],[-1,-7],[-2,-5],[-3,-6],[-3,-2],[-4,1],[-8,6],[-4,2],[-4,1],[-3,-1],[-3,-2],[0,-3],[1,-9],[0,-6],[0,-9],[-1,-3],[-2,-2],[-4,-2],[-4,-5],[-4,-1],[-10,2],[-7,0],[-20,-7],[-2,0],[-2,2],[-1,3],[0,5],[-1,4],[-2,3],[-2,2],[-3,0],[-16,-4],[-6,-2],[-3,-2],[-1,-3],[2,-2],[5,-5],[2,-2],[0,-2],[0,-3],[2,-2],[6,-5],[3,-4],[1,-5],[-1,-4],[-3,-4],[-3,-2],[-4,0],[-1,-2],[-1,-3],[0,-7],[-1,-4],[-2,-5],[-2,-2],[-3,1],[-4,5],[-3,2],[-3,1],[-3,1],[-8,2],[-3,0],[-4,0],[-1,-2],[-1,-2],[1,-3],[2,-2],[6,-5],[2,-3],[0,-2],[-1,-5],[-12,-2],[-18,4],[-8,3],[-6,5],[-8,7],[-2,1],[-4,0],[-6,1],[-7,3],[-18,11],[-6,2],[-4,1],[-3,-2],[-1,-2],[-1,-2],[-1,-3],[-1,-2],[-1,-1],[-3,-4],[-6,-4],[-2,-3],[-2,-4],[-2,-6],[0,-2],[0,-2],[2,-4],[2,-7],[-1,-9],[-7,-8],[-12,-4],[-40,-6],[-22,-7],[-14,-6],[-28,-8],[-17,-7],[-10,-7],[-7,-5],[-4,-5],[-2,-5],[-1,-4],[0,-5],[0,-4],[-1,-3],[-2,-2],[0,-1],[-1,-1],[-2,-1],[-3,-3],[-4,-3],[-10,-8],[-10,-4],[-5,0],[-5,2],[-4,5],[-6,3],[-9,4],[-3,1],[-5,1],[-3,1],[-1,2],[-1,1],[1,5],[4,16],[-2,6],[-11,0],[-14,9],[-6,1],[-5,0],[-3,-2],[-3,-2],[-2,-3],[0,-2],[0,-3],[5,-12],[0,-3],[-2,-3],[-2,-2],[-2,-1],[-19,-3],[-8,0],[-5,0],[-19,-3],[-7,-4],[-1,-1],[-1,-3],[0,-6],[3,-2],[2,-3],[1,-3],[2,-2],[11,1],[2,-1],[4,-3],[0,-2],[-2,-3],[-2,-4],[0,-8],[-1,-4],[-2,-3],[-5,-6],[-6,-8],[-4,-8],[-1,-8],[4,-7],[11,-11],[2,-7],[1,-4],[2,-4],[1,-1],[4,1],[14,5],[6,-1],[8,-1],[6,-3],[7,-5],[41,-43],[8,-6],[5,-2],[5,1],[5,2],[3,2],[15,0],[18,-4],[47,-1],[3,-1],[1,-1],[1,0],[1,0],[3,-1],[6,-1],[3,-1],[1,-1],[0,-1],[-2,-2],[-2,-1],[-4,-1],[-5,0],[-5,-2],[-4,-1],[-9,-7],[-2,-3],[0,-3],[1,-4],[1,-4],[-1,-3],[-4,-8],[0,-3],[0,-9],[-2,-9],[0,-5],[1,-5],[19,-13],[5,-1],[5,0],[3,0],[2,0],[9,-5],[22,-17],[2,-17],[2,-4],[4,-5],[5,-3],[5,-2],[15,0],[6,-2],[8,-5],[5,-4],[3,-5],[3,-7],[0,-2],[1,-3],[-1,-2],[-2,-1],[-4,0],[-6,1],[-2,0],[-1,-1],[-1,-1],[0,-2],[1,-4],[1,-4],[2,-3],[2,-2],[11,-5],[5,-3],[5,-6],[2,-6],[1,-12],[2,-5],[4,-5],[5,-3],[6,-6],[1,-3],[-1,-2],[-5,-2],[-13,-1],[-5,0],[-3,-1],[-2,-2],[1,-7],[-1,-4],[-2,-2],[-3,0],[-6,2],[-2,0],[-2,-1],[-5,-4],[-5,-3],[-2,-2]],[[5416,5493],[2,5],[2,7],[1,2],[1,2],[2,1],[1,2],[6,2],[2,1],[2,2],[6,7],[5,4],[1,0],[11,0],[4,0],[2,1],[3,2],[7,6],[18,12],[2,2],[2,3],[5,18],[2,3],[1,3],[3,2],[2,1],[6,2],[3,2],[3,5],[3,2],[13,9],[5,4],[3,4],[2,4],[0,4],[-1,4],[-1,4],[-4,7],[-1,4],[0,7],[-2,3],[-3,2],[-9,4],[-3,1],[-3,1],[-4,0],[-3,-1],[-1,0],[-2,-1],[-3,-1],[-3,0],[-3,1],[-6,1],[-2,1],[-12,7],[-3,1],[-1,-1],[0,-2],[1,-6],[-1,0],[0,-1],[-1,-1],[-2,-1],[-3,0],[-2,1],[-2,1],[-1,1],[-1,1],[-2,4],[-2,7],[-1,9],[-1,4],[-2,5],[-4,4],[-11,9],[-6,8],[-3,14],[4,15],[3,28],[-4,17],[-2,5],[-2,3],[-4,2],[-2,1],[-3,-1],[-8,-9],[-2,-1],[-2,0],[-2,1],[-1,3],[-1,4],[0,5],[1,3],[2,9],[0,4],[0,3],[0,3],[0,3],[0,2],[1,3],[2,3],[11,10],[4,5],[2,3],[1,4],[1,3],[-1,1],[-6,11],[-1,5],[0,3],[-1,4],[-1,2],[-4,2],[-2,0],[-3,-1],[-4,-2],[-2,-1],[-4,-1],[-1,-1],[-2,-1],[-1,-1],[0,-2],[-1,-2],[0,-4],[2,-7],[0,-3],[-1,-1],[-1,-1],[-2,0],[-2,1],[-21,8],[-3,1],[-3,0],[-2,-1],[-8,-1],[-3,0],[-3,0],[-3,1],[-3,3],[-3,3],[-4,6],[-4,11],[-3,7],[-1,4],[0,2],[1,3],[4,10],[1,3],[-1,4],[-1,4],[-6,14],[-6,6],[-47,41],[-6,7],[-3,5],[-2,5],[-1,5],[0,4],[0,14],[0,5],[-2,3],[-2,3],[-12,6],[-6,5],[-2,1],[-4,1],[-17,1],[-19,6]],[[5263,6185],[5,1],[34,-5],[20,-4],[19,1],[6,2],[7,8],[7,2],[4,-1],[7,-2],[3,0],[4,0],[6,2],[13,1],[7,2],[6,3],[4,6],[4,2],[3,2],[2,2],[1,1],[1,2],[4,11],[2,1],[2,1],[2,-1],[5,-4],[11,-22],[7,-20],[4,-6],[4,-4],[4,-2],[3,1],[2,2],[1,3],[1,3],[0,2],[0,3],[2,1],[3,-1],[1,-1],[1,-3],[0,-3],[1,-3],[3,-2],[2,1],[2,2],[1,3],[-1,6],[1,3],[2,1],[3,1],[4,-1],[3,1],[2,1],[3,0],[2,-1],[3,-1],[2,-1],[3,1],[3,4],[3,1],[4,-1],[3,-3],[3,-7],[1,-11],[-3,-3],[-2,-4],[1,-3],[8,-8],[5,-7],[5,-4],[5,-4],[9,-4],[9,-7],[2,-2],[2,-4],[3,-3],[6,-4],[4,-2],[4,0],[4,0],[4,2],[7,6],[1,3],[1,3],[1,3],[8,7],[3,4],[1,3],[2,1],[2,-1],[3,-2],[3,-2],[4,0],[7,-2],[4,0],[3,3],[3,10],[5,7],[5,4],[15,8],[5,3],[5,3],[4,2],[4,3],[5,-1],[4,-3],[3,-17],[3,-1],[5,1],[4,1],[2,-1],[1,-4],[4,-18],[2,-4],[4,-3],[18,-2],[7,2],[6,3],[6,3],[22,8],[2,-1],[1,-3],[-2,-8],[0,-4],[2,-2],[3,1],[13,12],[5,3],[2,3],[1,2],[0,3],[0,4],[4,3],[31,11],[3,1],[2,3],[0,2],[2,2],[5,2],[27,3],[5,3],[17,-1],[8,0],[7,1],[4,0],[4,-2],[3,-1],[4,0],[10,10],[1,1],[4,3],[1,2],[1,4],[4,0],[5,-2],[6,-1],[8,0],[4,3],[2,4],[0,13],[-1,4],[-1,3],[-2,3],[-1,3],[0,2],[3,1],[8,2],[3,4],[2,4],[1,10],[1,5],[3,5],[3,5],[5,5],[5,1],[29,0],[6,-2],[6,-5],[15,-18],[17,2],[14,9],[6,4],[7,3],[3,-4],[-1,-3],[-2,-3],[-2,-3],[2,-2],[3,0],[6,0],[6,-2],[5,-4],[4,-6],[3,-26],[3,-6],[3,-4],[7,-5],[6,-1],[6,0],[8,5],[3,1],[13,-5],[10,-1],[2,-3],[1,-4],[2,-11],[0,-3],[-2,-4],[-9,-9],[-1,-3],[2,-4],[27,-14],[21,-15],[8,-4],[4,1],[2,4],[2,3],[0,4],[0,3],[0,3],[2,3],[2,1],[4,3],[0,12],[3,12],[3,4],[11,8],[17,16],[8,0],[7,-3],[7,-3],[6,0],[8,1],[4,0],[9,5],[3,7],[3,2],[3,1],[5,-2],[4,-2],[11,-8],[26,-8],[1,2],[-1,7],[1,2],[3,4],[5,8],[1,5],[2,0],[13,-3],[17,-6],[6,-1],[4,2],[3,3],[1,7],[1,5],[5,12],[-1,11],[3,16],[0,5],[-2,4],[-1,3],[1,1],[3,2],[2,3],[6,11],[3,4],[3,4],[1,4],[-2,38],[1,5],[3,5],[8,11],[7,8],[4,2],[11,4],[5,0],[8,-3],[2,0],[2,3],[5,20],[1,7],[3,8],[3,4],[5,1],[7,0],[2,1],[2,1],[3,1],[2,0],[5,-2],[5,-2],[5,-1],[6,2],[2,5],[2,9],[2,3],[5,2],[0,3],[1,5],[4,7],[13,10],[5,3],[4,-1],[2,-1],[3,-1],[3,-1],[4,-3],[4,-4],[2,-5],[4,-3],[21,-5],[7,-3],[15,2],[8,-1],[4,-2],[3,-2],[3,-3],[2,-5]],[[7106,5142],[-4,-1],[-6,1],[-6,-2],[-8,3],[-3,15],[4,13],[11,-6],[5,-2],[5,-4],[3,-4],[1,-7],[-2,-6]],[[6843,5177],[-3,-2],[-4,1],[-10,3],[-9,0],[-4,2],[-3,5],[0,4],[0,4],[2,9],[14,36],[10,18],[9,3],[7,-36],[-1,-21],[-10,-7],[4,-10],[0,-5],[-2,-4]],[[7017,5251],[-1,-19],[-3,1],[-13,4],[-2,0],[-1,3],[-2,5],[0,3],[1,3],[4,9],[6,10],[7,8],[5,2],[4,-2],[3,-5],[-2,-6],[-4,-8],[-2,-8]],[[6831,5257],[-8,-4],[-3,3],[-1,5],[1,7],[2,4],[2,6],[3,6],[4,3],[5,-1],[5,-8],[-3,-11],[-7,-10]],[[7046,7096],[3,-2],[22,-10],[7,-6],[5,-7],[2,-9],[0,-19],[2,-18],[5,7],[6,5],[7,1],[7,-7],[0,-4],[0,-4],[0,-3],[2,-4],[4,-2],[4,0],[4,1],[3,2],[7,0],[9,-3],[8,-5],[5,-6],[5,-9],[3,-7],[4,-5],[11,-3],[20,-1],[9,1],[10,3],[4,2],[3,3],[4,3],[4,0],[5,0],[14,4],[10,-6],[13,-9],[12,-5],[21,2],[14,-2],[14,-5],[9,-6],[0,-6],[-5,-10],[4,-3],[6,0],[12,5],[8,0],[18,-8],[6,-1],[2,0],[13,0],[2,0],[3,-1],[1,0],[2,1],[1,3],[0,2],[0,1],[1,2],[0,2],[2,1],[1,0],[3,-2],[1,-1],[3,0]],[[7362,6762],[1,7],[-2,5],[-6,1],[-8,-2],[-2,-3],[1,-11],[2,-4],[0,-1],[-7,2],[-3,-1],[-2,-1],[-2,-2],[-4,-6],[2,-4],[6,-3],[6,0],[-4,-3],[-5,-2],[-4,-3],[0,-4],[4,-2],[5,1],[4,0],[3,-4],[-3,-6],[-15,-12],[-3,-9],[0,-5],[-1,-4],[-2,-3],[-5,-1],[-3,1],[-3,4],[-5,8],[-2,1],[-1,0],[-2,0],[-19,-1],[-2,-1],[-1,0],[-2,0],[-1,1],[-6,7],[-4,0],[-4,-4],[-5,-3],[-6,1],[-7,3],[-6,4],[-8,9],[-12,5],[-3,3],[-2,7],[-4,4],[-5,3],[-23,9],[-4,5],[-2,6],[-3,21],[-3,5],[-7,11],[-2,6],[0,9],[4,0],[5,-2],[3,2],[0,4],[-3,3],[-8,2],[-6,2],[0,3],[1,3],[-2,4],[-3,2],[-7,2],[-4,1],[-3,3],[-5,5],[-4,2],[-6,4],[-3,3],[-3,0],[-5,-2],[-5,-4],[-4,-6],[-3,-6],[0,-6],[7,-7],[10,-3],[9,-4],[3,-10],[2,-3],[3,-1],[3,1],[3,2],[-1,-8],[2,-2],[4,0],[4,-1],[2,-6],[-7,-5],[-15,-3],[-10,3],[-15,13],[-9,2],[-7,-4],[-5,-12],[-6,-2],[-5,3],[-4,5],[-2,6],[-3,5],[-12,4],[-29,-9],[-6,4],[3,2],[12,6],[5,3],[3,7],[-1,4],[-5,3],[-7,4],[-2,3],[0,6],[-3,1],[-3,1],[0,2],[0,3],[2,3],[-8,2],[-4,1],[-4,2],[-2,4],[-2,4],[-3,3],[-4,2],[-7,0],[-3,0],[-8,3],[-6,4],[-3,3],[-4,3],[-4,4],[-5,4],[-5,3],[-12,3],[-5,5],[-1,7],[1,7],[-1,7],[-3,1],[-4,-4],[-5,-6],[-2,-5],[-7,-22],[-5,-7],[-1,-5],[0,-6],[3,-4],[4,-2],[2,3],[1,8],[1,2],[2,0],[8,-3],[20,-4],[9,-4],[5,-7],[7,-19],[0,-9],[-7,1],[-3,0],[-3,-1],[-3,0],[-3,1],[-3,3],[-2,-2],[-2,-3],[-2,-3],[-16,-9],[-6,-5],[-5,-6],[-1,-5],[1,-13],[-3,-5],[-6,-4],[-20,-6],[-7,-1],[-4,-2],[-2,-2],[-2,-3],[-3,-2],[-12,-7],[-3,-4],[-3,-11],[-1,-2],[-1,-2],[0,-3],[2,-2],[2,-1],[2,-2],[0,-4],[-2,-7],[-9,-6],[-6,-11],[-7,-20],[-2,-3],[-1,-1],[-1,-1],[2,-16],[3,-5],[-1,-3],[0,-3],[6,-6],[1,-3],[2,-6],[5,-5],[6,1],[7,2],[6,3],[15,4],[11,-5],[21,-22],[25,-15],[9,-10],[1,-21],[5,-5],[13,-6],[3,-7],[10,-6],[2,-5],[4,-3],[7,-2],[14,0],[7,-3],[11,-7],[7,-1],[4,1],[3,3],[3,3],[4,3],[3,0],[3,0],[3,0],[3,1],[0,6],[10,-4],[3,-2],[5,-5],[4,-3],[3,-5],[0,-7],[-5,-13],[0,-2],[3,-2],[1,-3],[1,-3],[1,-4],[8,-9],[3,-2],[3,-1],[7,-1],[2,-1],[6,-6],[8,-1],[17,1],[2,-3],[1,-3],[-1,-4],[-2,-3],[-13,-9],[-3,-3],[0,-5],[1,-5],[-1,-3],[-7,-1],[5,-8],[-8,1],[-24,7],[-2,2],[-2,0],[-3,0],[-2,-3],[-4,-7],[-2,-2],[-21,2],[-20,7],[-11,2],[-12,0],[-3,-1],[-4,-4],[-3,-2],[-3,-1],[-2,0],[-2,1],[-9,2],[-11,4],[-5,2],[-12,-2],[-3,-6],[1,-20],[-3,-22],[-4,-11],[-8,-9],[-1,-9],[-4,-8],[-12,-15],[-6,-10],[-4,-2],[-5,0],[-15,4],[-4,0],[0,7],[-3,6],[-5,6],[-6,4],[-6,0],[-7,-2],[-17,-8],[0,-2],[2,-2],[2,-3],[4,-12],[1,-6],[-3,-5],[-5,-4],[-3,-6],[-4,0],[-3,-2],[-1,-4],[0,-5],[-3,-3],[-4,-1],[-4,-1],[-1,-16],[-5,-6],[-3,-6],[-1,-10],[6,-2],[6,-2],[3,-8],[5,-4],[1,-2],[0,-19],[1,-1],[1,-2],[3,-3],[3,-5],[1,-3],[10,-2],[89,-44],[26,-18],[8,-2],[22,-1],[17,-5],[7,0],[5,8],[4,8],[7,-2],[12,-6],[8,-10],[1,-14],[1,-1],[1,-6],[1,-1],[-1,-4],[-4,-5],[-1,-3],[-1,0],[-5,-2],[-7,-3],[-4,-3],[-2,-4],[0,-4],[2,-7],[-1,-4],[-2,-7],[0,-3],[2,-4],[6,-5],[1,-5],[8,-2],[0,-3],[-4,-5],[-4,-7],[3,-4],[2,-6],[1,-8],[-1,-6],[-4,-4],[-13,-12],[-4,-3],[-7,-2],[-7,1],[-7,0],[-5,-4],[-1,-4],[0,-3],[1,-3],[0,-3],[-2,-4],[-5,-8],[-2,-3],[0,-4],[3,-5],[0,-3],[-7,-32],[0,-4],[4,-1],[3,-1],[2,-1],[-1,-4],[-1,-3],[0,-2],[4,-4],[3,-1],[7,1],[3,-1],[5,-5],[8,-14],[6,-6],[10,-6],[3,-2],[5,-9],[5,2],[4,5],[4,4],[5,-4],[-1,-7],[-17,-42],[-8,-12],[-3,-7],[0,-7],[4,-7],[4,-4],[23,-7],[3,0],[3,1],[2,2],[3,2],[5,1],[5,-1],[24,-8],[3,-1],[3,-1],[10,0],[2,-1],[0,-3],[-2,-4],[-3,-3],[-9,-7],[-19,-19],[-5,-9],[0,-18],[-4,-9],[0,-7],[2,-4],[6,-8],[4,-5],[7,-17],[4,-4],[9,-3],[4,-4],[1,-4],[0,-7],[-2,-7],[-1,-5],[-4,-5],[-4,-4],[-2,-5],[1,-6],[4,-10],[1,-5],[1,-8],[5,-7],[3,-9],[1,-9],[-2,-8],[-7,-5],[10,-4],[4,-3],[4,-13],[6,-14],[1,-8],[0,-2],[-3,-5],[-1,-4],[0,-3],[4,-19],[2,-4],[5,-9],[-5,-3],[4,-8],[15,-18],[3,-6],[1,-7],[1,-8],[-6,-7],[-6,2],[2,-5],[-1,-4],[-2,-4],[-1,-5],[1,-5],[5,-9],[1,-5],[3,-22],[-2,-10],[-8,-5],[-5,2],[-3,0],[-2,-3],[1,-6],[-6,3],[-11,8],[-6,1],[-2,4],[-1,7],[-2,6],[-5,0],[-3,-6],[2,-8],[4,-7],[5,-3],[5,-2],[5,-3],[10,-7],[7,-11],[5,-28],[4,-13],[2,-2],[7,-7],[5,-11],[1,-1],[1,-14],[-2,-6],[-7,-3],[-3,1],[-3,1],[-2,2],[-1,3],[-1,2],[-2,-3],[-2,-5],[-1,-2],[-7,-1],[-8,5],[-14,10],[-13,2],[-2,1],[-2,3],[-1,3],[-3,27],[-2,6],[-3,0],[-1,-6],[-5,-11],[-1,-5],[2,-6],[5,-11],[0,-6],[-5,-5],[-7,-2],[-6,2],[-3,6],[6,5],[1,1],[0,3],[0,3],[-2,6],[-2,-7],[-2,-3],[-2,-2],[-4,0],[-1,-2],[-1,-3],[0,-3],[2,-7],[3,-5],[2,-5],[-2,-6],[-10,-4],[-12,1],[-7,7],[5,10],[-11,24],[-1,7],[6,40],[-2,5],[-1,5],[7,20],[0,19],[2,5],[4,3],[5,4],[4,4],[1,6],[-3,7],[-12,8],[-3,5],[2,5],[5,5],[11,10],[-6,-1],[-6,-2],[-5,-5],[-4,-4],[-2,-5],[-1,-6],[3,-4],[6,-2],[4,-4],[-2,-8],[-8,-13],[-1,-5],[-3,-5],[-4,-4],[-4,3],[-3,-1],[-5,0],[-4,1],[-2,4],[1,5],[1,3],[5,7],[3,7],[-1,4],[-1,5],[-1,11],[-2,7],[0,4],[6,15],[6,4],[3,8],[-1,6],[-7,1],[0,-2],[-1,-6],[-3,-5],[-1,0],[0,-2],[-4,-6],[-1,-7],[-3,-3],[-1,-3],[0,-2],[0,-8],[2,-7],[0,-4],[-2,-6],[-6,-8],[-1,-6],[1,-15],[-1,-6],[-11,-27],[-1,-7],[1,-21],[-1,-2],[6,1],[8,3],[7,0],[3,-10],[-1,-6],[-3,-7],[-3,-5],[-5,3],[-2,0],[2,-24],[-1,-9],[-6,4],[0,-18],[-2,-4],[-5,-1],[-4,2],[-3,5],[-2,-4],[-1,-4],[2,-4],[3,-3],[-10,-3],[-7,4],[-2,7],[3,9],[2,3],[2,1],[2,3],[1,4],[0,4],[1,5],[1,4],[2,2],[-6,19],[-2,10],[3,8],[7,11],[-1,10],[-5,10],[-7,9],[6,13],[0,8],[-6,5],[1,-7],[-2,-4],[-4,-4],[-2,-7],[0,-6],[6,-12],[1,-7],[-1,-4],[-2,-1],[-2,1],[-2,-2],[-3,-8],[-3,-6],[-2,-6],[0,-7],[1,-6],[5,-10],[1,-5],[-2,-6],[-4,-7],[-5,-3],[-5,-2],[-6,-4],[-5,0],[-4,11],[0,14],[3,10],[-4,-1],[-5,-3],[-3,-1],[-3,1],[-2,3],[-2,4],[-2,4],[-1,-3],[-1,-3],[1,-4],[6,-7],[2,-4],[0,-3],[-2,-5],[-3,-7],[-5,-4],[-4,2],[-2,8],[-1,39],[-1,6],[-3,6],[-5,6],[-4,0],[1,-8],[10,-34],[1,-8],[-1,-4],[-4,-7],[0,-5],[2,-3],[4,-3],[1,-3],[1,-4],[-1,-1],[-2,0],[-4,-3],[-2,-1],[-5,-1],[-4,1],[-2,1],[-1,7],[-3,8],[-4,4],[-6,-4],[-6,14],[-3,8],[0,7],[3,6],[5,8],[2,7],[-3,10],[3,5],[-2,6],[-17,28],[1,4],[1,3],[-5,18],[1,6],[3,5],[2,4],[15,18],[5,9],[-3,7],[-3,18],[-2,6],[-11,6],[-16,5],[-13,6],[-1,8],[-6,-4],[-6,-1],[-6,1],[-6,4],[-8,9],[-4,6],[-2,5],[-1,7],[-5,13],[-1,6],[0,8],[-2,6],[-4,4],[-8,0],[0,-2],[6,-7],[4,-15],[4,-27],[2,-5],[4,-6],[9,-11],[6,-3],[6,-2],[11,0],[13,-3],[13,-4],[9,-8],[5,-14],[-4,-9],[-8,-11],[-10,-8],[-9,-5],[-12,0],[-2,-2],[1,-3],[1,-4],[1,-4],[-2,-3],[-5,-6],[-16,-36],[-5,-6],[-4,-3],[-4,-1],[-13,-10],[-2,0],[-1,-1],[-2,-2],[0,-4],[-1,-1],[-8,-8],[-12,-8],[-26,-13],[-18,-12],[-7,-2],[-14,0],[-7,0],[-50,-13]],[[6721,6423],[12,12],[7,10],[0,4],[-3,5],[-3,7],[-2,6],[-1,3],[-2,2],[-3,4],[-1,1],[-1,0],[-1,0],[-2,-1],[-2,0],[-1,0],[-1,1],[0,1],[-2,4],[-1,2],[-1,1],[-1,1],[-3,1],[-1,1],[-1,1],[1,1],[1,2],[4,2],[1,2],[1,1],[1,1],[0,1],[0,2],[6,3],[11,4],[11,5],[4,2],[3,3],[2,5],[1,0],[2,1],[13,4],[7,3],[4,4],[7,-2],[4,-4],[1,-1],[0,-3],[5,-2],[21,-3],[-1,5],[0,5],[0,1],[-2,2],[-3,3],[-1,1],[-1,2],[0,3],[3,10],[2,10],[0,3],[-1,2],[-2,6],[-1,8],[-1,4],[-4,4],[-9,7],[-22,9],[-3,5],[-7,5],[-3,3],[-2,4],[-2,6],[-2,4],[-1,2],[-2,1],[-4,7],[-4,2],[-10,5],[-6,4],[-2,1],[-1,2],[0,1],[-1,1],[0,2],[-2,3],[0,1],[-1,2],[1,2],[1,2],[3,1],[3,1],[2,1],[1,2],[2,10],[1,3],[1,4],[0,5],[0,3],[3,4],[10,10],[23,17],[12,14],[3,2],[2,1],[3,0],[2,-1],[2,1],[4,1],[7,7],[3,2],[7,3],[4,3],[7,6],[7,5],[12,14],[4,4],[5,3],[10,3],[3,2],[11,9],[4,2],[5,1],[5,0],[2,1],[1,0],[1,2],[0,3],[0,3],[-1,3],[-3,2],[-4,3],[-7,3],[-2,1],[0,3],[1,2],[2,2],[4,2],[1,1],[2,2],[-1,2],[-3,3],[-12,11],[-3,2],[-4,1],[-2,2],[-4,2],[-1,2],[0,4],[4,9],[-1,3],[-3,1],[-15,-5],[-7,-2],[-3,0],[-6,2],[-6,1]],[[6825,6884],[5,15],[15,28],[6,15],[1,7],[1,6],[0,7],[-3,14],[-2,15],[-1,6],[-3,5],[-8,11],[-3,5],[-5,12],[-7,12],[-7,9],[-4,3],[-5,3],[-7,3],[-6,13],[-5,4],[-2,3],[0,3],[0,3],[5,10],[1,24],[6,11]],[[6797,7131],[6,-2],[5,-5],[11,-7],[3,-3],[1,-4],[0,-7],[1,-3],[2,-3],[4,-3],[6,-1],[10,-1],[15,2],[14,-2],[35,-13],[3,-3],[1,-1],[3,-1],[5,0],[11,2],[7,3],[8,5],[24,22],[9,0],[24,-3],[18,2],[2,-1],[7,-6],[9,-3],[5,1]],[[5376,7165],[1,-1],[2,4],[2,1],[3,1],[0,3],[-1,4],[-1,3],[-10,10],[-2,5],[6,3],[16,1],[8,2],[4,-1],[14,-3],[11,1],[7,4],[18,20],[6,2],[6,-1],[2,-6],[3,-3],[4,-2],[8,-3],[3,-4],[4,-8],[3,-1],[10,2],[5,-4],[3,-6],[7,-8],[7,-5],[99,-16],[10,-7],[9,-11],[5,-13],[3,-13],[1,-13],[-2,-14],[-3,-8],[-5,-8],[-3,-7],[2,-8],[4,-3],[42,-10],[3,0],[5,3],[6,2],[5,-1],[4,-5],[8,-5],[17,-5],[8,-4],[4,-7],[2,-7],[3,-6],[8,-4],[4,-1],[5,-1],[6,-2],[-1,-6],[1,-4],[9,-1],[19,7],[8,1],[13,-5],[1,-11],[0,-12],[10,-9],[32,-8],[5,0],[12,3],[5,4],[1,1],[5,5],[6,5],[5,-1],[7,-1],[6,2],[12,6],[15,7],[27,10],[4,-1],[27,-14],[5,-5],[2,-12],[-2,-26],[3,-12],[5,-6],[19,-13],[3,-1],[3,1],[4,1],[2,-2],[1,-3],[0,-3],[1,-3],[2,-2],[6,1],[7,4],[23,19],[6,3],[8,1],[13,3],[10,-3],[24,-13],[1,-2],[2,-1],[8,1],[1,0],[2,-1],[5,-1],[2,-1],[2,-2],[2,-1],[4,-1],[2,1],[8,4],[13,4],[7,1],[6,-1],[2,-2],[0,-5],[3,-2],[2,-1],[8,1],[3,0],[10,-3],[21,-11],[10,-3],[7,-2],[5,-3],[5,-3],[5,-5],[7,-4],[23,-10],[24,-13],[6,-1],[4,2],[2,4],[2,4],[5,1],[12,-5],[3,0],[9,2],[8,5],[7,7],[3,8],[11,5],[10,4],[13,4],[4,3],[10,9],[5,4],[4,0],[1,-6],[0,-6],[4,-17],[4,-10],[5,-12],[8,-10],[10,-3],[18,2],[11,3],[3,-4],[3,-5],[3,-5],[4,-2],[15,-6],[4,-1],[5,3],[6,13],[4,5],[9,5],[11,3],[12,1],[10,-2],[25,-13],[12,-3],[12,5],[9,6],[4,3],[7,2],[6,-3],[4,-3],[6,-1],[5,2],[2,6],[3,7],[4,2],[6,-2],[6,-3],[6,0],[11,8],[6,1],[0,-1],[8,-6],[1,0],[2,-3],[2,-6],[2,-3],[5,-5],[11,-6],[5,-4],[10,1],[13,13],[11,16],[2,15],[-1,4],[0,4],[3,7]],[[6797,7131],[8,17],[2,9],[-1,3],[-4,7],[-1,4],[-1,5],[1,4],[3,8],[1,2],[2,2],[2,2],[0,3],[0,1],[-3,3],[-1,2],[-2,6],[0,4],[0,3],[9,18],[21,33],[8,29],[5,9],[4,9],[-2,14],[4,6],[-1,4],[-2,2],[-5,2],[-8,2],[-5,6],[-2,9],[0,8],[6,7],[3,1],[9,-1],[4,0],[4,1],[8,3],[62,8],[7,4],[19,13],[7,2],[9,-3],[5,4],[5,7],[7,6],[14,10],[6,0],[7,-8],[7,-5],[20,-2],[9,-3],[15,-9],[8,-6],[5,-6],[1,-6],[-4,-11],[1,-6],[2,-4],[9,-8],[3,-6],[1,-6],[-1,-5],[-16,-66],[-8,-11],[-5,-13],[-7,-9],[-2,-5],[0,-5],[5,-7],[0,-5],[-1,-11],[2,-10],[5,-10],[7,-7],[5,-3],[4,-2],[3,-2],[8,-9],[4,-3],[10,-6],[-3,-10],[-3,-2],[-5,-4],[-21,-4],[-8,-6],[-8,-10],[-5,-11],[-3,-10],[1,-1]],[[4290,5080],[6,16],[3,13],[5,13],[1,9],[-2,30],[1,6],[1,5],[2,34],[4,9],[5,6],[11,1],[6,5],[6,10],[5,15],[-2,21],[1,15],[3,10],[14,27],[7,10],[5,4],[5,1],[5,-2],[10,-14],[3,-1],[2,0],[3,4],[1,5],[-2,5],[-4,6],[0,2],[2,2],[5,1],[3,2],[2,4],[1,19],[2,6],[5,5],[3,3],[14,8],[8,13],[1,6],[1,9],[-1,9],[1,13],[2,7],[12,15],[5,5],[4,2],[3,-1],[2,-3],[2,-7],[4,-2],[4,-1],[8,3],[7,6],[5,1],[9,2],[9,6],[4,1],[5,-2],[4,-4],[7,-12],[5,-3],[5,1],[5,3],[4,4],[6,4],[5,3],[7,7],[9,6],[7,1],[7,3],[8,1],[7,3],[6,3],[3,3],[0,5],[2,6],[5,6],[20,13],[8,2],[5,4],[0,7],[-2,7],[0,5],[2,3],[6,6],[0,13],[-2,11],[0,8],[4,6],[6,3],[13,4],[7,3],[14,11],[11,11],[2,6],[-4,13],[0,6],[4,9],[7,4],[19,6],[17,10],[7,1],[7,0],[6,-2],[4,6],[5,12],[1,7],[2,14],[9,28],[-1,7],[-5,6],[-13,8],[-3,4],[-4,2],[-6,1],[-18,-2],[-3,1],[-2,3],[-1,4],[-3,2],[-4,0],[-5,2],[-6,7],[-8,17],[-8,9],[-7,4],[-17,1],[-19,8],[-8,2],[-6,2],[-6,0],[-3,-2],[-7,-7],[-10,-3],[-9,-7],[-5,-2],[-5,2],[-3,4],[-2,6],[-5,7],[-2,4],[-1,4],[1,2],[2,2],[3,3],[2,4],[1,12],[3,3],[7,3],[3,2],[5,7],[3,3],[2,4],[0,6],[-1,6],[-6,8],[-8,21],[-5,6],[-1,3],[2,4],[0,5],[-3,3],[7,6],[14,0],[7,-5],[15,-16],[11,-8],[10,-2],[10,0],[8,3],[17,10],[9,3],[24,-2],[8,-3],[16,-9],[11,-1],[33,1],[13,-5],[7,-1],[52,0],[29,-4],[11,1],[4,2],[3,4],[5,4],[15,6],[11,5],[3,3],[1,4],[0,5],[1,5],[4,4],[8,3],[9,1],[6,2],[11,5],[3,4],[2,4],[0,4],[1,4],[0,2],[5,7]],[[2048,5289],[0,25],[5,13],[-1,3],[-2,5],[-4,3],[-2,3],[-1,4],[-1,8],[-1,5],[-4,8],[-3,3],[-5,5],[-2,3],[-1,3],[1,11],[-1,4],[-2,7],[-1,6],[2,9],[2,5],[2,3],[2,1],[2,1],[2,0],[3,-1],[2,-2],[5,-5],[3,-1],[3,-1],[4,0],[11,2],[5,2],[6,3],[4,3],[3,3],[2,3],[2,3],[0,4],[0,3],[-4,3],[-4,2],[-9,2],[-11,0],[-13,-2],[-4,0],[-5,2],[-6,4],[-15,14],[-4,4],[0,4],[3,7],[3,2],[2,1],[3,1],[2,0],[19,-6],[4,0],[3,0],[4,2],[3,2],[13,14],[26,18],[2,1],[4,1],[9,0],[4,0],[3,1],[4,3],[3,2],[3,3],[3,4],[28,53],[0,6],[-2,7],[-9,11],[-5,2],[-4,1],[-2,-2],[-3,-1],[-3,0],[-2,0],[-2,1],[-2,3],[-1,5],[-4,31],[-7,17]],[[4005,1473],[-2,-11],[2,-49]],[[4005,1413],[-2,0],[-9,4],[-1,2],[-1,2],[-4,2],[-1,3],[1,2],[0,1],[0,1],[2,3],[0,2],[-3,1],[-1,0],[-2,0],[-4,-1],[-1,1],[1,2],[-1,2],[-1,1],[-3,0],[-3,-2],[-3,1],[-1,3],[-2,2],[-4,0],[-3,1],[-2,3],[0,3],[3,3],[1,2],[-3,1],[-2,2],[1,3],[5,0],[4,-4],[2,0],[1,1],[1,1],[0,5],[-2,3],[-2,1],[-1,1],[0,3],[3,1],[7,-2],[6,-3],[3,0],[2,1],[5,4],[7,-1],[7,-1]],[[4006,1812],[-2,-8],[-8,-19],[-3,-16]],[[3993,1769],[-3,0],[-9,0],[-7,2],[-2,0],[-1,1],[-2,0],[-2,-1],[-1,0],[-2,1],[-3,4],[-1,1],[-2,1],[-2,0],[-1,2],[0,2],[2,3],[1,3],[1,3],[0,4],[-1,3],[-1,1],[-3,1],[-1,1],[0,2],[0,2],[0,3],[0,1],[-1,2],[-7,6],[0,2],[0,2],[2,3],[3,3],[0,1],[1,0],[1,0],[2,-1],[3,-3],[2,-3],[3,-2],[3,-1],[11,2],[2,0],[2,-2],[0,-2],[-1,-2],[-1,-1],[-5,-5],[0,-2],[0,-2],[2,-1],[3,-2],[1,-1],[2,-2],[3,-1],[2,2],[7,6],[5,4],[8,3]],[[2451,1842],[-14,-10],[-1,-5],[5,-11],[-11,12],[-2,2],[-2,1],[-2,2],[-1,1],[-1,1]],[[4156,2359],[7,-17],[2,-13],[-3,0],[-9,25]],[[4146,2338],[2,0],[-1,-6],[4,-4],[7,-3],[4,-6],[2,3],[1,2],[4,1],[3,-6],[3,-13],[1,-9],[0,-10],[-3,-18],[-1,-9],[-4,1],[-1,1],[-1,-6],[-1,-6],[1,1],[6,1],[-1,-8],[-3,-6],[-3,-6],[-3,-6],[1,-4],[2,-10],[-2,-3],[-6,-7],[-2,-3],[-1,-14],[-4,-25],[-2,-42],[-4,-25],[-7,-18],[-1,-13],[-3,-5],[-6,-10],[-2,-6],[-4,-16],[-1,-7],[-1,-5],[-8,-21],[-12,-20],[-1,-5],[-8,-14],[-3,-3],[-8,-5],[-1,-1],[-1,-1],[-11,-19],[-7,-7],[-18,-10],[-3,-4],[3,-1],[7,3],[11,7],[-19,-31],[-5,-5],[-2,-3],[-11,-22],[-9,-11],[-3,-5],[0,-4],[0,-11],[-1,-2],[-3,-5],[0,-1]],[[3993,1769],[-3,-12],[-3,-3],[-3,-7],[-6,-33],[-1,-14],[-4,-13],[0,-7],[1,-14],[8,-25],[2,-13],[3,0],[1,3],[1,2],[-1,3],[-1,1],[5,0],[3,-3],[2,-18],[-1,-4],[-3,-1],[-10,0],[-2,1],[-2,0],[-4,-1],[-3,-1],[-3,-3],[-20,-19],[-2,-5],[2,0],[5,2],[15,11],[4,2],[2,6],[6,2],[7,-1],[9,-5],[2,0],[1,-1],[1,-28],[7,-36],[-1,-53],[-2,-9]],[[4005,1413],[1,-18],[0,-57],[3,-14],[2,-60],[-3,-30],[-1,-4],[-6,-1],[-7,-2],[-7,-1],[-5,2],[0,7],[-8,4],[-42,7],[-4,-1],[-3,-5],[6,0],[5,0],[6,-1],[5,-2],[3,-1],[3,-3],[3,-1],[9,0],[10,-2],[5,-3],[0,-4],[-5,-1],[-61,13],[-6,0],[-2,1],[-2,1],[0,4],[2,1],[3,0],[3,0],[10,4],[1,3],[-7,2],[-6,-2],[-14,1],[1,-3],[0,-3],[-7,-2],[-17,-3],[-8,1],[-9,4],[-5,1],[-4,-2],[-7,-6],[-20,-12],[-7,-5],[-5,-7],[0,-3],[0,-5],[-1,-4],[-2,-2],[-5,-1],[-3,-4],[-1,-4],[1,-5],[2,-24],[3,-10],[9,-7],[-13,-8],[-14,-14],[-20,-28],[-7,-14],[-6,-7],[-1,-2],[-3,-8],[-5,-7],[-13,-12],[-20,-28],[-1,-3],[0,-3],[-1,-4],[-1,-2],[-4,-3],[-2,-2],[-3,-5],[-3,-7],[-2,-8],[-2,-16],[-4,-14],[0,-7],[6,-13],[9,-11],[28,-24],[12,-6],[14,-3],[46,-1],[8,3],[8,6],[8,4],[7,-3],[2,-3],[-2,-3],[-2,-3],[-1,-4],[1,-4],[2,-2],[1,-2],[1,-2],[2,-3],[5,-5],[24,-18],[5,-6],[-4,-2],[-6,2],[-21,19],[-24,13],[-20,3],[-6,3],[-5,0],[-6,2],[-6,0],[-12,-6],[-11,1],[-4,-2],[-9,4],[-12,3],[-13,2],[-11,-1],[-2,-2],[-7,-6],[-4,0],[-2,0],[-2,0],[-4,0],[-11,-1],[-6,-2],[-10,-5],[-13,-4],[-5,-3],[-4,-3],[-3,-3],[-5,-2],[-18,-1],[-5,-2],[-2,-6],[-2,-3],[-5,-3],[-5,-1],[-46,-6],[-12,-2],[-13,-6],[-12,-8],[-47,-39],[-7,-9],[-12,-22],[-2,-5],[-1,-23],[-2,-8],[-2,-7],[4,4],[5,1],[4,1],[3,6],[2,-7],[-4,-5],[-6,-3],[-6,-4],[-2,-2],[-3,-10],[-5,-6],[-1,-4],[2,-4],[-10,0],[7,-11],[3,-11],[-5,-37],[-2,-4],[-3,-4],[-9,-9],[-3,-2],[-5,-21],[-3,-3],[-6,-1],[-13,-6],[-66,-40],[-5,-5],[-8,-12],[-6,-2],[-37,-7],[-16,-5],[-12,-9],[1,-11],[-18,-2],[-21,4],[-46,14],[-3,1],[-4,5],[-3,3],[-8,5],[-8,2],[-5,3],[-33,31],[-6,4]],[[1562,4635],[1,4],[6,16],[2,15],[1,4],[5,7],[1,4],[0,1],[-2,0],[-1,0],[-1,2],[0,7],[0,1],[2,11],[3,6],[4,5],[3,7],[1,7],[2,0],[4,3],[4,3],[2,3],[1,1]],[[1600,4742],[7,-1],[9,1],[6,4],[0,10],[-1,7],[-6,7],[-5,3]],[[1610,4773],[11,15],[2,7],[1,7],[1,8],[0,4],[-2,7],[0,4],[1,3],[5,5],[1,4],[1,16],[-1,7],[-3,4],[15,10],[2,0],[-1,4],[-3,2],[-3,1],[-3,3],[0,3],[2,2],[0,3],[-2,4],[-6,-8],[-5,3],[-2,7],[3,8],[4,6],[-2,0],[-5,-1],[-2,-1],[-13,-9],[3,5],[3,12],[4,4],[-10,11],[7,7],[10,4],[1,8],[-4,-1],[-8,-2],[-7,-1],[-4,4],[0,3],[-2,2],[-3,2],[-3,1],[-4,0],[-2,1],[-3,5],[-2,5],[6,1],[13,-3],[8,2],[2,3],[-12,26],[-2,3],[-4,-1],[-15,-6],[-1,1],[-2,2],[-1,1],[-2,-2],[0,-2],[-1,-6],[-1,-2],[-11,-4],[2,11],[5,8],[3,6],[-5,6],[-2,-3],[-7,1],[-4,-2],[-1,-3],[0,-4],[0,-7],[-1,-5],[-1,-1],[-3,1],[-7,-5],[-3,1],[-5,6],[0,5],[5,6],[22,15],[6,5],[4,2],[4,0],[-4,3],[-12,4],[-3,3],[-2,4],[-5,2],[-4,3],[0,7],[-7,-5],[-3,-2],[-4,4],[-1,4],[-2,11],[-3,8],[0,3],[1,3],[4,1],[12,2],[3,2],[-3,3],[-5,-1],[-10,-2],[-5,1],[-4,4],[-1,3],[3,1],[21,6],[13,8],[1,1],[18,12],[6,-5],[2,4],[-1,5],[-4,2],[-18,-6],[-7,-3],[-18,-13],[-9,-1],[2,5],[10,19],[5,4],[6,3],[13,12],[5,2],[7,2],[9,4],[7,6],[6,5],[7,13],[4,4],[4,0],[9,-3],[4,0],[6,1],[16,7],[10,7],[20,7],[21,10],[8,2],[3,1],[3,3],[2,4],[-2,3],[-2,0],[-12,-7],[-13,-4],[-2,-1],[-6,-5],[-4,-1],[-7,-2],[-14,-7],[-8,-1],[-15,3],[-9,0],[-6,-2],[-7,-5],[-7,0],[-15,4],[-7,1],[-20,-4],[-8,1],[-6,2],[-6,0],[-16,-5],[-7,-2],[-5,3],[-2,7],[1,7],[6,13],[2,8],[2,23],[2,3],[6,3],[5,8],[6,15],[6,5],[6,1],[13,-1],[4,3],[2,7],[2,5],[7,2],[0,2],[-3,1],[-2,0],[-2,0],[-2,-1],[-2,-1],[-2,-3],[0,-2],[-1,-1],[-24,-2],[-4,-4],[-3,-4],[-7,-6],[-8,-4],[-5,-2],[-4,4],[-9,14],[-2,5],[1,6],[5,14],[1,7],[0,4],[0,4],[0,4],[3,7],[1,4],[1,7],[2,6],[6,7],[6,6],[5,4],[8,2],[7,0],[6,-3],[6,-5],[4,-2],[3,0],[3,1],[3,0],[4,-1],[3,-2],[7,-5],[14,19],[8,6],[12,2],[6,-2],[5,-5],[6,-3],[6,4],[2,5],[1,6],[-2,6],[-4,3],[-2,-4],[-5,-2],[-6,0],[-5,3],[-5,2],[-7,-2],[-7,-2],[-4,-3],[-10,-5],[-11,2],[-23,9],[-4,0],[-4,-1],[-3,0],[-7,4],[-3,1],[-8,1],[-7,-2],[-11,-11],[-7,-4],[-7,-2],[-5,-1],[-3,2],[-1,3],[5,3],[-1,3],[-6,1],[-5,-4],[-7,-3],[-7,3],[-2,4],[-2,8],[0,8],[3,4],[5,3],[1,7],[-3,5],[-9,-4],[-4,-4],[-4,-7],[-3,-7],[-1,-7],[-3,-8],[-6,-1],[-8,1],[-4,0],[-4,6],[1,3],[-1,3],[-8,2],[-6,1],[-5,-1],[-2,-3],[1,-6],[-15,2],[-4,-1],[6,-6],[8,-3],[6,3],[11,10],[2,-5],[-1,-3],[-2,-3],[-1,-5],[2,-2],[10,-4],[13,1],[3,-15],[-3,-37],[-3,-6],[-1,-4],[-1,1],[-3,-3],[-3,-5],[0,-1],[-6,-5],[-3,-2],[-4,0],[-6,1],[-1,-1],[-1,-5],[-3,0],[-2,5],[-1,-1],[-2,-4],[-1,-2],[-2,-2],[-3,-2],[-3,-1],[-2,4],[-2,3],[-6,4],[-7,2],[-6,-1],[8,-5],[3,-3],[-2,-4],[-3,-1],[-13,3],[2,-2],[8,-5],[0,-2],[-1,-3],[-2,0],[-3,1],[-5,3],[-6,-1],[-6,-2],[-3,-3],[20,-7],[6,0],[12,2],[5,1],[-3,-3],[0,-3],[4,-2],[-2,-2],[6,-3],[-1,-4],[-2,-4],[0,-5],[3,-4],[-3,-1],[-10,3],[-3,3],[-4,5],[-5,4],[-7,5],[-6,1],[-3,-6],[1,-2],[3,-1],[3,-1],[3,0],[2,-1],[7,-11],[-7,-2],[-8,2],[-20,8],[-2,-1],[-1,-5],[0,-10],[0,-4],[2,-4],[2,1],[1,1],[4,2],[0,-2],[0,-5],[0,-2],[12,4],[6,1],[5,-2],[5,-3],[5,1],[17,6],[1,-1],[1,-5],[1,-4],[7,-3],[1,-3],[1,0],[4,-12],[2,-3],[1,-2],[3,-1],[3,-2],[4,0],[4,0],[3,0],[2,-7],[2,-2],[3,-2],[1,-2],[0,-4],[1,-3],[0,-3],[-1,-3],[-1,-2],[-5,-4],[-1,-1],[-11,-40],[-8,-13],[-18,-18],[-3,-7],[-2,-4],[-13,-13],[-3,-3],[1,-3],[1,-3],[-1,-3],[-4,0],[2,-5],[-1,-3],[-2,-3],[-1,-1],[1,-4],[4,-7],[0,-6],[-5,-5],[-2,-1],[-3,-1],[-3,-1],[-2,-3],[-2,-2],[-22,-11],[-7,-1],[-15,-1],[-42,-24],[-6,-5],[-8,-5],[-7,-2],[-5,1],[-4,1],[-12,-7],[-14,-6],[-20,-13],[-11,-2],[2,5],[2,2],[2,2],[-6,-2],[-5,-3],[-15,-12],[-3,-4],[-1,-6],[-6,-5],[-29,-9],[-20,-4],[-61,-29],[-8,1],[-3,-3],[-5,1],[-4,-2],[-4,-4],[-3,-2],[-6,0],[-7,2],[-6,-1],[0,-2]],[[980,4866],[-3,1],[-3,0],[-3,0],[-2,-2],[-1,-3],[0,-3],[0,-2]],[[968,4857],[-45,-3],[-7,0],[-6,2],[-6,5],[-4,2],[-3,-1],[-4,-2],[-4,0],[-4,1],[-11,8],[-53,22],[-20,12],[-7,2],[-4,2],[-12,13],[-6,4],[-21,8],[-13,11],[-12,8],[-39,34],[-32,25],[-30,36],[-1,3],[-3,4],[-16,14],[-23,26],[-10,15],[-2,12],[-7,1],[-6,3],[-5,4],[-43,44],[-21,12],[-6,5],[-11,14],[-7,5],[-7,11],[-11,5],[-7,5],[-10,12],[-2,6],[1,10],[-1,6],[-8,-8],[-4,-1],[-7,4],[-31,29],[-11,7],[-5,4],[-16,22],[-11,7],[-6,5],[-3,8],[-15,20],[-13,10],[-6,6],[-5,11],[-9,14],[-3,7],[0,8],[3,6],[3,5],[1,6],[1,7],[2,6],[3,5],[4,4],[5,5],[13,7],[9,6],[3,0],[1,-3],[-1,-5],[-2,-3],[-7,-3],[-2,-4],[4,-8],[4,-3],[5,-1],[3,1],[6,3],[3,1],[3,0],[3,-1],[2,-1],[3,1],[5,5],[3,2],[4,0],[4,-4],[2,-6],[-9,-11],[2,-6],[-6,-8],[2,-6],[5,-6],[8,-4],[0,-2],[25,3],[17,8],[4,6],[4,2],[26,0],[12,3],[3,1],[2,2],[5,7],[1,2],[2,1],[2,0],[2,1],[2,5],[-1,4],[-2,4],[-1,5],[1,6],[2,1],[3,-1],[3,2],[3,0],[4,-14],[0,-7],[-2,-5],[5,-3],[11,-2],[5,-3],[0,3],[1,2],[4,5],[3,-3],[3,2],[1,3],[2,2],[1,2],[2,1],[1,2],[2,0],[2,0],[5,-2],[1,0],[4,5],[5,16],[3,5],[3,-2],[16,-17],[2,-2],[4,1],[2,3],[2,4],[2,4],[3,4],[3,1],[3,-1],[5,0],[7,3],[7,5],[19,17],[4,2],[0,-1],[8,1],[2,0],[6,4],[14,2],[29,-4],[11,5],[4,5],[6,13],[10,12],[11,20],[18,25],[1,3],[-1,9],[1,4],[1,1],[6,6],[11,20],[4,4],[6,2],[11,13],[6,4],[3,0],[4,-1],[4,0],[4,2],[2,3],[3,6],[2,3],[3,6],[0,9],[-1,8],[-3,6],[-5,5],[-6,7],[-6,2],[-2,-5],[-3,-3],[-14,-7],[-4,-6],[0,-3],[1,-5],[1,-4],[2,-4],[-3,-8],[0,-3],[1,-3],[-1,-5],[0,-5],[-1,-3],[-2,-1],[-3,-1],[-7,0],[-2,-1],[-2,-1],[-2,-1],[-2,2],[-2,1],[-2,1],[-1,1],[-2,0],[-2,0],[-2,-2],[-2,0],[-1,2],[-2,2],[-1,1],[-7,2],[-4,4],[-3,6],[-6,4],[0,-9],[-4,-5],[-6,-2],[-9,0],[-2,-1],[-1,-1],[-2,0],[-3,3],[-1,2],[0,1],[-1,0],[-3,1],[-3,1],[-2,2],[1,3],[1,3],[-7,-12],[4,-2],[4,-4],[1,-4],[-6,-2],[-20,-2],[-22,-9],[-19,-2],[-19,-7],[-11,-1],[-7,-2],[-9,-5],[-9,-6],[-7,-6],[-10,-19],[-5,-3],[-7,1],[-14,4],[-23,0],[-4,1],[-6,5],[-5,1],[-11,0],[-4,0],[-3,1],[-3,2],[-2,1],[-1,1],[-17,3],[-6,3],[-11,2],[-12,5],[-34,3],[-13,4],[-22,12],[-33,22],[-60,24],[-60,39],[-10,8],[-2,1],[-1,2],[0,3],[-1,3],[-9,4],[-5,5],[-3,6],[-1,6],[1,-1],[3,-4],[4,7],[1,3],[0,4],[-6,-3],[-9,-1],[-9,2],[-4,6],[7,13],[2,1],[11,1],[3,1],[-2,3],[-3,2],[-5,2],[-3,1],[-1,2],[-1,2],[-1,2],[-2,0],[-2,-1],[-2,-1],[-1,-1],[-4,2],[-3,3],[-2,2],[0,4],[0,4],[2,3],[3,1],[4,0],[-2,4],[-2,1],[-2,0],[-3,-2],[-4,1],[-2,-1],[-2,-3],[-5,-2],[-5,1],[-1,4],[1,5],[1,4],[-4,-3],[-4,-1],[-4,1],[-2,3],[3,7],[5,8],[6,6],[7,3],[-1,4],[-2,-1],[-3,-1],[-3,1],[-2,1],[-3,5],[-2,3],[1,-6],[2,-5],[0,-5],[-6,-3],[-6,0],[-2,5],[2,14],[-2,17],[1,8],[6,4],[15,-5],[7,0],[1,7],[-3,1],[-3,0],[-3,0],[-1,5],[2,1],[6,2],[6,4],[6,0],[4,1],[1,2],[6,8],[10,10],[6,5],[12,4],[6,13],[5,6],[4,1],[12,-1],[3,1],[7,5],[4,1],[4,2],[18,13],[-5,2],[-9,-4],[-5,2],[-9,-9],[-7,-4],[-9,-2],[-13,0],[-7,-1],[-4,-3],[-5,-10],[-3,-5],[-4,-2],[-11,-3],[-6,-2],[-4,-3],[-6,-3],[-12,-2],[-8,-5],[-8,-3],[-5,-5],[-24,-27],[3,-2],[1,-2],[-2,-3],[-2,-2],[-5,-4],[-3,0],[-4,1],[-4,1],[-22,-1],[-17,2],[-8,2],[-5,4],[2,7],[2,0],[7,0],[1,1],[1,5],[1,1],[5,2],[4,2],[3,-2],[5,-4],[4,4],[6,1],[4,2],[2,7],[-7,-4],[-7,0],[-5,2],[-6,5],[-3,7],[-1,6],[1,7],[0,8],[-7,-7],[-4,-3],[-1,4],[1,5],[3,9],[1,10],[1,3],[1,2],[8,12],[3,2],[6,2],[2,2],[1,0],[3,-1],[2,0],[1,2],[-1,1],[-1,1],[-1,1],[1,2],[-1,3],[1,3],[3,3],[4,0],[1,-1],[1,-3],[2,-3],[5,-2],[4,2],[4,4],[4,4],[-1,3],[-1,3],[0,3],[4,1],[2,-1],[2,-3],[0,-3],[0,-3],[11,7],[16,3],[39,-1],[34,0],[27,0],[0,48],[0,37],[0,28],[8,14],[17,-1],[5,-7],[2,-20],[7,-5],[3,3],[11,18],[1,3],[1,3],[2,2],[4,0],[3,-1],[3,-2],[3,-3],[7,-11],[4,-5],[7,0],[9,3],[14,7],[6,1],[9,-2],[19,-9],[6,-1],[14,2],[25,9],[97,-3],[10,-4],[27,-26],[15,-7],[18,-2],[70,0],[15,4],[12,9],[4,7],[8,21],[4,6],[4,2],[12,1],[20,6],[7,1],[6,1],[13,8],[7,3],[18,1],[6,2],[16,11],[36,8],[14,-1],[4,-8],[-2,-3],[-6,-4],[-2,-2],[0,-4],[3,-12],[2,-14],[3,-5],[5,-5],[13,-6],[46,-4],[7,2],[13,6],[7,3],[6,1],[2,2],[-5,6],[-1,6],[5,7],[21,13],[7,2],[6,-1],[8,-3],[6,0],[4,3],[2,3],[4,4],[17,6],[3,3],[-3,9],[-12,3],[-13,2],[-8,5],[-1,2],[-1,3],[0,2],[1,3],[1,7],[1,2],[0,3],[0,2],[-1,2],[-7,5],[-1,10],[3,11],[5,8],[22,11],[7,4],[-2,4]],[[2035,2832],[-3,2],[-1,2],[-14,7],[-2,5],[0,5],[2,11],[-2,5],[-4,2],[-4,2],[-4,2],[-8,16],[-3,2],[-18,5],[4,10],[2,5],[3,3],[7,5],[1,3],[-3,5],[-2,-2],[-19,63],[-3,4],[-4,2],[-8,0],[-7,2],[-6,4],[-9,11],[19,-2],[3,1],[4,1],[4,-2],[5,-2],[5,4],[11,-5],[4,-3],[3,-7],[2,1],[1,0],[1,1],[1,1],[-3,2],[-7,11],[-4,2],[-14,6],[-2,0],[-5,0],[-2,0],[-2,1],[-2,3],[-2,1],[-12,1],[-3,-1],[-1,4],[2,5],[3,5],[3,3],[3,1],[15,4],[-3,1],[-1,2],[0,2],[2,2],[0,2],[-23,-13],[-4,-3],[-7,2],[-5,5],[2,9],[-5,8],[-2,4],[0,5],[0,4],[2,2],[1,1],[1,3],[4,6],[9,3],[18,4],[0,3],[-13,0],[-6,-1],[-2,-3],[-3,-1],[-12,-8],[-2,-2],[-3,3],[-4,6],[-3,6],[-3,11],[-1,4],[0,3],[5,3]],[[8191,7017],[2,6],[-6,20],[-6,11],[-17,15],[-4,12],[0,6],[1,6],[2,6],[2,5],[1,2],[1,1],[4,4],[2,3],[1,3],[1,6],[2,4],[4,5],[11,8],[2,6],[-1,4],[-30,50],[-8,9],[-4,-2],[-10,-6],[-4,-2],[-13,1],[-9,-2],[-26,-8],[-11,-1],[-1,3],[-1,5],[-5,7],[-8,3],[-8,2],[-8,2],[-6,6],[-3,5],[-9,7],[-4,5],[-7,26],[2,13],[16,21],[2,14],[49,2],[14,-3],[11,-7],[6,-2],[15,1],[15,-3],[7,1],[13,5],[20,19],[12,5],[7,1],[29,-2],[4,0],[2,1],[2,4],[0,3],[-2,3],[0,4],[4,5],[3,-1],[3,-5],[6,-12],[5,-7],[5,-2],[5,6],[4,10],[2,-1],[1,-5],[4,-5],[6,1],[3,6],[1,7],[4,5],[4,-1],[5,-8],[3,-3],[4,1],[13,8],[16,4],[5,4],[9,9],[4,2],[9,1],[9,4],[12,8],[8,10],[1,9],[4,11],[0,4],[-4,4],[-12,1],[-5,2],[-1,5],[6,12],[8,9],[10,8],[22,13],[3,1],[1,-1],[1,-3],[1,-2],[6,0],[5,1],[5,1],[5,3],[5,5],[8,10],[5,5],[7,3],[13,4],[5,4],[8,10],[32,20],[8,8],[7,12],[4,13],[2,11],[11,8],[11,9],[16,7],[18,14],[13,7],[31,17],[36,2],[19,-2],[6,0],[6,3],[6,4],[5,4],[5,-2],[6,-2],[5,1],[24,19],[5,3],[20,6],[3,2],[1,4],[4,1],[4,0],[3,1],[1,3],[0,1],[-2,2],[1,3],[4,3],[6,1],[8,0],[5,0],[6,3],[6,3],[6,4],[18,6],[19,5],[13,12],[26,1],[14,15],[19,16],[-13,13],[-13,13],[6,17],[12,0],[4,1],[4,3],[5,9],[4,4],[8,4],[9,1],[18,0],[8,2],[6,2],[4,3],[19,25],[6,5],[10,1],[13,-4],[12,-8],[18,-19],[4,-6],[-2,-13],[5,-3],[8,0],[5,1],[14,0],[12,-3],[26,-11],[8,-2],[-3,3],[-5,6],[-4,7],[6,-3],[6,-2],[20,-5],[18,-9],[6,-2],[25,-4],[3,-1],[3,-2],[1,-3],[1,-3],[1,-2],[3,-2],[19,-3],[-2,21],[11,8],[22,1],[13,-3],[5,17],[7,3],[1,-14],[6,-8],[3,5],[13,-2],[3,2],[0,8],[-3,13],[1,4],[12,1],[1,3],[-1,3],[1,3],[4,2],[3,1],[3,0],[3,1],[19,-8],[24,-3],[10,19],[-1,23],[11,2],[7,3],[23,-10],[31,12],[21,2],[20,1],[23,0],[3,-5],[6,-18],[3,-5],[10,-11],[10,-5],[11,0],[13,7],[6,5],[5,1],[5,-2],[5,-6],[0,-4],[-8,-12],[-5,-10],[-4,-3],[-36,-9],[-6,-3],[-3,-5],[-3,-5],[7,-29],[29,18],[24,7],[5,-21],[31,-15],[-2,-5],[1,-3],[2,-3],[5,0],[6,-5],[3,-7],[4,-15],[4,-7],[18,-20],[6,-17],[1,-17],[-32,-23],[-23,-11],[11,-17],[-14,-15],[12,-11],[11,-23],[6,2],[2,21],[3,16],[11,17],[19,9],[29,-7],[24,-24],[24,-14],[16,-18],[4,-25],[12,-7],[11,-2],[11,2],[12,7],[16,7],[13,-3],[23,-18],[3,-2],[3,1],[3,-2],[4,-8],[3,-3],[19,-14],[13,-6],[2,-10],[-11,-21],[-2,-12],[5,-9],[17,-16],[2,-10],[-2,-5],[-6,-10],[-1,-5],[0,-8],[1,-4],[-2,-3],[-6,-3],[-8,-2],[-1,2],[0,5],[-4,4],[-6,1],[-6,-2],[-7,-3],[-4,-3],[-4,-6],[-6,-5],[-17,-15],[-3,-1],[-3,-1],[-3,-1],[-2,-6],[-2,-1],[-7,-3],[-3,-1],[-1,-4],[0,-5],[-2,-1],[-2,0],[-5,-1],[-11,-3],[-4,-3],[-12,-13],[-6,-5],[-13,-9],[-6,-4],[-4,-6],[-3,-7],[0,-7],[1,-4],[4,-5],[1,-3],[0,-4],[2,-6],[1,-3],[0,-5],[-4,-11],[1,-6],[9,-13],[55,-66],[10,-9],[2,-3],[0,-6],[1,-3],[2,-3],[3,-2],[3,-2],[2,-3],[0,-3],[-4,-9],[-1,-2],[-5,-2],[-2,1],[-3,2],[-5,2],[-3,-1],[-3,-1],[-4,-1],[-3,0],[-4,1],[-2,3],[-3,3],[-3,2],[-47,20],[-8,6],[0,5],[3,6],[3,7],[-2,3],[-11,8],[-4,5],[-7,11],[-4,4],[-6,4],[-12,5],[-7,2],[-6,0],[-4,-1],[-6,-6],[-3,-2],[-4,0],[-3,1],[-2,2],[-3,2],[-9,1],[-4,-3],[-3,-5],[-7,-8],[-5,-3],[-7,-2],[-7,-1],[-6,2],[-23,1],[-90,-14],[-24,-10],[-21,-13],[-13,-17],[-12,-22],[-8,-10],[-9,-8],[-10,-5],[-19,-3],[-9,-3],[-15,-17],[-9,-14],[-3,-4],[-5,-1],[-15,-2],[-6,-2],[-3,-5],[-4,-8],[-4,-7],[-6,-3],[-7,1],[-8,1],[-14,-3],[-9,-12],[-8,-15],[-10,-11],[-6,-4],[-26,-8],[-13,-5],[-6,-2],[-5,0]],[[8610,6013],[-1,-6],[1,-8],[2,-6],[2,-6],[8,-11],[3,-3],[2,-2],[1,-2],[1,-6],[0,-12],[5,-41],[11,-7],[2,-3],[5,-7],[1,-3],[1,-12],[-11,-67],[0,-10],[2,-20],[1,-4],[0,-3],[-2,-3],[-6,-9],[-2,-6],[-1,-6],[2,-14],[-3,-24],[0,-5],[1,-4],[-1,-5],[-14,-27],[-5,-6],[-7,-6],[-8,-4],[-9,0],[-8,5],[-4,7],[-6,5],[-6,2],[-9,-3],[-4,-7],[-1,-9],[2,-10],[3,-7],[7,-12],[2,-8],[-1,-6],[-5,-7],[-12,-14],[-3,-8],[-1,1],[-12,-10],[-3,-28],[1,-7],[3,-7],[8,-12],[2,-7],[0,-8],[-4,-13],[0,-9],[4,-11],[3,-6],[12,-12],[4,-14],[3,-41],[0,-3],[-2,-5],[-3,-1],[-3,-1],[-7,-3],[-2,0],[-1,0],[0,-5],[7,-10],[-8,-3],[-5,2],[-5,4],[-6,2],[-9,1],[-3,0],[-4,-1],[-1,-2],[0,-3],[0,-24],[1,-2],[-6,-3],[-4,-1],[-4,-2],[-6,-12],[-1,-4],[1,-5],[3,-4],[1,-3],[0,-2],[0,-3],[0,-2],[-1,-1],[0,-1],[-3,-1],[-2,0],[-2,1],[-2,2],[-4,6],[-6,3],[-5,-2],[-2,-7],[-4,-10],[-4,-4],[-3,4],[-2,10],[-3,10],[-6,8],[-22,20],[-22,15],[-8,2],[-3,-2],[-1,-5],[1,-10],[0,-3],[-2,-1],[-2,0],[-2,-6],[0,-6],[0,-4],[0,-5],[-2,-5],[-4,-2],[-4,0],[-4,-2],[-4,-4],[-2,-2],[-3,-2],[-2,-1],[-3,-1],[0,3],[-1,3],[-4,23],[-8,23],[4,4],[5,0],[4,1],[0,9],[-19,114],[-1,6],[-4,11],[-2,5],[1,21],[-2,26],[-2,6],[-4,5],[-9,8],[-4,5],[-2,10],[-3,27],[-5,6],[-11,5],[-7,9],[-2,11],[0,25],[-9,49],[0,14],[2,5],[6,12],[2,6],[0,4],[-1,3],[-2,6],[0,3],[1,7],[-1,3],[-1,2],[-5,3],[-1,3],[-1,2],[1,5],[-1,3],[-2,3],[-4,4],[-2,2],[-1,6],[-2,16],[-14,40],[0,12],[4,14],[-1,7]],[[8253,5898],[3,5],[-3,20],[2,7],[2,3],[0,2],[-1,2],[0,2],[1,3],[1,3],[1,1],[3,3],[1,0],[1,1],[1,0],[1,0],[1,0],[1,-1],[1,-1],[1,-1],[1,0],[1,1],[1,1],[0,2],[1,4],[0,3],[0,3],[0,1],[-1,2],[-1,3],[-1,1],[0,2],[0,9],[1,3],[0,2],[4,10],[2,5],[-1,2],[-1,2],[-2,4],[0,1],[-1,2],[0,3],[0,8],[3,13],[0,3],[-1,29],[0,3],[-1,3],[-1,1],[-2,2],[-1,1],[-2,2],[-2,6]],[[8253,5898],[0,1],[-7,4],[-6,-4],[-4,-16],[-6,-4],[-4,6],[-4,13],[-6,10],[-15,-5],[-5,-6],[-12,-14],[-6,-5],[-8,-2],[-5,2],[-14,16],[-4,6],[-5,5],[-4,0],[-3,-5],[0,-7],[0,-14],[9,-40],[0,-14],[-8,-12],[-4,-4],[-6,-4],[-19,-8],[-5,-4],[-9,-12],[-10,-16],[-7,-17],[2,-14],[5,-11],[5,-24],[5,-11],[1,-4],[-1,-3],[-6,-5],[-4,0],[-1,0],[-2,-1],[0,-2],[1,-2],[-1,-1],[-6,-8],[-2,-3],[-6,-5],[-2,-2],[-4,-3],[-10,-2],[-4,-1],[-3,-1],[-2,1],[-3,0],[-2,1],[-3,-1],[-2,-3],[-1,-4],[-2,-2],[-6,-3],[-1,1],[0,4],[-2,3],[-5,2],[-4,1],[-5,2],[-4,5],[-1,3],[-1,10],[-1,2],[-3,1],[-1,1],[-2,9],[-8,25],[-1,4],[-3,10],[-5,5],[-1,2],[1,2],[0,2],[-3,3],[-1,-3],[-3,5],[-5,7],[-6,5],[-8,-1],[-4,-5],[-2,-8],[1,-15],[6,-30],[-1,-11],[-12,3],[-8,10],[-4,15],[-8,56],[-2,3],[-2,3],[0,3],[2,3],[4,3],[1,3],[-1,2],[-5,1],[-4,3],[-3,7],[-5,15],[-2,9],[0,2],[-3,3],[-6,4],[-2,2],[-4,6],[-2,11],[-3,7],[-10,17],[-2,6],[2,8],[4,1],[5,0],[3,5],[-2,6],[-6,2],[-5,2],[-2,8],[3,7],[6,1],[6,1],[6,3],[4,6],[7,19],[1,6],[-2,4],[-3,9],[-1,4],[2,5],[11,19],[4,5],[5,4],[6,2],[4,0],[1,-1],[3,-1],[4,0],[4,2],[3,15],[1,13],[4,9],[14,1],[26,-5],[13,-1],[14,1],[8,2],[5,3],[3,5],[3,8],[3,22],[2,4],[4,-1],[6,-14],[3,-6],[6,-3],[7,-1],[6,2],[3,5],[0,6],[-2,7],[-1,7],[4,4],[21,-4],[4,0],[1,-2],[0,-8],[1,-3],[11,-10],[7,-2],[4,3],[2,6],[8,30],[0,6],[-3,14],[1,7],[7,2],[3,-3],[8,-5],[6,-2],[0,5],[-8,11],[1,5],[28,-3],[10,1],[9,4],[7,8],[1,10],[-2,21],[2,7],[4,4],[5,3],[4,3]],[[1600,4742],[1,2],[0,11],[3,7],[3,7],[3,4]],[[980,4866],[-2,-5],[-6,-4],[-4,0]]],"transform":{"scale":[0.0029221772689268836,0.0028752730004000387],"translate":[68.14340254000012,6.74555084800015]}};
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
