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
  Datamap.prototype.mrtTopo = '__MRT__';
  Datamap.prototype.msrTopo = '__MSR__';
  Datamap.prototype.musTopo = '__MUS__';
  Datamap.prototype.mwiTopo = '__MWI__';
  Datamap.prototype.mysTopo = '__MYS__';
  Datamap.prototype.namTopo = {"type":"Topology","objects":{"nam":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Karas"},"id":"NA.KA","arcs":[[0,1]]},{"type":"Polygon","properties":{"name":"Hardap"},"id":"NA.HA","arcs":[[2,3,-2,4,5,6]]},{"type":"Polygon","properties":{"name":"Khomas"},"id":"NA.KH","arcs":[[-7,7,8,9]]},{"type":"Polygon","properties":{"name":"Kunene"},"id":"NA.KU","arcs":[[10,11,12,13,14,15]]},{"type":"Polygon","properties":{"name":"Erongo"},"id":"NA.ER","arcs":[[16,-8,-6,17,-15]]},{"type":"Polygon","properties":{"name":"Otjozondjupa"},"id":"NA.OD","arcs":[[18,19,-9,-17,-14,20,21]]},{"type":"Polygon","properties":{"name":"Omusati"},"id":"NA.OS","arcs":[[22,23,-11,24]]},{"type":"Polygon","properties":{"name":"Oshana"},"id":"NA.ON","arcs":[[25,-12,-24,26]]},{"type":"Polygon","properties":{"name":"Ohangwena"},"id":"NA.OW","arcs":[[27,28,-27,-23,29]]},{"type":"Polygon","properties":{"name":"Omaheke"},"id":"NA.OH","arcs":[[30,-3,-10,-20]]},{"type":"Polygon","properties":{"name":"Kavango"},"id":"NA.OK","arcs":[[31,32,-22,33,-28,34]]},{"type":"Polygon","properties":{"name":"Oshikoto"},"id":"NA.OT","arcs":[[-34,-21,-13,-26,-29]]},{"type":"Polygon","properties":{"name":"Caprivi"},"id":"NA.CA","arcs":[[-32,35]]}]}},"arcs":[[[6102,2781],[0,-35],[0,-47],[0,-47],[0,-46],[0,-47],[0,-47],[0,-47],[0,-46],[0,-47],[0,-47],[0,-46],[0,-47],[0,-47],[0,-46],[0,-47],[0,-47],[0,-46],[1,-47],[0,-47],[0,-46],[0,-47],[0,-47],[0,-46],[0,-47],[0,-47],[0,-46],[0,-47],[0,-47],[0,-47],[0,-46],[0,-47],[0,-47],[0,-46],[0,-47],[0,-47],[0,-46],[0,-47],[0,-47],[0,-46],[0,-47],[0,-47],[0,-46],[0,-47],[0,-47],[0,-47],[0,-46],[0,-47],[0,-47],[0,-46],[0,-33],[-1,-25],[-23,-6],[-8,0],[-24,3],[-8,-1],[-19,-11],[-33,-30],[-22,-6],[-36,-3],[-16,-6],[-15,-11],[-13,-7],[-74,-5],[-6,-2],[-8,-5],[-5,-6],[-4,-7],[-7,-8],[-4,-7],[-6,-15],[-5,-3],[-7,-3],[-4,-7],[-21,-67],[-8,-12],[-13,-10],[-15,-7],[-60,-16],[-11,-4],[-8,1],[-17,14],[-11,0],[-9,-9],[-9,-11],[-12,-24],[-3,-17],[5,-18],[27,-47],[0,-10],[-9,-6],[-24,-2],[-5,-3],[-8,-13],[-6,-6],[-42,-22],[-30,-10],[-29,-2],[-12,16],[-4,4],[-8,2],[-26,4],[-5,2],[-8,8],[-18,30],[-13,11],[-154,22],[-141,-20],[-27,-15],[-16,-5],[-3,2],[-9,8],[-4,2],[-4,-1],[-6,-4],[-4,-1],[-15,-2],[-8,-3],[-5,-4],[-15,-6],[-18,3],[-31,12],[-16,1],[-65,-9],[-27,-9],[-13,0],[-62,21],[-29,15],[-45,37],[-25,16],[-26,11],[-124,27],[-23,-2],[-8,-3],[-15,-10],[-7,-4],[-10,0],[-23,7],[-16,7],[-4,16],[1,21],[-4,18],[-11,7],[-13,-2],[-14,-7],[-15,-4],[-30,-3],[-33,-8],[-28,4],[-1,25],[9,35],[5,33],[-8,18],[-27,10],[-6,14],[-4,19],[-20,26],[-6,15],[3,12],[9,11],[13,8],[12,4],[12,8],[6,20],[2,23],[-1,17],[-4,10],[-12,15],[-5,9],[-3,10],[-1,9],[-2,8],[-7,11],[-2,8],[-1,10],[-3,9],[-9,4],[-19,-1],[-47,-11],[-23,5],[-16,19],[-4,39],[2,19],[1,19],[-7,14],[-19,6],[-14,6],[-10,15],[-8,18],[-10,12],[-9,3],[-7,1],[-15,-4],[-8,-4],[-25,-19],[-20,5],[-8,-2],[-11,-11],[-8,-4],[-8,2],[-7,9],[-6,1],[-5,-3],[-12,-15],[-3,-2],[-5,-66],[-6,-8],[-3,0],[-4,3],[-12,0],[-3,2],[-3,1],[-5,-3],[-1,-5],[2,-5],[13,-16],[0,-6],[-11,-3],[-16,0],[-4,-3],[-3,-8],[2,-6],[6,-8],[4,-10],[-1,-10],[-7,-6],[-8,3],[-7,5],[-6,3],[-13,-6],[-4,-15],[3,-17],[6,-13],[15,-24],[5,-15],[-7,-7],[-11,-7],[-4,-17],[-1,-19],[-2,-14],[-8,-14],[-13,-18],[-15,-12],[-12,1],[-3,8],[-3,10],[-3,10],[-6,4],[-8,-3],[-56,-55],[-28,-9],[-21,-11],[-19,-13],[-13,-6],[-14,-10],[-8,-13],[-9,-9],[-19,3],[-9,6],[-45,37],[-23,26],[-11,17],[-79,79],[-13,6],[-6,5],[-45,61],[-47,55],[-98,71],[-19,20],[-38,48],[-53,43],[-10,11],[-23,37],[-24,26],[-4,5],[-1,10],[5,17],[1,8],[-9,26],[-20,28],[-74,74],[-9,15],[-4,20],[0,43],[-1,6],[-5,11],[-71,114],[-11,27],[-9,13],[-13,5],[-6,8],[-22,44],[-30,39],[-4,9],[-10,66],[-4,8],[-5,6],[-5,7],[-2,10],[6,34],[-11,54],[5,12],[-14,31],[-5,16],[-1,19],[1,34],[-5,17],[-11,14],[-6,3],[-13,1],[-7,2],[-1,4],[-5,9],[-6,7],[-2,0],[-2,19],[-5,15],[-24,50],[-4,14],[3,23],[-7,16],[-11,17],[-6,14],[-2,20],[2,16],[6,12],[11,4],[8,2],[7,3],[6,0],[2,-8],[0,-32],[5,0],[3,17],[15,43],[0,9],[-5,11],[-15,51],[-9,50],[-17,31],[-25,26],[-28,19],[-44,19],[-6,7],[-6,65],[3,63],[-15,23],[-2,6],[3,9],[4,1],[6,-2],[7,3],[10,27],[-1,35],[-8,36],[-11,28],[-34,56],[-4,27],[13,31],[-6,0],[-38,46],[-12,22],[-2,10],[0,7],[2,11],[0,66],[3,17],[22,44],[2,13],[0,19],[-3,17],[-17,17],[-4,21],[-3,38],[-19,50],[-4,39],[-7,31],[-1,17],[23,62],[-2,10],[15,59],[2,34],[-7,32],[-10,22]],[[2298,3297],[2,0],[684,-5],[18,-67],[58,-411],[3,-8],[3,-7],[7,-1],[9,2],[27,9],[9,2],[10,0],[8,-6],[8,-8],[149,-208],[10,-8],[9,0],[10,4],[9,6],[15,2],[18,-1],[34,-12],[11,1],[5,5],[-39,207],[-1,8],[1,8],[6,4],[8,4],[37,12],[9,1],[9,-4],[8,-5],[7,-6],[5,-6],[1,-4],[-4,-6],[-3,-5],[0,-8],[11,-39],[31,23],[12,17],[28,62],[9,15],[6,-2],[7,-8],[17,-35],[6,-8],[6,-3],[10,-1],[13,2],[130,-27],[5,-4],[13,-6],[18,-14],[32,-4],[33,-11],[21,-14],[7,-7],[3,-11],[1,-10],[2,-9],[4,-5],[14,2],[56,17],[22,0],[39,15],[11,-2],[122,-54],[3,145],[16,11],[22,9],[13,7],[5,3],[5,-1],[8,-4],[10,-4],[141,-15],[97,9],[357,87],[165,15],[50,-27],[17,-14],[56,-30],[322,-29],[12,4],[67,36],[15,16],[6,5],[7,4],[7,-5],[4,-4],[65,-101],[7,-8],[6,-2],[9,4],[23,19],[6,3],[20,4],[35,-1],[40,-6],[19,-7],[18,-14],[11,-5],[11,-4],[71,-14],[32,-14],[9,-2],[15,5],[83,41],[11,3],[15,1],[10,-9],[34,5]],[[4966,4543],[-1,-11],[68,-139],[5,-4],[4,3],[13,14],[7,6],[7,3],[8,-6],[8,-7],[37,-40],[11,-7],[15,-5],[60,-12],[10,1],[138,58],[6,0],[40,-2],[5,-2],[0,-5],[-3,-7],[-1,-7],[2,-6],[15,-3],[69,-2],[3,1],[4,4],[33,44],[9,5],[11,1],[18,-4],[7,-7],[3,-8],[3,-148],[51,-6],[470,-3]],[[6101,4242],[0,-23],[0,-143],[0,-143],[0,-144],[1,-143],[0,-143],[0,-10],[0,-47],[0,-47],[0,-47],[0,-46],[0,-47],[0,-47],[0,-46],[0,-47],[0,-47],[0,-46],[0,-47],[0,-47],[0,-46],[0,-47],[0,-47],[0,-11]],[[2298,3297],[-16,32],[-9,33],[-2,67],[-9,32],[-43,83],[-17,25],[-37,37],[-10,25],[-25,30],[-5,21],[3,9],[10,13],[3,4],[0,35],[-4,15],[-16,31],[-16,43],[-40,80],[-16,57],[-14,28],[-5,38],[-6,13],[4,16],[0,28],[-3,29],[-6,18],[5,12],[5,23],[5,11],[5,2],[7,1],[6,3],[3,8],[10,20],[-6,10],[1,47],[-13,40],[-3,15],[11,120],[-4,29],[-8,23]],[[2043,4503],[415,-42],[18,-29],[6,-6],[3,-3],[3,-2],[6,-2],[8,-2],[17,-1],[54,5],[74,-14],[16,2],[10,-1],[84,-24],[215,-99]],[[2972,4285],[-6,-66],[4,-20],[8,-23],[45,-24],[20,-2],[55,3],[7,2],[4,5],[4,7],[2,8],[7,7],[9,5],[34,1],[95,31],[5,1],[23,-3],[9,0],[8,4],[45,25],[5,2],[-1,-6],[-8,-16],[-3,-10],[-2,-11],[3,-16],[-3,-6],[-6,-4],[-14,-2],[-4,-1],[-5,-4],[0,-9],[4,-12],[41,-33],[41,-9],[-7,20],[-14,51],[8,22],[29,29],[6,5],[6,0],[24,-6],[66,-5],[7,0],[3,3],[3,5],[5,10],[1,6],[0,5],[-6,18],[-3,6],[-5,4],[-7,3],[-56,16],[-7,0],[-13,-7],[-6,-1],[-64,16],[-5,4],[-1,5],[1,8],[12,48],[35,74],[5,7],[4,4],[10,-8],[7,-7],[2,-5],[2,-41],[2,-6],[6,-3],[49,0],[8,2],[7,5],[76,78],[2,7],[0,8],[-5,26],[-2,7],[-5,5],[-50,29],[-3,2],[-4,4],[1,6],[3,7],[85,176],[11,15],[8,1],[18,-9],[13,-12],[16,-4],[14,-2],[17,4],[27,1],[33,-9],[60,15],[37,17],[44,33],[49,11],[31,-1],[32,-11],[13,-7],[6,-11],[4,-22],[1,-35],[12,-19],[25,-5],[67,11],[50,2],[42,10],[12,1],[2,0],[-27,-28],[-5,-7],[-2,-6],[0,-8],[4,-43],[-1,-7],[-4,-4],[-27,-8],[-3,-5],[0,-8],[9,-51],[3,-3],[4,-2],[12,-4],[6,-3],[2,-3],[2,-7],[6,-74],[4,4],[124,-2],[8,0],[6,3],[2,7],[7,8],[11,7],[140,3],[37,-10],[8,-4],[6,-5],[26,-35],[6,-5],[7,-2],[29,14],[7,2],[6,-5],[13,-3],[11,1],[14,4],[57,26],[31,8],[9,5],[2,9],[1,17],[2,8],[7,5],[63,31],[51,31],[17,1],[21,-34]],[[2972,4285],[62,6],[14,15],[5,32],[0,5],[-8,33],[-1,7],[9,119],[-1,8],[-1,7],[-6,4],[-57,28],[-5,3],[-5,5],[1,7],[2,8],[20,49],[4,8],[4,6],[8,2],[24,5],[6,1],[4,3],[1,5],[0,4],[-18,101],[60,21],[7,4],[5,4],[-3,6],[-33,42],[-4,8],[1,8],[1,8],[14,42],[1,8],[1,9],[-2,18],[-3,17],[-2,8],[-1,3],[0,4],[9,76],[5,11],[8,12],[20,10],[11,9],[13,3],[9,1],[44,1],[8,2],[4,8],[1,10],[1,86],[-1,7],[-2,7],[-5,2],[-7,1],[-55,-2],[-3,2],[-3,4],[13,19],[58,63],[10,6],[11,0],[45,-13],[9,-1],[10,5],[11,6],[22,20],[9,16],[26,23],[7,8],[9,2],[9,0],[11,-2],[10,0],[8,1],[3,6],[1,4],[0,37],[4,13],[8,14],[35,27],[30,14]],[[3492,5484],[59,14],[8,-5],[10,-4],[4,-5],[5,3],[6,6],[11,16],[5,7],[7,4],[7,-3],[15,-11],[8,-5],[6,3],[7,4],[8,0],[22,-3],[22,1],[8,7],[3,8],[-3,7],[-3,6],[-7,1],[-25,-4],[-6,1],[-3,5],[-1,7],[1,4],[4,6],[21,39],[6,7],[7,3],[7,0],[4,-2],[4,-6],[6,-18],[6,-7],[9,-6],[21,-2],[9,-5],[10,-10],[7,2],[34,13],[10,0],[8,5],[7,6],[15,16],[8,7],[9,5],[6,-4],[5,-8],[5,-8],[5,-7],[3,-1],[7,5],[49,43],[7,6],[8,3],[5,-5],[5,-8],[4,-9],[4,-8],[6,-5],[8,2],[71,35],[9,10],[5,9],[0,26],[1,8],[4,8],[13,16],[6,7],[6,5],[4,-4],[3,-7],[4,-18],[3,-7],[3,-3],[7,1],[35,16],[8,5],[5,5],[1,8],[-1,15],[1,4],[5,0],[30,-14],[7,-1],[4,5],[3,7],[8,23],[0,5],[-2,7],[-15,45],[-1,8],[5,2],[15,-1],[9,1],[7,5],[7,7],[6,6],[3,5],[5,16],[7,8],[8,7],[25,15],[4,4],[9,23],[5,9],[7,5],[8,3],[35,10],[8,1],[6,-1],[7,-6],[12,-13],[5,-2],[5,1],[21,7],[35,8],[20,10],[9,7],[15,16],[26,22],[35,17],[31,7],[16,-2],[78,22]],[[4726,6040],[6,-49],[-10,-20],[-18,-23],[-12,-22],[-3,-10],[0,-6],[1,-4],[3,-3],[2,-3],[11,-11],[5,-7],[6,-11],[3,-3],[3,-2],[3,-1],[3,-5],[2,-7],[2,-18],[-4,-8],[-6,-5],[-5,-3],[-6,-6],[-6,-14],[-21,-32],[-2,-8],[2,-5],[4,-7],[2,-7],[0,-14],[-4,-7],[-7,-6],[-26,-11],[-7,-1],[-11,0],[-7,0],[-6,-3],[-3,-7],[-8,-74],[2,-13],[4,-13],[20,-44],[24,-34],[9,-8],[9,-2],[30,0],[6,-4],[4,-6],[20,-33],[10,-12],[14,-12],[6,-6],[-3,-5],[-25,-14],[-6,-6],[3,-5],[6,-6],[19,-16],[1,0],[1,1],[23,20],[6,4],[4,-3],[2,-6],[21,-108],[9,-87],[4,-17],[21,-65],[2,-24],[1,-89],[6,-5],[7,0],[52,21],[6,0],[2,-5],[0,-8],[-2,-16],[-1,-7],[-2,-5],[-7,-4],[-33,-14],[-3,-2],[-6,-5],[0,-8],[1,-8],[3,-8],[4,-7],[11,-7],[16,-21],[7,-3],[8,-2],[16,-2],[7,-2],[4,-2],[3,-7],[7,-19],[6,-27],[-4,-6],[-7,-3],[-42,-3],[-7,-2],[-6,-6],[-5,-9],[-3,-11],[-1,-10],[5,-8],[104,-89],[7,-9],[0,-7],[-2,-11],[-44,-114]],[[1847,9635],[-1,-18],[-2,-8],[5,-6],[-4,-14],[-14,-28],[-7,-17],[-23,-38],[-15,-20],[2,-22],[31,-20],[4,-18],[-2,-22],[-3,-16],[-7,-13],[-14,-17],[10,-39],[71,-158],[22,-101],[12,-311],[-7,-118],[4,-57],[30,-100],[20,-45],[13,-47],[-13,-85],[-5,-86],[31,-97],[15,-23],[20,-18],[17,-28],[3,-37],[-8,-14],[-9,-11],[-6,-35],[92,-3],[14,31],[1,45],[-41,-2],[-3,36],[1,33],[35,7],[203,2],[170,24],[46,-10],[44,-4],[79,27]],[[2658,8134],[-2,-46],[138,2],[26,4],[30,-5],[94,-25],[62,-8],[27,2],[26,-6],[59,-34]],[[3118,8018],[89,-14],[52,-15],[42,-5],[99,-32],[137,-21],[44,-1],[47,-13],[44,-25],[9,-8]],[[3681,7884],[1,-13],[6,-37],[-8,-305],[7,-31],[-42,-30],[-20,-6],[-65,0],[-4,-2],[-3,-2],[0,-47],[0,-9],[12,-36],[1,-7],[-5,-2],[-7,-1],[-21,1],[-132,-72],[-8,-7],[-4,-6],[2,-68],[4,-28],[1,-10],[-2,-10],[-4,-11],[-8,-7],[-11,-7],[-11,-5],[-11,-2],[-10,1],[-13,10],[-12,3],[-10,1],[-10,-1],[-6,-2],[-37,-19],[-7,-1],[-46,0],[-7,-2],[-52,-22],[-25,-18],[-10,-9],[-47,-59],[-12,-8],[-45,-20],[-10,-4],[-11,1],[-61,14],[-51,3]],[[2867,6992],[-33,7],[-31,12],[-15,7],[-11,11],[-6,8],[-4,6],[-7,5],[-53,7],[-7,-8],[-4,-10],[-18,-21],[-41,-59],[-6,-5],[-103,-103],[-8,-10],[-3,-11],[-5,-4],[-35,-23],[-16,-9],[-39,-34],[-7,-8],[-5,-4],[-12,-5],[-3,-2],[-2,-3],[-5,-10],[-3,-4],[-4,-3],[-5,-3],[-7,-4],[-4,-5],[-3,-6],[-3,-4],[-3,-2],[-9,-2],[-15,0],[-3,-1],[-4,-2],[-18,-15],[-16,-9],[-6,-6],[-8,-9],[-5,-4],[-4,-2],[-7,-1],[-13,-5],[-19,-9],[-6,-2],[-14,0],[-7,-1],[-11,-3],[-5,0],[-23,3],[-41,-1],[-6,1],[-27,13],[-5,1],[-6,0],[-6,-1],[-10,-2],[-21,-1],[-17,-3],[-5,1],[-4,2],[-16,12],[-3,2],[-5,2],[-31,3],[-19,-4],[-38,-14],[-4,-1],[-5,0],[-4,1],[-5,1],[-46,22],[-6,1],[-7,0],[-13,-2],[-7,-3],[-7,-4],[-8,-5],[-5,-3],[-5,-2],[-21,-1],[-16,-4],[-10,-5],[-20,-11],[-6,-2],[-4,-1],[-34,0],[-55,-22],[-15,-11],[-10,-12],[-6,-3],[-12,-1],[-4,-2],[-3,-4],[-2,-5],[-3,-6],[-4,-3],[-7,-1],[-9,-1],[-26,-7],[-6,-3],[-3,-2],[-8,-13],[-7,-7],[-7,-4],[-25,-9],[-47,-32]],[[1411,6471],[-19,25],[-66,125],[-31,44],[-9,31],[-11,11],[-20,17],[-15,29],[-7,28],[-8,68],[-20,75],[-64,132],[-18,74],[-4,35],[-15,68],[-26,70],[-17,29],[-30,10],[-32,23],[-25,46],[-23,103],[-57,117],[-7,24],[-32,45],[-54,106],[-6,19],[-8,12],[-19,42],[-6,9],[-33,63],[-10,26],[-4,16],[-5,38],[-8,18],[-24,34],[-15,29],[-36,96],[-15,25],[-22,29],[-27,22],[-7,11],[-9,60],[-6,17],[-121,173],[-82,58],[-37,44],[-4,4],[-13,20],[-8,4],[-7,6],[-37,24],[-12,43],[-2,16],[-10,26],[-1,9],[0,9],[0,8],[1,8],[-17,27],[-29,81],[-4,6],[-61,68],[-11,38],[-6,49],[-13,40],[-8,29],[-10,80],[-17,61],[-11,86],[-9,42],[-5,28],[-7,44],[3,66],[25,167],[8,12],[10,-2],[13,-7],[7,-2],[11,1],[4,4],[2,5],[4,7],[14,10],[30,16],[35,28],[30,15],[34,11],[34,5],[5,2],[5,1],[5,0],[7,-5],[26,-9],[8,2],[4,4],[4,2],[7,-2],[4,-5],[2,-5],[1,-7],[3,-6],[4,-5],[8,-5],[8,-5],[8,-2],[7,-4],[3,-8],[2,-8],[3,-3],[53,6],[48,-2],[10,4],[10,9],[8,1],[18,-11],[14,-6],[43,-3],[26,-7],[9,1],[18,10],[33,31],[18,7],[19,3],[14,7],[26,24],[33,17],[25,9],[5,7],[6,12],[6,7],[6,2],[13,5],[7,4],[3,8],[1,9],[4,8],[17,6],[15,7],[23,6],[38,25],[80,15],[17,6],[16,1],[13,-11],[10,6],[6,-5],[4,-8],[8,-4],[17,-3],[9,0],[7,3],[0,-7],[19,10],[12,3],[5,-3],[4,-1],[18,5],[13,4],[14,-5],[26,-20],[13,-4],[18,-2],[15,-7],[11,-12],[10,-33],[10,-11],[7,-13],[-7,-24],[63,-38],[64,-58],[71,-43],[70,-42],[9,-8],[34,-50],[11,-9],[17,-3],[9,1],[12,9],[6,2],[9,-2],[13,-4],[16,-2],[12,-4],[9,0],[8,2],[12,8],[5,2],[32,-6],[17,2],[7,17],[0,4],[9,0]],[[2867,6992],[-3,-89],[2,-8],[5,-12],[37,-12],[6,-1],[8,1],[25,6],[8,0],[4,-3],[2,-5],[12,-43],[7,-9],[58,-57],[148,-84],[44,-45],[35,-14],[31,-19],[8,-4],[6,2],[4,4],[32,36],[4,4],[3,-2],[2,-5],[5,-28],[5,-10],[8,-11],[20,-18],[10,-8],[12,-7],[6,-4],[25,-27],[3,-4],[5,-12],[4,-6],[5,-3],[7,-2],[72,-9],[0,-48],[-6,-27],[22,-103],[-3,-25],[-29,-30],[-29,-41],[-9,-11],[-3,-8],[-3,-10],[-7,-66],[-23,-94],[29,-95],[1,-19],[4,-14],[3,-2],[6,-3],[7,-7],[12,-19],[1,-13],[-1,-10],[-4,-8],[-3,-8],[-1,-8],[4,-7],[5,-8],[2,-4],[0,-4],[-3,-4],[-5,-23],[-1,-24],[-6,-8],[-6,-4],[-8,1],[-7,-1],[-3,-2],[3,-7],[24,-37],[3,-8],[-5,-3],[-15,-7],[-8,-11],[-25,-19],[-4,-6],[1,-8],[20,-50],[0,-6],[-1,-4],[-5,-7],[-3,-4],[-1,-7],[2,-8],[4,-10],[24,-41]],[[2043,4503],[-28,76],[-9,37],[0,9],[6,7],[18,34],[9,9],[0,-17],[4,-8],[4,4],[3,19],[-2,32],[-13,97],[-8,29],[-13,22],[-10,23],[-8,27],[-5,29],[-3,55],[1,8],[3,8],[10,15],[2,8],[0,35],[2,1],[5,0],[2,-3],[-4,-7],[3,-5],[4,-8],[3,-4],[-4,-16],[-2,-17],[6,-9],[15,8],[-1,-10],[-9,-25],[11,11],[17,34],[10,7],[9,8],[5,19],[4,39],[-5,145],[-14,110],[-18,29],[-8,37],[-26,58],[-15,49],[-23,53],[-5,6],[-48,57],[-15,27],[-1,21],[-2,7],[-113,157],[-56,54],[-6,14],[-61,59],[-14,8],[0,9],[3,8],[2,4],[5,21],[0,5],[-2,11],[-4,8],[-59,93],[-11,54],[-23,59],[-76,106],[-46,81],[-28,37]],[[6836,8150],[0,-66],[0,-104],[1,-104],[0,-104],[0,-104],[0,-104],[1,-104],[0,-105],[0,-104],[1,-83]],[[6839,7168],[-1,0],[-18,-1],[-13,-7],[-11,-2],[-47,-3],[-40,-13],[-10,-2],[-52,-2],[-27,2],[-38,12],[-79,11],[-30,0],[-26,-5],[-15,1],[-34,7],[-14,4],[-19,10],[-13,4],[-599,72],[-20,2],[-44,0],[-21,-4],[-14,-7],[-24,-24],[-22,-12],[-355,-143],[-8,-4],[-26,-23],[-21,-25],[-132,-232],[-4,-12],[-23,-115],[-5,-17],[-20,-43],[-5,10],[-6,6],[-7,6],[-12,-1],[-53,-13],[-15,-10],[-8,-32],[-3,-25],[0,-7],[3,-1],[7,0],[24,6],[6,0],[2,-3],[0,-7],[-2,-17],[-2,-8],[-4,-8],[-9,-8],[-27,-17],[-6,-6],[0,-8],[1,-8],[2,-8],[11,-21],[2,-7],[-4,0],[-78,22],[-7,1],[-7,-1],[-8,-3],[-7,-5],[-7,-7],[-2,-16],[-1,-38],[1,-6],[4,-2],[7,-1],[15,2],[13,3],[3,-2],[2,-6],[6,-26],[1,-9],[-2,-7],[-11,-11],[-1,-8],[0,-8],[4,-35],[0,-9],[-2,-7],[-19,-11],[-1,-5],[0,-4],[2,-9],[2,-7],[0,-6],[-2,-24],[6,-35],[0,-10],[-3,-11],[-20,-27],[-16,-10],[-47,-23],[-8,-9]],[[3681,7884],[0,1],[4,8],[6,5],[202,111],[70,93],[31,53],[53,14],[10,-3],[9,-6],[4,-9],[7,-7],[11,-5],[24,1],[13,-5],[10,-8],[9,-17],[2,-6],[0,-7],[-3,-24],[1,-7],[5,-2],[7,-1],[7,1],[4,2],[1,7],[0,7],[2,8],[3,5],[19,6],[16,2],[4,-1],[3,-6],[3,-26],[0,-8],[-1,-6],[-5,-2],[-14,-2],[-3,-3],[-2,-7],[2,-33],[1,-8],[2,-4],[6,-6],[8,-4],[10,-3],[16,3],[11,-2],[9,-3],[25,-17],[4,-4],[3,-5],[1,-13],[5,-6],[14,-12],[9,-4],[11,-3],[18,1],[13,-5],[13,-8],[26,-24],[3,-3],[4,-2],[46,-2],[11,3],[23,11],[18,5],[9,0],[5,-5],[3,-7],[5,-15],[4,-7],[6,0],[10,5],[34,21],[8,6],[5,8],[-4,10],[-26,35],[-7,11],[-2,10],[0,11],[2,19],[5,6],[3,5],[5,11],[27,15],[2,9],[2,10],[3,9],[7,4],[10,3],[9,2],[7,4],[5,6],[4,15],[3,24],[0,30],[1,11],[2,9],[6,7],[2,12],[-1,11],[-6,57],[1,8],[5,3],[9,2],[10,0],[12,4],[14,9],[18,23],[13,10],[22,11],[8,10],[6,87],[11,72]],[[4782,8493],[769,-46],[-1,-311],[1285,14],[1,0]],[[2836,9635],[2,-56],[22,-49],[18,-28],[8,-15],[9,-26],[6,-68]],[[2901,9393],[-265,-288],[-1,-13],[13,-7],[85,-53],[32,-12],[28,-20],[8,-41],[1,-43],[38,-309],[-15,-47],[-23,-38],[4,-46],[32,-89],[-5,-49],[-30,-31],[12,-26],[18,-23],[19,-7],[17,-11],[-25,-13],[-28,-4],[-30,-16],[-29,-20],[-26,-9],[-28,-7],[-22,-9],[-23,-5],[-1,-11],[1,-12]],[[1847,9635],[50,0],[190,0],[189,0],[190,0],[189,0],[181,0]],[[3161,9379],[0,-272],[10,-2],[11,-12],[4,-18],[4,-67],[-6,-48],[-8,-22],[-34,-50],[-13,-9],[-9,-15],[1,-37],[8,-37],[-5,-60],[6,-21],[10,-20],[12,-43],[33,-42],[3,-22],[-14,-12],[-16,-1],[-16,-6],[-23,-31],[-32,-35],[-28,-40],[-11,-26],[-3,-27],[0,-51],[5,-11],[2,-23],[24,-57],[13,-25],[8,-21],[13,-17],[24,-17],[-6,-26],[-15,-7],[-11,-10],[1,-23],[8,-60],[7,-19],[0,-19]],[[2901,9393],[1,-5],[13,-45],[112,16],[134,20]],[[4639,9634],[0,-313]],[[4639,9321],[-924,-3],[-265,-121],[-61,26],[-228,156]],[[2836,9635],[9,0],[189,0],[190,0],[189,0],[189,0],[190,0],[189,-1],[125,0],[65,0],[189,0],[189,0],[90,0]],[[6839,7168],[0,-21],[0,-104],[0,-104],[0,-104],[1,-104],[0,-103],[0,-1],[0,-48],[0,-48],[1,-48],[0,-48],[0,-48],[0,-48],[0,-48],[0,-48],[0,-48],[1,-48],[0,-48],[0,-48],[0,-48],[0,-48],[0,-48],[0,-48],[1,-34],[-10,-31],[-42,0],[-173,0],[-173,0],[-173,0],[-173,0],[0,-71],[1,-126],[0,-125],[0,-125],[0,-125],[0,-144],[0,-143],[0,-143],[1,-87],[0,-56],[0,-144],[0,-143],[0,-120]],[[6844,9154],[5,-294]],[[6849,8860],[-14,0],[0,-24],[0,-34],[0,-34],[0,-34],[0,-34],[0,-34],[0,-34],[0,-34],[0,-34],[0,-34],[0,-34],[0,-34],[0,-34],[0,-34],[0,-34],[0,-34],[0,-34],[1,-104],[0,-38]],[[4782,8493],[-136,9],[-7,819]],[[4639,9634],[100,0],[189,0],[40,0],[6,0],[1,-5],[2,-8],[5,-3],[5,-5],[12,-31],[1,-9],[2,-2],[18,-5],[25,-53],[3,-10],[10,-5],[38,-35],[3,-6],[3,-15],[4,-7],[7,-8],[14,-7],[7,-6],[42,-48],[15,-21],[10,-9],[29,-8],[66,-35],[96,-19],[63,3],[25,11],[16,3],[8,0],[22,-5],[33,3],[12,-9],[117,-37],[127,1],[42,11],[17,2],[15,-5],[6,-15],[7,-6],[16,-7],[17,-6],[11,-1],[4,4],[9,16],[4,3],[117,0],[28,-17],[26,-10],[7,-1],[43,5],[20,0],[10,1],[10,5],[6,-6],[10,10],[18,5],[20,-1],[17,-8],[26,23],[8,-5],[10,1],[25,4],[8,-3],[29,-26],[19,5],[18,-9],[17,-16],[14,-17],[8,-6],[25,-14],[22,-17],[9,-5],[19,5],[29,2],[26,-3],[12,-7],[6,-7],[12,-6],[12,-2],[5,4],[6,7],[12,-4],[23,-12],[16,-16],[19,2],[22,9],[24,5],[10,22],[58,17]],[[6844,9154],[10,3],[68,20],[13,-6],[12,4],[12,6],[14,2],[11,-2],[30,2],[12,-3],[33,-20],[42,-16],[22,-12],[12,-17],[4,-1],[14,4],[53,11],[186,38],[185,39],[185,38],[186,39],[150,32],[151,32],[151,32],[151,32],[61,13],[30,7],[26,5],[14,1],[22,5],[32,7],[31,7],[32,7],[32,7],[31,7],[32,7],[31,7],[32,7],[32,7],[31,7],[32,7],[31,7],[32,7],[32,7],[31,7],[32,7],[22,5],[13,1],[14,-2],[39,-2],[8,-5],[6,3],[31,10],[13,2],[13,-3],[32,-12],[22,-4],[14,-8],[18,-4],[6,-4],[5,-6],[6,-5],[12,-5],[7,-1],[7,1],[7,3],[12,11],[8,5],[4,6],[5,6],[7,2],[33,0],[63,-11],[4,-1],[4,-4],[5,-4],[8,-2],[23,1],[51,-11],[20,-10],[9,-15],[15,8],[9,-7],[1,-1],[8,-13],[12,-9],[7,-1],[14,5],[7,1],[3,-2],[-5,-15],[0,-5],[5,-7],[4,-3],[5,-1],[9,0],[2,-3],[13,-13],[3,-2],[6,-24],[1,-4],[7,-2],[5,-4],[4,-6],[2,-6],[6,10],[5,0],[11,-12],[3,-5],[-1,-11],[1,-5],[3,-3],[9,-5],[3,-3],[10,-14],[6,-2],[12,-1],[10,-3],[10,-6],[8,-9],[5,-11],[-48,10],[-30,0],[-25,-26],[-24,-11],[-23,-1],[-7,17],[-20,-14],[-10,-1],[-6,9],[-11,-5],[-6,4],[-5,7],[-8,5],[5,12],[-8,-1],[-4,-4],[-2,-6],[-6,-6],[-5,-3],[-54,-19],[-14,-1],[-13,-4],[-17,-15],[-16,-4],[-4,-2],[-5,-12],[-6,-3],[-7,-1],[-6,-3],[-6,-3],[-4,-4],[-19,-27],[-26,-18],[-11,-10],[-37,-49],[-3,-1],[-2,-5],[-11,-13],[-2,-5],[-7,-2],[-34,-4],[-10,-3],[-25,26],[-1,13],[-4,4],[-5,3],[-5,5],[-13,27],[-9,9],[-16,3],[-25,2],[-11,-5],[-12,-13],[-21,-40],[-7,-5],[-7,1],[-13,7],[-8,3],[-15,2],[-15,-2],[-26,-14],[-35,-47],[-25,-19],[-27,-5],[-6,-4],[-21,-22],[-6,-5],[-21,-9],[-9,-8],[-4,-4],[-2,-6],[-4,3],[-3,2],[-4,2],[-4,-1],[-26,-20],[-2,-29],[-12,-12],[-22,-16],[-9,-9],[-13,-21],[-9,-9],[-12,-4],[-69,-81],[-11,-8],[-15,-3],[-18,-22],[-5,-4],[-3,-2],[-26,-10],[-13,-1],[-10,9],[-6,35],[-11,36],[-7,11],[11,17],[-7,18],[-24,28],[6,13],[-4,8],[-8,7],[-4,9],[-3,10],[-8,3],[-10,2],[-10,5],[-4,6],[-10,14],[-11,11],[-8,-9],[-7,1],[-6,3],[-4,2],[-1,5],[1,14],[0,5],[-5,8],[-22,28],[-9,21],[-8,12],[-2,5],[-1,6],[1,20],[-2,2],[-6,1],[-5,2],[-3,6],[0,11],[-1,5],[-4,4],[-9,5],[-28,2],[-51,-5],[-64,-6],[-87,-8],[-65,-14],[-62,-13],[-62,-13],[-63,-13],[-62,-13],[-62,-13],[-63,-13],[-62,-13],[-62,-13],[-63,-13],[-62,-13],[-62,-13],[-62,-13],[-63,-13],[-62,-13],[-62,-13],[-63,-13],[-12,-3],[-13,-3],[-12,-2],[-13,-3],[-14,0],[-14,-1],[-35,-2],[-34,-1],[-35,-2],[-35,-1],[-41,-2],[-42,-2],[-42,-2],[-41,-2],[-23,-1]]],"transform":{"scale":[0.0013543513782378284,0.0012009511904190367],"translate":[11.717621290000068,-28.95936818399987]}};
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
