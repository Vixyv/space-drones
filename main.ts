// Program Structure
  // - Classes - //
  // - Constants - //
  // - Tool Functions - //
  // - Animation - //
  // - Game Manager - //
  // - Init - //
  // - Debug - //

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
    distance(vector: Vector2) { return Math.sqrt((this.x+vector.x)**2 + (this.y+vector.y)**2) }
    magnitude() { return Math.sqrt(this.x**2 + this.y**2) }
    normalize() {
        let magnitude = this.magnitude();
        if (magnitude == 0) { return new Vector2(0, 0) }
        else { return new Vector2(this.x/magnitude, this.y/magnitude) }
    }
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
        ctx.lineWidth = 2.5;

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

// Used to determine how objects interact and collide with other objects
enum ObjectTeams {
    None,
    Friend,
    Enemy,
    Resource,
}

class WorldObj {
    pos = new Vector2(0, 0); // Relative to world origin, -y up, +x right, (x, y)
    rot = 0;                 // Based on unit cicle, 0 = facing right, degrees
    get forward() { return new Vector2(Math.cos(this.rot*DEG_TO_RAD), -Math.sin(this.rot*DEG_TO_RAD)) }; // Vector for the direction the object is facing
    scale = new Vector2(1, 1);
    polygon = new Polygon(this, [], new RGB(255, 255, 255));
    animator = new Animator();
    team = ObjectTeams.None;

    constructor(pos?: Vector2, rot?: number, scale?: Vector2, polygon?: Polygon, team?: ObjectTeams) {
        this.pos = pos == undefined ? this.pos : pos;
        this.rot = rot == undefined ? this.rot : rot;
        this.scale = scale == undefined ? this.scale : scale;
        this.polygon = polygon == undefined ? this.polygon : polygon;
        this.team = team == undefined ? this.team : team;

        world_objects.push(this);
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

    // TODO: I don't think this works (but I don't know if I need it)
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

    // Not used on all objects, but is here for simplicity
    update_health(change: number) {}

    // Always from the perspective of the object facing right
    draw() {} 

    // Called every frame and tells the drone to do something (attack, move, etc.)
    update() {
        this.draw();
        this.animator.animate();
    }

    remove() {
        let i = world_objects.indexOf(this);
        world_objects.splice(i, 1);
    }   
}

class Camera extends WorldObj {
    move_vector = new Vector2(0, 0);
    get offset() { return new Vector2(canvas_size.x*0.5, canvas_size.y*0.5).minus(this.pos) };

    constructor(pos: Vector2) {
        super(pos)
    }

    move() {
        this.move_vector = this.move_vector.normalize().scale(MOVE_SPEED);

        this.pos = this.pos.add(this.move_vector)
        mouse_world_pos = mouse_world_pos.add(this.move_vector);

        this.move_vector = new Vector2(0, 0)
    }

    update() {
        this.move()
        this.animator.animate();
    }
}

class Drone extends WorldObj {
    max_health: number;
    health: number;
    health_bar = new HealthBar(this, 1, new Vector2(0, -20),new Vector2(30, 5));

    // Shoot settings
    damage = 10;
    range = 2000;
    speed = 500;

    reload_time = 0.2;  // In seconds
    reload_current = 0; // In seconds

    // Parent drone cluster - exists on all drones to make it simpler to add drones to clusters
    // Drones need to be able to reference its parent cluster and with this property
    // The cluster can assign itself as the parent cluster to the drone automatically
    p_drone_cluster: DroneCluster | undefined; 
    
    constructor(max_health: number, pos: Vector2, rot?: number, scale?: Vector2) {
        super(pos, rot, scale)
        this.polygon.points = [
            new Vector2(10, 0),
            new Vector2(-5, 5),
            new Vector2(-5, -5)
        ]

        this.max_health = max_health;
        this.health = max_health;
    }

    draw() {
        this.polygon.draw();
        this.health_bar.draw();
    }
    
    update_health(change: number) {
        this.health += change;
        if (this.health <= 0) { this.remove(); }

        this.health_bar.value = (this.health/this.max_health);
    }

