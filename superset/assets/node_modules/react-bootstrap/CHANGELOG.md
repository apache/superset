## [v0.31.5]
> 2017-10-24

- **Bugfix:** Fix ES module build ([#2856])

[v0.31.5]: https://github.com/react-bootstrap/react-bootstrap/compare/v0.31.4...v0.31.5
[#2856]: https://github.com/react-bootstrap/react-bootstrap/pull/2856


## [v0.31.4]
> 2017-10-24

- **Feature:** Support `align` on `<Media.Body>` ([#2830])
- **Bugfix:** Update react-overlays dependency to support React v16 ([#2839], [#2855])
- **Bugfix:** Use a bound function for the base modal ref in `<Modal>` to prevent the ref getting set to `null` ([#2844])
- **Chore:** Update Babel configuration ([#2821], [#2837])

[v0.31.4]: https://github.com/react-bootstrap/react-bootstrap/compare/v0.31.3...v0.31.4
[#2821]: https://github.com/react-bootstrap/react-bootstrap/pull/2821
[#2830]: https://github.com/react-bootstrap/react-bootstrap/pull/2830
[#2837]: https://github.com/react-bootstrap/react-bootstrap/pull/2837
[#2839]: https://github.com/react-bootstrap/react-bootstrap/pull/2839
[#2844]: https://github.com/react-bootstrap/react-bootstrap/pull/2844
[#2855]: https://github.com/react-bootstrap/react-bootstrap/pull/2855


## [v0.31.3]
> 2017-09-06

- **Bugfix:** Support `disabled` on `<ToggleButton>` ([#2760])
- **Bugfix:** Handle space keydown events on `<SafeAnchor>` ([#2697])
- **Bugfix:** Handle reducing number of items in uncontrolled carousels ([#2768])

[v0.31.3]: https://github.com/react-bootstrap/react-bootstrap/compare/v0.31.2...v0.31.3
[#2697]: https://github.com/react-bootstrap/react-bootstrap/pull/2697
[#2760]: https://github.com/react-bootstrap/react-bootstrap/pull/2760
[#2768]: https://github.com/react-bootstrap/react-bootstrap/pull/2768


## [v0.31.2]
> 2017-08-01

- **Feature:** Support `backdropClassName` on `<Modal>` ([#2723])
- **Bugfix:** Export `<ToggleButton>` and `<ToggleButtonGroup>` ([#2704])
- **Bugfix:** Pass through props on `<ToggleButtonGroup>` ([#2731])
- **Bugfix:** Fix `<ToggleButtonGroup>` in pre-ES2016 environments ([#2731])

[v0.31.2]: https://github.com/react-bootstrap/react-bootstrap/compare/v0.31.1...v0.31.2
[#2704]: https://github.com/react-bootstrap/react-bootstrap/pull/2704
[#2723]: https://github.com/react-bootstrap/react-bootstrap/pull/2723
[#2731]: https://github.com/react-bootstrap/react-bootstrap/pull/2731


## [v0.31.1]
> 2017-07-12

- **Feature:** Add `<ToggleButton>` and `<ToggleButtonGroup>` ([#2252], [#2648])
- **Feature:** Add `<CloseButton>` to top-level API ([#2652])
- **Bugfix:** Properly handle `title` on `<Checkbox>` and `<Radio>` ([#2635], [#2647])
- **Bugfix:** Properly handle `onLoad` and `onError` on `<Thumbnail>` ([#2687])
- **Bugfix:** Properly handle `defaultOpen` on dropdown button components ([#2702])
- **Chore:** Switch from react-prop-types to prop-types-extra ([#2621])
- **Chore:** Rebuild UMD bundle with updated dependencies

[v0.31.1]: https://github.com/react-bootstrap/react-bootstrap/compare/v0.31.0...v0.31.1
[#2252]: https://github.com/react-bootstrap/react-bootstrap/pull/2252
[#2621]: https://github.com/react-bootstrap/react-bootstrap/pull/2621
[#2635]: https://github.com/react-bootstrap/react-bootstrap/pull/2635
[#2647]: https://github.com/react-bootstrap/react-bootstrap/pull/2647
[#2648]: https://github.com/react-bootstrap/react-bootstrap/pull/2648
[#2652]: https://github.com/react-bootstrap/react-bootstrap/pull/2652
[#2687]: https://github.com/react-bootstrap/react-bootstrap/pull/2687
[#2702]: https://github.com/react-bootstrap/react-bootstrap/pull/2702


## [v0.31.0]
> 2017-04-26

- **Breaking:** Rename `aria-label` prop to `closeLabel` on ModalHeader  ([#2584])
- **Breaking:** Remove unused `onClose` callback on Dropdowns (use `onToggle`)  ([#2585])
- **Breaking:** Increase minimal required React and ReactDOM versions to `0.14.9` or `>=15.3.0` ([#2579])
- **Bugfix:** Consistently render accessible close buttons for Alerts and Modals  ([#2584])

[v0.31.0]: https://github.com/react-bootstrap/react-bootstrap/compare/v0.30.10...v0.31.0
[#2584]: https://github.com/react-bootstrap/react-bootstrap/pull/2584
[#2585]: https://github.com/react-bootstrap/react-bootstrap/pull/2585
[#2579]: https://github.com/react-bootstrap/react-bootstrap/pull/2579


## [v0.30.10]
> 2017-04-21

- **Bugfix:** Move prop-types to normal dependencies ([#2576])

[v0.30.10]: https://github.com/react-bootstrap/react-bootstrap/compare/v0.30.9...v0.30.10
[#2576]: https://github.com/react-bootstrap/react-bootstrap/pull/2576

## [v0.30.9]
> 2017-04-18

- **Feature:** Export `<PaginationButton>` ([#2505])
- **Bugfix:** Support falsy `eventKey` ([#2541])
- **Chore:** Update for React v15.5 deprecations ([#2552])

[v0.30.9]: https://github.com/react-bootstrap/react-bootstrap/compare/v0.30.8...v0.30.9
[#2505]: https://github.com/react-bootstrap/react-bootstrap/pull/2505
[#2541]: https://github.com/react-bootstrap/react-bootstrap/pull/2541
[#2552]: https://github.com/react-bootstrap/react-bootstrap/pull/2552


## [v0.30.8]
> 2017-03-07

- **Feature:** Support `bsSize` on `<FormControl>` ([#2382], [#2394])
- **Feature:** Pass event and event source to `onToggle` callback for `<Dropdown>` ([#2422])
- **Feature:** Add `restoreFocus` to `<Modal>` ([#2482])
- **Feature:** Add `mountOnEnter` to transition and tab components ([#2504])
- **Bugfix:** Don't set `aria-describedby` in `<OverlayTrigger>` when not showing the overlay ([#2359])
- **Bugfix:** Fix `boundaryLinks` in `<Pagination>` ([#2443])
- **Bugfix:** Support `closeButton` in `<Modal.Header>` in static modals ([#2453])
- **Bugfix:** Fix `<Carousel>` with `slide` disabled ([#2466])

[v0.30.8]: https://github.com/react-bootstrap/react-bootstrap/compare/v0.30.7...v0.30.8
[#2359]: https://github.com/react-bootstrap/react-bootstrap/pull/2359
[#2382]: https://github.com/react-bootstrap/react-bootstrap/pull/2382
[#2394]: https://github.com/react-bootstrap/react-bootstrap/pull/2394
[#2422]: https://github.com/react-bootstrap/react-bootstrap/pull/2422
[#2443]: https://github.com/react-bootstrap/react-bootstrap/pull/2443
[#2453]: https://github.com/react-bootstrap/react-bootstrap/pull/2453
[#2466]: https://github.com/react-bootstrap/react-bootstrap/pull/2466
[#2482]: https://github.com/react-bootstrap/react-bootstrap/pull/2482
[#2504]: https://github.com/react-bootstrap/react-bootstrap/pull/2504


## [v0.30.7]
> 2016-11-22

- **Feature:** Add `componentClass` to `<Modal.Body>`, `<Modal.Footer>`, and `<Modal.Title>` ([#2313])
- **Feature:** Add `inputRef` to `<FormControl>` ([#2337])
- **Bugfix:** Pass `onMouseEnter` and `onMouseLeave` to `<Dropdown>` rather than `<Dropdown.Toggle>` from `<DropdownButton>` and related components ([#2335])
- **Refactor:** Remove unused `shouldRenderFill` method on `<Panel>` ([#2316])
- **Docs:** Explicitly add `placement` to `<Overlay>` `propTypes` for generated documentation ([#2318])
- **Docs:** Explicitly document use of `null` (and `undefined`) `validationState` on `<FormGroup>` ([#2336])

[v0.30.7]: https://github.com/react-bootstrap/react-bootstrap/compare/v0.30.6...v0.30.7
[#2313]: https://github.com/react-bootstrap/react-bootstrap/pull/2313
[#2316]: https://github.com/react-bootstrap/react-bootstrap/pull/2316
[#2318]: https://github.com/react-bootstrap/react-bootstrap/pull/2318
[#2335]: https://github.com/react-bootstrap/react-bootstrap/pull/2335
[#2336]: https://github.com/react-bootstrap/react-bootstrap/pull/2336
[#2337]: https://github.com/react-bootstrap/react-bootstrap/pull/2337


## [v0.30.6]
> 2016-10-28

- **Feature:** Add `rootCloseEvent` to `<Dropdown>` to configure root close trigger event ([#2195])
- **Feature:** Add screen reader labels configurable with `prevLabel` and `nextLabel` to `<Carousel>` controls ([#2275])
- **Feature:** Add `collapseOnSelect` to `<Navbar>` to enable automatically collapsing the navbar when the user selects an item ([#2280], [#2308])
- **Bugfix:** Change placeholder `href` in `<SafeAnchor>` to `#` for better IE compatibility ([#2080])
- **Bugfix:** Fix off-by-one error in displaying `<Pagination>` pages ([#2271])
- **Bugfix:** Properly set `.collapsed` on `<Panel>` title anchor ([#2276])

[v0.30.6]: https://github.com/react-bootstrap/react-bootstrap/compare/v0.30.5...v0.30.6
[#2080]: https://github.com/react-bootstrap/react-bootstrap/pull/2080
[#2195]: https://github.com/react-bootstrap/react-bootstrap/pull/2195
[#2271]: https://github.com/react-bootstrap/react-bootstrap/pull/2271
[#2275]: https://github.com/react-bootstrap/react-bootstrap/pull/2275
[#2276]: https://github.com/react-bootstrap/react-bootstrap/pull/2276
[#2280]: https://github.com/react-bootstrap/react-bootstrap/pull/2280
[#2308]: https://github.com/react-bootstrap/react-bootstrap/pull/2308


## [v0.30.5]
> 2016-10-03

- **Bugfix:** Fix opening `<Dropdown>` ([#2244], [#2251])

[v0.30.5]: https://github.com/react-bootstrap/react-bootstrap/compare/v0.30.4...v0.30.5
[#2244]: https://github.com/react-bootstrap/react-bootstrap/pull/2244
[#2251]: https://github.com/react-bootstrap/react-bootstrap/pull/2251


## [v0.30.4]
> 2016-09-30

- **Bugfix:** Properly set `aria-expanded` on `<Panel>` headers ([#2137])
- **Bugfix:** Fix off-by-one bug in `<Pagination>` [#2189]
- **Bugfix:** Persist `<Dropdown.Menu>` instance across visibility changes ([#2241])

[v0.30.4]: https://github.com/react-bootstrap/react-bootstrap/compare/v0.30.3...v0.30.4
[#2137]: https://github.com/react-bootstrap/react-bootstrap/pull/2137
[#2189]: https://github.com/react-bootstrap/react-bootstrap/pull/2189
[#2241]: https://github.com/react-bootstrap/react-bootstrap/pull/2241


## [v0.30.3]
> 2016-08-20

- **Feature:** Support dropdowns in tab navigation ([#2134])
- **Bugfix:** Properly pass expanded state to collapsible header elements ([#2133], [#2137])

[v0.30.3]: https://github.com/react-bootstrap/react-bootstrap/compare/v0.30.2...v0.30.3
[#2133]: https://github.com/react-bootstrap/react-bootstrap/pull/2133
[#2134]: https://github.com/react-bootstrap/react-bootstrap/pull/2134
[#2137]: https://github.com/react-bootstrap/react-bootstrap/pull/2137


## [v0.30.2]
> 2016-08-04

- **Chore:** Upgrade to Babel 6 ([#2108])
- **Chore:** Add ES module build ([#2108])

[v0.30.2]: https://github.com/react-bootstrap/react-bootstrap/compare/v0.30.1...v0.30.2
[#2108]: https://github.com/react-bootstrap/react-bootstrap/pull/2108


## [v0.30.1]
> 2016-08-01

- **Bugfix:** Don't trigger PropTypes warning ([#2095])
- **Bugfix:** Fix regression with `rootClose` on `<OverlayTrigger>` ([#2099])

[v0.30.1]: https://github.com/react-bootstrap/react-bootstrap/compare/v0.30.0...v0.30.1
[#2095]: https://github.com/react-bootstrap/react-bootstrap/pull/2095
[#2099]: https://github.com/react-bootstrap/react-bootstrap/pull/2099


## [v0.30.0]
> 2016-07-25

- **Breaking:** Remove `linkId` prop from `<Breadcrumb.Item>` for consistency with other wrapped link components ([#2011])
- **Breaking:** Remove deprecated functionality from v0.29.x ([#2017])
- **Breaking:** Remove redundant `caption` prop from `<Carousel.Item>`, as this functionality is available from `<Carousel.Caption>` ([#2018])
- **Breaking:** Remove pointless `navItem` and `navDropdown` props from `<Button>` ([#2026])
- **Feature/Deprecation:** Rename `<PageItem>` to `<Pager.Item>` for consistency ([#1976])
- **Feature:** Add `ValidComponentChildren.toArray` ([#2016])
- **Feature:** Add `bsClass` support consistently throughout all components ([#2026], [#2036], [#2079])
- **Feature:** Add `splitBsProps` and `splitBsPropsAndOmit` helpers to `bootstrapUtils` to remove Bootstrap styling props ([#2052])
- **Feature:** Improve IE8-compatible self collapse support on `<Badge>` and add it to `<Label>` ([#2026])
- **Bugfix:** Support `style` on `<Modal>` ([#1957])
- **Bugfix:** Support `bsClass` on `<Dropdown.Toggle>` ([#2014])
- **Bugfix:** Support `active` on `<NavDropdown>` ([#2015])
- **Bugfix:** Do not pass arbitrary props to DOM nodes ([#2026], [#2036], [#2044])
- **Bugfix:** Support strings for `positionTop` and `positionLeft` on `<Popover>` and `<Tooltip>` ([#2026])
- **Bugfix:** Support captions on `<Thumbnail>` links ([#2026])
- **Bugfix:** Don't ignore `componentClass` on `<ListGroup>` when using only `<ListGroupItem>` children ([#2026])
- **Bugfix:** Don't assign default `key` to `<Breadcrumb>`, `<Carousel>`, `<ListGroup>`, `<Nav>`, `<PanelGroup>`, `<Pager>`, or `<ProgressBar>` children ([#2026], [#2036])
- **Bugfix:** Remove pointless update-deferral-during-`onSelect` logic in `<PanelGroup>` ([#2026])
- **Bugfix:** Use consistent `bsClass` handling on dropdown components ([#2036])
- **Bugfix:** Remove extraneous `.collapsed` on collapsible panel title anchor ([#2036])
- **Bugfix:** Improve edge case handling in tab animation state management and styling ([#2036])
- **Bugfix:** Stop assigning refs unnecessarily ([#2078])
- **Refactor:** Clean up context usage on navbar components ([#2036])
- **Refactor:** Sync up context usage on modals to other components ([#2044])

[v0.30.0]: https://github.com/react-bootstrap/react-bootstrap/compare/v0.29.5...v0.30.0
[#1957]: https://github.com/react-bootstrap/react-bootstrap/pull/1957
[#1976]: https://github.com/react-bootstrap/react-bootstrap/pull/1976
[#2011]: https://github.com/react-bootstrap/react-bootstrap/pull/2011
[#2014]: https://github.com/react-bootstrap/react-bootstrap/pull/2014
[#2015]: https://github.com/react-bootstrap/react-bootstrap/pull/2015
[#2016]: https://github.com/react-bootstrap/react-bootstrap/pull/2016
[#2017]: https://github.com/react-bootstrap/react-bootstrap/pull/2017
[#2018]: https://github.com/react-bootstrap/react-bootstrap/pull/2018
[#2026]: https://github.com/react-bootstrap/react-bootstrap/pull/2026
[#2036]: https://github.com/react-bootstrap/react-bootstrap/pull/2036
[#2044]: https://github.com/react-bootstrap/react-bootstrap/pull/2044
[#2052]: https://github.com/react-bootstrap/react-bootstrap/pull/2052
[#2078]: https://github.com/react-bootstrap/react-bootstrap/pull/2078
[#2079]: https://github.com/react-bootstrap/react-bootstrap/pull/2079


## [v0.29.5]
> 2016-06-18

- **Feature:** Allow function refs on dropdown components ([#1948])
- **Bugfix:** Fix bugs with tab selection and state management ([#1956])

[v0.29.5]: https://github.com/react-bootstrap/react-bootstrap/compare/v0.29.4...v0.29.5
[#1948]: https://github.com/react-bootstrap/react-bootstrap/pull/1948
[#1956]: https://github.com/react-bootstrap/react-bootstrap/pull/1956


## [v0.29.4]
> 2016-05-10

- **Feature:** Add `inputRef` to `<Checkbox>` and `<Radio>` ([#1865])
- **Bugfix:** Persist `<Panel>` events before modifying them ([#1864])
- **Bugfix:** Add back `eventKey` to props for custom pagination buttons ([#1876])

[v0.29.4]: https://github.com/react-bootstrap/react-bootstrap/compare/v0.29.3...v0.29.4
[#1864]: https://github.com/react-bootstrap/react-bootstrap/pull/1864
[#1865]: https://github.com/react-bootstrap/react-bootstrap/pull/1865
[#1876]: https://github.com/react-bootstrap/react-bootstrap/pull/1876


## [v0.29.3]
> 2016-04-28

- **Feature:** Add `unmountOnExit` support to tabs ([#1823])
- **Bugfix:** Do not pass `onSelect` to DOM nodes ([#1861])
- **Bugfix:** Do not throw error when tab group has no panes ([#1862])
- **Bugfix:** Fix setting `id` for `<NavItem>`s for tabs ([#1862])

[v0.29.3]: https://github.com/react-bootstrap/react-bootstrap/compare/v0.29.2...v0.29.3
[#1823]: https://github.com/react-bootstrap/react-bootstrap/pull/1823
[#1861]: https://github.com/react-bootstrap/react-bootstrap/pull/1861
[#1862]: https://github.com/react-bootstrap/react-bootstrap/pull/1862


## [v0.29.2]
> 2016-04-22

- **Bugfix:** Don't always set `tabIndex` on `<SafeAnchor>` ([#1844])

[v0.29.2]: https://github.com/react-bootstrap/react-bootstrap/compare/v0.29.1...v0.29.2
[#1844]: https://github.com/react-bootstrap/react-bootstrap/pull/1844


## [v0.29.1]
> 2016-04-21

- **Bugfix:** Don't incorrectly pass `onSelect` past `<TabContainer>` ([#1825])
- **Bugfix:** Set `role` instead of `type` on `<Dropdown.Toggle>` button ([#1835])

[v0.29.1]: https://github.com/react-bootstrap/react-bootstrap/compare/v0.29.0...v0.29.1
[#1825]: https://github.com/react-bootstrap/react-bootstrap/pull/1825
[#1835]: https://github.com/react-bootstrap/react-bootstrap/pull/1835


## [v0.29.0]
> 2016-04-18

- **Breaking:** Change `onSelect` signature to be `(eventKey: any, event: SyntheticEvent) => any` on all React-Bootstrap components, instead of the old inconsistent mishmash ([#1604], [#1677], [#1756])
- **Breaking:** Remove deprecated `duration` on transition components ([#1608])
- **Breaking:** Remove deprecated functionality from `<Nav>`, `<Navbar>`, and related components ([#1608], [#1745])
- **Breaking:** Don't check for prefixed `bsStyle` in `bootstrapUtils.getClassSet` ([#1759])
- **Breaking:** Disable click handlers on `disabled` components ([#1794])
- **Breaking:** In components with wrapped anchors, pass through all props other than `className` and `style` to the wrapped anchor ([#1801])
- **Breaking:** Use consistent exports from `bootstrapUtils` ([#1813])
- **Feature/Deprecation:** Add lower-level tab components, and deprecate horizontal layout support in `<Tabs>` in favor of lower-level components ([#1607], [#1784])
- **Feature/Deprecation:** Deprecate `dialogComponent` in favor of new `dialogComponentClass` on `<Modal>` for consistency with other components ([#1753])
- **Feature/Deprecation:** Rewrite form and form control API (`<FormControl>`, &c.), and deprecate the old API (`<Input>`, &c.) ([#1765])
- **Deprecation:** Deprecate `dismissAfter` on `<Alert>` ([#1636])
- **Deprecation:** Deprecate label interpolation (e.g. `label="%(percent)s%"`) in `<ProgressBar>` ([#1751])
- **Bugfix:** Set `collapsed` class on `<Navbar.Toggle>` ([#1733])

[v0.29.0]: https://github.com/react-bootstrap/react-bootstrap/compare/v0.28.5...v0.29.0
[#1604]: https://github.com/react-bootstrap/react-bootstrap/pull/1604
[#1607]: https://github.com/react-bootstrap/react-bootstrap/pull/1607
[#1608]: https://github.com/react-bootstrap/react-bootstrap/pull/1608
[#1636]: https://github.com/react-bootstrap/react-bootstrap/pull/1636
[#1677]: https://github.com/react-bootstrap/react-bootstrap/pull/1677
[#1733]: https://github.com/react-bootstrap/react-bootstrap/pull/1733
[#1745]: https://github.com/react-bootstrap/react-bootstrap/pull/1745
[#1751]: https://github.com/react-bootstrap/react-bootstrap/pull/1751
[#1753]: https://github.com/react-bootstrap/react-bootstrap/pull/1753
[#1756]: https://github.com/react-bootstrap/react-bootstrap/pull/1756
[#1759]: https://github.com/react-bootstrap/react-bootstrap/pull/1759
[#1765]: https://github.com/react-bootstrap/react-bootstrap/pull/1765
[#1784]: https://github.com/react-bootstrap/react-bootstrap/pull/1784
[#1794]: https://github.com/react-bootstrap/react-bootstrap/pull/1794
[#1801]: https://github.com/react-bootstrap/react-bootstrap/pull/1801
[#1813]: https://github.com/react-bootstrap/react-bootstrap/pull/1813


## [v0.28.5]
> 2016-04-01

- **Feature:** Support `<Breadcrumb.Item>` in addition to `<BreadcrumbItem>` for breadcrumb items ([#1722])
- **Feature:** Add `<Carousel.Caption>` for carousel captions ([#1734])
- **Feature:** Support `<Carousel.Item>` in addition to `<CarouselItem>` for carousel items ([#1740])
- **Feature:** Add `<Clearfix>` for grids ([#1736])
- **Bugfix:** Support `style` on nested `<ProgressBar>` ([#1719])
- **Bugfix:** Fix CommonJS export for `<Media>` ([#1737])
- **Bugfix:** Support `className` and `style` on `<MenuItem header>` and `<MenuItem divider>` ([#1748])
- **Bugfix:** Support extra props for `<Navbar.Header>` and `<Navbar.Toggle>` ([#1754])

[v0.28.5]: https://github.com/react-bootstrap/react-bootstrap/compare/v0.28.4...v0.28.5
[#1719]: https://github.com/react-bootstrap/react-bootstrap/pull/1719
[#1722]: https://github.com/react-bootstrap/react-bootstrap/pull/1722
[#1734]: https://github.com/react-bootstrap/react-bootstrap/pull/1734
[#1736]: https://github.com/react-bootstrap/react-bootstrap/pull/1736
[#1737]: https://github.com/react-bootstrap/react-bootstrap/pull/1737
[#1740]: https://github.com/react-bootstrap/react-bootstrap/pull/1740
[#1748]: https://github.com/react-bootstrap/react-bootstrap/pull/1748
[#1754]: https://github.com/react-bootstrap/react-bootstrap/pull/1754


## [v0.28.4]
> 2016-03-24

- **Feature:** Add `componentClass` on `<FormControls.Static>` ([#1653])
- **Feature:** Add transition hooks on collapsible `<Panel>` ([#1664])
- **Feature:** Add `<Media>` and related components ([#1707])
- **Bugfix:** Support `className` on `<MenuItem divider>` ([#1682])
- **Bugfix:** Support `className` on `<Navbar.Header>` ([#1695])

[v0.28.4]: https://github.com/react-bootstrap/react-bootstrap/compare/v0.28.3...v0.28.4
[#1653]: https://github.com/react-bootstrap/react-bootstrap/pull/1653
[#1664]: https://github.com/react-bootstrap/react-bootstrap/pull/1664
[#1682]: https://github.com/react-bootstrap/react-bootstrap/pull/1682
[#1695]: https://github.com/react-bootstrap/react-bootstrap/pull/1695
[#1707]: https://github.com/react-bootstrap/react-bootstrap/pull/1707


v0.28.3 - Thu, 11 Feb 2016 00:00:42 GMT
---------------------------------------

- [922ecae](../../commit/922ecae) [fixed] Allow overriding aria-label on <SplitButton> toggle
- [f187e04](../../commit/f187e04) [fixed] Use actual ellipsis in pagination
- [f4c1525](../../commit/f4c1525) [added] pagination boundaryLinks
- [9331141](../../commit/9331141) [fixed] remove extra tabIndex



v0.28.2 - Fri, 08 Jan 2016 06:38:06 GMT
---------------------------------------

- [1bee8a2](../../commit/1bee8a2) [added] responsively hiding columns
- [653bb17](../../commit/653bb17) [fixed] a11y: setting tabIndex="-1" for the dismiss button of Alerts since aria-hidden="true"
- [1d07197](../../commit/1d07197) [fixed] don't add aria-label to modal header and close button
- [035e553](../../commit/035e553) [fixed] navbar-default not added for custom styles



v0.28.1 - Mon, 16 Nov 2015 20:04:34 GMT
---------------------------------------





v0.28.0 - Mon, 16 Nov 2015 18:42:38 GMT
---------------------------------------

- [21cab20](../../commit/21cab20) [changed] dropdown props are passed through to the dropdown Button
- [f9ea411](../../commit/f9ea411) [changed] navbar `navExpanded` to `expanded`
- [0be007f](../../commit/0be007f) [removed] Nav `right` prop in favor of `pullRight`
- [5dbafd3](../../commit/5dbafd3) [changed] Split the Navbar component into sub-components
- [59c9571](../../commit/59c9571) [changed] remove extra wrapping `<nav>` element in Nav components
- [229cb2c](../../commit/229cb2c) [fixed] aria-label properly passed to the Modal header button
- [345f4b4](../../commit/345f4b4) [changed] Only add the `navigation` role to navbar when not using a <nav>
- [44b3b9e](../../commit/44b3b9e) [fixed] when overlay animation is false the transition prop passed to base overlay should be null so that it does not trigger a React PropTypes warning
- [0f3ee3e](../../commit/0f3ee3e) [removed] bootstrap mixin
- [df2f1a3](../../commit/df2f1a3) [fixed] Don't clone children in ResponsiveEmbed



v0.27.3 - Mon, 26 Oct 2015 13:59:37 GMT
---------------------------------------

- [9d5df37](../../commit/9d5df37) [fixed] OverlayTrigger show/hide timeout management
- [6e37b27](../../commit/6e37b27) [fixed] Remove cross import between Button & ButtonInput
- [6bad1e8](../../commit/6bad1e8) [fixed] Explicitly disallow justified Navbar Navs



v0.27.2 - Sun, 18 Oct 2015 02:21:06 GMT
---------------------------------------

- [e333c3d](../../commit/e333c3d) [fixed] Falsy href handling on MenuItem
- [4f4017e](../../commit/4f4017e) [fixed] DropdownTitle children v. title
- [8612b91](../../commit/8612b91) [fixed] Respect onClick on MenuItem
- [b64ed11](../../commit/b64ed11) [fixed] Put onClick on correct element on NavItem
- [9e4c041](../../commit/9e4c041) [fixed] Incorrect 'aria-selected' on NavItem
- [0b0ac36](../../commit/0b0ac36) [added] Custom labels for Pagination's special element (ellipsis, first, last, prev & next)



v0.27.1 - Thu, 08 Oct 2015 17:48:24 GMT
---------------------------------------

- [e64230c](../../commit/e64230c) [fixed] Don't include react-dom in the bundles



v0.27.0 - Wed, 07 Oct 2015 21:49:21 GMT
---------------------------------------

- [583febb](../../commit/583febb) [removed] unnecessary functionality in React v0.14
- [049e538](../../commit/049e538) [changed] Update for React v0.14



v0.26.2 - Wed, 07 Oct 2015 16:43:16 GMT
---------------------------------------

- [ca52c30](../../commit/ca52c30) [fixed] Actually export the Image component
- [73daba7](../../commit/73daba7) [fixed] Show toggle button when using NavBrand



v0.26.1 - Mon, 05 Oct 2015 02:04:27 GMT
---------------------------------------





v0.26.0 - Sun, 04 Oct 2015 21:21:22 GMT
---------------------------------------

- [b7853bb](../../commit/b7853bb) [fixed] Dropdown focus behavior on click
- [dbb0385](../../commit/dbb0385) [added] #1320 allow NavItem class to be set
- [3d13dda](../../commit/3d13dda) [fixed] #1287 ListGroupItem with onClick and header properly displays header
- [3f5c6e3](../../commit/3f5c6e3) [added] #1181 ListGroup supports componentClass prop
- [b5a9f3a](../../commit/b5a9f3a)     [added] NavBrand Component
- [ac37698](../../commit/ac37698) [added] 'Responsive embed' component
- [1c2d054](../../commit/1c2d054) [fixed] Set the disabled css class so that the text is greyed out.
- [0348274](../../commit/0348274) [fixed] Breadcrumb and BreadcrumbItem components
- [3c710f9](../../commit/3c710f9) [added] Breadcrumb component
- [99d333f](../../commit/99d333f) [changed] use `lodash-compat` for IE8 compatibility and `lodash` for dev
- [ce564cb](../../commit/ce564cb) [fixed] any props not known by DropdownMenu are passed through to the underlying ul
- [674d67e](../../commit/674d67e) [added] images component
- [deee09d](../../commit/deee09d) [fixed] stop rendering extra attributes on Progress bar dom nodes
- [02f1fec](../../commit/02f1fec) [fixed] allow null activeKey (empty) selection
- [656f40d](../../commit/656f40d) [changed] 'id' prop-type made uniform throughout the project
- [b9a4477](../../commit/b9a4477) [changed] use 'react-prop-types' instead of 'utils/CustomPropTypes'



v0.25.2 - Sat, 12 Sep 2015 15:59:13 GMT
---------------------------------------

- [f2c3b68](../../commit/f2c3b68) [changed] tab keyboard navigation to be more inline with ARIA spec
- [0c27403](../../commit/0c27403) [fixed] Don't render Grid or Row with Tabs
- [b847dec](../../commit/b847dec) [added] active prop on MenuItem (again)
- [3a369cc](../../commit/3a369cc) [fixed] Error on opening dropdown without focusable items
- [bad277e](../../commit/bad277e) [changed] Use PropTypes.node for validation and fix/add tests
- [533530a](../../commit/533530a) [added] Adds a callout to the sr-only button in `Closable Alerts`
- [1f29000](../../commit/1f29000) [fixed] screen-reader accessible dismiss button on alerts
- [c8a59c6](../../commit/c8a59c6) [fixed] OverlayTrigger hover triggers on mousenter/leave
- [9c69271](../../commit/9c69271) [fixed] OverlayTrigger event handlers are properly maintained
- [da1d0bc](../../commit/da1d0bc) [fixed] focus returns to the toggle by default onClose



v0.25.1 - Fri, 28 Aug 2015 18:30:59 GMT
---------------------------------------

- [478300a](../../commit/478300a) [fixed] Handle falsey DropdownMenu  children correctly
- [c450e96](../../commit/c450e96) [fixed] stop rendering extra attributes on Progress bar dom nodes
- [3ceb7af](../../commit/3ceb7af) [fixed] allow null activeKey (empty) selection
- [a7f93ae](../../commit/a7f93ae) [fixed] title is not passed to tab pane DOM node
- [1bee466](../../commit/1bee466) [changed] 'id' prop-type made uniform throughout the project
- [e438250](../../commit/e438250) [fixed] 'isRequireForA11y' undefined/null checking
- [664b465](../../commit/664b465) [fixed] id passthrough for MenuItem



v0.25.0 - Tue, 25 Aug 2015 18:56:33 GMT
---------------------------------------

- [8776128](../../commit/8776128) [fixed] Affix in IE10 - scrollHeight #1073
- [adad32e](../../commit/adad32e) [added] PropType validation for headerRole and panelRole
- [346501e](../../commit/346501e) [changed] DropdownButton, SplitButton, DropdownMenu, MenuItem completely rewritten
- [653d2ff](../../commit/653d2ff) [changed] deprecate domUtils as a public API
- [769781d](../../commit/769781d) [added] accessibility props for PanelGroup and Panels.
- [5f0ac64](../../commit/5f0ac64) [added] Implements a generalized left-aligned version of tabs
- [628d586](../../commit/628d586) [changed] deprecated Position, Transition, Portal
- [03a6a61](../../commit/03a6a61) [changed] deprecated the Transition duration prop
- [459ab0c](../../commit/459ab0c) [added] #460 ListGroupItem outputs <button> when an onClick handler is set.
- [e482ede](../../commit/e482ede) [fixed] wrong tabs switching animation for 'Tabs' component
- [b62e1f5](../../commit/b62e1f5) [fixed] wrong tabs switching animation for 'TabbedArea' component
- [d0ff625](../../commit/d0ff625) [added] aria role "tablist" to the Nav on Tabs
- [e7cf455](../../commit/e7cf455) [changed] New Tabs API
- [f6d32c4](../../commit/f6d32c4) [changed] deprecate 'utils/CustomPropTypes' exporting
- [caff9a0](../../commit/caff9a0) [removed] Factory support



v0.24.5 - Fri, 14 Aug 2015 18:02:13 GMT
---------------------------------------

- [dc2a07a](../../commit/dc2a07a) [fixed] Collapse exported as Fade
- [f53bcf5](../../commit/f53bcf5) [fixed] 'bsSize' and 'bsStyle' properties has been removed from 'Glyphicon'



v0.24.4 - Mon, 10 Aug 2015 19:33:35 GMT
---------------------------------------

- [b688014](../../commit/b688014) [added] custom feedback icons for Input
- [83cdaa3](../../commit/83cdaa3) [added] formControlFeedback prop to Glyphicon
- [2ecac68](../../commit/2ecac68) [fixed] Modal uses provided className again
- [47bd7f6](../../commit/47bd7f6) [fixed] disabled pagination buttons should not fire 'onSelect'
- [c60dc03](../../commit/c60dc03) [fixed] only add aria-expanded to Collapse when an ARIA role is present



v0.24.3 - Fri, 31 Jul 2015 18:09:54 GMT
---------------------------------------

- [02f8966](../../commit/02f8966) [changed] Update dependencies
- [bae8ba9](../../commit/bae8ba9) [fixed] Carousel checks if it is mounted before setting state
- [fd8d4d2](../../commit/fd8d4d2) [fixed] regression when clicking "static" modal backdrops
- [0f46a97](../../commit/0f46a97) [added] Allow custom Modal dialog components
- [a4ce7e1](../../commit/a4ce7e1) [fixed] added finalisation for the Modal when it was unbound from the tree
- [d89d5f3](../../commit/d89d5f3) [fixed] Modal error when backdrop is `false`
- [f410904](../../commit/f410904) [added] 'xs, sm, md, lg' values for 'bsSize'
- [2558f32](../../commit/2558f32) [fixed] TabbedArea panes rendering with animation
- [90aece6](../../commit/90aece6) [changed] Simplify 'styleMaps.STYLES' to be of Array type
- [860d168](../../commit/860d168) [fixed] allow totally custom styles via 'bsStyle'
- [74da76a](../../commit/74da76a) [fixed] Prevent click on PageItem if disabled



v0.24.2 - Sat, 25 Jul 2015 00:47:07 GMT
---------------------------------------

- [4271eb3](../../commit/4271eb3) [fixed] add lodash as direct dependency



v0.24.1 - Fri, 24 Jul 2015 23:12:09 GMT
---------------------------------------

- [e5155c6](../../commit/e5155c6) [fixed] ensure last focused item can be focused
- [6a541ff](../../commit/6a541ff) [added] buttonComponentClass prop for Pagination
- [29fe417](../../commit/29fe417) [fixed] overlay classNames are maintained by overlayTrigget
- [d272389](../../commit/d272389) [added] Overlay and OverlayTrigger accept Transition callbacks
- [596f40c](../../commit/596f40c) [fixed] Modal uses bsClass prop to set its classes
- [86d3feb](../../commit/86d3feb) [fixed] added missed 'aria-label' prop type validation for 'ModalHeader'
- [58eaab0](../../commit/58eaab0) [changed] pass transition callbacks to Modal Transition
- [abccff9](../../commit/abccff9) [changed] expose static Modal Dialog component
- [b5c1893](../../commit/b5c1893) [changed] unfix 'babel' back.



v0.24.0 - Tue, 21 Jul 2015 22:13:05 GMT
---------------------------------------

- [924f8fb](../../commit/924f8fb) [fixed] Tooltip accepts a style prop
- [dd064ad](../../commit/dd064ad) [fixed] remove extraneous styling
- [c837d8d](../../commit/c837d8d) [fixed] Only calculate overlay position on display
- [fbf9ed6](../../commit/fbf9ed6) [changed] Add deprecation warning that factories will be removed
- [a4385d3](../../commit/a4385d3) [fixed] Portal doesn't mount extra node
- [6744b94](../../commit/6744b94) [fixed] 'modalClassName' property for 'ModalTitle'
- [3e6523a](../../commit/3e6523a) [added] ListGroup supports iterator as child
- [ec368f0](../../commit/ec368f0) [added] Fade Component, replaces FadeMixin
- [0503507](../../commit/0503507) [added] Collapse Component, replaces CollapsibleMixin
- [4fb7e0d](../../commit/4fb7e0d) [changed] Remove Overlay and Modal deprecations
- [0683df7](../../commit/0683df7) [fixed] 'stacked' progress with 'active' and 'striped' children
- [a3c5400](../../commit/a3c5400) [fixed] Add missed 'type' property React.PropTypes.<type> checking
- [a4c065e](../../commit/a4c065e) [added] links to every component / example on Components page
- [eb0c323](../../commit/eb0c323) [fixed] Position.js typo `componentDidUpate`
- [9feddf9](../../commit/9feddf9) [fixed] 'componentWillReceiveProps' method name of Position component
- [c64679f](../../commit/c64679f) [fixed] Active Next and Last button in Pagination when ellipsis=true and items=0
- [9dae734](../../commit/9dae734) [fixed] Negative page number in Pagination when ellipsis=true and items=1
- [ffbcf39](../../commit/ffbcf39) [fixed] html id and class attributes handling for Nav
- [89ea6ed](../../commit/89ea6ed) [fixed] Add missed propType validation for Button 'type' property
- [b1b6a4c](../../commit/b1b6a4c) [changed] Add two-release deprecation policy
- [e89b9bc](../../commit/e89b9bc) [removed] Don't need to disable Babel cache
- [d12d59e](../../commit/d12d59e) [changed] Enabled "loose" Babel transpilation
- [01c547f](../../commit/01c547f) [fixed] Do not use Babel cache for release build
- [b67081b](../../commit/b67081b) [fixed] rootClose behavior on replaced elements
- [fbbb344](../../commit/fbbb344) [fixed] bower template.
- [fafe46f](../../commit/fafe46f) [changed] Use named exports in index files
- [6e985b0](../../commit/6e985b0) [removed] Individual files in bower release
- [598b9d8](../../commit/598b9d8) [fixed] SafeAnchor event ordering
- [beaa1fa](../../commit/beaa1fa) [changed] `PaginationButton` to use `SafeAnchor`
- [9c09e2a](../../commit/9c09e2a) [fixed] Keyboard accessibility for anchors serving as buttons
- [ce5b436](../../commit/ce5b436) [removed] Input type=submit deprecation warning.



v0.23.7 - Wed, 01 Jul 2015 15:18:30 GMT
---------------------------------------

- [35ea201](../../commit/35ea201) [fixed] Accidental breaking change in Modal trigger



v0.23.6 - Wed, 01 Jul 2015 00:48:02 GMT
---------------------------------------

- [1b1af04](../../commit/1b1af04) [changed] deprecate ModalTrigger
- [83b4cbc](../../commit/83b4cbc) [changed] Modal doesn't require ModalTrigger
- [d70f617](../../commit/d70f617) [changed] tooltips and popovers required id's for a11y
- [389cf3f](../../commit/389cf3f) [changed] Deprecate OverlayTrigger positioning api and "manual" trigger
- [5eb8666](../../commit/5eb8666) [added] Overlay component
- [1638f69](../../commit/1638f69) [added] Position component for custom Overlays
- [f799110](../../commit/f799110) [added] Portal component; replaces OverlayMixin
- [97ef415](../../commit/97ef415) [fixed] Modal won't steal focus from children
- [a8b177a](../../commit/a8b177a) [fixed] Stack overflow with nested Modals
- [3caa866](../../commit/3caa866) [changed] Update babel-loader
- [6ffa325](../../commit/6ffa325) [fixed] 'componentClass' property type is 'elementType' now
- [0e5980f](../../commit/0e5980f) [added] 'elementType' custom prop type validator
- [8f582d2](../../commit/8f582d2) [changed] Update karma-chrome-launcher. Dev dependency
- [d4089d0](../../commit/d4089d0) [changed] Update eslint-plugin-mocha. Dev dependency
- [fd547f4](../../commit/fd547f4) [changed] Update karma-mocha. Dev dependency.
- [c5797e8](../../commit/c5797e8) [added] componentClass prop to Jumbotron



v0.23.5 - Tue, 23 Jun 2015 01:31:35 GMT
---------------------------------------

- [23f9d21](../../commit/23f9d21) [changed] Add missed prop types validations.
- [320b7ab](../../commit/320b7ab) [changed] Update fs-extra. Dev dependency.
- [2ffcf5d](../../commit/2ffcf5d) [fixed] Popovers flicker when moving mouse amongst children of the trigger
- [ccc50e0](../../commit/ccc50e0) [fixed] Accessibility: Panel header uses aria-controls
- [1e552cc](../../commit/1e552cc) [added] Accessibility: use appropriate ARIA's when an id is given to the tabbed area
- [8752754](../../commit/8752754) [added] Add linkId prop to NavItem
- [722969d](../../commit/722969d) [added] Accessibility, add tab roles when type "tabs"
- [4adaa70](../../commit/4adaa70) [added] Accessibility: role 'alert' and aria-label to Alert component
- [2594dce](../../commit/2594dce) [fixed] Modal Null Exception when react-bootstrap is loaded before the Body tag
- [e77bf88](../../commit/e77bf88) [changed] Update eslint. Dev dependency.



v0.23.4 - Tue, 16 Jun 2015 00:37:04 GMT
---------------------------------------

- [0ce46b9](../../commit/0ce46b9) [changed] only autofocus modals when enforceFocus is true (the default)
- [c5855d2](../../commit/c5855d2) [changed] createChainedFunction to chain many functions, and to throw if non-functions are provided.
- [d18dadb](../../commit/d18dadb) [fixed] container content no longer shifts when overflowing
- [66f0f92](../../commit/66f0f92) [added] enforceFocus prop to Modal
- [3869ca2](../../commit/3869ca2) [fixed] Modal doesn't "jump" when container is overflowing



v0.23.3 - Fri, 12 Jun 2015 21:46:30 GMT
---------------------------------------

- [9ca26e9](../../commit/9ca26e9) [added] contains "polyfill" to domUtils
- [3a254a1](../../commit/3a254a1) [added] Deprecation warning for individual file use in the Bower release
- [73c7705](../../commit/73c7705) [changed] Update chai. Dev dependency.
- [3ca90c7](../../commit/3ca90c7) [changed] Update karma-sinon-chai. Dev dependency.
- [cc4e820](../../commit/cc4e820) [changed] Update fs-extra. Dev dependency.



v0.23.2 - Mon, 08 Jun 2015 18:56:48 GMT
---------------------------------------

- [7211dcb](../../commit/7211dcb) [added] Add prevIcon and nextIcon props as node proptypes to Carousel
- [5734ec3](../../commit/5734ec3) [added] Pagination component
- [2f8c454](../../commit/2f8c454) [changed] Assert ProgressBar children can be ProgressBar only.
- [2c46820](../../commit/2c46820) [added] `createSelectedEvent` for consistent onSelect handling
- [c2ff9ad](../../commit/c2ff9ad) [added] property disabled on MenuItem



v0.23.1 - Tue, 02 Jun 2015 16:57:57 GMT
---------------------------------------

- [4d265f0](../../commit/4d265f0) [fixed] Use babel api to avoid command line conflicts between Linux and Windows
- [0cfbf3b](../../commit/0cfbf3b) [fixed] IE8 will now close an open DropdownButton menu when clicking button
- [d105749](../../commit/d105749) [added] utils object to exported src/index
- [29bc64f](../../commit/29bc64f) [changed] Remove Dev dependency babel-plugin-object-assign.
- [1fec852](../../commit/1fec852) [changed] Update karma-phantomjs-launcher. Dev dependency.
- [f494604](../../commit/f494604) [changed] Update eslint. Dev dependency.
- [a4331ed](../../commit/a4331ed) [changed] Make the brand name consistent.
- [b213be0](../../commit/b213be0) [changed] Remove ES6 sources from npm distribution.
- [73c5ec9](../../commit/73c5ec9) [changed] Remove extraneous utils/Object.assign.js
- [935171f](../../commit/935171f) [added] Now accepting a `block` property on the ButtonGroup component. Closes #240.
- [dfec023](../../commit/dfec023) [added] CustomPropType.all to allow multiple validations



v0.23.0 - Tue, 26 May 2015 19:32:52 GMT
---------------------------------------

- [fd24317](../../commit/fd24317) [changed] Removed `collapsable` deprecated functionality.
- [3ebac95](../../commit/3ebac95) [fixed] bug #731. `babel ES6 import` + `React` quirk.
- [0c61f46](../../commit/0c61f46) [changed] Moving type=static out of Input
- [2749cfd](../../commit/2749cfd) [added] CustomPropTypes.singlePropFrom
- [536c3e0](../../commit/536c3e0) [fixed] Replaced document with ownerDocument in Modal
- [91f0222](../../commit/91f0222) [changed] Update css-loader. Dev dependency.
- [66e41a4](../../commit/66e41a4) [fixed] Fix scroll top calculation for overlays
- [5313abe](../../commit/5313abe) [fixed] Modal is focused when opened, for improved accessibility
- [50d058a](../../commit/50d058a) [fixed] server side rendering for Modal component
- [c57d6b0](../../commit/c57d6b0) [changed] Update css-loader. Dev dependency.


v0.22.6 - Wed, 20 May 2015 16:46:29 GMT
---------------------------------------

- [2a35eab](../../commit/2a35eab) [fixed] Fix CodeMirrorEditor binding
- [5dc0ac2](../../commit/5dc0ac2) [added] Enable rootClose for OverlayTrigger


v0.22.5 - Tue, 19 May 2015 20:40:51 GMT
---------------------------------------

- [dc7ef19](../../commit/dc7ef19) [added] dialogClassName prop to modal to be able to pass custom css class to modal-dialog div
- [658fa39](../../commit/658fa39) [fixed] Remove unused variable


v0.22.4 - Mon, 18 May 2015 16:53:06 GMT
---------------------------------------

- [9d17d56](../../commit/9d17d56) [added] Thumbnail component
- [db018fa](../../commit/db018fa) [fixed] Put AMD modules under correct path
- [0904adc](../../commit/0904adc) [added] Active property to MenuItem component
- [1658142](../../commit/1658142) [added] Property for animation on Popover and Tooltip
- [4f37560](../../commit/4f37560) [fixed] Update classnames dep version for Bower
- [f6e7d67](../../commit/f6e7d67) [fixed] Bower cannot use code from react/lib.
- [1531ac9](../../commit/1531ac9) [added] DropdownButton now applies onClick prop to Button
- [ecb0861](../../commit/ecb0861) [fixed] Fix propType warning in ButtonInputExample
- [592a346](../../commit/592a346) [fixed] Forward classes to panel title


v0.22.3 - Thu, 14 May 2015 22:19:11 GMT
---------------------------------------

- [96baa15](../../commit/96baa15) [fixed] Fix propTypes for overlays


v0.22.2 - Thu, 14 May 2015 20:36:17 GMT
---------------------------------------

- [03211db](../../commit/03211db) [fixed] Fit overlay within viewport boundary
- [576827f](../../commit/576827f) [changed] Introducing ButtonInput


v0.22.1 - Thu, 14 May 2015 17:54:32 GMT
---------------------------------------

- [d3f57c5](../../commit/d3f57c5) [added] TabbedArea allows disabled tabs


v0.22.0 - Wed, 13 May 2015 18:31:52 GMT
---------------------------------------

- [061bef2](../../commit/061bef2) [fixed] update link to react-router-bootstrap in README
- [0fb9b57](../../commit/0fb9b57) [changed] Updated extract-text-webpack-plugin. Dev dependency.
- [ca689c0](../../commit/ca689c0) [changed] Updated eslint dev-dependency
- [0f90799](../../commit/0f90799) [added] react-hot-loader when developing docs
- [4cd5845](../../commit/4cd5845) [added] FormGroup/Input bsSize now propgates correctly as form-group-\* classes
- [6ce8870](../../commit/6ce8870) [added] Introduction Page.
- [1c6c74b](../../commit/1c6c74b) [fixed] Modal div.modal-content should not have hidden class
- [51a205f](../../commit/51a205f) [changed] collapsable => collapsible property
- [f77c955](../../commit/f77c955) [changed] Updated classnames dependency
- [5a76e94](../../commit/5a76e94) [added] favicon
- [8da11b4](../../commit/8da11b4) [added] convenience factories for non-JSX users in lib/factories


v0.21.2 - Fri, 01 May 2015 19:36:56 GMT
---------------------------------------

- [a07aa20](../../commit/a07aa20) [fixed] Bug introduced by new deprecation code.
- [fef8984](../../commit/fef8984) [fixed] #597 able to set ID on ListGroup


v0.21.1 - Wed, 29 Apr 2015 21:44:50 GMT
---------------------------------------

- [3767c43](../../commit/3767c43) [added] Added buttonClassName to DropdownButton
- [e59c4f8](../../commit/e59c4f8) [added] Clarification about implementing components.
- [0105127](../../commit/0105127) [changed] Renamed Collapsable* => Collapsible*
- [6b9c250](../../commit/6b9c250) [fixed] Fix for bug 547 in tools/release.
- [b86e03e](../../commit/b86e03e) [fixed] ListGroup rendering a ul when ListGroupItem has onClick handler
- [ddc8a85](../../commit/ddc8a85) [changed] Updated eslint dev-dependency
- [18c22ba](../../commit/18c22ba) [changed] Updated style-loader dev-dependency
- [01c16c1](../../commit/01c16c1) [changed] Updated css-loader dev-dependency
- [c295a9a](../../commit/c295a9a) [fixed] ModalTrigger passes onFocus prop and onBlur prop to child
- [131669b](../../commit/131669b) [fixed] ModalTrigger passes onMouseOver prop and onMouseOut prop to child
- [1249eff](../../commit/1249eff) [fixed] OverlayTrigger passes onClick prop to child
- [5f565b9](../../commit/5f565b9) [added] Docs example of passing component to navbar brand.
- [7811ce2](../../commit/7811ce2) [added] Dry run and verbose options to release process
- [22da8f9](../../commit/22da8f9) [fixed] ListGroup children array bugs. Fixes #548
- [b17a7b3](../../commit/b17a7b3) [added] release-docs script
- [4fedc95](../../commit/4fedc95) [fixed] Bug in Server vs Client side rendering of Navbar
- [1d8b7c7](../../commit/1d8b7c7) [fixes] #516 [added] TabbedArea NavItem renderTab() className
- [725deaa](../../commit/725deaa) [changed] Updated css-loader dev-dependency
- [eb29b11](../../commit/eb29b11) [changed] Updated style-loader dev-dependency
- [bc8cd5c](../../commit/bc8cd5c) [fixed] Fix for bug507.


v0.21.0 - Tue, 21 Apr 2015 13:38:38 GMT
---------------------------------------

- [e92a64b](../../commit/e92a64b) [fixed] Handle multiple children in Badge
- [c1b189f](../../commit/c1b189f) [changed] Updated babel* tools. dev-dependency
- [a58eab5](../../commit/a58eab5) [fixed] Fix 'import from' => 'import'
- [276c2bc](../../commit/276c2bc) [fixed] ProgressBar percentage issue when stacked
- [e1c95b3](../../commit/e1c95b3) [changed] Renamed constants to styleMaps and added styleMaps.addStyle()
- [20b608f](../../commit/20b608f) [fixed] Add missed semicolons.
- [2111799](../../commit/2111799) [fixed] Remove unused variables.
- [0e6b62a](../../commit/0e6b62a) [fixed] typo
- [0c87128](../../commit/0c87128) [fixed] `ListGroup` outputs `<ul>` or `<div>` depending on `ListGroupItem` (defaults to `<ul>` if no `ListGroupItem`). `ListGroupItem` outputs `<li>` or `<a>` if `href` prop is set.


v0.20.3 - Fri, 10 Apr 2015 19:50:22 GMT
---------------------------------------

- [3ecd393](../../commit/3ecd393) [fixed] Missing PropType Validations
- [8a9e95c](../../commit/8a9e95c) [fixed] Include missing PropType validations
- [6dfcf36](../../commit/6dfcf36) [changed] Internal variables classSet to classNames


v0.20.2 - Tue, 07 Apr 2015 01:51:55 GMT
---------------------------------------

- [723ee4d](../../commit/723ee4d) [fixed] Release scripts usage of rimraf
- [7175431](../../commit/7175431) [fixed] Don't try to access .ownerDocument on null
- [a58cff9](../../commit/a58cff9) [fixed] Numerous ESlint warnings (Removes 145 warnings)
- [c6c4108](../../commit/c6c4108) [added] Twitter follow link to docs page footer
- [20472b9](../../commit/20472b9) [fixed] Windows build


v0.20.1 - Sat, 04 Apr 2015 14:22:18 GMT
---------------------------------------

- [a060fbc](../../commit/a060fbc) [fixed] Re-add missing constants to public API


v0.20.0 - Tue, 31 Mar 2015 13:04:40 GMT
---------------------------------------

- [f1438b5](../../commit/f1438b5) [changed] Updated eslint-plugin-react dev-dependency
- [c8dda3f](../../commit/c8dda3f) [added] HuBoard badge and link
- [ee0382e](../../commit/ee0382e) [fixed] Use .ownerDocument instead of root document
- [182344a](../../commit/182344a) [changed] Updated express dev-dependency
- [6edadbd](../../commit/6edadbd) [changed] Updated mocha dev-dependency
- [64ac86d](../../commit/64ac86d) [changed] React dependency from 0.13.0 -> 0.13.1
- [367b870](../../commit/367b870) [changed] Updated karma-chai dev-dependency
- [1956d2a](../../commit/1956d2a) [changed] Updated style-loader dev-dependency
- [76c87bf](../../commit/76c87bf) [changed] Updated ESLint dev-dependency
- [84b9113](../../commit/84b9113) [changed] Update Bootstrap to 3.3.4
- [bfb3e6c](../../commit/bfb3e6c) [added] `standalone` prop to Input, which will not render the `form-group` class
- [721aacc](../../commit/721aacc) [fixed] Documentation on react install
- [6907e03](../../commit/6907e03) [changed] Renamed src/main.js -> src/index.js
- [5118b42](../../commit/5118b42) [added] Test for carousel control behaviour with wrap=true
- [ea479db](../../commit/ea479db) [fixed] show carousel controls if wrap is enabled


v0.19.1 - Thu, 26 Mar 2015 19:37:01 GMT
---------------------------------------

- [2b7d235](../../commit/2b7d235) [fixed] Re-added CollapsableNav to public API


v0.19.0 - Wed, 25 Mar 2015 21:25:57 GMT
---------------------------------------

- [98ee978](../../commit/98ee978) [changed] Source to ES6 using Babel and Webpack


v0.18.0 - Tue, 24 Mar 2015 02:56:15 GMT
---------------------------------------

- [728c2b0](../../commit/728c2b0) [fixed] docs CodeMirror scroll height too big
- [d282621](../../commit/d282621) [fixed] Split buttons with React 0.13
- [549da6e](../../commit/549da6e) [added] react-router dependency for docs
- [804c24a](../../commit/804c24a) [added] Support for React 0.13.x
- [4c26075](../../commit/4c26075) [fixed] Build status badge
- [70f8596](../../commit/70f8596) [added] Travis CI Optimization


v0.17.0 - Tue, 17 Mar 2015 15:03:27 GMT
---------------------------------------

- [4fae871](../../commit/4fae871) [added] CollapsableNav implements bootstrap markup for navbar-collapse
- [befed83](../../commit/befed83) [fixed] All panel-* classes dynamic based on bsStyle prop
- [de6f7dd](../../commit/de6f7dd) [fixed] CollapsableMixin fixed size
- [7cc4747](../../commit/7cc4747) [fixed] Added role="button" to NavItem for aria compliance.
- [3b6ba7a](../../commit/3b6ba7a) [fixed] Col Offset/Pull/Push of zero. Fixes #406
- [66c439f](../../commit/66c439f) [fixed] OverlayTrigger improvement related to #353 . Helps reduce browser reflows for lots of multiple OverlayTriggers being rendered at once. Before: http://i.imgur.com/e4UZ5l6.png , http://i.imgur.com/Tw39F9t.png After: http://i.imgur.com/bU0f7VY.png


v0.16.1 - Tue, 03 Mar 2015 23:04:19 GMT
---------------------------------------

- [71ff264](../../commit/71ff264) [added] bsSize prop to Input, supporting input groups


v0.16.0 - Fri, 27 Feb 2015 14:01:37 GMT
---------------------------------------

- [25b4143](../../commit/25b4143) [fixed] Define toggleNavKey in the propTypes
- [1a4ae1d](../../commit/1a4ae1d) [fixed] Fix rendering Navbar header when toggleNavKey is 0
- [13f395d](../../commit/13f395d) [added] bsStyle prop support for Modal to set the header color
- [c822837](../../commit/c822837) [removed] non-standard onClick props for ListGroup and ListGroupItem
- [1556e63](../../commit/1556e63) [added] Example for collapsable Navbar in docs.


v0.15.1 - Tue, 17 Feb 2015 14:30:54 GMT
---------------------------------------

- [587a34f](../../commit/587a34f) [fixed] Include .npmignore so compile lib dir is published


v0.15.0 - Mon, 16 Feb 2015 02:41:59 GMT
---------------------------------------

- [1ef51cb](../../commit/1ef51cb) [added] Changelog generation from commit messages
- [13baeaa](../../commit/13baeaa) [added] Release task to push and tag docs and bower repos
- [0193046](../../commit/0193046) [changed] Move built components to lib directory
