# Change Log

#### [2.4.1] - Apr 20, 2020

- Unblock pinch gesture when panning (#59)

#### [2.4.0] - Jan 29, 2020

- Add tabIndex option; change default to 0 (#55)
- Add `eventManager.watch` (#56)

#### [2.3.0] - Jan 13, 2020

- Add priority option to event handlers (#54)

#### [2.2.1] - Aug 3, 2019

- Revert "Avoid crash if imported in a web worker (#29)" (#49)

#### [2.2.0] - Aug 2, 2019

- Use ocular-dev-tools (#43)
- Add EventManager.once (#46)

#### [2.1.2] - June 5, 2019

- Fix undefind userAgent (#40)

#### [2.1.1] - Jun 3, 2019

- fix bug where tap threshold is not working (#36)

#### [2.1.0] - Feb 20, 2019

- add anyclick event (#32)

#### [2.0.3] - Jan 8, 2018

- Remove passive event listener warning in Chrome (#31)

#### [2.0.2] - Dec 18, 2018

- Avoid crash if imported in a web worker (#29)

#### [2.0.1] - Nov 9, 2018

- add support for pointerover, pointerout events (#25)
- fix node 9+ support (#27)

#### [2.0.0] - Oct 31, 2018

- Deprecate `legacyBlockScroll` and `rightButton` options

#### [2.0.0-alpha.3] - Sep 26, 2018

- Add `event.stopImmediatePropagation` (#26)

#### [2.0.0-alpha.2] - Sep 24, 2018

- Refactor event handling (#23)
- Fix dblclick delay (#24)

#### [2.0.0-alpha.1] - Sep 24, 2018

- NEW: Provide static browser/node targets (#22)

#### [1.2.2] - Sep 12, 2018

- FIX: Remove commonjs to fix the problem with cjs/esm interop (#20)

#### [1.2.0] - Jun 13, 2018

- NEW: A new option `touchAction` to EventManager that allows users to customize browser touch actions
- NEW: Supports new event `contextmenu`

#### [1.1.0] - Apr 18, 2018

- NEW: A new option `legacyBlockScroll` to EventManager that allows users to restore the default scroll behavior on wheel events

#### [1.0.1] - Jan 29, 2018

- FIX: Missing `dist-es6` in package

#### [1.0.0] - Jan 9, 2018

#### [1.0.0-alpha.2] - Dec 9, 2017

- FIX: EventManager.destroy throws error if element is empty (#9)

#### [1.0.0-alpha.1] - Dec 4, 2017

- NEW: Make DOM element optional in EventManager constructor (#8)

#### [0.4.1] - Nov 9, 2017

- FIX: test failure under Node

#### [0.4.0] - Oct 13, 2017

- Only fire keyboard events within the target element (#4)
- Add flags for mouse buttons to event object (#5)

#### [0.3.0] - Oct 12, 2017

- Support right mouse button gestures (#2)
- Block click event if double clicking (#3)

#### [0.2.0] - Oct 5, 2017

- Add propagation system (#1)
