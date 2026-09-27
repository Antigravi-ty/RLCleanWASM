#!/usr/bin/env python3
"""
RLViser Stadium Scene Exporter
Exports authentic Rocket League Stadium (DFH Stadium) from RLViser cache into:
- glTF 2.0 Binary (.glb) for Three.js / WebGL / RLCleanWASM
- Wavefront OBJ (.obj + .mtl) for Blender, Unity, Unreal Engine
"""

import sys, os, json, struct, math, argparse, subprocess, zipfile

BLACKLIST_MESH_MATS = {
    'CollisionMeshes.Collision_Mat',
    'Stadium_Assets.Materials.Grass_LOD_Team1_MIC',
    'FutureTech.Materials.Glass_Projected_V2_Team2_MIC',
    'FutureTech.Materials.Glass_Projected_V2_Mat',
    'Trees.Materials.TreeBark_Mat',
    'FutureTech.Materials.TrimLight_None_Mat',
    'City.Materials.Asphalt_Simple_MAT',
    'Graybox_Assets.Materials.NetNonmove_Mat',
}

def parse_bin_mesh(data):
    offset = 0
    num_ids = struct.unpack_from('<Q', data, offset)[0]; offset += 8
    ids = struct.unpack_from(f'<{num_ids}I', data, offset); offset += 4 * num_ids
    num_verts = struct.unpack_from('<Q', data, offset)[0]; offset += 8
    verts = struct.unpack_from(f'<{num_verts}f', data, offset); offset += 4 * num_verts
    num_uvs = struct.unpack_from('<Q', data, offset)[0]; offset += 8
    uvs = struct.unpack_from(f'<{num_uvs * 2}f', data, offset); offset += 8 * num_uvs
    num_colors = struct.unpack_from('<Q', data, offset)[0]; offset += 8
    colors = struct.unpack_from(f'<{num_colors * 4}f', data, offset); offset += 16 * num_colors
    num_materials = struct.unpack_from('<Q', data, offset)[0]; offset += 8
    num_mat_ids = struct.unpack_from('<Q', data, offset)[0]; offset += 8
    mat_ids = struct.unpack_from(f'<{num_mat_ids}Q', data, offset); offset += 8 * num_mat_ids
    return {
        'ids': list(ids),
        'verts': list(verts),
        'uvs': list(uvs),
        'colors': list(colors),
        'num_materials': num_materials,
        'mat_ids': list(mat_ids)
    }

def compute_smooth_normals(verts, ids):
    n_verts = len(verts) // 3
    normals = [0.0] * (n_verts * 3)
    for i in range(0, len(ids), 3):
        i0, i1, i2 = ids[i], ids[i+1], ids[i+2]
        if i0 >= n_verts or i1 >= n_verts or i2 >= n_verts:
            continue
        v0 = verts[i0*3 : i0*3+3]
        v1 = verts[i1*3 : i1*3+3]
        v2 = verts[i2*3 : i2*3+3]
        ax, ay, az = v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]
        bx, by, bz = v2[0] - v0[0], v2[1] - v0[1], v2[2] - v0[2]
        nx = ay * bz - az * by
        ny = az * bx - ax * bz
        nz = ax * by - ay * bx
        normals[i0*3] += nx; normals[i0*3+1] += ny; normals[i0*3+2] += nz
        normals[i1*3] += nx; normals[i1*3+1] += ny; normals[i1*3+2] += nz
        normals[i2*3] += nx; normals[i2*3+1] += ny; normals[i2*3+2] += nz
    
    for i in range(n_verts):
        nx, ny, nz = normals[i*3], normals[i*3+1], normals[i*3+2]
        length = math.sqrt(nx*nx + ny*ny + nz*nz)
        if length > 1e-6:
            normals[i*3] = nx / length
            normals[i*3+1] = ny / length
            normals[i*3+2] = nz / length
        else:
            normals[i*3] = 0.0
            normals[i*3+1] = 1.0
            normals[i*3+2] = 0.0
    return normals

