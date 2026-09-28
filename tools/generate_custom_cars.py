#!/usr/bin/env python3
"""
Custom Car Models Generator:
1. Paintable GLB Models (with neutral tintable texture & PBR submesh separation):
   - Sentinel: sentinel_paintable.glb, sentinel_plank_paintable.glb, chip_paintable.glb
   - Insidio:  insidio_paintable.glb, insidio_hybrid_paintable.glb, peach_paintable.glb
   Ensures Three.js/WebGL material recoloring works cleanly with accurate hues.

2. Simplified Flat-Bottom GLB Models:
   - Sentinel: sentinel_simplified.glb
   - Insidio:  insidio_simplified.glb
   Features flat undertray capping/clamping at bottom floor and QEM decimation,
   retaining exterior silhouette while reducing vertex/triangle counts by 75-80%.
"""

import os
import io
import numpy as np
from PIL import Image
import pygltflib
import trimesh
import fast_simplification

def align_4(b):
    pad = (4 - (len(b) % 4)) % 4
    return b + b'\x00' * pad

def extract_parts_from_glb(glb_path):
    g = pygltflib.GLTF2().load(glb_path)
    blob = g.binary_blob()
    parts = []
    for m in g.meshes:
        prim = m.primitives[0]
        pos_acc = g.accessors[prim.attributes.POSITION]
        pos_bv = g.bufferViews[pos_acc.bufferView]
        pos_start = (pos_bv.byteOffset or 0) + (pos_acc.byteOffset or 0)
        positions = np.frombuffer(blob[pos_start : pos_start + pos_acc.count * 12], dtype=np.float32).reshape(-1, 3).copy()

        normals = None
        if prim.attributes.NORMAL is not None:
            norm_acc = g.accessors[prim.attributes.NORMAL]
            norm_bv = g.bufferViews[norm_acc.bufferView]
            norm_start = (norm_bv.byteOffset or 0) + (norm_acc.byteOffset or 0)
            normals = np.frombuffer(blob[norm_start : norm_start + norm_acc.count * 12], dtype=np.float32).reshape(-1, 3).copy()

        uvs = None
        if prim.attributes.TEXCOORD_0 is not None:
            uv_acc = g.accessors[prim.attributes.TEXCOORD_0]
            uv_bv = g.bufferViews[uv_acc.bufferView]
            uv_start = (uv_bv.byteOffset or 0) + (uv_acc.byteOffset or 0)
            uvs = np.frombuffer(blob[uv_start : uv_start + uv_acc.count * 8], dtype=np.float32).reshape(-1, 2).copy()

        ind_acc = g.accessors[prim.indices]
        ind_bv = g.bufferViews[ind_acc.bufferView]
        ind_start = (ind_bv.byteOffset or 0) + (ind_acc.byteOffset or 0)
        if ind_acc.componentType == 5123:
            indices = np.frombuffer(blob[ind_start : ind_start + ind_acc.count * 2], dtype=np.uint16).astype(np.uint32)
        else:
            indices = np.frombuffer(blob[ind_start : ind_start + ind_acc.count * 4], dtype=np.uint32).copy()

        img_bytes = None
        mat = g.materials[prim.material] if prim.material is not None else None
        if mat and mat.pbrMetallicRoughness and mat.pbrMetallicRoughness.baseColorTexture:
            tex_idx = mat.pbrMetallicRoughness.baseColorTexture.index
            img_idx = g.textures[tex_idx].source
            img_bv = g.bufferViews[g.images[img_idx].bufferView]
            img_bytes = bytes(blob[img_bv.byteOffset : img_bv.byteOffset + img_bv.byteLength])

        parts.append({
            'name': m.name,
            'positions': positions,
            'normals': normals,
            'uvs': uvs,
            'indices': indices,
            'material_name': mat.name if mat else m.name,
            'image_bytes': img_bytes
        })
    return parts

