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
  Datamap.prototype.lkaTopo = '__LKA__';
  Datamap.prototype.lsoTopo = '__LSO__';
  Datamap.prototype.ltuTopo = '__LTU__';
  Datamap.prototype.luxTopo = '__LUX__';
  Datamap.prototype.lvaTopo = '__LVA__';
  Datamap.prototype.macTopo = '__MAC__';
  Datamap.prototype.mafTopo = '__MAF__';
  Datamap.prototype.marTopo = '__MAR__';
  Datamap.prototype.mcoTopo = '__MCO__';
  Datamap.prototype.mdaTopo = {"type":"Topology","objects":{"mda":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Briceni"},"id":"MD.BR","arcs":[[0,1,2]]},{"type":"Polygon","properties":{"name":"Donduseni"},"id":"MD.DO","arcs":[[3,4,5,6,7,8]]},{"type":"Polygon","properties":{"name":"Edineţ"},"id":"MD.ED","arcs":[[-7,9,10,-2,11]]},{"type":"Polygon","properties":{"name":"Ocniţa"},"id":"MD.OC","arcs":[[-8,-12,-1,12]]},{"type":"Polygon","properties":{"name":"Rîşcani"},"id":"MD.RS","arcs":[[13,14,15,16,17,-10,-6]]},{"type":"Polygon","properties":{"name":"Bălţi"},"id":"MD.BT","arcs":[[18,19,-16,20]]},{"type":"Polygon","properties":{"name":"Drochia"},"id":"MD.DR","arcs":[[21,22,23,-14,-5]]},{"type":"Polygon","properties":{"name":"Făleşti"},"id":"MD.FA","arcs":[[-19,24,25,26,27]]},{"type":"Polygon","properties":{"name":"Glodeni"},"id":"MD.GL","arcs":[[-20,-28,28,-17]]},{"type":"Polygon","properties":{"name":"Sîngerei"},"id":"MD.SI","arcs":[[29,30,-25,-21,-15,-24,31]]},{"type":"Polygon","properties":{"name":"Ungheni"},"id":"MD.UG","arcs":[[-31,32,33,34,35,-26]]},{"type":"Polygon","properties":{"name":"Cahul"},"id":"MD.CH","arcs":[[36,37,38,39,40,41,42,43]]},{"type":"Polygon","properties":{"name":"Taraclia"},"id":"MD.TA","arcs":[[-40,44,-38,45,46,47]]},{"type":"MultiPolygon","properties":{"name":"Comrat"},"id":"MD.GA","arcs":[[[-42,48]],[[-45,-39]],[[-46,-37,49,50,51,52]]]},{"type":"Polygon","properties":{"name":"Chişinău"},"id":"MD.CV","arcs":[[53,54,55,56]]},{"type":"Polygon","properties":{"name":"Stîngă Nistrului"},"id":"MD.DB","arcs":[[57,58,59,60,61,62,63]]},{"type":"Polygon","properties":{"name":"Anenii Noi"},"id":"MD.AN","arcs":[[64,65,66,-55,67,68]]},{"type":"Polygon","properties":{"name":"Basarabeasca"},"id":"MD.BA","arcs":[[69,-47,-53,70]]},{"type":"Polygon","properties":{"name":"Cantemir"},"id":"MD.CN","arcs":[[-50,-44,71,72]]},{"type":"Polygon","properties":{"name":"Calarasi"},"id":"MD.CA","arcs":[[73,74,75,-34,76]]},{"type":"Polygon","properties":{"name":"Cimişlia"},"id":"MD.CS","arcs":[[77,78,-71,-52,79,80,81]]},{"type":"Polygon","properties":{"name":"Criuleni"},"id":"MD.CR","arcs":[[82,-59,-68,-54,83,84,-61]]},{"type":"Polygon","properties":{"name":"Floreşti"},"id":"MD.FL","arcs":[[85,86,87,-32,-23,88]]},{"type":"Polygon","properties":{"name":"Grigoriopol"},"id":"MD.DU","arcs":[[89,-69,-58,90]]},{"type":"Polygon","properties":{"name":"Transnistria"},"id":"MD.DB","arcs":[[-83,-60]]},{"type":"Polygon","properties":{"name":"Hîncesti"},"id":"MD.HI","arcs":[[-81,91,92,93,94]]},{"type":"Polygon","properties":{"name":"Ialoveni"},"id":"MD.IA","arcs":[[-56,-67,95,-82,-95,96,97]]},{"type":"Polygon","properties":{"name":"Leova"},"id":"MD.LE","arcs":[[-80,-51,-73,98,-92]]},{"type":"Polygon","properties":{"name":"Nisporeni"},"id":"MD.NI","arcs":[[99,-97,-94,100,-35,-76]]},{"type":"Polygon","properties":{"name":"Orhei"},"id":"MD.OH","arcs":[[101,-62,-85,102,-74,103,104]]},{"type":"Polygon","properties":{"name":"Rezina"},"id":"MD.RZ","arcs":[[-105,105,106,107]]},{"type":"Polygon","properties":{"name":"Rezina"},"id":"MD.RZ","arcs":[[-63,-102,-108,108,109]]},{"type":"Polygon","properties":{"name":"Şoldăneşti"},"id":"MD.SD","arcs":[[-107,110,-87,111]]},{"type":"Polygon","properties":{"name":"Străşeni"},"id":"MD.ST","arcs":[[-84,-57,-98,-100,-75,-103]]},{"type":"Polygon","properties":{"name":"Teleneşti"},"id":"MD.TE","arcs":[[-106,-104,-77,-33,-30,-88,-111]]},{"type":"Polygon","properties":{"name":"Causeni"},"id":"MD.CU","arcs":[[112,113,114,-78,-96,-66]]},{"type":"Polygon","properties":{"name":"Bender"},"id":"MD.BD","arcs":[[115,-113,-65,-90,116]]},{"type":"Polygon","properties":{"name":"Ştefan Voda"},"id":"MD.SV","arcs":[[117,-114,-116]]},{"type":"Polygon","properties":{"name":"Camenca"},"id":"MD.SD","arcs":[[-109,-112,-86,118,119]]},{"type":"Polygon","properties":{"name":"Soroca"},"id":"MD.SO","arcs":[[-119,-89,-22,-4,120]]}]}},"arcs":[[[1804,9643],[5,-10],[46,-146],[119,-94]],[[1974,9393],[-50,-70],[20,-107],[-73,-52],[-92,-5],[-83,-28],[-81,36],[-33,62],[-68,8],[-69,-55],[-10,-98],[-17,-94],[-61,-59],[-42,-89],[-66,-46],[-25,-3]],[[1224,8793],[0,3],[-15,17],[-26,17],[-24,9],[-35,-23],[-54,14],[-78,36],[0,21],[56,2],[33,25],[0,29],[-99,29],[-21,35],[-14,38],[-36,24],[-25,-19],[-33,-36],[-27,-12],[-12,56],[-18,25],[-120,95],[-30,-15],[-65,64],[-49,19],[-117,-18],[-56,9],[-31,50],[-31,-36],[-31,5],[-65,45],[-65,-2],[-136,-51],[2,27],[19,52],[31,40],[94,46],[14,43],[16,28],[56,-17],[39,-34],[30,-41],[35,-35],[53,-19],[56,4],[33,22],[12,43],[-2,63],[-15,63],[-17,40],[-2,30],[30,32],[16,1],[47,-14],[19,-1],[25,20],[8,24],[10,21],[31,8],[94,-32],[94,-62],[98,-47],[108,15],[27,22],[20,-3],[20,-9],[31,2],[34,-5],[15,8],[-3,17],[-9,18],[-3,13],[2,22],[-8,28],[2,24],[32,9],[30,-7],[59,-29],[305,-90],[93,-4],[108,44],[15,15]],[[3942,9470],[1,-3],[37,-139],[-1,-141],[-120,-40],[-62,-109]],[[3797,9038],[-102,-18],[-93,45],[-87,18],[-4,-63],[67,-26],[7,-51],[12,-40],[28,-23],[-5,-53],[-101,-17],[-112,15],[-112,-17],[-48,-48],[-16,-62],[-54,-26],[-49,-35],[1,-36],[16,-32],[-41,-15],[-58,19]],[[3046,8573],[-118,56],[-121,23],[-72,89],[-93,49]],[[2642,8790],[-46,91],[70,93],[20,34],[-25,45],[-122,124]],[[2539,9177],[37,57],[62,136],[53,60],[33,84],[47,57],[177,-27],[140,26],[300,-20],[151,58],[68,35]],[[3607,9643],[32,-37],[22,-16],[63,-76],[115,-35],[103,-9]],[[2642,8790],[3,-80],[25,-85],[3,-32],[-228,-131],[-111,-32],[-64,0],[-60,5],[-49,-31],[-72,26],[-52,61],[-85,-19],[-74,-70],[-44,-95],[-58,-73],[-78,-25],[-81,-6],[-22,-2]],[[1595,8201],[0,6],[-18,8],[-60,38],[34,23],[20,29],[-3,31],[-33,29],[-39,-16],[-26,45],[-37,42],[-73,-25],[-7,9],[-5,11],[-4,13],[-3,14],[58,20],[0,25],[-75,33],[-68,48],[-50,64],[-21,81],[7,18],[30,30],[2,16]],[[1974,9393],[261,-183],[304,-33]],[[1804,9643],[154,150],[103,41],[55,-11],[81,-59],[39,-11],[47,18],[173,114],[65,69],[118,0],[34,6],[73,39],[63,-6],[5,-87],[58,-22],[355,2],[95,-34],[184,-106],[42,-35],[59,-68]],[[3046,8573],[-14,-114],[-23,-22],[-6,-29],[16,-31],[3,-36],[-12,-23],[-10,-29],[36,-53],[52,-34],[103,-44],[92,39],[68,70],[85,4],[180,-176],[60,-36],[9,-61],[25,-91],[84,-17]],[[3794,7890],[5,-106]],[[3799,7784],[-146,-58],[-151,-46]],[[3502,7680],[-93,33],[-151,138],[-98,5],[-84,-38],[-97,-8],[-260,118],[-130,26],[-126,-10],[-80,-72],[-96,6],[-115,-22],[-95,-91],[-15,-64],[-25,-60],[-47,-34],[-51,-28],[-32,-11]],[[1907,7568],[-1,5],[-15,11],[-50,30],[-11,15],[-14,28],[-32,49],[-39,48],[-34,22],[98,48],[-22,28],[-31,12],[-35,8],[-29,17],[2,21],[-5,102],[3,15],[-52,48],[-64,28],[-31,30],[50,54],[0,14]],[[3832,7520],[-171,8],[-126,40]],[[3535,7568],[-4,62],[-29,50]],[[3799,7784],[68,-90],[105,14],[88,-36],[15,-127],[14,-40],[-26,-39],[-45,-34],[-53,-1],[-54,95],[-79,-6]],[[3797,9038],[310,-160],[108,-102],[34,-141],[-59,-39],[-74,-26],[-75,-108],[-30,-55],[118,-64]],[[4129,8343],[-12,-79],[27,-77],[18,-23],[8,-32],[-19,-32],[-23,-35]],[[4128,8065],[-183,-156],[-78,-1],[-73,-18]],[[3832,7520],[-53,-95],[-12,-104],[173,-10],[42,-178],[-5,-64],[-72,-20],[-39,-32],[-33,-44],[-96,-55],[-6,-78],[89,-35],[78,1],[51,-56],[-22,-79],[-63,-54]],[[3864,6617],[-69,16],[-69,-4],[-37,-20],[4,-76],[-37,-18],[-197,-19],[-192,4],[-187,-26],[-52,-54],[-169,-52],[-74,-54],[-22,-14]],[[2763,6300],[-7,5],[-40,21],[23,102],[-51,35],[9,39],[11,34],[15,25],[23,15],[-20,32],[-36,26],[-43,20],[-38,12],[-5,-2],[-73,2],[-17,7],[-11,8],[-14,7],[-25,3],[-30,21],[-18,48],[-21,89],[-7,2],[-31,3],[-11,6],[-6,15],[0,30],[-3,12],[-9,20],[-13,42],[-6,18]],[[2309,6997],[178,126],[200,73],[110,-7],[105,29],[39,88],[37,25],[35,29],[71,100],[44,5],[45,-18],[83,37],[67,69],[28,79],[48,12],[61,-54],[75,-22]],[[2309,6997],[-3,10],[-89,26],[-79,64],[-185,193],[-66,87],[-26,73],[66,10],[0,21],[-16,24],[5,35],[-9,28]],[[5087,7360],[6,-99],[26,-94],[-12,-63],[-66,-9],[-41,-20],[-32,-39],[-10,-37],[-14,-33],[-99,-17],[-272,26],[-153,-58],[-30,-67],[30,-69],[-7,-100],[-49,-81]],[[4364,6600],[-133,7],[-110,-52],[-52,-10],[-54,50],[-151,22]],[[4128,8065],[47,-36],[41,-40],[10,-44],[16,-35],[32,-5],[34,-9],[20,-76],[54,4],[72,18],[53,-85],[52,-67],[105,-6],[96,-16],[-39,-90],[-5,-69],[217,-32],[80,-54],[74,-63]],[[4364,6600],[103,-70],[109,-58]],[[4576,6472],[-3,-86],[-51,-48],[-74,-18],[-162,-108],[-106,-42],[83,-87],[119,-26],[-100,-46],[-90,-96]],[[4192,5915],[-97,-30],[-83,-2],[-78,-14],[-65,-150],[-24,-173],[21,-72],[44,-41],[23,-4],[22,-11],[8,-44],[2,-45],[27,-71],[75,-8],[50,-25],[-37,-58],[-38,-30]],[[4042,5137],[-4,3],[-25,55],[-56,-22],[-62,23],[-67,33],[-69,11],[-1,48],[-36,25],[-80,42],[-87,77],[-27,15],[-27,7],[-13,10],[18,24],[0,23],[-123,53],[-34,37],[32,8],[5,14],[-8,20],[-8,26],[-5,2],[-34,90],[-72,73],[-31,42],[4,41],[-58,80],[-30,26],[-71,13],[-22,12],[-22,14],[-30,15],[-77,14],[-22,9],[-37,49],[-68,129],[-32,22]],[[5187,2100],[19,-27],[32,-3]],[[5238,2070],[-18,-125],[-38,-128],[-3,-106],[21,-100],[40,-36],[25,-47],[-32,-54],[-54,-27],[-87,-25],[-44,-87]],[[5048,1335],[-34,-96],[-154,-148],[-68,-103],[-15,-167],[117,-131],[180,-27],[168,114],[79,83],[36,106],[-4,97],[45,64]],[[5398,1127],[74,-85],[26,-131],[38,-6],[1,0]],[[5537,905],[11,-36],[-17,-27],[-83,-21],[-49,-27],[-31,-27],[-66,-80],[-20,-38],[25,-24],[45,-22],[36,-30],[16,-47],[5,-46],[13,-45],[39,-45],[-75,-29],[-17,-12],[-2,-4]],[[5367,345],[-2,0],[-5,2],[-215,2],[-210,72],[-204,-13],[-25,-175],[-3,-35],[0,-1]],[[4703,197],[-152,-93],[-25,-39],[-19,-42],[-6,-23],[-76,75],[-20,33],[-1,112],[-4,8],[-7,7],[-11,20],[-48,70],[-65,42],[-159,69],[36,37],[47,37],[47,28],[37,11],[94,-1],[40,16],[-18,43],[6,53],[-25,332],[-24,31],[-50,79],[-44,100],[-8,96],[12,18],[38,22],[8,16],[-5,13],[-26,42],[-8,24],[4,26],[12,26],[6,25],[-12,26],[-17,23],[-7,20],[-5,37],[-70,165],[-10,47],[5,33],[36,116],[-1,18],[-17,9],[-1,18],[7,17],[23,12],[20,46],[8,18]],[[4248,2115],[125,-36],[134,-6],[109,-42],[43,43],[32,55],[113,2],[111,-68],[138,-3],[134,40]],[[5398,1127],[-92,63],[-114,15],[-65,76],[-79,54]],[[5238,2070],[109,4],[107,-25],[105,-57],[84,-70],[-38,-55],[8,-48],[19,-43],[72,-107],[116,4],[470,138],[169,222],[81,297]],[[6540,2330],[133,104],[61,77]],[[6734,2511],[73,-56],[16,-72],[-34,-78],[-65,-89],[-98,-89],[-21,-52],[6,-82],[51,-144],[-6,-65],[-71,-27],[-496,-106],[-49,-26],[-32,-48],[-2,-56],[40,-114],[11,-55],[-4,-67],[-19,-43],[-36,-29],[-55,-25],[-82,-15],[-22,-15],[-1,-19],[7,-30],[4,-34],[-10,-32],[-74,-35],[-191,-16],[-46,-62],[9,-25]],[[5367,345],[-16,-24],[-1,-8],[6,-6],[18,-113],[-12,-39],[-60,-22],[-183,6],[-213,46],[-203,13],[0,-1]],[[5187,2100],[16,65],[-9,62],[-39,53],[40,57],[82,59],[74,72],[10,94],[-24,99],[24,102],[32,96],[-7,71],[-128,78],[-19,60],[52,52],[-14,69]],[[5277,3189],[191,124],[18,36],[40,5],[45,32],[29,55]],[[5600,3441],[127,-79],[259,-128],[120,-74]],[[6106,3160],[-14,-125],[-43,-115],[-79,-56],[-32,-93],[61,-2],[34,79],[66,-7],[41,-65],[80,-17],[29,-77],[-10,-38],[-3,-41],[44,-48],[60,-20],[109,24],[87,-58],[-12,-90],[16,-81]],[[6331,5401],[71,-76],[103,-6],[129,-144],[31,44],[21,63],[42,-53],[-22,-109]],[[6706,5120],[-116,-45],[-73,-118]],[[6517,4957],[-277,75],[-49,0],[-45,14],[8,37],[27,33],[-7,87],[-45,59]],[[6129,5262],[-103,34],[-207,154],[-2,96],[135,-63],[123,-110],[131,-20],[125,48]],[[7834,6092],[-4,-2],[-49,-55],[6,-34],[3,-44],[-23,-38],[-33,-30],[-93,-69],[-75,-85],[51,-153],[5,-21],[7,-20],[-17,-6],[-1,0]],[[7611,5535],[-4,14],[-1,1],[-36,7],[-39,18],[-1,1],[-40,33],[-1,1],[-37,13],[-28,-44],[-17,0],[-1,0],[-22,29],[0,1],[-35,16],[-36,-1],[-25,-22],[2,-36],[23,-35],[17,-36],[-13,-40],[-28,-7],[-36,10],[-30,3],[-23,-56],[-51,-49],[-16,-25],[-16,13],[-57,46],[-1,1],[-40,22],[-42,8],[-2,0],[27,51],[45,60],[50,49],[93,43],[53,96],[45,17],[-45,112]],[[7243,5849],[1,0],[74,105],[-43,92],[-116,-38],[-24,-15],[73,-98]],[[7208,5895],[-116,-37],[-104,42],[9,78],[-16,86],[-140,123]],[[6841,6187],[-53,59],[-61,41],[50,44],[26,65],[48,15],[74,-34],[40,38],[48,14],[22,103],[49,55],[9,33],[-7,18]],[[7086,6638],[1,0],[53,-13],[26,46],[3,14],[0,1]],[[7169,6686],[8,-13],[45,-99],[23,-36],[52,-31],[29,20],[27,35],[47,17],[41,-18],[51,-69],[88,-46],[19,-35],[13,-40],[23,-35],[39,-18],[45,-7],[44,-16],[37,-43],[15,-52],[1,-48],[9,-47],[9,-13]],[[8093,4924],[25,-31],[9,-61],[0,-80],[7,-31],[-13,-41],[-87,-59],[27,-117]],[[8061,4504],[-74,-13],[-73,-3],[-61,7],[-61,-13],[-78,-99],[-40,4],[-36,28],[-19,-39],[-12,-73],[-73,6],[-77,-3],[-60,61],[-68,-49],[-58,21],[-15,86],[-178,38],[-34,31],[7,32],[17,48],[-39,22]],[[7029,4596],[-109,27],[-19,71],[44,46],[9,63],[-58,41],[-72,13],[-66,21],[-61,13],[-33,-29],[-26,-41],[-80,30],[-41,106]],[[6706,5120],[49,-9],[47,0],[56,76],[82,39],[86,-17],[81,-167],[94,15],[95,30],[80,-47],[87,-33],[40,61],[-15,95],[-1,136],[13,135],[46,78],[65,23]],[[7611,5535],[0,-1],[-4,-23],[11,-22],[11,-7],[17,-11],[70,-27],[98,-80],[22,-18],[17,-26],[13,-96],[-4,-43],[-3,2],[-27,13],[-18,0],[15,-50],[12,-22],[1,0],[11,4],[-1,-2],[-13,-26],[-7,-5],[-10,1],[-73,-37],[-47,-12],[-44,0],[-40,13],[23,-57],[37,-54],[46,-44],[9,-5],[41,-22],[74,-7],[60,26],[54,32],[56,16],[68,-13],[1,-1],[6,-7]],[[6938,3428],[-101,-30],[-212,-115],[-58,-73],[-18,-93],[23,-121],[50,-156],[3,-52],[-17,-60],[-20,-47],[2,-45],[48,-53],[1,0],[95,-72]],[[6106,3160],[96,13],[34,52],[-1,92],[84,45],[60,7],[42,42],[27,52],[97,67],[39,54],[59,30],[64,10],[202,-8],[54,-31],[-14,-88],[-11,-67],[0,-2]],[[4248,2115],[48,112],[16,81],[33,77],[-9,29],[-17,23],[-18,19],[-52,69],[-6,29],[34,12],[32,7],[7,18],[-10,56],[12,23],[28,12],[32,8],[27,11],[34,28],[39,68],[4,12],[-3,40],[-11,67],[7,24],[34,10],[14,14],[16,101],[19,15],[21,7]],[[4579,3087],[7,-7],[56,-15],[52,27],[38,50],[61,16],[52,22],[50,-10],[-2,-33],[3,-36],[109,-37],[96,65],[13,61],[40,28],[62,-8],[61,-21]],[[5415,6466],[35,-123],[156,-80],[-24,-80]],[[5582,6183],[-53,-31],[-128,-12],[-171,-123],[25,-48],[46,-42],[13,-82],[-54,-53],[-143,-106],[-72,-26],[-138,-11],[-44,-44]],[[4863,5605],[-79,3],[-79,13],[-78,38],[-80,22],[-190,90],[-165,144]],[[4576,6472],[112,48],[118,-64],[45,-8],[46,1],[78,26],[26,-1],[31,-15],[100,20],[100,54],[103,9],[80,-76]],[[6697,4436],[51,-202],[87,-160],[151,-189],[150,-43],[120,-85],[43,-111],[1,-87],[0,-1]],[[7300,3558],[-58,1],[-250,-114],[-54,-17]],[[5600,3441],[8,98],[-27,81],[-16,36],[40,47],[0,50],[6,47],[22,35],[15,38],[-47,45],[-7,72]],[[5594,3990],[67,102],[40,147],[81,29],[72,48],[79,41],[84,22],[-14,63],[23,60]],[[6026,4502],[127,-91],[129,-4],[68,5],[68,-9],[49,36],[47,25],[94,-65],[18,-10],[18,0],[53,47]],[[7208,5895],[35,-46]],[[6331,5401],[-67,85],[-98,58],[-17,100],[32,111]],[[6181,5755],[46,26],[-12,94],[72,86],[109,-14],[117,51],[107,76],[121,35],[100,78]],[[5261,8383],[85,-31],[26,-96],[-27,-143],[-52,-89]],[[5293,8024],[-143,-141],[32,-133],[24,16],[21,23],[42,-8],[42,-28],[100,-43],[42,-126]],[[5453,7584],[-83,-117],[-84,-95],[-48,21],[-49,28],[-57,-21],[-45,-40]],[[4129,8343],[196,26],[199,0],[94,-7],[92,16],[19,34],[21,30],[50,-16],[50,-27],[135,-44],[56,14],[55,23],[81,-43],[84,34]],[[8374,4958],[-2,0],[-232,-6],[-47,-28]],[[7834,6092],[29,-38],[38,-27],[43,-16],[46,-4],[46,12],[49,37],[20,46],[13,51],[29,51],[58,5],[56,-3],[54,-15],[48,-34],[38,-57],[26,-77],[3,-76],[-33,-57],[-70,-30],[-10,-71],[29,-174],[-17,-81],[-41,-39],[-62,-14],[-79,-7],[-6,-9],[-2,-10],[2,-11],[6,-10],[87,-130],[25,-20],[31,20],[25,43],[33,37],[53,4],[38,-20],[33,-36],[20,-45],[3,-50],[-22,-45],[-34,-31],[-31,-36],[-21,-124],[-13,-43]],[[5594,3990],[-20,130],[-96,32],[-110,-56],[-101,-18],[-95,71],[-105,23],[-17,-40],[-15,-45],[-45,-3],[-33,-21],[56,-64],[-9,-63],[6,-35],[21,-41],[-26,-27],[-145,-28],[-64,25],[-24,72],[-91,-18],[-50,-17]],[[4631,3867],[-3,13],[-29,90],[-159,256],[0,62],[-115,157],[-46,93],[3,26],[5,40],[0,24],[-32,33],[3,39],[-2,38],[-47,26],[24,50],[-1,8]],[[4232,4822],[25,-6],[311,-43],[94,119],[128,104],[71,13],[49,56],[-20,49],[-27,45],[45,67],[149,-163],[37,-64],[-29,-93],[75,-30],[112,131],[79,135],[-85,50],[30,36],[42,20]],[[5318,5248],[91,-76],[96,-50],[-9,-59],[-20,-53],[131,-117],[142,-97],[32,-31],[13,-47],[2,-49],[18,-40],[51,27],[45,53],[83,-70],[33,-137]],[[7029,4596],[-84,-61],[-91,-52],[-81,-17],[-76,-30]],[[5318,5248],[28,22],[23,26]],[[5369,5296],[92,-7],[81,3],[71,-110],[107,-56],[40,41],[50,29],[71,-24],[68,-36],[117,4],[63,122]],[[4579,3087],[5,2],[13,19],[-21,45],[41,16],[16,25],[4,28],[-1,102],[-3,28],[-10,3],[-12,-3],[-12,8],[-37,59],[-6,26],[6,124],[11,25],[26,14],[-24,55],[14,47],[29,41],[18,36],[1,45],[-6,35]],[[4863,5605],[37,-32],[34,-50],[-21,-47],[-30,-41],[43,-88],[88,-8],[54,23],[57,7],[45,-28],[51,-13],[85,29],[63,-61]],[[4232,4822],[-8,49],[-56,121],[-38,56],[-88,89]],[[6855,6836],[18,-35],[44,-42],[1,0],[125,-62],[31,-30],[12,-29]],[[6181,5755],[-44,68],[-35,77],[-67,7],[-88,-23],[-55,65],[-37,82],[-24,80],[-34,70],[-60,4],[-52,-39],[-52,6],[-51,31]],[[5415,6466],[161,57],[1,38],[-21,31],[4,30],[24,30],[0,34],[7,33],[57,39],[65,27],[239,134]],[[5952,6919],[56,-1],[54,-12],[57,-45],[71,-13],[80,26],[113,114],[70,10],[35,29],[20,39],[71,-15],[72,-48],[93,-115],[111,-52]],[[5952,6919],[4,92],[22,74],[-81,51],[-27,51],[-38,32],[-160,71],[74,166]],[[5746,7456],[159,92],[209,-30],[72,168],[67,30],[71,21],[-1,29],[-45,14],[50,57],[200,-26],[13,49],[34,34],[50,-11],[49,-14],[-22,76],[-37,60],[-1,1]],[[6614,8006],[109,-26],[1,0],[106,-72],[-1,-88],[-106,-203],[-14,-73],[14,-185],[22,-89],[6,-14],[15,-18],[-6,-40],[-12,-39],[-8,-16],[19,-58],[64,-75],[15,-36],[1,-69],[10,-57],[6,-12]],[[6614,8006],[-17,27],[-18,11],[4,102],[14,55]],[[6597,8201],[41,-25],[86,-27],[104,15],[125,128],[90,34],[49,-1],[40,-12],[35,-26],[33,-43],[22,-51],[25,-113],[23,-48],[40,-25],[112,-26],[29,-16],[-10,-45],[-43,-47],[-53,-45],[-35,-37],[-25,-58],[0,-36],[27,-22],[99,-27],[36,-27],[11,-36],[-34,-42],[-85,-85],[-15,-103],[2,-117],[-29,-125],[-74,-100],[-73,-77],[-37,-87],[37,-133],[1,0],[18,-30]],[[5746,7456],[-154,47],[-139,81]],[[5293,8024],[74,-18],[76,32],[110,-19],[90,-80],[103,-69],[91,53],[-35,63],[3,71],[72,117],[106,62],[51,1],[49,14],[42,44],[16,11],[25,28],[0,1],[1,-1],[79,-56],[50,-81],[-4,-79],[34,-22],[57,-36],[231,-54]],[[8061,4504],[54,-39],[37,-64],[36,-9],[22,20],[25,-30],[53,-14],[4,4],[2,-1],[26,-24],[33,-31],[48,-143]],[[8401,4173],[23,-97],[-14,-94],[-41,-11],[-47,-1],[-32,-54],[-37,-54],[-48,7],[-50,11],[-80,-41],[-73,-56],[-5,-47],[1,-47],[-33,-61],[12,-61],[64,-64],[29,-81],[8,-40],[1,-1]],[[8079,3381],[-57,-25],[-53,-47],[-124,-153],[-36,-1],[-51,60],[-66,114],[-40,11],[-50,-67],[-9,-40],[13,-67],[-2,-30],[-19,-42],[-14,-6],[-20,6],[-35,-11],[-103,-92],[-63,-31],[-48,33],[-1,35],[20,32],[25,30],[18,32],[6,39],[-3,280],[-18,71],[-46,46],[-3,0]],[[9337,3608],[-24,17],[-58,61],[-8,13],[0,1],[-43,0],[-35,6],[-28,20],[-19,40],[-1,1],[-104,-60],[-32,-7],[-93,41],[-41,3],[-2,1],[22,43],[35,34],[41,23],[38,15],[-48,98],[-26,22],[-2,1],[-60,14],[-20,-6],[-26,-11],[-23,0],[-10,27],[-11,8],[-1,1],[-29,4],[-53,-2],[-1,0],[-42,53],[-101,20],[-60,48],[-71,36]],[[8374,4958],[-2,-8],[-3,-44],[25,-36],[16,-3],[72,5],[26,-11],[45,-41],[24,-17],[46,-13],[93,-7],[44,-12],[46,-38],[67,-86],[52,-31],[90,-11],[84,7],[81,-8],[81,-55],[13,-23],[23,-60],[13,-18],[26,-1],[26,14],[28,10],[30,-14],[7,-22],[0,-71],[3,-31],[12,-24],[31,-47],[12,-26],[5,-60],[-24,-206],[-11,-39],[-14,-29],[-10,-32],[-2,-43],[10,-35],[36,-67],[6,-32],[-33,-71],[-62,-10],[-49,-4]],[[9337,3608],[8,-73],[41,-40],[125,-43],[6,-8],[14,-32],[10,-7],[18,5],[35,18],[16,0],[23,-14],[18,-21],[35,-57],[-21,-29],[130,-83],[49,-47],[28,20],[43,7],[46,-7],[38,-20],[-69,-102],[-75,-58],[-124,-18],[-338,16],[-46,-8],[-51,-23],[-105,-76],[-56,-6],[-56,50],[-6,23],[2,64],[-5,30],[-14,28],[-59,75],[-149,115],[-37,50],[-1,-93],[-31,-48],[-57,-18],[-81,-1],[-18,-21],[14,-81],[-21,-54],[-38,-31],[-47,-14],[-49,4],[-44,22],[-39,41],[-39,73],[-40,29],[-40,12],[-90,14],[-43,14],[-16,24],[-5,25],[5,25],[16,27],[16,23],[5,22],[-5,22],[-16,20],[-66,9],[-2,-1]],[[5261,8383],[42,119],[107,63],[70,118],[-122,69],[-3,0]],[[5355,8752],[4,13],[52,120],[63,23],[92,-4],[261,-84],[198,-2],[103,-14],[80,-42],[19,-27],[6,-24],[3,-22],[7,-23],[45,-85],[9,-87],[5,-20],[19,-21],[47,-35],[18,-24],[59,-79],[91,-78],[61,-36]],[[3942,9470],[150,-15],[59,-22],[46,-42],[16,-60],[-56,-129],[41,-25],[64,-2],[44,9],[88,58],[47,6],[21,-55],[10,-63],[30,-38],[49,-12],[66,12],[61,27],[45,31],[48,24],[131,12],[49,-5],[30,-26],[5,-63],[-19,-68],[-31,-31],[-41,-21],[-45,-40],[-19,-46],[5,-46],[32,-28],[60,9],[44,39],[30,50],[37,39],[65,7],[45,-24],[27,-44],[-3,-51],[-47,-41],[80,-130],[34,-28],[58,-31],[30,2],[10,30],[1,57],[16,56]]],"transform":{"scale":[0.0003514038740874194,0.0003024562303230319],"translate":[26.617889038000015,45.46177398700007]}};
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
