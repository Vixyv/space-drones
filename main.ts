// - Classes - //
// Animation classes are under // - Animation - //

// Tool classes
class Vector2 {
    x: number;
    y: number;

    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
    }

    add(vector: Vector2) { return new Vector2(this.x+vector.x, this.y+vector.y) }
    minus(vector: Vector2) { return new Vector2(this.x-vector.x, this.y-vector.y) }
    scale(scalar: number) { return new Vector2(this.x*scalar, this.y*scalar) }
    vec_scale(vector: Vector2) { return new Vector2(this.x*vector.x, this.y*vector.y) }
    // Row major
    matrix_mult(matrix: number[][]) {
        return new Vector2(
            this.x*matrix[0][0] + this.y*matrix[0][1],
            this.x*matrix[1][0] + this.y*matrix[1][1],
        )
    }
    // Used for printing with console.log()
    debug(): number[] { return [this.x, this.y] }
}

class RGB {
    r: number;
    g: number;
    b: number;

    constructor(red: number, green: number, blue: number) {
        this.r = red;
        this.g = green;
        this.b = blue;
    }

    toStr() { return `rgb(${this.r}, ${this.g}, ${this.b})` }
}

// World object classes
class Polygon {
    points: Vector2[];
    colour: RGB;

    constructor(points: Vector2[], colour: RGB) {
        this.points = points;
        this.colour = colour;
    }

    transform(rot: number, scale: Vector2, pos: Vector2): Vector2[] {
        let transformed_points = [];

        rot *= DEG_TO_RAD;
        let rot_matrix = [[Math.cos(rot), Math.sin(rot)], 
                          [-Math.sin(rot), Math.cos(rot)]];

        for (let point=0; point<this.points.length; point++) {
            transformed_points.push(this.points[point].matrix_mult(rot_matrix).vec_scale(scale).add(pos));
        }

        return transformed_points
    }

    draw(camera: Camera, object: WorldObj) {
        let t_points = this.transform(object.rot, object.scale.vec_scale(new Vector2(1/camera.distance, 1/camera.distance)), object.pos.add(camera.offset));

        ctx.strokeStyle = this.colour.toStr();
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(t_points[0].x, t_points[0].y);
        for (let point=1; point<t_points.length; point++) {
            ctx.lineTo(t_points[point].x, t_points[point].y);
        }
        ctx.closePath();
        ctx.stroke();
    }

    // Checks if a given point is within a polygon
    point_in_polygon(point: Vector2, camera: Camera, object: WorldObj): boolean{
        let t_points = this.transform(object.rot, object.scale.scale(1/camera.distance), object.pos.add(camera.offset));

        return false
    }
}

class WorldObj {
    pos: Vector2; // Relative to world origin, -y up, +x right, (x, y)
    rot = 0;      // Based on unit cicle, 0 = facing right, degrees
    scale = new Vector2(1, 1);
    polygon = new Polygon([], new RGB(255, 255, 255));
    animator = new Animator();

    constructor(pos: Vector2, rot?: number, scale?: Vector2, polygon?: Polygon) {
        this.pos = pos;
        this.rot = rot == undefined ? this.rot : rot;
        this.scale = scale == undefined ? this.scale : scale;
        this.polygon = polygon == undefined ? this.polygon : polygon;
    }

    // Rotates to a position (default = lerp)
    look_at(pos: Vector2, duration: number, interp?: InterpFunc) {
        interp = interp == undefined ? lerp : interp;

        let dif = this.pos.minus(pos);

        let desired_rot = Math.atan2(-dif.y, dif.x)*RAD_TO_DEG;
        let rot_dif = desired_rot-this.rot;

        // Prevents snapping (by making desired_rot the shortest path)
        if (rot_dif > 180) { this.rot += 360 }
        else if (rot_dif < -180) { this.rot -= 360 }

        this.animator.add_anim(
            new Anim((value) => { this.rot = value; },
                     "rotate", this.rot, desired_rot, duration, interp))
    }

    // Moves to a position (default = smoothstep)
    move_to(pos: Vector2, duration: number, interp?: InterpFunc) {
        interp = interp == undefined ? smoothstep : interp;

        this.animator.add_anim(
            new Anim((value) => { this.pos.x = value; },
                     "move_x", this.pos.x, pos.x, duration, interp))
        this.animator.add_anim(
            new Anim((value) => { this.pos.y = value; },
                     "move_y", this.pos.y, pos.y, duration, interp))
    }

    // Always from the perspective of the object facing right
    draw(camera: Camera) {
        this.polygon.draw(camera, this);
    } 
}

class Camera extends WorldObj {
    distance: number;
    get offset() { return new Vector2(canvas_size.x*0.5, canvas_size.y*0.5).minus(this.pos) };

    constructor(pos: Vector2, distance: number) {
        super(pos)
        this.distance = distance;
    }

    zoom(mult: number) {
        this.distance *= mult;
    }
}

class Drone extends WorldObj {
    max_health: number;
    health: number;
    health_bar = new HealthBar(1, this.pos.add(new Vector2(0, 1)), this.scale);

