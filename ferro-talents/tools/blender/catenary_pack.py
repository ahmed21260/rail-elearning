"""Poteau caténaire SNCF réel (Sketchfab « Portique Catenaire », Immersive Studio, CC BY 4.0 ; objets BIM
« SNCF-063-C2V-RIG-300 » et massif « TE-MOG-Massifs P 05 PN ») → poteau à treillis + massif béton pour le jeu.

Usage : <python avec bpy> tools/blender/catenary_pack.py <modele.glb> <sortie.glb>
Sortie (glTF, Y haut) : origine dans l'axe du poteau, au ras du dessus du massif ; face large selon Z (le long
de la voie) ; hauteur visible HEAD m (tête du poteau à la hauteur du feeder du jeu). Passerelle retirée.
"""
import sys
import bpy
from mathutils import Matrix, Vector

src, out = sys.argv[-2], sys.argv[-1]
HEAD = 8.75  # m : du dessus du massif (y = -0.3 du jeu) à la tête du poteau (8,45 m au-dessus du rail)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
meshes = [o for o in bpy.data.objects if o.type == "MESH"]
bpy.ops.object.select_all(action="DESELECT")
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
for o in list(bpy.data.objects):
    if o.type != "MESH":
        bpy.data.objects.remove(o)


def bbox(o):
    vs = [o.matrix_world @ v.co for v in o.data.vertices]
    return Vector([min(v[i] for v in vs) for i in range(3)]), Vector([max(v[i] for v in vs) for i in range(3)])


pole = next(o for o in meshes if "RIG" in o.name)
base = next(o for o in meshes if "Massif" in o.name)
# Passerelle : pièces détachées loin de l'axe du poteau (axe = centre du massif)
bpy.ops.object.select_all(action="DESELECT")
pole.select_set(True)
bpy.context.view_layer.objects.active = pole
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.separate(type="LOOSE")
bpy.ops.object.mode_set(mode="OBJECT")
bmin, bmax = bbox(base)
axis = (bmin + bmax) / 2
keep = []
for o in [p for p in bpy.data.objects if p.type == "MESH" and p is not base]:
    mn, mx = bbox(o)
    c = (mn + mx) / 2
    if abs(c.x - axis.x) < 60 and abs(c.y - axis.y) < 60 and (mx - mn).x < 80 and (mx - mn).y < 80:
        keep.append(o)
    else:
        bpy.data.objects.remove(o)
bpy.ops.object.select_all(action="DESELECT")
for o in keep:
    o.select_set(True)
bpy.context.view_layer.objects.active = keep[0]
bpy.ops.object.join()
pole = bpy.context.view_layer.objects.active
pmin, pmax = bbox(pole)
top_base = bmax.z
k = HEAD / (pmax.z - top_base)
print("poteau", [round(x) for x in pmax - pmin], "au-dessus du massif", round(pmax.z - top_base), "échelle", round(k, 4))
# Origine : axe du poteau, dessus du massif ; échelle ; la face large (Y du modèle) reste selon Y Blender (= le long de la voie)
pc = (pmin + pmax) / 2
M = Matrix.Scale(k, 4) @ Matrix.Translation(-Vector((pc.x, pc.y, top_base)))
for o, name in ((pole, "poteau_treillis"), (base, "massif_beton")):
    o.data.transform(M)
    o.matrix_world = Matrix.Identity(4)
    o.name = o.data.name = name
    # Les faces des profilés sont plates : ombrage plat, pas de normales lissées
    for p in o.data.polygons:
        p.use_smooth = False
    print(name, "triangles", sum(len(p.vertices) - 2 for p in o.data.polygons), [round(v, 2) for v in o.dimensions])
bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", export_yup=True, export_texcoords=True, export_normals=True)
