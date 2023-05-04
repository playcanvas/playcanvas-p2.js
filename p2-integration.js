////////////////////////////////////////////////////////////////////////////////////////////////////
// PHYSICS WORLD ///////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////
var P2World = pc.createScript('p2World');

P2World.attributes.add('gravity', { 
    type: 'vec2', 
    default: [ 0, -9.8 ],
    title: 'Gravity',
    description: 'Gravity to use when approximating the friction max force.',
    placeholder: ['X', 'Y']
});
P2World.attributes.add('axes', {
    type: 'number',
    enum: [
        { 'XY': 1 },
        { 'XZ': 2 },
        { 'YZ': 3 }
    ],
    default: 1,
    title: 'Axes',
    description: 'The axes on which the simulation is run.'
});
P2World.attributes.add('defaultFriction', { 
    type: 'number', 
    default: 0.3,
    title: 'Default Friction',
    description: 'The default global friction.'
});
P2World.attributes.add('maxSubSteps', { 
    type: 'number',
    default: 10,
    title: 'Max Substeps',
    description: 'Maximum number of fixed steps to take when stepping the simulation.'
});
P2World.attributes.add('solverIterations', { 
    type: 'number',
    default: 10,
    title: 'Solver Iterations',
    description: 'The maximum number of iterations to do when solving. More gives better results, but is more expensive.'
});
P2World.attributes.add('solverTolerance', {
    type: 'number',
    default: 0,
    title: 'Solver Tolerance',
    description: 'The error tolerance, per constraint. If the total error is below this limit, the solver will stop iterating. Set to zero for as good solution as possible, but to something larger than zero to make computations faster.'
});
P2World.attributes.add('sleepMode', {
    type: 'number',
    enum: [
        { 'No Sleeping': 0 },
        { 'Body Sleeping': 1 },
        { 'Island Sleeping': 2 }
    ],
    default: 0,
    title: 'Sleep Mode',
    description: 'How to deactivate bodies during simulation. Possible modes are: "No Sleeping", "Body Sleeping" and "Island Sleeping". If sleeping is enabled, you might need to wake up the bodies if they fall asleep. If you want to enable sleeping in the world, but want to disable it for a particular body, see p2Body.allowSleep.'
});
P2World.attributes.add('islandSplit', {
    type: 'boolean',
    default: true,
    title: 'Island Split',
    description: 'Whether to enable island splitting. Island splitting can be an advantage for both precision and performance.'
});
P2World.attributes.add('debugDraw', {
    type: 'boolean',
    default: false,
    title: 'Debug Draw',
    description: 'Render a visual representation of the physics world in the running app.'
});

P2World.prototype.initialize = function() {
    var sleepModes = [
        p2.World.NO_SLEEPING,
        p2.World.BODY_SLEEPING,
        p2.World.ISLAND_SLEEPING
    ];

    // Create a physics world
    var world = new p2.World({
        gravity: [
            this.gravity.x,
            this.gravity.y
        ],
        islandSplit: this.islandSplit
    });
    world.sleepMode = sleepModes[this.sleepMode];
    world.solver.iterations = this.solverIterations;
    world.solver.tolerance = this.solverTolerance;
    world.defaultContactMaterial.friction = this.defaultFriction;

    // Handle changes to the World's properties
    this.on('attr:defaultFriction', function (value, prev) {
        world.defaultContactMaterial.friction = value;
    });
    this.on('attr:gravity', function (value, prev) {
        world.gravity[0] = value.x;
        world.gravity[1] = value.y;
    });
    this.on('attr:islandSplit', function (value, prev) {
        world.islandSplit = value;
    });
    this.on('attr:sleepMode', function (value, prev) {
        world.sleepMode = sleepModes[value];
    });
    this.on('attr:solverIterations', function (value, prev) {
        world.solver.iterations = Math.round(value);
    });
    this.on('attr:solverTolerance', function (value, prev) {
        world.solver.tolerance = value;
    });

    var self = this;

    this.app.on('p2:getPosition', function (entity, position) {
        var pos = entity.getPosition();
        switch (self.axes) {
            case 1:
                position = [ pos.x, pos.y ];
                break;
            case 2:
                position = [ pos.x, -pos.z ];
                break;
            case 3:
                position = [ -pos.z, pos.y ];
                break;
        }
    });
    this.app.on('p2:addBody', function (body) {
        var pos = body.entity.getPosition();
        var rot = body.entity.getEulerAngles();
        switch (self.axes) {
            case 1:
                body.position = [ pos.x, pos.y ];
                body.angle = rot.z * Math.PI / 180;
                break;
            case 2:
                body.position = [ pos.x, -pos.z ];
                body.angle = rot.y * Math.PI / 180;
                break;
            case 3:
                body.position = [ -pos.z, pos.y ];
                body.angle = rot.x * Math.PI / 180;
                break;
        }
        world.addBody(body);
    });
    this.app.on('p2:removeBody', function (body) {
        world.removeBody(body);
    });

    world.on("postStep", function (evt) {
        self.app.fire('p2:postStep');
    });

    this.world = world;
};

P2World.prototype.postUpdate = function(dt) {
    var i, j;
    var body, bodies, numBodies;
    var shape, shapes, numShapes;
    var entity, pos;

    // Update the simulation
    this.world.step(1 / 60, dt, this.maxSubSteps);

    bodies = this.world.bodies;
    numBodies = bodies.length;

    // Set the transforms of entities from dynamic and kinematic bodies
    for (i = 0; i < numBodies; i++) {
        body = bodies[i];
        if ((body.type === p2.Body.DYNAMIC) || (body.type === p2.Body.KINEMATIC)) {
            entity = body.entity;

            pos = entity.getPosition();
            switch (this.axes) {
                case 1:
                    entity.setPosition(body.position[0], body.position[1], pos.z);
                    entity.setEulerAngles(0, 0, body.angle / Math.PI * 180);
                    break;
                case 2:
                    entity.setPosition(body.position[0], pos.y, -body.position[1]);
                    entity.setEulerAngles(0, body.angle / Math.PI * 180, 0);
                    break;
                case 3:
                    entity.setPosition(pos.x, body.position[0], -body.position[1]);
                    entity.setEulerAngles(body.angle / Math.PI * 180, 0, 0);
                    break;
            }
        }
    }
    
    if (this.debugDraw) {
        for (i = 0; i < numBodies; i++) {
            body = bodies[i];

            var aabb = body.getAABB();
            var points = [
                new pc.Vec3(aabb.lowerBound[0], aabb.lowerBound[1], 0),
                new pc.Vec3(aabb.upperBound[0], aabb.lowerBound[1], 0),
                new pc.Vec3(aabb.upperBound[0], aabb.lowerBound[1], 0),
                new pc.Vec3(aabb.upperBound[0], aabb.upperBound[1], 0),
                new pc.Vec3(aabb.upperBound[0], aabb.upperBound[1], 0),
                new pc.Vec3(aabb.lowerBound[0], aabb.upperBound[1], 0),
                new pc.Vec3(aabb.lowerBound[0], aabb.upperBound[1], 0),
                new pc.Vec3(aabb.lowerBound[0], aabb.lowerBound[1], 0)
            ];
            var colors = [
                pc.Color.RED,
                pc.Color.RED,
                pc.Color.RED,
                pc.Color.RED,
                pc.Color.RED,
                pc.Color.RED,
                pc.Color.RED,
                pc.Color.RED
            ];
            this.app.drawLines(points, colors, false);

            shapes = body.shapes;
            numShapes = shapes.length;
            for (j = 0; j < numShapes; j++) {
                shape = shapes[j];
            }
        }
    }
};


