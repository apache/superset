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
  Datamap.prototype.kenTopo = {"type":"Topology","objects":{"ken":{"type":"GeometryCollection","geometries":[{"type":"MultiPolygon","properties":{"name":"Coast"},"id":"KE.CO","arcs":[[[0]],[[1,2,3,4]]]},{"type":"Polygon","properties":{"name":"Central"},"id":"KE.CE","arcs":[[5,6,7]]},{"type":"Polygon","properties":{"name":"Nairobi"},"id":"KE.NA","arcs":[[8,9,-7]]},{"type":"Polygon","properties":{"name":"Nyanza"},"id":"KE.NY","arcs":[[10,11,12]]},{"type":"Polygon","properties":{"name":"Eastern"},"id":"KE.NA","arcs":[[13,-5,14,-9,-6,15,16]]},{"type":"Polygon","properties":{"name":"Rift Valley"},"id":"KE.","arcs":[[-16,-8,-10,-15,-4,17,-11,18,19]]},{"type":"Polygon","properties":{"name":"Western"},"id":"KE.WE","arcs":[[-13,20,-19]]},{"type":"Polygon","properties":{"name":"North-Eastern"},"id":"KE.NE","arcs":[[-2,-14,21]]}]}},"arcs":[[[9096,2664],[-10,-22],[-23,-3],[-17,22],[2,-11],[-2,-12],[-5,-8],[-8,-4],[-4,-1],[-2,-3],[-4,-2],[-7,-2],[-9,3],[-7,5],[-4,4],[-2,3],[-16,-2],[-22,-7],[-47,-20],[-11,7],[-11,-1],[-9,-9],[-3,-14],[7,-8],[13,-7],[10,-7],[-5,-10],[-16,0],[-10,6],[-5,10],[-3,12],[-27,-4],[0,23],[15,32],[17,24],[23,10],[29,7],[26,11],[11,21],[14,13],[34,-1],[38,-10],[25,-12],[25,-33]],[[6073,4751],[235,-29],[15,4],[10,11],[8,12],[10,12],[13,6],[20,6],[40,6],[38,0],[10,-3],[6,-5],[4,-5],[6,-2],[15,-10],[67,-67],[107,-4],[23,-9],[23,2],[25,5],[26,-1],[20,-9],[11,-9],[14,-8],[38,-5],[9,-4],[8,-6],[3,-5],[7,-2],[45,-9],[16,-6],[20,-10],[17,-12],[11,-16],[17,-10],[7,-9],[14,-29],[14,-5],[18,2],[12,-4],[5,-5],[12,-19],[4,-4],[22,-10],[16,-25],[49,-147],[8,-16],[15,-3],[9,-8],[5,-12],[1,-15],[7,-1],[32,-31],[4,-7],[15,-5],[33,-2],[20,-7],[15,-9],[12,-11],[6,-15],[3,-18],[38,-47],[1,-6],[-2,-16],[2,-16],[11,-10],[-10,-15],[3,-15],[16,-34],[3,-33],[4,-10],[10,1],[8,0],[-2,-15],[-2,-6],[-4,-7],[6,-10],[19,-47],[1,-7],[-1,-21],[17,-21],[7,-17],[8,-30],[44,-73],[18,-15],[-9,-8],[-7,-8],[-9,-19],[27,-2],[22,-15],[14,-21],[5,-22],[28,-27],[15,-39],[5,-88],[9,-39],[12,-37],[8,-66],[4,-11],[8,-9],[51,-89],[11,-12],[17,-14],[9,-15],[3,-66],[7,-27],[2,-1],[-3,-8],[-6,-6],[-5,-4],[-3,-3],[-1,-18],[9,-46],[-2,-8],[-7,-11],[1,-8],[6,-10],[13,-11],[6,-8],[10,-49],[8,-14],[-5,-3],[-8,-8],[-5,-3],[10,-15],[16,-56],[17,-31],[6,-16],[-5,-10],[0,-6],[5,-20],[68,22],[968,356],[8,2],[666,34]],[[9562,3091],[-1,-20],[0,-1],[-96,-80],[-45,-57],[-6,-18],[-27,-14],[-71,-53],[-44,-45],[-26,-13],[-20,20],[-23,-8],[-21,2],[-15,11],[-1,23],[-25,-22],[-5,-24],[-12,-24],[-36,3],[-49,9],[-10,1],[-16,-8],[-25,-23],[-33,-11],[-13,-14],[-14,-12],[-20,1],[-16,7],[-12,7],[-8,10],[-6,15],[1,15],[13,28],[-1,13],[-3,14],[5,13],[19,23],[-45,-28],[-5,-121],[-26,-28],[-24,15],[-23,63],[-23,14],[-13,7],[-11,11],[-12,3],[-15,-14],[9,-16],[3,-13],[-3,-13],[20,7],[16,-3],[11,-12],[4,-17],[-3,-7],[-11,-5],[-3,-6],[4,-10],[9,-2],[9,-2],[4,-7],[3,-75],[7,-40],[16,-26],[11,-2],[14,1],[15,-1],[16,-9],[12,-15],[2,-11],[-14,-27],[-31,-31],[-28,-4],[-4,11],[41,17],[-21,7],[-18,9],[-30,26],[-5,9],[2,5],[-1,4],[-13,4],[2,-2],[-9,-3],[-18,-3],[-31,-14],[-28,-27],[-27,-19],[-26,11],[1,-9],[3,-9],[7,-8],[10,-3],[6,-2],[-2,-7],[-8,-11],[8,-15],[35,-20],[9,-14],[-15,-24],[-34,-28],[-39,-23],[-58,-20],[-77,-75],[-43,-13],[-39,7],[-37,13],[-40,8],[-41,-4],[-126,-32],[-52,-31],[-32,-8],[-36,-19],[-63,-42],[-14,-12],[-11,-15],[-23,-43],[-38,-39],[-5,-17],[2,-8],[19,-20],[1,-7],[-4,-16],[-2,-9],[-23,-66],[-3,-33],[26,-17],[-6,-27],[15,-12],[26,2],[26,16],[1,-12],[-10,-12],[-44,-34],[-26,-29],[-7,-12],[-5,-52],[-8,-18],[-43,-50],[-1,-14],[14,-38],[0,-19],[-8,-16],[-11,-14],[-15,-13],[-17,-10],[-61,-23],[-16,-9],[-30,-29],[-17,-11],[-22,-3],[9,18],[14,39],[2,15],[-22,-5],[-10,-10],[-2,-13],[0,-15],[-1,-10],[-7,-25],[2,-6],[5,-5],[2,-6],[-22,-30],[-26,-55],[-33,-44],[-13,-59],[-14,-24],[-16,-12],[-11,-2],[-27,10],[-6,3],[-17,15],[-6,1],[-33,3],[5,9],[1,4],[-13,8],[-9,-19],[3,-15],[15,-10],[25,1],[-15,-15],[5,-12],[18,-5],[43,15],[14,-8],[8,-16],[4,-15],[-3,-33],[-101,-229],[-32,-25],[-36,-5],[-25,16],[0,35],[-27,-13],[-8,-8],[4,-10],[9,-11],[4,-9],[6,-10],[12,-9],[28,2],[14,-6],[-4,-18],[-26,-24],[-4,-7],[-3,-9],[-9,-13],[-12,-11],[-10,-5],[-12,5],[-9,24],[-10,6],[-8,12],[3,24],[-2,14],[-22,-15],[-32,14],[-15,2],[-14,-9],[13,-10],[15,-5],[33,-6],[-9,-19],[-12,-8],[-40,-8],[-12,0],[-14,1],[-12,-1],[-4,-7],[1,-22],[2,-10],[5,-11],[18,20],[42,3],[44,-11],[24,-19],[-5,-25],[-62,-88],[-40,-84],[-41,-126],[-14,-30],[-11,14],[-11,-1],[-10,-9],[-10,-11],[-2,-6],[1,-13],[-4,-6],[-18,-13],[-4,-4],[-43,-107],[-8,20],[4,30],[-4,14],[-16,-10],[-9,-14],[-8,-16],[-10,-16],[-6,1],[-9,4],[-8,-1],[-3,-15],[2,-8],[20,-23],[-13,-14],[-42,-5],[-48,9],[-30,31],[-1,-6],[-7,-15],[-37,9],[-27,-21],[-23,-30],[-24,-14],[-5,-2],[-5,0],[-4,-2],[-4,-4],[-106,63],[-107,63],[-107,64],[-106,63],[-107,63],[-107,64],[-107,63],[-106,63],[-107,63],[-9,5],[-98,59],[-107,63],[-106,63],[-107,63],[-107,64],[-107,63],[-106,63],[-69,41],[-17,18],[-12,21],[-22,64],[-9,16],[-18,13],[-24,9],[-26,6],[-27,2],[-60,-3],[-3,14],[10,20],[5,17],[-6,8],[-21,3],[-9,7],[-2,11],[3,12],[6,11],[6,10],[19,16],[28,18],[29,14],[24,1],[-2,18],[5,15],[12,9],[23,1],[-25,126]],[[4740,1530],[22,6],[116,13],[10,-1],[12,-1],[20,2],[8,9],[5,12],[20,147],[84,237]],[[5037,1954],[33,-7],[29,7],[152,60],[31,16],[11,11],[8,5],[8,1],[6,-2],[5,-2],[5,-3],[4,-3],[23,-25],[4,-3],[38,-24],[42,-15],[7,-1],[17,-7],[6,-2],[22,-17],[54,-68],[26,-42],[6,-16],[2,-5],[4,-4],[9,-6],[6,-3],[54,-18],[5,-3],[18,-12],[15,-16],[8,-7],[4,-1],[2,0],[8,8],[3,2],[7,3],[13,3],[16,0],[18,-1],[4,1],[5,2],[5,4],[7,4],[7,0],[7,-1],[13,-2],[7,-2],[11,-4],[21,-11],[18,-6],[5,-2],[10,-6],[4,-3],[6,-5],[3,-3],[4,-3],[7,-2],[13,-2],[12,-4],[21,-12],[5,-2],[7,-1],[7,0],[36,5],[8,0],[7,-1],[7,-1],[37,-12],[60,-5],[5,-2],[2,-5],[-3,-8],[-1,-5],[0,-3],[3,-2],[4,0],[5,0],[19,5],[6,3],[5,2],[5,3],[7,1],[21,2],[6,2],[6,2],[19,13],[5,2],[6,2],[7,1],[8,0],[22,-2],[8,0],[7,1],[6,2],[13,2],[7,0],[7,-2],[12,-4],[6,-1],[7,1],[5,2],[12,11],[9,7],[4,2],[4,1],[6,0],[5,-2],[10,-5],[6,-2],[7,-1],[13,-1],[2,2],[0,2],[-515,625],[-2,4],[6,2],[19,-4],[20,-3],[15,0],[16,1],[7,2],[6,2],[22,11],[4,3],[25,29],[4,4],[10,5],[6,2],[21,5],[6,2],[5,2],[14,9],[5,4],[228,376],[6,22],[2,29],[-32,160],[-1,13],[3,14],[13,14],[28,24],[5,9],[2,5],[-5,557],[-9,23],[-148,267],[-569,808],[-1,13],[13,-2],[11,0],[12,5],[28,-11],[37,15],[63,38],[34,0],[74,-20],[30,6],[17,-8],[20,0],[16,2],[7,2],[6,-8],[15,-7],[31,-9]],[[3997,4838],[29,-24],[259,-160],[9,-11],[132,-265],[4,-17],[0,-79],[1,-9],[4,-9],[40,-39],[11,-15],[0,-27],[-1,-8],[2,-74],[3,-12],[6,-17],[3,-4],[4,-4],[2,-4],[-2,-5],[-13,-6],[-166,-51],[-9,-1],[-8,1],[-6,2],[-24,15],[-17,14],[-10,6],[-6,2],[-5,1],[-5,0],[-5,-1],[-6,-2],[-11,-4],[-3,-2],[-3,-5],[-4,-9],[-12,-75],[0,-11],[3,-7],[46,-32],[4,-3],[4,-4],[3,-5],[13,-39],[12,-19],[3,-4],[4,-4],[6,-2],[7,0],[7,1],[7,1],[6,3],[21,10],[5,2],[5,0],[5,-2],[3,-4],[2,-5],[0,-7],[-2,-8],[-4,-10],[-6,-23],[1,-20],[-35,-40],[-14,-11],[-2,-2],[-3,1],[-40,22],[-6,2],[-6,0],[-14,-2],[-6,-2],[-11,-5],[-8,-3],[-12,-2],[-15,1],[-7,1],[-7,0],[-7,0],[-6,-2],[-23,-13],[-9,-7],[-5,-6],[-3,-8],[1,-14],[4,-15],[0,-7],[-15,-34],[-25,-44],[-17,-14]],[[4054,3544],[-19,18],[-12,8],[-17,8],[-36,-6],[-16,-5],[-9,-1],[-10,-1],[-18,0],[-19,2],[-9,3],[-21,8],[-22,10],[-4,4],[-2,5],[0,5],[2,6],[12,17],[0,4],[-2,4],[-4,2],[-12,3],[-3,1],[-9,4],[-7,1],[-6,-1],[-34,-30],[-6,-3],[-7,-3],[-21,-2],[-10,-2],[-11,-4],[-8,-2],[-7,1],[-50,14],[-7,0],[-10,-4],[-13,-8],[-40,-41],[-7,-5],[-16,-6],[-9,-2],[-9,-4],[-7,-6],[-21,-26],[-34,-29]],[[3484,3481],[-10,3],[-21,11],[-19,11],[-6,2],[-8,2],[-146,18],[-7,8],[-2,14],[48,115],[4,4],[6,1],[23,0],[7,1],[6,2],[5,4],[4,6],[1,11],[0,8],[-8,31],[-1,6],[2,18],[9,26],[0,4],[0,1],[-1,2],[-17,19],[-3,5],[-9,22],[-2,5],[0,7],[3,18],[-1,6],[-1,5],[-43,98],[-10,42],[2,9],[10,27],[2,10],[0,8],[-16,58],[-2,19],[-9,31],[-2,5],[-5,2],[-4,1],[-5,1],[-12,3],[-13,4],[-5,2],[-4,4],[-6,9],[-4,5],[-4,3],[-6,1],[-16,0],[-15,-1],[-26,-4],[-4,0],[-2,1],[-2,4],[-5,17],[-5,11],[-3,11],[-1,27],[-10,50],[2,15],[3,9],[2,14],[0,7],[-6,16],[-2,5],[-4,3],[-4,2],[-5,0],[-37,-6],[-6,0],[-4,3],[-3,4],[-3,5],[-3,4],[-5,2],[-7,0],[-7,-1],[-27,-5],[-15,-2],[-7,1],[-6,1],[-6,2],[-3,2],[-3,2],[-62,112],[-5,11],[-2,12],[-1,13],[0,7],[2,6],[14,30],[2,11],[-3,52],[4,25],[4,13],[4,7],[6,20],[18,25],[3,5],[16,41],[7,10],[16,13],[12,6],[51,17],[4,3],[4,4],[3,10],[3,5],[8,3],[14,1],[28,-2],[20,3],[12,3],[66,33],[4,3],[3,5],[4,11],[4,3],[6,1],[9,-4],[6,-4],[30,-25],[4,-4],[3,-5],[5,-17],[6,-6],[11,-6],[24,-5],[12,-5],[8,-4],[29,-26],[6,-2],[8,-1],[13,4],[8,3],[18,9],[6,1],[7,-1],[6,-4],[3,-5],[0,-4],[-2,-3],[-4,-3],[-110,-55],[-10,-6],[-6,-6],[-4,-5],[-2,-5],[-1,-6],[0,-6],[3,-11],[2,-5],[3,-5],[39,-28],[16,-10],[21,-3],[57,-3],[22,-5],[59,7],[90,18],[15,1],[11,-1],[59,-17],[5,-2],[1,-2],[-3,-6],[0,-13],[-4,-20],[-3,-8],[-2,-4],[-4,-4],[-4,-3],[-10,-4],[-3,-3],[0,-4],[7,-16],[3,-5],[50,-50],[13,-10],[15,-8],[5,-2],[3,-1],[6,0],[7,3],[6,4],[7,5],[5,3],[5,0],[16,-7],[7,-2],[7,0],[8,2],[10,8],[15,16],[4,6],[10,11],[21,15],[4,4],[3,4],[4,10],[3,14],[5,41],[-2,9],[-29,39],[-3,5],[-1,5],[-1,13],[4,8],[7,9],[33,25],[15,18],[44,63]],[[4054,3544],[-32,-26],[-7,-7],[-14,-10],[-24,-21],[-5,-3],[-5,-1],[-11,0],[-64,10],[-15,0],[-13,3],[-7,0],[-6,-2],[-5,-4],[-2,-16],[-3,-8],[-6,-7],[-58,-32],[-2,-2],[-1,-4],[3,-5],[18,-20],[-1,-4],[-2,-4],[-10,-8],[-10,-10],[-11,-5],[-35,4]],[[3726,3362],[-20,16],[-14,7],[-7,3],[-14,2],[-34,-2],[-7,1],[-6,1],[-40,13],[-12,7],[-12,9],[-11,13],[-10,15],[-13,11],[-42,23]],[[1086,4810],[10,1],[6,0],[6,-2],[6,-2],[5,-3],[18,-14],[10,-6],[5,-2],[6,-2],[14,-2],[16,0],[24,2],[33,0],[59,-6],[8,1],[14,2],[6,3],[16,8],[6,2],[8,1],[7,1],[8,-1],[5,-2],[5,-3],[13,-10],[4,-3],[6,0],[6,-1],[5,-1],[14,-9],[6,-3],[6,-2],[6,-1],[7,1],[13,4],[5,2],[6,3],[4,4],[8,14],[3,5],[4,4],[5,3],[6,1],[8,1],[7,0],[14,-3],[18,-6],[21,-10],[6,-2],[6,-2],[7,0],[7,1],[6,2],[10,5],[5,2],[4,1],[5,-1],[6,-1],[6,-2],[5,-3],[7,-7],[4,-5],[4,-11],[6,-30],[4,-4],[5,-3],[5,-3],[24,-8],[6,-4],[3,-6],[0,-13],[2,-6],[3,-5],[57,-38],[4,-3],[4,-5],[2,-4],[1,-10],[0,-6],[-6,-34],[-3,-6],[-5,-4],[-10,-3],[-9,0],[-8,0],[-7,1],[-6,2],[-6,2],[-5,3],[-9,7],[-3,4],[-3,5],[-4,11],[-3,4],[-5,3],[-6,2],[-15,1],[-7,2],[-5,2],[-5,4],[-3,4],[-7,15],[-4,5],[-5,3],[-6,2],[-6,0],[-6,-1],[-11,-4],[-6,-2],[-7,0],[-6,2],[-6,2],[-13,10],[-15,9],[-4,3],[-4,5],[-10,13],[-4,4],[-4,2],[-8,-4],[-8,-9],[-30,-46],[-11,-11],[-6,-2],[-12,-4],[-6,-3],[-5,-3],[-4,-4],[-3,-6],[-2,-8],[-2,-47],[-3,-17],[0,-6],[-1,-6],[-3,-7],[-11,-14],[-5,-4],[-14,-10],[-5,-3],[-10,-12],[-2,-3],[-2,-11],[1,-10],[1,-6],[2,-5],[8,-15],[4,-11],[2,-4],[20,-25],[2,-6],[2,-6],[-5,-34],[0,-6],[3,-15],[1,-2],[1,-3],[10,-12],[2,-4],[1,-4],[15,-111],[-3,-29],[-8,-17],[1,-12],[3,-12],[25,-57],[4,-14],[0,-12],[-9,-10],[-15,-9],[-16,-8],[-16,-11],[-14,-11],[-16,-31],[-6,-20],[-5,-8],[-9,-5],[-15,-5],[-334,-79],[-10,0],[-46,3],[-7,1],[-5,2],[-6,2],[-6,1],[-7,-1],[-6,-2],[-26,-15],[-22,-9],[-20,-13],[-4,-4],[-4,-4],[-1,-10],[3,-10],[22,-31],[3,-6],[1,-12],[4,-10],[7,-12],[18,-20],[14,-49],[6,-7],[30,-18],[18,-27],[9,-18],[46,-171],[2,-14]],[[1036,3363],[-202,93],[-269,124],[-269,123],[-93,43],[-47,3],[-17,9],[-2,27],[-19,1],[-6,-1],[-95,0],[-7,210],[-5,140],[21,148],[30,212],[23,164],[-1,40]],[[78,4699],[58,121],[5,7],[18,26],[3,5],[1,6],[1,5],[-4,18],[0,7],[1,5],[3,5],[3,4],[2,3],[13,9],[15,9],[11,4],[24,7],[3,2],[2,4],[3,8],[1,4],[2,34],[4,22],[5,17],[2,4],[3,3],[22,19],[37,19],[8,2],[12,1],[22,-2],[11,2],[8,2],[5,3],[4,4],[3,5],[10,20],[3,4],[3,3],[2,2],[9,5],[6,2],[6,2],[8,1],[9,0],[10,0],[67,-11],[15,-1],[7,0],[7,2],[10,6],[12,4],[7,2],[9,-2],[11,-4],[23,-18],[4,-6],[4,-10],[4,-19],[1,-20],[1,-6],[2,-5],[3,-4],[69,-57],[2,-5],[0,-5],[-4,-16],[4,-7],[10,-7],[23,-7],[33,-17],[6,-5],[3,-4],[1,-6],[0,-5],[-3,-12],[-1,-31],[-4,-11],[-6,-9],[-2,-5],[-3,-9],[-1,-4],[1,-4],[3,-4],[3,-5],[6,-4],[7,-4],[9,-1],[11,1],[16,4],[33,12],[21,4],[8,0],[28,-7],[30,-12],[8,0],[11,1],[28,8],[10,2],[10,0],[26,-4],[18,-1],[30,6]],[[6761,8414],[0,-16],[18,-191],[12,-35],[9,-58],[1,-137],[-2,-16],[-4,-10],[-4,-3],[-28,-16],[-6,-6],[-14,-18],[-8,-6],[-10,-5],[-64,-17],[-12,-4],[-9,-6],[-19,-17],[-5,-3],[-5,-3],[-12,-4],[-33,-6],[-11,-5],[-7,-3],[-7,-5],[-9,-10],[-4,-7],[-1,-8],[0,-14],[-3,-21],[-6,-5],[-8,-4],[-156,-286],[-26,-32],[-66,-17],[-15,-7],[-4,-5],[0,-7],[-3,-4],[0,-5],[4,-6],[6,-16],[18,-29],[18,-64],[4,-57],[15,-62],[4,-11],[2,-6],[7,-37],[3,-5],[1,-25],[-4,-34],[0,-15],[2,-11],[8,-7],[3,-4],[4,-5],[6,-16],[4,-4],[4,-3],[5,-3],[8,-7],[6,-10],[18,-43],[38,-61],[52,-65],[9,-7],[40,-23],[18,-14],[4,-3],[14,-18],[10,-19],[3,-5],[4,-4],[13,-11],[7,-8],[12,-19],[13,-47],[2,-4],[3,-5],[4,-4],[18,-14],[5,-3],[5,-2],[31,-9],[18,-8],[5,-2],[17,-14],[10,-6],[76,-36],[9,-7],[8,-7],[7,-9],[4,-4],[2,-5],[6,-10],[28,-26],[5,-3],[6,-2],[13,-4],[5,-3],[8,-6],[5,-4],[4,-3],[23,-9],[4,-3],[1,-2],[-1,-2],[-195,-65],[-14,-6],[-7,-7],[2,-11],[207,-456],[2,-7],[0,-9],[-11,-6],[-14,-6],[-149,-47],[-3,-4],[-4,-3],[-41,-58],[-15,-16],[-14,-10],[-28,-18],[-17,-16],[-35,-42],[-14,-22],[-3,-9],[-4,-15],[-3,-4],[-5,-5],[-416,-129],[-9,-3],[-5,-3],[-4,-4],[-3,-3],[-16,-29],[-17,-21],[-4,-4],[-5,-3],[-6,-3],[-6,-1],[-77,-8],[-7,-2],[-5,-2],[-22,-10],[-4,-2],[-5,-3],[-6,-7],[-1,-6],[3,-5],[4,-4],[24,-14],[3,-2],[1,-3],[68,-239],[4,-40],[-2,-7],[-3,-7],[-9,-15],[-2,-7],[11,-213]],[[5037,1954],[-14,54],[-13,25],[-370,352],[-5,7],[-4,11],[1,7],[2,6],[8,7],[13,10],[5,3],[6,3],[6,2],[21,4],[7,2],[5,2],[4,4],[7,9],[2,5],[11,54],[2,5],[3,5],[4,3],[4,4],[5,3],[6,3],[11,3],[22,5],[4,1],[-2,5],[-8,8],[-28,15],[-19,6],[-17,3],[-9,0],[-15,-2],[-16,-1],[-7,0],[-38,11],[-78,51],[-8,4],[-25,5],[-6,3],[-29,15],[-23,16],[-34,18],[-70,29],[-35,10],[-61,8],[-54,45],[-24,15],[-20,9],[-27,7],[-12,8],[-12,12],[-13,23],[-7,17],[-1,5],[-15,27],[-2,12],[0,12],[12,36],[-18,22],[-184,181],[-30,43],[-8,17],[-4,12],[1,5],[1,2],[11,23],[8,23],[-4,7],[-12,3],[-33,6],[-16,0],[-11,-1],[-41,-15],[-7,-2],[-7,0],[-7,2],[-6,7],[-3,6],[9,36]],[[3997,4838],[37,15],[120,35],[44,24],[10,6],[129,111],[3,6],[2,6],[4,45],[2,5],[3,7],[6,7],[17,18],[4,6],[4,11],[2,25],[0,7],[-2,6],[-15,30],[-3,5],[-14,16],[-4,4],[-7,9],[-9,21],[-3,11],[1,52],[-1,14],[-2,6],[-3,6],[-6,7],[-13,3],[-565,60],[-15,3],[-5,3],[-2,5],[0,6],[2,6],[3,4],[19,12],[8,8],[3,4],[12,12],[3,4],[3,12],[2,5],[4,4],[9,7],[3,4],[2,7],[1,8],[-3,22],[0,15],[5,19],[5,5],[7,3],[7,0],[14,-2],[8,0],[7,0],[94,16],[28,7],[8,3],[12,6],[6,3],[7,1],[14,1],[11,-1],[6,-1],[6,-2],[16,-8],[5,-2],[13,-3],[22,-3],[4,-3],[6,-6],[8,-5],[4,-3],[5,-2],[6,-2],[15,-1],[15,-1],[6,2],[6,3],[13,10],[6,3],[6,1],[6,0],[6,-1],[6,-2],[5,-3],[17,-14],[21,-11],[4,-3],[4,-4],[39,-46],[11,-20],[11,-12],[6,-9],[3,-5],[3,-18],[3,-6],[4,-3],[8,-7],[8,-8],[8,-8],[5,-3],[12,-4],[13,-3],[7,0],[50,8],[19,6],[7,2],[7,0],[6,0],[6,-2],[10,-5],[12,-8],[4,-2],[11,-3],[8,-1],[9,0],[23,6],[8,0],[6,-2],[14,-8],[5,1],[5,4],[6,8],[6,5],[7,3],[24,8],[18,11],[26,20],[7,4],[17,7],[13,7],[8,7],[8,9],[7,4],[7,1],[6,-2],[6,-3],[8,0],[10,2],[30,14],[10,2],[7,1],[16,-1],[14,-2],[8,0],[8,1],[29,8],[12,4],[6,4],[5,6],[10,15],[6,5],[7,4],[24,12],[9,1],[8,0],[11,-5],[5,-3],[6,-1],[9,1],[49,23],[20,13],[21,18],[9,9],[5,4],[5,2],[11,2],[7,0],[6,-1],[18,-6],[21,-5],[5,0],[2,3],[-27,353],[-6,16],[-13,16],[-76,73],[-15,18],[-6,17],[-13,139],[-6,16],[-15,15],[-68,52],[-10,10],[-3,1],[-2,1],[-4,1],[-4,0],[-5,-1],[-3,0],[-6,-2],[-10,-5],[-17,-14],[-5,-3],[-6,-2],[-6,-1],[-8,-1],[-21,3],[-7,0],[-8,-1],[-6,-1],[-6,-2],[-19,-11],[-22,-9],[-7,-2],[-15,0],[-21,2],[-7,0],[-6,-2],[-11,-5],[-4,-3],[-11,-5],[-6,-2],[-13,-3],[-37,-4],[-13,-3],[-17,-7],[-6,-1],[-7,-1],[-8,0],[-7,1],[-6,2],[-6,3],[-4,3],[-3,4],[-85,165],[-14,17],[-8,7],[-53,34],[-32,29],[-6,9],[-4,10],[-12,71],[-3,6],[-3,4],[-4,4],[-4,3],[-51,21],[-15,9],[-8,7],[-3,5],[-21,45],[-30,45],[-14,16],[-9,7],[-19,12],[-16,9],[-19,12],[-4,4],[-3,4],[-3,4],[-4,10],[-3,5],[-14,13],[-7,4],[-23,9],[-14,3],[-123,9],[-59,-1],[-36,-3],[-6,0],[-5,1],[-2,5],[4,28],[-10,33],[-55,119],[-7,12],[-10,13],[-73,53],[-10,13],[-102,237],[-7,12],[-9,8],[-15,3],[-16,0],[-14,-4],[15,-31],[-8,-22],[-14,-20],[-69,-60],[-10,-5],[-7,-1],[-31,4],[-5,1],[-15,-1],[-12,-2],[-9,-4],[-8,-7],[-33,29],[-8,43],[1,48],[-11,42],[-29,41],[-22,21],[-42,19],[-8,25],[0,71],[-1,7],[-6,11],[-17,24],[-9,28],[-13,23],[-24,34],[-29,20],[-69,37],[-51,37],[-5,5],[-8,31],[-5,8],[-9,1],[-21,-15],[-13,-4],[-13,3],[-16,14],[-10,4],[-50,-1],[-19,5],[-7,21],[34,112],[0,12],[-4,12],[-11,21],[-2,12],[2,10],[12,21],[3,11],[-7,7],[-15,0],[-30,-3],[-43,14],[-9,5],[-7,4],[-8,4],[-10,26],[0,1211]],[[2695,9395],[183,1],[43,5],[13,0],[12,-3],[23,-9],[16,-2],[233,4],[195,3],[11,-2],[19,-9],[7,-1],[3,-1],[241,2],[75,-17],[89,-37],[51,-10],[12,-7],[20,-27],[9,-5],[25,1],[9,-2],[8,-9],[5,-10],[7,-23],[4,-6],[6,-1],[8,0],[7,-2],[68,-35],[122,-65],[122,-64],[142,-76],[102,-53],[114,-61],[129,-69],[120,-63],[124,-66],[39,-20],[23,-19],[32,-42],[19,-19],[16,-7],[38,-10],[28,-20],[16,-2],[39,8],[39,2],[133,-12],[134,-12],[70,4],[63,23],[2,6],[-1,9],[3,9],[12,4],[6,-2],[24,-16],[10,-10],[2,-8],[5,-6],[18,-4],[16,-2],[7,1],[18,6],[2,-4],[1,-5],[7,-4],[73,-4],[0,7],[1,15],[0,6],[34,-36],[19,-17],[23,-10],[123,-28],[94,-20],[32,0],[53,8],[21,-2],[18,-6],[20,1],[72,12],[12,-2],[16,-6],[112,-43],[49,-8],[48,1],[48,22]],[[4740,1530],[-3,13],[-22,112],[-19,25],[-104,48],[-172,79],[-96,44],[-269,124],[-268,123],[-269,124],[-268,123],[-269,124],[-268,123],[-269,124],[-268,123],[-268,123],[-212,98],[-57,26],[-269,123],[-268,124],[-66,30]],[[1086,4810],[21,26],[52,44],[24,23],[9,23],[9,16],[6,8],[6,6],[13,10],[37,23],[12,13],[5,10],[11,36],[10,20],[4,10],[0,8],[-2,4],[-4,5],[-5,10],[-6,16],[-1,13],[11,67],[0,6],[-1,6],[-13,32],[-4,18],[-17,30],[-3,4],[-5,3],[-4,3],[-52,21],[-14,7],[-2,8],[2,44],[4,14],[5,9],[16,7],[7,2],[7,1],[7,1],[7,0],[7,-2],[17,-7],[7,-1],[7,-1],[7,0],[9,4],[9,7],[31,40],[6,4],[5,3],[4,1],[3,1],[4,-1],[16,-3],[8,0],[6,0],[4,0],[5,2],[22,9],[14,3],[7,0],[7,-1],[7,-1],[11,-5],[6,-2],[15,-1],[6,1],[5,1],[4,2],[23,12],[8,7],[5,7],[7,18],[4,6],[5,4],[29,12],[5,4],[10,7],[5,6],[3,7],[0,7],[0,10],[-3,6],[-4,5],[-7,7],[-2,3],[-1,4],[0,26],[-2,16],[-3,5],[-22,25],[-7,15],[-2,3],[-2,3],[-3,2],[-4,2],[-9,4],[-24,7],[-13,3],[-6,2],[-12,5],[-10,5],[-7,2],[-6,1],[-72,2],[-39,-4],[-7,-2],[-6,-2],[-6,-2],[-4,-4],[-4,-3],[-22,-24],[-5,-4],[-6,-2],[-6,0],[-7,1],[-6,3],[-7,1],[-7,1],[-7,-1],[-35,-7],[-26,-7],[-46,-5],[-7,1],[-7,2],[-6,2],[-11,5],[-5,5],[-5,6],[-5,13],[-1,10],[1,10],[2,12],[-2,7],[-3,5],[-6,3],[-6,1],[-8,1],[-7,1],[-6,2],[-6,3],[-128,111],[-23,29],[-2,19],[-36,26],[-11,11]],[[846,5954],[6,9],[2,23],[9,19],[61,11],[42,34],[26,13],[103,9],[40,15],[16,41],[-13,41],[-22,42],[-2,20],[-3,17],[75,50],[26,83],[29,36],[12,5],[27,4],[12,5],[13,10],[9,11],[40,70],[7,22],[1,200],[6,13],[23,24],[5,11],[-7,12],[-29,22],[-11,11],[-9,18],[-5,21],[-1,21],[1,20],[12,46],[0,20],[-56,112],[-23,45],[-48,96],[-9,40],[11,26],[23,14],[25,12],[19,18],[3,23],[-11,18],[-34,29],[-8,19],[-7,52],[-12,14],[-12,-2],[-8,-8],[-10,-8],[-17,1],[-12,10],[-53,90],[-19,89],[-25,65],[-5,9],[-9,9],[-6,2],[-36,14],[-2,2],[-3,2],[-2,4],[-2,3],[-5,2],[-3,-2],[-6,-8],[-3,-1],[-5,-2],[-14,-10],[-8,-2],[-17,4],[-11,9],[-19,25],[-40,36],[-12,18],[-37,156],[-14,22],[-27,14],[-58,14],[-27,14],[-13,23],[-13,127],[-16,41],[-9,11],[-12,10],[-10,11],[-3,13],[4,11],[13,26],[1,9],[-5,12],[-15,22],[-1,11],[7,9],[11,4],[13,3],[12,5],[23,30],[12,41],[3,83],[-8,22],[-18,9],[-24,6],[-23,10],[-41,36],[-22,7],[-34,-8],[-13,-10],[-6,-10],[-6,-4],[-14,7],[-19,41],[-28,30],[-1,5],[-13,-1],[-25,-6],[-24,-1],[-22,-5],[-10,0],[-16,5],[8,8],[25,13],[-16,15],[-19,6],[-3,6],[60,26],[14,13],[-4,15],[-27,11],[-25,1],[-49,-15],[-20,-3],[-29,8],[2,18],[16,24],[13,26],[-3,17],[-15,12],[-18,10],[-15,11],[-10,17],[1,10],[5,10],[5,14],[4,24],[0,12],[-4,12],[-11,12],[-14,10],[-11,12],[-1,14],[1,31],[-15,24],[-28,19],[-37,14],[127,103],[126,103],[126,103],[127,103],[98,42],[87,37],[86,36],[85,35],[122,36],[102,32],[95,29],[102,32],[115,35],[102,32],[87,27],[22,-34],[88,40],[98,44],[27,-27],[-47,-80],[125,0],[94,-23],[-61,-127],[50,-76],[60,-90],[2,0],[111,-31],[7,31],[7,43],[35,20],[48,-3],[4,-60],[94,0],[80,0],[3,-18],[16,-24],[2,-20],[-4,-21],[0,-17],[8,-15],[22,-12],[49,-34],[26,-15],[29,-5],[5,0]],[[78,4699],[-39,105],[-39,107],[4,20],[73,80],[10,11],[101,111],[45,29],[11,13],[3,21],[-14,38],[-1,19],[5,9],[22,21],[9,11],[3,9],[31,101],[1,4],[21,32],[37,20],[51,15],[40,17],[30,27],[21,44],[5,24],[2,13],[11,9],[80,33],[21,16],[18,42],[36,38],[33,66],[7,21],[1,23],[0,23],[6,22],[11,21],[12,19],[26,20],[20,-4],[21,-9],[24,4],[2,0],[7,10]],[[6761,8414],[8,4],[17,-1],[6,-10],[-12,-19],[156,-4],[39,-11],[11,-11],[6,-14],[10,-14],[19,-11],[40,2],[22,27],[27,69],[32,32],[82,61],[99,74],[23,26],[21,32],[35,76],[25,54],[25,25],[107,43],[108,42],[121,49],[57,23],[5,6],[-1,6],[1,4],[12,-1],[4,-1],[4,-1],[3,0],[127,36],[99,28],[7,6],[7,16],[7,6],[162,51],[132,42],[104,33],[79,42],[27,-30],[75,-42],[31,-29],[21,-32],[13,-10],[23,-10],[60,-16],[20,-10],[32,-25],[81,-92],[55,-36],[61,-20],[65,-7],[128,6],[140,7],[63,15],[33,1],[100,20],[20,-1],[33,-11],[18,-3],[18,4],[53,25],[60,-16],[55,-24],[56,-9],[61,28],[-105,-123],[-105,-124],[-104,-124],[-105,-123],[-65,-76],[-65,-77],[-64,-76],[-65,-76],[-103,-84],[-103,-84],[-103,-83],[-102,-84],[-43,-35],[-18,-29],[0,-55],[2,-133],[2,-138],[0,-77],[0,-109],[0,-110],[0,-110],[0,-109],[0,-129],[0,-129],[0,-128],[0,-129],[0,-129],[0,-129],[0,-17],[0,-111],[0,-129],[0,-129],[0,-129],[0,-128],[0,-129],[0,-129],[0,-129],[0,-128],[0,-129],[1,-84],[1,-70],[1,-69],[2,-112],[2,-112],[1,-112],[2,-112],[1,-72],[2,-73],[1,-78],[32,-34],[31,-34],[32,-34],[32,-34],[62,-66],[64,-68],[69,-73],[57,-61],[62,-65],[64,-69],[63,-67],[63,-67],[48,-51],[15,-23],[5,-19],[-4,-65]]],"transform":{"scale":[0.0007995350316031589,0.0009708850872694938],"translate":[33.890468384000144,-4.677504164999959]}};
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
