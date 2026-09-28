#!/usr/bin/env python3
"""
Rocket League Car UPK to GLB Converter
Extracts meshes and textures from Rocket League UPK packages using UEViewer (umodel) and compiles
clean standardized .glb models positioned and scaled for RLCleanWASM.

Supports:
- Basic unified whitebox/grey models
- Paintable multi-material submesh models with embedded textures (body-shell, lower-detail, lamps)
  enabling dynamic color changes in RLCleanWASM VehicleAssembly.js.
"""

import os
import sys
import argparse
import numpy as np
import pygltflib
from PIL import Image
import io

def align_4(b):
    pad = (4 - (len(b) % 4)) % 4
    return b + b'\x00' * pad

def extract_primitive_data(gltf, prim, bin_data):
    pos_acc = gltf.accessors[prim.attributes.POSITION]
    pos_bv = gltf.bufferViews[pos_acc.bufferView]
    pos_start = (pos_bv.byteOffset or 0) + (pos_acc.byteOffset or 0)
    pos_count = pos_acc.count
    positions = np.frombuffer(bin_data[pos_start : pos_start + pos_count * 12], dtype=np.float32).reshape(-1, 3).copy()
    # Scale from meters (UEViewer gltf standard) to centimeters (Rocket League units)
    positions *= 100.0

    normals = None
    if prim.attributes.NORMAL is not None:
        norm_acc = gltf.accessors[prim.attributes.NORMAL]
        norm_bv = gltf.bufferViews[norm_acc.bufferView]
        norm_start = (norm_bv.byteOffset or 0) + (norm_acc.byteOffset or 0)
        normals = np.frombuffer(bin_data[norm_start : norm_start + norm_acc.count * 12], dtype=np.float32).reshape(-1, 3).copy()

    uvs = None
    if prim.attributes.TEXCOORD_0 is not None:
        uv_acc = gltf.accessors[prim.attributes.TEXCOORD_0]
        uv_bv = gltf.bufferViews[uv_acc.bufferView]
        uv_start = (uv_bv.byteOffset or 0) + (uv_acc.byteOffset or 0)
        uvs = np.frombuffer(bin_data[uv_start : uv_start + uv_acc.count * 8], dtype=np.float32).reshape(-1, 2).copy()

    ind_acc = gltf.accessors[prim.indices]
    ind_bv = gltf.bufferViews[ind_acc.bufferView]
    ind_start = (ind_bv.byteOffset or 0) + (ind_acc.byteOffset or 0)
    if ind_acc.componentType == 5123: # UNSIGNED_SHORT
        indices = np.frombuffer(bin_data[ind_start : ind_start + ind_acc.count * 2], dtype=np.uint16).astype(np.uint32)
    elif ind_acc.componentType == 5125: # UNSIGNED_INT
        indices = np.frombuffer(bin_data[ind_start : ind_start + ind_acc.count * 4], dtype=np.uint32).copy()
    else:
        indices = None

    return {
        'positions': positions,
        'normals': normals,
        'uvs': uvs,
        'indices': indices
    }