////////////////////////////////////////////////////////////////////////////////////////////////////
// MATERIAL ////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////
var P2Material = pc.createScript('p2Material');

P2Material.attributes.add('friction', {
    type: 'number',
    default: 0.55,
    min: 0,
    max: 1,
    title: 'Friction',
    description: 'The friction coefficient for this material.'
});
P2Material.attributes.add('restitution', {
    type: 'number',
    default: 0.55,
    min: 0,
    max: 1,
    title: 'Restitution',
    description: 'The restitution for this material, defining its bounciness.'
});
P2Material.attributes.add('surfaceVelocity', {
    type: 'number',
    default: 0,
    title: 'Surface Velocity',
    description: ''
});

P2Material.materialDefs = [];

P2Material.prototype.updateMaterial = function() {
    var i, materialDef, materialDefs, numMaterialDefs;

    materialDefs = P2Material.materialDefs;
    numMaterialDefs = materialDefs.length;

    for (i = 0; i < numMaterials; i++) {
        materialDef = materialDefs[i];

        if ((materialDef.friction === this.friction) && (materialDef.restitution === this.restitution)) {
            this.material = materialDef.material;
            return;
        }
    }

    materialDefs.push({
        
    });
};

P2Material.prototype.initialize = function() {
    
    this.on('attr', function(name, value, prev) {
        this.updateMaterial();
    });
};


////////////////////////////////////////////////////////////////////////////////////////////////////
// BOX SHAPE ///////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////
var P2Box = pc.createScript('p2Box');

P2Box.attributes.add('width', {
    type: 'number',
    default: 1,
    title: 'Width',
    description: 'Total width of the box.'
});
P2Box.attributes.add('height', {
    type: 'number',
    default: 1,
    title: 'Height',
    description: 'Total height of the box.'
});
P2Box.attributes.add('angle', {
    type: 'number',
    default: 0,
    title: 'Angle',
    description: 'Body-local angle of the shape in degrees.',
    placeholder: 'degrees'
});
P2Box.attributes.add('position', {
    type: 'vec2',
    default: [ 0, 0 ],
    title: 'Position',
    description: 'Body-local position of the shape.',
    placeholder: [ 'X', 'Y' ]
});
P2Box.attributes.add('collisionGroup', {
    type: 'string',
    default: '00000001',
    title: 'Collision Group',
    description: 'Collision group that this shape belongs to (bit mask).'
});
P2Box.attributes.add('collisionMask', {
    type: 'string',
    default: '00000001',
    title: 'Collision Mask',
    description: 'Collision mask of this shape. See collisionGroup.'
});
P2Box.attributes.add('sensor', {
    type: 'boolean',
    default: false,
    title: 'Sensor',
    description: 'Set to true if you want this shape to be a sensor. A sensor does not generate contacts, but it still reports contact events. This is good if you want to know if a shape is overlapping another shape, without them generating contacts.'
});

