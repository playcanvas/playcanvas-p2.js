# playcanvas-p2.js
An integration of PlayCanvas with the 2D physics engine p2.js

## Usage

1. Drag playcanvas-p2.js into the Assets panel of the PlayCanvas Editor.
2. Do the same with [p2.min.js](https://github.com/schteppe/p2.js/blob/master/build/p2.min.js).
3. Create a script component on the root entity in the Hierarchy panel and add the p2World script object.
4. Create as many rigid bodies as you wish. To create a rigid body, create a new Entity and add a script component. Then add a p2Body script object. Finally assign a shape to the body by adding either a p2Box or p2Circle shape.

## Example
https://playcanvas.com/project/446127/overview/p2.js%20Integration
