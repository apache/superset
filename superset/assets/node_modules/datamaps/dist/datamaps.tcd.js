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
  Datamap.prototype.svkTopo = '__SVK__';
  Datamap.prototype.svnTopo = '__SVN__';
  Datamap.prototype.sweTopo = '__SWE__';
  Datamap.prototype.swzTopo = '__SWZ__';
  Datamap.prototype.sxmTopo = '__SXM__';
  Datamap.prototype.sycTopo = '__SYC__';
  Datamap.prototype.syrTopo = '__SYR__';
  Datamap.prototype.tcaTopo = '__TCA__';
  Datamap.prototype.tcdTopo = {"type":"Topology","objects":{"tcd":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Hadjer-Lamis"},"id":"TD.HD","arcs":[[0,1,2,3,4,5,6]]},{"type":"Polygon","properties":{"name":"Kanem"},"id":"TD.KM","arcs":[[7,-1,8,9,10]]},{"type":"Polygon","properties":{"name":"Lac"},"id":"TD.LC","arcs":[[-7,11,-9]]},{"type":"Polygon","properties":{"name":"Batha"},"id":"TD.BA","arcs":[[12,13,14,15,-3,16,17]]},{"type":"Polygon","properties":{"name":"Wadi Fira"},"id":"TD.BI","arcs":[[18,19,-13,20,21]]},{"type":"Polygon","properties":{"name":"Guéra"},"id":"TD.GR","arcs":[[22,23,24,25,-4,-16]]},{"type":"Polygon","properties":{"name":"Ouaddaï"},"id":"TD.OA","arcs":[[26,27,-14,-20]]},{"type":"Polygon","properties":{"name":"Logone Occidental"},"id":"TD.LO","arcs":[[28,29,30]]},{"type":"Polygon","properties":{"name":"Logone Oriental"},"id":"TD.LR","arcs":[[31,32,33,-29,34]]},{"type":"Polygon","properties":{"name":"Mayo-Kebbi Est"},"id":"TD.ME","arcs":[[35,36,37,38]]},{"type":"Polygon","properties":{"name":"Tandjilé"},"id":"TD.TA","arcs":[[39,40,-35,-31,41,-36,42]]},{"type":"Polygon","properties":{"name":"Mandoul"},"id":"TD.MA","arcs":[[43,44,-32,-41]]},{"type":"Polygon","properties":{"name":"Salamat"},"id":"TD.SA","arcs":[[45,46,47,-24]]},{"type":"Polygon","properties":{"name":"Ville de N'Djamena"},"id":"TD.NJ","arcs":[[48,49]]},{"type":"Polygon","properties":{"name":"Mayo-Kebbi Ouest"},"id":"TD.MW","arcs":[[-37,-42,-30,-34,50]]},{"type":"Polygon","properties":{"name":"Borkou"},"id":"TD.BR","arcs":[[51,-21,-18,52,-11,53,54,55]]},{"type":"Polygon","properties":{"name":"Tibesti"},"id":"TD.TI","arcs":[[-55,56]]},{"type":"Polygon","properties":{"name":"Ennedi"},"id":"TD.EN","arcs":[[-22,-52,57]]},{"type":"Polygon","properties":{"name":"Chari-Baguirmi"},"id":"TD.CG","arcs":[[-26,58,-43,-39,59,-50,60,-5]]},{"type":"Polygon","properties":{"name":"Barh El Gazel"},"id":"TD.BG","arcs":[[-17,-2,-8,-53]]},{"type":"Polygon","properties":{"name":"Sila"},"id":"TD.SI","arcs":[[61,-46,-23,-15,-28]]},{"type":"Polygon","properties":{"name":"Moyen-Chari"},"id":"TD.MO","arcs":[[62,-44,-40,-59,-25,-48]]}]}},"arcs":[[[2004,3633],[173,-52],[32,-6],[67,-2],[23,2],[12,10]],[[2311,3585],[77,-41],[5,-6],[15,-39],[13,-2],[234,3],[10,1],[14,3],[18,6],[15,3],[8,1],[9,0],[35,-3],[11,-2],[22,-1],[13,-2],[14,-4],[10,-3],[6,0],[6,0],[8,3],[5,2],[11,7],[7,4],[8,3],[219,20],[11,2],[8,3],[8,3],[15,9],[6,2],[10,2],[19,4],[10,2],[7,2],[5,0],[14,-5],[8,-3],[24,-2],[7,0],[17,4],[11,2],[54,5],[7,1],[6,2],[13,9],[4,1],[8,0],[51,-7],[68,-17]],[[3495,3557],[-41,-39],[-15,-11],[-13,-6],[-85,-52],[-24,-23],[-3,-4],[-1,-3],[0,-5],[1,-4],[3,-3],[3,-2],[29,-16],[23,-8],[29,-15],[6,-5],[41,-51],[4,-6],[15,-40],[13,-22],[6,-8],[3,-2],[3,-3],[4,-2],[4,-1],[10,-3],[5,-1],[3,-2],[4,-4],[8,-15],[4,-5],[4,-4],[8,-4],[8,-7],[3,-2],[4,-2],[5,-2],[5,0],[6,-1],[12,1],[6,0],[7,-2],[6,-2],[7,-7],[1,-5],[1,-8],[24,-78],[4,-9],[17,-15],[4,-2],[4,-1],[23,-6],[4,-2],[3,-2],[3,-4],[6,-10],[3,-3],[10,-6],[6,-6],[3,-5],[1,-5],[-1,-17],[2,-4],[2,-3],[13,-9],[4,-2],[4,-2],[6,-1],[11,-1],[11,-1],[6,1],[6,0],[10,2],[5,1],[6,0],[5,-1],[4,-1],[8,-4],[4,-1],[5,-1],[20,-2],[6,0],[5,-2],[8,-3],[4,-2],[8,-3],[8,-2]],[[3902,2939],[7,-16],[-45,-105],[-3,-9],[0,-9],[6,-11],[97,-125],[-158,-30],[-184,-109]],[[3622,2525],[-136,45],[-58,38],[-68,38],[-68,7],[-77,0],[-49,25],[-9,90],[-49,38],[-48,38],[0,71],[-29,70],[-117,38],[-436,109],[-77,-58],[-97,-19],[-155,6],[-155,-25],[-49,-26],[-87,7],[-39,32],[-58,6],[-39,-26],[-97,-12],[-87,-13],[-68,0],[-88,-7]],[[1382,2997],[1,44],[2,5],[-16,48],[-13,15],[-1,3],[2,7],[-1,2],[-5,3],[-6,1],[-4,0],[2,-4],[-8,5],[-5,1],[-1,1],[1,7],[1,4],[8,9],[4,4],[-32,77],[-11,12],[-31,-4],[-17,1],[-7,10],[-2,6],[-6,6],[-9,5],[-8,2],[-5,-2],[-15,-15],[-11,10],[14,21],[-6,10],[-16,4],[-28,-5],[-15,5],[-6,4],[-17,7],[-3,4],[0,3],[-2,4],[-8,2],[-6,-1],[-18,-9],[-9,-1],[-5,3],[-1,6],[0,6],[-8,-2],[-6,1],[-3,2],[-2,6],[0,24],[-17,11],[-29,14],[-10,9],[0,8],[15,29],[2,13],[-3,10],[-8,9],[-14,10],[-1,1]],[[979,3468],[19,0],[472,-1],[9,1],[6,1],[3,4],[6,15],[14,22],[5,15],[0,4],[-1,3],[-17,36],[-2,3],[-3,2],[-4,2],[-7,4],[-3,3],[-2,3],[-1,12],[-3,11],[-4,5],[-4,6],[-1,3],[0,4],[3,2],[5,2],[7,0],[19,-4],[15,-5],[20,-4],[12,-2],[5,-1],[5,-1],[4,-2],[6,-2],[10,-2],[28,-3],[33,-8],[4,-1],[4,-2],[2,-2],[2,-3],[0,-7],[0,-3],[3,-2],[4,-2],[23,-7],[4,-2],[5,-5],[4,-2],[4,-2],[3,-2],[3,-2],[7,-13],[3,-2],[3,-3],[3,-2],[4,-1],[5,-1],[5,1],[6,4],[2,4],[2,4],[2,8],[1,4],[3,2],[3,2],[3,0],[8,2],[5,1],[5,-1],[7,-5],[3,0],[5,1],[49,26],[3,2],[1,3],[0,4],[-5,9],[-3,3],[-3,2],[-5,1],[-46,6],[-5,1],[-4,2],[-3,2],[-82,75],[-5,7],[5,4],[10,2],[121,15],[10,0],[6,-3],[4,-3],[23,-25],[11,-9],[17,-11],[8,-3],[114,-34]],[[3058,5557],[-173,-190],[-213,-486],[-126,-281],[-19,-146],[-59,-64],[-261,-205],[-175,-44],[10,-202],[110,0],[5,2],[4,2],[21,16],[4,2],[6,0],[5,0],[11,-2],[20,-5],[22,-3],[21,-5],[5,-2],[5,-3],[5,-8],[3,-9],[4,-14],[0,-4],[-5,-8],[-17,-20],[-2,-4],[0,-5],[10,-21],[3,-8],[4,-9],[3,-3],[8,-7],[20,-14],[6,-5],[2,-9],[1,-169],[-3,-15],[-12,-24]],[[2004,3633],[-175,305],[-155,-1],[-282,-45],[-8,-1],[-47,6],[-7,0],[-10,-1],[-23,-11],[-10,-3],[-9,5],[-144,149],[-27,20],[-37,21],[-11,8],[-83,73],[-7,4],[-6,3],[-10,2],[-11,2],[-62,4],[-8,1],[-11,3],[-9,7],[-27,25],[-10,8],[-44,9],[-13,7],[-55,39],[-32,10],[-6,4],[-4,3],[-4,9],[-7,27],[-2,4],[-5,5],[-5,3],[-6,0],[-6,0],[-3,2],[-17,14],[-7,3],[-6,2],[-12,1],[-33,0],[-9,1],[-5,2],[-4,2],[-11,12],[-43,8],[-157,7],[-7,2],[-7,5],[-9,9],[-13,6],[-11,2],[-13,1],[-101,0],[-7,1]],[[151,4417],[15,2],[32,17],[7,11],[1,12],[-6,24],[-3,3],[-10,6],[-1,4],[3,3],[19,8],[30,22],[10,5],[19,2],[18,1],[14,5],[9,15],[-2,13],[-13,26],[-4,13],[1,13],[6,12],[14,20],[31,42],[24,34],[28,25],[28,25],[28,26],[29,25],[28,26],[28,25],[29,26],[28,25],[28,26],[29,25],[28,26],[28,25],[29,26],[28,25],[28,26],[29,25],[28,25],[27,25],[52,35],[55,38],[37,26],[53,36],[54,37],[53,36],[53,36],[53,37],[54,36],[53,37],[53,36],[53,37],[54,36],[53,37],[53,36],[53,37],[54,36],[53,37],[53,36],[32,22],[13,12],[3,6]],[[1917,5909],[15,-4],[1126,-348]],[[979,3468],[-43,43],[-16,7],[-336,-2],[-217,196],[-217,196],[-7,20],[-7,19],[-6,20],[-7,20],[-7,20],[-7,20],[-6,20],[-7,20],[-7,20],[-7,20],[-7,20],[-7,20],[-6,20],[-7,20],[-7,19],[-7,20],[-10,29],[-13,32],[-18,43],[0,37],[31,28],[25,8],[34,9],[38,2],[23,3]],[[6217,5208],[0,-1018]],[[6217,4190],[0,-91],[214,-69],[9,-5],[4,-4],[-7,-135],[5,-14],[8,-13],[34,-34],[2,-6],[-1,-100],[22,-112],[-1,-66],[-3,-7],[-6,-9]],[[6497,3525],[-25,-26],[-7,-4],[-5,-2],[-10,-2],[-244,-32],[-7,-3],[2,-3],[7,-4]],[[6208,3449],[-270,53],[-223,-64],[-288,-111],[-52,-15],[-15,-2],[-14,0],[-578,14],[-17,-1],[-19,-3],[-341,-122],[-28,-12],[-44,-35],[-12,-7],[-13,-3],[-107,-6],[-16,-3],[-17,-4],[-248,-138],[-18,-17],[14,-34]],[[3495,3557],[61,57],[6,10],[2,13],[-7,143],[1,7],[30,116],[3,8],[5,7],[11,4],[286,58],[419,1123]],[[4312,5103],[88,-53],[118,-46],[58,-16],[199,-30],[78,0],[28,4],[189,38],[96,28],[41,16],[106,58],[51,38],[28,35],[73,131],[2,8],[9,75],[-4,63],[2,3],[4,2],[6,0],[10,-2],[15,-8],[6,-3],[10,0],[18,2],[6,0],[12,-1],[32,-6],[7,-2],[7,-3],[12,-7],[6,-4],[3,-4],[5,-14],[13,-58],[1,-4],[2,-3],[8,-8],[13,-9],[125,-51],[16,-4],[75,-8],[115,-23],[37,-11],[50,-9],[129,-9]],[[9178,5160],[-23,-2],[-25,-11],[-61,-47],[-75,-29],[-18,-14],[-7,-20],[7,-18],[16,-16],[20,-14],[21,-18],[9,-19],[2,-21],[-12,-73],[-7,-14],[-43,-50],[-7,-6],[-32,-8],[-22,-7],[-19,-10],[-85,-58],[-11,-13],[-5,-15],[-1,-12],[-5,-10],[-19,-11],[-35,-15],[-8,-10],[0,-16],[8,-34],[5,-11],[15,-20],[1,-6],[-4,-9],[-10,-4],[-191,-33],[-40,-12],[-39,-19],[-17,-22],[21,-24],[30,-14],[7,-8],[13,-67],[3,-4],[5,-3],[4,-4],[-1,-5],[-5,-3],[-13,-4],[-4,-2],[-9,-11],[-1,-5],[3,-7],[9,-14],[11,-9],[16,-6],[54,-6],[16,-6],[9,-13],[6,-20],[-1,-18],[-14,-11],[-22,-5],[-25,-3],[-22,-8],[-35,-21],[-19,-9],[-150,-46],[-28,-11],[-22,-15],[-10,-8]],[[8287,4043],[-26,-2],[-15,0],[-12,2],[-11,7],[-23,23],[-4,3],[-40,16],[-323,70],[-253,25],[-13,1],[-57,-3],[-27,-3],[-44,-15],[-8,-3],[-16,-7],[-9,-2],[-19,-4],[-10,-1],[-18,1],[-33,5],[-92,30],[-67,30],[-4,0],[-6,0],[-11,-1],[-9,2],[-6,1],[-4,2],[-56,38],[-23,20],[-20,30],[-3,2],[-3,3],[-3,2],[-28,6],[-7,2],[-8,4],[-14,9],[-4,1],[-5,2],[-21,4],[-5,2],[-7,4],[-4,1],[-168,36],[-7,1],[-9,0],[-43,-3],[-5,-1],[-4,-1],[-44,-15],[-6,-1],[-6,0],[-11,1],[-34,5],[-5,0],[-4,-1],[-9,-3],[-4,-1],[-5,0],[-4,1],[-5,2],[-5,1],[-11,1],[-6,1],[-17,-1],[-7,-1],[-6,-2],[-7,-6],[-6,-8],[-4,-3],[-4,-2],[-23,-4],[-4,-2],[-3,-4],[-5,-9],[-15,-6],[-53,-28],[-150,-107]],[[6217,5208],[77,-6],[31,-6],[19,-7],[47,-22],[90,-28],[13,-3],[6,0],[6,1],[46,8],[38,11],[86,7]],[[6676,5163],[8,0],[5,-2],[9,-3],[17,-6],[21,-4],[11,-1],[9,0],[19,4],[9,3],[27,13],[33,12],[164,39],[60,25],[13,9],[12,10],[17,20],[3,2],[7,5],[7,4],[18,6],[55,10],[17,6],[23,13],[13,5],[5,1],[6,0],[8,-3],[68,-28],[105,-28],[11,-2],[7,0],[7,1],[55,20],[11,2],[241,32],[49,10],[35,5],[10,1],[14,-1],[5,-1],[78,-17],[44,-13],[17,-3],[7,0],[6,0],[43,12],[22,9],[26,5],[40,3],[31,-1],[24,-2],[24,-5],[6,1],[4,1],[12,8],[6,3],[4,0],[2,0],[2,-1],[26,-16],[38,-20],[9,-3],[12,-3],[8,-1],[14,-1],[9,0],[8,0],[5,1],[14,3],[5,2],[10,4],[8,3],[6,0],[8,0],[5,-1],[4,-2],[7,-4],[4,-2],[4,-1],[21,-5],[12,-1],[37,-9],[4,-2],[4,-4],[5,-10],[3,-3],[3,-2],[3,-2],[4,-1],[7,-2],[5,-1],[3,-2],[2,-3],[3,-6],[3,-3],[4,-2],[4,-2],[4,-2],[2,-3],[2,-3],[2,-3],[3,-2],[6,-2],[10,-2],[6,1],[6,1],[13,4],[5,1],[10,1],[29,1],[34,4],[20,0],[27,-1],[8,0],[18,4],[12,2],[8,0],[6,-1],[5,-1],[19,-10],[4,-1],[6,-2],[24,-2],[4,-1],[6,-2],[7,-2],[13,-3],[9,0],[7,0],[11,1],[20,4],[19,6],[7,1],[13,2],[9,1],[7,0],[22,-3],[57,-14],[5,-2],[4,-2],[3,-2],[46,-47],[1,-2]],[[6208,3449],[139,-69],[5,-1],[4,0],[9,2],[4,0],[4,-1],[3,-2],[3,-2],[3,-3],[1,-5],[-1,-9],[1,-14],[-1,-5],[-4,-5],[-10,-8],[-7,-2],[-7,-1],[-5,1],[-5,0],[-5,0],[-5,-3],[-64,-55],[-6,-7],[-1,-5],[2,-4],[6,-5],[30,-19],[5,-5],[2,-3],[0,-2],[-1,-3],[-4,-4],[-15,-7],[-15,-4],[-4,-1],[-4,-2],[-6,-5],[-7,-4],[-23,-23],[-35,-22],[-22,-21],[-7,-5],[-6,-4],[-4,-1],[-4,-2],[-4,-2],[-5,-5],[-5,-5],[-28,-40],[-61,-113],[-2,-12],[1,-36]],[[6047,2896],[-169,7],[-196,34],[-44,4],[-162,-99],[66,-70],[5,-10],[-2,-8],[-5,-9],[-91,-107],[-14,-8],[-13,-6],[-84,-20],[-11,-2],[-9,0],[-6,6],[-26,42],[-6,6],[-9,3],[-6,0],[-104,-1],[-13,-2],[-5,-6],[-3,-8],[-18,-182],[1,-6],[2,-3],[5,-6],[2,-4],[1,-5],[3,-3],[4,-2],[19,-2],[5,-1],[3,-2],[3,-3],[2,-3],[3,-2],[4,-2],[5,-1],[11,0],[5,-1],[4,-2],[2,-3],[4,-6],[2,-3],[4,-2],[4,-1],[5,-2],[5,-1],[10,-2],[4,-2],[15,-8],[38,-15],[4,-1],[18,-2],[5,-2],[3,-2],[3,-2],[2,-3],[3,-2],[5,-2],[16,-2],[5,-1],[13,-5],[19,-10],[4,-1],[6,-1],[17,0],[6,-1],[4,-1],[4,-2],[3,-3],[4,-2],[9,-2],[16,-4],[12,-5],[5,-1],[5,-1],[18,-2],[5,-1],[4,-2],[4,-2],[9,-7],[4,-2],[36,-12],[5,-1],[5,0],[16,2],[5,0],[6,0],[5,-1],[4,-2],[3,-2],[3,-3],[10,-11],[3,-2],[4,-3],[4,-1],[5,-2],[11,-1],[12,-1],[5,0],[16,3],[5,1],[5,0],[6,-1],[4,-2],[4,-2],[9,-6],[4,-2],[5,-2],[4,-1],[5,-1],[3,1],[8,1],[6,0],[5,0],[5,-1],[9,-3],[5,-1],[8,-3],[4,-3],[4,-1],[4,-2],[6,-1],[11,-1],[5,-1],[5,-2],[4,-1],[6,-5],[1,0],[9,-3],[11,-1],[5,-2],[4,-1],[3,-3],[14,-12],[6,-8],[4,-5],[4,-3],[5,-2],[6,0],[5,-2],[6,-2],[4,-5],[0,-3],[-3,-2],[-15,-7],[-7,-4],[-1,-12],[11,-108],[-18,-54]],[[5893,1978],[-17,-9],[-25,-5],[-4,-3],[0,-3],[1,-3],[-3,-4],[-8,-3],[-4,-3],[-4,-3],[-6,-10],[-4,-2],[-4,-1],[-3,2],[-3,3],[-4,2],[-7,1],[-3,-2],[0,-3],[1,-3],[0,-4],[-21,-24],[-6,-1],[-6,-1],[-7,0],[-24,-4],[-9,0],[-14,-2],[-7,0],[-4,3],[0,3],[1,2],[-1,3],[-1,0],[-2,1],[-7,0],[-6,-1],[-8,-4],[-7,-2],[-9,-2],[-8,-2],[-8,-4],[-8,-2],[-6,-3],[-16,-10],[-10,-9],[-4,-5],[-10,-7],[-3,-5],[-1,-4],[3,-6],[0,-4],[-4,-2],[-6,0],[-4,-2],[-2,-3],[-1,-2],[1,-4],[0,-3],[-2,-4],[-5,-2],[-5,-1],[-12,1],[-8,-1],[-3,-2],[-1,-3],[3,-2],[4,-2],[4,-2],[2,-3],[0,-3],[-3,-4],[-1,-3],[1,-2],[8,-4],[3,-3],[-3,-2],[-5,-1],[-5,0],[-6,-1],[-2,-3],[-1,-4],[-4,-3],[-7,-3],[-12,-4],[-6,-4],[-4,-4],[-4,-4],[-5,-7],[-7,-5],[-3,-5],[-4,-3],[-6,-1],[-7,-1],[-8,-3],[-5,-3],[-3,-3],[-17,-20],[-4,-10],[-4,-8],[-3,-1],[-3,1],[-3,1],[-5,0],[-8,-2],[-9,-6],[-6,-2],[-5,0],[-4,0],[-3,-2],[-3,-2],[-4,-6],[-6,-7],[-6,-5],[-12,-12],[-15,-12],[-14,-8],[-11,-6],[-37,-12],[-52,-5],[-130,-1],[-11,-2],[-6,-7],[-21,-57],[-4,-5],[-5,-2],[-27,-3],[-19,-5],[-11,-1],[-7,0],[-11,6],[-19,13],[-5,2],[-5,1],[-7,0],[-11,0],[-7,0],[-6,1],[-9,3],[-3,2],[-2,1],[0,1],[9,54],[0,6],[-1,3],[-2,3],[-3,2],[-4,2],[-10,2],[-5,2],[-3,2],[-3,3],[-2,6],[-2,3],[-3,3],[-12,5],[-4,2],[-20,13],[-4,1],[-5,1],[-6,1],[-5,1],[-4,2],[-6,4],[-12,14],[-7,9],[-3,2],[-7,4],[-6,4],[-7,9],[-3,2],[-3,2],[-4,2],[-52,9],[-9,3],[-7,4],[-7,4],[-11,10],[-5,2],[-6,1],[-10,1],[-20,3],[-39,1],[-6,1],[-3,2],[-4,2],[-4,3],[-19,6],[-4,1],[-3,3],[-3,6],[-3,3],[-6,1],[-19,1],[-5,1],[-7,4],[-4,3],[-8,1],[-6,1],[-4,2],[-2,3],[-1,7],[-2,4],[-2,2],[-4,3],[-6,1],[-8,2],[-5,-1],[-4,-2],[-4,-3],[-5,-2],[-5,-1],[-4,2],[-6,5],[-6,2],[-19,2],[-7,1],[-5,2],[-5,-1],[-8,-5],[-4,0],[-4,1],[-4,2],[-5,2],[-8,0],[-22,5],[-15,2],[-5,1],[-13,5],[-9,2],[-11,2],[-6,1],[-6,3],[-80,49],[-6,3],[-7,3],[-278,-7]],[[3877,1881],[-226,76],[19,102],[-19,140],[-39,166],[10,160]],[[8287,4043],[-77,-63],[-23,-25],[-1,-5],[22,-14],[15,-12],[3,-9],[-2,-10],[0,-14],[17,-24],[61,-37],[13,-24],[1,-36],[4,-12],[13,-15],[33,-26],[12,-14],[-8,-26],[-34,-29],[-88,-60],[-15,-7],[-102,-26],[-17,-6],[-33,-20],[-27,-25],[-78,-96],[-24,-46],[-15,-20],[-2,-4]],[[7935,3338],[-107,24],[-116,31],[-87,-19],[-97,-38],[-88,-57],[-48,-13],[-39,6],[-97,7],[-106,-20],[-126,32],[0,58],[-10,44],[-78,7],[-67,13],[-10,83],[-146,0],[-106,0],[-110,29]],[[2834,1046],[5,-7],[10,-9],[3,-4],[6,-17],[3,-5],[4,-3],[3,-2],[18,-20],[21,-15],[3,-3],[3,-5],[2,-3],[5,0],[12,1],[4,-1],[3,-4],[1,-10],[2,-3],[5,-2],[6,-1],[5,0],[4,-1],[13,-10],[8,-8],[4,-9],[1,-14],[-80,-80],[-21,-12],[-35,-9],[-21,-3],[-21,-5],[-17,-8],[-12,-22],[-14,-6],[-73,-5],[-135,-27],[-44,-23],[-73,-27],[-10,-2],[-7,-2],[-23,-15],[-83,-30],[-23,-16],[-10,-23],[1,-3],[-1,-3],[-4,-4],[-33,-26],[-5,-2],[-7,-1],[-15,0],[-51,6],[-8,-1],[-9,-3],[-19,-4],[-4,-2],[-3,-2],[-11,-10],[-10,-6],[-4,-2],[-5,-1],[-18,0],[-5,-1],[-4,-1],[-8,-3],[-4,-2],[-4,-1],[-36,-2],[-5,0],[-5,1],[-3,4],[-1,6],[-3,2],[-8,0],[-13,-1],[-6,0],[-6,2],[-4,2],[-2,4],[-1,4],[1,4],[4,6],[-2,3],[-5,3],[-12,4],[-9,5],[-4,4],[-6,3],[-8,3],[-17,2],[-23,0],[-11,3],[-67,30],[-34,10],[-38,15]],[[1731,621],[-2,7],[-5,10],[-1,3],[-1,8],[1,5],[39,107],[4,4],[7,6],[53,33],[2,3],[2,4],[-1,11],[2,14],[0,4],[-1,3],[-5,10],[-1,7],[2,21],[4,12],[38,76],[10,5],[34,9]],[[1912,983],[16,-9],[8,-3],[19,-6],[9,-2],[11,-2],[13,-1],[25,0],[24,2],[152,24],[36,-4],[23,0],[11,2],[141,48],[22,5],[20,2],[11,1],[8,-1],[94,-18],[5,0],[7,2],[8,4],[12,9],[13,16],[8,7],[7,4],[7,3],[36,10],[21,5],[21,3],[10,2],[6,3],[8,4],[27,19],[9,3],[13,-1],[8,-7],[39,-28],[12,-18],[1,-10],[1,-5]],[[3470,1009],[18,-40],[2,-6],[-8,-132],[-7,-15],[-8,-11],[-51,-51],[-14,-18],[2,-8],[3,-5],[200,-201],[0,-4],[-3,-2],[-4,-1],[-4,-2],[-3,-2],[-2,-4],[-2,-11],[-2,-4],[-2,-2],[-3,-3],[-4,-2],[-6,-4],[-6,-5],[-8,-12],[-3,-2],[-11,-6],[-3,-3],[-7,-9],[-2,-2],[-4,-2],[-4,-2],[-5,-1],[-5,0],[-12,1],[-6,0],[-6,0],[-15,-3],[-17,-1],[-5,-1],[-4,-3],[-3,-4],[1,-3],[3,-2],[3,-3],[3,-2],[136,-194]],[[3592,222],[-12,-8],[-6,-7],[-4,-11],[-6,-3],[-8,1],[-7,-1],[-17,-10],[-33,-27],[-19,-11],[-13,-6],[-6,0],[-5,4],[-11,4],[-19,4],[-13,-8],[-4,-5],[1,-6],[-3,-3],[-29,4],[-10,-1],[-8,-4],[-7,-7],[-18,1],[-41,-4],[-37,-7],[-15,-5],[-10,-8],[-7,-13],[1,-4],[4,-3],[3,-3],[-2,-5],[-3,-1],[-10,1],[-3,0],[-20,-11],[-3,-1],[-6,-3],[-22,-1],[-14,5],[-20,23],[-35,26],[-22,11],[-23,7],[-36,7],[-10,7],[-4,14],[2,8],[4,6],[2,6],[-5,9],[-8,6],[-8,2],[-9,2],[-10,2],[-15,8],[-11,9],[-4,12],[5,19],[1,5],[-1,6],[-1,5],[-38,-7],[-16,-6],[-16,-8],[-5,-6],[-12,-17],[-6,-5],[-13,-2],[-10,2],[-8,3],[-10,0],[-15,-8],[-5,-13],[0,-42],[-3,-9],[-12,-5],[-84,-8],[-19,-5],[-33,-17],[-19,-7],[-21,-2],[-22,0],[-32,-7],[-60,-5],[-21,-5],[-16,-5],[-13,-9],[-21,-20],[-14,-9],[-31,-12],[-17,-5],[-125,-18],[-33,-2],[-37,8],[-49,30],[-41,2],[-69,-6],[-35,1],[-33,7],[39,33],[26,35],[12,37],[1,64],[-21,2],[-30,5],[-20,0],[-45,22],[-32,51],[-58,135],[-128,178]],[[1672,604],[16,5],[43,12]],[[2834,1046],[17,0],[60,8],[26,-1],[24,-2],[42,-8],[38,-10],[13,-4],[50,-8],[29,-7],[160,-26],[25,0],[51,1],[101,20]],[[2629,1714],[9,-6],[13,-14],[2,-3],[2,-6],[-5,-34],[2,-15],[-8,-30],[-22,-43],[-43,-55],[-8,-7],[-175,-108],[-5,0],[-6,3],[-47,27],[-23,6],[-32,1],[-10,2],[-13,-3],[-108,-85],[-8,-9],[-3,-8],[-27,-49],[-2,-2],[-4,-3],[-68,-45],[-21,-18],[-7,-11],[-9,-8],[-5,-4],[-10,-4],[-4,-2],[-7,-7],[-8,-4],[-8,-8],[-11,-15],[-2,-2],[-24,-29],[-7,-4],[-7,-6],[-15,-18],[-7,-5]],[[1888,1083],[-61,16],[-71,20],[-75,30],[-86,46],[-38,17],[-18,84],[-46,40],[4,31],[-30,19],[-51,15],[-48,-8],[-93,-13],[-52,2],[-14,76],[9,86]],[[1218,1544],[38,-2],[119,24],[44,-1],[55,-8],[29,-2],[27,4],[10,5],[17,10],[10,4],[9,2],[43,3],[57,-2],[159,-33],[54,0],[213,35],[16,3],[-41,24],[-33,7],[-63,25],[-44,24],[1,3],[-14,5],[-35,33],[-131,79],[-10,11],[-6,13],[-2,15],[-4,13],[-9,7],[-12,7],[-14,10],[-13,23],[-9,11],[-19,6],[-5,3],[-6,3],[-10,1],[-11,1],[-10,1],[-9,3],[-6,3],[-6,12],[0,16],[6,15],[10,11],[1,10],[-7,15],[-73,91],[-2,24],[12,26],[3,16],[-6,11],[-10,9],[-26,40],[-6,54]],[[1499,2267],[84,14],[19,5],[13,4],[31,15],[20,13],[8,4],[3,2],[6,4],[4,2],[4,2],[6,1],[6,0],[50,-3],[44,-7],[10,-3],[17,-6],[33,-16],[7,-2],[8,-2],[10,-5],[0,-31],[6,-10],[14,-9],[17,-8],[15,-5],[16,-2],[10,-1],[5,-4],[1,-12],[4,-8],[8,-12],[15,-17],[10,-5],[14,-6],[16,-4],[16,-2],[23,0],[16,-1],[15,-5],[20,-10],[57,-38],[18,-6],[36,-2],[76,-12],[37,-3],[22,2],[36,6],[17,1],[50,-22],[9,-2],[11,10],[25,-3],[31,-10],[4,-5],[1,-3],[-29,-180],[17,-82],[3,-8],[5,-5],[11,-6],[6,-3],[15,-5],[4,-2],[4,-3],[4,-5],[5,-9],[3,-11],[6,-7],[22,-10]],[[3683,1476],[10,0],[7,-1],[5,-2],[71,-23],[90,-43],[20,-13],[14,-13],[3,-6],[-2,-8],[-19,-31],[-3,-3]],[[3879,1333],[-2,1],[-9,6],[-4,2],[-4,2],[-10,2],[-7,1],[-9,2],[-9,3],[-4,2],[-3,2],[-5,5],[-3,2],[-4,3],[-4,1],[-5,1],[-6,0],[-5,0],[-10,-2],[-24,-9],[-2,-1],[-4,-1],[-11,0],[-18,0],[-5,0],[-6,-1],[-6,-2],[-13,-6],[-26,-5],[-5,0],[-44,1],[-9,-2],[-11,-4],[-19,-10],[-9,-5],[-5,-4],[-1,-4],[0,-3],[1,-3],[8,-4],[3,-2],[2,-3],[2,-8],[2,-2],[1,-5],[0,-7],[-8,-16],[-3,-12],[0,-10],[4,-17],[1,-8],[-2,-6],[-7,-5],[-124,-64],[-8,-7],[5,-7],[10,-7],[89,-43],[9,-6],[3,-4],[-5,-6],[-71,-49]],[[1912,983],[-11,14],[-2,11],[-1,33],[3,14],[-1,5],[-5,15],[-2,3],[-1,2],[-4,1],[-1,1],[1,1]],[[2629,1714],[210,-2],[57,7],[59,29],[5,1],[4,-2],[4,-2],[2,-2],[2,-3],[3,-3],[3,-2],[11,-6],[3,-2],[3,-3],[2,-3],[1,-3],[1,-16],[-2,-16],[1,-4],[2,-3],[10,-6],[2,-3],[5,-14],[2,-2],[3,-3],[3,-2],[7,-4],[64,-21],[6,-2],[4,-3],[3,-4],[5,-3],[9,-4],[7,-2],[6,0],[15,1],[25,-2],[8,-2],[17,-7],[8,-2],[19,-3],[28,0],[3,-1],[2,-2],[5,-5],[8,-4],[12,-5],[4,-2],[7,-12],[7,-5],[6,-2],[7,-1],[48,2],[5,1],[28,-2],[34,-5],[17,-3],[10,-3],[2,-3],[4,-2],[4,1],[11,2],[8,0],[6,-1],[4,-1],[3,-3],[12,-17],[3,-3],[2,-2],[8,-4],[33,-11],[18,-7],[9,-5],[7,-2],[6,0],[14,1],[13,-1],[14,-2],[13,-4],[9,-2],[7,-1],[14,1]],[[3879,1333],[41,-18],[26,-26],[17,-40],[84,2],[20,-16],[20,-24],[26,-40],[12,-23],[55,-11],[72,-25],[63,-21],[78,-2],[61,-6],[22,-17],[-11,-7],[-7,-2],[-4,-19],[-20,-24],[-28,-22],[-26,-13],[-16,-1],[-13,1],[-10,-3],[-18,-11],[-14,6],[-5,5],[-6,1],[-10,-7],[-12,-66],[5,-4],[2,-2],[-1,-4],[-7,-4],[-6,-1],[-4,-6],[-5,-5],[3,-6],[15,-5],[34,-11],[21,-13],[8,-21],[-8,-18],[-7,-36],[5,-39],[18,-28],[35,-15],[19,-20],[2,-33],[13,-27],[23,-29],[5,-25],[-3,-43],[-3,-35],[14,-39],[14,-44],[18,-37]],[[4486,354],[-100,-2],[-88,-13],[-76,-19],[-37,-4],[-39,1],[-131,14],[-17,1],[-21,-1],[-18,-4],[-19,-18],[-19,-6],[-20,-3],[-34,-3],[-19,-3],[-15,-7],[-9,-14],[-11,-5],[-45,9],[-13,-10],[-19,-8],[-128,-29],[-15,-7],[-1,-1]],[[6047,2896],[13,-15],[4,-9],[6,-34],[3,-6],[5,-5],[5,-1],[9,0],[25,1],[43,-1],[7,0],[5,1],[2,3],[0,4],[-9,35],[0,8],[1,4],[4,3],[10,2],[248,5],[27,-4],[21,-5],[236,-103],[482,-156],[221,-33],[531,63],[17,0],[14,-3],[37,-14],[145,-29],[21,-9],[14,-9],[267,-401],[1,0]],[[8462,2188],[-4,0],[-20,-4],[-20,-5],[-12,-5],[-18,-10],[-10,-5],[-8,1],[-14,4],[-13,-6],[-10,-9],[-27,-15],[-10,-19],[-13,-13],[-27,9],[-15,-2],[-79,6],[-18,-6],[-11,-11],[-7,-13],[-6,-9],[9,-13],[-10,-7],[-57,-9],[-17,-5],[-29,-14],[-22,-13],[-3,-1],[-5,-5],[-10,1],[-19,6],[-10,0],[-18,-4],[-8,0],[-10,-2],[-5,-5],[-5,-4],[-5,-2],[-14,-1],[-17,-3],[-13,-6],[-5,-9],[-2,-13],[-9,-18],[-2,-12],[2,-13],[9,-24],[2,-10],[3,-6],[17,-13],[6,-5],[0,-4],[-2,-5],[1,-4],[7,-4],[-29,-32],[-3,-13],[1,-7],[4,-9],[1,-5],[-4,-6],[-10,-2],[-11,-1],[-8,-2],[-11,-12],[-8,-13],[-12,-10],[-24,-4],[-5,-1],[-30,-7],[-4,2],[-10,-3],[-12,1],[-11,3],[-9,1],[-30,-12],[-27,-23],[-49,-74],[-25,-25],[-31,-21],[-33,-8],[-13,2],[-39,10],[-13,5],[-14,-7],[-48,-37],[-7,-8],[-3,-10],[-8,-2],[-52,-22],[-10,-11],[-14,-23],[-1,-2],[1,-9],[-2,-2],[-3,0],[-4,1],[-4,-1],[-12,-7],[-7,-3],[-7,-2],[-3,1],[-9,6],[-5,1],[-5,0],[-2,-2],[-1,-2],[-2,0],[-5,-2],[-6,-3],[-6,-3],[-2,-3],[-3,-12],[-13,-17],[-3,-10],[-1,-21],[-6,-8],[-13,-3],[0,-4],[4,-2],[1,-2],[1,-9],[-14,5],[-5,-3],[-2,-5],[-4,-6],[-21,-7],[-9,-5],[-3,-7],[-8,-9],[-37,-26],[-10,-5],[-21,-6],[-7,-14],[-1,-16],[-7,-12],[-5,-1],[-6,2],[-1,0],[-6,3],[-4,1],[-4,-1],[-6,-6],[-3,-2],[-12,-2],[-5,-6],[-4,-7],[-8,-6],[-7,4],[-9,-4],[-43,-9],[-39,-13],[12,-25],[-48,0],[-7,0],[-16,4],[0,-1],[-18,1],[-1,0],[-21,7],[-8,1],[-4,-6],[-1,-8],[-3,-6],[-7,-4],[-12,-1],[-17,-7],[6,-14],[10,-15],[-5,-7],[-24,-5],[-14,-13],[-11,-16],[-20,-13],[-11,3],[-10,0],[-9,-3],[-18,-9],[-6,-2],[-17,-2],[-79,2],[-19,-2],[-21,11],[-11,5],[-10,1],[-14,-2],[-27,-13],[-14,-2],[-16,3],[-11,7],[-8,8],[-8,3],[-8,-2],[-1,-4],[1,-4],[-1,-2],[-9,0],[-13,3],[-7,1],[-8,-2],[-28,-15],[-3,-4],[2,-3],[0,-3],[-6,-3],[-6,1],[-3,9],[-7,3],[-4,-1],[-3,-3],[-2,-3],[-1,-4],[-3,-5],[-7,-1],[-9,0],[-7,0],[-24,-11],[-11,-2]],[[6153,1005],[0,1],[-267,540],[-71,86],[-4,6],[2,5],[3,3],[3,2],[4,2],[16,7],[3,2],[1,4],[-2,6],[-1,4],[1,4],[6,5],[4,3],[2,4],[-2,5],[1,5],[4,9],[3,3],[2,2],[7,5],[3,3],[3,4],[3,7],[0,7],[-2,10],[-10,16],[-12,9],[-10,42],[50,162]],[[1510,2877],[1,7],[3,7],[5,4],[-18,10],[-18,5]],[[1483,2910],[2,16],[7,13],[14,12],[13,4],[23,-1],[14,-7],[18,-9],[11,-12],[6,-13],[-3,-14],[-17,-13],[-15,-6],[-19,-2],[-27,-1]],[[1672,604],[-26,36],[-14,12],[-55,36],[-40,43],[-16,12],[-19,9],[-25,5],[-35,4],[-13,2],[-3,4],[0,6],[-2,8],[-9,16],[-5,6],[-7,3],[-7,2],[-6,3],[-5,8],[-9,6],[-37,18],[-13,5],[-9,1],[-8,0],[-9,-1],[-9,-2],[-15,3],[-211,111],[-210,111],[-18,20],[-9,27],[-271,204],[-84,43],[-2,9],[58,54],[78,44],[29,27],[47,60],[2,6],[0,6],[2,5],[8,2],[14,0],[232,10],[277,-44]],[[7065,8483],[-844,-1089],[141,-371],[258,-448],[0,-216],[-23,-278],[-94,-263],[234,-433],[85,-139],[-146,-83]],[[4312,5103],[-79,58],[-43,43],[-8,5],[-12,5],[-1112,343]],[[1917,5909],[3,8],[2,15],[4,29],[4,29],[3,28],[4,29]],[[1937,6047],[742,860],[518,601],[515,597],[47,170],[281,0],[117,16],[118,77],[187,62],[352,77],[211,46],[24,140],[-24,154],[-23,155],[188,92]],[[5190,9094],[117,-39],[117,-38],[21,-6],[96,-32],[118,-38],[117,-38],[117,-38],[117,-38],[117,-39],[118,-38],[117,-38],[117,-38],[117,-38],[118,-38],[117,-38],[117,-39],[117,-38]],[[1937,6047],[4,28],[4,29],[4,28],[3,29],[4,28],[4,29],[4,28],[4,29],[4,28],[4,29],[3,28],[4,29],[4,29],[4,28],[4,29],[3,28],[4,29],[4,28],[4,29],[1,5],[3,23],[4,29],[3,28],[4,29],[4,28],[4,29],[4,28],[4,29],[3,28],[4,29],[4,29],[4,28],[4,29],[4,28],[3,29],[4,28],[4,29],[4,28],[4,29],[3,28],[4,29],[4,28],[4,29],[4,28],[4,29],[4,28],[3,29],[4,29],[4,28],[4,29],[4,28],[3,29],[4,28],[4,29],[4,28],[4,29],[4,28],[3,29],[4,28],[4,29],[4,28],[3,26],[30,50],[14,16],[38,43],[38,43],[38,43],[38,43],[20,22],[7,11],[-2,10],[-14,14],[-22,16],[-55,38],[-56,38],[-55,38],[-55,38],[-27,18],[-77,38],[-17,12],[-13,14],[-12,15],[-7,29],[7,29],[24,24],[38,13],[-16,15],[-15,16],[-16,15],[-16,15],[-16,16],[-16,15],[-16,15],[-16,16],[-16,15],[-16,15],[-15,16],[-16,15],[-16,15],[-16,16],[-16,15],[-16,15],[-16,15],[-22,22],[-33,25],[-18,8],[-45,14],[-15,9],[-4,10],[0,17],[0,12],[-1,33],[-2,46],[-1,53],[-1,52],[-2,46],[0,33],[-1,12],[-7,26],[-8,26],[-8,27],[-11,39],[-11,39],[-12,39],[-11,39],[-12,40],[-11,39],[-11,39],[-12,39],[-11,39],[-12,40],[-11,39],[-11,39],[-12,39],[-11,39],[16,5],[55,17],[55,16],[55,16],[54,17],[55,16],[55,16],[55,17],[54,16],[55,16],[55,17],[55,16],[54,16],[55,17],[55,16],[55,16],[54,17],[42,12],[20,2],[86,-28],[118,-38],[117,-38],[117,-39],[117,-38],[117,-38],[118,-38],[117,-38],[117,-38],[117,-38],[118,-39],[117,-38],[117,-38],[117,-38],[118,-38],[117,-38],[117,-38],[117,-39],[118,-38],[117,-38],[117,-38],[117,-38],[117,-38],[118,-38]],[[7065,8483],[118,-38],[117,-38],[117,-38],[117,-38],[117,-38],[118,-39],[117,-38],[117,-38],[117,-38],[118,-38],[117,-38],[117,-38],[117,-39],[118,-38],[117,-38],[117,-38],[117,-38],[118,-38],[117,-38],[117,-39],[117,-38],[117,-38],[118,-38],[117,-38],[117,-38],[0,-146],[0,-145],[1,-145],[0,-145],[0,-146],[0,-145],[0,-145],[1,-145],[0,-146],[0,-145],[0,-145],[0,-145],[0,-146],[1,-145],[0,-145],[0,-145],[0,-37],[-11,-19],[-26,1],[-110,24],[-116,11],[-109,0],[-62,-8],[-125,-30],[-71,-4],[-146,20],[-45,-4]],[[3877,1881],[-194,-405]],[[1499,2267],[-7,64],[7,38],[5,10],[21,21],[7,10],[-1,7],[-4,3],[-5,3],[-3,4],[0,8],[4,9],[6,33],[6,12],[9,11],[44,31],[13,18],[-12,20],[-26,22],[-10,11],[-15,28],[-3,12],[2,12],[7,14],[4,0],[6,0],[6,1],[4,3],[-1,4],[-10,6],[-2,2],[5,6],[16,10],[5,6],[-23,36],[-6,7],[-17,1],[-11,5],[-6,10],[-2,16],[4,5],[10,5],[6,5],[-4,6],[-3,4],[-5,6],[-2,7],[4,2],[27,3],[-4,7],[-16,9],[-10,9],[1,8],[3,5],[-1,4],[-7,5],[-5,6]],[[1483,2910],[-17,-1],[-16,-8],[-12,-1],[-13,7],[-21,15],[-24,11],[-5,4],[-3,10],[5,2],[7,1],[4,5],[-1,6],[-4,3],[-5,3],[-3,5],[0,7],[5,11],[2,7]],[[7935,3338],[4,-7],[26,-21],[37,-45],[19,-13],[34,-10],[39,-5],[40,0],[37,3],[45,9],[36,13],[31,19],[27,26],[119,-51],[97,-24],[13,-8],[-48,-72],[-22,-20],[2,-8],[32,-32],[70,-140],[2,-7],[1,-8],[-1,-7],[-25,-69],[6,2],[6,2],[11,5],[61,12],[37,5],[13,-6],[8,10],[5,-4],[1,-9],[-3,-11],[-17,-32],[-53,-193],[5,-30],[19,-29],[29,-26],[34,-22],[32,-10],[77,-17],[24,-15],[3,-5],[0,-19],[10,-3],[90,6],[22,0],[14,-8],[13,-44],[24,-47],[1,-8],[1,-18],[-4,-11],[-16,-22],[-6,-11],[-3,-13],[0,-12],[-3,-7],[-15,-11],[-6,-6],[-37,-88],[-52,3],[-58,12],[-24,13],[-35,6],[-9,1],[-34,-1],[-9,2],[-18,5],[-8,2],[-23,-2],[-20,-4],[-20,1],[-22,13],[-8,-5],[-12,0],[-13,3],[-15,2],[-13,-2],[-9,-4],[-18,-13],[-11,-5],[-15,-2],[-25,-3]],[[6153,1005],[-3,0],[-14,4],[-11,-11],[-13,-3],[-79,3],[-20,-2],[-25,-4],[-11,0],[-8,-2],[-23,-6],[-5,-3],[-8,-2],[-42,0],[-15,-4],[-25,11],[-29,-4],[-28,-8],[-22,1],[-9,-4],[-5,1],[-4,2],[-5,1],[-72,-1],[-9,3],[-37,-9],[-12,-2],[-16,1],[-18,3],[-17,4],[-10,5],[-9,-7],[-9,2],[-10,6],[-12,4],[-9,-1],[-20,-3],[-38,-2],[-12,-3],[-5,-7],[-6,-1],[-25,4],[-8,-1],[-6,0],[-25,5],[-38,-7],[-37,-11],[-21,-10],[-14,-8],[-6,-5],[-3,-4],[-3,-3],[-19,-4],[-15,-5],[-7,-1],[-6,-2],[-2,-7],[-3,-5],[-7,-3],[-8,0],[-9,2],[-21,-21],[0,-9],[16,-9],[15,6],[7,-6],[2,-11],[5,-8],[11,-5],[114,-32],[8,-10],[15,-6],[29,-14],[19,-14],[-31,-14],[-9,-10],[-9,-3],[-11,-4],[-38,-50],[-95,-71],[-10,-12],[-8,-15],[-14,-12],[-30,-19],[-40,-40],[-21,-12],[-16,-5],[-56,-13],[-40,-13],[-33,-18],[-19,-25],[0,-30],[-28,-27],[-76,-10],[-316,-6]]],"transform":{"scale":[0.001053627620262024,0.001599075231523149],"translate":[13.449183797000103,7.455566711000117]}};
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
