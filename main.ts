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
    magnitude() { return Math.sqrt(this.x**2 + this.y**2) }
    normalize() {
        let magnitude = this.magnitude();
        if (magnitude == 0) { return new Vector2(0, 0) }
        else { return new Vector2(this.x/magnitude, this.y/magnitude) }
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
// TODO: Add draw "fill" option (for bullets)
class Polygon {
    object: WorldObj;
    points: Vector2[];
    t_points: Vector2[] = []; // Array of transformed points
    colour: RGB;

    constructor(object: WorldObj, points: Vector2[], colour: RGB) {
        this.object = object;
        this.points = points;
        this.colour = colour;
    }

    transform(point: Vector2): Vector2 {
        let rot = this.object.rot*DEG_TO_RAD;
        let rot_matrix = [[Math.cos(rot), Math.sin(rot)], 
                          [-Math.sin(rot), Math.cos(rot)]];

        return point.matrix_mult(rot_matrix).vec_scale(this.object.scale).add(this.object.pos).add(camera.offset);
    }

    transform_points() {
        this.t_points = [];

        for (let p=0; p<this.points.length; p++) {
            this.t_points.push(this.transform(this.points[p]));
        }
    }

    draw(fill?: boolean) {
        this.transform_points(); // Updates t_points

        ctx.fillStyle = this.colour.toStr();
        ctx.strokeStyle = this.colour.toStr();
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(this.t_points[0].x, this.t_points[0].y);
        for (let point=1; point<this.t_points.length; point++) {
            ctx.lineTo(this.t_points[point].x, this.t_points[point].y);
        }
        ctx.closePath();
        ctx.stroke();
        
        if (fill == true) { ctx.fill(); }
    }

    // Returns [x_max, x_min, y_max, y_min]
    bounding_box(): number[] {
        let [x_max, x_min, y_max, y_min] = [0, 0, 0, 0];
        for (let p=0; p<this.t_points.length; p++) {
            if (this.t_points[p].x > x_max) { x_max = this.t_points[p].x }
            else if (this.t_points[p].x < x_min) { x_min = this.t_points[p].x }
            if (this.t_points[p].y > y_max) { y_max = this.t_points[p].y }
            else if (this.t_points[p].y < y_min) { y_min = this.t_points[p].y }
        }

        return [x_max, x_min, y_max, y_min];
    }

    // Checks if a given point is within a polygon (assumes point is transformed correctly)
    // Developed from https://stackoverflow.com/questions/217578/how-can-i-determine-whether-a-2d-point-is-within-a-polygon
    point_in_polygon(point: Vector2): boolean {
        let [x_max, x_min, y_max, y_min] = this.bounding_box();

        // Checks if the point is outside the bounding box
        if (point.x > x_max || point.x < x_min || point.y > y_max || point.y < y_min) {
            return false
        }

        // This is a point we know to be outside of the polygon and will be the end of the vector from `point`
        let outside_point = new Vector2(x_min-1, point.y);

        let intersections = 0;
        for (let s=0; s<this.t_points.length; s++) {
            if (vectors_intersect(point, outside_point, this.t_points[s], this.t_points[(s+1)%(this.t_points.length)])) {
                intersections++;
            }
        }

        if (intersections % 2 == 1) { return true }
        else { return false }
    }

    vector_in_polygon(vec_i: Vector2, vec_f: Vector2) {
        // Compares the vector to all sides of the polygon
        for (let s=0; s<this.t_points.length; s++) {
            if (vectors_intersect(vec_i, vec_f, this.t_points[s], this.t_points[(s+1)%(this.t_points.length)])) {
                return true
            }
        }

        // The vector could be completely inside the polygon so we test on point
        // However, we only need to test one point (and don't recalculate bounds)
        if (this.point_in_polygon(vec_i)) { return true }
        else { return false }
    }
}

class WorldObj {
    pos: Vector2; // Relative to world origin, -y up, +x right, (x, y)
    rot = 0;      // Based on unit cicle, 0 = facing right, degrees
    scale = new Vector2(1, 1);
    polygon = new Polygon(this, [], new RGB(255, 255, 255));
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

        let dif = pos.minus(this.pos);

        let desired_rot = Math.atan2(-dif.y, dif.x)*RAD_TO_DEG;
        let rot_dif = desired_rot-this.rot;

        // Prevents snapping (by making desired_rot the shortest path)
        if (rot_dif > 180) { this.rot += 360 }
        else if (rot_dif < -180) { this.rot -= 360 }

        this.animator.add_anim(
            new Anim((value) => { this.rot = value; },
                     "look_at", this.rot, desired_rot, duration, interp))
    }

    rotate_by(rotation: number, duration: number, interp?: InterpFunc) {
        this.animator.add_anim(
            new Anim((value) => { this.rot = value; },
                     "rotate_by", this.rot, this.rot+rotation, duration, interp))
    }

    // Moves to a position (default = smoothstep)
    move_to(pos: Vector2, duration: number, interp?: InterpFunc) {
        interp = interp == undefined ? smoothstep : interp;

        this.animator.add_anim(
            new Anim((value) => { this.pos.y = value; },
                     "move_to_y", this.pos.y, pos.y, duration, interp))
        this.animator.add_anim(
            new Anim((value) => { this.pos.x = value; },
                     "move_to_x", this.pos.x, pos.x, duration, interp))
    }

    // Moves by some vector
    move_by(pos: Vector2, duration: number, interp?: InterpFunc) {
        interp = interp == undefined ? smoothstep : interp;

        let target_pos = this.pos.add(pos);

        if (pos.y != 0) {
            this.animator.add_anim(
                new Anim((value) => { this.pos.y = value; },
                        "move_by_y", this.pos.y, target_pos.y, duration, interp))
        }

        if (pos.x != 0) {
            this.animator.add_anim(
                new Anim((value) => { this.pos.x = value; },
                        "move_by_x", this.pos.x, target_pos.x, duration, interp))
        }
    }

    colliding_with(object: WorldObj): boolean {
        // Checks if a side (vector) of `object` is in this object
        for (let s=0; s<object.polygon.t_points.length; s++) {
            if (this.polygon.vector_in_polygon(object.polygon.t_points[s], object.polygon.t_points[(s+1)%(object.polygon.t_points.length)])) {
                return true
            }
        }

        return false
    }

    // Always from the perspective of the object facing right
    draw() {} 

    // Called every frame and tells the drone to do something (attack, move, etc.)
    update() {
        this.draw();
        this.animator.animate();
    }
}

