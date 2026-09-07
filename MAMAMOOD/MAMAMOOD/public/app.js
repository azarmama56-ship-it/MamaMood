let current=0, totalScore=0, selfHarmPositive=false;
let attemptId=null;
let saveConfirmed=false;
let savePromise=null;
const answersChosen=[];

const QUESTIONS=[
  {q:"Я могла смеяться и замечать забавные стороны происходящего",a:["Так же часто, как всегда","Реже, чем обычно","Не так часто, как обычно","Нет, не могла совсем"],p:[0,1,2,3]},
  {q:"Я с нетерпением ожидала различных событий в моей жизни",a:["Так же, как всегда","Скорее меньше","Определенно меньше","Едва ли"],p:[0,1,2,3]},
  {q:"Я необоснованно обвиняла себя",a:["Да, чаще всего","Да, иногда","Не очень часто","Нет, никогда"],p:[3,2,1,0]},
  {q:"Я тревожилась без особой причины",a:["Нет, нисколько","Едва ли когда-либо","Да, иногда","Да, очень часто"],p:[0,1,2,3]},
  {q:"Я была испугана, паниковала",a:["Да, очень часто","Да, иногда","Нет, не часто","Нет, нисколько"],p:[3,2,1,0]},
  {q:"Происходящее давило на меня",a:["Да, большую часть времени","Да, иногда","Нет, большую часть времени","Нет, справлялась хорошо"],p:[3,2,1,0]},
  {q:"Я была настолько расстроена, что у меня появились проблемы со сном",a:["Да, большую часть времени","Да, иногда","Не очень часто","Нет, никогда"],p:[3,2,1,0]},
  {q:"Я чувствовала себя несчастной",a:["Да, большую часть времени","Да, достаточно часто","Не очень часто","Нет, нисколько"],p:[3,2,1,0]},
  {q:"Я была несчастной и часто плакала",a:["Да, большую часть времени","Да, достаточно часто","Только иногда","Нет, никогда"],p:[3,2,1,0]},
  {q:"Мысли о нанесении себе телесного вреда посещали меня",a:["Да, очень часто","Иногда","Едва ли когда-либо","Никогда"],p:[3,2,1,0],selfHarm:true}
];

const $=id=>document.getElementById(id);

const SUPABASE_URL="https://szkqcsedojvmnmwtuyvz.supabase.co";
const SUPABASE_PUBLISHABLE_KEY="sb_publishable_tV8XuoxEIYi0dvxIFlWiQQ_8xinBCKa";

const SB_HEADERS={
  "apikey":SUPABASE_PUBLISHABLE_KEY,
  "Content-Type":"application/json"
};

async function init(){
  await loadCounter();
}

async function loadCounter(){
  try{
    const r=await fetch(
      SUPABASE_URL+"/rest/v1/test_stats?id=eq.1&select=test_takers",
      {headers:SB_HEADERS, cache:"no-store"}
    );
    if(!r.ok) throw new Error("Counter HTTP "+r.status+" "+await r.text());
    const rows=await r.json();
    if(rows && rows[0]){
      $("testTakers").textContent=Number(rows[0].test_takers).toLocaleString("en-US");
    }
  }catch(err){
    console.error("loadCounter error:",err);
    $("testTakers").textContent="—";
  }
}

async function saveCompletedTest(){
  const payload={
    p_attempt_id:attemptId,
    p_age:Number($("age").value),
    p_status:$("status").value,
    p_answers:answersChosen,
    p_score:totalScore,
    p_self_harm_positive:selfHarmPositive
  };

  const r=await fetch(
    SUPABASE_URL+"/rest/v1/rpc/complete_test",
    {
      method:"POST",
      headers:SB_HEADERS,
      body:JSON.stringify(payload)
    }
  );

  if(!r.ok){
    throw new Error("complete_test HTTP "+r.status+" "+await r.text());
  }

  const data=await r.json();
  if(data && typeof data === "object" && !Array.isArray(data) && "test_takers" in data){
    return Number(data.test_takers);
  }
  const value=Array.isArray(data) ? data[0] : data;
  return Number(value);
}

