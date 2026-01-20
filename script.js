const player = {
  pos: { x: 0, y: 0, z: 0 },
  vel: { z: 0 },
  size: 40,
  speed: 220,
  turnSpeed: 2.6,
  angle: 0,
  gravity: -900,
  jumpSpeed: 360,
  jumpHoldForce: 700,
  jumpHoldMax: 0.18,
  jumpCut: 0.45,
  jumpBufferTime: 0.12,
  jumpBufferTimer: 0,
  jumpHeld: false,
  onGround: false,
  jumping: false,
  jumpHoldTime: 0,
  coyoteTime: 0.3,
  coyoteTimer: 0,
};

const dragInput = {
  active: false,
  startX: 0,
  startY: 0,
  dx: 0,
  dy: 0,
  deadZone: 10,
  maxDistance: 50,
  hasDirection: false,
  pointerId: null,
  jumpDelay: 0.14,
  timeHeld: 0,
};

const MOUSE_SUPPRESS_MS = 500;
const touchInput = {
  active: new Map(),
  primaryId: null,
  suppressMouseUntil: 0,
};

const colliders = [];
const levelUrl = 'level.json';
const showTouchDebug = true;
let debugLayer = null;
let mainCanvas = null;

async function setup() {
  mainCanvas = createCanvas(windowWidth, windowHeight, WEBGL);
  if (showTouchDebug) {
    debugLayer = createGraphics(windowWidth, windowHeight);
    debugLayer.pixelDensity(pixelDensity());
    const debugCanvas = debugLayer.elt;
    debugCanvas.style.position = 'absolute';
    debugCanvas.style.left = '0';
    debugCanvas.style.top = '0';
    debugCanvas.style.display = 'block';
    debugCanvas.style.pointerEvents = 'none';
    debugCanvas.style.zIndex = '10';
    const parent = mainCanvas.elt.parentNode || document.body;
    parent.appendChild(debugCanvas);
  }
  setupTouchEvents();
  player.pos.x = 0;
  player.pos.y = 0;
  player.pos.z = 0;
  player.vel.z = 0;
  player.onGround = true;
  loadLevel();
}

function draw() {
  background(18);
  updatePlayer();
  updateCamera();
  drawPlatforms();
  drawShadow();
  drawPlatformShadows();
  drawPlayer();
  if (showTouchDebug) drawTouchDebug();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  if (debugLayer) {
    debugLayer.resizeCanvas(windowWidth, windowHeight);
    debugLayer.pixelDensity(pixelDensity());
    debugLayer.elt.style.width = `${windowWidth}px`;
    debugLayer.elt.style.height = `${windowHeight}px`;
  }
}

function beginDrag(x, y, id = null) {
  dragInput.active = true;
  dragInput.startX = x;
  dragInput.startY = y;
  dragInput.dx = 0;
  dragInput.dy = 0;
  dragInput.hasDirection = false;
  dragInput.pointerId = id;
  dragInput.timeHeld = 0;
}

function updateDrag(x, y) {
  if (!dragInput.active) return;
  dragInput.dx = x - dragInput.startX;
  dragInput.dy = y - dragInput.startY;
  if (!dragInput.hasDirection) {
    const deadZone = dragInput.deadZone;
    dragInput.hasDirection =
      Math.abs(dragInput.dx) >= deadZone || Math.abs(dragInput.dy) >= deadZone;
  }
}

function endDrag() {
  dragInput.active = false;
  dragInput.dx = 0;
  dragInput.dy = 0;
  dragInput.hasDirection = false;
  dragInput.pointerId = null;
  dragInput.timeHeld = 0;
}

function getTouchPoint(touch) {
  if (!touch) return { x: 0, y: 0 };
  if (touch.x !== undefined && touch.y !== undefined) {
    return { x: touch.x, y: touch.y };
  }
  const rect = mainCanvas?.elt?.getBoundingClientRect
    ? mainCanvas.elt.getBoundingClientRect()
    : { left: 0, top: 0 };
  const x = (touch.clientX ?? touch.pageX ?? 0) - rect.left;
  const y = (touch.clientY ?? touch.pageY ?? 0) - rect.top;
  return { x, y };
}

