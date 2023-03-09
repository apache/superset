"use strict";(globalThis.webpackChunksuperset=globalThis.webpackChunksuperset||[]).push([[7637],{39863:(t,e,n)=>{n.r(e),n.d(e,{default:()=>k});var r=n(67294),a=n(51995),l=n(55786),o=n(55867),s=n(35755),i=n(14114),c=n(84101),d=n(60718),u=n(85633),g=n(30381),h=n.n(g),p=n(68492),m=n(76962),b=n(72570),Z=n(85605),f=n(38703),$=n(11965);const x=a.iK.div`
  text-align: left;
  border-radius: ${t=>{let{theme:e}=t;return 1*e.gridUnit}}px 0;
  margin: 0 ${t=>{let{theme:e}=t;return 4*e.gridUnit}}px;
  .table {
    table-layout: fixed;
  }
  .td {
    width: 33%;
  }
`;function y(t){let{search:e=""}=t;const[n,a]=(0,r.useState)({dashboard:[],chart:[],query:[]});(0,r.useEffect)((()=>{(0,Z.Y4)({tags:e,types:null},(t=>{const e={dashboard:[],chart:[],query:[]};t.forEach((function(t){const n=t.type;e[n].push(t)})),a(e)}),(t=>{(0,b.Gb)("Error Fetching Tagged Objects"),p.Z.log(t.text)}))}),[e]);const l=t=>{const e=n[t].map((e=>({[t]:(0,$.tZ)("a",{href:e.url},e.name),modified:h().utc(e.changed_on).fromNow()})));return(0,$.tZ)(m.Z,{className:"table-condensed",emptyWrapperType:m.u.Small,data:e,pageSize:50,columns:[{accessor:t,Header:t.charAt(0).toUpperCase()+t.slice(1)},{accessor:"modified",Header:"Modified"}]})};return n?(0,$.tZ)(x,null,(0,$.tZ)("h3",null,(0,o.t)("Dashboards")),l("dashboard"),(0,$.tZ)("hr",null),(0,$.tZ)("h3",null,(0,o.t)("Charts")),l("chart"),(0,$.tZ)("hr",null),(0,$.tZ)("h3",null,(0,o.t)("Queries")),l("query")):(0,$.tZ)(f.Z,null)}const U=a.iK.div`
  ${t=>{let{theme:e}=t;return`\n  background-color: ${e.colors.grayscale.light4};\n  .select-control {\n    margin-left: ${4*e.gridUnit}px;\n    margin-right: ${4*e.gridUnit}px;\n    margin-bottom: ${2*e.gridUnit}px;\n  }\n  .select-control-label {\n    text-transform: uppercase;\n    font-size: ${3*e.gridUnit}px;\n    color: ${e.colors.grayscale.base};\n    margin-bottom: ${1*e.gridUnit}px;\n  }`}}
`,v=a.iK.div`
  ${t=>{let{theme:e}=t;return`\n  height: ${12.5*e.gridUnit}px;\n  background-color: ${e.colors.grayscale.light5};\n  margin-bottom: ${4*e.gridUnit}px;\n  .navbar-brand {\n    margin-left: ${2*e.gridUnit}px;\n    font-weight: ${e.typography.weights.bold};\n  }`}};
`,k=(0,i.ZP)((function(){const[t,e]=(0,s.Wd)("tags",s.Zp),n=(0,r.useMemo)((()=>t?t.split(",").map((t=>({value:t,label:t}))):[]),[t]);return(0,$.tZ)(U,null,(0,$.tZ)(v,null,(0,$.tZ)("span",{className:"navbar-brand"},(0,o.t)("All Entities"))),(0,$.tZ)("div",{className:"select-control"},(0,$.tZ)("div",{className:"select-control-label"},(0,o.t)("search by tags")),(0,$.tZ)(c.Z,{ariaLabel:"tags",value:n,onChange:t=>{const n=(0,l.Z)(t).map((t=>(0,u.NA)(t))).join(",");e(n)},options:d.m,placeholder:"Select",mode:"multiple"})),(0,$.tZ)(y,{search:t||""}))}))}}]);
//# sourceMappingURL=48b60bf7f29d2fe420d3.chunk.js.map
