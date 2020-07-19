# A leaflet plugin for Superset


This was an exercise on how to approach the problem of intgrating a Leaflet Map in Superset, as well as some basic plotting.


### Plotting some custom data

I had never heard of Superset before, so the first thing to do was head for the official docs and do some reading. Getting up and running was fairly painless, and I had a dashboard with Superset's sample datasets up and running in no time. I had a lat/lon dataset of global weather balloon station locations lying around on my local Postgres install, so I figured I'd try loading this in. The only "gotcha" at this stage was that I needed to download and include psycop2-binary in the SQL alchemy URI like so:

`postgresql+psycopg2://jokea:XXXXXXXXXX@localhost:5432/tephigrams-api-db`  

and then I was good to go. 

I also had an old mapbox API key from one the exercises during my Bootcamp. A quick search showed me where to place the key (you just create `~/.superset/superset_config.py` and set an environment variable there). And there we go, a lovely map of weather balloon stations in less than an hour:

<img src="https://github.com/johnckealy/incubator-superset/blob/leaflet/stations.png?raw=true" alt="" width="650px" height="300px">


### Editing the Superset source code

I had originally just installed Superset in a Python virtualenv to get it to run, but now it seemed to prudent to fork the original repository on Github. Pretty much every resource online used Docker. I haven't learned Docker yet (though it's high on my wish-list), but thought it no harm to investigate. This was where my first bottleneck occurred. My lack of understanding of Docker quickly became troublesome. 

Even though I could run Superset using `docker-compose`, I had a lot of trouble figuring out how to import custom data into the container. I tried strategies like using `pg_dump` to grab a database copy from my local postgres, and then load this file into the Docker container using commands along the lines of 

`cat ../tephigrams.sql | sudo docker exec -i superset_db psql -U superset`,

but I was getting nowhere. I needed to find a non-docker solution, or spend days learning Docker inside and out from scratch. 

After taking a pause, it occurred to me that maybe I could load up Superset into a virtual environment using the source code. I then rememebered the `pip` command

`pip install -e .`

The `-e` flag allowed me to make changes to the package on the fly – problem solved. I could now edit the source code of Superset, and import data from my local Postgres databases. 

Time to tinker. 


### A few setbacks

Now for the tricky part. The next task was to find a way to integrate Leaflet into Superset. My hope was to figure out how Mapbox was implemented under the hood, and use this as a jumping off point. This hope fell apart fairly quicky. 

Google wasn't giving any hints this time, so I was on my own. After a little research, the best resource I could find to help out were a few pull requests in the Superset repository on Github (which were linked to from the official Superset docs). Unfortunately, they were a little old (referring to Caravel, an earlier version of Superset). Nonetheless, these pull requests helped to give me an idea of what might be necessary to create a custom visualization.

First I set a few `breakpoint()`s (`breakpoint()` is just syntatic sugar for the Pdb debugger) to try to understand the control flow, and I also ran searches in Visual Studio Code (vscode is my latest crush in terms of IDEs) and grepped around for keywords like "Mapbox" to see where I might start.

After quite some time searching for clues, I came to realize that Mapbox was completely baked into React, Deck-gl, Webpack.. everything really. It sources from npm libraries like `react-map-gl` and `mapbox-gl`. Since I have literally zero experience with React or DeckGL, I was quickly starting to realise that this project might be beyond my current skill level!

Time to rethink my strategy. 


### Superset plugins

Online, the creators of Superset had loosely described the possibility of plugins, with mentions of a [hello-world plugin](https://preset.io/blog/2020-07-02-hello-world/)... but even this looked quite complex and seemly assumed knowledge of Typescript. They even state in that article that such things were "impossible" until very recently, and that article only came out this month. All the same, I figured I might learn more about workings of Superset by following the blog post. 

The general idea I had was that if I could decouple the frontend UI from the backend, then I might just be able to implement a basic Leaflet map using Webpack. Once the map was running in the right place, I could then seek to load the json data from the backend into it. But first I needed to get a sample plugin to work.  

There exists a separate repository for the superset user inferface at `https://github.com/preset-io/superset-ui`. I had to install the specialist tool Yeoman to create a superset-ui plugin generator, and use it to generate a new plugin template. So I went ahead and generated a "hello-world" plugin.

It's necessary to use `npm link` to connect the `node_modules` folders between the main `superset` repo and this separate `superset-ui` repo. But there was a snag, and Webpack refused to compile. 

Then I realised something. The structure of the sample plugins Preset's blog post/tutorial had provided were different to that of the plugins within the main `incubator-superset` repo. 

My newly generated plugin was structured this way: 

```
jokea@leno ~/c/j/s/i/s/n/@/legacy-plugin-chart-treemap> ls  # this was inside the 'incubator-superset' repo                                                                                                
esm  lib  LICENSE  package.json  README.md
```

yet the plugins that were being used by the app were structured this way:

```
jokea@leno ~/c/j/s/i/s/n/@/legacy-plugin-chart-treemap> ls   # this was inside the 'superset-ui' repo                                                                                                
package.json  README.md  src  test  types
```

I knew that the existing plugins weren't prepended with "legacy" for nothing, it was obvious that the authors had updated their filestructures. But all the same, the plugins generated by Yeoman wouldn't compile with the current `incubator-superset` source code – they didn't seem compatible at all. On top of that, the generated plugin template (Preset's "newer" approach) was based on TypeScript, which I also haven't yet learned. 

