"""Voie bois réelle (Sketchfab « Railway track train route Railway parts rail », Mehdi Shahsavan, CC BY 4.0)
→ pièces instanciables pour le jeu : traverse bois, selle + tirefonds (une attache de rail).

Usage : <python avec bpy> tools/blender/track_pack.py <dossier_du_pack> <sortie.glb>
Repère du jeu (glTF, Y haut) : traverse centrée, longueur selon X (travers de la voie), dessous à y = 0.
"""
import sys
import bpy
import bmesh
from mathutils import Vector

src, out = sys.argv[-2], sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=f"{src}/source/railroad_gav.fbx")
o = bpy.data.objects["railroad_gav"]
bpy.context.view_layer.objects.active = o
o.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.separate(type="LOOSE")
bpy.ops.object.mode_set(mode="OBJECT")


def box(ob):
    bb = [ob.matrix_world @ Vector(c) for c in ob.bound_box]
    mn = Vector([min(v[i] for v in bb) for i in range(3)])
    mx = Vector([max(v[i] for v in bb) for i in range(3)])
    return mn, mx


parts = list(bpy.context.scene.objects)
info = [(p, *box(p)) for p in parts]
# Traverse : 2,75 m selon Y (le pack a la voie selon X) ; on prend celle du milieu
sleepers = [t for t in info if (t[2] - t[1]).y > 2.5]
sleepers.sort(key=lambda t: abs((t[1] + t[2]).x / 2))
sl, smn, smx = sleepers[0]
cx = (smn.x + smx.x) / 2
# Attaches posées sur cette traverse : selle (0,15 × 0,30) et ses tirefonds, côté +Y (une file de rail)
near = [t for t in info if t[0] is not sl and (t[2] - t[1]).y < 0.5 and (t[2] - t[1]).x < 1.0 and abs((t[1] + t[2]).x / 2 - cx) < 0.2 and (t[1] + t[2]).y / 2 > 0]
rail_y = [((t[1] + t[2]) / 2).y for t in info if (t[2] - t[1]).x > 3.5]
print("rails y", rail_y, "attaches", len(near))


def keep(objs, name, origin):
    bpy.ops.object.select_all(action="DESELECT")
    for ob in objs:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = ob.data.name = name
    ob.data.transform(__import__("mathutils").Matrix.Translation(-origin))
    ob.location = (0, 0, 0)
    return ob


plate_y = max(rail_y)
sleeper = keep([sl], "traverse_bois", Vector((cx, 0, smn.z)))
fix = keep([t[0] for t in near], "attache_selle", Vector((cx, plate_y, smx.z)))
for ob in list(bpy.context.scene.objects):
    if ob not in (sleeper, fix):
        bpy.data.objects.remove(ob)
# Matériau PBR du pack (le FBX ne référence pas ses textures)
mat = bpy.data.materials.new("voie_bois")
mat.use_nodes = True
nt = mat.node_tree
bsdf = nt.nodes["Principled BSDF"]


def img(kind, color):
    n = nt.nodes.new("ShaderNodeTexImage")
    n.image = bpy.data.images.load(f"{src}/textures/railroad_gav_railroad_gav_{kind}.png")
    n.image.colorspace_settings.name = "sRGB" if color else "Non-Color"
    return n


nt.links.new(img("BaseColor", True).outputs["Color"], bsdf.inputs["Base Color"])
nt.links.new(img("Roughness", False).outputs["Color"], bsdf.inputs["Roughness"])
nt.links.new(img("Metallic", False).outputs["Color"], bsdf.inputs["Metallic"])
nm = nt.nodes.new("ShaderNodeNormalMap")
nt.links.new(img("Normal", False).outputs["Color"], nm.inputs["Color"])
nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
for ob in (sleeper, fix):
    ob.data.materials.clear()
    ob.data.materials.append(mat)
# Réduction de géométrie (≈ 22 000 traverses par voie double) : planaire puis collapse léger
for ob, ratio in ((sleeper, 0.5), (fix, 0.35)):
    m = ob.modifiers.new("dec", "DECIMATE")
    m.decimate_type = "COLLAPSE"
    m.ratio = ratio
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.modifier_apply(modifier="dec")
    print(ob.name, "triangles", sum(len(p.vertices) - 2 for p in ob.data.polygons), [round(v, 3) for v in ob.dimensions])
# Longueur selon X du jeu : rotation de 90° (pack : traverse selon Y)
for ob in (sleeper, fix):
    ob.rotation_euler = (0, 0, 1.5707963)
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
bpy.ops.object.transform_apply(rotation=True)
# Textures : 1K suffisent pour des pièces de 2,75 m vues du sol
for img in bpy.data.images:
    if img.size[0] > 1024:
        img.scale(1024, 1024)
bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", export_image_format="JPEG", export_jpeg_quality=85, export_yup=True, use_selection=False)
