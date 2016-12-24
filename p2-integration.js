////////////////////////////////////////////////////////////////////////////////////////////////////
// PHYSICS WORLD ///////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////
var P2World = pc.createScript('p2World');

P2World.attributes.add('maxSubSteps', { type: 'number', default: 10 });
P2World.attributes.add('gravity', { type: 'vec2', default: [ 0, -9.8 ] });
P2World.attributes.add('axes', {
    type: 'number',
    enum: [
        { 'XY': 1 },
        { 'XZ': 2 },
        { 'YZ': 3 }
    ],
    default: 1
});
P2World.attributes.add('sleepMode', {
    type: 'number',
    enum: [
        { 'No Sleeping': 0 },
        { 'Body Sleeping': 1 },
        { 'Island Sleeping': 2 }
    ],
    default: 0
});
P2World.attributes.add('solverIterations', { type: 'number', default: 10 });
P2World.attributes.add('solverTolerance', { type: 'number', default: 0 });

P2World.prototype.initialize = function() {
    var static = [];
    var dynamic = [];
    var kinematic = [];
    
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
        ]
    });
    world.sleepMode = sleepModes[this.sleepMode];
    world.solver.iterations = this.solverIterations;
    world.solver.tolerance = this.solverTolerance;

    // Handle changes to the World's properties
    this.on('attr:gravity', function (value, prev) {
        world.gravity[0] = value.x;
        world.gravity[1] = value.y;
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

    this.app.on('p2:addBody', function (body, entity) {
        var pos = entity.getPosition();
        switch (self.axes) {
            case 1:
                body.position = [ pos.x, pos.y ];
                break;
            case 2:
                body.position = [ pos.x, -pos.z ];
                break;
            case 3:
                body.position = [ -pos.z, pos.y ];
                break;
        }

        world.addBody(body);

        var record = {
            entity: entity,
            body: body
        };

        switch (body.type) {
            case p2.Body.STATIC:
                static.push(record);
                break;
            case p2.Body.DYNAMIC:
                dynamic.push(record);
                break;
            case p2.Body.KINEMATIC:
                kinematic.push(record);
                break;
        }
    });

    this.app.on('p2:addVehicle', function (vehicle) {
        vehicle.addToWorld(world);
    });

    this.world = world;
    this.static = static;
    this.dynamic = dynamic;
    this.kinematic = kinematic;
};

P2World.prototype.postUpdate = function(dt) {
    var i, bodyDef, body, entity, pos;

    // Set the transforms of kinematic bodies from entities
    for (i = 0; i < this.kinematic.length; i++) {
        bodyDef = this.kinematic[i];
        body = bodyDef.body;
        entity = bodyDef.entity;

        // TODO: handle angle
        pos = entity.getPosition();

        switch (this.axes) {
            case 1:
                body.position[0] = pos.x;
                body.position[1] = pos.y;
                break;
            case 2:
                body.position[0] = pos.x;
                body.position[1] = -pos.z;
                break;
            case 3:
                body.position[0] = pos.y;
                body.position[1] = -pos.z;
                break;
        }
    }

    // Update the simulation
    this.world.step(1 / 60, dt, this.maxSubSteps);

    // Set the transforms of entities from dynamic bodies
    for (i = 0; i < this.dynamic.length; i++) {
        bodyDef = this.dynamic[i];
        body = bodyDef.body;
        entity = bodyDef.entity;

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
};

var P2Materials = {};

////////////////////////////////////////////////////////////////////////////////////////////////////
// BOX SHAPE ///////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////
var P2Box = pc.createScript('p2Box');

P2Box.attributes.add('width', { type: 'number', default: 1 });
P2Box.attributes.add('height', { type: 'number', default: 1 });
P2Box.attributes.add('offset', { type: 'vec2', default: [ 0, 0 ] });
P2Box.attributes.add('friction', { type: 'number', default: 0.55 });
P2Box.attributes.add('restitution', { type: 'number', default: 0.55 });

P2Box.prototype.initialize = function() {
    this.shape = new p2.Box({
        width: this.width,
        height: this.height,
        position: [ this.offset.x, this.offset.y ]
    });

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

//    this.shape.material = material;

    this.on('attr:width', function (value, prev) {
        this.shape.width = value;
    });
    this.on('attr:height', function (value, prev) {
        this.shape.height = value;
    });
    this.on('attr:offset', function (value, prev) {
        this.shape.position[0] = value.x;
        this.shape.position[1] = value.y;
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////
// CIRCLE SHAPE ////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////
var P2Circle = pc.createScript('p2Circle');

P2Circle.attributes.add('radius', { type: 'number', default: 1 });
P2Circle.attributes.add('offset', { type: 'vec2', default: [ 0, 0 ] });

P2Circle.prototype.initialize = function() {
    this.shape = new p2.Circle({
        radius: this.radius,
        position: [ this.offset.x, this.offset.y ]
    });

    this.on('attr:radius', function (value, prev) {
        this.shape.radius = value;
    });
    this.on('attr:offset', function (value, prev) {
        this.shape.position[0] = value.x;
        this.shape.position[1] = value.y;
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
    default: 1
});
P2Body.attributes.add('mass', { type: 'number', default: 0 });
P2Body.attributes.add('allowSleep', { type: 'boolean', default: true });

P2Body.prototype.postInitialize = function() {
    var shape;
    var bodyTypes = [
        p2.Body.STATIC,
        p2.Body.DYNAMIC,
        p2.Body.KINEMATIC
    ];

    // Create a dynamic body for the chassis
    var type = bodyTypes[this.type];
    this.body = new p2.Body({
        allowSleep: this.allowSleep,
        angle: 0,
        mass: (type === p2.Body.STATIC) ? 0 : this.mass,
        type: type
    });

    if (this.entity.script.p2Box) {
        shape = this.entity.script.p2Box.shape;
    }
    if (this.entity.script.p2Circle) {
        shape = this.entity.script.p2Circle.shape;
    }
    if (shape) {
        this.body.addShape(shape);
        this.app.fire('p2:addBody', this.body, this.entity);
    }

    // Handle changes to the Body's properties
    this.on('attr:allowSleep', function (value, prev) {
        this.body.allowSleep = value;
    });
    this.on('attr:mass', function (value, prev) {
        this.body.mass = value;
        this.body.updateMassProperties();
    });
    this.on('attr:type', function (value, prev) {
        this.body.type = bodyTypes[value];
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////
// TOP DOWN VEHICLE ////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////
var P2Vehicle = pc.createScript('p2Vehicle');

P2Vehicle.attributes.add('mass', { type: 'number', default: 1 });
P2Vehicle.attributes.add('width', { type: 'number', default: 0.5 });
P2Vehicle.attributes.add('length', { type: 'number', default: 1 });
P2Vehicle.attributes.add('engineForce', { type: 'number', default: 7 });
P2Vehicle.attributes.add('reverseForce', { type: 'number', default: -2 });
P2Vehicle.attributes.add('brakeForce', { type: 'number', default: 5 });
P2Vehicle.attributes.add('maxSteer', { type: 'number', default: 36 });
P2Vehicle.attributes.add('frontWheelOffset', { type: 'vec2', default: [ 0, 0.5] });
P2Vehicle.attributes.add('frontWheelFriction', { type: 'number', default: 4 });
P2Vehicle.attributes.add('backWheelOffset', { type: 'vec2', default: [ 0, -0.5] });
P2Vehicle.attributes.add('backWheelFriction', { type: 'number', default: 3 });

P2Vehicle.prototype.postInitialize = function() {
    // Create a dynamic body for the chassis
    this.chassisBody = new p2.Body({
        mass: this.mass
    });
    var boxShape = new p2.Box({ width: this.width, height: this.length  });
    this.chassisBody.addShape(boxShape);
    this.app.fire('p2:addBody', this.chassisBody, this.entity);

    // Create the vehicle
    this.vehicle = new p2.TopDownVehicle(this.chassisBody);

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

    this.app.fire('p2:addVehicle', this.vehicle);

    this.steering = 0;
    this.throttle = false;
    this.brake = false;
};

P2Vehicle.prototype.update = function(dt) {
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
};
