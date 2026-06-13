// Inlines the confidential-review architecture SVG (also served at /map.html).
// Rendered as raw markup so the diagram matches the source exactly; all class
// selectors and CSS variables are scoped under `.aegis-map` to avoid collisions.
const SVG = `
<style>
  .aegis-map{
    --ink:#141A24; --paper:#F3F5F8; --panel:#FFFFFF; --line:#C7CFD8;
    --slate:#5C6470; --teal:#0E7C6B; --teal-soft:#E3F1EE;
    --violet:#5B4AA8; --violet-soft:#ECE8F7;
    --amber:#A8690B; --amber-soft:#FBF0DC; --danger:#B42318; --danger-soft:#FBE7E4;
    --navy:#1C2438;
  }
  .aegis-map svg{width:100%;height:auto;display:block}
  .aegis-map .ey{font-size:13px;font-weight:700;letter-spacing:.22em;fill:var(--teal)}
  .aegis-map .h1{font-size:24px;font-weight:800;fill:var(--ink)}
  .aegis-map .sub{font-size:13px;fill:var(--slate)}
  .aegis-map .ct{font-size:14px;font-weight:700}
  .aegis-map .cb{font-size:12px;fill:var(--slate)}
  .aegis-map .cw{font-size:12px;font-weight:700;fill:#EAF0F2}
  .aegis-map .cwb{font-size:11.5px;fill:#AEB8C8}
  .aegis-map .mono{font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace;font-size:11px}
  .aegis-map .lbl{font-size:11px;font-weight:700}
  .aegis-map .note{font-size:11px;font-style:italic}
  .aegis-map .tag{font-size:10px;font-weight:800;letter-spacing:.12em}
</style>
<svg viewBox="0 0 1240 600" xmlns="http://www.w3.org/2000/svg" role="img"
     aria-label="Confidential AI review flow for public and private skills feeding an on-chain registry and a load gate">
  <defs>
    <marker id="t" markerWidth="9" markerHeight="9" refX="6.5" refY="3" orient="auto"><path d="M0 0 L7 3 L0 6 Z" fill="#0E7C6B"/></marker>
    <marker id="v" markerWidth="9" markerHeight="9" refX="6.5" refY="3" orient="auto"><path d="M0 0 L7 3 L0 6 Z" fill="#5B4AA8"/></marker>
    <marker id="s" markerWidth="9" markerHeight="9" refX="6.5" refY="3" orient="auto"><path d="M0 0 L7 3 L0 6 Z" fill="#5C6470"/></marker>
    <marker id="a" markerWidth="9" markerHeight="9" refX="6.5" refY="3" orient="auto"><path d="M0 0 L7 3 L0 6 Z" fill="#A8690B"/></marker>
    <symbol id="lock" viewBox="0 0 16 16"><path d="M5 7.2V5.1a3 3 0 0 1 6 0v2.1" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="3.4" y="7.2" width="9.2" height="6.4" rx="1.5" fill="currentColor" fill-opacity="0.18" stroke="currentColor" stroke-width="1.4"/></symbol>
  </defs>

  <text class="ey" x="40" y="38">AEGIS · CONFIDENTIAL REVIEW</text>
  <text class="h1" x="40" y="68">One review pipeline, two trust models — public and private</text>
  <text class="sub" x="40" y="90">A Chainlink CRE workflow runs an LLM review inside a TEE and writes a verifiable verdict on-chain. The code only leaves the enclave when it's already public.</text>

  <!-- PUBLIC source -->
  <rect x="40" y="150" width="212" height="80" rx="11" fill="var(--panel)" stroke="var(--teal)" stroke-opacity="0.6"/>
  <text class="tag" x="58" y="174" fill="var(--teal)">PUBLIC</text>
  <text class="ct" x="58" y="196" fill="var(--ink)">Public skill / package</text>
  <text class="cb" x="58" y="214">GitHub · npm · ClawHub</text>

  <!-- PRIVATE source -->
  <rect x="40" y="300" width="212" height="80" rx="11" fill="var(--panel)" stroke="var(--violet)" stroke-opacity="0.6"/>
  <text class="tag" x="58" y="324" fill="var(--violet)">PRIVATE</text>
  <text class="ct" x="58" y="346" fill="var(--ink)">Internal / enterprise skill</text>
  <text class="cb" x="58" y="364">never published</text>

  <!-- TEE enclave -->
  <rect x="332" y="150" width="290" height="230" rx="13" fill="var(--navy)"/>
  <use href="#lock" x="350" y="168" width="15" height="15" color="#7FE7D6"/>
  <text class="cw" x="374" y="180">Chainlink CRE · Confidential AI</text>
  <text class="cwb" x="350" y="200">TEE enclave — runs on a DON</text>
  <text class="cw" x="350" y="228">LLM reviews the code for:</text>
  <text class="cwb" x="350" y="247">· injection hidden in SKILL.md</text>
  <text class="cwb" x="350" y="265">· credential / exfil patterns</text>
  <text class="cwb" x="350" y="283">· obfuscation, malicious install scripts</text>
  <line x1="350" y1="300" x2="604" y2="300" stroke="#33405E"/>
  <text class="cwb" x="350" y="320">Remote attestation proves the pinned</text>
  <text class="cwb" x="350" y="337">model + prompt ran on this exact input</text>
  <text class="cw" x="350" y="364" fill="#7FE7D6">→ risk verdict + flags + proof</text>

  <!-- arrows in -->
  <path d="M252 190 L332 200" fill="none" stroke="var(--teal)" stroke-width="1.7" marker-end="url(#t)"/>
  <text class="lbl" x="258" y="182" fill="var(--teal)">open fetch</text>
  <path d="M252 340 L332 330" fill="none" stroke="var(--violet)" stroke-width="1.7" marker-end="url(#v)"/>
  <text class="lbl" x="258" y="362" fill="var(--violet)">confidential fetch</text>
  <text class="cb" x="258" y="378" fill="var(--violet)">creds decrypted in-enclave</text>

  <!-- enclave -> registry -->
  <path d="M622 265 L702 265" fill="none" stroke="var(--slate)" stroke-width="1.7" marker-end="url(#s)"/>
  <text class="lbl" x="628" y="256" fill="var(--slate)">verdict + proof</text>
  <text class="note" x="628" y="300" fill="var(--violet)">private: only the verdict</text>
  <text class="note" x="628" y="315" fill="var(--violet)">leaves — code never exposed</text>

  <!-- registry -->
  <rect x="702" y="190" width="216" height="150" rx="12" fill="var(--panel)" stroke="var(--line)"/>
  <text class="ct" x="720" y="216" fill="var(--ink)">On-chain registry</text>
  <text class="cb" x="720" y="234">ENS-named · append-only</text>
  <text class="mono" x="720" y="262" fill="var(--ink)">pinned hash</text>
  <text class="mono" x="720" y="282" fill="var(--ink)">risk verdict + proof</text>
  <text class="mono" x="720" y="302" fill="var(--ink)">revocations</text>
  <text class="cb" x="720" y="326">neutral — anyone reads it</text>

  <!-- registry -> gate -->
  <path d="M918 265 L998 265" fill="none" stroke="var(--slate)" stroke-width="1.7" marker-end="url(#s)"/>

  <!-- gate -->
  <rect x="998" y="150" width="204" height="230" rx="12" fill="var(--paper)" stroke="var(--line)"/>
  <text class="ct" x="1016" y="176" fill="var(--ink)">Load gate</text>
  <text class="cb" x="1016" y="194">runs in the agent / installer</text>
  <text class="mono" x="1016" y="220" fill="var(--ink)">hash == pinned?</text>
  <text class="mono" x="1016" y="240" fill="var(--ink)">verdict meets policy?</text>
  <text class="mono" x="1016" y="260" fill="var(--ink)">not revoked?</text>

  <rect x="1016" y="276" width="168" height="34" rx="8" fill="var(--teal-soft)" stroke="var(--teal)" stroke-opacity="0.6"/>
  <text class="lbl" x="1030" y="297" fill="var(--teal)">✓ run in sandbox</text>
  <rect x="1016" y="318" width="168" height="46" rx="8" fill="var(--danger-soft)" stroke="var(--danger)" stroke-opacity="0.6"/>
  <text class="lbl" x="1030" y="338" fill="var(--danger)">✕ block →</text>
  <text class="cb" x="1030" y="354">Ledger: human approves?</text>

  <!-- watcher loop -->
  <rect x="332" y="430" width="586" height="58" rx="11" fill="var(--panel)" stroke="var(--line)" stroke-dasharray="5 4"/>
  <text class="ct" x="352" y="454" fill="var(--ink)">CRE watcher (always on)</text>
  <text class="cb" x="352" y="473">re-hashes pins to catch drift / rug-pulls · relays OSV + GitHub advisories → writes revocations</text>
  <path d="M810 430 L810 342" fill="none" stroke="var(--amber)" stroke-width="1.6" stroke-dasharray="4 3" marker-end="url(#a)"/>

  <!-- value annotations -->
  <text class="lbl" x="40" y="250" fill="var(--teal)">public value:</text>
  <text class="cb" x="40" y="266">verifiable, reusable verdict —</text>
  <text class="cb" x="40" y="281">trust the pinned model + TEE,</text>
  <text class="cb" x="40" y="296">not the reviewer's word.</text>

  <text class="lbl" x="40" y="408" fill="var(--violet)">private value:</text>
  <text class="cb" x="40" y="424">reviewed without ever being</text>
  <text class="cb" x="40" y="439">exposed — only the verdict</text>
  <text class="cb" x="40" y="454">goes on-chain.</text>

  <!-- honest limit -->
  <text class="note" x="332" y="520" fill="var(--slate)">Honest limit: the TEE proves the model ran honestly — not that its judgment is right. The verdict is one weighted signal; the sandbox and the gate do the actual preventing.</text>
</svg>
`;

export function ArchitectureDiagram() {
  return (
    <div className="aegis-map min-w-[920px]" dangerouslySetInnerHTML={{ __html: SVG }} />
  );
}
