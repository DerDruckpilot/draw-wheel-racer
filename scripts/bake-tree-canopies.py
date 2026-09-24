"""Bake imported Poly Haven foliage into layered mobile canopy cards.

Run with Blender 5.1 in background mode. The imported photographed trunk stays
as a 3D mesh; nine depth slices retain the full foliage that triangle decimation
would otherwise erase. Outputs are source-derived assets, never generated art.
"""
import bpy, json, math, sys, pathlib, re
from mathutils import Vector

root=pathlib.Path.cwd()
names=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['pine_tree_01','pine_sapling_small','tree_small_02']
variants={'pine_tree_01':'pine_tree_01_a_LOD0','pine_sapling_small':'pine_sapling_small_a','tree_small_02':None}
for name in names:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    directory=root/'.local/world-assets'/name
    source=json.loads((directory/'model.gltf').read_text())
    selected=[i for i,n in enumerate(source['nodes']) if 'mesh' in n and (not variants[name] or n.get('name')==variants[name])]
    # Blender imports unused nodes too; remove the other pack variants rather
    # than just removing them from the default scene.
    source['nodes']=[source['nodes'][i] for i in selected]
    source['scenes']=[{'nodes':list(range(len(source['nodes'])))}];source['scene']=0
    selected_path=directory/'canopy-source.gltf';selected_path.write_text(json.dumps(source))
    bpy.ops.import_scene.gltf(filepath=str(selected_path))
    objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
    corners=[o.matrix_world@Vector(c) for o in objects for c in o.bound_box]
    low=Vector(tuple(min(v[i] for v in corners) for i in range(3)));high=Vector(tuple(max(v[i] for v in corners) for i in range(3)))
    center=(low+high)*.5;scale=1/max(high-low)
    for obj in objects:
        obj.matrix_world.translation=(obj.matrix_world.translation-center)*scale
        obj.scale*=scale
    # A neutral diffuse bake leaves illumination to the game. Hide wood from
    # the cards, since its separate geometry supplies parallax and collision.
    for material in bpy.data.materials:
        if not material.use_nodes:continue
        nodes=material.node_tree.nodes;links=material.node_tree.links
        bsdf=next((n for n in nodes if n.type=='BSDF_PRINCIPLED'),None)
        output=next((n for n in nodes if n.type=='OUTPUT_MATERIAL'),None)
        if not bsdf or not output:continue
        foliage=bool(re.search(r'twig|leav',material.name,re.I))
        transparent=nodes.new('ShaderNodeBsdfTransparent')
        for link in list(output.inputs['Surface'].links):links.remove(link)
        if not foliage:links.new(transparent.outputs[0],output.inputs['Surface']);continue
        emission=nodes.new('ShaderNodeEmission');emission.inputs['Strength'].default_value=1
        source_color=bsdf.inputs['Base Color']
        if source_color.is_linked:links.new(source_color.links[0].from_socket,emission.inputs['Color'])
        else:emission.inputs['Color'].default_value=source_color.default_value
        masks=list((directory/'textures').glob('mask-*'))
        mask=next((p for p in masks if re.sub(r'_alpha.*','',p.stem.removeprefix('mask-')).lower() in material.name.lower()),masks[0] if len(masks)==1 else None)
        if mask:
            texture=nodes.new('ShaderNodeTexImage');texture.image=bpy.data.images.load(str(mask));texture.image.colorspace_settings.name='Non-Color'
            mix=nodes.new('ShaderNodeMixShader');links.new(texture.outputs['Color'],mix.inputs[0]);links.new(transparent.outputs[0],mix.inputs[1]);links.new(emission.outputs[0],mix.inputs[2]);links.new(mix.outputs[0],output.inputs['Surface'])
        else:links.new(emission.outputs[0],output.inputs['Surface'])
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=8;scene.cycles.use_denoising=False
    scene.cycles.transparent_max_bounces=12;scene.render.film_transparent=True;scene.render.use_persistent_data=True
    scene.render.resolution_x=800;scene.render.resolution_y=800;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
    scene.view_settings.view_transform='Standard';scene.view_settings.look='None';scene.view_settings.exposure=0
    camera_data=bpy.data.cameras.new('Bake camera');camera=bpy.data.objects.new('Bake camera',camera_data);scene.collection.objects.link(camera);scene.camera=camera
    camera_data.type='ORTHO';camera_data.ortho_scale=1.12
    output_dir=root/'.local/tree-bakes'/name;output_dir.mkdir(parents=True,exist_ok=True)
    metadata=[]
    def xyz(v):return [v.x,v.z,-v.y]
    for angle in range(3):
        direction=Vector((math.cos(angle*math.pi/3),math.sin(angle*math.pi/3),0))
        extent=max(abs(((corner-center)*scale).dot(direction)) for corner in corners)+.001
        camera.location=direction*3;camera.rotation_euler=(-direction).to_track_quat('-Z','Y').to_euler()
        bpy.context.view_layer.update();matrix=camera.matrix_world.to_3x3();right=matrix@Vector((1,0,0));up=matrix@Vector((0,1,0))
        for layer in range(3):
            depth=(layer-1)*extent*2/3;camera_data.clip_start=3-depth-extent/3;camera_data.clip_end=3-depth+extent/3
            file=f'canopy-{angle}-{layer}.png';scene.render.filepath=str(output_dir/file);bpy.ops.render.render(write_still=True)
            metadata.append({'file':file,'center':xyz(direction*depth),'right':xyz(right*.56),'up':xyz(up*.56)})
    (output_dir/'cards.json').write_text(json.dumps(metadata))
    print('BAKED',name,flush=True)
