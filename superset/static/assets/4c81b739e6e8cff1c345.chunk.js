"use strict";(globalThis.webpackChunksuperset=globalThis.webpackChunksuperset||[]).push([[2923],{32657:(t,e,n)=>{n.d(e,{Z:()=>ht});var r,a=n(28216),i=n(14890),o=n(52256),l=n(97381),s=n(5872),d=n.n(s),c=n(45697),u=n.n(c),h=n(67294),p=n(55867),m=n(51995),g=n(68492),v=n(55786),b=n(91877),f=n(93185),y=n(9531),Z=n(38703),x=n(94301),S=n(57902),C=n(3741),w=n(27600),T=n(23525),k=n(71894);!function(t){t.Explore="explore",t.Dashboard="dashboard"}(r||(r={}));var $=n(42190),D=n(18446),I=n.n(D),M=n(42933),_=n.n(M),F=n(16355),R=n(11064),E=n(88274),O=n(11965),A=n(78580),U=n.n(A),z=n(90731),N=n(12617),P=n(83862),L=n(4715),j=n(41814),q=n(69175),V=n(74599),B=n(15856);const H=(t,e)=>{var n,r;let{id:i,formData:o,onSelection:l,onClose:s}=t;const d=(0,m.Fg)(),c=(0,a.I0)(),u=(0,a.v9)((t=>{var e;return(0,N.R)("can_explore","Superset",null==(e=t.user)?void 0:e.roles)})),g=(0,a.v9)((t=>{let{dashboardInfo:e}=t;return e.crossFiltersEnabled})),[{filters:v,clientX:b,clientY:y},Z]=(0,h.useState)({clientX:0,clientY:0}),x=[],S=(0,f.c)(f.T.DRILL_TO_DETAIL)&&u,C=null==(n=(0,R.Z)().get(o.viz_type))||null==(r=n.behaviors)?void 0:U()(r).call(r,F.cg.INTERACTIVE_CHART);let w=0;if((0,f.c)(f.T.DASHBOARD_CROSS_FILTERS)&&(w+=1),S&&(w+=2),0===w&&(w=1),(0,f.c)(f.T.DASHBOARD_CROSS_FILTERS)){var T;const t=!C||!g||!(null!=v&&v.crossFilter);let e=null;t?g?C?null!=v&&v.crossFilter||(e=(0,O.tZ)(h.Fragment,null,(0,O.tZ)("div",null,(0,p.t)("You can't apply cross-filter on this data point.")))):e=(0,O.tZ)(h.Fragment,null,(0,O.tZ)("div",null,(0,p.t)("This visualization type does not support cross-filtering."))):e=(0,O.tZ)(h.Fragment,null,(0,O.tZ)("div",null,(0,p.t)("Cross-filtering is not enabled for this dashboard."))):e=(0,O.tZ)(h.Fragment,null,(0,O.tZ)("div",null,(0,p.t)("Cross-filter will be applied to all of the charts that use this dataset.")),(0,O.tZ)("div",null,(0,p.t)("You can also just click on the chart to apply cross-filter."))),x.push((0,O.tZ)(h.Fragment,null,(0,O.tZ)(P.v.Item,{key:"cross-filtering-menu-item",disabled:t,onClick:()=>{null!=v&&v.crossFilter&&c((0,V.eG)(i,v.crossFilter.dataMask))}},null!=v&&null!=(T=v.crossFilter)&&T.isCurrentValueSelected?(0,p.t)("Remove cross-filter"):(0,O.tZ)("div",null,(0,p.t)("Add cross-filter"),(0,O.tZ)(B.j,{title:e,color:t?void 0:d.colors.grayscale.base}))),w>1&&(0,O.tZ)(P.v.Divider,null)))}S&&x.push((0,O.tZ)(j.p,{chartId:i,formData:o,filters:null==v?void 0:v.drillToDetail,isContextMenu:!0,contextMenuY:y,onSelection:l}));const k=(0,h.useCallback)(((t,e,n)=>{var r;const a=(0,q.$)(e,w);Z({clientX:t,clientY:a,filters:n}),null==(r=document.getElementById(`hidden-span-${i}`))||r.click()}),[i,w]);return(0,h.useImperativeHandle)(e,(()=>({open:k})),[k]),z.createPortal((0,O.tZ)(L.Gj,{overlay:(0,O.tZ)(P.v,null,x.length?x:(0,O.tZ)(P.v.Item,{disabled:!0},"No actions")),trigger:["click"],onVisibleChange:t=>!t&&s()},(0,O.tZ)("span",{id:`hidden-span-${i}`,css:(0,O.iv)({visibility:"hidden",position:"fixed",top:y,left:b,width:1,height:1},"","")})),document.body)},K=(0,h.forwardRef)(H),W={annotationData:u().object,actions:u().object,chartId:u().number.isRequired,datasource:u().object,initialValues:u().object,formData:u().object.isRequired,latestQueryFormData:u().object,labelColors:u().object,sharedLabelColors:u().object,height:u().number,width:u().number,setControlValue:u().func,vizType:u().string.isRequired,triggerRender:u().bool,chartAlert:u().string,chartStatus:u().string,queriesResponse:u().arrayOf(u().object),triggerQuery:u().bool,chartIsStale:u().bool,addFilter:u().func,setDataMask:u().func,onFilterMenuOpen:u().func,onFilterMenuClose:u().func,ownState:u().object,postTransformProps:u().func,source:u().oneOf([r.Dashboard,r.Explore]),emitCrossFilters:u().bool},G={},Q=[F.cg.INTERACTIVE_CHART],Y={addFilter:()=>G,onFilterMenuOpen:()=>G,onFilterMenuClose:()=>G,initialValues:G,setControlValue(){},triggerRender:!1};class J extends h.Component{constructor(t){super(t),this.state={showContextMenu:t.source===r.Dashboard&&((0,f.c)(f.T.DRILL_TO_DETAIL)||(0,f.c)(f.T.DASHBOARD_CROSS_FILTERS)),inContextMenu:!1},this.hasQueryResponseChange=!1,this.contextMenuRef=h.createRef(),this.handleAddFilter=this.handleAddFilter.bind(this),this.handleRenderSuccess=this.handleRenderSuccess.bind(this),this.handleRenderFailure=this.handleRenderFailure.bind(this),this.handleSetControlValue=this.handleSetControlValue.bind(this),this.handleOnContextMenu=this.handleOnContextMenu.bind(this),this.handleContextMenuSelected=this.handleContextMenuSelected.bind(this),this.handleContextMenuClosed=this.handleContextMenuClosed.bind(this),this.onContextMenuFallback=this.onContextMenuFallback.bind(this),this.hooks={onAddFilter:this.handleAddFilter,onContextMenu:this.state.showContextMenu?this.handleOnContextMenu:void 0,onError:this.handleRenderFailure,setControlValue:this.handleSetControlValue,onFilterMenuOpen:this.props.onFilterMenuOpen,onFilterMenuClose:this.props.onFilterMenuClose,setDataMask:t=>{var e;null==(e=this.props.actions)||e.updateDataMask(this.props.chartId,t)}}}shouldComponentUpdate(t,e){var n,r;return!(!(t.queriesResponse&&["success","rendered"].indexOf(t.chartStatus)>-1)||null!=(n=t.queriesResponse)&&null!=(r=n[0])&&r.error)&&(!I()(this.state,e)||(this.hasQueryResponseChange=t.queriesResponse!==this.props.queriesResponse,this.hasQueryResponseChange||!I()(t.datasource,this.props.datasource)||t.annotationData!==this.props.annotationData||t.ownState!==this.props.ownState||t.filterState!==this.props.filterState||t.height!==this.props.height||t.width!==this.props.width||t.triggerRender||t.labelColors!==this.props.labelColors||t.sharedLabelColors!==this.props.sharedLabelColors||t.formData.color_scheme!==this.props.formData.color_scheme||t.formData.stack!==this.props.formData.stack||t.cacheBusterProp!==this.props.cacheBusterProp||t.emitCrossFilters!==this.props.emitCrossFilters))}handleAddFilter(t,e,n,r){void 0===n&&(n=!0),void 0===r&&(r=!0),this.props.addFilter(t,e,n,r)}handleRenderSuccess(){const{actions:t,chartStatus:e,chartId:n,vizType:r}=this.props;["loading","rendered"].indexOf(e)<0&&t.chartRenderingSucceeded(n),this.hasQueryResponseChange&&t.logEvent(C.aD,{slice_id:n,viz_type:r,start_offset:this.renderStartTime,ts:(new Date).getTime(),duration:C.Yd.getTimestamp()-this.renderStartTime})}handleRenderFailure(t,e){const{actions:n,chartId:r}=this.props;g.Z.warn(t),n.chartRenderingFailed(t.toString(),r,e?e.componentStack:null),this.hasQueryResponseChange&&n.logEvent(C.aD,{slice_id:r,has_err:!0,error_details:t.toString(),start_offset:this.renderStartTime,ts:(new Date).getTime(),duration:C.Yd.getTimestamp()-this.renderStartTime})}handleSetControlValue(){const{setControlValue:t}=this.props;t&&t(...arguments)}handleOnContextMenu(t,e,n){this.contextMenuRef.current.open(t,e,n),this.setState({inContextMenu:!0})}handleContextMenuSelected(){this.setState({inContextMenu:!1})}handleContextMenuClosed(){this.setState({inContextMenu:!1})}onContextMenuFallback(t){this.state.inContextMenu||(t.preventDefault(),this.handleOnContextMenu(t.clientX,t.clientY))}render(){var t;const{chartAlert:e,chartStatus:n,chartId:a,emitCrossFilters:i}=this.props;if("loading"===n||e||null===n)return null;this.renderStartTime=C.Yd.getTimestamp();const{width:o,height:l,datasource:s,annotationData:c,initialValues:u,ownState:m,filterState:g,chartIsStale:v,formData:b,latestQueryFormData:f,queriesResponse:y,postTransformProps:Z}=this.props,S=v&&f?f:b,w=S.viz_type||this.props.vizType,T=_()(w),k="table"===w?`superset-chart-${T}`:T;let $;const D=(0,p.t)("No results were returned for this query"),I=this.props.source===r.Explore?(0,p.t)("Make sure that the controls are configured properly and the datasource contains data for the selected time range"):void 0,M="chart.svg";$=o>300&&l>220?(0,O.tZ)(x.XJ,{title:D,description:I,image:M}):(0,O.tZ)(x.Tc,{title:D,image:M});const A=null!=(t=(0,R.Z)().get(b.viz_type))&&t.behaviors.find((t=>t===F.cg.DRILL_TO_DETAIL))?{inContextMenu:this.state.inContextMenu}:{};return(0,O.tZ)(h.Fragment,null,this.state.showContextMenu&&(0,O.tZ)(K,{ref:this.contextMenuRef,id:a,formData:S,onSelection:this.handleContextMenuSelected,onClose:this.handleContextMenuClosed}),(0,O.tZ)("div",{onContextMenu:this.state.showContextMenu?this.onContextMenuFallback:void 0},(0,O.tZ)(E.Z,d()({disableErrorBoundary:!0,key:`${a}`,id:`chart-id-${a}`,className:k,chartType:w,width:o,height:l,annotationData:c,datasource:s,initialValues:u,formData:S,ownState:m,filterState:g,hooks:this.hooks,behaviors:Q,queriesData:y,onRenderSuccess:this.handleRenderSuccess,onRenderFailure:this.handleRenderFailure,noResults:$,postTransformProps:Z,emitCrossFilters:i},A))))}}J.propTypes=W,J.defaultProps=Y;const X=J;var tt=n(42582),et=n(72875);const nt=t=>{let{chartId:e,error:n,...r}=t;const{result:a}=(0,tt.hb)(e),i=n&&{...n,extra:{...n.extra,owners:a}};return(0,O.tZ)(et.Z,d()({},r,{error:i}))};var rt=n(75701);const at={annotationData:u().object,actions:u().object,chartId:u().number.isRequired,datasource:u().object,dashboardId:u().number,initialValues:u().object,formData:u().object.isRequired,labelColors:u().object,sharedLabelColors:u().object,width:u().number,height:u().number,setControlValue:u().func,timeout:u().number,vizType:u().string.isRequired,triggerRender:u().bool,force:u().bool,isFiltersInitialized:u().bool,chartAlert:u().string,chartStatus:u().string,chartStackTrace:u().string,queriesResponse:u().arrayOf(u().object),triggerQuery:u().bool,chartIsStale:u().bool,errorMessage:u().node,addFilter:u().func,onQuery:u().func,onFilterMenuOpen:u().func,onFilterMenuClose:u().func,ownState:u().object,postTransformProps:u().func,datasetsStatus:u().oneOf(["loading","error","complete"]),isInView:u().bool,emitCrossFilters:u().bool},it={},ot=(0,p.t)("The dataset associated with this chart no longer exists"),lt={addFilter:()=>it,onFilterMenuOpen:()=>it,onFilterMenuClose:()=>it,initialValues:it,setControlValue(){},triggerRender:!1,dashboardId:null,chartStackTrace:null,force:!1,isInView:!0},st=m.iK.div`
  min-height: ${t=>t.height}px;
  position: relative;

  .chart-tooltip {
    opacity: 0.75;
    font-size: ${t=>{let{theme:e}=t;return e.typography.sizes.s}}px;
  }

  .slice_container {
    display: flex;
    flex-direction: column;
    justify-content: center;

    height: ${t=>t.height}px;

    .pivot_table tbody tr {
      font-feature-settings: 'tnum' 1;
    }

    .alert {
      margin: ${t=>{let{theme:e}=t;return 2*e.gridUnit}}px;
    }
  }
`,dt=m.iK.div`
  font-family: ${t=>{let{theme:e}=t;return e.typography.families.monospace}};
  word-break: break-word;
  overflow-x: auto;
  white-space: pre-wrap;
`;class ct extends h.PureComponent{constructor(t){super(t),this.handleRenderContainerFailure=this.handleRenderContainerFailure.bind(this)}componentDidMount(){this.props.triggerQuery&&this.runQuery()}componentDidUpdate(){this.props.triggerQuery&&this.runQuery()}runQuery(){this.props.chartId>0&&(0,b.cr)(f.T.CLIENT_CACHE)?this.props.actions.getSavedChart(this.props.formData,this.props.force||(0,T.eY)(w.KD.force),this.props.timeout,this.props.chartId,this.props.dashboardId,this.props.ownState):this.props.actions.postChartFormData(this.props.formData,this.props.force||(0,T.eY)(w.KD.force),this.props.timeout,this.props.chartId,this.props.dashboardId,this.props.ownState)}handleRenderContainerFailure(t,e){const{actions:n,chartId:r}=this.props;g.Z.warn(t),n.chartRenderingFailed(t.toString(),r,e?e.componentStack:null),n.logEvent(C.aD,{slice_id:r,has_err:!0,error_details:t.toString(),start_offset:this.renderStartTime,ts:(new Date).getTime(),duration:C.Yd.getTimestamp()-this.renderStartTime})}renderErrorMessage(t){var e;const{chartId:n,chartAlert:a,chartStackTrace:i,datasource:o,dashboardId:l,height:s,datasetsStatus:d}=this.props,c=null==t||null==(e=t.errors)?void 0:e[0],u=a||(null==t?void 0:t.message);return void 0!==a&&a!==ot&&o===y.tw&&d!==$.ni.ERROR?(0,O.tZ)(st,{key:n,"data-ui-anchor":"chart",className:"chart-container",height:s},(0,O.tZ)(Z.Z,null)):(0,O.tZ)(nt,{key:n,chartId:n,error:c,subtitle:(0,O.tZ)(dt,null,u),copyText:u,link:t?t.link:null,source:l?r.Dashboard:r.Explore,stackTrace:i})}render(){const{height:t,chartAlert:e,chartStatus:n,errorMessage:r,chartIsStale:a,queriesResponse:i=[],width:o}=this.props,l="loading"===n;return this.renderContainerStartTime=C.Yd.getTimestamp(),"failed"===n?i.map((t=>this.renderErrorMessage(t))):r&&0===(0,v.Z)(i).length?(0,O.tZ)(x.XJ,{title:(0,p.t)("Add required control values to preview chart"),description:(0,rt.J)(!0),image:"chart.svg"}):l||e||r||!a||0!==(0,v.Z)(i).length?(0,O.tZ)(S.Z,{onError:this.handleRenderContainerFailure,showMessage:!1},(0,O.tZ)(st,{"data-ui-anchor":"chart",className:"chart-container",height:t,width:o},(0,O.tZ)("div",{className:"slice_container"},this.props.isInView||!(0,b.cr)(f.T.DASHBOARD_VIRTUALIZATION)||(0,k.b)()?(0,O.tZ)(X,d()({},this.props,{source:this.props.dashboardId?"dashboard":"explore"})):(0,O.tZ)(Z.Z,null)),l&&(0,O.tZ)(Z.Z,null))):(0,O.tZ)(x.XJ,{title:(0,p.t)("Your chart is ready to go!"),description:(0,O.tZ)("span",null,(0,p.t)('Click on "Create chart" button in the control panel on the left to preview a visualization or')," ",(0,O.tZ)("span",{role:"button",tabIndex:0,onClick:this.props.onQuery},(0,p.t)("click here")),"."),image:"chart.svg"})}}ct.propTypes=at,ct.defaultProps=lt;const ut=ct,ht=(0,a.$j)(null,(function(t){return{actions:(0,i.DE)({...o,updateDataMask:V.eG,logEvent:l.logEvent},t)}}))(ut)},96022:(t,e,n)=>{n.d(e,{ZN:()=>B,gT:()=>K});var r=n(78580),a=n.n(r),i=n(67294),o=n(28216),l=n(51995),s=n(11965),d=n(55867),c=n(70163),u=n(83862),h=n(1304),p=n(35932),m=n(14114),g=n(12515),v=n(56727),b=n(23525),f=n(10222),y=n(97634),Z=n(91877),x=n(93185),S=n(15423),C=n(9875),w=n(13433),T=n(27600),k=n(50909);const $=(0,l.iK)(k.qi)`
  && {
    margin: 0 0 ${t=>{let{theme:e}=t;return e.gridUnit}}px;
  }
`,D=t=>{let{formData:e,addDangerToast:n}=t;const[r,a]=(0,i.useState)("400"),[o,l]=(0,i.useState)("600"),[c,u]=(0,i.useState)(""),[h,p]=(0,i.useState)(""),m=(0,i.useCallback)((t=>{const{value:e,name:n}=t.currentTarget;"width"===n&&l(e),"height"===n&&a(e)}),[]),g=(0,i.useCallback)((()=>{u(""),(0,b.YE)(e).then((t=>{u(t),p("")})).catch((()=>{p((0,d.t)("Error")),n((0,d.t)("Sorry, something went wrong. Try again later."))}))}),[n,e]);(0,i.useEffect)((()=>{g()}),[]);const v=(0,i.useMemo)((()=>{if(!c)return"";const t=`${c}?${T.KD.standalone.name}=1&height=${r}`;return`<iframe\n  width="${o}"\n  height="${r}"\n  seamless\n  frameBorder="0"\n  scrolling="no"\n  src="${t}"\n>\n</iframe>`}),[r,c,o]),f=h||v||(0,d.t)("Generating link, please wait..");return(0,s.tZ)("div",{id:"embed-code-popover"},(0,s.tZ)("div",{css:s.iv`
          display: flex;
          flex-direction: column;
        `},(0,s.tZ)(w.Z,{shouldShowText:!1,text:v,copyNode:(0,s.tZ)($,{buttonSize:"xsmall"},(0,s.tZ)("i",{className:"fa fa-clipboard"}))}),(0,s.tZ)(C.Kx,{name:"embedCode",disabled:!v,value:f,rows:"4",readOnly:!0,css:t=>s.iv`
            resize: vertical;
            padding: ${2*t.gridUnit}px;
            font-size: ${t.typography.sizes.s}px;
            border-radius: 4px;
            background-color: ${t.colors.secondary.light5};
          `})),(0,s.tZ)("div",{css:t=>s.iv`
          display: flex;
          margin-top: ${4*t.gridUnit}px;
          & > div {
            margin-right: ${2*t.gridUnit}px;
          }
          & > div:last-of-type {
            margin-right: 0;
            margin-left: ${2*t.gridUnit}px;
          }
        `},(0,s.tZ)("div",null,(0,s.tZ)("label",{htmlFor:"embed-height"},(0,d.t)("Chart height")),(0,s.tZ)(C.II,{type:"text",defaultValue:r,name:"height",onChange:m})),(0,s.tZ)("div",null,(0,s.tZ)("label",{htmlFor:"embed-width"},(0,d.t)("Chart width")),(0,s.tZ)(C.II,{type:"text",defaultValue:o,name:"width",onChange:m,id:"embed-width"}))))};var I=n(5872),M=n.n(I),_=n(73727);const F=t=>{let{chartId:e,dashboards:n=[],...r}=t;const o=(0,l.Fg)(),[h,p]=(0,i.useState)(),[m,g]=(0,i.useState)(),v=n.length>10,b=n.filter((t=>{var e;return!h||a()(e=t.dashboard_title.toLowerCase()).call(e,h.toLowerCase())})),f=0===n.length,y=h&&0===b.length,Z=e?`?focused_chart=${e}`:"";return(0,s.tZ)(i.Fragment,null,v&&(0,s.tZ)(C.II,{allowClear:!0,placeholder:(0,d.t)("Search"),prefix:(0,s.tZ)(c.Z.Search,{iconSize:"l"}),css:s.iv`
            width: ${220}px;
            margin: ${2*o.gridUnit}px ${3*o.gridUnit}px;
          `,value:h,onChange:t=>p(t.currentTarget.value)}),(0,s.tZ)("div",{css:s.iv`
          max-height: ${300}px;
          overflow: auto;
        `},b.map((t=>(0,s.tZ)(u.v.Item,M()({key:String(t.id),onMouseEnter:()=>g(t.id),onMouseLeave:()=>{m===t.id&&g(null)}},r),(0,s.tZ)(_.rU,{target:"_blank",rel:"noreferer noopener",to:`/superset/dashboard/${t.id}${Z}`},(0,s.tZ)("div",{css:s.iv`
                  display: flex;
                  flex-direction: row;
                  align-items: center;
                  max-width: ${220}px;
                `},(0,s.tZ)("div",{css:s.iv`
                    white-space: normal;
                  `},t.dashboard_title),(0,s.tZ)(c.Z.Full,{iconSize:"l",iconColor:o.colors.grayscale.base,css:s.iv`
                    margin-left: ${2*o.gridUnit}px;
                    visibility: ${m===t.id?"visible":"hidden"};
                  `})))))),y&&(0,s.tZ)("div",{css:s.iv`
              margin-left: ${3*o.gridUnit}px;
              margin-bottom: ${o.gridUnit}px;
            `},(0,d.t)("No results found")),f&&(0,s.tZ)(u.v.Item,M()({disabled:!0,css:s.iv`
              min-width: ${220}px;
            `},r),(0,d.t)("None"))))},R="edit_properties",E="export_to_csv",O="export_to_csv_pivoted",A="export_to_json",U="export_to_xlsx",z="download_as_image",N="copy_permalink",P="embed_code",L="share_by_email",j="view_query",q="run_in_sql_lab",V=["pivot_table","pivot_table_v2"],B=l.iK.div`
  ${t=>{let{theme:e}=t;return s.iv`
    display: flex;
    align-items: center;

    & svg {
      width: ${3*e.gridUnit}px;
      height: ${3*e.gridUnit}px;
    }

    & span[role='checkbox'] {
      display: inline-flex;
      margin-right: ${e.gridUnit}px;
    }
  `}}
`,H=((0,l.iK)(p.Z)`
  ${t=>{let{theme:e}=t;return s.iv`
    width: ${8*e.gridUnit}px;
    height: ${8*e.gridUnit}px;
    padding: 0;
    border: 1px solid ${e.colors.primary.dark2};

    &.ant-btn > span.anticon {
      line-height: 0;
      transition: inherit;
    }

    &:hover:not(:focus) > span.anticon {
      color: ${e.colors.primary.light1};
    }
  `}}
`,s.iv`
  .ant-dropdown-menu-item > & > .anticon:first-child {
    margin-right: 0;
    vertical-align: 0;
  }
`),K=(t,e,n,r,p,C,w)=>{const T=(0,l.Fg)(),{addDangerToast:k,addSuccessToast:$}=(0,m.e1)(),[I,M]=(0,i.useState)(null),[_,B]=(0,i.useState)(!1),[K,W]=(0,i.useState)([]),G=(0,o.v9)((t=>{var e;return null==(e=t.charts)?void 0:e[(0,g.Jp)(t.explore)]})),{datasource:Q}=t,Y=(0,i.useCallback)((async()=>{try{const e=(0,d.t)("Superset Chart"),n=await(0,b.YE)(t),r=encodeURIComponent((0,d.t)("%s%s","Check out this chart: ",n));window.location.href=`mailto:?Subject=${e}%20&Body=${r}`}catch(t){k((0,d.t)("Sorry, something went wrong. Try again later."))}}),[k,t]),J=(0,i.useCallback)((()=>e?(0,g.pe)({formData:t,ownState:C,resultType:"full",resultFormat:"csv"}):null),[e,t]),X=(0,i.useCallback)((()=>e?(0,g.pe)({formData:t,resultType:"post_processed",resultFormat:"csv"}):null),[e,t]),tt=(0,i.useCallback)((()=>(0,g.pe)({formData:t,resultType:"results",resultFormat:"json"})),[t]),et=(0,i.useCallback)((()=>(0,g.pe)({formData:t,resultType:"results",resultFormat:"xlsx"})),[t]),nt=(0,i.useCallback)((async()=>{try{if(!t)throw new Error;await(0,f.Z)((()=>(0,b.YE)(t))),$((0,d.t)("Copied to clipboard!"))}catch(t){k((0,d.t)("Sorry, something went wrong. Try again later."))}}),[k,$,t]),rt=(0,i.useCallback)((e=>{var a;let{key:i,domEvent:o}=e;switch(i){case R:p(),B(!1);break;case E:J(),B(!1),W([]);break;case O:X(),B(!1),W([]);break;case A:tt(),B(!1),W([]);break;case U:et(),B(!1),W([]);break;case z:(0,v.Z)(".panel-body .chart-container",null!=(a=null==n?void 0:n.slice_name)?a:(0,d.t)("New chart"),!0)(o),B(!1),W([]);break;case N:nt(),B(!1),W([]);break;case P:B(!1),W([]);break;case L:Y(),B(!1),W([]);break;case j:B(!1);break;case q:r(t),B(!1)}}),[nt,J,X,tt,t,r,p,Y,null==n?void 0:n.slice_name]);return[(0,i.useMemo)((()=>(0,s.tZ)(u.v,{onClick:rt,selectable:!1,openKeys:K,onOpenChange:W},(0,s.tZ)(i.Fragment,null,n&&(0,s.tZ)(u.v.Item,{key:R},(0,d.t)("Edit chart properties")),(0,s.tZ)(u.v.SubMenu,{title:(0,d.t)("Dashboards added to"),key:"dashboards_added_to"},(0,s.tZ)(F,{chartId:null==n?void 0:n.slice_id,dashboards:w})),(0,s.tZ)(u.v.Divider,null)),(0,s.tZ)(u.v.SubMenu,{title:(0,d.t)("Download"),key:"download_submenu"},a()(V).call(V,t.viz_type)?(0,s.tZ)(i.Fragment,null,(0,s.tZ)(u.v.Item,{key:E,icon:(0,s.tZ)(c.Z.FileOutlined,{css:H}),disabled:!e},(0,d.t)("Export to original .CSV")),(0,s.tZ)(u.v.Item,{key:O,icon:(0,s.tZ)(c.Z.FileOutlined,{css:H}),disabled:!e},(0,d.t)("Export to pivoted .CSV"))):(0,s.tZ)(u.v.Item,{key:E,icon:(0,s.tZ)(c.Z.FileOutlined,{css:H}),disabled:!e},(0,d.t)("Export to .CSV")),(0,s.tZ)(u.v.Item,{key:A,icon:(0,s.tZ)(c.Z.FileOutlined,{css:H})},(0,d.t)("Export to .JSON")),(0,s.tZ)(u.v.Item,{key:z,icon:(0,s.tZ)(c.Z.FileImageOutlined,{css:H})},(0,d.t)("Download as image")),(0,s.tZ)(u.v.Item,{key:U,icon:(0,s.tZ)(c.Z.FileOutlined,{css:H})},(0,d.t)("Export to Excel"))),(0,s.tZ)(u.v.SubMenu,{title:(0,d.t)("Share"),key:"share_submenu"},(0,s.tZ)(u.v.Item,{key:N},(0,d.t)("Copy permalink to clipboard")),(0,s.tZ)(u.v.Item,{key:L},(0,d.t)("Share chart by email")),(0,Z.cr)(x.T.EMBEDDABLE_CHARTS)?(0,s.tZ)(u.v.Item,{key:P},(0,s.tZ)(h.Z,{triggerNode:(0,s.tZ)("span",null,(0,d.t)("Embed code")),modalTitle:(0,d.t)("Embed code"),modalBody:(0,s.tZ)(D,{formData:t,addDangerToast:k}),maxWidth:100*T.gridUnit+"px",destroyOnClose:!0,responsive:!0})):null),(0,s.tZ)(u.v.Divider,null),I?(0,s.tZ)(i.Fragment,null,(0,s.tZ)(u.v.SubMenu,{title:(0,d.t)("Manage email report")},(0,s.tZ)(y.Z,{chart:G,setShowReportSubMenu:M,showReportSubMenu:I,setIsDropdownVisible:B,isDropdownVisible:_,useTextMenu:!0})),(0,s.tZ)(u.v.Divider,null)):(0,s.tZ)(u.v,null,(0,s.tZ)(y.Z,{chart:G,setShowReportSubMenu:M,setIsDropdownVisible:B,isDropdownVisible:_,useTextMenu:!0})),(0,s.tZ)(u.v.Item,{key:j},(0,s.tZ)(h.Z,{triggerNode:(0,s.tZ)("span",null,(0,d.t)("View query")),modalTitle:(0,d.t)("View query"),modalBody:(0,s.tZ)(S.Z,{latestQueryFormData:t}),draggable:!0,resizable:!0,responsive:!0})),Q&&(0,s.tZ)(u.v.Item,{key:q},(0,d.t)("Run in SQL Lab")))),[k,e,G,w,rt,_,t,K,I,n,T.gridUnit]),_,B]}},15856:(t,e,n)=>{n.d(e,{j:()=>o}),n(67294);var r=n(11965),a=n(70163),i=n(58593);const o=t=>{let{title:e,color:n}=t;return(0,r.tZ)(i.u,{title:e,placement:"top"},(0,r.tZ)(a.Z.InfoCircleOutlined,{css:t=>r.iv`
        color: ${n||t.colors.text.label};
        margin-left: ${2*t.gridUnit}px;
        &.anticon {
          font-size: unset;
          .anticon {
            line-height: unset;
            vertical-align: unset;
          }
        }
      `}))}},41814:(t,e,n)=>{n.d(e,{p:()=>it});var r=n(5872),a=n.n(r),i=n(41609),o=n.n(i),l=n(67294),s=n(55867),d=n(11965),c=n(51995),u=n(11064),h=n(16355),p=n(69363),m=n(83862),g=n(16550),v=n(74069),b=n(35932),f=n(28216),y=n(25619),Z=n(88889),x=n(55786),S=n(99612),C=n(38703),w=n(27600);const T=function(t){let{value:e}=t;return(0,d.tZ)("span",null,e?w.Ly:w.gz)},k=function(){return(0,d.tZ)("span",{css:t=>d.iv`
          color: ${t.colors.grayscale.light1};
        `},w.Wq)};var $=n(42846),D=n(51115);const I=function(t){let{format:e=$.Z.DATABASE_DATETIME,value:n}=t;return n?(0,d.tZ)("span",null,(0,D.bt)(e).format(n)):(0,d.tZ)(k,null)};var M=n(94301),_=n(52256),F=n(93197),R=n(59507),E=n(29487),O=n(42582),A=n(87183),U=n(4715),z=n(70163),N=n(76697);const P=function(t){const{headerTitle:e,groupTitle:n,groupOptions:r,value:a,onChange:i}=t,o=(0,c.Fg)(),[s,u]=(0,l.useState)(!1);return(0,d.tZ)("div",{css:d.iv`
        display: flex;
        align-items: center;
      `},(0,d.tZ)(N.ZP,{trigger:"click",visible:s,content:(0,d.tZ)("div",null,(0,d.tZ)("div",{css:d.iv`
                font-weight: ${o.typography.weights.bold};
                margin-bottom: ${o.gridUnit}px;
              `},n),(0,d.tZ)(A.Y.Group,{value:a,onChange:t=>{i(t.target.value),u(!1)}},(0,d.tZ)(U.T,{direction:"vertical"},r.map((t=>(0,d.tZ)(A.Y,{key:t.value,value:t.value},t.label)))))),placement:"bottomLeft",arrowPointAtCenter:!0},(0,d.tZ)(z.Z.SettingOutlined,{iconSize:"m",iconColor:o.colors.grayscale.light1,css:d.iv`
            margin-top: 3px; // we need exactly 3px to align the icon
            margin-right: ${o.gridUnit}px;
          `,onClick:()=>u(!0)})),e)};var L=n(60331),j=n(72813),q=n(89555);function V(t){let{filters:e,setFilters:n,totalCount:r,loading:a,onReload:i}=t;const o=(0,c.Fg)(),u=(0,l.useMemo)((()=>Object.assign({},...e.map((t=>({[(0,j.GA)(t.col)?t.col.label:t.col]:t}))))),[e]),h=(0,l.useCallback)((t=>{const e={...u};delete e[t],n([...Object.values(e)])}),[u,n]),p=(0,l.useMemo)((()=>Object.entries(u).map((t=>{let[e,{val:n,formattedVal:r}]=t;return{colName:e,val:null!=r?r:n}})).sort(((t,e)=>t.colName.localeCompare(e.colName)))),[u]);return(0,d.tZ)("div",{css:d.iv`
        display: flex;
        justify-content: space-between;
        padding: ${o.gridUnit/2}px 0;
        margin-bottom: ${2*o.gridUnit}px;
      `},(0,d.tZ)("div",{css:d.iv`
          display: flex;
          flex-wrap: wrap;
          margin-bottom: -${4*o.gridUnit}px;
        `},p.map((t=>{let{colName:e,val:n}=t;return(0,d.tZ)(L.Z,{closable:!0,onClose:h.bind(null,e),key:e,css:d.iv`
              height: ${6*o.gridUnit}px;
              display: flex;
              align-items: center;
              padding: ${o.gridUnit/2}px ${2*o.gridUnit}px;
              margin-right: ${4*o.gridUnit}px;
              margin-bottom: ${4*o.gridUnit}px;
              line-height: 1.2;
            `},(0,d.tZ)("span",{css:d.iv`
                margin-right: ${o.gridUnit}px;
              `},e),(0,d.tZ)("strong",null,n))}))),(0,d.tZ)("div",{css:d.iv`
          display: flex;
          align-items: center;
          height: min-content;
        `},(0,d.tZ)(q.Z,{loading:a&&!r,rowcount:r}),(0,d.tZ)(z.Z.ReloadOutlined,{iconColor:o.colors.grayscale.light1,iconSize:"l","aria-label":(0,s.t)("Reload"),role:"button",onClick:i})))}var B,H=n(57557),K=n.n(H),W=n(65946),G={name:"82a6rk",styles:"flex:1"};function Q(t){let{children:e}=t;const{ref:n,height:r}=(0,S.NB)();return(0,d.tZ)("div",{ref:n,css:G},l.cloneElement(e,{height:r}))}function Y(t){let{formData:e,initialFilters:n}=t;const r=(0,c.Fg)(),[a,i]=(0,l.useState)(0),o=(0,l.useRef)(a),[u,h]=(0,l.useState)(n),[p,m]=(0,l.useState)(!1),[g,v]=(0,l.useState)(""),[b,y]=(0,l.useState)(new Map),[S,w]=(0,l.useState)({}),$=(0,f.v9)((t=>t.common.conf.SAMPLES_ROW_LIMIT)),[D,A]=(0,l.useMemo)((()=>e.datasource.split("__")),[e.datasource]),U=(0,l.useMemo)((()=>{const t=b.get(a);return t?(o.current=a,t):b.get(o.current)}),[a,b]),z=(0,l.useMemo)((()=>(null==U?void 0:U.colNames.map(((t,e)=>({key:t,dataIndex:t,title:(null==U?void 0:U.colTypes[e])===Z.Z.TEMPORAL?(0,d.tZ)(P,{headerTitle:t,groupTitle:(0,s.t)("Formatting"),groupOptions:[{label:(0,s.t)("Original value"),value:B.Original},{label:(0,s.t)("Formatted value"),value:B.Formatted}],value:S[t]===B.Original?B.Original:B.Formatted,onChange:e=>w((n=>({...n,[t]:e})))}):t,render:n=>!0===n||!1===n?(0,d.tZ)(T,{value:n}):null===n?(0,d.tZ)(k,null):(null==U?void 0:U.colTypes[e])===Z.Z.TEMPORAL&&S[t]!==B.Original&&("number"==typeof n||n instanceof Date)?(0,d.tZ)(I,{value:n}):String(n),width:150}))))||[]),[null==U?void 0:U.colNames,null==U?void 0:U.colTypes,S]),N=(0,l.useMemo)((()=>(null==U?void 0:U.data.map(((t,e)=>null==U?void 0:U.colNames.reduce(((e,n)=>({...e,[n]:t[n]})),{key:e}))))||[]),[null==U?void 0:U.colNames,null==U?void 0:U.data]),L=(0,l.useCallback)((()=>{v(""),y(new Map),i(0)}),[]);(0,l.useEffect)((()=>{v(""),y(new Map),i(0)}),[u]),(0,l.useEffect)((()=>{if(b.has(a)&&[...b.keys()].at(-1)!==a){const t=new Map(b);t.delete(a),y(t.set(a,b.get(a)))}}),[a,b]),(0,l.useEffect)((()=>{if(!g&&!p&&!b.has(a)){var t;m(!0);const n=null!=(t=function(t,e){if(!t)return;const n=(0,W.Z)(t),r=K()(n.extras,"having"),a=[...(0,x.Z)(n.filters),...(0,x.Z)(e).map((t=>K()(t,"formattedVal")))];return{granularity:n.granularity,time_range:n.time_range,filters:a,extras:r}}(e,u))?t:{},r=Math.ceil($/50);(0,_.getDatasourceSamples)(A,D,!1,n,50,a+1).then((t=>{y(new Map([...[...b.entries()].slice(1-r),[a,{total:t.total_count,data:t.data,colNames:(0,x.Z)(t.colnames),colTypes:(0,x.Z)(t.coltypes)}]])),v("")})).catch((t=>{v(`${t.name}: ${t.message}`)})).finally((()=>{m(!1)}))}}),[$,D,A,u,e,p,a,g,b]);const j=(0,O.s_)(`/api/v1/dataset/${D}`),q=!g&&!b.size||"loading"===j.status;let H=null;if(g)H=(0,d.tZ)("pre",{css:d.iv`
          margin-top: ${4*r.gridUnit}px;
        `},g);else if(q)H=(0,d.tZ)(C.Z,null);else if(0===(null==U?void 0:U.total)){const t=(0,s.t)("No rows were returned for this dataset");H=(0,d.tZ)(M.x3,{image:"document.svg",title:t})}else H=(0,d.tZ)(Q,null,(0,d.tZ)(F.ZP,{data:N,columns:z,size:F.ex.SMALL,defaultPageSize:50,recordCount:null==U?void 0:U.total,usePagination:!0,loading:p,onChange:t=>i(t.current?t.current-1:0),resizable:!0,virtualize:!0}));const G=(0,l.useMemo)((()=>{const{status:t,result:e}=j,n=[];if(e){var a,i;const{changed_on_humanized:t,created_on_humanized:r,description:o,table_name:l,changed_by:d,created_by:c,owners:u}=e,h=(0,s.t)("Not available"),p=`${null!=(a=null==c?void 0:c.first_name)?a:""} ${null!=(i=null==c?void 0:c.last_name)?i:""}`.trim()||h,m=d?`${d.first_name} ${d.last_name}`:h,g=u.length>0?u.map((t=>`${t.first_name} ${t.last_name}`)):[h];n.push({type:R.pG.TABLE,title:l}),n.push({type:R.pG.LAST_MODIFIED,value:t,modifiedBy:m}),n.push({type:R.pG.OWNER,createdBy:p,owners:g,createdOn:r}),o&&n.push({type:R.pG.DESCRIPTION,value:o})}return(0,d.tZ)("div",{css:d.iv`
          display: flex;
          margin-bottom: ${4*r.gridUnit}px;
        `},"complete"===t&&(0,d.tZ)(R.ZP,{items:n,tooltipPlacement:"bottom"}),"error"===t&&(0,d.tZ)(E.Z,{type:"error",message:(0,s.t)("There was an error loading the dataset metadata")}))}),[j,r.gridUnit]);return(0,d.tZ)(l.Fragment,null,!q&&G,!q&&(0,d.tZ)(V,{filters:u,setFilters:h,totalCount:null==U?void 0:U.total,loading:p,onReload:L}),H)}!function(t){t[t.Original=0]="Original",t[t.Formatted=1]="Formatted"}(B||(B={}));const J=t=>{let{exploreChart:e,closeModal:n}=t;return(0,d.tZ)(l.Fragment,null,(0,d.tZ)(b.Z,{buttonStyle:"secondary",buttonSize:"small",onClick:e},(0,s.t)("Edit chart")),(0,d.tZ)(b.Z,{buttonStyle:"primary",buttonSize:"small",onClick:n},(0,s.t)("Close")))};function X(t){let{chartId:e,formData:n,initialFilters:r,showModal:a,onHideModal:i}=t;const o=(0,c.Fg)(),u=(0,g.k6)(),h=(0,l.useContext)(y.DashboardPageIdContext),{slice_name:p}=(0,f.v9)((t=>t.sliceEntities.slices[e])),m=(0,l.useMemo)((()=>`/explore/?dashboard_page_id=${h}&slice_id=${e}`),[e,h]),b=(0,l.useCallback)((()=>{u.push(m)}),[m,u]);return(0,d.tZ)(v.Z,{show:a,onHide:null!=i?i:()=>null,css:d.iv`
        .ant-modal-body {
          display: flex;
          flex-direction: column;
        }
      `,title:(0,s.t)("Drill to detail: %s",p),footer:(0,d.tZ)(J,{exploreChart:b}),responsive:!0,resizable:!0,resizableConfig:{minHeight:128*o.gridUnit,minWidth:128*o.gridUnit,defaultSize:{width:"auto",height:"75vh"}},draggable:!0,destroyOnClose:!0,maskClosable:!1},(0,d.tZ)(Y,{formData:n,initialFilters:r}))}var tt=n(69175),et=n(15856);const nt=(0,s.t)("Drill to detail by"),rt=t=>{let{children:e,...n}=t;return(0,d.tZ)(m.v.Item,a()({disabled:!0},n),(0,d.tZ)("div",{css:d.iv`
        white-space: normal;
        max-width: 160px;
      `},e))},at=c.iK.span`
  ${t=>{let{theme:e}=t;return`\n     font-weight: ${e.typography.weights.bold};\n     color: ${e.colors.primary.base};\n   `}}
`,it=t=>{let{chartId:e,formData:n,filters:r=[],isContextMenu:i=!1,contextMenuY:c=0,onSelection:g=(()=>null),onClick:v=(()=>null),...b}=t;const[f,y]=(0,l.useState)([]),[Z,x]=(0,l.useState)(!1),S=(0,l.useCallback)(((t,e)=>{v(e),g(),y(t),x(!0)}),[v,g]),C=(0,l.useCallback)((()=>{x(!1)}),[]),w=(0,l.useMemo)((()=>{var t;return null==(t=(0,u.Z)().get(n.viz_type))?void 0:t.behaviors.find((t=>t===h.cg.DRILL_TO_DETAIL))}),[n.viz_type]),T=(0,l.useMemo)((()=>{const{metrics:t}=(0,p.Z)(n);return o()(t)}),[n]);let k,$;k=w&&T?(0,d.tZ)(rt,a()({},b,{key:"drill-detail-no-aggregations"}),(0,s.t)("Drill to detail"),(0,d.tZ)(et.j,{title:(0,s.t)("Drill to detail is disabled because this chart does not group data by dimension value.")})):(0,d.tZ)(m.v.Item,a()({},b,{key:"drill-detail-no-filters",onClick:S.bind(null,[])}),(0,s.t)("Drill to detail")),w||($=(0,d.tZ)(rt,a()({},b,{key:"drill-detail-by-chart-not-supported"}),nt,(0,d.tZ)(et.j,{title:(0,s.t)("Drill to detail by value is not yet supported for this chart type.")}))),w&&T&&($=(0,d.tZ)(rt,a()({},b,{key:"drill-detail-by-no-aggregations"}),nt));const D=(0,l.useMemo)((()=>{const t=r.length>1?r.length+1:r.length,e=c+4+tt.x+4;return(0,tt.$)(e,t)-e}),[c,r.length]);return w&&!T&&null!=r&&r.length&&($=(0,d.tZ)(m.v.SubMenu,a()({},b,{popupOffset:[0,D],title:nt}),(0,d.tZ)("div",null,r.map(((t,e)=>(0,d.tZ)(m.v.Item,a()({},b,{key:`drill-detail-filter-${e}`,onClick:S.bind(null,[t])}),`${nt} `,(0,d.tZ)(at,null,t.formattedVal)))),r.length>1&&(0,d.tZ)(m.v.Item,a()({},b,{key:"drill-detail-filter-all",onClick:S.bind(null,r)}),`${nt} `,(0,d.tZ)(at,null,(0,s.t)("all")))))),!w||T||null!=r&&r.length||($=(0,d.tZ)(rt,a()({},b,{key:"drill-detail-by-select-aggregation"}),nt,(0,d.tZ)(et.j,{title:(0,s.t)("Right-click on a dimension value to drill to detail by that value.")}))),(0,d.tZ)(l.Fragment,null,k,i&&$,(0,d.tZ)(X,{chartId:e,formData:n,initialFilters:f,showModal:Z,onHideModal:C}))}},69175:(t,e,n)=>{n.d(e,{x:()=>r,$:()=>a});const r=32;function a(t,e){const n=Math.max(document.documentElement.clientHeight||0,window.innerHeight||0),a=r*e+32;return n-t<a?n-a:t}},9433:(t,e,n)=>{n.d(e,{CronPicker:()=>u});var r=n(5872),a=n.n(r),i=(n(67294),n(70338)),o=n(55867),l=n(51995),s=n(61247),d=n(11965);const c={everyText:(0,o.t)("every"),emptyMonths:(0,o.t)("every month"),emptyMonthDays:(0,o.t)("every day of the month"),emptyMonthDaysShort:(0,o.t)("day of the month"),emptyWeekDays:(0,o.t)("every day of the week"),emptyWeekDaysShort:(0,o.t)("day of the week"),emptyHours:(0,o.t)("every hour"),emptyMinutes:(0,o.t)("every minute"),emptyMinutesForHourPeriod:(0,o.t)("every"),yearOption:(0,o.t)("year"),monthOption:(0,o.t)("month"),weekOption:(0,o.t)("week"),dayOption:(0,o.t)("day"),hourOption:(0,o.t)("hour"),minuteOption:(0,o.t)("minute"),rebootOption:(0,o.t)("reboot"),prefixPeriod:(0,o.t)("Every"),prefixMonths:(0,o.t)("in"),prefixMonthDays:(0,o.t)("on"),prefixWeekDays:(0,o.t)("on"),prefixWeekDaysForMonthAndYearPeriod:(0,o.t)("and"),prefixHours:(0,o.t)("at"),prefixMinutes:(0,o.t)(":"),prefixMinutesForHourPeriod:(0,o.t)("at"),suffixMinutesForHourPeriod:(0,o.t)("minute(s)"),errorInvalidCron:(0,o.t)("Invalid cron expression"),clearButtonText:(0,o.t)("Clear"),weekDays:[(0,o.t)("Sunday"),(0,o.t)("Monday"),(0,o.t)("Tuesday"),(0,o.t)("Wednesday"),(0,o.t)("Thursday"),(0,o.t)("Friday"),(0,o.t)("Saturday")],months:[(0,o.t)("January"),(0,o.t)("February"),(0,o.t)("March"),(0,o.t)("April"),(0,o.t)("May"),(0,o.t)("June"),(0,o.t)("July"),(0,o.t)("August"),(0,o.t)("September"),(0,o.t)("October"),(0,o.t)("November"),(0,o.t)("December")],altWeekDays:[(0,o.t)("SUN"),(0,o.t)("MON"),(0,o.t)("TUE"),(0,o.t)("WED"),(0,o.t)("THU"),(0,o.t)("FRI"),(0,o.t)("SAT")],altMonths:[(0,o.t)("JAN"),(0,o.t)("FEB"),(0,o.t)("MAR"),(0,o.t)("APR"),(0,o.t)("MAY"),(0,o.t)("JUN"),(0,o.t)("JUL"),(0,o.t)("AUG"),(0,o.t)("SEP"),(0,o.t)("OCT"),(0,o.t)("NOV"),(0,o.t)("DEC")]},u=(0,l.iK)((t=>(0,d.tZ)(i.ZP,{getPopupContainer:t=>t.parentElement},(0,d.tZ)(s.Z,a()({locale:c},t)))))`
  .react-js-cron-field {
    margin-bottom: 0px;
  }
  .react-js-cron-select:not(.react-js-cron-custom-select) > div:first-of-type,
  .react-js-cron-custom-select {
    border-radius: ${t=>{let{theme:e}=t;return e.gridUnit}}px;
    background-color: ${t=>{let{theme:e}=t;return e.colors.grayscale.light4}} !important;
  }
  .react-js-cron-custom-select > div:first-of-type {
    border-radius: ${t=>{let{theme:e}=t;return e.gridUnit}}px;
  }
  .react-js-cron-custom-select .ant-select-selection-placeholder {
    flex: auto;
  }
  .react-js-cron-custom-select .ant-select-selection-overflow-item {
    align-self: center;
  }
`},88694:(t,e,n)=>{n.d(e,{Lt:()=>h,$i:()=>p});var r=n(5872),a=n.n(r),i=(n(67294),n(4715)),o=n(51995),l=n(70163),s=n(11965);const d=o.iK.div`
  width: ${t=>{let{theme:e}=t;return.75*e.gridUnit}}px;
  height: ${t=>{let{theme:e}=t;return.75*e.gridUnit}}px;
  border-radius: 50%;
  background-color: ${t=>{let{theme:e}=t;return e.colors.grayscale.light1}};

  font-weight: ${t=>{let{theme:e}=t;return e.typography.weights.normal}};
  display: inline-flex;
  position: relative;

  &:hover {
    background-color: ${t=>{let{theme:e}=t;return e.colors.primary.base}};

    &::before,
    &::after {
      background-color: ${t=>{let{theme:e}=t;return e.colors.primary.base}};
    }
  }

  &::before,
  &::after {
    position: absolute;
    content: ' ';
    width: ${t=>{let{theme:e}=t;return.75*e.gridUnit}}px;
    height: ${t=>{let{theme:e}=t;return.75*e.gridUnit}}px;
    border-radius: 50%;
    background-color: ${t=>{let{theme:e}=t;return e.colors.grayscale.light1}};
  }

  &::before {
    top: ${t=>{let{theme:e}=t;return e.gridUnit}}px;
  }

  &::after {
    bottom: ${t=>{let{theme:e}=t;return e.gridUnit}}px;
  }
`,c=o.iK.div`
  display: flex;
  align-items: center;
  padding: ${t=>{let{theme:e}=t;return 2*e.gridUnit}}px;
  padding-left: ${t=>{let{theme:e}=t;return e.gridUnit}}px;
`;var u;!function(t){t.VERTICAL="vertical",t.HORIZONTAL="horizontal"}(u||(u={}));const h=t=>{let{overlay:e,iconOrientation:n=u.VERTICAL,...r}=t;return(0,s.tZ)(i.Gj,a()({overlay:e},r),(0,s.tZ)(c,null,function(t){return void 0===t&&(t=u.VERTICAL),t===u.HORIZONTAL?(0,s.tZ)(l.Z.MoreHoriz,{iconSize:"xl"}):(0,s.tZ)(d,null)}(n)))},p=t=>(0,s.tZ)(i.Gj,a()({overlayStyle:{zIndex:99,animationDuration:"0s"}},t))},59507:(t,e,n)=>{n.d(e,{pG:()=>x,ZP:()=>S});var r=n(87185),a=n.n(r),i=n(67294),o=n(99612),l=n(51995),s=n(58593),d=n(55786),c=n(55867),u=n(70163),h=n(11965);const p=l.iK.div`
  font-weight: ${t=>{let{theme:e}=t;return e.typography.weights.bold}};
`,m=t=>{let{text:e,header:n}=t;const r=(0,d.Z)(e);return(0,h.tZ)(i.Fragment,null,n&&(0,h.tZ)(p,null,n),r.map((t=>(0,h.tZ)("div",{key:t},t))))},g=16,v={dashboards:0,table:1,sql:2,rows:3,tags:4,description:5,owner:6,lastModified:7},b=l.iK.div`
  ${t=>{let{theme:e,count:n}=t;return`\n    display: flex;\n    align-items: center;\n    padding: 8px 12px;\n    background-color: ${e.colors.grayscale.light4};\n    color: ${e.colors.grayscale.base};\n    font-size: ${e.typography.sizes.s}px;\n    min-width: ${24+32*n-g}px;\n    border-radius: ${e.borderRadius}px;\n    line-height: 1;\n  `}}
`,f=l.iK.div`
  ${t=>{let{theme:e,collapsed:n,last:r,onClick:a}=t;return`\n    display: flex;\n    align-items: center;\n    max-width: ${174+(r?0:g)}px;\n    min-width: ${n?16+(r?0:g):94+(r?0:g)}px;\n    padding-right: ${r?0:g}px;\n    cursor: ${a?"pointer":"default"};\n    & .metadata-icon {\n      color: ${a&&n?e.colors.primary.base:e.colors.grayscale.base};\n      padding-right: ${n?0:8}px;\n      & .anticon {\n        line-height: 0;\n      }\n    }\n    & .metadata-text {\n      min-width: 70px;\n      overflow: hidden;\n      text-overflow: ${n?"unset":"ellipsis"};\n      white-space: nowrap;\n      text-decoration: ${a?"underline":"none"};\n    }\n  `}}
`,y=l.iK.div`
  display: -webkit-box;
  -webkit-line-clamp: 20;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
`,Z=t=>{let{barWidth:e,contentType:n,collapsed:r,last:a=!1,tooltipPlacement:o}=t;const{icon:l,title:d,tooltip:p=d}=(t=>{const{type:e}=t;switch(e){case x.DASHBOARDS:return{icon:u.Z.FundProjectionScreenOutlined,title:t.title,tooltip:t.description?(0,h.tZ)("div",null,(0,h.tZ)(m,{header:t.title,text:t.description})):void 0};case x.DESCRIPTION:return{icon:u.Z.BookOutlined,title:t.value};case x.LAST_MODIFIED:return{icon:u.Z.EditOutlined,title:t.value,tooltip:(0,h.tZ)("div",null,(0,h.tZ)(m,{header:(0,c.t)("Last modified"),text:t.value}),(0,h.tZ)(m,{header:(0,c.t)("Modified by"),text:t.modifiedBy}))};case x.OWNER:return{icon:u.Z.UserOutlined,title:t.createdBy,tooltip:(0,h.tZ)("div",null,(0,h.tZ)(m,{header:(0,c.t)("Created by"),text:t.createdBy}),(0,h.tZ)(m,{header:(0,c.t)("Owners"),text:t.owners}),(0,h.tZ)(m,{header:(0,c.t)("Created on"),text:t.createdOn}))};case x.ROWS:return{icon:u.Z.InsertRowBelowOutlined,title:t.title,tooltip:t.title};case x.SQL:return{icon:u.Z.ConsoleSqlOutlined,title:t.title,tooltip:t.title};case x.TABLE:return{icon:u.Z.Table,title:t.title,tooltip:t.title};case x.TAGS:return{icon:u.Z.TagsOutlined,title:t.values.join(", "),tooltip:(0,h.tZ)("div",null,(0,h.tZ)(m,{header:(0,c.t)("Tags"),text:t.values}))};default:throw Error(`Invalid type provided: ${e}`)}})(n),[g,v]=(0,i.useState)(!1),b=(0,i.useRef)(null),Z=l,{type:S,onClick:C}=n;(0,i.useEffect)((()=>{v(!!b.current&&b.current.scrollWidth>b.current.clientWidth)}),[e,v,n]);const w=(0,h.tZ)(f,{collapsed:r,last:a,onClick:C?()=>C(S):void 0},(0,h.tZ)(Z,{iconSize:"l",className:"metadata-icon"}),!r&&(0,h.tZ)("span",{ref:b,className:"metadata-text"},d));return g||r||p&&p!==d?(0,h.tZ)(s.u,{placement:o,title:(0,h.tZ)(y,null,p)},w):w};var x;!function(t){t.DASHBOARDS="dashboards",t.DESCRIPTION="description",t.LAST_MODIFIED="lastModified",t.OWNER="owner",t.ROWS="rows",t.SQL="sql",t.TABLE="table",t.TAGS="tags"}(x||(x={}));const S=t=>{let{items:e,tooltipPlacement:n="top"}=t;const[r,l]=(0,i.useState)(),[s,d]=(0,i.useState)(!1),c=a()(e,((t,e)=>t.type===e.type)).sort(((t,e)=>v[t.type]-v[e.type])),u=c.length;if(u<2)throw Error("The minimum number of items for the metadata bar is 2.");if(u>6)throw Error("The maximum number of items for the metadata bar is 6.");const p=(0,i.useCallback)((t=>{const e=110*u-g;l(t),d(Boolean(t&&t<e))}),[u]),{ref:m}=(0,o.NB)({onResize:p});return(0,h.tZ)(b,{ref:m,count:u},c.map(((t,e)=>(0,h.tZ)(Z,{barWidth:r,key:e,contentType:t,collapsed:s,last:e===u-1,tooltipPlacement:n}))))}},97634:(t,e,n)=>{n.d(e,{x:()=>et,Z:()=>at});var r,a,i=n(11965),o=n(67294),l=n(60812),s=n(28216),d=n(75049),c=n(51995),u=n(93185),h=n(55867),p=n(70163),m=n(73192),g=n(83862),v=n(87253),b=n(54076),f=n(88694),y=n(17198),Z=n(78580),x=n.n(Z),S=n(98286),C=n(61358),w=n(29487),T=n(98978),k=n(87858),$=n(14114);!function(t){t.DASHBOARDS="dashboards",t.CHARTS="charts"}(r||(r={})),function(t){t.TEXT="TEXT",t.PNG="PNG",t.CSV="CSV"}(a||(a={}));var D=n(34858),I=n(74069),M=n(35932),_=n(87183),F=n(9433);const R=(0,c.iK)(I.Z)`
  .ant-modal-body {
    padding: 0;
  }
`,E=c.iK.div`
  padding: ${t=>{let{theme:e}=t;return`${3*e.gridUnit}px ${4*e.gridUnit}px ${2*e.gridUnit}px`}};
  label {
    font-size: ${t=>{let{theme:e}=t;return e.typography.sizes.s}}px;
    color: ${t=>{let{theme:e}=t;return e.colors.grayscale.light1}};
  }
`,O=c.iK.div`
  border-top: 1px solid ${t=>{let{theme:e}=t;return e.colors.grayscale.light2}};
  padding: ${t=>{let{theme:e}=t;return`${4*e.gridUnit}px ${4*e.gridUnit}px ${6*e.gridUnit}px`}};
  .ant-select {
    width: 100%;
  }
  .control-label {
    font-size: ${t=>{let{theme:e}=t;return e.typography.sizes.s}}px;
    color: ${t=>{let{theme:e}=t;return e.colors.grayscale.light1}};
  }
`,A=c.iK.span`
  span {
    margin-right: ${t=>{let{theme:e}=t;return 2*e.gridUnit}}px;
    vertical-align: middle;
  }
  .text {
    vertical-align: middle;
  }
`,U=c.iK.div`
  margin-bottom: ${t=>{let{theme:e}=t;return 7*e.gridUnit}}px;

  h4 {
    margin-bottom: ${t=>{let{theme:e}=t;return 3*e.gridUnit}}px;
  }
`,z=(0,c.iK)(F.CronPicker)`
  margin-bottom: ${t=>{let{theme:e}=t;return 3*e.gridUnit}}px;
  width: ${t=>{let{theme:e}=t;return 120*e.gridUnit}}px;
`,N=c.iK.p`
  color: ${t=>{let{theme:e}=t;return e.colors.error.base}};
`,P=i.iv`
  margin-bottom: 0;
`,L=(0,c.iK)(M.Z)`
  width: ${t=>{let{theme:e}=t;return 40*e.gridUnit}}px;
`,j=c.iK.div`
  margin: ${t=>{let{theme:e}=t;return 8*e.gridUnit}}px 0
    ${t=>{let{theme:e}=t;return 4*e.gridUnit}}px;
`,q=(0,c.iK)(_.Y)`
  display: block;
  line-height: ${t=>{let{theme:e}=t;return 8*e.gridUnit}}px;
`,V=(0,c.iK)(_.Y.Group)`
  margin-left: ${t=>{let{theme:e}=t;return.5*e.gridUnit}}px;
`,B=["pivot_table","pivot_table_v2","table","paired_ttest"],H={crontab:"0 12 * * 1"},K=(0,$.ZP)((function(t){var e;let{onHide:n,show:r=!1,dashboardId:l,chart:d,userId:c,userEmail:u,creationMethod:m,dashboardName:g,chartName:v}=t;const b=null==d||null==(e=d.sliceFormData)?void 0:e.viz_type,f=!!d,y=f&&b&&x()(B).call(B,b),Z=y?a.TEXT:a.PNG,$=g||v,I=(0,o.useMemo)((()=>({...H,name:$?(0,h.t)("Weekly Report for %s",$):(0,h.t)("Weekly Report")})),[$]),M=(0,o.useCallback)(((t,e)=>"reset"===e?I:{...t,...e}),[I]),[_,F]=(0,o.useReducer)(M,I),[K,W]=(0,o.useState)(),G=(0,s.I0)(),Q=(0,s.v9)((t=>{const e=l?et.DASHBOARDS:et.CHARTS;return(0,D._l)(t,e,l||(null==d?void 0:d.id))})),Y=Q&&Object.keys(Q).length;(0,o.useEffect)((()=>{F(Y?Q:"reset")}),[Y,Q]);const J=(0,i.tZ)(A,null,(0,i.tZ)(p.Z.Calendar,null),(0,i.tZ)("span",{className:"text"},Y?(0,h.t)("Edit email report"):(0,h.t)("Schedule a new email report"))),X=(0,i.tZ)(o.Fragment,null,(0,i.tZ)(L,{key:"back",onClick:n},(0,h.t)("Cancel")),(0,i.tZ)(L,{key:"submit",buttonStyle:"primary",onClick:async()=>{const t={type:"Report",active:!0,force_screenshot:!1,creation_method:m,dashboard:l,chart:null==d?void 0:d.id,owners:[c],recipients:[{recipient_config_json:{target:u},type:"Email"}],name:_.name,description:_.description,crontab:_.crontab,report_format:_.report_format||Z,timezone:_.timezone};F({isSubmitting:!0,error:void 0});try{Y?await G((0,C.Me)(_.id,t)):await G((0,C.cq)(t)),n()}catch(t){const{error:e}=await(0,S.O$)(t);F({error:e})}F({isSubmitting:!1})},disabled:!_.name,loading:_.isSubmitting},Y?(0,h.t)("Save"):(0,h.t)("Add"))),tt=(0,i.tZ)(o.Fragment,null,(0,i.tZ)(j,null,(0,i.tZ)("h4",null,(0,h.t)("Message content"))),(0,i.tZ)("div",{className:"inline-container"},(0,i.tZ)(V,{onChange:t=>{F({report_format:t.target.value})},value:_.report_format||Z},y&&(0,i.tZ)(q,{value:a.TEXT},(0,h.t)("Text embedded in email")),(0,i.tZ)(q,{value:a.PNG},(0,h.t)("Image (PNG) embedded in email")),(0,i.tZ)(q,{value:a.CSV},(0,h.t)("Formatted CSV attached in email")))));return(0,i.tZ)(R,{show:r,onHide:n,title:J,footer:X,width:"432",centered:!0},(0,i.tZ)(E,null,(0,i.tZ)(k.Z,{id:"name",name:"name",value:_.name||"",placeholder:I.name,required:!0,validationMethods:{onChange:t=>{let{target:e}=t;return F({name:e.value})}},label:(0,h.t)("Report Name")}),(0,i.tZ)(k.Z,{id:"description",name:"description",value:(null==_?void 0:_.description)||"",validationMethods:{onChange:t=>{let{target:e}=t;F({description:e.value})}},label:(0,h.t)("Description"),placeholder:(0,h.t)("Include a description that will be sent with your report"),css:P})),(0,i.tZ)(O,null,(0,i.tZ)(U,null,(0,i.tZ)("h4",{css:t=>(t=>i.iv`
  margin: ${3*t.gridUnit}px 0;
`)(t)},(0,h.t)("Schedule")),(0,i.tZ)("p",null,(0,h.t)("A screenshot of the dashboard will be sent to your email at"))),(0,i.tZ)(z,{clearButton:!1,value:_.crontab||"0 12 * * 1",setValue:t=>{F({crontab:t})},onError:W}),(0,i.tZ)(N,null,K),(0,i.tZ)("div",{className:"control-label",css:t=>(t=>i.iv`
  margin: ${3*t.gridUnit}px 0 ${2*t.gridUnit}px;
`)(t)},(0,h.t)("Timezone")),(0,i.tZ)(T.Z,{timezone:_.timezone,onTimezoneChange:t=>{F({timezone:t})}}),f&&tt),_.error&&(0,i.tZ)(w.Z,{type:"error",css:t=>(t=>i.iv`
  border: ${t.colors.error.base} 1px solid;
  padding: ${4*t.gridUnit}px;
  margin: ${4*t.gridUnit}px;
  margin-top: 0;
  color: ${t.colors.error.dark2};
  .ant-alert-message {
    font-size: ${t.typography.sizes.m}px;
    font-weight: bold;
  }
  .ant-alert-description {
    font-size: ${t.typography.sizes.m}px;
    line-height: ${4*t.gridUnit}px;
    .ant-alert-icon {
      margin-right: ${2.5*t.gridUnit}px;
      font-size: ${t.typography.sizes.l}px;
      position: relative;
      top: ${t.gridUnit/4}px;
    }
  }
`)(t),message:Y?(0,h.t)("Failed to update report"):(0,h.t)("Failed to create report"),description:_.error}))}));var W=n(96022);const G=(0,d.I)(),Q=t=>i.iv`
  color: ${t.colors.error.base};
`,Y=t=>i.iv`
  & .ant-menu-item {
    padding: 5px 12px;
    margin-top: 0px;
    margin-bottom: 4px;
    :hover {
      color: ${t.colors.grayscale.dark1};
    }
  }
  :hover {
    background-color: ${t.colors.secondary.light5};
  }
`,J=t=>i.iv`
  &:hover {
    color: ${t.colors.grayscale.dark1};
    background-color: ${t.colors.secondary.light5};
  }
`,X=c.iK.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  > *:first-child {
    margin-right: ${t=>{let{theme:e}=t;return e.gridUnit}}px;
  }
`,tt=G.get("report-modal.dropdown.item.icon");var et;!function(t){t.CHARTS="charts",t.DASHBOARDS="dashboards"}(et||(et={}));var nt={name:"1e1ncky",styles:"border:none"},rt={name:"833hqy",styles:"width:200px"};function at(t){let{dashboardId:e,chart:n,useTextMenu:r=!1,setShowReportSubMenu:a,setIsDropdownVisible:d,isDropdownVisible:Z}=t;const x=(0,s.I0)(),S=(0,s.v9)((t=>{const r=e?et.DASHBOARDS:et.CHARTS;return(0,D._l)(t,r,e||(null==n?void 0:n.id))})),w=(null==S?void 0:S.active)||!1,T=(0,s.v9)((t=>t.user)),k=()=>!!(0,u.c)(u.T.ALERT_REPORTS)&&(!(null==T||!T.userId)&&Object.keys(T.roles||[]).map((t=>T.roles[t].filter((t=>"menu_access"===t[0]&&"Manage"===t[1])))).some((t=>t.length>0))),[$,I]=(0,o.useState)(null),M=(0,c.Fg)(),_=(0,l.D)(e),[F,R]=(0,o.useState)(!1),E=async(t,e)=>{null!=t&&t.id&&x((0,C.M)(t,e))},O=k()&&!!(e&&_!==e||null!=n&&n.id);(0,o.useEffect)((()=>{O&&x((0,C.Aw)({userId:T.userId,filterField:e?"dashboard_id":"chart_id",creationMethod:e?"dashboards":"charts",resourceId:e||(null==n?void 0:n.id)}))}),[]);const A=S&&a&&k();(0,o.useEffect)((()=>{A?a(!0):!S&&a&&a(!1)}),[S]);const U=()=>{d&&(d(!1),R(!0))};return(0,i.tZ)(o.Fragment,null,k()&&(0,i.tZ)(o.Fragment,null,(0,i.tZ)(K,{userId:T.userId,show:F,onHide:()=>R(!1),userEmail:T.email,dashboardId:e,chart:n,creationMethod:e?et.DASHBOARDS:et.CHARTS}),r?S?Z&&(0,i.tZ)(g.v,{selectable:!1,css:nt},(0,i.tZ)(g.v.Item,{css:J,onClick:()=>E(S,!w)},(0,i.tZ)(W.ZN,null,(0,i.tZ)(v.ZP,{checked:w,onChange:b.EI}),(0,h.t)("Email reports active"))),(0,i.tZ)(g.v.Item,{css:J,onClick:U},(0,h.t)("Edit email report")),(0,i.tZ)(g.v.Item,{css:J,onClick:()=>{d&&(d(!1),I(S))}},(0,h.t)("Delete email report"))):(0,i.tZ)(g.v,{selectable:!1,css:Y},(0,i.tZ)(g.v.Item,{onClick:U},tt?(0,i.tZ)(X,null,(0,i.tZ)("div",null,(0,h.t)("Set up an email report")),(0,i.tZ)(tt,null)):(0,h.t)("Set up an email report")),(0,i.tZ)(g.v.Divider,null)):S?(0,i.tZ)(o.Fragment,null,(0,i.tZ)(f.$i,{overlay:(0,i.tZ)(g.v,{selectable:!1,css:rt},(0,i.tZ)(g.v.Item,null,(0,h.t)("Email reports active"),(0,i.tZ)(m.r,{checked:w,onClick:t=>E(S,t),size:"small",css:(0,i.iv)({marginLeft:2*M.gridUnit},"","")})),(0,i.tZ)(g.v.Item,{onClick:()=>R(!0)},(0,h.t)("Edit email report")),(0,i.tZ)(g.v.Item,{onClick:()=>I(S),css:Q},(0,h.t)("Delete email report"))),trigger:["click"],getPopupContainer:t=>t.closest(".action-button")},(0,i.tZ)("span",{role:"button",className:"action-button action-schedule-report",tabIndex:0},(0,i.tZ)(p.Z.Calendar,null)))):(0,i.tZ)("span",{role:"button",title:(0,h.t)("Schedule email report"),tabIndex:0,className:"action-button action-schedule-report",onClick:()=>R(!0)},(0,i.tZ)(p.Z.Calendar,null)),$&&(0,i.tZ)(y.Z,{description:(0,h.t)("This action will permanently delete %s.",null==$?void 0:$.name),onConfirm:()=>{$&&(async t=>{await x((0,C.MZ)(t)),I(null)})($)},onHide:()=>I(null),open:!0,title:(0,h.t)("Delete Report?")})))}},73192:(t,e,n)=>{n.d(e,{r:()=>l}),n(67294);var r=n(51995),a=n(40987),i=n(11965);const o=(0,r.iK)(a.Z)`
  .ant-switch-checked {
    background-color: ${t=>{let{theme:e}=t;return e.colors.primary.base}};
  }
`,l=t=>(0,i.tZ)(o,t)},98978:(t,e,n)=>{n.d(e,{Z:()=>x});var r=n(11965),a=n(67294),i=n(80008),o=n.n(i),l=n(55867),s=n(4715);const d="GMT Standard Time",c="400px",u={"-300-240":["Eastern Standard Time","Eastern Daylight Time"],"-360-300":["Central Standard Time","Central Daylight Time"],"-420-360":["Mountain Standard Time","Mountain Daylight Time"],"-420-420":["Mountain Standard Time - Phoenix","Mountain Standard Time - Phoenix"],"-480-420":["Pacific Standard Time","Pacific Daylight Time"],"-540-480":["Alaska Standard Time","Alaska Daylight Time"],"-600-600":["Hawaii Standard Time","Hawaii Daylight Time"],60120:["Central European Time","Central European Daylight Time"],"00":[d,d],"060":["GMT Standard Time - London","British Summer Time"]},h=o()(),p=o()([2021,1]),m=o()([2021,7]),g=t=>p.tz(t).utcOffset().toString()+m.tz(t).utcOffset().toString(),v=t=>{var e,n;const r=g(t);return(h.tz(t).isDST()?null==(e=u[r])?void 0:e[1]:null==(n=u[r])?void 0:n[0])||t},b=o().tz.countries().map((t=>o().tz.zonesForCountry(t,!0))).flat(),f=[];b.forEach((t=>{f.find((e=>g(e.name)===g(t.name)))||f.push(t)}));const y=f.map((t=>({label:`GMT ${o().tz(h,t.name).format("Z")} (${v(t.name)})`,value:t.name,offsets:g(t.name),timezoneName:t.name}))),Z=(t,e)=>o().tz(h,t.timezoneName).utcOffset()-o().tz(h,e.timezoneName).utcOffset();function x(t){let{onTimezoneChange:e,timezone:n,minWidth:i=c}=t;const d=(0,a.useMemo)((()=>(t=>{var e;return(null==(e=y.find((e=>e.offsets===g(t))))?void 0:e.value)||"Africa/Abidjan"})(n||o().tz.guess())),[n]);return(0,a.useEffect)((()=>{n!==d&&e(d)}),[d,e,n]),(0,r.tZ)(s.Ph,{ariaLabel:(0,l.t)("Timezone selector"),css:(0,r.iv)({minWidth:i},"",""),onChange:t=>e(t),value:d,options:y,sortComparator:Z})}y.sort(Z)},87915:(t,e,n)=>{n.d(e,{U:()=>r,g:()=>a});const r=(t,e)=>Object.values(t).filter((t=>t[e])).reduce(((t,n)=>({...t,[n.id]:e?n[e]:n})),{}),a=t=>{let{chartConfiguration:e,nativeFilters:n,dataMask:r,allSliceIds:a}=t;const i={};return Object.values(r).forEach((t=>{var r,o,l,s,d,c;let{id:u,extraFormData:h}=t;const p=null!=(r=null!=(o=null!=(l=null==n||null==(s=n[u])?void 0:s.chartsInScope)?l:null==e||null==(d=e[u])||null==(c=d.crossFilters)?void 0:c.chartsInScope)?o:a)?r:[];i[u]={scope:p,values:h}})),i}},91914:(t,e,n)=>{n.d(e,{Z:()=>u});var r=n(78580),a=n.n(r),i=n(1510),o=n(99543);function l(t){return Object.entries(t).map((t=>{let[e,n]=t;return{col:e,op:Array.isArray(n)?"IN":"==",val:n}})).filter((t=>null!==t.val))}var s=n(87915);const d={},c={};function u(t){let{chart:e,filters:n,nativeFilters:r,chartConfiguration:u,colorScheme:h,colorNamespace:p,sliceId:m,dataMask:g,extraControls:v,labelColors:b,sharedLabelColors:f,allSliceIds:y}=t;const Z=c[m];if(d[m]===n&&(0,o.JB)(null==Z?void 0:Z.color_scheme,h,{ignoreUndefined:!0})&&(0,o.JB)(null==Z?void 0:Z.color_namespace,p,{ignoreUndefined:!0})&&(0,o.JB)(null==Z?void 0:Z.label_colors,b,{ignoreUndefined:!0})&&(0,o.JB)(null==Z?void 0:Z.shared_label_colors,f,{ignoreUndefined:!0})&&Z&&(0,o.JB)(null==Z?void 0:Z.dataMask,g,{ignoreUndefined:!0})&&(0,o.JB)(null==Z?void 0:Z.extraControls,v,{ignoreUndefined:!0}))return Z;let x={};const S=(0,s.g)({chartConfiguration:u,dataMask:g,nativeFilters:r,allSliceIds:y}),C=Object.entries(S).filter((t=>{let[,{scope:n}]=t;return a()(n).call(n,e.id)})).map((t=>{let[e]=t;return e}));C.length&&(x={extra_form_data:(0,i.vk)(g,C)});const w={...e.form_data,label_colors:b,shared_label_colors:f,...h&&{color_scheme:h},extra_filters:l(n),...x,...v};return d[m]=n,c[m]={...w,dataMask:g,extraControls:v},w}},95345:(t,e,n)=>{n.d(e,{c9:()=>P,Tg:()=>O});var r,a=n(67294),i=n(51995),o=n(55867),l=n(70163),s=n(71262),d=n(91877),c=n(93185),u=n(61337);!function(t){t.Results="results",t.Samples="samples"}(r||(r={}));var h=n(11064),p=n(55786),m=n(38703),g=n(94301),v=n(52256),b=n(98286),f=n(76962),y=n(50909),Z=n(4788),x=n.n(Z),S=n(78580),C=n.n(S),w=n(88889),T=n(11965),k=n(54076),$=n(61587);const D=i.iK.div`
  ${t=>{let{theme:e}=t;return`\n    display: flex;\n    align-items: center;\n    justify-content: space-between;\n    margin-bottom: ${2*e.gridUnit}px;\n\n    span {\n      flex-shrink: 0;\n    }\n  `}}
`,I=t=>{let{data:e,datasourceId:n,onInputChange:r,columnNames:i,columnTypes:o,isLoading:l}=t;const s=(0,$.W)(n),d=x()(i,o).filter((t=>{let[e,n]=t;return n===w.Z.TEMPORAL&&e&&!C()(s).call(s,e)})).map((t=>{let[e]=t;return e})),c=(0,a.useMemo)((()=>(0,k.cD)(e,d)),[e,d]);return(0,T.tZ)(D,null,(0,T.tZ)(y.HS,{onChangeHandler:r}),(0,T.tZ)("div",{css:T.iv`
          display: flex;
          align-items: center;
        `},(0,T.tZ)(y.uy,{data:e,loading:l}),(0,T.tZ)(y.m,{data:c,columns:i})))},M=t=>{let{data:e,colnames:n,coltypes:r,datasourceId:i,dataSize:l=50,isVisible:s}=t;const[d,c]=(0,a.useState)(""),u=(0,y._q)(n,r,e,i,s),h=(0,y.C4)(d,e);return(0,T.tZ)(a.Fragment,null,(0,T.tZ)(I,{data:h,columnNames:n,columnTypes:r,datasourceId:i,onInputChange:t=>c(t),isLoading:!1}),(0,T.tZ)(f.Z,{columns:u,data:h,pageSize:l,noDataText:(0,o.t)("No results"),emptyWrapperType:f.u.Small,className:"table-condensed",isPaginationSticky:!0,showRowCount:!1,small:!0}))},_=i.iK.pre`
  margin-top: ${t=>{let{theme:e}=t;return 4*e.gridUnit+"px"}};
`,F=new WeakMap,R=t=>{var e;let{isRequest:n,queryFormData:r,queryForce:i,ownState:l,errorMessage:s,actions:d,isVisible:c,dataSize:u=50}=t;const f=(0,h.Z)().get((null==r?void 0:r.viz_type)||(null==r?void 0:r.vizType)),[y,Z]=(0,a.useState)([]),[x,S]=(0,a.useState)(!0),[C,w]=(0,a.useState)(""),k=null!=(e=null==f?void 0:f.queryObjectCount)?e:1;if((0,a.useEffect)((()=>{s||(n&&F.has(r)&&(Z((0,p.Z)(F.get(r))),w(""),i&&d&&d.setForceQuery(!1),S(!1)),n&&!F.has(r)&&(S(!0),(0,v.getChartDataRequest)({formData:r,force:i,resultFormat:"json",resultType:"results",ownState:l}).then((t=>{let{json:e}=t;Z((0,p.Z)(e.result)),w(""),F.set(r,e.result),i&&d&&d.setForceQuery(!1)})).catch((t=>{(0,b.O$)(t).then((t=>{let{error:e,message:n}=t;w(e||n||(0,o.t)("Sorry, an error occurred"))}))})).finally((()=>{S(!1)}))))}),[r,n]),(0,a.useEffect)((()=>{s&&S(!1)}),[s]),x)return Array(k).fill((0,T.tZ)(m.Z,null));if(s){const t=(0,o.t)("Run a query to display results");return Array(k).fill((0,T.tZ)(g.x3,{image:"document.svg",title:t}))}if(C){const t=(0,T.tZ)(a.Fragment,null,(0,T.tZ)(I,{data:[],columnNames:[],columnTypes:[],datasourceId:r.datasource,onInputChange:()=>{},isLoading:!1}),(0,T.tZ)(_,null,C));return Array(k).fill(t)}if(0===y.length){const t=(0,o.t)("No results were returned for this query");return Array(k).fill((0,T.tZ)(g.x3,{image:"document.svg",title:t}))}return y.slice(0,k).map(((t,e)=>(0,T.tZ)(M,{data:t.data,colnames:t.colnames,coltypes:t.coltypes,dataSize:u,datasourceId:r.datasource,key:e,isVisible:c})))},E=i.iK.div`
  display: flex;
  flex-direction: column;
  height: 100%;

  .ant-tabs {
    height: 100%;
  }

  .ant-tabs-content {
    height: 100%;
  }

  .ant-tabs-tabpane {
    display: flex;
    flex-direction: column;
  }

  .table-condensed {
    overflow: auto;
  }
`,O=t=>{let{isRequest:e,queryFormData:n,queryForce:a,ownState:i,errorMessage:l,actions:d,isVisible:c,dataSize:u=50}=t;const h=R({errorMessage:l,queryFormData:n,queryForce:a,ownState:i,isRequest:e,actions:d,dataSize:u,isVisible:c});if(1===h.length)return(0,T.tZ)(E,null,h[0]);const p=h.map(((t,e)=>0===e?(0,T.tZ)(s.ZP.TabPane,{tab:(0,o.t)("Results"),key:r.Results},t):(0,T.tZ)(s.ZP.TabPane,{tab:(0,o.t)("Results %s",e+1),key:`${r.Results} ${e+1}`},t)));return(0,T.tZ)(E,null,(0,T.tZ)(s.ZP,{fullWidth:!1},p))},A=i.iK.pre`
  margin-top: ${t=>{let{theme:e}=t;return 4*e.gridUnit+"px"}};
`,U=new WeakSet,z=t=>{let{isRequest:e,datasource:n,queryForce:r,actions:i,dataSize:l=50,isVisible:s}=t;const[d,c]=(0,a.useState)(""),[u,h]=(0,a.useState)([]),[b,Z]=(0,a.useState)([]),[x,S]=(0,a.useState)([]),[C,w]=(0,a.useState)(!1),[k,$]=(0,a.useState)(""),D=(0,a.useMemo)((()=>`${n.id}__${n.type}`),[n]);(0,a.useEffect)((()=>{e&&r&&U.delete(n),e&&!U.has(n)&&(w(!0),(0,v.getDatasourceSamples)(n.type,n.id,r,{}).then((t=>{h((0,p.Z)(t.data)),Z((0,p.Z)(t.colnames)),S((0,p.Z)(t.coltypes)),$(""),U.add(n),r&&i&&i.setForceQuery(!1)})).catch((t=>{h([]),Z([]),S([]),$(`${t.name}: ${t.message}`)})).finally((()=>{w(!1)})))}),[n,e,r]);const M=(0,y._q)(b,x,u,D,s),_=(0,y.C4)(d,u);if(C)return(0,T.tZ)(m.Z,null);if(k)return(0,T.tZ)(a.Fragment,null,(0,T.tZ)(I,{data:_,columnNames:b,columnTypes:x,datasourceId:D,onInputChange:t=>c(t),isLoading:C}),(0,T.tZ)(A,null,k));if(0===u.length){const t=(0,o.t)("No samples were returned for this dataset");return(0,T.tZ)(g.x3,{image:"document.svg",title:t})}return(0,T.tZ)(a.Fragment,null,(0,T.tZ)(I,{data:_,columnNames:b,columnTypes:x,datasourceId:D,onInputChange:t=>c(t),isLoading:C}),(0,T.tZ)(f.Z,{columns:M,data:_,pageSize:l,noDataText:(0,o.t)("No results"),emptyWrapperType:f.u.Small,className:"table-condensed",isPaginationSticky:!0,showRowCount:!1,small:!0}))},N=i.iK.div`
  ${t=>{let{theme:e}=t;return`\n    position: relative;\n    background-color: ${e.colors.grayscale.light5};\n    z-index: 5;\n    overflow: hidden;\n\n    .ant-tabs {\n      height: 100%;\n    }\n\n    .ant-tabs-content-holder {\n      height: 100%;\n    }\n\n    .ant-tabs-content {\n      height: 100%;\n    }\n\n    .ant-tabs-tabpane {\n      display: flex;\n      flex-direction: column;\n      height: 100%;\n\n      .table-condensed {\n        height: 100%;\n        overflow: auto;\n        margin-bottom: ${4*e.gridUnit}px;\n\n        .table {\n          margin-bottom: ${2*e.gridUnit}px;\n        }\n      }\n\n      .pagination-container > ul[role='navigation'] {\n        margin-top: 0;\n      }\n    }\n  `}}
`,P=t=>{let{queryFormData:e,datasource:n,queryForce:h,onCollapseChange:p,chartStatus:m,ownState:g,errorMessage:v,actions:b}=t;const f=(0,i.Fg)(),[y,Z]=(0,a.useState)(r.Results),[x,S]=(0,a.useState)({results:!1,samples:!1}),[C,w]=(0,a.useState)(!(0,d.cr)(c.T.DATAPANEL_CLOSED_BY_DEFAULT)&&(0,u.rV)(u.dR.is_datapanel_open,!1));(0,a.useEffect)((()=>{(0,d.cr)(c.T.DATAPANEL_CLOSED_BY_DEFAULT)||(0,u.LS)(u.dR.is_datapanel_open,C)}),[C]),(0,a.useEffect)((()=>{C||S({results:!1,samples:!1}),C&&y.startsWith(r.Results)&&"rendered"===m&&S({results:!0,samples:!1}),C&&y===r.Samples&&S({results:!1,samples:!0})}),[C,y,m]);const k=(0,a.useCallback)((t=>{p(t),w(t)}),[p]),$=(0,a.useCallback)(((t,e)=>{C?t===y&&(e.preventDefault(),k(!1)):k(!0),Z(t)}),[y,k,C]),I=(0,a.useMemo)((()=>{const t=C?(0,T.tZ)(l.Z.CaretUp,{iconColor:f.colors.grayscale.base,"aria-label":(0,o.t)("Collapse data panel")}):(0,T.tZ)(l.Z.CaretDown,{iconColor:f.colors.grayscale.base,"aria-label":(0,o.t)("Expand data panel")});return(0,T.tZ)(D,null,C?(0,T.tZ)("span",{role:"button",tabIndex:0,onClick:()=>k(!1)},t):(0,T.tZ)("span",{role:"button",tabIndex:0,onClick:()=>k(!0)},t))}),[k,C,f.colors.grayscale.base]),M=R({errorMessage:v,queryFormData:e,queryForce:h,ownState:g,isRequest:x.results,actions:b,isVisible:r.Results===y}).map(((t,e)=>0===e?(0,T.tZ)(s.ZP.TabPane,{tab:(0,o.t)("Results"),key:r.Results},t):e>0?(0,T.tZ)(s.ZP.TabPane,{tab:(0,o.t)("Results %s",e+1),key:`${r.Results} ${e+1}`},t):null));return(0,T.tZ)(N,null,(0,T.tZ)(s.ZP,{fullWidth:!1,tabBarExtraContent:I,activeKey:C?y:"",onTabClick:$},M,(0,T.tZ)(s.ZP.TabPane,{tab:(0,o.t)("Samples"),key:r.Samples},(0,T.tZ)(z,{datasource:n,queryForce:h,isRequest:x.samples,actions:b,isVisible:r.Samples===y}))))}},15423:(t,e,n)=>{n.d(e,{Z:()=>p});var r=n(67294),a=n(51995),i=n(55786),o=n(55867),l=n(38703),s=n(98286),d=n(52256),c=n(85626),u=n(11965);const h=a.iK.div`
  height: 100%;
  display: flex;
  flex-direction: column;
`,p=t=>{const[e,n]=(0,r.useState)([]),[a,p]=(0,r.useState)(!1),[m,g]=(0,r.useState)(null);return(0,r.useEffect)((()=>{p(!0),(0,d.getChartDataRequest)({formData:t.latestQueryFormData,resultFormat:"json",resultType:"query"}).then((t=>{let{json:e}=t;n((0,i.Z)(e.result)),p(!1),g(null)})).catch((t=>{(0,s.O$)(t).then((e=>{let{error:n,message:r}=e;g(n||r||t.statusText||(0,o.t)("Sorry, An error occurred")),p(!1)}))}))}),[JSON.stringify(t.latestQueryFormData)]),a?(0,u.tZ)(l.Z,null):m?(0,u.tZ)("pre",null,m):(0,u.tZ)(h,null,e.map((t=>t.query?(0,u.tZ)(c.Z,{sql:t.query,language:t.language||void 0}):null)))}},28615:(t,e,n)=>{n.d(e,{S:()=>i});var r=n(67294),a=n(60812);function i(t,e){const n=(0,a.D)(t);(0,r.useEffect)((()=>{t!==n&&e(n,t)}),[t,n,e])}},6954:(t,e,n)=>{n.d(e,{z:()=>l});var r=n(67294),a=n(14670),i=n.n(a);const o=new(n(11133).g0)("tab_id_channel");function l(){const[t,e]=(0,r.useState)();return(0,r.useEffect)((()=>{if(!function(){try{return window.localStorage&&window.sessionStorage}catch(t){return!1}}())return void(t||e(i().generate()));const n=()=>{const t=window.localStorage.getItem("last_tab_id"),n=String(t?Number.parseInt(t,10)+1:1);window.sessionStorage.setItem("tab_id",n),window.localStorage.setItem("last_tab_id",n),e(n)},r=window.sessionStorage.getItem("tab_id");r?(o.postMessage({type:"REQUESTING_TAB_ID",tabId:r}),e(r)):n(),o.onmessage=e=>{if(e.tabId===t)if("REQUESTING_TAB_ID"===e.type){const t={type:"TAB_ID_DENIED",tabId:e.tabId};o.postMessage(t)}else"TAB_ID_DENIED"===e.type&&n()}}),[t]),t}},56727:(t,e,n)=>{n.d(e,{Z:()=>h});var r=n(78580),a=n.n(r),i=n(46926),o=n.n(i),l=n(21804),s=n.n(l),d=n(55867),c=n(51995),u=n(72570);function h(t,e,n){return void 0===n&&(n=!1),r=>{const i=n?document.querySelector(t):r.currentTarget.closest(t);return i?o().toJpeg(i,{quality:.95,bgcolor:c.K6.colors.grayscale.light4,filter:t=>{var e;return"string"!=typeof t.className||"mapboxgl-control-container"!==t.className&&!a()(e=t.className).call(e,"ant-dropdown")}}).then((t=>{const n=document.createElement("a");n.download=`${function(t,e){return void 0===e&&(e=new Date),`${s()(t)}-${e.toISOString().replace(/[: ]/g,"-")}`}(e)}.jpg`,n.href=t,n.click()})).catch((t=>{console.error("Creating image failed",t)})):(0,u.Dz)((0,d.t)("Image download failed, please refresh and try again."))}}},75701:(t,e,n)=>{n.d(e,{J:()=>o});var r=n(55867);const a=(0,r.t)("Create chart"),i=(0,r.t)("Update chart"),o=t=>(0,r.t)("Select values in highlighted field(s) in the control panel. Then run the query by clicking on the %s button.",`"${t?a:i}"`)},71894:(t,e,n)=>{n.d(e,{b:()=>r});const r=()=>{var t,e;return null==(t=window)||null==(e=t.navigator)?void 0:e.webdriver}}}]);
//# sourceMappingURL=4c81b739e6e8cff1c345.chunk.js.map
