"use strict";(globalThis.webpackChunksuperset=globalThis.webpackChunksuperset||[]).push([[9452],{29848:(e,t,l)=>{l.d(t,{Z:()=>d}),l(67294);var a=l(51995),n=l(58593),s=l(70163),r=l(11965);const i=a.iK.span`
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
`,o=a.iK.span`
  color: ${e=>{let{theme:t}=e;return t.colors.grayscale.base}};
`;function d(e){let{actions:t}=e;return(0,r.tZ)(i,{className:"actions"},t.map(((e,t)=>{const l=s.Z[e.icon];return e.tooltip?(0,r.tZ)(n.u,{id:`${e.label}-tooltip`,title:e.tooltip,placement:e.placement,key:t},(0,r.tZ)(o,{role:"button",tabIndex:0,className:"action-button",onClick:e.onClick},(0,r.tZ)(l,null))):(0,r.tZ)(o,{role:"button",tabIndex:0,className:"action-button",onClick:e.onClick,key:t},(0,r.tZ)(l,null))})))}},45395:(e,t,l)=>{l.r(t),l.d(t,{default:()=>T});var a=l(67294),n=l(55867),s=l(31069),r=l(15926),i=l.n(r),o=l(30381),d=l.n(o),c=l(34858),u=l(40768),m=l(14114),p=l(20755),h=l(17198),g=l(58593),b=l(19259),Z=l(29848),_=l(18782),y=l(51995),S=l(70163),f=l(74069),C=l(94670),w=l(11965);const v=y.iK.div`
  margin: ${e=>{let{theme:t}=e;return 2*t.gridUnit}}px auto
    ${e=>{let{theme:t}=e;return 4*t.gridUnit}}px auto;
`,$=(0,y.iK)(C.ry)`
  border-radius: ${e=>{let{theme:t}=e;return t.borderRadius}}px;
  border: 1px solid ${e=>{let{theme:t}=e;return t.colors.secondary.light2}};
`,k=y.iK.div`
  margin-bottom: ${e=>{let{theme:t}=e;return 10*t.gridUnit}}px;

  .control-label {
    margin-bottom: ${e=>{let{theme:t}=e;return 2*t.gridUnit}}px;
  }

  .required {
    margin-left: ${e=>{let{theme:t}=e;return t.gridUnit/2}}px;
    color: ${e=>{let{theme:t}=e;return t.colors.error.base}};
  }

  input[type='text'] {
    padding: ${e=>{let{theme:t}=e;return 1.5*t.gridUnit}}px
      ${e=>{let{theme:t}=e;return 2*t.gridUnit}}px;
    border: 1px solid ${e=>{let{theme:t}=e;return t.colors.grayscale.light2}};
    border-radius: ${e=>{let{theme:t}=e;return t.gridUnit}}px;
    width: 50%;
  }
`,x=(0,m.ZP)((e=>{let{addDangerToast:t,onCssTemplateAdd:l,onHide:s,show:r,cssTemplate:i=null}=e;const[o,d]=(0,a.useState)(!0),[m,p]=(0,a.useState)(null),[h,g]=(0,a.useState)(!0),b=null!==i,{state:{loading:Z,resource:_},fetchResource:y,createResource:C,updateResource:x}=(0,c.LE)("css_template",(0,n.t)("css_template"),t),T=()=>{g(!0),s()};return(0,a.useEffect)((()=>{if(b&&(!m||!m.id||i&&(null==i?void 0:i.id)!==m.id||h&&r)){if(null!==(null==i?void 0:i.id)&&!Z){const e=i.id||0;y(e)}}else!b&&(!m||m.id||h&&r)&&p({template_name:"",css:""})}),[i]),(0,a.useEffect)((()=>{_&&p(_)}),[_]),(0,a.useEffect)((()=>{var e;null!=m&&m.template_name.length&&null!=m&&null!=(e=m.css)&&e.length?d(!1):d(!0)}),[m?m.template_name:"",m?m.css:""]),h&&r&&g(!1),(0,w.tZ)(f.Z,{disablePrimaryButton:o,onHandledPrimaryAction:()=>{if(b){if(null!=m&&m.id){const e=m.id;delete m.id,delete m.created_by,x(e,m).then((e=>{e&&(l&&l(),T())}))}}else m&&C(m).then((e=>{e&&(l&&l(),T())}))},onHide:T,primaryButtonName:b?(0,n.t)("Save"):(0,n.t)("Add"),show:r,width:"55%",title:(0,w.tZ)("h4",null,b?(0,w.tZ)(S.Z.EditAlt,{css:u.xL}):(0,w.tZ)(S.Z.PlusLarge,{css:u.xL}),b?(0,n.t)("Edit CSS template properties"):(0,n.t)("Add CSS template"))},(0,w.tZ)(v,null,(0,w.tZ)("h4",null,(0,n.t)("Basic information"))),(0,w.tZ)(k,null,(0,w.tZ)("div",{className:"control-label"},(0,n.t)("CSS template name"),(0,w.tZ)("span",{className:"required"},"*")),(0,w.tZ)("input",{name:"template_name",onChange:e=>{const{target:t}=e,l={...m,template_name:m?m.template_name:"",css:m?m.css:""};l[t.name]=t.value,p(l)},type:"text",value:null==m?void 0:m.template_name})),(0,w.tZ)(k,null,(0,w.tZ)("div",{className:"control-label"},(0,n.t)("css"),(0,w.tZ)("span",{className:"required"},"*")),(0,w.tZ)($,{onChange:e=>{const t={...m,template_name:m?m.template_name:"",css:e};p(t)},value:null==m?void 0:m.css,width:"100%"})))})),T=(0,m.ZP)((function(e){let{addDangerToast:t,addSuccessToast:l,user:r}=e;const{state:{loading:o,resourceCount:m,resourceCollection:y,bulkSelectEnabled:S},hasPerm:f,fetchData:C,refreshData:v,toggleBulkSelect:$}=(0,c.Yi)("css_template",(0,n.t)("CSS templates"),t),[k,T]=(0,a.useState)(!1),[D,H]=(0,a.useState)(null),N=f("can_write"),A=f("can_write"),B=f("can_write"),[E,U]=(0,a.useState)(null),z=[{id:"template_name",desc:!0}],L=(0,a.useMemo)((()=>[{accessor:"template_name",Header:(0,n.t)("Name")},{Cell:e=>{let{row:{original:{changed_on_delta_humanized:t,changed_by:l}}}=e,a="null";return l&&(a=`${l.first_name} ${l.last_name}`),(0,w.tZ)(g.u,{id:"allow-run-async-header-tooltip",title:(0,n.t)("Last modified by %s",a),placement:"right"},(0,w.tZ)("span",null,t))},Header:(0,n.t)("Last modified"),accessor:"changed_on_delta_humanized",size:"xl",disableSortBy:!0},{Cell:e=>{let{row:{original:{created_on:t}}}=e;const l=new Date(t),a=new Date(Date.UTC(l.getFullYear(),l.getMonth(),l.getDate(),l.getHours(),l.getMinutes(),l.getSeconds(),l.getMilliseconds()));return d()(a).fromNow()},Header:(0,n.t)("Created on"),accessor:"created_on",size:"xl",disableSortBy:!0},{accessor:"created_by",disableSortBy:!0,Header:(0,n.t)("Created by"),Cell:e=>{let{row:{original:{created_by:t}}}=e;return t?`${t.first_name} ${t.last_name}`:""},size:"xl"},{Cell:e=>{let{row:{original:t}}=e;const l=[A?{label:"edit-action",tooltip:(0,n.t)("Edit template"),placement:"bottom",icon:"Edit",onClick:()=>(H(t),void T(!0))}:null,B?{label:"delete-action",tooltip:(0,n.t)("Delete template"),placement:"bottom",icon:"Trash",onClick:()=>U(t)}:null].filter((e=>!!e));return(0,w.tZ)(Z.Z,{actions:l})},Header:(0,n.t)("Actions"),id:"actions",disableSortBy:!0,hidden:!A&&!B,size:"xl"}]),[B,N]),P={name:(0,n.t)("CSS templates")},M=[];N&&M.push({name:(0,w.tZ)(a.Fragment,null,(0,w.tZ)("i",{className:"fa fa-plus"})," ",(0,n.t)("CSS template")),buttonStyle:"primary",onClick:()=>{H(null),T(!0)}}),B&&M.push({name:(0,n.t)("Bulk select"),onClick:$,buttonStyle:"secondary"}),P.buttons=M;const K=(0,a.useMemo)((()=>[{Header:(0,n.t)("Created by"),key:"created_by",id:"created_by",input:"select",operator:_.p.relationOneMany,unfilteredLabel:(0,n.t)("All"),fetchSelects:(0,u.tm)("css_template","created_by",(0,u.v$)((e=>(0,n.t)("An error occurred while fetching dataset datasource values: %s",e))),r),paginate:!0},{Header:(0,n.t)("Search"),key:"search",id:"template_name",input:"search",operator:_.p.contains}]),[]);return(0,w.tZ)(a.Fragment,null,(0,w.tZ)(p.Z,P),(0,w.tZ)(x,{addDangerToast:t,cssTemplate:D,onCssTemplateAdd:()=>v(),onHide:()=>T(!1),show:k}),E&&(0,w.tZ)(h.Z,{description:(0,n.t)("This action will permanently delete the template."),onConfirm:()=>{E&&(e=>{let{id:a,template_name:r}=e;s.Z.delete({endpoint:`/api/v1/css_template/${a}`}).then((()=>{v(),U(null),l((0,n.t)("Deleted: %s",r))}),(0,u.v$)((e=>t((0,n.t)("There was an issue deleting %s: %s",r,e)))))})(E)},onHide:()=>U(null),open:!0,title:(0,n.t)("Delete Template?")}),(0,w.tZ)(b.Z,{title:(0,n.t)("Please confirm"),description:(0,n.t)("Are you sure you want to delete the selected templates?"),onConfirm:e=>{s.Z.delete({endpoint:`/api/v1/css_template/?q=${i().encode(e.map((e=>{let{id:t}=e;return t})))}`}).then((e=>{let{json:t={}}=e;v(),l(t.message)}),(0,u.v$)((e=>t((0,n.t)("There was an issue deleting the selected templates: %s",e)))))}},(e=>{const t=B?[{key:"delete",name:(0,n.t)("Delete"),onSelect:e,type:"danger"}]:[];return(0,w.tZ)(_.Z,{className:"css-templates-list-view",columns:L,count:m,data:y,fetchData:C,filters:K,initialSort:z,loading:o,pageSize:25,bulkActions:t,bulkSelectEnabled:S,disableBulkSelect:$})})))}))}}]);
//# sourceMappingURL=34b3b500d4f1b126ec17.chunk.js.map
