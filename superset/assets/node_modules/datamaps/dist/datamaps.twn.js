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
  Datamap.prototype.twnTopo = {"type":"Topology","objects":{"twn":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Kaohsiung City"},"id":"TW.KH.KC","arcs":[[0,1,2,3,4,5,6]]},{"type":"MultiPolygon","properties":{"name":"Pingtung"},"id":"TW.TW.PT","arcs":[[[7]],[[8,9,-3]]]},{"type":"MultiPolygon","properties":{"name":"Tainan City"},"id":"TW.TW.TN","arcs":[[[10]],[[11]],[[12]],[[13]],[[-5,14,15]]]},{"type":"Polygon","properties":{"name":"Hsinchu City"},"id":"TW.TW.HS","arcs":[[16,17,18]]},{"type":"Polygon","properties":{"name":"Hsinchu"},"id":"TW.TW.HH","arcs":[[19,20,21,-19,22,23]]},{"type":"MultiPolygon","properties":{"name":"Yilan"},"id":"TW.TW.IL","arcs":[[[24]],[[25,26,-20,27,28,29]]]},{"type":"Polygon","properties":{"name":"Keelung City"},"id":"TW.TW.CL","arcs":[[30,31]]},{"type":"Polygon","properties":{"name":"Miaoli"},"id":"TW.TW.ML","arcs":[[-22,32,33,-17]]},{"type":"Polygon","properties":{"name":"Taipei City"},"id":"TW.TP.TC","arcs":[[34]]},{"type":"MultiPolygon","properties":{"name":"New Taipei City"},"id":"TW.TW.TP","arcs":[[[-31,35,-29,36,37],[-35]],[[38]]]},{"type":"Polygon","properties":{"name":"Taoyuan"},"id":"TW.TW.TY","arcs":[[-28,-24,39,-37]]},{"type":"Polygon","properties":{"name":"Changhua"},"id":"TW.TW.CG","arcs":[[40,41,42,43]]},{"type":"MultiPolygon","properties":{"name":"Chiayi"},"id":"TW.TW.CH","arcs":[[[44]],[[45]],[[46]],[[47]],[[48]],[[49]],[[50,-6,-16,51,52],[53]]]},{"type":"Polygon","properties":{"name":"Chiayi City"},"id":"TW.TW.CS","arcs":[[-54]]},{"type":"Polygon","properties":{"name":"Hualien"},"id":"TW.TW.HL","arcs":[[54,55,-1,56,57,-26]]},{"type":"Polygon","properties":{"name":"Nantou"},"id":"TW.TW.NT","arcs":[[-57,-7,-51,58,-41,59]]},{"type":"Polygon","properties":{"name":"Taichung City"},"id":"TW.TW.TG","arcs":[[-21,-27,-58,-60,-44,60,-33]]},{"type":"Polygon","properties":{"name":"Yunlin"},"id":"TW.TW.YL","arcs":[[-59,-53,61,-42]]},{"type":"MultiPolygon","properties":{"name":"Taitung"},"id":"TW.TW.TT","arcs":[[[62]],[[63]],[[64]],[[-9,-2,-56,65]]]},{"type":"MultiPolygon","properties":{"name":"Penghu"},"id":"TW.TW.PH","arcs":[[[66]],[[67]],[[68]],[[69]],[[70]],[[71]],[[72]],[[73]],[[74]],[[75]],[[76]],[[77]],[[78]],[[79]],[[80]],[[81]],[[82]],[[83]]]},{"type":"MultiPolygon","properties":{"name":"Kinmen"},"id":"TW.FK.KM","arcs":[[[84]],[[85]],[[86]]]},{"type":"MultiPolygon","properties":{"name":"Lienchiang"},"id":"TW.FK.LK","arcs":[[[87]],[[88]],[[89]],[[90]],[[91]]]}]}},"arcs":[[[7259,3416],[19,-45],[-29,-39],[-55,-19],[-14,-25],[10,-31],[55,-28],[62,-40],[27,-59],[4,-20]],[[7338,3110],[-154,-30],[-63,-32],[-39,-30],[-77,-39],[-8,-45],[22,-46],[-26,-39],[-73,-31],[-9,-53],[22,-78],[-30,-103],[-1,-87],[-42,-46],[-84,-57],[-23,-76],[14,-63],[29,-36],[60,-50],[13,-39],[-38,-3]],[[6831,2127],[-1,0],[-51,7],[-42,-2],[-84,-52],[-58,43],[-74,69],[-71,-14],[-65,-46],[-129,52],[-92,-35],[-63,-56],[-78,-22],[-175,9],[-17,-38],[-13,-56],[-26,-62],[6,-55],[-2,-74],[-55,-166],[-2,-56],[28,-59],[3,-64],[-80,-161]],[[5690,1289],[-25,9],[-16,-1],[-18,-5],[-21,0],[-128,80],[-119,134],[125,-120],[-14,57],[-21,31],[-17,25],[-52,48],[-89,65],[-34,33],[-16,37],[22,36],[11,33],[-15,45],[-26,44],[-49,60],[-45,80],[-10,35],[1,23],[15,28],[3,19],[-5,10],[-13,7],[-13,11],[-6,18],[-28,38],[-7,15],[-21,107]],[[5059,2291],[61,28],[1,-3],[39,-68],[47,-19],[154,-17],[81,7],[83,-8],[41,11],[34,21],[64,20],[62,35],[23,42],[30,41],[52,55],[60,51],[64,42],[73,56],[63,65],[98,133],[103,118],[22,51]],[[6314,2952],[0,1],[-9,51],[-15,36],[2,38],[35,28],[67,-6],[58,5],[121,57],[44,41],[78,48],[75,33],[42,40],[35,53],[83,52],[182,74]],[[7112,3503],[43,-8],[57,-18],[41,-45],[6,-16]],[[5585,1005],[3,-3],[2,0],[2,-5],[13,-15],[-4,-3],[1,-4],[-26,-15],[-4,-2],[-16,-10],[-30,-21],[0,2],[0,-1],[-8,25],[13,20],[0,1],[27,28],[21,0],[6,3]],[[6831,2127],[33,-52],[8,-38],[52,-10],[55,-29],[-28,-107],[-1,-41],[-20,-39],[-96,-32],[-47,-21],[-75,-13],[-53,-35],[-23,-52],[-36,-51],[-30,-59],[-8,-115],[12,-51],[20,-48],[10,-56],[0,-41],[25,-40],[46,-43],[-24,-30],[-53,-25],[-20,-31],[-5,-36],[27,-30],[33,-13],[31,-35],[-1,-45],[5,-47],[32,-47],[45,-38],[100,-37],[44,3]],[[6889,743],[9,-406],[-16,-57],[-25,-47],[-33,-20],[-39,-29],[1,-66],[14,-71],[-3,-47],[-44,54],[-67,40],[-77,28],[-78,15],[-3,-52],[-23,-18],[-33,6],[-36,25],[-2,18],[12,55],[-54,73],[-5,19],[1,16],[4,26],[0,84],[5,25],[24,28],[6,23],[-196,406],[-16,22],[-54,54],[-43,77],[-20,22],[-80,51],[-32,14],[-11,3],[-10,6],[-10,29],[-6,11],[-43,22],[-99,38],[-44,24],[-47,33],[-22,11],[-4,1]],[[4744,2552],[-6,-10],[-22,16],[-17,32],[3,10],[7,0],[9,-9],[6,-15],[21,-17],[-1,-7]],[[4749,2767],[-28,-55],[-1,1],[39,105],[2,-2],[4,0],[-13,-40],[-3,-9]],[[4783,2867],[-1,0],[36,76],[5,1],[2,-14],[-42,-63]],[[4846,3042],[-3,-20],[-1,1],[6,82],[5,-1],[-7,-62]],[[5059,2291],[-9,49],[-18,28],[-38,31],[46,26],[26,47],[-10,41],[-62,7],[-12,-14],[-11,-27],[-17,-20],[-33,1],[-13,17],[5,55],[-8,19],[-40,14],[-22,-16],[-19,-23],[-26,-6],[-29,20],[-7,27],[6,27],[12,18],[29,12],[36,4],[31,7],[10,24],[-14,12],[-92,18],[0,16],[77,0],[-8,21],[-42,28],[-27,25],[7,32],[24,11],[27,7],[13,19],[-8,31],[-13,25],[9,23],[13,29],[23,21],[-5,17],[5,18],[33,70],[15,13],[26,5],[-37,20],[15,31]],[[4927,3151],[52,-15],[87,-10],[71,-14],[61,21],[25,39],[57,28],[65,40],[46,37],[60,36],[76,27],[150,22],[83,4],[71,-19],[39,-19],[20,-32],[18,-40],[97,-79],[9,-58],[-17,-111],[16,-36],[44,-27],[37,0],[53,19],[49,5],[36,-9],[82,-8]],[[7107,6267],[-2,-2],[-45,-9],[-43,14],[-27,29],[-42,20],[-67,21]],[[6881,6340],[11,31],[54,88],[22,23],[7,12],[0,13],[-7,14],[-11,17],[15,23],[17,14]],[[6989,6575],[82,-27],[148,-37],[53,-22],[38,-30],[18,-28],[-9,-28],[-23,-11],[-51,-6],[-58,-19],[-34,-33],[-22,-44],[-24,-23]],[[8275,6000],[-23,-50],[-14,-36],[6,-34],[-37,-45],[-137,-109],[-43,-81]],[[8027,5645],[-28,6],[-104,-8],[-7,-4]],[[7888,5639],[-6,37],[-45,61],[-33,24],[-13,35],[-49,30],[-123,-24],[-47,3],[-67,-3],[-75,-16],[-40,7],[8,39],[13,36],[-10,31],[-9,22],[9,25],[8,26],[3,30],[-7,41],[-38,25],[-120,45],[-59,34],[-37,35],[-44,85]],[[6989,6575],[1,1],[14,17],[6,30],[9,22],[20,22],[26,17],[25,7],[-2,9],[6,23],[22,46],[20,26]],[[7136,6795],[32,-9],[134,8],[45,-24],[39,-67],[49,-15],[43,-10],[40,-15],[67,-17],[36,-32],[-12,-45],[34,-29],[65,-16],[41,-23],[31,-24],[37,-5],[38,2],[33,-27],[26,-35],[43,-17],[33,-20],[4,-39],[15,-56],[-18,-59],[-46,-50],[6,-34],[50,-30],[61,-29],[54,-7],[40,-22],[72,-32],[47,-17]],[[9643,6575],[2,-1],[19,-2],[10,-12],[6,-5],[-7,-18],[-38,1],[-13,6],[-4,5],[-1,0],[-12,16],[10,-3],[24,11],[1,2],[2,0],[1,0]],[[9181,5399],[-10,0],[-110,13],[-181,85],[-38,-6],[-23,-46],[-48,-35],[-64,0],[-81,24],[-148,30],[-64,24],[-25,16]],[[8389,5504],[-57,36],[-48,0],[-47,-18],[-38,-4],[-37,19],[-43,20],[-48,8],[-15,29],[7,43],[-36,8]],[[8275,6000],[5,12],[38,12],[32,-5],[34,10],[22,30],[-31,95],[53,31],[30,6]],[[8458,6191],[57,13],[48,14],[37,25],[49,27],[65,25],[38,21],[-4,15],[-10,25],[-1,32],[19,38],[46,31],[38,17],[128,41],[132,62],[61,15],[50,28],[30,38],[32,32],[36,15],[35,10],[45,22],[16,29],[-25,28],[14,22],[110,18],[36,19],[82,34],[59,10],[33,-15],[7,-9]],[[9721,6873],[-117,-45],[-55,-37],[-183,-175],[-29,-37],[-23,-52],[-15,-59],[-5,-59],[2,-57],[33,-119],[-2,-31],[-14,-30],[2,-63],[33,-48],[64,-31],[76,-11],[0,-14],[-32,3],[-31,-2],[-25,-7],[-18,-10],[25,-39],[14,-50],[-9,-44],[-58,-26],[-5,-19],[8,-23],[17,-21],[5,-21],[-24,-19],[-61,-27],[-69,-63],[-3,-24],[4,-54],[-11,-21],[-13,-17],[-7,-25],[-6,-49],[-5,-13],[-10,-10],[-5,-10],[10,-13],[2,-2]],[[9176,7220],[-3,-91],[2,-24],[36,-29],[-4,-19],[-24,-15],[-40,-11],[-50,5],[-104,34],[-29,16],[-36,27],[-28,27],[-17,27],[-28,28],[-6,22],[31,17],[71,24],[43,22]],[[8990,7280],[14,-7],[7,-8],[17,-13],[38,-11],[110,-21]],[[7888,5639],[-37,-20],[-18,-44],[-47,-15],[-53,0],[-41,-23],[-45,-34],[-58,-25],[-114,-71],[-67,-22],[-87,-36],[-54,16],[-48,43],[-60,19],[-97,6],[-54,-26],[-8,-57],[-52,-22],[-119,-4],[-114,51],[-64,9],[-73,28],[-148,86],[-61,42],[-47,39],[-91,110]],[[6231,5689],[72,62],[18,32],[9,51],[21,43],[58,80],[16,48],[15,21],[67,15],[18,17],[12,20],[13,19],[41,34],[45,26],[55,11],[71,-10],[-10,42],[27,28],[37,30],[18,44],[8,14],[35,14],[4,10]],[[8767,6837],[-57,0],[-48,9],[-36,24],[-37,34],[-57,35],[-39,51],[16,57],[-12,48],[-56,43],[-38,32],[16,23],[18,19],[21,35],[35,30],[107,50],[29,19],[39,15],[37,-9],[21,-17],[-6,-28],[4,-26],[16,-25],[16,-27],[24,-78],[39,-26],[16,-34],[-16,-51],[1,-39],[46,-20],[36,-24],[-19,-33],[-75,-74],[-41,-13]],[[9176,7220],[340,-64],[32,-16],[-16,-28],[-5,-23],[7,-40],[24,-66],[26,-32],[21,-7],[69,8],[35,-3],[41,-8],[37,-15],[20,-19],[-86,-34]],[[8458,6191],[-24,42],[-88,65],[-14,43],[-7,40],[30,29],[15,40],[-83,95],[-50,16],[-72,-3],[-51,22],[13,51],[-10,40],[-52,39],[-11,39],[11,45],[-2,47],[36,31],[128,30],[33,27],[10,32],[-5,31],[-50,57],[-42,18],[-40,7],[-31,22],[-47,23],[-61,24],[-42,35]],[[7952,7178],[111,16],[46,14],[61,39],[18,8],[22,3],[30,0],[35,-9],[18,-20],[12,-21],[15,-12],[34,11],[-35,43],[-57,45],[-30,15],[9,21],[17,11],[19,7],[8,7],[20,40],[32,45],[64,45],[95,38],[108,19],[106,-10],[44,-25],[98,-109],[36,-57],[11,4],[27,5],[30,3],[22,-5],[-2,-6],[-10,-10],[-10,-14],[1,-17],[10,-9],[23,-13]],[[9999,8308],[-21,-11],[-3,22],[24,-11]],[[7136,6795],[88,109],[68,64],[71,46],[181,47],[42,21],[36,25],[45,18],[88,25],[197,28]],[[6350,4717],[0,-28],[-42,-11],[-12,-23],[6,-31],[-20,-35],[-16,-43],[-1,-44],[-11,-51],[-9,-104],[20,-49],[36,-25],[38,-11],[55,-22],[-10,-28],[-37,-12],[-25,-17],[-23,-12]],[[6299,4171],[-10,-6],[-118,19],[-57,-1],[-120,47],[-193,17],[-114,34],[-66,14],[-74,3],[-216,-20],[-74,34]],[[5257,4312],[7,11],[16,55],[12,23],[69,53],[20,22],[27,60],[40,60],[57,125],[26,36],[30,24],[24,13],[22,8],[15,11],[6,23],[12,21],[50,32],[12,23],[6,78],[9,22],[26,20],[112,102]],[[5855,5134],[57,-14],[39,-28],[26,-49],[10,-58],[44,-42],[117,-28],[43,-27],[31,-39],[20,-31],[0,-30],[12,-26],[42,-6],[54,-28],[0,-11]],[[4899,3136],[-18,-10],[-3,9],[23,24],[9,18],[11,12],[6,-4],[1,-9],[-14,-15],[-15,-25]],[[4921,3235],[-9,-9],[2,14],[20,30],[8,3],[-4,-15],[-17,-23]],[[4969,3305],[-1,0],[0,34],[5,-3],[1,-22],[-5,-9]],[[4983,3381],[-5,-14],[-1,3],[-2,-2],[-5,16],[12,-3],[1,0]],[[4970,3428],[-5,-11],[-10,14],[-3,3],[16,-3],[0,-2],[2,-1]],[[4677,3420],[-31,-13],[37,43],[137,109],[104,105],[25,6],[-89,-114],[-44,-35],[-29,-28],[-37,-29],[-29,-16],[-44,-28]],[[6540,3817],[60,-5],[66,-21],[40,-9],[51,-21],[-4,-41],[-29,-41],[12,-37],[26,-51],[4,-45],[11,-30],[75,-10],[251,-2],[9,-1]],[[4927,3151],[38,2],[32,12],[14,-4],[-8,25],[-22,-13],[-18,4],[-24,1],[-1,26],[25,43],[36,2],[53,0],[-36,81],[-41,63],[19,28],[0,16],[-30,11],[4,14],[17,16],[9,20],[39,41],[-84,-5],[-2,68]],[[4947,3602],[10,1],[1,0],[104,10],[81,-37],[60,0],[39,24],[16,38],[21,23],[52,7],[68,44],[44,19],[37,29],[161,73],[70,16],[124,18],[68,3],[52,-36],[49,-46],[124,-36],[36,4],[82,19],[46,-26],[23,-31],[62,5],[116,19],[38,10],[0,27],[4,38],[5,0]],[[5628,3578],[-37,-32],[9,-44],[60,-18],[69,-35],[72,-13],[66,21],[45,4],[29,17],[-25,53],[-24,31],[-40,17],[-55,17],[-77,-6],[-92,-12]],[[9181,5399],[7,-6],[9,-11],[7,-12],[2,-8],[-14,-19],[-57,-43],[-62,-67],[-45,-29],[-15,-15],[7,-17],[-8,-11],[-66,-39],[-24,-19],[-28,-47],[-28,-94],[-73,-84],[-14,-34],[2,-37],[17,-40],[15,-17],[13,-9],[8,-10],[1,-25],[-11,-28],[-36,-45],[-7,-27],[-4,-49],[-32,-126],[-62,-133],[-79,-311],[-47,-76],[-109,-498]],[[8448,3413],[-34,8],[-106,-41],[-38,-42],[17,-54],[6,-53],[-36,-53],[-33,-41],[-27,-52],[-23,-65],[-37,-60],[-47,-103],[-31,-47],[1,-53],[-9,-48],[-63,-29],[-81,9],[-115,75],[-90,125],[-56,12],[-62,7],[-49,37],[-60,22],[-77,22],[-49,64],[-11,57]],[[7259,3416],[60,27],[30,22],[-17,48],[15,21],[15,32],[51,29],[72,13],[73,2],[52,37],[13,66],[39,40],[75,22],[44,24],[16,40],[31,98],[13,65],[-10,56],[-11,42],[-31,31],[-21,31],[55,73],[3,29],[25,55],[37,65],[31,68],[15,78],[6,58],[-18,35],[-20,26],[23,59],[50,82],[79,81],[2,30],[-14,35],[-51,26],[-28,24],[-3,77],[36,22],[66,17],[51,19],[-3,28],[-13,49]],[[8097,5198],[27,15],[13,16],[33,13],[30,29],[13,40],[29,38],[74,37],[24,48],[4,32],[45,38]],[[6540,3817],[-26,27],[-81,-6],[-67,-17],[-57,20],[-39,37],[9,44],[19,40],[-10,60],[10,56],[20,36],[-19,57]],[[6350,4717],[42,-1],[176,-20],[41,6],[49,36],[75,112],[36,65],[63,24],[99,-11],[59,2],[57,59],[29,15],[89,-52],[34,7],[26,43],[46,30],[65,-1],[49,15],[77,59],[50,22],[44,6],[86,36],[61,2],[61,8],[110,34],[45,2],[47,-8],[131,-9]],[[5855,5134],[6,6],[7,25],[32,22],[22,49],[27,95],[91,125],[28,77],[33,42],[130,114]],[[4947,3602],[45,40],[-2,128],[7,95],[28,77],[43,59],[12,78],[23,68],[12,23],[61,64],[10,21],[7,11],[55,34],[9,12]],[[8774,109],[-8,-10],[-11,7],[8,11],[11,-8]],[[8728,244],[-54,-14],[-72,23],[-67,38],[-38,29],[11,21],[0,20],[-10,18],[-17,17],[192,0],[0,-14],[-5,-8],[-8,-19],[-4,-23],[9,-20],[46,-27],[20,-20],[-3,-21]],[[8492,1636],[-1,-8],[-7,2],[-17,0],[-9,1],[-5,5],[-26,8],[-27,38],[-14,33],[5,5],[99,6],[11,-5],[7,-15],[-7,-31],[-9,-13],[-4,-13],[4,-13]],[[8448,3413],[-45,-206],[-22,-37],[-69,-74],[-26,-38],[-20,-48],[-15,-89],[2,-79],[-10,-75],[-48,-78],[-20,-16],[-47,-27],[-21,-18],[-10,-17],[-17,-46],[-47,-65],[-29,-102],[-21,-46],[-100,-116],[-13,-21],[-137,-92],[-32,-30],[-5,-21],[7,-49],[-2,-22],[-12,-25],[-21,-27],[-47,-47],[-46,-35],[-158,-84],[-106,-93],[-26,-11],[-21,-22],[-51,-105],[-26,-39],[-79,-79],[-32,-47],[-19,-96],[-47,-131],[-93,-131],[-14,-45],[-16,-126],[2,-115]],[[3141,2877],[-17,-7],[-13,12],[-15,37],[10,9],[37,10],[27,-5],[1,-17],[-2,-13],[-12,-8],[-16,-18]],[[3130,2971],[-17,-25],[-22,6],[-20,19],[-2,19],[12,9],[31,-4],[18,-24]],[[3610,2996],[-5,-1],[0,1],[-1,0],[-10,10],[4,2],[-1,3],[16,1],[3,1],[5,0],[4,-6],[-2,-3],[6,-7],[-11,-1],[-1,0],[-7,0]],[[3621,3015],[-4,0],[2,5],[3,-4],[-1,-1]],[[3746,3031],[4,-1],[22,0],[-4,-8],[4,-2],[-10,-12],[-8,-14],[-5,12],[-6,10],[2,14],[1,0],[0,1]],[[3728,3036],[-1,-6],[2,0],[0,-4],[-5,1],[-5,1],[1,1],[-4,1],[5,0],[7,6]],[[3346,3047],[-18,-6],[12,14],[6,-8]],[[2894,3150],[-3,-1],[-1,1],[-3,3],[4,2],[3,-1],[0,-4]],[[2856,3163],[-3,-2],[-1,1],[-3,4],[5,2],[1,-2],[1,-3]],[[2895,3164],[-1,-8],[-3,0],[-4,12],[8,-4]],[[3417,3262],[-8,-1],[-8,0],[-30,-13],[-3,2],[3,11],[11,11],[7,5],[16,2],[14,-7],[-2,-10]],[[3335,3314],[1,-18],[5,-12],[7,-5],[7,-5],[-6,-12],[-12,-9],[1,-7],[5,-8],[-14,-5],[-32,3],[-15,5],[14,24],[-2,33],[-9,-5],[-19,-5],[-6,18],[20,40],[16,3],[27,-29],[6,-1],[6,-5]],[[2849,3359],[7,-2],[3,1],[13,-4],[-3,-4],[3,-9],[-6,-7],[-20,-4],[-3,4],[-8,4],[10,18],[2,0],[2,3]],[[3424,3551],[-25,-13],[-4,-1],[-3,-2],[-7,0],[-13,-4],[-23,-10],[-2,4],[-10,1],[-3,14],[2,1],[-1,0],[1,0],[5,3],[18,-4],[3,2],[10,4],[3,1],[1,0],[22,9],[24,-4],[2,-1]],[[3615,3769],[-6,-10],[40,10],[30,-3],[22,1],[16,21],[46,-67],[13,-31],[-6,-24],[-19,16],[-25,13],[-28,4],[-39,-17],[-27,-3],[-14,-6],[-7,-11],[-11,-32],[-7,-9],[-45,-21],[-48,-6],[-47,15],[-48,38],[13,19],[26,-25],[39,-6],[42,9],[35,22],[-24,7],[-19,10],[-15,12],[-14,17],[-6,-7],[0,-3],[-1,-1],[-11,-4],[-2,31],[2,31],[18,0],[21,-4],[72,36],[46,12],[-12,-34]],[[3223,3697],[-37,0],[6,16],[12,10],[19,4],[24,2],[22,6],[6,16],[1,37],[32,81],[30,24],[42,-29],[-25,-11],[-17,-28],[-27,-66],[-1,-18],[6,-15],[-3,-10],[-29,-4],[-22,-1],[-15,-2],[-12,-4],[-12,-8]],[[3555,3836],[-22,-5],[-11,11],[-8,27],[-20,23],[-42,33],[54,32],[33,-14],[31,-21],[13,-23],[-24,-18],[10,-27],[-14,-18]],[[3581,4072],[-3,-7],[-1,3],[-1,0],[-11,20],[3,4],[-5,7],[17,11],[11,17],[6,7],[4,-6],[0,-2],[25,-11],[-4,-14],[-22,-10],[-19,-19]],[[81,5593],[-52,-12],[-29,9],[49,77],[13,11],[21,4],[20,0],[19,-10],[17,-14],[-1,-25],[-13,-16],[-16,-1],[-11,-9],[-5,-9],[-12,-5]],[[621,5800],[46,-98],[-10,-67],[-38,-36],[-66,33],[-50,13],[-80,-7],[-70,-34],[-38,-47],[-33,-14],[-39,15],[-26,1],[-23,8],[-12,16],[4,6],[22,21],[6,10],[2,16],[-1,19],[-7,33],[-17,33],[-2,16],[15,7],[74,29],[99,-51],[68,6],[11,68],[22,42],[74,12],[69,-50]],[[3267,6860],[-28,-11],[-13,9],[7,24],[23,11],[17,-2],[2,-15],[-8,-16]],[[4601,9064],[-2,-18],[-19,-15],[-17,-7],[-23,-9],[24,43],[24,-4],[2,7],[11,3]],[[4485,9070],[-20,-16],[-23,26],[35,10],[26,-11],[-18,-9]],[[4453,9489],[10,-4],[44,19],[27,0],[0,-14],[-28,-24],[-54,-22],[-16,-2],[-25,13],[-7,18],[4,21],[11,16],[10,1],[0,-10],[3,-6],[21,-6]],[[4663,9624],[-2,-10],[-4,-7],[5,-9],[-1,-7],[-12,9],[-15,16],[-10,5],[-24,-9],[-9,3],[-13,-3],[-14,-12],[-12,-39],[-11,5],[-5,12],[5,33],[5,12],[11,5],[26,7],[6,7],[22,10],[25,-3],[13,-15],[8,-4],[6,-6]],[[5938,9970],[-11,-3],[-6,1],[-5,2],[-7,-3],[-7,-7],[-11,-16],[-3,4],[-12,2],[-6,2],[-12,5],[11,13],[-5,11],[9,4],[22,14],[26,-11],[6,-10],[11,-8]]],"transform":{"scale":[0.0003871236732673101,0.0004484579316931754],"translate":[118.20899498800023,21.904608466000084]}};
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
