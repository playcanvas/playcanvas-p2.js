# playcanvas-p2.js
An integration of PlayCanvas with the 2D physics engine [p2.js](https://github.com/schteppe/p2.js). With this integration, you get a powerful visual editing environment for your p2.js powered applications.

## Usage
1. Create a new project on [PlayCanvas](https://playcanvas.com) and open the Editor.
2. Drag playcanvas-p2.js into the Assets panel of the Editor.
![Drag to Assets panel](http://i.imgur.com/uvREuVs.gif)
3. Do the same with [p2.min.js](https://github.com/schteppe/p2.js/blob/master/build/p2.min.js).
4. Set script loading order to ensure p2.min.js is loaded first.
![Set script loading order](http://i.imgur.com/gZXVJ04.gif)
5. Create a script component on the root entity in the Hierarchy panel and add the p2World script object.
![Add p2World](http://i.imgur.com/Nxn6d3f.gif)
6. Create as many rigid bodies as you wish. To create a rigid body, create a new Entity and add a script component. Then add a p2Body script object. Finally assign a shape to the body by adding either a p2Box or p2Circle shape.

## Example
https://playcanvas.com/project/446127/overview/p2.js%20Integration
