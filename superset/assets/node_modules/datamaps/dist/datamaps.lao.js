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
  Datamap.prototype.kenTopo = '__KEN__';
  Datamap.prototype.kgzTopo = '__KGZ__';
  Datamap.prototype.khmTopo = '__KHM__';
  Datamap.prototype.kirTopo = '__KIR__';
  Datamap.prototype.knaTopo = '__KNA__';
  Datamap.prototype.korTopo = '__KOR__';
  Datamap.prototype.kosTopo = '__KOS__';
  Datamap.prototype.kwtTopo = '__KWT__';
  Datamap.prototype.laoTopo = {"type":"Topology","objects":{"lao":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Bokeo"},"id":"LA.BK","arcs":[[0,1,2,3]]},{"type":"Polygon","properties":{"name":"Louang Namtha"},"id":"LA.LM","arcs":[[4,-4,5]]},{"type":"Polygon","properties":{"name":"Xaignabouri"},"id":"LA.XA","arcs":[[6,7,-2,8,9]]},{"type":"Polygon","properties":{"name":"Champasak"},"id":"LA.CH","arcs":[[10,11,12,13]]},{"type":"Polygon","properties":{"name":"Saravan"},"id":"LA.SL","arcs":[[14,-14,15,16,17]]},{"type":"Polygon","properties":{"name":"Savannakhét"},"id":"LA.SV","arcs":[[18,-17,19,20]]},{"type":"Polygon","properties":{"name":"Vientiane [prefecture]"},"id":"LA.VT","arcs":[[21,22,23]]},{"type":"Polygon","properties":{"name":"Vientiane"},"id":"LA.VI","arcs":[[24,25,-24,26,-7,27]]},{"type":"Polygon","properties":{"name":"Xiangkhoang"},"id":"LA.XI","arcs":[[28,29,-25,30,31]]},{"type":"Polygon","properties":{"name":"Houaphan"},"id":"LA.HO","arcs":[[-32,32,33]]},{"type":"Polygon","properties":{"name":"Louangphrabang"},"id":"LA.LP","arcs":[[-33,-31,-28,-10,34,35,36]]},{"type":"Polygon","properties":{"name":"Oudômxai"},"id":"LA.OU","arcs":[[-35,-9,-1,-5,37,38]]},{"type":"Polygon","properties":{"name":"Phôngsali"},"id":"LA.PH","arcs":[[-36,-39,39]]},{"type":"Polygon","properties":{"name":"Bolikhamxai"},"id":"LA.BL","arcs":[[40,41,-22,-26,-30,42]]},{"type":"Polygon","properties":{"name":"Khammouan"},"id":"LA.KH","arcs":[[-21,43,-41,44]]},{"type":"Polygon","properties":{"name":"Attapu"},"id":"LA.AT","arcs":[[45,-12,46]]},{"type":"Polygon","properties":{"name":"Xékong"},"id":"LA.XE","arcs":[[-47,-11,-15,47]]}]}},"arcs":[[[1495,7450],[8,-27],[13,-26],[3,-18],[-4,-130],[-19,-29],[-30,-26],[-42,-18],[-44,5],[-78,47],[-52,-8],[-41,-22],[-13,-42],[-27,-29],[-32,-26],[-28,-14],[-29,-11],[-121,-3],[-107,-33],[2,-48],[26,-52]],[[880,6940],[-19,-15],[-93,-46],[-13,-4],[-17,-2],[-18,3],[-13,0],[-14,-7],[-26,-8],[-29,1],[-40,-21],[-44,-7],[-44,-2],[-57,13],[-43,6]],[[410,6851],[17,18],[15,33],[9,10],[10,6],[26,9],[11,6],[13,18],[5,19],[7,41],[34,74],[33,83],[9,46],[-2,60],[-3,12],[-6,-1],[-7,-16],[-10,-4],[-22,6],[-21,11],[-10,10],[-5,7],[-22,8],[-10,6],[-5,6],[-7,16],[-6,9],[-34,38],[-76,138],[-26,25],[-50,11],[-48,-9],[-40,-22],[-26,-28],[-15,-42],[-2,-2],[-8,-1],[-29,-9],[-4,-2],[-12,-10],[0,-45],[-20,-17],[-23,0],[-24,10],[-18,19],[-8,22],[3,41],[-2,20],[-1,15],[4,16],[15,15],[13,16],[5,21],[3,25],[12,36],[17,104],[14,40],[17,31],[0,15],[10,19],[29,35],[7,15],[5,19],[14,14],[35,26],[34,35],[21,15],[52,13],[17,16],[12,18],[18,15],[25,5],[115,-16],[56,-13],[31,1],[43,11],[39,19],[12,7]],[[675,8069],[1,-2],[35,-41],[61,-15],[48,-34],[22,-52],[23,-22],[29,-18],[20,-23],[13,-27],[34,-53],[-1,-49],[11,-60],[42,-14],[98,9],[37,-23],[29,-37],[22,-41],[-1,-38],[4,-30],[49,-34],[29,-9],[81,-17],[93,19],[41,-8]],[[2208,8443],[16,-22],[-16,-89],[-20,-42],[-29,-36],[-52,-16],[-50,-22],[-45,-32],[-4,-44],[16,-18],[-7,-18],[-57,1],[-21,-8],[-51,-11],[-60,-45],[-48,-77],[-47,-21],[128,-36],[14,-29],[48,-32],[11,-18],[10,-91],[-37,-92],[-20,-25],[-26,-20],[-23,-27],[-43,-68],[-104,-40],[-133,-7],[-64,4],[1,-12]],[[675,8069],[25,16],[33,27],[0,7],[-38,7],[-117,-17],[-25,14],[3,23],[12,48],[3,25],[5,6],[25,14],[7,7],[-2,9],[-16,33],[24,9],[59,10],[25,12],[16,18],[69,104],[42,142],[1,14],[0,13],[4,9],[17,3],[13,0],[12,-2],[11,-4],[10,-6],[25,-8],[30,3],[49,17],[14,10],[45,38],[18,5],[124,54],[184,125],[19,7],[5,18],[-3,21],[21,-1],[16,-20],[1,-34],[-26,-95],[5,-24],[10,-6],[38,-17],[24,-15],[6,1],[3,0],[2,-10],[-15,-33],[-21,-23],[3,-8],[12,-10],[2,-4],[-1,-16],[-14,-43],[15,-14],[19,-32],[13,-16],[20,-15],[21,-6],[23,2],[28,10],[64,36],[25,8],[150,24],[30,-1],[28,-4],[45,-12],[9,-1],[6,-4],[5,-13],[-2,-10],[-7,-11],[-5,-12],[6,-11],[19,-2],[52,18],[26,0],[20,-14],[24,-36],[21,-13],[18,-1],[26,4],[24,7],[14,8],[2,12]],[[2264,5983],[-2,-20],[-5,-13],[-3,-13],[5,-10],[7,-9],[4,-10],[2,-24],[-1,-27],[-13,-44],[-4,-21],[8,-18],[56,-51],[14,-39],[-10,-35],[-40,-69],[-6,-25],[-6,-49],[-6,-22],[-41,-61],[-21,-23],[-28,-55],[-14,-13],[-2,-3],[-30,-20],[-15,-5],[-17,-3],[-17,1],[-14,7],[-20,-16],[-24,-43],[-15,-18],[-29,-17],[-20,-7],[-5,-10],[-1,-14],[-3,-11],[-13,-16],[-19,-18],[-23,-16],[-23,-6],[-29,-4],[-12,-11],[-7,-15],[-11,-18],[-62,-59],[-23,-38],[-6,-48],[7,-15],[25,-37],[5,-14],[9,-84],[-3,-35],[-9,-32],[-1,-30],[28,-40],[6,-12],[9,-8],[20,-4],[32,6],[11,-4],[7,-17],[9,0],[9,6],[19,8],[18,2],[9,-12],[-4,-9],[-24,-35],[0,-7],[9,-6],[3,-2]],[[1914,4543],[-15,-5],[29,-20],[-26,-16],[-45,-16],[-26,-22],[-5,-10],[-6,-8],[-5,-10],[-3,-2],[-12,22],[-3,8],[-1,5],[-4,1],[-5,-2],[-6,-4],[-17,-15],[-20,-1],[-20,1],[-18,-5],[-8,-10],[8,-3],[14,-1],[7,-2],[-1,-7],[-2,-3],[-24,-25],[-8,-3],[-10,1],[-17,-5],[-146,-102],[-24,-27],[-26,-43],[-9,-10],[-15,-5],[-18,-3],[-14,-7],[-3,-17],[-22,-27],[-8,-6],[-12,-7],[-5,0],[-5,3],[-38,13],[-39,20],[-23,4],[-18,20],[-22,16],[-24,14],[-25,11],[-58,9],[-47,7],[-22,14],[0,26],[18,24],[44,44],[28,53],[3,9],[6,21],[-2,24],[-4,11],[3,10],[9,7],[12,6],[1,3],[1,2],[-1,3],[-1,2],[-9,8],[-3,8],[3,7],[9,6],[27,10],[7,15],[-4,40],[5,24],[10,12],[42,19],[35,26],[20,28],[17,31],[23,31],[18,12],[42,22],[10,15],[-4,16],[-22,44],[-5,22],[6,21],[19,44],[3,18],[-4,11],[-9,5],[-10,5],[-7,7],[-11,23],[-4,8],[-1,41],[3,12],[7,8],[22,21],[4,8],[-13,16],[-83,32],[-11,9],[-31,24],[-18,21],[-9,20],[7,24],[39,33],[9,22],[3,12],[5,6],[85,39],[17,14],[5,13],[-1,26],[4,12],[9,7],[23,8],[12,5],[36,29],[17,19],[7,18],[-7,18],[-31,26],[-7,21],[5,19],[19,38],[6,20],[-7,70],[2,22],[11,21],[32,31],[13,18],[13,38],[9,16],[56,46],[-11,34],[-35,34],[-58,43],[-15,14],[-9,18],[-3,28],[4,68],[-27,98],[0,7],[2,6],[0,6],[-4,10],[-8,5],[-22,4],[-9,5],[-8,35],[7,47],[20,42],[30,15],[30,7],[18,26],[7,33],[-3,29],[-5,15],[-7,12],[-10,9],[-18,8],[-22,5],[-14,-3],[-12,-7],[-15,-7],[-32,-8],[-37,-3],[-38,2],[-37,12],[-58,30],[-29,9],[-37,3],[-117,-1],[-8,1],[-7,-1],[-12,-6],[-5,-6],[-16,-23],[-54,-54],[-61,-48],[-12,-15],[-10,3],[-10,12],[-12,11],[-19,9],[-107,35],[-35,-2],[-28,-17],[-15,-21],[-11,-14],[-22,-2],[-38,10],[-38,14],[-24,12],[-16,14],[-4,17],[0,19],[-4,19],[-11,16],[-27,28],[-11,14],[-8,20],[-3,38],[-4,19],[-9,13],[-14,15],[-8,9],[-6,16],[5,21],[32,36]],[[880,6940],[22,16],[16,7],[19,2],[161,-22],[61,-16],[46,-30],[5,8],[9,11],[4,6],[10,0],[17,-17],[22,6],[33,26],[33,20],[12,4],[17,0],[14,-6],[11,-7],[25,-10],[86,-48],[31,-8],[398,3],[50,9],[29,28],[-16,9],[17,13],[28,12],[20,5],[14,7],[39,32],[15,10]],[[2128,7010],[30,-31],[19,-21],[21,-17],[15,-22],[2,-55],[-24,-54],[-12,-21],[1,-71],[15,-29],[37,-2],[38,3],[12,-8],[-12,-40],[2,-156],[6,-17],[11,-15],[16,-15],[20,-11],[52,-20],[14,-13],[-9,-12],[-44,-38],[-11,-18],[-6,-23],[-31,-38],[-8,-16],[0,-22],[8,-69],[-2,-23],[-11,-39],[-13,-114]],[[8293,1730],[68,-22],[61,-65],[45,-17],[46,-1],[29,-9],[138,-93],[7,-99],[8,-1],[9,2]],[[8704,1425],[-2,-5],[-3,-4],[24,-13],[29,-5],[54,10],[19,-15],[14,-21],[18,-13],[16,-18],[13,-58],[0,-60],[-24,-35],[20,-47],[-29,3],[-55,-13],[-14,-15],[-24,-16],[-24,-25],[-3,-33],[-20,-27],[-40,-7],[-39,2],[-27,-16],[-67,19],[-37,2],[-35,19],[-27,28],[-1,30],[6,31],[-4,15],[2,16],[15,30],[4,36],[-27,23],[-36,-12],[-30,-21],[-31,14],[-16,32],[-32,14],[-39,0],[-32,-15],[-19,-30],[-57,-38],[-60,-52],[-55,-73],[3,-86],[20,-31],[26,-27],[37,-18],[33,-22],[27,-94],[24,-21],[28,-20],[23,-29],[6,-33],[0,-15],[8,-14],[-15,-30]],[[8249,622],[-9,-1],[-17,-5],[-18,2],[-13,2],[-80,43],[-8,7],[-12,-20],[-14,-60],[-9,-25],[-19,-25],[-21,-11],[-26,-2],[-46,2],[-32,5],[-20,-1],[-14,1],[-7,-1],[-4,-5],[-3,-18],[-4,-5],[-23,-1],[-58,17],[-27,4],[-6,-13],[-2,-13],[2,-14],[6,-12],[26,-18],[15,-19],[4,-22],[-5,-29],[11,-23],[19,-15],[45,-25],[20,-20],[34,-69],[18,-18],[21,-15],[18,-17],[6,-22],[-9,-22],[-21,-15],[-24,-13],[-19,-17],[-16,-18],[3,-54],[-20,-21],[-26,-1],[-69,15],[-31,1],[-32,-11],[-33,-3],[-33,6],[-5,3],[-30,14],[-113,85],[-23,29],[-15,32],[-19,29],[-37,17],[-15,0],[-28,-3],[-19,2],[-21,7],[-14,8],[-13,0],[-21,-12],[-10,20],[-20,18],[-24,9],[-20,-6],[-7,9],[-9,8],[-10,7],[-11,6],[-37,-22],[-19,-10],[-22,-5],[-32,-18],[-37,-11],[-39,-5],[-37,1],[-22,2],[-13,5],[-11,9],[-34,40],[-10,5],[-19,5],[-9,5],[-24,20],[-79,102],[-12,25],[-5,27],[0,36],[18,0],[69,14],[24,8],[10,9],[16,25],[9,7],[13,-1],[23,-14],[17,-1],[8,5],[25,21],[10,8],[16,4],[35,6],[13,5],[6,9],[11,26],[7,12],[8,8],[31,24],[42,48],[16,32],[4,34],[-19,77],[2,36],[10,54],[-5,11],[-14,21],[-2,26],[6,26],[10,22],[6,3],[19,4],[5,4],[0,6],[-9,17],[-2,17],[3,7],[5,1],[21,0],[7,2],[10,26],[-22,37],[13,22],[53,29],[12,15],[-35,6],[-17,11],[-39,47],[-2,5],[1,13],[-3,6],[-6,1],[-17,-3],[-7,2],[-32,28],[-29,5],[-11,20],[0,26],[5,25],[9,23],[11,17],[54,48],[37,26],[38,21],[5,1],[1,32],[-5,25],[-4,5],[-26,-5],[-25,0],[-27,4],[-21,12],[-8,21],[12,26],[26,14],[62,17],[47,26],[5,4]],[[7261,1762],[5,0],[31,11],[19,20],[36,3],[32,-11],[31,-7],[30,6],[13,11],[16,3],[12,-8],[11,-10],[15,-8],[16,-5],[15,5],[12,8],[13,1],[12,-3],[83,1],[45,9],[35,10],[32,-15],[30,9],[32,1],[30,7],[29,0],[26,-26],[12,-29],[-27,-25],[-8,-34],[78,-73],[35,-13],[65,35],[58,49],[34,18],[36,11],[47,6],[41,11]],[[9301,2644],[-1,-2],[-20,-31],[-26,-22],[-25,-27],[-7,-22],[-10,-20],[-48,-13],[-31,-20],[-33,-13],[-36,9],[-12,-12],[-17,-9],[-48,2],[-45,6],[-29,14],[-33,3],[-22,-31],[-10,-36],[9,-17],[6,-18],[-14,-10],[-17,-10],[-61,-56],[-46,-58],[-35,-63],[-29,-20],[4,-27],[33,-19],[26,-24],[-20,-14],[-14,-25],[23,-31],[9,-37],[-7,-7],[-9,-12],[0,-15],[3,-15],[3,-27],[-15,-16],[-68,9],[-46,-26],[-79,-1],[-49,8],[-45,-7],[-14,-28],[-27,-17],[-37,6],[-33,15],[-35,4],[-31,-11],[-7,-29],[-15,-4],[-15,-9],[22,-56],[75,-23]],[[7261,1762],[16,14],[8,21],[2,49],[6,25],[32,73],[14,59],[-14,56],[-37,46],[-58,32],[-57,17],[-29,3],[-55,-4],[-19,2],[-16,8],[-17,14],[-14,19],[-52,96],[-16,43],[2,41],[32,31],[28,9],[14,7],[8,9],[-1,3]],[[7038,2435],[101,-9],[79,-31],[88,-21],[83,-29],[13,-10],[14,-8],[41,0],[65,-31],[69,7],[33,-10],[35,-4],[61,42],[57,49],[38,1],[37,-9],[39,1],[68,26],[26,20],[-2,29],[-14,29],[-2,60],[-9,29],[2,30],[9,13],[15,8],[22,3],[6,8],[4,7],[42,3],[42,-6],[31,-9],[26,-15],[18,-36],[27,-27],[8,22],[6,28],[24,4],[71,-11],[34,12],[47,2],[46,11],[30,25],[37,8],[32,-14],[32,-2],[23,13],[41,11],[18,28],[-9,38],[3,28],[33,54],[22,16],[30,-17],[34,3],[65,25],[17,29],[5,35],[-17,29],[-15,2],[-17,-1],[-9,5]],[[8793,2928],[1,1],[3,9],[0,9],[6,9],[36,20],[14,12],[6,19],[28,41],[32,-1],[23,-30],[3,-47],[-5,-39],[-2,-3],[-4,-4],[-3,-5],[0,-7],[5,-3],[9,3],[8,3],[5,1],[16,-31],[12,-15],[23,-16],[32,-15],[9,-7],[6,-11],[4,-26],[4,-8],[14,-8],[17,-2],[45,1],[52,-5],[19,-5],[3,-1],[25,-10],[25,-16],[12,-15],[14,-63],[7,-15],[4,-4]],[[8334,3612],[6,-11],[3,-11],[0,-1],[12,-8],[23,-9],[25,-8],[23,-4],[30,-8],[37,30],[12,-19],[0,-26],[2,-311],[7,-29],[12,-25],[30,-28],[25,-13],[27,-9],[18,-1],[20,-8],[5,-13],[-6,-63],[2,-13],[19,-46],[20,-31],[29,-19],[40,5],[0,-13],[4,-5],[9,1],[13,4],[12,8]],[[7038,2435],[-2,6],[-10,6],[-13,4],[-153,33],[-55,2],[-13,2],[-172,53],[-37,11],[-28,18],[-20,24],[-13,28],[-5,30],[1,52],[-5,25],[-14,23],[-11,8],[-25,12],[-12,5],[-10,7],[-26,23],[-10,8],[-36,17],[-12,9],[-9,11],[-6,11],[-12,37],[-11,21],[-14,19],[-17,18],[-22,16],[-75,34],[-23,17],[-14,20],[-7,24],[-1,27],[6,50],[14,48],[19,44],[1,13],[0,12],[-29,97],[-1,13],[3,10],[0,4],[9,26],[3,14],[-1,14],[-5,13],[-13,24],[-4,12],[-5,39]],[[6143,3529],[40,-35],[74,-8],[18,30],[-20,67],[-22,19],[-27,-15],[2,21],[27,26],[28,17],[4,33],[31,10],[34,-10],[32,-6],[21,19],[28,11],[38,-12],[68,14],[30,-24],[44,-4],[40,12],[31,19],[32,11],[31,-17],[22,-28],[31,-20],[40,-1],[15,5],[16,3],[33,-10],[50,19],[36,33],[67,-4],[81,7],[145,-55],[53,-11],[19,30],[8,48],[48,8],[50,-9],[106,-39],[105,-29],[139,-7],[133,16],[16,9],[15,12],[5,18],[7,18],[37,-5],[35,-17],[61,-53],[36,-13],[40,-5],[75,-22],[82,6],[1,1]],[[3709,5102],[67,-19],[54,-31],[10,-24],[9,-20],[1,-22],[3,-9],[-4,-10],[-3,-12],[-3,-8],[-6,-7],[-5,-8],[1,-13],[9,-13],[12,-6],[14,0],[15,7],[15,20],[13,23],[15,5],[24,-32],[1,-2]],[[3951,4921],[-10,-4],[-11,-11],[-7,-15],[-2,-22],[11,-68],[-6,-11],[-13,-8],[-12,-16],[-15,-17],[-23,-8],[-22,5],[-41,23],[-24,5],[-21,-4],[-114,-43],[-19,-9],[-8,-13],[-77,-35],[-48,-38],[-20,-10],[-47,-10],[-18,-9],[-7,-18],[7,-21],[13,-17],[0,-9],[-29,4],[-68,28],[-19,4],[0,11],[23,76],[-17,47],[-43,18],[-113,0],[-48,8],[-44,19],[-36,25],[-24,27],[-40,-2],[-39,17],[-67,49],[-31,35],[-10,5],[-4,4],[-40,24],[-13,20],[-5,19],[-8,17],[-25,12],[-61,2],[-38,2],[-9,-6],[-21,-19]],[[2588,4984],[-1,0],[-6,6],[-5,11],[-8,10],[-2,60],[25,93],[1,31],[-20,27],[9,24],[33,-7],[36,-16],[30,12],[25,24],[41,7],[41,-1],[27,-23],[23,-26],[14,-39],[44,-26],[57,-13],[54,-18],[38,-6],[39,5],[16,-6],[18,-9],[44,3],[22,-19],[6,-6],[15,-2],[15,-5],[6,-14],[0,-20],[2,-5],[4,2],[35,-6],[20,5],[18,-14],[29,-1],[60,45],[53,5],[49,14],[36,16],[108,18],[70,-18]],[[3500,6291],[17,-27],[46,-17],[21,-11],[16,-3],[41,-37],[38,-16],[31,-20],[21,-4],[21,4],[25,2],[113,-22],[28,-10],[40,-32],[46,-7],[48,-2],[132,-22],[16,4],[14,6],[46,2],[36,13],[29,-4],[29,-2],[27,-18],[33,0],[9,25],[21,8],[22,3],[41,-5],[35,-22],[30,-28],[32,-24],[41,-3],[58,-17],[85,3],[53,-24],[41,-14],[49,3],[43,-12],[32,-26],[11,-75],[-11,-78]],[[5006,5782],[-41,-14],[-40,-17],[-29,-20],[-36,-7],[-35,11],[-32,19],[-38,18],[-33,23],[-38,16],[-40,11],[-54,45],[-44,-3],[-70,-20],[0,-30],[7,-34],[16,-31],[15,-3],[6,-9],[-14,-7],[-21,-1],[-13,-28],[5,-37],[11,-37],[7,-39],[0,-49],[-15,-42],[-30,-25],[-35,-25],[-93,-45],[-104,-21],[-159,-7],[-112,-16],[-259,13],[-88,-16],[48,-87],[28,-27],[30,-23],[16,-58],[-13,-58]],[[2588,4984],[-200,-181],[-27,-7],[-51,24],[-52,12],[-12,13],[-9,0],[-21,-17],[-11,-21],[-12,-50],[-32,-76],[-5,-24],[-122,-20],[-22,-12],[-11,-22],[-15,-13],[-30,16],[0,-18],[-3,-15],[-6,-13],[-9,-10],[-24,-7]],[[2264,5983],[37,25],[28,17],[12,13],[12,9],[40,6],[64,51],[40,69],[13,48],[14,16],[26,7],[19,12],[14,16],[21,14],[19,15],[20,72],[40,20],[47,7],[35,2],[34,-7],[18,-17],[21,-15],[44,8],[41,-24],[44,20],[38,12],[19,-13],[22,-12],[38,-3],[38,3],[-7,-20],[-11,-19],[28,-10],[27,-6],[16,-23],[11,-27],[43,-34],[46,-29],[97,40],[72,18],[56,47]],[[5422,6739],[-56,-13],[-29,0],[-6,-6],[-9,-7],[-10,-18],[-11,-7],[-27,-3],[-25,7],[-63,27],[-15,4],[-13,-5],[-7,-18],[3,-15],[26,-60],[15,-17],[42,-21],[15,-10],[8,-19],[2,-20],[4,-19],[15,-16],[1,-1],[-6,-13],[-11,-5],[-15,-3],[-13,-7],[-8,-12],[-6,-27],[-4,-12],[-11,-16],[0,-1],[-4,5],[-20,-2],[-31,-10],[-30,-13],[-28,-5],[-16,-12],[-26,-33],[-20,-13],[-48,-17],[-17,-11],[-11,-20],[13,-6],[24,1],[21,-2],[18,-28],[6,-8],[10,-6],[33,-15],[39,-23],[2,0],[28,10],[27,1],[28,-6],[146,-55],[53,-30],[14,-12],[5,-23],[0,-21],[11,-10],[39,10],[26,-6]],[[5500,6046],[-2,-21],[-13,-38],[7,-40],[0,-40],[-27,-23],[-30,-19],[-8,-31],[-18,-26],[-33,-22],[-29,-28],[-29,-36],[-43,-14],[-35,-2],[-34,0],[-19,8],[-17,12],[-116,46],[-48,10]],[[3500,6291],[-27,67],[-32,32],[-37,27],[-17,60],[14,61],[60,39],[22,25],[26,21],[78,45],[61,46],[17,22],[-5,27],[53,-2],[49,8],[9,55],[2,55],[35,20],[41,16],[28,17],[32,11],[66,4],[26,19],[17,25]],[[4018,6991],[59,15],[61,4],[27,-25],[35,-16],[65,23],[29,-14],[28,-19],[67,-5],[68,-17],[34,8],[29,19],[36,10],[37,4],[46,10],[30,31],[38,-15],[36,4],[2,34],[10,39],[60,38],[35,5],[36,-1],[71,-35],[52,-56],[-2,-28],[8,-27],[-10,-35],[-14,-31],[35,-14],[10,-10],[27,-37],[13,-7],[18,-6],[113,26],[18,13],[6,22],[15,20],[20,14],[43,-24],[50,-3],[28,9],[23,17],[5,26],[13,19],[6,-55],[-31,-79],[3,-28],[13,-35],[2,-39],[0,-1],[1,0]],[[4018,6991],[-6,50],[4,83],[6,26],[-1,18],[9,15],[16,10],[13,13],[-9,16],[-46,47],[-17,27],[43,54],[90,74],[27,30],[3,46],[-7,42],[9,14],[8,17],[-25,1],[-23,6],[-26,32],[-16,32],[31,30],[19,67],[-7,70],[6,56],[16,47],[31,18],[34,15],[76,20],[68,30],[5,6],[2,6],[-1,7]],[[4350,8016],[2,0],[27,13],[9,7],[4,8],[7,3],[19,-6],[16,-13],[24,-39],[14,-15],[10,-7],[11,-5],[11,-2],[14,-1],[81,-15],[26,-12],[51,-46],[29,-21],[4,-5],[6,-3],[14,-2],[12,2],[17,4],[14,6],[8,6],[-1,10],[-13,22],[-2,11],[6,16],[8,4],[12,1],[16,5],[27,14],[5,8],[-4,11],[-3,24],[5,19],[11,24],[14,21],[12,13],[15,4],[27,-3],[13,1],[12,6],[20,14],[10,6],[97,26],[27,9],[13,3],[16,0],[48,7],[61,59],[47,2],[9,-4],[20,-12],[11,-5],[13,-1],[30,-1],[14,-2],[37,-11],[10,-5],[8,-9],[14,-24],[4,-6],[9,0],[30,7],[13,1],[12,-3],[13,-6],[12,-6],[9,-7],[16,-18],[21,-36],[18,-17],[11,-6],[20,-7],[10,-6],[7,-8],[11,-21],[10,-8],[27,-7],[30,1],[27,-3],[18,-16],[13,-37],[22,-18],[68,-28],[75,-21],[19,-16],[-1,-5],[-10,-27],[-85,-97],[-29,-20],[-33,-8],[-34,5],[-33,21],[-28,-45],[-76,-43],[-8,-22],[41,-22],[54,-12],[190,4],[18,-9],[30,-35],[21,-12],[51,-17],[19,-12],[5,-10],[4,-13],[2,-13],[-1,-11],[-9,-16],[-10,-2],[-11,0],[-11,-7],[-5,-15],[-2,-24],[1,-24],[5,-15],[45,-19],[56,10],[60,17],[54,2],[117,-53],[1,-9],[-7,-13],[2,-26],[18,-22],[50,-28],[10,-18],[-4,-5],[-18,-3],[-5,-2],[0,-8],[4,-10],[2,-21],[4,-15],[3,-14],[-5,-16],[-5,-4],[-14,-9],[-17,-2],[-39,3],[-25,-3],[-7,-6],[-2,-10],[-12,-16],[-30,-19],[-72,-36],[-25,-26],[-9,-22],[7,-6],[39,-2],[25,-7],[10,-7],[1,-10],[-3,-20],[-13,-36],[-26,-17],[-33,-12],[-31,-24],[-25,-6],[-18,-2],[-17,-4],[-21,-12],[-17,-16],[-11,-16],[-42,-93],[-11,-12],[-13,-1],[-22,11],[-12,2],[-11,-3],[-21,-11],[-11,-5],[-31,-2],[-22,4],[-75,37],[-34,13],[-11,5],[-19,16],[-12,15],[-16,10],[-26,2],[-24,-5],[-62,-33],[-24,34],[-46,13],[-17,13],[-38,-9]],[[2128,7010],[53,12],[108,8],[47,11],[44,25],[69,64],[32,23],[23,7],[73,-7],[21,5],[74,35],[43,4],[22,36],[35,27],[10,40],[-19,37],[-40,44],[3,49],[18,32],[-4,33],[-23,17],[-18,21],[5,34],[57,105],[26,63],[34,62],[5,27],[90,11],[46,42],[20,54],[2,23],[-10,20],[-11,15],[2,15],[-7,28],[21,47],[0,24],[-12,30],[-42,47],[-2,32]],[[2923,8212],[49,-20],[42,-22],[40,-1],[38,-6],[16,-14],[6,-23],[73,-23],[76,76],[29,16],[33,6],[44,-6],[21,36],[19,9],[89,30],[1,7],[6,9],[11,3],[38,3],[12,19],[1,31],[10,55],[13,21],[20,0],[21,-5],[107,7]],[[3738,8420],[12,-45],[9,-20],[7,-11],[6,-8],[10,-4],[20,2],[33,-11],[20,-20],[30,-53],[41,-74],[24,-35],[38,-39],[20,-15],[8,-6],[14,-5],[24,-2],[13,-3],[11,-5],[18,-11],[13,-4],[16,0],[9,2],[16,4],[12,1],[22,-5],[74,-33],[37,-10],[14,-2],[7,0],[34,8]],[[2208,8443],[3,11],[-9,17],[-5,13],[18,13],[30,-5],[12,2],[11,6],[8,7],[3,6]],[[2279,8513],[24,-10],[60,-39],[23,-6],[21,-10],[14,-13],[103,-24],[41,-17],[62,-68],[37,-30],[46,-23],[45,-3],[44,11],[46,-14],[46,-24],[32,-31]],[[2279,8513],[1,4],[2,12],[-5,15],[-11,12],[-14,11],[-17,8],[-69,21],[-18,14],[-10,20],[1,20],[13,43],[5,115],[20,25],[5,22],[-18,47],[2,19],[19,10],[29,3],[28,7],[16,21],[-3,23],[-19,9],[-24,6],[-20,12],[-5,12],[5,24],[-2,11],[-7,10],[-22,16],[-5,7],[-1,17],[5,21],[26,65],[0,12],[-33,24],[-7,9],[-16,29],[-31,34],[-3,10],[-1,9],[-3,9],[-9,10],[-47,11],[-29,15],[-12,16],[-9,47],[-10,24],[-36,48],[-13,24],[-1,26],[9,21],[7,22],[-7,31],[-16,20],[-41,41],[-3,20],[21,21],[11,9],[14,6],[17,0],[16,-4],[16,-2],[18,7],[6,9],[18,48],[4,19],[1,5],[23,19],[4,2],[2,23],[-2,23],[1,23],[13,26],[19,19],[27,19],[31,15],[38,5],[12,0],[6,-1],[39,-27],[44,-77],[32,-26],[34,-6],[12,16],[6,23],[13,21],[24,7],[57,1],[28,10],[28,2],[26,-1],[81,-16],[12,-4],[13,-7],[6,-10],[1,-10],[9,-10],[15,0],[9,-16],[8,-12],[13,-36],[4,-4],[11,-8],[5,-5],[0,-6],[-5,-14],[2,-7],[20,-18],[22,-13],[19,-15],[9,-23],[25,-20],[80,-33],[95,-76],[41,-21],[12,-9],[9,-12],[13,-29],[9,-14],[27,-17],[33,-15],[20,-15],[-11,-15],[-4,-3],[-3,-4],[-2,-4],[-1,-4],[15,-44],[50,-22],[59,-16],[40,-28],[45,-85],[13,-47],[-6,-69],[2,-26],[7,-27],[8,-18],[10,-12],[4,-2],[5,3],[70,1],[14,3],[41,22],[30,32],[16,37],[3,94],[23,18],[26,-17],[12,-54],[-4,-46],[4,-22],[16,-14],[23,1],[96,34],[7,5],[7,-2],[11,-16],[5,-12],[2,-14],[-1,-80],[4,-28],[14,-26],[1,-3],[0,-3],[0,-4],[-1,-3],[-27,-21],[-49,-51],[-29,-21],[-60,-82],[20,8],[26,14],[26,10],[18,-3],[-1,-13],[-44,-59],[-5,-24],[-1,-53],[-5,-20],[-16,-13],[-45,-9],[-22,-14],[-15,-22],[11,-5],[25,2],[29,-1],[20,-6],[17,-10],[13,-13],[6,-14],[-1,-10],[-12,-23],[0,-12],[8,-11],[9,-3],[11,0],[14,-7],[15,-19],[0,-1]],[[6818,5048],[-21,-84],[-65,-74],[-44,-67],[-35,-74],[-50,-47],[-72,-11],[-148,19],[-31,23],[-44,25],[-53,6],[-9,43],[-41,41],[-130,62],[-104,67],[-50,18],[-38,32],[-28,-14],[-11,-3],[-11,-4],[0,-14],[-51,-11],[-53,-6],[-41,-58],[-24,-71],[-17,-32],[-11,-34],[-85,-122],[-21,-60]],[[5530,4598],[-5,4],[-11,11],[-8,12],[-12,36],[-58,109],[-10,11],[-7,9],[-83,63],[-17,18],[-15,22],[-56,118],[-66,97],[-25,23],[-32,14],[-32,3],[-29,-7],[-26,-14],[-21,-21],[-6,-7],[-5,-5],[-6,-3],[-9,-1],[-22,4],[-11,11],[-9,15],[-14,13],[-19,12],[-21,9],[-23,6],[-23,4],[-76,3],[-18,4],[-75,29],[-12,6],[-11,9],[-19,11],[-77,18],[-34,2],[-34,8],[-11,0],[-19,-2],[-6,-1],[-25,4],[-72,19],[-13,0],[-106,-18],[-32,-12],[-29,-18],[-22,-23],[-13,-29],[0,-7],[2,-5],[3,-4],[3,-7],[11,-4],[56,-32],[8,-9],[-1,-2],[-1,-9],[-12,-9],[-17,-5],[-48,-7],[-29,-9],[-40,-5],[-11,-3],[-11,-6],[-14,-15],[-9,-18],[-7,-39],[-9,-25],[-16,-17],[-22,-12],[-28,-8],[1,0],[1,1],[0,1],[3,5],[-6,-3],[-1,0]],[[5500,6046],[1,0],[19,-12],[17,-15],[20,-14],[26,-9],[22,-7],[21,-8],[23,-17],[38,-48],[16,-11],[24,-4],[41,4],[25,-6],[22,-11],[16,-14],[45,-58],[16,-12],[44,-20],[19,-12],[36,-31],[20,-11],[13,-3],[26,-2],[13,-4],[7,-7],[15,-19],[11,-8],[15,-4],[54,-7],[51,-13],[19,-2],[76,5],[34,-8],[14,-29],[13,-12],[24,-5],[25,0],[23,5],[21,-3],[67,-33],[32,-9],[16,1],[16,3],[15,2],[16,-4],[38,-53],[29,-17],[8,-9],[0,-15],[0,-4],[-9,-19],[-14,-2],[-15,4],[-16,-1],[-19,-21],[-18,-35],[-20,-65],[-7,-48],[14,-32],[31,-25],[42,-26],[23,-20],[-1,-14],[-8,-15],[0,-25],[13,-15],[64,-33],[8,-9],[11,-18],[9,-7],[14,-3],[14,1]],[[6143,3529],[-8,68],[7,26],[85,171],[6,27],[5,53],[-2,70],[5,57],[-1,14],[-4,14],[-31,59],[-5,6],[-10,8],[-23,10],[-10,7],[-9,9],[-21,34],[-26,33],[-15,14],[-63,33],[-25,8],[-205,91],[-39,29],[-39,40],[-6,9],[-8,23],[-4,7],[-5,8],[-19,20],[-30,50],[-20,22],[-86,44],[-7,5]],[[6818,5048],[35,3],[6,4],[6,-1],[9,-12],[2,-13],[-9,-28],[1,-13],[14,-17],[22,-13],[24,-9],[21,-4],[10,-4],[2,-5],[4,-2],[12,7],[6,8],[6,26],[7,11],[24,9],[28,-2],[27,-9],[20,-13],[8,-11],[11,-32],[0,-7],[-2,-6],[-3,-4],[-2,-3],[7,-4],[15,-3],[5,-4],[22,-41],[10,-8],[24,-10],[11,-10],[7,-12],[5,-27],[5,-11],[9,-9],[31,-14],[18,-31],[3,-6],[-15,-89],[14,-39],[51,-40],[35,-55],[29,-33],[12,-20],[17,-44],[12,-19],[16,-11],[69,-25],[43,-24],[34,-28],[86,-94],[28,-25],[115,-118],[220,-160],[29,-13],[19,-1],[15,8],[19,17],[6,9],[3,10],[7,7],[17,1],[16,-6],[3,-9],[-2,-13],[3,-14],[7,-8],[18,-16],[5,-7],[-1,-11],[-11,-18],[-1,-12],[8,-18],[39,-56],[64,-50],[14,-20],[-1,-7],[-9,-12],[-1,-6],[23,-37]],[[9785,1315],[-38,-10],[-25,-1],[-12,-11],[-1,-15],[9,-19],[-2,-17],[5,-16],[11,-12],[15,-10],[21,-10],[79,-52],[12,-10],[-4,-12],[-20,-23],[-55,-46],[-10,-15],[4,-18],[14,-18],[6,-17],[-15,-15],[9,-11],[13,-10],[10,-11],[-2,-16],[-18,-13],[-44,-55],[-20,-9],[-9,-8],[-10,-26],[-5,-7],[-9,-11],[-4,-9],[-1,-10],[2,-9],[0,-10],[-5,-9],[-17,-12],[-15,0],[-31,12],[-24,5],[-13,4],[-25,19],[-36,22],[-24,2],[-20,-15],[-24,-29],[-6,-5],[-16,-8],[-5,-5],[-2,-8],[-3,-24],[-13,-23],[-12,-5],[-20,2],[0,1],[-1,0],[-19,0],[-11,-14],[-7,-20],[-11,-18],[-36,-28],[-41,-23],[-29,-8],[-14,6],[-11,14],[-22,14],[-17,7],[-4,-1],[-1,-6],[-38,-41],[-26,-35],[-6,-2],[-16,-4],[-15,-29],[0,-7],[-5,-6],[-17,-4],[-13,2],[-25,13],[-12,3],[-14,0],[-7,-4],[-7,-5],[-51,-25],[-20,1],[-18,6],[-18,11],[-35,30],[-46,57],[-11,17],[-6,7],[-10,10],[-6,4],[-96,25],[-16,8],[-22,10],[-26,34],[-14,8],[-30,5],[-12,6],[-4,11],[-7,37],[-6,15],[-16,22],[-8,6],[-28,-22],[-10,-4],[-9,-1],[-6,-3],[-2,-12],[0,-11],[3,-8],[6,-6],[9,-3],[0,-7],[-20,1],[-17,4],[-14,1],[-12,-6],[-3,-5],[-3,-8],[2,-8],[15,-7],[-6,-8],[-9,-7],[-6,-1],[-13,-23],[-34,-12],[-71,-8]],[[8704,1425],[29,11],[16,27],[13,13],[11,14],[3,16],[6,15],[28,22],[35,18],[43,4],[42,-7],[35,-20],[38,-8],[46,1],[43,15],[28,6],[30,2],[37,-8],[32,14],[31,20],[94,6],[92,-27],[25,-22],[23,-27],[24,-23],[31,-16],[40,-14],[41,-9],[29,13],[23,22],[58,-8],[37,-63],[28,-21],[13,-28],[-21,-33],[-2,-15]],[[9301,2644],[8,-9],[16,-12],[20,-11],[18,-4],[19,-3],[20,-5],[35,-20],[49,-53],[30,-23],[37,-10],[38,4],[74,16],[26,1],[6,-6],[-3,-13],[0,-2],[-2,-20],[6,-14],[9,-9],[2,-10],[-16,-17],[-19,-14],[-37,-56],[-20,-19],[-19,-8],[-50,-8],[-24,-7],[-91,-51],[-12,-3],[-12,2],[-12,5],[-13,3],[-17,-3],[-14,-12],[-33,-64],[-2,-24],[15,-17],[73,-36],[13,-13],[6,-17],[6,-48],[6,-18],[13,-17],[22,-14],[50,-22],[17,-13],[70,-108],[16,-9],[10,5],[8,10],[13,8],[10,1],[26,-6],[8,2],[6,4],[7,-1],[7,-14],[4,-9],[6,-5],[8,0],[9,5],[18,-8],[4,-23],[-1,-28],[6,-21],[25,-12],[56,7],[23,-5],[5,-9],[1,-4],[3,-45],[9,-21],[16,-15],[59,-38],[19,-18],[9,-16],[0,-18],[-10,-55],[-4,-8],[-8,-2],[-7,6],[-8,3],[-12,-10],[-5,-11],[-3,-38],[-7,-22],[-14,-18],[-8,-6],[-19,-13],[-6,-8],[1,-12],[12,-21],[-1,-12],[-15,-13],[-20,-2],[-37,6],[-21,-2],[-22,-6]]],"transform":{"scale":[0.0007568046842684279,0.0008581445506550642],"translate":[100.0970732020001,13.91545664500012]}};
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
