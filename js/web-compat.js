/* Cadran web compatibility layer. This file emulates the subset of Chrome extension APIs
   used by Cadran. Browser-only features are replaced with web-safe alternatives. */
(function () {
  'use strict';
  window.CADRAN_WEB_MODE = true;
  const MESSAGES = {"actionFailed":"Couldn’t complete the action","actionTitle":"Open Cadran","add":"Add","addFolders":"Add folders…","addSiteMenu":"Add a site…","addSiteOrFolder":"Add a site or a folder","addSiteTitle":"Add a site","addTileSetting":"“Add” tile","addToFolder":"Add to “$1”","addedToBookmarks":"Added to bookmarks","address":"Address","addressPlaceholder":"example.com","allow":"Allow","allowSiteAccess":"Allow site access","allowSiteAccessFirst":"Allow site access first (Settings › More › High-resolution icons).","alreadyShown":"Already shown","alreadyShownAsTab":"Already shown as a tab","auto":"Auto","automatic":"Automatic","back":"Back","backup":"Backup","backupImported":"Backup imported","behavior":"Behavior","blur":"Blur","bookmarkletsBlocked":"Bookmarklets can’t run from this page.","bookmarks":"Bookmarks","browseAllFolders":"Browse all folders…","cancel":"Cancel","cantMoveIntoItself":"A folder can’t be moved into itself.","cantOpenLink":"This link couldn’t be opened.","cantOpenPrivate":"A private window couldn’t be opened.","cantUndo":"Couldn’t undo.","changeIconMenu":"Change icon…","changeWallpaperMenu":"Change wallpaper…","choose":"Choose","chooseAnotherFolder":"Choose another folder","chooseAnotherFolderMenu":"Choose another folder…","chooseEngine":"Choose search engine","chooseFolderForTab":"Choose this tab’s folder","chooseFolders":"Choose folders","clock":"Clock","clockAnalog":"Analog","clockDigital":"Digital","clockSeconds":"Second hand","clockSecondsHint":"It sweeps round in just under a minute, then pauses and sets off again on the minute.","clockStyle":"Style","close":"Close","colorN":"Color $1","colors":"Colors","confirm":"Confirm","copyFailed":"Couldn’t copy","copyLink":"Copy link","create":"Create","customColor":"Custom color","dark":"Dark","darkWallpaper":"Different wallpaper in dark mode","darkWallpaperHint":"Switches automatically with your system’s light or dark theme","date":"Date","defaultEngineShort":"Default engine","defaultFolderName":"Folder","defaultWallpaperAllTabs":"Default wallpaper (all tabs)","delete":"Delete","deleteConfirmTitle":"Delete “$1”?","deleteFailed":"Couldn’t delete: $1","deleteFolderMenu":"Delete folder…","deleteFolderText_one":"The folder and the link it contains will be removed from your bookmarks.","deleteFolderText_other":"The folder and the $1 links it contains will be removed from your bookmarks.","deleteImage":"Delete this image","deleteImageConfirm":"Delete this image?","deletedToast":"“$1” deleted","dim":"Darken","displayedName":"Display name","done":"Done","dropImageHint":"Drop an image (JPEG, PNG, WebP…) to use it as your wallpaper.","dropImagesHint":"Tip: drag one or more images straight onto the page.","editBookmarkTitle":"Edit bookmark","editMenu":"Edit…","emptyFolderShort":"empty","emptyFolderText":"Add a site with the “+” tile, or drag a link here.","emptyFolderTitle":"This folder is empty","engineBrowserDefault":"Browser’s default engine","errorTitle":"Something went wrong","expand":"Expand","export":"Export","exportHint":"Tabs, appearance, custom icons","exportSettings":"Export settings","extDescription":"A Safari / Vivaldi-style New Tab page: your bookmark folders as icon grids, with a customizable wallpaper.","extName":"Cadran — Speed Dial for your bookmarks","fetchSiteIconsHint":"Fetch each site’s icon","fetchingIcons":"Fetching icons…","fieldRequired":"The “$1” field is required.","filterFolders":"Filter folders…","folderMissingText":"The folder “$1” no longer exists in your bookmarks.","folderName":"Folder name","folderNotFound":"Folder not found","folderPreview":"Folder preview","foldersAsTabs":"Folders shown as tabs","foldersHint":"Each folder becomes a tab at the top of the page. Additions, deletions and drag-and-drop are saved straight to your browser’s bookmarks, so everything stays in sync.","footer":"Cadran $1 — your data stays in your browser.","format12h":"12-hour","format24h":"24-hour","fromImageAddress":"From an image address","goTo":"Go to $1","grad_aurore":"Aurora","grad_brume":"Mist","grad_crepuscule":"Dusk","grad_foret":"Forest","grad_graphite":"Graphite","grad_lagon":"Lagoon","grad_lavande":"Lavender","grad_menthe":"Mint","grad_nuit":"Night","grad_ocean":"Ocean","grad_peche":"Peach","grad_sierra":"Sierra","gradients":"Gradients","greeting":"Greeting","greetingAfternoon":"Good afternoon","greetingEvening":"Good evening","greetingHint":"Good morning, Good afternoon, Good evening…","greetingMorning":"Good morning","greetingNight":"Good night","greetingWithName":"$1, $2","hdIcons":"High-resolution icons","hdIconsHint":"Cadran downloads each site’s official icon (the one Safari and the iPhone use) straight from the site, with no cookies and no third-party service. The permission is used for that alone. Otherwise, Cadran uses the favicons your browser already knows, or a letter.","hoverFolderTabs":"Folder tabs on hover","hoverFolderTabsHint":"Tabs only appear when you point at them, or while dragging.","iconOfTitle":"Icon for “$1”","iconSize":"Icon size","iconsCached_one":"$1 icon cached","iconsCached_other":"$1 icons cached","iconsNoticeText":"Let Cadran fetch each site’s official icon. Access is used only to download these icons.","iconsNoticeTitle":"Sharp icons, just like Safari","iconsWillRedownload":"Icons will be downloaded again.","imageAddress":"Image address","imageDownloadFailed":"This image couldn’t be downloaded. Save it, then import it.","imageUnreadable":"This image couldn’t be read.","images":"Images","imagesAdded_one":"Wallpaper updated","imagesAdded_other":"$1 images added","imagesFailed_one":"$1 image couldn’t be imported.","imagesFailed_other":"$1 images couldn’t be imported.","importBackup":"Import a backup","importEllipsis":"Import…","importFailed":"Import failed","importImageEllipsis":"Import an image…","importImages":"Import images","importedTag":"imported","importingImages_one":"Importing image…","importingImages_other":"Importing $1 images…","includeWallpapers":"Include wallpaper images","invalidAddress":"Invalid address.","kbActions":"Actions (edit, icon, delete…)","kbCmdClick":"⌘ / Ctrl + click","kbEscape":"Esc","kbParentFolder":"Go up to the parent folder","kbPrevNextTab":"Previous / next tab","kbRightClick":"Right-click","kbSearch":"Search","kbSwipeTabs":"Swipe between tabs (trackpad)","kbTwoFingers":"Two fingers ↔","lang":"en","later":"Later","letterOrEmoji":"Letter or emoji","light":"Light","lightAndDark":"Light and dark","linkAdded":"“$1” added","linkCopied":"Link copied","links_one":"$1 link","links_other":"$1 links","location":"Location","maxColumns":"Columns (max.)","menusAndPanels":"Menus and panels","moveDown":"Move down","moveLeft":"Move left","moveRight":"Move right","moveUp":"Move up","movedInto":"Moved to “$1”","name":"Name","namePlaceholder":"Optional — taken from the page","newFolderMenu":"New folder…","newFolderTitle":"New folder","newTabTitle":"New Tab","noBookmarkFolders":"No bookmark folders found. Import your bookmarks into your browser (Bookmarks menu › Import), then come back here.","noDirectLinks":"This folder has no direct links.","noFoldersYet":"No folders yet.","noMatchingFolder":"No matching folder.","notABackup":"This file isn’t a Cadran backup.","open":"Open","openAllInGroup":"Open all in a tab group","openAllInTabs":"Open all in tabs","openAllInWindow":"Open all in a new window","openAllText":"All the links in the folder “$1” will open.","openInNewTab":"Open in new tab","openInNewWindow":"Open in new window","openInPrivateWindow":"Open in private window","openLinks":"Open links in","openLinksHint":"⌘/Ctrl + click always opens a new tab","openNewTab":"New tab","openSameTab":"Same tab","openTabsConfirm_one":"Open $1 tab?","openTabsConfirm_other":"Open $1 tabs?","openThisAddress":"Open this address","optional":"Optional","ownHint":"own","ownWallpaper":"Own wallpaper for this tab","panelTitle":"Settings","parentFolder":"Parent folder","parentFolderHint":"Parent folder (Esc)","recentlyClosed":"Recently closed","recentlyClosedHint":"Tabs and windows to reopen","redownload":"Download again","redownloadAll":"Download all again","removeTab":"Remove tab","removeTabHint":"Remove tab (the folder isn’t deleted)","renameFolderTitle":"Rename folder","renameMenu":"Rename…","renameTabHelp":"The bookmark folder isn’t renamed. Leave empty to use its name.","renameTabMenu":"Rename tab…","renameTabTitle":"Rename tab","reopenWindow":"Reopen window ($1)","reset":"Reset","resetConfirmText":"Your bookmarks aren’t affected; only Cadran’s settings go back to their defaults.","resetConfirmTitle":"Reset settings?","revokeSiteAccess":"Revoke access","rotateDaily":"Every day","rotateEachOpening":"Each new tab","rotateImages":"Change image automatically","rotateNever":"Never","save":"Save","search":"Search","searchBar":"Search bar","searchBarHint":"Also filters all your bookmarks","searchEngine":"Engine","searchEngineHeader":"Search engine","searchFor":"Search for “$1”","searchPlaceholder":"Search the web or your bookmarks","searchPlaceholderWith":"Search with $1 or your bookmarks","sections":"Sections","sectionsPermissionHint":"These two sections need an extra permission, requested only when you turn them on.","selectAFolder":"Select a folder.","selectAtLeastOneFolder":"Select at least one folder.","setWallpaperOf":"Set the wallpaper of","setWallpaperOfHint":"Each tab can keep the default wallpaper or have its own","shortcut":"Shortcut","shortcuts":"Shortcuts","show":"Show","showAnotherFolder":"Show another folder","showAsTab":"Show as a tab","showFoldersTitle":"Show folders","showFolders_one":"Show this folder","showFolders_other":"Show these $1 folders","showNames":"Show site / folder names","showTime":"Show the time","siteAccessGranted":"Site access allowed","siteAccessNotGranted":"Site access not allowed","styleCards":"Cards","styleIcons":"Icons","tabAppearance":"Appearance","tabFolders":"Folders","tabHome":"Home","tabMore":"More","tabName":"Tab name","tabNameHint":"Name shown on the tab (the folder isn’t renamed)","tabRemoved":"Tab “$1” removed","tabSection":"Tab","tabWallpaper":"Wallpaper","tabWallpaperMenu":"Wallpaper for this tab…","tabWallpaperStillDefault":"Wallpaper for this tab (default for now)","tabWithOwnWallpaper":"$1 — own wallpaper","tabsCount_one":"$1 tab","tabsCount_other":"$1 tabs","textOnWallpaper":"Text on wallpaper","tileStyle":"Style","tiles":"Tiles","timeFormat":"Time format","topSites":"Frequently visited","topSitesHint":"Based on your browsing history","undo":"Undo","unsupportedFormat":"Unsupported format: $1","untitled":"Untitled","use":"Use","usesDefaultForNow":"For now, it uses the default wallpaper","variantToSet":"Wallpaper to set","wallpaper":"Wallpaper","wallpaperSettings":"Wallpaper settings","wallpaperToSet":"Wallpaper to set","welcomeText":"Choose the bookmark folders to show: each folder becomes a tab, with its sites as icons and its subfolders previewed.","welcomeTitle":"Welcome to Cadran","yourName":"Your first name"};
  const KEY = 'cadran.web.storage.v1';
  const listeners = new Set();
  const bookmarkEvents = Object.fromEntries(['onCreated','onRemoved','onChanged','onMoved','onChildrenReordered','onImportBegan','onImportEnded'].map(k => [k, event() ]));
  function event() { const set = new Set(); return { addListener(fn){set.add(fn)}, removeListener(fn){set.delete(fn)}, emit(...args){for(const fn of set){try{fn(...args)}catch(e){console.error(e)}}} }; }
  function parseStore() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } }
  function writeStore(data) { localStorage.setItem(KEY, JSON.stringify(data)); }
  function defaultTree() { return { id:'0', title:'', children:[
    {id:'1',parentId:'0',title:'Bookmarks bar',children:[],index:0},
    {id:'2',parentId:'0',title:'Other bookmarks',children:[],index:1},
    {id:'3',parentId:'0',title:'Mobile bookmarks',children:[],index:2}
  ]}; }
  function getTree() { const s=parseStore(); if(!s.bookmarkTree) {s.bookmarkTree=defaultTree();writeStore(s)} return s.bookmarkTree; }
  function saveTree(tree) { const s=parseStore(); s.bookmarkTree=tree; writeStore(s); }
  function walk(node, fn) { fn(node); (node.children||[]).forEach(c=>walk(c,fn)); }
  function findIn(tree,id) { let result=null; walk(tree,n=>{if(String(n.id)===String(id))result=n}); return result; }
  function find(id) { return findIn(getTree(),id); }
  function parentOfIn(tree,id) { let found=null; walk(tree,n=>{if((n.children||[]).some(c=>String(c.id)===String(id)))found=n}); return found; }
  function parentOf(id) { return parentOfIn(getTree(),id); }
  function reindex(parent) { (parent.children||[]).forEach((n,i)=>{n.index=i;n.parentId=parent.id}); }
  function nextId() { const s=parseStore(); s.nextBookmarkId=(s.nextBookmarkId||10)+1; writeStore(s); return String(s.nextBookmarkId); }
  function notifyTree() { for(const k of Object.keys(bookmarkEvents)) if(k.startsWith('on')) { /* individual events are emitted by operations */ } }
  function deepClone(v) { return JSON.parse(JSON.stringify(v)); }

  // Import a standard Netscape-format bookmarks HTML export. Websites cannot
  // read Chrome Android's private bookmark database, so users select an export file.
  window.CadranImportBookmarks = function importBookmarksHTML(html) {
    const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
    const rootDL = doc.querySelector('dl');
    if (!rootDL) return 0;
    let next = 100;
    let imported = 0;
    const makeId = () => String(++next);
    const normalize = (s) => String(s || '').trim().toLowerCase().replace(/[^a-z]/g, '');
    const roots = defaultTree();
    const rootByName = new Map([
      ['bookmarkbar', roots.children[0]], ['bookmarksbar', roots.children[0]],
      ['otherbookmarks', roots.children[1]], ['mobilebookmarks', roots.children[2]],
    ]);
    function readDL(dl, parent) {
      for (const dt of Array.from(dl.children).filter(el => el.tagName === 'DT')) {
        const heading = Array.from(dt.children).find(el => el.tagName === 'H3');
        const anchor = Array.from(dt.children).find(el => el.tagName === 'A');
        const nested = Array.from(dt.children).find(el => el.tagName === 'DL');
        if (heading) {
          const title = heading.textContent.trim() || 'Folder';
          const node = { id: makeId(), parentId: parent.id, title, children: [], index: parent.children.length };
          parent.children.push(node);
          if (nested) readDL(nested, node);
        } else if (anchor) {
          const url = anchor.getAttribute('href') || '';
          if (!/^https?:|^ftp:|^mailto:/i.test(url)) continue;
          parent.children.push({ id: makeId(), parentId: parent.id, title: anchor.textContent.trim() || url, url, index: parent.children.length });
          imported++;
        } else if (nested) readDL(nested, parent);
      }
    }
    for (const dt of Array.from(rootDL.children).filter(el => el.tagName === 'DT')) {
      const heading = Array.from(dt.children).find(el => el.tagName === 'H3');
      const nested = Array.from(dt.children).find(el => el.tagName === 'DL');
      if (heading && nested) {
        const target = rootByName.get(normalize(heading.textContent));
        readDL(nested, target || roots.children[1]);
      } else if (nested) readDL(nested, roots.children[1]);
      else if (Array.from(dt.children).some(el => el.tagName === 'A')) readDL({ children: [dt] }, roots.children[1]);
    }
    if (!imported) return 0;
    roots.children.forEach((folder, i) => { folder.index = i; folder.parentId = '0'; });
    const data = parseStore();
    data.bookmarkTree = roots;
    data.nextBookmarkId = next;
    data.appStorage = data.appStorage || {};
    if (data.appStorage.settings) data.appStorage.settings.groups = [];
    writeStore(data);
    return imported;
  };

  const bookmarks = {
    ...bookmarkEvents,
    async getTree(){ return [deepClone(getTree())]; },
    async search(query){ const q=typeof query==='string'?query:(query?.url||query?.title||''); const out=[]; walk(getTree(),n=>{if(n.id==='0')return; if(!q || (n.title||'').toLowerCase().includes(q.toLowerCase()) || (n.url||'').toLowerCase().includes(q.toLowerCase()))out.push(deepClone(n))}); return out; },
    async create(details){ const tree=getTree(); const parent=findIn(tree,details.parentId||'1'); if(!parent || parent.url)throw new Error('Bookmark folder not found'); const id=nextId(); const node={id,parentId:parent.id,title:String(details.title||''),index:0}; if(details.url)node.url=String(details.url); else node.children=[]; const i=Number.isInteger(details.index)?Math.max(0,Math.min(details.index,parent.children.length)):parent.children.length; parent.children.splice(i,0,node); reindex(parent); saveTree(tree); bookmarks.onCreated.emit(id,deepClone(node)); return deepClone(node); },
    async update(id, changes){ const tree=getTree(); const n=findIn(tree,id); if(!n)throw new Error('Bookmark not found'); const oldUrl=n.url; if(changes.title!==undefined)n.title=String(changes.title); if(changes.url!==undefined){if(!changes.url)delete n.url;else n.url=String(changes.url)} saveTree(tree); bookmarks.onChanged.emit(String(id),{title:n.title,url:n.url}); return deepClone(n); },
    async move(id, destination){ const tree=getTree(); const n=findIn(tree,id), oldParent=parentOfIn(tree,id); if(!n||!oldParent)throw new Error('Bookmark not found'); oldParent.children=oldParent.children.filter(c=>String(c.id)!==String(id)); reindex(oldParent); const p=findIn(tree,destination.parentId||oldParent.id); if(!p||p.url)throw new Error('Target folder not found'); const idx=Number.isInteger(destination.index)?Math.max(0,Math.min(destination.index,p.children.length)):p.children.length; p.children.splice(idx,0,n); reindex(p); saveTree(tree); bookmarks.onMoved.emit(String(id),{parentId:p.id,index:idx,oldParentId:oldParent.id,oldIndex:n.index}); return deepClone(n); },
    async remove(id){ const tree=getTree(); const p=parentOfIn(tree,id); if(!p)throw new Error('Bookmark not found'); const i=p.children.findIndex(n=>String(n.id)===String(id)); const [n]=p.children.splice(i,1); reindex(p); saveTree(tree); bookmarks.onRemoved.emit(String(id),{parentId:p.id,index:i,node:deepClone(n)}); },
    async removeTree(id){ return this.remove(id); }
  };
  const storageChanged=event();
  const storageLocal={
    async get(keys){ const s=parseStore(); const data=s.appStorage||{}; if(keys==null)return {...data}; if(typeof keys==='string')return {[keys]:data[keys]}; if(Array.isArray(keys))return Object.fromEntries(keys.filter(k=>k in data).map(k=>[k,data[k]])); if(typeof keys==='object')return {...keys,...Object.fromEntries(Object.keys(keys).filter(k=>k in data).map(k=>[k,data[k]]))}; return {}; },
    async set(items){ const s=parseStore(), data=s.appStorage||{}; const changes={}; for(const [k,v] of Object.entries(items)){const old=data[k];data[k]=v;changes[k]={oldValue:old,newValue:v};} s.appStorage=data;writeStore(s);storageChanged.emit(changes,'local'); },
    async remove(keys){const s=parseStore(),data=s.appStorage||{},changes={};for(const k of (Array.isArray(keys)?keys:[keys])){if(k in data){changes[k]={oldValue:data[k]};delete data[k]}}s.appStorage=data;writeStore(s);storageChanged.emit(changes,'local');},
    async clear(){const s=parseStore(),data=s.appStorage||{},changes={};for(const [k,v] of Object.entries(data))changes[k]={oldValue:v};s.appStorage={};writeStore(s);storageChanged.emit(changes,'local');}
  };
  window.addEventListener('storage',e=>{ if(e.key!==KEY)return; let before={},after={}; try{before=JSON.parse(e.oldValue||'{}').appStorage||{};after=JSON.parse(e.newValue||'{}').appStorage||{};}catch{} const changes={}; for(const k of new Set([...Object.keys(before),...Object.keys(after)])){if(JSON.stringify(before[k])!==JSON.stringify(after[k]))changes[k]={oldValue:before[k],newValue:after[k]};} if(Object.keys(changes).length)storageChanged.emit(changes,'local'); });
  function openSearch(text, disposition){ const q=String(text||'').trim(); if(!q)return; const url='https://www.google.com/search?q='+encodeURIComponent(q); if(disposition==='CURRENT_TAB')location.href=url;else window.open(url,'_blank','noopener'); }
  const chromeCompat={
    i18n:{getMessage(key,subs=[]){let value=MESSAGES[key]; if(value==null)return ''; if(typeof value!=='string')value=String(value); (Array.isArray(subs)?subs:[subs]).forEach((s,i)=>{value=value.replaceAll('$'+(i+1),String(s))}); return value;},getUILanguage(){return navigator.language||'en';}},
    runtime:{getManifest(){return {version:'1.2.3',name:'Cadran Web'};},getURL(path){return new URL(String(path||'').replace(/^\//,''),document.baseURI).href;}},
    storage:{local:storageLocal,onChanged:storageChanged},
    bookmarks,
    search:{query({text,disposition}){openSearch(text,disposition);return Promise.resolve();}},
    tabs:{async create({url,active=true}={}){const target=url||location.href;if(active)location.href=target;else window.open(target,'_blank','noopener');return {id:Date.now(),url:target};},async update(idOrProps,props){const opts=typeof idOrProps==='object'?idOrProps:props||{};if(opts.url)location.href=opts.url;return {id:0,url:location.href};},async group(){throw new Error('Tab groups are not available on the web');}},
    windows:{async create({url,incognito}={}){if(incognito)throw new Error('Private windows are controlled by the browser');const urls=Array.isArray(url)?url:[url||location.href];urls.forEach(u=>window.open(u,'_blank','noopener'));return {id:Date.now()};}},
    permissions:{onAdded:event(),onRemoved:event(),async contains(){return false;},async request(){return false;},async remove(){return true;}},
    tabGroups:undefined, sessions:undefined, topSites:undefined,
    action:{onClicked:event()}
  };
  window.chrome=chromeCompat;
})();
