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
  Datamap.prototype.slvTopo = '__SLV__';
  Datamap.prototype.smrTopo = '__SMR__';
  Datamap.prototype.solTopo = '__SOL__';
  Datamap.prototype.somTopo = '__SOM__';
  Datamap.prototype.spmTopo = '__SPM__';
  Datamap.prototype.srbTopo = '__SRB__';
  Datamap.prototype.stpTopo = '__STP__';
  Datamap.prototype.surTopo = '__SUR__';
  Datamap.prototype.svkTopo = {"type":"Topology","objects":{"svk":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Bratislavský"},"id":"SK.BL","arcs":[[0,1]]},{"type":"Polygon","properties":{"name":"Banskobystrický"},"id":"SK.BC","arcs":[[2,3,4,5,6,7]]},{"type":"Polygon","properties":{"name":"Žilinský"},"id":"SK.ZI","arcs":[[8,-8,9,10]]},{"type":"Polygon","properties":{"name":"Nitriansky"},"id":"SK.NI","arcs":[[-6,11,12,13]]},{"type":"Polygon","properties":{"name":"Trenciansky"},"id":"SK.TC","arcs":[[-7,-14,14,15,-10]]},{"type":"Polygon","properties":{"name":"Trnavský"},"id":"SK.TA","arcs":[[-15,-13,16,-2,17]]},{"type":"Polygon","properties":{"name":"Košický"},"id":"SK.KI","arcs":[[18,-4,19]]},{"type":"Polygon","properties":{"name":"Prešov"},"id":"SK.PV","arcs":[[-20,-3,-9,20]]}]}},"arcs":[[[734,1389],[-73,42],[-63,28],[-65,-80],[-41,76],[-56,42],[-41,46],[10,88],[-21,36],[-7,9],[10,101],[9,54],[18,46],[-23,50],[-8,32],[-27,98],[-18,25],[-28,9],[-24,30],[-45,100],[-12,84],[0,117],[-9,98],[-27,194],[-1,25],[3,62],[-2,24],[-7,18],[-11,8],[-19,36],[-16,15],[-13,18],[-6,32],[-2,24],[-6,31],[-6,28],[-5,11],[-7,11],[3,27],[7,32],[4,24],[-8,43],[-18,41],[-19,31],[-10,12],[-35,8],[-14,17],[-5,32],[1,59],[3,25],[5,16],[4,34],[16,288],[7,77],[18,73],[46,135],[9,72],[13,51],[29,48],[29,62],[4,28]],[[184,4292],[6,1],[106,67],[79,7],[6,3],[1,9],[-2,13],[-5,25],[10,2],[23,-13],[77,-76],[18,-11],[10,5],[73,65],[24,30],[31,18],[22,2],[14,8],[7,15],[7,35],[7,16],[8,10],[16,15],[13,19],[4,7],[3,10],[4,23],[2,11],[5,11],[8,16],[10,16],[4,2],[3,2],[3,2],[2,5],[2,8],[49,164],[16,40],[11,19],[9,-4],[4,-7],[4,-8],[3,-6],[19,-11],[6,-6],[6,-11],[7,-17],[7,-20],[7,-25],[4,-39],[1,-51],[-10,-62],[-9,-37],[-31,-85],[-6,-13],[-5,-4],[-6,-1],[-6,1],[-6,-2],[-4,-9],[-12,-67],[-3,-10],[-4,-8],[-20,-20],[1,-34],[-9,-43],[95,-193],[-16,-22],[-7,-15],[-9,-24],[-26,-86],[-15,-62],[6,-61],[22,-18],[24,1],[4,-1],[4,-4],[4,-7],[5,-11],[13,-20],[10,-20],[5,-6],[7,-4],[31,-2],[6,-7],[0,-11],[-4,-21],[-3,-11],[-1,-11],[3,-12],[17,-28],[6,-13],[12,-39],[14,-28],[7,-26],[30,-121],[7,-18],[5,-10],[10,-1],[7,-6],[6,-12],[10,-23],[6,-18],[4,-19],[5,-11],[0,-21],[-5,-30],[-15,-70],[-13,-47],[-1,-13],[0,-11],[11,-61],[95,-158],[-49,-119],[-8,-33],[-2,-27],[4,-49],[3,-17],[5,-9],[7,-3],[37,-35],[4,-18],[-1,-24],[-3,-59],[4,-20],[4,-9],[7,5],[3,-1],[2,-3],[4,-14],[2,-7],[0,-16],[-2,-25],[-11,-60],[-6,-23],[-7,-12],[-9,8],[-20,-13],[-55,-89],[-47,-43],[-8,-1],[-8,7],[-13,21],[-8,8],[-24,5],[-5,4],[-2,6],[0,9],[2,11],[7,29],[-3,19],[-2,9],[0,9],[-2,8],[-3,2],[-6,-4],[-11,-14],[-7,-6],[-6,-9],[-4,-14],[-5,-54],[1,-15],[1,-10],[2,-9],[9,-20],[4,-10],[2,-9],[0,-7],[-2,-10],[-5,-11],[-11,-10],[-6,-3],[-8,-7],[-7,-12],[-13,-26],[-18,-24],[-7,-4],[-20,-2],[-41,21],[-6,-1],[-4,-4],[-1,-8],[10,-34],[1,-12],[-1,-14],[-2,-22],[-1,-13],[1,-10],[2,-7],[14,-22],[10,-20],[3,-5],[4,-2],[28,5],[3,-1],[3,-4],[3,-4],[2,-11],[0,-6],[-8,-15],[-19,-25],[-27,-45],[-12,-11],[-8,-2],[-5,6],[-4,-4],[-3,-10],[0,-33],[2,-20],[3,-23],[-2,-12],[-5,-11],[-19,-22],[-9,-14],[-33,-80],[-9,-137],[0,-2]],[[5533,6245],[253,-64],[34,5],[27,49],[11,1],[33,-34],[34,-23],[9,-10],[13,-21],[72,-85]],[[6019,6063],[-40,-25],[-82,-252],[-8,-31],[2,-27],[-1,-16],[-1,-14],[-1,-52],[0,-42],[5,-53],[1,-29],[-8,-23],[-8,-22],[-9,-17],[-6,-15],[-5,-14],[-1,-24],[1,-32],[6,-64],[7,-33],[14,-28],[19,-8],[4,-5],[90,-152],[10,-40],[37,-216],[11,-100],[-1,-9],[-2,-10],[-1,-11],[1,-13],[3,-10],[6,-12],[16,-17],[13,-8],[19,-5],[6,-4],[14,-17],[16,-12],[4,-6],[0,-9],[-4,-37],[-7,-70],[-3,-17],[-3,-12],[-5,-14],[-4,-17],[-5,-20],[-4,-30],[-13,-128],[-5,-22],[-9,-31],[-7,-26],[-5,-27],[-3,-34],[1,-22],[2,-19],[6,-25],[2,-15],[0,-15],[-1,-14],[-1,-14],[4,-17],[9,-17],[31,-39],[4,-11],[-2,-9],[-3,-10],[-2,-9],[-1,-8],[0,-7],[8,-2],[74,13],[28,-8],[14,2],[31,35],[12,9],[39,1],[29,-44],[1,-2]],[[6358,3854],[-53,-115],[-26,-71],[-21,-84],[-68,-429],[-37,-156],[-44,-137],[-51,-106],[-40,-43],[-21,19],[-20,44],[-35,37],[-19,-18],[-53,-101],[-30,-26],[-31,6],[-18,14],[-15,-6],[-22,-54],[-7,-38],[-9,-97],[-13,-48],[-15,-24],[-33,-26],[-70,-88],[-5,-7],[-67,-43],[-41,-52],[-79,-153],[-42,-31],[-36,29],[-67,124],[-43,29],[-63,-50],[-17,4],[-16,51],[4,46],[10,47],[-1,53],[-31,78],[-41,13],[-81,-32],[-18,19],[-38,97],[-20,35],[-18,10],[-18,2],[-162,-89],[-30,-36],[-19,-78],[-17,-209],[-21,-86],[0,-2],[-1,-3],[1,-3],[0,-4],[3,-29],[1,-30],[-1,-28],[-3,-28],[-94,-138],[-237,11],[-105,-139],[-19,-8],[-218,55],[-105,-32],[-34,4]],[[3818,1704],[0,2],[-2,49],[-1,67],[4,18],[20,61],[5,26],[5,15],[6,13],[9,12],[8,13],[10,24],[13,35],[6,37],[1,37],[-11,99],[0,30],[5,39],[3,22],[4,16],[8,23],[2,11],[0,10],[0,17],[1,9],[-2,14],[-3,9],[-23,54],[-29,-53],[-9,-14],[-9,-10],[-8,-2],[-6,0],[-11,4],[-5,-2],[-6,-5],[-29,-14],[-25,-27],[-9,-6],[-12,-4],[-14,-9],[-6,-9],[-7,-7],[-13,-7],[-6,-9],[-5,-14],[-6,-23],[-2,-17],[-1,-10],[-1,-6],[-1,-4],[-4,0],[-11,2],[-8,-1],[-16,-11],[-9,-1],[-9,2],[-14,9],[-5,0],[-10,-3],[-5,0],[-7,4],[-8,10],[-34,55],[-8,9],[-9,5],[-9,1],[-8,-1],[-5,-6],[-5,-10],[-4,-18],[-3,-11],[-5,-8],[-4,-2],[-5,2],[-4,7],[-6,16],[-3,22],[-2,28],[0,32],[2,23],[10,28],[11,22],[8,19],[8,9],[3,9],[-1,16],[-7,36],[-14,53],[-3,19],[1,14],[7,13],[2,7],[0,9],[-16,35],[1,19],[7,26],[19,55],[22,44],[5,26],[4,20],[15,153],[-69,323],[-11,27],[-46,78],[-50,153],[-21,11],[-8,-6],[-10,-13],[-16,-41],[-25,-51],[-5,-14],[-7,-23],[-10,-23],[-2,-10],[-1,-13],[-2,-13],[-3,-12],[-8,-17],[-1,-17],[-1,-17],[-2,-13],[-4,-14],[-56,-38],[-110,-35],[-23,-15],[-14,-33],[-12,-38],[-3,-9],[-12,-22],[-5,-11],[-6,-23],[-8,1],[-18,61],[9,24],[15,31],[4,13],[4,12],[1,15],[2,13],[3,10],[11,20],[6,14],[7,22],[5,26],[4,33],[2,36],[-2,43],[-7,70],[-14,53],[-9,22],[-8,6],[-5,1],[-4,8],[-2,17],[2,30],[0,33],[-4,30],[-15,55],[-5,29],[1,36],[5,16],[15,39],[2,10],[-1,6],[-10,4],[-3,9],[-1,14],[3,35],[1,25],[1,25],[-4,25],[-6,15],[-15,11],[-15,0],[-43,-19],[-4,7],[2,19],[11,43],[26,64],[4,13],[-4,17],[-12,18],[-25,80]],[[2889,4316],[20,87],[172,44],[0,12],[1,8],[6,36],[1,9],[0,8],[0,9],[0,8],[1,10],[2,17],[5,16],[8,24],[26,62],[47,138],[96,-52],[10,1],[12,5],[0,22],[-4,47],[3,12],[6,13],[25,45],[7,18],[42,161],[8,23],[10,10],[26,2],[8,5],[6,9],[24,76],[21,90],[6,17],[4,14],[2,10],[1,36]],[[3491,5368],[75,108],[22,13],[3,-8],[2,-11],[1,-11],[3,-8],[2,-7],[3,-6],[4,-15],[1,-8],[30,-14],[149,-18],[24,90],[4,33],[6,63],[1,27],[-1,17],[-3,7],[-23,44],[-10,38],[-2,24],[2,16],[6,13],[6,21],[2,22],[-2,32],[-9,67],[0,18],[3,13],[29,29],[9,18],[5,13],[20,96],[84,-10],[290,85],[14,-1],[2,-9],[3,-19],[3,-6],[6,-6],[4,-12],[3,-20],[3,-43],[1,-20],[0,-13],[-2,-3],[-7,-1],[-2,-3],[-2,-7],[-4,-22],[3,-3],[6,-1],[71,23],[10,6],[9,14],[4,9],[2,9],[2,11],[2,34],[3,20],[19,50],[37,44],[59,147],[294,101],[134,-33],[112,-85],[14,-21],[9,-22],[7,-7],[17,-9],[7,-7],[5,-10],[5,-12],[9,-18],[6,-5],[7,0],[21,24],[80,48],[17,-1],[49,-28],[168,-8],[5,3],[21,5],[30,30],[10,1],[7,-2],[23,-36]],[[5309,7834],[2,-17],[37,-127],[9,-43],[6,-51],[1,-66],[2,-35],[8,-29],[6,-7],[5,2],[3,10],[6,14],[7,8],[13,3],[11,-5],[10,-18],[9,-30],[11,-53],[7,-20],[5,-5],[5,10],[4,4],[5,-5],[6,-21],[5,-14],[6,-10],[7,0],[34,13],[24,22],[9,6],[10,2],[5,-22],[1,-43],[-11,-159],[-1,-59],[-2,-45],[-8,-78],[-2,-68],[-3,-33],[-7,-14],[-11,-2],[-19,-19],[-10,-1],[-12,4],[-6,-4],[-2,-13],[2,-23],[59,-159],[11,-21],[9,-22],[5,-25],[3,-47],[7,-54],[4,-21],[3,-14],[6,-12],[9,-7],[19,-7],[4,-13],[-4,-22],[-19,-40],[-19,-30],[-60,-54]],[[3491,5368],[-4,52],[-6,17],[-60,152],[-11,37],[-6,27],[-6,39],[0,17],[1,14],[4,10],[-1,5],[-5,8],[-10,12],[-28,54],[-7,5],[-5,4],[-6,9],[-5,5],[-8,4],[-4,4],[-5,6],[-39,74],[-8,20],[-4,17],[0,31],[3,34],[0,13],[0,13],[-3,25],[0,16],[1,14],[5,32],[1,21],[-1,28],[-10,82],[-1,21],[3,12],[5,15],[2,11],[2,11],[0,9],[2,7],[3,5],[3,5],[4,6],[4,10],[4,10],[8,16],[-35,93],[-7,10],[-9,12],[-34,6],[-73,39],[-57,-34],[-17,1],[-3,10],[-11,44],[-4,8],[-5,0],[-22,-50],[-3,-9],[-1,-9],[-1,-10],[-6,-18],[-12,-23],[-47,-56],[-13,-5],[-7,2],[-24,17],[-32,12],[-15,23],[-10,43],[52,62],[7,12],[10,21],[16,58],[11,20],[11,14],[52,31],[17,26],[20,49],[23,68],[9,36],[4,30],[-5,72],[0,11],[2,11],[3,15],[0,9],[0,8],[-1,7],[0,8],[0,9],[3,22],[1,10],[-1,8],[-2,7],[-3,7],[-3,5],[-7,7],[-2,5],[-2,6],[-5,25],[-3,8],[-4,9],[-4,7],[-4,5],[-25,16],[-7,0],[-3,1],[-2,11],[6,20],[48,100],[-22,67],[-1,12],[-2,22],[1,20],[-1,40],[-5,26],[-14,40],[-9,17],[-33,41],[-10,5],[-6,6],[-8,10],[-21,40],[-6,8],[-4,3],[-6,0],[-3,1],[-42,57],[-10,19],[-9,26],[-22,82],[-3,12],[0,5],[-1,9],[-2,11],[-8,34],[-2,10],[1,7],[2,13],[1,8],[-2,14],[-4,19],[-109,362],[-1,10],[-2,11],[0,10],[-1,41],[-31,21],[-8,25]],[[2664,8533],[41,65],[3,191],[1,65],[52,-23],[39,52],[75,183],[57,63],[15,29],[9,48],[4,100],[9,45],[36,45],[78,-22],[50,53],[12,5],[12,-5],[58,-58],[51,-32],[49,6],[72,133],[33,25],[72,4],[173,-32],[51,-62],[-15,-91],[2,-77],[8,-74],[5,-80],[-8,-177],[10,-61],[35,-13],[44,7],[68,79],[38,19],[16,-12],[35,-51],[17,-17],[18,-2],[44,17],[54,44],[13,43],[5,67],[12,105],[5,3],[22,1],[7,11],[5,36],[-4,26],[-6,16],[-3,6],[29,176],[23,76],[26,49],[29,28],[33,15],[55,-1],[18,6],[25,20],[13,23],[152,335],[7,27],[10,9],[10,-8],[14,-12],[30,-104],[13,-29],[41,-54],[22,-109],[32,-272],[28,-172],[9,-39],[30,-46],[37,-20],[70,-1],[-8,-34],[-3,-30],[1,-84],[-4,-64],[0,-1],[101,-70],[39,-8],[35,7],[59,48],[16,-24],[0,-1],[16,-102],[9,-90],[11,-261],[-3,-22],[-14,-40],[-1,-23],[7,-18],[24,-36],[2,-13],[1,-2],[13,-28],[1,-1],[3,-24],[-4,-30],[-10,-12],[-11,-6],[-8,-13],[-67,-219],[-7,-70],[0,-1],[23,-63],[44,-32],[81,-13],[39,29],[25,52]],[[3818,1704],[-40,3],[-25,-24],[-85,-40],[-167,-77],[-31,-52],[-47,-201],[-17,-30],[-34,-12],[-16,-19],[-22,-58],[2,-20],[12,-22],[6,-62],[-18,-223],[-4,-114],[11,-101],[52,-104],[67,-102],[-2,-2],[-44,-32],[-39,-22],[-31,-47],[-58,-137],[-43,-55],[-51,-11],[-52,21],[-64,58],[-79,12],[-360,-86],[-131,-111],[-65,-13],[-217,46],[-402,-53],[-101,-14],[-147,83],[-40,45]],[[1536,128],[0,1],[14,30],[7,40],[12,126],[4,18],[4,9],[4,-2],[7,-8],[4,-2],[4,0],[3,-1],[5,-4],[10,7],[14,16],[33,53],[13,26],[7,22],[1,116],[6,36],[7,26],[9,21],[5,10],[5,3],[3,-2],[7,7],[14,20],[19,61],[42,77],[30,39],[11,22],[2,20],[-6,25],[-11,41],[3,64],[4,18],[2,17],[1,21],[-2,20],[-2,17],[-13,24],[4,139],[-12,188],[8,117],[0,29],[-5,22],[-4,7],[-5,3],[-6,0],[-3,1],[-7,5],[-13,3],[-5,4],[-8,14],[-3,8],[1,14],[7,43],[-3,19],[-6,6],[-10,-3],[-29,-21],[-10,-1],[-7,6],[-12,20],[-5,14],[-1,17],[3,20],[14,75],[1,44],[-9,37],[-77,176],[-1,19],[7,16],[28,23],[10,2],[6,-2],[12,-12],[12,-16],[5,-3],[5,1],[5,4],[5,6],[5,8],[3,9],[4,26],[1,31],[-5,31],[-15,59],[-5,25],[0,17],[12,12],[6,8],[4,1],[5,-5],[24,-61],[4,-5],[4,2],[20,33],[29,34],[7,14],[5,19],[6,39],[0,30],[-3,21],[-6,18],[-17,37],[-5,8],[-4,2],[-5,9],[-5,15],[-7,43],[-2,20],[2,16],[5,11],[6,18],[0,15],[-4,17],[-1,12],[3,16],[8,22],[12,44],[-46,84],[-2,11],[-2,16],[4,10],[4,9],[2,14],[8,90],[1,22],[2,22],[2,15],[8,80],[29,60],[124,459],[38,87],[-78,163],[-39,64],[-6,7],[-5,2],[-78,81],[31,71],[3,11],[54,284],[8,28],[5,-1],[6,-5],[22,-32],[11,-2],[15,4],[81,67],[9,13],[4,11],[-2,12],[-2,8],[-4,35]],[[2008,4677],[34,75],[4,7],[7,4],[5,-6],[8,-8],[3,6],[3,13],[3,35],[1,24],[-1,30],[-3,35],[-2,6],[-2,5],[-2,5],[-2,4],[-1,8],[-1,3],[-3,3],[-1,2],[-1,4],[-8,35],[-2,17],[-1,8],[-2,6],[-2,3],[-2,10],[-1,15],[0,37],[0,23],[-2,22],[-4,34],[0,18],[2,15],[8,22],[13,21],[36,-6],[5,-6],[6,-8],[0,-11],[0,-15],[2,-23],[3,-8],[125,-55],[14,-18],[38,-81],[10,-26],[19,-73],[14,-40],[76,-89],[31,-16],[20,-40],[14,-48],[1,-33],[-11,-51],[-14,-46],[-15,-54],[-1,-35],[4,-22],[4,-12],[6,-12],[0,-26],[5,-10],[7,-4],[21,1],[7,-6],[7,-12],[9,-21],[34,-47],[8,-18],[17,-74],[20,-122],[43,-32],[11,-2],[2,5],[3,19],[5,20],[4,3],[3,-3],[12,-35],[11,-21],[4,3],[2,4],[1,7],[1,5],[3,6],[26,32],[56,101],[124,153]],[[2008,4677],[-171,75],[-2,12],[-5,12],[-11,25],[-8,8],[-10,2],[-6,-6],[-6,-7],[-10,-7],[-7,3],[-8,17],[-14,45],[-14,27],[-6,9],[-5,3],[-2,-4],[-1,-6],[1,-7],[0,-8],[1,-8],[-1,-8],[-10,-5],[-61,-2],[-32,10],[-33,33],[-6,8],[-3,9],[-19,72],[-16,39],[-23,24],[-30,-17],[-55,-48],[-10,-20],[-5,-6],[-6,-2],[-17,0],[-4,3],[-13,27],[-3,3],[-3,-3],[-2,-8],[-1,-10],[-1,-23],[1,-18],[0,-7],[-1,-8],[0,-8],[1,-11],[-6,-14],[-5,-21],[-57,-35],[-25,29],[-3,0],[-5,-2],[-3,-7],[-4,-7],[-12,-14],[-41,-72],[-38,170],[-20,58],[-17,34],[-7,19],[-5,15],[-5,60],[-5,17],[-10,18],[-3,12],[-1,14],[3,19],[3,14],[7,26],[3,14],[3,19],[2,10],[7,15],[3,15],[1,37],[-6,34],[-9,34],[-14,41],[-7,17],[-6,10],[-15,7],[-4,4],[-3,4],[-3,5],[-3,4],[-17,39],[-21,60],[-9,20],[-9,3],[-29,-75],[-6,-11],[-4,-2],[-6,0],[-21,10],[-39,30],[55,107],[19,52],[16,77],[5,34]],[[995,5833],[32,43],[42,25],[26,-26],[53,-115],[64,-20],[195,155],[143,114],[31,53],[60,211],[29,48],[43,15],[37,-13],[34,4],[32,64],[14,74],[14,167],[11,80],[23,94],[37,48],[42,14],[94,-15],[59,54],[51,97],[37,125],[11,119],[-2,241],[0,32],[6,145],[23,177],[32,165],[43,138],[51,99],[237,185],[65,103]],[[1536,128],[-75,84],[-18,42],[-14,55],[-33,65],[-36,54],[-26,27],[-20,-6],[-17,-18],[-19,-2],[-21,46],[-59,184],[-17,23],[-44,19],[-18,16],[-17,32],[-180,499],[-56,95],[-114,36],[-18,10]],[[184,4292],[9,68],[-16,252],[4,103],[28,69],[20,75],[89,521],[43,149],[60,107],[25,65],[11,102],[16,50],[94,139],[79,34],[84,-44],[200,-206],[31,11],[34,46]],[[9703,5984],[-4,-10],[-11,-65],[-2,-43],[4,-44],[4,-183],[-4,-36],[-13,-62],[-15,-45],[-16,-26],[-14,-36],[-5,-72],[2,-116],[-11,-115],[-22,-100],[-28,-76],[-21,-28],[-47,-31],[-21,-30],[-14,-38],[-18,-86],[-11,-39],[-115,-190],[-26,-87],[-3,-110],[20,-219],[-6,-84],[-20,-88],[-1,-389],[-33,-88],[-31,-49],[-33,-20],[-105,21],[-32,-4],[-32,-23],[-91,-9],[-26,-21],[-54,-63],[-75,-23],[-91,-95],[-54,-10],[-55,39],[-46,70],[-42,99],[-98,310],[-14,58],[-23,223],[-15,61],[-30,14],[-65,-2],[-28,26],[-12,38],[-16,105],[-11,46],[-15,28],[-32,26],[-59,72],[-26,16],[-91,-59],[-60,-3],[-29,-12],[-34,-42],[-15,-50],[-10,-58],[-21,-60],[-26,-30],[-19,18],[-22,37],[-32,29],[-58,-27],[-136,-133],[-45,21],[-35,71],[-49,46],[-52,19],[-44,-7],[-62,11],[-96,120],[-55,12],[-25,13],[-53,97],[-27,30],[-28,-1],[-372,-176],[-109,-15],[-50,-41],[-2,-41],[-1,-45],[4,-94],[1,-19],[0,-19],[-1,-19],[-1,-19],[-24,-72],[-4,-9]],[[6019,6063],[26,50],[20,105],[12,35],[10,21],[52,68],[-25,66],[-23,15],[-21,6],[-5,12],[1,11],[21,40],[22,63],[9,18],[23,31],[77,69],[12,21],[5,6],[5,1],[3,-5],[6,2],[8,9],[27,54],[8,7],[4,-4],[4,-8],[2,-6],[13,-6],[40,-55],[27,-80],[7,-15],[3,-4],[-1,6],[-2,4],[-3,5],[-3,9],[-3,14],[-3,27],[-1,12],[1,8],[5,5],[41,29],[7,8],[-1,9],[-9,33],[2,17],[5,19],[14,28],[8,5],[9,-7],[2,-14],[-4,-39],[3,-16],[10,-18],[46,-72],[42,-51],[37,-8],[14,-7],[9,-9],[4,-13],[21,-72],[11,-10],[21,-3],[21,5],[19,17],[7,9],[5,9],[9,19],[1,6],[-1,7],[-5,21],[-1,9],[0,8],[2,7],[7,7],[12,7],[32,4],[110,-37],[6,4],[3,5],[0,6],[-3,6],[-9,13],[-3,5],[-2,6],[0,10],[1,13],[2,22],[1,15],[0,14],[-5,18],[-1,11],[2,15],[5,2],[19,-10],[42,-38],[28,-13],[9,-10],[1,-11],[-7,-16],[1,-13],[5,-14],[20,-19],[11,-5],[9,-2],[55,24],[35,-62],[37,-11],[49,-66],[8,-3],[3,7],[1,7],[6,7],[10,7],[24,7],[10,-2],[7,-8],[5,-28],[1,-14],[0,-12],[-1,-15],[4,-25],[8,-24],[29,-57],[5,-15],[0,-9],[2,-13],[4,-17],[10,-31],[7,-13],[6,-5],[7,3],[5,3],[24,6],[67,-46],[34,-9],[8,1],[32,21],[9,-1],[6,-5],[6,-8],[8,-10],[7,-10],[5,-10],[3,-12],[6,-15],[8,-20],[16,-29],[10,-9],[36,14],[25,-19],[17,-1],[13,-11],[12,-19],[8,-5],[10,2],[11,9],[5,-2],[2,-7],[1,-9],[3,-19],[0,-8],[-3,-8],[-10,-21],[-4,-10],[-3,-11],[-10,-25],[-3,-11],[-2,-12],[0,-11],[1,-14],[19,-62],[32,-59],[19,-20],[22,-5],[23,5],[5,5],[2,5],[-1,4],[-2,6],[-9,14],[-2,8],[-2,11],[0,11],[1,12],[3,10],[4,10],[7,6],[9,3],[25,0],[8,2],[21,17],[28,6],[5,4],[7,6],[6,12],[5,23],[5,39],[5,70],[-1,17],[-2,13],[-6,22],[2,9],[7,10],[16,11],[8,0],[7,-4],[12,-21],[7,-17],[5,-3],[3,11],[2,21],[2,41],[4,11],[3,-1],[2,-13],[1,-13],[5,-18],[7,-19],[23,-23],[13,-4],[14,7],[9,11],[4,9],[25,25],[20,-103],[2,-27],[2,-54],[6,-33],[10,-41],[8,-26],[51,-187],[110,-88],[46,-17],[31,3],[14,-3],[12,-11],[33,-49],[20,-13],[16,-4],[14,5],[10,7],[7,8],[5,8],[3,9],[2,18],[2,7],[11,12],[40,15],[29,53],[34,23],[9,12],[7,16],[6,29],[3,24],[-1,19],[-2,22],[-10,48],[-3,16],[0,14],[1,34],[-1,10],[-8,56],[-1,21],[0,71],[-1,16],[-2,10],[-1,10],[2,137],[66,-4],[170,-112],[24,-24],[10,-12],[4,-9],[-1,-8],[11,-19],[80,-98],[37,-20],[33,-2],[52,18],[101,4],[7,4],[3,5],[3,16],[-1,26],[-5,51],[-7,50],[-2,13],[0,12],[1,12],[6,14],[5,10],[37,33],[66,181],[47,2],[31,-36],[5,-20],[2,-22],[1,-20],[3,-25],[27,-130],[1,-35],[2,-27],[6,-13],[9,-7],[58,7],[45,27],[9,1],[80,-42],[2,-1]],[[5309,7834],[34,71],[32,48],[56,12],[49,-51],[91,-172],[58,-57],[34,53],[18,135],[10,189],[22,53],[12,60],[10,64],[34,152],[10,26],[4,-8],[39,-9],[17,32],[38,92],[27,30],[135,24],[9,24],[13,75],[9,77],[3,50],[7,33],[18,27],[21,1],[72,-54],[90,7],[0,92],[27,13],[149,-152],[38,-19],[42,30],[20,38],[28,69],[18,21],[16,2],[38,-12],[66,22],[28,-10],[156,-374],[27,-41],[40,-12],[30,4],[27,-9],[33,-49],[29,-60],[28,-41],[33,-13],[41,30],[38,66],[57,169],[36,71],[28,11],[37,1],[32,13],[15,50],[-22,81],[-40,50],[-22,49],[36,79],[27,26],[71,29],[27,-5],[32,-44],[25,-56],[27,-37],[38,13],[30,56],[55,163],[31,44],[25,-11],[98,-106],[171,-97],[29,1],[65,29],[26,-16],[32,26],[27,22],[125,29],[33,-18],[18,-24],[33,-63],[17,-25],[14,-4],[27,12],[17,-10],[30,-61],[59,-182],[27,-44],[18,24],[25,60],[30,55],[36,14],[32,-37],[64,-119],[95,-95],[63,-120],[51,-164],[22,-191],[11,-172],[50,-73],[124,-48],[58,-74],[20,-18],[17,-2],[43,10],[14,-6],[19,-43],[1,-38],[-5,-35],[4,-34],[13,-22],[82,-51],[97,7],[38,-30],[88,-180],[65,-40],[137,-12],[61,-61],[-13,-89],[-13,-123],[-8,-124],[0,-92],[-27,-46],[-67,-21],[-31,-49],[-38,-226],[-22,-96],[-2,-27],[0,-70],[-3,-32],[-17,-49],[-42,-72],[-13,-39]]],"transform":{"scale":[0.0005695725822582284,0.00018519584708470273],"translate":[16.84448042800011,47.75000640900009]}};
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
