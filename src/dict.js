// =====================================================================
// DICTIONARY — load and validate words
// =====================================================================
function parseDict(txt){
  return new Set(txt.split('\n').map(function(w){return w.trim().toUpperCase();}).filter(function(w){return w.length>0;}));
}

async function loadDict(){
  try{
    var r=await fetch(new URL('dictionary.txt',location.href));
    if(r.ok){DICT=parseDict(await r.text());console.log('Dict: '+DICT.size+' words');return;}
  }catch(e){}
  try{
    if(typeof require!=='undefined'){
      var fs=require('fs'),path=require('path');
      var txt=fs.readFileSync(path.join(__dirname,'dictionary.txt'),'utf8');
      DICT=parseDict(txt);console.log('Dict: '+DICT.size+' words');return;
    }
  }catch(e){}
  console.log('No local dict, using API');DICT=null;
}

async function validWord(word){
  if(word.length<2)return false;
  if(DICT&&DICT.size>0)return DICT.has(word.toUpperCase());
  try{var r=await fetch('https://api.dictionaryapi.dev/api/v2/entries/en/'+word.toLowerCase());return r.ok;}catch(e){return true;}
}
