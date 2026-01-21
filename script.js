const levelUrl = 'level.json';
const showTouchDebug = false;
const showJoystick = true;
const SHADOW_ALPHA = 130;
const SPAWN_POINT = { x: 0, y: 0, z: 4 };
const PLAYER_CAMERA_DISTANCE = 5.5;
const PLAYER_CAMERA_HEIGHT = 3;
const CAMERA_FOV = Math.PI / 3;

const world = new CollisionWorld({ shadowAlpha: SHADOW_ALPHA });
const player = new Player(SPAWN_POINT, {
  cameraDistance: PLAYER_CAMERA_DISTANCE,
  cameraHeight: PLAYER_CAMERA_HEIGHT,
});

let debugLayer = null;
let mainCanvas = null;
let font = null;


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
  updateCamera();
  world.drawPlatforms();
  shadowRenderer.draw(world, player);
  world.drawPlatformShadows();
  player.draw();

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
  camera(position.x, position.y, position.z, target.x, target.y, target.z, 0, 0, -1);
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
