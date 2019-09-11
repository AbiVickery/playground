/**
 * Parasites
 * @author <https://anuraghazra.github.io/>
 *
 * Github repo: https://github.com/anuraghazra/parasites
 * Verly.js: https://github.com/anuraghazra/Verly.js
 */
let width;
let height;
let mouseX;
let mouseY;
const FLEE_RADIUS = 100;

window.onload = function() {
  const canvas = document.getElementById("c");
  const ctx = canvas.getContext("2d");
  width = canvas.width = window.innerWidth;
  height = canvas.height = window.innerHeight;

  const verly = new Verly(16, canvas, ctx);

  let boids = [];
  for (let i = 0; i < 60; i++) {
    boids.push(
      new Boid(Math.random() * width, Math.random() * height, 5, verly)
    );
  }

  // mouse
  window.addEventListener("mousemove", function(e) {
    mouseX = e.offsetX;
    mouseY = e.offsetY;
  });

  function animate() {
    let grd = ctx.createRadialGradient(
      width / 2,
      height / 2,
      0,
      width / 2,
      height / 2,
      width
    );
    grd.addColorStop(0, "rgba(25, 25, 25, 1)");
    grd.addColorStop(1, "rgba(0, 0, 25, 1)");
    // Fill with gradient
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, width, height);

    for (const b of boids) {
      b.update();
      b.applyFlock(boids);
      b.boundaries();
      b.render(ctx);
    }

    verly.update();
    verly.render();
    verly.interact();

    // mouse
    ctx.beginPath();
    ctx.strokeStyle = "rgba(255,255,255, 0.2)";
    ctx.arc(mouseX, mouseY, FLEE_RADIUS, 0, Math.PI * 2);
    ctx.stroke();
    ctx.closePath();

    requestAnimationFrame(animate);
  }
  animate();
};

//
// BOID CLASS
//
class Boid {
  constructor(x, y, radius, verly) {
    this.pos = new Vector(x, y);
    this.acc = new Vector(0, 0);
    this.vel = Vector.random2D(0, 0);
    this.vel.mult(10);

    this.radius = radius || 5;
    this.maxSpeed = 3;
    this.maxForce = 0.05;
    this.mass = 0.2;

    this.flock = new Flock(this);
    this.flockMultiplier = {
      separate: 2.0,
      align: 1.2,
      cohesion: 1.3,
      wander: 0.5
    };

    // tail
    this.tail = new Tail(
      this.pos.x,
      this.pos.y,
      Math.floor(random(5, 10)),
      Math.floor(random(5, 10)),
      0,
      verly
    );
    this.tail.setGravity(new Vector(0, 0));
  }

  /**
   * @method update()
   * updates velocity, position, and acceleration
   */
  update() {
    this.vel.add(this.acc);
    this.vel.limit(this.maxSpeed);
    this.pos.add(this.vel);
    this.acc.mult(0);
    this.tail.update();
    this.tail.render();
    this.tail.points[0].pos.setXY(this.pos.x, this.pos.y);
  }

  /**
   * @method applyForce()
   * @param {Number} f
   * applies force to acceleration
   */
  applyForce(f) {
    this.acc.add(f);
  }

  /**
   * @method boundaries()
   * check boundaries and limit agents within screen
   */
  boundaries() {
    let d = 100;
    let desire = null;
    if (this.pos.x < d) {
      desire = new Vector(this.maxSpeed, this.vel.y);
    } else if (this.pos.x > width - d) {
      desire = new Vector(-this.maxSpeed, this.vel.y);
    }
    if (this.pos.y < d) {
      desire = new Vector(this.vel.x, this.maxSpeed);
    } else if (this.pos.y > height - d) {
      desire = new Vector(this.vel.x, -this.maxSpeed);
    }
    if (desire !== null) {
      desire.normalize();
      desire.mult(this.maxSpeed);
      let steer = Vector.sub(desire, this.vel);
      steer.limit(0.1);
      this.applyForce(steer);
    }
  }

  /**
   * @method applyFlock()
   * @param {*} agents
   * calculates all the flocking code apply it to the acceleration
   */
  applyFlock(agents) {
    let sep = this.flock.separate(agents);
    let ali = this.flock.align(agents);
    let coh = this.flock.cohesion(agents);
    let wander = this.flock.wander();
    let flee = this.flock.flee(new Vector(mouseX, mouseY));

    sep.mult(this.flockMultiplier.separate);
    ali.mult(this.flockMultiplier.align);
    coh.mult(this.flockMultiplier.cohesion);
    wander.mult(this.flockMultiplier.wander);
    flee.mult(50);
    this.applyForce(sep);
    this.applyForce(ali);
    this.applyForce(coh);
    this.applyForce(wander);
    this.applyForce(flee);
  }

  renderNames() {
    noStroke();
    fill(35);
    textAlign(CENTER);
    textSize(10);
    text(this.name, this.pos.x - this.radius, this.pos.y - this.radius - 5);
  }
  /**
   * Render Agent
   * @param {CanvasRenderingContext2D} ctx
   */
  render(ctx) {
    ctx.beginPath();
    // ctx.fillStyle = `rgba(${this.color[0]},${this.color[1]},${this.color[2]},${this.health})`;
    let angle = this.vel.heading();
    ctx.save();
    ctx.fillStyle = "#35eb35";
    ctx.translate(this.pos.x, this.pos.y);
    ctx.rotate(angle);
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    // ctx.moveTo(this.radius, 0);
    // ctx.lineTo(-this.radius, -this.radius + 2);
    // ctx.lineTo(-this.radius, this.radius - 4);
    // ctx.lineTo(this.radius, 0);
    ctx.fill();
    ctx.restore();

    ctx.closePath();
  }
}

