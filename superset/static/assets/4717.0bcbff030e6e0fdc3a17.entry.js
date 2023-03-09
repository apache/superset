"use strict";(globalThis.webpackChunksuperset=globalThis.webpackChunksuperset||[]).push([[4717],{2275:(e,t,r)=>{r.d(t,{cP:()=>s,$6:()=>d,Rw:()=>c,Er:()=>h,DZ:()=>p,$X:()=>u,ck:()=>b});var i=r(45697),l=r.n(i),a=r(81255),n=r(713),o=r(79271);const s=l().shape({id:l().string.isRequired,type:l().oneOf(Object.values(a.ZP)).isRequired,parents:l().arrayOf(l().string),children:l().arrayOf(l().string),meta:l().shape({width:l().number,height:l().number,headerSize:l().oneOf(o.Z.map((e=>e.value))),background:l().oneOf(n.Z.map((e=>e.value))),chartId:l().number})}),d=l().shape({id:l().number.isRequired,chartAlert:l().string,chartStatus:l().string,chartUpdateEndTime:l().number,chartUpdateStartTime:l().number,latestQueryFormData:l().object,queryController:l().shape({abort:l().func}),queriesResponse:l().arrayOf(l().object),triggerQuery:l().bool,lastRendered:l().number}),c=l().shape({slice_id:l().number.isRequired,slice_url:l().string.isRequired,slice_name:l().string.isRequired,datasource:l().string,datasource_name:l().string,datasource_link:l().string,changed_on:l().number.isRequired,modified:l().string,viz_type:l().string.isRequired,description:l().string,description_markeddown:l().string,owners:l().arrayOf(l().string)}),h=l().shape({chartId:l().number.isRequired,componentId:l().string.isRequired,filterName:l().string.isRequired,datasourceId:l().string.isRequired,directPathToFilter:l().arrayOf(l().string).isRequired,isDateFilter:l().bool.isRequired,isInstantFilter:l().bool.isRequired,columns:l().object,labels:l().object,scopes:l().object}),p=l().shape({sliceIds:l().arrayOf(l().number),expandedSlices:l().object,editMode:l().bool,isPublished:l().bool,colorNamespace:l().string,colorScheme:l().string,updatedColorScheme:l().bool,hasUnsavedChanges:l().bool}),u=l().shape({id:l().number,metadata:l().object,slug:l().string,dash_edit_perm:l().bool,dash_save_perm:l().bool,common:l().object,userId:l().string}),m=l().shape({value:l().oneOfType([l().number,l().string]).isRequired,label:l().string.isRequired}),g={value:l().oneOfType([l().number,l().string]).isRequired,label:l().string.isRequired,children:l().arrayOf(l().oneOfType([l().shape((f=()=>g,()=>f().apply(void 0,arguments))),m]))};var f;const b=l().oneOfType([l().shape(g),m])},79789:(e,t,r)=>{r.d(t,{Z:()=>d});var i=r(67294),l=r(51995),a=r(55867),n=r(70163),o=r(58593),s=r(11965);const d=function(e){let{certifiedBy:t,details:r,size:d="l"}=e;const c=(0,l.Fg)();return(0,s.tZ)(o.u,{id:"certified-details-tooltip",title:(0,s.tZ)(i.Fragment,null,t&&(0,s.tZ)("div",null,(0,s.tZ)("strong",null,(0,a.t)("Certified by %s",t))),(0,s.tZ)("div",null,r))},(0,s.tZ)(n.Z.Certified,{iconColor:c.colors.primary.base,iconSize:d}))}},17198:(e,t,r)=>{r.d(t,{Z:()=>p});var i=r(51995),l=r(55867),a=r(67294),n=r(9875),o=r(74069),s=r(49238),d=r(11965);const c=i.iK.div`
  padding-top: 8px;
  width: 50%;
  label {
    color: ${e=>{let{theme:t}=e;return t.colors.grayscale.base}};
    text-transform: uppercase;
  }
`,h=i.iK.div`
  line-height: 40px;
  padding-top: 16px;
`;function p(e){let{description:t,onConfirm:r,onHide:i,open:p,title:u}=e;const[m,g]=(0,a.useState)(!0),[f,b]=(0,a.useState)(""),v=()=>{b(""),r()};return(0,d.tZ)(o.Z,{disablePrimaryButton:m,onHide:()=>{b(""),i()},onHandledPrimaryAction:v,primaryButtonName:(0,l.t)("delete"),primaryButtonType:"danger",show:p,title:u},(0,d.tZ)(h,null,t),(0,d.tZ)(c,null,(0,d.tZ)(s.lX,{htmlFor:"delete"},(0,l.t)('Type "%s" to confirm',(0,l.t)("DELETE"))),(0,d.tZ)(n.II,{type:"text",id:"delete",autoComplete:"off",value:f,onChange:e=>{var t;const r=null!=(t=e.target.value)?t:"";g(r.toUpperCase()!==(0,l.t)("DELETE")),b(r)},onPressEnter:()=>{m||v()}})))}},36674:(e,t,r)=>{r.d(t,{Z:()=>h});var i=r(67294),l=r(51995),a=r(11965),n=r(55867),o=r(58593),s=r(33626),d=r(70163);const c=l.iK.a`
  ${e=>{let{theme:t}=e;return a.iv`
    font-size: ${t.typography.sizes.xl}px;
    display: flex;
    padding: 0 0 0 ${2*t.gridUnit}px;
  `}};
`,h=e=>{let{itemId:t,isStarred:r,showTooltip:l,saveFaveStar:h,fetchFaveStar:p}=e;(0,s.J)((()=>{p&&p(t)}));const u=(0,i.useCallback)((e=>{e.preventDefault(),h(t,!!r)}),[r,t,h]),m=(0,a.tZ)(c,{href:"#",onClick:u,className:"fave-unfave-icon",role:"button"},r?(0,a.tZ)(d.Z.FavoriteSelected,null):(0,a.tZ)(d.Z.FavoriteUnselected,null));return l?(0,a.tZ)(o.u,{id:"fave-unfave-tooltip",title:(0,n.t)("Click to favorite/unfavorite")},m):m}},4144:(e,t,r)=>{r.d(t,{Z:()=>c});var i=r(5872),l=r.n(i),a=r(67294),n=r(51995),o=r(68492),s=r(11965);const d=n.iK.div`
  background-image: url(${e=>{let{src:t}=e;return t}});
  background-size: cover;
  background-position: center ${e=>{let{position:t}=e;return t}};
  display: inline-block;
  height: calc(100% - 1px);
  width: calc(100% - 2px);
  margin: 1px 1px 0 1px;
`;function c(e){let{src:t,fallback:r,isLoading:i,position:n,...c}=e;const[h,p]=(0,a.useState)(r);return(0,a.useEffect)((()=>(t&&fetch(t).then((e=>e.blob())).then((e=>{if(/image/.test(e.type)){const t=URL.createObjectURL(e);p(t)}})).catch((e=>{o.Z.error(e),p(r)})),()=>{p(r)})),[t,r]),(0,s.tZ)(d,l()({src:i?r:h},c,{position:n}))}},60718:(e,t,r)=>{r.d(t,{m:()=>p});var i=r(31069),l=r(55867),a=r(15926),n=r.n(a),o=r(65108),s=r(98286);const d=new Map,c=(0,o.g)(i.Z.get,d,(e=>{let{endpoint:t}=e;return t||""})),h=e=>({value:e.name,label:e.name,key:e.name}),p=async(e,t,r)=>{const i="name",a=n().encode({filters:[{col:i,opr:"ct",value:e}],page:t,page_size:r,order_column:i,order_direction:"asc"});return c({endpoint:`/api/v1/tag/?q=${a}`}).then((e=>({data:e.json.result.filter((e=>1===e.type)).map(h),totalCount:e.json.count}))).catch((async e=>{const t=(e=>{let{error:t,message:r}=e,i=r||t||(0,l.t)("An error has occurred");return"Forbidden"===r&&(i=(0,l.t)("You do not have permission to edit this dashboard")),i})(await(0,s.O$)(e));throw new Error(t)}))}},20818:(e,t,r)=>{r.d(t,{Z:()=>D});var i=r(78580),l=r.n(i),a=r(67294),n=r(9875),o=r(49238),s=r(51127),d=r.n(s),c=r(35932),h=r(4715),p=r(15926),u=r.n(p),m=r(51995),g=r(55867),f=r(81545),b=r(31069),v=r(55786),y=r(78161),F=r(28062),x=r(74069),Z=r(94670),C=r(45697),S=r.n(C),k=r(76787),$=r(11965);const w={onChange:S().func,labelMargin:S().number,colorScheme:S().string,hasCustomLabelColors:S().bool};class N extends a.PureComponent{constructor(e){super(e),this.state={hovered:!1},this.categoricalSchemeRegistry=(0,f.Z)(),this.choices=this.categoricalSchemeRegistry.keys().map((e=>[e,e])),this.schemes=this.categoricalSchemeRegistry.getMap()}setHover(e){this.setState({hovered:e})}render(){const{colorScheme:e,labelMargin:t=0,hasCustomLabelColors:r}=this.props;return(0,$.tZ)(k.Z,{description:(0,g.t)("Any color palette selected here will override the colors applied to this dashboard's individual charts"),labelMargin:t,name:"color_scheme",onChange:this.props.onChange,value:e,choices:this.choices,clearable:!0,schemes:this.schemes,hovered:this.state.hovered,hasCustomLabelColors:r})}}N.propTypes=w,N.defaultProps={hasCustomLabelColors:!1,colorScheme:void 0,onChange:()=>{}};const T=N;var I=r(87999),_=r(98286),O=r(14114),j=r(91877),E=r(93185),R=r(85605),U=r(60718);const q=(0,m.iK)(o.xJ)`
  margin-bottom: 0;
`,M=(0,m.iK)(Z.Ad)`
  border-radius: ${e=>{let{theme:t}=e;return t.borderRadius}}px;
  border: 1px solid ${e=>{let{theme:t}=e;return t.colors.secondary.light2}};
`;var A={name:"1blj7km",styles:"margin-top:1em"};const D=(0,O.ZP)((e=>{let{addSuccessToast:t,addDangerToast:r,colorScheme:i,dashboardId:s,dashboardInfo:p,dashboardTitle:m,onHide:C=(()=>{}),onlyApply:S=!1,onSubmit:k=(()=>{}),show:w=!1}=e;const[N]=h.qz.useForm(),[O,D]=(0,a.useState)(!1),[J,X]=(0,a.useState)(!1),[z,L]=(0,a.useState)(i),[B,K]=(0,a.useState)(""),[P,H]=(0,a.useState)(),[G,Y]=(0,a.useState)([]),[W,V]=(0,a.useState)([]),Q=S?(0,g.t)("Apply"):(0,g.t)("Save"),[ee,te]=(0,a.useState)([]),re=(0,f.Z)(),ie=(0,a.useMemo)((()=>ee.map((e=>({value:e.name,label:e.name,key:e.name})))),[ee.length]),le=async e=>{const{error:t,statusText:r,message:i}=await(0,_.O$)(e);let l=t||r||(0,g.t)("An error has occurred");"object"==typeof i&&"json_metadata"in i?l=i.json_metadata:"string"==typeof i&&(l=i,"Forbidden"===i&&(l=(0,g.t)("You do not have permission to edit this dashboard"))),x.Z.error({title:(0,g.t)("Error"),content:l,okButtonProps:{danger:!0,className:"btn-danger"}})},ae=(0,a.useCallback)((function(e,t,r,i){void 0===e&&(e="owners"),void 0===t&&(t="");const l=u().encode({filter:t,page:r,page_size:i});return b.Z.get({endpoint:`/api/v1/dashboard/related/${e}?q=${l}`}).then((e=>({data:e.json.result.filter((e=>void 0===e.extra.active||e.extra.active)).map((e=>({value:e.value,label:e.text}))),totalCount:e.json.count})))}),[]),ne=(0,a.useCallback)((e=>{const{id:t,dashboard_title:r,slug:i,certified_by:l,certification_details:a,owners:n,roles:o,metadata:s,is_managed_externally:c}=e,h={id:t,title:r,slug:i||"",certifiedBy:l||"",certificationDetails:a||"",isManagedExternally:c||!1};N.setFieldsValue(h),H(h),Y(n),V(o),L(s.color_scheme),null!=s&&s.positions&&delete s.positions;const p={...s};delete p.shared_label_colors,delete p.color_scheme_domain,K(p?d()(p):"")}),[N]),oe=(0,a.useCallback)((()=>{D(!0),b.Z.get({endpoint:`/api/v1/dashboard/${s}`}).then((e=>{var t;const r=e.json.result,i=null!=(t=r.json_metadata)&&t.length?JSON.parse(r.json_metadata):{};ne({...r,metadata:i}),D(!1)}),le)}),[s,ne]),se=()=>{try{return null!=B&&B.length?JSON.parse(B):{}}catch(e){return{}}},de=e=>{const t=(0,v.Z)(e).map((e=>({id:e.value,full_name:e.label})));Y(t)},ce=e=>{const t=(0,v.Z)(e).map((e=>({id:e.value,name:e.label})));V(t)},he=()=>(G||[]).map((e=>({value:e.id,label:e.full_name||`${e.first_name} ${e.last_name}`}))),pe=function(e,t){void 0===e&&(e="");let{updateMetadata:r=!0}=void 0===t?{}:t;const i=re.keys(),a=se();if(e&&!l()(i).call(i,e))throw x.Z.error({title:(0,g.t)("Error"),content:(0,g.t)("A valid color scheme is required"),okButtonProps:{danger:!0,className:"btn-danger"}}),new Error("A valid color scheme is required");r&&(a.color_scheme=e,a.label_colors=a.label_colors||{},K(d()(a))),L(e)};return(0,a.useEffect)((()=>{w&&(p?ne(p):oe()),Z.Ad.preload()}),[p,oe,ne,w]),(0,a.useEffect)((()=>{m&&P&&P.title!==m&&N.setFieldsValue({...P,title:m})}),[P,m,N]),(0,a.useEffect)((()=>{if((0,j.cr)(E.T.TAGGING_SYSTEM))try{(0,R.$3)({objectType:R.g.DASHBOARD,objectId:s,includeTypes:!1},(e=>te(e)),(e=>{r(`Error fetching tags: ${e.text}`)}))}catch(e){le(e)}}),[s]),(0,$.tZ)(x.Z,{show:w,onHide:C,title:(0,g.t)("Dashboard properties"),footer:(0,$.tZ)(a.Fragment,null,(0,$.tZ)(c.Z,{htmlType:"button",buttonSize:"small",onClick:C,cta:!0},(0,g.t)("Cancel")),(0,$.tZ)(c.Z,{onClick:N.submit,buttonSize:"small",buttonStyle:"primary",className:"m-r-5",cta:!0,disabled:null==P?void 0:P.isManagedExternally,tooltip:null!=P&&P.isManagedExternally?(0,g.t)("This dashboard is managed externally, and can't be edited in Superset"):""},Q)),responsive:!0},(0,$.tZ)(h.qz,{form:N,onFinish:()=>{var e,i,l,a;const{title:n,slug:o,certifiedBy:c,certificationDetails:h}=N.getFieldsValue();let p,u=z,m="",f=B;try{if(!f.startsWith("{")||!f.endsWith("}"))throw new Error;p=JSON.parse(f)}catch(e){return void r((0,g.t)("JSON metadata is invalid!"))}u=(null==(e=p)?void 0:e.color_scheme)||z,m=null==(i=p)?void 0:i.color_namespace,null!=(l=p)&&l.shared_label_colors&&delete p.shared_label_colors,null!=(a=p)&&a.color_scheme_domain&&delete p.color_scheme_domain;const v=(0,y.ZP)();var x;if(F.getNamespace(m).resetColors(),u?(v.updateColorMap(m,u),p.shared_label_colors=Object.fromEntries(v.getColorMap()),p.color_scheme_domain=(null==(x=re.get(z))?void 0:x.colors)||[]):(v.reset(),p.shared_label_colors={},p.color_scheme_domain=[]),f=d()(p),pe(u,{updateMetadata:!1}),(0,j.cr)(E.T.TAGGING_SYSTEM))try{(0,R.$3)({objectType:R.g.DASHBOARD,objectId:s,includeTypes:!1},(e=>{return t=e,(r=ee).map((e=>{t.some((t=>t.name===e.name))||(0,R._U)({objectType:R.g.DASHBOARD,objectId:s,includeTypes:!1},e.name,(()=>{}),(()=>{}))})),void t.map((e=>{r.some((t=>t.name===e.name))||(0,R.OY)({objectType:R.g.DASHBOARD,objectId:s},e,(()=>{}),(()=>{}))}));var t,r}),(e=>{le(e)}))}catch(e){le(e)}const Z={},$={};(0,j.cr)(E.T.DASHBOARD_RBAC)&&(Z.roles=W,$.roles=(W||[]).map((e=>e.id)));const w={id:s,title:n,slug:o,jsonMetadata:f,owners:G,colorScheme:u,colorNamespace:m,certifiedBy:c,certificationDetails:h,...Z};S?(k(w),C(),t((0,g.t)("Dashboard properties updated"))):b.Z.put({endpoint:`/api/v1/dashboard/${s}`,headers:{"Content-Type":"application/json"},body:JSON.stringify({dashboard_title:n,slug:o||null,json_metadata:f||null,owners:(G||[]).map((e=>e.id)),certified_by:c||null,certification_details:c&&h?h:null,...$})}).then((()=>{k(w),C(),t((0,g.t)("The dashboard has been saved"))}),le)},layout:"vertical",initialValues:P},(0,$.tZ)(h.X2,null,(0,$.tZ)(h.JX,{xs:24,md:24},(0,$.tZ)("h3",null,(0,g.t)("Basic information")))),(0,$.tZ)(h.X2,{gutter:16},(0,$.tZ)(h.JX,{xs:24,md:12},(0,$.tZ)(o.xJ,{label:(0,g.t)("Title"),name:"title"},(0,$.tZ)(n.II,{type:"text",disabled:O}))),(0,$.tZ)(h.JX,{xs:24,md:12},(0,$.tZ)(q,{label:(0,g.t)("URL slug"),name:"slug"},(0,$.tZ)(n.II,{type:"text",disabled:O})),(0,$.tZ)("p",{className:"help-block"},(0,g.t)("A readable URL for your dashboard")))),(0,j.cr)(E.T.DASHBOARD_RBAC)?(()=>{const e=se(),t=!!Object.keys((null==e?void 0:e.label_colors)||{}).length;return(0,$.tZ)(a.Fragment,null,(0,$.tZ)(h.X2,null,(0,$.tZ)(h.JX,{xs:24,md:24},(0,$.tZ)("h3",{style:{marginTop:"1em"}},(0,g.t)("Access")))),(0,$.tZ)(h.X2,{gutter:16},(0,$.tZ)(h.JX,{xs:24,md:12},(0,$.tZ)(q,{label:(0,g.t)("Owners")},(0,$.tZ)(h.qb,{allowClear:!0,allowNewOptions:!0,ariaLabel:(0,g.t)("Owners"),disabled:O,mode:"multiple",onChange:de,options:(e,t,r)=>ae("owners",e,t,r),value:he()})),(0,$.tZ)("p",{className:"help-block"},(0,g.t)("Owners is a list of users who can alter the dashboard. Searchable by name or username."))),(0,$.tZ)(h.JX,{xs:24,md:12},(0,$.tZ)(q,{label:(0,g.t)("Roles")},(0,$.tZ)(h.qb,{allowClear:!0,ariaLabel:(0,g.t)("Roles"),disabled:O,mode:"multiple",onChange:ce,options:(e,t,r)=>ae("roles",e,t,r),value:(W||[]).map((e=>({value:e.id,label:`${e.name}`})))})),(0,$.tZ)("p",{className:"help-block"},(0,g.t)("Roles is a list which defines access to the dashboard. Granting a role access to a dashboard will bypass dataset level checks. If no roles are defined, then the dashboard is available to all roles.")))),(0,$.tZ)(h.X2,null,(0,$.tZ)(h.JX,{xs:24,md:12},(0,$.tZ)(T,{hasCustomLabelColors:t,onChange:pe,colorScheme:z,labelMargin:4}))))})():(()=>{const e=se(),t=!!Object.keys((null==e?void 0:e.label_colors)||{}).length;return(0,$.tZ)(h.X2,{gutter:16},(0,$.tZ)(h.JX,{xs:24,md:12},(0,$.tZ)("h3",{style:{marginTop:"1em"}},(0,g.t)("Access")),(0,$.tZ)(q,{label:(0,g.t)("Owners")},(0,$.tZ)(h.qb,{allowClear:!0,ariaLabel:(0,g.t)("Owners"),disabled:O,mode:"multiple",onChange:de,options:(e,t,r)=>ae("owners",e,t,r),value:he()})),(0,$.tZ)("p",{className:"help-block"},(0,g.t)("Owners is a list of users who can alter the dashboard. Searchable by name or username."))),(0,$.tZ)(h.JX,{xs:24,md:12},(0,$.tZ)("h3",{style:{marginTop:"1em"}},(0,g.t)("Colors")),(0,$.tZ)(T,{hasCustomLabelColors:t,onChange:pe,colorScheme:z,labelMargin:4})))})(),(0,$.tZ)(h.X2,null,(0,$.tZ)(h.JX,{xs:24,md:24},(0,$.tZ)("h3",null,(0,g.t)("Certification")))),(0,$.tZ)(h.X2,{gutter:16},(0,$.tZ)(h.JX,{xs:24,md:12},(0,$.tZ)(q,{label:(0,g.t)("Certified by"),name:"certifiedBy"},(0,$.tZ)(n.II,{type:"text",disabled:O})),(0,$.tZ)("p",{className:"help-block"},(0,g.t)("Person or group that has certified this dashboard."))),(0,$.tZ)(h.JX,{xs:24,md:12},(0,$.tZ)(q,{label:(0,g.t)("Certification details"),name:"certificationDetails"},(0,$.tZ)(n.II,{type:"text",disabled:O})),(0,$.tZ)("p",{className:"help-block"},(0,g.t)("Any additional detail to show in the certification tooltip.")))),(0,j.cr)(E.T.TAGGING_SYSTEM)?(0,$.tZ)(h.X2,{gutter:16},(0,$.tZ)(h.JX,{xs:24,md:12},(0,$.tZ)("h3",{css:A},(0,g.t)("Tags")))):null,(0,j.cr)(E.T.TAGGING_SYSTEM)?(0,$.tZ)(h.X2,{gutter:16},(0,$.tZ)(h.JX,{xs:24,md:12},(0,$.tZ)(q,null,(0,$.tZ)(h.qb,{ariaLabel:"Tags",mode:"multiple",allowNewOptions:!0,value:ie,options:U.m,onChange:e=>{const t=[...new Set(e.map((e=>e.label)))];te([...t.map((e=>({name:e})))])},allowClear:!0})),(0,$.tZ)("p",{className:"help-block"},(0,g.t)("A list of tags that have been applied to this chart.")))):null,(0,$.tZ)(h.X2,null,(0,$.tZ)(h.JX,{xs:24,md:24},(0,$.tZ)("h3",{style:{marginTop:"1em"}},(0,$.tZ)(c.Z,{buttonStyle:"link",onClick:()=>X(!J)},(0,$.tZ)("i",{className:"fa fa-angle-"+(J?"down":"right"),style:{minWidth:"1em"}}),(0,g.t)("Advanced"))),J&&(0,$.tZ)(a.Fragment,null,(0,$.tZ)(q,{label:(0,g.t)("JSON metadata")},(0,$.tZ)(M,{showLoadingForImport:!0,name:"json_metadata",value:B,onChange:K,tabSize:2,width:"100%",height:"200px",wrapEnabled:!0})),(0,$.tZ)("p",{className:"help-block"},(0,g.t)("This JSON object is generated dynamically when clicking the save or overwrite button in the dashboard view. It is exposed here for reference and for power users who may want to alter specific parameters."),S&&(0,$.tZ)(a.Fragment,null," ",(0,g.t)('Please DO NOT overwrite the "filter_scopes" key.')," ",(0,$.tZ)(I.Z,{triggerNode:(0,$.tZ)("span",{className:"alert-link"},(0,g.t)('Use "%(menuName)s" menu instead.',{menuName:(0,g.t)("Set filter mapping")}))}))))))))}))},87999:(e,t,r)=>{r.d(t,{Z:()=>be});var i=r(67294),l=r(51995),a=r(1304),n=r(28216),o=r(14890),s=r(81395),d=r(9467),c=r(78580),h=r.n(c),p=r(45697),u=r.n(p),m=r(94184),g=r.n(m),f=r(35932),b=r(11965),v=r(55867),y=r(41609),F=r.n(y),x=r(80621),Z=r(81255);const C=[Z.gn,Z.U0];function S(e){let{currentNode:t={},components:r={},filterFields:i=[],selectedChartId:l}=e;if(!t)return null;const{type:a}=t;if(Z.dW===a&&t&&t.meta&&t.meta.chartId){const e={value:t.meta.chartId,label:t.meta.sliceName||`${a} ${t.meta.chartId}`,type:a,showCheckbox:l!==t.meta.chartId};return{...e,children:i.map((r=>({value:`${t.meta.chartId}:${r}`,label:`${e.label}`,type:"filter_box",showCheckbox:!1})))}}let n=[];if(t.children&&t.children.length&&t.children.forEach((e=>{const t=S({currentNode:r[e],components:r,filterFields:i,selectedChartId:l}),a=r[e].type;h()(C).call(C,a)?n.push(t):n=n.concat(t)})),h()(C).call(C,a)){let e=null;return e=a===Z.U0?(0,v.t)("All charts"):t.meta&&t.meta.text?t.meta.text:`${a} ${t.id}`,{value:t.id,label:e,type:a,children:n}}return n}function k(e){let{components:t={},filterFields:r=[],selectedChartId:i}=e;return F()(t)?[]:[{...S({currentNode:t[x._4],components:t,filterFields:r,selectedChartId:i})}]}function $(e,t){void 0===e&&(e=[]),void 0===t&&(t=-1);const r=[],i=(e,l)=>{e&&e.children&&(-1===t||l<t)&&(r.push(e.value),e.children.forEach((e=>i(e,l+1))))};return e.length>0&&e.forEach((e=>{i(e,0)})),r}var w=r(9679);function N(e){let{activeFilterField:t,checkedFilterFields:r}=e;return(0,w.o)(t?[t]:r)}var T=r(20194);function I(e){let{activeFilterField:t,checkedFilterFields:r}=e;if(t)return(0,T._)(t).chartId;if(r.length){const{chartId:e}=(0,T._)(r[0]);return r.some((t=>(0,T._)(t).chartId!==e))?null:e}return null}function _(e){let{checkedFilterFields:t=[],activeFilterField:r,filterScopeMap:i={},layout:l={}}=e;const a=N({checkedFilterFields:t,activeFilterField:r}),n=r?[r]:t,o=k({components:l,filterFields:n,selectedChartId:I({checkedFilterFields:t,activeFilterField:r})}),s=new Set;n.forEach((e=>{(i[e].checked||[]).forEach((t=>{s.add(`${t}:${e}`)}))}));const d=[...s],c=i[a]?i[a].expanded:$(o,1);return{[a]:{nodes:o,nodesFiltered:[...o],checked:d,expanded:c}}}var O=r(94654),j=r.n(O),E=r(83927),R=r.n(E),U=r(58809),q=r.n(U),M=r(8816),A=r.n(M);function D(e){let{tabScopes:t,parentNodeValue:r,forceAggregate:i=!1,hasChartSiblings:l=!1,tabChildren:a=[],immuneChartSiblings:n=[]}=e;if(i||!l&&Object.entries(t).every((e=>{let[t,{scope:r}]=e;return r&&r.length&&t===r[0]}))){const e=function(e){let{tabs:t=[],tabsInScope:r=[]}=e;const i=[];return t.forEach((e=>{let{value:t,children:l}=e;l&&!h()(r).call(r,t)&&l.forEach((e=>{let{value:t,children:l}=e;l&&!h()(r).call(r,t)&&i.push(...l.filter((e=>{let{type:t}=e;return t===Z.dW})))}))})),i.map((e=>{let{value:t}=e;return t}))}({tabs:a,tabsInScope:j()(t,(e=>{let{scope:t}=e;return t}))}),i=j()(Object.values(t),(e=>{let{immune:t}=e;return t}));return{scope:[r],immune:[...new Set([...e,...i])]}}const o=Object.values(t).filter((e=>{let{scope:t}=e;return t&&t.length}));return{scope:j()(o,(e=>{let{scope:t}=e;return t})),immune:o.length?j()(o,(e=>{let{immune:t}=e;return t})):j()(Object.values(t),(e=>{let{immune:t}=e;return t})).concat(n)}}function J(e){let{currentNode:t={},filterId:r,checkedChartIds:i=[]}=e;if(!t)return{};const{value:l,children:a}=t,n=a.filter((e=>{let{type:t}=e;return t===Z.dW})),o=a.filter((e=>{let{type:t}=e;return t===Z.gn})),s=n.filter((e=>{let{value:t}=e;return r!==t&&!h()(i).call(i,t)})).map((e=>{let{value:t}=e;return t})),d=A()(q()((e=>e.value)),R()((e=>J({currentNode:e,filterId:r,checkedChartIds:i}))))(o);if(!F()(n)&&n.some((e=>{let{value:t}=e;return h()(i).call(i,t)}))){if(F()(o))return{scope:[l],immune:s};const{scope:e,immune:t}=D({tabScopes:d,parentNodeValue:l,forceAggregate:!0,tabChildren:o});return{scope:e,immune:s.concat(t)}}return o.length?D({tabScopes:d,parentNodeValue:l,hasChartSiblings:!F()(n),tabChildren:o,immuneChartSiblings:s}):{scope:[],immune:s}}function X(e){let{filterKey:t,nodes:r=[],checkedChartIds:i=[]}=e;if(r.length){const{chartId:e}=(0,T._)(t);return J({currentNode:r[0],filterId:e,checkedChartIds:i})}return{}}var z=r(43399),L=r(2275),B=r(28388),K=r.n(B),P=r(70163);const H=(0,l.iK)(P.Z.BarChartOutlined)`
  ${e=>{let{theme:t}=e;return`\n    position: relative;\n    top: ${t.gridUnit-1}px;\n    color: ${t.colors.primary.base};\n    margin-right: ${2*t.gridUnit}px;\n  `}}
`;function G(e){let{currentNode:t={},selectedChartId:r}=e;if(!t)return null;const{label:i,value:l,type:a,children:n}=t;if(n&&n.length){const e=n.map((e=>G({currentNode:e,selectedChartId:r})));return{...t,label:(0,b.tZ)("span",{className:g()(`filter-scope-type ${a.toLowerCase()}`,{"selected-filter":r===l})},a===Z.dW&&(0,b.tZ)(H,null),i),children:e}}return{...t,label:(0,b.tZ)("span",{className:g()(`filter-scope-type ${a.toLowerCase()}`,{"selected-filter":r===l})},i)}}function Y(e){let{nodes:t,selectedChartId:r}=e;return t?t.map((e=>G({currentNode:e,selectedChartId:r}))):[]}var W=r(13842);const V={check:(0,b.tZ)(W.lU,null),uncheck:(0,b.tZ)(W.zq,null),halfCheck:(0,b.tZ)(W.dc,null),expandClose:(0,b.tZ)("span",{className:"rct-icon rct-icon-expand-close"}),expandOpen:(0,b.tZ)("span",{className:"rct-icon rct-icon-expand-open"}),expandAll:(0,b.tZ)("span",{className:"rct-icon rct-icon-expand-all"},(0,v.t)("Expand all")),collapseAll:(0,b.tZ)("span",{className:"rct-icon rct-icon-collapse-all"},(0,v.t)("Collapse all")),parentClose:(0,b.tZ)("span",{className:"rct-icon rct-icon-parent-close"}),parentOpen:(0,b.tZ)("span",{className:"rct-icon rct-icon-parent-open"}),leaf:(0,b.tZ)("span",{className:"rct-icon rct-icon-leaf"})},Q={nodes:u().arrayOf(L.ck).isRequired,checked:u().arrayOf(u().oneOfType([u().number,u().string])).isRequired,expanded:u().arrayOf(u().oneOfType([u().number,u().string])).isRequired,onCheck:u().func.isRequired,onExpand:u().func.isRequired,selectedChartId:u().number},ee=()=>{};function te(e){let{nodes:t=[],checked:r=[],expanded:i=[],onCheck:l,onExpand:a,selectedChartId:n}=e;return(0,b.tZ)(K(),{showExpandAll:!0,expandOnClick:!0,showNodeIcon:!1,nodes:Y({nodes:t,selectedChartId:n}),checked:r,expanded:i,onCheck:l,onExpand:a,onClick:ee,icons:V})}te.propTypes=Q,te.defaultProps={selectedChartId:null};var re=r(49238);const ie={label:u().string.isRequired,isSelected:u().bool.isRequired};function le(e){let{label:t,isSelected:r}=e;return(0,b.tZ)("span",{className:g()("filter-field-item filter-container",{"is-selected":r})},(0,b.tZ)(re.lX,{htmlFor:t},t))}function ae(e){let{nodes:t,activeKey:r}=e;if(!t)return[];const i=t[0],l=i.children.map((e=>({...e,children:e.children.map((e=>{const{label:t,value:i}=e;return{...e,label:(0,b.tZ)(le,{isSelected:i===r,label:t})}}))})));return[{...i,label:(0,b.tZ)("span",{className:"root"},i.label),children:l}]}le.propTypes=ie;const ne={activeKey:u().string,nodes:u().arrayOf(L.ck).isRequired,checked:u().arrayOf(u().oneOfType([u().number,u().string])).isRequired,expanded:u().arrayOf(u().oneOfType([u().number,u().string])).isRequired,onCheck:u().func.isRequired,onExpand:u().func.isRequired,onClick:u().func.isRequired};function oe(e){let{activeKey:t,nodes:r=[],checked:i=[],expanded:l=[],onClick:a,onCheck:n,onExpand:o}=e;return(0,b.tZ)(K(),{showExpandAll:!0,showNodeIcon:!1,expandOnClick:!0,nodes:ae({nodes:r,activeKey:t}),checked:i,expanded:l,onClick:a,onCheck:n,onExpand:o,icons:V})}oe.propTypes=ne,oe.defaultProps={activeKey:null};const se={dashboardFilters:u().objectOf(L.Er).isRequired,layout:u().object.isRequired,updateDashboardFiltersScope:u().func.isRequired,setUnsavedChanges:u().func.isRequired,onCloseModal:u().func.isRequired},de=l.iK.div`
  ${e=>{let{theme:t}=e;return b.iv`
    display: flex;
    flex-direction: column;
    height: 80%;
    margin-right: ${-6*t.gridUnit}px;
    font-size: ${t.typography.sizes.m}px;

    & .nav.nav-tabs {
      border: none;
    }

    & .filter-scope-body {
      flex: 1;
      max-height: calc(100% - ${32*t.gridUnit}px);

      .filter-field-pane,
      .filter-scope-pane {
        overflow-y: auto;
      }
    }

    & .warning-message {
      padding: ${6*t.gridUnit}px;
    }
  `}}
`,ce=l.iK.div`
  ${e=>{let{theme:t}=e;return b.iv`
    &.filter-scope-body {
      flex: 1;
      max-height: calc(100% - ${32*t.gridUnit}px);

      .filter-field-pane,
      .filter-scope-pane {
        overflow-y: auto;
      }
    }
  `}}
`,he=l.iK.div`
  ${e=>{let{theme:t}=e;return b.iv`
    height: ${16*t.gridUnit}px;
    border-bottom: 1px solid ${t.colors.grayscale.light2};
    padding-left: ${6*t.gridUnit}px;
    margin-left: ${-6*t.gridUnit}px;

    h4 {
      margin-top: 0;
    }

    .selected-fields {
      margin: ${3*t.gridUnit}px 0 ${4*t.gridUnit}px;
      visibility: hidden;

      &.multi-edit-mode {
        visibility: visible;
      }

      .selected-scopes {
        padding-left: ${t.gridUnit}px;
      }
    }
  `}}
`,pe=l.iK.div`
  ${e=>{let{theme:t}=e;return b.iv`
    &.filters-scope-selector {
      display: flex;
      flex-direction: row;
      position: relative;
      height: 100%;

      a,
      a:active,
      a:hover {
        color: inherit;
        text-decoration: none;
      }

      .react-checkbox-tree .rct-icon.rct-icon-expand-all,
      .react-checkbox-tree .rct-icon.rct-icon-collapse-all {
        font-family: ${t.typography.families.sansSerif};
        font-size: ${t.typography.sizes.m}px;
        color: ${t.colors.primary.base};

        &::before {
          content: '';
        }

        &:hover {
          text-decoration: underline;
        }

        &:focus {
          outline: none;
        }
      }

      .filter-field-pane {
        position: relative;
        width: 40%;
        padding: ${4*t.gridUnit}px;
        padding-left: 0;
        border-right: 1px solid ${t.colors.grayscale.light2};

        .filter-container label {
          font-weight: ${t.typography.weights.normal};
          margin: 0 0 0 ${4*t.gridUnit}px;
          word-break: break-all;
        }

        .filter-field-item {
          height: ${9*t.gridUnit}px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 ${6*t.gridUnit}px;
          margin-left: ${-6*t.gridUnit}px;

          &.is-selected {
            border: 1px solid ${t.colors.text.label};
            border-radius: ${t.borderRadius}px;
            background-color: ${t.colors.grayscale.light4};
            margin-left: ${-6*t.gridUnit}px;
          }
        }

        .react-checkbox-tree {
          .rct-title .root {
            font-weight: ${t.typography.weights.bold};
          }

          .rct-text {
            height: ${10*t.gridUnit}px;
          }
        }
      }

      .filter-scope-pane {
        position: relative;
        flex: 1;
        padding: ${4*t.gridUnit}px;
        padding-right: ${6*t.gridUnit}px;
      }

      .react-checkbox-tree {
        flex-direction: column;
        color: ${t.colors.grayscale.dark1};
        font-size: ${t.typography.sizes.m}px;

        .filter-scope-type {
          padding: ${2*t.gridUnit}px 0;
          display: flex;
          align-items: center;

          &.chart {
            font-weight: ${t.typography.weights.normal};
          }

          &.selected-filter {
            padding-left: ${7*t.gridUnit}px;
            position: relative;
            color: ${t.colors.text.label};

            &::before {
              content: ' ';
              position: absolute;
              left: 0;
              top: 50%;
              width: ${4*t.gridUnit}px;
              height: ${4*t.gridUnit}px;
              border-radius: ${t.borderRadius}px;
              margin-top: ${-2*t.gridUnit}px;
              box-shadow: inset 0 0 0 2px ${t.colors.grayscale.light2};
              background: ${t.colors.grayscale.light3};
            }
          }

          &.root {
            font-weight: ${t.typography.weights.bold};
          }
        }

        .rct-checkbox {
          svg {
            position: relative;
            top: 3px;
            width: ${4.5*t.gridUnit}px;
          }
        }

        .rct-node-leaf {
          .rct-bare-label {
            &::before {
              padding-left: ${t.gridUnit}px;
            }
          }
        }

        .rct-options {
          text-align: left;
          margin-left: 0;
          margin-bottom: ${2*t.gridUnit}px;
        }

        .rct-text {
          margin: 0;
          display: flex;
        }

        .rct-title {
          display: block;
        }

        // disable style from react-checkbox-trees.css
        .rct-node-clickable:hover,
        .rct-node-clickable:focus,
        label:hover,
        label:active {
          background: none !important;
        }
      }

      .multi-edit-mode {
        &.filter-scope-pane {
          .rct-node.rct-node-leaf .filter-scope-type.filter_box {
            display: none;
          }
        }

        .filter-field-item {
          padding: 0 ${4*t.gridUnit}px 0 ${12*t.gridUnit}px;
          margin-left: ${-12*t.gridUnit}px;

          &.is-selected {
            margin-left: ${-13*t.gridUnit}px;
          }
        }
      }

      .scope-search {
        position: absolute;
        right: ${4*t.gridUnit}px;
        top: ${4*t.gridUnit}px;
        border-radius: ${t.borderRadius}px;
        border: 1px solid ${t.colors.grayscale.light2};
        padding: ${t.gridUnit}px ${2*t.gridUnit}px;
        font-size: ${t.typography.sizes.m}px;
        outline: none;

        &:focus {
          border: 1px solid ${t.colors.primary.base};
        }
      }
    }
  `}}
`,ue=l.iK.div`
  ${e=>{let{theme:t}=e;return`\n    height: ${16*t.gridUnit}px;\n\n    border-top: ${t.gridUnit/4}px solid ${t.colors.primary.light3};\n    padding: ${6*t.gridUnit}px;\n    margin: 0 0 0 ${6*-t.gridUnit}px;\n    text-align: right;\n\n    .btn {\n      margin-right: ${4*t.gridUnit}px;\n\n      &:last-child {\n        margin-right: 0;\n      }\n    }\n  `}}
`;class me extends i.PureComponent{constructor(e){super(e);const{dashboardFilters:t,layout:r}=e;if(Object.keys(t).length>0){const e=function(e){let{dashboardFilters:t={}}=e;const r=Object.values(t).map((e=>{const{chartId:t,filterName:r,columns:i,labels:l}=e,a=Object.keys(i).map((e=>({value:(0,T.w)({chartId:t,column:e}),label:l[e]||e})));return{value:t,label:r,children:a,showCheckbox:!0}}));return[{value:x.dU,type:Z.U0,label:(0,v.t)("All filters"),children:r}]}({dashboardFilters:t}),i=e[0].children;this.allfilterFields=[],i.forEach((e=>{let{children:t}=e;t.forEach((e=>{this.allfilterFields.push(e.value)}))})),this.defaultFilterKey=i[0].children[0].value;const l=Object.values(t).reduce(((e,i)=>{let{chartId:l,columns:a}=i;return{...e,...Object.keys(a).reduce(((e,i)=>{const a=(0,T.w)({chartId:l,column:i}),n=k({components:r,filterFields:[a],selectedChartId:l}),o=$(n,1),s=((0,z.up)({filterScope:t[l].scopes[i]})||[]).filter((e=>e!==l));return{...e,[a]:{nodes:n,nodesFiltered:[...n],checked:s,expanded:o}}}),{})}}),{}),{chartId:a}=(0,T._)(this.defaultFilterKey),n=[],o=this.defaultFilterKey,s=[x.dU].concat(a),d=_({checkedFilterFields:n,activeFilterField:o,filterScopeMap:l,layout:r});this.state={showSelector:!0,activeFilterField:o,searchText:"",filterScopeMap:{...l,...d},filterFieldNodes:e,checkedFilterFields:n,expandedFilterIds:s}}else this.state={showSelector:!1};this.filterNodes=this.filterNodes.bind(this),this.onChangeFilterField=this.onChangeFilterField.bind(this),this.onCheckFilterScope=this.onCheckFilterScope.bind(this),this.onExpandFilterScope=this.onExpandFilterScope.bind(this),this.onSearchInputChange=this.onSearchInputChange.bind(this),this.onCheckFilterField=this.onCheckFilterField.bind(this),this.onExpandFilterField=this.onExpandFilterField.bind(this),this.onClose=this.onClose.bind(this),this.onSave=this.onSave.bind(this)}onCheckFilterScope(e){void 0===e&&(e=[]);const{activeFilterField:t,filterScopeMap:r,checkedFilterFields:i}=this.state,l=N({activeFilterField:t,checkedFilterFields:i}),a=t?[t]:i,n={...r[l],checked:e},o=function(e){let{checked:t=[],filterFields:r=[],filterScopeMap:i={}}=e;const l=t.reduce(((e,t)=>{const[r,i]=t.split(":");return{...e,[i]:(e[i]||[]).concat(parseInt(r,10))}}),{});return r.reduce(((e,t)=>{const{chartId:r}=(0,T._)(t),a=(l[t]||[]).filter((e=>e!==r));return{...e,[t]:{...i[t],checked:a}}}),{})}({checked:e,filterFields:a,filterScopeMap:r});this.setState((()=>({filterScopeMap:{...r,...o,[l]:n}})))}onExpandFilterScope(e){void 0===e&&(e=[]);const{activeFilterField:t,checkedFilterFields:r,filterScopeMap:i}=this.state,l=N({activeFilterField:t,checkedFilterFields:r}),a={...i[l],expanded:e};this.setState((()=>({filterScopeMap:{...i,[l]:a}})))}onCheckFilterField(e){void 0===e&&(e=[]);const{layout:t}=this.props,{filterScopeMap:r}=this.state,i=_({checkedFilterFields:e,activeFilterField:null,filterScopeMap:r,layout:t});this.setState((()=>({activeFilterField:null,checkedFilterFields:e,filterScopeMap:{...r,...i}})))}onExpandFilterField(e){void 0===e&&(e=[]),this.setState((()=>({expandedFilterIds:e})))}onChangeFilterField(e){var t;void 0===e&&(e={});const{layout:r}=this.props,i=e.value,{activeFilterField:l,checkedFilterFields:a,filterScopeMap:n}=this.state;if(i===l){const e=_({checkedFilterFields:a,activeFilterField:null,filterScopeMap:n,layout:r});this.setState({activeFilterField:null,filterScopeMap:{...n,...e}})}else if(h()(t=this.allfilterFields).call(t,i)){const e=_({checkedFilterFields:a,activeFilterField:i,filterScopeMap:n,layout:r});this.setState({activeFilterField:i,filterScopeMap:{...n,...e}})}}onSearchInputChange(e){this.setState({searchText:e.target.value},this.filterTree)}onClose(){this.props.onCloseModal()}onSave(){const{filterScopeMap:e}=this.state,t=this.allfilterFields.reduce(((t,r)=>{const{nodes:i}=e[r];return{...t,[r]:X({filterKey:r,nodes:i,checkedChartIds:e[r].checked})}}),{});this.props.updateDashboardFiltersScope(t),this.props.setUnsavedChanges(!0),this.props.onCloseModal()}filterTree(){if(this.state.searchText){const e=e=>{const{activeFilterField:t,checkedFilterFields:r,filterScopeMap:i}=e,l=N({activeFilterField:t,checkedFilterFields:r}),a=i[l].nodes.reduce(this.filterNodes,[]),n=$([...a]),o={...i[l],nodesFiltered:a,expanded:n};return{filterScopeMap:{...i,[l]:o}}};this.setState(e)}else this.setState((e=>{const{activeFilterField:t,checkedFilterFields:r,filterScopeMap:i}=e,l=N({activeFilterField:t,checkedFilterFields:r}),a={...i[l],nodesFiltered:i[l].nodes};return{filterScopeMap:{...i,[l]:a}}}))}filterNodes(e,t){void 0===e&&(e=[]),void 0===t&&(t={});const{searchText:r}=this.state,i=(t.children||[]).reduce(this.filterNodes,[]);return(t.label.toLocaleLowerCase().indexOf(r.toLocaleLowerCase())>-1||i.length)&&e.push({...t,children:i}),e}renderFilterFieldList(){const{activeFilterField:e,filterFieldNodes:t,checkedFilterFields:r,expandedFilterIds:i}=this.state;return(0,b.tZ)(oe,{activeKey:e,nodes:t,checked:r,expanded:i,onClick:this.onChangeFilterField,onCheck:this.onCheckFilterField,onExpand:this.onExpandFilterField})}renderFilterScopeTree(){const{filterScopeMap:e,activeFilterField:t,checkedFilterFields:r,searchText:l}=this.state,a=N({activeFilterField:t,checkedFilterFields:r}),n=I({activeFilterField:t,checkedFilterFields:r});return(0,b.tZ)(i.Fragment,null,(0,b.tZ)("input",{className:"filter-text scope-search multi-edit-mode",placeholder:(0,v.t)("Search..."),type:"text",value:l,onChange:this.onSearchInputChange}),(0,b.tZ)(te,{nodes:e[a].nodesFiltered,checked:e[a].checked,expanded:e[a].expanded,onCheck:this.onCheckFilterScope,onExpand:this.onExpandFilterScope,selectedChartId:n}))}renderEditingFiltersName(){const{dashboardFilters:e}=this.props,{activeFilterField:t,checkedFilterFields:r}=this.state,i=[].concat(t||r).map((t=>{const{chartId:r,column:i}=(0,T._)(t);return e[r].labels[i]||i}));return(0,b.tZ)("div",{className:"selected-fields multi-edit-mode"},0===i.length&&(0,v.t)("No filter is selected."),1===i.length&&(0,v.t)("Editing 1 filter:"),i.length>1&&(0,v.t)("Batch editing %d filters:",i.length),(0,b.tZ)("span",{className:"selected-scopes"},i.join(", ")))}render(){const{showSelector:e}=this.state;return(0,b.tZ)(de,null,(0,b.tZ)(he,null,(0,b.tZ)("h4",null,(0,v.t)("Configure filter scopes")),e&&this.renderEditingFiltersName()),(0,b.tZ)(ce,{className:"filter-scope-body"},e?(0,b.tZ)(pe,{className:"filters-scope-selector"},(0,b.tZ)("div",{className:g()("filter-field-pane multi-edit-mode")},this.renderFilterFieldList()),(0,b.tZ)("div",{className:"filter-scope-pane multi-edit-mode"},this.renderFilterScopeTree())):(0,b.tZ)("div",{className:"warning-message"},(0,v.t)("There are no filters in this dashboard."))),(0,b.tZ)(ue,null,(0,b.tZ)(f.Z,{buttonSize:"small",onClick:this.onClose},(0,v.t)("Close")),e&&(0,b.tZ)(f.Z,{buttonSize:"small",buttonStyle:"primary",onClick:this.onSave},(0,v.t)("Save"))))}}me.propTypes=se;const ge=(0,n.$j)((function(e){let{dashboardLayout:t,dashboardFilters:r}=e;return{dashboardFilters:r,layout:t.present}}),(function(e){return(0,o.DE)({updateDashboardFiltersScope:s.l6,setUnsavedChanges:d.if},e)}))(me),fe=l.iK.div((e=>{let{theme:{gridUnit:t}}=e;return{padding:2*t,paddingBottom:3*t}}));class be extends i.PureComponent{constructor(e){super(e),this.modal=void 0,this.modal=i.createRef(),this.handleCloseModal=this.handleCloseModal.bind(this)}handleCloseModal(){var e,t;null==this||null==(e=this.modal)||null==(t=e.current)||null==t.close||t.close()}render(){const e={onCloseModal:this.handleCloseModal};return(0,b.tZ)(a.Z,{ref:this.modal,triggerNode:this.props.triggerNode,modalBody:(0,b.tZ)(fe,null,(0,b.tZ)(ge,e)),width:"80%"})}}},713:(e,t,r)=>{r.d(t,{Z:()=>a});var i=r(55867),l=r(80621);const a=[{value:l.HE,label:(0,i.t)("Transparent"),className:"background--transparent"},{value:l.b5,label:(0,i.t)("White"),className:"background--white"}]},79271:(e,t,r)=>{r.d(t,{Z:()=>a});var i=r(55867),l=r(80621);const a=[{value:l.u_,label:(0,i.t)("Small"),className:"header-style-option header-small"},{value:l.OE,label:(0,i.t)("Medium"),className:"header-style-option header-medium"},{value:l.pQ,label:(0,i.t)("Large"),className:"header-style-option header-large"}]},33626:(e,t,r)=>{r.d(t,{J:()=>l});var i=r(67294);const l=e=>{(0,i.useEffect)(e,[])}},85605:(e,t,r)=>{r.d(t,{g:()=>d,$3:()=>p,OY:()=>u,Qz:()=>m,_U:()=>g,Y4:()=>f});var i=r(78580),l=r.n(i),a=r(31069),n=r(15926),o=r.n(n);const s=Object.freeze(["dashboard","chart","saved_query"]),d=Object.freeze({DASHBOARD:"dashboard",CHART:"chart",QUERY:"saved_query"}),c={saved_query:1,chart:2,dashboard:3},h=e=>{if(!l()(s).call(s,e))throw new Error(`objectType ${e} is invalid`);return c[e]};function p(e,t,r){let{objectType:i,objectId:n,includeTypes:o=!1}=e;if(void 0===i||void 0===n)throw new Error("Need to specify objectType and objectId");if(!l()(s).call(s,i))throw new Error(`objectType ${i} is invalid`);a.Z.get({endpoint:`/api/v1/${i}/${n}`}).then((e=>{let{json:r}=e;return t(r.result.tags.filter((e=>-1===e.name.indexOf(":")||o)))})).catch((e=>r(e)))}function u(e,t,r,i){let{objectType:n,objectId:o}=e;if(void 0===n||void 0===o)throw new Error("Need to specify objectType and objectId");if(!l()(s).call(s,n))throw new Error(`objectType ${n} is invalid`);a.Z.delete({endpoint:`/api/v1/tag/${h(n)}/${o}/${t.name}`}).then((e=>{let{json:t}=e;return r(t?JSON.stringify(t):"Successfully Deleted Tagged Objects")})).catch((e=>{const t=e.message;return i(t||"Error Deleting Tagged Objects")}))}function m(e,t,r){const i=e.map((e=>e.name));a.Z.delete({endpoint:`/api/v1/tag/?q=${o().encode(i)}`}).then((e=>{let{json:r}=e;return r.message?t(r.message):t("Successfully Deleted Tag")})).catch((e=>{const t=e.message;return r(t||"Error Deleting Tag")}))}function g(e,t,r,i){let{objectType:l,objectId:n,includeTypes:o=!1}=e;if(void 0===l||void 0===n)throw new Error("Need to specify objectType and objectId");if(-1!==t.indexOf(":")&&!o)return;const s=h(l);a.Z.post({endpoint:`/api/v1/tag/${s}/${n}/`,body:JSON.stringify({properties:{tags:[t]}}),parseMethod:"json",headers:{"Content-Type":"application/json"}}).then((e=>{let{json:t}=e;return r(JSON.stringify(t))})).catch((e=>i(e)))}function f(e,t,r){let{tags:i="",types:l}=e,n=`/api/v1/tag/get_objects/?tags=${i}`;l&&(n+=`&types=${l}`),a.Z.get({endpoint:n}).then((e=>{let{json:r}=e;return t(r.result)})).catch((e=>r(e)))}},65108:(e,t,r)=>{r.d(t,{g:()=>i});const i=function(e,t,r){return void 0===r&&(r=function(){for(var e=arguments.length,t=new Array(e),r=0;r<e;r++)t[r]=arguments[r];return JSON.stringify([...t])}),function(){const i=r(...arguments);if(t.has(i))return t.get(i);const l=e(...arguments);return t.set(i,l),l}}}}]);
//# sourceMappingURL=4717.0bcbff030e6e0fdc3a17.entry.js.map