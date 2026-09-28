#!/usr/bin/env python3
"""
Rocket League Car UPK to GLB Converter
Extracts meshes from Rocket League UPK packages using UEViewer (umodel) and compiles
clean standardized .glb models positioned and scaled for RLCleanWASM.
"""

import os
import sys
import argparse
import trimesh

def build_car_model(gltf_paths, output_glb_path, car_name):
    meshes = []
    for p in gltf_paths:
        if not os.path.exists(p):
            print(f"[WARN] File not found: {p}")
            continue
        loaded = trimesh.load(p)
        if isinstance(loaded, trimesh.Scene):
            for g in loaded.geometry.values():
                meshes.append(g)
        elif isinstance(loaded, trimesh.Trimesh):
            meshes.append(loaded)

    if not meshes:
        raise ValueError(f"No meshes loaded for {car_name}")

    combined = trimesh.util.concatenate(meshes)
    # Scale from meters (UEViewer gltf standard) to centimeters (Rocket League units)
    combined.apply_scale(100.0)

    # Standardized PBR material matching existing custom car models
    mat = trimesh.visual.material.PBRMaterial(
        name=f"MAT_{car_name}",
        baseColorFactor=[102, 102, 102, 255],
        roughnessFactor=0.903602,
        metallicFactor=0.1
    )
    combined.visual.material = mat

    print(f"[{car_name}] Vertices: {len(combined.vertices)}, Faces: {len(combined.faces)}")
    print(f"[{car_name}] Bounds: {combined.bounds.tolist()}")

    os.makedirs(os.path.dirname(os.path.abspath(output_glb_path)), exist_ok=True)
    glb_data = combined.export(file_type='glb')
    with open(output_glb_path, "wb") as f:
        f.write(glb_data)
    print(f"[SUCCESS] Exported -> {output_glb_path} ({len(glb_data)} bytes)")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Build Rocket League car GLB models")
    parser.add_argument("--chip-dir", help="Path to exported body_chip_SF gltf folder")
    parser.add_argument("--peach-dir", help="Path to exported body_peach_SF gltf folder")
    parser.add_argument("--scarab-dir", help="Path to exported Body_Scarab_SF gltf folder")
    parser.add_argument("--output-dir", default="custom/assets/cars", help="Output directory")
    args = parser.parse_args()

    out = args.output_dir
    if args.chip_dir:
        build_car_model([
            os.path.join(args.chip_dir, "SkeletalMesh3/Body_Chip_SK.gltf"),
            os.path.join(args.chip_dir, "StaticMesh3/Chip_Lenses.gltf")
        ], os.path.join(out, "sentinel.glb"), "Sentinel")
        build_car_model([
            os.path.join(args.chip_dir, "SkeletalMesh3/Body_Chip_SK.gltf"),
            os.path.join(args.chip_dir, "StaticMesh3/Chip_Lenses.gltf")
        ], os.path.join(out, "sentinel_plank.glb"), "Sentinel")

    if args.peach_dir:
        build_car_model([
            os.path.join(args.peach_dir, "SkeletalMesh3/Body_Peach_Blockout.gltf")
        ], os.path.join(out, "insidio.glb"), "Insidio")
        build_car_model([
            os.path.join(args.peach_dir, "SkeletalMesh3/Body_Peach_Blockout.gltf")
        ], os.path.join(out, "insidio_hybrid.glb"), "Insidio")

    if args.scarab_dir:
        build_car_model([
            os.path.join(args.scarab_dir, "SkeletalMesh3/Body_Scarab_SK.gltf"),
            os.path.join(args.scarab_dir, "StaticMesh3/Backfire_Boost.gltf")
        ], os.path.join(out, "scarab.glb"), "Scarab")