def create_car_glb(parts, output_path, car_name):
    gltf = pygltflib.GLTF2()
    blob = bytearray()

    buffer_views = []
    accessors = []
    materials = []
    textures = []
    images = []
    samplers = []
    meshes = []
    nodes = []

    sampler = pygltflib.Sampler(
        magFilter=pygltflib.LINEAR,
        minFilter=pygltflib.LINEAR_MIPMAP_LINEAR,
        wrapS=pygltflib.REPEAT,
        wrapT=pygltflib.REPEAT
    )
    samplers.append(sampler)
    image_cache = {}

    for part in parts:
        mat_idx = len(materials)
        tex_idx = None

        if part.get('image_png_bytes'):
            img_bytes = part['image_png_bytes']
            if img_bytes in image_cache:
                tex_idx = image_cache[img_bytes]
            else:
                img_offset = len(blob)
                blob.extend(align_4(img_bytes))
                img_bv_idx = len(buffer_views)
                buffer_views.append(pygltflib.BufferView(
                    buffer=0,
                    byteOffset=img_offset,
                    byteLength=len(img_bytes)
                ))
                img_idx = len(images)
                images.append(pygltflib.Image(
                    bufferView=img_bv_idx,
                    mimeType='image/png',
                    name=f"{part['name']}-image"
                ))
                tex_idx = len(textures)
                textures.append(pygltflib.Texture(
                    sampler=0,
                    source=img_idx
                ))
                image_cache[img_bytes] = tex_idx

        pbr = pygltflib.PbrMetallicRoughness(
            baseColorFactor=part.get('base_color_factor', [1.0, 1.0, 1.0, 1.0]),
            roughnessFactor=part.get('roughness_factor', 0.5),
            metallicFactor=part.get('metallic_factor', 0.1)
        )
        if tex_idx is not None:
            pbr.baseColorTexture = pygltflib.TextureInfo(index=tex_idx, texCoord=0)

        mat = pygltflib.Material(
            name=part['material_name'],
            pbrMetallicRoughness=pbr
        )
        if part.get('emissive_factor'):
            mat.emissiveFactor = part['emissive_factor']
        materials.append(mat)

        ind = part['indices'].astype(np.uint32)
        ind_bytes = ind.tobytes()
        ind_offset = len(blob)
        blob.extend(align_4(ind_bytes))
        ind_bv_idx = len(buffer_views)
        buffer_views.append(pygltflib.BufferView(
            buffer=0,
            byteOffset=ind_offset,
            byteLength=len(ind_bytes),
            target=pygltflib.ELEMENT_ARRAY_BUFFER
        ))
        ind_acc_idx = len(accessors)
        accessors.append(pygltflib.Accessor(
            bufferView=ind_bv_idx,
            byteOffset=0,
            componentType=pygltflib.UNSIGNED_INT,
            count=len(ind),
            type=pygltflib.SCALAR,
            max=[int(ind.max())],
            min=[int(ind.min())]
        ))

        pos = part['positions'].astype(np.float32)
        pos_bytes = pos.tobytes()
        pos_offset = len(blob)
        blob.extend(align_4(pos_bytes))
        pos_bv_idx = len(buffer_views)
        buffer_views.append(pygltflib.BufferView(
            buffer=0,
            byteOffset=pos_offset,
            byteLength=len(pos_bytes),
            target=pygltflib.ARRAY_BUFFER
        ))
        pos_acc_idx = len(accessors)
        accessors.append(pygltflib.Accessor(
            bufferView=pos_bv_idx,
            byteOffset=0,
            componentType=pygltflib.FLOAT,
            count=len(pos),
            type=pygltflib.VEC3,
            max=pos.max(axis=0).tolist(),
            min=pos.min(axis=0).tolist()
        ))

        attributes = pygltflib.Attributes(POSITION=pos_acc_idx)

        if part.get('normals') is not None:
            norm = part['normals'].astype(np.float32)
            norm_bytes = norm.tobytes()
            norm_offset = len(blob)
            blob.extend(align_4(norm_bytes))
            norm_bv_idx = len(buffer_views)
            buffer_views.append(pygltflib.BufferView(
                buffer=0,
                byteOffset=norm_offset,
                byteLength=len(norm_bytes),
                target=pygltflib.ARRAY_BUFFER
            ))
            norm_acc_idx = len(accessors)
            accessors.append(pygltflib.Accessor(
                bufferView=norm_bv_idx,
                byteOffset=0,
                componentType=pygltflib.FLOAT,
                count=len(norm),
                type=pygltflib.VEC3,
                max=norm.max(axis=0).tolist(),
                min=norm.min(axis=0).tolist()
            ))
            attributes.NORMAL = norm_acc_idx

        if part.get('uvs') is not None:
            uv = part['uvs'].astype(np.float32)
            uv_bytes = uv.tobytes()
            uv_offset = len(blob)
            blob.extend(align_4(uv_bytes))
            uv_bv_idx = len(buffer_views)
            buffer_views.append(pygltflib.BufferView(
                buffer=0,
                byteOffset=uv_offset,
                byteLength=len(uv_bytes),
                target=pygltflib.ARRAY_BUFFER
            ))
            uv_acc_idx = len(accessors)
            accessors.append(pygltflib.Accessor(
                bufferView=uv_bv_idx,
                byteOffset=0,
                componentType=pygltflib.FLOAT,
                count=len(uv),
                type=pygltflib.VEC2,
                max=uv.max(axis=0).tolist(),
                min=uv.min(axis=0).tolist()
            ))
            attributes.TEXCOORD_0 = uv_acc_idx

        prim = pygltflib.Primitive(
            attributes=attributes,
            indices=ind_acc_idx,
            material=mat_idx,
            mode=pygltflib.TRIANGLES
        )

        mesh_idx = len(meshes)
        meshes.append(pygltflib.Mesh(
            name=part['name'],
            primitives=[prim]
        ))

        node_idx = len(nodes)
        nodes.append(pygltflib.Node(
            name=part['name'],
            mesh=mesh_idx
        ))

    root_node_idx = len(nodes)
    child_indices = list(range(len(nodes)))
    nodes.append(pygltflib.Node(
        name=car_name,
        children=child_indices
    ))

    scene = pygltflib.Scene(nodes=[root_node_idx])

    gltf.buffers = [pygltflib.Buffer(byteLength=len(blob))]
    gltf.bufferViews = buffer_views
    gltf.accessors = accessors
    gltf.materials = materials
    gltf.textures = textures
    gltf.images = images
    gltf.samplers = samplers
    gltf.meshes = meshes
    gltf.nodes = nodes
    gltf.scenes = [scene]
    gltf.scene = 0

    gltf.set_binary_blob(bytes(blob))
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    gltf.save(output_path)
    print(f"[SUCCESS] Exported -> {output_path} ({os.path.getsize(output_path)} bytes)")

