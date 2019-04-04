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
  Datamap.prototype.pakTopo = '__PAK__';
  Datamap.prototype.panTopo = '__PAN__';
  Datamap.prototype.pcnTopo = '__PCN__';
  Datamap.prototype.perTopo = '__PER__';
  Datamap.prototype.pgaTopo = '__PGA__';
  Datamap.prototype.phlTopo = '__PHL__';
  Datamap.prototype.plwTopo = '__PLW__';
  Datamap.prototype.pngTopo = '__PNG__';
  Datamap.prototype.polTopo = {"type":"Topology","objects":{"pol":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Warmian-Masurian"},"id":"PL.WN","arcs":[[0,1,2,3,4]]},{"type":"Polygon","properties":{"name":"Pomeranian"},"id":"PL.PM","arcs":[[-4,5,6,7,8]]},{"type":"Polygon","properties":{"name":"Lower Silesian"},"id":"PL.DS","arcs":[[9,10,11,12]]},{"type":"Polygon","properties":{"name":"West Pomeranian"},"id":"PL.ZP","arcs":[[13,14,15,-8]]},{"type":"Polygon","properties":{"name":"Lubusz"},"id":"PL.LB","arcs":[[16,-13,17,-15]]},{"type":"Polygon","properties":{"name":"Greater Poland"},"id":"PL.WP","arcs":[[-7,18,19,20,-10,-17,-14]]},{"type":"Polygon","properties":{"name":"Kuyavian-Pomeranian"},"id":"PL.KP","arcs":[[-3,21,22,-19,-6]]},{"type":"Polygon","properties":{"name":"Silesian"},"id":"PL.SL","arcs":[[23,24,25,26,27]]},{"type":"Polygon","properties":{"name":"Łódź"},"id":"PL.LD","arcs":[[28,29,-28,30,-20,-23]]},{"type":"Polygon","properties":{"name":"Masovian"},"id":"PL.MZ","arcs":[[31,32,-29,-22,-2,33]]},{"type":"Polygon","properties":{"name":"Świętokrzyskie"},"id":"PL.SK","arcs":[[34,35,36,-24,-30,-33]]},{"type":"Polygon","properties":{"name":"Podlachian"},"id":"PL.PD","arcs":[[37,-34,-1,38]]},{"type":"Polygon","properties":{"name":"Lublin"},"id":"PL.LU","arcs":[[39,40,-35,-32,-38]]},{"type":"Polygon","properties":{"name":"Subcarpathian"},"id":"PL.PK","arcs":[[41,42,-36,-41]]},{"type":"Polygon","properties":{"name":"Opole"},"id":"PL.OP","arcs":[[-31,-27,43,-11,-21]]},{"type":"Polygon","properties":{"name":"Lesser Poland"},"id":"PL.MA","arcs":[[-43,44,-25,-37]]}]}},"arcs":[[[8670,9236],[2,-13],[-25,-82],[-57,-60],[-66,-45],[-223,-32],[-93,-134],[100,-136],[6,-51],[10,-47],[51,-50],[106,-150],[-4,-80],[-40,-78],[-35,-100],[-57,-62],[-278,-175],[-97,-112],[-172,-121],[-75,-11],[-32,-14],[-29,-24],[-63,-22],[-142,8],[-73,-32]],[[7384,7613],[-121,-10],[-24,-14],[-29,-57],[-40,-30],[-46,-7],[-88,8],[-76,-92],[-90,-30],[-95,1],[-73,-43],[-64,-14],[-71,1],[-36,-30],[-33,-41],[-140,-83],[-36,-11],[-39,4],[-31,-25],[-17,-57],[-26,-32],[-30,-15],[-75,-15],[-315,51],[-9,10],[-6,16],[-16,11],[-17,3],[-39,-12],[-26,-53],[-29,-25],[-34,-9]],[[5613,7013],[-15,157],[-52,134],[-55,40],[-114,31],[-107,65],[-77,26],[-18,1],[-24,11],[-15,23],[-31,58],[-24,74],[-87,172]],[[4994,7805],[148,279],[35,39],[42,27],[80,-5],[57,25],[2,28],[12,19],[15,48],[19,19],[11,23],[0,28],[5,28],[-50,14],[-99,-8],[-36,17],[20,68],[-26,36],[-52,6],[-48,29],[-33,56],[-18,73],[-3,34],[16,24],[44,44],[15,28],[11,31],[-10,43],[-21,37],[-21,65],[6,59],[25,28],[88,-12],[24,3],[0,-13],[-10,-9],[-7,-15],[-4,-21],[0,-25],[13,13],[18,47],[7,10],[6,7],[25,41],[25,24],[13,8],[13,3],[77,49],[17,7],[39,5],[65,48],[13,6],[15,2],[8,9],[6,19],[7,16],[16,4],[-2,7],[-2,19],[-2,8],[11,-1],[4,2]],[[5623,9308],[206,-11],[387,-21],[288,-15],[288,-16],[357,-19],[433,-23],[277,-14],[278,-15],[233,-13],[187,-10],[69,23],[19,16],[25,46]],[[4994,7805],[-54,-25],[-114,-7],[-54,23],[-31,20],[-66,69],[-16,11],[-13,16],[-20,12],[-81,11],[-58,-21],[-37,-25],[-85,52],[-180,30],[-32,32],[-30,39],[-35,3],[-169,-26],[-126,25],[-27,-21],[-41,-76],[-69,-26],[-32,-31],[-5,-22],[-4,-24],[-1,-37],[-62,-25],[-138,37],[-37,-4],[-28,-40],[-24,-54],[-30,-107],[-28,-18]],[[3267,7596],[-45,54],[-53,30],[-203,9],[-59,36],[-41,75],[-48,60]],[[2818,7860],[-17,186],[41,43],[30,54],[-11,36],[-17,29],[-20,10],[-1,33],[50,24],[55,-7],[-19,40],[-23,34],[-28,25],[-38,78],[-24,29],[-42,31],[-1,94],[-8,94],[-63,195],[139,34],[16,25],[-4,42],[-19,27],[-11,25],[8,30],[26,27],[11,46],[-8,82],[-30,63],[-83,119],[-69,140],[-2,3]],[[2656,9551],[74,30],[43,7],[37,14],[96,104],[301,140],[377,71],[170,58],[266,24],[165,0],[22,-8],[36,-32],[14,-7],[21,-4],[340,-203],[63,-80],[10,-19],[10,-26],[1,-23],[-18,-9],[-4,6],[-5,12],[-6,13],[-18,12],[-12,33],[-17,20],[-47,80],[-10,5],[-35,7],[-9,4],[-9,16],[-28,10],[-60,40],[-59,28],[-9,14],[-32,24],[-9,4],[-12,-5],[-6,-9],[-15,-49],[-1,-11],[0,-25],[5,-6],[24,-11],[5,-6],[12,-21],[15,-32],[-1,-13],[-4,-11],[1,-12],[11,-12],[-6,-33],[12,-14],[19,4],[16,21],[-6,-29],[8,-22],[13,-19],[25,-78],[8,-17],[-4,-39],[1,-68],[6,-64],[14,-28],[16,-6],[30,-23],[16,-5],[13,-2],[17,-5],[14,-9],[6,-15],[17,-24],[168,-54],[38,-3],[31,17],[8,-8],[12,-7],[27,-8],[375,56],[82,40],[40,9],[31,15],[62,64],[17,7],[21,-17],[49,-17],[78,-4]],[[2243,4714],[87,18],[40,-12],[113,-65],[18,-43],[3,-56],[43,-81],[97,-58],[54,-64],[115,-44],[207,39],[37,92],[42,9],[117,-1],[111,-32],[99,-69],[-10,-49],[-14,-42],[-24,-17],[-14,-37],[6,-74],[23,-62],[59,-15],[61,13],[38,-11],[36,-31],[-28,-72],[11,-176],[13,-85]],[[3583,3689],[-33,-22],[-34,-9],[-35,3],[-32,-12],[-26,-30],[-58,-145],[-11,-41],[-6,-45],[-16,-52],[-32,-23],[-47,-66],[-36,-90],[-83,-134],[-72,-148],[-23,-96],[-36,-68],[-60,-11],[-52,-43],[-72,-196],[-5,-21]],[[2814,2440],[-28,19],[-23,3],[-27,-18],[0,-24],[32,-52],[12,-31],[7,-36],[10,-34],[19,-21],[24,-15],[18,-22],[11,-31],[1,-42],[13,-19],[2,-22],[-6,-15],[-12,5],[-11,18],[-5,10],[-6,5],[-14,0],[-3,-5],[0,-20],[-2,-7],[-9,0],[-19,7],[-9,0],[-12,-10],[-16,-25],[-10,-9],[-11,-3],[-12,-4],[-20,2],[-20,-3],[-22,-21],[-18,-30],[-11,-24],[-12,-19],[-22,-17],[-31,-46],[-40,-4],[-42,24],[-35,35],[-17,25],[-10,22],[-11,58],[-11,33],[-30,34],[-13,25],[-14,22],[-25,51],[-15,22],[-22,17],[-44,18],[-18,26],[-3,15],[1,15],[-1,16],[-7,16],[-9,3],[-46,0],[-11,-4],[-7,-7],[-8,-1],[-13,11],[-4,10],[-13,44],[-33,6],[-9,31],[8,27],[20,-5],[-2,5],[-5,19],[6,1],[9,6],[6,3],[15,14],[18,11],[15,14],[7,22],[16,6],[32,-10],[17,4],[10,15],[20,22],[9,13],[-3,-1],[0,10],[1,13],[2,9],[4,10],[3,5],[0,5],[-4,13],[31,14],[-9,33],[-85,98],[-30,19],[-33,9],[-36,1],[-13,-3],[-7,-17],[-8,-22],[-12,-17],[-17,-4],[-15,8],[-31,26],[-42,5],[-62,-66],[-43,-8],[-2,5],[0,5],[0,6],[2,5],[15,13],[2,21],[-6,23],[-8,23],[-13,27],[-14,14],[-16,3],[-59,-24],[-28,-1],[-6,2],[-51,94],[-3,10],[-2,12],[-25,2],[-83,-21],[-10,3],[-8,8],[-13,22],[-11,8],[-120,46],[-80,30],[-41,-4],[-10,-12],[-9,-18],[-11,-13],[-2,1],[-12,4],[-7,14],[1,16],[3,17],[0,17],[-12,32],[-16,14],[-18,8],[-19,18],[-11,18],[-12,29],[-9,30],[-3,24],[7,32],[9,17],[1,17],[-16,28],[-27,14],[-57,1],[-9,25],[-5,26],[-12,7],[-12,-10],[-9,-22],[0,-1],[-4,-17],[-11,-2],[-14,7],[-12,13],[-8,17],[-51,12],[-19,18],[-3,-14],[-4,-8],[-15,-11],[-5,-1],[-6,-3],[-5,-5],[-5,-6],[5,-19],[16,-14],[15,-24],[1,-49],[-3,-9],[-10,-12],[-3,-6],[-1,-10],[1,-6],[1,-5],[1,-59],[-2,-15],[-114,9],[-36,-11],[-21,1],[0,32],[14,25],[36,43],[50,129],[45,123],[3,19],[0,33],[2,17],[5,12],[8,8],[6,11],[2,22],[2,43],[8,48],[13,46],[17,36],[-4,5],[-3,5],[5,50],[-15,33],[-22,29],[-19,35],[-3,12],[-4,30],[0,2],[-6,72]],[[825,4110],[19,12],[159,90],[29,0],[59,-54],[29,-3],[50,93],[34,43],[73,27],[140,-83],[71,19],[110,156],[98,205],[22,16],[35,13],[30,32],[15,45],[19,28],[152,-30],[26,-30],[4,-60],[55,-75],[79,19],[61,57],[49,84]],[[2818,7860],[-37,12],[-38,-1],[-36,-16],[-26,-47],[-19,-56],[-26,-109],[-30,-6],[-184,5],[-22,-33],[1,-68],[15,-61],[63,-62],[75,-20],[37,-20],[31,-41],[7,-49],[-31,-39],[-24,-43],[-28,-28],[-74,-24],[-144,-87],[-81,-131],[-96,-94],[-62,-25],[-62,-8],[-61,37],[-55,19]],[[1911,6865],[18,82],[-26,83],[-51,12],[-54,-8],[-52,-43],[-90,-118],[-50,-38],[-206,0],[-169,-60],[-56,-3],[19,-28],[28,-4],[-38,-75],[-61,-74],[-53,-8],[-166,58],[-98,-57],[-63,-144],[-78,-115],[-51,-22],[-85,-14],[-22,-34],[-24,-92]],[[483,6163],[-58,68],[-60,25],[-28,41],[-19,9],[-11,11],[-34,70],[-15,19],[-106,81],[-28,15],[-32,40],[-20,10],[-22,1],[-21,7],[-18,14],[-11,24],[27,24],[10,21],[4,32],[-2,22],[-12,60],[-6,18],[0,10],[48,37],[61,33],[58,49],[31,33],[13,31],[3,14],[30,97],[-2,25],[-6,24],[-4,28],[3,23],[7,21],[10,15],[11,6],[7,11],[26,53],[-13,12],[-4,10],[-15,13],[-6,11],[-3,17],[-1,31],[-1,14],[-7,32],[-21,100],[-11,89],[-20,36],[-11,35],[-24,39],[-7,35],[-1,38],[3,63],[-2,17],[-21,66],[-15,34],[4,26],[-1,48],[9,2],[18,7],[14,13],[1,14],[-18,12],[10,6],[3,6],[-3,6],[-10,6],[6,12],[10,-8],[14,-8],[12,-9],[12,-33],[14,-11],[27,-13],[20,-22],[11,-10],[44,-7],[54,-20],[18,-15],[15,-22],[33,-64],[12,-15],[5,5],[1,27],[5,16],[8,10],[14,11],[-1,7],[0,7],[1,10],[-11,3],[-25,2],[-12,6],[-31,76],[7,38],[24,74],[12,-10],[9,3],[11,7],[16,0],[-7,44],[3,34],[7,31],[4,32],[-7,0],[-3,-21],[-7,-13],[-24,-25],[6,-12],[-9,4],[-7,5],[-5,6],[-6,9],[5,5],[9,12],[7,6],[-14,29],[-24,14],[-110,12],[-16,17],[13,33],[-4,4],[-1,2],[-2,6],[-9,-17],[-8,-2],[-9,4],[-12,3],[-8,-3],[-7,-9],[-7,-11],[-8,-11],[29,-5],[17,-8],[8,-11],[-2,-21],[-10,-15],[-13,-6],[-9,7],[-27,-18],[-14,-4],[-14,-1],[0,-12],[14,-6],[-1,-3],[-13,-3],[-9,2],[-16,8],[-12,2],[-17,11],[-48,71],[-23,11],[-2,-1],[-8,27],[-18,22],[10,3],[8,5],[17,46],[16,-7],[11,-9],[31,-12],[99,-8],[39,8],[39,21],[72,53],[264,119],[227,60],[278,118],[180,49],[197,53],[193,88],[161,21],[111,37],[-13,-13],[-50,-22],[22,-16],[88,16],[0,10],[-7,0],[0,13],[48,0],[-1,8],[-1,2],[-1,-1],[-4,3],[2,27],[-23,1],[-54,-17],[34,17],[41,28],[62,72],[-12,-25],[-23,-24],[-8,-12],[9,3],[18,4],[16,6],[14,17],[35,16],[12,15],[-11,25],[-20,1],[-9,-11],[-15,-15],[43,73],[115,149],[0,-10],[-5,-17],[10,-4],[16,6],[13,15],[6,23],[-6,7],[-13,-6],[-15,-14],[21,41],[35,35],[68,42],[208,31],[7,2]],[[1911,6865],[-20,-98],[3,-109],[-97,-130],[31,-29],[21,-85],[-9,-27],[-20,-13],[-94,-31],[-15,2],[-7,-16],[-1,-38],[-5,-37],[4,-95],[35,-101],[13,-60],[7,-62],[0,-52],[-26,0],[-22,-15],[43,-79],[20,-51],[2,-105],[-33,-101],[-5,-25],[-2,-26],[-12,-50],[0,-58],[8,-54],[23,-36],[27,-30],[55,-31],[18,-53],[23,-45],[36,-37],[37,-1],[17,8],[17,-11],[1,-35],[-9,-32],[-5,-59],[15,-46],[43,-31],[45,-16],[73,52],[66,-76],[31,-127]],[[825,4110],[-4,46],[9,21],[-11,24],[-18,20],[-16,13],[-22,12],[-47,15],[-23,14],[-21,16],[-65,24],[-22,24],[-3,18],[-3,13],[9,33],[19,33],[12,34],[-2,45],[-10,43],[-13,30],[-48,43],[-23,28],[-10,44],[-4,45],[-14,19],[-18,14],[-16,26],[-3,37],[13,29],[57,62],[19,26],[15,31],[8,34],[4,104],[5,17],[22,41],[4,16],[2,16],[3,15],[8,15],[18,24],[-65,51],[-10,25],[6,44],[11,32],[4,24],[-14,24],[0,10],[19,28],[0,35],[-15,30],[-28,12],[-28,7],[-34,19],[-23,26],[6,31],[-21,50],[-23,75],[-6,68],[52,47],[24,41],[16,40],[-4,18],[-19,18],[8,40],[28,61],[-31,27],[-6,6]],[[3267,7596],[-28,-63],[-72,-97],[12,-51],[84,-68],[48,-112],[-91,-79],[9,-72],[31,-62],[-14,-106],[-45,-107],[81,-30],[76,-59],[49,-112],[-22,-121],[-12,-23],[-16,-6],[-17,1],[-17,-13],[-7,-45],[36,-36],[16,-40],[19,-33],[41,-8],[40,14],[18,16],[31,-27],[8,-23],[5,-28],[8,-11],[11,-6],[63,-23],[70,-4],[75,-42],[102,-98],[36,-20],[37,-2],[33,-15],[29,-37],[33,-32],[101,-28],[34,16],[58,71],[19,-5],[14,-10],[8,-32],[12,-27],[19,-30],[24,-8],[15,9],[10,19],[18,9],[20,2],[34,-17],[30,-37],[165,-142],[28,-65],[36,3],[104,46],[35,6],[95,-77]],[[4906,5619],[2,-55],[19,-43],[15,-4],[3,-17],[-62,-62],[-100,-45],[-10,-48],[-9,-107],[-51,-63],[-67,-17],[-34,4],[-32,-2],[-13,-53],[-8,-59],[12,-60],[19,-55],[-5,-54],[-47,-89],[-12,-14],[-144,17],[-57,-29],[-26,-37],[-47,-118],[-25,-104],[-5,-114],[10,-94],[1,-91],[-28,-81],[-47,-36],[-54,28],[-50,-16],[-17,-54],[-25,-42],[-73,-17],[-16,-39],[3,-55],[18,-47],[58,-55],[10,-47],[6,-80]],[[4018,3665],[-114,-73],[-118,-47],[-64,3],[-52,46],[-6,42],[-13,37],[-33,18],[-35,-2]],[[5613,7013],[-48,-40],[-51,-25],[6,-32],[0,-34],[8,-50],[-2,-34],[-6,-33],[-9,-29],[-19,2],[-19,14],[-19,8],[-21,-21],[-19,-29],[-42,-37],[-48,7],[15,-70],[-5,-63],[-20,-23],[-8,-35],[11,-36],[16,-32],[29,-72],[1,-57],[-43,-12],[-67,-204],[-26,-56],[-6,-66],[21,-22],[4,-32],[-74,-127],[-4,-29],[-6,-29]],[[5162,5715],[-20,1],[-19,-4],[-12,-20],[-10,-19],[-37,-12],[-123,-2],[-18,-11],[-7,-16],[-10,-13]],[[5615,3097],[86,-18],[12,-7],[4,-19],[0,-21],[-5,-14],[-68,-12],[-38,-77],[28,-36],[75,-24],[34,-28],[28,-68],[48,-63],[-40,-6],[-69,-64],[-20,-47],[35,-20],[68,-11],[28,-12]],[[5821,2550],[6,-37],[3,-31],[-126,-86],[-32,-6],[-56,5],[-54,-9],[-89,-76],[-25,-6],[-26,0],[-55,35],[-27,-44],[-28,-61],[-43,-68],[-67,11],[-31,-27],[53,-58],[46,-71],[-236,-293],[-22,-36],[-22,-50],[-12,-57],[20,-29],[27,-3],[21,-30],[2,-57],[30,-60],[51,-22],[20,-41],[16,-53],[32,-33],[37,-19],[68,-13],[-4,-45],[-17,-38],[-8,-36],[13,-31],[23,-18],[5,-20]],[[5314,1037],[-5,3],[-6,-3],[-4,-8],[-86,-107],[-8,-7],[-14,-6],[-10,-2],[-31,0],[-19,-5],[-17,-8],[-14,-16],[-14,-24],[-16,-56],[2,-2],[3,-5],[2,-8],[-2,-11],[-5,-4],[-12,0],[-3,-1],[-7,-34],[-2,-21],[-8,-14],[-30,-13],[-25,-6],[-11,1],[-9,5],[-20,17],[-9,3],[-22,-6],[-39,-25],[-25,-2],[-19,4],[-6,19],[4,57],[-2,25],[-5,23],[-1,25],[8,28],[-28,20],[-99,10],[4,29],[-3,35],[-14,73],[-5,16],[-11,29],[-5,17],[-7,59],[-4,13],[-15,13],[-15,-3],[-16,-8],[-15,-1],[-12,8],[-20,26],[-13,12],[-14,4],[-31,3],[-13,11],[-6,13],[-10,49],[-24,54],[-17,52],[-1,46],[28,35],[-27,16],[-4,21],[3,26],[-7,31],[-14,10],[-40,-28],[-23,0],[-74,46],[-39,15],[-40,-6],[2,0],[2,-1],[1,-2],[2,-2],[-28,-27],[-15,-4],[-20,18],[-5,12],[-7,26],[-4,10],[-12,10],[-24,5],[-11,6],[-32,30],[-15,9],[-64,13],[-13,17],[7,32],[-59,42],[-14,4]],[[3887,1797],[2,28],[59,128],[126,29],[60,50],[96,50],[11,50],[1,87],[-17,220],[9,35],[22,4],[21,12],[2,30],[-11,31],[14,38],[29,8],[145,-2],[-12,62],[-32,37],[-32,27],[-26,40],[-20,65],[24,69],[18,108],[27,61],[78,55],[7,60],[-14,32],[-6,39],[8,26],[12,16],[35,132]],[[4523,3424],[50,26],[141,5],[32,17],[32,24],[35,-8],[31,-34],[130,-76],[65,-14],[79,0],[35,33],[67,-14],[60,-60],[93,-161],[34,-11],[100,6],[108,-60]],[[5162,5715],[96,-70],[105,-23],[51,-26],[92,-78],[208,45],[31,34],[38,4],[27,-36],[24,-44],[31,-18],[35,-11],[28,-20],[12,-43],[4,-61],[20,-47],[15,-8],[15,4],[69,-29],[39,-28],[13,-18],[-10,-86],[-33,-21],[8,-36],[27,-33],[24,-37],[-3,-33],[9,-27],[36,-13],[105,13],[67,-32],[72,-60],[59,-83],[6,-28],[-9,-20],[-10,-16],[-5,-21],[9,-49],[54,-60],[15,-43],[-2,-41],[-13,-28],[-73,11],[-59,34],[-78,0],[-26,-96],[30,-76],[9,-53],[4,-55],[8,-27],[37,-19],[12,-16],[0,-55],[-16,-47],[-64,-64],[-13,-47],[3,-50]],[[6295,3928],[-28,-23],[-37,-97],[-33,-17],[-33,-5],[-32,-17],[-69,-71],[-32,-10],[-111,17],[-31,-12],[-24,-35],[-25,-103],[46,-75],[30,-27],[10,-57],[-8,-56],[-22,-29],[-132,105],[-36,-7],[-12,-55],[-1,-55],[4,-54],[-17,-51],[-35,-26],[-29,-29],[-23,-42]],[[4523,3424],[-75,65],[-24,49],[-26,35],[-12,-7],[-9,-18],[-13,-12],[-71,-2],[-223,62],[-30,26],[-22,43]],[[8945,5643],[-32,-63],[-95,-147],[-28,-71],[-33,-44],[-39,-16],[-117,64],[-41,10],[-18,-13],[-17,-19],[-6,-21],[-5,-26],[-55,-47],[-110,11],[-38,-5],[-96,-76],[-35,-12],[-50,11],[-137,-29],[-144,1],[-76,-23],[-71,-56],[6,-43],[16,-49],[20,-44],[4,-46],[24,-63],[35,-57],[-55,-35],[-38,-58],[50,-82],[-7,-39],[-25,-25],[-70,-27],[-73,12],[-36,16],[-36,-11],[-10,-43],[1,-18],[13,-23],[15,-18],[27,-14],[52,-12],[17,2],[25,12],[9,-1],[16,-11],[3,-16],[0,-19],[2,-24],[18,-30],[3,-21],[-15,-19],[0,-12],[31,-3],[-1,-70],[-25,-36],[-23,-21],[-2,-41],[40,-51],[-6,-50],[-12,-51],[2,-36],[-11,-2],[-10,-9],[-12,-27],[-18,-106],[-8,-25],[-4,-15],[-2,-20],[2,-13],[10,-31],[8,-55],[24,-66]],[[7676,3526],[-319,-71],[-165,55],[-77,8],[-68,47],[-7,27],[-4,28],[-30,36],[-8,58],[-31,11],[-31,-32],[-29,-44],[-33,-20],[-139,-24],[-121,27],[-25,21],[-21,36],[-24,29],[-164,108],[-30,81],[-55,21]],[[7384,7613],[13,-60],[23,-55],[16,-68],[25,-196],[56,-144],[37,-73],[53,-30],[54,-8],[46,-37],[-16,-31],[4,-43],[26,-47],[38,-22],[24,-26],[15,-42],[13,-63],[27,-50],[71,-39],[76,12],[50,56],[48,-38],[-16,-94],[25,-37],[31,-23],[56,30],[58,17],[16,-81],[6,-89],[12,-60],[3,-64],[-3,-37],[56,-63],[21,-30],[22,-19],[7,-10],[2,-17],[-3,-14],[-5,-14],[0,-15],[3,-22],[5,-14],[8,-8],[14,-3],[3,-8],[-6,-56],[7,-19],[17,-25],[20,-16],[17,8],[12,-20],[24,-7],[53,3],[155,-33],[78,11],[29,-10],[23,-23],[10,-39],[21,12],[18,-12],[28,-35],[-5,-10],[-5,-17],[-3,-8],[17,-11],[16,5],[15,11]],[[7676,3526],[4,-23],[-4,-10],[-8,-7],[-9,-5],[-7,-1],[0,-12],[19,-15],[3,-33],[-8,-74],[-1,-5],[-2,-4],[-3,-5],[-1,-10],[2,-10],[5,-5],[4,-3],[2,-6],[2,-16],[26,-104],[5,-37]],[[7705,3141],[3,-23],[1,-64],[-8,-67],[-7,-27],[-12,-31],[-15,-25],[-18,-10],[-26,-5],[-17,-14],[-29,-51],[-47,-62],[-7,-27],[-6,-33],[-12,-26],[-31,-40],[-18,-17],[-64,-19],[-95,-46],[3,-8],[10,-27],[-19,-22],[-25,-16],[-26,-6],[-18,9],[-62,-59],[-3,-1]],[[7157,2424],[-14,1],[-4,-3],[0,-8],[1,-8],[-1,-5],[-11,-9],[-7,0],[-9,9],[-5,-24],[-12,-12],[-12,-7],[-5,-9],[-1,-14],[-4,-3],[-5,-1],[-7,-6],[-18,-26],[0,-3],[-18,-4],[-9,9],[-9,13],[-15,6],[-10,-2],[-41,-22],[-9,-9],[-10,-11],[-11,-11],[-15,-4],[-74,-3],[-10,-4],[-9,-8],[-10,-14],[-9,-6],[-27,-3],[-14,-10],[-15,11],[-13,-9],[-14,-16],[-16,-8],[-38,40],[-7,-11],[-6,-29],[-21,-24],[-4,-2],[-9,0],[-4,-4],[-3,-8],[-1,-18],[-3,-9],[-14,-15],[-32,-17],[-13,-21],[-4,-18],[-30,-35],[-131,3],[-73,49],[-19,44],[-45,70],[-17,40],[-17,78],[-46,99],[-77,56],[-83,29],[-34,39],[-39,23],[-94,0]],[[9034,5631],[-8,-6],[-18,0],[-31,20],[-19,4],[-13,-6]],[[8670,9236],[1,3],[25,12],[21,-3],[60,-31],[11,-2],[23,5],[10,-2],[11,-11],[5,-13],[5,-14],[6,-11],[11,-7],[34,-4],[7,-10],[-4,-16],[-6,-20],[0,-18],[18,-25],[23,0],[24,10],[20,5],[18,-9],[62,-52],[38,-23],[81,-31],[19,-17],[19,-16],[10,-15],[18,-35],[9,-13],[10,-7],[22,-6],[9,-6],[16,-24],[14,-34],[11,-39],[8,-36],[14,-80],[1,-39],[-15,-26],[-12,-10],[-6,-7],[-4,-7],[-1,-19],[4,-15],[8,-13],[11,-9],[6,-7],[3,-9],[-1,-9],[-4,-10],[1,-50],[10,-42],[14,-40],[10,-43],[9,-91],[10,-35],[25,-36],[2,-105],[24,-119],[85,-267],[47,-100],[20,-54],[40,-162],[17,-48],[18,-25],[10,-24],[8,-25],[12,-27],[17,-20],[17,-14],[11,-20],[-2,-42],[-9,-24],[-12,-21],[-10,-23],[-1,-34],[8,-29],[31,-40],[11,-25],[2,-14],[-3,-20],[0,-11],[9,-48],[0,-13],[-3,-11],[-11,-23],[-3,-13],[1,-19],[4,-10],[4,-9],[2,-13],[9,-207],[2,-52],[-14,-73],[-40,-51],[-132,-94],[-167,-50],[-88,-54],[-88,-76],[-122,-196],[-40,-51],[-18,-31],[-47,-99],[4,-1],[7,-6]],[[9034,5631],[7,-7],[11,-17],[3,-22],[-7,-31],[22,-15],[72,-20],[15,6],[13,-14],[62,-24],[21,-3],[0,-10],[-7,-16],[3,-3],[14,6],[13,-6],[9,-10],[9,-1],[14,17],[4,-8],[10,-8],[6,-8],[17,17],[4,-13],[-3,-21],[-4,-6],[28,-58],[19,-7],[47,2],[19,-12],[7,-13],[5,-14],[6,-11],[9,-5],[12,-9],[4,-19],[1,-20],[9,-21],[14,-65],[11,-29],[-15,-13],[-14,-21],[-18,-48],[-7,-31],[-1,-56],[-6,-19],[4,-2],[2,0],[0,-2],[1,-8],[-12,-7],[-4,-37],[-11,-14],[15,-31],[19,-27],[-12,-39],[-19,-21],[-21,-13],[-17,-21],[-4,-12],[-4,-19],[-5,-39],[3,-9],[7,-12],[2,-11],[-9,-4],[-4,-5],[3,-11],[6,-12],[5,-7],[-12,-17],[-7,-4],[-8,-2],[0,-12],[11,-13],[1,-17],[-5,-46],[3,-25],[9,-24],[22,-40],[-7,-1],[-7,1],[13,-27],[16,-6],[13,-9],[4,-23],[2,-10],[7,-24],[15,-12],[18,-7],[15,-10],[-16,-35],[2,-10],[40,-65],[8,-20],[-11,-6],[-7,-12],[-2,-17],[7,-23],[-19,-8],[-17,-20],[-14,-25],[-5,-23],[6,-37],[16,-8],[19,-1],[17,-12],[55,-130],[23,-29],[51,-35],[47,-52],[11,-21],[-16,-9],[-4,-16],[15,-34],[26,-44],[9,-23],[11,-71],[0,-11],[-4,-13],[7,-7],[13,-6],[12,-9],[11,-18],[3,-14],[1,-16],[6,-22],[15,-27],[67,-67],[83,-50],[13,-22],[-12,-29],[-31,-7],[-33,-1],[-20,-9],[-26,16],[-28,-4],[-23,-19],[-12,-29],[2,-33],[14,-22],[24,-12],[28,-4],[0,-10],[-13,-30],[14,-26],[27,-19],[27,-7],[-6,-39],[8,-36],[25,-67],[-23,-44],[10,-81],[7,-23],[6,-5],[-2,-3],[-12,-20],[-19,-22],[-64,-37],[-3,-20],[2,-33],[-2,-23],[-5,-18],[-22,-56],[-52,-24],[-181,-3],[-34,-12],[-18,-9],[-13,-15],[-11,-25],[-12,-45]],[[9516,2281],[-1,0],[-100,64],[-32,53],[-63,44],[-74,9],[-57,-6],[-26,-12],[-82,-102],[-65,-58],[-75,-17],[-224,8],[-137,42],[-10,25],[34,10],[16,10],[-27,20],[-139,-30],[-35,18],[-26,43],[-7,43],[16,35],[25,36],[31,12],[31,-5],[28,18],[-12,41],[-23,48],[-3,24],[1,23],[-9,16],[-157,92],[-233,65],[-18,35],[45,93],[14,43],[-32,31],[-35,24],[-38,15],[-40,-1],[-66,-51],[-74,4],[-132,98]],[[9516,2281],[-1,-3],[-14,-22],[-79,-94],[-29,-25],[-54,-46],[-45,-39],[-228,-273],[-30,-51],[-37,-32],[-40,-48],[-108,-176],[-42,-47],[-5,-15],[-8,-34],[-5,-12],[-8,-10],[-18,-7],[-9,-7],[-9,-13],[-62,-124],[-17,-19],[-11,-5],[-21,-5],[-11,-10],[-7,-15],[-18,-55],[-75,-113],[-25,-66],[19,-61],[7,-25],[6,-73],[4,-20],[2,-9],[13,-23],[22,-25],[6,-14],[4,-27],[13,-157],[-3,-24],[-17,-53],[-14,-60],[-16,-37],[-5,-21],[6,-9],[4,3],[13,19],[16,-12],[-1,-1],[-4,-1],[32,-26],[30,-43],[18,-15],[45,-28],[12,-18],[0,-14],[-9,-34],[-1,-23],[4,-16],[16,-31],[1,-4],[2,-6],[-11,-27],[-20,10],[-23,22],[-17,11],[-11,4],[-19,29],[-10,11],[-11,1],[-22,-8],[-36,3],[-22,-2],[-21,3],[-25,19],[-37,47],[-20,7],[-21,-23],[-35,19],[-78,4],[-37,12],[-50,58],[-21,9],[-55,-2],[-47,16],[-8,7],[-2,11],[3,11],[0,12],[-11,13],[-9,2],[-23,-3],[-10,1],[-12,5],[-32,24],[-71,15],[-28,23],[-7,55],[-13,60],[-28,52],[-36,38],[-54,30],[-37,38],[-18,12],[-20,-4],[-17,-18],[-14,-19],[-11,-8],[-15,14],[-34,58],[-16,19],[-10,4],[-16,-4],[-7,1],[-10,8],[-19,20],[-10,8],[-19,5],[-71,-9],[-15,-7]],[[7376,724],[-1,1],[-1,4],[-36,114],[-18,125],[6,59],[-4,61],[-34,119],[-60,72],[-108,51],[-29,30],[17,43],[99,85],[-13,49],[-38,22],[-28,2],[-21,28],[-8,24],[-9,20],[1,66],[8,75],[-27,259],[6,96],[37,70],[31,81],[11,144]],[[3887,1797],[-16,4],[4,-39],[5,-2],[8,3],[9,-1],[7,-11],[2,-17],[-5,-8],[-33,-11],[-40,-1],[-18,-5],[-29,-29],[-37,-12],[-36,8],[-65,71],[-11,17],[-8,21],[-5,21],[-7,19],[-11,14],[-10,11],[-3,10],[3,9],[10,9],[0,1],[0,1],[0,2],[0,1],[-14,4],[-27,15],[-13,3],[-11,-2],[-9,-6],[-10,-2],[-15,8],[-49,68],[-2,12],[8,17],[10,7],[49,2],[26,11],[43,28],[20,19],[9,26],[-15,32],[-11,11],[-2,18],[2,15],[11,32],[2,6],[1,5],[-1,4],[-2,4],[-19,28],[-5,5],[-17,7],[-7,-4],[-2,-12],[-6,-14],[-29,-45],[-17,-15],[-24,-7],[-89,17],[-47,-5],[-30,-39],[-5,-3],[-5,-2],[-5,2],[-5,3],[-10,32],[-21,20],[-23,-2],[-10,-32],[-14,12],[-7,17],[-2,22],[2,22],[-5,4],[-4,5],[-4,6],[-2,7],[18,8],[-21,9],[-46,-1],[-24,7],[-35,25],[-10,11],[-6,15],[-6,22],[-4,19],[3,5],[-12,4],[-31,-7],[-13,0],[-13,7],[-23,22],[-11,7],[-103,31],[-23,-3],[-15,10]],[[7376,724],[-19,-8],[-14,5],[-37,-9],[-17,-1],[-97,31],[-56,33],[-14,4],[-18,-14],[-31,-51],[-17,-18],[-22,-4],[-15,11],[-14,18],[-18,14],[-16,2],[-40,-10],[-15,-8],[-21,-25],[13,-16],[23,-15],[12,-26],[-8,-16],[-19,-4],[-21,0],[-16,-4],[-20,-22],[-33,-54],[-21,-21],[-24,-9],[-18,4],[-16,13],[-17,19],[-18,16],[-16,2],[-17,-1],[-22,4],[-16,13],[-89,118],[-15,4],[-38,-7],[-22,3],[-9,0],[-10,-7],[-16,-22],[-11,-12],[-24,-9],[-22,6],[-84,48],[-16,-4],[1,-30],[-52,-2],[-41,18],[-12,-1],[-10,-8],[-4,-11],[-2,-16],[-5,-24],[-7,-24],[-5,-7],[-77,-8],[-15,-10],[-22,-29],[-10,-10],[-22,3],[-2,3],[-6,-9],[-19,-48],[-6,-20],[-7,-19],[-12,-17],[-6,-60],[-10,-42],[-19,-17],[-34,18],[-51,54],[-28,16],[-32,-4],[-18,-15],[-19,-22],[-14,-17],[-22,-9],[-46,4],[-26,11],[-13,19],[1,1],[4,22],[37,69],[5,4],[6,2],[6,4],[2,10],[-2,7],[0,1],[-8,9],[-1,4],[-1,0],[-13,11],[-4,6],[1,7],[8,13],[1,7],[-6,83],[-5,28],[-9,33],[-9,8],[-34,-15],[-20,-3],[-22,3],[-57,22],[2,20],[0,27],[1,10],[5,10],[-40,1],[-21,6],[-17,15],[-5,12],[-16,54],[-19,87],[-12,34],[-23,17],[-8,9],[-16,33],[-9,4]]],"transform":{"scale":[0.001002023542254234,0.000584489561156115],"translate":[14.12392297300002,48.99401316400011]}};
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
