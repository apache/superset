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
  Datamap.prototype.laoTopo = '__LAO__';
  Datamap.prototype.lbnTopo = '__LBN__';
  Datamap.prototype.lbrTopo = '__LBR__';
  Datamap.prototype.lbyTopo = '__LBY__';
  Datamap.prototype.lcaTopo = '__LCA__';
  Datamap.prototype.lieTopo = '__LIE__';
  Datamap.prototype.lkaTopo = {"type":"Topology","objects":{"lka":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Mahanuvara"},"id":"LK.KY","arcs":[[0,1,2,3,4]]},{"type":"Polygon","properties":{"name":"Mātale"},"id":"LK.MT","arcs":[[5,6,-5,7,8,9]]},{"type":"Polygon","properties":{"name":"Nuvara Ĕliya"},"id":"LK.NW","arcs":[[10,11,12,-2]]},{"type":"Polygon","properties":{"name":"Ampāra"},"id":"LK.AP","arcs":[[13,14,15,16,-6,17,18]]},{"type":"MultiPolygon","properties":{"name":"Maḍakalapuva"},"id":"LK.BC","arcs":[[[19]],[[-19,20,21,22]]]},{"type":"Polygon","properties":{"name":"Pŏḷŏnnaruva"},"id":"LK.PR","arcs":[[-21,-18,-10,23,24]]},{"type":"Polygon","properties":{"name":"Trikuṇāmalaya"},"id":"LK.TC","arcs":[[-22,-25,25,26,27,28]]},{"type":"Polygon","properties":{"name":"Anurādhapura"},"id":"LK.AD","arcs":[[-24,-9,29,30,31,32,-26]]},{"type":"Polygon","properties":{"name":"Vavuniyāva"},"id":"LK.VA","arcs":[[-27,-33,33,34]]},{"type":"MultiPolygon","properties":{"name":"Mannārama"},"id":"LK.MB","arcs":[[[35]],[[36]],[[37]],[[38]],[[39,-34,-32,40,41,42]]]},{"type":"Polygon","properties":{"name":"Mulativ"},"id":"LK.MP","arcs":[[-28,-35,-40,43,44,45]]},{"type":"MultiPolygon","properties":{"name":"Yāpanaya"},"id":"LK.JA","arcs":[[[46]],[[47]],[[48]],[[49,50]],[[-45,51,52,53]]]},{"type":"MultiPolygon","properties":{"name":"Kilinŏchchi"},"id":"LK.KL","arcs":[[[54]],[[-44,-43,55]],[[-53,56,-50,57]]]},{"type":"Polygon","properties":{"name":"Kuruṇægala"},"id":"LK.KG","arcs":[[-8,-4,58,59,60,-30]]},{"type":"Polygon","properties":{"name":"Puttalama"},"id":"LK.PX","arcs":[[-31,-61,61,62,-41]]},{"type":"Polygon","properties":{"name":"Ratnapura"},"id":"LK.RN","arcs":[[-12,63,64,65,66,67,68,69,70]]},{"type":"Polygon","properties":{"name":"Gālla"},"id":"LK.GL","arcs":[[-68,71,72,73]]},{"type":"Polygon","properties":{"name":"Hambantŏṭa"},"id":"LK.HB","arcs":[[74,75,-66,76,-15]]},{"type":"Polygon","properties":{"name":"Mātara"},"id":"LK.MH","arcs":[[-76,77,-72,-67]]},{"type":"Polygon","properties":{"name":"Badulla"},"id":"LK.BD","arcs":[[78,-64,-11,-1,-7,-17]]},{"type":"Polygon","properties":{"name":"Mŏṇarāgala"},"id":"LK.MJ","arcs":[[-77,-65,-79,-16]]},{"type":"Polygon","properties":{"name":"Kægalla"},"id":"LK.KE","arcs":[[-3,-13,-71,79,80,-59]]},{"type":"Polygon","properties":{"name":"Kŏḷamba"},"id":"LK.CO","arcs":[[-70,81,82,83,-80]]},{"type":"Polygon","properties":{"name":"Gampaha"},"id":"LK.GQ","arcs":[[-81,-84,84,-62,-60]]},{"type":"Polygon","properties":{"name":"Kaḷutara"},"id":"LK.KT","arcs":[[-69,-74,85,-82]]}]}},"arcs":[[[6121,4000],[38,-387],[94,-185],[-8,-83],[-115,-64],[-92,-15],[-54,-20]],[[5984,3246],[-177,22],[-184,-16],[-156,7],[-98,92],[-38,3],[-44,9],[-61,49],[-74,40],[13,-74],[39,-96],[-86,-88],[-276,-194],[-73,12],[-84,-1],[-124,-51],[-87,-11],[-154,11],[-97,-46],[35,6],[34,-9],[75,-82],[63,-36],[51,-41],[-51,-86],[-92,-58],[-125,43],[-192,170],[-122,7]],[[3899,2828],[2,51],[31,39],[-31,32],[-65,92],[49,27],[148,14],[67,44],[47,1],[47,7],[33,31],[25,34],[-50,37],[-62,37],[-1,37],[10,46],[-52,38],[-108,35],[-37,15],[7,50],[-184,96],[-53,79]],[[3722,3670],[89,-6],[76,13],[-7,12],[-3,17],[14,15],[19,14],[13,51],[62,0],[66,-28],[73,-3],[6,26],[-6,29],[63,21],[61,-7],[46,14],[-26,34],[-34,33],[50,8],[51,14]],[[4335,3927],[88,-72],[272,-102],[157,-5],[91,60],[-14,94],[26,40],[60,21],[63,-14],[159,-79],[123,11],[135,67],[176,-1],[70,20],[52,-38],[32,10],[27,15],[47,47],[87,8],[135,-9]],[[6146,4600],[-3,-42],[31,-58],[9,-49],[-41,-121]],[[6142,4330],[-41,-121],[20,-209]],[[4335,3927],[3,26],[24,19],[8,31],[-12,32],[-21,27],[-26,26],[-43,51],[10,54],[61,33],[15,22],[0,23],[12,31],[2,30],[-78,45],[-24,79],[-13,86],[-21,18],[-16,7],[-1,44],[-29,44],[-43,42],[-30,40],[-32,5],[-38,13],[-12,45],[20,42]],[[4051,4842],[91,40],[144,31],[76,55],[68,-2],[52,-20],[63,26],[32,31],[30,12],[28,10],[-3,18],[-10,12],[55,34],[41,37],[-1,47],[24,41],[43,0],[32,-4],[25,10],[83,52],[56,29],[81,24],[89,22]],[[5150,5347],[38,-22],[59,-40],[-1,-45],[23,-15],[36,-8],[27,11],[2,16],[52,15],[49,-9],[68,-8],[63,-22],[-129,-80],[-42,-121],[-11,-59],[-42,-103],[-14,-19],[-8,-18],[-124,-17],[-29,-70],[58,-156],[-8,-49],[42,-36],[113,-15],[107,27],[86,46],[36,-31],[66,-24],[18,45],[10,46],[229,-10],[222,24]],[[5984,3246],[-4,-46],[33,-64],[-10,-23],[9,-22],[20,-13],[15,-13],[-29,-22],[-21,-24],[24,-45],[6,-18],[-14,-19],[-28,-21],[-35,-19],[-39,-45],[-19,-50],[-95,-84],[-162,-21],[-77,-22],[-68,-37],[-21,-50],[-57,-40],[-80,3],[-77,-2],[4,-41],[137,-41],[28,-36],[24,-39],[22,-16],[17,-17],[-63,-61],[40,-15],[39,-12],[-44,-36],[-81,-12]],[[5378,2223],[-242,-76],[-133,-11],[-142,3],[-106,-5],[-90,-9],[-235,19],[-222,30],[-104,5],[-88,40],[15,26],[33,18],[-29,19],[3,42]],[[4038,2324],[49,26],[-7,34],[-33,67],[-99,44],[-124,24],[-37,74],[30,95],[-27,17],[-24,20],[23,19],[33,6],[59,31],[38,36],[-14,3],[-6,8]],[[9485,3935],[4,-10],[34,-4],[35,26],[26,0],[1,0],[32,-103],[-1,-38],[1,0],[29,0],[0,1],[4,36],[10,35],[18,30],[27,22],[0,17],[-3,4],[-9,16],[7,8],[24,-6],[38,-22],[14,-20],[9,-54],[66,-63],[107,-217],[-20,-602],[10,-41],[44,-90],[7,-54],[-24,-102],[-197,-406],[-11,-42],[-5,-55],[-14,-46],[-62,-72],[-13,-32],[-25,-43],[-82,-78],[-39,-36],[29,-62],[-47,-74],[-272,-256]],[[9237,1502],[-38,7],[-104,19],[-71,49],[-55,4],[-49,2],[-128,94]],[[8792,1677],[112,939],[-21,51],[-52,44],[0,49],[-30,49],[20,51],[9,48],[-127,45],[-152,24],[-22,11],[-27,10],[-32,0],[-34,9],[-33,35],[-18,40],[-55,59],[50,80],[89,63],[70,32],[-93,77],[-12,55],[-60,62],[-95,49],[-17,49],[6,61],[-50,135],[8,34],[-28,3],[-27,10],[63,58],[-84,14],[-107,-34],[-52,-11],[-47,-12],[-16,-24],[-29,-28],[-59,-9],[-44,-2],[1,-33],[23,-31],[5,-30],[-19,-25],[-30,-21],[-20,-18],[-86,-29],[-106,3],[0,-98],[23,-96],[-80,-34],[-87,-18],[-37,41],[-34,50]],[[7349,3464],[-15,46],[-38,46],[-30,30],[-17,23],[-53,5],[-37,-5],[-64,38],[-47,60],[-28,112],[-18,32],[-12,32],[12,23],[23,26],[46,125],[-17,128],[-190,24],[-210,-70],[-91,-50],[-51,-12],[-43,-6],[-78,-16],[-105,105],[-34,61],[-6,42],[-28,36],[-64,24],[-12,7]],[[6146,4600],[80,1],[160,9],[78,8],[155,-36],[127,-75],[207,-38],[100,-35],[84,-6],[10,27],[20,30],[27,17],[24,27],[-14,61],[20,57]],[[7224,4647],[116,-13],[137,4],[114,-22],[146,-126],[95,-54],[130,-22],[136,-15],[-6,-77],[-42,-74],[8,-43],[39,-38],[135,-48],[73,-42],[280,-29],[285,18],[100,34],[2,-65],[33,-62],[13,-145],[32,-42],[149,88],[87,42],[117,11],[82,8]],[[9710,4013],[-64,-31],[-60,28],[-18,12],[-9,5],[-3,13],[-3,12],[0,1],[1,5],[17,161],[-12,56],[-47,23],[-18,23],[-143,125],[-7,27],[-17,21],[-20,25],[-14,26],[2,26],[13,24],[6,24],[0,1],[-21,29],[0,1],[55,-32],[52,-74],[39,-34],[9,-15],[40,-64],[104,-98],[48,-45],[72,-224],[-2,-51]],[[7224,4647],[-61,198],[38,197],[32,75],[96,38],[122,10],[155,-12],[40,2],[-36,95],[-71,93],[-31,94],[34,404],[-23,133]],[[7519,5974],[72,15],[383,-24]],[[7974,5965],[13,-27],[89,-178],[34,-117],[-77,-64],[-44,106],[-6,14],[-65,107],[-31,0],[-5,-81],[5,-25],[-3,0],[-3,-7],[0,-13],[6,-15],[14,-10],[36,-7],[1,0],[7,-8],[35,-54],[75,-32],[72,3],[25,55],[26,0],[27,-29],[7,-8],[36,-92],[35,-36],[48,-31],[31,-30],[53,-72],[20,12],[28,12],[12,12],[19,-24],[-19,-12],[10,-10],[8,-6],[2,-1],[5,-5],[2,-12],[1,0],[21,11],[44,12],[22,11],[0,-1],[10,-14],[12,-18],[-9,-20],[-15,-21],[1,-16],[1,-15],[30,-35],[53,-24],[34,-15],[32,-31],[-20,-1],[-10,-4],[-13,-5],[-8,-3],[-8,-3],[-13,-28],[-12,-28],[50,-87],[27,-19],[61,-42],[1,0],[90,10],[30,0],[29,-53],[34,-33],[10,-10],[185,-115],[59,-56],[11,-49],[-95,-17],[0,-1],[-44,18],[-105,80],[-55,28],[-71,15],[-1,0],[-7,0],[-51,-3],[-44,-27],[-30,-56],[51,-14],[49,-5],[43,10],[32,26],[50,-11],[46,-14],[16,-11],[11,-8],[-7,-28],[57,-31],[57,-32],[44,-30],[47,-46],[-22,-16],[-6,-14],[7,-18],[21,-24],[26,19],[-16,35],[51,-10],[99,-44],[24,-20],[78,-120],[-5,-5],[-24,-65],[4,-7],[0,-1],[20,-25],[5,-10],[-16,-17],[-31,-14],[-18,-16],[21,-23],[21,-16],[8,-13],[1,-1],[12,-15],[32,-16],[-46,-20],[4,-10]],[[5150,5347],[6,67],[83,70],[-85,40],[7,89],[29,100],[62,97],[35,107],[63,99],[169,18],[190,0],[55,20],[18,44],[31,45],[56,35]],[[5869,6178],[64,11],[50,-44],[69,-16],[65,-31],[18,-53],[54,-32],[180,11],[324,-47],[76,0],[71,-24],[69,-32],[76,-23],[54,3],[30,-26],[7,-33],[-2,-33],[15,-48],[-23,-32],[-49,-19],[16,-7],[21,-4],[108,15],[60,84],[22,24],[27,67],[29,15],[33,15],[28,30],[39,25],[53,0],[66,0]],[[5869,6178],[92,196],[10,32],[18,31],[52,31],[61,24],[36,37],[-29,40],[-49,22],[-39,29],[-60,85],[-113,100],[-18,61],[-45,27],[-36,24],[-4,52],[66,92],[-32,54],[-80,103],[-2,110],[72,63],[50,66],[-40,19],[-35,27],[-66,43],[-186,77],[-109,37],[-125,2],[-121,-30]],[[5137,7632],[19,45],[35,37]],[[5191,7714],[168,46],[198,15],[82,14],[74,26],[82,14],[68,18]],[[5863,7847],[1,-40],[51,-22],[-46,-25],[-40,-28],[67,-32],[73,4],[59,32],[44,46],[28,42],[1,0],[154,-111],[138,-139],[56,-35],[78,-14],[62,-30],[92,-132],[24,-14],[24,-16],[1,0],[105,-28],[52,-67],[60,-134],[11,25],[14,10],[23,-4],[1,0],[41,-13],[-12,-25],[119,-77],[39,-38],[0,-46],[-31,-19],[-45,-12],[-41,-28],[1,0],[31,5],[32,5],[8,3],[16,5],[0,-1],[93,-119],[14,-62],[-107,-11],[22,42],[-28,33],[-48,4],[-34,-44],[12,-34],[30,-24],[17,-26],[-32,-40],[-25,12],[-46,21],[-75,28],[-74,10],[-72,-18],[-55,-44],[20,-23],[66,6],[89,43],[61,-38],[55,-47],[67,-38],[94,-16],[197,2],[66,25],[-44,60],[113,30],[44,9],[47,-2],[1,-1],[52,-17],[47,-30],[35,-35],[31,-103],[66,-132],[3,-34],[2,-35],[-55,23],[-56,68],[-50,14],[-2,-18],[21,-83],[1,-7],[24,-32],[28,-8],[26,-7],[1,0],[58,0],[46,-12],[27,-98],[33,-68],[5,-11],[9,-42]],[[4051,4842],[-108,62],[16,89],[-21,60],[-40,59],[-11,43],[-36,36],[-69,3],[-59,14],[-8,45],[5,47],[-12,54],[8,32],[-2,32],[-64,32],[-81,-2],[-77,29],[-70,42],[-128,62],[-142,32],[-79,7],[-64,27],[-82,20],[-85,13],[-394,107],[-92,31]],[[2356,5818],[-48,36],[-63,30],[-87,-2],[-76,34],[-72,-19],[-89,0],[-26,45],[-107,258],[-63,72],[47,63],[72,20],[20,23],[6,18],[133,65],[78,98],[-25,106]],[[2056,6665],[36,-11],[41,-3],[9,238],[-34,150],[190,-46],[210,-1],[416,65]],[[2924,7057],[2,-83],[43,-72],[65,-14],[63,-17],[28,-31],[16,-35],[45,-54],[90,-29],[45,-7],[42,-2],[65,70],[76,20],[79,110],[169,130],[130,36],[79,-25],[73,-31],[136,1],[114,51],[108,58],[93,65],[52,47],[60,44],[102,47],[-36,67],[-79,60],[-111,23],[-8,56],[318,7],[124,51],[112,19],[118,13]],[[2924,7057],[-162,124],[-101,46],[1,33],[16,38],[110,7],[64,85],[119,40],[155,-11],[241,18],[230,51],[21,89],[-65,98],[-66,63],[-116,32]],[[3371,7770],[199,74],[119,58],[76,68],[-5,44],[-15,43],[0,23],[-4,21],[-63,6],[-33,27],[11,37],[77,5],[82,-3],[148,2],[106,-40],[66,-59],[105,28],[74,39],[42,12],[41,14],[8,13],[10,13],[139,2],[132,-30],[16,-82],[115,-8],[49,-51],[-41,-37],[-7,-34],[67,9],[62,26],[135,-13],[136,-49],[52,-41],[-79,-173]],[[1558,7739],[-37,-28],[16,44],[21,-16]],[[383,8049],[-42,-2],[53,20],[77,-2],[13,-10],[-57,0],[-30,0],[-14,-6]],[[12,8094],[-4,-3],[-8,23],[11,-6],[1,-14]],[[1415,8013],[146,-84],[-1,0],[-70,9],[-123,36],[-72,7],[111,-75],[87,-59],[39,-40],[-103,7],[-67,31],[-45,33],[-35,16],[-44,14],[-176,93],[-87,23],[-88,23],[-64,10],[-34,6],[-94,6],[-47,11],[-21,25],[13,24],[55,11],[191,0],[85,-12],[87,-14],[183,-41],[174,-60]],[[2737,8483],[5,-88],[26,-83],[79,-75],[9,-18],[5,-19],[-4,-39],[-16,-37],[10,-60],[-6,-52],[-94,-19],[-19,-26],[-15,-28],[-22,-29],[-15,-30],[21,-23],[19,-17],[-54,-92],[705,22]],[[2056,6665],[-114,38],[-109,27],[-127,7],[-112,26],[-49,17]],[[1545,6780],[16,10],[7,12],[42,79],[6,3],[3,2],[10,23],[39,51],[38,249],[-103,159],[9,28],[7,181],[0,2],[0,1],[-10,60],[-13,30],[-22,22],[-17,26],[39,13],[58,6],[38,7],[248,133],[129,38],[54,28],[28,62],[52,64],[29,89],[137,211],[5,12],[13,30]],[[2387,8411],[31,0],[147,8],[91,27],[81,37]],[[2737,8483],[113,-9],[-11,71],[111,86],[329,23],[117,1],[115,-12],[113,6],[73,111],[58,1],[195,-6],[108,4],[72,23],[59,116],[21,4],[32,-24],[84,-42],[98,-32],[-12,58],[13,58],[91,43],[9,42],[21,13]],[[4546,9018],[22,8],[26,13]],[[4594,9039],[506,-243],[5,-5],[29,-29],[49,-36],[91,-51],[59,-45],[-52,-16],[-30,8],[-3,1],[-1,0],[-45,34],[-24,8],[-1,0],[-77,7],[-34,-6],[17,-20],[6,-7],[222,-122],[86,-29],[1,0],[-35,32],[-21,29],[11,22],[59,8],[28,-11],[45,-80],[42,-48],[162,-193],[-33,7],[-90,20],[-57,1],[-24,-37],[34,-9],[69,-7],[62,-23],[1,-3],[9,-56],[1,0],[28,0],[14,15],[13,6],[15,5],[19,8],[22,-51],[3,-7],[60,-82],[81,-73],[83,-32],[6,-3],[10,-5],[-1,-18],[-19,-18],[-40,-8],[-12,7],[-47,45],[-51,16],[-117,18],[-68,18],[31,-25],[18,-15],[154,-86],[0,-8]],[[698,9117],[-108,-4],[-100,20],[-44,32],[0,105],[13,27],[28,-3],[29,-22],[18,-27],[73,-14],[88,-4],[22,-9],[50,-62],[-34,-20],[-35,-19]],[[1177,9409],[31,-15],[35,2],[18,8],[-25,26],[2,15],[36,-1],[43,-19],[17,-35],[-12,-53],[-13,-13],[-38,-3],[-141,17],[-27,22],[5,96],[16,14],[23,-14],[30,-47]],[[1502,9613],[18,-2],[83,2],[14,-7],[6,-39],[11,-16],[49,-18],[66,-17],[55,-18],[4,-6],[15,-18],[-30,-19],[-56,0],[-60,11],[-43,16],[-30,5],[-77,-27],[-54,-4],[-1,0],[-66,29],[-66,58],[-104,123],[48,44],[11,56],[26,45],[94,12],[49,-9],[1,0],[4,-21],[-17,-30],[-11,-35],[1,-35],[7,-28],[0,-2],[4,-6],[14,-20],[20,-13],[15,-11]],[[3160,9618],[-58,-73],[-90,-94]],[[3012,9451],[-220,57],[-79,27],[-53,1],[10,-62],[29,-19],[46,-20],[28,-26],[-28,-32],[-32,-6],[-31,10],[-29,14],[-82,25],[-160,83],[-91,23],[47,-31],[84,-43],[46,-31],[-103,12],[-103,25],[-205,68],[-164,77],[-98,20],[-9,4],[-37,14],[-35,8],[-5,-18],[-47,19],[-18,25],[-8,29],[-17,33],[-28,29],[-16,13],[-44,34],[-28,29],[92,28],[168,92],[76,20],[1,0],[334,-17],[174,11],[64,-4],[25,-34],[-5,-54],[13,-19],[37,-7],[35,-3],[102,-15],[22,-7],[19,-23],[46,1],[36,7],[14,2],[21,2],[15,1],[33,-11],[14,-5],[120,-78],[172,-111]],[[4546,9018],[-291,118],[-100,27],[-89,12],[-14,3],[-12,4],[-78,35],[-29,10],[-29,3],[-35,-1]],[[3869,9229],[-9,25],[-54,98]],[[3806,9352],[10,-2],[0,19],[-155,46],[-376,183],[-308,210],[-156,50],[-246,35],[-64,27],[-9,39],[90,23],[29,3],[89,9],[177,5],[86,-9],[59,-25],[39,-84],[39,-35],[560,-390],[83,-36],[167,-56],[674,-325]],[[1854,8595],[-22,-9],[-36,39],[26,9],[25,21],[28,-12],[11,-12],[-6,-18],[-26,-18]],[[2387,8411],[26,63],[0,149],[10,21],[-8,15],[-51,6],[-118,36],[-45,26],[-29,48],[-5,9],[-21,60],[-2,34],[51,32],[95,28],[105,20],[86,7],[39,12],[94,74],[11,5],[16,7],[31,11],[39,9],[49,4],[-41,45],[-24,20],[-25,19],[-63,37],[-83,37],[-316,110],[-64,47],[138,-3],[130,-31],[258,-88],[246,-37],[64,-25],[101,-52],[26,-28],[-53,-16],[12,-17],[15,-18],[-27,-17],[1,0],[89,-36],[211,31],[386,91],[104,-6],[228,-37],[269,-72],[203,-23],[1,0]],[[3869,9229],[-53,-2],[-33,-7],[-5,-5],[-10,-9],[-16,-5],[-57,25],[-23,2],[-139,-2],[-39,7],[-304,156],[-131,50],[-47,12]],[[3160,9618],[205,-132],[133,-49],[308,-85]],[[3722,3670],[-39,49],[-62,38],[-103,9],[-94,-23],[-15,-48],[5,-53],[-14,-30],[-31,-25],[-45,-1],[-209,-27],[-101,-28],[-93,-40],[-89,-47],[-87,-30]],[[2745,3414],[-74,32],[-107,72],[-25,21],[-12,22],[-38,26],[-119,-13],[-105,-44],[-124,-22],[-118,50],[-102,-3],[-163,-76],[-91,-21]],[[1667,3458],[-10,152],[-159,505],[-7,88],[8,88],[46,70],[64,65],[17,29],[30,26],[62,9],[50,17],[-23,23],[-53,8],[22,33],[29,30],[55,10],[62,3],[46,12],[30,23],[-16,27],[-23,28],[14,68],[40,62],[8,31],[16,27],[55,18],[52,21],[12,27],[21,26],[90,28],[18,24],[6,26],[26,35],[63,18],[-4,-5],[-4,-4],[27,5],[33,20],[1,31],[25,25],[89,-30],[53,25],[-51,57],[25,30],[32,29],[5,58],[-4,69],[17,33],[10,31],[-51,19],[-58,12],[-40,46],[-16,50],[-45,101],[2,52],[-8,49]],[[1667,3458],[-75,17],[-63,-23],[-50,3],[-33,22],[-83,-6],[-79,-12],[-102,3]],[[1182,3462],[-185,803],[-26,33],[18,12],[13,1],[31,-13],[7,45],[21,51],[5,24],[5,25],[-24,39],[-32,35],[-6,23],[-7,24],[1,94],[-99,287],[-11,33],[-51,63],[-43,133],[-70,104],[-108,289],[0,82],[18,-5],[1,-1],[1,0],[0,-3],[10,-9],[15,48],[-23,151],[-22,46],[71,28],[66,51],[48,58],[19,48],[20,32],[126,118],[-1,-2],[-64,-89],[-81,-85],[18,-21],[5,-5],[31,-19],[42,-9],[50,0],[-41,-70],[-44,-51],[-18,-9],[-20,-1],[-16,-7],[-7,-27],[4,-61],[-4,-19],[-72,-137],[3,-25],[5,-51],[75,-53],[21,-15],[-85,-106],[136,-59],[198,-9],[101,42],[-19,46],[-32,36],[-13,13],[-15,11],[-38,29],[-43,16],[-12,28],[144,163],[-6,29],[-18,22],[-21,19],[-14,19],[-3,31],[5,53],[-2,22],[-2,4],[-12,19],[-7,3],[-8,5],[-8,10],[8,29],[20,24],[56,44],[12,28],[9,54],[40,107],[40,250],[27,28],[28,15],[21,16],[9,38],[0,106],[25,53],[58,33],[69,28],[40,26]],[[5378,2223],[12,-95],[32,10],[31,7],[58,-38],[74,-14],[-10,-24],[-14,-19],[-16,-10],[-116,-32],[-20,-33],[45,-43],[65,-31],[98,-11],[103,25],[87,38],[78,2]],[[5885,1955],[-70,-63],[-44,-66],[-79,-56],[-40,-57],[-42,-111],[-81,-68],[-65,-73],[13,-42],[27,-40],[4,-159],[47,-54],[61,-48],[82,-27],[77,-32],[42,-47],[33,-60]],[[5850,952],[79,-52],[40,-65],[-22,-45],[-90,18],[-157,19],[-50,34],[-65,30],[-81,-4],[-82,-12],[-82,8],[-313,68],[-245,28]],[[4782,979],[0,24],[23,14],[-55,24],[3,24],[-47,35],[-103,-10],[-77,8],[29,46],[-62,67],[-188,-14],[-73,-1],[-30,-41],[-83,-12],[-84,-7]],[[4035,1136],[-37,32],[-69,-2],[-133,39],[-63,1],[-72,18],[-59,29],[-52,32]],[[3550,1285],[-154,160],[-181,152],[-23,43],[65,15],[-62,70],[-95,52],[-60,14],[-47,27],[-25,74],[-131,75],[-41,52],[-28,48],[6,41],[-74,117],[-14,53]],[[2686,2278],[94,50],[-105,67],[22,30],[18,36],[46,43],[55,40]],[[2816,2544],[66,18],[177,-107],[53,-40],[66,-31],[31,10],[43,6],[31,-22],[20,-25],[107,-14],[130,43],[54,4],[64,-2],[92,-31],[118,-23],[85,-7],[85,1]],[[4035,1136],[-88,-16],[-58,-34],[51,-46],[65,-40],[-25,-72],[-132,18],[-82,46],[-90,40],[-70,13],[-69,-11],[42,-48],[85,-32],[90,-77],[32,-73],[-74,-55],[-151,16],[45,-31],[20,-42],[-31,-53],[-38,-50],[27,-50],[66,-37],[77,-31],[67,-36],[-58,-42],[-68,-41],[-59,-14],[-26,-24],[14,-26],[33,-11],[75,-19],[-26,-31],[-77,-17],[-47,-50],[1,-28],[7,-27],[1,-2]],[[3564,103],[-28,2],[-20,5],[-15,13],[-18,11],[-33,6],[-20,-4],[-16,-8],[-16,-8],[-23,1],[-7,4],[-7,3],[-27,23],[-14,5],[-3,1],[0,1],[-30,6],[-183,39],[-75,9],[-53,7],[-93,44],[-21,6],[-41,12],[-32,-19],[-79,39],[-349,220],[-28,13],[-1,0],[-3,3],[-9,7],[-6,10],[2,22],[-11,11],[-15,12],[-38,30],[-198,248],[-8,24],[1,21],[1,22],[-7,13],[-36,44],[-36,119],[-78,84],[-50,120]],[[1841,1324],[30,-4],[23,-19],[25,-14],[27,12],[44,10],[31,-18],[22,-22],[157,-43],[78,-10],[85,-22],[69,-36],[71,-28],[185,-21],[116,39],[130,6],[127,-57],[66,-38],[66,-32],[9,51],[-33,56],[0,55],[80,21],[149,55],[152,20]],[[9237,1502],[-131,-124],[-134,-80],[-248,-105],[-81,-14],[-109,-35],[-793,-372],[-159,-51],[-515,-109],[-1,0],[-7,37],[0,2],[-30,14],[-1,0],[-7,-1],[-26,-4],[-16,-20],[-9,-44],[-23,-16],[-37,-6],[-50,-13],[-93,-33],[-93,-25],[-445,-57],[-216,-44],[-236,-26],[-108,-24],[-65,-55],[-116,14],[-71,-17],[-40,-9],[-165,-72],[-164,-73],[-11,-7]],[[5037,133],[-24,8],[-108,29],[-51,47],[31,10],[2,21],[-37,12],[-41,3],[-60,23],[-10,41],[139,35],[-47,98],[39,22],[15,22],[-47,6],[-50,-5],[-70,23],[-15,43],[25,23],[21,27],[-23,14],[-38,-4],[-81,18],[-74,31],[52,110],[164,74],[-29,41],[29,45],[-7,19],[40,10]],[[5850,952],[105,41],[108,35],[121,24],[93,41],[-42,58],[21,58],[54,0],[58,2],[35,30],[-1,34],[53,-23],[41,28],[107,1],[106,-9],[73,-15],[33,-47],[42,-3],[46,1],[39,16],[54,4],[80,-62],[65,-67],[107,-26],[117,38],[42,25],[66,17],[124,19],[254,59],[47,20],[11,-7],[37,-4],[114,25],[120,-16],[55,54],[0,23],[-2,21],[19,15],[19,18],[-23,35],[-1,43],[84,40],[102,28],[78,44],[90,41],[115,13],[76,53]],[[5037,133],[-65,-45],[-175,6],[-1,0],[-73,-6],[-57,-13],[-59,-20],[-104,-47],[-30,-4],[-29,-4],[-71,16],[-76,23],[-43,8],[-30,6],[-247,-18],[-71,8],[-35,21],[-23,28],[-19,17],[-13,12],[-72,-25],[-65,-3],[-115,10]],[[7349,3464],[-166,-24],[0,-53],[-33,-48],[-117,-88],[-39,-40],[-71,-17],[-60,38],[-70,5],[-50,-45],[-13,-52],[53,-41],[66,-38],[43,-53],[50,-31],[157,25],[46,-35],[24,-12],[31,-23],[23,-35],[11,-35],[0,-48],[-20,-46],[-16,-71],[-23,-28],[-28,-26],[-12,-40],[-22,-37],[-55,-7],[-43,11],[-26,-16],[-19,-20],[-43,-33],[-54,-26],[-109,-18],[-92,-30],[105,-87],[-124,-22],[-38,-43],[-145,-8],[-10,-53],[9,-55],[-37,-47],[17,-33],[75,-12],[5,-45],[-63,-59],[-9,-38],[1,-39],[40,-71],[64,-59],[-89,-19],[-14,-61],[-46,13],[-46,18],[-60,-56],[-17,-68],[-37,36],[-50,36],[-19,82],[-29,10],[-30,8],[-29,57],[-40,52],[-34,4],[-33,11],[-20,44],[-33,31],[-51,1]],[[2816,2544],[-2,25],[-6,25],[57,32],[-13,46],[-74,23],[-93,3]],[[2685,2698],[13,21],[-1,24],[-64,121],[23,75],[54,74],[62,26],[32,43],[-90,16],[-104,-15],[-53,64],[19,73],[67,21],[56,31],[11,88],[42,20],[-7,34]],[[2686,2278],[-125,17],[-139,-35],[27,-74],[-83,13],[-56,77],[-22,7],[-27,3],[-53,-36],[-66,-20],[-47,13],[-48,-4],[-164,-84],[-48,-12],[-49,-7],[-124,-28],[-198,73],[-5,-42],[27,-48],[13,-33],[1,-31],[-2,-2],[-6,-7]],[[1492,2018],[-160,244],[-58,193],[-6,19],[0,184],[5,8]],[[1273,2666],[92,-22],[71,-22],[76,-11],[33,11],[39,10],[213,-37],[73,8],[73,4],[58,-22],[51,-28],[48,-15],[50,-12],[75,-5],[92,2],[5,51],[17,48],[68,40],[85,23],[115,-7],[78,16]],[[1273,2666],[43,60],[11,29],[-1,30],[0,1],[-205,432],[29,63],[-2,-39],[16,-24],[23,-19],[20,-23],[41,-85],[20,-21],[27,0],[6,24],[12,11],[11,1],[1,0],[2,-1],[-1,78],[0,1],[-9,34],[-22,28],[-20,9],[-57,7],[-25,10],[-2,3],[-16,19],[7,20],[17,19],[8,18],[-25,111]],[[1841,1324],[-18,44],[-9,5],[-18,6],[-20,10],[-11,14],[4,15],[21,4],[22,-2],[1,0],[10,1],[-33,134],[-2,11],[-89,136],[-207,316]]],"transform":{"scale":[0.0002339101097109631,0.0003906233722372289],"translate":[79.55144290500013,5.923732815000093]}};
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
