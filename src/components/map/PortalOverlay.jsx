/**
 * PortalOverlay.jsx
 * Renders children directly into document.body via a React Portal,
 * completely escaping any parent stacking context (ResultsPanel, etc.)
 */
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export default function PortalOverlay({ children, zIndex = 2000 }) {
  const elRef = useRef(null);

  if (!elRef.current) {
    const div = document.createElement("div");
    div.style.cssText = `position:fixed;inset:0;z-index:${zIndex};pointer-events:none;`;
    elRef.current = div;
  }

  useEffect(() => {
    const el = elRef.current;
    document.body.appendChild(el);
    return () => {
      if (document.body.contains(el)) document.body.removeChild(el);
    };
  }, []);

  return createPortal(
    <div style={{ pointerEvents: "all", width: "100%", height: "100%" }}>
      {children}
    </div>,
    elRef.current
  );
}
