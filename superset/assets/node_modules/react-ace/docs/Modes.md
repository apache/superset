# Modes, Themes, and Keyboard Handlers

All modes, themes, and keyboard handlers should be required through [`brace`](https://github.com/thlorenz/brace) directly.  Browserify will grab these [modes](https://github.com/thlorenz/brace/tree/master/mode) / [themes](https://github.com/thlorenz/brace/tree/master/theme) / [keyboard handlers](https://github.com/thlorenz/brace/tree/master/keybinding) through ```brace``` and will be available at run time.  See the example above.  This prevents bloating the compiled javascript with extra modes and themes for your application.

### Example Modes

* javascript
* java
* python
* xml
* ruby
* sass
* markdown
* mysql
* json
* html
* handlebars
* golang
* csharp
* coffee
* css

### Example Themes

* monokai
* github
* tomorrow
* kuroir
* twilight
* xcode
* textmate
* solarized dark
* solarized light
* terminal

### Example Keyboard Handlers

* vim
* emacs
