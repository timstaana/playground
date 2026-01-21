class CollisionWorld {
  constructor(options = {}) {
    this.platforms = [];
    this.shadowAlpha = options.shadowAlpha ?? 130;
  }

  addPlatform(x, y, z, w, d, h, color) {
    const platform = new Platform(x, y, z, w, d, h, color);
    this.platforms.push(platform);
    return platform;
  }

  clearPlatforms() {
    this.platforms.length = 0;
  }

  removePlatform(platform) {
    const index = this.platforms.indexOf(platform);
    if (index >= 0) this.platforms.splice(index, 1);
  }

  forEachPlatform(callback) {
    for (const platform of this.platforms) {
      if (platform.type !== 'box') continue;
      callback(platform, platform.getBounds());
    }
  }

  pickPlatform(ray) {
    let closest = null;
    let closestT = Infinity;
    let hitPoint = null;

    this.forEachPlatform((collider, bounds) => {
      const t = CollisionWorld.rayAabbIntersection(ray, bounds.min, bounds.max);
      if (t === null || t >= closestT) return;
      closestT = t;
      closest = collider;
      hitPoint = {
        x: ray.origin.x + ray.dir.x * t,
        y: ray.origin.y + ray.dir.y * t,
        z: ray.origin.z + ray.dir.z * t,
      };
    });

    if (!closest) return null;
    return { collider: closest, point: hitPoint, t: closestT };
  }

  resolvePlayerCollisions(playerInstance) {
    playerInstance.onGround = false;

    const scale = playerInstance.unitScale ?? 1;
    const halfX = playerInstance.size * 0.5 * scale;
    const halfY = playerInstance.size * 0.5 * scale;
    const halfZ = playerInstance.height * 0.5 * scale;
    const center = {
      x: playerInstance.pos.x * scale,
      y: playerInstance.pos.y * scale,
      z: playerInstance.pos.z * scale + halfZ,
    };

    this.forEachPlatform((collider, bounds) => {
      const dx = center.x - collider.center.x;
      const dy = center.y - collider.center.y;
      const dz = center.z - collider.center.z;
      const overlapX = bounds.half.x + halfX - Math.abs(dx);
      const overlapY = bounds.half.y + halfY - Math.abs(dy);
      const overlapZ = bounds.half.z + halfZ - Math.abs(dz);

      if (overlapX <= 0 || overlapY <= 0 || overlapZ <= 0) return;

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
          playerInstance.onGround = true;
          if (playerInstance.vel.z < 0) playerInstance.vel.z = 0;
        } else if (playerInstance.vel.z > 0) {
          playerInstance.vel.z = 0;
        }
      }
    });

    playerInstance.pos.x = center.x / scale;
    playerInstance.pos.y = center.y / scale;
    playerInstance.pos.z = (center.z - halfZ) / scale;
  }

  getShadowSurfaces(x, y, playerBottomZ, playerSize) {
    const baseSize = playerSize * 1.5;
    const surfaces = [];

    this.forEachPlatform((collider, bounds) => {
      const topZ = bounds.topZ;

      if (topZ > playerBottomZ + 0.1) return;

      const height = Math.max(0, playerBottomZ - topZ);
      const scale = Math.max(0.35, 1 - height / 320);
      const radius = baseSize * scale * 0.5;

      if (
        !CollisionWorld.circleIntersectsRect(
          x,
          y,
          radius,
          collider.center,
          bounds.half.x,
          bounds.half.y
        )
      ) {
        return;
      }

      surfaces.push({ collider, topZ, radius });
    });

    surfaces.sort((a, b) => b.topZ - a.topZ);
    return surfaces;
  }

  drawPlatforms() {
    this.forEachPlatform((platform) => {
      platform.draw();
    });
  }

  drawPlatformShadows() {
    const maxShadowDrop = 320;

    this.forEachPlatform((caster, casterBounds) => {
      const casterMinX = casterBounds.min.x;
      const casterMaxX = casterBounds.max.x;
      const casterMinY = casterBounds.min.y;
      const casterMaxY = casterBounds.max.y;
      const casterBottomZ = casterBounds.bottomZ;

      this.forEachPlatform((receiver, receiverBounds) => {
        if (receiver === caster) return;
        const receiverTopZ = receiverBounds.topZ;
        if (receiverTopZ >= casterBottomZ - 0.01) return;

        const height = casterBottomZ - receiverTopZ;
        if (height > maxShadowDrop) return;

        const minX = Math.max(casterMinX, receiverBounds.min.x);
        const maxX = Math.min(casterMaxX, receiverBounds.max.x);
        const minY = Math.max(casterMinY, receiverBounds.min.y);
        const maxY = Math.min(casterMaxY, receiverBounds.max.y);
        if (minX >= maxX || minY >= maxY) return;

        push();
        translate(0, 0, receiverTopZ + 0.06);
        noStroke();
        fill(0, this.shadowAlpha);
        beginShape();
        vertex(minX, minY, 0);
        vertex(minX, maxY, 0);
        vertex(maxX, maxY, 0);
        vertex(maxX, minY, 0);
        endShape(CLOSE);
        pop();
      });
    });
  }

  static circleIntersectsRect(cx, cy, r, rectCenter, halfX, halfY) {
    const dx = Math.max(Math.abs(cx - rectCenter.x) - halfX, 0);
    const dy = Math.max(Math.abs(cy - rectCenter.y) - halfY, 0);
    return dx * dx + dy * dy <= r * r;
  }

  static rayAabbIntersection(ray, min, max) {
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
}
