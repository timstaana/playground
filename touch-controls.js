const touchControls = (() => {
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
  };

  const touchInput = {
    active: new Map(),
    primaryId: null,
  };

  let canvasEl = null;

  function setup(canvas) {
    canvasEl = canvas?.elt || null;
    if (!canvasEl) return;
    canvasEl.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvasEl.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvasEl.addEventListener('touchend', handleTouchEnd, { passive: false });
    canvasEl.addEventListener('touchcancel', handleTouchEnd, { passive: false });
  }

  function getTouchPoint(touch) {
    if (!touch) return { x: 0, y: 0 };
    if (touch.x !== undefined && touch.y !== undefined) {
      return { x: touch.x, y: touch.y };
    }
    const rect = canvasEl?.getBoundingClientRect
      ? canvasEl.getBoundingClientRect()
      : { left: 0, top: 0 };
    const x = (touch.clientX ?? touch.pageX ?? 0) - rect.left;
    const y = (touch.clientY ?? touch.pageY ?? 0) - rect.top;
    return { x, y };
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

  function beginDrag(x, y, id = null) {
    dragInput.active = true;
    dragInput.startX = x;
    dragInput.startY = y;
    dragInput.dx = 0;
    dragInput.dy = 0;
    dragInput.hasDirection = false;
    dragInput.pointerId = id;
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
  }

  function handleTouchStart(event) {
    event.preventDefault();
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
    refreshActiveTouches(event);
    if (touchInput.primaryId !== null && findChangedTouch(event, touchInput.primaryId)) {
      touchInput.primaryId = null;
      endDrag();
    }
  }

  function getTouchCount() {
    return touchInput.active.size;
  }

  function isActive() {
    return dragInput.active;
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

  function drawOverlay(layer, showTouchDebug, showJoystick) {
    if (!layer) return;
    layer.clear();

    if (showTouchDebug) {
      layer.noStroke();
      layer.textSize(12);
      layer.fill(255);
      const count = getTouchCount();
      layer.text(`touches: ${count}`, 12, 18);
      layer.text(`primaryId: ${touchInput.primaryId}`, 12, 34);
      layer.text(`dragId: ${dragInput.pointerId}`, 12, 50);
      layer.text(`dx/dy: ${dragInput.dx.toFixed(1)}, ${dragInput.dy.toFixed(1)}`, 12, 66);
      layer.text(`dir: ${dragInput.hasDirection}`, 12, 82);
      layer.text('mode: touch', 12, 98);
      for (const [id, pos] of touchInput.active.entries()) {
        const isPrimary = id === touchInput.primaryId;
        layer.fill(isPrimary ? 255 : 0, isPrimary ? 80 : 200, 80, 200);
        layer.ellipse(pos.x, pos.y, 26, 26);
        layer.fill(0);
        layer.text(String(id), pos.x + 14, pos.y + 4);
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

      layer.noStroke();
      layer.fill(255, 255, 255, 20);
      layer.ellipse(dragInput.startX, dragInput.startY, baseRadius * 2, baseRadius * 2);
      layer.fill(255, 255, 255, 140);
      layer.ellipse(knobX, knobY, knobRadius * 2, knobRadius * 2);
    }
  }

  return {
    setup,
    getTouchCount,
    isActive,
    getDragAxes,
    drawOverlay,
  };
})();
