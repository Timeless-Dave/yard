"""Reproducibly derive the game map from the checked-in OSM XML snapshot.
OSM data © OpenStreetMap contributors, ODbL 1.0. See docs/references/README.md.
Run from repo root: python3 scripts/importUapbMap.py
"""
from pathlib import Path
import xml.etree.ElementTree as ET
import math,json
ROOT=Path(__file__).resolve().parents[1]
r=ET.parse(ROOT/'docs/references/uapb-osm.xml').getroot()
nodes={n.attrib['id']:n.attrib for n in r.findall('node')}
LAT,LON,SCALE=34.2422394,-92.0206016,.35
xmin,xmax,zmin,zmax=-190,100,-500,110

def project(n):
 return {'x':round((float(n['lon'])-LON)*111320*math.cos(math.radians(LAT))*SCALE,3),'z':round(-(float(n['lat'])-LAT)*111320*SCALE,3)}
def inside(p):return xmin<=p['x']<=xmax and zmin<=p['z']<=zmax
buildings=[];roads=[]
for w in r.findall('way'):
 tags={t.attrib['k']:t.attrib['v'] for t in w.findall('tag')}
 pts=[project(nodes[n.attrib['ref']]) for n in w.findall('nd') if n.attrib['ref'] in nodes]
 if not pts or not any(inside(p) for p in pts):continue
 if tags.get('building') and tags.get('name'):
  xs=[p['x'] for p in pts];zs=[p['z'] for p in pts]
  buildings.append({'osmId':w.attrib['id'],'name':tags['name'],'x':round((min(xs)+max(xs))/2,3),'z':round((min(zs)+max(zs))/2,3),'w':round(max(xs)-min(xs),3),'d':round(max(zs)-min(zs),3),'footprint':pts,'version':w.attrib.get('version')})
 if tags.get('highway') and tags.get('access')!='private':
  # Clip each continuous run; never invent a bridge over an omitted segment.
  runs=[];run=[]
  for p in pts:
   if inside(p):run.append(p)
   else:
    if len(run)>1:runs.append(run)
    run=[]
  if len(run)>1:runs.append(run)
  for index,points in enumerate(runs):
   roads.append({'id':w.attrib['id']+'-'+str(index),'osmId':w.attrib['id'],'name':tags.get('name','Campus path' if tags['highway']=='footway' else 'Campus access road'),'kind':tags['highway'],'points':points})
result={'source':'https://www.openstreetmap.org/copyright','retrieved':'2026-10-18','origin':{'lat':LAT,'lon':LON},'scale':SCALE,'bounds':{'xMin':xmin,'xMax':xmax,'zMin':zmin,'zMax':zmax},'buildings':buildings,'roads':roads}
(ROOT/'src/uapbMap.generated.json').write_text(json.dumps(result,separators=(',',':'))+'\n')
print(f'Imported {len(buildings)} named footprints and {len(roads)} road/path runs')