class Camera extends WorldObj {
    distance: number;
    move_vector = new Vector2(0, 0);
    get offset() { return new Vector2(canvas_size.x*0.5, canvas_size.y*0.5).minus(this.pos) };

    constructor(pos: Vector2, distance: number) {
        super(pos)
        this.distance = distance;
    }

    move() {
        this.move_vector = this.move_vector.normalize().scale(MOVE_SPEED);

        this.pos = this.pos.add(this.move_vector.scale(1/this.distance))
        mouse_world_pos = mouse_world_pos.add(this.move_vector);

        this.move_vector = new Vector2(0, 0)
    }

    // TODO: Zoom not really working how I want it too
    zoom(mult: number) {
        // this.animator.add_anim(
        //     new Anim((value) => { this.distance = value; },
        //         "zoom", this.distance, this.distance*mult, 0, lerp))
    }

    update() {
        this.move()
        this.animator.animate();
    }
}

class Drone extends WorldObj {
    max_health: number;
    health: number;
    health_bar = new HealthBar(this, 1, new Vector2(0, 10),new Vector2(20, 8));
    // TODO: HEALTH BAR POSITIONING IS WRONG
    
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

    draw() {
        this.polygon.draw();
        this.health_bar.draw();
    }
    
    // Adds change to health
    update_health(change: number) {
        this.health += change;
        this.health_bar.value = (this.health/this.max_health);
    }
}

