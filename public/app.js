const app=document.getElementById('app');
const toastHost=document.getElementById('toast');
const A=[
 {id:'strength',name:'Сила',group:'Тело'},{id:'agility',name:'Ловкость',group:'Тело'},{id:'endurance',name:'Выносливость',group:'Тело'},
 {id:'knowledge',name:'Знания',group:'Ум'},{id:'imagination',name:'Воображение',group:'Ум'},{id:'will',name:'Сила воли',group:'Ум'},
 {id:'manipulation',name:'Манипулирование',group:'Харизма'},{id:'presence',name:'Внушительность',group:'Харизма'},{id:'insight',name:'Понимание',group:'Харизма'}
];
const RULES=[
 {title:'Создание персонажа',text:'Определите имя, происхождение, роль и жизненные мотивы. Выберите сильнейшую группу атрибутов (5 очков), слабейшую (3 очка), третья получает 4. Первое очко каждого атрибута бесплатно; пятое стоит два очка распределения. На навыки и предметы выделено 21 очко ценности.'},
 {title:'Броски d10',text:'Пул = один атрибут + один навык + модификаторы условий и предметов. На каждом кубе 8–10 дают +1 успех, единица отнимает 1 успех. Каждая десятка даёт успех и добавляет ещё один d10 (он тоже может дать десятку). Проверка успешна при достижении сложности от 1 до 5. Превышение сложности на три успеха = критический успех; отрицательное число успехов или кубов = критический провал.'},
 {title:'Здоровье и ранения',text:'Максимум физического здоровья = 5 + Выносливость; психологического = 5 + Сила воли. Тупой урон отмечается чертой и обычно восстанавливается за 10–15 минут. Летальный (острый) — крестиком и восстанавливается за сутки. При заполнении всей шкалы последствия зависят от типа последнего полученного урона: отключка/паника либо смерть. Дальнейшие тупые повреждения в отключке становятся летальными.'},
 {title:'Навыки и предметы',text:'Навыки бывают умениями со шкалой 1–5 и способностями вида Да/Нет. Одно очко умения стоит одно очко ценности. Стоимость способностей и предметов задаёт мастер. Описание навыков должно быть достаточно узким. Для развития навыка нужны последовательные успешные проверки по правилам хроники.'},
 {title:'Действия в бою',text:'Один ход — две секунды. Стандартные действия: атака, прицеливание (+1 куб к следующей атаке), укрытие, парирование, перезарядка, захват, использование и доставание предмета, рывок или импровизация. Рывок удваивает скорость движения. Подробности защиты и боевых условий определяет мастер.'},
 {title:'Помощь, длительные действия, соревнования',text:'При помощи один персонаж — основной исполнитель, успехи проверок помощников становятся бонусными кубами исполнителя. В длительном действии проверки повторяются, а пул каждый раз уменьшается на один куб до результата или исчерпания времени/возможности. При соревновании обе стороны делают проверку, побеждает большее число успехов.'}
];
const S={user:null,campaigns:[],setupAvailable:false,workspaceError:'',campaign:null,tab:'sheet',sheet:'stats',charId:null,edit:null,dirty:false,version:0,saveTimer:null,stream:null,online:true,authMode:'login',loading:true,roll:{attr:'knowledge',skill:'',modifier:0,visibility:'all'},lastRoll:null,ruleQuery:''};
const e=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const count=(xs)=>Array.isArray(xs)?xs.length:0;
const cap=(x,min,max)=>Math.min(max,Math.max(min,x));
const val=(x)=>Number.isFinite(Number(x))?Number(x):0;
const unique=()=>typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():'local-'+Math.random().toString(36).slice(2);
const date=x=>new Date(x).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
const busyInput=()=>!!document.activeElement?.matches('input,textarea,select');
function pop(message,error=false){const node=document.createElement('div');node.className='toast'+(error?' error':'');node.textContent=message;toastHost.append(node);setTimeout(()=>node.remove(),4200)}
async function api(path,method='GET',data){
 const options={method,credentials:'same-origin',headers:{'X-Resident-Request':'1'}};
 if(data!==undefined){options.headers['Content-Type']='application/json';options.body=JSON.stringify(data)}
 let res;try{res=await fetch('/api'+path,options)}catch{S.online=false;throw new Error('Нет соединения с сервером')}
 let json={};try{json=await res.json()}catch{}
 if(!res.ok)throw new Error(json.error||'Ошибка '+res.status);
 S.online=true;return json;
}
function headText(title,detail){return '<div class="page-title"><div><div class="eyebrow">BSAA / FIELD TERMINAL</div><h1>'+e(title)+'</h1>'+(detail?'<p>'+e(detail)+'</p>':'')+'</div></div>'}
function button(text,act,extra='',props=''){return '<button type="button" class="btn '+extra+'" data-act="'+e(act)+'" '+props+'>'+text+'</button>'}
function navButtons(){
 const nav=[['sheet','◉','Чарник'],['session','◇','Сессия'],['rules','▤','Правила']];
 if(S.campaign?.role==='gm')nav.push(['gm','⌘','Мастер']);
 return nav.map(n=>'<button class="nav-button '+(S.tab===n[0]?'active':'')+'" data-act="nav" data-tab="'+n[0]+'"><span class="nav-icon">'+n[1]+'</span><span>'+n[2]+'</span></button>').join('');
}
function shell(content){
 const c=S.campaign;const role=c?.role==='gm'?'Мастер':'Оперативник';
 app.innerHTML='<div class="layout"><aside class="sidebar"><div class="brand"><div class="brand-logo">R/26</div><div><h2>RESIDENT</h2><small>FIELD COMPANION</small></div></div><div class="nav-list">'+navButtons()+'</div><div class="sidebar-footer"><div class="user-chip"><div class="avatar">'+e(S.user?.username?.[0]?.toUpperCase()||'R')+'</div><div><b>'+e(S.user?.username)+'</b><br><small>'+role+'</small></div></div><button class="plain" data-act="logout">Выйти из аккаунта</button><p class="version">RESIDENT 2026 / ALPHA 0.3</p></div></aside><main class="main"><header class="topbar"><div><span class="breadcrumbs">ЕДИНАЯ КАМПАНИЯ / '+e(c.title)+'</span><h1>'+e(c.scene?.title||'Операция')+'</h1></div><div class="btn-row"><span class="status '+(S.online?'':'offline')+'"><i></i>'+(S.online?'На связи':'Нет сети')+'</span>'+button('Выйти','logout','ghost sm')+'</div></header><div class="content">'+content+'</div></main><nav class="mobile-bar">'+navButtons()+'</nav></div>';
}
function authView(){
 const registered=S.authMode==='register';
 app.innerHTML='<div class="auth-wrap"><section class="auth-art"><div class="brand"><div class="brand-logo">R/26</div><div><h2>RESIDENT</h2><small>FIELD COMPANION</small></div></div><div><div class="huge">R/26</div><h1>Каждая операция начинается с досье.</h1><p>Цифровой чарник, живые проверки и единый оперативный журнал. Для игроков и ведущих.</p></div><div class="upper">BSAA · ACCESS CONTROL · 2026</div></section><section class="auth-form"><div class="eyebrow">ЗАЩИЩЁННЫЙ ТЕРМИНАЛ</div><h2>'+(registered?'Создать аккаунт':'Вход в систему')+'</h2><form id="auth-form"><div class="field"><label for="username">Позывной / логин</label><input id="username" name="username" autocomplete="username" required minlength="3" maxlength="30" placeholder="например, scientist_ivan"></div><div class="field"><label for="password">Пароль</label><input id="password" name="password" type="password" autocomplete="'+(registered?'new-password':'current-password')+'" required minlength="'+(registered?'10':'1')+'" placeholder="Не менее 10 символов для регистрации"></div><button class="btn primary big block" type="submit">'+(registered?'Зарегистрироваться':'Войти в терминал')+'</button></form><div class="auth-switch">'+(registered?'Уже есть аккаунт?':'Впервые участвуете?')+' <button type="button" data-act="auth-switch">'+(registered?'Войти':'Создать аккаунт')+'</button></div><p class="hint" style="margin-top:25px">Аккаунт нужен, чтобы чарник сохранялся и синхронизировался между устройствами.</p></section></div>';
}
function onboardingView(){
 const first=S.setupAvailable;
 const panel=first?
 '<section class="panel" style="max-width:660px"><div class="panel-head"><h2>Инициализация кампании</h2><span class="tag gold">ТОЛЬКО ОДИН РАЗ</span></div><p class="hint">Первая учётная запись создаёт единственную кампанию и получает роль главного мастера. Затем мастер приглашает игроков по коду.</p><form id="setup-form" style="margin-top:16px"><div class="field"><label>Название общей кампании</label><input name="title" required minlength="3" maxlength="100" value="Resident 2026"></div><button class="btn primary big" type="submit" style="margin-top:15px">Начать кампанию →</button></form></section>':
 '<section class="panel" style="max-width:660px"><div class="panel-head"><h2>Вход в общую кампанию</h2><span class="tag green">ОДНА ГРУППА</span></div><p class="hint">Кампания уже создана мастером. Получите код приглашения, чтобы открыть свой чарник и участвовать в сессии.</p><form id="join-form" class="new-row"><input required name="code" maxlength="24" autocomplete="off" placeholder="Код приглашения от мастера" aria-label="Код приглашения"><button class="btn primary" type="submit">Присоединиться</button></form></section>';
 app.innerHTML='<div class="layout"><aside class="sidebar"><div class="brand"><div class="brand-logo">R/26</div><div><h2>RESIDENT</h2><small>FIELD COMPANION</small></div></div><div class="sidebar-footer"><div class="user-chip"><div class="avatar">'+e(S.user.username[0].toUpperCase())+'</div><div><b>'+e(S.user.username)+'</b><br><small>Аккаунт игрока</small></div></div><button class="plain" data-act="logout">Выйти из аккаунта</button></div></aside><main class="main"><header class="topbar"><div><span class="breadcrumbs">BSAA / ЕДИНАЯ КАМПАНИЯ</span><h1>Resident 2026</h1></div><button class="btn ghost sm" data-act="logout">Выйти</button></header><div class="content">'+headText(first?'Создание операции':'Подключение к группе','Для очных игровых сессий: все за одним столом, чарник у каждого в устройстве.')+(S.workspaceError?'<p class="notice" style="margin-bottom:16px">'+e(S.workspaceError)+'</p>':'')+panel+'</div></main></div>';
}
function targetBudgets(d){
 const middle=['Тело','Ум','Харизма'].find(g=>g!==d.strongest&&g!==d.weakest);
 return {[d.strongest]:5,[d.weakest]:3,[middle]:4};
}
function attrCost(l){return Math.max(0,l-1)+(l===5?1:0)}
function statsPanel(d){
 const budgets=targetBudgets(d);
 const groups=['Тело','Ум','Харизма'].map(g=>{
  const members=A.filter(x=>x.group===g),spent=members.reduce((n,a)=>n+attrCost(val(d.attrs[a.id])),0),target=budgets[g];
  return '<div class="attr-group"><div class="group-heading"><b>'+g+'</b><span class="'+(spent>target?'over':'')+' mono">'+spent+' / '+target+' очков</span></div>'+members.map(a=>{
   const lv=val(d.attrs[a.id]);
   return '<div class="attr-item"><div class="attr-top"><button type="button" title="Выбрать атрибут для броска" data-act="choose-attr" data-key="'+a.id+'">'+a.name+' ↗</button><button type="button" class="quick-roll" title="Бросить этот атрибут одним нажатием" data-act="instant-roll" data-key="'+a.id+'">⚄</button><div class="pips" aria-label="'+lv+' из 5">'+[1,2,3,4,5].map(i=>'<i class="pip '+(i<=lv?'on':'')+'"></i>').join('')+'</div></div><div class="stepper"><button type="button" data-act="attr-step" data-key="'+a.id+'" data-delta="-1" '+(lv<=1?'disabled':'')+'>−</button><span>'+lv+'</span><button type="button" data-act="attr-step" data-key="'+a.id+'" data-delta="1" '+(lv>=5?'disabled':'')+'>+</button></div></div>';
  }).join('')+'</div>';
 }).join('');
 const opts=['Тело','Ум','Харизма'];
 return '<section class="panel"><div class="panel-head"><div class="panel-title"><span class="index">01 /</span><h2>Атрибуты персонажа</h2></div><span class="tag">5 · 4 · 3</span></div><div class="field-row" style="margin-bottom:15px"><div class="field"><label>Сильнейшая группа</label><select data-field="strongest">'+opts.map(x=>'<option '+(x===d.strongest?'selected':'')+'>'+x+'</option>').join('')+'</select></div><div class="field"><label>Слабейшая группа</label><select data-field="weakest">'+opts.map(x=>'<option '+(x===d.weakest?'selected':'')+'>'+x+'</option>').join('')+'</select></div></div><div class="attr-groups">'+groups+'</div><p class="section-note">Нажатие на название атрибута выбирает его для броска. 5-й уровень стоит 2 очка.</p></section>';
}
function hpCard(d,key,title,formula){
 const max=5+val(d.attrs[key==='physical'?'endurance':'will']),damage=d.health?.[key]||[],remaining=Math.max(0,max-damage.length);
 return '<div class="health-card"><div class="upper">'+formula+'</div><h3>'+title+'</h3><div class="hp-number">'+remaining+' <small>/ '+max+' осталось</small></div><div class="hp-pips">'+Array.from({length:max},(_,i)=>'<span class="hp '+(damage[i]||'')+'" title="'+(damage[i]==='blunt'?'Тупой урон':damage[i]==='lethal'?'Летальный урон':'Без повреждений')+'">'+(damage[i]==='blunt'?'╱':damage[i]==='lethal'?'×':'')+'</span>').join('')+'</div><div class="hp-actions"><button class="btn sm ghost" data-act="damage" data-health="'+key+'" data-type="blunt" '+(damage.length>=max?'disabled':'')+'>+ Тупой</button><button class="btn sm danger" data-act="damage" data-health="'+key+'" data-type="lethal" '+(damage.length>=max?'disabled':'')+'>+ Летальный</button><button class="btn sm ghost" data-act="heal" data-health="'+key+'" '+(!damage.length?'disabled':'')+'>↶ Лечение</button></div></div>';
}
function healthPanel(d){return '<section class="panel"><div class="panel-head"><div class="panel-title"><span class="index">02 /</span><h2>Состояние оперативника</h2></div><span class="tag '+(count(d.health.physical)>=5+val(d.attrs.endurance)?'red':'green')+'">STATUS</span></div><div class="health-grid">'+hpCard(d,'physical','Физическое','5 + ВЫНОСЛИВОСТЬ')+hpCard(d,'mental','Психологическое','5 + СИЛА ВОЛИ')+'</div><p class="section-note">Черта — тупой урон, крест — летальный. Нажимайте при получении урона, «Лечение» снимает последнее ранение.</p></section>'}
function budget(d){return d.skills.reduce((n,x)=>n+val(x.level),0)+d.items.reduce((n,x)=>n+val(x.cost),0)}
function skillsPanel(d){
 const current=budget(d),over=current>21;
 return '<section class="panel"><div class="panel-head"><div class="panel-title"><span class="index">03 /</span><h2>Навыки</h2></div><span class="budget '+(over?'over':'')+'">'+current+' / 21 оч. *</span></div>'+(d.skills.length?d.skills.map((s,i)=>'<div class="list-row"><input class="name-input" aria-label="Название навыка" data-skill-name="'+i+'" value="'+e(s.name)+'"><div class="stepper"><button data-act="skill-step" data-index="'+i+'" data-delta="-1" '+(s.level<=0?'disabled':'')+'>−</button><span>'+s.level+'</span><button data-act="skill-step" data-index="'+i+'" data-delta="1" '+(s.level>=5?'disabled':'')+'>+</button></div><button class="btn square ghost" title="Выбрать для проверки" data-act="choose-skill" data-name="'+e(s.name)+'">⚄</button><button class="btn square danger" title="Удалить" data-act="del-skill" data-index="'+i+'">×</button></div>').join(''):'<p class="hint">Навыков пока нет.</p>')+'<div class="new-row"><input id="newSkill" maxlength="90" placeholder="Новый навык (например, Вирусология)">'+button('+ Добавить','add-skill','sm')+'</div><p class="section-note">* Общий бюджет навыков и предметов — 21. Стоимость способностей определяет мастер отдельно.</p></section>';
}
function itemsPanel(d){
 return '<section class="panel"><div class="panel-head"><div class="panel-title"><span class="index">04 /</span><h2>Снаряжение и ресурсы</h2></div><span class="tag">ИНВЕНТАРЬ</span></div>'+(d.items.length?d.items.map((x,i)=>'<div class="list-row"><input class="name-input" aria-label="Предмет" data-item-name="'+i+'" value="'+e(x.name)+'"><label class="sr-only" for="qty'+i+'">Количество</label><input id="qty'+i+'" class="qty" title="Количество" type="number" min="0" max="999" data-item-qty="'+i+'" value="'+x.quantity+'"><label class="sr-only" for="cost'+i+'">Цена в очках</label><input id="cost'+i+'" class="cost" title="Цена в очках ценности" type="number" min="0" max="21" data-item-cost="'+i+'" value="'+x.cost+'"><button class="btn square danger" data-act="del-item" data-index="'+i+'" title="Убрать предмет">×</button></div>').join(''):'<p class="hint">Инвентарь пуст.</p>')+'<div class="new-row"><input id="newItem" maxlength="90" placeholder="Название предмета">'+button('+ Добавить','add-item','sm')+'</div><p class="section-note">Количество и цену в очках можно изменить. Ценность предметов уточняется у мастера.</p></section>';
}
function abilitiesPanel(d){
 return '<section class="panel"><div class="panel-head"><div class="panel-title"><span class="index">05 /</span><h2>Способности</h2></div><span class="tag">ДА / НЕТ</span></div>'+(d.abilities.length?d.abilities.map((x,i)=>'<div class="list-row"><strong>'+e(x.name)+'</strong><span class="tag green">ЕСТЬ</span><button class="btn square danger" data-act="del-ability" data-index="'+i+'">×</button></div>').join(''):'<p class="hint">Способности не добавлены.</p>')+'<div class="new-row"><input id="newAbility" maxlength="100" placeholder="Название способности">'+button('+ Добавить','add-ability','sm')+'</div><p class="section-note">Наличие способности бинарное. Её стоимость устанавливает мастер.</p></section>';
}
function bioPanel(d){
 return '<section class="panel"><div class="panel-head"><div class="panel-title"><span class="index">06 /</span><h2>Личное дело</h2></div></div><div class="field-row"><div class="field"><label>Специализация / концепт</label><input data-field="concept" value="'+e(d.concept||'')+'" placeholder="Учёный, вирусология"></div><div class="field"><label>Место происхождения</label><input data-field="origin" value="'+e(d.origin||'')+'" placeholder="Город, дата рождения"></div></div><div class="field" style="margin-top:13px"><label>Мотивация и жизненные принципы</label><textarea data-field="motivation" rows="3">'+e(d.motivation||'')+'</textarea></div><div class="field" style="margin-top:13px"><label>Биография</label><textarea data-field="story" rows="5">'+e(d.story||'')+'</textarea></div><div class="field" style="margin-top:13px"><label>Личные заметки (видны только вам и мастеру)</label><textarea data-field="notes" rows="5" placeholder="Гипотезы, улики, наблюдения...">'+e(d.notes||'')+'</textarea></div>'+(S.campaign.role==='gm'?'<div class="field" style="margin-top:13px"><label>Закрытые заметки мастера</label><textarea data-field="gmNotes" rows="3">'+e(d.gmNotes||'')+'</textarea></div>':'')+'</section>';
}
function rollPanel(d){
 const attr=S.roll.attr,attrLevel=val(d.attrs[attr]||1),selectedSkill=d.skills.find(s=>s.name===S.roll.skill),skillLevel=val(selectedSkill?.level),pool=attrLevel+skillLevel+val(S.roll.modifier),difficulty=S.campaign.scene.difficulty||1;
 return '<section class="panel"><div class="panel-head"><div class="panel-title"><span class="index">RNG /</span><h2>Бросок на проверку</h2></div><span class="tag gold">d10 × '+Math.max(0,pool)+'</span></div><div class="dice-hero"><div class="upper">ПУЛ ПРОВЕРКИ</div><div class="number mono">'+pool+' <small>кубов</small></div><div class="hint">Атрибут '+attrLevel+' + навык '+skillLevel+' + условия '+val(S.roll.modifier)+'</div><div class="roll-selects"><div class="field"><label>Атрибут</label><select data-control="roll-attr">'+A.map(x=>'<option value="'+x.id+'" '+(x.id===attr?'selected':'')+'>'+x.name+' ('+d.attrs[x.id]+')</option>').join('')+'</select></div><div class="field"><label>Навык</label><select data-control="roll-skill"><option value="">Без навыка</option>'+d.skills.map(x=>'<option value="'+e(x.name)+'" '+(x.name===S.roll.skill?'selected':'')+'>'+e(x.name)+' ('+x.level+')</option>').join('')+'</select></div></div><div class="field-row"><div class="field"><label>Модификатор условий</label><input data-control="roll-modifier" type="number" min="-30" max="30" value="'+val(S.roll.modifier)+'"></div><div class="field"><label>Видимость</label><select data-control="roll-visibility"><option value="all" '+(S.roll.visibility==='all'?'selected':'')+'>Всем участникам</option><option value="private" '+(S.roll.visibility==='private'?'selected':'')+'>Только мне и мастеру</option></select></div></div><div class="hint" style="margin:13px 0">Сложность сцены: '+difficulty+' успех(ов) · задаёт мастер</div>'+button('⚄ БРОСИТЬ КУБЫ','roll','primary big block')+(S.lastRoll?renderLastRoll():'')+'</div></section>';
}
function renderLastRoll(){
 const r=S.lastRoll;const label={success:'УСПЕХ',failure:'НЕУДАЧА',critical_success:'КРИТИЧЕСКИЙ УСПЕХ',critical_failure:'КРИТИЧЕСКИЙ ПРОВАЛ'}[r.outcome]||r.outcome;
 return '<div class="outcome '+e(r.outcome)+'">'+label+' · '+r.successes+' успехов</div><div class="dice-results">'+r.dice.map(d=>'<span class="die '+(d===1?'negative':d===10?'ten':d>=8?'positive':'')+'">'+d+'</span>').join('')+'</div>'+(r.bonusDice?'<div class="hint" style="margin-top:7px">Бонусных кубов от десяток: '+r.bonusDice+'</div>':'');
}
function sheetView(){
 const c=S.campaign,ch=c.characters.find(x=>x.id===S.charId),d=S.edit;
 if(!ch||!d)return headText('Личное дело','Ваш персонаж ещё не создан.')+'<div class="empty"><b>Пока нет персонажа</b><p>Создайте оперативника, чтобы открыть интерактивный чарник.</p>'+button('+ Создать персонажа','new-character','primary')+'</div>';
 const editable=ch.editable,chooser=c.characters.length>1?'<select class="sheet-chooser" data-control="character">'+c.characters.map(x=>'<option value="'+e(x.id)+'" '+(x.id===S.charId?'selected':'')+'>'+e(x.data.name)+(x.editable?'':' · просмотр')+'</option>').join('')+'</select>':'';
 const top='<section class="panel"><div class="sheet-head"><div class="sheet-insignia">✦</div><div><input class="sheet-name" aria-label="Имя персонажа" data-field="name" value="'+e(d.name)+'" '+(!editable?'disabled':'')+'><input class="sheet-role" aria-label="Роль персонажа" data-field="role" value="'+e(d.role)+'" '+(!editable?'disabled':'')+'></div>'+chooser+'</div><div class="btn-row"><span class="tag green">● DOSSIER ACTIVE</span><span class="tag">'+(editable?'РЕДАКТИРОВАНИЕ':'ТОЛЬКО ПРОСМОТР')+'</span><span class="hint" id="saveIndicator">'+(S.dirty?'Сохранение…':'Сохранено на сервере')+'</span>'+(editable?button('Сохранить','save','ghost sm'):'')+button('+ Персонаж','new-character','ghost sm')+'</div></section>';
 if(!editable)return headText('Чарник','Персонаж другого участника доступен только для чтения.')+top+'<div class="stack">'+readonlyChar(d)+'</div>';
 const body=S.sheet==='stats'?'<div class="split"><div class="stack">'+statsPanel(d)+healthPanel(d)+'</div><div class="stack">'+rollPanel(d)+skillsPanel(d)+'</div></div>':S.sheet==='gear'?'<div class="two"><div class="stack">'+itemsPanel(d)+abilitiesPanel(d)+'</div><div class="stack">'+skillsPanel(d)+healthPanel(d)+'</div></div>':bioPanel(d);
 return headText('Личное дело','Всё необходимое для игры — в одном чарнике.')+top+'<div class="sheet-tabs">'+[['stats','Характеристики и броски'],['gear','Навыки и снаряжение'],['bio','Биография и заметки']].map(t=>'<button class="sheet-tab '+(S.sheet===t[0]?'active':'')+'" data-act="sheet-tab" data-tab="'+t[0]+'">'+t[1]+'</button>').join('')+'</div>'+body;
}
function readonlyChar(d){return '<div class="panel"><h2>'+e(d.name)+'</h2><p class="hint">'+e(d.role)+'</p><hr class="thin-rule"><div class="three">'+['Тело','Ум','Харизма'].map(g=>'<div><h3>'+g+'</h3>'+A.filter(x=>x.group===g).map(x=>'<p>'+x.name+': '+d.attrs[x.id]+'</p>').join('')+'</div>').join('')+'</div><hr class="thin-rule"><h3>Навыки</h3>'+d.skills.map(s=>'<p>'+e(s.name)+' · '+s.level+'</p>').join('')+'</div>'}
function eventNode(x){
 let inner='';
 if(x.type==='roll'){
  const r=x.payload;const text={success:'успех',failure:'неудача',critical_success:'критический успех',critical_failure:'критический провал'}[r.outcome]||r.outcome;
  inner='<p><b>'+e(r.character)+'</b> · '+e(text)+' ('+r.successes+' усп. / сложность '+r.difficulty+')</p><div class="dice-line">'+e((r.dice||[]).join(' · '))+' · пул '+r.pool+'</div>';
 }else inner='<p>'+e(x.payload?.text||'Событие')+'</p>';
 return '<article class="event '+e(x.type)+'"><div class="byline"><span>'+e(x.username)+'</span><span>'+date(x.at)+(x.visibility!=='all'?' · скрыто':'')+'</span></div>'+inner+'</article>';
}
function sessionView(){
 const c=S.campaign;
 return headText('Игровая сессия','Общая сцена, инициатива и журнал действий обновляются у всех.')+'<div class="session-hero"><div class="eyebrow">'+e(c.scene.status||'ОПЕРАЦИЯ')+' · РАУНД '+c.round+'</div><h2>'+e(c.scene.title)+'</h2><p>'+e(c.scene.description||'Мастер пока не добавил описание сцены.')+'</p></div><div class="split"><div class="stack"><section class="panel"><div class="panel-head"><h2>Журнал операции</h2><span class="tag green">LIVE</span></div><div class="timeline" id="timeline">'+(c.events.length?c.events.map(eventNode).reverse().join(''):'<p class="hint">Событий пока нет.</p>')+'</div><form id="message-form" class="chat-form"><input name="text" maxlength="1500" required autocomplete="off" placeholder="Сообщение группе или действие персонажа"><button class="btn primary" type="submit">Отправить</button></form></section></div><div class="stack"><section class="panel"><div class="panel-head"><h2>Очередность действий</h2><span class="round">Раунд '+c.round+'</span></div><div class="initiative">'+(c.initiative.length?c.initiative.map((x,i)=>'<div class="initiative-item '+(i===c.turn?'active':'')+'"><span class="mono">'+String(i+1).padStart(2,'0')+'</span><b>'+e(x.name)+'</b><span class="mono">'+x.score+'</span></div>').join(''):'<p class="hint">Мастер пока не составил инициативу.</p>')+'</div></section><section class="panel"><div class="panel-head"><h2>Участники</h2><span class="tag">'+c.members.length+'</span></div>'+c.members.map(m=>'<div class="list-row"><div class="avatar">'+e(m.username[0].toUpperCase())+'</div><strong>'+e(m.username)+'</strong><span class="tag">'+(m.role==='gm'?'Мастер':'Игрок')+'</span></div>').join('')+'</section></div></div>';
}
function rulesView(){const query=S.ruleQuery.toLowerCase(),list=RULES.filter(x=>(x.title+' '+x.text).toLowerCase().includes(query));return headText('Полевой справочник','Краткие правила по материалам кампании, без сюжетных спойлеров.')+'<input class="rules-search" data-control="rules-search" placeholder="Поиск по правилам" value="'+e(S.ruleQuery)+'">'+(list.length?list.map(x=>'<article class="rule"><h3>'+e(x.title)+'</h3><p>'+e(x.text)+'</p></article>').join(''):'<div class="empty">Ничего не найдено</div>')+'<p class="hint">Полные нюансы и нестандартные ситуации определяет мастер. Секретные хроники в справочник не включены.</p>'}
function gmView(){
 const c=S.campaign;if(c.role!=='gm')return headText('Доступ запрещён');
 return headText('Пульт мастера','Сцена, уровни сложности, инициатива и закрытые заметки.')+'<div class="two"><div class="stack"><section class="panel"><div class="panel-head"><h2>Управление сценой</h2><span class="tag gold">GM ONLY</span></div><form id="scene-form"><div class="field"><label>Название сцены</label><input name="title" value="'+e(c.scene.title)+'" required></div><div class="field" style="margin-top:12px"><label>Описание для участников</label><textarea name="description" rows="4">'+e(c.scene.description||'')+'</textarea></div><div class="field-row" style="margin:12px 0"><div class="field"><label>Статус</label><input name="status" value="'+e(c.scene.status||'')+'"></div><div class="field"><label>Сложность проверки</label><select name="difficulty">'+[1,2,3,4,5].map(n=>'<option value="'+n+'" '+(n===c.scene.difficulty?'selected':'')+'>'+n+' успех'+(n===1?'':'а')+'</option>').join('')+'</select></div></div><button type="submit" class="btn primary">Обновить сцену</button></form></section><section class="panel"><div class="panel-head"><h2>Закрытые записи</h2><span class="tag red">НЕ ДЛЯ ИГРОКОВ</span></div><form id="gm-notes-form"><textarea name="notes" rows="8" placeholder="Секретные сведения, планы противников, улики...">'+e(c.gmNotes||'')+'</textarea><button class="btn ghost sm" type="submit" style="margin-top:9px">Сохранить заметки</button></form></section><section class="panel"><div class="panel-head"><h2>Скрытый бросок NPC</h2></div><form id="npc-form" class="stack"><div class="field-row"><div class="field"><label>Название NPC</label><input name="name" value="Противник"></div><div class="field"><label>Пул кубов</label><input name="pool" type="number" min="0" max="100" value="5"></div></div><button type="submit" class="btn gold">⚄ Бросить только для мастера</button></form></section></div><div class="stack"><section class="panel"><div class="panel-head"><h2>Приглашение игроков</h2></div><p class="hint">Код действует, пока мастер не изменит его. Передавайте только участникам кампании.</p><div class="mini-code" style="margin:13px 0">'+e(c.inviteCode)+'</div><div class="btn-row">'+button('Копировать код','copy-code','ghost sm')+(c.ownerId===S.user.id?button('Сменить код','regenerate-code','ghost sm'):'')+'</div><hr class="thin-rule"><h3 style="margin-bottom:12px">Доступы</h3>'+c.members.map(m=>'<div class="list-row"><strong>'+e(m.username)+'</strong>'+(m.userId===c.ownerId?'<span class="tag gold">Создатель</span>':c.ownerId===S.user.id?'<select style="width:115px" data-role-user="'+e(m.userId)+'"><option value="player" '+(m.role==='player'?'selected':'')+'>Игрок</option><option value="gm" '+(m.role==='gm'?'selected':'')+'>Мастер</option></select>':'<span class="tag">'+e(m.role)+'</span>')+'</div>').join('')+'</section><section class="panel"><div class="panel-head"><h2>Инициатива</h2><span class="round">Раунд '+c.round+'</span></div>'+c.initiative.map((x,i)=>'<div class="list-row"><span class="mono">'+(i+1)+'</span><strong>'+e(x.name)+'</strong><span class="mono">'+x.score+'</span><button class="btn square danger" data-act="remove-initiative" data-id="'+e(x.id)+'">×</button></div>').join('')+'<form id="initiative-form" style="margin-top:12px"><div class="field-row"><div class="field"><label>Участник / NPC</label><input name="name" required placeholder="Позывной"></div><div class="field"><label>Инициатива</label><input name="score" type="number" min="0" max="100" value="5" required></div></div><label class="hint"><input name="hidden" type="checkbox" style="width:auto;margin:13px 7px 0 0">Скрыть NPC от игроков</label><button type="submit" class="btn ghost block" style="margin-top:9px">+ В инициативу</button></form>'+button('Следующий ход →','advance','primary block','style="margin-top:12px"')+'</section></div></div>';
}
function render(){
 if(S.loading){app.innerHTML='<div class="boot"><span class="mark">R/26</span><h1>RESIDENT 2026</h1><p>ПОДКЛЮЧЕНИЕ…</p></div>';return}
 if(!S.user){authView();return}
 if(!S.campaign){onboardingView();return}
 shell(S.tab==='sheet'?sheetView():S.tab==='session'?sessionView():S.tab==='rules'?rulesView():gmView());
}
async function loadWorkspace(){
 if(S.stream){S.stream.close();S.stream=null}
 S.campaign=null;S.charId=null;S.edit=null;S.dirty=false;S.workspaceError='';
 const result=await api('/campaigns');
 S.campaigns=result.campaigns;
 S.setupAvailable=Boolean(result.setupAvailable);
 if(S.campaigns.length===1){await openCampaign(S.campaigns[0].id);return}
 if(S.campaigns.length>1)S.workspaceError='В старой базе обнаружено несколько кампаний. Автоматический выбор отключён, чтобы не потерять данные. Администратор должен выполнить миграцию.';
 render();
}
function currentChar(){return S.campaign?.characters.find(x=>x.id===S.charId)}
function pickCharacter(id){const ch=S.campaign.characters.find(x=>x.id===id);S.charId=ch?.id||null;S.edit=ch?structuredClone(ch.data):null;S.dirty=false;S.version++;S.lastRoll=null;render()}
function connectStream(id){
 if(S.stream)S.stream.close();
 const es=new EventSource('/api/campaigns/'+encodeURIComponent(id)+'/stream');S.stream=es;
 es.addEventListener('connected',()=>{S.online=true;refreshCampaign()});
 es.addEventListener('update',()=>refreshCampaign());
 es.onerror=()=>{S.online=false;const ind=document.querySelector('.status');if(ind){ind.classList.add('offline');ind.textContent='Нет соединения'}};
}
async function openCampaign(id){
 try{const data=await api('/campaigns/'+encodeURIComponent(id));S.campaign=data.campaign;S.tab='sheet';
  const mine=S.campaign.characters.find(x=>x.ownerId===S.user.id)||S.campaign.characters[0];
  pickCharacter(mine?.id);connectStream(id);
 }catch(err){pop(err.message,true)}
}
async function refreshCampaign(){
 if(!S.campaign)return;
 try{
  const id=S.campaign.id,data=await api('/campaigns/'+encodeURIComponent(id));if(S.campaign?.id!==id)return;
  S.campaign=data.campaign;
  const ch=currentChar();
  if(!S.dirty&&ch)S.edit=structuredClone(ch.data);
  if(!busyInput())render();
 }catch(err){S.online=false}
}
function changed(){
 S.dirty=true;S.version++;const indicator=document.getElementById('saveIndicator');if(indicator)indicator.textContent='Есть изменения…';
 clearTimeout(S.saveTimer);S.saveTimer=setTimeout(()=>saveChar(),950);
}
async function saveChar(){
 clearTimeout(S.saveTimer);const ch=currentChar();if(!ch||!ch.editable||!S.dirty||!S.edit)return;
 const ver=S.version,data=structuredClone(S.edit),id=ch.id,cid=S.campaign.id;
 try{
  await api('/campaigns/'+cid+'/characters/'+id,'PATCH',data);
  if(ver===S.version){S.dirty=false;const indicator=document.getElementById('saveIndicator');if(indicator)indicator.textContent='Сохранено ✓'}
  else{clearTimeout(S.saveTimer);S.saveTimer=setTimeout(()=>saveChar(),700)}
 }catch(err){pop('Не удалось сохранить чарник: '+err.message,true)}
}
async function mutate(path,method='POST',data){try{await api('/campaigns/'+S.campaign.id+path,method,data);await refreshCampaign()}catch(err){pop(err.message,true)}}
async function doRoll(){
 const ch=currentChar();if(!ch||!ch.editable)return pop('Нужен ваш персонаж',true);
 try{
  if(S.dirty)await saveChar();
  const result=await api('/campaigns/'+S.campaign.id+'/rolls','POST',{characterId:ch.id,attribute:S.roll.attr,skill:S.roll.skill,modifier:cap(Math.trunc(val(S.roll.modifier)),-30,30),visibility:S.roll.visibility});
  S.lastRoll=result.roll;render();pop('Бросок: '+result.roll.successes+' успехов');
 }catch(err){pop(err.message,true)}
}
async function createCharacter(){
 try{
  const obj=await api('/campaigns/'+S.campaign.id+'/characters','POST',{name:'Новый оперативник',role:'Новобранец BSAA'});
  await refreshCampaign();S.sheet='stats';pickCharacter(obj.character.id);
 }catch(err){pop(err.message,true)}
}
function sheetEditAction(act,b){
 const d=S.edit;
 if(!d||!currentChar()?.editable)return;
 const i=val(b.dataset.index),delta=val(b.dataset.delta),key=b.dataset.key;
 if(act==='attr-step')d.attrs[key]=cap(d.attrs[key]+delta,1,5);
 else if(act==='damage'){const arr=d.health[b.dataset.health];if(arr.length<5+(b.dataset.health==='physical'?d.attrs.endurance:d.attrs.will))arr.push(b.dataset.type)}
 else if(act==='heal')d.health[b.dataset.health].pop();
 else if(act==='skill-step')d.skills[i].level=cap(d.skills[i].level+delta,0,5);
 else if(act==='del-skill')d.skills.splice(i,1);
 else if(act==='del-item')d.items.splice(i,1);
 else if(act==='del-ability')d.abilities.splice(i,1);
 else if(act==='add-skill'){const n=document.getElementById('newSkill')?.value?.trim();if(!n)return;d.skills.push({id:unique(),name:n.slice(0,90),level:1})}
 else if(act==='add-item'){const n=document.getElementById('newItem')?.value?.trim();if(!n)return;d.items.push({id:unique(),name:n.slice(0,90),quantity:1,cost:0,notes:''})}
 else if(act==='add-ability'){const n=document.getElementById('newAbility')?.value?.trim();if(!n)return;d.abilities.push({id:unique(),name:n.slice(0,100)})}
 else return;
 changed();render();
}
document.addEventListener('click',async ev=>{
 const b=ev.target.closest('[data-act]');if(!b||b.disabled)return;
 const act=b.dataset.act;
 try{
  if(['attr-step','damage','heal','skill-step','del-skill','del-item','del-ability','add-skill','add-item','add-ability'].includes(act)){sheetEditAction(act,b);return}
  if(act==='auth-switch'){S.authMode=S.authMode==='login'?'register':'login';render();return}
  if(act==='logout'){await api('/auth/logout','POST',{});if(S.stream)S.stream.close();S.user=null;S.campaign=null;S.authMode='login';render();return}
  if(act==='nav'){if(S.dirty)await saveChar();S.tab=b.dataset.tab;render();return}
  if(act==='sheet-tab'){S.sheet=b.dataset.tab;render();return}
  if(act==='choose-attr'){S.roll.attr=b.dataset.key;S.tab='sheet';S.sheet='stats';render();return}
  if(act==='instant-roll'){S.roll.attr=b.dataset.key;S.roll.skill='';await doRoll();return}
  if(act==='choose-skill'){S.roll.skill=b.dataset.name;S.sheet='stats';render();return}
  if(act==='new-character'){await createCharacter();return}
  if(act==='save'){await saveChar();pop('Чарник сохранён');return}
  if(act==='roll'){await doRoll();return}
  if(act==='copy-code'){await navigator.clipboard.writeText(S.campaign.inviteCode);pop('Код скопирован');return}
  if(act==='regenerate-code'){if(!confirm('Старый код приглашения перестанет действовать. Продолжить?'))return;await mutate('/invite/regenerate');return}
  if(act==='advance'){await mutate('/initiative/advance');return}
  if(act==='remove-initiative'){await mutate('/initiative/'+encodeURIComponent(b.dataset.id),'DELETE');return}
 }catch(err){pop(err.message,true)}
});
document.addEventListener('change',async ev=>{
 const t=ev.target;
 if(t.dataset.control==='character'){if(S.dirty)await saveChar();pickCharacter(t.value);return}
 if(t.dataset.control==='roll-attr'){S.roll.attr=t.value;S.lastRoll=null;render();return}
 if(t.dataset.control==='roll-skill'){S.roll.skill=t.value;S.lastRoll=null;render();return}
 if(t.dataset.control==='roll-modifier'){S.roll.modifier=cap(Math.trunc(val(t.value)),-30,30);S.lastRoll=null;render();return}
 if(t.dataset.control==='roll-visibility'){S.roll.visibility=t.value;return}
 if(t.dataset.roleUser){await mutate('/members/'+encodeURIComponent(t.dataset.roleUser),'PATCH',{role:t.value});return}
 if(t.dataset.field==='strongest'||t.dataset.field==='weakest'){
  const other=t.dataset.field==='strongest'?'weakest':'strongest';
  if(t.value===S.edit[other]){pop('Сильная и слабая группы должны различаться',true);render();return}
  S.edit[t.dataset.field]=t.value;changed();render();return;
 }
 if(t.dataset.itemQty!==undefined||t.dataset.itemCost!==undefined){
  const i=val(t.dataset.itemQty!==undefined?t.dataset.itemQty:t.dataset.itemCost);
  const key=t.dataset.itemQty!==undefined?'quantity':'cost';S.edit.items[i][key]=cap(Math.trunc(val(t.value)),0,key==='cost'?21:999);changed();render();return;
 }
});
document.addEventListener('input',ev=>{
 const t=ev.target;if(t.dataset.control==='rules-search'){S.ruleQuery=t.value;
  const pos=t.selectionStart;render();const next=document.querySelector('[data-control="rules-search"]');next?.focus();try{next?.setSelectionRange(pos,pos)}catch{}return;
 }
 if(!S.edit||!currentChar()?.editable)return;
 if(t.dataset.field&& !['strongest','weakest'].includes(t.dataset.field)){S.edit[t.dataset.field]=t.value;changed();return}
 if(t.dataset.skillName!==undefined){S.edit.skills[val(t.dataset.skillName)].name=t.value;changed();return}
 if(t.dataset.itemName!==undefined){S.edit.items[val(t.dataset.itemName)].name=t.value;changed();return}
});
document.addEventListener('submit',async ev=>{
 const form=ev.target;ev.preventDefault();
 const fd=new FormData(form),get=k=>String(fd.get(k)||'').trim();
 try{
  if(form.id==='auth-form'){
   const route=S.authMode==='register'?'/auth/register':'/auth/login';
   const r=await api(route,'POST',{username:get('username'),password:get('password')});
   S.user=r.user;await loadWorkspace();pop('Вход выполнен');return;
  }
  if(form.id==='setup-form'){
   await api('/campaigns','POST',{title:get('title')});await loadWorkspace();pop('Кампания создана');return;
  }
  if(form.id==='join-form'){
   await api('/campaigns/join','POST',{code:get('code')});await loadWorkspace();return;
  }
  if(form.id==='message-form'){await mutate('/messages','POST',{text:get('text')});form.reset();return}
  if(form.id==='scene-form'){await mutate('/scene','POST',{title:get('title'),description:get('description'),status:get('status'),difficulty:val(get('difficulty'))});pop('Сцена обновлена');return}
  if(form.id==='gm-notes-form'){await mutate('/gm-notes','POST',{notes:get('notes')});pop('Заметки сохранены');return}
  if(form.id==='npc-form'){await mutate('/rolls','POST',{name:get('name'),pool:val(get('pool')),visibility:'gm'});pop('Закрытый бросок в журнале мастера');return}
  if(form.id==='initiative-form'){await mutate('/initiative','POST',{name:get('name'),score:val(get('score')),hidden:fd.has('hidden')});return}
 }catch(err){pop(err.message,true)}
});
window.addEventListener('online',()=>{S.online=true;if(S.campaign)refreshCampaign()});
window.addEventListener('offline',()=>{S.online=false});
window.addEventListener('visibilitychange',()=>{if(!document.hidden&&S.campaign)refreshCampaign()});
setInterval(()=>{if(S.campaign&&!document.hidden)refreshCampaign()},20000);
if('serviceWorker'in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('/sw.js').catch(()=>{});
(async()=>{
 try{S.user=(await api('/me')).user}catch{S.user=null}
 S.loading=false;
 if(S.user){try{await loadWorkspace()}catch(err){pop(err.message,true);render()}}
 else render();
})();
