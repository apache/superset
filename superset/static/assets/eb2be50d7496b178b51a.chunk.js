"use strict";(globalThis.webpackChunksuperset=globalThis.webpackChunksuperset||[]).push([[1611],{29848:(t,e,n)=>{n.d(e,{Z:()=>d}),n(67294);var a=n(51995),o=n(58593),l=n(70163),r=n(11965);const i=a.iK.span`
  white-space: nowrap;
  min-width: 100px;
  svg,
  i {
    margin-right: 8px;

    &:hover {
      path {
        fill: ${t=>{let{theme:e}=t;return e.colors.primary.base}};
      }
    }
  }
`,s=a.iK.span`
  color: ${t=>{let{theme:e}=t;return e.colors.grayscale.base}};
`;function d(t){let{actions:e}=t;return(0,r.tZ)(i,{className:"actions"},e.map(((t,e)=>{const n=l.Z[t.icon];return t.tooltip?(0,r.tZ)(o.u,{id:`${t.label}-tooltip`,title:t.tooltip,placement:t.placement,key:e},(0,r.tZ)(s,{role:"button",tabIndex:0,className:"action-button",onClick:t.onClick},(0,r.tZ)(n,null))):(0,r.tZ)(s,{role:"button",tabIndex:0,className:"action-button",onClick:t.onClick,key:e},(0,r.tZ)(n,null))})))}},35276:(t,e,n)=>{n.r(e),n.d(e,{default:()=>N});var a=n(67294),o=n(73727),l=n(16550),r=n(51995),i=n(11965),s=n(55867),d=n(31069),c=n(30381),u=n.n(c),m=n(15926),h=n.n(m),p=n(29848),g=n(19259),Z=n(17198),_=n(18782),b=n(20755),y=n(98286),f=n(14114),x=n(34858),v=n(40768),$=n(62276),w=n(70163),k=n(74069),S=n(94670);const C=r.iK.div`
  margin: ${t=>{let{theme:e}=t;return 2*e.gridUnit}}px auto
    ${t=>{let{theme:e}=t;return 4*e.gridUnit}}px auto;
`,A=(0,r.iK)(S.Ad)`
  border-radius: ${t=>{let{theme:e}=t;return e.borderRadius}}px;
  border: 1px solid ${t=>{let{theme:e}=t;return e.colors.secondary.light2}};
`,D=r.iK.div`
  margin-bottom: ${t=>{let{theme:e}=t;return 5*e.gridUnit}}px;

  .control-label {
    margin-bottom: ${t=>{let{theme:e}=t;return 2*e.gridUnit}}px;
  }

  .required {
    margin-left: ${t=>{let{theme:e}=t;return e.gridUnit/2}}px;
    color: ${t=>{let{theme:e}=t;return e.colors.error.base}};
  }

  textarea {
    flex: 1 1 auto;
    height: ${t=>{let{theme:e}=t;return 17*e.gridUnit}}px;
    resize: none;
    width: 100%;
  }

  textarea,
  input[type='text'] {
    padding: ${t=>{let{theme:e}=t;return 1.5*e.gridUnit}}px
      ${t=>{let{theme:e}=t;return 2*e.gridUnit}}px;
    border: 1px solid ${t=>{let{theme:e}=t;return e.colors.grayscale.light2}};
    border-radius: ${t=>{let{theme:e}=t;return e.gridUnit}}px;
  }

  input[type='text'] {
    width: 65%;
  }
`,H=(0,f.ZP)((t=>{var e,n;let{addDangerToast:o,addSuccessToast:l,annotationLayerId:r,annotation:d=null,onAnnotationAdd:c,onHide:m,show:h}=t;const[p,g]=(0,a.useState)(!0),[Z,_]=(0,a.useState)(null),b=null!==d,{state:{loading:y,resource:f},fetchResource:S,createResource:H,updateResource:T}=(0,x.LE)(`annotation_layer/${r}/annotation`,(0,s.t)("annotation"),o),N=()=>{_({short_descr:"",start_dttm:"",end_dttm:"",json_metadata:"",long_descr:""})},E=()=>{b?_(f):N(),m()},Y=t=>{const{target:e}=t,n={...Z,end_dttm:Z?Z.end_dttm:"",short_descr:Z?Z.short_descr:"",start_dttm:Z?Z.start_dttm:""};n[e.name]=e.value,_(n)};return(0,a.useEffect)((()=>{if(b&&(!Z||!Z.id||d&&d.id!==Z.id||h)){if(null!==(null==d?void 0:d.id)&&!y){const t=d.id||0;S(t)}}else b||Z&&!Z.id&&!h||N()}),[d]),(0,a.useEffect)((()=>{f&&_(f)}),[f]),(0,a.useEffect)((()=>{var t,e,n;null!=Z&&null!=(t=Z.short_descr)&&t.length&&null!=Z&&null!=(e=Z.start_dttm)&&e.length&&null!=Z&&null!=(n=Z.end_dttm)&&n.length?g(!1):g(!0)}),[Z?Z.short_descr:"",Z?Z.start_dttm:"",Z?Z.end_dttm:""]),(0,i.tZ)(k.Z,{disablePrimaryButton:p,onHandledPrimaryAction:()=>{if(b){if(null!=Z&&Z.id){const t=Z.id;delete Z.id,delete Z.created_by,delete Z.changed_by,delete Z.changed_on_delta_humanized,delete Z.layer,T(t,Z).then((t=>{t&&(c&&c(),E(),l((0,s.t)("The annotation has been updated")))}))}}else Z&&H(Z).then((t=>{t&&(c&&c(),E(),l((0,s.t)("The annotation has been saved")))}))},onHide:E,primaryButtonName:b?(0,s.t)("Save"):(0,s.t)("Add"),show:h,width:"55%",title:(0,i.tZ)("h4",null,b?(0,i.tZ)(w.Z.EditAlt,{css:v.xL}):(0,i.tZ)(w.Z.PlusLarge,{css:v.xL}),b?(0,s.t)("Edit annotation"):(0,s.t)("Add annotation"))},(0,i.tZ)(C,null,(0,i.tZ)("h4",null,(0,s.t)("Basic information"))),(0,i.tZ)(D,null,(0,i.tZ)("div",{className:"control-label"},(0,s.t)("Annotation name"),(0,i.tZ)("span",{className:"required"},"*")),(0,i.tZ)("input",{name:"short_descr",onChange:Y,type:"text",value:null==Z?void 0:Z.short_descr})),(0,i.tZ)(D,null,(0,i.tZ)("div",{className:"control-label"},(0,s.t)("date"),(0,i.tZ)("span",{className:"required"},"*")),(0,i.tZ)($.S,{placeholder:[(0,s.t)("Start date"),(0,s.t)("End date")],format:"YYYY-MM-DD HH:mm",onChange:(t,e)=>{const n={...Z,end_dttm:Z&&e[1].length?u()(e[1]).format("YYYY-MM-DD HH:mm"):"",short_descr:Z?Z.short_descr:"",start_dttm:Z&&e[0].length?u()(e[0]).format("YYYY-MM-DD HH:mm"):""};_(n)},showTime:{format:"hh:mm a"},use12Hours:!0,value:null!=Z&&null!=(e=Z.start_dttm)&&e.length||null!=Z&&null!=(n=Z.end_dttm)&&n.length?[u()(Z.start_dttm),u()(Z.end_dttm)]:null})),(0,i.tZ)(C,null,(0,i.tZ)("h4",null,(0,s.t)("Additional information"))),(0,i.tZ)(D,null,(0,i.tZ)("div",{className:"control-label"},(0,s.t)("description")),(0,i.tZ)("textarea",{name:"long_descr",value:Z?Z.long_descr:"",placeholder:(0,s.t)("Description (this can be seen in the list)"),onChange:Y})),(0,i.tZ)(D,null,(0,i.tZ)("div",{className:"control-label"},(0,s.t)("JSON metadata")),(0,i.tZ)(A,{onChange:t=>{const e={...Z,end_dttm:Z?Z.end_dttm:"",json_metadata:t,short_descr:Z?Z.short_descr:"",start_dttm:Z?Z.start_dttm:""};_(e)},value:null!=Z&&Z.json_metadata?Z.json_metadata:"",width:"100%",height:"120px"})))})),T=r.iK.div`
  ${t=>{let{theme:e}=t;return i.iv`
    display: flex;
    flex-direction: row;

    a,
    Link {
      margin-left: ${4*e.gridUnit}px;
      font-size: ${e.typography.sizes.s}px;
      font-weight: ${e.typography.weights.normal};
      text-decoration: underline;
    }
  `}}
`,N=(0,f.ZP)((function(t){let{addDangerToast:e,addSuccessToast:n}=t;const{annotationLayerId:r}=(0,l.UO)(),{state:{loading:c,resourceCount:m,resourceCollection:f,bulkSelectEnabled:$},fetchData:w,refreshData:k,toggleBulkSelect:S}=(0,x.Yi)(`annotation_layer/${r}/annotation`,(0,s.t)("annotation"),e,!1),[C,A]=(0,a.useState)(!1),[D,N]=(0,a.useState)(""),[E,Y]=(0,a.useState)(null),[U,L]=(0,a.useState)(null),B=t=>{Y(t),A(!0)},M=(0,a.useCallback)((async function(){try{const t=await d.Z.get({endpoint:`/api/v1/annotation_layer/${r}`});N(t.json.result.name)}catch(t){await(0,y.O$)(t).then((t=>{let{error:n}=t;e(n.error||n.statusText||n)}))}}),[r]);(0,a.useEffect)((()=>{M()}),[M]);const j=[{id:"short_descr",desc:!0}],K=(0,a.useMemo)((()=>[{accessor:"short_descr",Header:(0,s.t)("Label")},{accessor:"long_descr",Header:(0,s.t)("Description")},{Cell:t=>{let{row:{original:{start_dttm:e}}}=t;return u()(new Date(e)).format("ll")},Header:(0,s.t)("Start"),accessor:"start_dttm"},{Cell:t=>{let{row:{original:{end_dttm:e}}}=t;return u()(new Date(e)).format("ll")},Header:(0,s.t)("End"),accessor:"end_dttm"},{Cell:t=>{let{row:{original:e}}=t;const n=[{label:"edit-action",tooltip:(0,s.t)("Edit annotation"),placement:"bottom",icon:"Edit",onClick:()=>B(e)},{label:"delete-action",tooltip:(0,s.t)("Delete annotation"),placement:"bottom",icon:"Trash",onClick:()=>L(e)}];return(0,i.tZ)(p.Z,{actions:n})},Header:(0,s.t)("Actions"),id:"actions",disableSortBy:!0}]),[!0,!0]),P=[];P.push({name:(0,i.tZ)(a.Fragment,null,(0,i.tZ)("i",{className:"fa fa-plus"})," ",(0,s.t)("Annotation")),buttonStyle:"primary",onClick:()=>{B(null)}}),P.push({name:(0,s.t)("Bulk select"),onClick:S,buttonStyle:"secondary","data-test":"annotation-bulk-select"});let z=!0;try{(0,l.k6)()}catch(t){z=!1}const I={title:(0,s.t)("No annotation yet"),image:"filter-results.svg",buttonAction:()=>{B(null)},buttonText:(0,i.tZ)(a.Fragment,null,(0,i.tZ)("i",{className:"fa fa-plus"})," ",(0,s.t)("Annotation"))};return(0,i.tZ)(a.Fragment,null,(0,i.tZ)(b.Z,{name:(0,i.tZ)(T,null,(0,i.tZ)("span",null,(0,s.t)("Annotation Layer %s",D)),(0,i.tZ)("span",null,z?(0,i.tZ)(o.rU,{to:"/annotationlayer/list/"},(0,s.t)("Back to all")):(0,i.tZ)("a",{href:"/annotationlayer/list/"},(0,s.t)("Back to all")))),buttons:P}),(0,i.tZ)(H,{addDangerToast:e,addSuccessToast:n,annotation:E,show:C,onAnnotationAdd:()=>k(),annotationLayerId:r,onHide:()=>A(!1)}),U&&(0,i.tZ)(Z.Z,{description:(0,s.t)("Are you sure you want to delete %s?",null==U?void 0:U.short_descr),onConfirm:()=>{U&&(t=>{let{id:a,short_descr:o}=t;d.Z.delete({endpoint:`/api/v1/annotation_layer/${r}/annotation/${a}`}).then((()=>{k(),L(null),n((0,s.t)("Deleted: %s",o))}),(0,v.v$)((t=>e((0,s.t)("There was an issue deleting %s: %s",o,t)))))})(U)},onHide:()=>L(null),open:!0,title:(0,s.t)("Delete Annotation?")}),(0,i.tZ)(g.Z,{title:(0,s.t)("Please confirm"),description:(0,s.t)("Are you sure you want to delete the selected annotations?"),onConfirm:t=>{d.Z.delete({endpoint:`/api/v1/annotation_layer/${r}/annotation/?q=${h().encode(t.map((t=>{let{id:e}=t;return e})))}`}).then((t=>{let{json:e={}}=t;k(),n(e.message)}),(0,v.v$)((t=>e((0,s.t)("There was an issue deleting the selected annotations: %s",t)))))}},(t=>{const e=[{key:"delete",name:(0,s.t)("Delete"),onSelect:t,type:"danger"}];return(0,i.tZ)(_.Z,{className:"annotations-list-view",bulkActions:e,bulkSelectEnabled:$,columns:K,count:m,data:f,disableBulkSelect:S,emptyState:I,fetchData:w,initialSort:j,loading:c,pageSize:25})})))}))}}]);
//# sourceMappingURL=eb2be50d7496b178b51a.chunk.js.map
