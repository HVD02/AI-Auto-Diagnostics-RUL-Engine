import React, { useId } from "react";

/* ============================================================
   CarStage: reusable diagnostic "scan stage" for the landing page.
   Technical top-down off-road SUV wireframe, orbit rings, scan
   lines, sensor points and three floating information cards,
   ported from the Studio Concept prototype.

   The stage is intentionally dark in BOTH themes (like the
   prototype), so its colours are fixed values scoped to .cs and
   are not read from the light/dark tokens. Fonts and the lime
   brand colour come from theme.css (--mono, --sans, --lime).

   Everything shown is an ILLUSTRATION. The props only change the
   labels; they do not run any analysis. Pass real values only if
   you actually have them (for example from a loaded analysis).

   Props (all optional):
     healthScore     number  shown in the "Health index" card      (default 77)
     signalCount     number  shown in the "Signals to inspect" card (default 3)
     modeLabel       string  shown in the "System mode" card        (default "DEMO")
     vehicleLabel    string  stage header id                        (default "DEMO_healthy")
     statusLabel     string  stage header status text               (default "SIGNAL SCAN ACTIVE")
     windowSamples   number  samples in the footer caption          (default 600)
     footnote        string  right footer caption   (default "ILLUSTRATIVE GRAPHIC · NO VEHICLE CONNECTED")
     className       string  extra class on the root element
   ============================================================ */

const CSS = `
.cs {
  --cs-lime: var(--lime, #d6ff4f);
  --cs-aqua: #66e8d0;
  --cs-ink: #101219;
  --cs-muted: #a7adbb;
  position: relative;
  isolation: isolate;
  min-height: 485px;
  display: grid;
  place-items: center;
  animation: cs-rise 0.85s 0.08s cubic-bezier(0.22, 1, 0.36, 1) both;
}
.cs-glow {
  position: absolute;
  z-index: 0;
  width: 80%;
  height: 70%;
  border-radius: 50%;
  background: rgba(102, 232, 208, 0.1);
  filter: blur(55px);
  pointer-events: none;
}

/* ---- stage ---- */
.cs-stage {
  position: relative;
  z-index: 1;
  width: min(100%, 590px);
  aspect-ratio: 1.12 / 1;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 33px;
  background: linear-gradient(145deg, #202634, #141925);
  box-shadow: 0 35px 90px rgba(0, 0, 0, 0.35);
  transform: translateZ(0);
}
.cs-stage::before {
  content: "";
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 50% 48%, rgba(214, 255, 79, 0.12), transparent 38%),
    linear-gradient(135deg, rgba(169, 139, 255, 0.12), transparent 55%);
  pointer-events: none;
}
html[data-theme="light"] .cs-stage {
  border-color: rgba(37, 52, 69, 0.3);
  box-shadow: 0 28px 65px rgba(20, 29, 43, 0.23), 0 0 0 1px rgba(255, 255, 255, 0.22) inset;
}

.cs-top, .cs-bottom {
  position: absolute;
  left: 20px;
  right: 20px;
  z-index: 3;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  font-family: var(--mono, ui-monospace, monospace);
  letter-spacing: 0.12em;
}
.cs-top { top: 18px; }
.cs-bottom { bottom: 16px; font-size: 10px; letter-spacing: 0.08em; color: #aab2c0; }
.cs-id { font-size: 10.5px; color: #c3cad5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cs-live {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 10px;
  color: var(--cs-aqua);
  white-space: nowrap;
}
.cs-live::before {
  content: "";
  width: 6px;
  height: 6px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--cs-aqua);
  box-shadow: 0 0 12px var(--cs-aqua);
  animation: cs-blink 2.2s ease-in-out infinite;
}
.cs-bottom span:last-child { color: var(--cs-lime); text-align: right; }

/* ---- svg ---- */
.cs-svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.cs-orbit { fill: none; stroke: rgba(214, 255, 79, 0.2); stroke-width: 1; stroke-dasharray: 3 8; }
.cs-orbit2 { fill: none; stroke: rgba(102, 232, 208, 0.28); stroke-width: 1; }
.cs-scan {
  fill: none;
  stroke: var(--cs-lime);
  stroke-width: 1.5;
  stroke-dasharray: 7 9;
  opacity: 0.8;
  animation: cs-dash 18s linear infinite;
}
.cs-dot {
  fill: var(--cs-lime);
  filter: drop-shadow(0 0 7px var(--cs-lime));
  animation: cs-pulse 2.8s ease-in-out infinite;
}
.cs-dot:nth-child(2) { animation-delay: 0.7s; }
.cs-dot:nth-child(3) { animation-delay: 1.4s; }
.cs-dot:nth-child(4) { animation-delay: 2.1s; }
.cs-label { font-family: var(--mono, ui-monospace, monospace); font-size: 10px; fill: #b7c0cb; }

/* ---- floating cards (dark in both themes) ---- */
.cs-chip {
  position: absolute;
  z-index: 4;
  min-width: 135px;
  padding: 12px 14px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 14px;
  background: rgba(16, 19, 28, 0.92);
  box-shadow: 0 18px 45px rgba(0, 0, 0, 0.3);
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
  color: #f7f8fb;
}
html[data-theme="light"] .cs-chip {
  border-color: rgba(214, 230, 244, 0.22);
  background: rgba(13, 18, 28, 0.94);
}
.cs-chip small {
  display: block;
  font-family: var(--mono, ui-monospace, monospace);
  font-size: 10px;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: #c1c9d5;
}
.cs-chip strong {
  display: block;
  margin-top: 3px;
  font-family: var(--sans, system-ui, sans-serif);
  font-size: 22px;
  font-weight: 800;
  line-height: 1.15;
  color: #ffffff;
}
.cs-chip .cs-unit { font-size: 11px; font-weight: 500; color: var(--cs-muted); }
.cs-chip .cs-note { display: block; margin-top: 2px; font-size: 11px; color: var(--cs-aqua); }
.cs-chip-a { left: -17px; top: 25%; }
.cs-chip-b { right: -16px; bottom: 24%; }
.cs-chip-c { right: 24px; top: 16%; min-width: 118px; }
.cs-chip-c strong { color: var(--cs-lime); }

/* ---- animation ---- */
@keyframes cs-rise { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: none; } }
@keyframes cs-dash { to { stroke-dashoffset: -320; } }
@keyframes cs-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }
@keyframes cs-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
@media (prefers-reduced-motion: reduce) {
  .cs, .cs-scan, .cs-dot, .cs-live::before { animation: none; }
}

/* ---- responsive (same breakpoints as the prototype) ---- */
@media (max-width: 850px) {
  .cs { min-height: 420px; }
  .cs-stage { width: min(100%, 620px); }
}
@media (max-width: 620px) {
  .cs { min-height: 330px; }
  .cs-stage { width: 100%; aspect-ratio: 1.08 / 1; border-radius: 22px; }
  .cs-chip { min-width: 105px; padding: 9px 10px; }
  .cs-chip strong { font-size: 17px; }
  .cs-chip small { font-size: 9px; }
  .cs-chip .cs-note { font-size: 10px; }
  .cs-chip-a { left: 2px; }
  .cs-chip-b { right: 2px; }
  .cs-chip-c { right: 12px; top: 12%; min-width: 96px; }
  .cs-top, .cs-bottom { left: 14px; right: 14px; }
  .cs-top { top: 13px; }
  .cs-bottom { bottom: 12px; font-size: 8.5px; }
  .cs-bottom span:first-child { display: none; }
  .cs-bottom span:last-child { margin-left: auto; }
}
@media (max-width: 440px) {
  .cs-label { display: none; }
  .cs-id { max-width: 48%; }
}
`;

