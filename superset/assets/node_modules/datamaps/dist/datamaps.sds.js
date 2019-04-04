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
  Datamap.prototype.sdsTopo = {"type":"Topology","objects":{"sds":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"North Bahr-al-Ghazal"},"id":"SD.NB","arcs":[[0,1,2,3]]},{"type":"Polygon","properties":{"name":"Lakes"},"id":"SD.EB","arcs":[[4,5,6,7,8]]},{"type":"Polygon","properties":{"name":"West Equatoria"},"id":"SD.WE","arcs":[[-7,9,10,11]]},{"type":"Polygon","properties":{"name":"Central Equatoria"},"id":"UG.MY","arcs":[[12,13,14,-10,-6]]},{"type":"Polygon","properties":{"name":"Upper Nile"},"id":"SD.UN","arcs":[[15,16,17]]},{"type":"Polygon","properties":{"name":"Jungoli"},"id":"SD.JG","arcs":[[-16,18,19,-13,-5,20]]},{"type":"Polygon","properties":{"name":"Unity"},"id":"SD.WH","arcs":[[-17,-21,-9,21,-1,22]]},{"type":"Polygon","properties":{"name":"Warap"},"id":"SD.WR","arcs":[[-8,23,-2,-22]]},{"type":"Polygon","properties":{"name":"West Bahr-al-Ghazal"},"id":"SD.WB","arcs":[[-3,-24,-12,24]]},{"type":"Polygon","properties":{"name":"East Equatoria"},"id":"SD.EE","arcs":[[-14,-20,25]]}]}},"arcs":[[[4002,6686],[1,-1],[11,-3],[6,-1],[7,-4],[5,-5],[5,-1],[5,1],[7,3],[7,1],[6,3],[7,-3],[7,-4],[9,-2],[7,-4],[16,-12],[6,-7],[12,-15],[8,-7],[-1,-5],[-3,-9],[-17,-19],[-19,-12],[-40,-17],[-17,-23],[-14,-35],[-20,-123],[-10,-32]],[[3993,6350],[-367,-36],[-2,-1],[-12,-8],[-8,-2],[-8,0],[-56,9],[-9,2],[-144,8],[-97,-12],[-36,-11],[-25,-15],[-17,-18],[-17,-32],[-18,-67],[-11,-174],[-11,-50],[-24,-62],[-25,-47],[-18,-50],[-55,-329]],[[3033,5455],[-121,-42],[-509,-324],[-92,-85],[-53,-38],[-22,-11],[-21,-7],[-24,-1],[-29,6],[-34,17],[-279,244],[-49,61],[-52,98],[-30,129],[-18,157],[-4,159],[-45,387],[3,755],[29,392],[-4,94]],[[1679,7446],[65,-33],[160,-252],[160,-251],[37,-33],[21,-13],[49,-5],[9,1],[327,149],[220,7],[39,-9],[121,0],[69,-11],[5,0],[17,7],[5,0],[108,-21],[84,6],[14,3],[9,5],[86,-241],[41,-62],[338,-4],[338,-3],[1,0]],[[5673,4114],[3,-9],[23,-44],[5,-6],[8,-2],[7,-1],[21,-7],[7,-4],[57,-65],[28,-17],[13,-12],[8,-6],[21,-7],[9,-7],[5,-11],[3,-26],[3,-10],[5,-5],[15,-9],[6,-5],[12,-18],[6,-7],[17,-9],[13,-14],[19,-27],[13,-33],[9,-16],[10,-7],[15,-6],[7,-16],[4,-20],[6,-20],[26,-35],[4,-9],[1,-12],[1,-10],[6,-4],[10,-10],[5,-23],[5,-54],[5,-23],[7,-17],[11,-11],[15,-3],[12,-9],[5,-22],[3,-48],[10,-30],[55,-88],[7,-14],[5,-19],[4,-21],[3,-45],[20,-59],[10,-52],[7,-29],[10,-12],[9,-7],[9,-16],[9,-18],[26,-90],[2,-23],[3,-12],[6,-15],[7,-14],[8,-10],[5,1],[5,5],[6,-1],[5,-17]],[[6398,2792],[-43,-52],[-31,5],[-57,41],[-287,70],[-104,61],[-157,180],[-43,2],[-62,-44],[-76,-20],[-188,-21]],[[5350,3014],[-37,60],[-86,235],[-29,49],[-29,38],[-17,17],[-14,9],[-38,-6],[-171,-4],[-13,-12],[-10,-22],[-3,-99],[9,-73],[10,-45],[0,-52],[-15,-112],[-16,-53],[-14,-31],[-32,-41],[-60,-103],[-17,-43],[-27,-106],[-10,-55],[-42,-33],[-59,-2],[-371,49],[-30,11],[-29,23],[-13,23],[-16,16],[-17,14],[-24,14],[-28,11],[-23,27],[-62,110],[-23,49],[-50,73],[-37,28],[-23,35],[-14,59],[-16,43],[-34,68],[-7,27],[-2,35],[5,41],[-8,66],[-11,37],[13,39],[-6,46],[9,41],[-5,51],[21,153]],[[3829,3719],[69,-72],[68,-38],[29,-6],[28,1],[31,6],[28,10],[29,16],[26,21],[17,31],[9,25],[105,460],[15,42],[55,109],[278,414],[110,225]],[[4726,4963],[130,-14],[14,-4],[14,-10],[10,-15],[270,-750],[99,-42],[410,-14]],[[5350,3014],[103,-127],[93,-96],[34,-44],[20,-35],[23,-53],[18,-27],[48,-45],[62,-77],[25,-58],[19,-57],[3,-48],[-9,-42],[-39,-80],[-15,-50],[-9,-56],[-13,-338],[-3,-24],[-3,-15],[-5,-12],[-10,-12],[-19,-15],[-118,-52],[-96,-66],[-39,-40],[-112,-148],[-30,-20],[-27,-6],[-22,7],[-21,17],[-55,68],[-19,18],[-19,9],[-22,2],[-18,-5],[-21,-12],[-20,-18],[-20,-25],[-32,-48],[-156,-164],[-24,-18]],[[4802,1202],[4,7],[3,12],[-10,9],[-9,4],[-19,16],[-5,3],[-19,-6],[-7,1],[-12,10],[-25,30],[-9,9],[-36,22],[-10,3],[-25,1],[-26,14],[-9,4],[-6,-1],[-13,-9],[-4,4],[-9,12],[-3,3],[-18,4],[-13,-3],[-7,-14],[-2,-40],[-3,-20],[1,-12],[-2,-12],[-16,-20],[-5,-12],[-6,-27],[-7,-23],[-10,-21],[-44,-51],[-8,-16],[-9,-28],[-12,-27],[-14,-4],[-17,5],[-21,-1],[-10,-13],[-2,-22],[-6,-18],[-22,-5],[-19,13],[-54,74],[-9,9],[-34,20],[-2,-2],[-3,17],[-9,5],[-41,37],[-7,9],[-51,-17],[-19,-2],[-40,4],[-26,-5],[-8,0],[-22,12],[-4,22],[-1,26],[-12,22],[-12,5],[-7,-5],[-8,-10],[-11,-8],[-18,0],[-7,-2],[-35,-91],[-13,-24],[-13,-11],[-35,-11],[-10,-9],[-3,-12],[-2,-13],[-6,-11],[-8,-3],[-8,1],[-8,3],[-8,0],[-19,-6],[-12,-11],[-33,-58],[-16,-21],[-18,-14],[-19,-3],[-20,8],[-7,11],[-3,16],[-8,24],[-28,29],[-36,-2],[-37,-10],[-34,6],[-16,16],[-15,21],[-24,40],[-3,22],[-6,10],[-14,1],[-8,-6],[-14,-20],[-8,-2],[-26,50],[-4,11],[-3,9],[-1,10],[-1,12],[3,26],[4,20],[-2,12],[-44,9],[-10,-2],[-5,2],[-9,12],[-4,2],[-8,-5],[-3,-4],[1,-1],[-1,-3],[0,-5],[-2,-5],[-5,-1],[-15,8],[-4,1],[-25,-5],[-6,1],[-10,8],[-15,22],[-9,10],[-7,3],[-20,6],[-4,0],[-6,19],[-4,27],[-2,47],[7,67],[-3,25],[-3,10],[-6,13],[-7,12],[-8,6],[-8,0],[-16,-7],[-6,0],[-11,12],[-6,19],[-6,48],[-11,27],[-16,13],[-74,11],[-17,8],[-16,17],[-4,12],[-4,24],[-3,11],[-7,11],[-27,27],[-6,4],[-5,4],[-5,5],[-5,6],[6,51],[-2,15],[-8,15],[-25,24],[-14,45],[-23,26],[-48,44],[-18,29],[-14,34],[-22,72],[-4,18],[-4,56],[-7,29],[-2,15],[2,17],[34,126],[-1,11],[1,20],[-3,10],[-8,7],[-6,-1],[-5,-3],[-3,-2],[-3,-1],[-4,-2],[-5,1],[-5,11],[0,7],[4,17],[1,20],[2,7],[-1,7],[-14,13],[-4,5],[-2,7],[0,10],[-3,18],[-7,18],[-10,15],[-12,8],[-17,7],[-4,9],[-1,12],[-6,19],[-7,7],[-36,19],[-8,-1],[-15,-6],[-8,0],[-6,5],[-6,18],[-16,16],[-10,32],[-9,14],[-37,-13],[-18,2],[-10,20],[-8,26],[-11,2],[-14,-7],[-19,-2],[-20,12],[-7,21],[-5,51],[-9,15],[-15,13],[-61,32],[-60,-4],[-27,5],[-50,23],[-13,14],[-8,21],[-7,25],[-9,19],[-16,6],[-34,-32],[-13,-5],[-3,24],[7,23],[13,19],[17,16],[16,12],[14,15],[8,22],[-1,21],[-11,18],[-14,5],[-12,-1],[-8,7],[0,28],[-3,29],[-14,13],[-35,10],[-16,14],[-20,37],[-14,18],[-17,13],[-12,7],[-10,11],[-5,23],[1,21],[5,22],[-1,16],[-16,8],[6,13],[8,8],[8,6],[7,8],[17,47],[27,48],[13,35],[7,11],[-1,13]],[[1913,3599],[23,5],[1296,208],[137,-130],[8,-6],[11,-5],[11,-1],[430,49]],[[6398,2792],[455,-35]],[[6853,2757],[-21,-128],[7,-719],[20,-102],[12,-44],[68,-159],[13,-40],[8,-41],[-1,-36],[-10,-38],[-17,-44],[-48,-96],[-79,-233],[-32,-169],[-16,-47],[-21,-35],[-28,-38],[-89,-85],[-16,-26],[-16,-42],[-56,-208],[-20,-45],[-3,-19],[0,-1]],[[6508,362],[-17,11],[-3,1],[-2,-7],[-67,-102],[-8,-10],[-15,-9],[-47,-9],[-41,-8],[-15,-10],[-10,-17],[-1,-1],[-9,-11],[-16,4],[-108,80],[-70,51],[-33,15],[-35,6],[-40,0],[-22,-8],[-32,-33],[-22,-24],[-8,-4],[-16,-5],[-8,-4],[-26,-28],[-11,-7],[-9,-2],[-17,1],[-9,-4],[-9,-11],[-4,-13],[-3,-13],[-4,-13],[-56,-111],[-18,-49],[-4,-18],[-10,24],[8,59],[-12,20],[-26,14],[-11,12],[-6,17],[-3,39],[-3,12],[-15,15],[-14,-13],[-14,-23],[-18,-14],[-24,1],[-9,-2],[-15,-8],[-27,-20],[-10,-3],[-17,-3],[-9,0],[-7,4],[-9,10],[0,5],[5,7],[5,15],[6,44],[1,23],[-21,168],[-11,29],[-9,4],[-8,-1],[-9,-3],[-8,-2],[-17,1],[-7,1],[-32,14],[-69,56],[-57,24],[-55,1],[-14,7],[-6,11],[-2,11],[0,12],[-2,13],[-5,13],[-20,32],[-8,27],[-5,26],[-8,23],[-20,14],[-35,10],[-13,11],[-13,24],[-19,52],[-13,21],[-20,16],[-10,2],[-10,0],[-9,3],[-7,11],[-1,14],[6,12],[6,11],[3,12],[-8,23],[-19,23],[-22,17],[-19,4],[-38,0],[-23,25],[-10,42],[0,50],[8,34],[1,12],[-1,10],[-6,19],[-1,10],[5,12],[4,6]],[[7530,5104],[-1,0],[-101,59],[-18,17],[-21,26],[-2,32],[5,32],[26,75],[12,43],[7,47],[3,47],[-4,56],[-13,37],[-21,25],[-89,57],[-72,83],[-49,80],[-151,354],[-15,51],[-30,81],[-17,29],[-17,15],[-16,0],[-19,-7],[-21,-13],[-103,-85],[-113,-73],[-28,-9],[-32,-1],[-34,18],[-29,33],[-282,505],[-10,12],[-4,3],[-7,1],[-3,-3],[-39,-17],[-37,-7],[-13,3],[-17,7],[-16,9],[-6,9],[-8,14],[-18,8],[-38,5],[-134,47],[-102,77],[-38,17],[-18,4]],[[5777,6907],[10,269]],[[5787,7176],[181,13],[60,33],[182,241],[182,242],[93,154],[24,32],[52,110],[56,188],[11,22],[200,226],[199,227],[14,36],[4,28],[-60,152],[-13,78],[-3,119],[12,186],[-4,117],[-1,13],[-4,18],[-3,7],[-223,333],[282,2],[281,1],[1,28],[0,15],[-2,13],[-10,40],[-7,53],[0,15],[1,14],[3,28],[0,15],[0,7],[-1,6],[0,6],[3,5],[404,-7],[-5,-94],[-49,-222],[1,-132],[-12,-152],[-3,-13],[-11,-32],[-10,-19],[-11,-18],[-3,-7],[-4,-11],[0,-17],[42,-424],[42,-425],[-3,-22],[-3,-14],[-23,-53],[-5,-17],[-2,-14],[10,-9],[186,-92],[9,-5],[7,-8],[67,-109],[184,-202],[183,-201],[13,-20],[38,-127],[4,-19],[1,-31],[-1,-23],[-9,-76],[3,-34],[6,-23],[6,-26],[0,-8],[-1,-7],[-3,-12],[-54,-146],[-18,-104],[-5,-88],[3,-50],[6,-33],[3,-7],[2,-6],[3,-3],[2,-2],[144,0],[11,-286],[12,-332],[12,-331],[-4,-29],[-3,-25],[-11,-27],[-18,-26],[-84,-101],[-17,-14],[-16,-6],[-48,0],[-29,-4],[-14,-6],[-13,-7],[-9,-8],[-35,-41],[-4,-2],[-9,-2],[-39,7],[-20,31],[-17,40],[-26,30],[-18,3],[-12,-6],[-12,-9],[-16,-4],[-13,7],[-13,14],[-14,11],[-17,-1],[4,-9],[0,-4],[-8,-6],[-57,-9],[-11,3],[-7,0],[-6,-5],[-12,-12],[-8,-4],[-92,28],[-15,-3],[-24,-29],[1,-4],[2,-7],[-6,-8],[-13,-3],[-12,-8],[-4,-8],[-1,-9],[0,-19],[-1,-5],[-4,-8],[-1,-6],[2,-4],[8,-7],[1,-4],[-2,-14],[-7,-22],[-2,-8],[3,-14],[6,-11],[6,-8],[6,-13],[8,-6],[11,-7],[-1,-14],[-6,-6],[-8,-4],[-7,-8],[-7,-12],[-3,-11],[-2,-11],[0,-16],[3,-7],[11,-11],[3,-6],[-2,-23],[-7,-16],[-11,-11],[-14,-9],[-26,-6],[-3,-6],[-2,-9],[-4,-12],[-5,-11],[-48,-66],[-11,-19],[-4,-12],[-4,-24],[-4,-8],[-4,-6],[-4,-10]],[[7530,5104],[0,-2],[-12,-17],[-3,-12],[22,-76],[7,-18],[14,-12],[4,-10],[2,-10],[3,-7],[6,-4],[23,-3],[19,-11],[11,-3],[5,10],[5,3],[27,8],[7,-2],[25,-13],[27,-6],[7,-3],[13,-15],[14,-21],[15,-18],[47,-16],[11,0],[21,19],[7,5],[37,10],[22,1],[14,-8],[8,-8],[15,-6],[9,-5],[8,-10],[12,-21],[9,-9],[18,-7],[55,7],[9,-3],[23,-20],[27,-11],[8,-5],[11,-17],[27,-51],[43,-42],[8,-3],[17,-3],[9,-3],[26,-20],[105,-144],[14,-32],[6,-39],[1,-107],[2,-5],[5,-4],[39,-41],[23,-39],[16,-16],[16,5],[14,9],[12,-10],[8,-20],[4,-23],[0,-36],[0,-12],[2,-26],[7,-12],[6,-3],[6,-6],[8,-15],[35,-34],[4,-7],[4,-20],[6,-5],[6,-4],[2,-4],[120,-39],[55,-51],[7,-15],[6,-18],[4,-20],[1,-22],[-2,-3],[-8,-8],[-2,-1],[1,-7],[4,-12],[1,-4],[6,-47],[10,-12],[15,-4],[36,0],[18,-3],[15,-8],[57,-51],[6,-13],[4,-21],[10,-15],[6,-5],[8,-47],[9,-46],[19,-66],[7,-66],[7,-23],[34,-78],[5,-30],[1,-67],[4,-23],[30,-70],[16,-56],[14,-22],[16,-20],[15,-24],[6,-22],[8,-62]],[[9192,2885],[-1,0],[-660,-266],[-1678,138]],[[5673,4114],[-3,8],[-2,22],[-6,13],[-41,29],[-17,32],[-11,10],[-4,7],[-4,36],[-5,14],[-8,13],[-8,23],[-6,30],[-14,22],[-6,18],[-4,46],[-8,23],[-27,38],[-5,22],[-3,15],[-6,3],[-8,-1],[-7,4],[0,4],[1,14],[-1,4],[-9,12],[-3,4],[-4,4],[-9,11],[-6,11],[5,5],[11,1],[6,4],[3,9],[1,14],[-3,22],[-7,21],[-11,17],[-19,12],[-1,11],[1,13],[-1,10],[-5,7],[-14,14],[-5,10],[2,10],[7,7],[4,7],[-6,22],[6,52],[3,6],[4,5],[4,9],[5,8],[6,7],[2,8],[-8,9],[0,8],[7,1],[4,2],[3,2],[4,2],[-16,7],[-7,0],[0,9],[12,10],[-6,8],[-12,7],[-6,10],[0,32],[-2,8],[-8,8],[-9,40],[-50,81],[9,11],[-10,21],[-17,25],[-11,22],[-1,16],[1,17],[-1,16],[-6,13],[-10,1],[-11,-6],[-7,0],[0,21],[-22,-13],[-12,35],[-3,49],[5,24],[14,6],[-2,13],[-6,13],[0,6],[15,8],[-1,17],[-17,38],[6,3],[17,13],[-5,12],[-4,32],[-8,12],[6,31],[4,6],[6,4],[5,6],[5,31],[4,16],[1,16],[-8,22],[-3,1],[-11,-2],[-3,1],[-1,5],[1,14],[0,5],[-25,22],[-4,5],[-3,13],[-12,17],[-3,10],[3,15],[4,11],[1,10],[-8,7],[0,-3],[0,-9],[0,-3],[-5,0],[0,14],[2,14],[4,14],[5,12],[17,29],[6,17],[0,17],[-5,9],[-6,3],[-6,1],[-6,3],[-34,42],[-7,13],[-6,15],[11,11],[8,13],[4,15],[-5,17],[-6,-8],[-5,18],[1,40],[-1,20],[-4,10],[-10,13],[-4,9],[-1,7],[1,16],[0,8],[-3,18],[-10,23],[-5,14],[-1,20],[2,18],[5,15],[6,10],[5,3],[14,3],[5,2],[15,21],[1,2],[2,6],[2,19],[2,7],[5,4],[12,6],[6,5],[10,13],[3,13],[5,37],[8,21],[11,11],[13,10],[9,14],[-6,8],[2,7],[6,6],[4,9],[0,75],[-2,17],[-6,6],[-7,4],[-9,9],[-10,28],[9,11],[16,8],[9,19],[4,26],[9,16],[12,11],[9,14],[9,37],[8,13],[15,5],[12,6],[9,13],[9,16],[8,12],[14,9],[16,5],[104,-6],[108,-35],[36,-5],[68,0],[13,4],[11,7],[12,9]],[[4726,4963],[-31,668],[-8,23],[-14,25],[-242,224],[-216,444],[-48,22],[-174,-19]],[[4002,6686],[-11,28],[-3,41],[1,48],[17,45],[55,72],[64,66],[17,19],[104,74],[102,50],[196,57],[71,92],[39,84],[2,164],[25,27],[47,38],[226,147],[39,31],[199,-171],[200,-171],[224,-270],[14,-13],[12,-5],[12,9],[10,12],[16,9],[11,3],[96,4]],[[3829,3719],[-34,263],[-8,142],[15,180],[2,186],[-4,45],[-10,28],[-33,36],[-7,22],[4,23],[9,29],[1,30],[-12,26],[-27,21],[-36,17],[-107,79],[-70,73],[-61,51],[-42,24],[-128,29],[-16,9],[-13,12],[-19,26],[-53,90],[-110,242],[-37,53]],[[1913,3599],[-1,26],[-41,31],[-50,25],[-29,20],[-14,20],[-35,33],[-26,44],[-13,8],[-16,6],[-19,15],[-9,14],[-3,13],[-1,13],[-4,14],[0,7],[2,7],[0,7],[-4,4],[-4,0],[-6,-2],[-5,-1],[-5,4],[-8,26],[-3,59],[-5,26],[-38,4],[-10,4],[-2,7],[-1,9],[-5,8],[-8,5],[-17,3],[-9,3],[-26,20],[-4,11],[-2,21],[-4,9],[-14,9],[-38,5],[-13,6],[-8,19],[0,15],[-4,9],[-21,2],[-10,3],[-13,18],[-9,5],[-16,0],[-7,2],[-20,22],[-16,9],[-53,18],[-13,10],[-38,47],[-13,10],[-14,3],[-16,-7],[-22,14],[-33,34],[-47,31],[-12,11],[-9,17],[-4,17],[-6,33],[-7,16],[-5,5],[-14,6],[-7,5],[-5,8],[-8,18],[-5,8],[-12,10],[-50,36],[-18,57],[-4,19],[0,14],[18,24],[56,25],[19,22],[4,21],[-2,16],[-5,16],[-3,18],[3,49],[-1,17],[-4,19],[-13,31],[-9,36],[-8,18],[-11,14],[-21,10],[-5,6],[-5,7],[-6,5],[-21,5],[-12,0],[-26,-8],[-12,-1],[-25,13],[-26,26],[-40,61],[-8,5],[-6,7],[-6,7],[-5,9],[-1,20],[-18,24],[-2,41],[-8,18],[-73,91],[-27,16],[-49,8],[-27,20],[-17,3],[-16,0],[-48,12],[-59,-13],[-27,1],[-27,22],[-8,3],[-7,5],[-4,7],[-4,11],[-20,26],[-29,-4],[-55,-26],[-4,4],[-14,14],[-6,5],[-7,1],[-12,0],[-15,2],[-5,1],[-30,9],[-13,7],[-23,17],[-22,23],[-19,29],[-8,33],[3,38],[10,39],[48,107],[8,12],[35,31],[5,11],[-4,14],[-23,24],[-6,16],[3,17],[16,30],[2,16],[-16,11],[-31,-1],[-9,-1],[4,7],[2,16],[5,9],[49,50],[26,17],[92,78],[19,5],[77,11],[42,19],[8,6],[5,8],[0,122],[1,7],[5,18],[77,174],[3,11],[1,7],[16,218],[6,21],[7,13],[24,30],[52,79],[7,26],[1,13],[-1,305],[3,24],[3,7],[3,5],[3,1],[8,1],[9,2],[8,4],[7,6],[29,32],[29,24],[12,17],[23,42],[11,16],[7,13],[8,21],[5,20],[22,62],[9,33],[1,7],[0,7],[0,7],[-3,11],[-7,22],[-1,6],[-2,12],[1,10],[2,12],[42,123],[9,13],[6,8],[5,2],[13,6],[13,6],[9,3],[21,-3],[10,3],[21,10],[4,0],[10,-1],[6,1],[8,4],[6,2],[5,1],[11,-3],[4,-2],[9,-5],[5,-2],[5,-1],[5,0],[4,1],[8,4],[5,1],[9,-2],[5,0],[5,1],[16,10],[4,2],[10,2],[5,0],[11,1],[8,4],[8,5],[13,5],[9,3],[11,1],[34,-1],[9,2],[11,4],[3,0],[62,30],[37,12],[5,1],[27,0],[19,4],[14,5],[4,1],[35,-2],[6,2],[8,2],[18,12],[37,13],[10,1],[3,-3],[37,-61],[4,-10],[2,-5],[1,-6],[5,-178],[1,-6],[3,-5],[5,-8],[7,-7],[30,-24],[13,-8],[23,-9],[3,-1],[5,-6],[3,-4],[5,-9],[51,-111],[10,-17],[12,-17]],[[9192,2885],[1,-13],[-9,-24],[-3,-13],[0,-13],[4,-13],[14,-20],[3,-13],[-2,-16],[-3,-13],[-1,-13],[1,-15],[8,-25],[69,-131],[12,-31],[7,-67],[9,-22],[38,-37],[68,-54],[33,-35],[6,-23],[4,-14],[-6,-13],[-7,-12],[-6,-12],[-1,-14],[3,-11],[28,-59],[13,-19],[15,-10],[21,4],[19,18],[35,51],[18,17],[15,4],[18,0],[18,-3],[15,-6],[19,-15],[37,-40],[21,-7],[20,5],[15,10],[16,5],[21,-8],[56,-46],[46,-25],[4,-10],[-23,-45],[-5,-26],[2,-23],[17,-43],[8,-28],[0,-23],[-7,-23],[-32,-55],[-5,-15],[-3,-240],[7,-56],[20,-47],[116,-166],[-54,0],[-64,1],[-3,66],[-33,4],[-23,-23],[-5,-47],[0,-1],[-5,-35],[-75,35],[-1,1],[-41,99],[-34,85],[41,141],[-63,26],[-85,0],[32,88],[-19,31],[-66,-50],[-59,-44],[-15,38],[-59,-30],[-69,-35],[-78,-40],[-69,-35],[-65,-33],[-69,-35],[-82,-40],[-58,-39],[-58,-40],[-59,-41],[-67,-46],[-85,-115],[-86,-115],[-86,-114],[-85,-115],[-69,-93],[-70,-95],[-94,-128],[-81,-110],[-63,-84],[-4,-4],[-31,-25],[-37,-6],[-136,10],[-20,1],[-58,4],[-26,7],[-18,12],[-107,118],[-17,10],[-14,-7],[-52,-52],[-66,-46],[-72,-28],[-133,-15],[-155,-17],[-38,-12],[-155,-128],[-11,-16],[0,-15],[3,-41],[0,-17],[-3,-17],[-1,-7],[-5,-10],[-11,0],[-53,14],[-14,10],[-13,18],[-6,12],[-10,24],[-10,7],[-7,0],[-66,6],[-12,8],[-6,19],[-2,53],[-4,22],[-12,27],[-60,92],[-20,22],[-5,3]]],"transform":{"scale":[0.0011800459831983311,0.0008726825848584855],"translate":[24.121555623000063,3.490201518000106]}};
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
