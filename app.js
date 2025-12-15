document.addEventListener('DOMContentLoaded', () => {

  firebase.auth().onAuthStateChanged(user => {
    if (!user) return location.href = 'login.html';
    start(user.uid);
  });

  async function start(uid) {

    const DATASETS = {
      frases: 'data/frases.json',
      palavras: 'data/palavras.json'
    };

    const levels = ['A1','A2','B1','B2','C1'];

    let datasetKey = await loadUserData(uid,'dataset') || 'frases';
    let examMode = await loadUserData(uid,'examMode') || false;

    let stats = await loadUserData(uid,'stats') || {
      level:'A1', hits:0, errors:0, weights:{}
    };

    let data=[], current=null, voice=null;

    const $ = id => document.getElementById(id);

    function loadVoice(){
      const v = speechSynthesis.getVoices();
      voice = v.find(x=>x.lang.startsWith('es')) || null;
    }
    speechSynthesis.onvoiceschanged = loadVoice; loadVoice();

    function speak(t){
      if(!t) return;
      speechSynthesis.cancel();
      const u=new SpeechSynthesisUtterance(t);
      u.lang='es-ES'; if(voice) u.voice=voice;
      speechSynthesis.speak(u);
    }

    async function loadData(){
      data = await (await fetch(DATASETS[datasetKey])).json();
      next();
    }

    function pick(list){
      const p=[];
      list.forEach(i=>{
        const w=stats.weights[i.ESP]||1;
        for(let k=0;k<w;k++) p.push(i);
      });
      return p[Math.floor(Math.random()*p.length)];
    }

    function next(){
      const pool=data.filter(d=>d.CEFR===stats.level);
      current=pick(pool.length?pool:data);
      $('englishText').textContent=examMode?'🎧 Ouça e repita':current.ESP;
      $('translationText').textContent=current.PTBR;
      $('translationText').classList.add('hidden');
      if(examMode) speak(current.ESP);
    }

    function listen(){
      const SR=window.webkitSpeechRecognition||window.SpeechRecognition;
      if(!SR) return $('feedback').textContent='STT indisponível';
      const r=new SR(); r.lang='es-ES';
      r.onresult=e=>{
        const ok=e.results[0][0].transcript;
        const score=ok.length/current.ESP.length;
        score>.7?stats.hits++:stats.errors++;
        save(); next();
      };
      r.start();
    }

    async function save(){
      await saveUserData(uid,'stats',stats);
      await saveUserData(uid,'dataset',datasetKey);
      await saveUserData(uid,'examMode',examMode);
      $('hits').textContent=stats.hits;
      $('errors').textContent=stats.errors;
      $('levelText').textContent='Nível '+stats.level;
    }

    $('playBtn').onclick=()=>speak(current.ESP);
    $('micBtn').onclick=listen;
    $('nextBtn').onclick=next;
    $('translateBtn').onclick=()=>$('translationText').classList.toggle('hidden');
    $('toggleDataset').onclick=()=>{datasetKey=datasetKey==='frases'?'palavras':'frases';save();loadData();};
    $('examModeBtn').onclick=()=>{examMode=!examMode;save();next();};
    $('resetBtn').onclick=()=>{stats={level:'A1',hits:0,errors:0,weights:{}};save();next();};
    $('logoutBtn').onclick=()=>logout();

    await loadData(); save();
  }
});
