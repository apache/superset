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
  Datamap.prototype.mexTopo = '__MEX__';
  Datamap.prototype.mhlTopo = '__MHL__';
  Datamap.prototype.mkdTopo = '__MKD__';
  Datamap.prototype.mliTopo = '__MLI__';
  Datamap.prototype.mltTopo = '__MLT__';
  Datamap.prototype.mmrTopo = {"type":"Topology","objects":{"mmr":{"type":"GeometryCollection","geometries":[{"type":"MultiPolygon","properties":{"name":null},"id":"-99","arcs":[[[0]],[[1]],[[2]],[[3]],[[4]],[[5]],[[6]],[[7]],[[8]],[[9]],[[10]],[[11]],[[12]],[[13]],[[14]],[[15]]]},{"type":"Polygon","properties":{"name":"Kayah"},"id":"MM.KH","arcs":[[16,17,18]]},{"type":"Polygon","properties":{"name":"Kayin"},"id":"MM.KN","arcs":[[-18,19,20,21,22,23,24,25]]},{"type":"Polygon","properties":{"name":"Mandalay"},"id":"MM.MD","arcs":[[26,-25,27,28,29]]},{"type":"Polygon","properties":{"name":"Bago"},"id":"MM.BA","arcs":[[-24,30,31,32,33,34,-28]]},{"type":"Polygon","properties":{"name":"Yangon"},"id":"MM.YA","arcs":[[35,36,-33]]},{"type":"MultiPolygon","properties":{"name":"Mon"},"id":"MM.MO","arcs":[[[37]],[[38]],[[39,40,41,-21]],[[42,-31,-23]]]},{"type":"MultiPolygon","properties":{"name":"Rakhine"},"id":"MM.RA","arcs":[[[43]],[[44]],[[45]],[[46]],[[47,48,49,50]]]},{"type":"Polygon","properties":{"name":"Chin"},"id":"MM.CH","arcs":[[51,52,-48,53]]},{"type":"MultiPolygon","properties":{"name":"Ayeyarwady"},"id":"MM.AY","arcs":[[[54]],[[55]],[[56]],[[57]],[[-37,58,-50,59,-34]]]},{"type":"Polygon","properties":{"name":"Magway"},"id":"MM.MG","arcs":[[-29,-35,-60,-49,-53,60]]},{"type":"Polygon","properties":{"name":"Shan"},"id":"MM.SH","arcs":[[-19,-26,-27,61,62,63]]},{"type":"MultiPolygon","properties":{"name":"Tanintharyi"},"id":"MM.TN","arcs":[[[64]],[[65]],[[66]],[[67]],[[68]],[[69]],[[70]],[[71]],[[72]],[[73]],[[74]],[[75]],[[76]],[[77]],[[78]],[[79]],[[80]],[[81]],[[82]],[[83]],[[84]],[[85]],[[86]],[[87]],[[88]],[[89]],[[90]],[[91]],[[92,-41]]]},{"type":"Polygon","properties":{"name":"Kachin"},"id":"MM.KC","arcs":[[-63,93,94]]},{"type":"Polygon","properties":{"name":"Sagaing"},"id":"MM.SA","arcs":[[-94,-62,-30,-61,-52,95]]}]}},"arcs":[[[6447,14],[1,-6],[-11,-8],[-6,14],[-4,-1],[-4,4],[5,4],[17,-2],[2,-5]],[[6457,289],[-6,-5],[-4,2],[-5,3],[-5,-3],[-1,-3],[-8,-4],[-2,4],[4,8],[6,2],[8,4],[3,8],[9,-2],[1,-5],[0,-9]],[[6505,512],[2,-2],[-6,-2],[-7,1],[-3,-2],[-15,-3],[-4,-8],[-10,0],[-3,1],[-22,5],[-5,2],[-5,0],[-17,3],[-3,1],[7,2],[7,0],[4,-2],[6,4],[3,2],[11,2],[7,-1],[9,-3],[14,-1],[8,2],[-3,5],[9,6],[13,0],[-2,-5],[0,-5],[5,-2]],[[6827,744],[-11,-1],[-10,6],[-4,2],[4,3],[9,7],[11,0],[1,-5],[5,-2],[2,-5],[-7,-5]],[[7087,882],[-5,-3],[-11,16],[-13,11],[2,6],[7,-4],[9,-3],[8,-5],[0,-5],[5,-5],[1,-2],[-1,-4],[-2,-2]],[[6633,964],[4,-1],[1,-3],[-2,-5],[2,-11],[-1,-6],[-3,2],[-7,0],[-6,1],[-4,-2],[-10,13],[-5,-1],[-4,1],[-10,3],[-4,3],[5,0],[2,2],[4,2],[10,0],[6,-4],[8,1],[7,0],[-1,2],[-1,3],[4,-1],[5,1]],[[5913,1167],[20,0],[3,1],[8,0],[7,-4],[0,-4],[0,-3],[-4,-4],[-18,-1],[-18,3],[-9,10],[-4,0],[-3,1],[-1,1],[0,2],[9,1],[8,-1],[2,-2]],[[6188,1346],[0,-2],[-4,-2],[6,-3],[-1,-2],[-10,-5],[-5,-3],[-1,-5],[-1,-1],[-5,1],[3,6],[-6,4],[-7,4],[-2,3],[15,4],[13,0],[5,1]],[[6923,1351],[-8,-10],[-11,0],[-8,3],[0,9],[5,4],[5,3],[6,2],[6,-2],[5,-2],[0,-4],[0,-3]],[[6990,1445],[-14,-2],[-11,2],[-6,3],[0,5],[28,20],[18,1],[14,-9],[-2,-10],[-12,-6],[-15,-4]],[[6864,1659],[11,-19],[-11,2],[-7,3],[-5,6],[-5,11],[-1,6],[-5,6],[8,0],[4,-6],[11,-9]],[[7036,1885],[-9,0],[-8,5],[-1,9],[-7,11],[7,6],[14,3],[14,-1],[9,-5],[5,-8],[-3,-8],[-9,-9],[-12,-3]],[[1190,2311],[-9,-3],[-4,1],[-4,4],[1,3],[-1,5],[2,4],[4,5],[8,-4],[1,-10],[2,-5]],[[6274,2424],[-1,-5],[-8,-10],[-2,-3],[-7,-3],[-11,-4],[-7,-4],[-5,2],[-5,5],[-1,4],[7,1],[3,4],[5,9],[6,0],[4,2],[6,-1],[3,1],[7,2],[6,0]],[[6228,2535],[-2,-5],[-6,1],[-6,5],[1,4],[6,3],[11,1],[3,-1],[-5,-4],[-2,-4]],[[3205,3232],[-19,-4],[-18,1],[-4,7],[3,1],[7,3],[10,4],[4,1],[9,3],[15,-7],[-7,-9]],[[6327,5265],[-23,-2],[-10,-6],[-1,-10],[3,-10],[3,-7],[5,-3],[0,-3],[-7,-7],[-10,-6],[-36,-15],[-37,-23],[0,-3],[9,-11],[1,-5],[7,-13],[16,-9],[10,-10],[-9,-10],[-10,-2],[-13,1],[-10,-1],[-5,-6],[6,-5],[30,-11],[10,-4],[8,-10],[3,-10],[-5,-41],[-7,-8],[-16,-8],[-69,-24],[-12,-10],[-7,-20],[-8,-8],[-16,-8],[-23,-8],[-12,-5],[5,-6],[25,-11],[27,-9],[11,-6],[5,-7],[-4,-13],[1,-5],[13,-19],[4,-10],[0,-11],[6,-20],[13,-21],[7,-22],[-8,-21],[-7,-6],[-3,-1],[-6,1],[-53,-7],[-59,1],[-21,-3],[-77,-24],[-44,-9],[-51,1],[-28,-3],[-12,1],[-12,3],[-5,4],[-3,5],[-23,16],[-9,3],[-8,0]],[[5776,4725],[-15,18],[-13,22],[-1,2],[-4,3],[-10,5],[-5,5],[-6,7],[-5,5],[-4,1],[-6,2],[-11,1],[-99,-1],[-38,2],[-36,3],[-4,0],[-13,-1],[-4,0],[-4,1],[-9,5],[-65,57],[-3,10],[-25,18],[-11,5],[-4,0],[-4,1],[-3,1],[-1,2],[-1,2],[3,7],[3,3],[0,3],[-3,3],[-14,7],[-8,3],[-10,6],[-9,7],[-8,10],[-3,7],[-1,9],[0,3],[-6,10],[-4,13],[2,6],[0,2],[-3,3],[-8,4],[-4,3],[-3,3],[-3,6],[-7,7],[-19,12],[-10,4],[-8,2],[-5,1],[-4,0],[-4,1],[-8,3],[-4,1],[-11,2],[-3,3],[-3,5],[-3,11],[-10,11],[-3,3],[-9,10],[-3,6],[4,15]],[[5183,5116],[1,1],[27,11],[40,23],[29,27],[0,16],[-9,10],[-18,13],[-5,4],[-3,5],[0,2],[1,2],[3,5],[17,18],[26,19],[39,21],[60,23],[121,32],[7,16],[3,57],[10,5],[4,3],[10,30],[-5,16],[7,10],[22,1],[11,-1],[22,-5],[9,-3],[5,-3],[3,-6],[1,-3],[0,-3],[-1,-4],[0,-3],[1,-3],[3,-7],[3,-3],[5,-2],[15,-4],[7,-1],[9,-1],[10,0],[41,3],[8,1],[6,0],[5,-1],[6,1],[5,2],[7,6],[4,9],[15,8],[27,4],[1,-7],[60,-31],[16,-1],[12,1],[7,0],[7,2],[7,2],[4,2],[5,2],[4,1],[3,1],[2,0],[7,1],[6,-2],[6,-4],[17,-16],[16,-9],[9,-3],[7,-2],[10,0],[5,-1],[4,-3],[0,-4],[-2,-4],[-19,-21],[-4,-7],[-3,-6],[0,-3],[2,-2],[7,-3],[13,-4],[10,-3],[8,-4],[12,-10],[5,-3],[15,-4],[28,-2],[85,-10],[10,0],[8,2],[5,3],[5,2],[7,0],[9,-1],[12,-2],[21,-6],[14,-1],[10,-1],[8,1],[7,0],[8,-2],[9,-3],[6,-3],[5,-6],[2,-8],[12,-20]],[[5776,4725],[-24,2],[7,-6],[24,-10],[12,-10],[5,-8],[25,-24],[29,-20],[3,-12],[1,-12],[6,-13],[16,-12],[22,-10],[24,-8],[22,-6],[11,4],[4,4],[21,25],[2,1],[13,1],[56,-10],[15,-4],[7,-8],[-1,-9],[-8,-8],[-17,-4],[-3,-5],[12,-11],[57,-36],[5,-3],[1,-3],[0,-5],[2,-6],[11,-10],[2,-6],[-1,-3],[-5,-5],[-1,-2],[2,-5],[4,0],[4,0],[5,-1],[15,-3],[3,-3],[3,-6],[16,-18],[5,-3],[4,-2],[5,-7],[2,-6],[-3,-3],[-4,-1],[-31,-9],[-31,-25],[-7,-8],[15,-25],[-25,-2],[8,-7],[14,-5],[11,-7],[5,-7],[7,-6],[27,-10],[9,-6],[2,-5],[1,-6],[1,-7],[7,-7],[11,-7],[154,-65],[29,-13],[16,-5],[27,-5],[11,-3],[10,-6],[5,-7],[25,-18],[11,-15],[8,-7],[15,-8],[15,-3],[16,-3],[13,-3],[7,-8],[-1,-6],[-4,-12],[2,-6],[9,-6],[95,-41],[18,-4],[21,-8],[39,-26],[25,-8],[-9,-5],[-5,-6],[3,-4],[29,0],[1,-5],[-6,-4],[-5,-2],[15,-12],[16,-7],[19,-3],[54,0],[23,-3],[20,-6],[20,-9],[12,-8],[19,-17],[12,-7],[6,-7],[1,-9],[4,-8],[17,-4],[11,-3],[7,-7],[9,-15],[-14,4],[-12,2],[-9,-3],[-3,-7],[5,-6],[10,-3],[11,-2],[8,-4],[-4,-6],[-13,-7],[-18,-5],[-16,-2],[-14,-9],[-8,-10],[2,-9],[33,-12],[5,-6],[8,-15],[16,-10],[38,-12],[16,-10],[5,-5],[2,-5],[0,-5],[-4,-5],[0,-6],[7,-5],[68,-42],[9,-9],[-1,-6],[-12,-11],[2,-6],[14,-15],[16,-38],[7,-8],[22,-7],[17,6],[34,23],[67,25],[15,12],[9,22],[9,8],[23,9],[5,-18],[20,-9],[26,-8],[19,-13],[1,-9],[-11,-23],[-5,-24],[-6,-9],[-31,-16],[-14,-10],[-7,-10],[-2,-12],[1,-12],[-5,-5],[-27,-13],[-9,-3],[-18,-1],[-7,2],[-7,4],[-13,3],[-68,4],[-19,-1],[-24,-5],[-9,-9],[-7,-10],[-15,-11],[-13,-4],[-8,-2],[-9,-1],[-15,0],[-11,2],[-14,2],[-13,1],[-10,-4],[4,-7],[29,-20],[8,-10],[-3,-10],[-14,-20],[1,-13],[8,-22],[-2,-10],[-35,-53],[-3,-12],[4,-20],[2,-8],[-2,-31],[26,-78],[2,-27],[-10,-25],[-30,-15],[-3,11],[-17,9],[-23,6],[-22,4],[-22,-5],[-17,-3],[-40,-4],[-8,-2],[0,-5],[4,-9],[-1,-4],[-6,-3],[-10,-3],[-1,0],[-3,-2],[-3,-3],[-1,-3],[3,-1],[6,-2],[7,-2],[3,-3],[0,-8],[-3,-4],[-8,-1],[-16,3],[-38,11],[-20,3],[-26,2],[-13,-1],[-39,-26],[-17,-7],[-19,-5],[-9,1]],[[6703,2968],[-1,5],[3,10],[-3,7],[-11,14],[-8,7],[-5,3],[-22,6],[-4,1],[-7,3],[-10,5],[-21,13],[-9,8],[-9,9],[-17,13],[-6,3],[-12,4],[-4,2],[-37,36],[-4,2],[-17,8],[-10,6],[-6,4],[-10,11],[-2,2],[-3,2],[-3,1],[-11,5],[-12,4],[-20,7],[-3,3],[-2,2],[0,8],[-1,4],[-2,2],[-2,1],[-3,2],[-3,1],[-9,1],[-4,0],[-26,11],[-32,4],[-6,5],[-2,4],[0,3],[0,2],[3,3],[2,4],[2,2],[2,2],[6,2],[3,1],[2,3],[-1,2],[-2,2],[-8,6],[-2,4],[0,4],[-1,4],[-3,3],[-8,6],[0,2],[1,4],[0,2],[-2,3],[-15,15],[-10,7],[-2,5],[-4,17],[0,10],[2,1],[1,3],[2,4],[-2,18],[0,2],[1,1],[2,2],[2,1],[2,2],[2,2],[1,2],[0,8],[0,1],[2,2],[2,1],[2,2],[2,1],[4,2],[3,3],[2,5],[1,3],[-1,2],[-2,2],[-10,6],[-3,10],[-4,5],[-22,16],[-5,4],[2,4],[47,4],[62,0],[9,0],[5,2],[33,4],[47,0],[9,0],[21,-7],[3,-1],[4,-1],[9,-1],[4,0],[10,-3],[11,-2],[6,0],[4,1],[5,3],[3,3],[2,2],[4,1],[5,1],[8,1],[4,1],[15,5],[13,3],[4,2],[2,2],[-2,11],[-1,1],[-1,1],[-2,1],[-15,6],[-17,7],[-2,1],[-2,2],[-3,3],[-2,2],[-2,1],[-4,1],[-4,0],[-2,2],[-1,2],[2,4],[1,2],[-1,3],[-2,3],[-1,2],[-2,2],[-2,1],[-3,1],[-2,2],[-7,1],[-4,1],[-2,1],[-15,11],[-10,5],[-4,1],[-11,2],[-8,1],[-4,0],[-4,1],[-3,1],[-3,1],[-2,2],[-1,1],[-3,4],[-5,19],[-6,11],[-2,6],[-3,4],[-2,1],[-2,1],[-4,-1],[-10,-2],[-4,0],[-5,-1],[-29,1],[-9,1],[-4,1],[-3,1],[-3,1],[-2,1],[-2,1],[-2,2],[-7,9],[-1,2],[-5,2],[-2,2],[-6,2],[-7,2],[-3,1],[-20,3],[-4,0],[-3,1],[-3,2],[-1,1],[-2,4],[-3,2],[-4,7],[5,11],[-11,2],[-44,-9],[-13,-1],[-8,-1],[-4,2],[-35,16],[-12,4]],[[6184,3675],[-5,4],[-7,3],[-9,2],[-10,2],[-10,-3]],[[6143,3683],[-3,11],[-3,2],[-3,2],[-3,0],[-2,0],[-12,-2],[-5,0],[-6,0],[-10,1],[-6,1],[-5,2],[-16,10],[0,1],[3,3],[0,3],[-3,4],[-2,2],[-4,1],[-19,4],[-22,10],[-35,21],[-6,5],[-2,4],[-2,8],[-3,8],[2,6],[-1,7],[-18,11],[-2,2],[0,3],[1,3],[0,4],[-1,3],[-2,1],[-13,4],[-7,4],[-5,4],[-5,4],[-8,4],[-3,3],[0,2],[3,4],[0,2],[-2,11],[3,6],[1,4],[-1,2],[-1,2],[-23,13],[-3,2],[-2,2],[-5,18],[0,5],[2,2],[5,0],[4,0],[4,0],[4,1],[2,1],[3,2],[2,2],[2,4],[-1,3],[-2,3],[-5,4],[-1,2],[1,2],[2,1],[8,2],[5,1],[2,1],[3,3],[2,3],[1,2],[3,2],[3,1],[5,0],[4,1],[9,8],[3,3],[0,2],[-2,2],[-6,4],[-17,24],[13,8],[1,5],[-3,6],[-5,6],[-2,2],[-9,13],[-1,4],[1,3],[2,1],[7,3],[4,2],[6,4],[-1,4],[-2,3],[-8,9],[-3,2],[-2,1],[-3,2],[-6,2],[-3,1],[-4,3],[-11,12],[-5,2],[-3,2],[-3,3],[-13,18],[-3,11],[-5,6],[-3,3],[-5,3],[-2,3],[-1,2],[15,30],[-1,3],[-1,1],[-3,2],[-8,3],[-7,2],[-12,2],[-3,1],[-11,5],[-5,2],[-4,3],[-24,28],[-3,4],[-1,3],[1,2],[8,11],[4,3],[24,8],[6,5],[1,2],[0,2],[-2,3],[-2,2],[-3,1],[-3,-1],[-3,-1],[-3,-3],[-3,-1],[-3,1],[-4,0],[-3,1],[-4,1],[-4,0],[-5,0],[-5,-1],[-3,-1],[-2,-2],[-1,-2],[0,-2],[2,-6],[-1,-2],[-2,-1],[-8,-2],[-6,-2],[-4,-2],[-15,-13],[-2,-2],[0,-2],[-1,-2],[0,-2],[0,-2],[-2,-3],[-10,-10],[-5,-2],[-5,0],[-26,5],[-5,1],[-7,0],[-4,-1],[-17,-9],[-10,-3],[-6,-2],[-3,-2],[-1,-2],[-1,-2],[0,-4],[-1,-3],[-4,-2],[-3,0],[-10,1]],[[5621,4196],[-23,7],[0,6],[2,3],[2,3],[1,21],[-36,42],[-7,12],[-1,7],[3,4],[14,8],[3,3],[6,10],[3,12],[-1,6],[-4,4],[-5,2],[-7,2],[-6,2],[-5,4],[1,5],[-2,4],[-2,3],[-49,46],[-2,5],[0,4],[6,7],[4,3],[4,2],[10,4],[4,3],[3,2],[5,6],[3,3],[5,3],[5,2],[13,14],[2,4],[2,13],[1,2],[3,4],[9,7],[5,7],[0,5],[-3,4],[-4,3],[-6,2],[-43,14],[-17,10],[0,8],[2,6],[-1,14],[-4,10],[-9,13],[-8,5],[-8,2],[-7,0],[-6,-2],[-5,-3],[-3,-2],[-4,-5],[-5,-3],[-7,0],[-10,2],[-6,3],[-4,3],[0,3],[2,8],[-1,4],[-5,3],[-16,8],[-6,2],[-6,2],[-19,3],[-12,3],[-9,5],[-9,5],[-16,13],[-6,7],[-1,5],[7,7],[3,3],[2,4],[0,5],[0,3],[1,3],[9,18],[-1,10],[-7,13],[0,4],[1,4],[-1,5],[-5,5],[-4,4],[-7,3],[-13,4],[-2,3],[-2,4],[-3,4],[-6,2],[-6,1],[-10,0],[-54,-7],[-55,-14],[-12,-3],[-9,0],[-18,3],[-18,1],[-11,1],[-9,2],[-15,4],[-10,2],[-7,0],[-7,-1],[-7,-3],[-8,-3],[-13,-3],[-8,0],[-6,2],[-4,3],[-5,7],[-3,3],[-19,10],[-8,8],[-14,18],[-30,24],[1,9],[30,16],[-3,7],[-15,10],[-11,9],[-3,7],[5,5],[9,5],[15,5],[42,13],[7,6],[-2,3],[-4,2],[-11,4],[-4,3],[-6,7],[-5,3],[-5,3],[-33,14],[-36,11],[-42,19],[-24,15],[-6,5],[-5,5],[-1,4],[-3,5],[-3,3],[-9,1],[-5,8],[1,1],[5,3],[14,4],[21,10],[0,4],[-3,2],[-6,2],[-7,1],[-6,3],[-5,5],[-7,12],[-5,6],[-3,4],[-4,1],[-6,3],[-5,5],[-7,8],[-6,5],[-7,4],[-7,3],[-2,4],[5,9],[1,9],[-3,6],[-3,4],[-6,2],[-13,4],[-7,3],[-7,4],[-9,7],[-2,4],[0,3],[2,4],[3,5],[-2,4],[-6,4],[-5,2],[-17,11]],[[4693,5212],[118,5],[22,-2],[22,-4],[26,-2],[18,-3],[2,-1],[1,-2],[-1,-1],[-2,-2],[-1,-2],[0,-2],[6,-4],[4,-1],[4,0],[9,4],[3,0],[13,2],[15,3],[3,1],[3,1],[4,3],[1,2],[11,5],[12,4],[2,2],[3,3],[7,4]],[[4998,5225],[23,-15],[8,-9],[3,-2],[3,-1],[4,0],[15,-1],[10,-2],[13,-3],[49,-16],[30,-8],[7,-2],[4,-3],[3,-4],[2,-2],[15,-11],[2,-2],[1,-2],[1,-1],[0,-2],[-1,-2],[-5,-3],[-1,-2],[-2,-8],[1,-7],[0,-1]],[[4606,7343],[0,-9],[-1,-2],[-3,-3],[-15,-4],[-4,-3],[-1,-2],[1,-8],[2,-2],[5,-4],[1,-2],[0,-2],[-3,-2],[-7,-1],[-11,-1],[-3,0],[-25,-11],[-9,-3],[-3,-1],[-3,-2],[-11,-7],[-3,-2],[-2,-3],[2,-3],[2,-2],[1,-2],[-1,-2],[-5,-3],[-5,-2],[-5,0],[-4,0],[-3,1],[-3,1],[-6,3],[-3,0],[-4,1],[-5,0],[-4,0],[-4,-1],[-3,-1],[-1,-3],[1,-3],[5,-7],[4,-3],[4,-2],[3,-1],[1,-2],[-1,-4],[-5,-6],[-5,-8],[0,-10],[-1,-12],[-1,-2],[0,-3],[0,-4],[-1,-2],[-1,-1],[-5,-3],[-7,-4],[-2,-1],[-2,-2],[-1,-4],[-2,-2],[-2,-1],[-10,-3],[-3,-1],[-2,-2],[-1,-2],[0,-2],[2,-8],[4,-4],[6,-4],[25,-11],[8,-4],[8,-9],[3,-4],[0,-3],[-2,-1],[-2,-2],[-1,-2],[9,-6],[54,-14],[95,-3],[86,8],[16,0],[4,0],[16,3],[5,0],[19,0],[6,0],[4,1],[2,1],[8,6],[2,0],[13,3],[4,1],[7,-1],[9,-2],[16,-6],[7,-3],[4,-2],[4,-1],[5,-1],[9,0],[5,1],[5,1],[6,2],[3,0],[4,0],[1,-3],[-1,-2],[-1,-1],[-2,-2],[0,-2],[1,-4],[-1,-2],[-1,-1],[-2,-2],[-1,-1],[1,0],[3,-2],[31,-9],[10,-1],[10,-1],[34,-1],[17,-1],[33,-7],[7,-3],[2,-2],[1,-2],[1,-4],[0,-2],[-1,-2],[-4,-2],[-11,-4],[-3,-2],[-7,-5],[-14,-7],[-2,-2],[-8,-6],[-3,-1],[-4,-3],[-3,-4],[-1,-2],[-2,-8],[-3,-3],[-19,-8],[-6,-1],[-8,0],[-7,-1],[-12,-3],[-6,-1],[-6,0],[-26,4],[-30,1],[-7,-1],[-8,-1],[-24,-7],[-30,-7],[-4,-1],[-14,-2],[-46,-2],[-9,3],[-9,3],[-3,1],[-4,1],[-5,-1],[-9,-2],[-12,-2],[-8,0],[-16,-4],[-4,-2],[-8,0],[-13,-1],[-41,2],[-16,1],[-12,3],[-7,-1],[-5,-1],[-28,-9],[-43,-12],[14,-12],[1,-3],[1,-8],[2,-2],[6,-1],[4,0],[7,2],[3,0],[1,-2],[-1,-19],[0,-3],[2,-3],[12,-10],[8,-6],[37,-19],[4,-4],[2,-3],[0,-4],[-2,-11],[1,-4],[6,-5],[6,-2],[5,0],[4,0],[4,-1],[4,-1],[2,-1],[2,-2],[10,-9],[0,-3],[-1,-3],[-6,-7],[-2,-6],[-1,-14],[-8,-15],[5,-10],[3,-2],[4,-2],[11,-1],[43,-2],[14,1],[10,0],[4,-1],[6,-2],[5,-3],[10,-7],[7,-3],[4,-4],[2,-3],[5,-21],[18,-6],[10,-7],[18,-19],[1,-1],[1,-5],[1,-11],[-1,-2],[-3,-6],[0,-2],[0,-2],[0,-2],[7,-2],[11,-3],[58,-8],[28,-9],[17,-1],[43,-6],[38,-8],[19,-3],[5,0],[30,0],[13,-1],[5,-1],[13,-4],[11,-6],[7,-25],[11,-14],[3,-3],[3,-2],[29,-14],[4,-3],[16,-15],[3,-5],[2,-2],[32,-17],[2,-2],[5,-5],[0,-3],[1,-3],[-2,-8],[0,-3],[2,-3],[3,-1],[12,-2],[3,-1],[3,-1],[2,-1],[4,-3],[1,-2],[1,-3],[-1,-4],[0,-2],[1,-2],[2,-2],[5,-2],[2,-2],[1,-2],[1,-5],[1,-8],[-1,-2],[-1,-2],[-3,-1],[-6,-1],[-8,0],[-26,2],[-7,2],[-3,0],[-7,3],[-7,3],[-9,4],[-4,1],[-4,-1],[-7,-2],[-4,-4],[-15,-9],[-55,-10],[-14,1],[-2,1],[-2,1],[-3,1],[-4,1],[-6,-1],[-7,-1],[-10,-4],[-14,-6],[-11,-5],[-6,-4],[-25,-13],[-8,-3],[-3,-2],[-2,-2],[-3,-3],[-3,-2],[-4,-2],[-38,-13],[-2,-2],[-2,-1],[-4,-1],[-8,-2],[-16,-2],[-8,0],[-7,0],[-4,1],[-10,-2],[-83,-18],[-19,-1],[-6,0],[-10,0],[-58,-5],[-36,-1],[-5,-2],[-5,-3],[-6,-7],[-1,-4],[1,-3],[9,-6],[-8,-5],[-48,-13],[4,-15],[12,-32],[1,-5],[2,-2],[3,-2],[2,-1],[2,-2],[1,-2],[1,-7],[5,-7],[15,-36],[3,-2],[4,-3],[5,-2],[8,-4],[7,-6],[6,-7],[6,-5],[1,-2],[2,-4],[2,-1],[2,-2],[2,-1],[-1,-2],[-3,-3],[-3,-1],[-5,-1],[-6,-1],[-17,2],[-8,0],[-7,-1],[-13,-1],[-17,2],[-5,1],[-4,1],[-6,0],[-26,-3],[-28,-6],[-16,-7],[-2,-2],[-1,-3],[7,-14],[0,-3],[-1,-2],[-6,-5],[-4,-2],[-4,-2],[-3,-1],[-3,-7],[6,-28],[37,-14],[10,-3],[20,-3],[21,-2],[32,-5],[47,-11],[11,-1],[19,-4],[8,0],[5,-1],[4,1],[12,2],[4,1],[8,-1],[41,-14],[10,-2],[5,0],[5,0],[3,1],[10,5],[7,2],[3,1],[6,-1],[8,-4],[13,-8],[9,-3],[6,-1],[4,0],[4,1],[5,0],[4,-1],[3,0],[4,-1],[2,-1],[15,-8],[5,-4],[3,-4],[1,-2],[0,-3],[-2,-3],[-5,-3],[-8,-3],[-4,-5],[1,-13],[-4,-11],[-34,-1],[-19,1],[-11,0],[-5,0],[-6,-2],[-7,-2],[-5,-5],[0,-1],[-1,0],[-6,-3],[-30,-10],[6,-12],[-6,-7],[-3,-2],[-1,-2],[2,-4],[6,-3],[3,-3],[11,-3],[3,-1],[3,-1],[2,-1],[16,-13],[5,-6],[3,-2],[2,-1],[3,-2],[4,0],[4,0],[4,-1],[3,-2],[4,-3],[4,-1],[4,-1],[11,3],[3,0],[2,-2],[2,-1],[1,-3],[0,-3],[-2,-14],[0,-4],[4,-8],[0,-2],[-1,-3],[-3,-2],[-9,-2],[-7,-1],[-39,-1],[-5,-4],[8,-8],[0,-3],[0,-2],[-4,-3],[-3,-2],[-6,-2],[-3,-2],[-1,-1],[-2,-2],[-2,-8],[-4,-8],[0,-5],[12,-25],[8,-12],[4,-3],[2,-2],[1,-2],[38,-43],[8,-6],[4,-3],[1,-2],[1,-3],[-2,-3],[-8,-6],[-30,-11],[-10,-3],[-4,-2],[-3,-1],[-9,-7],[-3,-1],[-8,-4],[-20,-6],[-3,-1],[-3,-1],[-2,-2],[-1,-2],[2,-3],[3,-5],[1,-4],[1,-6],[1,-2],[3,-1],[8,-2],[3,0],[3,-2],[2,-1],[1,-2],[1,-2],[-1,-2],[-4,-3],[-9,-4],[-6,-3],[-5,-5],[-4,-3],[-5,-3],[-10,-3],[-7,-1],[-5,0],[-6,2],[-7,2],[-4,0],[-4,-1],[-5,-1],[-7,-2],[-4,-1],[-4,1],[-4,1],[-4,0],[-4,0],[-4,-1],[-2,-1],[1,-6],[2,-3],[22,-19],[58,-34],[7,-9],[-2,-2],[-3,-4],[0,-2],[-1,-2],[1,-2],[3,-2],[6,-2],[14,-3],[7,0],[6,0],[21,3],[8,1],[5,0],[14,-1],[11,-2],[5,-3],[6,-4],[14,-14],[7,-5],[45,-25],[15,-11],[15,-4],[7,-2],[7,-2],[5,-2],[5,-3],[4,-2],[2,-4],[0,-5],[-5,-5],[-7,-3],[-15,-3],[-6,-3],[-4,-3],[-4,-5],[-6,-3],[-6,-2],[-13,-2],[-7,-2],[-7,-1],[-6,0],[-6,0],[-8,-1],[-6,-2],[-5,-2],[-4,-3],[-1,-2],[3,-4],[5,-4],[19,-5],[8,-1],[11,-2],[11,-2],[6,-1],[7,1],[12,-1],[6,0],[7,0],[8,0],[9,-1],[7,-4],[14,-14],[3,-6],[1,-3],[-7,-12]],[[4693,5212],[-73,3],[-29,-1],[-17,-1],[-8,0],[-6,0],[-7,1],[-18,2],[-64,1],[-9,1],[-8,2],[-4,0],[-3,-1],[-2,-2],[-2,-4],[-1,-2],[-3,-3],[-3,-6],[-2,-3],[-3,-2],[-19,-3],[-4,-1],[-11,-6],[-10,-3],[-7,-1],[-5,0],[-13,2],[-3,1],[-5,2],[-3,1],[-7,2],[-6,2],[-5,3],[-3,1],[-2,1],[-6,1],[-47,3],[-12,2],[-10,2],[-10,3],[-3,1],[-16,3],[-3,1],[-12,2],[-12,1],[-7,1],[-7,-1],[-6,-1],[-23,-1],[-7,-2],[-4,-1],[-2,-1],[-3,-1],[-1,-2],[-1,-4],[-4,-2],[-11,-3],[-27,-1],[-7,0],[-7,2],[-7,2],[-3,1],[-11,2],[-31,3]],[[4028,5208],[-26,4],[-28,10],[-8,5],[-6,4],[-8,16],[-7,38],[12,21],[13,12],[5,3],[10,4],[7,4],[8,10],[2,5],[0,4],[-1,2],[-2,1],[-2,2],[-3,2],[-2,2],[-2,4],[2,3],[17,14],[4,5],[2,7],[3,4],[3,2],[8,0],[5,1],[8,4],[3,2],[1,3],[-2,2],[-3,3],[-2,2],[-1,2],[-1,12],[-1,2],[-1,2],[-4,3],[-5,2],[-8,4],[-1,19],[-7,10],[-4,2],[-9,2],[-6,3],[-2,2],[0,2],[15,10],[2,2],[6,3],[2,5],[0,3],[-7,13],[21,8],[3,2],[2,2],[0,6],[4,6],[18,11],[5,4],[3,5],[-2,3],[-2,2],[-15,3],[-6,2],[-5,2],[-2,2],[-2,3],[-6,15],[-2,3],[-3,1],[-4,3],[-4,5],[-3,2],[-3,2],[-2,3],[-6,12],[-1,1],[-6,5],[-5,2],[-3,2],[-7,6],[-12,22],[-5,8],[1,1],[5,3],[5,3],[9,7],[3,4],[0,3],[-11,12],[-7,6],[-5,9],[-8,21],[-12,16],[-95,77],[-5,23],[-4,19],[-5,5],[-11,7],[-4,2],[-3,1],[-18,3],[-46,4],[-43,0],[-9,0],[-17,-2],[-12,-3],[-23,-11],[-14,-5],[-42,-7],[-53,-6],[-25,-6],[-45,-17],[-10,-2],[-17,-2],[-30,1],[-14,-1],[-30,-3],[-17,-4],[-40,-16],[-11,-6],[-11,-22],[-8,-8],[-6,-2],[-9,-1],[-8,2],[-9,5],[-28,24],[-6,10],[1,13],[6,7],[3,9],[1,6],[-14,32],[0,7],[3,5],[11,10],[4,3],[4,4],[4,9],[1,5],[-1,4],[-2,3],[-7,4],[-29,11],[-53,11],[-2,0],[-57,-1],[-23,2],[-27,4],[-44,12],[-30,12],[2,6],[-27,4],[6,10],[-3,23],[-18,44],[-1,23],[3,11],[8,12],[10,9],[16,5],[11,5],[5,1],[9,1],[4,0],[4,0],[52,-1],[72,10],[12,3],[5,14],[13,11],[22,8],[29,2],[10,-2],[14,-5],[9,-1],[46,4],[25,3],[19,8],[36,22],[72,27],[15,9],[3,2],[4,1],[6,2],[7,2],[11,0],[9,-1],[9,1],[9,7],[10,-1],[-6,39],[3,5],[11,26],[5,7]],[[3519,6341],[8,6],[7,5],[0,3],[14,16],[13,22],[18,6],[141,14],[25,0],[18,-3],[37,-17],[69,-43],[95,6],[26,-3],[7,-3],[53,28],[18,14],[37,63],[17,14],[11,5],[21,-3],[26,1],[20,2],[20,3],[22,5],[31,11],[23,14],[11,17],[-3,20],[-26,34],[-20,16],[-8,37],[-13,31],[-4,28],[2,6],[5,6],[5,3],[7,2],[5,3],[8,8],[-1,4],[-26,11],[-21,12],[-7,9],[1,43],[5,10],[14,10],[9,10],[-5,11],[-76,59],[-18,24],[10,17],[11,2],[26,0],[13,3],[8,5],[3,5],[12,203],[-9,13],[-13,22],[-7,9],[-4,4],[-2,2],[-2,1],[-6,7],[-30,43],[-2,8],[1,10],[7,12],[10,10],[23,17],[70,37],[11,11],[3,6],[16,16],[24,13],[28,10],[26,2],[9,-1],[13,-4],[10,-11],[1,-7],[-3,-6],[-6,-8],[-3,-6],[0,-7],[6,-5],[10,-4],[37,-8],[24,-3],[28,3],[49,12],[18,2],[12,0],[34,-13]],[[5621,4196],[-4,-7],[-15,-5],[-19,-7],[-63,-13],[-23,-2],[-3,1],[-4,1],[-4,7],[-1,1],[-1,2],[0,1],[0,6],[-4,6],[-8,4],[-15,6],[-9,3],[-7,1],[-11,1],[-20,3],[-6,2],[-4,2],[-25,15],[-6,3],[-5,1],[-3,0],[-13,1],[-16,3],[-9,1],[-6,0],[-4,-1],[-2,-1],[-4,-1],[-3,-1],[-5,0],[-15,0],[-12,2],[-4,0],[-8,-1],[-10,-2],[-10,-2],[-8,-18],[-1,-59]],[[5231,4149],[-12,-8],[-9,-20],[-9,-8],[-4,3],[-9,4],[-2,4],[-7,-2],[-7,-2],[-5,-2],[-4,-2],[8,-3],[25,-15],[37,-11],[29,-12],[0,-17],[-22,-13],[-28,-10],[-18,-15],[7,-23],[44,-36],[16,-18],[1,-22],[-6,-8],[-20,-16],[-9,-24],[-12,-3],[-37,4],[3,-5],[5,-5],[7,-4],[8,-4],[-14,0],[-25,3],[-14,1],[0,-4],[15,-4],[6,-2]],[[5169,3850],[-16,2],[-41,17],[-35,18],[-9,4],[-10,2],[-14,2],[-60,6],[-96,3],[-144,-4],[-56,2],[-3,13],[6,24],[-1,7],[-9,20],[-13,13],[-22,15],[-16,9],[-8,6],[-6,7],[-39,79],[-9,8],[-201,159],[-35,38],[-7,5],[-8,3],[-10,1],[-12,-2],[-14,-4],[-29,-16],[-14,-10],[-14,-6],[-18,-6],[-64,-16],[-14,-7],[-28,-24],[-18,-10],[-37,-13],[-25,-6],[-21,-10],[-30,-27]],[[3969,4152],[-59,41],[-24,14],[-25,8],[-76,13],[-18,4],[-16,4],[-20,2],[-18,4],[-16,6],[-11,6],[-21,16],[-17,21],[-9,23],[0,11],[14,6],[21,11],[4,8],[0,21],[5,13],[1,2],[0,4],[-4,4],[-20,9],[-27,10],[11,21],[-5,19],[-42,54],[-6,5],[-4,5],[0,12],[-4,5],[-5,5],[-8,13],[-6,5],[-6,3],[-18,6],[-6,2],[-49,26],[-27,11],[-5,5],[-11,4],[-14,9],[-70,41],[-20,8],[-18,9],[-11,3]],[[3309,4684],[-76,27],[-19,12],[-5,9],[4,10],[8,11],[2,23],[5,12],[17,6],[4,8],[3,2],[5,0],[12,-1],[6,1],[34,7],[11,3],[25,11],[21,16],[10,20],[-10,22],[-12,10],[-10,5],[-1,7],[2,2],[3,4],[28,12],[57,16],[16,6],[7,7],[3,4],[2,4],[0,22],[19,11],[81,7],[59,32],[34,8],[67,9],[24,2],[66,-1],[147,10],[33,0],[16,-1],[9,-1],[29,-8],[7,1],[2,1],[3,2],[1,2],[1,2],[0,12],[0,4],[1,2],[2,2],[5,3],[15,5],[2,2],[2,2],[6,20],[0,14],[-3,9],[-2,5],[-7,5],[-26,17],[-3,3],[-2,5],[-1,8],[-9,16],[-11,10],[0,6]],[[5169,3850],[8,-3],[11,-6],[5,-7],[-2,-8],[-17,-12],[-6,-12],[-16,-18],[-17,-2],[-8,-3],[2,-5],[11,-5],[-20,-13],[-19,-8],[-44,-15],[-11,-6],[-20,-15],[-21,-29],[-44,-15],[-26,-15],[-64,-11],[-68,-7],[-68,-3],[-40,14],[-26,2],[-22,6],[-75,25],[-18,8],[-8,8],[-1,13],[-4,10],[-7,9],[-22,21],[-7,11],[-3,11],[-1,12],[10,8],[45,14],[13,5],[-33,2],[-56,-21],[-40,-3],[7,-5],[19,-10],[4,-5],[7,-20],[12,-8],[29,-16],[6,-10],[-3,-6],[-11,-12],[-2,-5],[3,-6],[13,-11],[53,-34],[18,-14],[19,-6],[10,-7],[-17,-13],[-18,-5],[-22,-21],[-70,-11],[-64,-7],[-23,-4],[-28,-1],[-23,3],[-10,11],[-13,6],[-79,14],[12,-5]],[[4269,3579],[0,1],[-12,2],[-11,6],[-6,1],[-11,1],[-56,1],[-22,2],[-7,1],[-24,6],[-19,10],[-1,7],[-2,3],[-5,3],[-19,4],[-10,6],[6,8],[5,3],[39,18],[9,5],[4,5],[-2,3],[-1,2],[-6,5],[2,22],[-2,3],[-5,5],[-5,2],[-12,10],[15,4],[13,6],[15,17],[7,21],[-8,14],[-19,14],[-11,12],[0,13],[8,9],[1,3],[3,0],[24,21],[-4,14],[-23,13],[-23,10],[-8,7],[-2,4],[0,5],[-1,4],[1,10],[-9,7],[-15,7],[-18,14],[-10,10],[-9,7],[-27,13],[-23,7],[-11,6],[-6,5],[-5,5],[-6,4],[-21,7],[-16,34],[-2,15],[10,22],[7,10],[33,30],[13,24]],[[6105,3125],[-5,-7],[-8,10],[-7,37],[5,-4],[5,-3],[3,-3],[2,-5],[8,-8],[0,-9],[-3,-8]],[[5996,3497],[-26,-12],[-34,6],[-7,23],[-13,8],[-44,17],[11,16],[15,5],[2,12],[-5,13],[-9,10],[-13,10],[-6,5],[-3,7],[4,4],[7,2],[4,3],[-7,6],[11,7],[18,5],[20,4],[19,2],[46,-10],[26,-4],[23,-1],[4,-10],[1,-10],[-24,-16],[-1,-8],[3,-21],[-2,-11],[-6,-5],[-7,-5],[-6,-4],[-4,-8],[2,-4],[-4,-19],[5,-17]],[[6703,2968],[-34,0],[1,-6],[8,-8],[6,-8],[-5,-9],[-23,-19],[-5,-10],[8,-12],[34,-17],[1,0],[5,-11],[-3,-6],[-6,-4],[-5,-6],[0,-4]],[[6685,2848],[-60,0],[-20,0],[-14,2],[-7,1],[-4,2],[-11,5],[-13,7],[-42,33],[-10,5],[-8,1],[-9,0],[-29,-5],[-20,-2],[-38,-2],[-14,0],[-22,-2],[-7,-3],[-5,-4],[-6,-20],[-7,-14],[-9,-11],[-19,-18],[-23,-17],[-15,-8],[-26,-8],[-2,-1]],[[6245,2789],[-1,0],[7,5],[2,6],[0,12],[2,6],[10,8],[3,4],[-4,13],[-9,8],[-15,5],[-18,5],[6,4],[8,3],[11,1],[12,-1],[-4,4],[-6,7],[-5,4],[14,9],[4,10],[-4,42],[4,9],[13,9],[-30,0],[-17,2],[-12,6],[-29,23],[-2,4],[-1,9],[2,14],[-4,6],[-14,5],[4,5],[5,3],[8,2],[10,1],[12,18],[6,-3],[10,2],[21,8],[-8,6],[-29,38],[1,7],[14,14],[-8,7],[-27,32],[1,3],[4,4],[0,4],[-3,5],[-5,3],[4,5],[0,8],[-6,8],[-9,6],[-5,5],[2,5],[4,4],[3,4],[-4,4],[-15,9],[-5,4],[2,3],[10,4],[3,4],[1,34],[-6,7],[-17,2],[7,15],[-23,13],[-61,19],[-30,18],[-31,14],[-7,4],[0,2],[-8,22],[1,5],[3,4],[5,3],[10,0],[17,4],[12,8],[9,9],[21,60],[11,11],[3,6],[-2,7],[-3,5],[-11,10],[-12,20],[-3,23],[4,23],[11,21],[17,16],[24,13],[33,10],[41,4]],[[6143,3683],[-56,-18],[-25,-4],[-20,-1],[-71,4],[-29,-1],[-25,-2],[-7,-2],[-5,-2],[-6,-3],[-8,-1],[-7,1],[-13,2],[-7,1],[-33,-1],[-22,-3],[-18,-7],[-18,-11],[-37,78],[0,13],[-8,13],[-21,-15],[-28,4],[-34,20],[-17,18],[-11,20],[0,14],[16,11],[-10,7],[-3,5],[1,5],[7,14],[-8,0],[-10,-12],[-3,-6],[-2,-8],[-12,4],[-4,6],[0,8],[1,8],[15,14],[-9,3],[-10,0],[-12,-3],[-9,10],[4,14],[13,26],[0,9],[-4,4],[-18,9],[-7,4],[-9,7],[-7,8],[-1,7],[19,13],[31,-3],[35,-6],[30,6],[-43,10],[-22,3],[-23,1],[-26,-2],[-11,-7],[-7,-9],[-13,-10],[-18,11],[-15,17],[-5,17],[15,9],[0,4],[-23,2],[-8,8],[-3,12],[-11,10],[-23,5],[-27,4],[-19,6],[7,11],[-121,40],[-10,5],[-6,5],[-3,9],[1,17],[-6,7]],[[1676,4894],[27,0],[39,2],[8,-4],[2,-12],[-7,-16],[0,-6],[3,-6],[10,-12],[2,-6],[-3,-12],[-10,-12],[-17,-10],[-23,-7],[-20,-2],[-28,1],[-25,2],[-11,4],[-6,7],[-13,6],[-27,11],[-107,58],[-5,4],[-10,14],[103,3],[25,5],[13,8],[12,2],[22,-11],[24,-8],[11,-2],[11,-1]],[[1809,5221],[19,-9],[18,5],[24,1],[25,-1],[21,-7],[20,-7],[43,-11],[16,-8],[4,-8],[-2,-11],[-7,-10],[-13,-4],[-16,-3],[-25,-16],[-18,-7],[-2,-1],[-4,-1],[-7,-1],[-7,1],[-2,3],[-2,2],[-5,1],[-14,-3],[0,-4],[4,-5],[-1,-4],[-9,-2],[-13,-1],[-24,1],[-23,-1],[-7,1],[-12,4],[-14,6],[-26,18],[-5,7],[-3,5],[-10,7],[-3,6],[-1,1],[-3,1],[-2,2],[-1,3],[2,2],[6,0],[5,0],[2,3],[-9,9],[-15,4],[-37,5],[-16,5],[-11,6],[-19,18],[11,1],[5,2],[-1,4],[-7,4],[43,25],[10,0],[9,-1],[21,-1],[8,-1],[11,-4],[5,-4],[4,-4],[7,-4],[53,-19]],[[1493,5366],[-7,-9],[-62,23],[-18,12],[-37,57],[-5,18],[22,-1],[23,-7],[11,-5],[9,-5],[3,-3],[8,-5],[15,-4],[16,-5],[7,-8],[-4,-25],[4,-9],[13,-16],[2,-8]],[[944,5401],[-7,0],[-6,9],[-5,23],[-8,9],[-15,10],[-69,57],[-4,9],[-2,3],[-6,2],[-6,3],[-1,5],[4,5],[5,2],[7,0],[7,-4],[19,-5],[7,-4],[7,-5],[4,-4],[2,-5],[4,-8],[52,-61],[8,-19],[3,-22]],[[518,6182],[31,-6],[56,-40],[67,-34],[27,-19],[9,-11],[10,-10],[15,-11],[22,-9],[16,-3],[14,1],[13,4],[26,13],[12,3],[14,1],[20,-1],[194,-17],[11,-5],[7,-8],[13,-54],[9,-9],[9,-6],[53,-16],[9,-18],[5,-4],[10,-6],[19,-7],[166,-48],[68,-15],[30,-1],[29,4],[23,0],[20,-2],[23,-5],[18,-1],[14,1],[25,9],[14,4],[24,4],[10,4],[3,5],[-4,6],[-15,15],[-3,2],[-4,3],[-4,3],[-3,3],[-2,4],[-1,6],[5,31],[6,7],[8,6],[23,7],[40,-2],[11,-3],[17,-7],[17,-11],[16,-13],[3,-3],[5,-4],[8,-11],[4,-8],[5,-6],[8,-3],[31,-1],[19,-2],[17,-5],[27,-13],[12,-8]],[[1922,5862],[-1,-64],[11,-9],[14,-3],[46,-3],[18,-4],[18,-7],[13,-7],[12,-9],[4,-5],[144,-108],[16,-15],[26,-35],[16,-14],[54,-29],[-4,-33],[6,-8],[8,-9],[20,-8],[3,-1],[34,-15],[19,-11],[8,-9],[2,-7],[-3,-7],[-12,-17],[-6,-14],[1,-8],[3,-8],[47,-46],[43,-90],[24,-57],[10,-10],[102,-67],[27,-22],[6,-9],[-1,-6],[-8,-1],[-11,0],[-9,-7],[-1,-12],[17,-30],[12,-14],[13,-8],[14,-2],[20,-2],[36,-9],[53,-26],[40,-43],[18,-11],[13,0],[48,-28],[7,-7],[10,-10],[-1,-8],[-7,-5],[-14,-4],[-19,-3],[-36,-2],[-14,-3],[-3,-4],[1,-3],[4,-3],[5,-3],[48,-20],[22,-16],[-1,-7],[-6,-6],[-34,-15],[-12,-11],[3,-10],[28,-27],[4,-9],[-4,-8],[-4,-7],[-6,-12],[0,-6],[0,-4],[50,-41],[14,-8],[17,-9]],[[2957,4624],[48,-42],[12,-22],[1,-29],[-19,-42],[2,-54],[-20,-22],[0,-8],[2,-7],[4,-6],[4,-3],[10,-7],[30,-25],[0,-9],[-1,-10],[-14,-17],[-7,-28],[-16,-17],[-56,-30],[-10,-9],[-2,-9],[0,-16],[-6,-19],[-3,-40],[-13,-18],[-37,-31],[-11,-3],[-9,2],[-7,2],[-17,8],[-21,7],[-18,1],[-26,2],[-22,4],[-76,25]],[[2659,4152],[-2,7],[4,9],[1,6],[-5,8],[-8,7],[-4,3],[-2,3],[0,6],[7,14],[19,-3],[22,-10],[20,-6],[-6,7],[-21,18],[1,6],[4,6],[-6,5],[-17,9],[-13,10],[-6,11],[-4,24],[-11,11],[-47,20],[-10,16],[-3,31],[-7,14],[-40,38],[-3,7],[7,8],[34,7],[12,5],[3,12],[-5,13],[-11,11],[-21,15],[-1,6],[0,6],[-3,6],[-7,5],[-12,6],[-5,3],[-7,21],[-8,11],[-18,4],[-51,-2],[-22,0],[-15,6],[-2,5],[0,7],[2,7],[4,5],[9,1],[12,-7],[17,3],[15,-6],[11,0],[9,2],[13,10],[9,2],[-13,9],[-6,9],[-11,8],[-27,3],[-17,4],[-7,8],[-5,10],[-9,8],[-57,29],[-23,15],[-16,16],[16,-2],[3,5],[-10,44],[-5,6],[-111,49],[0,3],[9,0],[20,-7],[41,1],[75,6],[-17,4],[-13,4],[-27,-9],[-17,3],[-33,23],[-33,19],[-6,10],[1,15],[-12,-4],[-5,-7],[0,-8],[2,-6],[-17,-2],[-24,2],[-22,6],[-13,8],[-11,-2],[-4,-1],[-17,9],[-6,16],[5,15],[18,10],[-14,18],[-2,8],[3,6],[11,9],[2,4],[11,10],[3,1],[-2,4],[-3,4],[-1,3],[29,9],[9,4],[-16,0],[-26,-4],[-11,0],[-18,4],[-2,4],[6,5],[5,9],[-1,5],[-7,12],[1,8],[5,7],[15,14],[3,6],[-8,44],[4,9],[11,5],[11,11],[5,12],[-8,8],[-11,-14],[-29,-25],[-6,-15],[9,-27],[0,-16],[-12,-8],[-14,-5],[-17,-11],[-24,-7],[-29,7],[-5,5],[-2,13],[-4,6],[-13,3],[-10,-4],[-7,-7],[0,-7],[5,-4],[36,-16],[9,-6],[1,-5],[-4,-4],[-2,-7],[2,-35],[6,-10],[7,-6],[19,-11],[4,-6],[-2,-6],[-5,-8],[-1,-5],[-4,-5],[-26,-15],[-3,0],[-10,-2],[-2,-1],[0,-3],[2,-4],[3,-3],[3,-1],[-15,-5],[-12,5],[-14,7],[-46,7],[-58,26],[-22,5],[-49,9],[-17,6],[-9,5],[-6,5],[-7,5],[-12,4],[-12,1],[-8,-1],[-8,1],[-10,7],[-2,6],[3,12],[-5,5],[-6,5],[-6,6],[-5,6],[-2,5],[-8,8],[-38,15],[-15,8],[-30,29],[-12,3],[-65,40],[-12,11],[-4,9],[1,22],[7,8],[19,8],[25,5],[25,-1],[8,-4],[4,-5],[5,-4],[10,-2],[38,0],[22,-16],[6,-12],[-17,-8],[49,-15],[25,-5],[33,-2],[6,-13],[35,-11],[47,-6],[42,1],[34,9],[72,24],[23,11],[0,2],[-2,7],[2,2],[3,1],[9,1],[3,1],[19,13],[7,8],[1,9],[-4,17],[6,7],[1,4],[-7,4],[-7,-1],[-35,-3],[-26,3],[-10,5],[5,6],[20,4],[-12,3],[-11,1],[-27,0],[-11,1],[-30,14],[-45,13],[-23,10],[-9,11],[-10,6],[-41,8],[-10,7],[8,10],[20,6],[25,0],[24,-3],[-7,9],[9,8],[16,8],[12,8],[-16,11],[-7,3],[-8,-15],[-17,-14],[-26,-8],[-33,1],[-11,4],[-9,7],[-4,8],[2,10],[8,6],[26,6],[11,6],[-33,1],[-15,-8],[-7,-10],[-10,-5],[-50,0],[-13,6],[-1,12],[-14,-13],[-8,-5],[-16,-3],[0,34],[6,7],[60,39],[21,7],[27,1],[38,-2],[-11,6],[-3,7],[5,4],[17,1],[-6,5],[-7,4],[-8,2],[-10,1],[-7,-2],[0,-8],[-4,-2],[-57,0],[-12,-1],[-8,-2],[-10,0],[-20,0],[-3,-2],[-9,-9],[-7,-4],[-15,0],[-16,2],[-13,4],[-9,5],[6,2],[8,3],[8,2],[-41,8],[-12,5],[15,6],[-17,4],[-5,6],[5,6],[17,1],[-3,4],[-4,4],[-14,-3],[-11,-4],[-8,-5],[-4,-6],[-6,3],[-13,5],[-6,2],[-8,-12],[-6,-4],[-12,-1],[-13,2],[-13,5],[-11,7],[-4,5],[-6,13],[-23,27],[-1,13],[-9,0],[0,-20],[-3,-10],[-11,-3],[-7,7],[-17,33],[-7,0],[-8,-11],[-16,-8],[-21,-6],[-24,-3],[-30,1],[-33,5],[-28,2],[-15,-5],[-17,3],[-15,5],[-13,6],[-9,7],[2,-10],[8,-8],[21,-18],[23,-36],[66,-58],[2,-14],[-22,8],[-18,14],[-28,28],[-18,27],[-14,14],[-18,7],[-25,-7],[-8,-16],[5,-17],[20,-20],[6,-16],[5,-8],[14,-8],[5,-1],[5,-1],[3,-3],[11,-7],[0,-1],[-22,11],[-10,2],[-6,1],[-10,7],[-14,14],[-59,41],[-8,9],[-4,14],[-12,9],[-29,15],[-23,14],[-12,6],[-5,5],[-2,15],[-4,7],[20,-3],[60,3],[13,3],[12,6],[17,12],[3,-2],[2,-2],[2,-3],[0,-3],[8,0],[24,27],[6,5],[0,4],[-35,-5],[-47,-22],[-32,-9],[-31,2],[-3,17],[15,28],[20,9],[25,40],[16,9],[28,5],[11,12],[10,26],[-20,-7],[-11,-22],[-14,-7],[-18,1],[-10,10],[-4,14],[2,11],[42,34],[17,20],[-14,11],[-5,-10],[-9,-12],[-13,-11],[-15,-9],[-14,-12],[-3,-15],[5,-29],[-9,-23],[-24,-20],[-65,-40],[-42,-40],[-4,-1],[-6,-3],[-10,-3],[-14,0],[-8,1],[-6,3],[-10,7],[-70,25],[-12,6],[1,8],[5,8],[10,7],[14,7],[72,22],[41,4],[46,7],[-10,3],[-9,1],[-23,0],[-13,0],[-4,3],[-2,3],[-8,5],[-27,10],[-10,5],[-7,6],[-10,47],[-6,9],[-13,5],[-25,1],[5,-12],[-13,-11],[-18,-4],[-12,9],[17,2],[6,1],[-31,11],[-10,16],[-6,18],[-18,15],[-23,15],[-41,31],[-31,10],[27,-24],[50,-34],[5,-5],[9,-42],[23,-29],[1,-8],[-8,-25],[9,-54],[-9,-11],[-8,7],[-20,11],[-10,8],[-49,58],[-23,15],[-103,43],[-11,8],[-11,25],[-14,10],[-41,18],[-8,6],[-4,4],[-6,3],[-16,2],[-12,1],[-23,8],[-11,1],[-19,5],[-11,11],[-12,24],[-61,80],[-19,14],[-8,8],[-12,47],[-6,7],[-45,17],[-7,8],[-7,8],[-26,10],[-9,8],[-6,9],[4,8],[6,16],[1,10],[-8,21],[1,11],[6,9],[31,20],[15,22],[12,11],[19,1],[35,0],[42,22],[36,-5],[14,-9],[5,-8],[2,-9],[8,-10],[10,-4],[11,-3],[26,-4],[47,-2],[37,4],[28,-3],[22,-21],[8,-22],[8,-10],[14,-7],[22,1],[26,7],[22,10],[10,9],[-2,5]],[[2171,7526],[6,-5],[7,-35],[6,-9],[20,-21],[7,-14],[-15,-50],[-6,-14],[-10,-39],[-1,-1],[-2,-3],[-5,-3],[-8,-4],[-5,-2],[-10,1],[-17,2],[-36,10],[-1,0],[-7,1],[-6,-1],[-4,0],[-7,-5],[0,-15],[8,-13],[3,-8],[-6,-39],[-5,-4],[-10,-3],[-27,1],[-12,-3],[12,-19],[1,-9],[-14,-25],[-1,-6],[4,-28],[19,-50],[1,-10],[-5,-22],[-24,-41],[-1,-7],[6,-6],[4,-7],[8,-7],[5,-35],[-9,-19],[-6,-4],[-6,-15],[14,-35]],[[2036,6905],[9,-28],[12,-18],[1,-9],[-4,-20],[13,-54],[-1,-7],[-12,-13],[2,-4],[15,-1],[9,-2],[4,-4],[-4,-8],[-24,-18],[-4,-7],[0,-9],[31,-71],[1,-11],[-5,-13],[-22,-24],[-5,-11],[25,-36],[8,-9],[2,-2],[1,-4],[-5,-4],[-18,-4],[-11,-4],[-7,-4],[-11,-16],[-4,-34],[4,-20],[16,-18],[43,-35],[52,-39],[20,-16],[6,-6],[0,-9],[-6,-9],[-55,-54],[-20,-62],[-33,-28],[27,-12],[45,-13],[15,-5],[7,-7],[4,-10],[3,-35],[-3,-13],[-7,-11],[-71,-57],[-7,-22],[2,-5],[36,-34],[9,-12],[9,-23],[6,-8],[9,-7],[32,-19],[3,-3],[3,-3],[0,-4],[-8,-5],[-25,-6],[-95,-11],[-30,1],[-20,2],[-81,24]],[[518,6182],[-2,6],[-40,53],[-12,27],[-3,13],[-16,126],[20,81],[-4,16],[-16,31],[9,2],[9,2],[7,3],[7,3],[12,7],[14,2],[14,0],[12,3],[8,8],[0,7],[-2,7],[0,8],[6,10],[3,0],[6,-1],[4,2],[1,5],[-4,15],[3,7],[11,4],[27,-4],[71,-23],[72,-30],[19,-12],[9,-15],[6,-15],[12,-5],[13,5],[10,15],[8,11],[17,3],[18,-5],[15,-9],[5,-3],[7,-2],[7,1],[8,1],[2,2],[2,1],[1,3],[0,4],[-2,4],[-3,4],[-7,6],[-4,7],[2,7],[21,18],[10,4],[14,1],[20,4],[-3,4],[1,36],[-1,4],[2,3],[13,2],[11,0],[29,-2],[20,-3],[16,-5],[17,-3],[24,3],[-20,17],[0,6],[1,1],[6,0],[24,4],[11,1],[9,3],[5,6],[0,5],[-9,62],[-14,22],[-39,19],[-10,8],[-11,18],[-1,12],[12,21],[2,11],[-7,10],[-25,20],[-9,10],[-4,11],[10,42],[37,15],[4,-1],[10,12],[40,21],[16,11],[2,10],[-7,10],[-22,19],[-9,11],[-6,15],[2,14],[14,10],[27,4],[22,-2],[17,-8],[15,-10],[24,-8],[29,0],[29,7],[21,8],[17,10],[46,41],[1,6],[-3,7],[0,8],[9,35],[-5,23],[2,9],[7,8],[21,14],[4,5],[1,4],[-2,6],[-7,31],[0,15],[36,102],[-2,17],[-5,6],[-15,9],[-7,6],[-35,10],[-18,62],[1,19],[-4,8],[-4,4],[-7,2],[-9,5],[-24,18],[-9,8],[-6,10],[-2,11],[2,10],[0,3],[8,12],[14,8],[29,5],[22,-5],[31,-22],[11,-6],[37,-16],[7,-8],[4,-6],[8,-5],[20,-1],[24,1],[34,8],[19,3],[7,-2],[6,-3],[6,-3],[11,1],[7,3],[5,3],[4,4],[3,5],[27,7],[54,1],[56,-3],[35,-5],[45,-27],[23,-5],[88,5],[32,-3],[32,-5],[38,-5],[26,-2],[63,-15],[18,-6],[16,-10],[16,-8],[19,-1],[13,7]],[[1355,2364],[-22,-6],[10,39],[3,7],[4,1],[7,-7],[4,-24],[-6,-10]],[[1699,2784],[-15,-7],[-16,1],[12,6],[7,9],[12,8],[23,5],[0,-3],[-10,-9],[-13,-10]],[[2921,3272],[-29,-2],[-33,4],[-26,7],[0,3],[22,7],[17,11],[23,22],[29,19],[19,8],[5,-7],[2,-8],[11,-14],[2,-7],[-5,-7],[-20,-15],[-17,-21]],[[2484,3295],[-9,0],[0,4],[16,13],[-8,19],[-30,33],[8,16],[30,10],[40,8],[36,13],[12,9],[17,17],[8,6],[34,15],[69,39],[35,12],[22,-12],[6,-26],[-15,-27],[-28,-25],[-55,-32],[-11,-4],[-18,-5],[-61,-9],[-16,-4],[-7,-3],[0,-4],[1,-5],[-1,-4],[-11,-6],[-24,-9],[-11,-7],[5,-8],[-9,-8],[-25,-16]],[[4269,3579],[55,-22],[1,-13],[-54,-29],[-43,-17],[-20,-4],[-22,1],[-1,4],[8,7],[3,10],[-19,-8],[-13,-9],[-16,-7],[-28,-2],[4,5],[4,14],[-80,-36],[-23,-17],[-23,-2],[-23,2],[-11,7],[-1,9],[-4,11],[-8,9],[-11,5],[9,-50],[-8,-11],[-32,-21],[-7,-10],[0,-25],[-3,-6],[-25,-21],[-157,-77],[-69,-23],[-33,-14],[-18,-5],[-21,-4],[-25,-1],[-71,5],[-18,2],[-7,7],[-6,51],[9,5],[13,3],[11,7],[6,10],[-4,8],[27,12],[18,15],[11,18],[5,17],[-1,11],[-5,9],[-17,16],[-3,10],[4,7],[8,6],[6,10],[-7,0],[-8,-5],[-11,-5],[-9,-5],[-3,-6],[5,-9],[15,-16],[3,-10],[-3,-24],[-4,-7],[-33,-19],[-17,-23],[-25,-14],[-25,-5],[-15,14],[8,11],[19,14],[15,15],[-4,18],[-37,-28],[-17,-17],[-7,-18],[7,-39],[-13,-13],[-43,-4],[-32,5],[-21,16],[-11,19],[-1,21],[25,59],[-10,17],[-23,-29],[-11,22],[13,22],[31,18],[40,7],[37,-1],[12,1],[9,3],[-4,2],[-11,2],[-13,0],[-8,1],[-5,5],[-6,1],[-6,0],[-17,-3],[-8,0],[-8,-2],[-7,2],[-7,7],[-8,0],[-8,-9],[-31,-20],[-26,-10],[-3,-14],[7,-27],[-1,-14],[-20,-65],[-9,-13],[-14,-9],[-12,-2],[-15,-1],[-14,-2],[-5,-4],[-3,-4],[-4,-4],[-6,-3],[-6,-2],[-29,-1],[-13,1],[-38,8],[-50,2],[-13,4],[13,10],[12,3],[12,3],[11,3],[7,7],[0,4],[-4,5],[-6,4],[-5,2],[-21,-12],[-12,-3],[-5,13],[1,17],[-1,6],[-14,15],[-2,7],[6,7],[12,8],[14,7],[10,3],[19,2],[20,3],[15,7],[4,10],[-39,-11],[-5,10],[-5,23],[-19,17],[0,8],[6,8],[21,15],[14,7],[19,4],[26,2],[21,3],[17,7],[13,9],[7,10],[-5,-3],[-15,-7],[-3,-3],[-6,-3],[-26,-2],[-21,-4],[-24,0],[-11,-2],[-27,-16],[-3,-3],[-12,-5],[-6,-10],[-1,-23],[2,-6],[10,-11],[3,-5],[2,-3],[4,-2],[2,-3],[-14,-11],[-2,-3],[-10,-7],[-66,-20],[-14,-10],[-32,-33],[-11,-7],[-16,-6],[-19,-4],[-22,-1],[-28,4],[-11,7],[-5,10],[-10,11],[-3,-9],[-12,1],[-13,7],[-10,8],[30,10],[41,10],[42,12],[33,19],[10,26],[8,5],[10,4],[9,5],[4,5],[3,4],[0,11],[5,2],[9,3],[9,4],[1,7],[-21,-5],[-10,-7],[-15,-16],[-30,-23],[-8,-11],[-14,-12],[-18,-7],[-20,-6],[-63,-28],[-28,-6],[-26,2],[-4,14],[29,18],[60,25],[23,19],[17,22],[9,23],[-3,23],[-17,17],[-4,9],[9,9],[13,9],[22,32],[7,4],[10,1],[14,-1],[0,4],[-12,6],[-18,50],[1,6],[5,6],[7,3],[9,1],[7,3],[1,8],[-39,-9],[-15,1],[-8,12],[-7,-12],[15,-46],[0,-31],[-6,-8],[-26,-14],[-6,-7],[-7,-14],[-17,-12],[-24,-9],[-25,-3],[-2,3],[11,9],[25,14],[23,21],[-6,9],[-13,-1],[-13,-8],[-9,-17],[-7,-6],[-10,-4],[-10,-2],[-14,1],[-9,3],[-7,4],[-8,3],[-21,2],[-6,-5],[3,-21],[-1,-12],[-5,-10],[-7,-8],[-57,-44],[-30,-17],[-36,-8],[-23,-2],[-16,-3],[-11,-8],[-3,-14],[-9,-6],[-21,-4],[-23,0],[-16,4],[-23,-11],[-16,-4],[-13,4],[-28,21],[-5,7],[-1,8],[7,60],[25,61],[-3,40],[3,6],[4,3],[14,7],[5,4],[16,42],[-5,32],[5,6],[40,-6],[25,1],[11,10],[9,16],[-3,8],[-21,4],[0,3],[27,6],[11,9],[0,27],[3,8],[10,15],[2,6],[5,8],[21,10],[4,7],[-2,22],[-5,9],[-14,13],[-5,8],[4,8],[9,2],[11,-1],[13,-2],[12,1],[14,4],[32,21],[-22,0],[10,8],[5,10],[-2,35],[2,5],[4,5],[18,13],[7,7],[5,9],[-3,9],[-31,7],[-6,6],[2,8],[11,5],[52,-11],[8,2],[4,3],[9,2],[8,3],[3,5],[-6,4],[-9,2],[-10,2],[-6,2],[-4,7],[4,24],[7,7],[16,1],[14,3],[1,12],[14,-1],[15,-3],[13,-4],[11,-6],[-19,35],[-10,55]],[[2957,4624],[18,7],[35,13],[30,9],[27,3],[33,-3],[28,-10],[24,-11],[29,-6],[30,0],[22,9],[9,9],[9,13],[0,12],[9,8],[22,6],[21,1],[6,0]],[[2036,6905],[31,2],[16,0],[16,1],[15,3],[7,3],[6,2],[9,7],[7,0],[11,-2],[8,-7],[2,-5],[-1,-4],[-1,-2],[0,-2],[12,-4],[2,-1],[1,-2],[2,-5],[2,-2],[11,-8],[10,-5],[19,-8],[48,-25],[51,-42],[30,-29],[4,-7],[3,-10],[-5,-8],[-43,-39],[-7,-8],[-3,-5],[-1,-8],[15,-61],[7,-10],[8,-6],[10,-5],[10,-1],[13,0],[33,4],[22,0],[18,-17],[9,-3],[14,-3],[13,-2],[9,-4],[6,-9],[4,-11],[1,-15],[-22,-87],[5,-7],[9,-4],[21,-7],[29,-8],[22,-3],[19,-2],[11,2],[6,1],[26,11],[22,5],[59,9],[20,1],[32,-2],[21,-3],[18,-2],[17,1],[44,4],[46,1],[21,3],[50,2],[85,-8],[146,-2],[30,9],[35,3],[19,-1],[27,-4],[9,-7],[32,-16],[20,-18],[12,-7],[18,-6],[9,-5],[4,-7],[0,-12],[3,-8],[15,-4],[24,-11],[20,-6],[45,-6]],[[4606,7343],[21,5],[31,16],[18,7],[15,7],[20,14],[5,5],[4,4],[2,3],[8,8],[1,3],[0,4],[1,5],[1,2],[5,5],[2,4],[-1,4],[26,15],[13,5],[19,3],[5,2],[5,2],[22,18],[5,6],[35,28],[3,5],[0,5],[-1,4],[-3,3],[-3,2],[-4,3],[-16,7],[-3,2],[-3,3],[-7,12],[-2,3],[-8,7],[-2,3],[-3,28],[-2,4],[-8,3],[-2,1],[-4,1],[-5,1],[-6,1],[-7,1],[-7,0],[-8,0],[-12,-2],[-5,-1],[-15,-6],[-12,-9],[-9,-4],[-9,-1],[-11,2],[-13,8],[-3,7],[4,7],[11,6],[17,6],[195,39],[47,6],[46,3]],[[4999,7678],[25,-13],[3,-25],[10,-9],[24,-13],[82,-26],[20,-5],[13,-2],[12,0],[8,2],[7,4],[11,5],[12,2],[9,0],[7,-3],[7,-6],[6,-12],[9,-12],[5,-12],[-1,-17],[-12,-16],[-14,-10],[-11,-5],[-14,-4],[-93,-16],[-7,-2],[-3,-2],[-1,-3],[2,-3],[5,-4],[1,0],[105,-15],[6,0],[14,3],[18,0],[52,-5],[39,-5],[10,-4],[1,-2],[-2,-12],[1,-3],[4,-6],[3,-2],[4,-2],[7,-1],[15,-1],[9,-1],[22,1],[41,0],[84,16],[12,1],[33,0],[8,0],[6,1],[4,1],[3,1],[14,6],[9,3],[7,1],[8,2],[18,1],[6,0],[19,-2],[4,0],[3,2],[2,2],[2,2],[4,2],[6,2],[7,1],[4,0],[10,-2],[28,12],[10,3],[3,0],[1,0],[4,0],[14,-1],[25,1],[57,19],[15,2],[113,9],[34,6],[19,4],[8,4],[9,10],[-2,9]],[[6081,7534],[9,2],[23,3],[23,5],[57,24],[21,7],[25,3],[16,1],[15,2],[21,7],[44,23],[15,4],[239,42],[85,9],[42,-1],[82,-9],[42,0],[18,2],[35,10],[19,3],[44,1],[44,-1],[32,-4],[44,-14],[30,-7],[17,-3],[13,4],[17,2],[31,7],[46,4],[38,7],[113,4],[42,5],[11,4],[2,-1],[7,-15],[-19,-17],[-101,-30],[-54,-20],[-20,-4],[-21,-2],[-19,-4],[-5,-4],[8,-5],[10,-8],[-2,-5],[-9,-13],[-1,-7],[8,-39],[-3,-4],[-5,-3],[0,-3],[13,-5],[11,-2],[25,0],[34,-4],[44,-4],[17,-5],[6,-8],[2,-27],[8,-9],[46,-32],[8,-3],[1,-3],[-8,-7],[-8,-4],[-52,-13],[-13,-6],[-4,-8],[21,-27],[11,-4],[23,4],[21,0],[16,-7],[13,-11],[16,-21],[3,-11],[-3,-10],[-9,-9],[-9,-3],[-13,-2],[-10,-3],[1,-5],[7,-2],[41,1],[15,-14],[-56,-45],[-1,-17],[83,-4],[41,-5],[22,-1],[21,1],[19,-1],[7,-8],[7,-10],[18,-9],[22,-4],[19,0],[42,2],[10,0],[28,-4],[16,-1],[5,-1],[2,0],[10,1],[6,-2],[0,-10],[3,-3],[8,-3],[8,-3],[9,0],[13,3],[24,9],[10,2],[20,3],[10,4],[9,9],[14,7],[21,2],[20,-6],[33,-20],[25,-7],[83,-1],[16,-5],[3,-7],[-4,-8],[-2,-8],[10,-9],[40,-25],[3,-12],[-25,-9],[-34,1],[-61,14],[-18,-3],[-3,-6],[7,-24],[-3,-9],[-12,-9],[-27,-14],[-23,-21],[-9,-3],[-13,-2],[-13,-2],[-11,-4],[-10,-4],[0,-14],[52,-58],[3,-12],[-12,-18],[-3,-10],[3,-6],[10,-9],[2,-5],[-5,-6],[-9,-6],[-69,-32],[-44,-10],[-7,-7],[4,-4],[6,-4],[2,-6],[-5,-7],[-20,-10],[-8,-6],[-13,-26],[-8,-8],[-37,-22],[-7,-10],[17,-9],[-34,-8],[24,-11],[51,-10],[46,-5],[85,-4],[39,1],[67,13],[15,1],[57,-11],[17,0],[37,2],[105,-12],[10,-3],[9,-4],[10,-9],[5,-3],[22,-5],[11,4],[12,8],[22,5],[17,-2],[67,-16],[9,-3],[6,-5],[9,-2],[14,1],[9,4],[0,10],[7,4],[21,2],[84,-7],[-9,-7],[0,-7],[6,-7],[12,-5],[17,-17],[-12,-21],[-39,-38],[-2,-12],[4,-9],[19,-18],[12,-30],[12,-9],[40,-9],[95,-1],[43,-6],[16,-6],[8,-4],[4,-3],[-3,-5],[-8,-1],[-11,-1],[-12,-3],[-13,-8],[-10,-9],[-7,-8],[-3,-8],[0,-9],[5,-11],[8,-11],[11,-7],[23,-7],[38,-24],[28,-5],[12,3],[36,13],[15,4],[34,5],[16,4],[15,7],[13,9],[13,6],[18,3],[23,1],[23,-2],[17,-5],[34,-12],[5,-9],[10,-8],[15,-4],[20,1],[25,2],[54,-4],[29,1],[56,7],[26,6],[18,8],[47,11],[58,28],[45,30],[42,16],[48,11],[107,14],[21,4],[56,18],[13,5],[15,4],[16,2],[40,-4],[7,-8],[3,-26],[9,-5],[15,-4],[13,-10],[8,-11],[-2,-8],[8,-6],[-7,-6],[-11,-7],[-4,-10],[6,-8],[2,-9],[-5,-8],[-15,-4],[-155,-56],[-104,-25],[-16,-2],[-37,-17],[-12,-4],[-41,-8],[-25,-2],[-22,4],[-8,3],[-10,1],[-9,1],[-11,1],[-14,-2],[-4,-4],[1,-6],[-2,-6],[-35,-65],[-58,-47],[-13,-8],[-21,-5],[-50,-5],[-20,-4],[13,-15],[2,-4],[-6,-3],[-21,-7],[-4,-2],[-3,-12],[-10,-21],[-2,-11],[20,-6],[99,8],[32,-4],[0,-3],[-28,-12],[-21,-7],[-10,-4],[-33,-8],[-36,-5],[-26,-1],[-47,6],[-97,8],[-21,-2],[-15,-7],[-10,-8],[-14,-8],[-44,-5],[-17,-7],[-29,-16],[-30,-12],[-11,-6],[-5,-9],[-5,-7],[-25,-16],[-8,-8],[0,-7],[-14,-14],[-12,-18],[-14,-47],[-11,-17],[-2,-11],[-5,-9],[-11,-8],[-12,-6],[-3,-8],[0,-7],[2,-9],[-49,14],[-8,6],[-6,5],[-7,4],[-15,4],[-16,2],[-13,0],[-12,2],[-13,7],[-10,4],[-5,5],[-2,5],[-7,5],[-12,4],[-5,0],[-5,-1],[-61,-4],[-25,-4],[-20,-5],[-12,-9],[-15,-19],[-10,-8],[-19,-8],[-19,-3],[-45,0],[-23,-2],[-42,-8],[-21,-2],[-11,1],[-17,6],[-10,2],[-11,0],[-21,-1],[-10,0],[-86,13],[-54,17],[-16,2],[-21,-3],[10,-9],[41,-19],[9,-10],[13,-31],[36,-18],[8,-8],[-6,-13],[-11,-9],[-2,-1],[-11,-3],[-13,-3],[-14,-7],[-37,-14],[-134,-19],[-28,-2],[-23,6],[-43,16],[-19,4],[-46,6],[-21,1],[-46,-3],[-49,-9],[-41,-14],[-22,-18],[-12,-36],[1,-5],[7,-10],[1,-5],[-3,-2],[-6,-3],[-5,-4],[-2,-5],[4,-13],[5,-10],[1,-10],[-8,-13],[-15,-11],[-16,-6],[-43,-8],[-39,-13],[-18,-2],[-21,15],[-14,5],[-16,5],[-33,7],[-65,-22],[-21,-4],[-99,-6],[-19,-4],[-10,-4],[-19,-11],[-8,-3],[-25,-2],[-22,-4],[-12,-4],[-1,-4],[-5,-1],[-19,4],[-11,5],[-9,4],[-9,4],[-13,-1],[-3,0],[-39,-9],[-50,-1],[-52,2],[-45,0],[-50,-11],[-28,-3],[-20,7],[-3,5],[2,11],[-6,5],[-8,2],[-37,6],[-45,18],[-23,6],[-28,-2],[-15,2],[-13,9],[-17,7],[-23,-3],[-8,-7],[-14,-34],[1,-10],[9,-19],[0,-9],[-6,-7],[-9,-2],[-11,1],[-12,-2],[-10,-4],[-16,-9],[-9,-3],[-69,-16],[-19,-1]],[[6536,105],[-22,-3],[-21,2],[-12,7],[9,10],[16,3],[18,-2],[12,-8],[0,-9]],[[6755,245],[23,-3],[5,1],[3,1],[15,-2],[0,-4],[-17,1],[-7,-1],[0,-3],[1,-4],[7,-4],[9,-2],[5,-3],[-6,-5],[-21,-3],[-13,-9],[-7,-9],[-9,-5],[-17,-3],[-39,-12],[-16,1],[-4,-6],[-5,-5],[-2,-4],[3,-3],[-29,-22],[-13,-6],[-3,10],[-12,-2],[-3,11],[1,14],[2,7],[5,5],[3,15],[15,2],[8,4],[4,3],[3,2],[6,2],[5,4],[4,5],[4,4],[8,3],[30,8],[32,13],[22,4]],[[6689,250],[-10,-15],[0,41],[-3,3],[-10,7],[-3,5],[4,5],[8,5],[3,5],[-7,4],[0,4],[19,0],[29,-8],[21,-3],[0,-2],[-1,-1],[-3,0],[-4,0],[-3,-3],[-3,-3],[-1,-2],[7,-3],[-17,-5],[-12,-4],[-7,-5],[-7,-25]],[[6371,462],[12,0],[6,1],[6,-4],[6,-3],[9,-9],[-6,-4],[-6,-2],[-7,-1],[-10,1],[10,-8],[6,-3],[-24,-5],[-19,2],[-4,7],[16,10],[-7,7],[-5,10],[3,9],[17,3],[-10,-8],[7,-3]],[[6703,468],[-16,-1],[-9,10],[5,8],[14,4],[18,2],[17,1],[-1,-2],[-3,-2],[-1,-1],[-8,-12],[-16,-7]],[[7087,652],[-13,-19],[-16,-5],[-19,0],[-13,3],[7,7],[9,2],[9,0],[6,0],[3,5],[-4,4],[-8,1],[-10,0],[-9,-3],[0,7],[-7,8],[-3,8],[-1,7],[3,6],[28,-7],[26,-10],[12,-14]],[[6372,665],[-29,-7],[8,6],[4,5],[0,5],[-4,6],[6,14],[18,6],[22,0],[22,-2],[-12,-15],[-15,-10],[-20,-8]],[[6719,702],[4,-11],[1,-10],[6,-9],[13,-6],[15,-5],[12,-7],[3,-9],[0,-11],[7,-8],[21,-1],[-10,-7],[-4,-6],[2,-6],[12,-6],[-6,0],[-1,0],[0,-2],[-1,-2],[-13,-11],[-10,-5],[-19,-2],[-15,2],[-6,6],[2,17],[5,-1],[3,-2],[16,6],[-4,5],[-20,7],[0,8],[9,16],[-1,9],[-5,1],[-15,3],[-3,1],[-1,5],[-1,3],[-2,2],[-20,12],[-22,9],[-2,-3],[-4,-2],[-2,-2],[-7,18],[-11,2],[-10,0],[-7,-2],[-3,-6],[-7,-3],[-34,-11],[-12,-2],[-14,5],[10,9],[27,13],[3,2],[15,5],[5,2],[3,3],[3,10],[5,3],[14,2],[20,-1],[22,-4],[16,-6],[11,-8],[7,-9]],[[6962,722],[-9,0],[-3,6],[3,9],[11,5],[10,-1],[2,-8],[-6,-6],[-8,-5]],[[7074,734],[2,-15],[-2,-3],[-8,-2],[-5,4],[-1,5],[0,4],[-11,-2],[-8,-3],[-4,-5],[0,-5],[-25,5],[-10,9],[2,11],[9,8],[19,6],[7,4],[5,4],[2,5],[-3,10],[1,3],[11,9],[8,-2],[6,-7],[9,-20],[0,-8],[-4,-15]],[[6778,871],[7,-1],[10,1],[9,0],[4,-3],[-8,-6],[-17,-4],[-36,-5],[0,7],[-4,9],[-13,5],[-11,5],[-2,3],[13,3],[23,1],[32,0],[-7,-10],[0,-5]],[[6787,1009],[-9,-15],[-8,4],[-2,-3],[-3,-2],[-2,-2],[-1,-4],[-10,5],[-16,9],[-4,4],[-8,-4],[-3,-3],[0,-3],[3,-5],[-18,0],[-9,-4],[3,-4],[17,-2],[-11,-3],[-13,-1],[-13,0],[-11,1],[-13,3],[0,2],[0,8],[11,-1],[10,1],[9,3],[8,5],[-3,5],[-5,11],[-4,4],[-1,5],[10,4],[12,3],[6,2],[-2,5],[-5,1],[-6,3],[-2,6],[4,4],[15,5],[7,10],[8,2],[7,1],[5,1],[0,6],[-7,10],[-1,6],[5,11],[33,29],[5,23],[7,7],[15,0],[16,-11],[13,-15],[5,-10],[-3,-5],[-7,-1],[-8,-1],[-5,-2],[-2,-5],[2,-16],[-13,-22],[-3,-11],[9,-11],[-15,-13],[1,-30]],[[5891,1156],[3,-5],[-17,2],[-5,2],[-17,8],[21,-1],[15,-6]],[[7077,1162],[5,-4],[4,-5],[3,-7],[2,-5],[-1,-16],[-11,-16],[3,-41],[-3,-6],[-16,-9],[-3,-6],[1,-8],[5,-12],[1,-7],[-12,4],[-18,10],[-8,4],[-12,2],[-15,1],[-13,3],[-7,4],[-19,-10],[-10,1],[-4,9],[3,12],[-9,-4],[-5,1],[-4,2],[-4,4],[8,11],[-10,7],[-14,5],[-7,4],[-13,15],[3,7],[26,2],[-7,4],[-20,8],[-4,4],[3,7],[6,2],[7,1],[7,2],[5,2],[8,2],[3,3],[-12,1],[-12,0],[-10,0],[-8,2],[-5,5],[26,2],[49,-3],[17,1],[-4,2],[-2,2],[-3,3],[15,0],[31,-3],[14,1],[26,3],[14,-1],[10,-2]],[[6531,1136],[6,-11],[27,3],[-2,-6],[-7,-5],[-10,-4],[-11,-3],[9,-2],[5,-3],[-1,-4],[-6,-5],[19,-11],[7,-4],[5,-7],[-27,7],[-9,4],[-2,3],[-7,3],[-16,12],[-20,5],[-6,4],[15,2],[4,5],[0,10],[-7,10],[-17,3],[6,14],[-14,29],[16,12],[-2,-20],[2,-6],[6,-3],[28,-11],[8,-7],[1,-14]],[[6102,1196],[6,-14],[-5,1],[-18,3],[-9,12],[0,7],[24,14],[11,-5],[4,-5],[-2,-5],[-9,-5],[-2,-3]],[[6788,1197],[-11,-6],[-14,0],[-8,2],[0,14],[2,10],[10,3],[22,-7],[5,-7],[-6,-9]],[[6763,1229],[-9,-1],[-8,1],[-21,15],[9,7],[19,4],[9,-2],[2,-5],[7,-10],[-1,-5],[-7,-4]],[[7050,1272],[24,-6],[20,3],[17,-5],[32,-13],[43,-5],[19,-5],[-1,-8],[0,4],[-30,-5],[-65,0],[-23,-4],[-18,-8],[-22,-7],[-23,-4],[-19,2],[-17,15],[-4,7],[-1,7],[3,5],[11,7],[2,5],[-2,5],[-6,2],[-7,2],[-13,6],[-5,2],[-3,2],[-2,6],[0,16],[-9,16],[0,7],[9,6],[8,-5],[30,-13],[23,-15],[18,-17],[11,-5]],[[6581,1373],[-1,-6],[10,3],[15,2],[14,1],[6,-4],[3,-23],[-3,-5],[-9,8],[-14,7],[-18,1],[-20,-5],[-6,2],[-3,0],[-1,1],[-16,12],[-22,11],[-5,7],[3,10],[10,11],[14,11],[15,4],[21,0],[19,-3],[12,-4],[5,-9],[-1,-5],[-3,-10],[-4,-5],[-6,-4],[-8,-3],[-7,-5]],[[6580,1461],[-10,-3],[-7,1],[-8,1],[-10,1],[-1,-3],[-18,-15],[-10,-5],[-11,-3],[-12,-2],[-9,-1],[-2,-3],[-9,-19],[-11,9],[-4,2],[-5,9],[-14,1],[-16,-2],[-11,3],[3,7],[14,6],[11,5],[-5,7],[-15,-5],[-4,-2],[-4,-3],[-8,0],[2,15],[16,6],[23,3],[35,9],[12,1],[6,-2],[-6,-5],[-11,-5],[-5,-4],[2,-3],[10,-5],[15,2],[6,-1],[10,-1],[-1,6],[1,6],[4,5],[20,4],[6,6],[4,7],[4,3],[16,-3],[12,-9],[4,-12],[-9,-9]],[[7037,1485],[-14,-3],[-15,3],[-9,8],[16,36],[13,10],[16,-9],[3,-9],[-3,-29],[-7,-7]],[[6787,1534],[-25,-4],[-26,5],[-8,6],[0,6],[4,13],[4,2],[7,1],[8,1],[4,4],[3,3],[6,-3],[5,-4],[1,-2],[25,-16],[-8,-12]],[[6319,1564],[-13,-12],[-1,2],[-2,2],[-3,1],[-3,2],[-1,3],[-2,1],[-4,0],[-7,-1],[0,4],[5,3],[-3,2],[-6,3],[-4,4],[5,2],[10,2],[11,2],[5,-2],[4,-9],[7,-4],[2,-5]],[[6918,1570],[27,-22],[4,13],[10,17],[14,9],[18,-11],[4,-14],[0,-21],[-6,-19],[-10,-12],[-72,-51],[-46,-19],[-53,7],[10,11],[5,3],[4,11],[15,22],[4,12],[-2,5],[-10,7],[-5,7],[-5,2],[-1,3],[4,3],[9,3],[7,3],[-1,3],[-21,18],[-12,24],[-1,25],[15,22],[19,-9],[61,-7],[20,-10],[0,-4],[-8,-23],[3,-8]],[[6321,1673],[-12,0],[-18,3],[-2,11],[8,7],[12,0],[13,-9],[4,-8],[-5,-4]],[[6801,1841],[9,-1],[7,3],[9,1],[13,-3],[7,-6],[-2,-3],[-13,-6],[-7,-4],[-6,-2],[-5,-3],[-5,-5],[-2,-5],[2,-17],[13,-22],[1,-11],[-14,-7],[-1,11],[-15,13],[1,9],[-8,10],[-15,33],[-25,33],[-5,11],[-2,10],[3,24],[6,6],[16,-1],[8,-8],[22,-53],[8,-7]],[[6389,2210],[-8,0],[-3,8],[-1,15],[5,14],[15,3],[7,-4],[-7,-6],[-4,-10],[-4,-20]],[[6685,2848],[0,-2],[4,-6],[22,-18],[8,-12],[-2,-19],[2,-11],[4,-3],[12,-4],[3,-3],[0,-3],[-4,-8],[9,-10],[60,-44],[134,-60],[15,-11],[9,-11],[6,-13],[9,-7],[13,-3],[15,-3],[77,-74],[51,-29],[9,-4],[14,-5],[8,-1],[17,-2],[8,-2],[7,-3],[15,-9],[7,-3],[17,0],[13,2],[11,0],[27,-25],[25,-12],[132,-47],[23,-5],[27,-3],[20,-6],[11,-9],[2,-12],[6,-9],[36,-20],[13,-10],[11,-12],[11,-6],[34,-12],[5,-3],[6,-8],[4,-3],[6,-2],[16,-2],[5,-1],[6,-5],[2,-3],[0,-4],[-3,-6],[0,-10],[13,-25],[8,-8],[37,-16],[6,-5],[6,-5],[0,-13],[-3,-12],[2,-45],[40,-81],[1,-11],[-5,-26],[3,-10],[0,-5],[-4,-6],[-7,-4],[-4,-5],[0,-7],[14,-20],[5,-11],[-3,-9],[-1,0],[-15,-7],[-44,-2],[-22,-4],[-13,-8],[0,-11],[4,-12],[-4,-13],[-9,-12],[-6,-12],[5,-11],[25,-9],[19,-5],[20,-9],[16,-10],[2,-10],[-4,-6],[-6,-5],[-4,-5],[-1,-7],[2,-4],[15,-16],[4,-17],[3,-5],[9,-6],[22,-9],[9,-7],[4,-10],[-2,-11],[1,-9],[12,-9],[10,-2],[25,-2],[12,-4],[5,-5],[2,-10],[4,-4],[11,-3],[26,-4],[8,-4],[7,-5],[11,-6],[12,-4],[55,-14],[11,-8],[1,-5],[3,-8],[0,-11],[-3,-12],[-5,-5],[-12,-12],[-2,-5],[4,-11],[26,-21],[7,-11],[3,-30],[4,-10],[6,-6],[17,-10],[7,-6],[3,-5],[-2,-10],[1,-6],[4,-5],[12,-11],[4,-5],[-2,-7],[-9,-5],[-11,-4],[-6,-5],[4,-10],[16,-1],[62,9],[12,0],[9,-2],[5,-4],[-3,-5],[-4,-6],[-2,-6],[-18,-25],[-3,-14],[17,-8],[21,-3],[16,-6],[7,-9],[-1,-11],[-17,-21],[-4,-11],[8,-12],[14,-8],[20,-8],[21,-6],[19,-3],[3,-5],[-17,-35],[-9,-13],[-72,-45],[-13,-5],[-46,-1],[-26,-2],[-18,-6],[-10,-8],[-1,-13],[2,-21],[-4,-9],[-11,-10],[-13,-9],[-32,-15],[-11,-9],[-6,-13],[-2,-9],[-7,-9],[-42,-21],[-12,-8],[-17,-22],[-13,-11],[-36,-21],[-14,-11],[-34,-48],[-7,-4],[-24,-4],[-11,-3],[-8,-5],[-11,-11],[-7,-5],[-12,-4],[-9,-3],[-44,-11],[-18,-9],[-5,-4],[-10,-16],[-9,-7],[-11,0],[-12,3],[-13,2],[-14,1],[-5,1],[-5,0],[-10,-5],[-6,-5],[-5,-5],[-2,-6],[-1,-6],[2,-6],[9,-11],[0,-7],[-4,-11],[-5,-4],[-8,-5],[-5,0],[-40,-8],[-12,0],[-9,2],[-11,1],[-14,-3],[-10,-5],[-5,-6],[-4,-5],[-8,-4],[-8,-1],[-24,-1],[-10,-2],[-22,-9],[-49,-30],[-11,-12],[-10,-23],[4,-6],[22,-9],[7,-6],[16,-33],[-1,-11],[-16,-20],[-11,-27],[-21,-32],[-8,-1],[-6,-3],[-4,-3],[-14,-13],[-18,-26],[-7,-21],[-10,-8],[-25,-12],[-23,-16],[-60,-59],[-33,-22],[-19,-7],[-9,5],[-2,5],[-10,7],[-4,5],[-1,5],[2,11],[-1,5],[-7,17],[-1,24],[-22,17],[-4,6],[-1,4],[2,3],[18,22],[6,8],[5,25],[13,19],[0,11],[-18,31],[-21,15],[0,11],[8,22],[-6,22],[-36,39],[-5,22],[1,23],[4,7],[15,3],[24,-1],[14,-5],[20,-16],[11,6],[0,8],[-9,7],[-11,4],[13,4],[13,-1],[11,-4],[10,-6],[8,9],[8,14],[6,6],[19,13],[3,7],[-7,9],[12,0],[10,1],[9,2],[7,4],[-12,2],[-27,2],[-10,2],[-5,3],[-3,4],[3,4],[35,4],[13,7],[10,6],[15,3],[6,-1],[12,-5],[10,-2],[2,2],[16,3],[16,1],[3,-2],[7,6],[5,10],[1,9],[-6,8],[9,3],[-7,5],[-20,7],[-4,3],[3,6],[6,2],[8,2],[10,2],[6,7],[-4,7],[-9,9],[-5,12],[-19,-3],[-14,4],[-20,17],[49,6],[24,7],[10,10],[0,17],[14,15],[6,11],[7,3],[2,3],[-14,9],[-22,25],[-5,9],[-1,9],[6,10],[-27,-4],[-5,5],[9,19],[10,10],[23,4],[43,2],[-10,7],[-2,20],[-10,9],[-10,1],[-19,-3],[-9,2],[-3,5],[9,9],[-6,4],[15,9],[3,8],[-4,19],[3,9],[6,12],[12,9],[18,-1],[13,4],[9,-2],[8,-3],[12,-2],[12,2],[2,5],[-1,6],[5,5],[15,1],[21,-1],[20,-4],[14,-4],[7,0],[-16,16],[-80,7],[-25,10],[9,13],[24,12],[15,12],[-19,14],[8,-10],[-6,-6],[-11,-4],[-10,-6],[-26,-22],[-7,0],[-20,1],[-4,-2],[-3,-1],[-13,-7],[-3,-1],[-12,-3],[-4,-6],[-1,-8],[-5,-7],[-12,-5],[-9,-2],[-11,1],[-30,8],[-34,12],[-7,4],[-2,6],[-6,6],[0,4],[3,4],[13,11],[6,2],[6,-1],[4,1],[-2,5],[-30,0],[18,12],[5,3],[8,1],[11,0],[8,-1],[3,0],[10,7],[9,10],[14,7],[28,1],[-13,8],[-24,-1],[-47,-7],[-91,0],[11,11],[22,4],[55,0],[19,2],[21,5],[17,7],[13,11],[13,3],[14,1],[6,1],[1,18],[-1,6],[-8,8],[-9,7],[-2,6],[10,8],[-53,-2],[-7,4],[-15,5],[-12,7],[0,6],[8,6],[-6,5],[-7,5],[1,7],[8,3],[14,2],[25,2],[0,4],[-16,0],[10,6],[32,8],[15,6],[4,6],[-3,7],[-8,5],[-8,2],[-37,-3],[-24,-6],[-22,-9],[-28,-7],[-9,2],[-19,3],[-9,2],[-18,8],[-9,10],[2,10],[13,10],[18,6],[21,3],[99,10],[24,6],[9,11],[-7,8],[-17,5],[-37,7],[-27,12],[-7,3],[-15,2],[-2,6],[6,11],[1,12],[5,7],[14,3],[25,2],[42,0],[14,1],[8,4],[1,4],[-7,1],[-10,1],[-14,5],[-10,2],[-12,1],[-13,-1],[-11,1],[-11,3],[-8,11],[9,11],[14,11],[8,12],[4,1],[8,0],[8,0],[4,0],[-1,4],[-8,7],[3,15],[6,7],[8,5],[7,3],[5,4],[2,8],[-4,2],[-30,-4],[-15,1],[-7,3],[-1,3],[4,4],[8,2],[12,0],[11,0],[7,5],[-10,3],[-47,-3],[-11,6],[-1,6],[2,-2],[6,1],[11,3],[9,0],[5,2],[5,6],[-19,43],[-10,3],[-27,14],[-12,5],[11,11],[8,5],[8,2],[-4,3],[-16,19],[-11,11],[-3,5],[-4,21],[2,6],[9,4],[-7,15],[-6,39],[-14,7],[-14,4],[-58,22],[-6,19],[-6,6],[-11,-7],[-5,5],[-3,5],[-1,6],[1,6],[-14,16],[0,7],[14,5],[-1,4],[-1,4],[2,10],[-10,-3],[-6,-4],[-6,-11],[1,9],[-4,8],[-6,7],[-7,6],[-5,2],[-7,1],[-6,3],[-4,4],[0,4],[11,5],[3,4],[-6,6],[-25,17],[-11,11],[-11,4],[-15,4],[-15,3],[5,6],[-5,5],[-23,7],[0,11],[-42,27],[-11,13],[8,-4],[7,7],[-28,3],[-22,0],[-14,4],[-4,17],[12,19],[3,8],[-3,8],[-4,6],[0,7],[7,8],[-7,6],[-16,28],[0,24],[-3,5],[-3,5],[-1,4],[7,4],[0,3],[-12,6],[-16,9],[-13,9],[-5,9],[-7,0],[-1,-6],[-6,-11],[-1,-7],[4,-2],[16,-9],[3,-3],[-1,-15],[-6,-6],[-12,-8],[-2,-7],[16,-20],[5,-9],[-2,-10],[-11,-19],[-9,-43],[15,-25],[3,-9],[-3,-9],[-8,-10],[-4,-3],[-4,-2],[-4,-3],[-4,-6],[-3,-6],[0,-5],[3,-11],[13,-7],[4,-4],[-9,-3],[-9,0],[-8,3],[-14,7],[-1,-4],[-5,-3],[-1,-3],[-3,5],[1,8],[-2,6],[-7,2],[-5,2],[5,5],[10,5],[8,3],[-4,3],[-7,5],[-4,3],[16,2],[7,6],[0,9],[-8,8],[19,-1],[1,4],[-9,5],[-15,3],[-26,-1],[-8,1],[-15,3],[4,3],[7,9],[4,3],[-27,6],[-11,16],[7,13],[24,-3],[-7,24],[-1,22],[7,8],[2,5],[-5,3],[-6,0],[-9,3],[-9,3],[-3,3],[-4,13],[-15,21],[-4,11],[5,12],[25,16],[9,8],[1,8],[11,9],[3,7],[-2,5],[-13,19],[15,0],[-4,7],[-6,5],[-7,1],[-6,-6],[-53,32],[-30,30],[-24,16],[-8,12],[-5,13],[-2,11],[3,11],[15,16],[5,10],[-10,-4],[-8,-6],[-9,-3],[-11,3],[-5,5],[-11,23],[-34,29],[-9,16],[13,13],[-28,10],[-16,13],[0,15],[21,13],[43,6],[28,-12],[27,-18],[39,-8],[-39,24],[-11,12],[20,3],[-17,3],[-16,4],[-7,6],[9,9],[-8,3],[-7,5],[-6,5],[-2,3],[-2,3],[-5,-2],[-8,-6],[2,-1],[3,-3],[3,-4],[0,-3],[-16,-6],[-16,3],[-11,10],[-3,11],[-8,0],[-3,-9],[9,-23],[-10,-4],[-6,-1],[-6,-3],[-8,-3],[-14,0],[-7,1],[-7,3],[-5,3],[-4,4],[-30,60],[-22,16]],[[4999,7678],[-24,20],[-17,7],[-19,8],[-11,10],[-4,12],[1,56],[4,5],[9,5],[32,12],[9,10],[-37,11],[-13,1],[-21,2],[-24,2],[-162,29],[-34,0],[-58,-7],[-69,-5],[-12,-1],[-8,-4],[-8,-3],[-10,-3],[-12,0],[-11,6],[-8,5],[-11,5],[-45,17],[-31,14],[-4,4],[-35,43],[-25,6],[-104,10],[-20,4],[-13,3],[-12,5],[-12,11],[-57,81],[-50,54],[24,6],[39,7],[38,5],[42,6],[20,5],[12,4],[10,5],[6,5],[5,3],[5,2],[6,-1],[5,-2],[2,-2],[1,-4],[-2,-4],[-8,-13],[-6,-5],[-7,-8],[0,-6],[3,-4],[6,-3],[9,-1],[11,0],[11,3],[8,3],[6,3],[7,7],[9,21],[1,10],[-5,17],[-14,15],[-24,19],[-56,30],[-12,22],[-15,99],[5,46],[12,21],[12,6],[9,1],[7,-1],[11,-4],[8,-4],[7,-4],[8,-3],[9,-2],[11,0],[9,2],[7,4],[8,6],[15,8],[65,21],[22,11],[13,10],[4,11],[-12,15],[-59,31],[-9,9],[-14,24],[-20,20],[-2,7],[3,8],[56,59],[3,1],[6,2],[10,3],[11,5],[7,5],[6,18],[-16,41],[-25,16],[-7,8],[-8,13],[-16,12],[-17,9],[-5,5],[-2,14],[-5,8],[-12,9],[-59,36],[-5,5],[-3,6],[0,4],[14,10],[62,7],[30,4],[28,7],[19,8],[6,5],[2,2],[-10,26],[-5,8],[-7,8],[-13,8],[-17,8],[-22,8],[-34,15],[-8,8],[5,6],[20,8],[142,38],[5,4],[2,4],[1,23],[7,4],[14,3],[31,3],[16,3],[9,5],[1,9],[5,8],[9,7],[6,6],[-6,5],[-39,10],[-15,4],[0,4],[16,3],[98,-1],[64,-6],[16,-3],[20,-1],[20,-1],[193,12],[60,0],[27,3],[70,10],[123,3],[85,-3],[15,1],[14,2],[8,3],[5,1],[14,7],[63,40]],[[5427,9235],[9,2],[11,1],[14,-2],[9,-4],[9,-2],[15,3],[4,3],[11,14],[2,4],[-6,6],[-9,3],[-11,2],[-8,4],[-3,5],[0,10],[-7,4],[-30,13],[-181,101],[-27,19],[-4,10],[14,16],[-2,8],[-4,4],[-4,10],[-1,5],[-3,5],[-12,8],[-5,5],[0,11],[9,11],[15,9],[18,7],[44,13],[20,7],[37,20],[15,4],[35,5],[16,2],[7,0],[4,2],[2,7],[4,5],[8,3],[22,3],[6,3],[9,8],[7,2],[12,2],[10,2],[56,21],[17,9],[15,8],[13,6],[20,4],[22,2],[17,-1],[13,-6],[1,-7],[5,-4],[24,4],[21,5],[5,4],[-2,6],[-1,12],[5,8],[19,15],[6,8],[-8,15],[-54,25],[-15,13],[6,18],[33,32],[-5,15],[11,9],[40,10],[9,5],[7,11],[16,2],[20,-1],[22,0],[13,6],[5,10],[0,20],[-2,5],[-4,5],[-2,5],[5,5],[18,7],[6,5],[4,6],[15,8],[16,19],[12,9],[16,18],[20,5],[24,-7],[25,-16],[26,-7],[31,9],[32,7],[33,-13],[45,-55],[28,-16],[35,-5],[69,14],[43,-8],[52,-29],[38,-10],[16,-6],[1,-9],[-10,-15],[6,-5],[45,-3],[19,-5],[74,-29],[4,-2],[9,-9],[2,-10],[-6,-47],[-5,-11],[-13,-11],[8,-6],[39,-10],[19,-7],[12,-9],[0,-8],[-22,-5],[-19,-5],[6,-10],[19,-9],[38,-11],[4,-5],[-2,-7],[-1,-10],[5,-5],[7,-3],[3,-3],[-10,-12],[2,-5],[38,-25],[18,-17],[24,-41],[21,-18],[38,-7],[39,5],[21,12],[11,17],[6,17],[-1,20],[3,10],[11,4],[14,-2],[58,-12],[19,-7],[34,6],[23,-7],[23,-21],[16,-6],[29,1],[13,3],[11,4],[10,2],[14,1],[9,-3],[11,-5],[10,-6],[5,-4],[3,-11],[-12,-22],[-3,-21],[7,-47],[3,-6],[7,-1],[8,0],[7,-2],[12,-17],[-4,-18],[-27,-35],[-7,-15],[-1,-17],[11,-35],[10,-9],[12,-3],[16,-3],[16,-7],[7,-10],[-7,-10],[-12,-9],[-9,-10],[26,-46],[1,-5],[-4,-5],[-16,-8],[-5,-6],[4,-10],[27,-17],[9,-10],[-1,-11],[-17,-19],[-2,-11],[16,-18],[1,-4],[-1,-4],[1,-5],[4,-5],[5,-11],[-8,-10],[-23,-18],[-7,-18],[-5,-68],[-4,-10],[-7,-10],[-10,-9],[-45,-23],[-9,-11],[-5,-10],[-3,-9],[7,-5],[22,2],[10,-5],[27,-25],[4,-9],[-6,-5],[-8,-3],[-7,-3],[0,-11],[-6,-4],[-41,-14],[-15,-1],[-7,6],[2,19],[-7,1],[-19,-3],[-44,-5],[-14,-5],[-5,-8],[2,-9],[7,-10],[21,-18],[5,-10],[-2,-12],[8,-6],[11,-1],[13,1],[13,-2],[10,-5],[37,-24],[10,-10],[5,-2],[14,-2],[6,-3],[3,-7],[-3,-7],[-6,-7],[-7,-5],[-58,-19],[-18,-3],[-11,0],[-10,3],[-32,5],[-25,9],[-14,3],[-19,-1],[-13,-3],[-26,-14],[-15,-5],[-10,-9],[-14,-18],[-8,-4],[-9,-3],[-6,-4],[-3,-6],[0,-6],[-3,-5],[-43,-22],[-6,-7],[-14,-23],[-11,-8],[-16,-6],[-23,-5],[-25,-3],[-14,1],[-33,14],[-16,4],[-92,14],[-11,-1],[-2,-7],[1,-26],[-5,-8],[-13,-6],[-20,-8],[-6,-4],[0,-4],[6,-13],[4,-5],[4,-5],[-2,-20],[2,-8],[-4,-4],[-21,-1],[-15,-5],[-15,-12],[-20,-22],[-12,-6],[-46,-10],[-18,-5],[-50,-29],[-24,-5],[-23,-1],[-11,4],[-8,7],[-13,9],[-41,9],[-25,-13],[-26,-41],[-26,-24],[-18,-12],[-18,-6],[-20,-3],[-4,-5],[6,-19],[-2,-36],[5,-17],[18,-16],[41,-14],[13,-9],[-8,-10],[-19,-5],[-24,0],[-46,4],[-24,-2],[-24,-7],[-43,-16],[-75,-22],[-4,-11],[7,-67],[-28,-71],[0,-12],[7,-4],[90,5],[26,1],[17,-2],[9,-4],[5,-5],[4,-5],[2,-6],[6,-6],[20,-6],[8,-6],[1,-11],[-17,-3],[-22,-1],[-18,-6],[7,-13],[83,-13],[6,-19],[-6,-4],[-9,-3],[-7,-4],[-3,-6],[3,-6],[16,-9],[5,-5],[-4,-13],[-13,-12],[-213,-96],[19,-10],[44,-9],[41,-13],[6,-4],[5,-5],[5,-10],[14,9],[12,3]],[[2171,7526],[3,2],[4,10],[-2,12],[2,10],[11,11],[50,30],[4,7],[6,20],[5,6],[12,6],[5,9],[4,19],[13,20],[54,56],[5,9],[3,17],[6,9],[8,4],[24,7],[7,5],[1,4],[-3,9],[0,3],[13,6],[13,5],[10,6],[3,21],[7,6],[13,5],[17,4],[15,27],[9,8],[13,5],[50,14],[13,13],[23,36],[10,8],[16,2],[14,0],[13,0],[16,4],[13,8],[9,9],[4,9],[0,10],[6,16],[45,26],[17,13],[21,46],[18,10],[21,17],[6,22],[-8,22],[-19,15],[-40,8],[-45,4],[-40,7],[-26,16],[-4,21],[64,79],[25,18],[23,10],[10,4],[36,11],[21,4],[39,2],[20,3],[20,6],[29,20],[16,9],[9,2],[22,0],[11,2],[1,3],[-9,5],[0,2],[5,2],[11,3],[4,2],[100,63],[9,4],[10,2],[24,1],[10,3],[7,10],[-2,12],[-23,54],[1,10],[8,12],[12,5],[42,6],[18,6],[47,21],[35,19],[13,10],[-1,11],[-14,7],[-40,5],[-15,6],[-11,35],[5,5],[8,4],[5,4],[-4,4],[-9,2],[-9,1],[-9,1],[-9,4],[-14,16],[-5,21],[2,21],[8,16],[15,18],[2,8],[-4,10],[-22,18],[-2,8],[15,10],[18,6],[32,16],[12,8],[6,6],[1,3],[0,4],[3,15],[4,4],[11,5],[10,2],[25,2],[10,3],[10,4],[15,10],[11,3],[20,2],[18,-11],[8,-1],[16,0],[20,3],[41,8],[85,12],[20,5],[33,18],[25,22],[30,18],[46,5],[26,-2],[23,0],[18,4],[13,11],[11,12],[13,7],[17,3],[51,2],[15,3],[11,6],[29,21],[47,25],[30,5],[63,5],[31,7],[30,13],[25,15],[40,33],[43,26],[68,20],[76,15],[294,21],[75,-1],[17,-3],[23,1],[23,3],[17,5],[23,11],[9,9],[12,4],[31,-2],[10,-3],[6,-2],[8,-2],[14,0],[12,3],[18,9],[13,2],[20,-1],[21,-2],[38,-8],[20,-6],[14,-6],[23,-17],[13,-7],[36,-13],[6,-4],[-9,-10],[-11,-9],[1,-9],[26,-9],[153,-30],[9,-4],[8,-4],[9,-4],[13,-2],[10,0],[13,2]]],"transform":{"scale":[0.0008999782220222029,0.0018942555056505655],"translate":[92.17497277900006,9.597805080000086]}};
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
