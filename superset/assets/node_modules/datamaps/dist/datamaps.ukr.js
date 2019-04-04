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
  Datamap.prototype.twnTopo = '__TWN__';
  Datamap.prototype.tzaTopo = '__TZA__';
  Datamap.prototype.ugaTopo = '__UGA__';
  Datamap.prototype.ukrTopo = {"type":"Topology","objects":{"ukr":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Crimea"},"id":"UA.KR","arcs":[[0,1,2,3]]},{"type":"MultiPolygon","properties":{"name":"Mykolayiv"},"id":"UA.MY","arcs":[[[4,5]],[[6,7,8,9,10]]]},{"type":"Polygon","properties":{"name":"Chernihiv"},"id":"UA.CH","arcs":[[11,12,13,14]]},{"type":"Polygon","properties":{"name":"Rivne"},"id":"UA.RV","arcs":[[15,16,17,18,19,20]]},{"type":"Polygon","properties":{"name":"Chernivtsi"},"id":"UA.CV","arcs":[[21,22,23,24,25]]},{"type":"Polygon","properties":{"name":"Ivano-Frankivs'k"},"id":"UA.IF","arcs":[[26,-25,27,28,29]]},{"type":"Polygon","properties":{"name":"Khmel'nyts'kyy"},"id":"UA.KM","arcs":[[30,31,-22,32,-17]]},{"type":"Polygon","properties":{"name":"L'viv"},"id":"UA.LV","arcs":[[-19,33,-30,34,35,36]]},{"type":"Polygon","properties":{"name":"Ternopil'"},"id":"UA.TP","arcs":[[-33,-26,-27,-34,-18]]},{"type":"Polygon","properties":{"name":"Transcarpathia"},"id":"UA.ZK","arcs":[[-35,-29,37]]},{"type":"Polygon","properties":{"name":"Volyn"},"id":"UA.VO","arcs":[[-20,-37,38]]},{"type":"Polygon","properties":{"name":"Cherkasy"},"id":"UA.CK","arcs":[[39,40,41,42]]},{"type":"Polygon","properties":{"name":"Kirovohrad"},"id":"UA.KH","arcs":[[43,-11,44,45,-41,46]]},{"type":"Polygon","properties":{"name":"Kiev"},"id":"UA.KV","arcs":[[-14,47,-43,48,49,50],[51]]},{"type":"MultiPolygon","properties":{"name":"Odessa"},"id":"UA.MY","arcs":[[[52]],[[-10,53,54,-45]]]},{"type":"Polygon","properties":{"name":"Vinnytsya"},"id":"UA.VI","arcs":[[-49,-42,-46,-55,55,-23,-32,56]]},{"type":"Polygon","properties":{"name":"Zhytomyr"},"id":"UA.ZT","arcs":[[-50,-57,-31,-16,57]]},{"type":"Polygon","properties":{"name":"Sumy"},"id":"UA.SM","arcs":[[58,59,-12,60]]},{"type":"Polygon","properties":{"name":"Dnipropetrovs'k"},"id":"UA.DP","arcs":[[61,62,63,64,-7,-44,65]]},{"type":"Polygon","properties":{"name":"Donets'k"},"id":"UA.DT","arcs":[[66,67,-63,68,69]]},{"type":"Polygon","properties":{"name":"Kharkiv"},"id":"UA.KK","arcs":[[70,-69,-62,71,-59,72]]},{"type":"Polygon","properties":{"name":"Luhans'k"},"id":"UA.LH","arcs":[[-70,-71,73]]},{"type":"Polygon","properties":{"name":"Poltava"},"id":"UA.PL","arcs":[[-72,-66,-47,-40,-48,-13,-60]]},{"type":"Polygon","properties":{"name":"Zaporizhzhya"},"id":"UA.ZP","arcs":[[-68,74,75,76,77,-64]]},{"type":"Polygon","properties":{"name":"Kiev City"},"id":"UA.KM","arcs":[[-52]]},{"type":"MultiPolygon","properties":{"name":"Kherson"},"id":"UA.KS","arcs":[[[78]],[[-76,79]],[[80]],[[-78,81,-4,82,-5,83,-8,-65]]]},{"type":"Polygon","properties":{"name":"Sevastopol"},"id":"UA.SC","arcs":[[84,-2]]}]}},"arcs":[[[7138,1687],[24,-73],[159,-375],[83,-91],[20,-3],[99,43],[11,13],[15,26],[3,12],[0,11],[3,8],[8,4],[3,4],[8,19],[2,6],[2,23],[5,23],[7,19],[9,8],[14,-2],[1,-12],[-4,-19],[-3,-23],[4,-15],[9,-12],[42,-40],[22,-12],[20,7],[17,33],[7,38],[2,6],[15,15],[12,19],[11,6],[64,-1],[8,8],[9,11],[9,-4],[4,-15],[-4,-23],[7,1],[5,6],[5,7],[6,4],[10,-3],[18,-19],[11,-4],[33,12],[11,-4],[14,-29],[9,-13],[9,4],[10,16],[9,3],[9,-8],[8,-15],[10,-43],[4,-30],[-4,-13],[-18,-8],[-7,0],[-6,2],[-17,15],[-13,3],[-10,-4],[-8,-13],[-3,-25],[2,-9],[4,-5],[2,-6],[-4,-10],[-5,-5],[-12,-1],[-5,-3],[-8,-17],[-6,-25],[-4,-27],[-5,-74],[0,-27],[3,-27],[15,-27],[7,-19],[-1,-18],[-7,-12],[-40,-23],[-50,-4],[-6,-3],[-5,-5],[-2,-8],[-4,-21],[-2,-6],[-11,-5],[-49,18],[-31,31],[0,-9],[-18,12],[-12,-20],[-9,-29],[-9,-15],[-42,5],[-39,-12],[-11,9],[-5,28],[-3,12],[-16,33],[-7,10],[-36,36],[-40,25],[-24,7],[-24,0],[-23,-8],[-20,-16],[-30,-38],[-5,-10],[-1,-14],[-3,-11],[-1,-9],[1,-13],[4,-6],[16,-11],[0,-8],[-8,-6],[-18,2],[-8,-5],[-7,-14],[-1,-16],[4,-38],[-27,33],[-2,-5],[-6,-6],[-3,-6],[-14,13],[-10,-10],[-13,-41],[-10,-14],[-24,-9],[-9,-8],[-14,-41],[-12,-54],[-15,-39],[-24,6],[-6,13],[-5,17],[-7,15],[-11,7],[-18,1],[-6,-1],[-7,-5],[-4,-7],[-3,-7],[-5,-6],[-10,-3],[-18,7],[-8,-9],[-9,-6],[-39,11],[-20,-12],[-39,-42],[-21,-15],[-44,-16],[-18,-12],[-14,-24],[0,3],[0,3],[-1,2],[-2,0],[-22,-51],[-3,-8],[-6,-12],[-19,-53],[-21,-91],[-6,-16],[-5,-3],[-12,3],[-8,0],[-6,1],[-2,-1],[-3,-5],[0,-3],[0,-4],[-1,-5],[-12,-31],[-7,-9],[-26,-9],[-7,-14],[-5,-19],[-8,-21],[-6,-10],[-19,-21],[-7,-4],[-13,-3],[-60,-46],[-11,-2],[-13,3],[-35,23],[-7,-1],[-11,-6],[-6,-2],[-37,2],[-6,2]],[[6433,21],[19,10],[1,15],[11,9],[36,8],[-5,31],[-20,89],[-16,6],[-5,30],[-21,-3],[-10,35],[21,53],[-23,53],[-46,-6],[-8,74],[43,42],[-8,47],[-32,31],[-20,4],[-6,41]],[[6344,590],[16,9],[6,15],[3,22],[3,24],[-1,29],[-6,49],[-1,21],[-2,8],[-10,31],[-2,11],[-1,32],[-9,51],[-14,30],[-38,39],[-31,45],[-9,6],[-23,-5],[-21,-13],[-19,-18],[-13,-6],[-6,12],[-5,18],[-12,9],[-25,12],[-8,13],[-20,39],[-14,12],[-4,11],[-7,19],[-5,6],[-10,6],[-4,5],[-37,50],[-20,22],[-23,14],[-83,12],[-12,-3],[-9,-10],[-19,-34],[-8,-7],[-40,0],[-12,6],[-19,16],[-12,3],[-15,68],[-3,18],[8,33],[16,28],[66,80],[11,5],[13,1],[10,6],[9,7],[8,10],[5,10],[3,8],[4,7],[9,2],[5,-1],[11,-7],[7,-1],[7,4],[1,10],[-2,11],[0,10],[1,10],[2,7],[4,9],[17,27],[38,41],[125,92],[7,9],[3,15],[-2,5],[-6,4],[-4,8],[1,13],[5,7],[5,-6],[9,-18],[19,-18],[20,3],[40,40],[20,14],[3,8],[17,30],[8,5],[24,24],[8,5],[4,-2],[10,-12],[7,-3],[6,2],[13,6],[14,27],[11,11],[6,4],[6,2],[5,-3],[7,-5],[5,-6],[2,-8],[2,-7],[7,-1],[11,3],[1,15],[-1,30],[1,23],[9,-6],[9,8],[19,7],[10,9],[-10,15],[-11,8],[-32,14],[-14,-2],[-6,-5],[-4,-7],[-4,-4],[-6,8],[10,22],[5,14],[-2,7],[-7,4],[0,10],[3,13],[4,10],[-1,9],[-7,43],[-1,14],[6,14],[5,14],[-2,19],[-9,25]],[[6376,2183],[18,29],[6,31],[-5,47],[5,10],[25,-28],[22,-3],[26,11],[24,-8],[26,-24],[29,-29],[25,-29],[20,-18],[23,-14],[21,-12],[31,-6],[22,12],[19,-3],[21,-18],[16,-17],[18,0],[15,-18],[9,-32],[8,-26],[10,-26],[13,-21],[17,-20],[22,-6],[9,23],[5,15],[22,-6],[17,3],[24,3],[25,-9],[26,-26],[16,-27],[11,-40],[0,-38],[0,-50],[3,-32],[12,-24],[33,-14],[26,-32],[20,-32],[13,-6],[14,14]],[[5391,2680],[-20,-49]],[[5371,2631],[-25,16],[-12,5],[-13,2],[-8,-7],[-9,-14],[-3,-7],[-2,-10],[-1,-12],[1,-39],[-13,53],[-4,7],[-8,5],[-65,103],[-9,29],[18,-22],[15,-25],[8,-6],[97,11],[19,-8],[32,-31],[2,-1]],[[6047,4488],[6,-8],[0,-8],[-3,-12],[-5,-23],[0,-7],[2,-5],[3,-2],[3,0],[3,0],[3,1],[3,-2],[4,-3],[6,-12],[2,-7],[-1,-5],[-1,-4],[-2,-3],[-2,-5],[-1,-6],[-1,-29],[0,-5],[-2,-5],[-1,-4],[-1,-7],[-1,-9],[0,-69],[1,-8],[1,-6],[2,-3],[3,-2],[2,-5],[3,-8],[3,-16],[0,-7],[-2,-3],[-24,-4],[-21,-9],[-3,-2],[-5,-5],[-2,-4],[0,-4],[0,-4],[4,-11],[9,-25],[4,-15],[1,-6],[1,-7],[1,-12],[0,-8],[-1,-6],[-3,-7],[-7,-10],[-1,-4],[-2,-5],[-2,-10],[0,-5],[2,-4],[1,-3],[5,-2],[46,-11]],[[6077,4008],[-1,-11],[0,-15],[0,-9],[1,-4],[0,-5],[2,-3],[1,-3],[9,-11],[3,-6],[1,-3],[1,-4],[-1,-5],[-1,-4],[-2,-8],[-1,-5],[0,-4],[1,-2],[0,-1],[0,-3],[3,-10],[1,-4],[2,-5],[1,-3],[0,-4],[0,-5],[0,-5],[-1,-10],[-1,-11],[-1,-5],[1,-4],[0,-5],[1,-4],[1,-3],[2,-8],[1,-4],[0,-5],[-1,-4],[-2,-3],[-5,-3],[-11,-1],[-3,1],[-3,1],[-2,3],[-1,4],[-3,16],[-5,19],[-2,3],[-2,1],[-2,-2],[-1,-7],[-1,-11],[-2,-6],[-9,-18],[-2,-6],[-1,-4],[1,-4],[0,-3],[1,-4],[2,-4],[1,-3],[2,-3],[2,-2],[3,-2],[4,-1],[18,-1],[3,-1],[2,-2],[2,-3],[12,-41],[0,-4],[1,-9],[1,-7],[0,-3],[-1,-5],[-1,-10],[-6,-24],[-2,-15],[-1,-10],[0,-5],[0,-5],[1,-4],[1,-4],[3,-11],[12,-33],[1,-5],[-1,-3],[-3,-10],[-1,-5],[-1,-5],[-1,-5],[-2,-2],[-5,0],[-3,1],[-7,7],[-3,1],[-3,-1],[-3,-3],[-16,-30],[-3,-3],[-4,-3],[-8,-2],[-13,0],[-2,2],[-6,11],[-2,2],[-2,-2],[-3,-7],[-5,-21],[-15,-47],[-9,-21],[-2,-4],[0,-4],[0,-4],[0,-4],[1,-4],[1,-6],[0,-11],[1,-4],[2,-2],[3,-1],[9,2],[3,-1],[2,-1],[32,-30],[26,-37],[1,-3],[0,-4],[-1,-5],[-1,-4],[-5,-11],[-10,-18],[-1,-3],[-1,-3],[-1,-4],[0,-4],[0,-3],[0,-2],[-15,15],[-4,5],[-3,6],[-3,7],[-2,4],[-1,1],[-2,-1],[-3,-3],[-6,-8],[-2,-7],[-1,-5],[0,-15],[1,-9],[0,-4],[1,-4],[2,-3],[2,-2],[3,-1],[20,0],[2,-1],[2,-2],[1,-3],[2,-4],[0,-4],[-3,-5],[-5,-4],[-23,-10],[-7,-6],[-12,-21],[-6,-4],[-54,-14],[-3,-2],[-2,-6],[-1,-5],[1,-4],[2,-3],[2,-2],[2,-2],[5,-2],[12,-2],[30,5],[4,-2],[5,-5],[3,0],[6,0],[2,0],[1,-3],[-5,-7],[-10,-8],[-43,-23],[-2,-3],[-2,-2],[-4,-1],[-27,2],[-30,-7],[-6,1],[-1,0],[-3,2],[-1,3],[-2,3],[-2,3],[-3,11],[-2,3],[-2,3],[-2,3],[-13,6],[-3,2],[-2,3],[-2,3],[-4,1],[-22,-1],[-6,2],[-4,3],[-2,2],[-5,1],[-2,2],[-2,3],[-2,3],[-2,2],[-3,0],[-2,-2],[-1,-6],[0,-18],[0,-6],[-1,-6],[-1,-4],[-2,-4],[-1,-2],[-3,-4],[-4,-1],[-20,-3],[-5,2],[-4,3],[-1,4],[-2,7],[-2,3],[-3,2],[-2,1],[-12,-2],[-19,-8],[-4,-3],[-4,-8],[-3,-6],[-6,-30],[-1,-4],[-3,-3],[-5,-2],[-14,2],[-32,18],[-6,1],[-8,-2],[-3,-3],[-3,-3],[-5,-7],[-2,-6],[-2,-5],[-5,-24],[-6,-16],[-1,-3],[-4,-6],[-4,-6],[-9,-6],[-18,-8],[-6,0],[-7,4],[-9,8],[-3,2],[-3,0],[-4,-1],[-4,-2],[-10,-11],[-4,-7],[-9,-4],[-28,1],[0,-6],[0,-1]],[[5454,2930],[-2,7],[-7,18],[-5,21],[-2,52],[10,39],[15,36],[11,44],[3,25],[0,19],[-6,13],[-28,8],[-5,10],[1,16],[17,39],[4,13],[-3,9],[-15,3],[-24,-7],[-11,2],[-9,14],[16,53],[2,30],[-8,33],[-8,11],[-7,3],[-6,5],[-4,19],[-2,24],[0,13],[-2,10],[-8,13],[-32,24],[-5,15],[2,25],[0,10],[-6,4],[-2,-5],[-8,-22],[-2,-7],[4,-15],[8,-14],[11,-11],[25,-9],[5,-15],[0,-73],[2,-7],[14,-5],[4,-6],[3,-6],[2,-3],[7,-9],[-4,-21],[-8,-21],[-4,-8],[-4,-57],[17,-12],[25,5],[19,-5],[-17,-28],[-7,-20],[-3,-21],[5,-22],[10,-4],[12,6],[11,11],[3,-27],[-5,-37],[-10,-33],[-13,-14],[-13,-6],[-12,-19],[-7,-27],[0,-33],[21,-44],[2,-8],[-4,-56],[2,-21],[3,-10],[0,-8],[-5,-16],[-4,-8],[-12,-13],[-6,-5],[-25,-8],[-24,6],[-54,32],[-33,-4],[-9,-8],[-5,-17],[-5,-16],[-13,-3],[-4,4],[-8,12],[-5,2],[-12,-1],[-6,1],[-5,4],[-2,18],[6,21],[30,80],[8,27],[0,12],[7,10],[25,59],[-6,16],[-5,-7],[-4,-19],[-4,-15],[-4,-5],[-10,-8],[-5,-4],[-3,-7],[-11,-26],[-1,-4],[-1,-4],[-7,-3],[-7,7],[-7,10],[-9,31],[-6,16],[-8,6],[6,-32],[1,-8],[1,-18],[4,-7],[5,-4],[17,-22],[2,-10],[-4,-16],[-11,-25],[0,-5],[-9,-10],[-19,-47],[-7,-11],[-11,-4],[-24,-21],[-8,-10],[-8,6],[-16,4],[-7,7],[-4,-9],[-10,11],[-38,16]],[[5023,2814],[-9,69],[0,24],[2,6],[1,9],[0,7],[-1,8],[-2,12],[-4,100],[-2,11],[-10,13],[-7,7],[-2,2],[-2,4],[-6,23],[-4,10],[-4,6],[-23,25],[-4,9],[-5,15],[-4,27],[-1,12],[1,6],[2,1],[28,3],[3,1],[2,3],[5,15],[2,4],[3,2],[2,0],[3,-1],[3,-1],[3,-5],[3,-1],[2,0],[6,3],[33,3],[3,1],[3,3],[3,11],[1,4],[2,3],[12,8],[2,2],[1,3],[3,15],[3,19],[2,8],[3,6],[3,4],[4,8],[1,8],[0,8],[0,13],[6,22],[-1,8],[-1,6],[-2,3],[-3,1],[-9,1],[-3,2],[-2,3],[-2,6],[-2,10],[-1,6],[-2,5],[-1,3],[-6,8],[-2,5],[-3,6],[-2,11],[-2,6],[-3,4],[-5,0],[-5,-3],[-8,-5],[-2,-2],[-3,0],[-2,1],[-2,2],[-6,8],[-5,4],[-14,5],[-2,3],[-3,3],[-2,5],[-1,5],[0,5],[1,10],[1,10],[1,4],[3,2],[2,2],[6,2],[5,3],[2,3],[7,12],[2,6],[2,8],[-1,12],[-2,7],[-4,14],[-1,3],[-1,1],[-1,2],[-2,1],[-45,-15],[-17,-12],[-3,1],[-2,2],[-7,16],[-2,3],[-2,1],[-22,1],[-31,9],[-7,18],[-9,32],[-26,120],[-3,21],[7,27],[4,20],[1,11],[1,14],[0,9],[0,7],[0,1],[5,3],[1,3],[1,4],[1,5],[1,12],[-3,27],[-2,7],[-8,15],[-6,17],[-4,7],[-4,4],[-19,1],[-2,3],[-1,3],[2,4],[1,7],[0,10],[-1,22],[-2,9],[-3,4],[-31,-11],[-2,-3],[-1,-4],[-1,-5],[-3,-21],[-3,-8],[-2,-4],[-1,-2],[-3,0],[-3,3],[-2,4],[-3,10],[-3,22],[-2,6],[-3,2],[-20,1],[-3,1],[-4,2],[-7,9],[-3,2],[-3,0],[-3,-1],[-5,-9],[-9,-10],[-5,-4],[-2,-1],[-3,1],[-3,3],[-2,4],[-3,3],[-2,2],[-3,0],[-25,-7],[-3,2],[-2,2],[-5,9],[-3,3],[-13,10],[-5,7],[-2,6],[-2,5],[-2,11],[-3,16],[-1,6],[-1,4],[1,5],[1,5],[4,12],[1,5],[1,6],[-1,8],[-1,5],[-2,4],[-7,9],[-7,11],[-2,6],[0,5],[1,5],[1,3],[6,9],[2,3],[1,4],[0,2],[0,6],[-2,19],[-3,5],[-3,4],[-15,9],[-6,5],[-8,13],[-3,6],[-1,5],[-1,6],[-1,3],[-13,135],[-1,6],[-2,5],[-11,18],[-5,13],[-3,4],[-2,3],[-2,2],[-14,6],[-3,3],[-2,4],[0,4],[-1,11],[1,5],[0,5],[4,10],[1,5],[0,4],[0,4],[0,17],[0,7],[-2,4],[-7,7],[0,3],[1,4],[3,5],[3,3],[19,12],[8,-1],[2,1],[4,7],[2,2],[3,1],[3,-1],[3,-1],[3,-1],[3,1],[2,3],[0,6],[0,6],[-2,4],[-8,6],[-1,4],[-1,6],[-1,22]],[[4526,4700],[17,-1],[4,2],[3,7],[3,22],[4,5],[85,0],[5,-2],[5,0],[4,-1],[25,-14],[21,-6],[6,0],[3,1],[2,4],[1,3],[2,10],[1,4],[5,5],[7,5],[26,13],[6,2],[16,-5],[17,0],[7,-1],[5,-3],[1,-4],[0,-4],[2,-5],[2,-4],[6,-4],[3,1],[3,3],[3,16],[2,4],[2,4],[5,5],[4,1],[4,0],[2,-3],[2,-2],[2,-4],[1,-3],[0,-5],[1,-5],[1,-5],[3,-4],[7,-4],[4,-1],[4,0],[2,2],[2,3],[2,4],[3,5],[5,5],[17,8],[4,3],[2,4],[1,4],[1,5],[2,10],[4,7],[7,7],[20,10],[11,3],[40,-6],[9,-4],[10,-2],[5,-2],[3,-3],[1,-3],[1,-4],[1,-34],[1,-4],[2,-4],[4,-4],[12,-5],[3,-3],[1,-2],[0,-4],[0,-19],[0,-5],[1,-4],[1,-3],[1,-3],[1,-2],[2,-2],[5,-4],[52,-11],[4,1],[10,10],[9,5],[2,-1],[2,-3],[1,-4],[1,-4],[3,-4],[4,-4],[3,-1],[3,1],[2,3],[5,3],[7,3],[30,4],[3,-1],[2,-2],[1,-4],[1,-4],[1,-9],[-2,-26],[-1,-5],[-1,-5],[-2,-7],[-1,-2],[0,-4],[0,-5],[3,-4],[3,-2],[3,0],[3,1],[2,3],[1,5],[0,5],[1,15],[1,6],[1,5],[5,5],[3,-1],[2,-3],[2,-5],[3,-1],[3,0],[8,2],[3,2],[2,3],[0,4],[0,13],[0,5],[1,4],[2,3],[3,3],[9,6],[4,-1],[2,-2],[8,-13],[3,-3],[5,-3],[7,2],[4,-2],[4,-2],[5,-6],[4,-2],[3,0],[22,6],[5,-1],[3,-2],[1,-4],[4,-21],[2,-7],[1,-5],[0,-4],[0,-5],[0,-5],[-1,-5],[-1,-5],[-1,-4],[-2,-2],[-7,-7],[-22,-16],[-2,-2],[0,-3],[1,-4],[7,-20],[1,-1],[17,-46],[8,-13],[6,-10],[3,-1],[14,5],[3,-1],[3,-3],[3,-6],[2,-7],[1,-5],[0,-5],[0,-4],[1,-4],[2,-3],[1,-4],[12,-21],[1,-4],[1,-4],[1,-4],[0,-5],[0,-5],[-1,-4],[-2,-4],[-9,-22],[-2,-4],[-1,-4],[0,-5],[0,-4],[1,-4],[5,-10],[1,-4],[0,-4],[0,-5],[0,-5],[0,-6],[0,-6],[0,-5],[3,-7],[3,-2],[3,-1],[48,1],[3,1],[2,2],[1,4],[1,5],[1,5],[3,3],[6,1],[20,-4],[5,-3],[6,-9],[13,-10],[2,-3],[2,-3],[1,-3],[5,-15],[2,-7],[3,-6],[4,-5],[11,-9],[6,-3],[5,-2],[6,1],[5,4],[2,2],[4,6],[6,14],[7,22],[12,30],[2,4],[2,3],[2,2],[5,3],[20,5],[10,-2],[6,-3],[15,-15],[9,-15],[3,-1],[3,1],[6,4],[6,3],[3,-1],[4,-1],[2,-2],[36,-21],[6,-1],[96,23],[3,2],[1,3],[1,4],[0,20],[0,4],[1,10],[1,4],[2,3],[11,3],[2,2],[2,3],[-1,4],[-1,3],[-2,3],[-2,3],[-1,4],[0,5],[1,10],[0,5],[-1,4],[-4,11],[-1,4],[0,4],[0,4],[1,4],[1,4],[2,2],[6,2],[15,3],[2,1],[2,3],[1,4],[0,5],[0,9],[0,4],[-3,2],[-9,3],[-3,2],[-2,2],[-1,4],[-1,4],[0,4],[0,5],[1,6],[1,4],[1,5],[2,4],[1,3],[2,3],[5,5],[7,6],[23,6],[10,7],[3,-1],[3,-2],[1,-3],[4,-11],[2,-4],[4,-4],[6,-4],[3,-1],[3,1],[2,4],[1,4],[2,10],[1,4],[2,3],[18,5],[2,2],[2,3],[1,3],[0,3],[0,1],[0,1],[-2,12],[0,9],[0,5],[0,5],[1,4],[3,4],[3,4],[7,3],[6,0],[14,-4],[4,0],[11,12],[3,1],[2,-2],[1,-4],[1,-4],[1,-9],[1,-4],[1,-4],[3,-7],[10,-18],[1,-3],[1,-2],[1,-3],[0,-4],[-1,-16],[1,-4],[1,-4],[9,-10]],[[6250,9968],[-2,-6],[-4,-21],[-2,-20],[-1,-8],[-7,-14],[-3,-9],[-1,-10],[-2,-23],[-1,-9],[-6,-12],[-14,-21],[-3,-15],[3,-60],[2,-11],[2,-3],[24,-11],[3,-3],[12,-17],[11,-20],[6,-9],[1,-3],[2,-4],[1,-4],[1,-4],[2,-2],[3,-2],[17,-2],[3,-2],[1,-3],[0,-5],[-1,-6],[-1,-8],[-4,-13],[-3,-6],[-3,-3],[-12,-5],[-13,-2],[-7,1],[-3,1],[-3,3],[-1,3],[-1,4],[-1,4],[-2,2],[-2,0],[-3,-2],[-2,-4],[-1,-8],[0,-41],[0,-6],[-1,-5],[-3,-8],[-3,-4],[-2,-4],[-2,-2],[-1,-4],[4,-3],[9,-21],[1,-13],[-6,-15],[-31,-14],[-13,-3],[-8,-5],[-20,-24],[-6,-5],[-25,3],[-11,-5],[4,-15],[0,-9],[-14,-5],[-7,-18],[-5,-20],[-11,-9],[-7,-10],[-9,-24],[-6,-29],[4,-26],[3,-10],[6,-29],[4,-9],[4,-8],[30,-43],[-1,-14],[-8,-17],[-1,-13],[1,-11],[3,-5],[3,-3],[3,-1],[2,-4],[0,-5],[3,-50],[2,-6],[2,-4],[3,-3],[2,-2],[2,-4],[0,-4],[-1,-3],[-3,-3],[-10,-4],[-2,-4],[-1,-8],[0,-16],[2,-8],[2,-5],[11,-14],[2,-4],[2,-3],[0,-4],[-1,-5],[-8,-15],[-1,0],[-1,-2],[-2,1],[-4,2],[-16,12],[-2,0],[-1,-3],[5,-25],[1,-5],[-1,-5],[-2,-7],[-3,-4],[-3,-2],[-2,-2],[-2,-6],[0,-9],[2,-20],[3,-8],[3,-6],[4,-6],[0,-3],[0,-3],[-2,-4],[-2,-4],[-1,-5],[-1,-7],[1,-10],[1,-7],[0,-7],[-2,-7],[-2,-5],[-3,-3],[-5,-3],[-12,-4],[-7,0],[-3,2],[-3,2],[-3,2],[-1,3],[-2,4],[-4,15],[-1,3],[0,2],[-2,3],[-3,1],[-4,1],[-3,-1],[-2,-2],[-2,-4],[-3,-12],[-1,-4],[0,-3],[1,-4],[2,-8],[6,-14],[2,-9],[1,-5],[3,-2],[3,-1],[6,0],[3,-1],[2,-3],[1,-3],[1,-5],[0,-7],[-2,-10],[-2,-7],[0,-7],[3,-7],[2,-4],[7,-9],[1,-4],[1,-4],[-2,-5],[-2,-4],[-1,-5],[-1,-6],[3,-15],[1,-6],[0,-4],[-3,-5],[-2,-3],[-16,-11],[-1,-5],[-1,-8],[1,-14],[0,-8],[-2,-10],[-2,-3],[-3,-4],[-28,-13],[-3,-4],[-1,-8],[1,-17],[2,-10],[2,-8],[0,-6],[-1,-8],[-2,-5],[-13,-32],[-1,-4],[0,-4],[3,-3],[21,-9],[22,-14],[3,-2],[3,0],[12,4],[2,0],[2,-2],[2,-3],[0,-5],[0,-5],[-3,-5],[-8,-8],[-1,-4],[0,-4],[3,-4],[2,-4],[6,-5],[11,-8],[29,-9],[3,0],[3,3],[2,3],[11,35],[2,3],[3,0],[7,-3],[6,-4],[2,-3],[1,-5],[-5,-15],[-8,-22],[-4,-6],[-2,-3],[-9,-14],[-1,-4],[0,-5],[0,-5],[1,-5],[2,-4],[12,-14],[1,-4],[1,-7],[-1,-13],[-1,-28],[1,-5],[0,-10],[-1,-7],[-2,-9],[-5,-11],[-3,-4],[-4,-2],[-2,-2],[-2,-4],[-1,-6],[-13,-72],[-1,-13],[-1,-23],[1,-13],[1,-10],[2,-5],[5,-9],[7,-8],[4,-3],[4,-4],[1,-6],[0,-7],[-1,-9],[-5,-9],[-4,-6],[-4,-4],[-3,-5],[-3,-9],[-1,-13],[0,-19],[-1,-6],[-1,-5],[-4,-5],[-6,-6],[-2,-3],[-1,-5],[1,-8],[1,-10],[1,-5],[0,-5],[-1,-16],[-5,-29],[-19,-79]],[[6062,7708],[-21,-59],[-8,-15],[-14,-8],[-6,-6],[-4,-5],[-2,-6],[-4,-15],[-2,-4],[-3,-3],[-10,-5],[-12,-11],[-4,-5],[-3,-6],[-3,-13],[-3,-11],[-3,-5],[-2,-3],[-6,-3],[-19,-2],[-9,-4],[-47,-37],[-21,0],[-3,2],[-1,3],[-1,4],[-3,3],[-5,0],[-22,-6],[-56,3],[-13,6],[-1,2],[-1,2],[-3,7],[-2,8],[0,4],[-1,5],[-1,4],[-2,8],[-1,3],[-2,2],[-3,2],[-4,1],[-8,0],[-4,-2],[-17,-18],[-3,-1],[-3,2],[-3,6],[-2,3],[-4,6],[-2,3],[-3,1],[-15,-1],[-34,-23],[-2,-3],[-2,-2],[-4,-7],[-11,-27],[-6,-9],[-6,-7],[-5,-3],[-4,0],[-3,2],[-4,5],[-2,2],[-34,0]],[[5550,7472],[-33,30],[-4,5],[-3,7],[1,3],[2,3],[4,6],[2,3],[2,3],[2,4],[0,6],[-2,3],[-2,2],[-7,1],[-6,-1],[-4,0],[-5,2],[-9,6],[-4,4],[-2,4],[-2,3],[-1,3],[0,5],[0,4],[0,6],[0,6],[-2,8],[-1,5],[-2,3],[-13,16],[-3,7],[0,5],[1,5],[3,8],[7,12],[0,1],[1,1],[2,1],[2,1],[11,-3],[1,0],[3,2],[1,3],[1,4],[1,5],[1,17],[-2,18],[-2,7],[-3,4],[-24,0],[-7,1],[-3,1],[-4,6],[-6,9],[-19,39],[-8,7],[-16,22],[-6,6],[-5,4],[-12,-3],[-11,-5],[-3,-2],[-2,-3],[-1,-3],[0,-5],[0,-5],[-1,-4],[-1,-4],[-3,-6],[-1,-4],[0,-4],[0,-4],[1,-4],[-1,-4],[-2,-2],[-5,-4],[-2,-2],[-2,-4],[-1,-4],[-3,-7],[-2,-3],[-2,-3],[-3,-1],[-3,-1],[-23,3],[-3,0],[-3,-1],[-2,-2],[-3,-3],[-3,-6],[-4,-6],[-2,-3],[-3,-2],[-6,-1],[-3,-1],[-2,-3],[-2,-3],[-6,-10],[-2,-3],[-2,-1],[-3,-1],[-8,1],[-3,-1],[-3,-1],[-4,-6],[-2,-2],[-3,-1],[-3,0],[-34,11],[-2,0],[-3,-1],[-2,-2],[-2,-2],[-6,-10],[-6,-7],[-43,15],[-12,2],[-7,0],[-3,-3],[-3,-2],[-7,-2],[-3,2],[-3,2],[-6,6],[-4,2],[-6,0],[-4,2],[-3,2],[-2,2],[-2,3],[-1,4],[-2,3],[-1,4],[0,6],[1,11],[0,6],[-2,7],[-3,2],[-4,1],[-11,0],[-4,2],[-3,2],[-16,24],[-1,3],[-2,3],[0,5],[0,5],[2,10],[1,3],[2,2],[6,-1],[3,1],[2,3],[2,3],[1,4],[3,9],[1,5],[0,5],[0,5],[-2,13],[-2,17],[-2,8],[-3,7],[-3,7],[-8,12],[-13,15],[0,2],[-1,3],[0,11],[-1,6],[-2,3],[-3,1],[-9,1],[-7,2],[-4,4],[-2,4],[1,4],[1,5],[1,4],[0,5],[-1,5],[-4,6],[-2,5],[-2,6],[-2,7],[-3,3],[-3,2],[-3,0],[-3,-2],[-2,-2],[-7,-8],[-3,-1],[-5,-2],[-7,-1],[-30,4],[-7,0],[-5,-4],[-9,-11],[-4,-1],[-6,1],[-27,10],[-3,-1],[-2,-3],[-4,-11],[-2,-4],[-3,-3],[-5,-1],[-4,2],[-2,2],[-4,8],[-3,6],[-6,7],[-5,4],[-4,1],[-16,-7],[-6,1],[-3,2],[-2,3],[0,5],[1,4],[1,4],[8,20],[5,17],[4,14],[1,10],[3,27],[0,4],[-2,4],[-5,7],[-18,20],[-5,5],[-30,16],[-5,4],[-4,4],[-1,4],[-1,4],[0,5],[0,5],[0,5],[1,6],[3,21],[3,22],[0,10],[0,5],[-1,5],[-1,8],[-1,4],[-1,4],[-1,4],[-3,5],[-14,19],[-5,4],[-5,1],[-3,0],[-5,0],[-7,3],[-6,8],[-4,3],[-3,2],[-3,-1],[-2,-1],[-2,-3],[-3,-4],[-3,-2],[-6,0],[-3,2],[-1,4],[-1,4],[-2,38],[1,77],[1,11],[10,69],[0,10],[0,10],[-1,8],[-7,25],[-1,7],[1,6],[2,2],[3,1],[11,-1],[3,1],[2,2],[1,3],[1,5],[-2,9]],[[4671,8589],[1,1],[0,30],[2,3],[10,24],[1,19],[17,17],[16,23],[-3,35],[7,4],[-1,7],[-4,7],[-2,7],[-6,35],[-2,9],[-7,7],[-6,0],[-4,3],[-2,15],[1,16],[4,9],[6,3],[8,-2],[0,9],[-6,4],[-6,5],[-5,10],[-2,15],[3,10],[-3,9],[-5,8],[-7,8],[5,5],[2,6],[5,14],[-10,6],[-18,8],[-6,12],[0,8],[2,3],[2,2],[3,2],[4,2],[0,8],[-5,4],[-11,13],[0,9],[16,21],[7,4],[-2,12],[-1,5],[3,3],[4,10],[4,5],[-3,17],[6,27],[-3,17],[7,3],[17,0],[6,4],[3,12],[1,16],[2,14],[6,10],[0,9],[-4,1],[-11,7],[6,11],[13,12],[10,14],[-1,19],[-4,12],[0,5],[2,4],[4,9],[12,22],[2,4],[3,4],[2,8],[4,9],[11,8],[2,11],[0,11],[2,8],[5,3],[16,-3],[5,4],[5,7],[7,15],[0,9],[-3,5],[-1,7],[0,5],[16,8],[8,7],[7,8],[6,9],[5,11],[1,4],[-1,7],[1,7],[5,8],[4,5],[3,2],[4,-2],[3,-7],[15,1],[5,17],[-6,16],[-16,3],[2,7],[1,6],[2,6],[3,6],[-4,21],[9,13],[14,7],[76,6],[21,-4],[14,-11],[25,-30],[13,-7],[13,8],[10,21],[8,25],[11,20],[44,25],[51,1],[97,-27],[63,5],[34,4],[19,-5],[13,-17],[3,-20],[0,-23],[2,-20],[10,-8],[10,2],[29,21],[20,2],[34,-12],[10,1],[77,50],[24,28],[16,48],[7,75],[5,23],[5,7],[7,6],[7,7],[3,15],[-2,10],[-11,26],[-3,14],[8,43],[23,6],[48,-24],[26,11],[109,-80],[17,0],[33,12],[16,1],[10,-7],[16,-19],[10,-1],[10,7],[57,71],[11,7],[5,0],[7,-6],[5,2],[4,6],[7,18],[5,4],[11,6],[7,9],[14,25],[9,9],[8,2],[54,-15],[36,1],[9,-3],[14,-14]],[[3069,8899],[-18,-4],[-13,-10],[-6,-2],[-5,-4],[-2,-2],[-2,-8],[-2,-11],[-2,-24],[1,-11],[1,-7],[8,-12],[3,-7],[2,-3],[1,-5],[0,-4],[-1,-5],[-1,-4],[-4,-1],[-3,1],[-3,2],[-22,27],[-1,4],[-2,3],[-1,5],[-2,7],[-3,7],[-2,4],[-2,2],[-2,2],[-3,1],[-3,-1],[-2,-3],[-2,-9],[-5,-56],[0,-16],[1,-10],[8,-11],[2,-3],[1,-4],[0,-6],[-1,-7],[-3,-12],[-2,-5],[-2,-4],[-5,-9],[-3,-2],[-2,-2],[-31,-10],[-2,-3],[-1,-3],[1,-6],[18,-53],[0,-3],[1,-2],[0,-9],[0,-5],[0,-7],[-2,-8],[-5,-14],[-3,-6],[-3,-5],[-12,-10],[-2,-3],[-2,-3],[-2,-4],[-7,-31],[-2,-8],[-3,-5],[-2,-3],[-2,-3],[-4,-9],[-2,-4],[-1,-7],[-1,-9],[-1,-27],[-1,-10],[-4,-9],[-2,-6],[-3,-4],[-6,-8],[-2,-3],[-2,-6],[-6,-23],[-3,-7],[-3,-4],[-13,-9],[-21,-8],[-3,-1],[-3,-3],[-1,-3],[-2,-5],[-6,-25],[0,-1],[-4,-5],[0,-2],[0,-4],[3,-11],[6,-16],[1,-5],[1,-7],[1,-12],[1,-6],[2,-4],[4,-6],[2,-4],[0,-4],[-2,-8],[-3,-3],[-5,-4],[-1,-4],[1,-6],[2,-5],[7,-13],[3,-8],[0,-9],[-1,-13],[-8,-60],[-1,-7],[1,-9],[1,-13],[1,-8],[1,-6],[1,-3],[5,-15],[11,-24],[2,-4],[2,-8],[2,-8],[0,-4],[0,-9],[-3,-13],[-12,-48],[-5,-11],[-11,-19],[-2,-6],[-5,-24],[-4,-13],[-1,-2],[-1,-4],[1,-6],[2,-11],[3,-5],[2,-4],[11,-8],[2,-3],[2,-3],[1,-5],[-4,-19],[-20,-33]],[[2806,7711],[-26,9],[-4,3],[-3,5],[0,5],[0,6],[0,7],[-1,6],[-2,10],[-3,4],[-4,3],[-9,-1],[-4,-2],[-2,-3],[-1,-3],[-3,-9],[-3,-15],[-1,-3],[-3,-2],[-2,-2],[-12,-5],[-11,-7],[-4,-5],[-9,-11],[-4,-7],[-3,-5],[-5,-5],[-5,-2],[-4,-1],[-6,2],[-12,10],[-11,6],[-4,0],[-3,-1],[-11,-14],[-38,-23],[-1,-2],[-2,-4],[-1,-4],[-1,-5],[-1,-5],[1,-5],[1,-9],[0,-5],[0,-5],[-2,-6],[-3,-2],[-3,-1],[-3,0],[-13,9],[-6,1],[-4,-2],[-1,-5],[-1,-5],[0,-10],[-2,-6],[-2,-7],[-6,-8],[-3,-5],[-2,-6],[0,-5],[-3,-7],[-5,-9],[-24,-28],[-1,-4],[-1,-5],[1,-8],[0,-3],[-1,-4],[-1,-4],[-1,-4],[-3,-4],[-26,-27],[-4,-6],[-4,-12],[-4,-12],[-3,-6],[-5,-6],[-20,-21],[-2,-3],[-7,-14],[-3,-7],[-10,-14],[-4,-4],[-4,-2],[-13,-2],[-4,0],[-7,3],[-5,0],[-8,-1],[-5,-3],[-3,-3],[-9,-11],[-3,-6],[-23,-52],[-10,-17],[-11,-11],[-28,-18]],[[2274,7224],[-1,38],[-2,5],[-3,6],[-4,3],[-5,7],[-2,6],[0,6],[1,5],[1,5],[2,9],[3,8],[2,3],[4,7],[1,5],[2,8],[0,6],[-2,5],[-3,5],[-2,1],[-3,-1],[-5,-10],[-5,-4],[-16,-10],[-3,-1],[-3,0],[-4,1],[-36,25],[-6,3],[-4,1],[-3,0],[-3,-1],[-3,-2],[-15,-12],[-5,0],[-8,3],[-16,8],[-7,3],[-5,0],[-14,-15],[-51,-81],[-4,-5],[-8,-6],[-64,-8],[-10,-3],[-5,-4],[-8,-12],[-3,-4],[-6,-5],[-4,0],[-2,2],[-4,8],[-3,3],[-3,0],[-3,-2],[-12,-17],[-3,-3],[-4,-3],[-4,0],[-2,2],[-3,4],[-4,3],[-14,5],[-12,8],[-13,6],[-7,1],[-4,-2],[-2,-3],[-1,-5],[-3,-19],[-1,-11],[1,-4],[1,-4],[1,-4],[2,-3],[7,-8],[1,-3],[1,-3],[0,-5],[-4,-11],[0,-5],[-3,-5],[-3,-6],[-16,-14],[-2,-4],[-1,-4],[0,-5],[0,-5],[1,-10],[0,-5],[-1,-11],[-1,-6],[-1,-5],[-2,-1],[-4,6],[-3,3],[-7,3],[-4,-2],[-2,-4],[0,-5],[-2,-19]],[[1794,7050],[-40,35],[-51,68],[-5,9],[-5,32],[0,5],[-1,10],[1,21],[4,31],[0,7],[-2,6],[-11,18],[-2,8],[0,6],[1,3],[16,23],[4,7],[1,4],[1,4],[1,7],[0,9],[-3,17],[-2,9],[-2,5],[-2,3],[-3,2],[-6,3],[-4,0],[-3,0],[-6,-2],[-15,-13],[-5,-3],[-7,-1],[-11,2],[-8,5],[-3,13]],[[1626,7403],[32,45],[12,20],[7,14],[4,5],[5,3],[5,2],[8,4],[3,8],[1,6],[0,6],[-1,4],[-1,3],[-3,2],[-10,3],[-3,2],[-2,3],[-14,36],[-5,10],[-8,11],[-9,10],[-3,3],[-1,3],[-2,6],[1,4],[2,2],[4,0],[10,-2],[3,0],[3,1],[2,3],[2,2],[2,3],[4,9],[9,23],[1,3],[-1,3],[-2,3],[-4,6],[-16,18],[-2,4],[-2,6],[0,5],[1,5],[2,4],[4,7],[3,3],[3,2],[2,0],[26,-10],[43,-7],[4,2],[4,2],[6,8],[3,6],[2,6],[0,6],[0,5],[0,5],[-1,5],[-1,4],[-2,8],[-7,19],[0,5],[0,8],[2,4],[3,2],[40,-8],[4,1],[4,2],[1,4],[0,4],[-2,3],[-13,11],[-2,4],[-1,5],[1,9],[5,8],[1,7],[1,5],[-3,12],[-1,5],[1,6],[2,1],[2,-1],[8,-11],[7,-7],[12,-7],[14,-4],[4,0],[6,2],[16,15],[19,11],[22,16],[11,13],[12,8],[29,1],[7,-2],[3,-2],[8,-12],[11,-19],[1,-3],[1,-4],[-1,-4],[0,-4],[1,-3],[3,-2],[22,-6],[3,-1],[3,-2],[4,-6],[12,-17],[4,-6],[4,-2],[4,-1],[5,1],[3,2],[2,4],[5,42],[1,5],[2,4],[2,5],[4,6],[4,10],[1,4],[0,5],[0,10],[0,4],[0,5],[-3,24],[2,49],[0,4],[0,5],[1,5],[3,9],[3,4],[3,3],[2,2],[25,29],[4,3],[3,2],[4,0],[3,0],[10,-4],[6,1],[2,2],[3,3],[3,7],[0,4],[0,3],[-1,2],[-4,4],[-13,9],[-2,2],[-1,5],[2,9],[7,15],[14,19],[2,5],[1,4],[1,5],[0,5],[0,5],[-1,5],[-1,3],[-3,4],[-2,5],[-2,3],[-9,10],[-2,3],[-2,4],[0,6],[2,9],[3,5],[3,3],[39,8],[5,2],[4,3],[8,8],[2,6],[1,6],[-1,9],[-1,15],[0,4],[-1,4],[-2,4],[-2,3],[-1,3],[-1,5],[-1,9],[-1,5],[-1,4],[-9,21],[-9,15],[-5,6],[-2,2],[-3,1],[-6,0],[-5,-2],[-2,-1],[-6,-7],[-2,-1],[-3,-1],[-14,9],[-3,2],[-2,4],[0,6],[3,35],[1,7],[2,3],[40,12],[4,4],[6,9],[5,13],[3,8],[0,8],[1,13],[0,6],[-1,4],[-1,4],[-2,4],[-28,40],[-42,29],[-3,3],[-1,3],[-3,7],[-11,19],[-16,19],[-2,3],[-2,3],[-1,4],[0,4],[-1,10],[-1,4],[-1,3],[-1,3],[-2,1],[-11,8],[-5,4],[-2,3],[-1,3],[-3,8],[-1,4],[1,10],[2,13],[5,28],[0,10],[-1,4],[-2,-2],[-8,-10],[-3,-3],[-3,-1],[-3,-1],[-7,0],[-4,1],[-3,2],[-2,2],[-2,3],[-1,4],[-1,4],[-1,4],[-2,2],[-3,1],[-2,-1],[-3,-3],[-2,-4],[-3,-12],[-2,-4],[-4,-5],[-2,-3],[-3,-1],[-3,-1],[-3,1],[-12,7],[-7,1],[-7,-1],[-7,-2],[-5,-3],[-8,-6],[-1,-3],[-2,-4],[-1,-4],[-3,-14],[-2,-4],[-2,-3],[-2,-1],[-3,0],[-3,1],[-2,3],[-2,2],[-1,4],[-3,7],[-1,4],[-1,4],[0,6],[4,46],[0,6],[-1,14],[0,11],[0,16],[3,21],[0,11],[0,5],[0,5],[-1,5],[-6,34],[-1,11],[0,5],[0,20],[1,7],[2,5],[3,7],[4,7],[10,12],[3,6],[4,13],[2,8],[0,6],[-1,4],[-2,3],[-2,3],[-3,3],[-9,4],[-3,2],[-2,3],[0,5],[-1,4],[-1,5],[-1,2],[-3,0],[-6,-2],[-3,0],[-7,1],[-3,2],[-2,3],[-2,3],[-1,4],[-1,4],[0,5],[0,16],[-2,25],[1,21],[2,26],[2,12],[1,8],[5,13],[27,54],[20,24],[4,6],[7,15],[5,16],[2,7],[1,6],[0,4],[-1,5],[-1,4],[-1,4],[-2,8],[-1,7],[-1,9],[0,9],[0,6],[2,5],[1,3],[3,3],[2,2],[8,7],[2,3],[-1,2],[-3,1],[-51,5],[-7,6],[-2,22]],[[1894,9436],[75,-1],[47,13],[119,-32],[38,2],[17,-5],[36,-45],[16,-10],[129,-8],[7,-5],[0,-8],[-2,-12],[2,-12],[6,-13],[8,-6],[122,-5],[105,-66],[37,-8],[56,27],[49,-2],[23,-7],[14,-12],[4,-20],[-2,-27],[0,-33],[5,-25],[8,-11],[11,-1],[13,2],[17,-6],[-2,-21],[-8,-27],[-3,-21],[7,-10],[12,2],[22,10],[33,-8],[12,1],[12,8],[15,24],[10,8],[20,-1],[60,-34],[31,-1],[9,-7],[7,-26],[-5,-32],[-18,-63],[1,-3]],[[2356,5177],[13,22],[10,-6],[27,11],[10,-10],[15,-19],[4,-10],[10,-35],[7,-17],[7,-10],[9,-6],[13,-2],[9,9],[-8,42],[5,19],[6,1],[4,-6],[3,-8],[2,-5],[6,-2],[18,2],[12,5],[-2,13],[-9,14],[-10,10],[-21,9],[-10,8],[-1,14],[11,14],[12,-4],[21,-24],[8,-5],[8,-1],[7,8],[3,20],[-2,8],[-11,17],[-2,10],[3,12],[6,0],[7,-8],[3,-13],[2,-21],[5,-14],[8,1],[8,21],[1,13],[-4,19],[3,10],[5,8],[6,2],[6,-4],[6,-6],[-4,-25],[3,-25],[8,-19],[10,-8],[14,4],[8,11],[6,14],[8,15],[11,8],[12,-1],[21,-7],[7,-13],[4,-5],[2,2],[2,5],[4,2],[6,-1],[12,-6],[24,-4],[5,2],[4,6],[6,17],[3,4],[19,0],[6,-3],[12,-12],[7,-3],[6,1],[6,2],[4,5],[3,10],[1,17],[-4,5],[-5,1],[-5,6],[-1,16],[11,4],[22,-7],[6,-6],[4,-8],[5,-5],[8,1],[5,8],[8,21],[6,6]],[[2905,5318],[22,-11],[16,-23],[11,-31],[8,-38],[12,-81],[5,-12],[0,-1]],[[2979,5121],[-13,-26],[-33,-43],[-9,-7],[-8,5],[-16,22],[-10,4],[-21,-16],[-30,-56],[-3,-6],[-21,-17],[-18,2],[-59,34],[-12,11],[-6,2],[-6,-3],[0,-9],[1,-10],[0,-9],[1,-5],[1,-7],[1,-6],[-3,-3],[-7,2],[-6,-1],[-4,4],[-4,1],[-5,-9],[-21,-5],[-19,17],[-18,24],[-18,12],[-7,-3],[-1,-8],[-2,-9],[-5,-8],[-4,1],[-9,5],[-3,0],[-6,-13],[1,-11],[3,-15],[3,-24],[0,-24],[-2,-16],[-6,-8],[-11,-2],[-11,7],[-7,14],[-5,15],[-8,13],[-11,6],[-3,-10],[-3,-16],[-18,-18],[-6,-15],[-4,-19],[0,-11],[-17,-12],[-70,-24],[-9,-3],[-27,-2],[-9,-4],[-18,-13],[-10,-5],[-10,2],[-5,3],[-4,-42],[1,-28],[-6,-40],[-9,-39],[-8,-26],[-7,-12],[-15,-19],[-6,-13],[-13,-43],[-5,-12],[-26,-19],[-13,0],[-41,-1],[-35,-16],[-26,4],[-10,-3],[-17,-11],[-29,-5],[-36,-23],[-272,-45],[-24,-25],[-54,-135],[-23,-34],[0,-1],[-35,-23],[-42,-11],[-7,-2]],[[1551,4172],[0,1],[0,15],[0,6],[2,28],[1,4],[26,89],[2,10],[0,5],[0,5],[-1,5],[0,5],[-1,4],[-5,15],[-1,9],[-1,5],[0,26],[0,5],[-1,4],[-1,4],[-1,4],[-9,15],[-1,4],[-1,4],[-5,20],[-1,9],[-1,21],[-2,23],[0,5],[1,4],[1,12],[2,9],[25,72],[3,10],[2,22],[0,4],[3,7],[4,6],[9,11],[6,3],[10,5],[3,1],[2,3],[28,51],[6,7],[5,4],[3,0],[3,2],[2,3],[1,5],[-1,5],[-2,8],[-1,4],[-1,5],[0,5],[0,10],[0,5],[1,5],[1,5],[2,5],[4,6],[8,10],[8,7],[7,3],[4,6],[54,104],[42,50],[21,14],[22,11],[26,4],[11,-1],[6,-2],[12,-7],[5,-5],[5,-3],[3,-1],[3,0],[3,2],[3,4],[3,7],[2,10],[3,33],[3,111],[0,14],[-15,60],[-6,36],[-1,14],[0,6],[1,6],[3,10],[2,6],[6,10],[6,9],[21,25]],[[1943,5379],[7,-8],[13,-6],[24,-3],[4,-7],[5,-30],[6,-7],[6,4],[3,9],[1,11],[4,11],[15,16],[8,-11],[7,-20],[9,-11],[12,-22],[2,-8],[0,-11],[0,-4],[27,-16],[9,-1],[9,2],[9,10],[7,25],[7,9],[14,-10],[5,0],[3,7],[2,20],[3,7],[8,6],[6,-7],[2,-17],[-1,-24],[0,8],[-5,-41],[0,-14],[7,-18],[8,-13],[11,-8],[10,1],[7,16],[-9,20],[-4,13],[-2,14],[0,18],[1,6],[16,-2],[7,-16],[-1,-36],[3,-35],[17,-17],[33,10],[9,-1],[7,-4],[14,-13],[18,-11],[16,-1],[14,8]],[[1428,6397],[45,-103],[9,-25],[9,-41],[3,-8],[4,-13],[0,-6],[-1,-4],[-3,-8],[-1,-4],[-1,-5],[0,-5],[1,-5],[1,-4],[1,-4],[2,-9],[2,-23],[1,-15],[1,-5],[1,-4],[3,-4],[11,-7],[1,0],[2,-5],[2,-9],[2,-12],[2,-9],[0,-5],[0,-5],[0,-5],[0,-6],[-1,-5],[-1,-4],[-1,-4],[-2,-3],[-8,-11],[-2,-3],[-2,-3],[0,-5],[0,-4],[0,-4],[4,-17],[1,-4],[0,-5],[-1,-6],[-1,-10],[0,-6],[0,-5],[1,-4],[1,-5],[1,-3],[2,-4],[3,-2],[5,-1],[3,2],[3,2],[2,3],[4,5],[3,2],[2,1],[3,-1],[11,-7],[17,-5],[3,-3],[2,-5],[3,-9],[1,-6],[1,-7],[0,-10],[0,-5],[1,-4],[1,-4],[2,-4],[0,-4],[0,-4],[0,-5],[-2,-3],[-2,-3],[-2,-3],[-2,-2],[-3,0],[-3,0],[-6,3],[-16,12],[-7,2],[-3,0],[-3,-1],[-3,-1],[-1,-4],[-1,-4],[-1,-5],[1,-4],[0,-4],[2,-4],[0,-1],[6,-7],[18,-11],[5,-5],[3,-9],[1,-7],[1,-8],[2,-11],[8,-20],[8,-9],[10,-1],[23,7],[9,-3],[29,-26],[5,-9],[0,-12],[-4,-21],[1,-13],[3,-12],[13,-31],[7,-10],[5,8],[2,16],[1,14],[2,10],[3,9],[5,9],[12,15],[7,3],[8,-1],[0,-9],[-6,-15],[-5,-32],[-2,-34],[1,-22],[14,22],[13,-1],[30,-21],[-12,-17],[-31,-13],[-6,-21],[7,-33],[14,8],[28,42],[9,2],[4,-4],[2,1],[1,18],[-1,16],[-2,11],[3,6],[11,2],[7,-3],[7,-5],[7,-4],[9,3],[2,6],[-1,9],[0,8],[5,3],[3,-1],[9,-7],[5,-1],[-5,-18],[-3,-8],[-4,-8],[6,-13],[12,-14],[13,-11],[9,-5],[15,-3],[9,-7],[17,-24],[15,-13],[3,-4],[6,-19],[0,-8],[-4,-3],[-2,-9],[0,-11],[-1,-3],[2,-2],[5,-10],[4,-14],[-2,-10],[-3,-7],[-1,-7]],[[1551,4172],[-18,-5],[-10,11],[-13,31],[-19,51],[-7,14],[-8,11],[-45,27],[-19,18],[-9,17],[-3,16],[0,16],[-4,20],[-9,16],[-14,17],[-21,20]],[[1352,4452],[1,15],[6,44],[3,14],[28,65],[1,6],[0,5],[-19,40],[-38,57],[-3,9],[-2,6],[-3,11],[-1,8],[0,7],[0,5],[1,5],[1,4],[2,8],[3,8],[4,9],[1,9],[0,5],[-1,4],[-11,28],[-11,31],[-1,4],[-3,5],[-36,50],[-11,13],[-5,8],[-5,10],[-4,4],[-4,2],[-14,1],[-2,1],[-2,3],[0,7],[-1,9],[-2,15],[-2,7],[-2,5],[-7,8],[-4,6],[-2,2],[-2,1],[-2,-1],[-2,-3],[-3,-13],[-1,-4],[-3,-7],[-4,-6],[-4,-5],[-3,-2],[-5,-3],[-12,-3],[-15,0],[-17,5],[-4,3],[-4,5],[-7,10],[-3,8],[-2,6],[-1,4],[-4,38],[-1,15],[0,11],[4,31],[1,5],[0,5],[1,5],[0,5],[-1,9],[-2,9],[0,5],[-1,8],[1,8],[1,11],[0,6],[0,9],[-2,5],[-3,3],[-3,0],[-3,0],[-2,-2],[-27,-27],[-11,-7],[-25,-6],[-11,-12],[-9,-15],[-2,-3],[-5,-4],[-5,-3],[-4,0],[-4,1],[-6,4],[-3,4],[-2,4],[-1,5],[0,5],[1,5],[1,9],[1,5],[1,4],[2,10],[-1,7],[-1,8],[-4,14],[-3,6],[-2,5],[-2,3],[-4,5],[-3,2],[-2,2],[-7,1],[-5,3],[-5,4],[-31,38],[-3,7],[-2,5],[-1,5],[0,5],[0,6],[1,11],[0,6],[-1,11],[-2,5],[-3,3],[-6,3],[-7,1],[-7,0],[-6,-2],[-9,-4],[-4,0],[-5,2],[-10,12],[-34,62],[-22,15],[-22,10]],[[777,5436],[23,138],[0,10],[-2,14],[-1,4],[-1,4],[-3,8],[-5,11],[-2,7],[-1,6],[1,5],[2,8],[13,92],[3,10],[9,10],[12,16],[2,3],[10,13],[3,10],[5,15],[14,66],[1,4],[3,5],[3,5],[9,12],[10,8],[6,4],[9,2],[55,-12],[28,2],[4,3],[5,4],[12,15],[4,3],[3,1],[7,-1],[20,-13],[4,1],[7,5],[25,27],[5,2],[4,1],[6,-1],[25,-12],[3,-1],[6,1],[27,17],[6,2],[14,-2],[12,5],[5,3],[24,21],[22,12],[6,2],[3,0],[4,0],[3,-1],[2,-2],[4,-1],[6,1],[10,6],[6,6],[3,5],[2,4],[1,4],[0,5],[0,5],[-1,4],[-10,20],[-5,9],[-6,-5],[-11,1],[-13,6],[-3,6],[-2,30],[0,5],[1,5],[2,5],[2,7],[2,6],[0,5],[-1,4],[-1,3],[-2,3],[-5,4],[-3,1],[-3,0],[-3,-3],[-11,-15],[-3,-2],[-2,-2],[-3,-1],[-3,0],[-2,2],[-2,4],[-2,3],[-1,5],[0,6],[1,8],[2,4],[2,4],[11,6],[6,1],[13,1],[7,2],[7,5],[3,6],[6,12],[18,27],[2,6],[1,4],[0,5],[-2,4],[-1,2],[-18,16],[-2,3],[1,8],[3,12],[17,40],[3,9],[1,6],[0,5],[0,4],[-1,5],[-2,8],[-4,11],[-1,4],[1,7],[2,8],[5,14],[3,7],[3,4],[3,2],[3,0],[20,-7],[6,0],[42,17],[7,-1],[6,-2],[6,-4],[5,-4],[12,-16],[3,-4],[2,-2],[2,-2],[3,0],[5,2],[3,-1],[2,-2],[5,-4],[3,-2],[3,-1],[8,1]],[[2806,7711],[8,-6],[3,-5],[8,-15],[8,-8],[3,-5],[3,-12],[2,-7],[3,-6],[5,-4],[4,-3],[11,-4],[3,-2],[2,-2],[-1,-4],[-1,-3],[-2,-3],[-13,-10],[-4,-5],[-4,-6],[-2,-3],[-2,-4],[-1,-4],[-1,-4],[-11,-58],[-1,-5],[0,-5],[2,-5],[2,-4],[5,-5],[4,-2],[16,-4],[5,-4],[2,-4],[1,-5],[3,-14],[2,-6],[3,-5],[6,-8],[23,-20],[19,-21],[5,-4],[1,-3],[1,-4],[-1,-5],[-4,-7],[0,-4],[1,-4],[2,-2],[3,-2],[6,3],[3,-2],[3,-3],[3,-10],[3,-6],[5,-4],[11,-5],[3,-2],[2,-3],[2,-4],[1,-5],[1,-16],[1,-5],[3,-3],[3,-1],[25,-4],[3,1],[2,2],[2,4],[1,4],[3,13],[2,4],[2,3],[2,3],[2,9],[2,3],[2,3],[3,0],[4,0],[3,-4],[2,-5],[1,-12],[0,-7],[-2,-30],[0,-5],[1,-5],[2,-6],[4,-8],[9,-14],[6,-14],[1,-5],[1,-5],[0,-10],[-1,-5],[-3,-4],[-5,-4],[-2,-2],[-1,-4],[0,-5],[1,-5],[7,-9],[2,-3],[1,-4],[-1,-6],[-7,-13],[-3,-9],[-2,-8],[-1,-4],[-1,-4],[0,-3],[1,-5],[2,-4],[4,-5],[11,-7],[2,-2],[2,-4],[2,-6],[0,-11],[0,-15],[-1,-5],[-1,-4],[-2,-3],[-9,-3],[-3,-2],[-2,-2],[-2,-3],[-3,-7],[-2,-3],[-3,-2],[-2,-2],[-3,-1],[-4,0],[-27,6],[-3,-1],[1,-4],[1,-7],[16,-42],[2,-8],[1,-4],[0,-4],[-1,-4],[-1,-2],[-3,-1],[-10,-2],[-3,-1],[-2,-3],[-1,-5],[-1,-28],[2,-5],[3,-5],[21,-11],[3,-3],[2,-4],[2,-6],[0,-4],[0,-5],[-1,-5],[-1,-4],[0,-4],[1,-5],[3,-7],[15,-28],[6,-14],[2,-9],[1,-9],[1,-4],[1,-3],[2,-4],[3,-6],[115,-49]],[[3181,6733],[-10,-18],[-7,-4],[-11,0],[-2,-2],[-1,-2],[2,-3],[11,-10],[1,-4],[0,-5],[-4,-8],[-4,-8],[-5,-6],[-2,-2],[-3,-1],[-3,0],[-14,4],[-3,0],[-2,-3],[-2,-3],[-5,-16],[-1,-5],[0,-5],[1,-7],[1,-4],[3,-3],[14,-10],[5,-5],[4,-5],[4,-6],[2,-7],[1,-4],[1,-5],[0,-4],[-1,-8],[-2,-9],[-17,-50],[-5,-10],[-2,-4],[0,-4],[1,-5],[2,-4],[6,-9],[2,-4],[0,-5],[-1,-7],[-6,-11],[-3,-4],[-4,0],[-5,4],[-3,1],[-3,0],[-3,-1],[-2,-1],[-2,-6],[-2,-9],[-1,-18],[2,-9],[1,-6],[16,-17],[2,-3],[1,-3],[0,-4],[-3,-4],[-7,-7],[-2,-3],[-1,-5],[-1,-6],[1,-8],[2,-5],[2,-3],[3,-2],[3,-2],[4,-1],[34,0],[2,-2],[2,-4],[1,-3],[2,-8],[4,-17],[0,-4],[-1,-4],[-3,-3],[-17,-10],[-1,-1],[-1,-3],[-1,-5],[1,-8],[2,-5],[2,-7],[1,-5],[1,-14],[1,-4],[1,-4],[2,-2],[3,-2],[9,-4],[2,-2],[2,-3],[1,-4],[0,-5],[0,-6],[-1,-7],[0,-5],[0,-5],[2,-9],[2,-3],[7,-13],[2,-7],[1,-4],[0,-5],[-2,-6],[-4,-9],[-3,-7],[-2,-7],[-1,-10],[0,-6],[1,-5],[1,-4],[2,-4],[6,-13],[1,-3],[2,-4],[0,-5],[1,-4],[1,-10],[-1,-10],[0,-5],[1,-5],[1,-8],[2,-8],[1,-5],[-1,-4],[-2,-5],[-6,-5],[-4,-1],[-18,-2],[-13,-9],[-4,-6],[-11,-20],[-3,-4],[-3,-1],[-3,-1],[-6,2],[-6,3],[-5,5],[-11,13],[-6,3],[-11,3],[-3,1],[-5,5],[-9,10],[-8,6],[-14,4],[-4,-3],[-4,-7],[-11,-32],[-2,-3],[-2,-2],[-3,0],[-24,5],[-14,0],[-3,-4],[-3,-7],[-4,-16],[-3,-8],[-2,-7],[0,-6],[0,-9],[-1,-6],[-4,-6],[-9,-6],[-2,-3],[-1,-3],[-1,-5],[-3,-13],[-1,-6],[-1,-4],[-2,-3],[-2,-3],[-5,-5],[-5,-8],[-2,-3],[-2,-1],[-2,-4],[-2,-6],[-2,-16],[-3,-5],[-1,-5],[0,-7],[1,-11],[2,-6],[2,-5],[3,-7],[1,-3],[1,-5],[-1,-5],[-3,-6],[-3,-4],[-5,-4],[-2,-4],[-1,-4],[0,-7],[2,-8],[1,-5],[5,-16],[4,-20],[3,-18],[1,-9],[1,-67],[3,-18],[4,-16],[2,-8],[2,-3],[1,-4],[1,-3],[0,-5],[-3,-5],[-4,-1],[-6,1],[-2,-2],[-2,-4],[1,-12],[1,-13],[1,-6],[1,-6],[-2,-29],[-3,-31],[-13,-68]],[[2356,5177],[-8,29],[-5,17],[-2,10],[1,5],[3,2],[2,1],[3,2],[1,5],[-1,3],[-8,7],[-5,8],[-3,3],[-11,9],[-3,4],[-5,6],[-1,6],[0,5],[1,4],[5,11],[0,3],[1,4],[0,6],[-1,8],[-1,2],[-2,-2],[-3,-6],[-3,-2],[-3,1],[-5,5],[-1,5],[0,5],[1,6],[0,6],[-2,3],[-3,2],[-3,0],[-4,2],[-5,4],[-7,9],[-2,6],[-1,7],[0,5],[1,5],[3,14],[0,5],[1,5],[-1,25],[0,4],[1,5],[3,9],[0,7],[-1,6],[-2,5],[-7,12],[-2,5],[0,5],[1,4],[3,7],[1,4],[1,8],[1,4],[2,2],[7,1],[2,2],[2,5],[-1,3],[-2,3],[-12,7],[-2,3],[-2,2],[-7,18],[-2,7],[0,5],[2,40],[2,16],[1,7],[-1,4],[-3,2],[-2,0],[-6,-3],[-4,1],[-1,3],[0,4],[1,5],[1,4],[1,4],[1,5],[1,7],[0,12],[-1,6],[-1,5],[-5,11],[0,5],[1,3],[5,5],[2,2],[1,7],[-1,7],[-3,10],[0,6],[2,2],[7,3],[3,8],[1,2],[-2,7],[-6,16],[-3,13],[-1,8],[0,7],[1,4],[1,3],[4,7],[6,8],[2,4],[2,6],[1,9],[0,6],[0,6],[-1,3],[-8,28],[-2,7],[0,6],[1,11],[1,5],[3,14],[1,6],[-1,5],[-1,4],[-6,10],[-2,5],[-3,9],[0,7],[0,6],[3,20],[1,13],[0,9],[0,7],[1,4],[2,4],[2,3],[2,2],[5,4],[8,5],[2,4],[1,6],[0,12],[0,8],[1,6],[3,10],[2,9],[0,6],[-1,4],[-6,14],[-2,4],[-2,6],[-2,9],[0,6],[0,7],[3,15],[0,6],[-1,7],[-4,24],[0,11],[0,14],[-1,7],[-1,5],[-2,3],[-14,15],[-2,5],[-2,6],[-5,33],[-5,23],[-10,31],[-3,14],[-1,8],[0,6],[1,3],[0,4],[8,28],[1,2],[1,3],[2,3],[2,3],[15,11],[2,3],[2,4],[1,4],[2,15],[2,33],[2,10],[1,4],[1,4],[1,4],[2,3],[7,8],[2,4],[2,6],[2,11],[0,7],[-1,6],[-1,3],[-2,3],[-16,18],[-2,4],[-2,5],[-3,9],[-1,7],[0,6],[1,5],[3,8],[1,3],[2,4],[6,8],[2,7],[1,11],[1,25],[0,12],[0,8],[-1,4],[-3,8],[-1,3],[-2,3],[-13,16],[-2,4],[-2,6],[-2,10],[-1,6],[1,6],[1,6],[1,8],[1,15],[0,8],[0,6],[-1,4],[-2,4],[-1,3],[-2,3],[-8,7],[-3,5],[-3,9],[-1,6],[1,5],[3,16],[2,8],[0,6],[-1,5],[-2,13],[-5,20],[-1,5],[1,4],[1,4],[1,3],[2,4],[2,2],[5,5],[31,15],[2,4],[2,6],[1,11],[-2,5],[-3,2],[-7,2],[-4,1],[-3,4],[-3,5],[-1,5],[1,4],[2,2],[10,8],[3,3],[1,4],[2,5],[2,15],[-1,5],[-2,4],[-7,7],[-2,4],[-2,4],[-1,5],[0,5],[1,3],[3,2],[20,2],[6,3],[3,3],[2,4],[2,10],[1,7],[-1,5],[-2,3],[-1,3],[-5,6],[-5,4],[-19,9],[-3,2],[-1,3],[0,2],[2,3],[12,8]],[[1794,7050],[0,-9],[1,-6],[1,-2],[1,-4],[3,-6],[2,-3],[12,-12],[2,-3],[2,-3],[2,-8],[1,-4],[7,-13],[1,-3],[1,-4],[1,-5],[0,-4],[-1,-5],[-2,-4],[-6,-2],[-8,-1],[-3,-2],[-3,-5],[-2,-10],[-1,-6],[1,-5],[2,-8],[1,-4],[1,-4],[0,-5],[0,-5],[-1,-4],[-1,-4],[-1,-4],[-4,-4],[-4,-5],[-10,-7],[-5,-3],[-9,-1],[-3,-1],[-10,-10],[-4,-3],[-12,-4],[-20,-16],[-3,-2],[-40,-11],[-6,-4],[-6,-2],[-26,-5],[-3,-2],[-3,-4],[-2,-9],[-3,-22],[-1,-5],[1,-5],[0,-4],[4,-12],[9,-20],[2,-5],[1,-3],[0,-5],[0,-5],[0,-5],[-1,-4],[-2,-5],[-4,-5],[-12,-11],[-4,-2],[-5,-1],[-6,1],[-3,1],[-2,3],[-2,4],[-1,3],[-3,0],[-3,-3],[-3,-5],[-12,-35],[-2,-9],[-1,-4],[-4,-13],[-15,-43],[-3,-4],[-96,-80],[-6,-2],[-4,0],[-3,1],[-8,1],[-3,-4],[-2,-6],[-3,-41],[-2,-15],[-7,-24]],[[777,5436],[-14,8],[-5,1],[-30,-5],[-11,1],[-16,5],[-6,3],[-4,4],[-2,3],[-1,4],[-1,3],[-1,6],[1,6],[-1,6],[-2,6],[-5,8],[-4,1],[-2,0],[-2,-3],[-9,-18],[-2,-3],[-5,-2],[-3,-1],[-1,2],[-1,2],[0,2],[-1,4],[0,5],[-1,14],[0,4],[-2,6],[-2,1],[-2,-1],[-5,-8],[-5,-2],[-8,-1],[-26,3],[-5,3],[-5,5],[-4,5],[-3,6],[-11,29],[-13,49],[-4,10],[-6,9],[-4,3],[-4,2],[-15,-4],[-23,-11],[-5,-4],[-4,-1],[-5,-1],[-8,1],[-5,2],[-3,2],[-2,3],[-3,7],[-1,4],[0,5],[-2,6],[-4,7],[-19,25],[-14,24],[-3,7],[-2,8],[-1,14],[-1,5],[1,10],[0,5],[2,10],[5,16],[-1,10],[-10,18],[-10,9]],[[406,5798],[-1,3],[-9,23],[-2,12],[1,17],[5,24],[0,11],[-7,13],[-25,20],[-10,11],[-16,32],[-18,19],[2,1],[-8,9],[-8,-13],[-2,-3],[-4,7],[3,15],[9,27],[8,44],[9,38],[3,19],[-8,114],[-2,20],[-4,10],[-12,18],[-7,17],[-1,7],[-2,14],[-4,54],[-4,18],[-10,45],[14,48],[42,83],[9,40],[4,11],[6,8],[12,3],[6,4],[10,14],[34,90],[5,10],[5,5],[10,5],[5,7],[2,9],[5,25],[3,11],[23,34],[60,129],[22,35],[21,24],[16,37],[127,200],[25,28],[30,34],[1,0],[16,18],[43,69],[8,16],[0,2],[7,33],[6,19],[8,10],[9,7],[20,9],[100,2],[29,17],[12,42],[3,13],[1,16],[-1,24],[2,15],[35,27],[11,16],[7,15],[0,3],[-2,3],[-4,17],[-6,59],[13,32],[0,1]],[[1096,7823],[4,9],[6,5],[7,3],[7,0],[7,-5],[3,-23],[6,-6],[7,-4],[5,-10],[4,-11],[5,-10],[6,-5],[10,-4],[6,-8],[0,9],[10,3],[5,5],[7,2],[13,2],[3,2],[2,3],[2,3],[3,7],[2,3],[2,3],[2,1],[2,0],[3,0],[5,-4],[6,-7],[10,-15],[3,-8],[1,-7],[-1,-4],[0,-4],[2,-4],[16,-23],[3,-2],[3,-2],[6,1],[10,5],[3,0],[6,-2],[3,-1],[2,-3],[17,-27],[3,-8],[1,-4],[0,-4],[0,-5],[0,-5],[-1,-4],[-2,-4],[-2,-3],[-4,-6],[-5,-4],[-27,-10],[-3,-2],[-2,-2],[-2,-3],[-1,-4],[1,-4],[1,-4],[2,-3],[23,-27],[3,-5],[1,-4],[0,-4],[0,-5],[-1,-9],[0,-5],[0,-4],[3,-4],[3,-2],[8,1],[4,2],[3,3],[2,4],[1,4],[0,5],[0,10],[0,5],[1,4],[2,2],[3,0],[4,-2],[3,-6],[2,-5],[2,-8],[3,-3],[4,-2],[18,-2],[4,0],[2,-3],[2,-5],[1,-6],[0,-4],[0,-5],[4,-6],[23,-20],[6,-8],[3,-7],[-1,-10],[1,-5],[1,-4],[2,-3],[2,-2],[6,-2],[27,-4],[9,1],[5,2],[5,5],[5,3],[6,3],[12,4],[35,-9],[7,2],[4,4],[-1,14],[0,5],[2,3],[5,-2],[7,-5],[16,-16],[12,-8],[16,5],[3,0],[3,-1],[2,-2],[3,-3],[3,-4],[2,-4],[1,-5],[1,-14],[-1,-35]],[[1352,4452],[-5,4],[-11,4],[-31,-1],[-32,12],[-10,-1],[-13,-10],[-22,-29],[-27,-1],[-37,-29],[-12,1],[-33,19],[-1,-1],[-10,3],[-20,29],[-11,8],[-27,12],[-9,10],[-18,1],[-56,-35],[-12,0],[-3,19],[-29,41],[-9,6],[-39,-3],[-13,3],[-23,12],[-35,6],[-11,5],[-20,-5],[-7,-3],[-6,-8],[-2,-8],[-3,-7],[-3,-6],[-2,-2],[-2,-3],[-11,-1],[-36,27],[-1,1],[-1,0],[-1,0],[-1,-1],[-4,-2],[-4,-1],[-4,1],[-4,3],[-13,22],[-26,34],[-23,41],[-10,11],[-38,20],[-13,3],[-11,-8],[-11,-26],[-13,-58],[-7,-22],[-24,-28],[-9,-2],[-9,4],[-8,8],[-9,9],[-10,7],[-8,-1],[-5,-15],[5,-25],[-5,-17],[-10,-10],[-11,-6],[-20,26],[-5,15],[10,18],[1,19],[3,12],[2,13],[-4,23],[-5,18],[-8,14],[-16,23],[-20,17],[-2,6],[-9,9],[-10,-4],[-9,-9],[-10,-6],[-40,0],[-7,-6],[-2,1],[-3,5],[-9,29],[-8,40],[-7,26],[-42,82],[-2,1],[-2,1],[-3,0],[-10,-8],[-9,-2],[-9,3],[-10,7],[-3,0],[-2,0],[-2,-2],[-5,-5],[-4,-2],[-4,2],[-4,5],[-27,64],[-6,25],[0,17],[1,15],[0,12],[-4,11],[-4,1],[-15,-2],[0,20],[8,38],[-20,15],[-19,4],[-18,-11],[-5,-9],[-1,0],[-1,-1],[-13,4],[1,90],[6,20],[2,20],[-7,51],[1,25],[9,20],[36,44],[3,9],[6,20],[4,9],[7,7],[15,7],[7,7],[8,17],[7,24],[4,26],[-1,27],[2,17],[4,8],[5,6],[5,11],[4,14],[1,8],[-1,43],[-1,10],[0,10],[4,15],[1,2],[4,9],[14,17],[5,11],[1,8],[0,16],[0,6],[7,23],[12,52],[10,11],[21,5],[9,11],[0,21],[2,29],[4,29],[5,20],[11,17],[11,-5],[21,-34],[14,-14],[12,-2],[12,1],[20,-2],[12,6],[6,-1],[6,-8],[10,-21],[6,-3],[10,-8],[12,-16],[12,-8],[6,20],[-1,4]],[[1096,7823],[-14,48],[-5,27],[4,28],[-15,5],[-15,14],[-8,19],[7,22],[0,8],[-15,2],[-14,9],[-8,16],[-1,24],[7,22],[13,13],[15,3],[15,-12],[11,8],[18,0],[17,5],[7,22],[-7,15],[-46,37],[-38,49],[-8,20],[-3,16],[-1,12],[-1,10],[-6,13],[-7,7],[-7,4],[-4,5],[2,10],[0,8],[-6,52],[-5,17],[-15,32],[-8,25],[2,11],[9,7],[-6,15],[-26,38],[-29,26],[-12,21],[-31,95],[-9,9],[-11,0],[-9,7],[-3,26],[3,17],[7,19],[10,14],[10,6],[-3,17],[1,13],[4,8],[6,5],[-5,15],[-22,47],[-1,7],[9,25],[-8,8],[-10,5],[-9,9],[-4,17],[-1,8],[5,-5],[5,3],[3,19],[-2,12],[-15,61],[-3,10],[1,10],[6,16],[6,8],[7,6],[54,20],[13,-1],[39,-16],[14,-2],[22,-13],[15,-26],[16,-21],[22,5],[83,105],[63,60],[16,31],[13,82],[8,24],[21,42],[12,18],[11,6],[139,15],[34,-11],[11,-1],[156,35],[50,37],[25,11],[25,1],[94,-35],[108,-3]],[[5512,7332],[5,-1],[6,0],[3,-1],[2,-4],[4,-8],[3,-13],[7,-15],[3,-3],[1,-5],[2,-5],[1,-9],[2,-6],[4,-7],[4,-2],[11,-4],[6,-3],[2,-2],[1,-2],[10,-21],[4,-3],[3,0],[5,4],[4,5],[4,5],[3,3],[2,1],[2,0],[3,-1],[4,-5],[1,-4],[1,-7],[0,-15],[-1,-6],[-2,-4],[-19,-10],[-2,-2],[1,-8],[11,-57],[2,-5],[4,-5],[4,-3],[13,-7],[3,-1],[3,0],[8,4],[3,0],[3,-2],[25,-72],[4,-9],[2,-2],[13,-12],[2,-4],[2,-6],[0,-11],[0,-8],[-1,-7],[-4,-26],[-1,-5],[1,-7],[1,-22],[-1,-7],[-2,-5],[-2,-2],[-2,-1],[-3,1],[-5,3],[-3,0],[-2,-1],[-2,-2],[-2,-4],[-1,-4],[1,-9],[4,-13],[20,-52],[10,-19],[2,-2],[3,-2],[2,-1],[3,1],[5,4],[3,1],[2,0],[3,-1],[2,-3],[8,-12],[4,-8],[2,-6],[2,-2],[1,-3],[3,0],[2,1],[5,4],[2,1],[3,-2],[18,-21],[2,-4],[1,-7],[1,-14],[0,-8],[-1,-32],[1,-5],[1,-6],[4,-5],[3,-3],[60,-34],[3,-6],[2,-8],[1,-36],[2,-6],[2,-9],[3,-5],[2,-4],[15,-15],[1,-4],[2,-5],[4,-23],[1,-6],[-1,-8],[-1,-14],[-1,-7],[-2,-5],[-2,-3],[-12,-11],[-2,-2],[-2,-3],[-2,-4],[-22,-54],[0,-6],[2,-8],[4,-13],[6,-13],[4,-5],[21,-43],[3,-7],[23,-90],[1,-10],[1,-22],[-2,-58]],[[5911,6110],[-7,-36],[-1,-4],[-12,-53],[-1,-4],[1,-4],[3,-7],[7,-8],[1,-3],[2,-3],[2,-3],[1,-4],[4,-15],[4,-30],[1,-14],[0,-33],[1,-9],[0,-3],[1,-3],[2,-10],[1,-5],[10,-39],[1,-3],[2,-3],[10,-3],[3,-2],[1,-4],[0,-5],[-1,-5],[-2,-6],[-3,-6],[-25,-31],[-4,-6],[-3,-6],[-3,-4],[-4,-2],[-9,1],[-8,4],[-2,3],[-3,2],[-2,3],[-14,15],[-6,4],[-4,0],[-3,-1],[-4,-6],[-2,-4],[-1,-6],[-2,-4],[-3,-8],[-5,-10],[-10,-13],[-3,-2],[-4,-1],[-8,1],[-4,2],[-3,2],[-7,8],[-5,5],[-3,0],[-3,-1],[-4,-6],[-1,-5],[-1,-5],[1,-5],[-1,-5],[0,-4],[-2,-4],[-4,-3],[-8,0],[-4,2],[-2,3],[-1,4],[0,4],[-1,24],[-3,13],[-2,7],[-1,3],[-21,43],[-4,11],[-1,4],[0,5],[0,29],[0,5],[-1,4],[-2,2],[-3,-1],[-5,-6],[-8,-10],[-2,-2],[-4,-2],[-7,1],[-9,2],[-6,3],[-3,3],[-1,3],[-1,4],[0,5],[-1,4],[-2,3],[-5,5],[-2,3],[0,4],[1,10],[-1,5],[-1,3],[-2,3],[-3,0],[-3,-2],[-8,-10],[-6,-3],[-7,-9],[-1,-5],[-1,-4],[1,-4],[0,-4],[1,-5],[0,-3],[-2,-3],[-3,-1],[-8,3],[-6,3],[-4,1],[-3,-1],[-4,-5],[-2,-5],[-9,-24],[-5,-12],[-7,-19],[-2,-4],[-2,-3],[-20,-18],[-4,-6],[-2,-5],[-3,-8],[0,-5],[1,-3],[1,-3],[2,-3],[2,-3],[1,-4],[0,-5],[-1,-5],[0,-6],[-4,-20],[-1,-5],[-3,-4],[-5,-2],[-9,-1],[-5,1],[-3,3],[-1,5],[-1,3],[-4,0],[-15,-4],[-4,1],[-1,2],[0,4],[-1,3],[-3,2],[-2,3],[-3,0],[-3,-2],[-10,-15],[-3,-3],[-25,-13],[-8,-7],[-4,-6],[-3,-9],[-4,-6],[-6,-10],[-4,-7],[-3,-5],[-5,-3],[-6,3],[-4,5],[-2,6],[-3,21],[-1,7],[-2,7],[-2,5],[-2,5],[-3,4],[-17,18],[-43,23],[-5,1],[-19,1],[-3,-1],[-4,-4],[-4,-11],[-2,-8],[-3,-6],[-5,-3],[-33,1],[-17,9],[-5,1],[-5,-3],[-5,-8],[-2,-9],[-1,-8],[0,-17],[2,-23],[0,-24],[-1,-8],[-2,-14],[-3,-7],[-3,-5],[-14,-19],[-6,-9],[-1,-6],[-2,-7],[-1,-7],[-2,-14],[-4,-19],[-4,-6],[-8,-7],[-17,-7],[-12,-9],[-12,-6],[-7,1],[-4,-2],[-6,-9],[-2,-2],[-3,2],[-2,4],[-3,11],[-2,3],[-1,2],[-2,2],[-9,5],[-7,2],[-9,-2],[-3,1],[-13,6],[-7,2],[-19,-2],[-5,-2],[-26,-24],[-9,-4],[-23,0],[-4,-1],[-4,0],[-3,1],[-3,2],[-6,8],[-10,9],[-17,7],[-13,2],[-9,5],[-7,2],[-28,-3],[-6,3],[-5,0],[-20,-7],[-6,-1],[-5,1],[-2,3],[-2,7],[-3,2],[-5,0],[-7,-1],[-4,1],[-4,2],[-2,2],[-3,2],[-4,0],[-8,0],[-6,2],[-5,0],[-6,-2],[-18,-16],[-17,-24],[-13,-14],[-5,-9],[-1,-7],[3,-7],[0,-4],[1,-4],[0,-4],[-1,-3],[-5,-35],[-1,-5],[-4,-7],[-21,-27],[-5,-10],[-2,-7],[1,-3],[3,-2],[11,-8],[3,-2],[1,-3],[1,-4],[0,-25],[0,-10],[-2,-10],[-3,-5],[-6,-3],[-41,-7],[-3,1],[-2,2],[-1,3],[-1,4],[-3,7],[-2,3],[-3,2],[-10,2],[-13,-1],[-3,-2],[-4,-4],[-4,-8],[-1,-7],[-1,-6],[-1,-10],[0,-5],[-2,-5],[-1,-5],[-72,-56],[-3,-8],[-1,-2],[-3,-1],[-4,0],[-8,3],[-4,3],[-3,4],[-1,4],[-2,3],[-2,2],[-3,2],[-5,-1],[-6,-4],[-15,-19],[-14,-23],[-7,-3],[-18,2]],[[4406,5100],[-8,13],[-5,6],[-3,2],[-3,2],[-3,0],[-3,0],[-5,-3],[-27,-17],[-4,-1],[-3,0],[-2,3],[0,5],[0,8],[1,5],[1,3],[10,13],[2,3],[3,8],[2,6],[1,8],[1,3],[1,1],[2,0],[1,0],[2,2],[4,5],[2,6],[1,3],[1,4],[0,5],[1,5],[0,5],[-4,17],[-8,25],[-10,19],[-6,14],[-4,15],[-2,7],[-1,10],[0,36],[0,4],[-2,5],[-4,3],[-24,15],[-18,19],[-4,6],[-3,6],[-1,6],[-1,6],[1,12],[1,6],[3,4],[9,8],[2,3],[2,3],[0,4],[-3,5],[-2,2],[-3,2],[-4,4],[-3,5],[-5,10],[-4,3],[-3,2],[-15,-2],[-20,4],[-2,2],[-3,11],[-10,77],[-3,11],[-2,2],[-14,6],[-2,2],[-2,3],[-1,5],[-2,6],[-1,10],[0,6],[2,6],[2,3],[6,7],[2,5],[0,6],[-2,10],[-2,6],[-1,4],[-4,6],[-2,3],[-3,2],[-3,2],[-9,0],[-2,1],[-2,2],[-4,6],[-2,3],[-11,8],[-1,4],[-1,3],[2,5],[2,3],[2,5],[4,18],[3,5],[3,3],[3,0],[2,3],[1,5],[-1,14],[-1,3],[0,1],[-2,5],[-2,3],[-2,3],[-3,2],[-3,1],[-17,1],[-3,1],[-5,5],[-2,3],[-2,3],[-1,5],[-1,5],[0,9],[1,8],[2,8],[6,14],[3,3],[2,2],[19,17],[10,6],[2,5],[1,6],[-1,12],[0,8],[0,6],[3,6],[3,4],[11,7],[1,5],[1,5],[-2,13],[-1,7],[-1,7],[0,5],[2,7],[4,8],[0,6],[-1,6],[-3,8],[-3,4],[-3,4],[-8,6],[-3,2],[0,9],[13,22]],[[4196,6066],[21,-9],[3,-4],[2,-4],[-1,-3],[-2,-2],[-2,-2],[-3,-3],[-1,-4],[1,-9],[2,-7],[4,-6],[11,-13],[10,-5],[32,5],[14,-1],[4,3],[2,4],[-1,13],[0,5],[0,4],[2,4],[2,3],[8,12],[3,6],[5,11],[1,6],[3,13],[2,4],[1,3],[7,6],[12,13],[6,2],[18,1],[6,1],[3,3],[6,13],[5,8],[3,2],[4,-1],[4,-1],[17,-2],[3,-2],[5,-4],[3,-2],[5,-1],[2,2],[1,4],[-1,4],[-1,4],[-4,10],[-1,3],[-1,2],[1,4],[2,5],[3,5],[8,6],[4,7],[6,11],[3,1],[3,0],[12,-7],[2,-3],[0,-3],[0,-4],[-7,-15],[-2,-9],[-1,-4],[0,-5],[1,-4],[2,-2],[2,-3],[98,-30],[2,-2],[2,-2],[1,-3],[0,-5],[-1,-5],[1,-5],[2,-5],[6,-4],[5,-1],[3,3],[1,5],[11,68],[3,14],[1,4],[0,5],[0,10],[0,10],[2,10],[1,6],[3,4],[6,6],[4,2],[4,0],[3,-1],[3,-2],[2,-3],[4,-5],[2,-3],[3,-7],[1,-4],[2,-4],[3,-3],[2,-1],[2,1],[18,9],[3,3],[6,8],[3,1],[2,-1],[16,-14],[3,1],[2,2],[3,8],[7,21],[2,5],[3,0],[2,-1],[4,-6],[4,-2],[7,-1],[8,4],[5,0],[3,0],[3,-3],[1,-3],[11,-28],[2,-4],[3,-3],[3,-1],[3,1],[10,9],[18,8],[2,3],[6,10],[3,4],[5,5],[4,-1],[8,-6],[6,1],[3,2],[6,9],[5,5],[4,1],[3,-2],[1,-4],[1,-4],[2,-4],[4,-3],[7,-2],[4,5],[3,6],[0,5],[-1,15],[1,5],[0,5],[1,4],[14,36],[2,4],[3,6],[10,11],[3,4],[5,11],[5,9],[14,19],[3,7],[4,5],[23,24],[2,3],[2,4],[2,6],[9,33],[3,7],[5,7],[18,18],[3,4],[0,3],[1,5],[1,15],[-1,5],[0,4],[-1,4],[-1,4],[-3,2],[-6,3],[-3,2],[-2,3],[-1,4],[0,4],[1,15],[1,5],[2,4],[7,9],[2,5],[7,28],[5,16],[1,5],[1,5],[0,4],[-1,4],[-3,8],[0,4],[1,4],[1,5],[8,19],[1,4],[5,45],[0,5],[-1,4],[-2,3],[-2,3],[-2,3],[-1,3],[-1,4],[1,5],[1,4],[0,2],[7,19],[0,4],[1,5],[-2,3],[-2,3],[-5,5],[-1,3],[-1,3],[0,4],[1,4],[6,9],[2,4],[5,16],[4,8],[3,4],[3,2],[20,4],[43,43],[5,3],[7,1],[20,0],[6,2],[10,5],[4,1],[3,0],[3,-1],[2,-3],[1,-3],[1,-4],[1,-4],[0,-5],[1,-4],[1,-3],[2,-4],[2,-3],[2,-2],[2,-3],[1,-4],[1,-4],[0,-10],[1,-4],[1,-3],[4,-7],[3,-6],[2,-4],[3,-2],[2,1],[1,2],[1,4],[1,11],[2,6],[3,7],[3,2],[2,0],[3,-2],[2,-3],[3,-3],[4,-1],[7,0],[4,2],[3,3],[2,3],[1,4],[1,5],[2,11],[0,8],[1,4],[2,6],[2,2],[3,0],[3,-1],[2,-3],[1,-5],[0,-4],[-1,-26],[1,-4],[1,-3],[3,-3],[52,-14],[3,1],[2,1],[3,7],[5,17],[6,14],[10,15],[1,3],[1,5],[1,4],[-1,14],[1,4],[1,4],[14,27],[6,17],[2,9],[1,10],[1,11],[-1,9],[0,9],[-1,4],[-1,4],[1,4],[2,6],[2,3],[3,2],[21,9],[5,4],[3,4],[1,4],[0,5],[-1,8],[-4,16],[-1,9],[-1,9],[-1,10],[0,4],[-1,5],[-4,15],[0,5],[2,6],[5,7],[17,19],[4,6],[2,8],[3,12],[3,7],[2,1],[5,-3],[4,-1],[7,1],[4,2],[3,3],[12,18],[3,7],[3,7],[1,5],[1,4],[0,5],[-1,4],[-2,4],[-3,7],[-2,3],[-3,6],[-1,2],[0,3],[-1,4],[0,4],[1,5],[0,5],[2,7],[3,6],[6,11],[3,4],[2,3],[6,3],[3,0],[7,-1],[3,-1],[6,-5],[5,-5],[7,-4]],[[6538,5614],[-14,-32],[-4,-16],[0,-5],[-1,-5],[-3,-6],[-5,-6],[-4,-10],[-3,-6],[-5,-4],[-4,-12],[-4,-20],[-1,-4],[-2,-4],[-2,-3],[-4,-1],[-2,2],[-2,2],[-1,12],[-3,9],[0,4],[0,5],[0,5],[0,4],[-1,4],[-3,0],[-2,-5],[-4,-10],[-3,-5],[-3,-2],[-2,3],[-1,5],[2,16],[0,4],[-1,4],[-3,2],[-3,1],[-4,1],[-3,-1],[-2,-2],[-2,-3],[-11,-21],[-4,-3],[-3,-1],[-3,0],[-3,2],[-2,3],[-1,4],[-1,9],[-1,4],[-1,3],[-2,3],[-4,2],[-3,1],[-3,0],[-4,-2],[-22,-27],[-3,-1],[-4,1],[-2,2],[-1,4],[-2,3],[-1,3],[-3,1],[-3,0],[-3,-4],[-4,-6],[-8,-19],[0,-7],[0,-5],[2,-8],[1,-4],[2,-3],[2,-3],[5,-4],[2,-3],[1,-4],[1,-3],[3,-13],[2,-3],[2,-2],[3,-2],[31,-8],[2,-2],[13,-13],[2,-2],[4,-1],[32,-3],[3,-2],[1,-3],[1,-4],[0,-5],[1,-4],[2,-3],[3,-2],[21,-8],[3,-2],[1,-3],[-1,-5],[-3,-6],[-8,-8],[-4,-3],[-4,-2],[-3,0],[-3,-1],[-4,-4],[-20,-31],[-4,-5],[-59,-42],[-2,-2],[-1,-1],[-2,-3],[-15,-24],[-4,-3],[-3,1],[-1,6],[-1,2],[-48,-29],[-16,-15],[-2,-4],[-2,-6],[0,-10],[0,-6],[1,-5],[0,-3],[1,-2],[1,0],[1,-1],[5,-1],[2,-1],[0,-3],[-1,-10],[0,-4],[2,-9],[12,-41],[0,-4],[-2,-5],[-3,-5],[-2,-5],[-1,-7],[1,-11],[1,-3],[2,-3],[3,-1],[2,-3],[1,-3],[0,-5],[0,-5],[0,-4],[4,-26],[1,-66],[1,-10],[0,-1],[1,-2],[1,-3],[2,-2],[7,-4],[2,-2],[1,-4],[1,-4],[0,-5],[-6,-59],[-1,-5],[-3,-5],[-7,-3],[-4,-1],[-4,0],[-3,-1],[-3,-4],[-6,-18],[-2,-3],[-22,-32],[-5,-9],[-3,-4],[-3,-2],[-7,-2],[-4,0],[-2,1],[-2,3],[-2,2],[-2,3],[-1,4],[-2,3],[-2,2],[-3,0],[-2,-3],[-2,-8],[-3,-8],[-23,-38],[-1,-4],[-5,-18],[-4,-20],[-2,-3],[-2,-2],[-4,2],[-2,3],[-1,4],[-1,13],[0,5],[0,4],[1,5],[1,3],[1,4],[1,3],[0,3],[-4,34],[-1,4],[-2,3],[-2,0],[-2,-1],[-2,-4],[-3,-22],[-3,-15],[-1,-11],[0,-9],[1,-9],[0,-10],[0,-10],[-1,-5],[-2,-10],[-2,-4],[-4,-4],[-13,-5],[-21,2],[-4,-2],[-5,-4],[-8,-9],[-4,-7],[-5,-8],[-5,-15],[-3,-8],[-7,-7],[-4,-1],[-4,-5],[-2,-4],[-7,-32],[-6,-42]],[[4526,4700],[-116,10],[-20,14],[-11,25],[-8,31],[-9,27],[-7,-4],[-2,-1],[-7,-7],[-5,-3],[-3,1],[-3,3],[-7,11],[-4,1],[-2,-1],[-2,-2],[-3,-8],[-13,-35],[-3,-4],[-3,-3],[-3,0],[-2,2],[-2,3],[-7,12],[-2,3],[-2,5],[-10,11],[-3,2],[-3,1],[-2,-1],[-9,-5],[-14,-4]],[[4239,4784],[-1,10],[1,5],[2,5],[3,7],[1,5],[1,5],[-1,4],[-1,3],[0,4],[0,4],[1,7],[0,1],[0,1],[-1,3],[-3,2],[-2,2],[-14,5],[-3,2],[-2,2],[-1,3],[0,4],[0,4],[2,4],[10,23],[4,9],[4,19],[1,5],[1,11],[0,10],[0,5],[-1,4],[0,3],[0,3],[1,4],[2,5],[3,5],[18,26],[12,23],[3,7],[6,14],[4,7],[10,13],[3,1],[5,0],[8,-2],[3,-5],[0,-5],[0,-5],[0,-5],[0,-4],[1,-4],[3,-7],[1,-4],[4,-21],[1,-4],[1,-4],[1,-3],[5,2],[6,8],[12,24],[7,20],[3,4],[3,3],[19,4],[7,8],[14,27]],[[5911,6110],[138,-100],[58,-65],[4,-6],[3,-6],[10,-24],[2,-8],[1,-4],[1,-3],[6,-15],[3,-4],[4,-4],[52,-8],[2,-2],[2,-11],[2,-4],[5,-3],[13,-6],[3,-6],[0,-4],[0,-4],[-2,-3],[-3,-1],[-8,-3],[-2,-2],[-1,-4],[1,-8],[0,-5],[0,-5],[-2,-4],[-1,-3],[-2,-2],[-5,-5],[-1,-2],[1,-2],[1,-3],[9,-10],[2,-3],[9,-20],[2,-3],[1,-3],[2,-4],[9,-10],[3,-4],[2,-3],[1,-3],[2,-1],[2,-1],[5,4],[2,5],[2,5],[1,4],[6,0],[8,-4],[17,-11],[6,-7],[3,-6],[5,-5],[24,-15],[5,-6],[3,-6],[2,-4],[3,-1],[6,2],[4,3],[2,3],[6,17],[4,1],[5,0],[20,-15],[5,-5],[5,-9],[2,-4],[4,-15],[2,-8],[0,-4],[1,-4],[1,-3],[2,0],[4,5],[2,5],[1,6],[2,21],[2,5],[1,4],[3,3],[6,2],[11,1],[5,3],[3,3],[1,4],[18,5],[16,-24],[9,-4],[19,-1],[10,-3],[9,-7],[4,-7],[11,-25]],[[5550,7472],[-13,-55],[-9,-19],[-2,-3],[-1,-4],[1,-5],[1,-4],[2,-4],[0,-4],[-2,-7],[-1,-4],[-14,-31]],[[4196,6066],[-5,18],[-6,4],[-9,-2],[-7,0],[-4,3],[-2,3],[-1,6],[-4,12],[-10,22],[-7,25],[-3,5],[-2,3],[-3,2],[-15,4],[-6,2],[-8,7],[-3,5],[-2,5],[0,10],[-2,7],[-2,8],[-9,25],[0,3],[0,8],[0,5],[1,1],[0,3],[1,2],[1,3],[2,4],[2,3],[27,26],[2,3],[2,4],[1,5],[0,11],[0,16],[-2,9],[-13,39],[-1,7],[0,5],[0,4],[2,3],[2,2],[4,2],[2,2],[2,3],[1,2],[1,3],[1,16],[0,9],[-1,5],[-2,4],[-22,17],[-4,3],[-3,5],[-4,10],[-2,6],[-2,6],[-1,14],[1,10],[0,6],[1,4],[1,5],[6,16],[1,6],[1,5],[1,9],[-1,5],[-2,4],[-4,5],[-4,3],[-27,6]],[[4057,6597],[2,18],[1,3],[3,4],[9,6],[2,4],[2,6],[1,7],[0,10],[0,6],[-1,6],[-2,2],[-2,1],[-3,0],[-13,-3],[-7,-1],[-7,2],[-1,3],[1,3],[4,7],[3,7],[4,12],[1,7],[2,8],[2,16],[0,9],[0,6],[-3,9],[-2,6],[-1,11],[1,5],[1,4],[5,5],[2,2],[3,0],[7,-1],[3,2],[3,4],[4,9],[3,3],[2,1],[5,-1],[3,0],[3,1],[20,23],[18,12],[4,4],[6,9],[3,3],[8,4],[3,2],[2,2],[2,4],[9,18],[4,12],[3,6],[2,4],[15,11],[4,5],[13,19],[3,9],[1,7],[0,4],[-1,4],[-32,76],[-1,5],[-1,5],[0,8],[2,5],[3,6],[1,4],[1,3],[-8,46],[-1,11],[0,9],[1,5],[2,4],[2,1],[1,1],[18,7],[4,4],[4,5],[4,13],[0,5],[-1,6],[-3,7],[0,17],[0,8],[-2,6],[-2,3],[-8,7],[-2,2],[-2,3],[-1,4],[-2,4],[0,4],[-1,4],[1,16],[0,5],[0,6],[-1,14],[3,49],[0,12],[-2,7],[-7,3],[-3,2],[-2,3],[-1,3],[-5,13],[-7,23],[-1,4],[-2,3],[-2,3],[-4,1],[-3,1],[-7,-1],[-3,3],[-2,7],[-2,20],[-7,26],[-4,34],[-2,6],[-1,3],[-1,4],[-2,3],[-1,4],[-7,13],[-4,5],[-3,2],[-3,2],[-24,-2],[-3,-1],[-21,-13],[-3,-1],[-4,1],[-3,3],[-4,10],[0,5],[2,4],[12,2],[3,1],[3,3],[1,4],[2,5],[0,4],[-2,3],[-9,7],[-2,5],[-1,4],[1,4],[3,2],[2,0],[10,-3],[3,0],[3,2],[2,3],[2,3],[1,5],[5,24],[0,6],[0,4],[0,1],[0,3],[-1,3],[-2,3],[-6,5],[-3,4],[-2,9],[0,6],[2,4],[6,1],[3,2],[2,3],[1,3],[5,24],[3,14],[-1,5],[-1,4],[-10,10],[-2,3],[-3,4],[-2,7],[0,5],[1,5],[5,17],[5,14],[16,34],[5,17],[2,3],[2,3],[17,14],[3,5],[2,5],[4,12],[1,7],[0,6],[-8,43],[-2,17],[-2,9],[-1,4],[-1,3],[-4,6],[-6,3],[-8,2],[-20,-4],[-2,1],[-3,3],[-1,5],[0,5],[11,88],[-1,8],[-1,6],[-1,3],[-14,22],[-31,69],[-1,3],[-3,2],[-3,0],[-3,3],[-3,6],[-3,17],[1,8],[2,4],[17,0],[4,-1],[3,-2],[4,-5],[2,-3],[3,-2],[2,0],[3,8],[0,10],[-2,28],[0,9],[0,8],[1,6],[1,5],[3,8],[7,16],[2,9],[1,5],[-1,6],[0,4],[-2,3],[-1,4],[-4,6],[-2,3],[-6,5],[-13,6],[-3,2],[-2,3],[-1,3],[-2,9],[-1,4],[-1,4],[-1,4],[-3,6],[-18,22],[-10,10],[-6,3],[-2,1],[-3,-2],[-2,-2],[-11,-27],[-2,-3],[-1,-1],[-2,2],[-1,3],[-2,8],[-3,18],[-5,65],[-11,54],[1,5],[2,2],[7,1],[6,2],[11,8],[17,18],[7,10],[7,14],[5,17],[2,9],[1,15],[1,46],[0,10],[-1,3],[0,2],[-2,1],[-2,0],[-4,-5],[-2,-1],[-3,1],[-2,3],[-1,3],[-4,9],[0,2]],[[4005,8757],[15,19],[12,5],[25,-14],[11,0],[8,21],[8,30],[5,15],[8,5],[14,3],[13,7],[9,14],[7,17],[12,14],[11,7],[13,3],[12,-3],[9,-9],[9,-23],[5,-19],[7,-13],[51,-12],[10,3],[5,9],[10,24],[7,7],[5,-1],[9,-8],[7,1],[34,25],[13,5],[77,3],[16,-6],[16,-17],[20,-40],[8,-12],[28,-19],[7,-9],[4,-9],[1,-8],[1,-10],[0,-13],[-1,-10],[-5,-26],[-1,-1],[4,-14],[17,-30],[7,-10],[9,-5],[16,0],[8,-2],[8,-11],[13,-27],[8,-4],[8,2],[8,-3],[7,-7],[6,-9],[4,-12],[6,2],[2,7]],[[4723,7754],[-53,7],[-7,-11],[5,-29],[-14,11],[-11,26],[-15,22],[-8,43],[-14,5],[-2,35],[-55,1],[0,-32],[-35,-6],[11,-30],[-3,-25],[-10,24],[-10,-9],[5,-21],[0,-23],[-10,-13],[-13,-16],[-2,-22],[2,-24],[-3,-24],[-6,-11],[0,-21],[2,-21],[-7,-19],[0,-21],[-3,-32],[6,-16],[5,13],[10,-3],[8,41],[23,-10],[13,9],[9,-7],[7,-50],[14,-25],[18,-22],[13,-34],[-5,-23],[3,-29],[11,-1],[9,3],[4,-29],[2,-23],[9,-7],[2,-21],[10,7],[15,-19],[-6,-55],[14,-1],[3,-60],[15,-8],[7,-38],[3,-59],[34,25],[-5,20],[6,13],[-12,45],[-4,33],[11,2],[8,40],[-10,47],[-16,61],[6,11],[-7,20],[20,11],[3,-19],[12,6],[16,-10],[11,6],[-1,38],[5,21],[16,-25],[21,4],[-1,50],[22,0],[9,26],[-16,17],[-1,22],[-31,69],[-1,46],[6,15],[-10,22],[2,19],[12,29],[16,15],[21,35],[-4,68],[-23,19],[-31,18],[-12,-20],[1,-36],[-12,-15],[-18,-11],[-9,-34]],[[4257,1544],[-42,-29],[27,24],[12,14],[4,12],[3,12],[7,5],[9,2],[7,3],[9,12],[16,28],[10,12],[87,128],[28,24],[-121,-182],[-56,-65]],[[5023,2814],[-1,0],[-15,0],[-29,-14],[-29,-6],[-23,-12],[-12,-3],[-5,-5],[-13,-17],[-5,1],[-6,4],[-8,-4],[-32,-36],[-7,-3],[-24,9],[-5,0],[-7,-9],[-16,-36],[-4,-11],[2,-16],[10,-31],[4,-26],[2,0],[4,-6],[2,-8],[-2,-3],[-2,-3],[-2,-6],[-2,-7],[-5,-38],[-1,-5],[-23,-48],[-9,-13],[-30,4],[-5,-8],[3,-7],[13,-13],[4,-11],[0,-14],[-3,-11],[-16,-50],[-39,-87],[-12,-36],[-7,-17],[-9,-8],[-5,-10],[-11,-49],[-5,-18],[-68,-103],[-61,-128],[-32,-50],[-36,-45],[1,16],[-3,71],[-5,3],[-5,-9],[-4,-12],[-3,-14],[-2,-34],[0,-8],[-3,-8],[0,-7],[-1,-4],[-4,-2],[-1,3],[-4,4],[-3,2],[-2,-5],[-4,-4],[-26,33],[-13,9],[-13,-10],[-4,-25],[-1,-31],[-3,-28],[-6,15],[-6,11],[0,9],[4,13],[-2,7],[-5,-3],[-4,-17],[-1,-21],[3,-17],[4,-13],[5,-9],[-4,-35],[-3,12],[-4,9],[-12,14],[-1,4],[1,6],[-1,5],[-5,2],[-3,-3],[-2,-6],[-1,-6],[-1,-2],[-13,-1],[-15,-4],[-12,-13],[-4,-25],[5,-17],[7,-8],[15,-9],[8,-13],[4,-10],[-3,-4],[-10,-6],[-8,-12],[-10,-7],[-11,8],[-2,-8],[-1,-3],[0,-4],[3,-10],[-9,-7],[-15,-9],[-7,-10],[1,33],[-6,33],[-11,27],[-12,10],[1,9],[-3,60],[3,20],[4,9],[1,8],[-4,14],[-4,7],[-1,2],[-2,2],[-12,16],[-3,5],[-2,11],[-3,-1],[-3,-6],[-1,-10],[2,-9],[8,-16],[2,-6],[-3,-9],[-10,-22],[-3,-15],[-1,-20],[2,-10],[3,-8],[4,-15],[-19,-23],[-4,-49],[2,-60],[-6,-56],[14,-12],[8,-4],[11,-2],[10,4],[8,9],[14,22],[-7,-13],[-18,-46],[-7,-10],[-6,-5],[-4,-12],[-2,-12],[-4,-5],[-8,-5],[0,-11],[9,-29],[4,-10],[6,-6],[7,1],[2,11],[-1,16],[1,12],[9,4],[0,-29],[2,-5],[3,0],[3,5],[0,4],[4,-2],[5,1],[3,-4],[3,-21],[3,19],[3,21],[4,9],[9,-15],[4,-20],[0,-25],[-4,-17],[-11,2],[8,-14],[4,-23],[2,-27],[2,-54],[-1,-11],[-2,-10],[-5,-18],[-1,-10],[-6,-30],[-1,-13],[0,-11],[1,-2],[-1,-1],[-11,-17],[-9,-8],[-10,-4],[-8,3],[2,9],[2,9],[-1,10],[-3,7],[7,36],[-3,49],[-9,43],[-13,18],[-6,6],[-26,37],[-77,45],[-43,6],[-5,3],[-6,5],[-6,2],[-5,-5],[-4,-7],[-4,-6],[-5,-6],[-5,-3],[-11,0],[-9,3],[-9,-1],[-12,-10],[-9,-12],[-4,-9],[-2,-9],[-3,-3],[-14,-2],[-4,-3],[-8,-13],[-10,-7],[-22,-11],[-29,-37],[-7,-6],[-13,-1],[-5,-2],[-4,-5],[-3,-11],[-2,-24],[-2,-8],[-13,-8],[-11,11],[-9,15],[-7,8],[-13,4],[-14,16],[-9,5],[-15,-6],[0,-18],[1,-19],[-16,-12],[-1,-10],[1,-11],[3,-10],[4,-5],[16,-12],[-7,-11],[-7,-5],[-17,-1],[-21,-4],[-74,26],[-46,39],[-49,20],[-19,18],[-10,4],[-12,13],[-11,31],[-17,68],[3,25],[-11,23],[-16,15],[-12,-2],[-2,-1],[-7,15],[1,9],[4,15],[5,15],[29,36],[40,-5],[42,-18],[35,-2],[12,9],[2,14],[-3,43],[-1,2],[0,3],[3,9],[0,2],[4,5],[14,11],[-7,16],[-3,18],[-1,17],[-3,18],[-7,11],[-9,8],[-5,9],[4,15],[13,30],[6,11],[10,10],[16,8],[3,10],[-2,13],[-2,10],[9,24],[37,5],[15,14],[2,12],[-1,13],[-1,11],[0,7],[4,6],[16,6],[11,9],[7,11],[4,16],[0,26],[-2,21],[-8,43],[1,21],[6,18],[10,10],[96,40],[14,10],[1,25],[-10,55],[-1,30],[4,20],[19,34],[13,34],[7,29],[-3,27],[-15,21],[-18,28],[-10,20],[0,17],[4,18],[3,22],[-1,20],[-9,59],[-5,46],[4,35],[11,28],[41,43],[20,12],[11,6],[48,43],[12,0],[9,-18],[4,-26],[0,-106],[-1,-15],[-3,-12],[-5,-12],[-4,-12],[0,-13],[9,-12],[13,11],[20,35],[7,4],[3,-2],[3,2],[4,16],[0,11],[-2,26],[1,15],[10,25],[8,-4],[13,-43],[10,-23],[7,1],[24,57],[10,18],[11,10],[1,0],[13,-3],[3,-8],[1,-8],[-1,-9],[-3,-8],[-3,-10],[-1,-10],[1,-9],[3,-9],[8,-6],[18,-5],[7,-4],[8,-11],[8,-28],[7,-16],[9,-8],[10,-2],[9,6],[7,12],[4,20],[-3,31],[4,8],[16,0],[11,7],[6,18],[0,35],[7,-19],[29,-43],[12,-29],[3,-10],[1,-12],[-1,-24],[1,-8],[11,-20],[11,3],[21,28],[10,9],[9,3],[65,-6],[25,7],[14,22],[14,39],[-8,7],[-9,3],[-8,-3],[-6,-7],[-9,17],[-25,32],[4,11],[-7,22],[-4,7],[-4,6],[-3,0],[-7,-7],[-4,-2],[-2,3],[-2,12],[-1,3],[-25,16],[-8,15],[-1,28],[9,1],[12,4],[7,27],[-1,12],[-7,26],[-2,13],[0,16],[2,12],[3,11],[2,15],[4,78],[0,23],[-3,9],[-6,18],[-2,9],[-1,12],[0,27],[-1,8],[-6,5],[-5,-3],[-6,-6],[-4,1],[-3,7],[-5,23],[-2,8],[-16,21],[-16,3],[-16,-3],[-18,5],[-10,11],[-13,33],[-9,14],[-8,5],[-18,2],[-9,5],[-5,7],[-9,15],[-5,4],[-14,-2],[-3,2],[-5,13],[1,17],[0,3],[2,16],[5,47],[6,14],[6,12],[5,17],[-1,19],[-4,17],[-6,13],[-8,8],[-10,-2],[-7,-14],[-4,-16],[-6,-8],[-5,8],[-17,49],[-1,4],[-1,4],[1,4],[1,3],[15,3],[12,5],[8,15],[3,31],[-5,65],[2,28],[14,11],[6,21],[-1,29],[-5,29],[-7,22],[-9,13],[-11,6],[-11,1],[-11,-2],[-6,-20],[-2,-19],[-4,-17],[-10,-15],[-9,-4],[-9,2],[-8,6],[-8,10],[-5,14],[-2,5],[-2,18],[0,18],[-3,20],[-7,16],[-9,6],[-8,3],[-8,7],[-5,13],[-2,15],[-4,13],[-17,18],[-10,26],[-8,7],[-9,-7],[-5,-13],[-6,-8],[-10,12],[-5,14],[-8,37],[-2,5],[-3,11],[0,1],[-1,0],[-7,50],[7,33],[15,29],[14,38],[6,47],[-1,44],[3,39],[17,33],[6,16],[-2,13],[-7,10],[-19,11],[-5,8],[0,14],[5,22],[6,14],[11,16],[8,18],[2,17],[-6,6],[-21,10],[-8,10],[-5,18],[-5,43],[-4,19],[-6,16],[-7,10],[-8,5],[-10,0],[-17,-13],[-24,-48],[-21,-6],[-16,10],[-8,10],[-12,13],[-18,30],[-11,30]],[[3733,4531],[9,12],[47,32],[12,12],[6,14],[8,12],[4,6],[9,8],[7,7],[1,3],[1,5],[0,4],[0,5],[-4,31],[-1,9],[1,4],[1,3],[2,3],[16,10],[5,1],[4,1],[6,-3],[3,-3],[2,-4],[2,-3],[10,-14],[8,-6],[2,-3],[5,-10],[4,-5],[29,-17],[11,-8],[3,-1],[51,2],[53,34],[9,0],[2,-2],[2,-4],[22,-20],[7,-3],[42,-4],[31,5],[5,3],[3,1],[3,-1],[5,-4],[2,0],[3,3],[9,41],[1,8],[0,6],[-1,4],[-2,3],[-11,22],[-3,8],[-1,4],[1,5],[2,5],[7,6],[5,-1],[3,-2],[6,1],[5,1],[32,27]],[[3733,4531],[-4,9],[-9,13],[-4,8],[-1,8],[-2,32],[-8,33],[-2,8],[0,9],[-2,9],[-3,10],[-16,16],[-20,5],[-38,1],[-51,32],[-18,1],[-13,-8],[-10,-46],[0,-5],[-4,-21],[0,-21],[-2,-12],[-6,-1],[-11,12],[-6,11],[-16,49],[9,16],[1,19],[-6,17],[-8,9],[-13,-3],[-7,-15],[-6,-19],[-9,-15],[-11,-3],[-7,11],[-1,17],[4,17],[9,16],[8,8],[6,11],[4,26],[-1,24],[-6,10],[-10,2],[-25,-5],[-10,-9],[-8,-12],[-12,-10],[-13,-4],[-10,4],[-6,14],[-2,24],[-4,21],[-9,-2],[-17,-22],[-9,-4],[-12,1],[-8,10],[11,49],[-3,22],[-9,16],[-12,9],[-29,5],[-20,4],[-22,13],[-13,29],[-4,6],[-6,14],[-12,25],[-8,14],[-36,40],[-18,13],[-69,-1],[-12,8],[-1,33],[-12,2],[-14,-14],[-7,-3],[-23,0]],[[3181,6733],[49,9],[38,-8],[19,3],[47,19],[53,2],[6,3],[10,8],[4,-1],[6,-1],[26,-18],[5,-1],[6,0],[12,2],[9,5],[1,1],[3,6],[11,26],[1,4],[6,1],[49,-1],[6,-1],[14,-12],[3,-5],[2,-3],[2,-3],[2,-1],[12,3],[8,5],[10,8],[3,2],[2,0],[42,-10],[6,1],[1,1],[2,2],[1,3],[2,4],[4,18],[7,19],[2,4],[2,3],[7,7],[13,8],[5,4],[4,5],[2,4],[1,4],[3,9],[1,10],[3,3],[4,1],[35,-7],[3,-1],[3,-3],[1,-5],[-1,-5],[-1,-4],[1,-6],[3,-7],[9,-13],[3,-7],[2,-5],[-2,-6],[0,-5],[0,-4],[0,-5],[1,-4],[1,-4],[0,-5],[0,-10],[0,-5],[1,-3],[0,-3],[9,-29],[5,-10],[2,-3],[1,-3],[16,-17],[2,-5],[-1,-4],[-26,-50],[-3,-7],[-1,-5],[-1,-4],[0,-3],[0,-3],[3,-3],[10,-11],[3,-6],[1,-6],[1,-4],[0,-4],[1,-4],[8,-18],[1,-3],[0,-4],[-2,-4],[-1,-4],[-5,-9],[-2,-3],[-1,-4],[1,-4],[1,-3],[3,-3],[3,-4],[5,-3],[12,-4],[21,3],[40,-10],[59,6],[11,-2],[3,0],[2,2],[1,6],[1,11],[0,5],[1,5],[4,5],[7,3],[24,4],[9,-1],[5,3],[6,5],[18,24],[2,4],[1,3],[6,4],[14,0]],[[3069,8899],[3,-7],[7,-11],[9,-10],[8,-5],[9,2],[5,7],[26,50],[3,8],[3,17],[-1,13],[-1,14],[0,16],[3,25],[7,21],[11,14],[13,3],[11,-9],[34,-52],[10,-8],[10,-3],[55,-1],[10,6],[14,17],[18,48],[11,24],[11,15],[13,9],[11,-2],[8,-13],[2,-12],[0,-11],[1,-11],[4,-14],[7,-10],[16,-14],[7,-11],[3,-13],[6,-34],[4,-10],[7,-4],[7,5],[14,20],[28,26],[14,7],[15,0],[50,-14],[14,-9],[5,-17],[2,-25],[8,-70],[4,-18],[5,-13],[9,-6],[8,5],[8,6],[7,-1],[4,-15],[4,-23],[6,-13],[10,16],[2,18],[-1,48],[2,21],[11,34],[15,27],[18,20],[17,13],[17,5],[34,0],[14,8],[11,16],[13,40],[11,15],[11,6],[11,1],[23,-8],[13,-12],[7,-15],[12,-46],[18,-39],[7,-21],[2,-33],[-5,-32],[3,-14],[10,-10],[11,-19],[6,-24],[5,-27],[7,-23],[13,-10],[11,6],[7,8]],[[7521,7464],[-1,-7],[-1,-4],[-1,-6],[-1,-4],[-2,-4],[-2,-3],[-4,-2],[-4,-1],[-9,-1],[-11,2],[-18,8],[-4,-1],[-5,-2],[-9,-6],[-17,-2],[-17,5],[-2,-1],[-1,-2],[0,-5],[2,-3],[4,-8],[1,-3],[-1,-3],[-2,-1],[-5,2],[-38,34],[-6,4],[-3,1],[-3,0],[-4,-1],[-2,-4],[-1,-7],[0,-6],[0,-19],[0,-5],[-1,-5],[-2,-3],[-3,-2],[-4,1],[-4,2],[-13,12],[-3,2],[-4,-1],[-5,-3],[-7,-10],[-1,-6],[0,-5],[2,-3],[1,-3],[0,-2],[-2,-3],[-2,-2],[-3,-2],[-17,6],[-2,-1],[-3,-3],[-4,-8],[-1,-5],[-1,-5],[1,-4],[2,-8],[0,-4],[0,-5],[-1,-4],[-1,-3],[-5,-3],[-20,-5],[-6,0],[-4,2],[-3,3],[-11,8],[-8,3],[-7,0],[-4,-2],[-4,-4],[-6,-12],[-3,-7],[-2,-7],[-1,-5],[-1,-5],[-2,-3],[-3,-2],[-4,2],[-8,8],[-4,-2],[-4,-5],[-8,-14],[-2,-7],[0,-6],[1,-4],[0,-4],[0,-4],[-1,-5],[-2,-3],[-3,-2],[-5,2],[-6,5],[-7,8],[-4,6],[-2,3],[-1,3],[-3,0],[-2,-3],[-5,-17],[-3,-11],[-3,-6],[-3,-5],[-21,-16]],[[7086,7216],[-52,17],[-15,-3],[-13,-16],[-10,-7],[-3,0],[-4,2],[-9,10],[-3,3],[-4,1],[-4,-4],[-2,-4],[-1,-5],[-2,-11],[-1,-5],[-1,-4],[-2,-4],[-2,-3],[-2,-3],[-2,-2],[-20,-1],[-54,12],[-9,-2],[-10,-5],[-3,-3],[-8,-10],[-2,-1],[-3,1],[-1,6],[0,6],[0,5],[0,5],[-2,6],[-5,8],[-1,7],[0,6],[1,15],[2,5],[2,2],[12,2],[3,2],[2,2],[1,2],[2,2],[1,3],[1,4],[1,5],[0,5],[0,5],[0,5],[-1,4],[-2,7],[-1,3],[-1,2],[-2,2],[-20,21],[-3,7],[-2,6],[0,5],[-2,3],[-5,8],[-2,4],[0,5],[-1,9],[0,4],[-2,4],[-1,3],[-3,3],[-4,1],[-6,-2],[-3,-4],[-2,-4],[-2,-4],[-2,-2],[-3,2],[-5,6],[-2,5],[-1,5],[-1,9],[-2,32],[0,5],[1,5],[2,10],[5,12],[1,5],[0,4],[0,5],[-1,4],[-2,8],[-3,6],[-4,7],[-24,30],[-19,31],[-13,26],[-2,8],[-2,8],[-1,9],[0,62],[2,26],[-1,5],[-1,3],[-2,3],[-19,10],[-3,-1],[-2,-4],[-1,-5],[-3,-5],[-5,-4],[-12,-3],[-5,-4],[-4,-4],[-3,-2],[-12,-4],[-2,-4],[-1,-4],[1,-9],[0,-1],[-1,-4],[-2,-3],[-3,-2],[-11,5],[-5,1],[-4,-3],[-3,-3],[-3,-4],[0,-5],[0,-4],[0,-4],[1,-4],[-1,-5],[-3,-1],[-4,0],[-43,28],[-18,21],[-7,12],[-7,13],[-3,3],[-5,0],[-19,-7],[-28,-19],[-2,-2],[-2,-3],[-1,-4],[0,-3],[1,-1],[0,-1],[17,-15],[2,-4],[1,-4],[-5,-4],[-9,-4],[-23,-2],[-15,-5],[-6,-10],[-4,0],[-5,1],[-42,28],[-170,50],[-3,3],[-15,9],[-5,5],[-3,4],[-2,3],[-2,2],[-6,1],[-8,-1],[-15,-7],[-6,-6],[-3,-5],[-1,-5],[-2,-4],[-1,-4],[-2,-4],[-7,-1],[-53,9],[-20,18]],[[6250,9968],[2,-2],[8,-5],[10,1],[8,7],[8,10],[8,6],[11,-21],[-4,-47],[10,-20],[12,2],[38,52],[48,32],[26,6],[25,-1],[14,-7],[6,-12],[4,-17],[9,-22],[11,-15],[23,-20],[11,-20],[14,-43],[7,-14],[36,-33],[9,-14],[9,-21],[6,-14],[3,-12],[1,-12],[0,-14],[-9,-28],[0,-7],[2,-22],[1,-41],[3,-24],[7,-22],[12,-26],[1,-22],[-4,-18],[0,-11],[28,0],[11,-12],[20,-38],[4,-4],[7,-7],[3,-5],[2,-6],[2,-17],[-1,-3],[7,-4],[10,7],[7,0],[10,-9],[18,-29],[11,-11],[13,-19],[8,-11],[15,-50],[1,-52],[-21,-35],[-11,-3],[-32,0],[-95,-31],[-21,-18],[-5,-30],[6,-12],[19,-8],[8,-7],[3,-9],[2,-26],[2,-12],[4,-9],[24,-38],[7,-18],[5,-21],[1,-28],[-1,-13],[-5,-22],[-2,-12],[1,-13],[2,-11],[1,-11],[-1,-13],[-5,-7],[-12,-3],[-3,-8],[3,-10],[5,-11],[11,-15],[8,-7],[10,-6],[9,-2],[9,0],[11,9],[5,-43],[-14,-42],[-22,-34],[-32,-31],[39,-24],[14,-4],[10,6],[20,25],[20,7],[20,-5],[40,-20],[18,-9],[36,9],[17,-4],[8,-11],[3,-17],[3,-20],[5,-19],[8,-11],[10,-5],[40,-3],[39,12],[45,27],[26,23],[9,1],[10,-7],[11,-10],[11,3],[11,7],[11,3],[11,-6],[7,-12],[4,-18],[14,-115],[11,-41],[16,-23],[19,-2],[37,12],[19,-1],[11,-6],[10,-8],[5,-14],[-5,-21],[-7,-11],[-31,-9],[3,-14],[0,-25],[0,-9],[1,-12],[5,-9],[13,-4],[7,-6],[7,-17],[0,-15],[-1,-15],[1,-19],[3,-16],[12,-22],[5,-16],[1,-17],[-2,-16],[1,-12],[8,-12],[14,-11],[6,-9],[5,-12],[5,-35],[-2,-31],[1,-28],[13,-24],[-43,-27],[-8,-15],[1,-16],[26,-152],[12,-30],[18,-12],[13,-3],[11,-6],[10,-12],[8,-21],[4,-30],[1,-22],[3,-19],[13,-20],[10,-11],[11,-9],[12,-4],[12,-2],[10,5]],[[7128,5987],[19,-5],[8,2],[2,2],[3,0],[4,-1],[5,-7],[4,-3],[5,-1],[13,4],[3,0],[14,-4],[11,0],[3,-1],[9,-7],[16,-17],[5,-6],[2,-6],[2,-8],[1,-4],[2,-4],[36,-43],[3,-7],[2,-6],[2,-5],[16,-15],[2,-4],[10,-20],[8,-12],[32,-27],[9,-11],[11,-18],[4,-3],[4,-1],[7,1],[12,3],[2,0],[29,-7],[3,1],[2,2],[2,2],[3,1],[4,-2],[10,-11],[2,-4],[3,-3],[4,-2],[16,1],[4,-1],[4,-4],[5,-6],[4,-3],[5,0],[3,2],[5,5],[5,0],[23,-10],[11,-8],[6,-6],[6,0],[3,1],[3,2],[2,3],[5,3],[3,0],[6,3],[2,2],[9,10],[9,8],[27,14],[6,6],[5,-2],[7,-7],[16,-21],[5,-11],[2,-8],[-1,-5],[0,-5],[1,-4],[4,-9],[10,-17],[1,-3],[1,-3],[-1,-4],[-1,-4],[-6,-15],[-2,-4],[-2,-3],[-14,-11],[-5,-6],[-2,-3],[-1,-4],[1,-3],[2,-2],[19,2],[3,-2],[4,-3],[9,-12],[4,-4],[15,-7],[5,-4],[2,-7],[-1,-5],[3,-6],[5,-6],[12,-11],[5,-6],[3,-5],[4,-11],[3,-5],[15,-15],[3,-7],[0,-5],[-1,-4],[-1,-2],[-3,-5],[-11,-11],[-2,-3],[-1,-5],[-2,-4],[0,-5],[0,-4],[3,-4],[21,-22],[13,-21],[40,-49],[7,-13],[1,-3],[1,-4],[-1,-4],[-1,-4],[-7,-21],[-2,-4],[0,-4],[0,-5],[2,-3],[9,-11],[9,-14],[2,-4],[0,-3],[-1,-3],[-1,-3],[-15,-26],[-1,-4],[-1,-3],[1,-4],[5,-9],[3,-1],[3,0],[4,6],[6,8],[2,3],[2,1],[3,-2],[3,-2],[4,-6],[3,-3],[4,0],[4,3],[10,10],[1,5],[0,4],[-5,6],[-1,2],[-1,4],[1,4],[9,24],[40,72],[9,10],[3,1],[5,0],[9,-5],[25,-21],[8,-11],[3,-5],[4,-8],[1,-3],[4,-3],[7,-1],[20,2],[5,4],[5,8],[10,10],[32,7]],[[8094,5314],[2,-12],[0,-4],[1,-5],[1,-4],[1,-4],[2,-2],[3,0],[20,5],[2,0],[2,-2],[2,-3],[0,-4],[0,-4],[-3,-4],[-4,-5],[-2,-3],[-6,-17],[-3,-3],[-2,-3],[-3,-4],[-1,-7],[0,-24],[0,-7],[1,-3],[1,-2],[3,-1],[17,3],[3,2],[2,3],[1,4],[2,5],[4,27],[1,6],[2,9],[3,3],[3,2],[24,3],[6,-1],[3,-3],[1,-3],[1,-4],[1,-4],[1,-13],[1,-28],[-1,-4],[-1,-5],[-4,-5],[-6,-5],[-8,-5],[-1,-2],[-1,-5],[1,-12],[1,-4],[0,-2],[1,-3],[0,-4],[-1,-4],[-3,-4],[-5,-4],[-2,-4],[-2,-5],[0,-38],[2,-5],[4,-6],[1,-4],[-3,-5],[-2,-4],[-13,-8],[-2,-4],[-1,-5],[0,-10],[0,-6],[3,-17],[2,-36],[0,-7],[-4,-27],[0,-6],[1,-5],[0,-4],[2,-3],[2,-2],[2,-1],[3,1],[5,3],[5,2],[3,0],[3,0],[2,-2],[2,-4],[0,-3],[1,-4],[1,-4],[2,-1],[13,-3],[3,-2],[1,-3],[1,-4],[1,-14],[1,-8],[1,-8],[2,-9],[5,-48],[0,-4],[0,-4],[0,-4],[2,-13],[0,-5],[-1,-6],[-3,-7],[-8,-12],[-5,-5],[-4,-3],[-5,-2],[-3,-3],[-2,-4],[-1,-8],[0,-6],[0,-5],[4,-35],[1,-8],[6,-23],[1,-8],[2,-18],[0,-5],[-1,-4],[0,-5],[-4,-8],[-5,-9],[-14,-18],[-7,-7],[-5,-3],[-3,2],[-20,15],[-21,9],[-3,2],[-2,3],[-2,3],[-2,12],[-1,3],[-2,3],[-3,3],[-32,15],[-3,1],[-3,-1],[-19,-7],[-10,0],[-2,-1],[-3,-1],[-2,-2],[-3,-3],[-2,-4],[-2,-8],[-1,-11],[-2,-73],[0,-6],[3,-16],[0,-15],[2,-6],[3,-4],[10,-2],[3,-2],[2,-3],[2,-3],[1,-4],[0,-4],[4,-15],[4,-11],[0,-4],[0,-3],[-2,-2],[-6,-2],[-19,0],[-3,-1],[-4,-2],[-4,-5],[-4,-2],[-9,0],[-2,-3],[-2,-4],[-1,-7],[0,-5],[-1,-5],[1,-5],[0,-5],[3,-4],[5,-4],[7,-3],[4,-5],[2,-4],[3,-29]],[[8011,4335],[-102,-23],[-2,2],[-2,2],[-3,7],[-2,3],[-2,2],[-3,1],[-3,1],[-3,-2],[-5,-3],[-6,-7],[-2,-6],[-4,-10],[-4,-3],[-5,-2],[-13,-1],[-6,2],[-4,2],[-6,9],[-2,2],[-3,2],[-13,1],[-3,2],[-2,2],[-1,3],[0,5],[-1,4],[-1,18],[-1,4],[-1,4],[-1,2],[-3,1],[-3,0],[-3,-1],[-4,-3],[-4,-7],[-3,-6],[-3,-9],[-1,-4],[-5,-2],[-25,-4],[-5,1],[-1,3],[-2,3],[-2,3],[-6,3],[-1,3],[0,4],[-1,5],[-1,3],[-5,5],[-2,3],[0,5],[0,4],[1,4],[1,2],[4,-1],[3,-2],[4,-6],[2,-1],[3,1],[3,7],[2,5],[4,22],[4,13],[1,5],[0,4],[0,4],[-2,4],[0,4],[0,4],[0,5],[2,8],[0,3],[0,2],[-2,0],[-15,-2],[-3,2],[-1,2],[-1,2],[-1,3],[-2,3],[-2,1],[-3,1],[-2,2],[-1,4],[1,14],[0,4],[-2,18],[-1,8],[-1,4],[-1,4],[-2,2],[-3,2],[-8,2],[-2,2],[-1,2],[-1,5],[1,4],[2,4],[1,3],[8,13],[2,4],[1,4],[0,5],[0,4],[-1,3],[-3,1],[-4,-1],[-18,-19],[-3,-1],[-3,-1],[-6,0],[-2,3],[-2,4],[1,10],[-1,4],[-3,12],[0,4],[0,5],[0,5],[2,16],[1,5],[-1,4],[-1,4],[-2,3],[-3,2],[-3,1],[-6,0],[-33,-12],[-30,-19],[-7,-1],[-4,1],[-9,20],[-1,3],[-3,3],[-3,2],[-27,8],[-2,2],[-2,3],[-8,13],[-4,10],[-2,3],[-2,3],[-2,2],[-3,2],[-7,1],[-16,-3],[-23,-10],[-5,-4],[-9,-11],[-12,-20],[-6,-5],[-8,-5],[-5,-2],[-4,0],[-2,1],[-8,7],[-87,23],[-36,28],[-12,4],[-5,1],[-30,-8],[-10,-4],[-5,-2],[-4,1],[-15,10],[-6,2],[-10,-1],[-11,-3],[-4,-4],[-5,-4],[-9,-2],[-6,0],[-5,2],[-6,-4],[-9,-7],[-18,-24],[-14,-14],[-32,0],[-3,2],[-2,2],[-1,4],[-1,4],[-1,9],[-1,9],[0,8],[0,7],[0,3],[-2,3],[-2,1],[-3,1],[-3,0],[-3,-3],[-3,-4],[-3,-11],[0,-7],[0,-5],[3,-12],[3,-11],[0,-2],[0,-2],[-1,-5],[-1,-4],[0,-6],[-1,-30],[-2,-4],[-2,-4],[-7,-8],[-3,-4],[-1,-7],[0,-5],[0,-5],[2,-2],[3,-1],[6,-1],[3,0],[2,-3],[1,-3],[0,-3],[0,-7],[0,-4],[1,-4],[1,-4],[1,-4],[2,-3],[2,-3],[5,-4],[21,-8],[2,-3],[2,-3],[1,-3],[2,-8],[0,-5],[0,-5],[-1,-5],[-2,-6],[-2,-5],[-6,-4],[-25,-8],[-3,-3],[-15,-20],[-3,-6],[-2,-9],[-1,-6],[-1,-6],[1,-5],[0,-4],[0,-4],[2,-4],[3,-6],[43,-40],[4,-5],[1,-2],[0,-2],[0,-4],[-1,-5],[-1,-5],[-5,-14],[-2,-8],[-1,-6],[1,-4],[0,-4],[1,-4],[0,-5],[0,-5],[-2,-16],[0,-4],[1,-4],[3,-2],[10,-4],[13,-3],[3,-2],[2,-3],[1,-4],[0,-5],[-6,-58],[-5,-20],[-4,-37],[-4,-21],[-8,-32],[-1,-5],[0,-4],[1,-4],[2,-3],[11,-13],[3,-6],[1,-3],[1,-4],[0,-5],[0,-5],[-3,-26],[-1,-4],[-3,-10],[-3,-6],[-2,-2],[-5,-2],[-37,4],[-57,16],[-47,31],[-28,6],[-6,-2],[-76,-55],[-70,-22],[-65,-34]],[[6695,3877],[-25,-5],[-55,8],[-87,42],[-12,-1],[-71,-28],[-54,-5],[-7,2],[-1,3],[-3,13],[-1,4],[-2,4],[-3,5],[-4,1],[-12,-2],[-4,1],[-2,4],[-1,4],[-2,12],[-2,8],[0,4],[1,4],[1,5],[4,12],[1,3],[0,4],[-1,5],[-2,5],[-4,6],[-4,3],[-3,1],[-33,-11],[-3,-2],[-2,-1],[-1,-3],[-1,-4],[1,-4],[1,-9],[0,-5],[0,-4],[-1,-5],[-2,-3],[-2,-3],[-5,-3],[-59,-18],[-2,-2],[-2,-2],[-2,-3],[-1,-4],[0,-4],[-1,-4],[0,-2],[-2,-1],[-3,-4],[-4,0],[-3,1],[-6,6],[-6,7],[-3,6],[-2,3],[-1,4],[-1,4],[-2,12],[-2,8],[-5,4],[-9,5],[-41,14],[-5,5],[-8,11],[-2,2],[-43,18]],[[6538,5614],[5,-7],[62,-66],[4,-1],[8,2],[4,-1],[3,-3],[7,-9],[3,-4],[9,-6],[29,-7],[17,-14],[18,-32],[7,-2],[16,17],[12,16],[2,4],[1,3],[1,4],[0,4],[-1,3],[-2,3],[-3,2],[-2,3],[-2,3],[-1,4],[0,5],[0,4],[0,5],[2,4],[11,19],[6,5],[3,5],[1,4],[-1,18],[-1,5],[0,4],[-1,4],[-1,4],[-2,3],[-16,23],[-1,4],[-1,4],[0,4],[0,5],[1,16],[0,5],[1,5],[6,17],[8,35],[1,4],[2,5],[4,4],[6,8],[10,5],[7,1],[4,3],[3,4],[0,4],[-1,4],[-2,2],[-6,0],[-3,1],[-1,0],[0,1],[-1,2],[0,4],[1,4],[1,3],[2,4],[14,17],[8,12],[7,16],[1,4],[1,5],[0,5],[-1,8],[0,5],[2,6],[3,1],[3,0],[6,-4],[100,65],[19,4],[45,21],[6,3],[3,4],[6,11],[5,8],[5,5],[4,3],[3,1],[14,-1],[4,2],[5,6],[3,1],[4,0],[15,-9],[2,-3],[2,-3],[-1,-4],[-1,-3],[-4,-5],[-1,-4],[-1,-4],[0,-4],[2,-3],[4,-3],[6,0],[4,2],[3,2],[1,4],[2,5],[1,10],[2,7],[2,6],[4,7],[4,4],[3,1],[4,0],[6,-4],[6,-4],[16,-16]],[[9376,4351],[-88,5],[-26,-16],[-19,-35],[-14,-49],[-10,-57],[-5,-53],[-5,-20],[-12,-2],[-20,12],[-9,-2],[-10,-13],[-21,-35],[-10,-14],[-14,-9],[-116,-25],[-19,-19],[-14,-36],[-11,-44],[-7,-44],[1,-89],[-3,-35],[-13,-39],[-17,-35],[-7,-22],[-1,-20],[7,-13],[10,-2],[21,5],[10,-1],[9,-6],[5,-14],[-1,-25],[-8,-19],[-11,-12],[-13,-9],[-10,-11],[-11,-29],[-4,-37],[3,-40],[8,-34],[0,-1],[-11,-17],[-30,-65],[-19,-14],[12,40],[0,21],[-14,8],[-18,23],[-3,-2],[-3,-4],[-14,-13],[-5,-4],[-22,13],[-14,5],[-6,-5],[-50,12],[-60,-32],[-24,-2],[-71,20],[-19,-11],[-36,-57],[-58,-127],[-14,-44],[-10,-21],[-12,-8],[3,31],[-13,24],[-19,16],[-19,5],[-10,-4],[-26,-30],[-64,-40],[-5,-1]],[[8267,3124],[-15,48],[-1,4],[0,5],[1,6],[1,4],[2,4],[2,3],[16,23],[2,3],[3,4],[3,2],[3,0],[2,-2],[6,-4],[2,-2],[3,0],[2,1],[3,2],[8,10],[1,6],[-1,7],[-12,30],[1,1],[2,7],[4,6],[6,8],[2,4],[0,4],[-1,6],[-4,7],[-3,4],[-8,8],[-9,15],[-2,2],[-2,1],[-2,-2],[-2,-3],[-3,-8],[-1,-3],[-2,-1],[-2,2],[-19,24],[-3,6],[-2,8],[-7,37],[-4,14],[-9,23],[-2,5],[-2,3],[-11,10],[-23,15],[-5,5],[-14,21],[-3,6],[-1,4],[0,4],[2,4],[2,2],[3,1],[30,4],[5,3],[2,2],[1,3],[1,4],[1,5],[-2,31],[-1,9],[-1,7],[-9,27],[-2,10],[-1,13],[2,6],[2,3],[4,4],[3,1],[2,0],[2,-2],[2,-2],[2,-3],[3,-1],[5,0],[3,-1],[2,-3],[2,-3],[2,-2],[6,-3],[11,-3],[12,1],[20,11],[2,2],[2,4],[1,4],[0,5],[0,13],[0,5],[1,5],[1,4],[5,13],[1,4],[2,4],[2,11],[2,9],[2,4],[2,3],[4,4],[2,1],[3,1],[1,0],[3,-1],[3,-2],[2,-2],[2,-3],[4,-6],[1,-4],[3,-7],[1,-3],[1,-4],[1,-2],[2,1],[2,1],[5,4],[2,3],[1,3],[0,5],[0,5],[-1,6],[-1,10],[1,5],[0,5],[1,5],[2,9],[6,17],[0,6],[0,11],[0,4],[1,5],[9,24],[2,4],[0,4],[-1,4],[-4,1],[-10,0],[-23,6],[-3,-1],[-2,-2],[-2,-8],[-1,-4],[-2,-2],[-3,1],[-4,4],[-10,26],[-2,3],[-44,59],[-14,29],[-4,6],[-24,22],[-5,2],[-3,-1],[-15,-17],[-4,-6],[-2,-2],[-6,6],[-9,13],[-22,37],[-9,12],[-7,6],[-17,-11],[-5,-1],[-3,2],[-2,4],[0,8],[0,7],[2,11],[1,5],[-1,5],[-1,3],[-10,3],[-3,2],[-2,5],[-1,6],[-1,11],[2,4],[2,3],[5,2],[5,4],[2,2],[0,3],[-1,3],[-3,3],[-14,5],[-4,5],[-3,7],[-8,31],[-15,52],[-2,8],[-1,18],[-1,9],[-1,4],[-2,2],[-4,0],[-14,-4],[-6,0],[-7,2],[-5,4],[-4,15],[-1,51]],[[8094,5314],[-8,29],[-1,14],[1,35],[0,22],[-1,10],[-9,55],[-1,14],[0,10],[1,6],[2,5],[3,3],[3,1],[6,0],[7,-2],[17,-13],[7,-3],[26,-3],[3,1],[6,8],[6,10],[7,10],[3,2],[5,3],[6,2],[3,0],[7,-2],[53,-41],[1,-2],[2,-2],[2,-3],[3,-2],[6,-1],[3,2],[2,4],[0,5],[0,5],[-1,3],[-3,3],[-12,8],[-2,2],[-1,2],[0,3],[-1,4],[1,4],[1,5],[6,14],[4,5],[3,2],[3,-2],[6,-4],[4,-1],[5,0],[3,2],[2,4],[1,5],[1,6],[1,6],[2,9],[2,5],[3,3],[3,1],[3,0],[3,-1],[3,-2],[2,-2],[5,-10],[1,-4],[2,-3],[3,-2],[3,-2],[3,-1],[4,1],[13,5],[4,3],[2,4],[0,4],[-2,22],[1,5],[1,6],[3,8],[3,3],[4,1],[3,3],[1,4],[3,11],[3,12],[2,4],[21,22],[4,3],[15,0],[7,3],[3,3],[2,5],[0,4],[-1,4],[-1,4],[-3,7],[-1,4],[0,4],[0,5],[1,10],[0,4],[-1,4],[-5,5],[-2,3],[0,4],[0,5],[10,23],[3,5],[3,4],[13,8],[3,4],[2,6],[0,4],[1,7],[1,7],[4,13],[3,6],[3,4],[126,115],[5,7],[1,5],[-1,4],[-7,17],[-2,3],[-2,2],[-3,1],[-12,-1],[-21,4],[-6,3],[-3,2],[-2,2],[-1,3],[17,44],[4,5],[3,2],[53,2],[71,-30],[26,1],[9,3],[3,3],[1,5],[1,6],[1,4],[1,12]],[[8716,6072],[7,-1],[5,-4],[6,-9],[4,-6],[3,-7],[2,-3],[2,-2],[4,-1],[10,-2],[3,-2],[2,-3],[1,-8],[-2,-3],[-3,-2],[-15,-1],[-3,-2],[-1,-3],[-1,-5],[-3,-15],[0,-6],[1,-4],[5,-5],[24,-15],[15,-15],[3,-1],[3,-1],[3,1],[2,3],[15,19],[2,2],[3,1],[22,-1],[3,-1],[2,-3],[0,-6],[-4,-33],[0,-9],[0,-5],[0,-4],[0,-10],[0,-5],[-1,-5],[-2,-4],[-2,-4],[-5,-9],[-2,-4],[1,-10],[3,-15],[16,-58],[0,-3],[0,-1],[0,-2],[-1,-4],[-1,-4],[-2,-2],[-3,-2],[-9,-1],[-2,-1],[-1,-3],[0,-4],[0,-4],[-1,-4],[-3,-1],[-6,0],[-3,-1],[-2,-3],[-2,-3],[-1,-5],[-1,-5],[0,-5],[1,-3],[3,-3],[3,0],[4,-2],[4,-4],[5,-8],[4,-4],[3,-1],[63,-6],[22,-10],[2,-14],[6,-29],[2,-12],[0,-9],[0,-19],[1,-5],[2,-4],[5,-5],[8,-3],[3,-1],[7,-2],[2,-3],[1,-5],[0,-9],[-1,-6],[0,-7],[2,-8],[5,-14],[2,-13],[1,-9],[-1,-6],[-3,-9],[-3,-8],[-7,-15],[-1,-5],[-1,-4],[-1,-5],[0,-4],[0,-7],[1,-3],[1,-3],[2,-1],[11,3],[3,1],[3,-2],[1,-4],[0,-8],[-2,-5],[-1,-5],[-9,-17],[-13,-17],[-3,-6],[-1,-2],[-1,-3],[-1,-5],[-1,-5],[0,-4],[2,-32],[2,-19],[0,-3],[0,-4],[-1,-10],[0,-5],[1,-6],[7,-26],[1,-8],[0,-7],[-1,-5],[-4,-15],[0,-5],[-1,-5],[2,-5],[2,-4],[6,-6],[7,-5],[8,-3],[3,-3],[2,-3],[1,-7],[0,-5],[-1,-10],[-1,-4],[0,-1],[-2,-6],[-1,-10],[-2,-15],[0,-10],[0,-9],[1,-6],[3,-6],[8,-8],[5,-3],[4,-2],[3,0],[3,-1],[7,-7],[3,-1],[3,0],[3,2],[2,3],[3,6],[2,3],[4,-1],[4,-6],[6,-17],[2,-9],[1,-7],[1,-4],[1,-4],[2,-5],[3,-5],[12,-14],[5,-12],[8,-23],[1,-6],[0,-3],[-1,-4],[0,-4],[-2,-4],[-1,-3],[-2,-3],[-3,-2],[-2,-1],[-25,-7],[-2,-1],[-1,-1],[-2,-3],[0,-4],[1,-4],[1,-9],[4,-15],[2,-16],[2,-5],[3,-4],[7,-5],[9,-3],[55,8],[3,-1],[3,-4],[3,-11],[3,-11],[1,-13],[3,-12],[8,-30],[1,-4],[1,-4],[0,-5],[-2,-10],[-1,-10],[0,-5],[1,-5],[3,-5],[12,-11],[70,-40],[32,-28],[2,-5],[2,-6],[1,-11],[-1,-6],[-2,-6],[-5,-11],[-2,-9],[-2,-5],[0,-5],[-1,-5],[3,-8],[5,-9],[14,-19],[7,-6],[5,-4],[40,2],[52,-19],[2,-7],[2,-11],[-2,-42],[0,-11],[3,-9],[2,-5],[3,-3],[5,-6],[0,-9],[1,-8],[-10,-65],[-1,-10],[0,-1]],[[8814,6920],[1,-8],[1,-11],[9,-31],[2,-3],[3,-7],[2,-3],[2,-3],[11,-9],[1,-4],[0,-4],[-3,-4],[-3,-2],[-3,-1],[-12,-1],[-11,-5],[-10,-8],[-3,-4],[-1,-3],[0,-4],[1,-4],[1,-2],[23,-27],[1,-4],[0,-4],[-2,-4],[-3,-3],[-7,-6],[-2,-3],[-2,-3],[-1,-5],[-2,-4],[-1,-6],[-2,-9],[-2,-1],[-2,0],[-13,5],[-3,-1],[-3,-2],[-2,-3],[-3,-7],[-7,-16],[-1,-4],[0,-6],[1,-6],[2,-3],[3,-1],[15,9],[3,1],[3,-1],[2,-2],[2,-3],[1,-2],[1,-4],[1,-2],[0,-3],[-1,-35],[0,-15],[1,-6],[0,-4],[-1,-5],[-1,-6],[-3,-7],[-7,-12],[-1,-6],[-5,-22],[-3,-6],[-3,-4],[-4,-4],[-2,-2],[-1,-2],[-1,-4],[1,-7],[4,-18],[1,-3],[3,-7],[2,-3],[0,-4],[-1,-3],[-3,-3],[-2,-3],[0,-6],[6,-25],[0,-4],[0,-5],[0,-5],[-3,-7],[-3,-4],[-11,-11],[-2,-4],[-2,-4],[-3,-19],[-2,-21],[-3,-12],[-4,-6],[-3,-2],[-8,-3],[-2,-2],[-3,-2],[-6,-16],[-2,-4],[0,-5],[2,-7],[1,-4],[6,-10],[1,-4],[2,-8],[2,-8],[1,-8],[-3,-64],[0,-15],[1,-9],[3,-2],[10,-2],[3,-2],[3,-2],[2,-3],[2,-3],[1,-3],[1,-4],[0,-7],[-2,-9],[-8,-19],[-7,-13],[-15,-15],[-14,-18]],[[7128,5987],[3,8],[0,9],[-1,15],[-2,14],[-3,13],[-2,7],[-11,29],[-1,4],[0,6],[1,6],[2,12],[3,12],[5,11],[29,46],[2,2],[3,2],[3,0],[3,-1],[2,-2],[3,-2],[3,-7],[1,-3],[7,-9],[6,-4],[3,-1],[55,-7],[11,3],[30,22],[9,10],[17,28],[14,35],[14,28],[1,5],[-1,5],[-6,13],[0,5],[2,7],[0,3],[-1,5],[-5,5],[-7,5],[-2,5],[-1,9],[-4,11],[-2,8],[0,8],[1,6],[1,6],[1,4],[2,4],[2,2],[9,3],[5,3],[3,1],[3,0],[32,-12],[3,0],[2,2],[3,8],[2,3],[3,1],[9,1],[3,2],[1,2],[1,3],[0,2],[-2,9],[-6,8],[-12,10],[-9,15],[-11,9],[-2,4],[-1,8],[1,4],[3,1],[26,0],[12,3],[2,2],[3,2],[-2,11],[-4,17],[-25,69],[-2,8],[-2,8],[0,4],[1,4],[1,3],[5,4],[2,2],[0,4],[0,4],[-2,13],[-1,4],[-2,3],[-4,2],[-17,0],[-3,-1],[-2,-3],[-2,-4],[-2,-10],[-1,-4],[-2,-2],[-3,-1],[-7,2],[-28,12],[-3,2],[-2,4],[0,7],[-1,5],[-2,3],[-16,4],[-3,3],[-2,4],[-1,8],[-1,16],[-1,5],[-2,5],[-11,11],[-3,3],[-2,5],[-2,9],[-3,20],[-1,6],[0,18],[2,36],[-1,9],[-1,8],[-2,5],[-2,6],[-10,13],[-3,4],[-3,1],[-4,1],[-3,-1],[-2,-2],[-7,-7],[-3,-1],[-3,0],[-7,1],[-34,25],[-3,5],[-7,14],[-4,5],[-4,3],[-23,-1],[-7,2],[-3,2],[-3,2],[-5,5],[-5,10],[-2,3],[-3,2],[-10,4],[-3,3],[-3,4],[-6,15],[-2,3],[-3,5],[-2,7],[-4,34],[0,4],[-9,35],[1,2],[5,14],[6,11],[24,35],[4,7],[1,11],[2,16],[-1,69],[-5,17]],[[7521,7464],[3,2],[7,13],[6,16],[9,16],[5,3],[11,1],[5,3],[6,9],[11,23],[8,8],[10,5],[52,9],[97,-11],[15,-12],[4,-23],[16,-12],[55,-128],[13,-9],[13,1],[13,8],[12,13],[11,15],[4,3],[7,0],[5,-2],[12,-10],[12,-4],[15,-16],[18,-5],[5,-3],[8,-8],[2,-4],[-2,-5],[-1,-28],[-1,-12],[1,-11],[9,-10],[12,-6],[12,-3],[13,2],[10,10],[5,10],[9,27],[5,11],[7,10],[93,79],[36,19],[36,4],[40,-9],[81,34],[16,19],[33,47],[16,10],[56,11],[11,-8],[8,-33],[8,-41],[9,-33],[49,-34],[17,-27],[1,-53],[-5,-29],[-2,-14],[1,-13],[4,-9],[19,-28],[53,-120],[20,-20],[44,-29],[22,-21],[18,-24],[18,-32],[18,-46],[0,-2],[9,-23],[0,-19],[2,-8],[13,12]],[[8814,6920],[24,23],[7,3],[6,-2],[10,-10],[6,-2],[26,27],[3,55],[-4,58],[6,37],[8,3],[36,-4],[15,4],[11,-3],[7,-13],[17,-72],[7,-15],[11,-7],[24,-4],[10,-5],[13,-13],[20,-11],[40,10],[28,-7],[5,3],[5,5],[13,7],[2,3],[0,-3],[4,-25],[2,-20],[3,-11],[3,-5],[34,-36],[58,-24],[19,-26],[13,-31],[15,-21],[53,4],[9,4],[11,14],[17,38],[10,16],[21,11],[14,-17],[1,-1],[31,-117],[13,-26],[16,-16],[21,-7],[22,7],[21,15],[21,7],[20,-20],[11,-7],[32,-5],[7,-13],[6,-29],[9,-53],[14,-43],[17,-17],[20,-8],[22,-16],[29,-41],[11,-7],[15,-1],[18,5],[16,9],[14,13],[33,49],[13,7],[11,0],[55,-22],[1,-3],[7,-10],[-3,-26],[-8,-17],[-22,-19],[-9,-14],[-11,-40],[3,-40],[12,-37],[22,-51],[26,-45],[6,-20],[-1,-22],[-8,-42],[-1,-45],[-4,-12],[-13,-11],[-11,-13],[-18,-43],[-11,-18],[-33,-34],[-15,-21],[-12,-30],[-2,-18],[-2,-36],[-3,-12],[-6,-7],[-9,-1],[-16,4],[-17,1],[-46,-24],[-28,2],[-9,-10],[-4,-63],[7,-15],[11,-11],[11,-15],[7,-23],[4,-17],[7,-12],[13,-9],[44,-15],[19,5],[7,-2],[5,-8],[11,-20],[7,-4],[12,9],[10,19],[10,15],[15,-2],[10,-21],[0,-24],[-8,-25],[-11,-21],[-24,-29],[-23,-4],[-61,36],[-13,-1],[-12,-9],[-11,-18],[-4,-14],[-4,-14],[-5,-12],[-14,-8],[-4,-10],[-34,-169],[-6,-31],[22,2],[11,6],[66,-12],[14,-13],[11,-22],[4,-32],[1,-10],[1,-7],[2,-5],[0,-4],[-2,-10],[-5,-3],[-6,1],[-2,-1],[1,-20],[6,-10],[6,-7],[17,-57],[6,-32],[4,-17],[5,-11],[-12,-19],[-10,-18],[-38,-48],[39,-37],[11,2],[29,16],[12,-4],[8,-21],[-2,-24],[-7,-23],[-9,-17],[-27,-30],[-10,-19],[-29,-79],[-6,-25],[-1,-29],[8,-39],[-1,-11],[-1,-2],[-4,1],[-30,-8],[-6,-6],[-5,-12],[1,-7],[5,-7],[6,-13],[7,-28],[1,-12],[-1,-20],[-2,-10],[-6,-19],[-1,-11],[0,-9],[3,-17],[0,-8],[-4,-36],[-9,-31],[-14,-21],[-18,-6],[-56,23],[-17,1],[-34,-10],[-16,4],[-13,7],[-24,-10],[-12,-1],[-10,7],[-19,19],[-11,3],[-81,-11],[-22,-9],[-11,-2],[-12,5],[-29,31],[-2,0]],[[8267,3124],[-5,-1],[-6,-6],[-18,-23],[-6,-6],[-19,-11],[-30,-44],[-18,-4],[5,-30],[-7,-28],[-11,-28],[-6,-31],[-4,-34],[-10,-33],[-13,-21],[-15,6],[0,10],[4,0],[12,-8],[10,35],[7,45],[0,22],[-5,5],[-20,37],[-8,8],[-18,10],[-8,9],[-9,-9],[-10,1],[-16,8],[-9,-4],[-6,-9],[-5,-9],[-4,-5],[-36,0],[-23,-21],[-28,-9],[-18,-13],[-16,-20],[-38,-61],[-10,-29],[-4,-36],[-4,0],[0,18],[-2,5],[-5,-5],[-6,-4],[0,-7],[-1,-3],[-3,12],[2,5],[0,8],[0,6],[-6,7],[-1,1],[-5,15],[-3,6],[-4,5],[-11,8],[-10,-1],[-21,-7],[-40,9],[-75,-22],[-14,1],[-41,-37],[-31,-28],[-16,-21],[-45,-81],[-18,-26],[-66,-52],[-10,-12],[-9,-15],[-17,-37],[-8,-13],[-20,-22],[-8,-12],[-53,-137],[-3,-5]],[[7292,2346],[-6,6],[-2,1]],[[7284,2353],[15,41],[20,32],[8,21],[2,31],[-9,-16],[-10,-13],[-11,-1],[-13,18],[-5,28],[3,33],[11,47],[-4,4],[-9,1],[-6,3],[-4,4],[-7,11],[-9,9],[-7,17],[-6,22],[-1,23],[-12,-24],[4,-25],[10,-23],[5,-18],[2,-16],[3,-10],[2,-10],[-3,-19],[-4,-14],[-19,-31],[-33,-79],[-2,-3]],[[7195,2396],[-19,6],[-6,8],[0,22],[0,5],[-3,25],[-1,9],[1,5],[0,5],[4,15],[0,5],[-1,7],[-13,90],[-4,10],[-3,6],[-16,0],[-3,1],[-3,2],[-8,9],[-5,2],[-8,7],[-12,17],[0,1],[-3,0],[-26,-3],[-7,1],[-3,2],[0,1],[0,1],[-1,13],[1,5],[1,4],[1,2],[2,3],[2,4],[1,5],[0,8],[-2,3],[-3,3],[-26,3],[-19,-1],[-5,2],[-3,3],[-1,3],[-2,4],[0,5],[-2,4],[-13,33],[-2,7],[-1,4],[-1,4],[0,5],[0,4],[1,5],[3,7],[6,10],[1,4],[1,4],[1,5],[-1,4],[-1,9],[-2,12],[-3,11],[-3,5],[-3,3],[-13,3],[-4,2],[-4,3],[-10,11],[-3,2],[-2,-2],[-3,-1],[-4,0],[-5,3],[-2,4],[-2,5],[-1,13],[0,5],[1,4],[1,4],[2,3],[2,2],[2,2],[3,1],[15,0],[3,1],[3,2],[1,2],[2,4],[1,4],[4,7],[4,5],[5,4],[2,2],[1,3],[2,4],[3,15],[1,5],[2,4],[3,7],[1,4],[1,4],[1,29],[0,5],[1,4],[2,3],[2,1],[5,3],[15,9],[2,3],[1,6],[0,9],[-2,20],[-2,9],[-2,6],[-2,3],[-3,2],[-3,2],[-6,1],[-3,1],[-5,5],[-2,4],[-1,5],[-6,40],[-2,7],[-2,4],[-2,3],[-27,14],[-5,4],[-7,8],[-2,3],[-3,2],[-13,4],[-4,3],[-2,4],[-1,4],[-1,19],[-2,12],[-1,6],[-2,4],[-2,2],[0,1],[-8,3],[-5,3],[-2,4],[-1,4],[-1,9],[-1,42],[-9,59],[-2,5],[-3,4],[-7,4],[-5,4],[-2,5],[-1,5],[0,8],[-3,17],[0,9],[-1,10],[0,5],[2,26],[0,4],[0,4],[-5,35],[0,4],[0,5],[1,4],[1,4],[3,3],[1,4],[1,5],[0,10],[-1,5],[-1,4],[-8,9],[-4,6],[-1,5],[-1,5],[0,5],[1,10],[0,5],[1,5],[2,4],[2,2],[8,6],[2,2],[2,3],[0,5],[-1,3],[-1,3],[-2,1],[-2,1],[-38,-6],[-5,-3],[-2,-3],[-1,-4],[-1,-5],[0,-5],[-1,-4],[-4,-7],[-1,-4],[-3,-9],[-1,-4],[-3,-1],[-3,-1],[-3,0],[-2,2],[-8,6],[-3,2],[-8,-1],[-2,-2],[-7,-8],[-4,-3],[-3,0],[-4,0],[-3,3],[-2,4],[0,4],[-1,19],[0,5],[-2,5],[-5,21],[-28,141],[-15,59]],[[5828,2102],[80,-17],[38,12],[16,-1],[18,-21],[23,16],[13,2],[6,-13],[5,-9],[26,3],[7,-16],[-10,-16],[-233,60],[4,7],[2,0],[5,-7]],[[7292,2346],[-9,-16],[-30,-91],[-13,-30],[-13,-22],[-23,-12],[-13,-18],[-19,-7],[-13,-16],[-22,-15],[-10,5],[2,12],[18,32],[19,19],[-2,5],[-2,12],[58,28],[28,24],[16,48],[13,23],[6,22],[1,4]],[[5558,2222],[7,-8],[-12,4],[-23,17],[-203,68],[-87,52],[-17,25],[-15,39],[-4,20],[-5,32],[-1,23],[10,-6],[9,-54],[9,-37],[13,-25],[22,-21],[179,-68],[72,-28],[46,-33]],[[7195,2396],[-16,-30],[-25,-24],[-52,-21],[-6,0],[-7,4],[-3,7],[0,10],[-2,5],[-6,-5],[-4,-12],[0,-14],[-2,-12],[-24,-17],[-2,-6],[-10,-21],[-3,-12],[-1,-13],[2,-10],[3,-21],[3,-80],[2,-18],[6,-20],[19,-152],[5,-17],[7,-14],[5,-16],[30,-124],[24,-76]],[[6376,2183],[-8,25],[-9,14],[-14,-8],[-12,-17],[-10,-18],[-1,-19],[15,-15],[0,-9],[-15,-2],[-14,-7],[-5,-16],[11,-26],[-5,0],[-12,8],[-34,0],[-5,6],[-17,37],[-15,21],[-15,4],[-11,-25],[-3,6],[-2,2],[-3,0],[-3,1],[9,14],[6,17],[-1,15],[-12,5],[-44,-9],[4,17],[2,15],[5,88],[-13,-22],[-9,-35],[-11,-32],[-18,-14],[-4,-1],[-7,-6],[-6,-1],[-5,4],[-12,14],[-32,25],[5,-36],[-8,-17],[-58,-15],[-8,0],[-4,2],[-5,5],[-4,1],[-13,-2],[-4,2],[-31,16],[-13,1],[-8,-3],[-21,-16],[-70,-20],[-5,-3],[-6,-7],[-9,-15],[-4,-5],[-23,-5],[-111,51],[-12,13],[-7,-1],[-3,2],[-1,5],[-2,16],[-1,6],[-2,9],[-3,17],[-3,8],[11,15],[3,7],[1,13],[-16,-12],[-15,-3],[-14,5],[-25,14],[-8,2],[-7,6],[-21,44],[-15,21],[-18,-11],[-27,23],[-46,55],[-1,-14],[2,-17],[1,-14],[-4,-6],[-35,2],[-10,5],[-9,10],[-7,12],[-3,20],[7,17],[11,13],[9,7],[12,2],[31,-10],[41,12],[6,5],[29,42],[6,3],[8,-1],[3,4],[-4,16],[-26,54],[-9,5],[-20,-3],[-24,6],[-53,34]],[[5391,2680],[5,-3],[48,0],[48,-17],[32,9],[11,-1],[61,-21],[30,-31],[23,-8],[24,3],[22,14],[15,26],[-10,23],[15,32],[39,52],[10,11],[26,4],[9,10],[9,14],[9,10],[8,12],[6,21],[-13,-10],[-15,-17],[-15,-12],[-13,4],[-75,-66],[-41,-9],[-37,32],[-8,22],[-3,3],[-7,-4],[-9,-17],[-5,-4],[-6,-1],[-11,-6],[-6,-1],[-13,-26],[-8,12],[-7,46],[-10,10],[-34,11],[-9,7],[-8,13],[-9,22],[-7,25],[-3,21],[-2,24],[-3,11]],[[6433,21],[-5,2],[-42,32],[-8,12],[-3,23],[-3,12],[-17,34],[-6,9],[-10,-1],[-12,-6],[-12,-1],[-10,13],[-7,12],[-60,68],[-4,15],[0,14],[0,1],[2,-4],[17,6],[4,4],[13,15],[5,2],[12,-2],[6,1],[4,5],[8,5],[28,0],[12,8],[-8,5],[-18,5],[-5,7],[-1,19],[5,15],[7,13],[5,14],[2,20],[-1,13],[-5,26],[-4,34],[-3,19],[-5,16],[5,6],[1,4],[2,7],[4,25],[5,23],[7,16],[6,3]]],"transform":{"scale":[0.0018028506138613853,0.0007988699254925539],"translate":[22.13283980300011,44.38104889500005]}};
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