    // Speed is in pixels per second, range how far the bullet can travel in pixels
    shoot(target: ObjectTeams) {
        if (this.reload_current <= 0) {
            let duration = this.range/this.speed;
            // This needs structuredClone() for some reason (I don't know why)
            let bullet = new Bullet(structuredClone(this.pos), this.rot, this.team, target, this.damage, duration);

            bullet.move_to(this.forward.scale(this.range).add(this.pos), duration, lerp);
            this.reload_current = this.reload_time;
        }
    }

    update() {
        super.update();

        if (this.reload_current > 0) {
            this.reload_current -= delta*MILLI_TO_SEC;
        }
    }

    remove() {
        super.remove();

        this.health_bar.remove();

        if (this.p_drone_cluster != undefined) {
            let i = this.p_drone_cluster.drones.indexOf(this);
            this.p_drone_cluster.drones.splice(i, 1);
        }
    }   

    // AI for different DroneStates
    follow() {}
    attack() {}
}

class CaptainDrone extends Drone {
    c_drone_cluster: DroneCluster; // Child drone cluster

    constructor(max_health: number, pos: Vector2, rot?: number) {
        super(max_health, pos, rot, new Vector2(3, 3))
        this.polygon.colour = new RGB(161, 189, 255);
        this.team = ObjectTeams.Friend;

        // TODO: Make the radius not hardcoded
        this.c_drone_cluster = new DroneCluster(this.pos, 75);
    }

    update() {
        super.update();

        this.look_at(mouse_world_pos, DRONE_LOOK_SPEED);

        if (this.pos != camera.pos) {
            this.move_to(camera.pos, DRONE_MOVE_SPEED);
        }

        if (this.c_drone_cluster.pos != this.pos) {
            this.c_drone_cluster.move_to(this.pos, 0);
        }
    }
}

class SoldierDrone extends Drone {
    reload_time = 0.5;  // In seconds

    constructor(max_health: number, pos: Vector2, rot?: number) {
        super(max_health, pos, rot, new Vector2(1.5, 1.5))
        this.polygon.colour = new RGB(232, 239, 255);
        this.team = ObjectTeams.Friend;
    }

    circle_cluster() {
        if (this.p_drone_cluster == undefined) { return }

        // Evenly spaces itself in a ring around the center of the cluster
        let drone_num = this.p_drone_cluster.drones.indexOf(this);

        let theta = ((drone_num*2*Math.PI)/this.p_drone_cluster.drones.length) + this.p_drone_cluster.rot*DEG_TO_RAD;

        this.move_to(
            new Vector2(
                this.p_drone_cluster.radius*Math.cos(theta), 
                this.p_drone_cluster.radius*Math.sin(theta)
            ).add(this.p_drone_cluster.pos), 
            DRONE_MOVE_SPEED);
    }

    follow() {
        if (this.p_drone_cluster == undefined) { return }
        this.circle_cluster()

        this.look_at(this.pos.add(this.pos.minus(this.p_drone_cluster.pos)), DRONE_LOOK_SPEED); // Makes all of the drones point inwards
    }

    // Speed is in pixels per second, range how far the bullet can travel in pixels
    shoot(target: ObjectTeams) {
        if (this.reload_current <= 0) {
            let duration = this.range/this.speed;
            // This needs structuredClone() for some reason (I don't know why)
            let bullet = new Bullet(structuredClone(this.pos), this.rot, this.team, target, this.damage, duration);

            bullet.move_to(this.forward.scale(this.range).add(this.pos), duration, lerp);
            // Randomly offsets the drone shooting pattern by a small amount
            this.reload_current = this.reload_time + this.reload_time*rand(-0.2, 0.4);
        };
    }

