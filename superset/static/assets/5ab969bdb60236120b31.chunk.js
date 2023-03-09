"use strict";(globalThis.webpackChunksuperset=globalThis.webpackChunksuperset||[]).push([[4194],{44194:(e,t,a)=>{a.r(t),a.d(t,{default:()=>X}),a(67294);var i=a(43323),s=a(51995),o=a(45697),r=a.n(o),n=a(23493),l=a.n(n),c=a(21804),h=a.n(c),m=a(78580),u=a.n(m),p=a(15078),d=a.n(p),y=a(30381),x=a.n(y),g=a(28041),b=a.n(g),f=a(28062),k=a(67190),v=a(55867),A=a(45636),w=a(51115),L=a(40962),M=a(37731),C=a(60524),T=a(95963),$=a(83937),F=a(80221);const _=r().oneOfType([r().number,r().oneOf(["auto"])]),D=r().oneOfType([r().string,r().shape({label:r().string})]),N=r().shape({r:r().number.isRequired,g:r().number.isRequired,b:r().number.isRequired}),O=r().shape({x:r().number,y:r().number}),S=r().shape({x:r().string,y:r().number}),E=r().shape({outliers:r().arrayOf(r().number),Q1:r().number,Q2:r().number,Q3:r().number,whisker_high:r().number,whisker_low:r().number}),B=r().shape({markerLabels:r().arrayOf(r().string),markerLineLabels:r().arrayOf(r().string),markerLines:r().arrayOf(r().number),markers:r().arrayOf(r().number),measures:r().arrayOf(r().number),rangeLabels:r().arrayOf(r().string),ranges:r().arrayOf(r().number)}),z=r().shape({annotationType:r().oneOf(Object.keys(T.DT)),color:r().string,hideLine:r().bool,name:r().string,opacity:r().string,show:r().bool,showMarkers:r().bool,sourceType:r().string,style:r().string,value:r().oneOfType([r().number,r().string]),width:r().number}),R=[{text:"No data",dy:"-.75em",class:"header"},{text:"Adjust filters or check the Datasource.",dy:".75em",class:"body"}];b().utils.noData=function(e,t){const a=e.options().margin(),i=b().utils.availableHeight(null,t,a),s=b().utils.availableWidth(null,t,a),o=a.left+s/2,r=a.top+i/2;t.selectAll("g").remove();const n=t.selectAll(".nv-noData").data(R);n.enter().append("text").attr("class",(e=>`nvd3 nv-noData ${e.class}`)).attr("dy",(e=>e.dy)).style("text-anchor","middle"),n.attr("x",o).attr("y",r).text((e=>e.text))};const{getColor:G,getScale:I}=f,Z=["line","dual_line","line_multi","area","compare","bar","time_pivot"],P={data:r().oneOfType([r().arrayOf(r().oneOfType([S,r().shape({key:r().string,values:r().arrayOf(S)}),r().shape({key:r().arrayOf(r().string),values:r().arrayOf(O)}),r().shape({classed:r().string,key:r().string,type:r().string,values:r().arrayOf(O),yAxis:r().number}),r().shape({label:r().string,values:r().arrayOf(E)}),r().shape({key:r().string,values:r().arrayOf(r().object)})])),B]),width:r().number,height:r().number,annotationData:r().object,annotationLayers:r().arrayOf(z),bottomMargin:_,colorScheme:r().string,comparisonType:r().string,contribution:r().bool,leftMargin:_,onError:r().func,showLegend:r().bool,showMarkers:r().bool,useRichTooltip:r().bool,vizType:r().oneOf(["area","bar","box_plot","bubble","bullet","compare","column","dist_bar","line","line_multi","time_pivot","pie","dual_line"]),xAxisFormat:r().string,numberFormat:r().string,xAxisLabel:r().string,xAxisShowMinMax:r().bool,xIsLogScale:r().bool,xTicksLayout:r().oneOf(["auto","staggered","45°"]),yAxisFormat:r().string,yAxisBounds:r().arrayOf(r().number),yAxisLabel:r().string,yAxisShowMinMax:r().bool,yIsLogScale:r().bool,orderBars:r().bool,isBarStacked:r().bool,showBarValue:r().bool,reduceXTicks:r().bool,showControls:r().bool,showBrush:r().oneOf([!0,"yes",!1,"no","auto"]),onBrushEnd:r().func,yAxis2Format:r().string,lineInterpolation:r().string,isDonut:r().bool,isPieLabelOutside:r().bool,pieLabelType:r().oneOf(["key","value","percent","key_value","key_percent","key_value_percent"]),showLabels:r().bool,areaStackedStyle:r().string,entity:r().string,maxBubbleSize:r().number,xField:D,yField:D,sizeField:D,baseColor:N},U=()=>{},V=(0,k.JB)();function W(e,t){const{data:a,width:i,height:s,annotationData:o,annotationLayers:r=[],areaStackedStyle:n,baseColor:c,bottomMargin:m,colorScheme:p,comparisonType:y,contribution:g,entity:f,isBarStacked:_,isDonut:D,isPieLabelOutside:N,leftMargin:O,lineInterpolation:S="linear",markerLabels:E,markerLines:B,markerLineLabels:z,markers:R,maxBubbleSize:P,onBrushEnd:W=U,onError:H=U,orderBars:q,pieLabelType:J,rangeLabels:j,ranges:X,reduceXTicks:Q=!1,showBarValue:Y,showBrush:K,showControls:ee,showLabels:te,showLegend:ae,showMarkers:ie,sizeField:se,useRichTooltip:oe,vizType:re,xAxisFormat:ne,numberFormat:le,xAxisLabel:ce,xAxisShowMinMax:he=!1,xField:me,xIsLogScale:ue,xTicksLayout:pe,yAxisFormat:de,yAxis2Format:ye,yAxisBounds:xe,yAxis2Bounds:ge,yAxisLabel:be,yAxisShowMinMax:fe=!1,yAxis2ShowMinMax:ke=!1,yField:ve,yIsLogScale:Ae,sliceId:we}=t,Le=null!==document.querySelector("#explorer-container"),Me=e;Me.innerHTML="";const Ce=r.filter((e=>e.show));let Te,$e=Me,Fe=null;for(;$e.parentElement;){if($e.parentElement.id.startsWith("chart-id-")){Fe=$e.parentElement.id;break}$e=$e.parentElement}let _e=i,De="key";function Ne(e){return u()(e).call(e,re)}Me.style.width=`${i}px`,Me.style.height=`${s}px`,Fe?(0,F.o2)(Fe):(0,F.Vl)(!0),b().addGraph((function(){var t;const r=d().select(e);r.classed("superset-legacy-chart-nvd3",!0),r.classed(`superset-legacy-chart-nvd3-${h()(re)}`,!0);let Me=r.select("svg");Me.empty()&&(Me=r.append("svg"));const $e="bullet"===re?Math.min(s,50):s,Oe=Ne(Z),Se="staggered"===pe,Ee="auto"===pe&&Ne(["column","dist_bar"])||"45°"===pe?45:0;if(45===Ee&&(0,$.Z)(K))return H((0,v.t)("You cannot use 45° tick layout along with the time range filter")),null;const Be=(0,$.Z)(K)||"auto"===K&&s>=480&&"45°"!==pe,ze=(0,k.JB)(le);switch(re){case"line":Be?(Te=b().models.lineWithFocusChart(),Se&&(Te.focus.margin({bottom:40}),Te.focusHeight(80)),Te.focus.xScale(d().time.scale.utc())):Te=b().models.lineChart(),Te.xScale(d().time.scale.utc()),Te.interpolate(S),Te.clipEdge(!1);break;case"time_pivot":Te=b().models.lineChart(),Te.xScale(d().time.scale.utc()),Te.interpolate(S);break;case"dual_line":case"line_multi":Te=b().models.multiChart(),Te.interpolate(S),Te.xScale(d().time.scale.utc());break;case"bar":Te=b().models.multiBarChart().showControls(ee).groupSpacing(.1),Q||(_e=(0,F.UG)(a,_,i)),Te.width(_e),Te.xAxis.showMaxMin(!1),Te.stacked(_);break;case"dist_bar":Te=b().models.multiBarChart().showControls(ee).reduceXTicks(Q).groupSpacing(.1),Te.xAxis.showMaxMin(!1),Te.stacked(_),q&&a.forEach((e=>{const t=[...e.values];e.values=t.sort(((e,t)=>(0,F.Hy)(e.x)<(0,F.Hy)(t.x)?-1:1))})),Q||(_e=(0,F.UG)(a,_,i)),Te.width(_e);break;case"pie":if(Te=b().models.pieChart(),De="x",Te.valueFormat(ze),D&&Te.donut(!0),Te.showLabels(te),Te.labelsOutside(N),Te.labelThreshold(.05),Te.cornerRadius(!0),u()(t=["key","value","percent"]).call(t,J))Te.labelType(J);else if("key_value"===J)Te.labelType((e=>`${e.data.x}: ${ze(e.data.y)}`));else{const e=d().sum(a,(e=>e.y)),t=(0,k.JB)(A.Z.PERCENT_2_POINT);"key_percent"===J?(Te.tooltip.valueFormatter((e=>t(e))),Te.labelType((a=>`${a.data.x}: ${t(a.data.y/e)}`))):(Te.tooltip.valueFormatter((a=>`${ze(a)} (${t(a/e)})`)),Te.labelType((a=>`${a.data.x}: ${ze(a.data.y)} (${t(a.data.y/e)})`)))}Te.margin({top:0});break;case"column":Te=b().models.multiBarChart().reduceXTicks(!1);break;case"compare":Te=b().models.cumulativeLineChart(),Te.xScale(d().time.scale.utc()),Te.useInteractiveGuideline(!0),Te.xAxis.showMaxMin(!1);break;case"bubble":Te=b().models.scatterChart(),Te.showDistX(!1),Te.showDistY(!1),Te.tooltip.contentGenerator((e=>(0,F.zK)({point:e.point,entity:f,xField:me,yField:ve,sizeField:se,xFormatter:(0,F.fF)(ne),yFormatter:(0,F.fF)(de),sizeFormatter:V}))),Te.pointRange([5,P**2]),Te.pointDomain([0,d().max(a,(e=>d().max(e.values,(e=>e.size))))]);break;case"area":Te=b().models.stackedAreaChart(),Te.showControls(ee),Te.style(n),Te.xScale(d().time.scale.utc());break;case"box_plot":De="label",Te=b().models.boxPlotChart(),Te.x((e=>e.label)),Te.maxBoxWidth(75);break;case"bullet":Te=b().models.bulletChart(),a.rangeLabels=j,a.ranges=X,a.markerLabels=E,a.markerLines=B,a.markerLineLabels=z,a.markers=R;break;default:throw new Error(`Unrecognized visualization for nvd3${re}`)}let Re;Te.margin({left:0,bottom:0}),Y&&((0,F.Ad)(Me,a,_,de),Te.dispatch.on("stateChange.drawBarValues",(()=>{(0,F.Ad)(Me,a,_,de)}))),Be&&W!==U&&Te.focus&&Te.focus.dispatch.on("brush",(e=>{const t=(0,F.z_)(e.extent);t&&e.brush.on("brushend",(()=>{W(t)}))})),Te.xAxis&&Te.xAxis.staggerLabels&&Te.xAxis.staggerLabels(Se),Te.xAxis&&Te.xAxis.rotateLabels&&Te.xAxis.rotateLabels(Ee),Te.x2Axis&&Te.x2Axis.staggerLabels&&Te.x2Axis.staggerLabels(Se),Te.x2Axis&&Te.x2Axis.rotateLabels&&Te.x2Axis.rotateLabels(Ee),"showLegend"in Te&&void 0!==ae&&(_e<340&&"pie"!==re?Te.showLegend(!1):Te.showLegend(ae)),Ae&&Te.yScale(d().scale.log()),ue&&Te.xScale(d().scale.log()),Oe?(Re=(0,w.bt)(ne),Te.interactiveLayer.tooltip.headerFormatter(L.Z)):Re=(0,F.fF)(ne),Te.x2Axis&&Te.x2Axis.tickFormat&&Te.x2Axis.tickFormat(Re),Te.xAxis&&Te.xAxis.tickFormat&&(Ne(["dist_bar","box_plot"])?Te.xAxis.tickFormat((e=>e.length>40?`${e.slice(0,Math.max(0,40))}…`:e)):Te.xAxis.tickFormat(Re));let Ge=(0,F.fF)(de);if(Te.yAxis&&Te.yAxis.tickFormat&&(!g&&"percentage"!==y||de&&de!==A.Z.SMART_NUMBER&&de!==A.Z.SMART_NUMBER_SIGNED||(Ge=(0,k.JB)(A.Z.PERCENT_1_POINT)),Te.yAxis.tickFormat(Ge)),Te.y2Axis&&Te.y2Axis.tickFormat&&Te.y2Axis.tickFormat(Ge),Te.yAxis&&Te.yAxis.ticks(5),Te.y2Axis&&Te.y2Axis.ticks(5),(0,F.Ml)(Te.xAxis,he),(0,F.Ml)(Te.x2Axis,he),(0,F.Ml)(Te.yAxis,fe),(0,F.Ml)(Te.y2Axis,ke||fe),"time_pivot"===re){if(c){const{r:e,g:t,b:a}=c;Te.color((i=>{const s=i.rank>0?.5*i.perc:1;return`rgba(${e}, ${t}, ${a}, ${s})`}))}Te.useInteractiveGuideline(!0),Te.interactiveLayer.tooltip.contentGenerator((e=>(0,F.RO)(e,Re,Ge)))}else if("bullet"!==re){const e=I(p);Te.color((t=>t.color||e((0,F.gO)(t[De]),we)))}if(Ne(["line","area","bar","dist_bar"])&&oe&&(Te.useInteractiveGuideline(!0),"line"===re||"bar"===re?Te.interactiveLayer.tooltip.contentGenerator((e=>(0,F.Gx)(e,L.Z,Ge))):"dist_bar"===re?Te.interactiveLayer.tooltip.contentGenerator((e=>(0,F.yy)(e,Ge))):Te.interactiveLayer.tooltip.contentGenerator((e=>(0,F.n4)(e,L.Z,Ge,Te)))),Ne(["compare"])&&Te.interactiveLayer.tooltip.contentGenerator((e=>(0,F.yy)(e,Ge))),Ne(["dual_line","line_multi"])){const e=(0,k.JB)(de),t=(0,k.JB)(ye);Te.yAxis1.tickFormat(e),Te.yAxis2.tickFormat(t);const i=a.map((a=>1===a.yAxis?e:t));Te.useInteractiveGuideline(!0),Te.interactiveLayer.tooltip.contentGenerator((e=>(0,F.HO)(e,Re,i)))}Te.width(_e),Te.height($e),Me.datum(a).transition().duration(500).attr("height",$e).attr("width",_e).call(Te),Ae&&Te.yAxis.tickFormat((e=>0!==e&&Math.log10(e)%1==0?Ge(e):"")),Ee>0&&Me.select(".nv-x.nv-axis > g").selectAll("g").selectAll("text").attr("dx",-6.5);const Ie=()=>{if(Te.yDomain&&Array.isArray(xe)&&2===xe.length){const[e,t]=xe,i=(0,M.Z)(e)&&!Number.isNaN(e),s=(0,M.Z)(t)&&!Number.isNaN(t);if((i||s)&&"area"===re&&"expand"===Te.style())Te.yDomain([0,1]);else if((i||s)&&"area"===re&&"stream"===Te.style())Te.yDomain((0,F.po)(a));else if(i&&s)Te.yDomain([e,t]),Te.clipEdge(!0);else if(i||s){let[o,r]=[0,1];"area"===re||Ne(["bar","dist_bar"])&&Te.stacked()?[o,r]=(0,F.po)(a):[o,r]=(0,F.tH)(a);const n=i?e:o,l=s?t:r;Te.yDomain([n,l]),Te.clipEdge(!0)}}};if(Ie(),Te.dispatch&&Te.dispatch.stateChange&&Te.dispatch.on("stateChange.applyYAxisBounds",Ie),Ne(["dual_line","line_multi"])){const e=Te.yAxis1.ticks(),t=Te.yAxis1.scale().domain(Te.yAxis1.domain()).nice(e).ticks(e),a=Te.yAxis2.scale().domain(Te.yAxis2.domain()).nice(e).ticks(e),i=t.length-a.length;if(t.length>0&&a.length>0&&0!==i){const e=i<0?t:a,s=e[1]-e[0];for(let t=0;t<Math.abs(i);t+=1)t%2==0?e.unshift(e[0]-s):e.push(e[e.length-1]+s);Te.yDomain1([t[0],t[t.length-1]]),Te.yDomain2([a[0],a[a.length-1]]),Te.yAxis1.tickValues(t),Te.yAxis2.tickValues(a)}Te.yDomain1([xe[0]||t[0],xe[1]||t[t.length-1]]),Te.yDomain2([ge[0]||a[0],ge[1]||a[a.length-1]])}if(ie&&(Me.selectAll(".nv-point").style("stroke-opacity",1).style("fill-opacity",1),Te.dispatch.on("stateChange.showMarkers",(()=>{setTimeout((()=>{Me.selectAll(".nv-point").style("stroke-opacity",1).style("fill-opacity",1)}),10)}))),void 0!==Te.yAxis||void 0!==Te.yAxis2){const t=Math.ceil(Math.min(i*(Le?.01:.03),30)),s=Te.margin();Te.xAxis&&(s.bottom=28);const r=(0,F.GF)(Me,Te.yAxis2?"nv-y1":"nv-y"),n=(0,F.GF)(Me,"nv-x");if(s.left=r+t,be&&""!==be&&(s.left+=25),Y&&(s.top+=24),he&&(s.right=Math.max(20,n/2)+t),45===Ee?(s.bottom=n*Math.sin(Math.PI*Ee/180)+t+30,s.right=n*Math.cos(Math.PI*Ee/180)+t):Se&&(s.bottom=40),Ne(["dual_line","line_multi"])){const e=(0,F.GF)(Me,"nv-y2");s.right=e+t}if(m&&"auto"!==m&&(s.bottom=parseInt(m,10)),O&&"auto"!==O&&(s.left=O),ce&&""!==ce&&Te.xAxis){s.bottom+=25;let e=0;s.bottom&&!Number.isNaN(s.bottom)&&(e=s.bottom-45),Te.xAxis.axisLabel(ce).axisLabelDistance(e)}if(be&&""!==be&&Te.yAxis){let e=0;s.left&&!Number.isNaN(s.left)&&(e=s.left-70),Te.yAxis.axisLabel(be).axisLabelDistance(e)}if(Oe&&o&&Ce.length>0){const e=Ce.filter((e=>e.annotationType===T.ZP.TIME_SERIES)).reduce(((e,t)=>e.concat((o[t.name]||[]).map((e=>{if(!e)return{};const a=Array.isArray(e.key)?`${t.name}, ${e.key.join(", ")}`:`${t.name}, ${e.key}`;return{...e,key:a,color:t.color,strokeWidth:t.width,classed:`${t.opacity} ${t.style} nv-timeseries-annotation-layer showMarkers${t.showMarkers} hideLine${t.hideLine}`}})))),[]);a.push(...e)}if(Fe&&(Te&&Te.interactiveLayer&&Te.interactiveLayer.tooltip&&Te.interactiveLayer.tooltip.classes([(0,F.T7)(Fe)]),Te&&Te.tooltip&&Te.tooltip.classes([(0,F.T7)(Fe)])),Te.margin(s),Me.datum(a).transition().duration(500).attr("width",_e).attr("height",$e).call(Te),window.addEventListener("scroll",l()((()=>(0,F.Vl)(!1)),250)),Oe&&Ce.length>0){const t=Ce.filter((e=>e.annotationType===T.ZP.FORMULA));let i,s,r;if("bar"===re?(s=d().min(a[0].values,(e=>e.x)),i=d().max(a[0].values,(e=>e.x)),r=d().scale.quantile().domain([s,i]).range(Te.xAxis.range())):(s=Te.xAxis.scale().domain()[0].valueOf(),i=Te.xAxis.scale().domain()[1].valueOf(),r=Te.xScale?Te.xScale():Te.xAxis.scale?Te.xAxis.scale():d().scale.linear()),r&&r.clamp&&r.clamp(!0),t.length>0){const e=[];if("bar"===re){const t=a.reduce(((e,t)=>(t.values.forEach((t=>e.add(t.x))),e)),new Set);e.push(...t.values()),e.sort()}else{let t=Math.min(...a.map((e=>Math.min(...e.values.slice(1).map(((t,a)=>t.x-e.values[a].x))))));const o=(i-s)/(t||1);t=o<100?(i-s)/100:t,t=o>500?(i-s)/500:t,e.push(s);for(let a=s;a<i;a+=t)e.push(a);e.push(i)}const o=t.map((t=>{const{value:a}=t;return{key:t.name,values:e.map((e=>({x:e,y:(0,C.f)(a,e)}))),color:t.color,strokeWidth:t.width,classed:`${t.opacity} ${t.style}`}}));a.push(...o)}const n=Te.xAxis1?Te.xAxis1:Te.xAxis,l=Te.yAxis1?Te.yAxis1:Te.yAxis,c=n.scale().range()[1],h=l.scale().range()[0];o&&(Ce.filter((e=>e.annotationType===T.ZP.EVENT&&o&&o[e.name])).forEach(((t,a)=>{const i=(0,T.yb)(t),s=d().select(e).select(".nv-wrap").append("g").attr("class",`nv-event-annotation-layer-${a}`),n=i.color||G((0,F.gO)(i.name),p),l=(0,F.Gr)({...i,annotationTipClass:`arrow-down nv-event-annotation-layer-${t.sourceType}`}),m=(o[i.name].records||[]).map((e=>{const t=new Date(x().utc(e[i.timeColumn]));return{...e,[i.timeColumn]:t}})).filter((e=>!Number.isNaN(e[i.timeColumn].getMilliseconds())));m.length>0&&s.selectAll("line").data(m).enter().append("line").attr({x1:e=>r(new Date(e[i.timeColumn])),y1:0,x2:e=>r(new Date(e[i.timeColumn])),y2:h}).attr("class",`${i.opacity} ${i.style}`).style("stroke",n).style("stroke-width",i.width).on("mouseover",l.show).on("mouseout",l.hide).call(l),Te.focus&&Te.focus.dispatch.on("onBrush.event-annotation",(()=>{s.selectAll("line").data(m).attr({x1:e=>r(new Date(e[i.timeColumn])),y1:0,x2:e=>r(new Date(e[i.timeColumn])),y2:h,opacity:e=>{const t=r(new Date(e[i.timeColumn]));return t>0&&t<c?1:0}})}))})),Ce.filter((e=>e.annotationType===T.ZP.INTERVAL&&o&&o[e.name])).forEach(((t,a)=>{const i=(0,T.yb)(t),s=d().select(e).select(".nv-wrap").append("g").attr("class",`nv-interval-annotation-layer-${a}`),n=i.color||G((0,F.gO)(i.name),p),l=(0,F.Gr)(i),c=(o[i.name].records||[]).map((e=>{const t=new Date(x().utc(e[i.timeColumn])),a=new Date(x().utc(e[i.intervalEndColumn]));return{...e,[i.timeColumn]:t,[i.intervalEndColumn]:a}})).filter((e=>!Number.isNaN(e[i.timeColumn].getMilliseconds())&&!Number.isNaN(e[i.intervalEndColumn].getMilliseconds())));c.length>0&&s.selectAll("rect").data(c).enter().append("rect").attr({x:e=>Math.min(r(new Date(e[i.timeColumn])),r(new Date(e[i.intervalEndColumn]))),y:0,width:e=>Math.max(Math.abs(r(new Date(e[i.intervalEndColumn]))-r(new Date(e[i.timeColumn]))),1),height:h}).attr("class",`${i.opacity} ${i.style}`).style("stroke-width",i.width).style("stroke",n).style("fill",n).style("fill-opacity",.2).on("mouseover",l.show).on("mouseout",l.hide).call(l),Te.focus&&Te.focus.dispatch.on("onBrush.interval-annotation",(()=>{s.selectAll("rect").data(c).attr({x:e=>r(new Date(e[i.timeColumn])),width:e=>{const t=r(new Date(e[i.timeColumn]));return r(new Date(e[i.intervalEndColumn]))-t}})}))}))),Me.datum(a).attr("height",$e).attr("width",_e).call(Te),Te.dispatch.on("renderEnd.timeseries-annotation",(()=>{d().selectAll(".slice_container .nv-timeseries-annotation-layer.showMarkerstrue .nv-point").style("stroke-opacity",1).style("fill-opacity",1),d().selectAll(".slice_container .nv-timeseries-annotation-layer.hideLinetrue").style("stroke-width",0)}))}}return(0,F.Aw)(Te),Te}))}W.displayName="NVD3",W.propTypes=P;const H=W;var q=a(11965);const J=(0,i.Z)(H,{componentWillUnmount:function(){const{id:e}=this.props;null!=e?(0,F.o2)(e):(0,F.Vl)(!0)}}),j=e=>{let{className:t,...a}=e;return(0,q.tZ)("div",{className:t},(0,q.tZ)(J,a))};j.propTypes={className:r().string.isRequired};const X=(0,s.iK)(j)`
  .superset-legacy-chart-nvd3-dist-bar,
  .superset-legacy-chart-nvd3-bar {
    overflow-x: auto !important;
    svg {
      &.nvd3-svg {
        width: auto;
        font-size: ${e=>{let{theme:t}=e;return t.typography.sizes.m}};
      }
    }
  }
  .superset-legacy-chart-nvd3 {
    nv-x text {
      font-size: ${e=>{let{theme:t}=e;return t.typography.sizes.m}};
    }
    g.superset path {
      stroke-dasharray: 5, 5;
    }
    .nvtooltip tr.highlight td {
      font-weight: ${e=>{let{theme:t}=e;return t.typography.weights.bold}};
      font-size: ${e=>{let{theme:t}=e;return t.typography.sizes.m}}px !important;
    }
    text.nv-axislabel {
      font-size: ${e=>{let{theme:t}=e;return t.typography.sizes.m}} !important;
    }
    g.solid path,
    line.solid {
      stroke-dasharray: unset;
    }
    g.dashed path,
    line.dashed {
      stroke-dasharray: 5, 5;
    }
    g.longDashed path,
    line.dotted {
      stroke-dasharray: 1, 1;
    }

    g.opacityLow path,
    line.opacityLow {
      stroke-opacity: 0.2;
    }

    g.opacityMedium path,
    line.opacityMedium {
      stroke-opacity: 0.5;
    }
    g.opacityHigh path,
    line.opacityHigh {
      stroke-opacity: 0.8;
    }
    g.time-shift-0 path,
    line.time-shift-0 {
      stroke-dasharray: 5, 5;
    }
    g.time-shift-1 path,
    line.time-shift-1 {
      stroke-dasharray: 1, 5;
    }
    g.time-shift-2 path,
    line.time-shift-3 {
      stroke-dasharray: 5, 1;
    }
    g.time-shift-3 path,
    line.time-shift-3 {
      stroke-dasharray: 5, 1;
    }
    g.time-shift-4 path,
    line.time-shift-4 {
      stroke-dasharray: 5, 10;
    }
    g.time-shift-5 path,
    line.time-shift-5 {
      stroke-dasharray: 0.9;
    }
    g.time-shift-6 path,
    line.time-shift-6 {
      stroke-dasharray: 15, 10, 5;
    }
    g.time-shift-7 path,
    line.time-shift-7 {
      stroke-dasharray: 15, 10, 5, 10;
    }
    g.time-shift-8 path,
    line.time-shift-8 {
      stroke-dasharray: 15, 10, 5, 10, 15;
    }
    g.time-shift-9 path,
    line.time-shift-9 {
      stroke-dasharray: 5, 5, 1, 5;
    }
    .nv-noData.body {
      font-size: ${e=>{let{theme:t}=e;return t.typography.sizes.m}};
      font-weight: ${e=>{let{theme:t}=e;return t.typography.weights.normal}};
    }
  }
  .superset-legacy-chart-nvd3-tr-highlight {
    border-top: 1px solid;
    border-bottom: 1px solid;
    font-weight: ${e=>{let{theme:t}=e;return t.typography.weights.bold}};
  }
  .superset-legacy-chart-nvd3-tr-total {
    font-weight: ${e=>{let{theme:t}=e;return t.typography.weights.bold}};
  }
  .nvtooltip {
    .tooltip-header {
      white-space: nowrap;
      font-weight: ${e=>{let{theme:t}=e;return t.typography.weights.bold}};
    }
    tbody tr:not(.tooltip-header) td:nth-child(2) {
      word-break: break-word;
    }
  }
  .d3-tip.nv-event-annotation-layer-table,
  .d3-tip.nv-event-annotation-layer-NATIVE {
    width: 200px;
    border-radius: 2px;
    background-color: ${e=>{let{theme:t}=e;return t.colors.grayscale.base}};
    fill-opacity: 0.6;
    margin: ${e=>{let{theme:t}=e;return 2*t.gridUnit}}px;
    padding: ${e=>{let{theme:t}=e;return 2*t.gridUnit}}px;
    color: ${e=>{let{theme:t}=e;return t.colors.grayscale.light5}};
    &:after {
      content: '\\25BC';
      font-size: ${e=>{let{theme:t}=e;return t.typography.sizes.m}};
      color: ${e=>{let{theme:t}=e;return t.colors.grayscale.base}};
      position: absolute;
      bottom: -14px;
      left: 94px;
    }
  }
`},43323:(e,t,a)=>{a.d(t,{Z:()=>o});var i=a(67294),s=a(11965);function o(e,t){class a extends i.Component{constructor(e){super(e),this.container=void 0,this.setContainerRef=this.setContainerRef.bind(this)}componentDidMount(){this.execute()}componentDidUpdate(){this.execute()}componentWillUnmount(){this.container=void 0,null!=t&&t.componentWillUnmount&&t.componentWillUnmount.bind(this)()}setContainerRef(e){this.container=e}execute(){this.container&&e(this.container,this.props)}render(){const{id:e,className:t}=this.props;return(0,s.tZ)("div",{ref:this.setContainerRef,id:e,className:t})}}const o=a;return e.displayName&&(o.displayName=e.displayName),e.propTypes&&(o.propTypes={...o.propTypes,...e.propTypes}),e.defaultProps&&(o.defaultProps=e.defaultProps),a}}}]);
//# sourceMappingURL=5ab969bdb60236120b31.chunk.js.map
