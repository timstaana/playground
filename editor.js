const levelUrl = 'level.json';
const SHADOW_ALPHA = 130;
const SPAWN_POINT = { x: 0, y: 0, z: 4 };
const PLAYER_CAMERA_DISTANCE = 5.5;
const PLAYER_CAMERA_HEIGHT = 3;

const world = new CollisionWorld({ shadowAlpha: SHADOW_ALPHA });
const player = new Player(SPAWN_POINT, {
  cameraDistance: PLAYER_CAMERA_DISTANCE,
  cameraHeight: PLAYER_CAMERA_HEIGHT,
});

let mainCanvas = null;
let editorOverlay = null;
let font = null;

const editor = {
  selection: null,
  hover: null,
  defaults: {
    w: 3 * UNIT,
    d: 3 * UNIT,
    h: UNIT,
    color: [90, 70, 40],
  },
  camera: {
    yaw: Math.PI * 0.25,
    pitch: 0.6,
    distance: 620,
    target: { x: 0, y: 0, z: UNIT },
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
    size: 30 * UNIT,
    step: UNIT,
  },
  handles: {
    size: 18,
    offset: 8,
  },
};

function getCanvasParent() {
  return mainCanvas?.elt?.parentNode || document.body;
}

function createOverlayLayer(zIndex) {
  const layer = createGraphics(windowWidth, windowHeight);
  layer.pixelDensity(pixelDensity());
  const canvas = layer.elt;
  canvas.style.position = 'absolute';
  canvas.style.left = '0';
  canvas.style.top = '0';
  canvas.style.display = 'block';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = String(zIndex);
  getCanvasParent().appendChild(canvas);
  return layer;
}

function resizeOverlayLayer(layer) {
  if (!layer) return;
  layer.resizeCanvas(windowWidth, windowHeight);
  layer.pixelDensity(pixelDensity());
  layer.elt.style.width = `${windowWidth}px`;
  layer.elt.style.height = `${windowHeight}px`;
}

async function setup() {
  mainCanvas = createCanvas(windowWidth, windowHeight, WEBGL);

  font = await loadFont('opensans.ttf');
  textFont(font);

  if (mainCanvas?.elt) {
    mainCanvas.elt.addEventListener('contextmenu', (event) => event.preventDefault());
  }
  if (!editorOverlay) {
    editorOverlay = createOverlayLayer(9);
  }
  player.reset();
  loadLevel();
}

function draw() {
  background(18);
  perspective(editor.camera.fov, width / height, 1, 5000);
  updateEditor();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  resizeOverlayLayer(editorOverlay);
}

function updateEditor() {
  updateEditorCamera();
  updateEditorHover();
  drawEditorGrid();
  world.drawPlatforms();
  shadowRenderer.draw(world, player);
  world.drawPlatformShadows();
  player.draw(editor.camera.position);
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
  const hit = world.pickPlatform(ray);
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
    const t = CollisionWorld.rayAabbIntersection(ray, min, max);
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
    'Edit mode:',
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

function clampValue(value, min, max) {
  return Math.min(max, Math.max(min, value));
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
  const platforms = world.platforms.map((platform) => platform.toJSON());

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

async function loadLevel() {
  try {
    const response = await fetch(levelUrl, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Level load failed: ${response.status}`);
    const data = await response.json();
    world.clearPlatforms();
    editor.selection = null;

    if (Array.isArray(data.platforms)) {
      for (const platform of data.platforms) {
        world.addPlatform(
          platform.x || 0,
          platform.y || 0,
          platform.z || 0,
          platform.w || UNIT,
          platform.d || UNIT,
          platform.h || UNIT * 0.5,
          platform.color
        );
      }
    }
  } catch (error) {
    // Keep the scene running if the level fails to load.
    console.error(error);
  }
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
  const hit = world.pickPlatform(ray);
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
    const platform = world.addPlatform(
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
  world.removePlatform(editor.selection);
  editor.selection = null;
}

function keyPressed() {
  if (key === 'p' || key === 'P') {
    exportLevel();
    return false;
  }
  if (key === 'x' || key === 'X') {
    deleteSelectedPlatform();
    return false;
  }
  if (keyCode === BACKSPACE || keyCode === DELETE) {
    deleteSelectedPlatform();
    return false;
  }
  return true;
}

function mousePressed(event) {
  handleEditorMousePressed(event);
  return false;
}

function mouseDragged() {
  handleEditorMouseDragged();
  return false;
}

function mouseReleased() {
  handleEditorMouseReleased();
  return false;
}

function mouseWheel(event) {
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
