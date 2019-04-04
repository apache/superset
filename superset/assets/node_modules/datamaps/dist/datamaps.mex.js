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
  Datamap.prototype.mdaTopo = '__MDA__';
  Datamap.prototype.mdgTopo = '__MDG__';
  Datamap.prototype.mdvTopo = '__MDV__';
  Datamap.prototype.mexTopo = {"type":"Topology","objects":{"mex":{"type":"GeometryCollection","geometries":[{"type":"MultiPolygon","properties":{"name":null},"id":"-99","arcs":[[[0]],[[1]],[[2]],[[3]],[[4]],[[5]],[[6]],[[7]],[[8]]]},{"type":"MultiPolygon","properties":{"name":"Baja California"},"id":"MX.BN","arcs":[[[9,10]],[[11,12]],[[13]],[[14]],[[15]],[[16]],[[17]],[[18]],[[19]],[[20]],[[21]],[[22]],[[23]],[[24]],[[25]],[[26]],[[27]],[[28]],[[29]],[[30]],[[31]],[[32]],[[33]],[[34]],[[35,36,37,38]]]},{"type":"MultiPolygon","properties":{"name":"Baja California Sur"},"id":"MX.BS","arcs":[[[39]],[[40]],[[41]],[[42]],[[43]],[[44]],[[45]],[[46]],[[47]],[[48]],[[49]],[[50]],[[51]],[[52]],[[53]],[[54]],[[55]],[[56]],[[57]],[[58]],[[-12,59,-10,60,-37,61]]]},{"type":"Polygon","properties":{"name":"Coahuila"},"id":"MX.CA","arcs":[[62,63,64,65,66]]},{"type":"Polygon","properties":{"name":"Chihuahua"},"id":"MX.CH","arcs":[[-66,67,68,69,70]]},{"type":"Polygon","properties":{"name":"Durango"},"id":"MX.DU","arcs":[[-65,71,72,73,-68]]},{"type":"MultiPolygon","properties":{"name":"Sinaloa"},"id":"MX.SI","arcs":[[[74]],[[-74,75,76,77,78,79,80,81,-69]]]},{"type":"MultiPolygon","properties":{"name":"Sonora"},"id":"MX.SO","arcs":[[[82,-78]],[[83,-80]],[[84]],[[85]],[[86]],[[87]],[[88]],[[89]],[[90]],[[-70,-82,91,-39,92]]]},{"type":"Polygon","properties":{"name":"Zacatecas"},"id":"MX.ZA","arcs":[[93,94,95,96,97,-72,-64]]},{"type":"Polygon","properties":{"name":"Nuevo León"},"id":"MX.NL","arcs":[[98,99,100,-63]]},{"type":"Polygon","properties":{"name":"San Luis Potosí"},"id":"MX.SL","arcs":[[101,102,103,104,105,-94,-101]]},{"type":"MultiPolygon","properties":{"name":"Tamaulipas"},"id":"MX.TM","arcs":[[[106]],[[107,-102,-100,108]]]},{"type":"Polygon","properties":{"name":"Aguascalientes"},"id":"MX.AG","arcs":[[109,-96]]},{"type":"MultiPolygon","properties":{"name":"Colima"},"id":"MX.CL","arcs":[[[110]],[[111]],[[112]],[[113,114,115]]]},{"type":"Polygon","properties":{"name":"Jalisco"},"id":"MX.JA","arcs":[[-110,-95,116,117,-116,118,119,-97]]},{"type":"Polygon","properties":{"name":"Michoacán"},"id":"MX.MC","arcs":[[120,121,122,123,-114,-118,124]]},{"type":"MultiPolygon","properties":{"name":"Nayarit"},"id":"MX.NA","arcs":[[[125]],[[126]],[[127]],[[128]],[[-98,-120,129,-76,-73]]]},{"type":"MultiPolygon","properties":{"name":"Campeche"},"id":"MX.CM","arcs":[[[130]],[[131,132,133,134,135]]]},{"type":"Polygon","properties":{"name":"Oaxaca"},"id":"MX.OA","arcs":[[136,137,138,139,140,141,142]]},{"type":"Polygon","properties":{"name":"Puebla"},"id":"MX.PU","arcs":[[-142,143,144,145,146,147,148]]},{"type":"Polygon","properties":{"name":"Tabasco"},"id":"MX.TB","arcs":[[149,150,151,152,-134]]},{"type":"Polygon","properties":{"name":"Tlaxcala"},"id":"MX.TL","arcs":[[153,154,-147]]},{"type":"Polygon","properties":{"name":"Distrito Federal"},"id":"MX.DF","arcs":[[155,156]]},{"type":"Polygon","properties":{"name":"Guanajuato"},"id":"MX.GJ","arcs":[[157,-125,-117,-106]]},{"type":"Polygon","properties":{"name":"Guerrero"},"id":"MX.GR","arcs":[[158,-144,-141,159,-123,160]]},{"type":"Polygon","properties":{"name":"Hidalgo"},"id":"MX.HI","arcs":[[-148,-155,161,162,-104,163]]},{"type":"Polygon","properties":{"name":"México"},"id":"MX.MX","arcs":[[-154,-146,164,-157,165,-161,-122,166,-162]]},{"type":"Polygon","properties":{"name":"Morelos"},"id":"MX.MR","arcs":[[-165,-145,-159,-166,-156]]},{"type":"Polygon","properties":{"name":"Querétaro"},"id":"MX.QE","arcs":[[-163,-167,-121,-158,-105]]},{"type":"MultiPolygon","properties":{"name":"Veracruz"},"id":"MX.VE","arcs":[[[167]],[[168,-152,169,-143,-149,-164,-103,-108]]]},{"type":"MultiPolygon","properties":{"name":"Chiapas"},"id":"MX.CP","arcs":[[[-139,170]],[[171,-137,-170,-151]]]},{"type":"MultiPolygon","properties":{"name":"Quintana Roo"},"id":"MX.QR","arcs":[[[172]],[[173]],[[174]],[[175]],[[176]],[[-132,177,178]]]},{"type":"Polygon","properties":{"name":"Yucatán"},"id":"MX.YU","arcs":[[-178,-136,179]]}]}},"arcs":[[[8336,3116],[1,-2],[-1,0],[0,2]],[[8335,3117],[0,-1],[-1,3],[1,1],[0,-3]],[[8250,3497],[-1,-2],[0,3],[1,-1]],[[8230,3539],[-2,-2],[0,3],[2,-1]],[[8516,4169],[0,-4],[-3,4],[3,0]],[[9039,4346],[-1,-1],[-1,3],[1,0],[1,-2]],[[9026,4421],[0,-2],[-2,0],[-2,-1],[3,3],[1,0]],[[9030,4421],[-2,-1],[0,2],[1,0],[1,-1]],[[9054,4415],[11,-15],[11,-23],[4,-21],[-3,-28],[-4,-17],[-5,-6],[-5,2],[-6,5],[-2,4],[0,7],[-2,9],[1,4],[5,3],[7,9],[0,14],[-5,12],[-5,8],[-1,12],[-7,6],[-8,5],[-6,-3],[-2,-8],[-2,2],[1,8],[3,7],[4,9],[5,3],[11,-8]],[[1357,7405],[-9,0]],[[1348,7405],[-2,7],[-4,-1],[-1,3],[0,4],[4,4],[5,-4],[5,-8],[2,-5]],[[1333,7405],[-19,0]],[[1314,7405],[7,13],[9,21],[7,12],[5,1],[1,-14],[-1,-9],[-5,-7],[-4,-5],[-1,-5],[0,-4],[1,-3]],[[876,7580],[2,-4],[3,2],[3,0],[1,-4],[-3,0],[-1,-3],[-4,-2],[-4,4],[0,3],[1,3],[2,1]],[[1006,7457],[-2,-4],[2,-9],[-2,-8],[3,-9],[-1,-3],[0,-4],[-2,2],[-2,2],[-3,2],[-4,-4],[-3,-1],[-2,4],[-4,-1],[-3,3],[-2,17],[-6,9],[-7,4],[-6,-4],[-5,-1],[-3,-8],[-3,6],[1,19],[6,5],[19,35],[11,25],[-5,16],[-2,19],[2,16],[2,18],[4,6],[7,4],[7,-9],[-1,-11],[4,-15],[3,-3],[-1,-6],[2,-7],[2,-13],[-3,-15],[0,-12],[5,-11],[1,-12],[-2,-11],[1,-5],[-2,-7],[-4,-2],[0,-5],[-3,-6],[1,-6]],[[1916,7612],[0,-4],[-2,2],[-2,2],[-1,4],[3,3],[3,-3],[-1,-4]],[[1770,7725],[-3,-3],[-3,3],[-1,3],[-1,0],[-3,13],[-4,4],[-6,4],[-4,8],[-8,2],[1,4],[-2,3],[-2,4],[-2,4],[-3,4],[10,-3],[18,-20],[4,-7],[3,-3],[1,-4],[5,-4],[1,-5],[2,-2],[-3,-5]],[[1727,7784],[0,-2],[-3,1],[-4,3],[-3,2],[-1,3],[1,4],[3,-5],[4,-1],[3,-1],[0,-4]],[[1712,7802],[0,-2],[-1,2],[-1,1],[-2,0],[0,3],[-1,1],[-1,1],[2,0],[1,-2],[1,0],[2,-4]],[[1835,7809],[3,-3],[0,-6],[2,-3],[-1,-6],[0,-8],[-3,-8],[-6,-2],[-7,2],[-3,-2],[1,5],[-3,15],[-1,11],[4,2],[3,2],[7,-2],[4,3]],[[1702,7860],[1,-1],[0,-1],[0,-1],[-2,0],[0,1],[-1,1],[0,1],[1,0],[1,0]],[[1684,7897],[-1,-3],[-1,-2],[-1,-1],[-1,2],[1,1],[0,1],[1,0],[1,1],[0,2],[0,1],[0,1],[0,1],[2,-1],[0,-2],[-1,-1]],[[1545,7939],[0,-2],[-2,0],[0,3],[0,2],[-1,2],[2,-1],[1,-4]],[[1535,7952],[-1,-3],[-1,3],[-1,2],[2,2],[1,0],[1,-3],[-1,-1]],[[1550,7963],[-1,-1],[-1,3],[-1,4],[1,-1],[0,-1],[1,-2],[1,-2]],[[1669,7992],[-2,-2],[-2,0],[2,4],[2,1],[0,-3]],[[1540,7977],[0,-2],[-3,0],[-2,2],[1,3],[-1,2],[-2,3],[0,2],[1,2],[-1,1],[-1,4],[1,3],[-2,2],[-1,4],[-1,3],[2,2],[3,0],[2,-2],[0,-2],[-1,-3],[-1,-2],[2,-2],[0,-3],[-1,-4],[2,-4],[0,-3],[1,-1],[0,-3],[2,-2]],[[45,7909],[-8,-17],[-6,1],[-4,-4],[-2,0],[0,-6],[-3,5],[1,6],[4,2],[-3,13],[-1,8],[1,10],[-2,11],[-5,7],[3,9],[-3,16],[-3,7],[-3,7],[-7,8],[-1,9],[-1,9],[-2,8],[1,10],[3,10],[6,7],[9,5],[4,8],[7,2],[6,-5],[-5,-9],[-4,-7],[-1,-8],[2,-12],[4,-10],[5,-4],[7,-16],[3,-25],[-3,-11],[3,-20],[-2,-24]],[[1537,8250],[8,-2],[4,-7],[10,-14],[4,-15],[7,-4],[1,-4],[3,-5],[-1,-4],[4,-7],[4,-11],[-1,-5],[5,-5],[-4,-6],[-4,-7],[-1,-9],[2,-5],[0,-14],[8,-8],[12,-3],[3,-5],[4,0],[3,5],[4,-1],[2,-1],[6,1],[5,1],[5,-2],[7,2],[5,-8],[-3,-9],[0,-12],[2,-6],[0,-11],[0,-6],[2,-3],[-2,-6],[-1,-12],[0,-15],[1,-6],[4,-10],[1,-4],[-1,-6],[3,-9],[4,-1],[4,-2],[2,-3],[5,-1],[-5,-15],[1,-7],[0,-16],[-3,1],[-4,8],[-3,2],[-4,7],[-10,6],[-3,10],[-5,5],[-4,2],[-5,6],[-2,7],[-2,3],[-2,8],[-4,8],[-5,9],[-3,6],[-4,1],[-2,5],[-5,3],[-6,5],[-2,10],[-8,5],[-6,8],[-8,17],[1,5],[-2,8],[-5,7],[-5,0],[-5,0],[-4,3],[-3,8],[0,10],[-2,5],[-4,5],[-3,8],[-2,3],[-1,6],[-5,7],[-1,4],[-3,6],[-6,7],[-1,13],[1,13],[5,12],[3,16],[-1,9],[-1,9],[3,2],[1,-3],[3,-3],[4,3],[4,2],[0,4],[4,0],[0,-7],[3,-1]],[[1517,8260],[-3,-3],[-2,6],[4,3],[1,-2],[0,-4]],[[1255,8484],[-4,-1],[-5,4],[2,6],[-1,6],[6,-1],[0,-9],[2,-5]],[[1230,8515],[0,-2],[-3,5],[3,0],[0,-3]],[[1209,8556],[1,-2],[1,-2],[-1,-1],[-2,3],[-1,1],[-2,0],[-1,2],[5,-1]],[[715,8771],[-3,0],[-3,2],[0,3],[3,3],[1,-1],[2,-4],[0,-3]],[[357,9821],[-2,0],[-1,6],[0,4],[-1,2],[-1,5],[2,-1],[1,-2],[1,-6],[1,-4],[0,-4]],[[1085,9556],[0,1],[-7,5],[-4,1],[-4,1],[-4,1],[-4,6],[-2,1],[-1,3],[-1,6],[-1,7],[-3,3],[-1,-3],[0,-6],[1,-7],[5,-13],[1,-2],[3,-3],[2,-2],[9,-2],[5,-4],[5,-6],[4,-6],[3,-7],[8,-2],[6,-9],[4,-10],[2,-9],[5,-2],[2,-7],[4,-39],[2,-11],[5,-11],[4,-13],[-3,-11],[-11,-19],[-5,-19],[-4,-22],[0,-75],[-7,-34],[1,-31],[-4,-49],[-1,-11],[1,-23],[7,-17],[8,-13],[8,-9],[-1,-4],[-6,-9],[1,-11],[3,-10],[6,-7],[21,-15],[5,-4],[1,-3],[1,-4],[1,-6],[1,-18],[0,-6],[1,-9],[-2,-8],[2,-5],[2,-8],[-1,-25],[2,-7],[2,-9],[-2,-5],[-3,-13],[3,-14],[1,-9],[-2,-18],[4,-17],[7,-18],[4,-11],[1,-6],[0,-5],[1,-6],[1,-6],[3,-10],[0,-8],[-2,-9],[0,-12],[3,-9],[-2,-16],[-2,-12],[2,-6],[-3,-27],[-2,-10],[-1,-4],[1,-7],[3,-7],[-1,-8],[-2,-11],[-1,-9],[-4,-7],[2,-9],[2,-5],[4,-11],[3,-6],[0,-6],[2,-8],[7,-4],[2,-12],[5,-9],[0,-12],[7,-18],[5,-15],[3,-13],[16,-11],[3,-16],[4,-5],[10,-1],[4,-9],[2,-6],[-2,-14],[4,-12],[2,-3],[-2,0],[-2,-3],[0,-4],[4,-3],[0,-2],[0,-5],[2,-8],[3,-4],[3,-3],[3,1],[3,-2],[2,-5],[0,-4],[2,-4],[6,-2],[5,1],[3,0],[2,3],[1,3],[0,2],[-2,0],[0,2],[0,3],[2,0],[1,2],[1,1],[0,-1],[2,0],[1,1],[2,-1],[0,-3],[1,1],[1,-3],[1,1],[4,0],[2,-2],[3,-5],[2,0],[0,-2],[4,-1],[1,-2],[1,-7],[1,-3],[2,-1],[1,-3],[2,-1],[0,-2],[1,-1],[1,-2],[2,-1],[1,-1],[2,-5],[1,-1],[1,2],[1,0],[2,-1],[1,-5],[3,-3],[0,-3],[1,-1],[3,-4],[2,-3],[0,-2],[5,-3],[2,-3],[2,-1],[7,-6],[1,-7],[1,-3],[2,-3],[1,-5],[4,-1],[1,-1],[1,-3],[1,-2],[0,-2],[3,-1],[3,-1],[3,0],[4,-5],[3,-6],[2,-6],[3,-3],[2,-1],[2,-8],[4,-2],[3,-5],[4,-6],[4,-8],[5,-5],[5,-7],[5,-3],[3,-1],[2,-4],[0,-8],[3,-3],[3,-1],[3,-2],[3,-4],[3,-1],[5,-4],[28,-51],[10,-12],[4,-6],[2,-10],[2,-3],[0,-3],[-4,-7],[-3,-7],[-3,-5],[0,-6],[3,-3],[3,-2],[-1,-8],[3,-6],[1,1],[1,-3],[0,-4],[3,0],[2,0],[0,-5],[2,-7],[4,-6],[3,-2],[3,-6],[2,-13],[5,-15],[4,-7],[-1,-7],[-4,0],[-1,-6],[-2,-3],[-1,-5],[1,-7],[4,-4],[1,-10],[-1,-9],[-2,-2],[-1,-4],[4,-8],[2,-7],[2,-8],[2,-3],[0,-5],[7,-1],[7,2],[1,2],[0,2],[2,8],[-3,3],[-2,5],[2,2],[0,3],[1,4],[2,1],[3,-1],[4,-2],[3,5],[2,4],[3,-6],[-1,-8],[5,-6],[2,2],[0,4],[6,3],[1,-2],[-1,-3],[-1,-1],[-1,-8],[8,-4],[0,-3],[-4,0],[0,-4],[3,-4],[1,-5],[3,-2],[-2,-3],[-1,-5],[0,-8],[-1,-4],[2,-8],[4,-3],[-1,-9],[7,0],[7,0],[3,4],[3,6],[2,4],[5,3],[3,4],[8,-2],[5,-6],[2,-4],[0,-8],[3,-2],[2,-4],[-1,-7],[3,-4],[0,-7],[-1,-8],[4,-16],[2,-1],[2,-12],[4,-19],[7,-9],[2,-7],[-1,-13],[3,-14],[1,-8],[2,-11],[-1,-9],[4,-13],[6,-7],[1,-3],[5,-4],[8,-2],[1,-5],[11,-6],[9,0],[13,6],[9,5],[5,-7],[0,-4],[3,-3],[0,-3],[-1,-4],[0,-2],[4,-1],[2,1],[1,4],[4,0],[-1,-6],[1,-4],[-2,-3],[-2,-8],[1,-3],[2,-9],[-2,-7],[-5,-21],[-1,-13],[2,-4],[-1,-9],[2,-6],[4,-7],[4,-4],[0,-5],[11,-18],[1,-4],[3,-1],[2,-3],[-3,-3],[0,-4],[-1,-8],[-2,-3],[-1,-7],[-1,-17],[3,-19],[1,-2],[2,-2],[1,-6],[-3,-5],[-2,-7],[0,-7],[2,-8],[4,-8],[5,-1],[2,-1]],[[1770,7405],[-54,0],[-57,0],[-57,0],[-57,1],[-57,0],[-56,0],[-57,-1],[-15,0]],[[1360,7405],[2,4],[5,11],[1,6],[-3,0],[-4,2],[-4,7],[-5,1],[-4,-1],[0,9],[-1,16],[-1,6],[-2,5],[1,3],[1,5],[5,12],[4,11],[2,10],[4,7],[-1,3],[-1,6],[-2,9],[-2,4],[-4,0],[-3,-5],[-3,2],[-3,5],[-2,3],[2,7],[3,10],[3,11],[6,20],[6,34],[4,15],[2,14],[-3,9],[-4,3],[-2,4],[1,9],[0,8],[-3,3],[-2,5],[-1,5],[-3,6],[-4,5],[-6,1],[-6,-1],[-4,3],[1,8],[0,11],[0,13],[-3,12],[-3,6],[-3,2],[-7,0],[-9,-1],[-3,-3],[-8,3],[-1,7],[1,2],[0,5],[-2,6],[-7,4],[-5,13],[-10,2],[0,10],[0,8],[-5,8],[0,10],[-3,10],[-6,-4],[-5,18],[1,12],[-5,10],[-6,-1],[0,9],[-7,9],[-5,10],[-8,2],[-4,-1],[-3,-3],[-2,0],[-4,5],[-2,10],[-2,10],[-2,6],[-4,-1],[-5,-8],[-4,18],[0,18],[-2,9],[-3,9],[-1,10],[-3,7],[-9,5],[-9,6],[-5,-10],[-6,12],[-1,13],[-3,6],[-1,13],[-1,7],[-3,3],[-11,0],[-13,21],[-7,15],[-9,16],[-15,24],[-14,25],[-42,23],[-26,5],[-15,34],[-17,22],[-27,15],[-16,21],[-9,14],[-8,3],[-7,-8],[-6,9],[-6,4],[-3,10],[-8,9],[-7,12],[-9,2],[-24,33],[1,12],[2,14],[1,16],[-1,11],[-2,10],[-1,16],[-7,12],[-2,8],[-5,7],[-6,3],[-14,2],[-1,6],[6,39],[2,30],[-2,17],[-1,3],[-3,8],[0,4],[0,7],[2,18],[0,24],[-3,24],[-6,19],[-4,16],[-9,12],[-10,10],[-11,7],[-13,1],[9,12],[3,6],[1,8],[-2,8],[-5,9],[-5,7],[-6,3],[3,-9],[3,-6],[3,-7],[0,-9],[-3,-4],[-4,-1],[-2,4],[-4,5],[-2,-3],[-2,-5],[0,-5],[3,-2],[3,-6],[2,-12],[3,-16],[-7,0],[-3,18],[-5,27],[-7,21],[6,81],[-2,57],[-5,29],[-1,11],[-4,5],[-11,4],[-15,21],[-8,1],[-8,18],[-5,11],[-2,8],[-8,16],[-6,4],[-12,-5],[-9,1],[-2,18],[5,21],[2,35],[3,32],[-10,39],[-35,66],[-14,37],[-4,7],[-1,2],[-5,10],[-3,3],[-4,3],[-7,8],[-4,3],[-3,3],[-1,4],[-1,4],[-2,5],[-12,15],[-2,5],[-7,8],[-2,8],[1,6],[-1,0],[4,1],[7,0],[-6,12],[1,9],[2,8],[2,15],[-2,10],[-4,11],[-2,3],[-5,3],[-8,2],[-8,15],[-3,7],[13,-4],[10,-10],[5,-2],[6,6],[4,11],[3,10],[3,16],[0,12],[0,11],[-3,8],[-11,4],[-7,2],[-5,12],[-8,6],[-5,2],[-6,3],[-1,14],[0,16],[-4,7],[-11,1],[-12,4],[-7,15],[-3,12],[-1,19],[-3,34],[-6,26],[-5,22],[-4,8],[-4,8],[-6,5],[-14,5],[-5,6],[-15,51],[-5,20],[-6,18],[-3,9],[-1,9],[-1,11],[0,12],[0,6],[0,4],[25,3],[23,4],[24,3],[23,3],[23,3],[23,3],[24,3],[23,3],[23,3],[23,3],[23,3],[24,3],[23,3],[23,3],[23,3],[23,3],[24,3],[23,3],[23,4],[23,3],[24,3],[23,3],[23,3],[23,3],[23,3],[24,3],[23,3],[23,3],[23,3],[24,3],[23,3],[23,3],[13,2],[0,-1],[-2,-13],[-3,-10],[-4,-9],[-2,-4],[-7,-10],[-2,-4],[-5,-14],[3,-11],[-1,-12],[-4,-23],[-4,-6],[1,0]],[[1121,9882],[0,-1],[-5,-4],[-6,-2],[-17,2],[-6,-5],[-6,-11],[-5,-13],[-2,-12],[-1,-10],[0,-9],[0,-10],[-4,-12],[-5,-11],[-7,-7],[-5,-10],[-1,-8],[2,-3],[8,-16],[8,-16],[5,-18],[4,-21],[-1,-12],[-4,-9],[-3,-8],[0,-9],[2,-2],[2,-2],[3,-3],[2,-3],[3,-6],[2,-7],[0,-7],[1,-8],[-1,-14],[0,-13],[0,-13],[1,-13]],[[2706,5289],[-1,-10],[-4,2],[-5,1],[-10,2],[-4,3],[1,4],[-4,10],[-5,12],[-4,20],[-4,17],[1,5],[2,5],[-7,22],[1,19],[0,8],[3,0],[2,-6],[0,-8],[4,-7],[2,-5],[2,-6],[4,-12],[3,-12],[4,-7],[5,-16],[2,-3],[4,-8],[5,-15],[0,-6],[3,-9]],[[2149,5411],[7,-2],[10,-5],[13,-15],[1,-4],[-22,16],[-9,2],[-11,1],[-13,-5],[-8,-2],[-3,4],[3,6],[2,3],[4,-2],[5,1],[9,2],[6,-1],[6,1]],[[2020,5489],[3,0],[18,0],[7,-1],[6,2],[4,-6],[4,2],[0,-7],[2,-8],[3,-3],[1,-7],[7,-2],[7,-1],[7,-9],[9,-28],[6,-9],[3,1],[1,-4],[-2,-8],[2,-6],[-3,-9],[-3,-7],[1,-11],[-10,22],[-6,9],[-15,19],[-12,15],[-9,12],[-11,10],[-2,4],[-4,2],[-4,9],[-11,7],[-9,5],[-1,5],[5,7],[6,-5]],[[2529,5504],[-2,-8],[6,-1],[7,-8],[3,-6],[3,-1],[1,-8],[2,-6],[3,-4],[-2,-6],[-4,-1],[-2,-6],[1,-7],[-3,-4],[-1,-5],[-2,-9],[-6,1],[-1,5],[-1,3],[1,7],[-2,3],[-2,1],[-3,-4],[0,5],[-1,4],[5,3],[0,3],[-3,1],[0,3],[-3,2],[-2,3],[-1,5],[-1,8],[1,5],[-3,3],[0,4],[4,3],[3,4],[-3,-1],[-4,3],[1,6],[-4,-1],[0,4],[1,4],[-3,2],[-1,4],[5,6],[1,6],[3,-3],[2,-6],[2,-5],[4,-5],[1,-6]],[[2464,5658],[1,-3],[0,-3],[-2,0],[0,4],[-2,0],[-2,-1],[-2,5],[0,1],[4,5],[2,2],[1,-2],[-1,-6],[1,-2]],[[2455,5773],[1,-5],[2,-2],[3,-4],[0,-5],[2,-4],[1,-10],[-2,-14],[4,-11],[2,-5],[1,-8],[5,-11],[3,-6],[-3,-2],[-6,-2],[-3,0],[-3,0],[-2,-5],[-2,1],[1,3],[2,4],[0,5],[-3,3],[-4,4],[-4,3],[0,3],[-3,3],[-4,-1],[-3,0],[0,3],[1,4],[-2,8],[-3,2],[-2,9],[0,5],[-2,5],[-2,4],[0,5],[-1,8],[-2,5],[-5,0],[-2,5],[-3,0],[-1,6],[0,8],[1,4],[0,7],[1,11],[1,4],[0,2],[2,-1],[2,-5],[3,-16],[5,-7],[9,-2],[8,-4],[7,-4]],[[2422,5862],[-2,-1],[1,2],[2,4],[0,-3],[-1,-2]],[[1960,5747],[0,-7],[-3,-3],[-3,3],[-2,-7],[-1,-5],[1,-17],[-3,-4],[2,-14],[2,-5],[2,-4],[-2,-4],[-4,1],[-3,0],[-1,-4],[0,-3],[-2,-4],[1,-5],[1,-8],[1,-4],[3,-3],[3,-3],[1,-3],[1,-3],[3,0],[-1,-1],[-1,-1],[0,-2],[4,-7],[1,-8],[7,-12],[2,-6],[1,-7],[0,-3],[1,-2],[1,1],[2,-10],[-3,-9],[-2,-4],[-2,-4],[-1,-5],[1,-3],[1,-6],[10,-9],[2,-6],[6,-12],[3,0],[0,-6],[2,-3],[2,-8],[-1,-7],[-3,1],[-7,5],[-3,4],[0,3],[-1,11],[-3,8],[-4,7],[-3,4],[-3,0],[-4,13],[-4,2],[-2,4],[3,4],[0,6],[2,0],[3,-1],[2,1],[2,5],[1,10],[-1,9],[-2,9],[-3,7],[-4,6],[-3,5],[-4,5],[-5,5],[-3,1],[-3,2],[-4,1],[-3,0],[-1,-1],[-2,-2],[-1,-4],[0,-4],[1,-10],[-1,-1],[-3,5],[-1,8],[-10,10],[1,6],[0,3],[0,1],[3,2],[5,14],[6,25],[16,74],[5,24],[8,52],[6,39],[1,15],[1,6],[4,0],[2,-25],[-2,-10],[-5,-22],[-4,-12],[-5,-37],[-3,-15],[3,-9],[1,-6],[-1,-7],[2,-5],[1,-5]],[[2417,5899],[-2,-2],[-3,0],[0,3],[-1,7],[0,5],[6,10],[3,0],[2,1],[2,3],[1,-2],[-2,-3],[-3,-8],[-1,-10],[-2,-4]],[[1974,5910],[-2,-1],[-2,4],[-3,4],[2,9],[2,8],[3,18],[1,24],[3,22],[0,10],[-1,12],[1,3],[2,-2],[0,-7],[0,-10],[-1,-13],[0,-10],[-2,-12],[-1,-15],[2,-12],[-1,-9],[-2,-6],[-2,-7],[1,-10]],[[2405,6083],[-4,-2],[-7,5],[-6,22],[1,17],[3,12],[3,8],[3,1],[1,-9],[3,-1],[-2,-10],[3,-16],[2,-27]],[[2315,6147],[2,-6],[2,-3],[2,-2],[2,-9],[-1,-5],[-2,-5],[-2,-4],[-2,0],[-3,7],[-1,3],[0,5],[-2,8],[-2,4],[0,4],[5,-1],[0,3],[2,1]],[[2250,6176],[-1,-1],[-2,5],[-2,4],[0,5],[1,6],[-2,4],[1,2],[1,-1],[1,-5],[1,-1],[0,-3],[1,-3],[0,-1],[-1,-2],[1,-4],[1,-2],[0,-3]],[[2309,6344],[-5,-10],[-3,-14],[0,-17],[4,0],[-1,-6],[2,-2],[0,-6],[-1,-4],[-1,3],[-2,1],[-3,5],[-2,2],[-2,6],[-4,0],[-2,-2],[0,-3],[0,-6],[-4,-8],[-3,-5],[-4,-11],[-6,-10],[-2,-6],[0,-3],[-1,-9],[0,-8],[-2,-6],[-3,0],[-2,-6],[1,-11],[0,-8],[-1,-4],[-3,7],[-2,1],[-3,3],[0,4],[-1,7],[0,5],[5,11],[-1,6],[3,19],[0,6],[3,7],[2,7],[2,9],[4,4],[2,5],[-1,9],[2,11],[-3,7],[0,4],[5,1],[8,4],[0,6],[2,3],[3,-4],[5,-4],[8,3],[1,5],[6,2]],[[2238,6362],[-2,-1],[1,2],[1,2],[0,2],[-2,3],[0,3],[4,6],[2,0],[1,0],[1,-6],[-1,-4],[-1,-1],[2,-3],[-1,-3],[-3,0],[-2,0]],[[2192,6648],[-1,0],[0,4],[-2,2],[0,4],[2,-3],[1,-3],[0,-4]],[[1631,6699],[3,-2],[1,2],[1,2],[2,1],[2,-1],[4,-9],[5,-11],[2,-7],[1,-4],[-3,0],[-3,3],[-3,4],[-8,6],[-10,4],[-8,3],[-3,2],[-2,2],[2,5],[4,4],[5,5],[3,-1],[3,-2],[2,-3],[0,-3]],[[1994,6961],[-4,-8],[-7,2],[-1,12],[-2,11],[-3,7],[5,13],[9,-10],[6,-14],[-3,-13]],[[2055,7091],[-6,-1],[-4,1],[-4,4],[1,7],[7,2],[5,-4],[2,-4],[-1,-5]],[[1012,7323],[-3,-1],[-2,1],[-1,10],[-4,7],[-4,1],[-4,3],[1,4],[4,-2],[3,-1],[3,-5],[5,-5],[2,-2],[1,-5],[-1,-5]],[[1333,7405],[3,-6],[2,-9],[0,-6],[8,-19],[4,17],[0,10],[-1,11],[-1,2]],[[1357,7405],[1,-2],[2,2]],[[1770,7405],[1,-1],[0,-8],[1,-8],[0,-3],[-3,-14],[1,-10],[0,-7],[0,-3],[0,-4],[-1,-2],[-1,-6],[-1,-9],[4,-10],[5,-4],[2,-5],[4,-4],[0,3],[2,-1],[0,-3],[2,-8],[-1,-3],[0,-9],[3,-3],[-1,-6],[2,-7],[3,-7],[5,-7],[2,-6],[3,-2],[1,-3],[3,1],[2,0],[2,-4],[1,-5],[3,-4],[1,-5],[7,-6],[0,-7],[10,-7],[7,-1],[5,-2],[4,-4],[6,-3],[4,-2],[2,-3],[4,-5],[3,-4],[12,-5],[5,-5],[9,-9],[6,-9],[0,-7],[7,-10],[3,-12],[1,-20],[0,-8],[3,-12],[3,-9],[0,-7],[1,-7],[3,-8],[5,-5],[2,-8],[2,-6],[6,-3],[1,-6],[2,-13],[4,-4],[4,-13],[3,-6],[-2,-10],[-2,-3],[-1,-4],[0,-5],[6,-6],[4,-6],[3,-7],[2,-5],[3,-2],[7,-1],[6,-10],[8,-6],[6,1],[2,-3],[3,-2],[13,-4],[6,-11],[11,-1],[3,-1],[-1,-4],[2,-4],[1,-5],[-5,-3],[-4,2],[-5,-7],[-5,-11],[-3,-11],[-1,-9],[-1,-11],[5,-15],[6,-6],[3,-2],[1,-5],[4,-9],[2,-11],[3,-3],[9,-4],[1,-11],[13,-17],[2,-13],[1,-8],[0,-3],[-4,-4],[-1,-6],[0,-6],[-4,4],[-5,-16],[1,-10],[5,-2],[7,-10],[3,-9],[2,-7],[0,-5],[1,-6],[6,-3],[4,-6],[5,-9],[4,-22],[7,-10],[8,-8],[7,7],[12,16],[-1,7],[-4,5],[-7,15],[-9,12],[-4,4],[-3,9],[-9,8],[-4,14],[-3,0],[0,4],[1,5],[-1,4],[0,15],[-2,7],[0,7],[-2,9],[2,7],[-3,4],[-2,4],[0,4],[-1,4],[-1,4],[0,6],[-2,3],[0,4],[5,1],[3,4],[2,4],[8,-7],[0,-5],[8,-7],[7,-10],[5,-12],[3,-9],[13,-15],[4,1],[1,-7],[2,-5],[3,-3],[0,-4],[7,-4],[1,-3],[5,-4],[0,-3],[7,-5],[4,-2],[1,-4],[3,-3],[-2,-13],[0,-12],[1,-13],[-2,-28],[1,-10],[5,-5],[8,-4],[7,-4],[6,-3],[3,1],[0,3],[4,1],[0,-4],[2,-3],[4,-4],[-2,-2],[-2,-5],[0,-10],[-4,-11],[0,-15],[0,-11],[2,-11],[7,-7],[3,-2],[2,-3],[0,-3],[-3,-2],[0,-4],[3,-6],[5,-3],[4,-8],[2,-9],[1,-8],[1,-12],[-4,0],[-1,-14],[3,-5],[0,-5],[4,-12],[-1,-7],[1,-9],[4,-4],[1,-7],[0,-11],[3,-9],[3,-9],[6,-7],[0,-6],[1,-7],[0,-6],[-2,-2],[-1,-6],[-4,-5],[-1,-6],[2,-9],[0,-14],[-3,-7],[-4,-6],[2,-10],[1,-10],[4,-10],[1,-5],[1,-8],[-2,-7],[1,-4],[1,-15],[3,-3],[1,1],[1,1],[2,-3],[3,-5],[1,-3],[1,-2],[-1,-3],[-1,0],[-2,3],[0,3],[-3,1],[0,-3],[2,-7],[0,-7],[1,-5],[1,-5],[4,-4],[4,-7],[5,-3],[2,-2],[3,-6],[1,-4],[2,-2],[1,2],[3,0],[4,-12],[-1,-4],[1,-6],[1,-8],[2,-8],[1,-8],[1,-5],[1,-9],[3,-7],[3,-4],[3,-12],[4,-1],[2,-3],[0,-4],[2,-8],[3,-2],[2,-5],[3,-3],[3,0],[1,2],[1,-2],[6,0],[3,4],[0,-2],[-2,-4],[1,-2],[3,-2],[1,3],[2,1],[1,-3],[2,0],[1,2],[1,0],[2,-1],[4,-2],[1,-5],[-2,-4],[2,-8],[0,-3],[-2,-3],[1,-6],[-3,-2],[1,-6],[1,-4],[2,-9],[3,-4],[1,-13],[2,-6],[4,-12],[1,-10],[2,-4],[6,-3],[-1,-4],[3,-4],[1,-4],[-1,-1],[0,-4],[2,-2],[2,-2],[0,-1],[-1,-3],[1,-3],[-1,-3],[-1,0],[-2,-6],[1,-4],[2,-5],[0,-6],[2,-11],[3,-2],[2,-11],[3,-2],[0,-3],[-2,-2],[1,-10],[2,-9],[3,-7],[5,-3],[-1,-1],[2,-3],[0,-2],[1,-2],[1,-3],[0,-4],[2,-3],[0,-8],[5,-3],[0,-2],[5,-3],[2,-3],[-1,-6],[2,-4],[2,-4],[4,-1],[3,0],[0,2],[1,1],[2,-2],[1,-4],[7,-7],[0,-4],[0,-1],[0,-4],[2,-2],[1,-3],[0,-8],[0,-5],[4,-6],[3,-7],[3,-6],[-1,-3],[3,-2],[2,0],[1,-2],[1,-1],[-1,-1],[-1,-1],[-1,-1],[1,-1],[0,-3],[4,-6],[0,-2],[2,-3],[-1,-1],[0,-3],[1,-4],[1,-1],[-1,-5],[2,-4],[1,-4],[1,-3],[0,-4],[2,-4],[0,-3],[1,-3],[1,-1],[1,-1],[-1,-4],[-1,-4],[1,-2],[-1,-8],[0,-6],[-5,-9],[-3,-9],[-1,-7],[1,-5],[-2,-5],[-5,-2],[-4,-9],[-2,-10],[-1,-13],[-2,-10],[0,-11],[0,-7],[1,-10],[1,-5],[-2,-3],[1,-6],[2,-12],[0,-4],[3,-6],[10,-21],[1,-7],[0,-5],[-2,-5],[0,-6],[1,-5],[-2,-4],[3,-5],[1,-5],[0,-4],[1,-5],[-1,-7],[9,-18],[0,-3],[5,-4],[-1,-3],[4,-14],[4,-8],[2,-9],[4,-4],[5,-3],[1,-8],[4,-4],[1,-4],[7,-4],[9,-5],[8,-3],[10,-4],[16,-4],[17,1],[6,0],[2,-1],[-1,-3],[-3,-5],[-5,-3],[-5,-3],[-3,3],[-8,7],[-9,3],[-1,-3],[3,-4],[-1,-9],[2,-4],[2,-5],[-2,-4],[2,-7],[7,-1],[7,4],[3,-1],[4,1],[0,5],[0,5],[1,4],[1,2],[6,8],[6,11],[1,22],[-3,1],[0,5],[1,5],[-3,2],[-2,2],[1,2],[0,5],[0,5],[-2,1],[-1,-6],[-2,-1],[-1,11],[2,3],[-2,3],[2,5],[-1,3],[0,5],[-1,3],[5,0],[1,3],[-3,1],[-1,3],[3,4],[5,1],[2,4],[2,4],[6,-1],[9,-2],[1,2],[4,-4],[1,-4],[-2,-2],[0,-6],[2,-4],[3,-2],[3,-5],[3,-2],[3,-4],[2,-6],[0,-5],[3,-5],[1,-4],[8,-4],[3,-5],[4,-5],[2,-1],[6,-5],[4,-1],[1,-2],[2,-2],[1,-4],[4,-2],[1,-4],[4,-2],[4,-5],[5,-4],[3,-6],[2,-12],[1,-5],[0,-7],[1,-3],[2,-24],[0,-11],[5,-4],[6,-1],[7,-4],[13,4],[12,7],[5,5],[3,2],[0,-3],[1,-6],[1,-5],[3,-3],[2,-5],[0,-5],[-2,-2],[0,-5],[-4,-7],[-2,1],[-1,-2],[0,-5],[-1,-9],[-1,-5],[1,-8],[2,-10],[2,-5],[3,-2],[2,-2],[1,-3],[2,-3],[2,-2],[2,-3],[4,-3],[10,-19],[6,-9],[3,-10],[5,-6],[-4,-12],[0,-15],[2,-13],[3,-20],[-1,-13],[5,-9],[7,-5],[5,-3],[2,-4],[5,-3],[4,-1],[7,-6],[3,-4],[3,-2],[8,-4],[6,-1],[2,-3],[1,-7],[5,-3],[7,-3],[2,-2],[0,-4],[-2,-5],[-1,-8],[3,-12],[8,-16],[6,-9],[0,-10],[-1,-9],[0,-7],[4,-3],[1,-7],[-1,-6],[-4,-4],[0,-6],[0,-10],[1,-6],[0,-12],[0,-8],[-3,-7],[-1,-2],[0,-6],[0,-11],[0,-6],[-2,-5],[-2,-10],[-1,-6],[-3,-4],[-4,-9],[-6,-14],[-3,-4],[-4,-11],[-3,-2],[-2,-7],[-11,-8],[-3,-7],[-10,0],[-6,-6],[-14,-8],[-7,-9],[-6,-5],[-1,-8],[1,-5],[-6,-11],[-8,-2],[-15,-15],[0,-11],[-6,-9],[-4,-6],[-5,-5],[-2,-1],[-8,-1],[-6,-4],[0,-4],[2,-4],[-12,-1],[-6,0],[-4,3],[-4,2],[-7,7],[-8,12],[-5,8],[-6,11],[-5,16],[-1,6],[-3,11],[-3,4],[-2,17],[-1,15],[-13,83],[-3,36],[-2,16],[-4,5],[-2,5],[-8,21],[-2,9],[-4,7],[-2,11],[-10,28],[-3,6],[-10,29],[-14,22],[-16,15],[-38,27],[-17,13],[-22,29],[-33,58],[-20,38],[-12,18],[-5,6],[-4,1],[-1,7],[-3,5],[-12,22],[-7,8],[-10,15],[-8,8],[-2,7],[-7,11],[-13,14],[-8,10],[-10,8],[-11,10],[-17,20],[-17,14],[-52,45],[-1,3],[4,-1],[24,-21],[-5,9],[-12,10],[-10,8],[-5,2],[-5,7],[-3,10],[-11,17],[-6,6],[-8,2],[-9,13],[-8,17],[-3,19],[-6,19],[-2,5],[3,-2],[3,0],[-4,8],[-6,8],[-4,5],[-5,1],[0,-9],[3,-8],[-4,-12],[-9,2],[-3,4],[-4,-2],[-5,-2],[-7,2],[-5,2],[7,-10],[6,-7],[-6,-2],[-3,3],[-3,-2],[-4,-4],[-2,6],[-1,9],[1,6],[1,14],[-6,28],[-4,18],[-6,9],[-6,11],[-7,13],[-7,9],[-4,8],[1,2],[7,-8],[2,2],[-1,4],[-6,7],[-6,10],[-5,11],[-2,8],[-1,9],[-2,12],[-4,10],[-4,5],[3,-16],[1,-15],[3,-12],[6,-10],[-1,-2],[-5,-6],[1,-2],[4,-6],[1,-3],[-2,-2],[-3,1],[-2,3],[-1,6],[-6,-11],[-4,9],[-6,28],[3,3],[2,5],[-1,5],[-1,6],[-5,-6],[-1,-7],[1,-17],[1,-11],[1,-7],[-6,-1],[-5,6],[-3,6],[-2,8],[-1,10],[1,17],[-1,5],[-2,4],[-2,1],[-2,1],[-2,9],[3,3],[6,8],[1,4],[-2,13],[-1,2],[-1,2],[0,5],[1,2],[5,5],[1,4],[-1,4],[-3,7],[0,6],[-1,5],[-2,4],[-2,-3],[-3,-8],[0,-9],[-3,-7],[-2,-7],[1,-10],[3,-10],[-3,-11],[-4,-8],[-3,0],[-2,10],[1,8],[1,13],[-2,4],[-1,2],[0,6],[1,4],[4,0],[2,5],[-2,6],[2,6],[4,10],[2,16],[-2,4],[3,9],[-1,6],[-3,0],[0,4],[-3,3],[1,8],[1,6],[-1,8],[0,10],[3,15],[4,16],[5,13],[5,11],[2,8],[1,18],[0,29],[0,16],[-3,3],[-1,7],[2,9],[3,5],[1,10],[0,4],[-4,1],[2,7],[9,6],[5,3],[-4,3],[-7,-1],[-4,-3],[-2,6],[3,3],[4,4],[0,10],[-1,21],[-2,11],[2,11],[1,19],[-3,32],[-1,16],[-2,4],[-2,-2],[0,-9],[0,-59],[-1,-24],[-2,-21],[-2,-4],[0,7],[0,12],[1,31],[0,74],[-2,30],[-7,18],[-3,23],[-7,18],[-6,36],[-6,22],[-7,11],[-5,14],[-8,7],[-10,-2],[-5,11],[-1,17],[-2,16],[-8,26],[-11,23],[-7,11],[-13,12],[-3,1],[-4,-3],[-2,-5],[-3,-6],[-5,-1],[-19,20],[0,2],[1,8],[-2,6],[-4,-4],[-5,-3],[-5,5],[-3,10],[-1,2],[-5,1],[-14,-1],[-4,2],[-12,26],[-9,9],[-9,10],[-6,7],[-8,10],[-11,15],[-12,17],[-16,14],[-1,5],[0,2],[0,2],[-1,3],[-1,1],[-2,1],[-6,-1],[-5,4],[-5,8],[-8,11],[-5,8],[1,7],[-1,9],[1,6],[0,6],[-2,4],[-4,10],[-4,8],[-4,10],[-4,5],[-4,7],[-3,9],[-2,6],[0,7],[1,6],[4,5],[3,2],[-3,3],[-3,0],[-4,-2],[-5,-3],[-1,-7],[-1,-7],[-4,-1],[-4,-1],[2,-5],[-1,-4],[-4,-3],[-3,3],[-3,6],[-1,6],[-1,8],[-2,3],[2,3],[6,0],[3,4],[4,5],[3,4],[4,6],[3,7],[4,4],[3,6],[2,10],[2,6],[-1,28],[-1,10],[-5,8],[-6,3],[-4,-5],[-5,-12],[-1,-34],[-2,-16],[-9,-13],[-4,4],[-4,-7],[-2,-7],[0,-5],[0,-5],[0,-4],[0,-7],[-1,-7],[-1,-5],[-5,-1],[-13,15],[-12,10],[-11,4],[-6,2],[-9,-1],[-8,0],[-10,-6],[-4,-13],[-3,-9],[-5,-6],[0,-13],[-4,0],[-6,-8],[-8,3],[-12,9],[-9,24],[-19,17],[-3,7],[-1,8],[-5,18],[-12,33],[-8,16],[-11,10],[-8,9],[-10,4],[-16,4],[-5,-3],[1,-7],[-4,-2],[-3,-3],[-3,3],[-14,23],[-5,18],[-6,13],[-10,17],[-10,10],[-11,8],[-9,2],[-8,6],[-12,-2],[-5,-2],[-1,-11],[-9,11],[-9,11],[-14,9],[-9,-9],[-4,6],[2,6],[-1,6],[1,6],[-5,3],[-6,4],[-4,-3],[-4,12],[1,24],[0,23],[-2,21],[-4,24],[-8,12],[-2,3],[-8,9],[-6,1],[-5,14],[-11,7],[-16,10],[-11,8],[-5,0],[-5,14],[-1,3],[-4,9],[-2,3],[-3,15],[-8,10],[-8,6],[-2,-2],[-2,-6],[-4,3],[-2,5],[-4,7],[1,3],[4,-6],[3,1],[2,11],[-1,6],[-2,6],[-3,4],[-3,3],[-5,0],[-1,-4],[-2,-5],[-1,-8],[-4,3],[-6,4],[-2,13],[-4,9],[-7,4],[-5,2],[-4,-6],[-3,6],[-3,7],[-4,11],[0,10],[-4,9],[-1,8],[-1,7],[-1,2],[-9,14],[9,5],[5,-2],[5,-6],[3,-8],[15,-2],[14,5],[12,-3],[5,0],[7,-3],[2,-7],[7,-2],[10,3],[7,-2],[8,-2],[5,0],[1,-6],[4,-3],[5,-2],[7,0],[10,-4],[11,-3],[10,4],[13,3],[10,-7],[11,8],[10,6],[9,10],[3,6],[4,4],[5,8],[6,7],[4,3],[3,3],[3,0],[3,-1],[2,-3],[1,-4],[0,-4],[2,-11],[-2,-8],[-2,-9],[-2,-7],[-1,-5],[2,-8],[7,-16],[7,-5],[7,-12],[5,-5],[9,-2],[6,-7],[8,-6],[4,-7],[4,-7],[2,-4],[-1,-6],[3,-3],[3,0],[-1,-6],[1,-4],[3,3],[3,4],[3,4],[0,4],[6,7],[2,6],[2,8],[-2,3],[-3,-2],[-1,4],[-1,2],[0,2],[-2,-2],[-2,0],[-1,3],[2,3],[2,1],[4,1],[2,-2],[1,-4],[1,-2],[4,2],[3,-2],[0,-5],[3,-3],[5,-4],[8,-2],[5,1],[1,2],[3,5],[2,5],[1,5],[4,5],[1,8],[-1,5],[-3,4],[-4,1],[-1,3],[-5,3],[-3,1],[-1,2],[-1,4],[-2,2],[-2,0],[-2,-4],[-2,1],[-4,-1],[-2,-1],[-2,1],[-3,10],[-3,9],[-1,5],[-3,5],[-3,1],[0,-2],[1,-5],[3,-9],[-1,-5],[3,-3],[2,-5],[1,-7],[-1,-3],[-2,0],[-1,-3],[0,-4],[-1,0],[-2,3],[-3,0],[-3,-3],[-3,-5],[-5,-2],[-4,1],[-2,3],[-2,5],[-3,4],[-1,6],[-1,8],[-2,5],[-3,5],[-3,8],[0,8],[-1,7],[1,6],[2,4],[1,6],[5,10],[4,7],[1,7],[-1,2],[-3,1],[-2,0],[0,2],[2,3],[2,1],[1,4],[-2,1],[-2,2],[-2,3],[-2,4],[2,3],[0,5],[-3,2],[-2,1],[-3,-3],[0,-4],[-1,-4],[-3,-1],[-2,-4],[-4,-2],[-3,1],[-6,-4],[-3,-6],[-3,-5],[-3,-3],[-3,8],[1,8],[1,7],[3,8],[2,5],[7,9],[2,6],[5,9],[1,2]],[[5861,7279],[-9,-11],[-8,-11],[-8,-13],[-8,-11],[-4,-7],[-5,-6],[-4,-7],[-5,-6],[-3,-1],[-2,2],[-3,4],[-2,4],[-10,13],[-11,14],[-10,13],[-10,14],[-4,5],[-4,5],[-4,6],[-5,5],[-2,-1],[-4,-5],[-4,-5],[-2,-3],[-11,-11],[-12,-12],[-12,-14],[-8,-14],[-5,-18],[-4,-22],[-2,-22],[-3,-20],[-3,-23],[-3,-30],[-5,-27],[-6,-15],[-3,-1],[-3,-2],[-4,-2],[-2,0],[-2,3],[-1,5],[-1,3],[-2,1],[-9,-5],[-9,-5],[-9,-6],[-9,-5],[-5,-5],[-4,-7],[-3,-7],[-4,-6],[-7,-7],[-7,-7],[-7,-7],[-7,-7],[-6,-5],[-5,-6],[-4,-7],[-1,-10],[2,-17],[1,-16],[1,-17],[1,-17],[5,-3],[6,-2],[5,-6],[-1,-14],[7,2],[5,1],[3,5],[2,8],[-1,3],[-2,2],[-1,3],[0,4],[2,3],[3,0],[2,0],[2,2],[2,7],[2,7],[2,0],[4,-9],[6,-6],[8,-3],[9,-2],[6,-5],[2,-11],[0,-17],[0,-18],[0,-12],[0,-11],[1,-11],[0,-12],[-2,-10],[-4,-28],[-6,-29],[-7,-27],[-10,-22],[-5,-9],[-6,-8],[-5,-7],[-6,-8],[-3,16],[-3,16],[-4,15],[-3,16],[-3,-4],[-3,-4],[-3,-4],[-3,-4],[-21,-29],[-22,-29],[-22,-29],[-21,-30],[-12,-16],[-12,-16],[-12,-16],[-12,-17],[11,-14],[12,-17],[11,-18],[7,-19],[1,-10],[1,-9],[2,-9],[3,-8],[5,-10],[3,-4],[4,-2],[6,0],[5,-2],[5,-7],[5,-9],[4,-7],[4,-15],[0,-15],[1,-15],[2,-15],[7,-9],[9,-6],[8,-9],[2,-14],[-2,-19],[-1,-21],[-1,-21],[3,-19],[5,-20],[7,-20],[8,-19],[8,-18],[6,-10],[5,-5],[6,-2],[8,0],[4,-1],[3,-2],[2,-2],[3,-4],[1,-6],[0,-6],[-1,-6],[1,-5],[3,-3],[5,0],[5,0],[4,-3],[2,-5],[1,-7],[0,-7],[1,-7],[-9,4],[-11,8],[-10,5],[-8,-2],[-2,-11],[9,-8],[13,-8],[7,-10],[0,-3],[1,-2],[0,-3],[1,-3],[8,-13],[12,-5],[11,-4],[8,-12],[1,-5],[-2,-4],[0,-5],[3,-4],[5,-1],[6,2],[7,4],[5,0],[6,-1],[6,-1],[6,-1],[5,0],[6,-1],[3,-2],[3,-4],[5,-6],[8,-8],[10,-10],[4,-8],[-10,-4],[-3,-1],[-3,-2],[-3,-4],[-1,-4],[0,-5],[0,-7],[1,-6],[0,-4],[-5,-3],[-6,0],[-7,2],[-6,-1],[-7,-4],[-7,-3],[-7,0],[-8,3],[-8,5],[-8,5],[-8,4],[-8,3],[-21,0],[-20,-10],[-18,-16],[-17,-19],[-8,-14],[-9,-23],[-4,-21],[7,-8],[6,-2],[6,-7],[5,-9],[4,-8],[5,-10],[-1,-8],[-5,-6],[-7,-7],[-6,-9],[-2,-8],[2,-10],[3,-15],[3,-15],[1,-12],[1,-13],[-2,-14],[-5,-25],[-4,-26],[-5,-25],[-4,-26]],[[5538,5514],[-6,6],[-6,6],[-6,5],[-6,6],[-6,3],[-6,-1],[-5,-3],[-7,-2],[-11,1],[-14,8],[-11,13],[-8,15],[-3,9],[-1,10],[-2,9],[-2,9],[-4,9],[-3,9],[-4,8],[-5,8],[-11,11],[-10,3],[-12,-2],[-13,-4],[0,4],[0,3],[-1,4],[0,4],[-6,-10],[-6,-11],[-7,-10],[-6,-11],[-5,-6],[-7,-1],[-7,0],[-6,1],[-9,1],[-9,1],[-9,0],[-9,1],[-4,5],[-3,11],[-3,12],[-2,10],[7,-3],[6,-3],[6,-3],[7,-1],[-1,10],[0,12],[-2,11],[-2,8],[-5,5],[-5,6],[-5,4],[-5,1],[-12,-1],[-13,5],[-11,11],[-9,15],[-4,14],[-5,19],[-6,18],[-6,9],[-11,6],[-12,6],[-11,5],[-12,6],[-13,6],[-13,7],[-13,6],[-13,6],[-9,2],[-9,-2],[-10,-3],[-8,-2],[-24,-4],[-23,-4],[-23,-4],[-24,-3],[-9,-2],[-7,-3],[-5,-7],[-6,-14]],[[4957,5797],[-7,-14],[-7,-15],[-7,-14],[-7,-14],[-5,-12],[-6,-15],[-7,-12],[-7,-3],[-1,-23],[0,-24],[-1,-23],[0,-24],[-7,9],[-7,9],[-7,8],[-7,7],[-13,10],[-13,7],[-13,6],[-13,5],[-13,5],[-15,9],[-13,13],[-8,19],[-2,22],[1,22],[-1,21],[-5,18],[-11,13],[-13,11],[-12,13],[-7,18],[-4,13],[-4,11],[-5,9],[-6,9],[-5,5],[-4,5],[-2,7],[-1,10],[1,15],[3,15],[5,13],[6,13],[3,3],[3,2],[3,1],[3,4],[-1,5],[-2,6],[-4,6],[-3,4],[-5,8],[-4,8],[-3,9],[0,13],[2,9],[3,6],[4,4],[5,6],[3,5],[3,2],[4,2],[2,4],[3,6],[2,5],[3,5],[3,5],[3,9],[2,8],[3,6],[6,5],[3,8],[1,16],[0,17],[-1,14],[0,2],[0,3],[0,3],[0,3],[-1,16],[-1,16],[-1,16],[-1,16],[-2,27],[-2,29],[-1,29],[2,27],[5,27],[7,25],[8,25],[3,27],[-4,28],[-13,25],[-16,22],[-14,17],[-12,18],[-13,17],[-12,17],[-13,17],[-4,6],[-4,5],[-4,5],[-3,6]],[[4655,6659],[-5,31],[-5,31],[-4,31],[-5,31],[-16,106],[-16,106],[-17,106],[-16,106],[-4,25],[-3,25],[-4,25],[-4,25],[-1,12],[-2,12],[-2,12],[-3,17],[11,28],[13,39],[14,39],[13,39],[13,40],[10,29],[9,29],[10,29],[10,29],[25,77],[27,77],[26,76],[25,78],[0,1]],[[4754,7970],[-1,-9],[4,-4],[19,0],[18,-7],[12,-3],[8,6],[4,15],[2,19],[2,2],[2,-2],[2,10],[1,5],[3,4],[12,10],[3,3],[3,6],[8,28],[6,9],[7,-6],[2,4],[14,17],[9,2],[3,3],[-3,6],[-7,7],[-3,6],[0,6],[5,22],[0,10],[1,6],[1,4],[4,4],[2,1],[2,0],[2,1],[3,2],[0,2],[-3,8],[1,3],[3,8],[0,6],[-1,6],[-1,7],[0,7],[2,5],[2,5],[10,41],[3,3],[2,5],[-2,7],[3,2],[1,2],[-2,7],[4,3],[2,4],[3,9],[0,1],[5,15],[1,1],[2,7],[9,25],[1,6],[0,5],[1,4],[3,4],[2,0],[12,0],[5,2],[12,9],[5,4],[2,-1],[1,-6],[2,-1],[2,1],[1,1],[0,1],[4,4],[2,7],[3,1],[34,-4],[1,2],[7,17],[1,6],[1,14],[1,6],[3,3],[3,1],[4,3],[3,10],[3,2],[6,-2],[4,-6],[4,-5],[6,2],[1,-10],[5,-3],[11,-2],[15,-12],[3,-5],[12,-7],[30,5],[8,-3],[5,7],[5,-3],[4,-5],[5,-3],[3,0],[2,1],[3,2],[2,3],[3,2],[3,-1],[6,-3],[11,0],[3,3],[3,0],[1,-5],[2,-4],[51,-11],[17,4],[5,2],[3,6],[1,10],[2,3],[2,-1],[2,-4],[1,-5],[0,-3],[-3,-10],[-1,-4],[6,-3],[5,4],[5,7],[6,3],[3,-1],[2,-8],[3,-2],[4,-1],[3,1],[3,2],[3,2],[-1,-7],[1,-7],[2,-7],[5,-12],[2,-10],[4,-13],[2,-5],[3,-4],[4,-3],[8,0],[3,-3],[-1,-9],[-2,-11],[0,-9],[3,-2],[6,8],[7,7],[8,1],[5,-7],[0,-14],[-2,-16],[1,-8],[3,-5],[3,0],[4,-2],[2,-3],[6,-12],[10,-7],[21,-10],[9,-5],[3,-10],[1,-16],[1,-7],[2,-6],[3,-5],[3,-5],[3,-3],[23,-16],[7,-10],[7,-12],[2,-4],[15,-11],[6,-7],[5,-8],[6,-19],[-2,-11],[2,-8],[17,-21],[1,-3],[1,-4],[4,-1],[4,-1],[3,-2],[2,-7],[3,-32],[6,-22],[1,-11],[-3,-12],[3,-3],[1,-5],[1,-6],[0,-7],[1,-4],[4,-4],[4,-6],[2,-9],[1,-2],[4,-3],[2,-2],[1,-4],[-2,-7],[1,-4],[2,-2],[5,0],[2,-2],[1,-3],[2,-6],[1,-2],[2,-6],[8,-53],[4,-12],[11,-24],[0,-9],[4,-4],[7,-6],[3,-3],[1,-6],[0,-13],[0,-6],[4,-11],[7,-7],[13,-8],[-9,-8],[-2,-4],[1,-6],[2,-4],[2,-3],[2,-4],[1,-20],[3,-19],[9,-18],[5,-13],[0,-9],[-2,-10],[3,-10],[5,-10],[6,-6],[9,-2],[2,-1],[1,-5],[0,-8],[1,-7],[3,-3],[5,-2],[31,-24],[6,-9],[2,-12],[1,-8],[1,-4],[4,-7],[4,-6],[3,-1],[-1,-3],[0,-4],[-1,-3],[2,-10],[3,-7],[3,-7],[4,-8],[5,-3],[7,-2],[3,-4],[-3,-8],[3,-9],[5,-9],[5,-9],[5,-3],[1,-3],[-1,-6],[-3,-8],[1,-6],[3,-3],[3,-3],[2,-5],[0,-5],[0,-12],[0,-5],[2,-1],[4,-6],[4,-6],[0,-3],[7,-2],[1,-1]],[[4655,6659],[-25,16],[-25,16],[-25,16],[-25,16],[-8,5],[-6,3],[-7,1],[-9,-1],[-12,0],[-13,-1],[-12,-3],[-12,-7],[-13,-18],[-12,-23],[-11,-25],[-10,-24],[-14,-30],[-15,-31],[-14,-30],[-14,-30],[-12,-17],[-13,5],[-12,17],[-11,17],[-17,18],[-16,14],[-18,9],[-19,5],[-8,2],[-7,2],[-8,2],[-7,-2],[-4,-6],[-4,-11],[-4,-7],[-6,5],[-4,10],[-7,16],[-8,15],[-4,5],[-9,-7],[-9,-7],[-8,-7],[-9,-7],[-7,-6],[-9,-8],[-9,-7],[-6,-2],[-9,8],[-9,8],[-10,8],[-9,8],[-9,7],[-9,8],[-8,8],[-9,7],[-7,8],[-7,9],[-5,10],[-6,11],[-5,12],[-5,12],[-5,8],[-7,-1],[-8,-3],[-9,0],[-8,0],[-8,1],[-13,12],[-13,14],[-12,16],[-12,15],[-5,6],[-5,5],[-5,6],[-4,6],[-2,-4],[-2,-4],[-2,-4],[-2,-4],[-3,-11],[-3,-10],[-4,-10],[-3,-10],[-3,7],[-4,7],[-4,4],[-5,-3],[-4,-11],[-2,-16],[1,-16],[0,-14],[-1,-6],[0,-8],[-1,-7],[-1,-5],[-5,-5],[-7,-8],[-5,-8],[-1,-8],[3,-11],[2,-11],[3,-11],[2,-11],[1,-12],[-1,-7],[-4,-4],[-6,-5],[-14,-6],[-14,-7],[-14,-6],[-13,-7],[-10,-11],[-2,-15],[3,-18],[5,-17],[5,-18],[5,-19],[2,-20],[-1,-19],[-2,-12],[-2,-12],[-3,-11],[-3,-10],[-5,-6],[-6,-2],[-5,1],[-6,0],[-10,-9],[-4,-16],[-1,-20],[0,-21],[0,-15],[-1,-15],[0,-15],[-1,-15],[-1,-9],[-3,-7],[-3,-6],[-5,-6],[-2,-2],[-1,-2],[-2,-2],[-1,-2],[-6,-9],[-6,-8],[-6,-8],[-6,-8],[-5,-9],[-6,-10],[-6,-9],[-6,-6],[-6,-1],[-8,2],[-7,2],[-6,2],[-9,1],[-9,2],[-9,1],[-8,2]],[[3610,6107],[-9,12],[-10,9],[-9,10],[-10,9],[-6,8],[-6,12],[-5,12],[-5,11],[-8,11],[-8,10],[-8,8],[-9,6],[-5,3],[-3,1],[-1,3],[-1,9],[-1,7],[0,8],[-1,7],[-2,7],[-2,6],[-3,3],[-4,2],[-3,4],[-1,2],[0,4],[-1,5],[0,4],[-2,8],[-1,9],[-1,8],[-1,9],[-3,16],[-5,13],[-8,8],[-9,5],[-22,7],[-21,7],[-21,7],[-22,7],[-3,1],[-3,1],[-4,1],[-3,1],[-10,4],[-6,3],[-2,8],[-2,16],[-2,25],[-2,25],[-2,25],[-2,25],[-2,29],[-1,34],[-3,32],[-6,26],[-5,12],[-7,10],[-7,10],[-6,12],[-6,16],[-8,16],[-7,17],[-5,17],[0,14],[1,15],[-3,12],[-7,6],[-16,4],[-17,6],[-15,12],[-11,20],[-4,10],[-3,8],[-5,6],[-7,2],[-7,-2],[-8,0],[-7,3],[-4,11],[-7,-14],[-7,-14],[-7,-14],[-8,-11],[-3,5]],[[3124,6849],[-1,6],[-2,6],[-2,6],[-2,3],[-2,1],[-2,-1],[-3,-2],[-6,-1],[-4,1],[-3,4],[-4,6],[-8,16],[-7,16],[-7,17],[-6,17],[-5,12],[-3,11],[-1,12],[3,14],[5,13],[5,10],[4,11],[-2,17],[-2,8],[-3,10],[-2,9],[0,10],[1,10],[2,11],[1,12],[0,11],[-1,10],[-1,9],[-4,7],[-5,5],[-8,8],[-8,10],[-6,10],[-7,13],[-1,8],[1,8],[2,7],[3,6],[-8,11],[-9,12],[-9,11],[-8,11],[-4,10],[-2,13],[-2,12],[-3,9],[-6,4],[-5,5],[-5,5],[-6,5],[-4,4],[-4,4],[-4,5],[-2,7],[-10,37],[-10,37],[-10,38],[-10,37],[-2,12],[3,9],[6,9],[6,8],[6,10],[5,6],[6,4],[8,2],[16,2],[15,1],[15,-2],[16,-5],[11,-4],[11,-4],[11,-4],[11,-5],[5,-2],[5,-3],[6,-1],[4,4],[7,10],[7,11],[7,10],[6,10],[0,8],[-2,14],[-4,15],[-2,10],[-3,12],[-3,11],[-3,12],[-2,11],[-4,16],[-3,17],[-4,16],[-3,16],[0,15],[3,19],[5,19],[3,15],[0,7],[-1,5],[-2,5],[-1,5],[-1,6],[0,7],[-1,6],[0,6],[-2,23],[-2,23],[-1,22],[-2,23],[-2,30],[-3,31],[-2,31],[-2,30],[-2,27],[-3,28],[-2,27],[-2,27],[6,0],[5,0],[6,0],[5,0],[6,1],[2,3],[1,6],[0,11],[1,13],[1,13],[0,12],[1,13],[2,45],[3,44],[2,45],[3,44],[0,11],[1,12],[1,11],[0,12],[0,1],[0,1],[0,1],[0,1],[1,10],[0,10],[1,9],[3,9],[3,6],[0,7],[0,7],[-1,8],[-1,35],[-2,35],[-2,35],[-2,35],[-1,5],[0,6],[0,5],[0,5],[-1,17],[-1,17],[-1,17],[-1,17],[-1,14],[-2,9],[-3,7],[-7,9],[-8,11],[-7,9],[-8,6],[-10,5],[-6,2],[-6,3],[-6,5],[-6,5],[-18,23],[-18,22],[-18,23],[-18,22],[-4,8],[-1,8],[1,9],[2,12],[1,17],[2,17],[1,17],[2,18],[4,47],[4,47],[4,46],[3,44]],[[2968,9236],[9,0],[13,0],[14,0],[13,0],[14,0],[13,0],[14,0],[13,0],[14,0],[13,0],[14,0],[13,0],[14,0],[13,0],[14,0],[13,0],[14,0],[13,0],[0,4],[0,4],[0,4],[0,4],[0,4],[0,4],[0,4],[0,3],[0,4],[0,4],[0,4],[0,4],[0,4],[0,4],[0,4],[0,3],[0,4],[0,4],[0,4],[0,4],[0,4],[0,4],[0,4],[0,3],[0,4],[0,4],[0,4],[0,4],[0,4],[0,4],[0,4],[0,3],[0,4],[0,4],[0,4],[0,4],[0,4],[0,4],[0,4],[0,3],[0,4],[0,4],[0,4],[0,4],[0,4],[0,4],[0,4],[0,3],[0,4],[0,4],[0,4],[0,4],[0,4],[0,4],[0,3],[0,4],[0,4],[0,4],[0,4],[0,4],[0,4],[0,4],[0,3],[0,4],[8,0],[8,0],[8,0],[9,0],[8,0],[8,0],[8,0],[8,0],[8,0],[9,0],[8,0],[8,0],[8,0],[8,0],[9,0],[8,0],[8,0],[8,0],[8,0],[8,0],[9,0],[8,0],[8,0],[8,0],[8,0],[8,-1],[9,0],[8,0],[8,0],[8,0],[8,0],[8,0],[9,0],[8,0],[8,0],[8,0],[8,0],[8,0],[9,0],[8,0],[8,0],[8,0],[8,0],[8,0],[9,0],[8,0],[8,0],[8,0],[8,0],[8,0],[9,0],[8,0],[8,0],[8,0],[8,0],[9,-1],[8,0],[8,0],[8,0],[8,0],[8,0],[9,0],[8,0],[8,0],[13,0],[4,-2],[1,-2],[3,-4],[6,-2],[14,2],[12,-7],[10,-16],[9,-19],[6,-19],[8,-37],[4,-10],[13,-24],[3,-8],[1,-6],[1,-3],[0,-2],[2,-4],[11,-9],[3,-7],[8,-5],[13,-6],[11,-10],[6,-3],[8,-1],[5,-3],[14,-15],[4,-5],[2,-5],[2,-9],[2,-5],[6,-5],[4,-4],[0,-2],[5,-3],[6,-7],[24,-43],[3,-10],[3,-7],[24,-23],[5,-3],[2,-2],[8,-14],[6,-7],[6,-5],[5,-5],[3,-11],[4,-20],[4,-7],[8,-6],[10,-20],[26,-29],[12,-24],[4,-5],[10,-4],[18,-13],[2,-3],[1,-3],[2,-3],[3,-2],[2,0],[1,1],[3,4],[1,1],[3,-2],[2,-1],[2,-2],[3,-7],[4,-2],[3,-1],[2,-1],[2,-4],[0,-6],[1,1],[2,-1],[4,-7],[2,4],[15,-26],[6,-4],[5,-2],[7,-5],[6,-8],[4,-8],[1,-6],[1,-6],[1,-6],[2,-5],[3,-1],[10,-2],[2,-2],[2,-6],[9,-17],[4,-9],[1,-6],[0,-11],[1,-6],[5,-5],[2,-2],[-1,-4],[-1,-6],[-1,-4],[1,-6],[3,-7],[1,-6],[-1,-8],[0,-3],[0,-3],[3,-6],[2,-4],[5,-4],[1,-4],[1,-4],[1,-7],[0,-5],[2,-2],[6,-6],[4,-14],[4,-15],[4,-11],[3,-2],[5,-4],[3,-5],[6,-19],[5,-9],[1,-12],[-1,-20],[-1,-13],[-5,-20],[-1,-11],[1,-13],[6,-30],[0,-5],[-1,-9],[1,-5],[1,-3],[4,-7],[1,-3],[2,-6],[6,-11],[4,-25],[1,-5],[6,-10],[6,-7],[4,-8],[3,-23],[5,-16],[2,-8],[1,-8],[0,-5],[1,-6],[5,-7],[15,-16],[4,-7],[1,-3],[1,-6],[2,-4],[2,-2],[2,-2],[26,-25],[3,-7],[6,4],[8,1],[8,-4],[6,-10],[7,-8],[3,-2],[2,-3],[5,-19],[11,-18],[7,-9],[11,-8],[15,-26],[12,-10],[29,-15],[20,-7],[22,-2],[3,-1],[3,-4],[2,-6],[-3,-12],[2,-3],[4,-2],[3,-2],[15,-19],[9,-8],[28,-10],[8,0],[3,0],[3,-4],[1,-3],[0,-4],[2,-5],[16,-24],[14,-12],[4,-2],[3,-3],[9,-13],[4,-3],[4,4],[3,5],[2,1],[4,-10],[2,2],[5,3],[-1,-3]],[[4957,5797],[6,-17],[6,-16],[7,-15],[6,-16],[9,-16],[10,-19],[9,-20],[3,-21],[0,-35],[0,-36],[0,-35],[0,-35],[0,-9],[0,-10],[0,-9],[0,-9],[1,-15],[-1,-7],[-4,-3],[-8,-2],[-14,-2],[-15,-4],[-14,-7],[-14,-6],[-15,-4],[-14,0],[-13,3],[-15,4],[-28,10],[-28,9],[-28,9],[-28,10],[-11,-5],[-15,-8],[-13,-10],[-9,-13],[-2,-9],[0,-10],[0,-9],[-3,-8],[-5,-5],[-6,-1],[-7,0],[-5,1],[-5,-2],[-4,-4],[-2,-7],[0,-9],[-2,-8],[-5,-2],[-5,-1],[-6,-2],[-4,-5],[-2,-7],[-2,-7],[-2,-7],[-7,-17],[-6,-14],[-6,-13],[-10,-10],[-3,-2],[-2,-1],[-2,-2],[-2,-1],[-9,-6],[-13,-9],[-11,-11],[-4,-8],[3,-11],[-1,-12],[-1,-14],[2,-14],[0,-18],[-11,-6],[-10,-5],[3,-13],[5,-8],[5,-9],[4,-11],[0,-12],[-1,-8],[-3,-8],[-3,-7],[-2,-8],[3,-13],[8,-8],[8,-9],[4,-14],[-1,-12],[-3,-13],[-5,-9],[-6,3],[-6,12],[-8,4],[-6,-7],[-5,-15],[-1,-11],[0,-11],[-2,-10],[-3,-9],[-9,-11],[-9,-11],[-10,-10],[-10,-10],[-6,-7],[-4,-6],[-2,-8],[0,-15],[-2,-21],[-1,-21],[-1,-21],[-1,-21],[0,-11],[-1,-14],[-2,-13],[-2,-8],[-7,-5],[-4,-5],[-2,-7],[-2,-13],[-1,-60],[-2,-60],[-1,-59],[0,-60],[-2,-22],[-4,-23],[-4,-22],[-5,-21],[-5,-28],[-5,-29],[-5,-28],[-4,-28]],[[4439,4278],[-2,21],[-2,22],[-2,22],[-2,21],[-11,-8],[-11,-8],[-12,-8],[-11,-8],[-8,-1],[-10,7],[-9,9],[-8,9],[-8,12],[-5,16],[-3,18],[-2,19],[-1,7],[-2,7],[-1,7],[-3,5],[-7,7],[-10,11],[-10,9],[-7,1],[-9,-12],[-10,-11],[-9,-11],[-10,-11],[-6,-10],[-9,-11],[-9,-8],[-8,1],[-2,10],[0,17],[1,18],[1,13],[1,14],[2,9],[3,8],[6,10],[5,7],[7,11],[8,12],[2,7],[-3,14],[-4,15],[-4,14],[-3,14],[-4,12],[-3,7],[-4,5],[-7,6],[-14,12],[-15,13],[-15,12],[-15,8],[-16,4],[-17,-1],[-17,-1],[-17,-1]],[[4098,4671],[0,16],[0,16],[0,16],[-1,16],[-13,-2],[-13,-2],[-13,2],[-11,10],[-4,7],[-6,10],[-5,9],[-5,6],[-2,3],[-2,5],[-1,5],[-1,4],[-4,7],[-5,4],[-5,5],[-3,9],[-1,6],[1,6],[0,6],[-1,7],[-3,7],[-3,6],[-1,6],[1,8],[1,6],[1,6],[-1,5],[-3,4],[-2,4],[0,5],[2,4],[0,5],[-3,13],[-6,11],[-5,12],[-2,12],[-5,1],[-4,2],[-5,2],[-5,4],[-5,8],[-3,11],[-2,13],[-2,12],[-2,10],[-3,9],[-4,9],[-1,9],[-1,9],[-1,10],[0,9],[-1,9],[-2,22],[-2,22],[-1,22],[2,21],[4,18],[5,16],[5,16],[3,19],[-8,-5],[-7,-2],[-6,2],[-6,10],[-5,13],[-4,14],[-4,14],[-3,14],[-4,15],[-3,17],[-5,16],[-5,12],[-8,12],[-8,11],[-8,11],[-8,11],[-3,4],[-3,4],[-4,3],[-3,3],[-13,4],[-12,-3],[-11,-10],[-11,-13],[-4,-8],[-3,-8],[-3,-8],[-4,-6],[-5,-3],[-6,-1],[-5,0],[-5,0],[-7,-1],[-5,1],[-5,3],[-6,7],[-5,8],[-6,9],[-5,8],[-6,9],[-3,7],[-1,8],[0,9],[0,9],[-1,12],[-1,9],[-2,9],[-3,10],[-2,6],[-2,7],[-2,6],[-2,7],[-2,10],[-4,7],[-3,5],[-5,7],[-7,18],[-4,21],[-6,18],[-11,11],[-6,4],[-4,8],[-3,9],[-4,9],[-3,6],[-5,1],[-5,0],[-5,0],[-5,2],[-5,2],[-4,6],[-2,9],[-1,8],[1,7],[-1,7],[-3,7],[-4,5],[-6,2],[-5,3],[-5,5],[-3,8],[-2,10],[-2,11],[-2,10],[-6,22],[-4,24],[-4,23],[-5,23],[-3,25],[0,26],[2,27],[3,25],[2,23],[2,26],[5,25],[6,20],[6,10],[5,8],[6,10],[4,11],[3,11],[5,10],[5,8],[6,9]],[[2995,5998],[16,-9],[4,-4],[7,-14],[4,-5],[-6,-6],[-10,7],[-12,12],[-8,6],[-3,0],[-2,2],[-3,2],[-3,0],[-19,0],[-4,3],[-2,8],[35,0],[6,-2]],[[4098,4671],[-7,1],[-7,-1],[-6,-5],[-3,-10],[-3,-11],[0,-7],[1,-6],[3,-9],[3,-7],[1,-5],[1,-5],[-3,-7],[-4,-8],[-6,-7],[-6,-8],[-5,-7],[-5,-8],[-6,-11],[-5,-12],[-2,-11],[1,-6],[2,-4],[2,-3],[3,-2],[3,-4],[2,-4],[2,-4],[1,-8],[3,-5],[3,-2],[4,-2],[2,-4],[1,-3],[-1,-4],[-1,-4],[0,-3],[1,-2],[2,-1],[2,-1],[1,-2],[3,-12],[2,-14],[3,-14],[2,-14],[-1,-19],[-7,-11],[-11,-3],[-10,6],[-5,6],[-4,7],[-5,6],[-5,5],[-7,2],[-6,-1],[-7,-4],[-7,-2],[2,-9],[2,-11],[1,-10],[0,-10],[-5,-7],[-6,9],[-5,15],[-4,9]],[[3992,4383],[3,3],[-2,7],[-3,8],[-3,2],[-3,-6],[-2,0],[-3,31],[-11,26],[-25,41],[-14,29],[-5,9],[-14,13],[-2,4],[0,1],[-2,2],[-1,3],[-1,3],[6,15],[-4,-1],[-4,-3],[-3,-5],[-4,-6],[-59,123],[-3,3],[-6,3],[-3,3],[-6,8],[-30,55],[-5,5],[-4,-1],[-3,-4],[-3,-2],[-3,3],[-1,4],[1,21],[-2,7],[-11,28],[-5,7],[-1,4],[4,4],[-1,4],[-1,3],[-1,3],[-12,37],[-4,6],[-5,3],[-6,7],[-13,18],[-1,3],[-2,4],[-3,13],[-3,6],[-8,7],[-5,9],[-7,17],[-9,17],[-6,7],[-13,7],[-4,11],[-2,26],[-5,10],[-5,10],[-5,11],[-4,23],[-9,27],[-43,74],[-15,19],[-6,3],[-4,4],[-17,26],[-45,50],[-21,22],[-3,6],[-1,13],[-4,6],[-12,9],[-12,14],[-20,29],[-73,72],[-6,9],[-2,10],[1,6],[2,0],[3,-2],[2,-4],[1,-2],[0,-3],[0,-6],[1,-1],[25,-22],[3,-2],[44,-45],[5,-3],[3,-4],[5,-4],[-3,4],[-9,10],[-5,4],[1,6],[6,-4],[10,-13],[1,2],[1,3],[0,2],[-1,0],[-2,0],[-1,0],[3,7],[3,4],[3,6],[0,10],[-2,8],[-11,43],[-4,6],[-5,4],[-5,0],[-5,-1],[-5,-4],[-2,-7],[4,-1],[9,5],[2,-4],[-1,-5],[-9,-13],[-3,-4],[-9,-5],[-6,6],[-5,11],[-6,6],[-6,-6],[-3,-1],[-2,1],[-2,1],[-7,9],[-2,4],[0,4],[-1,7],[-1,4],[-2,3],[-4,3],[-2,2],[-13,21],[-4,2],[-5,-5],[-6,10],[-7,9],[-8,6],[-7,2],[1,-6],[3,-4],[4,-5],[10,-17],[6,-7],[13,-13],[4,-8],[-9,3],[-23,23],[-28,39],[-3,8],[-1,8],[-1,20],[-2,10],[-3,10],[-3,7],[-4,4],[-1,1],[-2,4],[0,4],[1,2],[3,-1],[3,-1],[6,-6],[2,-4],[5,-5],[6,-1],[2,12],[-2,10],[-3,10],[-5,8],[-3,4],[4,6],[0,9],[-2,19],[1,9],[1,7],[5,14],[-4,8],[-13,17],[-3,2],[-1,-11],[4,-29],[1,-3],[1,-3],[0,-7],[-2,-18],[-1,-19],[-1,-6],[-2,-3],[-2,1],[-1,1],[-2,2],[-1,2],[-3,3],[-1,-3],[0,-4],[-2,-2],[-11,12],[-10,21],[-25,80],[-8,16],[-11,15],[-6,5],[-3,4],[-2,6],[7,0],[7,-2],[6,-6],[2,-9],[20,-36],[3,-16],[1,-2],[2,-1],[2,2],[1,1],[1,1],[6,-7],[2,-1],[3,2],[1,4],[-1,12],[-1,7],[-3,0],[-4,-1],[-3,3],[1,3],[3,10],[1,2],[2,5],[2,1],[1,-2],[2,-6],[7,-10],[5,-4],[13,-3],[11,-7],[2,4],[1,6],[0,6],[-33,47],[-4,4],[-5,0],[2,-4],[0,-3],[-2,-3],[-4,-1],[-4,1],[-4,4],[-5,10],[-7,20],[-2,3],[-4,-1],[-4,-3],[-3,-3],[-4,3],[-4,-4],[-9,-1],[-8,2],[-6,5],[-2,17],[1,4],[2,-1],[7,-8],[4,-3],[-1,8],[0,16],[-1,7],[-3,5],[-8,6],[-2,4],[-8,-59],[-4,-9],[-1,5],[2,24],[0,9],[-3,11],[-4,8],[-5,6],[-5,5],[-33,21],[-19,20],[-13,5],[-13,3],[-11,0],[7,9],[13,-2],[23,-11],[-7,6],[-13,17],[-9,3],[-17,-8],[-8,-2],[-4,10],[13,0],[2,4],[-3,10],[-2,4],[0,4],[0,4],[-3,1],[-1,-1],[-4,-5],[-2,-2],[3,18],[1,7],[0,26],[-1,8],[-2,1],[-3,-2],[-3,-1],[-11,7],[0,2],[0,2],[-1,3],[-2,1],[-2,-1],[-3,-2],[-1,-1],[-6,2],[-4,2],[-2,-2],[0,-9],[1,-6],[2,-4],[1,-3],[0,-6],[0,-7],[-1,-4],[-2,-3],[-2,-3],[-5,-6],[-5,0],[-3,3],[-4,8],[2,0],[2,1],[1,3],[-2,4],[-3,1],[-15,-2],[-5,-4],[-1,-6],[4,-8],[-9,-1],[-10,11],[-16,28],[7,5],[2,2],[2,5],[2,7],[2,5],[4,3],[11,-7],[2,1],[3,2],[3,-5],[1,-11],[3,-3],[1,1],[1,3],[2,7],[0,3],[0,6],[0,3],[1,2],[3,1],[17,27],[3,7],[0,3],[0,2],[-1,2],[1,4],[1,2],[2,1],[1,0],[1,4],[-1,18],[3,10],[13,18],[1,11],[-3,9],[-3,-7],[-7,-22],[-5,-11],[-5,-18],[-5,-7],[-7,-6],[-16,-7],[-6,-8],[-10,-24],[-6,-8],[-9,4],[-8,-8],[-5,0],[-4,6],[-4,13],[-3,11],[-2,6],[-3,2],[-4,2],[-10,7],[-8,9],[-1,-2],[1,-6],[1,-6],[3,-5],[22,-29],[5,-12],[-1,-11],[-8,11],[-7,15],[-8,14],[-11,6],[-35,-2],[-11,5],[7,9],[9,4],[9,0],[9,-5],[0,9],[0,9],[1,3],[3,4],[1,3],[-1,3],[-1,2],[0,1],[-1,1],[-2,7],[-6,7],[-7,5],[-5,3],[-6,-1],[-4,-3],[-2,-7],[0,-32],[-1,-4],[-3,8],[1,10],[1,14],[-1,13],[-3,5],[-6,4],[-2,9],[1,12],[4,21],[1,5],[1,0],[0,11],[0,8],[-1,5],[-3,8],[-2,13],[-1,10],[1,24],[1,9],[12,31],[12,20],[5,11],[4,23],[12,34]],[[2866,6435],[1,0],[1,1],[1,1]],[[2869,6437],[0,-1],[-2,-7],[1,-12],[-1,-6],[-2,-6],[0,-6],[1,-5],[4,-1],[2,4],[1,6],[3,17],[9,29]],[[2885,6449],[2,2],[6,6],[6,6],[6,6],[4,5]],[[2909,6474],[0,-9],[-3,-8],[-4,-5],[0,-3],[7,-5],[15,-21],[4,-1],[1,6],[-5,13],[0,8],[2,3],[4,2],[2,3],[-2,7],[-9,-1],[-7,24]],[[2914,6487],[3,9],[2,2],[2,3],[2,2],[2,3],[32,38],[32,39],[31,40],[31,40],[15,21],[16,20],[16,21],[16,20],[2,8],[0,12],[0,13],[0,11],[2,14],[3,13],[3,14],[3,14],[-3,5]],[[2866,6435],[1,3],[6,19],[1,9],[1,6],[3,-2],[1,-6],[-4,-12],[-2,-3],[-2,-4],[-1,-4],[-1,-4]],[[2885,6449],[1,10],[1,29],[3,6],[6,-1],[7,-3],[3,-3],[3,-11],[0,-2]],[[2662,6866],[-2,0],[-8,16],[-7,8],[-9,7],[-5,1],[-3,5],[3,1],[6,-3],[10,-8],[9,-10],[6,-17]],[[2475,7020],[-1,-9],[-17,10],[-5,9],[-1,22],[1,13],[2,13],[1,6],[-2,-21],[2,-26],[6,-10],[14,-7]],[[2209,7388],[2,-9],[-5,2],[-2,7],[-2,6],[2,4],[5,-10]],[[1921,7799],[-1,-3],[-1,1],[0,4],[-2,6],[1,3],[1,-5],[1,-3],[0,-1],[1,-2]],[[1922,8080],[1,-9],[4,-7],[1,-2],[-1,-5],[-1,-5],[-2,-6],[2,-7],[-1,-8],[12,-23],[12,-41],[-6,-19],[0,-18],[-4,-27],[-5,-8],[2,-8],[-5,-10],[-2,-11],[-4,-8],[-1,-10],[1,-11],[3,-2],[3,-7],[-3,-3],[-4,3],[-4,-3],[-7,-9],[-5,9],[-6,1],[-4,-4],[-3,8],[-5,1],[-5,10],[-4,4],[-5,-1],[-3,2],[-6,0],[-3,2],[-1,8],[-8,2],[-1,6],[-8,6],[-8,7],[-5,6],[-3,0],[-3,4],[8,9],[10,9],[5,11],[2,2],[1,5],[1,5],[2,5],[1,7],[-1,5],[-3,5],[-1,23],[1,24],[3,23],[3,21],[2,7],[3,8],[4,6],[4,5],[6,-7],[6,0],[7,8],[5,7],[6,2],[9,0],[5,1],[4,6],[3,5],[4,2],[0,-5],[-5,-6]],[[1867,8103],[-2,-1],[-1,1],[1,1],[0,1],[1,1],[1,-1],[0,-2]],[[1168,9453],[5,-17],[-4,0],[-4,2],[-3,5],[-2,4],[-7,-8],[-14,11],[-12,23],[4,25],[10,-3],[14,-18],[13,-24]],[[2914,6487],[-5,18],[-9,8],[1,-2],[1,-3],[1,-3],[1,-3],[-6,3],[-3,1],[-4,-1],[-9,-16],[-3,-1],[-1,8],[5,39],[-2,22],[-4,21],[-6,13],[-12,26],[-14,16],[-9,22],[-10,14],[-9,5],[-9,2],[-2,4],[3,1],[7,-3],[7,-4],[-2,10],[-2,2],[2,5],[-2,7],[-6,0],[-4,1],[-3,6],[-1,8],[-3,-3],[-4,-5],[-2,11],[-5,2],[-4,-7],[-2,-6],[-1,-6],[2,-3],[4,-1],[3,-1],[1,-3],[-1,-4],[0,-4],[6,-5],[3,-1],[0,-4],[-11,8],[-24,7],[-13,-2],[-5,-5],[-1,-6],[-9,2],[-10,8],[-13,8],[-6,7],[-14,26],[-8,19],[-3,19],[-2,20],[-5,11],[-4,17],[-1,8],[-3,8],[-10,25],[1,6],[3,-8],[9,-21],[6,-8],[-8,31],[0,11],[-2,24],[-12,21],[-4,6],[-5,3],[-5,2],[-6,0],[-2,-1],[-3,-2],[-2,-3],[-2,-3],[-2,-7],[-3,-4],[-9,11],[-19,9],[-13,5],[-8,4],[-8,2],[-7,3],[-7,2],[-11,10],[-5,3],[-11,21],[-10,20],[-14,16],[-5,5],[-12,4],[-7,-1],[0,6],[10,-1],[8,-2],[9,-1],[4,5],[-6,8],[-8,16],[-3,7],[1,2],[1,4],[0,4],[-4,2],[-2,3],[-2,4],[-6,-8],[-4,-3],[-3,0],[-4,2],[-1,4],[0,14],[-1,14],[-9,8],[-1,34],[-2,18],[-9,36],[-1,17],[4,9],[5,4],[7,2],[3,8],[-1,8],[-3,2],[-5,-4],[-2,-6],[3,18],[1,4],[5,3],[4,1],[3,2],[1,5],[-10,2],[-6,4],[-1,8],[4,13],[-4,1],[-3,4],[-1,7],[2,7],[2,-6],[2,-1],[2,3],[1,10],[2,1],[3,0],[16,3],[4,5],[-2,11],[-6,-4],[-18,12],[-8,-1],[4,-5],[-2,-3],[-5,1],[-9,11],[-5,3],[-23,9],[-11,1],[-11,-1],[-12,-4],[0,4],[4,1],[9,6],[-2,8],[-2,5],[0,5],[0,7],[-2,6],[-3,3],[-4,0],[-2,-5],[0,-16],[-1,-9],[-4,-8],[-6,-11],[5,1],[3,-2],[1,-5],[0,-7],[-1,-7],[-3,-9],[-3,-5],[-2,6],[-1,1],[-7,16],[-2,1],[-5,1],[-2,1],[-2,3],[-1,3],[-1,3],[-3,3],[4,5],[2,1],[3,1],[-5,9],[-7,9],[-7,6],[-7,-1],[-6,-3],[-6,-11],[-9,0],[-6,-1],[1,6],[3,3],[-3,6],[-5,4],[-3,0],[-4,8],[-10,4],[-3,9],[-5,8],[-7,12],[-9,5],[-4,11],[-6,10],[-6,21],[-10,17],[-3,25],[-3,6],[-1,0],[-4,0],[-2,1],[-1,2],[0,3],[-3,8],[-1,12],[-2,6],[-14,19],[-4,9],[-2,12],[2,7],[3,5],[1,10],[-11,-3],[-13,7],[-22,12],[-20,16],[-8,4],[-8,3],[-3,1],[-5,23],[-6,21],[-6,24],[-50,75],[-6,15],[-3,5],[1,4],[4,0],[4,3],[5,6],[3,1],[2,-6],[2,-5],[2,-5],[3,-1],[2,2],[1,5],[0,6],[0,6],[-3,10],[-5,0],[-6,-2],[-7,1],[-9,13],[-5,9],[-12,8],[-8,3],[-1,11],[-5,3],[1,5],[-4,7],[-8,8],[-2,9],[-2,6],[-2,4],[-4,2],[-4,2],[-7,-1],[-5,2],[-1,4],[3,4],[3,4],[-1,5],[-1,5],[-4,22],[-1,13],[-4,3],[1,5],[3,8],[3,6],[-1,6],[-3,11],[-6,9],[2,5],[-6,8],[-6,4],[4,22],[1,14],[-4,15],[-5,19],[-7,8],[-16,0],[-3,-2],[-2,-3],[-1,-2],[1,-5],[-1,-6],[-3,2],[-5,10],[-11,8],[-6,6],[-3,17],[4,16],[7,21],[3,11],[0,13],[-3,7],[-7,2],[-4,4],[-3,6],[0,12],[0,10],[-11,14],[-13,17],[-8,33],[-1,6],[-3,6],[-5,-1],[-6,12],[-2,8],[-3,21],[-5,11],[-5,10],[-4,9],[-6,32],[-3,7],[-6,6],[-2,-2],[-5,3],[-6,-4],[-6,5],[-1,7],[3,10],[-1,9],[3,16],[1,14],[-2,8],[-3,8],[-4,9],[0,10],[2,29],[0,31],[-3,14],[-5,10],[-5,10],[-5,6],[-6,6],[-2,0],[-3,1],[-3,-5],[-2,4],[4,11],[1,17],[-1,23],[-2,21],[-5,16],[-14,25],[-23,32],[-17,42],[-12,34],[-11,61],[-5,17],[6,17],[4,35],[0,22],[0,18],[-10,39],[0,8],[2,1],[2,-5],[2,-7],[2,-11],[5,-18],[2,-2],[2,5],[7,18],[0,27],[0,24],[2,18],[-7,9],[-7,17],[-8,8],[-9,1],[1,-5],[5,-4],[3,-3],[-1,-4],[-6,3],[-5,5],[-13,11],[-4,13],[-4,7],[-3,15],[-4,-1],[-5,-3],[-5,-2],[4,-8],[4,-4],[4,-2],[3,-4],[-4,-2],[-12,5],[-49,14],[-15,6],[-21,5],[-3,11],[-9,4],[-11,1],[-7,9],[2,4],[6,-2],[3,4],[-3,16],[-6,30],[1,17],[-8,17],[-17,19],[-14,10],[-5,7],[-10,1],[-14,11],[-8,7],[-3,10],[-9,-6],[-4,-2],[-4,0],[-6,8],[-2,22],[-5,4],[0,-7],[0,-30],[-1,-5],[3,-4],[2,-1],[2,0],[0,1],[3,-6],[-1,-1],[-3,-2],[-5,-10],[-1,-7],[-3,-3],[-4,-1],[-2,-5],[-1,-3],[-2,-3],[-3,-7],[-13,0],[-15,0],[-13,1],[-16,10],[-7,10],[-9,5],[-8,7],[-4,5],[-4,8],[-4,4],[-1,7],[-10,7],[-17,15],[-6,6],[-5,1],[-4,11],[-11,5],[-14,22],[-14,24],[-6,2],[-23,0],[-3,1],[-3,3],[-6,9],[-1,2],[-3,2],[-6,8],[-4,2],[-11,2],[-3,1],[-5,6],[-8,17],[-4,4],[-6,3],[-18,19]],[[1121,9882],[1,-1],[11,-6],[129,-70],[130,-69],[129,-70],[129,-70],[129,-69],[129,-70],[130,-70],[129,-69],[16,-9],[16,-10],[17,-9],[16,-9],[16,-9],[16,-9],[17,-9],[16,-9],[8,-5],[20,-4],[18,0],[13,0],[14,0],[13,0],[14,0],[13,0],[14,0],[13,0],[14,0],[13,0],[14,0],[13,0],[14,0],[13,0],[14,0],[13,0],[14,0],[13,0],[14,0],[13,0],[14,0],[13,0],[14,0],[13,0],[14,0],[13,0],[14,0],[13,0],[13,0],[14,0],[13,0],[14,0],[13,0],[14,0],[13,0],[14,0],[13,0],[14,0],[13,0],[14,0],[13,0],[14,0],[13,0],[14,0],[13,0],[7,0],[7,0],[13,0],[5,0]],[[5538,5514],[-4,-23],[-3,-17],[-6,-14],[-12,-10],[-11,-11],[-9,-14],[-7,-17],[-7,-19],[-16,-42],[-16,-43],[-15,-43],[-14,-44],[-6,-12],[-5,-6],[-7,-2],[-8,-4],[-8,-6],[-6,-10],[-6,-12],[-5,-11],[-12,-22],[-13,-20],[-14,-18],[-15,-17],[-13,-11],[-13,-11],[-12,-13],[-10,-16],[-3,-8],[-2,-9],[-2,-9],[-4,-7],[-4,-3],[-6,-1],[-5,-1],[-5,-3],[-11,-12],[-11,-16],[-9,-17],[-7,-19],[-8,-18],[-9,-16],[-11,-14],[-11,-13],[-5,-6],[-7,-6],[-6,-4],[-7,-1],[-5,4],[0,7],[1,9],[0,8],[-3,5],[-6,2],[-6,-1],[-5,-2],[-2,-5],[-2,-11],[-2,-12],[-1,-8],[-2,-10],[-1,-12],[-3,-11],[-3,-7],[-6,0],[-5,3],[-4,-1],[-3,-10],[0,-11],[2,-6],[5,-3],[4,-5],[3,-9],[3,-11],[1,-12],[1,-10],[3,-16],[1,-12],[-1,-12],[-5,-14],[-3,-13],[1,-13],[4,-13],[4,-13],[3,-12],[4,-13],[3,-13],[4,-13],[9,-26],[11,-22],[14,-19],[13,-20],[3,-5],[3,-3],[4,-2],[3,0],[12,-11],[10,-21],[9,-24],[7,-20],[0,-1],[1,-1],[0,-1],[1,-1],[5,-11],[5,-11],[6,-10],[8,-6],[9,-2],[7,5],[7,9],[7,7],[3,1],[2,1],[2,0],[3,0],[10,4],[6,14],[4,18],[5,16],[9,10],[13,3],[14,-1],[12,0],[6,1],[8,0],[6,-3],[5,-8],[4,-14],[4,-15],[4,-16],[4,-15],[1,-11],[-3,-7],[-6,-5],[-6,-5],[-5,-7],[-4,-9],[-1,-10],[-1,-12],[3,-19],[4,-18],[4,-18],[3,-19],[1,-17],[1,-17],[1,-17],[1,-17],[-1,-8],[-2,-8],[-4,-8],[-3,-6],[-13,-28],[-13,-29],[-13,-28],[-13,-29]],[[5320,4015],[-1,13],[-2,7],[-3,2],[-7,-2],[-5,2],[-5,8],[-5,11],[-5,8],[-4,5],[-4,5],[-5,5],[-4,3],[-5,0],[-5,-1],[-4,-1],[-5,-1],[-8,3],[-7,8],[-7,10],[-7,9],[-1,1],[-1,0],[-2,1],[-1,1]],[[5217,4112],[-4,10],[-4,10],[-5,9],[-5,8],[-8,8],[-9,6],[-7,7],[-4,14],[0,17],[1,20],[0,19],[-3,14],[-6,5],[-7,0],[-6,0],[-7,4],[-4,7],[-3,7],[-3,3],[-6,0],[-4,6],[-2,8],[-1,9],[-4,5],[-2,0],[-2,-2],[-2,-2],[-2,-3],[-6,-3],[-6,8],[-4,12],[-3,11],[-3,12],[-4,13],[-6,4],[-5,-10],[-3,-10],[-4,-10],[-5,-7],[-6,0],[-4,-3],[-2,-5],[-3,-6],[-3,-4],[-3,-2],[-3,1],[-3,1],[-3,0],[-2,0],[-1,-1],[-1,-1],[-1,0],[-2,-6],[-1,-6],[-1,-7],[-3,-6],[-4,-4],[-6,-1],[-6,0],[-5,1],[-12,1],[-12,-2],[-10,-7],[-7,-18],[1,-9],[4,-8],[4,-9],[-2,-14],[-4,-14],[-6,-12],[-6,-12],[-7,-11],[-6,-12],[-5,-13],[-4,-14],[-5,-13],[-4,-10],[-5,-9],[-4,-10],[-3,-10],[-3,-11],[-1,-12],[-1,-11],[0,-12],[3,-21],[7,-14],[9,-10],[11,-11]],[[4928,3964],[-1,-6],[0,-6],[-1,-7],[-1,-6],[-2,-12],[-2,-15],[0,-14],[2,-11],[7,-3],[4,-4],[5,-5],[5,-5],[5,-2],[7,1],[6,0],[4,-4],[2,-19],[-4,-26],[-6,-25],[-5,-19],[-1,-1],[0,-2],[-1,-2],[-1,-1],[-2,-5],[-4,-2],[-4,-1],[-3,-3],[-2,-3],[-2,-4],[-2,-4],[-2,-3],[-3,-6],[-1,-10],[-1,-9],[-4,-5],[-7,-2],[-1,6],[2,8],[1,7],[-4,6],[-5,-2],[-6,-6],[-4,-7],[-8,-10],[-9,-7],[-9,-4],[-10,1],[-7,4],[-8,4],[-7,-2],[-3,-13],[0,-9],[0,-9],[1,-9],[0,-9],[1,-18],[1,-26],[0,-25],[-4,-16],[-8,-2],[-8,9],[-8,9],[-8,1],[-11,-5],[-12,7],[-11,11],[-10,9],[-2,2],[-3,2],[-2,3],[-2,2],[-6,5],[-5,5],[-6,4],[-6,3],[-5,-1],[-5,-1],[-5,0],[-5,1],[-5,7],[-4,7],[-5,5],[-6,1],[-6,-1],[-7,-1],[-7,-1],[-6,3],[-5,6],[-1,7],[-1,9],[-2,9],[-5,6],[-6,-3],[-7,-6],[-6,-6],[-7,-6],[-3,1],[-1,7],[0,13],[0,12],[1,6],[2,4],[5,6],[3,8],[2,9],[1,11],[0,10],[-1,20],[-2,19],[-3,19],[-3,19],[7,-6],[7,-8],[7,-6],[7,-1],[6,6],[4,11],[4,12],[3,11],[7,9],[9,6],[7,8],[0,13],[0,18],[0,22],[-1,21],[-4,15],[-3,15],[5,15],[8,14],[8,11],[6,9],[6,9],[6,9],[6,9],[4,3],[4,2],[3,1],[4,0],[4,0],[4,2],[3,4],[3,5],[6,15],[8,1],[9,-4],[10,-2],[6,2],[5,3],[4,7],[3,9],[3,14],[3,9],[4,5],[8,5],[2,6],[1,7],[-1,7],[-1,7],[-5,6],[-5,0],[-3,3],[-1,12],[1,6],[4,2],[4,1],[4,2],[4,6],[3,8],[2,9],[3,8],[2,7],[2,10],[1,10],[-2,8],[-4,2],[-4,-1],[-4,-2],[-4,-1],[-1,7],[0,6],[-2,5],[-4,4],[-5,0],[-6,-3],[-7,-4],[-5,-2],[1,7],[1,10],[0,10],[-1,5],[-5,5],[-5,5],[-4,5],[-5,6],[-10,13],[-10,13],[-10,14],[-10,14],[-1,-2],[-1,-2],[-1,-2],[0,-2],[-4,-10],[-3,-9],[-3,-10],[-2,-10],[-2,-8],[0,-4],[2,-2],[4,-3],[3,-3],[1,-6],[1,-4],[3,-2],[4,-1],[3,-2],[1,-4],[-1,-6],[-2,-3],[-3,-3],[-2,-2],[-3,-3],[-3,-13],[0,-14],[-2,-12],[-6,-4],[-7,-5],[-4,-14],[-3,-17],[-3,-13],[-3,-15],[-3,-6],[-1,6],[-2,4],[-4,2],[-4,0],[-11,3],[-3,-2],[-5,-10],[-3,-4],[-4,-3],[-8,-2],[-5,2],[-7,11],[1,15],[1,11],[3,20],[0,10],[-1,11],[-1,11],[-3,9],[-1,8],[0,7],[1,7],[2,8],[2,18],[5,29],[6,25],[7,8],[0,5],[1,6],[0,5],[-1,5],[-3,2],[-3,0],[-3,1],[-2,3],[0,6],[1,6],[1,7],[-2,6],[-4,1],[-6,0],[-7,0],[-4,0],[-2,3],[-2,4],[-1,1],[-4,-4],[-7,-21],[-4,-27],[-3,-28],[-3,-25],[-4,-30],[-5,-30],[-4,-30],[-4,-30],[-1,-2],[0,-3],[0,-2],[0,-3],[-3,5],[-4,11],[-2,12],[-2,11],[-1,10],[0,10],[-1,10],[0,11],[1,11],[2,8],[3,8],[2,10],[0,10],[-2,8],[-2,7],[-3,8],[0,9],[4,5],[4,4],[3,4],[2,8],[0,8],[-1,8],[-1,9],[1,10],[3,6],[4,5],[5,6],[6,13],[2,21],[1,22],[2,18],[-16,5],[-17,5],[-16,5],[-16,5],[0,-19],[-1,-20],[0,-20],[-1,-20],[-1,-17],[0,-12],[3,-10],[7,-11],[8,-9],[3,-7],[0,-10],[-2,-15],[-1,-11],[-1,-12],[-1,-11],[-2,-12],[-1,-5],[-2,-3],[-3,-1],[-4,-1],[-15,-5],[-17,-2],[-16,-2],[-15,-8],[-12,-9],[-12,-9],[-12,-8],[-11,-10]],[[4433,4248],[1,7],[2,8],[2,8],[1,7]],[[5861,7279],[3,-5],[3,-7],[4,-7],[3,-3],[6,-3],[2,-2],[1,-5],[1,-6],[1,-6],[2,-2],[4,-10]],[[5891,7223],[-1,0],[-16,-11],[-16,-13],[-15,-14],[-15,-15],[-1,-8],[0,-13],[1,-13],[2,-6],[10,-3],[10,-2],[10,-3],[10,-2],[7,-17],[5,-37],[3,-40],[3,-26],[0,-10],[1,-13],[2,-13],[2,-7],[7,-10],[2,-8],[-1,-10],[-3,-15],[-6,-27],[-6,-36],[-2,-34],[10,-19],[4,0],[2,-1],[2,-2],[2,-1],[2,-1],[5,-1],[4,-1],[2,0],[3,-5],[4,-3],[3,-3],[4,-3],[2,-4],[1,-4],[1,-3],[3,-2],[-4,-10],[-5,-10],[-4,-10],[-2,-12],[0,-15],[-3,-9],[-5,-7],[-6,-10],[7,0],[6,0],[7,0],[6,1],[4,-1],[5,-3],[5,-5],[4,-3],[10,-6],[12,-6],[10,-10],[7,-15],[2,-16],[0,-15],[-2,-16],[-5,-13],[-2,-5],[-2,-4],[-1,-4],[-1,-8],[0,-11],[1,-9],[1,-8],[3,-9],[6,-10],[7,6],[7,10],[4,1],[3,-8],[2,-7],[3,-7],[3,-5],[4,-7],[3,-7],[4,-7],[3,-8],[5,-3],[4,-1],[5,1],[5,1],[5,-1],[2,-5],[1,-8],[1,-8],[2,-26],[0,-34],[3,-32],[6,-15],[1,4],[2,3],[2,4],[2,2],[2,1],[3,-1],[2,-1],[2,0],[2,2],[1,3],[2,4],[2,2],[7,2],[5,-5],[5,-7],[5,-9],[7,-13],[8,-13],[8,-13],[9,-12],[3,12],[5,15],[5,14],[5,8],[7,0],[8,-3],[9,-5],[7,-3],[5,-2],[5,-3],[5,-2],[5,-2],[8,-3],[8,-4],[8,-4],[8,-3],[4,-15],[1,-28],[-1,-31],[0,-20],[0,-28],[0,-29],[0,-28],[0,-28],[-1,-17],[-1,-25],[0,-24],[2,-14],[5,-2],[8,0],[8,0],[5,0],[5,0],[2,-2],[1,-5],[0,-9],[1,-11],[-4,-8],[-6,-7],[-5,-5],[-11,-15],[-11,-15],[-11,-14],[-11,-15],[-17,-23],[-17,-22],[-17,-23],[-17,-23],[-7,-9],[-6,-7],[-6,-4],[-8,-2],[-7,-3],[-8,1],[-7,5],[-5,10],[-5,12],[-4,-2],[-4,-9],[-5,-12],[-5,-2],[-2,-7],[-3,-7],[-6,0],[-6,1],[-2,-4],[1,-8],[2,-9],[-5,1],[-6,-1],[-4,-3],[1,-7],[3,-5],[5,-8],[4,-8],[2,-6],[-2,-6],[-4,-7],[-3,-8],[-3,-5],[-4,-11],[0,-13],[3,-12],[3,-12],[1,-5],[1,-5],[1,-5],[0,-5],[-8,4],[-8,4],[-9,5],[-7,6],[-6,7],[-3,2],[-3,-2],[-5,-10],[-2,-4],[-3,-4],[-4,-2],[-4,-1],[-7,-2],[-5,1],[-5,-2],[-6,-7],[-1,-3],[-1,-3],[-1,-2],[-3,-3],[-2,-1],[-2,0],[-2,-1],[-3,-1],[-3,-7],[-2,-6],[0,-8],[0,-9],[-1,-6],[-2,-3],[-3,-1],[-3,-2],[-3,-3],[-2,-4],[-2,-3],[-3,-1],[-3,1],[-2,3],[-2,3],[-3,1],[-6,-3],[-7,-4],[-7,-4],[-5,-6],[-5,-8],[-6,-8],[-5,-8],[-6,-8],[0,-11],[2,-15],[4,-15],[2,-13],[9,6],[8,5],[8,6],[8,5],[1,-6],[1,-7],[1,-6],[1,-7],[0,-1],[0,-2],[0,-1],[0,-1],[1,-7],[1,-8],[1,-7],[1,-7],[2,-12],[0,-10],[0,-10],[-2,-11],[-3,-14],[-2,-15],[-2,-14],[-2,-14],[-2,-19],[0,-27],[2,-25],[5,-15],[2,-2],[1,-1],[1,-2],[1,-2],[5,-8],[5,-8],[6,-7],[5,-7],[6,-7],[5,-7],[4,-8],[2,-12],[1,-5],[1,-7],[1,-8],[-1,-4],[-3,-2],[-5,2],[-5,2],[-3,-3],[-6,-15],[-7,-15],[-6,-14],[-6,-15],[-6,-9],[-8,-3],[-10,0],[-8,-1],[-9,-3],[-9,-2],[-10,0],[-9,0],[-3,0],[-4,-1],[-3,-1],[-3,-3],[-4,-8],[-4,-10],[-3,-11],[-3,-10],[-4,-13],[-4,-14],[-3,-14],[-4,-14],[-2,-6],[-2,-6],[-1,-6],[-1,-6],[4,-20],[4,-21],[3,-21],[3,-22],[-8,4],[-8,4],[-9,5],[-7,6],[-11,4],[-9,-7],[-8,-13],[-9,-13],[7,-6],[8,-8],[7,-9],[3,-9],[-1,-8],[-1,-8],[0,-8],[-1,-7]],[[5782,4786],[-21,4],[-22,2],[-21,0],[-21,1],[0,-7],[0,-7],[0,-8],[0,-7],[-1,-6],[-4,-1],[-4,2],[-5,1],[-9,3],[-7,6],[-6,10],[-3,16],[-1,3],[0,3],[-1,3],[0,3],[0,4],[0,3],[0,3],[0,3],[0,10],[0,10],[0,9],[0,10],[-1,8],[-2,8],[-2,8],[0,8],[1,9],[2,9],[2,10],[1,9],[-1,8],[-1,7],[-2,8],[-1,7],[-3,19],[-4,20],[-1,20],[1,19],[3,18],[1,16],[-1,17],[-2,18],[-10,20],[-10,19],[-9,21],[-6,24],[-2,29],[0,29],[0,30],[0,29],[-1,17],[0,18],[-1,18],[-2,16],[-4,10],[-6,11],[-6,11],[-6,9],[-11,25],[-11,25],[-11,25],[-12,23]],[[5782,4786],[-2,-17],[-3,-16],[-3,-17],[-2,-17],[5,8],[8,12],[8,8],[5,-3],[1,-11],[0,-10],[1,-9],[3,-10],[8,-13],[9,-13],[7,-15],[2,-19],[-1,-8],[-2,-6],[-2,-7],[-3,-6],[-7,-8],[-7,-4],[-8,-4],[-7,-7],[-4,-7],[-1,-7],[2,-6],[3,-7],[3,-7],[1,-6],[1,-7],[1,-9],[2,-4],[4,-4],[5,-2],[4,-2],[7,-5],[7,-5],[8,-5],[7,-5],[17,-11],[16,-11],[17,-11],[17,-11],[5,-3],[6,-4],[7,-3],[5,-3],[8,-5],[6,-2],[3,5],[0,14],[-1,8],[-1,8],[-1,8],[-1,8],[-1,5],[-2,3],[1,2],[2,2],[3,-2],[4,-4],[3,-4],[3,-4],[5,-10],[5,-12],[6,-11],[5,-6],[5,2],[4,8],[4,9],[4,8],[1,-3],[1,-3],[1,-3],[1,-3],[5,-16],[6,-15],[5,-14],[5,-16],[3,-13],[4,-14],[4,-13],[5,-11],[6,-7],[7,-4],[8,-2],[7,-2],[10,-2],[9,-4],[8,-4],[9,-4],[1,-1],[1,0],[1,-1],[1,0],[10,-7],[10,-5],[10,-4],[10,-3],[7,-2],[8,-2],[9,-1],[6,2],[4,6],[3,7],[3,6],[5,5],[9,2],[10,1],[10,5],[5,12],[3,-4],[3,-3],[3,-4],[4,-2]],[[6237,4333],[2,-2],[1,-2],[2,-2],[2,-3],[7,-6],[6,-8],[6,-8],[6,-7],[9,-10],[9,-9],[10,-8],[9,-10],[7,-10],[6,-10],[3,-13],[-1,-17],[-4,-21],[-6,-22],[-7,-20],[-7,-20],[-3,-8],[-2,-8],[-2,-9],[-1,-8],[-2,-1],[-3,4],[-3,-6],[-3,-1],[-3,3],[-4,0],[0,1],[-4,-1],[-4,-3],[-2,-1],[-12,3],[-3,2],[-1,-1],[1,-15],[5,-1],[7,4],[6,1],[1,-4],[-4,-4],[-3,-7],[2,-12],[-7,-3],[1,-12],[5,-13],[4,-5],[13,2],[2,-6],[0,-7],[0,-6],[3,-2],[5,-3],[1,-7],[-1,-8],[-2,-5],[-3,-7],[-4,-5],[-8,-6],[-1,-2],[-1,-3],[0,-2],[-1,-1],[-2,1],[-4,3],[-2,0],[-3,-3],[-2,-4],[0,-4],[3,-5],[-5,-7],[-12,3],[-5,-7],[-1,-14],[1,-9],[0,-8],[-4,-7],[-1,-4],[3,-11],[4,-8],[6,-7],[6,-5],[10,-7],[6,-8],[3,-11],[1,-17],[0,-11],[1,-10],[0,-10],[0,-10]],[[6269,3772],[-5,-2],[-5,-3],[-4,-2],[-5,-3],[-3,-2],[-2,-3],[0,-5],[0,-7],[1,-19],[0,-19],[0,-20],[-2,-18],[-3,2],[-3,1],[-3,-2],[-2,-4],[-3,-2],[-2,-1],[-2,0],[-3,1],[-2,1],[-3,2],[-2,1],[-3,1],[-8,-2],[-7,-5],[-8,-6],[-8,-6],[-5,-2],[-6,2],[-5,3],[-6,5],[-3,3],[-5,3],[-4,3],[-3,4],[-1,6],[-1,7],[-1,7],[-2,7],[-1,4],[-1,4],[-1,3],[-2,3],[-8,4],[-10,-1],[-9,-5],[-6,-10]],[[6102,3700],[-5,6],[-5,5],[-6,2],[-6,-1],[1,11],[2,10],[1,11],[1,11],[-1,7],[-2,9],[-3,9],[-2,8],[-4,13],[-3,14],[-3,14],[-3,14],[-2,13],[-2,14],[-3,13],[-2,14],[0,3],[-1,2],[0,3],[-1,2],[0,-12],[-6,-9],[-7,-7],[-5,-8],[-1,-6],[1,-6],[0,-5],[-3,-5],[-4,-4],[-2,-1],[-3,0],[-3,3],[-2,2],[-2,0],[-1,-1],[-2,-2],[-2,-6],[-1,-8],[0,-7],[-2,-5],[-2,-2],[-2,-5],[-1,-4],[-2,-4],[-1,-4],[-1,-4],[-2,-4],[-2,-3],[-4,-1],[-4,2],[-4,0],[-4,-1],[-2,-1],[-3,-1],[-2,-1],[-2,-1],[-5,-10],[-8,-2],[-8,1],[-7,0],[-3,-2],[-1,-3],[-2,-2],[-4,1],[-3,3],[-3,4],[-2,5],[-3,2],[-3,4],[-2,6],[-1,7],[-2,6],[-3,3],[-2,2],[-2,3],[-2,4],[-3,5],[-4,5],[-5,4],[-4,3],[-9,-5],[-5,-14],[-4,-18],[-4,-15]],[[5866,3783],[-10,7],[-8,8],[-10,5],[-11,0],[-14,2],[-13,16],[-12,21],[-12,15],[-1,1],[-1,0],[0,1],[-1,1],[-11,5],[-10,6],[-10,5],[-11,6],[-4,1],[-4,2],[-4,3],[-3,4],[-6,4],[-6,4],[-6,3],[-6,5],[-3,4],[-3,2],[-3,1],[-4,2],[-3,3],[-1,3],[-3,2],[-4,0],[-4,-3],[-3,-4],[-3,-5],[-2,-4],[-2,-6],[-2,-7],[-2,-8],[-1,-7],[-2,-11],[-1,-13],[-1,-12],[-3,-10],[-7,-9],[-11,-3],[-12,0],[-10,0],[-7,7],[-7,9],[-6,10],[-6,9],[-15,19],[-15,19],[-15,19],[-15,20],[-5,7],[-4,9],[-5,7],[-6,7],[-9,6],[-11,4],[-11,2],[-10,0],[-11,-2],[-12,-5],[-12,-3],[-11,3],[-3,3],[-4,4],[-3,5],[-3,5],[-2,8],[0,8],[0,8],[-1,8],[-5,10],[-7,4],[-8,-2],[-7,-5],[-1,-1],[-1,0],[0,-1],[-1,-1],[-11,-12],[-10,-6],[-10,0],[-12,10]],[[6489,4485],[-8,-5],[2,6],[5,8],[2,5],[5,23],[3,7],[1,-10],[-3,-18],[-7,-16]],[[6500,4253],[-2,-3],[-9,-10],[-3,-2],[-3,-3],[-2,-6],[-3,-5],[-3,0],[-4,5],[-3,7],[-2,4],[-3,4],[-4,6],[0,8],[3,7],[2,7],[-4,6],[-5,5],[-6,6],[-6,6],[-5,2],[-8,1],[-8,4],[-8,4],[-7,0],[-5,2],[-5,6],[-6,8],[-5,7],[-6,9],[-2,13],[-3,12],[-6,4],[-4,-2],[-3,-3],[-3,-3],[-3,-2],[-4,-2],[-1,0],[-2,1],[-4,4],[-5,0],[-2,-11],[0,-13],[-1,-10],[-3,-4],[-5,0],[-4,3],[-4,2],[-5,-4],[-2,7],[-2,8],[-3,-2],[-5,-6],[-3,1],[-3,5],[-5,5],[-2,-1],[-1,-3],[-2,-1],[-2,3],[-2,3],[-2,0],[-1,-1],[-2,0],[-10,1],[-10,-3],[-11,-4],[-11,-2]],[[5891,7223],[2,-3],[1,-3],[12,1],[2,-3],[3,-10],[1,-2],[4,0],[6,6],[4,1],[3,-2],[4,-11],[2,-2],[5,-3],[7,-4],[6,-9],[2,-9],[0,-22],[0,-12],[0,-6],[2,-3],[4,0],[3,-2],[1,-5],[1,-8],[0,-2],[0,-21],[-1,-6],[-2,-13],[-1,-11],[-2,-7],[0,-6],[-2,-5],[-5,-9],[-2,-6],[9,-6],[2,-2],[0,-1],[1,-5],[1,-1],[3,-3],[1,-1],[5,-9],[3,-9],[3,-9],[0,-11],[-1,-11],[-5,-23],[0,-12],[0,-2],[2,-3],[1,-4],[1,-5],[-1,-5],[-6,-18],[5,-12],[2,-3],[4,-7],[3,-1],[3,0],[2,-1],[3,-5],[0,-6],[0,-11],[2,-6],[3,-5],[12,-16],[4,-7],[10,-19],[4,-10],[6,-8],[4,-10],[5,-23],[4,-27],[12,-58],[1,-9],[2,-27],[3,-13],[7,-5],[8,-3],[4,-8],[4,-15],[0,-7],[-1,-7],[-3,-7],[-2,-7],[1,-6],[7,-8],[6,-2],[6,1],[6,0],[1,-2],[2,-5],[2,-1],[2,1],[6,3],[7,0],[3,-3],[3,-9],[5,8],[11,-13],[8,2],[3,-3],[3,-1],[2,1],[2,3],[4,-3],[2,1],[2,2],[3,0],[2,-2],[5,-9],[11,-11],[3,-7],[-1,-9],[4,1],[4,-1],[4,-2],[3,-5],[-4,-8],[1,-2],[2,-1],[3,-1],[6,-10],[4,-3],[4,-2],[19,12],[9,-8],[10,-4],[9,-6],[6,-12],[5,10],[9,-5],[10,-9],[9,-4],[-3,-11],[0,-6],[4,-2],[8,0],[2,-4],[7,-17],[3,-5],[25,-20],[12,-6],[11,-1],[15,6],[6,-2],[3,-13],[3,-3],[6,4],[10,8],[5,1],[18,-5],[20,4],[24,0],[6,-3],[1,-8],[4,-2],[27,-3],[7,-2],[6,-4],[5,-8],[3,-7],[3,-9],[3,-7],[10,-7],[14,-23],[5,-6],[5,-3],[6,-2],[7,0],[2,-4],[1,-9],[4,-8],[6,-2],[2,2],[0,4],[0,2],[3,0],[2,-3],[1,-4],[1,-3],[3,-2],[7,5],[0,11],[-2,12],[-1,10],[1,3],[7,9],[6,-7],[7,4],[6,9],[1,9],[4,1],[15,-1],[21,2],[-9,-75],[3,-22],[-2,-11],[0,-25],[-3,-11],[-4,-9],[-4,-22],[-8,-35],[-12,-46],[-18,-61],[-44,-115],[-30,-183],[-31,-183],[-18,-237],[-1,-20],[-1,-22],[-3,-112],[-2,-9],[-6,-4],[-23,4],[0,-3],[9,0],[7,-2],[4,-6],[2,-14],[-2,-50],[2,0],[2,15],[2,36],[3,16],[3,-19],[-6,-112],[-5,-53],[-4,-99],[9,-158],[-4,-68],[0,32],[0,9],[-3,-6],[-10,-58],[-2,-8],[-11,-17],[-1,-5],[0,-7],[-1,-4],[-2,0],[-9,4],[6,-12],[1,-11],[-11,-40],[-1,-9],[1,-7],[3,-5],[3,0],[4,3],[3,5],[0,6],[-1,17],[1,7],[3,8],[2,-1],[1,-5],[0,-9],[0,-15],[-6,-45],[9,-56],[-1,-16],[2,-7],[3,-28],[1,-6],[2,-6],[5,-25]],[[5217,4112],[-1,-1],[0,-2],[-1,-2],[-1,-2],[-6,-15],[-5,-12],[-7,-8],[-11,-5],[-6,-6],[-5,-9],[-5,-9],[-9,-5],[-7,-7],[-3,-13],[-1,-14],[-2,-15],[-4,-12],[-6,-5],[-7,-3],[-8,-5],[-7,-9],[-6,-11],[-6,-9],[-8,-8],[-8,-4],[-9,0],[-9,2],[-9,2],[-10,2],[-10,3],[-10,2],[-9,2],[-15,7],[-12,12],[-12,14],[-13,11],[-9,2],[-11,-3],[-11,-7],[-10,-6]],[[1148,2082],[-2,0],[-3,0],[-10,-2],[-6,3],[0,6],[8,7],[16,0],[1,-1],[0,-4],[-1,-4],[-1,-2],[-2,-3]],[[2351,2301],[-6,0],[-6,0],[-6,-6],[-5,9],[-4,6],[-5,4],[-14,10],[1,4],[1,9],[3,13],[4,11],[12,18],[7,-4],[7,-10],[5,-12],[-1,-12],[4,-3],[4,-7],[3,-10],[0,-10],[-4,-10]],[[2381,2603],[-1,-1],[-1,1],[-1,4],[0,6],[2,5],[4,12],[1,5],[0,8],[3,-3],[2,-5],[4,-11],[-8,-10],[-4,-5],[-1,-6]],[[4702,2433],[-4,1],[-2,-4],[-1,-6],[-1,-7],[-2,-1],[-2,0],[-2,0],[-1,-2],[-1,-2],[0,-3],[1,-2],[0,-2],[-2,-2],[-4,-3],[-5,-4],[-3,-3],[-3,-6],[-2,-1],[-3,2],[-4,4],[-2,-2],[-1,-3],[0,-3],[0,-3],[1,-2],[0,-3],[0,-2],[-1,-3],[-1,-7],[-1,-7],[0,-7],[-1,-7],[-4,-7],[-4,-2],[-4,-1],[-5,-3],[-3,-6],[-2,-6],[-1,-7],[-1,-7],[-2,-8],[-3,-6],[-4,-5],[-4,-4]],[[4618,2281],[-16,28],[-50,59],[-9,15],[-35,29],[-28,24],[-19,11],[-10,6],[-7,4],[-7,3],[-5,4],[1,17],[7,2],[2,5],[-1,8],[-8,10],[-4,1],[-3,-6],[-2,3],[1,9],[-4,3],[-6,-1],[-2,-4],[1,-8],[-3,-1],[-2,4],[-3,4],[-4,-8],[-4,-6],[-4,13],[-11,8],[-5,6],[-28,11]],[[4350,2534],[0,12],[3,8],[5,6],[5,8],[3,13],[1,7],[4,3],[8,-2],[3,-3],[2,-5],[3,-3],[3,2],[0,4],[0,4],[0,4],[1,3],[2,4],[2,2],[3,3],[2,2],[4,4],[3,-1],[2,-4],[3,-4],[3,-1],[5,2],[4,3],[4,1],[3,1],[3,1],[3,2],[3,2],[6,7],[5,6],[5,3],[7,-1],[6,1],[3,6],[2,10],[3,11],[3,7],[5,4],[4,5],[2,10],[1,13],[2,9],[4,8],[6,10],[4,7],[4,6],[3,7],[4,6],[1,-2],[0,-2],[1,-3],[0,-2],[0,-3],[1,-2],[0,-3],[-1,-2],[8,-8],[8,-8],[9,-7],[8,-9],[5,-5],[6,-5],[6,-4],[6,-3],[7,-5],[5,-4],[6,2],[5,12],[4,2],[4,0],[5,0],[5,0],[8,8],[7,13],[7,13],[8,7],[4,-8],[3,-11],[2,-12],[3,-11],[3,-9],[5,-5],[6,-6],[4,-9],[1,-7],[2,-6],[2,-5],[3,-4],[2,-2],[4,-3],[4,-4],[1,-3],[0,-6],[-1,-6],[-2,-5],[-1,-6],[0,-9],[1,-11],[1,-11],[1,-9],[-2,-16],[-4,-21],[-3,-20],[1,-14],[5,-13],[4,-13],[3,-14],[2,-15]],[[5320,4015],[-6,-10],[-7,-11],[-6,-13],[-2,-13],[2,-13],[5,-12],[5,-11],[5,-12],[-2,-17],[-11,-15],[-13,-14],[-8,-17],[1,-20],[6,-18],[7,-16],[7,-17],[2,-11],[0,-10],[0,-11],[-2,-11],[-5,-15],[-7,-14],[-8,-12],[-8,-12],[-4,-4],[-4,-4],[-4,-2],[-5,-1],[-5,1],[-7,0],[-6,-1],[-4,-5],[-2,-6],[-2,-6],[-2,-7],[-3,-6],[-4,-6],[-5,-4],[-4,-5],[-3,-8],[-1,-5],[-2,-5],[-1,-5],[-2,-5],[-11,-20],[-9,-22],[-9,-23],[-9,-23],[-3,-9],[-4,-9],[-3,-9],[-3,-9],[-1,-3],[-1,-3],[-1,-3],[-1,-4],[-5,-15],[-4,-17],[-2,-17],[2,-17],[8,-13],[8,-11],[9,-11],[8,-14],[0,-1],[1,-2],[0,-2],[1,-1],[3,-23],[-5,-18],[-8,-15],[-9,-15],[-8,-17],[-6,-18],[-5,-19],[-1,-8]],[[5137,3215],[-6,-2],[-20,-16],[-6,-2],[-5,-1],[-5,-4],[-3,-1],[-6,6],[-9,5],[-3,1],[-6,-1],[-11,-5],[-15,-2],[-7,-3],[-24,-15],[-4,-5],[-2,-9],[-3,-3],[-21,-9],[-11,-18],[-7,-6],[-9,-3],[-16,-1],[-8,-3],[-5,-7],[-3,-6],[-4,-2],[-4,-1],[-2,-1],[-1,0],[-1,-1],[-2,-1],[-12,-5],[-12,-5],[-12,-5],[-12,-5],[-1,0],[-1,-1],[-1,-1],[-8,-3],[-12,-6],[-9,-9],[-2,-12],[0,-14],[1,-17],[2,-16],[6,-6],[2,-2],[2,-2],[1,-3],[1,-2],[4,0],[5,1],[4,2],[4,2],[2,1],[2,1],[2,1],[2,1],[7,2],[5,-4],[4,-6],[6,-5],[4,-1],[4,0],[4,0],[4,1],[4,0],[6,-2],[5,-1],[5,0],[2,-1],[1,-1],[1,-3],[1,-3],[0,-7],[-1,-9],[0,-8],[1,-4],[5,-3],[4,-4],[4,-4],[3,-5],[-1,-4],[-2,-3],[-2,-3],[-2,-3],[-8,-5],[-10,-1],[-7,-4],[-2,-17],[0,-10],[0,-11],[1,-11],[2,-10],[1,-7],[2,-7],[2,-6],[2,-5],[2,-2],[2,-1],[1,-2],[2,-2],[1,-6],[0,-6],[1,-6],[2,-6],[3,-7],[0,-9],[0,-9],[-1,-9],[-1,-4],[0,-5],[0,-4],[-1,-4],[1,-24],[12,-4],[16,6],[13,7],[3,-1],[1,-2],[2,-3],[0,-4],[1,-7],[2,-10],[1,-10],[3,-6],[3,-3],[4,-2],[2,-2],[-1,-8],[-4,-5],[-4,-6],[-4,-7],[-3,-7],[-1,-4],[1,-4],[1,-4],[-1,-3],[-2,-4],[-1,-4],[-2,-4],[-2,-4],[-3,-8],[-5,-12],[-4,-9],[-5,-5],[-2,1],[-1,3],[0,3],[-1,3],[-6,5],[-8,4],[-7,1],[-6,-4],[-2,-3],[-2,-5],[-1,-4],[-2,-1],[-4,-1],[-4,-2],[-4,-1],[-4,-2],[-6,-4],[-7,-4],[-6,-6],[-5,-8],[-5,-13],[-3,-16],[-3,-15],[-4,-13],[-7,-8],[-8,-7],[-9,-4],[-8,-4],[-5,-3],[-4,-4],[-4,-4],[-4,-3],[-1,-4],[-1,-6],[0,-6],[-1,-5],[-5,-8],[-6,5],[-5,12],[-4,10],[-5,7],[-5,-1],[-5,-1],[-4,9],[-4,10],[-4,4],[-5,-3],[-5,-9],[-2,-7],[-3,-9],[-3,-8],[-3,-6],[-5,-2],[-6,0],[-7,1],[-6,0],[-4,0],[-5,0],[-4,-2],[-4,-3]],[[4350,2534],[-14,5],[-12,10],[-3,3],[-2,6],[-1,8],[-2,1],[-4,0],[-3,1],[-3,3],[0,4],[-1,2],[-3,2],[-2,0],[-9,-4],[-7,0],[-2,2],[1,15],[2,15],[-1,7],[-5,2],[-3,-1],[-5,-5],[-2,-1],[-3,1],[-3,1],[-2,-1],[-2,-5],[-25,21],[-11,14],[-7,14],[-4,26],[-3,11],[-10,7],[0,4],[1,11],[0,6],[-2,4],[-2,3],[-2,4],[-1,30],[-9,14],[-4,0],[-4,-2],[-3,1],[-6,10],[-6,7],[-19,28],[-15,29],[-17,47],[-9,16],[-3,11],[-3,6],[-9,14],[-4,9],[-8,24],[-19,45],[-2,11],[0,6],[-3,10],[-1,6],[0,24],[-3,37],[-1,9],[-3,5],[-5,6],[-3,4],[-5,15],[-6,15],[-9,7],[-6,22],[-5,18],[-2,12],[4,9],[34,35],[15,3],[22,0],[4,2],[6,5],[22,4],[9,1],[9,10],[4,9],[7,5],[3,7],[4,7],[2,10],[1,19],[-6,11],[-10,8],[-2,8]],[[4129,3379],[4,3],[4,5],[6,17],[8,17],[8,16],[7,18],[7,19],[8,18],[10,15],[12,10],[4,1],[2,-4],[0,-5],[2,-2],[1,-1],[2,1],[2,2],[1,2],[3,1],[3,0],[3,-1],[3,-1],[16,4],[14,15],[13,18],[13,15],[3,1],[3,1],[3,-1],[3,0],[6,-3],[4,-2],[3,-4],[4,-6],[3,-4],[3,-4],[2,-4],[3,-4],[5,-8],[5,-8],[6,-6],[7,-2],[9,0],[8,-1],[7,-6],[6,-14],[4,-12],[4,-9],[5,-7],[6,-7],[7,-6],[7,-7],[6,-8],[4,-11],[4,-9],[7,-6],[8,-7],[7,-7],[0,4],[1,4],[0,4],[0,4],[0,8],[0,9],[0,9],[0,9],[1,18],[2,16],[4,15],[5,15],[1,6],[2,5],[2,5],[1,5],[4,10],[1,11],[1,12],[0,12],[0,2],[0,3],[1,2],[0,2],[-1,10],[-1,11],[0,11],[-2,9],[-2,13],[-1,10],[3,7],[4,9],[2,1],[11,2],[25,1],[7,2],[6,6],[18,28],[5,9],[2,10],[0,23],[2,10],[3,6],[-2,2],[-19,16],[-21,20],[-21,20],[-21,21],[7,14],[6,14],[4,15],[2,18],[1,9],[1,9],[2,8],[1,9],[3,10],[4,17],[4,15],[1,8],[-9,19],[-9,18],[-9,18],[-10,18],[-12,19],[-13,18],[-12,18],[-13,18],[-6,11],[-2,9],[2,10],[3,15],[5,19],[4,18],[4,18],[4,18]],[[5710,3119],[15,-12],[12,-26],[7,-32],[0,-30],[0,-4],[0,-3],[0,-4],[0,-3],[0,-15],[3,-10],[6,-7],[8,-5]],[[5761,2968],[-1,-7],[0,-7],[-1,-7],[-1,-7],[-2,-10],[-1,-9],[-2,-9],[-1,-9],[-2,-9],[-1,-9],[-2,-9],[-1,-8],[0,-7],[1,-7],[1,-6],[0,-6],[-2,-6],[-1,-6],[-1,-6],[-2,-6],[-1,-5],[-1,-4],[-1,-4],[0,-5],[-2,-9],[-2,-10],[-1,-9],[-2,-10],[1,-4],[1,-5],[1,-5],[1,-5],[1,-2],[0,-2],[0,-1],[1,-2],[2,-10],[2,-10],[3,-9],[3,-8],[6,-8],[-4,-9],[-8,-7],[-5,-5],[-9,-8],[-8,-8],[-8,-8],[-8,-8],[-2,-2],[-2,-3],[-2,-2],[-2,-2],[1,-5],[2,-5],[2,-5],[2,-5],[0,-1],[1,-1],[0,-1],[1,-1],[1,-6],[-1,-5],[-2,-5],[-3,-6],[-4,-8],[-4,-9],[-4,-9],[-4,-8],[-2,-6],[-3,-5],[-2,-6],[-3,-5],[-3,-8],[-3,-7],[-4,-8],[-3,-7],[-3,-7],[-3,-6],[-4,-7],[-3,-6],[-4,-5],[-4,-6],[-3,-7],[-2,-7],[-1,-8],[0,-8],[-1,-6],[-3,-5],[-4,-2],[-5,-5],[-4,-6],[-2,-6],[-2,-4],[-1,-1],[-2,1],[-2,-1],[-1,-4],[-1,-4],[-1,-4],[-2,-3]],[[5603,2380],[-3,-4],[-3,-6],[-3,-5],[0,-5],[-1,-6],[-3,-6],[-3,-6],[-3,-4],[-2,12],[-3,13],[-4,9],[-7,1],[-5,-5],[-4,-9],[-4,-9],[-4,-8],[0,-10],[5,-9],[5,-9],[3,-9],[-1,-12],[-4,-7],[-3,-8],[1,-14],[3,-12],[3,-12],[1,-11],[1,-14],[-1,-14],[2,-11],[3,-10],[6,-8],[8,-10],[9,-10],[8,-10],[7,-11],[3,-10],[-1,-11],[-5,-12],[-4,-11],[-2,9],[-4,2],[-1,0],[-11,-18],[-6,12],[-3,8],[-1,9],[2,7],[4,4],[3,5],[0,5],[-1,8],[-1,6],[-1,2],[-1,1],[-3,2],[-2,1],[0,-2],[-2,-8],[0,-1],[-4,2],[-5,5],[-5,6],[-10,20],[-5,3],[-33,2],[4,-9],[-3,-5],[-10,-6],[-2,14],[-2,6],[-1,3],[-5,-1],[-2,-1],[-1,-1],[-1,3],[-1,9],[0,3],[-8,5],[-7,0],[-15,-5],[-51,5],[-8,-7],[-16,-6],[-17,-8],[-16,-8],[-17,-4],[-8,0],[-6,4],[-7,5],[-6,6],[-5,7],[-3,8],[-2,8],[-3,8],[-4,7],[-5,3],[-5,2],[-5,0],[-12,2],[-14,2],[-13,-1],[-12,-7],[-13,-29],[-4,-36],[2,-38],[4,-38],[-1,-14],[-3,-12],[-6,-11],[-5,-12],[-1,-5],[0,-4],[-2,-3],[-3,-2],[-3,0],[-3,1],[-3,1],[-3,0],[-5,-6],[-4,-1],[-5,1],[-5,0],[-5,-1],[-5,-3],[-5,-2],[-6,0],[-6,0],[-3,0],[-2,-3],[-3,-6],[-3,-5],[-1,-4],[-1,-5],[-1,-5],[-2,-15],[-1,-17],[0,-16],[0,-16],[2,-9],[3,-9],[3,-8],[1,-8],[-2,-5],[-1,-6],[-2,-6],[-1,-2],[0,-1]],[[5115,1858],[-2,-3],[-5,0],[-12,9],[-19,16],[-42,20],[-17,11],[-12,1],[-26,16],[-30,4],[-16,6],[-43,30],[-30,24],[-16,11],[-11,1],[-17,3],[-4,7],[-5,-2],[-25,18],[-6,-1],[-17,9],[-5,6],[-11,6],[-6,-2],[-5,6],[-14,14],[-24,17],[-8,23],[-16,64],[-11,21],[-3,3],[-3,7],[-5,6],[-5,6],[-10,10],[-5,1],[-1,6],[8,15],[-4,14],[-11,16],[-3,4]],[[5137,3215],[33,9],[-5,-21],[-2,-12],[3,-5],[5,4],[3,15],[5,4],[5,-6],[2,-12],[4,-51],[1,-2],[1,-2],[2,-2],[2,-14],[2,-6],[4,-3],[8,0],[3,1],[3,5],[3,1],[3,-1],[5,-5],[2,-1],[3,1],[3,5],[3,1],[3,0],[9,-4],[11,0],[5,-1],[5,-6],[3,7],[8,17],[2,8],[1,4],[3,8],[1,5],[0,5],[0,6],[0,5],[1,5],[2,1],[11,1],[3,1],[6,5],[3,1],[6,0],[11,-2],[6,2],[-1,-7],[1,-5],[3,-3],[4,0],[5,-2],[7,-3],[6,-6],[2,-10],[-3,-8],[-6,-4],[-6,-5],[-3,-8],[1,-4],[2,-3],[2,-2],[2,-4],[0,-4],[0,-3],[-1,-3],[-1,-4],[0,-2],[-2,-2],[0,-2],[1,-3],[2,-2],[1,-3],[1,-4],[0,-3],[-1,-16],[-3,-16],[1,-14],[8,-8],[3,1],[3,3],[3,3],[3,2],[2,-1],[3,-3],[2,-3],[3,-1],[4,0],[4,2],[4,2],[4,-1],[5,-5],[7,-4],[7,0],[6,3],[4,10],[2,14],[3,13],[8,3],[3,-5],[4,-5],[4,-2],[4,2],[7,5],[8,1],[8,-2],[6,-4],[2,-3],[0,-5],[-1,-4],[0,-5],[1,-2],[1,-2],[1,-2],[1,-3],[-1,-10],[-6,-5],[-7,-4],[-5,-9],[2,-13],[7,-9],[9,-6],[7,-4],[6,-4],[5,-1],[5,1],[5,2],[8,4],[5,4],[4,7],[5,10],[2,-6],[4,-4],[3,-4],[2,-6],[2,-11],[4,-5],[6,0],[7,-1],[1,11],[1,5],[4,2],[6,0],[6,0],[5,1],[6,0],[5,0],[6,1],[7,2],[8,0],[5,-3],[1,-6],[-1,-6],[0,-5],[4,-3],[4,2],[3,8],[2,10],[4,6],[7,3],[8,2],[7,0],[8,1],[5,6],[0,17],[-3,19],[-3,13],[0,6],[1,5],[2,6],[1,3],[0,2],[-1,2],[-1,3],[2,3],[2,1],[2,0],[3,-1],[2,-1],[3,3],[3,7],[2,8],[2,5],[3,9],[2,7],[3,6],[5,8]],[[3832,3737],[2,-2],[1,-2],[-1,-11],[0,-10],[-3,3],[-4,-3],[-7,6],[-3,7],[6,11],[6,-1],[3,2]],[[3767,3825],[4,-4],[7,-2],[5,-1],[5,-1],[0,-5],[3,-4],[0,-5],[-6,-5],[-1,-8],[-1,-6],[-5,1],[-8,7],[-5,1],[-5,6],[-6,2],[-4,9],[6,8],[4,7],[4,-1],[3,1]],[[3703,3936],[6,-4],[7,1],[4,-4],[12,-9],[5,-6],[-1,-5],[-1,-7],[4,-6],[3,-4],[1,-5],[2,-2],[1,-1],[-2,-3],[-2,-5],[1,-5],[1,-4],[-3,-2],[0,-3],[-2,-3],[-2,-4],[0,-5],[-1,2],[-2,-1],[1,3],[1,4],[-3,3],[-2,1],[-12,8],[-13,13],[0,2],[1,2],[0,5],[-2,5],[-2,7],[-3,7],[-2,3],[2,3],[0,5],[0,7],[-3,5],[6,2]],[[3696,3980],[0,-4],[2,-2],[0,-7],[-2,-4],[2,-4],[-7,-7],[-3,11],[1,8],[2,8],[2,-2],[3,3]],[[4129,3379],[-6,23],[-10,15],[-6,5],[-3,-5],[-6,-8],[-7,-3],[-9,8],[-12,1],[-11,11],[-6,-8],[-4,7],[3,5],[4,6],[3,0],[3,-2],[5,6],[4,13],[3,8],[2,12],[1,6],[2,3],[3,-1],[5,10],[7,22],[10,14],[4,2],[2,7],[6,8],[2,10],[2,8],[3,7],[4,2],[2,-4],[4,0],[3,-1],[6,10],[5,10],[1,16],[0,15],[-2,7],[3,14],[-1,15],[5,12],[-3,43],[-6,32],[4,26],[4,10],[5,15],[6,5],[-1,6],[-3,10],[-1,11],[-3,8],[-3,6],[-4,4],[-4,1],[-2,-7],[-4,0],[-6,8],[-12,9],[-22,25],[-8,6],[-10,17],[-5,22],[-27,87],[-27,69],[-5,20],[-2,31],[3,78],[-3,37],[-8,49],[-8,42],[-4,28],[-4,17],[2,3]],[[8476,2323],[0,-8],[-1,2],[-1,2],[-7,-8],[-4,-3],[-4,-1],[1,5],[2,3],[2,2],[3,2],[-6,-1],[-11,-8],[-5,1],[-12,-29],[-9,-13],[-11,-3],[7,19],[-17,-17],[-10,-7],[-9,-3],[-6,0],[-3,1],[2,4],[5,9],[3,3],[14,10],[9,3],[17,16],[12,13],[15,9],[14,11],[5,0],[2,-4],[2,-4],[1,-6]],[[9142,2810],[13,-32],[17,-25],[21,-22],[37,-57],[31,-63],[8,-40],[-3,-34],[1,-40],[-1,-8],[0,-19],[-4,-14],[-15,-26],[2,-41],[-10,-108],[2,-32],[11,-24],[2,-28],[-4,-8],[-1,-10],[5,-3],[5,-4],[-1,-13],[-3,-12],[-1,-12],[6,-49],[2,-39],[0,-34],[-7,-33],[-27,-53],[-4,-9],[3,-44]],[[9227,1874],[-3,-5],[-2,-22],[0,-48],[-69,0],[-70,0],[-69,0],[-69,0],[-70,0],[-69,0],[-70,1],[-69,0],[-14,0],[-6,-3],[-3,-5]],[[8644,1792],[0,27],[0,27],[0,27],[0,10],[-19,2],[-9,0],[-9,1],[-5,2],[-2,3],[-2,5],[-4,5],[-6,4],[-6,1],[-6,-1],[-6,0],[-6,2],[-6,6],[-6,7],[-5,6],[-5,7],[-5,5],[-6,3],[-7,1],[-6,1],[-5,2],[-5,4],[-6,3],[-4,2],[-3,2],[-4,1],[-4,1],[-7,0],[-9,1],[-9,-1],[-6,-3],[-1,-3],[-2,-5],[-1,-6],[-1,-3],[0,-6],[0,-6],[1,-6],[0,-5],[-1,-9],[-3,-14],[-4,-12],[-2,-6],[-16,0],[-15,0],[-15,0],[-16,0],[-10,1],[-10,8],[-9,10],[-9,9],[-5,5],[-2,8],[-1,9],[-6,6],[-5,2],[-4,4],[-4,4],[-4,4],[-8,9],[-7,10],[-7,10],[-8,8],[-4,13],[-1,21],[1,23],[1,16],[0,26],[0,25],[0,25],[1,25],[-15,-1],[-15,-1],[-15,0],[-14,3],[-3,0],[-2,-2],[-2,-2],[-3,3],[-3,3],[-3,3],[-2,4],[-3,3],[-5,10],[-2,13],[-2,14],[-2,13],[-4,10],[-5,10],[-3,10],[-2,11]],[[8174,2259],[24,11],[35,3],[34,6],[40,8],[25,-2],[10,-4],[9,-16],[17,-18],[2,-4],[0,-6],[-2,-7],[-3,-4],[-4,-2],[1,4],[1,4],[-3,-3],[-4,-1],[-9,0],[-3,2],[0,6],[2,7],[-2,4],[-3,0],[-1,-1],[-7,-8],[-1,-1],[-2,2],[-2,1],[-5,-2],[-1,-3],[2,-3],[5,0],[0,-4],[-4,-2],[-4,0],[-4,1],[-4,5],[1,-3],[0,-3],[1,-2],[1,-3],[-3,-4],[-2,-4],[-1,-5],[-1,-6],[2,2],[5,5],[5,-7],[4,-3],[4,-1],[7,3],[4,1],[2,-2],[2,-7],[5,-7],[6,-4],[6,-3],[-8,11],[-9,9],[-7,11],[-2,18],[7,-5],[3,-5],[4,-2],[8,5],[-4,-12],[4,-2],[4,-4],[3,-6],[2,-7],[-5,4],[0,-2],[0,-1],[-1,-1],[-1,0],[6,-6],[12,-6],[4,-7],[-1,-7],[-8,-16],[-2,-9],[2,-7],[6,-9],[6,-8],[4,-2],[3,9],[-1,8],[-3,8],[-2,11],[3,-5],[3,-2],[3,-1],[4,0],[-3,8],[-5,7],[-3,7],[2,8],[8,-7],[20,-8],[9,-7],[6,3],[14,-6],[8,-1],[16,3],[7,3],[5,5],[1,-8],[2,-5],[3,-2],[3,4],[0,6],[-2,17],[0,7],[-2,0],[-1,-3],[-1,-4],[-1,-4],[-3,0],[-8,-7],[-2,3],[2,6],[7,13],[2,4],[8,7],[18,11],[9,8],[5,-3],[5,2],[6,4],[3,5],[3,6],[5,17],[2,3],[11,-1],[5,0],[2,3],[3,6],[12,6],[5,5],[-5,4],[-5,-1],[-7,-7],[-15,-7],[-5,-4],[10,42],[1,17],[-7,16],[-5,9],[-3,2],[-3,0],[-4,-1],[-1,-4],[-1,-3],[-2,-3],[-6,3],[-9,20],[-6,4],[4,13],[6,12],[8,9],[14,8],[10,12],[9,14],[5,11],[-8,-3],[-20,-27],[-21,-17],[-8,-12],[1,-13],[-3,-3],[-2,3],[-7,-8],[-4,-2],[-6,-1],[-6,2],[-1,3],[7,15],[16,20],[21,19],[27,28],[37,28],[26,39],[7,6],[14,9],[25,27],[25,53],[6,7],[11,6],[10,15],[9,18],[4,18],[5,107],[3,23],[0,12],[0,12],[-2,9],[0,9],[2,13],[6,23],[6,16],[19,21],[28,34],[12,22],[3,23],[2,8],[0,9],[-1,10],[-10,30],[-1,6],[0,5],[1,11],[0,42],[3,28],[0,31],[0,12],[4,31],[0,22],[-4,45],[0,24],[7,46],[2,54],[3,14],[18,34],[4,11]],[[8837,3455],[0,-16],[-4,-136],[6,-16],[15,-2],[16,0],[13,-3],[8,-15],[5,-20],[8,-11],[6,5],[6,3],[6,-9],[5,-9],[10,3],[6,21],[8,9],[13,-29],[5,-15],[0,-13],[6,-22],[5,-9],[18,-21],[12,-33],[7,-40],[17,-27],[21,-14],[19,-24],[23,-71],[18,-29],[14,-33],[4,-39],[9,-30]],[[7734,1433],[3,-14],[0,-15],[-1,-16],[0,-15],[0,-4],[0,-4],[0,-4],[0,-4],[-8,3],[-4,-9],[-1,-15],[1,-14],[0,-8],[0,-12],[0,-11],[-2,-6],[-4,-5],[-5,-5],[-4,-5],[-5,-4],[-5,-5],[-7,-7],[-7,-6],[-4,-7],[-1,-11],[1,-15],[1,-15],[1,-12],[1,-12],[-1,-11],[-1,-11],[-3,-11],[-8,-18],[-10,-22],[-6,-23],[3,-22],[3,-9],[3,-10],[2,-11],[3,-10],[4,-15],[5,-18],[4,-18],[1,-16],[-1,-11],[-1,-10],[-1,-11],[-2,-9],[-3,-8],[-3,-7],[-2,-7],[-2,-6]],[[7668,882],[-6,8],[-4,9],[-2,7],[-2,16],[-5,3],[-6,-4],[-7,-6],[-13,-3],[-13,7],[-13,12],[-10,14],[-8,13],[-4,5],[-7,1],[-5,-3],[-1,-8],[1,-10],[0,-9],[-2,0],[-3,3],[-2,-2],[1,-3],[3,-2],[3,-1],[0,-3],[-2,-3],[-5,0],[29,-33],[17,-12],[8,4],[-23,15],[0,3],[8,-1],[13,-8],[6,-2],[8,1],[3,-1],[5,-4],[11,-11],[0,-4],[-5,0],[0,-4],[23,-8],[6,-3]],[[7665,855],[-7,-23]],[[7658,832],[-72,49],[-5,6],[-11,11],[-15,5],[-29,1],[2,0],[-17,1],[-8,2],[-5,5],[-6,-4],[-6,-1],[-13,1],[-7,2],[-2,5],[2,7],[4,5],[27,14],[12,15],[2,24],[-3,6],[-13,6],[-5,5],[-2,3],[-3,1],[-2,-1],[-2,-1],[-2,-9],[0,-3],[-2,-1],[-4,-2],[-1,-1],[-4,-5],[-2,-4],[1,-2],[-9,-8],[-5,-2],[-5,-14],[-4,-6],[-4,10],[-1,6],[0,6],[4,6],[5,4],[2,6],[-3,9],[-5,8],[-1,6],[0,6],[-2,8],[-2,5],[-4,6],[-4,6],[-4,2],[-8,-2],[-7,-7],[-7,-9],[-13,-34],[-4,-4],[-18,0],[2,-10],[-3,-3],[-3,-1],[-2,-3],[-4,-10],[0,-5],[7,-4],[14,-6],[11,-2],[10,2],[9,1],[4,0],[7,3],[3,4],[5,10],[3,1],[2,-8],[-10,-8],[-13,-5],[-9,-2],[10,-5],[29,2],[9,-6],[5,-13],[-2,-3],[-16,9],[-25,-1],[-16,-6],[-14,-3],[-8,-3],[-15,-4],[-12,1],[-6,2],[-4,0],[-5,-1],[-2,-3],[1,-3],[1,-4],[-3,-3],[-9,2],[-3,-5],[-6,0],[-5,0],[-4,-6],[-1,-7],[-6,-3],[-4,-5],[0,-6],[-1,-2],[-4,-2],[-3,-4],[-10,-3],[-5,-5],[-8,-18],[2,-11],[-4,-3],[-5,-7],[-8,-5],[-1,-8],[-2,-5],[-18,-1],[-1,-5],[-24,-4],[-3,-7],[-9,-2],[-2,-7],[-15,-10],[-13,-1],[-9,-3],[-7,-2],[-5,-5],[-2,-3],[0,-7],[-7,-1],[-7,-3],[-8,-4],[-10,-4],[-3,-4],[-23,-9],[-2,-5],[-11,-5],[-9,-9],[-7,-3],[-8,-9],[-4,-1],[-2,-4],[-3,-2],[-3,2],[-4,-5],[1,-8],[-25,-19],[-10,-11],[-16,1],[-23,-1],[-13,4],[-9,3],[-5,-8],[-8,-5],[-5,-7],[-6,-1],[-6,1],[-8,2],[-2,-3],[-18,12],[-21,16],[-39,13],[-13,0],[-27,28],[-19,9],[-10,4],[-9,12],[2,2],[-6,15],[-4,-2],[-8,7],[-19,19],[-14,9],[-19,9],[-6,0],[-19,5],[-7,-6],[-29,6],[-22,13],[-9,-4],[-18,8],[-14,0],[-4,-4],[-3,-4],[-12,4],[-17,6],[-6,4],[-6,9],[-8,4],[-3,5],[-3,3],[-2,2],[-5,6],[-21,26],[-12,12],[-33,31],[-11,6],[-10,8],[-6,10],[19,-9],[9,-2],[5,8],[-5,-1],[-4,5],[-5,4],[-4,-5],[-6,5],[-7,3],[0,1],[-1,2],[-1,3],[-2,1],[0,-1],[-1,-3],[-3,-2],[-2,-1],[-6,1],[-31,17],[-41,12],[-20,13],[-8,5],[-4,1],[-2,1],[-1,2]],[[6256,975],[1,2],[5,9],[5,7],[7,5],[8,3],[9,2],[8,0],[8,2],[8,7],[8,14],[7,15],[2,16],[-5,19],[-5,13],[0,12],[4,11],[8,6],[6,0],[5,-3],[5,-1],[7,4],[0,2],[1,1],[1,2],[0,1],[3,16],[-1,16],[-3,15],[-3,16],[5,2],[3,1],[4,0],[4,-2],[5,-1],[5,1],[4,3],[4,5],[2,1],[2,1],[2,2],[1,3],[1,2],[1,2],[0,2],[1,2],[4,5],[3,6],[2,7],[1,10],[1,9],[1,10],[1,10],[1,10],[0,7],[0,6],[0,5],[1,5],[3,7],[3,7],[3,7],[2,8],[2,5],[1,6],[2,6],[0,6],[1,6],[-1,6],[-1,5],[-2,6],[-9,22],[-9,21],[-10,21],[-11,21],[-1,2],[-1,2],[-1,2],[-1,2],[-4,2],[-4,1],[-5,-1],[-4,0],[-8,2],[-5,13],[-4,15],[-5,12],[-6,3],[-6,4],[-4,5],[-2,11],[1,12],[2,10],[1,11],[-3,11],[-1,1],[0,1],[0,1],[-1,1],[1,7],[2,8],[0,7],[-1,8],[-2,4],[-2,4],[-2,4],[-2,4],[-1,1],[-1,2],[0,1],[-1,1],[-1,1],[-1,2],[-1,1],[-1,2],[-1,8],[-1,7],[1,7],[3,6],[2,3],[0,3],[-1,3],[-2,2],[-5,10],[0,13],[1,14],[2,14],[0,7],[2,7],[1,7],[1,8],[1,10],[2,11],[1,10],[2,10],[4,13],[2,9],[-1,8],[-6,11]],[[6321,1842],[2,2],[2,2],[1,2],[2,2],[1,2],[2,3],[1,2],[1,2],[3,-2],[3,-2],[2,-2],[3,-1],[11,2],[8,13],[7,19],[4,18],[3,7],[3,3],[4,1],[5,0],[2,0],[3,0],[3,0],[3,0],[5,0],[5,-1],[5,0],[6,-1],[3,0],[3,0],[3,0],[3,1],[2,1],[3,1],[3,1],[3,1],[3,1],[4,1],[4,1],[3,-2],[2,-6],[1,-7],[1,-9],[0,-6],[1,-4],[0,-4],[1,-4],[0,-4],[2,-8],[2,-8],[3,-4],[5,-1],[4,3],[4,3],[4,3],[4,2],[4,4],[3,5],[3,5],[4,6],[3,4],[2,4],[3,5],[2,6],[0,5],[-1,5],[0,5],[-1,6],[-3,6],[-3,7],[-3,6],[-3,6],[-1,1],[-1,1],[-1,1],[-1,0],[-4,6],[-4,8],[-1,9],[2,10],[2,7],[2,6],[3,6],[2,7],[3,9],[3,9],[3,9],[3,9],[3,9],[3,10],[4,7],[4,-2],[9,4],[11,16],[10,7],[0,-22],[-4,-18],[-5,-24],[-3,-23],[1,-17],[4,-8],[4,-6],[6,-5],[5,-4],[3,-4],[2,-3],[3,-3],[3,-3],[3,-6],[0,-8],[0,-8],[1,-8],[2,-7],[3,-5],[2,-6],[3,-7],[2,-6],[4,-5],[4,-3],[5,-1],[5,2],[3,4],[3,7],[2,8],[7,28],[11,24],[13,19],[17,12],[1,0],[0,1],[1,0],[1,0],[7,2],[6,2],[7,0],[6,-4],[6,-5],[5,-4],[5,-3],[5,-3],[1,0],[1,0],[1,0],[10,-6],[11,-5],[10,1],[8,11],[2,4],[2,4],[1,4],[1,4],[0,1],[1,1],[0,1],[0,1],[2,3],[1,3],[2,3],[1,4],[2,2],[1,3],[2,2],[1,2],[1,2],[1,2],[1,2],[1,2],[5,5],[4,4],[5,2],[5,3],[3,1],[2,2],[2,2],[1,2],[7,6],[3,9],[3,10],[3,11],[3,11],[3,9],[3,9],[1,11]],[[6833,2127],[1,2],[1,2],[2,2],[1,3],[7,13],[8,14],[6,16],[4,17],[-1,19],[-3,19],[-4,19],[-2,16],[3,-4],[2,-4],[3,-3],[2,-4],[11,-16],[11,-11],[12,-7],[14,-5],[10,-4],[7,-5],[5,-8],[3,-14],[3,-23],[5,-24],[6,-23],[9,-17],[2,-3],[2,-3],[3,-3],[2,-2],[5,-5],[4,-7],[4,-8],[3,-9],[2,-14],[2,-16],[3,-15],[3,-4],[1,-1],[2,-2],[1,-2],[4,0],[4,2],[3,-2],[1,-4],[-1,-5],[0,-5],[3,-6],[4,-3],[4,-2],[4,0],[4,2],[2,3],[4,9],[3,3],[3,1],[7,-2],[4,-3],[5,-1],[4,0],[5,-1],[1,1],[1,0],[3,2],[3,0],[4,-1],[3,-2],[3,-3],[4,-3],[3,-2],[4,-2],[3,-1],[2,-1],[3,-1],[3,-1],[2,-1],[3,-2],[2,-2],[2,-3],[6,-15],[4,-18],[4,-19],[6,-17],[-6,-26],[-9,-22],[-10,-20],[-11,-21],[-1,-2],[-1,-3],[-1,-2],[0,-3],[-4,-17],[1,-15],[3,-15],[5,-17],[7,-22],[7,-22],[6,-22],[7,-23],[4,-8],[4,-3],[6,-3],[6,-3],[1,-1],[1,-1],[1,0],[1,1],[7,3],[6,6],[6,3],[7,0],[4,-3],[4,-3],[4,1],[4,8],[3,0],[3,1],[2,1],[1,4],[0,3],[0,3],[1,2],[2,1],[5,4],[5,6],[5,5],[4,1],[4,2],[3,6],[2,7],[3,5],[6,7],[7,2],[7,1],[8,0],[-1,4],[1,2],[1,1],[1,3],[9,2],[6,5],[4,8],[4,12],[2,3],[4,-1],[3,-4],[3,-1],[3,2],[-2,4],[-1,5],[1,3],[3,0],[3,1],[3,1],[2,0],[2,-5],[1,-7],[0,-8],[-1,-7],[0,-4],[0,-6],[-1,-6],[0,-4],[-3,-3],[-3,-2],[-3,-2],[-3,-3],[-2,-6],[-1,-7],[0,-6],[-1,-7],[10,-18],[9,-19],[10,-19],[10,-17],[5,-7],[4,-8],[5,-8],[4,-9],[7,-4],[9,-6],[8,-7],[4,-10],[1,-4],[0,-4],[1,-4],[0,-5],[-1,-1],[-1,-1],[-1,-2],[-1,-2],[2,-9],[1,-8],[2,-9],[1,-9],[11,-11],[20,-5],[23,-1],[15,0],[11,-2],[11,-1],[11,-1],[10,-2],[10,-1],[9,-1],[10,-2],[9,-1],[50,-5],[49,-5],[49,-5],[49,-5]],[[6321,1842],[-4,8],[-4,7],[-5,8],[-4,8],[-4,6],[-4,2],[-3,0],[-6,-2],[-10,-4],[-10,-2],[-11,1],[-10,4],[-3,2],[-3,1],[-3,3],[-3,2],[-6,2],[-7,3],[-6,2],[-6,3],[-15,10],[-12,14],[-8,19],[-5,26],[-3,3],[-7,2],[-8,2],[-6,1],[-4,5],[-2,9],[-1,11],[0,10],[-4,3],[-4,-4],[-5,-4],[-5,5],[-3,6],[-2,6],[0,7],[0,8],[-2,-1],[-3,-1],[-2,0],[-2,-1],[0,8],[-2,7],[-2,6],[-1,7],[-1,8],[1,9],[0,8],[-1,9]],[[6100,2094],[7,9],[6,6],[7,5],[9,3],[5,6],[2,9],[2,10],[5,6],[0,1],[1,0],[3,2],[3,5],[1,5],[3,4],[4,3],[4,2],[5,1],[4,2],[5,0],[6,-3],[6,-5],[4,-6],[6,-9],[7,-10],[7,-6],[6,2],[0,7],[-1,11],[-2,11],[-1,9],[-2,12],[-3,13],[-3,12],[-4,10],[0,2],[0,1],[-1,1],[0,2],[-1,8],[-1,8],[-1,9],[-1,8],[-1,5],[-1,6],[0,5],[-1,6],[6,-2],[7,-2],[6,-1],[6,1],[1,2],[1,2],[0,3],[0,2],[-1,8],[-3,8],[-2,7],[-3,7],[-1,1],[-1,2],[-1,1],[-1,1],[-1,3],[-1,3],[0,4],[1,3],[0,2],[0,1],[0,2],[0,1],[-2,1],[-2,2],[-2,2],[-1,2],[4,9],[4,10],[4,9],[6,8],[5,8],[-1,7],[-4,9],[0,11],[2,3],[2,-1],[2,1],[2,7],[0,9],[0,9],[1,9],[0,8]],[[6227,2464],[0,2],[1,2],[0,2],[0,2],[1,5],[0,5],[-1,4],[-2,4],[-1,6],[-1,8],[1,9],[0,7],[0,4],[0,5],[0,5],[1,5],[0,6],[1,4],[2,4],[2,3],[0,7],[0,6],[-1,7],[0,7],[-1,8],[-1,7],[-1,8],[-1,8],[0,1],[0,1],[0,2],[0,1],[-3,14],[-2,17],[-2,16],[2,14],[2,7],[1,7],[2,6],[3,6]],[[6229,2706],[9,-4],[10,-6],[10,-4],[9,2],[5,5],[4,2],[3,-2],[5,-6],[1,-2],[0,-2],[0,-2],[0,-2],[1,-7],[1,-7],[2,-6],[2,-6],[2,-6],[1,-7],[1,-5],[2,-4],[1,-1],[1,-1],[1,0],[1,-1],[5,-6],[4,-7],[3,-8],[2,-9],[1,-4],[1,-4],[1,-4],[1,-4],[1,-4],[2,-3],[1,-4],[2,-3],[2,-3],[2,-3],[3,-2],[2,-3],[1,0],[0,-1],[1,0],[0,-1],[1,-1],[2,-1],[1,-2],[1,-1],[1,-2],[1,-1],[1,-1],[1,-2],[1,-1],[1,-2],[1,-2],[2,-2],[0,-1],[1,0],[0,-1],[1,-1],[0,-1],[1,0],[0,-2],[3,-6],[2,-6],[3,-6],[2,-6],[7,-3],[7,3],[6,6],[7,2],[7,5],[7,12],[6,15],[5,13],[3,-1],[3,-2],[3,-2],[3,-2],[1,-1],[2,-1],[1,-1],[1,-1],[2,-1],[2,-2],[2,-1],[1,-1],[8,-6],[7,-5],[7,-2],[7,6],[2,4],[3,3],[3,4],[2,4],[2,10],[-4,9],[-5,9],[-3,10],[0,1],[0,1],[2,6],[3,4],[4,2],[3,2],[2,3],[1,3],[1,3],[2,2],[7,-4],[9,-4],[9,-1],[6,5],[0,-1],[0,-1],[1,-1],[0,-1],[9,-8],[9,1],[9,7],[6,12],[3,15],[-3,10],[-6,5],[-9,-2],[-4,2],[-4,4],[-3,5],[-4,5],[-3,7],[-3,7],[-4,7],[-4,6],[-5,5],[-6,0],[-5,-4],[-6,-5],[-5,-2],[-2,6],[-1,10],[-2,7],[-3,1],[-2,2],[-1,4],[0,5],[1,6],[2,1],[3,0],[3,2],[3,14],[-9,9],[-13,6],[-9,6],[-5,7],[-4,8],[-4,7],[-6,4],[-6,2],[-5,2],[-2,6],[4,9],[0,16],[-4,15],[-6,7],[-4,-8],[1,-10],[1,-7],[-2,-5],[-5,-3],[-4,0],[-4,0],[-5,0],[-4,1]],[[6386,2822],[-8,18],[-8,22],[-8,23],[-8,21],[-2,13],[2,12],[4,12],[5,12],[1,2],[1,2],[1,2],[1,2],[2,6],[3,6],[2,5],[3,6],[2,17],[3,14],[4,12],[8,11],[5,9],[0,9],[-3,9],[-3,10],[0,5],[0,5],[0,5],[0,5],[-4,21],[-8,6],[-11,-3],[-11,-8],[-3,-1],[-2,1],[-2,3],[-2,4],[-4,4],[-1,5],[-1,6],[3,5],[2,9],[1,10],[2,9],[5,7],[1,0],[1,1],[2,0],[1,1],[5,1],[5,0],[5,2],[4,3],[2,7],[3,6],[2,7],[3,7],[4,8],[6,7],[8,6],[6,6],[2,4],[1,3],[2,4],[2,3],[2,4],[2,4],[2,4],[2,4],[1,1]],[[6431,3268],[5,5],[3,6],[3,7],[2,8],[3,10],[1,12],[1,11],[0,12],[0,6],[-1,6],[0,6],[-1,6],[-2,4],[-2,5],[-1,5],[4,2],[4,3],[1,6],[0,8],[1,8],[2,5],[3,3],[4,2],[3,5],[1,9],[-1,9],[0,9],[3,7],[3,3],[4,0],[3,-3],[4,-3],[8,0],[6,2],[6,-2],[7,-10],[4,-10],[1,-11],[0,-12],[0,-13],[2,-11],[4,-8],[4,-9],[3,-10],[-4,-6],[-3,-7],[0,-5],[5,-5],[3,0],[4,1],[4,2],[3,0],[4,-1],[4,-2],[4,-2],[4,-2],[7,-7],[6,-13],[3,-16],[1,-14],[-1,-3],[-1,-2],[-1,-2],[-2,-2],[-3,-9],[-4,-10],[-4,-10],[-4,-7],[-6,-3],[-4,4],[-4,8],[-3,7],[-6,8],[-3,-1],[-3,-7],[-4,-6],[-5,-1],[-5,1],[-4,-1],[-3,-5],[2,-8],[2,-9],[0,-9],[-1,-9],[0,-1],[0,-4],[1,-4],[1,-4],[1,-3],[0,-7],[-2,-6],[-2,-6],[-2,-6],[2,-10],[5,-6],[6,-5],[5,-4],[1,-2],[2,-2],[1,-2],[1,-2],[0,-1],[1,-2],[0,-1],[1,-2],[1,-9],[2,-9],[4,-5],[6,0],[0,1],[1,0],[1,1],[1,0],[9,6],[5,-3],[2,-10],[1,-16],[0,-3],[1,-3],[1,-3],[2,-2],[1,-1],[1,0],[1,0],[1,1],[3,2],[2,2],[2,2],[2,3],[3,6],[3,6],[3,6],[3,6],[5,11],[2,11],[4,10],[7,6],[1,0],[1,1],[1,0],[2,0],[9,5],[7,-2],[6,-6],[8,-10],[5,-6],[6,-6],[6,-5],[5,-5],[3,-2],[3,-3],[3,-2],[3,-2],[12,-6],[12,-8],[5,-13],[-6,-23],[-3,-8],[-5,-7],[-4,-7],[-4,-7],[-2,-5],[-3,-4],[-2,-5],[-3,-5],[-5,-8],[-5,-9],[-4,-11],[-3,-10],[-1,-2],[-1,-2],[0,-2],[-1,-2],[-2,-4],[0,-3],[-1,-4],[0,-4],[0,-4],[0,-4],[1,-5],[0,-4],[2,-24],[-2,-33],[-5,-29],[-10,-16],[-6,-1],[-3,-9],[-2,-14],[0,-11],[0,-1],[0,-2],[0,-1],[0,-1],[-1,-10],[3,-5],[5,-3],[3,-6],[1,-4],[-1,-5],[0,-5],[1,-4],[2,-2],[2,-2],[2,-3],[2,-3],[3,-10],[-3,-8],[-6,-6],[-6,-2],[-5,1],[-5,-1],[-3,-3],[3,-9],[4,-4],[5,0],[5,-1],[4,-2],[2,-3],[2,-5],[2,-4],[2,-4],[4,1],[3,3],[4,3],[4,-1],[5,-9],[4,-13],[5,-11],[5,-5],[1,0],[2,-1],[1,0],[1,0],[9,-3],[8,-6],[9,-5],[6,3],[1,0],[0,1],[1,0],[5,4],[3,1],[3,-1],[5,-3],[4,-2],[5,-4],[4,-3],[4,-4],[0,-4],[-1,-4],[-1,-3],[-2,-2],[-2,-2],[-2,-3],[-1,-3],[-2,-3],[-1,-3],[-1,-3],[-2,-3],[-1,-3],[-2,-3],[-2,-3],[-2,-1],[-2,-1],[-1,0],[-1,0],[-2,1],[-1,0],[-3,-1],[-2,-2],[-1,-4],[-1,-6],[-4,-4],[-6,2],[-7,4],[-6,2],[-4,-2],[-4,-4],[-3,-5],[-5,-2],[-4,-1],[-3,-1],[-4,-1],[-3,-2],[-3,-13],[1,-17],[2,-18],[2,-13],[1,-6],[1,-7],[1,-6],[0,-6],[0,-3],[0,-2],[0,-3],[0,-2],[0,-2],[0,-1],[1,-2],[0,-1],[0,-2],[0,-2],[0,-2],[1,-3],[1,-6],[1,-7],[1,-6],[1,-6],[1,-12],[-3,-4],[-5,-2],[-7,-3],[-3,-4],[-2,-6],[-1,-6],[-2,-6],[-3,-4],[-2,-3],[-2,-3],[-3,-3],[0,-1],[-4,-15],[1,-17],[3,-17],[5,-15],[1,-5],[2,-5],[3,-4],[2,-3],[6,-3],[5,2],[5,4],[5,4],[4,-1],[3,-3],[3,-4],[5,-1],[3,0],[3,-1],[3,-2],[3,-2],[0,-1],[1,-1],[0,-1],[0,-1],[1,-4],[1,-3],[1,-5],[0,-4],[1,-11],[4,-8],[4,-7],[1,-9],[-2,-8],[-3,-10],[0,-10],[2,-8],[5,-2],[4,1],[5,1],[5,-3],[5,2],[4,5],[4,7],[4,5],[4,2],[4,1],[5,2],[4,2],[8,3],[8,3],[8,2],[8,3],[0,1],[1,0],[1,0],[8,1],[3,-11],[1,-16],[1,-13],[4,-10],[6,-10],[5,-9],[3,-8]],[[8644,1792],[0,-151],[0,-152],[-139,2]],[[8505,1491],[-1,2],[-1,7],[0,9],[1,8],[2,6],[4,2],[5,0],[3,1],[1,8],[-1,2],[-7,21],[-3,6],[-3,2],[-6,-1],[-5,1],[-4,2],[-4,5],[-2,6],[2,16],[0,8],[-3,4],[-2,2],[-3,3],[-6,5],[-7,3],[-5,4],[-1,0],[-2,1],[-1,1],[-1,1],[-5,3],[-7,4],[-5,6],[-2,10],[0,5],[0,5],[0,6],[0,6],[-2,18],[-3,20],[-4,19],[-6,15],[-6,4],[-7,1],[-7,-1],[-6,0],[-4,5],[1,9],[3,10],[2,6],[-2,17],[0,2],[-1,3],[0,3],[0,11],[0,4],[-5,12],[-6,9],[-7,2],[-6,-8],[-8,6],[-5,2],[-4,-1],[-4,-3],[-2,-5],[-1,-5],[-2,-5],[-4,7],[0,19],[-4,4],[-2,0],[-7,-2],[-9,-11],[-9,-15],[-8,-14],[6,-17],[-7,-8],[-11,-2],[-10,2],[-6,-8],[-8,-7],[-8,-7],[-8,-5],[-9,-4],[-12,-4],[-11,-6],[-7,-9],[-3,-17],[0,-14],[-2,-9],[-11,-6],[-7,-3],[-6,-8],[-6,-10],[-5,-9],[-7,-10],[-7,-10],[-6,-10],[-7,-10],[-3,-5],[-3,-5],[-4,-5],[-3,-5],[-4,-7],[-5,-7],[-5,-8],[-5,-7],[-1,-2],[-1,-2],[-2,-2],[-1,-1],[-9,-10],[-10,-1],[-10,5],[-9,9],[-4,7],[-4,8],[-4,9],[-3,8],[-6,17],[-3,15],[-6,11],[-10,3],[-8,0],[-5,6],[-2,10],[0,14],[0,23],[-3,22],[-3,22],[-1,23],[2,9],[2,8],[2,8],[1,8],[0,10],[0,10],[-1,10],[0,10],[0,1],[0,1],[0,1],[0,1],[0,11],[-1,3],[0,10],[-4,-11],[-7,1],[-7,-11],[-11,3],[-10,12],[-7,15],[-7,6],[-7,8],[-3,2],[-11,3],[-8,5],[-5,0],[-3,-3],[-4,-8],[-2,-3],[-4,-2],[-1,-12],[-7,-32],[-6,-32],[-6,-33],[-5,-33],[-2,-9],[-1,-10],[-2,-11],[-2,-7],[-4,-6],[-5,-5],[-4,-6],[-4,-6],[-1,-4],[0,-9],[-1,-1],[-1,0],[-2,-2],[-1,-2],[-6,-6],[-1,-4],[-2,-6],[-2,-3],[-1,-8],[-3,-14],[-4,-15],[-5,-16],[-4,-16],[-4,-16]],[[7824,1557],[-6,4],[-5,4],[-4,6],[-2,11],[0,5],[1,6],[2,6],[0,7],[1,4],[0,6],[1,5],[0,6],[3,13],[1,11],[-3,9],[-9,8],[-4,5],[-7,12],[-7,13],[-3,9],[-5,13],[-8,9],[-9,7],[-8,4],[-3,0],[-4,0],[-3,1],[-1,4],[-1,11],[-3,4],[-5,1],[-7,1],[-12,6],[-3,14],[-1,15],[-6,12],[-5,2],[-4,1],[-4,2],[-4,3],[-1,2],[0,3],[-1,3],[-1,2],[-2,1],[-3,0],[-2,0],[-2,1],[-5,7],[-1,13],[1,14],[1,11],[1,8],[4,8],[2,7],[-3,8],[-2,5],[-1,5],[0,6],[0,6],[-2,4],[-2,4],[-1,3],[-1,3],[1,3],[2,3],[1,3],[-3,4],[-2,5],[-1,8],[0,8],[1,6],[-1,7],[-3,2],[-3,1],[-3,2],[-2,5],[0,6],[-1,6],[-1,5]],[[7651,2015],[1,0],[7,8],[9,6],[24,9],[5,7],[6,6],[35,19],[-2,-6],[-3,-5],[-3,-6],[-1,-8],[4,-3],[25,6],[5,3],[5,5],[2,6],[0,5],[-1,4],[-1,3],[1,5],[2,3],[4,4],[2,2],[4,-2],[5,2],[4,3],[4,5],[2,-10],[7,-2],[20,7],[4,6],[4,18],[-3,13],[-1,2],[-3,0],[-4,-3],[-4,-3],[-2,-3],[-4,-5],[-22,-12],[-2,-3],[-3,-6],[-2,-3],[-14,-4],[-11,-13],[-3,-2],[-4,-1],[-3,-1],[-4,-5],[3,10],[6,5],[6,4],[3,5],[3,5],[59,37],[14,5],[34,7],[44,-2],[47,3],[0,-4],[-3,-8],[-3,-4],[-3,-3],[2,-5],[0,-12],[2,-5],[3,0],[5,3],[5,4],[3,4],[-1,-8],[-3,-11],[-1,-8],[2,0],[5,12],[2,4],[-2,3],[6,2],[2,8],[-2,9],[-7,4],[-7,2],[1,5],[5,5],[6,3],[51,1],[27,11],[15,16],[15,23],[7,15],[2,8],[1,5],[3,3],[3,-1],[2,-3],[4,-18],[2,-53],[4,-15],[3,16],[-3,8],[0,12],[3,23],[-2,11],[-8,26],[-1,7],[5,4],[8,1],[14,-2],[7,2],[32,13],[2,1]],[[6229,2706],[0,7],[-1,7],[0,7],[-1,7],[-10,4],[-5,6],[-2,11],[-3,17],[4,1],[4,0],[4,0],[4,1]],[[6223,2774],[3,0],[3,3],[1,5],[2,6],[3,-2],[4,3],[4,5],[3,5],[5,1],[4,-4],[4,-6],[5,-1],[4,6],[5,7],[5,4],[4,-8],[1,-1],[1,-1],[1,-1],[0,-1],[6,-2],[7,-1],[7,0],[6,-3],[1,-1],[1,-1],[1,-1],[1,-1],[7,-5],[5,6],[4,13],[3,14],[2,6],[3,6],[3,5],[2,5],[2,5],[0,3],[1,3],[5,2],[1,0],[1,-2],[1,-4],[1,-2],[7,-7],[7,-7],[8,-4],[8,1]],[[6127,2500],[-4,0],[-5,0],[-4,0],[-4,-1],[-3,-5],[-2,-7],[-3,-4],[-4,3],[-5,6],[-6,6],[-6,4],[-7,2],[-2,0],[-3,1],[-2,0],[-2,1],[-11,2],[-11,3],[-10,7],[-7,12]],[[6026,2530],[-2,1],[-1,1],[-1,2],[0,2],[-3,8],[-2,10],[-1,9],[1,10],[0,1],[0,2],[-1,2],[-1,1],[-1,1],[-3,3],[-1,4],[1,5],[2,5],[1,2],[0,2],[-1,2],[-1,2],[-2,10],[3,12],[3,12],[2,12],[6,-2],[5,-2],[5,3],[2,10],[0,1],[1,1],[0,1],[0,2],[4,9],[3,9],[5,8],[4,9],[1,3],[1,3],[1,3],[1,3],[2,2],[1,2],[2,2],[2,1],[3,3],[1,4],[-1,4],[-4,3],[4,5],[0,5],[0,5],[2,5],[2,3],[2,3],[2,3],[1,4],[1,-1],[1,-1],[0,-2],[1,-1],[3,-3],[2,-3],[1,-5],[0,-5],[0,-1],[0,-1],[0,-1],[0,-1],[1,-7],[1,-6],[3,-5],[3,-3],[1,-4],[1,-4],[1,-5],[2,-4],[1,-2],[0,-2],[1,-2],[1,-3],[0,-1],[0,-1],[2,-5],[0,-5],[-2,-4],[-4,-4],[2,-2],[1,-2],[1,-3],[0,-1],[-1,-2],[-1,-1],[-1,-2],[-1,-2],[4,-8],[6,-5],[6,-4],[6,-5],[2,-4],[1,-3],[2,-4],[1,-4],[1,-1],[0,-1],[0,-2],[0,-1],[2,-7],[0,-8],[1,-7],[-1,-7],[0,-7],[-1,-6],[0,-6],[-1,-7],[2,-9],[2,-8],[3,-8],[2,-9],[0,-1],[0,-1],[0,-1],[-1,-7],[-2,-6],[-3,-6],[-2,-6]],[[5866,3783],[0,-8],[-2,-7],[0,-7],[1,-7],[2,-8],[0,-5],[-1,-4],[-2,-7],[1,-17],[6,-8],[8,-3],[9,-1],[4,-6],[0,-7],[-2,-7],[-3,-5],[-5,-3],[-3,-2],[-4,-3],[-3,-5],[-2,-5],[-1,-5],[-2,-5],[-4,-4],[-9,-5],[-9,-2],[-8,3],[-6,10],[-4,6],[-5,3],[-4,3],[-5,1],[-9,-1],[-8,-4],[-8,-8],[-5,-11],[-4,-18],[-2,-20],[-1,-20],[-1,-20],[0,-13],[-1,-13],[-2,-13],[-3,-11],[-3,-5],[-2,-1],[-3,-1],[-3,-2],[-2,-4],[-2,-5],[-2,-4],[-3,-4],[-7,1],[-5,6],[-4,10],[-4,9],[-1,1],[0,1],[-1,1],[-1,0],[-6,1],[-6,-4],[-5,-7],[-5,-6],[-6,-3],[-6,0],[-7,2],[-6,2],[-9,5],[-3,10],[-1,12],[-5,10],[-6,-2],[-5,-9],[-3,-12],[-4,-10],[-4,-8],[-2,-8],[0,-9],[0,-11],[-1,-9],[-3,-9],[-2,-8],[-3,-9],[-7,-23],[-1,-23],[4,-22],[6,-23],[4,-10],[4,-10],[3,-10],[4,-10],[1,-20],[0,-20],[1,-19],[5,-19],[1,-3],[1,-2],[1,-3],[2,-2],[6,-11],[6,-11],[6,-12],[3,-14],[4,-13],[5,-6],[6,-5],[3,-12],[4,-2],[4,-1],[3,-2],[3,-5]],[[5959,2272],[-3,-10],[-2,-10],[1,-8],[7,-3],[6,-2],[1,-9],[2,-9],[7,-4],[2,-6],[2,-6],[2,-7],[2,-6],[3,-7],[3,-6],[4,-3],[5,0],[6,-1],[1,-9],[1,-11],[2,-5],[7,0],[7,-1],[6,1],[7,1],[2,5],[0,7],[1,7],[0,7],[2,14],[4,11],[6,6],[9,-1],[3,-2],[2,-2],[1,-3],[0,-6],[1,-7],[1,-7],[1,-6],[2,-5],[2,-4],[2,-3],[2,-4],[0,-6],[4,-15],[7,-12],[7,-12],[3,-19]],[[6256,975],[-4,3],[-1,2],[1,0],[1,2],[-1,6],[-5,11],[-11,17],[-25,38],[-12,29],[-9,16],[-1,4],[-3,3],[-5,-1],[-4,2],[-3,-2],[-2,0],[-3,-2],[-5,-2],[-2,-4],[-1,-4],[0,-2],[-10,4],[-6,-1],[-13,9],[-62,33],[-51,23],[-22,9],[-38,10],[-19,1],[-16,-3],[-9,4],[-9,4],[-8,5],[-9,7],[-7,6],[-18,23],[-8,10],[-2,-1],[-1,-3],[-4,2],[-1,3],[-3,2],[2,2],[4,-2],[1,4],[-2,3],[-2,1],[-2,-2],[-2,1],[-3,0],[-2,4],[2,1],[0,5],[2,5],[2,-1],[2,1],[0,4],[-2,5],[-3,2],[-5,2],[-5,-3],[-3,-4],[0,-4],[3,1],[2,-2],[-3,-5],[-4,-1],[-2,4],[-2,12],[-2,3],[-7,12],[-1,5],[-11,10],[-23,14],[-16,7],[-16,10],[-21,14],[-27,17],[-77,45],[-28,16],[-19,10],[-21,16],[-17,10],[-21,10],[-18,11],[-17,9],[-10,9],[-6,-3],[-1,6],[3,4],[0,11],[-6,10],[-10,16],[-21,22],[-3,13],[-26,24],[-26,16],[-15,11],[-20,11],[0,6],[4,1],[1,10],[-3,7],[-3,8],[-12,17],[-9,2],[-9,-4],[-1,8],[-4,0],[-3,6],[-5,-1],[-1,10],[-5,4],[-9,4],[-1,21],[-8,19],[-8,9],[-15,20],[-4,13],[-4,7],[-1,10],[-12,24],[-14,10],[-5,3],[-19,20],[-18,13],[-15,9],[-20,-5],[-3,-9],[-7,-8],[-5,-9],[-5,-5],[-2,-2]],[[5603,2380],[12,-6],[12,-5],[12,-3],[13,0],[4,-1],[2,-2],[1,-6],[0,-9],[2,-6],[2,-4],[2,-4],[0,-6],[-3,-12],[-3,-10],[-1,-10],[4,-12],[1,-7],[1,-6],[-1,-6],[0,-8],[1,-6],[2,-5],[3,-5],[2,-5],[6,-9],[6,-10],[4,-10],[2,-13],[0,-14],[-3,-15],[-2,-13],[3,-11],[3,-4],[2,-5],[3,-5],[2,-4],[3,-5],[4,-2],[5,-1],[4,2],[4,4],[2,6],[2,5],[4,2],[7,9],[7,9],[7,10],[7,9],[7,13],[6,14],[4,15],[5,16],[0,2],[1,2],[1,2],[0,1],[7,2],[6,2],[6,2],[7,3],[6,5],[6,3],[7,3],[6,3],[2,2],[2,1],[1,0],[2,1],[7,2],[5,1],[5,-2],[5,-6],[4,-8],[3,-6],[4,-1],[5,8],[3,6],[1,6],[0,6],[1,7],[2,6],[2,4],[3,3],[3,5],[3,4],[3,4],[3,4],[2,5],[8,10],[7,-4],[5,-11],[6,-10],[4,-2],[2,-4],[2,-5],[1,-6],[5,-6],[7,-3],[8,0],[5,2]],[[6223,2774],[0,1],[1,1],[0,1],[3,10],[3,9],[3,9],[3,10],[1,7],[2,6],[2,7],[2,7],[0,6],[-1,6],[-2,5],[-3,8],[-1,4],[-2,3],[-1,4],[-2,4],[-1,4],[-2,3],[-1,3],[-2,3],[-1,3],[-2,2],[-1,3],[-2,3],[-1,1],[0,1],[-1,2],[-1,1],[-2,5],[-3,3],[-3,1],[-3,-2],[-9,-4],[-7,0],[-5,6],[-5,13],[-11,6],[-13,-22],[-13,-23],[-14,3],[0,1],[-1,2],[0,2],[-1,2],[0,5],[1,5],[1,4],[1,5],[1,11],[2,10],[3,10],[3,10],[-2,0],[-1,0],[-1,1],[-2,0],[1,6],[1,6],[1,6],[-1,6],[0,7],[-2,7],[-2,6],[-3,6],[-2,1],[-1,2],[-2,2],[-2,1],[-5,3],[-5,1],[-5,-1],[-5,-3],[-7,-6],[-7,-7],[-7,-6],[-7,-4],[-5,0],[-5,-1],[-5,-2],[-5,-5],[-3,-9],[0,-10],[0,-11],[-2,-11],[-2,-4],[-3,-2],[-3,0],[-3,1],[-6,-8],[-2,-18],[-3,-14],[-11,2],[-8,-11],[-7,-18],[-5,-9],[-4,18],[0,5],[0,7],[-1,5],[-1,4],[-3,3],[-2,2],[-2,4],[0,4],[1,15],[-3,10],[-5,7],[-7,5],[-8,3],[-5,6],[-2,10],[2,16],[2,11],[2,10],[3,10],[1,12],[0,1],[0,1],[-1,0],[0,1],[-3,7],[-3,7],[-2,7],[-3,7],[-2,5],[-2,6],[-2,6],[-2,6],[-4,3],[-7,2],[-8,-2],[-5,-3],[-2,-5],[-1,-7],[-2,-4],[-5,4],[-9,12],[-10,14],[-9,15],[-7,15],[-2,4],[-1,5],[-1,4],[0,5],[-3,6],[-6,6],[-6,5],[-5,4]],[[5849,3172],[1,12],[1,13],[1,13],[1,12],[1,13],[1,12],[1,13],[1,12],[0,3],[0,3],[0,3],[0,3],[10,7],[12,9],[11,7],[11,3],[1,1],[0,1],[1,1],[4,-3],[5,1],[4,4],[3,7],[2,4],[1,5],[2,4],[3,3],[1,0],[2,-1],[2,-2],[1,-1],[2,3],[1,4],[1,4],[1,4],[1,1],[3,1],[3,1],[1,1],[3,4],[3,4],[4,3],[5,2],[-1,3],[-2,3],[-4,8],[-2,10],[-1,11],[0,6],[5,36],[4,18],[7,15],[17,19],[3,4],[3,6],[2,9],[1,20],[2,10],[6,15],[3,8],[-1,9],[-7,21],[-1,8],[6,8],[2,2],[6,2],[3,3],[5,11],[3,2],[6,0],[12,-12],[6,-3],[9,2],[15,21],[9,5],[8,0],[2,0],[3,2],[2,2],[3,1],[4,-2],[3,0],[-1,12],[0,13],[0,11],[0,4],[0,4],[1,3],[0,4]],[[6269,3772],[0,-1],[1,0],[1,-1],[5,-5],[5,-6],[5,-6],[5,-6],[-5,-12],[-6,-10],[-4,-12],[0,-16],[0,-4],[1,-3],[1,-3],[2,-2],[6,-4],[6,-9],[5,-12],[5,-10],[4,-5],[3,-4],[4,-3],[5,0],[7,8],[7,10],[6,11],[0,11],[-1,8],[4,2],[4,-4],[2,-9],[0,-14],[-4,-16],[-3,-14],[4,-10],[9,-1],[6,10],[5,5],[7,-16],[3,-2],[3,-3],[2,-4],[2,-6],[2,-3],[3,-1],[2,-3],[2,-5],[0,-5],[-2,-9],[-2,-8],[-2,-5],[-1,-1],[-2,0],[-1,1],[-1,-1],[-2,-2],[-2,-4],[-2,-4],[-2,-4],[-2,-6],[-2,-5],[-3,-4],[-2,-5],[-4,-12],[-2,-18],[0,-19],[3,-14],[1,-4],[0,-2],[-1,-2],[-2,-1],[-8,0],[-7,4],[-7,6],[-7,8],[-4,2],[-4,3],[-4,1],[-4,2],[-5,0],[-5,0],[-5,-4],[-2,-6],[1,-7],[2,-4],[2,-5],[1,-7],[-1,-6],[0,-5],[-1,-4],[-4,-4],[-4,-2],[-4,0],[-4,-1],[-5,-2],[-3,-9],[1,-7],[3,-6],[6,-2],[4,3],[4,5],[3,3],[4,-2],[1,-10],[-2,-10],[-3,-10],[-3,-8],[-6,-10],[-9,-9],[-7,-9],[-4,-12],[-1,-10],[0,-10],[-1,-11],[-2,-9],[-3,-5],[-3,-5],[-3,-5],[-3,-5],[1,-12],[5,-13],[6,-13],[4,-12],[6,-23],[10,-5],[11,10],[9,20],[1,9],[2,9],[2,8],[4,6],[5,-7],[4,-8],[4,-2],[6,11],[4,8],[4,7],[4,7],[4,8],[5,11],[5,10],[5,9],[5,10],[8,17],[10,23],[11,19],[10,4],[1,0],[1,-1],[1,-1],[0,-2],[3,-8],[5,-1],[4,0],[3,-7],[1,-6],[-1,-5],[-1,-6],[1,-6],[2,-3],[1,-3],[2,-3],[1,-3],[1,-9],[-2,-7],[-4,-7],[-2,-8],[0,-8],[2,-9],[3,-7],[3,-7]],[[6227,2464],[-1,-1],[-1,-1],[-2,-1],[-1,-1],[-4,-4],[-4,-3],[-3,-4],[-2,-8],[-2,-6],[-3,-3],[-4,-1],[-5,-1],[-4,0],[-4,1],[-3,2],[-4,0],[-3,0],[-2,1],[-1,3],[-1,5],[0,1],[0,1],[0,1],[-1,1],[-1,4],[-1,5],[-1,5],[0,5],[-1,1],[0,2],[0,2],[0,1],[-2,5],[-2,0],[-2,-2],[-2,1],[-3,3],[-3,5],[-2,4],[-3,4],[0,1],[-1,0],[0,1],[-1,0],[-5,3],[-6,1],[-5,1],[-4,2]],[[6026,2530],[-3,-6],[-3,-5],[-3,-5],[-3,-5],[-3,-9],[1,-8],[3,-7],[4,-8],[-5,-5],[-4,-4],[-1,-7],[3,-10],[1,-3],[2,-3],[2,-3],[2,-3],[1,-14],[-2,-10],[-4,-6],[-8,-6],[-3,-2],[-4,-2],[-3,-2],[-4,-3],[-4,-6],[-3,-9],[-2,-9],[-2,-9],[-3,-7],[-5,-4],[-4,-3],[-3,-5],[0,-1],[0,-1],[0,-1],[0,-1],[0,-16],[-2,-16],[-2,-16],[-2,-16],[-1,-1],[0,-1]],[[5761,2968],[3,8],[3,9],[3,8],[3,9],[1,1],[0,1],[1,2],[1,1],[5,11],[5,12],[5,13],[4,12],[4,8],[3,7],[4,7],[4,7],[5,12],[5,7],[6,3],[9,1],[-4,9],[-3,8],[-4,8],[-5,9],[8,7],[7,8],[8,8],[7,8]],[[6557,3966],[-3,-6],[-9,2],[-7,19],[-5,24],[-2,22],[4,-8],[2,-10],[1,-12],[3,-11],[12,-13],[4,-7]],[[6500,4253],[3,-11],[0,-67],[4,-20],[47,-143],[33,-62],[5,-5],[18,-27],[3,-2],[3,-8],[23,-24],[8,-23],[-1,-23],[-4,-23],[-3,-23],[-2,-10],[-9,-24],[-3,-8],[-4,-10],[-2,-12],[-2,-25],[-2,0],[-4,38],[-8,27],[-2,18],[-3,3],[0,4],[5,10],[5,6],[7,6],[5,2],[4,-5],[3,9],[2,9],[1,8],[0,10],[-3,9],[-6,9],[-12,14],[-16,22],[-4,14],[-17,29],[-15,35],[-7,9],[-2,6],[0,7],[-5,37],[-4,13],[-9,9],[-25,77],[-5,17],[2,-12],[5,-20],[3,-6],[2,-11],[8,-30],[2,-22],[1,-46],[7,-37],[5,-47],[4,-21],[26,-75],[5,-9],[5,-4],[4,-1],[5,3],[5,7],[4,-7],[-1,-10],[-3,-23],[1,-11],[21,-71],[1,-6],[5,-3],[2,-8],[3,-20],[18,-83],[22,-70],[23,-64],[3,-19],[3,-9],[-2,-2],[-1,-2],[-4,-8],[16,-50],[36,-73],[11,-16],[13,-11],[6,-9],[5,-21],[4,-10],[9,-13],[22,-43],[19,-28],[6,-11],[4,-15],[3,-6],[3,-4],[2,-2],[4,-2],[2,-5],[11,-32],[21,-41],[21,-53],[17,-33],[5,-18],[11,-52],[3,-49],[11,-64],[4,-10],[10,-20],[2,-11],[-3,-13],[0,-8],[5,-18],[2,-21],[2,-12],[4,-9],[7,-8],[27,-37],[4,-5],[8,6],[3,-7],[1,-13],[2,-10],[3,-8],[5,-28],[3,-11],[5,-9],[7,-7],[7,-3],[9,0],[4,-2],[2,-6],[5,-39],[4,-20],[6,-17],[6,-15],[12,-18],[7,-8],[6,-4],[5,-1],[7,-3],[7,-5],[4,-6],[0,-4],[0,-15],[-8,7],[-15,20],[-17,8],[-11,19],[-8,3],[-6,-7],[7,-10],[11,-8],[6,-3],[3,-10],[7,-11],[14,-15],[0,-4],[-6,0],[-8,6],[-5,2],[-3,-4],[1,-8],[3,-8],[4,-4],[5,1],[3,1],[8,6],[1,3],[0,2],[1,2],[3,1],[3,-1],[33,-16],[7,-2],[6,-6],[7,-10],[7,-6],[5,7],[-13,13],[-20,12],[-17,16],[-2,23],[22,-27],[25,-16],[28,-8],[41,-2],[29,4],[21,-1],[6,-2],[5,-5],[11,-16],[27,-30],[4,-8],[2,-11],[3,-8],[7,-4],[41,-11],[5,-4],[15,-3],[7,-6],[5,-16],[10,-42],[7,-18],[20,-33],[8,-16],[15,-53],[2,0],[10,-13],[4,-3],[9,-1],[11,-8],[9,2],[9,3],[7,2],[10,7],[47,11],[22,10]],[[7824,1557],[-1,-5],[-2,-6],[-1,-5],[-1,-5],[-4,-11],[-6,-9],[-7,-8],[-6,-7],[-12,-13],[-11,-13],[-12,-13],[-11,-13],[-4,-5],[-4,-5],[-4,-3],[-4,-3]],[[7665,855],[3,-3],[8,-10],[9,-20],[3,-5],[11,-7],[5,-4],[2,-7],[-48,33]],[[8505,1491],[-2,-1],[-1,-8],[7,-6],[10,-3],[5,-5],[2,-13],[7,-2],[8,2],[9,0],[3,-5],[3,-9],[2,-10],[0,-8],[2,-4],[6,-3],[3,-3],[1,-4],[2,-9],[1,-6],[3,-7],[11,-21],[4,-2],[7,1],[4,-1],[1,-3],[2,-11],[1,-5],[11,-22],[2,-6],[1,-11],[4,-6],[12,-7],[2,-3],[4,-7],[2,-2],[3,3],[-1,5],[-1,5],[1,2],[5,0],[5,-1],[0,-4],[-5,-10],[7,-5],[9,-16],[6,-5],[22,-12],[3,0],[3,5],[5,-5],[0,-3],[-1,-7],[4,-6],[12,-10],[4,-6],[21,-52],[5,-19],[-4,-13],[0,-4],[2,1],[2,1],[1,2],[1,3],[4,-4],[-1,-8],[-2,-9],[1,-9],[-2,-8],[2,-2],[5,-1],[4,-4],[0,-5],[-2,-5],[-3,-4],[-2,-5],[4,2],[5,0],[5,-2],[2,-2],[1,2],[9,4],[3,0],[1,-12],[2,-5],[8,6],[3,-1],[3,-4],[2,-3],[2,-6],[-1,-5],[1,-3],[10,-2],[3,-2],[3,-3],[1,-1],[4,0],[3,3],[2,-1],[0,-8],[0,-7],[1,-3],[3,-11],[-5,3],[-4,0],[-3,-3],[-1,-8],[3,0],[0,5],[2,0],[2,-8],[-2,-8],[-4,-8],[-6,-3],[-2,-2],[3,-4],[5,-3],[2,1],[0,-5],[-2,-2],[-3,1],[-2,3],[0,-2],[0,-1],[-1,-1],[-1,0],[1,-3],[2,-6],[1,-3],[-4,1],[-1,1],[-1,2],[-4,-6],[1,-6],[3,-4],[4,-3],[-4,-3],[-4,-5],[-2,-7],[1,-11],[10,-9],[2,-5],[-7,-5],[0,-3],[4,-7],[-8,-11],[1,-9],[3,0],[1,2],[1,1],[2,1],[-1,-4],[-2,-8],[-1,-3],[-6,-4],[-6,-1],[-28,0],[-44,0],[-43,0],[-44,0],[-2,0],[-42,0],[-43,-1],[-44,0],[-43,0],[-44,0],[-14,0],[-5,-4],[-4,-8],[-7,-21],[-6,-17],[-15,-45],[-22,-63],[-25,-73],[-25,-73],[-12,-34],[-10,-29],[-15,-45],[-6,-17],[-2,-10],[0,-10],[3,-9],[40,-90],[-6,-24],[-3,-6],[-4,-3],[-4,-1],[-4,-2],[-4,-7],[-1,-18],[1,-34],[-4,-16],[-6,-13],[-2,-7],[1,-12],[0,-4],[3,-14],[0,-4],[0,-8],[0,-4],[6,-27],[0,-10],[-1,-9],[-7,-21],[-7,-33],[-6,-11],[-6,-2],[-1,2],[-18,36],[-24,38],[-40,68],[-60,105],[-40,75],[-5,14],[0,12],[6,-5],[13,-8],[3,-5],[1,-10],[2,-10],[3,-8],[5,-3],[-3,11],[-3,23],[-4,9],[-4,5],[-7,4],[-7,3],[-5,-2],[0,9],[-4,2],[-2,-4],[4,-7],[-5,1],[-19,25],[-13,9],[-6,7],[-4,16],[-26,30],[-29,55],[-5,16],[-4,7],[-9,6],[-77,109],[-5,5],[-53,72],[-33,36],[-58,58],[4,3],[8,-1],[3,2],[2,-6],[4,-1],[4,4],[3,7],[-6,13],[-3,12],[-5,10],[-7,6],[-38,14],[-10,9],[-3,4]],[[9787,2122],[-2,0],[1,5],[5,10],[3,8],[2,5],[2,14],[2,30],[1,5],[1,5],[2,4],[3,5],[-6,-19],[2,-24],[-4,-19],[-12,-29]],[[9826,2259],[-5,-12],[2,16],[-4,44],[5,-7],[2,-27],[0,-14]],[[9984,3314],[-11,-32],[-4,-17],[-6,-9],[-9,-14],[-4,-9],[-8,-24],[-1,-10],[-2,-3],[-3,-2],[-3,-4],[-1,-6],[-1,-4],[-3,-6],[-17,-25],[-5,-4],[-2,5],[-1,11],[-4,24],[-2,12],[1,24],[4,21],[13,38],[9,23],[3,2],[5,7],[2,2],[3,0],[2,-1],[2,-2],[1,-1],[3,-1],[8,-5],[3,-1],[4,1],[7,7],[4,-1],[6,3],[5,7],[2,8],[0,2],[2,0],[1,-2],[1,-4],[-1,-2],[-3,-8]],[[9990,3686],[9,-24],[-6,7],[-6,17],[-4,17],[3,8],[1,-12],[3,-13]],[[9970,3823],[1,-17],[-1,3],[-2,11],[-2,6],[1,4],[-1,6],[0,6],[0,3],[1,-2],[1,-6],[1,-6],[1,-8]],[[9142,2810],[6,19],[5,20],[3,18],[1,17],[0,19],[7,6],[11,-2],[34,8],[9,13],[7,15],[20,11],[10,10],[35,3],[6,2],[5,5],[3,6],[20,29],[8,-7],[7,-11],[3,10],[-3,11],[8,14],[18,20],[10,8],[10,9],[10,8],[18,6],[17,18],[18,8],[14,28],[9,36],[8,10],[11,-1],[6,-13],[3,-15],[7,-1],[1,20],[-4,24],[5,17],[7,17],[5,15],[7,11],[11,4],[9,-11],[8,-6],[10,5],[19,-2],[8,4],[27,24],[26,37],[10,11],[17,22],[19,19],[10,33],[5,20],[6,18],[3,17],[1,19],[20,63],[-2,34],[-14,51],[0,21],[5,34],[12,30],[2,19],[-5,103],[1,7]],[[9735,3827],[8,1],[3,-1],[1,-2],[1,-4],[3,-4],[4,-1],[-3,-2],[-1,-1],[-2,0],[-1,3],[-2,0],[3,-6],[6,-1],[14,3],[7,-1],[18,-10],[19,1],[5,-3],[5,-4],[6,1],[23,16],[3,5],[4,11],[3,5],[1,5],[0,5],[-2,5],[0,4],[0,4],[1,3],[-1,3],[-5,3],[-7,0],[-8,-3],[-7,-7],[-5,-7],[-6,-5],[-7,0],[-8,3],[-6,4],[-2,-4],[-2,8],[0,3],[-5,-4],[-8,-11],[-7,-3],[1,-3],[2,-1],[-4,-2],[-2,1],[-1,5],[0,7],[10,13],[3,6],[2,3],[3,1],[7,-1],[10,-3],[3,-2],[7,-2],[8,4],[35,28],[7,2],[22,-11],[5,-6],[9,-14],[17,-40],[1,-6],[2,-4],[2,-5],[1,-11],[2,-4],[3,-2],[3,-2],[2,6],[3,1],[6,-3],[8,-1],[4,-2],[5,-28],[0,-7],[0,-9],[-3,-13],[-1,-7],[0,-26],[3,-36],[7,-26],[16,4],[-1,-6],[-1,-3],[-1,-3],[-7,-24],[-1,-4],[-4,-15],[0,-4],[2,-5],[0,-3],[0,-4],[-1,-1],[-2,1],[-1,-1],[-2,-2],[-5,-3],[-2,-3],[-1,-4],[-1,-4],[0,-12],[-1,-7],[-5,-29],[-8,-29],[0,-6],[-22,-51],[-29,-54],[-6,-18],[-4,-6],[-17,-18],[-5,-8],[-13,-14],[-18,-30],[-37,-91],[-4,-18],[-4,-2],[-2,-4],[0,-5],[2,-4],[-10,-12],[-6,-14],[-5,-16],[-7,-44],[-1,-23],[1,-47],[2,-12],[7,-22],[2,-12],[-1,-6],[-2,-20],[-2,-2],[-2,-1],[-2,-3],[-4,-25],[-2,-7],[-1,23],[0,6],[1,3],[4,0],[2,4],[3,1],[1,6],[1,7],[0,21],[-5,9],[-2,5],[0,9],[-1,4],[-2,1],[-3,-1],[-1,-4],[1,-5],[3,-4],[1,-4],[1,-18],[0,-8],[-1,-5],[1,3],[2,2],[3,3],[-13,-33],[-3,-5],[-2,-2],[-2,-4],[-2,-4],[-3,1],[-3,5],[-2,2],[-2,-1],[-3,-8],[-5,-1],[-6,-15],[-6,-19],[-3,-16],[-6,-17],[-3,-18],[-3,-6],[-4,1],[3,4],[3,7],[2,9],[-2,7],[-3,-1],[-17,0],[-4,1],[-2,-7],[-1,-11],[0,-12],[1,-8],[3,-8],[10,-10],[0,-5],[3,-2],[3,-1],[3,-1],[4,1],[-2,-9],[-1,-16],[-1,-9],[6,1],[4,6],[3,8],[4,7],[4,4],[9,4],[4,4],[9,-4],[7,-7],[2,-1],[2,2],[0,4],[1,3],[1,3],[3,0],[2,-3],[2,-1],[2,4],[1,-2],[1,-1],[1,-1],[1,0],[-4,-4],[0,-4],[8,4],[5,11],[0,10],[-5,2],[2,-6],[0,-4],[-3,-2],[-9,0],[-9,2],[-4,3],[-5,3],[7,0],[19,-4],[0,4],[0,3],[2,14],[0,9],[6,-19],[3,-13],[-1,-5],[-2,-6],[-3,-36],[-4,-11],[-4,-9],[-5,-7],[-6,-3],[-2,-2],[-9,-15],[-2,-2],[-12,-3],[6,2],[2,6],[1,7],[2,7],[-11,-5],[-15,-12],[-12,-18],[-3,-22],[2,0],[2,12],[2,0],[-2,-9],[-5,-9],[-2,-6],[5,-3],[-7,-23],[-2,-12],[4,-6],[5,-2],[4,-4],[3,0],[6,9],[8,17],[4,10],[1,9],[3,8],[8,4],[15,2],[-7,-23],[4,5],[4,8],[4,5],[6,1],[0,-4],[-6,-5],[-5,-9],[-9,-20],[-3,-13],[-4,-30],[-3,-10],[2,-12],[-4,-17],[-7,-27],[-7,-18],[-6,-73],[-12,-67],[-5,-16],[-8,-14],[-6,-17],[-4,-20],[-2,-24],[2,-24],[-1,-12],[-4,-11],[-2,-9],[-1,-39],[-3,-12],[-15,-38],[-2,-8],[-1,-8],[-4,-17],[-1,-9],[0,-36],[-3,0],[0,15],[-2,12],[-5,-11],[-4,3],[-1,7],[3,4],[2,7],[2,13],[1,15],[0,7],[-1,-5],[-2,-6],[-1,-5],[-2,-3],[-2,6],[1,6],[2,6],[1,8],[-1,1],[-5,9],[0,3],[1,4],[0,6],[-2,4],[-8,3],[-1,1],[-2,2],[1,5],[1,4],[1,0],[-1,9],[-2,6],[-3,3],[-6,1],[-9,3],[-16,16],[-8,3],[-3,4],[-1,9],[1,8],[0,4],[11,21],[-2,12],[3,12],[5,10],[3,9],[0,5],[3,9],[1,7],[-1,0],[-1,3],[-2,3],[0,3],[0,4],[1,3],[1,2],[0,1],[2,22],[-1,12],[-2,9],[-4,8],[-2,10],[-2,22],[-7,-10],[-8,-14],[-6,-16],[-3,-15],[0,-8],[-2,-9],[-2,-8],[-3,-3],[-2,4],[0,9],[2,12],[-1,-5],[-3,-6],[-6,-3],[-8,0],[-2,-3],[-14,-20],[-2,-4],[-1,-5],[-1,-6],[6,5],[7,8],[5,11],[4,10],[2,-9],[-2,-7],[-2,-7],[-1,-11],[2,5],[3,5],[3,4],[3,1],[3,-3],[-2,-4],[-3,-3],[-2,-1],[-8,-26],[-7,-17],[-9,-27],[-1,-8],[-7,-17],[-3,-11],[-4,-1],[-1,-1],[-1,-2],[0,-1],[-2,0],[-20,0],[-2,-1],[-2,-2],[-2,0],[-2,2],[-3,5],[-2,1],[-2,-1],[-3,-3],[-7,-4],[-2,0],[-4,1],[-3,3],[-3,1],[-10,-13],[-2,-4],[-2,-6],[-1,-17],[-3,-13],[-1,-14],[-1,-6],[-4,-10],[-10,-19],[-3,-9],[-1,-9],[-1,-9],[0,-2],[-1,-6],[-3,-9],[-4,-5],[-9,-7],[-9,-11],[1,-2],[1,-7],[-1,-6],[-8,-22],[-1,-6],[-1,-12],[-1,-6],[-3,-8],[-4,-5],[-4,-4],[-5,-7],[-1,-5],[-5,-21],[-3,-6],[-16,-21],[-1,-3],[-2,-13],[-1,-4],[-3,-1],[-13,12],[-4,5],[-4,16],[-3,1],[-4,-2],[-4,1],[-5,7],[-5,9],[-5,8],[-7,4],[-26,-16],[-4,-11]],[[8837,3455],[1,2],[3,30],[8,32],[1,18],[-2,0],[-4,-30],[-6,-20],[-1,-5],[-1,-13],[-4,-15],[-7,-13],[-7,-6],[0,4],[6,14],[20,99],[3,9],[5,9],[36,36],[6,9],[21,13],[11,15],[7,5],[3,2],[10,2],[17,10],[19,23],[5,3],[6,2],[32,19],[34,9],[25,0],[44,13],[60,10],[26,12],[12,3],[8,-4],[3,0],[4,1],[6,5],[2,1],[27,8],[21,10],[14,3],[6,2],[12,8],[38,15],[11,11],[20,30],[6,4],[19,4],[7,3],[11,9],[6,3],[25,0],[5,-2],[11,-8],[6,-2],[5,2],[11,5],[17,3],[6,3],[4,5],[5,3],[20,-1],[-6,4],[-8,2],[-7,0],[-11,-10],[-13,-4],[-3,-1],[2,5],[6,6],[7,4],[9,2],[7,5],[3,1],[4,-1],[14,-6],[27,0],[8,-2],[19,-13],[14,-6],[27,-7],[19,-8],[1,-2],[-2,-4],[-3,-2],[-4,0],[-4,1],[-3,3],[-5,4],[-22,6],[-7,3],[8,-10],[9,-8],[11,-6],[10,-2],[22,0],[10,-3],[5,-1],[5,4],[-13,1],[-7,3],[-5,5],[2,3],[21,-4],[18,-11],[7,-1],[1,0]]],"transform":{"scale":[0.0031671379765976604,0.0018168370317667582],"translate":[-118.3688042289999,14.546282924364334]}};
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
