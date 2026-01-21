class Player {
  constructor(spawnPoint, options = {}) {
    this.spawnPoint = { ...spawnPoint };
    this.unitScale = options.unitScale ?? UNIT;
    this.cameraDistance = options.cameraDistance ?? 5.5;
    this.cameraHeight = options.cameraHeight ?? 3;
    this.pos = { x: 0, y: 0, z: 0 };
    this.vel = { z: 0 };
    this.size = options.size ?? 1;
    this.height = options.height ?? this.size * 1.5;
    this.jumpHeight = options.jumpHeight ?? 1.5;
    this.speed = 5.5;
    this.turnSpeed = 2.6;
    this.angle = 0;
    this.gravity = options.gravity ?? -22.5;
    this.jumpSpeed = Math.sqrt(2 * Math.abs(this.gravity) * this.jumpHeight);
    this.jumpHoldForce = options.jumpHoldForce ?? 0;
    this.jumpHoldMax = options.jumpHoldMax ?? 0;
    this.jumpCut = options.jumpCut ?? 1;
    this.jumpBufferTime = 0.12;
    this.jumpBufferTimer = 0;
    this.jumpHeld = false;
    this.onGround = false;
    this.jumping = false;
    this.jumpHoldTime = 0;
    this.coyoteTime = 0.3;
    this.coyoteTimer = 0;
    this.reset();
  }

  reset() {
    this.pos.x = this.spawnPoint.x;
    this.pos.y = this.spawnPoint.y;
    this.pos.z = this.spawnPoint.z;
    this.vel.z = 0;
    this.onGround = false;
    this.jumping = false;
    this.jumpHeld = false;
    this.jumpHoldTime = 0;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
  }

  update(world) {
    const dt = deltaTime / 1000;
    const move = this.speed * dt;
    const turn = this.turnSpeed * dt;

    const left = keyIsDown(LEFT_ARROW) || keyIsDown('KeyA');
    const right = keyIsDown(RIGHT_ARROW) || keyIsDown('KeyD');
    const forward = keyIsDown(UP_ARROW) || keyIsDown('KeyW');
    const backward = keyIsDown(DOWN_ARROW) || keyIsDown('KeyS');
    const touchCount = touchControls.getTouchCount();
    const secondaryJumpHeld = touchControls.isActive() && touchCount > 1;
    const jump = keyIsDown('Space') || secondaryJumpHeld;
    const jumpPressed = jump && !this.jumpHeld;
    const dragAxes = touchControls.getDragAxes();

    const turnInput = (left ? -1 : 0) + (right ? 1 : 0) + dragAxes.turn;
    const clampedTurn = Player.clampValue(turnInput, -1, 1);
    if (clampedTurn !== 0) this.angle += turn * clampedTurn;

    const moveInput = (forward ? 1 : 0) + (backward ? -1 : 0) + dragAxes.move;
    const clampedMove = Player.clampValue(moveInput, -1, 1);
    if (clampedMove !== 0) {
      this.pos.x += Math.cos(this.angle) * move * clampedMove;
      this.pos.y += Math.sin(this.angle) * move * clampedMove;
    }

    if (this.onGround) {
      this.coyoteTimer = this.coyoteTime;
      this.jumping = false;
      this.jumpHoldTime = 0;
    } else {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
    }

    if (this.jumpBufferTimer > 0) {
      this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
    }
    if (jumpPressed) {
      this.jumpBufferTimer = this.jumpBufferTime;
    }

    if (this.jumpBufferTimer > 0 && (this.onGround || this.coyoteTimer > 0)) {
      this.vel.z = this.jumpSpeed;
      this.jumping = true;
      this.jumpHoldTime = 0;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
    }

    if (this.jumping) {
      if (jump && this.jumpHoldTime < this.jumpHoldMax && this.vel.z > 0) {
        this.vel.z += this.jumpHoldForce * dt;
        this.jumpHoldTime += dt;
      } else if (
        this.jumpHoldMax > 0 &&
        !jump &&
        this.jumpHeld &&
        this.vel.z > 0
      ) {
        this.vel.z *= this.jumpCut;
        this.jumping = false;
      } else if (this.vel.z <= 0) {
        this.jumping = false;
      }
    }
    this.jumpHeld = jump;

    this.vel.z += this.gravity * dt;
    this.pos.z += this.vel.z * dt;

    world.resolvePlayerCollisions(this);

    const fallLimit = -100 / this.unitScale;
    if (this.pos.z <= fallLimit) {
      this.reset();
    }
  }

  getCamera() {
    const scale = this.unitScale;
    const posX = this.pos.x * scale;
    const posY = this.pos.y * scale;
    const posZ = this.pos.z * scale;
    const position = {
      x: posX - Math.cos(this.angle) * this.cameraDistance * scale,
      y: posY - Math.sin(this.angle) * this.cameraDistance * scale,
      z: this.cameraHeight * scale + posZ,
    };
    const target = {
      x: posX + Math.cos(this.angle) * scale,
      y: posY + Math.sin(this.angle) * scale,
      z: windowHeight / 10 + posZ,
    };
    return { position, target };
  }

  draw(cameraPosition = this.getCamera().position) {
    const scale = this.unitScale;
    const height = this.height;
    noStroke();

    normalMaterial();
    rectMode(CENTER);

    push();
    translate(
      this.pos.x * scale,
      this.pos.y * scale,
      height * 0.5 * scale + this.pos.z * scale
    );
    rotateZ(this.angle);
    box(this.size * scale, this.size * scale, height * scale);
    pop();

    const labelX = this.pos.x * scale;
    const labelY = this.pos.y * scale;
    const labelZ = this.pos.z * scale + height * 1.0666667 * scale;

    const camX = cameraPosition.x;
    const camY = cameraPosition.y;
    const camZ = cameraPosition.z;

    const dx = camX - labelX;
    const dy = camY - labelY;
    const dz = camZ - labelZ;
    const distance = Math.hypot(dx, dy, dz);

    push();
    translate(labelX, labelY, labelZ);
    if (distance > 0.0001) {
      const yaw = Math.atan2(dy, dx);
      const pitch = Math.acos(Player.clampValue(dz / distance, -1, 1));
      rotateZ(yaw);
      rotateY(pitch);
      rotateZ(-Math.PI / 2);
    }

    fill(255);
    textAlign(CENTER, CENTER);
    textSize(12);
    text(
      `x:${this.pos.x.toFixed(1)} y:${this.pos.y.toFixed(1)} z:${this.pos.z.toFixed(1)}`,
      0,
      0
    );
    pop();
  }

  static clampValue(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }
}
