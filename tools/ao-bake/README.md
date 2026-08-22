# Ground-contact AO baking

Process for generating a baked ambient-occlusion "contact shadow" ground plane for a
glTF model, and wiring it into a three.js scene with the plane's alignment guaranteed
by construction instead of hand-tuned coordinates. Built out of the PhantomEye guardian
stalker pipeline (`public/phantomeye/models/guardian-stalker/`) — read that as the
worked example alongside this doc.

Blender is used headless throughout except step 1. Installed via Flatpak here
(`org.blender.Blender`); adjust the invocation if installed differently.

## Prerequisites

- `flatpak run org.blender.Blender --version` works
- Python 3 with `pillow` and `numpy` available for the texture post-process step
- **Always use absolute paths.** Blender's Flatpak sandbox has host filesystem access
  but still gives `/tmp` its own private mount even with `filesystem=host` — a script
  path under `/tmp` will fail with "could not be opened". Keep working scripts/output
  inside the project directory (e.g. `.blender-scratch/`, gitignored).

## Step 1 — check the model stands upright (GUI, once per model)

Not automatable in general: "upright" can only be judged by eye, and a model's
authored root rotation isn't guaranteed to be exactly right even when it looks close.

```sh
flatpak run org.blender.Blender --python /path/to/import_only.py
```

(or just File → Import → glTF 2.0 by hand). Add a temporary flat plane at the
model's lowest point as a ground reference and check the feet/base actually sit
on it, not floating or clipping through.

If it leans: select the root object, check its **rotation mode** in the N-panel
(imported nodes are often `QUATERNION` — switch it to `XYZ` first, or edits to the
Euler fields silently do nothing). Nudge Rotation X/Y/Z until it's flush, note the
object's name and the corrected degrees, and put them in `CONFIG` in
`bake_ground_ao.py` as `root_object_name` / `root_rotation_fix_deg`. Leave both
`None` if the model is already upright.

## Step 2 — bake (headless, one command)

Edit `CONFIG` at the top of `bake_ground_ao.py` for the new model: `model_path`,
`output_dir`, the rotation fix from step 1 (if any), and `exclude_from_footprint_prefixes`
if the model has a jutting appendage (weapon, tail, wing) that would drag the plane's
centering off — exclude it from the *footprint* box only; it still casts real
occlusion in the bake.

```sh
flatpak run org.blender.Blender --background --python bake_ground_ao.py
```

This imports the model, applies the rotation fix, computes the footprint bounding
box, builds the ground plane sized to `margin_factor × ` the footprint diagonal,
bakes plain Ambient Occlusion (see gotchas — deliberately *not* "Selected to Active"),
and writes:

- a raw grayscale AO PNG into `output_dir`
- the ground plane geometry alone as its own `.glb` into `output_dir`
- a `.blend` snapshot for later inspection/re-export

Check the console output: footprint size/height should be plausible for the model,
and the center-region pixel sample shouldn't read `min=1.0000 max=1.0000` (flat —
means nothing baked) or all zero.

## Step 3 — process the texture (headless, one command)

```sh
python3 process_ao_texture.py \
  /path/to/output_dir/raw_ao.png \
  /path/to/output_dir/images/model_ground_ao.png \
  --intensity 0.7
```

Converts the grayscale bake into black RGB + alpha = occlusion (capped at
`--intensity`), and applies a vertical flip that's been empirically necessary
every time so far (see gotchas). `--intensity` is the easiest lever if the shadow
reads too strong or too faint — no Blender re-run needed, just re-run this script
on the same raw PNG.

## Step 4 — wire into three.js

The alignment trick: build and export the plane from the model's own *untouched*
import coordinates, then in three.js parent it as a child of the model's root
`Object3D` rather than positioning it by hand. Any centering translation applied
to that parent is inherited automatically — nothing to transcribe, nothing to
get subtly wrong.

