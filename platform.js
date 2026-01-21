class Platform {
  constructor(x, y, z, w, d, h, color) {
    this.type = 'box';
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
    return {
      x: this.center.x,
      y: this.center.y,
      z: this.center.z - this.size.z * 0.5,
      w: this.size.x,
      d: this.size.y,
      h: this.size.z,
      color: this.color,
    };
  }

  draw() {
    push();
    if (this.color) {
      fill(this.color[0], this.color[1], this.color[2]);
    } else {
      fill(60);
    }
    translate(this.center.x, this.center.y, this.center.z);
    box(this.size.x, this.size.y, this.size.z);
    noFill();
    stroke(220, 180);
    box(this.size.x, this.size.y, this.size.z);
    pop();
  }
}