function setupTouchEvents() {
  const canvasEl = mainCanvas?.elt;
  if (!canvasEl) return;
  canvasEl.addEventListener('touchstart', handleTouchStart, { passive: false });
  canvasEl.addEventListener('touchmove', handleTouchMove, { passive: false });
  canvasEl.addEventListener('touchend', handleTouchEnd, { passive: false });
  canvasEl.addEventListener('touchcancel', handleTouchEnd, { passive: false });
}

function refreshActiveTouches(event) {
  touchInput.active.clear();
  for (const touch of event.touches) {
    const id = touch.identifier;
    const pos = getTouchPoint(touch);
    touchInput.active.set(id, pos);
  }
}

function findChangedTouch(event, id) {
  for (const touch of event.changedTouches) {
    if (touch.identifier === id) return touch;
  }
  return null;
}

function suppressMouse() {
  touchInput.suppressMouseUntil = millis() + MOUSE_SUPPRESS_MS;
}

function handleTouchStart(event) {
  event.preventDefault();
  suppressMouse();
  refreshActiveTouches(event);
  if (touchInput.primaryId === null && event.changedTouches.length > 0) {
    const touch = event.changedTouches[0];
    const id = touch.identifier;
    const pos = getTouchPoint(touch);
    touchInput.primaryId = id;
    beginDrag(pos.x, pos.y, id);
  }
}

function handleTouchMove(event) {
  event.preventDefault();
  suppressMouse();
  refreshActiveTouches(event);
  if (touchInput.primaryId !== null) {
    const primaryTouch = findChangedTouch(event, touchInput.primaryId);
    if (primaryTouch) {
      const pos = getTouchPoint(primaryTouch);
      updateDrag(pos.x, pos.y);
    }
  }
}

function handleTouchEnd(event) {
  event.preventDefault();
  suppressMouse();
  refreshActiveTouches(event);
  if (
    touchInput.primaryId !== null &&
    findChangedTouch(event, touchInput.primaryId)
  ) {
    touchInput.primaryId = null;
    endDrag();
  }
}

function getTouchCount() {
  return touchInput.active.size;
}

function isMouseSuppressed() {
  return touchInput.active.size > 0 || millis() < touchInput.suppressMouseUntil;
}

function drawTouchDebug() {
  if (!debugLayer) return;
  debugLayer.clear();
  debugLayer.noStroke();
  debugLayer.textSize(12);
  debugLayer.fill(255);
  const count = getTouchCount();
  debugLayer.text(`touches: ${count}`, 12, 18);
  debugLayer.text(`primaryId: ${touchInput.primaryId}`, 12, 34);
  debugLayer.text(`dragId: ${dragInput.pointerId}`, 12, 50);
  debugLayer.text(
    `dx/dy: ${dragInput.dx.toFixed(1)}, ${dragInput.dy.toFixed(1)}`,
    12,
    66
  );
  debugLayer.text(`dir: ${dragInput.hasDirection}`, 12, 82);
  debugLayer.text(`held: ${dragInput.timeHeld.toFixed(2)}`, 12, 98);
  debugLayer.text('mode: touch', 12, 114);
  debugLayer.text(
    `suppressMouse: ${Math.max(0, touchInput.suppressMouseUntil - millis()).toFixed(0)}`,
    12,
    130
  );

  if (dragInput.active && touchInput.primaryId !== null) {
    const baseRadius = 50;
    const knobRadius = 30;
    const maxDistance = dragInput.maxDistance;
    const dx = dragInput.dx;
    const dy = dragInput.dy;
    const distance = Math.hypot(dx, dy);
    const scale = distance > maxDistance && distance > 0 ? maxDistance / distance : 1;
    const clampX = dx * scale;
    const clampY = dy * scale;
    const knobX = dragInput.startX + clampX;
    const knobY = dragInput.startY + clampY;

    debugLayer.noStroke();

    debugLayer.fill(255, 255, 255, 20);
    debugLayer.ellipse(dragInput.startX, dragInput.startY, baseRadius * 2, baseRadius * 2);
    
    debugLayer.fill(255, 255, 255, 140);
    debugLayer.ellipse(knobX, knobY, knobRadius * 2, knobRadius * 2);
  }

  for (const [id, pos] of touchInput.active.entries()) {
    const isPrimary = id === touchInput.primaryId;
    debugLayer.fill(isPrimary ? 255 : 0, isPrimary ? 80 : 200, 80, 200);
    debugLayer.ellipse(pos.x, pos.y, 26, 26);
    debugLayer.fill(0);
    debugLayer.text(String(id), pos.x + 14, pos.y + 4);
  }
}

