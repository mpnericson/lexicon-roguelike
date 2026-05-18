// =====================================================================
// GAME STATE — global state, lifecycle, modals, utilities
// =====================================================================
var S={};
var DICT=null;
var activeDrag=null;
var _hl=-1;
var viewingBoard=false;
var shopPool={sq:[],tileCards:[],tilePack:null};

function buildBag(){
  var bag=[];var ks=Object.keys(DIST);
  for(var i=0;i<ks.length;i++)for(var j=0;j<DIST[ks[i]];j++)bag.push({letter:ks[i],isBlank:false,id:uid()});
  bag.push({letter:'_',isBlank:true,id:uid()});bag.push({letter:'_',isBlank:true,id:uid()});
  return shuffle(bag);
}

function startGame(seed){
  closeAllModals();
  var s=(seed!==undefined&&seed!==null)?((parseInt(seed)>>>0)||1):Math.floor(Math.random()*900000)+100000;
  _rngSeed(s);
  S={bag:buildBag(),hand:[],board:Array(B*B).fill(null),bt:Array(B*B).fill(null),
     ai:0,bi:0,score:0,gold:4,plays:4,disc:3,wtb:0,ts:0,placed:[],discPressure:0,censorApplied:false,alchemistUsed:false,devMode:false,
     phase:'play',pendingSquares:[],sqHand:[],sqStaged:{},seed:s};
  shopPool={sq:[],tileCards:[],tilePack:null};activeDrag=null;
  document.getElementById('shop-screen').style.display='none';
  document.getElementById('play-controls').style.display='flex';
  document.getElementById('placing-controls').style.display='none';
  HP.x=[];HP.vx=[];HP.tiles=[];
  drawFull();renderAll();
}

function drawFull(){
  var n=7-S.hand.length;
  for(var i=0;i<n&&S.bag.length>0;i++){var t=S.bag.pop();S.hand.push({letter:t.letter,isBlank:t.isBlank,id:t.id,blankAs:null,sel:false,onBoard:false,variant:t.variant||null,blueBonus:t.blueBonus||0});}
  if(!S.censorApplied){
    var hasCensor=false;for(var i=0;i<S.placed.length;i++)if(S.placed[i].id==='censor'){hasCensor=true;break;}
    if(hasCensor&&S.hand.length>1){
      S.censorApplied=true;
      var freeHand=S.hand.filter(function(t){return!t.onBoard;});
      if(freeHand.length>0){
        var minSc=Infinity,minTile=null;
        for(var i=0;i<freeHand.length;i++){var sc=freeHand[i].isBlank?0:(LS[freeHand[i].letter]||0);if(sc<minSc){minSc=sc;minTile=freeHand[i];}}
        if(minTile){S.hand=S.hand.filter(function(t){return t!==minTile;});toast('Censor discards your lowest tile!');}
      }
    }
  }
}

function cb(){return ANTES[S.ai][S.bi];}
function tgt(){return cb()[2];}

function blindComplete(){
  var reward=2+S.bi*2+(S.ai*2);
  var playsBonus=S.plays>0?S.plays:0;
  S.gold+=reward+playsBonus;
  document.getElementById('round-title').textContent=cb()[0]+' complete!';
  var msg='You scored '+S.score.toLocaleString()+', beating '+tgt().toLocaleString()+'.';
  if(playsBonus>0)msg+=' +$'+playsBonus+' efficiency bonus!';
  document.getElementById('round-msg').textContent=msg;
  document.getElementById('round-reward').textContent='+$'+(reward+playsBonus)+' gold';
  document.getElementById('round-modal').style.display='flex';
}

function advanceBlind(){
  document.getElementById('round-modal').style.display='none';S.bi++;
  var newAnte=S.bi>=3;
  if(newAnte){S.ai++;S.bi=0;if(S.ai>=ANTES.length){showWin();return;}}
  animBoardToShop(function(){
    if(newAnte){clearBoardLetters();S.bag=buildBag();toast('New ante — letters cleared, stickers kept!');}
    S.score=0;S.plays=4;S.disc=3;S.wtb=0;S.ts=0;S.discPressure=0;S.censorApplied=false;S.alchemistUsed=false;
    S.pendingSquares=[];S.sqHand=[];S.sqStaged={};
    recallAll();HP.x=[];HP.vx=[];drawFull();renderAll();shopPool={sq:[],tileCards:[],tilePack:null};enterShopPhase();
  });
}