def euler_zyx_to_quat(x_deg, y_deg, z_deg):
    z_rad = math.radians(z_deg)
    y_rad = math.radians(-y_deg)
    x_rad = math.radians(x_deg)

    def axis_angle(ax, ay, az, angle):
        half = angle * 0.5
        s = math.sin(half)
        return (ax * s, ay * s, az * s, math.cos(half))

    def quat_mult(q1, q2):
        x1, y1, z1, w1 = q1
        x2, y2, z2, w2 = q2
        return (
            w1 * x2 + x1 * w2 + y1 * z2 - z1 * y2,
            w1 * y2 - x1 * z2 + y1 * w2 + z1 * x2,
            w1 * z2 + x1 * y2 - y1 * x2 + z1 * w2,
            w1 * w2 - x1 * x2 - y1 * y2 - z1 * z2
        )

    qz = axis_angle(0, 0, 1, z_rad)
    qy = axis_angle(0, 1, 0, y_rad)
    qx = axis_angle(1, 0, 0, x_rad)
    q = quat_mult(quat_mult(qz, qy), qx)
    l = math.sqrt(sum(x*x for x in q))
    if l > 1e-6:
        return [x/l for x in q]
    return [0.0, 0.0, 0.0, 1.0]

def quat_rotate_vec3(q, v):
    qx, qy, qz, qw = q
    vx, vy, vz = v
    # t = 2 * cross(q.xyz, v)
    tx = 2.0 * (qy * vz - qz * vy)
    ty = 2.0 * (qz * vx - qx * vz)
    tz = 2.0 * (qx * vy - qy * vx)
    # v + qw * t + cross(q.xyz, t)
    rx = vx + qw * tx + (qy * tz - qz * ty)
    ry = vy + qw * ty + (qz * tx - qx * tz)
    rz = vz + qw * tz + (qx * ty - qy * tx)
    return [rx, ry, rz]

def get_material_def(mat_name, side_signum, tex_indices):
    key = f"{mat_name}_{side_signum}"
    double_sided = True
    alpha_mode = "OPAQUE"
    base_color = [0.6, 0.6, 0.6, 1.0]
    metallic = 0.1
    roughness = 0.7
    emissive = None
    tex_info = None

    if "ForceField_Mat" in mat_name:
        alpha_mode = "BLEND"
        base_color = [0.3, 0.6, 1.0, 0.5]
        roughness = 0.2
        metallic = 0.0
        emissive = [0.15, 0.35, 0.65]
        if 'ForcefieldHex' in tex_indices:
            tex_info = {"index": tex_indices['ForcefieldHex']}
    elif "ForceField_HexGage" in mat_name:
        alpha_mode = "BLEND"
        base_color = [0.8, 0.4, 0.1, 0.6]
        roughness = 0.3
        emissive = [0.4, 0.2, 0.05]
        if 'Curve_Fire_01_Pack' in tex_indices:
            tex_info = {"index": tex_indices['Curve_Fire_01_Pack']}
    elif "HexGlass_WithArrows" in mat_name:
        alpha_mode = "BLEND"
        if side_signum < 0 or "Team1" in mat_name:
            base_color = [0.34, 0.53, 0.78, 0.75]
        else:
            base_color = [0.87, 0.57, 0.32, 0.75]
        roughness = 0.2
        metallic = 0.0
        if 'ENVPack' in tex_indices:
            tex_info = {"index": tex_indices['ENVPack']}
    elif "Grass_Base" in mat_name:
        base_color = [0.17, 0.23, 0.27, 1.0]
        roughness = 0.85
        metallic = 0.0
    elif "Reflective_Floor" in mat_name or "BackBoard_Teams" in mat_name:
        if side_signum < 0:
            base_color = [0.34, 0.53, 0.78, 1.0]
        elif side_signum > 0:
            base_color = [0.87, 0.57, 0.32, 1.0]
        else:
            base_color = [0.51, 0.56, 0.45, 1.0]
        roughness = 0.35
        metallic = 0.15
    elif "PaintedLine" in mat_name:
        base_color = [0.93, 0.94, 0.96, 1.0]
        roughness = 0.5
        metallic = 0.0
    elif "Frame_01_White" in mat_name:
        base_color = [0.75, 0.75, 0.78, 1.0]
        roughness = 0.4
        metallic = 0.5
    elif "Frame_01" in mat_name or "Trim" in mat_name:
        base_color = [0.22, 0.16, 0.22, 1.0]
        roughness = 0.5
        metallic = 0.4
    elif "CrossHatched" in mat_name:
        base_color = [0.8, 0.3, 0.2, 1.0]
        roughness = 0.6
        metallic = 0.3
    elif "BoostPad" in mat_name:
        base_color = [0.65, 0.15, 0.10, 1.0]
        emissive = [0.3, 0.05, 0.02]
        roughness = 0.4
        metallic = 0.2
    elif "GoalGenerator" in mat_name:
        if side_signum < 0:
            base_color = [0.2, 0.5, 1.0, 1.0]
            emissive = [0.3, 0.6, 1.0]
        else:
            base_color = [1.0, 0.5, 0.1, 1.0]
            emissive = [1.0, 0.5, 0.1]
    elif "Advert" in mat_name:
        base_color = [0.75, 0.75, 0.75, 1.0]
        roughness = 0.5
        metallic = 0.2
    elif "DarkMetal" in mat_name:
        base_color = [0.25, 0.25, 0.27, 1.0]
        roughness = 0.5
        metallic = 0.6
    else:
        base_color = [0.55, 0.55, 0.58, 1.0]
        roughness = 0.6
        metallic = 0.2

    mat_dict = {
        "name": key,
        "pbrMetallicRoughness": {
            "baseColorFactor": base_color,
            "metallicFactor": metallic,
            "roughnessFactor": roughness
        },
        "doubleSided": double_sided
    }
    if tex_info:
        mat_dict["pbrMetallicRoughness"]["baseColorTexture"] = tex_info
    if alpha_mode != "OPAQUE":
        mat_dict["alphaMode"] = alpha_mode
    if emissive:
        mat_dict["emissiveFactor"] = emissive

    return key, mat_dict

