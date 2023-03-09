"use strict";(globalThis.webpackChunksuperset=globalThis.webpackChunksuperset||[]).push([[5656],{27989:(e,t,a)=>{a.d(t,{Z:()=>h});var l=a(67294),r=a(51995),s=a(55867),i=a(35932),n=a(74069),o=a(4715),d=a(34858),c=a(60972),u=a(11965);const p=r.iK.div`
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
`,h=e=>{let{resourceName:t,resourceLabel:a,passwordsNeededMessage:r,confirmOverwriteMessage:h,onModelImport:g,show:b,onHide:y,passwordFields:Z=[],setPasswordFields:w=(()=>{})}=e;const[f,v]=(0,l.useState)(!0),[S,x]=(0,l.useState)({}),[k,_]=(0,l.useState)(!1),[C,$]=(0,l.useState)(!1),[D,N]=(0,l.useState)([]),[H,I]=(0,l.useState)(!1),[T,E]=(0,l.useState)(),P=()=>{N([]),w([]),x({}),_(!1),$(!1),I(!1),E("")},{state:{alreadyExists:A,passwordsNeeded:B},importResource:O}=(0,d.PW)(t,a,(e=>{E(e)}));(0,l.useEffect)((()=>{w(B),B.length>0&&I(!1)}),[B,w]),(0,l.useEffect)((()=>{_(A.length>0),A.length>0&&I(!1)}),[A,_]);return f&&b&&v(!1),(0,u.tZ)(n.Z,{name:"model",className:"import-model-modal",disablePrimaryButton:0===D.length||k&&!C||H,onHandledPrimaryAction:()=>{var e;(null==(e=D[0])?void 0:e.originFileObj)instanceof File&&(I(!0),O(D[0].originFileObj,S,C).then((e=>{e&&(P(),g())})))},onHide:()=>{v(!0),y(),P()},primaryButtonName:k?(0,s.t)("Overwrite"):(0,s.t)("Import"),primaryButtonType:k?"danger":"primary",width:"750px",show:b,title:(0,u.tZ)("h4",null,(0,s.t)("Import %s",a))},(0,u.tZ)(m,null,(0,u.tZ)(o.gq,{name:"modelFile",id:"modelFile",accept:".yaml,.json,.yml,.zip",fileList:D,onChange:e=>{N([{...e.file,status:"done"}])},onRemove:e=>(N(D.filter((t=>t.uid!==e.uid))),!1),customRequest:()=>{},disabled:H},(0,u.tZ)(i.Z,{loading:H},(0,s.t)("Select file")))),T&&(0,u.tZ)(c.Z,{errorMessage:T,showDbInstallInstructions:Z.length>0}),0===Z.length?null:(0,u.tZ)(l.Fragment,null,(0,u.tZ)("h5",null,(0,s.t)("Database passwords")),(0,u.tZ)(p,null,r),Z.map((e=>(0,u.tZ)(m,{key:`password-for-${e}`},(0,u.tZ)("div",{className:"control-label"},e,(0,u.tZ)("span",{className:"required"},"*")),(0,u.tZ)("input",{name:`password-${e}`,autoComplete:`password-${e}`,type:"password",value:S[e],onChange:t=>x({...S,[e]:t.target.value})}))))),k?(0,u.tZ)(l.Fragment,null,(0,u.tZ)(m,null,(0,u.tZ)("div",{className:"confirm-overwrite"},h),(0,u.tZ)("div",{className:"control-label"},(0,s.t)('Type "%s" to confirm',(0,s.t)("OVERWRITE"))),(0,u.tZ)("input",{id:"overwrite",type:"text",onChange:e=>{var t,a;const l=null!=(t=null==(a=e.currentTarget)?void 0:a.value)?t:"";$(l.toUpperCase()===(0,s.t)("OVERWRITE"))}}))):null)}},69810:(e,t,a)=>{a.r(t),a.d(t,{default:()=>R});var l=a(78580),r=a.n(l),s=a(51995),i=a(55867),n=a(31069),o=a(67294),d=a(16550),c=a(15926),u=a.n(c),p=a(40768),m=a(34858),h=a(19259),g=a(77775),b=a(17198),y=a(32228),Z=a(18782),w=a(38703),f=a(20755),v=a(14114),S=a(58593),x=a(70163),k=a(34581),_=a(79789),C=a(8272),$=a(27989),D=a(91877),N=a(93185),H=a(86057),I=a(22318),T=a(85931),E=a(52389),P=a(49238),A=a(9875),B=a(74069),O=a(11965);const z=e=>{let{dataset:t,onHide:a,onDuplicate:l}=e;const[r,s]=(0,o.useState)(!1),[n,d]=(0,o.useState)(!1),[c,u]=(0,o.useState)(""),p=()=>{l(c)};return(0,o.useEffect)((()=>{u(""),s(null!==t)}),[t]),(0,O.tZ)(B.Z,{show:r,onHide:a,title:(0,i.t)("Duplicate dataset"),disablePrimaryButton:n,onHandledPrimaryAction:p,primaryButtonName:(0,i.t)("Duplicate")},(0,O.tZ)(P.lX,{htmlFor:"duplicate"},(0,i.t)("New dataset name")),(0,O.tZ)(A.II,{type:"text",id:"duplicate",autoComplete:"off",value:c,onChange:e=>{var t;const a=null!=(t=e.target.value)?t:"";u(a),d(""===a)},onPressEnter:p}))},M=s.iK.div`
  align-items: center;
  display: flex;

  svg {
    margin-right: ${e=>{let{theme:t}=e;return t.gridUnit}}px;
  }
`,F=s.iK.div`
  color: ${e=>{let{theme:t}=e;return t.colors.grayscale.base}};

  .disabled {
    svg,
    i {
      &:hover {
        path {
          fill: ${e=>{let{theme:t}=e;return t.colors.grayscale.light1}};
        }
      }
    }
    color: ${e=>{let{theme:t}=e;return t.colors.grayscale.light1}};
    .ant-menu-item:hover {
      color: ${e=>{let{theme:t}=e;return t.colors.grayscale.light1}};
      cursor: default;
    }
    &::after {
      color: ${e=>{let{theme:t}=e;return t.colors.grayscale.light1}};
    }
  }
`,R=(0,v.ZP)((e=>{let{addDangerToast:t,addSuccessToast:a,user:l}=e;const s=(0,d.k6)(),{state:{loading:c,resourceCount:v,resourceCollection:P,bulkSelectEnabled:A},hasPerm:B,fetchData:R,toggleBulkSelect:U,refreshData:V}=(0,m.Yi)("dataset",(0,i.t)("dataset"),t),[q,j]=(0,o.useState)(null),[L,K]=(0,o.useState)(null),[W,X]=(0,o.useState)(null),[Y,J]=(0,o.useState)(!1),[G,Q]=(0,o.useState)([]),[ee,te]=(0,o.useState)(!1),ae=B("can_write"),le=B("can_write"),re=B("can_write"),se=B("can_duplicate"),ie=B("can_export")&&(0,D.cr)(N.T.VERSIONED_EXPORT),ne=E.dY,oe=(0,o.useCallback)((e=>{let{id:a}=e;n.Z.get({endpoint:`/api/v1/dataset/${a}`}).then((e=>{let{json:t={}}=e;const a=t.result.columns.map((e=>{const{certification:{details:t="",certified_by:a=""}={}}=JSON.parse(e.extra||"{}")||{};return{...e,certification_details:t||"",certified_by:a||"",is_certified:t||a}}));t.result.columns=[...a],K(t.result)})).catch((()=>{t((0,i.t)("An error occurred while fetching dataset related data"))}))}),[t]),de=e=>{const t=e.map((e=>{let{id:t}=e;return t}));(0,y.Z)("dataset",t,(()=>{te(!1)})),te(!0)},ce=(0,o.useMemo)((()=>[{Cell:e=>{let{row:{original:{kind:t}}}=e;return"physical"===t?(0,O.tZ)(S.u,{id:"physical-dataset-tooltip",title:(0,i.t)("Physical dataset")},(0,O.tZ)(x.Z.DatasetPhysical,null)):(0,O.tZ)(S.u,{id:"virtual-dataset-tooltip",title:(0,i.t)("Virtual dataset")},(0,O.tZ)(x.Z.DatasetVirtual,null))},accessor:"kind_icon",disableSortBy:!0,size:"xs",id:"id"},{Cell:e=>{let{row:{original:{extra:t,table_name:a,description:l,explore_url:r}}}=e;const s=(0,O.tZ)(T.m,{to:r},a);try{const e=JSON.parse(t);return(0,O.tZ)(M,null,(null==e?void 0:e.certification)&&(0,O.tZ)(_.Z,{certifiedBy:e.certification.certified_by,details:e.certification.details,size:"l"}),(null==e?void 0:e.warning_markdown)&&(0,O.tZ)(H.Z,{warningMarkdown:e.warning_markdown,size:"l"}),s,l&&(0,O.tZ)(C.Z,{tooltip:l,viewBox:"0 -1 24 24"}))}catch{return s}},Header:(0,i.t)("Name"),accessor:"table_name"},{Cell:e=>{let{row:{original:{kind:t}}}=e;return"physical"===t?(0,i.t)("Physical"):(0,i.t)("Virtual")},Header:(0,i.t)("Type"),accessor:"kind",disableSortBy:!0,size:"md"},{Header:(0,i.t)("Database"),accessor:"database.database_name",size:"lg"},{Header:(0,i.t)("Schema"),accessor:"schema",size:"lg"},{Cell:e=>{let{row:{original:{changed_on_delta_humanized:t}}}=e;return(0,O.tZ)("span",{className:"no-wrap"},t)},Header:(0,i.t)("Modified"),accessor:"changed_on_delta_humanized",size:"xl"},{Cell:e=>{let{row:{original:{changed_by_name:t}}}=e;return t},Header:(0,i.t)("Modified by"),accessor:"changed_by.first_name",size:"xl"},{accessor:"database",disableSortBy:!0,hidden:!0},{Cell:e=>{let{row:{original:{owners:t=[]}}}=e;return(0,O.tZ)(k.Z,{users:t})},Header:(0,i.t)("Owners"),id:"owners",disableSortBy:!0,size:"lg"},{accessor:"sql",hidden:!0,disableSortBy:!0},{Cell:e=>{var t;let{row:{original:a}}=e;const s=r()(t=a.owners.map((e=>e.id))).call(t,l.userId)||(0,I.i5)(l);return ae||le||ie||se?(0,O.tZ)(F,{className:"actions"},le&&(0,O.tZ)(S.u,{id:"delete-action-tooltip",title:(0,i.t)("Delete"),placement:"bottom"},(0,O.tZ)("span",{role:"button",tabIndex:0,className:"action-button",onClick:()=>{return e=a,n.Z.get({endpoint:`/api/v1/dataset/${e.id}/related_objects`}).then((t=>{let{json:a={}}=t;j({...e,chart_count:a.charts.count,dashboard_count:a.dashboards.count})})).catch((0,p.v$)((e=>(0,i.t)("An error occurred while fetching dataset related data: %s",e))));var e}},(0,O.tZ)(x.Z.Trash,null))),ie&&(0,O.tZ)(S.u,{id:"export-action-tooltip",title:(0,i.t)("Export"),placement:"bottom"},(0,O.tZ)("span",{role:"button",tabIndex:0,className:"action-button",onClick:()=>de([a])},(0,O.tZ)(x.Z.Share,null))),ae&&(0,O.tZ)(S.u,{id:"edit-action-tooltip",title:s?(0,i.t)("Edit"):(0,i.t)("You must be a dataset owner in order to edit. Please reach out to a dataset owner to request modifications or edit access."),placement:"bottomRight"},(0,O.tZ)("span",{role:"button",tabIndex:0,className:s?"action-button":"disabled",onClick:s?()=>oe(a):void 0},(0,O.tZ)(x.Z.EditAlt,null))),se&&"virtual"===a.kind&&(0,O.tZ)(S.u,{id:"duplicate-action-tooltop",title:(0,i.t)("Duplicate"),placement:"bottom"},(0,O.tZ)("span",{role:"button",tabIndex:0,className:"action-button",onClick:()=>{X(a)}},(0,O.tZ)(x.Z.Copy,null)))):null},Header:(0,i.t)("Actions"),id:"actions",hidden:!ae&&!le&&!se,disableSortBy:!0}]),[ae,le,ie,oe,se,l]),ue=(0,o.useMemo)((()=>[{Header:(0,i.t)("Owner"),key:"owner",id:"owners",input:"select",operator:Z.p.relationManyMany,unfilteredLabel:"All",fetchSelects:(0,p.tm)("dataset","owners",(0,p.v$)((e=>(0,i.t)("An error occurred while fetching dataset owner values: %s",e))),l),paginate:!0},{Header:(0,i.t)("Database"),key:"database",id:"database",input:"select",operator:Z.p.relationOneMany,unfilteredLabel:"All",fetchSelects:(0,p.tm)("dataset","database",(0,p.v$)((e=>(0,i.t)("An error occurred while fetching datasets: %s",e)))),paginate:!0},{Header:(0,i.t)("Schema"),key:"schema",id:"schema",input:"select",operator:Z.p.equals,unfilteredLabel:"All",fetchSelects:(0,p.wk)("dataset","schema",(0,p.v$)((e=>(0,i.t)("An error occurred while fetching schema values: %s",e)))),paginate:!0},{Header:(0,i.t)("Type"),key:"sql",id:"sql",input:"select",operator:Z.p.datasetIsNullOrEmpty,unfilteredLabel:"All",selects:[{label:(0,i.t)("Virtual"),value:!1},{label:(0,i.t)("Physical"),value:!0}]},{Header:(0,i.t)("Certified"),key:"certified",id:"id",urlDisplay:"certified",input:"select",operator:Z.p.datasetIsCertified,unfilteredLabel:(0,i.t)("Any"),selects:[{label:(0,i.t)("Yes"),value:!0},{label:(0,i.t)("No"),value:!1}]},{Header:(0,i.t)("Search"),key:"search",id:"table_name",input:"search",operator:Z.p.contains}]),[l]),pe={activeChild:"Datasets",name:(0,i.t)("Datasets")},me=[];return(le||ie)&&me.push({name:(0,i.t)("Bulk select"),onClick:U,buttonStyle:"secondary"}),re&&(me.push({name:(0,O.tZ)(o.Fragment,null,(0,O.tZ)("i",{className:"fa fa-plus"})," ",(0,i.t)("Dataset")," "),onClick:()=>{s.push("/dataset/add/")},buttonStyle:"primary"}),(0,D.cr)(N.T.VERSIONED_EXPORT)&&me.push({name:(0,O.tZ)(S.u,{id:"import-tooltip",title:(0,i.t)("Import datasets"),placement:"bottomRight"},(0,O.tZ)(x.Z.Import,null)),buttonStyle:"link",onClick:()=>{J(!0)}})),pe.buttons=me,(0,O.tZ)(o.Fragment,null,(0,O.tZ)(f.Z,pe),q&&(0,O.tZ)(b.Z,{description:(0,i.t)("The dataset %s is linked to %s charts that appear on %s dashboards. Are you sure you want to continue? Deleting the dataset will break those objects.",q.table_name,q.chart_count,q.dashboard_count),onConfirm:()=>{q&&(e=>{let{id:l,table_name:r}=e;n.Z.delete({endpoint:`/api/v1/dataset/${l}`}).then((()=>{V(),j(null),a((0,i.t)("Deleted: %s",r))}),(0,p.v$)((e=>t((0,i.t)("There was an issue deleting %s: %s",r,e)))))})(q)},onHide:()=>{j(null)},open:!0,title:(0,i.t)("Delete Dataset?")}),L&&(0,O.tZ)(g.W,{datasource:L,onDatasourceSave:V,onHide:()=>{K(null)},show:!0}),(0,O.tZ)(z,{dataset:W,onHide:()=>{X(null)},onDuplicate:e=>{null===W&&t((0,i.t)("There was an issue duplicating the dataset.")),n.Z.post({endpoint:"/api/v1/dataset/duplicate",jsonPayload:{base_model_id:null==W?void 0:W.id,table_name:e}}).then((()=>{X(null),V()}),(0,p.v$)((e=>t((0,i.t)("There was an issue duplicating the selected datasets: %s",e)))))}}),(0,O.tZ)(h.Z,{title:(0,i.t)("Please confirm"),description:(0,i.t)("Are you sure you want to delete the selected datasets?"),onConfirm:e=>{n.Z.delete({endpoint:`/api/v1/dataset/?q=${u().encode(e.map((e=>{let{id:t}=e;return t})))}`}).then((e=>{let{json:t={}}=e;V(),a(t.message)}),(0,p.v$)((e=>t((0,i.t)("There was an issue deleting the selected datasets: %s",e)))))}},(e=>{const t=[];return le&&t.push({key:"delete",name:(0,i.t)("Delete"),onSelect:e,type:"danger"}),ie&&t.push({key:"export",name:(0,i.t)("Export"),type:"primary",onSelect:de}),(0,O.tZ)(Z.Z,{className:"dataset-list-view",columns:ce,data:P,count:v,pageSize:E.IV,fetchData:R,filters:ue,loading:c,initialSort:ne,bulkActions:t,bulkSelectEnabled:A,disableBulkSelect:U,renderBulkSelectCopy:e=>{const{virtualCount:t,physicalCount:a}=e.reduce(((e,t)=>("physical"===t.original.kind?e.physicalCount+=1:"virtual"===t.original.kind&&(e.virtualCount+=1),e)),{virtualCount:0,physicalCount:0});return e.length?t&&!a?(0,i.t)("%s Selected (Virtual)",e.length,t):a&&!t?(0,i.t)("%s Selected (Physical)",e.length,a):(0,i.t)("%s Selected (%s Physical, %s Virtual)",e.length,a,t):(0,i.t)("0 Selected")}})})),(0,O.tZ)($.Z,{resourceName:"dataset",resourceLabel:(0,i.t)("dataset"),passwordsNeededMessage:E.iX,confirmOverwriteMessage:E.mI,addDangerToast:t,addSuccessToast:a,onModelImport:()=>{J(!1),V(),a((0,i.t)("Dataset imported"))},show:Y,onHide:()=>{J(!1)},passwordFields:G,setPasswordFields:Q}),ee&&(0,O.tZ)(w.Z,null))}))}}]);
//# sourceMappingURL=6c03000af8e416d8032a.chunk.js.map
