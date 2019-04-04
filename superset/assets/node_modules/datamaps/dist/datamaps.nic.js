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
  Datamap.prototype.namTopo = '__NAM__';
  Datamap.prototype.nclTopo = '__NCL__';
  Datamap.prototype.nerTopo = '__NER__';
  Datamap.prototype.nfkTopo = '__NFK__';
  Datamap.prototype.ngaTopo = '__NGA__';
  Datamap.prototype.nicTopo = {"type":"Topology","objects":{"nic":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Rivas"},"id":"lake","arcs":[[0,1,2,3,4]]},{"type":"Polygon","properties":{"name":"Rio San Juan"},"id":"NI.","arcs":[[5,6,-2,7]]},{"type":"MultiPolygon","properties":{"name":"Atlántico Sur"},"id":"NI.AS","arcs":[[[8]],[[9]],[[10]],[[11,-6,12,13,14,15]]]},{"type":"Polygon","properties":{"name":"Carazo"},"id":"NI.CA","arcs":[[16,-4,17,18,19]]},{"type":"Polygon","properties":{"name":"Granada"},"id":"NI.GR","arcs":[[20,21,-5,-17,22,23]]},{"type":"Polygon","properties":{"name":"Jinotega"},"id":"NI.JI","arcs":[[24,25,26,27,28,29]]},{"type":"MultiPolygon","properties":{"name":"Atlántico Norte"},"id":"NI.AN","arcs":[[[30]],[[31]],[[32]],[[33]],[[34]],[[35]],[[36]],[[37]],[[38]],[[39]],[[40]],[[41]],[[42]],[[43]],[[44]],[[45]],[[46]],[[47]],[[48]],[[49]],[[50]],[[51]],[[52]],[[53]],[[54]],[[55]],[[56]],[[57]],[[58]],[[59]],[[60]],[[61]],[[62]],[[63]],[[64]],[[65]],[[66]],[[67]],[[68]],[[69]],[[70]],[[71]],[[72]],[[73]],[[74]],[[75]],[[76]],[[77]],[[78]],[[79]],[[80]],[[81]],[[82]],[[83]],[[84]],[[85]],[[86]],[[87]],[[88]],[[89]],[[90]],[[91]],[[92]],[[93]],[[94]],[[95]],[[96]],[[97]],[[98]],[[99]],[[100]],[[101]],[[102]],[[103]],[[104]],[[105]],[[106]],[[107]],[[108]],[[109]],[[110]],[[111]],[[112]],[[113]],[[114]],[[115]],[[116]],[[117]],[[118]],[[119]],[[120]],[[121]],[[122]],[[123]],[[-16,124,-30,125]]]},{"type":"Polygon","properties":{"name":"León"},"id":"NI.LE","arcs":[[126,127,128,129,130]]},{"type":"Polygon","properties":{"name":"Managua"},"id":"NI.MN","arcs":[[131,-24,132,-19,133,-128,134]]},{"type":"Polygon","properties":{"name":"Masaya"},"id":"NI.MS","arcs":[[-23,-20,-133]]},{"type":"Polygon","properties":{"name":"Chinandega"},"id":"NI.CI","arcs":[[135,136,-130,137]]},{"type":"Polygon","properties":{"name":"Estelí"},"id":"NI.ES","arcs":[[-26,138,-131,-137,139]]},{"type":"Polygon","properties":{"name":"Madriz"},"id":"NI.MD","arcs":[[-27,-140,-136,140,141]]},{"type":"Polygon","properties":{"name":"Matagalpa"},"id":"NI.MT","arcs":[[-15,142,-135,-127,-139,-25,-125]]},{"type":"Polygon","properties":{"name":"Nueva Segovia"},"id":"NI.NS","arcs":[[-28,-142,143]]},{"type":"Polygon","properties":{"name":"Boaco"},"id":"NI.BO","arcs":[[144,-21,-132,-143,-14]]},{"type":"Polygon","properties":{"name":"Chontales"},"id":"NI.CO","arcs":[[-8,-1,-22,-145,-13]]}]}},"arcs":[[[4218,2240],[822,-114]],[[5040,2126],[-467,-1122],[79,-85],[175,-75],[96,-47],[262,-113],[167,-66],[110,-76]],[[5462,542],[-45,-19],[-45,6],[-315,136],[-280,122],[-70,30],[-264,114],[-197,86],[-63,41],[-55,58],[-56,34],[-65,-32],[-55,-87],[-35,-90],[-48,-90],[-1,1],[-97,47],[-38,7],[-27,18],[-16,41],[-18,83],[-36,62],[-208,273],[-17,15],[-9,5],[-30,24],[-6,10],[-68,22],[-30,34],[-66,93],[-52,31],[-66,82],[-85,57],[-29,30],[-7,18],[-17,63]],[[2946,1867],[57,121],[12,28],[6,9],[68,53]],[[3089,2078],[46,-14],[15,3],[7,8],[54,32],[7,6],[22,40],[30,77],[6,6],[5,4],[5,1],[3,0],[10,-3],[9,-6],[7,-10],[19,-23],[10,-3],[86,26],[64,21],[724,-3]],[[6004,2661],[39,-159],[29,-63],[16,-16],[13,-15],[4,-15],[-2,-27],[3,-61],[21,-58],[19,-73],[-1,-19],[-3,-26],[-19,-52],[-28,-112],[-5,-45],[-1,-30],[14,-89],[8,-90],[129,-56],[57,-40],[155,-113],[30,-35],[12,-32],[1,-29],[4,-29],[15,-36],[17,-21],[18,-15],[92,-55],[77,-65],[55,-65],[17,-26],[40,-76],[10,-14],[8,-6],[6,0],[7,-2],[7,-4],[13,-8],[5,-3],[11,-3],[15,-7],[5,-1],[5,0],[20,3],[12,0],[6,0],[12,-4],[32,-15],[24,-9],[62,9],[13,-1],[6,-4],[-1,-13],[-1,-7],[1,-6],[3,-5],[21,-26],[19,-19],[11,-6],[8,-1],[16,11],[13,3],[4,2],[9,5],[4,3],[9,7],[8,3],[14,3],[12,-2],[19,-8],[9,-2],[7,1],[4,2],[5,2],[5,3],[4,3],[15,7],[19,3],[10,3],[27,15],[6,-1],[3,-4],[0,-8],[-3,-43],[0,-7],[3,-12],[2,-6],[6,-9],[6,-8],[3,-5],[2,-6],[1,-7],[1,-15],[1,-9],[3,-9],[9,-12],[6,-4],[6,0],[5,2],[4,3],[4,3],[14,0],[22,-2],[77,-17],[15,-6],[4,-3],[7,-8],[35,-54],[29,-55],[50,-64],[34,-30]],[[7738,534],[15,-50],[35,8],[-8,25],[28,5],[42,-10],[32,-20],[-14,2],[-12,-1],[-12,3],[-14,-12],[2,-11],[-1,-12],[2,-99],[18,-82],[-6,-63],[-68,-42],[-128,-36],[-10,-2],[-130,-58],[-40,-55],[-7,-5],[-53,13],[-13,-5],[-27,-23],[-19,-4],[-19,3],[-13,8],[-117,108],[-9,40],[-22,17],[-26,-5],[-23,-27],[-33,9],[-49,-36],[-23,27],[-14,0],[-22,-20],[-23,10],[-36,41],[-23,-4],[-17,3],[-14,2],[-31,1],[-21,-19],[-11,16],[-43,40],[-4,8],[-8,10],[-4,13],[9,18],[8,6],[27,17],[-7,56],[-34,33],[-37,22],[-17,23],[-21,16],[-91,41],[-20,22],[-6,17],[-26,38],[-8,17],[-4,28],[0,24],[-4,17],[-19,11],[-17,-11],[-104,-81],[-19,-9],[-21,3],[-21,9],[-18,12],[-16,17],[-45,64],[-8,7],[-9,6],[-10,5],[-11,3],[-97,51],[-45,16],[-42,-2],[-34,5],[-74,63],[-35,18],[-61,-17],[-144,-112],[-202,-156]],[[5040,2126],[36,71],[4,7],[8,9],[31,17],[39,32],[18,12],[12,6],[9,-5],[5,-1],[9,1],[37,16],[11,8],[7,6],[6,13],[9,13],[14,17],[3,5],[2,5],[3,5],[8,11],[4,6],[1,10],[0,2],[6,16],[29,52],[83,21],[49,38],[129,138],[6,11],[10,4],[10,1],[144,-2],[39,9],[9,0],[16,-6],[8,-1],[30,4],[6,-1],[8,-2],[9,-5],[22,-5],[75,-3]],[[7734,2710],[1,-31],[-13,19],[-15,63],[-4,84],[14,73],[40,32],[3,-1],[2,-1],[1,-5],[-1,-7],[-13,-24],[-13,-38],[-10,-42],[-4,-37],[12,-85]],[[9090,3385],[-57,-72],[-4,51],[19,41],[27,16],[22,-20],[-7,-16]],[[9176,3667],[-1,-25],[-9,12],[-15,8],[-5,9],[8,20],[9,6],[5,-18],[1,-8],[7,-4]],[[8106,5371],[42,-301],[-65,-611],[0,-135],[6,-22],[29,-67],[18,-73],[55,-89],[13,-58],[-5,-71],[-21,-37],[-39,-16],[-63,-2],[-48,-12],[-48,-20],[-46,-9],[-39,25],[15,16],[40,34],[12,15],[1,27],[-7,36],[-12,32],[-43,44],[3,152],[-9,58],[7,4],[3,1],[1,1],[4,8],[12,0],[69,-25],[48,72],[16,104],[-25,71],[0,17],[16,22],[7,31],[3,129],[4,5],[8,8],[9,12],[6,16],[-7,62],[-37,37],[-53,14],[-50,-4],[-40,-27],[-17,-43],[1,-47],[15,-41],[43,-27],[4,-5],[0,-8],[4,-39],[2,-16],[9,-16],[9,-6],[7,-10],[3,-23],[-1,-39],[-4,-16],[-9,-18],[7,-11],[21,-36],[-62,-42],[-103,-101],[-63,-31],[-84,-11],[-36,-13],[-14,-31],[0,-121],[2,-2],[8,5],[16,-1],[24,-6],[15,0],[14,-4],[15,-22],[14,-103],[-8,-50],[-14,-47],[-6,-44],[14,-42],[36,-21],[61,16],[11,-36],[-2,-23],[-10,-45],[-3,-27],[4,-14],[9,21],[31,119],[12,29],[18,13],[38,-7],[8,-17],[-91,-213],[-43,-275],[14,-297],[15,-49],[-13,-10],[-15,-6],[8,47],[-14,40],[-48,71],[-21,58],[17,25],[28,23],[16,53],[-10,40],[-26,45],[-34,39],[-37,20],[-59,-7],[3,-35],[31,-21],[25,31],[15,0],[32,-40],[14,-24],[6,-30],[-8,-40],[-29,-50],[-3,-37],[-11,-44],[-35,-2],[-81,29],[-10,-8],[23,-17],[48,-23],[12,-18],[8,-24],[4,-29],[2,-31],[-4,-21],[-18,-42],[-4,-17],[4,-13],[6,-13],[5,-15],[-3,-15],[-10,-14],[-11,-7],[-10,-4],[-7,-7],[-36,-54],[-12,-9],[-16,-7],[-19,-17],[-17,-21],[-8,-20],[25,-20],[32,-33],[26,-36],[17,-44],[14,-12],[19,-8],[20,-3],[29,3],[2,11],[-8,15],[-3,18],[13,45],[11,24],[17,9],[33,1],[18,-19],[91,-423],[5,-81],[-1,-30],[-3,-18],[-7,-14],[-16,-17],[-4,6],[-27,-6],[-27,-11],[-3,-5],[-15,-8],[-19,-33],[-18,-8],[-24,0],[-19,-4],[-16,-9],[-16,-17],[-20,-72],[-18,-108],[-27,-82],[-41,7],[-12,0],[-62,-92],[-18,-36],[-10,-39],[0,-235],[60,-303],[42,-121],[58,-106],[19,-57],[47,-88],[16,-18],[36,-26],[14,-44]],[[6004,2661],[-10,39],[-14,30],[-2,7],[-2,10],[16,16],[76,37],[-250,139],[-13,24],[-124,364],[-26,138],[-2,77],[12,52],[-6,35],[-69,142],[-12,15],[-14,14],[-13,17],[-14,28],[-11,37],[-8,75],[3,40],[5,28],[11,31],[3,14],[-4,16],[-13,24],[-26,29],[-40,72],[-43,111],[-11,22],[-57,60],[-47,80]],[[5299,4484],[-10,12],[-22,13],[-2,8],[-1,10],[5,36],[-2,43],[-9,29],[-16,37],[-12,16],[-12,12],[-17,11],[-16,29],[-9,4],[-58,51],[-36,23],[-36,-1],[-38,-40],[-10,-27],[-7,-65],[-8,-34],[-6,1],[-16,-12],[-14,-14],[1,-7],[-7,-4],[-26,-29],[20,-37],[2,-35],[-16,-18],[-32,12]],[[4889,4508],[-51,126],[-15,79],[-8,26],[-19,44],[-2,22],[3,22],[7,19],[14,15],[17,10],[28,3],[22,-4],[23,-1],[19,8],[22,23],[7,22],[0,37],[6,11],[20,3],[17,-4],[34,-12],[22,-3],[23,1],[27,6],[54,19],[19,2],[116,-23],[25,-9],[8,10],[24,19],[12,12],[20,35],[14,39],[39,-9],[45,35],[40,46],[29,23],[23,2],[37,12],[27,1],[25,-7],[11,-10],[11,-1],[20,18],[11,5],[9,-2],[5,2],[4,35],[8,23],[2,8],[2,33],[13,78],[8,19],[41,53],[1,1],[13,12],[8,6],[1,1],[-5,1],[-5,0],[-6,-2],[-5,-2],[-21,-15],[-6,-2],[-6,-1],[-6,0],[-6,1],[-5,2],[-5,3],[-4,4],[-6,8],[-6,9],[-28,68],[-12,45],[-3,6],[-15,22],[-8,8],[-4,3],[-5,2],[-5,2],[-5,2],[-4,3],[-14,15],[-5,3],[-4,2],[6,16],[7,12],[84,131]],[[5723,5795],[504,71],[272,2],[39,6],[24,10],[24,30],[20,16],[15,5],[12,1],[15,-2],[11,-3],[12,-7],[13,-10],[23,-8],[19,1],[118,38],[26,4],[16,-4],[5,-12],[37,-137],[8,-17],[11,-14],[13,-3],[16,-10],[48,17],[30,-7],[-6,10],[-10,23],[-10,13],[36,-8],[31,-13],[23,5],[16,49],[13,-11],[9,-1],[18,12],[13,0],[18,-13],[7,10],[-2,24],[-11,26],[21,-4],[8,-6],[29,-3],[158,-7],[38,-7],[20,-10],[15,-10],[20,-10],[34,-11],[15,-9],[7,-10],[-1,-13],[-4,-14],[-7,-14],[-37,-52],[-7,-13],[-4,-14],[-2,-13],[2,-12],[6,-10],[8,-9],[147,-125],[192,-130],[35,-14],[80,5],[98,-7],[36,5]],[[3146,2646],[-9,-24],[-40,-85],[-11,-58],[7,-57],[8,-39],[1,-27],[-5,-21],[-23,-37],[-19,-43],[-8,-72],[3,-33],[5,-21],[34,-51]],[[2946,1867],[-2,6],[-60,32],[-73,82],[-179,92],[-31,27],[-26,35],[-22,73],[-233,208],[-12,17]],[[2308,2439],[0,1],[49,55],[20,14],[15,1],[12,1],[22,7],[11,5],[7,4],[25,27],[20,35],[53,46],[14,16],[38,72],[122,116],[23,41]],[[2739,2880],[21,-30],[179,-84],[57,-31],[25,-42],[5,-5],[104,-36],[16,-6]],[[3577,3440],[13,-45],[3,-35],[3,-18],[10,-14],[17,-14],[31,-15],[53,-53],[104,-171],[146,12]],[[3957,3087],[261,-847]],[[3146,2646],[38,97],[18,47],[7,18],[70,181],[79,202],[-6,36],[-65,86]],[[3287,3313],[164,85],[61,52],[16,7],[15,0],[34,-17]],[[4250,6154],[-108,-82],[-38,-17],[-46,-1],[-41,-32],[-27,-36],[-29,-53],[-34,-68],[-142,-194],[-73,-74],[-21,-14],[-91,-91],[-110,-121],[-43,-35],[-20,-8],[-24,-4],[-71,4],[-23,-5],[-10,-5],[-26,-37],[-67,60],[-30,35],[-28,20],[-18,9],[-26,-1],[-10,0]],[[3094,5404],[-31,43],[-85,59],[-147,171],[-14,24],[-13,32],[23,44],[6,39],[-5,29],[28,96],[-18,100],[1,49],[6,39],[11,35],[16,35]],[[2872,6199],[72,89],[32,33],[31,6],[27,2],[24,-12],[19,25],[76,70],[18,26]],[[3171,6438],[19,26],[22,11],[21,-30],[19,10],[102,10],[33,-3],[22,-14],[16,-18],[19,-11],[26,4],[13,12],[33,54],[44,37],[35,21],[22,30],[-3,138],[6,57],[17,54],[57,112],[8,28],[6,31],[3,109],[12,38],[19,27],[47,33]],[[3789,7204],[1,-1],[4,5],[14,14],[16,37],[4,36],[-11,27],[-29,10],[-8,21],[8,44],[20,70],[2,51],[10,12],[20,-5],[34,-3],[25,14],[40,39],[16,-5],[12,0],[0,11],[3,2],[5,0],[6,2],[-6,25],[68,24],[19,23],[18,32],[43,16],[17,4],[32,6],[36,14],[19,32],[4,37],[11,31],[70,22],[34,22],[50,46],[23,32],[21,45],[16,44],[14,59],[19,37],[23,34],[18,21],[9,1],[21,-3],[8,2],[5,7],[6,17],[14,19],[8,16],[10,13],[19,5],[46,27],[20,5],[74,0],[48,10],[49,18],[40,29],[23,38],[-2,53],[-25,46],[-35,36],[-31,24],[53,48],[2,14],[-4,36],[2,14],[45,56],[7,15],[4,117],[8,64],[16,33],[35,-10],[31,-40],[34,-29],[41,23],[69,80],[12,32]],[[5192,9007],[9,-1],[15,-4],[5,-4],[6,-5],[5,-9],[4,-10],[3,-14],[1,-15],[-11,-34],[-3,-13],[1,-14],[-1,-11],[-4,-24],[-1,-13],[1,-20],[-1,-22],[1,-7],[3,-5],[26,-24],[29,-18],[9,-10],[7,-14],[3,-18],[-3,-23],[-22,-43],[-3,-15],[2,-50],[-2,-12],[-15,-31],[-4,-16],[1,-15],[5,-17],[37,-55],[33,-35],[28,-39],[10,-8],[14,-4],[174,-13],[5,-32],[-3,-56],[-43,-265],[-6,-108],[18,-84],[-4,-28],[-18,-44],[-118,-231],[-248,-459],[-10,-12],[-9,-4],[-186,99],[-7,-2],[-238,-172],[-4,-1],[-157,-25],[-10,-13],[-9,-21],[-17,-55],[-16,-28],[-14,-19],[-20,-15],[-3,-14],[1,-21],[16,-39],[13,-26],[10,-31],[3,-22],[-21,-72],[-1,-42],[1,-12],[-2,-21],[-7,-18],[-21,-21],[-106,-79],[-61,-63],[-11,-30],[-1,-82]],[[9630,7932],[-5,-3],[3,5],[2,-2]],[[9575,7947],[0,-2],[1,1],[1,-4],[-3,-2],[-1,2],[-2,3],[4,2]],[[9599,7952],[0,-4],[-2,2],[2,2]],[[9534,7974],[0,-3],[-6,2],[3,5],[3,-4]],[[9643,7981],[-1,-4],[-5,3],[0,5],[6,-4]],[[9641,7993],[0,-4],[-6,1],[6,3]],[[9520,7996],[0,-2],[1,1],[1,-4],[-3,-2],[0,2],[-1,0],[-2,3],[4,2]],[[9520,8004],[0,-3],[-2,4],[2,-1]],[[9513,8008],[0,-2],[1,0],[1,-4],[-3,-1],[-1,1],[-2,4],[4,2]],[[9484,8031],[-1,-2],[-2,6],[3,-4]],[[9486,8047],[0,-2],[1,0],[1,-4],[-3,-1],[0,1],[-1,0],[-2,4],[4,2]],[[9999,8159],[-7,-7],[-2,10],[9,-3]],[[9143,8174],[-3,-1],[1,4],[2,-3]],[[9141,8196],[0,-8],[-3,1],[3,7]],[[9241,8211],[0,-2],[-5,2],[5,0]],[[9254,8221],[-3,-1],[3,7],[0,-6]],[[9308,8256],[-6,0],[4,8],[2,-8]],[[9193,8267],[1,-1],[1,-4],[-2,-1],[-1,1],[-2,4],[3,1]],[[9993,8268],[-3,0],[1,4],[2,-4]],[[9980,8273],[-2,0],[0,2],[2,2],[2,-2],[-2,-2]],[[9399,8277],[-3,0],[3,4],[0,-4]],[[9184,8281],[-2,0],[-2,3],[3,1],[1,-4]],[[9395,8284],[0,-3],[-2,2],[0,3],[2,-2]],[[9417,8289],[-5,-2],[-1,2],[6,0]],[[9248,8310],[-1,-6],[-3,3],[4,3]],[[9237,8306],[-5,-2],[1,8],[4,-6]],[[9249,8315],[0,-2],[-4,2],[4,0]],[[9237,8325],[-1,-2],[-3,1],[2,5],[2,-4]],[[9232,8336],[-1,-4],[-3,0],[0,2],[4,2]],[[9038,8340],[0,-2],[1,0],[1,-4],[-3,-1],[-1,1],[-2,3],[4,3]],[[9070,8348],[-4,-7],[-2,2],[6,5]],[[9053,8352],[0,-1],[1,0],[0,-4],[-2,-1],[-1,1],[-2,3],[4,2]],[[9038,8354],[-2,-5],[-2,3],[4,2]],[[9061,8348],[-2,0],[-5,5],[6,1],[1,-6]],[[9198,8349],[-3,0],[7,6],[-4,-6]],[[9046,8349],[-2,0],[-1,9],[3,-9]],[[9069,8354],[-2,0],[-2,3],[4,2],[0,-5]],[[9078,8359],[-1,-5],[-4,1],[1,7],[4,-3]],[[9062,8361],[-3,-2],[-1,3],[3,6],[1,-7]],[[9939,8370],[-19,-34],[-5,17],[10,15],[14,2]],[[9020,8369],[-4,-1],[1,6],[3,-5]],[[9013,8370],[-4,-2],[-1,4],[0,4],[6,5],[1,-5],[-2,-6]],[[9912,8392],[6,-23],[-19,6],[13,17]],[[9112,8395],[-2,0],[1,4],[1,-4]],[[9121,8396],[-3,-1],[0,6],[3,-5]],[[9113,8406],[-6,-2],[0,5],[6,-3]],[[9065,8503],[-3,-2],[1,7],[2,-5]],[[9337,8516],[-4,-4],[-1,10],[5,-6]],[[9346,8528],[1,-1],[1,-4],[-2,-1],[-1,1],[-2,3],[3,2]],[[9338,8534],[-4,-5],[-1,8],[5,-3]],[[9043,8567],[-3,0],[1,4],[2,-4]],[[9037,8579],[0,-2],[1,1],[0,-4],[-2,-2],[-1,1],[-2,4],[4,2]],[[9660,8467],[-36,-18],[-103,10],[-9,1],[8,0],[1,0],[4,1],[3,6],[-1,9],[31,20],[13,26],[7,27],[14,21],[32,19],[26,0],[17,-19],[6,-38],[-13,-65]],[[9407,8584],[-20,-8],[0,26],[20,-18]],[[9084,8608],[-2,-1],[1,4],[1,-3]],[[9707,8632],[-2,-3],[-1,5],[3,-2]],[[9685,8632],[-3,0],[0,3],[3,2],[0,-5]],[[9741,8645],[-2,0],[-1,1],[2,3],[1,-4]],[[9717,8655],[-2,-3],[-4,4],[6,-1]],[[9740,8656],[-2,0],[2,3],[0,-3]],[[9737,8661],[0,-5],[-3,4],[3,1]],[[9703,8663],[0,-2],[-2,3],[2,-1]],[[9711,8667],[0,-2],[1,1],[1,-4],[-3,-2],[-1,2],[0,-1],[-2,4],[4,2]],[[9381,8665],[-3,-1],[-2,4],[6,-1],[-1,-2]],[[9697,8667],[-2,-2],[-2,2],[1,6],[4,-1],[-1,-5]],[[9376,8674],[0,-5],[-4,5],[4,0]],[[9354,8687],[0,-1],[1,0],[0,-4],[-2,-1],[-1,1],[-2,3],[4,2]],[[9402,8696],[-6,-4],[-1,3],[7,1]],[[9329,8695],[-4,-4],[-1,7],[5,-3]],[[9362,8707],[-4,-3],[-1,1],[2,3],[3,-1]],[[9484,8733],[-1,0],[-2,6],[5,-1],[-2,-5]],[[9478,8740],[0,-1],[1,0],[0,-4],[-2,-1],[-1,1],[-2,3],[4,2]],[[9464,8751],[1,-2],[1,-4],[-2,-1],[-1,1],[-1,0],[-2,3],[4,3]],[[9490,8747],[-3,0],[1,5],[2,-5]],[[9482,8754],[-2,-3],[-2,8],[4,-5]],[[9097,8776],[1,-1],[1,-4],[-2,-1],[-1,1],[-2,3],[3,2]],[[9956,8889],[-4,0],[2,5],[0,1],[2,-6]],[[9212,8895],[0,-2],[1,1],[0,-4],[-2,-2],[-1,2],[0,-1],[-2,4],[4,2]],[[9953,8901],[0,-2],[1,1],[0,-4],[-1,-1],[-1,-1],[-1,1],[-2,4],[4,2]],[[9965,8898],[-1,-2],[-5,6],[6,-4]],[[9978,8898],[-6,-2],[0,8],[6,-6]],[[9814,8913],[11,-45],[-7,8],[-12,19],[8,18]],[[9660,8916],[0,-1],[1,0],[1,-4],[-3,-1],[-1,1],[-2,4],[4,1]],[[9994,8927],[0,-2],[1,0],[1,-4],[-3,-1],[-1,1],[-2,3],[4,3]],[[9207,8931],[0,-2],[1,1],[0,-4],[-2,-2],[-1,2],[0,-1],[-2,4],[4,2]],[[9961,8931],[0,-2],[1,1],[1,-4],[-3,-2],[0,2],[-1,-1],[-2,4],[4,2]],[[9990,8932],[-3,0],[0,7],[3,-7]],[[9739,8969],[-2,-5],[-3,0],[1,4],[4,1]],[[9788,9000],[-2,0],[1,5],[3,-1],[-2,-4]],[[9580,9059],[1,-28],[-13,16],[12,12]],[[9846,9062],[0,-1],[1,0],[1,-4],[-3,-1],[-1,1],[-2,3],[4,2]],[[9784,9093],[0,-2],[1,0],[1,-4],[-3,-1],[-1,1],[-2,4],[4,2]],[[9780,9110],[-2,-2],[-10,7],[7,2],[5,-7]],[[9738,9480],[0,-4],[-4,2],[2,6],[2,-4]],[[5723,5795],[-36,62],[-195,288],[-11,23],[-7,8],[-8,3],[-177,-192],[-18,-8],[-30,-3],[-129,3],[-65,-7],[-50,-34],[-25,-42],[-16,-41],[-23,-81],[-24,-58],[-17,-23],[-19,-17],[-56,-30],[-51,-14],[-20,3],[-60,29],[-14,23],[-24,3],[-3,5],[-3,21],[-3,7],[-7,6],[-28,15],[-14,12],[-8,3],[-7,0],[-10,-4],[-12,-1],[-6,0],[-6,1],[-5,2],[-4,4],[-56,60],[-11,10],[-9,6],[-26,12],[-39,44],[-100,155],[-41,106]],[[5192,9007],[3,7],[-51,0],[12,18],[43,47],[-56,45],[-10,23],[30,10],[11,5],[6,14],[10,86],[17,36],[27,29],[4,3],[31,23],[34,29],[90,100],[32,21],[116,25],[52,2],[50,-17],[43,-37],[29,-55],[-6,-6],[-15,-23],[-1,-5],[38,-5],[6,-28],[-2,-31],[40,-31],[20,-39],[29,-79],[36,25],[38,-5],[75,-37],[44,-11],[143,-5],[-8,-17],[-6,-45],[30,11],[21,-14],[20,-20],[30,-10],[22,7],[50,33],[73,29],[36,51],[27,59],[25,44],[19,-23],[14,-60],[15,-12],[30,-3],[47,-13],[22,-1],[40,24],[10,51],[-10,109],[11,27],[24,2],[27,-11],[18,-11],[15,-15],[46,-57],[24,-11],[28,2],[48,16],[11,8],[8,11],[10,10],[18,4],[16,-3],[10,-6],[8,-1],[13,10],[0,17],[-17,20],[-13,21],[-23,54],[21,21],[15,1],[44,-33],[5,-10],[8,-9],[20,-3],[33,1],[10,-6],[4,-18],[33,-4],[193,11],[-10,19],[0,22],[10,53],[24,-15],[31,-39],[25,-8],[-2,10],[-10,22],[14,-7],[8,-3],[7,-5],[11,-17],[24,25],[34,22],[39,14],[36,1],[-15,12],[-10,11],[-14,27],[109,8],[41,18],[-4,36],[24,2],[20,-3],[15,-11],[7,-20],[15,0],[-19,67],[8,26],[36,20],[39,6],[43,-3],[36,-12],[16,-25],[15,0],[8,29],[4,31],[10,25],[48,21],[48,44],[28,10],[-3,8],[-6,16],[-4,8],[29,-10],[11,-6],[-6,31],[3,27],[10,10],[20,-21],[1,35],[3,15],[10,15],[-13,22],[7,12],[19,3],[26,-5],[10,-12],[24,-42],[18,-11],[46,6],[39,27],[31,39],[18,40],[25,-22],[25,-12],[20,-14],[10,-31],[30,22],[33,3],[86,-11],[-23,-13],[-2,-12],[15,-12],[23,-10],[9,1],[86,-1],[51,27],[28,6],[65,-5],[26,5],[-14,-23],[-36,-20],[-18,-21],[-28,39],[-24,-27],[-18,-49],[-15,-27],[-25,-14],[-24,-33],[-17,-39],[-7,-32],[-5,-11],[-25,-28],[-10,-17],[-5,-22],[-4,-50],[-4,-22],[-16,-29],[-24,-21],[-67,-31],[5,14],[5,11],[17,23],[0,-18],[6,13],[4,11],[2,11],[0,16],[-15,-11],[-7,-2],[-17,13],[0,14],[23,13],[23,3],[19,-8],[15,-22],[-2,43],[-20,60],[-6,47],[-12,46],[-28,8],[-31,-14],[-23,-16],[-39,-42],[-86,-128],[-21,-55],[19,23],[7,10],[27,-24],[21,-95],[13,-22],[26,-17],[28,-32],[29,-11],[30,43],[-14,14],[-36,26],[-16,8],[22,14],[22,-8],[21,-23],[16,-31],[-2,53],[15,16],[17,-20],[76,-405],[4,-13],[19,-44],[16,-110],[94,-318],[11,-91],[-10,-79],[-53,-146],[-162,-302],[-70,-98],[-10,-38],[-13,-29],[-93,-75],[-39,-64],[-28,-74],[-46,-215],[-76,-292],[-46,-264],[3,-114],[-8,-55],[0,-44],[-41,-116],[-35,-153],[-21,-298],[3,-55],[14,-33],[-14,-14],[11,-28],[65,-459]],[[2773,4945],[-6,-58],[-23,-229],[-19,-205]],[[2725,4453],[-78,-55],[-27,-31],[-17,-25],[-5,-14],[-2,-11],[0,-9],[-3,-23],[0,-9],[1,-7],[-1,-10],[-2,-15],[-12,-41],[-2,-10],[1,-7],[4,-12],[2,-5],[18,-31],[1,-1],[11,-12],[3,-4],[1,-6],[1,-15],[1,-7],[2,-9],[-3,-7],[-8,-11],[-189,-218],[-131,-153],[-27,-44],[-3,-37],[0,-164],[2,-15],[6,-14],[8,-8],[10,-7],[12,-17],[3,-41],[-25,-65],[-38,-51],[-74,-65],[-10,-7],[-6,0],[-28,7],[-28,12],[-3,1],[-5,0],[-6,-1],[-5,-2],[-29,-12],[-14,-3],[-7,-4],[-5,-4],[-3,-5],[-2,-5],[0,-7],[1,-7],[3,-12],[13,-32],[9,-13],[3,-5],[2,-8],[-1,-6],[0,-6],[-9,-17],[-7,-9],[-48,-41]],[[1980,2981],[-38,54],[-73,149],[-69,218],[-19,35],[-49,49],[-399,284],[-25,36],[-110,74],[-59,74],[-135,71],[-5,53],[22,-34],[39,-30],[44,-21],[43,-9],[-45,57]],[[1102,4041],[43,30],[96,12],[34,18],[33,22],[18,14],[101,122],[40,74],[15,46],[7,15],[38,42],[50,62],[48,60],[38,20],[37,53],[27,61],[14,16],[22,13],[140,22],[28,8],[15,7],[35,25],[24,65],[6,73],[-18,280],[-24,64],[-27,50],[-41,111],[-19,78]],[[1882,5504],[34,16],[19,2],[26,-1],[31,-12],[37,-21],[23,2],[40,10],[129,50],[109,27],[23,-8],[15,-8],[36,-42],[51,-99],[20,-31],[10,-20],[13,-58],[-4,-72],[-43,-89],[-2,-27],[0,-19],[20,-41],[65,-38],[239,-80]],[[3342,4189],[-12,-41],[8,-78],[9,-33],[13,-26],[25,-39],[49,-62],[7,-13],[2,-14],[-4,-46],[0,-39],[3,-16],[6,-12],[171,-188],[4,-8],[-3,-13],[-32,-57],[-11,-64]],[[3287,3313],[-35,10],[-11,7],[-3,1],[-6,1],[-33,-5],[-67,-32],[-57,-11],[-35,-31],[-119,-137],[7,-29],[28,-34],[10,-17],[6,-14],[-3,-52],[-22,-41],[-11,-15],[-12,-13],[-15,-10],[-18,-6],[-16,-2],[-23,8],[-14,7],[-53,48],[-46,-66]],[[2308,2439],[-26,38],[-52,137],[-21,21],[-20,12],[-51,61],[-31,51],[-33,73],[-6,34],[-10,32],[-22,27],[-48,44],[-8,12]],[[2725,4453],[331,-85],[35,-13],[29,-31],[29,-39],[22,-20],[19,-15],[120,-54],[32,-7]],[[1859,5917],[2,-4],[37,-9],[11,-10],[6,-19],[2,-18],[-1,-14],[-3,-12],[-2,-6],[-18,-66]],[[1893,5759],[-20,-21],[-2,-3],[-5,-21],[-6,-72],[22,-138]],[[1102,4041],[-4,5],[-25,23],[-27,9],[-16,16],[-44,97],[-12,0],[19,-86],[-31,32],[-51,75],[-38,42],[-24,12],[-122,110],[-16,19],[-9,24],[-10,40],[-6,-12],[-15,-22],[-6,-12],[-215,289],[-25,61],[9,-11],[8,-7],[23,-14],[0,14],[-9,4],[-17,14],[0,14],[-5,24],[-33,31],[-44,28],[-39,12],[0,-14],[51,-40],[27,-29],[1,-26],[-19,3],[-29,26],[-44,48],[-228,160],[-48,49],[-29,57],[0,68],[37,80],[55,56],[56,41],[41,52],[10,88],[12,0],[-5,-49],[-7,-14],[22,0],[26,-4],[22,-8],[10,-11],[9,-7],[50,-49],[12,-8],[35,-55],[9,-8],[25,-17],[6,-7],[2,-15],[-4,-35],[2,-14],[64,-74],[83,-21],[201,14],[0,17],[-102,-3],[-51,7],[-22,21],[20,37],[94,55],[13,10],[447,33],[29,-4],[45,-32],[23,-1],[11,37],[40,24],[50,36],[22,28],[46,83],[11,10],[29,17],[10,11],[5,23],[-8,9],[-11,5],[-5,15],[17,122],[-3,5],[-15,38],[-4,13],[4,6],[14,65],[14,32],[16,22],[93,94],[26,20],[31,11],[34,-3],[112,-65],[18,-6],[19,5],[14,11]],[[3094,5404],[-74,-116],[-12,-60],[-5,-12],[-9,-13],[-16,-13],[-25,-10],[-50,-13],[-23,-9],[-43,-29],[-15,-17],[-7,-9],[-31,-75],[-11,-83]],[[1893,5759],[164,192],[37,60],[16,40],[80,163],[78,78],[52,10],[20,-8],[29,-16],[83,-46],[83,16],[149,56],[109,6],[37,-14],[7,-15],[20,-51],[15,-31]],[[1859,5917],[14,11],[27,29],[15,30],[4,36],[-12,66],[-4,14],[-14,30],[-12,13],[-14,4],[-11,7],[-8,23],[3,33],[25,64],[3,36],[-63,278],[-1,39],[12,74],[-1,38],[-7,14],[-17,15]],[[1798,6771],[16,15],[15,23],[6,8],[9,7],[43,0],[136,-30],[39,-66],[9,-20],[17,-22],[21,-17],[33,-15],[22,-15],[25,-25],[30,18],[20,22],[44,13],[19,3],[140,-3],[109,-41],[63,1],[81,12],[23,-3],[30,-11],[38,-27],[59,-30],[18,25],[12,66],[6,15],[5,10],[43,20],[38,15],[68,-64],[15,-19],[19,-27],[43,-89],[59,-82]],[[4889,4508],[1,-25],[-2,-22],[-5,-18],[-8,-15],[-13,0],[-10,10],[-18,14],[-17,8],[-8,-8],[-6,-23],[-13,4],[-61,79],[-22,4],[-33,-25],[-13,0],[11,58],[2,7],[-14,12],[-31,3],[-37,23],[-64,26],[-13,8],[-7,22],[-17,23],[-19,18],[-17,7],[-12,3],[-15,-13],[-3,-5],[-3,-9],[-4,-10],[-6,-10],[-4,-3],[-9,-7],[-9,-5],[-15,-5],[-5,-3],[-3,-4],[-2,-5],[-11,-5],[-20,-2],[-125,8],[-6,-2],[-5,-2],[-4,-4],[-3,-5],[-25,-58],[-6,-10],[-8,-4],[-11,-2],[-38,0],[-9,-2],[-18,-10],[-39,-9],[-24,-5],[-23,-23],[-8,-5],[-6,1],[-11,7],[-31,6],[-26,9],[-339,-83],[-31,-18],[-35,-84],[-93,-61],[-10,-9],[-58,-61]],[[1798,6771],[-8,7],[-8,12],[-4,21],[6,124],[2,40],[4,32],[4,14],[9,10],[22,18],[44,26],[41,4],[85,-13],[159,36],[77,5],[65,-41],[35,-12],[28,11],[26,16],[29,5],[30,-37],[12,-10],[18,-7],[14,-2],[101,8],[35,10],[30,16],[22,30],[12,35],[15,69],[31,56],[127,159],[68,122],[20,15],[23,11],[24,14],[23,27],[14,30],[7,22],[10,20],[22,23],[27,16],[149,26],[0,-26],[-21,-49],[5,-62],[138,-115],[42,-65],[13,-14],[28,-11],[18,4],[17,9],[27,2],[43,-22],[23,-40],[19,-48],[31,-43],[43,-18],[45,2],[40,-4],[26,-34],[4,-1]],[[5299,4484],[-24,-58],[-75,-127],[-7,-19],[-5,-18],[-3,-26],[-1,-85],[-5,-26],[-11,-26],[-32,-48],[-21,-25],[-29,-25],[-57,-33],[-28,-6],[-12,0],[-20,3],[-21,-6],[-29,-14],[-114,-91],[-24,-15],[-79,-32],[-106,-14],[-140,-29],[-83,5],[-57,1],[-48,9],[-22,1],[-28,-10],[-73,-42],[-50,-43],[-10,-10],[-15,-25],[-4,-12],[-3,-14],[1,-57],[4,-42],[0,-15],[-4,-16],[-39,-105],[-3,-4],[-2,-4],[-3,-5],[-18,-34],[-9,-22],[-33,-233]]],"transform":{"scale":[0.0005127547259725954,0.0004317920195019543],"translate":[-87.6858210929999,10.713481547000114]}};
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