class CaptainDrone extends Drone {
    drone_cluster: DroneCluster;

    constructor(max_health: number, pos: Vector2, rot?: number) {
        super(max_health, pos, rot, new Vector2(2, 2))
        this.polygon.colour = new RGB(161, 189, 255)

        this.drone_cluster = new DroneCluster(this.pos, 50);
    }

    update() {
        super.update();

        this.look_at(mouse_world_pos, DRONE_LOOK_SPEED);

        if (this.pos != camera.pos) {
            this.move_to(camera.pos, DRONE_MOVE_SPEED);
        }

        if (this.drone_cluster.pos != this.pos) {
            this.drone_cluster.move_to(this.pos, 0);
        }
        this.drone_cluster.update();
    }
}

class SoldierDrone extends Drone {
    constructor(max_health: number, pos: Vector2, rot?: number) {
        super(max_health, pos, rot, new Vector2(1, 1))
        this.polygon.colour = new RGB(232, 239, 255)
    }
}

class EnemyDrone extends Drone {
    constructor(max_health: number, pos: Vector2, rot?: number) {
        super(max_health, pos, rot, new Vector2(2, 2))
        this.polygon.colour = new RGB(255, 168, 150)
    }
}

enum DroneStates {
    Follow,
    Attack,
}

class DroneCluster extends WorldObj {
    drone_state = DroneStates.Follow;
    // The order of the drones in this array cannot dramtically change or else it will lead to weird behaviour
    drones: Drone[] = [];

    radius: number;

    constructor(pos: Vector2, radius: number) {
        super(pos)
        this.radius = radius;
    }

    update_drones() {
        for (let d=0; d<this.drones.length; d++) {
            this.drones[d].update();
        }
    }

    follow() {
        // Evenly spaces the drones in a ring around the center of the cluster
        // (While looking at the center)
        for (let d=0; d<this.drones.length; d++) {
            let theta = ((d*2*Math.PI)/this.drones.length) + this.rot*DEG_TO_RAD;

            this.drones[d].move_to(
                new Vector2(
                    this.radius*Math.cos(theta), 
                    this.radius*Math.sin(theta)
                ).add(this.pos), 
                DRONE_MOVE_SPEED);
            this.drones[d].look_at(this.pos, DRONE_LOOK_SPEED);
        }
    }

    attack() {

    }

    update() {
        this.update_drones()

        switch(this.drone_state) {
            case DroneStates.Follow:
                this.follow();
            case DroneStates.Attack:
                this.attack();
        }

        // Figure out how to make this work with animation
        this.rot = (this.rot+delta*0.025)%360;
        // console.log(this.rot)
    }
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

    update() {
        this.draw();
    }

    draw() {}
}

class LinkedUI {
    object: WorldObj;
    offset: Vector2;
    size: Vector2;

    constructor(object: WorldObj, offset: Vector2, size: Vector2) {
        this.object = object;
        this.offset = offset;
        this.size = size;
    }

    draw() {}
}

// TODO: Draw healthbar
class HealthBar extends LinkedUI {
    value: number; // Percentage
    bg_colour = new RGB(191, 191, 191);
    bar_colour = new RGB(77, 255, 79);

    constructor(object: WorldObj, value: number, offset: Vector2, size: Vector2) {
        super(object, offset, size)
        this.value = value;
    }

    draw() {
        let corner = new Vector2(
            -this.offset.x+this.object.pos.x+this.size.x*0.5,
            -this.offset.y+this.object.pos.y+this.size.y*0.5,
        )

        corner = this.object.polygon.transform(corner);

        // if (this.value == 1) { return }
        ctx.beginPath(); // Start a new path
        ctx.fillStyle = this.bg_colour.toStr()
        ctx.rect(corner.x, corner.y, this.size.x, this.size.y); // Add a rectangle to the current path
        ctx.fill(); // Render the path

        ctx.beginPath(); // Start a new path
        ctx.fillStyle = this.bar_colour.toStr()
        ctx.rect(corner.x, corner.y, this.size.x*(this.value/1), this.size.y); // Add a rectangle to the current path
        ctx.fill(); // Render the path
    }
}

