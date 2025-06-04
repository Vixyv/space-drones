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
    minus(vector) { return new Vector2(this.x - vector.x, this.y - vector.y); }
    scale(vector) { return new Vector2(this.x * vector.x, this.y * vector.y); }
    // Row major
    matrix_mult(matrix) {
        return new Vector2(this.x * matrix[0][0] + this.y * matrix[0][1], this.x * matrix[1][0] + this.y * matrix[1][1]);
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
    get offset() { return new Vector2(window.innerWidth * 0.5, window.innerHeight * 0.5).minus(this.pos); }
    ;
    constructor(pos, distance) {
        this.pos = pos;
        this.distance = distance;
    }
    zoom(mult) {
        this.distance *= mult;
    }
}
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
            transformed_points.push(this.points[point].matrix_mult(rot_matrix).scale(scale).add(pos));
        }
        return transformed_points;
    }
    draw(camera, object) {
        let t_points = this.transform(object.rot, object.scale.scale(new Vector2(1 / camera.distance, 1 / camera.distance)), object.pos.add(camera.offset));
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
        let t_points = this.transform(object.rot, object.scale.scale(new Vector2(1 / camera.distance, 1 / camera.distance)), object.pos.add(camera.offset));
        return false;
    }
}
// World Objects
class WorldObj {
    constructor(pos, rot, scale, polygon) {
        this.rot = 0; // Based on unit cicle, 0 = facing right
        this.scale = new Vector2(1, 1);
        this.polygon = new Polygon([], new RGB(255, 255, 255));
        this.pos = pos;
        this.rot = rot == undefined ? this.rot : rot;
        this.scale = scale == undefined ? this.scale : scale;
        this.polygon = polygon == undefined ? this.polygon : polygon;
    }
    // Uses canvas drawing options, manages drawing itself
    // Always from the perspective of the object facing right
    draw(camera) { }
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
    // Rotates to a position
    look_at(pos) { }
    // Smoothly moves to a position
    move_to(pos) { }
    // Called every frame and tells the drone to do something (attack, move, etc.)
    do() { }
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
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.beginPath();
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
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
    world_objects.push(new Drone(100, new Vector2(0, 0), 0, new Vector2(2, 2)));
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
let val = 0;
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