function getDragAxes() {
  if (!dragInput.active) return { turn: 0, move: 0 };
  const maxDistance = dragInput.maxDistance;
  const deadZone = dragInput.deadZone;
  const clampedX = Math.max(-maxDistance, Math.min(maxDistance, dragInput.dx));
  const clampedY = Math.max(-maxDistance, Math.min(maxDistance, dragInput.dy));
  const turn = Math.abs(clampedX) < deadZone ? 0 : clampedX / maxDistance;
  const move = Math.abs(clampedY) < deadZone ? 0 : -clampedY / maxDistance;
  return { turn, move };
}

function updatePlayer() {
  const move = player.speed * (deltaTime / 1000);
  const turn = player.turnSpeed * (deltaTime / 1000);
  const dt = deltaTime / 1000;

  if (dragInput.active && !dragInput.hasDirection) {
    dragInput.timeHeld = Math.min(dragInput.jumpDelay, dragInput.timeHeld + dt);
  } else {
    dragInput.timeHeld = 0;
  }

  const left = keyIsDown(LEFT_ARROW) || keyIsDown('KeyA');
  const right = keyIsDown(RIGHT_ARROW) || keyIsDown('KeyD');
  const forward = keyIsDown(UP_ARROW) || keyIsDown('KeyW');
  const backward = keyIsDown(DOWN_ARROW) || keyIsDown('KeyS');
  const touchCount = getTouchCount();
  const secondaryJumpHeld = dragInput.active && touchCount > 1;
  const pointerJump =
    dragInput.active &&
    !dragInput.hasDirection &&
    dragInput.timeHeld >= dragInput.jumpDelay;
  const jump = keyIsDown('Space') || pointerJump || secondaryJumpHeld;
  const jumpPressed = jump && !player.jumpHeld;
  const dragAxes = getDragAxes();

  const turnInput = (left ? -1 : 0) + (right ? 1 : 0) + dragAxes.turn;
  const clampedTurn = Math.max(-1, Math.min(1, turnInput));
  if (clampedTurn !== 0) player.angle += turn * clampedTurn;

  const moveInput = (forward ? 1 : 0) + (backward ? -1 : 0) + dragAxes.move;
  const clampedMove = Math.max(-1, Math.min(1, moveInput));
  if (clampedMove !== 0) {
    player.pos.x += Math.cos(player.angle) * move * clampedMove;
    player.pos.y += Math.sin(player.angle) * move * clampedMove;
  }

  if (player.onGround) {
    player.coyoteTimer = player.coyoteTime;
    player.jumping = false;
    player.jumpHoldTime = 0;
  } else {
    player.coyoteTimer = Math.max(0, player.coyoteTimer - dt);
  }

  if (player.jumpBufferTimer > 0) {
    player.jumpBufferTimer = Math.max(0, player.jumpBufferTimer - dt);
  }
  if (jumpPressed) {
    player.jumpBufferTimer = player.jumpBufferTime;
  }

  if (player.jumpBufferTimer > 0 && (player.onGround || player.coyoteTimer > 0)) {
    player.vel.z = player.jumpSpeed;
    player.jumping = true;
    player.jumpHoldTime = 0;
    player.coyoteTimer = 0;
    player.jumpBufferTimer = 0;
  }

  if (player.jumping) {
    if (jump && player.jumpHoldTime < player.jumpHoldMax && player.vel.z > 0) {
      player.vel.z += player.jumpHoldForce * dt;
      player.jumpHoldTime += dt;
    } else if (!jump && player.jumpHeld && player.vel.z > 0) {
      player.vel.z *= player.jumpCut;
      player.jumping = false;
    } else if (player.vel.z <= 0) {
      player.jumping = false;
    }
  }
  player.jumpHeld = jump;

  player.vel.z += player.gravity * dt;
  player.pos.z += player.vel.z * dt;

  resolvePlayerCollisions();
}