function showGO(msg){document.getElementById('gameover-msg').textContent=msg;document.getElementById('gameover-modal').style.display='flex';}
function showWin(){document.getElementById('win-modal').style.display='flex';}

function closeAllModals(){
  ['pack-modal','sq-modal','bag-modal','blank-modal','round-modal','gameover-modal','win-modal','hammer-modal','forge-modal','board-preview-modal','alchemist-modal','collection-modal'].forEach(function(id){var el=document.getElementById(id);if(el)el.style.display='none';});
  document.getElementById('shop-screen').style.display='none';
}

function toast(msg){var el=document.getElementById('toast');el.textContent=msg;el.style.display='block';clearTimeout(toast._t);toast._t=setTimeout(function(){el.style.display='none';},2500);}

function openBagModal(){
  document.getElementById('bag-mc').textContent=S.bag.length+' tiles remaining.';
  var cont=document.getElementById('bag-counts');cont.innerHTML='';
  cont.style.cssText='display:flex;flex-direction:column;gap:12px';

  var variants=S.bag.filter(function(t){return t.variant;});
  var plains=S.bag.filter(function(t){return !t.variant;});

  function secLabel(text){
    var l=document.createElement('div');
    l.style.cssText='font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#8880a8;margin-bottom:4px';
    l.textContent=text;return l;
  }
  function tileEl(letter,isBlank,sc,variant){
    var badge=variant==='gold'?'<span class="vbadge vbadge-gold">$</span>':
              variant==='blue'?'<span class="vbadge vbadge-blue">+'+(LS[letter]||0)+'</span>':
              variant==='red'?'<span class="vbadge vbadge-red">×2</span>':'';
    var el=document.createElement('div');
    el.className='tile'+(isBlank?' blank-t':'')+(variant?' var-'+variant:'');
    el.style.cssText='width:44px;height:52px;position:relative;flex-shrink:0;cursor:default';
    el.innerHTML='<span class="tl" style="font-size:18px">'+letter+'</span><span class="ts" style="font-size:7px">'+sc+'</span>'+badge;
    return el;
  }

  if(variants.length>0){
    var vsec=document.createElement('div');
    vsec.appendChild(secLabel('Special Tiles'));
    var vrow=document.createElement('div');vrow.style.cssText='display:flex;flex-wrap:wrap;gap:5px';
    for(var i=0;i<variants.length;i++){
      var t=variants[i];
      vrow.appendChild(tileEl(t.isBlank?'':t.letter,t.isBlank,t.isBlank?0:(LS[t.letter]||0),t.variant));
    }
    vsec.appendChild(vrow);cont.appendChild(vsec);
  }

  if(plains.length>0){
    var psec=document.createElement('div');
    psec.appendChild(secLabel('Tiles'));
    var counts={};
    for(var i=0;i<plains.length;i++){var l=plains[i].isBlank?'_':plains[i].letter;counts[l]=(counts[l]||0)+1;}
    var prow=document.createElement('div');prow.style.cssText='display:flex;flex-wrap:wrap;gap:5px';
    var ks=Object.keys(counts).sort();
    for(var i=0;i<ks.length;i++){
      var l=ks[i],cnt=counts[l],isBlank=(l==='_');
      var el=tileEl(isBlank?'':l,isBlank,isBlank?0:(LS[l]||0),null);
      if(cnt>1){
        var ct=document.createElement('span');
        ct.style.cssText='position:absolute;top:1px;left:3px;font-size:8px;font-weight:bold;color:#2a1f0e;line-height:1';
        ct.textContent='×'+cnt;el.appendChild(ct);
      }
      prow.appendChild(el);
    }
    psec.appendChild(prow);cont.appendChild(psec);
  }

  document.getElementById('bag-modal').style.display='flex';
}

function openBlankChooser(hi,cb2){
  var grid=document.getElementById('blank-grid');grid.innerHTML='';
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach(function(l){
    var btn=document.createElement('button');btn.className='blank-btn';btn.textContent=l;
    btn.onclick=function(){S.hand[hi].blankAs=l;document.getElementById('blank-modal').style.display='none';if(cb2)cb2();renderHand();};
    grid.appendChild(btn);
  });
  document.getElementById('blank-modal').style.display='flex';
}
