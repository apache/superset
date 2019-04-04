## [v0.7.4]
> 2017-10-24

- **Bugfix:** Only call `onRendered` in `<LegacyPortal>` on initial render ([#218])
- **Bugfix:** Use more robust method of getting `<Modal>` dialog element ([#220])
- **Bugfix:** Remove broken `getOverlayDOMNode` from `<Portal>` ([#222])

[v0.7.4]: https://github.com/react-bootstrap/react-overlays/compare/v0.7.3...v0.7.4
[#218]: https://github.com/react-bootstrap/react-overlays/pull/218
[#220]: https://github.com/react-bootstrap/react-overlays/pull/220
[#222]: https://github.com/react-bootstrap/react-overlays/pull/222


## [v0.7.3]
> 2017-10-14

- **Bugfix:** Support React v16 portal API ([#208])

[v0.7.3]: https://github.com/react-bootstrap/react-overlays/compare/v0.7.2...v0.7.3
[#208]: https://github.com/react-bootstrap/react-overlays/pull/208


## [v0.7.2]
> 2017-10-06

- **Bugfix:** Fix detecting escape keyboard event on IE ([#211])

[v0.7.2]: https://github.com/react-bootstrap/react-overlays/compare/v0.7.1...v0.7.2
[#211]: https://github.com/react-bootstrap/react-overlays/pull/211


## [v0.7.1]
> 2017-09-25

- **Bugfix:** Use `keydown` instead of incorrect `keyup` for `<Modal>` close keyboard event ([#195], [#204])

[v0.7.1]: https://github.com/react-bootstrap/react-overlays/compare/v0.7.0...v0.7.1
[#195]: https://github.com/react-bootstrap/react-overlays/pull/195
[#204]: https://github.com/react-bootstrap/react-overlays/pull/204


## [v0.7.0]
> 2017-04-22

- **Chore:** Update depedencies to avoid React deprecation warnings
- **Chore:** Use function refs ([#159])

[v0.7.0]: https://github.com/react-bootstrap/react-overlays/compare/v0.6.12...v0.7.0
[#159]: https://github.com/react-bootstrap/react-overlays/pull/159


## [v0.6.12]
> 2017-03-06

- **Feature:** Add `mountOnEnter` to `<Transition>` ([#144])
- **Feature:** Add `restoreFocus` to `<Modal>` ([#145])

[v0.6.12]: https://github.com/react-bootstrap/react-overlays/compare/v0.6.11...v0.6.12
[#144]: https://github.com/react-bootstrap/react-overlays/pull/144
[#145]: https://github.com/react-bootstrap/react-overlays/pull/145


## [v0.6.11]
> 2017-02-13

- **Feature:** Allow accessibility attributes on `<Modal>` root element ([#114])
- **Feature:** Expose triggering event in `onRootClose` callback ([#142])

[v0.6.11]: https://github.com/react-bootstrap/react-overlays/compare/v0.6.10...v0.6.11
[#114]: https://github.com/react-bootstrap/react-overlays/pull/114
[#142]: https://github.com/react-bootstrap/react-overlays/pull/142


## [v0.6.10]
> 2016-10-03

- **Bugfix:** Don't fire `onRootClose` in capture phase to avoid race conditions with React events ([#118])

[v0.6.10]: https://github.com/react-bootstrap/react-overlays/compare/v0.6.9...v0.6.10
[#118]: https://github.com/react-bootstrap/react-overlays/pull/118


## [v0.6.9]
> 2016-10-01

- **Bugfix:** Don't spuriously trigger `onRootClose` when React event handler unmounts event target ([#117])

[v0.6.9]: https://github.com/react-bootstrap/react-overlays/compare/v0.6.8...v0.6.9
[#117]: https://github.com/react-bootstrap/react-overlays/pull/117


## [v0.6.8]
> 2016-09-30

- **Feature:** Remove wrapping DOM element in `<RootCloseWrapper>` ([#116])
- **Bugfix:** Do not bind listeners for `<RootCloseWrapper>` when `disabled` is set ([#116])

[v0.6.8]: https://github.com/react-bootstrap/react-overlays/compare/v0.6.7...v0.6.8
[#116]: https://github.com/react-bootstrap/react-overlays/pull/116


## [v0.6.7]
> 2016-09-29

- **Feature:** Allow opt-out of `<Modal>` container styling ([#113])
- **Feature:** Add `renderBackdrop` to `<Modal>` ([#113])

[v0.6.7]: https://github.com/react-bootstrap/react-overlays/compare/v0.6.6...v0.6.7
[#113]: https://github.com/react-bootstrap/react-overlays/pull/113


## [v0.6.6]
> 2016-08-01

- **Bugfix:** Don't trigger PropTypes warning ([#105])

[v0.6.6]: https://github.com/react-bootstrap/react-overlays/compare/v0.6.5...v0.6.6
[#105]: https://github.com/react-bootstrap/react-overlays/pull/105


## [v0.6.5]
> 2016-07-13

- **Bugfix:** Make `target` on `<Portal>` work like `container` ([#102])

[v0.6.5]: https://github.com/react-bootstrap/react-overlays/compare/v0.6.4...v0.6.5
[#102]: https://github.com/react-bootstrap/react-overlays/pull/102


## [v0.6.4]
> 2016-07-11

- **Feature:** Add `disabled` prop to `<RootCloseWrapper>` ([#93])
- **Feature:** Add `event` prop to `<RootCloseWrapper>` to control mouse event that triggers root close behavior ([#95])
- **Bugfix:** Fix restoring focus on closing `<Modal>` ([#82])
- **Bugfix:** Do not pass unknown props to children ([#99])
- **Chore:** Upgrade to Babel 6 ([#100])

[v0.6.4]: https://github.com/react-bootstrap/react-overlays/compare/v0.6.3...v0.6.4
[#82]: https://github.com/react-bootstrap/react-overlays/pull/82
[#93]: https://github.com/react-bootstrap/react-overlays/pull/93
[#95]: https://github.com/react-bootstrap/react-overlays/pull/95
[#99]: https://github.com/react-bootstrap/react-overlays/pull/99
[#100]: https://github.com/react-bootstrap/react-overlays/pull/100


## [v0.6.3]
> 2016-04-07

- **Minor:** Update React peer dependency ([#76])

[v0.6.3]: https://github.com/react-bootstrap/react-overlays/compare/v0.6.2...v0.6.3
[#76]: https://github.com/react-bootstrap/react-overlays/pull/76


## [v0.6.2]
> 2016-04-03

- **Bugfix:** Fix unmounting `<Portal>` when parent is unmounted ([#74])

[v0.6.2]: https://github.com/react-bootstrap/react-overlays/compare/v0.6.1...v0.6.2
[#74]: https://github.com/react-bootstrap/react-overlays/pull/74


## [v0.6.1]
> 2016-03-28

- **Bugfix:** Flush new props to DOM before initiating transitions ([#60])
- **Bugfix:** Update `<Portal>` container node when `container` prop changes ([#66])
- **Bugfix:** Don't invoke close in `<RootCloseWrapper>` on right clicks ([#69])

[v0.6.1]: https://github.com/react-bootstrap/react-overlays/compare/v0.6.0...v0.6.1
[#60]: https://github.com/react-bootstrap/react-overlays/pull/60
[#66]: https://github.com/react-bootstrap/react-overlays/pull/66
[#69]: https://github.com/react-bootstrap/react-overlays/pull/69


v0.6.0 - Fri, 15 Jan 2016 16:15:50 GMT
--------------------------------------

- [c0b5890](../../commit/c0b5890) [fixed] Don't forward own props from <Position>
- [742c3c1](../../commit/742c3c1) [fixed] Modal does not fire show callback



v0.5.4 - Tue, 17 Nov 2015 20:03:06 GMT
--------------------------------------

- [4eabbfc](../../commit/4eabbfc) [added] affix state callbacks



v0.5.3 - Mon, 16 Nov 2015 19:52:03 GMT
--------------------------------------

- [d064667](../../commit/d064667) [fixed] AutoAffix nnot passing width or updating



v0.5.2 - Mon, 16 Nov 2015 17:32:27 GMT
--------------------------------------

- [823d0f8](../../commit/823d0f8) [fixed] fix missing warning dep
- [1857449](../../commit/1857449) [changed] Friendlier default for AutoAffix
- [f633476](../../commit/f633476) [fixed] clean up modal styles if unmounted during exit transition



v0.5.1 - Mon, 02 Nov 2015 16:07:44 GMT
--------------------------------------

- [e965152](../../commit/e965152) [added] Affix and AutoAffix



v0.5.0 - Wed, 07 Oct 2015 19:40:23 GMT
--------------------------------------

- [044100b](../../commit/044100b) [added] React 0.14 support
- [edd316a](../../commit/edd316a) [added] aria-hidden, by default, to modal container siblings.



v0.4.4 - Mon, 24 Aug 2015 18:34:19 GMT
--------------------------------------





v0.4.3 - Sun, 23 Aug 2015 22:54:52 GMT
--------------------------------------

- [4f7823e](../../commit/4f7823e) [changed] focus target of the modal to its content



v0.4.2 - Mon, 10 Aug 2015 19:04:31 GMT
--------------------------------------





v0.4.1 - Tue, 04 Aug 2015 23:48:08 GMT
--------------------------------------