def export_stadium(rlviser_dir, output_dir, export_formats):
    print("=== RLViser Stadium Exporter ===")
    os.makedirs(output_dir, exist_ok=True)

    cache_zip_path = os.path.join(rlviser_dir, "cache.zip")
    stadium_json_path = os.path.join(rlviser_dir, "stadiums/Stadium_P_MeshObjects.json")

    mesh_bytes_map = {}
    tex_bytes_map = {}

    if os.path.exists(cache_zip_path):
        print(f"Reading assets from zip: {cache_zip_path}")
        with zipfile.ZipFile(cache_zip_path, 'r') as zf:
            for item in zf.namelist():
                if item.startswith("cache/mesh/") and item.endswith(".bin"):
                    fname = os.path.basename(item)
                    mesh_bytes_map[fname] = zf.read(item)
                elif item.startswith("cache/textures/") and item.endswith(".tga"):
                    tga_name = os.path.splitext(os.path.basename(item))[0]
                    tga_bytes = zf.read(item)
                    # Convert to png via ffmpeg
                    tmp_tga = f"/tmp/{tga_name}.tga"
                    tmp_png = f"/tmp/{tga_name}.png"
                    with open(tmp_tga, "wb") as f:
                        f.write(tga_bytes)
                    subprocess.run(["ffmpeg", "-y", "-i", tmp_tga, "-update", "1", tmp_png],
                                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                    if os.path.exists(tmp_png):
                        with open(tmp_png, "rb") as f:
                            tex_bytes_map[tga_name] = f.read()

    print(f"Loaded {len(mesh_bytes_map)} mesh assets, {len(tex_bytes_map)} texture assets")

    with open(stadium_json_path) as f:
        layout_data = json.load(f)

    pickup_boost, structures, the_world = layout_data[0], layout_data[1], layout_data[2]
    persistent_level = the_world['subNodes'][0]
    all_nodes = list(persistent_level['subNodes'])
    if structures and 'subNodes' in structures and len(structures['subNodes']) > 0 and 'subNodes' in structures['subNodes'][0]:
        all_nodes.extend(structures['subNodes'][0]['subNodes'])

    def get_info_nodes(obj):
        has_loc = any(k in obj for k in ['Location', 'Rotation', 'Scale'])
        if has_loc and 'subNodes' in obj and len(obj['subNodes']) > 0:
            first = obj['subNodes'][0]
            return [{
                'static_mesh': first.get('StaticMesh', ''),
                'materials': first.get('Materials', []),
                'translation': obj.get('Location'),
                'rotation': obj.get('Rotation'),
                'scale': obj.get('Scale'),
                'name': obj.get('name')
            }]
        nodes = []
        for sub in obj.get('subNodes', []):
            nodes.append({
                'static_mesh': sub.get('StaticMesh', ''),
                'materials': sub.get('Materials', []),
                'translation': sub.get('Translation'),
                'rotation': sub.get('Rotation'),
                'scale': sub.get('Scale'),
                'name': sub.get('name')
            })
        return nodes

    mesh_data_cache = {}

    if "glb" in export_formats or "all" in export_formats:
        print("\n--- Generating glTF 2.0 Binary (.glb) ---")
        bin_bytes = bytearray()
        buffer_views = []
        accessors = []

        def add_buffer_view(data, target=None):
            while len(bin_bytes) % 4 != 0:
                bin_bytes.append(0)
            offset = len(bin_bytes)
            bin_bytes.extend(data)
            bv = {"buffer": 0, "byteOffset": offset, "byteLength": len(data)}
            if target:
                bv["target"] = target
            buffer_views.append(bv)
            return len(buffer_views) - 1

        images = []
        textures = []
        tex_indices = {}
        for name, data in tex_bytes_map.items():
            bv_idx = add_buffer_view(data)
            images.append({"bufferView": bv_idx, "mimeType": "image/png", "name": name})
            img_idx = len(images) - 1
            textures.append({"source": img_idx, "name": f"{name}_tex"})
            tex_indices[name] = len(textures) - 1

        materials = []
        material_map = {}

        def get_material_index(mat_name, side_signum):
            key, mat_dict = get_material_def(mat_name, side_signum, tex_indices)
            if key not in material_map:
                materials.append(mat_dict)
                material_map[key] = len(materials) - 1
            return material_map[key]

        mesh_base_accessors = {}
        for obj in all_nodes:
            for node in get_info_nodes(obj):
                sm = node['static_mesh']
                if not sm or not sm.strip(): continue
                mesh_name = sm.split('.')[-1]
                fname = f"{mesh_name}.bin"
                if fname not in mesh_bytes_map: continue
                if mesh_name not in mesh_data_cache:
                    mdata = parse_bin_mesh(mesh_bytes_map[fname])
                    mesh_data_cache[mesh_name] = mdata

                    verts = mdata['verts']
                    ids = mdata['ids']
                    uvs = mdata['uvs']
                    norms = compute_smooth_normals(verts, ids)
                    n_verts = len(verts) // 3

                    pos_bytes = struct.pack(f'<{len(verts)}f', *verts)
                    pos_bv = add_buffer_view(pos_bytes, target=34962)
                    accessors.append({
                        "bufferView": pos_bv,
                        "byteOffset": 0,
                        "componentType": 5126,
                        "count": n_verts,
                        "type": "VEC3",
                        "min": [min(verts[0::3]), min(verts[1::3]), min(verts[2::3])],
                        "max": [max(verts[0::3]), max(verts[1::3]), max(verts[2::3])]
                    })
                    pos_acc = len(accessors) - 1

                    norm_bytes = struct.pack(f'<{len(norms)}f', *norms)
                    norm_bv = add_buffer_view(norm_bytes, target=34962)
                    accessors.append({
                        "bufferView": norm_bv,
                        "byteOffset": 0,
                        "componentType": 5126,
                        "count": n_verts,
                        "type": "VEC3"
                    })
                    norm_acc = len(accessors) - 1

                    if uvs:
                        uv_bytes = struct.pack(f'<{len(uvs)}f', *uvs)
                        uv_bv = add_buffer_view(uv_bytes, target=34962)
                        accessors.append({
                            "bufferView": uv_bv,
                            "byteOffset": 0,
                            "componentType": 5126,
                            "count": n_verts,
                            "type": "VEC2"
                        })
                        uv_acc = len(accessors) - 1
                    else:
                        uv_acc = None

                    mesh_base_accessors[mesh_name] = (pos_acc, norm_acc, uv_acc)

        gltf_meshes = []
        gltf_nodes = []

        for obj in all_nodes:
            for node in get_info_nodes(obj):
                sm = node['static_mesh']
                if not sm or not sm.strip(): continue
                mesh_name = sm.split('.')[-1]
                if mesh_name not in mesh_data_cache: continue
                mdata = mesh_data_cache[mesh_name]
                pos_acc, norm_acc, uv_acc = mesh_base_accessors[mesh_name]

                t = node.get('translation') or [0.0, 0.0, 0.0]
                r = node.get('rotation') or [0.0, 0.0, 0.0]
                s = node.get('scale') or [1.0, 1.0, 1.0]

                tx, ty, tz = float(t[0]), float(t[2]), float(t[1])
                if "Grass.Grass" in sm or "Grass_1x1" in sm:
                    ty += 10.0
                quat = euler_zyx_to_quat(r[0], r[1], r[2])
                sx, sy, sz = float(s[0]), float(s[2]), float(s[1])

                side_signum = 0
                if 'BBall_HoopBackBoard_02' in sm:
                    side_signum = -1 if node.get('rotation') else 1
                elif t:
                    side_signum = -1 if t[1] < 0 else (1 if t[1] > 0 else 0)

                mats = node.get('materials') or ['']
                num_m = mdata['num_materials']

                if num_m < 2:
                    sub_mesh_tri_ids = [mdata['ids']]
                else:
                    sub_mesh_tri_ids = []
                    mat_ids = mdata['mat_ids']
                    ids = mdata['ids']
                    for mat_id in range(num_m):
                        sub_ids = []
                        for i in range(0, len(ids), 3):
                            tri = ids[i:i+3]
                            if any(mat_ids[idx] == mat_id for idx in tri if idx < len(mat_ids)):
                                sub_ids.extend(tri)
                        sub_mesh_tri_ids.append(sub_ids)

                primitives = []
                for sub_ids, mat_name in zip(sub_mesh_tri_ids, mats):
                    if not sub_ids: continue
                    if 'BreakOut' not in sm and mat_name in BLACKLIST_MESH_MATS:
                        continue
                    mat_idx = get_material_index(mat_name, side_signum)

                    max_idx = max(sub_ids)
                    if max_idx < 65535:
                        idx_bytes = struct.pack(f'<{len(sub_ids)}H', *sub_ids)
                        idx_type = 5123
                    else:
                        idx_bytes = struct.pack(f'<{len(sub_ids)}I', *sub_ids)
                        idx_type = 5125

                    idx_bv = add_buffer_view(idx_bytes, target=34963)
                    accessors.append({
                        "bufferView": idx_bv,
                        "byteOffset": 0,
                        "componentType": idx_type,
                        "count": len(sub_ids),
                        "type": "SCALAR",
                        "min": [min(sub_ids)],
                        "max": [max_idx]
                    })
                    idx_acc = len(accessors) - 1

                    prim_attrs = {"POSITION": pos_acc, "NORMAL": norm_acc}
                    if uv_acc is not None:
                        prim_attrs["TEXCOORD_0"] = uv_acc
                    primitives.append({
                        "attributes": prim_attrs,
                        "indices": idx_acc,
                        "material": mat_idx
                    })

                if not primitives: continue
                mesh_idx = len(gltf_meshes)
                gltf_meshes.append({
                    "name": f"{mesh_name}_{mesh_idx}",
                    "primitives": primitives
                })
                gltf_nodes.append({
                    "name": f"{node.get('name', mesh_name)}_{len(gltf_nodes)}",
                    "mesh": mesh_idx,
                    "translation": [tx, ty, tz],
                    "rotation": quat,
                    "scale": [sx, sy, sz]
                })

        while len(bin_bytes) % 4 != 0:
            bin_bytes.append(0)

        gltf_json = {
            "asset": {"version": "2.0", "generator": "RLViser Stadium Exporter"},
            "scene": 0,
            "scenes": [{"name": "RLViser_Stadium", "nodes": list(range(len(gltf_nodes)))}],
            "nodes": gltf_nodes,
            "meshes": gltf_meshes,
            "materials": materials,
            "textures": textures,
            "images": images,
            "accessors": accessors,
            "bufferViews": buffer_views,
            "buffers": [{"byteLength": len(bin_bytes)}]
        }

        json_bytes = json.dumps(gltf_json, separators=(',', ':')).encode('utf-8')
        while len(json_bytes) % 4 != 0:
            json_bytes += b' '

        total_glb_len = 12 + 8 + len(json_bytes) + 8 + len(bin_bytes)
        glb = bytearray()
        glb.extend(b'glTF')
        glb.extend(struct.pack('<I', 2))
        glb.extend(struct.pack('<I', total_glb_len))
        glb.extend(struct.pack('<I', len(json_bytes)))
        glb.extend(b'JSON')
        glb.extend(json_bytes)
        glb.extend(struct.pack('<I', len(bin_bytes)))
        glb.extend(b'BIN\x00')
        glb.extend(bin_bytes)

        glb_path = os.path.join(output_dir, "rlviser_stadium.glb")
        with open(glb_path, 'wb') as f:
            f.write(glb)
        print(f"Exported GLB -> {glb_path} ({len(glb) / 1024 / 1024:.2f} MB)")

    if "obj" in export_formats or "all" in export_formats:
        print("\n--- Generating Wavefront OBJ (.obj + .mtl) ---")
        obj_path = os.path.join(output_dir, "rlviser_stadium.obj")
        mtl_path = os.path.join(output_dir, "rlviser_stadium.mtl")

        with open(mtl_path, 'w') as mtl_f:
            mtl_f.write("# Materials for RLViser Stadium\n\n")
            written_mats = set()
            for obj in all_nodes:
                for node in get_info_nodes(obj):
                    t = node.get('translation') or [0.0, 0.0, 0.0]
                    side = -1 if t[1] < 0 else (1 if t[1] > 0 else 0)
                    for m in (node.get('materials') or ['Default']):
                        k, mdef = get_material_def(m, side, {})
                        if k not in written_mats:
                            written_mats.add(k)
                            col = mdef["pbrMetallicRoughness"]["baseColorFactor"]
                            mtl_f.write(f"newmtl {k}\n")
                            mtl_f.write(f"Kd {col[0]:.4f} {col[1]:.4f} {col[2]:.4f}\n")
                            mtl_f.write(f"d {col[3]:.4f}\n\n")

        with open(obj_path, 'w') as obj_f:
            obj_f.write(f"# RLViser Stadium OBJ Export\nmtllib {os.path.basename(mtl_path)}\n\n")
            v_offset = 1
            vt_offset = 1
            vn_offset = 1

            for obj in all_nodes:
                for node in get_info_nodes(obj):
                    sm = node['static_mesh']
                    if not sm or not sm.strip(): continue
                    mesh_name = sm.split('.')[-1]
                    fname = f"{mesh_name}.bin"
                    if fname not in mesh_bytes_map: continue
                    if mesh_name not in mesh_data_cache:
                        mesh_data_cache[mesh_name] = parse_bin_mesh(mesh_bytes_map[fname])
                    mdata = mesh_data_cache[mesh_name]

                    t = node.get('translation') or [0.0, 0.0, 0.0]
                    r = node.get('rotation') or [0.0, 0.0, 0.0]
                    s = node.get('scale') or [1.0, 1.0, 1.0]

                    tx, ty, tz = float(t[0]), float(t[2]), float(t[1])
                    if "Grass.Grass" in sm or "Grass_1x1" in sm:
                        ty += 10.0
                    quat = euler_zyx_to_quat(r[0], r[1], r[2])
                    sx, sy, sz = float(s[0]), float(s[2]), float(s[1])

                    side = -1 if t[1] < 0 else (1 if t[1] > 0 else 0)
                    mats = node.get('materials') or ['']
                    num_m = mdata['num_materials']

                    if num_m < 2:
                        sub_mesh_tri_ids = [mdata['ids']]
                    else:
                        sub_mesh_tri_ids = []
                        mat_ids = mdata['mat_ids']
                        ids = mdata['ids']
                        for mat_id in range(num_m):
                            sub_ids = []
                            for i in range(0, len(ids), 3):
                                tri = ids[i:i+3]
                                if any(mat_ids[idx] == mat_id for idx in tri if idx < len(mat_ids)):
                                    sub_ids.extend(tri)
                            sub_mesh_tri_ids.append(sub_ids)

                    verts = mdata['verts']
                    uvs = mdata['uvs']
                    norms = compute_smooth_normals(verts, mdata['ids'])

                    transformed_verts = []
                    for i in range(0, len(verts), 3):
                        vx, vy, vz = verts[i] * sx, verts[i+1] * sy, verts[i+2] * sz
                        rx, ry, rz = quat_rotate_vec3(quat, [vx, vy, vz])
                        transformed_verts.append((rx + tx, ry + ty, rz + tz))

                    transformed_norms = []
                    for i in range(0, len(norms), 3):
                        nx, ny, nz = norms[i], norms[i+1], norms[i+2]
                        rx, ry, rz = quat_rotate_vec3(quat, [nx, ny, nz])
                        transformed_norms.append((rx, ry, rz))

                    for v in transformed_verts:
                        obj_f.write(f"v {v[0]:.3f} {v[1]:.3f} {v[2]:.3f}\n")
                    if uvs:
                        for idx in range(0, len(uvs), 2):
                            obj_f.write(f"vt {uvs[idx]:.4f} {uvs[idx+1]:.4f}\n")
                    for n in transformed_norms:
                        obj_f.write(f"vn {n[0]:.4f} {n[1]:.4f} {n[2]:.4f}\n")

                    has_uv = bool(uvs)
                    for sub_ids, mat_name in zip(sub_mesh_tri_ids, mats):
                        if not sub_ids: continue
                        if 'BreakOut' not in sm and mat_name in BLACKLIST_MESH_MATS:
                            continue
                        mat_key, _ = get_material_def(mat_name, side, {})
                        obj_f.write(f"usemtl {mat_key}\n")
                        for i in range(0, len(sub_ids), 3):
                            i0, i1, i2 = sub_ids[i], sub_ids[i+1], sub_ids[i+2]
                            v0 = v_offset + i0
                            v1 = v_offset + i1
                            v2 = v_offset + i2
                            n0 = vn_offset + i0
                            n1 = vn_offset + i1
                            n2 = vn_offset + i2
                            if has_uv:
                                t0 = vt_offset + i0
                                t1 = vt_offset + i1
                                t2 = vt_offset + i2
                                obj_f.write(f"f {v0}/{t0}/{n0} {v1}/{t1}/{n1} {v2}/{t2}/{n2}\n")
                            else:
                                obj_f.write(f"f {v0}//{n0} {v1}//{n1} {v2}//{n2}\n")

                    v_offset += len(transformed_verts)
                    if has_uv:
                        vt_offset += len(uvs) // 2
                    vn_offset += len(transformed_norms)

        print(f"Exported OBJ -> {obj_path} ({os.path.getsize(obj_path) / 1024 / 1024:.2f} MB)")
        print(f"Exported MTL -> {mtl_path}")

    print("\n[SUCCESS] Stadium export completed!")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Export RLViser Stadium models to GLB/OBJ")
    parser.add_argument("--rlviser-dir", default="/rlviser", help="Path to rlviser repo")
    parser.add_argument("--output-dir", default="/RLCleanWASM/public/assets/arena/stadium", help="Output directory")
    parser.add_argument("--format", default="all", choices=["glb", "obj", "all"], help="Export format")
    args = parser.parse_args()

    export_stadium(args.rlviser_dir, args.output_dir, [args.format] if args.format != "all" else ["glb", "obj"])
