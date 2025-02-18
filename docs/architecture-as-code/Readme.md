# Architecture, Events, and Notifications

## This is a repository that contains documentation about event analytics, notifications and the global architecture of the project `DODO Superset` using the `C4 model` for visualising software

### How to start working on the notifications
1. Once there is code created for a notification in the application you will HAVE TO update the code in this repository as well
2. Once the notification is described here, the pull request should be shown to Product Owner for approval
3. Create the notifications in the `notifications` folder

### How to start working on the analytics events
1. Once there is code created for a analytics events in the application you will HAVE TO update the code in this repository as well
2. Every analytics event has to have: `user_id` param
3. Once the analytics event is described here, the pull request should be shown to Product Owner for approval
3. Create the analytics events in the `events` folder

### How to start working on the diagrams
0. You will need to have Node JS installed, as well as YARN or NPM.
1. Install dependencies
```
yarn
```
or
```
npm install
```
2. Create diagrams in the diagrams folder
3. Define new systems and components in the `config.json` file
3. Validate diagrams before pushing to repo (WIP: pre-commit hooks). Works ONLY for context diagrams
```
node index.js
```

Example output:
```

Validating file: global__context-diagram.puml (1 out of 1)

  All variables are valid.

Validation finished. Errors found: 0


----------
```

### How to see diagrams using Puml?
In the folder `examples` there are differnet examples of how to write code to create a visaul represantaion of the software architecture.
1. Open VS Code
2. Install the extension: PlantUML
3. Open the required file, select the full contense, right-click, select Preview Curent Diagram (Alt+D)

### Brief explanation:

A software system is made up of one or more containers (applications and data stores), each of which contains one or more components, which in turn are implemented by one or more code elements (classes, interfaces, objects, functions, etc). And people (actors, roles, personas, named individuals, etc) use the software systems that we build.

1. Software (C)ontext
2. (C)ontainer
3. (C)omponent
4. (C)ode *

*_we most likely will not use Code. As the creator suggests, it is in the 99% not worth it_


#### [Software system](https://c4model.com/abstractions/software-system)
A software system is the highest level of abstraction and describes something that delivers value to its users, whether they are human or not. This includes the software system you are modelling, and the other software systems upon which your software system depends (or vice versa).


#### [Container](https://c4model.com/abstractions/container)
Not Docker! In the C4 model, a container represents an application or a data store. A container is something that needs to be running in order for the overall software system to work. A container is essentially a runtime boundary around some code that is being executed or some data that is being stored. In real terms, a container is something like:
- Server-side web application
- Client-side web application
- Client-side desktop application
- Mobile app
- Server-side console application
- ... etc.

#### [Component](https://c4model.com/abstractions/component)
The word “component” is a hugely overloaded term in the software development industry but, in the C4 model, a component is a grouping of related functionality encapsulated behind a well-defined interface. If you’re using a language like Java or C#, the simplest way to think of a component is that it’s a collection of implementation classes behind an interface.

With the C4 model, components are not separately deployable units. Instead, it’s the container that’s the deployable unit. In other words, all components inside a container execute in the same process space. Aspects such as how components are packaged (e.g. one component vs many components per JAR file, DLL, shared library, etc) is an orthogonal concern.

#### [Code](https://c4model.com/abstractions/code)
Finally, components are made up of one or more code elements constructed with the basic building blocks of the programming language that you’re using - classes, interfaces, enums, functions, objects, etc.