When a problem becomes overwhelming, I tend to break it down into the smallest possible pieces and take baby steps. Get back to a place where things are working again, and inch forward. The simplest possible thing I could think of to do, now that I knew that there existed discrete "plugins" that could (in theory) create visualizations, was to copy one of the legacy plugins in the main `incubator-superset repo` and start tinkering with it.  


### Superset plugins continued..

The simplest next step I could think to make was to choose a simple legacy visualization, and find where the HTML container element was being called. The sample plugin I chose was called `legacy-plugin-chart-treemap`, a simple tree map visualization.  All the javascript code was written with React, which I have no knowledge of, but I hoped I could understand enough to at least find where the element was referenced. 

Since React creates a virtual DOM (I may not be understanding that correctly), I was given few clues as to how to identify where the container element was (class and id names were not present in the plugin code), but after a little digging, I found a function within the labrynth of React code that seemed to be at the heart of things. 

This function simply took two inputs, called `props` and `element`. On logging these, I found what I had hoped – props contained the data from the backend, and the element was the container I was looking for.

At this point I installed Leaflet with npm, to see if I could get a sample map to appear in this container. It was simply 

```
function Treemap(element, props) {

  const position = [51.505, -0.09]
  const map = L.map(element).setView(position, 13)
  
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map)

}
``` 

but it produced this monstrosity...

<img src="https://github.com/johnckealy/incubator-superset/blob/leaflet/badleaflet.png?raw=true" alt="" width="650px" height="300px">

The maptiles don't fit into the container, and are in the wrong positions relative to each other. You can pan and zoom it, but it makes no sense. I tried stripping everything I could out of the plugin, but couldn't figure out why it was doing this. 

I also came across a package called `react-leaflet`. I installed and tried running it, but to be honest, without React knowledge, I'm completely out of my depth. 


### A sample npm plugin package
 
Despite many hours of work, I hadn't actually written a single line of useful code. So I thought it prudent to at least create an npm package showing how a visualization *might* be implemented with Leaflet in Superset. 

The package is here: 

[https://www.npmjs.com/package/plugin-chart-leaflet](https://www.npmjs.com/package/plugin-chart-leaflet)

Starting from the Treemap plugin, I added the ideas from the other sections. The strange tiling issue turned out to be due to the omission of the leaflet CSS, but with it, the leaflet container now had no height. The map was there... but I couldn't get any further. Manually giving `.leaflet-container` in chrome devtools gave me something like this: 

<img src="https://github.com/johnckealy/incubator-superset/blob/leaflet/leafletmap.png?raw=true" alt="" width="650px" height="300px">

...but I was still hammering a square peg into a round hole. 

My lack of knowledge in React was a major stumbling block, so I'd love to try a similar problem again someday after I've learned React. Without these fundamentals though, I could've been going for days with no progress. It was time to stop. 


### What's been learned? 

I think the idea behind this project might have been to see how I approached a problem that was far above my level. Even though this is exactly the kind of thing I would love to learn more about, I wasn't able to get very far with my current ability.

When it comes to implementing Leaflet in Superset, the following is my summary of the most important outcomes of the work I did over the past two days:

1) Each visualization type in SuperSet (LineType, HeatMap, Scatterplot, etc) is drawn using a plugin. These visualization plugins live in the `superset-ui` repository (which is [here](https://github.com/apache-superset/superset-ui)). Superset's authors are not currently accepting plugins from contributors, but hope to soon. They appear to be transitioning into a new way of creating these plugins, but right now, resources on how to make one are relatively scarce.

2) Although it might be a better approach in the long term to persist with the new format of the plugins, I've created an example of what a plugin using the legacy format and published this to npm (link in the previous section). Unfortunately, this plugin does not function properly. Hopefully it could of some use as a starting point. 

3) When ready, plugins integrate with Superset by way of the `SuperChart` React component. 

4) `react-leaflet` is an npm package that may help with the leaflet integration, though I didn't end up using it myself. 



