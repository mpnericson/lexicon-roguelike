// =====================================================================
// DATA — sticker definitions, tile distribution, game constants
// =====================================================================
function isPalindrome(w){return w.length>1&&w===w.split('').reverse().join('');}
function adjSq(a,b){var ar=Math.floor(a/B),ac=a%B,br=Math.floor(b/B),bc=b%B;return Math.abs(ar-br)<=1&&Math.abs(ac-bc)<=1&&a!==b;}
function uid(){return Math.random().toString(36).slice(2,8);}
// Seeded PRNG — Mulberry32. _rngSeed initialises; _rng() returns [0,1).
var _rngState=0;
function _rngSeed(s){_rngState=s>>>0;}
function _rng(){_rngState=(_rngState+0x6D2B79F5)|0;var t=Math.imul(_rngState^_rngState>>>15,1|_rngState);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}
function shuffle(a){var b=a.slice();for(var i=b.length-1;i>0;i--){var j=Math.floor(_rng()*(i+1));var t=b[i];b[i]=b[j];b[j]=t;}return b;}
function sqd(id){for(var i=0;i<SQ.length;i++)if(SQ[i].id===id)return SQ[i];return null;}
function rcl(i){return String.fromCharCode(65+i%B)+(Math.floor(i/B)+1);}

var B=15;
var LS={A:1,B:3,C:3,D:2,E:1,F:4,G:2,H:4,I:1,J:8,K:5,L:1,M:3,N:1,O:1,P:3,Q:10,R:1,S:1,T:1,U:1,V:4,W:4,X:8,Y:4,Z:10};
var DIST={A:9,B:2,C:2,D:4,E:12,F:2,G:3,H:2,I:9,J:1,K:1,L:4,M:2,N:6,O:8,P:2,Q:1,R:6,S:4,T:6,U:4,V:2,W:2,X:1,Y:2,Z:1};
var ANTES=[
  [['Small Letter','A warm-up.',40],['Big Letter','The ink flows.',80],['The Anagram','Use 5+ tiles.',130,'boss_long']],
  [['Small Word','Finding your voice.',200],['Big Word','Words carry weight.',350],['The Palindrome','Play a palindrome.',550,'boss_pal']],
  [['Small Verse','Prose takes shape.',800],['Big Verse','The manuscript calls.',1300],['The Final Glyph','A 5+ pt tile required.',2000,'boss_hv']],
];

