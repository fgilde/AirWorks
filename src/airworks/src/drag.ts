
export type DragSession = { x: number; y: number; source: HTMLElement; ghost: HTMLElement };

export type DragHandlers = {
  move: (session: DragSession) => void;
  drop: (session: DragSession) => void;
  cancel: (session: DragSession) => void;
};

const THRESHOLD = 6;

export function draggable(element: HTMLElement, begin: (session: DragSession) => DragHandlers | undefined) {
  element.style.touchAction = 'none';
  element.addEventListener('dragstart', (event) => event.preventDefault());
  element.addEventListener('pointerdown', (down) => {
    if (down.button !== 0 || (down.target as Element).closest('input, textarea')) return;
    let session: DragSession | undefined;
    let handlers: DragHandlers | undefined;
    let offset = { x: 0, y: 0 };

    const position = (event: PointerEvent) => {
      session!.x = event.clientX;
      session!.y = event.clientY;
      session!.ghost.style.transform = `translate(${event.clientX - offset.x}px, ${event.clientY - offset.y}px)`;
    };
    const move = (event: PointerEvent) => {
      if (!session) {
        if (Math.hypot(event.clientX - down.clientX, event.clientY - down.clientY) < THRESHOLD) return;
        const rect = element.getBoundingClientRect();
        offset = { x: down.clientX - rect.left, y: down.clientY - rect.top };
        const ghost = element.cloneNode(true) as HTMLElement;
        ghost.classList.add('aw-drag-ghost');
        ghost.removeAttribute('id');
        Object.assign(ghost.style, { position: 'fixed', left: '0', top: '0', margin: '0', width: `${rect.width}px`, height: `${rect.height}px` });
        session = { x: event.clientX, y: event.clientY, source: element, ghost };
        handlers = begin(session);
        if (!handlers) { session = undefined; stop(); return; }
        (element.closest('air-desktop') ?? document.body).append(ghost);
        element.classList.add('aw-drag-source');
      }
      position(event);
      handlers!.move(session);
    };
    const finish = (event: Event, cancelled: boolean) => {
      stop();
      if (!session || !handlers) return;
      if (event instanceof PointerEvent) position(event);
      session.ghost.remove();
      element.classList.remove('aw-drag-source');
      if (cancelled) handlers.cancel(session); else handlers.drop(session);
      const swallow = (click: Event) => { click.stopPropagation(); click.preventDefault(); };
      window.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0);
    };
    const up = (event: PointerEvent) => finish(event, false);
    const cancel = (event: Event) => finish(event, true);
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') cancel(event); };
    function stop() {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('keydown', key);
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('keydown', key);
  });
}
