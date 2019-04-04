# Change Log

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
- NEW: Make DOM element optional in EventManager constructor  (#8)

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