var SQ=[
  {id:'dl',name:'Double Letter',desc:'Letter scores ×2.',rarity:'common',cost:2,bg:'#14305a',fg:'#6aaaff',icon:'DL',type:'board',bm:'dl'},
  {id:'tl',name:'Triple Letter',desc:'Letter scores ×3.',rarity:'common',cost:3,bg:'#0d2050',fg:'#4488ff',icon:'TL',type:'board',bm:'tl'},
  {id:'dw',name:'Double Word',desc:'Word ×2 when new tile lands here.',rarity:'uncommon',cost:4,bg:'#6a1818',fg:'#ff8080',icon:'DW',type:'board',bm:'dw'},
  {id:'tw',name:'Triple Word',desc:'Word ×3 when new tile lands here.',rarity:'rare',cost:6,bg:'#500808',fg:'#ff6060',icon:'TW',type:'board',bm:'tw'},
  {id:'echo',name:'Echo',desc:'Letter here scores twice.',rarity:'common',cost:4,bg:'#1a3a5a',fg:'#80c0ff',icon:'EC',type:'local',apply:function(tc,t,w,st){return{cb:tc,mb:0};}},
  {id:'gilded',name:'Gilded',desc:'Letter here earns +$1.',rarity:'common',cost:4,bg:'#3a2a00',fg:'#f0c060',icon:'GL',type:'local',apply:function(tc,t,w,st){st.gold=(st.gold||0)+1;return{cb:0,mb:0};}},
  {id:'void',name:'Void',desc:'Letter scores 0 letter score but +2 mult.',rarity:'uncommon',cost:5,bg:'#1a0a2a',fg:'#c080ff',icon:'VO',type:'local',apply:function(tc,t,w,st){return{cb:-tc,mb:2};}},
  {id:'prism',name:'Prism',desc:'Letter counts as vowel and consonant.',rarity:'uncommon',cost:5,bg:'#0a2a2a',fg:'#60e0e0',icon:'PR',type:'local',apply:function(tc,t,w,st){return{cb:0,mb:0};}},
  {id:'anchor',name:'Anchor',desc:'Word 5+ letters through here: +3 mult.',rarity:'uncommon',cost:5,bg:'#1a2a0a',fg:'#80c040',icon:'AN',type:'local',apply:function(tc,t,w,st){if(w.length>=5)st.am=(st.am||0)+3;return{cb:0,mb:0};}},
  {id:'inkwell',name:'Inkwell',desc:'+$1 every word played.',rarity:'common',cost:4,bg:'#0a1a0a',fg:'#60d060',icon:'IK',onPost:function(w,st){st.gold=(st.gold||0)+1;}},
  {id:'babel',name:'Babel',desc:'6+ letter words: +2 mult.',rarity:'uncommon',cost:5,bg:'#2a1a00',fg:'#e0a040',icon:'BA',onPost:function(w,st){if(w.length>=6)st.gm=(st.gm||0)+2;}},
  {id:'rune',name:'Rune',desc:'Blank tiles score as highest-value letter.',rarity:'uncommon',cost:5,bg:'#2a0a2a',fg:'#e060e0',icon:'RU',priority:3,onPre:function(w,st){st.rune=true;}},
  {id:'quill',name:'Quill',desc:'First word each blind: ×2 mult.',rarity:'rare',cost:7,bg:'#1a1a0a',fg:'#e0e060',icon:'QU',onPre:function(w,st){if((st.wtb||0)===0)st.quill=true;}},
  {id:'tome',name:'Tome',desc:'Every 3 words this blind: +1 permanent mult.',rarity:'rare',cost:8,bg:'#1a0a0a',fg:'#e08060',icon:'TO',onPost:function(w,st){if(((st.wtb||0)+1)%3===0){st.ts=(st.ts||0)+1;}}},
  {id:'magnet',name:'Magnet',desc:'All tiles adjacent to this sticker score double letter score.',rarity:'uncommon',cost:6,bg:'#2a0a3a',fg:'#c080ff',icon:'MG',type:'local',apply:function(tc,t,w,st){return{cb:0,mb:0};}},
  {id:'palindrome_engine',name:'Palindrome Engine',desc:'If the word is a palindrome, double the final score.',rarity:'rare',cost:8,bg:'#0a2a2a',fg:'#60ffff',icon:'PE',priority:-10,onPre:function(w,st){if(isPalindrome(w))st.palindrome=true;},onFinal:function(w,st,r){if(st.palindrome)return{total:r.total*2,scoreDouble:true};}},
  {id:'vowel_shrine',name:'Vowel Shrine',desc:'Vowels placed here score ×4 letter score.',rarity:'uncommon',cost:5,bg:'#2a2800',fg:'#f0f060',icon:'VS',type:'local',apply:function(tc,t,w,st){if('AEIOU'.indexOf(t.letter)>=0)return{cb:tc*3,mb:0};return{cb:0,mb:0};}},
  {id:'consonant_shrine',name:'Consonant Shrine',desc:'Consonants placed here score ×4 letter score.',rarity:'uncommon',cost:5,bg:'#0a1a2a',fg:'#60a0e0',icon:'CS',type:'local',apply:function(tc,t,w,st){if(t.letter&&'AEIOU?'.indexOf(t.letter)<0)return{cb:tc*3,mb:0};return{cb:0,mb:0};}},
  {id:'crossroads',name:'Crossroads',desc:'Each cross-word formed this turn also triggers Double Word.',rarity:'rare',cost:8,bg:'#2a1800',fg:'#f0c040',icon:'CR',type:'local',apply:function(tc,t,w,st){st.crossroads=true;return{cb:0,mb:0};}},
  {id:'gilded_inkwell',name:'Gilded Inkwell',desc:'+$2 per word; only +$1 for words under 4 letters.',rarity:'rare',cost:8,bg:'#1a2a0a',fg:'#80e060',icon:'GI',onPost:function(w,st){st.gold=(st.gold||0)+(w.length<4?1:2);}},
  {id:'lexicon_s_eye',name:"Lexicon's Eye",desc:'Q, X, Z, J score double letter score this turn.',rarity:'rare',cost:7,bg:'#0a2a1a',fg:'#60e0a0',icon:'LE',priority:2,onPre:function(w,st){st.lxeye=true;}},
  {id:'midas_touch',name:'Midas Touch',desc:'The highest-value tile earns triple letter score.',rarity:'rare',cost:9,bg:'#3a2a00',fg:'#f0d040',icon:'MD',onPre:function(w,st){st.midas=true;}},
  {id:'bounty',name:'Bounty',desc:'+10 letter score per letter beyond 5.',rarity:'common',cost:4,bg:'#0a2a0a',fg:'#60c060',icon:'BN',onPost:function(w,st){if(w.length>5)st.gc=(st.gc||0)+(w.length-5)*10;}},
  {id:'jackpot',name:'Jackpot',desc:'5% chance the tile placed here scores ×10.',rarity:'rare',cost:7,bg:'#2a0a2a',fg:'#f060f0',icon:'JP',type:'local',apply:function(tc,t,w,st){if(_rng()<0.05)return{cb:tc*9,mb:0};return{cb:0,mb:0};}},
  {id:'fossil',name:'Fossil',desc:'Tile placed here is locked (no recall) but scores ×3 on all future words.',rarity:'rare',cost:8,bg:'#2a1a0a',fg:'#c08040',icon:'FO',type:'local',applyAlways:true,apply:function(tc,t,w,st){if(!t.isNew)return{cb:tc*2,mb:0};return{cb:0,mb:0};}},
  {id:'lucky_blank',name:'Lucky Blank',desc:'Each blank tile in the word grants +3 multiplier.',rarity:'uncommon',cost:5,bg:'#1a1a2a',fg:'#a0a0f0',icon:'LB',onPre:function(w,st){st.lucky_blank=true;}},
  {id:'scholar',name:'Scholar',desc:'Words made only of 1-point tiles gain +6 multiplier.',rarity:'uncommon',cost:5,bg:'#0a1a2a',fg:'#80c0ff',icon:'SH',onPre:function(w,st){st.scholar=true;}},
  {id:'aristocrat',name:'Aristocrat',desc:'Words with an 8+ point tile gain +5 multiplier.',rarity:'uncommon',cost:5,bg:'#2a0a1a',fg:'#f080c0',icon:'AC',onPre:function(w,st){st.aristocrat=true;}},
  {id:'the_commons',name:'The Commons',desc:'Each 1-point tile in the word scores +3 bonus letter score.',rarity:'common',cost:4,bg:'#181818',fg:'#c0c0c0',icon:'TC',priority:1,onPre:function(w,st){st.the_commons=true;}},
  {id:'pressure_cooker',name:'Pressure Cooker',desc:'Each discard this blind adds +1 mult to the next word.',rarity:'uncommon',cost:6,bg:'#2a0a0a',fg:'#f08060',icon:'PC',onPost:function(w,st){st.gm=(st.gm||0)+(S.discPressure||0);}},
  {id:'tectonic',name:'Tectonic',desc:'7-tile bingo earns +$3 gold in addition to the +50 letter score bonus.',rarity:'uncommon',cost:5,bg:'#1a1a0a',fg:'#d0c060',icon:'TN',onPost:function(w,st){st.tectonic=true;}},
  {id:'censor',name:'Censor',desc:'Removes your lowest-value tile at blind start; remaining tiles each score +2 letter score.',rarity:'uncommon',cost:6,bg:'#1a0a0a',fg:'#e06060',icon:'CN',priority:1,onPre:function(w,st){st.censor=true;}},
  {id:'alchemist',name:'Alchemist',desc:'Once per blind: convert a hand tile into a blank that retains its letter score.',rarity:'rare',cost:10,bg:'#0a1a0a',fg:'#80f080',icon:'AL'},
];

var PACKS=[
  {id:'std',name:'Standard Pack',desc:'3 random stickers — pick 1.',cost:5,n:3,pool:['dl','tl','dw','tw','echo','gilded','inkwell'],w:{common:5,uncommon:2,rare:0.5}},
  {id:'prm',name:'Premium Pack',desc:'3 rarer stickers — pick 1.',cost:8,n:3,pool:['tl','dw','tw','void','prism','anchor','babel','rune','quill','tome'],w:{common:1,uncommon:3,rare:2}},
  {id:'eco',name:'Economy Pack',desc:'4 common stickers — pick 1.',cost:4,n:4,pool:['dl','tl','echo','gilded','inkwell'],w:{common:1,uncommon:0,rare:0}},
];