// - Constants - //

const DEG_TO_RAD = Math.PI/180;
const RAD_TO_DEG = 180/Math.PI;
const MILLI_TO_SEC = 0.001;

const DRONE_MOVE_SPEED = 0.09;
const DRONE_LOOK_SPEED = 0.04;

// - Tool Functions - //

function rand_int(min: number, max: number): number {
    return Math.floor(Math.random()*(max-min+1) + min)
}

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

// Determines if two vectors intersect
// Again, from https://stackoverflow.com/questions/217578/how-can-i-determine-whether-a-2d-point-is-within-a-polygon
function vectors_intersect(v1_i: Vector2, v1_f: Vector2, v2_i: Vector2, v2_f: Vector2): boolean {
    // `Ax + By + C = 0` (standard linear equation) form of vector 1
    let a1 = v1_f.y - v1_i.y;
    let b1 = v1_i.x - v1_f.x;
    let c1 = (v1_f.x*v1_i.y) - (v1_i.x*v1_f.y);

    // Calculates which side of the line each vector 2 point is on (if they are on the same side, they have the same sign)
    let d1 = (a1*v2_i.x) + (b1*v2_i.y) + c1;
    let d2 = (a1*v2_f.x) + (b1*v2_f.y) + c1;

    // If they both have the same sign, an intersection is not possible
    if (d1 > 0 && d2 > 0) { return false };
    if (d1 < 0 && d2 < 0) { return false };

    // Also have to check if vector 1 intersects vector 2 (not just that vector 2 intersects vector 1)
    // `Ax + By + C = 0` (standard linear equation) form of vector 2
    let a2 = v2_f.y - v2_i.y;
    let b2 = v2_i.x - v2_f.x;
    let c2 = (v2_f.x*v2_i.y) - (v2_i.x*v2_f.y);

    // Same as before expect with vector 1
    d1 = (a2*v1_i.x) + (b2*v1_i.y) + c2;
    d2 = (a2*v1_f.x) + (b2*v1_f.y) + c2;

    if (d1 > 0 && d2 > 0) { return false };
    if (d1 < 0 && d2 < 0) { return false };

    // Checks if the lines are collinear
    if ((a1*b2) - (a2*b1) == 0) { return false };

    return true
}

// - Animation - //

