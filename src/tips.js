// ── TIPS ── hover explanations for UI elements, toggled from the menu.
// Delegated listeners on document; TIP_DEFS is checked top-to-bottom, first
// selector that matches (via closest) wins. Elements with their own tooltips
// (stamps, shop packs, stickered squares) are skipped so the two never stack.

var TIPS_ON=false;
try{TIPS_ON=localStorage.getItem('lexicon_tips')==='1';}catch(e){}

var TIP_DEFS=[
  // Left panel — stat panel
  {sel:'#stat-word-score-box',name:'Letter Total',text:'The combined value of every letter in the word you\'re building, after tile bonuses and sticker effects. Multiplied by the red number to get the word\'s score.'},
  {sel:'#stat-progress-box',name:'Multiplier',text:'Your word multiplier. It grows from premium squares, stamps, and playing more than 3 tiles. Word score = letters × multiplier.'},
  {sel:'#stat-letters-box',name:'Word Score',text:'How many points the tiles you\'ve placed are currently worth (letters × multiplier).'},
  {sel:'#stat-mult-box',name:'Round Progress',text:'Points scored this round versus the target. Reach the target to beat the blind and head to the shop.'},
  {sel:'#stat-gold-box',name:'Gold',text:'Your money. Earn it by beating blinds, completing bounties, and keeping gold tiles on the board. Spend it in the shop on stickers, stamps and packs.'},
  {sel:'#stat-plays-box',name:'Hands',text:'How many more words you can play this round. If you run out before reaching the target, the run is over.'},
  {sel:'#stat-disc-box',name:'Discards',text:'How many times you can discard this round. Select tiles in your hand, then press Discard to swap them for new ones from the bag.'},
  {sel:'#stat-rounds-box',name:'Constraint',text:'The special rule applied to this board\'s final round. Plan your tiles and purchases around it.'},
  {sel:'#constraint-banner',name:'Constraint',text:'This round has a special rule — your plays must satisfy it to count.'},
  {sel:'#score-bar-wrap',name:'Progress Bar',text:'Fills as you score. When it reaches the top you\'ve hit the round target.'},
  {sel:'#progress-tracker-sprite',name:'Run Progress',text:'Tracks how far you are through the run — 8 boards of 3 rounds each, then endless mode loops back around with ever-steeper targets. The marker advances each time you beat a blind.'},
  {sel:'.bounty-scroll',name:'Bounty Scroll',text:'Click to unfurl. Play any word listed on the scroll to complete the bounty and claim its reward. Bounties carry over between rounds.'},

  // Center — stamps, board, hand
  {sel:'.stamp-tile',skip:true}, // has its own tooltip
  {sel:'#stamp-bar',name:'Stamp Bar',text:'Your stamps — passive items that trigger while scoring. They fire left to right, so their order matters. Drag to rearrange, hover one for details.'},
  {sel:'.board-tile',name:'Placed Tile',text:'A tile on the board. Tiles placed this turn can be dragged back to your hand; tiles from earlier plays are locked in.'},
  {sel:'.sq',name:'Board Square',text:'Drag tiles here to spell words. Words must read left-to-right or top-to-bottom, connect to existing tiles, and appear in the dictionary.'},
  {sel:'.sq-hand-item',name:'Sticker',text:'A sticker waiting to be placed. Drag it onto a board square, then press Confirm.'},
  {sel:'.hand-tile',name:'Hand Tile',text:'Drag it onto the board to build a word. The small number is its point value. Click to select it for discarding.'},
  {sel:'#hand-area',name:'Your Hand',text:'The tiles you can play this turn. Drag them onto the board, or select some and discard to draw replacements.'},
  {sel:'#shuffle-btn',name:'Shuffle',text:'Rearranges the tiles in your hand.'},

  // Right panel — buttons
  {sel:'#focus-btn-wrap',name:'Focus Mode',text:'Hides the UI so you can see the whole board. Click again to come back.'},
  {sel:'#menu-wrap',name:'Menu',text:'Collection, dictionary, achievements, tutorial, and options for starting a new run.'},
  {sel:'#bag-btn',name:'Tile Bag',text:'Click to see every tile still in the bag, so you know what you can draw.'},
  {sel:'#bag-count',name:'Bag Count',text:'How many tiles are left in the bag.'},
  {sel:'#pd-play-hit',name:'Play',text:'Submits the tiles you\'ve placed. Every word formed must be valid. Costs one hand.'},
  {sel:'#pd-disc-hit',name:'Discard',text:'Returns the selected hand tiles to the bag and draws replacements. Costs one discard.'},
  {sel:'#place-stickers-btn',name:'Place Stickers',text:'You have stickers in your inventory — click to place them on board squares.'},
  {sel:'#placing-controls .btn-green',name:'Confirm',text:'Locks in your sticker placement.'},
  {sel:'#solver-btn',name:'Solver',text:'Dev tool: finds and ranks the best possible plays for your current hand.'},
  {sel:'.dev-tab',name:'Dev Palette',text:'Dev tool: draw specific tiles, blanks or stickers.'},

  // Shop
  {sel:'.shop-pack-box',skip:true}, // has its own tooltip
  {sel:'#shop-gold-display',name:'Gold',text:'What you have to spend. Unspent gold carries over to the next shop.'},
  {sel:'#shop-slot-price',name:'Spin Cost',text:'What one pull of the slot machine costs.'},
  {sel:'#shop-handle-hit',name:'Slot Machine',text:'Pull the handle down to spin. The reels pay out stickers, stamps or other prizes depending on the armed mode.'},
  {sel:'#shop-bag-btn',name:'Tile Bag',text:'Open your bag to enchant, destroy, or duplicate a tile — $2 each, once per shop.'},
  {sel:'#shop-bounty-list',name:'Bounties',text:'Buy a bounty scroll to take on its word list. Play any listed word during a round to claim the reward.'},
  {sel:'#shop-queue-bar',name:'Sticker Inventory',text:'Stickers you\'ve bought but not yet placed. Use the Place Stickers button during play to put them on the board.'},
  {sel:'#shop-stamp-bar',name:'Your Stamps',text:'The stamps you own. Their effects fire left to right during scoring — drag to rearrange, or hover one to sell it.'},
  {sel:'.shop-top-btn.green',name:'Leave Shop',text:'Done shopping — head to the next round.'},
  {sel:'.shop-top-btn',name:'Board Preview',text:'Peek at your board and stamps without leaving the shop.'}
];