    // TODO: Implement a prediction algorithm which predicts where to look based upon current movement speed and direction (issue caused by time delay to locking on target)
    attack() {
        if (this.p_drone_cluster == undefined) { return }
        this.circle_cluster();

        let enemies = world_objects.filter((object) => object.team == ObjectTeams.Enemy);
        if (enemies.length <= 0) { 
            this.look_at(mouse_world_pos, DRONE_LOOK_SPEED);
            return
        }

        let target = enemies[0];
        let distance = target.pos.distance(new Vector2(0, 0).minus(mouse_world_pos));

        for (let enemy=1; enemy<enemies.length; enemy++) {
            let new_distance = enemies[enemy].pos.distance(new Vector2(0, 0).minus(mouse_world_pos));

            if (new_distance < distance) {
                target = enemies[enemy];
                distance = new_distance;
            }
        }

        this.look_at(target.pos, DRONE_LOOK_SPEED); // If this is too slow, the drone won't be able to track fast enough when moving or when the target is moving

        // Checks if the drone is looking at the target yet (+-epsilon)
        const e = 0.1; // The smaller epsilon is, the closer the drone has to be looking at the center of its target to shoot
        if (target.pos.minus(this.pos).normalize().x > this.forward.normalize().x + e ||
            target.pos.minus(this.pos).normalize().x < this.forward.normalize().x - e ||
            target.pos.minus(this.pos).normalize().y > this.forward.normalize().y + e ||
            target.pos.minus(this.pos).normalize().y < this.forward.normalize().y - e) {
            // TODO: Make property bool
            this.reload_current = this.reload_time + this.reload_time*rand(-0.6, -0.2);
        }
    }
}

class EnemyDrone extends Drone {
    constructor(max_health: number, pos: Vector2, rot?: number) {
        super(max_health, pos, rot, new Vector2(3, 3))
        this.polygon.colour = new RGB(255, 168, 150);
        this.team = ObjectTeams.Enemy;
    }

    follow() {
        if (this.p_drone_cluster == undefined) { return }

        this.move_to(this.pos.add(this.forward.scale(0)), DRONE_MOVE_SPEED)
    }

    attack() {
        if (this.p_drone_cluster == undefined) { return }
    }
}

// TODO: Make a reason to not always stay in attack mode
enum DroneStates {
    Follow,
    Attack,
}

// TODO: Other states
// Each drone itself will implement different AI for different states
// For soldier drone - follow, the drones will circle the cluster
// For soldier drone - attack, the drones will target the closet enemy to the cursor (or maybe closest few) (changes when the target dies)
// For enemy drone - follow, the drones will face in generally the same direction and stay within a radius of the cluster as it moves
// For enemy drone - attack, each enemy will individually choose a random drone (priotizing soldiers over captian) until the drone dies
class DroneCluster extends WorldObj {
    drone_state = DroneStates.Follow;
    // The order of the drones in this array cannot dramtically change or else it will lead to weird behaviour
    drones: Drone[] = [];

    radius: number;

    constructor(pos: Vector2, radius: number) {
        super(pos)
        this.radius = radius;
    }

    // Automatically assigns the drone to the drone cluster
    // Drones should be added through here, not with c_drone_cluster.drones.push(`drone`)
    // Drones can be removed by using the drone.remove() method
    add_drone(drone: Drone) {
        drone.p_drone_cluster = this;
        this.drones.push(drone)
    }

    update() {
        // TODO: Drones immediately starting shooting if you're holding down M1 when switching modes
        switch(this.drone_state) {
            case DroneStates.Follow:
                this.drones.forEach((drone) => drone.follow()); break;
            case DroneStates.Attack:
                this.drones.forEach((drone) => drone.attack()); break;
        }

        // TODO: Figure out how to make this work with animation (maybe, I don't know if it realy matters)
        this.rot = (this.rot+delta*0.025)%360;
    }
}

class Bullet extends WorldObj {
    target: ObjectTeams;
    damage: number;
    time_alive = 0;
    max_time_alive = 2; // Prevents a bullet from living forever

    constructor(pos: Vector2, rot: number, team: ObjectTeams, target: ObjectTeams, damage: number, max_time_alive: number) {
        super(pos, rot)
        this.team = team;
        this.polygon.points = [
            new Vector2(-5, -2),
            new Vector2(5, -2),
            new Vector2(5, 2),
            new Vector2(-5, 2)
        ]

        this.target = target;
        this.damage = damage;
        this.max_time_alive = max_time_alive;
    }

    // If needed, implement quad trees for efficiency (with a lot of bullets, it ~halves the fps)
    check_for_hit() {
        let enemies = world_objects.filter((object) => object.team == ObjectTeams.Enemy)

        for (let enemy=0; enemy<enemies.length; enemy++) {
            if (this.colliding_with(enemies[enemy])) {
                enemies[enemy].update_health(-this.damage)
                this.remove();
            }
        }
    }

    draw() {
        this.polygon.draw(true);
    }

    update() {
        super.update();

        this.check_for_hit();

        this.time_alive += delta*MILLI_TO_SEC;
        if (this.time_alive > this.max_time_alive) { this.remove(); }
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

        ui_objects.push(this);
    }

