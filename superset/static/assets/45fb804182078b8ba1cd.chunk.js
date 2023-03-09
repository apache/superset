"use strict";(globalThis.webpackChunksuperset=globalThis.webpackChunksuperset||[]).push([[7633],{95413:(e,t,r)=>{r.d(t,{Y:()=>s});var a=r(55867);const s={name:(0,a.t)("SQL"),tabs:[{name:"Saved queries",label:(0,a.t)("Saved queries"),url:"/savedqueryview/list/",usesRouter:!0},{name:"Query history",label:(0,a.t)("Query history"),url:"/superset/sqllab/history/",usesRouter:!0}]}},31673:(e,t,r)=>{r.d(t,{Z:()=>y});var a=r(5872),s=r.n(a),l=(r(67294),r(51995)),n=r(55867),o=r(33743),i=r(49889),u=r(53459),c=r(22489),d=r(120),h=r(42110),p=r(70163),g=r(10222),b=r(11965);h.Z.registerLanguage("sql",o.Z),h.Z.registerLanguage("markdown",u.Z),h.Z.registerLanguage("html",i.Z),h.Z.registerLanguage("json",c.Z);const m=l.iK.div`
  margin-top: -24px;

  &:hover {
    svg {
      visibility: visible;
    }
  }

  svg {
    position: relative;
    top: 40px;
    left: 512px;
    visibility: hidden;
    margin: -4px;
    color: ${e=>{let{theme:t}=e;return t.colors.grayscale.base}};
  }
`;function y(e){let{addDangerToast:t,addSuccessToast:r,children:a,...l}=e;return(0,b.tZ)(m,null,(0,b.tZ)(p.Z.Copy,{tabIndex:0,role:"button",onClick:e=>{var s;e.preventDefault(),e.currentTarget.blur(),s=a,(0,g.Z)((()=>Promise.resolve(s))).then((()=>{r&&r((0,n.t)("SQL Copied!"))})).catch((()=>{t&&t((0,n.t)("Sorry, your browser does not support copying."))}))}}),(0,b.tZ)(h.Z,s()({style:d.Z},l),a))}},14025:(e,t,r)=>{r.d(t,{Cq:()=>c,Fk:()=>d,bI:()=>h});var a=r(67294),s=r(31069),l=r(55867),n=r(68492),o=r(15926),i=r.n(o),u=r(72570);function c(e){let{queries:t,fetchData:r,currentQueryId:s}=e;const l=t.findIndex((e=>e.id===s)),[n,o]=(0,a.useState)(l),[i,u]=(0,a.useState)(!1),[c,d]=(0,a.useState)(!1);function h(){u(0===n),d(n===t.length-1)}function p(e){const a=n+(e?-1:1);a>=0&&a<t.length&&(r(t[a].id),o(a),h())}return(0,a.useEffect)((()=>{h()})),{handleKeyPress:function(e){n>=0&&n<t.length&&("ArrowDown"===e.key||"k"===e.key?(e.preventDefault(),p(!1)):"ArrowUp"!==e.key&&"j"!==e.key||(e.preventDefault(),p(!0)))},handleDataChange:p,disablePrevious:i,disableNext:c}}const d=(e,t)=>{const[r,o]=(0,a.useState)([]),c=t?encodeURIComponent(t):void 0,d=(0,a.useCallback)((async e=>{let t,r=[],a=0;for(;void 0===t||r.length<t;){const o=i().encode_uri({filters:e,page:a});try{const e=await s.Z.get({endpoint:`/api/v1/dataset/?q=${o}`});({count:t}=e.json);const{json:{result:l}}=e;r=[...r,...l],a+=1}catch(e){(0,u.Gb)((0,l.t)("There was an error fetching dataset")),n.Z.error((0,l.t)("There was an error fetching dataset"),e)}}o(r)}),[]);(0,a.useEffect)((()=>{const r=[{col:"database",opr:"rel_o_m",value:null==e?void 0:e.id},{col:"schema",opr:"eq",value:c},{col:"sql",opr:"dataset_is_null_or_empty",value:!0}];t&&d(r)}),[null==e?void 0:e.id,t,c,d]);const h=null==r?void 0:r.map((e=>e.table_name));return{datasets:r,datasetNames:h}},h=e=>{const[t,r]=(0,a.useState)(0),o=(0,a.useCallback)((()=>s.Z.get({endpoint:`/api/v1/dataset/${e}/related_objects`}).then((e=>{let{json:t}=e;r(null==t?void 0:t.charts.count)})).catch((e=>{(0,u.Gb)((0,l.t)("There was an error fetching dataset's related objects")),n.Z.error(e)}))),[e]);return(0,a.useEffect)((()=>{e&&o()}),[e,o]),{usageCount:t}}},82842:(e,t,r)=>{r.r(t),r.d(t,{default:()=>J});var a=r(67294),s=r(51995),l=r(55867),n=r(31069),o=r(43716),i=r(30381),u=r.n(i),c=r(40768),d=r(14114),h=r(34858),p=r(20755),g=r(76697),b=r(95413),m=r(18782),y=r(58593),Z=r(42110),v=r(33743),f=r(120),q=r(27600),x=r(12),w=r(70163),S=r(74069),C=r(94184),k=r.n(C),$=r(35932),T=r(31673),_=r(14025),D=r(11965);const L=s.iK.div`
  color: ${e=>{let{theme:t}=e;return t.colors.secondary.light2}};
  font-size: ${e=>{let{theme:t}=e;return t.typography.sizes.s}}px;
  margin-bottom: 0;
  text-transform: uppercase;
`,z=s.iK.div`
  color: ${e=>{let{theme:t}=e;return t.colors.grayscale.dark2}};
  font-size: ${e=>{let{theme:t}=e;return t.typography.sizes.m}}px;
  padding: 4px 0 24px 0;
`,H=s.iK.div`
  margin: 0 0 ${e=>{let{theme:t}=e;return 6*t.gridUnit}}px 0;
`,I=s.iK.div`
  display: inline;
  font-size: ${e=>{let{theme:t}=e;return t.typography.sizes.s}}px;
  padding: ${e=>{let{theme:t}=e;return 2*t.gridUnit}}px
    ${e=>{let{theme:t}=e;return 4*t.gridUnit}}px;
  margin-right: ${e=>{let{theme:t}=e;return 4*t.gridUnit}}px;
  color: ${e=>{let{theme:t}=e;return t.colors.secondary.dark1}};

  &.active,
  &:focus,
  &:hover {
    background: ${e=>{let{theme:t}=e;return t.colors.secondary.light4}};
    border-bottom: none;
    border-radius: ${e=>{let{theme:t}=e;return t.borderRadius}}px;
    margin-bottom: ${e=>{let{theme:t}=e;return 2*t.gridUnit}}px;
  }

  &:hover:not(.active) {
    background: ${e=>{let{theme:t}=e;return t.colors.secondary.light5}};
  }
`,U=(0,s.iK)(S.Z)`
  .ant-modal-body {
    padding: ${e=>{let{theme:t}=e;return 6*t.gridUnit}}px;
  }

  pre {
    font-size: ${e=>{let{theme:t}=e;return t.typography.sizes.xs}}px;
    font-weight: ${e=>{let{theme:t}=e;return t.typography.weights.normal}};
    line-height: ${e=>{let{theme:t}=e;return t.typography.sizes.l}}px;
    height: 375px;
    border: none;
  }
`,E=(0,d.ZP)((function(e){let{onHide:t,openInSqlLab:r,queries:s,query:n,fetchData:o,show:i,addDangerToast:u,addSuccessToast:c}=e;const{handleKeyPress:d,handleDataChange:h,disablePrevious:p,disableNext:g}=(0,_.Cq)({queries:s,currentQueryId:n.id,fetchData:o}),[b,m]=(0,a.useState)("user"),{id:y,sql:Z,executed_sql:v}=n;return(0,D.tZ)("div",{role:"none",onKeyUp:d},(0,D.tZ)(U,{onHide:t,show:i,title:(0,l.t)("Query preview"),footer:(0,D.tZ)(a.Fragment,null,(0,D.tZ)($.Z,{key:"previous-query",disabled:p,onClick:()=>h(!0)},(0,l.t)("Previous")),(0,D.tZ)($.Z,{key:"next-query",disabled:g,onClick:()=>h(!1)},(0,l.t)("Next")),(0,D.tZ)($.Z,{key:"open-in-sql-lab",buttonStyle:"primary",onClick:()=>r(y)},(0,l.t)("Open in SQL Lab")))},(0,D.tZ)(L,null,(0,l.t)("Tab name")),(0,D.tZ)(z,null,n.tab_name),(0,D.tZ)(H,null,(0,D.tZ)(I,{role:"button",className:k()({active:"user"===b}),onClick:()=>m("user")},(0,l.t)("User query")),(0,D.tZ)(I,{role:"button",className:k()({active:"executed"===b}),onClick:()=>m("executed")},(0,l.t)("Executed query"))),(0,D.tZ)(T.Z,{addDangerToast:u,addSuccessToast:c,language:"sql"},("user"===b?Z:v)||"")))})),K=(0,s.iK)(m.Z)`
  table .table-cell {
    vertical-align: top;
  }
`;Z.Z.registerLanguage("sql",v.Z);const N=(0,s.iK)(Z.Z)`
  height: ${e=>{let{theme:t}=e;return 26*t.gridUnit}}px;
  overflow: hidden !important; /* needed to override inline styles */
  text-overflow: ellipsis;
  white-space: nowrap;
`,Q=s.iK.div`
  .count {
    margin-left: 5px;
    color: ${e=>{let{theme:t}=e;return t.colors.primary.base}};
    text-decoration: underline;
    cursor: pointer;
  }
`,A=s.iK.div`
  color: ${e=>{let{theme:t}=e;return t.colors.grayscale.dark2}};
`,J=(0,d.ZP)((function(e){let{addDangerToast:t}=e;const{state:{loading:r,resourceCount:i,resourceCollection:d},fetchData:Z}=(0,h.Yi)("query",(0,l.t)("Query history"),t,!1),[v,S]=(0,a.useState)(),C=(0,s.Fg)(),k=(0,a.useCallback)((e=>{n.Z.get({endpoint:`/api/v1/query/${e}`}).then((e=>{let{json:t={}}=e;S({...t.result})}),(0,c.v$)((e=>t((0,l.t)("There was an issue previewing the selected query. %s",e)))))}),[t]),$={activeChild:"Query history",...b.Y},T=[{id:x.J.start_time,desc:!0}],_=(0,a.useMemo)((()=>[{Cell:e=>{let{row:{original:{status:t}}}=e;const r={name:null,label:""};return t===o.Tb.SUCCESS?(r.name=(0,D.tZ)(w.Z.Check,{iconColor:C.colors.success.base}),r.label=(0,l.t)("Success")):t===o.Tb.FAILED||t===o.Tb.STOPPED?(r.name=(0,D.tZ)(w.Z.XSmall,{iconColor:t===o.Tb.FAILED?C.colors.error.base:C.colors.grayscale.base}),r.label=(0,l.t)("Failed")):t===o.Tb.RUNNING?(r.name=(0,D.tZ)(w.Z.Running,{iconColor:C.colors.primary.base}),r.label=(0,l.t)("Running")):t===o.Tb.TIMED_OUT?(r.name=(0,D.tZ)(w.Z.Offline,{iconColor:C.colors.grayscale.light1}),r.label=(0,l.t)("Offline")):t!==o.Tb.SCHEDULED&&t!==o.Tb.PENDING||(r.name=(0,D.tZ)(w.Z.Queued,{iconColor:C.colors.grayscale.base}),r.label=(0,l.t)("Scheduled")),(0,D.tZ)(y.u,{title:r.label,placement:"bottom"},(0,D.tZ)("span",null,r.name))},accessor:x.J.status,size:"xs",disableSortBy:!0},{accessor:x.J.start_time,Header:(0,l.t)("Time"),size:"xl",Cell:e=>{let{row:{original:{start_time:t,end_time:r}}}=e;const s=u().utc(t).local().format(q.v2).split(" "),n=(0,D.tZ)(a.Fragment,null,s[0]," ",(0,D.tZ)("br",null),s[1]);return r?(0,D.tZ)(y.u,{title:(0,l.t)("Duration: %s",u()(u().utc(r-t)).format(q.n2)),placement:"bottom"},(0,D.tZ)("span",null,n)):n}},{accessor:x.J.tab_name,Header:(0,l.t)("Tab name"),size:"xl"},{accessor:x.J.database_name,Header:(0,l.t)("Database"),size:"xl"},{accessor:x.J.database,hidden:!0},{accessor:x.J.schema,Header:(0,l.t)("Schema"),size:"xl"},{Cell:e=>{let{row:{original:{sql_tables:t=[]}}}=e;const r=t.map((e=>e.table)),s=r.length>0?r.shift():"";return r.length?(0,D.tZ)(Q,null,(0,D.tZ)("span",null,s),(0,D.tZ)(g.ZP,{placement:"right",title:(0,l.t)("TABLES"),trigger:"click",content:(0,D.tZ)(a.Fragment,null,r.map((e=>(0,D.tZ)(A,{key:e},e))))},(0,D.tZ)("span",{className:"count"},"(+",r.length,")"))):s},accessor:x.J.sql_tables,Header:(0,l.t)("Tables"),size:"xl",disableSortBy:!0},{accessor:x.J.user_first_name,Header:(0,l.t)("User"),size:"xl",Cell:e=>{let{row:{original:{user:t}}}=e;return t?`${t.first_name} ${t.last_name}`:""}},{accessor:x.J.user,hidden:!0},{accessor:x.J.rows,Header:(0,l.t)("Rows"),size:"md"},{accessor:x.J.sql,Header:(0,l.t)("SQL"),Cell:e=>{let{row:{original:t,id:r}}=e;return(0,D.tZ)("div",{tabIndex:0,role:"button",onClick:()=>S(t)},(0,D.tZ)(N,{language:"sql",style:f.Z},(0,c.IB)(t.sql,4)))}},{Header:(0,l.t)("Actions"),id:"actions",disableSortBy:!0,Cell:e=>{let{row:{original:{id:t}}}=e;return(0,D.tZ)(y.u,{title:(0,l.t)("Open query in SQL Lab"),placement:"bottom"},(0,D.tZ)("a",{href:`/superset/sqllab?queryId=${t}`},(0,D.tZ)(w.Z.Full,{iconColor:C.colors.grayscale.base})))}}]),[]),L=(0,a.useMemo)((()=>[{Header:(0,l.t)("Database"),key:"database",id:"database",input:"select",operator:m.p.relationOneMany,unfilteredLabel:(0,l.t)("All"),fetchSelects:(0,c.tm)("query","database",(0,c.v$)((e=>t((0,l.t)("An error occurred while fetching database values: %s",e))))),paginate:!0},{Header:(0,l.t)("State"),key:"state",id:"status",input:"select",operator:m.p.equals,unfilteredLabel:"All",fetchSelects:(0,c.wk)("query","status",(0,c.v$)((e=>t((0,l.t)("An error occurred while fetching schema values: %s",e))))),paginate:!0},{Header:(0,l.t)("User"),key:"user",id:"user",input:"select",operator:m.p.relationOneMany,unfilteredLabel:"All",fetchSelects:(0,c.tm)("query","user",(0,c.v$)((e=>t((0,l.t)("An error occurred while fetching user values: %s",e))))),paginate:!0},{Header:(0,l.t)("Time range"),key:"start_time",id:"start_time",input:"datetime_range",operator:m.p.between},{Header:(0,l.t)("Search by query text"),key:"sql",id:"sql",input:"search",operator:m.p.contains}]),[t]);return(0,D.tZ)(a.Fragment,null,(0,D.tZ)(p.Z,$),v&&(0,D.tZ)(E,{onHide:()=>S(void 0),query:v,queries:d,fetchData:k,openInSqlLab:e=>window.location.assign(`/superset/sqllab?queryId=${e}`),show:!0}),(0,D.tZ)(K,{className:"query-history-list-view",columns:_,count:i,data:d,fetchData:Z,filters:L,initialSort:T,loading:r,pageSize:25,highlightRowId:null==v?void 0:v.id}))}))}}]);
//# sourceMappingURL=45fb804182078b8ba1cd.chunk.js.map
