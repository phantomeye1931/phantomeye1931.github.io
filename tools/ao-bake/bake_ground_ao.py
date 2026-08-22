"""Bake a ground-contact AO shadow plane for a glTF model. Run headless:
flatpak run org.blender.Blender --background --python bake_ground_ao.py
Edit CONFIG below per model, then see process_ao_texture.py for the second step.
"""
import bpy
import bmesh
import math
import mathutils

CONFIG = {
    # Absolute paths only - Blender's flatpak sandboxes /tmp separately from
    # the host even with filesystem=host, so relative paths and /tmp both fail
    "model_path": "/home/phantom/IdeaProjects/PortfolioRefresh/website/public/phantomeye/models/guardian-stalker/Guardian_Stalker.gltf",
    "output_dir": "/home/phantom/IdeaProjects/PortfolioRefresh/website/public/phantomeye/models/guardian-stalker",
    "ground_glb_name": "Guardian_Stalker_Ground.glb",
    "raw_ao_png_name": "guardian_stalker_ao_raw.png",
    "blend_out_path": "/home/phantom/IdeaProjects/PortfolioRefresh/website/.blender-scratch/guardian_ao.blend",
    # Object name prefixes to exclude from the footprint bbox (e.g. a jutting
    # weapon/appendage that would otherwise skew the plane off-center). Still
    # participates in the actual bake as an occluder, just not the sizing math
    "exclude_from_footprint_prefixes": ["GeometryNode_94"],
    # Set root_object_name to correct a leaning/imprecise authored root
    # rotation. Find this by opening the model in Blender once, checking if
    # it stands upright/grounded, and if not, nudging Rotation X/Y/Z in the
    # N-panel until it does - the object may need rotation_mode switched to
    # 'XYZ' first, since imported nodes are often 'QUATERNION' by default and
    # silently ignore rotation_euler writes otherwise. Record the corrected
    # degrees here so re-runs are reproducible. Leave both None to skip
    "root_object_name": "Sketchfab_model",
    "root_rotation_fix_deg": (-90.0, 0.0, -53.5693),
    "margin_factor": 3.0,  # ground plane extent = footprint diagonal * this
    "image_size": 2048,
    "bake_samples": 128,
}


