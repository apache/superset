(globalThis.webpackChunksuperset=globalThis.webpackChunksuperset||[]).push([[665],{45578:(e,t,a)=>{var l=a(67206),r=a(45652);e.exports=function(e,t){return e&&e.length?r(e,l(t,2)):[]}},27989:(e,t,a)=>{"use strict";a.d(t,{Z:()=>h});var l=a(67294),r=a(51995),n=a(55867),i=a(35932),o=a(74069),s=a(4715),d=a(34858),c=a(60972),u=a(11965);const p=r.iK.div`
  display: block;
  color: ${e=>{let{theme:t}=e;return t.colors.grayscale.base}};
  font-size: ${e=>{let{theme:t}=e;return t.typography.sizes.s}}px;
`,m=r.iK.div`
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
`,h=e=>{let{resourceName:t,resourceLabel:a,passwordsNeededMessage:r,confirmOverwriteMessage:h,onModelImport:g,show:b,onHide:y,passwordFields:f=[],setPasswordFields:Z=(()=>{})}=e;const[v,w]=(0,l.useState)(!0),[_,x]=(0,l.useState)({}),[k,S]=(0,l.useState)(!1),[C,T]=(0,l.useState)(!1),[$,E]=(0,l.useState)([]),[M,N]=(0,l.useState)(!1),[I,A]=(0,l.useState)(),H=()=>{E([]),Z([]),x({}),S(!1),T(!1),N(!1),A("")},{state:{alreadyExists:D,passwordsNeeded:F},importResource:z}=(0,d.PW)(t,a,(e=>{A(e)}));(0,l.useEffect)((()=>{Z(F),F.length>0&&N(!1)}),[F,Z]),(0,l.useEffect)((()=>{S(D.length>0),D.length>0&&N(!1)}),[D,S]);return v&&b&&w(!1),(0,u.tZ)(o.Z,{name:"model",className:"import-model-modal",disablePrimaryButton:0===$.length||k&&!C||M,onHandledPrimaryAction:()=>{var e;(null==(e=$[0])?void 0:e.originFileObj)instanceof File&&(N(!0),z($[0].originFileObj,_,C).then((e=>{e&&(H(),g())})))},onHide:()=>{w(!0),y(),H()},primaryButtonName:k?(0,n.t)("Overwrite"):(0,n.t)("Import"),primaryButtonType:k?"danger":"primary",width:"750px",show:b,title:(0,u.tZ)("h4",null,(0,n.t)("Import %s",a))},(0,u.tZ)(m,null,(0,u.tZ)(s.gq,{name:"modelFile",id:"modelFile",accept:".yaml,.json,.yml,.zip",fileList:$,onChange:e=>{E([{...e.file,status:"done"}])},onRemove:e=>(E($.filter((t=>t.uid!==e.uid))),!1),customRequest:()=>{},disabled:M},(0,u.tZ)(i.Z,{loading:M},(0,n.t)("Select file")))),I&&(0,u.tZ)(c.Z,{errorMessage:I,showDbInstallInstructions:f.length>0}),0===f.length?null:(0,u.tZ)(l.Fragment,null,(0,u.tZ)("h5",null,(0,n.t)("Database passwords")),(0,u.tZ)(p,null,r),f.map((e=>(0,u.tZ)(m,{key:`password-for-${e}`},(0,u.tZ)("div",{className:"control-label"},e,(0,u.tZ)("span",{className:"required"},"*")),(0,u.tZ)("input",{name:`password-${e}`,autoComplete:`password-${e}`,type:"password",value:_[e],onChange:t=>x({..._,[e]:t.target.value})}))))),k?(0,u.tZ)(l.Fragment,null,(0,u.tZ)(m,null,(0,u.tZ)("div",{className:"confirm-overwrite"},h),(0,u.tZ)("div",{className:"control-label"},(0,n.t)('Type "%s" to confirm',(0,n.t)("OVERWRITE"))),(0,u.tZ)("input",{id:"overwrite",type:"text",onChange:e=>{var t,a;const l=null!=(t=null==(a=e.currentTarget)?void 0:a.value)?t:"";T(l.toUpperCase()===(0,n.t)("OVERWRITE"))}}))):null)}},83556:(e,t,a)=>{"use strict";a.d(t,{P:()=>u});var l=a(67294),r=a(51995),n=a(59361),i=a(58593),o=a(11965);const s=(0,r.iK)(n.Z)`
  ${e=>{let{theme:t}=e;return`\n  margin-top: ${t.gridUnit}px;\n  margin-bottom: ${t.gridUnit}px;\n  font-size: ${t.typography.sizes.s}px;\n  `}};
`,d=e=>{let{name:t,id:a,index:r,onDelete:n,editable:d=!1,onClick:c}=e;const u=(0,l.useMemo)((()=>t.length>20),[t]),p=(0,o.tZ)(l.Fragment,null,d?(0,o.tZ)(s,{key:a,closable:d,onClose:()=>r?null==n?void 0:n(r):null,color:"blue"},u?`${t.slice(0,20)}...`:t):(0,o.tZ)(s,{role:"link",key:a,onClick:c},a?(0,o.tZ)("a",{href:`/superset/tags/?tags=${t}`,target:"_blank",rel:"noreferrer"},u?`${t.slice(0,20)}...`:t):u?`${t.slice(0,20)}...`:t));return u?(0,o.tZ)(i.u,{title:t,key:t},p):p},c=r.iK.div`
  max-width: 100%;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
`,u=e=>{let{tags:t,editable:a=!1,onDelete:r,maxTags:n}=e;const[i,s]=(0,l.useState)(n),u=e=>{null==r||r(e)},p=(0,l.useMemo)((()=>i?t.length>i:null),[t.length,i]),m=(0,l.useMemo)((()=>"number"==typeof i?t.length-i+1:null),[p,t.length,i]);return(0,o.tZ)(c,{className:"tag-list"},p&&"number"==typeof i?(0,o.tZ)(l.Fragment,null,t.slice(0,i-1).map(((e,t)=>(0,o.tZ)(d,{id:e.id,key:e.id,name:e.name,index:t,onDelete:u,editable:a}))),t.length>i?(0,o.tZ)(d,{name:`+${m}...`,onClick:()=>s(void 0)}):null):(0,o.tZ)(l.Fragment,null,t.map(((e,t)=>(0,o.tZ)(d,{id:e.id,key:e.id,name:e.name,index:t,onDelete:u,editable:a}))),n&&t.length>n?(0,o.tZ)(d,{name:"...",onClick:()=>s(n)}):null))}},33320:(e,t,a)=>{"use strict";a.r(t),a.d(t,{default:()=>te});var l=a(45578),r=a.n(l),n=a(51995),i=a(55867),o=a(11064),s=a(31069),d=a(55786),c=a(67294),u=a(15926),p=a.n(u),m=a(30381),h=a.n(m),g=a(91877),b=a(93185),y=a(40768),f=a(34858),Z=a(32228),v=a(19259),w=a(83556),_=a(20755),x=a(36674),k=a(73727),S=a(16550),C=a(18782),T=a(63279),$=a(58593),E=a(11965);const M=n.iK.div`
  .link {
    color: ${e=>{let{theme:t}=e;return t.colors.grayscale.light5}};
    display: block;
    text-decoration: underline;
  }
`;function N(e){let{children:t,crossLinks:a=[],moreItems:l,show:r=!1}=e;return(0,E.tZ)($.u,{placement:"top",title:r&&(0,E.tZ)(M,null,a.map((e=>(0,E.tZ)(k.rU,{className:"link",key:e.to,to:e.to,target:"_blank",rel:"noreferer noopener"},e.title))),l&&(0,E.tZ)("span",null,(0,i.t)("+ %s more",l)))},t)}const I=n.iK.div`
  ${e=>{let{theme:t}=e;return`\n    & > span {\n      width: 100%;\n      display: flex;\n\n      .ant-tooltip-open {\n        display: inline;\n      }\n\n      .truncated {\n        overflow: hidden;\n        text-overflow: ellipsis;\n        white-space: nowrap;\n        display: inline-block;\n        width: 100%;\n        vertical-align: bottom;\n      }\n\n      .count {\n        cursor: pointer;\n        color: ${t.colors.grayscale.base};\n        font-weight: ${t.typography.weights.bold};\n      }\n    }\n  `}}
`;function A(e){let{crossLinks:t,maxLinks:a=20,linkPrefix:l="/superset/dashboard/"}=e;const r=(0,c.useRef)(null),n=(0,c.useRef)(null),[i,o]=(0,T.ro)(r,n),s=(0,c.useMemo)((()=>t.length>a?t.length-a:void 0),[t,a]),d=(0,c.useMemo)((()=>(0,E.tZ)("span",{className:"truncated",ref:r},t.map(((e,t)=>(0,E.tZ)(k.rU,{key:e.id,to:l+e.id,target:"_blank",rel:"noreferer noopener"},0===t?e.title:`, ${e.title}`))))),[t]),u=(0,c.useMemo)((()=>t.slice(0,a).map((e=>({title:e.title,to:l+e.id})))),[t,a]);return(0,E.tZ)(I,null,(0,E.tZ)(N,{moreItems:s,crossLinks:u,show:!!i},d,o&&(0,E.tZ)("span",{ref:n,className:"count"},"+",i)))}var H=a(38703),D=a(61337),F=a(14114),z=a(83673),L=a(27989),U=a(70163),B=a(1510),R=a(48911),O=a(8272),P=a(79789),q=a(85931),V=a(20292),K=a(60718),j=a(94394);const G=n.iK.div`
  align-items: center;
  display: flex;

  a {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: 1.2;
  }

  svg {
    margin-right: ${e=>{let{theme:t}=e;return t.gridUnit}}px;
  }
`,Y=(0,i.t)('The passwords for the databases below are needed in order to import them together with the charts. Please note that the "Secure Extra" and "Certificate" sections of the database configuration are not present in export files, and should be added manually after the import if they are needed.'),W=(0,i.t)("You are importing one or more charts that already exist. Overwriting might cause you to lose some of your work. Are you sure you want to overwrite?");(0,R.Z)();const X=(0,o.Z)(),J=async function(e,t,a){var l;void 0===e&&(e="");const n=e?{filters:[{col:"table_name",opr:"sw",value:e}]}:{},i=p().encode({columns:["datasource_name","datasource_id"],keys:["none"],order_column:"table_name",order_direction:"asc",page:t,page_size:a,...n}),{json:o={}}=await s.Z.get({endpoint:`/api/v1/dataset/?q=${i}`}),d=null==o||null==(l=o.result)?void 0:l.map((e=>{let{table_name:t,id:a}=e;return{label:t,value:a}}));return{data:r()(d,"value"),totalCount:null==o?void 0:o.count}},Q=n.iK.div`
  color: ${e=>{let{theme:t}=e;return t.colors.grayscale.base}};
`,ee=(0,V.Z)(),te=(0,F.ZP)((function(e){const{addDangerToast:t,addSuccessToast:a,user:{userId:l}}=e,n=(0,S.k6)(),{state:{loading:o,resourceCount:u,resourceCollection:m,bulkSelectEnabled:T},setResourceCollection:M,hasPerm:N,fetchData:I,toggleBulkSelect:F,refreshData:R}=(0,f.Yi)("chart",(0,i.t)("chart"),t),V=(0,c.useMemo)((()=>m.map((e=>e.id))),[m]),[te,ae]=(0,f.NE)("chart",V,t),{sliceCurrentlyEditing:le,handleChartUpdated:re,openChartEditModal:ne,closeChartEditModal:ie}=(0,f.fF)(M,m),[oe,se]=(0,c.useState)(!1),[de,ce]=(0,c.useState)([]),[ue,pe]=(0,c.useState)(!1),me=(0,D.OH)(null==l?void 0:l.toString(),null),he=N("can_write"),ge=N("can_write"),be=N("can_write"),ye=N("can_export")&&(0,g.cr)(b.T.VERSIONED_EXPORT),fe=[{id:"changed_on_delta_humanized",desc:!0}],Ze=ee.common.conf.ENABLE_BROAD_ACTIVITY_ACCESS,ve=e=>{const t=e.map((e=>{let{id:t}=e;return t}));(0,Z.Z)("chart",t,(()=>{pe(!1)})),pe(!0)},we=e=>null!=e&&e.first_name?`${null==e?void 0:e.first_name} ${null==e?void 0:e.last_name}`:null,_e=async function(e,a,l){var n,o,d;void 0===e&&(e="");const c=e?{filters:[{col:"dashboards",opr:C.p.relationManyMany,value:e}]}:{},u=p().encode({columns:["dashboard_title","id"],keys:["none"],order_column:"dashboard_title",order_direction:"asc",page:a,page_size:l,...c}),m=await s.Z.get({endpoint:e?`/api/v1/chart/?q=${u}`:`/api/v1/dashboard/?q=${u}`}).catch((()=>t((0,i.t)("An error occurred while fetching dashboards")))),h=null==m||null==(n=m.json)||null==(o=n.result)?void 0:o.map((e=>{let{dashboard_title:t,id:a}=e;return{label:t,value:a}}));return{data:r()(h,"value"),totalCount:null==m||null==(d=m.json)?void 0:d.count}},xe=(0,c.useMemo)((()=>[{Cell:e=>{let{row:{original:{id:t}}}=e;return l&&(0,E.tZ)(x.Z,{itemId:t,saveFaveStar:te,isStarred:ae[t]})},Header:"",id:"id",disableSortBy:!0,size:"xs",hidden:!l},{Cell:e=>{let{row:{original:{url:t,slice_name:a,certified_by:l,certification_details:r,description:n}}}=e;return(0,E.tZ)(G,null,(0,E.tZ)(k.rU,{to:t},l&&(0,E.tZ)(c.Fragment,null,(0,E.tZ)(P.Z,{certifiedBy:l,details:r})," "),a),n&&(0,E.tZ)(O.Z,{tooltip:n,viewBox:"0 -1 24 24"}))},Header:(0,i.t)("Chart"),accessor:"slice_name"},{Cell:e=>{var t;let{row:{original:{viz_type:a}}}=e;return(null==(t=X.get(a))?void 0:t.name)||a},Header:(0,i.t)("Visualization type"),accessor:"viz_type",size:"xxl"},{Cell:e=>{let{row:{original:{datasource_name_text:t,datasource_url:a}}}=e;return(0,E.tZ)(q.m,{to:a},t)},Header:(0,i.t)("Dataset"),accessor:"datasource_id",disableSortBy:!0,size:"xl"},{Cell:e=>{let{row:{original:{dashboards:t}}}=e;return(0,E.tZ)(A,{crossLinks:(0,d.Z)(t).map((e=>({title:e.dashboard_title,id:e.id})))})},Header:(0,i.t)("Dashboards added to"),accessor:"dashboards",disableSortBy:!0,size:"xxl",hidden:!0},{Cell:e=>{let{row:{original:{last_saved_by:t,changed_by_url:a}}}=e;return Ze?(0,E.tZ)("a",{href:a},we(t)):(0,E.tZ)(c.Fragment,null,we(t))},Header:(0,i.t)("Modified by"),accessor:"last_saved_by.first_name",size:"xl"},{Cell:e=>{let{row:{original:{last_saved_at:t}}}=e;return(0,E.tZ)("span",{className:"no-wrap"},t?h().utc(t).fromNow():null)},Header:(0,i.t)("Last modified"),accessor:"last_saved_at",size:"xl"},{accessor:"owners",hidden:!0,disableSortBy:!0},{Cell:e=>{let{row:{original:{created_by:t}}}=e;return t?`${t.first_name} ${t.last_name}`:""},Header:(0,i.t)("Created by"),accessor:"created_by",disableSortBy:!0,size:"xl"},{Cell:e=>{let{row:{original:{tags:t=[]}}}=e;return(0,E.tZ)(w.P,{tags:t.filter((e=>!e.type||1===e.type||"TagTypes.custom"===e.type)),maxTags:3})},Header:(0,i.t)("Tags"),accessor:"tags",disableSortBy:!0,hidden:!(0,g.cr)(b.T.TAGGING_SYSTEM)},{Cell:e=>{let{row:{original:l}}=e;return ge||be||ye?(0,E.tZ)(Q,{className:"actions"},be&&(0,E.tZ)(v.Z,{title:(0,i.t)("Please confirm"),description:(0,E.tZ)(c.Fragment,null,(0,i.t)("Are you sure you want to delete")," ",(0,E.tZ)("b",null,l.slice_name),"?"),onConfirm:()=>(0,y.Gm)(l,a,t,R)},(e=>(0,E.tZ)($.u,{id:"delete-action-tooltip",title:(0,i.t)("Delete"),placement:"bottom"},(0,E.tZ)("span",{role:"button",tabIndex:0,className:"action-button",onClick:e},(0,E.tZ)(U.Z.Trash,null))))),ye&&(0,E.tZ)($.u,{id:"export-action-tooltip",title:(0,i.t)("Export"),placement:"bottom"},(0,E.tZ)("span",{role:"button",tabIndex:0,className:"action-button",onClick:()=>ve([l])},(0,E.tZ)(U.Z.Share,null))),ge&&(0,E.tZ)($.u,{id:"edit-action-tooltip",title:(0,i.t)("Edit"),placement:"bottom"},(0,E.tZ)("span",{role:"button",tabIndex:0,className:"action-button",onClick:()=>ne(l)},(0,E.tZ)(U.Z.EditAlt,null)))):null},Header:(0,i.t)("Actions"),id:"actions",disableSortBy:!0,hidden:!ge&&!be}]),[l,ge,be,ye,te,ae,R,a,t]),ke=(0,c.useMemo)((()=>({Header:(0,i.t)("Favorite"),key:"favorite",id:"id",urlDisplay:"favorite",input:"select",operator:C.p.chartIsFav,unfilteredLabel:(0,i.t)("Any"),selects:[{label:(0,i.t)("Yes"),value:!0},{label:(0,i.t)("No"),value:!1}]})),[]),Se=(0,c.useMemo)((()=>{const a=[{Header:(0,i.t)("Owner"),key:"owner",id:"owners",input:"select",operator:C.p.relationManyMany,unfilteredLabel:(0,i.t)("All"),fetchSelects:(0,y.tm)("chart","owners",(0,y.v$)((e=>t((0,i.t)("An error occurred while fetching chart owners values: %s",e)))),e.user),paginate:!0},{Header:(0,i.t)("Created by"),key:"created_by",id:"created_by",input:"select",operator:C.p.relationOneMany,unfilteredLabel:(0,i.t)("All"),fetchSelects:(0,y.tm)("chart","created_by",(0,y.v$)((e=>t((0,i.t)("An error occurred while fetching chart created by values: %s",e)))),e.user),paginate:!0},{Header:(0,i.t)("Chart type"),key:"viz_type",id:"viz_type",input:"select",operator:C.p.equals,unfilteredLabel:(0,i.t)("All"),selects:X.keys().filter((e=>{var t;return(0,B.X3)((null==(t=X.get(e))?void 0:t.behaviors)||[])})).map((e=>{var t;return{label:(null==(t=X.get(e))?void 0:t.name)||e,value:e}})).sort(((e,t)=>e.label&&t.label?e.label>t.label?1:e.label<t.label?-1:0:0))},{Header:(0,i.t)("Dataset"),key:"dataset",id:"datasource_id",input:"select",operator:C.p.equals,unfilteredLabel:(0,i.t)("All"),fetchSelects:J,paginate:!0},{Header:(0,i.t)("Dashboards"),key:"dashboards",id:"dashboards",input:"select",operator:C.p.relationManyMany,unfilteredLabel:(0,i.t)("All"),fetchSelects:_e,paginate:!0},...l?[ke]:[],{Header:(0,i.t)("Certified"),key:"certified",id:"id",urlDisplay:"certified",input:"select",operator:C.p.chartIsCertified,unfilteredLabel:(0,i.t)("Any"),selects:[{label:(0,i.t)("Yes"),value:!0},{label:(0,i.t)("No"),value:!1}]}];return(0,g.cr)(b.T.TAGGING_SYSTEM)&&a.push({Header:(0,i.t)("Tags"),key:"tags",id:"tags",input:"select",operator:C.p.chartTags,unfilteredLabel:(0,i.t)("All"),fetchSelects:K.m}),a.push({Header:(0,i.t)("Search"),key:"search",id:"slice_name",input:"search",operator:C.p.chartAllText}),a}),[t,ke,e.user]),Ce=[{desc:!1,id:"slice_name",label:(0,i.t)("Alphabetical"),value:"alphabetical"},{desc:!0,id:"changed_on_delta_humanized",label:(0,i.t)("Recently modified"),value:"recently_modified"},{desc:!1,id:"changed_on_delta_humanized",label:(0,i.t)("Least recently modified"),value:"least_recently_modified"}],Te=(0,c.useCallback)((e=>(0,E.tZ)(j.Z,{chart:e,showThumbnails:me?me.thumbnails:(0,g.cr)(b.T.THUMBNAILS),hasPerm:N,openChartEditModal:ne,bulkSelectEnabled:T,addDangerToast:t,addSuccessToast:a,refreshData:R,userId:l,loading:o,favoriteStatus:ae[e.id],saveFavoriteStatus:te,handleBulkChartExport:ve})),[t,a,T,ae,N,o]),$e=[];return(be||ye)&&$e.push({name:(0,i.t)("Bulk select"),buttonStyle:"secondary","data-test":"bulk-select",onClick:F}),he&&($e.push({name:(0,E.tZ)(c.Fragment,null,(0,E.tZ)("i",{className:"fa fa-plus"})," ",(0,i.t)("Chart")),buttonStyle:"primary",onClick:()=>{n.push("/chart/add")}}),(0,g.cr)(b.T.VERSIONED_EXPORT)&&$e.push({name:(0,E.tZ)($.u,{id:"import-tooltip",title:(0,i.t)("Import charts"),placement:"bottomRight"},(0,E.tZ)(U.Z.Import,null)),buttonStyle:"link",onClick:()=>{se(!0)}})),(0,E.tZ)(c.Fragment,null,(0,E.tZ)(_.Z,{name:(0,i.t)("Charts"),buttons:$e}),le&&(0,E.tZ)(z.Z,{onHide:ie,onSave:re,show:!0,slice:le}),(0,E.tZ)(v.Z,{title:(0,i.t)("Please confirm"),description:(0,i.t)("Are you sure you want to delete the selected charts?"),onConfirm:function(e){s.Z.delete({endpoint:`/api/v1/chart/?q=${p().encode(e.map((e=>{let{id:t}=e;return t})))}`}).then((e=>{let{json:t={}}=e;R(),a(t.message)}),(0,y.v$)((e=>t((0,i.t)("There was an issue deleting the selected charts: %s",e)))))}},(e=>{const t=[];return be&&t.push({key:"delete",name:(0,i.t)("Delete"),type:"danger",onSelect:e}),ye&&t.push({key:"export",name:(0,i.t)("Export"),type:"primary",onSelect:ve}),(0,E.tZ)(C.Z,{bulkActions:t,bulkSelectEnabled:T,cardSortSelectOptions:Ce,className:"chart-list-view",columns:xe,count:u,data:m,disableBulkSelect:F,fetchData:I,filters:Se,initialSort:fe,loading:o,pageSize:25,renderCard:Te,showThumbnails:me?me.thumbnails:(0,g.cr)(b.T.THUMBNAILS),defaultViewMode:(0,g.cr)(b.T.LISTVIEWS_DEFAULT_CARD_VIEW)?"card":"table"})})),(0,E.tZ)(L.Z,{resourceName:"chart",resourceLabel:(0,i.t)("chart"),passwordsNeededMessage:Y,confirmOverwriteMessage:W,addDangerToast:t,addSuccessToast:a,onModelImport:()=>{se(!1),R(),a((0,i.t)("Chart imported"))},show:oe,onHide:()=>{se(!1)},passwordFields:de,setPasswordFields:ce}),ue&&(0,E.tZ)(H.Z,null))}))}}]);
//# sourceMappingURL=6eedcdf2dc282fc73ec4.chunk.js.map