    remove() {
        let i = ui_objects.indexOf(this);
        ui_objects.splice(i, 1);
    }

    update() { this.draw(); }

    draw() {}
}

class Button extends UI {
    text = "";

    constructor(pos: Vector2, size: Vector2, text: string) {
        super(pos, size)

        this.text = text;
    }
}

// Is connected to a world object
class LinkedUI extends UI {
    object: WorldObj;
    offset: Vector2;

    constructor(object: WorldObj, offset: Vector2, size: Vector2) {
        super(object.pos.add(offset), size)

        this.object = object;
        this.offset = offset;
    }

    draw() {}
}

class HealthBar extends LinkedUI {
    value: number; // Percentage
    bg_colour = new RGB(191, 191, 191);
    bar_colour = new RGB(77, 255, 79);

    constructor(object: WorldObj, value: number, offset: Vector2, size: Vector2) {
        super(object, offset, size)
        this.value = value;
    }

    draw() {
        if (this.value == 1) { return }

        let corner = new Vector2(
            this.offset.x+this.object.pos.x-this.size.x*0.5,
            this.offset.y+this.object.pos.y-this.size.y*0.5,
        ).add(camera.offset)

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

const BUTTON_FONT = "normal 36px Courier New";

// - Tool Functions - //

function rand_int(min: number, max: number): number {
    return Math.floor(Math.random()*(max-min+1) + min)
}

function rand(min: number, max: number): number {
    return Math.random()*(max-min) + min
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

        console.log(delta);

        if (this.elapsed >= this.duration ) { 
            this.elapsed = this.duration;
            this.completed = true;
        }

        this.set_value(this.interp(this.start, this.target, this.elapsed/this.duration))

        return this.completed
    }
}

// - Game Manager - //

// These variables are not in a `Game` object because there isn't really a need for it
enum GameStates {
    Start,
    Play,
    Pause,
    End,
}

let game_state = GameStates.Start;
let last_game_state = GameStates.Start;

let world_objects: WorldObj[] = [];
let ui_objects: UI[] = [];

let camera = new Camera(new Vector2(0, 0));

function update_game() {
    play_background()

    // The objects manage updating themselves on their own, the game just tells them when to do that
    for (let obj=0; obj<world_objects.length; obj++) {
        world_objects[obj].update();
    }

    // UI is called second so that it is drawn on top of the world objects
    for (let obj=0; obj<ui_objects.length; obj++) {
        ui_objects[obj].update();
    }
}


// Start
function init_start() {

}

function start_screen() {

}

// Play
let captain = new CaptainDrone(100, new Vector2(0, 0), 0);
let e_cluster = new DroneCluster(new Vector2(0, 0), 10);

function init_play() {
    for (let d=0; d<10; d++) {
        captain.c_drone_cluster.add_drone(new SoldierDrone(100, new Vector2(0, 0), 0));
    }

    let enemy_range = 500;

    for (let e=0; e<10; e++) {
        e_cluster.add_drone(new EnemyDrone(100, new Vector2(rand_int(-enemy_range, enemy_range), rand_int(-enemy_range, enemy_range)), rand_int(-179, 180)));
    }
}

function play_background() {
    ctx.fillStyle = "rgb(4, 1, 51)";

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// Pause
function pause_screen() {

}

// End
function end_screen() {

}

// - Input - //

// Mouse
// TODO: Add UI Button functionality for settings and otherwise (ALSO MAKE THIS CODE CLEANER/BETTER)
// 0: Main button, 1: Auxiliary button, 2: Secondary button, 3: Fourth button, 4: Fifth button
// (https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/button)
let mouse_buttons_initial = [false, false, false, false, false]; // Only true after a button is intially pressed, false if not pressed or sustained
let mouse_buttons_pressed = [false, false, false, false, false];

function empty() {} // Does nothing

// Functions that are called on inital press
let mouse_buttons_i_func = [empty, empty, empty, empty, empty];

// Functions that are called on press 
let mouse_buttons_p_func = [pressed_left_click, empty, empty, empty, empty]

function pressed_left_click() { 
    // captain.shoot(ObjectTeams.Enemy); // TODO: Make range based on zoom (do the same for other things too - based on zoom)

    if (captain.c_drone_cluster.drone_state == DroneStates.Attack) {
        captain.c_drone_cluster.drones.forEach((drone) => {
            drone.shoot(ObjectTeams.Enemy);
        })
    }
}

function activate_mouse_inputs() {
    for (let press=0; press<mouse_buttons_initial.length; press++) {
        if (mouse_buttons_initial[press]) {
            mouse_buttons_initial[press] = false;
            mouse_buttons_i_func[press]()
        }
        if (mouse_buttons_pressed[press]) { mouse_buttons_p_func[press]() }
    }
}

// Keyboard
const MOVE_SPEED = 2;
let move_vector = new Vector2(0, 0);

const ZOOM_FACTOR = 0.01;

// TODO: Maybe implement toggle buttons (aka. on inital press buttons) instead of hold buttons which constant apply their action
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
    "=": {pressed: false, func: () => zoom_canvas(1+ZOOM_FACTOR)}, // Zoom in
    "-": {pressed: false, func: () => zoom_canvas(1-ZOOM_FACTOR)}, // Zoom out

    // Action keys
    "e": {pressed: false, func: () => captain.c_drone_cluster.drone_state = DroneStates.Attack}, // Switch to attack mode
    "q": {pressed: false, func: () => captain.c_drone_cluster.drone_state = DroneStates.Follow}, // Switch to follow mode

    // Why not
    "Backspace": {pressed: false, func: () => captain.remove()}
}

// TODO: Doesn't work perfectly yet, but getting there (moves a little to the left after zooming in and out)
function zoom_canvas(scale: number) {
    ctx.translate(0, 0);
    ctx.scale(scale, scale);
    ctx.translate(window.innerWidth*(1-scale)/2, window.innerHeight*(1-scale)/2);
}

function activate_button_inputs() {
    Object.keys(KEYBOARD_CONTROLLER).forEach(key => {
        KEYBOARD_CONTROLLER[key].pressed && KEYBOARD_CONTROLLER[key].func();
    })
}

function init_input() {
    // Init mouse input
    document.addEventListener("mousedown", (event) => {
        mouse_buttons_initial[event.button] = true;
        mouse_buttons_pressed[event.button] = true;
    })

    document.addEventListener("mouseup", (event) => {
        mouse_buttons_initial[event.button] = false;
        mouse_buttons_pressed[event.button] = false;
    })
    
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

// - Init - //

let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let canvas_size = new Vector2(window.innerWidth, window.innerHeight);
let mouse_world_pos = new Vector2(0, 0);
window.onresize = resize_canvas;

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

function ready() {
    init_canvas()
    init_input()

    requestAnimationFrame((timestamp: DOMHighResTimeStamp) => process(timestamp, true));
}

let last_animation_frame = 0;
let delta = 0; // The amount of time since the last animation frame
// TODO: Account for the fact that you move faster if you have higher fps

let unpaused = false;

async function process(timestamp: DOMHighResTimeStamp, unpaused: boolean) {
    // Unpaused is true if the engine was just unpaused (stopped and then started again)
    delta = unpaused ? 0 : (timestamp - last_animation_frame);
    last_animation_frame = timestamp;

    if (document.hasFocus()) {
        activate_mouse_inputs()

        switch (game_state) {
            case GameStates.Start:
                if (last_game_state != game_state) {
                    init_start()
                    last_game_state = game_state;
                }

                start_screen();
                break;
            case GameStates.Play:
                if (last_game_state != game_state) {
                    init_play()
                    last_game_state = game_state;
                }

                update_game()
                activate_button_inputs()
                break;
            case GameStates.Pause:
                pause_screen();
                break;
            case GameStates.End:
                end_screen();
                break;
        }

        show_fps()

        requestAnimationFrame((timestamp: DOMHighResTimeStamp) => process(timestamp, false));
    } else {
        requestAnimationFrame((timestamp: DOMHighResTimeStamp) => process(timestamp, true));
    }
}

// - Debug - //
let fps = 0;
let fps_smoothing = 0.7; // Large leads to more smoothing (must add to 1)

function show_fps() {
    if (delta != 0) {
        fps = Math.round( (fps*fps_smoothing) + ( (1/(delta*MILLI_TO_SEC))*(1-fps_smoothing) ) );
    }

    ctx.font = "20px Helvetica";
    ctx.textAlign = "left";
    ctx.fillStyle = "#90FFAA";
    ctx.fillText("FPS " + fps, 10, 30);
}
