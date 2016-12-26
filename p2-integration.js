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
    });
    this.app.on('p2:removeBody', function (body) {
        world.removeBody(body);
    });
    this.app.on('p2:addVehicle', function (vehicle) {
        vehicle.addToWorld(world);
    });

    this.world = world;
};

P2World.prototype.postUpdate = function(dt) {
    var i, body, entity, pos;

    var bodies = this.world.bodies;
    var numBodies = bodies.length;

    // Set the transforms of kinematic rigid bodies from parent entities
    for (i = 0; i < numBodies; i++) {
        body = bodies[i];
        if (body.type === p2.Body.KINEMATIC) {
            // TODO: handle angle
            entity = body.entity;

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
    }

    // Update the simulation
    this.world.step(1 / 60, dt, this.maxSubSteps);

    // Set the transforms of entities from dynamic bodies
    for (i = 0; i < numBodies; i++) {
        body = bodies[i];
        if (body.type === p2.Body.DYNAMIC) {
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
};

var P2Materials = {};

////////////////////////////////////////////////////////////////////////////////////////////////////
// BOX SHAPE ///////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////
var P2Box = pc.createScript('p2Box');

P2Box.attributes.add('width', { type: 'number', default: 1 });
P2Box.attributes.add('height', { type: 'number', default: 1 });
P2Box.attributes.add('angle', { type: 'number', default: 0 });
P2Box.attributes.add('position', { type: 'vec2', default: [ 0, 0 ] });
P2Box.attributes.add('sensor', { type: 'boolean', default: false });
P2Box.attributes.add('friction', { type: 'number', default: 0.55 });
P2Box.attributes.add('restitution', { type: 'number', default: 0.55 });
P2Box.attributes.add('surfaceVelocity', { type: 'number', default: 0 });

P2Box.prototype.initialize = function() {
    this.shape = new p2.Box({
        angle: this.angle,
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

//    this.shape.material = material;

    var contactMaterial1 = new p2.ContactMaterial(boxShape.material, platformShape1.material, {
        surfaceVelocity:-0.5,
    });
    world.addContactMaterial(contactMaterial1);    
    */
    
    this.on('attr:angle', function (value, prev) {
        this.shape.angle = value * Math.PI / 180;
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

P2Circle.attributes.add('radius', { type: 'number', default: 1 });
P2Circle.attributes.add('angle', { type: 'number', default: 0 });
P2Circle.attributes.add('position', { type: 'vec2', default: [ 0, 0 ] });
P2Circle.attributes.add('sensor', { type: 'boolean', default: false });

P2Circle.prototype.initialize = function() {
    this.shape = new p2.Circle({
        angle: this.angle,
        radius: this.radius,
        position: [ this.position.x, this.position.y ],
        sensor: this.sensor
    });

    this.on('attr:angle', function (value, prev) {
        this.shape.angle = value * Math.PI / 180;
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

P2Capsule.attributes.add('length', { type: 'number', default: 1 });
P2Capsule.attributes.add('radius', { type: 'number', default: 1 });
P2Capsule.attributes.add('angle', { type: 'number', default: 0 });
P2Capsule.attributes.add('position', { type: 'vec2', default: [ 0, 0 ] });
P2Capsule.attributes.add('sensor', { type: 'boolean', default: false });

P2Capsule.prototype.initialize = function() {
    this.shape = new p2.Capsule({
        angle: this.angle,
        length: this.length,
        position: [ this.position.x, this.position.y ],
        radius: this.radius,
        sensor: this.sensor
    });

    this.on('attr:angle', function (value, prev) {
        this.shape.angle = value * Math.PI / 180;
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

P2Plane.attributes.add('angle', { type: 'number', default: 0 });
P2Plane.attributes.add('position', { type: 'vec2', default: [ 0, 0 ] });
P2Plane.attributes.add('sensor', { type: 'boolean', default: false });

P2Plane.prototype.initialize = function() {
    this.shape = new p2.Plane({
        angle: this.angle,
        position: [ this.position.x, this.position.y ],
        sensor: this.sensor
    });

    this.on('attr:angle', function (value, prev) {
        this.shape.angle = value * Math.PI / 180;
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
    default: 1
});
P2Body.attributes.add('mass', { type: 'number', default: 1 });
P2Body.attributes.add('allowSleep', { type: 'boolean', default: true });
P2Body.attributes.add('initialVelocity', { type: 'vec2', default: [ 0, 0 ] });
P2Body.attributes.add('gravityScale', { type: 'number', default: 1 });
P2Body.attributes.add('fixedX', { type: 'boolean', default: false });
P2Body.attributes.add('fixedY', { type: 'boolean', default: false });
P2Body.attributes.add('fixedRotation', { type: 'boolean', default: false });

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
        angle: 0,
        gravityScale: this.gravityScale,
        mass: (type === p2.Body.STATIC) ? 0 : this.mass,
        type: type,
        velocity: [ this.initialVelocity.x, this.initialVelocity.y ]
    });
    this.body.fixedX = this.fixedX;
    this.body.fixedY = this.fixedY;
    this.body.fixedRotation = this.fixedRotation;

    this.body.entity = this.entity;

    // Handle changes to the Body's properties
    this.on('attr:allowSleep', function (value, prev) {
        this.body.allowSleep = value;
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

P2DistanceConstraint.attributes.add('other', { type: 'entity' });
P2DistanceConstraint.attributes.add('collideConnected', { type: 'boolean', default: true });
P2DistanceConstraint.attributes.add('stiffness', { type: 'number', default: 1e6 });
P2DistanceConstraint.attributes.add('relaxation', { type: 'number', default: 4 });
P2DistanceConstraint.attributes.add('localAnchorA', { type: 'vec2', default: [ 0, 0 ] });
P2DistanceConstraint.attributes.add('localAnchorB', { type: 'vec2', default: [ 0, 0 ] });

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
    if (this.entity.script.p2Body) {
        this.bodyA = this.entity.script.p2Body.body;
    }
    if (this.other && this.other.script && this.other.script.p2Body) {
        this.bodyB = this.other.script.p2Body.body;
    }
    
    // If we have two bodies, we can go ahead and create the constraint
    if (this.bodyA && this.bodyB) {
        this.createConstraint();
    }
    
    // One of the two bodies has changed so (re-)create the constraint
    var self = this;
    this.entity.on('p2:newBody', function (body) {
        self.bodyA = body;
        if (self.bodyB) {
            self.createConstraint();
        }
    });
    if (this.other) {
        this.other.on('p2:newBody', function (body) {
            self.bodyB = body;
            if (self.bodyA) {
                self.createConstraint();
            }
        });    
    }

    // Handle changes to the constraint's properties
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
    this.on('attr:other', function (value, prev) {
        prev.off('p2:newBody');
        value.on('p2:newBody', function (body) {
            this.bodyB = body;
            if (this.bodyA) {
                this.createConstraint();
            }
        });    
    });
    this.on('attr:stiffness', function (value, prev) {
        if (this.constraint) {
            this.constraint.setStiffness(value);
        }
    });
    this.on('attr:relaxation', function (value, prev) {
        if (this.constraint) {
            this.constraint.setRelaxation(value);
        }
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////
// REVOLUTE CONSTRAINT /////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////
var P2RevoluteConstraint = pc.createScript('p2RevoluteConstraint');

P2RevoluteConstraint.attributes.add('other', { type: 'entity' });
P2RevoluteConstraint.attributes.add('collideConnected', { type: 'boolean', default: true });
P2RevoluteConstraint.attributes.add('stiffness', { type: 'number', default: 1e6 });
P2RevoluteConstraint.attributes.add('relaxation', { type: 'number', default: 4 });
P2RevoluteConstraint.attributes.add('localPivotA', { type: 'vec2', default: [ 0, 0 ] });
P2RevoluteConstraint.attributes.add('localPivotB', { type: 'vec2', default: [ 0, 0 ] });
P2RevoluteConstraint.attributes.add('limits', { type: 'vec2', default: [ -180, 180 ] });

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
    this.constraint.setStiffness(this.stiffness);
    this.constraint.setRelaxation(this.relaxation);
    this.constraint.setLimits(this.limits.x, this.limits.y);
    this.bodyA.world.addConstraint(this.constraint);
};

P2RevoluteConstraint.prototype.postInitialize = function() {
    this.bodyA = null;
    this.bodyB = null;
    if (this.entity.script.p2Body) {
        this.bodyA = this.entity.script.p2Body.body;
    }
    if (this.other && this.other.script && this.other.script.p2Body) {
        this.bodyB = this.other.script.p2Body.body;
    }
    
    // If we have two bodies, we can go ahead and create the constraint
    if (this.bodyA && this.bodyB) {
        this.createConstraint();
    }
    
    // One of the two bodies has changed so (re-)create the constraint
    var self = this;
    this.entity.on('p2:newBody', function (body) {
        self.bodyA = body;
        if (self.bodyB) {
            self.createConstraint();
        }
    });
    if (this.other) {
        this.other.on('p2:newBody', function (body) {
            self.bodyB = body;
            if (self.bodyA) {
                self.createConstraint();
            }
        });    
    }

    // Handle changes to the constraint's properties
    this.on('attr:limits', function (value, prev) {
        if (this.constraint) {
            this.constraint.setLimits(value.x, value.y);
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
    this.on('attr:other', function (value, prev) {
        prev.off('p2:newBody');
        value.on('p2:newBody', function (body) {
            this.bodyB = body;
            if (this.bodyA) {
                this.createConstraint();
            }
        });    
    });
    this.on('attr:stiffness', function (value, prev) {
        if (this.constraint) {
            this.constraint.setStiffness(value);
        }
    });
    this.on('attr:relaxation', function (value, prev) {
        if (this.constraint) {
            this.constraint.setRelaxation(value);
        }
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
    this.chassisBody.entity = this.entity;
    var boxShape = new p2.Box({ width: this.width, height: this.length  });
    this.chassisBody.addShape(boxShape);
    this.app.fire('p2:addBody', this.chassisBody);

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
