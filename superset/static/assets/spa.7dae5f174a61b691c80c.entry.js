(()=>{var e,t,a,n,r,i,l,o,d={80760:(e,t,a)=>{var n=a(89881);e.exports=function(e,t){var a=[];return n(e,(function(e,n,r){t(e,n,r)&&a.push(e)})),a}},63105:(e,t,a)=>{var n=a(34963),r=a(80760),i=a(67206),l=a(1469);e.exports=function(e,t){return(l(e)?n:r)(e,i(t,3))}},43063:(e,t,a)=>{var n=a(34963),r=a(80760),i=a(67206),l=a(1469),o=a(94885);e.exports=function(e,t){return(l(e)?n:r)(e,o(i(t,3)))}},19259:(e,t,a)=>{"use strict";a.d(t,{Z:()=>l});var n=a(67294),r=a(17198),i=a(11965);function l(e){let{title:t,description:a,onConfirm:l,children:o}=e;const[d,s]=(0,n.useState)(!1),[c,u]=(0,n.useState)([]),b=()=>{s(!1),u([])};return(0,i.tZ)(n.Fragment,null,null==o?void 0:o((function(){for(var e=arguments.length,t=new Array(e),a=0;a<e;a++)t[a]=arguments[a];t.forEach((e=>{e&&("function"==typeof e.persist&&e.persist(),"function"==typeof e.preventDefault&&e.preventDefault(),"function"==typeof e.stopPropagation&&e.stopPropagation())})),s(!0),u(t)})),(0,i.tZ)(r.Z,{description:a,onConfirm:()=>{l(...c),b()},onHide:b,open:d,title:t}))}},21742:(e,t,a)=>{"use strict";a.d(t,{Z:()=>_});var n=a(11965),r=a(67294),i=a(51995),l=a(4715),o=a(58593),d=a(4144),s=a(79789);const c=i.iK.div`
  width: 64px;
  display: flex;
  justify-content: flex-end;
`,u=(0,i.iK)(l.Ak)`
  ${e=>{let{theme:t}=e;return`\n    border: 1px solid ${t.colors.grayscale.light2};\n    border-radius: ${t.gridUnit}px;\n    overflow: hidden;\n\n    .ant-card-body {\n      padding: ${4*t.gridUnit}px\n        ${2*t.gridUnit}px;\n    }\n    .ant-card-meta-detail > div:not(:last-child) {\n      margin-bottom: 0;\n    }\n    .gradient-container {\n      position: relative;\n      height: 100%;\n    }\n    &:hover {\n      box-shadow: 8px 8px 28px 0px ${t.colors.grayscale.light1};\n      transition: box-shadow ${t.transitionTiming}s ease-in-out;\n\n      .cover-footer {\n        transform: translateY(0);\n      }\n    }\n  `}}
`,b=i.iK.div`
  height: 264px;
  border-bottom: 1px solid ${e=>{let{theme:t}=e;return t.colors.grayscale.light2}};
  overflow: hidden;

  .cover-footer {
    transform: translateY(${e=>{let{theme:t}=e;return 9*t.gridUnit}}px);
    transition: ${e=>{let{theme:t}=e;return t.transitionTiming}}s ease-out;
  }
`,h=i.iK.div`
  display: flex;
  justify-content: flex-start;
  flex-direction: column;

  .card-actions {
    margin-left: auto;
    align-self: flex-end;
    padding-left: ${e=>{let{theme:t}=e;return t.gridUnit}}px;
    span[role='img'] {
      display: flex;
      align-items: center;
    }
  }

  .titleRow {
    display: flex;
    justify-content: flex-start;
    flex-direction: row;
  }
`,f=i.iK.span`
  overflow: hidden;
  text-overflow: ellipsis;
  & a {
    color: ${e=>{let{theme:t}=e;return t.colors.grayscale.dark1}} !important;
  }
`,m=i.iK.span`
  position: absolute;
  right: -1px;
  bottom: ${e=>{let{theme:t}=e;return t.gridUnit}}px;
`,p=i.iK.div`
  display: flex;
  flex-wrap: nowrap;
  position: relative;
  top: -${e=>{let{theme:t}=e;return 9*t.gridUnit}}px;
  padding: 0 8px;
`,g=i.iK.div`
  flex: 1;
  overflow: hidden;
`,v=i.iK.div`
  align-self: flex-end;
  margin-left: auto;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
`,Z=(0,i.iK)(l.Od)`
  h3 {
    margin: ${e=>{let{theme:t}=e;return t.gridUnit}}px 0;
  }

  ul {
    margin-bottom: 0;
  }
`,y={rows:1,width:150},w=e=>{let{to:t,children:a}=e;return(0,n.tZ)("a",{href:t},a)};function C(e){let{title:t,subtitle:a,url:c,linkComponent:C,titleRight:_,imgURL:x,imgFallbackURL:k,description:S,coverLeft:F,coverRight:T,actions:$,avatar:E,loading:I,imgPosition:N="top",cover:O,certifiedBy:P,certificationDetails:U}=e;const D=c&&C?C:w,z=(0,i.Fg)();return(0,n.tZ)(u,{cover:O||(0,n.tZ)(b,null,(0,n.tZ)(D,{to:c},(0,n.tZ)("div",{className:"gradient-container"},(0,n.tZ)(d.Z,{src:x||"",fallback:k||"",isLoading:I,position:N}))),(0,n.tZ)(p,{className:"cover-footer"},!I&&F&&(0,n.tZ)(g,null,F),!I&&T&&(0,n.tZ)(v,null,T)))},I&&(0,n.tZ)(l.Ak.Meta,{title:(0,n.tZ)(r.Fragment,null,(0,n.tZ)(h,null,(0,n.tZ)(l.Od.Input,{active:!0,size:"small",css:(0,n.iv)({width:Math.trunc(62.5*z.gridUnit)},"","")}),(0,n.tZ)("div",{className:"card-actions"},(0,n.tZ)(l.Od.Button,{active:!0,shape:"circle"})," ",(0,n.tZ)(l.Od.Button,{active:!0,css:(0,n.iv)({width:10*z.gridUnit},"","")})))),description:(0,n.tZ)(Z,{round:!0,active:!0,title:!1,paragraph:y})}),!I&&(0,n.tZ)(l.Ak.Meta,{title:(0,n.tZ)(h,null,a||null,(0,n.tZ)("div",{className:"titleRow"},(0,n.tZ)(o.u,{title:t},(0,n.tZ)(f,null,P&&(0,n.tZ)(r.Fragment,null,(0,n.tZ)(s.Z,{certifiedBy:P,details:U})," "),t)),_&&(0,n.tZ)(m,null,_),(0,n.tZ)("div",{className:"card-actions"},$))),description:S,avatar:E||null}))}C.Actions=c;const _=C},83673:(e,t,a)=>{"use strict";a.d(t,{Z:()=>_});var n=a(67294),r=a(74069),i=a(9875),l=a(35932),o=a(4715),d=a(15926),s=a.n(d),c=a(51995),u=a(55867),b=a(31069),h=a(93185),f=a(98286),m=a(14114),p=a(60718),g=a(85605),v=a(11965);const Z=o.qz.Item,y=(0,c.iK)(o.qz.Item)`
  margin-bottom: 0;
`,w=c.iK.span`
  margin-bottom: 0;
`;var C={name:"1blj7km",styles:"margin-top:1em"};const _=(0,m.ZP)((function(e){let{slice:t,onHide:a,onSave:d,show:c,addSuccessToast:m}=e;const[_,x]=(0,n.useState)(!1),[k]=o.qz.useForm(),[S,F]=(0,n.useState)(t.slice_name||""),[T,$]=(0,n.useState)(null),[E,I]=(0,n.useState)([]),N=(0,n.useMemo)((()=>E.map((e=>({value:e.name,label:e.name,key:e.name})))),[E.length]);function O(e){let{error:t,statusText:a,message:n}=e,i=t||a||(0,u.t)("An error has occurred");"Forbidden"===n&&(i=(0,u.t)("You do not have permission to edit this chart")),r.Z.error({title:(0,u.t)("Error"),content:i,okButtonProps:{danger:!0,className:"btn-danger"}})}const P=(0,n.useCallback)((async function(){try{var e;const a=(await b.Z.get({endpoint:`/api/v1/chart/${t.slice_id}`})).json.result;$(null==a||null==(e=a.owners)?void 0:e.map((e=>({value:e.id,label:`${e.first_name} ${e.last_name}`}))))}catch(e){O(await(0,f.O$)(e))}}),[t.slice_id]),U=(0,n.useMemo)((()=>function(e,t,a){void 0===e&&(e="");const n=s().encode({filter:e,page:t,page_size:a});return b.Z.get({endpoint:`/api/v1/chart/related/owners?q=${n}`}).then((e=>({data:e.json.result.filter((e=>e.extra.active)).map((e=>({value:e.value,label:e.text}))),totalCount:e.json.count})))}),[]),D=(0,u.t)("Owners");return(0,n.useEffect)((()=>{P()}),[P]),(0,n.useEffect)((()=>{F(t.slice_name||"")}),[t.slice_name]),(0,n.useEffect)((()=>{if((0,h.c)(h.T.TAGGING_SYSTEM))try{(0,g.$3)({objectType:g.g.CHART,objectId:t.slice_id,includeTypes:!1},(e=>I(e)),(e=>{O(e)}))}catch(e){O(e)}}),[t.slice_id]),(0,v.tZ)(r.Z,{show:c,onHide:a,title:(0,u.t)("Edit Chart Properties"),footer:(0,v.tZ)(n.Fragment,null,(0,v.tZ)(l.Z,{htmlType:"button",buttonSize:"small",onClick:a,cta:!0},(0,u.t)("Cancel")),(0,v.tZ)(l.Z,{htmlType:"submit",buttonSize:"small",buttonStyle:"primary",onClick:k.submit,disabled:_||!S||t.is_managed_externally,tooltip:t.is_managed_externally?(0,u.t)("This chart is managed externally, and can't be edited in Superset"):"",cta:!0},(0,u.t)("Save"))),responsive:!0,wrapProps:{"data-test":"properties-edit-modal"}},(0,v.tZ)(o.qz,{form:k,onFinish:async e=>{x(!0);const{certified_by:n,certification_details:r,description:i,cache_timeout:l}=e,o={slice_name:S||null,description:i||null,cache_timeout:l||null,certified_by:n||null,certification_details:n&&r?r:null};if(T&&(o.owners=T.map((e=>e.value))),(0,h.c)(h.T.TAGGING_SYSTEM))try{(0,g.$3)({objectType:g.g.CHART,objectId:t.slice_id,includeTypes:!1},(e=>{return a=e,(n=E).map((e=>{a.some((t=>t.name===e.name))||(0,g._U)({objectType:g.g.CHART,objectId:t.slice_id,includeTypes:!1},e.name,(()=>{}),(()=>{}))})),void a.map((e=>{n.some((t=>t.name===e.name))||(0,g.OY)({objectType:g.g.CHART,objectId:t.slice_id},e,(()=>{}),(()=>{}))}));var a,n}),(e=>{O(e)}))}catch(e){O(e)}try{const e=await b.Z.put({endpoint:`/api/v1/chart/${t.slice_id}`,headers:{"Content-Type":"application/json"},body:JSON.stringify(o)}),n={...o,...e.json.result,tags:E,id:t.slice_id,owners:T};d(n),m((0,u.t)("Chart properties updated")),a()}catch(e){O(await(0,f.O$)(e))}x(!1)},layout:"vertical",initialValues:{name:t.slice_name||"",description:t.description||"",cache_timeout:null!=t.cache_timeout?t.cache_timeout:"",certified_by:t.certified_by||"",certification_details:t.certified_by&&t.certification_details?t.certification_details:""}},(0,v.tZ)(o.X2,{gutter:16},(0,v.tZ)(o.JX,{xs:24,md:12},(0,v.tZ)("h3",null,(0,u.t)("Basic information")),(0,v.tZ)(Z,{label:(0,u.t)("Name"),required:!0},(0,v.tZ)(i.II,{"aria-label":(0,u.t)("Name"),name:"name",type:"text",value:S,onChange:e=>{var t;return F(null!=(t=e.target.value)?t:"")}})),(0,v.tZ)(Z,null,(0,v.tZ)(y,{label:(0,u.t)("Description"),name:"description"},(0,v.tZ)(i.Kx,{rows:3,style:{maxWidth:"100%"}})),(0,v.tZ)(w,{className:"help-block"},(0,u.t)("The description can be displayed as widget headers in the dashboard view. Supports markdown."))),(0,v.tZ)("h3",null,(0,u.t)("Certification")),(0,v.tZ)(Z,null,(0,v.tZ)(y,{label:(0,u.t)("Certified by"),name:"certified_by"},(0,v.tZ)(i.II,{"aria-label":(0,u.t)("Certified by")})),(0,v.tZ)(w,{className:"help-block"},(0,u.t)("Person or group that has certified this chart."))),(0,v.tZ)(Z,null,(0,v.tZ)(y,{label:(0,u.t)("Certification details"),name:"certification_details"},(0,v.tZ)(i.II,{"aria-label":(0,u.t)("Certification details")})),(0,v.tZ)(w,{className:"help-block"},(0,u.t)("Any additional detail to show in the certification tooltip.")))),(0,v.tZ)(o.JX,{xs:24,md:12},(0,v.tZ)("h3",null,(0,u.t)("Configuration")),(0,v.tZ)(Z,null,(0,v.tZ)(y,{label:(0,u.t)("Cache timeout"),name:"cache_timeout"},(0,v.tZ)(i.II,{"aria-label":"Cache timeout"})),(0,v.tZ)(w,{className:"help-block"},(0,u.t)("Duration (in seconds) of the caching timeout for this chart. Note this defaults to the dataset's timeout if undefined."))),(0,v.tZ)("h3",{style:{marginTop:"1em"}},(0,u.t)("Access")),(0,v.tZ)(Z,{label:D},(0,v.tZ)(o.qb,{ariaLabel:D,mode:"multiple",name:"owners",value:T||[],onChange:$,options:U,disabled:!T,allowClear:!0}),(0,v.tZ)(w,{className:"help-block"},(0,u.t)("A list of users who can alter the chart. Searchable by name or username."))),(0,h.c)(h.T.TAGGING_SYSTEM)&&(0,v.tZ)("h3",{css:C},(0,u.t)("Tags")),(0,h.c)(h.T.TAGGING_SYSTEM)&&(0,v.tZ)(Z,null,(0,v.tZ)(o.qb,{ariaLabel:"Tags",mode:"multiple",allowNewOptions:!0,value:N,options:p.m,onChange:e=>{const t=[...new Set(e.map((e=>e.label)))];I([...t.map((e=>({name:e})))])},onClear:()=>{I([])},allowClear:!0}),(0,v.tZ)(w,{className:"help-block"},(0,u.t)("A list of tags that have been applied to this chart.")))))))}))},94394:(e,t,a)=>{"use strict";a.d(t,{Z:()=>y});var n=a(67294),r=a(51995),i=a(55867),l=a(16550),o=a(73727),d=a(91877),s=a(93185),c=a(19259),u=a(70163),b=a(21742),h=a(37921),f=a(4715),m=a(83862),p=a(36674),g=a(34581),v=a(40768),Z=a(11965);function y(e){let{chart:t,hasPerm:a,openChartEditModal:y,bulkSelectEnabled:w,addDangerToast:C,addSuccessToast:_,refreshData:x,loading:k,showThumbnails:S,saveFavoriteStatus:F,favoriteStatus:T,chartFilter:$,userId:E,handleBulkChartExport:I}=e;const N=(0,l.k6)(),O=a("can_write"),P=a("can_write"),U=a("can_export")&&(0,d.cr)(s.T.VERSIONED_EXPORT),D=(0,r.Fg)(),z=(0,Z.tZ)(m.v,null,P&&(0,Z.tZ)(m.v.Item,null,(0,Z.tZ)(c.Z,{title:(0,i.t)("Please confirm"),description:(0,Z.tZ)(n.Fragment,null,(0,i.t)("Are you sure you want to delete")," ",(0,Z.tZ)("b",null,t.slice_name),"?"),onConfirm:()=>(0,v.Gm)(t,_,C,x,$,E)},(e=>(0,Z.tZ)("div",{role:"button",tabIndex:0,className:"action-button",onClick:e},(0,Z.tZ)(u.Z.Trash,{iconSize:"l"})," ",(0,i.t)("Delete"))))),U&&(0,Z.tZ)(m.v.Item,null,(0,Z.tZ)("div",{role:"button",tabIndex:0,onClick:()=>I([t])},(0,Z.tZ)(u.Z.Share,{iconSize:"l"})," ",(0,i.t)("Export"))),O&&(0,Z.tZ)(m.v.Item,null,(0,Z.tZ)("div",{role:"button",tabIndex:0,onClick:()=>y(t)},(0,Z.tZ)(u.Z.EditAlt,{iconSize:"l"})," ",(0,i.t)("Edit"))));return(0,Z.tZ)(v.ZB,{onClick:()=>{!w&&t.url&&N.push(t.url)}},(0,Z.tZ)(b.Z,{loading:k,title:t.slice_name,certifiedBy:t.certified_by,certificationDetails:t.certification_details,cover:(0,d.cr)(s.T.THUMBNAILS)&&S?null:(0,Z.tZ)(n.Fragment,null),url:w?void 0:t.url,imgURL:t.thumbnail_url||"",imgFallbackURL:"/static/assets/images/chart-card-fallback.svg",description:(0,i.t)("Modified %s",t.changed_on_delta_humanized),coverLeft:(0,Z.tZ)(g.Z,{users:t.owners||[]}),coverRight:(0,Z.tZ)(h.Z,{type:"secondary"},t.datasource_name_text),linkComponent:o.rU,actions:(0,Z.tZ)(b.Z.Actions,{onClick:e=>{e.stopPropagation(),e.preventDefault()}},E&&(0,Z.tZ)(p.Z,{itemId:t.id,saveFaveStar:F,isStarred:T}),(0,Z.tZ)(f.Gj,{overlay:z},(0,Z.tZ)(u.Z.MoreVert,{iconColor:D.colors.grayscale.base})))}))}},32228:(e,t,a)=>{"use strict";a.d(t,{Z:()=>d});var n=a(89816),r=a(15926),i=a.n(r),l=a(14670),o=a.n(l);function d(e,t,a,r){void 0===r&&(r=200);const l=o().generate(),d=`/api/v1/${e}/export/?q=${i().encode(t)}&token=${l}`,s=document.createElement("iframe");s.style.display="none",s.src=d,document.body.appendChild(s);const c=window.setInterval((()=>{"done"===(0,n.Z)()[l]&&(window.clearInterval(c),document.body.removeChild(s),a())}),r)}},99415:(e,t,a)=>{"use strict";a.d(t,{Z:()=>Z});var n=a(67294),r=a(16550),i=a(73727),l=a(51995),o=a(55867),d=a(40768),s=a(91877),c=a(93185),u=a(4715),b=a(83862),h=a(21742),f=a(70163),m=a(37921),p=a(34581),g=a(36674),v=a(11965);const Z=function(e){let{dashboard:t,hasPerm:a,bulkSelectEnabled:Z,userId:y,openDashboardEditModal:w,favoriteStatus:C,saveFavoriteStatus:_,showThumbnails:x,handleBulkDashboardExport:k,onDelete:S}=e;const F=(0,r.k6)(),T=a("can_write"),$=a("can_write"),E=a("can_export"),I=(0,l.Fg)(),N=(0,v.tZ)(b.v,null,T&&w&&(0,v.tZ)(b.v.Item,null,(0,v.tZ)("div",{role:"button",tabIndex:0,className:"action-button",onClick:()=>null==w?void 0:w(t)},(0,v.tZ)(f.Z.EditAlt,{iconSize:"l"})," ",(0,o.t)("Edit"))),E&&(0,v.tZ)(b.v.Item,null,(0,v.tZ)("div",{role:"button",tabIndex:0,onClick:()=>k([t]),className:"action-button"},(0,v.tZ)(f.Z.Share,{iconSize:"l"})," ",(0,o.t)("Export"))),$&&(0,v.tZ)(b.v.Item,null,(0,v.tZ)("div",{role:"button",tabIndex:0,className:"action-button",onClick:()=>S(t)},(0,v.tZ)(f.Z.Trash,{iconSize:"l"})," ",(0,o.t)("Delete"))));return(0,v.tZ)(d.ZB,{onClick:()=>{Z||F.push(t.url)}},(0,v.tZ)(h.Z,{loading:t.loading||!1,title:t.dashboard_title,certifiedBy:t.certified_by,certificationDetails:t.certification_details,titleRight:(0,v.tZ)(m.Z,null,t.published?(0,o.t)("published"):(0,o.t)("draft")),cover:(0,s.cr)(c.T.THUMBNAILS)&&x?null:(0,v.tZ)(n.Fragment,null),url:Z?void 0:t.url,linkComponent:i.rU,imgURL:t.thumbnail_url,imgFallbackURL:"/static/assets/images/dashboard-card-fallback.svg",description:(0,o.t)("Modified %s",t.changed_on_delta_humanized),coverLeft:(0,v.tZ)(p.Z,{users:t.owners||[]}),actions:(0,v.tZ)(h.Z.Actions,{onClick:e=>{e.stopPropagation(),e.preventDefault()}},y&&(0,v.tZ)(g.Z,{itemId:t.id,saveFaveStar:_,isStarred:C}),(0,v.tZ)(u.Gj,{overlay:N},(0,v.tZ)(f.Z.MoreVert,{iconColor:I.colors.grayscale.base})))}))}},20755:(e,t,a)=>{"use strict";a.d(t,{Z:()=>w});var n=a(23279),r=a.n(n),i=a(67294),l=a(16550),o=a(73727),d=a(51995),s=a(11965),c=a(55867),u=a(94184),b=a.n(u),h=a(58593),f=a(4715),m=a(83862),p=a(35932),g=a(70163);const v=d.iK.div`
  margin-bottom: ${e=>{let{theme:t}=e;return 4*t.gridUnit}}px;
  .header {
    font-weight: ${e=>{let{theme:t}=e;return t.typography.weights.bold}};
    margin-right: ${e=>{let{theme:t}=e;return 3*t.gridUnit}}px;
    text-align: left;
    font-size: 18px;
    padding: ${e=>{let{theme:t}=e;return 3*t.gridUnit}}px;
    display: inline-block;
    line-height: ${e=>{let{theme:t}=e;return 9*t.gridUnit}}px;
  }
  .nav-right {
    display: flex;
    align-items: center;
    padding: ${e=>{let{theme:t}=e;return 3.5*t.gridUnit}}px 0;
    margin-right: ${e=>{let{theme:t}=e;return 3*t.gridUnit}}px;
    float: right;
    position: absolute;
    right: 0;
    ul.ant-menu-root {
      padding: 0px;
    }
    li[role='menuitem'] {
      border: 0;
      border-bottom: none;
      &:hover {
        border-bottom: transparent;
      }
    }
  }
  .nav-right-collapse {
    display: flex;
    align-items: center;
    padding: 14px 0;
    margin-right: 0;
    float: left;
    padding-left: 10px;
  }
  .menu {
    background-color: ${e=>{let{theme:t}=e;return t.colors.grayscale.light5}};
    .ant-menu-horizontal {
      line-height: inherit;
      .ant-menu-item {
        border-bottom: none;
        &:hover {
          border-bottom: none;
          text-decoration: none;
        }
      }
    }
    .ant-menu {
      padding: ${e=>{let{theme:t}=e;return 4*t.gridUnit}}px 0px;
    }
  }

  .ant-menu-horizontal:not(.ant-menu-dark) > .ant-menu-item {
    margin: 0 ${e=>{let{theme:t}=e;return t.gridUnit+1}}px;
  }

  .menu .ant-menu-item {
    li,
    div {
      a,
      div {
        font-size: ${e=>{let{theme:t}=e;return t.typography.sizes.s}}px;
        color: ${e=>{let{theme:t}=e;return t.colors.secondary.dark1}};

        a {
          margin: 0;
          padding: ${e=>{let{theme:t}=e;return 2*t.gridUnit}}px
            ${e=>{let{theme:t}=e;return 4*t.gridUnit}}px;
          line-height: ${e=>{let{theme:t}=e;return 5*t.gridUnit}}px;

          &:hover {
            text-decoration: none;
          }
        }
      }

      &.no-router a {
        padding: ${e=>{let{theme:t}=e;return 2*t.gridUnit}}px
          ${e=>{let{theme:t}=e;return 4*t.gridUnit}}px;
      }

      &.active a {
        background: ${e=>{let{theme:t}=e;return t.colors.secondary.light4}};
        border-radius: ${e=>{let{theme:t}=e;return t.borderRadius}}px;
      }
    }

    li.active > a,
    li.active > div,
    div.active > div,
    li > a:hover,
    li > a:focus,
    li > div:hover,
    div > div:hover,
    div > a:hover {
      background: ${e=>{let{theme:t}=e;return t.colors.secondary.light4}};
      border-bottom: none;
      border-radius: ${e=>{let{theme:t}=e;return t.borderRadius}}px;
      margin-bottom: ${e=>{let{theme:t}=e;return 2*t.gridUnit}}px;
      text-decoration: none;
    }
  }

  .btn-link {
    padding: 10px 0;
  }
  .ant-menu-horizontal {
    border: none;
  }
  @media (max-width: 767px) {
    .header,
    .nav-right {
      position: relative;
      margin-left: ${e=>{let{theme:t}=e;return 2*t.gridUnit}}px;
    }
  }
  .ant-menu-submenu {
    span[role='img'] {
      position: absolute;
      right: ${e=>{let{theme:t}=e;return-t.gridUnit-2}}px;
      top: ${e=>{let{theme:t}=e;return t.gridUnit+1}}px !important;
    }
  }
  .dropdown-menu-links > div.ant-menu-submenu-title,
  .ant-menu-submenu-open.ant-menu-submenu-active > div.ant-menu-submenu-title {
    color: ${e=>{let{theme:t}=e;return t.colors.primary.dark1}};
  }
`,Z=e=>s.iv`
  color: ${e.colors.grayscale.base};
  backgroundColor: ${e.colors.grayscale.light2}};

  .ant-menu-item:hover {
    color: ${e.colors.grayscale.base};
    cursor: default;
  }
`,{SubMenu:y}=m.$,w=e=>{var t,a,n;const[d,u]=(0,i.useState)("horizontal"),[w,C]=(0,i.useState)("nav-right");let _=!0;try{(0,l.k6)()}catch(e){_=!1}return(0,i.useEffect)((()=>{function t(){window.innerWidth<=767?u("inline"):u("horizontal"),e.buttons&&e.buttons.length>=3&&window.innerWidth>=795?C("nav-right"):e.buttons&&e.buttons.length>=3&&window.innerWidth<=795&&C("nav-right-collapse")}t();const a=r()(t,10);return window.addEventListener("resize",a),()=>window.removeEventListener("resize",a)}),[e.buttons]),(0,s.tZ)(v,null,(0,s.tZ)(f.X2,{className:"menu",role:"navigation"},e.name&&(0,s.tZ)("div",{className:"header"},e.name),(0,s.tZ)(m.v,{mode:d,style:{backgroundColor:"transparent"}},null==(t=e.tabs)?void 0:t.map((t=>(e.usesRouter||_)&&t.usesRouter?(0,s.tZ)(m.v.Item,{key:t.label},(0,s.tZ)("div",{role:"tab",className:t.name===e.activeChild?"active":""},(0,s.tZ)("div",null,(0,s.tZ)(o.rU,{to:t.url||""},t.label)))):(0,s.tZ)(m.v.Item,{key:t.label},(0,s.tZ)("div",{className:b()("no-router",{active:t.name===e.activeChild}),role:"tab"},(0,s.tZ)("a",{href:t.url,onClick:t.onClick},t.label)))))),(0,s.tZ)("div",{className:w},(0,s.tZ)(m.v,{mode:"horizontal",triggerSubMenuAction:"click"},null==(a=e.dropDownLinks)?void 0:a.map(((e,t)=>{var a;return(0,s.tZ)(y,{key:t,title:e.label,icon:(0,s.tZ)(g.Z.TriangleDown,null),popupOffset:[10,20],className:"dropdown-menu-links"},null==(a=e.childs)?void 0:a.map((e=>"object"==typeof e?e.disable?(0,s.tZ)(m.$.Item,{key:e.label,css:Z},(0,s.tZ)(h.u,{placement:"top",title:(0,c.t)("Enable 'Allow file uploads to database' in any database's settings")},e.label)):(0,s.tZ)(m.$.Item,{key:e.label},(0,s.tZ)("a",{href:e.url},e.label)):null)))}))),null==(n=e.buttons)?void 0:n.map(((e,t)=>(0,s.tZ)(p.Z,{key:t,buttonStyle:e.buttonStyle,onClick:e.onClick},e.name))))),e.children)}},25022:(e,t,a)=>{"use strict";var n=a(67294),r=a(90731),i=a(5872),l=a.n(i),o=a(73727),d=a(16550),s=a(14890),c=a(31405),u=a(57902),b=a(38703),h=a(77230),f=a(20292),m=a(5667),p=a(38552),g=a(48911),v=a(93185),Z=a(43063),y=a.n(Z),w=a(75049),C=a(51995),_=a(55867),x=a(15926),k=a.n(x),S=a(43700),F=a(61337),T=a(21742),$=a(14114),E=a(40768),I=a(91877),N=a(4715),O=a(12),P=a(22318),U=a(78580),D=a.n(U),z=a(30381),A=a.n(z),R=a(20755),M=a(70163),L=a(35932),q=a(81568),j=a(11965);const B={[q.g.Charts]:(0,_.t)("charts"),[q.g.Dashboards]:(0,_.t)("dashboards"),[q.g.Recents]:(0,_.t)("recents"),[q.g.SavedQueries]:(0,_.t)("saved queries")},V={[q.g.Charts]:(0,_.t)("No charts yet"),[q.g.Dashboards]:(0,_.t)("No dashboards yet"),[q.g.Recents]:(0,_.t)("No recents yet"),[q.g.SavedQueries]:(0,_.t)("No saved queries yet")},H={[q.g.Charts]:e=>(0,_.t)("%(other)s charts will appear here",{other:e}),[q.g.Dashboards]:e=>(0,_.t)("%(other)s dashboards will appear here",{other:e}),[q.g.Recents]:e=>(0,_.t)("%(other)s recents will appear here",{other:e}),[q.g.SavedQueries]:e=>(0,_.t)("%(other)s saved queries will appear here",{other:e})},K=C.iK.div`
  min-height: 200px;
  display: flex;
  flex-direction: column;
  justify-content: space-around;
`,G=C.iK.div`
  Button {
    svg {
      color: ${e=>{let{theme:t}=e;return t.colors.grayscale.light5}};
    }
  }
`;function Q(e){let{tableName:t,tab:a,otherTabTitle:n}=e;const r={[q.g.Charts]:"/chart/add",[q.g.Dashboards]:"/dashboard/new",[q.g.SavedQueries]:"/superset/sqllab?new=true"},i={[q.g.Charts]:"/chart/list",[q.g.Dashboards]:"/dashboard/list/",[q.g.SavedQueries]:"/savedqueryview/list/"},l={[q.g.Charts]:"empty-charts.svg",[q.g.Dashboards]:"empty-dashboard.svg",[q.g.Recents]:"union.svg",[q.g.SavedQueries]:"empty-queries.svg"},o=(0,j.tZ)("span",null,V[t]),d=(0,j.tZ)("span",{className:"no-recents"},(()=>{if(a===O.F.Viewed)return(0,_.t)("Recently viewed charts, dashboards, and saved queries will appear here");if(a===O.F.Created)return(0,_.t)("Recently created charts, dashboards, and saved queries will appear here");if(a===O.F.Other){const e=n||(0,_.t)("Other");return H[t](e)}return a===O.F.Edited?(0,_.t)("Recently edited charts, dashboards, and saved queries will appear here"):null})());return a===O.F.Mine||t===q.g.Recents||a===O.F.Other?(0,j.tZ)(K,null,(0,j.tZ)(N.HY,{image:`/static/assets/images/${l[t]}`,description:t===q.g.Recents||a===O.F.Other?d:o},t!==q.g.Recents&&(0,j.tZ)(G,null,(0,j.tZ)(L.Z,{buttonStyle:"primary",onClick:()=>{window.location.href=r[t]}},(0,j.tZ)("i",{className:"fa fa-plus"}),t===q.g.SavedQueries?(0,_.t)("SQL query"):t.split("").slice(0,t.length-1).join(""))))):(0,j.tZ)(K,null,(0,j.tZ)(N.HY,{image:"/static/assets/images/star-circle.svg",description:(0,j.tZ)("span",{className:"no-favorites"},(0,_.t)("You don't have any favorites yet!"))},(0,j.tZ)(L.Z,{buttonStyle:"primary",onClick:()=>{window.location.href=i[t]}},(0,_.t)("See all %(tableName)s",{tableName:t===q.g.SavedQueries?(0,_.t)("SQL Lab queries"):B[t]}))))}const Y=C.iK.div`
  .recentCards {
    max-height: none;
    grid-gap: ${e=>{let{theme:t}=e;return 4*t.gridUnit+"px"}};
  }
`,W=(0,_.t)("[Untitled]"),X=(0,_.t)("Unknown"),J=e=>"dashboard_title"in e?e.dashboard_title||W:"slice_name"in e?e.slice_name||W:"label"in e?e.label||W:e.item_title||W,ee=e=>{if("sql"in e)return(0,j.tZ)(M.Z.Sql,null);const t="item_url"in e?e.item_url:e.url;return null!=t&&D()(t).call(t,"dashboard")?(0,j.tZ)(M.Z.NavDashboard,null):null!=t&&D()(t).call(t,"explore")?(0,j.tZ)(M.Z.NavCharts,null):null};function te(e){var t;let{activeChild:a,setActiveChild:r,activityData:i,user:l,isFetchingActivityData:d}=e;const[s,c]=(0,n.useState)(),[u,b]=(0,n.useState)(!1);(0,n.useEffect)((()=>{a===O.F.Edited&&(b(!0),(0,E.Ld)(l.userId).then((e=>{c([...e.editedChart,...e.editedDash]),b(!1)})))}),[a]);const h=[{name:O.F.Edited,label:(0,_.t)("Edited"),onClick:()=>{r(O.F.Edited),(0,F.LS)(F.dR.homepage_activity_filter,O.F.Edited)}},{name:O.F.Created,label:(0,_.t)("Created"),onClick:()=>{r(O.F.Created),(0,F.LS)(F.dR.homepage_activity_filter,O.F.Created)}}];return null!=i&&i[O.F.Viewed]&&h.unshift({name:O.F.Viewed,label:(0,_.t)("Viewed"),onClick:()=>{r(O.F.Viewed),(0,F.LS)(F.dR.homepage_activity_filter,O.F.Viewed)}}),u&&!s||d?(0,j.tZ)(Fe,null):(0,j.tZ)(Y,null,(0,j.tZ)(R.Z,{activeChild:a,tabs:h}),(null==(t=i[a])?void 0:t.length)>0||a===O.F.Edited&&null!=s&&s.length?(0,j.tZ)(E._L,{className:"recentCards"},(a===O.F.Edited?s:i[a]).map((e=>{const t=(e=>"sql"in e?`/superset/sqllab?savedQueryId=${e.id}`:"url"in e?e.url:e.item_url)(e),a=(e=>{if("time"in e)return(0,_.t)("Viewed %s",A()(e.time).fromNow());let t;return"changed_on"in e&&(t=e.changed_on),"changed_on_utc"in e&&(t=e.changed_on_utc),(0,_.t)("Modified %s",null==t?X:A()(t).fromNow())})(e);return(0,j.tZ)(E.ZB,{key:t},(0,j.tZ)(o.rU,{to:t},(0,j.tZ)(T.Z,{cover:(0,j.tZ)(n.Fragment,null),url:t,title:J(e),description:a,avatar:ee(e),actions:null})))}))):(0,j.tZ)(Q,{tableName:q.g.Recents,tab:a}))}var ae=a(63105),ne=a.n(ae),re=a(34858),ie=a(83673),le=a(94394),oe=a(32228);const de=(0,$.ZP)((function(e){let{user:t,addDangerToast:a,addSuccessToast:r,mine:i,showThumbnails:l,otherTabData:o,otherTabFilters:s,otherTabTitle:c}=e;const h=(0,d.k6)(),f=(0,F.rV)(F.dR.homepage_chart_filter,O.F.Other),m=ne()(o,(e=>"viz_type"in e)),{state:{loading:p,resourceCollection:g,bulkSelectEnabled:v},setResourceCollection:Z,hasPerm:y,refreshData:w,fetchData:C}=(0,re.Yi)("chart",(0,_.t)("chart"),a,!0,f===O.F.Mine?i:m,[],!1),x=(0,n.useMemo)((()=>g.map((e=>e.id))),[g]),[k,S]=(0,re.NE)("chart",x,a),{sliceCurrentlyEditing:T,openChartEditModal:$,handleChartUpdated:I,closeChartEditModal:N}=(0,re.fF)(Z,g),[P,U]=(0,n.useState)(f),[D,z]=(0,n.useState)(!1),[A,M]=(0,n.useState)(!1);(0,n.useEffect)((()=>{var e;(A||P===O.F.Favorite)&&(e=P,C({pageIndex:0,pageSize:E.IV,sortBy:[{id:"changed_on_delta_humanized",desc:!0}],filters:(0,E.if)(e,q.g.Charts,t,s)})),M(!0)}),[P]);const L=e=>{const t=e.map((e=>{let{id:t}=e;return t}));(0,oe.Z)("chart",t,(()=>{z(!1)})),z(!0)},B=[{name:O.F.Favorite,label:(0,_.t)("Favorite"),onClick:()=>{U(O.F.Favorite),(0,F.LS)(F.dR.homepage_chart_filter,O.F.Favorite)}},{name:O.F.Mine,label:(0,_.t)("Mine"),onClick:()=>{U(O.F.Mine),(0,F.LS)(F.dR.homepage_chart_filter,O.F.Mine)}}];return o&&B.push({name:O.F.Other,label:c,onClick:()=>{U(O.F.Other),(0,F.LS)(F.dR.homepage_chart_filter,O.F.Other)}}),p?(0,j.tZ)(Fe,{cover:l}):(0,j.tZ)(u.Z,null,T&&(0,j.tZ)(ie.Z,{onHide:N,onSave:I,show:!0,slice:T}),(0,j.tZ)(R.Z,{activeChild:P,tabs:B,buttons:[{name:(0,j.tZ)(n.Fragment,null,(0,j.tZ)("i",{className:"fa fa-plus"}),(0,_.t)("Chart")),buttonStyle:"tertiary",onClick:()=>{window.location.assign("/chart/add")}},{name:(0,_.t)("View All »"),buttonStyle:"link",onClick:()=>{const e=P===O.F.Favorite?`/chart/list/?filters=(favorite:(label:${(0,_.t)("Yes")},value:!t))`:"/chart/list/";h.push(e)}}]}),null!=g&&g.length?(0,j.tZ)(E._L,{showThumbnails:l},g.map((e=>(0,j.tZ)(le.Z,{key:`${e.id}`,openChartEditModal:$,chartFilter:P,chart:e,userId:null==t?void 0:t.userId,hasPerm:y,showThumbnails:l,bulkSelectEnabled:v,refreshData:w,addDangerToast:a,addSuccessToast:r,favoriteStatus:S[e.id],saveFavoriteStatus:k,handleBulkChartExport:L})))):(0,j.tZ)(Q,{tableName:q.g.Charts,tab:P,otherTabTitle:c}),D&&(0,j.tZ)(b.Z,null))}));var se=a(31069),ce=a(42110),ue=a(33743),be=a(120),he=a(83862),fe=a(17198);ce.Z.registerLanguage("sql",ue.Z);const me=C.iK.div`
  cursor: pointer;
  a {
    text-decoration: none;
  }
  .ant-card-cover {
    border-bottom: 1px solid ${e=>{let{theme:t}=e;return t.colors.grayscale.light2}};
    & > div {
      height: 171px;
    }
  }
  .gradient-container > div {
    background-size: contain;
    background-repeat: no-repeat;
    background-position: center;
    background-color: ${e=>{let{theme:t}=e;return t.colors.secondary.light3}};
    display: inline-block;
    width: 100%;
    height: 179px;
    background-repeat: no-repeat;
    vertical-align: middle;
  }
`,pe=C.iK.div`
  svg {
    margin-left: ${e=>{let{theme:t}=e;return 10*t.gridUnit}}px;
  }
  .query-title {
    padding: ${e=>{let{theme:t}=e;return 2*t.gridUnit+2}}px;
    font-size: ${e=>{let{theme:t}=e;return t.typography.sizes.l}}px;
  }
`,ge=C.iK.div`
  pre {
    height: ${e=>{let{theme:t}=e;return 40*t.gridUnit}}px;
    border: none !important;
    background-color: ${e=>{let{theme:t}=e;return t.colors.grayscale.light5}} !important;
    overflow: hidden;
    padding: ${e=>{let{theme:t}=e;return 4*t.gridUnit}}px !important;
  }
`,ve=(0,$.ZP)((e=>{let{user:t,addDangerToast:a,addSuccessToast:r,mine:i,showThumbnails:l,featureFlag:o}=e;const{state:{loading:d,resourceCollection:s},hasPerm:c,fetchData:u,refreshData:b}=(0,re.Yi)("saved_query",(0,_.t)("query"),a,!0,i,[],!1),[h,f]=(0,n.useState)(O.F.Mine),[m,p]=(0,n.useState)(!1),[g,v]=(0,n.useState)({}),[Z,y]=(0,n.useState)(!0),w=c("can_edit"),x=c("can_delete"),k=(0,C.Fg)();return d?(0,j.tZ)(Fe,{cover:l}):(0,j.tZ)(n.Fragment,null,m&&(0,j.tZ)(fe.Z,{description:(0,_.t)("This action will permanently delete the saved query."),onConfirm:()=>{m&&(e=>{let{id:n,label:i}=e;se.Z.delete({endpoint:`/api/v1/saved_query/${n}`}).then((()=>{const e={filters:(0,E.if)(O.F.Created,q.g.SavedQueries,t),pageSize:E.IV,sortBy:[{id:"changed_on_delta_humanized",desc:!0}],pageIndex:0};b(Z?e:void 0),y(!1),p(!1),r((0,_.t)("Deleted: %s",i))}),(0,E.v$)((e=>a((0,_.t)("There was an issue deleting %s: %s",i,e)))))})(g)},onHide:()=>{p(!1)},open:!0,title:(0,_.t)("Delete Query?")}),(0,j.tZ)(R.Z,{activeChild:h,tabs:[{name:O.F.Mine,label:(0,_.t)("Mine"),onClick:()=>{return(e=O.F.Mine,u({pageIndex:0,pageSize:E.IV,sortBy:[{id:"changed_on_delta_humanized",desc:!0}],filters:(0,E.if)(e,q.g.SavedQueries,t)})).then((()=>f(O.F.Mine)));var e}}],buttons:[{name:(0,j.tZ)(n.Fragment,null,(0,j.tZ)("i",{className:"fa fa-plus"}),(0,_.t)("SQL Query")),buttonStyle:"tertiary",onClick:()=>{window.location.href="/superset/sqllab?new=true"}},{name:(0,_.t)("View All »"),buttonStyle:"link",onClick:()=>{window.location.href="/savedqueryview/list"}}]}),s.length>0?(0,j.tZ)(E._L,{showThumbnails:l},s.map((e=>{var t,i,d;return(0,j.tZ)(me,{onClick:()=>{window.location.href=`/superset/sqllab?savedQueryId=${e.id}`},key:e.id},(0,j.tZ)(T.Z,{imgURL:"",url:`/superset/sqllab?savedQueryId=${e.id}`,title:e.label,imgFallbackURL:"/static/assets/images/empty-query.svg",description:(0,_.t)("Ran %s",e.changed_on_delta_humanized),cover:null!=e&&null!=(t=e.sql)&&t.length&&l&&o?(0,j.tZ)(ge,null,(0,j.tZ)(ce.Z,{language:"sql",lineProps:{style:{color:k.colors.grayscale.dark2,wordBreak:"break-all",whiteSpace:"pre-wrap"}},style:be.Z,wrapLines:!0,lineNumberStyle:{display:"none"},showLineNumbers:!1},(0,E.IB)(e.sql,25))):!(l&&(null==e||null==(i=e.sql)||!i.length))&&(0,j.tZ)(n.Fragment,null),actions:(0,j.tZ)(pe,null,(0,j.tZ)(T.Z.Actions,{onClick:e=>{e.stopPropagation(),e.preventDefault()}},(0,j.tZ)(N.Gj,{overlay:(d=e,(0,j.tZ)(he.v,null,w&&(0,j.tZ)(he.v.Item,{onClick:()=>{window.location.href=`/superset/sqllab?savedQueryId=${d.id}`}},(0,_.t)("Edit")),(0,j.tZ)(he.v.Item,{onClick:()=>{d.id&&(0,re.bR)(d.id,a,r)}},(0,_.t)("Share")),x&&(0,j.tZ)(he.v.Item,{onClick:()=>{p(!0),v(d)}},(0,_.t)("Delete"))))},(0,j.tZ)(M.Z.MoreVert,{iconColor:k.colors.grayscale.base}))))}))}))):(0,j.tZ)(Q,{tableName:q.g.SavedQueries,tab:h}))}));var Ze=a(20818),ye=a(99415);const we=(0,$.ZP)((function(e){let{user:t,addDangerToast:a,addSuccessToast:r,mine:i,showThumbnails:l,otherTabData:o,otherTabFilters:s,otherTabTitle:c}=e;const u=(0,d.k6)(),h=(0,F.rV)(F.dR.homepage_dashboard_filter,O.F.Other),f=ne()(o,(e=>!("viz_type"in e))),{state:{loading:m,resourceCollection:p},setResourceCollection:g,hasPerm:v,refreshData:Z,fetchData:y}=(0,re.Yi)("dashboard",(0,_.t)("dashboard"),a,!0,h===O.F.Mine?i:f,[],!1),w=(0,n.useMemo)((()=>p.map((e=>e.id))),[p]),[C,x]=(0,re.NE)("dashboard",w,a),[k,S]=(0,n.useState)(),[T,$]=(0,n.useState)(h),[I,N]=(0,n.useState)(!1),[P,U]=(0,n.useState)(!1),[D,z]=(0,n.useState)(null);(0,n.useEffect)((()=>{var e;(P||T===O.F.Favorite)&&(e=T,y({pageIndex:0,pageSize:E.IV,sortBy:[{id:"changed_on_delta_humanized",desc:!0}],filters:(0,E.if)(e,q.g.Dashboards,t,s)})),U(!0)}),[T]);const A=e=>{const t=e.map((e=>{let{id:t}=e;return t}));(0,oe.Z)("dashboard",t,(()=>{N(!1)})),N(!0)},M=[{name:O.F.Favorite,label:(0,_.t)("Favorite"),onClick:()=>{$(O.F.Favorite),(0,F.LS)(F.dR.homepage_dashboard_filter,O.F.Favorite)}},{name:O.F.Mine,label:(0,_.t)("Mine"),onClick:()=>{$(O.F.Mine),(0,F.LS)(F.dR.homepage_dashboard_filter,O.F.Mine)}}];return o&&M.push({name:O.F.Other,label:c,onClick:()=>{$(O.F.Other),(0,F.LS)(F.dR.homepage_dashboard_filter,O.F.Other)}}),m?(0,j.tZ)(Fe,{cover:l}):(0,j.tZ)(n.Fragment,null,(0,j.tZ)(R.Z,{activeChild:T,tabs:M,buttons:[{name:(0,j.tZ)(n.Fragment,null,(0,j.tZ)("i",{className:"fa fa-plus"}),(0,_.t)("Dashboard")),buttonStyle:"tertiary",onClick:()=>{window.location.assign("/dashboard/new")}},{name:(0,_.t)("View All »"),buttonStyle:"link",onClick:()=>{const e=T===O.F.Favorite?`/dashboard/list/?filters=(favorite:(label:${(0,_.t)("Yes")},value:!t))`:"/dashboard/list/";u.push(e)}}]}),k&&(0,j.tZ)(Ze.Z,{dashboardId:null==k?void 0:k.id,show:!0,onHide:()=>S(void 0),onSubmit:e=>se.Z.get({endpoint:`/api/v1/dashboard/${e.id}`}).then((e=>{let{json:t={}}=e;g(p.map((e=>e.id===t.id?t.result:e)))}),(0,E.v$)((e=>a((0,_.t)("An error occurred while fetching dashboards: %s",e)))))}),D&&(0,j.tZ)(fe.Z,{description:(0,j.tZ)(n.Fragment,null,(0,_.t)("Are you sure you want to delete")," ",(0,j.tZ)("b",null,D.dashboard_title),"?"),onConfirm:()=>{(0,E.Iu)(D,Z,r,a,T,null==t?void 0:t.userId),z(null)},onHide:()=>z(null),open:!!D,title:(0,_.t)("Please confirm")}),p.length>0&&(0,j.tZ)(E._L,{showThumbnails:l},p.map((e=>(0,j.tZ)(ye.Z,{key:e.id,dashboard:e,hasPerm:v,bulkSelectEnabled:!1,showThumbnails:l,userId:null==t?void 0:t.userId,loading:m,openDashboardEditModal:e=>S(e),saveFavoriteStatus:C,favoriteStatus:x[e.id],handleBulkDashboardExport:A,onDelete:e=>z(e)})))),0===p.length&&(0,j.tZ)(Q,{tableName:q.g.Dashboards,tab:T}),I&&(0,j.tZ)(b.Z,null))})),Ce=(0,w.I)(),_e=["2","3"],xe=C.iK.div`
  background-color: ${e=>{let{theme:t}=e;return t.colors.grayscale.light4}};
  .ant-row.menu {
    margin-top: -15px;
    background-color: ${e=>{let{theme:t}=e;return t.colors.grayscale.light4}};
    &:after {
      content: '';
      display: block;
      border: 1px solid ${e=>{let{theme:t}=e;return t.colors.grayscale.light2}};
      margin: 0px ${e=>{let{theme:t}=e;return 6*t.gridUnit}}px;
      position: relative;
      width: 100%;
      ${E.mq[1]} {
        margin-top: 5px;
        margin: 0px 2px;
      }
    }
    .ant-menu.ant-menu-light.ant-menu-root.ant-menu-horizontal {
      padding-left: ${e=>{let{theme:t}=e;return 8*t.gridUnit}}px;
    }
    button {
      padding: 3px 21px;
    }
  }
  .ant-card-meta-description {
    margin-top: ${e=>{let{theme:t}=e;return t.gridUnit}}px;
  }
  .ant-card.ant-card-bordered {
    border: 1px solid ${e=>{let{theme:t}=e;return t.colors.grayscale.light2}};
  }
  .ant-collapse-item .ant-collapse-content {
    margin-bottom: ${e=>{let{theme:t}=e;return-6*t.gridUnit}}px;
  }
  div.ant-collapse-item:last-child.ant-collapse-item-active
    .ant-collapse-header {
    padding-bottom: ${e=>{let{theme:t}=e;return 3*t.gridUnit}}px;
  }
  div.ant-collapse-item:last-child .ant-collapse-header {
    padding-bottom: ${e=>{let{theme:t}=e;return 9*t.gridUnit}}px;
  }
  .loading-cards {
    margin-top: ${e=>{let{theme:t}=e;return 8*t.gridUnit}}px;
    .ant-card-cover > div {
      height: 168px;
    }
  }
`,ke=C.iK.div`
  ${e=>{let{theme:t}=e;return`\n    display: flex;\n    justify-content: space-between;\n    height: 50px;\n    background-color: ${t.colors.grayscale.light5};\n    .welcome-header {\n      font-size: ${t.typography.sizes.l}px;\n      padding: ${4*t.gridUnit}px ${2*t.gridUnit+2}px;\n      margin: 0 ${2*t.gridUnit}px;\n    }\n    .switch {\n      display: flex;\n      flex-direction: row;\n      margin: ${4*t.gridUnit}px;\n      span {\n        display: block;\n        margin: ${1*t.gridUnit}px;\n        line-height: 1;\n      }\n    }\n  `}}
`,Se=(0,f.Z)(),Fe=e=>{let{cover:t}=e;return(0,j.tZ)(E._L,{showThumbnails:t,className:"loading-cards"},[...new Array(E.iv)].map(((e,a)=>(0,j.tZ)(T.Z,{key:a,cover:!t&&(0,j.tZ)(n.Fragment,null),description:"",loading:!0}))))},Te=(0,$.ZP)((function(e){let{user:t,addDangerToast:a}=e;const r=(0,P.yI)(t),i=t.userId.toString(),l=k().encode({page_size:6}),o=`/api/v1/log/recent_activity/${t.userId}/?q=${l}`,[d,s]=(0,n.useState)("Loading"),c=(0,F.OH)(i,null);let u=!1;(0,I.cr)(v.T.THUMBNAILS)&&(u=void 0===(null==c?void 0:c.thumbnails)||(null==c?void 0:c.thumbnails));const[b,h]=(0,n.useState)(u),[f,m]=(0,n.useState)(null),[p,g]=(0,n.useState)(null),[Z,w]=(0,n.useState)(null),[C,x]=(0,n.useState)(null),[T,$]=(0,n.useState)(!0),U=(0,F.rV)(F.dR.homepage_collapse_state,[]),[D,z]=(0,n.useState)(U),A=Ce.get("welcome.message"),R=Ce.get("welcome.banner"),M=Ce.get("welcome.main.replacement"),[L,q]=(0,n.useMemo)((()=>{var e;const t=null==(e=Se.common)?void 0:e.conf.WELCOME_PAGE_LAST_TAB,[a,n]=Array.isArray(t)?t:[void 0,void 0];return a&&n?[(0,_.t)(a),n]:"all"===t?[(0,_.t)("All"),[]]:[(0,_.t)("Examples"),[{col:"created_by",opr:"rel_o_m",value:0}]]}),[]);(0,n.useEffect)((()=>{if(!q)return;const e=(0,F.rV)(F.dR.homepage_activity_filter,null);z(U.length>0?U:_e),(0,E.xF)(t.userId,o,a,q).then((t=>{const a={};if(a[O.F.Other]=t.other,t.viewed){const n=y()(t.viewed,["item_url",null]).map((e=>e));a[O.F.Viewed]=n,!e&&a[O.F.Viewed]?s(O.F.Viewed):e||a[O.F.Viewed]?s(e||O.F.Created):s(O.F.Created)}else s(e||O.F.Created);m((e=>({...e,...a})))})).catch((0,E.v$)((e=>{m((e=>({...e,[O.F.Viewed]:[]}))),a((0,_.t)("There was an issue fetching your recent activity: %s",e))})));const n=[{col:"created_by",opr:"rel_o_m",value:`${i}`}];Promise.all([(0,E.B1)(i,"dashboard").then((e=>(x(e),Promise.resolve()))).catch((e=>(x([]),a((0,_.t)("There was an issue fetching your dashboards: %s",e)),Promise.resolve()))),(0,E.B1)(i,"chart").then((e=>(g(e),Promise.resolve()))).catch((e=>(g([]),a((0,_.t)("There was an issue fetching your chart: %s",e)),Promise.resolve()))),r?(0,E.B1)(i,"saved_query",n).then((e=>(w(e),Promise.resolve()))).catch((e=>(w([]),a((0,_.t)("There was an issue fetching your saved queries: %s",e)),Promise.resolve()))):Promise.resolve()]).then((()=>{$(!1)}))}),[q]),(0,n.useEffect)((()=>{!U&&null!=Z&&Z.length&&z((e=>[...e,"4"])),m((e=>({...e,Created:[...(null==p?void 0:p.slice(0,3))||[],...(null==C?void 0:C.slice(0,3))||[],...(null==Z?void 0:Z.slice(0,3))||[]]})))}),[p,Z,C]),(0,n.useEffect)((()=>{var e;!U&&null!=f&&null!=(e=f[O.F.Viewed])&&e.length&&z((e=>["1",...e]))}),[f]);const B=!(null!=f&&f[O.F.Other]||null!=f&&f[O.F.Viewed]);return(0,j.tZ)(xe,null,A&&(0,j.tZ)(A,null),R&&(0,j.tZ)(R,null),M&&(0,j.tZ)(M,null),(!R||!M)&&(0,j.tZ)(n.Fragment,null,(0,j.tZ)(ke,null,(0,j.tZ)("h1",{className:"welcome-header"},(0,_.t)("Home")),(0,I.cr)(v.T.THUMBNAILS)?(0,j.tZ)("div",{className:"switch"},(0,j.tZ)(N.KU,{checked:b,onChange:()=>{h(!b),(0,F.I_)(i,{thumbnails:!b})}}),(0,j.tZ)("span",null,(0,_.t)("Thumbnails"))):null),(0,j.tZ)(S.Z,{activeKey:D,onChange:e=>{z(e),(0,F.LS)(F.dR.homepage_collapse_state,e)},ghost:!0,bigger:!0},(0,j.tZ)(S.Z.Panel,{header:(0,_.t)("Recents"),key:"1"},f&&(f[O.F.Viewed]||f[O.F.Other]||f[O.F.Created])&&"Loading"!==d?(0,j.tZ)(te,{user:{userId:t.userId},activeChild:d,setActiveChild:s,activityData:f,isFetchingActivityData:T}):(0,j.tZ)(Fe,null)),(0,j.tZ)(S.Z.Panel,{header:(0,_.t)("Dashboards"),key:"2"},!C||B?(0,j.tZ)(Fe,{cover:b}):(0,j.tZ)(we,{user:t,mine:C,showThumbnails:b,otherTabData:null==f?void 0:f[O.F.Other],otherTabFilters:q,otherTabTitle:L})),(0,j.tZ)(S.Z.Panel,{header:(0,_.t)("Charts"),key:"3"},!p||B?(0,j.tZ)(Fe,{cover:b}):(0,j.tZ)(de,{showThumbnails:b,user:t,mine:p,otherTabData:null==f?void 0:f[O.F.Other],otherTabFilters:q,otherTabTitle:L})),r&&(0,j.tZ)(S.Z.Panel,{header:(0,_.t)("Saved queries"),key:"4"},Z?(0,j.tZ)(ve,{showThumbnails:b,user:t,mine:Z,featureFlag:(0,I.cr)(v.T.THUMBNAILS)}):(0,j.tZ)(Fe,{cover:b})))))})),$e=(0,n.lazy)((()=>a.e(4109).then(a.bind(a,76499)))),Ee=(0,n.lazy)((()=>Promise.all([a.e(8782),a.e(4787)]).then(a.bind(a,28999)))),Ie=(0,n.lazy)((()=>Promise.all([a.e(1216),a.e(876),a.e(8782),a.e(9502)]).then(a.bind(a,63082)))),Ne=(0,n.lazy)((()=>Promise.all([a.e(8782),a.e(1611)]).then(a.bind(a,35276)))),Oe=(0,n.lazy)((()=>Promise.all([a.e(1216),a.e(8782),a.e(665)]).then(a.bind(a,33320)))),Pe=(0,n.lazy)((()=>Promise.all([a.e(8782),a.e(9452)]).then(a.bind(a,45395)))),Ue=(0,n.lazy)((()=>Promise.all([a.e(1216),a.e(8782),a.e(8774)]).then(a.bind(a,23767)))),De=(0,n.lazy)((()=>Promise.all([a.e(5619),a.e(468)]).then(a.bind(a,82343)))),ze=(0,n.lazy)((()=>Promise.all([a.e(8782),a.e(4502)]).then(a.bind(a,30075)))),Ae=(0,n.lazy)((()=>Promise.all([a.e(8782),a.e(5656)]).then(a.bind(a,69810)))),Re=(0,n.lazy)((()=>Promise.all([a.e(1216),a.e(6052),a.e(8782),a.e(986),a.e(6217),a.e(6947)]).then(a.bind(a,24279)))),Me=(0,n.lazy)((()=>Promise.all([a.e(8782),a.e(9137)]).then(a.bind(a,25163)))),Le=(0,n.lazy)((()=>Promise.all([a.e(1216),a.e(876),a.e(6052),a.e(2907),a.e(5207),a.e(323),a.e(986),a.e(8274),a.e(5619),a.e(2923),a.e(9541)]).then(a.bind(a,53880)))),qe=(0,n.lazy)((()=>Promise.all([a.e(8782),a.e(7633)]).then(a.bind(a,82842)))),je=(0,n.lazy)((()=>Promise.all([a.e(1216),a.e(8782),a.e(9173)]).then(a.bind(a,49588)))),Be=(0,n.lazy)((()=>a.e(7637).then(a.bind(a,39863)))),Ve=(0,n.lazy)((()=>Promise.all([a.e(8782),a.e(8865)]).then(a.bind(a,20295)))),He=[{path:"/superset/welcome/",Component:Te},{path:"/dashboard/list/",Component:Ue},{path:"/superset/dashboard/:idOrSlug/",Component:De},{path:"/chart/add",Component:$e},{path:"/chart/list/",Component:Oe},{path:"/tablemodelview/list/",Component:Ae},{path:"/databaseview/list/",Component:ze},{path:"/savedqueryview/list/",Component:je},{path:"/csstemplatemodelview/list/",Component:Pe},{path:"/annotationlayer/list/",Component:Ee},{path:"/annotationlayer/:annotationLayerId/annotation/",Component:Ne},{path:"/superset/sqllab/history/",Component:qe},{path:"/alert/list/",Component:Ie},{path:"/report/list/",Component:Ie,props:{isReportEnabled:!0}},{path:"/alert/:alertId/log/",Component:Me},{path:"/report/:alertId/log/",Component:Me,props:{isReportEnabled:!0}},{path:"/explore/",Component:Le},{path:"/superset/explore/p",Component:Le},{path:"/dataset/add/",Component:Re},{path:"/dataset/:datasetId",Component:Re}];(0,v.c)(v.T.TAGGING_SYSTEM)&&(He.push({path:"/superset/all_entities/",Component:Be}),He.push({path:"/superset/tags/",Component:Ve}));const Ke=He.map((e=>e.path)).reduce(((e,t)=>({...e,[t]:!0})),{});function Ge(e){if(e){const t=e.split(/[?#]/)[0];return!!Ke[t]}return!1}var Qe=a(3741),Ye=a(63431),We=a(97381),Xe=a(29454),Je=a(68135),et=a(28216),tt=a(35755),at=a(38626),nt=a(57865),rt=a(33626);const it={info:"addInfoToast",alert:"addDangerToast",danger:"addDangerToast",warning:"addWarningToast",success:"addSuccessToast"};function lt(e){let{children:t,messages:a}=e;const n=(0,$.e1)();return(0,rt.J)((()=>{a.forEach((e=>{const[t,a]=e,r=n[it[t]];r&&r(a)}))})),t}var ot=a(25076),dt=a(29147),st=a(14278);const{common:ct}=(0,f.Z)(),ut=(0,w.I)(),bt=e=>{let{children:t}=e;const a=ut.get("root.context.provider");return(0,j.tZ)(Je.a,{theme:ot.r},(0,j.tZ)(et.zt,{store:Xe.h},(0,j.tZ)(at.W,{backend:nt.PD},(0,j.tZ)(lt,{messages:ct.flash_messages},(0,j.tZ)(dt.DG,null,(0,j.tZ)(st.EM,null,(0,j.tZ)(tt.Fz,{ReactRouterRoute:d.AW,stringifyOptions:{encode:!1}},a?(0,j.tZ)(a,null,t):t)))))))},ht=()=>{const{pathname:e}=(0,d.TH)();return(0,n.useEffect)((()=>{window.scrollTo(0,0)}),[e]),null};var ft=a(78926);const mt=new ft.QueryClient({defaultOptions:{queries:{staleTime:1/0,retry:!1,retryOnMount:!1,refetchOnMount:!1,refetchOnReconnect:!1,refetchOnWindowFocus:!1}}}),pt=e=>{let{children:t}=e;return(0,j.tZ)(ft.QueryClientProvider,{client:mt},t)};(0,p.Z)(),(0,g.Z)(),(0,Ye.Z)();const gt=(0,f.Z)();let vt;const Zt=(0,s.DE)({logEvent:We.logEvent},Xe.h.dispatch),yt=()=>{const e=(0,d.TH)();return(0,n.useEffect)((()=>{Zt.logEvent(Qe.kV,{path:e.pathname}),vt&&vt!==e.pathname&&Qe.Yd.markTimeOrigin(),vt=e.pathname}),[e.pathname]),(0,j.tZ)(n.Fragment,null)};r.render((0,j.tZ)((()=>(0,j.tZ)(pt,null,(0,j.tZ)(o.VK,null,(0,j.tZ)(ht,null),(0,j.tZ)(yt,null),(0,j.tZ)(bt,null,(0,j.tZ)(c.n,null),(0,j.tZ)(h.Z,{data:gt.common.menu_data,isFrontendRoute:Ge}),(0,j.tZ)(d.rs,null,He.map((e=>{let{path:t,Component:a,props:r={},Fallback:i=b.Z}=e;return(0,j.tZ)(d.AW,{path:t,key:t},(0,j.tZ)(n.Suspense,{fallback:(0,j.tZ)(i,null)},(0,j.tZ)(u.Z,null,(0,j.tZ)(a,l()({user:gt.user},r)))))}))),(0,j.tZ)(m.Z,null))))),null),document.getElementById("app"))}},s={};function c(e){var t=s[e];if(void 0!==t)return t.exports;var a=s[e]={id:e,loaded:!1,exports:{}};return d[e].call(a.exports,a,a.exports,c),a.loaded=!0,a.exports}c.m=d,c.amdD=function(){throw new Error("define cannot be used indirect")},c.amdO={},e=[],c.O=(t,a,n,r)=>{if(!a){var i=1/0;for(s=0;s<e.length;s++){for(var[a,n,r]=e[s],l=!0,o=0;o<a.length;o++)(!1&r||i>=r)&&Object.keys(c.O).every((e=>c.O[e](a[o])))?a.splice(o--,1):(l=!1,r<i&&(i=r));if(l){e.splice(s--,1);var d=n();void 0!==d&&(t=d)}}return t}r=r||0;for(var s=e.length;s>0&&e[s-1][2]>r;s--)e[s]=e[s-1];e[s]=[a,n,r]},c.H={},c.G=e=>{Object.keys(c.H).map((t=>{c.H[t](e)}))},c.n=e=>{var t=e&&e.__esModule?()=>e.default:()=>e;return c.d(t,{a:t}),t},a=Object.getPrototypeOf?e=>Object.getPrototypeOf(e):e=>e.__proto__,c.t=function(e,n){if(1&n&&(e=this(e)),8&n)return e;if("object"==typeof e&&e){if(4&n&&e.__esModule)return e;if(16&n&&"function"==typeof e.then)return e}var r=Object.create(null);c.r(r);var i={};t=t||[null,a({}),a([]),a(a)];for(var l=2&n&&e;"object"==typeof l&&!~t.indexOf(l);l=a(l))Object.getOwnPropertyNames(l).forEach((t=>i[t]=()=>e[t]));return i.default=()=>e,c.d(r,i),r},c.d=(e,t)=>{for(var a in t)c.o(t,a)&&!c.o(e,a)&&Object.defineProperty(e,a,{enumerable:!0,get:t[a]})},c.f={},c.e=e=>Promise.all(Object.keys(c.f).reduce(((t,a)=>(c.f[a](e,t),t)),[])),c.u=e=>6217===e?"6217.339f55fcac29c585713d.entry.js":2441===e?"2441.88b6789af1d53f852f83.entry.js":323===e?"323.f4ddf3d2f6d415d823ef.entry.js":{57:"4362b5304762d1e0b0d3",112:"f6d017953aec813a7fe6",137:"16cf3edc284d2ee6501a",158:"d20fb16ba662419cf713",177:"3c694511e12766de3fdb",183:"fc084293cd81bf3d202b",215:"b141fc66cd9111e73a75",310:"62bceea4739b1f1a5bc9",312:"65631b4f49f22d2413c2",326:"d242f2ad2d3442ba4133",336:"334a3891e7de11316812",347:"eb5ca79a61e22b824e7f",349:"ddbeb4e9369b016e3138",357:"9c6ff5d06296e26f681e",363:"b58cab3e521511e45a9a",440:"ac518f6c7471ecc8589d",444:"1e9647d5b1ca4ad8c5b0",452:"8c87dc94d6c3382d35a6",468:"b12dbe000499f564e5c5",498:"2b24558db86c183a3f28",597:"891c9b9684277a17a60e",600:"0177d8101821912d936b",616:"6a7667fb7b513c0d092a",665:"6eedcdf2dc282fc73ec4",704:"21d2fb529e44fcf67add",741:"f8e056d22124a7fd6234",775:"cb6001d7703ed9082969",783:"4edc2cd35a5b0e58e5bc",826:"f5869088a4319a800ccb",876:"164a9c7420e83c02aabb",954:"2303fb8941bde712abf8",986:"f701a9d9f1e129014644",992:"cc74b5cb12406685536f",999:"9ba647b17b697f8d9d70",1020:"cf0fd6735c1379b71de4",1075:"3d9f9c55dfd05b09a6fe",1095:"21eac80381a20e1970c7",1128:"2959760c98cb6c223a83",1130:"bb83ea894155833b2918",1161:"e4cf5490d1f2dcefa90f",1174:"718d389061dd32058771",1185:"c4947a81e5cbf90ea2fa",1221:"eecffbbd005d7be8cad5",1256:"4c2391ac8aafc5a56b06",1258:"d965f006bd20b8ca4361",1261:"60feda24c9afd7f51a05",1263:"0eec8025b1da27433364",1293:"50584f9c49cbb0b9fd9f",1351:"d7859b43df2e8565d05e",1382:"42aeaf6d0c9152d0af24",1398:"d50144b85b56ef439bb3",1402:"7fe38901eceb0cefc829",1458:"bda04609cd55869cb5bc",1493:"22335e2922f171e25afd",1568:"aeaf7a986946c92c7ec3",1573:"2d8e4594741dce3dbd4f",1605:"3a34d566763b41457ec4",1611:"eb2be50d7496b178b51a",1877:"058a6a4dd8015f223965",1899:"b937388aca2fb5504511",1948:"d807b0db7d2f582d56fb",2079:"c0243f2080737fc9e2d9",2089:"236135bf62aa9ae755bb",2105:"044a114a0250557286f0",2112:"71f6dae2883e90721236",2197:"cb761344203d9deb7872",2229:"afdcf8204c3daab2510c",2264:"5e8890aa7b66e1ef4bdc",2267:"687c0a6eaa1d0a8f7313",2403:"952401cd0329c226b7d1",2439:"4a31589eccb01444ed49",2549:"7536866c1c0f67b91175",2646:"12367d1e0bb2b4afb255",2698:"f2735c169d7b6a4f5848",2713:"b33db133524d59872498",2797:"c664ff837065c346780f",2907:"4fe79584d10e2ad19292",2923:"4c81b739e6e8cff1c345",2955:"bbf1f258aa4d1f39b77a",2983:"b56274c43951cd5c9fb0",3036:"4f833db30c0b2d91910e",3126:"a40dd0f4278de0ae8f9c",3141:"74aa1bb1aa347b6e1264",3187:"2a60889d78c01d71e0dd",3208:"5965e60fa243ff6d2bc8",3240:"fc28aa5f2526f7bd1660",3265:"b1cc64850473a13027ef",3325:"39e61bf287a84284337a",3496:"e4549a3c444a4bad31cb",3537:"1f93011280e2f4b3c89b",3544:"59252fbba271a71ecc89",3558:"33174e7edaaac248423d",3567:"f158268a2958199d23ba",3588:"e10559f631421e8e5933",3606:"d8ca4e3d2c999f3432ea",3711:"d588b2a6dd1d55402ab8",3745:"2f9998dd40a29b6f22fc",3749:"07d664aaf1537ae41b3c",3831:"78d5f7e10e75224b45d4",3871:"9ab6f0cada666faef121",3955:"073c164857f20fc71ca4",3985:"e6cf10829d09f4640214",4109:"4d75f24d8dd09edb109a",4139:"3254a4a2afe05d91676f",4194:"5ab969bdb60236120b31",4237:"5b4efb9d89b9ceb2f2fc",4266:"0197266f2dc0b4c8f5fa",4273:"ed1976d07a2474c894f9",4421:"7070c33ea00c0d7d22a9",4458:"3e7d75f61b48452097dc",4474:"3f9a354919a133da7818",4494:"5ff3e8b7a73a7bbed35f",4502:"256eb3c119d4a2d17c67",4572:"90202c9e154dcdec5895",4579:"324ea06214e3e7cf9b5b",4625:"621e401582ff3bca2342",4662:"1be29b0a1306522b22b4",4667:"b95d31197f37908372c0",4732:"dfa5abcf641f49f06937",4757:"bdd493eebcb903da929d",4758:"9f168dc8a77ac47f7ce1",4787:"1e09016259948feaa429",4790:"8113b2d34e866bee4b7f",4794:"e1342085181b820e1166",4797:"26da53a05512a54f0ab9",4810:"4083b1c309b89db43387",4817:"cffe88250e2792acb914",4832:"6d13aacaaf914e02ad77",4851:"4dab4855dd5604d12c6d",4936:"32d5a63607c1083ec0f3",4972:"92b4f1a79172452ffe53",5051:"8f0e428abc411189219e",5094:"39c2ee74c0b24aa382d9",5123:"64590c9fada5a5856638",5181:"5b26643f606977e9ed54",5201:"f7a288fffdd2a4a748d3",5207:"5390d4fcbebc7c83f8ab",5215:"29b91d6854c5e405ce45",5224:"c28f014ad3177cf611f3",5226:"3c611279fc6880af6256",5249:"5727cf1feb0f056ab206",5264:"86e4515eee75df245995",5281:"d9ea22831a45efa05abf",5330:"35ac45286b6b44167bd7",5334:"9ce119655aa145613a7f",5335:"88b06a818cd0117f56b1",5350:"7889d5826b40395c074f",5359:"5364a0ae2074914b0b45",5367:"c14a6b3f383e99e0f762",5378:"4b78570a5638ef07bcaf",5507:"cbe5b1d7a2202354be3d",5566:"8d7057eb8271bbaefac8",5580:"56b4ea31f6378cfbbe67",5592:"98927561afa54be3c797",5619:"1882240ba470d27198f4",5641:"6abe473e8ad84b72d7f9",5656:"6c03000af8e416d8032a",5707:"d650cc0676c989c53b46",5771:"cb1924c9720f5f456868",5777:"4316beeb5144100af911",5802:"466d74e3e6955ef7209a",5816:"8ae960dccbd5932ecc4f",5832:"ea166e36b0b0b2327639",5838:"c694317e35f598e5bf1a",5962:"568f59ad9c53fe7b78a2",5972:"e7e5e34c2290ec967c85",5998:"732e4b677c3e43e37262",6052:"4c65ab1958700a12a74b",6061:"e3e81b8e8c58530a1e1d",6126:"575a4cb2f911ca3ba909",6150:"c3dd6eec636540d0ef94",6167:"71dcab1e81d48a10b442",6207:"ba7c3d6aebfe0750dc67",6254:"5a90e5fe4b068b6241a0",6303:"85b33e0dcbc189800dda",6357:"987dae83a2704344cc3d",6371:"bd6302508932f2b751ac",6377:"323e845597342cf9b240",6420:"dbd10f614337e1472a17",6447:"08c21008a6fc572a67ff",6486:"59091cc686ab0175d690",6507:"e935076dcc7fbe1cc651",6579:"72a6c2ece1a923b2e311",6668:"22eba8579f51d4d93737",6682:"0b14c0b7a7d9904ec527",6693:"b3ecca997bbad24ed990",6758:"1a621d7f286d5c9adb4b",6819:"66742c8d9e5b1ce8259b",6871:"c7c924cf89dcb6670405",6883:"9ed65ab8d3b4bbfb47c9",6947:"3f7e876e8c06f5fab5f4",6968:"c244372f367e01b6b8bf",6981:"608c68ce541fbd39d168",7003:"a48b494de6c9eee62a48",7183:"68fa39af2a7b9374751d",7245:"f29b8f3dc3716ccd1769",7249:"16413091c03ca1a2f2b8",7405:"e3420515b524f5516e0e",7460:"8b280e898799f93de5be",7521:"45ff3c7f689460a6a58b",7584:"7aca1ea0c22d4b2a3dc4",7610:"95bc00206741bcfd6541",7633:"45fb804182078b8ba1cd",7637:"48b60bf7f29d2fe420d3",7654:"51ef84f7843a0856d189",7716:"5de142721fdf097ef171",7760:"4de155e4c465c48391c2",7803:"a69a5f6546322eebba43",7832:"108ceb65fa77e2ee3b1e",7850:"86ff63c706b5260ebc5e",7922:"fcc96506913a8c345894",7984:"64ff5b51bb710a740d05",7989:"0f388f5a81ab8de20c79",8041:"108c8baedd99ed2b2154",8274:"595a30c93acfef945612",8312:"e8abff2e2378b2690e44",8349:"0d7ae8d02636df8e6102",8398:"01a3aa3aadcfaa41bc46",8425:"b82e084872e4409a8328",8463:"f0afa7465c828a07259a",8464:"3e98ff9b633c3b705a05",8491:"d250a632b0232d6da24f",8551:"d437ed9d48498711e187",8623:"f78780e94e356fb88436",8650:"b2e7fa388f024048b5fa",8656:"762d4c99ea31d0a7ce0e",8682:"fd78b2810aae9d021034",8695:"acbbd60dde6db231dfd3",8701:"418d3c6040f80556531e",8750:"8932d659b9462359cd4f",8774:"cee22a81c389391538df",8782:"29da2bf2c8e41938e71e",8865:"f7040762597a6cc8d618",8883:"3ea64ae0c92692819070",8924:"d230312d67b229d5bdc7",8970:"24e438afe5479e2dc2f3",9013:"a1a4cd98f6ba21481de6",9034:"c4daab2219b057a7b12f",9052:"08e0467a85d5d2746a69",9101:"8626ca0e23112e7d15ab",9109:"1fd4febdc037cb353e1b",9137:"ed79042a6e27ee71d484",9173:"9518ebe7a7b775cce7dc",9207:"78a5fba54c4293b0b34c",9305:"d12e380a429916e4f0c8",9322:"23be6a05ce9b3316ce0e",9325:"2c33db7428d1157db168",9393:"b5388a7a6d54d88adf1a",9396:"bd9e6daeba3a8d07c22a",9452:"34b3b500d4f1b126ec17",9471:"bc753eab1937650d8a4f",9483:"5c29d96181ac2a4000fb",9502:"6f20f511aaf27f552c6a",9510:"23e786be46b42f2dde05",9541:"46f7800ea580dc216e4d",9558:"914f0e63918f281e3dd5",9622:"15b35e117682e2e2bed9",9767:"b58b6142662719f0b769",9794:"815f7ca4e1c4b2abb4d1",9811:"2deb857f57c1c2e5ddb1",9857:"21151c26622dbe000474",9873:"c05b12d4832ab2ed804f",9877:"9ce07ae9a17b4ea94970"}[e]+".chunk.js",c.miniCssF=e=>(({452:"DashboardContainer",9502:"AlertList",9541:"ExplorePage"}[e]||e)+"."+{137:"16cf3edc284d2ee6501a",452:"8c87dc94d6c3382d35a6",1261:"60feda24c9afd7f51a05",1877:"058a6a4dd8015f223965",3036:"4f833db30c0b2d91910e",4194:"5ab969bdb60236120b31",4237:"5b4efb9d89b9ceb2f2fc",4494:"5ff3e8b7a73a7bbed35f",4936:"32d5a63607c1083ec0f3",5378:"4b78570a5638ef07bcaf",5566:"8d7057eb8271bbaefac8",6871:"c7c924cf89dcb6670405",8623:"f78780e94e356fb88436",8650:"b2e7fa388f024048b5fa",9502:"6f20f511aaf27f552c6a",9541:"46f7800ea580dc216e4d"}[e]+".chunk.css"),c.g=function(){if("object"==typeof globalThis)return globalThis;try{return this||new Function("return this")()}catch(e){if("object"==typeof window)return window}}(),c.hmd=e=>((e=Object.create(e)).children||(e.children=[]),Object.defineProperty(e,"exports",{enumerable:!0,set:()=>{throw new Error("ES Modules may not assign module.exports or exports.*, Use ESM export syntax, instead: "+e.id)}}),e),c.o=(e,t)=>Object.prototype.hasOwnProperty.call(e,t),n={},r="superset:",c.l=(e,t,a,i)=>{if(n[e])n[e].push(t);else{var l,o;if(void 0!==a)for(var d=document.getElementsByTagName("script"),s=0;s<d.length;s++){var u=d[s];if(u.getAttribute("src")==e||u.getAttribute("data-webpack")==r+a){l=u;break}}l||(o=!0,(l=document.createElement("script")).charset="utf-8",l.timeout=120,c.nc&&l.setAttribute("nonce",c.nc),l.setAttribute("data-webpack",r+a),l.src=e),n[e]=[t];var b=(t,a)=>{l.onerror=l.onload=null,clearTimeout(h);var r=n[e];if(delete n[e],l.parentNode&&l.parentNode.removeChild(l),r&&r.forEach((e=>e(a))),t)return t(a)},h=setTimeout(b.bind(null,void 0,{type:"timeout",target:l}),12e4);l.onerror=b.bind(null,l.onerror),l.onload=b.bind(null,l.onload),o&&document.head.appendChild(l)}},c.r=e=>{"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(e,"__esModule",{value:!0})},c.nmd=e=>(e.paths=[],e.children||(e.children=[]),e),c.p="/static/assets/",i=e=>new Promise(((t,a)=>{var n=c.miniCssF(e),r=c.p+n;if(((e,t)=>{for(var a=document.getElementsByTagName("link"),n=0;n<a.length;n++){var r=(l=a[n]).getAttribute("data-href")||l.getAttribute("href");if("stylesheet"===l.rel&&(r===e||r===t))return l}var i=document.getElementsByTagName("style");for(n=0;n<i.length;n++){var l;if((r=(l=i[n]).getAttribute("data-href"))===e||r===t)return l}})(n,r))return t();((e,t,a,n)=>{var r=document.createElement("link");r.rel="stylesheet",r.type="text/css",r.onerror=r.onload=i=>{if(r.onerror=r.onload=null,"load"===i.type)a();else{var l=i&&("load"===i.type?"missing":i.type),o=i&&i.target&&i.target.href||t,d=new Error("Loading CSS chunk "+e+" failed.\n("+o+")");d.code="CSS_CHUNK_LOAD_FAILED",d.type=l,d.request=o,r.parentNode.removeChild(r),n(d)}},r.href=t,document.head.appendChild(r)})(e,r,t,a)})),l={7103:0},c.f.miniCss=(e,t)=>{l[e]?t.push(l[e]):0!==l[e]&&{137:1,452:1,1261:1,1877:1,3036:1,4194:1,4237:1,4494:1,4936:1,5378:1,5566:1,6871:1,8623:1,8650:1,9502:1,9541:1}[e]&&t.push(l[e]=i(e).then((()=>{l[e]=0}),(t=>{throw delete l[e],t})))},(()=>{var e={7103:0};c.f.j=(t,a)=>{var n=c.o(e,t)?e[t]:void 0;if(0!==n)if(n)a.push(n[2]);else if(/^(126|687)1$/.test(t))e[t]=0;else{var r=new Promise(((a,r)=>n=e[t]=[a,r]));a.push(n[2]=r);var i=c.p+c.u(t),l=new Error;c.l(i,(a=>{if(c.o(e,t)&&(0!==(n=e[t])&&(e[t]=void 0),n)){var r=a&&("load"===a.type?"missing":a.type),i=a&&a.target&&a.target.src;l.message="Loading chunk "+t+" failed.\n("+r+": "+i+")",l.name="ChunkLoadError",l.type=r,l.request=i,n[1](l)}}),"chunk-"+t,t)}},c.H.j=t=>{if(!(c.o(e,t)&&void 0!==e[t]||/^(126|687)1$/.test(t))){e[t]=null;var a=document.createElement("link");a.charset="utf-8",c.nc&&a.setAttribute("nonce",c.nc),a.rel="preload",a.as="script",a.href=c.p+c.u(t),document.head.appendChild(a)}},c.O.j=t=>0===e[t];var t=(t,a)=>{var n,r,[i,l,o]=a,d=0;if(i.some((t=>0!==e[t]))){for(n in l)c.o(l,n)&&(c.m[n]=l[n]);if(o)var s=o(c)}for(t&&t(a);d<i.length;d++)r=i[d],c.o(e,r)&&e[r]&&e[r][0](),e[i[d]]=0;return c.O(s)},a=globalThis.webpackChunksuperset=globalThis.webpackChunksuperset||[];a.forEach(t.bind(null,0)),a.push=t.bind(null,a.push.bind(a))})(),o={468:[1216,8494,8453,7167,678,876,6052,2907,5207,5640,5010,8888,7243,986,8274,2923,4717,452],9541:[1216,8494,8453,7167,678,876,6052,2907,5207,5640,5010,8888,7243,986,8274,2923,4717,452]},c.f.preload=e=>{var t=o[e];Array.isArray(t)&&t.map(c.G)},c.O(void 0,[1216,504,2450,8494,2318,8453,7167,678,8767,6140,2087,5755,845,5640,9602,5010,8047,8888,7243,8989,9454,6839,9772,5296,7230,4717],(()=>c(25076)));var u=c.O(void 0,[1216,504,2450,8494,2318,8453,7167,678,8767,6140,2087,5755,845,5640,9602,5010,8047,8888,7243,8989,9454,6839,9772,5296,7230,4717],(()=>c(25022)));u=c.O(u)})();
//# sourceMappingURL=spa.7dae5f174a61b691c80c.entry.js.map