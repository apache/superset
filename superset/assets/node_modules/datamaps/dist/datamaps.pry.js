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
  Datamap.prototype.polTopo = '__POL__';
  Datamap.prototype.priTopo = '__PRI__';
  Datamap.prototype.prkTopo = '__PRK__';
  Datamap.prototype.prtTopo = '__PRT__';
  Datamap.prototype.pryTopo = {"type":"Topology","objects":{"pry":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Asunción"},"id":"PY.AS","arcs":[[0,1,2]]},{"type":"Polygon","properties":{"name":"Alto Paraguay"},"id":"PY.AG","arcs":[[3,4,5,6]]},{"type":"Polygon","properties":{"name":"Boquerón"},"id":"PY.BQ","arcs":[[7,8,-6]]},{"type":"Polygon","properties":{"name":"Concepción"},"id":"PY.CN","arcs":[[9,10,11,-4,12]]},{"type":"Polygon","properties":{"name":"Cordillera"},"id":"PY.CR","arcs":[[13,14,15,16,17]]},{"type":"Polygon","properties":{"name":"Presidente Hayes"},"id":"PY.PH","arcs":[[-12,18,-17,19,-2,20,-8,-5]]},{"type":"Polygon","properties":{"name":"San Pedro"},"id":"PY.SP","arcs":[[21,22,-18,-19,-11,23]]},{"type":"Polygon","properties":{"name":"Central"},"id":"PY.CE","arcs":[[-16,24,25,26,-3,-20]]},{"type":"Polygon","properties":{"name":"Guairá"},"id":"PY.GU","arcs":[[27,28,29]]},{"type":"Polygon","properties":{"name":"Misiones"},"id":"PY.MI","arcs":[[30,31,32,33,34]]},{"type":"Polygon","properties":{"name":"Ñeembucú"},"id":"PY.NE","arcs":[[35,-34,36,-26]]},{"type":"Polygon","properties":{"name":"Paraguarí"},"id":"PY.PG","arcs":[[37,-29,38,-35,-36,-25,-15]]},{"type":"Polygon","properties":{"name":"Amambay"},"id":"PY.AM","arcs":[[39,-24,-10,40]]},{"type":"Polygon","properties":{"name":"Alto Paraná"},"id":"PY.AA","arcs":[[41,42,43,44,45]]},{"type":"Polygon","properties":{"name":"Caaguazú"},"id":"PY.CG","arcs":[[46,-30,-38,-14,-23,47,-45]]},{"type":"Polygon","properties":{"name":"Caazapá"},"id":"PY.CZ","arcs":[[48,-31,-39,-28,-47,-44]]},{"type":"Polygon","properties":{"name":"Canindeyú"},"id":"PY.CY","arcs":[[-46,-48,-22,-40,49]]},{"type":"Polygon","properties":{"name":"Itapúa"},"id":"PY.IT","arcs":[[-43,50,-32,-49]]}]}},"arcs":[[[6011,2630],[-51,37],[-1,15],[-36,85],[-1,0]],[[5922,2767],[26,30],[14,11],[17,9],[34,10],[15,7]],[[6028,2834],[29,-26],[18,-30],[5,-45],[-11,-48],[-30,-30],[-28,-25]],[[5564,6633],[-9,-11],[8,-51],[9,-19],[-13,-75],[4,-29],[10,-27],[11,-15],[19,-6],[30,-1],[22,-5],[11,-13],[12,-40],[55,-65],[5,-14],[-22,-19],[-7,-9],[3,-13]],[[5712,6221],[-411,171],[-17,10],[-9,13],[-9,57],[-16,12],[-31,8],[-559,36],[-62,-7],[-254,20],[-183,-6],[-19,1],[-28,7],[-45,18],[-134,69]],[[3935,6630],[-58,34],[-35,10],[-429,16],[-66,-10],[-110,-2],[-10,4],[-4,12],[-1,37],[-19,111],[0,11],[2,16],[17,48],[107,452],[6,12],[7,11],[17,18],[18,14],[120,68],[7,6],[4,4],[2,5],[3,6],[1,8],[1,11],[0,11],[-49,309],[-11,26],[-7,11],[-64,85],[-24,41],[-4,9],[0,9],[4,32],[0,10],[0,11],[-8,29],[-6,15],[-14,24],[-25,31],[-5,7],[-1,8],[0,5],[24,94],[-31,22],[-83,34],[-2222,626],[-110,67],[-16,13]],[[863,9061],[8,15],[15,32],[15,31],[1,0],[33,88],[33,89],[34,88],[33,89],[23,59],[9,14],[19,8],[106,15],[26,4],[56,8],[56,9],[26,3],[402,84],[403,84],[403,83],[402,84],[179,37],[98,2],[224,2],[224,3],[224,3],[225,3],[96,1],[24,-6],[35,-24],[34,-23],[60,-36],[111,-66],[111,-66],[111,-66],[111,-66],[111,-66],[111,-65],[111,-66],[111,-66],[47,-28],[13,-14],[4,-17],[-4,-40],[2,-39],[21,-69],[4,-37],[-4,-27],[2,-51],[-2,-25],[-18,-64],[1,-31],[1,-19],[7,-5],[10,2],[8,-3],[9,-8],[11,-14],[2,-13],[-43,-14],[-9,-20],[7,-22],[23,-16],[7,2],[6,7],[7,7],[13,1],[8,-5],[9,-9],[6,-12],[-12,-33],[3,-30],[8,-30],[10,-20],[18,-21],[26,-19],[27,-14],[22,-5],[18,-10],[-3,-21],[-19,-35],[-3,-25],[2,-31],[5,-29],[13,-28],[1,-14],[-1,-26],[3,-17],[16,-23],[5,-14],[0,-13],[-9,-23],[0,-14],[8,-13],[11,-9],[10,2],[11,41],[16,10],[19,-3],[16,-11],[5,-8],[7,-18],[4,-7],[8,-7],[18,-12],[11,-10],[3,-12],[-9,-9],[-14,-6],[-26,-5],[-10,-6],[-13,-15],[-18,-12],[-9,-11],[8,-8],[31,-2],[24,-5],[20,-13],[13,-18],[3,-22],[-12,-12],[-49,-26],[-11,-16],[4,-13],[8,-6],[8,-2],[3,-3],[7,0],[27,-22],[27,-28],[8,0],[5,21],[22,-18],[2,-26],[-11,-28],[-32,-48],[1,-17],[18,-36],[8,-54],[-5,-56],[-17,-51],[-27,-38],[-34,-24],[-6,-9],[-1,-15],[6,-9],[8,-7],[3,-6],[10,-13],[19,-6],[13,-11],[-9,-32],[-79,-116],[-19,-41],[-4,-25],[1,-27],[10,-21],[22,-9],[11,-10],[-9,-24],[-15,-28],[-8,-20],[5,-21],[12,-21],[15,-18],[13,-7],[6,-11],[-51,-81],[0,-23],[5,-22],[-1,-23],[-16,-26],[-8,-21],[11,-18],[16,-19],[9,-28],[-5,-15],[-28,-49],[-11,-11],[-3,-12],[-26,-70],[-2,-17],[1,-18],[2,-12],[15,-8]],[[3935,6630],[42,-119],[4,-16],[-4,-7],[-18,-15],[-74,-43],[-28,-13],[-7,0],[-8,2],[-9,5],[-10,7],[-11,10],[-9,6],[-12,6],[-17,-4],[-16,-5],[-123,-70],[-16,-14],[-10,-13],[-6,-14],[-2,-7],[-2,-12],[0,-9],[3,-10],[15,-28],[2,-8],[-1,-9],[-9,-16],[-13,-7],[-18,-4],[-68,0],[-20,-3],[-17,-9],[-7,-10],[-3,-13],[8,-56],[0,-5],[-3,-19],[-7,-15],[-230,-321],[-11,-24],[-4,-20],[0,-30],[-3,-16],[-11,-39],[-3,-13],[5,-61],[-3,-55],[9,-57],[-3,-20],[-6,-25],[-33,-82],[1,-8],[2,-9],[10,-21],[4,-14],[-4,-20],[-13,-35],[-54,-102],[-15,-43],[-11,-47],[-11,-107],[0,-1],[-10,-6],[-118,-59],[-28,-11],[-42,-7],[-385,-20],[-16,-3],[-16,-7],[-38,-19],[-42,-17],[-86,-13],[-16,-5],[-20,-9],[-10,-10],[-7,-11],[-8,-43],[-5,-14],[-16,-25],[-3,-8],[-1,-8],[6,-154],[0,-1]],[[2216,4473],[-35,0],[-24,2],[-35,20],[-40,30],[-43,20],[-46,-12],[-37,22],[-11,11],[-18,27],[-7,6],[-2,17],[-14,25],[-19,22],[-32,17],[-20,32],[-11,11],[11,20],[4,27],[-4,24],[-15,11],[-21,7],[-17,15],[-16,16],[-15,11],[-9,2],[-24,-2],[-8,0],[-11,8],[-23,21],[-10,5],[-25,7],[-12,16],[-7,19],[-10,16],[-77,32],[-28,1],[-16,4],[-12,8],[-14,12],[-18,12],[-19,8],[-22,4],[-26,1],[-11,6],[-11,29],[-19,11],[1,12],[6,14],[5,10],[-21,1],[-14,2],[-10,5],[-61,59],[-17,8],[-56,0],[-16,4],[-10,6],[-19,19],[-16,11],[-18,7],[-13,11],[-5,21],[-1,22],[-4,14],[-7,12],[-13,14],[-13,11],[-27,14],[-13,12],[-27,37],[-10,9],[-132,75],[-43,44],[-16,23],[-1,6],[-3,5],[6,28],[-3,12],[-13,18],[-22,44],[-17,25],[-26,25],[-10,14],[-5,14],[-6,1],[-11,7],[-11,9],[-1,4],[-8,4],[-5,9],[-3,11],[-4,9],[-33,34],[-7,12],[-6,14],[-7,10],[-16,5],[-5,6],[14,28],[-22,14],[0,16],[8,26],[-6,13],[-4,2],[-7,-1],[-15,3],[-30,13],[-15,12],[0,15],[17,22],[6,20],[-9,22],[-27,29],[-6,1],[-8,0],[-7,2],[-3,8],[0,14],[-1,6],[-3,5],[-9,5],[-13,4],[-42,5],[-9,2],[-23,8],[-83,54],[-21,19],[-8,18],[-10,8],[-48,14],[-15,7],[-29,35],[-20,16],[-28,7],[-14,2],[-16,4],[-14,8],[-9,11],[2,10],[8,10],[5,13],[-8,16],[9,0],[-7,9],[-8,8],[-10,6],[-12,2],[27,60],[34,114],[31,107],[52,164],[43,136],[56,175],[41,128],[43,140],[42,134],[38,125],[39,124],[4,79],[0,1],[-2,175],[-1,116],[-2,106],[-1,109],[10,32],[43,63],[26,36],[25,34],[53,73],[53,74],[54,73],[53,73],[20,29],[19,29],[20,29],[20,28],[15,31],[8,16]],[[6909,6382],[10,-11],[252,-59],[48,-18],[-5,-4],[-27,-13],[-7,-5],[-51,-68],[-8,-7],[-39,-24],[-6,-7],[-5,-6],[-3,-7],[-1,-9],[5,-26],[-1,-9],[-4,-7],[-12,-8],[-3,-6],[1,-9],[6,-24],[1,-7],[-2,-23],[3,-22],[0,-14],[-2,-11],[-4,-10],[-2,-13],[3,-11],[5,-9],[11,-14],[3,-9],[-1,-8],[-4,-18],[3,-9],[6,-5],[6,-4],[7,-5],[7,-8],[10,-15],[10,-24],[9,-49],[8,-22],[-2,-12],[-5,-8],[-26,-16],[-8,-9],[-7,-9],[-3,-15],[1,-4],[5,-1],[7,0],[16,0],[22,2],[6,2],[6,3],[9,9],[5,2],[8,-1],[8,-5],[10,-11],[8,-5],[7,-5],[7,-2],[8,-1],[7,1],[7,2],[23,10],[13,3],[6,2],[4,5],[10,18],[12,15],[4,6],[2,7],[4,23],[2,7],[4,11],[1,2],[1,2],[8,7],[10,7],[6,3],[6,2],[63,11],[6,2],[12,5],[5,4],[4,4],[8,10],[14,23],[4,5],[5,4],[5,3],[6,3],[14,3],[6,2],[6,3],[30,22],[5,3],[7,1],[6,0],[7,-2],[18,-6],[5,-7],[4,-6],[171,-417],[1,-7],[-2,-13],[-2,-43],[-1,-7],[-3,-6],[-4,-4],[-6,-3],[-7,0],[-6,2],[-12,5],[-5,0],[-5,-2],[-3,-5],[-2,-7],[1,-8],[2,-12],[-1,-6],[-5,-3],[-6,-2],[-5,-4],[-3,-5],[-3,-6],[-2,-7],[0,-8],[0,-10],[4,-17],[1,-10],[-3,-7],[-4,-3],[-46,-23],[-11,-7],[-4,-4],[-5,-4],[-3,-6],[-5,-11],[-5,-5],[-10,-6],[-5,-4],[-5,-4],[-3,-5],[-3,-6],[-2,-6],[-3,-30],[-3,-12],[-2,-3],[-2,-4],[-2,-3],[-6,-4]],[[7553,5117],[-38,-15],[-15,-17],[-10,-16],[-16,-11],[-16,-14],[-28,-14],[-9,-1],[-7,1],[-8,1],[-10,0],[-48,-12],[-53,-25],[-8,-3],[-12,0],[-17,-1],[-38,-9],[-18,-1],[-11,1],[-8,8],[-9,3],[-15,1],[-31,-3],[-16,0],[-11,1],[-29,15],[-12,1],[-17,1],[-69,-3],[-60,13],[-29,3],[-10,-1],[-8,-3],[-10,-9],[-8,-5],[-8,-2],[-10,-1],[-30,2],[-12,-2],[-17,-4],[-23,-9],[-9,-2],[-7,0],[-10,3],[-9,2],[-12,2],[-9,-1],[-7,-3],[-5,-3],[-5,-4],[-9,-5],[-52,-15],[-85,-13],[-56,1],[-12,-2],[-9,-3],[-20,-10],[-24,-8],[-13,-3],[-9,-1],[-3,1],[-79,-5],[-8,0],[-13,3],[-6,2],[-30,16],[-6,3],[-6,3],[-14,5],[-31,4]],[[6191,4954],[5,12],[0,9],[-5,12],[-8,36],[-1,10],[-3,6],[-17,12],[-8,14],[-21,18],[-7,12],[-3,17],[2,8],[7,8],[10,16],[6,13],[3,7],[-1,26],[-4,7],[-20,18],[-12,9],[-29,36],[-11,9],[-8,5],[-44,20],[-24,15],[-19,18],[-8,19],[1,26],[-2,20],[-9,15],[-22,9],[-48,0],[-19,7],[-7,23],[-11,14],[-53,24],[-18,16],[26,48],[-7,25],[-15,19],[-40,35],[-2,12],[12,11],[15,11],[11,12],[1,14],[-5,11],[-12,16],[-7,21],[-4,6],[-9,10],[-11,4],[-27,-1],[-11,5],[-8,13],[-6,29],[-6,12],[-10,5],[-27,7],[-12,5],[-26,37],[13,36],[40,26],[54,8],[52,-9],[26,1],[12,12],[-6,26],[-13,20],[-30,33],[-17,37],[-15,136],[-7,28]],[[5564,6633],[1,0],[13,-11],[11,-19],[15,-15],[40,-13],[13,0],[20,8],[8,1],[10,-5],[17,-18],[6,-4],[14,3],[19,16],[13,-1],[12,-2],[9,1],[14,7],[-2,2],[0,6],[2,7],[3,5],[4,0],[11,-4],[5,0],[24,8],[15,-1],[16,-4],[24,-1],[14,3],[9,5],[8,2],[11,-5],[19,-48],[14,-25],[15,-14],[21,-5],[29,4],[10,4],[5,4],[6,1],[15,-1],[9,-4],[28,-17],[46,10],[10,0],[25,-9],[13,-1],[17,-6],[39,-24],[7,0],[5,8],[10,-3],[18,-9],[13,0],[7,6],[2,8],[1,4],[19,-2],[53,-12],[23,4],[29,23],[17,4],[5,-5],[3,-19],[9,-6],[11,-1],[7,3],[7,5],[9,2],[20,-3],[35,-13],[11,-5],[1,-3],[1,-5],[6,-5],[21,-3],[7,-2],[7,-1],[9,3],[14,4],[38,-3],[20,2],[29,-9],[13,-1],[13,8],[-1,-19],[6,-5],[10,2],[11,-1],[21,-10],[12,0],[13,31],[14,-18],[13,-31],[2,-15],[28,-4],[16,5]],[[7323,3090],[-58,-319],[-24,-75],[-292,-189],[-7,-9],[1,-11],[7,-15],[68,-131],[1,-3],[5,-9]],[[7024,2329],[-50,18],[-9,1],[-12,1],[-13,-6],[-12,-7],[-8,-6],[-8,-5],[-8,-4],[-9,-2],[-8,-1],[-37,2],[-10,3],[-8,5],[-3,8],[0,5],[5,4],[15,12],[14,15],[3,6],[2,6],[0,5],[-2,5],[-7,14],[-4,9],[-6,31],[-4,10],[-7,8],[-16,4],[-12,0],[-88,-5],[-10,1],[-21,4],[-28,9],[-14,2],[-32,2],[-18,11],[-11,10],[-59,100]],[[6529,2604],[-24,36],[-13,14],[-8,1],[-5,-1],[-6,-4],[-8,-8],[-5,-3],[-7,-1],[-8,0],[-9,3],[-8,5],[-11,15],[-42,70],[-7,23],[-3,18],[-7,15],[-15,21],[-36,36],[-36,58],[-12,10],[-47,29],[-4,3],[-27,37]],[[6181,2981],[39,0],[8,5],[23,23],[10,5],[11,2],[14,6],[15,8],[12,8],[58,71],[11,28],[28,3],[33,-7],[25,-3]],[[6468,3130],[22,-14],[78,-33],[40,-11],[22,-3],[22,2],[24,8],[13,8],[7,8],[2,6],[0,5],[0,4],[-2,8],[0,5],[0,6],[2,7],[2,4],[4,4],[11,7],[9,4],[16,5],[188,32],[65,18],[80,8],[19,-2],[111,-41],[20,-13],[44,-46],[6,-3],[6,-5],[44,-18]],[[6191,4954],[-2,-14],[-11,-22],[-3,-13],[0,-15],[6,-26],[1,-13],[4,-17],[29,-53],[33,-33],[86,-45],[37,-29],[17,-20],[6,-10],[0,-12],[-7,-11],[-21,-8],[-4,-9],[4,-12],[9,-8],[9,-7],[4,-7],[-1,-9],[-8,-36],[-4,-38],[-4,-11],[-28,-18],[-4,-3],[-4,-6],[-9,-9],[-9,-12],[-4,-15],[6,-8],[15,-2],[16,0],[12,-2],[21,-25],[6,-29],[2,-32],[12,-30],[23,8],[20,-12],[10,-21],[-8,-20],[-8,-10],[-1,-13],[5,-10],[12,-4],[42,2],[11,-2],[19,-23],[-11,-24],[-21,-24],[-9,-20],[-22,-23],[-5,-6],[-1,-5],[0,-8],[1,-15],[4,-10],[5,-9],[23,-23],[9,-13],[13,-22],[5,-16],[6,-75],[10,-35],[12,-86],[6,-17],[14,-30],[-2,-12],[-11,-39],[-5,-49],[1,-24],[4,-16],[9,-16],[8,-15],[16,-9],[19,-15],[8,-19],[-26,-48],[-5,-23],[-7,-19],[-18,-12],[-14,-1],[-10,4],[-11,2],[-14,-5],[-4,-9],[-18,-69],[-61,-78],[0,-7],[10,-11],[11,-1],[10,6],[8,1],[3,-19],[-3,-13],[-4,-11],[1,-11],[10,-14],[14,-14],[4,-10],[-5,-8],[-17,-5]],[[6181,2981],[-35,0],[-33,6],[-14,-2],[-6,-16],[-4,-31],[-11,-33],[-16,-32],[-18,-25],[-16,-14]],[[5922,2767],[-36,23],[-23,30],[-38,78],[-14,16],[-38,17],[-18,12],[-52,57],[-17,14],[-23,8],[-95,0],[-16,5],[-8,12],[-4,14],[-8,10],[-11,2],[-27,-3],[-12,1],[-82,38],[-15,0],[-12,18],[-107,68],[-22,0],[-20,-14],[-33,-32],[-15,-10],[-15,-7],[-13,-2],[-15,4],[-7,7],[-3,9],[-8,12],[-76,79],[-28,37],[-15,13],[-27,12],[-263,48],[-6,6],[-3,9],[-7,5],[-9,4],[-9,6],[-17,5],[-61,1],[-24,6],[-228,160],[-38,9],[-12,7],[-24,22],[-11,7],[-8,1],[-22,1],[-24,8],[-44,27],[-28,9],[-34,22],[-50,16],[-11,8],[-6,8],[-9,7],[-18,2],[-11,4],[-16,17],[-39,14],[-20,22],[-24,43],[-11,11],[-46,38],[-29,12],[-4,10],[-3,11],[-4,8],[-8,6],[-26,11],[-27,14],[-12,9],[-13,14],[-10,6],[-22,4],[-20,12],[-30,3],[-12,4],[-8,8],[-21,26],[-46,43],[-428,264],[-22,5],[-24,-3],[-56,-18],[-28,-6],[-90,-3],[-93,13],[-37,-2],[-11,2],[-13,7],[-23,19],[-13,8],[-11,1],[-42,-1],[-74,13],[-39,26],[-22,10],[-42,2],[-7,2],[-19,39],[-1,7],[-11,2],[-21,11],[-13,4],[-14,1],[-54,-3],[-12,3],[-24,20],[-12,3],[-69,-2]],[[7841,4503],[73,-182],[7,-27],[-3,-9],[-7,2],[-3,0],[-5,0],[-5,-2],[-5,-3],[-18,-16],[-15,-20],[-27,-24],[-16,-19],[-4,-4],[-6,-2],[-29,-6],[-6,-3],[-6,-3],[-5,-4],[-23,-29],[-4,-6],[-5,-19],[1,-26],[-7,-57],[0,-23],[2,-15],[26,-21],[6,-6],[5,-12],[3,-13],[6,-39],[4,-19],[7,-15],[7,-11],[8,-10],[10,-9],[10,-6],[10,-5],[23,-7],[9,-4],[7,-6],[5,-8],[25,-53],[63,-81],[26,-49],[17,-50],[12,-26],[14,-17],[35,-20],[20,-16],[23,-23],[10,-27],[9,-18],[8,-12],[11,-10],[64,-35]],[[8208,3378],[-141,-35],[-95,-36],[-25,-19],[-17,-19],[-52,-96],[-11,-14],[-10,-8],[-10,4],[-55,48],[-41,42],[-8,6],[-7,4],[-55,19],[-12,8],[-8,8],[-4,9],[0,10],[1,9],[4,18],[0,13],[-6,15],[-15,12],[-11,1],[-12,-6],[-12,-11],[-10,-12],[-8,-15],[-5,-15],[-11,-16],[-16,-15],[-51,-28],[-13,-10],[-7,-13],[-6,-12],[-9,-14],[-11,-11],[-37,-19],[-12,-7],[-87,-83]],[[7553,5117],[13,-9],[5,2],[10,4],[13,9],[28,14],[22,6],[25,3],[13,3],[11,6],[6,0],[19,-5],[16,-2],[50,-3],[17,-4],[10,-6],[10,-8],[5,-8],[3,-8],[0,-7],[-3,-8],[-6,-12],[-2,-6],[1,-6],[6,-8],[20,-16],[5,-5],[5,-8],[3,-8],[2,-7],[0,-4],[-1,-7],[-3,-6],[-8,-11],[-10,-11],[-98,-76],[-4,-6],[0,-8],[3,-10],[6,-16],[9,-20],[22,-36],[15,-15],[12,-8],[6,0],[6,3],[19,14],[8,6],[13,6],[7,4],[4,6],[3,7],[1,11],[0,17],[1,7],[5,4],[10,4],[73,13],[16,1],[12,-2],[3,-5],[1,-5],[-3,-14],[-1,-16],[4,-44],[-1,-7],[-1,-7],[-8,-17],[-8,-10],[-12,-13],[-27,-33],[-2,-5],[1,-6],[5,-19],[4,-29],[-1,-31],[-1,-7],[-1,-7],[-5,-12],[-21,-36],[-6,-20],[-3,-4],[-2,-3],[-40,-27],[-12,-5],[-9,-2]],[[6529,2604],[-48,-28],[-35,-28],[-8,-10],[-100,-148],[-39,-41],[-42,-38],[-14,-18],[-13,-24],[-15,-42],[-4,-35],[1,-27],[28,-83],[2,-21],[-4,-26],[-32,-56],[-27,-32],[-56,-49]],[[6123,1898],[-16,34],[-30,36],[-6,12],[-4,11],[-2,12],[-4,8],[-5,5],[-24,10],[-13,6],[-31,25],[-28,16],[-26,21],[-16,16],[-16,20],[-10,7],[-7,4],[-8,0],[-25,-6],[-7,0],[-8,1],[-24,8],[-6,1],[-6,-1],[-5,-4],[-3,-5],[-1,-10],[2,-21],[-1,-8],[-1,-5],[-7,-4],[-6,-2],[-28,6],[-4,2]],[[5747,2093],[8,5],[13,17],[-18,41],[-4,23],[18,10],[21,7],[23,16],[20,19],[13,15],[-13,3],[-11,5],[-9,7],[-8,10],[25,35],[15,13],[25,10],[14,1],[12,-1],[12,1],[11,7],[5,9],[6,27],[2,6],[35,-5],[19,1],[8,7],[5,28],[13,9],[16,4],[14,13],[7,22],[15,104],[-1,20],[-9,16],[-16,16],[-22,16]],[[8358,2333],[-7,-13],[-3,-5],[-9,-17],[-16,-39],[-7,-12],[-11,-10],[-15,-4],[-11,1],[-10,3],[-11,1],[-13,-3],[-17,-14],[-9,-11],[-12,-23],[-6,-7],[-16,-8],[-107,-40],[-15,-9],[-30,-21],[-13,-6],[-43,-8],[-14,-6],[-22,-18],[-15,-8],[-39,-10],[-15,-7],[-11,-12],[-6,-12],[-25,-93],[-3,-10],[-2,-2],[-2,-2],[-29,-19],[-67,-30],[-22,2],[-47,28],[-33,24],[-6,4],[-9,4],[-15,0],[-17,-4],[-58,-24],[-12,0],[-8,2],[-8,4],[-7,0],[-10,-4],[-10,-15],[-4,-14],[-2,-15],[-5,-13],[-9,-9],[-20,-7],[-58,-2],[-17,-5],[-13,-9],[-12,-20],[-8,-21],[-8,-53],[-10,-10],[-17,-6],[-30,4],[-38,0]],[[7214,1700],[-80,134],[-7,15],[-5,18],[-6,46],[-1,2],[-1,7],[2,7],[7,9],[8,4],[50,11],[12,6],[6,12],[0,18],[-11,34],[-11,18],[-28,33],[-9,14],[-8,18],[-12,38],[-7,37],[-1,21],[2,20],[8,21],[20,18]],[[7142,2261],[26,14],[65,29],[12,7],[57,49],[16,9],[20,7],[37,6],[16,4],[14,5],[35,21],[21,6],[23,2],[135,-5],[33,2],[18,0],[35,-6],[96,-4],[13,-6],[10,-9],[14,-7],[19,-3],[127,3],[22,-3],[25,-10],[16,-10],[13,-13],[25,-27],[15,-13],[16,-8],[30,-2],[38,5],[72,20],[71,27],[11,0],[6,-2],[14,-16]],[[6980,1260],[34,-20],[7,-7],[10,-15],[10,-17],[22,-33],[19,-16],[51,-31],[18,-8],[17,-3],[37,0],[21,-6],[10,-10],[2,-10],[-2,-11],[-6,-13],[-1,-6],[-1,-2],[3,-11]],[[7231,1041],[48,-438],[-3,-42],[-11,-20],[-60,-7],[-9,-3],[-11,-6],[-31,-32],[-10,-8],[-12,-6],[-11,-12],[-11,-19],[-16,-50],[-4,-25],[2,-20],[8,-11],[8,-8],[42,-36],[6,-7],[4,-9],[0,-7],[-4,-7],[-4,-5],[-5,-10],[-1,-7],[6,-84],[1,-1]],[[7153,161],[-54,-14],[-61,-43],[-44,-8],[0,1],[-43,24],[-74,66],[-41,16],[-44,-5],[-43,-15],[-118,-59],[-39,-8],[-46,2],[-11,1],[-27,1],[-1,0],[-13,4],[-11,6],[-31,24],[-12,6],[-1,0],[-54,13],[-11,3],[-13,6],[-8,8]],[[6353,190],[1,1],[21,80],[107,275],[7,46],[-9,19],[-34,8],[-217,30],[-9,5],[-137,145],[-98,127],[-11,24],[-7,21],[-84,444]],[[5883,1415],[40,-19],[20,-26],[8,-5],[14,-7],[7,-8],[6,-11],[8,-22],[5,-8],[7,-9],[31,-16],[8,-8],[7,-10],[9,-10],[16,-8],[87,-17],[15,-8],[8,-10],[13,-11],[16,-8],[32,-7],[19,-13],[26,-10],[32,-3],[105,21],[61,20],[16,9],[7,12],[2,14],[0,18],[2,16],[7,11],[10,7],[17,7],[9,6],[5,5],[1,5],[4,6],[7,8],[12,6],[6,6],[5,9],[3,11],[7,15],[11,15],[14,14],[18,13],[8,4],[9,3],[12,3],[12,1],[11,0],[11,-2],[9,-2],[70,-34],[26,-16],[39,-30],[22,-12],[22,-3],[14,4],[15,-5],[11,-4],[43,-62]],[[6123,1898],[33,-175],[-2,-13],[-5,-8],[-158,-145],[-46,-81],[-14,-19],[-25,-18],[-23,-24]],[[6353,190],[-19,17],[-11,7],[-25,6],[-5,1],[-31,0],[-120,-16],[-31,3],[-8,3],[-18,5],[-193,89],[-1,0],[-13,5],[-122,23],[-51,16],[-53,10],[-17,3],[-36,14],[-1,0],[-70,14],[-22,4],[-37,1],[-72,-12],[-18,-1],[-130,15],[-324,-25],[-107,-42],[-5,-4],[1,1],[5,59],[-2,25],[-15,23],[-30,20],[-16,14],[-7,16],[6,35],[17,24],[27,15],[61,9],[5,13],[-2,18],[0,22],[3,11],[4,9],[6,9],[7,9],[11,5],[1,0],[6,-5],[3,-9],[0,-4],[1,-3],[9,-5],[0,-1],[10,-2],[4,7],[1,20],[3,8],[4,9],[11,17],[21,24],[9,17],[-18,15],[-2,15],[10,16],[18,11],[53,13],[26,10],[11,15],[11,11],[28,3],[27,2],[16,12],[-8,21],[-22,14],[-14,17],[15,27],[20,5],[21,-6],[20,-3],[16,16],[-4,10],[-10,14],[-1,12],[19,5],[15,0],[9,1],[4,6],[4,94],[5,23],[6,14],[4,1],[6,-4],[37,-6],[15,0],[6,8],[-4,11],[-6,9],[-6,11],[0,14],[4,4],[20,14],[8,7],[-7,7],[-10,17],[-7,9],[-27,18],[-7,7],[-4,20],[3,18],[7,19],[3,21],[4,10],[17,11],[4,12],[-29,25],[-4,15],[8,19],[40,65],[6,17],[3,20],[-6,38],[0,20],[10,8],[19,4],[27,11],[20,14],[-1,16],[-17,12],[-19,8],[-14,13],[-3,21],[12,-4],[10,-5],[6,-7],[5,-9],[10,14],[11,25],[11,40],[12,11],[78,26],[39,21],[138,94],[15,20],[0,16],[-55,14],[9,19],[42,31],[7,9],[7,14],[-1,13],[-27,9],[-4,8],[4,9],[25,9],[25,12],[16,11]],[[7024,2329],[37,-25],[26,-30],[10,-6],[7,-3],[38,-4]],[[7214,1700],[-9,-39],[-6,-11],[-41,-43],[-9,-14],[-12,-45],[-4,-43],[-3,-11],[-6,-9],[-24,-16],[-5,-7],[-2,-7],[1,-12],[2,-10],[-1,-12],[-5,-13],[-16,-15],[-7,-9],[-5,-14],[-1,-14],[-6,-15],[-10,-14],[-23,-18],[-14,-9],[-17,-13],[-11,-27]],[[8466,4887],[0,-1],[-12,-8],[-12,-17],[-21,-54],[-10,-47],[-8,-12],[-13,-12],[-49,-27],[-10,-4],[-11,-2],[-33,-1],[-18,-7],[-25,-14],[-123,-84],[-51,-27],[-12,-11],[-17,-27],[-7,-8],[-11,-7],[-31,-12],[-30,-6],[-42,-4],[-9,-3],[-10,-5],[-7,-2],[-6,-1],[-8,1],[-7,2],[-18,7],[-14,9]],[[6909,6382],[27,29],[8,11],[2,8],[4,2],[16,-6],[9,1],[39,11],[9,-2],[2,-5],[2,-2],[12,7],[6,8],[9,22],[6,5],[20,-10],[41,-44],[19,-4],[5,10],[-12,21],[7,8],[14,3],[9,5],[40,28],[13,13],[20,34],[3,3],[9,4],[4,5],[6,19],[4,8],[18,25],[11,11],[12,10],[21,6],[86,15],[17,-2],[12,-13],[31,-73],[28,-40],[37,-33],[66,-37],[35,-32],[21,-12],[20,-5],[205,-10],[16,4],[15,8],[16,-7],[17,-13],[19,-9],[74,-6],[22,-13],[3,9],[13,25],[60,-77],[48,-34],[12,-13],[10,-29],[4,-102],[8,-44],[21,-39],[31,-31],[39,-21],[25,-8],[15,-9],[9,-14],[4,-25],[-1,-9],[-7,-20],[-1,-10],[3,-11],[8,-19],[1,-11],[-13,-40],[-20,-35],[-16,-36],[3,-45],[27,-93],[0,-21],[-7,-41],[2,-20],[32,-34],[13,-19],[6,-23],[-6,-44],[1,-20],[13,-16],[33,-19],[4,-11],[26,-89],[0,-20],[-28,-55],[-4,-20],[8,-27],[37,-37],[13,-22],[-2,-37],[-32,-67],[3,-42],[7,-36]],[[9864,3440],[-15,-43],[-34,-46],[-9,-19],[-54,-219],[-11,-42],[-2,-22],[1,-20],[9,-24],[31,-46],[3,-23],[-10,-21],[-41,-34],[-14,-22],[-26,-78],[-30,-43],[-22,-27],[-34,-29],[-27,-45],[-14,-42],[-2,-14],[-1,-25],[5,-27],[12,-22],[8,-23],[-3,-29],[-7,-29],[0,-2],[-3,-21],[19,-39],[4,-25],[-18,-10],[-42,2],[-11,-12],[0,-31],[21,-63],[4,-24],[6,-17],[27,-30],[7,-14],[-2,-27],[-11,-22],[-13,-19],[-6,-19],[9,-55],[1,-22],[-10,-18],[-10,-3],[-29,-2],[-10,-4],[-7,-13],[1,-12],[4,-13],[6,-36],[12,-39],[0,-27],[-25,-77],[5,-18],[21,-24],[4,-16],[-7,-13],[-14,-18],[-10,-16],[0,-3]],[[9500,1624],[-1,0],[-2,0],[-68,5],[-13,3],[-7,7],[-3,8],[0,8],[1,8],[0,6],[-1,5],[-3,4],[-4,4],[-6,4],[-23,11],[-18,6],[-22,4],[-19,0],[-9,-3],[-10,-5],[-16,-13],[-7,-4],[-7,-2],[-9,-1],[-9,3],[-11,8],[-3,7],[1,8],[5,17],[1,6],[-1,6],[-2,3],[-4,2],[-5,0],[-8,-3],[-5,-4],[-7,-7],[-9,-12],[-18,-30],[-5,-5],[-8,-8],[-8,-4],[-7,-3],[-16,-4],[-40,-3],[-7,-8],[-5,-5],[-4,-9],[-2,-3],[-3,-2],[-4,-3],[-8,1],[-9,4],[-18,13],[-13,6],[-38,9],[-30,12],[-12,3],[-10,2],[-23,1],[-88,-4],[-25,21],[-41,117]],[[8754,1811],[63,34],[9,9],[6,11],[0,10],[-8,9],[-8,4],[-9,2],[-22,2],[-10,3],[-7,5],[-7,7],[-4,5],[-5,5],[-7,5],[-7,1],[-38,-11],[-21,-3],[-34,-2],[-28,1],[-10,-2],[-16,-7],[-9,2],[-9,3],[-16,8],[-50,18],[-5,4],[-7,10],[-4,13],[4,33],[0,11],[-8,24],[0,12],[4,13],[-4,12],[-6,8],[-6,9],[0,13],[8,22],[23,48],[4,4],[25,19],[7,9],[6,11],[18,53],[4,17],[2,27],[7,17],[9,12],[30,25],[7,10],[2,8],[-1,9],[-5,8],[-16,19],[-5,11],[-2,10],[0,9],[-3,7],[-6,6],[-16,4],[-11,1],[-43,-11]],[[8519,2447],[277,355],[35,36],[14,-1],[22,-14],[30,-28],[13,-6],[28,-10],[15,-3],[14,1],[-2,11],[-6,24],[-1,13],[8,-8],[11,-17],[8,-8],[9,-6],[9,-3],[21,-3],[16,-7],[10,-10],[4,-14],[2,-16],[16,-26],[31,-4],[31,-1],[27,7],[0,15],[-1,7],[-2,6],[-3,5],[-8,10],[-3,5],[-3,6],[-1,7],[0,7],[3,22],[-1,6],[-4,5],[-5,3],[-32,12],[-6,3],[-5,4],[-4,4],[-2,5],[0,6],[7,24],[1,7],[-1,7],[-3,5],[-5,4],[-100,66],[-95,84],[-7,10],[-4,4],[-6,2],[-6,0],[-7,-1],[-7,0],[-5,2],[-5,4],[-4,4],[-5,4],[-6,3],[-6,1],[-22,-3],[-8,0],[-8,1],[-8,2],[-6,2],[-6,3],[-5,4],[-8,8],[-4,5],[-3,5],[-5,12],[-5,11],[-6,11],[-14,19],[-3,8],[-1,11],[5,15],[0,10],[-1,7],[-2,6],[-1,7],[0,9],[2,18],[-1,8],[-1,6],[-2,6],[-3,8],[0,8],[1,13],[8,8],[12,17],[2,11],[-1,11],[-10,28],[-6,23],[3,13],[5,8],[9,5],[8,7],[8,15],[3,14],[-2,49],[5,12],[13,21],[1,10],[-2,12],[-7,27],[-1,18],[1,12],[4,10],[6,8],[36,39],[30,41]],[[8830,3716],[132,42],[26,-6],[-5,-45],[1,-13],[6,-15],[17,-15],[17,-7],[16,-3],[14,3],[29,11],[17,3],[10,0],[91,-27],[23,-12],[14,-13],[2,-11],[0,-8],[-2,-7],[-2,-6],[-1,-7],[2,-6],[8,-8],[10,-3],[10,-1],[43,-2],[17,-2],[9,-4],[5,-4],[0,-5],[-1,-7],[0,-11],[6,-8],[6,-4],[8,1],[6,2],[6,4],[6,6],[5,6],[8,11],[6,5],[8,6],[15,1],[10,-2],[14,-6],[8,-3],[10,-2],[8,1],[17,5],[11,1],[5,-1],[5,-6],[13,-30],[7,-10],[8,-9],[11,-4],[92,-13],[34,-9],[33,-13],[28,-6],[30,0],[27,3],[31,0],[17,-2],[27,-11]],[[8519,2447],[-19,-28],[-3,-15],[0,-6],[-2,-8],[-6,-9],[-11,-12],[-7,-8],[-11,-9],[-13,-7],[-59,-21],[-30,9]],[[8208,3378],[31,35],[34,49],[17,17],[59,43],[130,130],[16,8],[24,7],[311,49]],[[8754,1811],[-15,3],[-5,3],[-4,1],[-4,-1],[-3,-4],[-2,-9],[0,-8],[-1,-8],[-3,-8],[-1,-10],[1,-57],[-4,-11],[-7,-10],[-9,-11],[-50,-44],[-100,-72],[-21,-11],[-81,-28],[-25,-4],[-16,-1],[-17,4],[-21,0],[-25,-2],[-50,-14],[-70,-27],[-13,-14],[-10,-24],[-8,-10],[-22,-17],[-56,-53],[-19,-12],[-20,-9],[-83,-14],[-60,-17],[-17,-13],[-27,-36],[-5,-12],[-11,-29],[-12,-16],[-14,-15],[-17,-13],[-10,-10],[-7,-11],[-11,-38],[-9,-9],[-19,-7],[-37,-5],[-72,-22],[-102,-50],[-138,-49],[-20,0],[-19,4],[-18,10],[-37,28],[-8,4],[-89,18]],[[8466,4887],[1,-5],[-1,-43],[4,-40],[23,-32],[53,-52],[25,-75],[18,-233],[12,-31],[27,-27],[36,-16],[75,-5],[38,-7],[0,-1],[42,-14],[43,-8],[42,3],[41,19],[0,1],[31,14],[75,-1],[36,10],[21,9],[39,2],[21,3],[20,11],[26,33],[16,15],[76,40],[156,51],[20,10],[30,30],[18,9],[32,-8],[202,-107],[24,-17],[65,-86],[112,-62],[33,-17],[1,0],[-25,-18],[-41,-29],[-29,-34],[-11,-37],[3,-20],[15,-38],[6,-45],[9,-15],[29,-35],[9,-27],[16,-38],[-1,-35],[-11,-37],[-15,-27],[-46,-63],[-14,-39],[0,-37],[16,-83],[0,-39],[-45,-124]],[[9500,1624],[-2,-6],[3,-24],[0,-54],[-18,-38],[-2,-6],[-3,-7],[-12,-74],[-5,-19],[-11,-17],[-36,-37],[-34,-26],[-18,-19],[-11,-22],[1,-17],[7,-17],[3,-22],[-1,-28],[-4,-30],[-10,-26],[-16,-20],[-13,-5],[-6,3],[-6,6],[-9,4],[-52,0],[-29,-6],[-20,-17],[-12,-24],[-16,-56],[-9,-21],[-11,-18],[-17,-18],[-20,-9],[-58,-4],[-24,-8],[-77,-71],[-9,-20],[17,-48],[-4,-26],[-19,-14],[-28,-5],[-47,3],[-19,5],[-22,11],[-25,9],[-29,0],[-58,-29],[-55,-6],[-24,-7],[-21,-13],[-20,-20],[-15,-23],[-7,-24],[-3,-56],[-12,-19],[-29,-3],[-33,4],[-24,-3],[-14,-19],[-5,-25],[-6,-21],[-20,-10],[-32,-7],[0,-18],[28,-49],[5,-15],[3,-12],[-3,-13],[-16,-24],[1,-9],[3,-9],[-1,-17],[-11,-28],[-20,-20],[-25,-13],[-29,-5],[-34,-23],[-42,-46],[-45,-32],[-72,36],[-32,8],[-14,8],[-10,12],[-18,45],[-18,23],[-24,8],[-28,0],[-29,-4],[-6,-1],[-22,0],[-27,5],[-79,28],[-1,0],[-29,5],[-31,2],[-30,-16],[-22,-15],[-44,-45],[-27,-11],[-34,-9],[-27,-13],[-7,-27],[5,-32],[-5,-27],[-14,-24],[-23,-24],[-23,-30],[-16,-37],[-22,-30],[-38,-7],[-1,0],[-37,14],[-35,26],[-31,32],[-23,32],[-48,55],[-79,10],[-29,-8]]],"transform":{"scale":[0.000840590895089512,0.0008300943620362039],"translate":[-62.65035721899997,-27.58684214299994]}};
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
