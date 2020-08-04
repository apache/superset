// Ideally, we would use
// https://html.spec.whatwg.org/multipage/rendering.html#the-css-user-agent-style-sheet-and-presentational-hints
// but for now, just use the version from blink. This file is copied from
// https://chromium.googlesource.com/chromium/blink/+/96aa3a280ab7d67178c8f122a04949ce5f8579e0/Source/core/css/html.css
// (removed a line which had octal literals inside since octal literals are not allowed in template strings)

// We use a .js file because otherwise we can't browserify this. (brfs is unusable due to lack of ES2015 support)

module.exports = `
/*
 * The default style sheet used to render HTML.
 *
 * Copyright (C) 2000 Lars Knoll (knoll@kde.org)
 * Copyright (C) 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011 Apple Inc. All rights reserved.
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Library General Public
 * License as published by the Free Software Foundation; either
 * version 2 of the License, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Library General Public License for more details.
 *
 * You should have received a copy of the GNU Library General Public License
 * along with this library; see the file COPYING.LIB.  If not, write to
 * the Free Software Foundation, Inc., 51 Franklin Street, Fifth Floor,
 * Boston, MA 02110-1301, USA.
 *
 */

@namespace "http://www.w3.org/1999/xhtml";

html {
    display: block
}

:root {
    scroll-blocks-on: start-touch wheel-event
}

/* children of the <head> element all have display:none */
head {
    display: none
}

meta {
    display: none
}

title {
    display: none
}

link {
    display: none
}

style {
    display: none
}

script {
    display: none
}

/* generic block-level elements */

body {
    display: block;
    margin: 8px
}

body:-webkit-full-page-media {
    background-color: rgb(0, 0, 0)
}

p {
    display: block;
    -webkit-margin-before: 1__qem;
    -webkit-margin-after: 1__qem;
    -webkit-margin-start: 0;
    -webkit-margin-end: 0;
}

div {
    display: block
}

layer {
    display: block
}

article, aside, footer, header, hgroup, main, nav, section {
    display: block
}

marquee {
    display: inline-block;
}

address {
    display: block
}

blockquote {
    display: block;
    -webkit-margin-before: 1__qem;
    -webkit-margin-after: 1em;
    -webkit-margin-start: 40px;
    -webkit-margin-end: 40px;
}

figcaption {
    display: block
}

figure {
    display: block;
    -webkit-margin-before: 1em;
    -webkit-margin-after: 1em;
    -webkit-margin-start: 40px;
    -webkit-margin-end: 40px;
}

q {
    display: inline
}

q:before {
    content: open-quote;
}

q:after {
    content: close-quote;
}

center {
    display: block;
    /* special centering to be able to emulate the html4/netscape behaviour */
    text-align: -webkit-center
}

hr {
    display: block;
    -webkit-margin-before: 0.5em;
    -webkit-margin-after: 0.5em;
    -webkit-margin-start: auto;
    -webkit-margin-end: auto;
    border-style: inset;
    border-width: 1px;
    box-sizing: border-box
}

map {
    display: inline
}

video {
    object-fit: contain;
}

/* heading elements */

h1 {
    display: block;
    font-size: 2em;
    -webkit-margin-before: 0.67__qem;
    -webkit-margin-after: 0.67em;
    -webkit-margin-start: 0;
    -webkit-margin-end: 0;
    font-weight: bold
}

:-webkit-any(article,aside,nav,section) h1 {
    font-size: 1.5em;
    -webkit-margin-before: 0.83__qem;
    -webkit-margin-after: 0.83em;
}

:-webkit-any(article,aside,nav,section) :-webkit-any(article,aside,nav,section) h1 {
    font-size: 1.17em;
    -webkit-margin-before: 1__qem;
    -webkit-margin-after: 1em;
}

:-webkit-any(article,aside,nav,section) :-webkit-any(article,aside,nav,section) :-webkit-any(article,aside,nav,section) h1 {
    font-size: 1.00em;
    -webkit-margin-before: 1.33__qem;
    -webkit-margin-after: 1.33em;
}

:-webkit-any(article,aside,nav,section) :-webkit-any(article,aside,nav,section) :-webkit-any(article,aside,nav,section) :-webkit-any(article,aside,nav,section) h1 {
    font-size: .83em;
    -webkit-margin-before: 1.67__qem;
    -webkit-margin-after: 1.67em;
}

:-webkit-any(article,aside,nav,section) :-webkit-any(article,aside,nav,section) :-webkit-any(article,aside,nav,section) :-webkit-any(article,aside,nav,section) :-webkit-any(article,aside,nav,section) h1 {
    font-size: .67em;
    -webkit-margin-before: 2.33__qem;
    -webkit-margin-after: 2.33em;
}

h2 {
    display: block;
    font-size: 1.5em;
    -webkit-margin-before: 0.83__qem;
    -webkit-margin-after: 0.83em;
    -webkit-margin-start: 0;
    -webkit-margin-end: 0;
    font-weight: bold
}

h3 {
    display: block;
    font-size: 1.17em;
    -webkit-margin-before: 1__qem;
    -webkit-margin-after: 1em;
    -webkit-margin-start: 0;
    -webkit-margin-end: 0;
    font-weight: bold
}

h4 {
    display: block;
    -webkit-margin-before: 1.33__qem;
    -webkit-margin-after: 1.33em;
    -webkit-margin-start: 0;
    -webkit-margin-end: 0;
    font-weight: bold
}

h5 {
    display: block;
    font-size: .83em;
    -webkit-margin-before: 1.67__qem;
    -webkit-margin-after: 1.67em;
    -webkit-margin-start: 0;
    -webkit-margin-end: 0;
    font-weight: bold
}

h6 {
    display: block;
    font-size: .67em;
    -webkit-margin-before: 2.33__qem;
    -webkit-margin-after: 2.33em;
    -webkit-margin-start: 0;
    -webkit-margin-end: 0;
    font-weight: bold
}

/* tables */

table {
    display: table;
    border-collapse: separate;
    border-spacing: 2px;
    border-color: gray
}

thead {
    display: table-header-group;
    vertical-align: middle;
    border-color: inherit
}

tbody {
    display: table-row-group;
    vertical-align: middle;
    border-color: inherit
}

tfoot {
    display: table-footer-group;
    vertical-align: middle;
    border-color: inherit
}

/* for tables without table section elements (can happen with XHTML or dynamically created tables) */
table > tr {
    vertical-align: middle;
}

col {
    display: table-column
}

colgroup {
    display: table-column-group
}

tr {
    display: table-row;
    vertical-align: inherit;
    border-color: inherit
}

td, th {
    display: table-cell;
    vertical-align: inherit
}

th {
    font-weight: bold
}

caption {
    display: table-caption;
    text-align: -webkit-center
}

/* lists */

ul, menu, dir {
    display: block;
    list-style-type: disc;
    -webkit-margin-before: 1__qem;
    -webkit-margin-after: 1em;
    -webkit-margin-start: 0;
    -webkit-margin-end: 0;
    -webkit-padding-start: 40px
}

ol {
    display: block;
    list-style-type: decimal;
    -webkit-margin-before: 1__qem;
    -webkit-margin-after: 1em;
    -webkit-margin-start: 0;
    -webkit-margin-end: 0;
    -webkit-padding-start: 40px
}

li {
    display: list-item;
    text-align: -webkit-match-parent;
}

ul ul, ol ul {
    list-style-type: circle
}

ol ol ul, ol ul ul, ul ol ul, ul ul ul {
    list-style-type: square
}

dd {
    display: block;
    -webkit-margin-start: 40px
}

dl {
    display: block;
    -webkit-margin-before: 1__qem;
    -webkit-margin-after: 1em;
    -webkit-margin-start: 0;
    -webkit-margin-end: 0;
}

dt {
    display: block
}

ol ul, ul ol, ul ul, ol ol {
    -webkit-margin-before: 0;
    -webkit-margin-after: 0
}

/* form elements */

form {
    display: block;
    margin-top: 0__qem;
}

label {
    cursor: default;
}

legend {
    display: block;
    -webkit-padding-start: 2px;
    -webkit-padding-end: 2px;
    border: none
}

fieldset {
    display: block;
    -webkit-margin-start: 2px;
    -webkit-margin-end: 2px;
    -webkit-padding-before: 0.35em;
    -webkit-padding-start: 0.75em;
    -webkit-padding-end: 0.75em;
    -webkit-padding-after: 0.625em;
    border: 2px groove ThreeDFace;
    min-width: -webkit-min-content;
}

button {
    -webkit-appearance: button;
}

/* Form controls don't go vertical. */
input, textarea, keygen, select, button, meter, progress {
    -webkit-writing-mode: horizontal-tb !important;
}

input, textarea, keygen, select, button {
    margin: 0__qem;
    font: -webkit-small-control;
    text-rendering: auto; /* FIXME: Remove when tabs work with optimizeLegibility. */
    color: initial;
    letter-spacing: normal;
    word-spacing: normal;
    line-height: normal;
    text-transform: none;
    text-indent: 0;
    text-shadow: none;
    display: inline-block;
    text-align: start;
}

input[type="hidden" i] {
    display: none
}

input {
    -webkit-appearance: textfield;
    padding: 1px;
    background-color: white;
    border: 2px inset;
    -webkit-rtl-ordering: logical;
    -webkit-user-select: text;
    cursor: auto;
}

input[type="search" i] {
    -webkit-appearance: searchfield;
    box-sizing: border-box;
}

input::-webkit-textfield-decoration-container {
    display: flex;
    align-items: center;
    -webkit-user-modify: read-only !important;
    content: none !important;
}

input[type="search" i]::-webkit-textfield-decoration-container {
    direction: ltr;
}

input::-webkit-clear-button {
    -webkit-appearance: searchfield-cancel-button;
    display: inline-block;
    flex: none;
    -webkit-user-modify: read-only !important;
    -webkit-margin-start: 2px;
    opacity: 0;
    pointer-events: none;
}

input:enabled:read-write:-webkit-any(:focus,:hover)::-webkit-clear-button {
    opacity: 1;
    pointer-events: auto;
}

input[type="search" i]::-webkit-search-cancel-button {
    -webkit-appearance: searchfield-cancel-button;
    display: block;
    flex: none;
    -webkit-user-modify: read-only !important;
    -webkit-margin-start: 1px;
    opacity: 0;
    pointer-events: none;
}

input[type="search" i]:enabled:read-write:-webkit-any(:focus,:hover)::-webkit-search-cancel-button {
    opacity: 1;
    pointer-events: auto;
}

input[type="search" i]::-webkit-search-decoration {
    -webkit-appearance: searchfield-decoration;
    display: block;
    flex: none;
    -webkit-user-modify: read-only !important;
    -webkit-align-self: flex-start;
    margin: auto 0;
}

input[type="search" i]::-webkit-search-results-decoration {
    -webkit-appearance: searchfield-results-decoration;
    display: block;
    flex: none;
    -webkit-user-modify: read-only !important;
    -webkit-align-self: flex-start;
    margin: auto 0;
}

input::-webkit-inner-spin-button {
    -webkit-appearance: inner-spin-button;
    display: inline-block;
    cursor: default;
    flex: none;
    align-self: stretch;
    -webkit-user-select: none;
    -webkit-user-modify: read-only !important;
    opacity: 0;
    pointer-events: none;
}

input:enabled:read-write:-webkit-any(:focus,:hover)::-webkit-inner-spin-button {
    opacity: 1;
    pointer-events: auto;
}

keygen, select {
    border-radius: 5px;
}

keygen::-webkit-keygen-select {
    margin: 0px;
}

textarea {
    -webkit-appearance: textarea;
    background-color: white;
    border: 1px solid;
    -webkit-rtl-ordering: logical;
    -webkit-user-select: text;
    flex-direction: column;
    resize: auto;
    cursor: auto;
    padding: 2px;
    white-space: pre-wrap;
    word-wrap: break-word;
}

::-webkit-input-placeholder {
    -webkit-text-security: none;
    color: darkGray;
    display: block !important;
    pointer-events: none !important;
}

input::-webkit-input-placeholder {
    white-space: pre;
    word-wrap: normal;
    overflow: hidden;
    -webkit-user-modify: read-only !important;
}

input[type="password" i] {
    -webkit-text-security: disc !important;
}

input[type="hidden" i], input[type="image" i], input[type="file" i] {
    -webkit-appearance: initial;
    padding: initial;
    background-color: initial;
    border: initial;
}

input[type="file" i] {
    align-items: baseline;
    color: inherit;
    text-align: start !important;
}

input:-webkit-autofill, textarea:-webkit-autofill, select:-webkit-autofill {
    background-color: #FAFFBD !important;
    background-image:none !important;
    color: #000000 !important;
}

input[type="radio" i], input[type="checkbox" i] {
    margin: 3px 0.5ex;
    padding: initial;
    background-color: initial;
    border: initial;
}

input[type="button" i], input[type="submit" i], input[type="reset" i] {
    -webkit-appearance: push-button;
    -webkit-user-select: none;
    white-space: pre
}

input[type="file" i]::-webkit-file-upload-button {
    -webkit-appearance: push-button;
    -webkit-user-modify: read-only !important;
    white-space: nowrap;
    margin: 0;
    font-size: inherit;
}

input[type="button" i], input[type="submit" i], input[type="reset" i], input[type="file" i]::-webkit-file-upload-button, button {
    align-items: flex-start;
    text-align: center;
    cursor: default;
    color: ButtonText;
    padding: 2px 6px 3px 6px;
    border: 2px outset ButtonFace;
    background-color: ButtonFace;
    box-sizing: border-box
}

input[type="range" i] {
    -webkit-appearance: slider-horizontal;
    padding: initial;
    border: initial;
    margin: 2px;
    color: #909090;
}

input[type="range" i]::-webkit-slider-container, input[type="range" i]::-webkit-media-slider-container {
    flex: 1;
    min-width: 0;
    box-sizing: border-box;
    -webkit-user-modify: read-only !important;
    display: flex;
}

input[type="range" i]::-webkit-slider-runnable-track {
    flex: 1;
    min-width: 0;
    -webkit-align-self: center;

    box-sizing: border-box;
    -webkit-user-modify: read-only !important;
    display: block;
}

input[type="range" i]::-webkit-slider-thumb, input[type="range" i]::-webkit-media-slider-thumb {
    -webkit-appearance: sliderthumb-horizontal;
    box-sizing: border-box;
    -webkit-user-modify: read-only !important;
    display: block;
}

input[type="button" i]:disabled, input[type="submit" i]:disabled, input[type="reset" i]:disabled,
input[type="file" i]:disabled::-webkit-file-upload-button, button:disabled,
select:disabled, keygen:disabled, optgroup:disabled, option:disabled,
select[disabled]>option {
    color: GrayText
}

input[type="button" i]:active, input[type="submit" i]:active, input[type="reset" i]:active, input[type="file" i]:active::-webkit-file-upload-button, button:active {
    border-style: inset
}

input[type="button" i]:active:disabled, input[type="submit" i]:active:disabled, input[type="reset" i]:active:disabled, input[type="file" i]:active:disabled::-webkit-file-upload-button, button:active:disabled {
    border-style: outset
}

option:-internal-spatial-navigation-focus {
    outline: black dashed 1px;
    outline-offset: -1px;
}

datalist {
    display: none
}

area {
    display: inline;
    cursor: pointer;
}

param {
    display: none
}

input[type="checkbox" i] {
    -webkit-appearance: checkbox;
    box-sizing: border-box;
}

input[type="radio" i] {
    -webkit-appearance: radio;
    box-sizing: border-box;
}

input[type="color" i] {
    -webkit-appearance: square-button;
    width: 44px;
    height: 23px;
    background-color: ButtonFace;
    /* Same as native_theme_base. */
    border: 1px #a9a9a9 solid;
    padding: 1px 2px;
}

input[type="color" i]::-webkit-color-swatch-wrapper {
    display:flex;
    padding: 4px 2px;
    box-sizing: border-box;
    -webkit-user-modify: read-only !important;
    width: 100%;
    height: 100%
}

input[type="color" i]::-webkit-color-swatch {
    background-color: #000000;
    border: 1px solid #777777;
    flex: 1;
    min-width: 0;
    -webkit-user-modify: read-only !important;
}

input[type="color" i][list] {
    -webkit-appearance: menulist;
    width: 88px;
    height: 23px
}

input[type="color" i][list]::-webkit-color-swatch-wrapper {
    padding-left: 8px;
    padding-right: 24px;
}

input[type="color" i][list]::-webkit-color-swatch {
    border-color: #000000;
}

input::-webkit-calendar-picker-indicator {
    display: inline-block;
    width: 0.66em;
    height: 0.66em;
    padding: 0.17em 0.34em;
    -webkit-user-modify: read-only !important;
    opacity: 0;
    pointer-events: none;
}

input::-webkit-calendar-picker-indicator:hover {
    background-color: #eee;
}

input:enabled:read-write:-webkit-any(:focus,:hover)::-webkit-calendar-picker-indicator,
input::-webkit-calendar-picker-indicator:focus {
    opacity: 1;
    pointer-events: auto;
}

input[type="date" i]:disabled::-webkit-clear-button,
input[type="date" i]:disabled::-webkit-inner-spin-button,
input[type="datetime-local" i]:disabled::-webkit-clear-button,
input[type="datetime-local" i]:disabled::-webkit-inner-spin-button,
input[type="month" i]:disabled::-webkit-clear-button,
input[type="month" i]:disabled::-webkit-inner-spin-button,
input[type="week" i]:disabled::-webkit-clear-button,
input[type="week" i]:disabled::-webkit-inner-spin-button,
input:disabled::-webkit-calendar-picker-indicator,
input[type="date" i][readonly]::-webkit-clear-button,
input[type="date" i][readonly]::-webkit-inner-spin-button,
input[type="datetime-local" i][readonly]::-webkit-clear-button,
input[type="datetime-local" i][readonly]::-webkit-inner-spin-button,
input[type="month" i][readonly]::-webkit-clear-button,
input[type="month" i][readonly]::-webkit-inner-spin-button,
input[type="week" i][readonly]::-webkit-clear-button,
input[type="week" i][readonly]::-webkit-inner-spin-button,
input[readonly]::-webkit-calendar-picker-indicator {
    visibility: hidden;
}

select {
    -webkit-appearance: menulist;
    box-sizing: border-box;
    align-items: center;
    border: 1px solid;
    white-space: pre;
    -webkit-rtl-ordering: logical;
    color: black;
    background-color: white;
    cursor: default;
}

select:not(:-internal-list-box) {
    overflow: visible !important;
}

select:-internal-list-box {
    -webkit-appearance: listbox;
    align-items: flex-start;
    border: 1px inset gray;
    border-radius: initial;
    overflow-x: hidden;
    overflow-y: scroll;
    vertical-align: text-bottom;
    -webkit-user-select: none;
    white-space: nowrap;
}

optgroup {
    font-weight: bolder;
    display: block;
}

option {
    font-weight: normal;
    display: block;
    padding: 0 2px 1px 2px;
    white-space: pre;
    min-height: 1.2em;
}

select:-internal-list-box option,
select:-internal-list-box optgroup {
    line-height: initial !important;
}

select:-internal-list-box:focus option:checked {
    background-color: -internal-active-list-box-selection !important;
    color: -internal-active-list-box-selection-text !important;
}

select:-internal-list-box option:checked {
    background-color: -internal-inactive-list-box-selection !important;
    color: -internal-inactive-list-box-selection-text !important;
}

select:-internal-list-box:disabled option:checked,
select:-internal-list-box option:checked:disabled {
    color: gray !important;
}

select:-internal-list-box hr {
    border-style: none;
}

output {
    display: inline;
}

/* meter */

meter {
    -webkit-appearance: meter;
    box-sizing: border-box;
    display: inline-block;
    height: 1em;
    width: 5em;
    vertical-align: -0.2em;
}

meter::-webkit-meter-inner-element {
    -webkit-appearance: inherit;
    box-sizing: inherit;
    -webkit-user-modify: read-only !important;
    height: 100%;
    width: 100%;
}

meter::-webkit-meter-bar {
    background: linear-gradient(to bottom, #ddd, #eee 20%, #ccc 45%, #ccc 55%, #ddd);
    height: 100%;
    width: 100%;
    -webkit-user-modify: read-only !important;
    box-sizing: border-box;
}

meter::-webkit-meter-optimum-value {
    background: linear-gradient(to bottom, #ad7, #cea 20%, #7a3 45%, #7a3 55%, #ad7);
    height: 100%;
    -webkit-user-modify: read-only !important;
    box-sizing: border-box;
}

meter::-webkit-meter-suboptimum-value {
    background: linear-gradient(to bottom, #fe7, #ffc 20%, #db3 45%, #db3 55%, #fe7);
    height: 100%;
    -webkit-user-modify: read-only !important;
    box-sizing: border-box;
}

meter::-webkit-meter-even-less-good-value {
    background: linear-gradient(to bottom, #f77, #fcc 20%, #d44 45%, #d44 55%, #f77);
    height: 100%;
    -webkit-user-modify: read-only !important;
    box-sizing: border-box;
}

/* progress */

progress {
    -webkit-appearance: progress-bar;
    box-sizing: border-box;
    display: inline-block;
    height: 1em;
    width: 10em;
    vertical-align: -0.2em;
}

progress::-webkit-progress-inner-element {
    -webkit-appearance: inherit;
    box-sizing: inherit;
    -webkit-user-modify: read-only;
    height: 100%;
    width: 100%;
}

progress::-webkit-progress-bar {
    background-color: gray;
    height: 100%;
    width: 100%;
    -webkit-user-modify: read-only !important;
    box-sizing: border-box;
}

progress::-webkit-progress-value {
    background-color: green;
    height: 100%;
    width: 50%; /* should be removed later */
    -webkit-user-modify: read-only !important;
    box-sizing: border-box;
}

/* inline elements */

u, ins {
    text-decoration: underline
}

strong, b {
    font-weight: bold
}

i, cite, em, var, address, dfn {
    font-style: italic
}

tt, code, kbd, samp {
    font-family: monospace
}

pre, xmp, plaintext, listing {
    display: block;
    font-family: monospace;
    white-space: pre;
    margin: 1__qem 0
}

mark {
    background-color: yellow;
    color: black
}

big {
    font-size: larger
}

small {
    font-size: smaller
}

s, strike, del {
    text-decoration: line-through
}

sub {
    vertical-align: sub;
    font-size: smaller
}

sup {
    vertical-align: super;
    font-size: smaller
}

nobr {
    white-space: nowrap
}

/* states */

:focus {
    outline: auto 5px -webkit-focus-ring-color
}

/* Read-only text fields do not show a focus ring but do still receive focus */
html:focus, body:focus, input[readonly]:focus {
    outline: none
}

applet:focus, embed:focus, iframe:focus, object:focus {
    outline: none
}

input:focus, textarea:focus, keygen:focus, select:focus {
    outline-offset: -2px
}

input[type="button" i]:focus,
input[type="checkbox" i]:focus,
input[type="file" i]:focus,
input[type="hidden" i]:focus,
input[type="image" i]:focus,
input[type="radio" i]:focus,
input[type="reset" i]:focus,
input[type="search" i]:focus,
input[type="submit" i]:focus,
input[type="file" i]:focus::-webkit-file-upload-button {
    outline-offset: 0
}

a:-webkit-any-link {
    color: -webkit-link;
    text-decoration: underline;
    cursor: auto;
}

a:-webkit-any-link:active {
    color: -webkit-activelink
}

/* HTML5 ruby elements */

ruby, rt {
    text-indent: 0; /* blocks used for ruby rendering should not trigger this */
}

rt {
    line-height: normal;
    -webkit-text-emphasis: none;
}

ruby > rt {
    display: block;
    font-size: 50%;
    text-align: start;
}

ruby > rp {
    display: none;
}

/* other elements */

noframes {
    display: none
}

frameset, frame {
    display: block
}

frameset {
    border-color: inherit
}

iframe {
    border: 2px inset
}

details {
    display: block
}

summary {
    display: block
}

summary::-webkit-details-marker {
    display: inline-block;
    width: 0.66em;
    height: 0.66em;
    -webkit-margin-end: 0.4em;
}

template {
    display: none
}

bdi, output {
    unicode-bidi: -webkit-isolate;
}

bdo {
    unicode-bidi: bidi-override;
}

textarea[dir=auto i] {
    unicode-bidi: -webkit-plaintext;
}

dialog:not([open]) {
    display: none
}

dialog {
    position: absolute;
    left: 0;
    right: 0;
    width: -webkit-fit-content;
    height: -webkit-fit-content;
    margin: auto;
    border: solid;
    padding: 1em;
    background: white;
    color: black
}

dialog::backdrop {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    background: rgba(0,0,0,0.1)
}

/* page */

@page {
    /* FIXME: Define the right default values for page properties. */
    size: auto;
    margin: auto;
    padding: 0px;
    border-width: 0px;
}

/* noscript is handled internally, as it depends on settings. */

`;