    constructor(max_health: number, pos: Vector2, rot?: number, scale?: Vector2) {
        super(pos, rot, scale)
        this.max_health = max_health;
        this.health = max_health;

        this.polygon.points = [
            new Vector2(10, 0),
            new Vector2(-5, 5),
            new Vector2(-5, -5),
        ]
    }

    draw(camera: Camera) {
        this.polygon.draw(camera, this);
        this.health_bar.draw(camera, this);
    }
    
    // Adds change to health
    update_health(change: number) {
        this.health += change;
        this.health_bar.value = (this.health/this.max_health);
    }

    // Called every frame and tells the drone to do something (attack, move, etc.)
    execute() {}
}

class CaptainDrone extends Drone {
    constructor(max_health: number, pos: Vector2, rot?: number) {
        super(max_health, pos, rot, new Vector2(2, 2))
        this.polygon.colour = new RGB(94, 140, 247)
    }
}

class SoldierDrone extends Drone {
    constructor(max_health: number, pos: Vector2, rot?: number) {
        super(max_health, pos, rot, new Vector2(2, 2))
        this.polygon.colour = new RGB(94, 140, 247)
    }
}

class EnemyDrone extends Drone {

}

class Resource extends WorldObj {

}

// UI
class UI {
    pos: Vector2;
    size: Vector2;

    constructor(pos: Vector2, size: Vector2) {
        this.pos = pos;
        this.size = size;
    }

    draw(camera: Camera) {}
}

class LinkedUI {
    offset: Vector2;
    size: Vector2;

    constructor(offset: Vector2, size: Vector2) {
        this.offset = offset;
        this.size = size;
    }

    draw(camera: Camera, object: WorldObj) {}
}

// TODO: Draw healthbar
class HealthBar extends LinkedUI {
    value: number; // Percentage

    constructor(value: number, pos: Vector2, size: Vector2) {
        super(pos, size)
        this.value = value;
    }

    draw(camera: Camera, object: WorldObj) {
        if (this.value == 1) { return }
    }

    update_pos(object: WorldObj) {

    }
}

// - Constants - //

const DEG_TO_RAD = Math.PI/180;
const RAD_TO_DEG = 180/Math.PI;
const MILLI_TO_SEC = 0.001;

// - Tool Functions - //

function clamp(min: number, max: number, x: number): number {
    return Math.max(min, Math.min(x, max))
}

type InterpFunc = { (a: number, b: number, t: number): number }
// Interpolation functions (t's range is 0->1)
function lerp(a: number, b: number, t: number): number {
    return a + t*(b-a)
}

// From https://en.wikipedia.org/wiki/Smoothstep
function smoothstep(a: number, b: number, t: number): number {
    return a + (t*t*(3-2*t))*(b-a)
}


// - Animation - //

class Animator {
    active_anims: Anim[] = [];

    add_anim(anim: Anim) {
        this.remove_anim(anim.name); // Ensures there are no duplicate animations
        this.active_anims.push(anim);
    }

    remove_anim(name: string) {
        let anim_index = this.active_anims.findIndex((anim) => anim.name == name)
        if (anim_index != -1) {
            this.active_anims.splice(anim_index, 1)
        }
    }

    // Returns a reference to an animation
    find_anim(name: string): Anim | undefined {
        return this.active_anims.find((anim) => anim.name == name)
    }

    // Steps (forward) all animations and removes them if they are completed
    animate(delta: number) {
        for (let anim=0; anim<this.active_anims.length; anim++) {
            if (this.active_anims[anim].step(delta)) {
                this.remove_anim(this.active_anims[anim].name);
            };
        }
    }
}

type PointerFunc = { (value: number): void };
// Name "Animation" already in use by typescript
// Animates a value (from start to target over a fixed duration)
class Anim {
    // Because javascript doesn't have pointers, this allows the Anim class to modify a property of another object (aka. animate)
    set_value: PointerFunc;
    name: string;

    start: number;    // Starting value
    target: number;   // Target value

    duration: number; // Duration of the animation in seconds
    elapsed = 0;      // Elapsed time of the animation in seconds
    completed = false;

    interp = lerp;    // Default interp function is lerp

    constructor(set_value: PointerFunc, name: string, start: number, target: number, duration: number, interp?: InterpFunc) {
        this.set_value = set_value;
        this.name = name;

        this.start = start;
        this.target = target;

        this.duration = duration <= 0 ? Number.MIN_VALUE : duration ;
        this.interp = interp == undefined ? this.interp : interp;
    }

    // Step the animation forward (returns true will completed)
    step(delta: number): boolean {
        this.elapsed += delta*MILLI_TO_SEC;

        if (this.elapsed >= this.duration ) { 
            this.elapsed = this.duration;
            this.completed = true;
        }

        this.set_value(this.interp(this.start, this.target, this.elapsed/this.duration))
    
        return this.completed
    }
}