```ts
const groundTexture = new THREE.TextureLoader().load(GROUND_AO_TEXTURE_URL);

new GLTFLoader().load(MODEL_URL, (gltf) => {
	// ... existing centering: gltf.scene.position.sub(center) ...

	new GLTFLoader().load(GROUND_GLB_URL, (groundGltf) => {
		groundGltf.scene.traverse((child) => {
			if ((child as THREE.Mesh).isMesh) {
				(child as THREE.Mesh).material = new THREE.MeshBasicMaterial({
					map: groundTexture,
					color: 0x000000,
					transparent: true,
					depthWrite: false,
				});
			}
		});
		gltf.scene.add(groundGltf.scene); // inherits gltf.scene's centering, no manual coords
	});
});
```

`depthWrite: false` keeps it from fighting other transparent objects (e.g. a glow
effect) in the depth buffer; `depthTest` stays on by default so the opaque model
still correctly occludes the plane where they overlap.

If a rotation fix was applied in step 1, apply the *exact same* correction here too,
or the live render and the bake will disagree — see gotchas for how to derive the
right quaternion instead of guessing.

## Gotchas (all hit for real, once each)

- **Flatpak `/tmp` isolation** — see Prerequisites. Cost the first attempt an
  immediate failure before anything ran.
- **`export_format="GLTF_EMBEDDED"` doesn't exist** in Blender 5.x's exporter enum —
  only `GLB` or `GLTF_SEPARATE`. Use `GLB` for a single self-contained file.
- **`rotation_mode` silently breaks Euler edits** — glTF-imported objects often
  come in as `QUATERNION` mode. Setting `.rotation_euler` while in that mode is a
  no-op with no error; the object just doesn't move. Always set
  `obj.rotation_mode = "XYZ"` first if you're going to write Euler degrees.
- **"Selected to Active" AO baking is the wrong tool here.** It's built for
  projecting high-poly detail onto a *different* low-poly target (normal-map
  baking), not "compute AO of this plane with the character standing near it."
  In practice it produced, in order: `No valid selected objects`, `Object ... is
  not a mesh` (because `Select All` grabs the model's non-mesh empty/joint nodes
  too — use Select → Select All by Type → Mesh if doing this by hand), a
  `Circular dependency for image` warning, and finally a bake that reported
  success but wrote all-zero pixels. Plain AO (`use_selected_to_active = False`,
  only the plane selected+active, nothing else selected) just works — it computes
  real ray-traced occlusion from whatever's actually in the scene.
- **Build the plane via `bmesh`, not `bpy.ops.mesh.primitive_plane_add()` +
  `bpy.ops.object.mode_set()`.** Those operators can need a valid viewport/edit-mode
  context that may not exist when a script runs via `--python` at startup or fully
  headless. Raw `bmesh` + `bpy.data` calls are pure data API and always work
  regardless of how the script is invoked.
- **The baked texture needed a vertical flip** to line up correctly once loaded
  in three.js — without it, the shadow's shape (which isn't symmetric — it follows
  the actual leg positions) was mirrored front-to-back relative to the model. Prime
  suspect is Blender's UV V=0-at-bottom vs glTF's V=0-at-top convention interacting
  oddly with this Blender version's PNG export, but this wasn't root-caused for
  certain — `process_ao_texture.py` flips by default (`--no-flip` to disable).
  If a future model comes out mirrored *the other way*, that's the first thing to
  toggle.
- **Deriving a rotation fix for three.js: don't hand-derive the Blender Z-up →
  glTF Y-up conversion.** It's easy to get a sign wrong. Instead, set the corrected
  `rotation_euler` on the root object in Blender, select just that object, export it
  alone as its own tiny `.gltf`, and read the `rotation` quaternion straight out of
  the exported JSON — that's exactly the value three.js needs, computed by Blender's
  own (trustworthy) exporter instead of by hand.
- **A temporary WASD orbit control** (in `HeroSection.astro`, guarded/removable) was
  what actually made the mirrored-texture bug visible — the fitted orthographic
  camera crops tightly to the model by default, so a misaligned plane can be sitting
  fully out of frame or barely visible face-on. Worth re-adding (or keeping, gated
  behind a query param) for the next model's inspection pass rather than eyeballing
  a single fixed angle.
