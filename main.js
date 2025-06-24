"use strict";
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
    distance(vector) { return Math.sqrt((this.x + vector.x) ** 2 + (this.y + vector.y) ** 2); }
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
class Polygon {
    constructor(object, points, colour) {
        this.t_points = []; // List of transformed points
        this.object = object;
        this.points = points;
        this.colour = colour;
    }
    transform(point) {
        let rot = this.object.rot * DEG_TO_RAD;
        let rot_matrix = [[Math.cos(rot), Math.sin(rot)],
            [-Math.sin(rot), Math.cos(rot)]];
        return point.matrix_mult(rot_matrix).vec_scale(this.object.scale).add(this.object.pos).add(camera.offset);
    }
    transform_points() {
        this.t_points = [];
        for (let p = 0; p < this.points.length; p++) {
            this.t_points.push(this.transform(this.points[p]));
        }
    }
    draw(fill) {
        this.transform_points(); // Updates t_points
        ctx.fillStyle = this.colour.toStr();
        ctx.strokeStyle = this.colour.toStr();
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(this.t_points[0].x, this.t_points[0].y);
        for (let point = 1; point < this.t_points.length; point++) {
            ctx.lineTo(this.t_points[point].x, this.t_points[point].y);
        }
        ctx.closePath();
        ctx.stroke();
        if (fill == true) {
            ctx.fill();
        }
    }
    // Returns [x_max, x_min, y_max, y_min]
    bounding_box() {
        let [x_max, x_min, y_max, y_min] = [0, 0, 0, 0];
        for (let p = 0; p < this.t_points.length; p++) {
            if (this.t_points[p].x > x_max) {
                x_max = this.t_points[p].x;
            }
            else if (this.t_points[p].x < x_min) {
                x_min = this.t_points[p].x;
            }
            if (this.t_points[p].y > y_max) {
                y_max = this.t_points[p].y;
            }
            else if (this.t_points[p].y < y_min) {
                y_min = this.t_points[p].y;
            }
        }
        return [x_max, x_min, y_max, y_min];
    }
    // Checks if a given point is within a polygon (assumes point is transformed correctly)
    // Developed from https://stackoverflow.com/questions/217578/how-can-i-determine-whether-a-2d-point-is-within-a-polygon
    point_in_polygon(point) {
        let [x_max, x_min, y_max, y_min] = this.bounding_box();
        // Checks if the point is outside the bounding box
        if (point.x > x_max || point.x < x_min || point.y > y_max || point.y < y_min) {
            return false;
        }
        // This is a point we know to be outside of the polygon and will be the end of the vector from `point`
        let outside_point = new Vector2(x_min - 1, point.y);
        let intersections = 0;
        for (let s = 0; s < this.t_points.length; s++) {
            if (vectors_intersect(point, outside_point, this.t_points[s], this.t_points[(s + 1) % (this.t_points.length)])) {
                intersections++;
            }
        }
        if (intersections % 2 == 1) {
            return true;
        }
        else {
            return false;
        }
    }
    vector_in_polygon(vec_i, vec_f) {
        // Compares the vector to all sides of the polygon
        for (let s = 0; s < this.t_points.length; s++) {
            if (vectors_intersect(vec_i, vec_f, this.t_points[s], this.t_points[(s + 1) % (this.t_points.length)])) {
                return true;
            }
        }
        // The vector could be completely inside the polygon so we test on point
        // However, we only need to test one point (and don't recalculate bounds)
        if (this.point_in_polygon(vec_i)) {
            return true;
        }
        else {
            return false;
        }
    }
}
// Used to determine how objects interact and collide with other objects
var ObjectTeams;
(function (ObjectTeams) {
    ObjectTeams[ObjectTeams["None"] = 0] = "None";
    ObjectTeams[ObjectTeams["Friend"] = 1] = "Friend";
    ObjectTeams[ObjectTeams["Enemy"] = 2] = "Enemy";
    ObjectTeams[ObjectTeams["Resource"] = 3] = "Resource";
})(ObjectTeams || (ObjectTeams = {}));
class WorldObj {
    get forward() { return new Vector2(Math.cos(this.rot * DEG_TO_RAD), -Math.sin(this.rot * DEG_TO_RAD)); }
    ; // Vector for the direction the object is facing
    constructor(pos, rot, scale, polygon, team) {
        this.pos = new Vector2(0, 0); // Relative to world origin, -y up, +x right, (x, y)
        this.rot = 0; // Based on unit cicle, 0 = facing right, degrees
        this.scale = new Vector2(1, 1);
        this.polygon = new Polygon(this, [], new RGB(255, 255, 255));
        this.animator = new Animator();
        this.team = ObjectTeams.None;
        this.pos = pos == undefined ? this.pos : pos;
        this.rot = rot == undefined ? this.rot : rot;
        this.scale = scale == undefined ? this.scale : scale;
        this.polygon = polygon == undefined ? this.polygon : polygon;
        this.team = team == undefined ? this.team : team;
        world_objects.push(this);
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
        this.animator.add_anim(new Anim((value) => { this.rot = value; }, "look_at", this.rot, desired_rot, duration, interp));
    }
    rotate_by(rotation, duration, interp) {
        this.animator.add_anim(new Anim((value) => { this.rot = value; }, "rotate_by", this.rot, this.rot + rotation, duration, interp));
    }
    // Moves to a position (default = smoothstep)
    move_to(pos, duration, interp) {
        interp = interp == undefined ? smoothstep : interp;
        this.animator.add_anim(new Anim((value) => { this.pos.y = value; }, "move_to_y", this.pos.y, pos.y, duration, interp));
        this.animator.add_anim(new Anim((value) => { this.pos.x = value; }, "move_to_x", this.pos.x, pos.x, duration, interp));
    }
    colliding_with(object) {
        // Checks if a side (vector) of `object` is in this object
        for (let s = 0; s < object.polygon.t_points.length; s++) {
            if (this.polygon.vector_in_polygon(object.polygon.t_points[s], object.polygon.t_points[(s + 1) % (object.polygon.t_points.length)])) {
                return true;
            }
        }
        return false;
    }
    // Not used on all objects, but is here for simplicity
    update_health(change) { }
    // Always from the perspective of the object facing right
    draw() { }
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
    get offset() { return new Vector2(canvas_size.x * 0.5, canvas_size.y * 0.5).minus(this.pos); }
    ;
    constructor(pos) {
        super(pos);
        this.move_vector = new Vector2(0, 0);
    }
    move() {
        this.move_vector = this.move_vector.normalize().scale(MOVE_SPEED);
        this.pos = this.pos.add(this.move_vector);
        mouse_world_pos = mouse_world_pos.add(this.move_vector);
        this.move_vector = new Vector2(0, 0);
    }
    update() {
        this.move();
        this.animator.animate();
    }
}
class Drone extends WorldObj {
    constructor(max_health, pos, rot, scale) {
        super(pos, rot, scale);
        this.health_bar = new HealthBar(this, 1, new Vector2(0, -20), new Vector2(30, 5));
        // Shoot settings
        this.damage = 10;
        this.range = attack_range + 100;
        this.speed = 500;
        this.reload_time = 0.2; // In seconds
        this.reload_current = 0; // In seconds
        this.polygon.points = [
            new Vector2(10, 0),
            new Vector2(-5, 5),
            new Vector2(-5, -5)
        ];
        this.max_health = max_health;
        this.health = max_health;
    }
    draw() {
        this.polygon.draw();
        this.health_bar.draw();
    }
    update_health(change) {
        this.health += change;
        if (this.health <= 0) {
            this.remove();
            this.on_death();
        }
        this.health_bar.value = (this.health / this.max_health);
    }
    // Called when the object dies
    on_death() { }
    // Speed is in pixels per second, range how far the bullet can travel in pixels
    shoot(target) {
        if (this.reload_current <= 0) {
            let duration = this.range / this.speed;
            // This needs structuredClone() for some reason (I don't know why)
            let bullet = new Bullet(structuredClone(this.pos), this.rot, ObjectTeams.None, target, this.damage, duration);
            bullet.move_to(this.forward.scale(this.range).add(this.pos), duration, lerp);
            this.reload_current = this.reload_time;
        }
    }
    update() {
        super.update();
        if (this.reload_current > 0) {
            this.reload_current -= delta * MILLI_TO_SEC;
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
    follow() { }
    attack() { }
}
class CaptainDrone extends Drone {
    constructor(max_health, pos, rot) {
        super(max_health, pos, rot, new Vector2(3, 3));
        this.polygon.colour = new RGB(161, 189, 255);
        this.team = ObjectTeams.Friend;
        this.c_drone_cluster = new DroneCluster(this.pos, 75);
    }
    on_death() {
        if (this.health <= 0) {
            game_state = GameStates.End;
        }
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
    constructor(max_health, pos, rot) {
        super(max_health, pos, rot, new Vector2(1.5, 1.5));
        this.reload_time = 0.3; // In seconds
        this.polygon.colour = new RGB(232, 239, 255);
        this.team = ObjectTeams.Friend;
    }
    circle_cluster() {
        if (this.p_drone_cluster == undefined) {
            return;
        }
        let drone_index = this.p_drone_cluster.drones.indexOf(this);
        let drones_remaining = this.p_drone_cluster.drones.length;
        let drones_on_layer = 0;
        let layer = 0;
        let layer_capacity = 0;
        let layers_remaining = true;
        // Calculates which layer the drone is on
        while (layers_remaining) {
            layer_capacity = this.p_drone_cluster.layer_amount + layer * this.p_drone_cluster.layer_extra;
            if (drone_index >= layer_capacity) {
                drone_index -= layer_capacity;
                drones_remaining -= layer_capacity;
                layer += 1;
            }
            else {
                layers_remaining = false;
                drones_on_layer = Math.min(drones_remaining, layer_capacity) - 1;
            }
        }
        let theta = ((drone_index * 2 * Math.PI) / (1 + (drones_on_layer % layer_capacity))) + this.p_drone_cluster.rot * DEG_TO_RAD; // ((layer+1)/(layer*1.1)) - slows down the high the layer
        this.move_to(new Vector2((this.p_drone_cluster.radius + 0.5 * this.p_drone_cluster.radius * layer) * Math.cos(theta), (this.p_drone_cluster.radius + 0.5 * this.p_drone_cluster.radius * layer) * Math.sin(theta)).add(this.p_drone_cluster.pos), DRONE_MOVE_SPEED);
    }
    follow() {
        if (this.p_drone_cluster == undefined) {
            return;
        }
        this.circle_cluster();
        this.look_at(this.pos.add(this.pos.minus(this.p_drone_cluster.pos)), DRONE_LOOK_SPEED); // Makes all of the drones point inwards
    }
    // Speed is in pixels per second, range how far the bullet can travel in pixels
    shoot(target) {
        if (this.reload_current <= 0) {
            let duration = this.range / this.speed;
            // This needs structuredClone() for some reason (I don't know why)
            let bullet = new Bullet(structuredClone(this.pos), this.rot, ObjectTeams.None, target, this.damage, duration);
            bullet.move_to(this.forward.scale(this.range).add(this.pos), duration, lerp);
            // Randomly offsets the drone shooting pattern by a small amount
            this.reload_current = this.reload_time + this.reload_time * rand(-0.2, 0.4);
        }
        ;
    }
    attack() {
        if (this.p_drone_cluster == undefined) {
            return;
        }
        this.circle_cluster();
        this.look_at(mouse_world_pos, DRONE_LOOK_SPEED);
        // Old code used to target drones at a specific enemy (didn't work when the enemies were moving and not worth it to implement prediction)
        // let enemies = world_objects.filter((object) => object instanceof EnemyDrone);
        // if (enemies.length <= 0) { 
        //     this.look_at(mouse_world_pos, DRONE_LOOK_SPEED);
        //     return
        // }
        // let target = enemies[0];
        // let distance = target.pos.distance(new Vector2(0, 0).minus(mouse_world_pos));
        // for (let enemy=1; enemy<enemies.length; enemy++) {
        //     let new_distance = enemies[enemy].pos.distance(new Vector2(0, 0).minus(mouse_world_pos));
        //     if (new_distance < distance) {
        //         target = enemies[enemy];
        //         distance = new_distance;
        //     }
        // }
        // this.look_at(target.pos, DRONE_LOOK_SPEED); // If this is too slow, the drone won't be able to track fast enough when moving or when the target is moving
        // // Checks if the drone is looking at the target yet (+-epsilon)
        // const e = 0.1; // The smaller epsilon is, the closer the drone has to be looking at the center of its target to shoot
        // if (target.pos.minus(this.pos).normalize().x > this.forward.normalize().x + e ||
        //     target.pos.minus(this.pos).normalize().x < this.forward.normalize().x - e ||
        //     target.pos.minus(this.pos).normalize().y > this.forward.normalize().y + e ||
        //     target.pos.minus(this.pos).normalize().y < this.forward.normalize().y - e) {
        //     this.reload_current = this.reload_time + this.reload_time*rand(-0.6, -0.2);
        // }
    }
}
class EnemyDrone extends Drone {
    constructor(max_health, pos, rot) {
        super(max_health, pos, rot, new Vector2(3, 3));
        this.reload_time = 0.5 - captain.c_drone_cluster.drones.length / 80;
        this.damage = 10 + captain.c_drone_cluster.drones.length * 10;
        this.cluster_pos_offset = new Vector2(0, 0);
        this.polygon.colour = new RGB(255, 168, 150);
        this.team = ObjectTeams.Enemy;
    }
    on_death() {
        score += 10;
        if (this.p_drone_cluster != undefined) {
            if (this.p_drone_cluster.drones.length == 0) {
                e_clusters.splice(e_clusters.indexOf(this.p_drone_cluster), 1);
                this.p_drone_cluster.remove();
            }
        }
    }
    circle_cluster() {
        if (this.p_drone_cluster == undefined) {
            return;
        }
        // Evenly spaces itself in a ring around the center of the cluster
        let drone_num = this.p_drone_cluster.drones.indexOf(this);
        let theta = ((drone_num * 2 * Math.PI) / this.p_drone_cluster.drones.length);
        this.move_to(new Vector2(this.p_drone_cluster.radius * Math.cos(theta), this.p_drone_cluster.radius * Math.sin(theta)).add(this.p_drone_cluster.pos), DRONE_MOVE_SPEED);
    }
    follow() {
        if (this.p_drone_cluster == undefined) {
            return;
        }
        this.circle_cluster();
        this.rot = this.p_drone_cluster.rot;
    }
    attack() {
        if (this.p_drone_cluster == undefined) {
            return;
        }
        this.circle_cluster();
        if (this.target != undefined) {
            this.look_at(this.target.pos, DRONE_LOOK_SPEED); // If this is too slow, the drone won't be able to track fast enough when moving or when the target is moving
            // Checks if the drone is looking at the target yet (+-epsilon)
            const e = 0.1; // The smaller epsilon is, the closer the drone has to be looking at the center of its target to shoot
            if (this.target.pos.minus(this.pos).normalize().x > this.forward.normalize().x + e ||
                this.target.pos.minus(this.pos).normalize().x < this.forward.normalize().x - e ||
                this.target.pos.minus(this.pos).normalize().y > this.forward.normalize().y + e ||
                this.target.pos.minus(this.pos).normalize().y < this.forward.normalize().y - e) {
                this.reload_current = this.reload_time + this.reload_time * rand(-0.6, -0.2);
            }
            this.shoot([ObjectTeams.Friend]);
            if (this.target.health <= 0) {
                this.target = undefined;
            }
        }
        else {
            this.find_new_target();
        }
    }
    find_new_target() {
        let nearest_drone = captain;
        if (captain.c_drone_cluster.drones.length > 0) {
            nearest_drone = captain.c_drone_cluster.drones[0];
            let distance = captain.c_drone_cluster.drones[0].pos.distance(this.pos);
            for (let d = 1; d < captain.c_drone_cluster.drones.length; d++) {
                let new_distance = captain.c_drone_cluster.drones[d].pos.distance(this.pos);
                if (new_distance < distance) {
                    distance = new_distance;
                }
            }
            let nearest_drone_index = captain.c_drone_cluster.drones.indexOf(nearest_drone);
            // Sets the drone target to a drone near the nearest drone (so that not all enemies focus the same target)
            nearest_drone = captain.c_drone_cluster.drones[(nearest_drone_index + rand_int(-2, 2)) % captain.c_drone_cluster.drones.length];
        }
        this.target = nearest_drone;
    }
    // Speed is in pixels per second, range how far the bullet can travel in pixels
    shoot(target) {
        if (this.reload_current <= 0) {
            let duration = this.range / this.speed;
            // This needs structuredClone() for some reason (I don't know why)
            let bullet = new Bullet(structuredClone(this.pos), this.rot, ObjectTeams.None, target, this.damage, duration);
            bullet.move_to(this.forward.scale(this.range).add(this.pos), duration, lerp);
            // Randomly offsets the drone shooting pattern by a small amount
            this.reload_current = this.reload_time + this.reload_time * rand(-0.2, 0.4);
        }
    }
}
var DroneStates;
(function (DroneStates) {
    DroneStates[DroneStates["Follow"] = 0] = "Follow";
    DroneStates[DroneStates["Attack"] = 1] = "Attack";
})(DroneStates || (DroneStates = {}));
var ClusterMovement;
(function (ClusterMovement) {
    ClusterMovement[ClusterMovement["None"] = 0] = "None";
    ClusterMovement[ClusterMovement["Spin"] = 1] = "Spin";
    ClusterMovement[ClusterMovement["Meander"] = 2] = "Meander";
    ClusterMovement[ClusterMovement["Target"] = 3] = "Target";
})(ClusterMovement || (ClusterMovement = {}));
class DroneCluster extends WorldObj {
    constructor(pos, radius) {
        super(pos);
        this.drone_state = DroneStates.Follow;
        // The order of the drones in this array cannot dramtically change or else it will lead to weird behaviour
        this.drones = [];
        this.layer_amount = 12;
        this.layer_extra = 3;
        this.cluster_movement = ClusterMovement.None;
        this.turning = "right"; // Direction the cluster is turning
        this.turning_timer = 2; // How often the cluster changes direction
        this.turning_current = 0;
        this.turning_base = 40; // Base turning speed
        this.turning_speed = 50;
        this.radius = radius;
    }
    meander() {
        if (this.turning_current <= 0) {
            if (rand_int(0, 1) == 0) {
                this.turning = "right";
            }
            else {
                this.turning = "left";
            }
            this.turning_current = this.turning_timer + this.turning_timer * rand(0.2, 1.8);
            this.turning_speed = this.turning_base + this.turning_base * rand(-0.5, 0.5);
        }
        this.turning_current -= delta * MILLI_TO_SEC;
        if (this.turning == "right") {
            this.rot -= this.turning_speed * delta * MILLI_TO_SEC;
        }
        else {
            this.rot += this.turning_speed * delta * MILLI_TO_SEC;
        }
        // I don't know why this isn't working as intended (had to assign it manually)
        // this.move_to(this.pos.add(this.forward.scale(1)), 1);
        this.pos = this.pos.add(this.forward.scale(this.turning_speed * 2 * delta * MILLI_TO_SEC));
    }
    spin() {
        this.rot = (this.rot + delta * 0.025) % 360;
    }
    target() {
        this.move_to(captain.pos, DRONE_MOVE_SPEED * 50, lerp);
    }
    // Automatically assigns the drone to the drone cluster
    // Drones should be added through here, not with c_drone_cluster.drones.push(`drone`)
    // Drones can be removed by using the drone.remove() method
    add_drone(drone) {
        drone.p_drone_cluster = this;
        this.drones.push(drone);
    }
    update() {
        super.update();
        switch (this.drone_state) {
            case DroneStates.Follow:
                this.drones.forEach((drone) => drone.follow());
                break;
            case DroneStates.Attack:
                this.drones.forEach((drone) => drone.attack());
                break;
        }
        switch (this.cluster_movement) {
            case ClusterMovement.Spin:
                this.spin();
                break;
            case ClusterMovement.Meander:
                this.meander();
                break;
            case ClusterMovement.Target:
                this.target();
                break;
        }
    }
    remove() {
        this.drones.forEach((drone) => { drone.remove(); });
        super.remove();
    }
}
class Bullet extends WorldObj {
    constructor(pos, rot, team, target, damage, max_time_alive) {
        super(pos, rot);
        this.time_alive = 0;
        this.max_time_alive = 2; // Prevents a bullet from living forever
        this.team = team;
        this.polygon.points = [
            new Vector2(-5, -2),
            new Vector2(5, -2),
            new Vector2(5, 2),
            new Vector2(-5, 2)
        ];
        this.target = target;
        this.damage = damage;
        this.max_time_alive = max_time_alive;
    }
    check_for_hit() {
        let targets = world_objects.filter((object) => this.target.includes(object.team));
        for (let t = 0; t < targets.length; t++) {
            if (this.colliding_with(targets[t])) {
                targets[t].update_health(-this.damage);
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
        this.time_alive += delta * MILLI_TO_SEC;
        if (this.time_alive > this.max_time_alive) {
            this.remove();
        }
    }
}
const RESOURCE_MULT = 20;
class Resource extends WorldObj {
    constructor(points, radius, pos, rot, scale) {
        super(pos, rot, scale);
        this.health_bar = new HealthBar(this, 1, new Vector2(0, -20), new Vector2(30, 5));
        this.team = ObjectTeams.Resource;
        let side_length = Math.sqrt(2 * (radius ** 2) - 4 * radius * Math.cos((2 * Math.PI) / points));
        for (let p = 0; p < points; p++) {
            let theta = ((p * 2 * Math.PI) / points);
            // Randomly modulates the positions of the polygon points
            this.polygon.points.push(new Vector2(Math.cos(theta) * radius + rand_int(-side_length, side_length) / 3, Math.sin(theta) * radius + rand_int(-side_length, side_length) / 3));
        }
        this.max_health = points * 20;
        this.health = this.max_health;
    }
    update_health(change) {
        this.health += change;
        if (this.health <= 0) {
            resources += RESOURCE_MULT * this.polygon.points.length;
            this.remove();
            this.health_bar.remove();
        }
        this.health_bar.value = (this.health / this.max_health);
    }
    draw() {
        this.polygon.draw();
        this.health_bar.draw();
    }
}
// UI
class UI {
    constructor(pos, size) {
        this.pos = pos;
        this.size = size;
        ui_objects.push(this);
    }
    remove() {
        let i = ui_objects.indexOf(this);
        ui_objects.splice(i, 1);
    }
    draw() { }
    update() { this.draw(); }
}
// Can't use the identifier "Text"
class Words extends UI {
    // Only accepts changing variables as numbers
    constructor(pos, text, variable) {
        ctx.font = BUTTON_FONT;
        let size = new Vector2(ctx.measureText(text).width, 40);
        super(pos, size);
        this.text = text;
        this.variable = variable;
    }
    center() {
        this.pos = this.pos.minus(this.size.scale(0.5));
    }
    draw() {
        let text_with_var = this.text;
        if (this.variable != undefined) {
            text_with_var = text_with_var.replaceAll("$$", String(this.variable));
        }
        ctx.font = BUTTON_FONT;
        ctx.fillStyle = new RGB(255, 255, 255).toStr();
        ctx.fillText(text_with_var, this.pos.x, this.pos.y + this.size.y * 0.75);
    }
}
class Button extends UI {
    constructor(pos, colour, padding, text, single_click) {
        ctx.font = BUTTON_FONT;
        let size = new Vector2(ctx.measureText(text).width, 40);
        super(pos, size);
        this.text = "";
        // If true, prevents a button from being held down
        this.single_click = false;
        this.pressed = false;
        this.colour = colour;
        this.padding = padding;
        this.text = text;
        this.single_click = single_click == undefined ? this.single_click : single_click;
    }
    // Is set when the button is created (easier if it's not a constructor paramater)
    action() { }
    mouse_over() {
        if (mouse_pos.x >= this.pos.x && mouse_pos.x <= this.pos.x + this.size.x &&
            mouse_pos.y >= this.pos.y && mouse_pos.y <= this.pos.y + this.size.y) {
            return true;
        }
        return false;
    }
    center() {
        this.pos = this.pos.minus(this.size.scale(0.5));
    }
    draw() {
        ctx.font = BUTTON_FONT;
        ctx.fillStyle = this.colour.toStr();
        ctx.fillRect(this.pos.x, this.pos.y, this.size.x + 2 * this.padding, this.size.y);
        ctx.fillStyle = new RGB(0, 0, 0).toStr();
        ctx.fillText(this.text, this.pos.x + this.padding, this.pos.y + this.size.y * 0.75);
    }
    update() {
        super.update();
        // Only checks for left click as that is the only mouse button that can click a button
        if (this.pressed && mouse_buttons_pressed[0] == false) {
            this.pressed = false;
        }
    }
}
// Is connected to a world object
class LinkedUI extends UI {
    constructor(object, offset, size) {
        super(object.pos.add(offset), size);
        this.object = object;
        this.offset = offset;
    }
    draw() { }
}
class HealthBar extends LinkedUI {
    constructor(object, value, offset, size) {
        super(object, offset, size);
        this.bg_colour = new RGB(191, 191, 191);
        this.bar_colour = new RGB(77, 255, 79);
        this.value = value;
    }
    draw() {
        if (this.value == 1) {
            return;
        }
        let corner = new Vector2(this.offset.x + this.object.pos.x - this.size.x * 0.5, this.offset.y + this.object.pos.y - this.size.y * 0.5).add(camera.offset);
        ctx.beginPath(); // Start a new path
        ctx.fillStyle = this.bg_colour.toStr();
        ctx.rect(corner.x, corner.y, this.size.x, this.size.y); // Add a rectangle to the current path
        ctx.fill(); // Render the path
        ctx.beginPath(); // Start a new path
        ctx.fillStyle = this.bar_colour.toStr();
        ctx.rect(corner.x, corner.y, this.size.x * (this.value / 1), this.size.y); // Add a rectangle to the current path
        ctx.fill(); // Render the path
    }
}
// - Constants - //
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const MILLI_TO_SEC = 0.001;
const DRONE_MOVE_SPEED = 0.09;
const DRONE_LOOK_SPEED = 0.04;
const BUTTON_FONT = "bold 36px Courier New";
// - Tool Functions - //
function rand_int(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}
function rand(min, max) {
    return Math.random() * (max - min) + min;
}
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
// Determines if two vectors intersect
// Again, from https://stackoverflow.com/questions/217578/how-can-i-determine-whether-a-2d-point-is-within-a-polygon
function vectors_intersect(v1_i, v1_f, v2_i, v2_f) {
    // `Ax + By + C = 0` (standard linear equation) form of vector 1
    let a1 = v1_f.y - v1_i.y;
    let b1 = v1_i.x - v1_f.x;
    let c1 = (v1_f.x * v1_i.y) - (v1_i.x * v1_f.y);
    // Calculates which side of the line each vector 2 point is on (if they are on the same side, they have the same sign)
    let d1 = (a1 * v2_i.x) + (b1 * v2_i.y) + c1;
    let d2 = (a1 * v2_f.x) + (b1 * v2_f.y) + c1;
    // If they both have the same sign, an intersection is not possible
    if (d1 > 0 && d2 > 0) {
        return false;
    }
    ;
    if (d1 < 0 && d2 < 0) {
        return false;
    }
    ;
    // Also have to check if vector 1 intersects vector 2 (not just that vector 2 intersects vector 1)
    // `Ax + By + C = 0` (standard linear equation) form of vector 2
    let a2 = v2_f.y - v2_i.y;
    let b2 = v2_i.x - v2_f.x;
    let c2 = (v2_f.x * v2_i.y) - (v2_i.x * v2_f.y);
    // Same as before expect with vector 1
    d1 = (a2 * v1_i.x) + (b2 * v1_i.y) + c2;
    d2 = (a2 * v1_f.x) + (b2 * v1_f.y) + c2;
    if (d1 > 0 && d2 > 0) {
        return false;
    }
    ;
    if (d1 < 0 && d2 < 0) {
        return false;
    }
    ;
    // Checks if the lines are collinear
    if ((a1 * b2) - (a2 * b1) == 0) {
        return false;
    }
    ;
    return true;
}
// - Animation - //
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
    animate() {
        for (let anim = 0; anim < this.active_anims.length; anim++) {
            if (this.active_anims[anim].step()) {
                this.remove_anim(this.active_anims[anim].name);
            }
            ;
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
    step() {
        this.elapsed += delta * MILLI_TO_SEC;
        if (this.elapsed >= this.duration) {
            this.elapsed = this.duration;
            this.completed = true;
        }
        this.set_value(this.interp(this.start, this.target, this.elapsed / this.duration));
        return this.completed;
    }
}
// - Game Manager - //
// These variables are not in a `Game` object because there isn't really a need for it
var GameStates;
(function (GameStates) {
    GameStates[GameStates["Start"] = 0] = "Start";
    GameStates[GameStates["Play"] = 1] = "Play";
    GameStates[GameStates["Pause"] = 2] = "Pause";
    GameStates[GameStates["End"] = 3] = "End";
})(GameStates || (GameStates = {}));
let game_state = GameStates.Start;
let last_game_state;
let world_objects = [];
let ui_objects = [];
let camera = new Camera(new Vector2(0, 0));
function update_game() {
    play_background();
    // The objects manage updating themselves on their own, the game just tells them when to do that
    for (let obj = 0; obj < world_objects.length; obj++) {
        world_objects[obj].update();
    }
    // UI is called second so that it is drawn on top of the world objects
    for (let obj = 0; obj < ui_objects.length; obj++) {
        ui_objects[obj].update();
    }
}
// Start
let start_resources = [];
function init_start() {
    let start_button = new Button(canvas_size.scale(0.5), new RGB(255, 255, 255), 10, "Start", true);
    start_button.pos.y -= 50;
    start_button.center();
    start_button.action = () => {
        game_state = GameStates.Play;
    };
    for (let r = 0; r < 30; r++) {
        let resource_pos = new Vector2(rand(-canvas_size.x / 2 - 100, canvas_size.x / 2 + 400), rand(-canvas_size.y / 2 - 400, canvas_size.y / 2 + 100));
        let resource = new Resource(rand_int(5, 8), rand_int(30, 70), resource_pos, rand(-179, 180));
        start_resources.push(resource);
        resource.move_to(resource.pos.add(new Vector2(-canvas_size.x - 510, canvas_size.y + 510)), resource.polygon.points.length * 4 + rand(25, 45), lerp);
    }
}
function start_screen() {
    ctx.font = "bold 80px Courier New";
    ctx.fillStyle = new RGB(255, 255, 255).toStr();
    ctx.fillText("Space Drones", canvas.width / 2 - ctx.measureText("Space Drones").width / 2, canvas_size.y / 4);
    ctx.fillStyle = "rgba(70, 70, 70, 0.75)";
    ctx.fillRect(canvas.width / 2 - ctx.measureText("Shoot asteroids to collect resources.").width / 4, 5 * canvas_size.y / 8 - 50, ctx.measureText("Shoot asteroids to collect resources.").width / 2, 220);
    ctx.fillStyle = new RGB(255, 255, 255).toStr();
    ctx.font = "bold 36px Courier New";
    ctx.fillText("How to Play:", canvas.width / 2 - ctx.measureText("How to Play:").width / 2, 5 * canvas_size.y / 8);
    ctx.fillText("Press E to enable attack mode.", canvas.width / 2 - ctx.measureText("Press E to enable attack mode.").width / 2, 5 * canvas_size.y / 8 + 40);
    ctx.fillText("Shoot asteroids to collect resources.", canvas.width / 2 - ctx.measureText("Shoot asteroids to collect resources.").width / 2, 5 * canvas_size.y / 8 + 80);
    ctx.fillText("Shoot enemies to increase your score.", canvas.width / 2 - ctx.measureText("Shoot enemies to increase your score.").width / 2, 5 * canvas_size.y / 8 + 120);
    for (let r = 0; r < start_resources.length; r++) {
        start_resources[r].rot += start_resources[r].polygon.points.length * delta * MILLI_TO_SEC;
        if (start_resources[r].pos.x <= -canvas_size.x / 2 - 100 || start_resources[r].pos.y >= canvas_size.y / 2 + 100) {
            start_resources[r].remove();
            let resource_pos = new Vector2(0, 0);
            if (rand_int(0, 1) == 0) {
                resource_pos = new Vector2(rand(-canvas_size.x / 2 - 100, canvas_size.x / 2 + 400), rand(-canvas_size.y / 2 - 400, -canvas_size.y / 2 - 200));
            }
            else {
                resource_pos = new Vector2(rand(canvas_size.x / 2 + 200, canvas_size.x / 2 + 400), rand(-canvas_size.y / 2 - 400, canvas_size.y / 2 + 100));
            }
            let resource = new Resource(rand_int(5, 8), rand_int(30, 70), resource_pos, rand(-179, 180));
            start_resources.push(resource);
            resource.move_to(resource.pos.add(new Vector2(-canvas_size.x - 510, canvas_size.y + 510)), resource.polygon.points.length * 4 + rand(25, 45), lerp);
        }
    }
}
// Play
let captain;
let resources = 0; // Amount of resources
let score = 0;
let resource_ui;
let score_ui;
let drone_ui;
function init_play() {
    world_objects = [camera];
    ui_objects = [];
    score = 0;
    resources = 0;
    captain = new CaptainDrone(100, new Vector2(0, 0), 0);
    captain.c_drone_cluster.drones = [];
    captain.c_drone_cluster.cluster_movement = ClusterMovement.Spin;
    resource_ui = new Words(new Vector2(0.8 * (canvas_size.x / 2), 30), "Resources: $$", resources);
    resource_ui.center();
    score_ui = new Words(new Vector2(0.8 * (canvas_size.x / 2), 70), "Score: $$", score);
    score_ui.center();
    drone_ui = new Words(new Vector2(1.2 * (canvas_size.x / 2), 30), "Drones: $$", captain.c_drone_cluster.drones.length);
    drone_ui.center();
    let add_drone_button = new Button(new Vector2(1.19 * (canvas_size.x / 2), 70), new RGB(255, 255, 255), 10, "Add Drone", true);
    add_drone_button.center();
    add_drone_button.action = () => {
        if (resources >= 100) {
            captain.c_drone_cluster.add_drone(new SoldierDrone(100, new Vector2(captain.pos.x, captain.pos.y), 0));
            resources -= 100;
        }
    };
}
let e_clusters = [];
let resource_objects = [];
let max_enemies = 30;
let e_spawn_range = 2000;
let attack_range = 650;
let max_resources = 100;
let r_spawn_range = 2000;
function game_manager() {
    resource_ui.variable = resources;
    score_ui.variable = score;
    drone_ui.variable = captain.c_drone_cluster.drones.length;
    let drones_amount = captain.c_drone_cluster.drones.length;
    // Spawns enemies
    while (e_clusters.length < max_enemies) {
        let cluster_pos = new Vector2(0, 0);
        // Randomly chooses a position outside of the play area
        if (rand_int(0, 1) == 0) {
            if (rand_int(0, 1) == 0) {
                cluster_pos.x = rand(camera.pos.x - (canvas_size.x / 4 + e_spawn_range), camera.pos.x - canvas_size.x / 4);
            }
            else {
                cluster_pos.x = rand(camera.pos.x + canvas_size.x / 4, camera.pos.x + (canvas_size.x / 4 + e_spawn_range));
            }
            cluster_pos.y = rand(camera.pos.y - (canvas_size.y / 4 + e_spawn_range), camera.pos.y + (canvas_size.y / 4 + e_spawn_range));
        }
        else {
            if (rand_int(0, 1) == 0) {
                cluster_pos.y = rand(camera.pos.y - (canvas_size.y / 4 + e_spawn_range), camera.pos.y - canvas_size.y / 4);
            }
            else {
                cluster_pos.y = rand(camera.pos.y + canvas_size.y / 4, camera.pos.y + (canvas_size.y / 4 + e_spawn_range));
            }
            cluster_pos.x = rand(camera.pos.x - (canvas_size.x / 4 + e_spawn_range), camera.pos.x + (canvas_size.x / 4 + e_spawn_range));
        }
        let e_cluster = new DroneCluster(cluster_pos, 75);
        for (let c = 0; c < rand_int(3 + Math.round(drones_amount / 4), 7 + Math.round(drones_amount / 4)); c++) {
            e_cluster.add_drone(new EnemyDrone(100 + 30 * drones_amount, new Vector2(e_cluster.pos.x, e_cluster.pos.y), rand(-179, 180)));
        }
        e_cluster.cluster_movement = ClusterMovement.Meander;
        e_clusters.push(e_cluster);
    }
    for (let e = 0; e < e_clusters.length; e++) {
        // if (e_clusters[e].pos.x >= camera.pos.x+canvas_size.x ||
        //     e_clusters[e].pos.x <= camera.pos.x-canvas_size.x ||
        //     e_clusters[e].pos.y >= camera.pos.x+canvas_size.y ||
        //     e_clusters[e].pos.y <= camera.pos.x-canvas_size.y) {
        //     e_clusters[e].remove();
        // }
        if (e_clusters[e].pos.distance(new Vector2(0, 0).minus(captain.pos)) <= attack_range) {
            e_clusters[e].drone_state = DroneStates.Attack;
            e_clusters[e].cluster_movement = ClusterMovement.Target;
        }
        else {
            e_clusters[e].animator.remove_anim("move_to_x");
            e_clusters[e].animator.remove_anim("move_to_y");
            e_clusters[e].drone_state = DroneStates.Follow;
            e_clusters[e].cluster_movement = ClusterMovement.Meander;
        }
    }
    // Spawns resources
    while (resource_objects.length < max_resources) {
        let resource_pos = new Vector2(0, 0);
        // Randomly chooses a position outside of the play area
        if (rand_int(0, 1) == 0) {
            if (rand_int(0, 1) == 0) {
                resource_pos.x = rand(camera.pos.x - (canvas_size.x / 4 + r_spawn_range), camera.pos.x - canvas_size.x / 4);
            }
            else {
                resource_pos.x = rand(camera.pos.x + canvas_size.x / 4, camera.pos.x + (canvas_size.x / 4 + r_spawn_range));
            }
            resource_pos.y = rand(camera.pos.y - (canvas_size.y / 4 + r_spawn_range), camera.pos.y + (canvas_size.y / 4 + r_spawn_range));
        }
        else {
            if (rand_int(0, 1) == 0) {
                resource_pos.y = rand(camera.pos.y - (canvas_size.y / 4 + r_spawn_range), camera.pos.y - canvas_size.y / 4);
            }
            else {
                resource_pos.y = rand(camera.pos.y + canvas_size.y / 4, camera.pos.y + (canvas_size.y / 4 + r_spawn_range));
            }
            resource_pos.x = rand(camera.pos.x - (canvas_size.x / 4 + r_spawn_range), camera.pos.x + (canvas_size.x / 4 + r_spawn_range));
        }
        resource_objects.push(new Resource(rand_int(5, 8), rand_int(30, 70), resource_pos, rand(-179, 180)));
    }
    // for (let r=0; r<resource_objects.length; r++) {
    //     if (resource_objects[r].pos.x >= camera.pos.x+canvas_size.x/4+r_spawn_range ||
    //         resource_objects[r].pos.x <= camera.pos.x-canvas_size.x/4-r_spawn_range ||
    //         resource_objects[r].pos.y >= camera.pos.x+canvas_size.y/4+r_spawn_range ||
    //         resource_objects[r].pos.y <= camera.pos.x-canvas_size.y/4-r_spawn_range) {
    //         resource_objects[r].remove();
    //         resource_objects.splice(resource_objects.indexOf(resource_objects[r]), 1);
    //     }
    // }
}
function play_background() {
    ctx.fillStyle = "rgb(4, 1, 51)";
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}
// Pause
let pause_button;
function init_pause() {
    ctx.fillStyle = "rgba(73, 73, 73, 0.5)";
    let vert_padding = 300;
    let horz_padding = 600;
    ctx.beginPath();
    ctx.fillRect(horz_padding, vert_padding, canvas.width - 2 * horz_padding, canvas.height - 2 * vert_padding);
    ctx.font = "bold 52px Courier New";
    ctx.fillStyle = new RGB(255, 255, 255).toStr();
    ctx.fillText("Game Paused", canvas.width / 2 - ctx.measureText("Game Paused").width / 2, vert_padding + 100);
    pause_button = new Button(new Vector2(canvas.width / 2, canvas.height / 2), new RGB(255, 255, 255), 10, "Resume");
    pause_button.center();
    pause_button.action = () => {
        game_state = GameStates.Play;
        pause_button.remove();
    };
}
function pause_screen() {
    pause_button.update();
}
// End
let restart_button;
function init_end() {
    ctx.fillStyle = "rgba(136, 0, 0, 0.5)";
    let vert_padding = 300;
    let horz_padding = 600;
    ctx.beginPath();
    ctx.fillRect(horz_padding, vert_padding, canvas.width - 2 * horz_padding, canvas.height - 2 * vert_padding);
    ctx.font = "bold 52px Courier New";
    ctx.fillStyle = new RGB(255, 255, 255).toStr();
    ctx.fillText("Game Over", canvas.width / 2 - ctx.measureText("Game Over").width / 2, vert_padding + 100);
    ctx.fillText("Score: " + score, canvas.width / 2 - ctx.measureText("Score: " + score).width / 2, vert_padding + 170);
    restart_button = new Button(new Vector2(canvas.width / 2, canvas.height / 2), new RGB(255, 255, 255), 10, "Restart");
    restart_button.center();
    restart_button.action = () => {
        game_state = GameStates.Start;
        restart_button.remove();
        world_objects = [];
        ui_objects = [];
        e_clusters = [];
        resource_objects = [];
        console.log("reseting");
    };
}
function end_screen() {
    restart_button.update();
}
// - Input - //
// Mouse
// 0: Main button, 1: Auxiliary button, 2: Secondary button, 3: Fourth button, 4: Fifth button
// (https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/button)
let mouse_buttons_initial = [false, false, false, false, false]; // Only true after a button is intially pressed, false if not pressed or sustained
let mouse_buttons_pressed = [false, false, false, false, false];
function empty() { } // Does nothing
// Functions that are called on inital press
let mouse_buttons_i_func = [empty, empty, empty, empty, empty];
// Functions that are called on press 
let mouse_buttons_p_func = [pressed_left_click, empty, empty, empty, empty];
function pressed_left_click() {
    let buttons = ui_objects.filter((object) => object instanceof Button);
    buttons.forEach((button) => {
        if (button.mouse_over() && button.pressed == false) {
            button.action();
            if (button.single_click) {
                button.pressed = true;
            }
            return; // Returns if the mouse clicked a button instead of doing anything else
        }
    });
    if (game_state == GameStates.Play) {
        try {
            captain.shoot([ObjectTeams.Enemy, ObjectTeams.Resource]);
            if (captain.c_drone_cluster.drone_state == DroneStates.Attack) {
                captain.c_drone_cluster.drones.forEach((drone) => {
                    drone.shoot([ObjectTeams.Enemy, ObjectTeams.Resource]);
                });
            }
        }
        catch (error) { }
    }
}
function activate_mouse_inputs() {
    for (let press = 0; press < mouse_buttons_initial.length; press++) {
        if (mouse_buttons_initial[press]) {
            mouse_buttons_initial[press] = false;
            mouse_buttons_i_func[press]();
        }
        if (mouse_buttons_pressed[press]) {
            mouse_buttons_p_func[press]();
        }
    }
}
// Keyboard
const MOVE_SPEED = 2;
let move_vector = new Vector2(0, 0);
const ZOOM_FACTOR = 0.01;
// Allows for multiple keys to be pressed at once
// Derived from https://medium.com/@dovern42/handling-multiple-key-presses-at-once-in-vanilla-javascript-for-game-controllers-6dcacae931b7
const KEYBOARD_CONTROLLER = {
    // Camera movement
    "ArrowUp": { pressed: false, func: () => camera.move_vector.y += -1 }, // Up
    "ArrowDown": { pressed: false, func: () => camera.move_vector.y += 1 }, // Down
    "ArrowLeft": { pressed: false, func: () => camera.move_vector.x += -1 }, // Left
    "ArrowRight": { pressed: false, func: () => camera.move_vector.x += 1 }, // Right
    "w": { pressed: false, func: () => camera.move_vector.y += -1 }, // Up
    "a": { pressed: false, func: () => camera.move_vector.x += -1 }, // Left
    "s": { pressed: false, func: () => camera.move_vector.y += 1 }, // Down
    "d": { pressed: false, func: () => camera.move_vector.x += 1 }, // Right
    // Action keys
    "e": { pressed: false, func: () => captain.c_drone_cluster.drone_state = DroneStates.Attack }, // Switch to attack mode
    "q": { pressed: false, func: () => captain.c_drone_cluster.drone_state = DroneStates.Follow }, // Switch to follow mode
    "Escape": { pressed: false, func: () => { if (game_state == GameStates.Play) {
            game_state = GameStates.Pause;
        } } }
};
function activate_button_inputs() {
    Object.keys(KEYBOARD_CONTROLLER).forEach(key => {
        KEYBOARD_CONTROLLER[key].pressed && KEYBOARD_CONTROLLER[key].func();
    });
}
function init_input() {
    // Init mouse input
    document.addEventListener("mousedown", (event) => {
        mouse_buttons_initial[event.button] = true;
        mouse_buttons_pressed[event.button] = true;
    });
    document.addEventListener("mouseup", (event) => {
        mouse_buttons_initial[event.button] = false;
        mouse_buttons_pressed[event.button] = false;
    });
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
let canvas;
let ctx;
let canvas_size = new Vector2(window.innerWidth, window.innerHeight);
let mouse_pos = new Vector2(0, 0);
let mouse_world_pos = new Vector2(0, 0);
window.onresize = resize_canvas;
function init_canvas() {
    canvas = document.getElementById("canvas");
    ctx = canvas.getContext("2d");
    resize_canvas();
    canvas.addEventListener('mousemove', (event) => {
        mouse_pos = new Vector2(event.clientX, event.clientY);
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
function ready() {
    init_canvas();
    init_input();
    requestAnimationFrame((timestamp) => process(timestamp, true));
}
let last_animation_frame = 0;
let delta = 0; // The amount of time since the last animation frame
// TODO: Account for the fact that you move faster if you have higher fps
let unpaused = false;
async function process(timestamp, unpaused) {
    // Unpaused is true if the engine was just unpaused (stopped and then started again)
    delta = unpaused ? 0 : (timestamp - last_animation_frame);
    last_animation_frame = timestamp;
    if (document.hasFocus()) {
        activate_mouse_inputs();
        switch (game_state) {
            case GameStates.Start:
                if (last_game_state != game_state) {
                    init_start();
                    last_game_state = game_state;
                }
                update_game();
                start_screen();
                break;
            case GameStates.Play:
                if (last_game_state != game_state) {
                    if (last_game_state == GameStates.Start) {
                        init_play();
                    }
                    last_game_state = game_state;
                }
                update_game();
                game_manager();
                activate_button_inputs();
                break;
            case GameStates.Pause:
                if (last_game_state != game_state) {
                    init_pause();
                    last_game_state = game_state;
                }
                pause_screen();
                break;
            case GameStates.End:
                if (last_game_state != game_state) {
                    init_end();
                    last_game_state = game_state;
                }
                end_screen();
                break;
        }
        requestAnimationFrame((timestamp) => process(timestamp, false));
    }
    else {
        requestAnimationFrame((timestamp) => process(timestamp, true));
    }
}
// - Debug - //
let fps = 0;
let fps_smoothing = 0.7; // Large leads to more smoothing (must add to 1)
function show_fps() {
    if (delta != 0) {
        fps = Math.round((fps * fps_smoothing) + ((1 / (delta * MILLI_TO_SEC)) * (1 - fps_smoothing)));
    }
    ctx.font = "20px Helvetica";
    ctx.textAlign = "left";
    ctx.fillStyle = "#90FFAA";
    ctx.fillText("FPS " + fps, 10, 30);
}
