const shadowRenderer = {
  draw(world, player, shadowAlpha = world?.shadowAlpha ?? 130) {
    const scale = player.unitScale ?? 1;
    const playerWorld = {
      x: player.pos.x * scale,
      y: player.pos.y * scale,
      z: player.pos.z * scale,
    };
    const playerSize = player.size * scale;
    const playerBottomZ = playerWorld.z;
    const surfaces = world.getShadowSurfaces(
      playerWorld.x,
      playerWorld.y,
      playerBottomZ,
      playerSize
    );
    if (surfaces.length === 0) return;

    for (const surface of surfaces) {
      const radius = surface.radius;
      const localX = playerWorld.x - surface.collider.center.x;
      const localY = playerWorld.y - surface.collider.center.y;
      const halfX = surface.collider.size.x * 0.5;
      const halfY = surface.collider.size.y * 0.5;
      const shape = clipCircleToRect(localX, localY, radius, halfX, halfY);
      if (shape.length < 3) continue;

      const occluderShapes = [];
      world.forEachPlatform((other, otherBounds) => {
        if (other === surface.collider) return;

        const otherTopZ = otherBounds.topZ;
        if (otherTopZ <= surface.topZ + 0.01) return;
        if (otherTopZ > playerBottomZ + 0.1) return;

        if (
          !CollisionWorld.circleIntersectsRect(
          playerWorld.x,
          playerWorld.y,
            radius,
            other.center,
            otherBounds.half.x,
            otherBounds.half.y
          )
        ) {
          return;
        }

        const offsetX = other.center.x - surface.collider.center.x;
        const offsetY = other.center.y - surface.collider.center.y;
        const occluderLocal = clipCircleToRect(
          localX - offsetX,
          localY - offsetY,
          radius,
          otherBounds.half.x,
          otherBounds.half.y
        );
        if (occluderLocal.length < 3) return;
        occluderShapes.push(
          occluderLocal.map((point) => ({ x: point.x + offsetX, y: point.y + offsetY }))
        );
      });

      push();
      translate(surface.collider.center.x, surface.collider.center.y, surface.topZ + 0.1);
      noStroke();
      fill(0, shadowAlpha);
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
  },
};

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
