"use strict";(globalThis.webpackChunksuperset=globalThis.webpackChunksuperset||[]).push([[8774],{27989:(e,t,a)=>{a.d(t,{Z:()=>p});var r=a(67294),l=a(51995),n=a(55867),o=a(35932),i=a(74069),s=a(4715),d=a(34858),u=a(60972),c=a(11965);const h=l.iK.div`
  display: block;
  color: ${e=>{let{theme:t}=e;return t.colors.grayscale.base}};
  font-size: ${e=>{let{theme:t}=e;return t.typography.sizes.s}}px;
`,m=l.iK.div`
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
`,p=e=>{let{resourceName:t,resourceLabel:a,passwordsNeededMessage:l,confirmOverwriteMessage:p,onModelImport:b,show:g,onHide:y,passwordFields:f=[],setPasswordFields:Z=(()=>{})}=e;const[_,w]=(0,r.useState)(!0),[S,v]=(0,r.useState)({}),[x,k]=(0,r.useState)(!1),[C,T]=(0,r.useState)(!1),[$,E]=(0,r.useState)([]),[I,D]=(0,r.useState)(!1),[A,N]=(0,r.useState)(),F=()=>{E([]),Z([]),v({}),k(!1),T(!1),D(!1),N("")},{state:{alreadyExists:H,passwordsNeeded:M},importResource:z}=(0,d.PW)(t,a,(e=>{N(e)}));(0,r.useEffect)((()=>{Z(M),M.length>0&&D(!1)}),[M,Z]),(0,r.useEffect)((()=>{k(H.length>0),H.length>0&&D(!1)}),[H,k]);return _&&g&&w(!1),(0,c.tZ)(i.Z,{name:"model",className:"import-model-modal",disablePrimaryButton:0===$.length||x&&!C||I,onHandledPrimaryAction:()=>{var e;(null==(e=$[0])?void 0:e.originFileObj)instanceof File&&(D(!0),z($[0].originFileObj,S,C).then((e=>{e&&(F(),b())})))},onHide:()=>{w(!0),y(),F()},primaryButtonName:x?(0,n.t)("Overwrite"):(0,n.t)("Import"),primaryButtonType:x?"danger":"primary",width:"750px",show:g,title:(0,c.tZ)("h4",null,(0,n.t)("Import %s",a))},(0,c.tZ)(m,null,(0,c.tZ)(s.gq,{name:"modelFile",id:"modelFile",accept:".yaml,.json,.yml,.zip",fileList:$,onChange:e=>{E([{...e.file,status:"done"}])},onRemove:e=>(E($.filter((t=>t.uid!==e.uid))),!1),customRequest:()=>{},disabled:I},(0,c.tZ)(o.Z,{loading:I},(0,n.t)("Select file")))),A&&(0,c.tZ)(u.Z,{errorMessage:A,showDbInstallInstructions:f.length>0}),0===f.length?null:(0,c.tZ)(r.Fragment,null,(0,c.tZ)("h5",null,(0,n.t)("Database passwords")),(0,c.tZ)(h,null,l),f.map((e=>(0,c.tZ)(m,{key:`password-for-${e}`},(0,c.tZ)("div",{className:"control-label"},e,(0,c.tZ)("span",{className:"required"},"*")),(0,c.tZ)("input",{name:`password-${e}`,autoComplete:`password-${e}`,type:"password",value:S[e],onChange:t=>v({...S,[e]:t.target.value})}))))),x?(0,c.tZ)(r.Fragment,null,(0,c.tZ)(m,null,(0,c.tZ)("div",{className:"confirm-overwrite"},p),(0,c.tZ)("div",{className:"control-label"},(0,n.t)('Type "%s" to confirm',(0,n.t)("OVERWRITE"))),(0,c.tZ)("input",{id:"overwrite",type:"text",onChange:e=>{var t,a;const r=null!=(t=null==(a=e.currentTarget)?void 0:a.value)?t:"";T(r.toUpperCase()===(0,n.t)("OVERWRITE"))}}))):null)}},83556:(e,t,a)=>{a.d(t,{P:()=>c});var r=a(67294),l=a(51995),n=a(59361),o=a(58593),i=a(11965);const s=(0,l.iK)(n.Z)`
  ${e=>{let{theme:t}=e;return`\n  margin-top: ${t.gridUnit}px;\n  margin-bottom: ${t.gridUnit}px;\n  font-size: ${t.typography.sizes.s}px;\n  `}};
`,d=e=>{let{name:t,id:a,index:l,onDelete:n,editable:d=!1,onClick:u}=e;const c=(0,r.useMemo)((()=>t.length>20),[t]),h=(0,i.tZ)(r.Fragment,null,d?(0,i.tZ)(s,{key:a,closable:d,onClose:()=>l?null==n?void 0:n(l):null,color:"blue"},c?`${t.slice(0,20)}...`:t):(0,i.tZ)(s,{role:"link",key:a,onClick:u},a?(0,i.tZ)("a",{href:`/superset/tags/?tags=${t}`,target:"_blank",rel:"noreferrer"},c?`${t.slice(0,20)}...`:t):c?`${t.slice(0,20)}...`:t));return c?(0,i.tZ)(o.u,{title:t,key:t},h):h},u=l.iK.div`
  max-width: 100%;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
`,c=e=>{let{tags:t,editable:a=!1,onDelete:l,maxTags:n}=e;const[o,s]=(0,r.useState)(n),c=e=>{null==l||l(e)},h=(0,r.useMemo)((()=>o?t.length>o:null),[t.length,o]),m=(0,r.useMemo)((()=>"number"==typeof o?t.length-o+1:null),[h,t.length,o]);return(0,i.tZ)(u,{className:"tag-list"},h&&"number"==typeof o?(0,i.tZ)(r.Fragment,null,t.slice(0,o-1).map(((e,t)=>(0,i.tZ)(d,{id:e.id,key:e.id,name:e.name,index:t,onDelete:c,editable:a}))),t.length>o?(0,i.tZ)(d,{name:`+${m}...`,onClick:()=>s(void 0)}):null):(0,i.tZ)(r.Fragment,null,t.map(((e,t)=>(0,i.tZ)(d,{id:e.id,key:e.id,name:e.name,index:t,onDelete:c,editable:a}))),n&&t.length>n?(0,i.tZ)(d,{name:"...",onClick:()=>s(n)}):null))}},23767:(e,t,a)=>{a.r(t),a.d(t,{default:()=>B});var r,l=a(55867),n=a(51995),o=a(31069),i=a(67294),s=a(73727),d=a(15926),u=a.n(d),c=a(91877),h=a(93185),m=a(40768),p=a(34858),b=a(19259),g=a(83556),y=a(32228),f=a(38703),Z=a(20755),_=a(18782),w=a(61337),S=a(14114),v=a(34581),x=a(70163),k=a(17198),C=a(36674),T=a(20818),$=a(58593),E=a(27989),I=a(79789),D=a(60718),A=a(20292),N=a(99415);!function(e){e.PUBLISHED="published",e.DRAFT="draft"}(r||(r={}));var F=a(11965);const H=(0,l.t)('The passwords for the databases below are needed in order to import them together with the dashboards. Please note that the "Secure Extra" and "Certificate" sections of the database configuration are not present in export files, and should be added manually after the import if they are needed.'),M=(0,l.t)("You are importing one or more dashboards that already exist. Overwriting might cause you to lose some of your work. Are you sure you want to overwrite?"),z=n.iK.div`
  color: ${e=>{let{theme:t}=e;return t.colors.grayscale.base}};
`,P=(0,A.Z)(),B=(0,S.ZP)((function(e){var t,a;const{addDangerToast:n,addSuccessToast:d,user:{userId:S}}=e,{state:{loading:A,resourceCount:B,resourceCollection:O,bulkSelectEnabled:U},setResourceCollection:L,hasPerm:R,fetchData:V,toggleBulkSelect:j,refreshData:Y}=(0,p.Yi)("dashboard",(0,l.t)("dashboard"),n),q=(0,i.useMemo)((()=>O.map((e=>e.id))),[O]),[G,K]=(0,p.NE)("dashboard",q,n),[W,X]=(0,i.useState)(null),[J,Q]=(0,i.useState)(null),[ee,te]=(0,i.useState)(!1),[ae,re]=(0,i.useState)([]),[le,ne]=(0,i.useState)(!1),oe=null==P||null==(t=P.common)||null==(a=t.conf)?void 0:a.ENABLE_BROAD_ACTIVITY_ACCESS,ie=(0,w.OH)(null==S?void 0:S.toString(),null),se=R("can_write"),de=R("can_write"),ue=R("can_write"),ce=R("can_export")&&(0,c.cr)(h.T.VERSIONED_EXPORT),he=[{id:"changed_on_delta_humanized",desc:!0}];function me(e){X(e)}function pe(e){return o.Z.get({endpoint:`/api/v1/dashboard/${e.id}`}).then((e=>{let{json:t={}}=e;L(O.map((e=>{var a;if(e.id===(null==t||null==(a=t.result)?void 0:a.id)){const{changed_by_name:a,changed_by_url:r,changed_by:l,dashboard_title:n="",slug:o="",json_metadata:i="",changed_on_delta_humanized:s,url:d="",certified_by:u="",certification_details:c="",owners:h,tags:m}=t.result;return{...e,changed_by_name:a,changed_by_url:r,changed_by:l,dashboard_title:n,slug:o,json_metadata:i,changed_on_delta_humanized:s,url:d,certified_by:u,certification_details:c,owners:h,tags:m}}return e})))}),(0,m.v$)((e=>n((0,l.t)("An error occurred while fetching dashboards: %s",e)))))}const be=e=>{const t=e.map((e=>{let{id:t}=e;return t}));(0,y.Z)("dashboard",t,(()=>{ne(!1)})),ne(!0)},ge=(0,i.useMemo)((()=>[{Cell:e=>{let{row:{original:{id:t}}}=e;return S&&(0,F.tZ)(C.Z,{itemId:t,saveFaveStar:G,isStarred:K[t]})},Header:"",id:"id",disableSortBy:!0,size:"xs",hidden:!S},{Cell:e=>{let{row:{original:{url:t,dashboard_title:a,certified_by:r,certification_details:l}}}=e;return(0,F.tZ)(s.rU,{to:t},r&&(0,F.tZ)(i.Fragment,null,(0,F.tZ)(I.Z,{certifiedBy:r,details:l})," "),a)},Header:(0,l.t)("Title"),accessor:"dashboard_title"},{Cell:e=>{let{row:{original:{changed_by_name:t,changed_by_url:a}}}=e;return oe?(0,F.tZ)("a",{href:a},t):(0,F.tZ)(i.Fragment,null,t)},Header:(0,l.t)("Modified by"),accessor:"changed_by.first_name",size:"xl"},{Cell:e=>{let{row:{original:{status:t}}}=e;return t===r.PUBLISHED?(0,l.t)("Published"):(0,l.t)("Draft")},Header:(0,l.t)("Status"),accessor:"published",size:"xl"},{Cell:e=>{let{row:{original:{changed_on_delta_humanized:t}}}=e;return(0,F.tZ)("span",{className:"no-wrap"},t)},Header:(0,l.t)("Modified"),accessor:"changed_on_delta_humanized",size:"xl"},{Cell:e=>{let{row:{original:{created_by:t}}}=e;return t?`${t.first_name} ${t.last_name}`:""},Header:(0,l.t)("Created by"),accessor:"created_by",disableSortBy:!0,size:"xl"},{Cell:e=>{let{row:{original:{owners:t=[]}}}=e;return(0,F.tZ)(v.Z,{users:t})},Header:(0,l.t)("Owners"),accessor:"owners",disableSortBy:!0,size:"xl"},{Cell:e=>{let{row:{original:{tags:t=[]}}}=e;return(0,F.tZ)(g.P,{tags:t.filter((e=>"TagTypes.custom"===e.type||1===e.type)),maxTags:3})},Header:(0,l.t)("Tags"),accessor:"tags",disableSortBy:!0,hidden:!(0,c.cr)(h.T.TAGGING_SYSTEM)},{Cell:e=>{let{row:{original:t}}=e;return(0,F.tZ)(z,{className:"actions"},ue&&(0,F.tZ)(b.Z,{title:(0,l.t)("Please confirm"),description:(0,F.tZ)(i.Fragment,null,(0,l.t)("Are you sure you want to delete")," ",(0,F.tZ)("b",null,t.dashboard_title),"?"),onConfirm:()=>(0,m.Iu)(t,Y,d,n)},(e=>(0,F.tZ)($.u,{id:"delete-action-tooltip",title:(0,l.t)("Delete"),placement:"bottom"},(0,F.tZ)("span",{role:"button",tabIndex:0,className:"action-button",onClick:e},(0,F.tZ)(x.Z.Trash,null))))),ce&&(0,F.tZ)($.u,{id:"export-action-tooltip",title:(0,l.t)("Export"),placement:"bottom"},(0,F.tZ)("span",{role:"button",tabIndex:0,className:"action-button",onClick:()=>be([t])},(0,F.tZ)(x.Z.Share,null))),de&&(0,F.tZ)($.u,{id:"edit-action-tooltip",title:(0,l.t)("Edit"),placement:"bottom"},(0,F.tZ)("span",{role:"button",tabIndex:0,className:"action-button",onClick:()=>me(t)},(0,F.tZ)(x.Z.EditAlt,null))))},Header:(0,l.t)("Actions"),id:"actions",hidden:!de&&!ue&&!ce,disableSortBy:!0}]),[S,de,ue,ce,G,K,Y,d,n]),ye=(0,i.useMemo)((()=>({Header:(0,l.t)("Favorite"),key:"favorite",id:"id",urlDisplay:"favorite",input:"select",operator:_.p.dashboardIsFav,unfilteredLabel:(0,l.t)("Any"),selects:[{label:(0,l.t)("Yes"),value:!0},{label:(0,l.t)("No"),value:!1}]})),[]),fe=(0,i.useMemo)((()=>{const t=[{Header:(0,l.t)("Search"),key:"search",id:"dashboard_title",input:"search",operator:_.p.titleOrSlug},{Header:(0,l.t)("Owner"),key:"owner",id:"owners",input:"select",operator:_.p.relationManyMany,unfilteredLabel:(0,l.t)("All"),fetchSelects:(0,m.tm)("dashboard","owners",(0,m.v$)((e=>n((0,l.t)("An error occurred while fetching dashboard owner values: %s",e)))),e.user),paginate:!0},{Header:(0,l.t)("Created by"),key:"created_by",id:"created_by",input:"select",operator:_.p.relationOneMany,unfilteredLabel:(0,l.t)("All"),fetchSelects:(0,m.tm)("dashboard","created_by",(0,m.v$)((e=>n((0,l.t)("An error occurred while fetching dashboard created by values: %s",e)))),e.user),paginate:!0},{Header:(0,l.t)("Status"),key:"published",id:"published",input:"select",operator:_.p.equals,unfilteredLabel:(0,l.t)("Any"),selects:[{label:(0,l.t)("Published"),value:!0},{label:(0,l.t)("Draft"),value:!1}]},...S?[ye]:[],{Header:(0,l.t)("Certified"),key:"certified",id:"id",urlDisplay:"certified",input:"select",operator:_.p.dashboardIsCertified,unfilteredLabel:(0,l.t)("Any"),selects:[{label:(0,l.t)("Yes"),value:!0},{label:(0,l.t)("No"),value:!1}]}];return(0,c.cr)(h.T.TAGGING_SYSTEM)&&t.push({Header:(0,l.t)("Tags"),key:"tags",id:"tags",input:"select",operator:_.p.chartTags,unfilteredLabel:(0,l.t)("All"),fetchSelects:D.m}),t}),[n,ye,e.user]),Ze=[{desc:!1,id:"dashboard_title",label:(0,l.t)("Alphabetical"),value:"alphabetical"},{desc:!0,id:"changed_on_delta_humanized",label:(0,l.t)("Recently modified"),value:"recently_modified"},{desc:!1,id:"changed_on_delta_humanized",label:(0,l.t)("Least recently modified"),value:"least_recently_modified"}],_e=(0,i.useCallback)((e=>(0,F.tZ)(N.Z,{dashboard:e,hasPerm:R,bulkSelectEnabled:U,showThumbnails:ie?ie.thumbnails:(0,c.cr)(h.T.THUMBNAILS),userId:S,loading:A,openDashboardEditModal:me,saveFavoriteStatus:G,favoriteStatus:K[e.id],handleBulkDashboardExport:be,onDelete:e=>Q(e)})),[U,K,R,A,S,G,ie]),we=[];return(ue||ce)&&we.push({name:(0,l.t)("Bulk select"),buttonStyle:"secondary","data-test":"bulk-select",onClick:j}),se&&(we.push({name:(0,F.tZ)(i.Fragment,null,(0,F.tZ)("i",{className:"fa fa-plus"})," ",(0,l.t)("Dashboard")),buttonStyle:"primary",onClick:()=>{window.location.assign("/dashboard/new")}}),(0,c.cr)(h.T.VERSIONED_EXPORT)&&we.push({name:(0,F.tZ)($.u,{id:"import-tooltip",title:(0,l.t)("Import dashboards"),placement:"bottomRight"},(0,F.tZ)(x.Z.Import,null)),buttonStyle:"link",onClick:()=>{te(!0)}})),(0,F.tZ)(i.Fragment,null,(0,F.tZ)(Z.Z,{name:(0,l.t)("Dashboards"),buttons:we}),(0,F.tZ)(b.Z,{title:(0,l.t)("Please confirm"),description:(0,l.t)("Are you sure you want to delete the selected dashboards?"),onConfirm:function(e){return o.Z.delete({endpoint:`/api/v1/dashboard/?q=${u().encode(e.map((e=>{let{id:t}=e;return t})))}`}).then((e=>{let{json:t={}}=e;Y(),d(t.message)}),(0,m.v$)((e=>n((0,l.t)("There was an issue deleting the selected dashboards: ",e)))))}},(e=>{const t=[];return ue&&t.push({key:"delete",name:(0,l.t)("Delete"),type:"danger",onSelect:e}),ce&&t.push({key:"export",name:(0,l.t)("Export"),type:"primary",onSelect:be}),(0,F.tZ)(i.Fragment,null,W&&(0,F.tZ)(T.Z,{dashboardId:W.id,show:!0,onHide:()=>X(null),onSubmit:pe}),J&&(0,F.tZ)(k.Z,{description:(0,F.tZ)(i.Fragment,null,(0,l.t)("Are you sure you want to delete")," ",(0,F.tZ)("b",null,J.dashboard_title),"?"),onConfirm:()=>{(0,m.Iu)(J,Y,d,n,void 0,S),Q(null)},onHide:()=>Q(null),open:!!J,title:(0,l.t)("Please confirm")}),(0,F.tZ)(_.Z,{bulkActions:t,bulkSelectEnabled:U,cardSortSelectOptions:Ze,className:"dashboard-list-view",columns:ge,count:B,data:O,disableBulkSelect:j,fetchData:V,filters:fe,initialSort:he,loading:A,pageSize:25,showThumbnails:ie?ie.thumbnails:(0,c.cr)(h.T.THUMBNAILS),renderCard:_e,defaultViewMode:(0,c.cr)(h.T.LISTVIEWS_DEFAULT_CARD_VIEW)?"card":"table"}))})),(0,F.tZ)(E.Z,{resourceName:"dashboard",resourceLabel:(0,l.t)("dashboard"),passwordsNeededMessage:H,confirmOverwriteMessage:M,addDangerToast:n,addSuccessToast:d,onModelImport:()=>{te(!1),Y(),d((0,l.t)("Dashboard imported"))},show:ee,onHide:()=>{te(!1)},passwordFields:ae,setPasswordFields:re}),le&&(0,F.tZ)(f.Z,null))}))}}]);
//# sourceMappingURL=cee22a81c389391538df.chunk.js.map
