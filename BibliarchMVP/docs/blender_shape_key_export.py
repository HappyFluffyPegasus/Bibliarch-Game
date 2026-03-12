import bpy
import json
import os
import time

def get_evaluated_positions(obj, depsgraph):
    eval_obj = obj.evaluated_get(depsgraph)
    eval_mesh = eval_obj.to_mesh()
    positions = [list(v.co) for v in eval_mesh.vertices]
    eval_obj.to_mesh_clear()
    return positions

def export_shape_keys_for_object(obj, depsgraph):
    if not obj.data.shape_keys:
        return None
    shape_keys = obj.data.shape_keys.key_blocks
    if len(shape_keys) < 2:
        return None

    basis_key = shape_keys[0]
    base_positions = [[v.co[0], v.co[1], v.co[2]] for v in basis_key.data]

    for sk in shape_keys:
        sk.value = 0.0
    depsgraph.update()
    eval_positions = get_evaluated_positions(obj, depsgraph)

    has_mirror = any(m.type == 'MIRROR' and m.show_viewport for m in obj.modifiers)
    mirror_axis = 0
    if has_mirror:
        for m in obj.modifiers:
            if m.type == 'MIRROR' and m.show_viewport:
                if m.use_axis[0]: mirror_axis = 0
                elif m.use_axis[1]: mirror_axis = 1
                elif m.use_axis[2]: mirror_axis = 2
                break

    result = {
        "mesh_name": obj.name,
        "vertex_count": len(base_positions),
        "base_positions": base_positions,
        "eval_positions": eval_positions,
        "has_mirror": has_mirror,
        "mirror_axis": mirror_axis,
        "shape_keys": {}
    }

    for sk in shape_keys:
        if sk.name == "Basis":
            continue
        deltas = {}
        for i, (bv, sv) in enumerate(zip(basis_key.data, sk.data)):
            dx = sv.co[0] - bv.co[0]
            dy = sv.co[1] - bv.co[1]
            dz = sv.co[2] - bv.co[2]
            if abs(dx) > 0.0001 or abs(dy) > 0.0001 or abs(dz) > 0.0001:
                deltas[str(i)] = [round(dx, 6), round(dy, 6), round(dz, 6)]
        if deltas:
            result["shape_keys"][sk.name] = {
                "min": sk.slider_min,
                "max": sk.slider_max,
                "deltas": deltas
            }
            print(f"  Shape key '{sk.name}': {len(deltas)} vertices affected")
        else:
            print(f"  Shape key '{sk.name}': no vertex movement (skipped)")

    for sk in shape_keys:
        sk.value = 0.0
    depsgraph.update()
    return result

def main():
    start_time = time.time()
    selected = [o for o in bpy.context.selected_objects if o.type == 'MESH']
    if not selected:
        selected = [o for o in bpy.data.objects
                    if o.type == 'MESH' and o.data.shape_keys
                    and len(o.data.shape_keys.key_blocks) > 1]
    if not selected:
        print("ERROR: No mesh objects with shape keys found!")
        return
    print(f"Exporting shape keys for {len(selected)} object(s)...")
    depsgraph = bpy.context.evaluated_depsgraph_get()
    export_data = {
        "version": 3,
        "generator": "Bibliarch Shape Key Exporter",
        "meshes": {}
    }
    for obj in selected:
        print(f"\nProcessing: {obj.name}")
        mesh_data = export_shape_keys_for_object(obj, depsgraph)
        if mesh_data:
            export_data["meshes"][obj.name] = mesh_data
    blend_dir = os.path.dirname(bpy.data.filepath) if bpy.data.filepath else os.getcwd()
    output_path = os.path.join(blend_dir, "shape_keys.json")
    with open(output_path, 'w') as f:
        json.dump(export_data, f)
    file_size = os.path.getsize(output_path)
    elapsed = time.time() - start_time
    total_keys = sum(len(m["shape_keys"]) for m in export_data["meshes"].values())
    print(f"\nExported {total_keys} shape keys from {len(export_data['meshes'])} mesh(es)")
    print(f"Saved to: {output_path}")
    print(f"File size: {file_size / 1024:.1f} KB")
    print(f"Time: {elapsed:.1f}s")

main()
