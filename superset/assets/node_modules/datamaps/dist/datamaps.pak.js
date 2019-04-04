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
  Datamap.prototype.nicTopo = '__NIC__';
  Datamap.prototype.niuTopo = '__NIU__';
  Datamap.prototype.nldTopo = '__NLD__';
  Datamap.prototype.nplTopo = '__NPL__';
  Datamap.prototype.nruTopo = '__NRU__';
  Datamap.prototype.nulTopo = '__NUL__';
  Datamap.prototype.nzlTopo = '__NZL__';
  Datamap.prototype.omnTopo = '__OMN__';
  Datamap.prototype.pakTopo = {"type":"Topology","objects":{"pak":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Baluchistan"},"id":"PK.BA","arcs":[[0,1,2,3]]},{"type":"Polygon","properties":{"name":"Azad Kashmir"},"id":"PK.JK","arcs":[[4,5,6,7]]},{"type":"Polygon","properties":{"name":"F.C.T."},"id":"PK.IS","arcs":[[8,9]]},{"type":"Polygon","properties":{"name":"Northern Areas"},"id":"PK.NA","arcs":[[-8,10,11]]},{"type":"Polygon","properties":{"name":"F.A.T.A."},"id":"PK.TA","arcs":[[12,-4,13,14]]},{"type":"Polygon","properties":{"name":"Punjab"},"id":"PK.PB","arcs":[[-10,15,-6,16,17,-1,-13,18]]},{"type":"MultiPolygon","properties":{"name":"Sind"},"id":"PK.SD","arcs":[[[19]],[[20,-2,-18]]]},{"type":"Polygon","properties":{"name":"N.W.F.P."},"id":"PK.NW","arcs":[[-11,-7,-16,-9,-19,-15,21]]}]}},"arcs":[[[5797,5522],[-8,-148],[7,-22],[1,-10],[-1,-8],[-3,-4],[-4,-2],[-11,-1],[-4,-2],[-51,-72],[-2,-2],[-3,-1],[-15,-1],[-4,-2],[-5,-6],[-4,-10],[-4,-21],[-1,-10],[0,-6],[1,-3],[6,-12],[2,-4],[1,-5],[-2,-7],[-3,-9],[-54,-95],[-6,-20],[-6,-41],[-11,-46],[-5,-10],[-2,-6],[0,-5],[2,-4],[4,-2],[6,-3],[3,-2],[1,-3],[1,-3],[-1,-16],[1,-5],[0,-3],[1,-2],[2,-2],[2,-1],[2,1],[2,2],[6,11],[2,3],[2,2],[2,2],[5,2],[2,1],[2,0],[7,0],[7,-1],[3,-1],[4,-2],[2,-4],[-1,-10],[-3,-14],[-16,-33],[-4,-5],[-7,-7],[-10,-10],[-3,-5],[-3,-9],[-2,-14],[-1,-8],[0,-18],[-8,-28],[-33,-71],[-29,-79],[-6,-12],[-6,-7],[-12,-10],[-15,-10],[-3,-4],[-20,-34],[-13,-12],[-37,-6],[-12,-5],[-11,-6],[-2,-1],[-3,-3],[-3,-4],[-7,-13],[-3,-8],[-2,-10],[0,-22],[1,-24],[-18,-93],[0,-9],[2,-4],[2,-3],[3,-1],[3,-1],[27,-3],[6,-2],[3,-2],[5,-3],[4,-5],[2,-2],[2,-3],[1,-4],[1,-8],[-1,-10],[-2,-19],[0,-9],[1,-5],[13,-21],[2,-2],[2,-2],[3,0],[2,2],[2,2],[4,4],[4,5],[2,1],[3,2],[3,1],[3,0],[3,-1],[2,-3],[1,-8],[-1,-12],[-22,-113],[-7,-15],[-5,-6],[-3,-3],[-9,-4],[-4,-4],[-5,-4],[-8,-9],[-30,-53],[-14,-17],[-8,-8],[-17,-14],[-2,-2],[-4,-5],[-3,-8],[-4,-13],[-3,-19],[-1,-9],[0,-6],[1,-3],[1,-2],[1,-2],[4,-4],[6,-7],[2,-2],[2,-4],[1,-5],[-3,-14],[-34,-85],[-14,-25],[-16,-23],[-5,-4],[-4,-4],[-11,-6],[-23,-9],[-4,-2],[-3,-3],[-3,-5],[-2,-6],[-1,-6],[0,-4],[1,-4],[32,-53]],[[5270,3587],[-82,-3],[-294,-14],[-106,8],[-63,-9],[-18,-6],[-4,-2],[-5,-4],[-8,-8],[-4,-5],[-31,-55],[-2,-2],[-2,-2],[-4,-3],[-4,-3],[-53,-24],[-28,-22],[-11,-13],[-136,-112],[-18,-23],[-28,-45],[-149,-73],[-80,-22],[-69,-10],[-25,-15],[-7,-14],[-30,-75],[-42,-61],[-42,-79],[-8,-19],[-4,-14],[-4,-25],[-23,-109],[-4,-35],[-1,-25],[7,-73],[5,-315],[1,-61],[4,-37],[7,-33],[5,-16],[158,-320],[6,-27],[2,-20],[-10,-67],[0,-14],[4,-39],[0,-20],[-3,-23],[-7,-26],[-31,-92],[-9,-16],[-19,-24],[-22,-29],[-10,-20],[-3,-12],[-5,-6],[-5,-5],[-16,-10],[-5,-7],[-32,-63],[-3,-9],[-2,-7],[1,-5],[2,-15],[1,-8],[-1,-7],[-2,-9],[-16,-45],[-4,-8],[-4,-6],[-11,-10],[-18,-17],[-22,-29],[-6,-9],[-3,-7],[-1,-4],[0,-4],[1,-14],[-1,-6],[-3,-12],[-6,-11],[-12,-20],[-15,-18],[-9,-6],[-8,-5],[-8,-3],[-25,-4],[-3,0],[-4,-2],[-8,-5],[-97,-88]],[[3616,896],[0,5],[-14,9],[0,29],[9,57],[2,45],[3,14],[6,12],[11,17],[4,12],[-1,17],[-10,23],[-2,14],[-4,6],[-23,22],[-9,5],[-7,6],[-32,35],[-22,15],[-8,12],[4,15],[16,-5],[7,15],[-2,20],[-15,10],[-8,13],[-5,26],[-7,20],[-11,-7],[-2,3],[-2,3],[-1,4],[-8,-3],[-3,5],[-3,10],[-3,8],[-21,25],[-4,11],[-15,-5],[-15,1],[-10,9],[2,16],[-10,-8],[-13,-5],[-22,-2],[-7,1],[-13,4],[-7,0],[-3,-2],[-3,-3],[-6,-4],[-22,-5],[-13,-9],[-10,-11],[-7,-13],[-11,-26],[-4,-4],[-6,-3],[-7,-7],[-6,-8],[-3,-8],[16,1],[49,9],[8,3],[6,6],[9,12],[2,2],[3,2],[2,0],[4,1],[2,2],[0,5],[-1,5],[1,4],[13,5],[18,3],[17,-1],[7,-5],[3,-8],[7,-4],[8,-2],[7,-4],[5,-7],[9,-16],[7,-8],[9,8],[12,3],[12,-2],[10,-9],[-21,-20],[24,-18],[9,-12],[-8,-12],[-9,2],[-11,8],[-18,16],[-48,24],[-29,8],[-21,-6],[-16,4],[-20,-6],[-20,-9],[-18,-4],[-55,-1],[-40,-12],[-49,-9],[-27,1],[-14,-1],[-21,-12],[-15,-5],[-21,-13],[-26,-5],[-32,-18],[-12,-2],[-14,2],[-88,27],[-12,2],[-14,-4],[-14,-6],[-14,-4],[-11,3],[3,4],[5,12],[-20,-2],[-16,-4],[-14,-6],[-13,-9],[-20,12],[-17,-8],[-14,-17],[-14,-27],[-5,-6],[-6,-3],[-9,-2],[-7,0],[-16,4],[-17,3],[-19,6],[-11,2],[-38,0],[-37,8],[-19,1],[-17,-9],[-14,7],[-20,2],[-39,-3],[-15,-8],[-14,-12],[-11,-16],[-6,-16],[-4,-19],[0,-10],[4,-7],[7,-4],[10,-3],[8,-5],[0,-9],[-4,0],[-30,-10],[-9,1],[-15,5],[-9,0],[16,28],[0,13],[-10,17],[-11,8],[-17,6],[-17,5],[-12,-1],[-7,-6],[-9,-16],[-7,-3],[-8,-1],[-12,-3],[-6,-1],[-13,4],[-22,23],[-13,9],[-26,7],[-27,3],[-6,2],[-8,9],[-5,4],[-37,2],[-56,12],[1,11],[5,13],[2,14],[-3,4],[-6,3],[-5,6],[-3,10],[3,7],[6,4],[8,1],[7,0],[14,-3],[6,2],[3,12],[-3,3],[-6,1],[-8,1],[-29,-8],[-15,-1],[-7,6],[-34,-19],[-8,-9],[9,3],[3,2],[5,-13],[4,-4],[6,4],[9,11],[8,0],[8,-13],[11,-26],[-8,-14],[-4,-1],[-11,0],[-23,-4],[-11,-1],[-11,5],[-15,-7],[-23,4],[-63,26],[-42,7],[-41,-1],[-41,-7],[-20,-7],[-11,-6],[-10,-9],[-17,-21],[-9,-19],[-6,-5],[-10,4],[3,-13],[4,-9],[19,-25],[3,-3],[1,-2],[0,-5],[-2,-5],[-2,-5],[-3,-4],[-4,-1],[-20,4],[-35,18],[-21,4],[-43,-6],[-10,2],[-29,14],[-41,12],[-21,2],[-19,-4],[-38,-23],[-15,-3],[-52,6],[-106,25],[-103,3],[-47,-1],[-31,-4],[-8,-16],[2,-11],[13,-7],[-12,-5],[-16,5],[-19,-5],[-17,-11],[-12,-10],[-7,-7],[-7,-11],[-4,-11],[1,-12],[8,-8],[13,-4],[9,-5],[-4,-10],[-25,-1],[-31,2],[-21,7],[15,13],[2,3],[3,2],[2,1],[5,3],[5,0],[5,2],[1,8],[-8,19],[-4,14],[-14,11],[-13,9],[-18,1],[-21,5],[-28,-1],[-27,-10],[-14,-6],[-7,-15],[-6,-12],[9,-8],[3,-17],[7,-7],[5,-9],[-13,-5],[-25,2],[-29,4],[-36,1],[-30,-5],[-7,-14],[-2,-6],[-6,-7],[-6,-22],[-8,1],[-12,-9],[-15,-7],[-22,-3],[-16,6],[-6,12],[4,16],[6,8],[-4,10],[2,7],[11,9],[6,8],[2,5],[0,10],[2,8],[8,13],[3,8],[-1,11],[-2,2],[-4,-2],[-4,-2],[-2,-1],[-5,-7],[-3,-1],[-4,1],[-8,7],[-3,1],[-8,2],[-3,3],[-4,4],[-5,2],[-7,1],[-20,-1],[-10,3],[-6,0],[-7,-3],[-15,1],[20,63],[3,63],[5,74],[3,64],[3,44],[2,11],[4,7],[9,10],[4,6],[1,26],[-6,29],[-4,28],[14,19],[13,4],[12,0],[10,2],[10,13],[3,13],[7,52],[7,62],[6,47],[5,40],[6,46],[5,23],[9,20],[15,13],[74,23],[23,16],[11,6],[13,4],[25,5],[6,8],[2,18],[10,18],[24,-3],[27,-11],[23,-3],[14,8],[-1,10],[-6,14],[-3,17],[4,10],[20,20],[6,13],[-1,5],[-2,4],[-2,5],[1,7],[4,5],[5,4],[13,5],[5,3],[8,7],[5,2],[5,1],[13,-1],[7,2],[3,3],[5,10],[5,4],[6,2],[103,12],[13,5],[5,4],[5,6],[5,3],[7,-1],[7,-4],[5,0],[19,5],[6,2],[4,2],[4,4],[7,13],[4,6],[7,3],[42,-2],[48,-1],[56,-1],[24,-4],[25,-1],[18,4],[6,0],[5,-3],[4,-3],[5,-3],[6,0],[14,14],[7,30],[5,109],[4,12],[10,5],[25,5],[10,9],[2,14],[-6,12],[-7,12],[-6,14],[-3,84],[1,9],[3,8],[6,10],[2,7],[7,12],[12,6],[14,0],[10,-4],[-21,50],[-8,14],[-7,8],[-6,4],[-15,6],[-7,4],[-16,16],[-8,3],[-6,1],[-34,-12],[-8,0],[-10,1],[-16,-1],[-33,-11],[-16,-3],[-35,-7],[-17,-1],[-20,4],[-14,9],[-5,2],[-5,-1],[-8,-5],[-5,-1],[-9,6],[-27,26],[10,0],[6,5],[4,9],[3,10],[1,12],[-3,9],[-12,15],[32,79],[4,31],[-4,39],[-5,69],[-4,38],[-5,60],[-3,45],[-17,72],[-11,52],[10,85],[9,77],[-3,26],[-14,9],[-101,-22],[-12,8],[-39,45],[-9,17],[-4,13],[-4,7],[-7,5],[-10,3],[-10,6],[-6,9],[-6,10],[-7,9],[-17,10],[-82,17],[-51,25],[-20,5],[-41,3],[-18,7],[-30,18],[-37,11],[-11,6],[-20,25],[-39,38],[-25,36],[-64,61],[-18,24],[-18,41],[-17,21],[-4,11],[-1,13],[-4,15],[-26,63],[-5,8],[-7,6],[-8,4],[-5,4],[-1,4],[2,5],[4,4],[6,7],[2,7],[-2,6],[-6,5],[-11,5],[-4,11],[-4,13],[-6,10],[-7,4],[-5,1],[-6,2],[-6,8],[-4,8],[-1,19],[-2,8],[-8,13],[-20,23],[-6,16],[0,14],[8,26],[1,15],[-6,19],[-11,8],[-13,6],[-12,10],[-50,64],[-49,61],[-46,59],[-41,51],[-32,41],[-50,62],[20,-9],[44,-15],[51,-18],[51,-17],[52,-18],[51,-17],[51,-18],[52,-17],[51,-18],[52,-17],[51,-18],[51,-17],[52,-18],[51,-17],[51,-18],[52,-17],[51,-18],[52,-17],[58,-20],[64,-13],[77,8],[18,1],[30,3],[30,3],[30,3],[31,4],[30,3],[30,3],[30,3],[31,3],[30,3],[30,3],[30,3],[31,3],[30,3],[30,3],[30,3],[31,3],[94,9],[135,-28],[114,-23],[70,-32],[17,7],[23,47],[14,19],[21,12],[167,53],[13,0],[114,-1],[84,-1],[103,-20],[31,-1],[89,28],[36,11],[36,11],[36,11],[35,11],[36,11],[36,11],[36,11],[36,11],[36,11],[35,11],[36,11],[36,11],[36,12],[36,11],[36,11],[35,11],[53,16],[49,37],[16,23],[13,23],[4,2],[5,2],[2,4],[-5,7],[-19,15],[-25,28],[-22,15],[-3,11],[1,11],[9,29],[40,85],[3,14],[-2,46],[12,99],[-2,15],[-3,15],[-5,10],[-15,20],[-10,30],[2,32],[60,241],[6,10],[10,6],[84,18],[14,6],[58,63],[11,17],[21,84],[15,11],[24,3],[16,13],[14,17],[19,17],[41,21],[23,7],[37,1],[9,-5],[4,-10],[1,-17],[-1,-6],[-4,-5],[-2,-4],[1,-6],[4,-4],[8,-3],[14,-2],[13,-1],[23,7],[13,0],[12,-4],[23,-13],[12,-4],[10,-2],[32,2],[40,-4],[11,2],[43,19],[37,5],[22,11],[33,6],[12,5],[39,26],[8,8],[9,6],[10,3],[25,-1],[9,5],[7,14],[-3,31],[-23,8],[-51,-8],[-12,4],[-12,8],[-9,11],[-4,30],[-8,12],[-9,12],[-5,11],[8,13],[20,1],[40,-10],[19,2],[19,8],[13,10],[20,15],[38,44],[18,9],[8,0],[19,-3],[25,2],[6,3],[7,11],[11,8],[32,19],[4,5],[2,16],[3,7],[20,19],[3,6],[4,7],[13,32],[8,10],[13,1],[15,-6],[14,-8],[16,-13],[6,-10],[8,-8],[13,-2],[25,1],[24,-2],[65,-24],[23,-4],[10,4],[14,8],[8,10],[-6,6],[-12,2],[-37,-1],[-13,2],[-11,5],[-2,8],[12,9],[26,15],[15,5],[14,1],[21,-9],[36,-21],[34,-7],[8,-4],[4,-9],[2,-31],[5,-11],[16,-19],[28,-42],[16,-12],[25,3],[39,20],[21,7],[22,-1],[17,7],[22,16],[20,19],[8,13],[9,7],[9,10],[67,108],[17,19],[30,22],[1,3]],[[5218,6172],[17,-1],[4,-7],[9,0],[12,3],[92,7],[11,-2],[21,6],[11,8],[10,10],[10,11],[16,24],[10,9],[28,11],[6,1],[47,10],[17,-3],[2,-3],[-1,-10],[-5,-16],[-5,-8],[0,-6],[1,-5],[5,-8],[7,-6],[8,-6],[12,-7],[3,-2],[1,-3],[1,-4],[-1,-7],[-2,-6],[-13,-22],[-1,-4],[-1,-3],[1,-4],[1,-4],[1,-5],[5,-7],[3,-4],[4,-3],[3,-2],[3,-1],[3,0],[2,1],[4,1],[3,2],[3,3],[3,3],[6,8],[8,16],[2,2],[2,2],[3,0],[3,-1],[2,-3],[0,-3],[-3,-39],[-4,-14],[-2,-16],[1,-42],[0,-10],[2,-51],[-2,-17],[-3,-48],[-1,-9],[-5,-17],[-1,-8],[-1,-5],[1,-5],[2,-7],[2,-3],[5,-4],[20,-8],[6,-2],[5,0],[6,-3],[9,-18],[11,-81],[0,-8],[2,-4],[2,-4],[5,-3],[2,0],[2,1],[0,3],[-1,13],[1,6],[1,8],[2,5],[3,4],[5,6],[1,2],[2,7],[3,8],[1,4],[1,2],[1,3],[2,0],[4,-1],[5,-6],[3,-1],[3,1],[2,1],[1,3],[3,2],[2,1],[4,0],[11,-2],[2,0],[3,1],[3,3],[3,2],[4,7],[4,7],[3,6],[2,2],[3,1],[3,0],[2,1],[3,2],[7,11],[3,5],[2,3],[2,2],[2,0],[1,0],[3,-4],[2,-4],[2,-8],[0,-7],[-1,-11],[2,-10],[2,-7],[7,-10],[2,-4],[1,-5],[1,-5],[-1,-8],[-7,-32],[-1,-7],[1,-51],[-9,-63],[-1,-30],[1,-18],[5,-25]],[[8873,8191],[-7,5],[-23,0],[-40,-9],[-57,-3],[-218,44],[-156,57],[-39,7],[-39,-4],[-40,-15],[-46,-35],[-16,-8],[-98,-17],[-8,-4],[-18,-15],[-1,-18],[5,-19],[0,-21],[-9,-15],[-30,-21],[-10,-17],[-1,-28],[-3,-9],[-5,-6],[-16,-9],[-6,-5],[-10,-17],[-3,-18],[5,-18],[13,-15],[15,-9],[15,-6],[16,-2],[18,2],[18,-2],[10,-13],[14,-37],[9,-15],[5,-16],[-2,-15],[-12,-11],[-37,-20],[-14,-15],[-6,-23],[6,-22],[14,-20],[18,-14],[19,-4],[42,11],[13,0],[33,-12],[22,1],[23,6],[23,1],[19,-14],[8,-24],[-6,-24],[-15,-22],[-16,-17],[-22,-16],[-22,-10],[-66,-11],[-14,-14],[-22,-38],[-3,-9],[-3,-10],[-2,-9],[-2,-22],[2,-12],[3,-11],[5,-10],[30,-26],[39,-21],[33,-27],[10,-42],[-13,-57],[-19,-54],[-6,-13],[-7,-10],[-8,-9],[-10,-8],[-23,-9],[-10,-7],[-6,-13],[-2,-33],[8,-24],[17,-17],[22,-16],[20,-21],[35,-48],[22,-14],[58,-10],[17,-11],[6,-16],[2,-38],[7,-39],[-1,-15],[-7,-14],[-4,-6]],[[8313,6832],[-206,109],[-4,5],[-10,19],[0,1],[-2,3],[-4,4],[-5,5],[-10,6],[-12,3],[-20,-1],[-9,-1],[-6,-2],[-1,-1],[-11,-6],[-1,0],[-4,-2],[-10,2],[-12,7],[-8,4],[-6,12],[-20,12],[-36,17],[-20,14],[-11,16],[14,14],[-1,8],[4,6],[2,8],[1,9],[-4,7],[-5,5],[-12,8],[-2,4],[-1,5],[-1,4],[0,2],[-3,1],[-5,-2],[-1,0],[-3,-2],[-1,0],[-4,0],[-2,0],[-2,1],[-1,7],[0,1],[2,-1],[4,2],[1,0],[4,2],[2,2],[-1,15],[-2,14],[-1,14],[2,8],[2,5],[2,9],[-3,7],[-7,10],[-7,10],[-1,13],[5,10],[7,9],[6,22],[6,4],[5,1],[1,0],[3,3],[0,7],[-1,6],[-2,6],[-5,24],[0,7],[2,5],[4,2],[4,2],[2,7],[-1,12],[-5,14],[-6,13],[-7,10],[-17,15],[-2,6],[3,10],[-1,5],[1,7],[11,24],[3,10],[-1,14],[-2,14],[-4,12],[-8,11],[-5,20],[9,55],[-2,25],[-37,73]],[[7821,7719],[-1,1],[-6,44],[-11,45],[0,1],[0,8],[0,5],[0,2],[1,24],[-1,12],[-10,53],[-9,10],[-2,8],[-5,10],[-25,37],[-4,15],[2,4],[7,13],[3,9],[3,14],[0,1],[1,4],[0,23],[0,3],[1,0],[0,2],[4,7],[1,2],[1,2],[0,3],[-1,19],[0,4],[1,3],[3,5],[1,3],[1,2],[0,7],[0,3],[0,4],[2,3],[3,3],[6,3],[19,3],[2,0],[4,0],[12,-3],[2,0],[1,0],[3,1],[12,6],[8,4],[5,1],[5,1],[5,0],[2,0],[4,-1],[3,-1],[1,-2],[1,-1],[1,-4],[2,-5],[2,-2],[1,-2],[3,0],[1,1],[3,3],[6,12],[13,36],[0,4],[0,4],[-1,4],[-5,7],[-1,3],[-1,4],[1,3],[1,3],[19,29],[3,6],[5,16],[4,8],[0,1],[5,5],[6,6],[13,10],[7,4],[5,2],[11,-1],[4,1],[4,1],[4,3],[1,0],[11,9],[2,1],[14,2],[26,-2],[2,1],[2,0],[11,9],[2,1],[3,2],[5,4],[1,1],[2,2],[0,1],[1,0],[4,8],[3,3],[3,3],[4,4],[1,0],[4,1],[10,1],[4,1],[3,1],[7,3],[7,3],[2,2],[2,1],[3,4],[1,2],[3,12],[3,7],[0,1],[1,1],[3,5],[7,5],[1,1],[2,1],[3,7],[1,6],[0,12],[0,6],[2,6],[5,7],[6,6],[4,3],[4,2],[2,3],[0,3],[-2,5],[-3,4],[-3,3],[-7,3],[-1,1],[-1,1],[-2,1],[0,1],[-1,0],[-1,2],[-1,2],[0,4],[1,4],[6,12],[3,5],[4,5],[7,6],[16,5]],[[8195,8536],[8,-1],[23,0],[1,0],[56,-9],[1,0],[50,5],[37,14],[32,9],[1,0],[15,-3],[20,-10],[17,-20],[16,-25],[24,-55],[13,-24],[17,-17],[85,-49],[41,-18],[38,-11],[29,-1],[19,3],[14,6],[24,5],[12,6],[22,21],[11,2],[1,0],[12,-6],[29,-30],[15,-20],[10,-25],[4,-25],[-2,-24],[-15,-35],[-1,-1],[-1,-6],[0,-1]],[[7456,7509],[29,6],[14,7],[6,7],[6,6],[9,7],[7,3],[5,1],[23,3],[14,6],[3,3],[2,2],[4,7]],[[7578,7567],[6,-4],[49,-23],[9,-6],[8,-8],[20,-21],[23,-19],[5,-7],[0,-9],[-4,-9],[-16,-18],[-7,-10],[-23,-56],[-4,-6],[-19,-20],[-8,-10],[-1,-2],[-1,-1],[-2,-2],[-11,-3],[-13,3],[-16,9],[-8,5],[-5,7],[2,9],[4,10],[1,11],[-4,14],[-6,13],[-8,10],[-7,7],[-13,4],[-10,-1],[-12,-3],[-23,-8],[-21,-13],[-10,-8],[-13,-7],[-14,-3],[-15,2],[-13,12],[-10,15],[-8,19],[4,20],[13,18],[59,31]],[[8195,8536],[-1,4],[0,2],[-3,3],[-8,7],[-2,4],[-1,3],[1,3],[1,3],[-1,1],[0,1],[-1,0],[-2,1],[-11,-1],[-1,0],[-17,2],[-8,1],[-1,0],[-3,1],[-4,2],[-10,11],[-1,1],[-2,2],[-1,3],[-2,2],[-3,0],[-1,1],[-10,-1],[-5,-2],[-5,-2],[-1,0],[-3,1],[-3,2],[-15,19],[-6,2],[-3,1],[-7,3],[-1,0],[-6,1],[-11,-4],[-3,0],[-1,0],[-2,2],[-12,12],[-12,7],[-5,1],[-2,1],[-1,0],[-4,1],[-15,0],[-2,0],[-2,-1],[-2,-2],[-13,-13],[-3,-2],[-2,-1],[-1,0],[-3,0],[-2,2],[-4,3],[-4,7],[0,4],[0,3],[1,3],[2,12],[0,3],[-1,4],[-18,32],[-1,2],[0,3],[0,3],[2,21],[0,2],[-1,5],[0,2],[1,3],[2,4],[14,23],[4,8],[1,3],[0,2],[2,2],[9,8],[15,8],[6,3],[3,1],[1,2],[1,2],[-1,2],[0,3],[-1,3],[-2,31],[0,3],[-4,12],[-8,4],[-1,0],[-79,12],[-39,-1],[-38,-6],[-1,0],[-23,18],[-1,0],[-13,3],[-21,-11],[0,1],[-8,16],[-1,4],[-1,4],[-3,2],[-3,4],[-1,0],[-4,3],[-1,0],[-4,2],[-1,0],[-7,1],[-3,0],[-12,-1],[-3,0],[-9,3],[-2,1],[-2,1],[-3,8],[-1,3],[-4,5],[-5,3],[-19,13],[-5,5],[-2,2],[-8,7],[-57,38],[-4,4],[-2,4],[-1,4],[0,5],[0,6],[3,38],[1,3],[1,2],[12,11],[2,3],[0,3],[-1,2],[-2,3],[-1,0],[-12,8],[-6,4],[0,1],[-7,5],[-8,9],[-2,2],[-1,3],[-1,1],[-1,0],[-1,0],[-3,-2],[-5,-6],[-2,-3],[-3,-1],[-3,-2],[-4,-1],[-6,0],[-7,1],[-9,3],[-1,0],[-4,2],[-1,1],[-4,3],[-9,4],[-2,1],[-3,1],[-4,1],[-61,-3],[-5,-1],[-5,-2],[-24,-15],[-2,-2],[-3,-5],[-2,-2],[-5,-1],[-4,0],[-26,6],[-58,7],[-1,0],[-60,26],[-25,11],[44,81],[1,3],[0,2],[-5,12],[-1,6],[-4,5],[-19,17],[-2,3],[-2,2],[0,3],[-3,6],[-1,5],[0,4],[1,4],[1,3],[1,3],[16,20],[1,5],[-1,4],[-4,8],[-1,3],[0,3],[1,11],[7,31],[2,5],[3,4],[3,6],[5,6],[5,5],[8,6],[9,3],[7,1],[6,1],[7,-1],[17,-7],[3,0],[4,2],[13,18],[3,3],[12,9],[9,4],[9,2],[4,2],[7,5],[23,27],[5,4],[5,3],[19,4],[5,3],[4,6],[2,4],[0,4],[-1,9],[0,18],[2,10],[1,4],[3,3],[7,3],[12,2],[18,0],[16,2],[2,2],[2,2],[1,6],[0,4],[-3,5],[-2,3],[-1,3],[0,3],[2,2],[4,3],[33,12],[4,3],[4,4],[5,7],[1,5],[2,9],[2,4],[8,12],[6,10],[1,3],[0,2],[-2,6],[-10,25],[-2,9],[-1,17],[0,4],[0,3],[1,3],[3,1],[12,2],[20,5],[7,3],[18,14],[4,2],[3,-1],[6,-4],[10,-10],[3,-2],[3,0],[16,3],[17,2],[10,-1],[5,0],[11,3],[63,23],[9,-1],[15,-3],[37,-12],[3,0],[14,1],[7,0],[3,-1],[4,-2],[4,-1],[3,2],[9,4],[3,0],[2,-2],[6,-8],[3,-5],[2,-2],[1,0],[3,-2],[3,0],[17,1],[4,-1],[7,-4],[3,0],[4,0],[7,4],[12,11],[4,2],[4,0],[5,-2],[12,-6],[4,0],[3,1],[12,8],[3,1],[6,-1],[20,-5],[13,-5],[12,-3],[3,0],[4,2],[2,5],[-1,4],[0,3],[0,3],[0,3],[3,7],[0,3],[0,4],[-1,0],[-1,6],[-1,4],[0,1],[-4,4],[-7,6],[-1,1],[-34,22],[0,1],[-8,8],[-1,1],[-8,4],[-6,3],[-23,4],[-5,2],[-3,2],[-1,1],[-2,1],[-4,4],[-1,3],[0,1],[-2,9],[2,14],[0,1]],[[7940,9879],[38,-2],[37,-6],[19,-8],[51,-31],[18,-5],[19,-7],[17,0],[37,12],[6,7],[3,26],[4,11],[9,6],[10,3],[40,-5],[15,5],[30,24],[52,32],[16,13],[25,7],[14,1],[12,-4],[2,-2],[2,-2],[11,-16],[12,-11],[10,3],[4,24],[3,5],[1,6],[-2,5],[-3,4],[12,6],[40,10],[22,9],[10,-2],[9,-12],[16,-14],[46,-1],[19,-16],[18,-26],[5,-10],[3,-22],[4,-7],[8,3],[4,7],[5,22],[6,9],[9,6],[11,5],[21,5],[24,1],[52,7],[12,-2],[9,-5],[17,-16],[21,-11],[73,-15],[23,-10],[17,-16],[10,-22],[4,-29],[2,-31],[4,-28],[13,-18],[38,-2],[4,5],[1,8],[4,7],[39,15],[49,-10],[48,-23],[38,-26],[37,-33],[15,-19],[63,-117],[0,-1],[3,-12],[4,-18],[-12,-59],[1,-30],[4,-11],[16,-20],[6,-9],[2,-14],[-8,-6],[-12,-5],[-8,-10],[0,-8],[5,-13],[-1,-8],[-3,-6],[-4,-4],[-31,-19],[-8,-8],[-4,-12],[3,-26],[14,-24],[19,-18],[19,-8],[48,-3],[17,-11],[15,-27],[6,-28],[3,-31],[6,-27],[17,-15],[15,-1],[29,8],[14,1],[13,-2],[10,-4],[9,0],[23,16],[11,0],[11,-2],[11,2],[5,5],[7,13],[6,4],[7,2],[7,2],[14,0],[14,5],[23,23],[11,-4],[7,-24],[-9,-61],[12,-24],[21,-12],[44,-16],[20,-15],[15,-21],[8,-8],[11,-6],[8,-1],[84,-201],[84,-200],[-4,-3],[-12,-15],[2,-18],[6,-21],[-5,-23],[-9,-13],[-37,-30],[-12,-13],[-8,-6],[-9,2],[-17,10],[-16,5],[-22,-2],[-22,-7],[-15,-12],[-5,-17],[3,-41],[-6,-14],[-57,-54],[-8,-4],[-53,-12],[-11,0],[-9,4],[-27,20],[-24,4],[-23,-9],[-86,-50],[-66,-17],[-20,0],[-39,16],[-22,-4],[-10,-9],[-12,-22],[-9,-10],[-4,-3],[-17,-5],[-40,-30],[-36,-38],[-12,-10],[-12,-3],[-26,4],[-13,0],[-36,-9],[-27,1],[-163,44],[-25,13],[-24,18],[-10,11],[-9,14],[-8,5]],[[5897,5653],[5,-33],[-3,-9],[-4,-1],[-26,-1],[-4,-1],[-6,-2],[-14,-7],[-11,-3],[-22,-12],[-3,-4],[-1,-4],[0,-3],[1,-12],[4,-15],[1,-6],[0,-6],[-1,-3],[-5,-12],[-3,-2],[-4,0],[-2,2],[-2,3]],[[5218,6172],[2,4],[-1,10],[-20,57],[-12,71],[1,16],[5,32],[0,31],[4,32],[1,17],[-2,15],[-16,42],[-7,32],[3,31],[12,29],[18,24],[13,8],[25,9],[11,10],[33,50],[7,14],[2,10],[-6,24],[-1,13],[-2,6],[-4,3],[-5,3],[-6,3],[-4,5],[-3,6],[-1,15],[6,10],[21,16],[15,22],[16,12],[4,3],[6,22],[-12,81],[6,13],[6,13],[17,21],[20,14],[25,3],[13,0],[20,4],[6,-2],[5,-3],[5,-1],[12,3],[29,21],[24,4],[41,-21],[26,2],[46,29],[6,1],[18,-1],[8,3],[4,7],[21,40],[7,3],[15,-5],[13,-1],[12,6],[105,90],[5,25],[-10,23],[-33,37],[-3,6],[-5,12],[-4,4],[-17,5],[-5,4],[-8,11],[-6,14],[-2,14],[1,14],[12,47],[1,19],[-3,5],[-4,3],[-10,5],[-6,5],[-3,4],[-3,11],[-6,30],[-6,8],[-26,-5],[-33,15],[-10,1],[-14,2],[-10,6],[-6,14],[-5,15],[-5,11],[-15,22],[-5,12],[-8,28],[-6,10],[-18,18],[-4,11],[9,11],[10,12],[2,11],[-2,11],[1,12],[10,10],[10,4],[7,2],[32,5],[21,-1],[133,-48],[36,-3],[21,-11],[11,-3],[50,-2],[51,-11],[19,-1],[82,12],[84,-1],[43,9],[11,22],[3,9],[6,2],[17,-5],[11,-1],[9,3],[7,6],[7,10],[13,5],[30,6],[10,10],[3,14],[-2,11],[-1,13],[7,15],[17,20],[4,10],[1,18],[-2,15],[-6,26],[0,13],[18,53],[-2,18],[-44,25],[-19,18],[-18,22],[-12,19],[-6,14],[-4,17],[1,16],[7,13],[9,5],[2,0],[13,0],[25,-4],[11,6],[7,15],[2,18],[-2,16],[-5,16],[1,12],[6,9],[44,35],[23,13],[9,8],[32,46],[10,26],[11,23],[22,17],[74,30]],[[6541,8415],[2,-2],[9,-16],[21,-26],[1,-2],[12,-6],[14,-3],[6,-2],[5,-1],[1,-1],[1,-2],[1,-7],[0,-1],[1,-2],[2,-3],[0,-1],[1,-2],[0,-1],[1,-4],[0,-1],[0,-1],[2,-3],[2,-4],[1,-7],[0,-3],[0,-4],[0,-2],[1,-2],[11,-10],[8,-4],[5,-2],[4,1],[27,15],[9,3],[4,1],[4,0],[22,-3],[4,-2],[4,-2],[8,-2],[3,-1],[3,1],[4,0],[2,-1],[3,-3],[3,-7],[2,-4],[4,-5],[0,-2],[-3,-2],[-4,-1],[-3,-2],[-6,-9],[-1,-2],[-2,-1],[-4,-1],[-2,-1],[-1,-2],[1,-4],[1,-2],[1,-1],[0,-1],[1,-5],[1,-6],[0,-9],[-4,-23],[-14,-10],[-1,0],[-1,0],[-1,1],[-3,2],[-1,0],[-1,0],[-5,-4],[-2,-1],[-9,-11],[-4,-3],[-1,0],[-1,-1],[-1,0],[-1,-2],[-2,0],[-2,-4],[-2,-6],[-6,-24],[0,-4],[1,-8],[-3,-4],[-12,-13],[9,-30],[-1,-2],[0,-1],[2,-8],[1,-3],[0,-1],[-1,-4],[0,-1],[0,-1],[0,-1],[1,-2],[1,-1],[1,0],[5,-1],[2,0],[1,0],[2,1],[1,0],[2,-4],[6,-16],[-5,-1],[-3,-2],[-2,-2],[-1,0],[-1,-1],[-2,-1],[-1,0],[-1,0],[-4,-5],[-1,-1],[-1,-1],[-1,-2],[-1,-7],[-1,-2],[0,-1],[0,-1],[0,-1],[0,-1],[1,0],[1,-2],[1,-1],[-1,-1],[-2,-2],[-5,-2],[-2,-1],[-2,-1],[-3,0],[-1,0],[-4,-1],[-1,-1],[0,-2],[-1,-7],[0,-1],[-1,0],[0,-1],[1,-6],[0,-2],[0,-1],[0,-1],[-2,0],[-2,0],[-2,1],[-1,1],[-3,3],[-2,2],[-1,1],[-1,0],[-1,0],[-1,0],[-1,0],[-3,2],[-1,-1],[-1,0],[-8,-9],[-4,-4],[-1,-1],[-2,-1],[-1,-1],[0,-1],[-1,-2],[0,-3],[0,-2],[-1,-2],[-2,-2],[-11,-10],[-1,-2],[-1,-1],[0,-1],[1,-3],[1,-1],[1,-2],[0,-1],[-4,-12],[0,-2],[1,-1],[1,-1],[1,0],[1,0],[0,-1],[0,-1],[0,-1],[0,-1],[-2,-7],[-2,-3],[-18,-15],[-5,-10],[-20,-16],[-4,-3],[-1,-1],[-1,-1],[-10,-7],[-3,-3],[-1,-1],[-1,-2],[-1,-2],[-48,-13],[-2,-3],[-1,-2],[-1,0],[0,-1],[0,-1],[1,-4],[0,-1],[0,-1],[0,-1],[-2,-4],[1,-1],[1,-1],[3,-2],[2,-1],[1,0],[2,-1],[3,-1],[2,-1],[5,-4],[3,-2],[1,-2],[0,-3],[1,-7],[0,-4],[-1,-2],[-1,-1],[-2,-1],[-2,-2],[-2,-2],[0,-1],[0,-1],[-1,-3],[1,-2],[8,-10],[0,-2],[3,-16],[1,-7],[-2,-5],[-3,-6],[0,-2],[0,-2],[-1,-7],[0,-7],[0,-4],[2,-5],[4,-10],[4,-5],[5,-4],[5,-5],[5,-6],[5,-10],[3,-17],[0,-4],[-2,-15],[0,-3],[0,-2],[1,-3],[2,-3],[9,-7],[23,-17],[6,-6],[2,-3],[1,-3],[1,-3],[1,-4],[-2,-13],[1,-6],[0,-4],[6,-20],[3,-8],[2,-3],[2,-1],[3,-1],[3,-1],[7,-1],[6,0],[29,6],[34,18],[20,14],[8,9],[12,22],[3,9],[3,5],[2,2],[3,1],[3,-2],[3,-4],[5,-17],[3,-5],[3,-4],[7,-7],[5,-2],[4,-2],[20,-3],[16,-1],[3,-1],[2,-2],[1,-4],[1,-3],[-2,-6],[-2,-5],[-19,-28],[-3,-6],[-4,-5],[-13,-16],[-1,-3],[-1,-2],[0,-2],[1,-2],[2,-2],[21,-15],[7,-5],[1,-2],[1,-2],[-1,-2],[0,-3],[-2,-2],[-2,-2],[-3,-2],[-6,-3],[-21,-7],[-7,-4],[-9,-6],[-35,-22],[-17,-8],[-13,-1],[-25,3],[-15,5],[-6,3],[-4,3],[-4,5],[0,3],[1,2],[2,3],[3,3],[7,3],[21,8],[6,3],[6,3],[2,3],[2,3],[1,2],[0,3],[0,4],[-2,3],[-1,2],[-2,2],[-2,2],[-3,1],[-4,0],[-7,-2],[-6,-2],[-79,5],[-9,2],[-4,1],[-4,-1],[-14,-3],[-26,-2],[-7,-2],[-5,-3],[-4,-5],[-3,-1],[-4,0],[-8,4],[-4,3],[-5,5],[-10,7],[-30,16],[-14,10],[-10,10],[-1,2],[-4,9],[-1,3],[-2,2],[-4,1],[-3,0],[-3,-1],[-3,2],[-10,7],[-4,2],[-11,4],[-3,0],[-3,-1],[-1,-4],[0,-31],[1,-4],[8,-21],[1,-9],[-23,-8],[-7,-5],[-3,-2],[-3,-4],[-1,-2],[-1,-3],[0,-2],[1,-2],[2,-1],[2,-2],[3,-1],[3,-1],[2,-2],[1,-3],[-1,-2],[-3,-2],[-24,-6],[-7,-3],[-5,-2],[-6,-6],[-6,-5],[-13,-6],[-5,0],[-99,9],[-10,4],[-21,14],[-11,-1],[-3,-3],[-3,-5],[-9,-21],[-3,-11],[0,-3],[0,-2],[0,-3],[1,-7],[1,-7],[-1,-3],[-1,-4],[-3,-3],[-5,-1],[-3,0],[-3,0],[-17,-7],[-11,-2],[-14,0],[-2,-1],[-3,-1],[-4,-4],[-18,-20],[-6,-5],[-3,-2],[-3,0],[-4,0],[-9,0],[-7,0],[-7,-2],[-8,-1],[-10,-2],[-4,-2],[-8,-6],[-2,-3],[-1,-2],[-1,-3],[-1,-6],[0,-2],[1,-3],[3,-4],[8,-7],[21,-13],[7,-2],[3,-7],[6,-28],[15,-22],[9,-5],[5,-1],[6,-1],[7,0],[3,-1],[20,-8],[3,-1],[8,0],[4,-1],[3,-1],[1,-2],[-4,-12],[0,-2],[0,-2],[1,-2],[2,-1],[7,-2],[20,-2],[13,0],[3,0],[8,-3],[2,0],[6,0],[3,0],[4,-1],[8,-3],[12,-3],[16,-6],[2,-2],[3,-3],[2,-3],[1,-3],[-1,-5],[-10,-15],[-39,-45],[-15,-4],[-4,-2],[-5,-3],[-10,-13],[-5,-5],[-8,-4],[-5,-2],[-15,-2],[-12,-5],[-9,-2],[-4,-1],[-6,-2],[-3,0],[-3,1],[-3,0],[-13,2],[-5,-1],[-3,0],[-4,0],[-15,6],[-3,-1],[-3,-1],[-10,-7],[-8,-9],[-4,-3],[-6,-2],[-2,-3],[-14,-49],[-4,-8],[-17,-24],[-18,-36],[-6,-9],[-4,-5],[-2,0],[-2,0],[-3,-1],[-2,-5],[-1,-4],[0,-36],[2,-22],[-1,-5],[0,-5],[-2,-11],[0,-2],[2,-1],[5,-1],[3,-2],[10,-15],[105,-137],[5,-14],[2,-6],[0,-2],[-1,-3],[-2,-3],[-7,-4],[-4,-1],[-4,1],[-41,24],[-5,2],[-5,1],[-2,0],[-2,-1],[-2,0],[-2,-2],[-4,-5],[-4,-9],[-6,-16],[-3,-12],[-3,-8],[-3,-8],[-14,-16],[-20,-18],[-3,-3],[-12,-21],[-3,-4],[-17,-15],[-13,-9],[-7,-3],[-2,-1],[-3,-1],[-3,0],[-3,1],[-7,3],[-3,0],[-19,-2],[-2,-1],[-2,-1],[-4,-2],[-3,-3],[-4,-4],[-6,-15],[-8,-12],[-4,-5],[-4,-3],[-23,-16],[-15,-13],[-6,-7],[-8,-11],[-2,-6],[-2,-11],[0,-3],[1,-2],[2,-3],[17,-27],[9,-26],[5,-27],[7,-14],[24,-22],[24,-81],[1,-7],[1,-20],[0,-6],[-2,-12],[-2,-9],[0,-2],[6,-44],[1,-4],[10,-17],[102,-356]],[[7578,7567],[12,4],[30,-1],[14,10],[15,13],[19,7],[11,7],[14,7],[3,2],[2,4],[1,3],[0,3],[2,5],[4,7],[18,26],[1,3],[-1,2],[-1,3],[-2,4],[2,7],[3,4],[4,2],[4,1],[4,1],[3,-1],[7,-5],[2,-1],[4,0],[5,1],[4,3],[3,3],[11,19],[4,4],[3,2],[4,1],[12,5],[5,5],[4,-1],[4,-2],[3,-3],[6,-2]],[[8313,6832],[0,-1],[-6,-9],[6,-14],[8,-11],[10,-7],[14,-2],[11,3],[20,12],[12,1],[11,-5],[18,-19],[10,-6],[12,0],[33,5],[12,4],[13,10],[4,11],[3,13],[6,14],[11,12],[11,2],[9,-7],[2,-17],[-4,-16],[-16,-31],[-4,-17],[0,-16],[4,-31],[-1,-14],[-5,-13],[-6,-13],[-5,-14],[2,-15],[18,-52],[17,-20],[22,-8],[24,1],[22,8],[24,1],[42,-22],[26,3],[26,11],[20,2],[20,-8],[23,-20],[20,-13],[44,-11],[21,-12],[42,-36],[17,-15],[16,-21],[4,-17],[-6,-15],[-20,-23],[-5,-13],[-6,-25],[-2,-8],[-20,1],[-8,-1],[-15,-6],[-19,-10],[-13,-14],[0,-17],[-8,1],[-14,4],[-5,-2],[-7,-7],[-5,-3],[-5,1],[-38,14],[-11,-2],[4,-21],[-6,-1],[-15,2],[-6,-4],[-5,-7],[-2,-6],[-4,-6],[-8,-4],[-15,-2],[-14,2],[-12,-2],[-10,-13],[-27,10],[-11,-16],[-5,-26],[-12,-20],[-13,-3],[-39,9],[-18,-35],[-8,-6],[-10,-4],[-46,-37],[-10,-10],[-6,-12],[-2,-17],[0,-10],[-1,-3],[-3,-3],[-5,-7],[-1,-3],[-2,-9],[-1,-3],[-2,-2],[-4,-2],[-2,-2],[-6,-12],[-2,-2],[6,-9],[34,-65],[18,-71],[19,-30],[1,-14],[-3,-14],[-7,-12],[-10,-13],[-8,-13],[-24,-64],[-4,-18],[0,-33],[-10,-30],[-2,-15],[2,-15],[3,-10],[6,-10],[8,-10],[10,-5],[27,5],[12,0],[10,-6],[11,-11],[5,-7],[-36,-20],[-13,-10],[-9,-14],[0,-15],[-10,-9],[-8,-12],[-10,-10],[-12,-5],[-14,0],[-11,-2],[-11,-6],[-11,-10],[-6,-13],[-3,-10],[-5,-6],[-13,1],[-16,5],[-7,0],[-8,-1],[-6,-5],[-6,-7],[-4,-8],[5,-13],[-7,-13],[-13,-11],[-12,-4],[-2,-3],[6,-14],[0,-6],[-4,-5],[-10,-8],[-5,-5],[-13,-20],[-10,-9],[-4,-6],[-4,-15],[-9,-7],[-2,-7],[-2,-10],[-5,-4],[-14,-3],[-14,-7],[-9,-7],[-9,-8],[-9,-12],[-6,-14],[1,-13],[2,-14],[-3,-18],[-8,-10],[-25,-7],[-5,-6],[-4,-10],[-31,-46],[-6,-5],[-8,-2],[-10,4],[1,-5],[2,-10],[1,-5],[-12,1],[-12,-7],[-10,-11],[-4,-12],[-2,-3],[31,-17],[12,-19],[14,-32],[9,-33],[-1,-10],[-2,-12],[-102,-90],[-24,-15],[-112,-26],[-107,-53],[-9,-11],[-26,-92],[-27,-90],[-32,-111],[-34,-69],[-30,-63],[-48,-98],[-38,-55],[-16,-29],[-20,-52],[-8,-11],[-10,-7],[-80,-45],[-70,-39],[-82,-46],[-89,-49],[-17,-12],[-46,-60],[-14,-31],[-36,-151],[-13,-35],[-17,-33],[-24,-27],[-76,-67],[-49,-69],[-7,-15],[-3,-14],[-8,-91],[-3,-12],[-8,-7],[-99,-32],[-87,-29],[-51,-5],[-49,5],[-53,-5],[-53,-12],[-47,-18],[-75,-40],[-71,-38],[-50,-12],[-44,6],[-31,24],[-24,37],[-19,48],[-2,14],[2,28],[-5,15],[-7,10],[-18,15],[-20,25],[-15,13],[-18,10],[-18,6],[-13,2],[-12,-3],[-24,-10],[-24,-4],[-11,-4],[-11,-8],[-34,-42],[-43,-33],[-6,-7]],[[5766,3141],[-71,36],[-38,25],[-10,9],[-12,13],[-38,61],[-10,21],[-38,123],[-2,14],[-1,5],[-3,7],[-6,7],[-3,6],[-1,6],[0,26],[0,5],[-3,6],[-4,7],[-8,7],[-5,3],[-5,1],[-10,10],[-14,32],[-17,6],[-58,7],[-4,2],[-2,2],[-1,3],[0,6],[0,3],[-1,3],[-2,3],[-3,2],[-4,2],[-15,5],[-17,3],[-16,0],[-8,-1],[-66,-30]],[[5897,5653],[10,-2],[6,4],[1,1],[2,4],[1,5],[2,4],[3,6],[8,10],[4,4],[6,2],[9,-2],[6,0],[9,2],[5,1],[5,4],[14,12],[7,3],[6,0],[12,-3],[20,-10],[7,-2],[8,-2],[6,1],[28,12],[8,3],[5,0],[5,0],[3,-2],[3,-2],[7,-8],[5,-4],[12,-6],[9,19],[14,15],[2,5],[1,4],[-1,3],[-2,7],[5,23],[2,2],[3,4],[10,3],[8,5],[4,4],[2,3],[2,9],[1,19],[0,5],[-6,17],[1,5],[3,3],[5,2],[3,2],[0,3],[-3,4],[-8,10],[-3,5],[-5,12],[30,83],[1,7],[0,5],[-4,12],[0,11],[4,9],[12,17],[26,56],[5,14],[5,31],[6,14],[9,11],[10,10],[8,10],[11,32],[10,13],[23,23],[3,6],[1,7],[0,14],[2,11],[4,10],[5,8],[22,27],[6,4],[18,10],[6,4],[8,12],[5,15],[6,31],[3,9],[12,21],[3,7],[1,7],[1,15],[3,14],[6,12],[23,32],[6,12],[4,13],[1,52],[-3,8],[-3,2],[-1,3],[0,5],[-1,4],[-2,2],[-5,2],[-4,1],[-4,-1],[-2,-2],[-2,-5],[-1,-2],[-1,-2],[-2,-2],[-2,-1],[-4,-1],[-2,-2],[-2,-3],[-2,-5],[-1,-3],[-3,-4],[-3,-1],[-3,0],[-2,2],[-4,4],[-3,8],[-2,10],[9,31],[1,13],[-2,5],[-2,1],[-3,1],[-3,0],[-27,-6],[-5,1],[-5,0],[-7,4],[-4,5],[-2,6],[-3,22],[-7,26],[0,7],[0,14],[-3,15],[-21,47],[-2,7],[2,4],[2,2],[6,2],[7,7],[2,12],[5,54],[3,13],[3,10],[15,25],[6,5],[4,4],[8,3],[9,5],[6,4],[40,17],[2,0],[2,-1],[4,-3],[3,-2],[8,-2],[2,-1],[1,-2],[3,-1],[5,-1],[7,3],[5,2],[4,1],[5,-1],[5,1],[9,5],[5,1],[8,1],[7,2],[5,2],[3,4],[8,12],[3,6],[1,5],[0,3],[-1,4],[-2,4],[-3,4],[-2,1],[-3,0],[-2,-1],[-2,0],[-2,0],[-1,3],[-1,7],[7,33],[-1,3],[-5,8],[-6,10],[0,2],[0,3],[0,4],[0,3],[-1,3],[-1,3],[-2,2],[-3,2],[-3,6],[-1,10],[3,16],[2,6],[5,5],[5,-4],[3,-5],[4,-4],[4,-3],[17,-8],[6,-2],[5,0],[25,9],[4,-1],[16,-11],[7,-6],[5,-6],[2,-5],[1,-5],[0,-23],[1,-5],[2,-4],[4,-9],[5,-9],[11,-14],[6,-7],[6,-4],[30,-13],[7,8],[-1,16],[2,13],[4,13],[6,8],[6,8],[6,10],[3,15],[-2,16],[-6,11],[-9,9],[-8,11],[4,0],[-10,8],[-3,12],[3,12],[8,11],[5,11],[-2,13],[1,14],[11,16],[34,18],[10,3],[18,-1],[6,1],[5,4],[2,4],[3,5],[6,1],[-3,9],[1,7],[3,6],[6,7],[2,5],[3,10],[3,5],[27,21],[5,8],[1,15],[-1,10],[0,8],[11,20],[2,39],[3,11],[12,29],[4,6],[3,4],[7,22],[6,6],[13,5],[7,4],[12,16],[3,2],[16,-8],[24,-2],[12,-3],[9,-5],[7,6],[8,2],[7,-2],[7,-6],[5,29],[-10,72],[9,28],[9,4],[58,13],[11,6],[20,18],[19,14],[23,6],[26,2],[10,-1],[10,-24],[6,-18],[4,-6],[5,-4],[3,-2],[27,-3],[11,-3],[8,-3],[4,-4],[2,-3],[-1,-3],[-2,-2],[-2,-2],[-5,-3],[-4,-3],[-8,-8],[-1,-3],[-1,-3],[0,-5],[1,-3],[3,-4],[13,-11],[5,-3],[5,-1],[8,1],[8,3],[2,1],[3,2],[2,3],[4,6],[5,10],[2,4],[3,3],[7,2],[3,1],[1,2],[0,2],[-1,5],[0,2],[1,2],[1,3],[13,14],[4,2],[4,2],[3,-1],[4,-3],[3,-3],[3,-4],[1,-3],[1,-2],[-4,-9],[-1,-3],[-1,-3],[1,-3],[2,-3],[11,-12],[14,1],[2,-2],[3,-4],[0,-4],[1,-3],[-1,-10],[0,-3],[-1,-3],[-2,-2],[-5,-3],[-3,-5],[1,-2],[2,-2],[3,-2],[2,0],[3,0],[3,0],[3,2],[4,0],[5,-1],[5,-4],[1,-2],[0,-3],[-1,-3],[-1,-2],[-2,-3],[-2,-2],[-5,-2],[-3,-2],[-4,-3],[-2,-5],[-2,-12],[1,-5],[2,-4],[3,-1],[4,0],[14,2],[3,-1],[7,-5],[3,-1],[4,0],[9,1],[4,-1],[1,-2],[-1,-3],[-1,-2],[1,-9]],[[4093,267],[5,-2],[-13,-6],[-2,-10],[-5,-10],[-16,-5],[-11,5],[-10,11],[-5,9],[-2,4],[-4,13],[9,-10],[14,-1],[28,11],[12,-9]],[[5766,3141],[-54,-60],[-7,-13],[-45,-145],[-15,-22],[-52,-55],[-37,-65],[-73,-75],[-40,-30],[-55,-61],[-26,-47],[-16,-57],[-14,-92],[-13,-89],[5,-31],[19,-23],[96,-43],[25,-19],[45,-43],[27,-11],[148,6],[23,-6],[22,-14],[18,-24],[3,-27],[-4,-62],[2,-30],[-2,-13],[-5,-15],[-4,-15],[1,-14],[5,-30],[-3,-28],[-9,-27],[-33,-61],[-3,-12],[-1,-27],[-5,-39],[0,-11],[12,-38],[19,-36],[25,-32],[25,-24],[11,-15],[13,-42],[9,-17],[10,-8],[24,-10],[35,-8],[72,2],[24,6],[24,11],[23,8],[25,-6],[13,-20],[2,-31],[-3,-65],[-4,-86],[5,-26],[10,-16],[25,-30],[5,-18],[3,-18],[7,-15],[21,-25],[38,-38],[11,-15],[7,-18],[21,-103],[13,-41],[17,-39],[37,-64],[21,-66],[12,-21],[5,-8],[-13,-10],[-41,-22],[-8,-17],[-5,-24],[1,-21],[12,-12],[3,-4],[0,-5],[-1,-5],[-2,-5],[-1,-15],[-1,-6],[0,-5],[1,-6],[1,-5],[15,-9],[24,-5],[22,-8],[5,-18],[-6,-7],[-30,-12],[-7,-9],[-4,-8],[-7,-5],[-12,0],[-13,6],[-12,1],[-11,-4],[-38,-28],[-10,-13],[3,-14],[8,-12],[-4,-5],[-11,-3],[-13,-5],[-23,-13],[-12,-4],[-83,7],[-23,13],[-10,11],[-5,11],[-3,29],[-6,27],[1,8],[3,5],[11,7],[3,8],[-7,18],[-26,1],[-65,-18],[-28,-22],[-11,-4],[-33,-2],[-12,-7],[-23,-18],[-12,-3],[-13,-1],[-35,-13],[-22,-2],[-7,-5],[-7,-12],[-15,-46],[-6,-14],[-23,-21],[-27,-7],[-125,-2],[-34,5],[-27,15],[-48,57],[-18,9],[-174,5],[-46,-19],[-25,-4],[-11,3],[-35,19],[-15,5],[-12,-3],[-25,-15],[-16,-7],[-12,1],[-8,10],[-12,24],[-5,6],[-5,5],[-6,3],[-8,-1],[-4,-5],[-1,-6],[-2,-6],[-19,-40],[-6,-5],[-12,10],[-3,43],[-9,16],[-33,1],[-13,-31],[0,-60],[0,-78],[-1,-104],[-48,0],[-61,0],[-71,1],[-29,-5],[-19,-16],[0,6],[-1,7],[-2,6],[-4,3],[-8,-1],[0,-7],[2,-7],[1,-6],[-5,-9],[-8,-9],[-8,-4],[-9,4],[-4,7],[-1,6],[-3,3],[-6,-1],[-5,-5],[-2,-7],[1,-7],[-1,-5],[1,-1],[3,-3],[1,-3],[-2,-2],[-3,0],[-6,1],[-2,0],[-4,-3],[-11,-6],[-5,-3],[-14,-26],[-1,-1],[0,1],[-15,47],[-1,-24],[1,-7],[1,-5],[5,-10],[2,-3],[-3,-15],[-11,-29],[-3,-15],[0,-14],[7,-21],[2,-14],[-6,-1],[-11,10],[-18,19],[-2,-18],[-10,0],[-12,10],[-5,16],[2,5],[8,7],[2,4],[0,14],[0,3],[5,13],[4,3],[8,0],[0,5],[-8,7],[-10,12],[-8,15],[-3,17],[4,20],[2,9],[-10,-1],[-15,10],[-6,3],[17,-65],[8,-17],[-12,-28],[-7,-13],[-6,-5],[-4,5],[-3,8],[-1,9],[-1,6],[-3,4],[-7,-1],[-6,-3],[-1,-3],[-6,2],[-7,4],[-6,5],[-2,8],[-2,5],[-5,0],[-6,0],[-4,2],[-3,8],[0,9],[-3,7],[-5,1],[-6,-4],[-9,-10],[-2,11],[-1,28],[-5,7],[-4,-17],[-6,-50],[-4,-10],[-18,3],[-19,6],[-33,17],[7,-6],[7,-10],[1,-10],[-7,-11],[-10,-2],[-14,1],[-23,6],[-6,1],[-5,-1],[-4,2],[-1,6],[0,9],[3,7],[3,5],[2,8],[5,42],[3,9],[0,5],[-2,0],[-1,1],[0,2],[0,3],[-8,-13],[0,-31],[-5,-14],[-10,-5],[-9,4],[-6,9],[-1,13],[-8,-9],[-5,3],[-5,9],[-7,7],[-9,1],[-2,-6],[4,-8],[7,-7],[-35,9],[-7,6],[5,2],[5,-1],[4,0],[7,4],[4,7],[8,17],[5,7],[-6,-3],[-7,-5],[-7,-4],[-6,2],[-1,7],[2,12],[4,17],[-27,6],[-7,4],[10,26],[6,8],[9,-3],[17,12],[6,8],[2,11],[-14,-13],[-13,1],[-13,8],[-17,4],[-35,-2],[-18,3],[-8,11],[-3,25],[-6,18],[-16,32],[-3,10],[-2,9],[0,38],[-3,6],[-5,8],[2,5],[4,8],[2,3],[-4,20],[12,10],[19,3],[16,-2],[-12,7],[-11,3],[-26,0],[-7,9],[1,19],[8,34],[-4,-6],[-4,-4],[-9,-6],[-1,20],[-6,17],[-10,15],[-13,15],[13,13],[-3,5],[-14,2],[-6,9],[-3,11],[-2,11],[-1,10],[9,-4],[12,-1],[11,1],[10,4],[-18,13],[-9,5],[-11,3],[-11,-1],[-8,-3],[-5,2],[-1,15],[4,21],[12,19],[15,16],[15,13],[17,10],[2,5],[-6,11],[-8,6],[-6,0],[-6,-4],[-23,-5],[-5,2],[-4,15],[-3,8],[-5,6],[-6,3],[-11,-2],[-6,-2],[-7,-1],[-12,5],[-4,-6],[5,-16],[-11,6],[-26,21],[-11,3],[-11,6],[-8,8],[-5,8],[-5,0],[0,-14],[2,-5],[3,-6],[-15,2],[-12,9],[-11,11],[-13,9],[-18,0],[-16,-6],[-16,-3],[-14,9],[-6,-3],[-33,-5],[-15,-6],[-7,-2],[-16,7],[2,14],[12,16],[17,9]],[[6541,8415],[9,3],[6,6],[5,8],[5,17],[5,8],[7,5],[4,6],[1,7],[-3,7],[1,33],[16,20],[42,30],[16,24],[5,14],[-2,10],[-19,16],[-34,39],[-12,19],[2,20],[18,24],[31,26],[6,11],[1,15],[-6,10],[-8,9],[-4,7],[-4,5],[-4,16],[3,15],[4,13],[1,15],[-6,11],[-10,7],[-34,17],[-12,10],[-6,12],[8,15],[11,15],[3,13],[-2,13],[-8,14],[-4,4],[-9,7],[-4,5],[-3,8],[0,7],[1,7],[-1,7],[-4,11],[-21,37],[-8,11],[-28,20],[-7,11],[-3,25],[-9,10],[-18,8],[-17,4],[-17,7],[-15,16],[-9,7],[-22,12],[-7,6],[-1,3],[-2,11],[6,12],[20,19],[3,7],[3,16],[3,6],[24,15],[19,9],[6,4],[4,7],[3,16],[3,5],[39,13],[13,10],[47,52],[10,7],[12,4],[15,3],[12,6],[-3,10],[-7,12],[3,11],[16,15],[5,8],[5,12],[7,23],[6,7],[12,1],[12,-5],[36,-24],[18,-19],[9,-3],[10,0],[9,4],[8,8],[-2,10],[-11,20],[0,24],[12,8],[40,3],[10,3],[8,7],[8,8],[8,7],[29,16],[10,10],[13,7],[26,6],[9,10],[1,6],[-2,7],[-1,6],[5,6],[7,4],[16,5],[36,5],[10,6],[-4,12],[-9,15],[2,9],[10,7],[27,11],[55,13],[27,1],[26,8],[28,-1],[13,3],[38,32],[30,15],[40,9],[41,3],[51,-7],[55,2],[18,5],[15,8],[15,4],[19,-8],[9,0],[7,3],[15,10],[10,4],[92,9],[19,-2],[19,-5],[9,-1],[9,1],[30,11],[30,-2],[41,5],[19,-2],[20,-4],[81,14],[42,-2],[1,0],[1,0]]],"transform":{"scale":[0.0016206212906290677,0.0013361294212421236],"translate":[60.844378703000075,23.694525458000058]}};
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
