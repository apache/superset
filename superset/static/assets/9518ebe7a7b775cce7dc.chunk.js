"use strict";(globalThis.webpackChunksuperset=globalThis.webpackChunksuperset||[]).push([[9173],{27989:(e,t,a)=>{a.d(t,{Z:()=>h});var r=a(67294),n=a(51995),l=a(55867),o=a(35932),s=a(74069),i=a(4715),d=a(34858),u=a(60972),c=a(11965);const p=n.iK.div`
  display: block;
  color: ${e=>{let{theme:t}=e;return t.colors.grayscale.base}};
  font-size: ${e=>{let{theme:t}=e;return t.typography.sizes.s}}px;
`,m=n.iK.div`
  padding-bottom: ${e=>{let{theme:t}=e;return 2*t.gridUnit}}px;
  padding-top: ${e=>{let{theme:t}=e;return 2*t.gridUnit}}px;

  & > div {
    margin: ${e=>{let{theme:t}=e;return t.gridUnit}}px 0;
  }

  &.extra-container {
    padding-top: 8px;
  }

  .confirm-overwrite {
    margin-bottom: ${e=>{let{theme:t}=e;return 2*t.gridUnit}}px;
  }

  .input-container {
    display: flex;
    align-items: center;

    label {
      display: flex;
      margin-right: ${e=>{let{theme:t}=e;return 2*t.gridUnit}}px;
    }

    i {
      margin: 0 ${e=>{let{theme:t}=e;return t.gridUnit}}px;
    }
  }

  input,
  textarea {
    flex: 1 1 auto;
  }

  textarea {
    height: 160px;
    resize: none;
  }

  input::placeholder,
  textarea::placeholder {
    color: ${e=>{let{theme:t}=e;return t.colors.grayscale.light1}};
  }

  textarea,
  input[type='text'],
  input[type='number'] {
    padding: ${e=>{let{theme:t}=e;return 1.5*t.gridUnit}}px
      ${e=>{let{theme:t}=e;return 2*t.gridUnit}}px;
    border-style: none;
    border: 1px solid ${e=>{let{theme:t}=e;return t.colors.grayscale.light2}};
    border-radius: ${e=>{let{theme:t}=e;return t.gridUnit}}px;

    &[name='name'] {
      flex: 0 1 auto;
      width: 40%;
    }

    &[name='sqlalchemy_uri'] {
      margin-right: ${e=>{let{theme:t}=e;return 3*t.gridUnit}}px;
    }
  }
`,h=e=>{let{resourceName:t,resourceLabel:a,passwordsNeededMessage:n,confirmOverwriteMessage:h,onModelImport:g,show:y,onHide:b,passwordFields:Z=[],setPasswordFields:v=(()=>{})}=e;const[f,w]=(0,r.useState)(!0),[x,k]=(0,r.useState)({}),[S,C]=(0,r.useState)(!1),[q,$]=(0,r.useState)(!1),[T,_]=(0,r.useState)([]),[D,N]=(0,r.useState)(!1),[I,E]=(0,r.useState)(),z=()=>{_([]),v([]),k({}),C(!1),$(!1),N(!1),E("")},{state:{alreadyExists:P,passwordsNeeded:H},importResource:F}=(0,d.PW)(t,a,(e=>{E(e)}));(0,r.useEffect)((()=>{v(H),H.length>0&&N(!1)}),[H,v]),(0,r.useEffect)((()=>{C(P.length>0),P.length>0&&N(!1)}),[P,C]);return f&&y&&w(!1),(0,c.tZ)(s.Z,{name:"model",className:"import-model-modal",disablePrimaryButton:0===T.length||S&&!q||D,onHandledPrimaryAction:()=>{var e;(null==(e=T[0])?void 0:e.originFileObj)instanceof File&&(N(!0),F(T[0].originFileObj,x,q).then((e=>{e&&(z(),g())})))},onHide:()=>{w(!0),b(),z()},primaryButtonName:S?(0,l.t)("Overwrite"):(0,l.t)("Import"),primaryButtonType:S?"danger":"primary",width:"750px",show:y,title:(0,c.tZ)("h4",null,(0,l.t)("Import %s",a))},(0,c.tZ)(m,null,(0,c.tZ)(i.gq,{name:"modelFile",id:"modelFile",accept:".yaml,.json,.yml,.zip",fileList:T,onChange:e=>{_([{...e.file,status:"done"}])},onRemove:e=>(_(T.filter((t=>t.uid!==e.uid))),!1),customRequest:()=>{},disabled:D},(0,c.tZ)(o.Z,{loading:D},(0,l.t)("Select file")))),I&&(0,c.tZ)(u.Z,{errorMessage:I,showDbInstallInstructions:Z.length>0}),0===Z.length?null:(0,c.tZ)(r.Fragment,null,(0,c.tZ)("h5",null,(0,l.t)("Database passwords")),(0,c.tZ)(p,null,n),Z.map((e=>(0,c.tZ)(m,{key:`password-for-${e}`},(0,c.tZ)("div",{className:"control-label"},e,(0,c.tZ)("span",{className:"required"},"*")),(0,c.tZ)("input",{name:`password-${e}`,autoComplete:`password-${e}`,type:"password",value:x[e],onChange:t=>k({...x,[e]:t.target.value})}))))),S?(0,c.tZ)(r.Fragment,null,(0,c.tZ)(m,null,(0,c.tZ)("div",{className:"confirm-overwrite"},h),(0,c.tZ)("div",{className:"control-label"},(0,l.t)('Type "%s" to confirm',(0,l.t)("OVERWRITE"))),(0,c.tZ)("input",{id:"overwrite",type:"text",onChange:e=>{var t,a;const r=null!=(t=null==(a=e.currentTarget)?void 0:a.value)?t:"";$(r.toUpperCase()===(0,l.t)("OVERWRITE"))}}))):null)}},29848:(e,t,a)=>{a.d(t,{Z:()=>d}),a(67294);var r=a(51995),n=a(58593),l=a(70163),o=a(11965);const s=r.iK.span`
  white-space: nowrap;
  min-width: 100px;
  svg,
  i {
    margin-right: 8px;

    &:hover {
      path {
        fill: ${e=>{let{theme:t}=e;return t.colors.primary.base}};
      }
    }
  }
`,i=r.iK.span`
  color: ${e=>{let{theme:t}=e;return t.colors.grayscale.base}};
`;function d(e){let{actions:t}=e;return(0,o.tZ)(s,{className:"actions"},t.map(((e,t)=>{const a=l.Z[e.icon];return e.tooltip?(0,o.tZ)(n.u,{id:`${e.label}-tooltip`,title:e.tooltip,placement:e.placement,key:t},(0,o.tZ)(i,{role:"button",tabIndex:0,className:"action-button",onClick:e.onClick},(0,o.tZ)(a,null))):(0,o.tZ)(i,{role:"button",tabIndex:0,className:"action-button",onClick:e.onClick,key:t},(0,o.tZ)(a,null))})))}},83556:(e,t,a)=>{a.d(t,{P:()=>c});var r=a(67294),n=a(51995),l=a(59361),o=a(58593),s=a(11965);const i=(0,n.iK)(l.Z)`
  ${e=>{let{theme:t}=e;return`\n  margin-top: ${t.gridUnit}px;\n  margin-bottom: ${t.gridUnit}px;\n  font-size: ${t.typography.sizes.s}px;\n  `}};
`,d=e=>{let{name:t,id:a,index:n,onDelete:l,editable:d=!1,onClick:u}=e;const c=(0,r.useMemo)((()=>t.length>20),[t]),p=(0,s.tZ)(r.Fragment,null,d?(0,s.tZ)(i,{key:a,closable:d,onClose:()=>n?null==l?void 0:l(n):null,color:"blue"},c?`${t.slice(0,20)}...`:t):(0,s.tZ)(i,{role:"link",key:a,onClick:u},a?(0,s.tZ)("a",{href:`/superset/tags/?tags=${t}`,target:"_blank",rel:"noreferrer"},c?`${t.slice(0,20)}...`:t):c?`${t.slice(0,20)}...`:t));return c?(0,s.tZ)(o.u,{title:t,key:t},p):p},u=n.iK.div`
  max-width: 100%;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
`,c=e=>{let{tags:t,editable:a=!1,onDelete:n,maxTags:l}=e;const[o,i]=(0,r.useState)(l),c=e=>{null==n||n(e)},p=(0,r.useMemo)((()=>o?t.length>o:null),[t.length,o]),m=(0,r.useMemo)((()=>"number"==typeof o?t.length-o+1:null),[p,t.length,o]);return(0,s.tZ)(u,{className:"tag-list"},p&&"number"==typeof o?(0,s.tZ)(r.Fragment,null,t.slice(0,o-1).map(((e,t)=>(0,s.tZ)(d,{id:e.id,key:e.id,name:e.name,index:t,onDelete:c,editable:a}))),t.length>o?(0,s.tZ)(d,{name:`+${m}...`,onClick:()=>i(void 0)}):null):(0,s.tZ)(r.Fragment,null,t.map(((e,t)=>(0,s.tZ)(d,{id:e.id,key:e.id,name:e.name,index:t,onDelete:c,editable:a}))),l&&t.length>l?(0,s.tZ)(d,{name:"...",onClick:()=>i(l)}):null))}},95413:(e,t,a)=>{a.d(t,{Y:()=>n});var r=a(55867);const n={name:(0,r.t)("SQL"),tabs:[{name:"Saved queries",label:(0,r.t)("Saved queries"),url:"/savedqueryview/list/",usesRouter:!0},{name:"Query history",label:(0,r.t)("Query history"),url:"/superset/sqllab/history/",usesRouter:!0}]}},31673:(e,t,a)=>{a.d(t,{Z:()=>b});var r=a(5872),n=a.n(r),l=(a(67294),a(51995)),o=a(55867),s=a(33743),i=a(49889),d=a(53459),u=a(22489),c=a(120),p=a(42110),m=a(70163),h=a(10222),g=a(11965);p.Z.registerLanguage("sql",s.Z),p.Z.registerLanguage("markdown",d.Z),p.Z.registerLanguage("html",i.Z),p.Z.registerLanguage("json",u.Z);const y=l.iK.div`
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
`;function b(e){let{addDangerToast:t,addSuccessToast:a,children:r,...l}=e;return(0,g.tZ)(y,null,(0,g.tZ)(m.Z.Copy,{tabIndex:0,role:"button",onClick:e=>{var n;e.preventDefault(),e.currentTarget.blur(),n=r,(0,h.Z)((()=>Promise.resolve(n))).then((()=>{a&&a((0,o.t)("SQL Copied!"))})).catch((()=>{t&&t((0,o.t)("Sorry, your browser does not support copying."))}))}}),(0,g.tZ)(p.Z,n()({style:c.Z},l),r))}},14025:(e,t,a)=>{a.d(t,{Cq:()=>u,Fk:()=>c,bI:()=>p});var r=a(67294),n=a(31069),l=a(55867),o=a(68492),s=a(15926),i=a.n(s),d=a(72570);function u(e){let{queries:t,fetchData:a,currentQueryId:n}=e;const l=t.findIndex((e=>e.id===n)),[o,s]=(0,r.useState)(l),[i,d]=(0,r.useState)(!1),[u,c]=(0,r.useState)(!1);function p(){d(0===o),c(o===t.length-1)}function m(e){const r=o+(e?-1:1);r>=0&&r<t.length&&(a(t[r].id),s(r),p())}return(0,r.useEffect)((()=>{p()})),{handleKeyPress:function(e){o>=0&&o<t.length&&("ArrowDown"===e.key||"k"===e.key?(e.preventDefault(),m(!1)):"ArrowUp"!==e.key&&"j"!==e.key||(e.preventDefault(),m(!0)))},handleDataChange:m,disablePrevious:i,disableNext:u}}const c=(e,t)=>{const[a,s]=(0,r.useState)([]),u=t?encodeURIComponent(t):void 0,c=(0,r.useCallback)((async e=>{let t,a=[],r=0;for(;void 0===t||a.length<t;){const s=i().encode_uri({filters:e,page:r});try{const e=await n.Z.get({endpoint:`/api/v1/dataset/?q=${s}`});({count:t}=e.json);const{json:{result:l}}=e;a=[...a,...l],r+=1}catch(e){(0,d.Gb)((0,l.t)("There was an error fetching dataset")),o.Z.error((0,l.t)("There was an error fetching dataset"),e)}}s(a)}),[]);(0,r.useEffect)((()=>{const a=[{col:"database",opr:"rel_o_m",value:null==e?void 0:e.id},{col:"schema",opr:"eq",value:u},{col:"sql",opr:"dataset_is_null_or_empty",value:!0}];t&&c(a)}),[null==e?void 0:e.id,t,u,c]);const p=null==a?void 0:a.map((e=>e.table_name));return{datasets:a,datasetNames:p}},p=e=>{const[t,a]=(0,r.useState)(0),s=(0,r.useCallback)((()=>n.Z.get({endpoint:`/api/v1/dataset/${e}/related_objects`}).then((e=>{let{json:t}=e;a(null==t?void 0:t.charts.count)})).catch((e=>{(0,d.Gb)((0,l.t)("There was an error fetching dataset's related objects")),o.Z.error(e)}))),[e]);return(0,r.useEffect)((()=>{e&&s()}),[e,s]),{usageCount:t}}},49588:(e,t,a)=>{a.r(t),a.d(t,{default:()=>K});var r=a(55867),n=a(51995),l=a(31069),o=a(67294),s=a(15926),i=a.n(s),d=a(30381),u=a.n(d),c=a(40768),p=a(76697),m=a(14114),h=a(34858),g=a(19259),y=a(32228),b=a(20755),Z=a(18782),v=a(38703),f=a(17198),w=a(29848),x=a(83556),k=a(58593),S=a(95413),C=a(10222),q=a(91877),$=a(93185),T=a(27989),_=a(70163),D=a(74069),N=a(35932),I=a(31673),E=a(14025),z=a(11965);const P=n.iK.div`
  color: ${e=>{let{theme:t}=e;return t.colors.secondary.light2}};
  font-size: ${e=>{let{theme:t}=e;return t.typography.sizes.s}}px;
  margin-bottom: 0;
  text-transform: uppercase;
`,H=n.iK.div`
  color: ${e=>{let{theme:t}=e;return t.colors.grayscale.dark2}};
  font-size: ${e=>{let{theme:t}=e;return t.typography.sizes.m}}px;
  padding: 4px 0 16px 0;
`,F=(0,n.iK)(D.Z)`
  .ant-modal-content {
  }

  .ant-modal-body {
    padding: 24px;
  }

  pre {
    font-size: ${e=>{let{theme:t}=e;return t.typography.sizes.xs}}px;
    font-weight: ${e=>{let{theme:t}=e;return t.typography.weights.normal}};
    line-height: ${e=>{let{theme:t}=e;return t.typography.sizes.l}}px;
    height: 375px;
    border: none;
  }
`,L=(0,m.ZP)((e=>{let{fetchData:t,onHide:a,openInSqlLab:n,queries:l,savedQuery:s,show:i,addDangerToast:d,addSuccessToast:u}=e;const{handleKeyPress:c,handleDataChange:p,disablePrevious:m,disableNext:h}=(0,E.Cq)({queries:l,currentQueryId:s.id,fetchData:t});return(0,z.tZ)("div",{role:"none",onKeyUp:c},(0,z.tZ)(F,{onHide:a,show:i,title:(0,r.t)("Query preview"),footer:(0,z.tZ)(o.Fragment,null,(0,z.tZ)(N.Z,{key:"previous-saved-query",disabled:m,onClick:()=>p(!0)},(0,r.t)("Previous")),(0,z.tZ)(N.Z,{key:"next-saved-query",disabled:h,onClick:()=>p(!1)},(0,r.t)("Next")),(0,z.tZ)(N.Z,{key:"open-in-sql-lab",buttonStyle:"primary",onClick:()=>n(s.id)},(0,r.t)("Open in SQL Lab")))},(0,z.tZ)(P,null,(0,r.t)("Query name")),(0,z.tZ)(H,null,s.label),(0,z.tZ)(I.Z,{language:"sql",addDangerToast:d,addSuccessToast:u},s.sql||"")))})),M=(0,r.t)('The passwords for the databases below are needed in order to import them together with the saved queries. Please note that the "Secure Extra" and "Certificate" sections of the database configuration are not present in export files, and should be added manually after the import if they are needed.'),Q=(0,r.t)("You are importing one or more saved queries that already exist. Overwriting might cause you to lose some of your work. Are you sure you want to overwrite?"),U=n.iK.div`
  .count {
    margin-left: 5px;
    color: ${e=>{let{theme:t}=e;return t.colors.primary.base}};
    text-decoration: underline;
    cursor: pointer;
  }
`,R=n.iK.div`
  color: ${e=>{let{theme:t}=e;return t.colors.grayscale.dark2}};
`,K=(0,m.ZP)((function(e){let{addDangerToast:t,addSuccessToast:a}=e;const{state:{loading:n,resourceCount:s,resourceCollection:d,bulkSelectEnabled:m},hasPerm:D,fetchData:N,toggleBulkSelect:I,refreshData:E}=(0,h.Yi)("saved_query",(0,r.t)("Saved queries"),t),[P,H]=(0,o.useState)(null),[F,K]=(0,o.useState)(null),[O,A]=(0,o.useState)(!1),[j,B]=(0,o.useState)([]),[Y,G]=(0,o.useState)(!1),V=D("can_write"),W=D("can_write"),X=D("can_write"),J=D("can_export")&&(0,q.cr)($.T.VERSIONED_EXPORT),ee=(0,o.useCallback)((e=>{l.Z.get({endpoint:`/api/v1/saved_query/${e}`}).then((e=>{let{json:t={}}=e;K({...t.result})}),(0,c.v$)((e=>t((0,r.t)("There was an issue previewing the selected query %s",e)))))}),[t]),te={activeChild:"Saved queries",...S.Y},ae=[];X&&ae.push({name:(0,r.t)("Bulk select"),onClick:I,buttonStyle:"secondary"}),ae.push({name:(0,z.tZ)(o.Fragment,null,(0,z.tZ)("i",{className:"fa fa-plus"})," ",(0,r.t)("Query")),onClick:()=>{window.open(`${window.location.origin}/superset/sqllab?new=true`)},buttonStyle:"primary"}),V&&(0,q.cr)($.T.VERSIONED_EXPORT)&&ae.push({name:(0,z.tZ)(k.u,{id:"import-tooltip",title:(0,r.t)("Import queries"),placement:"bottomRight"},(0,z.tZ)(_.Z.Import,null)),buttonStyle:"link",onClick:()=>{A(!0)},"data-test":"import-button"}),te.buttons=ae;const re=e=>{window.open(`${window.location.origin}/superset/sqllab?savedQueryId=${e}`)},ne=(0,o.useCallback)((e=>{(0,C.Z)((()=>Promise.resolve(`${window.location.origin}/superset/sqllab?savedQueryId=${e}`))).then((()=>{a((0,r.t)("Link Copied!"))})).catch((()=>{t((0,r.t)("Sorry, your browser does not support copying."))}))}),[t,a]),le=e=>{const t=e.map((e=>{let{id:t}=e;return t}));(0,y.Z)("saved_query",t,(()=>{G(!1)})),G(!0)},oe=[{id:"changed_on_delta_humanized",desc:!0}],se=(0,o.useMemo)((()=>[{accessor:"label",Header:(0,r.t)("Name")},{accessor:"database.database_name",Header:(0,r.t)("Database"),size:"xl"},{accessor:"database",hidden:!0,disableSortBy:!0},{accessor:"schema",Header:(0,r.t)("Schema"),size:"xl"},{Cell:e=>{let{row:{original:{sql_tables:t=[]}}}=e;const a=t.map((e=>e.table)),n=(null==a?void 0:a.shift())||"";return a.length?(0,z.tZ)(U,null,(0,z.tZ)("span",null,n),(0,z.tZ)(p.ZP,{placement:"right",title:(0,r.t)("TABLES"),trigger:"click",content:(0,z.tZ)(o.Fragment,null,a.map((e=>(0,z.tZ)(R,{key:e},e))))},(0,z.tZ)("span",{className:"count"},"(+",a.length,")"))):n},accessor:"sql_tables",Header:(0,r.t)("Tables"),size:"xl",disableSortBy:!0},{Cell:e=>{let{row:{original:{created_on:t}}}=e;const a=new Date(t),r=new Date(Date.UTC(a.getFullYear(),a.getMonth(),a.getDate(),a.getHours(),a.getMinutes(),a.getSeconds(),a.getMilliseconds()));return u()(r).fromNow()},Header:(0,r.t)("Created on"),accessor:"created_on",size:"xl"},{Cell:e=>{let{row:{original:{changed_on_delta_humanized:t}}}=e;return t},Header:(0,r.t)("Modified"),accessor:"changed_on_delta_humanized",size:"xl"},{Cell:e=>{let{row:{original:{tags:t=[]}}}=e;return(0,z.tZ)(x.P,{tags:t.filter((e=>1===e.type))})},Header:(0,r.t)("Tags"),accessor:"tags",disableSortBy:!0,hidden:!(0,q.cr)($.T.TAGGING_SYSTEM)},{Cell:e=>{let{row:{original:t}}=e;const a=[{label:"preview-action",tooltip:(0,r.t)("Query preview"),placement:"bottom",icon:"Binoculars",onClick:()=>{ee(t.id)}},W&&{label:"edit-action",tooltip:(0,r.t)("Edit query"),placement:"bottom",icon:"Edit",onClick:()=>re(t.id)},{label:"copy-action",tooltip:(0,r.t)("Copy query URL"),placement:"bottom",icon:"Copy",onClick:()=>ne(t.id)},J&&{label:"export-action",tooltip:(0,r.t)("Export query"),placement:"bottom",icon:"Share",onClick:()=>le([t])},X&&{label:"delete-action",tooltip:(0,r.t)("Delete query"),placement:"bottom",icon:"Trash",onClick:()=>H(t)}].filter((e=>!!e));return(0,z.tZ)(w.Z,{actions:a})},Header:(0,r.t)("Actions"),id:"actions",disableSortBy:!0}]),[X,W,J,ne,ee]),ie=(0,o.useMemo)((()=>[{Header:(0,r.t)("Database"),key:"database",id:"database",input:"select",operator:Z.p.relationOneMany,unfilteredLabel:(0,r.t)("All"),fetchSelects:(0,c.tm)("saved_query","database",(0,c.v$)((e=>t((0,r.t)("An error occurred while fetching dataset datasource values: %s",e))))),paginate:!0},{Header:(0,r.t)("Schema"),id:"schema",key:"schema",input:"select",operator:Z.p.equals,unfilteredLabel:"All",fetchSelects:(0,c.wk)("saved_query","schema",(0,c.v$)((e=>t((0,r.t)("An error occurred while fetching schema values: %s",e))))),paginate:!0},{Header:(0,r.t)("Tags"),id:"tags",key:"tags",input:"search",operator:Z.p.savedQueryTags},{Header:(0,r.t)("Search"),id:"label",key:"search",input:"search",operator:Z.p.allText}]),[t]);return(0,z.tZ)(o.Fragment,null,(0,z.tZ)(b.Z,te),P&&(0,z.tZ)(f.Z,{description:(0,r.t)("This action will permanently delete the saved query."),onConfirm:()=>{P&&(e=>{let{id:n,label:o}=e;l.Z.delete({endpoint:`/api/v1/saved_query/${n}`}).then((()=>{E(),H(null),a((0,r.t)("Deleted: %s",o))}),(0,c.v$)((e=>t((0,r.t)("There was an issue deleting %s: %s",o,e)))))})(P)},onHide:()=>H(null),open:!0,title:(0,r.t)("Delete Query?")}),F&&(0,z.tZ)(L,{fetchData:ee,onHide:()=>K(null),savedQuery:F,queries:d,openInSqlLab:re,show:!0}),(0,z.tZ)(g.Z,{title:(0,r.t)("Please confirm"),description:(0,r.t)("Are you sure you want to delete the selected queries?"),onConfirm:e=>{l.Z.delete({endpoint:`/api/v1/saved_query/?q=${i().encode(e.map((e=>{let{id:t}=e;return t})))}`}).then((e=>{let{json:t={}}=e;E(),a(t.message)}),(0,c.v$)((e=>t((0,r.t)("There was an issue deleting the selected queries: %s",e)))))}},(e=>{const t=[];return X&&t.push({key:"delete",name:(0,r.t)("Delete"),onSelect:e,type:"danger"}),J&&t.push({key:"export",name:(0,r.t)("Export"),type:"primary",onSelect:le}),(0,z.tZ)(Z.Z,{className:"saved_query-list-view",columns:se,count:s,data:d,fetchData:N,filters:ie,initialSort:oe,loading:n,pageSize:25,bulkActions:t,bulkSelectEnabled:m,disableBulkSelect:I,highlightRowId:null==F?void 0:F.id})})),(0,z.tZ)(T.Z,{resourceName:"saved_query",resourceLabel:(0,r.t)("queries"),passwordsNeededMessage:M,confirmOverwriteMessage:Q,addDangerToast:t,addSuccessToast:a,onModelImport:()=>{A(!1),E(),a((0,r.t)("Query imported"))},show:O,onHide:()=>{A(!1)},passwordFields:j,setPasswordFields:B}),Y&&(0,z.tZ)(v.Z,null))}))}}]);
//# sourceMappingURL=9518ebe7a7b775cce7dc.chunk.js.map