async function ensureSaved(){
  if(saveConfirmed) return true;
  if(savePromise) return savePromise;

  $("dbStatus").textContent="Сохраняем результат…";
  $("dbStatus").classList.remove("hidden");

  savePromise=(async()=>{
    try{
      const newCount=await saveCompletedTest();
      saveConfirmed=true;
      if(Number.isFinite(newCount)){
        $("testTakers").textContent=newCount.toLocaleString("en-US");
      }else{
        await loadCounter();
      }
      $("dbStatus").textContent="Результат сохранён.";
      return true;
    }catch(err){
      console.error("Database save error:",err);
      $("dbStatus").textContent="Не удалось сохранить результат. Код ошибки: "+String(err.message||err);
      return false;
    }finally{
      savePromise=null;
    }
  })();

  return savePromise;
}

function validate(){$("startBtn").disabled=!($("age").value&&$("status").value)}
$("age").oninput=validate;$("status").onchange=validate;
$("startBtn").onclick=()=>{
  current=0;totalScore=0;selfHarmPositive=false;answersChosen.length=0;
  attemptId=(crypto.randomUUID ? crypto.randomUUID() : String(Date.now())+"-"+Math.random().toString(16).slice(2));
  saveConfirmed=false;
  savePromise=null;
  $("dbStatus").textContent="";
  $("dbStatus").classList.add("hidden");
  $("start").classList.add("hidden");$("result").classList.add("hidden");$("test").classList.remove("hidden");render();
};
function render(){
  const q=QUESTIONS[current];
  $("number").textContent=current+1;
  $("progress").style.width=((current+1)/10*100)+"%";
  $("question").textContent=q.q;
  $("answers").innerHTML="";
  q.a.forEach((text,i)=>{
    const b=document.createElement("button");b.className="answer";b.textContent=text;b.onclick=()=>choose(i);$("answers").appendChild(b);
  });
  $("back").classList.toggle("hidden",current===0);
}
function choose(i){
  const q=QUESTIONS[current];
  answersChosen[current]={question:current+1,answerIndex:i,answer:q.a[i],points:q.p[i]};
  totalScore+=q.p[i];
  if(q.selfHarm&&q.p[i]>0) selfHarmPositive=true;
  if(current<9){current++;render();}else finish();
}
$("back").onclick=()=>{
  if(current>0){
    totalScore-=answersChosen[current-1]?.points||0;
    answersChosen.pop();current--;render();
  }
};
async function finish(){
  $("test").classList.add("hidden");
  $("result").classList.remove("hidden");

  $("score").textContent=`Ваш результат: ${totalScore} баллов`;
  $("specialist").href="https://acbt.kz/pacientam/";
  $("specialist").classList.add("hidden");
  $("selfHarmWarning").classList.add("hidden");
  $("selfHarmWarning").textContent="";

  if(totalScore<=8){
    $("resultTitle").textContent="Существенных признаков послеродовой депрессии не выявлено.";
    $("resultText").textContent="Ваш результат находится в диапазоне 0–8 баллов.";
  }else if(totalScore<=13){
    $("resultTitle").textContent="Есть признаки послеродовой депрессии.";
    $("resultText").textContent="Ваш результат находится в диапазоне 9–13 баллов.";
  }else{
    $("resultTitle").textContent="Высокая вероятность послеродовой депрессии.";
    $("resultText").textContent="Ваш результат находится в диапазоне 14–30 баллов.";
  }

  if(selfHarmPositive){
    $("selfHarmWarning").textContent="Ваш ответ на последний вопрос важен. Рекомендуем как можно скорее обратиться к специалисту.";
    $("selfHarmWarning").classList.remove("hidden");
    $("specialist").classList.remove("hidden");
  }

  ensureSaved();
}

$("again").onclick=async()=>{
  await ensureSaved();
  $("result").classList.add("hidden");
  $("start").classList.remove("hidden");
  $("age").value="";
  $("status").value="";
  validate();
};
init();