// TODO: Can't have multiple movement animations at once (last added animation is the one that is run) (modifying different values)
// TODO: Can have movement and rotation animations at the same time however (reference issue?)
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
    animate() {
        for (let anim=0; anim<this.active_anims.length; anim++) {
            // this.active_anims[anim].step()
            // TODO: FIGURE OUT WHAT YOU'RE DOING WITH THIS
            // TODO: Make it so that this works
            if (this.active_anims[anim].step()) {
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

        this.duration = duration <= 0 ? Number.MIN_VALUE : duration;
        this.interp = interp == undefined ? this.interp : interp;
    }

    // Step the animation forward (returns true will completed)
    step(): boolean {
        this.elapsed += delta*MILLI_TO_SEC;

        if (this.elapsed >= this.duration ) { 
            this.elapsed = this.duration;
            this.completed = true;
        }

        this.set_value(this.interp(this.start, this.target, this.elapsed/this.duration))

        return this.completed
    }
}

// - Game Manager - //

function draw_background() {
    ctx.fillStyle = "rgb(4, 1, 51)";

    ctx.clearRect(0, 0, canvas_size.x, canvas_size.y);
    ctx.beginPath();
    ctx.fillRect(0, 0, canvas_size.x, canvas_size.y);
}

function update_game() {
    draw_background()

    // The objects manage updating themselves on their own
    // The game just tells them when to do that
    for (let obj=0; obj<world_objects.length; obj++) {
        world_objects[obj].update();
    }

    // UI is called second so that it is drawn on top of the world objects
    for (let obj=0; obj<ui_objects.length; obj++) {
        ui_objects[obj].update();
    }
}

// - Input - //

const MOVE_SPEED = 2;
let move_vector = new Vector2(0, 0);

const ZOOM_FACTOR = 0.05;

// Allows for multiple keys to be pressed at once
// Derived from https://medium.com/@dovern42/handling-multiple-key-presses-at-once-in-vanilla-javascript-for-game-controllers-6dcacae931b7
const KEYBOARD_CONTROLLER: {[key: string]: {pressed: boolean; func: () => void;}} = {
    // Camera movement
    "ArrowUp": {pressed: false, func: () => camera.move_vector.y += -1},   // Up
    "ArrowDown": {pressed: false, func: () => camera.move_vector.y += 1},  // Down
    "ArrowLeft": {pressed: false, func: () => camera.move_vector.x += -1}, // Left
    "ArrowRight": {pressed: false, func: () => camera.move_vector.x += 1}, // Right
    "w": {pressed: false, func: () => camera.move_vector.y += -1}, // Up
    "a": {pressed: false, func: () => camera.move_vector.x += -1}, // Left
    "s": {pressed: false, func: () => camera.move_vector.y += 1},  // Down
    "d": {pressed: false, func: () => camera.move_vector.x += 1},  // Right
    // Camera zoom
    "=": {pressed: false, func: () => camera.zoom(1-ZOOM_FACTOR)},  // Zoom in
    "-": {pressed: false, func: () => camera.zoom(1+ZOOM_FACTOR)},  // Zoom out

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
let mouse_world_pos = new Vector2(0, 0);
window.onresize = resize_canvas;


// TODO: Use ctx.setTransform() to adjust how things are drawn, not screen width and stuff etc.
function init_canvas() {
    canvas = <HTMLCanvasElement>document.getElementById("canvas");
    ctx = <CanvasRenderingContext2D>canvas.getContext("2d");

    resize_canvas()

    canvas.addEventListener('mousemove', (event) => {
        mouse_world_pos = mouse_to_world(event);
    });
}

// Acounts for camera position
function mouse_to_world(event: MouseEvent): Vector2 {
    return canvas_size.scale(0.5).minus(new Vector2(event.clientX, event.clientY)).scale(-1).add(camera.pos);
}

function resize_canvas() {
    canvas_size = new Vector2(window.innerWidth, window.innerHeight);
    canvas.width = canvas_size.x;
    canvas.height = canvas_size.y;
}

let camera = new Camera(new Vector2(0, 0), 1);
let world_objects: WorldObj[] = [camera];
let ui_objects: UI[] = [];

let captain = new CaptainDrone(100, new Vector2(0, 0), 0);
let enemy = new EnemyDrone(100, new Vector2(-50, 0), 0);

function init_world() {
    for (let d=0; d<10; d++) {
        captain.drone_cluster.drones.push(new SoldierDrone(100, new Vector2(0, 0), 0));
    }

    world_objects.push(captain)
    world_objects.push(enemy)
}

function init_input() {
// Init keyboard input
    document.addEventListener("keydown", (ev) => {
        // Checks if the key pressed is used to control the camera
        if (KEYBOARD_CONTROLLER[ev.key]) {
            KEYBOARD_CONTROLLER[ev.key].pressed = true;
        }
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
let execute = true; // TODO: MAY REMOVE LATER


let last_animation_frame = 0;
let delta = 0; // The amount of time since the last animation frame

// Make the game pause when tabbing out
async function process(timestamp: DOMHighResTimeStamp, unpaused: boolean) {
    // Unpaused is true if the engine was just unpaused (stopped and then started again)
    delta = unpaused ? 0 : (timestamp - last_animation_frame);
    last_animation_frame = timestamp;

    if (execute && document.hasFocus()) {
        update_game()
        activate_inputs()

        requestAnimationFrame((timestamp: DOMHighResTimeStamp) => process(timestamp, false));
    } else {
        requestAnimationFrame((timestamp: DOMHighResTimeStamp) => process(timestamp, true));
    }
}