def make_neutral_paintable_texture_from_bytes(img_bytes):
    im = Image.open(io.BytesIO(img_bytes)).convert('RGB')
    arr = np.array(im).astype(np.float32)
    b = arr[:, :, 2]
    r = arr[:, :, 0]
    
    paint_mask = np.clip((b - r) / 180.0, 0.0, 1.0)
    secondary_mask = np.clip((r - 50) / 180.0, 0.0, 1.0)
    
    trim = np.array([35, 38, 42], dtype=np.float32).reshape(1, 1, 3)
    paint = np.array([255, 255, 255], dtype=np.float32).reshape(1, 1, 3)
    secondary = np.array([220, 220, 225], dtype=np.float32).reshape(1, 1, 3)
    
    neutral = trim * (1.0 - np.clip(paint_mask[:, :, None] + secondary_mask[:, :, None], 0.0, 1.0))
    neutral += paint * paint_mask[:, :, None]
    neutral += secondary * secondary_mask[:, :, None]
    neutral = np.clip(neutral, 0, 255).astype(np.uint8)
    
    out_im = Image.fromarray(neutral)
    buf = io.BytesIO()
    out_im.save(buf, format='PNG')
    return buf.getvalue()

def build_paintable_models(src_glb, car_name, targets):
    src_parts = extract_parts_from_glb(src_glb)
    new_parts = []
    for p in src_parts:
        if p['name'] == 'body-shell':
            neutral_tex = make_neutral_paintable_texture_from_bytes(p['image_bytes']) if p['image_bytes'] else None
            new_parts.append({
                'name': 'body-shell',
                'positions': p['positions'],
                'normals': p['normals'],
                'uvs': p['uvs'],
                'indices': p['indices'],
                'material_name': 'body-shell',
                'base_color_factor': [1.0, 1.0, 1.0, 1.0],
                'roughness_factor': 0.35,
                'metallic_factor': 0.2,
                'image_png_bytes': neutral_tex
            })
        elif p['name'] == 'lower-detail':
            new_parts.append({
                'name': 'lower-detail',
                'positions': p['positions'],
                'normals': p['normals'],
                'uvs': p['uvs'],
                'indices': p['indices'],
                'material_name': 'lower-detail',
                'base_color_factor': [0.85, 0.85, 0.85, 1.0],
                'roughness_factor': 0.7,
                'metallic_factor': 0.6,
                'image_png_bytes': p['image_bytes']
            })
        elif p['name'] == 'lamps':
            new_parts.append({
                'name': 'lamps',
                'positions': p['positions'],
                'normals': p['normals'],
                'uvs': p['uvs'],
                'indices': p['indices'],
                'material_name': 'lamps',
                'base_color_factor': [0.8, 0.9, 1.0, 0.8],
                'roughness_factor': 0.1,
                'metallic_factor': 0.1,
                'emissive_factor': [0.3, 0.4, 0.6]
            })

    for tgt in targets:
        create_car_glb(new_parts, tgt, car_name)

