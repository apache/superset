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
  Datamap.prototype.sdsTopo = '__SDS__';
  Datamap.prototype.senTopo = '__SEN__';
  Datamap.prototype.serTopo = '__SER__';
  Datamap.prototype.sgpTopo = '__SGP__';
  Datamap.prototype.sgsTopo = '__SGS__';
  Datamap.prototype.shnTopo = '__SHN__';
  Datamap.prototype.slbTopo = '__SLB__';
  Datamap.prototype.sleTopo = '__SLE__';
  Datamap.prototype.slvTopo = {"type":"Topology","objects":{"slv":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Ahuachapán"},"id":"SV.AH","arcs":[[0,1,2]]},{"type":"Polygon","properties":{"name":"Cabañas"},"id":"SV.CA","arcs":[[3,4,5,6,7]]},{"type":"Polygon","properties":{"name":"Cuscatlán"},"id":"SV.CU","arcs":[[-6,8,9,10,11]]},{"type":"Polygon","properties":{"name":"La Libertad"},"id":"SV.LI","arcs":[[12,13,14,15,16,17]]},{"type":"Polygon","properties":{"name":"La Paz"},"id":"SV.PA","arcs":[[18,19,-14,20,-10]]},{"type":"Polygon","properties":{"name":"Sonsonate"},"id":"SV.SO","arcs":[[-16,21,-2,22]]},{"type":"Polygon","properties":{"name":"San Salvador"},"id":"SV.SS","arcs":[[-11,-21,-13,23]]},{"type":"MultiPolygon","properties":{"name":"La Unión"},"id":"SV.UN","arcs":[[[24]],[[25]],[[26,27,28]]]},{"type":"Polygon","properties":{"name":"Morazán"},"id":"SV.MO","arcs":[[-28,29,30]]},{"type":"Polygon","properties":{"name":"San Miguel"},"id":"SV.SM","arcs":[[-27,31,32,33,-4,34,-30]]},{"type":"Polygon","properties":{"name":"San Vicente"},"id":"SV.SV","arcs":[[-34,35,36,-19,-9,-5]]},{"type":"Polygon","properties":{"name":"Usulután"},"id":"SV.US","arcs":[[37,-36,-33]]},{"type":"Polygon","properties":{"name":"Chalatenango"},"id":"SV.CH","arcs":[[-7,-12,-24,-18,38,39]]},{"type":"Polygon","properties":{"name":"Santa Ana"},"id":"SV.SA","arcs":[[-39,-17,-23,-1,40]]}]}},"arcs":[[[1514,6887],[35,-27],[75,-86],[15,-24],[7,-16],[5,-17],[9,-63],[4,-19],[6,-17],[15,-26],[17,-24],[15,-28],[0,-2],[9,-30],[4,-19],[-12,-139],[-83,-519]],[[1635,5831],[-73,-57],[-91,-46],[-50,-14],[-12,-14],[-9,-22],[-4,-50],[-1,-33],[10,-145],[7,-45],[8,-36],[9,-35],[4,-18],[-3,-27],[-84,-235],[-7,-42],[-2,-31],[34,-202],[5,-43],[-6,-31],[-12,-37],[-32,-68],[-12,-42],[-6,-33],[-3,-72],[-3,-19],[-53,-175],[-7,-37],[-24,-173],[-21,-15],[-34,-9],[-124,14],[-26,9],[-8,11],[-30,52],[-54,115],[-8,12],[-17,22],[-10,8],[-11,8],[-15,3],[-17,0],[-23,-8],[-14,-9],[-12,-10],[-10,-13],[-12,-18],[-31,-67],[-66,-190],[-9,-29]],[[666,3935],[-279,234],[-297,262],[-88,524],[-2,122],[10,126],[22,123],[33,113],[49,93],[114,110],[50,75],[39,109],[27,113],[35,109],[61,99],[397,509],[88,161],[44,53],[183,127],[61,8],[75,-36],[107,-153],[61,-45],[60,60],[2,43],[-4,13]],[[6681,5382],[-8,-13],[-18,-30],[26,-97],[-6,-92],[-29,-77],[-45,-52],[9,-108],[-38,-108],[-38,-135],[0,-2]],[[6534,4668],[-67,-83],[-39,19],[-104,24],[-15,9],[-8,14],[-5,16],[-4,19],[-5,42],[-6,18],[-12,11],[-28,14],[-10,8],[-28,31],[-44,28],[-10,9],[-75,103],[-10,9],[-45,15],[-57,6],[-27,9],[-132,-3],[-29,5],[-20,10],[-59,78],[-14,-2],[-15,-14],[-20,-50],[-14,-26],[-14,-18],[-25,4],[-29,14],[-27,-14],[-129,-104],[-40,-23],[-28,-9],[-43,26],[-24,11],[-27,2],[-11,-29],[-8,-24],[-6,-223]],[[5221,4600],[-142,72],[-38,39],[-4,19],[-26,75],[-40,78],[-17,41],[-10,35],[-5,50],[-6,30],[-20,67],[-5,32],[-4,35],[-14,61],[-20,41],[-34,42],[-26,49],[-80,209],[-20,67],[-10,49],[2,24],[3,21],[4,18],[7,17],[6,14],[9,12],[55,58],[15,24],[14,27],[12,34],[5,17],[61,176]],[[4893,6133],[122,7],[108,-19],[56,26],[63,44],[254,152],[49,42],[28,39],[31,77],[86,76],[190,53]],[[5880,6630],[-1,-14],[25,18],[106,29],[105,-12],[313,-184],[182,-25],[40,-31],[37,-66],[-4,-25],[-1,-18],[-2,-4],[-4,-6],[-1,1],[-17,4],[5,-18],[21,-85],[-3,-91],[-14,-94],[-9,-115],[12,-74],[44,-204],[3,-124],[-36,-110]],[[5221,4600],[-75,-368],[-14,-109],[-10,-36],[-9,-26],[-81,-145]],[[5032,3916],[-28,-31],[-23,-15],[-52,-11],[-11,-6],[-9,-10],[-7,-14],[-9,-38],[-6,-14],[-9,-8],[-8,-4],[-19,-5],[-14,-2],[-78,46],[-72,70],[-181,123]],[[4506,3997],[-4,234],[-9,38],[-7,42],[-20,46],[-72,250],[-6,37],[7,168],[-4,34],[-7,22],[-11,6],[-16,20],[-17,33],[-52,140],[-8,11],[-11,8],[-12,4],[-26,3],[-29,42],[-38,80],[-110,316],[-11,59],[7,14],[30,24],[11,14],[8,16],[7,29],[-3,17],[-26,59],[-86,258],[-39,148],[-8,58],[-5,67],[3,12],[6,11],[8,11],[7,13],[11,31],[4,19],[3,21],[3,46],[6,43],[2,31],[0,8],[1,15],[-4,75],[-12,128],[-2,34],[4,24],[20,75],[18,92],[2,76]],[[4019,7059],[73,69],[13,0],[14,-3],[52,-48],[107,-71],[20,-20],[30,-49],[70,-91],[6,-15],[19,-60],[91,-197],[7,-22],[2,-12],[0,-2],[-3,-33],[0,-21],[1,-20],[3,-19],[7,-36],[11,-42],[22,-59],[18,-32],[16,-18],[88,-77],[75,12],[64,-45],[68,-15]],[[3499,6943],[-4,-262],[-22,-167],[-2,-42],[3,-27],[25,-36],[10,-27],[12,-40],[21,-88],[12,-42],[11,-28],[18,-21],[19,-17],[34,-19],[12,-1],[38,6],[13,-1],[13,-3],[11,-5],[11,-8],[14,-14],[15,-23],[22,-21],[6,-16],[2,-13],[-11,-51],[-5,-43],[-2,-10],[-3,-5],[-31,1],[-11,-5],[-8,-14],[-4,-25],[-21,-433],[-6,-44],[-4,-18],[-9,-11],[-21,-14],[-9,-10],[-8,-12],[-13,-29],[-8,-38],[-5,-37],[-8,-135],[-9,-60],[-13,-57],[-8,-72],[-4,-124],[-4,-33],[-3,-20],[-29,-98],[-18,-97],[2,-31],[7,-17],[11,-5],[13,-2],[21,-49],[-4,-77],[3,-74],[4,-20],[6,-16],[7,-15],[15,-22],[8,-19],[5,-26],[8,-60],[6,-34],[8,-23],[9,-12],[59,-58],[7,-9],[18,-29],[28,-67],[4,-30],[-1,-24],[-14,-46],[-10,-43],[1,-24],[9,-17],[31,-28],[5,-19],[-2,-17],[-6,-15],[-9,-12],[-5,-45],[-4,-72],[8,-322],[-2,-24],[-26,-123],[-9,-67],[-1,-37],[2,-28],[66,-196],[23,-93],[7,-14],[9,-10],[12,-3],[13,2],[23,10],[43,26],[25,6],[15,-4],[11,-6],[30,-25]],[[4007,2569],[14,-126],[13,-33],[10,1],[17,-2],[23,-9],[40,-31],[14,-26],[3,-22],[-10,-34],[-20,-45],[-6,-16],[-6,-14],[-32,-105],[-12,-47],[-12,-71],[0,-1]],[[4043,1988],[-198,222],[-280,228],[-303,132],[-141,0],[-108,46],[-586,-9],[-251,115],[-89,32]],[[2087,2754],[11,49],[44,183],[22,66],[104,168],[19,38],[11,32],[5,93],[8,65],[10,38],[9,25],[8,15],[9,11],[90,165],[20,51],[11,37],[1,26],[-5,171],[7,90],[12,93],[9,42],[9,29],[8,13],[17,18],[9,5],[29,5],[16,13],[17,24],[49,110],[22,38],[61,65],[26,34],[30,48],[11,31],[6,29],[-2,21],[-4,19],[-6,16],[-7,13],[-8,11],[-10,9],[-47,27]],[[2718,4790],[19,217],[72,362],[8,165],[-4,140],[6,208],[5,43],[6,15],[9,11],[10,5],[11,-2],[10,-6],[12,3],[13,16],[33,97],[9,9],[12,2],[13,-1],[16,2],[21,17],[9,21],[4,24],[7,149],[-1,24],[7,113],[45,430]],[[3070,6854],[18,53],[13,53],[34,24],[49,17],[38,38],[40,56],[43,-16],[74,-78],[68,-17],[13,-8],[39,-33]],[[5032,3916],[31,-153],[2,-127],[-5,-132],[4,-53],[8,-31],[13,-3],[13,1],[13,3],[99,57],[17,1],[19,-5],[32,-23],[11,-25],[102,-399],[3,-22],[2,-23],[-1,-50],[-5,-44],[-32,-159],[-2,-18],[-4,-19],[-3,-24],[0,-12],[0,-3],[-17,-170],[0,-35],[6,-135],[5,-45],[6,-32],[27,-55],[25,-36],[36,-40],[28,-50],[28,-64],[9,-40],[4,-33],[-1,-24],[-6,-44],[-3,-19],[-6,-17],[-25,-36],[-7,-13],[-5,-17],[-3,-20],[-2,-23],[-1,-25],[19,-318],[-1,-44],[-6,-17],[-6,-14],[-8,-15],[-9,-11],[-38,-34],[-30,-23],[-19,-19],[-16,-24],[-7,-15],[-5,-16],[-5,-19],[-4,-19],[-3,-22],[-10,-234],[0,-1]],[[5299,835],[-964,823],[-292,330]],[[4007,2569],[9,66],[12,14],[30,61],[21,82],[35,193],[9,84],[2,54],[-8,38],[-31,103],[-12,63],[-8,67],[2,36],[6,24],[9,10],[11,3],[13,0],[13,-3],[66,-39],[13,-4],[12,-1],[21,29],[124,290],[150,258]],[[2087,2754],[-29,10],[-262,159],[-138,-53],[-391,-9],[-63,80],[-42,286],[-16,178],[-51,78],[-85,97],[-335,348],[-9,7]],[[1635,5831],[96,-44],[37,2],[23,11],[12,3],[13,0],[19,-17],[24,-33],[67,-119],[13,-31],[13,-56],[9,-22],[13,-27],[25,-42],[18,-55],[5,-40],[-1,-22],[-3,-21],[-6,-18],[-6,-13],[-16,-24],[-7,-15],[-5,-18],[-2,-19],[6,-17],[13,-15],[26,-9],[19,-35],[10,-26],[4,-24],[5,-18],[7,-15],[10,-13],[13,-10],[19,-7],[30,13],[15,14],[9,18],[3,18],[0,70],[5,43],[14,54],[10,34],[8,14],[8,11],[11,5],[28,-23],[40,-43],[87,-119],[55,-94],[25,-114],[6,-16],[6,-15],[53,-33],[197,-69]],[[3499,6943],[30,-8],[17,16],[53,71],[32,20],[86,-69],[57,-1],[26,96],[58,-84],[47,-21],[114,96]],[[9983,151],[16,-79],[-35,-35],[-53,35],[-36,-30],[1,84],[-22,84],[8,99],[-3,99],[30,39],[57,-34],[35,-144],[2,-118]],[[9734,482],[-27,-50],[-54,89],[-13,124],[24,45],[35,5],[33,-35],[27,-114],[-25,-64]],[[8354,109],[0,1],[23,609],[6,60],[11,76],[8,-7],[34,-46],[36,-39],[43,-28],[14,-5],[13,-1],[20,11],[9,18],[54,324],[3,48],[-6,45],[-2,32],[53,559],[-1,19],[-4,19],[-5,19],[-38,113],[-5,19],[-4,20],[-12,136],[-2,200],[3,50],[7,31],[7,11],[18,19],[11,15],[12,18],[15,34],[4,27],[0,25],[-16,112],[-2,235],[9,98],[27,66]],[[8697,3052],[128,251],[30,84],[7,146],[95,449],[25,209],[12,181],[1,148],[-4,47],[-3,19],[-4,19],[-6,17],[-19,44],[-5,17],[-3,21],[-1,25],[17,472],[-8,219],[-18,127],[-13,152]],[[8928,5699],[23,-9],[61,-72],[29,-15],[18,17],[54,75],[32,20],[41,-4],[81,-31],[39,5],[40,52],[35,79],[41,64],[62,4],[39,-56],[40,-204],[34,-92],[21,-24],[58,-41],[25,-26],[65,-103],[117,-184],[73,-54],[-37,-113],[-84,-352],[-20,-127],[26,-129],[-20,-83],[-41,-72],[-36,-96],[-15,-137],[3,-288],[-9,-142],[-99,-438],[-24,-215],[43,-178],[42,-28],[88,54],[60,-43],[32,-68],[21,-93],[7,-104],[-9,-100],[-72,-148],[-325,-273],[-3,1],[-32,35],[-21,64],[-31,167],[-116,-370],[-31,-218],[76,-97],[49,-34],[137,-241],[78,-97],[7,-45],[0,-94],[-34,-166],[-82,-119],[-307,-284],[-83,-122],[-15,-124],[95,-121],[-145,-62],[-569,72],[-106,37]],[[8697,3052],[-89,28],[-43,-6],[-161,-91],[-31,-6],[-20,6],[-6,13],[-7,21],[-4,16],[-10,21],[-13,23],[-61,67],[-9,12],[-6,16],[-5,17],[-12,139],[-6,41],[-15,52],[-18,42],[-15,18],[-16,9],[-159,-24],[-24,-9],[-21,-15],[-33,-36],[-23,-12],[-7,9],[0,13],[5,17],[24,60],[4,19],[1,20],[-6,20],[-10,17],[-29,35],[-10,14],[-6,15],[-4,18],[-3,21],[-2,24],[-9,30],[-15,37],[-39,53],[-15,27],[-7,47],[-14,38],[-53,87],[-21,45],[-13,36],[-7,196],[1,20],[4,17],[7,14],[136,179],[19,19],[32,21],[9,11],[8,12],[7,15],[3,23],[0,28],[-7,46],[-11,31],[-10,19],[-156,195],[-23,39],[-15,29],[-3,19],[-3,22],[-2,75],[3,44],[3,14],[2,13],[5,15],[13,29],[7,12],[9,10],[7,14],[6,16],[5,17],[4,19],[3,22],[-1,47],[-13,65],[-16,58],[-7,34],[-2,26],[-7,62],[-48,209],[-23,58]],[[7600,5910],[17,53],[27,55],[49,39],[37,-11],[26,11],[20,107],[-7,21],[-37,62],[-9,28],[-4,153],[2,27],[41,28],[62,-12],[9,-4],[100,-41],[66,-3],[215,47],[109,-11],[48,-72],[60,-289],[60,-131],[76,-127],[68,-148],[34,-192],[188,172],[62,30],[9,-3]],[[8354,109],[-28,11],[-28,0],[-30,-22]],[[8268,98],[-253,539],[-11,8],[-12,4],[-13,2],[-112,-32],[-10,4],[-8,15],[-1,39],[3,25],[4,25],[30,104],[-2,21],[-9,25],[-28,27],[-15,22],[-10,29],[-1,115],[-1,22],[-4,25],[-7,22],[-14,28],[-17,4],[-13,-3],[-39,-38],[-21,-17],[-12,-4],[-11,-2],[-12,4],[-10,7],[-9,10],[-16,25],[-9,10],[-10,8],[-12,1],[-10,-1],[-12,15],[-17,30],[-37,80],[-21,32],[-19,19],[-81,17],[-22,11],[-31,25],[-9,10],[-7,11],[-29,68],[-42,122],[-22,84],[-22,139],[-6,60],[-2,46],[0,50],[-2,24],[-6,20],[-17,10],[-19,-13],[-8,1],[-5,9],[-5,24],[-13,144],[-1,50],[-7,104],[-1,23],[1,23],[4,20],[6,14],[8,5],[6,-5],[5,-7],[5,-13],[7,-9],[8,-1],[6,12],[3,20],[2,48],[-1,48],[2,23],[3,20],[6,19],[6,14],[22,37],[1,3],[5,19],[2,17],[-2,30],[-17,102],[-3,41],[0,32],[8,61],[0,18],[-5,29],[-50,194],[-3,21],[-2,22],[-1,46],[2,23],[4,20],[4,17],[7,15],[10,9],[22,14],[9,8],[7,14],[6,16],[4,20],[2,20],[-2,28],[-6,32],[-12,55],[-8,65],[1,23],[2,23],[19,101],[1,22],[-14,20],[-26,14],[-100,23],[-32,20],[-36,47],[-28,49],[-35,100],[-25,59],[-49,5],[-169,-35]],[[6720,4116],[-48,135],[-127,234],[-11,183]],[[6681,5382],[110,10],[77,86],[75,58],[167,68],[39,-4],[66,-48],[30,-6],[5,23],[0,46],[3,48],[13,28],[27,3],[33,-10],[33,-19],[26,-20],[29,97],[45,30],[50,7],[45,28],[32,58],[14,45]],[[6720,4116],[-259,-347],[-24,-137],[-61,-154],[-83,-97],[-91,38],[-119,-270],[-6,-48],[-67,-21],[-24,-61],[-10,-236],[-35,-230],[-188,-658],[-17,-82],[-10,-98],[-6,-241],[-10,-53],[-72,-129],[-39,-105],[-25,-85],[-38,-58],[-81,-22],[-49,-34],[-32,-78],[-16,-110],[0,-15],[0,-1]],[[5358,784],[-59,51]],[[8268,98],[-39,-29],[-357,-55],[-382,107],[-100,-59],[-52,33],[-60,25],[0,48],[93,11],[6,120],[-50,148],[-75,97],[16,-60],[50,-126],[19,-79],[-149,9],[-73,-14],[-63,-48],[40,-32],[32,9],[39,21],[58,2],[0,-58],[-96,-73],[-106,6],[-82,93],[-26,191],[41,-33],[16,-20],[56,106],[0,48],[-71,59],[-77,201],[-52,59],[14,-113],[23,-92],[12,-81],[-18,-81],[-60,63],[-175,80],[-75,74],[-69,224],[-31,36],[-49,8],[-136,50],[-61,0],[-167,-58],[-233,-11],[-51,-42],[27,-41],[31,-29],[30,-9],[27,22],[117,-50],[331,66],[37,-11],[53,-53],[29,-50],[52,-115],[34,-48],[0,-58],[-77,24],[-56,20],[-123,67],[0,-53],[339,-128],[176,-105],[80,-143],[-29,-93],[-74,23],[-82,79],[-55,75],[-61,57],[-1066,364],[-128,109],[-2,2]],[[3070,6854],[-49,-25],[-62,0],[-61,22],[-46,77],[-13,167],[79,499],[78,-10],[10,7],[10,10],[8,14],[10,25],[48,161],[8,13],[8,11],[10,8],[11,5],[11,3],[43,5],[13,4],[11,6],[10,7],[10,10],[8,11],[15,26],[80,204],[7,36],[2,29],[-4,86],[1,156],[153,114],[37,74],[16,157],[53,281],[-75,88],[-20,48],[-9,13],[-62,59],[-14,22],[-9,17],[-19,56],[-13,59],[-6,15],[-27,55],[-157,269]],[[3174,9748],[159,-47],[128,-111],[211,-82],[105,-136],[190,-104],[39,65],[60,210],[33,62],[36,19],[24,-9],[21,-34],[23,-59],[21,-71],[9,-77],[-4,-80],[-16,-76],[47,-74],[141,-30],[66,-61],[26,-96],[17,-238],[18,-70],[105,-145],[38,-84],[37,-115],[16,-97],[2,-37],[4,-63],[14,-83],[36,-48],[40,16],[49,53],[58,45],[64,-2],[102,-120],[87,-199],[62,-232],[27,-220],[72,20],[181,-25],[50,35],[42,48],[36,7],[30,-88],[-4,-132],[-24,-128],[-3,-109],[65,-78],[88,-22],[20,-12],[29,-47],[21,-52],[9,-65],[-1,-40]],[[1514,6887],[-26,113],[-4,59],[11,64],[177,571],[83,165],[104,147],[108,91],[444,194],[26,48],[0,121],[-14,32],[-52,48],[-18,33],[-8,50],[-7,119],[-5,36],[-24,84],[-12,29],[-24,42],[-29,23],[-86,21],[-26,110],[25,65],[41,54],[26,76],[-12,91],[-30,77],[-17,87],[26,123],[59,80],[61,-9],[45,-84],[12,-144],[56,74],[102,225],[28,22],[45,35],[66,-15],[46,-45],[47,-32],[65,25],[94,177],[42,30],[5,-150],[22,59],[4,18],[120,-159],[64,-19]]],"transform":{"scale":[0.00024218276827683255,0.0001286864520452029],"translate":[-90.11477901199996,13.158636786000116]}};
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
