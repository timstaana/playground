class Platform {
  constructor(x, y, z, w, d, h, color, options = {}) {
    this.type = options.type ?? 'box';
    this.axis = options.axis ?? 'x';
    this.dir = options.dir ?? 1;
    this.center = { x, y, z: z + h * 0.5 };
    this.size = { x: w, y: d, z: h };
    this.color = color;
  }

  getBounds() {
    const half = {
      x: this.size.x * 0.5,
      y: this.size.y * 0.5,
      z: this.size.z * 0.5,
    };
    return {
      half,
      min: {
        x: this.center.x - half.x,
        y: this.center.y - half.y,
        z: this.center.z - half.z,
      },
      max: {
        x: this.center.x + half.x,
        y: this.center.y + half.y,
        z: this.center.z + half.z,
      },
      topZ: this.center.z + half.z,
      bottomZ: this.center.z - half.z,
    };
  }

  toJSON() {
    const data = {
      x: this.center.x,
      y: this.center.y,
      z: this.center.z - this.size.z * 0.5,
      w: this.size.x,
      d: this.size.y,
      h: this.size.z,
      color: this.color,
    };
    if (this.type !== 'box') {
      data.type = this.type;
      data.axis = this.axis;
      data.dir = this.dir;
    }
    return data;
  }

  draw(alphaOverride = null) {
    const alpha = typeof alphaOverride === 'number' ? alphaOverride : 255;
    const strokeAlpha =
      typeof alphaOverride === 'number' ? Math.min(180, alphaOverride) : 180;
    push();
    if (this.color) {
      fill(this.color[0], this.color[1], this.color[2], alpha);
    } else {
      fill(60, alpha);
    }
    translate(this.center.x, this.center.y, this.center.z);
    if (this.type === 'ramp') {
      this.drawRamp();
      noFill();
      stroke(220, strokeAlpha);
      this.drawRamp();
    } else {
      box(this.size.x, this.size.y, this.size.z);
      noFill();
      stroke(220, strokeAlpha);
      box(this.size.x, this.size.y, this.size.z);
    }
    pop();
  }

  drawRamp() {
    const halfX = this.size.x * 0.5;
    const halfY = this.size.y * 0.5;
    const halfZ = this.size.z * 0.5;
    const dir = this.dir >= 0 ? 1 : -1;

    const addTri = (a, b, c) => {
      vertex(a.x, a.y, a.z);
      vertex(b.x, b.y, b.z);
      vertex(c.x, c.y, c.z);
    };
    const addQuad = (a, b, c, d) => {
      addTri(a, b, c);
      addTri(a, c, d);
    };

    let a;
    let b;
    let c;
    let d;
    let e;
    let f;

    if (this.axis === 'y') {
      const lowY = dir > 0 ? -halfY : halfY;
      const highY = dir > 0 ? halfY : -halfY;
      a = { x: -halfX, y: lowY, z: -halfZ };
      b = { x: halfX, y: lowY, z: -halfZ };
      c = { x: halfX, y: highY, z: -halfZ };
      d = { x: -halfX, y: highY, z: -halfZ };
      e = { x: -halfX, y: highY, z: halfZ };
      f = { x: halfX, y: highY, z: halfZ };
      beginShape(TRIANGLES);
      addQuad(a, b, c, d);
      addQuad(d, c, f, e);
      addQuad(a, b, f, e);
      addTri(b, c, f);
      addTri(a, e, d);
      endShape();
      return;
    }

    const lowX = dir > 0 ? -halfX : halfX;
    const highX = dir > 0 ? halfX : -halfX;
    a = { x: lowX, y: -halfY, z: -halfZ };
    b = { x: lowX, y: halfY, z: -halfZ };
    c = { x: highX, y: halfY, z: -halfZ };
    d = { x: highX, y: -halfY, z: -halfZ };
    e = { x: highX, y: -halfY, z: halfZ };
    f = { x: highX, y: halfY, z: halfZ };
    beginShape(TRIANGLES);
    addQuad(a, b, c, d);
    addQuad(d, c, f, e);
    addQuad(a, b, f, e);
    addTri(b, c, f);
    addTri(a, e, d);
    endShape();
  }
}
