# React-Select

## v1.2.1 / 2018-01-13

* Fixed blocking the Del key when deleteRemoves is false, thanks [Nachtigall, Jens (init)](https://github.com/jnachtigall) - [see PR](https://github.com/JedWatson/react-select/pull/2291)
* Fixed inline-block rendering for arrowRenderer without autosize, thanks [Harry Kao](https://github.com/harrykao) - [see PR](https://github.com/JedWatson/react-select/pull/2276)
* Fixed dropdown menu positioning issues in IE 11, thanks [jharris4](https://github.com/jharris4) - [see PR](https://github.com/JedWatson/react-select/pull/2273)
* Added missing rule to the `scss` stylesheet, thanks [Jordan Whitfield](https://github.com/mantissa7) - [see PR](https://github.com/JedWatson/react-select/pull/2280)

## v1.2.0 / 2018-01-08

* Source cleanup, thanks to [Yuri S](https://github.com/yuri-sakharov) and
	[Charles Lee](https://github.com/gwyneplaine) -
	[see PR](https://github.com/JedWatson/react-select/pull/2262)
* Switched from babel-preset-es2015 to babel-preset-env, thanks
	[Rambabu Yadlapalli](https://github.com/RamYadlapalli) -
	[see PR](https://github.com/JedWatson/react-select/pull/2254)
* Fixed focused option. Issue #2237, thanks
	[Yuri S](https://github.com/yuri-sakharov) -
	[see PR](https://github.com/JedWatson/react-select/pull/2245)
* Fix onSelectResetsInput bug from keyboard navigation, thanks
	[Charles Lee](https://github.com/gwyneplaine) -
	[see PR](https://github.com/JedWatson/react-select/pull/2259)
* Fixed all warnings on running tests, thanks
	[Yuri S](https://github.com/yuri-sakharov) -
	[see PR](https://github.com/JedWatson/react-select/pull/2231)
* Added missing tests for Option.js and refactored Option-test.js., thanks
	[Yuri S](https://github.com/yuri-sakharov) -
	[see PR](https://github.com/JedWatson/react-select/pull/2249)
* Added missing tests for Async.js, thanks
	[Yuri S](https://github.com/yuri-sakharov) -
	[see PR](https://github.com/JedWatson/react-select/pull/2250)
* Fixed console error in GitHub users example, thanks
	[Yuri S](https://github.com/yuri-sakharov) -
	[see PR](https://github.com/JedWatson/react-select/pull/2244)
* Fixed readme example. Issue #2235, thanks
	[Yuri S](https://github.com/yuri-sakharov) -
	[see PR](https://github.com/JedWatson/react-select/pull/2246)
* Regression fix for single select with onSelectResetsInput=false, thanks
	[Yuri S](https://github.com/yuri-sakharov) -
	[see PR](https://github.com/JedWatson/react-select/pull/2226)
* Pass placeholder prop to ValueComponent, thanks
	[Aravind Srivatsan](https://github.com/aravindsrivats) -
	[see PR](https://github.com/JedWatson/react-select/pull/2225)
* Refactored handleKeyDown switch, thanks
	[Yuri S](https://github.com/yuri-sakharov) -
	[see PR](https://github.com/JedWatson/react-select/pull/2228)
* onSelectResetsInput regression fixed, thanks
	[Jed Watson](https://github.com/dehamilton) -
	[see PR](https://github.com/JedWatson/react-select/pull/2215)
* Don't open drop down menu when clear values, thanks
	[Jed Watson](https://github.com/Chopinsky) -
	[see PR](https://github.com/JedWatson/react-select/pull/2198)
* Clear input value on receiving props with another value., thanks
	[Yuri S](https://github.com/yuri-sakharov) -
	[see PR](https://github.com/JedWatson/react-select/pull/2183)
* Fix/is option unique crash, thanks [Jacob Zuo](https://github.com/Chopinsky) -
	[see PR](https://github.com/JedWatson/react-select/pull/2185)
* Use react-input-autosize v2.1.2 for guard against undefined window, thanks
	[DStyleZ](https://github.com/sximba) -
	[see PR](https://github.com/JedWatson/react-select/pull/2187)
* Fix issue #2182, thanks [Kurt Hoyt](https://github.com/kurtinatlanta) -
	[see PR](https://github.com/JedWatson/react-select/pull/2213)
* Documenting behavior of onBlurResetsInput in the readme., thanks
	[hobbsl](https://github.com/levininja) -
	[see PR](https://github.com/JedWatson/react-select/pull/2212)
* Use onSelectResetsInput for single select, thanks
	[lachiet](https://github.com/lachiet) -
	[see PR](https://github.com/JedWatson/react-select/pull/2205)
* Fix state value in README example, thanks
	[Srishan Bhattarai](https://github.com/srishanbhattarai) -
	[see PR](https://github.com/JedWatson/react-select/pull/2192)
* document breaking change of removing getInputValue, thanks
	[Turadg Aleahmad](https://github.com/turadg) -
	[see PR](https://github.com/JedWatson/react-select/pull/2195)
* Fixed search for invalid label and/or value, thanks
	[Yuri S](https://github.com/yuri-sakharov) -
	[see PR](https://github.com/JedWatson/react-select/pull/2179)

## v1.1.0 / 2017-11-28

* added; more props are passed to the Option component: `focusOption`,
	`inputValue`, `selectValue`, `removeValue`
* added; the `inputValue` is passed as the third argument to the
	`optionRenderer`
* fixed; issues opening the menu correctly for multiselect when
	`autosize={false}`
* fixed; removed `event.stopPropagation()` from Select's `clearValue` and
	`onClick` handlers, thanks [Thomas Burke](https://github.com/etburke)
* fixed; `handleMouseDownOnArrow` when `openOnClick={false}`, thanks
	[elias ghali](https://github.com/elghali)
* fixed; conditional scrolling into view of focused option, thanks
	[Michael Lewis](https://github.com/mtlewis)

## v1.0.1 / 2017-11-24

* reintroduced source files for scss and less stylesheets into the npm package

## v1.0.0 / 2017-11-23

* breaking; removed `getInputValue` function -
	[see PR](https://github.com/JedWatson/react-select/pull/2108)
* reverted spacebar-selects-option behaviour for searchable selects, thanks
	[Charles Lee](https://github.com/gwyneplaine) -
	[see PR](https://github.com/JedWatson/react-select/pull/2163)
* fixed behaviour where async doesn't handle onInputChange returning a value,
	thanks [Anton](https://github.com/tehbi4) -
	[see PR](https://github.com/JedWatson/react-select/pull/2133)
* fixed Creatable bug where the first enter keypress is ignored when
	`promptTextCreator` returns only the label, thanks
	[George Karagkiaouris](https://github.com/karaggeorge) -
	[see PR](https://github.com/JedWatson/react-select/pull/2140)
* Utility functions are now exported from the es6 build, thanks
	[Deiru](https://github.com/Deiru2k) -
	[see PR](https://github.com/JedWatson/react-select/pull/2154)
* Update aria-only class to have absolute positioning, thanks
	[Jacob Hilker](https://github.com/JHilker) -
	[see PR](https://github.com/JedWatson/react-select/pull/1243)
* gives possibility to use ref property for Creatable, thanks
	[blacktemplar](https://github.com/blacktemplar) -
	[see PR](https://github.com/JedWatson/react-select/pull/1646)
* Adds lint and test pre-commit hooks, thanks
	[carymcpoland](https://github.com/mcpolandc) -
	[see PR](https://github.com/JedWatson/react-select/pull/2077)
* Disable some browser-specific behaviours that break the input, thanks
	[Jed Watson](https://github.com/JedWatson) -
	[see PR](https://github.com/JedWatson/react-select/pull/2101)
* onOpen: run after dom has rendered, thanks
	[Karl-Aksel Puulmann](https://github.com/macobo) -
	[see PR](https://github.com/JedWatson/react-select/pull/#1756)
* fix not clearing when given invalid values, from #1756, thanks
	[Mário][https://github.com/ticklemynausea] -
	[see PR](https://github.com/JedWatson/react-select/pull/2100)
* Exports Option Component, thanks
	[Erkelens, Jan Paul](https://github.com/jperkelens) -
	[see PR](https://github.com/JedWatson/react-select/pull/2097)
* Fix/numeric multi select, thanks
	[Charles Lee](https://github.com/gwyneplaine) -
	[see PR](https://github.com/JedWatson/react-select/pull/2086)
* removeSelected prop (round 2), for optionally keeping selected values in
	dropdown, thanks [Jed Watson](https://github.com/banderson) -
	[see PR](https://github.com/JedWatson/react-select/pull/1891)
* pass removeValue() and always pass valueArray, thanks
	[kcliu](https://github.com/kcliu) -
	[see PR](https://github.com/JedWatson/react-select/pull/1850)
* Accessibility Enhancements - Aria tags, Space/Enter keys, thanks
	[sushmabadam](https://github.com/sushmabadam) -
	[see PR](https://github.com/JedWatson/react-select/pull/1428)
* added rtl support, thanks [Dekel](https://github.com/dekelb) -
	[see PR](https://github.com/JedWatson/react-select/pull/1613)
* Add inputValue to menuRenderer, thanks
	[headcanon](https://github.com/chronick) -
	[see PR](https://github.com/JedWatson/react-select/pull/1732)
* fix typo in handleKeyDown method, thanks
	[jasonchangxo](https://github.com/jasonchangxo) -
	[see PR](https://github.com/JedWatson/react-select/pull/2088)
* Fix/numeric multi select, thanks
	[Charles Lee](https://github.com/gwyneplaine) -
	[see PR](https://github.com/JedWatson/react-select/pull/2086)
* expose children in AsyncCreatable.js, thanks
	[Charles Lee](https://github.com/gwyneplaine) -
	[see PR](https://github.com/JedWatson/react-select/pull/2084)
* replace trim fn loop with regex, thanks
	[Charles Lee](https://github.com/gwyneplaine) -
	[see PR](https://github.com/JedWatson/react-select/pull/2085)
* Trim search text from beginning and the end. (fixes #1861), thanks
	[Serkan Ozer](https://github.com/serkanozer) -
	[see PR](https://github.com/JedWatson/react-select/pull/1862)
* Add variable for focused input background, thanks
	[Aron Strandberg](https://github.com/aronstrandberg) -
	[see PR](https://github.com/JedWatson/react-select/pull/1998)
* Added id in the input select, thanks
	[thecreazy](https://github.com/thecreazy) -
	[see PR](https://github.com/JedWatson/react-select/pull/2027)
* adding a nvmrc file and adding coverage to eslintignore, thanks
	[Dave Birch](https://github.com/uxtx) -
	[see PR](https://github.com/JedWatson/react-select/pull/1137)
* Updated the comment for the deleteRemoves option., thanks
	[Abul Dider](https://github.com/dider7) -
	[see PR](https://github.com/JedWatson/react-select/pull/2078)
* implemented optional rendering of arrow, thanks
	[rolandjohann](https://github.com/rolandjohann) -
	[see PR](https://github.com/JedWatson/react-select/pull/1761)
* Skip rendering arrow wrapper when custom arrow renderer returns falsy value,
	thanks [Mike Lewis](https://github.com/mtlewis) -
	[see PR](https://github.com/JedWatson/react-select/pull/2055)
* do not show clear button if value is an empty string, thanks
	[Marie Godon](https://github.com/mariegodon) -
	[see PR](https://github.com/JedWatson/react-select/pull/2074)
* Set isLoading to false if cache hit, thanks
	[timhwang21](https://github.com/timhwang21) -
	[see PR](https://github.com/JedWatson/react-select/pull/2042)
* Add aria-labels to Options, thanks
	[jasonchangxo](https://github.com/jasonchangxo) -
	[see PR](https://github.com/JedWatson/react-select/pull/2036)
* Adds source links to each example, thanks
	[Damon Bauer](https://github.com/damonbauer) -
	[see PR](https://github.com/JedWatson/react-select/pull/2051)
* Issue #2056: onInputChange should return modified value, thanks
	[Caleb Scholze](https://github.com/cscholze) -
	[see PR](https://github.com/JedWatson/react-select/pull/2057)
* Remove option `addLabelText` from README and propTypes, thanks
	[Jannes Jeising](https://github.com/jjeising) -
	[see PR](https://github.com/JedWatson/react-select/pull/2040)
* GitHub has a capital H, thanks
	[David Baumgold](https://github.com/singingwolfboy) -
	[see PR](https://github.com/JedWatson/react-select/pull/2053)
* refactor componentWillUnmount(), thanks
	[riophae](https://github.com/riophae) -
	[see PR](https://github.com/JedWatson/react-select/pull/2064)
* Slim down NPM package, thanks [Valentin Agachi](https://github.com/avaly) -
	[see PR](https://github.com/JedWatson/react-select/pull/2062)
* Update contributing doc, thanks [Gregg Brewster](https://github.com/greggb) -
	[see PR](https://github.com/JedWatson/react-select/pull/2059)
* strip proptypes in production build (fixes #1882), thanks
	[Jochen Berger](https://github.com/jochenberger) -
	[see PR](https://github.com/JedWatson/react-select/pull/2003)
* Support Webpack 2, Webpack 3, rollup., thanks
	[Matthew Schnee](https://github.com/mschnee) -
	[see PR](https://github.com/JedWatson/react-select/pull/2020)
* Add missing semicolon, thanks
	[jochenberger](https://github.com/jochenberger) -
	[see PR](https://github.com/JedWatson/react-select/pull/2018)
* autofocus --> autoFocus, thanks
	[Charles Lee](https://github.com/gwyneplaine) -
	[see PR](https://github.com/JedWatson/react-select/pull/2002)
* Async> cache async response regardless of req order, thanks
	[Timothy Hwang](https://github.com/timhwang21) -
	[see PR](https://github.com/JedWatson/react-select/pull/2012)
* Make this work in preact., thanks [liaoxuezhi](https://github.com/2betop) -
	[see PR](https://github.com/JedWatson/react-select/pull/2013)
* Correct release candidate version on README, thanks
	[Damon Aw](https://github.com/daemonsy) -
	[see PR](https://github.com/JedWatson/react-select/pull/2017)
* Fix test name, thanks [jochenberger](https://github.com/jochenberger) -
	[see PR](https://github.com/JedWatson/react-select/pull/2005)
* Fixing css states to be scoped with Select selector, closes #1951., thanks
	[Adam Girton](https://github.com/agirton) -
	[see PR](https://github.com/JedWatson/react-select/pull/2000)
* fix typo, thanks [jochenberger](https://github.com/jochenberger) -
	[see PR](https://github.com/JedWatson/react-select/pull/1999)

## v1.0.0-rc.10 / 2017-09-13

* changed; `openAfterFocus` prop has been renamed to `openOnClick`, and now
	defaults to `true`
* fixed; React.PropTypes deprecation warning, thanks
	[Jeremy Liberman](https://github.com/MrLeebo)
* improved; scrolling behaviour when navigating the menu with the keyboard,
	thanks [boatkorachal](https://github.com/boatkorachal)
* fixed; error with the `Async` cache when you type `"hasOwnProperty"`, thanks
	[SuhushinAS](https://github.com/SuhushinAS)

## v1.0.0-rc.9 / 2017-09-13

* fixed; clearable padding style, thanks
	[Minori Miyauchi](https://github.com/mmiyauchi)
* fixed; removed use of `Object.assign`, fixes IE compatibility
* added; new `closeOnSelect` prop (defaults to `true`) that controls whether the
	menu is closed when an option is selected, thanks to
	[Michael Elgar](https://github.com/melgar) for the original idea
* changed; by default, the menu for multi-selects now closes when an option is
	selected
* changed; `Async` component no longer always clears options when one is
	selected (although the menu is now closed by default). Use
	`closeOnSelect={false} onSelectResetsInput={false}` to leave the menu open.
* fixed; `Async` component always called `onChange` even when it wasn't provided
* fixed; input lag for the `Async` component when results are returned from
	cache
* fixed; required was not being updated without an onChange handler
* fixed; peer dependencies for `prop-types`, thanks
	[Michaël De Boey](https://github.com/MichaelDeBoey)
* fixed; internal optimisations, thanks
	[Kieran Boyle](https://github.com/dysfunc)
* added; `Value` component is now exported, thanks
	[Prof Gra](https://github.com/Grahack)
* fixed; callback fired after `Async` component unmounts, thanks
	[Andrew Russell](https://github.com/DeadHeadRussell)
* fixed; wrapping on Firefox in SCSS files, thanks
	[Michael Williamson](https://github.com/mwilliamson)

## v1.0.0-rc.8 / 2017-09-12

* fixed; `onMenuScrollToBottom` does not work in chrome 58.0, thanks
	[Simon Hartcher](https://github.com/deevus)
* fixed; missing es6 module build for `js:next` entrypoint
* updated; `react-input-autosize@2.0.0` including several fixes for react-select
	(see
	[changes](https://github.com/JedWatson/react-input-autosize/blob/master/HISTORY.md))

## v1.0.0-rc.7 / 2017-09-11

* fixed; issue with `lib` build preventing use in ES2015 environments

## v1.0.0-rc.6 / 2017-09-10

* fixed; changing `required` prop from `true` to `false` now works as expected,
	thanks [George Karagkiaouris](https://github.com/karaggeorge)
* added; new prop `onSelectResetsInput` controls whether the input value is
	cleared when options are selected, thanks
	[David Roeca](https://github.com/davidroeca) and
	[Alexander Nosov](https://github.com/nosovsh)
* fixed; tabindex parent bug fix for Edge, thanks
	[George Payne](https://github.com/George-A-Payne)
* fixed; update selectize link in README.md, thanks
	[kerumen](https://github.com/kerumen)
* added; standard issue template, thanks [agirton](https://github.com/agirton)
* added; new build process using rollup and webpack. Removed grunt. thanks
	[gwyneplaine](https://github.com/gwyneplaine)
* fixed; updated contributor docs with the correct node version reference
	[gwyneplaine](https://github.com/gwyneplaine)
* fixed; missing method binds in Option, thanks
	[agirton](https://github.com/agirton)
* fixed; converted components to use es6 classes, thanks
	[jochenberger](https://github.com/jochenberger)
* fixed; console.log example in usage docs, thanks
	[rohmanhm](https://github.com/rohmanhm)
* fixed; hide create option after closing menu, thanks
	[andreme](https://github.com/andreme)
* fixed; remove circular reference, thanks [agirton](https://github.com/agirton)
* fixed; readme typo, thanks [ieldanr](https:/github.com/ieldanr)
* fixed; add missing function binds in Option component, thanks
	[agirton](https://github.com/agirton) and
	[blacktemplar](https://github.com/blacktemplar)
* fixed; re-added fix to
	[#1580](https://github.com/JedWatson/react-select/issues/1580), thanks
	[agirton](https://github.com/agirton)
* fixed; avoid mutating user inputs when ignoring case/accents, thanks
	[not-an-aardvark](https://github.com/not-an-aardvark)
* fixed; issues synchronising options props in `Async`, thanks
	[cbergmiller](https://github.com/cbergmiller)
* fixed; backspace handling for non-multi select controls, thanks
	[Jeremy Liberman](https://github.com/MrLeebo)

## v1.0.0-rc.5 / 2017-05-25

* fixed; Allow `falsey` values to be clearable, thanks
	[Simon Gaestel](https://github.com/sgaestel)
* fixed; issue where Firefox would crash due to incorrect use of `aria-owns`
	attribute, thanks [Max Hubenthal](https://github.com/mhubenthal)
* fixed; regression where options not using the value key couldn't be focused,
	thanks [Benjamin Piouffle](https://github.com/Betree)

## v1.0.0-rc.4 / 2017-05-14

* fixed; no more warning when using React 15.5, thanks
	[Adam Girton](https://github.com/agirton)
* fixed; issue comparing objects in `getFocusableOptionIndex`, thanks
	[rndm2](https://github.com/rndm2)
* fixed; missing .focus() method in `Creatable`, thanks
	[Anton Alexandrenok](https://github.com/the-spyke)
* added; support for `aria-describedby` attribute, thanks
	[Eric Lee](https://github.com/ericj17)
* added; `.is-clearable` className when clearable is true, thanks
	[Dan Diaz](https://github.com/dan-diaz)

## v1.0.0-rc.3 / 2017-02-01

* added; `arrowRenderer` prop, thanks [Brian Vaughn](https://github.com/bvaughn)
* added; child-function support to `Async` and `Creatable` components so that
	they can compose each other (or future HOCs), thanks
	[Brian Vaughn](https://github.com/bvaughn)
* added; `asyncCreatable` HOC that combines `Async` and `Creatable` so they can
	be used together, thanks [Brian Vaughn](https://github.com/bvaughn)
* added; undocumented arguments for `menuRenderer`, thanks
	[Julian Krispel-Samsel](https://github.com/juliankrispel)
* fixed; Do not focus and open menu when disabled, thanks
	[nhducit](https://github.com/nhducit)
* fixed; Scrolling with arrow-keys is not working correctly, thanks
	[Damian Pieczynski](https://github.com/piecyk)
* added; "select all text" functionality `Shift+Home|Del`, thanks
	[Damian Pieczynski](https://github.com/piecyk)
* added; support for `boolean` values, thanks
	[Aaron Hardy](https://github.com/Aaronius)
* fixed; Remove duplicated `promptTextCreator` field from readme, thanks
	[Jih-Chi Lee](https://github.com/jihchi)
* fixed; Adding back ref that was removed in rc2, thanks
	[Martin Jujou](https://github.com/jooj123)
* fixed; `Creatable` component doesn't allow input key down handling, thanks
	[Ivan Leonenko](https://github.com/IvanLeonenko)
* added; Allow react nodes to be passed as loadingPlaceholder, thanks
	[Daniel Heath](https://github.com/DanielHeath)
* fixed; IE8 compatibility issues, thanks
	[Kirill Mesnyankin](https://github.com/strayiker)
* improved; Allow users to specify noResultsText, thanks
	[Daniel Heath](https://github.com/DanielHeath)
* added; Only remove options if a loading placeholder is available, thanks
	[Daniel Heath](https://github.com/DanielHeath)
* fixed; firefox display items in two rows due to reflow, thanks
	[Daniel Heath](https://github.com/DanielHeath)
* fixed; `Creatable` readme typo, thanks [Ben](https://github.com/rockingskier)
* fixed; explain way to implement `allowCreate` functionality with `Creatable`
	to readme, thanks [mayerwin](https://github.com/mayerwin)
* added; delete key removes an item when there is no input, thanks
	[forum-is](https://github.com/forum-is)
* added; `onNewOptionClick` handler for `Creatable`, thanks
	[Lee Siong Chan](https://github.com/leesiongchan)
* fixed; `onInputChange` consistent for `Creatable`, thanks
	[Lee Siong Chan](https://github.com/leesiongchan)
* fixed; `menuRenderer` is treated consistently between `Creatable` and
	`Select`, thanks [Brian Vaughn](https://github.com/bvaughn)
* fixed; `asyncCreatable` options parsing will not parse undefined values into
	props, thanks [Romain Dardour](https://github.com/unity)
* added; pass `inputProps` to `inputRenderer`, thanks
	[Alec Winograd](https://github.com/awinograd)
* fixed; no exception when clearing an Async field that is not set to multi,
	thanks [Patrik Stutz](https://github.com/VanCoding)
* added; allow rendering a custom clear component, thanks
	[Conor Hastings](https://github.com/conorhastings)
* fixed; document `ignoreAccents`, thanks
	[Domenico Matteo](https://github.com/dmatteo)
* fixed; arrowing up or down in `Select` with 0 options does not throw type
	error, thanks [Alex Howard](https://github.com/thezanke)
* fixed; `Creatable` handles null children prop, thanks
	[Jack Coulter](https://github.com/jscinoz)
* added; provide `isOpen` to arrowRenderer, thanks
	[Kuan](https://github.com/khankuan)
* fixed; re-added the `focus()` method on `Select.Async`, thanks,
	[Maarten Claes](https://github.com/mcls)
* fixed; focus the next available option after a selection, not the top option,
	thanks [Nicolas Raynaud](https://github.com/nraynaud)

Note there has also been a breaking change to the props for the `Async`
component: both `minimumInput` and `searchingText` have been removed. See #1226
for more details. Apologies for doing this in an RC release, but we had to trade
off between resolving some important bugs and breaking the API, and figured it
was better to do this before declaring 1.0.0 stable.

## v1.0.0-rc.1 / 2016-09-04

* fixed; reset value to `[]` when `multi=true`, thanks
	[Michael Williamson](https://github.com/mwilliamson)
* added; pass index to `renderLabel` method, thanks
	[nhducit](https://github.com/nhducit)
* fixed; uncontrolled to controlled component warning in React 15.3
* fixed; props cleanup, thanks
	[Forbes Lindesay](https://github.com/ForbesLindesay)
* fixed; issue where a value of the number `0` would be assumed to be no value,
	thanks [Hanwen Cheng](https://github.com/hanwencheng)
* fixed; internal refs converted to callbacks instead of strings, thanks
	[Johnny Nguyen](https://github.com/gojohnnygo)
* added; optional `instanceId` prop for server-side rendering, thanks
	[Jevin Anderson](https://github.com/JevinAnderson)
* added; `onCloseResetsInput` prop, thanks
	[Frankie](https://github.com/frankievx)
* added; `Creatable` component, replaces pre-1.0 `allowCreate` prop, thanks
	[Brian Vaughn](https://github.com/bvaughn)

## v1.0.0-beta14 / 2016-07-17

* fixed; `react-input-autosize` has been udpated to `1.1.0`, which includes
	fixes for the new warnings that React 15.2 logs
* fixed; "Unknown prop `inputClassName` on <div> tag" warning, thanks
	[Max Stoiber](https://github.com/mxstbr)
* fixed; Removed unnecessary `onUnfocus`, thanks
	[Johnny Nguyen](https://github.com/gojohnnygo)
* added; Support for react components in `searchPromptText`, thanks
	[Matt](https://github.com/hellaeon)
* fixed; focus bug on iOS, thanks
	[Tony deCatanzaro](https://github.com/tonydecat)
* fixed; Async bugs with Promises, thanks
	[Vladimir](https://github.com/VladimirPal) and
	[Ian Firkin](https://github.com/lobsteropteryx)
* fixed; `searchingText` bug, thanks
	[Tony deCatanzaro](https://github.com/tonydecat)
* improved; More antive-like input behaviour, thanks
	[Johnny Nguyen](https://github.com/gojohnnygo)
* fixed; Added missing unit (px) to `minWidth` attribute, thanks
	[Ian Witherow](https://github.com/ianwitherow)
* added; Support for assistive technologies, thanks
	[Dave Brotherstone](https://github.com/bruderstein)
* fixed; React error if `onChange` callback causes a root component to unmount,
	thanks [Nathan Norton](https://github.com/Xesued)
* fixed; Open menu is now closed if `disabled` becomes true, thanks
	[Jason Moon](https://github.com/jsnmoon)
* fixed; Prevent `getFocusableOptionIndex` from returning a disabled option,
	thanks [Brian Powers](https://github.com/brianspowers)
* added; Home, End, Page Up/Down support, thanks
	[Jason Kadrmas](https://github.com/blackjk3)
* fixed; Don't render `backspaceToRemoveMessage` if `backspaceRemoves` is set to
	false, thanks [Ryan Zec](https://github.com/ryanzec)
* fixed; Issue with an outline appearing on the auto sized input, thanks
	[Ryan Zec](https://github.com/ryanzec)
* fixed; Events don't propagate when `esc` is pressed, thanks
	[Yoshihide Jimbo](https://github.com/jmblog)
* fixed; Update `required` prop based on nextProps on update, thanks
	[Matt Shwery](https://github.com/mshwery)
* fixed; On focus check whether input ref is a real input or an input component,
	thanks [Peter Brant](https://github.com/pbrant) and
	[Greg Poole](https://github.com/gpoole)

Also a big thanks to [Brian Vaughn](https://github.com/bvaughn) for his help
triaging issues for this release!

## v1.0.0-beta13 / 2016-05-30

* added; `inputRenderer` prop, allows you to override the input component,
	thanks [Sean Burke](https://github.com/leftmostcat)
* added; `openOnFocus` prop, causes the menu to always open when the select
	control is focused, thanks
	[HuysentruytRuben](https://github.com/HuysentruytRuben)
* added; `react-virtualised-select` HOC example, thanks
	[Brian Vaughn](https://github.com/bvaughn)
* added; `tabSelectsValue` prop can be set to false to prevent selection of
	focused option when tab is pressed, thanks
	[Byron Anderson](https://github.com/byronanderson)
* added; ability to override `resetValue` when clearing the control, thanks
	[Alexander Luberg](https://github.com/LubergAlexander)
* added; input can be updated with `onInputChange`, thanks
	[Brett DeWoody](https://github.com/brettdewoody)
* added; Styles for .is-selected class, thanks
	[Danny Herran](https://github.com/dherran)
* fixed; `noResultsText` prop type is now `stringOrNode` for Async component,
	thanks [Michael Groeneman](https://github.com/mgroeneman)
* fixed; `onInputChange` is wrapped by Async component, thanks
	[Eric O'Connell](https://github.com/drd)
* fixed; `scrollMenuIntoView` behaviour in IE10, thanks
	[Ivan Jager](https://github.com/aij)
* fixed; isEqualNode replaced with strict equality check, thanks
	[Alexandre Balhier](https://github.com/abalhier)
* fixed; issue with value object not being passed to `handleRequired`, thanks
	[Andrew Hite](https://github.com/andyhite)
* fixed; the menu-outer container is no longer rendered when it does not contain
	anything, thanks [Kuan](https://github.com/khankuan)
* improved; better support for IE8 in styles, thanks
	[Rockallite Wulf](https://github.com/rockallite)

## v1.0.0-beta12 / 2016-04-02

* added; `menuRenderer` method and example for effeciently rendering thousands
	of options, thanks [Brian Vaughn](https://github.com/bvaughn)
* added; `optionClassName` prop, thanks [Max Tyler](https://github.com/iam4x)

## v1.0.0-beta11 / 2016-03-09

* updated dependencies to allow use with React 15.x
* changed; multiple selected values are now submitted using multiple inputs,
	thanks [Trinh Hoang Nhu](https://github.com/james4388)
* added; `joinValues` prop to revert the above change and submit multiple values
	in a single field with the delimiter

## v1.0.0-beta10 / 2016-02-23

* fixed build issues with v1.0.0-beta9

## v1.0.0-beta9 / 2016-02-12

* added; onBlurResetsInput prop, thanks
	[Sly Bridges](https://github.com/slybridges)
* changed; Enter selects and retains focus, Tab selects and shifts focus, thanks
	[RDX](https://github.com/rdsubhas)
* fixed; Hide noResultsText when value is falsy, thanks
	[Fernando Alex Helwanger](https://github.com/fhelwanger)
* added; `required` prop, adds HTML5 required attribute, thanks
	[Domenico Matteo](https://github.com/dmatteo)
* fixed; Touch drag behaviour, thanks
	[Pavel Tarnopolsky](https://github.com/Paveltarno)
* added; `onOpen` and `onClose` event props, thanks
	[Jacob Page](https://github.com/DullReferenceException)
* fixed; Pressing Enter on open Select should stop propagation, thanks
	[Jeremy Liberman](https://github.com/MrLeebo)
* fixed; Missing handleMouseDownOnMenu, thanks
	[Jeremy Liberman](https://github.com/MrLeebo)
* added; Ensures the selected option is immediately visible when the menu is
	open, thanks [Martin Jujou](https://github.com/jooj123)
* added; `autoBlur` prop, blurs the input when a value is selected, thanks
	[Pavel Tarnopolsky](https://github.com/Paveltarno)
* fixed; Several isFocused checks weren't working properly

## v1.0.0-beta8 / 2015-12-20

* fixed; input focus bug when toggling `disabled` prop, thanks
	[Davide Curletti](https://github.com/dcurletti)
* fixed; `focus()` is now exposed on the `Async` component, thanks
	[AugustinLF](https://github.com/AugustinLF)

## v1.0.0-beta7 / 2015-12-15

* You can now use React elements for placeholders and the text props, thanks
	[kromit](https://github.com/kromit) and
	[Alyssa Biasi](https://github.com/alyssaBiasi)
* Fixed a problem where the border doesn't show when the element is inside a
	table, thanks [Rodrigo Boratto](https://github.com/rwrz)
* New prop `scrollMenuIntoView` scrolls the viewport to display the menu, thanks
	[Alexander Zaharakis](https://github.com/azaharakis)
* New LESS / SCSS variable `select-option-bg` lets you control the menu option
	background color, thanks [Evan Goldenberg](https://github.com/Naveg)
* Fixed an error in the blur handler on IE when the menu is not visible, thanks
	[Gaston Sanchez](https://github.com/gaastonsr)
* Added support for a `clearableValue` option property in `multi` mode, thanks
	[Sly Bridges](https://github.com/slybridges)

## v1.0.0-beta6 / 2015-11-29

* Test suite complete and passing, with a couple of minor fixes thanks to
	@bruderstein

## v1.0.0-beta5 / 2015-11-08

* Fixes issues relating to serializing simple values into the hidden field

## v1.0.0-beta4 / 2015-11-08

* New default styles that match [Elemental UI](http://elemental-ui.com) and look
	right at home in the new [KeystoneJS Admin UI](http://keystonejs.com)

We're potentially going to ship some theme stylesheets in the future, shout out
on GitHub if this interests you.

## v1.0.0-beta3 / 2015-11-08

* The selected value populated in the hidden field has been fixed (was `"[object
	Object]"` before)
* Added new `autofocus` prop
* Fixed duplicate key error for options and values with duplicate `value`
	properties
* SCSS variables now have `!default` so you can override them

## v1.0.0-beta2 / 2015-11-06

Changed since beta 1:

* Async options cache works again
* New style props for custom styling the component without modifying css
	classes: `style` `wrapperStyle` `menuStyle` `menuContainerStyle`
* The menu opens and closes correctly when `searchable={false}`, there is still
	some work to do on this use-case

## v1.0.0-beta1 / 2015-11-06

This is a complete rewrite. Major changes include:

* Everything is simpler (I'm nearly done and the source code is only 60% of the
	size of the last version)
* No more timeouts or weird handlers, the restructuring has let me make
	everything more straight-forward
* The options array is no longer preprocessed into state, just retrieved from
	props
* The values array is now initialised in the Options array during render, and
	not stored in state, which along with the change to options makes the
	component more reliable and fixes issues with props not updating correctly
* The component no longer stores its own value in state (ever) - it needs to be
	passed as a prop and handled with `onChange`.
* Complex values are now enabled by default (so you're passed the option object,
	not its value); you can enable the legacy mode with a prop
* The Value and Option components have been cleaned up as well for consistency
* The hidden `<input>` field is now optional and the component is better suited
	to use in a rich React.js app than it was
* You can disable options filtering to do the filtering externally with
	`onInputChange`
* Accents on characters can now be ignored
* The `asyncOptions` prop has been replaced by a new wrapper component:
	`Select.Async`

Note that "Tag mode" (creating options on the fly) isn't reimplemented yet.

A full guide to the breaking changes and new features will be written up soon.
In the meantime please see the new examples.

## v0.9.1 / 2015-11-01

* added; new Contributors example w/ async options loading and custom value /
	label keys
* fixed; several issues with custom `valueKey` and `labelKey` props
* fixed; autoload now loads options with no search input

## v0.9.0 / 2015-10-29

* added; SCSS stylesheets!
* improved; Options rendering should be more performant
* breaking change; Custom `Option` components now need to pass their `option`
	prop to event handlers; see
	[this commit](https://github.com/JedWatson/react-select/commit/89af12a80a972794222b193a767f44234bbe9817)
	for an example of the required change.

## v0.8.4 / 2015-10-27

* fixed; LESS math operations now work with --strict-math=on, thanks
	[Vincent Fretin](https://github.com/vincentfretin)

## v0.8.3 / 2015-10-27

* fixed; IE issue where clicking the scrollbar would close the menu, thanks
	[Pete Nykänen](https://github.com/petetnt)

## v0.8.2 / 2015-10-22

* added; Promise support for `loadAsyncOptions`, thanks
	[Domenico Matteo](https://github.com/dmatteo)

## v0.8.1 / 2015-10-20

* fixed; `loadAsyncOptions` raises TypeError in setup, see #439 for details,
	thanks [Pancham Mehrunkar](https://github.com/pancham348)

## v0.8.0 / 2015-10-19

This release contains significant DOM structure and CSS improvements by
@jossmac, including:

* no more `position: absolute` for inner controls
* `display: table` is used for layout, which works in IE8 and above, and
	[all other modern browsers](http://caniuse.com/#feat=css-table)
* less "magic numbers" used for layout, should fix various browser-specific
	alignment issues
* clear "x" control now animates in
* clearer `.Select--multi` className replaces `.Select.is-multi`
* new height & theme variables
* "dropdown" indicator chevron is no longer displayed for multi-select controls

There are no functional changes, but if you've forked the LESS / CSS to create
your own theme you'll want to pay close attention to PR #527 when upgrading to
this version.

## v0.7.0 / 2015-10-10

React Select is updated for React 0.14. If you're still using React 0.13, please
continue to use `react-select@0.6.x`. There are no functional differences
between v0.7.0 and v0.6.12.

Additionally, our tests now require Node.js 4.x. If you are developing
`react-select`, please make sure you are running the latest version of node.

Thanks to @bruderstein, @dmatteo and @hull for their help getting these updates
shipped!

## v0.6.12 / 2015-10-02

* added; `labelKey` and `valueKey` props, so you can now use different keys in
	`option` objects for the label and value
* fixed; additional `isMounted()` checks in timeouts
* fixed; componentDidUpdate timeout is reset correctly, see #208 and #434,
	thanks [Petr Gladkikh](https://github.com/PetrGlad)
* fixed; mousedown event on scrollbar in menu no longer hides it, thanks
	[Yishai Burt](https://github.com/burtyish)

## v0.6.11 / 2015-09-28

* added; `isLoading` prop, allows indication of async options loading in
	situations where more control is required, thanks
	[Jon Gautsch](https://github.com/jgautsch)

## v0.6.10 / 2015-09-24

* fixed; a build issue with the previous release that prevented the stylesheet
	being generated / included
* fixed; a LESS syntax issue, thanks [Bob Cardenas](https://github.com/bcardi)

## v0.6.9 / 2015-09-19

* added; `style` key for package.json, thanks
	[Stephen Wan](https://github.com/stephen)
* added; `onInputChange` handler that returns the current input value, thanks
	[Tom Leslie](https://github.com/lomteslie)
* fixed; simplifying handleKey function & preventDefault behaviour, thanks
	[davidpene](https://github.com/davidpene)
* fixed; Display spinner while auto-loading initial data, thanks
	[Ben Jenkinson](https://github.com/BenJenkinson)
* fixed; better support for touch events, thanks
	[Montlouis-Calixte Stéphane](https://github.com/bulby97)
* fixed; prevent value splitting on non-multi-value select, thanks
	[Alan R. Soares](https://github.com/alanrsoares)

## v0.6.8 / 2015-09-16

* fixed; broader range of allowed prereleases for React 0.14, including rc1
* fixed; preventing backspace from navigating back in the browser history,
	thanks [davidpene](https://github.com/davidpene)

## v0.6.7 / 2015-08-28

* fixed; missing styles for `.Select-search-prompt` and `.Select-searching`
	issues, thanks [Jaak Erisalu](https://github.com/jaakerisalu) and
	[davidpene](https://github.com/davidpene)

## v0.6.6 / 2015-08-26

* fixed; issue in Chrome where clicking the scrollbar would close the menu,
	thanks [Vladimir Matsola](https://github.com/vomchik)

## v0.6.5 / 2015-08-24

* fixed; completely ignores clicks on disabled items, unless the target of the
	click is a link, thanks [Ben Stahl](https://github.com/bhstahl)

## v0.6.4 / 2015-08-24

This release includes a huge improvement to the examples / website thanks to
@jossmac. Also:

* added; support for React 0.14 beta3
* fixed; disabled options after searching, thanks @bruderstein
* added; support for "Searching..." text (w/ prop) while loading async results,
	thanks @bruderstein and @johnomalley
* added; `className`, `style` and `title` keys are now supported in option
	properties, thanks @bruderstein

## v0.6.3 / 2015-08-18

Otherwise known as "the real 0.6.2" this includes the updated build for the last
version; sorry about that!

## v0.6.2 / 2015-08-13

* changed; if the `searchable` prop is `false`, the menu is opened _or closed_
	on click, more like a standard Select input. thanks
	[MaaikeB](https://github.com/MaaikeB)

## v0.6.1 / 2015-08-09

* added; Support for options with numeric values, thanks
	[Dave Brotherstone](https://github.com/bruderstein)
* changed; Disabled options now appear in the search results , thanks
	[Dave Brotherstone](https://github.com/bruderstein)
* fixed; asyncOptions are reloaded on componentWillReceiveProps when the value
	has changed, thanks [Francis Cote](https://github.com/drfeelgoud)
* added; `cacheAsyncResults` prop (default `true`) now controls whether the
	internal cache is used for `asyncOptions`

## v0.6.0 / 2015-08-05

* improved; option, value and single value have been split out into their own
	components, and can be customised with props. see
	[#328](https://github.com/JedWatson/react-select/pull/328) for more details.
* improved; Near-complete test coverage thanks to the awesome work of
	[Dave Brotherstone](https://github.com/bruderstein)
* improved; Support all alpha/beta/rc's of React 0.14.0, thanks
	[Sébastien Lorber](https://github.com/slorber)
* fixed; Close multi-select menu when tabbing away, thanks
	[Ben Alpert](https://github.com/spicyj)
* fixed; Bug where Select shows the value instead of the label (reapplying fix)
* fixed; `valueRenderer` now works when `multi={false}`, thanks
	[Chris Portela](https://github.com/0xCMP)
* added; New property `backspaceRemoves` (default `true`), allows the default
	behaviour of removing values with backspace when `multi={true}`, thanks
	[Leo Lehikoinen](https://github.com/lehikol2)

## v0.5.6 / 2015-07-27

* fixed; Allow entering of commas when allowCreate is on but multi is off,
	thanks [Angelo DiNardi](https://github.com/adinardi)
* fixed; Times (clear) character is now rendered from string unicode character
	for consistent output, thanks [Nibbles](https://github.com/Siliconrob)
* fixed; allowCreate bug, thanks [goodzsq](https://github.com/goodzsq)
* fixed; changes to props.placeholder weren't being reflected correctly, thanks
	[alesn](https://github.com/alesn)
* fixed; error when escape is pressedn where `clearValue` was not passed the
	event, thanks [Mikhail Kotelnikov](https://github.com/mkotelnikov)
* added; More tests, thanks [Dave Brotherstone](https://github.com/bruderstein)

## v0.5.5 / 2015-07-12

* fixed; replaced usage of `component.getDOMNode()` with
	`React.findDOMNode(component)` for compatibility with React 0.14

## v0.5.4 / 2015-07-06

* fixed; regression in 0.5.3 that broke componentWillMount, sorry everyone!
* added; `addLabelText` prop for customising the "add {label}?" text when in
	tags mode, thanks [Fenn](https://github.com/Fenntasy)

## v0.5.3 / 2015-07-05

* fixed; autoload issues, thanks [Maxime Tyler](https://github.com/iam4x)
* fixed; style incompatibilities with Foundation framework, thanks
	[Timothy Kempf](https://github.com/Fauntleroy)

## v0.5.2 / 2015-06-28

* fixed; bug where Select shows the value instead of the label, thanks
	[Stephen Demjanenko](https://github.com/sdemjanenko)
* added; 'is-selected' classname is added to the selected option, thanks
	[Alexey Volodkin](https://github.com/miraks)
* fixed; async options are now loaded with the initial value, thanks
	[Pokai Chang](https://github.com/Neson)
* fixed; `react-input-autosize` now correctly escapes ampersands (&), not
	actually a fix in react-select but worth noting here because it would have
	been causing a problem in `react-select` as well.

## v0.5.1 / 2015-06-21

* added; custom option and value rendering capability, thanks
	[Brian Reavis](https://github.com/brianreavis)
* fixed; collapsing issue when single-select or empty multi-select fields are
	disabled
* fixed; issue where an empty value would be left after clearing all values in a
	multi-select field

## v0.5.0 / 2015-06-20

* fixed; `esc` key incorrectly created empty options, thanks
	[rgrzelak](https://github.com/rgrzelak)
* adeed; New feature to allow option creation ("tags mode"), enable with
	`allowCreate` prop, thanks [Florent Vilmart](https://github.com/flovilmart)
	and [Brian Reavis](https://github.com/brianreavis)
* fixed; IE8 compatibility fallback for `addEventListener/removeEventListener`,
	which don't exist in IE8, thanks
	[Stefan Billiet](https://github.com/StefanBilliet)
* fixed; Undefined values when using asyncOptions, thanks
	[bannaN](https://github.com/bannaN)
* fixed; Prevent add the last focused value when the drop down menu is closed /
	Pushing enter without dropdown open adds a value, thanks
	[Giuseppe](https://github.com/giuse88)
* fixed; Callback context is undefined, thanks
	[Giuseppe](https://github.com/giuse88)
* fixed; Issue with event being swallowed on Enter `keydown`, thanks
	[Kevin Burke](https://github.com/kembuco)
* added; Support for case-insensitive filtering when `matchPos="start"`, thanks
	[wesrage](https://github.com/wesrage)
* added; Support for customizable background color, thanks
	[John Morales](https://github.com/JohnMorales)
* fixed; Updated ESLint and cleared up warnings, thanks
	[Alexander Shemetovsky](https://github.com/AlexKVal)
* fixed; Close dropdown when clicking on select, thanks
	[Nik Butenko](https://github.com/nkbt)
* added; Tests, and mocha test framework, thanks
	[Craig Dallimore](https://github.com/craigdallimore)
* fixed; You can now start the example server and watch for changes with `npm
	start`

## v0.4.9 / 2015-05-11

* fixed; focus was being grabbed by the select when `autoload` and
	`asyncOptions` were set
* added; `focus` method on the component
* added; support for disabled options, thanks
	[Pasha Palangpour](https://github.com/pashap)
* improved; more closures, less binds, for better performance, thanks
	[Daniel Cousens](https://github.com/dcousens)

## v0.4.8 / 2015-05-02

* fixed; restored `dist/default.css`
* fixed; standalone example works again
* fixed; clarified dependency documentation and added dependencies for Bower
* fixed; Scoping issues in `_bindCloseMenuIfClickedOutside`, thanks
	[bannaN](https://github.com/bannaN)
* fixed; Doesnt try to set focus afterupdate if component is disabled, thanks
	[bannaN](https://github.com/bannaN)

## v0.4.7 / 2015-04-21

* improved; lodash is no longer a dependency, thanks
	[Daniel Lo Nigro](https://github.com/Daniel15)

## v0.4.6 / 2015-04-06

* updated; dependencies, build process and input-autosize component

## v0.4.5 / 2015-03-28

* fixed; issue with long options overlapping arrow and clear icons, thanks
	[Rohit Kalkur](https://github.com/rovolution)

## v0.4.4 / 2015-03-26

* fixed; error handling click events when the menu is closed, thanks
	[Ilya Petrov](https://github.com/muromec)
* fixed; issue where options will not be filtered in certain conditions, thanks
	[G. Kay Lee](https://github.com/gsklee)

## v0.4.3 / 2015-03-25

* added tests and updated dependencies

## v0.4.2 / 2015-03-23

* added; ESLint and contributing guide
* fixed; incorrect `classnames` variable assignment in window scope
* fixed; all ESLint errors and warnings (except invalid JSX undefined/unused
	vars due to ESLint bug)
* fixed; first option is now focused correctly, thanks
	[Eivind Siqveland Larsen](https://github.com/esiqveland)

## v0.4.1 / 2015-03-20

* fixed; IE11 issue: clicking on scrollbar within menu no longer closes menu,
	thanks [Rohit Kalkur](https://github.com/rovolution)

## v0.4.0 / 2015-03-12

* updated; compatible with React 0.13

## v0.3.5 / 2015-03-09

* improved; less/no repaint on scroll for performance wins, thanks
	[jsmunich](https://github.com/jsmunich)
* added; `onBlur` and `onFocus` event handlers, thanks
	[Jonas Budelmann](https://github.com/cloudkite)
* added; support for `inputProps` prop, passed to the `<input>` component,
	thanks [Yann Plantevin](https://github.com/YannPl)
* changed; now using
	[react-component-gulp-tasks](https://github.com/JedWatson/react-component-gulp-tasks)
	for build
* fixed; issue w/ remote callbacks overriding cached options, thanks
	[Corey McMahon](https://github.com/coreymcmahon)
* fixed; if not `this.props.multi`, menu doesn't need handleMouseDown, thanks
	[wenbing](https://github.com/wenbing)

## v0.3.4 / 2015-02-23

* fixed; issues with the underscore/lodash dependency change, thanks
	[Aaron Powell](https://github.com/aaronpowell)

## v0.3.3 / 2015-02-22

* added; `disabled` prop, thanks [Danny Shaw](https://github.com/dannyshaw)
* added; `searchable` prop - set to `false` to disable the search box, thanks
	[Julen Ruiz Aizpuru](https://github.com/julen)
* added; `onOptionLabelClick` prop - see
	[#66](https://github.com/JedWatson/react-select/pull/66) for docs, thanks
	[Dmitry Smirnov](https://github.com/dmitry-smirnov)
* fixed; `text-overflow: ellipsis;` typo, thanks
	[Andru Vallance](https://github.com/andru)

## v0.3.2 / 2015-01-30

* fixed; issue adding undefined values to multiselect, thanks
	[Tejas Dinkar](https://github.com/gja)

## v0.3.1 / 2015-01-20

* fixed; missing `var` statement

## v0.3.0 / 2015-01-20

* added; node compatible build now available in `/lib`

## v0.2.14 / 2015-01-07

* added; `searchPromptText` property that is displayed when `asyncOptions` is
	set and there are (a) no options loaded, and (b) no input entered to search
	on, thanks [Anton Fedchenko](https://github.com/kompot)
* added; `clearable` property (defaults to `true`) to control whether the
	"clear" control is available, thanks
	[Anton Fedchenko](https://github.com/kompot)

## v0.2.13 / 2015-01-05

* fixed; height issues in Safari, thanks
	[Joss Mackison](https://github.com/jossmac)
* added; Option to specify "Clear value" label as prop for i18n

## v0.2.12 / 2015-01-04

* fixed; UI now responds to touch events, and works on mobile devices! thanks
	[Fraser Xu](https://github.com/fraserxu)

## v0.2.11 / 2015-01-04

* fixed; Options in the dropdown now scroll into view when they are focused,
	thanks [Adam](https://github.com/fmovlex)
* improved; Example dist is now excluded from the npm package

## v0.2.10 / 2015-01-01

* fixed; More specific mixin name to avoid conflicts (css)
* fixed; Example CSS now correctly rebuilds on changes in development
* fixed; Values are now expanded correctly when options change (see #28)
* added; Option to specify "No results found" label as prop for i18n, thanks
	[Julen Ruiz Aizpuru](https://github.com/julen)

## v0.2.9 / 2014-12-09

* added; `filterOption` and `filterOptions` props for more control over
	filtering

## v0.2.8 / 2014-12-08

* added; `matchPos` option to control whether to match the `start` or `any`
	position in the string when filtering options (default: `any`)
* added; `matchProp` option to control whether to match the `value`, `label` or
	`any` property of each option when filtering (default: `any`)

## v0.2.7 / 2014-12-01

* fixed; screen-readers will now read "clear value" instead of "times" for the
	clear button
* fixed; non-left-click mousedown events aren't blocked by the control

## v0.2.6 / 2014-11-30

* improved; better comparison of changes to [options] in `willReceiveProps`
* fixed; now focuses the first option correctly when in multiselect mode
* fixed; fixed focused option behaviour on value change
* fixed; when filtering, there is always a focused option (#19)
* changed; using ^ in package.json to compare dependencies

## v0.2.5 / 2014-11-20

* fixed; compatibility with case-sensitive file systems

## v0.2.4 / 2014-11-20

* fixed; package.json pointed at the right file

## v0.2.3 / 2014-11-17

* fixed; Updating state correctly when props change
* improved; Build tasks and docs
* added; Working standalone build
* added; Minified dist version
* added; Publised to Bower

## v0.2.2 / 2014-11-15

* fixed; backspace event being incorrectly cancelled

## v0.2.1 / 2014-11-15

* fixed; issue where backspace incorrectly clears the value (#14)

## v0.2.0 / 2014-11-15

* changed; Major rewrite to improve focus handling and internal state management
* added; Support for `multi` prop, enable multiselect mode

## v0.1.1 / 2014-11-03

* added; Support for `onChange` event
* added; `propTypes` are defined by the `Select` component now
* added; `className` property, sets the `className` on the outer `div` element
* fixed; Removed deprecated `React.DOM.x` calls

## v0.1.0 / 2014-11-01

* updated; React to 0.12.0

## v0.0.6 / 2014-10-14

* fixed; Error keeping value when using Async Options