function drawPlayer() {
  noStroke();

  normalMaterial();
  rectMode(CENTER);

  push();
  translate(player.pos.x, player.pos.y, player.size * .75 + player.pos.z);
  rotateZ(player.angle);
  box(player.size, player.size, player.size*1.5);
  pop();
}

function drawShadow() {
  const playerBottomZ = player.pos.z;
  const surfaces = getShadowSurfaces(player.pos.x, player.pos.y, playerBottomZ);
  if (surfaces.length === 0) return;

  for (const surface of surfaces) {
    const radius = surface.radius;
    const localX = player.pos.x - surface.collider.center.x;
    const localY = player.pos.y - surface.collider.center.y;
    const halfX = surface.collider.size.x * 0.5;
    const halfY = surface.collider.size.y * 0.5;
    const shape = clipCircleToRect(localX, localY, radius, halfX, halfY);
    if (shape.length < 3) continue;

    const occluderShapes = [];
    for (const other of colliders) {
      if (other.type !== 'box') continue;
      if (other === surface.collider) continue;

      const otherTopZ = other.center.z + other.size.z * 0.5;
      if (otherTopZ <= surface.topZ + 0.01) continue;
      if (otherTopZ > playerBottomZ + 0.1) continue;

      const otherHalfX = other.size.x * 0.5;
      const otherHalfY = other.size.y * 0.5;
      if (!circleIntersectsRect(player.pos.x, player.pos.y, radius, other.center, otherHalfX, otherHalfY)) {
        continue;
      }

      const offsetX = other.center.x - surface.collider.center.x;
      const offsetY = other.center.y - surface.collider.center.y;
      const occluderLocal = clipCircleToRect(
        localX - offsetX,
        localY - offsetY,
        radius,
        otherHalfX,
        otherHalfY
      );
      if (occluderLocal.length < 3) continue;
      occluderShapes.push(
        occluderLocal.map((point) => ({ x: point.x + offsetX, y: point.y + offsetY }))
      );
    }

    push();
    translate(surface.collider.center.x, surface.collider.center.y, surface.topZ + 0.1);
    noStroke();
    fill(0, 140);
    beginShape();
    for (const point of shape) {
      vertex(point.x, point.y, 0);
    }
    const shapeArea = polygonArea(shape);
    for (let i = 0; i < occluderShapes.length; i += 1) {
      let occluderPoints = occluderShapes[i];
      if (shapeArea * polygonArea(occluderPoints) > 0) {
        occluderPoints = [...occluderPoints].reverse();
      }
      beginContour();
      for (const point of occluderPoints) {
        vertex(point.x, point.y, 0);
      }
      endContour();
    }
    endShape(CLOSE);
    pop();
  }
}

function drawPlatforms() {
  for (const collider of colliders) {
    if (collider.type !== 'box') continue;
    push();
    if (collider.color) {
      fill(collider.color[0], collider.color[1], collider.color[2]);
    } else {
      fill(60);
    }
    translate(collider.center.x, collider.center.y, collider.center.z);
    box(collider.size.x, collider.size.y, collider.size.z);
    noFill();
    stroke(220, 180);
    box(collider.size.x, collider.size.y, collider.size.z);
    pop();
  }
}