def make_painted_texture(bs_path, primary_rgb=(25, 110, 220), trim_rgb=(35, 38, 42)):
    if not os.path.exists(bs_path):
        # Fallback to solid image
        im = Image.new('RGB', (256, 256), primary_rgb)
        return im
    bs = Image.open(bs_path).convert('RGB')
    bs_arr = np.array(bs).astype(np.float32) / 255.0
    r_mask = bs_arr[:, :, 0:1] # primary paint mask
    g_mask = bs_arr[:, :, 1:2] # secondary / accent mask
    b_mask = bs_arr[:, :, 2:3] # carbon / detail mask
    
    primary = np.array(primary_rgb).reshape(1, 1, 3).astype(np.float32)
    secondary = np.array([240, 240, 245]).reshape(1, 1, 3).astype(np.float32)
    trim = np.array(trim_rgb).reshape(1, 1, 3).astype(np.float32)
    
    out = trim * (1.0 - np.clip(r_mask + g_mask, 0.0, 1.0))
    out += primary * r_mask
    out += secondary * g_mask
    out = np.clip(out * (1.0 - 0.2 * b_mask), 0, 255).astype(np.uint8)
    return Image.fromarray(out).resize((512, 512), Image.Resampling.LANCZOS)

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
                    mimeType="image/png",
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

        ind_bytes = part['indices'].astype(np.uint32).tobytes()
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
            count=len(part['indices']),
            type=pygltflib.SCALAR,
            max=[int(part['indices'].max())],
            min=[int(part['indices'].min())]
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

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Build Rocket League car GLB models")
    parser.add_argument("--chip-dir", help="Path to exported body_chip_SF gltf folder")
    parser.add_argument("--peach-dir", help="Path to exported body_peach_SF gltf folder")
    parser.add_argument("--scarab-dir", help="Path to exported Body_Scarab_SF gltf folder")
    parser.add_argument("--output-dir", default="custom/assets/cars", help="Output directory")
    args = parser.parse_args()

    out = args.output_dir
    os.makedirs(out, exist_ok=True)

    if args.chip_dir:
        sk_path = os.path.join(args.chip_dir, "SkeletalMesh3/Body_Chip_SK.gltf")
        lens_path = os.path.join(args.chip_dir, "StaticMesh3/Chip_Lenses.gltf")
        if os.path.exists(sk_path) and os.path.exists(lens_path):
            sk_gltf = pygltflib.GLTF2().load(sk_path)
            sk_bin = open(os.path.join(os.path.dirname(sk_path), sk_gltf.buffers[0].uri), 'rb').read()
            lens_gltf = pygltflib.GLTF2().load(lens_path)
            lens_bin = open(os.path.join(os.path.dirname(lens_path), lens_gltf.buffers[0].uri), 'rb').read()

            chassis_data = extract_primitive_data(sk_gltf, sk_gltf.meshes[0].primitives[0], sk_bin)
            body_data = extract_primitive_data(sk_gltf, sk_gltf.meshes[0].primitives[1], sk_bin)
            lens_data = extract_primitive_data(lens_gltf, lens_gltf.meshes[0].primitives[0], lens_bin)

            body_tex_path = os.path.join(args.chip_dir, "Texture2D/Body_Chip_Blankskin.png")
            chassis_tex_path = os.path.join(args.chip_dir, "Texture2D/Chassis_Chip_D.png")

            im_body = make_painted_texture(body_tex_path)
            body_buf = io.BytesIO()
            im_body.save(body_buf, format='PNG')

            im_chassis = Image.open(chassis_tex_path).convert('RGBA').resize((512, 512), Image.Resampling.LANCZOS) if os.path.exists(chassis_tex_path) else Image.new('RGB', (256, 256), (35, 38, 42))
            chassis_buf = io.BytesIO()
            im_chassis.save(chassis_buf, format='PNG')

            parts = [
                {
                    'name': 'body-shell',
                    'positions': body_data['positions'],
                    'normals': body_data['normals'],
                    'uvs': body_data['uvs'],
                    'indices': body_data['indices'],
                    'material_name': 'body-shell',
                    'base_color_factor': [1.0, 1.0, 1.0, 1.0],
                    'roughness_factor': 0.35,
                    'metallic_factor': 0.3,
                    'image_png_bytes': body_buf.getvalue()
                },
                {
                    'name': 'lower-detail',
                    'positions': chassis_data['positions'],
                    'normals': chassis_data['normals'],
                    'uvs': chassis_data['uvs'],
                    'indices': chassis_data['indices'],
                    'material_name': 'lower-detail',
                    'base_color_factor': [0.85, 0.85, 0.85, 1.0],
                    'roughness_factor': 0.7,
                    'metallic_factor': 0.6,
                    'image_png_bytes': chassis_buf.getvalue()
                },
                {
                    'name': 'lamps',
                    'positions': lens_data['positions'],
                    'normals': lens_data['normals'],
                    'uvs': lens_data['uvs'],
                    'indices': lens_data['indices'],
                    'material_name': 'lamps',
                    'base_color_factor': [0.8, 0.9, 1.0, 0.8],
                    'roughness_factor': 0.1,
                    'metallic_factor': 0.1,
                    'emissive_factor': [0.3, 0.4, 0.6]
                }
            ]

            create_car_glb(parts, os.path.join(out, "sentinel_painted.glb"), "Sentinel")
            create_car_glb(parts, os.path.join(out, "sentinel_plank_painted.glb"), "Sentinel")
            create_car_glb(parts, os.path.join(out, "chip_painted.glb"), "Sentinel")

    if args.peach_dir:
        sk_path = os.path.join(args.peach_dir, "SkeletalMesh3/Body_Peach_Blockout.gltf")
        if os.path.exists(sk_path):
            sk_gltf = pygltflib.GLTF2().load(sk_path)
            sk_bin = open(os.path.join(os.path.dirname(sk_path), sk_gltf.buffers[0].uri), 'rb').read()

            chassis_data = extract_primitive_data(sk_gltf, sk_gltf.meshes[0].primitives[0], sk_bin)
            lamps_data = extract_primitive_data(sk_gltf, sk_gltf.meshes[0].primitives[1], sk_bin)
            body_data = extract_primitive_data(sk_gltf, sk_gltf.meshes[0].primitives[2], sk_bin)

            body_tex_path = os.path.join(args.peach_dir, "Texture2D/Peach_Body_BS.png")
            chassis_tex_path = os.path.join(args.peach_dir, "Texture2D/PeachChassis_D.png")

            im_body = make_painted_texture(body_tex_path)
            body_buf = io.BytesIO()
            im_body.save(body_buf, format='PNG')

            im_chassis = Image.open(chassis_tex_path).convert('RGB').resize((512, 512), Image.Resampling.LANCZOS) if os.path.exists(chassis_tex_path) else Image.new('RGB', (256, 256), (35, 38, 42))
            chassis_buf = io.BytesIO()
            im_chassis.save(chassis_buf, format='PNG')

            parts = [
                {
                    'name': 'body-shell',
                    'positions': body_data['positions'],
                    'normals': body_data['normals'],
                    'uvs': body_data['uvs'],
                    'indices': body_data['indices'],
                    'material_name': 'body-shell',
                    'base_color_factor': [1.0, 1.0, 1.0, 1.0],
                    'roughness_factor': 0.35,
                    'metallic_factor': 0.3,
                    'image_png_bytes': body_buf.getvalue()
                },
                {
                    'name': 'lower-detail',
                    'positions': chassis_data['positions'],
                    'normals': chassis_data['normals'],
                    'uvs': chassis_data['uvs'],
                    'indices': chassis_data['indices'],
                    'material_name': 'lower-detail',
                    'base_color_factor': [0.85, 0.85, 0.85, 1.0],
                    'roughness_factor': 0.7,
                    'metallic_factor': 0.6,
                    'image_png_bytes': chassis_buf.getvalue()
                },
                {
                    'name': 'lamps',
                    'positions': lamps_data['positions'],
                    'normals': lamps_data['normals'],
                    'uvs': lamps_data['uvs'],
                    'indices': lamps_data['indices'],
                    'material_name': 'lamps',
                    'base_color_factor': [0.8, 0.9, 1.0, 0.8],
                    'roughness_factor': 0.1,
                    'metallic_factor': 0.1,
                    'emissive_factor': [0.3, 0.4, 0.6]
                }
            ]

            create_car_glb(parts, os.path.join(out, "insidio_painted.glb"), "Insidio")
            create_car_glb(parts, os.path.join(out, "insidio_hybrid_painted.glb"), "Insidio")
            create_car_glb(parts, os.path.join(out, "peach_painted.glb"), "Insidio")
