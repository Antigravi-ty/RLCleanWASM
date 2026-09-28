#!/usr/bin/env python3
"""
Rocket League Car UPK/PSK to GLB Converter
Extracts meshes and textures from Rocket League UPK packages using UEViewer (umodel)
and compiles standardized .glb models with UVs and authentic textures for RLCleanWASM.
"""

import os
import sys
import struct
import numpy as np
import trimesh
from PIL import Image

class MeshBuilder:
    def __init__(self):
        self.vertices = []
        self.faces = []
        self.uvs = []

    def parse_psk(self, filepath):
        """Parse ActorX .psk / .pskx binary format."""
        with open(filepath, "rb") as f:
            data = f.read()

        offset = 0
        chunks = {}
        while offset < len(data):
            chunk_id = data[offset : offset + 20].decode("ascii", errors="ignore").strip("\x00")
            type_flag, data_size, data_count = struct.unpack_from("<iii", data, offset + 20)
            offset += 32
            chunks[chunk_id] = (offset, data_size, data_count)
            offset += data_size * data_count

        if "PNTS0000" not in chunks or ("VTXW0000" not in chunks and "3DGW0000" not in chunks):
            raise ValueError(f"Invalid PSK file: missing points or wedges in {filepath}")

        # Parse Points
        p_off, p_sz, p_cnt = chunks["PNTS0000"]
        points = []
        for i in range(p_cnt):
            px, py, pz = struct.unpack_from("<fff", data, p_off + i * p_sz)
            # Transform from UE3 (X: Forward, Y: Right, Z: Up)
            # to Three.js / RLCleanWASM standard (X: Forward, Y: Up, Z: -Right)
            points.append([px, pz, -py])
        points = np.array(points, dtype=np.float32)

        # Parse Wedges
        w_chunk_id = "VTXW0000" if "VTXW0000" in chunks else "3DGW0000"
        w_off, w_sz, w_cnt = chunks[w_chunk_id]
        wedges = []
        for i in range(w_cnt):
            if w_sz == 16:
                p_idx, u, v = struct.unpack_from("<Iff", data, w_off + i * w_sz)
            elif w_sz == 20:
                p_idx, u, v = struct.unpack_from("<Iff", data, w_off + i * w_sz)
            else:
                p_idx, u, v = struct.unpack_from("<Hff", data, w_off + i * w_sz)
            wedges.append((p_idx, u, v))

        # Parse Faces
        f_chunk_id = "FACE0000" if "FACE0000" in chunks else "FACE3200"
        if f_chunk_id not in chunks:
            raise ValueError(f"Invalid PSK file: missing faces in {filepath}")
        f_off, f_sz, f_cnt = chunks[f_chunk_id]
        faces = []
        for i in range(f_cnt):
            if f_chunk_id == "FACE3200" or f_sz >= 16:
                w0, w1, w2 = struct.unpack_from("<III", data, f_off + i * f_sz)
            else:
                w0, w1, w2 = struct.unpack_from("<HHH", data, f_off + i * f_sz)
            # Reverse winding [w0, w2, w1] for glTF CCW standard
            faces.append((w0, w2, w1))

        return points, wedges, faces

    def add_mesh(self, filepath):
        """Add and append a PSK/PSKX mesh to builder."""
        points, wedges, faces = self.parse_psk(filepath)
        base_v_idx = len(self.vertices)

        for p_idx, u, v in wedges:
            pos = points[p_idx]
            self.vertices.append(pos)
            # trimesh inverts V during glTF export, so passing (1.0 - v) preserves original v
            self.uvs.append([u, 1.0 - v])

        for w0, w1, w2 in faces:
            self.faces.append([base_v_idx + w0, base_v_idx + w1, base_v_idx + w2])

        print(f"Added {filepath}: {len(wedges)} wedges, {len(faces)} faces (Total vertices: {len(self.vertices)})")

    def build_glb(self, output_path, texture_path=None):
        """Build and export GLB file with UVs and material texture."""
        verts_arr = np.array(self.vertices, dtype=np.float32)
        faces_arr = np.array(self.faces, dtype=np.int32)
        uvs_arr = np.array(self.uvs, dtype=np.float32)

        if texture_path and os.path.exists(texture_path):
            tex_img = Image.open(texture_path).convert("RGBA")
        else:
            tex_img = Image.new("RGBA", (2, 2), (100, 100, 100, 255))

        pbr_mat = trimesh.visual.material.PBRMaterial(
            baseColorFactor=[0.4, 0.4, 0.4, 1.0],
            roughnessFactor=0.9036020036098448,
            doubleSided=False,
            baseColorTexture=tex_img
        )

        visual = trimesh.visual.TextureVisuals(uv=uvs_arr, material=pbr_mat)
        mesh = trimesh.Trimesh(vertices=verts_arr, faces=faces_arr, visual=visual, validate=False)

        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        glb_data = mesh.export(file_type="glb")
        with open(output_path, "wb") as f:
            f.write(glb_data)

        file_size_kb = os.path.getsize(output_path) / 1024
        print(f"[SUCCESS] Exported GLB -> {output_path} ({file_size_kb:.1f} KB)")
        print(f"  Bounds: min={mesh.bounds[0].tolist()}, max={mesh.bounds[1].tolist()}")
        print(f"  Faces: {len(faces_arr)}, Vertices: {len(verts_arr)}")
        return output_path

def build_all():
    # 1. Sentinel (Plank hitbox)
    chip_builder = MeshBuilder()
    chip_builder.add_mesh("/tmp/export_test/chip/body_chip_SF/SkeletalMesh3/Body_Chip_SK.psk")
    chip_builder.add_mesh("/tmp/export_test/chip/body_chip_SF/StaticMesh3/Chip_Lenses.pskx")
    chip_tex = "/tmp/export_tex_dds/body_chip_SF/Texture2D/Body_Chip_D.dds"
    chip_builder.build_glb("custom/assets/cars/sentinel.glb", chip_tex)
    chip_builder.build_glb("custom/assets/cars/sentinel_plank.glb", chip_tex)

    # 2. Insidio (Hybrid hitbox)
    peach_builder = MeshBuilder()
    peach_builder.add_mesh("/tmp/export_test/peach/body_peach_SF/SkeletalMesh3/Body_Peach_Blockout.psk")
    peach_tex = "/tmp/export_tex_dds/peach/body_peach_SF/Texture2D/Peach_Body_Change_D.dds"
    peach_builder.build_glb("custom/assets/cars/insidio.glb", peach_tex)
    peach_builder.build_glb("custom/assets/cars/insidio_hybrid.glb", peach_tex)

    # 3. Scarab (Octane hitbox)
    scarab_builder = MeshBuilder()
    scarab_builder.add_mesh("/tmp/export_test/scarab/Body_Scarab_SF/SkeletalMesh3/Body_Scarab_SK.psk")
    scarab_tex = "/tmp/export_tex_dds/scarab/Body_Scarab_SF/Texture2D/Scarab_Body00_D.dds"
    scarab_builder.build_glb("custom/assets/cars/scarab.glb", scarab_tex)
    scarab_builder.build_glb("custom/assets/cars/scarab_octane.glb", scarab_tex)

if __name__ == "__main__":
    build_all()
