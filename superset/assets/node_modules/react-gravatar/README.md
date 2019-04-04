react-gravatar
==============

React component for rendering a gravatar profile image. Adjusts automatically to HiDPI displays.

## Demo
http://kyleamathews.github.io/react-gravatar/

## Install
`npm install react-gravatar`

## Usage
See https://en.gravatar.com/site/implement/images/ for documentation on
all the options.

### Avoid exposing email
If you wish to avoid sending an email address to the client, you can
compute the md5 hash on the server and pass the hash to the component
using the `md5` prop instead of the `email` prop.

### Defaults
* 50x50 image
* g rated photos
* http
* retro backup faces for emails without profiles
* `react-gravatar` css class

### Use defaults
`<Gravatar email="mathews.kyle@gmail.com" />`

### Override all defaults
`<Gravatar
	email="mathews.kyle@gmail.com"
	size={100}
	rating="pg"
	default="monsterid"
	className="CustomAvatar-image"
/>`
