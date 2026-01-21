class CameraController {
  constructor(world, options = {}) {
    this.world = world;
    this.fov = options.fov ?? Math.PI / 3;
    this.lerpRate = options.lerpRate ?? 8;
    this.obstructionBuffer = options.obstructionBuffer ?? UNIT * 0.2;
    this.maxObstructionShift = options.maxObstructionShift ?? UNIT * 3;
    this.state = { position: null, target: null };
  }

  applyPerspective(near = 1, far = 5000) {
    perspective(this.fov, width / height, near, far);
  }

  update(desired) {
    const resolved = this.resolveObstruction(desired.position, desired.target);
    const dt = deltaTime / 1000;
    const lerpT = 1 - Math.exp(-this.lerpRate * dt);

    if (!this.state.position) {
      this.state.position = { ...resolved.position };
      this.state.target = { ...desired.target };
    } else {
      this.state.position.x = CameraController.lerpValue(
        this.state.position.x,
        resolved.position.x,
        lerpT
      );
      this.state.position.y = CameraController.lerpValue(
        this.state.position.y,
        resolved.position.y,
        lerpT
      );
      this.state.position.z = CameraController.lerpValue(
        this.state.position.z,
        resolved.position.z,
        lerpT
      );
      this.state.target.x = CameraController.lerpValue(
        this.state.target.x,
        desired.target.x,
        lerpT
      );
      this.state.target.y = CameraController.lerpValue(
        this.state.target.y,
        desired.target.y,
        lerpT
      );
      this.state.target.z = CameraController.lerpValue(
        this.state.target.z,
        desired.target.z,
        lerpT
      );
    }

    camera(
      this.state.position.x,
      this.state.position.y,
      this.state.position.z,
      this.state.target.x,
      this.state.target.y,
      this.state.target.z,
      0,
      0,
      -1
    );

    return { position: this.state.position, target: this.state.target };
  }

  resolveObstruction(cameraPosition, targetPosition) {
    const initial = this.getOcclusion(cameraPosition, targetPosition);
    if (!initial.closest) {
      return { position: cameraPosition };
    }

    const aboveZ = initial.closest.bounds.max.z + this.obstructionBuffer;
    const belowZ = initial.closest.bounds.min.z - this.obstructionBuffer;
    const candidates = [aboveZ, belowZ];

    let bestPosition = cameraPosition;
    let bestCount = initial.occluders.length;
    let bestMove = Infinity;

    for (const candidateZ of candidates) {
      const delta = candidateZ - cameraPosition.z;
      if (Math.abs(delta) < 0.001) continue;
      const clampedDelta =
        Math.sign(delta) * Math.min(Math.abs(delta), this.maxObstructionShift);
      const testPosition = {
        x: cameraPosition.x,
        y: cameraPosition.y,
        z: cameraPosition.z + clampedDelta,
      };
      const occlusion = this.getOcclusion(testPosition, targetPosition);
      const move = Math.abs(clampedDelta);
      if (
        occlusion.occluders.length < bestCount ||
        (occlusion.occluders.length === bestCount && move < bestMove)
      ) {
        bestPosition = testPosition;
        bestCount = occlusion.occluders.length;
        bestMove = move;
        if (bestCount === 0) break;
      }
    }

    return { position: bestPosition };
  }

  getOcclusion(cameraPosition, targetPosition) {
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

    this.world.forEachPlatform((platform, bounds) => {
      if (CameraController.pointInsideBounds(targetPosition, bounds)) return;
      const t = CollisionWorld.rayAabbIntersection(ray, bounds.min, bounds.max);
      if (t === null || t <= 0.01 || t >= distance - 0.01) return;
      occluders.push(platform);
      if (!closest || t < closest.t) {
        closest = { platform, bounds, t };
      }
    });

    return { occluders, closest };
  }

  static pointInsideBounds(point, bounds) {
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

  static lerpValue(from, to, t) {
    return from + (to - from) * t;
  }
}
