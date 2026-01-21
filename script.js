const levelUrl = 'level.json';
const showTouchDebug = false;
const showJoystick = true;
const SHADOW_ALPHA = 130;
const SPAWN_POINT = { x: 0, y: 0, z: 4 };
const PLAYER_CAMERA_DISTANCE = 5.5;
const PLAYER_CAMERA_HEIGHT = 3;
const CAMERA_FOV = Math.PI / 3;
const CAMERA_LERP_RATE = 8;
const CAMERA_OBSTRUCTION_BUFFER = UNIT * 0.2;
const CAMERA_OBSTRUCTION_MAX_SHIFT = UNIT * 3;

const world = new CollisionWorld({ shadowAlpha: SHADOW_ALPHA });
const player = new Player(SPAWN_POINT, {
  cameraDistance: PLAYER_CAMERA_DISTANCE,
  cameraHeight: PLAYER_CAMERA_HEIGHT,
});

let debugLayer = null;
let mainCanvas = null;
let font = null;
let cameraState = { position: null, target: null };


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

  if (showTouchDebug || showJoystick) {
    debugLayer = createOverlayLayer(10);
  }
  touchControls.setup(mainCanvas);
  player.reset();
  loadLevel();
}

function draw() {
  background(18);
  perspective(CAMERA_FOV, width / height, 1, 5000);

  player.update(world);
  const cameraInfo = updateCamera();
  world.drawPlatforms();
  shadowRenderer.draw(world, player);
  world.drawPlatformShadows();
  player.draw(cameraInfo.position);

  if (showTouchDebug || showJoystick) {
    touchControls.drawOverlay(debugLayer, showTouchDebug, showJoystick);
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  resizeOverlayLayer(debugLayer);
}

function updateCamera() {
  const { position, target } = player.getCamera();
  const resolved = resolveCameraObstruction(position, target);
  const dt = deltaTime / 1000;
  const lerpT = 1 - Math.exp(-CAMERA_LERP_RATE * dt);
  if (!cameraState.position) {
    cameraState = {
      position: { ...resolved.position },
      target: { ...target },
    };
  } else {
    cameraState.position.x = lerpValue(cameraState.position.x, resolved.position.x, lerpT);
    cameraState.position.y = lerpValue(cameraState.position.y, resolved.position.y, lerpT);
    cameraState.position.z = lerpValue(cameraState.position.z, resolved.position.z, lerpT);
    cameraState.target.x = lerpValue(cameraState.target.x, target.x, lerpT);
    cameraState.target.y = lerpValue(cameraState.target.y, target.y, lerpT);
    cameraState.target.z = lerpValue(cameraState.target.z, target.z, lerpT);
  }
  camera(
    cameraState.position.x,
    cameraState.position.y,
    cameraState.position.z,
    cameraState.target.x,
    cameraState.target.y,
    cameraState.target.z,
    0,
    0,
    -1
  );
  return { position: cameraState.position, target: cameraState.target };
}

function resolveCameraObstruction(cameraPosition, targetPosition) {
  const initial = getCameraOcclusion(cameraPosition, targetPosition);
  if (!initial.closest) {
    return { position: cameraPosition, occluders: initial.occluders };
  }

  const aboveZ = initial.closest.bounds.max.z + CAMERA_OBSTRUCTION_BUFFER;
  const belowZ = initial.closest.bounds.min.z - CAMERA_OBSTRUCTION_BUFFER;
  const candidates = [aboveZ, belowZ];

  let bestPosition = cameraPosition;
  let bestOccluders = initial.occluders;
  let bestCount = initial.occluders.length;
  let bestMove = Infinity;

  for (const candidateZ of candidates) {
    const delta = candidateZ - cameraPosition.z;
    if (Math.abs(delta) < 0.001) continue;
    const clampedDelta =
      Math.sign(delta) * Math.min(Math.abs(delta), CAMERA_OBSTRUCTION_MAX_SHIFT);
    const testPosition = {
      x: cameraPosition.x,
      y: cameraPosition.y,
      z: cameraPosition.z + clampedDelta,
    };
    const occlusion = getCameraOcclusion(testPosition, targetPosition);
    const move = Math.abs(clampedDelta);
    if (
      occlusion.occluders.length < bestCount ||
      (occlusion.occluders.length === bestCount && move < bestMove)
    ) {
      bestPosition = testPosition;
      bestOccluders = occlusion.occluders;
      bestCount = occlusion.occluders.length;
      bestMove = move;
      if (bestCount === 0) break;
    }
  }

  return { position: bestPosition, occluders: bestOccluders };
}

function getCameraOcclusion(cameraPosition, targetPosition) {
  const dx = cameraPosition.x - targetPosition.x;
  const dy = cameraPosition.y - targetPosition.y;
  const dz = cameraPosition.z - targetPosition.z;
  const distance = Math.hypot(dx, dy, dz);
  if (distance <= 0.0001) {
    return { occluders: [], closest: null };
  }
  const invDistance = 1 / distance;
  const ray = {
    origin: targetPosition,
    dir: { x: dx * invDistance, y: dy * invDistance, z: dz * invDistance },
  };
  const occluders = [];
  let closest = null;

  world.forEachPlatform((platform, bounds) => {
    if (pointInsideBounds(targetPosition, bounds)) return;
    const t = CollisionWorld.rayAabbIntersection(ray, bounds.min, bounds.max);
    if (t === null || t <= 0.01 || t >= distance - 0.01) return;
    occluders.push(platform);
    if (!closest || t < closest.t) {
      closest = { platform, bounds, t };
    }
  });

  return { occluders, closest };
}

function pointInsideBounds(point, bounds) {
  const padding = 0.01;
  return (
    point.x >= bounds.min.x - padding &&
    point.x <= bounds.max.x + padding &&
    point.y >= bounds.min.y - padding &&
    point.y <= bounds.max.y + padding &&
    point.z >= bounds.min.z - padding &&
    point.z <= bounds.max.z + padding
  );
}

function lerpValue(from, to, t) {
  return from + (to - from) * t;
}

async function loadLevel() {
  try {
    const response = await fetch(levelUrl, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Level load failed: ${response.status}`);
    const data = await response.json();
    world.clearPlatforms();

    if (Array.isArray(data.platforms)) {
      for (const platform of data.platforms) {
        const type = platform.type || 'box';
        if (type === 'ramp') {
          world.addRamp(
            platform.x || 0,
            platform.y || 0,
            platform.z || 0,
            platform.w || UNIT,
            platform.d || UNIT,
            platform.h || UNIT * 0.5,
            platform.axis || 'x',
            platform.dir ?? 1,
            platform.color
          );
        } else {
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
    }
  } catch (error) {
    // Keep the scene running if the level fails to load.
    console.error(error);
  }
}
