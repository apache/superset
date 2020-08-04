# Changelog

## [7.0.2] 2018-01-25
### Added
- handle fs errors in language and stylesheet build scripts
- fix link to refractor in README

## [7.0.1] 2018-01-25
### Changed
- removed claims of sanity from README

## [7.0.0] 2018-01-25
### Added
- add lineProps prop which takes either an object or a function that returns an object that is then passed onto each line created when wrapLines=true
### Changed
- removed lineStyle prop the behavior of this prop can be replicated with lineProps passing a style object inside the props object. this is a breaking change

## [6.1.2] 2018-01-17
### Changed
- add .babelrc to .npmignore for parcel support

## [6.1.1] - 2017-12-09
### Changed
- move prism-themes to dev dependencies

## [6.1.0] - 2017-12-09
### Added
- added light version support for prism(refractor) based highlighting

## [6.0.4] - 2017-11-22
### Changed
- fixed vendor prefixing for prism styles

## [6.0.3] - 2017-11-17
### Changed
- add links to available languages in README (by @adamweeks)
- fix line number display for prism highlighter

## [6.0.2] - 2017-11-16
### Changed
- fix git links in package.json

## [6.0.1] - 2017-11-16
### Changed
- update package main to be root instead of dist

## [6.0.0] - 2017-11-16
### Added
- add support for alternative syntax highlighting using ast generated from prismjs via <a href="https://github.com/wooorm/refractor">refractor</a> (by @conorhastings and @maxmcd)

## [5.8.1] - 2017-10-26
### Changed
- avoid unneeded function calls if language is text
- note text language in readme

## [5.8.0] - 2017-10-26
### Changed
- avoid unneeded function calls if language is text
- note text language in readme

## [5.8.0] - 2017-10-25
### Added
- add support for text as valid language

## [5.7.1] - 2017-10-26
### Changed
- check if children is array and use children[0] if so.

## [5.7.0] - 2017-08-21
### Changed
- check if we have language before attempting to highlight.
- add test for unknown language to avoid further issues with content not rendering


## [5.6.3] - 2017-08-12
### Added
- added code of conduct 

### Changed
- update dependency versions

## [5.6.2] - 2017-05-29
### Changed
- fix edge cases in line wrapping feature

## [5.6.0] - 2017-05-11
### Added
- add list of available languages (by @forresto)

## [5.5.2] - 2017-05-07
### Added
- render plain string if no language present

## [5.5.1] - 2017-05-05
### Added
- add license file

### Changed
- update readme

## [5.50] - 2017-04-23
### Added
- added test for useInlineStyles=false

### Changed
- export previously unexported functions from createElemeent

## [5.4.1] - 2017-04-23
### Added
- add code coverage

## [5.4.0] - 2017-04-23
### Added
- add code coverage


## [5.2.0] - 2017-04-08
### Added
- flatten tree before using wrapLines function
- allow using a custom renderer without wrapLines

## [5.1.3] - 2017-04-02
### Added
- flatten tree before using wrapLines function
- allow using a custom renderer without wrapLines

### Changed
- update broken links in demo
- handle some edge cases in wrapLines function
- generalize function for finding text child 


## [5.1.2] - 2017-03-21

### Changed
- update version of react-syntax-highlighter-virtualized-renderer for demo
- handle some edge cases in wrapLines function

## [5.1.1] - 2017-03-21
### Added
- add api to allow for use of custom renderer (virtualized, native, etc...)

## [5.1.0] - 2017-03-21
### Added
- add api to allow for use of custom renderer (virtualized, native, etc...)

## [5.0.0] - 2017-02-12
### Added
- allow wrapping of individual element in <span> tag

## [4.0.1] - 2016-12-09
### Added
- allow styling individual numbers

## [3.0.2] - 2016-12-04

### Added
- add support for IE and older android browsers (by @yahiousun)

## [3.0.1] - 2016-12-03

### Changed
- update dependencies

## [3.0.0] - 2016-10-29

### Added
- wrap individual line numbers in span

### Changed
- removed envified light build in favor of only using seperate entry point

## [2.11.0] - 2016-10-27

### Added
- export lowlight registerLanguage in light build

## [2.10.0] - 2016-10-09

### Added
- add section to readme showcasing projects built with react syntax highlighter

### Changed 
- fix style assignment function to not end up with unexpected styles


## [2.9.0] - 2016-10-06

### Added
- call highlightAuto if no language provided

### Changed 
- unify quote style in code

## [2.8.0] - 2016-10-02

### Added
- add support for line numbers


## [2.7.1] - 2016-10-02

### Changed
- fix require of default style

## [2.7.0] - 2016-09-24

### Added
- add jest snapshot testing
- add more available styles

## [2.6.1] - 2016-09-22

### Changed
- add new info on light build to readme
- don't wrap text in spans

## [2.6.0] - 2016-09-16

### Added
- add a seperate entry point for light build (by @bmathews)

## [2.5.0] - 2016-09-15

### Added
- add codeTagProps to props to allow passing arbitrary orios to code tag

## [2.4.0] - 2016-09-11

### Added
- allow optionally applying css classNames instead of inline styles

### Changed
- fix light build example

## [2.3.0] - 2016-08-27

### Added
- add customStyle prop

### Changed
- update available styles


## [2.2.0] - 2016-08-27

### Added
- allow light build via env variable

## [2.1.1] - 2016-07-02

### Changed
- fix warning by not passing invalid non dom props to pre tag

## [2.1.0] - 2016-05-20

### Changed
- update depedndencies 

## [2.0.4] - 2016-05-18

### Changed
- strict dependency on highlight

## [2.0.3] - 2016-05-07

### Changed
- update dependency and add new styles

## [2.0.2] - 2016-04-19

### Changed
- fix bad import in readme

## [2.0.1] - 2016-04-19

### Changed
- fix missing quotes around import location in readme example

## [2.0.0] - 2016-04-17

### Added
- have user pass in style object instead of string of style name

## [1.3.0] - 2016-04-03

### Changed
- make peerDependency of react more liberal

## [1.2.0] - 2016-03-27

### Changed
- code style changes
- add new highlight.js styles

## [1.1.2] - 2016-01-31

### Changed
- remove unused createTextElement function 

## [1.1.1] - 2016-01-31

### Changed
- use a Text component instead of createTextElement function 
- explain js styles in readme

## [1.1.0] - 2016-01-30

### Added 
- use default top level style from highightjs' 

### Changed
- fix spelling of segment in code (by @winkler1)

## [1.0.2] - 2016-01-29

### Changed
- update package to allow any version of react 14

## [1.0.1] - 2016-01-29

### Added
- wrap children in code element as well as pre element

## [1.0.0] - 2016-01-28

### Added
- add script to build javascript styles
- write readme 

### Changed
- allow changing style in demo

## [0.0.2] - 2016-01-28

### Added
- add script to build javascript styles
- write readme 

### Changed
- update lowlight version
- use pre not span
- pass along optional props to pre tag

## [0.0.1] - 2016-01-26

### Added
- initial version
- syntax highlighting using virtual dom created by lowlight
