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

P2World.prototype.initialize = function() {
    var static = [];
    var dynamic = [];
    var kinematic = [];

    // Create a physics world
    var world = new p2.World({
        gravity : [
            this.gravity.x,
            this.gravity.y
        ]
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

    this.on('attr:gravity', function (value, prev) {
        this.world.gravity[0] = value.x;
        this.world.gravity[1] = value.y;
    });
    
    this.world = world;
    this.static = static;
    this.dynamic = dynamic;
    this.kinematic = kinematic;
};

P2World.prototype.postUpdate = function(dt) {
    var i, bodyDef, body, entity;

    // Set the transforms of kinematic bodies from entities
    for (i = 0; i < this.kinematic.length; i++) {
        bodyDef = this.kinematic[i];
        body = bodyDef.body;
        entity = bodyDef.entity;

        // TODO: handle angle
        var pos = entity.getPosition();

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

        switch (this.axes) {
            case 1:
                entity.setPosition(body.position[0], body.position[1], 0);
                entity.setEulerAngles(0, 0, body.angle / Math.PI * 180);
                break;
            case 2:
                entity.setPosition(body.position[0], 0, -body.position[1]);
                entity.setEulerAngles(0, body.angle / Math.PI * 180, 0);
                break;
            case 3:
                entity.setPosition(0, body.position[0], -body.position[1]);
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
P2Box.attributes.add('friction', { type: 'number', default: 0.55 });
P2Box.attributes.add('restitution', { type: 'number', default: 0.55 });

P2Box.prototype.initialize = function() {
    this.shape = new p2.Box({
        width: this.width,
        height: this.height
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
};

////////////////////////////////////////////////////////////////////////////////////////////////////
// CIRCLE SHAPE ////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////
var P2Circle = pc.createScript('p2Circle');

P2Circle.attributes.add('radius', { type: 'number', default: 1 });

P2Circle.prototype.initialize = function() {
    this.shape = new p2.Circle({
        radius: this.radius
    });

    this.on('attr:radius', function (value, prev) {
        this.shape.radius = value;
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////
// RIGID BODY //////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////
var P2Body = pc.createScript('p2Body');

P2Body.attributes.add('type', {
    type: 'number',
    enum: [
        { 'Static': 1 },
        { 'Dynamic': 2 },
        { 'Kinematic': 3 }
    ],
    default: 1
});
P2Body.attributes.add('mass', { type: 'number', default: 0 });

P2Body.prototype.postInitialize = function() {
    var shape;
    
    if (this.entity.script.p2Box) {
        shape = this.entity.script.p2Box.shape;
    }
    if (this.entity.script.p2Circle) {
        shape = this.entity.script.p2Circle.shape;
    }

    // Create a dynamic body for the chassis
    var type;
    switch (this.type) {
        case 1: type = p2.Body.STATIC; break;
        case 2: type = p2.Body.DYNAMIC; break;
        case 3: type = p2.Body.KINEMATIC; break;
    }

    this.body = new p2.Body({
        angle: 0,
        mass: (type === p2.Body.STATIC) ? 0 : this.mass,
        type: type
    });
    if (shape) {
        this.body.addShape(shape);
        this.app.fire('p2:addBody', this.body, this.entity);
    }

    this.on('attr:type', function (value, prev) {
        switch (value) {
            case 1: this.body.type = p2.Body.STATIC; break;
            case 2: this.body.type = p2.Body.DYNAMIC; break;
            case 3: this.body.type = p2.Body.KINEMATIC; break;
        }
    });
    this.on('attr:mass', function (value, prev) {
        this.body.mass = value;
        this.body.updateMassProperties();
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