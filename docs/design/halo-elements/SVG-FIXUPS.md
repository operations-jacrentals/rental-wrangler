# Merged-artwork SVG fixups — apply during the CSS/HTML conversion

## Why this file exists

Some kit artwork is **flattened** into single `VECTOR` nodes named `Merged artwork`,
where every sub-shape is a *region* carrying its own paint. Figma's plugin API cannot
recolour these:

- `node.fills` reports `figma.mixed` (paint lives per-region, not on the node), so a
  wholesale fill assignment is unavailable — and would flatten all regions to one colour anyway.
- `setVectorNetworkAsync()` accepts a `regions[].fills` array, returns **no error**, and
  **silently discards it** — it writes geometry only. Verified on node `212:79`
  (289 vertices / 326 segments / 36 regions): write succeeded, read-back byte-identical.

This is a Figma-side ceiling, not a canon question. **On SVG export each region becomes an
editable `fill="…"` attribute**, so the conversion is the correct place to fix these.

## Apply these substitutions to exported SVG

| Replace | With | Token | Why |
|---|---|---|---|
| `#ff8078` | `#ff7878` | `--red-hot` | conduit lit core — a state, must ride the canon red ramp |
| `#354843` | `#333f47` | `--steel-20`-ish | bulb seat; warm green-grey → cool steel axis |
| `#f95a5c` | `#ff4242` | `--red` | off-canon red (ring halo stroke) |
| `#f2585a` | `#ff4242` | `--red` | off-canon red (board label) |
| `#f4f9fa` | `#eef2f7` | `--txt` | off-canon near-white |
| `#1c1613` | `#1a212b` | `--card-head` | warm ground → cool |
| `#100708` `#150608` `#150506` `#0f0102` `#150204` | `#0a0d11` | `--bg` | board plate gradient stops |
| `#1b0507` `#190306` `#1a0405` `#1a0404` `#170303` `#100202` | `#0a0d11` | `--bg` | ditto |

Residual scale: **~85 of 7,845 paints (1.1%)**, confined to `Merged artwork` vectors and
instance sublayers that inherit from them.

## Alternative, if you'd rather fix it in Figma first

Un-flatten the affected vectors (`212:79`, `238:2296/2320/2331/2335`, `260:2607`,
`283:177/196/198/203/205/210/380`) into separate shapes with uniform fills. Then the same
recolour pass that worked on the bulbs will reach them. Costs geometry re-authoring —
only worth it if the kit stays Figma-first rather than moving to code.
