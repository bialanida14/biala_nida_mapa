/* Biała Nida | Panel nieruchomości, wersja WWW 19 — migracja źródłowej wersji v17.
   Dane jawne w /data/dzialki.geojson. Nie przechowuj tajnych danych w repozytorium publicznym. */
'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const colors = { 'Karsznice':'#218d71','Rembieszyce':'#377fb5','Mzurowa':'#ca922e','Bizoręda':'#925bb3' };
  const fallback = '#677c83';
  const numbers = new Intl.NumberFormat('pl-PL',{minimumFractionDigits:2,maximumFractionDigits:4});
  const fixed = n => numbers.format(n);
  const num = p => { const n = Number(String(p.powierzchnia_ha||'').replace(',','.')); return Number.isFinite(n) && String(p.powierzchnia_ha||'').trim()!=='' ? n : null; };
  const name = p => `${p.obreb} · ${p.numer}`;
  const status = text => { $('mapStatus').textContent = text; };
  const persistKey = 'bn-v19-selected';
  let parcels = [], map, allBounds, geo, zoneLayer, labelsLayer, active = null, layerSet = new Map(), selected = new Set(), regionToggles = [];
  let filtered = [], basemaps = {}, habitatLayer, birdsLayer, cadLayer, showLabels = true, hovered = null;

  async function start() {
    try {
      if (!window.L) throw new Error('Nie udało się pobrać biblioteki Leaflet. Sprawdź połączenie z internetem.');
      const [parcelResponse, zoneResponse] = await Promise.all([
        fetch('data/dzialki.geojson'),fetch('data/strefa100m.geojson').catch(()=>null)
      ]);
      if (!parcelResponse.ok) throw new Error('Nie można odczytać data/dzialki.geojson (HTTP '+parcelResponse.status+').');
      const collection = await parcelResponse.json();
      if (collection.type !== 'FeatureCollection' || !Array.isArray(collection.features) || !collection.features.length) throw new Error('Błędne lub puste dane GeoJSON.');
      parcels = collection.features.filter(f=>f?.geometry && f.properties?.identyfikator);
      if (!parcels.length) throw new Error('Plik nie zawiera poprawnych działek.');
      parcels.forEach(f => f.properties.obreb = String(f.properties.obreb||'Nieznany'));
      try { const saved = JSON.parse(localStorage.getItem(persistKey)||'[]'); if(Array.isArray(saved))selected = new Set(saved.filter(id=>parcels.some(f=>f.properties.identyfikator===id))); } catch(_) {}
      initMap();
      if(zoneResponse?.ok) {
        const feature = await zoneResponse.json();
        map.createPane('zonePane'); map.getPane('zonePane').style.zIndex = 365; map.getPane('zonePane').style.pointerEvents = 'none';
        zoneLayer = L.geoJSON(feature,{pane:'zonePane',interactive:false,style:{color:'#e3886b',weight:1.3,dashArray:'5 5',fillColor:'#f4b09d',fillOpacity:.10}});
      } else { $('zoneToggle').disabled = true; }
      await configureLocalTiles();
      initUi();
      refreshAll();
      status('Mapa gotowa · '+parcels.length+' działek · lokalna ortofotomapa');
      setTimeout(() => { if($('mapStatus').textContent.startsWith('Mapa gotowa'))$('mapStatus').textContent = 'Kliknij działkę, aby zobaczyć jej szczegóły'; }, 3500);
    } catch(err) {
      console.error(err);
      status('Błąd: '+err.message);
      $('parcelList').textContent = 'Błąd ładowania danych mapy. Uruchom stronę przez serwer HTTP (np. GitHub Pages), a nie przez dwuklik w plik HTML.';
    }
  }

  function initMap() {
    map = L.map('map',{zoomControl:true,preferCanvas:true,zoomSnap:.5,maxZoom:21});
    // Leaflet wymaga ustawionego widoku ZANIM dołączymy warstwy kafelkowe.
    // Wyznaczamy go bezpośrednio z geometrii 226 działek.
    const initialBounds = L.geoJSON({type:'FeatureCollection',features:parcels}).getBounds();
    if (!initialBounds.isValid()) throw new Error('Niepoprawna geometria działek.');
    map.fitBounds(initialBounds.pad(.08),{animate:false,padding:[30,30]});
    basemaps.ortho = L.tileLayer.wms('https://mapy.geoportal.gov.pl/wss/service/PZGIK/ORTO/WMS/StandardResolution',{
      layers:'Raster',format:'image/jpeg',transparent:false,version:'1.3.0',maxZoom:21,
      updateWhenIdle:true,keepBuffer:2,attribution:'Ortofotomapa © GUGiK / Geoportal'
    });
    basemaps.osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
      maxZoom:19,maxNativeZoom:19,attribution:'© OpenStreetMap contributors'
    });
    // Oryginalna ortofotomapa 9000 × 6000 px z aktualnego archiwum GitHub.
    // Granice geograficzne odczytane z pliku index.html v17, HD_ORTHO.bounds.
    map.createPane('localOrthoPane');
    map.getPane('localOrthoPane').style.zIndex = '225';
    map.getPane('localOrthoPane').style.pointerEvents = 'none';
    const hdBounds = [[50.73177423559707,20.274967848513462],[50.78806406849431,20.379894817992586]];
    const orthoHd = L.imageOverlay('biala_nida_ortofoto_hd.webp', hdBounds, {
      pane:'localOrthoPane', interactive:false, opacity:1,
      attribution:'Lokalna ortofotomapa HD — dane przekazane w projekcie Biała Nida'
    });
    basemaps.local = L.layerGroup([basemaps.osm, orthoHd]);
    basemaps.local.addTo(map);
    map.createPane('naturePane');map.getPane('naturePane').style.zIndex='345';map.getPane('naturePane').style.pointerEvents='none';
    const natureUrl = 'https://sdi.gdos.gov.pl/wms';
    habitatLayer = L.tileLayer.wms(natureUrl,{layers:'GDOS:SpecjalneObszaryOchrony',styles:'',format:'image/png',transparent:true,opacity:.5,version:'1.3.0',pane:'naturePane',attribution:'Natura 2000 © GDOŚ'});
    birdsLayer = L.tileLayer.wms(natureUrl,{layers:'GDOS:ObszarySpecjalnejOchrony',styles:'',format:'image/png',transparent:true,opacity:.5,version:'1.3.0',pane:'naturePane',attribution:'Natura 2000 © GDOŚ'});
    map.createPane('cadPane');map.getPane('cadPane').style.zIndex='370';map.getPane('cadPane').style.pointerEvents='none';
    cadLayer = L.tileLayer.wms('https://integracja.gugik.gov.pl/cgi-bin/KrajowaIntegracjaEwidencjiGruntow',{
      layers:'dzialki',format:'image/png',transparent:true,version:'1.1.1',pane:'cadPane',opacity:.8,attribution:'Granice ewidencji — KIEG (online)'
    });
    labelsLayer = L.layerGroup().addTo(map);
    geo = L.geoJSON({type:'FeatureCollection',features:parcels},{
      style:f=>getStyle(f),
      onEachFeature:(f,layer)=>{
        const id = f.properties.identyfikator;
        layerSet.set(id,{layer,feature:f,bounds:layer.getBounds()});
        layer.on('mouseover',()=>{hovered=id;repaintOne(id);});
        layer.on('mouseout',()=>{hovered=null;repaintOne(id);});
        layer.on('click',()=>{setActive(id);toggleSelected(id);});
      }
    }).addTo(map);
    allBounds=geo.getBounds();
    if(!allBounds.isValid())throw new Error('Niepoprawna geometria działek.');
    map.on('moveend zoomend',refreshLabels);
    map.on('click',e=>{ if(e.originalEvent?.target?.closest?.('.leaflet-interactive'))return; });
  }

  async function configureLocalTiles() {
    try {
      const r=await fetch('tiles/config.json',{cache:'no-store'});
      if(!r.ok) return;
      const cfg=await r.json();
      if(!cfg.enabled) return;
      const ext=String(cfg.extension||'png').toLowerCase();
      if(!['png','jpg','jpeg','webp'].includes(ext))return;
      basemaps.tiles=L.tileLayer(`tiles/{z}/{x}/{y}.${ext}`,{
        minZoom:Number(cfg.minZoom)||0,maxNativeZoom:Number(cfg.maxZoom)||18,maxZoom:21,
        attribution:String(cfg.attribution||'Ortofotomapa lokalna'),keepBuffer:2
      });
      const option=document.createElement('option');option.value='tiles';option.textContent='Ortofotomapa lokalna (kafelki XYZ)';$('basemap').append(option);
    } catch(_) { /* Lokalna ortofotomapa jest opcjonalna. */ }
  }

  function getStyle(f) {
    const id=f.properties.identyfikator;
    const activeStyle=id===active, isSelected=selected.has(id), isHover=hovered===id;
    if(isSelected) return {color:'#ffcc57',weight:3,opacity:1,fillColor:'#ffc64c',fillOpacity:.43};
    if(activeStyle) return {color:'#eafef7',weight:2.8,opacity:1,fillColor:'#399c85',fillOpacity:.38};
    if(isHover) return {color:'#ffffff',weight:1.9,opacity:1,fillColor:colors[f.properties.obreb]||fallback,fillOpacity:.34};
    return {color:'#ffffff',weight:.9,opacity:.90,fillColor:colors[f.properties.obreb]||fallback,fillOpacity:.20};
  }
  function repaintOne(id){const ent=layerSet.get(id);if(ent && geo.hasLayer(ent.layer)){ent.layer.setStyle(getStyle(ent.feature));if(selected.has(id)||active===id)ent.layer.bringToFront();}}
  function repaintAll(){layerSet.forEach((_,id)=>repaintOne(id));}
  function getRegions(){return [...new Set(parcels.map(f=>f.properties.obreb))].sort((a,b)=>a.localeCompare(b,'pl'));}
  function enabledRegions(){return new Set(regionToggles.filter(x=>x.checked).map(x=>x.dataset.region));}
  function getFiltered(){
    const q=$('search').value.trim().toLocaleLowerCase('pl');
    const min=Number($('minArea').value)||0;
    const regions=enabledRegions();
    const arr=parcels.filter(f=>{
      const p=f.properties,a=num(p);
      return regions.has(p.obreb) && (min<=0 || (a!==null && a>=min)) && (!q || [p.numer,p.identyfikator,p.obreb].some(v=>String(v||'').toLocaleLowerCase('pl').includes(q)));
    });
    const order=$('sort').value;
    arr.sort((a,b)=>{
      const pa=a.properties,pb=b.properties;
      if(order==='areaDesc')return (num(pb)??-1)-(num(pa)??-1);
      if(order==='areaAsc')return (num(pa)??Infinity)-(num(pb)??Infinity);
      return pa.obreb.localeCompare(pb.obreb,'pl')||String(pa.numer).localeCompare(String(pb.numer),'pl',{numeric:true});
    });
    return arr;
  }
  function filterMap(){
    const allowed=new Set(filtered.map(f=>f.properties.identyfikator));
    layerSet.forEach((e,id)=>{if(allowed.has(id) && !geo.hasLayer(e.layer))geo.addLayer(e.layer);else if(!allowed.has(id) && geo.hasLayer(e.layer))geo.removeLayer(e.layer);});
    repaintAll();refreshLabels();
  }
  function refreshLabels(){
    if(!labelsLayer)return;
    labelsLayer.clearLayers();
    if(!showLabels || map.getZoom()<15)return;
    const bounds=map.getBounds().pad(.08),occupied=new Set();
    layerSet.forEach(({layer,feature,bounds:parcelBounds})=>{
      if(!geo.hasLayer(layer)||!bounds.intersects(parcelBounds))return;
      const center=parcelBounds.getCenter(); if(!bounds.contains(center))return;
      const point=map.latLngToContainerPoint(center),key=`${Math.floor(point.x/45)}:${Math.floor(point.y/25)}`;
      if(occupied.has(key))return; occupied.add(key);
      const span=document.createElement('span');span.textContent=feature.properties.numer;
      L.marker(center,{interactive:false,keyboard:false,icon:L.divIcon({className:'parcel-number',html:span.outerHTML,iconSize:[50,19],iconAnchor:[25,10]})}).addTo(labelsLayer);
    });
  }
  function node(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
  function createListItem(f){
    const p=f.properties,id=p.identyfikator;
    const row=node('div','parcel-row'+(selected.has(id)?' selected':'')+(active===id?' active':''));
    const main=node('button','parcel-row-main');main.type='button';
    main.append(node('strong','',name(p)),node('small','',num(p)===null?'Powierzchnia: brak danych':`${fixed(num(p))} ha · ${p.identyfikator}`));
    const add=node('button','parcel-row-add',selected.has(id)?'−':'+');add.type='button';add.setAttribute('aria-label',selected.has(id)?'Usuń z wyboru':'Dodaj do wyboru');
    main.addEventListener('click',()=>{setActive(id);zoomTo([f]);if(innerWidth<721)$('sidebar').classList.remove('open');});
    add.addEventListener('click',()=>{toggleSelected(id);});
    row.append(main,add);return row;
  }
  function renderList(){
    const list=$('parcelList');list.replaceChildren();
    $('resultsCount').textContent=String(filtered.length);
    if(!filtered.length){list.append(node('div','empty','Brak działek spełniających kryteria. Zmień filtry lub wyszukiwaną frazę.'));return;}
    const fragment=document.createDocumentFragment();filtered.slice(0,90).forEach(f=>fragment.append(createListItem(f)));
    list.append(fragment);
    if(filtered.length>90)list.append(node('div','empty',`Wyświetlono pierwsze 90 wyników z ${filtered.length}. Zawęź wyszukiwanie, aby zobaczyć pozostałe.`));
  }
  function renderSelection(){
    const chosen=[...selected].map(id=>layerSet.get(id)?.feature).filter(Boolean);
    const known=chosen.map(f=>num(f.properties)).filter(x=>x!==null), missing=chosen.length-known.length;
    const total=known.reduce((a,b)=>a+b,0);
    $('selectedBadge').textContent=String(chosen.length);
    $('selectionCount').textContent=String(chosen.length);
    $('selectionArea').textContent=chosen.length ? `${fixed(total)} ha` : '0 ha';
    $('selectionArea').title=missing?`${missing} działek bez podanej powierzchni`:'Powierzchnia wg wykazu';
    $('fitSelected').disabled=chosen.length===0;$('downloadCsv').disabled=chosen.length===0;$('clearSelected').disabled=chosen.length===0;
    const list=$('selectedList');list.replaceChildren();
    if(!chosen.length){list.append(node('div','empty','Nie wybrano działek. Dodaj je z listy lub klikając bezpośrednio na mapie.'));return;}
    const fragment=document.createDocumentFragment();chosen.sort((a,b)=>a.properties.obreb.localeCompare(b.properties.obreb,'pl')).forEach(f=>fragment.append(createListItem(f)));
    list.append(fragment);
  }
  function refreshAll(){
    filtered=getFiltered();filterMap();renderList();renderSelection();
  }
  function setActive(id){
    const previous=active;active=id;
    if(previous)repaintOne(previous);repaintOne(id);
    const p=layerSet.get(id)?.feature.properties;if(!p)return;
    $('detailTitle').textContent=`Działka ${p.numer}`;
    $('detailRegion').textContent=p.obreb;
    $('detailArea').textContent=num(p)===null?'Brak danych':`${fixed(num(p))} ha`;
    $('detailId').textContent=p.identyfikator;
    $('detailAdd').textContent=selected.has(id)?'Usuń z wyboru':'Dodaj do wyboru';
    $('parcelDetail').hidden=false;
    renderList();renderSelection();
  }
  function toggleSelected(id){
    if(selected.has(id))selected.delete(id);else selected.add(id);
    try{localStorage.setItem(persistKey,JSON.stringify([...selected]));}catch(_){}
    repaintOne(id);renderList();renderSelection();
    if(active===id)$('detailAdd').textContent=selected.has(id)?'Usuń z wyboru':'Dodaj do wyboru';
  }
  function zoomTo(features){
    if(!features.length)return;
    const b=L.latLngBounds([]);
    features.forEach(f=>{const ent=layerSet.get(f.properties.identyfikator);if(ent)b.extend(ent.bounds);});
    if(b.isValid())map.fitBounds(b.pad(.26),{maxZoom:19,animate:true,padding:[35,35]});
  }
  function updateBasemap(value){
    Object.values(basemaps).forEach(layer=>{if(map.hasLayer(layer))map.removeLayer(layer);});
    (basemaps[value]||basemaps.local).addTo(map);
  }
  function toggleOverlay(boxId,layer){const input=$(boxId);input.addEventListener('change',()=>{if(input.checked)layer.addTo(map);else map.removeLayer(layer);});}
  function switchTab(target){
    $('allPanel').hidden=target!=='all';$('selectedPanel').hidden=target!=='selected';
    $('tabAll').classList.toggle('active',target==='all');$('tabSelected').classList.toggle('active',target==='selected');
    $('tabAll').setAttribute('aria-selected',target==='all');$('tabSelected').setAttribute('aria-selected',target==='selected');
  }
  function downloadCsv(){
    const chosen=[...selected].map(id=>layerSet.get(id)?.feature).filter(Boolean);
    const quote=s=>{let str=String(s??'');if(/^[=+@\-\t\r]/.test(str))str="'"+str;return '"'+str.replaceAll('"','""')+'"';};
    const rows=[['Obręb','Numer','Identyfikator','Powierzchnia (ha)']];
    chosen.forEach(f=>{const p=f.properties;rows.push([p.obreb,p.numer,p.identyfikator,p.powierzchnia_ha??'']);});
    const sum=chosen.map(f=>num(f.properties)).filter(n=>n!==null).reduce((a,b)=>a+b,0);
    rows.push(['SUMA','','',sum.toFixed(4).replace('.',',')]);
    const csv='\ufeff'+rows.map(r=>r.map(quote).join(';')).join('\r\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='biala-nida-wybrane-dzialki.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function initUi(){
    $('totalCount').textContent=String(parcels.length);
    const known=parcels.map(f=>num(f.properties)).filter(n=>n!==null);
    $('totalArea').textContent=fixed(known.reduce((a,b)=>a+b,0));
    const missing=parcels.length-known.length;
    if(missing){$('dataNotice').hidden=false;$('dataNotice').textContent=`Uwaga: ${missing} działek nie ma wpisanej powierzchni — suma nie obejmuje tych pozycji.`;}
    const legend=node('div','legend-items');
    getRegions().forEach(region=>{
      const count=parcels.filter(f=>f.properties.obreb===region).length;
      const row=node('label','region');
      const c=node('input');c.type='checkbox';c.checked=true;c.dataset.region=region;c.addEventListener('change',refreshAll);regionToggles.push(c);
      const dot=node('span','swatch');dot.style.background=colors[region]||fallback;
      row.append(c,dot,node('span','region-name',region),node('span','region-count',String(count)));
      $('regions').append(row);
      const l=node('div','legend-item');const sw=node('span','swatch');sw.style.background=colors[region]||fallback;l.append(sw,node('span','',region));legend.append(l);
    });
    $('mapLegend').append(legend);
    $('allRegions').addEventListener('click',()=>{regionToggles.forEach(x=>x.checked=true);refreshAll();});
    ['search','minArea','sort'].forEach(id=>$(id).addEventListener('input',refreshAll));
    $('resetFilters').addEventListener('click',()=>{$('search').value='';$('minArea').value='0';$('sort').value='region';regionToggles.forEach(x=>x.checked=true);refreshAll();});
    $('tabAll').addEventListener('click',()=>switchTab('all'));$('tabSelected').addEventListener('click',()=>switchTab('selected'));
    $('fitAll').addEventListener('click',()=>zoomTo(filtered.length?filtered:parcels));
    $('fitSelected').addEventListener('click',()=>{const features=[...selected].map(id=>layerSet.get(id)?.feature).filter(Boolean);zoomTo(features);if(innerWidth<721)$('sidebar').classList.remove('open');});
    $('clearSelected').addEventListener('click',()=>{const prev=[...selected];selected.clear();try{localStorage.removeItem(persistKey);}catch(_){}prev.forEach(repaintOne);renderList();renderSelection();if(active)$('detailAdd').textContent='Dodaj do wyboru';});
    $('downloadCsv').addEventListener('click',downloadCsv);
    $('basemap').addEventListener('change',e=>updateBasemap(e.target.value));
    toggleOverlay('habitatToggle',habitatLayer);toggleOverlay('birdsToggle',birdsLayer);toggleOverlay('cadToggle',cadLayer);
    if(zoneLayer)toggleOverlay('zoneToggle',zoneLayer);
    $('labelToggle').addEventListener('change',e=>{showLabels=e.target.checked;refreshLabels();});
    $('layersToggle').addEventListener('click',()=>{const next=$('layersPanel').hidden;$('layersPanel').hidden=!next;$('layersToggle').setAttribute('aria-expanded',String(next));$('layerChevron').textContent=next?'⌃':'⌄';});
    $('closeDetail').addEventListener('click',()=>{const prev=active;active=null;$('parcelDetail').hidden=true;if(prev)repaintOne(prev);renderList();});
    $('detailAdd').addEventListener('click',()=>{if(active)toggleSelected(active);});
    $('detailZoom').addEventListener('click',()=>{if(active)zoomTo([layerSet.get(active).feature]);});
    $('mobilePanel').addEventListener('click',()=>{const now=$('sidebar').classList.toggle('open');if(now)setTimeout(()=>map.invalidateSize(),180);});
    const help=$('helpDialog');$('helpBtn').addEventListener('click',()=>help.showModal());$('helpClose').addEventListener('click',()=>help.close());
  }
  start();
})();
