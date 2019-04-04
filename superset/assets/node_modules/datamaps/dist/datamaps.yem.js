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
  Datamap.prototype.yemTopo = {"type":"Topology","objects":{"yem":{"type":"GeometryCollection","geometries":[{"type":"MultiPolygon","properties":{"name":null},"id":"-99","arcs":[[[0]],[[1]]]},{"type":"Polygon","properties":{"name":"Sa`dah"},"id":"YE.SD","arcs":[[2,3,4,5]]},{"type":"MultiPolygon","properties":{"name":"Al Hudaydah"},"id":"YE.HU","arcs":[[[6]],[[7]],[[8]],[[9,10,11,12,13,14,15,16]]]},{"type":"Polygon","properties":{"name":"Al Mahwit"},"id":"YE.MW","arcs":[[17,-10,18,19]]},{"type":"Polygon","properties":{"name":"Dhamar"},"id":"YE.DH","arcs":[[20,21,-13,22,23]]},{"type":"Polygon","properties":{"name":"Hajjah"},"id":"YE.HJ","arcs":[[24,-19,-17,25,-5]]},{"type":"Polygon","properties":{"name":"Amran"},"id":"YE.AM","arcs":[[26,27,-20,-25,-4]]},{"type":"Polygon","properties":{"name":"Ibb"},"id":"YE.IB","arcs":[[28,29,30,-14,-22]]},{"type":"Polygon","properties":{"name":"Lahij"},"id":"YE.LA","arcs":[[31,32,33,34,35,36,37]]},{"type":"MultiPolygon","properties":{"name":"Ta`izz"},"id":"YE.TA","arcs":[[[38]],[[39,-36,40,-15,-31]]]},{"type":"Polygon","properties":{"name":"Al Mahrah"},"id":"YE.MR","arcs":[[41,42]]},{"type":"Polygon","properties":{"name":"Al Bayda'"},"id":"YE.BA","arcs":[[43,44,-38,45,-29,-21,46,47]]},{"type":"Polygon","properties":{"name":"Al Dali'"},"id":"YE.DL","arcs":[[-37,-40,-30,-46]]},{"type":"Polygon","properties":{"name":"Al Jawf"},"id":"YE.JA","arcs":[[48,49,50,-27,-3,51]]},{"type":"Polygon","properties":{"name":"Shabwah"},"id":"YE.SH","arcs":[[52,53,-44,54,55]]},{"type":"Polygon","properties":{"name":"Ma'rib"},"id":"YE.MA","arcs":[[-55,-48,56,-50,57]]},{"type":"Polygon","properties":{"name":"Sana'a"},"id":"YE.SN","arcs":[[-57,-47,-24,58,-11,-18,-28,-51],[59]]},{"type":"MultiPolygon","properties":{"name":"Hadramawt"},"id":"YE.HD","arcs":[[[60]],[[61]],[[62]],[[63]],[[64,-56,-58,-49,65,-42]]]},{"type":"Polygon","properties":{"name":"Amanat Al Asimah"},"id":"YE.","arcs":[[-60]]},{"type":"Polygon","properties":{"name":"Raymah"},"id":"YE.","arcs":[[-59,-23,-12]]},{"type":"Polygon","properties":{"name":"`Adan"},"id":"YE.AD","arcs":[[-34,66]]},{"type":"Polygon","properties":{"name":"Abyan"},"id":"YE.","arcs":[[67,-32,-45,-54]]}]}},"arcs":[[[21,4255],[-5,-10],[-14,32],[-2,13],[6,11],[10,14],[8,-13],[0,-19],[3,-22],[-6,-6]],[[259,5236],[0,-11],[-6,-10],[-52,11],[-16,-5],[-7,6],[2,24],[-4,23],[4,8],[6,1],[34,-32],[2,-4],[22,-7],[9,-1],[6,-3]],[[2272,7725],[-18,-463],[-66,-58],[-48,9],[-51,-2],[-54,-21],[-45,-27],[-107,-93],[-14,-27],[-33,-79],[-11,-17],[-14,-44],[-8,-12],[-12,-3],[-14,-28],[-34,-37],[-11,-10],[-7,-9],[-9,-4],[-11,-9],[-17,-24],[-11,-25],[-16,-53],[-10,-73],[-12,-51]],[[1639,6565],[-57,-30],[-34,2],[-37,12],[-82,60],[-58,24],[-31,1],[-21,-12],[-12,-14],[-22,-21],[-16,-11],[-105,-44]],[[1164,6532],[-90,13],[-61,-6],[-17,4],[-14,14],[-136,67],[-17,19]],[[829,6643],[-4,34],[-8,22],[-2,20],[12,30],[7,9],[8,6],[6,7],[3,16],[-1,18],[-5,16],[-9,11],[-30,15],[-9,13],[-10,53],[-17,57],[-3,24],[6,36],[13,57],[3,27],[0,32],[-4,32],[-7,24],[-3,24],[5,30],[17,57],[4,30],[0,33],[5,29],[16,23],[22,16],[18,7],[18,15],[3,29],[-8,32],[-16,21],[-46,26],[2,6],[39,83],[70,104],[32,34],[39,43],[18,12],[18,4],[14,-6],[28,-2],[13,-6],[59,-44],[35,-35],[15,-30],[41,-79],[33,-46],[17,-10],[14,0],[30,6],[32,-5],[15,1],[18,10],[5,-4],[0,-16],[-2,-29],[3,-11],[3,-7],[5,-5],[9,-3],[19,5],[13,21],[10,29],[13,25],[17,16],[14,-3],[31,-27],[21,-6],[15,13],[13,26],[11,36],[12,14],[17,-3],[34,-17],[15,2],[62,24],[78,15],[50,-4],[55,-19],[23,2],[50,33],[18,7],[164,-2],[99,-1]],[[428,2255],[-2,17],[0,4],[6,30],[21,63],[34,43],[17,11],[10,-14],[-3,-28],[-24,-46],[-6,-31],[-8,-14],[-45,-35]],[[509,2637],[-6,-10],[-22,1],[11,40],[0,1],[-17,11],[-20,19],[-8,11],[-9,16],[-1,6],[-6,30],[7,22],[16,26],[19,20],[13,7],[6,10],[22,-50],[5,-20],[0,-16],[-11,-54],[-1,-45],[2,-25]],[[341,4764],[9,-3],[11,5],[10,11],[8,-2],[0,-18],[-10,-56],[-2,-19],[2,-12],[-2,-12],[-4,-6],[1,-3],[5,3],[-1,-9],[-17,-43],[-9,-15],[-11,1],[-9,13],[-9,24],[0,33],[8,35],[2,75],[10,25],[10,19],[8,11],[3,12],[4,11],[18,16],[5,-5],[4,-12],[-20,-24],[-3,-9],[4,-3],[0,-6],[-3,-9],[-7,-10],[-12,-10],[-3,-8]],[[933,4936],[2,-62],[4,-16],[0,-32],[4,-25],[1,-41],[-2,-48],[4,-33],[2,-40],[21,-57],[18,-23],[20,-31],[34,-17],[8,-25],[9,-41],[16,-48],[9,-42],[12,-33],[25,-43],[21,-19]],[[1141,4260],[26,-44],[25,-23],[22,-9],[16,0],[15,4],[20,-31],[-1,-17],[-5,-7],[-13,-34]],[[1246,4099],[-11,-14],[-12,-3],[-25,16],[-9,2],[-6,-21],[-23,-44],[-16,-22],[-15,-38],[-13,-64],[11,-107],[-4,-23],[-9,-21],[-3,-25],[1,-26],[2,-22],[-3,-24],[3,-28],[32,-146],[2,-23],[11,-37],[2,-17],[1,-38],[-3,-27],[-29,-60]],[[1130,3287],[-15,-2],[-6,-19],[27,-199],[1,-49],[10,-49],[14,-21],[18,-21],[25,-14],[46,-48],[15,-12],[13,3],[10,17],[13,12],[10,15],[13,9]],[[1324,2909],[2,-40],[4,-26],[-5,-39],[-31,-88],[-13,-14],[-8,9],[-12,9],[-15,-12],[-3,-18],[12,-26],[6,-18],[2,-23],[-10,4],[-21,-12]],[[1232,2615],[-67,-20],[-20,-11],[-29,-22],[-61,-140],[-8,-28],[-9,-19],[-18,-5],[-28,-14],[-23,-17],[-57,-80],[-3,-3]],[[909,2256],[1,32],[-4,51],[-26,90],[-4,15],[-8,119],[-5,14],[-53,99],[-18,78],[-17,65],[-18,46],[-10,109],[-6,52],[-8,44],[-15,73],[-23,135],[-7,29],[-4,45],[-10,42],[-3,47],[-2,13],[-4,8],[-15,19],[-3,8],[1,17],[4,7],[6,-2],[8,-12],[9,-29],[9,-66],[13,-19],[0,42],[-1,20],[-5,18],[12,59],[-9,49],[-16,44],[-9,47],[2,10],[7,15],[2,9],[-1,8],[-2,5],[-2,2],[-3,18],[-6,7],[-5,5],[-3,5],[-2,7],[-4,7],[-4,10],[-6,50],[0,16],[-9,51],[-39,85],[-9,53],[-1,30],[1,16],[6,-3],[4,-11],[-1,-10],[-3,-11],[0,-16],[6,-27],[10,-30],[13,-26],[16,-17],[0,21],[6,48],[-1,30],[-9,52],[-3,48],[-4,18],[-7,15],[-21,35],[-9,18],[-5,25],[-3,34],[4,78],[-4,26],[-10,24],[-29,22],[-26,39],[-16,18],[-18,16],[-17,11],[-18,7],[-16,0],[-11,-13],[-5,-29],[-9,-4],[-18,12],[-16,24],[-1,32],[-5,20],[9,2],[27,-11],[13,4],[9,10],[5,15],[3,20],[-1,15],[-8,22],[-2,17],[21,69],[6,16],[4,-19],[-2,-24],[-6,-22],[-6,-15],[15,-12],[12,-14],[33,-48],[4,-11],[2,-18],[-2,-28],[2,-9],[11,-8],[1,11],[-1,8],[-3,5],[-3,5],[12,23],[5,32],[-2,112],[-7,51],[-13,41],[-4,20],[1,16],[2,15],[1,18],[-1,17],[-2,17],[-3,18],[-11,36],[-33,78],[1,12],[10,21],[-8,14],[-7,17],[-5,20],[-2,24],[8,52],[-2,22],[-17,10],[6,23],[8,12],[9,10],[10,15],[7,15],[3,12],[1,16],[0,23],[4,40],[11,28],[15,20],[14,16],[15,21],[8,26],[4,31]],[[546,5523],[131,-136],[55,12],[34,-3],[18,15],[12,15],[31,13],[83,11],[21,-28],[9,-40],[-1,-46],[-5,-37],[-5,-24],[-7,-20],[0,-27],[9,-47],[-5,-85],[-4,-14],[-1,-20],[12,-126]],[[1474,4929],[-10,-65],[-5,-62],[-13,-25],[-33,-40],[-16,-13],[-57,-72],[-31,-52],[-54,-19],[-9,-17],[-50,-53],[-13,-32],[-7,-37],[3,-72],[-8,-36],[-10,-14],[-20,-60]],[[933,4936],[45,28],[142,24],[17,-4],[17,3],[74,-15],[21,-12]],[[1249,4960],[19,3],[15,9],[42,-3],[35,26],[16,19],[15,-3],[11,-8],[7,-17],[14,-16],[51,-41]],[[2189,3841],[-62,-130],[-20,-142],[-15,-205],[-20,-69],[-28,-46],[-29,-26],[-19,-78]],[[1996,3145],[-16,-12],[-10,6],[-15,13],[-46,26],[-37,43],[-19,14],[-22,13],[-18,19],[-41,19],[-18,16],[-15,27],[-35,50],[-13,8],[-10,-3],[-9,-26],[-1,-19],[-6,-24],[-9,-25],[-37,-25],[-21,8],[-6,20],[-11,76],[-12,4],[-15,-12],[-19,-36],[-23,-32],[-17,-40],[-9,2],[-11,-1],[-12,-10],[-6,-14],[0,-25],[6,-23],[3,-33],[-1,-33],[-22,-70],[-19,-17],[-21,-9],[-13,10],[-4,26],[4,31],[-5,15],[-6,-2],[-6,-23],[-13,-32],[-13,-62],[-11,-28],[-12,-46]],[[1130,3287],[19,1],[14,3],[49,47],[27,42],[8,18],[14,11],[25,1],[17,-11],[12,-3],[12,5],[9,1],[14,6],[12,16],[50,54],[15,24],[14,20],[24,55],[7,36],[-7,26],[-14,31],[-8,39],[-17,44],[-52,103],[-19,46],[-10,50],[0,26]],[[1345,3978],[11,19],[39,-7],[31,5],[18,10],[27,44],[16,16],[16,18],[19,18],[44,56],[28,18],[26,8],[22,3],[14,-18],[22,-15],[17,-30],[19,-28],[61,-22],[24,13],[11,27],[5,28],[7,21],[19,-4],[15,-32],[21,-24],[21,-4],[34,22],[16,16],[19,39],[14,37],[19,22],[17,4],[21,-5],[20,5],[21,-4],[18,-21],[24,-59],[11,-98],[15,-53],[32,-79],[9,-33],[1,-50]],[[1164,6532],[-4,-251],[12,-198],[-2,-24],[-1,-32],[0,-25],[3,-21],[-1,-22],[5,-15],[24,-29],[9,-26],[-1,-43],[3,-36],[1,-33],[32,-112],[-1,-20],[-7,-16],[-11,-14],[-8,-13],[-5,-15],[-2,-15],[9,-16],[10,3],[30,62],[8,6],[8,-8],[10,-14],[20,-58],[8,-55],[6,-57],[-4,-28],[-2,-52],[5,-36],[1,-28],[14,-21],[6,-13],[-4,-53],[-6,-39],[-9,-18],[-12,-4],[-15,5],[-13,-1],[-11,-11],[-7,-13],[-4,-15],[-2,-20],[-1,-19],[11,-35],[-1,-20],[-16,-54]],[[546,5523],[0,2],[7,199],[-3,66],[-22,204],[-3,108],[-1,10],[-5,30],[1,-1],[0,4],[0,7],[-1,9],[-2,8],[-7,14],[-1,4],[39,23],[28,21],[21,25],[7,24],[-1,23],[-2,22],[3,19],[9,7],[31,10],[12,7],[35,36],[18,23],[10,25],[21,95],[3,27],[1,31],[4,20],[10,7],[21,-6],[32,-17],[14,4],[5,27],[-1,3]],[[1639,6565],[42,-49],[13,-10],[47,-61],[12,-22],[4,-23],[-4,-22],[-7,-17],[-1,-25],[12,-42],[7,-54],[7,-37],[12,-36],[2,-32],[-1,-29],[-5,-26],[4,-19],[5,-13],[2,-23],[-18,-93],[7,-39],[2,-45],[4,-39],[26,-80],[20,-40]],[[1831,5689],[-45,-5],[-47,-31],[-46,-43],[-9,-34],[-6,-37],[3,-80],[5,-40],[6,-28],[-1,-31],[-4,-28],[-17,-41],[-23,-30],[-15,-37],[-1,-67],[-9,-60],[-49,-67],[-23,-20],[-26,-6],[-31,4],[-11,-20],[1,-23],[-9,-36]],[[1996,3145],[27,-29],[-1,-82],[7,-21],[10,-5],[28,-30]],[[2067,2978],[-9,-46],[-13,-16],[-15,0],[-17,-3],[-7,-11],[-1,-20],[-8,-31],[-13,-23],[-6,-31],[5,-30],[14,-25],[-7,-27],[-15,-6],[-16,0],[-20,-6],[-20,-15],[-20,-24],[-13,-37],[-3,-27],[-4,-25],[-1,-17],[-8,-7],[-10,1],[-9,-11],[-13,-58],[-13,-15],[-6,-26],[1,-9],[-4,-37]],[[1816,2396],[-8,-21],[-11,-22],[-31,-38],[-20,-3],[-16,11],[-12,10],[-16,11],[-29,1],[-61,34],[-20,22],[-41,7],[-94,47],[-6,21],[4,17],[0,28],[-12,9],[-36,-26],[-7,14],[1,26],[-6,21],[-37,-8],[-17,-13],[-21,10],[-17,-15],[-49,3],[-22,73]],[[2622,2593],[-30,-15],[-6,-22],[-3,-46],[3,-30],[-3,-22],[-11,-12],[-12,-11],[-30,-12],[-10,-17],[-6,-24],[3,-23],[0,-24],[-2,-21],[-15,-21],[-31,-34],[0,-18],[12,-10],[40,-5],[15,-10],[4,-13],[-8,-20],[-45,-88],[-22,-60],[-3,-59],[3,-41],[12,-23],[12,-13],[9,-17],[1,-17],[-7,-32],[-38,-48],[-53,-258],[-26,-329]],[[2375,1198],[-5,-15],[0,-2]],[[2370,1181],[-68,-9],[-148,-69],[-167,-51],[-74,-47],[-35,-37],[-56,-151],[0,-1]],[[1822,816],[-2,16],[-4,1],[-19,-13],[-24,-10],[-52,-44],[-18,-3],[-16,3],[-15,0],[-31,-29],[-17,-1],[-16,10],[-10,20],[11,-1],[20,-7],[11,-2],[7,10],[0,20],[-6,11],[-9,-11],[-21,5],[-26,-18],[-48,-46],[-23,-11],[-13,-1],[-21,12],[-24,-18],[-12,-2],[-16,17],[-14,51],[-12,11],[-17,4],[-13,10],[-23,27],[-13,11],[-15,9],[-17,7],[-18,2],[-11,7],[-31,32],[-16,11],[-28,-1],[-8,6],[-12,16],[-8,7],[-8,3],[-10,-8],[-46,-81]],[[1108,848],[29,104],[62,168],[46,81],[28,75],[3,32],[-4,24],[-6,18],[0,23],[11,15],[28,6],[12,12],[15,11],[12,22],[16,12],[16,8],[16,-4],[15,-14],[15,-8],[29,-30],[16,-24],[22,-18],[15,-2],[4,23],[-3,72],[6,9],[31,-33],[19,-5],[9,14],[4,31],[8,28],[10,5],[18,5],[9,10],[-1,21],[0,24],[8,12],[10,14],[10,32],[34,-11],[34,2],[42,18],[19,26],[4,33],[-4,29],[1,36],[-1,25],[-6,27],[4,19],[19,9],[52,2],[8,16],[-2,26],[-10,19],[-23,5],[-11,11],[-14,11],[-7,22],[6,23],[13,15],[15,10],[22,6],[6,9],[1,11],[-2,10],[4,10],[10,5],[11,1],[13,9],[9,17],[7,17],[11,9],[7,31]],[[1918,2129],[32,-21],[11,-23],[33,-44],[22,8],[29,34],[55,41],[13,27],[13,15],[32,-22],[18,5],[5,29],[-3,35],[2,106],[19,8],[26,4],[67,47],[36,42],[34,28],[28,48],[50,195]],[[2440,2691],[48,0],[13,-5],[25,24],[18,28],[42,47],[18,4],[13,-12],[10,-74],[-5,-110]],[[1042,787],[-1,-21],[-10,-10],[-5,4],[-10,17],[-4,9],[-10,-4],[-5,5],[-3,19],[7,6],[7,4],[18,1],[11,-10],[1,-5],[4,-15]],[[1816,2396],[14,-40],[3,-33],[-3,-35],[-8,-33],[-1,-30],[13,-23],[17,-8],[18,7],[17,-3],[25,-21],[5,-19],[2,-29]],[[1108,848],[-4,-7],[-11,-11],[-17,-3],[-19,4],[-4,14],[15,117],[1,56],[-7,50],[-17,46],[-24,40],[-3,15],[-3,18],[-6,12],[-5,9],[-3,12],[-1,28],[-3,28],[-6,25],[-7,23],[-29,58],[-4,17],[-1,11],[-10,34],[-8,37],[-3,12],[-49,107],[-18,103],[11,45],[7,49],[5,258],[16,45],[3,14],[2,10],[3,10],[9,7],[-11,46],[2,69]],[[6982,4337],[-2,9],[-1,27],[-7,21],[-6,26],[-8,25],[-6,38],[-9,27],[-8,29],[-14,36],[-19,15],[-44,12],[-54,25],[-54,-5],[-19,-12],[-20,-9],[-62,-11],[-41,3],[-50,29],[-12,26],[-6,24],[0,27],[2,25],[9,25],[13,27],[15,46],[13,19],[8,21],[4,59],[-5,28],[-8,15],[-33,16],[-24,5],[-25,13],[-14,32],[-7,51],[6,57],[7,38],[7,29],[0,28],[-4,34],[-1,39],[8,42],[0,36],[7,51],[14,26],[13,41],[31,148],[-4,51],[-10,38],[-17,17],[-12,21],[-12,28],[1,54],[63,420],[-6,53],[-9,31],[-1,33],[13,57],[17,37],[20,28],[34,36],[142,103],[65,76],[62,127],[325,462],[105,270],[99,380],[76,413],[50,435],[138,599],[221,557]],[[7936,9976],[23,-92],[34,-141],[35,-140],[34,-140],[35,-140],[35,-141],[34,-140],[35,-140],[34,-140],[35,-140],[34,-141],[35,-140],[34,-140],[35,-140],[34,-141],[35,-140],[35,-140],[25,-104],[-1,-1],[-5,-1],[-1,0],[12,-14],[30,-3],[14,-8],[9,-20],[31,-122],[51,-196],[50,-197],[51,-197],[50,-196],[-17,-15],[-38,-18],[-30,12],[-9,-14],[-9,-3],[-10,-1],[-8,-8],[-16,-27],[-9,-12],[-20,-11],[-27,-28],[-34,-12],[-16,-12],[-30,-31],[-12,-9],[-113,-52],[-52,-42],[-91,-111],[-82,-116],[-21,-40],[-11,-29],[-14,-51],[-27,-53],[-6,-16],[-3,-19],[0,-14],[2,-18],[2,-14],[2,-4],[-6,-27],[-19,-36],[-8,-59],[-19,-40],[-4,-26],[7,-28],[11,-33],[7,-34],[-9,-59],[13,-22],[27,-24],[0,-21],[-6,-104],[3,-63],[8,-61],[6,-9],[4,-8],[1,-8],[-1,-9],[-4,-13],[-1,-8],[0,-11],[-3,-11],[-4,-9],[-6,-3],[-18,-3],[-122,-61],[-7,-10],[-6,-10],[-5,-7],[-7,-4],[-12,-2],[-8,-3],[-64,-43],[-31,-35],[1,-32],[-1,-6],[-2,-2],[-2,0],[-1,-1],[0,-17],[-2,-2],[-5,5],[-4,3],[-6,6],[-7,10],[-7,3],[-11,-13],[-5,-6],[-41,-14],[-64,-61],[-10,-18],[-4,-21],[4,-28],[7,-15],[0,-10],[-17,-11],[-85,-14],[-16,-9],[-13,-13],[-13,-15],[-19,-39],[-16,-2],[-6,-5],[-3,-9],[-9,0],[-41,-32],[-11,-12],[-20,12],[-23,-16],[-21,-24],[-16,-12],[-161,-76],[-176,-58],[-38,-18]],[[2754,3744],[90,0],[19,-16],[14,-22],[-4,-27],[-10,-30],[-6,-29],[-1,-35],[16,-23],[34,-13],[19,-27],[46,-213],[17,-50],[29,-33],[37,-12],[34,-25],[15,-19],[3,-17],[-1,-16],[3,-17],[1,-19],[8,-25],[3,-25],[18,-30]],[[3138,3021],[-12,-121],[-22,-54],[-13,-69],[-30,-47],[-139,-179],[-33,-34],[-25,-19],[-22,-9],[-17,-3],[-16,0],[-28,25],[-13,41],[-25,14],[-112,19],[-9,8]],[[2440,2691],[0,38],[-5,36],[-20,44],[-60,99],[-23,50],[-13,42],[-18,41],[-27,17],[-33,1],[-22,6],[-18,-11],[-13,-5],[-11,-15],[-13,-9],[-22,0],[-24,-7],[-16,-16],[-35,-24]],[[2189,3841],[42,11],[34,24],[34,50]],[[2299,3926],[43,-15],[22,-21],[17,-31],[4,-40],[0,-43],[7,-75],[7,-48],[1,-47],[8,-34],[2,-31],[7,-31],[10,-27],[15,-16],[26,-1],[32,40],[9,20],[13,8],[34,-13],[5,15],[-3,15],[7,15],[15,2],[23,15],[27,23],[28,4],[21,-12],[18,-4],[13,9],[0,25],[-14,45],[1,21],[7,16],[8,-3],[5,-9],[5,-16],[8,-8],[12,10],[6,12],[6,48]],[[3907,7026],[34,-876],[-166,-285]],[[3775,5865],[-677,-217],[-244,-149],[-104,-156],[-92,-14],[-170,47],[-195,178],[-272,111]],[[2021,5665],[-54,57],[-69,9],[-16,-12],[-7,-13],[-44,-17]],[[2272,7725],[20,-1],[136,-1],[46,-16],[131,-132],[37,-21],[171,-31],[201,-35],[153,-27],[196,-35],[133,32],[180,42],[30,-30],[52,-125],[59,-144],[69,-163],[10,-12],[11,0]],[[5260,2807],[-87,3],[-13,-8],[-36,-55],[-8,-5],[-7,-1],[-6,-3],[-7,-11],[-15,32],[-28,9],[-63,-1],[3,-6],[3,-14],[-33,-1],[-93,-48],[4,35],[-13,23],[-18,16],[-12,15],[-6,-10],[-22,18],[-72,31],[-12,-12],[-43,-22],[-14,-5],[-12,-13],[-41,-87],[-36,-33],[-124,-75],[-18,-20],[-66,-122],[-103,-162],[-31,-33],[-59,-32]],[[4172,2210],[-1,1],[-7,73],[-6,37],[-1,56],[-25,141],[-42,155],[8,34],[10,27],[10,36],[-3,48],[1,64],[-11,61],[-29,34],[-111,9],[-55,22],[-52,32],[-57,14],[-62,-14],[-81,-40],[-65,-48],[-93,-27],[-14,35],[-5,38],[-28,91],[-12,53],[-19,40],[-23,-3],[-26,-22],[-71,-46],[-24,-32],[-30,-25],[-37,-21],[-73,-12]],[[2754,3744],[-18,18],[-10,20],[-7,41],[2,79],[4,43],[5,39],[0,18],[-2,12],[11,13],[4,18],[-1,26],[6,57],[19,62],[7,31],[17,62],[112,164],[473,577]],[[3376,5024],[1139,152],[73,-44],[10,-47],[-106,-286],[-35,-74],[-19,-70],[-8,-51],[0,-36],[-24,-124],[-2,-40],[0,-36],[20,-36],[34,-79],[0,-43],[-12,-42],[-131,-195],[-19,-40],[6,-37],[90,-110],[57,-98],[62,-72],[62,-39],[83,-21],[60,-3],[20,-13],[21,-20],[16,-32],[16,-57],[8,-45],[20,-46],[11,-40],[40,-70],[60,-51],[53,-8],[62,2],[69,-31],[74,-60],[18,-37],[12,-31],[7,-28],[2,-25],[4,-24],[23,-70],[6,-29],[2,-19],[0,-12]],[[2299,3926],[1,88],[4,22],[0,27],[-6,11],[-4,9],[2,12],[8,17],[6,29],[11,31],[8,18],[10,17],[10,41],[4,21],[14,17],[40,32],[12,34],[9,46],[-3,34],[2,29],[0,31],[-8,50],[-16,28],[-24,18],[-37,7],[-28,12],[-21,33],[-27,51],[-35,48],[-15,8],[-12,5],[-16,-18],[-10,-26],[-10,-34],[-28,-15],[-26,18],[-28,58],[-27,40],[-19,11],[-18,3],[-13,9],[-3,23],[17,27],[95,116],[23,41],[15,56],[-17,48],[-53,115],[-12,67],[0,100],[-14,135],[-39,139]],[[3775,5865],[-399,-841]],[[1345,3978],[-34,17],[-3,16],[-43,10],[-5,44],[-14,34]],[[1633,4622],[22,0],[17,0],[6,2],[1,6],[-2,14],[3,8],[8,2],[7,7],[3,13],[0,27],[-4,20],[-5,-3],[-5,7],[-1,17],[-1,16],[-6,18],[-1,13],[1,16],[-1,13],[4,14],[11,18],[14,17],[8,12],[2,14],[-1,11],[-2,21],[4,15],[7,12],[4,-12],[6,13],[8,0],[16,-3],[3,10],[0,15],[3,14],[6,7],[4,8],[5,0],[5,-4],[-3,-11],[-1,-13],[7,-6],[12,1],[7,10],[6,12],[-2,12],[-5,13],[-15,17],[-9,19],[-7,11],[-14,11],[-13,8],[-11,-1],[-11,-7],[-8,-7],[-10,-19],[-7,-17],[-3,-8],[-11,0],[-7,-6],[-6,-12],[-15,-10],[-7,-15],[-1,-37],[3,-9],[-2,-7],[-8,-2],[-3,-12],[-6,-15],[-10,-3],[-5,-11],[-8,-4],[-15,-6],[-9,-5],[-1,-12],[4,-17],[7,-10],[6,-5],[8,-10],[11,-23],[1,-15],[-4,-3],[-8,-4],[-6,-11],[-4,-29],[3,-26],[14,-15],[14,-18],[3,-13],[-3,-31],[3,-7]],[[9004,10],[2,-10],[-27,3],[-11,2],[-12,9],[16,11],[15,-2],[9,-8],[8,-5]],[[8786,100],[12,-8],[12,0],[12,-15],[3,-23],[0,-21],[-12,-6],[-12,-3],[-24,17],[-16,25],[-18,8],[3,14],[12,7],[11,-2],[8,6],[9,1]],[[8092,149],[17,-11],[14,1],[23,-7],[35,-2],[24,-18],[45,17],[12,-4],[4,-15],[-10,-7],[-9,-16],[7,-8],[7,-25],[-23,8],[-10,-4],[-13,-8],[-38,13],[-35,3],[-5,12],[-8,22],[-5,0],[-5,1],[-17,-9],[-9,-3],[-3,5],[-10,24],[-1,7],[-5,-2],[-16,12],[-11,-3],[-9,-5],[-5,7],[-3,5],[-27,22],[-4,19],[12,6],[13,3],[19,0],[24,-10],[25,-30]],[[9218,860],[27,-5],[19,3],[20,4],[32,-51],[55,-73],[37,-17],[30,-13],[17,35],[8,35],[22,9],[15,-4],[14,-12],[27,7],[28,-2],[30,30],[11,7],[19,22],[9,18],[21,3],[10,-18],[12,-15],[17,-19],[13,5],[10,10],[4,-3],[8,-17],[6,-13],[15,-1],[19,-6],[7,-23],[13,-8],[28,-22],[33,-12],[32,-33],[17,-9],[40,-44],[21,5],[15,16],[9,-2],[11,-10],[-10,-18],[-24,-12],[-17,-10],[-16,-5],[-9,-11],[-1,-39],[-34,-25],[-28,-11],[-32,-24],[-37,6],[-30,-20],[-7,-12],[-15,-38],[-7,-8],[-21,-16],[-23,-33],[-12,-13],[-24,4],[-37,-5],[-14,4],[-13,-7],[-19,-27],[-18,11],[-13,7],[-24,-11],[-35,-10],[-97,-33],[-36,-7],[-47,9],[-45,24],[-37,17],[-16,29],[-13,28],[-13,29],[-12,33],[-21,13],[-33,39],[-84,92],[-20,32],[-2,8],[7,10],[22,-11],[16,4],[18,18],[4,5],[1,13],[7,26],[3,15],[-6,85],[12,8],[14,5],[34,8],[7,22],[9,22],[8,15],[15,4],[44,-16]],[[6982,4337],[-115,-57],[-87,-14],[-77,-55],[-21,-22],[-60,-90],[-13,-13],[-33,-10],[-47,-44],[-52,-64],[-11,-1],[-15,10],[-21,-8],[-34,-27],[-15,-8],[-7,-2],[-8,0],[-5,30],[-5,16],[-7,-1],[-12,-8],[-51,-8],[-116,-67],[-178,-80],[-95,-93],[-35,-24],[-36,-10],[-17,-15],[-32,-39],[-67,-54],[-32,-39],[-6,-47],[-8,3],[-13,11],[-15,10],[-19,-4],[-17,-15],[-12,-20],[-40,-101],[-15,-51],[-8,-61],[6,-7],[1,-17],[-2,-17],[-2,-9],[-10,-12],[-33,-23],[-7,-9],[-5,-35],[-12,-13],[-14,-5],[-13,-11],[-4,-11],[-2,-12],[0,-33],[-3,-8],[-5,-7],[-6,-10],[-8,-40],[-14,-16],[-31,-23],[-48,-105],[-15,-16],[-4,-2],[-10,-13],[-5,-5],[-5,-1],[-6,1],[-8,1]],[[3907,7026],[107,-8],[26,6],[24,17],[99,100],[92,93],[1,2],[24,55],[54,256],[38,181],[13,45],[79,169],[120,260],[128,275],[73,157],[63,135],[18,22],[104,91],[138,122],[155,136],[139,121],[116,102],[36,32],[75,47],[104,25],[129,32],[130,31],[129,31],[129,31],[130,32],[129,31],[130,31],[129,32],[129,31],[130,31],[129,32],[129,31],[130,31],[129,31],[129,32],[130,31],[127,31],[6,-23]],[[2370,1181],[-6,-25],[-2,-26],[-1,-4],[-19,-86],[-2,-15],[5,-59],[-3,-21],[-16,-8],[-17,5],[-19,13],[-12,19],[1,22],[13,9],[17,-2],[14,2],[6,25],[-3,1],[-13,29],[-1,6],[-1,5],[1,7],[0,5],[-5,2],[-5,-3],[-1,-6],[1,-7],[-1,-3],[-5,-17],[-3,-3],[-4,1],[-8,7],[-5,2],[-18,-2],[-8,-5],[-4,-8],[-5,-23],[-14,-19],[-15,-4],[-10,21],[-11,-11],[-3,-12],[3,-37],[6,10],[5,2],[25,-4],[4,-5],[-2,-18],[-5,-16],[-12,-17],[-13,-10],[-11,4],[-23,16],[-7,8],[-5,12],[0,6],[-2,5],[-10,7],[-20,4],[-16,-10],[-30,-34],[-1,6],[-3,9],[-2,6],[4,14],[-5,20],[-10,20],[-11,14],[-33,21],[-34,3],[-30,-12],[-25,-21],[-42,-63],[-46,-87],[-2,-8],[-6,-18],[-6,-8],[-1,4]],[[4172,2210],[-128,-69],[-205,-76],[-71,-83],[-100,-66],[-14,-5],[-16,4],[-29,16],[-19,0],[-17,-8],[-35,-27],[-16,-5],[-167,0],[-35,10],[-18,17],[-10,6],[-5,-7],[-4,-4],[-21,-12],[-70,-20],[-138,-10],[-14,-6],[-26,-19],[-12,-4],[-34,2],[-15,-2],[-10,-11],[-111,-44],[-27,-25],[-78,-139],[-22,-29],[-11,-21],[-11,-54],[-38,-86],[-25,-41],[-30,-23],[-139,-60],[-32,-30],[-29,-44],[-11,-24],[-4,-13]]],"transform":{"scale":[0.0012382830080008113,0.0006884882329232865],"translate":[42.15870201900006,12.11144367200015]}};
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
