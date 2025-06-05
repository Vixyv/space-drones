"use strict";
// - Classes - //
// Animation classes are under // - Animation - //
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
// Tool classes
class Vector2 {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
    add(vector) { return new Vector2(this.x + vector.x, this.y + vector.y); }
    minus(vector) { return new Vector2(this.x - vector.x, this.y - vector.y); }
    scale(scalar) { return new Vector2(this.x * scalar, this.y * scalar); }
    vec_scale(vector) { return new Vector2(this.x * vector.x, this.y * vector.y); }
    // Row major
    matrix_mult(matrix) {
        return new Vector2(this.x * matrix[0][0] + this.y * matrix[0][1], this.x * matrix[1][0] + this.y * matrix[1][1]);
    }
    magnitude() { return Math.sqrt(this.x ** 2 + this.y ** 2); }
    normalize() {
        let magnitude = this.magnitude();
        if (magnitude == 0) {
            return new Vector2(0, 0);
        }
        else {
            return new Vector2(this.x / magnitude, this.y / magnitude);
        }
    }
    // Used for printing with console.log()
    debug() { return [this.x, this.y]; }
}
class RGB {
    constructor(red, green, blue) {
        this.r = red;
        this.g = green;
        this.b = blue;
    }
    toStr() { return `rgb(${this.r}, ${this.g}, ${this.b})`; }
}
// World object classes
// TODO: Add draw "fill" option (for bullets)
class Polygon {
    constructor(points, colour) {
        this.points = points;
        this.colour = colour;
    }
    transform(rot, scale, pos) {
        let transformed_points = [];
        rot *= DEG_TO_RAD;
        let rot_matrix = [[Math.cos(rot), Math.sin(rot)],
            [-Math.sin(rot), Math.cos(rot)]];
        for (let point = 0; point < this.points.length; point++) {
            transformed_points.push(this.points[point].matrix_mult(rot_matrix).vec_scale(scale).add(pos));
        }
        return transformed_points;
    }
    draw(camera, object) {
        let t_points = this.transform(object.rot, object.scale.vec_scale(new Vector2(1 / camera.distance, 1 / camera.distance)), object.pos.add(camera.offset));
        ctx.strokeStyle = this.colour.toStr();
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(t_points[0].x, t_points[0].y);
        for (let point = 1; point < t_points.length; point++) {
            ctx.lineTo(t_points[point].x, t_points[point].y);
        }
        ctx.closePath();
        ctx.stroke();
    }
    // Checks if a given point is within a polygon
    point_in_polygon(point, camera, object) {
        let t_points = this.transform(object.rot, object.scale.scale(1 / camera.distance), object.pos.add(camera.offset));
        return false;
    }
}
class WorldObj {
    constructor(pos, rot, scale, polygon) {
        this.rot = 0; // Based on unit cicle, 0 = facing right, degrees
        this.scale = new Vector2(1, 1);
        this.polygon = new Polygon([], new RGB(255, 255, 255));
        this.animator = new Animator();
        this.pos = pos;
        this.rot = rot == undefined ? this.rot : rot;
        this.scale = scale == undefined ? this.scale : scale;
        this.polygon = polygon == undefined ? this.polygon : polygon;
    }
    // Rotates to a position (default = lerp)
    look_at(pos, duration, interp) {
        interp = interp == undefined ? lerp : interp;
        let dif = pos.minus(this.pos);
        let desired_rot = Math.atan2(-dif.y, dif.x) * RAD_TO_DEG;
        let rot_dif = desired_rot - this.rot;
        // Prevents snapping (by making desired_rot the shortest path)
        if (rot_dif > 180) {
            this.rot += 360;
        }
        else if (rot_dif < -180) {
            this.rot -= 360;
        }
        this.animator.add_anim(new Anim((value) => { this.rot = value; }, "rotate", this.rot, desired_rot, duration, interp));
    }
    // Moves to a position (default = smoothstep)
    move_to(pos, duration, interp) {
        interp = interp == undefined ? smoothstep : interp;
        this.animator.add_anim(new Anim((value) => { this.pos.x = value; }, "move_x", this.pos.x, pos.x, duration, interp));
        this.animator.add_anim(new Anim((value) => { this.pos.y = value; }, "move_y", this.pos.y, pos.y, duration, interp));
    }
    // Moves by some vector
    move_by(pos, duration, interp) {
        interp = interp == undefined ? smoothstep : interp;
        let target_pos = this.pos.add(pos);
        if (pos.x != 0) {
            this.animator.add_anim(new Anim((value) => { this.pos.x = value; }, "move_x", this.pos.x, target_pos.x, duration, interp));
        }
        if (pos.y != 0) {
            this.animator.add_anim(new Anim((value) => { this.pos.y = value; }, "move_y", this.pos.y, target_pos.y, duration, interp));
        }
    }
    // Always from the perspective of the object facing right
    draw(camera) {
        this.polygon.draw(camera, this);
    }
}
class Camera extends WorldObj {
    get offset() { return new Vector2(canvas_size.x * 0.5, canvas_size.y * 0.5).minus(this.pos); }
    ;
    constructor(pos, distance) {
        super(pos);
        this.move_vector = new Vector2(0, 0);
        this.distance = distance;
    }
    draw(camera) { }
    move(vec) {
        this.move_vector = this.move_vector.add(vec).normalize();
        this.move_by(this.move_vector, 0, lerp);
        mouse_world_pos = mouse_world_pos.add(this.move_vector);
    }
    zoom(mult) {
        this.distance *= mult;
    }
}
class Drone extends WorldObj {
    constructor(max_health, pos, rot, scale) {
        super(pos, rot, scale);
        this.health_bar = new HealthBar(1, this.pos.add(new Vector2(0, 1)), this.scale);
        this.max_health = max_health;
        this.health = max_health;
        this.polygon.points = [
            new Vector2(10, 0),
            new Vector2(-5, 5),
            new Vector2(-5, -5),
        ];
    }
    draw(camera) {
        this.polygon.draw(camera, this);
        this.health_bar.draw(camera, this);
    }
    // Adds change to health
    update_health(change) {
        this.health += change;
        this.health_bar.value = (this.health / this.max_health);
    }
    // Called every frame and tells the drone to do something (attack, move, etc.)
    execute() { }
}
class CaptainDrone extends Drone {
    constructor(max_health, pos, rot) {
        super(max_health, pos, rot, new Vector2(2, 2));
        this.polygon.colour = new RGB(94, 140, 247);
    }
}
class SoldierDrone extends Drone {
    constructor(max_health, pos, rot) {
        super(max_health, pos, rot, new Vector2(2, 2));
        this.polygon.colour = new RGB(94, 140, 247);
    }
}
class EnemyDrone extends Drone {
}
class Resource extends WorldObj {
}
// UI
class UI {
    constructor(pos, size) {
        this.pos = pos;
        this.size = size;
    }
    draw(camera) { }
}
class LinkedUI {
    constructor(offset, size) {
        this.offset = offset;
        this.size = size;
    }
    draw(camera, object) { }
}
// TODO: Draw healthbar
class HealthBar extends LinkedUI {
    constructor(value, pos, size) {
        super(pos, size);
        this.value = value;
    }
    draw(camera, object) {
        if (this.value == 1) {
            return;
        }
    }
    update_pos(object) {
    }
}
// - Constants - //
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const MILLI_TO_SEC = 0.001;
// - Tool Functions - //
function clamp(min, max, x) {
    return Math.max(min, Math.min(x, max));
}
// Interpolation functions (t's range is 0->1)
function lerp(a, b, t) {
    return a + t * (b - a);
}
// From https://en.wikipedia.org/wiki/Smoothstep
function smoothstep(a, b, t) {
    return a + (t * t * (3 - 2 * t)) * (b - a);
}
// - Animation - //
// TODO: Can't have multiple movement animations at once (last added animation is the one that is run) (modifying different values)
// TODO: Can have movement and rotation animations at the same time however (reference issue?)
class Animator {
    constructor() {
        this.active_anims = [];
    }
    add_anim(anim) {
        this.remove_anim(anim.name); // Ensures there are no duplicate animations
        this.active_anims.push(anim);
    }
    remove_anim(name) {
        let anim_index = this.active_anims.findIndex((anim) => anim.name == name);
        if (anim_index != -1) {
            this.active_anims.splice(anim_index, 1);
        }
    }
    // Returns a reference to an animation
    find_anim(name) {
        return this.active_anims.find((anim) => anim.name == name);
    }
    // Steps (forward) all animations and removes them if they are completed
    animate(delta) {
        for (let anim = 0; anim < this.active_anims.length; anim++) {
            this.active_anims[anim].step(delta);
            // if (this.active_anims[anim].step(delta)) {
            //     this.remove_anim(this.active_anims[anim].name);
            // };
        }
    }
}
// Name "Animation" already in use by typescript
// Animates a value (from start to target over a fixed duration)
class Anim {
    constructor(set_value, name, start, target, duration, interp) {
        this.elapsed = 0; // Elapsed time of the animation in seconds
        this.completed = false;
        this.interp = lerp; // Default interp function is lerp
        this.set_value = set_value;
        this.name = name;
        this.start = start;
        this.target = target;
        this.duration = duration <= 0 ? Number.MIN_VALUE : duration;
        this.interp = interp == undefined ? this.interp : interp;
    }
    // Step the animation forward (returns true will completed)
    step(delta) {
        this.elapsed += delta * MILLI_TO_SEC;
        if (this.elapsed >= this.duration) {
            this.elapsed = this.duration;
            this.completed = true;
        }
        this.set_value(this.interp(this.start, this.target, this.elapsed / this.duration));
        return this.completed;
    }
}
// Triggers all objects to animate
function animate(delta) {
    for (let obj = 0; obj < world_objects.length; obj++) {
        world_objects[obj].animator.animate(delta);
    }
}
// - Render Pipeline - //
function draw_background() {
    ctx.fillStyle = "rgb(14, 12, 46)";
    ctx.clearRect(0, 0, canvas_size.x, canvas_size.y);
    ctx.beginPath();
    ctx.fillRect(0, 0, canvas_size.x, canvas_size.y);
}
function render() {
    draw_background();
    for (let obj = 0; obj < world_objects.length; obj++) {
        world_objects[obj].draw(camera);
    }
    for (let obj = 0; obj < ui_objects.length; obj++) {
        ui_objects[obj].draw(camera);
    }
}
// - Input - //
const MOVE_SPEED = 2;
let move_vector = new Vector2(0, 0);
// Allows for multiple keys to be pressed at once
// Derived from (https://medium.com/@dovern42/handling-multiple-key-presses-at-once-in-vanilla-javascript-for-game-controllers-6dcacae931b7)
const KEYBOARD_CONTROLLER = {
    // Camera movement
    "ArrowUp": { pressed: false, func: () => camera.move(new Vector2(0, -1 * MOVE_SPEED)) }, // Up
    "ArrowDown": { pressed: false, func: () => camera.move(new Vector2(0, 1 * MOVE_SPEED)) }, // Down
    "ArrowLeft": { pressed: false, func: () => camera.move(new Vector2(-1 * MOVE_SPEED, 0)) }, // Left
    "ArrowRight": { pressed: false, func: () => camera.move(new Vector2(1 * MOVE_SPEED, 0)) }, // Right
    "w": { pressed: false, func: () => camera.move(new Vector2(0, -1 * MOVE_SPEED)) }, // Up
    "a": { pressed: false, func: () => camera.move(new Vector2(-1 * MOVE_SPEED, 0)) }, // Left
    "s": { pressed: false, func: () => camera.move(new Vector2(0, 1 * MOVE_SPEED)) }, // Down
    "d": { pressed: false, func: () => camera.move(new Vector2(1 * MOVE_SPEED, 0)) }, // Right
};
function activate_inputs() {
    Object.keys(KEYBOARD_CONTROLLER).forEach(key => {
        KEYBOARD_CONTROLLER[key].pressed && KEYBOARD_CONTROLLER[key].func();
    });
}
// - Init - //
let canvas;
let ctx;
let canvas_size = new Vector2(window.innerWidth, window.innerHeight);
let mouse_world_pos = new Vector2(0, 0);
window.onresize = resize_canvas;
function init_canvas() {
    canvas = document.getElementById("canvas");
    ctx = canvas.getContext("2d");
    resize_canvas();
    canvas.addEventListener('mousemove', (event) => {
        mouse_world_pos = mouse_to_world(event);
    });
}
// Acounts for camera position
function mouse_to_world(event) {
    return canvas_size.scale(0.5).minus(new Vector2(event.clientX, event.clientY)).scale(-1).add(camera.pos);
}
function resize_canvas() {
    canvas_size = new Vector2(window.innerWidth, window.innerHeight);
    canvas.width = canvas_size.x;
    canvas.height = canvas_size.y;
}
let camera = new Camera(new Vector2(0, 0), 1);
let world_objects = [];
let ui_objects = [];
let captain = new Drone(100, new Vector2(0, 0), 0, new Vector2(2, 2));
function init_world() {
    world_objects.push(camera);
    world_objects.push(captain);
    world_objects.push(new Drone(100, new Vector2(0, -50), 0, new Vector2(1, 1)));
}
function init_input() {
    // Init keyboard input
    document.addEventListener("keydown", (ev) => {
        // Checks if the key pressed is used to control the camera
        if (KEYBOARD_CONTROLLER[ev.key]) {
            KEYBOARD_CONTROLLER[ev.key].pressed = true;
        }
        console.log(ev.key);
    });
    document.addEventListener("keyup", (ev) => {
        // Checks if the key pressed is used to control the camera
        if (KEYBOARD_CONTROLLER[ev.key]) {
            KEYBOARD_CONTROLLER[ev.key].pressed = false;
        }
    });
}
function ready() {
    init_canvas();
    init_world();
    init_input();
    requestAnimationFrame((timestamp) => process(timestamp, true));
}
let unpaused = false;
let execute = true;
let last_animation_frame = 0;
let delta = 0; // The amount of time since the last animation frame
// TODO: Issue with delta changing when tabbing out (maybe not issue, interp still broken (slowing down at end))
function process(timestamp, unpaused) {
    return __awaiter(this, void 0, void 0, function* () {
        // Unpaused is true if the engine was just unpaused (stopped and then started again)
        delta = unpaused ? 0 : (timestamp - last_animation_frame);
        last_animation_frame = timestamp;
        if (execute) {
            animate(delta);
            render();
            activate_inputs();
            // TODO: LERP SLOWING DOWN AT END OF MOVE_TO/BY
            camera.move_by(move_vector, 0, lerp);
            captain.look_at(mouse_world_pos, 0.04);
            captain.move_to(camera.pos, 0.09);
            requestAnimationFrame((timestamp) => process(timestamp, false));
        }
        else {
            requestAnimationFrame((timestamp) => process(timestamp, true));
        }
    });
}