// Triggers all objects to animate
function animate(delta: number) {
    for (let obj=0; obj<world_objects.length; obj++) {
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
    draw_background()

    for (let obj=0; obj<world_objects.length; obj++) {
        world_objects[obj].draw(camera);
    }

    for (let obj=0; obj<ui_objects.length; obj++) {
        ui_objects[obj].draw(camera);
    }
}

// - Input - //

const MOVE_SPEED = 50;

// Allows for multiple keys to be pressed at once
// Derived from (https://medium.com/@dovern42/handling-multiple-key-presses-at-once-in-vanilla-javascript-for-game-controllers-6dcacae931b7)
const KEYBOARD_CONTROLLER: {[key: string]: {pressed: boolean; func: () => void;}} = {
    // Camera movement
    "ArrowUp": {pressed: false, func: () => camera.move_to(camera.pos.add(new Vector2(0, -1*MOVE_SPEED)), 0)},   // Up
    "ArrowDown": {pressed: false, func: () => camera.move_to(camera.pos.add(new Vector2(-1*MOVE_SPEED, 0)), 0)}, // Left
    "ArrowLeft": {pressed: false, func: () => camera.move_to(camera.pos.add(new Vector2(0, 1*MOVE_SPEED)), 0)},  // Down
    "ArrowRight": {pressed: false, func: () => camera.move_to(camera.pos.add(new Vector2(1*MOVE_SPEED, 0)), 0)}, // Right
    "w": {pressed: false, func: () => camera.move_to(camera.pos.add(new Vector2(0, -1*MOVE_SPEED)), 0)}, // Up
    "a": {pressed: false, func: () => camera.move_to(camera.pos.add(new Vector2(-1*MOVE_SPEED, 0)), 0)}, // Left
    "s": {pressed: false, func: () => camera.move_to(camera.pos.add(new Vector2(0, 1*MOVE_SPEED)), 0)},  // Down
    "d": {pressed: false, func: () => camera.move_to(camera.pos.add(new Vector2(1*MOVE_SPEED, 0)), 0)},  // Right
}

function activate_inputs() {
    Object.keys(KEYBOARD_CONTROLLER).forEach(key => {
        KEYBOARD_CONTROLLER[key].pressed && KEYBOARD_CONTROLLER[key].func();
    })
}

// - Init - //

let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let canvas_size = new Vector2(window.innerWidth, window.innerHeight);
window.onresize = resize_canvas;

function init_canvas() {
    canvas = <HTMLCanvasElement>document.getElementById("canvas");
    ctx = <CanvasRenderingContext2D>canvas.getContext("2d");

    resize_canvas()

    canvas.addEventListener('mousemove', (event) => {
        let mouse_pos = new Vector2(event.clientX, event.clientY)
        captain.look_at(canvas_size.scale(0.5).minus(mouse_pos), 0.05);
    });
}

function resize_canvas() {
    canvas_size = new Vector2(window.innerWidth, window.innerHeight);
    canvas.width = canvas_size.x;
    canvas.height = canvas_size.y;
}

let camera = new Camera(new Vector2(0, 0), 1);
let world_objects: WorldObj[] = [];
let ui_objects: UI[] = [];

let captain = new Drone(100, new Vector2(0, 0), 0, new Vector2(2, 2))

function init_world() {
    world_objects.push(captain)
    world_objects.push(new Drone(100, new Vector2(0, -50), 0, new Vector2(1, 1)))
}

function init_input() {
// Init keyboard input
    document.addEventListener("keydown", (ev) => {
        // Checks if the key pressed is used to control the camera
        if (KEYBOARD_CONTROLLER[ev.key]) {
            KEYBOARD_CONTROLLER[ev.key].pressed = true;
        }
        console.log(camera.pos.debug())
    });

    document.addEventListener("keyup", (ev) => {
        // Checks if the key pressed is used to control the camera
        if (KEYBOARD_CONTROLLER[ev.key]) {
            KEYBOARD_CONTROLLER[ev.key].pressed = false;
        }
    });
}


function ready() {
    init_canvas()
    init_world()
    init_input()

    requestAnimationFrame((timestamp: DOMHighResTimeStamp) => process(timestamp, true));
}

let unpaused = false;
let execute = true;

let last_animation_frame = 0;
let delta = 0; // The amount of time since the last animation frame

async function process(timestamp: DOMHighResTimeStamp, unpaused: boolean) {
    // Unpaused is true if the engine was just unpaused (stopped and then started again)
    delta = unpaused ? 0 : (timestamp - last_animation_frame);
    last_animation_frame = timestamp;

    if (execute) {
        animate(delta)
        render()
        activate_inputs()

        // TODO: LERP SLOWING DOWN AT END OF MOVE_TO
        // TODO: CAN'T MOVE CAMERA

        captain.move_to(new Vector2(300, 0), 0.4, lerp)
        camera.move_to(new Vector2(10, 0), 1)
        console.log(captain.pos.debug())

        requestAnimationFrame((timestamp: DOMHighResTimeStamp) => process(timestamp, false));
    } else {
        requestAnimationFrame((timestamp: DOMHighResTimeStamp) => process(timestamp, true));
    }
}