var _tipsPopEl=null,_tipsCur=null;

function _tipsPop(){
  if(_tipsPopEl)return _tipsPopEl;
  var d=document.createElement('div');
  d.id='ui-tip-pop';
  d.style.cssText='display:none;position:fixed;z-index:19000;pointer-events:none;max-width:280px;'
    +'background:#14142e;border:1px solid #6a6aa0;border-radius:8px;padding:8px 11px;'
    +'box-shadow:0 6px 20px rgba(0,0,0,.6);font-family:\'Jersey 10\',Georgia,serif;line-height:1.25';
  d.innerHTML='<div id="ui-tip-name" style="font-size:24px;color:#f0e080;margin-bottom:2px"></div>'
    +'<div id="ui-tip-text" style="font-size:20px;color:#d8d8e8"></div>';
  document.body.appendChild(d);
  _tipsPopEl=d;
  return d;
}

function _tipsHide(){
  _tipsCur=null;
  if(_tipsPopEl)_tipsPopEl.style.display='none';
}

function _tipsMove(x,y){
  var d=_tipsPopEl;if(!d||d.style.display==='none')return;
  var r=d.getBoundingClientRect();
  var px=x+16,py=y+18;
  if(px+r.width>window.innerWidth-8)px=x-r.width-12;
  if(py+r.height>window.innerHeight-8)py=y-r.height-12;
  d.style.left=Math.max(4,px)+'px';
  d.style.top=Math.max(4,py)+'px';
}

function _tipsMatch(el){
  if(!el||!el.closest)return null;
  for(var i=0;i<TIP_DEFS.length;i++){
    var m=el.closest(TIP_DEFS[i].sel);
    if(m)return{def:TIP_DEFS[i],el:m};
  }
  return null;
}

function _tipsOnOver(e){
  if(!TIPS_ON)return;
  if(typeof activeDrag!=='undefined'&&activeDrag)return _tipsHide();
  if(typeof TUT!=='undefined'&&TUT.active)return;
  var m=_tipsMatch(e.target);
  if(!m)return _tipsHide();
  if(m.def.skip)return _tipsHide();
  // Stickered empty squares show their own sticker tooltip — stay out of the way
  if(m.def.sel==='.sq'){
    var idx=parseInt(m.el.dataset.sqIdx);
    if(!isNaN(idx)&&S.board&&S.board[idx]&&!S.bt[idx])return _tipsHide();
  }
  if(m.el===_tipsCur)return;
  _tipsCur=m.el;
  var d=_tipsPop();
  d.querySelector('#ui-tip-name').textContent=m.def.name;
  d.querySelector('#ui-tip-text').textContent=m.def.text;
  d.style.display='block';
  _tipsMove(e.clientX,e.clientY);
}

function _tipsUpdateMenuLabel(){
  var el=document.getElementById('tips-item');if(!el)return;
  el.textContent='Tips: '+(TIPS_ON?'ON':'Off');
  el.style.color=TIPS_ON?'#80f080':'';
}

function toggleTips(){
  TIPS_ON=!TIPS_ON;
  try{localStorage.setItem('lexicon_tips',TIPS_ON?'1':'0');}catch(e){}
  _tipsUpdateMenuLabel();
  if(!TIPS_ON)_tipsHide();
  document.getElementById('menu-dropdown').style.display='none';
  toast(TIPS_ON?'Tips ON — hover anything for an explanation.':'Tips OFF');
}

document.addEventListener('mouseover',_tipsOnOver);
document.addEventListener('mousemove',function(e){if(_tipsCur)_tipsMove(e.clientX,e.clientY);});
document.addEventListener('mouseout',function(e){
  if(_tipsCur&&!(_tipsMatch(e.relatedTarget)||{}).el)_tipsHide();
});
document.addEventListener('mousedown',_tipsHide,true);
document.addEventListener('DOMContentLoaded',_tipsUpdateMenuLabel);