P2Box.prototype.initialize = function() {
    this.shape = new p2.Box({
        angle: this.angle * Math.PI / 180,
        collisionGroup: parseInt(this.collisionGroup, 2),
        collisionMask: parseInt(this.collisionMask, 2),
        height: this.height,
        position: [ this.position.x, this.position.y ],
        sensor: this.sensor,
        width: this.width
    });

    /*
    var material = P2Materials[this.friction];
    if (!material) {
        material = new p2.Material();
        material.friction = this.friction;

        for (var f in P2Materials) {
            var m = P2Materials[f];
            var cm = new p2.ContactMaterial(material, m, {
                friction: this.friction * m.friction,
                restitution: this.restitution * m.restitution
            });
            this.app.fire('p2:addContactMaterial', this.body, this.entity);
        }
        
        P2Materials[this.friction] = material;
    }

    // this.shape.material = material;

    var contactMaterial1 = new p2.ContactMaterial(boxShape.material, platformShape1.material, {
        surfaceVelocity:-0.5,
    });
    world.addContactMaterial(contactMaterial1);    
    */
    
    // Handle changes to the box's properties
    this.on('attr:angle', function (value, prev) {
        this.shape.angle = value * Math.PI / 180;
    });
    this.on('attr:collisionGroup', function (value, prev) {
        this.shape.collisionGroup = parseInt(value, 2);
    });
    this.on('attr:collisionMask', function (value, prev) {
        this.shape.collisionMask = parseInt(value, 2);
    });
    this.on('attr:height', function (value, prev) {
        this.shape.height = value;
    });
    this.on('attr:position', function (value, prev) {
        this.shape.position[0] = value.x;
        this.shape.position[1] = value.y;
    });
    this.on('attr:sensor', function (value, prev) {
        this.shape.sensor = value;
    });
    this.on('attr:width', function (value, prev) {
        this.shape.width = value;
    });

    // If there's already a body created, simply add the shape to it
    if (this.entity.script.p2Body) {
        var body = this.entity.script.p2Body.body;
        if (body) {
            body.addShape(this.shape);
        }
    }

    this.on("enable", function () {
        if (this.entity.script.p2Body) {
            var body = this.entity.script.p2Body.body;
            if (body) {
                body.addShape(this.shape);
            }
        }
    });
    this.on("disable", function () {
        if (this.entity.script.p2Body) {
            var body = this.entity.script.p2Body.body;
            if (body) {
                body.removeShape(this.shape);
            }
        }
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////
// CIRCLE SHAPE ////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////
var P2Circle = pc.createScript('p2Circle');

P2Circle.attributes.add('radius', {
    type: 'number',
    default: 1,
    title: 'Radius',
    description: 'Radius of the circle.'
});
P2Circle.attributes.add('angle', {
    type: 'number',
    default: 0,
    title: 'Angle',
    description: 'Body-local angle of the shape in degrees.',
    placeholder: 'degrees'
});
P2Circle.attributes.add('position', {
    type: 'vec2',
    default: [ 0, 0 ],
    title: 'Position',
    description: 'Body-local position of the shape.',
    placeholder: [ 'X', 'Y' ]
});
P2Circle.attributes.add('collisionGroup', {
    type: 'string',
    default: '00000001',
    title: 'Collision Group',
    description: 'Collision group that this shape belongs to (bit mask).'
});
P2Circle.attributes.add('collisionMask', {
    type: 'string',
    default: '00000001',
    title: 'Collision Mask',
    description: 'Collision mask of this shape. See .collisionGroup.'
});
P2Circle.attributes.add('sensor', {
    type: 'boolean',
    default: false,
    title: 'Sensor',
    description: 'Set to true if you want this shape to be a sensor. A sensor does not generate contacts, but it still reports contact events. This is good if you want to know if a shape is overlapping another shape, without them generating contacts.'
});

P2Circle.prototype.initialize = function() {
    this.shape = new p2.Circle({
        angle: this.angle * Math.PI / 180,
        collisionGroup: parseInt(this.collisionGroup, 2),
        collisionMask: parseInt(this.collisionMask, 2),
        position: [ this.position.x, this.position.y ],
        radius: this.radius,
        sensor: this.sensor
    });

    // Handle changes to the circle's properties
    this.on('attr:angle', function (value, prev) {
        this.shape.angle = value * Math.PI / 180;
    });
    this.on('attr:collisionGroup', function (value, prev) {
        this.shape.collisionGroup = parseInt(value, 2);
    });
    this.on('attr:collisionMask', function (value, prev) {
        this.shape.collisionMask = parseInt(value, 2);
    });
    this.on('attr:position', function (value, prev) {
        this.shape.position[0] = value.x;
        this.shape.position[1] = value.y;
    });
    this.on('attr:radius', function (value, prev) {
        this.shape.radius = value;
    });
    this.on('attr:sensor', function (value, prev) {
        this.shape.sensor = value;
    });

    // If there's already a body created, simply add the shape to it
    if (this.shape.body !== null) {
        if (this.entity.script.p2Body) {
            var body = this.entity.script.p2Body.body;
            if (body) {
                body.addShape(this.shape);
            }
        }
    }

    this.on("enable", function () {
        if (this.entity.script.p2Body) {
            var body = this.entity.script.p2Body.body;
            if (body) {
                body.addShape(this.shape);
            }
        }
    });
    this.on("disable", function () {
        if (this.entity.script.p2Body) {
            var body = this.entity.script.p2Body.body;
            if (body) {
                body.removeShape(this.shape);
            }
        }
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////
// CAPSULE SHAPE ///////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////
var P2Capsule = pc.createScript('p2Capsule');

P2Capsule.attributes.add('radius', {
    type: 'number',
    default: 1,
    title: 'Radius',
    description: 'The radius of the capsule.'
});
P2Capsule.attributes.add('length', {
    type: 'number',
    default: 1,
    title: 'Length',
    description: 'The distance between the end points.'
});
P2Capsule.attributes.add('angle', {
    type: 'number',
    default: 0,
    title: 'Angle',
    description: 'Body-local angle of the shape in degrees.',
    placeholder: 'degrees'
});
P2Capsule.attributes.add('position', {
    type: 'vec2',
    default: [ 0, 0 ],
    title: 'Position',
    description: 'Body-local position of the shape.',
    placeholder: [ 'X', 'Y' ]
});
P2Capsule.attributes.add('collisionGroup', {
    type: 'string',
    default: '00000001',
    title: 'Collision Group',
    description: 'Collision group that this shape belongs to (bit mask).'
});
P2Capsule.attributes.add('collisionMask', {
    type: 'string',
    default: '00000001',
    title: 'Collision Mask',
    description: 'Collision mask of this shape. See .collisionGroup.'
});
P2Capsule.attributes.add('sensor', {
    type: 'boolean',
    default: false,
    title: 'Sensor',
    description: 'Set to true if you want this shape to be a sensor. A sensor does not generate contacts, but it still reports contact events. This is good if you want to know if a shape is overlapping another shape, without them generating contacts.'
});

P2Capsule.prototype.initialize = function() {
    this.shape = new p2.Capsule({
        angle: this.angle * Math.PI / 180,
        collisionGroup: parseInt(this.collisionGroup, 2),
        collisionMask: parseInt(this.collisionMask, 2),
        length: this.length,
        position: [ this.position.x, this.position.y ],
        radius: this.radius,
        sensor: this.sensor
    });

    // Handle changes to the capsule's properties
    this.on('attr:angle', function (value, prev) {
        this.shape.angle = value * Math.PI / 180;
    });
    this.on('attr:collisionGroup', function (value, prev) {
        this.shape.collisionGroup = parseInt(value, 2);
    });
    this.on('attr:collisionMask', function (value, prev) {
        this.shape.collisionMask = parseInt(value, 2);
    });
    this.on('attr:length', function (value, prev) {
        this.shape.length = value;
    });
    this.on('attr:position', function (value, prev) {
        this.shape.position[0] = value.x;
        this.shape.position[1] = value.y;
    });
    this.on('attr:radius', function (value, prev) {
        this.shape.radius = value;
    });
    this.on('attr:sensor', function (value, prev) {
        this.shape.sensor = value;
    });

    // If there's already a body created, simply add the shape to it
    if (this.shape.body !== null) {
        if (this.entity.script.p2Body) {
            var body = this.entity.script.p2Body.body;
            if (body) {
                body.addShape(this.shape);
            }
        }
    }

    this.on("enable", function () {
        if (this.entity.script.p2Body) {
            var body = this.entity.script.p2Body.body;
            if (body) {
                body.addShape(this.shape);
            }
        }
    });
    this.on("disable", function () {
        if (this.entity.script.p2Body) {
            var body = this.entity.script.p2Body.body;
            if (body) {
                body.removeShape(this.shape);
            }
        }
    });
};


////////////////////////////////////////////////////////////////////////////////////////////////////
// PLANE SHAPE /////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////
var P2Plane = pc.createScript('p2Plane');

P2Plane.attributes.add('angle', {
    type: 'number',
    default: 0,
    title: 'Angle',
    description: 'Body-local angle of the shape in degrees.',
    placeholder: 'degrees'
});
P2Plane.attributes.add('position', {
    type: 'vec2',
    default: [ 0, 0 ],
    title: 'Position',
    description: 'Body-local position of the shape.',
    placeholder: [ 'X', 'Y' ]
});
P2Plane.attributes.add('collisionGroup', {
    type: 'string',
    default: '00000001',
    title: 'Collision Group',
    description: 'Collision group that this shape belongs to (bit mask).'
});
P2Plane.attributes.add('collisionMask', {
    type: 'string',
    default: '00000001',
    title: 'Collision Mask',
    description: 'Collision mask of this shape. See .collisionGroup.'
});
P2Plane.attributes.add('sensor', {
    type: 'boolean',
    default: false,
    title: 'Sensor',
    description: 'Set to true if you want this shape to be a sensor. A sensor does not generate contacts, but it still reports contact events. This is good if you want to know if a shape is overlapping another shape, without them generating contacts.'
});

P2Plane.prototype.initialize = function() {
    this.shape = new p2.Plane({
        angle: this.angle * Math.PI / 180,
        collisionGroup: parseInt(this.collisionGroup, 2),
        collisionMask: parseInt(this.collisionMask, 2),
        position: [ this.position.x, this.position.y ],
        sensor: this.sensor
    });

    // Handle changes to the plane's properties
    this.on('attr:angle', function (value, prev) {
        this.shape.angle = value * Math.PI / 180;
    });
    this.on('attr:collisionGroup', function (value, prev) {
        this.shape.collisionGroup = parseInt(value, 2);
    });
    this.on('attr:collisionMask', function (value, prev) {
        this.shape.collisionMask = parseInt(value, 2);
    });
    this.on('attr:position', function (value, prev) {
        this.shape.position[0] = value.x;
        this.shape.position[1] = value.y;
    });
    this.on('attr:sensor', function (value, prev) {
        this.shape.sensor = value;
    });
    
    // If there's already a body created, simply add the shape to it
    if (this.entity.script.p2Body) {
        var body = this.entity.script.p2Body.body;
        if (body) {
            body.addShape(this.shape);
        }
    }

    this.on("enable", function () {
        if (this.entity.script.p2Body) {
            var body = this.entity.script.p2Body.body;
            if (body) {
                body.addShape(this.shape);
            }
        }
    });
    this.on("disable", function () {
        if (this.entity.script.p2Body) {
            var body = this.entity.script.p2Body.body;
            if (body) {
                body.removeShape(this.shape);
            }
        }
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////
// RIGID BODY //////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////
var P2Body = pc.createScript('p2Body');

P2Body.attributes.add('type', {
    type: 'number',
    enum: [
        { 'Static': 0 },
        { 'Dynamic': 1 },
        { 'Kinematic': 2 }
    ],
    default: 1,
    title: 'Type',
    description: 'The type of motion this body has. Should be one of: 0 (Static), 1 (Dynamic) and 2 (Kinematic). Static bodies do not move, and they do not respond to forces or collision. Dynamic bodies body can move and respond to collisions and forces. Kinematic bodies only moves according to its velocity, and does not respond to collisions or force.'
});
P2Body.attributes.add('mass', {
    type: 'number',
    default: 1,
    title: 'Mass',
    description: 'The mass of the body.'
});
P2Body.attributes.add('velocity', {
    type: 'vec2',
    default: [ 0, 0 ],
    title: 'Velocity',
    description: 'The current velocity of the body.',
    placeholder: ['X', 'Y']
});
P2Body.attributes.add('angularVelocity', {
    type: 'number',
    default: 0,
    title: 'Angular Velocity',
    description: 'The angular velocity of the body, in degrees per second.',
    placeholder: 'degrees/s'
});
P2Body.attributes.add('damping', {
    type: 'number',
    default: 0.1,
    min: 0,
    max: 1,
    title: 'Damping',
    description: 'The linear damping acting on the body in the velocity direction. Should be a value between 0 and 1.'
});
P2Body.attributes.add('angularDamping', {
    type: 'number',
    min: 0,
    max: 1,
    default: 0.1,
    title: 'Angular Damping',
    description: 'The angular damping acting on the body. Should be a value between 0 and 1.'
});
P2Body.attributes.add('gravityScale', {
    type: 'number',
    default: 1,
    title: 'Gravity Scale',
    description: 'Gravity scaling factor. If you want the body to ignore gravity, set this to zero. If you want to reverse gravity, set it to -1.'
});
P2Body.attributes.add('fixedX', {
    type: 'boolean',
    default: false,
    title: 'Fixed X',
    description: 'Set to true if you want to fix the body movement along the X axis. The body will still be able to move along Y.'
});
P2Body.attributes.add('fixedY', {
    type: 'boolean',
    default: false,
    title: 'Fixed Y',
    description: 'Set to true if you want to fix the body movement along the Y axis. The body will still be able to move along X.'
});
P2Body.attributes.add('fixedRotation', {
    type: 'boolean',
    default: false,
    title: 'Fixed Rotation',
    description: 'Set to true if you want to fix the rotation of the body.'
});
P2Body.attributes.add('allowSleep', {
    type: 'boolean',
    default: true,
    title: 'Allow Sleep',
    description: 'If true, the body will automatically fall to sleep. Note that you need to enable sleeping in the p2World before anything will happen.'
});
P2Body.attributes.add('sleepSpeedLimit', {
    type: 'number',
    default: 0.2,
    title: 'Sleep Speed Limit',
    description: 'If the speed (the norm of the velocity) is smaller than this value, the body is considered sleepy.'
});
P2Body.attributes.add('sleepTimeLimit', {
    type: 'number',
    default: 1,
    title: 'Sleep Time Limit',
    description: 'If the body has been sleepy for this sleepTimeLimit seconds, it is considered sleeping.',
    placeholder: 'seconds'
});
P2Body.attributes.add('collisionResponse', {
    type: 'boolean',
    default: true,
    title: 'Collision Response',
    description: 'Whether to produce contact forces when in contact with other bodies. Note that contacts will be generated, but they will be disabled. That means that this body will move through other bodies, but it will still trigger contact events, etc.'
});

Object.defineProperty(P2Body.prototype, 'angularForce', {
    get: function() {
        return this.body ? this.body.angularForce : 0;
    },
    set: function(value) {
        this.body.angularForce = value;
    }
});

P2Body.prototype.postInitialize = function() {
    var bodyTypes = [
        p2.Body.STATIC,
        p2.Body.DYNAMIC,
        p2.Body.KINEMATIC
    ];

    var pos = [ 0, 0 ];
    this.app.fire('p2:getPosition', this.entity, pos);

    // Create a rigid body
    var type = bodyTypes[this.type];
    this.body = new p2.Body({
        allowSleep: this.allowSleep,
        angularVelocity: this.angularVelocity,
        angle: 0,
        collisionResponse: this.collisionResponse,
        gravityScale: this.gravityScale,
        mass: (type === p2.Body.STATIC) ? 0 : this.mass,
        type: type,
        velocity: [ this.velocity.x, this.velocity.y ]
    });
    this.body.fixedX = this.fixedX;
    this.body.fixedY = this.fixedY;
    this.body.fixedRotation = this.fixedRotation;

    this.body.entity = this.entity;

    // Handle changes to the body's properties
    this.on('attr:allowSleep', function (value, prev) {
        this.body.allowSleep = value;
    });
    this.on('attr:angularDamping', function (value, prev) {
        this.body.angularDamping = value;
    });
    this.on('attr:collisionResponse', function (value, prev) {
        this.body.collisionResponse = value;
    });
    this.on('attr:damping', function (value, prev) {
        this.body.damping = value;
    });
    this.on('attr:fixedX', function (value, prev) {
        this.body.fixedX = value;
    });
    this.on('attr:fixedY', function (value, prev) {
        this.body.fixedY = value;
    });
    this.on('attr:fixedRotation', function (value, prev) {
        this.body.fixedRotation = value;
    });
    this.on('attr:gravityScale', function (value, prev) {
        this.body.gravityScale = value;
    });
    this.on('attr:mass', function (value, prev) {
        this.body.mass = value;
        this.body.updateMassProperties();
    });
    this.on('attr:type', function (value, prev) {
        this.body.type = bodyTypes[value];
    });

    // Add a shape to the body
    var shape;
    if (this.entity.script.p2Box) {
        shape = this.entity.script.p2Box.shape;
    }
    if (this.entity.script.p2Capsule) {
        shape = this.entity.script.p2Capsule.shape;
    }
    if (this.entity.script.p2Circle) {
        shape = this.entity.script.p2Circle.shape;
    }
    if (this.entity.script.p2Plane) {
        shape = this.entity.script.p2Plane.shape;
    }
    if (shape) {
        this.body.addShape(shape);
    }

    // Add the body to the phsyics world
    this.app.fire('p2:addBody', this.body);
    
    this.on("enable", function () {
        this.app.fire('p2:addBody', this.body);
    });
    this.on("disable", function () {
        this.app.fire('p2:removeBody', this.body);
    });

    // Notify other components on the entity that there's a new body
    this.entity.fire('p2:newBody', this.body);
};

////////////////////////////////////////////////////////////////////////////////////////////////////
// DISTANCE CONSTRAINT /////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////
var P2DistanceConstraint = pc.createScript('p2DistanceConstraint');

P2DistanceConstraint.attributes.add('entityA', {
    type: 'entity',
    title: 'Entity A',
    description: 'First entity with body participating in the constraint.'
});
P2DistanceConstraint.attributes.add('localAnchorA', {
    type: 'vec2',
    default: [ 0, 0 ],
    title: 'Local Anchor A',
    description: 'Local anchor in body A specified in local body coordinates.',
    placeholder: ['X', 'Y']
});
P2DistanceConstraint.attributes.add('entityB', {
    type: 'entity',
    title: 'Entity B',
    description: 'Second entity with body participating in the constraint.'
});
P2DistanceConstraint.attributes.add('localAnchorB', {
    type: 'vec2',
    default: [ 0, 0 ],
    title: 'Local Anchor B',
    description: 'Local anchor in body B specified in local body coordinates.',
    placeholder: ['X', 'Y']
});
P2DistanceConstraint.attributes.add('collideConnected', {
    type: 'boolean',
    default: true,
    title: 'Collide Connected',
    description: 'Set to true if you want the connected bodies to collide.'
});
P2DistanceConstraint.attributes.add('stiffness', {
    type: 'number',
    default: 1000000,
    title: 'Stiffness',
    description: 'Set stiffness for this constraint.'
});
P2DistanceConstraint.attributes.add('relaxation', {
    type: 'number',
    default: 4,
    title: 'Relaxation',
    description: 'Set relaxation for this constraint.'
});

P2DistanceConstraint.prototype.createConstraint = function() {
    // (Re-)create the constraint
    if (this.constraint) {
        this.bodyA.world.removeConstraint(this.constraint);
    }
    this.constraint = new p2.DistanceConstraint(this.bodyA, this.bodyB, {
        collideConnected: this.collideConnected,
        localAnchorA: [ this.localAnchorA.x, this.localAnchorA.y ],
        localAnchorB: [ this.localAnchorB.x, this.localAnchorB.y ]
    });
    this.constraint.setStiffness(this.stiffness);
    this.constraint.setRelaxation(this.relaxation);
    this.bodyA.world.addConstraint(this.constraint);
};

P2DistanceConstraint.prototype.postInitialize = function() {
    this.bodyA = null;
    this.bodyB = null;
    if (this.entityA && this.entityA.script && this.entityA.script.p2Body) {
        this.bodyA = this.entityA.script.p2Body.body;
    }
    if (this.entityB && this.entityB.script && this.entityB.script.p2Body) {
        this.bodyB = this.entityB.script.p2Body.body;
    }

    // If we have two bodies, we can go ahead and create the constraint
    if (this.bodyA && this.bodyB) {
        this.createConstraint();
    }
    
    // One of the two bodies has changed so (re-)create the constraint
    var self = this;
    if (this.entityA) {
        this.entityA.on('p2:newBody', function (body) {
            self.bodyA = body;
            if (self.bodyB) {
                self.createConstraint();
            }
        });    
    }
    if (this.entityB) {
        this.entityB.on('p2:newBody', function (body) {
            self.bodyB = body;
            if (self.bodyA) {
                self.createConstraint();
            }
        });    
    }

    // Handle changes to the constraint's properties
    this.on('attr:entityA', function (value, prev) {
        prev.off('p2:newBody');
        value.on('p2:newBody', function (body) {
            this.bodyA = body;
            if (this.bodyB) {
                this.createConstraint();
            }
        });    
    });
    this.on('attr:entityB', function (value, prev) {
        prev.off('p2:newBody');
        value.on('p2:newBody', function (body) {
            this.bodyB = body;
            if (this.bodyA) {
                this.createConstraint();
            }
        });    
    });
    this.on('attr:localAnchorA', function (value, prev) {
        if (this.constraint) {
            this.constraint.localAnchorA[0] = value.x;
            this.constraint.localAnchorA[1] = value.y;
        }
    });
    this.on('attr:localAnchorB', function (value, prev) {
        if (this.constraint) {
            this.constraint.localAnchorB[0] = value.x;
            this.constraint.localAnchorB[1] = value.y;
        }
    });
    this.on('attr:relaxation', function (value, prev) {
        if (this.constraint) {
            this.constraint.setRelaxation(value);
        }
    });
    this.on('attr:stiffness', function (value, prev) {
        if (this.constraint) {
            this.constraint.setStiffness(value);
        }
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////
// PRISMATIC CONSTRAINT ////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////
var P2PrismaticConstraint = pc.createScript('p2PrismaticConstraint');

P2PrismaticConstraint.attributes.add('entityA', {
    type: 'entity',
    title: 'Entity A',
    description: 'First entity with body participating in the constraint.'
});
P2PrismaticConstraint.attributes.add('localAnchorA', {
    type: 'vec2',
    default: [ 0, 0 ],
    title: 'Local Anchor A',
    description: 'Local anchor in body A specified in local body coordinates.',
    placeholder: ['X', 'Y']
});
P2PrismaticConstraint.attributes.add('entityB', {
    type: 'entity',
    title: 'Entity B',
    description: 'Second entity with body participating in the constraint.'
});
P2PrismaticConstraint.attributes.add('localAnchorB', {
    type: 'vec2',
    default: [ 0, 0 ],
    title: 'Local Anchor B',
    description: 'Local anchor in body B specified in local body coordinates.',
    placeholder: ['X', 'Y']
});
P2PrismaticConstraint.attributes.add('localAxisA', {
    type: 'vec2',
    default: [ 1, 0 ],
    title: 'Local Axis A',
    description: "An axis, defined in body A frame, that body B's anchor point may slide along.",
    placeholder: ['X', 'Y']
});
P2PrismaticConstraint.attributes.add('disableRotationalLock', {
    type: 'boolean',
    default: false,
    title: 'Disable Rotational Lock',
    description: 'If set to true, body of entityB will be free to rotate around its anchor point.'
});
P2PrismaticConstraint.attributes.add('collideConnected', {
    type: 'boolean',
    default: true,
    title: 'Collide Connected',
    description: 'Set to true if you want the connected bodies to collide.'
});
P2PrismaticConstraint.attributes.add('stiffness', {
    type: 'number',
    default: 1000000,
    title: 'Stiffness',
    description: 'Set stiffness for this constraint.'
});
P2PrismaticConstraint.attributes.add('relaxation', {
    type: 'number',
    default: 4,
    title: 'Relaxation',
    description: 'Set relaxation for this constraint.'
});

P2PrismaticConstraint.prototype.createConstraint = function() {
    // (Re-)create the constraint
    if (this.constraint) {
        this.bodyA.world.removeConstraint(this.constraint);
    }
    this.constraint = new p2.PrismaticConstraint(this.bodyA, this.bodyB, {
        collideConnected: this.collideConnected,
        disableRotationalLock: this.disableRotationalLock,
        localAnchorA: [ this.localAnchorA.x, this.localAnchorA.y ],
        localAnchorB: [ this.localAnchorB.x, this.localAnchorB.y ],
        localAxisA: [ this.localAxisA.x, this.localAxisA.y ]
    });
    this.constraint.setStiffness(this.stiffness);
    this.constraint.setRelaxation(this.relaxation);
    this.bodyA.world.addConstraint(this.constraint);
};

P2PrismaticConstraint.prototype.postInitialize = function() {
    this.bodyA = null;
    this.bodyB = null;
    if (this.entityA && this.entityA.script && this.entityA.script.p2Body) {
        this.bodyA = this.entityA.script.p2Body.body;
    }
    if (this.entityB && this.entityB.script && this.entityB.script.p2Body) {
        this.bodyB = this.entityB.script.p2Body.body;
    }

    // If we have two bodies, we can go ahead and create the constraint
    if (this.bodyA && this.bodyB) {
        this.createConstraint();
    }
    
    // One of the two bodies has changed so (re-)create the constraint
    var self = this;
    if (this.entityA) {
        this.entityA.on('p2:newBody', function (body) {
            self.bodyA = body;
            if (self.bodyB) {
                self.createConstraint();
            }
        });    
    }
    if (this.entityB) {
        this.entityB.on('p2:newBody', function (body) {
            self.bodyB = body;
            if (self.bodyA) {
                self.createConstraint();
            }
        });    
    }

    // Handle changes to the constraint's properties
    this.on('attr:entityA', function (value, prev) {
        prev.off('p2:newBody');
        value.on('p2:newBody', function (body) {
            this.bodyA = body;
            if (this.bodyB) {
                this.createConstraint();
            }
        });    
    });
    this.on('attr:entityB', function (value, prev) {
        prev.off('p2:newBody');
        value.on('p2:newBody', function (body) {
            this.bodyB = body;
            if (this.bodyA) {
                this.createConstraint();
            }
        });    
    });
    this.on('attr:localAnchorA', function (value, prev) {
        if (this.constraint) {
            this.constraint.localAnchorA[0] = value.x;
            this.constraint.localAnchorA[1] = value.y;
        }
    });
    this.on('attr:localAnchorB', function (value, prev) {
        if (this.constraint) {
            this.constraint.localAnchorB[0] = value.x;
            this.constraint.localAnchorB[1] = value.y;
        }
    });
    this.on('attr:localAxisA', function (value, prev) {
        if (this.constraint) {
            this.constraint.localAxisA[0] = value.x;
            this.constraint.localAxisA[1] = value.y;
        }
    });
    this.on('attr:relaxation', function (value, prev) {
        if (this.constraint) {
            this.constraint.setRelaxation(value);
        }
    });
    this.on('attr:stiffness', function (value, prev) {
        if (this.constraint) {
            this.constraint.setStiffness(value);
        }
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////
// REVOLUTE CONSTRAINT /////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////
var P2RevoluteConstraint = pc.createScript('p2RevoluteConstraint');

P2RevoluteConstraint.attributes.add('entityA', {
    type: 'entity',
    title: 'Entity A',
    description: 'First entity with body participating in the constraint.'
});
P2RevoluteConstraint.attributes.add('localPivotA', {
    type: 'vec2',
    default: [ 0, 0 ],
    title: 'Local Pivot A',
    description: 'Local pivot in body A specified in local body coordinates.',
    placeholder: ['X', 'Y']
});
P2RevoluteConstraint.attributes.add('entityB', {
    type: 'entity',
    title: 'Entity B',
    description: 'Second entity with body participating in the constraint.'
});
P2RevoluteConstraint.attributes.add('localPivotB', {
    type: 'vec2',
    default: [ 0, 0 ],
    title: 'Local Pivot B',
    description: 'Local pivot in body B specified in local body coordinates.',
    placeholder: ['X', 'Y']
});
P2RevoluteConstraint.attributes.add('collideConnected', {
    type: 'boolean',
    default: true,
    title: 'Collide Connected',
    description: 'Set to true if you want the connected bodies to collide.'
});
P2RevoluteConstraint.attributes.add('stiffness', {
    type: 'number',
    default: 1000000,
    title: 'Stiffness',
    description: 'Set stiffness for this constraint.'
});
P2RevoluteConstraint.attributes.add('relaxation', {
    type: 'number',
    default: 4,
    title: 'Relaxation',
    description: 'Set relaxation for this constraint.'
});
P2RevoluteConstraint.attributes.add('limitsEnabled', {
    type: 'boolean',
    default: false,
    title: 'Limits Enabled',
    description: 'Enable constraint angle limits.'
});
P2RevoluteConstraint.attributes.add('limits', {
    type: 'vec2',
    default: [ 0, 0 ],
    title: 'Limits',
    description: 'Set the constraint angle limits.',
    placeholder: ['lower', 'upper']
});
P2RevoluteConstraint.attributes.add('motorEnabled', {
    type: 'boolean',
    default: false,
    title: 'Motor Enabled',
    description: 'Enable the rotational motor.'
});
P2RevoluteConstraint.attributes.add('motorSpeed', {
    type: 'number',
    default: 0,
    title: 'Motor Speed',
    description: 'Set the speed of the rotational constraint motor.'
});

P2RevoluteConstraint.prototype.createConstraint = function() {
    // (Re-)create the constraint
    if (this.constraint) {
        this.bodyA.world.removeConstraint(this.constraint);
    }
    this.constraint = new p2.RevoluteConstraint(this.bodyA, this.bodyB, {
        collideConnected: this.collideConnected,
        localPivotA: [ this.localPivotA.x, this.localPivotA.y ],
        localPivotB: [ this.localPivotB.x, this.localPivotB.y ]
    });
    if (this.constraint.limitsEnabled) {
        this.constraint.setLimits(this.limits.x * Math.PI / 180, this.limits.y * Math.PI / 180);
    }
    this.constraint.setStiffness(this.stiffness);
    this.constraint.setRelaxation(this.relaxation);
    if (this.motorEnabled) {
        this.constraint.enableMotor();
    } else {
        this.constraint.disableMotor();
    }
    this.constraint.setMotorSpeed(this.motorSpeed);

    this.bodyA.world.addConstraint(this.constraint);
};

P2RevoluteConstraint.prototype.postInitialize = function() {
    this.bodyA = null;
    this.bodyB = null;
    if (this.entityA && this.entityA.script && this.entityA.script.p2Body) {
        this.bodyA = this.entityA.script.p2Body.body;
    }
    if (this.entityB && this.entityB.script && this.entityB.script.p2Body) {
        this.bodyB = this.entityB.script.p2Body.body;
    }

    // If we have two bodies, we can go ahead and create the constraint
    if (this.bodyA && this.bodyB) {
        this.createConstraint();
    }
    
    // One of the two bodies has changed so (re-)create the constraint
    var self = this;
    if (this.entityA) {
        this.entityA.on('p2:newBody', function (body) {
            self.bodyA = body;
            if (self.bodyB) {
                self.createConstraint();
            }
        });    
    }
    if (this.entityB) {
        this.entityB.on('p2:newBody', function (body) {
            self.bodyB = body;
            if (self.bodyA) {
                self.createConstraint();
            }
        });    
    }

    // Handle changes to the constraint's properties
    this.on('attr:entityA', function (value, prev) {
        prev.off('p2:newBody');
        value.on('p2:newBody', function (body) {
            this.bodyA = body;
            if (this.bodyB) {
                this.createConstraint();
            }
        });    
    });
    this.on('attr:entityB', function (value, prev) {
        prev.off('p2:newBody');
        value.on('p2:newBody', function (body) {
            this.bodyB = body;
            if (this.bodyA) {
                this.createConstraint();
            }
        });    
    });
    this.on('attr:limits', function (value, prev) {
        if (this.constraint) {
            if (this.constraint.limitsEnabled) {
                this.constraint.setLimits(this.limits.x * Math.PI / 180, this.limits.y * Math.PI / 180);
            }
        }
    });
    this.on('attr:limitsEnabled', function (value, prev) {
        if (this.constraint) {
            if (value) {
                this.constraint.setLimits(this.limits.x * Math.PI / 180, this.limits.y * Math.PI / 180);
            } else {
                this.constraint.lowerlimitEnabled = false;                
                this.constraint.upperlimitEnabled = false;                
            }
        }
    });
    this.on('attr:lowerLimitEnabled', function (value, prev) {
        if (this.constraint) {
            this.constraint.lowerLimitEnabled = value;
        }
    });
    this.on('attr:localPivotA', function (value, prev) {
        if (this.constraint) {
            this.constraint.localPivotA[0] = value.x;
            this.constraint.localPivotA[1] = value.y;
        }
    });
    this.on('attr:localPivotB', function (value, prev) {
        if (this.constraint) {
            this.constraint.localPivotB[0] = value.x;
            this.constraint.localPivotB[1] = value.y;
        }
    });
    this.on('attr:motorEnabled', function (value, prev) {
        if (this.constraint) {
            if (value) {
                this.constraint.enableMotor();
            } else {
                this.constraint.disableMotor();
            }
        }
    });
    this.on('attr:motorSpeed', function (value, prev) {
        if (this.constraint) {
            this.constraint.setMotorSpeed(value);
        }
    });
    this.on('attr:relaxation', function (value, prev) {
        if (this.constraint) {
            this.constraint.setRelaxation(value);
        }
    });
    this.on('attr:stiffness', function (value, prev) {
        if (this.constraint) {
            this.constraint.setStiffness(value);
        }
    });
    this.on('attr:upperLimit', function (value, prev) {
        if (this.constraint) {
            this.constraint.upperLimit = value;
        }
    });
    this.on('attr:upperLimitEnabled', function (value, prev) {
        if (this.constraint) {
            this.constraint.upperLimitEnabled = value;
        }
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////
// LINEAR SPRING ///////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////
var P2LinearSpring = pc.createScript('p2LinearSpring');

P2LinearSpring.attributes.add('entityA', {
    type: 'entity',
    title: 'Entity A',
    description: 'First connected entity.'
});
P2LinearSpring.attributes.add('anchorA', {
    type: 'vec2',
    default: [ 0, 0 ],
    title: 'Anchor A',
    description: 'Where to hook the spring to body A, in local body coordinates or world space coordinates. Defaults to the body center in local space.',
    placeholder: ['X', 'Y']
});
P2LinearSpring.attributes.add('anchorASpace', {
    type: 'number',
    enum: [
        { 'Local': 0 },
        { 'World': 1 }
    ],
    default: 0,
    title: 'Anchor A Space',
    description: 'The coordinate space for anchor A. Can be local body space or world space.'
});
P2LinearSpring.attributes.add('entityB', {
    type: 'entity',
    title: 'Entity B',
    description: 'Second connected entity.'
});
P2LinearSpring.attributes.add('anchorB', {
    type: 'vec2',
    default: [ 0, 0 ],
    title: 'Anchor B',
    description: 'Where to hook the spring to body B, in local body coordinates or world space coordinates. Defaults to the body center in local space.',
    placeholder: ['X', 'Y']
});
P2LinearSpring.attributes.add('anchorBSpace', {
    type: 'number',
    enum: [
        { 'Local': 0 },
        { 'World': 1 }
    ],
    default: 0,
    title: 'Anchor B Space',
    description: 'The coordinate space for anchor B. Can be local body space or world space.'
});
P2LinearSpring.attributes.add('restLength', {
    type: 'number',
    default: 0,
    title: 'Rest Length',
    description: 'Rest length of the spring.'
});
P2LinearSpring.attributes.add('stiffness', {
    type: 'number',
    default: 100,
    title: 'Stiffness',
    description: 'Stiffness of the spring. See Hookes Law.'
});
P2LinearSpring.attributes.add('damping', {
    type: 'number',
    default: 1,
    title: 'Damping',
    description: 'Damping of the spring.'
});

P2LinearSpring.prototype.createSpring = function() {
    // (Re-)create the spring
    if (this.spring) {
        this.bodyA.world.removeSpring(this.spring);
    }

    var options = {
        damping: this.damping,
        stiffness: this.stiffness
    };
    if (this.anchorASpace === 0) {
        options.localAnchorA = [ this.anchorA.x, this.anchorA.y ];
    } else {
        options.worldAnchorA = [ this.anchorA.x, this.anchorA.y ];
    }
    if (this.anchorBSpace === 0) {
        options.localAnchorB = [ this.anchorB.x, this.anchorB.y ];
    } else {
        options.worldAnchorB = [ this.anchorB.x, this.anchorB.y ];
    }
    if (this.restLength > 0) {
        options.restLength = this.restLength;
    }
    
    this.spring = new p2.LinearSpring(this.bodyA, this.bodyB, options);
    this.bodyA.world.addSpring(this.spring);
};

P2LinearSpring.prototype.postInitialize = function() {
    this.bodyA = null;
    this.bodyB = null;
    if (this.entityA && this.entityA.script && this.entityA.script.p2Body) {
        this.bodyA = this.entityA.script.p2Body.body;
    }
    if (this.entityB && this.entityB.script && this.entityB.script.p2Body) {
        this.bodyB = this.entityB.script.p2Body.body;
    }

    // If we have two bodies, we can go ahead and create the spring
    if (this.bodyA && this.bodyB) {
        this.createSpring();
    }
    
    // One of the two bodies has changed so (re-)create the spring
    var self = this;
    if (this.entityA) {
        this.entityA.on('p2:newBody', function (body) {
            self.bodyA = body;
            if (self.bodyB) {
                self.createSpring();
            }
        });    
    }
    if (this.entityB) {
        this.entityB.on('p2:newBody', function (body) {
            self.bodyB = body;
            if (self.bodyA) {
                self.createSpring();
            }
        });    
    }

    // Handle changes to the spring's properties
    this.on('attr:anchorA', function (value, prev) {
        if (this.spring) {
            if (this.anchorASpace === 0) {
                this.spring.localAnchorA[0] = value.x;
                this.spring.localAnchorA[1] = value.y;
            } else {
                this.spring.worldAnchorA[0] = value.x;
                this.spring.worldAnchorA[1] = value.y;
            }
        }
    });
    this.on('attr:anchorASpace', function (value, prev) {
        if (this.spring) {
            if (value === 0) {
                this.spring.localAnchorA[0] = this.anchorA.x;
                this.spring.localAnchorA[1] = this.anchorA.y;
            } else {
                this.spring.worldAnchorA[0] = this.anchorA.x;
                this.spring.worldAnchorA[1] = this.anchorA.y;
            }
        }
    });
    this.on('attr:anchorB', function (value, prev) {
        if (this.spring) {
            if (this.anchorBSpace === 0) {
                this.spring.localAnchorB[0] = value.x;
                this.spring.localAnchorB[1] = value.y;
            } else {
                this.spring.worldAnchorB[0] = value.x;
                this.spring.worldAnchorB[1] = value.y;
            }
        }
    });
    this.on('attr:anchorBSpace', function (value, prev) {
        if (this.spring) {
            if (value === 0) {
                this.spring.localAnchorB[0] = this.anchorB.x;
                this.spring.localAnchorB[1] = this.anchorB.y;
            } else {
                this.spring.worldAnchorB[0] = this.anchorB.x;
                this.spring.worldAnchorB[1] = this.anchorB.y;
            }
        }
    });
    this.on('attr:damping', function (value, prev) {
        if (this.spring) {
            this.spring.damping = value;
        }
    });
    this.on('attr:entityA', function (value, prev) {
        prev.off('p2:newBody');
        value.on('p2:newBody', function (body) {
            this.bodyA = body;
            if (this.bodyB) {
                this.createSpring();
            }
        });
    });
    this.on('attr:entityB', function (value, prev) {
        prev.off('p2:newBody');
        value.on('p2:newBody', function (body) {
            this.bodyB = body;
            if (this.bodyA) {
                this.createSpring();
            }
        });    
    });
    this.on('attr:restLength', function (value, prev) {
        if (this.spring) {
            this.spring.restLength = value;
        }
    });
    this.on('attr:stiffness', function (value, prev) {
        if (this.spring) {
            this.spring.stiffness = value;
        }
    });
};


////////////////////////////////////////////////////////////////////////////////////////////////////
// ROTATIONAL SPRING ///////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////
var P2RotationalSpring = pc.createScript('p2RotationalSpring');

P2RotationalSpring.attributes.add('entityA', {
    type: 'entity',
    title: 'Entity A',
    description: 'First connected entity.'
});
P2RotationalSpring.attributes.add('entityB', {
    type: 'entity',
    title: 'Entity B',
    description: 'Second connected entity.'
});
P2RotationalSpring.attributes.add('stiffness', {
    type: 'number',
    default: 100,
    title: 'Stiffness',
    description: 'Stiffness of the spring. See Hookes Law.'
});
P2RotationalSpring.attributes.add('damping', {
    type: 'number',
    default: 1,
    title: 'Damping',
    description: 'Damping of the spring.'
});

P2RotationalSpring.prototype.createSpring = function() {
    // (Re-)create the spring
    if (this.spring) {
        this.bodyA.world.removeSpring(this.spring);
    }

    var options = {
        damping: this.damping,
        stiffness: this.stiffness
    };
    
    this.spring = new p2.RotationalSpring(this.bodyA, this.bodyB, options);
    this.bodyA.world.addSpring(this.spring);
};

P2RotationalSpring.prototype.postInitialize = function() {
    this.bodyA = null;
    this.bodyB = null;
    if (this.entityA && this.entityA.script && this.entityA.script.p2Body) {
        this.bodyA = this.entityA.script.p2Body.body;
    }
    if (this.entityB && this.entityB.script && this.entityB.script.p2Body) {
        this.bodyB = this.entityB.script.p2Body.body;
    }

    // If we have two bodies, we can go ahead and create the spring
    if (this.bodyA && this.bodyB) {
        this.createSpring();
    }
    
    // One of the two bodies has changed so (re-)create the spring
    var self = this;
    if (this.entityA) {
        this.entityA.on('p2:newBody', function (body) {
            self.bodyA = body;
            if (self.bodyB) {
                self.createSpring();
            }
        });    
    }
    if (this.entityB) {
        this.entityB.on('p2:newBody', function (body) {
            self.bodyB = body;
            if (self.bodyA) {
                self.createSpring();
            }
        });    
    }

    // Handle changes to the spring's properties
    this.on('attr:damping', function (value, prev) {
        if (this.spring) {
            this.spring.damping = value;
        }
    });
    this.on('attr:entityA', function (value, prev) {
        prev.off('p2:newBody');
        value.on('p2:newBody', function (body) {
            this.bodyA = body;
            if (this.bodyB) {
                this.createSpring();
            }
        });
    });
    this.on('attr:entityB', function (value, prev) {
        prev.off('p2:newBody');
        value.on('p2:newBody', function (body) {
            this.bodyB = body;
            if (this.bodyA) {
                this.createSpring();
            }
        });    
    });
    this.on('attr:stiffness', function (value, prev) {
        if (this.spring) {
            this.spring.stiffness = value;
        }
    });
};


////////////////////////////////////////////////////////////////////////////////////////////////////
// TOP DOWN VEHICLE ////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////
var P2TopDownVehicle = pc.createScript('p2TopDownVehicle');

P2TopDownVehicle.attributes.add('engineForce', {
    type: 'number',
    default: 7,
    title: 'Engine Force',
    description: 'The force to apply to the back wheel.'
});
P2TopDownVehicle.attributes.add('reverseForce', { 
    type: 'number',
    default: -2,
    title: 'Reverse Force',
    description: 'The force to apply to the back wheel when reversing.'
});
P2TopDownVehicle.attributes.add('brakeForce', {
    type: 'number',
    default: 5,
    title: 'Brake Force',
    description: 'The force to apply to the back wheel when braking.'
});
P2TopDownVehicle.attributes.add('maxSteer', {
    type: 'number',
    default: 45,
    title: 'Max Steer',
    description: 'The maximum steer angle in degrees.',
    placeholder: 'degrees'
});
P2TopDownVehicle.attributes.add('frontWheelOffset', {
    type: 'vec2',
    default: [ 0, 1],
    title: 'Front Offset',
    description: 'The offset in local body coordinates of the front wheel.',
    placeholder: [ 'X', 'Y' ]
});
P2TopDownVehicle.attributes.add('frontWheelFriction', {
    type: 'number',
    default: 4,
    title: 'Front Friction',
    description: 'The side friction to apply to the front wheel.'
});
P2TopDownVehicle.attributes.add('backWheelOffset', {
    type: 'vec2',
    default: [ 0, -1],
    title: 'Back Offset',
    description: 'The offset in local body coordinates of the back wheel.',
    placeholder: [ 'X', 'Y' ]
});
P2TopDownVehicle.attributes.add('backWheelFriction', {
    type: 'number',
    default: 3,
    title: 'Back Friction',
    description: 'The side friction to apply to the back wheel.'
});

P2TopDownVehicle.prototype.createVehicle = function() {
    var body = this.entity.script.p2Body.body;

    if (this.vehicle) {
        this.vehicle.removeFromWorld(body.world);
    }

    // Create the vehicle
    this.vehicle = new p2.TopDownVehicle(body);

    // Add one front wheel and one back wheel - we don't actually need four :)
    this.frontWheel = this.vehicle.addWheel({
        localPosition: [ this.frontWheelOffset.x, this.frontWheelOffset.y ] // front
    });
    this.frontWheel.setSideFriction(this.frontWheelFriction);

    // Back wheel
    this.backWheel = this.vehicle.addWheel({
        localPosition: [ this.backWheelOffset.x, this.backWheelOffset.y ] // back
    });
    this.backWheel.setSideFriction(this.backWheelFriction); // Less side friction on back wheel makes it easier to drift

    this.vehicle.addToWorld(body.world);
};

P2TopDownVehicle.prototype.postInitialize = function() {
    this.steering = 0;
    this.throttle = false;
    this.brake = false;

    // If we have a body, we can go ahead and create the vehicle
    if (this.entity.script.p2Body.body) {
        this.createVehicle();
    }
    
    // The body has changed so (re-)create the vehicle
    var self = this;
    this.entity.on('p2:newBody', function (body) {
        self.createVehicle();
    });

    // Handle changes to the vehicle's properties
    this.on('attr:frontWheelFriction', function (value, prev) {
        if (this.vehicle) {
            this.frontWheel.setSideFriction(value);
        }
    });
    this.on('attr:frontWheelOffset', function (value, prev) {
        if (this.vehicle) {
            this.frontWheel.localPosition[0] = value.x;
            this.frontWheel.localPosition[1] = value.y;
        }
    });
    this.on('attr:backWheelFriction', function (value, prev) {
        if (this.vehicle) {
            this.backWheel.setSideFriction(value);
        }
    });
    this.on('attr:backWheelOffset', function (value, prev) {
        if (this.vehicle) {
            this.backWheel.localPosition[0] = value.x;
            this.backWheel.localPosition[1] = value.y;
        }
    });

    this.on("enable", function () {
        if (this.vehicle && this.entity.script && this.entity.script.p2Body && this.entity.script.p2Body.body) {
            this.vehicle.addToWorld(this.entity.script.p2Body.body.world);
        }
    });
    this.on("disable", function () {
        if (this.vehicle && this.entity.script && this.entity.script.p2Body && this.entity.script.p2Body.body) {
            this.vehicle.removeFromWorld(this.entity.script.p2Body.body.world);
        }
    });
};

P2TopDownVehicle.prototype.update = function(dt) {
    if (this.vehicle) {
        this.frontWheel.steerValue = this.steering * this.maxSteer / 180 * Math.PI;

        // Engine force forward
        this.backWheel.engineForce = this.throttle ? this.engineForce : 0;
        this.backWheel.setBrakeForce(0);

        if (this.brake) {
            if (this.backWheel.getSpeed() > 0.1){
                // Moving forward - add some brake force to slow down
                this.backWheel.setBrakeForce(this.brakeForce);
            } else {
                // Moving backwards - reverse the engine force
                this.backWheel.setBrakeForce(0);
                this.backWheel.engineForce = this.reverseForce;
            }
        }
    }
};