function drawPlatformShadows() {
  const maxShadowDrop = 320;

  for (const caster of colliders) {
    if (caster.type !== 'box') continue;
    const casterHalfX = caster.size.x * 0.5;
    const casterHalfY = caster.size.y * 0.5;
    const casterMinX = caster.center.x - casterHalfX;
    const casterMaxX = caster.center.x + casterHalfX;
    const casterMinY = caster.center.y - casterHalfY;
    const casterMaxY = caster.center.y + casterHalfY;
    const casterBottomZ = caster.center.z - caster.size.z * 0.5;

    for (const receiver of colliders) {
      if (receiver.type !== 'box' || receiver === caster) continue;
      const receiverTopZ = receiver.center.z + receiver.size.z * 0.5;
      if (receiverTopZ >= casterBottomZ - 0.01) continue;

      const height = casterBottomZ - receiverTopZ;
      if (height > maxShadowDrop) continue;

      const receiverHalfX = receiver.size.x * 0.5;
      const receiverHalfY = receiver.size.y * 0.5;
      const receiverMinX = receiver.center.x - receiverHalfX;
      const receiverMaxX = receiver.center.x + receiverHalfX;
      const receiverMinY = receiver.center.y - receiverHalfY;
      const receiverMaxY = receiver.center.y + receiverHalfY;

      const minX = Math.max(casterMinX, receiverMinX);
      const maxX = Math.min(casterMaxX, receiverMaxX);
      const minY = Math.max(casterMinY, receiverMinY);
      const maxY = Math.min(casterMaxY, receiverMaxY);
      if (minX >= maxX || minY >= maxY) continue;

      const alpha = Math.max(20, 130 - height * 0.35);

      push();
      translate(0, 0, receiverTopZ + 0.06);
      noStroke();
      fill(0, alpha);
      beginShape();
      vertex(minX, minY, 0);
      vertex(minX, maxY, 0);
      vertex(maxX, maxY, 0);
      vertex(maxX, minY, 0);
      endShape(CLOSE);
      pop();
    }
  }
}

function addPlatform(x, y, z, w, d, h, color) {
  colliders.push({
    type: 'box',
    center: { x, y, z: z + h * 0.5 },
    size: { x: w, y: d, z: h },
    color,
  });
}

function clearPlatforms() {
  for (let i = colliders.length - 1; i >= 0; i -= 1) {
    if (colliders[i].type === 'box') {
      colliders.splice(i, 1);
    }
  }
}

function getShadowSurfaces(x, y, playerBottomZ) {
  const baseSize = player.size * 1.5;
  const surfaces = [];

  for (const collider of colliders) {
    if (collider.type !== 'box') continue;
    const halfX = collider.size.x * 0.5;
    const halfY = collider.size.y * 0.5;
    const topZ = collider.center.z + collider.size.z * 0.5;

    if (topZ > playerBottomZ + 0.1) continue;

    const height = Math.max(0, playerBottomZ - topZ);
    const scale = Math.max(0.35, 1 - height / 320);
    const radius = baseSize * scale * 0.5;

    if (!circleIntersectsRect(x, y, radius, collider.center, halfX, halfY)) continue;

    surfaces.push({ collider, topZ, radius });
  }

  surfaces.sort((a, b) => b.topZ - a.topZ);
  return surfaces;
}

function clipCircleToRect(cx, cy, r, halfX, halfY) {
  const segments = 32;
  let points = [];

  if (r <= 0) return points;

  for (let i = 0; i < segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2;
    points.push({ x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r });
  }

  // Sutherland-Hodgman polygon clipping against an axis-aligned rectangle.
  points = clipPolygon(points, (p) => p.x >= -halfX, (a, b) => intersectX(a, b, -halfX));
  points = clipPolygon(points, (p) => p.x <= halfX, (a, b) => intersectX(a, b, halfX));
  points = clipPolygon(points, (p) => p.y >= -halfY, (a, b) => intersectY(a, b, -halfY));
  points = clipPolygon(points, (p) => p.y <= halfY, (a, b) => intersectY(a, b, halfY));

  return points;
}

function circleIntersectsRect(cx, cy, r, rectCenter, halfX, halfY) {
  const dx = Math.max(Math.abs(cx - rectCenter.x) - halfX, 0);
  const dy = Math.max(Math.abs(cy - rectCenter.y) - halfY, 0);
  return dx * dx + dy * dy <= r * r;
}