def build_simplified_models(src_glb, car_name, target_path, y_floor_clamp):
    src_parts = extract_parts_from_glb(src_glb)
    new_parts = []
    for p in src_parts:
        if p['name'] == 'body-shell':
            m = trimesh.Trimesh(vertices=p['positions'], faces=p['indices'].reshape(-1, 3), process=False)
            simp = m.simplify_quadric_decimation(percent=0.75)
            simp.fix_normals()
            new_parts.append({
                'name': 'body-shell',
                'positions': simp.vertices,
                'normals': simp.vertex_normals,
                'indices': simp.faces.flatten(),
                'material_name': 'body-shell',
                'base_color_factor': [1.0, 1.0, 1.0, 1.0],
                'roughness_factor': 0.35,
                'metallic_factor': 0.2
            })
        elif p['name'] == 'lower-detail':
            verts = p['positions'].copy()
            mask = verts[:, 1] < (y_floor_clamp + 1.5)
            verts[mask, 1] = y_floor_clamp
            m = trimesh.Trimesh(vertices=verts, faces=p['indices'].reshape(-1, 3), process=False)
            simp = m.simplify_quadric_decimation(percent=0.85)
            simp.fix_normals()
            new_parts.append({
                'name': 'lower-detail',
                'positions': simp.vertices,
                'normals': simp.vertex_normals,
                'indices': simp.faces.flatten(),
                'material_name': 'lower-detail',
                'base_color_factor': [0.15, 0.16, 0.18, 1.0],
                'roughness_factor': 0.8,
                'metallic_factor': 0.4
            })
        elif p['name'] == 'lamps':
            new_parts.append({
                'name': 'lamps',
                'positions': p['positions'],
                'normals': p['normals'],
                'indices': p['indices'],
                'material_name': 'lamps',
                'base_color_factor': [0.8, 0.9, 1.0, 0.8],
                'roughness_factor': 0.1,
                'metallic_factor': 0.1,
                'emissive_factor': [0.3, 0.4, 0.6]
            })

    create_car_glb(new_parts, target_path, car_name)

if __name__ == '__main__':
    # 1. Paintable models
    build_paintable_models(
        'custom/assets/cars/sentinel_painted.glb',
        'Sentinel',
        [
            'custom/assets/cars/sentinel_paintable.glb',
            'custom/assets/cars/sentinel_plank_paintable.glb',
            'custom/assets/cars/chip_paintable.glb'
        ]
    )

    build_paintable_models(
        'custom/assets/cars/insidio_painted.glb',
        'Insidio',
        [
            'custom/assets/cars/insidio_paintable.glb',
            'custom/assets/cars/insidio_hybrid_paintable.glb',
            'custom/assets/cars/peach_paintable.glb'
        ]
    )

    # 2. Simplified flat-bottom models
    build_simplified_models(
        'custom/assets/cars/sentinel_painted.glb',
        'Sentinel',
        'custom/assets/cars/sentinel_simplified.glb',
        y_floor_clamp=-15.0
    )

    build_simplified_models(
        'custom/assets/cars/insidio_painted.glb',
        'Insidio',
        'custom/assets/cars/insidio_simplified.glb',
        y_floor_clamp=-10.0
    )
