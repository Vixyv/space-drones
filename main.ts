// - Classes - //

class Vector2 {
    x: number;
    y: number;

    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
    }
}

class WorldObj {
    pos: Vector2;
    rot: Vector2;
    scale: Vector2;

    constructor(pos: Vector2, rot?: Vector2, scale?: Vector2) {
        this.pos = pos;
        this.rot = rot == undefined ? new Vector2(0, 0) : rot;
        this.scale = scale == undefined ? new Vector2(1, 1) : scale;
    }

    display() {}
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