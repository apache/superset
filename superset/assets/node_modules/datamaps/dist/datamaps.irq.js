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
  Datamap.prototype.indTopo = '__IND__';
  Datamap.prototype.ioaTopo = '__IOA__';
  Datamap.prototype.iotTopo = '__IOT__';
  Datamap.prototype.irlTopo = '__IRL__';
  Datamap.prototype.irnTopo = '__IRN__';
  Datamap.prototype.irqTopo = {"type":"Topology","objects":{"irq":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Dihok"},"id":"IQ.DA","arcs":[[0,1,2]]},{"type":"Polygon","properties":{"name":"At-Ta'mim"},"id":"IQ.TS","arcs":[[3,4,5]]},{"type":"Polygon","properties":{"name":"Arbil"},"id":"IQ.AR","arcs":[[6,-6,7,8,-1,9]]},{"type":"Polygon","properties":{"name":"Ninawa"},"id":"IQ.NI","arcs":[[-9,10,11,12,-2]]},{"type":"Polygon","properties":{"name":"Sala ad-Din"},"id":"IQ.SD","arcs":[[-5,13,14,15,-11,-8]]},{"type":"Polygon","properties":{"name":"An-Najaf"},"id":"IQ.NA","arcs":[[16,17,18,19,20,21]]},{"type":"Polygon","properties":{"name":"Karbala'"},"id":"IQ.KA","arcs":[[22,-21,23]]},{"type":"Polygon","properties":{"name":"Baghdad"},"id":"IQ.BG","arcs":[[24,25,26]]},{"type":"Polygon","properties":{"name":"Al-Basrah"},"id":"IQ.BA","arcs":[[27,28,29,30]]},{"type":"Polygon","properties":{"name":"Al-Muthannia"},"id":"IQ.MU","arcs":[[31,-29,32,-18,33]]},{"type":"Polygon","properties":{"name":"Al-Qadisiyah"},"id":"IQ.QA","arcs":[[34,35,-34,-17,36]]},{"type":"Polygon","properties":{"name":"Dhi-Qar"},"id":"IQ.DQ","arcs":[[-30,-32,-36,37,38]]},{"type":"Polygon","properties":{"name":"Maysan"},"id":"IQ.MA","arcs":[[-31,-39,39,40]]},{"type":"Polygon","properties":{"name":"Wasit"},"id":"IQ.WA","arcs":[[-40,-38,-35,41,42,43]]},{"type":"Polygon","properties":{"name":"As-Sulaymaniyah"},"id":"IQ.SU","arcs":[[44,-14,-4,-7,45]]},{"type":"Polygon","properties":{"name":"Diyala"},"id":"IQ.DI","arcs":[[46,-43,47,-27,48,-15,-45]]},{"type":"Polygon","properties":{"name":"Al-Anbar"},"id":"IQ.AN","arcs":[[-16,-49,-26,49,-24,-20,50,-12]]},{"type":"Polygon","properties":{"name":"Babil"},"id":"IQ.BB","arcs":[[-25,-48,-42,-37,-22,-23,-50]]}]}},"arcs":[[[5410,9925],[-4,-18],[3,-5],[3,-2],[3,-2],[2,-5],[1,-2],[1,-1],[2,-2],[3,-1],[2,-1],[3,-2],[1,-3],[0,-4],[-9,-17],[-3,-8],[-1,-5],[1,-5],[2,-7],[1,-7],[1,-3],[3,-2],[4,-1],[6,-1],[2,0],[2,-2],[2,-14],[1,-5],[-1,-3],[-12,-4],[-11,-9],[-8,-7],[-12,-16],[-3,-7],[-1,-4],[5,-9],[-2,-3],[-6,-4],[-13,-5],[-21,-10],[-6,-5],[-15,-21],[-4,-6],[-6,-5],[-8,-5],[-18,-8],[-9,-3],[-4,-3],[1,-4],[3,-3],[-1,-2],[-4,-3],[-39,-14],[-18,-10],[-5,-5],[-4,-7],[-4,-13],[-4,-6],[-5,-5],[-8,-2],[-14,-6],[-21,-21]],[[5164,9562],[-32,7],[-28,11],[-72,12],[-12,3],[-18,9],[-5,2],[-4,0],[-3,-1],[-4,-3],[-4,-4],[-3,-4],[-5,-10],[-1,-4],[0,-4],[-2,-10],[-3,-9],[-3,-9],[0,-5],[0,-4],[0,-4],[3,-5],[1,-4],[1,-3],[3,-4],[10,-7],[5,-3],[6,-1],[15,-1],[7,-1],[9,-5],[17,-5],[7,-1],[5,-3],[4,-3],[2,-6],[1,-6],[1,-6],[0,-5],[-2,-6],[-8,-17],[-5,-5],[-5,-3],[-6,-2],[0,-3],[2,-7],[0,-4],[0,-4],[0,-3],[1,-3],[0,-6],[1,-3],[1,-4],[0,-7],[-1,-7],[-5,-14],[-3,-3],[-4,0],[-4,2],[-17,6],[-10,-2],[-7,-4],[-3,-4],[-2,-6],[0,-7],[-1,-6],[-3,-5],[-7,-1],[-14,3],[-148,38],[-33,15],[-18,16],[-31,21],[-14,13],[-16,12],[-15,8],[-39,5],[-17,-6],[-14,-10],[-7,-12],[-32,-36],[-30,-47],[-9,-27],[-9,-22],[-5,-19],[-15,-10],[-34,-16],[-41,-4],[-134,-17],[-84,-44],[-12,2],[-15,0],[-12,-2],[-10,-7],[-8,-15],[-9,19],[-5,8],[-8,6],[-14,8],[-9,0],[-36,-17],[-10,-1],[-7,10],[2,9],[10,8],[23,8],[-9,9],[-8,2],[-9,1],[-9,4],[-18,16],[-31,33],[-9,6],[-13,3],[-9,-3],[-5,-5],[-5,-5],[-5,-3],[-43,1],[-16,8],[-14,37],[-17,12],[-32,15],[-21,-7],[-11,9],[5,13],[27,2],[-11,20],[-9,9],[-2,11],[7,26],[-17,4],[-1,20],[5,24],[0,18],[-20,-22],[-18,0],[-18,13],[-39,36],[-18,26],[-14,28],[-7,26]],[[3681,9622],[1,0],[-1,18],[-6,13],[-7,12],[-7,15],[46,5],[58,18],[88,14],[17,7],[3,6],[13,33],[128,176],[4,9],[1,8],[2,9],[6,10],[7,4],[51,19],[9,1],[12,-1],[9,-7],[4,-20],[9,-6],[84,-27],[42,-6],[43,14],[26,19],[39,16],[42,10],[31,3],[18,-5],[134,-68],[7,-2],[9,-1],[9,1],[9,9],[9,4],[19,3],[13,-2],[26,-20],[14,-10],[42,-20],[47,-37],[17,-6],[13,2],[25,9],[13,2],[13,-2],[9,-4],[18,-14],[26,-10],[25,-3],[105,7],[26,-2],[25,-6],[10,-7],[22,-20],[7,-4],[13,3],[18,17],[55,10],[31,34],[31,41],[37,30],[46,7],[34,-5]],[[5981,8207],[56,-119],[26,-27],[24,-31],[47,-40],[9,-24],[0,-20],[-17,-30],[-4,-12],[-2,-31],[-4,-14],[-3,-43],[-4,-35],[2,-12],[7,-12],[22,-23],[20,-26],[1,-14],[-5,-17],[-11,-20],[-37,-49],[-8,-23],[3,-18],[6,-20],[4,-18],[-4,-19],[-11,-25],[-3,-17],[-3,-7],[-3,-5],[-8,-3],[-9,-5],[-13,-8],[-10,-15],[-4,-11],[-1,-10],[2,-9],[7,-17],[-3,-10],[-11,-10],[-79,-24],[-46,-37]],[[5914,7297],[-13,-1],[-6,-2],[-7,-6],[-10,-11],[-8,-13],[-5,-21],[1,-17],[20,-47],[-1,-18],[-10,-15],[-28,-20],[-15,-8],[-13,-8],[-7,-7],[-23,-31],[-22,-22],[-16,-23],[-1,-10],[-1,-3],[0,-2],[0,-3],[0,-4],[-3,-6],[-4,-9],[-1,-3],[0,-3],[1,-4],[-1,-4],[-5,-7],[-1,-3],[0,-3],[-2,-4],[-4,-5],[-11,-6],[-17,-22],[-3,-12],[-4,-7],[-5,-7],[-13,-11],[-3,-5],[-2,-4],[1,-12],[-1,-6],[-3,-14],[1,-5],[3,-7],[1,-3],[-2,-5],[0,-3],[2,-3],[4,-1],[10,-1],[1,-3],[-5,-7],[-23,-26],[-15,-1],[-10,3],[-78,58],[-85,83],[-62,37],[-87,38],[-72,26],[-67,39],[-204,118],[-79,35],[-23,15],[-10,15],[-19,13],[-26,12],[-14,19],[-67,70],[-8,6],[-10,13],[-9,15],[-4,11],[4,13],[10,6],[12,4],[9,6],[4,23],[-21,9],[-53,9],[7,8],[3,7],[3,18],[0,5],[-4,4],[-2,4],[3,8],[4,2],[3,2],[3,1],[1,3],[-6,16],[-15,9],[-28,11],[-12,10],[-26,28],[-5,9],[-2,3],[-5,3],[-5,6],[-2,12],[2,12],[2,7],[1,7],[-5,11],[7,18],[15,-5],[5,-3],[2,-4],[1,-4],[1,-4],[4,-6],[1,-5],[0,-6],[6,-9],[6,-2],[9,1],[17,27],[19,10]],[[4684,7693],[46,-29],[10,-4],[21,-6],[11,0],[11,2],[20,17],[16,5],[43,2],[20,3],[16,9],[9,14],[12,35],[10,13],[14,6],[23,0],[34,2],[33,20],[22,2],[11,4],[10,13],[11,36],[5,30],[7,14],[16,18],[13,12],[9,11],[0,13],[-4,11],[-6,11],[-23,25],[-6,5],[-1,8],[6,10],[63,51],[74,76],[10,27],[16,3],[23,-9],[108,-73],[38,1],[22,4],[9,6],[9,17],[15,39],[23,8],[18,4],[56,-11],[22,-4],[19,-9],[6,-2],[9,1],[10,2],[14,8],[6,5],[5,8],[4,0],[13,-6],[6,-2],[16,-3],[4,-2],[4,0],[3,0],[5,11],[3,2],[20,8],[5,3],[5,5],[5,3],[8,1],[12,-2],[9,0],[22,12],[23,-6],[2,-4],[3,-1],[5,0],[9,5],[6,2],[8,-3],[4,-4],[6,-9],[4,-3],[4,1],[2,6],[-1,4],[-1,4],[-1,4],[1,3],[4,3],[4,1],[10,-7],[4,0],[5,5],[5,5],[6,6],[8,7],[4,6],[4,9],[3,4],[4,3],[11,6],[4,-1],[3,-4],[0,-12],[6,-10]],[[6372,8965],[-5,-11],[-5,-12],[-14,-20],[-11,-8],[-15,-5],[-35,2],[-44,11],[-21,-1],[-23,-4],[-53,-26],[-44,-11],[-47,-7],[-29,8],[-17,2],[-21,-6],[-32,-23],[-19,-22],[-12,-15],[-33,-29],[-1,-25],[6,-14],[59,-86],[10,11],[6,5],[11,-1],[10,-8],[52,-59],[5,-9],[3,-10],[-9,-10],[-24,-11],[-8,-5],[-5,-10],[-6,-8],[-8,-8],[-22,-17],[5,-15],[5,-11],[102,-70],[24,-9],[12,-8],[10,-8],[75,-86],[32,-29],[25,-17],[69,-33],[7,-8],[2,-3],[0,-3],[-1,-3],[-1,-3],[-2,-7],[-2,-3],[-7,-5],[-7,-3],[-11,-1],[-23,0],[-10,3],[-6,3],[-1,3],[-3,1],[-2,2],[-5,5],[-3,2],[-5,0],[-11,-1],[-4,0],[-6,3],[-4,0],[-8,-1],[-3,-2],[0,-3],[11,-20],[1,-3],[-6,-7],[-15,-5],[-10,-10],[-3,-1],[-3,2],[-2,6],[-1,18],[-2,4],[-3,2],[-4,1],[-3,0],[-4,-4],[-3,-3],[-2,-4],[-1,-8],[-1,-4],[-3,-3],[-5,1],[-8,6],[-4,5],[-4,5],[-5,2],[-6,0],[-9,-3],[-5,-3],[-6,-2],[-6,0],[-6,5],[-5,8],[-5,2],[-8,0],[-24,-7],[-6,-1],[-5,1],[-4,5],[0,3],[0,3],[-1,3],[-1,3],[-3,1],[-5,1],[-11,-7],[-4,0],[-4,4],[-3,4],[-4,2],[-3,0],[-19,-8]],[[4684,7693],[8,2],[3,1],[2,4],[2,6],[1,15],[4,16],[1,8],[1,11],[-5,93],[-3,18],[-8,15],[-7,6],[-5,3],[-5,1],[-5,2],[-2,3],[-1,5],[2,8],[2,9],[-4,15],[-5,12],[-5,7],[-4,5],[-3,4],[-1,4],[4,8],[2,5],[7,33]],[[4660,8012],[-17,38],[-1,6],[-1,11],[4,14],[22,48],[5,8],[6,4],[7,0],[8,1],[8,7],[11,24],[9,84],[0,22],[-4,9],[-13,0],[-16,2],[-11,11],[-7,30],[9,12],[132,53],[11,10],[15,21],[3,6],[1,6],[-2,24],[1,8],[2,10],[22,39],[2,8],[3,8],[5,11],[4,4],[8,1],[20,14],[12,23],[5,14],[6,8],[32,28],[9,12],[12,20],[8,10],[8,7],[23,10],[15,16],[8,4],[19,11],[16,15],[43,49],[17,28],[8,24],[-1,18],[-2,11],[-4,11],[0,4],[3,3],[4,1],[11,-2],[8,0],[7,2],[8,4],[10,7],[3,6],[1,7],[0,5],[0,4],[-1,5],[-3,4],[-2,5],[-1,11],[3,6],[4,2],[26,-3],[6,0],[10,3],[4,7],[2,8],[-1,14],[2,9],[2,3],[3,1],[4,-3],[3,-3],[3,-4],[5,-2],[6,2],[15,11],[7,8],[10,8],[4,6],[3,5],[4,10],[26,28],[8,7],[6,2],[2,-2],[4,-1],[4,1],[2,3],[-4,5],[-1,5],[0,6],[2,2],[2,0],[2,-4],[1,-4],[2,-3],[3,-3],[4,-3],[5,-1],[5,1],[5,2],[5,0],[5,0],[2,-1],[1,-3],[-2,-4],[-2,-4],[-1,-5],[1,-4],[3,-4],[7,-2],[3,2],[2,4],[0,4],[2,7],[3,3],[3,1],[4,0],[4,0],[10,5],[5,1],[6,0],[5,-2],[4,-2],[2,-2],[-1,-3],[2,-4],[4,-2],[10,2],[13,11],[18,10],[28,24],[8,5],[17,6],[16,24],[29,24],[36,47],[6,10],[0,6],[-1,4],[-2,4],[-2,2],[-2,0],[-3,-1],[-2,-2],[-2,-1],[-3,1],[-6,14],[-3,9],[-11,10],[-1,6],[-1,10],[-2,5],[-5,5],[-9,5],[-17,12],[-97,40],[-7,5],[-5,5],[-3,6],[-5,4],[-3,1],[-31,3],[-9,2],[-5,0],[-4,-2],[-8,0],[-4,2],[-9,13],[0,3],[1,3],[1,5],[0,6],[-7,9],[-4,4],[-5,1],[-3,-1],[-17,-1],[-2,3],[0,2],[2,2],[5,0],[2,2],[1,4],[-5,7],[-3,6],[-1,6],[-5,8],[-7,4],[-13,7],[-14,10],[-21,12],[-22,21],[-6,4],[-5,2],[-6,-2],[-24,5],[-65,34]],[[5410,9925],[20,-3],[98,-39],[23,-14],[17,-16],[12,-21],[9,-27],[5,-27],[1,-15],[-1,-12],[-9,-14],[-10,-4],[-12,-2],[-13,-7],[-17,-21],[-8,-25],[-1,-25],[7,-25],[42,-88],[6,-12],[10,-7],[42,-11],[13,1],[9,9],[10,20],[16,26],[3,19],[9,13],[86,27],[27,14],[26,19],[24,30],[37,32],[40,27],[33,15],[19,1],[107,-15],[20,-9],[13,-21],[-14,-35],[0,-11],[8,-22],[6,-8],[7,-3],[8,-2],[8,-5],[3,-8],[6,-18],[4,-6],[10,-2],[20,6],[10,0],[7,-4],[12,-12],[22,-11],[7,-11],[-2,-13],[-11,-13],[-6,-32],[6,-21],[9,-20],[5,-27],[-5,-29],[-14,-21],[-37,-42],[-11,-30],[8,-21],[21,-13],[26,-6],[32,2],[15,-2],[13,-11],[9,-10],[11,-8],[12,-3],[13,-1],[17,-8],[15,-20],[25,-43],[11,-26],[-2,-22],[-20,-44],[-11,-41],[-1,-25],[-3,-3],[-12,-4],[-5,-3],[-2,-20],[15,-18],[4,-3]],[[4660,8012],[-10,-9],[-2,-9],[-4,-17],[-11,-6],[-13,-1],[-15,-4],[-8,-9],[-15,-27],[-14,-11],[-20,-5],[-20,-13],[-67,-27],[-123,-82],[-18,-1],[-8,-2],[-10,-6],[-24,-20],[-13,-8],[-29,-13],[-3,0],[-3,0],[-2,0],[-1,-1],[-3,-1],[-3,1],[-3,0],[-4,0],[-3,-2],[-3,-3],[-4,-5],[-3,-7],[-3,-2],[-2,-2],[-1,-2],[9,-14],[10,-23],[3,-8],[-2,-8],[-6,-10],[-4,-7],[-2,-3],[-3,-16],[1,-8],[2,-9],[5,-8],[1,-16],[2,-7],[28,-35],[8,-8],[16,-12],[4,-6],[5,-8],[1,-9],[1,-10],[12,-31],[2,-2],[3,-2],[2,1],[2,1],[2,0],[1,-3],[-1,-6],[-4,-9],[-2,-8],[0,-8],[-3,-20],[0,-9],[1,-3],[1,-2],[2,0],[2,1],[2,-1],[6,-1],[3,-9],[8,-14],[1,-7],[2,-3],[2,-1],[3,0],[2,-2],[0,-4],[1,-2],[2,-1],[3,1],[1,-2],[0,-3],[-2,-3],[0,-2],[2,-1],[4,-1],[4,0],[3,0],[2,-1],[4,1],[2,-2],[2,-11],[2,-3],[0,-3],[2,-8],[1,-4],[-1,-6],[-5,-13],[0,-3],[4,-6],[2,-5],[-2,-8],[-11,-7],[-38,-5],[-364,-2],[-117,-25],[-26,-117]],[[3798,7109],[-223,-30],[-31,13],[-35,17],[-19,4],[-143,-19],[-67,5],[-135,51],[-280,112],[-68,10],[-173,48],[-131,12],[-22,1]],[[2471,7333],[-1,28],[10,73],[43,148],[9,118],[9,36],[48,70],[35,50],[16,36],[6,38],[-5,165],[-5,40],[-11,38],[-79,164],[0,1],[-26,58],[-4,21],[0,20],[33,302],[8,32],[90,168],[1,0],[20,27],[30,13],[67,10],[316,64],[28,13],[27,22],[138,139],[204,206],[106,107],[66,59],[31,23]],[[5914,7297],[103,-105],[17,-8],[23,-6],[18,6],[112,-4],[38,-7],[88,-59],[12,-15],[3,-5],[1,-5],[-1,-5],[-3,-16],[2,-86]],[[6327,6982],[-48,-43],[-34,-17],[-27,-10],[-11,-9],[-7,-9],[-1,-8],[1,-8],[1,-10],[-4,-13],[-14,-23],[-20,-19],[-14,-12],[-13,-5],[-29,-8],[-20,-12],[-10,-9],[-5,-7],[0,-7],[2,-8],[4,-8],[5,-7],[4,-14],[-2,-17],[-16,-34],[-13,-17],[-15,-13],[-16,-12],[-18,-14],[-11,-13],[-7,-12],[-5,-15],[-3,0],[-5,3],[-38,33],[-11,7],[-9,4],[-15,4],[-21,8],[-9,5],[-4,-2],[-12,-15],[-2,-7],[-1,-4],[-1,-12],[16,-39],[-1,-6],[-2,-9],[-12,-11],[-2,-3],[2,-2],[2,0],[4,-1],[4,-4],[4,-10],[-1,-4],[-3,-3],[-10,-3],[-4,-1],[-5,-1],[-4,-3],[-4,-8],[-1,-5],[1,-1],[1,1],[3,2],[3,0],[3,-2],[-1,-2],[-2,-4],[-5,-5],[0,-4],[3,-2],[3,-1],[4,1],[6,4],[3,0],[3,-2],[-1,-4],[-2,-4],[-3,-11],[-3,-4],[-7,-7],[2,-4],[2,-6],[4,-12],[-1,-10],[-7,-22],[-10,-22],[-8,-12],[0,-5],[3,-7],[6,-8],[9,-10],[8,-7],[7,-3],[12,-15],[-14,-9],[3,-24],[-1,-4],[-4,-3],[-5,-2],[-7,-5],[-2,-7],[0,-22],[-2,-5],[-3,-1],[-3,3],[-6,6],[-3,0],[-4,-2],[-4,-3],[-4,-2],[-3,-1],[-12,0],[-9,-3],[-4,-3],[-22,-31],[-4,-8],[-2,-10],[-2,-4],[-4,-2],[-3,1],[-2,1],[0,2],[2,5],[0,4],[-2,2],[-6,-1],[-3,-4],[-4,-7],[-3,-7],[-5,-4],[-4,-2],[-12,1],[-10,-2],[-3,-3],[0,-3],[2,-3],[2,-4],[1,-29],[-1,-3],[-2,-1],[-12,-1],[-9,-2],[-4,-3],[-2,-4],[1,-5],[8,-13],[1,-4],[0,-5],[-2,-8],[-4,-4],[-22,-14],[-2,-4],[5,-9],[2,-6],[-8,-19],[-2,-15],[-12,-16],[0,-6],[0,-10],[3,-3],[5,-1],[7,0],[8,3],[28,3],[28,-4],[6,-3],[9,-3],[47,-42],[13,-15],[7,-19],[4,-23],[-1,-23],[-6,-21],[-35,-53],[-19,-52],[-2,-11],[0,-11],[2,-11],[6,-10],[6,-8],[21,-21],[2,-4],[0,-6],[-14,-22],[-4,-9],[-15,-65],[11,-28],[-3,-29],[-8,-32],[-41,-35],[-17,-13],[-24,-22],[-15,-17],[-55,-78]],[[5590,5257],[-75,4],[-35,24],[-38,11],[34,27],[-10,11],[-22,38],[-32,78],[-19,35],[-16,17],[-36,32],[-31,9],[-171,-4],[-93,30],[-125,49],[-110,18],[-54,20],[-140,121],[-164,161],[-70,92],[-54,127],[-10,63],[-16,65],[-26,36],[-8,36],[-4,75],[-20,103],[-122,-68],[-33,5],[-44,24],[-198,159],[-41,174],[-2,263],[-7,17]],[[5984,3725],[-15,-49],[-4,-5],[-4,-5],[-5,0],[-6,-1],[-11,-7],[-2,-6],[0,-7],[4,-8],[4,-8],[7,-6],[9,-7],[6,-8],[-1,-5],[-5,-4],[-29,-11],[-38,-25],[-20,-8],[-8,-12],[-8,-29],[-8,-38],[35,-170],[-5,-40],[0,-75],[13,-90],[-19,-29],[-18,10],[-28,11],[-22,-5],[-22,-26],[-5,-28],[22,-41],[66,-79],[19,-12],[197,-82]],[[6083,2820],[-78,-424],[-24,-58],[-49,-87],[-47,-44],[-40,-47],[-50,-79],[-7,-5],[-62,-26],[-50,-38],[-16,-16],[-42,-56],[-37,-73],[-183,-539],[-225,-402],[-13,-23]],[[5160,903],[-50,41],[-117,98],[-117,97],[-117,97],[-117,97],[-90,75],[-90,75],[-90,74],[-90,75],[-108,90],[-77,68]],[[4097,1790],[7,12],[27,65],[66,125],[31,74],[13,42],[12,107],[4,11],[7,18],[35,61],[58,83],[7,16],[7,25],[7,59],[4,15],[40,108],[4,25],[-1,18],[-3,9],[-2,10],[0,16],[2,21],[10,29],[108,234],[16,44],[5,34],[2,39],[14,26],[159,237],[30,32],[19,14],[16,8],[21,2],[8,2],[31,20],[12,5],[65,10],[16,6],[14,9],[26,21],[95,53],[18,17],[18,21],[5,36],[1,24],[-107,102]],[[5024,3735],[476,137],[95,30],[27,3],[12,-11],[9,-5],[5,6],[4,14],[2,7],[12,30]],[[5666,3946],[15,-57],[7,-12],[6,-6],[-4,-21],[-25,-14],[-7,-12],[1,-13],[9,-22],[19,-31],[7,-8],[7,-12],[5,-10],[16,-21],[36,35],[21,14],[5,0],[8,2],[8,-1],[51,36],[27,-15],[23,-19],[31,-17],[52,-17]],[[5472,4472],[29,-4],[35,-9],[6,-1],[5,1],[11,6],[5,2],[5,0],[6,-2],[7,-5],[25,-26],[4,-9],[0,-7],[1,-14],[-10,-10],[-36,-130],[2,-45],[17,-41],[58,-84],[7,-24],[-10,-24],[-5,-20],[8,-25],[21,-42],[3,-13]],[[5024,3735],[-50,42],[-168,127],[-241,242],[-25,37],[-7,37],[55,28],[48,18],[125,18],[22,3],[11,3],[27,18],[192,168],[81,39],[86,11],[117,0],[175,-54]],[[5856,4947],[-170,9],[-26,7],[-13,2],[-14,-2]],[[5633,4963],[-11,13],[-28,17],[-12,12],[-10,20],[-5,25],[0,25],[4,23],[12,24],[33,34],[9,24],[0,6],[-1,5]],[[5624,5191],[53,14],[13,43],[7,8],[6,-1],[73,-3],[11,-2],[20,-11],[38,-33],[32,24],[4,-3],[4,-6],[1,-13],[3,-11],[5,-17],[1,-4],[-1,-2],[0,-2],[-1,-15],[-5,-12],[1,-35],[1,-37],[-2,-8],[-3,-8],[-5,-3],[-4,0],[0,3],[2,4],[0,11],[-7,-19],[3,-11],[4,-8],[0,-5],[-1,-5],[-7,-7],[-3,-3],[-10,-15],[-1,-52]],[[9097,2614],[-4,-291],[336,0],[11,-6],[3,-16],[-3,-579],[1,-37],[109,-16],[11,-4],[11,-6],[17,-19],[13,-24],[9,-26],[8,-53],[5,-12],[8,-8],[11,-6],[12,-1],[13,0],[37,7],[13,-1],[12,-4],[10,-9],[21,-35],[33,-38],[39,-37],[7,-10],[5,-13],[2,-13],[-3,-12],[-7,-11],[-10,-9],[-8,-10],[-2,-13],[2,-9],[13,-27],[20,-24],[6,-12],[3,-2],[18,-60],[2,-16],[10,-23],[4,-8],[7,-7],[14,-12],[15,-9],[32,-9],[7,-4],[0,-6],[25,1],[4,-12],[-13,-15],[-27,-7],[-111,12],[-78,28],[-36,27],[-36,12],[-57,36],[-44,16],[-48,9],[-43,1],[-39,-11],[-71,-39],[-7,31],[-4,37],[-7,33],[-17,23],[12,-39],[2,-15],[-3,-16],[-4,-14],[-1,-13],[8,-11],[-1,-28],[-221,113],[-58,12],[-264,0],[-59,-7],[-165,-70],[-54,-37],[-34,-51],[-87,-227],[-38,-72],[-5,-17],[-4,-36],[-3,-12],[-19,-46],[-77,-129],[-30,-82],[-15,-24],[-66,-74],[-64,-110],[-154,-178]],[[7957,73],[1,1],[5,30],[22,242],[8,32],[12,27],[38,67],[4,31],[1,155],[13,121],[84,455],[0,35],[-3,31],[-7,24],[-8,22],[-101,150],[-13,30],[-9,34],[-16,111],[-17,74]],[[7971,1745],[334,93],[18,0],[142,-27],[31,6],[6,34],[-5,88],[1,27],[6,34],[26,136],[13,250],[-8,100]],[[8535,2486],[11,74],[19,30],[21,18],[35,17],[142,37],[46,4],[146,-15],[141,-37],[1,0]],[[7165,3114],[32,-38],[6,-18],[-1,-5],[-1,-17],[1,-16],[-1,-9],[-2,-6],[-4,-1],[-4,1],[-10,8],[-6,3],[-6,2],[-5,-4],[-5,-9],[-7,-26],[0,-11],[4,-7],[5,-2],[6,-2],[6,-8],[5,-13],[7,-37],[2,-16],[-4,-14],[-70,-89],[-11,-22],[2,-17],[29,-5],[56,-2],[-59,-140],[-11,-39],[2,-13],[20,-8],[4,-5],[12,-9],[8,-4],[6,-3],[4,-12],[-1,-21],[-6,-37],[-8,-13],[-12,-2],[-21,8],[-15,-2],[-8,-16],[-5,-31],[-6,-22],[-4,-36],[-6,-26],[14,-168],[502,-67],[164,-59],[94,-157],[42,-88],[11,-16],[14,-10],[13,-1],[34,8]],[[7957,73],[-29,-34],[-45,-10],[-45,-9],[-18,-4],[-26,-6],[-45,-10],[-108,10],[-78,7],[-77,8],[-78,7],[-78,7],[-105,10],[-105,10],[-104,9],[-105,10],[-105,10],[-105,10],[-104,9],[-105,10],[-81,8],[-82,7],[-81,8],[-81,8],[-94,8],[-7,3],[-6,3],[-7,2],[-6,3],[-79,65],[-97,81],[-97,81],[-98,81],[-97,81],[-117,97],[-117,97],[-117,97],[-68,56]],[[6083,2820],[174,-129],[83,-45],[21,125],[64,176],[32,63],[16,43],[1,18],[-22,11],[-7,12],[-5,14],[-6,11],[-7,4],[-18,6],[-10,6],[-12,12],[24,3],[165,39],[11,19],[73,-3],[250,-49],[181,-60],[43,1],[22,7],[9,10]],[[6565,4007],[59,-8],[6,-19],[26,-11],[72,-8],[12,-18],[22,-7],[4,-10],[-2,-11],[-13,-33],[-3,-17],[6,-18],[15,-18],[102,-96],[18,-25],[13,-22],[10,-15],[16,-11],[64,-24],[71,-20],[3,-15],[-7,-6],[-4,-6],[0,-7],[48,-112]],[[7103,3470],[-6,-30],[-2,-17],[1,-25],[41,-125],[28,-159]],[[5984,3725],[30,-10],[57,-35],[13,-4],[12,0],[10,3],[9,5],[6,6],[20,24],[6,5],[15,9],[6,5],[4,6],[1,9],[-1,11],[-8,8],[-5,5],[-2,5],[3,9],[6,10],[10,11],[8,3],[6,0],[6,-5],[11,-12],[7,-3],[7,4],[30,28],[44,34],[66,27],[88,59],[7,6],[12,15],[13,9],[45,28],[15,6],[9,2],[15,-1]],[[7103,3470],[103,-7],[62,27],[6,0],[5,-4],[4,0],[4,2],[4,5],[3,2],[3,-1],[2,-4],[6,-3],[4,1],[36,26],[8,3],[9,-1],[10,-3],[16,-3],[7,0],[4,3],[4,9],[6,5],[34,11],[265,1]],[[7708,3539],[23,-22],[12,-17],[2,-10],[-17,-5],[-17,-10],[-10,-20],[27,-57],[79,-131],[-1,-29],[-4,-16],[24,-61],[40,-45],[32,-18],[6,-7],[31,-52],[17,-17],[33,-27],[11,-14],[7,-19],[3,-18],[-4,-25],[-5,-14],[-11,-22],[-1,-16],[1,-11],[16,-50],[91,-57],[12,-10],[12,-11],[13,-18],[6,-12],[3,-11],[1,-11],[0,-13],[-5,-43],[0,-12],[2,-12],[2,-10],[4,-8],[7,-10],[44,-36],[14,-14],[40,-21],[107,2],[180,-13]],[[7708,3539],[128,5],[40,-5],[37,-19],[39,-10],[21,3],[28,181],[-13,22],[-20,30],[-124,54],[-19,15],[-3,18],[5,22],[43,123],[2,10],[-4,10],[-5,7],[-17,14],[-9,9],[2,11],[6,13],[14,22],[3,8],[4,17],[3,13],[1,12],[-1,74],[6,57],[67,200],[7,12],[23,16],[10,12],[15,27]],[[7997,4522],[4,-2],[47,-38],[67,-40],[43,-48],[307,-266],[1,-1],[32,-23],[31,-17],[33,-7],[36,4],[18,7],[46,26],[15,-1],[58,-20],[21,-11],[14,-16],[11,-18],[17,-22],[27,-21],[6,-9],[2,-13],[-4,-8],[-6,-7],[-9,-22],[-4,-5],[0,-6],[7,-16],[5,-7],[30,-29],[5,-7],[4,-6],[18,-25],[6,-7],[10,-5],[6,-15],[20,-15],[5,-16],[-2,-17],[-5,-12],[-6,-10],[-4,-13],[-2,-17],[1,-9],[7,-6],[16,-4],[13,-9],[8,-12],[9,-10],[16,-2],[19,-9],[3,-3],[15,-21],[23,-53],[16,-18],[35,-17],[10,-22],[5,-21],[37,-66],[7,-9],[18,-12],[8,-8],[6,-11],[5,-21],[4,-9],[16,-18],[40,-30],[14,-22],[3,-25],[-6,-28],[-156,-426],[-2,-206]],[[6565,4007],[-2,25],[-3,38],[-13,0],[-61,3],[-17,5],[-17,11],[-19,20],[-18,22],[-40,90],[-44,144],[-6,13],[-14,15],[-15,12],[-26,15],[-33,13],[-6,10],[-8,3],[-38,3],[-51,16],[-65,37],[-7,2],[-145,10],[-6,2],[-5,4],[-7,7],[-7,19],[-6,29],[-4,122],[-7,36],[17,10]],[[5892,4743],[23,-7],[2,1],[5,4],[4,7],[5,12],[10,16],[10,32],[7,17],[8,4],[6,-12],[9,-23],[5,-11],[7,-9],[7,-7],[10,-7],[10,-5],[12,-4],[12,0],[10,4],[12,10],[5,2],[-6,18],[-4,5],[-5,13],[9,15],[18,18],[45,33],[22,33],[23,28],[20,15],[31,-1],[117,-29],[36,-2],[99,11],[321,-92],[59,-17],[8,3],[12,7],[13,16],[16,18],[40,33],[7,7],[23,35],[27,32],[13,20],[10,25],[4,17],[7,13],[10,14],[35,42],[12,18],[5,6],[5,2],[4,-1],[5,-2],[3,-1],[5,1],[15,7],[12,7],[9,8],[11,13],[48,35],[8,4],[6,2],[6,0],[8,2],[13,5],[24,14],[11,9],[7,9],[12,43],[4,8],[16,27],[17,19]],[[7347,5332],[4,-2],[3,-2],[4,-2],[34,-42],[12,-21],[8,-23],[3,-24],[0,-20],[6,-18],[34,-32],[41,-57],[32,-26],[14,-14],[9,-21],[1,-12],[-6,-23],[-1,-10],[4,-11],[12,-7],[1,-11],[-7,-16],[-14,-17],[-28,-27],[-22,-16],[-16,-3],[-17,1],[-23,-2],[-20,-11],[-1,-15],[14,-12],[45,-5],[19,-8],[15,-13],[6,-17],[-7,-20],[-15,-16],[-17,-13],[-13,-15],[22,-48],[60,-7],[120,13],[109,-33],[102,-48],[28,-29],[95,-55]],[[7175,7025],[-6,13],[-10,111],[1,8],[3,2],[3,-1],[8,1],[4,0],[4,-2],[4,-1],[5,0],[5,1],[4,2],[3,2],[-11,17],[-70,72],[-6,9],[-4,4],[-8,7],[-7,4],[-7,0],[-6,-4],[-9,-10],[-1,-6],[-1,-8],[-4,-6],[-5,-8],[-11,-12],[-5,-8],[-5,-10],[-2,-4],[-9,-4],[-3,-2],[-2,-2],[-3,-1],[-2,0],[0,3],[0,3],[0,3],[-3,2],[-3,-1],[-4,-4],[-6,-11],[-3,-7],[1,-9],[2,-3],[3,0],[4,1],[2,0],[1,-1],[-1,-4],[-4,-9],[-9,-6],[-4,-5],[-3,-17],[-11,-8],[3,-7],[3,-1],[9,-1],[4,-1],[3,-1],[2,-2],[0,-3],[0,-3],[0,-4],[-3,-7],[-5,-11],[-24,-37],[-8,-11],[-26,-23],[-3,0],[-4,0],[-3,0],[-3,-2],[0,-7],[-2,-6],[-5,-7],[-10,-11],[-8,-18],[-3,-14],[-9,-22],[-1,-5],[-2,-4],[-6,-3],[-5,-4],[-5,-6],[-13,-34],[-12,-19],[-3,-9],[-2,-7],[-1,-3],[-1,-5],[0,-5],[0,-4],[1,-3],[1,-3],[0,-4],[-3,-9],[-3,-6],[-11,-19],[-4,-11],[0,-4],[-1,-3],[-5,-6],[-7,-6],[-19,-10],[-11,-5],[-9,-2],[-6,0],[-10,-2],[-4,0],[-8,0],[-13,-11],[-112,-130],[-33,-20],[-3,19],[-2,6],[-2,3],[-5,1],[-3,0],[-3,1],[-8,2],[-3,3],[-3,5],[0,5],[7,13],[3,8],[2,7],[0,7],[-1,6],[-6,18],[-1,7],[0,7],[1,6],[3,5],[14,15],[5,7],[1,4],[0,5],[-11,31],[-6,27],[-1,9],[0,5],[0,6],[0,8],[-4,27],[-3,42],[-3,11],[-9,13],[-8,10],[-14,11],[-10,5],[-13,4],[-21,3],[-12,-1],[-9,-3],[-24,-14],[-6,-1],[-7,1],[-7,5],[-9,13],[-22,21],[-54,34]],[[6372,8965],[16,-13],[13,-13],[1,-17],[6,-10],[9,-8],[8,-12],[5,-15],[2,-12],[4,-11],[11,-13],[28,-12],[30,2],[57,22],[26,-2],[18,-22],[11,-30],[5,-28],[2,-52],[8,-21],[19,-23],[-25,-15],[6,-15],[19,-14],[15,-14],[4,-23],[-2,-55],[5,-26],[32,-39],[13,-24],[-4,-24],[-13,-20],[-13,-24],[-6,-25],[7,-19],[0,-1],[18,-17],[22,-3],[23,7],[20,13],[1,0],[18,5],[34,16],[27,1],[22,-8],[40,-14],[37,-33],[14,-8],[27,-5],[31,-27],[47,-64],[26,-62],[13,-16],[18,-5],[39,11],[11,-2],[17,-11],[21,1],[20,10],[24,20],[11,0],[10,-3],[11,-2],[33,11],[65,-2],[20,6],[20,11],[16,6],[17,-1],[32,-11],[7,-1],[5,-5],[5,-24],[5,-8],[6,-7],[8,-7],[21,-8],[22,1],[43,9],[20,7],[17,11],[18,9],[22,-2],[17,-12],[8,-16],[-2,-19],[-12,-19],[-16,-14],[-31,-19],[-14,-20],[-16,-15],[-22,-2],[-40,2],[-51,-26],[-21,-5],[-71,2],[-21,-7],[-13,-13],[-9,-20],[-3,-21],[0,-19],[10,-47],[-3,-16],[-31,9],[-5,0],[-5,-1],[9,-25],[11,-23],[4,-5],[2,-5],[-1,-5],[-5,-4],[-8,-6],[-5,-8],[-3,-10],[1,-11],[13,-35],[66,-101],[56,-48],[25,-27],[7,-36],[-2,-5],[-6,-12],[-12,-14],[-9,-16],[2,-19],[15,-9],[39,0],[16,-12],[-4,-32],[-22,-36],[-14,-34],[21,-24],[-8,-15],[-11,-6],[-13,-2],[-26,-8],[-18,4],[-10,-1],[-28,-16],[-15,-13],[-16,-4],[-31,13],[-13,-1],[-10,4],[-22,13],[-15,5],[-7,-2],[-14,-23],[-1,-6],[3,-14],[-2,-6],[-7,-3],[-14,-1],[-7,-3],[-10,-10],[-5,-14],[-1,-16],[3,-16],[10,-32],[-3,-22],[-9,-22],[-7,-30],[-16,-20],[-27,10],[-13,6]],[[7175,7025],[-18,9],[-24,-1],[-6,-23],[2,-30],[-5,-30],[-29,-19],[-29,-3],[-13,-5],[-10,-14],[-3,-14],[2,-24],[-3,-14],[-28,-32],[-8,-19],[15,-17],[9,-5],[9,-7],[7,-8],[4,-10],[3,-13],[5,-7],[5,-6],[4,-9],[4,-22],[0,-23],[3,-20],[12,-16],[3,-8],[0,-13],[-3,-13],[-4,-7],[-6,-2],[-23,8],[-70,6],[-32,7],[-35,18],[-40,11],[-4,-33],[9,-48],[-2,-36],[-5,-10],[-5,-8],[-7,-8],[-7,-6],[-54,-12],[-10,-16],[32,-99],[13,-26],[19,-13],[20,15],[23,1],[21,-14],[16,-23],[5,-27],[-2,-30],[-14,-58],[-5,-11],[-14,-23],[-2,-11],[5,-13],[7,-11],[6,-10],[0,-14],[-10,-13],[-41,-33],[-15,-16],[-25,-21],[-12,-27],[-8,-31],[-16,-33],[-9,-9],[-10,-7],[-21,-9],[21,-29],[23,-13],[26,-2],[31,5],[2,-1],[2,-1],[2,-1],[91,-162],[14,-15],[16,-13],[13,-15],[7,-20],[5,-24],[7,-21],[10,-20],[14,-19],[16,-16],[48,-34],[3,-9],[4,-9],[-1,-42],[7,-9],[18,5],[17,11],[30,28],[18,7],[50,1],[22,6],[-4,-37],[18,-18],[22,-15],[7,-27],[-13,-18],[-48,-29],[-16,-21],[18,-14],[30,-7],[31,3],[19,18],[5,3],[5,1],[5,-1],[1,-1]],[[5892,4743],[6,17],[0,46],[-4,26],[-8,30],[-18,46],[-13,25],[1,14]],[[5624,5191],[-3,-1],[-31,67]],[[5633,4963],[-30,-42],[-19,-18],[-21,-6],[-23,6],[-65,39],[-25,7],[-25,4],[-97,0],[-91,24],[-46,6],[-35,-5],[5,-25],[14,-17],[50,-12],[100,-50],[31,-31],[25,-71],[18,-90],[12,-33],[28,-31],[45,-31],[-12,-115]],[[4097,1790],[-20,17],[-97,86],[-97,85],[-97,86],[-86,75],[-86,76],[-87,76],[-86,75],[-68,60],[-91,55],[-90,53],[-89,54],[-90,54],[-89,54],[-90,53],[-90,54],[-89,54],[-90,54],[-90,54],[-89,53],[-90,54],[-90,54],[-89,54],[-90,53],[-90,54],[-89,54],[-105,63],[-57,33],[-55,22],[-349,67],[-82,14],[-202,35],[-202,34],[-202,35],[-202,35],[-3,-1],[-3,-1],[-3,-1],[-3,-1],[0,9],[123,105],[26,38],[-22,81],[-15,37],[-21,12],[-193,-53],[-11,6],[-7,18],[-50,173],[-1,2],[-1,1],[1,1],[1,0],[79,25],[-69,252],[-48,176],[-47,171],[-35,128],[-42,154],[-48,172],[113,66],[113,67],[113,67],[113,66],[113,67],[113,67],[113,66],[113,67],[113,66],[113,67],[113,67],[113,66],[73,44],[40,23],[113,67],[113,66],[113,67],[150,88],[251,66],[30,19],[23,32],[37,79],[175,330],[9,30],[2,31],[-8,210],[-6,199]]],"transform":{"scale":[0.0009785722625262523,0.0008313192158215858],"translate":[38.77451135200005,29.06313669900004]}};
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
