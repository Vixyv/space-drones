"use strict";
// - Classes - //
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
class Vector2 {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
    add(vector) { return new Vector2(this.x + vector.x, this.y + vector.y); }
    scale(vector) { return new Vector2(this.x * vector.x, this.y * vector.y); }
    // Row major
    matrix_mult(matrix) {
        return new Vector2(this.x * matrix[0][0] + this.y * matrix[0][1], this.x * matrix[1][1] + this.y * matrix[1][1]);
    }
}
class RGB {
    constructor(red, green, blue) {
        this.r = red;
        this.g = green;
        this.b = blue;
    }
    toStr() { return `rgb(${this.r}, ${this.g}, ${this.b})`; }
}
class Camera {
    constructor(pos, distance) {
        this.pos = pos;
        this.distance = distance;
    }
    zoom(mult) {
        this.distance *= mult;
    }
}
class Polygon {
    constructor(points) {
        this.points = points;
    }
    transform(rot, scale, translation) {
        let transformed_points = [];
        for (let point = 0; point < this.points.length; point++) {
        }
    }
}
// World Objects
class WorldObj {
    constructor(pos, rot, scale, collision) {
        this.rot = 0; // Based on unit cicle, 0 = facing right 
        this.scale = new Vector2(1, 1);
        this.collision = this.scale; // Bounds around pos (+ and -), collision box
        this.pos = pos;
        this.rot = rot == undefined ? this.rot : rot;
        this.scale = scale == undefined ? this.scale : scale;
        this.collision = collision == undefined ? this.collision : collision;
    }
    // Uses canvas drawing options, manages drawing itself
    // Always from the perspective of the object facing right
    draw(scale) { }
}
class Drone extends WorldObj {
    constructor(max_health, pos, rot, scale, collision) {
        super(pos, rot, scale);
        this.colour = new RGB(255, 255, 255);
        this.health_bar = new HealthBar(1, this.pos.add(new Vector2(0, 1)), this.scale);
        this.max_health = max_health;
        this.health = max_health;
    }
    draw(scale) {
        ctx.fillStyle = this.colour.toStr();
        let rot_matrix = [[Math.cos(this.rot), Math.sin(this.rot)],
            [-Math.sin(this.rot), Math.cos(this.rot)]];
        // TODO: Could create polygon class to store points and apply transformations
        let point_1 = new Vector2(10, 0).matrix_mult(rot_matrix);
        let point_2 = new Vector2(-5, 5).matrix_mult(rot_matrix);
        let point_3 = new Vector2(5, 5).matrix_mult(rot_matrix);
        ctx.beginPath();
        ctx.moveTo(point_1.x, point_1.y);
        ctx.lineTo(point_2.x, point_2.y);
        ctx.lineTo(point_3.x, point_3.y);
        ctx.fill();
    }
    // Add changes to health
    update_health(change) {
        this.health += change;
        this.health_bar.value = (this.health / this.max_health);
    }
}
class CaptainDrone extends Drone {
}
class SoldierDrone extends Drone {
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
    draw(scale) { }
}
class HealthBar extends UI {
    constructor(value, pos, size) {
        super(pos, size);
        this.value = value;
    }
    draw(scale) {
        if (this.value == 1) {
            return;
        }
    }
}
// - Tool Functions - //
function clamp(min, max, x) {
    return Math.max(min, Math.min(x, max));
}
// From https://en.wikipedia.org/wiki/Smoothstep
function smoothstep(edge_0, edge_1, x) {
    x = clamp(0, 1, (x - edge_0) / (edge_1 - edge_0));
    return x * x * (3 - 2 * x);
}
// - Render Pipeline - //
function draw_background() {
    ctx.fillStyle = "rgb(14, 12, 46)";
    ctx.beginPath();
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
}
function render() {
    draw_background();
    for (let obj = 0; obj < world_objects.length; obj++) {
        world_objects[obj].draw(camera.distance);
    }
    for (let obj = 0; obj < ui_objects.length; obj++) {
        ui_objects[obj].draw(camera.distance);
    }
}
// - Init - //
let canvas;
let ctx;
window.onresize = resize_canvas;
function init_canvas() {
    canvas = document.getElementById("canvas");
    ctx = canvas.getContext("2d");
    resize_canvas();
}
function resize_canvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
let camera = new Camera(new Vector2(0, 0), 1);
let world_objects = [];
let ui_objects = [];
function init_world() {
}
function init_input() {
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
let delta = 0; // Represents the amount of time since the last animation frame
function process(timestamp, unpaused) {
    return __awaiter(this, void 0, void 0, function* () {
        // Unpaused is true if the engine was just unpaused (stoped and then started again)
        delta = unpaused ? 0 : (timestamp - last_animation_frame) * 0.1;
        last_animation_frame = timestamp;
        if (execute) {
            render();
            requestAnimationFrame((timestamp) => process(timestamp, false));
        }
        else {
            requestAnimationFrame((timestamp) => process(timestamp, true));
        }
    });
}
