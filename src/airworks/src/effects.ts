export const effects = ['none', 'bubble', 'snow', 'starfield', 'warp', 'network', 'aurora'] as const;
export type Effect = typeof effects[number];

type Frame = (context: CanvasRenderingContext2D, width: number, height: number, time: number) => void;
type Point = { x: number; y: number; z: number; vx: number; vy: number; vz: number; size: number; alpha: number };

const random = (min: number, max: number) => min + Math.random() * (max - min);
const pointer = { x: 0, y: 0 };
window.addEventListener('pointermove', (event) => { pointer.x = event.clientX; pointer.y = event.clientY; });

const project = (point: Point, width: number, height: number, camera = { x: 0, y: 0 }) => {
  const focal = height * .65;
  const depth = 1000 - point.z;
  if (depth < 20) return undefined;
  const scale = focal / depth;
  return { x: width / 2 + (point.x - camera.x) * scale, y: height / 2 - (point.y - camera.y) * scale, scale };
};

const cloud = (count: number, spread = 1000): Point[] => Array.from({ length: count }, () => ({
  x: random(-spread, spread), y: random(-spread, spread), z: random(-spread, spread),
  vx: 0, vy: random(-3, -1), vz: 0, size: random(.6, 1.4), alpha: random(.4, 1),
}));

function bubbles(logo: string): Frame {
  const image = new Image();
  image.src = logo;
  const items = Array.from({ length: 8 }, () => ({ x: random(0, innerWidth), y: random(0, innerHeight), scale: random(.5, 2), alpha: random(.04, .12), vx: random(.25, 1) * Math.sign(random(-1, 1)), vy: random(.25, 1) * Math.sign(random(-1, 1)) }));
  return (context, width, height) => {
    if (!image.complete || !image.naturalWidth) return;
    for (const item of items) {
      const half = 64 * item.scale;
      if (item.x + half > width || item.x - half < 0) item.vx *= -1;
      if (item.y + half > height || item.y - half < 0) item.vy *= -1;
      item.x = Math.min(width - half, Math.max(half, item.x + item.vx));
      item.y = Math.min(height - half, Math.max(half, item.y + item.vy));
      context.globalAlpha = item.alpha;
      context.drawImage(image, item.x - half, item.y - half, half * 2, half * 2);
    }
    context.globalAlpha = 1;
  };
}

function snow(): Frame {
  const flakes = cloud(400);
  return (context, width, height, time) => {
    context.fillStyle = 'white';
    for (const flake of flakes) {
      flake.x += Math.sin(time / 1700 + flake.z) * .6;
      flake.y += flake.vy;
      flake.z += Math.cos(time / 2100 + flake.x) * .4;
      if (flake.y < -1000) flake.y += 2000;
      const screen = project(flake, width, height);
      if (!screen) continue;
      context.globalAlpha = flake.alpha * Math.min(1, screen.scale * 1.4);
      context.beginPath();
      context.arc(screen.x, screen.y, 3.5 * flake.size * screen.scale, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  };
}

function starfield(): Frame {
  const stars = cloud(200);
  const camera = { x: 0, y: 0 };
  return (context, width, height) => {
    camera.x += ((pointer.x - width / 2) - camera.x) * .05;
    camera.y += (-(pointer.y - height / 2) - camera.y) * .05;
    context.fillStyle = 'white';
    for (const star of stars) {
      const screen = project(star, width, height, camera);
      if (!screen) continue;
      context.globalAlpha = star.alpha;
      context.beginPath();
      context.arc(screen.x, screen.y, 1.6 * star.size * screen.scale, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  };
}

function warp(): Frame {
  const stars = cloud(300).map((star) => ({ ...star, vz: random(6, 14) }));
  return (context, width, height) => {
    context.strokeStyle = 'white';
    for (const star of stars) {
      const before = project(star, width, height);
      star.z += star.vz;
      if (star.z > 980) Object.assign(star, { z: -1000, x: random(-1000, 1000), y: random(-1000, 1000) });
      const after = project(star, width, height);
      if (!before || !after) continue;
      context.globalAlpha = Math.min(1, after.scale * .8);
      context.lineWidth = Math.min(3, after.scale * 1.2);
      context.beginPath();
      context.moveTo(before.x, before.y);
      context.lineTo(after.x, after.y);
      context.stroke();
    }
    context.globalAlpha = 1;
  };
}

function network(): Frame {
  const nodes = Array.from({ length: 70 }, () => ({ x: random(0, innerWidth), y: random(0, innerHeight), vx: random(-.4, .4), vy: random(-.4, .4) }));
  return (context, width, height) => {
    const all = [...nodes, { x: pointer.x, y: pointer.y, vx: 0, vy: 0 }];
    for (const node of nodes) {
      node.x += node.vx;
      node.y += node.vy;
      if (node.x < 0 || node.x > width) node.vx *= -1;
      if (node.y < 0 || node.y > height) node.vy *= -1;
    }
    context.strokeStyle = 'white';
    context.fillStyle = 'white';
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const distance = Math.hypot(all[i].x - all[j].x, all[i].y - all[j].y);
        if (distance > 150) continue;
        context.globalAlpha = (1 - distance / 150) * .5;
        context.beginPath();
        context.moveTo(all[i].x, all[i].y);
        context.lineTo(all[j].x, all[j].y);
        context.stroke();
      }
      context.globalAlpha = .7;
      context.beginPath();
      context.arc(all[i].x, all[i].y, 2, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  };
}

function aurora(): Frame {
  const blobs = [[160, 0], [190, 1.7], [280, 3.1], [130, 4.4]].map(([hue, phase]) => ({ hue, phase }));
  return (context, width, height, time) => {
    context.globalCompositeOperation = 'lighter';
    for (const { hue, phase } of blobs) {
      const t = time / 9000 + phase;
      const x = width * (.5 + Math.sin(t) * .35);
      const y = height * (.35 + Math.cos(t * 1.3) * .2);
      const radius = Math.max(width, height) * (.35 + Math.sin(t * .7) * .08);
      const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, `hsla(${hue}, 80%, 60%, .28)`);
      gradient.addColorStop(1, `hsla(${hue}, 80%, 60%, 0)`);
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);
    }
    context.globalCompositeOperation = 'source-over';
  };
}

const frames: Record<Exclude<Effect, 'none'>, (logo: string) => Frame> = { bubble: bubbles, snow, starfield, warp, network, aurora };

export function startEffect(layer: HTMLElement, effect: Effect, logo: string) {
  layer.replaceChildren();
  if (effect === 'none' || !frames[effect]) return () => undefined;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d')!;
  layer.append(canvas);
  const frame = frames[effect](logo);
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let request = 0;
  const resize = () => {
    const ratio = devicePixelRatio || 1;
    canvas.width = layer.clientWidth * ratio;
    canvas.height = layer.clientHeight * ratio;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  };
  const draw = (time: number) => {
    context.clearRect(0, 0, layer.clientWidth, layer.clientHeight);
    frame(context, layer.clientWidth, layer.clientHeight, time);
    if (!still) request = requestAnimationFrame(draw);
  };
  resize();
  window.addEventListener('resize', resize);
  request = requestAnimationFrame(draw);
  return () => {
    cancelAnimationFrame(request);
    window.removeEventListener('resize', resize);
    canvas.remove();
  };
}
