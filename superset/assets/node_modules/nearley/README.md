# [nearley](http://nearley.js.org) ↗️
[![JS.ORG](https://img.shields.io/badge/js.org-nearley-ffb400.svg?style=flat-square)](http://js.org)
[![npm version](https://badge.fury.io/js/nearley.svg)](https://badge.fury.io/js/nearley)

nearley is a simple, fast and powerful parsing toolkit. It consists of:
1. [A powerful, modular DSL for describing
   languages](https://nearley.js.org/docs/grammar)
2. [An efficient, lightweight Earley
   parser](https://nearley.js.org/docs/parser)
3. [Loads of tools, editor plug-ins, and other
   goodies!](https://nearley.js.org/docs/tooling)

nearley is a **streaming** parser with support for catching **errors**
gracefully and providing _all_ parsings for **ambiguous** grammars. It is
compatible with a variety of **lexers** (we recommend
[moo](http://github.com/tjvr/moo)). It comes with tools for creating **tests**,
**railroad diagrams** and **fuzzers** from your grammars, and has support for a
variety of editors and platforms. It works in both node and the browser.

Unlike most other parser generators, nearley can handle *any* grammar you can
define in BNF (and more!). In particular, while most existing JS parsers such
as PEGjs and Jison choke on certain grammars (e.g. [left recursive
ones](http://en.wikipedia.org/wiki/Left_recursion)), nearley handles them
easily and efficiently by using the [Earley parsing
algorithm](https://en.wikipedia.org/wiki/Earley_parser).

nearley is used by a wide variety of projects:

- [artificial
  intelligence](https://github.com/ChalmersGU-AI-course/shrdlite-course-project)
  and
- [computational
  linguistics](https://wiki.eecs.yorku.ca/course_archive/2014-15/W/6339/useful_handouts)
  classes at universities;
- [file format parsers](https://github.com/raymond-h/node-dmi);
- [data-driven markup languages](https://github.com/idyll-lang/idyll-compiler);
- [compilers for real-world programming
  languages](https://github.com/sizigi/lp5562);
- and nearley itself! The nearley compiler is bootstrapped.

nearley is an npm [staff
pick](https://www.npmjs.com/package/npm-collection-staff-picks).

## Documentation

Please visit our website https://nearley.js.org to get started! You will find a
tutorial, detailed reference documents, and links to several real-world
examples to get inspired.

## Contributing

Please read [this document](.github/CONTRIBUTING.md) *before* working on
nearley. If you are interested in contributing but unsure where to start, take
a look at the issues labeled "up for grabs" on the issue tracker, or message a
maintainer (@kach or @tjvr on Github).

nearley is MIT licensed.

A big thanks to Nathan Dinsmore for teaching me how to Earley, Aria Stewart for
helping structure nearley into a mature module, and Robin Windels for
bootstrapping the grammar. Additionally, Jacob Edelman wrote an experimental
JavaScript parser with nearley and contributed ideas for EBNF support. Joshua
T. Corbin refactored the compiler to be much, much prettier. Bojidar Marinov
implemented postprocessors-in-other-languages. Shachar Itzhaky fixed a subtle
bug with nullables.
