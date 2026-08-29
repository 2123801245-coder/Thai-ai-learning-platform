import React, { useRef, useEffect } from "react";

/**
 * StarParticles — lightweight canvas particle layer.
 * Renders soft white dots drifting downward with gentle horizontal sway.
 * Props:
 *   count   – number of particles (default 80)
 *   opacity – max alpha of each particle (0-1, default 0.7)
 *   speed   – base fall speed multiplier (default 1)
 */
export default function StarParticles({ count = 80, opacity = 0.7, speed = 1 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let raf;
    let particles = [];
    let w, h;

    // mouse tracking
    let mouseX = -9999;
    let mouseY = -9999;
    const REPEL_RADIUS = 120;
    const REPEL_STRENGTH = 6;
    const RETURN_SPEED = 0.04;

    function onMouseMove(e) {
      const rect = canvas.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
    }
    function onMouseLeave() {
      mouseX = -9999;
      mouseY = -9999;
    }

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.parentElement.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function createParticle() {
      const size = Math.random() * 2.2 + 0.6;
      return {
        x: Math.random() * w,
        y: Math.random() * h - h,
        size,
        baseX: Math.random() * w,
        offsetX: 0,
        offsetY: 0,
        fallSpeed: (Math.random() * 0.4 + 0.15) * speed,
        swayAmp: Math.random() * 30 + 10,
        swaySpeed: Math.random() * 0.002 + 0.001,
        phase: Math.random() * Math.PI * 2,
        alpha: (Math.random() * 0.5 + 0.3) * opacity,
        twinkleSpeed: Math.random() * 0.03 + 0.01,
        twinklePhase: Math.random() * Math.PI * 2,
      };
    }

    function init() {
      resize();
      particles = [];
      for (let i = 0; i < count; i++) {
        const p = createParticle();
        p.y = Math.random() * h; // scatter across viewport initially
        particles.push(p);
      }
    }

    let time = 0;
    function draw() {
      ctx.clearRect(0, 0, w, h);
      time++;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // fall
        p.y += p.fallSpeed;

        // horizontal sway
        const sway = Math.sin(time * p.swaySpeed + p.phase) * p.swayAmp;
        const naturalX = p.baseX + sway;

        // mouse repulsion
        const dx = naturalX + p.offsetX - mouseX;
        const dy = p.y - mouseY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < REPEL_RADIUS && dist > 0) {
          const force = (1 - dist / REPEL_RADIUS) * REPEL_STRENGTH;
          p.offsetX += (dx / dist) * force;
          p.offsetY += (dy / dist) * force;
        }
        // smoothly return offset toward zero
        p.offsetX *= 1 - RETURN_SPEED;
        p.offsetY *= 1 - RETURN_SPEED;

        const drawX = naturalX + p.offsetX;
        const drawY = p.y + p.offsetY;

        // wrap around
        if (p.y > h + 10) {
          p.y = -10;
          p.baseX = Math.random() * w;
        }

        // twinkle
        const twinkle = Math.sin(time * p.twinkleSpeed + p.twinklePhase);
        const currentAlpha = p.alpha * (0.5 + 0.5 * twinkle);

        // draw glow + core
        const gradient = ctx.createRadialGradient(drawX, drawY, 0, drawX, drawY, p.size * 3);
        gradient.addColorStop(0, `rgba(255, 255, 255, ${currentAlpha})`);
        gradient.addColorStop(0.4, `rgba(255, 255, 255, ${currentAlpha * 0.3})`);
        gradient.addColorStop(1, "rgba(255, 255, 255, 0)");

        ctx.beginPath();
        ctx.arc(drawX, drawY, p.size * 3, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // bright core
        ctx.beginPath();
        ctx.arc(drawX, drawY, p.size * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${currentAlpha * 1.2})`;
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    }

    init();
    draw();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseleave", onMouseLeave);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseleave", onMouseLeave);
    };
  }, [count, opacity, speed]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-[1] pointer-events-none"
      style={{ mixBlendMode: "screen" }}
    />
  );
}