export default function CarStage({
  healthScore = 77,
  signalCount = 3,
  modeLabel = "DEMO",
  vehicleLabel = "DEMO_healthy",
  statusLabel = "SIGNAL SCAN ACTIVE",
  windowSamples = 600,
  footnote = "ILLUSTRATIVE GRAPHIC · NO VEHICLE CONNECTED",
  className = "",
}) {
  // unique, selector-safe ids so several stages can live on one page
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const ref = (name) => `url(#${uid}-${name})`;
  const signals = String(signalCount).padStart(2, "0");

  return (
    <div
      className={`cs ${className}`.trim()}
      role="group"
      aria-label="Rugged top-down off-road SUV telemetry visualization (illustration)"
    >
      <style>{CSS}</style>
      <div className="cs-glow" aria-hidden="true" />

      <div className="cs-chip cs-chip-a">
        <small>Health index / sample</small>
        <strong>
          {healthScore}
          <span className="cs-unit"> / 100</span>
        </strong>
        <span className="cs-note">Watch the signal</span>
      </div>
      <div className="cs-chip cs-chip-b">
        <small>Signals to inspect</small>
        <strong>{signals}</strong>
        <span className="cs-note">Sensor ranking</span>
      </div>
      <div className="cs-chip cs-chip-c">
        <small>System mode</small>
        <strong>{modeLabel}</strong>
      </div>

      <div className="cs-stage">
        <div className="cs-top">
          <span className="cs-id">VEHICLE / {vehicleLabel}</span>
          <span className="cs-live">{statusLabel}</span>
        </div>

        <svg
          className="cs-svg"
          viewBox="0 0 560 500"
          role="img"
          aria-label="Top-down rugged off-road SUV wireframe with 360 degree telemetry scan rings"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <radialGradient id={`${uid}-carGlow`}>
              <stop offset="0" stopColor="#d6ff4f" stopOpacity=".19" />
              <stop offset="1" stopColor="#d6ff4f" stopOpacity="0" />
            </radialGradient>
            <linearGradient id={`${uid}-suvBody`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#314253" />
              <stop offset=".48" stopColor="#172431" />
              <stop offset="1" stopColor="#0a111b" />
            </linearGradient>
            <linearGradient id={`${uid}-suvGlass`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#183849" />
              <stop offset="1" stopColor="#07131f" />
            </linearGradient>
            <linearGradient id={`${uid}-suvEdge`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#efffff" />
              <stop offset=".55" stopColor="#86bdcc" />
              <stop offset="1" stopColor="#d6ff4f" />
            </linearGradient>
            <filter id={`${uid}-suvGlow`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id={`${uid}-suvSoftGlow`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* telemetry radar */}
          <circle cx="280" cy="258" r="220" fill={ref("carGlow")} />
          <circle className="cs-orbit" cx="280" cy="258" r="207" />
          <circle className="cs-orbit2" cx="280" cy="258" r="176" />
          <circle className="cs-orbit" cx="280" cy="258" r="143" />
          <path className="cs-scan" d="M64 258H496M280 48V468M130 108L430 408M430 108L130 408" />
          <g opacity=".9" fill="#66e8d0">
            <circle cx="116" cy="178" r="3" />
            <circle cx="444" cy="176" r="3" />
            <circle cx="403" cy="374" r="2.8" />
            <circle cx="157" cy="378" r="2.8" />
          </g>

          {/* rugged 4x4 silhouette: front at top, rear spare wheel at bottom */}
          <g strokeLinejoin="round" strokeLinecap="round">
            {/* ground shadow */}
            <path
              d="M223 65L337 65 360 88 374 125 377 177 369 198 369 354 359 394 337 424 223 424 201 394 191 354 191 198 183 177 186 125 200 88Z"
              fill="#02070d"
              opacity=".72"
              transform="translate(0 8)"
            />
            {/* four chunky off-road tyres */}
            <g fill="#050a11" stroke="#9dc8d7" strokeOpacity=".72" strokeWidth="1.8">
              <rect x="174" y="119" width="32" height="78" rx="8" />
              <rect x="354" y="119" width="32" height="78" rx="8" />
              <rect x="174" y="307" width="32" height="78" rx="8" />
              <rect x="354" y="307" width="32" height="78" rx="8" />
            </g>
            <g stroke="#5f8495" strokeWidth="1.5" opacity=".9">
              <path d="M180 130h20M180 140h20M180 151h20M180 162h20M180 173h20M360 130h20M360 140h20M360 151h20M360 162h20M360 173h20" />
              <path d="M180 318h20M180 329h20M180 340h20M180 351h20M180 362h20M360 318h20M360 329h20M360 340h20M360 351h20M360 362h20" />
            </g>
            {/* broad squared body with upright corners */}
            <path
              d="M226 63H334L355 82 368 116 371 164 363 190V354L352 391 331 418H229L208 391 197 354V190L189 164 192 116 205 82Z"
              fill={ref("suvBody")}
              stroke={ref("suvEdge")}
              strokeWidth="2.4"
              filter={ref("suvGlow")}
            />
            {/* wide front bonnet */}
            <path d="M216 83H344L356 112 358 151 343 170H217L202 151 204 112Z" fill="#172a37" stroke="#d8f5fb" strokeOpacity=".82" strokeWidth="1.8" />
            <path d="M222 95H338L346 116 344 143H216L214 116Z" fill="#203b48" stroke="#80aebd" strokeOpacity=".78" strokeWidth="1.4" />
            <path d="M232 105H328L337 124 329 139H231L223 124Z" fill="#0b1822" stroke="#66e8d0" strokeOpacity=".66" strokeWidth="1.3" />
            {/* engine / powertrain diagnostic schematic */}
            <g opacity=".96" filter={ref("suvGlow")}>
              <rect x="244" y="108" width="72" height="28" rx="5" fill="#ff865b" fillOpacity=".10" stroke="#ffb06c" strokeWidth="1.4" strokeDasharray="4 3" />
              <path d="M253 114h18v16h-18zM276 114h13v16h-13zM294 118h13" fill="none" stroke="#ffb06c" strokeWidth="1.3" />
              <circle cx="260" cy="122" r="3" fill="#d6ff4f" />
              <circle cx="300" cy="122" r="3" fill="#66e8d0" />
            </g>
            {/* upright windshield and cabin */}
            <path d="M213 174L347 174 354 212 349 237H211L206 212Z" fill={ref("suvGlass")} stroke="#d9f5fb" strokeOpacity=".8" strokeWidth="1.8" />
            <path d="M219 181H341L347 211 340 228H220L213 211Z" fill="#06121c" stroke="#78a6b8" strokeOpacity=".75" strokeWidth="1.2" />
            <path d="M222 238H338L344 347 330 367H230L216 347Z" fill="#142634" stroke="#b8dce7" strokeOpacity=".9" strokeWidth="2" />
            {/* roof panel, square sunroof and structural ribs */}
            <path d="M230 248H330L334 344H226Z" fill="#0b1722" stroke="#7899aa" strokeWidth="1.4" />
            <rect x="238" y="263" width="84" height="52" rx="8" fill="#101e2b" stroke="#a6c7d4" strokeOpacity=".85" strokeWidth="1.5" />
            <path d="M248 326V350M264 326V350M280 326V350M296 326V350M312 326V350" stroke="#6e8998" strokeWidth="2" opacity=".8" />
            <path d="M224 243H336M224 357H336" stroke="#d8f5fb" strokeOpacity=".55" strokeWidth="1.5" />
            {/* side doors, handles and angular fender shoulders */}
            <path d="M205 202L219 207V350L205 365M355 202L341 207V350L355 365" fill="none" stroke="#9bc4d3" strokeOpacity=".8" strokeWidth="1.6" />
            <path d="M207 237H218M342 237H353M207 339H218M342 339H353" stroke="#d5f2fa" strokeWidth="2" />
            <path d="M195 198L180 207 181 225 199 220M365 198L380 207 379 225 361 220" fill="#101e29" stroke="#b8e6f0" strokeWidth="1.6" />
            {/* square LED headlights and front bumper */}
            <rect x="204" y="78" width="20" height="12" rx="2" fill="#d6ff4f" stroke="#f4ffd1" strokeWidth="1.3" filter={ref("suvSoftGlow")} />
            <rect x="336" y="78" width="20" height="12" rx="2" fill="#d6ff4f" stroke="#f4ffd1" strokeWidth="1.3" filter={ref("suvSoftGlow")} />
            <path d="M217 68H343M206 96L198 112M354 96L362 112" stroke="#d9f5fb" strokeWidth="2" />
            <path d="M215 159H345" stroke="#ffb06c" strokeOpacity=".8" strokeWidth="1.5" strokeDasharray="5 4" />
            {/* rear window, tail lights and spare wheel */}
            <path d="M224 374H336L327 396H233Z" fill="#07131e" stroke="#8cb8c8" strokeWidth="1.5" />
            <rect x="202" y="384" width="27" height="9" rx="3" fill="#ff5f61" stroke="#ffb3a9" strokeWidth="1.2" filter={ref("suvGlow")} />
            <rect x="331" y="384" width="27" height="9" rx="3" fill="#ff5f61" stroke="#ffb3a9" strokeWidth="1.2" filter={ref("suvGlow")} />
            <path d="M225 407H335L326 419H234Z" fill="#111d28" stroke="#8fb9c8" strokeWidth="1.5" />
            <circle cx="280" cy="405" r="26" fill="#071019" stroke="#b6d9e5" strokeWidth="2" filter={ref("suvGlow")} />
            <circle cx="280" cy="405" r="19" fill="#142632" stroke="#69899a" strokeWidth="1.4" />
            <circle cx="280" cy="405" r="7" fill="#0a141e" stroke="#8fb9c8" strokeWidth="1.2" />
            <path d="M280 387V423M262 405H298M267 392L293 418M293 392L267 418" stroke="#648697" strokeWidth="1" opacity=".75" />
            {/* sensor scan points around the vehicle */}
            <g filter={ref("suvGlow")}>
              <circle className="cs-dot" cx="207" cy="89" r="3.5" />
              <circle className="cs-dot" cx="353" cy="89" r="3.5" />
              <circle className="cs-dot" cx="280" cy="145" r="3" />
              <circle className="cs-dot" cx="280" cy="405" r="3" />
            </g>
          </g>

          <g aria-hidden="true">
            <text className="cs-label" x="25" y="72">ECU / 01</text>
            <text className="cs-label" x="423" y="88">LIVE / 04</text>
            <text className="cs-label" x="24" y="440">TELEMETRY GRID</text>
            <text className="cs-label" x="431" y="440">SCAN 360°</text>
          </g>
        </svg>

        <div className="cs-bottom">
          <span>ENGINE TELEMETRY / {windowSamples} SAMPLE WINDOW</span>
          <span>{footnote}</span>
        </div>
      </div>
    </div>
  );
}