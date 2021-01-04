## [1.2.4](https://github.com/trilom/file-changes-action/compare/v1.2.3...v1.2.4) (2020-05-21)


### Bug Fixes

* **change in api:** github api had a change, this should trigger release 1.2.4.  this change here quiets a quacker during the intergration test ([99f8f91](https://github.com/trilom/file-changes-action/commit/99f8f91f3ed1430713973d8f1e2848b5acc58163))

## [1.2.3](https://github.com/trilom/file-changes-action/compare/v1.2.2...v1.2.3) (2020-03-25)


### Bug Fixes

* **test release:** testing a release ([dfca448](https://github.com/trilom/file-changes-action/commit/dfca448d9d1f04825a549ba0bc7d6b097df295a2))

## [1.2.2](https://github.com/trilom/file-changes-action/compare/v1.2.1...v1.2.2) (2020-03-25)


### Bug Fixes

* **issue_comment:** this needs to return PR info not commit info if before and after explicitly set, else PR ([eee976b](https://github.com/trilom/file-changes-action/commit/eee976b2219f243f83583baab84fa89376006acc))
* **naming:** renamed "deleted" to "removed".  sorry if this is breaking for you. ([800537f](https://github.com/trilom/file-changes-action/commit/800537f435a66454c64fc2b42cfd82ca33cc093d))
* **pull_request_synchronize events:** issue with PR Synchronize events, it would return commit files instead of PR files, this is adjusted to return ALL PR files with PR synchronize event ([fb7bcc7](https://github.com/trilom/file-changes-action/commit/fb7bcc76581402f20aa64da82cd1174e313ec02c))
* **space issue:** this should resolve the issue with using a blank space.  the assumption here is that 'json' is default, if you use ' ' it will be '' which is the app default, not the action default of 'json' ([0e4184f](https://github.com/trilom/file-changes-action/commit/0e4184fe04f87323c60b71c1ccf2af95f9f35b8c)), closes [#81](https://github.com/trilom/file-changes-action/issues/81)

## [1.2.1](https://github.com/trilom/file-changes-action/compare/v1.2.0...v1.2.1) (2020-03-19)


### Bug Fixes

* **everything:** very proud to say this is 100% coverage according to default jest of all src code (including test) ([dd31d02](https://github.com/trilom/file-changes-action/commit/dd31d0220fdc9e6eb3469b3443239359d7da33d4))
* **redesign:** a lot of things changed here in the project ([32903fd](https://github.com/trilom/file-changes-action/commit/32903fd341ce6a5471e3df73393784cb43adb397))

# [1.2.0](https://github.com/trilom/file-changes-action/compare/v1.1.0...v1.2.0) (2020-03-02)


### Features

* **action:** githubToken is optional (uses action token), added githubRepo, prNumber, and pushBefore & After ([b24e2c3](https://github.com/trilom/file-changes-action/commit/b24e2c30c72710da8704a02f9d05141a19f27f83))

# [1.2.0](https://github.com/trilom/file-changes-action/compare/v1.1.0...v1.2.0) (2020-03-02)


### Features

* **action:** githubToken is optional (uses action token), added githubRepo, prNumber, and pushBefore & After ([b24e2c3](https://github.com/trilom/file-changes-action/commit/b24e2c30c72710da8704a02f9d05141a19f27f83))