//
// FLOCK CLASS
// handles flocking behavior
//
class Flock {
  constructor(currentAgent) {
    this.currentAgent = currentAgent;
    this.wandertheta = 0;
  }

  /**
   * @method seek()
   * @param {*} target
   * simple method to seek something
   */
  seek(target) {
    let desired = null;
    desired = Vector.sub(target, this.currentAgent.pos);
    desired.normalize();
    desired.mult(this.currentAgent.maxSpeed);
    let steer = Vector.sub(desired, this.currentAgent.vel);
    steer.limit(this.currentAgent.maxForce);
    return steer;
  }

  /**
   * @method flee()
   * @param {*} target
   * simple method to flee something
   */
  flee(target) {
    let desired = null;
    let d = Vector.dist(this.currentAgent.pos, target);
    if (d < FLEE_RADIUS) {
      desired = Vector.sub(target, this.currentAgent.pos);
      desired.normalize();
      desired.mult(this.currentAgent.maxSpeed);
      let steer = Vector.sub(desired, this.currentAgent.vel);
      steer.limit(this.currentAgent.maxForce);
      return steer.mult(-1);
    } else {
      return new Vector(0, 0);
    }
  }

  /**
   * just a basic refator
   * @param {*} sum
   */
  _returnSteer(sum) {
    sum.normalize();
    sum.mult(this.currentAgent.maxSpeed);
    let steer = Vector.sub(sum, this.currentAgent.vel);
    steer.limit(this.currentAgent.maxForce);
    return steer;
  }

  /**
   * @method wander()
   * not in used
   */
  wander() {
    let wanderR = 100;
    let wanderD = 80;
    let change = 0.1;
    this.wandertheta += -change + Math.random() * change;

    // Now we have to calculate the new location to steer towards on the wander circle
    let circleloc = this.currentAgent.vel.copy();
    circleloc.normalize();
    circleloc.mult(wanderD);
    circleloc.add(this.currentAgent.pos);

    let h = this.currentAgent.vel.heading();

    let circleOffSet = new Vector(
      wanderR * Math.cos(this.wandertheta + h),
      wanderR * Math.sin(this.wandertheta + h)
    );
    let target = Vector.add(circleloc, circleOffSet);

    // SEEK (have to make the seek function generic)
    let desired = null;
    desired = Vector.sub(target, this.currentAgent.pos);
    desired.normalize();
    desired.mult(this.currentAgent.maxSpeed);
    let steer = Vector.sub(desired, this.currentAgent.vel);
    steer.limit(this.currentAgent.maxForce);
    return steer;
  }

  /**
   * @method separate()
   * @param {Array} agents
   * part of flocking system
   */
  separate(agents) {
    let desiredseperation = this.currentAgent.radius * 4;
    let sum = new Vector();
    let count = 0;
    for (let i = 0; i < agents.length; i++) {
      let d = Vector.distSq(this.currentAgent.pos, agents[i].pos);
      if (d > 0 && d < desiredseperation * desiredseperation) {
        let diff = Vector.sub(this.currentAgent.pos, agents[i].pos);
        diff.normalize();
        diff.div(d);
        sum.add(diff);
        count++;
      }
    }
    if (count > 0) {
      sum.div(count);
      return this._returnSteer(sum);
    }
    return new Vector(0, 0);
  }

  /**
   * @method align()
   * @param {Array} agents
   * part of flocking system
   */
  align(agents) {
    let neighbordist = 50;
    let sum = new Vector(0, 0);
    let count = 0;
    for (let i = 0; i < agents.length; i++) {
      let d = Vector.distSq(this.currentAgent.pos, agents[i].pos);
      if (d > 0 && d < neighbordist * neighbordist) {
        sum.add(agents[i].vel);
        count++;
      }
    }
    if (count > 0) {
      sum.div(count);
      return this._returnSteer(sum);
    }
    return new Vector(0, 0);
  }

  /**
   * @method cohesion()
   * @param {Array} agents
   * part of flocking system
   */
  cohesion(agents) {
    let neighbordist = 30;
    let sum = new Vector(0, 0);
    let count = 0;
    for (let i = 0; i < agents.length; i++) {
      let d = Vector.distSq(this.currentAgent.pos, agents[i].pos);
      if (d > 0 && d < neighbordist * neighbordist) {
        sum.add(agents[i].pos);
        count++;
      }
    }
    if (count > 0) {
      sum.div(count);
      sum.sub(this.currentAgent.pos);
      return this._returnSteer(sum);
    }
    return new Vector(0, 0);
  }
}

//
// TRAIL CLASS
//
class Tail extends Entity {
  constructor(x, y, segments, gap, pinoffset, verlyInstance) {
    super(16, verlyInstance);
    this.points = [];
    this.sticks = [];

    this.x = x;
    this.y = y;
    this.segments = segments;
    this.gap = gap;
    this.pinoffset = pinoffset;

    this.createRope();
  }

  createRope() {
    for (let i = 0; i < this.segments; i++) {
      this.addPoint(this.x + i * this.gap, this.y, 0, 0).setFriction(0.75);
    }
    for (let i = 0; i < this.segments - 1; i++) {
      this.addStick(i, (i + 1) % this.segments).setColor("#35ebbe");
    }
    if (this.pin !== undefined) this.pin(this.pinoffset);
    return this;
  }

  renderPoints() {}
}
