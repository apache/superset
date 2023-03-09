"use strict";(globalThis.webpackChunksuperset=globalThis.webpackChunksuperset||[]).push([[9502],{9433:(e,t,a)=>{a.d(t,{CronPicker:()=>u});var l=a(5872),n=a.n(l),r=(a(67294),a(70338)),o=a(55867),i=a(51995),s=a(61247),c=a(11965);const d={everyText:(0,o.t)("every"),emptyMonths:(0,o.t)("every month"),emptyMonthDays:(0,o.t)("every day of the month"),emptyMonthDaysShort:(0,o.t)("day of the month"),emptyWeekDays:(0,o.t)("every day of the week"),emptyWeekDaysShort:(0,o.t)("day of the week"),emptyHours:(0,o.t)("every hour"),emptyMinutes:(0,o.t)("every minute"),emptyMinutesForHourPeriod:(0,o.t)("every"),yearOption:(0,o.t)("year"),monthOption:(0,o.t)("month"),weekOption:(0,o.t)("week"),dayOption:(0,o.t)("day"),hourOption:(0,o.t)("hour"),minuteOption:(0,o.t)("minute"),rebootOption:(0,o.t)("reboot"),prefixPeriod:(0,o.t)("Every"),prefixMonths:(0,o.t)("in"),prefixMonthDays:(0,o.t)("on"),prefixWeekDays:(0,o.t)("on"),prefixWeekDaysForMonthAndYearPeriod:(0,o.t)("and"),prefixHours:(0,o.t)("at"),prefixMinutes:(0,o.t)(":"),prefixMinutesForHourPeriod:(0,o.t)("at"),suffixMinutesForHourPeriod:(0,o.t)("minute(s)"),errorInvalidCron:(0,o.t)("Invalid cron expression"),clearButtonText:(0,o.t)("Clear"),weekDays:[(0,o.t)("Sunday"),(0,o.t)("Monday"),(0,o.t)("Tuesday"),(0,o.t)("Wednesday"),(0,o.t)("Thursday"),(0,o.t)("Friday"),(0,o.t)("Saturday")],months:[(0,o.t)("January"),(0,o.t)("February"),(0,o.t)("March"),(0,o.t)("April"),(0,o.t)("May"),(0,o.t)("June"),(0,o.t)("July"),(0,o.t)("August"),(0,o.t)("September"),(0,o.t)("October"),(0,o.t)("November"),(0,o.t)("December")],altWeekDays:[(0,o.t)("SUN"),(0,o.t)("MON"),(0,o.t)("TUE"),(0,o.t)("WED"),(0,o.t)("THU"),(0,o.t)("FRI"),(0,o.t)("SAT")],altMonths:[(0,o.t)("JAN"),(0,o.t)("FEB"),(0,o.t)("MAR"),(0,o.t)("APR"),(0,o.t)("MAY"),(0,o.t)("JUN"),(0,o.t)("JUL"),(0,o.t)("AUG"),(0,o.t)("SEP"),(0,o.t)("OCT"),(0,o.t)("NOV"),(0,o.t)("DEC")]},u=(0,i.iK)((e=>(0,c.tZ)(r.ZP,{getPopupContainer:e=>e.parentElement},(0,c.tZ)(s.Z,n()({locale:d},e)))))`
  .react-js-cron-field {
    margin-bottom: 0px;
  }
  .react-js-cron-select:not(.react-js-cron-custom-select) > div:first-of-type,
  .react-js-cron-custom-select {
    border-radius: ${e=>{let{theme:t}=e;return t.gridUnit}}px;
    background-color: ${e=>{let{theme:t}=e;return t.colors.grayscale.light4}} !important;
  }
  .react-js-cron-custom-select > div:first-of-type {
    border-radius: ${e=>{let{theme:t}=e;return t.gridUnit}}px;
  }
  .react-js-cron-custom-select .ant-select-selection-placeholder {
    flex: auto;
  }
  .react-js-cron-custom-select .ant-select-selection-overflow-item {
    align-self: center;
  }
`},29848:(e,t,a)=>{a.d(t,{Z:()=>c}),a(67294);var l=a(51995),n=a(58593),r=a(70163),o=a(11965);const i=l.iK.span`
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
`,s=l.iK.span`
  color: ${e=>{let{theme:t}=e;return t.colors.grayscale.base}};
`;function c(e){let{actions:t}=e;return(0,o.tZ)(i,{className:"actions"},t.map(((e,t)=>{const a=r.Z[e.icon];return e.tooltip?(0,o.tZ)(n.u,{id:`${e.label}-tooltip`,title:e.tooltip,placement:e.placement,key:t},(0,o.tZ)(s,{role:"button",tabIndex:0,className:"action-button",onClick:e.onClick},(0,o.tZ)(a,null))):(0,o.tZ)(s,{role:"button",tabIndex:0,className:"action-button",onClick:e.onClick,key:t},(0,o.tZ)(a,null))})))}},73192:(e,t,a)=>{a.d(t,{r:()=>i}),a(67294);var l=a(51995),n=a(40987),r=a(11965);const o=(0,l.iK)(n.Z)`
  .ant-switch-checked {
    background-color: ${e=>{let{theme:t}=e;return t.colors.primary.base}};
  }
`,i=e=>(0,r.tZ)(o,e)},98978:(e,t,a)=>{a.d(t,{Z:()=>Z});var l=a(11965),n=a(67294),r=a(80008),o=a.n(r),i=a(55867),s=a(4715);const c="GMT Standard Time",d="400px",u={"-300-240":["Eastern Standard Time","Eastern Daylight Time"],"-360-300":["Central Standard Time","Central Daylight Time"],"-420-360":["Mountain Standard Time","Mountain Daylight Time"],"-420-420":["Mountain Standard Time - Phoenix","Mountain Standard Time - Phoenix"],"-480-420":["Pacific Standard Time","Pacific Daylight Time"],"-540-480":["Alaska Standard Time","Alaska Daylight Time"],"-600-600":["Hawaii Standard Time","Hawaii Daylight Time"],60120:["Central European Time","Central European Daylight Time"],"00":[c,c],"060":["GMT Standard Time - London","British Summer Time"]},p=o()(),m=o()([2021,1]),h=o()([2021,7]),T=e=>m.tz(e).utcOffset().toString()+h.tz(e).utcOffset().toString(),v=e=>{var t,a;const l=T(e);return(p.tz(e).isDST()?null==(t=u[l])?void 0:t[1]:null==(a=u[l])?void 0:a[0])||e},g=o().tz.countries().map((e=>o().tz.zonesForCountry(e,!0))).flat(),b=[];g.forEach((e=>{b.find((t=>T(t.name)===T(e.name)))||b.push(e)}));const _=b.map((e=>({label:`GMT ${o().tz(p,e.name).format("Z")} (${v(e.name)})`,value:e.name,offsets:T(e.name),timezoneName:e.name}))),E=(e,t)=>o().tz(p,e.timezoneName).utcOffset()-o().tz(p,t.timezoneName).utcOffset();function Z(e){let{onTimezoneChange:t,timezone:a,minWidth:r=d}=e;const c=(0,n.useMemo)((()=>(e=>{var t;return(null==(t=_.find((t=>t.offsets===T(e))))?void 0:t.value)||"Africa/Abidjan"})(a||o().tz.guess())),[a]);return(0,n.useEffect)((()=>{a!==c&&t(c)}),[c,t,a]),(0,l.tZ)(s.Ph,{ariaLabel:(0,i.t)("Timezone selector"),css:(0,l.iv)({minWidth:r},"",""),onChange:e=>t(e),value:c,options:_,sortComparator:E})}_.sort(E)},63082:(e,t,a)=>{a.r(t),a.d(t,{default:()=>xe});var l=a(78580),n=a.n(l),r=a(67294),o=a(16550),i=a(75049),s=a(55867),c=a(22102),d=a(51995),u=a(31069),p=a(30381),m=a.n(p),h=a(29848),T=a(34581),v=a(58593),g=a(18782),b=a(20755),_=a(73192),E=a(27600),Z=a(14114),f=a(46714),y=a(11965),N=a(70163),S=a(28745);const C=e=>y.iv`
  color: ${e.colors.grayscale.light1};
  margin-right: ${2*e.gridUnit}px;
`;function x(e){let{type:t}=e;const a={icon:null,label:""};switch(t){case S.u.Email:a.icon=(0,y.tZ)(N.Z.Email,{css:C}),a.label=S.u.Email;break;case S.u.Slack:a.icon=(0,y.tZ)(N.Z.Slack,{css:C}),a.label=S.u.Slack;break;default:a.icon=null,a.label=""}return a.icon?(0,y.tZ)(v.u,{title:a.label,placement:"bottom"},a.icon):null}var A=a(19259),D=a(17198);m().updateLocale("en",{calendar:{lastDay:"[Yesterday at] LTS",sameDay:"[Today at] LTS",nextDay:"[Tomorrow at] LTS",lastWeek:"[last] dddd [at] LTS",nextWeek:"dddd [at] LTS",sameElse:"L"}});const k=d.iK.span`
  color: ${e=>{let{theme:t}=e;return t.colors.grayscale.base}};
`,O=(0,d.iK)(N.Z.Refresh)`
  color: ${e=>{let{theme:t}=e;return t.colors.primary.base}};
  width: auto;
  height: ${e=>{let{theme:t}=e;return 5*t.gridUnit}}px;
  position: relative;
  top: ${e=>{let{theme:t}=e;return t.gridUnit}}px;
  left: ${e=>{let{theme:t}=e;return t.gridUnit}}px;
  cursor: pointer;
`,R=e=>{let{updatedAt:t,update:a}=e;const[l,n]=(0,r.useState)(m()(t));return(0,r.useEffect)((()=>{n((()=>m()(t)));const e=setInterval((()=>{n((()=>m()(t)))}),6e4);return()=>clearInterval(e)}),[t]),(0,y.tZ)(k,null,(0,s.t)("Last Updated %s",l.isValid()?l.calendar():"--"),a&&(0,y.tZ)(O,{onClick:a}))};var w=a(34858),I=a(40768),X=a(22318),$=a(15926),L=a.n($),M=a(74069),U=a(98978),P=a(87183),H=a(85633),z=a(91877),j=a(93185),G=a(4715),q=a(42878),W=a(1483),F=a(9882),V=a(9875),B=a(9433);const K=e=>{let{value:t,onChange:a}=e;const l=(0,d.Fg)(),n=(0,r.useRef)(null),[o,i]=(0,r.useState)("picker"),c=(0,r.useCallback)((e=>i(e.target.value)),[]),u=(0,r.useCallback)((e=>{var t;a(e),null==(t=n.current)||t.setValue(e)}),[n,a]),p=(0,r.useCallback)((e=>{a(e.target.value)}),[a]),m=(0,r.useCallback)((()=>{var e;a((null==(e=n.current)?void 0:e.input.value)||"")}),[a]),[h,T]=(0,r.useState)();return(0,y.tZ)(r.Fragment,null,(0,y.tZ)(P.Y.Group,{onChange:c,value:o},(0,y.tZ)("div",{className:"inline-container add-margin"},(0,y.tZ)(P.Y,{value:"picker"}),(0,y.tZ)(B.CronPicker,{clearButton:!1,value:t,setValue:u,disabled:"picker"!==o,displayError:"picker"===o,onError:T})),(0,y.tZ)("div",{className:"inline-container add-margin"},(0,y.tZ)(P.Y,{value:"input"}),(0,y.tZ)("span",{className:"input-label"},(0,s.t)("CRON Schedule")),(0,y.tZ)(ue,{className:"styled-input"},(0,y.tZ)("div",{className:"input-container"},(0,y.tZ)(V.II,{type:"text",name:"crontab",ref:n,style:h?{borderColor:l.colors.error.base}:{},placeholder:(0,s.t)("CRON expression"),disabled:"input"!==o,onBlur:p,onPressEnter:m}))))))},Y=d.iK.div`
  margin-bottom: 10px;

  .input-container {
    textarea {
      height: auto;
    }
  }

  .inline-container {
    margin-bottom: 10px;

    .input-container {
      margin-left: 10px;
    }

    > div {
      margin: 0;
    }

    .delete-button {
      margin-left: 10px;
      padding-top: 3px;
    }
  }
`,J=e=>{let{setting:t=null,index:a,onUpdate:l,onRemove:n}=e;const{method:o,recipients:i,options:c}=t||{},[u,p]=(0,r.useState)(i||""),m=(0,d.Fg)();return t?(i&&u!==i&&p(i),(0,y.tZ)(Y,null,(0,y.tZ)("div",{className:"inline-container"},(0,y.tZ)(ue,null,(0,y.tZ)("div",{className:"input-container"},(0,y.tZ)(G.Ph,{ariaLabel:(0,s.t)("Delivery method"),onChange:e=>{if(p(""),l){const n={...t,method:e,recipients:""};l(a,n)}},placeholder:(0,s.t)("Select Delivery Method"),options:(c||[]).map((e=>({label:e,value:e}))),value:o}))),void 0!==o&&n?(0,y.tZ)("span",{role:"button",tabIndex:0,className:"delete-button",onClick:()=>n(a)},(0,y.tZ)(N.Z.Trash,{iconColor:m.colors.grayscale.base})):null),void 0!==o?(0,y.tZ)(ue,null,(0,y.tZ)("div",{className:"control-label"},(0,s.t)(o)),(0,y.tZ)("div",{className:"input-container"},(0,y.tZ)("textarea",{name:"recipients",value:u,onChange:e=>{const{target:n}=e;if(p(n.value),l){const e={...t,recipients:n.value};l(a,e)}}})),(0,y.tZ)("div",{className:"helper"},(0,s.t)('Recipients are separated by "," or ";"'))):null)):null},Q=["pivot_table","pivot_table_v2","table","paired_ttest"],ee=["Email"],te="PNG",ae=[{label:(0,s.t)("< (Smaller than)"),value:"<"},{label:(0,s.t)("> (Larger than)"),value:">"},{label:(0,s.t)("<= (Smaller or equal)"),value:"<="},{label:(0,s.t)(">= (Larger or equal)"),value:">="},{label:(0,s.t)("== (Is equal)"),value:"=="},{label:(0,s.t)("!= (Is not equal)"),value:"!="},{label:(0,s.t)("Not null"),value:"not null"}],le=[{label:(0,s.t)("None"),value:0},{label:(0,s.t)("30 days"),value:30},{label:(0,s.t)("60 days"),value:60},{label:(0,s.t)("90 days"),value:90}],ne="0 * * * *",re={active:!0,creation_method:"alerts_reports",crontab:ne,log_retention:90,working_timeout:3600,name:"",owners:[],recipients:[],sql:"",validator_config_json:{},validator_type:"",force_screenshot:!1,grace_period:void 0},oe=(0,d.iK)(M.Z)`
  max-width: 1200px;
  width: 100%;

  .ant-modal-body {
    overflow: initial;
  }
`,ie=e=>y.iv`
  margin: auto ${2*e.gridUnit}px auto 0;
  color: ${e.colors.grayscale.base};
`,se=d.iK.div`
  display: flex;
  flex-direction: column;

  .control-label {
    margin-top: ${e=>{let{theme:t}=e;return t.gridUnit}}px;
  }

  .header-section {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    width: 100%;
    padding: ${e=>{let{theme:t}=e;return 4*t.gridUnit}}px;
    border-bottom: 1px solid ${e=>{let{theme:t}=e;return t.colors.grayscale.light2}};
  }

  .column-section {
    display: flex;
    flex: 1 1 auto;

    .column {
      flex: 1 1 auto;
      min-width: calc(33.33% - ${e=>{let{theme:t}=e;return 8*t.gridUnit}}px);
      padding: ${e=>{let{theme:t}=e;return 4*t.gridUnit}}px;

      .async-select {
        margin: 10px 0 20px;
      }

      &.condition {
        border-right: 1px solid ${e=>{let{theme:t}=e;return t.colors.grayscale.light2}};
      }

      &.message {
        border-left: 1px solid ${e=>{let{theme:t}=e;return t.colors.grayscale.light2}};
      }
    }
  }

  .inline-container {
    display: flex;
    flex-direction: row;
    align-items: center;
    &.wrap {
      flex-wrap: wrap;
    }

    > div {
      flex: 1 1 auto;
    }

    &.add-margin {
      margin-bottom: 5px;
    }

    .styled-input {
      margin: 0 0 0 10px;

      input {
        flex: 0 0 auto;
      }
    }
  }
`,ce=d.iK.div`
  display: flex;
  align-items: center;
  margin: ${e=>{let{theme:t}=e;return 2*t.gridUnit}}px auto
    ${e=>{let{theme:t}=e;return 4*t.gridUnit}}px auto;

  h4 {
    margin: 0;
  }

  .required {
    margin-left: ${e=>{let{theme:t}=e;return t.gridUnit}}px;
    color: ${e=>{let{theme:t}=e;return t.colors.error.base}};
  }
`,de=d.iK.div`
  display: flex;
  align-items: center;
  margin-top: 10px;

  .switch-label {
    margin-left: 10px;
  }
`,ue=d.iK.div`
  flex: 1;
  margin-top: 0;

  .helper {
    display: block;
    color: ${e=>{let{theme:t}=e;return t.colors.grayscale.base}};
    font-size: ${e=>{let{theme:t}=e;return t.typography.sizes.s}}px;
    padding: ${e=>{let{theme:t}=e;return t.gridUnit}}px 0;
    text-align: left;
  }

  .required {
    margin-left: ${e=>{let{theme:t}=e;return t.gridUnit/2}}px;
    color: ${e=>{let{theme:t}=e;return t.colors.error.base}};
  }

  .input-container {
    display: flex;
    align-items: center;

    > div {
      width: 100%;
    }

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

  input[disabled] {
    color: ${e=>{let{theme:t}=e;return t.colors.grayscale.base}};
  }

  textarea {
    height: 300px;
    resize: none;
  }

  input::placeholder,
  textarea::placeholder {
    color: ${e=>{let{theme:t}=e;return t.colors.grayscale.light1}};
  }

  textarea,
  input[type='text'],
  input[type='number'] {
    padding: ${e=>{let{theme:t}=e;return t.gridUnit}}px
      ${e=>{let{theme:t}=e;return 2*t.gridUnit}}px;
    border-style: none;
    border: 1px solid ${e=>{let{theme:t}=e;return t.colors.grayscale.light2}};
    border-radius: ${e=>{let{theme:t}=e;return t.gridUnit}}px;

    &[name='description'] {
      flex: 1 1 auto;
    }
  }

  .input-label {
    margin-left: 10px;
  }
`,pe=(0,d.iK)(P.Y)`
  display: block;
  line-height: ${e=>{let{theme:t}=e;return 7*t.gridUnit}}px;
`,me=(0,d.iK)(P.Y.Group)`
  margin-left: ${e=>{let{theme:t}=e;return 5.5*t.gridUnit}}px;
`,he=(0,d.iK)(G.r4)`
  margin-left: ${e=>{let{theme:t}=e;return 5.5*t.gridUnit}}px;
  margin-top: ${e=>{let{theme:t}=e;return t.gridUnit}}px;
`,Te=d.iK.div`
  color: ${e=>{let{theme:t}=e;return t.colors.primary.dark1}};
  cursor: pointer;

  i {
    margin-right: ${e=>{let{theme:t}=e;return 2*t.gridUnit}}px;
  }

  &.disabled {
    color: ${e=>{let{theme:t}=e;return t.colors.grayscale.light1}};
    cursor: default;
  }
`,ve=d.iK.div`
  .inline-container .input-container {
    margin-left: 0;
  }
`,ge=e=>y.iv`
    margin-right: ${3*e.gridUnit}px;
  `,be={ADD_NOTIFICATION_METHOD_TEXT:(0,s.t)("Add notification method"),ADD_DELIVERY_METHOD_TEXT:(0,s.t)("Add delivery method"),SAVE_TEXT:(0,s.t)("Save"),ADD_TEXT:(0,s.t)("Add"),EDIT_REPORT_TEXT:(0,s.t)("Edit Report"),EDIT_ALERT_TEXT:(0,s.t)("Edit Alert"),ADD_REPORT_TEXT:(0,s.t)("Add Report"),ADD_ALERT_TEXT:(0,s.t)("Add Alert"),REPORT_NAME_TEXT:(0,s.t)("Report name"),ALERT_NAME_TEXT:(0,s.t)("Alert name"),OWNERS_TEXT:(0,s.t)("Owners"),DESCRIPTION_TEXT:(0,s.t)("Description"),ACTIVE_TEXT:(0,s.t)("Active"),ALERT_CONDITION_TEXT:(0,s.t)("Alert condition"),DATABASE_TEXT:(0,s.t)("Database"),SQL_QUERY_TEXT:(0,s.t)("SQL Query"),TRIGGER_ALERT_IF_TEXT:(0,s.t)("Trigger Alert If..."),CONDITION_TEXT:(0,s.t)("Condition"),VALUE_TEXT:(0,s.t)("Value"),VALUE_TOOLTIP:(0,s.t)("Threshold value should be double precision number"),REPORT_SCHEDULE_TEXT:(0,s.t)("Report schedule"),ALERT_CONDITION_SCHEDULE_TEXT:(0,s.t)("Alert condition schedule"),TIMEZONE_TEXT:(0,s.t)("Timezone"),SCHEDULE_SETTINGS_TEXT:(0,s.t)("Schedule settings"),LOG_RETENTION_TEXT:(0,s.t)("Log retention"),WORKING_TIMEOUT_TEXT:(0,s.t)("Working timeout"),TIME_IN_SECONDS_TEXT:(0,s.t)("Time in seconds"),SECONDS_TEXT:(0,s.t)("seconds"),GRACE_PERIOD_TEXT:(0,s.t)("Grace period"),MESSAGE_CONTENT_TEXT:(0,s.t)("Message content"),DASHBOARD_TEXT:(0,s.t)("Dashboard"),CHART_TEXT:(0,s.t)("Chart"),SEND_AS_PNG_TEXT:(0,s.t)("Send as PNG"),SEND_AS_CSV_TEXT:(0,s.t)("Send as CSV"),SEND_AS_TEXT:(0,s.t)("Send as text"),IGNORE_CACHE_TEXT:(0,s.t)("Ignore cache when generating screenshot"),NOTIFICATION_METHOD_TEXT:(0,s.t)("Notification method")},_e=e=>{let{status:t="active",onClick:a}=e;return"hidden"===t?null:(0,y.tZ)(Te,{className:t,onClick:()=>{"disabled"!==t&&a()}},(0,y.tZ)("i",{className:"fa fa-plus"})," ","active"===t?be.ADD_NOTIFICATION_METHOD_TEXT:be.ADD_DELIVERY_METHOD_TEXT)},Ee=(0,Z.ZP)((e=>{var t,a,l,o,i,c,d,p;let{addDangerToast:m,onAdd:h,onHide:T,show:v,alert:g=null,isReport:b=!1,addSuccessToast:E}=e;const Z=(0,W.c)(),f=(null==Z?void 0:Z.ALERT_REPORTS_NOTIFICATION_METHODS)||ee,[S,C]=(0,r.useState)(!0),[x,A]=(0,r.useState)(),[D,k]=(0,r.useState)(!0),[O,R]=(0,r.useState)("dashboard"),[I,X]=(0,r.useState)(te),[$,M]=(0,r.useState)(!1),[V,B]=(0,r.useState)(!1),[Y,Te]=(0,r.useState)([]),[Ee,Ze]=(0,r.useState)([]),[fe,ye]=(0,r.useState)([]),[Ne,Se]=(0,r.useState)(""),Ce=null!==g,xe="chart"===O&&((0,z.cr)(j.T.ALERTS_ATTACH_REPORTS)||b),[Ae,De]=(0,r.useState)("active"),[ke,Oe]=(0,r.useState)([]),Re=(e,t)=>{const a=ke.slice();a[e]=t,Oe(a),void 0!==t.method&&"hidden"!==Ae&&De("active")},we=e=>{const t=ke.slice();t.splice(e,1),Oe(t),De("active")},{state:{loading:Ie,resource:Xe,error:$e},fetchResource:Le,createResource:Me,updateResource:Ue,clearError:Pe}=(0,w.LE)("report",(0,s.t)("report"),m),He=()=>{Pe(),k(!0),T(),Oe([]),A({...re}),De("active")},ze=(0,r.useMemo)((()=>function(e,t,a){void 0===e&&(e="");const l=L().encode({filter:e,page:t,page_size:a});return u.Z.get({endpoint:`/api/v1/report/related/created_by?q=${l}`}).then((e=>({data:e.json.result.map((e=>({value:e.value,label:e.text}))),totalCount:e.json.count})))}),[]),je=(0,r.useCallback)((e=>{const t=e||(null==x?void 0:x.database);if(!t||t.label)return null;let a;return Y.forEach((e=>{e.value!==t.value&&e.value!==t.id||(a=e)})),a}),[null==x?void 0:x.database,Y]),Ge=(e,t)=>{A((a=>({...a,[e]:t})))},qe=(0,r.useMemo)((()=>function(e,t,a){void 0===e&&(e="");const l=L().encode({filter:e,page:t,page_size:a});return u.Z.get({endpoint:`/api/v1/report/related/database?q=${l}`}).then((e=>{const t=e.json.result.map((e=>({value:e.value,label:e.text})));return Te(t),{data:t,totalCount:e.json.count}}))}),[]),We=(null==x?void 0:x.database)&&!x.database.label;(0,r.useEffect)((()=>{We&&Ge("database",je())}),[We,je]);const Fe=(0,r.useMemo)((()=>function(e,t,a){void 0===e&&(e="");const l=L().encode_uri({filter:e,page:t,page_size:a});return u.Z.get({endpoint:`/api/v1/report/related/dashboard?q=${l}`}).then((e=>{const t=e.json.result.map((e=>({value:e.value,label:e.text})));return Ze(t),{data:t,totalCount:e.json.count}}))}),[]),Ve=e=>{const t=e||(null==x?void 0:x.dashboard);if(!t||t.label)return null;let a;return Ee.forEach((e=>{e.value!==t.value&&e.value!==t.id||(a=e)})),a},Be=(0,r.useCallback)((e=>{const t=e||(null==x?void 0:x.chart);if(!t||t.label)return null;let a;return fe.forEach((e=>{e.value!==t.value&&e.value!==t.id||(a=e)})),a}),[fe,null==x?void 0:x.chart]),Ke=(null==x?void 0:x.chart)&&!(null!=x&&x.chart.label);(0,r.useEffect)((()=>{Ke&&Ge("chart",Be())}),[Be,Ke]);const Ye=(0,r.useMemo)((()=>function(e,t,a){void 0===e&&(e="");const l=L().encode_uri({filter:e,page:t,page_size:a});return u.Z.get({endpoint:`/api/v1/report/related/chart?q=${l}`}).then((e=>{const t=e.json.result.map((e=>({value:e.value,label:e.text})));return ye(t),{data:t,totalCount:e.json.count}}))}),[]),Je=e=>{const{target:t}=e;Ge(t.name,t.value)},Qe=e=>{const{target:t}=e,a=+t.value;Ge(t.name,0===a?null:a?Math.max(a,1):a)};(0,r.useEffect)((()=>{if(Ce&&(null==x||!x.id||(null==g?void 0:g.id)!==x.id||D&&v)){if(null!==(null==g?void 0:g.id)&&!Ie&&!$e){const e=g.id||0;Le(e)}}else!Ce&&(!x||x.id||D&&v)&&(A({...re}),Oe([]),De("active"))}),[g]),(0,r.useEffect)((()=>{if(Xe){const e=(Xe.recipients||[]).map((e=>{const t="string"==typeof e.recipient_config_json?JSON.parse(e.recipient_config_json):{};return{method:e.type,recipients:t.target||e.recipient_config_json,options:f}}));Oe(e),De(e.length===f.length?"hidden":"active"),R(Xe.chart?"chart":"dashboard"),X(Xe.chart&&Xe.report_format||te);const t="string"==typeof Xe.validator_config_json?JSON.parse(Xe.validator_config_json):Xe.validator_config_json;B("not null"===Xe.validator_type),Xe.chart&&Se(Xe.chart.viz_type),M(Xe.force_screenshot),A({...Xe,chart:Xe.chart?Be(Xe.chart)||{value:Xe.chart.id,label:Xe.chart.slice_name}:void 0,dashboard:Xe.dashboard?Ve(Xe.dashboard)||{value:Xe.dashboard.id,label:Xe.dashboard.dashboard_title}:void 0,database:Xe.database?je(Xe.database)||{value:Xe.database.id,label:Xe.database.database_name}:void 0,owners:((null==g?void 0:g.owners)||[]).map((e=>({value:e.value||e.id,label:e.label||`${e.first_name} ${e.last_name}`}))),validator_config_json:"not null"===Xe.validator_type?{op:"not null"}:t})}}),[Xe]);const et=x||{};return(0,r.useEffect)((()=>{var e,t,a,l,n,r;null!=x&&null!=(e=x.name)&&e.length&&null!=x&&null!=(t=x.owners)&&t.length&&null!=x&&null!=(a=x.crontab)&&a.length&&void 0!==(null==x?void 0:x.working_timeout)&&("dashboard"===O&&null!=x&&x.dashboard||"chart"===O&&null!=x&&x.chart)&&(()=>{if(!ke.length)return!1;let e=!1;return ke.forEach((t=>{var a;t.method&&null!=(a=t.recipients)&&a.length&&(e=!0)})),e})()&&(b||x.database&&null!=(l=x.sql)&&l.length&&(V||null!=(n=x.validator_config_json)&&n.op)&&(V||void 0!==(null==(r=x.validator_config_json)?void 0:r.threshold)))?C(!1):C(!0)}),[et.name,et.owners,et.database,et.sql,et.validator_config_json,et.crontab,et.working_timeout,et.dashboard,et.chart,O,ke,V]),D&&v&&k(!1),(0,y.tZ)(oe,{className:"no-content-padding",responsive:!0,disablePrimaryButton:S,onHandledPrimaryAction:()=>{var e,t,a;const l=[];ke.forEach((e=>{e.method&&e.recipients.length&&l.push({recipient_config_json:{target:e.recipients},type:e.method})}));const n="chart"===O&&!b,r={...x,type:b?(0,s.t)("Report"):(0,s.t)("Alert"),force_screenshot:n||$,validator_type:V?"not null":"operator",validator_config_json:V?{}:null==x?void 0:x.validator_config_json,chart:"chart"===O?null==x||null==(e=x.chart)?void 0:e.value:null,dashboard:"dashboard"===O?null==x||null==(t=x.dashboard)?void 0:t.value:null,database:null==x||null==(a=x.database)?void 0:a.value,owners:((null==x?void 0:x.owners)||[]).map((e=>e.value||e.id)),recipients:l,report_format:"dashboard"===O?te:I||te};if(r.recipients&&!r.recipients.length&&delete r.recipients,r.context_markdown="string",Ce){if(null!=x&&x.id){const e=x.id;delete r.id,delete r.created_by,delete r.last_eval_dttm,delete r.last_state,delete r.last_value,delete r.last_value_row_json,Ue(e,r).then((e=>{e&&(E((0,s.t)("%s updated",r.type)),h&&h(),He())}))}}else x&&Me(r).then((e=>{e&&(E((0,s.t)("%s updated",r.type)),h&&h(e),He())}))},onHide:He,primaryButtonName:Ce?be.SAVE_TEXT:be.ADD_TEXT,show:v,width:"100%",maxWidth:"1450px",title:(0,y.tZ)("h4",null,Ce?(0,y.tZ)(N.Z.EditAlt,{css:ie}):(0,y.tZ)(N.Z.PlusLarge,{css:ie}),Ce&&b?be.EDIT_REPORT_TEXT:Ce?be.EDIT_ALERT_TEXT:b?be.ADD_REPORT_TEXT:be.ADD_ALERT_TEXT)},(0,y.tZ)(se,null,(0,y.tZ)("div",{className:"header-section"},(0,y.tZ)(ue,null,(0,y.tZ)("div",{className:"control-label"},b?be.REPORT_NAME_TEXT:be.ALERT_NAME_TEXT,(0,y.tZ)("span",{className:"required"},"*")),(0,y.tZ)("div",{className:"input-container"},(0,y.tZ)("input",{type:"text",name:"name",value:x?x.name:"",placeholder:b?be.REPORT_NAME_TEXT:be.ALERT_NAME_TEXT,onChange:Je,css:ge}))),(0,y.tZ)(ue,null,(0,y.tZ)("div",{className:"control-label"},be.OWNERS_TEXT,(0,y.tZ)("span",{className:"required"},"*")),(0,y.tZ)("div",{className:"input-container"},(0,y.tZ)(G.qb,{ariaLabel:be.OWNERS_TEXT,allowClear:!0,name:"owners",mode:"multiple",value:(null==x?void 0:x.owners)||[],options:ze,onChange:e=>{Ge("owners",e||[])},css:ge}))),(0,y.tZ)(ue,null,(0,y.tZ)("div",{className:"control-label"},be.DESCRIPTION_TEXT),(0,y.tZ)("div",{className:"input-container"},(0,y.tZ)("input",{type:"text",name:"description",value:x&&x.description||"",placeholder:be.DESCRIPTION_TEXT,onChange:Je,css:ge}))),(0,y.tZ)(de,null,(0,y.tZ)(_.r,{onChange:e=>{Ge("active",e)},checked:!x||x.active}),(0,y.tZ)("div",{className:"switch-label"},be.ACTIVE_TEXT))),(0,y.tZ)("div",{className:"column-section"},!b&&(0,y.tZ)("div",{className:"column condition"},(0,y.tZ)(ce,null,(0,y.tZ)("h4",null,be.ALERT_CONDITION_TEXT)),(0,y.tZ)(ue,null,(0,y.tZ)("div",{className:"control-label"},be.DATABASE_TEXT,(0,y.tZ)("span",{className:"required"},"*")),(0,y.tZ)("div",{className:"input-container"},(0,y.tZ)(G.qb,{ariaLabel:be.DATABASE_TEXT,name:"source",value:null!=x&&null!=(t=x.database)&&t.label&&null!=x&&null!=(a=x.database)&&a.value?{value:x.database.value,label:x.database.label}:void 0,options:qe,onChange:e=>{Ge("database",e||[])}}))),(0,y.tZ)(ue,null,(0,y.tZ)("div",{className:"control-label"},be.SQL_QUERY_TEXT,(0,y.tZ)("span",{className:"required"},"*")),(0,y.tZ)(q.Z,{name:"sql",language:"sql",offerEditInModal:!1,minLines:15,maxLines:15,onChange:e=>{Ge("sql",e||"")},readOnly:!1,initialValue:null==Xe?void 0:Xe.sql,key:null==x?void 0:x.id})),(0,y.tZ)("div",{className:"inline-container wrap"},(0,y.tZ)(ue,null,(0,y.tZ)("div",{className:"control-label",css:ge},be.TRIGGER_ALERT_IF_TEXT,(0,y.tZ)("span",{className:"required"},"*")),(0,y.tZ)("div",{className:"input-container"},(0,y.tZ)(G.Ph,{ariaLabel:be.CONDITION_TEXT,onChange:e=>{var t;B("not null"===e);const a={op:e,threshold:x?null==(t=x.validator_config_json)?void 0:t.threshold:void 0};Ge("validator_config_json",a)},placeholder:"Condition",value:(null==x||null==(l=x.validator_config_json)?void 0:l.op)||void 0,options:ae,css:ge}))),(0,y.tZ)(ue,null,(0,y.tZ)("div",{className:"control-label"},be.VALUE_TEXT," ",(0,y.tZ)(F.V,{tooltip:be.VALUE_TOOLTIP}),(0,y.tZ)("span",{className:"required"},"*")),(0,y.tZ)("div",{className:"input-container"},(0,y.tZ)("input",{type:"number",name:"threshold",disabled:V,value:void 0!==(null==x||null==(o=x.validator_config_json)?void 0:o.threshold)?x.validator_config_json.threshold:"",placeholder:be.VALUE_TEXT,onChange:e=>{var t;const{target:a}=e,l={op:x?null==(t=x.validator_config_json)?void 0:t.op:void 0,threshold:a.value};Ge("validator_config_json",l)}}))))),(0,y.tZ)("div",{className:"column schedule"},(0,y.tZ)(ce,null,(0,y.tZ)("h4",null,b?be.REPORT_SCHEDULE_TEXT:be.ALERT_CONDITION_SCHEDULE_TEXT),(0,y.tZ)("span",{className:"required"},"*")),(0,y.tZ)(K,{value:(null==x?void 0:x.crontab)||ne,onChange:e=>Ge("crontab",e)}),(0,y.tZ)("div",{className:"control-label"},be.TIMEZONE_TEXT),(0,y.tZ)("div",{className:"input-container",css:e=>(e=>y.iv`
  margin: ${3*e.gridUnit}px 0;
`)(e)},(0,y.tZ)(U.Z,{onTimezoneChange:e=>{Ge("timezone",e)},timezone:null==x?void 0:x.timezone,minWidth:"100%"})),(0,y.tZ)(ce,null,(0,y.tZ)("h4",null,be.SCHEDULE_SETTINGS_TEXT)),(0,y.tZ)(ue,null,(0,y.tZ)("div",{className:"control-label"},be.LOG_RETENTION_TEXT,(0,y.tZ)("span",{className:"required"},"*")),(0,y.tZ)("div",{className:"input-container"},(0,y.tZ)(G.Ph,{ariaLabel:be.LOG_RETENTION_TEXT,placeholder:be.LOG_RETENTION_TEXT,onChange:e=>{Ge("log_retention",e)},value:"number"==typeof(null==x?void 0:x.log_retention)?null==x?void 0:x.log_retention:90,options:le,sortComparator:(0,H.mj)("value")}))),(0,y.tZ)(ue,null,(0,y.tZ)("div",{className:"control-label"},be.WORKING_TIMEOUT_TEXT,(0,y.tZ)("span",{className:"required"},"*")),(0,y.tZ)("div",{className:"input-container"},(0,y.tZ)("input",{type:"number",min:"1",name:"working_timeout",value:(null==x?void 0:x.working_timeout)||"",placeholder:be.TIME_IN_SECONDS_TEXT,onChange:Qe}),(0,y.tZ)("span",{className:"input-label"},be.SECONDS_TEXT))),!b&&(0,y.tZ)(ue,null,(0,y.tZ)("div",{className:"control-label"},be.GRACE_PERIOD_TEXT),(0,y.tZ)("div",{className:"input-container"},(0,y.tZ)("input",{type:"number",min:"1",name:"grace_period",value:(null==x?void 0:x.grace_period)||"",placeholder:be.TIME_IN_SECONDS_TEXT,onChange:Qe}),(0,y.tZ)("span",{className:"input-label"},be.SECONDS_TEXT)))),(0,y.tZ)("div",{className:"column message"},(0,y.tZ)(ce,null,(0,y.tZ)("h4",null,be.MESSAGE_CONTENT_TEXT),(0,y.tZ)("span",{className:"required"},"*")),(0,y.tZ)(P.Y.Group,{onChange:e=>{const{target:t}=e;M(!1),setTimeout((()=>R(t.value)),200)},value:O},(0,y.tZ)(pe,{value:"dashboard"},be.DASHBOARD_TEXT),(0,y.tZ)(pe,{value:"chart"},be.CHART_TEXT)),"chart"===O?(0,y.tZ)(G.qb,{ariaLabel:be.CHART_TEXT,name:"chart",value:null!=x&&null!=(i=x.chart)&&i.label&&null!=x&&null!=(c=x.chart)&&c.value?{value:x.chart.value,label:x.chart.label}:void 0,options:Ye,onChange:e=>{(e=>{u.Z.get({endpoint:`/api/v1/chart/${e.value}`}).then((e=>Se(e.json.result.viz_type)))})(e),Ge("chart",e||void 0),Ge("dashboard",null)}}):(0,y.tZ)(G.qb,{ariaLabel:be.DASHBOARD_TEXT,name:"dashboard",value:null!=x&&null!=(d=x.dashboard)&&d.label&&null!=x&&null!=(p=x.dashboard)&&p.value?{value:x.dashboard.value,label:x.dashboard.label}:void 0,options:Fe,onChange:e=>{Ge("dashboard",e||void 0),Ge("chart",null)}}),xe&&(0,y.tZ)(r.Fragment,null,(0,y.tZ)("div",{className:"inline-container"},(0,y.tZ)(me,{onChange:e=>{const{target:t}=e;X(t.value)},value:I},(0,y.tZ)(pe,{value:"PNG"},be.SEND_AS_PNG_TEXT),(0,y.tZ)(pe,{value:"CSV"},be.SEND_AS_CSV_TEXT),n()(Q).call(Q,Ne)&&(0,y.tZ)(pe,{value:"TEXT"},be.SEND_AS_TEXT)))),(b||"dashboard"===O)&&(0,y.tZ)("div",{className:"inline-container"},(0,y.tZ)(he,{className:"checkbox",checked:$,onChange:e=>{M(e.target.checked)}},be.IGNORE_CACHE_TEXT)),(0,y.tZ)(ce,null,(0,y.tZ)("h4",null,be.NOTIFICATION_METHOD_TEXT),(0,y.tZ)("span",{className:"required"},"*")),ke.map(((e,t)=>(0,y.tZ)(ve,null,(0,y.tZ)(J,{setting:e,index:t,key:`NotificationMethod-${t}`,onUpdate:Re,onRemove:we})))),(0,y.tZ)(_e,{status:Ae,onClick:()=>{const e=ke.slice();e.push({recipients:"",options:f}),Oe(e),De(e.length===f.length?"hidden":"disabled")}})))))})),Ze=(0,i.I)(),fe={[S.Z.Success]:(0,s.t)("Success"),[S.Z.Working]:(0,s.t)("Working"),[S.Z.Error]:(0,s.t)("Error"),[S.Z.Noop]:(0,s.t)("Not triggered"),[S.Z.Grace]:(0,s.t)("On Grace")},ye=(0,c.Z)({requestType:"rison",method:"DELETE",endpoint:"/api/v1/report/"}),Ne=d.iK.div`
  width: 100%;
  padding: 0 ${e=>{let{theme:t}=e;return 4*t.gridUnit}}px
    ${e=>{let{theme:t}=e;return 3*t.gridUnit}}px;
  background-color: ${e=>{let{theme:t}=e;return t.colors.grayscale.light5}};
`,Se=d.iK.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  > *:first-child {
    margin-right: ${e=>{let{theme:t}=e;return t.gridUnit}}px;
  }
`,Ce=Ze.get("alertsreports.header.icon"),xe=(0,Z.ZP)((function(e){let{addDangerToast:t,isReportEnabled:a=!1,user:l,addSuccessToast:i}=e;const c=a?(0,s.t)("report"):(0,s.t)("alert"),d=a?(0,s.t)("reports"):(0,s.t)("alerts"),p=a?"Reports":"Alerts",Z=(0,r.useMemo)((()=>[{id:"type",operator:g.p.equals,value:a?"Report":"Alert"}]),[a]),{state:{loading:N,resourceCount:C,resourceCollection:k,bulkSelectEnabled:O,lastFetched:$},hasPerm:L,fetchData:M,setResourceCollection:U,refreshData:P,toggleBulkSelect:H}=(0,w.Yi)("report",(0,s.t)("reports"),t,!0,void 0,Z),{updateResource:z}=(0,w.LE)("report",(0,s.t)("reports"),t),[j,G]=(0,r.useState)(!1),[q,W]=(0,r.useState)(null),[F,V]=(0,r.useState)(null);function B(e){W(e),G(!0)}const K=L("can_write"),Y=L("can_write"),J=L("can_write");(0,r.useEffect)((()=>{O&&Y&&H()}),[a]);const Q=[{id:"name",desc:!0}],ee=(0,r.useCallback)(((e,t)=>{if(null!=e&&e.id){const a=e.id,l=[...k];U(l.map((a=>(null==a?void 0:a.id)===e.id?{...a,active:t}:a))),z(a,{active:t},!1,!1).then().catch((()=>U(l)))}}),[k,U,z]),te=(0,r.useMemo)((()=>[{Cell:e=>{let{row:{original:{last_state:t}}}=e;return(0,y.tZ)(f.Z,{state:t,isReportEnabled:a})},accessor:"last_state",size:"xs",disableSortBy:!0},{Cell:e=>{let{row:{original:{last_eval_dttm:t}}}=e;return t?m().utc(t).local().format(E.v2):""},accessor:"last_eval_dttm",Header:(0,s.t)("Last run"),size:"lg"},{accessor:"name",Header:(0,s.t)("Name"),size:"xl"},{Header:(0,s.t)("Schedule"),accessor:"crontab_humanized",size:"xl",Cell:e=>{let{row:{original:{crontab_humanized:t="",timezone:a}}}=e;return(0,y.tZ)(v.u,{title:`${t} (${a})`,placement:"topLeft"},(0,y.tZ)("span",null,`${t} (${a})`))}},{Cell:e=>{let{row:{original:{recipients:t}}}=e;return t.map((e=>(0,y.tZ)(x,{key:e.id,type:e.type})))},accessor:"recipients",Header:(0,s.t)("Notification method"),disableSortBy:!0,size:"xl"},{Cell:e=>{let{row:{original:{created_by:t}}}=e;return t?`${t.first_name} ${t.last_name}`:""},Header:(0,s.t)("Created by"),id:"created_by",disableSortBy:!0,size:"xl"},{Cell:e=>{let{row:{original:{owners:t=[]}}}=e;return(0,y.tZ)(T.Z,{users:t})},Header:(0,s.t)("Owners"),id:"owners",disableSortBy:!0,size:"xl"},{Cell:e=>{let{row:{original:{changed_on_delta_humanized:t}}}=e;return(0,y.tZ)("span",{className:"no-wrap"},t)},Header:(0,s.t)("Modified"),accessor:"changed_on_delta_humanized",size:"xl"},{Cell:e=>{var t;let{row:{original:a}}=e;const r=n()(t=a.owners.map((e=>e.id))).call(t,l.userId)||(0,X.i5)(l);return(0,y.tZ)(_.r,{disabled:!r,checked:a.active,onClick:e=>ee(a,e),size:"small"})},Header:(0,s.t)("Active"),accessor:"active",id:"active",size:"xl"},{Cell:e=>{var t;let{row:{original:a}}=e;const r=(0,o.k6)(),i=n()(t=a.owners.map((e=>e.id))).call(t,l.userId)||(0,X.i5)(l),c=[K?{label:"execution-log-action",tooltip:(0,s.t)("Execution log"),placement:"bottom",icon:"Note",onClick:()=>r.push(`/${a.type.toLowerCase()}/${a.id}/log`)}:null,K?{label:i?"edit-action":"preview-action",tooltip:i?(0,s.t)("Edit"):(0,s.t)("View"),placement:"bottom",icon:i?"Edit":"Binoculars",onClick:()=>B(a)}:null,i&&Y?{label:"delete-action",tooltip:(0,s.t)("Delete"),placement:"bottom",icon:"Trash",onClick:()=>V(a)}:null].filter((e=>null!==e));return(0,y.tZ)(h.Z,{actions:c})},Header:(0,s.t)("Actions"),id:"actions",hidden:!K&&!Y,disableSortBy:!0,size:"xl"}]),[Y,K,a,ee]),ae=[];J&&ae.push({name:(0,y.tZ)(r.Fragment,null,(0,y.tZ)("i",{className:"fa fa-plus"})," ",c),buttonStyle:"primary",onClick:()=>{B(null)}}),Y&&ae.push({name:(0,s.t)("Bulk select"),onClick:H,buttonStyle:"secondary","data-test":"bulk-select-toggle"});const le={title:(0,s.t)("No %s yet",d),image:"filter-results.svg",buttonAction:()=>B(null),buttonText:J?(0,y.tZ)(r.Fragment,null,(0,y.tZ)("i",{className:"fa fa-plus"})," ",c," "):null},ne=(0,r.useMemo)((()=>[{Header:(0,s.t)("Owner"),key:"owner",id:"owners",input:"select",operator:g.p.relationManyMany,unfilteredLabel:(0,s.t)("All"),fetchSelects:(0,I.tm)("report","owners",(0,I.v$)((e=>(0,s.t)("An error occurred while fetching owners values: %s",e))),l),paginate:!0},{Header:(0,s.t)("Created by"),key:"created_by",id:"created_by",input:"select",operator:g.p.relationOneMany,unfilteredLabel:"All",fetchSelects:(0,I.tm)("report","created_by",(0,I.v$)((e=>(0,s.t)("An error occurred while fetching created by values: %s",e))),l),paginate:!0},{Header:(0,s.t)("Status"),key:"status",id:"last_state",input:"select",operator:g.p.equals,unfilteredLabel:"Any",selects:[{label:fe[S.Z.Success],value:S.Z.Success},{label:fe[S.Z.Working],value:S.Z.Working},{label:fe[S.Z.Error],value:S.Z.Error},{label:fe[S.Z.Noop],value:S.Z.Noop},{label:fe[S.Z.Grace],value:S.Z.Grace}]},{Header:(0,s.t)("Search"),key:"search",id:"name",input:"search",operator:g.p.contains}]),[]),re=Ce?(0,y.tZ)(Se,null,(0,y.tZ)("div",null,(0,s.t)("Alerts & reports")),(0,y.tZ)(Ce,null)):(0,s.t)("Alerts & reports");return(0,y.tZ)(r.Fragment,null,(0,y.tZ)(b.Z,{activeChild:p,name:re,tabs:[{name:"Alerts",label:(0,s.t)("Alerts"),url:"/alert/list/",usesRouter:!0,"data-test":"alert-list"},{name:"Reports",label:(0,s.t)("Reports"),url:"/report/list/",usesRouter:!0,"data-test":"report-list"}],buttons:ae},(0,y.tZ)(Ne,null,(0,y.tZ)(R,{updatedAt:$,update:()=>P()}))),(0,y.tZ)(Ee,{alert:q,addDangerToast:t,layer:q,onHide:()=>{G(!1),W(null),P()},show:j,isReport:a,key:(null==q?void 0:q.id)||`${(new Date).getTime()}`}),F&&(0,y.tZ)(D.Z,{description:(0,s.t)("This action will permanently delete %s.",F.name),onConfirm:()=>{F&&(e=>{let{id:a,name:l}=e;u.Z.delete({endpoint:`/api/v1/report/${a}`}).then((()=>{P(),V(null),i((0,s.t)("Deleted: %s",l))}),(0,I.v$)((e=>t((0,s.t)("There was an issue deleting %s: %s",l,e)))))})(F)},onHide:()=>V(null),open:!0,title:(0,s.t)("Delete %s?",c)}),(0,y.tZ)(A.Z,{title:(0,s.t)("Please confirm"),description:(0,s.t)("Are you sure you want to delete the selected %s?",d),onConfirm:async e=>{try{const{message:t}=await ye(e.map((e=>{let{id:t}=e;return t})));P(),i(t)}catch(e){(0,I.v$)((e=>t((0,s.t)("There was an issue deleting the selected %s: %s",d,e))))(e)}}},(e=>{const t=Y?[{key:"delete",name:(0,s.t)("Delete"),onSelect:e,type:"danger"}]:[];return(0,y.tZ)(g.Z,{className:"alerts-list-view",columns:te,count:C,data:k,emptyState:le,fetchData:M,filters:ne,initialSort:Q,loading:N,bulkActions:t,bulkSelectEnabled:O,disableBulkSelect:H,pageSize:25})})))}))},46714:(e,t,a)=>{a.d(t,{Z:()=>d});var l=a(51995),n=a(55867),r=(a(67294),a(58593)),o=a(70163),i=a(28745),s=a(11965);function c(e,t,a){switch(e){case i.Z.Working:return a.colors.primary.base;case i.Z.Error:return a.colors.error.base;case i.Z.Success:return t?a.colors.success.base:a.colors.alert.base;case i.Z.Noop:return a.colors.success.base;case i.Z.Grace:return a.colors.alert.base;default:return a.colors.grayscale.base}}function d(e){let{state:t,isReportEnabled:a=!1}=e;const d=(0,l.Fg)(),u={icon:o.Z.Check,label:"",status:""};switch(t){case i.Z.Success:u.icon=a?o.Z.Check:o.Z.AlertSolidSmall,u.label=a?(0,n.t)("Report sent"):(0,n.t)("Alert triggered, notification sent"),u.status=i.Z.Success;break;case i.Z.Working:u.icon=o.Z.Running,u.label=a?(0,n.t)("Report sending"):(0,n.t)("Alert running"),u.status=i.Z.Working;break;case i.Z.Error:u.icon=o.Z.XSmall,u.label=a?(0,n.t)("Report failed"):(0,n.t)("Alert failed"),u.status=i.Z.Error;break;case i.Z.Noop:u.icon=o.Z.Check,u.label=(0,n.t)("Nothing triggered"),u.status=i.Z.Noop;break;case i.Z.Grace:u.icon=o.Z.AlertSolidSmall,u.label=(0,n.t)("Alert Triggered, In Grace Period"),u.status=i.Z.Grace;break;default:u.icon=o.Z.Check,u.label=(0,n.t)("Nothing triggered"),u.status=i.Z.Noop}const p=u.icon;return(0,s.tZ)(r.u,{title:u.label,placement:"bottomLeft"},(0,s.tZ)(p,{iconColor:c(u.status,a,d)}))}},28745:(e,t,a)=>{var l,n;a.d(t,{Z:()=>l,u:()=>n}),function(e){e.Success="Success",e.Working="Working",e.Error="Error",e.Noop="Not triggered",e.Grace="On Grace"}(l||(l={})),function(e){e.Email="Email",e.Slack="Slack"}(n||(n={}))}}]);
//# sourceMappingURL=6f20f511aaf27f552c6a.chunk.js.map
