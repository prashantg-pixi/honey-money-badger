# raw-assets — source art for Honey Money Badger

Source art lives here. **Nothing in this folder is loaded at runtime.** `veyra-assetpack` packs it into
spritesheets plus a Pixi manifest under `public/assets/`, and the game references assets by **alias or
id** — never by path (03 §7, FR-SYS-1, 07 B5). `public/assets/` is generated and git-ignored.

```
pnpm assets          # one-shot build: raw-assets/ -> public/assets/
pnpm assets:watch    # rebuild on change; the Testing Ground hot-reloads the new textures (05 §3)
```

## Layout

A folder tagged `{m}` becomes one **manifest bundle**; a folder inside it becomes one spritesheet. A
story declares the bundles it needs and the Testing Ground loads only those, so you can inspect a
single symbol without loading the whole game (05 §3, FR-DEV-3).

```
raw-assets/
  sprites{m}/            -> bundle "sprites"
    symbols/             -> spritesheet "symbols.json"
      placeholder.png       (delete this once you have real symbol art)
    ui/                  -> spritesheet "ui.json"
  spines{m}/             -> bundle "spines" (Spine .json + .atlas + texture, added together)
  audio/                 -> sound sprites
  fonts/
```

`placeholder.png` exists for one reason: AssetPack needs at least one asset to emit a manifest, and the
Testing Ground fetches `assets/manifest.json` on boot. Name your real frames after the symbol ids in
`src/game/symbols.ts` and the registry picks them up with no other change — until then every symbol
renders as its placeholder tint, which is exactly what the headless golden frames see.
