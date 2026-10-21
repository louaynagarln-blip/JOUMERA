"""Reproducible CC0 asset import: metadata -> verified downloads -> Meshopt/WebP GLB."""
import concurrent.futures, hashlib, json, pathlib, subprocess, sys
root=pathlib.Path(__file__).resolve().parents[1]
cache=root.parent.parent/'assets-source'
def fetch(path,meta):
 path.parent.mkdir(parents=True,exist_ok=True)
 if not path.exists() or hashlib.md5(path.read_bytes()).hexdigest()!=meta['md5']:
  subprocess.run(['curl','-fLsS','--max-time','90',meta['url'],'-o',str(path)],check=True)
 assert path.stat().st_size==meta['size'] and hashlib.md5(path.read_bytes()).hexdigest()==meta['md5'],str(path)
for name in sys.argv[1:]:
 metadata=cache/(name+'.json')
 if not metadata.exists():subprocess.run(['curl','-fLsS','--max-time','45','https://api.polyhaven.com/files/'+name,'-o',str(metadata)],check=True)
 data=json.loads(metadata.read_text())['gltf']['1k']['gltf'];source=cache/name
 jobs=[(source/'model.gltf',data)]+[(source/path,meta) for path,meta in data['include'].items()]
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:list(pool.map(lambda pair:fetch(*pair),jobs))
 input_path=source/'model.gltf'
 # Upstream 1K cabinet JPEG normal is truncated despite matching its published hash.
 if name=='modern_wooden_cabinet':
  png=json.loads(metadata.read_text())['nor_gl']['1k']['png']; fetch(source/'textures/modern_wooden_cabinet_nor_gl_1k.png',png)
  gltf=json.loads(input_path.read_text())
  for image in gltf.get('images',[]):
   if image.get('uri','').endswith('_nor_gl_1k.jpg'):image['uri']=image['uri'].replace('.jpg','.png');image['mimeType']='image/png'
  input_path=source/'prepared.gltf';input_path.write_text(json.dumps(gltf))
 subprocess.run(['npx','--yes','@gltf-transform/cli@4.2.1','optimize',str(input_path),str(root/'public/assets/models'/(name+'.glb')),'--compress','meshopt','--texture-compress','webp','--texture-size','512','--simplify-ratio','0.3','--simplify-error','0.001'],check=True)
 print(name,'verified and optimized',flush=True)
