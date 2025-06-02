"use strict";
// - Classes - //
class Vector2 {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
}
class WorldObj {
    constructor(pos, rot, scale) {
        this.pos = pos;
        this.rot = rot == undefined ? new Vector2(0, 0) : rot;
        this.scale = scale == undefined ? new Vector2(1, 1) : scale;
    }
    display() { }
}
class Drone {
}
class Resource {
}
// - Tool Functions - //
// - Render Pipeline - //
function render() {
}
// - Init - //
function init_canvas() {
}
function init_world() {
}
function ready() {
}