def main(cfg):
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)

    bpy.ops.import_scene.gltf(filepath=cfg["model_path"])
    model_objects = [o for o in bpy.data.objects if o.type == "MESH"]
    if not model_objects:
        raise RuntimeError("No mesh objects came in from the glTF import")

    if cfg["root_object_name"] and cfg["root_rotation_fix_deg"]:
        root = bpy.data.objects.get(cfg["root_object_name"])
        if root is None:
            raise RuntimeError(f"root_object_name {cfg['root_object_name']!r} not found")
        root.rotation_mode = "XYZ"  # imported nodes are often QUATERNION; euler writes no-op otherwise
        root.rotation_euler = tuple(math.radians(a) for a in cfg["root_rotation_fix_deg"])
        bpy.context.view_layer.update()

    exclude_prefixes = tuple(cfg["exclude_from_footprint_prefixes"])
    bbox_min = mathutils.Vector((math.inf, math.inf, math.inf))
    bbox_max = mathutils.Vector((-math.inf, -math.inf, -math.inf))
    for obj in model_objects:
        if obj.name.startswith(exclude_prefixes):
            continue
        for corner in obj.bound_box:
            world_co = obj.matrix_world @ mathutils.Vector(corner)
            bbox_min.x = min(bbox_min.x, world_co.x)
            bbox_min.y = min(bbox_min.y, world_co.y)
            bbox_min.z = min(bbox_min.z, world_co.z)
            bbox_max.x = max(bbox_max.x, world_co.x)
            bbox_max.y = max(bbox_max.y, world_co.y)
            bbox_max.z = max(bbox_max.z, world_co.z)

    center = (bbox_min + bbox_max) / 2
    size = bbox_max - bbox_min
    footprint_radius = max(size.x, size.y) / 2  # Blender is Z-up: X/Y are ground axes
    ground_half = footprint_radius * cfg["margin_factor"]

    print(f"[ao-bake] footprint size: {size.x:.3f} x {size.y:.3f}, height: {size.z:.3f}")
    print(f"[ao-bake] ground plane half-extent: {ground_half:.3f}, at z={bbox_min.z:.3f}")

    # Hand-built via bmesh, not bpy.ops.mesh.primitive_plane_add - operators
    # that need viewport/edit-mode context can fail when run headless or via
    # --python at startup; pure data API always works regardless of context
    mesh = bpy.data.meshes.new("GroundAO_Mesh")
    bm = bmesh.new()
    h = ground_half
    verts = [
        bm.verts.new((-h, -h, 0)),
        bm.verts.new((h, -h, 0)),
        bm.verts.new((h, h, 0)),
        bm.verts.new((-h, h, 0)),
    ]
    face = bm.faces.new(verts)
    bm.faces.ensure_lookup_table()
    uv_layer = bm.loops.layers.uv.new()
    for loop, uv in zip(face.loops, [(0, 0), (1, 0), (1, 1), (0, 1)]):
        loop[uv_layer].uv = uv
    bm.to_mesh(mesh)
    bm.free()

    plane = bpy.data.objects.new("GroundAO", mesh)
    plane.location = (center.x, center.y, bbox_min.z)
    bpy.context.collection.objects.link(plane)

    mat = bpy.data.materials.new("GroundAO_Mat")
    mat.use_nodes = True
    plane.data.materials.append(mat)

    img = bpy.data.images.new("GroundAO_Bake", width=cfg["image_size"], height=cfg["image_size"], alpha=True)
    nt = mat.node_tree
    tex_node = nt.nodes.new("ShaderNodeTexImage")
    tex_node.image = img
    bsdf = nt.nodes.get("Principled BSDF")
    if bsdf is not None:
        nt.links.new(tex_node.outputs["Color"], bsdf.inputs["Base Color"])
    for n in nt.nodes:
        n.select = False
    tex_node.select = True
    nt.nodes.active = tex_node

    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = cfg["bake_samples"]
    scene.cycles.bake_type = "AO"
    # Plain AO, NOT "selected to active" - that mode needs exact selection
    # state (source objects selected, target active, nothing else) and in
    # practice threw "no valid selected objects", "not a mesh" errors on
    # loose selection, and a silent all-black bake from a "circular
    # dependency" warning even once selection was correct. Plain AO with only
    # the plane selected/active just reads real scene geometry - no cage,
    # no selection choreography, and it's what actually produced real data
    scene.render.bake.use_selected_to_active = False
    scene.render.bake.margin = 16
    try:
        scene.world.light_settings.distance = size.z * 0.6
    except Exception as e:
        print(f"[ao-bake] could not set AO distance: {e}")

    bpy.ops.object.select_all(action="DESELECT")
    plane.select_set(True)
    bpy.context.view_layer.objects.active = plane

    print("[ao-bake] baking...")
    bpy.ops.object.bake(type="AO")
    print("[ao-bake] bake done")

    img.update()
    px = img.pixels[:]
    sample = px[len(px) // 2 - 4000 : len(px) // 2]
    print(f"[ao-bake] center-region sample min={min(sample):.4f} max={max(sample):.4f}")

    raw_png_path = f"{cfg['output_dir']}/{cfg['raw_ao_png_name']}"
    img.filepath_raw = raw_png_path
    img.file_format = "PNG"
    img.save()
    print(f"[ao-bake] saved raw AO png to {raw_png_path}")

    ground_glb_path = f"{cfg['output_dir']}/{cfg['ground_glb_name']}"
    bpy.ops.object.select_all(action="DESELECT")
    plane.select_set(True)
    bpy.context.view_layer.objects.active = plane
    bpy.ops.export_scene.gltf(
        filepath=ground_glb_path,
        export_format="GLB",  # GLTF_EMBEDDED doesn't exist in Blender 5.x; GLB or GLTF_SEPARATE only
        use_selection=True,
        export_yup=True,
    )
    print(f"[ao-bake] exported ground plane to {ground_glb_path}")

    bpy.ops.wm.save_as_mainfile(filepath=cfg["blend_out_path"])
    print(f"[ao-bake] saved blend to {cfg['blend_out_path']}")
    print("[ao-bake] next: run process_ao_texture.py on the raw png")


main(CONFIG)
