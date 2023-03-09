"use strict";(globalThis.webpackChunksuperset=globalThis.webpackChunksuperset||[]).push([[6947],{24279:(t,e,n)=>{n.r(e),n.d(e,{datasetReducer:()=>be,default:()=>ve});var a=n(67294),l=n(16550),i=n(14025),o=n(55867),r=n(52564),s=n(35932),d=n(70163),c=n(83862),u=n(51995),h=n(11965);const g=u.iK.div`
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  background-color: ${t=>{let{theme:e}=t;return e.colors.grayscale.light5}};
`,p=u.iK.div`
  width: 100%;
  height: 100%;
  flex-direction: column;
`,m=(0,u.iK)(p)`
  width: ${t=>{let{theme:e}=t;return 80*e.gridUnit}}px;
  height: auto;
`,b=(0,u.iK)(p)`
  height: auto;
  display: flex;
  flex: 1 0 auto;
  width: calc(100% - ${t=>{let{theme:e}=t;return 80*e.gridUnit}}px);
`,v=u.iK.div`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: row;
`,f=(0,u.iK)(v)`
  flex: 1 0 auto;
`,y=(0,u.iK)(v)`
  flex: 1 0 auto;
  height: auto;
`,x=(0,u.iK)(v)`
  flex: 0 0 auto;
  height: ${t=>{let{theme:e}=t;return 16*e.gridUnit}}px;
  z-index: 0;
`,$=u.iK.div`
  ${t=>{let{theme:e}=t;return`\n  flex: 0 0 auto;\n  height: ${16*e.gridUnit}px;\n  border-bottom: 2px solid ${e.colors.grayscale.light2};\n\n  .header-with-actions {\n    height: ${15.5*e.gridUnit}px;\n  }\n  `}}
`,Z=u.iK.div`
  ${t=>{let{theme:e}=t;return`\n  margin: ${4*e.gridUnit}px;\n  font-size: ${e.typography.sizes.xl}px;\n  font-weight: ${e.typography.weights.bold};\n  `}}
`,w=u.iK.div`
  ${t=>{let{theme:e}=t;return`\n  width: ${80*e.gridUnit}px;\n  height: 100%;\n  border-right: 1px solid ${e.colors.grayscale.light2};\n  `}}
`,U=u.iK.div`
  width: 100%;
  position: relative;
`,S=u.iK.div`
  ${t=>{let{theme:e}=t;return`\n  border-left: 1px solid ${e.colors.grayscale.light2};\n  color: ${e.colors.success.base};\n  `}}
`,_=u.iK.div`
  ${t=>{let{theme:e}=t;return`\n  height: ${16*e.gridUnit}px;\n  width: 100%;\n  border-top: 1px solid ${e.colors.grayscale.light2};\n  border-bottom: 1px solid ${e.colors.grayscale.light2};\n  color: ${e.colors.info.base};\n  border-top: ${e.gridUnit/4}px solid\n    ${e.colors.grayscale.light2};\n  padding: ${4*e.gridUnit}px;\n  display: flex;\n  justify-content: flex-end;\n  background-color: ${e.colors.grayscale.light5};\n  z-index: ${e.zIndex.max}\n  `}}
`,z=u.iK.div`
  .ant-btn {
    span {
      margin-right: 0;
    }

    &:disabled {
      svg {
        color: ${t=>{let{theme:e}=t;return e.colors.grayscale.light1}};
      }
    }
  }
`,C=t=>h.iv`
  width: ${21.5*t.gridUnit}px;

  &:disabled {
    background-color: ${t.colors.grayscale.light3};
    color: ${t.colors.grayscale.light1};
  }
`;var T;!function(t){t[t.selectDatabase=0]="selectDatabase",t[t.selectSchema=1]="selectSchema",t[t.selectTable=2]="selectTable",t[t.changeDataset=3]="changeDataset"}(T||(T={}));const k=(0,o.t)("New dataset"),I={text:(0,o.t)("Select a database table and create dataset"),placement:"bottomRight"};function E(t){let{setDataset:e,title:n=k,editing:l=!1}=t;const i={title:null!=n?n:k,placeholder:k,onSave:t=>{e({type:T.changeDataset,payload:{name:"dataset_name",value:t}})},canEdit:!1,label:(0,o.t)("dataset name")};return(0,h.tZ)(z,null,l?(0,h.tZ)(r.u,{editableTitleProps:i,showTitlePanelItems:!1,showFaveStar:!1,faveStarProps:{itemId:1,saveFaveStar:()=>{}},titlePanelAdditionalItems:(0,h.tZ)(a.Fragment,null),rightPanelAdditionalItems:(0,h.tZ)(s.Z,{buttonStyle:"primary",tooltip:null==I?void 0:I.text,placement:null==I?void 0:I.placement,disabled:!0,css:C},(0,h.tZ)(d.Z.Save,{iconSize:"m"}),(0,o.t)("Save")),additionalActionsMenu:(0,h.tZ)(c.v,null,(0,h.tZ)(c.v.Item,null,(0,o.t)("Settings")),(0,h.tZ)(c.v.Item,null,(0,o.t)("Delete"))),menuDropdownProps:{disabled:!0},tooltipProps:I}):(0,h.tZ)(Z,null,n||k))}var K,P,D=n(82607),N=n(71262),V=n(5872),M=n.n(V),A=n(73727),F=n(55786),L=n(93197),R=n(94301);function j(){return j=Object.assign?Object.assign.bind():function(t){for(var e=1;e<arguments.length;e++){var n=arguments[e];for(var a in n)Object.prototype.hasOwnProperty.call(n,a)&&(t[a]=n[a])}return t},j.apply(this,arguments)}const O=function(t){return a.createElement("svg",j({width:160,height:166,viewBox:"0 0 160 166",fill:"none",xmlns:"http://www.w3.org/2000/svg"},t),K||(K=a.createElement("path",{fillRule:"evenodd",clipRule:"evenodd",d:"M123.638 8a.5.5 0 00-.5.5V158h28.758V8.5a.5.5 0 00-.5-.5h-27.758zM84.793 40.643a.5.5 0 01.5-.5h27.759a.5.5 0 01.5.5V158H84.793V40.643zM46.95 72.285a.5.5 0 00-.5.5V158h28.758V72.785a.5.5 0 00-.5-.5H46.95zM8.604 93.715a.5.5 0 00-.5.5V158h28.758V94.215a.5.5 0 00-.5-.5H8.604z",fill:"#FAFAFA"})),P||(P=a.createElement("path",{d:"M123.138 158h-.5v.5h.5v-.5zm28.758 0v.5h.5v-.5h-.5zm-38.344 0v.5h.5v-.5h-.5zm-28.759 0h-.5v.5h.5v-.5zm-38.344-.001h-.5v.5h.5v-.5zm28.758 0v.5h.5v-.5h-.5zM8.104 158h-.5v.5h.5v-.5zm28.758 0v.5h.5v-.5h-.5zM123.638 8.5v-1a1 1 0 00-1 1h1zm0 149.5V8.5h-1V158h1zm28.258-.5h-28.758v1h28.758v-1zm-.5-149V158h1V8.5h-1zm0 0h1a1 1 0 00-1-1v1zm-27.758 0h27.758v-1h-27.758v1zM85.293 39.643a1 1 0 00-1 1h1v-1zm27.759 0H85.293v1h27.759v-1zm1 1a1 1 0 00-1-1v1h1zm0 117.357V40.643h-1V158h1zm-29.259.5h28.759v-1H84.793v1zm-.5-117.857V158h1V40.643h-1zM46.95 72.785v-1a1 1 0 00-1 1h1zm0 85.214V72.785h-1V158h1zm28.258-.5H46.45v1h28.758v-1zm-.5-84.714V158h1V72.785h-1zm0 0h1a1 1 0 00-1-1v1zm-27.758 0h27.758v-1H46.95v1zM8.604 94.215v-1a1 1 0 00-1 1h1zm0 63.785V94.215h-1V158h1zm28.258-.5H8.104v1h28.758v-1zm-.5-63.285V158h1V94.215h-1zm0 0h1a1 1 0 00-1-1v1zm-27.758 0h27.758v-1H8.604v1z",fill:"#D9D9D9"})))};var q=n(14114),H=n(34858),X=n(18782),B=n(30381),G=n.n(B),Q=n(63279),Y=n(58593);const J=u.iK.div`
  & > span {
    width: 100%;
    display: flex;

    .ant-tooltip-open {
      display: inline;
    }
  }
`,W=u.iK.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: inline-block;
  width: 100%;
  vertical-align: bottom;
`,tt=u.iK.span`
  &:not(:last-child)::after {
    content: ', ';
  }
`,et=u.iK.div`
  .link {
    color: ${t=>{let{theme:e}=t;return e.colors.grayscale.light5}};
    display: block;
    text-decoration: underline;
  }
`,nt=u.iK.span`
  ${t=>{let{theme:e}=t;return`\n  cursor: pointer;\n  color: ${e.colors.primary.dark1};\n  font-weight: ${e.typography.weights.normal};\n  `}}
`;function at(t){let{items:e,renderVisibleItem:n=(t=>t),renderTooltipItem:l=(t=>t),getKey:i=(t=>t),maxLinks:r=20}=t;const s=(0,a.useRef)(null),d=(0,a.useRef)(null),[c,u]=(0,Q.ro)(s,d),g=(0,a.useMemo)((()=>e.length>r?e.length-r:void 0),[e,r]),p=(0,a.useMemo)((()=>(0,h.tZ)(W,{ref:s},e.map((t=>(0,h.tZ)(tt,{key:i(t)},n(t)))))),[i,e,n]),m=(0,a.useMemo)((()=>e.slice(0,r).map((t=>(0,h.tZ)(et,{key:i(t)},l(t))))),[i,e,r,l]);return(0,h.tZ)(J,null,(0,h.tZ)(Y.u,{placement:"top",title:c?(0,h.tZ)(a.Fragment,null,m,g&&(0,h.tZ)("span",null,(0,o.t)("+ %s more",g))):null},p,u&&(0,h.tZ)(nt,{ref:d},"+",c)))}const lt=t=>({key:t.id,to:`/superset/dashboard/${t.id}`,target:"_blank",rel:"noreferer noopener",children:t.dashboard_title}),it=t=>h.iv`
  color: ${t.colors.grayscale.light5};
  text-decoration: underline;
  &:hover {
    color: inherit;
  }
`,ot=[{key:"slice_name",title:(0,o.t)("Chart"),width:"320px",sorter:!0,render:(t,e)=>(0,h.tZ)(A.rU,{to:e.url},e.slice_name)},{key:"owners",title:(0,o.t)("Chart owners"),width:"242px",render:(t,e)=>{var n,a;return(0,h.tZ)(at,{items:null!=(n=null==(a=e.owners)?void 0:a.map((t=>`${t.first_name} ${t.last_name}`)))?n:[]})}},{key:"last_saved_at",title:(0,o.t)("Chart last modified"),width:"209px",sorter:!0,defaultSortOrder:"descend",render:(t,e)=>e.last_saved_at?G().utc(e.last_saved_at).fromNow():null},{key:"last_saved_by.first_name",title:(0,o.t)("Chart last modified by"),width:"216px",sorter:!0,render:(t,e)=>e.last_saved_by?`${e.last_saved_by.first_name} ${e.last_saved_by.last_name}`:null},{key:"dashboards",title:(0,o.t)("Dashboard usage"),width:"420px",render:(t,e)=>(0,h.tZ)(at,{items:e.dashboards,renderVisibleItem:t=>(0,h.tZ)(A.rU,lt(t)),renderTooltipItem:t=>(0,h.tZ)(A.rU,M()({},lt(t),{css:it})),getKey:t=>t.id})}],rt=t=>h.iv`
  && th.ant-table-cell {
    color: ${t.colors.grayscale.light1};
  }

  .ant-table-placeholder {
    display: none;
  }
`,st=(0,h.tZ)(a.Fragment,null,(0,h.tZ)(d.Z.PlusOutlined,{iconSize:"m",css:h.iv`
        & > .anticon {
          line-height: 0;
        }
      `}),(0,o.t)("Create chart with dataset")),dt=(0,u.iK)(R.XJ)`
  margin: ${t=>{let{theme:e}=t;return 13*e.gridUnit}}px 0;
`,ct=t=>{let{datasetId:e}=t;const{loading:n,recordCount:l,data:i,onChange:r}=(t=>{const{addDangerToast:e}=(0,q.e1)(),n=(0,a.useMemo)((()=>[{id:"datasource_id",operator:X.p.equals,value:t}]),[t]),{state:{loading:l,resourceCount:i,resourceCollection:r},fetchData:s}=(0,H.Yi)("chart",(0,o.t)("chart"),e,!0,[],n),d=(0,a.useMemo)((()=>r.map((t=>({...t,key:t.id})))),[r]),c=(0,a.useCallback)(((t,e,n)=>{var a,l;const i=(null!=(a=t.current)?a:1)-1,o=null!=(l=t.pageSize)?l:0,r=(0,F.Z)(n).filter((t=>{let{columnKey:e}=t;return"string"==typeof e})).map((t=>{let{columnKey:e,order:n}=t;return{id:e,desc:"descend"===n}}));s({pageIndex:i,pageSize:o,sortBy:r,filters:[]})}),[s]);return(0,a.useEffect)((()=>{s({pageIndex:0,pageSize:25,sortBy:[{id:"last_saved_at",desc:!0}],filters:[]})}),[s]),{loading:l,recordCount:i,data:d,onChange:c}})(e),s=(0,a.useCallback)((()=>window.open(`/explore/?dataset_type=table&dataset_id=${e}`,"_blank")),[e]);return(0,h.tZ)("div",{css:i.length?null:rt},(0,h.tZ)(L.ZP,{columns:ot,data:i,size:L.ex.MIDDLE,defaultPageSize:25,recordCount:l,loading:n,onChange:r}),i.length||n?null:(0,h.tZ)(dt,{image:(0,h.tZ)(O,null),title:(0,o.t)("No charts"),description:(0,o.t)("This dataset is not used to power any charts."),buttonText:st,buttonAction:s}))},ut=(0,u.iK)(N.ZP)`
  ${t=>{let{theme:e}=t;return`\n  margin-top: ${8.5*e.gridUnit}px;\n  padding-left: ${4*e.gridUnit}px;\n  padding-right: ${4*e.gridUnit}px;\n\n  .ant-tabs-top > .ant-tabs-nav::before {\n    width: ${50*e.gridUnit}px;\n  }\n  `}}
`,ht=u.iK.div`
  ${t=>{let{theme:e}=t;return`\n  .ant-badge {\n    width: ${8*e.gridUnit}px;\n    margin-left: ${2.5*e.gridUnit}px;\n  }\n  `}}
`,gt={USAGE_TEXT:(0,o.t)("Usage"),COLUMNS_TEXT:(0,o.t)("Columns"),METRICS_TEXT:(0,o.t)("Metrics")},pt=t=>{let{id:e}=t;const{usageCount:n}=(0,i.bI)(e),a=(0,h.tZ)(ht,null,(0,h.tZ)("span",null,gt.USAGE_TEXT),n>0&&(0,h.tZ)(D.Z,{count:n}));return(0,h.tZ)(ut,{moreIcon:null,fullWidth:!1},(0,h.tZ)(N.ZP.TabPane,{tab:gt.COLUMNS_TEXT,key:"1"}),(0,h.tZ)(N.ZP.TabPane,{tab:gt.METRICS_TEXT,key:"2"}),(0,h.tZ)(N.ZP.TabPane,{tab:a,key:"3"},(0,h.tZ)(ct,{datasetId:e})))};var mt=n(31069),bt=n(68492),vt=n(72570),ft=n(78580),yt=n.n(ft),xt=n(29487);const $t=(t,e,n)=>{var a;return null==e||null==(a=e[t])||null==a.localeCompare?void 0:a.localeCompare(null==n?void 0:n[t])};var Zt=n(89419);const wt=u.iK.div`
  padding: ${t=>{let{theme:e}=t;return 8*e.gridUnit}}px
    ${t=>{let{theme:e}=t;return 6*e.gridUnit}}px;

  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
`,Ut=(0,u.iK)(R.XJ)`
  max-width: 50%;

  p {
    width: ${t=>{let{theme:e}=t;return 115*e.gridUnit}}px;
  }
`,St=(0,o.t)("Datasets can be created from database tables or SQL queries. Select a database table to the left or "),_t=(0,o.t)("create dataset from SQL query"),zt=(0,o.t)(" to open SQL Lab. From there you can save the query as a dataset."),Ct=(0,o.t)("Select dataset source"),Tt=(0,o.t)("No table columns"),kt=(0,o.t)("This database table does not contain any data. Please select a different table."),It=(0,o.t)("An Error Occurred"),Et=(0,o.t)("Unable to load columns for the selected table. Please select a different table."),Kt=t=>{const{hasError:e,tableName:n,hasColumns:l}=t;let i="empty-dataset.svg",o=Ct,r=(0,h.tZ)(a.Fragment,null,St,(0,h.tZ)("span",{role:"button",onClick:()=>{window.location.href="/superset/sqllab"},tabIndex:0},_t),zt);return e?(o=It,r=(0,h.tZ)(a.Fragment,null,Et),i=void 0):n&&!l&&(i="no-columns.svg",o=Tt,r=(0,h.tZ)(a.Fragment,null,kt)),(0,h.tZ)(wt,null,(0,h.tZ)(Ut,{image:i,title:o,description:r}))};var Pt;!function(t){t.ABSOLUTE="absolute",t.RELATIVE="relative"}(Pt||(Pt={}));const Dt=u.iK.div`
  ${t=>{let{theme:e,position:n}=t;return`\n  position: ${n};\n  margin: ${4*e.gridUnit}px\n    ${3*e.gridUnit}px\n    ${3*e.gridUnit}px\n    ${6*e.gridUnit}px;\n  font-size: ${6*e.gridUnit}px;\n  font-weight: ${e.typography.weights.medium};\n  padding-bottom: ${3*e.gridUnit}px;\n\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n\n  .anticon:first-of-type {\n    margin-right: ${4*e.gridUnit}px;\n  }\n\n  .anticon:nth-of-type(2) {\n    margin-left: ${4*e.gridUnit}px;\n  `}}
`,Nt=u.iK.div`
  ${t=>{let{theme:e}=t;return`\n  margin-left: ${6*e.gridUnit}px;\n  margin-bottom: ${3*e.gridUnit}px;\n  font-weight: ${e.typography.weights.bold};\n  `}}
`,Vt=u.iK.div`
  ${t=>{let{theme:e}=t;return`\n  padding: ${8*e.gridUnit}px\n    ${6*e.gridUnit}px;\n  box-sizing: border-box;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  height: 100%;\n  position: absolute;\n  top: 0;\n  bottom: 0;\n  left: 0;\n  right: 0;\n  `}}
`,Mt=u.iK.div`
  ${t=>{let{theme:e}=t;return`\n  max-width: 50%;\n  width: 200px;\n\n  img {\n    width: 120px;\n    margin-left: 40px;\n  }\n\n  div {\n    width: 100%;\n    margin-top: ${3*e.gridUnit}px;\n    text-align: center;\n    font-weight: ${e.typography.weights.normal};\n    font-size: ${e.typography.sizes.l}px;\n    color: ${e.colors.grayscale.light1};\n  }\n  `}}
`,At=u.iK.div`
  ${t=>{let{theme:e}=t;return`\n  position: relative;\n  margin: ${3*e.gridUnit}px;\n  margin-left: ${6*e.gridUnit}px;\n  height: calc(100% - ${60*e.gridUnit}px);\n  overflow: auto;\n  `}}
`,Ft=u.iK.div`
  ${t=>{let{theme:e}=t;return`\n  position: relative;\n  margin: ${3*e.gridUnit}px;\n  margin-left: ${6*e.gridUnit}px;\n  height: calc(100% - ${30*e.gridUnit}px);\n  overflow: auto;\n  `}}
`,Lt=u.iK.div`
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  right: 0;
`,Rt=(0,u.iK)(xt.Z)`
  ${t=>{let{theme:e}=t;return`\n  border: 1px solid ${e.colors.info.base};\n  padding: ${4*e.gridUnit}px;\n  margin: ${6*e.gridUnit}px ${6*e.gridUnit}px\n    ${8*e.gridUnit}px;\n  .view-dataset-button {\n    position: absolute;\n    top: ${4*e.gridUnit}px;\n    right: ${4*e.gridUnit}px;\n    font-weight: ${e.typography.weights.normal};\n\n    &:hover {\n      color: ${e.colors.secondary.dark3};\n      text-decoration: underline;\n    }\n  }\n  `}}
`,jt=(0,o.t)("Refreshing columns"),Ot=(0,o.t)("Table columns"),qt=(0,o.t)("Loading"),Ht=["5","10","15","25"],Xt=[{title:"Column Name",dataIndex:"name",key:"name",sorter:(t,e)=>$t("name",t,e)},{title:"Datatype",dataIndex:"type",key:"type",width:"100px",sorter:(t,e)=>$t("type",t,e)}],Bt=(0,o.t)("This table already has a dataset associated with it. You can only associate one dataset with a table.\n"),Gt=(0,o.t)("View Dataset"),Qt=t=>{var e;let{tableName:n,columnList:l,loading:i,hasError:r,datasets:s}=t;const c=(0,u.Fg)(),g=null!=(e=(null==l?void 0:l.length)>0)&&e,p=null==s?void 0:s.map((t=>t.table_name)),m=null==s?void 0:s.find((t=>t.table_name===n));let b,v;return i&&(v=(0,h.tZ)(Vt,null,(0,h.tZ)(Mt,null,(0,h.tZ)("img",{alt:qt,src:Zt}),(0,h.tZ)("div",null,jt)))),i||(b=!i&&n&&g&&!r?(0,h.tZ)(a.Fragment,null,(0,h.tZ)(Nt,null,Ot),m?(0,h.tZ)(At,null,(0,h.tZ)(Lt,null,(0,h.tZ)(L.ZP,{loading:i,size:L.ex.SMALL,columns:Xt,data:l,pageSizeOptions:Ht,defaultPageSize:25}))):(0,h.tZ)(Ft,null,(0,h.tZ)(Lt,null,(0,h.tZ)(L.ZP,{loading:i,size:L.ex.SMALL,columns:Xt,data:l,pageSizeOptions:Ht,defaultPageSize:25})))):(0,h.tZ)(Kt,{hasColumns:g,hasError:r,tableName:n})),(0,h.tZ)(a.Fragment,null,n&&(0,h.tZ)(a.Fragment,null,(null==p?void 0:yt()(p).call(p,n))&&(f=m,(0,h.tZ)(Rt,{closable:!1,type:"info",showIcon:!0,message:(0,o.t)("This table already has a dataset"),description:(0,h.tZ)(a.Fragment,null,Bt,(0,h.tZ)("span",{role:"button",onClick:()=>{window.open(null==f?void 0:f.explore_url,"_blank","noreferrer noopener popup=false")},tabIndex:0,className:"view-dataset-button"},Gt))})),(0,h.tZ)(Dt,{position:!i&&g?Pt.RELATIVE:Pt.ABSOLUTE,title:n||""},n&&(0,h.tZ)(d.Z.Table,{iconColor:c.colors.grayscale.base}),n)),b,v);var f},Yt=t=>{let{tableName:e,dbId:n,schema:l,setHasColumns:i,datasets:r}=t;const[s,d]=(0,a.useState)([]),[c,u]=(0,a.useState)(!1),[g,p]=(0,a.useState)(!1),m=(0,a.useRef)(e);return(0,a.useEffect)((()=>{m.current=e,e&&l&&n&&(async t=>{const{dbId:e,tableName:n,schema:a}=t;u(!0),null==i||i(!1);const l=`/api/v1/database/${e}/table/${n}/${a}/`;try{const t=await mt.Z.get({endpoint:l});if((t=>{let e=!0;if("string"!=typeof(null==t?void 0:t.name)&&(e=!1),e&&!Array.isArray(t.columns)&&(e=!1),e&&t.columns.length>0){const n=t.columns.some(((t,e)=>{const n=(t=>{let e=!0;const n="The object provided to isITableColumn does match the interface.";return"string"!=typeof(null==t?void 0:t.name)&&(e=!1,console.error(`${n} The property 'name' is required and must be a string`)),e&&"string"!=typeof(null==t?void 0:t.type)&&(e=!1,console.error(`${n} The property 'type' is required and must be a string`)),e})(t);return n||console.error(`The provided object does not match the IDatabaseTable interface. columns[${e}] is invalid and does not match the ITableColumn interface`),!n}));e=!n}return e})(null==t?void 0:t.json)){const e=t.json;e.name===m.current&&(d(e.columns),null==i||i(e.columns.length>0),p(!1))}else d([]),null==i||i(!1),p(!0),(0,vt.Gb)((0,o.t)("The API response from %s does not match the IDatabaseTable interface.",l)),bt.Z.error((0,o.t)("The API response from %s does not match the IDatabaseTable interface.",l))}catch(t){d([]),null==i||i(!1),p(!0)}finally{u(!1)}})({tableName:e,dbId:n,schema:l})}),[e,n,l]),(0,h.tZ)(Qt,{columnList:s,hasError:g,loading:c,tableName:e,datasets:r})};var Jt=n(15926),Wt=n.n(Jt),te=n(9875),ee=n(49238),ne=n(17982),ae=n(40277),le=n(38703),ie=n(73995),oe=n(61337);const re=(0,u.iK)(d.Z.Search)`
  color: ${t=>{let{theme:e}=t;return e.colors.grayscale.light1}};
`,se=u.iK.div`
  ${t=>{let{theme:e}=t;return`\n    max-width: ${87.5*e.gridUnit}px;\n    padding: ${4*e.gridUnit}px;\n    height: 100%;\n    background-color: ${e.colors.grayscale.light5};\n    position: relative;\n    .emptystate {\n      height: auto;\n      margin-top: ${17.5*e.gridUnit}px;\n    }\n    .refresh {\n      position: absolute;\n      top: ${38.75*e.gridUnit}px;\n      left: ${16.75*e.gridUnit}px;\n      span[role="button"]{\n        font-size: ${4.25*e.gridUnit}px;\n      }\n    }\n    .section-title {\n      margin-top: ${5.5*e.gridUnit}px;\n      margin-bottom: ${11*e.gridUnit}px;\n      font-weight: ${e.typography.weights.bold};\n    }\n    .table-title {\n      margin-top: ${11*e.gridUnit}px;\n      margin-bottom: ${6*e.gridUnit}px;\n      font-weight: ${e.typography.weights.bold};\n    }\n    .options-list {\n      overflow: auto;\n      position: absolute;\n      bottom: 0;\n      top: ${92.25*e.gridUnit}px;\n      left: ${3.25*e.gridUnit}px;\n      right: 0;\n\n      .no-scrollbar {\n        margin-right: ${4*e.gridUnit}px;\n      }\n\n      .options {\n        cursor: pointer;\n        padding: ${1.75*e.gridUnit}px;\n        border-radius: ${e.borderRadius}px;\n        :hover {\n          background-color: ${e.colors.grayscale.light4}\n        }\n      }\n\n      .options-highlighted {\n        cursor: pointer;\n        padding: ${1.75*e.gridUnit}px;\n        border-radius: ${e.borderRadius}px;\n        background-color: ${e.colors.primary.dark1};\n        color: ${e.colors.grayscale.light5};\n      }\n\n      .options, .options-highlighted {\n        display: flex;\n        align-items: center;\n        justify-content: space-between;\n      }\n    }\n    form > span[aria-label="refresh"] {\n      position: absolute;\n      top: ${69*e.gridUnit}px;\n      left: ${42.75*e.gridUnit}px;\n      font-size: ${4.25*e.gridUnit}px;\n    }\n    .table-form {\n      margin-bottom: ${8*e.gridUnit}px;\n    }\n    .loading-container {\n      position: absolute;\n      top: ${89.75*e.gridUnit}px;\n      left: 0;\n      right: 0;\n      text-align: center;\n      img {\n        width: ${20*e.gridUnit}px;\n        margin-bottom: ${2.5*e.gridUnit}px;\n      }\n      p {\n        color: ${e.colors.grayscale.light1};\n      }\n    }\n`}}
`;function de(t){var e,n,l;let{setDataset:i,dataset:r,datasetNames:s}=t;const c=(0,u.Fg)(),[g,p]=(0,a.useState)([]),[m,b]=(0,a.useState)(!1),[v,f]=(0,a.useState)(!1),[y,x]=(0,a.useState)(""),[$,Z]=(0,a.useState)(!1),[w,U]=(0,a.useState)(null),{addDangerToast:S}=(0,q.e1)(),_=(0,a.useCallback)((t=>{i({type:T.selectDatabase,payload:{db:t}}),U(null),b(!0)}),[i]),z=(0,a.useCallback)((t=>{mt.Z.get({url:t}).then((t=>{let{json:e}=t;const n=e.result.map((t=>({value:t.value,label:(0,h.tZ)(ne.ez,{table:t}),text:t.label})));p(n),f(!1),b(!1),Z(!1)})).catch((t=>{S((0,o.t)("There was an error fetching tables")),bt.Z.error((0,o.t)("There was an error fetching tables"),t)}))}),[S]),C=null!=r&&r.schema?encodeURIComponent(null==r?void 0:r.schema):void 0;(0,a.useEffect)((()=>{const t=(0,oe.rV)(oe.dR.db,null);t&&_(t)}),[_]),(0,a.useEffect)((()=>{if(v){var t;const e=Wt().encode({force:$,schema_name:C}),n=`/api/v1/database/${null==r||null==(t=r.db)?void 0:t.id}/tables/?q=${e}`;z(n)}}),[v,null==r||null==(e=r.db)?void 0:e.id,C,z,$]),(0,a.useEffect)((()=>{m&&(p([]),b(!1))}),[m]);const k=g.filter((t=>{var e,n;return null==t||null==(e=t.value)?void 0:yt()(n=e.toLowerCase()).call(n,y.toLowerCase())})),I=t=>(0,h.tZ)("div",{className:"loading-container"},(0,h.tZ)(le.Z,{position:"inline"}),(0,h.tZ)("p",null,t)),E=(0,o.t)("Select database & schema"),K=(0,o.t)("Table loading"),P=(0,o.t)("No database tables found"),D=(0,o.t)("Try selecting a different schema"),N=(0,o.t)("Select database table"),V=(0,o.t)("Refresh table list"),M=(0,o.t)("Refresh tables"),A=(0,o.t)("Search tables"),F=document.getElementsByClassName("options-list"),L=(null==(n=F[0])?void 0:n.scrollHeight)>(null==(l=F[0])?void 0:l.clientHeight),[j,O]=(0,a.useState)(!1);return(0,h.tZ)(se,null,(0,h.tZ)("p",{className:"section-title db-schema"},E),(0,h.tZ)(ie.Z,{db:null==r?void 0:r.db,handleError:S,onDbChange:_,onSchemaChange:t=>{t&&(i({type:T.selectSchema,payload:{name:"schema",value:t}}),f(!0)),U(null),b(!0)},emptyState:(0,R.UX)(j),onEmptyResults:t=>{O(!!t)}}),v&&!$&&I(K),(null==r?void 0:r.schema)&&!v&&!g.length&&!y&&(0,h.tZ)("div",{className:"emptystate"},(0,h.tZ)(R.x3,{image:"empty-table.svg",title:P,description:D})),(null==r?void 0:r.schema)&&(g.length>0||y.length>0)&&(0,h.tZ)(a.Fragment,null,(0,h.tZ)(ee.l0,null,(0,h.tZ)("p",{className:"table-title"},N),(0,h.tZ)(ae.Z,{onClick:()=>{f(!0),Z(!0)},tooltipContent:V}),$&&I(M),!$&&(0,h.tZ)(te.II,{value:y,prefix:(0,h.tZ)(re,{iconSize:"l"}),onChange:t=>{x(t.target.value)},className:"table-form",placeholder:A,allowClear:!0})),(0,h.tZ)("div",{className:"options-list"},!$&&k.map(((t,e)=>(0,h.tZ)("div",{className:w===e?L?"options-highlighted":"options-highlighted no-scrollbar":L?"options":"options no-scrollbar",key:e,role:"button",tabIndex:0,onClick:()=>{return n=t.value,U(e),void i({type:T.selectTable,payload:{name:"table_name",value:n}});var n}},t.label,(null==s?void 0:yt()(s).call(s,t.value))&&(0,h.tZ)(d.Z.Warning,{iconColor:w===e?c.colors.grayscale.light5:c.colors.info.base,iconSize:"m",css:h.iv`
                        margin-right: ${2*c.gridUnit}px;
                      `})))))))}var ce=n(97381),ue=n(3741);const he=["db","schema","table_name"],ge=[ue.Ph,ue.FY,ue.Eh,ue.TA],pe=(0,q.ZP)((function(t){let{datasetObject:e,addDangerToast:n,hasColumns:i=!1,datasets:r}=t;const d=(0,l.k6)(),{createResource:c}=(0,H.LE)("dataset",(0,o.t)("dataset"),n),u=(0,o.t)("Select a database table."),g=(0,o.t)("Create dataset and create chart"),p=!(null!=e&&e.table_name)||!i||(null==r?void 0:yt()(r).call(r,null==e?void 0:e.table_name));return(0,h.tZ)(a.Fragment,null,(0,h.tZ)(s.Z,{onClick:()=>{if(e){const t=(t=>{let e=0;const n=Object.keys(t).reduce(((n,a)=>(yt()(he).call(he,a)&&t[a]&&(e+=1),e)),0);return ge[n]})(e);(0,ce.logEvent)(t,e)}else(0,ce.logEvent)(ue.Ph,{});d.goBack()}},(0,o.t)("Cancel")),(0,h.tZ)(s.Z,{buttonStyle:"primary",disabled:p,tooltip:null!=e&&e.table_name?void 0:u,onClick:()=>{if(e){var t;const n={database:null==(t=e.db)?void 0:t.id,schema:e.schema,table_name:e.table_name};c(n).then((t=>{t&&"number"==typeof t&&((0,ce.logEvent)(ue.P$,e),d.push(`/chart/add/?dataset=${e.table_name}`))}))}}},g))}));function me(t){let{header:e,leftPanel:n,datasetPanel:a,rightPanel:l,footer:i}=t;return(0,h.tZ)(g,null,e&&(0,h.tZ)($,null,e),(0,h.tZ)(f,null,n&&(0,h.tZ)(m,null,(0,h.tZ)(w,null,n)),(0,h.tZ)(b,null,(0,h.tZ)(y,null,a&&(0,h.tZ)(U,null,a),l&&(0,h.tZ)(S,null,l)),(0,h.tZ)(x,null,i&&(0,h.tZ)(_,null,i)))))}function be(t,e){const n={...t||{}};switch(e.type){case T.selectDatabase:return{...n,...e.payload,schema:null,table_name:null};case T.selectSchema:return{...n,[e.payload.name]:e.payload.value,table_name:null};case T.selectTable:return{...n,[e.payload.name]:e.payload.value};case T.changeDataset:return{...n,[e.payload.name]:e.payload.value};default:return null}}function ve(){const[t,e]=(0,a.useReducer)(be,null),[n,o]=(0,a.useState)(!1),[r,s]=(0,a.useState)(!1),{datasets:d,datasetNames:c}=(0,i.Fk)(null==t?void 0:t.db,null==t?void 0:t.schema),{datasetId:u}=(0,l.UO)();return(0,a.useEffect)((()=>{Number.isNaN(parseInt(u,10))||s(!0)}),[u]),(0,h.tZ)(me,{header:(0,h.tZ)(E,{setDataset:e,title:null==t?void 0:t.table_name}),leftPanel:r?null:(0,h.tZ)(de,{setDataset:e,dataset:t,datasetNames:c}),datasetPanel:r?(0,h.tZ)(pt,{id:u}):(0,h.tZ)(Yt,{tableName:null==t?void 0:t.table_name,dbId:null==t||null==(g=t.db)?void 0:g.id,schema:null==t?void 0:t.schema,setHasColumns:o,datasets:d}),footer:(0,h.tZ)(pe,{url:"/tablemodelview/list/?pageIndex=0&sortColumn=changed_on_delta_humanized&sortOrder=desc",datasetObject:t,hasColumns:n,datasets:c})});var g}},14025:(t,e,n)=>{n.d(e,{Cq:()=>c,Fk:()=>u,bI:()=>h});var a=n(67294),l=n(31069),i=n(55867),o=n(68492),r=n(15926),s=n.n(r),d=n(72570);function c(t){let{queries:e,fetchData:n,currentQueryId:l}=t;const i=e.findIndex((t=>t.id===l)),[o,r]=(0,a.useState)(i),[s,d]=(0,a.useState)(!1),[c,u]=(0,a.useState)(!1);function h(){d(0===o),u(o===e.length-1)}function g(t){const a=o+(t?-1:1);a>=0&&a<e.length&&(n(e[a].id),r(a),h())}return(0,a.useEffect)((()=>{h()})),{handleKeyPress:function(t){o>=0&&o<e.length&&("ArrowDown"===t.key||"k"===t.key?(t.preventDefault(),g(!1)):"ArrowUp"!==t.key&&"j"!==t.key||(t.preventDefault(),g(!0)))},handleDataChange:g,disablePrevious:s,disableNext:c}}const u=(t,e)=>{const[n,r]=(0,a.useState)([]),c=e?encodeURIComponent(e):void 0,u=(0,a.useCallback)((async t=>{let e,n=[],a=0;for(;void 0===e||n.length<e;){const r=s().encode_uri({filters:t,page:a});try{const t=await l.Z.get({endpoint:`/api/v1/dataset/?q=${r}`});({count:e}=t.json);const{json:{result:i}}=t;n=[...n,...i],a+=1}catch(t){(0,d.Gb)((0,i.t)("There was an error fetching dataset")),o.Z.error((0,i.t)("There was an error fetching dataset"),t)}}r(n)}),[]);(0,a.useEffect)((()=>{const n=[{col:"database",opr:"rel_o_m",value:null==t?void 0:t.id},{col:"schema",opr:"eq",value:c},{col:"sql",opr:"dataset_is_null_or_empty",value:!0}];e&&u(n)}),[null==t?void 0:t.id,e,c,u]);const h=null==n?void 0:n.map((t=>t.table_name));return{datasets:n,datasetNames:h}},h=t=>{const[e,n]=(0,a.useState)(0),r=(0,a.useCallback)((()=>l.Z.get({endpoint:`/api/v1/dataset/${t}/related_objects`}).then((t=>{let{json:e}=t;n(null==e?void 0:e.charts.count)})).catch((t=>{(0,d.Gb)((0,i.t)("There was an error fetching dataset's related objects")),o.Z.error(t)}))),[t]);return(0,a.useEffect)((()=>{t&&r()}),[t,r]),{usageCount:e}}}}]);
//# sourceMappingURL=3f7e876e8c06f5fab5f4.chunk.js.map