function clipPolygon(points, inside, intersect) {
  const output = [];
  if (points.length === 0) return output;

  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    const currentInside = inside(current);
    const nextInside = inside(next);

    if (currentInside && nextInside) {
      output.push(next);
    } else if (currentInside && !nextInside) {
      output.push(intersect(current, next));
    } else if (!currentInside && nextInside) {
      output.push(intersect(current, next));
      output.push(next);
    }
  }

  return output;
}

function polygonArea(points) {
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    area += current.x * next.y - next.x * current.y;
  }
  return area * 0.5;
}

function intersectX(a, b, x) {
  const denom = b.x - a.x;
  const t = denom === 0 ? 0 : (x - a.x) / denom;
  return { x, y: a.y + (b.y - a.y) * t };
}

function intersectY(a, b, y) {
  const denom = b.y - a.y;
  const t = denom === 0 ? 0 : (y - a.y) / denom;
  return { x: a.x + (b.x - a.x) * t, y };
}

async function loadLevel() {
  try {
    const response = await fetch(levelUrl, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Level load failed: ${response.status}`);
    const data = await response.json();
    clearPlatforms();

    if (Array.isArray(data.platforms)) {
      for (const platform of data.platforms) {
        addPlatform(
          platform.x || 0,
          platform.y || 0,
          platform.z || 0,
          platform.w || 40,
          platform.d || 40,
          platform.h || 20,
          platform.color
        );
      }
    }
  } catch (error) {
    // Keep the scene running if the level fails to load.
    console.error(error);
  }
}

function resolvePlayerCollisions() {
  player.onGround = false;

  for (const collider of colliders) {
    const half = player.size * 0.5;
    const center = {
      x: player.pos.x,
      y: player.pos.y,
      z: player.pos.z + half,
    };

    if (collider.type === 'box') {
      const dx = center.x - collider.center.x;
      const dy = center.y - collider.center.y;
      const dz = center.z - collider.center.z;
      const overlapX = collider.size.x * 0.5 + half - Math.abs(dx);
      const overlapY = collider.size.y * 0.5 + half - Math.abs(dy);
      const overlapZ = collider.size.z * 0.5 + half - Math.abs(dz);

      if (overlapX <= 0 || overlapY <= 0 || overlapZ <= 0) continue;

      if (overlapX < overlapY && overlapX < overlapZ) {
        const sign = Math.sign(dx) || 1;
        center.x += sign * overlapX;
      } else if (overlapY < overlapZ) {
        const sign = Math.sign(dy) || 1;
        center.y += sign * overlapY;
      } else {
        const sign = Math.sign(dz) || 1;
        center.z += sign * overlapZ;
        if (sign > 0) {
          player.onGround = true;
          if (player.vel.z < 0) player.vel.z = 0;
        } else if (player.vel.z > 0) {
          player.vel.z = 0;
        }
      }

      player.pos.x = center.x;
      player.pos.y = center.y;
      player.pos.z = center.z - half;
    }
  }
}

function updateCamera() {
  const cameraDistance = 220;
  const cameraHeight = 120;

  const camX = player.pos.x - Math.cos(player.angle) * cameraDistance;
  const camY = player.pos.y - Math.sin(player.angle) * cameraDistance;
  const camZ = cameraHeight + player.pos.z;

  const targetX = player.pos.x + Math.cos(player.angle);
  const targetY = player.pos.y + Math.sin(player.angle);
  const targetZ =  (windowHeight / 10) + player.pos.z;

  camera(camX, camY, camZ, targetX, targetY, targetZ, 0, 0, -1);
}

function touchStarted() {
  return false;
}

function touchMoved() {
  return false;
}

function touchEnded() {
  return false;
}

function mousePressed() {
  if (isMouseSuppressed()) {
    return false;
  }
  beginDrag(mouseX, mouseY);
  return false;
}

function mouseDragged() {
  if (isMouseSuppressed()) {
    return false;
  }
  updateDrag(mouseX, mouseY);
  return false;
}

function mouseReleased() {
  if (isMouseSuppressed()) {
    return false;
  }
  endDrag();
  return false;
}
