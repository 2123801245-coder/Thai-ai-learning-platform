import React, { useEffect, useRef } from "react";

const BuddhaTest = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    let width = 0;
    let height = 0;
    let animationId;

    const mouse = {
      x: -9999,
      y: -9999,
      active: false,
    };

    const particles = [];
    const rings = [];

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      width = window.innerWidth;
      height = window.innerHeight;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);

    // --------------------------------------------------
    // Particle system
    // --------------------------------------------------

    const createParticles = () => {
      particles.length = 0;

      const count = width < 768 ? 90 : 180;

      for (let i = 0; i < count; i++) {
        particles.push({
          angle: Math.random() * Math.PI * 2,
          radius: 180 + Math.random() * 300,
          speed: 0.0002 + Math.random() * 0.0006,
          size: Math.random() * 1.5 + 0.4,
          alpha: Math.random() * 0.5 + 0.15,
        });
      }
    };

    createParticles();

    // --------------------------------------------------
    // Mouse / touch
    // --------------------------------------------------

    const updatePointer = (x, y) => {
      mouse.x = x;
      mouse.y = y;
      mouse.active = true;
    };

    const mouseMove = (e) => {
      updatePointer(e.clientX, e.clientY);
    };

    const mouseLeave = () => {
      mouse.active = false;
    };

    const touchMove = (e) => {
      if (!e.touches.length) return;

      const touch = e.touches[0];

      updatePointer(touch.clientX, touch.clientY);
    };

    const touchEnd = () => {
      mouse.active = false;
    };

    window.addEventListener("mousemove", mouseMove);
    window.addEventListener("mouseleave", mouseLeave);
    window.addEventListener("touchmove", touchMove, {
      passive: true,
    });
    window.addEventListener("touchend", touchEnd);

    // --------------------------------------------------
    // Energy ring
    // --------------------------------------------------

    const createRing = (x, y) => {
      rings.push({
        x,
        y,
        radius: 10,
        alpha: 0.55,
      });
    };

    // --------------------------------------------------
    // Main render
    // --------------------------------------------------

    const render = (time) => {
      ctx.clearRect(0, 0, width, height);

      // Background
      const bg = ctx.createRadialGradient(
        width * 0.5,
        height * 0.42,
        0,
        width * 0.5,
        height * 0.42,
        Math.max(width, height)
      );

      bg.addColorStop(0, "#101c1a");
      bg.addColorStop(0.45, "#050b0a");
      bg.addColorStop(1, "#000000");

      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      // ------------------------------------------------
      // Halo
      // ------------------------------------------------

      const centerX = width / 2;
      const centerY = height * 0.46;

      const halo = ctx.createRadialGradient(
        centerX,
        centerY,
        40,
        centerX,
        centerY,
        Math.min(width, height) * 0.42
      );

      halo.addColorStop(0, "rgba(91,255,210,0.16)");
      halo.addColorStop(0.35, "rgba(39,180,145,0.08)");
      halo.addColorStop(1, "rgba(0,0,0,0)");

      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, width, height);

      // ------------------------------------------------
      // Neural particles
      // ------------------------------------------------

      particles.forEach((p) => {
        p.angle += p.speed * 16;

        const breathing =
          Math.sin(time * 0.0007 + p.angle * 3) * 10;

        const px =
          centerX +
          Math.cos(p.angle) * (p.radius + breathing);

        const py =
          centerY +
          Math.sin(p.angle) *
            (p.radius * 0.72 + breathing);

        let alpha = p.alpha;

        if (mouse.active) {
          const dx = px - mouse.x;
          const dy = py - mouse.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 180) {
            alpha += (1 - distance / 180) * 0.65;
          }
        }

        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);

        ctx.fillStyle = `rgba(91,255,210,${Math.min(
          alpha,
          1
        )})`;

        ctx.fill();
      });

      // ------------------------------------------------
      // Neural network connections
      // ------------------------------------------------

      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];

        const ax =
          centerX + Math.cos(a.angle) * a.radius;

        const ay =
          centerY +
          Math.sin(a.angle) *
            (a.radius * 0.72);

        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];

          const bx =
            centerX + Math.cos(b.angle) * b.radius;

          const by =
            centerY +
            Math.sin(b.angle) *
              (b.radius * 0.72);

          const dx = ax - bx;
          const dy = ay - by;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 75) {
            ctx.beginPath();

            ctx.moveTo(ax, ay);
            ctx.lineTo(bx, by);

            ctx.strokeStyle = `rgba(91,255,210,${
              (1 - distance / 75) * 0.13
            })`;

            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }

      // ------------------------------------------------
      // Energy response around pointer
      // ------------------------------------------------

      if (mouse.active) {
        const dx = mouse.x - centerX;
        const dy = mouse.y - centerY;

        const faceDistance = Math.sqrt(dx * dx + dy * dy);

        if (faceDistance < Math.min(width, height) * 0.32) {
          const glow = ctx.createRadialGradient(
            mouse.x,
            mouse.y,
            0,
            mouse.x,
            mouse.y,
            170
          );

          glow.addColorStop(
            0,
            "rgba(115,255,220,0.25)"
          );

          glow.addColorStop(
            0.35,
            "rgba(73,220,180,0.12)"
          );

          glow.addColorStop(
            1,
            "rgba(0,0,0,0)"
          );

          ctx.fillStyle = glow;

          ctx.beginPath();
          ctx.arc(
            mouse.x,
            mouse.y,
            170,
            0,
            Math.PI * 2
          );

          ctx.fill();

          if (Math.random() > 0.93) {
            createRing(mouse.x, mouse.y);
          }
        }
      }

      // ------------------------------------------------
      // Rings
      // ------------------------------------------------

      rings.forEach((ring) => {
        ring.radius += 2.5;
        ring.alpha -= 0.012;

        ctx.beginPath();

        ctx.arc(
          ring.x,
          ring.y,
          ring.radius,
          0,
          Math.PI * 2
        );

        ctx.strokeStyle = `rgba(91,255,210,${ring.alpha})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      while (rings.length > 40) {
        rings.shift();
      }

      // ------------------------------------------------
      // Buddha placeholder silhouette
      // ------------------------------------------------

      const isMobile = width < 768;

      const scale = isMobile
        ? Math.min(width / 520, 1)
        : Math.min(width / 720, 1);

      ctx.save();

      ctx.translate(centerX, centerY);
      ctx.scale(scale, scale);

      // Crown
      const crown = ctx.createRadialGradient(
        0,
        -210,
        0,
        0,
        -210,
        90
      );

      crown.addColorStop(
        0,
        "rgba(245,255,252,0.95)"
      );

      crown.addColorStop(
        0.45,
        "rgba(120,210,190,0.9)"
      );

      crown.addColorStop(
        1,
        "rgba(15,45,40,0)"
      );

      ctx.fillStyle = crown;

      ctx.beginPath();

      ctx.moveTo(0, -300);
      ctx.quadraticCurveTo(
        -38,
        -250,
        0,
        -205
      );

      ctx.quadraticCurveTo(
        38,
        -250,
        0,
        -300
      );

      ctx.fill();

      // Head
      const headGradient = ctx.createLinearGradient(
        -150,
        -170,
        150,
        180
      );

      headGradient.addColorStop(
        0,
        "#e9efec"
      );

      headGradient.addColorStop(
        0.35,
        "#9fbdb5"
      );

      headGradient.addColorStop(
        0.65,
        "#425f58"
      );

      headGradient.addColorStop(
        1,
        "#0d1816"
      );

      ctx.fillStyle = headGradient;

      ctx.beginPath();

      ctx.moveTo(0, -205);

      ctx.bezierCurveTo(
        -100,
        -205,
        -145,
        -120,
        -130,
        25
      );

      ctx.bezierCurveTo(
        -120,
        145,
        -70,
        205,
        0,
        215
      );

      ctx.bezierCurveTo(
        70,
        205,
        120,
        145,
        130,
        25
      );

      ctx.bezierCurveTo(
        145,
        -120,
        100,
        -205,
        0,
        -205
      );

      ctx.fill();

      // Face highlight
      const faceGlow =
        ctx.createRadialGradient(
          0,
          -20,
          20,
          0,
          -20,
          150
        );

      faceGlow.addColorStop(
        0,
        "rgba(255,255,255,0.32)"
      );

      faceGlow.addColorStop(
        1,
        "rgba(255,255,255,0)"
      );

      ctx.fillStyle = faceGlow;

      ctx.beginPath();

      ctx.ellipse(
        0,
        -20,
        110,
        165,
        0,
        0,
        Math.PI * 2
      );

      ctx.fill();

      // Eyes
      ctx.strokeStyle =
        "rgba(15,30,27,0.8)";

      ctx.lineWidth = 4;

      ctx.beginPath();

      ctx.moveTo(-68, -50);
      ctx.quadraticCurveTo(
        -35,
        -30,
        -8,
        -48
      );

      ctx.stroke();

      ctx.beginPath();

      ctx.moveTo(68, -50);
      ctx.quadraticCurveTo(
        35,
        -30,
        8,
        -48
      );

      ctx.stroke();

      // Nose
      ctx.beginPath();

      ctx.moveTo(0, -40);
      ctx.quadraticCurveTo(
        -10,
        15,
        0,
        38
      );

      ctx.quadraticCurveTo(
        10,
        15,
        0,
        -40
      );

      ctx.stroke();

      // Smile
      ctx.beginPath();

      ctx.moveTo(-48, 65);

      ctx.quadraticCurveTo(
        0,
        92,
        48,
        65
      );

      ctx.stroke();

      // Ears
      ctx.strokeStyle =
        "rgba(180,220,210,0.55)";

      ctx.lineWidth = 12;

      ctx.beginPath();

      ctx.moveTo(-125, -50);
      ctx.quadraticCurveTo(
        -155,
        20,
        -115,
        130
      );

      ctx.stroke();

      ctx.beginPath();

      ctx.moveTo(125, -50);
      ctx.quadraticCurveTo(
        155,
        20,
        115,
        130
      );

      ctx.stroke();

      // Neural face lines
      ctx.strokeStyle =
        "rgba(91,255,210,0.35)";

      ctx.lineWidth = 1;

      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();

        ctx.moveTo(
          i * 32,
          -150
        );

        ctx.quadraticCurveTo(
          i * 55,
          0,
          i * 42,
          155
        );

        ctx.stroke();
      }

      ctx.restore();

      // ------------------------------------------------
      // Bottom gradient
      // ------------------------------------------------

      const bottomGradient =
        ctx.createLinearGradient(
          0,
          height * 0.65,
          0,
          height
        );

      bottomGradient.addColorStop(
        0,
        "rgba(0,0,0,0)"
      );

      bottomGradient.addColorStop(
        1,
        "rgba(0,0,0,0.9)"
      );

      ctx.fillStyle = bottomGradient;
      ctx.fillRect(
        0,
        height * 0.65,
        width,
        height * 0.35
      );

      animationId =
        requestAnimationFrame(render);
    };

    animationId =
      requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationId);

      window.removeEventListener(
        "resize",
        resize
      );

      window.removeEventListener(
        "mousemove",
        mouseMove
      );

      window.removeEventListener(
        "mouseleave",
        mouseLeave
      );

      window.removeEventListener(
        "touchmove",
        touchMove
      );

      window.removeEventListener(
        "touchend",
        touchEnd
      );
    };
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#000",
        overflow: "hidden",
        touchAction: "none",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
        }}
      />

      <div
        style={{
          position: "absolute",
          top: 28,
          left: 28,
          zIndex: 10,
          color: "rgba(255,255,255,.75)",
          fontFamily:
            '"Space Mono", monospace',
          fontSize: 12,
          letterSpacing: ".12em",
          pointerEvents: "none",
        }}
      >
        THAI AI · NEURAL INTERFACE
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 28,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 10,
          color: "rgba(255,255,255,.45)",
          fontFamily:
            '"Space Mono", monospace',
          fontSize: 11,
          letterSpacing: ".1em",
          whiteSpace: "nowrap",
          pointerEvents: "none",
        }}
      >
        MOVE CURSOR / TOUCH THE FACE
      </div>
    </div>
  );
};

export default BuddhaTest;