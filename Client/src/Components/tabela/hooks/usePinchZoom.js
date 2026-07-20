import { useEffect, useRef, useState } from "react";

// Zoom 1x–3x por pinça de dois dedos dentro de `frameWrapRef`. Eventos de touch
// nativos (não gesture do dnd-kit) — o wrapper precisa de `touchAction: "pan-x pan-y"`
// para o browser não competir pelo gesto (scroll vs. pinch).
export function usePinchZoom() {
    const [zoom, setZoom] = useState(1);
    const zoomRef = useRef(1);
    const frameWrapRef = useRef(null);
    const pinch = useRef({ dist: 0, zoom: 1 });

    const aplicarZoom = (z) => {
        const c = Math.min(3, Math.max(1, z));
        zoomRef.current = c;
        setZoom(c);
    };

    useEffect(() => {
        const el = frameWrapRef.current;
        if (!el) return;
        const d = (t) =>
            Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
        const onStart = (e) => {
            if (e.touches.length === 2)
                pinch.current = { dist: d(e.touches), zoom: zoomRef.current };
        };
        const onMove = (e) => {
            if (e.touches.length === 2 && pinch.current.dist) {
                e.preventDefault();
                aplicarZoom(pinch.current.zoom * (d(e.touches) / pinch.current.dist));
            }
        };
        const onEnd = (e) => {
            if (e.touches.length < 2) pinch.current.dist = 0;
        };
        el.addEventListener("touchstart", onStart, { passive: false });
        el.addEventListener("touchmove", onMove, { passive: false });
        el.addEventListener("touchend", onEnd);
        el.addEventListener("touchcancel", onEnd);
        return () => {
            el.removeEventListener("touchstart", onStart);
            el.removeEventListener("touchmove", onMove);
            el.removeEventListener("touchend", onEnd);
            el.removeEventListener("touchcancel", onEnd);
        };
    }, []);

    return { zoom, aplicarZoom, frameWrapRef };
}
