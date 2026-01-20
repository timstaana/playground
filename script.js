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
const showTouchDebug = false;
const showJoystick = true;
const SHADOW_ALPHA = 130;
const SPAWN_POINT = { x: 0, y: 0, z: 160 };
let debugLayer = null;
let mainCanvas = null;
let editorOverlay = null;
const editor = {
  active: false,
  selection: null,
  hover: null,
  defaults: {
    w: 120,
    d: 120,
    h: 40,
    color: [90, 70, 40],
  },
  camera: {
    yaw: Math.PI * 0.25,
    pitch: 0.6,
    distance: 620,
    target: { x: 0, y: 0, z: 40 },
    fov: Math.PI / 3,
    position: { x: 0, y: 0, z: 0 },
  },
  drag: {
    active: false,
    mode: null,
    startX: 0,
    startY: 0,
    startYaw: 0,
    startPitch: 0,
    startTarget: { x: 0, y: 0, z: 0 },
    offset: { x: 0, y: 0, z: 0 },
    planeZ: 0,
    resizeAxis: null,
    resizeSign: 1,
    startBounds: null,
  },
  grid: {
    size: 1200,
    step: 40,
  },
  handles: {
    size: 18,
    offset: 8,
  },
};

async function setup() {
  mainCanvas = createCanvas(windowWidth, windowHeight, WEBGL);

  font = await loadFont('opensans.ttf');
  textFont(font);


  if (mainCanvas?.elt) {
    mainCanvas.elt.addEventListener('contextmenu', (event) => event.preventDefault());
  }
  if (showTouchDebug || showJoystick) {
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
  if (!editorOverlay) {
    editorOverlay = createGraphics(windowWidth, windowHeight);
    editorOverlay.pixelDensity(pixelDensity());
    const overlayCanvas = editorOverlay.elt;
    overlayCanvas.style.position = 'absolute';
    overlayCanvas.style.left = '0';
    overlayCanvas.style.top = '0';
    overlayCanvas.style.display = 'block';
    overlayCanvas.style.pointerEvents = 'none';
    overlayCanvas.style.zIndex = '9';
    const parent = mainCanvas.elt.parentNode || document.body;
    parent.appendChild(overlayCanvas);
  }
  setupTouchEvents();
  resetPlayerToSpawn();
  loadLevel();
}

function draw() {
  background(18);
  perspective(editor.camera.fov, width / height, 1, 5000);

  if (editor.active) {
    updateEditor();
  } else {
    if (editorOverlay) editorOverlay.clear();
    updatePlayer();
    updateCamera();
    drawPlatforms();
    drawShadow();
    drawPlatformShadows();
    drawPlayer();
  }
  if ((showTouchDebug || showJoystick) && !editor.active) drawTouchOverlay();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  if (debugLayer) {
    debugLayer.resizeCanvas(windowWidth, windowHeight);
    debugLayer.pixelDensity(pixelDensity());
    debugLayer.elt.style.width = `${windowWidth}px`;
    debugLayer.elt.style.height = `${windowHeight}px`;
  }
  if (editorOverlay) {
    editorOverlay.resizeCanvas(windowWidth, windowHeight);
    editorOverlay.pixelDensity(pixelDensity());
    editorOverlay.elt.style.width = `${windowWidth}px`;
    editorOverlay.elt.style.height = `${windowHeight}px`;
  }
}

function setEditorActive(active) {
  editor.active = active;
  editor.drag.active = false;
  editor.drag.mode = null;
  editor.drag.resizeAxis = null;
  editor.drag.resizeSign = 1;
  editor.drag.startBounds = null;
  editor.hover = null;
  if (active) {
    endDrag();
  }
}

function updateEditor() {
  updateEditorCamera();
  updateEditorHover();
  drawEditorGrid();
  drawPlatforms();
  drawShadow();
  drawPlatformShadows();
  drawPlayer();
  drawEditorSelection();
  drawEditorOverlay();
}

function updateEditorCamera() {
  const position = getEditorCameraPosition();
  editor.camera.position = position;
  camera(
    position.x,
    position.y,
    position.z,
    editor.camera.target.x,
    editor.camera.target.y,
    editor.camera.target.z,
    0,
    0,
    -1
  );
}

function getEditorCameraPosition() {
  const { yaw, pitch, distance, target } = editor.camera;
  const cosPitch = Math.cos(pitch);
  return {
    x: target.x + Math.cos(yaw) * cosPitch * distance,
    y: target.y + Math.sin(yaw) * cosPitch * distance,
    z: target.z + Math.sin(pitch) * distance,
  };
}

function getEditorRay(screenX, screenY) {
  const position = getEditorCameraPosition();
  editor.camera.position = position;
  const target = editor.camera.target;
  const up = createVector(0, 0, -1);
  const forward = createVector(
    target.x - position.x,
    target.y - position.y,
    target.z - position.z
  ).normalize();
  const right = p5.Vector.cross(forward, up).normalize();
  const trueUp = p5.Vector.cross(right, forward).normalize();

  const ndcX = (screenX / width) * 2 - 1;
  const ndcY = (screenY / height) * 2 - 1;
  const aspect = width / height;
  const tanFov = Math.tan(editor.camera.fov * 0.5);

  const rayDir = createVector(0, 0, 0);
  rayDir.add(p5.Vector.mult(right, ndcX * tanFov * aspect));
  rayDir.add(p5.Vector.mult(trueUp, ndcY * tanFov));
  rayDir.add(forward);
  rayDir.normalize();

  return { origin: position, dir: rayDir };
}

function updateEditorHover() {
  if (editor.drag.active) return;
  const ray = getEditorRay(mouseX, mouseY);
  const hit = pickPlatform(ray);
  editor.hover = hit ? hit.collider : null;
}

function drawEditorGrid() {
  const size = editor.grid.size;
  const step = editor.grid.step;
  push();
  stroke(200, 200, 220, 70);
  strokeWeight(1);
  for (let x = -size; x <= size; x += step) {
    line(x, -size, 0, x, size, 0);
  }
  for (let y = -size; y <= size; y += step) {
    line(-size, y, 0, size, y, 0);
  }
  stroke(200, 80, 80, 180);
  line(-size, 0, 0, size, 0, 0);
  stroke(80, 200, 120, 180);
  line(0, -size, 0, 0, size, 0);
  pop();
}

function drawEditorSelection() {
  if (editor.hover && editor.hover !== editor.selection) {
    drawPlatformOutline(editor.hover, [100, 180, 255, 160], 1.5);
  }
  if (editor.selection) {
    drawPlatformOutline(editor.selection, [255, 220, 120, 220], 2.5);
    drawResizeHandles(editor.selection);
  }
}

function drawPlatformOutline(platform, color, weight) {
  push();
  noFill();
  stroke(color[0], color[1], color[2], color[3]);
  strokeWeight(weight);
  translate(platform.center.x, platform.center.y, platform.center.z);
  box(platform.size.x, platform.size.y, platform.size.z);
  pop();
}

function getResizeHandles(platform) {
  const halfX = platform.size.x * 0.5;
  const halfY = platform.size.y * 0.5;
  const size = editor.handles.size;
  const offset = editor.handles.offset;

  return [
    {
      axis: 'x',
      sign: 1,
      center: {
        x: platform.center.x + halfX + offset,
        y: platform.center.y,
        z: platform.center.z,
      },
      size: { x: size, y: size, z: size },
    },
    {
      axis: 'x',
      sign: -1,
      center: {
        x: platform.center.x - halfX - offset,
        y: platform.center.y,
        z: platform.center.z,
      },
      size: { x: size, y: size, z: size },
    },
    {
      axis: 'y',
      sign: 1,
      center: {
        x: platform.center.x,
        y: platform.center.y + halfY + offset,
        z: platform.center.z,
      },
      size: { x: size, y: size, z: size },
    },
    {
      axis: 'y',
      sign: -1,
      center: {
        x: platform.center.x,
        y: platform.center.y - halfY - offset,
        z: platform.center.z,
      },
      size: { x: size, y: size, z: size },
    },
  ];
}

function drawResizeHandles(platform) {
  const handles = getResizeHandles(platform);
  for (const handle of handles) {
    push();
    noStroke();
    const isHot =
      editor.drag.mode === 'resize' &&
      editor.drag.resizeAxis === handle.axis &&
      editor.drag.resizeSign === handle.sign;
    if (isHot) {
      fill(255, 200, 120, 220);
    } else {
      fill(120, 200, 255, 200);
    }
    translate(handle.center.x, handle.center.y, handle.center.z);
    box(handle.size.x, handle.size.y, handle.size.z);
    pop();
  }
}

function pickResizeHandle(ray, platform) {
  const handles = getResizeHandles(platform);
  let closest = null;
  let closestT = Infinity;

  for (const handle of handles) {
    const halfX = handle.size.x * 0.5;
    const halfY = handle.size.y * 0.5;
    const halfZ = handle.size.z * 0.5;
    const min = {
      x: handle.center.x - halfX,
      y: handle.center.y - halfY,
      z: handle.center.z - halfZ,
    };
    const max = {
      x: handle.center.x + halfX,
      y: handle.center.y + halfY,
      z: handle.center.z + halfZ,
    };
    const t = rayAabbIntersection(ray, min, max);
    if (t === null || t >= closestT) continue;
    closestT = t;
    closest = handle;
  }

  return closest;
}

function drawEditorOverlay() {
  if (!editorOverlay) return;
  editorOverlay.clear();
  editorOverlay.noStroke();
  editorOverlay.rectMode(CORNER);
  editorOverlay.fill(10, 10, 10, 160);
  editorOverlay.textSize(12);
  editorOverlay.textLeading(16);
  const lines = [
    'Edit mode (E):',
    'Left click add/select, drag to move',
    'Drag side handles to resize',
    'Right drag orbit, middle drag pan',
    'Wheel zoom, Shift+wheel move Z, Alt+wheel height',
    'Ctrl/Cmd+wheel footprint size',
    'Delete/Backspace or X removes selected',
    'Press P to export level.json',
  ];
  const boxHeight = 24 + lines.length * 16;
  editorOverlay.rect(12, 12, 320, boxHeight, 6);
  editorOverlay.fill(255);
  editorOverlay.text(lines.join('\n'), 22, 30);
}

function rayPlaneIntersection(ray, planeZ) {
  const denom = ray.dir.z;
  if (Math.abs(denom) < 0.0001) return null;
  const t = (planeZ - ray.origin.z) / denom;
  if (t < 0) return null;
  return {
    x: ray.origin.x + ray.dir.x * t,
    y: ray.origin.y + ray.dir.y * t,
    z: planeZ,
  };
}

function rayAabbIntersection(ray, min, max) {
  let tMin = -Infinity;
  let tMax = Infinity;

  const axes = ['x', 'y', 'z'];
  for (const axis of axes) {
    const origin = ray.origin[axis];
    const dir = ray.dir[axis];
    if (Math.abs(dir) < 0.0001) {
      if (origin < min[axis] || origin > max[axis]) return null;
      continue;
    }
    const t1 = (min[axis] - origin) / dir;
    const t2 = (max[axis] - origin) / dir;
    const near = Math.min(t1, t2);
    const far = Math.max(t1, t2);
    tMin = Math.max(tMin, near);
    tMax = Math.min(tMax, far);
    if (tMin > tMax) return null;
  }

  if (tMax < 0) return null;
  return tMin >= 0 ? tMin : tMax;
}

function pickPlatform(ray) {
  let closest = null;
  let closestT = Infinity;
  let hitPoint = null;

  for (const collider of colliders) {
    if (collider.type !== 'box') continue;
    const halfX = collider.size.x * 0.5;
    const halfY = collider.size.y * 0.5;
    const halfZ = collider.size.z * 0.5;
    const min = {
      x: collider.center.x - halfX,
      y: collider.center.y - halfY,
      z: collider.center.z - halfZ,
    };
    const max = {
      x: collider.center.x + halfX,
      y: collider.center.y + halfY,
      z: collider.center.z + halfZ,
    };
    const t = rayAabbIntersection(ray, min, max);
    if (t === null || t >= closestT) continue;
    closestT = t;
    closest = collider;
    hitPoint = {
      x: ray.origin.x + ray.dir.x * t,
      y: ray.origin.y + ray.dir.y * t,
      z: ray.origin.z + ray.dir.z * t,
    };
  }

  if (!closest) return null;
  return { collider: closest, point: hitPoint, t: closestT };
}

function clampValue(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function resetPlayerToSpawn() {
  player.pos.x = SPAWN_POINT.x;
  player.pos.y = SPAWN_POINT.y;
  player.pos.z = SPAWN_POINT.z;
  player.vel.z = 0;
  player.onGround = false;
  player.jumping = false;
  player.jumpHeld = false;
  player.jumpHoldTime = 0;
  player.coyoteTimer = 0;
  player.jumpBufferTimer = 0;
}

function snapToGrid(value) {
  const step = editor.grid.step;
  return Math.round(value / step) * step;
}

function snapToGridSize(value) {
  const step = editor.grid.step;
  const snapped = Math.round(value / step) * step;
  return Math.max(step, snapped);
}

function snapBaseToGrid(centerZ, height, delta) {
  const baseZ = centerZ - height * 0.5 + delta;
  const snappedBase = snapToGrid(baseZ);
  return snappedBase + height * 0.5;
}

function snapCenterToGrid(center, size) {
  const half = size * 0.5;
  const minEdge = center - half;
  return snapToGrid(minEdge) + half;
}

function exportLevel() {
  const platforms = colliders
    .filter((collider) => collider.type === 'box')
    .map((collider) => ({
      x: collider.center.x,
      y: collider.center.y,
      z: collider.center.z - collider.size.z * 0.5,
      w: collider.size.x,
      d: collider.size.y,
      h: collider.size.z,
      color: collider.color,
    }));

  const data = { platforms };
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'level.json';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  console.log('Level exported', data);
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
  if (editor.active) return;
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
  if (editor.active) return;
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
  if (editor.active) return;
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

function drawTouchOverlay() {
  if (!debugLayer) return;
  debugLayer.clear();

  if (showTouchDebug) {
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

    for (const [id, pos] of touchInput.active.entries()) {
      const isPrimary = id === touchInput.primaryId;
      debugLayer.fill(isPrimary ? 255 : 0, isPrimary ? 80 : 200, 80, 200);
      debugLayer.ellipse(pos.x, pos.y, 26, 26);
      debugLayer.fill(0);
      debugLayer.text(String(id), pos.x + 14, pos.y + 4);
    }
  }

  if (showJoystick && dragInput.active && touchInput.primaryId !== null) {
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

  if (player.pos.z <= -100) {
    resetPlayerToSpawn();
  }
}

function drawPlayer() {
  noStroke();

  normalMaterial();
  rectMode(CENTER);

  push();
  translate(player.pos.x, player.pos.y, player.size * 0.75 + player.pos.z);
  rotateZ(player.angle);
  box(player.size, player.size, player.size * 1.5);
  pop();

  const labelX = player.pos.x;
  const labelY = player.pos.y;
  const labelZ = player.pos.z + player.size * 1.6;

  let camX;
  let camY;
  let camZ;
  if (editor.active) {
    camX = editor.camera.position.x;
    camY = editor.camera.position.y;
    camZ = editor.camera.position.z;
  } else {
    const cameraDistance = 220;
    const cameraHeight = 120;
    camX = player.pos.x - Math.cos(player.angle) * cameraDistance;
    camY = player.pos.y - Math.sin(player.angle) * cameraDistance;
    camZ = cameraHeight + player.pos.z;
  }

  const dx = camX - labelX;
  const dy = camY - labelY;
  const dz = camZ - labelZ;
  const distance = Math.hypot(dx, dy, dz);

  push();
  translate(labelX, labelY, labelZ);
  if (distance > 0.0001) {
    const yaw = Math.atan2(dy, dx);
    const pitch = Math.acos(clampValue(dz / distance, -1, 1));
    rotateZ(yaw);
    rotateY(pitch);
    rotateZ(-Math.PI / 2);
  }

  fill(255);
  textAlign(CENTER, CENTER);
  textSize(12);
  text(
    `x:${player.pos.x.toFixed(1)} y:${player.pos.y.toFixed(1)} z:${player.pos.z.toFixed(1)}`,
    0,
    0
  );
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
    fill(0, SHADOW_ALPHA);
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

      push();
      translate(0, 0, receiverTopZ + 0.06);
      noStroke();
      fill(0, SHADOW_ALPHA);
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
  const platform = {
    type: 'box',
    center: { x, y, z: z + h * 0.5 },
    size: { x: w, y: d, z: h },
    color,
  };
  colliders.push(platform);
  return platform;
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
    editor.selection = null;

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

function handleEditorMousePressed(event) {
  editor.drag.active = true;
  editor.drag.startX = mouseX;
  editor.drag.startY = mouseY;

  const rightClick = (event && event.button === 2) || mouseButton === RIGHT;
  const middleClick = (event && event.button === 1) || mouseButton === CENTER;

  if (rightClick) {
    editor.drag.mode = 'orbit';
    editor.drag.startYaw = editor.camera.yaw;
    editor.drag.startPitch = editor.camera.pitch;
    return;
  }

  if (middleClick) {
    editor.drag.mode = 'pan';
    editor.drag.startTarget = { ...editor.camera.target };
    return;
  }

  const ray = getEditorRay(mouseX, mouseY);
  if (editor.selection) {
    const handle = pickResizeHandle(ray, editor.selection);
    if (handle) {
      const halfX = editor.selection.size.x * 0.5;
      const halfY = editor.selection.size.y * 0.5;
      editor.drag.mode = 'resize';
      editor.drag.resizeAxis = handle.axis;
      editor.drag.resizeSign = handle.sign;
      editor.drag.planeZ = editor.selection.center.z;
      editor.drag.startBounds = {
        minX: editor.selection.center.x - halfX,
        maxX: editor.selection.center.x + halfX,
        minY: editor.selection.center.y - halfY,
        maxY: editor.selection.center.y + halfY,
      };
      return;
    }
  }
  const hit = pickPlatform(ray);
  if (hit) {
    editor.selection = hit.collider;
    editor.drag.mode = 'move';
    editor.drag.offset = {
      x: hit.point.x - hit.collider.center.x,
      y: hit.point.y - hit.collider.center.y,
      z: hit.point.z - hit.collider.center.z,
    };
    editor.drag.planeZ = hit.collider.center.z;
    return;
  }

  const groundHit = rayPlaneIntersection(ray, 0);
  if (groundHit) {
    const snappedX = snapCenterToGrid(groundHit.x, editor.defaults.w);
    const snappedY = snapCenterToGrid(groundHit.y, editor.defaults.d);
    const platform = addPlatform(
      snappedX,
      snappedY,
      0,
      editor.defaults.w,
      editor.defaults.d,
      editor.defaults.h,
      editor.defaults.color
    );
    editor.selection = platform;
    editor.drag.mode = 'move';
    editor.drag.offset = { x: 0, y: 0, z: 0 };
    editor.drag.planeZ = platform.center.z;
  } else {
    editor.drag.mode = null;
  }
}

function handleEditorMouseDragged() {
  if (!editor.drag.active) return;
  const dx = mouseX - editor.drag.startX;
  const dy = mouseY - editor.drag.startY;
  editor.camera.position = getEditorCameraPosition();

  if (editor.drag.mode === 'orbit') {
    editor.camera.yaw = editor.drag.startYaw - dx * 0.005;
    editor.camera.pitch = clampValue(editor.drag.startPitch - dy * 0.005, 0.2, 1.35);
    return;
  }

  if (editor.drag.mode === 'pan') {
    const position = editor.camera.position;
    const target = editor.camera.target;
    const forward = createVector(
      target.x - position.x,
      target.y - position.y,
      target.z - position.z
    ).normalize();
    const right = p5.Vector.cross(forward, createVector(0, 0, -1)).normalize();
    const flatForward = createVector(forward.x, forward.y, 0);
    if (flatForward.magSq() > 0.0001) flatForward.normalize();
    const flatRight = createVector(right.x, right.y, 0);
    if (flatRight.magSq() > 0.0001) flatRight.normalize();
    const scale = editor.camera.distance * 0.002;
    editor.camera.target.x =
      editor.drag.startTarget.x - dx * scale * flatRight.x - dy * scale * flatForward.x;
    editor.camera.target.y =
      editor.drag.startTarget.y - dx * scale * flatRight.y - dy * scale * flatForward.y;
    return;
  }

  if (editor.drag.mode === 'move' && editor.selection) {
    const ray = getEditorRay(mouseX, mouseY);
    const hit = rayPlaneIntersection(ray, editor.drag.planeZ);
    if (!hit) return;
    const targetX = hit.x - editor.drag.offset.x;
    const targetY = hit.y - editor.drag.offset.y;
    editor.selection.center.x = snapCenterToGrid(targetX, editor.selection.size.x);
    editor.selection.center.y = snapCenterToGrid(targetY, editor.selection.size.y);
    return;
  }

  if (editor.drag.mode === 'resize' && editor.selection && editor.drag.startBounds) {
    const ray = getEditorRay(mouseX, mouseY);
    const hit = rayPlaneIntersection(ray, editor.drag.planeZ);
    if (!hit) return;
    const bounds = editor.drag.startBounds;
    const minSize = editor.grid.step;

    if (editor.drag.resizeAxis === 'x') {
      if (editor.drag.resizeSign > 0) {
        const rawWidth = hit.x - bounds.minX;
        const width = Math.max(minSize, snapToGridSize(rawWidth));
        const maxX = bounds.minX + width;
        editor.selection.size.x = width;
        editor.selection.center.x = (bounds.minX + maxX) * 0.5;
      } else {
        const rawWidth = bounds.maxX - hit.x;
        const width = Math.max(minSize, snapToGridSize(rawWidth));
        const minX = bounds.maxX - width;
        editor.selection.size.x = width;
        editor.selection.center.x = (minX + bounds.maxX) * 0.5;
      }
    } else if (editor.drag.resizeAxis === 'y') {
      if (editor.drag.resizeSign > 0) {
        const rawDepth = hit.y - bounds.minY;
        const depth = Math.max(minSize, snapToGridSize(rawDepth));
        const maxY = bounds.minY + depth;
        editor.selection.size.y = depth;
        editor.selection.center.y = (bounds.minY + maxY) * 0.5;
      } else {
        const rawDepth = bounds.maxY - hit.y;
        const depth = Math.max(minSize, snapToGridSize(rawDepth));
        const minY = bounds.maxY - depth;
        editor.selection.size.y = depth;
        editor.selection.center.y = (minY + bounds.maxY) * 0.5;
      }
    }
  }
}

function handleEditorMouseReleased() {
  editor.drag.active = false;
  editor.drag.mode = null;
  editor.drag.resizeAxis = null;
  editor.drag.resizeSign = 1;
  editor.drag.startBounds = null;
}

function deleteSelectedPlatform() {
  if (!editor.selection) return;
  const index = colliders.indexOf(editor.selection);
  if (index >= 0) colliders.splice(index, 1);
  editor.selection = null;
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

function keyPressed() {
  if (key === 'e' || key === 'E') {
    setEditorActive(!editor.active);
    return false;
  }
  if (editor.active && (key === 'p' || key === 'P')) {
    exportLevel();
    return false;
  }
  if (editor.active && (key === 'x' || key === 'X')) {
    deleteSelectedPlatform();
    return false;
  }
  if (editor.active && (keyCode === BACKSPACE || keyCode === DELETE)) {
    deleteSelectedPlatform();
    return false;
  }
  return true;
}

function mousePressed(event) {
  if (editor.active) {
    handleEditorMousePressed(event);
    return false;
  }
  if (isMouseSuppressed()) {
    return false;
  }
  beginDrag(mouseX, mouseY);
  return false;
}

function mouseDragged() {
  if (editor.active) {
    handleEditorMouseDragged();
    return false;
  }
  if (isMouseSuppressed()) {
    return false;
  }
  updateDrag(mouseX, mouseY);
  return false;
}

function mouseReleased() {
  if (editor.active) {
    handleEditorMouseReleased();
    return false;
  }
  if (isMouseSuppressed()) {
    return false;
  }
  endDrag();
  return false;
}

function mouseWheel(event) {
  if (!editor.active) return false;
  if (editor.selection && event.shiftKey) {
    const delta = -event.deltaY * 0.2;
    const minZ = editor.selection.size.z * 0.5;
    const snapped = snapBaseToGrid(editor.selection.center.z, editor.selection.size.z, delta);
    editor.selection.center.z = Math.max(minZ, snapped);
    return false;
  }
  if (editor.selection && event.altKey) {
    const delta = -event.deltaY * 0.2;
    const baseZ = editor.selection.center.z - editor.selection.size.z * 0.5;
    const nextHeight = snapToGridSize(editor.selection.size.z + delta);
    editor.selection.size.z = nextHeight;
    editor.selection.center.z = baseZ + nextHeight * 0.5;
    return false;
  }
  if (editor.selection && (event.ctrlKey || event.metaKey)) {
    const delta = -event.deltaY * 0.2;
    const next = snapToGridSize(editor.selection.size.x + delta);
    editor.selection.size.x = next;
    editor.selection.size.y = next;
    editor.selection.center.x = snapCenterToGrid(editor.selection.center.x, next);
    editor.selection.center.y = snapCenterToGrid(editor.selection.center.y, next);
    return false;
  }

  editor.camera.distance = clampValue(editor.camera.distance + event.deltaY, 140, 2400);
  return false;
}
