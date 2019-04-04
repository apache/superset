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
  Datamap.prototype.mmrTopo = '__MMR__';
  Datamap.prototype.mneTopo = '__MNE__';
  Datamap.prototype.mngTopo = '__MNG__';
  Datamap.prototype.mnpTopo = '__MNP__';
  Datamap.prototype.mozTopo = '__MOZ__';
  Datamap.prototype.mrtTopo = {"type":"Topology","objects":{"mrt":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":null},"id":"-99","arcs":[[0]]},{"type":"Polygon","properties":{"name":"Tiris Zemmour"},"id":"MR.TZ","arcs":[[1,2]]},{"type":"Polygon","properties":{"name":"Brakna"},"id":"MR.BR","arcs":[[3,4,5,6,7]]},{"type":"MultiPolygon","properties":{"name":"Dakhlet Nouadhibou"},"id":"MR.DN","arcs":[[[8]],[[9]],[[10]],[[11]],[[12,13,14]]]},{"type":"Polygon","properties":{"name":"Inchiri"},"id":"MR.IN","arcs":[[15,16,17,-14]]},{"type":"Polygon","properties":{"name":"Nouakchott"},"id":"MR.NO","arcs":[[18,19]]},{"type":"Polygon","properties":{"name":"Trarza"},"id":"MR.TR","arcs":[[-7,20,-20,21,-17,22]]},{"type":"Polygon","properties":{"name":"Assaba"},"id":"MR.AS","arcs":[[23,24,25,26,-4,27]]},{"type":"Polygon","properties":{"name":"Guidimaka"},"id":"MR.GD","arcs":[[28,29,-26]]},{"type":"Polygon","properties":{"name":"Gorgol"},"id":"MR.GO","arcs":[[-30,30,-5,-27]]},{"type":"Polygon","properties":{"name":"Adrar"},"id":"MR.AD","arcs":[[31,32,-23,-16,-13,33,-2,34]]},{"type":"Polygon","properties":{"name":"Hodh ech Chargui"},"id":"MR.HC","arcs":[[35,36,-32,37]]},{"type":"Polygon","properties":{"name":"Hodh el Gharbi"},"id":"MR.HG","arcs":[[-36,38,-24,39]]},{"type":"Polygon","properties":{"name":"Tagant"},"id":"MR.TG","arcs":[[-40,-28,-8,-33,-37]]}]}},"arcs":[[[442,4140],[16,5],[2,-12],[0,-8],[-18,-3],[2,7],[-2,11]],[[8625,7601],[-1,0],[-3491,-2195],[-1297,-134],[-511,176],[-21,7],[-2,0]],[[3302,5455],[-23,330],[-13,199],[-13,199],[-11,52],[-40,102],[-8,51],[10,54],[27,50],[70,89],[15,18],[82,51],[102,64],[88,55],[51,32],[50,15],[137,18],[30,8],[178,77],[84,20],[10,13],[4,27],[0,65],[0,60],[0,60],[0,60],[0,61],[0,60],[0,60],[0,60],[0,61],[0,60],[0,60],[0,60],[0,60],[0,61],[0,60],[0,60],[0,60],[0,61],[0,60],[0,60],[0,60],[0,60],[0,61],[0,60],[0,60],[0,60],[0,61],[0,60],[0,60],[0,60],[0,60],[0,61],[0,60],[82,0],[82,0],[82,0],[82,0],[82,0],[83,0],[82,0],[82,0],[82,0],[82,0],[82,0],[83,0],[82,0],[82,0],[82,0],[82,0],[82,0],[82,0],[83,0],[82,0],[82,0],[82,0],[82,0],[82,0],[83,0],[82,0],[82,0],[82,0],[82,0],[82,0],[82,0],[83,0],[69,0],[16,4],[5,10],[0,36],[0,11],[0,31],[0,49],[0,62],[0,74],[0,83],[0,88],[0,91],[0,91],[0,89],[0,82],[-1,74],[0,63],[0,48],[0,31],[0,11],[162,-93],[161,-92],[161,-93],[162,-93],[161,-93],[162,-92],[161,-93],[161,-93],[162,-92],[161,-93],[162,-93],[161,-93],[137,-78],[137,-79],[136,-78],[117,-67],[20,-12],[99,-57],[141,-85],[142,-85],[141,-85],[142,-86],[-181,0],[-180,0],[-181,0],[-180,0],[-181,0],[-181,0],[-180,0],[-181,0],[8,-64],[8,-63],[8,-64],[8,-63],[8,-64],[7,-63],[8,-63],[8,-64],[8,-65]],[[3891,2024],[-13,-6],[-9,-9],[-1,-14],[-8,-9],[-32,-5],[-26,-10],[-15,-15],[-25,-3],[-19,-14],[-21,-38],[-22,-9],[-17,-4],[-15,-7],[-9,-6],[-10,-5],[-10,3],[-11,0],[-37,-11],[-7,-7],[-9,-7],[-24,-6],[-59,-63],[-9,-14],[-6,-17],[1,-28],[-5,-28]],[[3473,1692],[-2,-29],[-39,-53],[-15,-31],[-13,-42],[-20,-38],[-68,-25],[-77,-7],[-39,-44],[-5,-64],[-15,-21],[-332,-84],[-35,-15],[-10,-32],[-4,-35],[-16,-19],[-23,-12],[-17,-6]],[[2743,1135],[4,14],[2,10],[-8,1],[-7,-1],[-7,-2],[-7,-3],[-7,-6],[-14,-20],[-6,-6],[-13,-9],[-13,-7],[-7,-3],[-6,0],[-7,1],[-7,5],[-7,6],[-5,7],[-4,7],[-7,22],[-4,6],[-5,6],[-13,9],[-7,4],[-32,8],[-14,8],[-3,12],[4,15],[0,6],[-3,7],[-8,10],[-2,6],[1,6],[6,13],[-1,5],[-5,6],[-7,3],[-16,6],[-8,5],[-14,16],[-5,5],[-28,14],[-48,42],[-28,30],[-19,13],[-6,5],[-14,17],[-6,4],[-10,2],[-19,1],[-9,4],[-4,6],[-1,14],[-3,6],[-8,4],[-31,-3],[-7,4],[-2,6],[4,15],[1,8],[-4,6],[-6,4],[-52,20],[-16,-1],[-7,-3],[-22,-12],[-8,-4],[-8,-2],[-9,-1],[-9,0],[-33,7],[-9,0],[-34,-9],[-9,-1],[-9,2],[-23,10],[-7,2],[-8,0],[-28,-7],[-9,-1],[-139,9],[-25,-5],[-15,2],[-9,10],[-6,11]],[[1739,1542],[13,16],[80,49],[112,58],[63,25],[25,21],[17,22],[5,4],[198,138],[295,411],[183,156],[229,159],[640,444]],[[3599,3045],[155,-225],[-23,-220],[-11,-134],[3,0],[-23,-269],[110,-109],[81,-64]],[[560,3876],[-3,0],[5,14],[27,48],[31,41],[9,1],[7,-6],[-10,-14],[-13,-12],[-10,-11],[-14,-23],[-29,-38]],[[492,3944],[-5,-6],[-6,5],[-4,17],[4,16],[12,5],[6,-1],[0,-8],[-2,-16],[-5,-12]],[[607,4080],[-25,-107],[-20,-50],[-33,-46],[-14,17],[-3,6],[1,6],[2,7],[0,8],[-6,8],[-6,15],[6,15],[23,32],[2,4],[-1,23],[1,7],[7,15],[10,12],[12,4],[11,-10],[16,32],[10,12],[7,-10]],[[516,4653],[-5,-3],[-10,4],[-6,14],[4,12],[8,5],[7,-2],[4,-4],[-2,-26]],[[2272,5257],[100,-150]],[[2372,5107],[-1360,5],[214,-330],[-530,-912],[-45,-77],[-30,-34],[-5,2]],[[616,3761],[2,2],[20,31],[4,15],[7,11],[2,5],[-2,6],[-6,3],[-5,0],[-3,-3],[-4,0],[-45,-46],[-23,-17],[33,66],[-12,-6],[-33,-26],[-11,-12],[-6,-7],[-5,-9],[-1,-10],[4,-9],[0,-5],[-7,-15],[-2,-8],[-2,-2],[-5,-1],[-5,0],[-5,1],[-4,2],[0,1],[0,3],[-1,4],[-2,7],[1,19],[1,7],[7,12],[22,21],[4,14],[3,17],[8,8],[11,6],[12,9],[78,110],[5,4],[5,3],[5,5],[2,7],[1,16],[2,6],[5,2],[2,3],[14,15],[4,5],[0,8],[-2,7],[-4,6],[-5,6],[6,5],[4,6],[2,8],[-1,8],[-13,-7],[-4,-4],[-2,13],[11,19],[-3,12],[-16,8],[-10,-7],[-6,-11],[-2,-7],[-13,-7],[-6,3],[-1,10],[3,11],[5,8],[5,7],[48,45],[13,20],[7,23],[-3,20],[-25,40],[-10,22],[6,0],[6,0],[5,2],[5,4],[18,26],[7,16],[3,15],[-2,15],[-6,12],[-23,33],[-5,2],[-12,1],[-7,4],[-4,7],[-3,8],[-3,3],[-13,7],[-23,53],[-7,7],[-7,5],[-6,5],[-2,7],[2,3],[5,2],[3,2],[-1,4],[-3,4],[-5,9],[-4,15],[-30,75],[-8,11],[-12,4],[-7,10],[-1,20],[-4,14],[-14,-6],[-16,10],[0,6],[37,10],[10,5],[-16,2],[-29,-5],[-13,3],[-11,13],[6,5],[-12,22],[-6,4],[-17,7],[-6,-35],[7,-77],[-12,-30],[-8,12],[-10,9],[-21,12],[-7,7],[-10,18],[-8,10],[-10,7],[-26,12],[-6,6],[0,9],[3,4],[6,1],[2,2],[0,7],[-5,6],[-1,6],[-4,12],[-9,10],[-22,16],[-4,6],[1,15],[-3,7],[-14,13],[-9,38],[-5,9],[-9,10],[-5,11],[-4,13],[-1,12],[-4,-4],[-5,-4],[-2,-3],[-12,11],[-5,12],[-2,13],[-4,13],[-5,6],[-8,6],[-7,7],[-3,12],[-4,7],[-19,25],[-5,11],[-2,11],[-4,13],[-10,23],[-16,17],[-11,-6],[-21,-36],[-35,-44],[-8,-6],[-5,-10],[6,-14],[10,4],[1,-13],[-6,-29],[-1,-26],[-4,-7],[-8,-5],[-18,-5],[-7,-6],[-1,-7],[4,-6],[8,-9],[6,-12],[0,-6],[0,-9],[-8,-34],[-7,-17],[-8,-9],[-20,86],[3,24],[19,72],[6,25],[34,92],[16,76],[14,69],[8,7],[94,0],[34,0],[95,0],[148,0],[192,0],[228,0],[253,0],[272,0],[280,0],[280,0],[271,0],[25,0]],[[2372,5107],[15,-21],[-53,-1346],[-1,-121],[-1,-220]],[[2332,3399],[-33,0],[-1589,-4]],[[710,3395],[-23,52],[-36,55],[-48,52],[-15,14],[-4,1],[-3,6],[-6,1],[-8,1],[-7,3],[-14,9],[-32,9],[-13,7],[-6,9],[-14,34],[-2,14],[-9,15],[-16,13],[-9,12],[11,12],[48,-12],[45,6],[40,22],[27,31]],[[856,2511],[6,59],[-9,144],[-20,199]],[[833,2913],[8,0],[219,2],[1,-182],[-1,-222],[-204,0]],[[1739,1542],[-1,2],[-10,11],[-10,4],[-18,-7],[-8,-5],[-5,-8],[-3,-11],[-2,-5],[-4,-5],[-5,-3],[-6,-3],[-6,0],[-6,2],[-8,7],[-7,9],[-7,8],[-12,3],[-11,-3],[-7,-7],[-2,-11],[5,-10],[13,-13],[3,-5],[-1,-6],[-3,-4],[-5,-3],[-18,-7],[-87,-13],[-13,0],[-39,6],[-26,-1],[-13,-3],[-34,-13],[-12,-3],[-12,0],[-10,4],[-5,7],[-5,9],[-8,5],[-12,2],[-12,-6],[-10,-8],[-20,-27],[-8,-7],[-9,-4],[-12,-1],[-35,6],[-13,-1],[-9,-6],[-19,-16],[-11,-6],[-12,-4],[-12,-1],[-13,3],[-19,9],[-7,2],[-27,1],[-37,12],[-13,0],[-20,-3],[-7,0],[-28,6],[-12,-1],[-32,-14],[-6,-1],[-5,1],[-11,4],[-6,1],[-7,-1],[-5,-3],[-6,-3],[-20,-3],[-18,2],[-17,7],[-13,14],[-10,14],[-6,6],[-8,4],[-10,2],[-10,-1],[-9,-5],[-24,-16],[-9,-3],[-9,-2],[-9,1],[-27,5],[-19,-4],[-17,-10],[-15,-14],[-11,-15],[-6,-15],[-5,-31],[-33,-135],[-3,-10],[-6,-8],[-12,-8],[-30,-6],[-12,-10],[-6,-16],[-4,-54],[-14,-32],[-11,-35],[-5,-9],[-2,-87],[-8,-44],[-19,-30],[13,134],[-2,71],[-8,160],[8,52],[6,15],[23,40],[6,40],[7,12],[9,21],[0,85],[6,35],[66,157],[17,27],[12,54],[14,26],[39,52],[70,143],[5,19],[11,15],[76,225],[25,97],[6,106],[8,69]],[[833,2913],[-8,74],[-9,29],[-42,86],[-19,99],[-14,32],[7,19],[-1,22],[-32,111],[-5,10]],[[2332,3399],[797,0],[470,-354]],[[4895,2381],[-10,-26],[-2,-26],[13,-26],[16,-81],[55,-105],[4,-28],[-6,-29],[11,-29],[-5,-15],[-7,-15],[-13,-68],[7,-16],[14,-12],[4,-21],[-13,-95],[0,-23],[5,-21],[0,-14],[-3,-14],[12,-19],[-7,-12],[-8,-10],[6,-17],[17,-11],[17,-20],[4,-12],[7,-10],[15,-1],[15,-7],[13,-13],[8,-14],[-2,-27],[12,-24],[17,-22],[25,-11],[13,-2],[13,-4],[24,12],[9,-10],[13,4],[12,3],[5,-8],[-1,-10],[-10,-11],[-19,-2],[-1,-19],[-18,-12],[-7,-14],[-43,-22],[-16,0],[-15,-4],[-11,-9],[8,-18],[33,-10],[10,-6],[2,-17],[-7,-17],[-7,-8],[-5,-8],[-4,-23],[-5,-11],[-3,-12],[11,-19],[-7,-11],[3,-13],[27,-9],[23,-17],[13,-24],[2,-27],[-4,-22],[-1,-22],[-10,-14],[0,-22],[-3,-5],[17,-16],[51,-39],[24,-30],[67,-406]],[[5299,553],[-3,-1],[-16,-2],[-34,0],[-49,7],[-13,0],[-9,-9],[-3,-15],[1,-33],[-7,-17],[-6,-6],[-13,-7],[-9,-13],[-7,-1],[-8,0],[-9,-3],[-13,-12],[-6,-13],[-8,-30],[-9,-13],[-22,-20],[-7,-13],[-13,-45],[-7,-13],[-27,39],[-30,28],[-23,41],[-26,25],[-206,144],[-16,16],[-75,104],[-21,17],[-19,8],[-46,9],[-8,-1],[-2,0],[1,-4],[2,-2],[3,-2],[4,-2],[1,-4],[1,-4],[-1,-4],[-1,-4],[-8,-8],[-9,-4],[-22,-7],[-14,-7],[-29,-29],[-23,-12],[-22,2],[-22,6],[-3,1]],[[4388,640],[6,33],[20,37],[5,41],[10,39],[31,33],[8,20],[4,19],[0,11],[5,10],[19,13],[10,20],[-2,7],[-2,9],[6,12],[9,10],[22,11],[13,19],[-87,13],[-57,36],[-12,2],[-13,-2],[-14,2],[-10,9],[-43,-5],[-9,8],[-10,5],[-7,-12],[4,-19],[9,-17],[7,-18],[-5,-13],[-12,-7],[-11,-4],[-5,-13],[2,-13],[-17,0],[-22,2],[-23,-2],[-21,-6],[-15,9],[-16,17],[-25,4]],[[4140,960],[-12,32],[8,58],[-19,-1],[-15,4],[-9,12],[-29,28],[-36,11],[-6,-5],[-4,-5],[-13,4],[-13,8],[-29,-1],[-10,16],[-5,63],[-13,13],[-18,4],[-13,8],[-15,4],[-16,-5],[-15,-8],[-31,-25],[-32,-3],[-4,24],[17,55],[-2,32],[-4,13],[-3,27],[-6,13],[1,25],[-31,9],[-155,25],[-21,-7],[-18,-16],[-11,-3],[-11,5],[-14,1],[-10,-1],[-4,14],[0,14],[16,13],[9,18],[0,16],[-13,10],[-6,18],[-3,19],[-13,24],[-25,13],[-18,12],[-4,19],[1,36],[12,33],[15,30],[-17,29]],[[3891,2024],[79,-70],[131,-46],[117,-34],[128,42],[149,-12],[35,42],[0,52],[7,112],[21,44],[-13,44],[32,13],[-4,30],[-33,8],[25,14],[26,16],[25,6],[5,24],[-12,22],[5,5],[-1,7],[-8,13],[-15,20],[-31,30],[-5,10],[-26,40],[19,-2],[-31,56],[-20,33],[-5,8],[-17,15],[12,24],[26,13],[1,39],[46,-3],[4,25],[24,1],[52,-1],[22,-4],[9,2],[7,-7],[19,-2],[21,13],[47,14],[23,-2],[7,16],[28,36],[-21,19],[23,16],[25,29],[26,17],[60,24],[23,-2],[26,16],[-89,-468]],[[4388,640],[-21,3],[0,-27],[-2,-9],[-21,-22],[-10,-25],[-13,-57],[-27,-56],[-4,-12],[-4,-38],[-16,-43],[-2,-16],[1,-8],[2,-11],[0,-8],[-10,-32],[-2,-24],[-1,-4],[8,-6],[5,2],[4,4],[6,0],[9,-8],[6,-9],[2,-11],[-1,-15],[-6,-12],[-5,-14],[-4,-29],[1,-5],[2,-4],[6,-7],[0,-5],[-5,-3],[-6,-1],[-3,-2],[-3,-3],[-4,-4],[-4,-6],[-3,-7],[-7,-11],[-12,-10],[-15,-7],[-33,-7],[-11,-10],[-20,-25],[-14,-9],[-16,-4],[-16,0],[-15,3],[-6,-4],[-5,-13],[-6,-9],[-9,4],[-35,30],[-12,6],[-17,-3],[-36,-12],[-17,-2],[-18,3],[-14,6],[-45,34],[-52,23],[-14,11],[-28,31],[-11,7],[0,8],[-19,64],[-4,8],[-7,7],[-9,5],[-19,4],[-9,5],[-14,10],[-45,25],[-10,13],[-7,6],[-7,3],[-13,-2],[-26,-8],[-8,-1],[-1,0],[-22,9],[-24,22]],[[3535,316],[34,111],[25,53],[71,109],[45,53],[17,9],[14,13],[6,32],[20,40],[138,119],[18,23],[10,20],[18,15],[36,10],[42,-6],[54,25],[57,18]],[[3535,316],[-6,6],[-21,6],[-1,2],[-2,8],[-1,6],[5,20],[0,7],[-3,6],[-4,5],[-7,5],[-8,2],[-9,0],[-17,-3],[-8,0],[-8,2],[-7,6],[-18,17],[-5,10],[8,6],[28,-2],[13,2],[5,11],[-5,13],[-11,10],[-48,32],[-10,10],[-7,12],[-3,13],[0,27],[-2,6],[-3,6],[-9,10],[-2,5],[-4,22],[-2,7],[-5,6],[-13,6],[-13,-2],[-12,-6],[-11,-8],[-12,-8],[-12,-1],[-25,6],[-4,4],[-3,7],[-2,7],[0,7],[5,30],[-2,11],[-6,9],[-9,8],[-10,5],[-19,5],[-6,2],[-15,11],[-6,2],[-12,1],[-24,-4],[-12,-1],[-8,20],[-1,7],[1,7],[3,6],[12,19],[1,5],[-1,6],[-3,7],[-9,13],[-6,5],[-6,5],[-13,7],[-6,4],[-4,6],[-1,7],[2,6],[3,7],[2,7],[-1,15],[-4,14],[-7,12],[-15,16],[-3,5],[-2,5],[0,7],[3,13],[1,7],[-2,7],[-5,6],[-20,15],[-8,7],[-6,7],[-5,9],[-11,27],[-1,6],[-1,14],[-2,6],[-5,5],[-23,15],[-4,4],[-6,11],[-4,4],[-13,1],[-29,-11],[-9,5],[2,12],[14,25],[-2,11],[-5,1],[-5,0],[-4,-2],[-12,-4],[-42,-9],[-25,-10],[-6,-2],[-3,0],[-16,0],[-4,-1],[-23,-11],[-5,-1],[-6,0],[-1,1],[-6,5],[-2,1],[-5,2],[-2,1],[-1,1],[-1,3],[-1,1],[-4,3],[-8,3],[-4,2],[-3,9],[4,10]],[[8735,6684],[-1,-1],[-5,-12],[-1301,-2672],[-11,-23]],[[7417,3976],[-2468,-11],[-17,0],[-301,-229],[-16,-12],[-19,-135],[-4,-29],[-185,93],[-174,-111],[-368,-224],[-94,-96],[-172,-177]],[[2272,5257],[228,0],[228,0],[192,0],[148,0],[95,0],[34,0],[119,0],[-9,129],[-5,69]],[[8625,7601],[0,-4],[6,-49],[13,-109],[13,-108],[6,-49],[12,-97],[11,-96],[12,-96],[11,-96],[12,-96],[11,-96],[3,-21]],[[6588,606],[1,0],[1,2],[5,5],[29,28],[-8,253],[-46,94],[-34,70],[162,207],[-20,55],[117,112],[52,55],[137,143],[187,193],[-140,145],[-112,116],[-450,-54]],[[6469,2030],[2,4],[946,1942]],[[8735,6684],[9,-75],[11,-97],[12,-96],[11,-96],[12,-96],[11,-96],[12,-96],[11,-96],[12,-97],[11,-96],[12,-96],[12,-96],[11,-96],[12,-96],[11,-96],[12,-96],[11,-97],[12,-96],[5,-46],[12,-103],[13,-103],[5,-46],[11,-86],[11,-100],[12,-99],[12,-100],[12,-100],[11,-99],[12,-100],[12,-99],[11,-100],[13,-110],[5,-46],[5,-47],[5,-46],[6,-46],[8,-74],[8,-74],[9,-74],[8,-74],[8,-74],[8,-74],[9,-74],[8,-74],[8,-73],[9,-74],[8,-74],[8,-74],[8,-72],[8,-72],[9,-72],[8,-72],[8,-71],[8,-72],[8,-72],[8,-72],[8,-72],[8,-72],[8,-72],[8,-72],[8,-71],[8,-72],[8,-72],[9,-72],[3,-32],[7,-13],[7,-13],[32,-21],[30,-19],[37,-24],[32,-21],[33,-22],[33,-21],[4,-4],[4,-4],[1,-5],[0,-5],[-4,-24],[-15,-75],[-15,-75],[-15,-76],[-15,-75],[-15,-78],[-15,-77],[-16,-77],[-15,-78],[-1,-4],[0,-3],[-1,-1],[0,-3],[-1,-4],[0,-1],[0,-1],[-1,0],[-1,0],[-1,0],[-1,0],[-129,0],[-109,0],[-51,0],[-56,0],[-59,0],[-63,1],[-109,0],[-80,0],[-37,0],[-123,0],[-129,0],[-133,0],[-136,0],[-139,0],[-140,0],[-140,0],[-138,0],[-137,0],[-133,0],[-129,0],[-123,0],[-117,0],[-109,0],[-70,0],[-65,0],[-60,0],[-55,0],[-76,0]],[[6588,606],[-12,0],[-100,0],[-28,0],[-142,0],[5,73],[11,55],[-2,25],[-20,9],[-16,-10],[-49,-57],[-12,-21],[0,-23],[13,-50],[9,-44],[-202,-8],[-40,-8],[-16,-7],[-46,-25],[-31,-8],[-95,8],[-95,-13],[-33,1],[-19,5],[-30,18],[-16,8],[-6,0],[-15,-2],[-8,0],[-69,26],[-12,2],[-39,-3],[-22,4],[-84,1],[-12,-2],[-16,3],[-13,-2],[-27,-8]],[[4895,2381],[261,-71],[348,-92],[498,30],[6,-4],[461,-214]]],"transform":{"scale":[0.0012260787846784676,0.0012552272072207226],"translate":[-17.0811748859999,14.734398906000123]}};
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
